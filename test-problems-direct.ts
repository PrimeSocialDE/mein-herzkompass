// Direkt-Test aller Problem-Bibliotheken in allen 3 Längen.
import { composePlan } from "./lib/plan-composer";

const problems: Array<"pulling" | "energy" | "aggression" | "mouthing" | "recall" | "barking" | "anxiety" | "jumping" | "destructive" | "soiling"> = [
  "pulling", "energy", "aggression", "mouthing", "recall",
  "barking", "anxiety", "jumping", "destructive", "soiling",
];

for (const months of [1] as const) {
for (const p of problems) {
  console.log(`\n══════ ${p.toUpperCase()} / ${months}-Monat ══════`);
  const plan = composePlan({
    problem: p,
    planLengthMonths: months,
    dog: {
      dogName: "Bruno",
      dogBreed: "Labrador-Mix",
      dogAgeMonths: 18,
      trainingsZeitMinuten: 15,
    },
    customProblemText: "Test Custom-Problem-Text",
  });

  // Equipment-Briefing prüfen
  const aufbau = plan.intro?.aufbau || "";
  const briefingMatch = aufbau.match(/Ausrüstungs-Check[^.]*\./);
  console.log(`Equipment: ${briefingMatch ? briefingMatch[0].slice(0, 100)+"..." : "(KEINS)"}`);

  // 4 Wochen ausgeben
  for (const w of plan.weeks) {
    const uebs = (w.uebungen || []).map((u) => u.name).join(" + ");
    console.log(`  W${w.num}: ${w.title}`);
    console.log(`       Übungen: ${uebs}`);
  }

  // Check: unique Übungen über die 4 Wochen?
  const allUebNames: string[] = [];
  for (const w of plan.weeks) for (const u of (w.uebungen || [])) allUebNames.push(u.name);
  const unique = new Set(allUebNames);
  console.log(`  -> Übungen unique: ${unique.size} / ${allUebNames.length}`);
}
}
