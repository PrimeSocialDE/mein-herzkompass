// Inhalte des Produkts "Was dein Hund dir sagen will — Körpersprache lesen"
// (19,90 €, Käufer-Cross-Sell). Fester, selbst recherchierter Experten-Inhalt
// (Beschwichtigungs-, Stress- und Warnsignale nach allgemein anerkanntem
// Verhaltenswissen); personalisiert werden nur Titel, Einleitung und die
// Seite "Deine wichtigsten Signale" (je nach dog_problem).
//
// Zeichensatz: nur WinAnsi (pdf-lib StandardFonts) — keine Emojis, keine
// Pfeile. Erlaubt: ä ö ü ß „ “ – —

export type Ampel = "gruen" | "gelb" | "rot";

export interface Signal {
  key: string;
  bild: string; // Dateiname in public/koerpersprache/
  titel: string;
  ampel: Ampel;
  siehst: string; // Was du siehst
  bedeutet: string; // Was es meistens bedeutet
  tust: string; // Was du jetzt tust
  irrtum?: string; // Häufiger Irrtum
}

export const AMPEL_TEXT: Record<Ampel, { label: string; kurz: string }> = {
  gruen: { label: "Grün", kurz: "entspannt, alles gut" },
  gelb: { label: "Gelb", kurz: "unwohl, will die Lage beruhigen" },
  rot: { label: "Rot", kurz: "Warnung, jetzt Abstand schaffen" },
};

