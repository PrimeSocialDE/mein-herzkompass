// Validiert einen Coupon-Code (GRATIS-XXXX-XXXX) ohne ihn einzulösen.
// Wird vom Modul-Shop-Frontend genutzt: User trägt Code ein → wir zeigen
// "✓ Code gültig — wähle dein Modul" oder "✗ Code ungültig/eingelöst".

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import { isValidRedeemCode } from "@/lib/referral";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { code } = await req.json();
    if (!isValidRedeemCode(code)) {
      return NextResponse.json(
        { valid: false, reason: "format" },
        { status: 200 }
      );
    }

    const { data, error } = await supabase
      .from("referral_rewards")
      .select("id, status, referrer_email, redeemed_module")
      .eq("redeem_code", code)
      .single();

    if (error || !data) {
      return NextResponse.json({ valid: false, reason: "not_found" });
    }
    if (data.status === "redeemed") {
      return NextResponse.json({
        valid: false,
        reason: "already_redeemed",
        module: data.redeemed_module,
      });
    }
    if (data.status === "expired") {
      return NextResponse.json({ valid: false, reason: "expired" });
    }

    return NextResponse.json({
      valid: true,
      referrerEmail: data.referrer_email,
    });
  } catch (err: any) {
    return NextResponse.json(
      { valid: false, reason: "error", error: err?.message },
      { status: 500 }
    );
  }
}
