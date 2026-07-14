// Illustrierte Themen-Plan-PDFs (Bild-Tier, 19,99) — importierbar als Library.
//   import { buildPdf } from "@/generate-themenplan-illustriert.mjs";
//   const bytes = await buildPdf({ theme: "energie", dogName: "Bello", dogBreed: "Labrador" });
// Themen: bellen | leinen | energie. Bilder liegen in public/{...}-uebungen/.
// Personalisierung v1: Hundename + Rasse ({dog}/{breed}). Inhalt pro Thema statisch.
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUB = (rel) => join(__dirname, "public", rel);

const A4_W=595.28,A4_H=841.89,M=50,CW=A4_W-2*M,BOTTOM=60;
const GOLDDK=rgb(169/255,136/255,79/255),INK=rgb(31/255,27/255,22/255),TXT=rgb(58/255,52/255,43/255),MUT=rgb(110/255,101/255,90/255);
const WHITE=rgb(1,1,1),BORDER=rgb(236/255,227/255,213/255),SOFT=rgb(1,249/255,240/255),GREEN=rgb(47/255,125/255,79/255),RED=rgb(178/255,58/255,46/255);
const S=(t)=>String(t??"").replace(/[‘’]/g,"'").replace(/[“”„]/g,'"').replace(/[–—]/g,"-").replace(/…/g,"...").replace(/→/g,"->").replace(/[^\x00-\xFF]/g,"").trim();