export const SIGNALE: Signal[] = [
  // ── Grün ──────────────────────────────────────────────────────────
  {
    key: "entspannt", bild: "k01.jpg", titel: "Weiche Augen, lockeres Maul", ampel: "gruen",
    siehst: "Der Blick ist weich, die Augen eher mandelförmig. Das Maul ist leicht geöffnet, die Zunge liegt locker. Der ganze Körper wirkt beweglich, nicht steif.",
    bedeutet: "Dein Hund fühlt sich wohl. So sieht ein Hund aus, der gerade nichts braucht und nichts befürchtet.",
    tust: "Merk dir genau dieses Bild. Es ist die Grundlinie deines Hundes. Jede Veränderung davon ist eine Information.",
  },
  {
    key: "spiel", bild: "k02.jpg", titel: "Vorderkörper tief, Hinterteil hoch", ampel: "gruen",
    siehst: "Die Vorderbeine liegen gestreckt am Boden, das Hinterteil ist oben, oft mit wedelnder Rute und hüpfenden Bewegungen.",
    bedeutet: "Eine Spielaufforderung. Sie sagt auch: Was jetzt kommt, ist Spaß und nicht ernst gemeint.",
    tust: "Mitspielen ist erlaubt. Achte darauf, dass beide Seiten Pausen machen und die Rollen wechseln. Kippt das Spiel, unterbrich kurz.",
  },
  {
    key: "ruecken", bild: "k17.jpg", titel: "Auf dem Rücken liegen", ampel: "gruen",
    siehst: "Der Hund liegt auf dem Rücken, der Bauch ist frei.",
    bedeutet: "Ist der Körper weich und locker, ist das Entspannung oder eine Einladung zum Kraulen. Ist er steif, die Rute eingeklemmt und der Blick abgewandt, ist es Beschwichtigung: Bitte tu mir nichts.",
    tust: "Schau auf den Rest des Körpers, bevor du hinfasst. Bei Steifheit nicht kraulen, sondern Abstand geben.",
    irrtum: "„Er will immer am Bauch gekrault werden.“ Nicht jedes Rückenliegen ist eine Einladung.",
  },
  // ── Gelb ──────────────────────────────────────────────────────────
  {
    key: "gaehnen", bild: "k03.jpg", titel: "Gähnen", ampel: "gelb",
    siehst: "Dein Hund gähnt, obwohl er nicht müde ist, zum Beispiel beim Tierarzt, bei einer Umarmung oder wenn du schimpfst.",
    bedeutet: "Gähnen in solchen Momenten ist ein Beruhigungssignal. Der Hund beruhigt sich selbst und zeigt: Ich will keinen Ärger.",
    tust: "Nimm Druck raus. Sprich leiser, geh einen Schritt zurück, beende die Situation, wenn möglich.",
    irrtum: "„Der ist nur müde.“ Wenn das Gähnen in einer angespannten Lage kommt, ist es fast nie Müdigkeit.",
  },
  {
    key: "lecken", bild: "k04.jpg", titel: "Über die Nase lecken", ampel: "gelb",
    siehst: "Die Zunge schnellt kurz heraus und leckt über Nase oder Lefzen, ohne dass es etwas zu essen gibt.",
    bedeutet: "Ein leises Stresssignal. Dein Hund fühlt sich gerade nicht wohl, zum Beispiel weil sich jemand über ihn beugt.",
    tust: "Ändere, was du gerade tust. Beug dich nicht über ihn, sondern geh seitlich in die Hocke oder lass ihm Raum.",
  },
  {
    key: "abwenden", bild: "k05.jpg", titel: "Kopf oder Blick abwenden", ampel: "gelb",
    siehst: "Der Hund dreht den Kopf zur Seite oder schaut weg, wenn ihn ein Mensch oder Hund direkt anschaut.",
    bedeutet: "Höflichkeit unter Hunden: Ich will keinen Konflikt. Direktes Anstarren ist für Hunde eher bedrohlich.",
    tust: "Respektiere das. Schau selbst nicht starr, nähere dich lieber im Bogen. Bei Hundebegegnungen ist Wegschauen ein gutes Zeichen, das du belohnen kannst.",
  },
  {
    key: "schnueffeln", bild: "k06.jpg", titel: "Plötzlich schnüffeln", ampel: "gelb",
    siehst: "Mitten in einer Begegnung schnüffelt der Hund intensiv am Boden, obwohl dort nichts Besonderes ist.",
    bedeutet: "Oft eine Übersprungshandlung: Der Hund ist unsicher und weicht dem Konflikt aus.",
    tust: "Lass ihn schnüffeln und zieh ihn nicht zum anderen Hund. Er löst die Situation gerade selbst, und das ist klug.",
  },
  {
    key: "schuetteln", bild: "k07.jpg", titel: "Schütteln, obwohl er trocken ist", ampel: "gelb",
    siehst: "Der Hund schüttelt sich einmal kräftig am ganzen Körper, wie nach dem Baden.",
    bedeutet: "Er schüttelt Anspannung ab. Meist kommt das direkt nach einer stressigen Situation.",
    tust: "Ein gutes Zeichen, dass er sich wieder fängt. Gib ihm einen Moment Ruhe, bevor es weitergeht.",
  },
  {
    key: "pfote", bild: "k15.jpg", titel: "Pfote anheben", ampel: "gelb",
    siehst: "Im Stehen oder Sitzen hebt der Hund eine Vorderpfote leicht an, oft mit gesenktem Kopf.",
    bedeutet: "Unsicherheit: Er weiß gerade nicht, was als Nächstes passiert.",
    tust: "Mach es ihm leicht. Gib ein klares, einfaches Signal, das er kennt, oder nimm ihn aus der Situation.",
  },
  {
    key: "hecheln", bild: "k16.jpg", titel: "Hecheln ohne Hitze", ampel: "gelb",
    siehst: "Der Hund hechelt stark, obwohl es nicht warm ist und er sich nicht bewegt hat. Oft mit weit geöffneten Augen.",
    bedeutet: "Stress, zum Beispiel im Auto, beim Tierarzt oder bei Gewitter.",
    tust: "Reize reduzieren, ruhig bleiben, ihm einen Rückzugsort anbieten. Hechelt er oft ohne Grund, lass ihn tierärztlich anschauen.",
  },
  {
    key: "walauge", bild: "k08.jpg", titel: "Das Weiße im Auge", ampel: "gelb",
    siehst: "Der Kopf ist leicht abgewandt, die Augen schauen aber zur Seite zurück. Man sieht das Weiße im Auge, als Halbmond.",
    bedeutet: "Ein deutliches Unwohlsein. Kommt oft vor, wenn ein Hund festgehalten, umarmt oder an seinem Platz bedrängt wird.",
    tust: "Sofort Druck rausnehmen und loslassen. Dieses Signal kommt häufig kurz vor dem Erstarren oder Knurren.",
    irrtum: "„Der guckt nur komisch.“ Das Weiße im Auge ist eines der wichtigsten Warnzeichen.",
  },
  {
    key: "angst", bild: "k09.jpg", titel: "Ohren zurück, Rute eingeklemmt", ampel: "gelb",
    siehst: "Der Körper ist geduckt, die Ohren liegen flach am Kopf, die Rute ist zwischen den Hinterbeinen. Der Hund lehnt sich weg.",
    bedeutet: "Angst. Der Hund möchte weg aus der Situation.",
    tust: "Nicht trösten durch Festhalten und nicht zwingen. Abstand schaffen, ruhig bleiben, einen Ausweg anbieten.",
  },
  // ── Rot ───────────────────────────────────────────────────────────
  {
    key: "erstarren", bild: "k10.jpg", titel: "Erstarren", ampel: "rot",
    siehst: "Der Hund wird plötzlich völlig still und steif, oft mitten in einer Bewegung. Das Maul ist geschlossen.",
    bedeutet: "Ein ernstes Signal: Er überlegt gerade, wie es weitergeht. Danach kommt oft Knurren, Abschnappen oder ein Ausfall.",
    tust: "Sofort alles stoppen, was du gerade tust. Langsam Abstand schaffen, nicht nach ihm greifen.",
  },
  {
    key: "fixieren", bild: "k11.jpg", titel: "Fixieren", ampel: "rot",
    siehst: "Ein harter, starrer Blick auf einen anderen Hund oder Menschen. Der Kopf ist oft gesenkt und nach vorne gestreckt.",
    bedeutet: "Volle Konzentration auf ein Ziel. An der Leine kommt danach häufig der Ausfall.",
    tust: "Jetzt handeln, nicht erst beim Bellen: Blick unterbrechen, Bogen laufen, Abstand vergrößern. Je früher, desto leichter.",
  },
  {
    key: "rute-steif", bild: "k18.jpg", titel: "Rute hoch und steif wedeln", ampel: "rot",
    siehst: "Die Rute steht hoch und wedelt schnell und kurz, der Körper ist dabei angespannt.",
    bedeutet: "Hohe Erregung, keine Freude. Kann in Spiel kippen, aber genauso in einen Konflikt.",
    tust: "Situation entschärfen, bevor sie kippt. Kurz Abstand, ruhig ansprechen, erst weitergehen, wenn der Körper weicher wird.",
    irrtum: "„Er wedelt doch, also freut er sich.“ Wedeln heißt nur Erregung. Ob freudig oder nicht, zeigt der Rest des Körpers.",
  },
  {
    key: "buerste", bild: "k12.jpg", titel: "Aufgestelltes Fell (Bürste)", ampel: "rot",
    siehst: "Die Haare entlang von Nacken und Rücken stellen sich auf.",
    bedeutet: "Starke Erregung. Das kann Angst, Unsicherheit oder Aufregung sein, nicht zwingend Aggression.",
    tust: "Nimm es ernst: Reize reduzieren und Abstand schaffen. Schau, was der Rest des Körpers sagt.",
  },
  {
    key: "zaehne", bild: "k13.jpg", titel: "Lefzen hochziehen, Zähne zeigen", ampel: "rot",
    siehst: "Die Lefzen werden hochgezogen, die Nase kräuselt sich, die Zähne sind sichtbar.",
    bedeutet: "Eine klare Warnung: Hör auf, sonst muss ich mich wehren.",
    tust: "Sofort zurückweichen, ohne hektische Bewegungen. Nicht strafen. Danach überlegen, was ihn so weit gebracht hat.",
  },
  {
    key: "knurren", bild: "k14.jpg", titel: "Knurren", ampel: "rot",
    siehst: "Ein tiefes, grollendes Geräusch, oft bei Futter, Spielzeug, am Liegeplatz oder wenn man ihn bedrängt.",
    bedeutet: "Kommunikation, keine Unart. Dein Hund sagt dir deutlich, dass es ihm zu viel ist, bevor er handeln muss.",
    tust: "Abstand nehmen und die Ursache angehen, zum Beispiel mit Training am Futternapf. Knurren niemals bestrafen.",
    irrtum: "„Knurren muss man abstellen.“ Wer Knurren bestraft, bekommt einen Hund, der ohne Vorwarnung schnappt.",
  },
];

