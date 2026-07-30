// GET /api/cron/warmup-send?secret=pfoten-cron-2024[&cap=250&dry=1]
//
// Taeglicher Warmup-/Value-Versand an DE email_captured-Gmail-Leads, themen-
// basiert im ue50-Ton. Laeuft 05:00 UTC = 07:00 lokal (kurz vor dem Open-Peak).
//
// SICHERHEIT: zieht vorher die SES-Reputation (GetSendStatistics) und BRICHT AB,
// wenn Bounce >2% oder Beschwerden >0,1% (letzte 3 Tage). Idempotent via
// answers.warmup_sent_at. Nur Gmail, nicht abgemeldet, DE. DE-Funnel unberuehrt.

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createMemberAdminClient } from "@/lib/member-auth-server";
import { sendViaSes } from "@/lib/ses";
import {
  WARMUP_THEME_MAP,
  warmupSubject,
  buildWarmupHtml,
} from "@/lib/warmup-value-mails";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const CRON_SECRET = process.env.CRON_SECRET || "pfoten-cron-2024";

// Tages-Ramp (getUTCDay: 0=So .. 6=Sa). Sonntag = Gehaltstag = groesster Batch.
const RAMP: Record<number, number> = { 0: 1800, 1: 150, 2: 300, 3: 500, 4: 700, 5: 900, 6: 1100 };

