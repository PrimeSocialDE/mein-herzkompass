// Support-Autoresponder für support@pfoten-plan.de.
//
// Läuft als Vercel-Cron. Liest eingehende Kundenmails (IMAP, read-only),
// klassifiziert sie mit Claude, formuliert Antworten und – im Live-Modus –
// führt sichere Aktionen aus (Plan neu ausliefern) und sendet die Antwort
// nach ~1 Std automatisch.
//
// SICHERHEIT / MODI:
//   - Standard = SCHATTEN-MODUS: es wird NICHTS an Kunden gesendet und KEINE
//     Aktion ausgeführt. Der Cron legt nur Vorschläge an und schickt Max eine
//     Digest-Mail ("das würde ich senden/tun"). Zum Qualität-Prüfen.
//   - LIVE (env SUPPORT_AUTO_LIVE=1): Routine-Fälle (Widerruf-Vorlage,
//     "Plan neu geschickt", klare Standardfragen) gehen nach ~1 Std automatisch
//     raus; "heikle" Fälle (wütend, rechtlich, Zahlungskonflikt, unklar,
//     unbekannter Absender) bleiben IMMER Entwurf zur manuellen Freigabe.
//   - VETO: Markiert Max die Kundenmail in Gmail mit einem STERN (\Flagged),
//     wird der geplante Auto-Versand für diesen Fall übersprungen.
//
// State liegt in system_settings (keine neue Tabelle):
//   key "support_auto_state" = { last_uid, uidvalidity }
//   key "support_auto_queue" = Array der Vorgänge (Vorschläge/Sendungen)

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import { fetchInbound, fetchFlaggedUids, googleImapConfigured } from "@/lib/google-imap";
import { sendViaGoogleSmtp, googleSmtpConfigured } from "@/lib/google-smtp";
import { triageInbound, type TriageLeadContext } from "@/lib/support-triage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const CRON_SECRET = process.env.CRON_SECRET || "pfoten-cron-2024";
const DIGEST_TO = "kontakt@primesocial.de";
const GRACE_MS = 60 * 60 * 1000;      // 1 Std Nachfrist bis Auto-Versand
const MAX_PER_RUN = 12;               // Triage-Budget pro Lauf
const OWN_DOMAINS = ["pfoten-plan.de", "primesocial.de", "lapaplan.pl"];
const AUTO_SENDERS = /(mailer-daemon|no-?reply|postmaster|notification|newsletter|do-?not-?reply)@/i;

interface QueueItem {
  uid: number;
  messageId: string;
  fromEmail: string;
  fromName: string;
  subject: string;
  kurz: string;
  kategorie: string;
  heikel: boolean;
  aktion: string;
  aktionAusgefuehrt: boolean;
  antwort: string;
  leadId: string | null;
  createdAt: string;      // ISO
  sendAfter: string;      // ISO
  status: "shadow" | "pending" | "hold" | "sent" | "cancelled" | "error";
  sentAt?: string;
  fehler?: string;
}

// --- system_settings Key/Value-Helfer ---------------------------------------
async function loadSetting<T>(key: string, fallback: T): Promise<T> {
  const { data } = await supabase.from("system_settings").select("value").eq("key", key).maybeSingle();
  return (data?.value as T) ?? fallback;
}
async function saveSetting(key: string, value: unknown): Promise<void> {
  await supabase
    .from("system_settings")
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
}