export const SIGNAL_BY_KEY: Record<string, Signal> = Object.fromEntries(SIGNALE.map((s) => [s.key, s]));

// Kostprobe in der Kampagnen-Mail (gratis, 3 Signale)
export const KOSTPROBE_KEYS = ["gaehnen", "walauge", "knurren"];

// ── Personalisierung nach dog_problem ───────────────────────────────
export const PROBLEM_LABEL: Record<string, string> = {
  pulling: "Ziehen an der Leine",
  "leash-reactive": "Pöbeln an der Leine",
  "dog-reactive": "Reaktion auf andere Hunde",
  barking: "Bellen",
  aggression: "Aggression",
  anxiety: "Angst und Alleinbleiben",
  separation: "Alleinbleiben",
  jumping: "Anspringen",
  recall: "den Rückruf",
  energy: "zu viel Energie",
  destructive: "Zerstören",
  soiling: "Stubenreinheit",
  mouthing: "Aufnehmen vom Boden",
};

export const PROBLEM_FOKUS: Record<string, { keys: string[]; text: string }> = {
  pulling: { keys: ["fixieren", "rute-steif", "schnueffeln", "abwenden"], text: "Beim Ziehen geht es oft um Erregung. Wenn du merkst, wann sie steigt, kannst du vorher gegensteuern, statt erst am Ende der Leine zu reagieren." },
  "leash-reactive": { keys: ["fixieren", "erstarren", "buerste", "abwenden"], text: "Ein Ausfall an der Leine kommt fast nie aus dem Nichts. Davor gibt es Sekunden mit klaren Signalen. Wer sie sieht, kann ausweichen, bevor es knallt." },
  "dog-reactive": { keys: ["fixieren", "erstarren", "buerste", "abwenden"], text: "Begegnungen kippen meist in kleinen Schritten. Diese vier Signale zeigen dir den Moment, in dem du noch gut eingreifen kannst." },
  aggression: { keys: ["walauge", "erstarren", "zaehne", "knurren"], text: "Aggressives Verhalten hat fast immer eine Vorwarnkette. Diese Signale sind deine Frühwarnung, damit es gar nicht erst so weit kommt." },
  barking: { keys: ["fixieren", "rute-steif", "hecheln", "abwenden"], text: "Bellen ist oft die letzte Stufe von Erregung oder Unsicherheit. Die Signale davor zeigen dir, wann du ihn noch erreichst." },
  anxiety: { keys: ["angst", "hecheln", "lecken", "gaehnen"], text: "Ängstliche Hunde zeigen ihre Angst zuerst leise. Wer diese Signale erkennt, kann früh helfen, statt erst bei Panik." },
  separation: { keys: ["hecheln", "lecken", "gaehnen", "angst"], text: "Stress beim Alleinbleiben beginnt oft schon, wenn du die Schuhe anziehst. Diese Signale zeigen dir, wie es ihm wirklich geht." },
  jumping: { keys: ["rute-steif", "spiel", "lecken", "abwenden"], text: "Anspringen ist meist Aufregung pur. Wenn du die Erregung früh siehst, kannst du ihm vorher ein ruhiges Verhalten anbieten." },
  recall: { keys: ["fixieren", "schnueffeln", "abwenden", "erstarren"], text: "Kurz bevor ein Hund nicht mehr hört, verändert sich sein Körper. Wer das sieht, ruft früher und hat deutlich bessere Chancen." },
  energy: { keys: ["rute-steif", "spiel", "hecheln", "schuetteln"], text: "Viel Energie heißt oft hohe Erregung. Diese Signale zeigen dir, wann Spiel in Überdrehtheit kippt und eine Pause gut tut." },
  destructive: { keys: ["hecheln", "lecken", "gaehnen", "angst"], text: "Zerstören ist häufig Stress oder Langeweile. Die Signale verraten dir, was bei deinem Hund dahintersteckt." },
  soiling: { keys: ["schnueffeln", "angst", "lecken", "gaehnen"], text: "Unsauberkeit hat manchmal mit Unsicherheit zu tun. Diese Signale helfen dir, Stress als Ursache zu erkennen oder auszuschließen." },
  mouthing: { keys: ["schnueffeln", "fixieren", "erstarren", "knurren"], text: "Wer früh sieht, dass der Hund etwas am Boden fixiert, kann rechtzeitig umlenken, bevor er es aufnimmt oder verteidigt." },
};
export const FOKUS_DEFAULT = { keys: ["gaehnen", "walauge", "erstarren", "knurren"], text: "Diese vier Signale sind die wichtigsten im Alltag: Sie zeigen dir früh, wenn deinem Hund etwas zu viel wird." };

