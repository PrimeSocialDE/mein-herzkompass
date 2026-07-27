// POST /api/admin/steuer-report
//
// Rein LESENDER Buchhaltungs-Report aus Mollie (EUR-Konto + PL/PLN-Konto).
// Kein Schreibzugriff, kein Workflow betroffen. Aggregiert pro Monat und Land:
// Brutto, Netto (ohne USt je Landessatz), USt, Refunds und Mollie-Gebühren.
//
// Body: { password, month }  // month = "YYYY-MM"
// Auth: ADMIN_PASSWORD (wie die anderen Admin-Endpunkte).
//
// Gebühr pro Zahlung = amount - settlementAmount (Betrag, der Mollie einbehält).
// EUR-Konto -> Länder DE/AT/CH/Sonstige (alles in EUR).
// PL-Konto  -> PL (in PLN).

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const ADMIN_PASS = process.env.ADMIN_PASSWORD || "pfoten2024";

// USt-Sätze je Land. CH = Nicht-EU-Export -> 0% EU-USt.
const VAT: Record<string, number> = { DE: 19, AT: 20, CH: 0, PL: 23 };

function num(v: any): number {
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}

function resolveCountry(p: any): string {
  const c = (
    p?.details?.billingAddress?.country ||
    p?.countryCode ||
    p?.details?.cardCountryCode ||
    p?.details?.consumerAccount?.country ||
    ""
  )
    .toString()
    .toUpperCase();
  return c;
}

interface Bucket {
  count: number;
  brutto: number;
  refunds: number;
  fees: number;
}
const emptyBucket = (): Bucket => ({ count: 0, brutto: 0, refunds: 0, fees: 0 });

// Alle bezahlten Zahlungen eines Mollie-Kontos im Monat holen (paginiert,
// neueste zuerst; Stopp, sobald deutlich vor Monatsanfang).
async function fetchMonth(apiKey: string, monthStart: Date, monthEnd: Date) {
  const rows: any[] = [];
  const stopBefore = monthStart.getTime() - 10 * 86400000; // 10 Tage Puffer
  let url: string | null = "https://api.mollie.com/v2/payments?limit=250";
  let guard = 0;
  while (url && guard < 200) {
    guard++;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) {
      throw new Error(`Mollie ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
    const j: any = await res.json();
    const payments: any[] = j?._embedded?.payments || [];
    let oldestOnPage = Infinity;
    for (const p of payments) {
      const createdMs = new Date(p.createdAt).getTime();
      if (createdMs < oldestOnPage) oldestOnPage = createdMs;
      // Zeitbasis: paidAt (Umsatz zählt bei Zahlung). Fallback createdAt.
      const paidMs = p.paidAt ? new Date(p.paidAt).getTime() : null;
      const refMs = paidMs ?? createdMs;
      if (refMs >= monthStart.getTime() && refMs < monthEnd.getTime()) {
        rows.push(p);
      }
    }
    if (oldestOnPage < stopBefore) break; // alles Weitere ist älter
    url = j?._links?.next?.href || null;
  }
  return rows;
}

function aggregate(payments: any[]) {
  const byCountry: Record<string, Bucket> = {};
  const get = (c: string) => (byCountry[c] ||= emptyBucket());

  for (const p of payments) {
    const status = p.status;
    // Nur echte Einnahmen: paid. (Refunds werden über amountRefunded erfasst.)
    if (status !== "paid") continue;
    let country = resolveCountry(p);
    if (!(country in VAT)) country = "Sonstige";
    const b = get(country);
    const gross = num(p.amount?.value);
    b.count++;
    b.brutto += gross;
    // Gebühr = Brutto minus Settlement-Betrag (was Mollie einbehält).
    if (p.settlementAmount?.value != null) {
      b.fees += gross - num(p.settlementAmount.value);
    }
    if (p.amountRefunded?.value != null) {
      b.refunds += num(p.amountRefunded.value);
    }
  }

  // Netto/USt je Land berechnen.
  const rows = Object.entries(byCountry).map(([land, b]) => {
    const rate = VAT[land]; // Sonstige -> undefined
    const nettoBrutto = b.brutto - b.refunds; // Netto-Umsatz nach Refunds
    let netto: number | null = null;
    let ust: number | null = null;
    if (rate != null) {
      netto = rate === 0 ? nettoBrutto : nettoBrutto / (1 + rate / 100);
      ust = nettoBrutto - netto;
    }
    const r2 = (n: number | null) => (n == null ? null : Math.round(n * 100) / 100);
    return {
      land,
      ust_satz: rate ?? null,
      anzahl: b.count,
      brutto: r2(b.brutto),
      refunds: r2(b.refunds),
      brutto_nach_refund: r2(nettoBrutto),
      netto: r2(netto),
      ust: r2(ust),
      gebuehren: r2(b.fees),
    };
  });
  rows.sort((a, b) => (b.brutto || 0) - (a.brutto || 0));
  return rows;
}

export async function POST(req: NextRequest) {
  let body: any = {};
  try {
    body = await req.json();
  } catch {}
  if (body?.password !== ADMIN_PASS) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }

  const month: string = String(body?.month || "").trim();
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json(
      { error: "month im Format YYYY-MM erforderlich" },
      { status: 400 }
    );
  }
  const [y, m] = month.split("-").map(Number);
  const monthStart = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
  const monthEnd = new Date(Date.UTC(y, m, 1, 0, 0, 0));

  const eurKey = process.env.MOLLIE_API_KEY;
  const plKey = process.env.MOLLIE_API_KEY_PL;

  try {
    const out: any = { month, generated_at: new Date().toISOString() };

    // EUR-Konto (DE/AT/CH/Sonstige)
    if (eurKey) {
      const pay = await fetchMonth(eurKey, monthStart, monthEnd);
      const rows = aggregate(pay);
      out.eur = {
        currency: "EUR",
        laender: rows,
        summe: {
          anzahl: rows.reduce((s, r) => s + r.anzahl, 0),
          brutto: r2sum(rows, "brutto"),
          refunds: r2sum(rows, "refunds"),
          netto: r2sum(rows, "netto"),
          ust: r2sum(rows, "ust"),
          gebuehren: r2sum(rows, "gebuehren"),
        },
      };
    } else {
      out.eur = { error: "MOLLIE_API_KEY fehlt" };
    }

    // PL-Konto (PLN)
    if (plKey) {
      const pay = await fetchMonth(plKey, monthStart, monthEnd);
      const rows = aggregate(pay);
      out.pln = {
        currency: "PLN",
        laender: rows,
        summe: {
          anzahl: rows.reduce((s, r) => s + r.anzahl, 0),
          brutto: r2sum(rows, "brutto"),
          refunds: r2sum(rows, "refunds"),
          netto: r2sum(rows, "netto"),
          ust: r2sum(rows, "ust"),
          gebuehren: r2sum(rows, "gebuehren"),
        },
      };
    } else {
      out.pln = { error: "MOLLIE_API_KEY_PL fehlt" };
    }

    return NextResponse.json(out);
  } catch (e: any) {
    console.error("[steuer-report]", e?.message);
    return NextResponse.json(
      { error: e?.message || "Report fehlgeschlagen" },
      { status: 500 }
    );
  }
}

function r2sum(rows: any[], field: string): number {
  const s = rows.reduce((acc, r) => acc + (r[field] || 0), 0);
  return Math.round(s * 100) / 100;
}
