// Löst einen Coupon-Code ein.
// User wählt im Modul-Shop ein Modul aus → POST hierhin → wenn Code gültig
// und noch offen, markieren wir ihn als "redeemed" und triggern die
// Auslieferung (analog zu einem normalen Modul-Kauf).

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import { isValidRedeemCode } from "@/lib/referral";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Liste der einlösbaren Module (gleiche Keys wie im Modul-Shop)
const ALLOWED_MODULES = [
  "anxiety",
  "pulling",
  "barking",
  "aggression",
  "recall",
  "jumping",
  "energy",
  "destructive",
  "mouthing",
];

export async function POST(req: NextRequest) {
  try {
    const { code, module, email, dogName, leadId } = await req.json();

    if (!isValidRedeemCode(code)) {
      return NextResponse.json(
        { ok: false, error: "Code-Format ungültig" },
        { status: 400 }
      );
    }
    if (!module || !ALLOWED_MODULES.includes(module)) {
      return NextResponse.json(
        { ok: false, error: "Modul ungültig" },
        { status: 400 }
      );
    }
    if (!email) {
      return NextResponse.json(
        { ok: false, error: "Email fehlt" },
        { status: 400 }
      );
    }

    // Reward holen
    const { data: reward, error: fetchErr } = await supabase
      .from("referral_rewards")
      .select("*")
      .eq("redeem_code", code)
      .single();

    if (fetchErr || !reward) {
      return NextResponse.json(
        { ok: false, error: "Code nicht gefunden" },
        { status: 404 }
      );
    }
    if (reward.status === "redeemed") {
      return NextResponse.json(
        {
          ok: false,
          error: `Code wurde bereits eingelöst (Modul: ${reward.redeemed_module})`,
        },
        { status: 409 }
      );
    }
    if (reward.status === "expired") {
      return NextResponse.json(
        { ok: false, error: "Code ist abgelaufen" },
        { status: 410 }
      );
    }

    // Atomic-Update: nur erfolgreich wenn Status noch 'pending'
    const { data: updated, error: updateErr } = await supabase
      .from("referral_rewards")
      .update({
        status: "redeemed",
        redeemed_module: module,
        redeemed_at: new Date().toISOString(),
      })
      .eq("redeem_code", code)
      .eq("status", "pending")
      .select()
      .single();

    if (updateErr || !updated) {
      return NextResponse.json(
        { ok: false, error: "Code konnte nicht eingelöst werden" },
        { status: 409 }
      );
    }

    // Modul beim Lead vermerken (wenn leadId mitgegeben — ansonsten via email-lookup)
    let targetLeadId = leadId;
    if (!targetLeadId && email) {
      const { data: lead } = await supabase
        .from("wauwerk_leads")
        .select("id")
        .eq("email", email)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      if (lead) targetLeadId = lead.id;
    }
    if (targetLeadId) {
      const { data: lead } = await supabase
        .from("wauwerk_leads")
        .select("upsell_modules")
        .eq("id", targetLeadId)
        .single();
      let existing: string[] = [];
      if (Array.isArray(lead?.upsell_modules)) existing = lead!.upsell_modules;
      else if (typeof lead?.upsell_modules === "string")
        existing = lead!.upsell_modules.split(",").filter(Boolean);
      const newModules = [...new Set([...existing, module])];
      await supabase
        .from("wauwerk_leads")
        .update({
          upsell_modules: newModules,
          upsell_paid_at:
            (lead as any)?.upsell_paid_at || new Date().toISOString(),
        })
        .eq("id", targetLeadId);
    }

    // Make.com benachrichtigen — übernimmt PDF-Generation + E-Mail-Versand
    const makeUrl = process.env.MAKE_WEBHOOK_URL;
    if (makeUrl) {
      try {
        await fetch(makeUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            source: "referral.redeem",
            type: "referral_free_module",
            module,
            email,
            dog_name: dogName || "",
            lead_id: targetLeadId || null,
            redeem_code: code,
            referrer_email: reward.referrer_email,
          }),
        });
      } catch (e) {
        console.error("[referral-redeem] Make-Webhook Fehler:", e);
      }
    }

    return NextResponse.json({
      ok: true,
      message: `Modul "${module}" wurde freigeschaltet — kommt per E-Mail.`,
    });
  } catch (err: any) {
    console.error("Referral-Redeem Error:", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Server-Fehler" },
      { status: 500 }
    );
  }
}