// ── Feste Textseiten ────────────────────────────────────────────────
export const GRUNDREGELN = [
  { titel: "Immer das ganze Bild ansehen", text: "Ein einzelnes Signal sagt wenig. Erst Rute, Ohren, Maul, Blick und Körperspannung zusammen ergeben die Aussage." },
  { titel: "Auf die Situation achten", text: "Gähnen auf dem Sofa ist Müdigkeit, Gähnen beim Tierarzt ist Stress. Frag dich immer: Was ist gerade los?" },
  { titel: "Veränderungen zählen", text: "Kenne den entspannten Normalzustand deines Hundes. Jede Abweichung davon ist eine Nachricht an dich." },
];

export const IRRTUEMER = [
  { glaube: "„Er wedelt, also freut er sich.“", wahr: "Wedeln zeigt Erregung. Freude erkennst du am lockeren, schwingenden Körper." },
  { glaube: "„Er weiß genau, dass er was falsch gemacht hat.“", wahr: "Der „schuldbewusste Blick“ ist Beschwichtigung auf deinen Ton und deine Haltung, keine Reue." },
  { glaube: "„Knurren darf man nicht durchgehen lassen.“", wahr: "Knurren ist eine Warnung. Wird sie bestraft, fällt sie weg, und der Hund schnappt ohne Vorwarnung." },
  { glaube: "„Er will am Bauch gekrault werden.“", wahr: "Nur wenn der Körper locker ist. Steifes Rückenliegen bedeutet: Bitte lass mich in Ruhe." },
  { glaube: "„Die spielen nur.“", wahr: "Echtes Spiel hat Pausen und Rollenwechsel. Jagt immer nur einer den anderen, ist es kein Spiel mehr." },
];