// ===================== THEMEN-DATEN (Platzhalter {dog} / {breed}) =====================
const THEMES = {
  bellen: {
    title: "{dog}s Bellen-Plan", subtitle: "Deine persoenliche Einschaetzung",
    diagTerm: "Frustbedingtes Bellen (Barrierefrust)",
    diagWhy: "{dog} will hin, und die Leine haelt zurueck - dieser Frust entlaedt sich im Bellen. Das ist kein Ungehorsam, sondern eine Blockade.",
    diagSteps: ["Abstand & Sichtblocker nutzen, damit {dog} nicht festhaengt.","Den Fokus auf dich umlenken statt auf den Reiz.","Klare Begegnungs- und Begruessungsregeln aufbauen."],
    intro: ["Schoen, dass du fuer {dog} hier bist. Dieser Plan ist genau auf {dog}s Bellen zugeschnitten - Schritt fuer Schritt und in eurem Tempo.","Als {breed} reagiert {dog} von Natur aus stark auf Bewegung und Reize - umso wichtiger ist ein klarer, ruhiger Rahmen. Wichtig zu verstehen: Bellen ist kein Ungehorsam, sondern Kommunikation. Wenn wir den Grund dahinter aufloesen und die richtige Alternative aufbauen, verschwindet das Bellen von selbst."],
    howto: ["Nimm dir pro Woche eine Uebung vor und uebe sie kurz, dafuer moeglichst taeglich. Lieber fuenf Minuten mit Freude als eine halbe Stunde mit Druck.","Die Uebungen bauen aufeinander auf - beginn oben und arbeite dich in deinem Tempo durch. Jede Uebung startet mit einem kurzen \"Darum geht's\"."],
    materials: [["Weiche, kleine Leckerlis","Deine Trainings-Waehrung - viele kleine Haeppchen, die {dog} liebt."],["Eine Ruhe-Decke","{dog}s fester Entspannungsort fuer die Decken-Uebung."],["Eine Schleppleine (5-10 m)","Fuer die Distanz-Uebungen draussen - Sicherheit ohne Zwang."],["Geduld & gute Laune","Wichtiger als jedes Hilfsmittel. Dein ruhiges Wesen ist das beste Werkzeug."]],
    weekplan: [["Woche 1","Decke / Ruhe-Anker","Der sichere Ort zum Runterfahren"],["Woche 2","SCHAU-Signal","Fokus auf dich als Grundlage"],["Woche 3","Reiz ankuendigen","Andere Hunde entspannt begegnen"],["Woche 4","Impulskontrolle (Warte)","Innehalten statt sofort loslegen"],["Woche 5","Runterfahren","Auf ein Signal hin entspannen"],["Woche 6","Fenster & Tuer","Zuhause zur Ruhe kommen"],["Woche 7","Begruessung / Klingel","Besuch ohne Tuersturm"],["Woche 8","U-Turn","Souveraen ausweichen, wenn's eng wird"]],
    lib: {
      "01-decke":["bellen-uebungen","01-decke","Decke / Ruhe-Anker","Die Decke wird {dog}s sicherer Ruheplatz - ein fester Ort zum Runterfahren. Wer so einen Anker hat, kippt viel seltener ins Bellen.",["Decke hinlegen & hinfuehren: fuehr {dog} hin und belohne jeden Schritt darauf.","Ablegen auf Signal: auf der Decke ruhig PLATZ sagen und sofort belohnen.","Dauer aufbauen: ruhiges Liegen in immer groesseren Abstaenden belohnen.","Distanz aufbauen: nach und nach einen Schritt zurueck - {dog} bleibt liegen.","Aufloesen: immer aktiv mit dem Wort LAUF beenden."]],
      "02-schau":["bellen-uebungen","02-schau","SCHAU-Signal (Fokus auf dich)","Diese Uebung baut {dog}s Aufmerksamkeit auf dich auf - die Grundlage fuer alles Weitere. Schaut {dog} dich an, kann sie sich gar nicht erst in den Reiz hineinsteigern.",["Leckerli an die Augen halten und SCHAU sagen.","Blickkontakt belohnen: schaut {dog} dir in die Augen - FEIN + Leckerli.","Dauer steigern: den Blick 2-3 Sekunden halten vor der Belohnung.","Ohne Hilfe: SCHAU mit leeren Haenden.","Unter Ablenkung: SCHAU auch ueben, wenn etwas los ist."]],
      "03-reiz":["bellen-uebungen","03-reiz","Reiz ankuendigen (anderer Hund)","Hier lernt {dog}, dass ein anderer Hund kein Grund zur Aufregung ist, sondern das Signal, zu dir zu schauen. Du nimmst dem Reiz Schritt fuer Schritt die Spannung.",["Reiz frueh erkennen: du siehst den anderen Hund zuerst - halt Abstand.","Ruhig ankuendigen: Markerwort sagen, {dog} kurz hinschauen lassen.","Umlenken & belohnen: dreht {dog} sich zu dir, sofort das Leckerli.","Abstand & Wiederholung: mit Distanz mehrfach ueben - unter der Reizschwelle.","Reiz wird zum Signal: bald schaut {dog} beim Anblick von selbst zu dir."]],
      "04-warte":["bellen-uebungen","04-warte","Impulskontrolle (Warte)","Impulskontrolle ist der Muskel gegen das Bellen: {dog} lernt, einen Moment innezuhalten, statt sofort loszupreschen.",["Leckerli in der Faust: {dog} darf schnueffeln, aber nicht rankommen.","Aufgeben belohnen: weicht {dog} zurueck, Hand oeffnen und geben.","Offene Hand: Leckerli auf der offenen Hand - {dog} wartet.","Signal WARTE: Leckerli auf den Boden, WARTE mit Handzeichen.","Freigabe: erst auf dein Freigabe-Wort darf {dog} nehmen."]],
      "05-ruhe":["bellen-uebungen","05-ruhe","Runterfahren / Ruhe-Signal","Viele Hunde bellen, weil sie schlicht nicht runterkommen. Hier trainierst du gezielt das Entspannen - auf ein ruhiges Signal hin.",["Ruhigen Moment abpassen: liegt {dog} ruhig, markier den Moment.","Ruhe belohnen: leise ein Leckerli hinlegen, ohne aufzuregen.","Ruhe-Wort einfuehren: Hand sanft auflegen, leise dein Ruhe-Wort.","Sanft streicheln: langsames Streicheln - {dog} faehrt weiter runter.","Ruhe auf Signal: bald legt {dog} auf dein Wort selbst den Kopf ab."]],
      "06-fenster":["bellen-uebungen","06-fenster","Fenster & Tuer","Zuhause ist das Fenster oft die Bellen-Buehne. Du gestaltest die Umgebung so, dass {dog} gar nicht erst in den Wachmodus kippt.",["Der Wachposten: am Fenster meldet {dog} alles, was draussen passiert.","Sicht nehmen: ruhig den Vorhang vorziehen - ohne Bild kein Bellen.","Alternative anbieten: {dog} zu einem Ruheplatz weg vom Fenster fuehren.","Ruhe belohnen: bleibt {dog} ruhig statt zu bellen - Leckerli.","Neue Gewohnheit: {dog} bleibt entspannt, auch wenn draussen was vorbeigeht."]],
      "07-begruessung":["bellen-uebungen","07-begruessung","Begruessung / Klingel","Die Klingel ist fuer viele Hunde der Ausloeser Nummer eins. {dog} lernt eine ruhige Alternative zum Tuersturm.",["Klingel = Signal: statt loszustuermen wird die Klingel zum Ruhe-Signal.","Auf den Platz: schick {dog} auf ihren Platz, weg von der Tuer.","Warten lassen: {dog} bleibt liegen, waehrend du zur Tuer gehst.","Ruhig oeffnen: Tuer auf - {dog} bleibt, kein Anspringen.","Belohnen: bleibt {dog} ruhig beim Besuch, wird das reich belohnt."]],
      "08-uturn":["bellen-uebungen","08-uturn","U-Turn (Umlenken)","Der U-Turn ist deine Notbremse: wird ein Reiz zu viel, drehst du souveraen ab - ohne Drama, ohne Bellen.",["Reiz zu nah: kommt ein Hund zu nah, erkenn es frueh.","U-Turn ankuendigen: sag froehlich dein Wende-Wort.","Gemeinsam wegdrehen: dreh mit {dog} um, geh in die andere Richtung.","Beim Weggehen belohnen: {dog} fuers Mitgehen belohnen - weg vom Stress.","Entspannt weiter: ihr geht ruhig weiter, die Begegnung ist entschaerft."]],
    },
    selected: ["01-decke","02-schau","03-reiz","04-warte","05-ruhe","06-fenster","07-begruessung","08-uturn"],
    go: [["Ruhig bleiben","Deine Ruhe uebertraegt sich auf deinen Hund.","bellen-uebungen","09-go-1"],["Ruhe belohnen","Verstaerke jeden Moment, in dem er nicht bellt.","bellen-uebungen","09-go-2"],["Abstand schaffen","Geh frueh auf Distanz, bevor er hochdreht.","bellen-uebungen","09-go-3"]],
    no: [["Nicht anschreien","Schimpfen macht die Aufregung nur groesser.","bellen-uebungen","09-nogo-1"],["Nicht an der Leine rucken","Das erhoeht Stress und Frust.","bellen-uebungen","09-nogo-2"],["Nicht in den Reiz laufen","Draeng ihn nicht in die Konfrontation.","bellen-uebungen","09-nogo-3"]],
    closing: ["Das war eine Menge - aber du musst nicht alles auf einmal. Eine Uebung pro Woche, ruhig und in eurem Tempo, reicht voellig.","Rueckschritte gehoeren dazu. An manchen Tagen klappt es schlechter, das ist normal und kein Grund aufzugeben. Bleib ruhig und geduldig - {dog} orientiert sich an dir.","Meist merkst du schon nach 2-3 Wochen den ersten Unterschied. Ziel ist nicht der perfekt stille Hund, sondern dass ihr beide entspannter durch euren Alltag geht.","Fragen? Wir sind fuer dich da: support@pfoten-plan.de. Viel Freude mit {dog}!"],
  },

  leinen: {
    title: "{dog}s Leinen-Plan", subtitle: "Locker an der Leine - Schritt fuer Schritt",
    diagTerm: "Ziehen aus Vorfreude & fehlender Orientierung",
    diagWhy: "{dog} zieht nicht aus Sturheit - {dog} hat schlicht nie gelernt, dass sich Laufen an lockerer Leine mehr lohnt. Genau das drehen wir jetzt um.",
    diagSteps: ["Ziehen lohnt sich nie mehr (Stopp & Gegenrichtung).","Die Position an deiner Seite wird zum besten Platz der Welt.","Schritt fuer Schritt vom ruhigen Flur bis zum echten Alltag."],
    intro: ["Schoen, dass du fuer {dog} hier bist. Dieser Plan ist genau auf {dog}s Ziehen an der Leine zugeschnitten - Schritt fuer Schritt.","Als {breed} bringt {dog} viel Energie und Vorfreude mit. Das ist nichts Schlimmes - wir kanalisieren es nur. Der ganze Plan beruht auf einer einzigen, fairen Regel: An lockerer Leine geht es vorwaerts, bei straffer Leine nicht. Kein Ziehen am Hund, kein Schimpfen - nur Konsequenz und Belohnung."],
    howto: ["Arbeite in kleinen Schritten: erst drinnen ohne Ablenkung, dann im Hof, dann auf der ruhigen Strasse, zuletzt im echten Alltag. Jede Stufe erst festigen.","Eine Uebung pro Woche, taeglich ein paar Minuten. Jede Uebung startet mit einem \"Darum geht's\"."],
    materials: [["Viele kleine, weiche Leckerlis","Die Belohnung fuers Laufen an lockerer Leine - grosszuegig und sofort."],["Eine normale 2-m-Leine + Brustgeschirr","Kein Ruck ins Genick. Ein gut sitzendes Geschirr schuetzt {dog}s Hals."],["Eine Ruhe-Decke","{dog}s Entspannungsort, um die Grundanspannung zu senken."],["Zeit & Geduld","Die ersten Runden dauern laenger. Das ist Investition, kein Rueckschritt."]],
    weekplan: [["Woche 1","SCHAU-Signal","Aufmerksamkeit aufbauen"],["Woche 2","Stop-and-Go an der Tuer","Ruhiger Start"],["Woche 3","Sei ein Baum","Die Kernregel gegen Ziehen"],["Woche 4","Bei-Fuss-Goldzone","Die Seite lohnenswert machen"],["Woche 5","Tempo-Wechsel","Orientierung zu dir"],["Woche 6","Lockere Leine im Alltag","Alles kombinieren"],["Woche 7","Penalty Yards","Bei hartnaeckigem Ziehen"],["Woche 8","Entspannungsdecke","Gelassenheit als Basis"]],
    lib: {
      "schau":["bellen-uebungen","02-schau","SCHAU-Signal etablieren","Alles beginnt mit Aufmerksamkeit. Reagiert {dog} auf dein Signal SCHAU mit Blickkontakt, hast du an der Leine jederzeit einen Draht zu ihm - die Basis gegen Ziehen.",["Halte ein Leckerli auf Augenhoehe und sage ruhig SCHAU.","Trifft {dog}s Blick deine Augen: sofort FEIN sagen und geben.","Steigere die Dauer des Blickkontakts langsam auf 2-3 Sekunden.","Bewege das Leckerli vom Gesicht weg - {dog} soll dich anschauen, nicht die Hand.","Uebe in verschiedenen Raeumen, damit das Signal ueberall sitzt."]],
      "tuer":["leinen-uebungen","01-tuer","Stop-and-Go an der Tuer","Ein ruhiger Start entscheidet ueber den ganzen Spaziergang. Wer schon hektisch aus der Tuer schiesst, zieht danach weiter.",["Leine anlegen und ruhig an der geschlossenen Tuer stehen - kein Draengeln.","Tuergriff anfassen. Draengelt {dog}: Griff loslassen und warten.","Tuer einen Spalt oeffnen. Drueckt {dog} vor: wieder schliessen und warten.","Du gehst zuerst durch die Tuer, {dog} folgt ohne vorbeizudraengen.","Draussen kurz stehen - losgehen erst bei lockerer Leine."]],
      "baum":["leinen-uebungen","02-baum","Sei ein Baum: Stopp bei straffer Leine","Das ist die wichtigste Uebung des Plans. {dog} lernt die einfache Regel: Ziehen = es geht nicht weiter, lockere Leine = es geht weiter.",["Geh entspannt los, die Leine haengt locker in der Hand.","Wird die Leine straff: SOFORT stehen bleiben - wie ein Baum. Kein Wort, kein Ruck.","Schau neutral geradeaus, halte die Leine ruhig und warte einfach ab.","Sobald {dog} nachgibt oder sich umdreht und die Leine locker wird...","...ruhig FEIN sagen und ohne Aufregung weitergehen."]],
      "beifuss":["leinen-uebungen","03-beifuss","Bei-Fuss-Position als Goldzone","Die Position an deinem Bein soll der lohnenswerteste Platz der Welt werden. Wir bezahlen {dog} dafuer, neben dir zu bleiben.",["Halte die Leckerlis an der Seite, an der {dog} laeuft (Hund links -> linke Hand).","Ist {dog}s Schulter neben deinem Knie: FEIN und Leckerli an der Hosennaht geben.","Mach einen Schritt vor. Bleibt {dog} am Bein: sofort belohnen.","Steigere auf mehrere Schritte - Belohnung immer an der Bein-Position.","10 Schritte ohne Ziehen? Kleiner Jackpot aus 3 Leckerlis, dann beenden."]],
      "tempo":["leinen-uebungen","04-tempo","Tempo-Wechsel als Aufmerksamkeits-Tool","Mit unvorhersehbaren Tempo-Wechseln zwingst du {dog}, sich an dir zu orientieren statt nach vorne zu preschen.",["Beginne mit normalem Tempo bei lockerer Leine.","Reduziere ploetzlich (ohne Ankuendigung) auf halbes Tempo.","Passt {dog} sich an: sofort FEIN und Leckerli an der Bein-Position.","Nach ein paar Schritten ploetzlich auf fast Joggen beschleunigen.","Variiere unberechenbar - auch mal eine kurze 90-Grad-Drehung."]],
      "alltag":["leinen-uebungen","05-alltag","Lockere Leine im Alltagsspaziergang","Der Alltagstest: {dog} kennt jetzt Sei-ein-Baum, Bei-Fuss und Tempo-Wechsel. Jetzt kombinierst du alle Werkzeuge.",["Starte mit 2-3 Minuten Bei-Fuss-Belohnen als Aufwaermen.","Bei jeder straffen Leine: Sei-ein-Baum-Stopp.","Alle 30-40 Schritte ein Leckerli an der Bein-Position, wenn locker.","Schnueffel-Pausen sind die beste Belohnung: lockere Leine = du darfst hin.","Beende IMMER in einer lockeren Phase - nie nach einem Ziehen-Moment."]],
      "penalty":["bellen-uebungen","08-uturn","Penalty Yards: Gegenrichtung als Konsequenz","Die Verstaerkung von 'Sei ein Baum': hartnaeckiges Ziehen fuehrt jetzt sogar rueckwaerts. {dog} lernt - ziehen bringt mich vom Ziel weg.",["Nur anwenden, wenn reines Stehenbleiben nach ~30 Sek nichts bringt.","Bei hartnaeckigem Ziehen: dreh dich ruhig um (nicht ruckartig).","Geh 4-5 entspannte Schritte in die Gegenrichtung - ohne Wort, ohne Drama.","{dog} folgt und die Leine wird locker: wieder in die urspruengliche Richtung.","Beim Wieder-richtig-Laufen grosszuegig an der Bein-Position belohnen."]],
      "decke":["bellen-uebungen","01-decke","Entspannungsdecke als Ruhe-Anker","Ein aufgeregter Hund zieht mehr. {dog} bekommt einen festen Ruheort, der die Grundanspannung senkt.",["Decke hinlegen, {dog} hinfuehren und jedes Betreten belohnen.","Ist {dog} mit allen Pfoten drauf: ruhig PLATZ sagen und belohnen.","Alle paar Sekunden ein Leckerli zwischen die Vorderpfoten - Ruhe verknuepfen.","Verlaengere die Abstaende langsam auf 10-15 Sekunden.","Immer aktiv mit einem Wort wie LAUF aufloesen."]],
    },
    selected: ["schau","tuer","baum","beifuss","tempo","alltag","penalty","decke"],
    go: [["Leine locker in U-Form","Halte die Leine entspannt durchhaengend - straff halten laedt zum Ziehen ein.","leinen-uebungen","09-go-1"],["An der Seite belohnen","Belohne {dog} an der Bein-Naht, wenn er locker neben dir laeuft.","leinen-uebungen","09-go-2"],["Schnueffeln erlauben","Lockere Leine = {dog} darf schnueffeln. Das ist die staerkste Belohnung.","leinen-uebungen","09-go-3"]],
    no: [["Nicht an der Leine rucken","Rucken erzeugt Stress und Schmerz - und loest das Ziehen nicht.","leinen-uebungen","09-nogo-1"],["Nicht mitziehen lassen","Laeufst du beim Ziehen weiter, belohnst du genau das Ziehen.","leinen-uebungen","09-nogo-2"],["Leine nicht dauerstraff halten","Eine staendig kurze, straffe Leine nimmt {dog} jede Chance, es richtig zu machen.","leinen-uebungen","09-nogo-3"]],
    closing: ["Ziehen verschwindet nicht in einer Woche - aber mit jeder lockeren Leine wird es weniger. Bleib bei der einen Regel und feier jeden Meter.","Der wichtigste Satz: Sei berechenbar. Wenn {dog} sich zu 100% darauf verlassen kann, dass straffe Leine immer Stopp bedeutet, hoert das Ziehen von selbst auf.","Die ersten Spaziergaenge sind anstrengend und langsam - das ist normal und geht vorbei. Meist siehst du nach 2-3 Wochen die ersten entspannten Runden.","Fragen? Wir sind fuer dich da: support@pfoten-plan.de. Viel Erfolg mit {dog}!"],
  },

  energie: {
    title: "{dog}s Energie-Plan", subtitle: "Auslastung, die wirklich muede macht",
    diagTerm: "Bewegungs-Ueberschuss bei fehlender Kopfarbeit",
    diagWhy: "{dog} ist ein kluger, energiegeladener {breed} - und dreht auf, weil der Kopf zu wenig gefordert wird. Nur mehr Rennen macht {dog} fitter, nicht ruhiger. Der Schluessel ist Kopfarbeit plus gezielte Ruhe.",
    diagSteps: ["Kopf statt nur Beine: Nasen- und Denksport statt Dauer-Toben.","Ruhe aktiv trainieren - Abschalten ist eine Faehigkeit.","Impulskontrolle aufbauen, damit {dog} nicht bei jedem Reiz hochfaehrt."],
    intro: ["Schoen, dass du fuer {dog} hier bist. Dieser Plan ist genau auf {dog}s ueberschuessige Energie zugeschnitten.","Als {breed} ist {dog} zu klug und arbeitsfreudig fuer reines Gassigehen. Das Missverstaendnis Nr. 1 lautet: mehr Bewegung. Doch stundenlanges Ballwerfen macht {dog} nur fitter und aufgedrehter. Was wirklich muede macht, ist KOPFARBEIT - plus das aktive Training von Ruhe."],
    howto: ["Die Formel: 1 Kopfarbeits-Einheit + 1 Ruhe-Einheit pro Tag schlaegt jede Extra-Runde Toben. Kurze, intensive Einheiten statt Dauer-Action.","Eine Uebung pro Woche, taeglich ein paar Minuten. Jede Uebung startet mit einem \"Darum geht's\"."],
    materials: [["Kleine Leckerlis + Teil der Tagesration","Fuers Suchen, Verstecken und Belohnen - einfach vom normalen Futter abzweigen."],["Ein Kong + eine Schnueffelmatte","Fuer die Mahlzeit-Beschaeftigung, die {dog} 15-30 Minuten auslastet."],["Eine Ruhe-Decke","{dog}s fester Abschalt-Ort fuer die Cool-Down-Routine."],["Eine Schleppleine","Sicherheit bei der Nasenarbeit (Spuren-Suche) draussen."]],
    weekplan: [["Woche 1","Futter-Suche","Nasenarbeit als Basis"],["Woche 2","Kong & Schnueffelmatte","Mahlzeit wird Beschaeftigung"],["Woche 3","WARTE","Impulskontrolle aufbauen"],["Woche 4","Entspannungs-Anker","Ruhe auf Signal"],["Woche 5","Pfoetchen-Trick","Kopfarbeit & Denken"],["Woche 6","Spuren-Suche","Intensive Nasenarbeit draussen"],["Woche 7","Stopp-Spiel","Hochfahren & runterkommen"],["Woche 8","Cool-Down-Decke","Abschalten als Routine"]],
    lib: {
      "such":["energie-uebungen","01-such","Futter-Suche in der Wohnung","Nasenarbeit ist die effektivste Auslastung: 20-30 Minuten Suchen macht {dog} zufriedener und mueder als eine Stunde Rennen.",["Verteile die normale Tagesmenge Trockenfutter im Raum - {dog} wartet solange woanders.","Sage ruhig SUCH und gib {dog} frei, loszuziehen.","Lass {dog} selbststaendig suchen und schnueffeln - NICHT helfen oder hinzeigen.","Steigere ab Tag 4: hoehere Verstecke, hinter Gegenstaenden, an ungewohnten Stellen.","Nach der Suche darf {dog} von selbst zur Ruhe kommen - nicht zum Spielen animieren."]],
      "kong":["energie-uebungen","02-kong","Kong oder Schnueffelmatte als Mahlzeit","Eine Mahlzeit pro Tag kommt aus dem Kong oder der Schnueffelmatte. {dog} arbeitet 15-30 Minuten am Futter statt es zu schlingen.",["Stopfe einen Kong mit Nass- oder eingeweichtem Trockenfutter (schwerer: einfrieren).","Uebergib die Beschaeftigung an einem ruhigen Ort - Decke oder Korb.","Geh weg und lass {dog} selbststaendig arbeiten - nicht daneben aktiv sein.","Zur Abwechslung: Schnueffelmatte mit Trockenfutter zwischen den Streifen.","Pro Tag mind. 1 Mahlzeit so - danach ist {dog} angenehm muede."]],
      "warte":["bellen-uebungen","04-warte","WARTE als Impulskontroll-Signal","Impulskontrolle ist der Schluessel bei Energiebuendeln: {dog} lernt, erst zu denken statt sofort loszulegen.",["Leckerli in der Faust: {dog} darf schnueffeln, aber nicht rankommen.","Weicht {dog} zurueck oder laesst ab: Hand oeffnen und geben.","Offene Hand mit Leckerli - {dog} wartet, ohne zu schnappen.","Leckerli auf den Boden legen, WARTE mit Handzeichen.","Erst auf dein Freigabe-Wort darf {dog} nehmen."]],
      "ruhe":["bellen-uebungen","05-ruhe","Entspannungs-Anker konditionieren","Du verknuepfst ein Ruhe-Wort mit Momenten, in denen {dog} schon entspannt ist. Spaeter holst du damit gezielt Ruhe ab.",["Beobachte {dog}: Momente, in denen sie ruhig liegt, Augen halb zu.","Geh ruhig hin und sage in tiefer, warmer Stimme dein Ruhe-Wort.","Leg ein weiches Leckerli direkt ans Maul, ohne {dog} hochzuholen.","Streichle langsam - {dog} verknuepft Wort + Ruhe + Wohlgefuehl.","Nach 7-10 Tagen wirkt das Wort auch in leichter Aufregung."]],
      "trick":["energie-uebungen","03-trick","Frei-Form-Trick: Pfoetchen geben","Kopfarbeit der besten Sorte: {dog} probiert selbst aus, was zur Belohnung fuehrt. 5 Minuten aktives Denken ermueden mehr als ein langer Spaziergang.",["Setz dich vor {dog} und halte eine Hand entspannt offen hin.","Hebt {dog} eine Pfote auch nur leicht: sofort FEIN und Leckerli.","Wiederhole - {dog} probiert, die Pfote in deine Hand zu legen.","Erhoehe die Anforderung: hoeher heben, laenger halten.","Lob {dog} herzlich. Sitzt der Trick, waehle den naechsten (NASE, DREH-DICH)."]],
      "trail":["energie-uebungen","04-trail","Spuren-Suche draussen","Nasenarbeit im Freien ist eine der intensivsten Beschaeftigungen fuer Hunde. Nach 15 Minuten Spurenlesen ist auch ein Junghund ruhig.",["Leg eine 10 m lange Leckerli-Spur (Abstand 30-50 cm) auf eine Wiese.","Fuehr {dog} an den Spur-Anfang und sage SUCH.","Lass {dog} der Spur schnueffelnd folgen - ruhig mitgehen, nicht draengen.","Steigere: laengere Spur, ungleiche Abstaende, ein Richtungs-Knick.","Am Ende: ein Jackpot-Haeufchen Leckerlis als grosser Erfolg."]],
      "stop":["energie-uebungen","05-stop","Stopp-Spiel: Runterkommen ueben","{dog} lernt eine Lebens-Skill: hochfahren UND wieder runterkommen. Gold fuer Energiebuendel, die das Abschalten oft nicht beherrschen.",["Beginne ein moderates Zerr-Spiel mit dem Spielzeug.","Nach 30-60 Sekunden ploetzlich STOP sagen und zur Statue erstarren.","{dog} ist erst irritiert - halte aus, keine Wiederholung des STOP.","Sobald {dog} sich beruhigt und hinsetzt: FEIN + Leckerli (nicht das Spiel).","Nach kurzer Pause mit OK das Spiel wieder freigeben."]],
      "cooldown":["bellen-uebungen","01-decke","Runterkommen auf der Decke","Nach jeder Aufregung folgt eine kurze Ruhe-Routine auf der Decke. {dog} lernt: Ruhe kommt nicht von allein, sie wird geuebt.",["Fuehr {dog} nach Aufregung ruhig zur Decke und sage PLATZ.","Setz dich daneben, atme bewusst langsam - {dog} synchronisiert.","Alle 30-60 Sek ein weiches Leckerli zwischen die Vorderpfoten, wenn {dog} liegt.","Steht {dog} auf: ruhig zurueckfuehren, ohne Worte.","Nach 5-10 Minuten mit einem Wort wie LAUF aufloesen."]],
    },
    selected: ["such","kong","warte","ruhe","trick","trail","stop","cooldown"],
    go: [["Kopfarbeit statt nur Rennen","Nasen- & Denksport macht mueder und zufriedener als stundenlanges Toben.","energie-uebungen","09-go-1"],["Ruhe aktiv belohnen","Belohne {dog}, wenn sie von selbst zur Ruhe kommt - Ruhe ist erwuenscht.","energie-uebungen","09-go-2"],["Genug Schlaf ermoeglichen","Hunde brauchen 17-20 Std Ruhe am Tag - schaffe echte Auszeiten.","energie-uebungen","09-go-3"]],
    no: [["Nicht mit Dauer-Ballwerfen auspowern","Endloses Werfen macht {dog} fitter und aufgedrehter, nicht ruhiger.","energie-uebungen","09-nogo-1"],["Nicht rund um die Uhr bespassen","Staendige Action laesst {dog} nie abschalten - das Ergebnis ist Ueberdrehtheit.","energie-uebungen","09-nogo-2"],["Bei Ueberdrehtheit keine Action draufsetzen","Ein ueberdrehter Hund braucht Ruhe, nicht noch mehr Reiz.","energie-uebungen","09-nogo-3"]],
    closing: ["Der wichtigste Perspektivwechsel: {dog} braucht nicht mehr Bewegung, sondern mehr KOPF und mehr RUHE. Ein ausgelasteter Hund ist ein entspannter Hund.","Erwarte keine Wunder ueber Nacht - aber schon nach 1-2 Wochen mit Nasenarbeit und Ruhe-Training merkst du, dass {dog} abends schneller abschaltet.","Denk an die Formel: Kopfarbeit + aktive Ruhe schlaegt jede Extra-Runde Toben. Weniger, aber richtig.","Fragen? Wir sind fuer dich da: support@pfoten-plan.de. Viel Erfolg mit {dog}!"],
  },
};

