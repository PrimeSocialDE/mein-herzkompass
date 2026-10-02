// Support-Autoresponder (Weg B, serverseitig).
//
// Liest die INBOX von support@ per IMAP, ordnet jede Kundenmail einem Fall in
// der Tabelle support_cases zu und legt dort eine fertige Antwort als Entwurf
// ab. Das Admin-Dashboard (/admin-plan.html, Reiter "Support") zeigt die Fälle
// farbig und verschickt die Antwort per Knopf.
//
// Zustände eines Falls: siehe lib/support-cases.ts
//
// Versand:
//   Standard = SCHATTEN. Der Cron sendet NICHTS an Kunden, er bereitet nur vor.
//   Mit SUPPORT_AUTO_LIVE=1 verschickt er unkritische Entwürfe nach einer
//   Stunde Nachfrist selbst. Veto: die Kundenmail in Gmail mit einem Stern
//   markieren. Heikle Fälle und alles rund ums Geld bleiben immer Entwurf.

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import { fetchInbound, fetchFlaggedUids, googleImapConfigured, type InboundMail } from "@/lib/google-imap";
import { sendViaGoogleSmtp, googleSmtpConfigured } from "@/lib/google-smtp";
import { triageInbound, triageFollowUp, type TriageLeadContext } from "@/lib/support-triage";
import {
  FARBE,
  LABEL,
  esc,
  nl2br,
  sendeAntwort,
  type CaseStatus,
  type SupportCase,
} from "@/lib/support-cases";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const CRON_SECRET = process.env.CRON_SECRET || "pfoten-cron-2024";
const DIGEST_TO = "kontakt@primesocial.de";
const GRACE_MS = 60 * 60 * 1000;      // Nachfrist bis zum Auto-Versand
const MAX_PER_RUN = 12;               // Triage-Budget pro Lauf
const OWN_DOMAINS = ["pfoten-plan.de", "primesocial.de", "lapaplan.pl", "zampaplan.it", "pfoten-post.de"];
const AUTO_SENDERS = /(mailer-daemon|no-?reply|postmaster|notification|newsletter|do-?not-?reply)@/i;

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

