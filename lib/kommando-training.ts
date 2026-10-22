// Kommando-Training: zwei Zusatzseiten am Ende jedes (DE-)Trainingsplans.
//
// Der Halter wählt im Quiz (kurz-schritt6, answers.dog_commands), welche
// Kommandos sein Hund schon kann. Hier kommen vier Alltags-Kommandos zum Üben
// hinein: zuerst die, die der Hund noch NICHT kann (Reihenfolge nach Nutzen im
// Alltag), aufgefüllt mit bekannten zum Auffrischen. Der Plan-Composer legt das
// Ergebnis in content.kommando_training ab, generate-plan-from-content.mjs
// rendert es als zwei Seiten nach den Bonus-Spielen (bestehende Seiten
// verschieben sich dadurch nicht). Texte bewusst ohne er/sie, nur mit Namen.

export interface KommandoTraining {
  key: string;
  titel: string;
  alltag: string;
  schritte: string[];
  tipp: string;
  neu: boolean;
}

type Vorlage = Omit<KommandoTraining, "key" | "neu">;

// Reihenfolge = Priorität im Alltag (älteren Haltern, Hunde mit viel Energie)
const REIHENFOLGE = ["slow", "wait", "stop", "leave", "heel", "stay", "come", "place", "sit", "down"];

