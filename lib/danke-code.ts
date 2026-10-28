// Persönlicher Danke-Code nach dem Plan-Kauf (z. B. MATTES30-3F9AK7):
// 30 % auf alle Module im Modul-Shop, 7 Tage ab Kauf.
//
// Zustandslos: Der Code wird aus Hundename + Lead-ID + HMAC berechnet und muss
// nirgends gespeichert werden. Ein erneuter Plan-Versand erzeugt denselben Code.
//   NAME   = Hundename in Großbuchstaben (A–Z, max. 10), Fallback PFOTE
//   ID4    = erste 4 Hex-Zeichen der Lead-ID (zum Wiederfinden per UUID-Bereich)
//   SIG2   = 2 Zeichen HMAC über Lead-ID (gegen Raten)
// Gültig, wenn der Lead bezahlt ist und paid_at + 7 Tage (oder ein späteres
// answers.danke_code_bis, z. B. aus einer Kampagne) noch nicht vorbei ist.
//
// Kontrollgruppe: 20 % der Käufer (fest per E-Mail-Hash) bekommen keinen Code,
// damit wir den Mehrumsatz gegen "hätten eh gekauft" messen können.

import crypto from "crypto";
import { supabase } from "@/lib/db";

export const DANKE_PROZENT = 30;
export const DANKE_TAGE = 7;

const SECRET = process.env.LOGIN_LINK_SECRET || process.env.WORKER_TOKEN || "";
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function nameTeil(dogName: string | null | undefined): string {
  const n = String(dogName || "")
    .toUpperCase()
    .replace(/Ä/g, "AE").replace(/Ö/g, "OE").replace(/Ü/g, "UE").replace(/ß/g, "SS")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Z]/g, "")
    .slice(0, 10);
  return n.length >= 2 ? n : "PFOTE";
}

function sig(leadId: string): string {
  const h = crypto.createHmac("sha256", SECRET).update("danke:" + leadId.toLowerCase()).digest();
  return ALPHABET[h[0] % 32] + ALPHABET[h[1] % 32];
}

export function buildDankeCode(dogName: string | null | undefined, leadId: string): string {
  const id4 = leadId.replace(/-/g, "").slice(0, 4).toUpperCase();
  return `${nameTeil(dogName)}${DANKE_PROZENT}-${id4}${sig(leadId)}`;
}

// 20 % Kontrollgruppe, fest per E-Mail
export function dankeKontrolle(email: string): boolean {
  const h = crypto.createHash("sha256").update("danke-ab:" + email.trim().toLowerCase()).digest();
  return h[0] % 10 < 2;
}

export function dankeBis(paidAt: string | null | undefined, answersBis?: string | null): Date | null {
  const base = paidAt ? new Date(new Date(paidAt).getTime() + DANKE_TAGE * 86400000) : null;
  const extra = answersBis ? new Date(answersBis) : null;
  const valid = [base, extra].filter((d): d is Date => !!d && !isNaN(d.getTime()));
  if (!valid.length) return null;
  return new Date(Math.max(...valid.map((d) => d.getTime())));
}

export type DankeCheck =
  | { ok: true; code: string; prozent: number; bis: string; dogName: string; leadId: string }
  | { ok: false; reason: "format" | "not_found" | "expired" | "error" };

export async function checkDankeCode(raw: string): Promise<DankeCheck> {
  const code = String(raw || "").trim().toUpperCase().replace(/\s+/g, "");
  const m = code.match(/^([A-Z]{2,10})(\d{2})-([0-9A-F]{4})([A-Z2-9]{2})$/);
  if (!m || Number(m[2]) !== DANKE_PROZENT) return { ok: false, reason: "format" };
  const id4 = m[3].toLowerCase();
  // Alle Leads, deren UUID mit diesen 4 Hex-Zeichen beginnt (im Schnitt 1–3 Zeilen)
  const lo = `${id4}0000-0000-0000-0000-000000000000`;
  const hiNum = parseInt(id4, 16) + 1;
  try {
    let q = supabase
      .from("wauwerk_leads")
      .select("id, dog_name, status, paid_at, answers")
      .eq("status", "paid")
      .gte("id", lo);
    if (hiNum <= 0xffff) q = q.lt("id", `${hiNum.toString(16).padStart(4, "0")}0000-0000-0000-0000-000000000000`);
    const { data, error } = await q.limit(50);
    if (error) return { ok: false, reason: "error" };
    for (const l of (data || []) as any[]) {
      const dog = l.dog_name || l.answers?.dog_name || "deinem Hund";
      if (buildDankeCode(dog, l.id) !== code) continue;
      const bis = dankeBis(l.paid_at, l.answers?.danke_code_bis);
      if (!bis || bis.getTime() < Date.now()) return { ok: false, reason: "expired" };
      return { ok: true, code, prozent: DANKE_PROZENT, bis: bis.toISOString(), dogName: dog, leadId: l.id };
    }
    return { ok: false, reason: "not_found" };
  } catch {
    return { ok: false, reason: "error" };
  }
}

// Basispreise im Modul-Shop (Cent) — Rabatt wird nur darauf gerechnet,
// nie auf einen Preis aus dem Browser.
const SHOP_MODULE = ["anxiety", "pulling", "barking", "aggression", "recall", "jumping", "energy", "destructive", "mouthing"];
const BUNDLE_CENT: Record<number, number> = { 2: 2500, 3: 3500, 4: 4500, 5: 5500, 6: 6500, 7: 7500, 8: 8500, 9: 8500 };

export function shopBasisCent(module: string): number | null {
  const teile = module.split("+").filter(Boolean);
  if (!teile.length || !teile.every((t) => SHOP_MODULE.includes(t))) return null;
  if (new Set(teile).size !== teile.length) return null;
  if (teile.length === 1) return 1900;
  return BUNDLE_CENT[teile.length] ?? null;
}

export function rabattCent(basisCent: number, prozent: number = DANKE_PROZENT): number {
  return Math.round((basisCent * (100 - prozent)) / 100);
}
