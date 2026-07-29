import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

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
    title: "Cane che abbaia alla porta",
    situation: "Suona il campanello e il tuo cane impazzisce: abbaia senza sosta, si lancia verso la porta e si calma a fatica. Questo stressa te, i tuoi ospiti e il cane stesso.",
    steps: [
      { title: "Dai un segnale di calma", desc: "Di' con calma e fermezza \"LASCIA\" oppure \"CALMA\". Non urlare, perché aumenta solo l'eccitazione. Aspetta che il cane ti guardi." },
      { title: "Manda il cane al suo posto", desc: "Manda il cane al suo posto fisso (tappetino, cuccia). Indica là con la mano con calma. Quando si sdraia, conferma con \"BRAVO\" oppure con un premietto." },
      { title: "Gestisci l'ospite", desc: "Chiedi all'ospite di aspettare un momento. Vai alla porta, copri lo spiraglio con il tuo corpo e apri solo quando il cane non è più proprio lì vicino. Realisticamente: non deve essere perfetto, conta ogni secondo di calma." },
      { title: "Premia il comportamento calmo", desc: "Non appena il cane resta calmo nel momento in cui apri la porta, premialo. Ignora completamente ogni nuovo abbaio: girati, nessun contatto visivo." },
      { title: "Allenati 5 volte al giorno senza ospiti", desc: "Suona tu stesso il campanello, manda il cane al suo posto. Bastano 5 ripetizioni al giorno. Dopo 1 o 2 settimane la routine si consolida e funziona anche con ospiti veri." },
    ],
    tipp: "Inizia con suoni del campanello bassi e aumenta il volume gradualmente. Così non sovraccarichi il cane.",
    wennNicht: [
      "L'eccitazione è troppo alta? Torna indietro di 3 passi: allena prima il comando \"POSTO\" SENZA campanello, finché non è padroneggiato al 100 percento. Solo dopo unisci le due cose.",
      "Non vuole andare al posto? Non forzarlo mai, attiralo là con un premietto. Ripetilo 10 volte al giorno senza stress, finché il posto non inizia ad avere per lui un'associazione positiva.",
      "Funziona solo senza un ospite vero? È normale! Aumenta il livello lentamente: prima il campanello senza ospiti, poi con persone conosciute, poi con estranei.",
    ],
  },
  {
    nr: 2,
    title: "Cane che tira all'improvviso",
    situation: "Camminate tranquilli a passeggio e all'improvviso il tuo cane tira con tutta la forza in una direzione: uno scoiattolo, un altro cane o un odore interessante.",
    steps: [
      { title: "Fermati subito", desc: "Resta immobile come un palo. Non fare nemmeno un passo nella direzione in cui il cane tira. Tieni il guinzaglio saldo, ma non strattonare all'indietro, resta semplicemente fermo." },
      { title: "Aspetta che il guinzaglio si allenti", desc: "Resta semplicemente immobile e aspetta. Alla fine il cane smetterà di tirare, anche se ci vorranno 30 secondi. Qui conta la pazienza." },
      { title: "Cambia direzione", desc: "Non appena il guinzaglio si allenta, girati e vai dall'altra parte. Di' nel farlo con calma \"Da questa parte\". Fallo con coerenza ogni volta." },
      { title: "Premia subito il guinzaglio lento", desc: "Non appena il cane cammina accanto a te con il guinzaglio lento, lodalo subito: \"BRAVO!\" oppure dagli un premietto. Così impara: guinzaglio lento significa che andiamo avanti." },
      { title: "Premia ogni 10-15 passi", desc: "Nelle prime settimane premia il guinzaglio lento ogni 10-15 passi. Sembra tanto, ma costruisce l'abitudine. Più avanti basterà ogni pochi minuti." },
    ],
    tipp: "Porta con te premietti di valore, formaggio o affettato. I croccantini secchi non batteranno uno scoiattolo.",
    wennNicht: [
      "Lo stimolo è troppo forte? Allena prima in un ambiente tranquillo (giardino, strada silenziosa). Quando funziona lì, aumenta il livello lentamente.",
      "Tira comunque come un pazzo? Una pettorina con anello frontale devia la forza di trazione di lato e rende scomodo il tirare. A molti cani questo aiuta subito.",
      "Ti fa quasi cadere? Non avvolgere MAI il guinzaglio intorno alla mano. Tienilo saldo con entrambe le mani davanti al corpo. Con cani molto forti usa un guinzaglio da 3 metri invece del flexi.",
    ],
  },
  {
    nr: 3,
    title: "Cane che abbaia a un altro cane",
    situation: "Incontrate un altro cane e il tuo abbaia, ringhia o strattona al guinzaglio. Non sai se è paura o aggressività, ma ti senti a disagio.",
    steps: [
      { title: "Aumenta la distanza", desc: "Allontanati subito di 3-5 metri di lato oppure torna indietro. Il tuo cane ha bisogno di più distanza per sentirsi al sicuro. Trova la distanza a cui vede l'altro cane ma non impazzisce." },
      { title: "Porta l'attenzione su di te", desc: "Avvicina un premietto al naso e di' il suo nome. Non appena guarda te invece dell'altro cane, di' \"Sì!\" e dagli il premietto." },
      { title: "Pioggia di premietti quando incontrate un cane", desc: "Finché l'altro cane è in vista, dai un premietto ogni 2-3 secondi. Il tuo cane impara: un altro cane significa pioggia di premietti da me." },
      { title: "Aggira con un ampio arco", desc: "Passa con un ampio arco accanto all'altro cane. Sei tu a stare tra i cani. Loda il cane per ogni secondo di calma. Resta calmo tu stesso, perché il tuo stress gli si trasmette." },
      { title: "Festeggia il successo e vai avanti", desc: "Quando ormai vi siete superati: grande lode, premietto extra. Trasformalo in un'esperienza positiva. Più spesso il tuo cane supera con calma un altro, più questo diventa normale." },
    ],
    tipp: "Inizia da una distanza superiore a 20 metri. Riduci la distanza solo quando il cane resta calmo 3 volte di fila.",
    wennNicht: [
      "Importante: escludi prima dal veterinario il dolore. I cani che soffrono reagiscono spesso in modo aggressivo verso gli altri, è una causa frequente e trascurata.",
      "Non prende il premietto? Significa che sei troppo vicino. Aumenta la distanza in modo netto, anche fino a 30 metri. Lavora per settimane sull'avvicinamento.",
      "Porta i migliori premietti che hai (paté, formaggio). I normali croccantini secchi non bastano con un livello di stress alto, ti serve qualcosa di più forte dello stimolo.",
    ],
  },
  {
    nr: 4,
    title: "Cane che salta addosso agli ospiti",
    situation: "Arrivano ospiti e il tuo cane salta, lecca le facce, è completamente entusiasta. Alcuni ospiti lo trovano adorabile, altri hanno paura.",
    steps: [
      { title: "Istruisci prima tutti gli ospiti", desc: "Spiega a OGNI ospite la regola in anticipo: nessun contatto visivo, nessun tocco quando il cane salta. Una sola persona che lo trova \"adorabile\" rovina una settimana di allenamento." },
      { title: "Fai ignorare completamente", desc: "Ognuno deve girarsi quando il cane salta. Braccia incrociate, sguardo al soffitto. Nessun rimprovero, perché l'attenzione negativa è pur sempre attenzione." },
      { title: "Fai rispettare il \"SEDUTO\"", desc: "Non appena il cane sta sulle quattro zampe, di' \"SEDUTO\". Quando si siede, l'ospite può salutarlo con calma, una breve carezza, voce tranquilla." },
      { title: "In caso di ricaduta interrompi subito", desc: "Se salta di nuovo, l'ospite si gira di nuovo subito. Nessun avanti e indietro, la regola è cristallina: quattro zampe a terra significano attenzione." },
      { title: "Gestisci i primi 2 minuti", desc: "La massima eccitazione è nei primi 2 minuti. Resisti! Poi il cane si calma. Dopo 1 o 2 settimane capirà: stare seduto dà più che saltare." },
    ],
    tipp: "Allenati anche da solo: esci dalla porta, rientra. Ignora quando salta, premia quando sta seduto.",
    wennNicht: [
      "Non smette proprio? Non iniziare con ospiti veri. Allenati prima con una persona che il cane conosce bene e con cui è meno eccitato.",
      "Aggancia il cane al guinzaglio prima che arrivino gli ospiti. Così fisicamente non può saltare e impara più in fretta che stare seduto è l'opzione migliore.",
      "Il tuo ospite non rispetta le regole? Allora chiedigli di aspettare fuori finché il cane non si è calmato.",
    ],
  },
  {
    nr: 5,
    title: "Cane che raccoglie qualcosa da terra",
    situation: "Il tuo cane afferra qualcosa da terra durante la passeggiata: un vecchio panino, qualcosa di indefinito, forse persino un'esca avvelenata.",
    steps: [
      { title: "Mantieni la calma", desc: "Non lanciarti bruscamente ad afferrare, perché questo accelera solo il cane. Fermati e fai un breve respiro. La fretta per il cane è competizione." },
      { title: "Di' \"LASCIA\" e mostra un premietto", desc: "Di' con calma e fermezza \"LASCIA\". Allo stesso tempo avvicina un premietto di valore proprio sotto il naso (formaggio, paté). La maggior parte dei cani molla quando l'alternativa è migliore." },
      { title: "Scambia invece di togliere", desc: "Non appena lascia l'oggetto, di' \"Sì!\" e dai subito il premietto. Poi raccogli con calma l'oggetto. Non rincorrere mai, perché si trasforma in un gioco." },
      { title: "Allena in casa con un giocattolo", desc: "Allena il \"LASCIA\" ogni giorno con un giocattolo. Dai il giocattolo, di' \"LASCIA\", avvicina un premietto. Quando molla, riceve il premietto e il giocattolo indietro. Così impara: mollare conviene." },
      { title: "Cammina con anticipo", desc: "Scruta il terreno 5 metri davanti a te. Se vedi qualcosa di sospetto, allontana il cane in anticipo. Prevenire è più facile che reagire." },
    ],
    tipp: "In caso di sospetta esca avvelenata: apri con cautela la bocca, non premere. In caso di dubbio subito dal veterinario.",
    wennNicht: [
      "Non vuole mollare assolutamente nulla? Scambia con qualcosa di ancora migliore. Il paté dal tubetto proprio sotto il naso è per la maggior parte dei cani irresistibile.",
      "Allena lo scambio centinaia di volte in casa, prima con oggetti noiosi, poi con oggetti sempre più interessanti. All'aperto lo scambio deve essere una routine.",
      "Ingoia subito? Allena il \"MOSTRA\", il cane deve mostrarti i ritrovamenti, SENZA raccoglierli. Richiede tempo, ma previene l'ingestione.",
    ],
  },
  {
    nr: 6,
    title: "Cane che insegue jogger o ciclisti",
    situation: "Accanto passa di corsa un jogger o sfreccia un ciclista e il tuo cane vuole seguirlo: strattona il guinzaglio, abbaia, si carica completamente.",
    steps: [
      { title: "Riconosci per tempo e preparati", desc: "Non appena vedi un jogger o un ciclista, accorcia il guinzaglio (ma non metterlo in tensione). Mettiti di lato, così il cane non può lanciarsi dritto sull'obiettivo." },
      { title: "Imposta l'ancoraggio sul premietto", desc: "Di' con calma \"GUARDA\" e tieni il premietto vicino al viso. Il tuo cane deve imparare che \"GUARDA\" significa che da te c'è qualcosa di buono." },
      { title: "Mantieni il seduto e il contatto visivo", desc: "Di' \"SEDUTO\" e mantieni il contatto visivo. Finché il cane guarda te invece del jogger, dagli un premietto ogni 2-3 secondi. La festa sei tu, non il jogger." },
      { title: "Fallo passare e premia con forza", desc: "Aspetta che il jogger sia passato completamente. Poi: \"BRAVO!\" più grande lode più premietto extra. Il tuo cane impara: la calma significa che succede qualcosa di buono." },
      { title: "Il guinzaglio da addestramento come strumento più importante", desc: "Con l'istinto predatorio un guinzaglio da addestramento da 10 metri è il tuo migliore amico. Dà al cane libertà di movimento, ma tu mantieni il controllo. Fissalo sempre alla pettorina (mai al collare!) e lascia che strisci per terra, mettici il piede sopra quando il cane vuole partire." },
    ],
    tipp: "Trova un percorso dove passano regolarmente jogger e allenati lì di proposito con il guinzaglio da addestramento. La ripetizione è la chiave.",
    wennNicht: [
      "Impazzisce nonostante il premietto? L'istinto predatorio è uno degli istinti più forti. Inizia con video di jogger sul telefono, premia la visione tranquilla. Poi da grande distanza jogger veri.",
      "Allena il controllo degli impulsi a parte: premietto a terra, il cane deve aspettare, mangiare solo al segnale. Questo rafforza l'autocontrollo e aiuta con ogni stimolo, non solo con i jogger.",
      "Non lasciare mai che il guinzaglio da addestramento si tenda bruscamente, perché ferisce il cane. Metti il piede delicatamente oppure frena con la mano (indossa i guanti!). La pratica rende perfetti.",
    ],
  },
  {
    nr: 7,
    title: "Cane che abbaia in auto",
    situation: "Il tuo cane abbaia senza sosta in auto: a ogni passante, a ogni cane, a ogni semaforo. Il viaggio in auto si trasforma in un incubo.",
    steps: [
      { title: "Limita il campo visivo", desc: "Copri i finestrini (parasole, coperta). Meno stimoli significa meno abbaio. L'ideale è un trasportino, in cui il cane vede meno e si sente al sicuro." },
      { title: "Allena in auto ferma", desc: "Siediti con il cane nell'auto parcheggiata. Motore spento. Quando è calmo: premietto. Quando abbaia: aspetta, ignora. Non appena smette (anche solo per 3 secondi): premia subito." },
      { title: "Motore acceso, stesso esercizio", desc: "Quando l'auto ferma funziona, accendi il motore. Le stesse regole: calma significa premietto, l'abbaio lo ignori. Solo quando questo è padroneggiato, parti." },
      { title: "Costruisci brevi tragitti", desc: "Guida solo 2 minuti, poi pausa. Quando il cane resta calmo: scendete, grande lode, breve passeggiata. Allunga il tempo di guida lentamente nei giorni successivi." },
      { title: "Proponi un'occupazione", desc: "Un kong riempito o un osso da masticare fa miracoli in auto. Il tuo cane è occupato e ha meno energia per abbaiare. Dai il kong SOLO in auto, così il viaggio diventa positivo." },
    ],
    tipp: "All'inizio guidate solo verso posti fantastici (bosco, area cani). Così il cane associa il viaggio in auto a esperienze positive.",
    wennNicht: [
      "Abbaia nonostante i finestrini coperti? Sente i suoni. Metti musica tranquilla o un podcast per coprire i rumori esterni.",
      "Se abbaia nel trasportino: coprilo con una coperta. Alcuni cani sono estremamente stressati in auto, in quel caso all'inizio guidate solo avanti e indietro nel vialetto.",
      "Il tuo cane vomita in auto? Non è un problema di comportamento, ma cinetosi. Parla con il veterinario di rimedi per questo.",
    ],
  },
  {
    nr: 8,
    title: "Cane che ringhia mentre mangia",
    situation: "Il tuo cane ringhia o dà un colpo di denti quando ti avvicini alla ciotola. Hai paura che ti morda, soprattutto quando in casa ci sono bambini.",
    steps: [
      { title: "Proteggi subito bambini e conviventi", desc: "Regola più importante: finché il cane ringhia alla ciotola, i bambini NON possono avvicinarsi. Senza eccezioni. Dai da mangiare in un posto tranquillo, dove nessuno passa accanto per caso." },
      { title: "Mantieni la distanza e rispettala", desc: "Il ringhio è un avvertimento, rispettalo. Torna indietro di 2-3 metri. Non togliere mai la ciotola per mostrare chi comanda, perché peggiora nettamente la situazione." },
      { title: "Da lontano lancia qualcosa di buono", desc: "Passa a distanza di sicurezza accanto alla ciotola e lanciaci dentro qualcosa di gustoso (un pezzo di formaggio, di pollo). Non mettere la mano! Così il cane impara: la persona si avvicina significa che il mio cibo diventa MIGLIORE." },
      { title: "Costruisci un'associazione positiva", desc: "Ripetilo a ogni pasto. Nel corso delle settimane riduci lentamente la distanza: prima 2 metri, poi 1,5, poi 1. Sempre con una ricompensa. Non avere fretta." },
      { title: "Dai da mangiare dalla mano", desc: "Per un po' dai una parte del pasto direttamente dalla mano. Così diventi la fonte del cibo invece di una minaccia. Il tuo cane prende fiducia che non gli togli nulla." },
    ],
    tipp: "Separa chiaramente il luogo del pasto dalla zona famiglia. Un posto per i pasti fisso e tranquillo riduce enormemente lo stress durante il pasto, per tutti.",
    wennNicht: [
      "Il tuo cane dà già colpi di denti? NON è un fallimento, la difesa delle risorse è un tema serio. Chiedi aiuto professionale a un educatore cinofilo certificato.",
      "Fino ad allora: dai da mangiare in un posto fisso, non disturbare e tieni i bambini a distanza. La sicurezza sempre prima dell'allenamento.",
      "Ti senti insicuro? Fidati del tuo istinto. Va bene chiedere aiuto. Alcuni problemi richiedono la presenza di uno specialista sul posto.",
    ],
  },
  {
    nr: 9,
    title: "Cane che va in panico durante il temporale",
    situation: "Tuona e il tuo cane trema, ansima, si nasconde o abbaia in preda al panico. Vuoi aiutare, ma non sai di cosa ha bisogno ora.",
    steps: [
      { title: "Offri un rifugio tranquillo", desc: "Porta il cane in una stanza interna con poche finestre. Tira le tende, metti giù la sua copertina preferita. Se vuole andare sotto il tavolo, lasciaglielo fare." },
      { title: "Copri i rumori", desc: "Metti la musica o la TV a basso volume per coprire i tuoni. Suoni tranquilli e regolari funzionano meglio." },
      { title: "Stai vicino con calma e dai un senso di sicurezza", desc: "Puoi accarezzare il cane con calma e stargli vicino, questo non rafforza la paura. L'importante è solo: resta rilassato tu stesso. Consolare con nervosismo o parlare in modo agitato gli trasmette il TUO turbamento." },
      { title: "Mostra normalità", desc: "Fai cose normali: vai in cucina, siediti, sbadiglia in modo plateale. Proponi un osso da masticare, se lo prende è un buon segno." },
      { title: "Desensibilizza sul lungo periodo", desc: "Riproduci a basso volume i rumori del temporale e dai nel frattempo dei premietti. Aumenta il volume lentamente nel corso delle settimane. Così il cane impara: il tuono significa che è ora dei premietti." },
    ],
    tipp: "Non forzare le passeggiate durante il temporale. Se il cane non vuole fare i bisogni, va bene. Aspettate insieme che passi.",
    wennNicht: [
      "Il tuo cane è nel panico assoluto (trema fortissimo, corre senza orientamento)? Questo va oltre il normale allenamento. Parla con il veterinario di un supporto.",
      "Esistono calmanti a base di erbe e, nei casi gravi, un aiuto farmacologico. Non è una debolezza, alcuni cani hanno vere fobie dei rumori.",
      "I gilet compressivi (giubbotti aderenti) aiutano alcuni cani grazie alla leggera pressione. Provalo, in circa il 50 percento dei cani porta un effetto.",
    ],
  },
  {
    nr: 10,
    title: "Cane che tira verso un altro cane",
    situation: "Il tuo cane vede un altro cane e vuole assolutamente raggiungerlo: tira, guaisce, abbaia per l'eccitazione. Vieni trascinato per tutto il quartiere.",
    steps: [
      { title: "Fermati subito", desc: "Fermati non appena il cane inizia a tirare. Non farti trascinare, nemmeno \"solo per annusare un attimo\". La regola è cristallina: tirare significa che non andiamo avanti." },
      { title: "Fai rispettare il contatto visivo", desc: "Di' \"GUARDAMI\". Tieni il premietto vicino al viso. Non appena il cane ti guarda, anche solo per un secondo, di' \"Sì!\" e dai il premietto." },
      { title: "Aspetta che il guinzaglio si allenti", desc: "Vai avanti solo quando il guinzaglio pende completamente lento e il cane è rilassato. Può volerci un po', resisti. Qui la coerenza è tutto." },
      { title: "Permetti il contatto solo con la calma", desc: "Quando il guinzaglio è lento ed entrambi i cani sembrano rilassati, ALLORA puoi avvicinarti. Regola: se uno dei due è eccitato, vi superate con un arco." },
      { title: "Non permettere ogni incontro", desc: "La maggior parte degli incontri con i cani non deve avvenire. Il tuo cane deve imparare che non ogni cane è un compagno di giochi, e questo va assolutamente bene." },
    ],
    tipp: "Premia il cane ogni volta che vede un altro cane e nonostante ciò guarda te. Vale oro.",
    wennNicht: [
      "Ti ignora completamente? Ha superato la sua soglia di eccitazione. Aumenta la distanza in modo netto, lavora prima da una distanza di 20-30 metri.",
      "Premia ogni volta che vede un cane e NON impazzisce. Nel corso delle settimane più vicino. Pazienza! La frustrazione dalla tua parte si trasmette.",
      "Il tuo cane vuole raggiungere OGNI cane? Spesso è frustrazione, perché non può mai. Permetti a volte un contatto controllato con cani tranquilli, questo toglie pressione.",
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
  console.log("Avvio generazione PDF...");
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const fontRegular = await doc.embedFont(readFileSync(join(process.cwd(), "public", "fonts", "Arimo-Regular.ttf")), { subset: true });
  const fontBold = await doc.embedFont(readFileSync(join(process.cwd(), "public", "fonts", "Arimo-Bold.ttf")), { subset: true });
  const fontItalic = await doc.embedFont(readFileSync(join(process.cwd(), "public", "fonts", "Arimo-Italic.ttf")), { subset: true });

  const MARGIN = 50;
  const CONTENT_W = A4_W - 2 * MARGIN;

  // ===== OKLADKA =====
  const cover = doc.addPage([A4_W, A4_H]);
  cover.drawRectangle({ x: 0, y: 0, width: A4_W, height: A4_H, color: WHITE });
  cover.drawRectangle({ x: 0, y: A4_H - 8, width: A4_W, height: 8, color: GOLD });

  const titleText = "Schede di emergenza";
  const titleWidth = fontBold.widthOfTextAtSize(titleText, 36);
  cover.drawText(titleText, { x: (A4_W - titleWidth) / 2, y: A4_H - 120, size: 36, font: fontBold, color: TEXT_DARK });

  const subtitle = "10 soluzioni immediate per le situazioni difficili più comuni";
  const subWidth = fontRegular.widthOfTextAtSize(subtitle, 15);
  cover.drawText(subtitle, { x: (A4_W - subWidth) / 2, y: A4_H - 155, size: 15, font: fontRegular, color: TEXT_MEDIUM });

  const descText = "Ogni scheda ti spiega passo dopo passo cosa puoi fare in una tipica situazione difficile con il cane. In modo chiaro, calmo, subito applicabile. Da stampare o da salvare sul telefono.";
  const descLines = wrapText(descText, fontRegular, 12, CONTENT_W - 60);
  let descY = A4_H - 220;
  for (const line of descLines) {
    const lw = fontRegular.widthOfTextAtSize(line, 12);
    cover.drawText(line, { x: (A4_W - lw) / 2, y: descY, size: 12, font: fontRegular, color: TEXT_MEDIUM });
    descY -= 18;
  }

  let overviewY = descY - 30;
  cover.drawText("Indice:", { x: MARGIN + 30, y: overviewY, size: 14, font: fontBold, color: TEXT_DARK });
  overviewY -= 28;
  for (const k of karten) {
    cover.drawText(`${k.nr}.`, { x: MARGIN + 40, y: overviewY, size: 12, font: fontBold, color: GOLD });
    cover.drawText(k.title, { x: MARGIN + 65, y: overviewY, size: 12, font: fontRegular, color: TEXT_DARK });
    overviewY -= 22;
  }

  const footerText = "ZampaPlan · zampaplan.it";
  const footerWidth = fontRegular.widthOfTextAtSize(footerText, 10);
  cover.drawText(footerText, { x: (A4_W - footerWidth) / 2, y: 40, size: 10, font: fontRegular, color: TEXT_MEDIUM });
  cover.drawRectangle({ x: 0, y: 0, width: A4_W, height: 4, color: GOLD });

  // ===== KARTY =====
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

    page.drawText("Situazione", { x: MARGIN, y, size: 10.5, font: fontBold, color: DARK_BROWN });
    y -= 15;
    const situationLines = wrapText(karte.situation, fontRegular, 10.5, CONTENT_W);
    for (const line of situationLines) {
      page.drawText(line, { x: MARGIN, y, size: 10.5, font: fontRegular, color: TEXT_MEDIUM });
      y -= 14;
    }
    y -= 12;

    // 5 krokow - wszystkie w DARK_BROWN, wiecej odstepu
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

    page.drawText("Consiglio:", { x: MARGIN + 12, y, size: 9.5, font: fontBold, color: DARK_BROWN });
    y -= 13;
    for (const line of tippLines) {
      page.drawText(line, { x: MARGIN + 12, y, size: 9.5, font: fontRegular, color: TEXT_MEDIUM });
      y -= 12;
    }

    // "Co, jesli pies nie wspolpracuje?" Box - 3 punkty
    y -= 16;
    const wennNichtTitle = "E se il tuo cane non collabora?";

    // Oblicz calkowita wysokosc
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

    const pageFooter = `Scheda di emergenza ${karte.nr}/10 · ZampaPlan`;
    const pfWidth = fontRegular.widthOfTextAtSize(pageFooter, 9);
    page.drawText(pageFooter, { x: (A4_W - pfWidth) / 2, y: 30, size: 9, font: fontRegular, color: TEXT_MEDIUM });
    page.drawRectangle({ x: 0, y: 0, width: A4_W, height: 3, color: GOLD });
  }

  const pdfBytes = await doc.save();
  writeFileSync(join(process.cwd(), "public", "notfall-karten-it.pdf"), pdfBytes);
  console.log(`PDF salvato: public/notfall-karten-it.pdf (${pdfBytes.byteLength} bytes)`);
}

main().catch(console.error);
