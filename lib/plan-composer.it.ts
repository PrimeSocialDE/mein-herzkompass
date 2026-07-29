// Plan-Composer — deterministisch + super schnell (<50ms).
//
// Liefert TrainingPlanContent mit:
//   - WIRKLICH individuellen Wochen (jede Woche eigenes Thema, Ziel, Tagesplan)
//   - 8 unique Wochen-Templates pro Phase → 24 unterschiedliche Wochen für 6-Monat
//   - Ausführliche, problem-spezifische Monats-Übersichten
//
// Optional: lib/plan-intro-ai.ts ergänzt den introText via Claude Sonnet
// (5-8 Sekunden, ~0.5ct).

// IT-Variante: Werte aus der italienischen Bibliothek, per Alias auf die
// bisherigen Namen gemappt, damit der uebersetzte Body-Code unveraendert
// bleibt. Struktur-Typen (ProblemKey/Phase) kommen aus der DE-Basisdatei,
// ExerciseTemplate aus der IT-Datei (analog plan-composer.pl.ts).
import {
  EXERCISE_LIBRARY_IT as EXERCISE_LIBRARY,
  PROBLEM_LABELS_IT as PROBLEM_LABELS_DE,
} from "./exercise-library.it";
import type { ProblemKey, Phase } from "./exercise-library";
import type { ExerciseTemplate } from "./exercise-library.it";
import type { TrainingPlanContent } from "./member-plan-content";

export interface DogProfile {
  dogName: string;
  dogBreed?: string;
  dogAgeMonths?: number;
  dogSize?: "small" | "medium" | "large";
  /** "m" / "rüde" = männlich, sonst weiblich (Default). Beeinflusst Pronomen. */
  dogGender?: string;
  trainingsZeitMinuten?: number;
  isSenior?: boolean;
  bekannteSignale?: string[];
}

export interface ComposeArgs {
  problem: ProblemKey;
  planLengthMonths: 1 | 3 | 6;
  dog: DogProfile;
  introText?: string;
  zieleText?: string;
  abschlussText?: string;
  customProblemText?: string;
}

// ── Helper di personalizzazione ────────────────────────────────────
// I testi usano il segnaposto {dogName}. Se manca il nome del cane,
// usiamo un fallback neutro. Nessuno swap di genere come nella versione
// tedesca: quelle regex tedesche non si applicano al testo italiano.
function personalize(text: string, dog: DogProfile): string {
  return text.replace(/\{dogName\}/g, dog.dogName || "il tuo cane");
}

function filterSuitable(
  pool: ExerciseTemplate[],
  dog: DogProfile
): ExerciseTemplate[] {
  return pool.filter((ex) => {
    const s = ex.suitableFor;
    if (s.minAgeMonths && dog.dogAgeMonths != null && dog.dogAgeMonths < s.minAgeMonths) return false;
    if (s.notForBreeds && dog.dogBreed && s.notForBreeds.includes(dog.dogBreed.toLowerCase())) return false;
    if (s.notForSeniors && dog.isSenior) return false;
    return true;
  });
}

// ── Wochen-Themen: pro Phase 8 unique Templates ─────────────────────
// Jede Woche hat eigenen Schwerpunkt + Übungs-Auswahl + Tages-Routine.
// Für 6-Monats-Plan werden alle 8 verwendet, für 3-Monats die ersten 4,
// für 1-Monats nur die jeweils ersten.

interface WeekTemplate {
  title: string;
  schwerpunkt: string;        // 1-Satz Theme-Beschreibung
  wochenziele: string[];
  tagesplan: string;
  no_gos: string[];
  fortschritt: string[];
  exerciseIds: string[];      // 1-2 IDs aus dem Pool dieser Phase
}

// ── PULLING-spezifische Wochen-Templates ────────────────────────────
// Aufgebaut wie ein Hundetrainer einen Leinenführigkeits-Plan strukturiert:
// erst Werkzeuge (Marker, Belohnungskommunikation), dann KERNTECHNIK
// (Sei-ein-Baum), dann Anwendung im Alltag, dann Generalisierung.
const PULLING_WEEKS: Record<Phase, WeekTemplate[]> = {
  fundament: [
    {
      title: "Stabilire il marcatore: la parola BRAVO",
      schwerpunkt: "Prima di lavorare al guinzaglio, {dogName} deve capire come funziona la comunicazione basata sulla ricompensa. Il segnale GUARDA e una chiara parola marcatore BRAVO sono la base di tutto ciò che verrà. Senza queste fondamenta, ogni esercizio al guinzaglio sarà poi solo frustrazione.",
      wochenziele: [
        "{dogName} reagisce in casa a GUARDA in meno di 2 secondi.",
        "Usi la parola marcatore BRAVO in modo coerente nel momento giusto.",
        "{dogName} associa BRAVO a una ricompensa tranquilla, non all'eccitazione.",
      ],
      tagesplan: "Tre mini-sessioni da 3 minuti durante la giornata in stanze diverse: la mattina prima di colazione, a mezzogiorno prima della passeggiata, la sera in soggiorno. {dogName} impara il segnale fin dall'inizio in più contesti. Importante: la parola marcatore BRAVO arriva SEMPRE nell'esatto momento del comportamento desiderato, NON solo quando dai il premietto. Questo è il linguaggio del marcatore.",
      no_gos: [
        "Usare BRAVO come richiamo (per chiamare il cane). BRAVO conferma solo il comportamento corretto.",
        "Più di 7 ripetizioni di fila: nella prima settimana è troppo.",
        "Pretendere GUARDA già all'aperto: quella è la fase 2.",
      ],
      fortschritt: [
        "{dogName} alza la testa a GUARDA entro 2 secondi.",
        "Il contatto visivo dura almeno 1 secondo.",
        "A BRAVO {dogName} si orienta già verso il premietto, senza che tu glielo mostri.",
        "La routine alla porta è più tranquilla, l'agitazione mentre metti il guinzaglio diventa più rara.",
      ],
      exerciseIds: ["p-schau", "p-stop-and-go"],
    },
    {
      title: "Sii un albero: la tecnica centrale in casa",
      schwerpunkt: "Questa è la settimana più importante di tutto il piano. {dogName} impara il meccanismo che useremo poi all'aperto: guinzaglio teso = tu stai fermo, guinzaglio allentato = si prosegue. Se questo funziona bene in casa, l'80% del lavoro al guinzaglio è fatto.",
      wochenziele: [
        "{dogName} si ferma quando il guinzaglio è teso e si riorienta verso di te.",
        "Tu stesso resti tranquillo, in silenzio e senza strattoni quando il guinzaglio si tende.",
        "{dogName} capisce il principio: tirare non fa procedere, ma porta all'immobilità.",
      ],
      tagesplan: "Due volte al giorno 5-7 minuti di allenamento al guinzaglio allentato in casa o nel corridoio. Cammina al tuo ritmo normale, guinzaglio allentato. Appena si tende: fermati SUBITO, NESSUNA parola, NESSUNO strattone. Quando {dogName} cede: un tranquillo BRAVO, prosegui. Aspettati nei primi giorni 15-25 fermate per sessione. Non è frustrazione, è la curva di apprendimento.",
      no_gos: [
        "Strattonare o tirare il guinzaglio quando è teso. Questo peggiora il tirare.",
        "Sgridare o innervosirti. Sei solo tranquilla coerenza.",
        "20 minuti di fila in casa. Meglio 2x 5 minuti che 1x 20.",
      ],
      fortschritt: [
        "Le fermate per sessione diminuiscono: giorno 1: 20+, giorno 7: sotto le 10.",
        "{dogName} gira la testa alla fermata e cerca il contatto visivo.",
        "Riprendendo il cammino, il guinzaglio resta allentato più a lungo che a inizio settimana.",
      ],
      exerciseIds: ["p-baum", "p-leinenspiel-drinnen"],
    },
    {
      title: "La posizione al piede come zona d'oro",
      schwerpunkt: "Ora costruisci il posto accanto alla tua gamba come il luogo più prezioso mentre cammini. Quando questo funziona, {dogName} ci va spontaneamente, perché ne vale la pena. È il complemento positivo di Sii un albero: là aspettare = stare fermi, qui camminare = arriva la ricompensa.",
      wochenziele: [
        "{dogName} cerca attivamente la posizione al piede, perché ne vale la pena.",
        "Le ricompense arrivano SEMPRE in posizione al piede, MAI davanti a te.",
        "Cammini 10 passi di fila con {dogName} in posizione al piede in casa.",
      ],
      tagesplan: "Una sessione di 7 minuti al giorno in casa o nel corridoio. Comincia da fermo: premia 10 volte quando la spalla di {dogName} è accanto al tuo ginocchio. Poi 1 passo, premia. Poi 2 passi. Poi 5. A 10 passi di fila senza andare avanti: MAXI-PREMIO di 3 premietti e termina. La tasca dei pantaloni dal lato del cane resta sempre piena di premietti.",
      no_gos: [
        "Dare la ricompensa davanti al corpo. Così attiri in avanti e favorisci il tirare.",
        "Attirare {dogName} nella posizione al piede invece di aspettare. Deve arrivarci da solo.",
        "Lavorare a passi lunghi: i passi piccoli rendono la posizione più chiara.",
      ],
      fortschritt: [
        "{dogName} arriva da solo in posizione al piede dopo 1-2 secondi da fermo.",
        "10 passi di fila senza andare avanti sono fattibili.",
        "Il guinzaglio resta costantemente allentato durante la sequenza al piede.",
      ],
      exerciseIds: ["p-bei-fuss-belohnen", "p-schau"],
    },
    {
      title: "Routine alla porta + tappetino come àncora",
      schwerpunkt: "Chi parte agitato tira per tutta la passeggiata. Questa settimana stabilisci una tranquilla routine alla porta E un tappetino di rilassamento come àncora per le pause e più avanti per le situazioni al bar. Entrambi gli elementi rendono più calmi la partenza e il ritmo.",
      wochenziele: [
        "{dogName} sta seduto o in piedi tranquillo mentre metti il guinzaglio.",
        "La porta si apre solo con il guinzaglio allentato.",
        "Il tappetino diventa un luogo di riposo chiaramente riconoscibile.",
      ],
      tagesplan: "Routine alla porta a ogni passeggiata. In più, 2 volte al giorno 5 minuti di allenamento sul tappetino, idealmente dopo la passeggiata principale o in un momento tranquillo della giornata. Il tappetino resta sempre nello stesso posto — come rifugio affidabile anche tra le sessioni di allenamento. Voce calma quando premi sul tappetino, NESSUNA lode eccitata.",
      no_gos: [
        "Mettere il guinzaglio mentre {dogName} salta: rafforza l'iperattività da eccitazione.",
        "Partire e basta per fretta: fa arretrare l'intera settimana.",
        "Usare il tappetino per punizioni o time-out: avvelena il luogo.",
      ],
      fortschritt: [
        "{dogName} si siede automaticamente quando metti il guinzaglio.",
        "La porta può essere aperta senza agitazione.",
        "{dogName} si sdraia sul tappetino a TERRA senza discutere.",
      ],
      exerciseIds: ["p-stop-and-go", "p-decke-drinnen"],
    },
    // Wochen 5-8 nur für 6-Monats-Plan: Vertiefung Fundament
    {
      title: "Sii un albero con mini-distrazioni",
      schwerpunkt: "{dogName} conosce Sii un albero in casa. Questa settimana lo metti alla prova con piccole distrazioni: qualcuno suona il campanello, la radio è accesa, il cesto della biancheria è d'intralcio. Il meccanismo resta uguale, ma gli stimoli diventano più forti.",
      wochenziele: [
        "{dogName} mantiene il meccanismo anche con stimoli di sottofondo.",
        "Riconosci a quale livello di distrazione la tua mano reagisce troppo presto o troppo tardi.",
        "Le fermate per sessione restano sotto le 10 nonostante la distrazione.",
      ],
      tagesplan: "Una sessione di 6 minuti al giorno, ma intenzionalmente con un piccolo disturbo: radio a basso volume, oppure qualcuno fa rumori nella stanza accanto, oppure metti uno scatolone sul pavimento come stimolo visivo. L'esercizio in sé è uguale a quello della settimana 2, ma {dogName} deve concentrarsi nonostante lo stimolo.",
      no_gos: [
        "Lavorare già con veri stimoli esterni: non siamo ancora pronti per questo.",
        "Accumulare più distrazioni contemporaneamente: una basta.",
        "Continuare se la frequenza delle fermate aumenta: abbassa il livello di distrazione.",
      ],
      fortschritt: [
        "{dogName} resta concentrato nonostante lo stimolo di sottofondo.",
        "Il meccanismo risulta automatico per entrambi.",
        "Hai un'idea chiara di quali stimoli metteranno ancora in difficoltà {dogName} all'aperto.",
      ],
      exerciseIds: ["p-baum", "p-schau"],
    },
    {
      title: "Tratti più lunghi a guinzaglio allentato in casa",
      schwerpunkt: "Da 5 minuti si passa a 10 minuti. {dogName} sviluppa resistenza nel camminare attento accanto a te. Inoltre: eserciti il tempismo della ricompensa — il momento in cui dici BRAVO fa tutta la differenza.",
      wochenziele: [
        "{dogName} riesce a fare 8-10 minuti di guinzaglio allentato in casa con massimo 5 fermate.",
        "Premi mirando alle LUNGHE fasi di guinzaglio allentato, non ogni passo.",
        "La posizione al piede viene mantenuta per più di 10 passi.",
      ],
      tagesplan: "Una sessione di 10 minuti al giorno in casa e nel corridoio. Pianifica fasi precise: 2 minuti al piede premiati intensamente, 3 minuti di guinzaglio allentato libero con fermate dove serve, 2 minuti al piede, 3 minuti liberi. Varia la frequenza della ricompensa: ogni 5 passi → ogni 10 passi → ogni 20.",
      no_gos: [
        "Ridurre troppo in fretta la frequenza della ricompensa. In questa fase meglio troppo spesso che troppo di rado.",
        "'Lasciar passare' gli episodi di tirare perché avete fretta. La coerenza è tutto.",
        "Lavorare sempre sullo stesso percorso: meglio 2-3 stanze diverse.",
      ],
      fortschritt: [
        "{dogName} mantiene la concentrazione per oltre 10 minuti.",
        "Riconosci la differenza tra 'appena allentato' e 'davvero allentato', e premi solo il vero allentamento.",
        "Le sequenze al piede diventano una scelta naturale invece che una richiesta.",
      ],
      exerciseIds: ["p-leinenspiel-drinnen", "p-bei-fuss-belohnen"],
    },
    {
      title: "Il cambio di ritmo come nuova variabile",
      schwerpunkt: "Finora camminavi a ritmo costante. Questa settimana introduci i cambi di ritmo come strumento di attenzione. {dogName} impara a orientarsi su di te invece di correre avanti. Questo rende le passeggiate giocose e partecipi.",
      wochenziele: [
        "{dogName} adatta il ritmo quando rallenti, senza spingere avanti.",
        "Quando acceleri, {dogName} ti segue senza andare avanti.",
        "I cambi di ritmo diventano una variabile normale, non una confusione.",
      ],
      tagesplan: "Una sessione di 7 minuti al giorno in casa. Inizia normale, poi all'improvviso più lento (metà ritmo) per 10 passi, normale, più veloce (una volta e mezza il ritmo) per 10 passi, normale. Cambia intenzionalmente 6-8 volte per sessione. Premia OGNI cambio corretto con BRAVO + premietto in posizione al piede.",
      no_gos: [
        "Annunciare i cambi di ritmo con la voce o lo sguardo. Devono essere imprevedibili.",
        "Più di 8 cambi per sessione: è troppo.",
        "Cambiare in modo brusco: meglio fluido ma chiaro.",
      ],
      fortschritt: [
        "{dogName} reagisce ai cambi di ritmo entro 2 passi.",
        "La posizione al piede resta stabile durante i cambi.",
        "{dogName} alza lo sguardo verso di te più spesso, perché il tuo ritmo è diventato imprevedibile.",
      ],
      exerciseIds: ["p-tempo-wechsel", "p-schau"],
    },
    {
      title: "Verifica delle fondamenta e preparazione al passaggio",
      schwerpunkt: "Ultima settimana delle fondamenta. Ripeti tutti gli elementi: marcatore, Sii un albero, al piede, cambio di ritmo, routine alla porta, tappetino. Ciò che ancora vacilla riceve questa settimana un'attenzione extra. La fase 2 inizia con veri stimoli esterni, quindi nulla può vacillare.",
      wochenziele: [
        "Tutti e 6 gli elementi funzionano in modo riproducibile in casa.",
        "Hai un bilancio: cosa è consolidato, cosa vacilla, cosa richiede attenzione extra nella fase 2.",
        "{dogName} ha una routine di allenamento riconoscibile nella giornata.",
      ],
      tagesplan: "Giorno 1+2: Sii un albero + al piede combinati in una sessione di 10 minuti. Giorno 3+4: cambio di ritmo + routine alla porta. Giorno 5: ripasso del marcatore + guinzaglio allentato in casa. Giorno 6+7: sessioni sul tappetino prolungate. Nel fine settimana fai un bilancio sincero.",
      no_gos: [
        "Lavorare già con veri stimoli esterni: la fase 2 è la PROSSIMA settimana.",
        "Ignorare i punti deboli — all'aperto si manifestano subito.",
        "Saltare alla fase successiva per impazienza. Meglio aggiungere 1 settimana se serve.",
      ],
      fortschritt: [
        "Tutti gli esercizi funzionano senza dover ricordare le regole di base.",
        "{dogName} propone da solo l'al piede e il Sii un albero.",
        "Avete una routine che risulta normale per entrambi.",
      ],
      exerciseIds: ["p-baum", "p-leinenspiel-drinnen"],
    },
  ],
  steigerung: [
    {
      title: "Sii un albero: la prima vera passeggiata",
      schwerpunkt: "La tecnica della fermata esce nella strada tranquilla. {dogName} sarà sorpreso che le vecchie abitudini di tirare all'improvviso non funzionino più. Aspettati 30-50 fermate nella prima sessione. Ogni fermata è un momento di apprendimento, non un passo indietro.",
      wochenziele: [
        "Sii un albero funziona in una strada tranquilla o nel cortile.",
        "Pianifichi il tempo della passeggiata raddoppiato, senza stress.",
        "{dogName} capisce: il meccanismo è identico in casa e all'aperto.",
      ],
      tagesplan: "Pianifica la passeggiata principale di questa settimana con il doppio del tempo. Scegli una strada tranquilla senza traffico intenso, senza area sgambamento. Parti come sempre e fai Sii un albero a ogni guinzaglio teso, senza parole, senza strattoni. Nel frattempo, ogni 30 passi dai un premietto in posizione al piede se il guinzaglio è allentato. Termina sempre in una fase di guinzaglio allentato, non dopo aver tirato.",
      no_gos: [
        "Già il centro città o un parco con molti cani: quella è più avanti, la fase 3.",
        "Se hai fretta: meglio restare a casa e allenarti ancora in casa. Lo stress del proprietario rovina l'esercizio.",
        "Alla fermata parlare ancora o guardare. Statua significa statua.",
      ],
      fortschritt: [
        "Le fermate per passeggiata diminuiscono dal giorno 1 (30+) al giorno 7 (sotto le 15).",
        "{dogName} cerca da solo il contatto visivo dopo 2-3 fermate.",
        "Ti senti più tranquillo e più abile nel fermarti rispetto ai primi tentativi.",
      ],
      exerciseIds: ["p-baum-draussen", "p-bei-fuss-belohnen"],
    },
    {
      title: "metri di penalità: quando fermarsi non basta",
      schwerpunkt: "Alcuni cani hanno bisogno di più della semplice immobilità. Se {dogName} continua a tirare nonostante 30 secondi da statua, ti giri e torni indietro. Tirare diventa un vicolo cieco. Usi questa tecnica in modo mirato, non di continuo — altrimenti perde il suo effetto di apprendimento.",
      wochenziele: [
        "Usi i metri di penalità intenzionalmente solo in caso di tirare ostinato, massimo 5 volte per passeggiata.",
        "{dogName} capisce: tirare non porta all'obiettivo, ma lo allontana.",
        "Sii un albero resta la prima scelta, i metri di penalità la seconda.",
      ],
      tagesplan: "Per passeggiata: prima continua con Sii un albero in modo coerente. SOLO se {dogName} non cede per 30+ secondi, passi alla modalità metri di penalità: girati con calma, 5 passi indietro, poi di nuovo nella direzione originale con una pioggia di ricompense in posizione al piede. Massimo 5 episodi di penalità per passeggiata, altrimenti diventa frustrante.",
      no_gos: [
        "Usare i metri di penalità a OGNI tirata: perde efficacia.",
        "Girarsi bruscamente o sembrare innervosito. Il messaggio è il movimento, non la punizione.",
        "NON premiare quando si riprende a camminare bene. La ricompensa alla ripresa è tutto l'effetto di apprendimento.",
      ],
      fortschritt: [
        "Gli episodi di metri di penalità per passeggiata diminuiscono nel corso della settimana.",
        "{dogName} reagisce più in fretta alla prima fermata (Sii un albero) e ha bisogno dei penalty più di rado.",
        "Usi i metri di penalità senza pensarci, quando la situazione lo richiede.",
      ],
      exerciseIds: ["p-penalty-yards", "p-baum-draussen"],
    },
    {
      title: "Premiare l'al piede nel contesto reale",
      schwerpunkt: "Ciò che ha funzionato in casa, ora si rafforza con gli stimoli. La posizione al piede diventa la zona d'oro contro tutto ciò che all'aperto attira. Mantieni alta la densità di ricompense, proprio in questa fase. La riduzione arriva nella fase 3.",
      wochenziele: [
        "{dogName} cerca attivamente la posizione al piede durante la passeggiata.",
        "Le ricompense arrivano ogni 15-20 passi in posizione al piede se il guinzaglio è allentato.",
        "In presenza di stimoli (auto, cane in lontananza) {dogName} resta più di 5 secondi in posizione al piede.",
      ],
      tagesplan: "Inizia OGNI passeggiata di questa settimana con 3 minuti di premi intensi al piede. Tasca piena, ogni 5-7 passi un premietto in posizione al piede. Poi prosegui la passeggiata normalmente, ma: ogni volta che {dogName} arriva da solo in posizione al piede: MAXI-PREMIO di 3 premietti. {dogName} impara: questa posizione conviene sempre.",
      no_gos: [
        "Dare la ricompensa davanti al corpo. Così attiri in avanti. Sempre in posizione al piede.",
        "Tirare {dogName} nella posizione se non arriva. Meglio fermarsi e aspettare.",
        "Ridurre troppo in fretta la densità di ricompense. Fase 2 = investimento in ricompense.",
      ],
      fortschritt: [
        "{dogName} arriva da solo in posizione al piede agli incroci o nei punti insicuri.",
        "Non devi più attirarlo attivamente, la posizione è un'abitudine.",
        "Anche senza vedere il premietto, {dogName} si orienta su di te.",
      ],
      exerciseIds: ["p-bei-fuss-belohnen", "p-baum-draussen"],
    },
    {
      title: "Cambio di ritmo e di direzione all'aperto",
      schwerpunkt: "Il cambio di ritmo e di direzione diventano i tuoi strumenti di attenzione. Diventi imprevedibile nel camminare. Questo evita che {dogName} vada in modalità pilota automatico e che tu venga trascinato dietro al guinzaglio.",
      wochenziele: [
        "Inserisci 5-8 cambi di ritmo per passeggiata.",
        "I cambi di direzione senza preavviso diventano una variabile normale.",
        "{dogName} ti guarda più spesso, perché il tuo ritmo è imprevedibile.",
      ],
      tagesplan: "Pianifica le passeggiate intenzionalmente su percorsi con biforcazioni, sentieri, incroci. Cambia senza parole ora più lento, ora più veloce, ora completamente direzione. Premia OGNI momento di adattamento in posizione al piede. Se {dogName} continua a tirare cocciuto: usa Sii un albero o i metri di penalità.",
      no_gos: [
        "Annunciare i cambi di ritmo con la voce: toglie l'effetto di apprendimento.",
        "Più di 10 cambi per passeggiata. Meglio la qualità.",
        "Continuare a fare cambi in caso di stress o stanchezza.",
      ],
      fortschritt: [
        "{dogName} reagisce ai cambi di ritmo entro 2 passi.",
        "Le passeggiate risultano più comunicative e meno faticose.",
        "Usi i cambi in modo intuitivo come reset dell'attenzione.",
      ],
      exerciseIds: ["p-tempo-wechsel", "p-richtungswechsel-aussen"],
    },
    {
      title: "Lavorare gli incontri a distanza",
      schwerpunkt: "Primi incontri controllati con cani o corridori, da 15-20 m. {dogName} impara: appare lo stimolo = arriva il premietto, non l'agitazione. Questa settimana è rilevante se il tirare di {dogName} è legato alla reattività.",
      wochenziele: [
        "{dogName} resta sotto la soglia durante gli incontri a 15 m di distanza.",
        "Il controcondizionamento inizia a fare effetto.",
        "Riconosci con sicurezza la soglia individuale di {dogName}.",
      ],
      tagesplan: "Due volte a settimana una sessione di incontri: cerca un posto dove regolarmente passano cani o corridori in lontananza (bordo di un parco, pista da jogging). A ogni stimolo: GUARDA e dai cibo di continuo finché lo stimolo è visibile. Stimolo sparito = premietti finiti. Massimo 5 incontri per sessione.",
      no_gos: [
        "Avvicinarsi troppo. La distanza è tutto in questo esercizio.",
        "Continuare ad allenarsi oltre la soglia: è un passo indietro.",
        "Premiare solo DOPO la reazione. Questo non cambia l'associazione emotiva.",
      ],
      fortschritt: [
        "Davanti agli stimoli {dogName} ti guarda con aspettativa, invece di fissare.",
        "I segnali di stress diventano più rari e più brevi.",
        "Gli incontri vengono superati senza abbai o tirate forti.",
      ],
      exerciseIds: ["p-gegenkonditionierung", "p-baum-draussen"],
    },
    {
      title: "La curva per gli incontri ravvicinati",
      schwerpunkt: "Alcuni incontri non si possono gestire da 15 m — chi viene incontro è già lì. {dogName} riceve una strategia d'azione concreta: la curva. Invece di andarvi incontro direttamente, girate al largo in semicerchio. Questo dà sicurezza a {dogName}.",
      wochenziele: [
        "{dogName} segue il segnale CURVA senza resistenza.",
        "La curva si usa in modo preventivo, non solo quando lo stress è già presente.",
        "Ti senti più capace di agire nelle passeggiate con gente che viene incontro.",
      ],
      tagesplan: "Esercita la curva i primi giorni a secco: attorno a lampioni, cestini, panchine. Appena il movimento è consolidato, usala attivamente negli incontri reali. 2-3 situazioni di curva per passeggiata. Dopo ogni incontro riuscito: MAXI-PREMIO di 3-4 premietti in posizione al piede.",
      no_gos: [
        "Usare la curva con tensione: si trasmette.",
        "Usare la curva solo quando {dogName} è già teso: meglio 10 m prima.",
        "Contatto visivo diretto con il cane o la persona che viene incontro.",
      ],
      fortschritt: [
        "Al comando CURVA {dogName} si muove automaticamente nel semicerchio.",
        "Gli incontri con la curva risultano visibilmente più rilassati.",
        "Usi la curva d'istinto, quando la situazione lo richiede.",
      ],
      exerciseIds: ["p-bogen", "p-baum-draussen"],
    },
    {
      title: "Passeggiate di allenamento più lunghe",
      schwerpunkt: "Finora le fasi di allenamento duravano 10-15 minuti. Questa settimana vengono estese a 25-30 minuti. {dogName} sviluppa resistenza nel camminare attento accanto a te. La densità di ricompense però resta alta.",
      wochenziele: [
        "{dogName} resta concentrato 25-30 minuti di fila.",
        "Le pause vengono usate attivamente come ricompensa (annusare, bere).",
        "La densità di ricompense è chiaramente scaglionata: primi 10 min alta, 10 min centrali media, ultimi 5 min di nuovo alta.",
      ],
      tagesplan: "In 3 giorni di questa settimana una passeggiata di allenamento di 25-30 minuti. Struttura: 5 min di riscaldamento al piede con alta frequenza di ricompense, 15 min di percorso normale con Sii un albero e cambi di ritmo, 5 min di defaticamento al piede. Pause di annusata intenzionali ogni 7-10 minuti come RICOMPENSA per il guinzaglio allentato.",
      no_gos: [
        "25 minuti di fila senza pause: stanca troppo in fretta.",
        "Continuare in caso di stanchezza evidente.",
        "Lasciare le pause senza un segnale di chiusura. {dogName} ha bisogno di transizioni chiare.",
      ],
      fortschritt: [
        "{dogName} regge l'intera fase di esercizio senza cali di concentrazione.",
        "Le pause vengono usate attivamente per recuperare, non per agitarsi.",
        "La frequenza delle ricompense può essere ridotta nella fase centrale.",
      ],
      exerciseIds: ["p-baum-draussen", "p-tempo-wechsel"],
    },
    {
      title: "Consolidamento del potenziamento",
      schwerpunkt: "Ultima settimana di potenziamento. Combini tutti gli strumenti: Sii un albero, metri di penalità, al piede, cambio di ritmo. {dogName} ha un repertorio completo. Fase 3 = applicazione nella vera quotidianità, senza sessioni di esercizio controllate.",
      wochenziele: [
        "Tutti gli strumenti possono essere combinati con flessibilità.",
        "Riconosci con chiarezza quale strumento richiede quale situazione.",
        "{dogName} usa già in parte da solo singole strategie (soprattutto la ricerca della posizione al piede).",
      ],
      tagesplan: "Ogni passeggiata di questa settimana è un mini-test. Osserva attivamente: quale strategia funziona in quale situazione? Alla fine della settimana fai un bilancio: cosa funziona, cosa vacilla. Annota le tipiche situazioni di tirare che restano. Sono il tuo focus per la fase 3.",
      no_gos: [
        "Usare gli strumenti solo singolarmente: vanno combinati con flessibilità.",
        "Sovraccaricare {dogName} con troppi stimoli nuovi. La fase 3 si affronta con gradualità.",
        "Ridurre troppo presto e drasticamente la frequenza delle ricompense. Questo avviene nella fase 3.",
      ],
      fortschritt: [
        "{dogName} usa attivamente almeno 2 strategie per passeggiata.",
        "Devi intervenire meno, {dogName} si autoregola più spesso.",
        "Le passeggiate risultano visibilmente più rilassate rispetto a 8 settimane fa.",
      ],
      exerciseIds: ["p-schau", "p-penalty-yards"],
    },
  ],
  generalisierung: [
    {
      title: "Guinzaglio allentato nella vera passeggiata quotidiana",
      schwerpunkt: "La fase 3 è applicazione. Tutti gli strumenti vengono ora usati su un percorso normale, senza sessioni di esercizio controllate. Le pause di annusata diventano la ricompensa più naturale: guinzaglio allentato = puoi andare ad annusare.",
      wochenziele: [
        "{dogName} affronta una passeggiata quotidiana di 25 minuti con massimo 5 vere tirate.",
        "Usi le pause di annusata intenzionalmente come ricompensa per il guinzaglio allentato.",
        "Gli strumenti (fermata, al piede, ritmo) vengono combinati fluidamente senza pensarci.",
      ],
      tagesplan: "In 5 giorni su 7 una normale passeggiata di 25-30 minuti su un percorso conosciuto. Inizia con 2-3 minuti di premi al piede, poi cammino libero con Sii un albero al guinzaglio teso. Ogni 30-40 passi un premietto in posizione al piede se il guinzaglio è allentato. Pause di annusata attive come ricompensa: 'guinzaglio allentato = puoi andare ad annusare'.",
      no_gos: [
        "Tralasciare gli strumenti in caso di stress o fretta. Meglio accorciare il percorso.",
        "Permettere le pause di annusata in piena fase di tirare. Prima si allenta, poi si può annusare.",
        "Ridurre già drasticamente la frequenza delle ricompense: questo avviene nella settimana 4.",
      ],
      fortschritt: [
        "Le tirate per passeggiata sono a una sola cifra.",
        "{dogName} cerca da solo la posizione al piede nei punti insicuri.",
        "Usi le pause di annusata in modo intuitivo come strumento di ricompensa.",
      ],
      exerciseIds: ["p-lockere-leine-aussen", "p-penalty-yards"],
    },
    {
      title: "Percorsi diversi: generalizzazione",
      schwerpunkt: "Ciò che funziona sul percorso di casa deve funzionare anche su un percorso nuovo. Solo attraverso la generalizzazione il guinzaglio allentato diventa una vera abilità, non una routine legata a un luogo.",
      wochenziele: [
        "{dogName} trasferisce il guinzaglio allentato su almeno 2 nuovi percorsi questa settimana.",
        "Riconosci che su percorsi nuovi le fermate tornano più frequenti — è normale.",
        "La frequenza delle ricompense su percorsi nuovi torna intenzionalmente a salire per un po'.",
      ],
      tagesplan: "Pianifica intenzionalmente questa settimana 3 percorsi diversi: quello abituale, uno nuovo nel paese vicino/parco, uno in città. Massimo 25 minuti per percorso. Sui percorsi nuovi: frequenza delle ricompense come nella fase 2 (ogni 15 passi). Aspettati di nuovo fermate più frequenti. Gli strumenti restano uguali, cambia il contesto.",
      no_gos: [
        "Aspettarsi che il percorso nuovo vada come quello abituale.",
        "Tre percorsi nuovi lo stesso giorno: è troppo.",
        "Su un percorso nuovo tenere la frequenza delle ricompense come su quello abituale.",
      ],
      fortschritt: [
        "{dogName} affronta un percorso completamente nuovo con meno di 10 fermate.",
        "Ti senti capace di agire anche su percorsi sconosciuti.",
        "Lo schema del tirare si riduce trasversalmente ai diversi percorsi.",
      ],
      exerciseIds: ["p-schau", "p-richtungswechsel-aussen"],
    },
    {
      title: "Passare accanto alle persone senza curva",
      schwerpunkt: "Per i cani con una componente reattiva nel tirare, questo è il passo successivo dopo la CURVA. {dogName} impara a passare direttamente accanto alle persone a 3-5 m, senza curva, senza cambio di ritmo. Se {dogName} tira soltanto, senza reattività: prosegui semplicemente con il normale lavoro al guinzaglio allentato.",
      wochenziele: [
        "{dogName} passa direttamente accanto alle persone a 3-5 m, a ritmo costante.",
        "Gli incontri diventano una routine normale, non un evento stressante.",
        "Riconosci la soglia di {dogName} per gli incontri diretti.",
      ],
      tagesplan: "In 4 giorni su 7: cerca intenzionalmente 2-3 possibilità di incontro diretto su percorsi poco frequentati. Prepara {dogName} già da 15 m con GUARDA + ricompensa in posizione al piede. Mantieni il ritmo costante — non più veloce, non più lento. Durante il passaggio: piccoli premietti continui (uno dietro l'altro). Dopo il passaggio: MAXI-PREMIO.",
      no_gos: [
        "Provare direttamente nel pieno centro città: è troppo.",
        "Continuare in caso di stress: torna in qualsiasi momento alla CURVA.",
        "Contatto visivo diretto con chi hai di fronte. {dogName} lo interpreta come tensione.",
      ],
      fortschritt: [
        "{dogName} passa accanto alle persone senza stress visibile.",
        "Durante il passaggio non devi più cambiare strategia di continuo.",
        "Gli incontri diventano una normale routine della passeggiata.",
      ],
      exerciseIds: ["p-vorbeigang", "p-lockere-leine-aussen"],
    },
    {
      title: "Riduzione consapevole delle ricompense",
      schwerpunkt: "Ora riduci sistematicamente la frequenza delle ricompense. {dogName} impara che la strategia funziona anche senza premietti continui. Importante: non eliminarli MAI del tutto — solo più di rado e in modo più imprevedibile.",
      wochenziele: [
        "Le ricompense arrivano ogni 50-80 passi invece che ogni 15-20.",
        "Le prestazioni eccellenti continuano a essere premiate con un MAXI-PREMIO.",
        "{dogName} mantiene le strategie anche con intervalli di ricompensa più radi.",
      ],
      tagesplan: "Riduci in modo consapevole e graduale: giorno 1-2 ogni 30 passi, giorno 3-4 ogni 50, giorno 5-7 ogni 60-80 in modo irregolare. Per le prestazioni eccellenti (lunga fase di guinzaglio allentato, buon passaggio) sempre un MAXI-PREMIO di 3-4 premietti. Se le cose si sfaldano (più tirate, ricerca al piede più debole): un passo indietro verso una frequenza più alta.",
      no_gos: [
        "Eliminare del tutto le ricompense: è troppo in fretta.",
        "Andare avanti quando le cose si sfaldano invece di adattarsi.",
        "Testare la riduzione in una giornata stressante o in un luogo difficile.",
      ],
      fortschritt: [
        "{dogName} usa le strategie anche con intervalli di ricompensa più radi.",
        "Le passeggiate risultano più libere, meno come un allenamento.",
        "Metti meno premietti in mano, senza perdite di qualità.",
      ],
      exerciseIds: ["p-wartungs-spaziergang", "p-lockere-leine-aussen"],
    },
    {
      title: "Luoghi difficili in modo mirato",
      schwerpunkt: "Luoghi finora evitati: l'ingresso del veterinario, la fermata dell'autobus, davanti alle scuole. Questa settimana diventano luoghi possibili, non zone da evitare. Questo migliora davvero la quotidianità.",
      wochenziele: [
        "{dogName} affronta un luogo difficile per 5 minuti con calma.",
        "Conosci la reazione di {dogName} ai punti critici più importanti per te.",
        "I luoghi difficili diventano un'opzione possibile, non una zona tabù.",
      ],
      tagesplan: "Scegli ogni giorno esattamente un luogo difficile e allenati lì per 5 minuti. Giorno 1: zona d'ingresso del veterinario (senza appuntamento). Giorno 2: fermata dell'autobus a 200 m di distanza. Giorno 3: ingresso del parco nell'ora di punta dello sgambamento. Frequenza delle ricompense di nuovo più alta (come nella fase 2). Già il semplice restare lì senza grandi escalation è un successo.",
      no_gos: [
        "Entrare direttamente dal veterinario: usa solo la zona esterna.",
        "Costringere {dogName} a sopportare un luogo che è troppo.",
        "Accumulare più luoghi difficili lo stesso giorno.",
      ],
      fortschritt: [
        "{dogName} affronta ogni punto critico scelto per 5 minuti senza escalation.",
        "Vai più rilassato in luoghi che prima significavano stress.",
        "La quotidianità diventa più flessibile, perché meno zone sono tabù.",
      ],
      exerciseIds: ["p-cafe", "p-vorbeigang"],
    },
    {
      title: "La situazione al bar come disciplina regina",
      schwerpunkt: "Con il tappetino come àncora mobile, {dogName} impara a stare sdraiato tranquillo per 15 minuti in una situazione al bar. È l'esercizio più difficile del piano e a lungo termine rende la tua vita molto più rilassata.",
      wochenziele: [
        "{dogName} si sdraia sul tappetino e ci resta per 15 minuti.",
        "La frequenza delle ricompense viene ridotta lentamente senza che {dogName} si alzi.",
        "Il bar diventa una possibilità normale, non un ostacolo.",
      ],
      tagesplan: "Inizia 2 volte questa settimana con un mini-esercizio da bar al parco: porta il tappetino, stendilo, siediti accanto per 5 minuti. Aumenta lentamente fino a una tranquilla zona esterna di un bar in mattinata. Premia nei primi 3 minuti ogni 15 secondi, poi ogni 30 secondi, poi ogni minuto. Termina sempre in una situazione tranquilla, non mentre si alza.",
      no_gos: [
        "Direttamente all'ora di pranzo nel bar della via principale.",
        "Lavorare senza tappetino: l'àncora è essenziale.",
        "Scappare dal bar quando si fa difficile, invece di terminare con calma.",
      ],
      fortschritt: [
        "{dogName} resta sdraiato 15 minuti sul tappetino senza alzarsi.",
        "Rumori e movimento intorno a te disturbano appena.",
        "Puoi bere un caffè rilassato, senza controllare di continuo.",
      ],
      exerciseIds: ["p-schau", "p-decke-drinnen"],
    },
    {
      title: "La passeggiata in città come disciplina regina finale",
      schwerpunkt: "Una zona pedonale moderata. Tutti gli strumenti nella vera vita cittadina. Se questo funziona, non hai più un cane che tira, ma un cane che attraversa il mondo insieme a te.",
      wochenziele: [
        "{dogName} affronta una passeggiata di 20-25 minuti in una città moderata.",
        "Gli strumenti vengono combinati con flessibilità a seconda della situazione.",
        "Trovate una passeggiata in città che risulti piacevole per entrambi.",
      ],
      tagesplan: "Pianifica una volta a settimana una passeggiata in città intenzionale, meglio la domenica mattina quando c'è meno movimento. Massimo 25 minuti. Inizia con 3 minuti di riscaldamento al piede davanti alla porta. Usa attivamente le pause di annusata per calmarsi tra le fasi di stimolo. Termina sempre in un angolo tranquillo.",
      no_gos: [
        "Portare a termine la passeggiata in città come un appuntamento obbligato, meglio interrompere.",
        "Ego-trip: voler dimostrare che {dogName} sa fare tutto.",
        "Provocare direttamente altri cani, in città gli incontri sono spesso ravvicinati.",
      ],
      fortschritt: [
        "{dogName} si muove in una città moderata sorprendentemente rilassato.",
        "Ti senti preparato anche a stimoli imprevedibili.",
        "Le passeggiate in città diventano una routine possibile, non un'occasione speciale.",
      ],
      exerciseIds: ["p-stadt-spaziergang", "p-lockere-leine-aussen"],
    },
    {
      title: "Passaggio alla modalità di mantenimento",
      schwerpunkt: "Ultima settimana. Ciò che accade qui deve funzionare in modo duraturo. Trasferisci la responsabilità gradualmente a {dogName}, senza che le routine crollino. Il piano di mantenimento per i mesi a venire è pronto.",
      wochenziele: [
        "{dogName} usa le strategie da solo nella quotidianità.",
        "Non devi più allenarti attivamente, ma vivi le routine.",
        "Avete un piano di mantenimento chiaro per i mesi a venire.",
      ],
      tagesplan: "Riduci l'allenamento attivo al minimo. Osserva invece: cosa funziona da solo? Dove devi ancora intervenire? Pianifica un ritmo di mantenimento: ogni 3-4 mesi una passeggiata di esercizio intenzionale in un luogo difficile. Questo mantiene fresche le associazioni e ti accorgi presto se qualcosa rischia di crollare.",
      no_gos: [
        "Abbandonare di colpo tutte le routine: c'è il rischio di un passo indietro.",
        "Rilassarsi e non osservare più: riconosci presto le piccole ricadute.",
        "Rimandare all'infinito il piano di mantenimento, bastano sessioni brevi.",
      ],
      fortschritt: [
        "{dogName} usa le strategie senza guida attiva nella quotidianità.",
        "Ti senti come se foste una squadra affiatata.",
        "Le passeggiate non sono più un allenamento, ma vita condivisa.",
      ],
      exerciseIds: ["p-wartungs-spaziergang", "p-lockere-leine-aussen"],
    },
  ],
};

// ────────────────────────────────────────────────────────────────────
// ENERGY (zu viel Energie / Übererregung) — Auslastung & Ruhe-Training
// ────────────────────────────────────────────────────────────────────
const ENERGY_WEEKS: Record<Phase, WeekTemplate[]> = {
  fundament: [
    {
      title: "Inventario dell'energia e igiene del sonno",
      schwerpunkt: "Prima di lavorare sulla stimolazione, osserva la routine quotidiana. I cani adulti hanno bisogno di 16-20 ore di riposo al giorno. I cani iperattivi spesso dormono TROPPO POCO. È l'errore più comune in assoluto con i cani.",
      wochenziele: [
        "Per una settimana documenti la routine quotidiana di {dogName}, incluse le fasi di sonno.",
        "Vengono inserite fasi di riposo consapevoli, almeno 14h al giorno.",
        "Le fasi di attività vengono strutturate tra movimento, lavoro di naso, lavoro di testa e contatto sociale.",
      ],
      tagesplan: "Annota per 7 giorni in un piccolo taccuino: quando si sveglia {dogName}, quando dorme, quanto a lungo è attiva, qual era l'attività (passeggiata, gioco, sovrastimolazione). Alla fine della settimana vedrai chiaramente: serve più riposo? Più stimolazione mentale? Interrompi le fasi di eccitazione prima di dormire.",
      no_gos: [
        "Fare SUBITO 'più azione' senza prima osservare.",
        "Stimolare {dogName} di continuo perché sembra agitata, spesso ha bisogno esattamente del contrario.",
        "Accumulare più stimoli eccitanti uno dopo l'altro (gioco + passeggiata + visita nello stesso giorno).",
      ],
      fortschritt: [
        "Hai davanti un protocollo di 7 giorni con tutte le fasi di sonno e di attività.",
        "{dogName} dorme almeno 14 ore al giorno, di cui 4-6 ore di seguito durante il giorno.",
        "Riconosci le fasi di sovraffaticamento e di sottostimolazione da almeno 2 segnali (ad es. ansimare senza caldo, agitazione, mordicchiare).",
        "{dogName} mantiene l'ASPETTA davanti al cibo o alla porta per almeno 5 secondi in 8 tentativi su 10.",
      ],
      exerciseIds: ["e-entspannungs-marker", "e-warte-impuls"],
    },
    {
      title: "Il cibo diventa un'occupazione",
      schwerpunkt: "Invece di mettere la ciotola davanti a {dogName}, trasformi ogni pasto in lavoro di naso. 1 pasto come gioco di ricerca + 1 come Kong/tappetino olfattivo sostituiscono 1 ora di gioco sfrenato e inutile.",
      wochenziele: [
        "Almeno 1 pasto al giorno come gioco di ricerca in casa.",
        "Almeno 1 pasto al giorno dal Kong o dal tappetino olfattivo.",
        "{dogName} non ingurgita più dalla ciotola, ma lavora 20-30 min sul cibo.",
      ],
      tagesplan: "Al mattino: tappetino olfattivo con crocchette. {dogName} lavora in autonomia. Alla sera: distribuisci le crocchette a porzioni in salotto, segnale CERCA, 20 min di occupazione. A pranzo (facoltativo): Kong con cibo umido, congelato se vuoi renderlo più difficile. Alza il livello quotidiano di {dogName} da 30 sec a 60 min di occupazione produttiva.",
      no_gos: [
        "Aiutare {dogName} durante la ricerca o darle indizi.",
        "Impostare il gioco di ricerca come 'snack veloce', deve durare a lungo.",
        "Usare tappetino olfattivo o Kong quando {dogName} è già iperattiva, meglio in fasi moderate.",
      ],
      fortschritt: [
        "{dogName} lavora concentrata 20-30 minuti al gioco di ricerca o al Kong, invece di ingurgitare dopo 30 secondi.",
        "Entro 10 minuti dal gioco di ricerca/Kong {dogName} si sdraia spontaneamente (invece di chiedere agitata).",
        "Da 5 giorni non dai più nessun pasto direttamente dalla ciotola.",
      ],
      exerciseIds: ["e-such-drinnen", "e-kong-mahlzeit"],
    },
    {
      title: "ASPETTA: costruire il controllo degli impulsi",
      schwerpunkt: "Il controllo degli impulsi è il freno mentale che spesso manca ai cani iperattivi. ASPETTA davanti al cibo, alla porta, al giocattolo costruisce questo freno nel corso delle settimane. Tollerare la frustrazione = imparare la calma.",
      wochenziele: [
        "{dogName} mantiene 10 sec di ASPETTA davanti alla ciotola.",
        "ASPETTA viene usato ogni giorno davanti a 3 situazioni diverse.",
        "{dogName} resta calma sotto una frustrazione crescente.",
      ],
      tagesplan: "Al mattino: ASPETTA davanti alla ciotola della colazione, aumenta lentamente da 1 sec a 10 sec nel corso della settimana. A mezzogiorno: ASPETTA davanti alla porta di casa quando uscite. Alla sera: ASPETTA davanti al giocattolo preferito, poi via libera. 3-4 situazioni al giorno, MAI mantenere più di 15 sec.",
      no_gos: [
        "Usare ASPETTA come pura punizione, senza risoluzione.",
        "Tempi di attesa troppo lunghi nella prima settimana, frustra.",
        "ASPETTA quando {dogName} è già in modalità iper, prima falla calmare.",
      ],
      fortschritt: [
        "{dogName} mantiene 10 secondi di ASPETTA davanti alla ciotola in 8 tentativi su 10 senza alzarsi.",
        "I comportamenti da frustrazione (mugolare, saltare, mordicchiare) al giorno 7 compaiono in modo evidente meno spesso che al giorno 1, stima: al massimo la metà delle volte.",
        "Usi ASPETTA ogni giorno in almeno 3 situazioni diverse.",
      ],
      exerciseIds: ["e-warte-impuls", "e-entspannungs-marker"],
    },
    {
      title: "Condizionare un'ancora di rilassamento",
      schwerpunkt: "Colleghiamo una parola come MERAVIGLIOSO a stati di calma. Più avanti potrai usare la parola per far calmare {dogName}. È il classico condizionamento classico come nei cani di Pavlov.",
      wochenziele: [
        "Ogni giorno colleghi 5-7 volte la parola MERAVIGLIOSO a veri momenti di calma.",
        "{dogName} reagisce alla parola in modo evidente dopo 7-10 giorni.",
        "La parola marcatore è pronta come strumento per interrompere l'eccitazione.",
      ],
      tagesplan: "Osserva per tutta la giornata: {dogName} è rilassata? (sdraiata, occhi socchiusi, respiro tranquillo). Esattamente in questi momenti: avvicinati con calma, MERAVIGLIOSO con voce profonda e calda, un premietto morbido alla bocca. Non tirarla su, non eccitarla. Almeno 5 di queste associazioni al giorno.",
      no_gos: [
        "Usare la parola nell'eccitazione prima che sia condizionata, indebolisce l'associazione.",
        "Eccitare {dogName} per poi usare l'ancora, l'ordine è inverso.",
        "Usare premietti di alto valore, per il condizionamento alla calma sono più adatti premietti calmi e morbidi.",
      ],
      fortschritt: [
        "Questa settimana hai collegato MERAVIGLIOSO ad almeno 35 veri momenti di calma (5 al giorno).",
        "Con MERAVIGLIOSO in un momento tranquillo {dogName} gira la testa verso di te entro 2 secondi, in 7 tentativi su 10.",
        "{dogName} resta sdraiata con MERAVIGLIOSO invece di alzarsi, la parola marcatore non innesca un'eccitazione di attesa.",
      ],
      exerciseIds: ["e-entspannungs-marker", "e-shape-trick"],
    },
    // 6-Monats: Vertiefungen
    {
      title: "Primi trick di shaping: stimolazione della testa",
      schwerpunkt: "Con lo shaping {dogName} impara da sola: cosa mi fa guadagnare il click? È la stimolazione mentale più intensa in assoluto. Dopo 5-7 min di shaping anche un cane giovane è stanco.",
      wochenziele: [
        "{dogName} conosce 1 nuovo trick (zampa, touch o girati).",
        "Le sessioni di shaping diventano una routine regolare.",
        "Riconosci quando {dogName} è mentalmente stimolata a sufficienza (sbadigli, fa pausa).",
      ],
      tagesplan: "Una sessione di shaping di 5-7 min al giorno, meglio nel pomeriggio o alla sera. Scegli un trick semplice. 10-15 click per sessione. Termina sempre in un momento di successo. Dopo la sessione: calmarsi sul tappetino.",
      no_gos: [
        "Frustrarti quando {dogName} non capisce. Meglio abbassare la richiesta.",
        "Iniziare più trick contemporaneamente, stabilizzane uno bene.",
        "Sessione di shaping più lunga di 10 min, sovraccarica mentalmente.",
      ],
      fortschritt: [
        "{dogName} capisce il principio del clicker: piccoli movimenti portano alla ricompensa.",
        "{dogName} prova attivamente diversi comportamenti.",
        "Dopo la sessione di shaping {dogName} è visibilmente più stanca che dopo un'attività fisica.",
      ],
      exerciseIds: ["e-shape-trick", "e-warte-impuls"],
    },
    {
      title: "Il tappetino olfattivo come routine quotidiana",
      schwerpunkt: "I tappetini olfattivi e altri giochi di intelligenza diventano un rituale fisso della giornata. Questa settimana ne stabilisci 2-3 diversi e li fai ruotare.",
      wochenziele: [
        "{dogName} conosce almeno 2 strumenti di occupazione diversi.",
        "Fai ruotare gli strumenti perché non diventi monotono.",
        "{dogName} lavora 20-30 min per occupazione in autonomia.",
      ],
      tagesplan: "Investi in 2-3 strumenti: tappetino olfattivo, Kong, gioco di intelligenza (ad es. Trixie Mover). Rotazione ogni 2-3 giorni. Almeno 1 occupazione con questi al giorno. Idealmente prima delle fasi in cui {dogName} altrimenti si esalta (apertura della porta, campanello).",
      no_gos: [
        "Usare 1 solo strumento, diventa in fretta noioso.",
        "Disturbare o aiutare {dogName} durante l'occupazione.",
        "Non pulire gli strumenti di occupazione, muffa, batteri.",
      ],
      fortschritt: [
        "{dogName} ha preferiti chiari tra gli strumenti.",
        "La routine è consolidata nella giornata.",
        "Gli strumenti di occupazione diventano vere preparazioni alle pause di riposo.",
      ],
      exerciseIds: ["e-such-drinnen", "e-kong-mahlzeit"],
    },
    {
      title: "Occupazione combinata",
      schwerpunkt: "Ora combini movimento + lavoro di naso + lavoro di testa in un'unica unità di allenamento. Invece di camminare 1h senza scopo: 30 min con 5 attività diverse mescolate.",
      wochenziele: [
        "{dogName} affronta 30 min con 4-5 attività diverse mescolate.",
        "Riconosci cosa stanca di più {dogName} (di solito lavoro di naso + shaping).",
        "Le passeggiate diventano sessioni di allenamento variegate.",
      ],
      tagesplan: "Fai 1 volta al giorno una passeggiata di 30 min come 'ibrido di stimolazione': 5 min di camminata semplice + 10 min di gioco di ricerca con premietti nell'erba + 5 min di ripasso trick + 5 min di passeggiata rilassata + 5 min di calma da seduti sotto un albero.",
      no_gos: [
        "Cambiare attività troppo in fretta, {dogName} non riesce a entrarci.",
        "Diventare frenetici nei passaggi, una transizione tranquilla è importante.",
        "Dopo questa sessione ancora una seconda impegnativa, sarebbe sovraffaticamento.",
      ],
      fortschritt: [
        "{dogName} è visibilmente esausta dopo 30 min.",
        "Dopo la fase di calma {dogName} trova rapidamente il riposo.",
        "Le passeggiate risultano appaganti, non un obbligo.",
      ],
      exerciseIds: ["e-warte-impuls", "e-shape-trick"],
    },
    {
      title: "Verifica delle fondamenta",
      schwerpunkt: "Ultima settimana delle fondamenta. Ripeti tutti i mattoni: igiene del sonno, gioco di ricerca, Kong, ASPETTA, parola marcatore di rilassamento. Ciò che traballa riceve un focus extra.",
      wochenziele: [
        "Tutti i mattoni sono consolidati nella routine quotidiana.",
        "Riconosci chiaramente i punti deboli da affrontare nella fase 2.",
        "Il livello di calma di {dogName} è evidentemente migliore rispetto a 4 settimane fa.",
      ],
      tagesplan: "Fai un bilancio onesto: cosa funziona ogni giorno (spunta), cosa piuttosto di rado? Ore di sonno contate? Gioco di ricerca consolidato? ASPETTA funziona in 3+ situazioni? Parola marcatore di rilassamento condizionata? Se qualcosa traballa: questa settimana focus extra su quello.",
      no_gos: [
        "Saltare alla fase 2 per impazienza, la fase 1 è la base.",
        "Più punti deboli contemporaneamente, concentrati su quello più importante.",
        "Abbandonare del tutto il piano perché una settimana è andata storta.",
      ],
      fortschritt: [
        "Ti senti un 'manager della stimolazione' con i tuoi strumenti.",
        "{dogName} è nettamente più calma rispetto all'inizio del piano.",
        "Avete una routine che vi sembra normale a entrambi.",
      ],
      exerciseIds: ["e-entspannungs-marker", "e-such-drinnen"],
    },
  ],
  steigerung: [
    {
      title: "Lavoro di naso all'aperto: basi della ricerca su pista",
      schwerpunkt: "Il lavoro di naso all'aperto è la stimolazione più intensa in assoluto. 15-20 min di ricerca su pista sostituiscono 60 min di camminata inutile, e {dogName} è esausta e soddisfatta mentalmente.",
      wochenziele: [
        "{dogName} segue in autonomia una pista di cibo di 10-15m.",
        "Un'unità di ricerca su pista consolidata per ogni passeggiata.",
        "{dogName} è visibilmente esausta dopo l'esercizio.",
      ],
      tagesplan: "Per ogni passeggiata 1 unità di ricerca su pista: disponi una pista di cibo di 10m in un punto tranquillo (giardino, prato, bordo del parco). {dogName} può seguirla 5 min dopo. Progressione: pista di 20m, poi 30m, poi con piccole distrazioni intorno.",
      no_gos: [
        "Ricerca su pista in zone molto frequentate, concentrazione impossibile.",
        "Mettere fretta a {dogName} o mostrarle la pista, addio divertimento e apprendimento.",
        "Fare la pista troppo lunga all'inizio, sovraccarica.",
      ],
      fortschritt: [
        "{dogName} segue in autonomia una pista di cibo di 20m, senza che tu debba mostrargliela.",
        "Entro 10 minuti da un'unità di ricerca su pista (15-20 min) {dogName} si sdraia spontaneamente.",
        "Nel gioco dello STOP in piena eccitazione {dogName} si calma entro 3 secondi senza ripetere il segnale.",
        "Pianifichi fissa almeno 1 unità di ricerca per ogni passeggiata.",
      ],
      exerciseIds: ["e-mantrailing-basis", "e-stop-spiel"],
    },
    {
      title: "Passeggiate strutturate con compiti di ricerca",
      schwerpunkt: "Le passeggiate diventano sessioni di allenamento. Ogni 5-10 min un piccolo compito di ricerca o un trick. {dogName} resta mentalmente coinvolta invece di andare in modalità pilota automatico.",
      wochenziele: [
        "Ogni passeggiata contiene almeno 3 fasi di ricerca o trick.",
        "{dogName} resta attenta e reattiva durante la passeggiata.",
        "Il tirare avanti senza scopo si riduce chiaramente.",
      ],
      tagesplan: "Per ogni passeggiata pianifica delle stazioni: dopo 5 min: lancia un premietto + CERCA. Dopo 10 min: 1 trick. Dopo 15 min: mini-pista di ricerca. La passeggiata diventa una serie di attività, non un percorso. Le pause per annusare sono inserite attivamente.",
      no_gos: [
        "Imporre attività nella fase di stress di {dogName}, prima falla calmare.",
        "Troppe attività in troppo poco tempo, sovrastimolazione.",
        "Usare per l'allenamento strutturato passeggiate in zone di forte eccitazione (molti cani).",
      ],
      fortschritt: [
        "{dogName} cerca attivamente il contatto visivo e i compiti.",
        "Le passeggiate diventano più tranquille e comunicative.",
        "Il tirare inutile si riduce in modo evidente.",
      ],
      exerciseIds: ["e-such-drinnen", "e-shape-trick"],
    },
    {
      title: "Gioco dello STOP: imparare a interrompere l'eccitazione",
      schwerpunkt: "I cani iperattivi spesso non hanno un interruttore di spegnimento. Ne costruiamo uno: STOP in mezzo al gioco, tagliare l'eccitazione, poi solo dopo continuare. Un'abilità per la vita.",
      wochenziele: [
        "{dogName} reagisce allo STOP entro 3 secondi calmandosi.",
        "Puoi interrompere in qualsiasi momento il gioco e le baruffe.",
        "{dogName} si calma dopo lo STOP senza che ci sia frustrazione.",
      ],
      tagesplan: "1 volta al giorno una sessione di gioco di 7 min con un giocattolo. Ogni 60 sec inserisci uno STOP. {dogName} mantiene 5-10 sec, poi premietto, poi non riprendere subito il gioco, 30 sec di pausa. Nel corso della settimana le fasi di pausa diventano più lunghe.",
      no_gos: [
        "Usare lo STOP solo quando sei frustrato o di cattivo umore.",
        "Riprendere subito il gioco, la pausa è l'apprendimento.",
        "Forzare fisicamente {dogName} alla calma, guidala invece a voce.",
      ],
      fortschritt: [
        "{dogName} si siede o resta in piedi tranquilla allo STOP entro 3 sec.",
        "Le fasi di eccitazione diventano più brevi.",
        "Ti senti un regista del gioco, non un semplice comparsa.",
      ],
      exerciseIds: ["e-stop-spiel", "e-cool-down-decke"],
    },
    {
      title: "Calmarsi dopo ogni passeggiata",
      schwerpunkt: "Dopo ogni fase eccitante arriva un calmarsi consapevole di 5-10 min. {dogName} impara: l'eccitazione finisce attivamente, non da sola. Questa è la calma come abilità allenabile.",
      wochenziele: [
        "{dogName} conosce la sequenza del calmarsi e si calma più in fretta.",
        "Il calmarsi diventa la normale routine dopo le passeggiate.",
        "Il livello quotidiano di {dogName} è diventato più tranquillo.",
      ],
      tagesplan: "Dopo ogni passeggiata: 5-10 min di calma sul tappetino. Siediti accanto, mano tranquilla sulla scapola, respiro profondo. Parola marcatore di rilassamento MERAVIGLIOSO ogni 60 sec. Solo dopo la fase di calma {dogName} può tornare normalmente attiva.",
      no_gos: [
        "Saltare il calmarsi perché 'troppa fretta'.",
        "Dopo la passeggiata mettere subito {dogName} di fronte a qualcosa di eccitante.",
        "Forzare la calma, {dogName} deve poter imparare.",
      ],
      fortschritt: [
        "{dogName} cerca da sola il tappetino dopo l'eccitazione.",
        "Il calmarsi dura meno, perché arriva già più preparata.",
        "Le passeggiate finiscono nella calma, non nel caos.",
      ],
      exerciseIds: ["e-such-drinnen", "e-entspannungs-marker"],
    },
    {
      title: "Sessioni di lavoro di testa più lunghe",
      schwerpunkt: "L'allenamento a forma libera viene esteso a 10-15 min, con più trick in parallelo. {dogName} impara a concentrarsi più a lungo, il che contrasta direttamente l'iperattività.",
      wochenziele: [
        "{dogName} resta concentrata 10-15 min in una sessione di trick.",
        "Almeno 3 trick attivi nel repertorio.",
        "La capacità di attenzione è evidentemente aumentata.",
      ],
      tagesplan: "Una sessione di trick di 10-15 min al giorno, luogo tranquillo in casa o in giardino. Rotazione dei trick: 5 min trick 1, 5 min trick 2, 5 min trick 3. Per ogni trick ripetizioni pulite con un chiaro BRAVO, senza fretta.",
      no_gos: [
        "Aumentare troppo in fretta le richieste dei trick, {dogName} ha bisogno di ripetizione.",
        "Iniziare più trick nuovi in parallelo, confusione.",
        "Sessione di trick in sovreccitazione, prima calmarsi.",
      ],
      fortschritt: [
        "{dogName} ha 3+ trick nel repertorio.",
        "La capacità di attenzione oltre i 10 min è normale.",
        "Riconosci con sicurezza il limite di concentrazione di {dogName}.",
      ],
      exerciseIds: ["e-shape-trick", "e-stop-spiel"],
    },
    {
      title: "Contatti sociali controllati",
      schwerpunkt: "I cani iperattivi spesso si sovreccitano con altri cani. Inseriamo contatti sociali controllati, con pause chiare e sequenze di calma.",
      wochenziele: [
        "{dogName} conosce 1-2 amici cani prevedibili con buona competenza sociale.",
        "Gli incontri sociali vengono strutturati con pause, non baruffe di ore.",
        "Dopo il contatto sociale {dogName} si calma in fretta grazie al calmarsi.",
      ],
      tagesplan: "1-2 volte a settimana un incontro sociale consapevole: 30-45 min con un cane tranquillo e prevedibile. MAI più a lungo. Pause ogni 10-15 min con guinzaglio fermo e pausa acqua. Subito dopo: 15 min di calma a casa.",
      no_gos: [
        "Baruffe di ore, controproducente, sovrastimola.",
        "Incontro sociale in un contesto sconosciuto con cani estranei.",
        "Subito dopo l'incontro sociale ancora altre attività.",
      ],
      fortschritt: [
        "{dogName} si calma più in fretta dall'eccitazione sociale.",
        "I contatti sociali sono appaganti, non sovrastimolanti.",
        "Avete una chiara routine sociale a settimana.",
      ],
      exerciseIds: ["e-such-drinnen", "e-cool-down-decke"],
    },
    {
      title: "Ampliare attivamente la tolleranza alla frustrazione",
      schwerpunkt: "L'iperattività va spesso di pari passo con una bassa tolleranza alla frustrazione. Alleniamo consapevolmente: {dogName} riceve un compito un po' difficile e impara a perseverare.",
      wochenziele: [
        "{dogName} persevera 5+ min su un compito più difficile.",
        "Il comportamento da frustrazione (mugolare, arrendersi) si riduce.",
        "{dogName} gestisce meglio le brevi attese.",
      ],
      tagesplan: "Un compito 'difficile' al giorno: Kong complicato, tappetino olfattivo con premietti più piccoli, compito di ricerca con nascondigli più alti. {dogName} deve impegnarsi. Tu osservi, ma NON aiuti. La frustrazione fa parte del gioco.",
      no_gos: [
        "Aiutare subito in caso di frustrazione, si perde l'apprendimento.",
        "Rendere i compiti troppo difficili, il compito ha bisogno del 60-80% di probabilità di successo.",
        "Compensare la frustrazione con l'eccitazione, non un cambio di attività ma calma.",
      ],
      fortschritt: [
        "{dogName} persevera più a lungo sui compiti.",
        "I segnali di frustrazione diventano più rari e più brevi.",
        "{dogName} sviluppa capacità di perseveranza.",
      ],
      exerciseIds: ["e-warte-impuls", "e-kong-mahlzeit"],
    },
    {
      title: "Consolidamento del progresso",
      schwerpunkt: "Ultima settimana di progresso. Tutti gli strumenti di stimolazione sono consolidati: lavoro di naso, lavoro di testa, calmarsi, gioco dello STOP, contatti sociali controllati. {dogName} è un cane diverso rispetto a 8 settimane fa.",
      wochenziele: [
        "Tutti gli strumenti funzionano in modo fluido nella quotidianità.",
        "Il livello quotidiano di {dogName} è nettamente più tranquillo.",
        "Hai un piano chiaro per la fase 3 (generalizzazione e mantenimento).",
      ],
      tagesplan: "Fai una settimana di bilancio: cosa funziona benissimo, cosa traballa? Quali strumenti usi di più, quali raramente? Dov'è {dogName} ora rispetto alla settimana 1? Annota con onestà, è la base per la fase 3.",
      no_gos: [
        "Tralasciare gli strumenti perché 'ora funziona', il mantenimento è la fase 3.",
        "Mettere alla prova {dogName} con troppi stimoli, non siamo alla fase finale.",
        "Alzare troppo le aspettative, i plateau sono normali.",
      ],
      fortschritt: [
        "{dogName} ha un livello di energia nettamente più tranquillo.",
        "La routine di stimolazione è radicata nella quotidianità.",
        "Ti senti un manager della stimolazione competente.",
      ],
      exerciseIds: ["e-mantrailing-basis", "e-cool-down-decke"],
    },
  ],
  generalisierung: [
    {
      title: "Stabilire un piano settimanale di stimolazione",
      schwerpunkt: "La fase 3 è la struttura nella quotidianità. Crei un chiaro piano di 7 giorni che bilancia stimolazione fisica, mentale e sociale. Con un piano niente più caos, senza piano le giornate non bastano.",
      wochenziele: [
        "Hai un piano di stimolazione di 7 giorni appeso al muro.",
        "{dogName} riceve ogni giorno 3 tipi di stimolazione: movimento + naso + testa.",
        "Le ore di sonno vengono raggiunte con continuità (16-20h).",
      ],
      tagesplan: "Crea un piano: al giorno 1 fisica (passeggiata 30-60 min), 1 lavoro di naso (gioco di ricerca/ricerca su pista), 1 lavoro di testa (shaping/Kong). Incontro sociale 2 volte a settimana. Calmarsi dopo tutto ciò che è eccitante. Piano al muro, la sera metti una spunta.",
      no_gos: [
        "Fare il piano solo per 1 giorno, la routine nasce dalla ripetizione.",
        "Più di 2 attività molto eccitanti nello stesso giorno.",
        "Piano senza fasi di riposo esplicite, sono pianificate attivamente.",
      ],
      fortschritt: [
        "Hai un piano di 7 giorni visibile al muro e realizzi ogni giorno 3 tipi di stimolazione su 3 (movimento + naso + testa).",
        "In almeno 5 giorni su 7 {dogName} raggiunge 14+ ore di riposo.",
        "Al comparire della sovreccitazione esegui i 3 passi (togli gli stimoli, tappetino, parola marcatore) senza pensarci, e {dogName} è calma in 10-15 minuti.",
        "La sera {dogName} è in 6 giorni su 7 spontaneamente nella cuccia invece che su di giri.",
      ],
      exerciseIds: ["e-auslastungs-plan", "e-anti-hyperarousal"],
    },
    {
      title: "La calma come modalità di default",
      schwerpunkt: "Questa settimana stabilisci la calma come stato standard. L'attività è l'eccezione, non la norma. Sembra noioso, ma è la realtà di un cane equilibrato.",
      wochenziele: [
        "{dogName} è in fase di calma per almeno il 60% della giornata.",
        "Non sollecitare {dogName} di continuo, ma lasciala anche semplicemente esistere.",
        "Il montare dell'eccitazione è più raro e più controllato.",
      ],
      tagesplan: "Renditi conto: le fasi attive sono 2-4 volte al giorno, ciascuna di 30-60 min. In mezzo C'È la calma. Non 'purtroppo una pausa', ma 'fase di calma attiva'. {dogName} sta nella cuccia o sul tappetino, tu lavori, sei con lui in silenzio nella stanza.",
      no_gos: [
        "Sentirsi in colpa per 'troppo poca azione'.",
        "Rivolgersi o accarezzare {dogName} di continuo nelle fasi di calma.",
        "Vedere la calma come 'tempo morto', è una parte attiva della rigenerazione.",
      ],
      fortschritt: [
        "{dogName} cerca da sola i luoghi di riposo.",
        "Non ti senti più obbligato a intrattenere di continuo.",
        "Le fasi di calma non sono più 'tempo di attesa', ma parte della relazione.",
      ],
      exerciseIds: ["e-entspannungs-marker", "e-cool-down-decke"],
    },
    {
      title: "Stimolazione nelle giornate difficili",
      schwerpunkt: "Alcune giornate sono dure: pioggia, poco tempo, malattia. Costruiamo un mini-pacchetto di stimolazione per queste giornate, così {dogName} è comunque soddisfatta.",
      wochenziele: [
        "Hai pronto un pacchetto di stimolazione d'emergenza da 15 min.",
        "{dogName} resta calma anche nelle giornate difficili.",
        "Ti senti preparato, invece che sopraffatto.",
      ],
      tagesplan: "Pianifica il pacchetto d'emergenza: 10 min di tappetino olfattivo + 5 min di ripasso trick in casa. OPPURE: 15 min di pista di ricerca in casa. OPPURE: 1 Kong impegnativo + calmarsi. Testalo questa settimana in una giornata normale, così {dogName} lo conosce.",
      no_gos: [
        "Sentirsi in colpa per 'solo 15 min', ben investiti sono abbastanza.",
        "Nelle giornate difficili lasciar semplicemente 'tirare avanti' {dogName}, frustra.",
        "Non testare il pacchetto d'emergenza, poi in caso reale non funziona.",
      ],
      fortschritt: [
        "{dogName} resta evidentemente più calma nelle giornate difficili.",
        "Hai flessibilità senza sensi di colpa.",
        "15 min di qualità > 60 min di stimolazione scadente.",
      ],
      exerciseIds: ["e-kong-mahlzeit", "e-such-drinnen"],
    },
    {
      title: "Ridurre le ricompense nella stimolazione",
      schwerpunkt: "Gli strumenti di stimolazione dovrebbero prima o poi funzionare anche senza il tuo accompagnamento costante. {dogName} può usare il tappetino olfattivo da sola, sbrigare il Kong in autonomia. Questo dà libertà a entrambi.",
      wochenziele: [
        "{dogName} lavora 20-30 min in autonomia agli strumenti di occupazione.",
        "Non devi più accompagnare attivamente.",
        "Hai del 'tempo libero' tuo mentre {dogName} è occupata.",
      ],
      tagesplan: "Non osservare più di continuo: dai Kong/tappetino olfattivo, vai in un'altra stanza, fai le tue cose. {dogName} lavora in autonomia. Torna solo dopo la fine dell'occupazione. Entrambi vi abituate all'autonomia.",
      no_gos: [
        "Controllare di continuo durante l'occupazione.",
        "Rendere l'occupazione troppo facile, {dogName} la finisce in 5 min.",
        "Aspettarsi troppo in fretta l'autonomia, le solite fasi iniziali con accompagnamento vanno bene.",
      ],
      fortschritt: [
        "{dogName} ha una routine di occupazione autonoma.",
        "Ti godi il tuo tempo senza sensi di colpa.",
        "La tua relazione con lui diventa più sana grazie al tempo libero comune E a quello separato.",
      ],
      exerciseIds: ["e-warte-impuls", "e-shape-trick"],
    },
    {
      title: "Lavorare in modo mirato sugli scatenanti difficili",
      schwerpunkt: "Campanello, postino, odore di selvaggina, gli scatenanti specifici che fanno regolarmente esaltare {dogName}. Questa settimana lavori in modo mirato sui tuoi punti critici personali.",
      wochenziele: [
        "I tuoi 2-3 scatenanti più importanti sono chiaramente identificati.",
        "{dogName} reagisce in modo evidente più calmo a uno scatenante principale.",
        "Hai una strategia concreta per ogni scatenante.",
      ],
      tagesplan: "Giorno 1-2: identifica i 2-3 scatenanti più importanti e annota la reazione di {dogName}. Giorno 3-7: una strategia specifica per ogni scatenante: campanello → VIENI-QUI + ricompensa sul tappetino. Postino → tappetino + preparare il Kong quando si avvicina. Odore di selvaggina → guinzaglio corto + gioco di ricerca come distrazione.",
      no_gos: [
        "Ignorare gli scatenanti nella speranza che passino, non succede.",
        "Punizione o alzare la voce contro lo scatenante, rafforza la sovreccitazione.",
        "Affrontare più scatenanti contemporaneamente, concentrati.",
      ],
      fortschritt: [
        "{dogName} reagisce in modo evidente più calmo allo scatenante principale.",
        "Hai pronti degli strumenti per ogni scatenante.",
        "Gli scatenanti diventano occasioni di esercizio, non stress.",
      ],
      exerciseIds: ["e-anti-hyperarousal", "e-entspannungs-marker"],
    },
    {
      title: "Padroneggiare il contesto sociale al parco",
      schwerpunkt: "I parchi per cani e gli incontri con altri cani spesso sovraccaricano. Questa settimana stabilisci delle regole del gioco: fasi brevi, chiare routine di calma, niente baruffe di ore.",
      wochenziele: [
        "{dogName} affronta con calma una permanenza al parco di 20-30 min.",
        "Riconosci con sicurezza i segnali di sovraccarico di {dogName}.",
        "I contatti sociali sono appaganti, non sovrastimolanti.",
      ],
      tagesplan: "Pianifica questa settimana 2-3 incontri consapevoli al parco: max 30 min, ogni 10 min una pausa con guinzaglio fermo e MERAVIGLIOSO. Ai segnali di sovreccitazione: uscine attivamente, NON perseverare. Subito dopo il parco: 15 min di calma a casa.",
      no_gos: [
        "Permanenze al parco più lunghe di 45 min, sovrastimolazione.",
        "Lasciar 'tirare avanti' {dogName} sotto stress.",
        "Più incontri al parco al giorno, sovrastimola.",
      ],
      fortschritt: [
        "{dogName} torna calma dalla visita al parco.",
        "I segnali di sovraccarico vengono riconosciuti presto.",
        "Il parco diventa un'attività possibile, non un obbligo.",
      ],
      exerciseIds: ["e-cool-down-decke", "e-such-drinnen"],
    },
    {
      title: "Stabilire una routine anti-sovreccitazione",
      schwerpunkt: "Alcune giornate vanno storte. {dogName} non si calma. Questa settimana consolidi una chiara routine in tre passi (togli gli stimoli, sul tappetino, parola marcatore di rilassamento) che puoi usare per riflesso in questi momenti.",
      wochenziele: [
        "La routine anti-sovreccitazione è ben appresa: togli gli stimoli, tappetino, parola marcatore.",
        "Applichi la routine per riflesso, senza pensarci.",
        "{dogName} si calma dopo 10-15 min anche da una sovreccitazione più forte.",
      ],
      tagesplan: "Esercita la routine consapevolmente 2-3 volte questa settimana: genera una leggera eccitazione (simula un bussare alla porta, un breve gioco), poi subito la routine: riduci gli stimoli, guida al tappetino, MERAVIGLIOSO e siediti accanto 10-15 min. {dogName} impara: l'eccitazione può sempre essere terminata attivamente.",
      no_gos: [
        "Usare la routine solo in caso di vera sovreccitazione, senza esercizio non funziona in emergenza.",
        "Abbreviare la routine, servono i 10-15 min pieni.",
        "Tornare subito attivi dopo la routine, il consolidamento ha bisogno di tempo.",
      ],
      fortschritt: [
        "La routine è ben esercitata e assodata.",
        "{dogName} reagisce in modo prevedibile a ogni passo.",
        "Ti senti capace di agire anche nei momenti frenetici.",
      ],
      exerciseIds: ["e-anti-hyperarousal", "e-kong-mahlzeit"],
    },
    {
      title: "Passaggio alla modalità di mantenimento",
      schwerpunkt: "Ultima settimana. Tutti gli strumenti sono consolidati. Il piano di stimolazione funziona, la calma è lo standard, le strategie per gli scatenanti sono assodate. {dogName} è un cane nettamente più equilibrato. Piano di mantenimento per il futuro.",
      wochenziele: [
        "Tutte le routine funzionano in autonomia nella quotidianità.",
        "Hai un chiaro ritmo di mantenimento per i mesi a venire.",
        "{dogName} è a lungo termine più calma rispetto all'inizio del piano.",
      ],
      tagesplan: "Riduci l'allenamento consapevole al minimo. Le routine funzionano. Pianifica ogni 4-6 settimane un 'giorno di ripasso': ripassa consapevolmente ancora tutti gli strumenti, identifica i punti deboli, impara nuovi trick. Verifica l'igiene del sonno.",
      no_gos: [
        "Tralasciare di colpo tutte le routine, rischio di regressione.",
        "Rilassarsi e non osservare più, riconosci presto le piccole ricadute.",
        "Rimandare a mai il ripasso di mantenimento, bastano brevi ripassi regolari.",
      ],
      fortschritt: [
        "{dogName} è a lungo termine più equilibrata.",
        "Avete una routine comune che sembra ovvia.",
        "La sovreccitazione è l'eccezione, la calma è lo standard.",
      ],
      exerciseIds: ["e-auslastungs-plan", "e-such-drinnen"],
    },
  ],
};

// ────────────────────────────────────────────────────────────────────
// AGGRESSION (Aggression in Begegnungen) — Schwellenwert & Gegenkonditionierung
// ────────────────────────────────────────────────────────────────────
const AGGRESSION_WEEKS: Record<Phase, WeekTemplate[]> = {
  fundament: [
    {
      title: "Capire e documentare la soglia",
      schwerpunkt: "Prima di lavorare sulla reattività, devi sapere: a quale distanza {dogName} riesce ancora a IMPARARE e da quando invece reagisce soltanto? Questa è la soglia. Questa settimana la identifichi e la annoti per ogni tipo di fattore scatenante.",
      wochenziele: [
        "Hai annotato le distanze di soglia per ogni tipo di fattore scatenante.",
        "Riconosci con sicurezza i primi segnali di stress (espressione, respiro, coda).",
        "Capisci che ogni esercizio si svolge SOTTO soglia, senza mai avvicinarla.",
      ],
      tagesplan: "In 4 giorni di questa settimana: sessioni di osservazione mirata in un luogo dove i fattori scatenanti compaiono in modo prevedibile. Distanza iniziale di 50m, testa lentamente. Annota per ogni tipo di stimolo (cane, jogger, bicicletta, bambino) la distanza esatta a cui iniziano i primi segnali di stress. Queste sono le tue soglie per la Fase 2.",
      no_gos: [
        "Avvicinare la soglia: aumenta SUBITO la distanza ai segnali di stress.",
        "Testare più fattori scatenanti insieme: un solo stimolo per sessione.",
        "Passare dall'osservazione all'addestramento: questa settimana solo osservazione.",
      ],
      fortschritt: [
        "Hai una mappa scritta delle soglie.",
        "I primi segnali di stress vengono riconosciuti con sicurezza.",
        "Capisci in modo misurabile la reattività di {dogName}.",
        "In casa {dogName} reagisce alla parola marcatore GUARDA in meno di 2 secondi.",
      ],
      exerciseIds: ["a-schwellenwert-finden", "a-lat"],
    },
    {
      title: "Condizionare positivamente la museruola",
      schwerpunkt: "Una museruola fa parte del set di strumenti di ogni cane reattivo, come sicurezza di riserva. Ma funziona solo se {dogName} la associa a qualcosa di positivo. Ci vogliono 2 settimane.",
      wochenziele: [
        "{dogName} infila spontaneamente il muso nella museruola.",
        "Il tempo di indossamento è salito a 5 min con un'attività positiva.",
        "La museruola è disponibile prima di ogni passeggiata 'difficile'.",
      ],
      tagesplan: "Giorno 1-3: la museruola resta in vista nell'appartamento, premietti attraverso le griglie. Giorno 4-7: {dogName} infila attivamente il muso e incassa. Giorno 8-14 (in Fase 2): estendi il tempo di indossamento, dai da mangiare con il Kong attraverso le griglie. Non metterla e partire mai al primo tentativo.",
      no_gos: [
        "Mettere la museruola per la prima volta in una situazione di stress: avvelena l'associazione a vita.",
        "Usare la museruola troppo presto come punizione.",
        "Scegliere il tipo sbagliato (museruola in stoffa): impediscono anche di ansimare e bere.",
      ],
      fortschritt: [
        "{dogName} cerca attivamente la museruola.",
        "Il tempo di indossamento funziona in modo rilassato.",
        "Hai uno strumento di sicurezza per le emergenze.",
      ],
      exerciseIds: ["a-maulkorb-positiv", "a-bogen-aktiv"],
    },
    {
      title: "Costruire in casa il gioco del guardare lo stimolo (Guarda là)",
      schwerpunkt: "Il Guarda là è il gioco più importante nell'addestramento all'aggressività. {dogName} può GUARDARE lo stimolo, ma poi deve tornare a guardare te. Iniziamo in casa con 'stimoli' innocui, prima di uscire all'aperto.",
      wochenziele: [
        "{dogName} capisce il principio del Guarda là in casa.",
        "Dopo lo stimolo ti guarda entro 2 sec.",
        "Il marcatore di ricompensa GUARDA + BRAVO è condizionato.",
      ],
      tagesplan: "Esercizi in casa con 'stimoli' preparati: metti una tazza sul tavolo, lascia un libro di traverso. {dogName} guarda -> dici GUARDA + click + premietto. Ripeti 5-7 volte per sessione, 3 sessioni al giorno. {dogName} impara: vedere lo stimolo = guardare subito te.",
      no_gos: [
        "Lavorare già con veri fattori scatenanti esterni: non siamo ancora pronti.",
        "Forzare {dogName}: deve guardare il conduttore da sola.",
        "Dare la ricompensa troppo tardi: il tempismo è tutto nel Guarda là.",
      ],
      fortschritt: [
        "{dogName} capisce il principio del Guarda là in appartamento.",
        "I marcatori di ricompensa sono condizionati chiaramente.",
        "Sei pronto a trasferire il Guarda là all'aperto nella Fase 2.",
      ],
      exerciseIds: ["a-lat", "a-engage-disengage"],
    },
    {
      title: "Condizionare il protocollo di emergenza",
      schwerpunkt: "Alcune situazioni non si possono evitare. Questa settimana stabilisci un chiaro protocollo di emergenza in 5 passi, che puoi usare in modo riflesso, prima che degeneri.",
      wochenziele: [
        "Conosci i 5 passi a memoria e sai usarli in modo riflesso.",
        "{dogName} conosce un segnale di interruzione condizionato positivamente.",
        "Ti senti preparato agli incontri imprevedibili.",
      ],
      tagesplan: "Esercita la sequenza più volte a secco: simula la comparsa di un fattore scatenante, poi subito: 1. restare calmi, 2. segnale di INTERRUZIONE, 3. svolta di 90 gradi, 4. allontanarsi con calma, 5. dopo 50m marcatore di rassicurazione + premietto. Allena in casa senza un vero stimolo.",
      no_gos: [
        "Il primo utilizzo in una vera situazione di emergenza: la routine deve essere solida prima.",
        "Condizionare il segnale di INTERRUZIONE come punizione: è solo un segnale di 'altra direzione'.",
        "Farsi prendere dal panico in una vera emergenza: porta a termine la routine.",
      ],
      fortschritt: [
        "Conosci la sequenza a memoria.",
        "{dogName} conosce il segnale di INTERRUZIONE.",
        "Ti senti preparato, invece che impotente.",
      ],
      exerciseIds: ["a-emergency-protokoll", "a-bat-distanz"],
    },
    // 6-Monats-Vertiefungen
    {
      title: "Estendere il tempo di indossamento della museruola",
      schwerpunkt: "Sulla base della settimana 2: estendi il tempo di indossamento a 15-20 min, con un'attività. {dogName} deve accettare la museruola come normale componente della passeggiata.",
      wochenziele: [
        "{dogName} indossa la museruola per 15-20 min in modo rilassato.",
        "Riesce a bere e annusare con la museruola.",
        "La museruola è parte della preparazione alla passeggiata, non un dramma.",
      ],
      tagesplan: "Sessioni quotidiane di indossamento: metti la museruola, poi dai da mangiare con il Kong attraverso la griglia. Giorno 1-2 5 min, giorno 3-5 10 min, giorno 6-7 15 min. A seguire un'attività positiva: gioco o passeggiata ancora SENZA museruola. Associazione: museruola = segue qualcosa di bello.",
      no_gos: [
        "Estendere il tempo di indossamento troppo in fretta: la frustrazione carica un'associazione negativa.",
        "Sessioni con museruola in stress o sovraeccitazione.",
        "Lasciare la museruola da sola per lungo tempo: è un ausilio, non una punizione.",
      ],
      fortschritt: [
        "Il tempo di indossamento funziona in modo rilassato.",
        "{dogName} reagisce positivamente alla preparazione della museruola.",
        "La museruola è una parte abituale del tuo repertorio.",
      ],
      exerciseIds: ["a-maulkorb-positiv", "a-schwellenwert-finden"],
    },
    {
      title: "Guarda là con mini-stimoli in casa",
      schwerpunkt: "Il Guarda là si esercita in appartamento con stimoli più difficili: rumori, movimenti improvvisi, altri membri della famiglia come 'fattore scatenante'. {dogName} consolida il principio.",
      wochenziele: [
        "Il Guarda là funziona con 5+ stimoli diversi in casa.",
        "{dogName} guarda il conduttore entro 1-2 sec.",
        "La ricompensa arriva rapida e coerente.",
      ],
      tagesplan: "Allena in casa con vari stimoli: un membro della famiglia si muove in modo vistoso, un rumore (registrazione di campanello a basso volume), un giocattolo vola per la stanza. Per ogni stimolo Guarda là + click + ricompensa. 3-4 sessioni al giorno, ognuna di 5 min.",
      no_gos: [
        "Stimoli troppo intensi: sovraccaricano il giovane Guarda là.",
        "Usare stimoli senza il marcatore GUARDA: annacqua l'associazione.",
        "Forzare {dogName}: deve guardare il conduttore da sola.",
      ],
      fortschritt: [
        "Il Guarda là funziona con vari stimoli in casa.",
        "Il tempo di reazione è sotto i 2 sec.",
        "Sei pronto per veri stimoli all'aperto.",
      ],
      exerciseIds: ["a-lat", "a-engage-disengage"],
    },
    {
      title: "Imparare a leggere i segnali di stress",
      schwerpunkt: "Questa settimana impari a leggere ESATTAMENTE il linguaggio del corpo di {dogName}. I primi segnali di stress sono il tuo sistema di allerta precoce. Chi non li riconosce arriva sempre troppo tardi a intervenire.",
      wochenziele: [
        "Conosci i segnali di stress individuali di {dogName} (5+ categorie).",
        "Riconosci con sicurezza i livelli di stress 1-2 (prima che arrivi l'escalation).",
        "Reagisci ai primi segnali con la distanza, non solo a quelli tardivi con una correzione.",
      ],
      tagesplan: "Osserva ogni giorno 30 min di passeggiata con un focus mirato sul linguaggio del corpo: dimensione delle pupille, tensione della bocca, respiro, altezza della coda, andatura, posizione delle orecchie. Annota la sera: quali segnali precoci hai visto? In quale situazione? Impara lo schema individuale di {dogName}.",
      no_gos: [
        "Reagire solo ai segnali tardivi (ringhio, arricciamento del labbro): a quel punto è troppo tardi.",
        "Ignorare o minimizzare i segnali di stress ('è normale').",
        "'Tirare dritto' con {dogName} in situazioni di stress: fa solo degenerare.",
      ],
      fortschritt: [
        "Riconosci con affidabilità i primi segnali di {dogName}.",
        "Reagisci in modo proattivo con la distanza.",
        "Le escalation diventano più rare, perché blocchi presto i segnali di stress.",
      ],
      exerciseIds: ["a-schwellenwert-finden", "a-maulkorb-positiv"],
    },
    {
      title: "Verifica delle fondamenta prima della Fase 2",
      schwerpunkt: "Ultima settimana di fondamenta. Museruola positiva? Soglie note? Il Guarda là in casa è solido? Protocollo di emergenza esercitato? Questi elementi sono indispensabili per la Fase 2 all'aperto.",
      wochenziele: [
        "Tutti e 4 gli elementi sono stabiliti: museruola, soglia, Guarda là, emergenza.",
        "Ti senti preparato per l'addestramento all'aperto con veri fattori scatenanti.",
        "{dogName} conosce gli strumenti.",
      ],
      tagesplan: "Fai un bilancio onesto: cosa è solido, cosa vacilla? Se qualcosa vacilla: aggiungi 1 settimana in più. Questa fase decide le prossime 8 settimane: una preparazione pulita è tutto. Ripassa a secco ancora una volta il protocollo di emergenza.",
      no_gos: [
        "Saltare alla Fase 2 per impazienza: con fondamenta traballanti degenera.",
        "Riparare più debolezze insieme nella Fase 2: caotico.",
        "Abbandonare il piano perché le fondamenta durano più a lungo: tieni duro.",
      ],
      fortschritt: [
        "Ti senti competente e preparato.",
        "Gli strumenti sono solidi e chiari.",
        "{dogName} conosce gli elementi.",
      ],
      exerciseIds: ["a-lat", "a-engage-disengage"],
    },
  ],
  steigerung: [
    {
      title: "Guarda là con veri fattori scatenanti da grande distanza",
      schwerpunkt: "Ora si va all'aperto. {dogName} vede veri fattori scatenanti, ma da grande distanza (50m+, SOTTO soglia). Il Guarda là diventa la reazione standard agli stimoli.",
      wochenziele: [
        "Il Guarda là funziona all'aperto con 3+ tipi di fattore scatenante.",
        "{dogName} resta sotto soglia.",
        "La densità di ricompensa è alta (nessun risparmio in questa fase).",
      ],
      tagesplan: "2 volte a settimana sessioni dedicate di Guarda là in un luogo con fattori scatenanti prevedibili (bordo del parco, percorso da jogging). Distanza iniziale: 50m+. Per sessione 4-6 ripetizioni di Guarda là, poi termina. Museruola di riserva per le emergenze.",
      no_gos: [
        "Avvicinare la soglia: un apprendimento disperato diventa reazione.",
        "Ridurre la frequenza di ricompensa: quella arriva solo nella Fase 3.",
        "Guarda là all'aperto senza un pulito Guarda là in casa: mancano le fondamenta.",
      ],
      fortschritt: [
        "Il Guarda là funziona all'aperto.",
        "I fattori scatenanti innescano la ricerca dell'attenzione, non la reazione.",
        "Riconosci lievi successi di apprendimento.",
        "{dogName} dopo aver guardato si allontana attivamente invece di fissare.",
      ],
      exerciseIds: ["a-lat", "a-engage-disengage"],
    },
    {
      title: "Guardare-e-distogliere: allontanamento attivo dallo stimolo",
      schwerpunkt: "Livello successivo dopo il Guarda là: {dogName} guarda il fattore scatenante e POI si allontana da sola. Tu premi il distogliere lo sguardo con un maxi-premio. {dogName} impara: posso scegliere io la strategia.",
      wochenziele: [
        "{dogName} distoglie lo sguardo da sola dopo aver avvistato il fattore scatenante.",
        "Il distogliere lo sguardo viene premiato con un maxi-premio.",
        "{dogName} sviluppa un comportamento di libera scelta.",
      ],
      tagesplan: "2-3 sessioni di guardare-e-distogliere a settimana. Distanza come per il Guarda là, ma ora aspetta il distogliere spontaneo dello sguardo. Se {dogName} guarda e poi da sola distoglie lo sguardo: maxi-premio di 3 premietti di fila. Se continua a fissare: un lieve suggerimento GUARDA.",
      no_gos: [
        "Forzare {dogName} o costringerla a distogliere lo sguardo: l'effetto di apprendimento va perso.",
        "Passare al guardare-e-distogliere prima di un pulito Guarda là.",
        "Rendere la ricompensa troppo piccola: qui il maxi-premio è essenziale.",
      ],
      fortschritt: [
        "{dogName} si allontana attivamente dai fattori scatenanti.",
        "Nasce l'autoregolazione.",
        "Devi guidare di meno.",
      ],
      exerciseIds: ["a-maulkorb-positiv", "a-schwellenwert-finden"],
    },
    {
      title: "L'ARCO come strategia attiva",
      schwerpunkt: "Quando il fattore scatenante si avvicina troppo: un arco attivo con un piano chiaro. Hai individuato prima le vie di fuga. {dogName} ti segue nella zona di sicurezza, senza che nasca un conflitto.",
      wochenziele: [
        "{dogName} segue con affidabilità il segnale ARCO.",
        "Usi attivamente 2-3 sequenze di arco per passeggiata.",
        "Gli incontri si gestiscono con l'arco senza escalation.",
      ],
      tagesplan: "Per ogni passeggiata pianifica 2-3 vere situazioni di arco. Distanza almeno 15m dal fattore scatenante. Fai l'arco (aggirare) con decisione, ma non in preda al panico. Dopo ogni incontro riuscito: 3 premietti + marcatore di rassicurazione.",
      no_gos: [
        "Usare l'arco solo quando {dogName} è già tesa: meglio in modo preventivo.",
        "Contatto visivo diretto con il cane o la persona che arriva incontro.",
        "Fare l'arco senza una chiara pianificazione anticipata della via di fuga.",
      ],
      fortschritt: [
        "{dogName} segue con fluidità il segnale ARCO.",
        "Gli incontri si svolgono in modo controllato.",
        "Ti senti capace di agire.",
      ],
      exerciseIds: ["a-bogen-aktiv", "a-lat"],
    },
    {
      title: "Controcondizionamento intensivo",
      schwerpunkt: "Questa settimana lavori in modo mirato sull'associazione emotiva: il fattore scatenante compare = arriva il premietto. Nel corso delle settimane il fattore scatenante diventa il segnale 'positivo', invece che il fattore di stress.",
      wochenziele: [
        "{dogName} si aspetta un premietto quando compare un fattore scatenante.",
        "I segni di stress si riducono.",
        "L'associazione emotiva cambia in profondità.",
      ],
      tagesplan: "2-3 sessioni dedicate di controcondizionamento: luogo con fattori scatenanti a distanza. Il fattore scatenante compare: GUARDA + dai da mangiare in continuazione finché il fattore scatenante è visibile. Fattore scatenante via = premietti stop. {dogName} impara: il fattore scatenante compare = paese di cuccagna.",
      no_gos: [
        "Premiare solo dopo la reazione: non cambia l'associazione emotiva.",
        "Densità di ricompensa troppo bassa.",
        "Avvicinarsi troppo: la distanza è tutto.",
      ],
      fortschritt: [
        "{dogName} ti guarda con aspettativa quando compaiono i fattori scatenanti.",
        "I segni di stress diventano più brevi e più rari.",
        "I fattori scatenanti innescano un'aspettativa positiva invece che negativa.",
      ],
      exerciseIds: ["a-maulkorb-positiv", "a-engage-disengage"],
    },
    {
      title: "Ridurre gradualmente la distanza",
      schwerpunkt: "Dopo che il Guarda là e il guardare-e-distogliere da grande distanza sono solidi, riduci GRADUALMENTE la distanza. Ma: solo 1-2m a settimana, senza fretta. Qui la pazienza ripaga più che in qualsiasi altro punto.",
      wochenziele: [
        "La distanza di soglia si è ridotta di 5-10m.",
        "{dogName} resta sotto soglia con fattori scatenanti più vicini.",
        "Lavori con pazienza e in modo misurabile.",
      ],
      tagesplan: "Giorno 1-3: distanza come la settimana scorsa, sessioni molto stabili. Giorno 4-7: avvicinati di 2m, osserva. Se ci sono segni di stress: torna SUBITO indietro. Se è tutto chiaro: resta lì per la settimana successiva. La riduzione della distanza NON è una gara.",
      no_gos: [
        "Ridurre la distanza in modo radicale: escalation.",
        "Aumentare la pressione nei giorni storti: i plateau sono normali.",
        "Ignorare la soglia quando è cambiata.",
      ],
      fortschritt: [
        "La soglia si riduce in modo misurabile.",
        "{dogName} resta sotto il nuovo valore.",
        "Lavori con pazienza e in modo sistematico.",
      ],
      exerciseIds: ["a-schwellenwert-finden", "a-lat"],
    },
    {
      title: "Avvio del Behavior Adjustment Training",
      schwerpunkt: "Il Behavior Adjustment Training (addestramento di adattamento comportamentale) è il metodo per eccellenza con i cani reattivi. {dogName} ha una longhina, più libertà di movimento, e tu premi con la distanza i movimenti di risoluzione dello stress fatti in AUTONOMIA. {dogName} riacquista il controllo.",
      wochenziele: [
        "{dogName} capisce il principio del Behavior Adjustment Training: risoluzione dello stress = la distanza aumenta.",
        "Mostra autonomamente 3-4 movimenti di risoluzione dello stress.",
        "Appare più sicura e più controllata.",
      ],
      tagesplan: "1-2 sessioni di Behavior Adjustment Training a settimana in un punto tranquillo con un fattore scatenante controllabile. Longhina 5m. {dogName} guarda il fattore scatenante: tu aspetti. Appena mostra una risoluzione dello stress (distogliere lo sguardo, scrollarsi, leccare il terreno, annusare): allontanati SUBITO attivamente con lei, via dal fattore scatenante.",
      no_gos: [
        "Behavior Adjustment Training in sovraccarico di stimoli: funziona solo in un ambiente controllato.",
        "Forzare {dogName} o costringere la risoluzione dello stress: non fa parte del principio.",
        "Ricompensa con premietto: qui è essenziale la ricompensa funzionale (la distanza).",
      ],
      fortschritt: [
        "{dogName} mostra attivamente un comportamento di risoluzione dello stress.",
        "Appare più sicura e con più autocontrollo.",
        "Il Behavior Adjustment Training diventa il metodo normale.",
      ],
      exerciseIds: ["a-bat-distanz", "a-emergency-protokoll"],
    },
    {
      title: "Variabilità nei fattori scatenanti",
      schwerpunkt: "Finora hai lavorato su singoli tipi di fattore scatenante. Questa settimana cambi in modo mirato: oggi cani, domani jogger, dopodomani biciclette. {dogName} impara: la strategia è sempre la stessa, qualunque sia il fattore scatenante.",
      wochenziele: [
        "{dogName} usa Guarda là/arco/controcondizionamento con vari fattori scatenanti.",
        "La strategia è generalizzata, non specifica per un trigger.",
        "Ti senti preparato agli incontri imprevedibili.",
      ],
      tagesplan: "Pianifica in modo mirato: 1 passeggiata di questa settimana con focus sui cani, 1 con focus sui jogger, 1 con focus sulle biciclette. Per ogni passeggiata applica la stessa strategia, evitando se necessario gli altri fattori scatenanti.",
      no_gos: [
        "Accumulare più tipi di fattore scatenante per passeggiata: sovraccarica.",
        "Cambiare strategia a seconda del fattore scatenante: confonde.",
        "Accorgersi solo al terzo fattore scatenante che {dogName} è già sovraeccitata.",
      ],
      fortschritt: [
        "Le strategie funzionano trasversalmente ai trigger.",
        "Riconosci con sicurezza quale strategia sia adatta.",
        "{dogName} reagisce in modo prevedibile a vari stimoli.",
      ],
      exerciseIds: ["a-lat", "a-bogen-aktiv"],
    },
    {
      title: "Consolidamento dell'incremento",
      schwerpunkt: "Ultima settimana di incremento. Combini Guarda là, guardare-e-distogliere, arco, controcondizionamento, Behavior Adjustment Training. {dogName} ha un repertorio completo. Fase 3 = applicazione nella vera quotidianità.",
      wochenziele: [
        "Tutti gli strumenti possono essere combinati con flessibilità.",
        "{dogName} usa in parte le strategie da sola.",
        "Hai un'idea chiara di quali strumenti verranno portati avanti nella Fase 3.",
      ],
      tagesplan: "Trasforma ogni passeggiata di questa settimana in un bilancio: quale strategia funziona e quando? Dove devi ancora intervenire? Dove va da sé? Annota alla fine della settimana un resoconto onesto.",
      no_gos: [
        "Dare i successi per scontati: l'attenzione resta importante.",
        "Ridurre già molto la densità di ricompensa nella Fase 3.",
        "Confrontarsi con altre coppie cane-persona: il tuo percorso è individuale.",
      ],
      fortschritt: [
        "{dogName} usa attivamente almeno 2 strategie per passeggiata.",
        "Ti senti competente e capace di agire.",
        "La reattività è ridotta in modo riconoscibile.",
      ],
      exerciseIds: ["a-bat-distanz", "a-maulkorb-positiv"],
    },
  ],
  generalisierung: [
    {
      title: "Stabilire il Behavior Adjustment Training nella quotidianità",
      schwerpunkt: "Fase 3 = il Behavior Adjustment Training diventa lo standard. {dogName} ottiene sempre più controllo sulla scelta della propria distanza. Questa settimana stabilisci il Behavior Adjustment Training in tutte le normali situazioni di passeggiata.",
      wochenziele: [
        "Il Behavior Adjustment Training viene applicato ogni giorno nelle normali passeggiate.",
        "{dogName} sceglie da sola le strategie di distanza.",
        "Devi guidare di meno.",
      ],
      tagesplan: "Per ogni passeggiata inserisci momenti attivi di Behavior Adjustment Training: a ogni fattore scatenante che non si avvicina in modo acuto, dai a {dogName} il tempo per l'autoregolazione. Appena arriva la risoluzione dello stress: allontanati attivamente con lei. La ricompensa funzionale diventa lo standard.",
      no_gos: [
        "Forzare il Behavior Adjustment Training: funziona solo se {dogName} lo mostra da sola.",
        "Continuare il Behavior Adjustment Training in caso di escalation: allora protocollo di emergenza.",
        "Tralasciare del tutto le altre strategie (Guarda là, arco): il Behavior Adjustment Training integra, non sostituisce.",
      ],
      fortschritt: [
        "{dogName} si autoregola in autonomia in molte situazioni.",
        "Ti senti un accompagnatore, non un pilota.",
        "Le passeggiate sono più tranquille e più sicure.",
        "In un incontro improvviso conosci la sequenza di emergenza in 7 passi e la usi senza drammi.",
      ],
      exerciseIds: ["a-bat-distanz", "a-emergency-protokoll"],
    },
    {
      title: "Gerarchia dei fattori scatenanti e gestione",
      schwerpunkt: "Individua con chiarezza: quali fattori scatenanti sono 'gestibili' per {dogName}, quali restano un tabù? La gestione è importante quanto l'addestramento, e distingue tra realtà e pio desiderio.",
      wochenziele: [
        "Hai una chiara gerarchia dei fattori scatenanti su carta.",
        "Pianifichi le passeggiate di conseguenza.",
        "Riconosci dove la gestione è meglio dell'addestramento.",
      ],
      tagesplan: "Giorno 1-2: crea un elenco dei tuoi fattori scatenanti per difficoltà. Giorno 3-7: pianifica le passeggiate di conseguenza. Evita consapevolmente i fattori scatenanti difficili, allena attivamente quelli medi, rendi routine quelli facili. Mai tutti i fattori scatenanti in un solo giorno.",
      no_gos: [
        "Forzare i fattori scatenanti difficili: degenera.",
        "Vedere la gestione come un 'arrendersi': è un intelligente riconoscimento della realtà.",
        "Partire senza un piano: rischio di escalation.",
      ],
      fortschritt: [
        "Pianifichi in modo strutturato.",
        "Le escalation diventano più rare.",
        "Accetti che non tutto è addestrabile.",
      ],
      exerciseIds: ["a-schwellenwert-finden", "a-lat"],
    },
    {
      title: "Costruire una zona cuscinetto di confronto",
      schwerpunkt: "Quando sai che sta per arrivare un incontro (ingresso del parco, sentiero stretto), lavori con una zona cuscinetto: 20m prima smetti di parlare, tieni pronti i premietti, entri in 'modalità addestramento'.",
      wochenziele: [
        "{dogName} conosce la routine della zona cuscinetto.",
        "Gli incontri vengono preparati, non sono una sorpresa.",
        "Le reazioni di stress vengono prevenute in modo preventivo.",
      ],
      tagesplan: "Per ogni passeggiata pianifica 3-5 zone cuscinetto: 20m prima del punto critico entra in modalità addestramento. Mano pronta in tasca, guinzaglio più corto, segnale GUARDA attivo. Il fattore scatenante compare: Guarda là o controcondizionamento. Dopo 20m fuori dalla linea di vista: rilassati.",
      no_gos: [
        "Dimenticare la zona cuscinetto e poi reagire in modo reattivo.",
        "Zona cuscinetto su tratti facili: annacqua la strategia.",
        "Zona cuscinetto troppo stretta: 5m sono troppo pochi.",
      ],
      fortschritt: [
        "{dogName} reagisce alla preparazione della zona cuscinetto con calma aspettativa.",
        "Gli incontri si svolgono in modo controllato.",
        "Usi la strategia in modo riflesso.",
      ],
      exerciseIds: ["a-bogen-aktiv", "a-maulkorb-positiv"],
    },
    {
      title: "Gestire attivamente il recupero dallo stress",
      schwerpunkt: "Dopo ogni incontro difficile {dogName} ha bisogno di tempo di recupero. Gli ormoni dello stress si smaltiscono del tutto solo dopo 72h. Se ne tieni conto, eviti lo stress cumulativo.",
      wochenziele: [
        "Conosci la regola delle 72h: dopo forte stress almeno 1-2 giorni di recupero.",
        "Il piano di passeggiate di {dogName} tiene conto del carico di stress.",
        "Lo stress cumulativo viene evitato.",
      ],
      tagesplan: "Annota dopo ogni passeggiata: fase di forte stress sì/no? Se sì: il giorno dopo consapevolmente tranquillo (passeggiata più breve, più decompressione, meno fattori scatenanti). Regola delle 72h: dopo forte stress 2 giorni in 'modalità recupero'.",
      no_gos: [
        "Tornare subito nell'area dei fattori scatenanti dopo lo stress: si cumula.",
        "Negare le fasi di stress: il cane ha bisogno di recupero.",
        "Vedere la modalità recupero come una 'perdita': è addestramento attivo.",
      ],
      fortschritt: [
        "Riconosci con sicurezza il carico di stress.",
        "{dogName} ha chiare fasi di recupero.",
        "Le escalation da stress cumulativo vengono evitate.",
      ],
      exerciseIds: ["a-emergency-protokoll", "a-bat-distanz"],
    },
    {
      title: "Ridurre la ricompensa con prudenza",
      schwerpunkt: "Dopo che le strategie sono solide, riduci lentamente la densità di ricompensa. Ma: in caso di aggressività non eliminarla MAI del tutto. Anche dopo anni il rinforzo resta importante.",
      wochenziele: [
        "La frequenza di ricompensa viene ridotta a circa il 50%.",
        "{dogName} mantiene le strategie anche con meno ricompensa.",
        "Le prestazioni migliori vengono ancora premiate con un maxi-premio.",
      ],
      tagesplan: "Con fattori scatenanti sicuri e noti: non premiare ogni volta. Con fattori scatenanti nuovi o difficili: mantieni la piena densità di ricompensa. {dogName} nota la differenza, ma cerca la relazione invece del premietto.",
      no_gos: [
        "Ridurre la densità di ricompensa in modo radicale: rischio di escalation.",
        "Risparmiare la ricompensa con fattori scatenanti difficili: la prestazione migliore ha un costo.",
        "Forzare la riduzione: gradualmente e con pazienza.",
      ],
      fortschritt: [
        "{dogName} lavora anche con meno ricompensa.",
        "La relazione diventa più preziosa del premietto.",
        "Metti mano meno spesso alla tasca.",
      ],
      exerciseIds: ["a-maulkorb-positiv", "a-lat"],
    },
    {
      title: "Luoghi difficili in modo mirato",
      schwerpunkt: "Luoghi finora evitati: sala d'attesa del veterinario, centro città nelle ore di punta. Questa settimana lavori consapevolmente su singoli punti critici, sempre con la museruola come sicurezza.",
      wochenziele: [
        "Gestisci 1 luogo ad alto rischio con calma per 10 min.",
        "La museruola viene stabilita come standard per i luoghi difficili.",
        "{dogName} amplia il suo spettro di comfort.",
      ],
      tagesplan: "Scegli ogni giorno esattamente 1 luogo ad alto rischio. Museruola su, preparato. 5-10 min di permanenza con Guarda là/controcondizionamento attivo. In caso di stress: uscire, nessun dramma. Importante: mai troppo a lungo.",
      no_gos: [
        "Più luoghi ad alto rischio lo stesso giorno: si cumula.",
        "Senza museruola in aree ad alto rischio sconosciute: la sicurezza viene prima.",
        "'Tirare dritto' con {dogName} in caso di stress: degenera.",
      ],
      fortschritt: [
        "I luoghi ad alto rischio diventano gestibili.",
        "{dogName} amplia il suo repertorio.",
        "Siete più flessibili nella quotidianità.",
      ],
      exerciseIds: ["a-bogen-aktiv", "a-bat-distanz"],
    },
    {
      title: "Gestire gli stimoli in movimento",
      schwerpunkt: "Ciclisti, skateboarder, jogger che corrono veloci: gli stimoli in movimento sono spesso la sfida più grande in caso di aggressività. Questa settimana ci lavori in modo mirato.",
      wochenziele: [
        "{dogName} gestisce con calma le biciclette che passano a 10m di distanza.",
        "Hai chiare strategie di zona cuscinetto per gli stimoli in movimento.",
        "Le reazioni di stress diventano più rare.",
      ],
      tagesplan: "Cerca attivamente percorsi con stimoli in movimento (piste ciclabili, percorsi da jogging). Distanza iniziale 15m. Guarda là a ogni passaggio. Mantieni alta la densità di ricompensa. Riduci gradualmente a 10m.",
      no_gos: [
        "Andare direttamente su un sentiero stretto con traffico costante.",
        "Voler provocare gli stimoli in movimento: rischio di escalation.",
        "Bloccarsi in caso di escalation: usa il protocollo di emergenza.",
      ],
      fortschritt: [
        "{dogName} reagisce con più calma agli stimoli in movimento.",
        "Ti senti sicuro su percorsi multipli.",
        "Gli stimoli in movimento perdono il loro spavento.",
      ],
      exerciseIds: ["a-lat", "a-maulkorb-positiv"],
    },
    {
      title: "Passaggio alla modalità di mantenimento",
      schwerpunkt: "Ultima settimana. Il lavoro sull'aggressività è un compito per la vita, non un processo concluso. Ma: gli strumenti sono solidi, le strategie sono rodate, ti senti competente. Il piano di mantenimento è pronto.",
      wochenziele: [
        "Tutti gli strumenti funzionano nella quotidianità.",
        "Il ritmo di mantenimento è chiaro.",
        "Sei capace di agire nel lungo termine.",
      ],
      tagesplan: "Pianifica il piano di mantenimento: ogni 2-3 settimane un 'giorno di addestramento' in cui eserciti di nuovo in modo mirato Guarda là/Behavior Adjustment Training/arco. Ogni 3 mesi un bilancio con l'educatore cinofilo. Tieni pronta la museruola per le emergenze. Continua a osservare la regola delle 72h.",
      no_gos: [
        "Eliminare di colpo tutte le routine: rischio di regressione.",
        "Vedere l'aggressività come 'risolta': ha bisogno di ulteriore attenzione.",
        "Rischiare situazioni ad alto rischio senza museruola: la sicurezza resta importante.",
      ],
      fortschritt: [
        "{dogName} è più controllabile nel lungo termine.",
        "Ti senti un competente gestore della reattività.",
        "Le escalation sono rare e vengono riconosciute presto.",
      ],
      exerciseIds: ["a-bat-distanz", "a-emergency-protokoll"],
    },
  ],
};

// ────────────────────────────────────────────────────────────────────
// MOUTHING (Aufnehmen von Gegenständen) — AUS, Tausch, Management
// ────────────────────────────────────────────────────────────────────
const MOUTHING_WEEKS: Record<Phase, WeekTemplate[]> = {
  fundament: [
    {
      title: "Costruire il segnale LASCIA in modo pulito",
      schwerpunkt: "LASCIA è il segnale più importante in assoluto. Deve essere POSITIVO, altrimenti {dogName} non sputa più nulla quando conta davvero. Questa settimana lo costruisci in casa con oggetti di basso valore.",
      wochenziele: [
        "{dogName} cede spontaneamente gli oggetti al LASCIA.",
        "Il segnale è collegato a una ricompensa positiva.",
        "Puoi usarlo con sicurezza in situazioni tranquille.",
      ],
      tagesplan: "3-4 sessioni da 5 min al giorno. Inizia con un giocattolo di basso valore. Di' LASCIA + offri un premietto di alto valore. {dogName} lascia cadere → BRAVO + premietto + gli restituisci il giocattolo. {dogName} impara: LASCIA porta qualcosa di meglio E riavere l'originale.",
      no_gos: [
        "Infilare la mano in bocca — avvelena il segnale.",
        "LASCIA in tono minaccioso — viene collegato in negativo.",
        "Oggetti di alto valore all'inizio — troppo difficili.",
      ],
      fortschritt: [
        "{dogName} cede oggetti semplici al LASCIA.",
        "Il tempo di reazione è sotto i 3 sec.",
        "Hai uno strumento affidabile per le situazioni di scambio.",
      ],
      exerciseIds: ["m-aus-aufbauen", "m-pfui-konditionieren"],
    },
    {
      title: "Stabilire lo scambio",
      schwerpunkt: "Quando {dogName} ha raccolto qualcosa fuori, uno scambio deve essere la reazione standard. Non conflitto, ma un miglioramento: io cedo, io ricevo qualcosa di meglio.",
      wochenziele: [
        "Reagisci a un oggetto raccolto con uno scambio, non con un conflitto.",
        "{dogName} conosce il principio dello scambio.",
        "Le passeggiate nei punti caldi filano senza drammi.",
      ],
      tagesplan: "Esercitati in casa con oggetti diversi: {dogName} ha qualcosa in bocca, ti avvicini con calma, di' LASCIA, alza il premietto, scambio. Non afferrare e non correre MAI. 5-7 esercizi di scambio al giorno in casa, poi trasferimento alle passeggiate.",
      no_gos: [
        "Rincorrere il cane quando raccoglie qualcosa — rinforza il gioco.",
        "Restituire l'oggetto raccolto — così lo scambio non è reale.",
        "Usare minacce o punizioni — avvelena la relazione.",
      ],
      fortschritt: [
        "{dogName} cede senza scappare.",
        "Lo scambio è la reazione standard nelle situazioni di raccolta.",
        "Non ti senti più impotente.",
      ],
      exerciseIds: ["m-tausch-protokoll", "m-leinen-management"],
    },
    {
      title: "Condizionare il NO come segnale di STOP",
      schwerpunkt: "Il NO si usa PRIMA che {dogName} raccolga qualcosa. Condizionato in modo pulito con una ricompensa alternativa, nel giro di settimane il NO diventa automatico. MAI come punizione.",
      wochenziele: [
        "{dogName} reagisce al NO fermandosi.",
        "Si gira verso la ricompensa dal proprietario.",
        "Il segnale è condizionato in modo sicuro in casa.",
      ],
      tagesplan: "In casa con un premietto per terra che {dogName} non può avere: NO con voce ferma ma calma, offri subito un premietto di alto valore dalla mano. {dogName} si allontana dal premietto per terra verso la mano → BRAVO + premietto. 5-7 ripetizioni per sessione, 3 sessioni al giorno.",
      no_gos: [
        "Usare il NO come pura punizione.",
        "Usarlo a raffica — ne annacqua il significato.",
        "Senza ricompensa alternativa — {dogName} non capisce il collegamento.",
      ],
      fortschritt: [
        "{dogName} reagisce al NO in casa in modo sicuro.",
        "Il tempo di reazione è sotto i 2 sec.",
        "Sei pronto per il trasferimento all'esterno.",
      ],
      exerciseIds: ["m-pfui-konditionieren", "m-aus-aufbauen"],
    },
    {
      title: "Imparare la gestione del guinzaglio",
      schwerpunkt: "La maggior parte delle situazioni di raccolta è evitabile con la gestione del guinzaglio. Nei punti caldi (bidoni, ingressi dei parchi) tieni il guinzaglio corto e distrai attivamente. Prevenzione invece che reazione.",
      wochenziele: [
        "Riconosci chiaramente i tuoi punti caldi tipici.",
        "Nei punti caldi il guinzaglio si accorcia in modo riflesso.",
        "{dogName} impara: in questi punti l'attenzione al proprietario è più preziosa.",
      ],
      tagesplan: "Giorno 1-2: durante le passeggiate normali annota dove {dogName} raccoglie più spesso. Giorno 3-7: in questi punti guinzaglio attivamente a 1m, ricompensa al piede durante il passaggio, un premietto ogni 5 passi lungo la gamba.",
      no_gos: [
        "Ignorare i punti caldi — il successo nel raccogliere rinforza il comportamento.",
        "Accorciare il guinzaglio solo quando {dogName} mostra interesse — meglio in modo preventivo.",
        "Passare senza ricompensa attiva — diventa un peso.",
      ],
      fortschritt: [
        "{dogName} cerca la posizione al piede nei punti caldi.",
        "La frequenza di raccolta nei punti noti si riduce.",
        "Sei proattivo invece che reattivo.",
      ],
      exerciseIds: ["m-leinen-management", "m-maulkorb-uebergang"],
    },
    // Vertiefungen
    {
      title: "LASCIA con valore crescente",
      schwerpunkt: "In continuità con la settimana 1: LASCIA ora con oggetti di maggior valore, persino ossa e giocattolo preferito. {dogName} deve imparare: anche con oggetti preziosi lo scambio è l'affare migliore.",
      wochenziele: [
        "{dogName} cede al LASCIA anche oggetti di alto valore.",
        "La ricompensa deve essere altrettanto preziosa (pollo, würstel).",
        "Hai piena fiducia nel segnale.",
      ],
      tagesplan: "Aumenta il valore giorno per giorno: Giorno 1-2: giocattolo semplice. Giorno 3-4: giocattolo preferito. Giorno 5-7: osso o articolo da masticare. Ad ogni LASCIA la ricompensa deve essere all'altezza dell'oggetto — con un osso pollo MEGA.",
      no_gos: [
        "Aumentare il valore troppo in fretta — frustrazione.",
        "Ricompensa troppo bassa — {dogName} non cede.",
        "LASCIA con un oggetto di valore estremo (difesa delle risorse) senza aiuto professionale — pericoloso.",
      ],
      fortschritt: [
        "LASCIA funziona anche con oggetti di alto valore.",
        "{dogName} cerca attivamente occasioni di scambio.",
        "Hai fiducia nello strumento.",
      ],
      exerciseIds: ["m-aus-aufbauen", "m-tausch-protokoll"],
    },
    {
      title: "Museruola per il periodo di transizione",
      schwerpunkt: "Finché l'addestramento non è al 100%, una museruola protegge {dogName} da bocconi avvelenati e oggetti taglienti. Questa settimana la condizioni in modo positivo.",
      wochenziele: [
        "{dogName} porta la museruola per 10-15 min rilassato.",
        "Riesce a bere e annusare con la museruola.",
        "La museruola è uno strumento di sicurezza, non una punizione.",
      ],
      tagesplan: "Giorno 1-3: museruola visibile in casa, premietto attraverso le sbarre. Giorno 4-5: brevi periodi di 1-2 min con un'attività. Giorno 6-7: 10-15 min con un Kong. Trasferisci nella fase 2 alle vere passeggiate ad alto rischio.",
      no_gos: [
        "Mettere la museruola troppo in fretta per lungo tempo — frustrazione.",
        "Usare la museruola come punizione — avvelena l'associazione.",
        "Scegliere il tipo sbagliato (fascia in tessuto) — blocca anche l'ansimare.",
      ],
      fortschritt: [
        "{dogName} porta la museruola rilassato.",
        "Hai una rete di sicurezza.",
        "La museruola è routine, non un dramma.",
      ],
      exerciseIds: ["m-maulkorb-uebergang", "m-leinen-management"],
    },
    {
      title: "La ricerca della ricompensa come alternativa",
      schwerpunkt: "I cani con la pulsione a raccogliere hanno spesso una forte pulsione alla ricerca. La incanaliamo in modo produttivo: cercare attivamente invece di raccogliere a caso. Il naso viene impegnato in una ricerca CONSENTITA.",
      wochenziele: [
        "{dogName} cerca attivamente il cibo lanciato.",
        "La ricerca della ricompensa sostituisce in parte la raccolta casuale.",
        "La pulsione alla ricerca viene incanalata in modo produttivo.",
      ],
      tagesplan: "Ad ogni passeggiata, in punti sicuri (prato, parco pulito): lancia un piccolo premietto e di' CERCA. {dogName} cerca attivamente con il naso. 5-7 volte a passeggiata. Progressione: 2 premietti contemporaneamente in direzioni diverse.",
      no_gos: [
        "Gioco del CERCA sui percorsi con punti caldi — sovraccarica.",
        "Indicare attivamente a {dogName} — la ricerca autonoma è l'effetto di apprendimento.",
        "Ricompense troppo grandi — il cane si sazia prima della fine della passeggiata.",
      ],
      fortschritt: [
        "{dogName} cerca attivamente le ricompense lanciate.",
        "La pulsione alla ricerca è impegnata in modo produttivo.",
        "Il comportamento di raccolta si riduce in parte.",
      ],
      exerciseIds: ["m-belohnungs-suche", "m-pfui-konditionieren"],
    },
    {
      title: "Verifica delle fondamenta",
      schwerpunkt: "Ultima settimana di fondamenta. LASCIA positivo? Lo scambio è consolidato? Il NO funziona in casa? Museruola accettata? Questi strumenti sono la base per l'applicazione all'esterno.",
      wochenziele: [
        "Tutti i 4 elementi sono stabiliti: LASCIA, scambio, NO, museruola.",
        "Ti senti preparato per l'applicazione all'esterno.",
        "{dogName} conosce gli strumenti.",
      ],
      tagesplan: "Fai un bilancio onesto: cosa è consolidato, cosa traballa? In caso di debolezza: aggiungi 1 settimana extra. Fondamenta pulite sono il presupposto per l'esterno.",
      no_gos: [
        "Saltare alla fase 2 per impazienza.",
        "Riparare più debolezze contemporaneamente.",
        "Abbandonare il piano perché le fondamenta richiedono più tempo.",
      ],
      fortschritt: [
        "Ti senti competente.",
        "Gli strumenti sono ben consolidati.",
        "{dogName} conosce gli elementi.",
      ],
      exerciseIds: ["m-aus-aufbauen", "m-tausch-protokoll"],
    },
  ],
  steigerung: [
    {
      title: "LASCIA all'esterno con stimoli leggeri",
      schwerpunkt: "Trasferimento da dentro a fuori. {dogName} ha raccolto qualcosa di basso valore (pezzo di carta, foglia): LASCIA-scambio come esercitato in casa. In un contesto reale.",
      wochenziele: [
        "LASCIA funziona all'esterno con raccolte di basso valore.",
        "Reagisci con calma e senza drammi.",
        "{dogName} capisce: il principio vale anche fuori.",
      ],
      tagesplan: "Ad ogni passeggiata aspettati 2-3 situazioni di raccolta, sii preparato. Quando raccoglie: guarda con calma, di' LASCIA, offri un premietto di alto valore. Frequenza di ricompensa alta in questa fase.",
      no_gos: [
        "Con oggetti di maggior valore (ossa, carne) subito con LASCIA — troppo difficile per la fase 2.",
        "Cercare il conflitto quando LASCIA non funziona — degenera.",
        "Uscire senza premietti — lo scambio è impossibile senza.",
      ],
      fortschritt: [
        "LASCIA funziona all'esterno con oggetti semplici.",
        "Il tempo di reazione è accettabile.",
        "Ti senti in grado di agire.",
      ],
      exerciseIds: ["m-pfui-konditionieren", "m-tausch-protokoll"],
    },
    {
      title: "Usare il NO all'esterno",
      schwerpunkt: "Il NO si usa PRIMA che {dogName} raccolga. Quando vedi che si china verso qualcosa: NO + ricompensa alternativa. Nel giro di settimane il NO diventa automatico.",
      wochenziele: [
        "Riconosci presto i segnali di raccolta (naso a terra, cambio di andatura).",
        "Il NO si usa in modo preventivo.",
        "{dogName} reagisce fermandosi e girandosi verso il proprietario.",
      ],
      tagesplan: "Ad ogni passeggiata 5-10 utilizzi del NO, ogni volta in modo preventivo: prima che {dogName} raccolga. Se reagisce: BRAVO + premietto. Se non reagisce: avvicinati di 1m, blocca fisicamente, offri il premietto.",
      no_gos: [
        "NO a raffica — non fa più effetto.",
        "NO senza ricompensa alternativa — punizione invece che addestramento.",
        "Ignorare i segnali di raccolta — il NO arriva troppo tardi.",
      ],
      fortschritt: [
        "Il NO funziona all'esterno.",
        "Riconosci presto i segnali.",
        "I tentativi di raccolta si riducono.",
      ],
      exerciseIds: ["m-aus-aufbauen", "m-maulkorb-uebergang"],
    },
    {
      title: "Gestione del guinzaglio nei punti caldi",
      schwerpunkt: "Gestione attiva del guinzaglio nei tuoi punti caldi tipici di raccolta. Guinzaglio corto, ricompensa nella posizione al piede. Prevenzione tramite il controllo dello spazio.",
      wochenziele: [
        "Nei punti caldi il guinzaglio si accorcia in modo riflesso.",
        "{dogName} cerca la posizione al piede nei punti caldi.",
        "La frequenza di raccolta nei punti noti si riduce nettamente.",
      ],
      tagesplan: "Ad ogni passeggiata, in 3-5 punti caldi guinzaglio a 1m, ricompensa continua lungo la gamba ogni 5 passi. {dogName} si concentra su di te, non sul terreno. Dopo il punto caldo: guinzaglio di nuovo più lasco.",
      no_gos: [
        "Accorciare il guinzaglio SOLO nei punti caldi — {dogName} se ne accorge.",
        "Senza ricompensa attiva — diventa un peso.",
        "Evitare i percorsi con punti caldi quando è possibile — anche evitare è una soluzione.",
      ],
      fortschritt: [
        "Il comportamento di raccolta nei punti caldi si riduce.",
        "{dogName} cerca attivamente la posizione al piede.",
        "Le passeggiate risultano più sotto controllo.",
      ],
      exerciseIds: ["m-leinen-management", "m-pfui-konditionieren"],
    },
    {
      title: "Usare attivamente la ricerca della ricompensa",
      schwerpunkt: "La pulsione alla ricerca viene usata in modo produttivo: ad ogni passeggiata più ricompense lanciate, {dogName} impara a cercare attivamente con il naso invece di raccogliere a caso.",
      wochenziele: [
        "5-7 unità di CERCA a passeggiata.",
        "{dogName} cerca in modo attivo e concentrato.",
        "La pulsione alla ricerca viene incanalata.",
      ],
      tagesplan: "Ad ogni passeggiata, in punti sicuri (puliti, senza rifiuti) lancia il premietto 5-7 volte + CERCA. Progressione nel corso della settimana: nascondigli più difficili, 2 premietti contemporaneamente, erba più alta. Le passeggiate diventano mini-sessioni di ricerca su traccia.",
      no_gos: [
        "In punti insicuri con rifiuti o pericolo di bocconi avvelenati — gioco di ricerca con ricompense controllate, non raccolta libera.",
        "Premietti troppo grandi — {dogName} si sazia prima della fine della passeggiata.",
        "Gioco di ricerca come pasto principale — dovrebbe essere aggiuntivo.",
      ],
      fortschritt: [
        "Il gioco di ricerca è ben avviato.",
        "{dogName} lavora attivamente con il naso.",
        "Il comportamento di raccolta si riduce.",
      ],
      exerciseIds: ["m-belohnungs-suche", "m-maulkorb-uebergang"],
    },
    // 6-Monats-Vertiefungen
    {
      title: "LASCIA con oggetti di maggior valore",
      schwerpunkt: "Aumento della difficoltà: {dogName} raccoglie un osso o del cibo. LASCIA deve funzionare anche qui. La ricompensa mega-pollo è pronta.",
      wochenziele: [
        "LASCIA funziona con oggetti di alto valore all'esterno.",
        "La mega-ricompensa viene offerta con costanza.",
        "{dogName} cede anche oggetti preziosi.",
      ],
      tagesplan: "Preparazione: ad ogni passeggiata tasca con una MEGA-ricompensa (piccolo pezzo di würstel o pollo). Con un oggetto raccolto di maggior valore: LASCIA + offri subito il würstel. Mai in queste situazioni senza MEGA-ricompensa.",
      no_gos: [
        "Risparmiare la MEGA-ricompensa — con oggetti di alto valore ha un costo.",
        "Restituire l'oggetto raccolto di alto valore — lo scambio non è reale.",
        "Cercare il conflitto quando LASCIA non funziona — rischio di difesa delle risorse.",
      ],
      fortschritt: [
        "LASCIA funziona con valori diversi.",
        "Ti senti pronto.",
        "Lo scambio è stabilito in modo solido.",
      ],
      exerciseIds: ["m-aus-aufbauen", "m-tausch-protokoll"],
    },
    {
      title: "Museruola nelle zone ad alto rischio",
      schwerpunkt: "Nei percorsi particolarmente difficili (bordi di parchi con rifiuti, passeggiate in città) usi la museruola. La sicurezza viene prima dei desideri.",
      wochenziele: [
        "La museruola viene indossata di routine nelle passeggiate ad alto rischio.",
        "{dogName} reagisce in modo positivo alla preparazione della museruola.",
        "Ti senti sicuro nelle situazioni difficili.",
      ],
      tagesplan: "Individua i tuoi percorsi ad alto rischio. In questi giorni prima di partire: museruola su con ricompensa Kong. Passeggiata normale, LASCIA-scambio dove possibile. Dopo la passeggiata: museruola giù, MEGA-ricompensa.",
      no_gos: [
        "Museruola alla prima passeggiata senza condizionamento positivo — frustrazione.",
        "Museruola per TUTTE le passeggiate — è uno strumento, non lo standard.",
        "Rischiare senza museruola in zone estremamente rischiose — fallimento della sicurezza.",
      ],
      fortschritt: [
        "Indossare la museruola è routine.",
        "Le passeggiate ad alto rischio sono sicure.",
        "Sei più rilassato nelle situazioni difficili.",
      ],
      exerciseIds: ["m-maulkorb-uebergang", "m-leinen-management"],
    },
    {
      title: "Strategia combinata: NO + LASCIA + scambio",
      schwerpunkt: "Questa settimana combini fluidamente tutti e tre gli strumenti: NO ai segnali di raccolta, LASCIA quando ha già raccolto, scambio come ricompensa. La sequenza diventa automatica.",
      wochenziele: [
        "Usi la sequenza in modo riflesso.",
        "{dogName} capisce il sistema.",
        "Le situazioni di raccolta si risolvono con flessibilità.",
      ],
      tagesplan: "Ad ogni passeggiata applica attivamente la sequenza: 1. NO ai segnali → se funziona, BRAVO. 2. LASCIA quando ha già raccolto → scambio. 3. In caso di alto rischio: museruola. La sequenza diventa fluida nel corso della settimana.",
      no_gos: [
        "Usare gli strumenti nell'ordine sbagliato — il NO è preventivo, il LASCIA è reattivo.",
        "Tralasciare singoli strumenti — il sistema è più della somma delle parti.",
        "Passare da uno all'altro in modo agitato — sequenza calma.",
      ],
      fortschritt: [
        "Applichi la sequenza in modo riflesso.",
        "{dogName} reagisce in modo prevedibile a ogni passo.",
        "Il comportamento di raccolta è nettamente ridotto.",
      ],
      exerciseIds: ["m-pfui-konditionieren", "m-aus-aufbauen", "m-tausch-protokoll"],
    },
    {
      title: "Consolidamento dell'aumento",
      schwerpunkt: "Ultima settimana di aumento. Tutti gli strumenti sono consolidati, la sequenza è fluida. Fase 3 = generalizzazione nella vita reale con riduzione della ricompensa.",
      wochenziele: [
        "Tutti gli strumenti funzionano fluidamente.",
        "La frequenza di raccolta è nettamente ridotta.",
        "Sei preparato per la fase 3.",
      ],
      tagesplan: "Settimana di bilancio: cosa funziona benissimo, cosa traballa? Annota gli schemi di raccolta tipici di {dogName}. Pianifica per la fase 3 la riduzione della ricompensa e nuovi percorsi.",
      no_gos: [
        "Dare i successi per scontati.",
        "Ridurre troppo in fretta la densità delle ricompense.",
        "Eliminare del tutto la museruola se ci sono ancora passeggiate ad alto rischio.",
      ],
      fortschritt: [
        "Il comportamento di raccolta è nettamente ridotto.",
        "Ti senti competente.",
        "Gli strumenti sono consolidati e fluidi.",
      ],
      exerciseIds: ["m-leinen-management", "m-belohnungs-suche"],
    },
  ],
  generalisierung: [
    {
      title: "Riduzione della ricompensa con cautela",
      schwerpunkt: "La fase 3 inizia con una riduzione prudente della densità delle ricompense. Ma: MAI eliminarla del tutto, altrimenti torna il vecchio comportamento. Il rinforzo variabile rimane.",
      wochenziele: [
        "La frequenza di ricompensa viene ridotta a circa il 50%.",
        "{dogName} reagisce agli strumenti anche con meno ricompensa.",
        "Le prestazioni eccellenti continuano a essere premiate con un MAXI-PREMIO.",
      ],
      tagesplan: "In situazioni di routine sicure: non ogni LASCIA o scambio con un premietto. In situazioni nuove o difficili: continua con la ricompensa piena. {dogName} impara: il sistema rimane, ma non ogni volta pollo.",
      no_gos: [
        "Eliminare del tutto la ricompensa — ricaduta.",
        "Riduzione nei percorsi difficili — troppo presto.",
        "Abbassare in modo radicale la densità delle ricompense — a gradi.",
      ],
      fortschritt: [
        "{dogName} reagisce anche con meno ricompensa.",
        "Metti la mano in tasca meno spesso.",
        "Il comportamento diventa più stabile senza rinforzo continuo.",
      ],
      exerciseIds: ["m-belohnungs-suche", "m-leinen-management"],
    },
    {
      title: "Percorsi diversi: generalizzazione",
      schwerpunkt: "{dogName} trasferisce la gestione della raccolta a nuovi percorsi. Nuovo ambiente = nuovi stimoli di raccolta, ma la stessa strategia.",
      wochenziele: [
        "{dogName} affronta con successo 2-3 nuovi percorsi.",
        "Le strategie funzionano attraverso percorsi diversi.",
        "Sei flessibile nella scelta della passeggiata.",
      ],
      tagesplan: "Pianifica nella settimana 3 percorsi diversi: il tuo abituale, uno nuovo nel paese vicino, uno in città. Sui nuovi percorsi: densità di ricompensa di nuovo più alta, perché ci sono nuovi stimoli. NO/LASCIA/scambio come esercitato.",
      no_gos: [
        "Sui nuovi percorsi ricompensa come su quelli abituali — troppo poco.",
        "Più percorsi nuovi al giorno — sovraccarica.",
        "Aspettarsi che ovunque funzioni esattamente come a casa.",
      ],
      fortschritt: [
        "Le strategie funzionano in contesti diversi.",
        "Ti senti flessibile.",
        "Il comportamento di raccolta è ridotto in modo generalizzato.",
      ],
      exerciseIds: ["m-aus-aufbauen", "m-pfui-konditionieren"],
    },
    {
      title: "Affrontare i punti caldi",
      schwerpunkt: "Questa settimana lavori consapevolmente sui tuoi punti caldi personali. Ingresso del veterinario? Fermata dell'autobus? Ingresso del parco? Una strategia concreta per ogni punto caldo.",
      wochenziele: [
        "Hai una strategia per ogni punto caldo principale.",
        "{dogName} affronta i punti più difficili.",
        "La frequenza di raccolta nei punti caldi si riduce in modo misurabile.",
      ],
      tagesplan: "Individua i tuoi 3 punti caldi principali. Pianifica una strategia specifica per ogni punto caldo: museruola? Guinzaglio corto + al piede? NO preventivo? Esercita questa strategia 3-4 volte nel rispettivo punto.",
      no_gos: [
        "Più punti caldi al giorno — sovraccarico cumulativo di stimoli.",
        "Evitare i punti caldi invece di lavorarci consapevolmente — perdita di un momento di esercizio.",
        "Cambiare strategia per ogni punto caldo — la coerenza è tutto.",
      ],
      fortschritt: [
        "Hai strategie chiare per ogni punto caldo.",
        "{dogName} reagisce in modo prevedibile.",
        "I punti caldi perdono il loro spavento.",
      ],
      exerciseIds: ["m-leinen-management", "m-maulkorb-uebergang"],
    },
    {
      title: "Il lavoro di naso come impegno principale",
      schwerpunkt: "La pulsione alla ricerca di {dogName} viene usata in modo intensamente produttivo: sessioni di ricerca su traccia più lunghe, giochi di ricerca più complessi, escursioni olfattive. Più soddisfazione nella ricerca = meno comportamento di raccolta casuale.",
      wochenziele: [
        "Almeno 1 sessione di lavoro di naso più lunga a passeggiata.",
        "La pulsione alla ricerca viene incanalata in modo intenso.",
        "{dogName} dopo il lavoro di naso è tranquillo e appagato.",
      ],
      tagesplan: "Ad ogni passeggiata 1 unità di ricerca più lunga (10-15 min): traccia di ricerca di 20-30m, escursione olfattiva nell'erba alta con ricompense distribuite, giochi di ricerca con difficoltà diverse.",
      no_gos: [
        "Vedere il lavoro di naso come pura distrazione — è una soddisfazione primaria.",
        "Compiti di ricerca troppo semplici — non impegnano, non stancano.",
        "Passeggiate senza un'unità di ricerca — la pulsione alla ricerca si cerca qualcos'altro.",
      ],
      fortschritt: [
        "La pulsione alla ricerca è impegnata in modo produttivo.",
        "Il comportamento di raccolta è nettamente ridotto.",
        "Le passeggiate sono appaganti.",
      ],
      exerciseIds: ["m-belohnungs-suche", "m-tausch-protokoll"],
    },
    {
      title: "Orari difficili della giornata",
      schwerpunkt: "Orari di punta, quando ci sono tanti cani in giro. Quando il rischio di raccolta è alto (parco nel weekend, città all'ora di pranzo). Questa settimana padroneggi anche queste fasi.",
      wochenziele: [
        "Affronti con calma gli orari di punta.",
        "Le strategie funzionano anche sotto sovraccarico di stimoli.",
        "Pianifichi in modo flessibile.",
      ],
      tagesplan: "1-2 volte a settimana scegli consapevolmente un orario difficile: domenica a mezzogiorno al parco, inizio scuola davanti alla scuola. Preparazione: una manciata di premietti, museruola se ad alto rischio. Ad ogni passeggiata 1-2 situazioni difficili, al max.",
      no_gos: [
        "Sopravvalutarsi e finire nella ressa più fitta.",
        "Continuare quando c'è stress — interrompi.",
        "Evitare in generale gli orari difficili — vi limita troppo.",
      ],
      fortschritt: [
        "Affronti gli orari difficili della giornata.",
        "Le strategie funzionano anche sotto pressione.",
        "Il tuo raggio di attività si allarga.",
      ],
      exerciseIds: ["m-leinen-management", "m-aus-aufbauen"],
    },
    {
      title: "Riduzione della museruola (se possibile)",
      schwerpunkt: "Se dopo diversi mesi gli strumenti sono ben consolidati, puoi togliere la museruola in certe situazioni. Ma SOLO se LASCIA e NO funzionano al 95%+.",
      wochenziele: [
        "Hai una decisione chiara: museruola quando sì, quando no.",
        "Senza museruola gli strumenti sono affidabili.",
        "La sicurezza resta il principio supremo.",
      ],
      tagesplan: "Giorno 1-3: valuta onestamente se LASCIA e NO funzionano al 95%+ sui percorsi noti. Se sì: prova senza museruola su questi percorsi noti. Se no: mantieni la routine della museruola. Sui percorsi ad alto rischio: museruola ancora.",
      no_gos: [
        "Ridurre la museruola per comodità senza una valutazione pulita.",
        "Senza museruola su percorsi nuovi o difficili — troppo rischioso.",
        "Abolire del tutto la museruola — con cani reattivi resta uno strumento.",
      ],
      fortschritt: [
        "Usi la museruola in modo mirato, non riflesso.",
        "Gli strumenti sono affidabili.",
        "La sicurezza è garantita.",
      ],
      exerciseIds: ["m-maulkorb-uebergang", "m-tausch-protokoll"],
    },
    {
      title: "Mantenimento & emergenza da sovraccarico di stimoli",
      schwerpunkt: "Routine di mantenimento per i prossimi mesi. In più: un protocollo di emergenza chiaro per il sovraccarico di stimoli (ad es. nel giorno della raccolta rifiuti) se {dogName} scivola di nuovo nel vecchio comportamento.",
      wochenziele: [
        "Il piano di mantenimento è chiaro.",
        "Il protocollo di emergenza per il sovraccarico di stimoli è stato esercitato.",
        "Ti senti in grado di agire a lungo termine.",
      ],
      tagesplan: "Piano di mantenimento: ogni 2 settimane un 'giorno di richiamo' con tutti gli strumenti. Protocollo di emergenza: in caso di sovraccarico massiccio di stimoli subito museruola, guinzaglio corto, interrompi il percorso, altra strada. Schizzo del piano su carta.",
      no_gos: [
        "Abbandonare di colpo tutte le routine.",
        "Vedere le ricadute come una 'sconfitta' — spesso bastano brevi richiami.",
        "Esercitare il protocollo di emergenza solo durante l'emergenza — prima una sequenza a secco.",
      ],
      fortschritt: [
        "Hai una chiara routine di mantenimento.",
        "Il protocollo di emergenza è consolidato.",
        "Ti senti competente a lungo termine.",
      ],
      exerciseIds: ["m-aus-aufbauen", "m-pfui-konditionieren"],
    },
    {
      title: "Passaggio alla modalità di mantenimento",
      schwerpunkt: "Ultima settimana. Il comportamento di raccolta è nettamente ridotto, gli strumenti sono consolidati, il piano di mantenimento è pronto. {dogName} è un cane diverso rispetto all'inizio del piano.",
      wochenziele: [
        "Tutte le routine funzionano in autonomia.",
        "Il ritmo di mantenimento è chiaro.",
        "{dogName} è a lungo termine più sicuro nelle situazioni di raccolta.",
      ],
      tagesplan: "Riduci l'addestramento attivo al minimo. Osserva. Pianifica ogni 4-6 settimane un richiamo con ripetizioni di LASCIA/NO/scambio. Museruola pronta per i percorsi ad alto rischio.",
      no_gos: [
        "Abbandonare di colpo le routine.",
        "Smettere di osservare — riconosci presto le piccole ricadute.",
        "Rimandare all'infinito il richiamo di mantenimento.",
      ],
      fortschritt: [
        "{dogName} è più affidabile a lungo termine.",
        "Ti senti competente.",
        "Il comportamento di raccolta è l'eccezione, non la norma.",
      ],
      exerciseIds: ["m-tausch-protokoll", "m-leinen-management"],
    },
  ],
};

// ────────────────────────────────────────────────────────────────────
// RECALL (unzuverlässiger Rückruf) — HIER laden + Schleppleine
// ────────────────────────────────────────────────────────────────────
const RECALL_WEEKS: Record<Phase, WeekTemplate[]> = {
  fundament: [
    {
      title: "QUI ricaricare con ricompense top",
      schwerpunkt: "Se QUI non è positivo al 100%, {dogName} non risponde in modo affidabile. Questa settimana ricarichi QUI (o una nuova parola VIENI-QUI) con ricompense assolutamente top.",
      wochenziele: [
        "{dogName} reagisce in casa in meno di 2 sec al VIENI-QUI.",
        "La ricompensa è di alto valore: pollo o formaggio, non crocchette.",
        "L'associazione VIENI-QUI = miglior momento della giornata è consolidata.",
      ],
      tagesplan: "In casa, 3 sessioni al giorno. Da 3m di distanza: VIENI-QUI con tono allegro e calmo. {dogName} arriva → MAXI-PREMIO di 5 pezzetti di pollo uno dopo l'altro. Poi lasciala andare di nuovo, senza pretese. Nessun aggancio del guinzaglio, nessuna associazione con la fine.",
      no_gos: [
        "Usare VIENI-QUI per cose negative (bagno, veterinario, aggancio del guinzaglio) — avvelena il segnale.",
        "Crocchette come ricompensa — valore troppo basso.",
        "Associazione con la fine della passeggiata — VIENI-QUI non pone MAI fine al divertimento.",
      ],
      fortschritt: [
        "{dogName} arriva in casa in un lampo.",
        "L'entusiasmo nel sentire il segnale è visibile.",
        "Hai gettato le basi per la Fase 2.",
        "Il fischietto è associato positivamente come secondo segnale.",
      ],
      exerciseIds: ["r-hier-laden", "r-pfeife-aufbauen"],
    },
    {
      title: "Richiamo con trattenuta: il gioco della trattenuta",
      schwerpunkt: "Gioco classico con un aiutante: qualcuno trattiene {dogName}, tu scappi via e chiami VIENI-QUI. {dogName} sprinta con grande energia. Funziona quasi sempre e aumenta enormemente la motivazione.",
      wochenziele: [
        "{dogName} sprinta verso di te al VIENI-QUI.",
        "Arriva con alta motivazione.",
        "La distanza viene aumentata a 30-50m.",
      ],
      tagesplan: "Con un aiutante (partner): {dogName} viene trattenuta, tu ti allontani di 10m restando in vista. Ti accovacci in basso, chiami allegramente VIENI-QUI + l'aiutante lascia andare. {dogName} sprinta verso di te. MAXI-PREMIO di 5-7 pezzi di pollo + elogio esuberante. Ripeti 4-6 volte per sessione.",
      no_gos: [
        "Esercitarsi senza aiutante — manca la tensione.",
        "Aumentare la distanza troppo in fretta — la sovraccarica.",
        "Rendere debole la ricompensa — la motivazione cala.",
      ],
      fortschritt: [
        "{dogName} sprinta in modo affidabile.",
        "Distanza aumentata a 30-50m.",
        "La motivazione è alta.",
      ],
      exerciseIds: ["r-restraint-recall", "r-hier-mit-ablenkung"],
    },
    {
      title: "Iniziare il lavoro con la longhina",
      schwerpunkt: "Prima di rischiare la libertà senza guinzaglio: lavoro con la longhina. Un guinzaglio lungo di 5-10m dà a {dogName} libertà di movimento, tu hai il controllo di emergenza. Un ponte tra il dentro e la libertà senza guinzaglio.",
      wochenziele: [
        "La longhina è ben regolata e utilizzabile.",
        "{dogName} ha familiarità con la longhina.",
        "Le prime passeggiate con la longhina sono consolidate.",
      ],
      tagesplan: "Investi in una longhina in biothane da 5-10m. In luoghi tranquilli senza altri cani: {dogName} può annusare per 5-10m. Ogni 5 min: VIENI-QUI. Se arriva: maxi-premio. Se non arriva: raccogli con calma il guinzaglio, senza drammi.",
      no_gos: [
        "Longhina come corda — brucia le mani, rischio di lesioni.",
        "In luoghi molto frequentati — rischio di aggrovigliamento.",
        "Usare la longhina come punizione — avvelena lo strumento.",
      ],
      fortschritt: [
        "Le passeggiate con la longhina sono ben rodate.",
        "{dogName} si sente libera ma sicura.",
        "Hai un ponte di sicurezza.",
      ],
      exerciseIds: ["r-schleppleine", "r-hier-laden"],
    },
    {
      title: "Il fischietto come segnale di riserva",
      schwerpunkt: "Un fischietto arriva a 200m+, suona sempre uguale, non può essere 'avvelenato'. Questa settimana lo condizioni come secondo segnale di richiamo — riserva per le emergenze.",
      wochenziele: [
        "{dogName} reagisce al suono del fischietto in modo affidabile.",
        "L'associazione fischietto = maxi-premio è consolidata.",
        "Hai un segnale di riserva potente.",
      ],
      tagesplan: "Compra un fischietto ACME 211.5. In casa: fischia un doppio suono chiaro, dai il maxi-premio. 5-7 ripetizioni per sessione, 2 sessioni al giorno. {dogName} associa il fischietto alla ricompensa. Non usarlo MAI per cose negative.",
      no_gos: [
        "Usare il fischietto in modo eccessivo — perde la sua magia.",
        "Fischietto per cose negative — come con VIENI-QUI si avvelena.",
        "Sperimentare con suoni di fischietto diversi — la coerenza è tutto.",
      ],
      fortschritt: [
        "{dogName} reagisce al fischietto in 2-3 sec.",
        "Hai una riserva per i problemi di voce.",
        "Il fischietto diventa una garanzia.",
      ],
      exerciseIds: ["r-pfeife-aufbauen", "r-restraint-recall"],
    },
    // 6-Monats-Vertiefungen
    {
      title: "Sicurezza e routine con la longhina",
      schwerpunkt: "Il lavoro con la longhina diventa una routine quotidiana. {dogName} si muove liberamente, ma sotto controllo. Ti eserciti nel VIENI-QUI in luoghi diversi.",
      wochenziele: [
        "Le passeggiate quotidiane con la longhina sono lo standard.",
        "{dogName} arriva in modo affidabile al richiamo.",
        "Hai coperto luoghi diversi.",
      ],
      tagesplan: "Longhina a ogni passeggiata. Provare luoghi diversi: prato, bosco, zona di margine del parco. VIENI-QUI ogni 5-10 min, maxi-premio in caso di successo. In caso di insuccesso: ritirare con calma, e all'arrivo comunque 2 premietti.",
      no_gos: [
        "In luoghi ad alto rischio (vicino alla strada) — rischio di lesioni.",
        "Tenere la longhina troppo tesa — {dogName} non si sente libera.",
        "Partire senza abbastanza ricompense.",
      ],
      fortschritt: [
        "La routine è ben rodata.",
        "{dogName} reagisce in modo affidabile.",
        "Stai accumulando esperienza con la longhina.",
      ],
      exerciseIds: ["r-schleppleine", "r-hier-laden"],
    },
    {
      title: "VIENI-QUI con mini-distrazione",
      schwerpunkt: "Prime lievi distrazioni durante il richiamo: un uccello sullo sfondo, un altro cane a 30m. {dogName} impara: VIENI-QUI funziona anche con degli stimoli.",
      wochenziele: [
        "{dogName} arriva con una lieve distrazione.",
        "Il tasso di successo è al 70-80%.",
        "Se non arriva: ritirarsi con calma, nessun dramma.",
      ],
      tagesplan: "Con la longhina in luoghi con lieve distrazione. Chiamare VIENI-QUI mentre {dogName} annusa o osserva uno stimolo. Successo: SUPER-maxi-premio. Insuccesso: guinzaglio delicatamente verso di te, all'arrivo 3 premietti.",
      no_gos: [
        "Aumentare la pressione quando il tasso di successo cala — ridurre la distrazione.",
        "Distrazione troppo grande per la Fase 1 — rispettare la soglia.",
        "Chiamare VIENI-QUI più volte — 1 volta è 1 volta.",
      ],
      fortschritt: [
        "Il tasso di successo aumenta con la distrazione.",
        "{dogName} capisce: VIENI-QUI conviene SEMPRE.",
        "Sei pronto per la Fase 2.",
      ],
      exerciseIds: ["r-hier-mit-ablenkung", "r-pfeife-aufbauen"],
    },
    {
      title: "Quando NON usare VIENI-QUI",
      schwerpunkt: "Questa settimana capisci quando NON usare VIENI-QUI: quando non sei sicuro che {dogName} arrivi. Ogni mancato arrivo indebolisce il segnale. Meglio non chiamare affatto che chiamare senza successo.",
      wochenziele: [
        "Riconosci quando VIENI-QUI è inutile.",
        "Lo usi solo con una probabilità di successo dell'80%+.",
        "Con probabilità più bassa: raccogliere delicatamente la longhina.",
      ],
      tagesplan: "Osservazione consapevole: in quali situazioni {dogName} arriva al 100%, 80%, 50%, 20%? Prendi nota. Usa VIENI-QUI solo con probabilità dell'80%+. Con probabilità bassa: non chiamare affatto, raccogliere la longhina.",
      no_gos: [
        "Chiamare VIENI-QUI mentre {dogName} caccia — avvelenamento del segnale.",
        "Chiamare più volte — indebolisce ogni volta.",
        "Arrabbiarsi se non arriva — avvelena l'associazione.",
      ],
      fortschritt: [
        "Usi VIENI-QUI in modo strategico.",
        "Il tasso di successo resta alto.",
        "Capisci la pedagogia del richiamo.",
      ],
      exerciseIds: ["r-hier-laden", "r-restraint-recall"],
    },
    {
      title: "Verifica del fondamento",
      schwerpunkt: "Ultima settimana di fondamento. VIENI-QUI in casa è a posto? Il richiamo con trattenuta funziona? La longhina è routine? Il fischietto è condizionato? Questi elementi sono indispensabili.",
      wochenziele: [
        "Tutti e 4 gli elementi sono consolidati.",
        "{dogName} conosce il sistema.",
        "Ti senti pronto per l'incremento.",
      ],
      tagesplan: "Bilancio: cosa è a posto al 90%+, cosa traballa? In caso di debolezza: aggiungi 1 settimana extra. Fase 2 = all'aperto con distrazione, il fondamento deve reggere.",
      no_gos: [
        "Saltare alla Fase 2 per impazienza.",
        "Correggere più debolezze contemporaneamente.",
        "Arrendersi perché il fondamento richiede più tempo.",
      ],
      fortschritt: [
        "Ti senti competente.",
        "Gli strumenti sono a posto.",
        "La Fase 2 è a portata di mano.",
      ],
      exerciseIds: ["r-schleppleine", "r-pfeife-aufbauen"],
    },
  ],
  steigerung: [
    {
      title: "VIENI-QUI con distrazione moderata",
      schwerpunkt: "All'aperto con la longhina, distrazioni moderate: altri cani a 30m, jogger, odore di selvaggina. {dogName} impara: VIENI-QUI conviene più di qualsiasi distrazione — se la ricompensa è all'altezza.",
      wochenziele: [
        "Tasso di successo con distrazione moderata: 80%+.",
        "La ricompensa è costantemente SUPER (pollo, formaggio).",
        "{dogName} cerca attivamente il momento del richiamo.",
      ],
      tagesplan: "In luoghi con distrazione moderata (margine del parco, percorso da jogging). Longhina 10m. VIENI-QUI 4-6 volte per passeggiata. In caso di successo: SUPER-maxi-premio di 5-7 premietti. Se non arriva: raccogliere con calma la longhina, comunque 2 premietti all'arrivo.",
      no_gos: [
        "Lesinare sulla ricompensa — la prestazione al top costa.",
        "Aspettative troppo alte — 80% è un buon valore nella Fase 2.",
        "Chiamare più volte se non arriva — 1 volta è 1 volta.",
      ],
      fortschritt: [
        "Il tasso di successo si stabilizza.",
        "{dogName} reagisce in modo prevedibile.",
        "Ti senti attrezzato.",
      ],
      exerciseIds: ["r-hier-mit-ablenkung", "r-schleppleine"],
    },
    {
      title: "Il fischietto in situazioni reali",
      schwerpunkt: "Il fischietto viene usato all'aperto in situazioni di richiamo reali. Resta il segnale di riserva, ma ora con stimoli reali. Il condizionamento deve rimanere stabile.",
      wochenziele: [
        "{dogName} reagisce al segnale del fischietto all'aperto in modo affidabile.",
        "Tasso di successo con il fischietto: 90%+ (più alto della voce).",
        "Il fischietto diventa il segnale di garanzia.",
      ],
      tagesplan: "2-3 richiami col fischietto per passeggiata. In caso di successo: MEGA-maxi-premio. In caso di insuccesso: raccogliere la longhina, nessun dramma. Usa il fischietto in modo strategico: a grande distanza o in caso di sovraccarico di stimoli.",
      no_gos: [
        "Usare il fischietto in modo eccessivo — perde la sua magia.",
        "Fischietto in situazioni ravvicinate — se funziona senza fischietto, lascialo perdere.",
        "Usare il fischietto per frustrazione con la voce — degenera.",
      ],
      fortschritt: [
        "Il fischietto è una riserva affidabile.",
        "Usi il fischietto in modo strategico, non eccessivo.",
        "{dogName} reagisce in modo prevedibile.",
      ],
      exerciseIds: ["r-pfeife-aufbauen", "r-hier-laden"],
    },
    {
      title: "Consolidare la routine con la longhina",
      schwerpunkt: "Il lavoro con la longhina diventa routine. {dogName} si muove liberamente in un raggio di 10m. Riconosci con sicurezza i punti di sovraccarico di stimoli.",
      wochenziele: [
        "Le passeggiate quotidiane con la longhina scorrono senza intoppi.",
        "{dogName} reagisce al VIENI-QUI con la longhina al 90%.",
        "Riconosci i segnali di sovraccarico di stimoli.",
      ],
      tagesplan: "Longhina a ogni passeggiata. Percorsi diversi. In caso di sovraccarico di stimoli (più cani, odore di selvaggina): mantenere la distanza, raccogliere delicatamente la longhina, accorciare la passeggiata.",
      no_gos: [
        "Passeggiate con la longhina in luoghi ad alto rischio.",
        "Tenere la longhina tesa — la libertà di movimento è lo scopo.",
        "Dimenticare la longhina — manca la riserva di sicurezza.",
      ],
      fortschritt: [
        "La routine con la longhina è lo standard.",
        "Il sovraccarico di stimoli viene riconosciuto con sicurezza.",
        "Le passeggiate sono controllate.",
      ],
      exerciseIds: ["r-schleppleine", "r-hier-mit-ablenkung"],
    },
    {
      title: "Condizionare il richiamo d'emergenza",
      schwerpunkt: "Questa settimana stabilisci il richiamo d'emergenza: una sola parola o fischio che usi SOLO in vere emergenze. Ricompensa: estrema (filetto di manzo, pezzi di petto di pollo).",
      wochenziele: [
        "{dogName} reagisce al segnale d'emergenza in modo affidabile.",
        "La ricompensa è MEGA: vero filetto di manzo o filetto di pollo.",
        "Hai una riserva d'emergenza per le vere crisi.",
      ],
      tagesplan: "Scegli una parola/suono di fischio che altrimenti non usi MAI (es. STOP-QUI). Condizionalo in casa 2 volte al giorno con MEGA-ricompensa. Trasferiscilo nella Fase 3 in vere situazioni d'emergenza.",
      no_gos: [
        "Usare il richiamo d'emergenza per richiami normali — perde la sua magia.",
        "Lesinare sulla ricompensa — con MEGA-ricompensa MEGA-reazione.",
        "Chiamare più volte in emergenza — conta la prima reazione.",
      ],
      fortschritt: [
        "Il segnale d'emergenza è condizionato.",
        "Hai fiducia nella riserva.",
        "In caso di emergenza hai una soluzione.",
      ],
      exerciseIds: ["r-emergency-recall", "r-pfeife-aufbauen"],
    },
    // 6-Monats-Vertiefungen
    {
      title: "Richiamo con distrazione più forte",
      schwerpunkt: "Distrazioni più forti: altri cani più vicini, odori intensi, acqua corrente. Il tasso di successo dovrebbe restare al 70%+. Se più basso: tornare indietro, ridurre la distrazione.",
      wochenziele: [
        "{dogName} reagisce con forte distrazione al 70-80%.",
        "Riconosci quando la distrazione è troppo grande.",
        "La frequenza delle ricompense resta alta.",
      ],
      tagesplan: "Cerca consapevolmente luoghi con distrazione più forte. Longhina. VIENI-QUI in presenza di stimoli. Osserva il tasso di successo. Sotto il 70%: ridurre la distrazione, non aumentare la pressione.",
      no_gos: [
        "Aumentare la pressione — controproducente.",
        "Ridurre la frequenza delle ricompense quando il tasso di successo cala.",
        "Lavorare con frustrazione — si trasmette.",
      ],
      fortschritt: [
        "Il tasso di successo si stabilizza.",
        "{dogName} resta concentrata anche con distrazione.",
        "Lavori con pazienza.",
      ],
      exerciseIds: ["r-hier-mit-ablenkung", "r-schleppleine"],
    },
    {
      title: "Richiamo con trattenuta all'aperto con aiutante",
      schwerpunkt: "Il classico richiamo con trattenuta ora all'aperto con un aiutante. Motivazione enorme, sprint verso di te. Funziona anche quando altri metodi zoppicano.",
      wochenziele: [
        "{dogName} sprinta all'aperto con il richiamo con trattenuta.",
        "L'assetto con l'aiutante è ben rodato.",
        "La motivazione all'aperto è alta quanto quella in casa.",
      ],
      tagesplan: "2-3 volte a settimana sessioni di trattenuta all'aperto. L'aiutante trattiene, tu corri via di 20-30m, VIENI-QUI. Sprint + MAXI-PREMIO. Variante: l'aiutante cambia, tu cambi, stesso divertimento.",
      no_gos: [
        "Esercitarsi senza aiutante — manca la tensione.",
        "Distanza troppo estrema troppo in fretta — la sovraccarica.",
        "In luoghi ad alto rischio — rischio per la sicurezza.",
      ],
      fortschritt: [
        "{dogName} sprinta in modo affidabile all'aperto.",
        "La motivazione è alta.",
        "Hai uno strumento divertente.",
      ],
      exerciseIds: ["r-restraint-recall", "r-hier-laden"],
    },
    {
      title: "Ampliare le varianti di richiamo",
      schwerpunkt: "Finora avevi 1-2 parole di richiamo. Questa settimana stabilisci delle varianti: richiamo NORMALE (quotidiano, ricompensa leggera), richiamo MAXI-PREMIO (medio-difficile, ricompensa grande), EMERGENZA (estremo, MEGA-ricompensa).",
      wochenziele: [
        "Hai 3 diversi livelli di richiamo ben chiari.",
        "{dogName} capisce i diversi segnali.",
        "Usi i livelli a seconda della situazione.",
      ],
      tagesplan: "Esercizi a secco per ogni livello: richiamo QUOTIDIANO con ricompensa normale, richiamo MAXI-PREMIO con ricompensa grande, EMERGENZA con MEGA-ricompensa. A ogni passeggiata qualcuno di ciascun livello.",
      no_gos: [
        "Mescolare i livelli — annacqua le associazioni.",
        "Usare il richiamo d'emergenza regolarmente — perde la sua magia.",
        "Confondere il livello delle ricompense.",
      ],
      fortschritt: [
        "I livelli sono chiaramente consolidati.",
        "{dogName} reagisce in modo diverso a seconda della situazione.",
        "Hai un sistema di richiamo graduato.",
      ],
      exerciseIds: ["r-schleppleine", "r-emergency-recall"],
    },
    {
      title: "Consolidamento dell'incremento",
      schwerpunkt: "Ultima settimana di incremento. Tutti gli strumenti di richiamo sono a posto, la longhina è routine, il segnale d'emergenza è condizionato. Fase 3 = prima libertà senza guinzaglio, controllata.",
      wochenziele: [
        "Tutti gli strumenti sono a posto all'80%+.",
        "Sei pronto per la prima libertà senza guinzaglio.",
        "Le riserve di sicurezza sono consolidate.",
      ],
      tagesplan: "Settimana di bilancio: cosa funziona all'80%+? Longhina? Fischietto? Trattenuta? Emergenza? In caso di debolezza: aggiungi 1 settimana extra. Fase 3 = più rischiosa, il fondamento deve reggere.",
      no_gos: [
        "Saltare alla libertà senza guinzaglio per impazienza.",
        "Ignorare più debolezze.",
        "Considerare le riserve di sicurezza come 'superflue'.",
      ],
      fortschritt: [
        "Ti senti ben preparato.",
        "{dogName} conosce il sistema.",
        "Gli strumenti sono a posto.",
      ],
      exerciseIds: ["r-hier-mit-ablenkung", "r-pfeife-aufbauen"],
    },
  ],
  generalisierung: [
    {
      title: "Prima libertà senza guinzaglio controllata",
      schwerpunkt: "La Fase 3 inizia con la prima vera libertà senza guinzaglio — ma controllata. Zona sicura (recintata o sicura per la topografia), la longhina cade ma resta attaccata alla pettorina.",
      wochenziele: [
        "Prima libertà senza guinzaglio riuscita (10-15 min).",
        "{dogName} reagisce al VIENI-QUI in libertà senza guinzaglio.",
        "Hai stabilito un assetto di sicurezza.",
      ],
      tagesplan: "Scegli la zona più sicura (prato per cani recintato, radura nel bosco lontana dalla strada). La longhina resta attaccata alla pettorina, ma 5-10m di gioco sono consentiti. VIENI-QUI ogni 5 min. Con richiamo affidabile: continuare.",
      no_gos: [
        "Libertà senza guinzaglio in luoghi ad alto rischio — pericolo di escalation.",
        "Togliere del tutto la longhina — perdita di sicurezza.",
        "Libertà senza guinzaglio per più di 15-20 min — rischio di sovraccarico di stimoli.",
      ],
      fortschritt: [
        "La prima libertà senza guinzaglio è riuscita.",
        "{dogName} resta a portata.",
        "Ti senti (con cautela) più fiducioso.",
        "Il segnale d'emergenza è condizionato ed è pronto per le vere crisi.",
      ],
      exerciseIds: ["r-freilauf-erste", "r-emergency-recall"],
    },
    {
      title: "Stabilire una routine di libertà senza guinzaglio",
      schwerpunkt: "La libertà senza guinzaglio diventa routine — su 2-3 percorsi sicuri. La longhina diventa un'assicurazione, ma resta attaccata. {dogName} impara la sicurezza in libertà senza guinzaglio.",
      wochenziele: [
        "2-3 percorsi sicuri per la libertà senza guinzaglio sono consolidati.",
        "Le passeggiate in libertà senza guinzaglio scorrono con routine.",
        "{dogName} arriva al VIENI-QUI all'85%+.",
      ],
      tagesplan: "3-4 passeggiate in libertà senza guinzaglio a settimana su percorsi sicuri. La longhina resta attaccata alla pettorina. VIENI-QUI regolarmente. Se non arriva: raccogliere la longhina, allentarla di nuovo più tardi.",
      no_gos: [
        "Libertà senza guinzaglio su percorsi sconosciuti — troppo rischioso.",
        "Dimenticare la longhina — riserva di sicurezza.",
        "Libertà senza guinzaglio quando {dogName} è tesa o si distrae.",
      ],
      fortschritt: [
        "La routine di libertà senza guinzaglio è ben rodata.",
        "{dogName} reagisce in modo affidabile.",
        "Le passeggiate sono appaganti.",
      ],
      exerciseIds: ["r-schleppleine", "r-hier-laden"],
    },
    {
      title: "Allenamento di mantenimento in libertà senza guinzaglio",
      schwerpunkt: "Anche se la libertà senza guinzaglio funziona: VIENI-QUI resta allenato attivamente. Altrimenti il segnale si arrugginisce. 2-3 volte per passeggiata VIENI-QUI con maxi-premio. {dogName} resta motivata.",
      wochenziele: [
        "VIENI-QUI viene mantenuto attivamente in libertà senza guinzaglio.",
        "La densità delle ricompense resta accettabile.",
        "{dogName} non perde la motivazione al richiamo.",
      ],
      tagesplan: "3-4 momenti di VIENI-QUI per passeggiata, ognuno con maxi-premio. Variante: richiamo con trattenuta con aiutante una volta a settimana. Fischietto ogni 2 settimane con MEGA-ricompensa.",
      no_gos: [
        "Lasciar trascurare VIENI-QUI — il segnale sbiadisce.",
        "Lesinare sulla ricompensa — la motivazione cala.",
        "Usare il fischietto in modo eccessivo.",
      ],
      fortschritt: [
        "VIENI-QUI resta affidabile.",
        "{dogName} resta motivata.",
        "Mantieni il sistema attivamente.",
      ],
      exerciseIds: ["r-hier-mit-ablenkung", "r-restraint-recall"],
    },
    {
      title: "Riduzione delle ricompense con cautela",
      schwerpunkt: "Dopo che il richiamo è ben consolidato, riduci lentamente la densità delle ricompense per i richiami normali. Ma: nelle situazioni preziose (vere emergenze) sempre MAXI-PREMIO.",
      wochenziele: [
        "La frequenza delle ricompense viene ridotta a ~50-60%.",
        "Le prestazioni al top continuano a essere ricompensate con maxi-premio.",
        "{dogName} reagisce anche con meno ricompensa.",
      ],
      tagesplan: "Nelle situazioni di richiamo facili: non pollo ogni volta. In quelle difficili (forte distrazione, lunga distanza): maxi-premio. {dogName} nota la differenza, ma cerca comunque il momento del richiamo.",
      no_gos: [
        "Eliminare del tutto la ricompensa — rischio di regressione.",
        "Riduzione su percorsi difficili — troppo presto.",
        "Confusione sul livello delle ricompense.",
      ],
      fortschritt: [
        "{dogName} reagisce anche con meno ricompensa.",
        "Il richiamo è stabilizzato.",
        "Metti la mano in tasca meno spesso.",
      ],
      exerciseIds: ["r-hier-laden", "r-schleppleine"],
    },
    {
      title: "Padroneggiare situazioni difficili",
      schwerpunkt: "Questa settimana pianifica consapevolmente situazioni difficili: altri cani vicini, odori intensi, percorsi che cambiano. {dogName} si mette alla prova oppure tu aggiusti il tiro.",
      wochenziele: [
        "{dogName} gestisce 3 situazioni difficili.",
        "Riconosci dove la longhina serve di nuovo.",
        "Il tasso di successo resta al 70%+.",
      ],
      tagesplan: "Pianifica consapevolmente incontri con altri cani, odore di selvaggina, percorsi che cambiano. VIENI-QUI in presenza di stimoli. In caso di successo: SUPER-maxi-premio. In caso di insuccesso: longhina di nuovo, riprovare più tardi.",
      no_gos: [
        "Più situazioni difficili nello stesso giorno — si accumulano.",
        "Proseguire quando il tasso di successo cala — pausa.",
        "Aspettative troppo alte — 70% è buono nella Fase 3.",
      ],
      fortschritt: [
        "{dogName} gestisce situazioni difficili.",
        "Riconosci i limiti con sicurezza.",
        "Il richiamo è robusto.",
      ],
      exerciseIds: ["r-hier-mit-ablenkung", "r-pfeife-aufbauen"],
    },
    {
      title: "Il richiamo d'emergenza nella pratica",
      schwerpunkt: "Questa settimana testi il richiamo d'emergenza in 1-2 vere situazioni a rischio (es. {dogName} corre nella direzione sbagliata). La MEGA-ricompensa deve arrivare.",
      wochenziele: [
        "Il richiamo d'emergenza viene usato con successo in 1-2 situazioni reali.",
        "La MEGA-ricompensa viene data in modo coerente.",
        "Ti senti preparato per le vere emergenze.",
      ],
      tagesplan: "In 'quasi-emergenze' controllate (es. {dogName} annusa qualcosa di interessante, tu chiami il segnale d'emergenza): SUBITO MEGA-ricompensa all'arrivo. Mai 'a scopo di test' o senza ricompensa — altrimenti avvelena la magia.",
      no_gos: [
        "Testare il richiamo d'emergenza senza MEGA-ricompensa — avvelena l'associazione.",
        "Usare il segnale d'emergenza regolarmente — perde il suo potere.",
        "Andare nel panico in una vera emergenza — portare avanti la routine.",
      ],
      fortschritt: [
        "Il richiamo d'emergenza è testato e funziona.",
        "Hai fiducia nella riserva.",
        "Le vere emergenze sono gestibili.",
      ],
      exerciseIds: ["r-emergency-recall", "r-restraint-recall"],
    },
    {
      title: "Passeggiate di richiamo senza longhina",
      schwerpunkt: "Quando il richiamo è ben consolidato (90%+ di successo su percorsi noti), puoi lasciar perdere la longhina in contesti specifici. Ma: SOLO su percorsi sicuri, SOLO con buona concentrazione.",
      wochenziele: [
        "Hai identificato percorsi dove è sicuro andare senza longhina.",
        "{dogName} reagisce lì al 95%+.",
        "La sicurezza resta il principio supremo.",
      ],
      tagesplan: "Valuta onestamente per ogni percorso: richiamo sicuro al 95%? Stimoli ad alto rischio improbabili? Se sì: testare senza longhina. In ogni situazione a vista libera: VIENI-QUI + maxi-premio. In caso di dubbio: longhina di nuovo.",
      no_gos: [
        "Senza longhina su percorsi sconosciuti.",
        "Senza longhina quando altri cani sono vicini.",
        "Senza longhina quando {dogName} è iperattiva.",
      ],
      fortschritt: [
        "Usi la longhina in modo strategico.",
        "{dogName} reagisce in modo affidabile.",
        "Le passeggiate sono più libere e appaganti.",
      ],
      exerciseIds: ["r-freilauf-erste", "r-hier-laden"],
    },
    {
      title: "Passaggio alla modalità di mantenimento",
      schwerpunkt: "Ultima settimana. Il richiamo è affidabile, la longhina viene usata in modo mirato, la riserva d'emergenza è a posto. {dogName} è un cane decisamente più affidabile rispetto all'inizio del piano.",
      wochenziele: [
        "Tutti gli strumenti di richiamo funzionano con routine.",
        "Il piano di mantenimento è a posto.",
        "Ti senti preparato a lungo termine.",
      ],
      tagesplan: "Pianifica la modalità di mantenimento: ogni 2 settimane un richiamo con trattenuta con MEGA-ricompensa. Ogni 4 settimane un test di richiamo d'emergenza (in un contesto controllato). Fischietto ogni 2 settimane con MEGA-ricompensa. La routine resta.",
      no_gos: [
        "Abbandonare di colpo tutte le routine — il richiamo sbiadisce.",
        "Dimenticare il fischietto o il richiamo d'emergenza — gli strumenti hanno bisogno di manutenzione.",
        "Dimenticare la longhina — riserva di sicurezza per le emergenze.",
      ],
      fortschritt: [
        "Il richiamo è affidabile a lungo termine.",
        "Ti senti competente.",
        "{dogName} è più sicura in libertà senza guinzaglio.",
      ],
      exerciseIds: ["r-restraint-recall", "r-emergency-recall"],
    },
  ],
};

// ────────────────────────────────────────────────────────────────────
// BARKING (übermäßiges Bellen) — Auslöser entkoppeln + Ruhe belohnen
// ────────────────────────────────────────────────────────────────────
const BARKING_WEEKS: Record<Phase, WeekTemplate[]> = {
  fundament: [
    {
      title: "Diario dei fattori scatenanti: cosa provoca l'abbaio?",
      schwerpunkt: "Prima di allenare, ti servono dei dati. Per una settimana documenti QUANDO, DOVE e VERSO COSA abbaia {dogName}. Solo così riconosci gli schemi e puoi lavorare in modo mirato.",
      wochenziele: [
        "Hai una lista dei 3 principali fattori scatenanti dell'abbaio.",
        "Conosci gli orari tipici dell'abbaio nell'arco della giornata.",
        "Capisci la tua stessa reazione e se rinforza il comportamento.",
      ],
      tagesplan: "Tieni con te un taccuino. A ogni episodio di abbaio: ora, luogo, fattore scatenante, durata + la tua reazione. Alla fine della settimana vedi gli schemi: campanello? Cane che passa? Frustrazione? Attenzione? Per ogni fattore scatenante una strategia dedicata dalla settimana 2.",
      no_gos: [
        "Allenare gia senza sapere COSA stai affrontando.",
        "Sgridare mentre documenti: rovina i dati.",
        "Minimizzare i fattori scatenanti ('e semplicemente il suo carattere'): senza analisi nessuna soluzione.",
      ],
      fortschritt: [
        "Hai una lista chiara dei fattori scatenanti.",
        "Riconosci il tuo stesso ruolo nel comportamento.",
        "Sei pronto per un allenamento mirato.",
        "Le prime fasi di silenzio vengono premiate 8-10 volte al giorno, il silenzio viene rinforzato.",
      ],
      exerciseIds: ["b-trigger-tagebuch", "b-ruhe-marker"],
    },
    {
      title: "Stabilire il marcatore SILENZIO",
      schwerpunkt: "Invece di punire l'abbaio, premi il silenzio. Ogni fase di silenzio riceve un sommesso marcatore BRAVO e un premietto. {dogName} impara: stare in silenzio conviene.",
      wochenziele: [
        "8-10 ricompense per il silenzio al giorno.",
        "{dogName} si accorge: stare tranquillo porta qualcosa.",
        "Tu stesso non reagisci piu all'abbaio alzando la voce.",
      ],
      tagesplan: "Osserva attivamente. Appena ci sono 5 sec di silenzio: sommesso BRAVO + premietto. Prima 5 sec, poi 10, 20, 30, 1 min. La ricompensa arriva SOMMESSA e CALMA. Durante l'abbaio: non gridare, non guardare, resta neutrale.",
      no_gos: [
        "Gridare un forte 'Basta!' o 'Zitto!': e attenzione data all'abbaio.",
        "Avvicinarsi quando {dogName} abbaia: lo rinforza.",
        "Dare la ricompensa con eccitazione: vogliamo associare la calma.",
      ],
      fortschritt: [
        "Le ricompense per il silenzio diventano routine.",
        "{dogName} cerca attivamente le fasi di silenzio.",
        "La frequenza dell'abbaio si riduce in modo evidente.",
      ],
      exerciseIds: ["b-tuerklingel-decke", "b-tuerklingel-decke"],
    },
    {
      title: "Campanello della porta = routine sulla coperta",
      schwerpunkt: "Se l'abbaio al campanello e un tema, stabiliamo un'alternativa concreta: al campanello {dogName} non corre alla porta, ma sulla coperta. Un classico pavloviano.",
      wochenziele: [
        "{dogName} reagisce alla registrazione del campanello muovendosi verso la coperta.",
        "Il volume del campanello puo essere aumentato senza escalation.",
        "L'associazione campanello-coperta e consolidata.",
      ],
      tagesplan: "Registrazione del campanello a basso volume dal telefono, subito TERRA + coperta + premietto. 10 ripetizioni per sessione, 2 sessioni al giorno. Aumenta il volume nel corso della settimana. Test con il campanello reale in fase 2 con un aiutante.",
      no_gos: [
        "Test con il campanello reale senza lavoro preparatorio: troppo difficile.",
        "Coperta senza il precedente esercizio della coperta di rilassamento: la coperta deve avere una connotazione positiva.",
        "Durante l'abbaio: gridare: controproducente.",
      ],
      fortschritt: [
        "{dogName} collega il campanello alla coperta + ricompensa.",
        "Il movimento verso la coperta diventa automatico.",
        "Sei pronto per la situazione reale del campanello.",
      ],
      exerciseIds: ["b-trigger-tagebuch", "b-ruhe-marker"],
    },
    {
      title: "Costruire la tolleranza alla frustrazione",
      schwerpunkt: "Se {dogName} abbaia per frustrazione (uno scoiattolo irraggiungibile): costruiamo la tolleranza alla frustrazione. Il segnale ASPETTA con cibo e giochi e lo strumento.",
      wochenziele: [
        "{dogName} mantiene 10 sec di ASPETTA davanti al cibo.",
        "I segnali di frustrazione diventano piu rari.",
        "Usi ASPETTA nelle mini-situazioni quotidiane di frustrazione.",
      ],
      tagesplan: "3-4 situazioni di ASPETTA al giorno: davanti al cibo, al gioco, alla porta. Aumenta da 1 sec a 10 sec nel corso della settimana. Se abbaia durante ASPETTA: ritira la mano, non concedere. Solo dopo 3 sec di silenzio: rilascio.",
      no_gos: [
        "Concedere durante l'abbaio: rinforza l'abbaio da frustrazione.",
        "Allungare i tempi di attesa troppo in fretta: la frustrazione degenera.",
        "Alzare la voce: rinforza l'eccitazione.",
      ],
      fortschritt: [
        "{dogName} resta calmo durante brevi tempi di attesa.",
        "L'abbaio da frustrazione si riduce.",
        "Hai uno strumento per le mini-situazioni di frustrazione.",
      ],
      exerciseIds: ["b-frust-management", "b-tuerklingel-decke"],
    },
    // 6-Monats-Vertiefungen
    {
      title: "Controcondizionamento verso gli stimoli esterni",
      schwerpunkt: "Se gli stimoli esterni (un cane che passa, il postino) scatenano l'abbaio: controcondizionamento. Comparsa dello stimolo = arriva il premietto. Ribalta l'associazione emotiva.",
      wochenziele: [
        "{dogName} ti guarda in presenza di stimoli esterni.",
        "La reazione di abbaio agli stimoli si riduce.",
        "L'associazione emotiva cambia.",
      ],
      tagesplan: "Nella tipica posizione dell'abbaio (finestra, giardino). Appena compare lo stimolo PRIMA dell'abbaio: GUARDA + premietto in continuo finche lo stimolo e visibile. Stimolo via: premietto via. Se {dogName} abbaia gia: troppo tardi, aumenta la distanza.",
      no_gos: [
        "Premiare solo quando {dogName} abbaia gia: associazione sbagliata.",
        "Provocare gli stimoli: controproducente.",
        "Lesinare sulla ricompensa: una prestazione eccellente ha un costo.",
      ],
      fortschritt: [
        "{dogName} reagisce agli stimoli rivolgendoti l'attenzione.",
        "L'abbaio si riduce in modo evidente.",
        "L'associazione emotiva diventa positiva.",
      ],
      exerciseIds: ["b-counter-cond-aussen", "b-ruhe-marker"],
    },
    {
      title: "Estinguere l'abbaio per attirare l'attenzione",
      schwerpunkt: "Se {dogName} ti abbaia per ottenere qualcosa: ignora con coerenza. Estinzione nell'arco di 2-3 settimane. Richiede una coerenza di ferro da parte di tutti i membri della famiglia.",
      wochenziele: [
        "Di fronte all'abbaio per attirare l'attenzione gli volti costantemente le spalle.",
        "I membri della famiglia collaborano.",
        "L'abbaio per attirare l'attenzione si riduce dopo il picco di rinforzo.",
      ],
      tagesplan: "Di fronte all'abbaio per attirare l'attenzione volta subito le spalle, esci dalla stanza se possibile. Torna quando e tranquillo da 30 sec. Aspettati un picco di rinforzo nei giorni 3-7: l'abbaio all'inizio si intensifica, poi scompare. Resisti.",
      no_gos: [
        "Cedere durante il picco di rinforzo: sabota completamente il lavoro.",
        "Membri della famiglia che non collaborano: 1 incoerenza = 1 settimana indietro.",
        "Sgridare durante l'abbaio: e comunque attenzione.",
      ],
      fortschritt: [
        "L'abbaio per attirare l'attenzione si riduce in modo misurabile.",
        "{dogName} cerca altre vie per l'attenzione (avvicinarsi in silenzio).",
        "Diventi interiormente piu rilassato.",
      ],
      exerciseIds: ["b-aufmerksamkeits-bellen", "b-trigger-tagebuch"],
    },
    {
      title: "Ridurre gradualmente la distanza dal fattore scatenante",
      schwerpunkt: "Nell'abbaio provocato da stimoli riduci lentamente la distanza dal fattore scatenante. 50m -> 40m -> 30m. {dogName} resta sotto la soglia, impara a tollerare gli stimoli.",
      wochenziele: [
        "La distanza dal fattore scatenante si riduce di 5-10m.",
        "{dogName} resta sotto la soglia.",
        "Lavori con pazienza e in modo sistematico.",
      ],
      tagesplan: "Sessioni consapevoli alle fonti degli stimoli con una distanza controllabile. Controcondizionamento a ogni stimolo. Riduci la distanza solo quando {dogName} e stabile per piu giorni. Non ridurre mai in modo radicale in un solo giorno.",
      no_gos: [
        "Ridurre la distanza troppo in fretta: escalation.",
        "Aumentare la pressione nelle giornate storte.",
        "Ignorare la soglia quando cambia.",
      ],
      fortschritt: [
        "La soglia si riduce in modo misurabile.",
        "{dogName} tollera meglio gli stimoli.",
        "Lavori in modo sistematico.",
      ],
      exerciseIds: ["b-counter-cond-aussen", "b-ruhe-marker"],
    },
    {
      title: "Verifica delle fondamenta",
      schwerpunkt: "Ultima settimana di fondamenta. Diario dei fattori scatenanti analizzato, marcatore SILENZIO stabilito, campanello-coperta consolidato, tolleranza alla frustrazione costruita. Fase 2 = applicazione reale.",
      wochenziele: [
        "Tutti i mattoni sono a posto.",
        "La frequenza dell'abbaio e ridotta in modo misurabile.",
        "Sei preparato per la fase 2.",
      ],
      tagesplan: "Bilancio: cosa e a posto, cosa traballa? Se c'e una debolezza: aggiungi 1 settimana extra. Con l'abbaio per attirare l'attenzione resta particolarmente coerente.",
      no_gos: [
        "Passare alla fase 2 per impazienza.",
        "Ignorare piu debolezze insieme.",
        "Abbandonare il piano perche 1 settimana e andata storta.",
      ],
      fortschritt: [
        "Ti senti competente.",
        "Gli strumenti sono a posto.",
        "La fase 2 e a portata di mano.",
      ],
      exerciseIds: ["b-trigger-tagebuch", "b-tuerklingel-decke"],
    },
  ],
  steigerung: [
    {
      title: "Test reali con il campanello e un aiutante",
      schwerpunkt: "Ora osiamo test reali con il campanello. L'aiutante suona da fuori, {dogName} deve correre sulla coperta. Coerenza per 2-3 settimane, finche diventa lo standard.",
      wochenziele: [
        "{dogName} corre sulla coperta al campanello reale.",
        "Il comportamento e stabile anche con un ospite reale.",
        "La porta puo essere aperta, il cane resta sdraiato.",
      ],
      tagesplan: "Prima: l'aiutante viene in visita, coperta preparata. Campanello: guida {dogName} sulla coperta (o va da solo). Apri la porta, fai entrare l'ospite, ignora {dogName}. Se resta sulla coperta: premietto ogni 30 sec. Dopo 5 min: segnale OK.",
      no_gos: [
        "Test reali con il campanello senza un pulito lavoro preparatorio in casa: frustrazione.",
        "L'ospite accarezza durante l'abbaio: sabota.",
        "Correre d'istinto alla porta durante l'abbaio: lo rinforza.",
      ],
      fortschritt: [
        "{dogName} affronta il campanello reale in modo piu calmo.",
        "L'accoglienza degli ospiti diventa una routine.",
        "Ti senti preparato.",
        "In presenza di stimoli esterni {dogName} ti guarda piu spesso invece di abbaiare subito.",
      ],
      exerciseIds: ["b-läuten-routine", "b-counter-cond-aussen"],
    },
    {
      title: "Lavorare attivamente sugli stimoli esterni",
      schwerpunkt: "Con cane-che-passa, postino, rumori esterni: applica attivamente il controcondizionamento. Alta densita di ricompense, cambia l'associazione.",
      wochenziele: [
        "La reazione di abbaio agli stimoli esterni si riduce del 50%+.",
        "{dogName} ti guarda da solo in presenza di stimoli.",
        "La densita di ricompense e alta.",
      ],
      tagesplan: "Lavora attivamente alla finestra o in giardino. Se vedi lo stimolo prima di {dogName}: GUARDA + premietto in continuo. Se {dogName} abbaia gia: crea distanza (altra stanza), non insistere.",
      no_gos: [
        "Continuare quando c'e stress.",
        "Ridurre la densita di ricompense.",
        "Lavorare troppo vicino allo stimolo.",
      ],
      fortschritt: [
        "La reazione agli stimoli si riduce in modo misurabile.",
        "{dogName} cerca attivamente il contatto visivo.",
        "Ti senti piu capace di agire.",
      ],
      exerciseIds: ["b-trigger-tagebuch", "b-ruhe-marker"],
    },
    {
      title: "Estinguere l'abbaio per attirare l'attenzione",
      schwerpunkt: "Estinzione coerente nell'arco di 2-3 settimane. Voltare le spalle, ignorare, non cedere. Chi qui e incoerente sabota tutto il lavoro.",
      wochenziele: [
        "L'abbaio per attirare l'attenzione si riduce del 70%+.",
        "La coerenza familiare regge.",
        "Diventi interiormente piu calmo e piu coerente.",
      ],
      tagesplan: "Ignora con coerenza ogni tentativo di abbaio per attirare l'attenzione. Volta le spalle, esci dalla stanza. Torna dopo 30 sec di silenzio. Con i membri della famiglia: concordate una regola comune e coerente.",
      no_gos: [
        "Incoerenza: sabota il lavoro.",
        "Cedere durante il picco di rinforzo: perfeziona l'abbaio.",
        "Sgridare: anche l'attenzione e una ricompensa.",
      ],
      fortschritt: [
        "L'abbaio per attirare l'attenzione si riduce in modo misurabile.",
        "Diventi piu coerente.",
        "La coerenza familiare regge.",
      ],
      exerciseIds: ["b-aufmerksamkeits-bellen", "b-tuerklingel-decke"],
    },
    {
      title: "Ridurre l'abbaio da frustrazione",
      schwerpunkt: "Il segnale ASPETTA viene usato in piu situazioni. La tolleranza alla frustrazione cresce, l'abbaio da frustrazione si riduce. Un lavoro paziente.",
      wochenziele: [
        "{dogName} mantiene 30 sec di ASPETTA in diverse situazioni.",
        "L'abbaio da frustrazione si riduce in modo evidente.",
        "Usi ASPETTA in modo intuitivo.",
      ],
      tagesplan: "5-7 situazioni di ASPETTA al giorno. Aumenta da 10 a 30 sec. Se abbaia durante ASPETTA: non concedere. Solo dopo 3 sec di silenzio: rilascio + ricompensa.",
      no_gos: [
        "Concedere durante l'abbaio.",
        "Aumentare i tempi di attesa in modo radicale.",
        "Alzare la voce durante l'abbaio da frustrazione.",
      ],
      fortschritt: [
        "La tolleranza alla frustrazione cresce.",
        "L'abbaio da frustrazione si riduce.",
        "{dogName} resta calmo piu a lungo nelle situazioni di attesa.",
      ],
      exerciseIds: ["b-frust-management", "b-ruhe-marker"],
    },
    // 6-Monats-Vertiefungen
    {
      title: "Variabilita nei fattori scatenanti",
      schwerpunkt: "Finora hai lavorato sui singoli fattori scatenanti. Questa settimana li combini: campanello + stimoli esterni + attenzione. La strategia resta coerente, i fattori scatenanti cambiano.",
      wochenziele: [
        "Applichi la strategia giusta per ciascun fattore scatenante.",
        "L'abbaio si riduce trasversalmente ai fattori scatenanti.",
        "Ti senti preparato a situazioni diverse.",
      ],
      tagesplan: "Per ogni passeggiata/giornata affronta consapevolmente fattori scatenanti diversi. Campanello: coperta. Cane che passa: controcondizionamento. Frustrazione: ASPETTA. Attenzione: ignorare. Coerenza trasversale.",
      no_gos: [
        "Cambiare strategia a seconda del fattore scatenante: la coerenza e importante.",
        "Accumulare piu fattori scatenanti insieme: sovraccarica.",
        "Insistere quando c'e stress.",
      ],
      fortschritt: [
        "Le strategie sono generalizzate.",
        "Reagisci in modo corretto secondo la situazione.",
        "La frequenza dell'abbaio si riduce trasversalmente.",
      ],
      exerciseIds: ["b-counter-cond-aussen", "b-trigger-tagebuch"],
    },
    {
      title: "Abbaio da stress vs. abbaio da bisogno",
      schwerpunkt: "Impara a distinguere: {dogName} abbaia per stress (paura, sovraccarico) o per bisogno (attenzione, frustrazione)? Entrambi richiedono strategie diverse.",
      wochenziele: [
        "Distingui con sicurezza tra abbaio da stress e da bisogno.",
        "Per ogni tipo applichi la strategia giusta.",
        "Lo stato emotivo di {dogName} viene letto meglio.",
      ],
      tagesplan: "Osserva attivamente: {dogName} abbaia con mimica tesa, coda alta, labbra sollevate (stress)? Oppure e rilassata, ti guarda, scodinzola (bisogno)? Stress: crea distanza, tranquillizza. Bisogno: ignora.",
      no_gos: [
        "Trattare entrambi i tipi allo stesso modo: reazione sbagliata.",
        "Ignorare l'abbaio da stress: puo degenerare.",
        "'Tranquillizzare' l'abbaio da bisogno: lo rinforza.",
      ],
      fortschritt: [
        "Leggi con sicurezza lo stato emotivo di {dogName}.",
        "Le reazioni diventano corrette secondo la situazione.",
        "L'abbaio si riduce trasversalmente.",
      ],
      exerciseIds: ["b-ruhe-marker", "b-tuerklingel-decke"],
    },
    {
      title: "Ridurre le ricompense con cautela",
      schwerpunkt: "Quando il marcatore SILENZIO e il controcondizionamento sono consolidati, riduci lentamente la densita di ricompense. Ma: non eliminarle del tutto. Il rinforzo variabile mantiene il comportamento piu stabile.",
      wochenziele: [
        "La frequenza delle ricompense viene ridotta a circa il 50%.",
        "{dogName} reagisce anche con meno ricompense.",
        "Le prestazioni eccellenti vengono ancora premiate con un MAXI-PREMIO.",
      ],
      tagesplan: "Nelle situazioni facili: non premiare ogni silenzio. In quelle difficili (fattori scatenanti): ricompensa piena. {dogName} si accorge: il sistema resta, ma imprevedibile.",
      no_gos: [
        "Eliminare del tutto la ricompensa: ricaduta.",
        "Ridurre nei tratti difficili.",
        "Cambiamento radicale.",
      ],
      fortschritt: [
        "Il comportamento diventa piu stabile senza ricompensa continua.",
        "Metti in tasca meno premietti.",
        "La frequenza dell'abbaio resta bassa.",
      ],
      exerciseIds: ["b-trigger-tagebuch", "b-tuerklingel-decke"],
    },
    {
      title: "Consolidamento dell'intensificazione",
      schwerpunkt: "Ultima settimana di intensificazione. Tutti gli strumenti sono a posto, i fattori scatenanti vengono gestiti con flessibilita. Fase 3 = applicazione a lungo termine e stabilizzazione.",
      wochenziele: [
        "Tutti gli strumenti funzionano in modo fluido.",
        "La frequenza dell'abbaio e nettamente ridotta.",
        "Sei preparato per la fase 3.",
      ],
      tagesplan: "Settimana di bilancio: cosa funziona alla grande, cosa traballa? Annota i fattori scatenanti residui di {dogName}. Pianifica per la fase 3 una routine di mantenimento.",
      no_gos: [
        "Dare i successi per scontati.",
        "Ridurre in modo radicale la densita di ricompense.",
        "Allentare la coerenza familiare.",
      ],
      fortschritt: [
        "L'abbaio e ridotto in modo misurabile.",
        "Ti senti competente.",
        "Gli strumenti funzionano in modo fluido.",
      ],
      exerciseIds: ["b-counter-cond-aussen", "b-aufmerksamkeits-bellen"],
    },
  ],
  generalisierung: [
    {
      title: "Situazioni reali quotidiane con i fattori scatenanti",
      schwerpunkt: "Fase 3 = applicazione nella vita quotidiana normale. Campanello, stimoli esterni, frustrazione, attenzione: tutti i fattori scatenanti nell'arco della giornata normale. Le strategie sono a posto e flessibili.",
      wochenziele: [
        "I fattori scatenanti nel quotidiano vengono gestiti con flessibilita.",
        "{dogName} reagisce in modo prevedibile alle strategie.",
        "Ti senti competente nella gestione dell'abbaio.",
      ],
      tagesplan: "Affronta attivamente ogni situazione scatenante nel quotidiano con la strategia giusta. Osserva cosa funziona. Ripasso all'occorrenza. Mantieni alta la coerenza familiare.",
      no_gos: [
        "Allentare la coerenza quotidiana.",
        "Evitare le situazioni difficili: cosi non alleni.",
        "Lasciare che lo stress ti raggiunga: si trasmette.",
      ],
      fortschritt: [
        "Il quotidiano scorre in modo piu routinario.",
        "L'abbaio e l'eccezione.",
        "Diventi interiormente piu calmo.",
      ],
      exerciseIds: ["b-läuten-routine", "b-ruhe-marker"],
    },
    {
      title: "Padroneggiare i momenti difficili della giornata",
      schwerpunkt: "Ora di punta con tanti cani che passano, weekend con tanti campanelli, momenti di stress. Questa settimana {dogName} affronta anche le fasi dense di fattori scatenanti.",
      wochenziele: [
        "{dogName} affronta i momenti difficili della giornata.",
        "L'effetto accumulo dei fattori scatenanti viene evitato.",
        "Pianifichi con flessibilita.",
      ],
      tagesplan: "Pianifica consapevolmente 1-2 sessioni nei momenti difficili della giornata. Prima un'attivita fisica, poi la situazione scatenante mirata, e poi il defaticamento. Densita di ricompense piu alta in queste fasi.",
      no_gos: [
        "Piu fasi difficili al giorno.",
        "Continuare quando c'e stress.",
        "Saltare l'attivita fisica prima di una fase difficile.",
      ],
      fortschritt: [
        "Le fasi difficili vengono affrontate.",
        "Pianifichi in modo strutturato.",
        "L'abbaio resta sotto controllo.",
      ],
      exerciseIds: ["b-counter-cond-aussen", "b-trigger-tagebuch"],
    },
    {
      title: "Rendere routinaria l'accoglienza degli ospiti",
      schwerpunkt: "Quando la routine sulla coperta al campanello e consolidata, stabiliamo tutta l'accoglienza degli ospiti come una sequenza fissa. Campanello -> coperta -> porta -> saluto a determinate condizioni.",
      wochenziele: [
        "L'accoglienza degli ospiti scorre come una sequenza fissa.",
        "Gli ospiti vengono istruiti in anticipo.",
        "{dogName} resta calmo durante l'accoglienza.",
      ],
      tagesplan: "Informa gli ospiti in anticipo: 'Per favore ignoralo i primi 5 min, deve restare sulla coperta.' Campanello: coperta. Porta: l'ospite entra. Le due persone si salutano prima senza il cane. Dopo 5 min: segnale OK, {dogName} puo dire ciao con cautela.",
      no_gos: [
        "Non informare gli ospiti: accarezzano il cane che abbaia.",
        "Segnale OK troppo presto.",
        "Lasciare {dogName} alla porta mentre l'ospite entra.",
      ],
      fortschritt: [
        "L'accoglienza degli ospiti e una routine.",
        "{dogName} resta calmo durante campanello + ingresso.",
        "Ti senti piu rilassato con gli ospiti.",
      ],
      exerciseIds: ["b-läuten-routine", "b-tuerklingel-decke"],
    },
    {
      title: "Mantenere stabile la riduzione delle ricompense",
      schwerpunkt: "La densita di ricompense viene ridotta ulteriormente, ma stabilizzata. {dogName} reagisce al marcatore SILENZIO anche senza premietti costanti. Ma: il MAXI-PREMIO per una prestazione eccellente resta.",
      wochenziele: [
        "La frequenza delle ricompense e ridotta a circa il 30%.",
        "{dogName} reagisce anche con meno ricompense.",
        "Nelle situazioni scatenanti: ancora ricompensa piena.",
      ],
      tagesplan: "Silenzio quotidiano: non premiare ogni secondo, ma a campione. Situazioni scatenanti: ancora piena densita di ricompense. {dogName} si accorge: imprevedibile, ma vale la pena.",
      no_gos: [
        "Eliminare del tutto.",
        "Ridurre la ricompensa per i fattori scatenanti.",
        "Riduzione incoerente: confonde.",
      ],
      fortschritt: [
        "Il comportamento resta stabile senza ricompensa continua.",
        "Diventi piu rilassato.",
        "L'abbaio resta raro.",
      ],
      exerciseIds: ["b-ruhe-marker", "b-tuerklingel-decke"],
    },
    {
      title: "Mantenere la coerenza a lungo termine",
      schwerpunkt: "L'abbaio puo tornare se la coerenza cala. Questa settimana consolidi la coerenza familiare e le routine per i prossimi mesi.",
      wochenziele: [
        "I membri della famiglia restano coerenti.",
        "Le routine sono stabilite.",
        "Riconosci in anticipo le piccole ricadute.",
      ],
      tagesplan: "Briefing familiare: breve promemoria di tutte le regole. Scrivile su un foglietto. Osserva: ci sono piccole ricadute? Correzione immediata. Non allentare routine come campanello-coperta.",
      no_gos: [
        "Allentare la coerenza: l'abbaio torna.",
        "Ignorare le ricadute.",
        "Lasciare che le routine si allentino.",
      ],
      fortschritt: [
        "La coerenza familiare regge.",
        "Le routine sono stabilite.",
        "Le ricadute vengono riconosciute in anticipo.",
      ],
      exerciseIds: ["b-aufmerksamkeits-bellen", "b-läuten-routine"],
    },
    {
      title: "Ridurre lo stress nell'arco della giornata",
      schwerpunkt: "L'abbaio e spesso un sintomo di stress. Questa settimana riduci in modo mirato i fattori di stress: piu sonno, piu lavoro di naso, meno sovrastimolazione.",
      wochenziele: [
        "{dogName} dorme almeno 16h al giorno.",
        "La sovrastimolazione viene evitata in modo mirato.",
        "Il livello di stress cala in modo evidente.",
      ],
      tagesplan: "Verifica l'arco della giornata: sonno sufficiente? Routine prevedibili? Fasi di lavoro di naso? Minimizza i fattori di stress come la sovrastimolazione. Igiene del sonno come nel piano energy.",
      no_gos: [
        "Ignorare lo stress.",
        "Considerare la sovrastimolazione 'normale'.",
        "Stimolare il cane di continuo.",
      ],
      fortschritt: [
        "Il livello di stress cala.",
        "La frequenza dell'abbaio si riduce ulteriormente.",
        "Diventi piu attento ai segnali di stress.",
      ],
      exerciseIds: ["b-ruhe-marker", "b-tuerklingel-decke"],
    },
    {
      title: "Strategie di emergenza per le ricadute",
      schwerpunkt: "Se l'abbaio aumenta all'improvviso: cosa fare? Questa settimana stabilisci una chiara sequenza di emergenza. Riconoscere presto, correggere, evitare le fasi di escalation.",
      wochenziele: [
        "Hai un piano di emergenza chiaro per le ricadute.",
        "I primi segnali vengono riconosciuti.",
        "Le ricadute vengono gestite in 1 settimana.",
      ],
      tagesplan: "Piano di emergenza: 1) subito 1 settimana extra-coerente. 2) densita di ricompense di nuovo alta. 3) ridurre i fattori scatenanti (piu gestione). 4) aumentare l'attivita fisica. 5) osservare cosa e cambiato (nuova casa, altra routine, nuovi fattori scatenanti).",
      no_gos: [
        "Ignorare le ricadute: peggiorano.",
        "Andare nel panico: si trasmette.",
        "Cambiare le routine di colpo.",
      ],
      fortschritt: [
        "Il piano di emergenza e a posto.",
        "Le ricadute vengono gestite in anticipo.",
        "Ti senti competente a lungo termine.",
      ],
      exerciseIds: ["b-trigger-tagebuch", "b-counter-cond-aussen"],
    },
    {
      title: "Passaggio alla modalita mantenimento",
      schwerpunkt: "Ultima settimana. L'abbaio e fortemente ridotto, i fattori scatenanti vengono gestiti, la coerenza familiare regge. Il mantenimento per i mesi a venire e a posto.",
      wochenziele: [
        "Tutte le routine funzionano in autonomia.",
        "Il ritmo di mantenimento e chiaro.",
        "{dogName} e piu calmo a lungo termine.",
      ],
      tagesplan: "Riduci l'allenamento attivo al minimo. Osserva. Pianifica ogni 4-6 settimane una giornata di ripasso con tutte le strategie. Briefing familiare ogni 3 mesi.",
      no_gos: [
        "Eliminare tutte le routine di colpo.",
        "Allentare la coerenza familiare.",
        "Smettere di osservare.",
      ],
      fortschritt: [
        "{dogName} e piu calmo a lungo termine.",
        "L'abbaio e l'eccezione, non la regola.",
        "Ti senti competente.",
      ],
      exerciseIds: ["b-ruhe-marker", "b-läuten-routine"],
    },
  ],
};

// ────────────────────────────────────────────────────────────────────
// ANXIETY (Trennungsangst) — Graduelle Allein-Zeit + Kong + Routine
// ────────────────────────────────────────────────────────────────────
const ANXIETY_WEEKS: Record<Phase, WeekTemplate[]> = {
  fundament: [
    {
      title: "Identificare i segnali che precedono l'addio",
      schwerpunkt: "I cani con ansia da separazione spesso si stressano già PRIMA che tu esca. Leggono i segnali come le chiavi, le scarpe, la giacca. Questa settimana identifichi l'intera catena di segnali.",
      wochenziele: [
        "Conosci la catena di segnali individuale di {dogName}.",
        "Riconosci precocemente i primi segni di stress.",
        "Capisci come si svolge il processo dell'ansia.",
      ],
      tagesplan: "Osserva attentamente per 3-5 giorni quando esci. Annota: da quale momento cambia il comportamento? Respirazione? Leccarsi? Ansimare? Camminare avanti e indietro? Identifica la catena: spesso chiavi + scarpe + borsa + giacca + mano sulla porta.",
      no_gos: [
        "Iniziare l'allenamento senza conoscere la catena di segnali.",
        "Considerare i segnali solo singolarmente — spesso agiscono combinati.",
        "Minimizzare i segni di stress.",
      ],
      fortschritt: [
        "Hai una lista chiara dei segnali.",
        "Capisci il processo dell'ansia di {dogName}.",
        "Sei pronto per un disaccoppiamento mirato.",
        "I primi 2-5 secondi di solitudine vengono gestiti senza drammi.",
      ],
      exerciseIds: ["ax-trigger-stack", "ax-mini-sekunden"],
    },
    {
      title: "Disaccoppiare i segnali",
      schwerpunkt: "I segnali identificati vengono privati del loro significato. Prendere le chiavi senza uscire, mettersi le scarpe senza uscire. Nell'arco di settimane i segnali perdono il loro effetto ansiogeno.",
      wochenziele: [
        "{dogName} non reagisce più ai singoli segnali.",
        "I segnali sono disaccoppiati dall'uscire.",
        "Lo integri nella giornata con naturalezza.",
      ],
      tagesplan: "10 volte al giorno vari segnali senza conseguenza: prendere le chiavi, posarle. Mettere le scarpe, toglierle. Toccare la maniglia, lasciarla. {dogName} prima guarda con interesse, poi perde interesse. Proprio questo è l'effetto di apprendimento.",
      no_gos: [
        "Renderlo simile a un allenamento — la naturalezza è meglio.",
        "Aspettarsi che funzioni in 3 giorni — è lavoro di settimane.",
        "Continuare in presenza di segni di stress.",
      ],
      fortschritt: [
        "I segnali perdono il loro effetto.",
        "{dogName} resta più rilassata quando avvista i segnali.",
        "Lavori in modo rilassato e naturale.",
        "Prima di uscire c'è ora un Kong ben farcito come associazione positiva.",
      ],
      exerciseIds: ["ax-trigger-entkoppeln", "ax-kong-beim-gehen"],
    },
    {
      title: "Costruire la solitudine in secondi",
      schwerpunkt: "Ora costruisci il tempo da solo — da 2 secondi a ore. Con pazienza, nell'arco di settimane. Chi aumenta troppo in fretta ricostruisce l'ansia.",
      wochenziele: [
        "{dogName} resta rilassata da sola per 1-3 min.",
        "Esci e rientri senza drammi.",
        "I segni di stress si riducono.",
      ],
      tagesplan: "Giorno 1: 2 sec da sola, 10 ripetizioni. Giorno 2: 5 sec. Giorno 3: 10 sec. Giorno 4: 30 sec. Giorno 5: 1 min. Giorno 6-7: 2-3 min. Rientra quando {dogName} è tranquilla, NON in risposta a una reazione di stress.",
      no_gos: [
        "Rientrare in risposta a una reazione di stress — insegna 'ululare = il padrone torna'.",
        "Aumentare troppo in fretta — l'ansia peggiora.",
        "Fare drammi al saluto/congedo.",
      ],
      fortschritt: [
        "Il tempo da solo cresce in modo misurabile.",
        "I segni di stress si riducono.",
        "Lavori con pazienza.",
      ],
      exerciseIds: ["ax-mini-sekunden", "ax-trigger-stack"],
    },
    {
      title: "Il Kong come associazione positiva",
      schwerpunkt: "Il Kong preferito arriva SOLO quando esci. Così l'uscire viene associato a qualcosa di positivo. {dogName} si rallegra del tempo da sola invece di averne paura.",
      wochenziele: [
        "{dogName} inizia a occuparsi del Kong quando esci.",
        "L'associazione Kong + assenza è consolidata.",
        "I segni di stress al momento dell'uscita si riducono.",
      ],
      tagesplan: "Farcisci il Kong molto bene con cibo umido, congelarlo = più difficile. Poco prima di uscire: dai il Kong in un posto fisso. Esci senza drammi. Rientra. Togli il Kong — è riservato SOLO all'assenza.",
      no_gos: [
        "Dare il Kong anche al di fuori dell'assenza — perde la sua magia.",
        "Continuare in presenza di stress — {dogName} non è ancora pronta.",
        "Congedo drammatico durante la consegna del Kong.",
      ],
      fortschritt: [
        "{dogName} si rallegra del momento del Kong.",
        "I segni di stress si riducono.",
        "Costruisci con successo un'associazione positiva.",
      ],
      exerciseIds: ["ax-kong-beim-gehen", "ax-trigger-entkoppeln"],
    },
    // 6-Monats-Vertiefungen
    {
      title: "Stabilire la coperta della sicurezza",
      schwerpunkt: "La coperta del rilassamento diventa l'ancora di sicurezza per i momenti di solitudine. {dogName} trascorre il tempo da sola sulla coperta. Condizionamento pavloviano: coperta = sicurezza.",
      wochenziele: [
        "La coperta è consolidata come ancora di sicurezza.",
        "{dogName} cerca la coperta anche al di fuori dell'allenamento.",
        "Il tempo da sola sulla coperta diventa routine.",
      ],
      tagesplan: "Coperta in un posto fisso, idealmente con una protezione visiva (cesta, divano per cani). All'uscita: {dogName} sulla coperta, con il Kong. Se si alza: riportala con calma. Nell'arco di settimane la coperta diventa l'isola del tempo da sola.",
      no_gos: [
        "Usare la coperta per punire.",
        "Usare la coperta solo nelle fasi di stress.",
        "Forzare {dogName} a sdraiarsi.",
      ],
      fortschritt: [
        "{dogName} cerca la coperta da sola.",
        "La coperta acquisisce un valore emotivo positivo.",
        "Lo stress del tempo da sola si riduce.",
      ],
      exerciseIds: ["ax-sicherheits-decke", "ax-trigger-stack"],
    },
    {
      title: "Costruire le ore con l'osservazione video",
      schwerpunkt: "Quando le fasi brevi funzionano, costruisci lentamente le ore. Lo smartphone come telecamera, così sai esattamente cosa fa {dogName} mentre sei via. Non tirare a indovinare.",
      wochenziele: [
        "{dogName} resta rilassata da sola per 30-60 min.",
        "Osservi via video cosa succede davvero.",
        "Distingui con sicurezza stress e rilassamento.",
      ],
      tagesplan: "Installa la telecamera dello smartphone o una smart-camera con streaming live. Giorno 1-3: 30 min di assenza, osservare. Giorno 4-7: se ha successo aumenta a 45 min, poi 60 min. In caso di stress: torna all'ultimo livello stabile.",
      no_gos: [
        "Tirare a indovinare cosa succede senza video.",
        "Aumentare troppo in fretta.",
        "Continuare in presenza di stress.",
      ],
      fortschritt: [
        "Il tempo da sola cresce in modo stabile.",
        "Hai dati, non solo supposizioni.",
        "Lo stress di {dogName} si riduce in modo misurabile.",
      ],
      exerciseIds: ["ax-langzeit-aufbau", "ax-tagesroutine"],
    },
    {
      title: "Una routine quotidiana prevedibile",
      schwerpunkt: "I cani con ansia da separazione traggono un enorme beneficio da ritmi quotidiani prevedibili. Orari uguali per la passeggiata, il pasto, l'attività, il tempo da soli.",
      wochenziele: [
        "La routine quotidiana è consolidata e messa per iscritto.",
        "Anche nel fine settimana gli orari vengono rispettati.",
        "La prevedibilità riduce l'ansia.",
      ],
      tagesplan: "Scrivi orari fissi sul frigorifero: alzarsi, primo bisogno, pasto, passeggiata, tempo da soli, prossima passeggiata, cena, dormire. Rispettali anche nel fine settimana.",
      no_gos: [
        "Fare orari diversi nel fine settimana — confonde.",
        "Saltare l'attività fisica prima del tempo da soli.",
        "Deviare spontaneamente senza un motivo valido.",
      ],
      fortschritt: [
        "{dogName} conosce la routine quotidiana.",
        "L'insicurezza si riduce.",
        "L'ansia da separazione cala con la prevedibilità.",
      ],
      exerciseIds: ["ax-trigger-stack", "ax-kong-beim-gehen"],
    },
    {
      title: "Verifica delle fondamenta",
      schwerpunkt: "Ultima settimana delle fondamenta. Segnali disaccoppiati, costruzione del tempo da soli in corso, associazione col Kong consolidata, coperta come ancora. Fase 2 = costruzione delle ore.",
      wochenziele: [
        "Tutti gli elementi sono a posto.",
        "Sei pronto per la Fase 2.",
        "Lo stress di {dogName} si riduce in modo misurabile.",
      ],
      tagesplan: "Bilancio: cosa è a posto, cosa vacilla? Se sotto i 2 min di solitudine c'è ancora stress: 1 settimana extra nella Fase 1. Fase 2 = tempi più lunghi, lì non deve vacillare nulla.",
      no_gos: [
        "Passare alla Fase 2 per impazienza.",
        "Ignorare la soglia.",
        "Fare pressione per aumentare.",
      ],
      fortschritt: [
        "Ti senti competente.",
        "Gli strumenti sono a posto.",
        "La Fase 2 è a portata di mano.",
      ],
      exerciseIds: ["ax-mini-sekunden", "ax-trigger-entkoppeln"],
    },
  ],
  steigerung: [
    {
      title: "Estendere le fasi in minuti",
      schwerpunkt: "Basandosi sulle fondamenta: tempo da soli da 3 min a 15-30 min. La ricompensa resta il Kong, la coperta è l'ancora, l'osservazione avviene via video.",
      wochenziele: [
        "{dogName} resta rilassata da sola per 15-30 min.",
        "Il Kong viene elaborato con calma.",
        "I segni di stress non si presentano più.",
      ],
      tagesplan: "Giorno 1: 5 min. Giorno 2: 10. Giorno 3: 15. Giorno 4: 20. Giorno 5: 30. Se un giorno c'è stress: torna all'ultimo livello stabile e restaci 2-3 giorni.",
      no_gos: [
        "Aumentare troppo in fretta.",
        "Insistere in presenza di stress.",
        "Fare drammi al congedo/saluto.",
      ],
      fortschritt: [
        "Il tempo da sola cresce in modo stabile.",
        "L'associazione col Kong è consolidata.",
        "Lo stress si riduce.",
      ],
      exerciseIds: ["ax-mini-sekunden", "ax-kong-beim-gehen"],
    },
    {
      title: "La prima ora da solo",
      schwerpunkt: "La soglia magica: 1 ora da solo. Quando questo è a posto, gran parte del lavoro sull'ansia da separazione è fatto. Con cautela e con il video.",
      wochenziele: [
        "{dogName} regge 1 ora rilassata da sola.",
        "Il video mostra fasi di riposo durante l'assenza.",
        "Ti senti sollevato.",
      ],
      tagesplan: "Giorno 1-2: 45 min. Giorno 3-4: 50 min. Giorno 5-7: 60 min. Osserva il video. In caso di stress: torna indietro. Se ha successo: prosegui con cautela.",
      no_gos: [
        "Aspettarsi che 1h funzioni subito.",
        "Testare più ore contemporaneamente.",
        "Continuare in presenza di stress.",
      ],
      fortschritt: [
        "1 ora di solitudine è raggiunta.",
        "Ti senti sollevato.",
        "{dogName} resta tranquilla.",
      ],
      exerciseIds: ["ax-langzeit-aufbau", "ax-tagesroutine"],
    },
    {
      title: "Stimoli esterni durante la solitudine",
      schwerpunkt: "{dogName} deve saper gestire anche gli stimoli esterni durante il tempo da sola. Rumore della strada, campanello, altri cani che abbaiano — tutto questo {dogName} deve saperlo tollerare con calma.",
      wochenziele: [
        "{dogName} resta tranquilla in presenza di stimoli esterni durante la solitudine.",
        "La coperta resta l'ancora anche sotto stimolo.",
        "I segni di stress non si presentano più.",
      ],
      tagesplan: "Pianifica i momenti da sola negli orari con normale rumore esterno. Osserva via video. Se {dogName} reagisce agli stimoli esterni: 1) protezione visiva alle finestre, 2) musica di sottofondo a basso volume (adagio classico), 3) sposta la coperta lontano dalle fonti di rumore.",
      no_gos: [
        "Testare la solitudine durante un temporale — troppo difficile.",
        "Rientrare quando abbaia agli stimoli — lo rinforza.",
        "Lasciarla senza osservazione.",
      ],
      fortschritt: [
        "{dogName} resta tranquilla sotto stimoli esterni.",
        "La routine dell'ancora è solida.",
        "Ti senti più competente.",
      ],
      exerciseIds: ["ax-sicherheits-decke", "ax-kong-beim-gehen"],
    },
    {
      title: "Consolidare il disaccoppiamento dei segnali",
      schwerpunkt: "Anche dopo 4 settimane continua a disaccoppiare i segnali. Chiavi, scarpe, giacca senza significato. {dogName} NON deve più reagire ai singoli segnali.",
      wochenziele: [
        "Tutti gli ex segnali sono privi di significato.",
        "{dogName} reagisce solo al momento dell'uscita effettiva.",
        "L'accumulo di stress durante i preparativi è eliminato.",
      ],
      tagesplan: "Continua 10 volte al giorno con vari segnali senza conseguenza. Aumenta l'incoerenza: a volte prendi le chiavi E le scarpe, ma NON esci. La variabilità è la chiave.",
      no_gos: [
        "Tralasciare il disaccoppiamento dei segnali.",
        "Disaccoppiare solo i singoli segnali.",
        "Aspettarsi che regga senza ulteriore lavoro.",
      ],
      fortschritt: [
        "I segnali sono disaccoppiati in modo duraturo.",
        "L'accumulo di stress nei preparativi è eliminato.",
        "Lavori con serenità nella quotidianità.",
      ],
      exerciseIds: ["ax-trigger-entkoppeln", "ax-trigger-stack"],
    },
    // Vertiefungen
    {
      title: "Fasi di 2 ore",
      schwerpunkt: "2 ore da solo. È la soglia oltre la quale diventa possibile una vera vita quotidiana (spesa, pausa pranzo al lavoro). Con delicatezza, con il video.",
      wochenziele: [
        "{dogName} regge 2 ore tranquilla da sola.",
        "Il video mostra fasi di sonno.",
        "Riconquisti la libertà nella quotidianità.",
      ],
      tagesplan: "Giorno 1-2: 90 min. Giorno 3-4: 100 min. Giorno 5-7: 2 ore. Ricompensa con Kong + coperta. In caso di stress: torna al livello stabile.",
      no_gos: [
        "Aspettarsi che 2h funzionino subito.",
        "Tirare a indovinare senza video.",
        "Insistere in presenza di stress.",
      ],
      fortschritt: [
        "2h di solitudine sono raggiunte.",
        "Riconquisti la libertà nella quotidianità.",
        "{dogName} resta tranquilla.",
      ],
      exerciseIds: ["ax-langzeit-aufbau", "ax-tagesroutine"],
    },
    {
      title: "Tempi di solitudine variabili",
      schwerpunkt: "Finora avevi tempi di solitudine fissi. Ora li varii: a volte 30 min, a volte 2h, a volte 90 min. {dogName} impara: la solitudine è imprevedibile, ma sempre passeggera.",
      wochenziele: [
        "{dogName} resta tranquilla indipendentemente dalla durata.",
        "La variabilità è ben rodata.",
        "Pianifichi in modo flessibile.",
      ],
      tagesplan: "Ogni giorno 2-3 diverse durate di solitudine: al mattino 30 min, al pomeriggio 2h, alla sera 45 min. {dogName} impara: non so mai esattamente per quanto, quindi resto tranquilla.",
      no_gos: [
        "Più di 3h di fila — troppo lungo per questa fase.",
        "Differenze troppo marcate in un solo giorno.",
        "Non tornare indietro in presenza di stress.",
      ],
      fortschritt: [
        "La variabilità viene accettata.",
        "{dogName} resta tranquilla indipendentemente dalla durata.",
        "Pianifichi in modo più flessibile.",
      ],
      exerciseIds: ["ax-trigger-stack", "ax-kong-beim-gehen"],
    },
    {
      title: "Il contatto sociale come riduttore di stress",
      schwerpunkt: "Più contatti sociali con altri cani mentre sei presente riducono spesso l'ansia da separazione. {dogName} è meno fissata solo su di te.",
      wochenziele: [
        "{dogName} ha 2-3 amici cani prevedibili.",
        "Gli appuntamenti sociali a settimana sono consolidati.",
        "La fissazione su di te si riduce.",
      ],
      tagesplan: "A settimana 2-3 appuntamenti sociali: 30-45 min con cani tranquilli e prevedibili. Mai più a lungo. Dopo l'appuntamento sociale: calmarsi. {dogName} impara: ho più fonti sociali oltre al solo padrone.",
      no_gos: [
        "Giochi sfrenati per ore.",
        "Cani sconosciuti con competenza sociale incerta.",
        "Più appuntamenti sociali al giorno.",
      ],
      fortschritt: [
        "{dogName} ha una rete sociale.",
        "La fissazione su di te si riduce.",
        "L'ansia da separazione cala.",
      ],
      exerciseIds: ["ax-tagesroutine", "ax-trigger-entkoppeln"],
    },
    {
      title: "Consolidamento dell'aumento",
      schwerpunkt: "Ultima settimana di aumento. 2h di solitudine padroneggiate, segnali disaccoppiati, routine consolidate. Fase 3 = quotidianità e mantenimento.",
      wochenziele: [
        "Tutti gli strumenti sono a posto.",
        "La solitudine fino a 2-3h è fattibile.",
        "Sei pronto per la Fase 3.",
      ],
      tagesplan: "Bilancio: a che punto sei? Cosa vacilla? Pianifica la Fase 3: routine quotidiana prevedibile, ripassi regolari, riduzione dello stress a lungo termine.",
      no_gos: [
        "Forzare già 4h+ di solitudine.",
        "Ammorbidire le routine.",
        "Dare per scontati i successi.",
      ],
      fortschritt: [
        "Ti senti sollevato.",
        "Gli strumenti sono a posto.",
        "La solitudine è fattibile.",
      ],
      exerciseIds: ["ax-langzeit-aufbau", "ax-sicherheits-decke"],
    },
  ],
  generalisierung: [
    {
      title: "3-4 ore nella quotidianità",
      schwerpunkt: "Fase 3 = quotidianità realistica. 3-4h di solitudine sono fattibili per la maggior parte dei padroni che lavorano. Di più è al limite anche per cani equilibrati.",
      wochenziele: [
        "{dogName} resta tranquilla da sola per 3-4h.",
        "La vita quotidiana (lavoro, spesa) è fattibile.",
        "Non ti senti più limitato.",
      ],
      tagesplan: "Testa consapevolmente 3-4h di solitudine. Video. Mantieni la stabilità per diversi giorni prima di uscire più a lungo. Kong + coperta + preparazione tranquilla.",
      no_gos: [
        "5h+ senza pausa per i bisogni — troppo lungo.",
        "Insistere in presenza di stress.",
        "Cambiamenti spontanei.",
      ],
      fortschritt: [
        "3-4h sono consolidate.",
        "La quotidianità è di nuovo fattibile.",
        "Ti senti libero.",
        "Una routine quotidiana prevedibile (passeggiata, pasto, tempo da soli) è appesa al frigorifero.",
      ],
      exerciseIds: ["ax-langzeit-aufbau", "ax-tagesroutine"],
    },
    {
      title: "Mantenere una struttura quotidiana prevedibile",
      schwerpunkt: "Anche dopo il successo: la routine quotidiana resta. I cani con (ex) ansia da separazione sono inclini a regressioni in caso di irregolarità.",
      wochenziele: [
        "La routine quotidiana viene mantenuta con coerenza.",
        "Anche nel fine settimana nessuna deviazione.",
        "La prevedibilità è consolidata a lungo termine.",
      ],
      tagesplan: "Tieni alto il foglio della routine. Fine settimana: stessi orari dei giorni feriali. Evita cambiamenti spontanei. Per cambiamenti davvero necessari: adeguali già in anticipo.",
      no_gos: [
        "Bengodi del fine settimana senza routine.",
        "Cambiamenti spontanei del piano.",
        "Saltare l'attività fisica prima del tempo da soli.",
      ],
      fortschritt: [
        "La routine è consolidata a lungo termine.",
        "{dogName} resta stabile.",
        "Pianifichi in modo strutturato.",
      ],
      exerciseIds: ["ax-trigger-stack", "ax-kong-beim-gehen"],
    },
    {
      title: "Riduzione dello stress a lungo termine",
      schwerpunkt: "Lo stress in altri ambiti può far tornare l'ansia da separazione. Igiene dello stress per tutta la vita: sonno sufficiente, buona attività, contatti sociali, ambiente tranquillo.",
      wochenziele: [
        "{dogName} dorme 16-20h al giorno.",
        "I fattori di stress vengono ridotti attivamente.",
        "Le regressioni dell'ansia da separazione vengono evitate.",
      ],
      tagesplan: "Verifica regolarmente: igiene del sonno? Attività? Contatti sociali? Fasi di riposo? In caso di stress in altri ambiti: riducilo prima che l'ansia da separazione torni.",
      no_gos: [
        "Ignorare lo stress in altri ambiti.",
        "Permettere il sovraccarico di stimoli.",
        "Dimenticare l'igiene del sonno.",
      ],
      fortschritt: [
        "{dogName} resta equilibrata a lungo termine.",
        "Le regressioni vengono evitate.",
        "Fai attenzione all'igiene dello stress.",
      ],
      exerciseIds: ["ax-tagesroutine", "ax-sicherheits-decke"],
    },
    {
      title: "Consolidare la routine del Kong",
      schwerpunkt: "Il Kong resta lo strumento esclusivo del tempo da soli. NON darlo MAI in tua presenza. Varia il contenuto perché resti interessante.",
      wochenziele: [
        "La routine del Kong è consolidata a lungo termine.",
        "Il contenuto varia abbastanza da garantire varietà.",
        "Il Kong resta lo snack magico della solitudine.",
      ],
      tagesplan: "A ogni momento da solo, il Kong. Variazione: oggi cibo umido+formaggio, domani cibo secco+wurstel, dopodomani burro di arachidi (con parsimonia). Congelato = più difficile. Dopo la solitudine: via il Kong.",
      no_gos: [
        "Dare il Kong anche al di fuori della solitudine.",
        "Sempre lo stesso contenuto — noioso.",
        "Togliere il Kong dopo 5 min — frustra.",
      ],
      fortschritt: [
        "Il Kong resta caricato positivamente.",
        "{dogName} si rallegra del tempo da sola.",
        "L'associazione regge a lungo termine.",
      ],
      exerciseIds: ["ax-kong-beim-gehen", "ax-mini-sekunden"],
    },
    {
      title: "Routine di osservazione",
      schwerpunkt: "Anche dopo il successo, controlla regolarmente via video cosa fa {dogName} durante la solitudine. Così le regressioni si riconoscono precocemente.",
      wochenziele: [
        "Osservi via video ogni 2-3 settimane.",
        "Le regressioni vengono riconosciute precocemente.",
        "Hai dati, non solo supposizioni.",
      ],
      tagesplan: "Ogni 2-3 settimane: registra 1 momento da sola con il video. Guardalo: cosa ha fatto {dogName}? Ha dormito? Masticato? Camminato avanti e indietro? Riconosci le tendenze.",
      no_gos: [
        "Supporre invece di osservare.",
        "Ignorare le regressioni.",
        "Lasciar decadere la routine del video.",
      ],
      fortschritt: [
        "Sicurezza basata sui dati.",
        "Le regressioni vengono riconosciute precocemente.",
        "Ti senti più competente.",
      ],
      exerciseIds: ["ax-langzeit-aufbau", "ax-tagesroutine"],
    },
    {
      title: "Affrontare le occasioni difficili",
      schwerpunkt: "Veterinario, toelettatore, visita d'emergenza. Occasioni che ti tengono lontano più a lungo. Allenale prima, non capirle nell'emergenza.",
      wochenziele: [
        "Pianifichi le occasioni difficili in modo strutturato.",
        "{dogName} resta tranquilla anche nelle fasi più lunghe.",
        "Ti senti preparato.",
      ],
      tagesplan: "Prima che si presentino occasioni difficili: 1 settimana prima esercita 1-2 tempi di solitudine insolitamente lunghi. Arricchisci il contenuto del Kong. Mantieni la routine quotidiana il più simile possibile. Eventualmente un dog sitter per l'emergenza.",
      no_gos: [
        "Prolungamento spontaneo senza preparazione.",
        "Dog sitter senza conoscenza preliminare.",
        "Sovraccaricare {dogName} in caso di necessità improvvisa.",
      ],
      fortschritt: [
        "Le occasioni difficili vengono affrontate.",
        "Pianifichi in modo strutturato.",
        "{dogName} resta stabile.",
      ],
      exerciseIds: ["ax-trigger-stack", "ax-trigger-entkoppeln"],
    },
    {
      title: "Protocollo d'emergenza per le regressioni",
      schwerpunkt: "Se l'ansia da separazione torna (nuova casa, cambiamenti): una sequenza d'emergenza chiara. Riconoscimento precoce, contromisure, settimane di coerenza extra.",
      wochenziele: [
        "Hai un piano d'emergenza.",
        "I primi segni vengono riconosciuti.",
        "Le regressioni vengono recuperate in 2-3 settimane.",
      ],
      tagesplan: "Piano d'emergenza: 1) torna a tempi di solitudine più brevi. 2) rafforza l'associazione col Kong. 3) mantieni rigorosamente la routine quotidiana. 4) riduci i fattori di stress. 5) controllo dal veterinario per escludere cause mediche.",
      no_gos: [
        "Ignorare le regressioni.",
        "In caso di regressione continuare con il solito tempo di solitudine.",
        "Aumentare la pressione.",
      ],
      fortschritt: [
        "Il piano d'emergenza è a posto.",
        "Le regressioni vengono gestite.",
        "Ti senti competente a lungo termine.",
      ],
      exerciseIds: ["ax-mini-sekunden", "ax-kong-beim-gehen"],
    },
    {
      title: "Passaggio alla modalità mantenimento",
      schwerpunkt: "Ultima settimana. L'ansia da separazione è nettamente ridotta, la solitudine funziona, le routine sono consolidate. Mantenimento per gli anni a venire.",
      wochenziele: [
        "Tutte le routine funzionano a lungo termine.",
        "Il ritmo di mantenimento è chiaro.",
        "{dogName} è equilibrata a lungo termine.",
      ],
      tagesplan: "Riduci l'allenamento attivo al minimo. La routine quotidiana resta. La routine del Kong resta. Osservazione ogni 4-6 settimane. In caso di cambiamenti (trasloco, nuova routine): adatta con cautela.",
      no_gos: [
        "Abbandonare di colpo le routine.",
        "Non adattarsi ai cambiamenti.",
        "Smettere di osservare.",
      ],
      fortschritt: [
        "{dogName} è equilibrata a lungo termine.",
        "Ti senti libero.",
        "L'ansia da separazione è ormai storia.",
      ],
      exerciseIds: ["ax-tagesroutine", "ax-trigger-stack"],
    },
  ],
};

// ────────────────────────────────────────────────────────────────────
// JUMPING (Anspringen) — 4 Pfoten = Belohnung, Springen = Ignorieren
// ────────────────────────────────────────────────────────────────────
const JUMPING_WEEKS: Record<Phase, WeekTemplate[]> = {
  fundament: [
    {
      title: "4 zampe a terra = ricompensa",
      schwerpunkt: "Il principio più importante: solo lo stare fermo e calmo ottiene attenzione. Quando salta, {dogName} viene ignorato con coerenza. Con 2-3 settimane di coerenza il saltare addosso scompare.",
      wochenziele: [
        "Con tutte e quattro le zampe a terra: salutare con calma, accarezzare.",
        "Quando salta: girargli le spalle, ignorarlo.",
        "{dogName} capisce: saltare = tu te ne vai.",
      ],
      tagesplan: "Applica attivamente a ogni ritrovo: quattro zampe a terra = saluto calmo. Salta? Girargli le spalle, nessun contatto visivo. Quattro zampe di nuovo a terra: rivolgiti di nuovo a lui. Coerenza con tutti i membri della famiglia.",
      no_gos: [
        "Sgridare quando salta — anche l'attenzione è una ricompensa.",
        "Familiari che una volta cedono — sabota il lavoro.",
        "Spingere via col ginocchio — può far male, il cane non lo capisce.",
      ],
      fortschritt: [
        "{dogName} salta più di rado.",
        "Diventi più coerente.",
        "La famiglia collabora.",
        "{dogName} offre da solo il SEDUTO quando qualcuno si avvicina a {dogName}.",
      ],
      exerciseIds: ["j-vier-pfoten-belohnen", "j-sitz-als-gruess"],
    },
    {
      title: "SEDUTO come alternativa al saluto",
      schwerpunkt: "Invece di limitarci a impedire il saltare, diamo a {dogName} un'alternativa: il SEDUTO è il nuovo saluto. All'incontro si siede e per questo riceve attenzione.",
      wochenziele: [
        "{dogName} si siede al SEDUTO prima del saluto.",
        "L'attenzione arriva SOLO quando è seduto.",
        "Il SEDUTO diventa il saluto automatico.",
      ],
      tagesplan: "Agli incontri (famiglia, ospiti): di' SEDUTO. Si siede: carezze + premietto. Si alza per saltare: stop alle carezze. Di nuovo SEDUTO: rivolgiti a lui. Istruisci anche gli ospiti: 'Solo quando è SEDUTO.'",
      no_gos: [
        "Accarezzarlo anche quando è in piedi — associazione sbagliata.",
        "Non informare gli ospiti — accarezzano il cane che salta.",
        "Non condizionare prima il SEDUTO.",
      ],
      fortschritt: [
        "Il SEDUTO diventa lo standard del saluto.",
        "Il saltare si riduce.",
        "Ti senti preparato.",
        "La coerenza familiare è solida e tutti in casa collaborano.",
      ],
      exerciseIds: ["j-tuergaeste-routine", "j-konsistenz-familie"],
    },
    {
      title: "Stabilire la coerenza familiare",
      schwerpunkt: "Il saltare addosso è un problema di coerenza. Se anche solo 1 membro della famiglia permette il saltare, sabota tutto il lavoro. Questa settimana stabilisci la coerenza familiare.",
      wochenziele: [
        "Tutti i membri della famiglia conoscono la regola.",
        "L'incoerenza viene ridotta a 0.",
        "Gli ospiti vengono informati in anticipo.",
      ],
      tagesplan: "Briefing familiare: quattro zampe = saluto, saltare = ignorare. Coinvolgi anche i bambini. Biglietto con la regola all'ingresso per gli ospiti. Ripeti la regola più volte a settimana.",
      no_gos: [
        "Familiari che permettono il saltare 'solo una volta'.",
        "Dimenticare di informare gli ospiti.",
        "Tollerare l'incoerenza.",
      ],
      fortschritt: [
        "La famiglia collabora.",
        "Gli ospiti vengono informati.",
        "L'incoerenza è eliminata.",
      ],
      exerciseIds: ["j-spazier-vorbeigaenger", "j-vier-pfoten-belohnen"],
    },
    {
      title: "Routine del ritrovo",
      schwerpunkt: "Il rientro a casa è spesso il momento che più scatena il saltare. Questa settimana stabiliamo una routine calma per il ritrovo: nessun dramma, nessun saltare addosso, saluto tranquillo.",
      wochenziele: [
        "{dogName} arriva con calma alla porta, senza saltare.",
        "Il saluto è calmo e controllato.",
        "L'eccitazione al ritrovo si riduce.",
      ],
      tagesplan: "Quando rientri a casa: se {dogName} salta su, ignoralo per 30 sec. Quattro zampe a terra: saluto calmo. Non salutare MAI in modo drammatico. Togliti le scarpe, solo dopo rivolgiti a lui.",
      no_gos: [
        "Un 'Ciao tesoro mio!' drammatico — rafforza l'eccitazione.",
        "Accarezzarlo subito mentre il cane salta.",
        "Aspettarsi che il saluto calmo funzioni subito.",
      ],
      fortschritt: [
        "La routine del ritrovo diventa calma.",
        "L'eccitazione si riduce.",
        "Diventi più rilassato al rientro a casa.",
      ],
      exerciseIds: ["j-tuergaeste-routine", "j-sitz-als-gruess"],
    },
    // 6-Monats-Vertiefungen
    {
      title: "Incontri con gli ospiti",
      schwerpunkt: "In progressione: applica con gli ospiti ciò che funziona con la famiglia. Gli ospiti vengono istruiti in dettaglio, {dogName} deve stare SEDUTO mentre l'ospite entra.",
      wochenziele: [
        "{dogName} resta calmo all'accoglienza degli ospiti.",
        "Gli ospiti sono informati e collaborano.",
        "Accogliere gli ospiti è routine.",
      ],
      tagesplan: "Prima di accogliere gli ospiti: informali in anticipo con un messaggio: 'Per favore ignoralo i primi 5 min, deve imparare a stare seduto.' Campanello: coperta o SEDUTO. L'ospite entra, non bada al cane. Dopo 3-5 min con calma: segnale OK.",
      no_gos: [
        "Non informare gli ospiti.",
        "Aspettarsi che tutti gli ospiti collaborino senza spiegazioni.",
        "Dare il segnale OK troppo presto.",
      ],
      fortschritt: [
        "L'accoglienza degli ospiti diventa collaudata.",
        "{dogName} resta calmo all'accoglienza.",
        "Ti senti più rilassato.",
      ],
      exerciseIds: ["j-tuergaeste-routine", "j-vier-pfoten-belohnen"],
    },
    {
      title: "Padroneggiare gli incontri in passeggiata",
      schwerpunkt: "Saltare addosso fuori è delicato: non tutti vogliono un cane che salta loro addosso. Stabiliamo il SEDUTO in posizione a fianco della gamba quando qualcuno passa.",
      wochenziele: [
        "{dogName} si siede a fianco della gamba quando qualcuno passa.",
        "I passanti non vengono saltati addosso.",
        "Ti senti preparato agli incontri in passeggiata.",
      ],
      tagesplan: "Passeggiate in cui aspettarsi passanti. Alla vista di una persona (15m+): SEDUTO accanto alla tua gamba. Ricompensa mentre passa. I passanti passano oltre, NON interagire col cane.",
      no_gos: [
        "Lasciare che i passanti accarezzino il cane mentre salta.",
        "Aspettarsi che i passanti stiano al gioco.",
        "Continuare in caso di stress.",
      ],
      fortschritt: [
        "Il SEDUTO davanti ai passanti diventa routine.",
        "Il saltare fuori si riduce.",
        "Le passeggiate risultano più controllate.",
      ],
      exerciseIds: ["j-spazier-vorbeigaenger", "j-sitz-als-gruess"],
    },
    {
      title: "Coperta per gli ospiti difficili",
      schwerpunkt: "Con ospiti difficili (bambini, persone timorose, anziani) {dogName} sta sulla coperta. Separazione chiara, nessun rischio.",
      wochenziele: [
        "{dogName} resta sulla coperta con gli ospiti difficili.",
        "Gli incontri rischiosi vengono evitati.",
        "Ti senti preparato in modo responsabile.",
      ],
      tagesplan: "Con bambini, ospiti timorosi o anziani: porta {dogName} direttamente sulla coperta. Lascialo sulla coperta anche durante la visita. Ricompensa con il Kong. Se serve: separazione nel box in un'altra stanza.",
      no_gos: [
        "Aspettarsi che tutti gli ospiti tollerino il cane.",
        "Forzare incontri rischiosi.",
        "Lasciare {dogName} libero con ospiti timorosi.",
      ],
      fortschritt: [
        "Gli incontri rischiosi vengono evitati.",
        "La routine della coperta è solida.",
        "Agisci in modo responsabile.",
      ],
      exerciseIds: ["j-tuergaeste-routine", "j-tuergaeste-routine"],
    },
    {
      title: "Consolidamento del fondamento",
      schwerpunkt: "Ultima settimana di fondamento. La routine delle quattro zampe è solida, il SEDUTO come saluto, la coerenza familiare, l'accoglienza degli ospiti. Fase 2 = più applicazione.",
      wochenziele: [
        "Tutti gli elementi sono solidi.",
        "Il saltare è nettamente ridotto.",
        "Ti senti competente.",
      ],
      tagesplan: "Bilancio: cosa è solido, cosa vacilla? In caso di debolezza: 1 settimana extra. Fase 2 = ancora più applicazione in situazioni reali.",
      no_gos: [
        "Allentare la coerenza.",
        "Ignorare le debolezze.",
        "Dare i successi per scontati.",
      ],
      fortschritt: [
        "Ti senti competente.",
        "Gli strumenti sono solidi.",
        "Il saltare è più raro.",
      ],
      exerciseIds: ["j-vier-pfoten-belohnen", "j-sitz-als-gruess"],
    },
  ],
  steigerung: [
    {
      title: "Coerenza in più situazioni",
      schwerpunkt: "Questa settimana applichi le regole in ancora più situazioni: la mattina al risveglio, durante i pasti, mentre giochi. Il saltare cala da solo.",
      wochenziele: [
        "Regola delle quattro zampe in 5+ situazioni al giorno.",
        "Il saltare si riduce in modo trasversale.",
        "Diventi coerente d'istinto.",
      ],
      tagesplan: "Applica attivamente: la mattina al risveglio, prima della passeggiata, prima dei pasti, mentre giochi, al rientro a casa. Ogni salto viene ignorato, ogni stare con le quattro zampe a terra viene ricompensato.",
      no_gos: [
        "Allentare la regola a seconda della situazione.",
        "Giustificarsi ('è solo eccitato').",
        "Tralasciare la coerenza per fretta.",
      ],
      fortschritt: [
        "La coerenza cresce.",
        "Il saltare si riduce in modo trasversale.",
        "Diventi interiormente più coerente.",
        "Davanti ai passanti {dogName} si siede sempre più da solo accanto alla tua gamba.",
      ],
      exerciseIds: ["j-vier-pfoten-belohnen", "j-spazier-vorbeigaenger"],
    },
    {
      title: "Sequenza ospiti avanzata",
      schwerpunkt: "Con più ospiti contemporaneamente diventa complesso. Questa settimana stabiliamo la sequenza ospiti anche con i gruppi.",
      wochenziele: [
        "{dogName} gestisce con calma la visita di gruppo.",
        "La coperta è un'ancora anche nell'eccitazione.",
        "Pianifichi in modo strutturato.",
      ],
      tagesplan: "Pianifica le visite di gruppo con consapevolezza (3-4 persone). {dogName} subito sulla coperta. Tutti gli ospiti sono informati. Fase di saluto di 5-10 min, durante la quale {dogName} resta sulla coperta. Solo dopo il segnale OK.",
      no_gos: [
        "Più persone sconosciute senza informazione preventiva.",
        "Segnale OK troppo presto.",
        "Coperta senza condizionamento precedente.",
      ],
      fortschritt: [
        "Le visite di gruppo vengono padroneggiate.",
        "La routine della coperta è solida.",
        "Ti senti più rilassato con i gruppi.",
      ],
      exerciseIds: ["j-tuergaeste-routine", "j-sitz-als-gruess"],
    },
    {
      title: "Sit-on-cue in contesto reale",
      schwerpunkt: "Il SEDUTO come saluto standard non viene più annullato — {dogName} lo offre automaticamente. La frequenza delle ricompense può essere ridotta.",
      wochenziele: [
        "{dogName} si siede automaticamente ai saluti.",
        "Non devi più dire attivamente SEDUTO.",
        "La frequenza delle ricompense si riduce.",
      ],
      tagesplan: "Ai saluti aspetta 2-3 sec — {dogName} offre il SEDUTO? Se sì: subito carezze, ogni tanto premietto. Se no: di' SEDUTO. Nel giro di settimane si stabilisce l'automatismo.",
      no_gos: [
        "Accarezzarlo quando resta in piedi.",
        "Ridurre la frequenza delle ricompense troppo in fretta.",
        "Aspettarsi che regga senza rinfrescare l'esercizio.",
      ],
      fortschritt: [
        "Il SEDUTO viene offerto automaticamente.",
        "La frequenza delle ricompense cala.",
        "Ti senti più rilassato.",
      ],
      exerciseIds: ["j-vier-pfoten-belohnen", "j-konsistenz-familie"],
    },
    {
      title: "Consolidare gli incontri in passeggiata",
      schwerpunkt: "Il SEDUTO davanti ai passanti diventa routine. {dogName} si siede automaticamente quando le persone si avvicinano.",
      wochenziele: [
        "SEDUTO automatico davanti ai passanti.",
        "Il saltare fuori è quasi del tutto eliminato.",
        "Le passeggiate sono più rilassate.",
      ],
      tagesplan: "In ogni passeggiata sequenze attive di SEDUTO a ogni incontro. Ricompensa. Se il SEDUTO non è automatico: dai il segnale. Se è automatico: ricompensa SUPER.",
      no_gos: [
        "Lasciare che i passanti accarezzino il cane mentre è in piedi.",
        "Aspettarsi che tutti collaborino.",
        "Continuare in caso di stress.",
      ],
      fortschritt: [
        "Il SEDUTO automatico si stabilisce.",
        "Gli incontri in passeggiata sono controllati.",
        "Ti senti competente.",
      ],
      exerciseIds: ["j-spazier-vorbeigaenger", "j-sitz-als-gruess"],
    },
    // Vertiefungen
    {
      title: "Gioco controllato",
      schwerpunkt: "Durante il gioco saltare addosso è spesso permesso (o desiderato). Questa settimana distinguiamo: gioco = si può, saluto = non si può. Segnali chiari.",
      wochenziele: [
        "{dogName} distingue il saltare da gioco dal saltare al saluto.",
        "Segnali chiari per entrambe le modalità.",
        "Il gioco resta permesso, il saltare al saluto viene impedito.",
      ],
      tagesplan: "Prima del gioco: segnale chiaro 'CORRI' o 'GIOCA' — ora si può saltare. Prima del saluto: segnale chiaro 'CALMA' — ora no. Coerenza con entrambi i segnali.",
      no_gos: [
        "Dare i segnali in modo incoerente.",
        "Giocare durante una situazione di saluto.",
        "Aspettarsi che il cane distingua da solo senza segnale.",
      ],
      fortschritt: [
        "{dogName} distingue le modalità.",
        "Il gioco resta permesso.",
        "Hai stabilito segnali chiari.",
      ],
      exerciseIds: ["j-vier-pfoten-belohnen", "j-tuergaeste-routine"],
    },
    {
      title: "Perfezionare la routine del saluto",
      schwerpunkt: "La routine del ritrovo diventa una sequenza fissa. Porta aperta, togliersi le scarpe, saluto calmo. {dogName} sa esattamente cosa succede.",
      wochenziele: [
        "La routine del ritrovo è collaudata.",
        "L'eccitazione al rientro a casa è minima.",
        "Diventi interiormente calmo al rientro a casa.",
      ],
      tagesplan: "A ogni rientro la stessa sequenza: porta aperta, ignora il cane, scarpe via, giacca via. Poi rivolgiti a lui con calma quando ha le quattro zampe a terra. {dogName} impara: questa procedura è lo standard.",
      no_gos: [
        "Discostarsi in modo spontaneo.",
        "Saluto drammatico nello stress della giornata.",
        "Familiari che collaborano ma non con coerenza.",
      ],
      fortschritt: [
        "La routine del ritrovo è lo standard.",
        "Diventi più calmo al rientro a casa.",
        "{dogName} resta rilassato.",
      ],
      exerciseIds: ["j-spazier-vorbeigaenger", "j-sitz-als-gruess"],
    },
    {
      title: "La coperta come ancora nelle situazioni di stress",
      schwerpunkt: "Quando incombono incontri stressanti (più cani, molti ospiti): la coperta è un'ancora. {dogName} può restarci invece di intervenire.",
      wochenziele: [
        "La coperta come ancora nelle situazioni di stress.",
        "{dogName} cerca attivamente la coperta.",
        "Gli incontri stressanti vengono disinnescati.",
      ],
      tagesplan: "In caso di incontro stressante: porta {dogName} attivamente sulla coperta col Kong. Resta lì durante la fase difficile. Ricompensa con un marcatore calmante.",
      no_gos: [
        "Incontri stressanti senza preparazione.",
        "Coperta senza condizionamento positivo precedente.",
        "Costringere {dogName} a restare.",
      ],
      fortschritt: [
        "La coperta come ancora funziona.",
        "Gli incontri stressanti sono disinnescati.",
        "{dogName} si autoregola.",
      ],
      exerciseIds: ["j-tuergaeste-routine", "j-vier-pfoten-belohnen"],
    },
    {
      title: "Consolidamento della progressione",
      schwerpunkt: "Ultima settimana di progressione. Il saltare è nettamente ridotto, le routine di saluto sono solide. Fase 3 = applicazione a lungo termine e stabilizzazione.",
      wochenziele: [
        "Il saltare è nettamente ridotto.",
        "Le routine di saluto scorrono fluide.",
        "Ti senti competente.",
      ],
      tagesplan: "Bilancio: cosa funziona benissimo? Dove ci sono ancora ricadute? Annota per la fase 3 le strategie di mantenimento.",
      no_gos: [
        "Dare i successi per scontati.",
        "Allentare la coerenza.",
        "Lasciar scivolare la coerenza familiare.",
      ],
      fortschritt: [
        "Il saltare è più raro.",
        "Ti senti competente.",
        "Gli strumenti sono solidi.",
      ],
      exerciseIds: ["j-sitz-als-gruess", "j-konsistenz-familie"],
    },
  ],
  generalisierung: [
    {
      title: "Stabilire una routine di mantenimento",
      schwerpunkt: "Il saltare addosso può tornare se la coerenza cala. Routine di mantenimento per i prossimi mesi: 1 volta al giorno esercitare consapevolmente i saluti.",
      wochenziele: [
        "Hai una routine di mantenimento quotidiana.",
        "L'esercizio del ritrovo viene fatto regolarmente.",
        "Riconosci presto i passi indietro.",
      ],
      tagesplan: "Ogni giorno 1 esercizio di saluto consapevole: uscire dalla stanza, rientrare con calma. SEDUTO + carezze + premietto. Se salta: ignora per 30 sec. Mantieni attivo invece di sperare.",
      no_gos: [
        "Lasciar scivolare la routine.",
        "Ignorare i passi indietro.",
        "Allentare la coerenza familiare.",
      ],
      fortschritt: [
        "La routine di mantenimento è stabilita.",
        "I passi indietro vengono riconosciuti presto.",
        "{dogName} resta stabile a lungo termine.",
        "L'accoglienza degli ospiti scorre come una sequenza collaudata, senza dramma.",
      ],
      exerciseIds: ["j-wartungs-routine", "j-tuergaeste-routine"],
    },
    {
      title: "Prove di stress",
      schwerpunkt: "Ogni 2-3 settimane: una prova di stress consapevole con persone nuove. Come reagisce {dogName}? La routine del SEDUTO resta stabile o torna a saltare?",
      wochenziele: [
        "{dogName} supera le prove di stress.",
        "Riconosci presto i punti deboli.",
        "Aggiusti il tiro quando serve.",
      ],
      tagesplan: "Pianifica 1-2 volte al mese una prova di stress: il corriere, un ospite sconosciuto, più persone insieme. Osserva. In caso di saltare: 1 settimana extra coerente.",
      no_gos: [
        "Evitare le prove di stress — la vera reattività resta nascosta.",
        "Ignorare in caso di ricaduta.",
        "Rendere le prove di stress troppo difficili.",
      ],
      fortschritt: [
        "Hai dati sulla solidità.",
        "Le ricadute vengono riconosciute.",
        "Il comportamento di {dogName} è testato e stabile.",
      ],
      exerciseIds: ["j-tuergaeste-routine", "j-sitz-als-gruess"],
    },
    {
      title: "Coerenza familiare a lungo termine",
      schwerpunkt: "La coerenza familiare ha bisogno di un promemoria regolare. Questa settimana rinfreschi le regole, le richiami, fai attenzione a nuove incoerenze.",
      wochenziele: [
        "La famiglia è aggiornata.",
        "Le nuove incoerenze vengono evitate.",
        "Diventi un osservatore più attento.",
      ],
      tagesplan: "Ripeti il briefing familiare. Aggiorna il biglietto all'ingresso. Fai attenzione attiva a nuove incoerenze: un bambino accarezza mentre salta? Un ospite si lascia saltare addosso? Interviene subito.",
      no_gos: [
        "Tollerare familiari che non collaborano.",
        "Dimenticare i briefing.",
        "Tacere davanti all'incoerenza.",
      ],
      fortschritt: [
        "La coerenza familiare resta alta.",
        "Le nuove incoerenze vengono riconosciute presto.",
        "{dogName} resta stabile.",
      ],
      exerciseIds: ["j-konsistenz-familie", "j-vier-pfoten-belohnen"],
    },
    {
      title: "Padroneggiare gli incontri difficili",
      schwerpunkt: "Questa settimana incontri difficili in modo consapevole: persone timorose, bambini, anziani. Coperta + distanza invece di confronto.",
      wochenziele: [
        "Gli incontri difficili vengono pianificati in anticipo.",
        "La coperta resta un'ancora.",
        "Ti senti preparato in modo responsabile.",
      ],
      tagesplan: "In caso di incontri difficili attesi: {dogName} prima sulla coperta. Mantieni la distanza. Se necessario: un'altra stanza. Non forzare MAI.",
      no_gos: [
        "Incontri difficili senza preparazione.",
        "Cogliere di sorpresa bambini o persone timorose.",
        "Lasciare {dogName} libero con persone timorose.",
      ],
      fortschritt: [
        "Gli incontri difficili vengono padroneggiati.",
        "Agisci in modo responsabile.",
        "Le situazioni rischiose vengono evitate.",
      ],
      exerciseIds: ["j-tuergaeste-routine", "j-sitz-als-gruess"],
    },
    {
      title: "Ridurre le ricompense con prudenza",
      schwerpunkt: "Il saluto col SEDUTO diventa così scontato che la densità delle ricompense può essere ridotta. Ma: il rinforzo variabile mantiene il comportamento più stabile.",
      wochenziele: [
        "Frequenza delle ricompense ridotta a ~50%.",
        "{dogName} si siede anche con meno ricompensa.",
        "Le prestazioni eccellenti continuano a essere premiate col MAXI-PREMIO.",
      ],
      tagesplan: "Ai saluti in famiglia: premietto ogni 2-3 volte invece che ogni volta. Con gli ospiti: continua a ricompensare ogni volta. {dogName} capisce: il sistema resta, ma è imprevedibile.",
      no_gos: [
        "Eliminare del tutto la ricompensa.",
        "Ridurre la ricompensa con gli ospiti.",
        "Allentare la variabilità.",
      ],
      fortschritt: [
        "{dogName} si siede anche con meno ricompensa.",
        "Il SEDUTO è automatico.",
        "Ti metti in tasca meno premietti.",
      ],
      exerciseIds: ["j-vier-pfoten-belohnen", "j-konsistenz-familie"],
    },
    {
      title: "Consolidare la routine in passeggiata",
      schwerpunkt: "Il SEDUTO davanti ai passanti diventa lo standard. Non devi più dire attivamente SEDUTO — {dogName} lo offre quando le persone si avvicinano.",
      wochenziele: [
        "{dogName} offre il SEDUTO automaticamente.",
        "I passanti vengono superati con calma.",
        "Le passeggiate risultano controllate.",
      ],
      tagesplan: "In ogni passeggiata osserva attivamente: {dogName} offre il SEDUTO automaticamente? Con SEDUTO automatico: ricompensa SUPER. Se resta in piedi: dai il segnale SEDUTO.",
      no_gos: [
        "Lasciare che i passanti accarezzino il cane mentre è in piedi.",
        "Passeggiate senza osservazione.",
        "Aspettarsi l'automatismo senza ulteriore ricompensa.",
      ],
      fortschritt: [
        "Il SEDUTO automatico è stabilito.",
        "Gli incontri in passeggiata sono calmi.",
        "Ti senti competente.",
      ],
      exerciseIds: ["j-spazier-vorbeigaenger", "j-sitz-als-gruess"],
    },
    {
      title: "Piano d'emergenza per le ricadute",
      schwerpunkt: "Se il saltare torna: una sequenza d'emergenza chiara. 1 settimana extra coerente, briefing familiare, densità delle ricompense di nuovo alta.",
      wochenziele: [
        "Hai un piano d'emergenza.",
        "I passi indietro vengono riconosciuti presto.",
        "Le ricadute vengono recuperate in 1-2 settimane.",
      ],
      tagesplan: "Piano d'emergenza: 1) 1 settimana extra coerente nell'ignorare. 2) Ripeti il briefing familiare. 3) Densità delle ricompense di nuovo alta. 4) Osserva cosa è cambiato.",
      no_gos: [
        "Ignorare i passi indietro.",
        "Farsi prendere dal panico.",
        "Cambiare le routine in modo radicale.",
      ],
      fortschritt: [
        "Il piano d'emergenza è solido.",
        "Le ricadute vengono gestite.",
        "Ti senti competente a lungo termine.",
      ],
      exerciseIds: ["j-vier-pfoten-belohnen", "j-konsistenz-familie"],
    },
    {
      title: "Passaggio alla modalità di mantenimento",
      schwerpunkt: "Ultima settimana. Il saltare è fortemente ridotto, le routine sono solide, la coerenza familiare è stabile. Mantenimento per i mesi a venire.",
      wochenziele: [
        "Tutte le routine funzionano a lungo termine.",
        "Il ritmo di mantenimento è chiaro.",
        "{dogName} è stabile a lungo termine.",
      ],
      tagesplan: "Riduci l'addestramento attivo al minimo. Routine di mantenimento 1 volta al giorno. Briefing familiare ogni 3 mesi. Prove di stress ogni 4-6 settimane. In caso di ricadute: applica il piano d'emergenza.",
      no_gos: [
        "Lasciare di colpo tutte le routine.",
        "Allentare la coerenza familiare.",
        "Lasciar scivolare il mantenimento.",
      ],
      fortschritt: [
        "Il saltare è l'eccezione.",
        "{dogName} resta stabile a lungo termine.",
        "Ti senti competente.",
      ],
      exerciseIds: ["j-wartungs-routine", "j-tuergaeste-routine"],
    },
  ],
};

// ────────────────────────────────────────────────────────────────────
// DESTRUCTIVE (Zerstörungsverhalten) — Ursache + Kau-Objekte + Management
// ────────────────────────────────────────────────────────────────────
const DESTRUCTIVE_WEEKS: Record<Phase, WeekTemplate[]> = {
  fundament: [
    {
      title: "Analisi delle cause: perché {dogName} distrugge?",
      schwerpunkt: "La distruzione ha diverse cause, che richiedono soluzioni diverse. Questa settimana identifichi il motivo principale: noia, ansia da separazione, bisogno di mordere o cambio dei denti.",
      wochenziele: [
        "Conosci il motivo principale della distruzione.",
        "Capisci cosa è un supporto e cosa è un sintomo.",
        "Hai chiaro il punto centrale dell'allenamento.",
      ],
      tagesplan: "Per una settimana documenta: cosa viene distrutto? Quando? Quanti anni ha {dogName}? Quanto è impegnato? Come si comporta quando resta da solo? Identifica come causa principale: noia, ansia da separazione o bisogno di mordere.",
      no_gos: [
        "Iniziare ad allenare senza conoscere la causa.",
        "Confondere le cause.",
        "Combattere i sintomi invece delle cause.",
      ],
      fortschritt: [
        "Conosci la causa.",
        "Sai quale punto centrale allenare.",
        "Sei pronto per un lavoro mirato.",
        "I primi 4-5 oggetti da masticare consentiti sono stati acquistati e messi in rotazione.",
      ],
      exerciseIds: ["d-ursachen-analyse", "d-kauobjekte-etablieren"],
    },
    {
      title: "Introdurre oggetti da masticare consentiti",
      schwerpunkt: "{dogName} ha un bisogno di mordere che deve essere soddisfatto. Invece di reprimerlo, lo incanaliamo verso oggetti CONSENTITI. 4-5 diversi, in rotazione.",
      wochenziele: [
        "Sono disponibili 4-5 diversi oggetti da masticare.",
        "La rotazione è stata avviata.",
        "{dogName} ha una chiara lista di ciò che è consentito.",
      ],
      tagesplan: "Investi in 4-5 oggetti da masticare: articoli da masticare naturali (pelle di bufalo, nervo di bue), Kong, tappetino olfattivo, osso di legno, corno di cervo. Ogni giorno 1-2 diversi, in rotazione. Avvia lunghe sessioni di masticazione.",
      no_gos: [
        "Un solo oggetto da masticare — diventa noioso.",
        "Tutti gli oggetti disponibili contemporaneamente — nessuna attesa.",
        "Ossa da masticare economiche (pelle grezza) — rischio di lesioni.",
      ],
      fortschritt: [
        "{dogName} ha i suoi oggetti da masticare preferiti.",
        "Il bisogno di mordere è incanalato.",
        "La distruzione si riduce.",
        "Sono state allestite zone di gestione sicure per l'assenza.",
      ],
      exerciseIds: ["d-langeweile-auslasten", "d-management-zonen"],
    },
    {
      title: "Allestire zone di gestione",
      schwerpunkt: "Finché l'allenamento non è consolidato, aiuta la gestione. {dogName} non ha la possibilità di distruggere scarpe o mobili — perché non sono raggiungibili.",
      wochenziele: [
        "Le zone sicure sono allestite.",
        "Le aree a rischio sono bloccate.",
        "Durante l'assenza {dogName} non si trova nelle zone a rischio.",
      ],
      tagesplan: "Identifica le zone a rischio. Durante l'assenza o quando non è sorvegliato: {dogName} in una zona sicura (box, cucina con cancelletto). In questa zona: oggetti da masticare consentiti + acqua. MAI come punizione.",
      no_gos: [
        "Usare la zona sicura come una prigione.",
        "Lasciare aperte le zone a rischio per comodità.",
        "Lasciare libero il cane quando il rischio è incalcolabile.",
      ],
      fortschritt: [
        "La zona sicura è avviata.",
        "La distruzione viene evitata.",
        "Agisci in modo responsabile.",
      ],
      exerciseIds: ["d-ursachen-analyse", "d-kauobjekte-etablieren"],
    },
    {
      title: "Introdurre lo scambio invece della punizione",
      schwerpunkt: "Quando {dogName} ha un oggetto proibito: lo scambio è la reazione giusta, non la punizione. Avvicinati con calma, offri un premietto, scambia.",
      wochenziele: [
        "Lo scambio è la reazione standard a un oggetto proibito.",
        "Le escalation di conflitto vengono evitate.",
        "Diventi interiormente più calmo.",
      ],
      tagesplan: "{dogName} ha un oggetto proibito: NON urlare, NON rincorrerlo. Avvicinati con calma, LASCIA, un premietto di alto valore. Scambia. Offri un oggetto da masticare consentito. MAI restituire l'oggetto proibito.",
      no_gos: [
        "Sgridare — controproducente.",
        "Rincorrere — rinforza il gioco.",
        "Restituire l'oggetto proibito.",
      ],
      fortschritt: [
        "{dogName} cede spontaneamente gli oggetti proibiti.",
        "Diventi interiormente più calmo.",
        "I conflitti vengono evitati.",
      ],
      exerciseIds: ["d-tausch-statt-strafe", "d-management-zonen"],
    },
    // 6-Monats-Vertiefungen
    {
      title: "Raddoppiare l'attività",
      schwerpunkt: "Se la causa è la noia (spesso nei cani giovani): un mix di attività. Movimento + lavoro mentale + lavoro olfattivo, non solo movimento.",
      wochenziele: [
        "È pronto un piano giornaliero con attività variate.",
        "Almeno 3 tipi di attività al giorno.",
        "La sera {dogName} è stanco, non agitato.",
      ],
      tagesplan: "Ogni giorno: 1 passeggiata (30-60 min con cambi di ritmo), 1 lavoro olfattivo (gioco di ricerca), 1 lavoro mentale (trick, Kong). Se giovane: meno agitazione fine a se stessa, più lavoro mentale. Se adulto: più ricerca su traccia.",
      no_gos: [
        "Solo movimento come attività — porta a sovraeccitazione.",
        "Ore di sfrenatezza — controproducente.",
        "Considerare lavoro olfattivo/mentale come 'facoltativi'.",
      ],
      fortschritt: [
        "La sera {dogName} è tranquillo.",
        "La distruzione si riduce in modo misurabile.",
        "Hai una routine di attività.",
        "Quando noti oggetti proibiti reagisci con uno scambio tranquillo invece che con il conflitto.",
      ],
      exerciseIds: ["d-langeweile-auslasten", "d-ursachen-analyse"],
    },
    {
      title: "Lunghe fasi di riposo sdraiato",
      schwerpunkt: "A volte la distruzione nasce dall'incapacità di stare fermi. {dogName} deve imparare a mantenere attivamente lunghe fasi di riposo — anche quando non succede nulla.",
      wochenziele: [
        "{dogName} resta 30-60 min rilassato sulla coperta.",
        "Lo stare fermo viene allenato.",
        "Imparare a stare da solo con se stesso.",
      ],
      tagesplan: "Ogni giorno 1-2 sessioni sulla coperta: 30-60 min sulla coperta, tu lavori accanto. {dogName} non può alzarsi, riceve un Kong come attività. Ricompensa quando resta sdraiato tranquillo.",
      no_gos: [
        "Stimolare continuamente {dogName} durante la sessione sulla coperta.",
        "Usare la coperta senza un precedente condizionamento.",
        "Sessioni troppo brevi — non hanno effetto.",
      ],
      fortschritt: [
        "{dogName} resta tranquillo più a lungo.",
        "Lo stare fermo diventa naturale.",
        "La distruzione dovuta alla noia si riduce.",
      ],
      exerciseIds: ["d-management-zonen", "d-allein-zeit-kong"],
    },
    {
      title: "Kong per i momenti da solo nei casi di ansia da separazione",
      schwerpunkt: "Se l'ansia da separazione è una concausa: un Kong ben riempito prima di ogni assenza. 30 min di attività coprono la fase critica.",
      wochenziele: [
        "{dogName} inizia l'attività con il Kong quando esci.",
        "La distruzione durante i momenti da solo si riduce.",
        "Associazione positiva assenza-Kong.",
      ],
      tagesplan: "Prima di ogni assenza: un Kong ben riempito (congelato = più difficile). Esci senza drammi. Togli il Kong al rientro. Variante: tappetino olfattivo con cibo secco.",
      no_gos: [
        "Dare il Kong anche in tua presenza.",
        "Kong non congelato — finisce troppo in fretta.",
        "Congedo/accoglienza drammatici.",
      ],
      fortschritt: [
        "La distruzione durante i momenti da solo si riduce.",
        "L'associazione positiva è consolidata.",
        "Ti senti più rilassato quando esci.",
      ],
      exerciseIds: ["d-ursachen-analyse", "d-kauobjekte-etablieren"],
    },
    {
      title: "Verifica delle fondamenta",
      schwerpunkt: "Ultima settimana delle fondamenta. Causa chiara, oggetti da masticare avviati, zone di gestione sicure, routine dello scambio consolidata. Fase 2 = più attività e più routine.",
      wochenziele: [
        "Tutti i tasselli sono al loro posto.",
        "La distruzione è ridotta in modo misurabile.",
        "Ti senti competente.",
      ],
      tagesplan: "Bilancio: cosa funziona alla grande, cosa vacilla? Se c'è una debolezza: 1 settimana extra. Fase 2 = ancora più attività e consolidamento delle routine.",
      no_gos: [
        "Saltare alla Fase 2 per impazienza.",
        "Ignorare le debolezze.",
        "Allentare la gestione.",
      ],
      fortschritt: [
        "Ti senti competente.",
        "Gli strumenti sono al loro posto.",
        "La distruzione è più rara.",
      ],
      exerciseIds: ["d-management-zonen", "d-tausch-statt-strafe"],
    },
  ],
  steigerung: [
    {
      title: "Implementare il piano delle attività",
      schwerpunkt: "Un piano giornaliero strutturato con attività variate diventa una routine. Movimento + lavoro olfattivo + lavoro mentale + riposo in una chiara distribuzione.",
      wochenziele: [
        "Il piano delle attività è messo per iscritto.",
        "Il piano viene attuato ogni giorno.",
        "{dogName} è più equilibrato.",
      ],
      tagesplan: "Scrivi un piano di 7 giorni: ogni giorno 1 movimento, 1 lavoro olfattivo, 1 lavoro mentale. Più attività nei giorni problematici. Igiene del sonno 16-20h. Contatto sociale 2-3 volte a settimana.",
      no_gos: [
        "Piano non messo per iscritto — viene dimenticato.",
        "Fare diversamente nei fine settimana.",
        "Tralasciare l'attività quando si ha fretta.",
      ],
      fortschritt: [
        "{dogName} è più equilibrato.",
        "La distruzione si riduce ulteriormente.",
        "Pianifichi in modo strutturato.",
      ],
      exerciseIds: ["d-langeweile-auslasten", "d-kauobjekte-etablieren"],
    },
    {
      title: "Perfezionare la rotazione degli oggetti da masticare",
      schwerpunkt: "La rotazione degli oggetti da masticare diventa una routine quotidiana. {dogName} è sempre impegnato, il bisogno di mordere sempre soddisfatto.",
      wochenziele: [
        "La rotazione degli oggetti da masticare procede in automatico.",
        "{dogName} ha sempre a disposizione un oggetto da masticare preferito.",
        "Il bisogno di mordere è soddisfatto.",
      ],
      tagesplan: "Ogni giorno 1-2 oggetti da masticare disponibili, a rotazione. Ogni settimana prova 1 nuovo oggetto. Avvia consapevolmente lunghe sessioni di masticazione (15-30 min) — preparazione al sonno.",
      no_gos: [
        "Dimenticare la rotazione.",
        "Oggetti da masticare di scarsa qualità.",
        "Considerare le lunghe sessioni come 'tempo sprecato'.",
      ],
      fortschritt: [
        "{dogName} ha il suo assortimento preferito.",
        "Il bisogno di mordere è coperto.",
        "La distruzione dei mobili si riduce.",
      ],
      exerciseIds: ["d-ursachen-analyse", "d-management-zonen"],
    },
    {
      title: "Ridurre lentamente la gestione",
      schwerpunkt: "Quando per 4 settimane non avviene alcuna distruzione: riduci con cautela la gestione. Prima 1 zona a rischio, osserva, poi la successiva.",
      wochenziele: [
        "Una zona a rischio torna accessibile.",
        "{dogName} dà buona prova di sé oppure aggiusti il tiro.",
        "Riconosci dove la gestione resta necessaria.",
      ],
      tagesplan: "Giorno 1-2: 1 zona prima bloccata torna accessibile (solo in tua presenza). Osserva. Giorno 3-4: in caso di successo 1-2 ore con accesso. Giorno 5-7: in caso di successo anche più a lungo.",
      no_gos: [
        "Aprire subito tutte le zone a rischio.",
        "Proseguire in caso di distruzione.",
        "Abbandonare del tutto la gestione.",
      ],
      fortschritt: [
        "Le zone sicure si ampliano.",
        "{dogName} dà buona prova di sé.",
        "La quotidianità diventa più flessibile.",
      ],
      exerciseIds: ["d-langeweile-auslasten", "d-kauobjekte-etablieren"],
    },
    {
      title: "Perfezionare la routine dello scambio",
      schwerpunkt: "Lo scambio funziona ormai in automatico. {dogName} cede spontaneamente gli oggetti proibiti. Reagisci con calma e rilassato.",
      wochenziele: [
        "Lo scambio riesce in modo affidabile al 90%+.",
        "Reagisci con calma agli oggetti proibiti.",
        "Le escalation di conflitto sono eliminate.",
      ],
      tagesplan: "Quando noti un oggetto proibito: avvicinati con calma, LASCIA, premietto, scambia. Nessun dramma. La routine diventa una reazione riflessa.",
      no_gos: [
        "Sgridare per frustrazione.",
        "Restituire l'oggetto proibito.",
        "Infilare la mano nella bocca.",
      ],
      fortschritt: [
        "Lo scambio riesce in modo riflesso.",
        "Diventi interiormente calmo.",
        "I conflitti sono rari.",
      ],
      exerciseIds: ["d-tausch-statt-strafe", "d-ursachen-analyse"],
    },
    // Vertiefungen
    {
      title: "Intensificare l'attività mentale",
      schwerpunkt: "Nei cani giovani con il cambio dei denti: intensifica le sessioni di masticazione. Negli adulti: più lavoro mentale (shaping, trick, nuovi compiti).",
      wochenziele: [
        "Più sessioni intense di masticazione al giorno.",
        "Vengono imparati nuovi trick con lo shaping.",
        "L'attività mentale è elevata.",
      ],
      tagesplan: "Nei cuccioli/giovani cani: lunghe sessioni di masticazione con articoli da masticare naturali 2 volte al giorno. Negli adulti: 10 min di allenamento a forma libera con un nuovo trick al giorno. Obiettivo: stanchezza mentale.",
      no_gos: [
        "Rendere troppo brevi le sessioni di masticazione.",
        "Allenamento a forma libera nelle fasi di stress.",
        "Considerare l'attività mentale come 'facoltativa'.",
      ],
      fortschritt: [
        "{dogName} è mentalmente impegnato.",
        "La distruzione si riduce ulteriormente.",
        "Riconosci le fasi di stanchezza.",
      ],
      exerciseIds: ["d-langeweile-auslasten", "d-kauobjekte-etablieren"],
    },
    {
      title: "Ridurre i fattori di stress",
      schwerpunkt: "La distruzione può essere un sintomo di stress. Identifica i fattori di stress e riducili attivamente: troppo poco sonno, sovraccarico di stimoli, routine poco chiare.",
      wochenziele: [
        "I fattori di stress sono identificati e ridotti.",
        "{dogName} dorme a sufficienza (16-20h).",
        "Il sovraccarico di stimoli viene evitato.",
      ],
      tagesplan: "Controlla la giornata: dorme abbastanza? Routine prevedibili? Sovraccarico di stimoli nei fine settimana? Cambiamenti recenti (trasloco, nuovo coinquilino)? Riduci attivamente.",
      no_gos: [
        "Ignorare lo stress.",
        "Stimolare continuamente il cane.",
        "Introdurre i cambiamenti in modo radicale.",
      ],
      fortschritt: [
        "Il livello di stress diminuisce.",
        "La distruzione si riduce ulteriormente.",
        "Diventi più attento ai segnali di stress.",
      ],
      exerciseIds: ["d-ursachen-analyse", "d-management-zonen"],
    },
    {
      title: "Consolidare la routine dei momenti da solo",
      schwerpunkt: "La routine del Kong per i momenti da solo viene consolidata sul lungo periodo. {dogName} associa l'assenza a uno snack positivo, non alla distruzione.",
      wochenziele: [
        "La routine dei momenti da solo è stabile.",
        "Il Kong viene dato prima di ogni assenza.",
        "La distruzione durante l'assenza è eliminata.",
      ],
      tagesplan: "A ogni assenza un Kong. Varia il contenuto. Congelato = più difficile. Esci con calma, rientra con calma. Nel frattempo {dogName} resta impegnato.",
      no_gos: [
        "Dimenticare il Kong — momenti da solo senza attività.",
        "Contenuto sempre uguale — diventa noioso.",
        "Dramma al momento del congedo.",
      ],
      fortschritt: [
        "I momenti da solo sono sicuri.",
        "La routine del Kong è solida.",
        "Ti senti più rilassato quando esci.",
      ],
      exerciseIds: ["d-allein-zeit-kong", "d-kauobjekte-etablieren"],
    },
    {
      title: "Consolidamento della fase di potenziamento",
      schwerpunkt: "Ultima settimana di potenziamento. L'attività è consolidata, la routine della masticazione avviata, la gestione allentata. Fase 3 = mantenimento a lungo termine.",
      wochenziele: [
        "Tutti gli strumenti funzionano in modo fluido.",
        "La distruzione è nettamente ridotta.",
        "Ti senti competente.",
      ],
      tagesplan: "Settimana di bilancio: cosa funziona alla grande, cosa vacilla? Pianifica la Fase 3: routine di mantenimento, igiene dello stress, continuare con il piano delle attività.",
      no_gos: [
        "Dare i successi per scontati.",
        "Abbandonare del tutto la gestione.",
        "Allentare il piano delle attività.",
      ],
      fortschritt: [
        "La distruzione è ridotta in modo misurabile.",
        "Ti senti competente.",
        "Gli strumenti sono al loro posto.",
      ],
      exerciseIds: ["d-langeweile-auslasten", "d-ursachen-analyse"],
    },
  ],
  generalisierung: [
    {
      title: "Piano delle attività a lungo termine",
      schwerpunkt: "Il piano delle attività viene consolidato sul lungo periodo. Ogni giorno attività variate, più giorni di mantenimento con un rinfresco.",
      wochenziele: [
        "Il piano procede sul lungo termine.",
        "I giorni di mantenimento sono pianificati.",
        "{dogName} resta equilibrato a lungo termine.",
      ],
      tagesplan: "Ogni giorno attività standard (movimento + olfatto + mente). 1 volta a settimana un 'giorno speciale' con un nuovo trick o una nuova attività. Mantieni costante l'igiene del sonno.",
      no_gos: [
        "Allentare il piano.",
        "Dimenticare i giorni speciali.",
        "Ignorare l'igiene del sonno.",
      ],
      fortschritt: [
        "Il piano è consolidato sul lungo termine.",
        "{dogName} resta equilibrato.",
        "Pianifichi in modo strutturato.",
        "Prima di ogni assenza c'è un Kong ben riempito come associazione positiva ai momenti da solo.",
      ],
      exerciseIds: ["d-langeweile-auslasten", "d-allein-zeit-kong"],
    },
    {
      title: "Manutenzione degli oggetti da masticare",
      schwerpunkt: "L'assortimento di oggetti da masticare viene curato: sostituire i vecchi, provarne di nuovi, mantenere la rotazione. Il bisogno di mordere resta soddisfatto.",
      wochenziele: [
        "L'assortimento è aggiornato.",
        "{dogName} ha sempre le sue opzioni preferite.",
        "Il bisogno di mordere resta coperto.",
      ],
      tagesplan: "Controlla ogni settimana: quali oggetti vengono ancora usati volentieri? Quali sono rotti o consumati? Sostituiscili. Ogni 4-6 settimane prova 1 nuovo oggetto.",
      no_gos: [
        "Lasciare invecchiare l'assortimento.",
        "Continuare a usare oggetti difettosi.",
        "Non prevedere alcuna varietà.",
      ],
      fortschritt: [
        "L'assortimento è aggiornato.",
        "Il bisogno di mordere resta coperto.",
        "{dogName} ha sempre qualcosa.",
      ],
      exerciseIds: ["d-kauobjekte-etablieren", "d-management-zonen"],
    },
    {
      title: "Trovare l'equilibrio nella gestione",
      schwerpunkt: "Equilibrio di gestione a lungo termine: cosa deve restare chiuso, cosa può stare aperto? Il comportamento di {dogName} te lo mostra.",
      wochenziele: [
        "Conosci l'equilibrio di gestione ideale.",
        "Le zone sicure sono chiaramente definite.",
        "Le aree a rischio vengono gestite con intelligenza.",
      ],
      tagesplan: "Verifica: quali zone possono restare aperte in modo permanente? Quali vanno bloccate durante l'assenza? Quali sono generalmente off-limits? Mettilo per iscritto.",
      no_gos: [
        "Tralasciare del tutto la gestione.",
        "Sottovalutare le aree a rischio.",
        "Confrontarsi con altri cani.",
      ],
      fortschritt: [
        "Hai una chiara strategia di gestione.",
        "Il rischio è ridotto al minimo.",
        "La quotidianità procede rilassata.",
      ],
      exerciseIds: ["d-ursachen-analyse", "d-tausch-statt-strafe"],
    },
    {
      title: "Affrontare le fasi difficili",
      schwerpunkt: "I periodi di forte stress (Natale, vacanze, nuovi coinquilini) sono un rischio di ricadute nella distruzione. Questa settimana pianifichi per le fasi difficili.",
      wochenziele: [
        "Hai delle strategie per le fasi difficili.",
        "Le fasi a rischio sono pianificate in anticipo.",
        "Ti senti preparato.",
      ],
      tagesplan: "Identifica le prossime fasi di stress. Pianifica in anticipo: più gestione, più attività, più oggetti da masticare. In caso di cambiamenti: introducili gradualmente.",
      no_gos: [
        "Ignorare le fasi difficili.",
        "Cambiamenti improvvisi.",
        "Allentare la routine sotto stress.",
      ],
      fortschritt: [
        "Le fasi difficili vengono affrontate con successo.",
        "Pianifichi in modo lungimirante.",
        "{dogName} resta stabile.",
      ],
      exerciseIds: ["d-management-zonen", "d-langeweile-auslasten"],
    },
    {
      title: "Equilibrio tra socialità e momenti da solo",
      schwerpunkt: "I cani con distruzione legata all'ansia da separazione traggono beneficio da sufficienti contatti sociali. Ma: anche i momenti da solo devono continuare a essere esercitati.",
      wochenziele: [
        "Appuntamenti sociali 2-3 volte a settimana.",
        "La routine dei momenti da solo resta consolidata.",
        "L'equilibrio tra socialità e solitudine è buono.",
      ],
      tagesplan: "Ogni settimana 2-3 appuntamenti sociali (un amico a quattro zampe). La routine dei momenti da solo resta: Kong prima dell'assenza. Mantieni l'equilibrio — né tutto socialità né tutto solitudine.",
      no_gos: [
        "Solo contatto sociale — la routine dei momenti da solo va persa.",
        "Solo momenti da solo — l'ansia da separazione peggiora.",
        "Fasi molto sociali senza un momento per calmarsi.",
      ],
      fortschritt: [
        "L'equilibrio è consolidato.",
        "{dogName} è socievole e indipendente.",
        "Pianifichi in modo strutturato.",
      ],
      exerciseIds: ["d-allein-zeit-kong", "d-kauobjekte-etablieren"],
    },
    {
      title: "Consolidare la routine dello scambio nella quotidianità",
      schwerpunkt: "La routine dello scambio resta importante a lungo termine. Anche dopo mesi senza incidenti: resta attento, reagisci con calma davanti agli oggetti proibiti.",
      wochenziele: [
        "Lo scambio resta un riflesso.",
        "Davanti agli oggetti proibiti reagisci con calma.",
        "Le escalation di conflitto sono eliminate.",
      ],
      tagesplan: "Nelle rare situazioni con un oggetto proibito: avvicinati con calma, LASCIA, premietto, scambia. Resta nella routine, anche se {dogName} è per lo più bravo.",
      no_gos: [
        "Reagire in modo eccessivo nei rari incidenti.",
        "Perdere la routine dello scambio.",
        "Infilare la mano nella bocca.",
      ],
      fortschritt: [
        "La routine dello scambio resta solida.",
        "Diventi interiormente calmo.",
        "I conflitti sono eliminati.",
      ],
      exerciseIds: ["d-tausch-statt-strafe", "d-ursachen-analyse"],
    },
    {
      title: "Piano d'emergenza in caso di ricadute",
      schwerpunkt: "Se la distruzione torna: una chiara sequenza d'emergenza. Verifica delle cause, gestione di nuovo più stretta, aumento dell'attività.",
      wochenziele: [
        "Hai un piano d'emergenza.",
        "Le ricadute vengono riconosciute presto.",
        "Recuperate in 1-2 settimane.",
      ],
      tagesplan: "Piano d'emergenza: 1) Verifica delle cause (cosa è cambiato?). 2) Gestione di nuovo più stretta. 3) Aumenta l'attività. 4) Rinfresca l'assortimento da masticare. 5) Riduci i fattori di stress.",
      no_gos: [
        "Ignorare le ricadute.",
        "Farsi prendere dal panico.",
        "Reagire con la punizione.",
      ],
      fortschritt: [
        "Il piano d'emergenza è al suo posto.",
        "Le ricadute vengono gestite.",
        "Ti senti competente.",
      ],
      exerciseIds: ["d-langeweile-auslasten", "d-management-zonen"],
    },
    {
      title: "Passaggio alla modalità di mantenimento",
      schwerpunkt: "Ultima settimana. La distruzione è fortemente ridotta, le routine sono consolidate, l'attività è avviata. Mantenimento per i mesi a venire.",
      wochenziele: [
        "Tutte le routine procedono sul lungo termine.",
        "Il ritmo di mantenimento è chiaro.",
        "{dogName} è equilibrato a lungo termine.",
      ],
      tagesplan: "Riduci l'allenamento attivo al minimo. Il piano delle attività resta. La routine della masticazione resta. La gestione resta a seconda della situazione. Ogni 4-6 settimane un rinfresco.",
      no_gos: [
        "Abbandonare di colpo tutte le routine.",
        "Abbandonare del tutto la gestione.",
        "Lasciar scivolare l'attività.",
      ],
      fortschritt: [
        "{dogName} resta stabile a lungo termine.",
        "La distruzione è un'eccezione.",
        "Ti senti competente.",
      ],
      exerciseIds: ["d-ursachen-analyse", "d-kauobjekte-etablieren"],
    },
  ],
};

// ────────────────────────────────────────────────────────────────────
// SOILING (Stubenunreinheit) — Routine + Belohnen am Platz
// ────────────────────────────────────────────────────────────────────
const SOILING_WEEKS: Record<Phase, WeekTemplate[]> = {
  fundament: [
    {
      title: "Stabilire la routine della toilette",
      schwerpunkt: "La pulizia in casa si costruisce con le routine. {dogName} deve sapere: adesso è il momento della toilette, questo è il posto. La prevedibilità accelera enormemente l'apprendimento.",
      wochenziele: [
        "Almeno 5-7 uscite per i bisogni al giorno.",
        "La routine è prevedibile.",
        "Hai un diario della toilette.",
      ],
      tagesplan: "Almeno 5-7 uscite per i bisogni al giorno: al mattino, dopo i pasti, dopo il sonno, la sera, prima di dormire. Con cani giovani o non ancora puliti: ogni 1-2 ore. Sempre nello stesso posto. Annota quando succede cosa.",
      no_gos: [
        "Mantenere la routine in modo incostante.",
        "Saltarla per fretta.",
        "Usare posti diversi come toilette.",
      ],
      fortschritt: [
        "La routine è stabilita.",
        "Conosci gli schemi di {dogName}.",
        "I primi miglioramenti sono visibili.",
      ],
      exerciseIds: ["s-toiletten-routine", "s-belohnen-am-platz"],
    },
    {
      title: "Ricompensare nel posto giusto",
      schwerpunkt: "La ricompensa deve arrivare DIRETTAMENTE nel posto giusto e SUBITO dopo che ha finito. Il tempismo è tutto: un ritardo di 5+ secondi non serve a niente.",
      wochenziele: [
        "La ricompensa arriva tempestivamente nel posto della toilette.",
        "{dogName} associa il posto alla ricompensa.",
        "Hai sempre i premietti con te.",
      ],
      tagesplan: "A ogni uscita per i bisogni porta i premietti. Quando {dogName} fa i bisogni: MENTRE li fa dì piano BRAVO. Appena ha finito: subito premietto direttamente nel posto. Parola di lode più premietto. Associazione diretta.",
      no_gos: [
        "Ricompensare solo a casa: troppo tardi.",
        "Crocchette: valore troppo basso.",
        "Ricompensa senza il marcatore BRAVO.",
      ],
      fortschritt: [
        "{dogName} cerca attivamente il posto della toilette.",
        "L'associazione posto-ricompensa è consolidata.",
        "Hai sempre i premietti con te.",
      ],
      exerciseIds: ["s-unfaelle-managen", "s-trigger-lesen"],
    },
    {
      title: "Imparare a leggere i segnali",
      schwerpunkt: "Se riconosci PRESTO lo stimolo dei bisogni, puoi uscire in tempo. Annusare il pavimento, girare in tondo, diventare improvvisamente irrequieto: questi sono i segnali.",
      wochenziele: [
        "Riconosci i segnali di {dogName}.",
        "Il tempo di reazione è sotto i 30 secondi.",
        "Gli incidenti in casa si riducono.",
      ],
      tagesplan: "Osserva attivamente: annusare il pavimento, girare in tondo, alzarsi all'improvviso, guardare verso la porta. Appena ne vedi uno: SUBITO fuori, NESSUN ritardo. Portalo nel posto abituale.",
      no_gos: [
        "Ignorare i segnali.",
        "Mettersi prima le scarpe con un lungo ritardo.",
        "Portare fuori {dogName} 'più tardi'.",
      ],
      fortschritt: [
        "Riconosci i segnali con sicurezza.",
        "Il tempo di reazione è breve.",
        "Gli incidenti diventano più rari.",
      ],
      exerciseIds: ["s-stress-reduktion", "s-toiletten-routine"],
    },
    {
      title: "Gestire gli incidenti senza punizione",
      schwerpunkt: "Gli incidenti fanno parte del processo di apprendimento. Chi sgrida peggiora tutto: la volta dopo {dogName} si nasconde. Pulire bene + detergente enzimatico + pazienza.",
      wochenziele: [
        "Di fronte agli incidenti reagisci con calma.",
        "Il detergente enzimatico è disponibile.",
        "{dogName} non sviluppa comportamenti di nascondersi.",
      ],
      tagesplan: "In caso di incidente: pulisci con calma con un detergente enzimatico (negozio per animali). NESSUNA sgridata, NESSUN muso spinto sul pavimento. Porta fuori {dogName}, forse arriva ancora qualcosa. Annota l'episodio: quando, cosa?",
      no_gos: [
        "Sgridare o punire: controproducente.",
        "Detergente normale senza enzimi: l'odore resta per il cane.",
        "Lasciare il cane lì mentre pulisci: aumenta lo stress.",
      ],
      fortschritt: [
        "Reagisci con calma.",
        "La pulizia è accurata.",
        "{dogName} non si nasconde.",
      ],
      exerciseIds: ["s-unfaelle-managen", "s-belohnen-am-platz"],
    },
    // 6-Monats-Vertiefungen
    {
      title: "Uscite per i bisogni più frequenti",
      schwerpunkt: "Se gli incidenti sono frequenti: uscite più ravvicinate. Con cani giovani ogni 1-2 ore, con cani più anziani non ancora puliti ogni 2-3 ore. Prevenzione invece di reazione.",
      wochenziele: [
        "Uscite per i bisogni con la frequenza giusta.",
        "Gli incidenti si riducono in modo misurabile.",
        "Individui la frequenza ottimale.",
      ],
      tagesplan: "Con cuccioli giovani (8-16 settimane): fuori ogni 1-2 ore. Con cani più anziani non ancora puliti: ogni 2-3 ore. Riduci la frequenza nel corso delle settimane se non ci sono incidenti. In caso di incidente: torna a uscite più ravvicinate.",
      no_gos: [
        "Ridurre la frequenza troppo in fretta.",
        "Saltare le uscite per fretta.",
        "Aspettarsi che 'funzioni da solo'.",
      ],
      fortschritt: [
        "La frequenza ottimale è trovata.",
        "Gli incidenti diventano rari.",
        "{dogName} sviluppa la vescica.",
      ],
      exerciseIds: ["s-toiletten-routine", "s-trigger-lesen"],
    },
    {
      title: "Ridurre lo stress in caso di soiling da stress",
      schwerpunkt: "Alcuni cani sporcano in casa sotto stress: temporali, persone nuove, cambiamenti. Soluzione: ridurre attivamente lo stress.",
      wochenziele: [
        "I fattori di stress sono identificati.",
        "Lo stress viene ridotto attivamente.",
        "Il soiling da stress si riduce.",
      ],
      tagesplan: "Individua: cosa stressa {dogName}? Temporali? Persone nuove? Cambiamenti? Riduci attivamente. Prima di uno stress previsto: un'uscita per i bisogni in più. Durante lo stress: resta calmo.",
      no_gos: [
        "Ignorare lo stress.",
        "'Combattere' il soiling da stress come comportamento: è un sintomo.",
        "Dimenticare il controllo dal veterinario in caso di soiling da stress.",
      ],
      fortschritt: [
        "I fattori di stress sono ridotti.",
        "{dogName} è più tranquillo.",
        "Il soiling da stress si riduce.",
      ],
      exerciseIds: ["s-stress-reduktion", "s-belohnen-am-platz"],
    },
    {
      title: "Costruire la pulizia notturna",
      schwerpunkt: "I cuccioli e i cani non ancora puliti hanno spesso bisogno di un'uscita notturna. Questa settimana costruisci la routine notturna.",
      wochenziele: [
        "La routine notturna è stabilita.",
        "Gli incidenti notturni si riducono.",
        "La vescica diventa piano piano più forte.",
      ],
      tagesplan: "Ultima uscita per i bisogni subito prima di dormire. Con cuccioli giovani (8-16 settimane): un'uscita di notte. Con cani più anziani non ancora puliti: all'inizio ogni 4-5 ore, poi riduci. Uscita notturna: tranquilla, niente gioco.",
      no_gos: [
        "Dimenticare la routine notturna.",
        "Sgridare in caso di incidente notturno.",
        "Aspettarsi fasi troppo lunghe.",
      ],
      fortschritt: [
        "La routine notturna è ben rodata.",
        "La vescica diventa più forte.",
        "Gli incidenti notturni si riducono.",
      ],
      exerciseIds: ["s-nächtliche-blase", "s-toiletten-routine"],
    },
    {
      title: "Verifica delle fondamenta",
      schwerpunkt: "Ultima settimana delle fondamenta. Routine, ricompensa, lettura dei segnali, gestione degli incidenti: tutti i tasselli. Fase 2 = più generalizzazione e consolidamento.",
      wochenziele: [
        "Tutti i tasselli sono a posto.",
        "Gli incidenti sono nettamente ridotti.",
        "Ti senti competente.",
      ],
      tagesplan: "Bilancio: cosa funziona alla grande, cosa traballa? Se c'è una debolezza: 1 settimana in più. In caso di incidenti frequenti: controllo dal veterinario (escludere cistite ecc.).",
      no_gos: [
        "Andare avanti troppo in fretta per impazienza.",
        "Ignorare le cause mediche.",
        "Allentare la routine.",
      ],
      fortschritt: [
        "Ti senti competente.",
        "La routine è a posto.",
        "Gli incidenti sono più rari.",
      ],
      exerciseIds: ["s-trigger-lesen", "s-belohnen-am-platz"],
    },
  ],
  steigerung: [
    {
      title: "Ridurre la frequenza in caso di successo",
      schwerpunkt: "Quando gli incidenti diventano più rari, riduci lentamente la frequenza delle uscite. {dogName} sviluppa vescica e controllo.",
      wochenziele: [
        "La frequenza delle uscite viene ridotta lentamente.",
        "{dogName} sviluppa vescica e controllo.",
        "Hai una routine sostenibile.",
      ],
      tagesplan: "Giorno 1-3: togli 1 uscita per i bisogni al giorno (ad es. quella in più della mattina). Giorno 4-7: se va bene, togline un'altra. In caso di incidente: torna a una frequenza più ravvicinata.",
      no_gos: [
        "Togliere più uscite contemporaneamente.",
        "Insistere in caso di incidente.",
        "Aspettarsi che la riduzione funzioni subito.",
      ],
      fortschritt: [
        "La frequenza viene ridotta.",
        "La vescica diventa più forte.",
        "La quotidianità diventa più flessibile.",
      ],
      exerciseIds: ["s-toiletten-routine", "s-belohnen-am-platz"],
    },
    {
      title: "Perfezionare la lettura dei segnali",
      schwerpunkt: "La lettura dei segnali diventa una reazione riflessa. Riconosci con sicurezza anche i segnali sottili. Il tempo di reazione è sotto i 10 secondi.",
      wochenziele: [
        "La lettura dei segnali è istintiva.",
        "Il tempo di reazione è molto breve.",
        "Gli incidenti vengono evitati.",
      ],
      tagesplan: "Osservazione attiva mentre {dogName} è sveglio. Riconosci anche i segnali sottili: diventare irrequieto un attimo, annusare un attimo, distogliere lo sguardo un attimo. Agisci subito.",
      no_gos: [
        "Sottovalutare i segnali.",
        "Ignorare i segnali per fretta.",
        "Non tenere d'occhio {dogName}.",
      ],
      fortschritt: [
        "La lettura dei segnali è istintiva.",
        "Gli incidenti vengono eliminati.",
        "Sei attento.",
      ],
      exerciseIds: ["s-trigger-lesen", "s-unfaelle-managen"],
    },
    {
      title: "Ridurre gradualmente la ricompensa",
      schwerpunkt: "Quando la pulizia in casa è consolidata, puoi ridurre lentamente la ricompensa. Ma: MAI eliminarla del tutto. Il rinforzo variabile mantiene stabile il comportamento.",
      wochenziele: [
        "La frequenza della ricompensa viene ridotta a circa il 60%.",
        "{dogName} resta affidabile.",
        "Le prestazioni eccellenti continuano a essere premiate con un MAXI-PREMIO.",
      ],
      tagesplan: "Alle uscite normali: non ogni volta un premietto. In caso di successi speciali (in un posto nuovo, dopo tanto tempo): MAXI-PREMIO. {dogName} nota: il sistema resta, ma è imprevedibile.",
      no_gos: [
        "Eliminare del tutto la ricompensa.",
        "Ridurla in caso di incidenti frequenti.",
        "Allentare la variabilità.",
      ],
      fortschritt: [
        "{dogName} resta affidabile.",
        "Metti in tasca meno premietti.",
        "Il rinforzo variabile è consolidato.",
      ],
      exerciseIds: ["s-belohnen-am-platz", "s-stress-reduktion"],
    },
    {
      title: "Generalizzare percorsi diversi",
      schwerpunkt: "Finora la toilette era in un solo posto. Questa settimana generalizzi: si può fare anche in altri posti. In caso di successo: ricompensa.",
      wochenziele: [
        "{dogName} fa i bisogni anche in posti nuovi.",
        "Generalizzazione della pulizia in casa.",
        "Sei più flessibile nella quotidianità.",
      ],
      tagesplan: "Passeggiate su percorsi nuovi. Quando {dogName} fa i bisogni in un posto nuovo: SUPER ricompensa. La generalizzazione è il vero effetto di apprendimento.",
      no_gos: [
        "Accettare come toilette un solo posto.",
        "Aspettarsi che funzioni subito ovunque.",
        "Continuare in caso di stress in un posto nuovo.",
      ],
      fortschritt: [
        "{dogName} fa i bisogni anche in posti nuovi.",
        "Sei più flessibile.",
        "La generalizzazione è consolidata.",
      ],
      exerciseIds: ["s-toiletten-routine", "s-trigger-lesen"],
    },
    // Vertiefungen
    {
      title: "Costruire la tolleranza allo stress",
      schwerpunkt: "In caso di soiling da stress: costruire attivamente la tolleranza allo stress. Esercitare mini-situazioni di stress, {dogName} resta calmo.",
      wochenziele: [
        "{dogName} affronta mini-situazioni di stress senza soiling.",
        "La tolleranza allo stress cresce.",
        "Riconosci le soglie.",
      ],
      tagesplan: "Pianifica mini-situazioni di stress: una visita breve, un rumore nuovo, un piccolo cambiamento. {dogName} resta calmo nel frattempo (coperta + Kong). Ricompensa per la calma.",
      no_gos: [
        "Forzare la tolleranza allo stress: escalation.",
        "Stressori troppo forti all'inizio.",
        "Non fare nulla in caso di stress.",
      ],
      fortschritt: [
        "La tolleranza allo stress cresce.",
        "Il soiling da stress si riduce.",
        "Ti senti preparato.",
      ],
      exerciseIds: ["s-stress-reduktion", "s-belohnen-am-platz"],
    },
    {
      title: "Allungare il tempo di sonno notturno",
      schwerpunkt: "Le uscite notturne vengono ridotte lentamente. Con cani giovani: prima 1 volta di notte, poi dormire tutta la notte. Con cani più anziani non ancora puliti: 4 ore, poi 6 ore, poi 8 ore.",
      wochenziele: [
        "Il tempo di sonno notturno cresce.",
        "Gli incidenti notturni si riducono a 0.",
        "La vescica diventa più forte a lungo termine.",
      ],
      tagesplan: "Allunga la fase notturna di 30 minuti a settimana. In caso di incidente: torna a una fase più breve. Ultima uscita per i bisogni la sera il più tardi possibile. La mattina il più presto necessario.",
      no_gos: [
        "Allungare troppo in fretta.",
        "Insistere in caso di incidente.",
        "Pasti tardivi: riempiono la vescica.",
      ],
      fortschritt: [
        "Il tempo di sonno notturno cresce.",
        "La vescica diventa più forte.",
        "Dormi meglio.",
      ],
      exerciseIds: ["s-nächtliche-blase", "s-toiletten-routine"],
    },
    {
      title: "Gestire gli incidenti con disinvoltura",
      schwerpunkt: "In caso di incidenti rari reagisci con disinvoltura. Calma, detergente enzimatico, senza drammi. Annota cosa è successo.",
      wochenziele: [
        "Di fronte agli incidenti reagisci con calma istintiva.",
        "Il detergente enzimatico è sempre a portata di mano.",
        "Continui a tenere il diario.",
      ],
      tagesplan: "In caso di incidente raro: gestiscilo con calma. Usa il detergente enzimatico. Annota nel diario: quando, cosa, l'ultima uscita? Riconosci presto gli schemi.",
      no_gos: [
        "Sgridare o punire in caso di incidente.",
        "Usare un detergente normale.",
        "Dimenticare il diario.",
      ],
      fortschritt: [
        "Reagisci con disinvoltura.",
        "Gli schemi vengono riconosciuti.",
        "{dogName} non sviluppa comportamenti da stress.",
      ],
      exerciseIds: ["s-unfaelle-managen", "s-belohnen-am-platz"],
    },
    {
      title: "Consolidamento dell'incremento",
      schwerpunkt: "Ultima settimana dell'incremento. La routine è a posto, la frequenza è ottimale, la generalizzazione funziona. Fase 3 = stabilità a lungo termine.",
      wochenziele: [
        "Tutti gli strumenti scorrono fluidi.",
        "Gli incidenti sono molto rari.",
        "Ti senti competente.",
      ],
      tagesplan: "Bilancio: cosa funziona alla grande, cosa traballa ancora? Pianifica la Fase 3 con routine a lungo termine e mantenimento.",
      no_gos: [
        "Allentare la routine.",
        "Smettere di osservare.",
        "Dare i successi per scontati.",
      ],
      fortschritt: [
        "Gli strumenti sono a posto.",
        "{dogName} è pulito in casa.",
        "Ti senti competente.",
      ],
      exerciseIds: ["s-toiletten-routine", "s-trigger-lesen"],
    },
  ],
  generalisierung: [
    {
      title: "Routine a lungo termine",
      schwerpunkt: "La routine viene stabilita a lungo termine. 3-4 uscite per i bisogni al giorno a intervalli regolari. Anche in età avanzata questo mantiene la pulizia in casa.",
      wochenziele: [
        "La routine è stabile a lungo termine.",
        "{dogName} ha orari prevedibili.",
        "La pulizia in casa è scontata.",
      ],
      tagesplan: "3-4 uscite fisse per i bisogni al giorno: mattina, mezzogiorno, pomeriggio, sera. Prima di dormire è opzionale a seconda del cane. La routine diventa normalità.",
      no_gos: [
        "Mantenere la routine in modo incostante.",
        "Saltarla per fretta.",
        "Aspettarsi che 'funzioni da solo'.",
      ],
      fortschritt: [
        "La routine è lo standard.",
        "{dogName} resta pulito in casa.",
        "Pianifichi con serenità.",
      ],
      exerciseIds: ["s-toiletten-routine", "s-belohnen-am-platz"],
    },
    {
      title: "Padroneggiare ambienti nuovi",
      schwerpunkt: "In vacanza, in visita, in caso di trasloco: un cane pulito in casa deve cavarsela anche in ambienti nuovi. Questa settimana generalizzi ulteriormente.",
      wochenziele: [
        "{dogName} resta pulito in casa anche in ambienti nuovi.",
        "La prima uscita per i bisogni in un posto nuovo viene ricompensata.",
        "Prepari in anticipo le situazioni di vacanza.",
      ],
      tagesplan: "In ambienti nuovi: uscite ravvicinate per i primi giorni, più osservazione attiva. Prima volta che fa i bisogni in un posto nuovo: SUPER ricompensa. La generalizzazione si consolida col tempo.",
      no_gos: [
        "Aspettarsi che funzioni subito.",
        "Non agire in caso di stress in un ambiente nuovo.",
        "Lasciar andare la routine in un ambiente nuovo.",
      ],
      fortschritt: [
        "{dogName} resta pulito in casa anche in vacanza.",
        "Pianifichi i viaggi con più serenità.",
        "La generalizzazione è a lungo termine.",
      ],
      exerciseIds: ["s-trigger-lesen", "s-unfaelle-managen"],
    },
    {
      title: "Adattamento all'età",
      schwerpunkt: "Con l'età {dogName} potrebbe aver bisogno di nuovo di uscite più frequenti. Osserva i cambiamenti, adatta la routine.",
      wochenziele: [
        "Riconosci i cambiamenti legati all'età.",
        "La routine viene adattata quando serve.",
        "Il cane anziano resta pulito in casa.",
      ],
      tagesplan: "Osserva: {dogName} ha bisogno di uscite più frequenti? La capacità della vescica è cambiata? Controllo dal veterinario in caso di cambiamenti evidenti. Adatta la routine con flessibilità.",
      no_gos: [
        "Ignorare i cambiamenti dovuti all'invecchiamento.",
        "Aspettarsi la vecchia frequenza da un cane più anziano.",
        "Dimenticare il controllo dal veterinario.",
      ],
      fortschritt: [
        "Gli adattamenti sono stabiliti.",
        "Il cane anziano resta pulito in casa.",
        "Pianifichi con flessibilità.",
      ],
      exerciseIds: ["s-toiletten-routine", "s-belohnen-am-platz"],
    },
    {
      title: "Gestire una ricaduta di soiling da stress",
      schwerpunkt: "Se il soiling da stress ritorna (trasloco, nuovi coinquilini, cambiamenti di vita): ridurre attivamente lo stress, routine più ravvicinata.",
      wochenziele: [
        "Riconosci i segnali di ricaduta da stress.",
        "Lo stress viene ridotto attivamente.",
        "La routine viene adattata.",
      ],
      tagesplan: "In caso di sintomi da stress: frequenza di nuovo più ravvicinata, ridurre i fattori di stress, usare la coperta come ancora. In caso di stress più forte: controllo dal veterinario per escludere cause mediche.",
      no_gos: [
        "Trattare la ricaduta da stress come un problema comportamentale.",
        "Sgridare in caso di incidenti da stress.",
        "Dimenticare il controllo dal veterinario.",
      ],
      fortschritt: [
        "La ricaduta da stress viene gestita.",
        "La routine è solida.",
        "Riconosci presto i segnali.",
      ],
      exerciseIds: ["s-stress-reduktion", "s-unfaelle-managen"],
    },
    {
      title: "Stabilizzare la riduzione della ricompensa",
      schwerpunkt: "La ricompensa diventa variabile a lungo termine. {dogName} resta pulito in casa anche senza premietti continui. Ma: ogni tanto ricompensa con un MAXI-PREMIO.",
      wochenziele: [
        "La frequenza della ricompensa è stabilizzata a circa il 30%.",
        "{dogName} resta affidabile.",
        "Le prestazioni eccellenti vengono ricompensate.",
      ],
      tagesplan: "Alle uscite normali: ogni tanto un premietto, ogni tanto no. In situazioni speciali (ambiente nuovo, dopo tanto tempo): sempre MAXI-PREMIO. Rinforzo variabile.",
      no_gos: [
        "Eliminare del tutto la ricompensa.",
        "Essere tirchi nelle situazioni speciali.",
        "Allentare la variabilità.",
      ],
      fortschritt: [
        "Il rinforzo variabile è consolidato.",
        "{dogName} resta affidabile.",
        "Pianifichi con serenità.",
      ],
      exerciseIds: ["s-belohnen-am-platz", "s-trigger-lesen"],
    },
    {
      title: "Piano d'emergenza in caso di ricadute",
      schwerpunkt: "Se la pulizia in casa cala all'improvviso: piano d'emergenza. Controllo dal veterinario, routine più ravvicinata, verificare i fattori di stress.",
      wochenziele: [
        "Hai un piano d'emergenza.",
        "I passi indietro vengono riconosciuti presto.",
        "Recuperati in 1-2 settimane.",
      ],
      tagesplan: "Piano d'emergenza: 1) Controllo dal veterinario (cistite ecc.). 2) Rendere la routine più ravvicinata. 3) Verificare i fattori di stress. 4) Aumentare di nuovo la densità delle ricompense. 5) Tenere il diario per trovare gli schemi.",
      no_gos: [
        "Ignorare i passi indietro.",
        "Dimenticare le cause mediche.",
        "Sgridare per frustrazione.",
      ],
      fortschritt: [
        "Il piano d'emergenza è a posto.",
        "I passi indietro vengono gestiti.",
        "Ti senti competente.",
      ],
      exerciseIds: ["s-unfaelle-managen", "s-stress-reduktion"],
    },
    {
      title: "Igiene dello stress per tutta la vita",
      schwerpunkt: "La pulizia in casa dipende a lungo termine anche dallo stress. Una buona igiene dello stress = pulizia in casa stabile. Sonno, routine, stimolazione.",
      wochenziele: [
        "L'igiene dello stress è una routine.",
        "{dogName} è equilibrato a lungo termine.",
        "La pulizia in casa resta stabile.",
      ],
      tagesplan: "Verifica regolarmente: Sonno? Routine? Stimolazione? Contatti sociali? Se c'è stress in altri ambiti: riducilo attivamente prima che la pulizia in casa ne risenta.",
      no_gos: [
        "Ignorare lo stress in altri ambiti.",
        "Lasciar andare la routine.",
        "Trascurare la stimolazione.",
      ],
      fortschritt: [
        "L'igiene dello stress è stabilita.",
        "{dogName} resta equilibrato.",
        "La pulizia in casa è stabile.",
      ],
      exerciseIds: ["s-trigger-lesen", "s-toiletten-routine"],
    },
    {
      title: "Passaggio alla modalità mantenimento",
      schwerpunkt: "Ultima settimana. La pulizia in casa è stabile, la routine è a posto, la generalizzazione è a posto. Mantenimento per gli anni a venire.",
      wochenziele: [
        "Tutte le routine funzionano a lungo termine.",
        "Il ritmo di mantenimento è chiaro.",
        "{dogName} resta pulito in casa.",
      ],
      tagesplan: "Riduci l'addestramento attivo al minimo. La routine resta: 3-4 uscite per i bisogni al giorno. Torna a tenere il diario in caso di ricadute. In caso di cambiamenti: adatta con prudenza.",
      no_gos: [
        "Eliminare di colpo tutte le routine.",
        "Farsi prendere dal panico in caso di ricaduta.",
        "Smettere di osservare.",
      ],
      fortschritt: [
        "{dogName} è pulito in casa a lungo termine.",
        "Ti senti competente.",
        "Gli incidenti sono l'eccezione.",
      ],
      exerciseIds: ["s-unfaelle-managen", "s-belohnen-am-platz"],
    },
  ],
};

// ── Phasen-Verteilung für 1/3/6-Monats-Plan ────────────────────────
function phaseRanges(weeksTotal: number) {
  const fundamentEnd = Math.ceil(weeksTotal / 3);
  const steigerungEnd = Math.ceil((weeksTotal * 2) / 3);
  return {
    fundament: { start: 1, end: fundamentEnd },
    steigerung: { start: fundamentEnd + 1, end: steigerungEnd },
    generalisierung: { start: steigerungEnd + 1, end: weeksTotal },
  };
}

function phaseForWeek(weekNum: number, weeksTotal: number): Phase {
  const ranges = phaseRanges(weeksTotal);
  if (weekNum <= ranges.fundament.end) return "fundament";
  if (weekNum <= ranges.steigerung.end) return "steigerung";
  return "generalisierung";
}

// ── Monats-Übersichten: problem-spezifisch, kein generischer Ziehen-Text ──
// Jede Phase pro Problem hat eigene Bausteine, eigene Stolperfallen, eigene
// "was du jetzt schon merken solltest" Punkte. Keine Anglizismen.

interface PhaseDaten {
  bausteine: string;       // kurze Liste der in dieser Phase aufgebauten Bausteine
  schon_merken: string;    // konkret: was sollte beobachtbar sein
  jetzt_anpassen: string;  // wie nachjustieren
  stolperfallen: string;   // häufige Fehler in dieser Phase
  vermeidet: string;       // was jetzt nicht tun
}

const PHASE_TEXTE: Record<ProblemKey, Record<Phase, PhaseDaten>> = {
  pulling: {
    fundament: {
      bausteine: "Parola-marcatore BRAVO e segnale GUARDA, meccanica del Sii un albero in casa, posizione al piede come zona d'oro della ricompensa, routine tranquilla alla porta e la coperta di rilassamento come ancora",
      schon_merken: "{dogName} reagisce in casa in meno di 2 secondi al GUARDA. Con un guinzaglio teso in casa {dogName} si gira verso di te dopo 5-10 secondi, le fermate per sessione scendono da oltre 20 a meno di 10. La porta si apre senza spingere, metti la mano in tasca meno spesso rispetto all'inizio del piano. {dogName} ha riconosciuto la coperta come luogo tranquillo.",
      jetzt_anpassen: "Se il Sii un albero in casa non funziona ancora senza il tuo aiuto, aggiungi una settimana ed esercitati in modo mirato con un livello di stimoli più basso. Se invece il giardino o l'ingresso funzionano già con calma, in fase 2 puoi osare di più. Annota quale dei quattro elementi è il più debole: sarà il focus della fase 2.",
      stolperfallen: "Molti, per impazienza, vogliono già inserire veri stimoli esterni in settimana 4. Questo distrugge le fondamenta. Altro classico: dare la ricompensa davanti al corpo invece che all'altezza della gamba; così attiri {dogName} in avanti e favorisci il tirare. Tieni la ricompensa costantemente accanto al tuo ginocchio.",
      vermeidet: "Passeggiate quotidiane complete già ora, aspettandoti che funzioni. La fase 1 è lavoro in casa. La fase 2 fa la transizione."
    },
    steigerung: {
      bausteine: "Sii un albero all'aperto con stimoli reali, cambio di direzione opposta come conseguenza in caso di tiraggio ostinato, premiare al piede nella vita quotidiana reale, cambi di ritmo e direzione come strumento di attenzione",
      schon_merken: "In una prima vera passeggiata, dopo un paio di fermate {dogName} si ferma quando il guinzaglio si tende, invece di tirare dritto. Ti serve la conseguenza del cambio di direzione meno spesso rispetto alla prima settimana di questa fase. Le fermate per passeggiata sono a una cifra e {dogName} cerca da solo la posizione al piede agli incroci o nei punti insicuri.",
      jetzt_anpassen: "Se {dogName} all'aperto ha ancora molte fermate, torna su un percorso più tranquillo e lavora lì in modo preciso. La distanza e il livello di stimoli sono la tua manopola di regolazione, non la pressione o una voce più forte. Se invece i percorsi tranquilli vanno già molto bene: con cautela in zone più affollate, ma sempre con il Sii un albero come ancora.",
      stolperfallen: "Ridurre troppo in fretta la densità delle ricompense perché al momento va così bene. La fase 2 è la fase di investimento: ogni buona fase al guinzaglio viene premiata. Altro errore diffuso: continuare in una giornata di stress, invece di scegliere un percorso più tranquillo.",
      vermeidet: "Insistere in una situazione di stress con il pensiero 'ormai ci siamo quasi'. I plateau sono normali. Chi ora lavora in modo preciso, in fase 3 avrà i progressi più netti."
    },
    generalisierung: {
      bausteine: "Guinzaglio allentato nella vera passeggiata quotidiana, gestire percorsi diversi, pause per annusare come ricompensa per le fasi tranquille, riduzione graduale delle ricompense",
      schon_merken: "{dogName} affronta una passeggiata quotidiana di 20-30 minuti con meno di 5 veri episodi di tiraggio. Usi strumenti come il Sii un albero e il premiare al piede senza pensarci. Anche su un percorso nuovo {dogName} resta perlopiù tranquillo. Le pause per annusare sono una ricompensa attiva invece di un 'momento di disturbo' come prima.",
      jetzt_anpassen: "Riduci ulteriormente la frequenza delle ricompense, ma mai del tutto. Per le prestazioni eccezionali continua a premiare con generosità. Se {dogName} senza ricompensa cala nettamente: un passo indietro verso una densità più alta. Pianifica un ritmo di mantenimento: ogni 3-4 mesi una passeggiata di esercizio consapevole in un luogo difficile.",
      stolperfallen: "Eliminazione totale delle ricompense. Il rinforzo resta importante, cambiano solo la frequenza e la prevedibilità. Altro classico: dare i successi per scontati e non osservare più. Piccole ricadute capitano; notate presto, si correggono rapidamente.",
      vermeidet: "Abbandonare del tutto il piano e pensare 'ormai è consolidato per sempre'. Le buone routine restano solo se continui a curarle."
    }
  },
  energy: {
    fundament: {
      bausteine: "Inventario del sonno e del ritmo quotidiano, cibo come attività invece del mangiare dalla ciotola, segnale ASPETTA come tolleranza alla frustrazione, il marcatore di rilassamento (es. MERAVIGLIOSO)",
      schon_merken: "{dogName} lavora 20-30 minuti al gioco di ricerca o al Kong invece di ingoiare in 30 secondi. Dopo queste attività {dogName} si calma tranquillo invece di restare su di giri. ASPETTA davanti alla ciotola funziona con 5-10 secondi senza abbaiare per la frustrazione. Il marcatore di rilassamento si collega in modo osservabile alle fasi tranquille.",
      jetzt_anpassen: "Se {dogName} la sera è ancora su di giri, controlla il sonno: i cani adulti hanno bisogno di 16-20 ore di riposo al giorno. Molti cani iperattivi dormono troppo poco. Se il gioco di ricerca finisce troppo in fretta, rendilo più difficile (nascondigli più alti, congelare il Kong). Se ASPETTA è ancora incerto: accorcia di nuovo il tempo di attesa.",
      stolperfallen: "Offrire più azione perché {dogName} è così su di giri. È proprio questo l'errore. La sovraeccitazione ha bisogno di meno stimoli, non di più. Altro classico: vedere il lavoro mentale come 'opzionale'. Il gioco di ricerca e il Kong non sono un contorno rispetto alle scorribande: sono l'impegno più importante.",
      vermeidet: "Scorribande per ore o lunghi incontri tra cani. Entrambi rafforzano la sovraeccitazione. La fase 1 è costruzione della calma in casa."
    },
    steigerung: {
      bausteine: "Lavoro di naso all'aperto (seguire una traccia, ricerca scaglionata), passeggiate strutturate con compiti di ricerca, gioco dello STOP come interruttore dell'eccitazione, routine di calma sulla coperta dopo ogni eccitazione",
      schon_merken: "{dogName} segue con concentrazione una traccia di cibo di 20m ed è poi visibilmente stanco. Nel gioco dello STOP {dogName} si calma entro 3 secondi. Dopo le passeggiate {dogName} ritrova la calma più in fretta grazie alla routine di calma rispetto all'inizio del piano. La capacità di concentrazione cresce in modo evidente.",
      jetzt_anpassen: "Se {dogName} dopo il lavoro di naso è ancora su di giri, rendi i compiti di ricerca più difficili (più complessi, più nascondigli) invece che più lunghi. Più difficoltà stanca più di un movimento monotono e prolungato. Se il calmarsi non funziona: inserisci 10 minuti di preparazione tranquilla prima di ogni sessione.",
      stolperfallen: "Accumulare più attività eccitanti nello stesso giorno. Parco al mattino, scorribande al pomeriggio, visite alla sera: è un sovraccarico di stimoli, non impegno. Altro errore diffuso: saltare il calmarsi perché 'il cane dorme già'. Il recupero attivo fa parte della routine.",
      vermeidet: "Scorribande per ore con altri cani. Così la sovraeccitazione si rafforza, non si riduce."
    },
    generalisierung: {
      bausteine: "Piano settimanale di impegno con una chiara combinazione di movimento, naso, testa e contatto sociale, la calma come modalità predefinita nella quotidianità, una chiara routine anti-sovraeccitazione per le giornate difficili",
      schon_merken: "{dogName} è in fase di riposo almeno il 60% della giornata. Non devi più provvedere continuamente all'intrattenimento, {dogName} si rilassa anche da solo. Quando arriva la sovraeccitazione, la routine anti-sovraeccitazione (togliere gli stimoli, sulla coperta, dare il marcatore di rilassamento) ti aiuta in modo affidabile. Le passeggiate non sono più un obbligo, ma un vero arricchimento.",
      jetzt_anpassen: "Controlla regolarmente il tuo piano settimanale: {dogName} riceve ogni giorno movimento più naso più testa? Se manca un pilastro, di solito è quella la fonte di nuova irrequietezza. Nelle fasi di stress (trasloco, visite, cambiamenti) rendi il piano più fitto.",
      stolperfallen: "Abbandonare il piano perché 'ormai va bene'. La sovraeccitazione può tornare molto in fretta appena la struttura sparisce. Altro classico: interrompere le fasi di riposo con carezze o richiami. Lascia dormire {dogName}.",
      vermeidet: "Allentare l'igiene del sonno. 16-20 ore di riposo non sono negoziabili, nemmeno per i cani giovani."
    }
  },
  aggression: {
    fundament: {
      bausteine: "Mappa delle soglie per tutti i tipi di stimolo scatenante, parola-marcatore GUARDA e comunicazione tramite ricompensa, museruola condizionata positivamente, guardare-lo-stimolo-e-tornare (Guarda-lì) in casa con stimoli preparati, un chiaro protocollo di emergenza in caso di escalation",
      schon_merken: "Conosci la distanza a partire dalla quale ogni stimolo genera stress in {dogName}, e riconosci presto i segnali di stress (mimica, respiro, coda). {dogName} infila spontaneamente il muso nella museruola e accetta brevi tempi di indossamento. In casa {dogName} reagisce alla parola-marcatore GUARDA in meno di 2 secondi. Hai provato a secco la sequenza di emergenza, sai cosa fare.",
      jetzt_anpassen: "Se la mappa delle soglie è ancora incerta, esci di nuovo e osserva in modo mirato. Senza questa conoscenza la fase 2 è inutile. Se la museruola provoca ancora frustrazione, torna a brevi tempi di indossamento con attività positiva. Qui la pazienza ripaga più che altrove.",
      stolperfallen: "Lavorare già in fase 1 con stimoli reali perché 'deve pur funzionare'. Questo porta all'escalation. Altro classico: mettere la museruola per la prima volta in una situazione di stress. MAI. Deve essere prima associata al 100% in modo positivo. Altrimenti l'associazione resta avvelenata a vita.",
      vermeidet: "Provocare gli stimoli o cercare incontri ravvicinati. La fase 1 è preparazione. La fase 2 è applicazione a grande distanza."
    },
    steigerung: {
      bausteine: "Guardare-lo-stimolo-e-tornare (Guarda-lì) all'aperto con stimoli reali da oltre 50m di distanza, distoglimento attivo dallo stimolo (il principio del guardare-e-distogliere), l'arco come strategia di evitamento e addestramento di adattamento comportamentale in setup a distanza",
      schon_merken: "Con stimoli a grande distanza {dogName} resta sotto la soglia e guarda verso di te, invece di concentrarsi sullo stimolo. I segni di stress diventano più brevi e più rari. {dogName} segue il segnale dell'arco senza resistenza. Nel addestramento di adattamento comportamentale {dogName} mostra proprie strategie per gestire lo stress (distogliere lo sguardo, girarsi, annusare), che tu premi con la distanza.",
      jetzt_anpassen: "Se la distanza di soglia resta ancora molto grande, va bene. La riduzione avviene lentamente, 2-5m a settimana, non in modo radicale. Se invece {dogName} è già tranquillo a 10m, avvicinati con cautela, ma a un solo tipo di stimolo alla volta.",
      stolperfallen: "Accumulare più tipi di stimolo per passeggiata. Cane + jogger + ciclista in una sessione è un sovraccarico di stimoli. Altro classico: dare la ricompensa solo dopo la reazione invece che mentre lo stimolo è visibile. Così l'associazione emotiva non cambia.",
      vermeidet: "Sfiorare la soglia o superarla, per 'provare una volta'. Ogni escalation costa 2 settimane di apprendimento."
    },
    generalisierung: {
      bausteine: "Training di adattamento comportamentale nella quotidianità, chiara gerarchia degli stimoli con gestione consapevole, una zona cuscinetto di confronto prima degli incontri previsti e la regola delle 72 ore di recupero dallo stress",
      schon_merken: "{dogName} si autoregola in molte situazioni, devi intervenire più di rado. Negli incontri previsti applichi la routine della zona cuscinetto in modo automatico. Pianifichi le passeggiate consapevolmente secondo la gerarchia degli stimoli ed eviti lo stress cumulativo. Le escalation diventano rare e brevi, perché le vedi presto.",
      jetzt_anpassen: "Riduci lentamente la densità delle ricompense, ma mai del tutto. Per stimoli nuovi o difficili continua con la ricompensa piena. Pianifica regolari giornate di ripasso con uno stimolo di media difficoltà, questo mantiene fresche le strategie.",
      stolperfallen: "Abbandonare del tutto la museruola perché 'ormai funziona'. Nei cani reattivi resta uno strumento per le situazioni ad alto rischio. Altro classico: ignorare la regola delle 72 ore. Gli ormoni dello stress si smaltiscono completamente solo dopo 3 giorni.",
      vermeidet: "Rinunciare del tutto all'evitamento degli stimoli aspettandosi 'lo alleniamo fino in fondo'. Una gestione chiara fa parte della soluzione, non è un fallimento."
    }
  },
  mouthing: {
    fundament: {
      bausteine: "Segnale LASCIA costruito in modo preciso tramite scambio positivo, lo scambio come reazione automatica alla raccolta, NO come segnale di stop in casa con ricompensa alternativa, gestione del guinzaglio nei tuoi punti critici di raccolta",
      schon_merken: "{dogName} lascia spontaneamente oggetti semplici al LASCIA, non devi rincorrerlo né mettergli le mani in bocca. Al NO {dogName} in casa si ferma e ti cerca. Nei punti critici noti durante la passeggiata {dogName} cerca già la posizione al piede. Hai sempre a portata di mano una ricompensa di scambio di alto valore.",
      jetzt_anpassen: "Se il LASCIA con oggetti di alto valore non funziona ancora, torna a cose di basso valore in casa. Aumenta lentamente il valore. Se il NO diventa inflazionato (lo usi 20 volte al giorno), riducilo a 3-5 situazioni davvero importanti.",
      stolperfallen: "Rincorrere quando {dogName} ha un oggetto proibito. Per il cane è un divertimento e rafforza il raccogliere. Altro classico: restituire l'oggetto raccolto dopo il LASCIA. Così lo scambio non è reale e la disponibilità cala.",
      vermeidet: "Percorrere tratti ad alto rischio (molti angoli con rifiuti, zone con esche avvelenate) senza museruola, finché gli strumenti non funzionano ancora all'aperto. Prima la sicurezza."
    },
    steigerung: {
      bausteine: "LASCIA nella vera passeggiata con ritrovamenti di basso e medio valore, NO come segnale di prevenzione prima della raccolta, ricerca della ricompensa come attività alternativa per l'istinto di ricerca, museruola come standard di sicurezza per i tratti ad alto rischio",
      schon_merken: "All'aperto {dogName} reagisce al NO in meno di 2 secondi e si rivolge a te. Il LASCIA con ritrovamenti semplici funziona senza drammi, tu resti calmo dentro. Nella ricerca della ricompensa {dogName} cerca attivamente con il naso i premietti lanciati, invece di raccogliere a caso.",
      jetzt_anpassen: "Se il LASCIA con ritrovamenti di medio valore non funziona ancora, probabilmente la ricompensa è troppo scarsa. Passa a pollo o salsiccia. Se l'istinto di ricerca, anche dopo più impegno, porta ancora a raccogliere, intensifica le fasi di lavoro di naso.",
      stolperfallen: "Vedere la museruola come una 'resa'. È uno strumento, non una punizione. Altro classico: usare il NO come parola di rimprovero. Deve restare un chiaro segnale di stop con ricompensa alternativa.",
      vermeidet: "Percorrere tratti critici (davanti alle scuole, nei giorni della raccolta rifiuti) senza museruola. Qui la prevenzione vale più dell'addestramento dopo l'incidente."
    },
    generalisierung: {
      bausteine: "Riduzione delle ricompense verso il rinforzo variabile, LASCIA con ritrovamenti di alto valore con ricompensa MEGA, lavoro di naso come impegno principale invece che accessorio, chiare strategie per gli punti critici nei tuoi luoghi più difficili",
      schon_merken: "{dogName} affronta i tratti ad alto rischio senza drammi, li pianifichi consapevolmente invece di evitarli. Il LASCIA con rari ritrovamenti di alto valore funziona con ricompensa MEGA. Metti la mano in tasca più di rado, perché {dogName} lascia in modo affidabile anche senza rinforzo continuo.",
      jetzt_anpassen: "Valuta la necessità della museruola percorso per percorso. Percorsi tranquilli e noti: senza. Alto rischio: continua con. In caso di ricadute, torna a condurre più stretto. L'istinto di ricerca ha bisogno di soddisfazione per tutta la vita, inserisci stabilmente il lavoro di naso nel piano settimanale.",
      stolperfallen: "Ridurre a zero la frequenza delle ricompense. Il rinforzo variabile significa 'a volte', non 'mai'. Altro classico: in una brutta giornata andare in una zona ad alto rischio perché 'tanto di solito funziona'. In emergenza l'orgoglio si paga caro.",
      vermeidet: "Rinunciare alla museruola per come viene percepita. È un equipaggiamento responsabile, non una vergogna."
    }
  },
  recall: {
    fundament: {
      bausteine: "La parola di richiamo VIENI-QUI ricaricata in positivo con ricompense top, il richiamo trattenuto con un aiutante per un'alta motivazione, il lavoro con la longhina come ponte di sicurezza e il fischietto per cani come secondo segnale di backup",
      schon_merken: "In casa {dogName} reagisce fulmineamente al VIENI-QUI e arriva visibilmente entusiasta. Nel gioco del trattenimento {dogName} sprinta verso di te con grande energia. La longhina è una routine tranquilla, nessun dramma. Il fischietto per cani è condizionato in modo preciso in casa con la ricompensa.",
      jetzt_anpassen: "Se il VIENI-QUI in casa non funziona ancora al 100%, probabilmente la ricompensa è troppo scarsa. Passa a pollo o formaggio, non crocchette. Se la longhina crea confusione, esercitati prima solo a portarla senza richiami, così {dogName} si abitua al materiale.",
      stolperfallen: "Usare la parola di richiamo per cose negative (bagno, veterinario, rimettere il guinzaglio a fine passeggiata). Così avveleni il segnale a vita. Per le cose negative usa un'altra parola. Altro classico: chiamare il segnale più volte quando {dogName} non arriva. Così {dogName} impara che la prima volta è opzionale.",
      vermeidet: "Rischiare già in fase 1 la vera libertà senza guinzaglio. Prima la parola deve essere sicura al 100%, poi la longhina, poi il fischietto. La fase 2 fa la transizione."
    },
    steigerung: {
      bausteine: "VIENI-QUI con distrazione moderata alla longhina, il fischietto per cani in situazioni reali all'aperto, la parola di richiamo d'emergenza per vere crisi (usata solo in emergenza, ricompensa MEGA), tre chiari livelli di ricompensa",
      schon_merken: "Con una distrazione moderata {dogName} arriva in modo affidabile (80% o più). Riconosci con sicurezza quando la distrazione è troppo grande per un richiamo, e non bruci la tua voce. Il fischietto funziona all'aperto in modo affidabile quanto la parola. Il segnale di emergenza è condizionato e mai usato.",
      jetzt_anpassen: "Se il tasso di successo scende sotto il 70%, la distrazione è troppo grande. Riducila invece di aumentare la pressione. Se invece tutto va al 90%: distrazioni più difficili, ma solo un livello a settimana.",
      stolperfallen: "Usare il segnale di emergenza per i richiami normali. Così perde la sua magia. Altro classico: lesinare la ricompensa nei richiami difficili. Le prestazioni eccezionali costano, soprattutto in fase 2.",
      vermeidet: "Senza longhina in aree sconosciute. La longhina resta il ponte di sicurezza fino alla fase 3."
    },
    generalisierung: {
      bausteine: "Prime fasi controllate di libertà senza guinzaglio in zone sicure, routine di mantenimento per VIENI-QUI e fischietto, gioco del trattenimento come ripasso regolare, livelli di ricompensa graduati a seconda della difficoltà",
      schon_merken: "{dogName} gestisce la libertà senza guinzaglio in una zona sicura e arriva al segnale in meno di 5 secondi. Usi la longhina in modo mirato invece che automatico. Hai usato il segnale di emergenza e ha funzionato, hai fiducia nel sistema.",
      jetzt_anpassen: "Valuta percorso per percorso: longhina sì o no? In caso di dubbio: longhina. Anche dopo mesi senza incidenti, il segnale di emergenza resta la parola esclusiva della mega-ricompensa, non usarla mai per la routine.",
      stolperfallen: "Lasciar 'arrugginire' il richiamo perché ormai è consolidato. Senza un mantenimento regolare l'associazione sbiadisce. Pianifica 2-3 momenti di VIENI-QUI per passeggiata con MAXI-PREMIO.",
      vermeidet: "Libertà senza guinzaglio su percorsi vicini a strade o con alta probabilità di incontrare selvaggina. La sicurezza viene sempre prima della comodità."
    }
  },
  barking: {
    fundament: {
      bausteine: "Diario degli stimoli con i 3 principali stimoli dell'abbaiare, il marcatore SILENZIO come ricompensa per il tacere, la routine campanello-coperta come alternativa concreta, costruzione della tolleranza alla frustrazione tramite i segnali ASPETTA",
      schon_merken: "Conosci i principali stimoli dell'abbaiare in {dogName} e non reagisci più d'istinto. {dogName} riceve 8-10 ricompense al giorno per le fasi di silenzio. Con la registrazione del campanello {dogName} corre già verso la coperta. ASPETTA funziona in 3-4 situazioni quotidiane.",
      jetzt_anpassen: "Se un tipo di stimolo provoca ancora più abbai degli altri, concentra su questo il focus della fase 2. Se il marcatore SILENZIO non funziona ancora, probabilmente la densità delle ricompense è troppo bassa. Torna per 1 settimana a più di 10 ricompense al giorno.",
      stolperfallen: "Sgridare quando {dogName} abbaia. Così l'abbaiare riceve attenzione, quindi diventa più frequente. Altro classico: esercitare la routine campanello-coperta solo in casa, per poi trovarsi in difficoltà con una visita reale. I test realistici devono arrivare gradualmente.",
      vermeidet: "Lasciare che il cane 'abbai fino allo sfinimento' con l'idea 'prima o poi la smette'. L'abbaiare per attenzione si estingue voltandosi in modo coerente, non sopportando."
    },
    steigerung: {
      bausteine: "Veri test del campanello con aiutante e ospite, controcondizionamento con stimoli esterni, coerente estinzione dell'abbaiare per attenzione nell'arco di 2-3 settimane, tolleranza alla frustrazione approfondita",
      schon_merken: "Al campanello vero {dogName} corre già alla coperta invece che alla porta. Gli stimoli esterni portano a uno sguardo verso di te invece che all'abbaiare. L'abbaiare per attenzione è diventato visibilmente più raro, il picco dell'estinzione è ormai alle spalle. ASPETTA funziona con oltre 20 secondi senza abbaiare.",
      jetzt_anpassen: "Se il picco dell'estinzione non si è ancora placato, resisti. Un familiare che cede sabota 2 settimane di lavoro, perciò è importante briefare la famiglia. Se la routine della coperta è incerta con il campanello reale, torna alla registrazione + aiutante.",
      stolperfallen: "Affrontare più tipi di stimolo contemporaneamente. Concentrati su un focus a settimana. Altro classico: ridurre troppo in fretta la densità delle ricompense perché 'ormai non abbaia quasi più'. La fase 2 ha ancora bisogno di un rinforzo elevato.",
      vermeidet: "Insistere con la routine nelle giornate difficili (temporali, fuochi d'artificio, stress). Meglio ridurre gli stimoli e riprendere normalmente il giorno dopo."
    },
    generalisierung: {
      bausteine: "Routine campanello-coperta nella quotidianità con ospiti reali, chiara igiene dello stress per evitare ricadute nell'abbaiare, ripassi di mantenimento ogni 4-6 settimane, strategia di emergenza in caso di improvviso aumento dell'abbaiare",
      schon_merken: "Al campanello o agli stimoli esterni {dogName} reagisce con calma e prevedibilità. Accogliere gli ospiti è routine, non un dramma. Riconosci presto le piccole ricadute e intervieni prima che diventino più grandi.",
      jetzt_anpassen: "Verifica la coerenza della famiglia ogni poche settimane. Le reazioni incoerenti di singole persone sono la fonte più comune di ricadute. In caso di ricadute: 1 settimana extra-coerente con ricompensa aumentata.",
      stolperfallen: "Spuntare le strategie come 'fatte'. L'abbaiare può tornare molto in fretta appena la coerenza cala. Altro classico: ignorare lo stress altrove (trasloco, nuovo membro della famiglia), e allora {dogName} riprende ad abbaiare.",
      vermeidet: "Rilassarsi e provocare di proposito gli stimoli dell'abbaiare per mettere alla prova. I bravi cani non sono 'cani messi alla prova', ma cani allenati in modo stabile."
    }
  },
  anxiety: {
    fundament: {
      bausteine: "Riconoscere la sequenza di stimoli del commiato, disaccoppiare i singoli stimoli (chiavi senza uscire, scarpe senza uscire), stare da solo costruito da secondi a minuti, il Kong preferito come associazione positiva con l'uscire",
      schon_merken: "Conosci gli stimoli del commiato di {dogName} (chiavi, scarpe, giacca, maniglia della porta) e ci lavori con naturalezza per disaccoppiarli. Un tempo da solo di 1-3 minuti viene gestito senza segni di stress. {dogName} inizia l'attività con il Kong quando esci, invece di tremare già.",
      jetzt_anpassen: "Se le fasi di pochi secondi sono ancora incerte, torna indietro e lavora più breve. Nell'ansia da separazione la pazienza è tutto: chi aumenta troppo in fretta ricostruisce la paura. Se il Kong resta inutilizzato, il tempo da solo è troppo lungo per il livello attuale.",
      stolperfallen: "Salutare o accogliere in modo drammatico. Entrambi colorano negativamente il momento dello 'stare da solo'. Altro classico: tornare indietro in un momento di guaito. Così {dogName} impara che il guaito fa tornare il padrone, e questo consolida la paura.",
      vermeidet: "Lasciarlo solo per ore perché c'è un appuntamento. Nemmeno in auto, nemmeno dal vicino. La fase 1 è lavoro di secondi e minuti. Se capita un imprevisto, un dog sitter."
    },
    steigerung: {
      bausteine: "Fasi di minuti estese fino a 30-60 minuti, la coperta di sicurezza come ancora mobile, la prima ora da solo come traguardo, osservazione regolare tramite fotocamera dello smartphone",
      schon_merken: "{dogName} resta da solo 30-60 minuti ed è rilassato sulla coperta, non teso. Gli stimoli sono in gran parte disaccoppiati, le routine di preparazione non generano più picchi di stress. Nel video vedi fasi di riposo invece di camminare avanti e indietro o abbaiare.",
      jetzt_anpassen: "Se l'ora non funziona ancora, resta su fasi più brevi ed esercitale in modo stabile. Se invece è tutto tranquillo, puoi salire lentamente a 90 minuti e 2 ore. Qui l'osservazione via video è più importante dell'intuito, perché i cani spesso mostrano stress solo dopo alcuni minuti.",
      stolperfallen: "Controllare l'andamento troppo tardi. Senza video tiri a indovinare se il tempo da solo è andato bene o no. Altro classico: allungare radicalmente in un giorno perché 'oggi sembra andare bene'. È la pazienza a fare la differenza.",
      vermeidet: "Testare fasi lunghe quando fuori c'è stress (temporali, lavori stradali, giorni di festa). La fase 2 ha bisogno di condizioni stabili."
    },
    generalisierung: {
      bausteine: "3-4 ore di tempo da solo come adeguatezza alla vita quotidiana, una routine quotidiana prevedibile che {dogName} conosce, igiene dello stress per una stabilità a lungo termine, controllo video regolare come riconoscimento precoce delle ricadute",
      schon_merken: "Puoi lavorare o fare la spesa e {dogName} resta tranquillo. La routine quotidiana è fissa e prevedibile. Nel video {dogName} dorme o riposa per la maggior parte del tempo, la routine del Kong è collaudata. Ti senti pronto alla vita quotidiana.",
      jetzt_anpassen: "Mantieni la routine rigorosa, anche nel weekend. I cani non distinguono tra giorno feriale e domenica. In caso di cambiamenti di vita (trasloco, nuovo coinquilino) aumenta di nuovo per un po' la frequenza delle brevi fasi da solo.",
      stolperfallen: "Azzardare assenze di ore perché 'ormai funziona'. Anche un cane stabile ha bisogno ogni tanto di contatto sociale. Altro classico: ignorare lo stress altrove, e allora l'ansia da separazione torna come sintomo.",
      vermeidet: "Più di 4-5 ore di fila senza pausa per i bisogni o movimento. Anche senza ansia da separazione, per i cani è troppo lungo."
    }
  },
  jumping: {
    fundament: {
      bausteine: "La regola delle quattro zampe a terra come principio centrale, il segnale SEDUTO come alternativa al saluto, coerenza familiare con tutti i conviventi, una routine tranquilla per il rincontro senza agitazione",
      schon_merken: "{dogName} cerca attivamente la posizione SEDUTO al tuo saluto. Il saltare addosso è diventato più raro, la famiglia applica la regola con coerenza. Anche le tue reazioni al rincontro sono diventate più tranquille, senza un ciao drammatico.",
      jetzt_anpassen: "Se un familiare cede ancora, questo è il cantiere più importante. Un'incoerenza a settimana costa una settimana di progresso. Se il SEDUTO come saluto non arriva ancora da solo, esercitalo di nuovo attivamente in 10 saluti al giorno.",
      stolperfallen: "Spingere via il cane con il ginocchio o sgridarlo. Entrambi sono attenzione per il saltare addosso, quindi una ricompensa. Altro classico: per fretta 'lasciar passare una volta' il saltare addosso. Diventa molto in fretta uno schema ripetuto.",
      vermeidet: "Lavorare già con scenari di ospiti complicati prima che la coerenza familiare sia solida. Prima casa, poi ospiti."
    },
    steigerung: {
      bausteine: "Sequenza estesa per gli ospiti con campanello e coperta, SEDUTO come reazione automatica di saluto senza segnale, la coerenza in più situazioni quotidiane (alzarsi, inizio della passeggiata, momento del gioco), incontri controllati con passanti all'aperto",
      schon_merken: "Al campanello {dogName} corre alla coperta. Gli ospiti sono informati in anticipo e istruiti correttamente. Il SEDUTO viene offerto automaticamente in più situazioni della giornata, senza che tu debba annunciarlo. Anche in passeggiata {dogName} si siede quando passano dei passanti.",
      jetzt_anpassen: "Con ospiti difficili (bambini, persone timorose) porta {dogName} sulla coperta e lascialo lì. Il ciao solo dopo un chiaro segnale di OK. Se il SEDUTO davanti ai passanti è ancora incerto, torna a una distanza maggiore ed esercitati con meno sovraccarico di stimoli.",
      stolperfallen: "Non informare gli ospiti dando per scontato 'andrà bene'. Accarezzeranno il cane che salta e così rafforzeranno il comportamento. Altro classico: diventare incoerenti con sé stessi perché 'era così contento'.",
      vermeidet: "Visite di gruppo senza preparazione. Più persone significa più incoerenza potenziale."
    },
    generalisierung: {
      bausteine: "Routine di mantenimento con esercizio di saluto quotidiano, test di stress regolari con nuovi ospiti, coerenza familiare a lungo termine, piano di emergenza in caso di ricadute",
      schon_merken: "Il saltare addosso è l'eccezione, non la norma. Ti senti preparato a nuove persone o visite di gruppo. La routine di mantenimento procede con naturalezza. I test di stress mostrano reazioni stabili.",
      jetzt_anpassen: "In caso di ricadute: 1 settimana extra-coerente, ripetere il briefing della famiglia, frequenza delle ricompense di nuovo alta. Con nuovi membri della famiglia (partner, coinquilini) coinvolgili subito, altrimenti il saltare addosso torna attraverso di loro.",
      stolperfallen: "Lasciar arrugginire la coerenza nella quotidianità perché 'ormai è diventato bravo'. Il saltare addosso è sempre a 1 incoerenza dal ritorno. Altro classico: nella propria eccitazione (giorno di festa, compleanno) permettere al cane di saltare perché 'oggi è un'occasione speciale'.",
      vermeidet: "Saltare del tutto i test di stress perché 'ormai funziona'. Senza un test di stress ti accorgi delle ricadute solo quando sono già entrate nella routine."
    }
  },
  destructive: {
    fundament: {
      bausteine: "Analisi delle cause completata (noia vs ansia da separazione vs bisogno di masticare), 4-5 oggetti da masticare consentiti stabiliti in rotazione, zone di gestione per l'assenza allestite, lo scambio invece della punizione con gli oggetti proibiti",
      schon_merken: "Sai se la distruttività nasce da noia, paura o bisogno di masticare, e il focus dell'addestramento è chiaro. {dogName} ha oggetti da masticare preferiti e li usa per più di qualche minuto. Con gli oggetti proibiti reagisci con lo scambio, non con il rimprovero.",
      jetzt_anpassen: "Se un oggetto da masticare annoia in fretta, mettilo in rotazione via per 1-2 settimane, poi torna interessante. Se la zona di gestione non viene accettata, costruiscila come luogo preferito con un'associazione positiva.",
      stolperfallen: "Rimproverare il cane quando trovi un oggetto distrutto. {dogName} non può collegarlo all'atto, ma lo stress resta. Altro classico: rincorrere il cane quando ha qualcosa in bocca. Puro divertimento per il cane.",
      vermeidet: "Restituire l'oggetto proibito raccolto dopo lo scambio. Così lo scambio non è reale e la disponibilità cala."
    },
    steigerung: {
      bausteine: "Piano di impegno strutturato implementato con una combinazione di movimento, naso e testa, gli oggetti da masticare ruotano di routine, gestione allentata con cautela dove è sicuro, lunghe fasi di riposo a terra allenate consapevolmente",
      schon_merken: "La sera {dogName} è spossato, non su di giri. La combinazione di impegno funziona, la distruttività in presenza è nettamente più rara. Le lunghe fasi sulla coperta vengono mantenute con calma. Le prime zone liberate vengono accettate senza distruzione.",
      jetzt_anpassen: "Con cani giovani (4-9 mesi): più lavoro mentale, meno scorribande fini a sé stesse. Con gli adulti: più lavoro di naso. Se le lunghe fasi di riposo a terra sono ancora incerte, torna a fasi più brevi con l'attività del Kong.",
      stolperfallen: "Abbandonare del tutto la gestione perché 'per una settimana non è successo niente'. Le zone a rischio restano zone a rischio. Altro classico: fare sessioni di masticazione troppo brevi. 15-30 minuti è la durata efficace, non 5 minuti.",
      vermeidet: "Accumulare più attività eccitanti nello stesso giorno. Se la distruttività è un sintomo di stress, lo stress la aggrava ulteriormente."
    },
    generalisierung: {
      bausteine: "Piano settimanale di impegno a lungo termine stabilito, assortimento di oggetti da masticare curato e ampliato regolarmente, equilibrio di gestione trovato con zone chiaramente sicure e off-limits, piano di emergenza nelle fasi di stress",
      schon_merken: "{dogName} è equilibrato a lungo termine, la distruttività è l'eccezione. Hai un'idea chiara di quali zone sono sicure e quali no. Nelle fasi di stress (Natale, vacanze, cambiamenti) hai una strategia.",
      jetzt_anpassen: "Mantieni il piano di impegno anche nel weekend. In nuove situazioni di vita (trasloco, cambiamento in famiglia) aumenta di nuovo per un po' la gestione e l'impegno. Controlla ogni poche settimane l'usura dell'assortimento di oggetti da masticare.",
      stolperfallen: "Allentare il piano di impegno perché 'ormai è diventato tranquillo'. La calma viene dal piano, non dal nulla. Altro classico: nelle giornate stressanti impegnarlo meno per mancanza di tempo. Allora {dogName} distrugge per frustrazione.",
      vermeidet: "Aprire del tutto le zone a rischio aspettandosi 'ormai funziona'. La prudenza costa meno di un divano distrutto."
    }
  },
  soiling: {
    fundament: {
      bausteine: "Routine dei bisogni prevedibile con 5-7 giri fissi al giorno, ricompensa direttamente sul posto e nel momento giusto, imparare a leggere i segnali (annusare, girare, irrequietezza), gestione tranquilla degli incidenti senza punizione",
      schon_merken: "Conosci lo schema dei bisogni di {dogName} ed esci in modo proattivo, non reattivo. Nella maggior parte dei giri funziona nel posto abituale. Gli incidenti sono diventati più rari e, quando capitano, resti calmo e usi un detergente enzimatico. Riconosci i segnali più in fretta rispetto all'inizio del piano.",
      jetzt_anpassen: "Se gli incidenti restano frequenti, fai escludere dal veterinario che si tratti di una cistite o di un'altra causa medica. Con i cani giovani: aumenta di nuovo la frequenza a ogni 1-2 ore. In caso di sporcamento legato allo stress: riduci i fattori di stress.",
      stolperfallen: "Rimproverare o spingere il muso dentro dopo un incidente. Così {dogName} impara a nascondersi, non a diventare più pulito in casa. Altro classico: accettare solo un posto all'aperto invece di generalizzare. Più tardi {dogName} sarà insicuro in altri luoghi.",
      vermeidet: "Aspettarsi che la pulizia in casa si sviluppi da sola. Ha bisogno di ricompensa attiva e routine."
    },
    steigerung: {
      bausteine: "Frequenza dei bisogni ridotta gradualmente con il successo, lettura dei segnali automatizzata, ricompensa variata gradualmente, generalizzazione su percorsi diversi",
      schon_merken: "{dogName} regge fasi più lunghe senza lo stimolo dei bisogni, pianifichi con un margine nettamente maggiore. In luoghi nuovi funziona dopo un breve adattamento. I segnali vengono riconosciuti e assecondati quasi d'istinto.",
      jetzt_anpassen: "Se la frequenza ridotta porta a incidenti, torna alla routine più fitta. In caso di sporcamento legato allo stress: lavora sulla tolleranza allo stress con mini-stressori. Con i cani anziani: controllo dal veterinario se la frequenza torna a salire.",
      stolperfallen: "Eliminare del tutto la ricompensa perché funziona. Il rinforzo variabile resta importante, altrimenti il comportamento può erodersi. Altro classico: avere troppo poca pazienza su percorsi nuovi.",
      vermeidet: "Azzardare lunghe fasi senza un giro dei bisogni nelle giornate stressanti o in ambienti nuovi. Prima la sicurezza."
    },
    generalisierung: {
      bausteine: "Routine a lungo termine con 3-4 giri fissi al giorno, pulizia in casa anche in ambienti nuovi, igiene dello stress per tutta la vita, adattamento all'età nei cani anziani",
      schon_merken: "{dogName} è pulito in casa a lungo termine, anche in viaggio o durante le visite. Hai una routine chiara che sembra scontata. Riconosci presto lo stress altrove, prima che influenzi la pulizia in casa.",
      jetzt_anpassen: "Con l'età {dogName} potrebbe aver bisogno di nuovo di giri più frequenti, osserva attivamente. Con i cani anziani e un aumento della frequenza: controllo dal veterinario. In caso di ricadute legate allo stress: rendi per un po' la routine più fitta.",
      stolperfallen: "Dimenticare la routine nella propria frenesia. La pulizia in casa ha ancora bisogno di cura attiva. Altro classico: ignorare i cambiamenti dovuti all'età con il pensiero 'ormai è pulito in casa'. I cani anziani hanno bisogno di adattamenti.",
      vermeidet: "Ricominciare a rimproverare in caso di incidenti. Anche dopo anni di pulizia in casa, la punizione è sbagliata."
    }
  }
};

function phaseName(phase: Phase): string {
  if (phase === "fundament") return "Fase delle fondamenta";
  if (phase === "steigerung") return "Fase di potenziamento";
  return "Fase di generalizzazione";
}

function buildMonatsUebersichten(
  problem: ProblemKey,
  weeksTotal: number,
  monthsTotal: number,
  dog: DogProfile,
  problemLabel: string,
  customProblemText?: string
): Array<{ monat: number; text: string }> {
  const dogName = dog.dogName || "il tuo cane";
  const out: Array<{ monat: number; text: string }> = [];
  const ranges = phaseRanges(weeksTotal);

  const customRef = customProblemText
    ? `\n\nNello specifico per la tua situazione: "${customProblemText.slice(0, 200)}". Tieni attivo in mente questo riferimento, è la vera leva dell'addestramento.`
    : "";

  // Fallback auf pulling-Daten, falls ein Problem noch nicht eingetragen ist
  const phaseDaten = PHASE_TEXTE[problem] || PHASE_TEXTE.pulling;

  for (let m = 1; m <= monthsTotal; m++) {
    const endWeek = Math.min(m * 4, weeksTotal);
    const phase = phaseForWeek(endWeek, weeksTotal);
    const isEndOfPhase = endWeek === ranges[phase].end;
    const daten = phaseDaten[phase];

    const phaseHeader = isEndOfPhase
      ? `Dopo la settimana ${endWeek} la ${phaseName(phase)} è conclusa. Queste settimane ti hanno consolidato gli elementi più importanti: ${daten.bausteine}.`
      : `Metà percorso nella ${phaseName(phase)} (dopo la settimana ${endWeek}). Gli elementi di questa fase: ${daten.bausteine}. Non siamo ancora alla fine, ma la direzione è chiara.`;

    const text = `${phaseHeader}

Cosa dovresti già notare adesso: ${personalize(daten.schon_merken, dog)}

Cosa puoi adattare adesso: ${personalize(daten.jetzt_anpassen, dog)}

Errori comuni frequenti in questa fase: ${personalize(daten.stolperfallen, dog)}

Cosa eviti adesso: ${personalize(daten.vermeidet, dog)}${customRef}`;

    out.push({ monat: m, text });
  }

  return out;
}

// ── Zusatz-Spiele: 3 problem-spezifische Bonus-Übungen pro Problem ───
// Diese ergänzen die Wochen-Pläne und sind bewusst KEINE Kopien der
// Kern-Übungen. Sie passen aufs gleiche Skill-Set, bieten aber Varianz
// für Halter, denen die Wochen-Aufgaben zu wenig sind oder die ein Spiel
// für zwischendurch suchen.
type BonusSpiel = {
  nummer: number;
  name: string;
  ziel: string;
  schritte: string[];
  warum: string;
};

const BONUS_BY_PROBLEM: Record<ProblemKey, BonusSpiel[]> = {
  pulling: [
    {
      nummer: 1,
      name: "Lotteria del contatto visivo",
      ziel: "Rafforzare il contatto visivo spontaneo in passeggiata",
      schritte: [
        "Mentre cammini: ogni volta che {dogName} ti guarda, BRAVO + premietto all'altezza della gamba",
        "Importante: non chiamare, non battere le mani — premia solo lo sguardo spontaneo",
        "Coerente per tre giorni, poi basta premiare 1 volta su 3",
        "Dopo 7 giorni: nell'incertezza {dogName} guarda verso di te da solo",
      ],
      warum: "Un contatto visivo affidabile è la base di ogni correzione al guinzaglio. {dogName} impara: il punto di riferimento sono io, non l'ambiente.",
    },
    {
      nummer: 2,
      name: "Slalom tra le gambe",
      ziel: "Costruire attenzione e sintonia di ritmo in casa",
      schritte: [
        "Stai rilassato, gambe divaricate alla larghezza delle spalle",
        "Attira {dogName} con un premietto attraverso la gamba sinistra all'indietro, poi attraverso la gamba destra di nuovo in avanti",
        "5 giri di slalom, poi MAXI-PREMIO di 3 premietti",
        "Progressione: ritmo, poi senza attirare col premietto, solo con il gesto della mano",
      ],
      warum: "Allena la sintonia di ritmo e l'osservazione — esattamente le abilità che serviranno poi per la conduzione al guinzaglio.",
    },
    {
      nummer: 3,
      name: "Alternanza in piedi-seduto a distanza",
      ziel: "Affinare il freno agli impulsi e la sensibilità all'ascolto",
      schritte: [
        "{dogName} è in piedi a 2m da te, senza guinzaglio in casa",
        "Di' con calma SEDUTO — appena seduto: BRAVO, poi subito IN PIEDI",
        "Alterna 6-8 volte, mai attirando, sempre e solo con la voce",
        "Progressione: 5m di distanza, poi con una breve distrazione (porta aperta, un rumore)",
      ],
      warum: "I segnali vocali a distanza sono un test affidabile di quanto siano davvero solide le basi.",
    },
  ],
  energy: [
    {
      nummer: 1,
      name: "Scelta dei tre bicchieri",
      ziel: "Lavoro mentale, 5 minuti di concentrazione",
      schritte: [
        "3 bicchieri capovolti sul pavimento, in uno un premietto — {dogName} guarda mentre lo metti sotto",
        "Mescola lentamente i bicchieri, di' SCEGLI — {dogName} tocca con la zampa o il naso",
        "Giusto: BRAVO + premietto, nuovo giro. Sbagliato: nessuna reazione, mescola di nuovo",
        "5-7 giri per sessione, poi smetti — la concentrazione stanca più in fretta del movimento",
        "Progressione dopo 1 settimana: 4 o 5 bicchieri, oppure scambi i bicchieri mentre mescoli",
      ],
      warum: "Il lavoro mentale consuma in modo misurabile più energia di quello fisico. Cinque minuti del gioco dei bicchieri sono più faticosi di mezz'ora di riporto.",
    },
    {
      nummer: 2,
      name: "Kong-ghiacciolo per il divano",
      ziel: "Lunga attività autonoma nell'irrequietezza serale",
      schritte: [
        "Riempi il Kong con cibo umido e un sottile strato di yogurt, congela per 4 ore",
        "{dogName} lo riceve sulla sua coperta accanto al divano, alla sera",
        "Nel frattempo guardi la TV rilassato, deliberatamente senza dare attenzione a {dogName}",
        "{dogName} lavora concentrato per 40-60 minuti e di solito poi si addormenta",
        "Se dopo 30 minuti arriva la frustrazione: farne un ghiacciolo è troppo duro — la prossima volta meno yogurt",
      ],
      warum: "Il ghiaccio triplica la durata dell'attività e nel frattempo rinfresca. Perfetto per la fascia serale, in cui altrimenti {dogName} si agita.",
    },
    {
      nummer: 3,
      name: "Gioco del tira e molla calmo con STOP",
      ziel: "Alzare e riabbassare l'eccitazione in modo controllato",
      schritte: [
        "Prendi un giocattolo morbido, invita {dogName} con gentilezza a tirare",
        "Gioca 30-60 secondi lentamente e in modo controllato, sei tu a tenere il ritmo",
        "Di' all'improvviso STOP e congelati — nessun movimento, nessuna ripetizione della parola",
        "Appena {dogName} molla o si ferma: BRAVO, premietto, breve pausa",
        "Il gioco riprende solo dopo 5-10 secondi di calma — 4-6 alternanze per sessione",
        "Progressione: STOP nel bel mezzo di una giravolta invece che solo mentre tira",
      ],
      warum: "{dogName} impara a calmarsi nel mezzo di un gioco eccitante. Un interruttore di spegnimento nella testa, che manca a molti cani iperattivi — basato sul movimento, non solo sul naso.",
    },
  ],
  aggression: [
    {
      nummer: 1,
      name: "Gioco della coperta-isola",
      ziel: "La coperta diventa un rifugio sicuro nelle situazioni di stress",
      schritte: [
        "La coperta sta fissa in un luogo tranquillo, mai spostata altrove",
        "5 volte al giorno: salire sulla coperta = BRAVO + premietto + carezze tranquille",
        "Dopo 7 giorni: a una piccola irrequietezza di' COPERTA, {dogName} ci va",
        "Più avanti con lo stress vero: la coperta è l'ancora, lì si calma",
      ],
      warum: "Ti serve un luogo d'emergenza che NON sia il guinzaglio. Nell'arco di settimane la coperta diventa un segnale di sicurezza condizionato.",
    },
    {
      nummer: 2,
      name: "Guarda-lì su tutto",
      ziel: "Guardare lo stimolo senza agitarsi — il comportamento chiave",
      schritte: [
        "In casa con oggetti innocui: giocattolo, cuscino, scarpa",
        "Metti l'oggetto davanti a {dogName}: appena lo guarda, BRAVO + premietto",
        "Aumenta: oggetti in movimento, poi con un lieve rumore",
        "Obiettivo: guardare lo stimolo = aspettarsi una ricompensa, invece di montare l'agitazione",
      ],
      warum: "Allena lo schema emotivo che più tardi funzionerà all'aperto con stimoli reali. Puro lavoro preparatorio in casa, nessun rischio di escalation.",
    },
    {
      nummer: 3,
      name: "Respiro sincronizzato sulla coperta",
      ziel: "Trasmettere la riduzione dello stress attraverso la tua stessa calma",
      schritte: [
        "{dogName} sulla coperta, tu ti siedi accanto",
        "Respira consapevolmente profondo e lento, la mano ferma sul suo torace",
        "Dopo 2-3 minuti {dogName} sincronizza il respiro",
        "Mantieni 5-10 minuti — funziona anche dopo una passeggiata difficile",
      ],
      warum: "I cani leggono il tuo livello di stress. Chi si calma calma il proprio cane. Ben documentato scientificamente.",
    },
  ],
  mouthing: [
    {
      nummer: 1,
      name: "Piramide dello scambio in casa",
      ziel: "Costruire il LASCIA con valore crescente senza stress",
      schritte: [
        "Livello 1: dai a {dogName} un giocattolo noioso, dici LASCIA + scambi con un premietto",
        "Livello 2: giocattolo preferito, LASCIA + scambio con premietto",
        "Livello 3: osso da masticare, LASCIA + pollo come mega-scambio",
        "Importante: restituisci l'oggetto dopo 3 sec — lo scambio finisce in positivo",
        "1 livello al giorno, per una settimana",
      ],
      warum: "Il LASCIA deve essere solido prima dei punti critici all'aperto. Il valore crescente per gradi è l'unica via senza avvelenare il segnale.",
    },
    {
      nummer: 2,
      name: "Ricerca della ricompensa invece della raccolta",
      ziel: "Alternativa per l'istinto di ricerca durante la passeggiata",
      schritte: [
        "Prima della passeggiata: 20 premietti in tasca",
        "Quando {dogName} va a terra annusando: lancia 2-3 premietti nell'erba",
        "Di' CERCA — {dogName} cerca la ricompensa concessa invece di rifiuti casuali",
        "Nell'arco di 2 settimane: prima controlla te, poi il terreno",
      ],
      warum: "L'istinto di ricerca viene soddisfatto senza che {dogName} raccolga tutto. La tasca diventa un fornitore migliore del terreno.",
    },
    {
      nummer: 3,
      name: "Memory del LASCIA con tre oggetti",
      ziel: "LASCIA anche con più tentazioni di fila",
      schritte: [
        "Disponi 3 oggetti diversi (osso, giocattolo, un cartone innocuo)",
        "{dogName} ne prende uno: LASCIA + scambio + togliere l'oggetto-1",
        "Lascia che prenda il successivo: LASCIA + scambio + via",
        "5 giri per sessione — {dogName} impara: ogni volta che lascia ne vale la pena",
      ],
      warum: "Più LASCIA di seguito costruisce tolleranza alla frustrazione. Nella quotidianità all'aperto raramente c'è un solo ritrovamento.",
    },
  ],
  recall: [
    {
      nummer: 1,
      name: "Richiamo a nascondino",
      ziel: "Radicare il VIENI-QUI con grande entusiasmo nel gioco",
      schritte: [
        "Una seconda persona trattiene delicatamente {dogName}",
        "Tu ti nascondi a 5-10m, poi chiami allegramente VIENI-QUI",
        "{dogName} viene lasciato andare — ti cerca attivamente",
        "All'arrivo: ricompensa MEGA, entusiasmo, gioco",
        "10-15 giri fanno miracoli, più di qualsiasi esercizio a secco",
      ],
      warum: "Cercare + trovare + successo = l'associazione più forte. Il VIENI-QUI diventa un momento emozionante invece di un segnale obbligato.",
    },
    {
      nummer: 2,
      name: "Ricompensa col lancio del premietto",
      ziel: "Rendere il richiamo attraente per i cani con forte istinto predatorio",
      schritte: [
        "Tieni un sacchetto con premietti di valore particolarmente alto (pollo, formaggio)",
        "A ogni VIENI-QUI: all'arrivo lancia 2-3 premietti uno dopo l'altro davanti alle sue zampe",
        "{dogName} insegue la ricompensa — l'istinto predatorio viene soddisfatto",
        "Progressione: solo 1 richiamo su 3 con il lancio, gli altri in modo classico",
      ],
      warum: "I cani con istinto predatorio hanno bisogno di movimento nella ricompensa, non solo di un premietto dalla mano. Rende il VIENI-QUI l'opzione più attraente della passeggiata.",
    },
    {
      nummer: 3,
      name: "Fischietto in tre livelli",
      ziel: "Condizionare in modo preciso il fischietto come secondo segnale",
      schritte: [
        "In casa livello 1: fischio breve + ricompensa immediata. 10 volte al giorno, 5 giorni",
        "Livello 2: fischio breve, {dogName} arriva da 3m di distanza: ricompensa",
        "Livello 3: fischio breve all'aperto da 10m, alla longhina: ricompensa MEGA",
        "Non usare mai il fischietto per cose negative — resta il backup positivo",
      ],
      warum: "Il fischietto arriva più lontano della voce, suona sempre uguale (per quanto tu sia stressato) ed è più affidabile della parola in emergenza.",
    },
  ],
  barking: [
    {
      nummer: 1,
      name: "Marcatore del silenzio per le pause di quiete",
      ziel: "Rinforzare attivamente le fasi di silenzio invece di gestire solo l'abbaiare",
      schritte: [
        "Appena {dogName} non abbaia per 3 secondi dopo una pausa dall'abbaiare: SILENZIO + premietto morbido",
        "Importante: non aspettare che abbai — il silenzio è la ricompensa",
        "8-10 volte al giorno, in ogni fase tranquilla",
        "Dopo 2 settimane: {dogName} cerca attivamente le fasi di silenzio, perché ne vale la pena",
      ],
      warum: "I cani imparano più in fretta cosa devono OTTENERE che cosa devono EVITARE. Rinforzare il silenzio batte qualsiasi rimedio anti-abbaio.",
    },
    {
      nummer: 2,
      name: "Condizionamento con la registrazione del campanello",
      ziel: "Riapprendere emotivamente il suono del campanello senza usare il campanello vero",
      schritte: [
        "Registra il suono del campanello sul cellulare (il proprio campanello, fedele all'originale)",
        "Riproducilo in casa a basso volume — contemporaneamente un premietto in bocca",
        "Dopo 10 ripetizioni: alza leggermente il volume",
        "Nell'arco di 2 settimane: al suono reale del campanello {dogName} si aspetta un premietto, invece di agitarsi",
      ],
      warum: "Controcondizionamento classico. Ricostruisci la reazione PRIMA di lavorare con ospiti veri al campanello.",
    },
    {
      nummer: 3,
      name: "Controllo dei tre secondi",
      ziel: "Accorciare le fasi di abbaio voltandosi in modo coerente",
      schritte: [
        "Appena {dogName} abbaia: ti volti senza commentare, non lo guardi",
        "Appena 3 sec di silenzio: SILENZIO + premietto + attenzione tranquilla",
        "La coerenza è decisiva — un familiare che guarda sabota l'esercizio",
        "Dopo 7 giorni: l'abbaiare per attenzione si riduce in modo misurabile",
      ],
      warum: "L'abbaiare per attenzione viene rafforzato da OGNI reazione — anche dal rimprovero. Voltarsi è l'unica risposta pulita.",
    },
  ],
  anxiety: [
    {
      nummer: 1,
      name: "Gioco chiavi-caramella",
      ziel: "Disaccoppiare gli stimoli del commiato senza andarsene",
      schritte: [
        "Prendi le chiavi in mano, falle tintinnare una volta — dai subito un premietto",
        "Riponi le chiavi, NESSUNA uscita",
        "10-15 volte al giorno, del tutto indipendentemente dall'uscita reale",
        "Dopo 2 settimane: il tintinnio delle chiavi genera l'attesa di una ricompensa invece della paura",
      ],
      warum: "Gli stimoli di preparazione montano lo stress molto prima che tu apra la porta. Il disaccoppiamento è il cuore di ogni terapia dell'ansia da separazione.",
    },
    {
      nummer: 2,
      name: "Kong da solo sulla coperta di sicurezza",
      ziel: "Costruire passo dopo passo l'esperienza dello stare da solo",
      schritte: [
        "Prepara un Kong speciale (solo per il tempo da solo, mai altrimenti) — cibo umido congelato",
        "{dogName} riceve il Kong sulla coperta, tu lasci la stanza per 2-3 minuti",
        "Osserva via video: lavora al Kong o mostra stress?",
        "Se lavora con calma: livello successivo 5 min, 10 min, 20 min",
      ],
      warum: "Il Kong diventa lo strumento esclusivo per lo stare da solo. Lo stress viene abbinato a un'attività — ha qualcosa da fare, invece di concentrarsi sull'assenza.",
    },
    {
      nummer: 3,
      name: "Routine dell'entra-esci senza drammi",
      ziel: "Rendere le routine alla porta così banali da non innescare più stress",
      schritte: [
        "Più volte al giorno: apri la porta, esci un attimo, rientra",
        "Nessuna parola, nessun contatto visivo con {dogName}, né all'entrata né all'uscita",
        "Aumenta: 30 sec fuori, 2 min, 5 min — ogni volta senza clamore",
        "Il rincontro è tranquillo, non gioioso e rumoroso",
      ],
      warum: "I saluti drammatici dicono al cane: questo è un evento importante. La banalità toglie significato alla separazione.",
    },
  ],
  jumping: [
    {
      nummer: 1,
      name: "Lotteria delle quattro zampe",
      ziel: "Rendere il contatto con il pavimento la ricompensa standard",
      schritte: [
        "Più volte al giorno con naturalezza: 4 zampe a terra = con calma metti un premietto tra le zampe anteriori",
        "Del tutto non richiesto, semplicemente passando",
        "Se {dogName} salta: nessuna reazione, allontanati",
        "Dopo 10 giorni: cerca attivamente il pavimento, perché pavimento = ricompensa",
      ],
      warum: "Il saltare addosso non viene eliminato con l'addestramento, ma sostituito da un'alternativa più attraente. Il contatto con il pavimento ripaga.",
    },
    {
      nummer: 2,
      name: "Seduto prima del ciao",
      ziel: "Stabilire il SEDUTO come reazione automatica di saluto",
      schritte: [
        "A OGNI saluto (famiglia, te stesso, ospite): chiedi prima il SEDUTO, poi saluta con gentilezza",
        "Se {dogName} si alza per saltare: stop alle carezze, allontanati, ricomincia",
        "Briefing della famiglia: tutti collaborano, altrimenti una persona sabota il lavoro",
        "Dopo 14 giorni: {dogName} si siede da solo a ogni saluto",
      ],
      warum: "Il saluto è il momento di condizionamento numero 1. La coerenza a ogni ciao rende 10 volte tanto, l'incoerenza cancella l'apprendimento.",
    },
    {
      nummer: 3,
      name: "Coperta al posto della porta",
      ziel: "Reindirizzare la reazione al campanello: alla coperta invece che alla porta",
      schritte: [
        "Posiziona la coperta a 3m dalla porta, con l'oggetto da masticare preferito",
        "Esercizi a secco: suono del campanello (cellulare), segnale COPERTA, {dogName} corre alla coperta",
        "Ricompensa sulla coperta, mai alla porta",
        "Dopo 1 settimana ospiti veri: uno suona, uno dentro con la ricompensa alla coperta",
      ],
      warum: "La zona della porta è il punto di massima eccitazione. Chi vuole andare lì, salta. La coperta crea lo spostamento spaziale — l'eccitazione non può scaricarsi.",
    },
  ],
  destructive: [
    {
      nummer: 1,
      name: "Rotazione dei masticabili in sette giorni",
      ziel: "Mantenere attraenti gli oggetti da masticare consentiti",
      schritte: [
        "Procurati 5-7 oggetti da masticare diversi: pelle di bufalo, osso di legno, tappetino olfattivo, Kong, masticabili naturali",
        "Ogni giorno si mette a disposizione UN oggetto, tutti gli altri via",
        "Rotazione giornaliera: dopo 7 giorni ogni oggetto torna interessante",
        "Materiale proibito (scarpe, divano): proattivamente fuori portata, non tramite punizione",
      ],
      warum: "Lo stesso masticabile ogni giorno annoia. La rotazione mantiene alta l'attrattiva senza dover comprare di continuo.",
    },
    {
      nummer: 2,
      name: "Addestramento al kennel con attività",
      ziel: "Stabilire il kennel o una zona come luogo tranquillo di attività",
      schritte: [
        "Apri il kennel, metti dentro Kong/tappetino olfattivo — sportello aperto",
        "{dogName} può entrare/uscire, l'attività avviene solo all'interno",
        "Nell'arco di 2 settimane: entra da solo per l'attività",
        "Livello 2: lascia lo sportello chiuso per 5 min, con il Kong attivo — se ne accorge appena",
      ],
      warum: "Zona sicura per le fasi da solo + previene la distruzione di oggetti all'esterno. Il kennel è uno strumento, non una punizione.",
    },
    {
      nummer: 3,
      name: "Caccia al tesoro in soggiorno",
      ziel: "Scaricare l'energia con il naso invece che con i denti",
      schritte: [
        "Nascondi 10 piccoli premietti in soggiorno — sotto i cuscini, dietro le gambe dei mobili, leggermente rialzati",
        "{dogName} riceve il segnale CERCA, tu ti rilassi indietro",
        "10-15 min di ricerca concentrata",
        "3-4 volte a settimana — sostituisce una passeggiata nei giorni di pioggia",
      ],
      warum: "La voglia di masticare e distruggere cala in modo misurabile dopo il lavoro di naso. Naso stanco = zampe tranquille.",
    },
  ],
  soiling: [
    {
      nummer: 1,
      name: "Condizionamento della parola per la pipì",
      ziel: "Costruire un comando per fare la pipì — prezioso in viaggio",
      schritte: [
        "Appena {dogName} inizia a fare la pipì all'aperto: di' con calma la parola PIPI-PIPI",
        "Durante l'atto NON lodare (distrae), DOPO: BRAVO + mega-premietto",
        "Nell'arco di 3-4 settimane la parola si collega all'atto",
        "Più tardi: in luoghi nuovi o prima di lunghi viaggi in auto di' PIPI-PIPI in modo mirato",
      ],
      warum: "Più avanti fa risparmiare ore in modalità 'ferma e aspetta'. Una parola invece di sperare.",
    },
    {
      nummer: 2,
      name: "Tracker dell'acqua per 7 giorni",
      ziel: "Riconoscere la correlazione tra quantità d'acqua e incidenti",
      schritte: [
        "Al mattino segna la ciotola dell'acqua (nastro all'altezza del pieno)",
        "Documenta ogni giorno: quanto ha bevuto, quando, quanti incidenti",
        "Dopo 7 giorni lo schema è visibile: beve troppo in una volta, troppo poco al mattino, ecc.",
        "Adattamento: riduzione dell'acqua 2h prima di dormire in caso di incidenti notturni",
      ],
      warum: "La pulizia in casa è spesso una questione di tempi e quantità, non di disciplina. I dati mostrano il problema in fretta.",
    },
    {
      nummer: 3,
      name: "Routine del campanello sulla maniglia",
      ziel: "{dogName} segnala da solo quando deve uscire",
      schritte: [
        "Fissa un campanellino alla maniglia della porta",
        "Prima di ogni giro dei bisogni: la tua mano sul campanello, un colpetto",
        "Apri la porta, esci, ricompensa nel posto della pipì",
        "Dopo 3 settimane: {dogName} colpisce da solo il campanello quando deve uscire",
      ],
      warum: "Dà a {dogName} un modo chiaro di comunicare il bisogno. Riduce gli incidenti dovuti a malintesi.",
    },
  ],
};

// ════════════════════════════════════════════════════════════════════
// Hauptfunktion
// ════════════════════════════════════════════════════════════════════

export function composePlan(args: ComposeArgs): TrainingPlanContent {
  const { problem, planLengthMonths, dog, introText, zieleText, abschlussText, customProblemText } = args;
  const weeksTotal = planLengthMonths * 4;
  const monthsTotal = planLengthMonths;

  const problemLabel = PROBLEM_LABELS_DE[problem] || problem;
  const dogName = dog.dogName || "il tuo cane";

  // Pool für Exercise-Lookup
  let rawPool = EXERCISE_LIBRARY[problem] || [];
  if (rawPool.length === 0) {
    rawPool = EXERCISE_LIBRARY.pulling || [];
    console.warn(`[plan-composer] kein Pool für "${problem}" — Fallback pulling`);
  }
  const filteredPool = filterSuitable(rawPool, dog);
  const pool = filteredPool.length > 0 ? filteredPool : rawPool;
  const exById = new Map<string, ExerciseTemplate>();
  for (const e of pool) exById.set(e.id, e);

  // Problem-spezifische Wochen-Templates. Fallback: pulling (Aufmerksamkeit
  // + Impulskontrolle sind universell hilfreich), bis dedizierte Libraries
  // für alle 10 Probleme stehen.
  const WEEK_LIBRARIES: Record<ProblemKey, Record<Phase, WeekTemplate[]>> = {
    pulling: PULLING_WEEKS,
    energy: ENERGY_WEEKS,
    aggression: AGGRESSION_WEEKS,
    mouthing: MOUTHING_WEEKS,
    recall: RECALL_WEEKS,
    barking: BARKING_WEEKS,
    anxiety: ANXIETY_WEEKS,
    jumping: JUMPING_WEEKS,
    destructive: DESTRUCTIVE_WEEKS,
    soiling: SOILING_WEEKS,
  };
  const weekTpls = WEEK_LIBRARIES[problem];

  const ranges = phaseRanges(weeksTotal);
  const weeks = [];

  // Tracking: pro Exercise-ID wievielte Verwendung im aktuellen Plan.
  // Bei Wiederholung (2., 3., 4. Mal) bekommt die Übung einen Stufen-Marker
  // im Titel plus eine konkrete Steigerung als ersten Schritt. So merkt der
  // Halter: das ist nicht 1:1 dieselbe Übung, hier kommt was Neues dazu.
  const exerciseUsageCount = new Map<string, number>();

  // Festigungs-Modus: wenn eine Übung wiederholt wird und keine variant
  // definiert ist, läuft eine eigene Reflexions-Choreografie ab —
  // KEIN Copy-Paste der Original-Schritte. So entsteht kein Widerspruch,
  // und der Halter bekommt eine echte Reflexions-Anleitung statt nochmal
  // den gleichen Text zu lesen wie in Woche X.
  function buildFestigungsSchritte(e: ExerciseTemplate, phase: Phase): string[] {
    const exTitle = personalize(e.title, dog);
    const dogN = dog.dogName || "il tuo cane";
    const grundDetail =
      phase === "fundament"
        ? "Le basi devono prima essere sicure, prima di aumentare."
        : phase === "steigerung"
          ? "Questa fase è un investimento — chi qui lavora in modo preciso, in fase 3 avrà i progressi più grandi."
          : "Nella quotidianità ogni comportamento ha bisogno di più ripetizioni prima di diventare un automatismo.";

    return [
      `Questa settimana consolidi l'esercizio "${exTitle}". ${grundDetail} Invece di costruire nuovi contenuti, guardi in modo mirato ciò che è ancora incerto.`,
      `Giorno 1: Osservare senza addestrare. Quale passaggio dell'esercizio funziona già in sicurezza, quale no? Osserva ${dogN} con attenzione e annota 2-3 osservazioni concrete.`,
      `Giorno 2-3: Individua L'UNICO passaggio che non è ancora al 100%. Non due o tre — uno. Concentrati questa settimana solo su questo punto, invece di ripercorrere tutto l'esercizio.`,
      `Giorno 4-5: 3-5 mini-ripetizioni mirate al giorno SOLO su questo punto. Sessioni più brevi, ma più precise. Esempio: se il marcatore è sicuro in casa ma incerto all'aperto, ti eserciti all'aperto — non in casa.`,
      `Giorno 6: Richieste più basse del solito. Riduci il punto debole alla forma più semplice che ${dogN} riesce a fare in modo affidabile. Il successo conta più del ritmo.`,
      `Giorno 7: Fai il punto. Il punto debole è diventato più stabile? Se sì: la prossima settimana l'esercizio riprende normalmente. Se no: un'altra settimana di consolidamento o ritorno al livello precedente.`,
      `I passaggi concreti dell'esercizio si trovano nella settimana in cui l'esercizio è stato introdotto. Questa settimana di consolidamento è un approfondimento mirato, non un nuovo apprendimento.`,
    ];
  }

  function buildExerciseFromTemplate(e: ExerciseTemplate, phase: Phase) {
    const prevCount = exerciseUsageCount.get(e.id) || 0;
    const stage = prevCount + 1;
    exerciseUsageCount.set(e.id, stage);

    const baseTitle = personalize(e.title, dog);
    const baseSteps = e.steps.map((s) => personalize(s, dog));

    if (stage === 1) {
      return { name: baseTitle, schritte: baseSteps, stage };
    }

    // Bei Wiederholung mit definierter Variant: KOMPLETT andere Schritte
    // (keine Mischung mit Base-Steps mehr, die widerspricht).
    const variant =
      Array.isArray(e.variants) && stage - 2 < e.variants.length
        ? e.variants[stage - 2]
        : null;

    if (variant) {
      const suffix = variant.titleSuffix || `Livello ${stage}`;
      return {
        name: `${baseTitle} — ${suffix}`,
        schritte: variant.steps.map((s) => personalize(s, dog)),
        stage,
      };
    }

    // Festigungs-Modus: eigene Reflexions-Schritte, kein Copy-Paste.
    return {
      name: `${baseTitle} — Settimana di consolidamento`,
      schritte: buildFestigungsSchritte(e, phase),
      stage,
    };
  }

  for (let w = 1; w <= weeksTotal; w++) {
    const phase = phaseForWeek(w, weeksTotal);
    // Position der Woche INNERHALB der Phase (1-basiert)
    const positionInPhase = w - ranges[phase].start + 1;

    // Aus den 8 Templates pro Phase die richtige nehmen.
    // Falls weniger Wochen als Templates, nimm die ersten der Reihe nach.
    const phaseTpls = weekTpls[phase];
    const tpl = phaseTpls[Math.min(positionInPhase - 1, phaseTpls.length - 1)];

    // Übungen aus den im Template hinterlegten IDs ziehen — Progressions-
    // Tracking sorgt dafür dass Wiederholungen als Stufe 2/3/4 erscheinen.
    const uebungen = tpl.exerciseIds
      .map((id) => exById.get(id))
      .filter((e): e is ExerciseTemplate => !!e)
      .map((e) => buildExerciseFromTemplate(e, phase));

    // Falls keine Übung gefunden (anderes Problem mit pulling-fallback und
    // ID nicht im Pool), nimm die erste passende Übung der Phase.
    if (uebungen.length === 0) {
      const fallback = pool.find((e) => e.phase === phase);
      if (fallback) {
        uebungen.push(buildExerciseFromTemplate(fallback, phase));
      }
    }

    // Falls nur eine Übung verfügbar war: zweite Übung aus dem Phase-Pool
    // ergänzen, damit jede Woche mindestens 2 Übungen hat. Bevorzugt eine,
    // die im aktuellen Plan noch nicht (oder seltener) verwendet wurde.
    if (uebungen.length === 1) {
      const usedIds = new Set(tpl.exerciseIds);
      const filler = pool
        .filter((e) => e.phase === phase && !usedIds.has(e.id))
        .sort((a, b) => (exerciseUsageCount.get(a.id) || 0) - (exerciseUsageCount.get(b.id) || 0))[0];
      if (filler) {
        uebungen.push(buildExerciseFromTemplate(filler, phase));
      }
    }

    // Schwerpunkt-Text dynamisch anpassen, wenn die Wochen-Übungen
    // schon in einer höheren Stufe laufen. So kein Widerspruch mehr
    // zwischen "Wir verknüpfen ein Wort..." (Erst-Einführung) im
    // Schwerpunkt-Text und einer Stufe-3-Übung darunter.
    const maxStage = Math.max(0, ...uebungen.map((u) => (u as any).stage || 1));
    let weekSchwerpunkt = personalize(tpl.schwerpunkt, dog);
    if (maxStage >= 2) {
      const verb = maxStage === 2 ? "approfondiamo" : maxStage === 3 ? "consolidiamo" : "radichiamo nella quotidianità";
      const intro = uebungen
        .filter((u) => (u as any).stage > 1)
        .map((u) => {
          const cleanName = u.name
            .replace(/ — Settimana di consolidamento$/, "")
            .replace(/ — .+$/, "");
          return cleanName;
        })
        .slice(0, 2)
        .join(" e ");
      weekSchwerpunkt = `Questa settimana ${verb} l'esercizio già introdotto "${intro}". ${weekSchwerpunkt}`;
    }

    weeks.push({
      num: w,
      title: personalize(tpl.title, dog),
      schwerpunkt: weekSchwerpunkt,
      wochenziele: tpl.wochenziele.map((z) => personalize(z, dog)),
      tagesplan: personalize(tpl.tagesplan, dog),
      no_gos: tpl.no_gos.map((n) => personalize(n, dog)),
      fortschritt: tpl.fortschritt.map((f) => personalize(f, dog)),
      uebungen: uebungen.map((u) => ({ name: u.name, schritte: u.schritte })),
    });
  }

  // Tonfall je Plan-Länge: 1M = kompakt + fokussiert, 3M = solide mit Zeit
  // pro Schritt, 6M = entspannt + tief.
  const tempoBeschreibung =
    planLengthMonths === 1
      ? `Quattro settimane sono un percorso compatto. Procediamo in modo mirato: prima gli strumenti più importanti, poi un rapido trasferimento nella quotidianità. Aspettati un ritmo serrato.`
      : planLengthMonths === 3
        ? `Dodici settimane sono un percorso rilassato. Hai tempo di costruire ogni passo in modo preciso, invece di correre. A settimana basta una cosa che sia davvero solida.`
        : `Sei mesi sono molto tempo, ed è proprio questo il vantaggio. Possiamo consolidare con calma ogni elemento, assorbire senza stress i piccoli passi indietro e alla fine raggiungere una vera generalizzazione, invece di un semplice condizionamento iniziale.`;

  const fallbackEinleitung = `Questo piano di addestramento è stato sviluppato appositamente per ${dogName} e il tema ${problemLabel}. Ti accompagna per ${weeksTotal} settimane passo dopo passo, dalle fondamenta tranquille in casa fino alla gestione sicura delle situazioni quotidiane difficili.\n\n${tempoBeschreibung}\n\nOgni esercizio è pensato per poter essere svolto senza conoscenze pregresse. Ti servono premietti morbidi, un guinzaglio, una coperta e soprattutto pazienza.`;

  // Problem-spezifisches Equipment-Briefing.
  const equipmentBriefings: Record<ProblemKey, string> = {
    pulling: `\n\nCheck dell'attrezzatura: lavora con una pettorina a Y ben aderente (la fascia ventrale sta DAVANTI al torace, l'incrocio mai sul collo). Il collare NON è adatto alla conduzione al guinzaglio, Halti/capestri per la testa/collari a punte sono tabù. Il guinzaglio dovrebbe essere lungo 2-3m, NESSUN guinzaglio estensibile.`,
    energy: `\n\nCheck dell'attrezzatura: tappetino olfattivo (ca. 30€), Kong Classic (misura adatta a ${dogName}), 2-3 giochi diversi di ricerca e attività (Trixie Mover, Buster Cube). Premietti da addestramento di alta qualità, morbidi e piccoli. Per dopo: longhina 5-10m in Biothane per la ricerca di tracce all'aperto.`,
    aggression: `\n\nCheck dell'attrezzatura IMPORTANTE: museruola a cesto (Baskerville Ultra o BUMAS, adattata individualmente — la fascetta di stoffa NON è adatta, blocca l'ansimare). Guinzaglio da 2m, NESSUN guinzaglio estensibile. Ricompensa di alta qualità (pollo, formaggio, salsiccia) SEMPRE a portata di mano. Pettorina per maggiore sicurezza in caso di reazione.`,
    mouthing: `\n\nCheck dell'attrezzatura: museruola a cesto (Baskerville Ultra) per i tratti ad alto rischio — impedisce la raccolta, ma NON blocca il bere o l'ansimare. Guinzaglio da 2m per i punti critici. Ricompensa di scambio di alta qualità sempre in tasca.`,
    recall: `\n\nCheck dell'attrezzatura: longhina da 5-10m in Biothane (la corda ustiona le mani), pettorina ben aderente (longhina MAI al collare). Fischietto per cani ACME 211.5 come segnale di backup. Ricompensa di alta qualità MEGA: pollo, formaggio, piccoli pezzi di salsiccia.`,
    barking: `\n\nCheck dell'attrezzatura: coperta di rilassamento (min. 60x80cm, posto fisso), registrazione del campanello sul cellulare per l'allenamento al campanello di casa, ricompensa di alta qualità per rinforzare il silenzio. Opzionale: musica di sottofondo (classica adagio) nelle fasi con stimoli esterni.`,
    anxiety: `\n\nCheck dell'attrezzatura: Kong Classic (misura adatta a ${dogName}) come strumento esclusivo per il tempo da solo, coperta di rilassamento come ancora di sicurezza, fotocamera dello smartphone o una smart camera con live streaming per osservare il tempo da solo. Riempimento del Kong di alta qualità (cibo umido, congelare = più difficile).`,
    jumping: `\n\nCheck dell'attrezzatura: il segnale SEDUTO deve essere prima affidabile. Coperta di rilassamento per accogliere gli ospiti. Un foglietto di briefing per la famiglia all'ingresso per gli ospiti. Premietti di alta qualità a portata di mano per ogni incontro.`,
    destructive: `\n\nCheck dell'attrezzatura: 4-5 oggetti da masticare diversi per la rotazione (masticabili naturali come pelle di bufalo/nervo di bue, Kong Classic, tappetino olfattivo, osso di legno, corno di cervo). NESSUN osso di pelle grezza — rischio di lesioni. Kennel o cancelletto per bambini per zone sicure da solo. Detergente enzimatico.`,
    soiling: `\n\nCheck dell'attrezzatura IMPORTANTE: detergente enzimatico (negozio di animali) per gli incidenti — un detergente normale non basta, l'odore resta per il cane. Ricompense di alta qualità a portata di mano per ogni giro dei bisogni. In caso di incidenti frequenti in cani adulti: controllo dal veterinario (cistite ecc.) prima di iniziare l'addestramento.`,
  };
  const equipmentBriefing = equipmentBriefings[problem] || "";

  // Phasen-Aufteilung explizit nach Plan-Länge: macht den Halter klar wo
  // Zeitpolster ist (3M/6M) bzw. wo es straff wird (1M).
  const phasenBeschreibung =
    planLengthMonths === 1
      ? `Il piano è suddiviso in tre fasi: fondamenta in casa (settimana 1-2), potenziamento all'aperto (settimana 3) e generalizzazione nella quotidianità (settimana 4). Con solo quattro settimane, ogni settimana deve essere solida prima di aprire la successiva.`
      : planLengthMonths === 3
        ? `Il piano è suddiviso in tre fasi: fondamenta in casa (settimana 1-4), potenziamento all'aperto (settimana 5-8) e generalizzazione nella quotidianità (settimana 9-12). Per ogni fase hai quattro settimane, il che dà margine in caso di plateau e passi indietro.`
        : `Il piano è suddiviso in tre fasi: fondamenta in casa (settimana 1-8), potenziamento all'aperto (settimana 9-16) e generalizzazione nella quotidianità (settimana 17-24). Otto settimane per fase permettono un vero allenamento in profondità, con settimane di mantenimento e trasferimento a più contesti.`;

  const fallbackAufbau = `${phasenBeschreibung}\n\nOgni settimana contiene obiettivi settimanali chiari, un piano giornaliero ed esercizi concreti con istruzioni passo dopo passo. Bastano una o due sessioni di addestramento ben fatte al giorno. La qualità batte la durata.${equipmentBriefing}`;
  // Problem-spezifischer Ziel-Satz, statt holpriger Direkt-Einsetzung
  const ZIEL_FORMULIERUNGEN: Record<ProblemKey, string> = {
    pulling: "camminare al guinzaglio molto più rilassato",
    energy: "regolare molto meglio la propria energia e trovare più spesso la calma",
    aggression: "affrontare in modo molto più rilassato gli incontri con altri cani, jogger e ciclisti",
    mouthing: "lasciare spontaneamente gli oggetti proibiti invece di difenderli",
    recall: "tornare al richiamo in modo affidabile e felice",
    barking: "abbaiare molto più di rado e in modo più controllato",
    anxiety: "riuscire a restare da solo più rilassato, senza stress da separazione",
    jumping: "salutare le persone con calma invece di saltare loro addosso",
    destructive: "distruggere le cose molto più di rado e trarre di più dalle attività consentite",
    soiling: "diventare stabilmente pulito in casa con una chiara routine dei bisogni",
  };
  const zielSatz = ZIEL_FORMULIERUNGEN[problem] || "rendere la vita insieme molto più serena";
  const fallbackZiele = `Alla fine delle ${weeksTotal} settimane ${dogName} riuscirà a ${zielSatz}. Non con la punizione o la pressione, ma con il rinforzo positivo e routine chiare. Capirai meglio ${dogName} e insieme a lui avrai una quotidianità più serena.`;

  return {
    intro: {
      headline: `Piano di ${planLengthMonths} mesi per ${dogName}`,
      // KI-Text (introText/zieleText/abschlussText) wird von Claude standardmäßig
      // mit weiblichen Pronomen geschrieben — daher auch hier durch personalize()
      // laufen lassen, damit bei Rüden korrekt auf er/ihn/sein geswappt wird.
      einleitung: personalize(introText || fallbackEinleitung, dog),
      aufbau: personalize(fallbackAufbau, dog),
      ziele: personalize(zieleText || fallbackZiele, dog),
    },
    weeks,
    monats_uebersichten: buildMonatsUebersichten(problem, weeksTotal, monthsTotal, dog, problemLabel, customProblemText),
    abschluss: personalize(
      abschlussText ||
        `Hai accompagnato ${dogName} in modo sistematico per ${weeksTotal} settimane, è un risultato vero. Mantieni le routine, osserva i piccoli progressi e resta paziente con entrambi. Il cambiamento non è una linea, ma un'onda.`,
      dog
    ),
    zusatz_spiele: (BONUS_BY_PROBLEM[problem] || []).map((bs) => ({
      ...bs,
      name: personalize(bs.name, dog),
      ziel: personalize(bs.ziel, dog),
      schritte: bs.schritte.map((s) => personalize(s, dog)),
      warum: personalize(bs.warum, dog),
    })),
  };
}