export const REGELN_VERHALTEN = [
  { titel: "Früh reagieren", text: "Je früher du ein Signal siehst, desto leichter ist es. Bei Gelb reicht oft ein Schritt zur Seite, bei Rot brauchst du schon viel Abstand." },
  { titel: "Abstand ist dein bestes Werkzeug", text: "Fast jede schwierige Situation entspannt sich, wenn du Abstand schaffst. Bogen laufen, umdrehen, Platz machen." },
  { titel: "Warnsignale nie bestrafen", text: "Knurren, Zähne zeigen und Erstarren sind Gespräche. Bestrafst du sie, verlierst du deine Frühwarnung." },
  { titel: "Ruhe überträgt sich", text: "Hunde lesen auch uns. Ruhige Bewegungen, leise Stimme und lockere Leine helfen deinem Hund mehr als Worte." },
];

export const SITUATIONEN = [
  {
    titel: "Begegnung mit einem anderen Hund",
    schritte: [
      "Gelb: Dein Hund schaut weg oder schnüffelt plötzlich. Gut so, lass ihn und lob ihn ruhig.",
      "Gelb wird ernster: Er bleibt am anderen Hund hängen. Jetzt Bogen laufen oder Abstand vergrößern.",
      "Rot: Er fixiert, erstarrt oder die Bürste steht. Umdrehen und weggehen, ohne Diskussion.",
    ],
  },
  {
    titel: "Besuch kommt",
    schritte: [
      "Plane einen ruhigen Rückzugsort ein, an dem ihn niemand stört.",
      "Bitte Gäste, ihn erst zu ignorieren. Der Hund darf entscheiden, ob er Kontakt möchte.",
      "Leckt er sich über die Nase, gähnt oder wendet sich ab: Er braucht Pause, nicht Streicheln.",
    ],
  },
  {
    titel: "Kinder und Enkel",
    schritte: [
      "Kinder sollten Hunde nie umarmen, sich über sie beugen oder sie am Liegeplatz stören.",
      "Achte besonders auf das Weiße im Auge, Erstarren und Lefzenlecken. Das sind die Signale vor einem Schnappen.",
      "Hund und Kind nie unbeaufsichtigt lassen, auch nicht beim liebsten Familienhund.",
    ],
  },
  {
    titel: "Beim Tierarzt",
    schritte: [
      "Hecheln, Gähnen und Pfote heben sind hier normal. Sie zeigen Stress, nicht Ungehorsam.",
      "Bleib ruhig neben ihm und sprich leise. Eine bekannte Decke hilft oft.",
      "Bei Rot-Signalen sag es dem Tierarzt. Ein Maulkorb, den er vorher kennt, schützt alle.",
    ],
  },
];

export const BEOBACHTUNGSPLAN = [
  "Tag 1: Beobachte deinen Hund 10 Minuten in Ruhe. Wie sieht er entspannt aus? Notiere Ohren, Rute und Maul.",
  "Tag 2: Achte auf dem Spaziergang nur auf Gähnen und Nase lecken. Wann kommen sie?",
  "Tag 3: Beobachte eine Begegnung mit einem anderen Hund. Was passiert vorher, was danach?",
  "Tag 4: Achte darauf, wie er reagiert, wenn du dich über ihn beugst. Probiere stattdessen seitliches Hinhocken.",
  "Tag 5: Schau, wann seine Rute hoch geht. Bei Freude oder bei Anspannung?",
  "Tag 6: Notiere eine Situation, in der er unsicher war. Was hätte ihm geholfen?",
  "Tag 7: Vergleiche mit Tag 1. Was siehst du jetzt, was dir vorher nie aufgefallen ist?",
];

