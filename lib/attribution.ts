// Attribution-Helper: liest die First-Touch-utm aus einem Lead-Record
// (wauwerk_leads.answers) und liefert sie als metadata-Felder fuer Mollie.
//
// Hintergrund: wauwerk-checkout persistiert die First-Touch-Herkunft set-once
// in answers (utm_source/medium/campaign/content/term, fbclid, fbp). Damit JEDE
// Folge-Zahlung (Upsells/One-Click) dieselbe Herkunft in die Mollie-metadata
// schreibt, lesen die Upsell-Routen sie hier aus dem Lead — durabel auch wenn
// das pp_attr-Cookie laengst weg ist (Safari ITP kappt JS-Cookies nach 7 Tagen).

const UTM_MAX: Record<string, number> = {
  utm_source: 30,
  utm_medium: 30,
  utm_campaign: 200,
  utm_content: 200,
  utm_term: 200,
  fbclid: 60,
  fbp: 50,
};

// Reihenfolge zum Droppen, falls das metadata-Byte-Budget eng wird. Die
// join-kritischen Felder (utm_content = Anzeigenname, utm_campaign, utm_source)
// bleiben immer; zuerst fliegt das Unwichtigste raus.
const DROP_ORDER = ["utm_term", "fbp", "fbclid", "utm_medium"];

export function utmMetaFromAnswers(
  answers: any,
  maxBytes = 600
): Record<string, string> {
  const out: Record<string, string> = {};
  const a = (answers || {}) as Record<string, any>;
  for (const k of Object.keys(UTM_MAX)) {
    const v = a[k];
    if (v != null && String(v).trim() !== "") {
      out[k] = String(v).trim().slice(0, UTM_MAX[k]);
    }
  }
  // Byte-Budget einhalten (Mollie-metadata-Limit ~1024B gesamt) — sonst wird
  // die ganze Zahlung von Mollie abgelehnt. Unwichtige Felder zuerst droppen.
  const bytes = () => Buffer.byteLength(JSON.stringify(out), "utf8");
  for (const k of DROP_ORDER) {
    if (bytes() <= maxBytes) break;
    if (k in out) delete out[k];
  }
  return out;
}