const VORLAGEN: Record<string, Vorlage> = {
  slow: {
    titel: "Langsam",
    alltag: "Wenn {dogName} an der Leine anzieht, auf nassem Laub, an der Treppe oder kurz vor einer Ecke.",
    schritte: [
      "Geh drinnen ein paar Schritte. Sobald {dogName} nach vorne drängt, bleib stehen und sag ruhig und gedehnt: \"Laaangsam\".",
      "Warte, bis die Leine locker wird. In genau diesem Moment loben und ein Leckerli auf Kniehöhe neben dir geben.",
      "Geh weiter. Nach 5 bis 10 lockeren Schritten wieder belohnen, auch wenn nichts passiert ist.",
      "Übe es dann draußen auf einer ruhigen Strecke, erst später dort, wo es spannend wird.",
      "Sag das Wort immer im gleichen ruhigen Ton, nie gerufen. Es ist eine Bitte, keine Strafe.",
    ],
    tipp: "Bleib selbst langsam. Wer schneller wird, um mitzuhalten, bringt dem Hund bei, dass Ziehen funktioniert.",
  },
  wait: {
    titel: "Warte",
    alltag: "An der Haustür, an der Autotür und auf der Treppe, damit {dogName} nicht vorbeidrängt.",
    schritte: [
      "Stell dich mit {dogName} an die geschlossene Haustür und sag ruhig \"Warte\".",
      "Öffne die Tür nur einen Spalt. Drängt {dogName} nach vorne, schließt du sie wieder, ohne zu schimpfen.",
      "Bleibt {dogName} ruhig stehen oder sitzen: Tür weiter auf, kurz warten, dann mit \"Okay\" freigeben.",
      "Steigere langsam: Tür ganz offen, dann gehst du zuerst einen Schritt hinaus.",
      "Übe das Gleiche an der Treppe: erst du, dann {dogName}.",
    ],
    tipp: "\"Okay\" ist das Freigabe-Wort. Ohne Freigabe gilt Warte weiter, so lernt {dogName}, dass du das Ende bestimmst.",
  },
  stop: {
    titel: "Stopp",
    alltag: "Am Bordstein, vor der Straße und überall, wo {dogName} sofort anhalten muss.",
    schritte: [
      "Geh mit {dogName} an der Leine auf eine Wand oder einen Zaun zu und sag kurz vorher \"Stopp\".",
      "Bleib selbst abrupt stehen. Hält {dogName} mit an: sofort ein großes Leckerli.",
      "Wiederhole das zehnmal auf dem Spaziergang, an Stellen ohne echte Gefahr.",
      "Nimm dann den Bordstein dazu: vor jeder Straße Stopp, belohnen, erst dann gemeinsam weiter.",
      "Später sagst du Stopp, ohne selbst stehen zu bleiben, und belohnst, wenn {dogName} von allein hält.",
    ],
    tipp: "Nutze Stopp nur für echte Halte-Momente. Wird es zu oft gesagt und nicht belohnt, verliert es seine Kraft.",
  },
  leave: {
    titel: "Lass es",
    alltag: "Wenn {dogName} draußen etwas vom Boden aufnehmen will oder Essen vom Tisch reizt.",
    schritte: [
      "Leg ein Leckerli in deine geschlossene Faust und halte sie {dogName} hin.",
      "Schnüffeln und Stupsen ignorierst du. Weicht {dogName} kurz zurück: \"Lass es\" sagen und aus der ANDEREN Hand belohnen.",
      "Dann mit offener Hand üben, später mit dem Leckerli auf dem Boden unter deinem Fuß.",
      "Draußen legst du vorher ein Stück Brot auf den Weg und übst im Vorbeigehen.",
      "Jedes Lass-es wird belohnt, und zwar immer mit etwas Besserem als dem Fundstück.",
    ],
    tipp: "Nie das Fundstück selbst als Belohnung geben. {dogName} soll lernen: Wer liegen lässt, bekommt etwas Besseres von mir.",
  },
  heel: {
    titel: "Fuß",
    alltag: "Wenn ihr an Joggern, Radfahrern oder anderen Hunden vorbei müsst.",
    schritte: [
      "Halte ein Leckerli an deinem linken Bein auf Kniehöhe und lock {dogName} an diese Stelle.",
      "Geh zwei, drei Schritte. Bleibt {dogName} an deinem Bein: \"Fuß\" sagen und belohnen.",
      "Steigere auf fünf, dann zehn Schritte, belohne immer an genau dieser Stelle.",
      "Übe es kurz vor einer Begegnung: Fuß, vorbeigehen, danach wieder lockere Leine.",
      "Fuß ist für kurze Strecken gedacht. Den Rest des Spaziergangs darf {dogName} schnüffeln.",
    ],
    tipp: "Belohne immer an deinem Bein, nie vor dir. Dann sucht {dogName} genau diese Position von allein.",
  },
  stay: {
    titel: "Bleib",
    alltag: "Wenn du kurz die Hände frei brauchst, etwa beim Briefkasten oder beim Anleinen.",
    schritte: [
      "Lass {dogName} sitzen, zeig die flache Hand und sag \"Bleib\".",
      "Mach einen kleinen Schritt zurück und sofort wieder vor. Ist {dogName} sitzen geblieben: belohnen.",
      "Erhöhe erst die Dauer (3, 5, 10 Sekunden), dann den Abstand.",
      "Löse jedes Bleib mit \"Okay\" auf, damit {dogName} weiß, wann es vorbei ist.",
      "Steht {dogName} zu früh auf: ruhig zurück auf die Stelle, kleinerer Schritt.",
    ],
    tipp: "Geh zu {dogName} zurück, um zu belohnen, statt zu rufen. So bleibt das Bleib sauber.",
  },
  come: {
    titel: "Hier",
    alltag: "Damit {dogName} auf dem Feld, im Park oder an der Schleppleine zuverlässig zurückkommt.",
    schritte: [
      "Ruf drinnen aus zwei Metern fröhlich \"Hier\" und geh dabei einen Schritt rückwärts.",
      "Kommt {dogName}: ein richtig gutes Leckerli und kurz loben, dann wieder entlassen.",
      "Übe draußen an der langen Leine, erst ohne Ablenkung.",
      "Ruf nie, um etwas Unangenehmes zu machen, zum Beispiel Spaziergang beenden oder Krallen schneiden.",
      "Steigere die Ablenkung langsam. Klappt es dreimal hintereinander, darf es schwieriger werden.",
    ],
    tipp: "Ruf Hier nur, wenn du ziemlich sicher bist, dass {dogName} kommt. Jeder Erfolg macht das Wort stärker.",
  },
  place: {
    titel: "Decke",
    alltag: "Wenn es klingelt, Besuch oder die Enkel kommen und {dogName} zur Ruhe kommen soll.",
    schritte: [
      "Leg eine Decke an einen ruhigen Platz und wirf ein Leckerli darauf.",
      "Geht {dogName} auf die Decke: \"Decke\" sagen und ein zweites Leckerli direkt dort geben.",
      "Legt sich {dogName} hin, gibt es mehrere Leckerlis nacheinander, ganz ruhig.",
      "Übe es zu Zeiten, in denen nichts los ist, bevor du es beim Klingeln nutzt.",
      "Dann mit Klingel: Tür klingelt, Decke, belohnen, erst danach gehst du öffnen.",
    ],
    tipp: "Die Decke ist ein schöner Ort, nie eine Strafe. Dann geht {dogName} gern hin.",
  },
  sit: {
    titel: "Sitz",
    alltag: "Vor dem Anleinen, vor dem Futter und wenn jemand {dogName} begrüßen möchte.",
    schritte: [
      "Halte ein Leckerli vor die Nase von {dogName} und führe es langsam über den Kopf nach hinten.",
      "Geht der Po nach unten: \"Sitz\" sagen und sofort belohnen.",
      "Nach ein paar Tagen sagst du Sitz, bevor du die Hand bewegst.",
      "Übe es an verschiedenen Orten: Küche, Flur, Garten, Gehweg.",
      "Nutze Sitz als Höflichkeit: vor dem Napf, vor der Tür, vor dem Streicheln.",
    ],
    tipp: "Drück {dogName} nie nach unten. Selbst gefunden sitzt es viel besser.",
  },
  down: {
    titel: "Platz",
    alltag: "Im Café, beim Arzt oder wenn ihr unterwegs warten müsst.",
    schritte: [
      "Aus dem Sitz führst du ein Leckerli langsam von der Nase senkrecht zum Boden.",
      "Liegt {dogName}: \"Platz\" sagen und das Leckerli zwischen den Pfoten geben.",
      "Bleib ein paar Sekunden ruhig und gib noch ein Leckerli, solange {dogName} liegt.",
      "Übe es auf einer Unterlage, die du später mitnehmen kannst.",
      "Unterwegs erst an ruhigen Orten üben, dann im Café.",
    ],
    tipp: "Liegen ist für viele Hunde anstrengender als Sitzen. Kurze, entspannte Einheiten reichen.",
  },
};

/** Vier Kommandos für die Zusatzseiten, mit Hundenamen. */
export function buildKommandoTraining(dogName: string, bekannte: string[] = []): KommandoTraining[] {
  const name = (dogName || "").trim() || "dein Hund";
  const kann = new Set((bekannte || []).filter((k) => k !== "none"));
  const fehlend = REIHENFOLGE.filter((k) => !kann.has(k));
  const auffrischen = REIHENFOLGE.filter((k) => kann.has(k));
  const auswahl = [...fehlend, ...auffrischen].slice(0, 4);
  const p = (s: string) => s.split("{dogName}").join(name);
  return auswahl.map((key) => {
    const v = VORLAGEN[key];
    return {
      key,
      titel: v.titel,
      alltag: p(v.alltag),
      schritte: v.schritte.map(p),
      tipp: p(v.tipp),
      neu: !kann.has(key),
    };
  });
}
