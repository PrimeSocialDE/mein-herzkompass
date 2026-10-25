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
//   LIVE über SUPPORT_AUTO_LIVE=1 (Vercel) ODER system_settings.support_auto_live
//   = "true". Ab dann gehen unkritische Antworten nach 2 Std raus, "Plan nicht
//   angekommen" nach 20 Min. Nur Mails, die NACH system_settings.support_live_ab
//   eingegangen sind (kein Altbestand). Veto: Kundenmail in Gmail mit Stern.
//
// Ablauf (Vorgabe Max, 19.10.2026):
//   - Storno OHNE vorherigen Support-Kontakt -> feste Vorlage (Zusatzplan statt
//     Erstattung), geht automatisch raus.
//   - Storno MIT vorherigem Kontakt -> bleibt Entwurf + sofortige Meldung an Max.
//   - Antwort auf die Vorlage bzw. Plankorrektur mit konkreter Problemschilderung
//     -> Status zusatzplan_offen; /api/cron/support-zusatzplan baut den Plan
//     und schickt ihn mit "Wir haben den Plan angepasst…".
//   - Kunde lehnt ab / besteht auf Erstattung -> Status erstattung + sofortige
//     Meldung an Max (Geld geht nie automatisch raus).
//   - Normale Fälle (Zahlung, Fragen …) -> KI-Antwort nach 2 Std.

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import { fetchInbound, fetchFlaggedUids, googleImapConfigured, type InboundMail } from "@/lib/google-imap";
import { sendViaGoogleSmtp, googleSmtpConfigured } from "@/lib/google-smtp";
import { istAutoAntwort, triageInbound, triageFollowUp, triageProblem, widerrufTemplate, type TriageLeadContext } from "@/lib/support-triage";
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
const GRACE_MS = 2 * 60 * 60 * 1000;      // Nachfrist bis zum Auto-Versand (Standard 2 Std)
const GRACE_PLAN_FEHLT_MS = 20 * 60 * 1000; // Plan nicht angekommen: 20 Min
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
  const liveSetting = String(await loadSetting<any>("support_auto_live", "")).trim();
  const LIVE = (process.env.SUPPORT_AUTO_LIVE === "1" || liveSetting === "true") && !forceShadow;
  // Nur Mails nach diesem Zeitpunkt werden automatisch beantwortet (kein Altbestand).
  const liveAb = String(await loadSetting<any>("support_live_ab", "")).trim() || new Date().toISOString();
  const alarme: string[] = [];
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

    // Automatische Antwort (Abwesenheit/Urlaub/Autoreply)? Nur protokollieren,
    // NIE antworten und keinen bestehenden Fall verändern (sonst Mail-Schleife).
    if (istAutoAntwort(m.subject, m.text)) {
      const eingangAuto = { mid: m.messageId, richtung: "ein" as const, text: m.text, at: new Date().toISOString() };
      if (bestehend) {
        await supabase.from("support_cases").update({ verlauf: [...(bestehend.verlauf || []), eingangAuto] }).eq("id", bestehend.id);
      } else {
        await supabase.from("support_cases").insert({
          thread_key: m.messageId || `uid:${m.uid}`, uid: m.uid, message_id: m.messageId,
          from_email: m.fromEmail, from_name: m.fromName, subject: m.subject,
          received_at: new Date().toISOString(), kategorie: "sonstiges", status: "erledigt",
          heikel: false, kurz: "Automatische Antwort/Abwesenheit, keine Antwort", entwurf: null,
          letzte_nachricht: m.text, verlauf: [eingangAuto], erledigt_at: new Date().toISOString(),
        });
      }
      continue;
    }

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
      let neuerStatus: CaseStatus =
        f.ergebnis === "annahme" ? "rettung_angeboten" : f.ergebnis === "ablehnung" ? "erstattung" : "rettung_angeboten";
      let entwurfA: string | null = f.antwort;
      let heikelA = f.heikel;
      let kurzA = f.kurz;
      if (f.ergebnis === "annahme") {
        // Reicht die Schilderung für einen Zusatzplan? Dann baut ihn der
        // Zusatzplan-Cron, und dessen Mail ist die Antwort.
        const bisher = (bestehend.verlauf || []).filter((v) => v.richtung === "ein").map((v) => v.text);
        const p = await triageProblem([...bisher.slice(-2), m.text].join("\n\n---\n\n"));
        if (p.ausreichend) {
          neuerStatus = "zusatzplan_offen";
          entwurfA = null;
          heikelA = false;
          kurzA = `Zusatzplan wird erstellt: ${p.beschreibung.slice(0, 160)}`;
        } else {
          heikelA = false; // Nachfrage nach 3–4 Sätzen ist unkritisch
        }
      }
      if (f.ergebnis === "ablehnung") {
        alarme.push(`💸 Erstattung gewünscht: ${m.fromName || ""} <${m.fromEmail}> — lehnt den Zusatzplan ab bzw. besteht auf Geld zurück. ${f.kurz || ""}`);
      }

      const { data: upd } = await supabase
        .from("support_cases")
        .update({
          status: neuerStatus,
          heikel: heikelA,
          kurz: kurzA,
          entwurf: entwurfA,
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

    // --- Fall A2: Antwort auf unsere Nachfrage zur Plankorrektur ------------
    if (bestehend && bestehend.status === "plankorrektur" && bestehend.gesendet_at) {
      const bisher = (bestehend.verlauf || []).filter((v) => v.richtung === "ein").map((v) => v.text);
      const p = await triageProblem([...bisher.slice(-2), m.text].join("\n\n---\n\n"));
      if (p.ausreichend) {
        const { data: upd } = await supabase
          .from("support_cases")
          .update({
            status: "zusatzplan_offen",
            heikel: false,
            kurz: `Zusatzplan wird erstellt: ${p.beschreibung.slice(0, 160)}`,
            entwurf: null,
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
    }

    // --- Fall B: Erstklassifikation ----------------------------------------
    const t = await triageInbound(
      { fromEmail: m.fromEmail, fromName: m.fromName, subject: m.subject, text: m.text },
      leadCtx
    );

    // Hatte diese Person schon Support-Kontakt? (Eigener Fall mit früherer Mail
    // oder irgendein anderer Fall derselben Adresse.)
    const { count: andereFaelle } = await supabase
      .from("support_cases")
      .select("id", { count: "exact", head: true })
      .eq("from_email", m.fromEmail)
      .neq("id", bestehend?.id || "00000000-0000-0000-0000-000000000000");
    const hatteKontakt = (andereFaelle || 0) > 0 || (bestehend?.verlauf || []).length > 0;

    let status: CaseStatus = statusFuerKategorie(t.kategorie);
    let entwurf: string | null = t.antwort;
    let heikel = t.heikel;
    let kurz = t.kurz;

    // Keine Antwort nötig (reines Danke/Bestätigung, Werbung …) -> still erledigen.
    if (!t.antwortNoetig) {
      status = "erledigt";
      entwurf = null;
      heikel = false;
      kurz = `Keine Antwort nötig: ${t.kurz || ""}`.slice(0, 200);
    }

    if (t.kategorie === "widerruf") {
      if (!hatteKontakt) {
        // Erster Kontakt -> feste Vorlage, geht automatisch raus (auch wenn die
        // Absenderadresse nicht in der DB steht, z.B. andere Mail als beim Kauf).
        entwurf = widerrufTemplate(leadCtx.vorname || firstName(null, m.fromName));
        heikel = false;
      } else {
        heikel = true;
        alarme.push(`↩️ Storno von jemandem, der schon Kontakt hatte: ${m.fromName || ""} <${m.fromEmail}> — ${t.kurz || ""}`);
      }
    } else if (t.kategorie === "plankorrektur") {
      const p = await triageProblem(m.text);
      if (p.ausreichend) {
        status = "zusatzplan_offen";
        entwurf = null;
        heikel = false;
        kurz = `Zusatzplan wird erstellt: ${p.beschreibung.slice(0, 160)}`;
      }
    }

    let aktionAusgefuehrt = false;
    if (LIVE && !heikel && t.aktion === "plan_neu_senden" && lead?.id) {
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
      status,
      heikel,
      kurz: aktionAusgefuehrt ? `${kurz} · Plan neu ausgelöst` : kurz,
      entwurf,
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
    const grenzeKurz = new Date(now - GRACE_PLAN_FEHLT_MS).toISOString();
    const { data: faellig } = await supabase
      .from("support_cases")
      .select("*")
      .in("status", ["neu", "plankorrektur", "rettung_angeboten", "gerettet"])
      .eq("heikel", false)
      .is("gesendet_at", null)
      .not("entwurf", "is", null)
      .gte("received_at", liveAb)
      .lte("received_at", grenzeKurz)
      .order("received_at", { ascending: true })
      .limit(15);

    const flagged = await fetchFlaggedUids(3).catch(() => new Set<number>());

    for (const f of (faellig || []) as SupportCase[]) {
      if (flagged.has(f.uid)) continue;           // Stern in Gmail = Veto
      if (!f.entwurf) continue;
      const frist = f.kategorie === "plan_fehlt" ? GRACE_PLAN_FEHLT_MS : GRACE_MS;
      if (new Date(f.received_at).getTime() > now - frist) continue;
      // Schleifenschutz: dieselbe Adresse hat in den letzten 12 Std schon eine
      // automatische Antwort bekommen -> nicht noch einmal, Max entscheidet.
      const { count: kuerzlich } = await supabase
        .from("support_cases")
        .select("id", { count: "exact", head: true })
        .eq("from_email", f.from_email)
        .neq("id", f.id)
        .gte("gesendet_at", new Date(now - 12 * 3600 * 1000).toISOString());
      if ((kuerzlich || 0) > 0) {
        await supabase.from("support_cases").update({ heikel: true }).eq("id", f.id);
        alarme.push(`🔁 Zweite Mail von ${f.from_email} innerhalb von 12 Std — bitte selbst prüfen (Schleifenschutz).`);
        continue;
      }
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
  if (neu.length > 0 || gesendet.length > 0 || fetched.skipped.length > 0 || alarme.length > 0) {
    const rows = neu
      .map(({ fall, folge }) => {
        const farbe = FARBE[fall.status] || "#6b7280";
        const badge = fall.heikel
          ? "⚠️ bleibt Entwurf"
          : fall.status === "zusatzplan_offen"
          ? "🛠️ Zusatzplan wird automatisch erstellt"
          : LIVE
          ? (fall.kategorie === "plan_fehlt" ? "➡️ geht in ~20 Min raus" : "➡️ geht in ~2 Std raus")
          : "👁️ Schatten – kein Versand";
        return `<div style="margin:0 0 18px;padding:12px 14px;border:1px solid #e5e7eb;border-left:4px solid ${farbe};border-radius:8px">
          <div style="font-size:13px;color:#6b7280">${esc(LABEL[fall.status] || fall.status)}${folge ? " · Folgemail" : ""} · ${badge}</div>
          <div style="font-weight:600;margin:2px 0">${esc(fall.from_name || "")} &lt;${esc(fall.from_email)}&gt;</div>
          <div style="font-size:13px;color:#374151;margin-bottom:8px">Betreff: ${esc(fall.subject || "")} — ${esc(fall.kurz || "")}</div>
          <div style="background:#f9fafb;border-radius:6px;padding:10px;font-size:14px;color:#111">${nl2br(fall.entwurf || "")}</div>
        </div>`;
      })
      .join("");

    const modus = LIVE ? "LIVE (Auto-Versand nach 2 Std, Plan fehlt nach 20 Min)" : "SCHATTEN-MODUS (es wird nichts an Kunden gesendet)";
    const alarmBlock = alarme.length
      ? `<div style="margin:0 0 16px;padding:12px 14px;background:#FEF2F2;border:1px solid #FCA5A5;border-radius:8px;color:#991B1B">${alarme.map((a) => `<p style="margin:4px 0">${esc(a)}</p>`).join("")}</div>`
      : "";
    const skippedLine = fetched.skipped.length
      ? `<p style="color:#b45309">⚠️ ${fetched.skipped.length} Mail(s) konnten nicht gelesen werden (UID ${fetched.skipped.join(", ")}) — bitte im Postfach nachsehen.</p>`
      : "";
    const sentLine = gesendet.length
      ? `<p style="color:#166534">✅ Soeben automatisch gesendet: ${gesendet.map(esc).join(", ")}</p>`
      : "";

    const html = `<div style="font-family:Arial,sans-serif;max-width:680px;margin:0 auto;color:#111">
      <h2 style="margin:0 0 4px">🐾 Support-Autoresponder</h2>
      <p style="color:#6b7280;margin:0 0 16px">Modus: <b>${modus}</b> · ${neu.length} neue${neu.length === 1 ? "r Fall" : " Fälle"}</p>
      ${alarmBlock}
      ${skippedLine}
      ${sentLine}
      ${rows || "<p>Keine neuen Fälle.</p>"}
      <p style="font-size:13px;margin-top:18px"><a href="https://www.pfoten-plan.de/admin-plan.html">Im Dashboard öffnen →</a></p>
    </div>`;

    try {
      await sendViaGoogleSmtp({
        to: DIGEST_TO,
        subject: `${alarme.length ? "⚠️ Aktion nötig · " : ""}🐾 Support: ${neu.length} neu${gesendet.length ? `, ${gesendet.length} gesendet` : ""}`,
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
