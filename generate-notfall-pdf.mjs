import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { writeFileSync } from "fs";

const A4_W = 595.28;
const A4_H = 841.89;

const GOLD = rgb(196 / 255, 165 / 255, 118 / 255);
const DARK_BROWN = rgb(139 / 255, 115 / 255, 85 / 255);
const TEXT_DARK = rgb(26 / 255, 26 / 255, 26 / 255);
const TEXT_MEDIUM = rgb(100 / 255, 100 / 255, 100 / 255);
const WHITE = rgb(1, 1, 1);
const BG_LIGHT = rgb(250 / 255, 248 / 255, 245 / 255);
const BORDER_LIGHT = rgb(232 / 255, 220 / 255, 200 / 255);
const BG_WARM = rgb(254 / 255, 249 / 255, 243 / 255);

const karten = [
  {
    nr: 1,
    title: "Hund bellt an der T\u00fcr",
    situation: "Es klingelt und dein Hund rastet aus \u2013 bellt unkontrolliert, springt zur T\u00fcr und l\u00e4sst sich kaum beruhigen. Das stresst dich, deine Besucher und deinen Hund.",
    steps: [
      { title: "Ruhe-Signal geben", desc: "Sag ruhig und bestimmt \"Aus\" oder \"Ruhe\". Nicht schreien \u2013 das verst\u00e4rkt die Aufregung. Warte bis dein Hund dich anschaut." },
      { title: "Auf den Platz schicken", desc: "Schick deinen Hund auf seinen festen Platz (Decke, K\u00f6rbchen). Zeig ruhig mit der Hand dorthin. Wenn er sich hinlegt, best\u00e4tige mit \"Gut\" oder einem Leckerli." },
      { title: "Besuch managen", desc: "Bitte deinen Besuch kurz zu warten. Geh zur T\u00fcr, blockiere den Spalt mit deinem K\u00f6rper und \u00f6ffne erst, wenn dein Hund nicht mehr direkt davor steht. Realistisch: Das muss nicht perfekt sein \u2013 jede Sekunde Ruhe z\u00e4hlt." },
      { title: "Ruhiges Verhalten belohnen", desc: "Sobald dein Hund ruhig bleibt w\u00e4hrend du die T\u00fcr \u00f6ffnest, belohne ihn. Ignoriere jedes erneute Bellen komplett \u2013 dreh dich weg, kein Blickkontakt." },
      { title: "T\u00e4glich 5x ohne Besuch \u00fcben", desc: "Klingel selbst, schick deinen Hund auf den Platz. 5 Wiederholungen am Tag reichen. Nach 1\u20132 Wochen sitzt die Routine und es klappt auch mit echtem Besuch." },
    ],
    tipp: "Starte mit leisen Klingelt\u00f6nen und steigere die Intensit\u00e4t. So \u00fcberforderst du deinen Hund nicht.",
    wennNicht: [
      "Die Aufregung ist zu hoch? Geh 3 Schritte zur\u00fcck: \u00dcbe das Platz-Kommando erstmal OHNE Klingel, bis es zu 100% sitzt. Erst dann kombinierst du beides.",
      "Er geht nicht auf den Platz? Zwinge ihn nie \u2013 locke ihn mit einem Leckerli dorthin. Wiederhole es 10x am Tag ohne Stress, bis der Platz positiv besetzt ist.",
      "Es klappt nur ohne echten Besuch? Das ist normal! Steigere langsam: Erst klingeln ohne Besucher, dann mit bekannten Personen, dann mit Fremden.",
    ],
  },
  {
    nr: 2,
    title: "Hund zieht pl\u00f6tzlich los",
    situation: "Ihr geht entspannt spazieren und pl\u00f6tzlich zieht dein Hund mit voller Kraft in eine Richtung \u2013 ein Eichh\u00f6rnchen, ein anderer Hund oder ein interessanter Geruch.",
    steps: [
      { title: "Sofort stehenbleiben", desc: "Bleib wie eingefroren stehen. Geh keinen Schritt weiter in die Richtung, in die dein Hund zieht. Halte die Leine fest, aber zieh nicht zur\u00fcck \u2013 einfach stehen." },
      { title: "Warten bis Leine locker", desc: "Steh einfach still und warte. Irgendwann wird dein Hund aufh\u00f6ren zu ziehen \u2013 auch wenn es 30 Sekunden dauert. Geduld ist hier alles." },
      { title: "Richtungswechsel machen", desc: "Sobald die Leine locker ist, dreh dich um und geh in die andere Richtung. Sag dabei ruhig \"Hier lang\". Mach das konsequent jedes Mal." },
      { title: "Lockere Leine sofort belohnen", desc: "Sobald dein Hund neben dir l\u00e4uft mit lockerer Leine, lob ihn sofort: \"Super!\" oder gib ein Leckerli. So lernt er: lockere Leine = es geht weiter." },
      { title: "Alle 10\u201315 Schritte belohnen", desc: "In den ersten Wochen belohnst du alle 10\u201315 Schritte lockere Leine. Das klingt viel, aber es baut die Gewohnheit auf. Sp\u00e4ter reicht alle paar Minuten." },
    ],
    tipp: "Nimm hochwertige Leckerlis mit \u2013 K\u00e4se oder Wurst. Trockenfutter reicht gegen Eichh\u00f6rnchen nicht.",
    wennNicht: [
      "Der Reiz ist zu stark? \u00dcbe erstmal in einer reizarmen Umgebung (Garten, ruhige Stra\u00dfe). Wenn es dort klappt, steigere langsam.",
      "Er zieht trotzdem wie verr\u00fcckt? Ein Geschirr mit Brustring lenkt die Zugkraft zur Seite und macht Ziehen unbequem \u2013 das hilft vielen Hunden sofort.",
      "Du wirst fast umgerissen? Wickle die Leine NIE um die Hand. Halte sie fest mit beiden H\u00e4nden vor dem K\u00f6rper. Bei sehr starken Hunden: 3-Meter-Leine statt Flexi.",
    ],
  },
  {
    nr: 3,
    title: "Hund bellt anderen Hund an",
    situation: "Ihr begegnet einem anderen Hund und deiner bellt, knurrt oder zerrt an der Leine. Du wei\u00dft nicht, ob es Angst oder Aggression ist \u2013 aber es ist dir unangenehm.",
    steps: [
      { title: "Abstand vergr\u00f6\u00dfern", desc: "Geh sofort 3\u20135 Meter zur Seite oder dreh um. Dein Hund braucht mehr Abstand, um sich sicher zu f\u00fchlen. Finde die Distanz, bei der er den anderen sehen kann, ohne auszurasten." },
      { title: "Aufmerksamkeit auf dich lenken", desc: "Halt ein Leckerli vor die Nase und sag seinen Namen. Sobald er dich anschaut statt den anderen Hund, sag \"Ja!\" und gib das Leckerli." },
      { title: "Leckerli-Regen bei Hundebegegnung", desc: "Solange der andere Hund in Sichtweite ist, gibst du alle 2\u20133 Sekunden ein Leckerli. Dein Hund lernt: Anderer Hund = es regnet Leckerlis bei mir." },
      { title: "Im gro\u00dfen Bogen vorbeigehen", desc: "Geh in einem gro\u00dfen Bogen am anderen Hund vorbei. Du bist zwischen den Hunden. Lob deinen Hund f\u00fcr jede Sekunde Ruhe. Bleib selbst ruhig \u2013 dein Stress \u00fcbertr\u00e4gt sich." },
      { title: "Erfolg feiern und weitergehen", desc: "Wenn ihr vorbei seid: Gro\u00dfes Lob, Extra-Leckerli. Mach es zur positiven Erfahrung. Je \u00f6fter dein Hund ruhig vorbeikommt, desto normaler wird es." },
    ],
    tipp: "Starte mit 20+ Meter Abstand. Verringere den Abstand erst, wenn dein Hund 3x hintereinander ruhig bleibt.",
    wennNicht: [
      "Wichtig: Lass zuerst beim Tierarzt Schmerzen ausschlie\u00dfen. Hunde die Schmerzen haben, reagieren oft aggressiv auf andere \u2013 das ist eine h\u00e4ufige und \u00fcbersehene Ursache.",
      "Er nimmt kein Leckerli? Dann bist du zu nah dran. Vergr\u00f6\u00dfere den Abstand massiv \u2013 selbst 30 Meter. Arbeite dich \u00fcber Wochen n\u00e4her ran.",
      "Nimm die allerbesten Leckerlis mit (Leberwurst, K\u00e4se). Normales Trockenfutter reicht bei hohem Stresslevel nicht aus \u2013 du brauchst etwas, das st\u00e4rker ist als der Reiz.",
    ],
  },
  {
    nr: 4,
    title: "Hund springt Besucher an",
    situation: "Besuch kommt rein und dein Hund springt hoch, leckt Gesichter, ist komplett aufgedreht. Manche G\u00e4ste finden es s\u00fc\u00df, andere haben Angst.",
    steps: [
      { title: "Alle Besucher vorher briefen", desc: "Erkl\u00e4re JEDEM Besucher vorher die Regel: Kein Blickkontakt, kein Anfassen, wenn der Hund springt. Ein einziger der es \"s\u00fc\u00df\" findet, macht eine Woche Training kaputt." },
      { title: "Komplett ignorieren lassen", desc: "Jeder soll sich wegdrehen wenn dein Hund hochspringt. Arme verschr\u00e4nken, Blick zur Decke. Kein Schimpfen \u2013 auch negative Aufmerksamkeit ist Aufmerksamkeit." },
      { title: "Sitz einfordern", desc: "Sobald dein Hund mit allen vier Pfoten auf dem Boden ist, sag \"Sitz\". Wenn er sitzt, darf der Besucher ihn ruhig begr\u00fc\u00dfen \u2013 kurz streicheln, ruhige Stimme." },
      { title: "Bei R\u00fcckfall sofort abbrechen", desc: "Springt er wieder hoch, dreht sich der Besucher sofort wieder weg. Kein Hin und Her \u2013 die Regel ist glasklar: Vier Pfoten am Boden = Aufmerksamkeit." },
      { title: "Die ersten 2 Minuten managen", desc: "Die gr\u00f6\u00dfte Aufregung ist in den ersten 2 Minuten. Halte durch! Danach beruhigt sich dein Hund. Nach 1\u20132 Wochen versteht er: Sitzen bringt mehr als Springen." },
    ],
    tipp: "\u00dcbe auch alleine: Geh zur T\u00fcr raus, komm wieder rein. Ignorieren wenn er springt, belohnen wenn er sitzt.",
    wennNicht: [
      "Er h\u00f6rt gar nicht auf? Starte nicht mit echtem Besuch. \u00dcbe erstmal mit einer Person, die er gut kennt und bei der er weniger aufgeregt ist.",
      "Leine deinen Hund an, bevor Besuch kommt. So kann er physisch nicht hochspringen und lernt schneller, dass Sitzen die bessere Option ist.",
      "Dein Besuch h\u00e4lt sich nicht an die Regeln? Dann bitte den Besuch, erstmal drau\u00dfen zu warten, bis dein Hund sich beruhigt hat.",
    ],
  },
  {
    nr: 5,
    title: "Hund nimmt etwas vom Boden auf",
    situation: "Dein Hund schnappt sich beim Spaziergang etwas vom Boden \u2013 ein altes Br\u00f6tchen, etwas Undefinierbares, vielleicht sogar einen Giftk\u00f6der.",
    steps: [
      { title: "Ruhig bleiben", desc: "Nicht hektisch zugreifen \u2013 das macht deinen Hund nur schneller. Bleib stehen und atme kurz durch. Hektik = Wettbewerb f\u00fcr deinen Hund." },
      { title: "'Aus' sagen + Leckerli zeigen", desc: "Sag ruhig und bestimmt \"Aus\". Halt gleichzeitig ein hochwertiges Leckerli direkt vor die Nase (K\u00e4se, Leberwurst). Die meisten Hunde lassen los, wenn die Alternative besser ist." },
      { title: "Tauschen statt wegnehmen", desc: "Sobald er das Objekt fallen l\u00e4sst, sag \"Ja!\" und gib sofort das Leckerli. Nimm dann ruhig das Objekt auf. Nie nachjagen \u2013 das wird zum Spiel." },
      { title: "Zu Hause mit Spielzeug \u00fcben", desc: "\u00dcbe \"Aus\" t\u00e4glich mit Spielzeug. Gib ein Spielzeug, sag \"Aus\", halte ein Leckerli hin. Wenn er losl\u00e4sst = Leckerli + Spielzeug zur\u00fcck. So lernt er: Loslassen lohnt sich." },
      { title: "Vorausschauend laufen", desc: "Scanne den Boden 5 Meter voraus. Siehst du etwas Verd\u00e4chtiges, lenke deinen Hund vorher um. Vorbeugen ist einfacher als Reagieren." },
    ],
    tipp: "Bei Giftk\u00f6der-Verdacht: Maul vorsichtig \u00f6ffnen, nicht dr\u00fccken. Im Zweifel sofort zum Tierarzt.",
    wennNicht: [
      "Er l\u00e4sst absolut nichts los? Tausche gegen etwas noch Besseres. Leberwurst aus der Tube direkt vor die Nase ist f\u00fcr die meisten Hunde unwiderstehlich.",
      "\u00dcbe den Tausch hunderte Male zu Hause \u2013 erst mit langweiligen Gegenst\u00e4nden, dann mit immer spannenderen. Drau\u00dfen muss der Tausch Routine sein.",
      "Er schluckt sofort runter? Trainiere \"Zeig\" \u2013 dein Hund soll dir Fundst\u00fccke zeigen, OHNE sie aufzunehmen. Das braucht Zeit, verhindert aber das Schlucken.",
    ],
  },
  {
    nr: 6,
    title: "Hund jagt Jogger oder Radfahrer",
    situation: "Ein Jogger oder Radfahrer kommt vorbei und dein Hund will hinterher \u2013 zerrt an der Leine, bellt, dreht v\u00f6llig auf.",
    steps: [
      { title: "Fr\u00fch erkennen und vorbereiten", desc: "Sobald du einen Jogger oder Radfahrer siehst, nimm die Leine k\u00fcrzer (aber nicht straff). Stell dich seitlich hin, sodass dein Hund nicht direkt drauf zurennen kann." },
      { title: "Leckerli-Anker setzen", desc: "Sag ruhig \"Schau\" und halte ein Leckerli neben dein Gesicht. Dein Hund soll lernen: \"Schau\" bedeutet, dass es bei dir was Gutes gibt." },
      { title: "Sitz und Blickkontakt halten", desc: "Sag \"Sitz\" und halte den Blickkontakt. Solange dein Hund dich anschaut statt den Jogger, f\u00fctter alle 2\u20133 Sekunden ein Leckerli. Du bist die Party, nicht der Jogger." },
      { title: "Vorbeilassen und gro\u00df belohnen", desc: "Warte, bis der Jogger komplett vorbei ist. Dann: \"Fein!\" + gro\u00dfes Lob + Extra-Leckerli. Dein Hund lernt: Ruhig bleiben = was Gutes passiert." },
      { title: "Schleppleine als wichtigstes Tool", desc: "Bei Jagdtrieb ist eine 10m-Schleppleine dein bester Freund. Sie gibt deinem Hund Bewegungsfreiheit, aber du beh\u00e4ltst die Kontrolle. Befestige sie immer am Geschirr (nie am Halsband!) und lass sie am Boden schleifen \u2013 tritt drauf, wenn er lossprinten will." },
    ],
    tipp: "Finde eine Strecke, wo regelm\u00e4\u00dfig Jogger laufen, und \u00fcbe dort gezielt mit Schleppleine. Wiederholung ist der Schl\u00fcssel.",
    wennNicht: [
      "Er dreht trotz Leckerli durch? Der Jagdtrieb ist einer der st\u00e4rksten Instinkte. Starte mit Videos von Joggern auf dem Handy \u2013 belohne ruhiges Zuschauen. Dann aus gro\u00dfer Entfernung echte Jogger.",
      "Impulskontrolle separat \u00fcben: Leckerli auf den Boden, Hund muss warten, erst auf Signal fressen. Das st\u00e4rkt die Selbstbeherrschung und hilft bei jedem Reiz \u2013 nicht nur bei Joggern.",
      "Lass die Schleppleine NIE ruckartig straff werden \u2013 das verletzt den Hund. Tritt sanft drauf oder bremse mit der Hand (Handschuhe tragen!). \u00dcbung macht den Meister.",
    ],
  },
  {
    nr: 7,
    title: "Hund bellt im Auto",
    situation: "Dein Hund bellt ununterbrochen im Auto \u2013 bei jedem Fu\u00dfg\u00e4nger, jedem Hund, jeder Ampel. Autofahren wird zum Horrortrip.",
    steps: [
      { title: "Sichtfeld einschr\u00e4nken", desc: "Deck die Fenster ab (Sonnenschutz, Decke). Weniger Reize = weniger Bellen. Eine Transportbox, wo er weniger sieht und sich sicher f\u00fchlt, ist ideal." },
      { title: "Im stehenden Auto \u00fcben", desc: "Sitz mit deinem Hund im geparkten Auto. Motor aus. Wenn er ruhig ist: Leckerli. Wenn er bellt: warten, ignorieren. Sobald er aufh\u00f6rt (auch nur 3 Sekunden): sofort belohnen." },
      { title: "Motor an, gleiche \u00dcbung", desc: "Wenn das stehende Auto klappt, mach den Motor an. Gleiche Regeln: Ruhe = Leckerli, Bellen = ignorieren. Erst wenn das sitzt, fahre los." },
      { title: "Kurze Fahrten aufbauen", desc: "Fahr nur 2 Minuten, dann Pause. Wenn dein Hund ruhig bleibt: aussteigen, gro\u00dfes Lob, kurzer Spaziergang. Steigere die Fahrtzeit \u00fcber Tage langsam." },
      { title: "Besch\u00e4ftigung anbieten", desc: "Ein gef\u00fcllter Kong oder Kauknochen wirkt im Auto Wunder. Dein Hund ist besch\u00e4ftigt und hat weniger Energie zum Bellen. Gib den Kong NUR im Auto \u2013 so wird Autofahren positiv." },
    ],
    tipp: "Fahr anfangs nur zu tollen Orten (Wald, Hundewiese). So verkn\u00fcpft dein Hund Autofahren mit positiven Erlebnissen.",
    wennNicht: [
      "Er bellt trotz abgedeckter Fenster? Er h\u00f6rt die Ger\u00e4usche. Spiel ruhige Musik oder einen Podcast ab, um Au\u00dfenger\u00e4usche zu \u00fcberdecken.",
      "Wenn er in der Box bellt: Decke \u00fcber die Box. Manche Hunde sind im Auto extrem gestresst \u2013 dann fahre erstmal nur die Auffahrt hoch und runter.",
      "Dein Hund \u00fcbergibt sich im Auto? Das ist kein Verhaltensproblem, sondern Reisekrankheit. Sprich mit deinem Tierarzt \u00fcber Mittel dagegen.",
    ],
  },
  {
    nr: 8,
    title: "Hund knurrt beim Fressen",
    situation: "Dein Hund knurrt oder schnappt, wenn du dich dem Fressnapf n\u00e4herst. Du hast Angst, gebissen zu werden \u2013 besonders wenn Kinder im Haus sind.",
    steps: [
      { title: "Kinder & Mitbewohner sofort sch\u00fctzen", desc: "Allerwichtigste Regel: Solange dein Hund am Napf knurrt, d\u00fcrfen Kinder NICHT in die N\u00e4he. Auch keine Ausnahmen. F\u00fcttere an einem ruhigen Ort, wo niemand versehentlich vorbeikommt." },
      { title: "Abstand halten und respektieren", desc: "Das Knurren ist eine Warnung \u2013 respektiere sie. Geh 2\u20133 Meter zur\u00fcck. Niemals den Napf wegnehmen um zu zeigen, wer der Chef ist \u2013 das macht es deutlich schlimmer." },
      { title: "Aus Distanz etwas Gutes reinwerfen", desc: "Geh in sicherem Abstand am Napf vorbei und wirf etwas Leckeres hinein (K\u00e4sest\u00fcck, H\u00fchnchen). Nicht die Hand reinhalten! So lernt er: Mensch kommt n\u00e4her = mein Futter wird BESSER." },
      { title: "Positive Verkn\u00fcpfung aufbauen", desc: "Wiederhole das bei jeder Mahlzeit. \u00dcber Wochen den Abstand langsam verringern: Erst 2 Meter, dann 1,5, dann 1. Immer mit Belohnung. \u00dcberst\u00fcrze nichts." },
      { title: "Aus der Hand f\u00fcttern", desc: "F\u00fcttere eine Zeitlang Teile der Mahlzeit direkt aus der Hand. So wirst du zur Quelle des Futters statt zur Bedrohung. Dein Hund baut Vertrauen auf, dass du ihm nichts wegnimmst." },
    ],
    tipp: "Trenne Fressplatz und Familienbereich klar. Ein fester, ruhiger Futterort reduziert Stress beim Fressen enorm \u2013 f\u00fcr alle.",
    wennNicht: [
      "Dein Hund schnappt bereits? Das ist KEIN Versagen \u2013 Ressourcenverteidigung ist ein ernstes Thema. Hol dir professionelle Hilfe von einem zertifizierten Hundetrainer.",
      "Bis dahin: F\u00fcttere an einem festen Ort, st\u00f6re nicht, und halte Kinder fern. Sicherheit geht immer vor Training.",
      "Du f\u00fchlst dich unsicher? Vertraue deinem Gef\u00fchl. Es ist okay, sich Hilfe zu holen. Manche Probleme brauchen einen Profi vor Ort.",
    ],
  },
  {
    nr: 9,
    title: "Hund dreht durch bei Gewitter",
    situation: "Es donnert und dein Hund zittert, hechelt, versteckt sich oder bellt panisch. Du willst helfen, aber wei\u00dft nicht, was er jetzt braucht.",
    steps: [
      { title: "Ruhigen R\u00fcckzugsort bieten", desc: "Bring deinen Hund in einen innenliegenden Raum mit wenig Fenstern. Schlie\u00df Vorh\u00e4nge, leg seine Lieblingsdecke hin. Wenn er unter den Tisch will \u2013 lass ihn." },
      { title: "Ger\u00e4usche \u00fcberdecken", desc: "Mach leise Musik oder den Fernseher an, um den Donner zu \u00fcberdecken. Ruhige, gleichm\u00e4\u00dfige Kl\u00e4nge funktionieren am besten." },
      { title: "Ruhig da sein und Sicherheit geben", desc: "Du darfst deinen Hund ruhig streicheln und bei ihm sein \u2013 das verst\u00e4rkt die Angst nicht. Wichtig ist nur: Bleib selbst entspannt. Hektisches Tr\u00f6sten oder aufgeregtes Reden \u00fcbertr\u00e4gt DEINE Nervosit\u00e4t auf ihn." },
      { title: "Normalit\u00e4t vorleben", desc: "Mach normale Dinge: Geh in die K\u00fcche, setz dich hin, g\u00e4hne demonstrativ. Biete ein Kauspielzeug an \u2013 wenn er es nimmt, ist das ein gutes Zeichen." },
      { title: "Langfristig desensibilisieren", desc: "Spiel Gewitterger\u00e4usche leise ab und gib dabei Leckerlis. Lautst\u00e4rke \u00fcber Wochen langsam erh\u00f6hen. So lernt dein Hund: Donner = Leckerli-Zeit." },
    ],
    tipp: "Keine Spazierg\u00e4nge bei Gewitter erzwingen. Wenn dein Hund sich nicht l\u00f6sen will, ist das okay. Warte es gemeinsam ab.",
    wennNicht: [
      "Dein Hund ist in absoluter Panik (zittert extrem, l\u00e4uft orientierungslos)? Das ist \u00fcber normales Training hinaus. Sprich mit deinem Tierarzt \u00fcber Unterst\u00fctzung.",
      "Es gibt pflanzliche Beruhigungsmittel und in schweren F\u00e4llen medikament\u00f6se Hilfe. Das ist keine Schw\u00e4che \u2013 manche Hunde haben echte Ger\u00e4uschphobien.",
      "Thundershirts (enge Westen) helfen manchen Hunden durch sanften Druck. Probier es aus \u2013 bei etwa 50% der Hunde zeigt es Wirkung.",
    ],
  },
  {
    nr: 10,
    title: "Hund zieht zu anderem Hund hin",
    situation: "Dein Hund sieht einen anderen Hund und will unbedingt hin \u2013 zieht, winselt, bellt vor Aufregung. Du wirst durch die Gegend gezogen.",
    steps: [
      { title: "Sofort stoppen", desc: "Bleib stehen, sobald dein Hund anf\u00e4ngt zu ziehen. Nicht mitziehen lassen, auch nicht \"nur kurz schn\u00fcffeln\". Die Regel ist glasklar: Ziehen = wir gehen nicht weiter." },
      { title: "Blickkontakt einfordern", desc: "Sag \"Schau mich an\". Halte ein Leckerli neben dein Gesicht. Sobald dein Hund dich ansieht \u2013 auch nur eine Sekunde \u2013 sag \"Ja!\" und gib das Leckerli." },
      { title: "Warten bis Leine locker", desc: "Geh erst weiter, wenn die Leine komplett locker h\u00e4ngt und dein Hund entspannt ist. Das kann dauern \u2013 halte durch. Konsequenz ist hier alles." },
      { title: "Kontakt nur bei Ruhe erlauben", desc: "Wenn die Leine locker ist und beide Hunde entspannt wirken, darfst du DANN n\u00e4her gehen. Faustregel: Wenn einer aufgeregt ist, geht ihr in einem Bogen vorbei." },
      { title: "Nicht jede Begegnung zulassen", desc: "Die meisten Hundebegegnungen m\u00fcssen nicht stattfinden. Dein Hund muss lernen, dass nicht jeder Hund ein Spielkamerad ist \u2013 und das ist v\u00f6llig okay." },
    ],
    tipp: "Belohne deinen Hund jedes Mal wenn er einen anderen Hund sieht und dich trotzdem anschaut. Das ist Gold wert.",
    wennNicht: [
      "Er ignoriert dich komplett? Er ist \u00fcber seiner Reizschwelle. Vergr\u00f6\u00dfere den Abstand massiv \u2013 arbeite erstmal in 20\u201330 Meter Entfernung.",
      "Belohne jedes Mal wenn er den Hund sieht und NICHT ausflippt. \u00dcber Wochen n\u00e4her ran. Geduld! Frustration auf deiner Seite \u00fcbertr\u00e4gt sich.",
      "Dein Hund will zu JEDEM Hund? Das ist oft Frust, weil er nie darf. Erlaube gelegentlich kontrollierten Kontakt mit ruhigen Hunden \u2013 das nimmt den Druck.",
    ],
  },
];

