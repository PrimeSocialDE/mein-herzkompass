// Value-/Warmup-Mails im ue50-Ton, pro Hunde-Problem eine konkrete Gratis-Uebung.
// Genutzt vom Cron /api/cron/warmup-send. DE-Zielgruppe (email_captured).

// dog_problem -> Thema
export const WARMUP_THEME_MAP: Record<string, string> = {
  energy: "energy",
  recall: "recall", chasing: "recall", "chasing-cars": "recall", "chasing-movement": "recall", "prey-drive": "recall",
  pulling: "pulling",
  aggression: "aggression", "dog-reactive": "aggression", "leash-reactive": "aggression", overreaction: "aggression", "anxious-overreaction": "aggression",
  mouthing: "mouthing", "eating-unwanted": "mouthing", "eating-objects": "mouthing", "eating-trash": "mouthing",
};

interface ThemeDef {
  marketing: string;
  subject: (d: string) => string;
  intro: (d: string) => string;
  exTitle: string;
  steps: (d: string) => string[];
  after: (d: string) => string;
  cta: (d: string) => string;
}

const THEMES: Record<string, ThemeDef> = {
  energy: {
    marketing: "marketing-energie.html",
    subject: (d) => `Eine einfache 10-Minuten-Übung, die ${d} abends ruhiger macht`,
    intro: (d) => `vielleicht kennst du das: Ihr wart lange draußen, und trotzdem kommt ${d} abends einfach nicht zur Ruhe.<br><br>Das ist ganz normal, und es liegt nicht an dir.<br><br>Viele denken dann, sie müssten noch mehr rausgehen. Aber das macht ${d} nur wacher, nicht ruhiger. Was wirklich müde macht, ist <b>Kopfarbeit</b>. Hier eine Übung, die du ganz in deinem Tempo machen kannst:`,
    exTitle: "Die Schnüffel-Suche (10 Minuten)",
    steps: (d) => [`Nimm eine Handvoll von ${d}s normalem Futter.`, `Verteile es in der Wohnung, erst offen sichtbar, dann etwas versteckter.`, `Sag ruhig „Such" und lass ${d} in Ruhe arbeiten.`, `Wenn er fertig ist, biete ihm seine Decke an und setz dich ruhig dazu.`],
    after: () => `Zwei Wochen lang jeden Abend, und du wirst den Unterschied merken. Du brauchst dafür nichts zu kaufen und keine besondere Ausrüstung.`,
    cta: (d) => `So sieht ${d}s kompletter Plan aus`,
  },
  recall: {
    marketing: "marketing-rueckruf.html",
    subject: (d) => `Damit ${d} wieder zu dir kommt, wenn du rufst`,
    intro: (d) => `kennst du das? Du rufst ${d}, und er läuft einfach weiter.<br><br>Das ist kein Ungehorsam. Meist ist das Wort „Hier" für ${d} nur noch nicht spannend genug. Das lässt sich in Ruhe ändern, hier die Übung:`,
    exTitle: "Der Freuden-Rückruf (5 Minuten, drinnen)",
    steps: (d) => [`Warte einen Moment, in dem ${d} sowieso in deine Richtung schaut.`, `Sag fröhlich seinen Namen und „Hier".`, `Kommt er, gib ihm nicht nur ein Leckerli, sondern drei kleine hintereinander. Das ist der Jackpot.`, `Ruf „Hier" nie, wenn du weißt, dass er gerade nicht kommt. Sonst verliert das Wort seinen Wert.`],
    after: (d) => `So wird „Hier" für ${d} zum besten Wort des Tages. Erst drinnen üben, dann im Garten, dann draußen. Ganz in deinem Tempo.`,
    cta: (d) => `So sieht ${d}s Rückruf-Plan aus`,
  },
  pulling: {
    marketing: "marketing-leinen.html",
    subject: (d) => `Der einfache Trick, mit dem ${d} an der Leine nicht mehr zieht`,
    intro: (d) => `zieht ${d} dich an der Leine hinter sich her? Das ist anstrengend, und es liegt nicht an dir.<br><br>${d} hat einfach gelernt: Ziehen bringt mich schneller ans Ziel. Diese eine Technik dreht das um:`,
    exTitle: "Sei ein Baum",
    steps: (d) => [`Sobald die Leine straff wird, bleib sofort stehen. Ganz ruhig, kein Ruck.`, `Warte, bis ${d} die Spannung von selbst löst und die Leine wieder locker ist.`, `In dem Moment sagst du „Fein" und gehst weiter. Lockere Leine heißt: es geht weiter.`, `Die ersten Tage kommt ihr kaum vom Fleck. Das ist normal und genau der Sinn der Sache.`],
    after: (d) => `${d} lernt so ganz ohne Zwang: nur bei lockerer Leine geht es vorwärts. Nach ein, zwei Wochen wird das Spazieren wieder entspannt.`,
    cta: (d) => `So sieht ${d}s Leinen-Plan aus`,
  },
  aggression: {
    marketing: "marketing-aggression.html",
    subject: (d) => `Wenn ${d} an der Leine bellt: der Abstand, der alles verändert`,
    intro: (d) => `bellt und zieht ${d} an der Leine, sobald ein anderer Hund auftaucht? Das ist meist kein Aggressionsproblem, sondern Stress und Überforderung.<br><br>Die gute Nachricht: der wichtigste Hebel ist ganz einfach, nämlich Abstand. Hier die Übung:`,
    exTitle: "Leckerli-Regen auf Abstand",
    steps: (d) => [`Finde den Abstand, ab dem ${d} einen anderen Hund sieht, aber noch ruhig bleibt. Oft sind das 15 bis 30 Meter.`, `Solange der andere Hund zu sehen ist, gib alle paar Sekunden ein Leckerli.`, `Ist der andere weg, hörst du auf. So lernt ${d}: anderer Hund heißt, bei mir wird es schön.`, `Bellt er doch, war der Abstand zu klein. Geh einfach ein Stück weiter weg.`],
    after: (d) => `Über die Wochen wird der Abstand von ganz allein kleiner. Du veränderst so das Gefühl von ${d}, nicht nur das Verhalten.`,
    cta: (d) => `So sieht ${d}s Plan aus`,
  },
  mouthing: {
    marketing: "kurz-schritt1",
    subject: (d) => `Damit ${d} nichts mehr vom Boden aufnimmt`,
    intro: (d) => `schnappt sich ${d} draußen alles vom Boden? Das ist verständlicherweise ein mulmiges Gefühl.<br><br>Der häufigste Fehler ist, hinterherzujagen, denn das macht es für ${d} zum Spiel. Der Schlüssel ist tauschen, nicht wegnehmen:`,
    exTitle: "Das Tausch-Geschäft",
    steps: (d) => [`Übe zuerst drinnen mit einem langweiligen Gegenstand. Gib ihn ${d} und sag ruhig „Aus".`, `Halt gleichzeitig ein besonders gutes Leckerli an seine Nase.`, `Lässt er los, sagst du „Ja" und gibst das Leckerli. Loslassen lohnt sich also.`, `Jag ihm nie hinterher, wenn er etwas hat. Tausch lieber gegen etwas Besseres.`],
    after: (d) => `Wenn ${d} gelernt hat, dass Hergeben sich lohnt, gibt er auch draußen freiwillig ab. Übe erst ohne Ablenkung, dann steigerst du langsam.`,
    cta: (d) => `So sieht ${d}s Plan aus`,
  },
};

