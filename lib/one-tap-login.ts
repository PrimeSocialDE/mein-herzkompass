// One-Tap-Login: signierte, WIEDERVERWENDBARE Direkt-Login-Links.
//
// Warum: Supabase-OTP (6-stelliger Code / Magic-Link) ist EINMALIG und laeuft
// schnell ab. E-Mail-Scanner (t-online/GMX/web.de) verbrennen den Einmal-Token
// beim Vorab-Abruf, und wer nach dem Code kurz woanders hinklickt, findet ihn
// abgelaufen. Ein signierter Link ist dagegen tagelang gueltig und
// wiederverwendbar → ein Scanner-Prefetch schadet nicht (der erzeugt nur eine
// Session im cookielosen Scanner-Kontext), und der Kunde kommt jederzeit rein.
//
// Sicherheit: HMAC-SHA256 ueber "email|exp". Ohne das Server-Secret nicht
// faelschbar. exp begrenzt die Gueltigkeit. Der Link erzeugt eine Session NUR
// fuer genau diese (signierte) E-Mail.

import { createHmac, timingSafeEqual } from "node:crypto";

const SECRET =
  process.env.LOGIN_LINK_SECRET || process.env.WORKER_TOKEN || "";

const DEFAULT_TTL_DAYS = 365; // 1 Jahr — der Link soll "quasi ewig" halten,
// damit Kunden nie wieder einen neuen Code anfordern muessen. Reine Zugangs-
// Bequemlichkeit fuer ein digitales Produkt; der Link ist HMAC-signiert
// (nicht faelschbar) und wiederverwendbar (Scanner-Prefetch schadet nicht).

function b64url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
function b64urlDecode(s: string): string {
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString(
    "utf8"
  );
}

function sign(email: string, exp: number): string {
  return b64url(createHmac("sha256", SECRET).update(`${email}|${exp}`).digest());
}

/** Baut die One-Tap-URL fuer eine E-Mail (Default 30 Tage gueltig). */
export function buildOneTapUrl(
  baseUrl: string,
  email: string,
  opts: { ttlDays?: number; next?: string } = {}
): string {
  if (!SECRET) throw new Error("LOGIN_LINK_SECRET/WORKER_TOKEN nicht gesetzt");
  const e = email.trim().toLowerCase();
  const exp =
    Math.floor(Date.now() / 1000) +
    (opts.ttlDays ?? DEFAULT_TTL_DAYS) * 86400;
  const sig = sign(e, exp);
  const params = new URLSearchParams({
    e: b64url(Buffer.from(e, "utf8")),
    exp: String(exp),
    sig,
  });
  if (opts.next && opts.next.startsWith("/")) params.set("next", opts.next);
  return `${baseUrl.replace(/\/$/, "")}/api/mitglieder/one-tap?${params.toString()}`;
}

/** Prueft die Signatur + Ablauf. Gibt die E-Mail zurueck oder null. */
export function verifyOneTap(
  eB64: string,
  expStr: string,
  sig: string
): { email: string } | null {
  if (!SECRET) return null;
  let email: string;
  try {
    email = b64urlDecode(eB64).trim().toLowerCase();
  } catch {
    return null;
  }
  const exp = Number(expStr);
  if (!email || !Number.isFinite(exp)) return null;
  if (Math.floor(Date.now() / 1000) > exp) return null; // abgelaufen

  const expected = sign(email, exp);
  const a = Buffer.from(expected);
  const b = Buffer.from(sig || "");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return { email };
}