export async function buildPdf({ theme, dogName, dogBreed } = {}) {
  const T = THEMES[theme];
  if (!T) throw new Error(`Unbekanntes Thema: "${theme}". Verfuegbar: ${Object.keys(THEMES).join(", ")}`);
  const DOG = (dogName || "dein Hund").trim();
  const BREED = (dogBreed || "Mischling").trim();
  const D = (t) => String(t).replace(/\{dog\}/g, DOG).replace(/\{breed\}/g, BREED);

  const doc = await PDFDocument.create();
  const F = await doc.embedFont(StandardFonts.Helvetica);
  const FB = await doc.embedFont(StandardFonts.HelveticaBold);
  const FI = await doc.embedFont(StandardFonts.HelveticaOblique);
  let page, y;
  function newPage(){ page = doc.addPage([A4_W, A4_H]); y = A4_H - M; }
  function need(h){ if (y - h < BOTTOM) newPage(); }
  function wrap(t,f,s,mw){ const ws=S(t).split(/\s+/); const ls=[]; let c=""; for(const w of ws){ const x=c?c+" "+w:w; if(f.widthOfTextAtSize(x,s)>mw&&c){ls.push(c);c=w;}else c=x;} if(c)ls.push(c); return ls; }
  function para(t,x,s,f,color,mw,lh){ for(const l of wrap(D(t),f,s,mw||CW)){ need(s+(lh||5)); page.drawText(l,{x,y:y-s,size:s,font:f,color}); y-=s+(lh||5); } }
  function rrect(x,yy,w,h,color,border){ page.drawRectangle({x,y:yy,width:w,height:h,color,borderColor:border,borderWidth:border?1:0}); }
  async function img(dir, base, n){ const file = n==null ? base : `${base}-${n}`; for(const ext of [".jpg",".png"]){ const p = PUB(`${dir}/${file}${ext}`); if(existsSync(p)){ const b=readFileSync(p); return ext===".png"?doc.embedPng(b):doc.embedJpg(b);} } return null; }

  // COVER + INTRO
  newPage();
  page.drawRectangle({x:0,y:A4_H-150,width:A4_W,height:150,color:SOFT});
  page.drawText("Pfoten-Plan",{x:M,y:A4_H-52,size:16,font:FB,color:GOLDDK});
  y=A4_H-92; page.drawText(S(D(T.title)),{x:M,y:y-24,size:24,font:FB,color:INK}); y-=30;
  page.drawText(S(T.subtitle),{x:M,y:y-13,size:13,font:F,color:MUT}); y=A4_H-172;
  rrect(M,y-96,CW,96,WHITE,BORDER); const iy=y; y-=16;
  para("FACHLICHE EINORDNUNG",M+16,9,FB,MUT,CW-32,4);
  page.drawText(S(D(T.diagTerm)),{x:M+16,y:y-13,size:14,font:FB,color:GOLDDK}); y-=13+8;
  para(T.diagWhy,M+16,10.5,F,TXT,CW-32,3.5);
  y=iy-96-22; para("So gehen wir vor",M,14,FB,INK,CW,6);
  T.diagSteps.forEach((st,i)=>{ need(28); page.drawCircle({x:M+9,y:y-9,size:9,color:GOLDDK}); page.drawText(String(i+1),{x:M+6,y:y-12,size:10,font:FB,color:WHITE}); const ls=wrap(D(st),F,11.5,CW-30); ls.forEach((l,j)=>page.drawText(l,{x:M+28,y:y-11-j*15,size:11.5,font:F,color:TXT})); y-=Math.max(22,ls.length*15+7); });
  y-=10; T.intro.forEach(p=>{ para(p,M,11.5,F,TXT,CW,6.5); y-=6; });
  y-=4; para("So nutzt du diesen Plan",M,14,FB,INK,CW,6); T.howto.forEach(p=>{ para(p,M,11.5,F,TXT,CW,6.5); y-=6; });

  // MATERIAL
  newPage(); para("Das brauchst du",M,22,FB,INK,CW,8); para("Ein paar Kleinigkeiten, dann kann's losgehen.",M,12,F,MUT,CW,10); y-=6;
  T.materials.forEach(([t,d])=>{ need(38); page.drawCircle({x:M+5,y:y-7,size:3.5,color:GOLDDK}); page.drawText(S(D(t)),{x:M+18,y:y-11,size:13,font:FB,color:INK}); y-=11+6; para(d,M+18,11.5,F,TXT,CW-18,5); y-=10; });

  // WOCHENPLAN
  newPage(); para("Dein 8-Wochen-Fahrplan",M,22,FB,INK,CW,8); para("Eine Uebung pro Woche - Schritt fuer Schritt, ohne Druck.",M,12,F,MUT,CW,12); y-=4;
  T.weekplan.forEach(([w,ex,fo])=>{ need(40); rrect(M,y-34,CW,34,SOFT,BORDER); page.drawText(S(w),{x:M+14,y:y-15,size:11,font:FB,color:GOLDDK}); page.drawText(S(ex),{x:M+90,y:y-15,size:12.5,font:FB,color:INK}); page.drawText(S(fo),{x:M+90,y:y-28,size:10,font:F,color:MUT}); y-=34+9; });

  // ÜBUNGEN
  for(const key of T.selected){ const [dir,base,title,intro,steps] = T.lib[key]; newPage();
    rrect(M,y-30,CW,30,SOFT,BORDER); page.drawText(S(title),{x:M+14,y:y-20,size:14.5,font:FB,color:INK}); y-=30+12;
    page.drawText("Darum geht's",{x:M,y:y-11,size:9.5,font:FB,color:GOLDDK}); y-=15; para(intro,M,11.5,FI,MUT,CW,5); y-=10;
    for(let n=0;n<steps.length;n++){ const im=await img(dir,base,n+1); const iw=150,ih=im?iw*im.height/im.width:112,rowH=Math.max(ih,60)+12; need(rowH); const top=y;
      if(im) page.drawImage(im,{x:M,y:top-ih,width:iw,height:ih});
      const tx=M+iw+16,tw=CW-iw-16; page.drawText(`Schritt ${n+1}`,{x:tx,y:top-12,size:9,font:FB,color:GOLDDK});
      let ty=top-12-16; wrap(D(steps[n]),F,11.5,tw).forEach(l=>{page.drawText(l,{x:tx,y:ty,size:11.5,font:F,color:TXT});ty-=15;}); y=top-rowH; } }

  // GO / NO-GO
  newPage(); para("Go's & No-Go's",M,24,FB,INK,CW,6); para("Das Wichtigste auf einen Blick",M,12,F,MUT,CW,6); y-=6;
  for(const [items,isGo] of [[T.go,true],[T.no,false]]){ const col=isGo?GREEN:RED; need(24); page.drawText(isGo?"SO MACHST DU'S RICHTIG":"DAS VERMEIDEST DU",{x:M,y:y-12,size:12,font:FB,color:col}); y-=24;
    for(const [t,d,dir,base] of items){ const im=await img(dir,base,null); const iw=110,ih=im?iw*im.height/im.width:82,rowH=Math.max(ih,54)+12; need(rowH); const top=y;
      if(im) page.drawImage(im,{x:M,y:top-ih,width:iw,height:ih}); const tx=im?M+iw+14:M;
      page.drawText((isGo?"+ ":"x ")+S(D(t)),{x:tx,y:top-14,size:13,font:FB,color:col});
      let ty=top-14-16; wrap(D(d),F,11,CW-(im?iw+14:0)).forEach(l=>{page.drawText(l,{x:tx,y:ty,size:11,font:F,color:TXT});ty-=14;}); y=top-rowH; } y-=8; }

  // SCHLUSS
  newPage(); page.drawRectangle({x:0,y:A4_H-120,width:A4_W,height:120,color:SOFT}); page.drawText("Pfoten-Plan",{x:M,y:A4_H-46,size:14,font:FB,color:GOLDDK});
  y=A4_H-84; page.drawText(S("Zum Schluss"),{x:M,y:y-24,size:26,font:FB,color:INK}); y=A4_H-150; T.closing.forEach(p=>{ para(p,M,12.5,F,TXT,CW,8); y-=8; });

  return await doc.save();
}
