// Liest plan-composer.ts und fuegt jedem Single-Exercise-Wochen-Template
// einen kontextuell passenden Partner hinzu. Mapping pro ID.
import { readFileSync, writeFileSync } from "node:fs";

const PARTNERS = {
  // PULLING
  "p-schau": "p-stop-and-go",
  "p-baum": "p-leinenspiel-drinnen",
  "p-leinenspiel-drinnen": "p-baum",
  "p-stop-and-go": "p-decke-drinnen",
  "p-decke-drinnen": "p-stop-and-go",
  "p-bei-fuss-belohnen": "p-schau",
  "p-baum-draussen": "p-bei-fuss-belohnen",
  "p-penalty-yards": "p-baum-draussen",
  "p-schau-draussen": "p-baum-draussen",
  "p-bogen": "p-baum-draussen",
  "p-gegenkonditionierung": "p-schau-draussen",
  "p-richtungswechsel-aussen": "p-tempo-wechsel",
  "p-tempo-wechsel": "p-bei-fuss-belohnen",
  "p-vorbeigang": "p-lockere-leine-aussen",
  "p-cafe": "p-decke-drinnen",
  "p-stadt-spaziergang": "p-lockere-leine-aussen",
  "p-lockere-leine-aussen": "p-penalty-yards",
  "p-wartungs-spaziergang": "p-lockere-leine-aussen",

  // ENERGY
  "e-such-drinnen": "e-kong-mahlzeit",
  "e-kong-mahlzeit": "e-such-drinnen",
  "e-warte-impuls": "e-entspannungs-marker",
  "e-entspannungs-marker": "e-warte-impuls",
  "e-shape-trick": "e-warte-impuls",
  "e-mantrailing-basis": "e-stop-spiel",
  "e-stop-spiel": "e-cool-down-decke",
  "e-cool-down-decke": "e-entspannungs-marker",
  "e-auslastungs-plan": "e-anti-hyperarousal",
  "e-anti-hyperarousal": "e-entspannungs-marker",

  // AGGRESSION
  "a-maulkorb-positiv": "a-schwellenwert-finden",
  "a-schwellenwert-finden": "a-lat",
  "a-lat": "a-engage-disengage",
  "a-engage-disengage": "a-lat",
  "a-bogen-aktiv": "a-lat",
  "a-bat-distanz": "a-emergency-protokoll",
  "a-emergency-protokoll": "a-bat-distanz",

  // MOUTHING
  "m-aus-aufbauen": "m-pfui-konditionieren",
  "m-tausch-protokoll": "m-aus-aufbauen",
  "m-pfui-konditionieren": "m-tausch-protokoll",
  "m-leinen-management": "m-pfui-konditionieren",
  "m-maulkorb-uebergang": "m-leinen-management",
  "m-belohnungs-suche": "m-leinen-management",

  // RECALL
  "r-hier-laden": "r-restraint-recall",
  "r-restraint-recall": "r-hier-laden",
  "r-schleppleine": "r-hier-laden",
  "r-hier-mit-ablenkung": "r-schleppleine",
  "r-pfeife-aufbauen": "r-hier-laden",
  "r-freilauf-erste": "r-emergency-recall",
  "r-emergency-recall": "r-pfeife-aufbauen",

  // BARKING
  "b-trigger-tagebuch": "b-ruhe-marker",
  "b-ruhe-marker": "b-tuerklingel-decke",
  "b-tuerklingel-decke": "b-ruhe-marker",
  "b-counter-cond-aussen": "b-ruhe-marker",
  "b-aufmerksamkeits-bellen": "b-ruhe-marker",
  "b-frust-management": "b-ruhe-marker",
  "b-laeuten-routine": "b-counter-cond-aussen",

  // ANXIETY
  "ax-trigger-stack": "ax-mini-sekunden",
  "ax-trigger-entkoppeln": "ax-kong-beim-gehen",
  "ax-mini-sekunden": "ax-kong-beim-gehen",
  "ax-kong-beim-gehen": "ax-mini-sekunden",
  "ax-sicherheits-decke": "ax-kong-beim-gehen",
  "ax-langzeit-aufbau": "ax-tagesroutine",
  "ax-tagesroutine": "ax-kong-beim-gehen",

  // JUMPING
  "j-vier-pfoten-belohnen": "j-sitz-als-gruess",
  "j-sitz-als-gruess": "j-konsistenz-familie",
  "j-tuergaeste-routine": "j-sitz-als-gruess",
  "j-spazier-vorbeigaenger": "j-sitz-als-gruess",
  "j-konsistenz-familie": "j-vier-pfoten-belohnen",
  "j-wartungs-routine": "j-tuergaeste-routine",

  // DESTRUCTIVE
  "d-ursachen-analyse": "d-kauobjekte-etablieren",
  "d-kauobjekte-etablieren": "d-management-zonen",
  "d-management-zonen": "d-kauobjekte-etablieren",
  "d-langeweile-auslasten": "d-kauobjekte-etablieren",
  "d-tausch-statt-strafe": "d-kauobjekte-etablieren",
  "d-allein-zeit-kong": "d-kauobjekte-etablieren",

  // SOILING
  "s-toiletten-routine": "s-belohnen-am-platz",
  "s-belohnen-am-platz": "s-trigger-lesen",
  "s-trigger-lesen": "s-toiletten-routine",
  "s-unfaelle-managen": "s-belohnen-am-platz",
  "s-stress-reduktion": "s-toiletten-routine",
  "s-naechtliche-blase": "s-toiletten-routine",
};

const PATH = "/Users/maxxx/Documents/nextjs-boilerplate-main/lib/plan-composer.ts";
let content = readFileSync(PATH, "utf8");

// Pattern: exerciseIds: ["xxx"],
const re = /exerciseIds: \["([a-z-]+)"\],/g;
let count = 0;
content = content.replace(re, (match, id) => {
  const partner = PARTNERS[id];
  if (!partner) {
    console.warn(`  WARN no partner for ${id}`);
    return match;
  }
  count++;
  return `exerciseIds: ["${id}", "${partner}"],`;
});

writeFileSync(PATH, content);
console.log(`Replaced ${count} single-exercise templates with 2-exercise partners.`);
