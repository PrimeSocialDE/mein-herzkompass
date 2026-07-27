// POST /api/admin/steuer-report
//
// Rein LESENDER Buchhaltungs-Report aus Mollie (EUR-Konto + PL/PLN-Konto).
// Kein Schreibzugriff, kein Workflow betroffen. Aggregiert je gewähltem Monat
// und Land: Brutto, Netto (ohne USt je Landessatz), USt, Refunds und Mollie-
// Gebühren, plus eine Gesamt-Summe über die gesamte Auswahl.
//
// Body: { password, months: ["YYYY-MM", ...] }   (month: "YYYY-MM" auch erlaubt)
// Auth: ADMIN_PASSWORD (wie die anderen Admin-Endpunkte).
//
// Gebühr pro Zahlung = amount - settlementAmount (Betrag, den Mollie einbehält).
// EUR-Konto -> Länder DE/AT/CH/Sonstige (EUR). PL-Konto -> PL (PLN).

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const ADMIN_PASS = process.env.ADMIN_PASSWORD || "pfoten2024";
const VAT: Record<string, number> = { DE: 19, AT: 20, CH: 0, PL: 23 };

function num(v: any): number {
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}
function resolveCountry(p: any): string {
  return (
    p?.details?.billingAddress?.country ||
    p?.countryCode ||
    p?.details?.cardCountryCode ||
    p?.details?.consumerAccount?.country ||
    ""
  )
    .toString()
    .toUpperCase();
}
function monthKey(p: any): string {
  const iso = p.paidAt || p.createdAt || "";
  return String(iso).slice(0, 7); // YYYY-MM
}

interface Bucket {
  count: number;
  brutto: number;
  refunds: number;
  fees: number;
}
const emptyBucket = (): Bucket => ({ count: 0, brutto: 0, refunds: 0, fees: 0 });
const r2 = (n: number | null) => (n == null ? null : Math.round(n * 100) / 100);