export const SPICKZETTEL = [
  { signal: "Das Weiße im Auge", tun: "Loslassen, Druck rausnehmen" },
  { signal: "Erstarren", tun: "Alles stoppen, langsam Abstand" },
  { signal: "Fixieren", tun: "Blick unterbrechen, Bogen laufen" },
  { signal: "Zähne zeigen", tun: "Zurückweichen, nicht strafen" },
  { signal: "Knurren", tun: "Abstand nehmen, nie bestrafen" },
];

// ── Alltagssignale: "Was er von dir will" ───────────────────────────
// Gleiche Karten-Optik wie die Signale, aber mit Fokus auf das Bedürfnis.
export const ALLTAG: Signal[] = [
  {
    key: "tuer", bild: "k21.jpg", titel: "Kratzen an der Tür", ampel: "gelb",
    siehst: "Er kratzt an der Haustür oder Terrassentür, läuft zur Tür und schaut zu dir zurück.",
    bedeutet: "Meistens: Ich muss raus. Manchmal auch: Draußen ist etwas Spannendes, oder du bist gerade weg und er will hinterher.",
    tust: "Zuerst die Toilette ausschließen: Wann war er zuletzt draußen? Wenn ja, geh ruhig mit ihm raus, ohne großes Theater. Wenn nein, öffne nicht sofort, sonst lernt er: Kratzen öffnet Türen. Bring ihm lieber ein ruhiges Signal bei, zum Beispiel sich an die Tür setzen. Öffne dann und belohne genau das.",
    irrtum: "„Er will mich ärgern.“ Kratzen ist fast immer ein Bedürfnis, das er dir mitteilt. Du bestimmst nur, welches Signal dafür funktioniert.",
  },
  {
    key: "winseln", bild: "k22.jpg", titel: "Winseln und Fiepen", ampel: "gelb",
    siehst: "Ein hohes Fiepen, oft mit Blick zu dir, Unruhe oder Hin- und Herlaufen.",
    bedeutet: "Ein Bedürfnis oder eine Unruhe: Toilette, Durst, Langeweile, Unsicherheit, manchmal auch Schmerzen.",
    tust: "Geh die Liste kurz durch: draußen gewesen, Wasser da, warm genug, etwas Ungewohntes passiert? Ist alles erfüllt, reagiere nicht auf jedes Fiepen mit Aufmerksamkeit. Belohne lieber den ruhigen Moment danach. Winselt er ungewohnt oft oder in Ruhe, lass ihn tierärztlich anschauen.",
  },
  {
    key: "leine", bild: "k23.jpg", titel: "Leine oder Spielzeug bringen", ampel: "gruen",
    siehst: "Er bringt dir die Leine, einen Ball oder legt Spielzeug vor deine Füße und schaut dich erwartungsvoll an.",
    bedeutet: "Eine klare, freundliche Einladung: Lass uns etwas zusammen machen. Ein Zeichen von guter Bindung.",
    tust: "Freu dich darüber. Wenn es gerade passt: kurzes Spiel oder Spaziergang. Wenn nicht: ruhig „Später“ sagen, das Spielzeug weglegen und ihm eine Alternative anbieten, zum Beispiel einen Kauartikel. So lernt er, dass Warten sich auch lohnt.",
  },
  {
    key: "anstupsen", bild: "k24.jpg", titel: "Anstupsen mit der Nase", ampel: "gruen",
    siehst: "Er stupst deine Hand oder deinen Arm mit der Nase an, oft wenn du sitzt oder beschäftigt bist.",
    bedeutet: "Er möchte Aufmerksamkeit: Streicheln, Spiel oder einfach Kontakt. Manchmal auch ein Hinweis auf ein Bedürfnis.",
    tust: "Gelegentlich darauf eingehen ist schön. Stupst er ständig, gib ihm Aufmerksamkeit lieber dann, wenn er ruhig neben dir liegt. So lernt er: Ruhe bringt Zuwendung, nicht Drängeln.",
  },
  {
    key: "unruhe", bild: "k25.jpg", titel: "Unruhiges Hin- und Herlaufen", ampel: "gelb",
    siehst: "Er läuft durch die Wohnung, legt sich hin, steht wieder auf, findet keine Ruhe.",
    bedeutet: "Ein Bedürfnis ist nicht erfüllt, oder er ist überdreht. Häufig nach zu wenig Auslastung, aber genauso nach zu viel Aufregung.",
    tust: "Frag dich: Hatte er heute zu wenig zu tun oder zu viel? Bei zu wenig: eine kurze Schnüffelrunde oder Suchspiel. Bei zu viel: Reize runter, Kauartikel, Ruhedecke. Hält die Unruhe ohne Grund an, besonders mit Hecheln oder aufgeblähtem Bauch, sofort zum Tierarzt.",
  },
  {
    key: "rennen", bild: "k26.jpg", titel: "Plötzliches Rennen durch die Wohnung", ampel: "gruen",
    siehst: "Er rast wie aufgezogen im Kreis, über das Sofa, durch den Flur, oft abends oder nach dem Baden.",
    bedeutet: "Überschüssige Energie oder Anspannung wird abgebaut. Meist harmlos und kurz.",
    tust: "Sorge dafür, dass er sich nicht verletzen kann, und lass es auslaufen. Nicht mitmachen und nicht anheizen. Passiert es sehr oft, braucht er tagsüber mehr Schnüffel- und Kopfarbeit oder mehr Ruhe.",
  },
];

