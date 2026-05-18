// Signed Recovery-Link Helper. Wird sowohl beim Mail-Versand (member-mail)
// als auch beim Klick (recovery-redirect route) genutzt — gleiche
// Signatur-Logik damit beides matcht.

import "server-only";
import { createHmac } from "node:crypto";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "https://www.pfoten-plan.de";

export function signRecoveryLead(leadId: string): string {
  const secret = process.env.WORKER_TOKEN || "no-secret";
  return createHmac("sha256", secret).update(leadId).digest("hex").slice(0, 16);
}

export function buildRecoveryUrl(
  leadId: string,
  opts?: { previewFreeView?: boolean }
): string {
  const sig = signRecoveryLead(leadId);
  const previewParam = opts?.previewFreeView ? "&preview=free" : "";
  return `${SITE_URL}/api/mitglieder/recovery-redirect?l=${encodeURIComponent(leadId)}&s=${sig}${previewParam}`;
}