function firstName(customerName: string | null | undefined, fromName: string): string {
  const src = (customerName || fromName || "").trim();
  if (!src) return "";
  return src.split(/\s+/)[0].replace(/[^A-Za-zÄÖÜäöüß-]/g, "");
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function nl2br(s: string): string {
  return esc(s).replace(/\n/g, "<br>");
}

// --- Plan neu ausliefern -----------------------------------------------------
// WICHTIG: Der reine Status-Flip (status→paid) liefert bei Wiederholungs-Käufern
// NICHT aus — die Pipeline überspringt Leads, für deren E-Mail schon ein Plan
// existiert (auch wenn die Mail nie ankam). Zuverlässig ist NUR /plan/generate
// mit force:true — das generiert neu UND verschickt die Mail.
async function resendPlan(leadId: string, email: string): Promise<boolean> {
  const workerToken = process.env.WORKER_TOKEN;
  if (!workerToken) return false;
  const rawBase =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    "https://www.pfoten-plan.de";
  const baseUrl = rawBase.replace(/^http:\/\//, "https://").replace(/\/+$/, "");
  try {
    const res = await fetch(`${baseUrl}/api/mitglieder/plan/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${workerToken}` },
      body: JSON.stringify({ lead_id: leadId, email, force: true }),
    });
    const txt = await res.text().catch(() => "");
    let ok = false;
    for (const line of txt.split("\n").filter(Boolean)) {
      try { const o = JSON.parse(line); if (o.event === "done") ok = !!o.ok; } catch {}
    }
    return ok;
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get("secret") !== CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const forceShadow = searchParams.get("dry") === "1";
  const LIVE = process.env.SUPPORT_AUTO_LIVE === "1" && !forceShadow;

  if (!googleImapConfigured() || !googleSmtpConfigured()) {
    return NextResponse.json({ error: "google_credentials_missing" }, { status: 500 });
  }

  const now = Date.now();
  const state = await loadSetting<{ last_uid: number; uidvalidity: number }>("support_auto_state", {
    last_uid: 0,
    uidvalidity: 0,
  });
  let queue = await loadSetting<QueueItem[]>("support_auto_queue", []);
  const knownMsgIds = new Set(queue.map((q) => q.messageId).filter(Boolean));

  // 1) Neue eingehende Mails holen ------------------------------------------
  let fetched;
  try {
    fetched = await fetchInbound(2, state.uidvalidity && state.uidvalidity !== 0 ? state.last_uid : 0);
  } catch (e: any) {
    return NextResponse.json({ error: "imap_fetch_failed", detail: e?.message }, { status: 502 });
  }
  // UIDVALIDITY-Wechsel → last_uid zurücksetzen (Dedup läuft über messageId).
  if (state.uidvalidity && fetched.uidValidity && fetched.uidValidity !== state.uidvalidity) {
    state.last_uid = 0;
  }

  const candidates = fetched.mails
    .filter((m) => m.fromEmail && !OWN_DOMAINS.some((d) => m.fromEmail.endsWith("@" + d) || m.fromEmail.endsWith("." + d)))
    .filter((m) => !AUTO_SENDERS.test(m.fromEmail))
    .filter((m) => !m.messageId || !knownMsgIds.has(m.messageId))
    .slice(0, MAX_PER_RUN);

  const neu: QueueItem[] = [];
  for (const m of candidates) {
    // Lead nachschlagen (neueste Zeile zu dieser E-Mail).
    const { data: lead } = await supabase
      .from("wauwerk_leads")
      .select("id, email, customer_name, dog_name, selected_plan, status, paid, paid_at, plan_sent")
      .ilike("email", m.fromEmail)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const bezahlt = !!lead && (lead.paid === true || lead.status === "paid" || !!lead.paid_at);
    const leadCtx: TriageLeadContext = {
      found: !!lead,
      vorname: firstName(lead?.customer_name, m.fromName),
      hundename: lead?.dog_name || "",
      bezahlt,
      plan: lead?.selected_plan || "",
      planGesendet: !!lead?.plan_sent,
    };

    const t = await triageInbound(
      { fromEmail: m.fromEmail, fromName: m.fromName, subject: m.subject, text: m.text },
      leadCtx
    );

    let aktionAusgefuehrt = false;
    if (LIVE && !t.heikel && t.aktion === "plan_neu_senden" && lead?.id) {
      aktionAusgefuehrt = await resendPlan(lead.id, lead.email || m.fromEmail);
    }

    const status: QueueItem["status"] = !LIVE ? "shadow" : t.heikel ? "hold" : "pending";

    neu.push({
      uid: m.uid,
      messageId: m.messageId,
      fromEmail: m.fromEmail,
      fromName: m.fromName,
      subject: m.subject,
      kurz: t.kurz,
      kategorie: t.kategorie,
      heikel: t.heikel,
      aktion: t.aktion,
      aktionAusgefuehrt,
      antwort: t.antwort,
      leadId: lead?.id || null,
      createdAt: new Date(now).toISOString(),
      sendAfter: new Date(now + GRACE_MS).toISOString(),
      status,
    });
  }

  queue = queue.concat(neu);

  // 2) Versand-Durchgang (nur LIVE) -----------------------------------------
  const sent: QueueItem[] = [];
  if (LIVE) {
    const duePending = queue.filter((q) => q.status === "pending" && new Date(q.sendAfter).getTime() <= now);
    if (duePending.length) {
      const flagged = await fetchFlaggedUids(3); // Stern = Veto
      for (const item of duePending) {
        if (flagged.has(item.uid)) {
          item.status = "cancelled";
          continue;
        }
        try {
          const subject = item.subject.replace(/^\s*(Re|Aw|AW|WG|Fwd):\s*/i, "");
          await sendViaGoogleSmtp({
            to: item.fromEmail,
            subject: "Re: " + subject,
            html: `<div style="font-family:Arial,sans-serif;font-size:15px;color:#1f2937;line-height:1.6">${nl2br(item.antwort)}</div>`,
            text: item.antwort,
            replyTo: "support@pfoten-plan.de",
            extraHeaders: item.messageId
              ? { "In-Reply-To": item.messageId, References: item.messageId }
              : undefined,
          });
          item.status = "sent";
          item.sentAt = new Date().toISOString();
          sent.push(item);
        } catch (e: any) {
          item.status = "error";
          item.fehler = e?.message || "send_failed";
        }
      }
    }
  }

  // 3) Queue aufräumen (erledigte >7 Tage raus, max 300) ---------------------
  const cutoff = now - 7 * 86_400_000;
  queue = queue
    .filter((q) => {
      if (["sent", "cancelled", "error"].includes(q.status)) {
        return new Date(q.sentAt || q.createdAt).getTime() > cutoff;
      }
      return true;
    })
    .slice(-300);

  // 4) State speichern -------------------------------------------------------
  await saveSetting("support_auto_state", {
    last_uid: Math.max(state.last_uid, fetched.maxUid),
    uidvalidity: fetched.uidValidity || state.uidvalidity,
  });
  await saveSetting("support_auto_queue", queue);

  // 5) Digest an Max (nur wenn diesen Lauf etwas passierte) ------------------
  const offeneHolds = queue.filter((q) => q.status === "hold" || (q.status === "shadow" && q.heikel));
  if (neu.length > 0 || sent.length > 0) {
    const rows = neu
      .map((q) => {
        const badge = q.heikel ? "⚠️ HEIKEL – bleibt Entwurf" : LIVE ? `➡️ geht ~${new Date(q.sendAfter).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} raus` : "👁️ Schatten – kein Versand";
        const akt = q.aktion === "plan_neu_senden" ? (q.aktionAusgefuehrt ? " · ✅ Plan neu ausgelöst" : LIVE ? "" : " · (würde Plan neu auslösen)") : "";
        return `<div style="margin:0 0 18px;padding:12px 14px;border:1px solid #e5e7eb;border-radius:8px">
          <div style="font-size:13px;color:#6b7280">${esc(q.kategorie)} · ${badge}${akt}</div>
          <div style="font-weight:600;margin:2px 0">${esc(q.fromName || "")} &lt;${esc(q.fromEmail)}&gt;</div>
          <div style="font-size:13px;color:#374151;margin-bottom:8px">Betreff: ${esc(q.subject)} — ${esc(q.kurz)}</div>
          <div style="background:#f9fafb;border-radius:6px;padding:10px;font-size:14px;color:#111">${nl2br(q.antwort)}</div>
        </div>`;
      })
      .join("");

    const modus = LIVE ? "LIVE (Auto-Versand nach 1 Std aktiv)" : "SCHATTEN-MODUS (es wird nichts an Kunden gesendet)";
    const sentLine = sent.length
      ? `<p style="color:#166534">✅ Soeben automatisch gesendet: ${sent.map((s) => esc(s.fromEmail)).join(", ")}</p>`
      : "";

    const html = `<div style="font-family:Arial,sans-serif;max-width:680px;margin:0 auto;color:#111">
      <h2 style="margin:0 0 4px">🐾 Support-Autoresponder</h2>
      <p style="color:#6b7280;margin:0 0 16px">Modus: <b>${modus}</b> · ${neu.length} neue${neu.length === 1 ? "r Fall" : " Fälle"}${offeneHolds.length ? ` · ${offeneHolds.length} warten auf deine Freigabe` : ""}</p>
      ${sentLine}
      ${rows || "<p>Keine neuen Fälle.</p>"}
      <p style="font-size:12px;color:#9ca3af;margin-top:20px">${LIVE ? "Stopp eines Auto-Versands: die Kundenmail in Gmail mit einem Stern markieren." : "Zum Scharfschalten: SUPPORT_AUTO_LIVE=1 setzen."}</p>
    </div>`;

    try {
      await sendViaGoogleSmtp({
        to: DIGEST_TO,
        subject: `🐾 Support: ${neu.length} neu${sent.length ? `, ${sent.length} gesendet` : ""}${offeneHolds.length ? `, ${offeneHolds.length} zur Freigabe` : ""}`,
        html,
        fromName: "Pfoten-Autoresponder",
      });
    } catch (e) {
      console.error("[support-autoresponder] Digest-Versand fehlgeschlagen:", e);
    }
  }

  return NextResponse.json({
    ok: true,
    modus: LIVE ? "live" : "schatten",
    geholt: fetched.mails.length,
    neu: neu.length,
    gesendet: sent.length,
    offene_holds: offeneHolds.length,
    queue_groesse: queue.length,
  });
}
