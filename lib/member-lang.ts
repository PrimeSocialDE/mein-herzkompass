// lib/member-lang.ts
//
// Sprach-Ermittlung für den Mitgliederbereich (Server-Komponenten).
// member_users hat kein lang-Feld → wir schlagen die Sprache am Lead nach
// (wauwerk_leads.answers.lang, per E-Mail). Default IMMER "de", damit der
// deutsche Mitgliederbereich exakt wie bisher rendert (PL ist additiv).

import { createMemberAdminClient } from "./member-auth-server";
import { langFromEmailLookup, type Lang } from "./lang";

export type { Lang };

/** Sprache des eingeloggten Members via E-Mail (answers.lang). Default "de". */
export async function getMemberLang(email?: string | null): Promise<Lang> {
  if (!email) return "de";
  return langFromEmailLookup(createMemberAdminClient(), email);
}