// Alle bezahlten Zahlungen eines Kontos in [start,end) holen (paginiert,
// neueste zuerst; Stopp, sobald deutlich vor Bereichsanfang).
async function fetchRange(apiKey: string, start: Date, end: Date) {
  const rows: any[] = [];
  const stopBefore = start.getTime() - 10 * 86400000;
  let url: string | null = "https://api.mollie.com/v2/payments?limit=250";
  let guard = 0;
  while (url && guard < 400) {
    guard++;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } });
    if (!res.ok) throw new Error(`Mollie ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const j: any = await res.json();
    const payments: any[] = j?._embedded?.payments || [];
    let oldestOnPage = Infinity;
    for (const p of payments) {
      const createdMs = new Date(p.createdAt).getTime();
      if (createdMs < oldestOnPage) oldestOnPage = createdMs;
      const refMs = p.paidAt ? new Date(p.paidAt).getTime() : createdMs;
      if (refMs >= start.getTime() && refMs < end.getTime()) rows.push(p);
    }
    if (oldestOnPage < stopBefore) break;
    url = j?._links?.next?.href || null;
  }
  return rows;
}

// Zahlungen (eines Kontos, eines Monats) -> Länder-Aufstellung.
function aggregate(payments: any[]) {
  const byCountry: Record<string, Bucket> = {};
  const get = (c: string) => (byCountry[c] ||= emptyBucket());
  for (const p of payments) {
    if (p.status !== "paid") continue;
    let country = resolveCountry(p);
    if (!(country in VAT)) country = "Sonstige";
    const b = get(country);
    const gross = num(p.amount?.value);
    b.count++;
    b.brutto += gross;
    if (p.settlementAmount?.value != null) b.fees += gross - num(p.settlementAmount.value);
    if (p.amountRefunded?.value != null) b.refunds += num(p.amountRefunded.value);
  }
  const rows = Object.entries(byCountry).map(([land, b]) => {
    const rate = VAT[land];
    const nettoBrutto = b.brutto - b.refunds;
    let netto: number | null = null;
    let ust: number | null = null;
    if (rate != null) {
      netto = rate === 0 ? nettoBrutto : nettoBrutto / (1 + rate / 100);
      ust = nettoBrutto - netto;
    }
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
function sumField(rows: any[], f: string): number {
  return Math.round(rows.reduce((s, r) => s + (r[f] || 0), 0) * 100) / 100;
}
function block(currency: string, payments: any[]) {
  const laender = aggregate(payments);
  return {
    currency,
    laender,
    summe: {
      anzahl: laender.reduce((s, r) => s + r.anzahl, 0),
      brutto: sumField(laender, "brutto"),
      refunds: sumField(laender, "refunds"),
      netto: sumField(laender, "netto"),
      ust: sumField(laender, "ust"),
      gebuehren: sumField(laender, "gebuehren"),
    },
  };
}

export async function POST(req: NextRequest) {
  let body: any = {};
  try {
    body = await req.json();
  } catch {}
  if (body?.password !== ADMIN_PASS) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }

  // Monate normalisieren (months[] bevorzugt, month als Fallback).
  let months: string[] = Array.isArray(body?.months)
    ? body.months
    : body?.month
      ? [body.month]
      : [];
  months = [...new Set(months.map((m) => String(m).trim()))]
    .filter((m) => /^\d{4}-\d{2}$/.test(m))
    .sort();
  if (months.length === 0) {
    return NextResponse.json(
      { error: "Bitte mindestens einen Monat (YYYY-MM) auswählen" },
      { status: 400 }
    );
  }

  // Spanne über min..max der Auswahl (einmal ziehen, dann nach Monat bucketen).
  const [minY, minM] = months[0].split("-").map(Number);
  const [maxY, maxM] = months[months.length - 1].split("-").map(Number);
  const rangeStart = new Date(Date.UTC(minY, minM - 1, 1));
  const rangeEnd = new Date(Date.UTC(maxY, maxM, 1)); // erster Tag NACH letztem Monat
  const selected = new Set(months);

  const eurKey = process.env.MOLLIE_API_KEY;
  const plKey = process.env.MOLLIE_API_KEY_PL;

  try {
    // Pro Konto einmal ziehen, dann nach Monat gruppieren.
    const groupByMonth = (payments: any[]) => {
      const map: Record<string, any[]> = {};
      for (const p of payments) {
        const k = monthKey(p);
        if (!selected.has(k)) continue;
        (map[k] ||= []).push(p);
      }
      return map;
    };

    const eurByMonth = eurKey ? groupByMonth(await fetchRange(eurKey, rangeStart, rangeEnd)) : null;
    const plByMonth = plKey ? groupByMonth(await fetchRange(plKey, rangeStart, rangeEnd)) : null;

    const monthsOut = months.map((m) => ({
      month: m,
      eur: eurByMonth ? block("EUR", eurByMonth[m] || []) : { error: "MOLLIE_API_KEY fehlt" },
      pln: plByMonth ? block("PLN", plByMonth[m] || []) : { error: "MOLLIE_API_KEY_PL fehlt" },
    }));

    // Gesamt über die Auswahl (je Währung).
    const gesamt = (cur: "eur" | "pln") => {
      const blocks = monthsOut.map((mo: any) => mo[cur]).filter((b: any) => b && !b.error);
      const add = (f: string) => Math.round(blocks.reduce((s: number, b: any) => s + (b.summe[f] || 0), 0) * 100) / 100;
      return {
        anzahl: blocks.reduce((s: number, b: any) => s + b.summe.anzahl, 0),
        brutto: add("brutto"),
        refunds: add("refunds"),
        netto: add("netto"),
        ust: add("ust"),
        gebuehren: add("gebuehren"),
      };
    };

    return NextResponse.json({
      months: monthsOut,
      gesamt: { eur: gesamt("eur"), pln: gesamt("pln") },
      auswahl: months,
      generated_at: new Date().toISOString(),
    });
  } catch (e: any) {
    console.error("[steuer-report]", e?.message);
    return NextResponse.json({ error: e?.message || "Report fehlgeschlagen" }, { status: 500 });
  }
}
