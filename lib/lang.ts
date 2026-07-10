// Zentrale Sprach-Ermittlung fuer die Mehrsprachigkeit (DE / PL).
//
// WICHTIG fuer die Sicherheit: Default ist IMMER "de". Solange kein Lead
// lang="pl" traegt (= vor dem PL-Launch), verhaelt sich alles exakt wie bisher.
// Der PL-Zweig ist bis dahin toter Code. Deutsche Kunden bekommen nie "pl".

export type Lang = "de" | "pl";

export const DEFAULT_LANG: Lang = "de";

/** Normalisiert einen beliebigen Wert auf eine unterstuetzte Sprache (Default de). */
export function normalizeLang(v: unknown): Lang {
  return v === "pl" ? "pl" : "de";
}

/** Liest die Sprache aus einem Lead/Member-Objekt (Spalte `lang` oder answers.lang). */
export function langFromLead(lead: unknown): Lang {
  const l = lead as { lang?: unknown; answers?: { lang?: unknown } } | null;
  return normalizeLang(l?.lang ?? l?.answers?.lang);
}

/** Leitet die Sprache aus dem Host ab: lapaplan.pl -> pl, sonst de. */
export function langFromHost(host?: string | null): Lang {
  if (!host) return "de";
  return /(^|\.)lapaplan\.pl$/i.test(host.split(":")[0]) ? "pl" : "de";
}