export function warmupSubject(theme: string, dog: string): string {
  return (THEMES[theme] || THEMES.energy).subject(dog);
}

export function buildWarmupHtml(theme: string, dog: string, leadId: string, email: string): string {
  const t = THEMES[theme] || THEMES.energy;
  const link = `https://www.pfoten-plan.de/${t.marketing}?lead_id=${leadId}&email=${encodeURIComponent(email)}&utm_source=email&utm_medium=warmup&utm_campaign=warmup-${theme}`;
  const p = "margin:0 0 18px;font-size:17px;line-height:1.7;color:#1a1a1a;";
  const steps = t.steps(dog).map((s, i) => `<p style="margin:0 0 8px;font-size:16px;line-height:1.65;color:#3a342b;"><b>${i + 1}.</b> ${s}</p>`).join("");
  const unsub = `https://www.pfoten-plan.de/api/unsubscribe?lead=${leadId}`;
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;padding:8px 4px;">
<p style="${p}">Hallo,</p>
<p style="${p}">${t.intro(dog)}</p>
<div style="background:#FAF8F5;border-left:5px solid #A9884F;border-radius:0 12px 12px 0;padding:20px 22px;margin:0 0 22px;">
<p style="margin:0 0 12px;font-size:18px;font-weight:800;color:#8B7355;">${t.exTitle}</p>
${steps}
</div>
<p style="${p}">${t.after(dog)}</p>
<p style="text-align:center;margin:30px 0 12px;"><a href="${link}" style="background:#A9884F;color:#fff;text-decoration:none;font-weight:800;font-size:18px;padding:17px 34px;border-radius:12px;display:inline-block;">${t.cta(dog)}</a></p>
<p style="text-align:center;font-size:15px;color:#6E655A;margin:0 0 24px;line-height:1.6;">Den Plan kannst du dir auch ausdrucken und Woche für Woche abhaken.<br>Einmalig &middot; kein Abo &middot; 30 Tage Geld-zurück.</p>
<p style="${p}color:#6E655A;">Herzliche Grüße<br>Max von Pfoten-Plan</p>
<p style="text-align:center;font-size:12px;color:#9a9186;margin-top:24px;border-top:1px solid #ECE3D5;padding-top:14px;">Pfoten-Plan &middot; Du willst keine Mails mehr? <a href="${unsub}" style="color:#9a9186;">Hier abmelden</a>.</p>
</div>`;
}