function wrapText(text, font, size, maxWidth) {
  const words = text.split(" ");
  const lines = [];
  let currentLine = "";
  for (const word of words) {
    const testLine = currentLine ? currentLine + " " + word : word;
    const width = font.widthOfTextAtSize(testLine, size);
    if (width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

function drawRoundedRect(page, x, y, w, h, r, color) {
  page.drawRectangle({ x: x + r, y, width: w - 2 * r, height: h, color });
  page.drawRectangle({ x, y: y + r, width: w, height: h - 2 * r, color });
  page.drawCircle({ x: x + r, y: y + r, size: r, color });
  page.drawCircle({ x: x + w - r, y: y + r, size: r, color });
  page.drawCircle({ x: x + r, y: y + h - r, size: r, color });
  page.drawCircle({ x: x + w - r, y: y + h - r, size: r, color });
}

async function main() {
  console.log("Starte PDF-Generierung...");
  const doc = await PDFDocument.create();
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontItalic = await doc.embedFont(StandardFonts.HelveticaOblique);

  const MARGIN = 50;
  const CONTENT_W = A4_W - 2 * MARGIN;

  // ===== DECKBLATT =====
  const cover = doc.addPage([A4_W, A4_H]);
  cover.drawRectangle({ x: 0, y: 0, width: A4_W, height: A4_H, color: WHITE });
  cover.drawRectangle({ x: 0, y: A4_H - 8, width: A4_W, height: 8, color: GOLD });

  const titleText = "Notfall-Karten";
  const titleWidth = fontBold.widthOfTextAtSize(titleText, 36);
  cover.drawText(titleText, { x: (A4_W - titleWidth) / 2, y: A4_H - 120, size: 36, font: fontBold, color: TEXT_DARK });

  const subtitle = "10 Sofort-Hilfen f\u00fcr typische Problemsituationen";
  const subWidth = fontRegular.widthOfTextAtSize(subtitle, 15);
  cover.drawText(subtitle, { x: (A4_W - subWidth) / 2, y: A4_H - 155, size: 15, font: fontRegular, color: TEXT_MEDIUM });

  const descText = "Jede Karte erkl\u00e4rt dir Schritt f\u00fcr Schritt, was du in einer typischen Problemsituation mit deinem Hund tun kannst. Klar, ruhig, sofort umsetzbar. Zum Ausdrucken oder auf dem Handy speichern.";
  const descLines = wrapText(descText, fontRegular, 12, CONTENT_W - 60);
  let descY = A4_H - 220;
  for (const line of descLines) {
    const lw = fontRegular.widthOfTextAtSize(line, 12);
    cover.drawText(line, { x: (A4_W - lw) / 2, y: descY, size: 12, font: fontRegular, color: TEXT_MEDIUM });
    descY -= 18;
  }

  let overviewY = descY - 30;
  cover.drawText("Inhalt:", { x: MARGIN + 30, y: overviewY, size: 14, font: fontBold, color: TEXT_DARK });
  overviewY -= 28;
  for (const k of karten) {
    cover.drawText(`${k.nr}.`, { x: MARGIN + 40, y: overviewY, size: 12, font: fontBold, color: GOLD });
    cover.drawText(k.title, { x: MARGIN + 65, y: overviewY, size: 12, font: fontRegular, color: TEXT_DARK });
    overviewY -= 22;
  }

  const footerText = "Pfoten-Plan \u00b7 pfoten-plan.de";
  const footerWidth = fontRegular.widthOfTextAtSize(footerText, 10);
  cover.drawText(footerText, { x: (A4_W - footerWidth) / 2, y: 40, size: 10, font: fontRegular, color: TEXT_MEDIUM });
  cover.drawRectangle({ x: 0, y: 0, width: A4_W, height: 4, color: GOLD });

  // ===== KARTEN =====
  for (const karte of karten) {
    const page = doc.addPage([A4_W, A4_H]);
    page.drawRectangle({ x: 0, y: 0, width: A4_W, height: A4_H, color: WHITE });
    page.drawRectangle({ x: 0, y: A4_H - 6, width: A4_W, height: 6, color: GOLD });

    let y = A4_H - 50;

    // Badge
    drawRoundedRect(page, MARGIN, y - 24, 36, 28, 4, GOLD);
    const nrText = `#${karte.nr}`;
    const nrWidth = fontBold.widthOfTextAtSize(nrText, 13);
    page.drawText(nrText, { x: MARGIN + (36 - nrWidth) / 2, y: y - 18, size: 13, font: fontBold, color: WHITE });

    page.drawText(karte.title, { x: MARGIN + 46, y: y - 16, size: 20, font: fontBold, color: TEXT_DARK });
    y -= 50;

    page.drawRectangle({ x: MARGIN, y, width: CONTENT_W, height: 1, color: BORDER_LIGHT });
    y -= 16;

    page.drawText("Situation", { x: MARGIN, y, size: 10.5, font: fontBold, color: DARK_BROWN });
    y -= 15;
    const situationLines = wrapText(karte.situation, fontRegular, 10.5, CONTENT_W);
    for (const line of situationLines) {
      page.drawText(line, { x: MARGIN, y, size: 10.5, font: fontRegular, color: TEXT_MEDIUM });
      y -= 14;
    }
    y -= 12;

    // 5 Schritte - alle in DARK_BROWN, mehr Abstand
    for (let i = 0; i < karte.steps.length; i++) {
      const step = karte.steps[i];
      page.drawCircle({ x: MARGIN + 10, y: y - 1, size: 10, color: DARK_BROWN });
      const stepNr = `${i + 1}`;
      const stepNrW = fontBold.widthOfTextAtSize(stepNr, 9);
      page.drawText(stepNr, { x: MARGIN + 10 - stepNrW / 2, y: y - 4, size: 9, font: fontBold, color: WHITE });

      page.drawText(step.title, { x: MARGIN + 26, y: y - 1, size: 11.5, font: fontBold, color: TEXT_DARK });
      y -= 17;

      const stepLines = wrapText(step.desc, fontRegular, 10, CONTENT_W - 26);
      for (const line of stepLines) {
        page.drawText(line, { x: MARGIN + 26, y, size: 10, font: fontRegular, color: TEXT_DARK });
        y -= 13;
      }
      y -= 10;
    }

    // Tipp-Box
    y -= 2;
    const tippLines = wrapText(karte.tipp, fontRegular, 9.5, CONTENT_W - 36);
    const tippBoxH = 24 + tippLines.length * 12;
    drawRoundedRect(page, MARGIN, y - tippBoxH + 12, CONTENT_W, tippBoxH, 5, BG_LIGHT);
    page.drawRectangle({ x: MARGIN, y: y - tippBoxH + 12, width: 3, height: tippBoxH, color: GOLD });

    page.drawText("Tipp:", { x: MARGIN + 12, y, size: 9.5, font: fontBold, color: DARK_BROWN });
    y -= 13;
    for (const line of tippLines) {
      page.drawText(line, { x: MARGIN + 12, y, size: 9.5, font: fontRegular, color: TEXT_MEDIUM });
      y -= 12;
    }

    // "Was wenn er nicht mitmacht?" Box - 3 Punkte
    y -= 16;
    const wennNichtTitle = "Was, wenn dein Hund nicht mitmacht?";

    // Berechne Gesamth\u00f6he
    let totalWnLines = 0;
    const allWnWrapped = [];
    for (const punkt of karte.wennNicht) {
      const wrapped = wrapText(punkt, fontItalic, 9.5, CONTENT_W - 48);
      allWnWrapped.push(wrapped);
      totalWnLines += wrapped.length;
    }
    const wnBoxH = 26 + totalWnLines * 12 + (karte.wennNicht.length - 1) * 4;
    drawRoundedRect(page, MARGIN, y - wnBoxH + 12, CONTENT_W, wnBoxH, 5, BG_WARM);
    page.drawRectangle({ x: MARGIN, y: y - wnBoxH + 12, width: 3, height: wnBoxH, color: DARK_BROWN });

    page.drawText(wennNichtTitle, { x: MARGIN + 12, y, size: 9.5, font: fontBold, color: DARK_BROWN });
    y -= 15;

    for (let p = 0; p < allWnWrapped.length; p++) {
      // Bullet punkt
      page.drawCircle({ x: MARGIN + 18, y: y - 1, size: 2.5, color: DARK_BROWN });
      const lines = allWnWrapped[p];
      for (let l = 0; l < lines.length; l++) {
        page.drawText(lines[l], { x: MARGIN + 26, y, size: 9.5, font: fontItalic, color: TEXT_MEDIUM });
        y -= 12;
      }
      y -= 4;
    }

    const pageFooter = `Notfall-Karte ${karte.nr}/10 \u00b7 Pfoten-Plan`;
    const pfWidth = fontRegular.widthOfTextAtSize(pageFooter, 9);
    page.drawText(pageFooter, { x: (A4_W - pfWidth) / 2, y: 30, size: 9, font: fontRegular, color: TEXT_MEDIUM });
    page.drawRectangle({ x: 0, y: 0, width: A4_W, height: 3, color: GOLD });
  }

  const pdfBytes = await doc.save();
  writeFileSync("public/notfall-karten.pdf", pdfBytes);
  console.log(`PDF gespeichert: public/notfall-karten.pdf (${pdfBytes.byteLength} bytes)`);
}

main().catch(console.error);