// ── Zur Ruhe bringen ─────────────────────────────────────────────────
export const RUHE: { titel: string; warum: string; so: string[] }[] = [
  {
    titel: "Kauen und Schlecken",
    warum: "Kauen und Schlecken senken bei Hunden nachweislich die Anspannung. Es ist ihr eingebautes Beruhigungsprogramm.",
    so: ["Gib ihm einen passenden Kauartikel oder eine Schleckmatte mit etwas Quark.", "Am besten auf seiner Decke, damit er Decke und Ruhe verknüpft.", "Nicht als Belohnung fürs Bellen, sondern in ruhigen Momenten anbieten."],
  },
  {
    titel: "Schnüffeln lassen",
    warum: "Zehn Minuten Nasenarbeit machen müder als eine halbe Stunde Rennen und beruhigen gleichzeitig.",
    so: ["Streu eine Handvoll Futter in den Rasen oder auf einen Teppich.", "Lass ihn in Ruhe suchen, ohne Kommandos und ohne Hektik.", "Danach kommt meistens eine ruhige Phase."],
  },
  {
    titel: "Die Ruhedecke",
    warum: "Ein fester Platz, an dem nichts passiert, wird zum Signal: Hier ist Feierabend.",
    so: ["Leg eine Decke an einen ruhigen Ort, nicht mitten in den Durchgang.", "Belohne ihn ruhig, wenn er sich darauf legt. Erst Sekunden, dann Minuten.", "Auf der Decke wird er nie gestört, auch nicht von Kindern oder Besuch."],
  },
  {
    titel: "Langsam streicheln",
    warum: "Lange, ruhige Striche entlang des Körpers entspannen. Schnelles Tätscheln regt eher auf.",
    so: ["Streiche langsam von Kopf bis Rücken, nicht über den Kopf hinweg.", "Achte auf seine Signale: Lehnt er sich an, ist es gut. Wendet er sich ab, hör auf.", "Sprich dabei leise oder gar nicht."],
  },
  {
    titel: "Reize runterfahren",
    warum: "Ein überdrehter Hund kann nicht mehr denken. Weniger Eindrücke helfen ihm, wieder runterzukommen.",
    so: ["Fernseher leiser, Licht dimmen, Besuch kurz ignorieren lassen.", "Bring ihn in einen ruhigen Raum oder an seinen Rückzugsort.", "Kein Spiel, kein Toben, keine laute Stimme, bis er sich gefangen hat."],
  },
  {
    titel: "Pausen nach Aufregung",
    warum: "Nach einem stressigen Erlebnis braucht der Körper Zeit, bis die Anspannung abgebaut ist, oft Stunden.",
    so: ["Nach Tierarzt, Besuch oder einer schwierigen Begegnung: nicht gleich das nächste Programm.", "Plane danach eine ruhige Zeit mit Kauen oder Schlafen ein.", "Viele Hunde, die „nie zur Ruhe kommen“, haben einfach zu wenige solcher Pausen."],
  },
];

