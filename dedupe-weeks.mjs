// Fixt Duplikate zwischen aufeinander folgenden Wochen-Templates.
// Wenn W[n] ein exerciseId mit W[n-1] teilt, ersetzen wir es durch eine
// Alternative aus dem Problem-Pool, die nicht in den Nachbarn ist.
import { readFileSync, writeFileSync } from "node:fs";

const PATH = "/Users/maxxx/Documents/nextjs-boilerplate-main/lib/plan-composer.ts";
let content = readFileSync(PATH, "utf8");

// Pro Problem: Alle verfügbaren Übungs-IDs (Pool)
const POOLS = {
  pulling: ["p-schau", "p-leinenspiel-drinnen", "p-stop-and-go", "p-baum", "p-bei-fuss-belohnen", "p-decke-drinnen", "p-baum-draussen", "p-penalty-yards", "p-tempo-wechsel", "p-schau-draussen", "p-bogen", "p-gegenkonditionierung", "p-richtungswechsel-aussen", "p-lockere-leine-aussen", "p-vorbeigang", "p-cafe", "p-stadt-spaziergang", "p-wartungs-spaziergang"],
  energy: ["e-such-drinnen", "e-kong-mahlzeit", "e-warte-impuls", "e-entspannungs-marker", "e-shape-trick", "e-mantrailing-basis", "e-stop-spiel", "e-cool-down-decke", "e-auslastungs-plan", "e-anti-hyperarousal"],
  aggression: ["a-maulkorb-positiv", "a-schwellenwert-finden", "a-lat", "a-engage-disengage", "a-bogen-aktiv", "a-bat-distanz", "a-emergency-protokoll"],
  mouthing: ["m-aus-aufbauen", "m-tausch-protokoll", "m-pfui-konditionieren", "m-leinen-management", "m-maulkorb-uebergang", "m-belohnungs-suche"],
  recall: ["r-hier-laden", "r-restraint-recall", "r-schleppleine", "r-hier-mit-ablenkung", "r-pfeife-aufbauen", "r-freilauf-erste", "r-emergency-recall"],
  barking: ["b-trigger-tagebuch", "b-ruhe-marker", "b-tuerklingel-decke", "b-counter-cond-aussen", "b-aufmerksamkeits-bellen", "b-frust-management", "b-laeuten-routine"],
  anxiety: ["ax-trigger-stack", "ax-trigger-entkoppeln", "ax-mini-sekunden", "ax-kong-beim-gehen", "ax-sicherheits-decke", "ax-langzeit-aufbau", "ax-tagesroutine"],
  jumping: ["j-vier-pfoten-belohnen", "j-sitz-als-gruess", "j-tuergaeste-routine", "j-spazier-vorbeigaenger", "j-konsistenz-familie", "j-wartungs-routine"],
  destructive: ["d-ursachen-analyse", "d-kauobjekte-etablieren", "d-management-zonen", "d-langeweile-auslasten", "d-tausch-statt-strafe", "d-allein-zeit-kong"],
  soiling: ["s-toiletten-routine", "s-belohnen-am-platz", "s-trigger-lesen", "s-unfaelle-managen", "s-stress-reduktion", "s-naechtliche-blase"],
};

// Section-Boundaries finden
const SECTION_RE = /^const (PULLING|ENERGY|AGGRESSION|MOUTHING|RECALL|BARKING|ANXIETY|JUMPING|DESTRUCTIVE|SOILING)_WEEKS: Record<Phase, WeekTemplate\[\]> = \{$/m;

const sectionStarts = [];
const lines = content.split("\n");
lines.forEach((line, i) => {
  const m = line.match(/^const (\w+)_WEEKS: Record<Phase, WeekTemplate\[\]> = \{$/);
  if (m) sectionStarts.push({ name: m[1], idx: i });
});
console.log("Sections:", sectionStarts.map(s => s.name).join(", "));

// Pro Section: parse alle exerciseIds in Reihenfolge, gruppiert nach Phase
function parseSection(startIdx, endIdx, problemKey) {
  const phaseStarts = {};
  let currentPhase = null;
  for (let i = startIdx; i < endIdx; i++) {
    const line = lines[i];
    const phaseMatch = line.match(/^\s*(fundament|steigerung|generalisierung):\s*\[/);
    if (phaseMatch) {
      currentPhase = phaseMatch[1];
      phaseStarts[currentPhase] = { startLine: i, weeks: [] };
    }
    const exMatch = line.match(/^(\s*)exerciseIds:\s*\[([^\]]+)\],/);
    if (exMatch && currentPhase) {
      const ids = exMatch[2].split(",").map(s => s.trim().replace(/^"|"$/g, ""));
      phaseStarts[currentPhase].weeks.push({ lineIdx: i, indent: exMatch[1], ids });
    }
  }
  return phaseStarts;
}

// Fix duplicates within a phase
function fixPhase(weeks, pool) {
  // For each consecutive pair, ensure no shared exercise.
  // For each duplicate, replace one of the IDs with an alternative from pool
  // that isn't in either neighbor.
  for (let n = 1; n < weeks.length; n++) {
    const prev = weeks[n - 1].ids;
    const cur = weeks[n].ids;
    const next = weeks[n + 1]?.ids || [];
    for (let j = 0; j < cur.length; j++) {
      if (prev.includes(cur[j])) {
        // Find alternative not in prev, cur, next
        const taboo = new Set([...prev, ...cur, ...next]);
        const alt = pool.find(id => !taboo.has(id));
        if (alt) {
          console.log(`  Replace ${cur[j]} -> ${alt} in W${n + 1}`);
          cur[j] = alt;
        } else {
          console.log(`  WARN no alternative for ${cur[j]} in W${n + 1}`);
        }
      }
    }
  }
}

// Process each section
for (let s = 0; s < sectionStarts.length; s++) {
  const sec = sectionStarts[s];
  const next = sectionStarts[s + 1];
  const endIdx = next ? next.idx : lines.length;
  const problemKey = sec.name.toLowerCase();
  if (!POOLS[problemKey]) {
    console.log(`Skip ${sec.name}: no pool`);
    continue;
  }
  console.log(`\n=== ${sec.name} ===`);
  const phases = parseSection(sec.idx, endIdx, problemKey);
  for (const phase of ["fundament", "steigerung", "generalisierung"]) {
    if (!phases[phase]) continue;
    console.log(`  ${phase}:`);
    fixPhase(phases[phase].weeks, POOLS[problemKey]);
  }
  // Write back: for each week, replace the line
  for (const phase of ["fundament", "steigerung", "generalisierung"]) {
    if (!phases[phase]) continue;
    for (const w of phases[phase].weeks) {
      const idStr = w.ids.map(id => `"${id}"`).join(", ");
      lines[w.lineIdx] = `${w.indent}exerciseIds: [${idStr}],`;
    }
  }
}

writeFileSync(PATH, lines.join("\n"));
console.log("\nDone.");