function preisInCent(price: string | null | undefined): number | null {
  if (!price) return null;
  const m = String(price).match(/(\d+)[.,](\d{2})/);
  if (m) return parseInt(m[1], 10) * 100 + parseInt(m[2], 10);
  const n = String(price).match(/(\d+)/);
  return n ? parseInt(n[1], 10) * 100 : null;
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

// --- Fall zu einer eingehenden Mail finden -----------------------------------
async function findCase(mail: InboundMail): Promise<SupportCase | null> {
  const keys = [mail.inReplyTo, mail.messageId].filter(Boolean) as string[];
  if (keys.length) {
    const { data } = await supabase
      .from("support_cases")
      .select("*")
      .in("thread_key", keys)
      .order("received_at", { ascending: false })
      .limit(1);
    if (data && data.length) return data[0] as SupportCase;
  }
  // Viele Mailprogramme brechen die Thread-Kette (neuer Betreff, kein
  // In-Reply-To). Deshalb zusätzlich: offener Fall desselben Absenders aus
  // den letzten 30 Tagen.
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const { data } = await supabase
    .from("support_cases")
    .select("*")
    .eq("from_email", mail.fromEmail)
    .neq("status", "erledigt")
    .gte("received_at", since)
    .order("received_at", { ascending: false })
    .limit(1);
  return data && data.length ? (data[0] as SupportCase) : null;
}

function statusFuerKategorie(kategorie: string): CaseStatus {
  return kategorie === "plankorrektur" ? "plankorrektur" : "neu";
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get("secret") !== CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const forceShadow = searchParams.get("dry") === "1";
  const LIVE = process.env.SUPPORT_AUTO_LIVE === "1" && !forceShadow;
  // Einmaliges Nachladen älterer Mails, damit das Dashboard nicht leer startet.
  const backfillDays = Math.min(parseInt(searchParams.get("backfill") || "0", 10) || 0, 30);

  if (!googleImapConfigured() || !googleSmtpConfigured()) {
    return NextResponse.json({ error: "google_credentials_missing" }, { status: 500 });
  }

  const now = Date.now();
  const state = await loadSetting<{ last_uid: number; uidvalidity: number }>("support_auto_state", {
    last_uid: 0,
    uidvalidity: 0,
  });

  // 1) Neue eingehende Mails holen ------------------------------------------
  let fetched;
  try {
    const abUid = backfillDays > 0 ? 0 : state.uidvalidity && state.uidvalidity !== 0 ? state.last_uid : 0;
    fetched = await fetchInbound(backfillDays > 0 ? backfillDays : 2, abUid);
  } catch (e: any) {
    return NextResponse.json({ error: "imap_fetch_failed", detail: e?.message }, { status: 502 });
  }
  if (state.uidvalidity && fetched.uidValidity && fetched.uidValidity !== state.uidvalidity) {
    state.last_uid = 0;
  }

  const candidates = fetched.mails
    .filter((m) => m.fromEmail && !OWN_DOMAINS.some((d) => m.fromEmail.endsWith("@" + d) || m.fromEmail.endsWith("." + d)))
    .filter((m) => !AUTO_SENDERS.test(m.fromEmail));

  const neu: Array<{ fall: SupportCase; folge: boolean }> = [];
  let triagiert = 0;

  for (const m of candidates) {
    const bestehend = await findCase(m);

    // Schon verarbeitet? (Dedup über die Message-ID im Verlauf.)
    if (bestehend && m.messageId && (bestehend.verlauf || []).some((v) => v.mid === m.messageId)) {
      continue;
    }

    // Budget erst NACH der Dublettenprüfung zählen — sonst frisst ein Backfill
    // sein Kontingent immer wieder mit denselben, längst erledigten Mails auf
    // und käme nie bis zu den unbearbeiteten.
    if (triagiert >= MAX_PER_RUN) break;
    triagiert++;

    // Lead nachschlagen (neueste Zeile zu dieser E-Mail).
    const { data: lead } = await supabase
      .from("wauwerk_leads")
      .select("id, email, customer_name, dog_name, selected_plan, price, status, paid, paid_at, plan_sent")
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

    const eingang = {
      mid: m.messageId,
      richtung: "ein" as const,
      text: m.text,
      at: new Date().toISOString(),
    };

    // --- Fall A: Antwort auf ein bereits gemachtes Rettungsangebot ----------
    if (bestehend && bestehend.status === "rettung_angeboten") {
      const f = await triageFollowUp(
        { fromEmail: m.fromEmail, fromName: m.fromName, subject: m.subject, text: m.text },
        leadCtx
      );
      const neuerStatus: CaseStatus =
        f.ergebnis === "annahme" ? "gerettet" : f.ergebnis === "ablehnung" ? "erstattung" : "rettung_angeboten";

      const { data: upd } = await supabase
        .from("support_cases")
        .update({
          status: neuerStatus,
          heikel: f.heikel,
          kurz: f.kurz,
          entwurf: f.antwort,
          letzte_nachricht: m.text,
          received_at: new Date().toISOString(),
          uid: m.uid,
          message_id: m.messageId,
          gesendet_at: null,
          verlauf: [...(bestehend.verlauf || []), eingang],
        })
        .eq("id", bestehend.id)
        .select("*")
        .maybeSingle();
      if (upd) neu.push({ fall: upd as SupportCase, folge: true });
      continue;
    }

    // --- Fall B: Erstklassifikation ----------------------------------------
    const t = await triageInbound(
      { fromEmail: m.fromEmail, fromName: m.fromName, subject: m.subject, text: m.text },
      leadCtx
    );

    let aktionAusgefuehrt = false;
    if (LIVE && !t.heikel && t.aktion === "plan_neu_senden" && lead?.id) {
      aktionAusgefuehrt = await resendPlan(lead.id, lead.email || m.fromEmail);
    }

    const felder = {
      uid: m.uid,
      message_id: m.messageId,
      from_email: m.fromEmail,
      from_name: m.fromName,
      subject: m.subject,
      received_at: new Date().toISOString(),
      kategorie: t.kategorie,
      status: statusFuerKategorie(t.kategorie),
      heikel: t.heikel,
      kurz: aktionAusgefuehrt ? `${t.kurz} · Plan neu ausgelöst` : t.kurz,
      entwurf: t.antwort,
      letzte_nachricht: m.text,
      lead_id: lead?.id || null,
      dog_name: lead?.dog_name || null,
      bezahlt,
      betrag_cent: preisInCent(lead?.price),
    };

    if (bestehend) {
      const { data: upd } = await supabase
        .from("support_cases")
        .update({ ...felder, gesendet_at: null, verlauf: [...(bestehend.verlauf || []), eingang] })
        .eq("id", bestehend.id)
        .select("*")
        .maybeSingle();
      if (upd) neu.push({ fall: upd as SupportCase, folge: true });
    } else {
      const { data: ins } = await supabase
        .from("support_cases")
        .insert({ ...felder, thread_key: m.messageId || `uid:${m.uid}`, verlauf: [eingang] })
        .select("*")
        .maybeSingle();
      if (ins) neu.push({ fall: ins as SupportCase, folge: false });
    }
  }

  // 2) Auto-Versand (nur LIVE) ----------------------------------------------
  const gesendet: string[] = [];
  if (LIVE) {
    const grenze = new Date(now - GRACE_MS).toISOString();
    const { data: faellig } = await supabase
      .from("support_cases")
      .select("*")
      .in("status", ["neu", "plankorrektur"])
      .eq("heikel", false)
      .is("gesendet_at", null)
      .lte("received_at", grenze)
      .limit(10);

    const flagged = await fetchFlaggedUids(3).catch(() => new Set<number>());

    for (const f of (faellig || []) as SupportCase[]) {
      if (flagged.has(f.uid)) continue;           // Stern in Gmail = Veto
      if (!f.entwurf) continue;
      const ok = await sendeAntwort(f, f.entwurf);
      if (ok) gesendet.push(f.from_email);
    }
  }

  // 3) State speichern -------------------------------------------------------
  if (backfillDays === 0) {
    await saveSetting("support_auto_state", {
      last_uid: Math.max(state.last_uid, fetched.maxUid),
      uidvalidity: fetched.uidValidity || state.uidvalidity,
    });
  }

  // 4) Digest an Max ---------------------------------------------------------
  if (neu.length > 0 || gesendet.length > 0 || fetched.skipped.length > 0) {
    const rows = neu
      .map(({ fall, folge }) => {
        const farbe = FARBE[fall.status] || "#6b7280";
        const badge = fall.heikel
          ? "⚠️ bleibt Entwurf"
          : LIVE
          ? "➡️ geht in ~1 Std raus"
          : "👁️ Schatten – kein Versand";
        return `<div style="margin:0 0 18px;padding:12px 14px;border:1px solid #e5e7eb;border-left:4px solid ${farbe};border-radius:8px">
          <div style="font-size:13px;color:#6b7280">${esc(LABEL[fall.status] || fall.status)}${folge ? " · Folgemail" : ""} · ${badge}</div>
          <div style="font-weight:600;margin:2px 0">${esc(fall.from_name || "")} &lt;${esc(fall.from_email)}&gt;</div>
          <div style="font-size:13px;color:#374151;margin-bottom:8px">Betreff: ${esc(fall.subject || "")} — ${esc(fall.kurz || "")}</div>
          <div style="background:#f9fafb;border-radius:6px;padding:10px;font-size:14px;color:#111">${nl2br(fall.entwurf || "")}</div>
        </div>`;
      })
      .join("");

    const modus = LIVE ? "LIVE (Auto-Versand nach 1 Std aktiv)" : "SCHATTEN-MODUS (es wird nichts an Kunden gesendet)";
    const skippedLine = fetched.skipped.length
      ? `<p style="color:#b45309">⚠️ ${fetched.skipped.length} Mail(s) konnten nicht gelesen werden (UID ${fetched.skipped.join(", ")}) — bitte im Postfach nachsehen.</p>`
      : "";
    const sentLine = gesendet.length
      ? `<p style="color:#166534">✅ Soeben automatisch gesendet: ${gesendet.map(esc).join(", ")}</p>`
      : "";

    const html = `<div style="font-family:Arial,sans-serif;max-width:680px;margin:0 auto;color:#111">
      <h2 style="margin:0 0 4px">🐾 Support-Autoresponder</h2>
      <p style="color:#6b7280;margin:0 0 16px">Modus: <b>${modus}</b> · ${neu.length} neue${neu.length === 1 ? "r Fall" : " Fälle"}</p>
      ${skippedLine}
      ${sentLine}
      ${rows || "<p>Keine neuen Fälle.</p>"}
      <p style="font-size:13px;margin-top:18px"><a href="https://www.pfoten-plan.de/admin-plan.html">Im Dashboard öffnen →</a></p>
    </div>`;

    try {
      await sendViaGoogleSmtp({
        to: DIGEST_TO,
        subject: `🐾 Support: ${neu.length} neu${gesendet.length ? `, ${gesendet.length} gesendet` : ""}`,
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
    backfill_tage: backfillDays || undefined,
    geholt: fetched.mails.length,
    uebersprungen: fetched.skipped.length,
    neu: neu.length,
    gesendet: gesendet.length,
  });
}
