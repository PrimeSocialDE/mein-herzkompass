// GET /api/admin/mollie-diag?secret=pfoten-cron-2024[&acct=pl]
//
// Read-only Diagnose fuer das Mollie-Konto (Default PL). Zeigt:
//  - Freischalt-Status je Methode (methods.get -> status: activated /
//    pending-review / pending-boarding / rejected ...)
//  - letzte Zahlungen mit Status + Methode (fuer "verfallen"-Analyse)
// Kein Schreibzugriff. Secret-gated.

import { NextRequest, NextResponse } from "next/server";
import { getMollie, getMolliePL } from "@/lib/mollie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CRON_SECRET = process.env.CRON_SECRET || "pfoten-cron-2024";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get("secret") !== CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const acct = (searchParams.get("acct") || "pl").toLowerCase();
  const mollie = acct === "pl" ? getMolliePL() : getMollie();
  if (!mollie) return NextResponse.json({ error: "no_key", acct }, { status: 500 });

  const out: any = { acct };

  // 1. Status einzelner Methoden (przelewy24 im Fokus)
  out.methodStatus = {};
  for (const id of ["przelewy24", "blik", "creditcard", "paypal"]) {
    try {
      const m: any = await mollie.methods.get(id);
      out.methodStatus[id] = { status: m.status ?? "(kein status-Feld)", description: m.description };
    } catch (e: any) {
      out.methodStatus[id] = { error: e?.message };
    }
  }

  // 2. Verfuegbare (aktive) Methoden laut Mollie
  try {
    const list: any = await mollie.methods.list();
    out.enabledMethods = [];
    for (const m of list) out.enabledMethods.push(m.id);
  } catch (e: any) {
    out.enabledMethods_error = e?.message;
  }

  // 3. Letzte Zahlungen (Status + Methode) + Zusammenfassung
  try {
    const page: any = await mollie.payments.page({ limit: 50 });
    out.payments = [];
    for (const p of page) {
      out.payments.push({
        id: p.id,
        status: p.status,
        method: p.method,
        amount: p.amount,
        createdAt: p.createdAt,
        expiredAt: p.expiredAt || p.expiresAt || null,
      });
    }
    const byMethodStatus: Record<string, Record<string, number>> = {};
    for (const p of out.payments) {
      const m = p.method || "(none)";
      byMethodStatus[m] = byMethodStatus[m] || {};
      byMethodStatus[m][p.status] = (byMethodStatus[m][p.status] || 0) + 1;
    }
    out.summary = byMethodStatus;
  } catch (e: any) {
    out.payments_error = e?.message;
  }

  return NextResponse.json(out);
}
