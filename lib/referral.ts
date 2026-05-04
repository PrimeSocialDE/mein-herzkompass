// Referral-Helpers: Code-Generation + Validierung.
// Codes sind kurz, gut lesbar (kein 0/O/I/1) und URL-safe.

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // ohne 0,O,I,1,L

function randomCode(length: number): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}

// Empfehler-Code: Was im Referral-Link an Freunde steht
// Beispiel: "PFOTE-A8B3K2"
export function generateReferralCode(): string {
  return `PFOTE-${randomCode(6)}`;
}

// Coupon-Code: Was der Empfehler nach erfolgreichem Referral einlöst
// Etwas länger weil "echtes Geld" wert (1 Modul gratis = €19,99)
// Beispiel: "GRATIS-ABCD-EFGH"
export function generateRedeemCode(): string {
  return `GRATIS-${randomCode(4)}-${randomCode(4)}`;
}

export function isValidReferralCode(code: string | null | undefined): boolean {
  if (!code) return false;
  return /^PFOTE-[A-Z2-9]{6}$/.test(code);
}

export function isValidRedeemCode(code: string | null | undefined): boolean {
  if (!code) return false;
  return /^GRATIS-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(code);
}
