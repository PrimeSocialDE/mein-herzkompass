// Mapping von Quiz-Problem-Keys auf Bilder (alle aus public/, schon im
// Projekt vorhanden — gleiche Bilder die in kurz-schritt5.html benutzt
// werden, damit User-Wiedererkennungseffekt entsteht).

export const PROBLEM_IMAGE: Record<string, string> = {
  pulling: "/bsp3.jpg",
  barking: "/bsp5.jpg",
  aggression: "/bsp2.jpg",
  anxiety: "/bsp4.jpg",
  recall: "/RueckrufHund.png",
  energy: "/bsp1.jpg",
  destructive: "/bsp6.jpg",
  soiling: "/bsp7.jpg",
  mouthing: "/mundboden.jpg",
  jumping: "/Hund2.jpg",
  // Custom-Angst-Varianten
  "visitor-anxiety": "/bsp4.jpg",
  "thunder-anxiety": "/bsp4.jpg",
  "noise-sensitivity": "/bsp4.jpg",
  "general-anxiety": "/bsp4.jpg",
  "stranger-anxiety": "/bsp4.jpg",
  "separation": "/bsp4.jpg",
  // Jagd-Varianten
  "chasing": "/bsp1.jpg",
  "chasing-movement": "/bsp1.jpg",
  "prey-drive": "/bsp1.jpg",
  "chasing-cars": "/bsp1.jpg",
};

// Default-Hero falls Modul kein eigenes image_url im content-JSONB hat
export const MODULE_DEFAULT_HERO = "/Hund1.jpg";

// Modul-spezifische Default-Bilder per slug-Pattern
export function imageForModule(slug: string, contentImageUrl?: string): string {
  if (contentImageUrl) return contentImageUrl;
  if (/blickkontakt|aufmerksam/i.test(slug)) return "/Hund3.jpg";
  if (/willkommen|start|intro/i.test(slug)) return "/Hund1.jpg";
  if (/leine|pull/i.test(slug)) return "/bsp3.jpg";
  if (/rueckruf|recall/i.test(slug)) return "/RueckrufHund.png";
  if (/bell|bark/i.test(slug)) return "/bsp5.jpg";
  if (/trennung|anxi|separation/i.test(slug)) return "/bsp4.jpg";
  if (/aggress/i.test(slug)) return "/bsp2.jpg";
  if (/destruct|zerst/i.test(slug)) return "/bsp6.jpg";
  if (/mund|mouth/i.test(slug)) return "/mundboden.jpg";
  if (/energy|jagd|chase/i.test(slug)) return "/bsp1.jpg";
  return MODULE_DEFAULT_HERO;
}
