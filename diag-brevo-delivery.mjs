// Pruefe Brevo-Delivery-Status fuer die paid Kaeufer mit plan_sent=null.
// Wenn Brevo zeigt 'delivered' → Mail kam an, plan_sent-Flag ist nur Legacy.
// Wenn Brevo zeigt nichts/error → wirkliches Problem.

import { readFileSync } from "node:fs";
try {
  const e = readFileSync(new URL("./.env.local", import.meta.url), "utf8");
  for (const l of e.split("\n")) {
    const m = l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {}

const BREVO_KEY = process.env.BREVO_API_KEY;

// Sample: 10 zufaellige paid Kaeufer mit plan_sent=null aus den letzten 7 Tagen
const samples = [
  "babsi.finger@gmail.com",
  "fabi.baumi1994@gmail.com",
  "kafrauendorf@gmail.com",
  "clovis@wtnet.de",
  "michaelwiesinger33@gmail.com",
  "conny.roth@hotmail.de",
  "afelice@bluewin.ch",       // gestern manuell getriggert
  "gitte.ungarten@t-online.de", // heute manuell getriggert
  "torben.haak@meha-haak.de",
  "ruth.speicher@gmx.de",
];

for (const email of samples) {
  // Brevo Events API: filtert nach email, zeigt delivered/bounce/open
  const r = await fetch(
    `https://api.brevo.com/v3/smtp/statistics/events?email=${encodeURIComponent(email)}&limit=10&days=14`,
    { headers: { "api-key": BREVO_KEY, accept: "application/json" } }
  );
  const j = await r.json();
  const events = j.events || [];
  // Nur Plan-Mail relevante Events (Subject enthält "Plan" oder "Trainings")
  const planEvents = events.filter(
    (e) =>
      e.subject &&
      (e.subject.includes("Plan") ||
        e.subject.includes("Trainings") ||
        e.subject.includes("kommt"))
  );

  console.log(`\n${email}`);
  if (planEvents.length === 0) {
    console.log(`  ❌ KEINE Plan-Mail-Events in Brevo gefunden`);
    // Zeige stattdessen die letzten 3 events egal welcher
    if (events.length > 0) {
      console.log(`  Letzte ${Math.min(3, events.length)} Events allgemein:`);
      for (const ev of events.slice(0, 3)) {
        console.log(`    ${ev.date} | ${ev.event} | ${ev.subject?.slice(0, 60)}`);
      }
    }
  } else {
    for (const ev of planEvents.slice(0, 5)) {
      console.log(`  ${ev.date} | ${ev.event.padEnd(10)} | ${ev.subject?.slice(0, 60)}`);
    }
  }
}
