// Gemeinsamer Zustand der Support-Fälle.
//
// Wird vom Cron (/api/cron/support-autoresponder) und vom Admin-Dashboard
// (/api/admin/support-cases) benutzt, damit beide dieselbe Vorstellung davon
// haben, was ein Fall ist und was beim Versenden passiert.

import "server-only";
import { supabase } from "@/lib/db";
import { sendViaGoogleSmtp } from "@/lib/google-smtp";

export type CaseStatus =
  | "neu"
  | "plankorrektur"
  | "rettung_angeboten"
  | "gerettet"
  | "erstattung"
  | "erledigt";

export interface VerlaufEintrag {
  mid?: string;
  richtung: "ein" | "aus";
  text: string;
  at: string;
}

export interface SupportCase {
  id: string;
  thread_key: string;
  uid: number;
  message_id: string | null;
  from_email: string;
  from_name: string | null;
  subject: string | null;
  received_at: string;
  kategorie: string;
  status: CaseStatus;
  heikel: boolean;
  kurz: string | null;
  entwurf: string | null;
  letzte_nachricht: string | null;
  verlauf: VerlaufEintrag[];
  lead_id: string | null;
  dog_name: string | null;
  bezahlt: boolean | null;
  betrag_cent: number | null;
  gesendet_at: string | null;
  erledigt_at: string | null;
}

/** Farbe je Zustand — identisch in Digest-Mail und Dashboard. */
export const FARBE: Record<CaseStatus, string> = {
  neu: "#6b7280",
  plankorrektur: "#2563eb",
  rettung_angeboten: "#d97706",
  gerettet: "#16a34a",
  erstattung: "#dc2626",
  erledigt: "#9ca3af",
};

export const LABEL: Record<CaseStatus, string> = {
  neu: "Neu",
  plankorrektur: "Plankorrektur",
  rettung_angeboten: "Rettung angeboten",
  gerettet: "Gerettet",
  erstattung: "Erstattung",
  erledigt: "Erledigt",
};

export function esc(s: string): string {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function nl2br(s: string): string {
  return esc(s).replace(/\n/g, "<br>");
}

export function cleanSubject(s: string): string {
  return String(s || "").replace(/^\s*((Re|Aw|AW|WG|Fwd|Antw)\s*:\s*)+/i, "").trim();
}

/**
 * Verschickt die Antwort zu einem Fall und schreibt den Zustand fort.
 * Benutzt vom Auto-Versand des Crons und vom Knopf im Dashboard.
 */
export async function sendeAntwort(fall: SupportCase, text: string): Promise<boolean> {
  const betreff = "Re: " + (cleanSubject(fall.subject || "") || "Deine Nachricht an Pfoten-Plan");
  try {
    await sendViaGoogleSmtp({
      to: fall.from_email,
      subject: betreff,
      html: `<div style="font-family:Arial,sans-serif;font-size:15px;color:#111;line-height:1.6">${nl2br(text)}</div>`,
      fromName: "Max von Pfoten-Plan",
    });
  } catch (e) {
    console.error("[support-cases] Versand fehlgeschlagen:", e);
    return false;
  }

  // Nach dem Widerruf-Angebot warten wir auf die Reaktion des Kunden —
  // erst die entscheidet über Grün oder Rot. Alles andere ist mit der
  // Antwort erledigt.
  const folgeStatus: CaseStatus =
    fall.kategorie === "widerruf"
      ? "rettung_angeboten"
      : fall.status === "plankorrektur"
      ? "plankorrektur"
      : "erledigt";

  const jetzt = new Date().toISOString();
  await supabase
    .from("support_cases")
    .update({
      status: folgeStatus,
      gesendet_at: jetzt,
      erledigt_at: folgeStatus === "erledigt" ? jetzt : null,
      verlauf: [...(fall.verlauf || []), { richtung: "aus", text, at: jetzt }],
    })
    .eq("id", fall.id);

  return true;
}
