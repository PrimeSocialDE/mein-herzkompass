// Zentrale Sprach-Ermittlung fuer die Mehrsprachigkeit (DE / PL / IT).
//
// WICHTIG fuer die Sicherheit: Default ist IMMER "de". Solange kein Lead
// lang="pl"/"it" traegt, verhaelt sich alles exakt wie bisher. PL- und IT-Zweig
// sind bis dahin toter Code. Deutsche Kunden bekommen nie "pl"/"it". "it" faellt
// ueberall, wo noch nicht uebersetzt, sauber auf den de-Zweig zurueck (kein Crash).

export type Lang = "de" | "pl" | "it";

export const DEFAULT_LANG: Lang = "de";

/** Normalisiert einen beliebigen Wert auf eine unterstuetzte Sprache (Default de). */
export function normalizeLang(v: unknown): Lang {
  return v === "pl" ? "pl" : v === "it" ? "it" : "de";
}

/** Liest die Sprache aus einem Lead/Member-Objekt (Spalte `lang` oder answers.lang). */
export function langFromLead(lead: unknown): Lang {
  const l = lead as { lang?: unknown; answers?: { lang?: unknown } } | null;
  return normalizeLang(l?.lang ?? l?.answers?.lang);
}

/** Leitet die Sprache aus dem Host ab: lapaplan.pl -> pl, zampaplan.it -> it, sonst de. */
export function langFromHost(host?: string | null): Lang {
  if (!host) return "de";
  const h = host.split(":")[0];
  if (/(^|\.)lapaplan\.pl$/i.test(h)) return "pl";
  if (/(^|\.)zampaplan\.it$/i.test(h)) return "it";
  return "de";
}

/**
 * Schlaegt die Sprache eines Kunden per E-Mail im Lead nach (answers.lang).
 * Fuer Kontexte, die nur die Member-/Email-Info haben (z. B. Member-/Club-Mails
 * an member_users, wo kein lang-Feld existiert). `client` = Supabase-Client mit
 * Lesezugriff auf wauwerk_leads. Default IMMER "de" (auch bei Fehler/kein Lead).
 */
export async function langFromEmailLookup(client: any, email: string): Promise<Lang> {
  if (!email || !client) return DEFAULT_LANG;
  try {
    const { data } = await client
      .from("wauwerk_leads")
      .select("answers")
      .ilike("email", email)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return normalizeLang((data?.answers as any)?.lang);
  } catch {
    return DEFAULT_LANG;
  }
}
