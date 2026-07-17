// Beleg-Helfer: Aussteller-Angaben, Leistungsbeschreibung, E-Mail-Footer.
// Die eigentliche Belegnummern-Vergabe passiert atomar in der Supabase-Funktion
// create_beleg() (SQL). Hier nur Darstellung + Beschreibung.

export const BELEG_SELLER = {
  name: "Debkowski & Moritz GbR",
  street: "Rosenbohmsweg 28a",
  city: "26135 Oldenburg",
  ustId: "DE353303833",
};

const PLAN_LABEL: Record<string, string> = {
  "1month": "Personalisierter Hundetrainingsplan (1 Monat)",
  "3month": "Personalisierter Hundetrainingsplan (3 Monate)",
  "6month": "Personalisierter Hundetrainingsplan (6 Monate)",
};

/** Leistungsbeschreibung aus den Mollie-Metadaten ableiten. */
export function belegDescription(meta: Record<string, any> = {}): string {
  if (meta.plan && PLAN_LABEL[meta.plan]) return PLAN_LABEL[meta.plan];
  if (meta.module) {
    return `Zusatzleistung: ${String(meta.module).replace(/\+/g, " + ")}`;
  }
  if (meta.type === "premium") return "Premium-Verhaltensanalyse";
  return "Pfoten-Plan – digitale Trainingsleistung";
}

function eur(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",") + " €";
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
}

export interface BelegRow {
  belegnummer: string;
  beschreibung: string;
  brutto_cents: number;
  ust_cents: number;
  netto_cents: number;
  ust_satz: number;
  leistungsdatum: string;
}

/** HTML-Footer für die Plan-Mail (Kleinbetragsrechnung §33 UStDV). */
export function renderBelegFooterHtml(b: BelegRow): string {
  const s = BELEG_SELLER;
  return `
<div style="border-top:1px solid #E8E4DF; margin:28px 0 0; padding-top:16px; font-family:Arial,Helvetica,sans-serif; font-size:12px; line-height:1.65; color:#6B6B6B;">
  <div style="font-weight:700; color:#1a1a1a; font-size:13px; margin-bottom:5px;">Beleg &middot; Nr. ${b.belegnummer}</div>
  <div>Datum: ${fmtDate(b.leistungsdatum)}</div>
  <div>Leistung: ${b.beschreibung}</div>
  <div style="margin-top:7px; color:#1a1a1a;"><b>Gesamt: ${eur(b.brutto_cents)}</b> &mdash; inkl. ${b.ust_satz}% USt (${eur(b.ust_cents)}) &middot; netto ${eur(b.netto_cents)}</div>
  <div style="margin-top:9px; color:#9CA3AF;">Aussteller: ${s.name} &middot; ${s.street} &middot; ${s.city} &middot; USt-IdNr. ${s.ustId}</div>
</div>`;
}
