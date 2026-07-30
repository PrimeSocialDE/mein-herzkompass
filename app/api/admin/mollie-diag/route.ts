// GET /api/admin/mollie-diag?secret=pfoten-cron-2024[&acct=pl]
//
// Read-only Diagnose fuer das Mollie-Konto (Default PL). Zeigt:
//  - Freischalt-Status je Methode (methods.get -> status: activated /
//    pending-review / pending-boarding / rejected ...)
//  - letzte Zahlungen mit Status + Methode (fuer "verfallen"-Analyse)
// Kein Schreibzugriff. Secret-gated.

import { NextRequest, NextResponse } from "next/server";
import { getMollie, getMolliePL, getMollieIT } from "@/lib/mollie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CRON_SECRET = process.env.CRON_SECRET || "pfoten-cron-2024";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get("secret") !== CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const acct = (searchParams.get("acct") || "pl").toLowerCase();
  const mollie =
    acct === "pl" ? getMolliePL() : acct === "it" ? getMollieIT() : getMollie();
  if (!mollie) return NextResponse.json({ error: "no_key", acct }, { status: 500 });

  const out: any = { acct };

  // Profile des Kontos listen (?action=profiles) — um zu pruefen, ob eine
  // Public-Profile-ID (Components/cardToken) wirklich zu diesem Key/Konto gehoert.
  if (searchParams.get("action") === "profiles") {
    try {
      const list: any = await (mollie as any).profiles.page();
      const arr = Array.isArray(list) ? list : list?.[Symbol.iterator] ? [...list] : [];
      return NextResponse.json({
        acct,
        profiles: arr.map((p: any) => ({
          id: p.id, name: p.name, website: p.website, mode: p.mode, status: p.status,
        })),
      });
    } catch (e: any) {
      return NextResponse.json({ error: e?.message });
    }
  }

  // Detail-Dump einer bestimmten Zahlung (?payment=tr_xxx)
  const payId = searchParams.get("payment");
  if (payId) {
    try {
      const p: any = await mollie.payments.get(payId);
      return NextResponse.json({ payment: p });
    } catch (e: any) {
      return NextResponse.json({ error: e?.message });
    }
  }

  // Test-P24-Zahlung anlegen + Checkout-URL zurueckgeben (?action=testp24)
  if (searchParams.get("action") === "testp24") {
    try {
      const p: any = await mollie.payments.create({
        amount: { currency: "PLN", value: "1.00" },
        description: "DIAG TEST P24 (laeuft ab, nicht bezahlen)",
        redirectUrl: "https://www.lapaplan.pl/plan",
        method: "przelewy24" as any,
        billingEmail: "diag@lapaplan.pl",
        locale: "pl_PL" as any,
      } as any);
      return NextResponse.json({
        id: p.id,
        status: p.status,
        method: p.method,
        checkoutUrl: p._links?.checkout?.href || null,
        full: p,
      });
    } catch (e: any) {
      return NextResponse.json({ error: e?.message, field: e?.field });
    }
  }

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
