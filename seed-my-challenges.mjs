// Setzt fuer kontakt@primesocial.de manuell die Wochen-Challenges.
// Checked erst ob die Tabelle existiert. Wenn nicht: User muss SQL laufen lassen.
import { readFileSync } from "node:fs";
try {
  const e = readFileSync(new URL("./.env.local", import.meta.url), "utf8");
  for (const l of e.split("\n")) {
    const m = l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {}

const { createClient } = await import("@supabase/supabase-js");
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const USER_ID = "f1569548-70f3-4881-9001-9d8bd3ea286b";
const PROBLEM = "pulling";

// Pulling-Templates (aus lib/member-challenges.ts gespiegelt)
const TEMPLATES = [
  {
    slug: "leine-locker",
    title: "Lockere Leine - 5 Minuten",
    description: "Geh 5 Minuten ohne Leinenzug. Sobald die Leine straff wird: stehenbleiben. Sobald sie locker ist: weitergehen.",
    target_sessions: 3,
    badge_emoji: "🥇",
    badge_label: "Leinen-Profi",
    is_premium: false,
  },
  {
    slug: "richtungswechsel",
    title: "Richtungswechsel 'U-Turn'",
    description: "Wenn dein Hund vor dir herrennt: ruhig 'komm' sagen, Richtungswechsel - er muss nachkommen. 4× pro Spaziergang.",
    target_sessions: 4,
    badge_emoji: "🔄",
    badge_label: "Richtungs-Profi",
    is_premium: false,
  },
  {
    slug: "stop-and-go",
    title: "Stop-and-Go an der Tür",
    description: "Vor der Haustür: warten bis dein Hund sitzt + Blickkontakt hält. Erst dann öffnen. 5× üben.",
    target_sessions: 5,
    badge_emoji: "🚪",
    badge_label: "Tür-Disziplin",
    is_premium: false,
  },
  {
    slug: "leine-ablenkung",
    title: "Lockere Leine bei Ablenkung",
    description: "Übe mit niedriger Ablenkung (Park, ruhige Straße). Bei Zug: stehenbleiben, warten bis er zurückkommt, dann weiter.",
    target_sessions: 3,
    badge_emoji: "🎯",
    badge_label: "Leinen-Coolness",
    is_premium: true,
  },
];

// week_start_date = Montag dieser Woche
const now = new Date();
const day = now.getUTCDay();
const diff = day === 0 ? -6 : 1 - day;
const monday = new Date(now);
monday.setUTCDate(monday.getUTCDate() + diff);
const weekStart = monday.toISOString().slice(0, 10);

console.log("Seeding for user:", USER_ID);
console.log("Week start:", weekStart);

// Pre-flight: existiert die Tabelle?
const { error: preflight } = await sb
  .from("member_user_challenges")
  .select("id")
  .limit(1);
if (preflight && preflight.code === "PGRST205") {
  console.error("\n❌ Tabelle member_user_challenges existiert noch nicht.");
  console.error("→ Bitte erst supabase-challenges-setup.sql im Supabase SQL Editor ausfuehren.");
  process.exit(1);
}
if (preflight) {
  console.error("Unerwarteter Fehler:", preflight);
  process.exit(1);
}
console.log("✅ Tabelle existiert");

// Schon Challenges fuer diese Woche?
const { data: existing } = await sb
  .from("member_user_challenges")
  .select("*")
  .eq("user_id", USER_ID)
  .eq("week_start_date", weekStart);

if (existing && existing.length > 0) {
  console.log(`Schon ${existing.length} Challenges fuer diese Woche da:`);
  for (const c of existing) console.log(`  - ${c.challenge_slug} | ${c.badge_label}`);
  console.log("\nKein Re-Insert noetig. Lade /mitglieder/erfolge/challenges neu.");
  process.exit(0);
}

// Insert (paid → 4 challenges: 2 pulling-spezifisch + 2 generisch...
// einfach erstmal die 3 free pulling-templates + 1 premium)
const rows = TEMPLATES.map((t) => ({
  user_id: USER_ID,
  challenge_slug: t.slug,
  challenge_title: t.title,
  challenge_description: t.description,
  problem_match: PROBLEM,
  target_sessions: t.target_sessions,
  sessions_done: 0,
  badge_emoji: t.badge_emoji,
  badge_label: t.badge_label,
  week_start_date: weekStart,
  is_premium: t.is_premium,
}));

const { data: inserted, error } = await sb
  .from("member_user_challenges")
  .insert(rows)
  .select("*");

if (error) {
  console.error("\n❌ Insert failed:", error);
  process.exit(1);
}
console.log(`\n✅ ${inserted.length} Challenges angelegt fuer Woche ${weekStart}:`);
for (const c of inserted) console.log(`  - ${c.badge_emoji} ${c.badge_label} (${c.target_sessions} Sessions)`);
console.log("\nJetzt /mitglieder/erfolge/challenges neu laden - du siehst sie sofort.");
