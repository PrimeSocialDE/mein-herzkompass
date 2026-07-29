// Testet alle 4 neuen Problem-Bibliotheken direkt via Composer.
// Kein DB-Update, kein Mail-Versand.

const { composePlan } = await import("/Users/maxxx/Documents/nextjs-boilerplate-main/lib/plan-composer.ts").catch(async () => {
  // Cannot directly import TS — use a different approach
  return null;
});

import { spawnSync } from "node:child_process";

const problems = ["pulling", "energy", "aggression", "mouthing", "recall"];

for (const p of problems) {
  console.log(`\n══════ Problem: ${p.toUpperCase()} (1-Monat = 4 Wochen) ══════`);
  // Use tsx to run a quick inline test
  const script = `
import { composePlan } from "./lib/plan-composer.ts";
const plan = composePlan({
  problem: "${p}",
  planLengthMonths: 1,
  dog: { dogName: "Bruno", dogBreed: "Labrador-Mix", dogAgeMonths: 18, trainingsZeitMinuten: 15 },
  customProblemText: "Test-Problem-Text",
});
console.log("Aufbau:", plan.intro?.aufbau?.slice(0, 200));
for (const w of plan.weeks) {
  const uebs = (w.uebungen||[]).map(u => u.name).join(" + ");
  console.log(\`W\${w.num}: \${w.title}\`);
  console.log(\`     -> \${uebs}\`);
}
`.trim();
  const tmpFile = `/tmp/test-${p}.mjs`;
  await import("node:fs").then(fs => fs.writeFileSync(tmpFile, script));
  const r = spawnSync("npx", ["tsx", tmpFile], { encoding: "utf8", cwd: "/Users/maxxx/Documents/nextjs-boilerplate-main" });
  if (r.stdout) console.log(r.stdout);
  if (r.stderr) console.error(r.stderr.slice(0, 500));
}