// ── SES-Reputation (GetSendStatistics, SigV4) ──────────────────────────────
async function sesReputation(): Promise<{ attempts: number; bounces: number; complaints: number } | null> {
  const AK = process.env.AWS_ACCESS_KEY_ID, SK = process.env.AWS_SECRET_ACCESS_KEY;
  const RG = process.env.AWS_REGION || "eu-central-1", HOST = `email.${RG}.amazonaws.com`;
  if (!AK || !SK) return null;
  const hmac = (k: crypto.BinaryLike, d: string) => crypto.createHmac("sha256", k).update(d).digest();
  const sha = (d: string) => crypto.createHash("sha256").update(d).digest("hex");
  const body = new URLSearchParams({ Action: "GetSendStatistics", Version: "2010-12-01" }).toString();
  const amz = new Date().toISOString().replace(/[:-]|\.\d{3}/g, ""); const ds = amz.slice(0, 8);
  const ch = `content-type:application/x-www-form-urlencoded\nhost:${HOST}\nx-amz-date:${amz}\n`, sh = "content-type;host;x-amz-date";
  const creq = ["POST", "/", "", ch, sh, sha(body)].join("\n");
  const scope = `${ds}/${RG}/ses/aws4_request`;
  const sts = ["AWS4-HMAC-SHA256", amz, scope, sha(creq)].join("\n");
  let k = hmac("AWS4" + SK, ds); k = hmac(k, RG); k = hmac(k, "ses"); k = hmac(k, "aws4_request");
  const sig = crypto.createHmac("sha256", k).update(sts).digest("hex");
  const auth = `AWS4-HMAC-SHA256 Credential=${AK}/${scope}, SignedHeaders=${sh}, Signature=${sig}`;
  const r = await fetch(`https://${HOST}/`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "X-Amz-Date": amz, Authorization: auth }, body });
  if (r.status !== 200) return null;
  const xml = await r.text();
  const cut = Date.now() - 3 * 86400000;
  let attempts = 0, bounces = 0, complaints = 0;
  for (const m of xml.matchAll(/<member>([\s\S]*?)<\/member>/g)) {
    const g = (t: string) => +(((m[1].match(new RegExp(`<${t}>(.*?)</${t}>`)) || [])[1]) || "0");
    const ts = ((m[1].match(/<Timestamp>(.*?)<\/Timestamp>/) || [])[1]) || "";
    if (new Date(ts).getTime() >= cut) { attempts += g("DeliveryAttempts"); bounces += g("Bounces"); complaints += g("Complaints"); }
  }
  return { attempts, bounces, complaints };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get("secret") !== CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const dry = searchParams.get("dry") === "1";
  const capOverride = parseInt(searchParams.get("cap") || "", 10);
  const cap = Number.isFinite(capOverride) && capOverride > 0 ? capOverride : (RAMP[new Date().getUTCDay()] || 150);

  // ── Reputations-Guard ──
  const rep = await sesReputation();
  if (rep && rep.attempts > 50) {
    const bR = rep.bounces / rep.attempts, cR = rep.complaints / rep.attempts;
    if (bR > 0.02 || cR > 0.001) {
      return NextResponse.json({
        ok: false, aborted: true, reason: "reputation_guard",
        bounce_rate: +(bR * 100).toFixed(2), complaint_rate: +(cR * 100).toFixed(3), rep,
      });
    }
  }

  const admin = createMemberAdminClient();

  // ── Frische Gmail-Leads holen, nach Thema, idempotent ──
  const eligible: Array<{ id: string; email: string; dog: string; theme: string; ans: any }> = [];
  let from = 0; const P = 1000;
  while (eligible.length < cap && from < 20000) {
    const { data, error } = await admin
      .from("wauwerk_leads")
      .select("id,email,dog_name,answers")
      .eq("status", "email_captured")
      .or("email.ilike.%@gmail.com,email.ilike.%@googlemail.com")
      .order("created_at", { ascending: false })
      .range(from, from + P - 1);
    if (error || !data || !data.length) break;
    for (const r of data) {
      const a = (r.answers || {}) as any;
      // STRIKT DE: nur deutsche Leads. PL/IT (und jede andere Sprache) laufen
      // ueber ihre eigene Nurture — hier alle Nicht-DE ausschliessen, sonst
      // bekommen sie die deutsche Warmup-Value-Mail.
      if (a.unsubscribed || (a.lang && String(a.lang).toLowerCase() !== "de") || a.energie_kampagne_sent_at || a.warmup_sent_at) continue;
      const theme = WARMUP_THEME_MAP[(a.dog_problem || "").trim()];
      if (!theme) continue;
      if (!r.email || !r.email.includes("@")) continue;
      eligible.push({ id: r.id, email: r.email.trim(), dog: (r.dog_name || "").trim() || "deinem Hund", theme, ans: a });
      if (eligible.length >= cap) break;
    }
    if (data.length < P) break;
    from += P;
  }

  const byTheme: Record<string, number> = {};
  eligible.forEach((e) => (byTheme[e.theme] = (byTheme[e.theme] || 0) + 1));

  if (dry) {
    return NextResponse.json({ ok: true, dry: true, cap, would_send: eligible.length, byTheme, rep });
  }

  // ── Versand mit Concurrency (fit in 300s) ──
  let sent = 0, failed = 0;
  const CONC = 8;
  for (let i = 0; i < eligible.length; i += CONC) {
    const chunk = eligible.slice(i, i + CONC);
    await Promise.all(chunk.map(async (r) => {
      const res = await sendViaSes({
        to: r.email,
        subject: warmupSubject(r.theme, r.dog),
        html: buildWarmupHtml(r.theme, r.dog, r.id, r.email),
        fromName: "Max von Pfoten-Plan",
        fromEmail: "hallo@pfoten-post.de",
        replyTo: "support@pfoten-plan.de",
        unsubscribeUrl: `https://www.pfoten-plan.de/api/unsubscribe?lead=${r.id}`,
        tags: ["warmup-" + r.theme],
        configurationSet: "pfoten-tracking",
      });
      if (res.ok) {
        sent++;
        try {
          await admin.from("wauwerk_leads")
            .update({ answers: { ...r.ans, warmup_sent_at: new Date().toISOString(), warmup_theme: r.theme } })
            .eq("id", r.id);
        } catch {}
      } else {
        failed++;
      }
    }));
  }

  return NextResponse.json({ ok: true, cap, sent, failed, byTheme, rep });
}