// ── Wenn er Auslauf braucht ───────────────────────────────────────────
export const AUSLASTUNG = {
  einleitung: "Ein ausgelasteter Hund ist nicht der, der am meisten gerannt ist, sondern der, der Körper, Nase und Kopf benutzen durfte und danach genug Ruhe bekommt.",
  arten: [
    { titel: "Bewegung", text: "Spaziergänge, bei denen er auch mal trödeln und schnüffeln darf. Nicht nur im Tempo des Menschen an der kurzen Leine." },
    { titel: "Nasenarbeit", text: "Futtersuche, Leckerli im Laub verstecken, eine Fährte legen. Die Nase ist das stärkste Organ deines Hundes und macht schnell zufrieden müde." },
    { titel: "Kopfarbeit", text: "Kleine Tricks, Pfote geben, Gegenstände unterscheiden. Fünf Minuten Denken ermüden mehr als eine Runde um den Block." },
  ],
  ideen: [
    "Futter nicht im Napf, sondern versteckt in der Wohnung oder im Garten",
    "Leckerli in ein zusammengerolltes Handtuch einwickeln",
    "Auf dem Spaziergang eine Bank als Übungsplatz: drauf, runter, warten",
    "Ein neues Wort pro Woche: Spielzeug beim Namen holen lassen",
    "Schnüffelrunde statt Strecke: 20 Minuten, aber er darf überall riechen",
  ],
  achtung: "Achtung: Mehr Ballwerfen macht viele Hunde nicht ruhiger, sondern aufgedrehter. Ständiges Jagen auf den Ball trainiert vor allem Kondition und Erregung. Lieber kurz werfen und danach suchen lassen.",
  ruhe: "Und ganz wichtig: Ruhe ist Teil der Auslastung. Viele erwachsene Hunde brauchen 15 Stunden und mehr Ruhe und Schlaf am Tag, Welpen und Senioren noch mehr. Wer nie zur Ruhe kommt, wird oft nicht durch mehr Programm ruhiger, sondern durch mehr Pausen.",
};

// ── Keine Panik: harmlos oder Tierarzt? ─────────────────────────────
// Bewusst vorsichtig formuliert: Orientierung, keine Diagnose.
export const KEINE_PANIK: { titel: string; bild?: string; was: string; tun: string; tierarzt: string }[] = [
  {
    titel: "Rückwärtsniesen", bild: "k27.jpg",
    was: "Dein Hund steht plötzlich still, streckt den Hals, die Augen werden groß, und er zieht laut schnorchelnd und schnaubend Luft durch die Nase ein. Das klingt, als würde er ersticken, dauert aber meist nur einige Sekunden bis etwa eine Minute. Auslöser sind oft Aufregung, Ziehen am Halsband, Staub, Pollen oder hastiges Trinken. Bei kleinen und kurznasigen Hunden kommt es besonders häufig vor.",
    tun: "Ruhig bleiben, denn deine Aufregung überträgt sich. Streichle ihm sanft über die Kehle, damit er schluckt, oder lenk ihn kurz ab. Meist ist der Anfall danach vorbei, und dein Hund verhält sich völlig normal. Ein Geschirr statt Halsband kann helfen, wenn es oft beim Spaziergang passiert.",
    tierarzt: "Wenn es sehr häufig oder immer länger auftritt, wenn Nasenausfluss oder Blut dazukommen, wenn er auch zwischen den Anfällen schlecht Luft bekommt oder Zahnfleisch und Zunge bläulich werden: sofort zum Tierarzt.",
  },
  {
    titel: "Zucken und Bellen im Schlaf",
    was: "Pfoten paddeln, die Lefzen zucken, manchmal ein leises Wuffen. Das ist Traumschlaf und völlig normal.",
    tun: "Schlafen lassen, nicht wecken und nicht anfassen. Erschrockene Hunde schnappen manchmal reflexartig.",
    tierarzt: "Wenn der Körper steif wird, er nicht ansprechbar ist, danach verwirrt wirkt oder Urin verliert. Das kann ein Krampfanfall sein.",
  },
  {
    titel: "Schluckauf",
    was: "Rhythmisches Hicksen, oft bei Welpen nach schnellem Fressen oder Aufregung.",
    tun: "Abwarten, in Ruhe trinken lassen. Langsamer füttern, zum Beispiel mit Schnüffelteppich, beugt vor.",
    tierarzt: "Wenn er stundenlang anhält, ständig wiederkommt oder mit Atemproblemen verbunden ist.",
  },
  {
    titel: "Gras fressen",
    was: "Viele Hunde fressen ab und zu Gras, manche erbrechen danach. Meist harmlos.",
    tun: "Achte darauf, dass die Wiese nicht gespritzt oder gedüngt ist.",
    tierarzt: "Wenn er hektisch Gras schlingt, mehrmals erbricht, Durchfall bekommt oder schlapp wirkt.",
  },
  {
    titel: "Schlittenfahren auf dem Po",
    was: "Er rutscht mit dem Hinterteil über den Boden. Häufig juckt es dort, zum Beispiel wegen voller Analdrüsen.",
    tun: "Kurz beobachten. Einmalig ist kein Grund zur Sorge.",
    tierarzt: "Wenn er es oft macht, sich ständig am Po leckt oder es dort gerötet oder geschwollen ist. Das lässt sich meist schnell beheben.",
  },
];
