// Prüft einen persönlichen Danke-Code (z. B. MATTES30-3F9AK7) für den Modul-Shop.
// Antwort: { valid, prozent, bis, dogName } oder { valid:false, reason }.
// Der eigentliche Rabatt wird im Checkout serverseitig noch einmal geprüft.

import { NextRequest, NextResponse } from "next/server";
import { checkDankeCode } from "@/lib/danke-code";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { code } = await req.json();
    const r = await checkDankeCode(code);
    if (!r.ok) return NextResponse.json({ valid: false, reason: r.reason });
    return NextResponse.json({ valid: true, code: r.code, prozent: r.prozent, bis: r.bis, dogName: r.dogName });
  } catch {
    return NextResponse.json({ valid: false, reason: "error" }, { status: 500 });
  }
}
