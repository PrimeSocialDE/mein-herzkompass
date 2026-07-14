// /api/themenplan/generate — liefert einen gekauften Themen-Plan (aus den
// Marketing-Funnels) per E-Mail aus. Wird vom Mollie-Webhook nach Zahlung
// aufgerufen (module = "{thema}-plan" | "{thema}-plan-bild").
//
//   Text-Tier  ("{thema}-plan")      -> generate-zusatzmodul-pdf.mjs (Modul-Format, Querformat)
//   Bild-Tier  ("{thema}-plan-bild") -> generate-themenplan-illustriert.mjs (illustriert)
//
// Idempotenz: pro (Lead, module) ein Sent-Marker in answers -> keine Doppel-Mail.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// theme -> Text-Modul-Key (generate-zusatzmodul-pdf.mjs)
const TEXT_MODULE_KEY: Record<string, string> = {
  bellen: "barking",
  leinen: "pulling",
  energie: "energy",
  aggression: "aggression",
  rueckruf: "recall",
};
// Themen mit illustriertem Bild-Tier
const ILLUSTRATED_THEMES = new Set(["bellen", "leinen", "energie"]);

const THEME_LABEL: Record<string, string> = {
  bellen: "Bellen-Plan",
  leinen: "Leinen-Plan",
  energie: "Energie-Plan",
  aggression: "Aggressions-Plan",
  rueckruf: "Rückruf-Plan",
};

function parseModule(module: string): { theme: string; illustrated: boolean } | null {
  const m = /^([a-z]+)-plan(-bild)?$/.exec(String(module || "").trim());
  if (!m) return null;
  const theme = m[1];
  if (!TEXT_MODULE_KEY[theme]) return null;
  return { theme, illustrated: !!m[2] && ILLUSTRATED_THEMES.has(theme) };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const module = String(body.module || "").trim();
    const emailIn = (body.email || "").trim().toLowerCase();
    const leadId = body.leadId as string | undefined;
    const force = !!body.force;
    let dogName = (body.dogName || "").trim();
    let dogBreed = (body.dogBreed || "").trim();

    const parsed = parseModule(module);
    if (!parsed) {
      return NextResponse.json({ error: `module ungültig: "${module}"` }, { status: 400 });
    }
    const { theme, illustrated } = parsed;

    if (!process.env.BREVO_API_KEY) {
      return NextResponse.json({ error: "BREVO_API_KEY fehlt" }, { status: 500 });
    }

    // Lead laden (für Rasse/Name + Idempotenz-Marker). Service-Role.
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    let lead: any = null;
    if (leadId) {
      const { data } = await supabase.from("wauwerk_leads").select("id,email,dog_name,answers").eq("id", leadId).maybeSingle();
      lead = data;
    }
    if (!lead && emailIn) {
      const { data } = await supabase
        .from("wauwerk_leads").select("id,email,dog_name,answers")
        .ilike("email", emailIn).order("paid_at", { ascending: false }).limit(1).maybeSingle();
      lead = data;
    }
    const ans = (lead?.answers as Record<string, any>) || {};
    const email = emailIn || (lead?.email || "").toLowerCase();
    if (!email) return NextResponse.json({ error: "keine E-Mail" }, { status: 400 });
    if (!dogName) dogName = (lead?.dog_name || ans.dog_name || "dein Hund").trim();
    if (!dogBreed) dogBreed = (ans.dog_breed || "Mischling").trim();

    // Idempotenz-Claim (wie hund-verstehen): Marker nur setzen, wenn noch null.
    const sentKey = `themenplan_${module.replace(/[^a-z0-9]/gi, "_")}_sent_at`;
    if (lead && !force) {
      if (ans[sentKey]) {
        return NextResponse.json({ ok: true, skipped: true, reason: "already_sent", module, email });
      }
      const { data: claimed } = await supabase
        .from("wauwerk_leads")
        .update({ answers: { ...ans, [sentKey]: new Date().toISOString() } })
        .eq("id", lead.id)
        .is(`answers->>${sentKey}`, null)
        .select("id");
      if (!claimed || claimed.length === 0) {
        return NextResponse.json({ ok: true, skipped: true, reason: "claim_lost", module, email });
      }
    }

    // PDF bauen: Bild-Tier -> illustriert, sonst Text-Modul-Format.
    let pdfBytes: Uint8Array;
    if (illustrated) {
      const { buildPdf } = await import("@/generate-themenplan-illustriert.mjs");
      pdfBytes = await buildPdf({ theme, dogName, dogBreed });
    } else {
      const { buildPdf } = await import("@/generate-zusatzmodul-pdf.mjs");
      pdfBytes = await buildPdf({ dogName, dogBreed, moduleKey: TEXT_MODULE_KEY[theme], verbose: false });
    }
    const pdfBase64 = Buffer.from(pdfBytes).toString("base64");

    const label = THEME_LABEL[theme];
    const safeDog = dogName.replace(/[^a-zA-Z0-9-]/g, "") || "Hund";
    const filename = `Pfoten-Plan-${label.replace(/[^a-zA-Z0-9-]/g, "-")}-${safeDog}.pdf`;
    const subject = `${dogName}s ${label} ist da 🐾`;
    const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#1a1a1a;line-height:1.6">
      <p>Hallo,</p>
      <p>${dogName}s <b>${label}</b> ist fertig — du findest ihn <b>als PDF im Anhang</b> dieser Mail.</p>
      <p>Arbeite die Übungen einfach Schritt für Schritt in eurem Tempo durch. Es gibt nichts einzutragen — folg dem Plan Woche für Woche.</p>
      <p>Fragen? Antworte einfach auf diese Mail, wir sind für dich da.</p>
      <p>Viel Freude mit ${dogName}!<br>Dein Pfoten-Plan-Team</p>
    </div>`;

    const brevoRes = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": process.env.BREVO_API_KEY!, "Content-Type": "application/json" },
      body: JSON.stringify({
        sender: { name: "Max von Pfoten-Plan", email: "support@pfoten-plan.de" },
        replyTo: { email: "support@pfoten-plan.de", name: "Pfoten-Plan Support" },
        to: [{ email }],
        cc: [{ email: "kontakt@primesocial.de" }],
        subject,
        htmlContent: html,
        attachment: [{ name: filename, content: pdfBase64 }],
        tags: [`themenplan-${module}`, "auto-trigger"],
      }),
    });

    if (!brevoRes.ok) {
      const txt = await brevoRes.text();
      // Marker zuruecksetzen, damit ein Retry moeglich bleibt (best-effort).
      if (lead && !force) {
        try {
          const cur = { ...(ans || {}) };
          delete cur[sentKey];
          await supabase.from("wauwerk_leads").update({ answers: cur }).eq("id", lead.id);
        } catch {}
      }
      return NextResponse.json({ error: `Brevo ${brevoRes.status}: ${txt.slice(0, 200)}` }, { status: 502 });
    }
    const data = await brevoRes.json().catch(() => ({}));
    return NextResponse.json({ ok: true, module, theme, illustrated, email, brevoMessageId: (data as any).messageId || null });
  } catch (e: any) {
    console.error("[themenplan/generate] error:", e?.message);
    return NextResponse.json({ error: e?.message || "generate failed" }, { status: 500 });
  }
}
