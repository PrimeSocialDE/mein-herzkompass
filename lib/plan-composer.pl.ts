// Plan-Composer — deterministyczny + bardzo szybki (<50ms). WERSJA POLSKA.
//
// Zwraca TrainingPlanContent z:
//   - NAPRAWDĘ zindywidualizowanymi tygodniami (każdy tydzień ma własny temat, cel, plan dnia)
//   - 8 unikalnych szablonów tygodni na fazę → 24 różne tygodnie dla planu 6-miesięcznego
//   - Obszernymi, specyficznymi dla problemu przeglądami miesięcznymi
//
// UWAGA: to jest polski wariant pliku plan-composer.ts. Logika składania planu
// jest identyczna — przetłumaczone są WYŁĄCZNIE teksty widoczne dla użytkownika.
// Dane i etykiety pochodzą z wersji polskiej (exercise-library.pl), typy są
// współdzielone z oryginałem (exercise-library).

import {
  EXERCISE_LIBRARY_PL,
  PROBLEM_LABELS_PL,
} from "./exercise-library.pl";
import type { ProblemKey, Phase } from "./exercise-library";
// ExerciseTemplate (mit `variants`) kommt aus der PL-Datei — entkoppelt die
// polnische Seite von der uncommitteten deutschen variants-Rewrite.
import type { ExerciseTemplate } from "./exercise-library.pl";
import type { TrainingPlanContent } from "./member-plan-content";

export interface DogProfile {
  dogName: string;
  dogBreed?: string;
  dogAgeMonths?: number;
  dogSize?: "small" | "medium" | "large";
  /** "m" / "samiec" = pies, inaczej suka (domyślnie). W wersji PL nieużywane do gramatyki. */
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

// ── Helper personalizacji ───────────────────────────────────────────
// Wersja PL: BEZ zamiany zaimków (to była gramatyka niemiecka). Polskie
// teksty są sformułowane neutralnie płciowo, więc podstawiamy tylko {dogName}.
function personalize(text: string, dog: DogProfile): string {
  return text.replace(/\{dogName\}/g, dog.dogName || "Twój pies");
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

// ── Tematy tygodni: 8 unikalnych szablonów na fazę ──────────────────
// Każdy tydzień ma własny akcent + dobór ćwiczeń + rutynę dnia.
// Dla planu 6-miesięcznego używane są wszystkie 8, dla 3-miesięcznego
// pierwsze 4, dla 1-miesięcznego tylko pierwsze z każdej fazy.

interface WeekTemplate {
  title: string;
  schwerpunkt: string;        // 1-zdaniowy opis tematu
  wochenziele: string[];
  tagesplan: string;
  no_gos: string[];
  fortschritt: string[];
  exerciseIds: string[];      // 1-2 ID z puli danej fazy
}

// ── Szablony tygodni specyficzne dla PULLING ────────────────────────────
// Zbudowane tak, jak trener psów strukturyzuje plan chodzenia na luźnej smyczy:
// najpierw narzędzia (marker, komunikacja nagrodowa), potem TECHNIKA GŁÓWNA
// ("Bądź drzewem"), potem zastosowanie w codzienności, potem generalizacja.
const PULLING_WEEKS: Record<Phase, WeekTemplate[]> = {
  fundament: [
    {
      title: "Ustalenie markera: słowo DOBRZE",
      schwerpunkt: "Zanim zaczniesz pracę na smyczy, {dogName} musi zrozumieć, jak działa komunikacja nagrodowa. Sygnał PATRZ + wyraźne słowo-marker DOBRZE to podstawa wszystkiego, co nastąpi. Bez tej bazy każde późniejsze ćwiczenie na smyczy będzie tylko frustracją.",
      wochenziele: [
        "{dogName} reaguje w mieszkaniu na PATRZ w mniej niż 2 sekundy.",
        "Używasz słowa-markera DOBRZE konsekwentnie, w odpowiednim momencie.",
        "{dogName} łączy DOBRZE ze spokojną nagrodą, a nie z nakręcaniem się.",
      ],
      tagesplan: "Trzy mini-sesje po 3 minuty w ciągu dnia, w różnych pomieszczeniach: rano przed śniadaniem, w południe przed spacerem, wieczorem w salonie. {dogName} od początku uczy się sygnału w wielu kontekstach. Ważne: słowo-marker DOBRZE pada ZAWSZE w dokładnym momencie pożądanego zachowania, a NIE dopiero przy podawaniu smakołyka. To właśnie mowa markera.",
      no_gos: [
        "Nadużywanie DOBRZE jako słowa przywołującego (wabienie psa). DOBRZE potwierdza tylko poprawne zachowanie.",
        "Więcej niż 7 powtórzeń pod rząd — to przeciąża w pierwszym tygodniu.",
        "Wymaganie PATRZ już na zewnątrz — to faza 2.",
      ],
      fortschritt: [
        "{dogName} podnosi głowę na PATRZ w ciągu 2 sekund.",
        "Kontakt wzrokowy utrzymuje się co najmniej 1 sekundę.",
        "Przy DOBRZE {dogName} kieruje się już w stronę smakołyka, zanim mu go pokażesz.",
        "Rutyna przy drzwiach staje się spokojniejsza, napieranie przy zakładaniu smyczy zdarza się coraz rzadziej.",
      ],
      exerciseIds: ["p-schau", "p-stop-and-go"],
    },
    {
      title: "Bądź drzewem: technika główna w domu",
      schwerpunkt: "To najważniejszy tydzień całego planu. {dogName} uczy się mechaniki, którą wykorzystamy później na zewnątrz: napięta smycz = stoisz w miejscu, luźna smycz = idziemy dalej. Jeśli to dobrze usiądzie w domu, 80% pracy na smyczy będzie za tobą.",
      wochenziele: [
        "{dogName} zatrzymuje się przy napiętej smyczy i kieruje uwagę z powrotem na ciebie.",
        "Ty sam pozostajesz spokojny, milczący i bez szarpnięcia, gdy smycz się napina.",
        "{dogName} rozumie zasadę: ciągnięcie nie prowadzi dalej, lecz do zatrzymania.",
      ],
      tagesplan: "Dwa razy dziennie 5-7 minut treningu luźnej smyczy w mieszkaniu lub na korytarzu. Idź w swoim normalnym tempie, smycz luźna. Gdy tylko się napnie: natychmiast stań w miejscu, ŻADNYCH słów, ŻADNEGO szarpnięcia. Gdy {dogName} ustąpi: spokojne DOBRZE, idź dalej. W pierwszych dniach spodziewaj się 15-25 zatrzymań na sesję. To nie frustracja, to krzywa uczenia.",
      no_gos: [
        "Szarpanie lub ciągnięcie za smycz, gdy jest napięta. To pogarsza ciągnięcie.",
        "Zrzędzenie lub irytacja. Jesteś tylko spokojną konsekwencją.",
        "20 minut pod rząd w domu. Lepiej 2x 5 minut niż 1x 20.",
      ],
      fortschritt: [
        "Liczba zatrzymań na sesję maleje: dzień 1: 20+, dzień 7: poniżej 10.",
        "{dogName} odwraca głowę przy zatrzymaniu i szuka kontaktu wzrokowego.",
        "Podczas dalszego marszu smycz pozostaje luźna dłużej niż na początku tygodnia.",
      ],
      exerciseIds: ["p-baum", "p-leinenspiel-drinnen"],
    },
    {
      title: "Pozycja przy nodze jako złota strefa",
      schwerpunkt: "Teraz budujesz miejsce przy swojej nodze jako najcenniejszy punkt podczas chodzenia. Gdy to zaskoczy, {dogName} przychodzi tam dobrowolnie, bo się to opłaca. To pozytywne uzupełnienie techniki 'Bądź drzewem': tam czekanie = stanie w miejscu, tu chodzenie = przychodzi nagroda.",
      wochenziele: [
        "{dogName} aktywnie szuka pozycji przy nodze, bo się to opłaca.",
        "Nagrody padają ZAWSZE przy szwie nogawki, nigdy przed tobą.",
        "Przechodzisz 10 kroków pod rząd z {dogName} w pozycji przy nodze w domu.",
      ],
      tagesplan: "Jedna 7-minutowa sesja dziennie w mieszkaniu lub na korytarzu. Zacznij w postawie stojącej: nagradzaj 10x, gdy bark {dogName} znajduje się przy twoim kolanie. Potem 1 krok, nagroda. Potem 2 kroki. Potem 5. Przy 10 krokach pod rząd bez wysuwania się do przodu: jackpot 3 smakołyków i koniec. Kieszeń spodni po stronie psa zawsze pozostaje pełna smakołyków.",
      no_gos: [
        "Podawanie nagrody przed ciałem. W ten sposób wabisz do przodu i wzmacniasz ciągnięcie.",
        "Wabienie {dogName} do pozycji przy nodze zamiast czekania. Ma przychodzić sam z siebie.",
        "Praca dużymi krokami — małe kroki czynią pozycję czytelniejszą.",
      ],
      fortschritt: [
        "{dogName} po 1-2 sekundach stania samodzielnie wchodzi w pozycję przy nodze.",
        "10 kroków pod rząd bez wysuwania się do przodu jest wykonalne.",
        "Smycz pozostaje luźna przez całą sekwencję przy nodze.",
      ],
      exerciseIds: ["p-bei-fuss-belohnen", "p-schau"],
    },
    {
      title: "Rutyna przy drzwiach + koc jako kotwica",
      schwerpunkt: "Kto rusza podekscytowany, ciągnie przez cały spacer. W tym tygodniu ustanawiasz spokojną rutynę przy drzwiach ORAZ koc relaksacyjny jako kotwicę na przerwy, a później na sytuacje kawiarniane. Oba elementy uspokajają start i tempo.",
      wochenziele: [
        "{dogName} siedzi lub stoi spokojnie podczas zakładania smyczy.",
        "Drzwi otwierają się tylko przy luźnej smyczy.",
        "Koc staje się wyraźnie rozpoznawalnym miejscem odpoczynku.",
      ],
      tagesplan: "Rutyna przy drzwiach przy każdym spacerze. Dodatkowo 2x dziennie 5 minut treningu koca, najlepiej po głównym spacerze lub w spokojnej porze dnia. Koc leży na stałe w jednym miejscu — jako niezawodne miejsce wycofania także między sesjami treningowymi. Spokojny głos przy nagradzaniu na kocu, ŻADNEGO podekscytowanego chwalenia.",
      no_gos: [
        "Zakładanie smyczy, gdy {dogName} skacze — to wzmacnia nadpobudliwość z oczekiwania.",
        "Ruszanie w pośpiechu z braku czasu — to cofa cały tydzień.",
        "Używanie koca do kary lub time-outu — to zatruwa to miejsce.",
      ],
      fortschritt: [
        "{dogName} siada automatycznie podczas zakładania smyczy.",
        "Drzwi można otworzyć bez napierania.",
        "{dogName} kładzie się na WARUJ na kocu bez dyskusji.",
      ],
      exerciseIds: ["p-stop-and-go", "p-decke-drinnen"],
    },
    // Tygodnie 5-8 tylko dla planu 6-miesięcznego: pogłębienie fundamentu
    {
      title: "Bądź drzewem z mini-rozproszeniem",
      schwerpunkt: "{dogName} zna 'Bądź drzewem' w domu. W tym tygodniu testujesz to z małymi rozproszeniami: ktoś dzwoni do drzwi w środku, gra radio, kosz na pranie stoi na drodze. Mechanika pozostaje taka sama, ale bodźce stają się trudniejsze.",
      wochenziele: [
        "{dogName} utrzymuje mechanikę także przy bodźcach w tle.",
        "Rozpoznajesz, przy jakim poziomie rozproszenia twoja ręka reaguje za wcześnie lub za późno.",
        "Liczba zatrzymań na sesję pozostaje poniżej 10 mimo rozproszenia.",
      ],
      tagesplan: "Jedna 6-minutowa sesja dziennie, ale celowo z małym zakłóceniem: cicho gra radio, albo ktoś w sąsiednim pokoju robi hałas, albo kładziesz karton na podłodze jako bodziec wzrokowy. Samo ćwiczenie przebiega tak jak w tygodniu 2, ale {dogName} musi się skoncentrować mimo bodźca.",
      no_gos: [
        "Praca już z prawdziwymi bodźcami zewnętrznymi — na to jeszcze nie jesteśmy gotowi.",
        "Nakładanie kilku rozproszeń jednocześnie — jedno wystarczy.",
        "Kontynuowanie przy rosnącej częstości zatrzymań — obniż poziom rozproszenia.",
      ],
      fortschritt: [
        "{dogName} pozostaje skupiony mimo bodźca w tle.",
        "Mechanika staje się dla was obu automatyczna.",
        "Masz jasne wyobrażenie, które bodźce jeszcze przeciążą {dogName} na zewnątrz.",
      ],
      exerciseIds: ["p-baum", "p-schau"],
    },
    {
      title: "Dłuższe odcinki luźnej smyczy w domu",
      schwerpunkt: "Z 5 minut robi się 10 minut. {dogName} rozwija wytrzymałość w uważnym chodzeniu obok. Ponadto: ćwiczysz timing nagradzania — moment, w którym mówisz DOBRZE, robi całą różnicę.",
      wochenziele: [
        "{dogName} daje radę 8-10 minut luźnej smyczy w domu przy maks. 5 zatrzymaniach.",
        "Nagradzasz celowo DŁUGIE fazy luzu, a nie każdy krok.",
        "Pozycja przy nodze jest utrzymywana dłużej niż 10 kroków.",
      ],
      tagesplan: "Jedna 10-minutowa sesja dziennie w mieszkaniu i na korytarzu. Zaplanuj świadome fazy: 2 minuty intensywnie nagradzanej pozycji przy nodze, 3 minuty swobodnej luźnej smyczy z zatrzymaniami tam, gdzie trzeba, 2 minuty przy nodze, 3 minuty swobodnie. Zmieniaj częstość nagradzania: co 5 kroków → co 10 kroków → co 20.",
      no_gos: [
        "Zbyt szybkie zmniejszanie częstości nagradzania. W tej fazie lepiej za często niż za rzadko.",
        "'Przymykanie oka' na epizody ciągnięcia, bo się spieszycie. Konsekwencja jest wszystkim.",
        "Praca na tym samym odcinku — lepiej 2-3 różne pomieszczenia.",
      ],
      fortschritt: [
        "{dogName} utrzymuje koncentrację przez ponad 10 minut.",
        "Rozpoznajesz różnicę między 'ledwo luźną' a 'naprawdę luźną' smyczą i nagradzasz tylko prawdziwy luz.",
        "Sekwencje przy nodze stają się naturalnym wyborem, a nie poleceniem.",
      ],
      exerciseIds: ["p-leinenspiel-drinnen", "p-bei-fuss-belohnen"],
    },
    {
      title: "Zmiany tempa jako nowa zmienna",
      schwerpunkt: "Dotąd chodziłeś w stałym tempie. W tym tygodniu wprowadzasz zmiany tempa jako narzędzie skupiania uwagi. {dogName} uczy się orientować na ciebie, zamiast wybiegać do przodu. To sprawia, że spacery stają się bardziej zabawowe i zaangażowane.",
      wochenziele: [
        "{dogName} dopasowuje tempo przy zwolnieniu, bez napierania.",
        "Przy przyspieszeniu {dogName} nadąża, nie wybiegając naprzód.",
        "Zmiany tempa stają się normalną zmienną, a nie źródłem zamieszania.",
      ],
      tagesplan: "Jedna 7-minutowa sesja dziennie w mieszkaniu. Zacznij normalnie, potem nagle wolniej (o połowę wolniej) przez 10 kroków, normalnie, szybciej (półtora raza szybciej) przez 10 kroków, normalnie. Zmieniaj świadomie 6-8x na sesję. Nagradzaj KAŻDĄ poprawną zmianę słowem DOBRZE + smakołykiem w pozycji przy nodze.",
      no_gos: [
        "Zapowiadanie zmiany tempa głosem lub spojrzeniem. Mają być nieprzewidywalne.",
        "Więcej niż 8 zmian na sesję — to przeciąża.",
        "Szarpane zmiany — lepiej płynnie, ale wyraźnie.",
      ],
      fortschritt: [
        "{dogName} reaguje na zmianę tempa w ciągu 2 kroków.",
        "Pozycja przy nodze pozostaje stabilna podczas zmian.",
        "{dogName} częściej podnosi na ciebie wzrok, bo twoje tempo stało się nieobliczalne.",
      ],
      exerciseIds: ["p-tempo-wechsel", "p-schau"],
    },
    {
      title: "Sprawdzenie fundamentu i przygotowanie przejścia",
      schwerpunkt: "Ostatni tydzień fundamentu. Powtarzasz wszystkie elementy: marker, 'Bądź drzewem', pozycję przy nodze, zmiany tempa, rutynę przy drzwiach, koc. To, co jeszcze się chwieje, w tym tygodniu dostaje dodatkowy fokus. Faza 2 zaczyna się od prawdziwych bodźców zewnętrznych, tam nic nie może się chwiać.",
      wochenziele: [
        "Wszystkie 6 elementów działa powtarzalnie w domu.",
        "Masz bilans: co siedzi, co się chwieje, co w fazie 2 wymaga dodatkowej uwagi.",
        "{dogName} ma rozpoznawalną rutynę treningową w rozkładzie dnia.",
      ],
      tagesplan: "Dzień 1+2: 'Bądź drzewem' + pozycja przy nodze połączone w jednej 10-minutowej sesji. Dzień 3+4: zmiany tempa + rutyna przy drzwiach. Dzień 5: odświeżenie markera + luźna smycz w domu. Dzień 6+7: wydłużone sesje z kocem. Zrób w weekend uczciwy bilans.",
      no_gos: [
        "Praca już z prawdziwymi bodźcami zewnętrznymi — faza 2 jest w PRZYSZŁYM tygodniu.",
        "Ignorowanie słabych punktów — na zewnątrz ujawnią się natychmiast.",
        "Przeskakiwanie do następnej fazy z niecierpliwości. Lepiej dołożyć 1 tydzień, jeśli trzeba.",
      ],
      fortschritt: [
        "Wszystkie ćwiczenia działają bez przypominania podstawowych zasad.",
        "{dogName} sam z siebie proponuje pozycję przy nodze i 'Bądź drzewem'.",
        "Macie rutynę, która dla was obu wydaje się normalna.",
      ],
      exerciseIds: ["p-baum", "p-leinenspiel-drinnen"],
    },
  ],
  steigerung: [
    {
      title: "Bądź drzewem: pierwszy prawdziwy spacer",
      schwerpunkt: "Technika zatrzymania wychodzi na spokojną ulicę. {dogName} będzie zdziwiony, że stare rutyny ciągnięcia nagle przestały działać. Spodziewaj się 30-50 zatrzymań w pierwszej sesji. Każde zatrzymanie to moment nauki, nie krok wstecz.",
      wochenziele: [
        "'Bądź drzewem' działa na spokojnej ulicy lub na podwórku.",
        "Planujesz czas spaceru podwojony, bez stresu.",
        "{dogName} rozumie: mechanika w domu i na zewnątrz jest identyczna.",
      ],
      tagesplan: "Zaplanuj główny spacer tego tygodnia z podwójną ilością czasu. Wybierz spokojną ulicę bez głównego ruchu, bez wybiegu dla psów. Wyjdź jak zwykle i rób 'Bądź drzewem' przy każdej napiętej smyczy, bez słowa, bez szarpnięcia. Co jakiś czas, co 30 kroków, daj smakołyk w pozycji przy nodze, gdy jest luźno. Kończ zawsze w fazie luzu, nie po ciągnięciu.",
      no_gos: [
        "Już centrum miasta lub park z wieloma psami — to później faza 3.",
        "Gdy masz presję czasu: lepiej zostań w domu i poćwicz jeszcze raz w środku. Stres opiekuna zabija ćwiczenie.",
        "Przy zatrzymaniu jednak dogadywanie lub patrzenie. Posąg znaczy posąg.",
      ],
      fortschritt: [
        "Liczba zatrzymań na spacer maleje od dnia 1 (30+) do dnia 7 (poniżej 15).",
        "{dogName} sam z siebie szuka kontaktu wzrokowego po 2-3 zatrzymaniach.",
        "Czujesz się przy zatrzymaniach spokojniejszy i bardziej wprawny niż przy pierwszych próbach.",
      ],
      exerciseIds: ["p-baum-draussen", "p-bei-fuss-belohnen"],
    },
    {
      title: "Penalty Yards: gdy zatrzymanie nie wystarcza",
      schwerpunkt: "Niektóre psy potrzebują czegoś więcej niż tylko stania w miejscu. Gdy {dogName} ciągnie dalej mimo 30 sekund posągu, odwracasz się i idziesz z powrotem. Ciągnięcie staje się ślepą uliczką. Tę technikę stosujesz celowo, nie ciągle — inaczej straci swój efekt uczący.",
      wochenziele: [
        "Stosujesz Penalty Yards świadomie tylko przy uporczywym ciągnięciu, maks. 5x na spacer.",
        "{dogName} rozumie: ciągnięcie nie prowadzi do celu, lecz oddala od niego.",
        "'Bądź drzewem' pozostaje pierwszym wyborem, Penalty Yards drugim.",
      ],
      tagesplan: "Na spacer: najpierw dalej konsekwentnie 'Bądź drzewem'. TYLKO gdy {dogName} nie ustępuje przez 30+ sekund, przechodzisz w tryb Penalty Yards: spokojnie się odwróć, 5 kroków wstecz, potem znów w pierwotnym kierunku z deszczem nagród w pozycji przy nodze. Maksymalnie 5 epizodów Penalty na spacer, inaczej robi się frustrujące.",
      no_gos: [
        "Stosowanie Penalty Yards przy KAŻDYM ciągnięciu — to się wytępia.",
        "Szarpane odwracanie się lub sprawianie wrażenia zirytowanego. Przekazem jest ruch, nie kara.",
        "NIENAGRODZENIE przy ponownym poprawnym marszu. Nagroda przy wznowieniu to cały efekt nauki.",
      ],
      fortschritt: [
        "Liczba epizodów Penalty Yards na spacer maleje w ciągu tygodnia.",
        "{dogName} reaguje szybciej na pierwsze zatrzymanie ('Bądź drzewem') i rzadziej potrzebuje Penalty.",
        "Stosujesz Penalty Yards bez zastanowienia, gdy sytuacja tego wymaga.",
      ],
      exerciseIds: ["p-penalty-yards", "p-baum-draussen"],
    },
    {
      title: "Nagradzanie przy nodze w realnym otoczeniu",
      schwerpunkt: "To, co działało w domu, teraz wzmacniasz przy bodźcach. Pozycja przy nodze staje się złotą strefą wobec wszystkiego, co kusi na zewnątrz. Utrzymuj wysoką gęstość nagradzania, szczególnie w tej fazie. Redukcja przychodzi w fazie 3.",
      wochenziele: [
        "{dogName} aktywnie szuka pozycji przy nodze podczas spaceru.",
        "Nagrody padają co 15-20 kroków przy szwie nogawki, gdy jest luźno.",
        "Przy bodźcach (samochód, pies w oddali) {dogName} pozostaje w pozycji przy nodze dłużej niż 5 sekund.",
      ],
      tagesplan: "Zaczynaj KAŻDY spacer tego tygodnia od 3 minut intensywnego nagradzania przy nodze. Pełna kieszeń, co 5-7 kroków smakołyk przy szwie nogawki. Potem spacer normalnie dalej, ale: za każdym razem, gdy {dogName} sam z siebie wchodzi w pozycję przy nodze: jackpot 3 smakołyków. {dogName} uczy się: ta pozycja zawsze się opłaca.",
      no_gos: [
        "Podawanie nagrody przed ciałem. W ten sposób wabisz do przodu. Zawsze przy szwie nogawki.",
        "Ciągnięcie {dogName} do pozycji, gdy nie przychodzi. Lepiej stań i czekaj.",
        "Zbyt szybkie zmniejszanie gęstości nagradzania. Faza 2 = inwestycja w nagrody.",
      ],
      fortschritt: [
        "{dogName} na skrzyżowaniach lub w niepewnych miejscach sam z siebie wchodzi w pozycję przy nodze.",
        "Nie musisz już aktywnie wabić, pozycja stała się nawykiem.",
        "Nawet bez widoku smakołyka {dogName} orientuje się na ciebie.",
      ],
      exerciseIds: ["p-bei-fuss-belohnen", "p-baum-draussen"],
    },
    {
      title: "Zmiany tempa i zmiany kierunku na zewnątrz",
      schwerpunkt: "Zmiany tempa i zmiany kierunku stają się twoimi narzędziami skupiania uwagi. Stajesz się nieobliczalny w swoim chodzeniu. To zapobiega temu, by {dogName} wpadał w tryb autopilota, a ty byłeś ciągnięty za smyczą z tyłu.",
      wochenziele: [
        "Wplatasz 5-8 zmian tempa na spacer.",
        "Zmiany kierunku bez zapowiedzi stają się normalną zmienną.",
        "{dogName} częściej na ciebie patrzy, bo twoje tempo jest nieobliczalne.",
      ],
      tagesplan: "Planuj spacery świadomie na trasach z rozwidleniami, ścieżkami, skrzyżowaniami. Zmieniaj bez słów raz wolniej, raz szybciej, raz zupełnie kierunek. Nagradzaj KAŻDY moment dostosowania w pozycji przy nodze. Gdy {dogName} uparcie ciągnie dalej: zastosuj 'Bądź drzewem' lub Penalty Yards.",
      no_gos: [
        "Zapowiadanie zmiany tempa głosem — to odbiera efekt nauki.",
        "Więcej niż 10 zmian na spacer. Lepiej jakość.",
        "Produkowanie kolejnych zmian przy stresie lub wyczerpaniu.",
      ],
      fortschritt: [
        "{dogName} reaguje na zmiany tempa w ciągu 2 kroków.",
        "Spacery stają się bardziej komunikatywne i mniej mozolne.",
        "Stosujesz zmiany intuicyjnie jako reset uwagi.",
      ],
      exerciseIds: ["p-tempo-wechsel", "p-richtungswechsel-aussen"],
    },
    {
      title: "Praca nad spotkaniami z dystansu",
      schwerpunkt: "Pierwsze kontrolowane spotkania z psami lub biegaczami, z 15-20 m. {dogName} uczy się: pojawia się bodziec = przychodzi smakołyk, a nie ekscytacja. Ten tydzień jest istotny, jeśli ciągnięcie {dogName} wiąże się z reaktywnością.",
      wochenziele: [
        "{dogName} pozostaje przy spotkaniach z 15 m dystansu poniżej progu pobudzenia.",
        "Kontrwarunkowanie zaczyna działać.",
        "Pewnie rozpoznajesz indywidualny próg {dogName}.",
      ],
      tagesplan: "Dwa razy w tygodniu sesja spotkań: znajdź miejsce, gdzie regularnie w oddali przechodzą psy lub biegacze (skraj parku, trasa do biegania). Przy każdym bodźcu: PATRZ i karm nieprzerwanie, dopóki bodziec jest widoczny. Bodziec zniknął = smakołyki znikają. Maks. 5 spotkań na sesję.",
      no_gos: [
        "Zbyt blisko. Dystans jest wszystkim w tym ćwiczeniu.",
        "Kontynuowanie ćwiczenia powyżej progu pobudzenia — to krok wstecz.",
        "Nagroda dopiero PO reakcji. To nie zmienia powiązania emocjonalnego.",
      ],
      fortschritt: [
        "{dogName} przy bodźcach patrzy na ciebie z oczekiwaniem, zamiast się fiksować.",
        "Oznaki stresu stają się rzadsze i krótsze.",
        "Spotkania przebiegają bez szczekania i mocnego ciągnięcia.",
      ],
      exerciseIds: ["p-gegenkonditionierung", "p-baum-draussen"],
    },
    {
      title: "Łuk przy bliskich spotkaniach",
      schwerpunkt: "Niektórych spotkań nie da się rozpracować z 15 m — pies naprzeciwka już tu jest. {dogName} dostaje konkretną strategię działania: łuk. Zamiast iść wprost na siebie, obchodzicie się półkolem. To daje {dogName} poczucie bezpieczeństwa.",
      wochenziele: [
        "{dogName} podąża za sygnałem ŁUK bez oporu.",
        "Łuk stosowany jest zapobiegawczo, nie dopiero gdy pojawi się stres.",
        "Czujesz się na spacerach z ruchem naprzeciwka bardziej zdolny do działania.",
      ],
      tagesplan: "Ćwicz łuk przez pierwsze dni na sucho: przy latarniach, koszach na śmieci, ławkach. Gdy tylko ruch zaskoczy, stosuj go aktywnie przy prawdziwych spotkaniach. 2-3 sytuacje z łukiem na spacer. Po każdym udanym spotkaniu: jackpot 3-4 smakołyków w pozycji przy nodze.",
      no_gos: [
        "Stosowanie łuku z napięciem — to się przenosi.",
        "Stosowanie łuku dopiero gdy {dogName} jest już napięty, lepiej 10 m wcześniej.",
        "Bezpośredni kontakt wzrokowy z nadchodzącym psem lub człowiekiem.",
      ],
      fortschritt: [
        "{dogName} na ŁUK automatycznie wchodzi w półkole.",
        "Spotkania z łukiem przebiegają wyraźnie spokojniej.",
        "Stosujesz łuk odruchowo, gdy sytuacja tego wymaga.",
      ],
      exerciseIds: ["p-bogen", "p-baum-draussen"],
    },
    {
      title: "Dłuższe spacery treningowe",
      schwerpunkt: "Dotąd fazy treningowe trwały 10-15 minut. W tym tygodniu wydłużają się do 25-30 minut. {dogName} rozwija wytrzymałość w uważnym chodzeniu obok. Gęstość nagradzania pozostaje jednak wysoka.",
      wochenziele: [
        "{dogName} pozostaje skupiony przez 25-30 minut pod rząd.",
        "Przerwy są aktywnie wykorzystywane jako nagroda (węszenie, picie).",
        "Gęstość nagradzania jest wyraźnie stopniowana: pierwsze 10 min wysoka, środkowe 10 min średnia, ostatnie 5 min znów wysoka.",
      ],
      tagesplan: "W 3 dni tego tygodnia 25-30-minutowy spacer treningowy. Struktura: 5 min rozgrzewki przy nodze z wysoką częstością nagradzania, 15 min normalnej trasy z 'Bądź drzewem' i zmianami tempa, 5 min wyciszenia przy nodze. Świadome przerwy na węszenie co 7-10 minut jako NAGRODA za luźną smycz.",
      no_gos: [
        "25 minut pod rząd bez przerw — to zbyt szybko męczy.",
        "Kontynuowanie przy widocznym wyczerpaniu.",
        "Zostawianie przerw bez sygnału rozwiązującego. {dogName} potrzebuje wyraźnych przejść.",
      ],
      fortschritt: [
        "{dogName} wytrzymuje pełną fazę ćwiczenia bez załamania koncentracji.",
        "Przerwy są aktywnie wykorzystywane do regeneracji, nie do ekscytacji.",
        "Częstość nagradzania można w środkowej fazie zmniejszyć.",
      ],
      exerciseIds: ["p-baum-draussen", "p-tempo-wechsel"],
    },
    {
      title: "Utrwalenie fazy wzrostu",
      schwerpunkt: "Ostatni tydzień fazy wzrostu. Łączysz wszystkie narzędzia: 'Bądź drzewem', Penalty Yards, pozycję przy nodze, zmiany tempa. {dogName} ma kompletny repertuar. Faza 3 = zastosowanie w prawdziwej codzienności, bez kontrolowanych sesji ćwiczeniowych.",
      wochenziele: [
        "Wszystkie narzędzia można elastycznie łączyć.",
        "Wyraźnie rozpoznajesz, które narzędzie jest potrzebne w danej sytuacji.",
        "{dogName} stosuje niektóre strategie (przede wszystkim szukanie pozycji przy nodze) już częściowo samodzielnie.",
      ],
      tagesplan: "Każdy spacer tego tygodnia to mini-test. Obserwuj aktywnie: która strategia sprawdza się w której sytuacji? Zrób pod koniec tygodnia bilans: co działa, co się chwieje. Zanotuj typowe sytuacje ciągnięcia, które pozostają. To twój punkt ciężkości na fazę 3.",
      no_gos: [
        "Stosowanie narzędzi tylko pojedynczo — mają być elastycznie łączone.",
        "Przeciążanie {dogName} zbyt wieloma nowymi bodźcami. Faza 3 podejmuje wyzwanie.",
        "Zbyt wczesne, silne zmniejszanie częstości nagradzania. To dzieje się w fazie 3.",
      ],
      fortschritt: [
        "{dogName} stosuje aktywnie co najmniej 2 strategie na spacer.",
        "Musisz mniej interweniować, {dogName} częściej sam się reguluje.",
        "Spacery wydają się wyraźnie spokojniejsze niż 8 tygodni temu.",
      ],
      exerciseIds: ["p-schau", "p-penalty-yards"],
    },
  ],
  generalisierung: [
    {
      title: "Luźna smycz na prawdziwym codziennym spacerze",
      schwerpunkt: "Faza 3 to zastosowanie. Wszystkie narzędzia wchodzą teraz do użycia na normalnej trasie, bez kontrolowanych sesji ćwiczeniowych. Przerwy na węszenie stają się najbardziej naturalną nagrodą: luźna smycz = możesz podejść i powęszyć.",
      wochenziele: [
        "{dogName} pokonuje 25-minutowy codzienny spacer z maks. 5 prawdziwymi epizodami ciągnięcia.",
        "Świadomie wykorzystujesz przerwy na węszenie jako nagrodę za luźną smycz.",
        "Narzędzia (zatrzymanie, przy nodze, tempo) są płynnie łączone bez zastanowienia.",
      ],
      tagesplan: "W 5 z 7 dni normalny 25-30-minutowy spacer na znanej trasie. Zacznij od 2-3 minut nagradzania przy nodze, potem swobodny marsz z 'Bądź drzewem' przy napiętej smyczy. Co 30-40 kroków smakołyk w pozycji przy nodze, gdy jest luźno. Przerwy na węszenie aktywnie jako nagroda: 'luźna smycz = możesz podejść i powęszyć'.",
      no_gos: [
        "Pomijanie narzędzi przy stresie lub pośpiechu. Lepiej skróć trasę.",
        "Pozwalanie na przerwy na węszenie w środku fazy ciągnięcia. Najpierw luz, potem wolno węszyć.",
        "Silne zmniejszanie częstości nagradzania już teraz, to dzieje się w tygodniu 4.",
      ],
      fortschritt: [
        "Epizody ciągnięcia na spacer są w zakresie jednocyfrowym.",
        "{dogName} sam z siebie szuka pozycji przy nodze w niepewnych miejscach.",
        "Wykorzystujesz przerwy na węszenie intuicyjnie jako narzędzie nagradzania.",
      ],
      exerciseIds: ["p-lockere-leine-aussen", "p-penalty-yards"],
    },
    {
      title: "Różne trasy: generalizacja",
      schwerpunkt: "To, co działa na trasie spod domu, musi działać także na nowej trasie. Dopiero przez generalizację luźna smycz staje się prawdziwą umiejętnością, a nie rutyną przywiązaną do miejsca.",
      wochenziele: [
        "{dogName} przenosi luźną smycz na co najmniej 2 nowe trasy w tym tygodniu.",
        "Rozpoznajesz, że na nowych drogach zatrzymania znów się nasilają — to normalne.",
        "Częstość nagradzania na nowych trasach świadomie na krótko znów rośnie.",
      ],
      tagesplan: "Zaplanuj w tym tygodniu świadomie 3 różne trasy: twoją zwykłą, jedną nową w sąsiedniej miejscowości/parku, jedną w mieście. Na trasę maks. 25 minut. Na nowych trasach: częstość nagradzania jak w fazie 2 (co 15 kroków). Spodziewaj się znów częstszych zatrzymań. Narzędzia pozostają te same, zmienia się otoczenie.",
      no_gos: [
        "Oczekiwanie, że nowa trasa pójdzie tak jak zwykła.",
        "Trzy nowe trasy tego samego dnia — to przeciąża.",
        "Pozostawianie na nowej trasie takiej częstości nagradzania jak na zwykłej.",
      ],
      fortschritt: [
        "{dogName} pokonuje zupełnie nową trasę z mniej niż 10 zatrzymaniami.",
        "Czujesz się zdolny do działania także na nieznanych drogach.",
        "Wzorzec ciągnięcia zmniejsza się na wszystkich trasach.",
      ],
      exerciseIds: ["p-schau", "p-richtungswechsel-aussen"],
    },
    {
      title: "Mijanie ludzi bez łuku",
      schwerpunkt: "U psów z reaktywnym udziałem w ciągnięciu to kolejny stopień po ŁUKU. {dogName} uczy się mijać ludzi bezpośrednio z 3-5 m, bez łuku, bez zmiany tempa. Jeśli {dogName} ciągnie czysto, bez reaktywności: po prostu kontynuuj normalną pracę nad luźną smyczą.",
      wochenziele: [
        "{dogName} mija ludzi bezpośrednio z 3-5 m, w stałym tempie.",
        "Spotkania stają się normalną rutyną, a nie stresującym wydarzeniem.",
        "Rozpoznajesz próg {dogName} przy spotkaniach bezpośrednich.",
      ],
      tagesplan: "W 4 z 7 dni: znajdź świadomie 2-3 możliwości bezpośredniego spotkania na mniej uczęszczanych drogach. Przygotuj {dogName} już z 15 m sygnałem PATRZ + nagrodą w pozycji przy nodze. Utrzymuj stałe tempo — nie szybciej, nie wolniej. Podczas mijania: ciągłe małe smakołyki (kapanie). Po minięciu: jackpot.",
      no_gos: [
        "Próbowanie od razu w pełnym centrum miasta — to za dużo.",
        "Kontynuowanie przy stresie, w każdej chwili wróć do ŁUKU.",
        "Bezpośredni kontakt wzrokowy z osobą naprzeciwka. {dogName} odczytuje to jako napięcie.",
      ],
      fortschritt: [
        "{dogName} mija ludzi bez widocznego stresu.",
        "Podczas mijania nie musisz już ciągle zmieniać strategii.",
        "Spotkania stają się normalną rutyną spacerową.",
      ],
      exerciseIds: ["p-vorbeigang", "p-lockere-leine-aussen"],
    },
    {
      title: "Świadome zmniejszanie nagród",
      schwerpunkt: "Teraz systematycznie zmniejszasz częstość nagradzania. {dogName} uczy się, że strategia działa także bez ciągłego smakołyka. Ważne: nigdy nie rezygnuj CAŁKOWICIE — tylko rzadziej i bardziej nieprzewidywalnie.",
      wochenziele: [
        "Nagrody padają co 50-80 kroków zamiast co 15-20.",
        "Wybitne osiągnięcia nadal nagradzane są jackpotem.",
        "{dogName} utrzymuje strategie także przy rzadszych nagrodach.",
      ],
      tagesplan: "Zmniejszaj świadomie i stopniowo: dzień 1-2 co 30 kroków, dzień 3-4 co 50, dzień 5-7 co 60-80 nieregularnie. Przy wybitnych osiągnięciach (długa faza luzu, dobre mijanie) nadal jackpot 3-4 smakołyków. Przy sypaniu się (więcej ciągnięcia, słabsze szukanie pozycji przy nodze): krok wstecz do wyższej częstości.",
      no_gos: [
        "Całkowite rezygnowanie z nagród — to za szybko.",
        "Brnięcie dalej przy sypaniu się, zamiast dostosowania.",
        "Testowanie redukcji w stresujący dzień lub w trudnym miejscu.",
      ],
      fortschritt: [
        "{dogName} stosuje strategie także przy rzadszych nagrodach.",
        "Spacery wydają się swobodniejsze, mniej jak trening.",
        "Wkładasz mniej smakołyków w rękę, bez utraty jakości.",
      ],
      exerciseIds: ["p-wartungs-spaziergang", "p-lockere-leine-aussen"],
    },
    {
      title: "Trudne miejsca w sposób ukierunkowany",
      schwerpunkt: "Miejsca, których dotąd unikaliście: wejście do weterynarza, przystanek autobusowy, przed szkołami. W tym tygodniu stają się możliwymi miejscami, a nie strefami unikania. To naprawdę poprawia codzienność.",
      wochenziele: [
        "{dogName} spokojnie wytrzymuje 5 minut w trudnym miejscu.",
        "Znasz reakcję {dogName} na najważniejsze dla was punkty zapalne.",
        "Trudne miejsca stają się możliwą opcją, a nie strefą tabu.",
      ],
      tagesplan: "Wybierz na dzień dokładnie jedno trudne miejsce i ćwicz tam 5 minut. Dzień 1: okolica wejścia do weterynarza (bez wizyty). Dzień 2: przystanek autobusowy 200 m dalej. Dzień 3: wejście do parku w godzinie szczytu na wybiegu dla psów. Częstość nagradzania znów wyższa (jak w fazie 2). Już sam pobyt bez większej eskalacji to sukces.",
      no_gos: [
        "Wchodzenie od razu do weterynarza — korzystaj tylko z terenu na zewnątrz.",
        "Zmuszanie {dogName} do wytrzymania w miejscu, które jest zbyt trudne.",
        "Nakładanie kilku trudnych miejsc tego samego dnia.",
      ],
      fortschritt: [
        "{dogName} wytrzymuje każdy wybrany punkt zapalny 5 minut bez eskalacji.",
        "Chodzisz spokojniej do miejsc, które kiedyś oznaczały stres.",
        "Codzienność staje się elastyczniejsza, bo mniej stref jest tabu.",
      ],
      exerciseIds: ["p-cafe", "p-vorbeigang"],
    },
    {
      title: "Sytuacja kawiarniana jako dyscyplina królewska",
      schwerpunkt: "Z kocem jako mobilną kotwicą {dogName} uczy się leżeć spokojnie przez 15 minut w sytuacji kawiarnianej. To najtrudniejsze ćwiczenie planu i sprawia, że wasze życie staje się długofalowo znacznie spokojniejsze.",
      wochenziele: [
        "{dogName} kładzie się na kocu i pozostaje w leżeniu przez 15 minut.",
        "Częstość nagradzania jest powoli zmniejszana bez tego, by {dogName} wstawał.",
        "Kawiarnia staje się normalną możliwością, a nie przeszkodą.",
      ],
      tagesplan: "Zacznij 2x w tym tygodniu od mini-ćwiczenia kawiarnianego w parku: koc ze sobą, ułóż, usiądź obok na 5 minut. Zwiększaj powoli do spokojnego ogródka kawiarni przed południem. Nagradzaj w pierwszych 3 minutach co 15 sekund, potem co 30 sekund, potem co minutę. Kończ zawsze w spokojnej sytuacji, nie przy wstawaniu.",
      no_gos: [
        "Od razu w porze lunchu do kawiarni przy głównej ulicy.",
        "Praca bez koca — kotwica jest niezbędna.",
        "Ucieczka z kawiarni, gdy robi się ciasno — zamiast tego kończ spokojnie.",
      ],
      fortschritt: [
        "{dogName} leży 15 minut na kocu bez wstawania.",
        "Dźwięki i ruch wokół was prawie nie przeszkadzają.",
        "Możesz spokojnie wypić kawę, bez ciągłego kontrolowania.",
      ],
      exerciseIds: ["p-schau", "p-decke-drinnen"],
    },
    {
      title: "Spacer po mieście jako finałowa dyscyplina królewska",
      schwerpunkt: "Umiarkowany deptak. Wszystkie narzędzia w prawdziwym życiu miejskim. Jeśli to działa, nie masz już psa, który ciągnie, lecz psa, który idzie z tobą przez świat.",
      wochenziele: [
        "{dogName} pokonuje 20-25-minutowy spacer w umiarkowanym mieście.",
        "Narzędzia są elastycznie łączone zależnie od sytuacji.",
        "Znajdujecie spacer po mieście, który jest przyjemny dla was obu.",
      ],
      tagesplan: "Zaplanuj raz w tygodniu świadomy spacer po mieście, najlepiej w niedzielę przed południem, gdy jest mniej ruchu. Maksymalnie 25 minut. Zacznij od 3 minut rozgrzewki przy nodze przed drzwiami. Stosuj przerwy na węszenie aktywnie jako wyciszenie między fazami bodźców. Kończ zawsze w spokojnym zakątku.",
      no_gos: [
        "Odbębnianie spaceru po mieście jak obowiązku — lepiej przerwać.",
        "Wyprawa dla ego: chęć pokazania, że {dogName} wszystko potrafi.",
        "Bezpośrednie prowokowanie innych psów — w mieście spotkania są często ciasne.",
      ],
      fortschritt: [
        "{dogName} porusza się w umiarkowanym mieście zaskakująco spokojnie.",
        "Czujesz się przygotowany także na nieprzewidywalne bodźce.",
        "Spacery po mieście stają się możliwą rutyną, a nie wyjątkowym przedsięwzięciem.",
      ],
      exerciseIds: ["p-stadt-spaziergang", "p-lockere-leine-aussen"],
    },
    {
      title: "Przejście w tryb utrzymania",
      schwerpunkt: "Ostatni tydzień. To, co się tu dzieje, ma działać trwale. Przekazujesz odpowiedzialność stopniowo {dogName}, bez tego, by rutyny się załamały. Plan utrzymania na nadchodzące miesiące jest gotowy.",
      wochenziele: [
        "{dogName} stosuje strategie samodzielnie w codzienności.",
        "Nie musisz już aktywnie trenować, lecz żyjesz rutynami.",
        "Macie jasny plan utrzymania na nadchodzące miesiące.",
      ],
      tagesplan: "Zredukuj aktywny trening do minimum. Zamiast tego obserwuj: co działa samo z siebie? Gdzie jeszcze musisz interweniować? Zaplanuj rytm utrzymania: co 3-4 miesiące świadomy spacer ćwiczeniowy w trudnym miejscu. To utrzymuje powiązania świeżymi i wcześnie zauważasz, gdy coś zaczyna się załamywać.",
      no_gos: [
        "Nagłe porzucenie wszystkich rutyn — to grozi krokiem wstecz.",
        "Rozluźnienie się i zaprzestanie obserwacji — małe nawroty rozpoznawaj wcześnie.",
        "Odkładanie planu utrzymania na nigdy — krótkie sesje wystarczą.",
      ],
      fortschritt: [
        "{dogName} stosuje strategie bez aktywnego prowadzenia w codzienności.",
        "Czujesz się, jakbyście byli zgranym zespołem.",
        "Spacery to już nie trening, lecz wspólne życie.",
      ],
      exerciseIds: ["p-wartungs-spaziergang", "p-lockere-leine-aussen"],
    },
  ],
};

// ────────────────────────────────────────────────────────────────────
// ENERGY (za dużo energii / nadpobudliwość) — zaspokojenie potrzeb i trening spokoju
// ────────────────────────────────────────────────────────────────────
const ENERGY_WEEKS: Record<Phase, WeekTemplate[]> = {
  fundament: [
    {
      title: "Inwentaryzacja energii i higiena snu",
      schwerpunkt: "Zanim zaczniesz pracę nad zaspokojeniem potrzeb, przyjrzyj się rozkładowi dnia. Dorosłe psy potrzebują 16-20 godzin odpoczynku na dobę. Nadpobudliwe psy często śpią ZA MAŁO. To najczęstszy błąd opiekunów w ogóle.",
      wochenziele: [
        "Dokumentujesz przez tydzień rozkład dnia {dogName}, wraz z fazami snu.",
        "Wbudowane zostają świadome fazy odpoczynku, min. 14 godz. na dobę.",
        "Fazy aktywności są ustrukturyzowane między ruch, pracę węchową, pracę umysłową i kontakt społeczny.",
      ],
      tagesplan: "Notuj przez 7 dni w małym notatniku: kiedy {dogName} się budzi, kiedy śpi, jak długo jest aktywny, jaka to była aktywność (spacer, zabawa, przebodźcowanie). Pod koniec tygodnia zobaczysz wyraźnie: czy potrzeba więcej odpoczynku? Więcej obciążenia umysłowego? Odcinaj podekscytowane fazy przed snem.",
      no_gos: [
        "Natychmiastowe robienie 'więcej akcji' bez wcześniejszej obserwacji.",
        "Ciągłe stymulowanie {dogName}, bo sprawia wrażenie rozdygotanego — często potrzebuje dokładnie odwrotności.",
        "Nakładanie kilku ekscytujących bodźców pod rząd (zabawa + spacer + goście tego samego dnia).",
      ],
      fortschritt: [
        "Masz przed sobą 7-dniowy protokół ze wszystkimi fazami snu i aktywności.",
        "{dogName} śpi co najmniej 14 godzin na dobę, z tego 4-6 godzin pod rząd w ciągu dnia.",
        "Rozpoznajesz przemęczone i niedostymulowane fazy po co najmniej 2 oznakach (np. dyszenie bez upału, rozdygotanie, przygryzanie).",
        "{dogName} utrzymuje CZEKAJ przy jedzeniu lub drzwiach co najmniej 5 sekund w 8 z 10 prób.",
      ],
      exerciseIds: ["e-entspannungs-marker", "e-warte-impuls"],
    },
    {
      title: "Jedzenie staje się zajęciem",
      schwerpunkt: "Zamiast stawiać {dogName} miskę, robisz z każdego posiłku pracę węchową. 1 posiłek jako zabawa w szukanie + 1 z Konga/maty węchowej zastępuje godzinę tępego szalenia.",
      wochenziele: [
        "Min. 1 posiłek dziennie jako zabawa w szukanie w mieszkaniu.",
        "Min. 1 posiłek dziennie z Konga lub maty węchowej.",
        "{dogName} nie połyka już z miski, lecz pracuje nad jedzeniem 20-30 min.",
      ],
      tagesplan: "Rano: mata węchowa z suchą karmą. {dogName} pracuje samodzielnie. Wieczorem: sucha karma rozsypana porcjami po salonie, sygnał SZUKAJ, 20 min zajęcia. Południe (opcjonalnie): Kong z mokrą karmą, zamrożony, gdy ma być trudniej. Podnosi dzienny poziom zajęcia {dogName} z 30 sek do 60 min produktywnego działania.",
      no_gos: [
        "Wspieranie {dogName} podczas szukania lub podpowiadanie.",
        "Budowanie zabawy w szukanie jako 'szybkiej przekąski' — ma trwać długo.",
        "Używanie maty węchowej lub Konga, gdy {dogName} jest już nadpobudliwy — lepiej w umiarkowanych fazach.",
      ],
      fortschritt: [
        "{dogName} pracuje 20-30 minut skupiony nad zabawą w szukanie lub Kongiem, zamiast po 30 sekundach połknąć.",
        "W ciągu 10 minut po zabawie w szukanie/Kongu {dogName} kładzie się dobrowolnie (zamiast podekscytowanego domagania się).",
        "Od 5 dni nie karmisz już żadnego posiłku bezpośrednio z miski.",
      ],
      exerciseIds: ["e-such-drinnen", "e-kong-mahlzeit"],
    },
    {
      title: "CZEKAJ: budowanie kontroli impulsów",
      schwerpunkt: "Kontrola impulsów to mentalny hamulec, którego nadpobudliwym psom często brakuje. CZEKAJ przed jedzeniem, drzwiami, zabawką buduje ten hamulec przez tygodnie. Wytrzymanie frustracji = nauka spokoju.",
      wochenziele: [
        "{dogName} utrzymuje 10 sek CZEKAJ przed miską z jedzeniem.",
        "CZEKAJ jest stosowane przed 3 różnymi sytuacjami dziennie.",
        "{dogName} pozostaje spokojny przy rosnącej frustracji.",
      ],
      tagesplan: "Rano: CZEKAJ przed miską śniadaniową, powoli zwiększaj od 1 sek do 10 sek w ciągu tygodnia. W południe: CZEKAJ przed drzwiami wejściowymi przy wychodzeniu. Wieczorem: CZEKAJ przed ulubioną zabawką, potem zwolnienie. Dziennie 3-4 sytuacje, nigdy nie utrzymuj dłużej niż 15 sek.",
      no_gos: [
        "Używanie CZEKAJ jako czystej kary, bez rozwiązania.",
        "Zbyt długie czasy utrzymania w pierwszym tygodniu — to frustruje.",
        "CZEKAJ, gdy {dogName} jest już w trybie hiper — najpierw pozwól się wyciszyć.",
      ],
      fortschritt: [
        "{dogName} utrzymuje 10 sekund CZEKAJ przed miską z jedzeniem w 8 z 10 prób, bez wstawania.",
        "Zachowania frustracyjne (skomlenie, skakanie, przygryzanie) w dniu 7 pojawiają się wyraźnie rzadziej niż w dniu 1 — szacuj: najwyżej o połowę rzadziej.",
        "Stosujesz CZEKAJ każdego dnia w co najmniej 3 różnych sytuacjach.",
      ],
      exerciseIds: ["e-warte-impuls", "e-entspannungs-marker"],
    },
    {
      title: "Warunkowanie kotwicy relaksu",
      schwerpunkt: "Łączymy słowo takie jak CUDOWNIE ze stanami spokoju. Później możesz użyć tego słowa, by wyciszyć {dogName}. Klasyczne warunkowanie jak u psów Pawłowa.",
      wochenziele: [
        "Codziennie 5-7 razy łączysz słowo CUDOWNIE z prawdziwymi momentami spokoju.",
        "{dogName} po 7-10 dniach reaguje rozpoznawalnie na to słowo.",
        "Marker jest gotowy jako narzędzie do odcinania ekscytacji.",
      ],
      tagesplan: "Przez cały dzień obserwuj: czy {dogName} jest zrelaksowany? (leży, oczy na wpół zamknięte, spokojny oddech). Dokładnie w tych momentach: spokojnie podejdź, CUDOWNIE głębokim ciepłym głosem, miękki smakołyk do pyska. Nie podrywaj do góry, nie ekscytuj. Dziennie min. 5 takich powiązań.",
      no_gos: [
        "Używanie tego słowa w ekscytacji, zanim zostanie zwarunkowane — rozmywa powiązanie.",
        "Ekscytowanie {dogName}, by potem zastosować kotwicę — kolejność jest odwrotna.",
        "Używanie wartościowych smakołyków — przy warunkowaniu spokoju lepiej pasują spokojne, miękkie smakołyki.",
      ],
      fortschritt: [
        "Powiązałeś CUDOWNIE w tym tygodniu co najmniej 35 razy z prawdziwymi momentami spokoju (5 dziennie).",
        "Przy CUDOWNIE w spokojnym momencie {dogName} w ciągu 2 sekund odwraca do ciebie głowę, w 7 z 10 prób.",
        "{dogName} przy CUDOWNIE pozostaje w leżeniu, zamiast wstawać — marker nie wyzwala ekscytacji z oczekiwania.",
      ],
      exerciseIds: ["e-entspannungs-marker", "e-shape-trick"],
    },
    // 6-miesięczny: pogłębienia
    {
      title: "Pierwsze triki metodą shaping: obciążenie umysłowe",
      schwerpunkt: "Przy shapingu {dogName} uczy się samodzielnie: co daje mi klik? To najintensywniejsze obciążenie umysłowe w ogóle. Po 5-7 min shapingu nawet młody pies jest zmęczony.",
      wochenziele: [
        "{dogName} zna 1 nowy trik (łapka, dotknij lub obrót).",
        "Sesje shapingu stają się regularną rutyną.",
        "Rozpoznajesz, kiedy {dogName} jest obciążony umysłowo (ziewanie, robienie przerwy).",
      ],
      tagesplan: "Jedna 5-7-minutowa sesja shapingu dziennie, najlepiej po południu lub wieczorem. Wybierz prosty trik. Na sesję 10-15 klików. Kończ zawsze w momencie sukcesu. Po sesji: wyciszenie na kocu.",
      no_gos: [
        "Frustracja, gdy {dogName} nie rozumie. Lepiej obniż wymaganie.",
        "Rozpoczynanie kilku trików jednocześnie — jeden porządnie ustanów.",
        "Sesja shapingu dłuższa niż 10 min — przeciąża umysłowo.",
      ],
      fortschritt: [
        "{dogName} rozumie zasadę klikera: małe ruchy prowadzą do nagrody.",
        "{dogName} aktywnie próbuje różnych zachowań.",
        "Po sesji shapingu {dogName} jest widocznie bardziej zmęczony niż po aktywności fizycznej.",
      ],
      exerciseIds: ["e-shape-trick", "e-warte-impuls"],
    },
    {
      title: "Mata węchowa jako codzienna rutyna",
      schwerpunkt: "Maty węchowe i inne inteligentne zabawki stają się stałym rytuałem dnia. W tym tygodniu ustanawiasz 2-3 różne z nich i je rotujesz.",
      wochenziele: [
        "{dogName} zna min. 2 różne narzędzia zajęciowe.",
        "Rotujesz narzędzia, żeby się nie znudziło.",
        "{dogName} pracuje 20-30 min nad każdym zajęciem samodzielnie.",
      ],
      tagesplan: "Zainwestuj w 2-3 narzędzia: matę węchową, Konga, zabawkę interaktywną (np. Trixie Mover). Rotacja co 2-3 dni. Dziennie min. 1 zajęcie z nimi. Idealnie przed fazą, w której {dogName} zwykle się nakręca (otwieranie drzwi, dzwonek).",
      no_gos: [
        "Używanie tylko 1 narzędzia — szybko się nudzi.",
        "Przeszkadzanie {dogName} lub pomaganie mu podczas zajęcia.",
        "Nieczyszczenie narzędzi zajęciowych — pleśń, bakterie.",
      ],
      fortschritt: [
        "{dogName} ma wyraźnych faworytów wśród narzędzi.",
        "Rutyna jest ustanowiona w rozkładzie dnia.",
        "Narzędzia zajęciowe stają się prawdziwym przygotowaniem do przerw na odpoczynek.",
      ],
      exerciseIds: ["e-such-drinnen", "e-kong-mahlzeit"],
    },
    {
      title: "Zajęcie kombinowane",
      schwerpunkt: "Łączysz teraz ruch + pracę węchową + pracę umysłową w jednej jednostce treningowej. Zamiast 1h tępego marszu: 30 min z 5 różnymi aktywnościami wymieszanymi.",
      wochenziele: [
        "{dogName} pokonuje 30 min z 4-5 różnymi aktywnościami wymieszanymi.",
        "Rozpoznajesz, co {dogName} najbardziej wyczerpuje (zwykle praca węchowa + shaping).",
        "Spacery stają się wszechstronnymi sesjami treningowymi.",
      ],
      tagesplan: "Rób 1x dziennie 30-minutowy spacer jako 'hybrydę zaspokajania potrzeb': 5 min tępego marszu + 10 min zabawy w szukanie ze smakołykami w trawie + 5 min powtórki trików + 5 min swobodnego spaceru + 5 min wyciszenia przy siedzeniu pod drzewem.",
      no_gos: [
        "Zbyt szybkie zmienianie aktywności — {dogName} nie wchodzi w nią.",
        "Popadanie w gorączkowość przy zmianach, spokojne przejście jest ważne.",
        "Po tej sesji jeszcze druga wyczerpująca — to byłoby przemęczenie.",
      ],
      fortschritt: [
        "{dogName} jest po 30 min widocznie wyczerpany.",
        "Po wyciszeniu {dogName} szybko znajduje spokój.",
        "Spacery wydają się satysfakcjonujące, a nie jak obowiązek.",
      ],
      exerciseIds: ["e-warte-impuls", "e-shape-trick"],
    },
    {
      title: "Sprawdzenie fundamentu",
      schwerpunkt: "Ostatni tydzień fundamentu. Powtarzasz wszystkie elementy: higienę snu, zabawę w szukanie, Konga, CZEKAJ, marker relaksu. To, co się chwieje, dostaje dodatkowy fokus.",
      wochenziele: [
        "Wszystkie elementy są ustanowione w codziennej rutynie.",
        "Wyraźnie rozpoznajesz słabe punkty, którymi trzeba się zająć w fazie 2.",
        "Poziom spokoju {dogName} jest rozpoznawalnie lepszy niż 4 tygodnie temu.",
      ],
      tagesplan: "Zrób uczciwy bilans: co idzie codziennie (odhaczone), a co raczej rzadko? Godziny snu policzone? Zabawa w szukanie ustanowiona? CZEKAJ działa w 3+ sytuacjach? Marker relaksu zwarunkowany? Jeśli coś się chwieje: w tym tygodniu dodatkowy fokus na to.",
      no_gos: [
        "Przeskakiwanie do fazy 2 z niecierpliwości — faza 1 to fundament.",
        "Kilka słabych punktów naraz — skup się na tym jednym najważniejszym.",
        "Kompletne odłożenie planu, bo jeden tydzień poszedł źle.",
      ],
      fortschritt: [
        "Czujesz się jak 'menedżer zaspokajania potrzeb' z narzędziami.",
        "{dogName} jest wyraźnie spokojniejszy niż na starcie planu.",
        "Macie rutynę, która dla was obu wydaje się normalna.",
      ],
      exerciseIds: ["e-entspannungs-marker", "e-such-drinnen"],
    },
  ],
  steigerung: [
    {
      title: "Praca węchowa na zewnątrz: podstawy tropienia",
      schwerpunkt: "Praca węchowa na zewnątrz to najintensywniejsze zaspokajanie potrzeb w ogóle. 15-20 min tropienia zastępuje 60 min tępego marszu, a do tego {dogName} jest umysłowo wyczerpany i zadowolony.",
      wochenziele: [
        "{dogName} samodzielnie podąża za 10-15 m tropem karmowym.",
        "Jednostka tropienia na spacer jest ustanowiona.",
        "{dogName} jest po ćwiczeniu widocznie wyczerpany.",
      ],
      tagesplan: "Na spacer 1 jednostka tropienia: wyłóż 10 m trop karmowy w spokojnym miejscu (ogród, łąka, skraj parku). {dogName} może podążać 5 min później. Zwiększanie: trop 20 m, potem 30 m, potem z małymi rozproszeniami dookoła.",
      no_gos: [
        "Tropienie w silnie uczęszczanych miejscach — koncentracja niemożliwa.",
        "Popędzanie {dogName} lub pokazywanie tropu — znika radość i efekt nauki.",
        "Robienie tropu zbyt długim na początku — przeciąża.",
      ],
      fortschritt: [
        "{dogName} samodzielnie podąża za 20 m tropem karmowym, bez tego, byś musiał mu go pokazywać.",
        "W ciągu 10 minut po jednostce tropienia (15-20 min) {dogName} kładzie się dobrowolnie.",
        "Przy zabawie w zatrzymanie w środku ekscytacji {dogName} wycisza się w ciągu 3 sekund, bez powtarzania sygnału.",
        "Planujesz na spacer na stałe co najmniej 1 jednostkę szukania.",
      ],
      exerciseIds: ["e-mantrailing-basis", "e-stop-spiel"],
    },
    {
      title: "Ustrukturyzowane spacery z zadaniami szukania",
      schwerpunkt: "Spacery stają się sesjami treningowymi. Co 5-10 min małe zadanie szukania lub trik. {dogName} pozostaje umysłowo zaangażowany, zamiast wpadać w tryb autopilota.",
      wochenziele: [
        "Każdy spacer zawiera min. 3 fazy szukania lub trików.",
        "{dogName} pozostaje na spacerze uważny i reagujący na ciebie.",
        "Tępe ciągnięcie do przodu wyraźnie się zmniejsza.",
      ],
      tagesplan: "Na spacer zaplanuj stacje: po 5 min: rzuć smakołyk + SZUKAJ. Po 10 min: 1 trik. Po 15 min: mini-trop szukania. Spacer staje się serią aktywności, a nie trasą. Przerwy na węszenie są aktywnie wbudowane.",
      no_gos: [
        "Narzucanie aktywności w fazie stresu {dogName} — najpierw pozwól się wyciszyć.",
        "Zbyt wiele aktywności w zbyt krótkim czasie — przebodźcowanie.",
        "Wykorzystywanie spacerów w strefach silnego pobudzenia (wiele psów) do ustrukturyzowanego treningu.",
      ],
      fortschritt: [
        "{dogName} aktywnie szuka kontaktu wzrokowego i zadań.",
        "Spacery stają się spokojniejsze i bardziej komunikatywne.",
        "Tępe ciągnięcie rozpoznawalnie się zmniejsza.",
      ],
      exerciseIds: ["e-such-drinnen", "e-shape-trick"],
    },
    {
      title: "Zabawa w zatrzymanie: nauka przerywania ekscytacji",
      schwerpunkt: "Nadpobudliwe psy często nie mają wyłącznika. Budujemy go: w środku zabawy STOP, odcięcie ekscytacji, a dopiero potem kontynuacja. Umiejętność życiowa.",
      wochenziele: [
        "{dogName} reaguje na STOP w ciągu 3 sekund wyciszeniem.",
        "Możesz w każdej chwili przerwać zabawę i szaleństwa.",
        "{dogName} wycisza się po STOP, bez tego, by pojawiła się frustracja.",
      ],
      tagesplan: "1x dziennie 7-minutowa sesja zabawy z zabawką. Co 60 sek wpleć STOP. {dogName} utrzymuje 5-10 sek, potem smakołyk, potem nie od razu wznowienie zabawy — 30 sek przerwy. W ciągu tygodnia fazy przerwy stają się dłuższe.",
      no_gos: [
        "Stosowanie STOP tylko przy frustracji lub złym humorze.",
        "Natychmiastowe kontynuowanie zabawy — przerwa jest efektem nauki.",
        "Fizyczne zmuszanie {dogName} do spokoju — zamiast tego kieruj słownie.",
      ],
      fortschritt: [
        "{dogName} siedzi lub stoi spokojnie przy STOP w ciągu 3 sek.",
        "Fazy ekscytacji stają się krótsze.",
        "Czujesz się jak reżyser zabawy, a nie jak jej uczestnik z doskoku.",
      ],
      exerciseIds: ["e-stop-spiel", "e-cool-down-decke"],
    },
    {
      title: "Wyciszenie po każdym spacerze",
      schwerpunkt: "Po każdej ekscytującej fazie następuje świadome 5-10 min wyciszenie. {dogName} uczy się: ekscytacja kończy się aktywnie, a nie sama z siebie. To spokój jako umiejętność, której można się nauczyć.",
      wochenziele: [
        "{dogName} zna sekwencję wyciszenia i wycisza się szybciej.",
        "Wyciszenie staje się normalną rutyną po spacerach.",
        "Dzienny poziom {dogName} stał się spokojniejszy.",
      ],
      tagesplan: "Po każdym spacerze: 5-10 min wyciszenia na kocu. Usiądź obok, spokojna ręka na łopatce, głębokie oddychanie. Marker relaksu CUDOWNIE co 60 sek. Dopiero po fazie wyciszenia {dogName} może stać się normalnie aktywny.",
      no_gos: [
        "Pomijanie wyciszenia, bo 'za bardzo się spieszysz'.",
        "Konfrontowanie {dogName} zaraz po spacerze z czymś ekscytującym.",
        "Wymuszanie wyciszenia — {dogName} musi móc się uczyć.",
      ],
      fortschritt: [
        "{dogName} sam z siebie szuka koca po ekscytacji.",
        "Wyciszenie trwa krócej, bo już się wcześniej wycisza.",
        "Spacery kończą się spokojem, a nie chaosem.",
      ],
      exerciseIds: ["e-such-drinnen", "e-entspannungs-marker"],
    },
    {
      title: "Dłuższe sesje pracy umysłowej",
      schwerpunkt: "Trening w formie swobodnej wydłuża się do 10-15 min, z kilkoma trikami równolegle. {dogName} uczy się koncentracji przez dłuższy czas, co bezpośrednio przeciwdziała nadpobudliwości.",
      wochenziele: [
        "{dogName} pozostaje skupiony 10-15 min w jednej sesji trikowej.",
        "Min. 3 triki aktywne w repertuarze.",
        "Rozpiętość uwagi jest rozpoznawalnie poszerzona.",
      ],
      tagesplan: "Jedna 10-15-minutowa sesja trikowa dziennie, spokojne miejsce w domu lub w ogrodzie. Rotacja trików: 5 min trik 1, 5 min trik 2, 5 min trik 3. Na trik czyste powtórzenia z wyraźnym DOBRZE, bez gorączkowości.",
      no_gos: [
        "Zbyt szybkie zwiększanie wymagań trikowych — {dogName} potrzebuje powtórek.",
        "Rozpoczynanie kilku nowych trików równolegle — zamieszanie.",
        "Sesja trikowa w nadmiernym pobudzeniu — najpierw wyciszenie.",
      ],
      fortschritt: [
        "{dogName} ma 3+ triki w repertuarze.",
        "Rozpiętość uwagi ponad 10 min jest czymś normalnym.",
        "Pewnie rozpoznajesz granicę koncentracji {dogName}.",
      ],
      exerciseIds: ["e-shape-trick", "e-stop-spiel"],
    },
    {
      title: "Kontakty społeczne pod kontrolą",
      schwerpunkt: "Nadpobudliwe psy często przekręcają się z innymi psami. Wbudowujemy kontrolowane kontakty społeczne, z wyraźnymi przerwami i sekwencjami wyciszania.",
      wochenziele: [
        "{dogName} zna 1-2 przewidywalnych psich przyjaciół z dobrą kompetencją społeczną.",
        "Spotkania towarzyskie są ustrukturyzowane przerwami, a nie wielogodzinnym szaleństwem.",
        "Po kontakcie społecznym {dogName} szybko się wycisza dzięki fazie wyciszenia.",
      ],
      tagesplan: "1-2 razy w tygodniu świadome spotkanie towarzyskie: 30-45 min ze spokojnym, przewidywalnym psem. Nigdy dłużej. Przerwy co 10-15 min z przytrzymaniem na smyczy i przerwą na wodę. Bezpośrednio po: 15 min wyciszenia w domu.",
      no_gos: [
        "Wielogodzinne szaleństwa — kontrproduktywne, przebodźcowuje.",
        "Spotkanie towarzyskie w nieznanym otoczeniu z obcymi psami.",
        "Zaraz po spotkaniu towarzyskim jeszcze dalsze aktywności.",
      ],
      fortschritt: [
        "{dogName} szybciej wycisza się z pobudzenia towarzyskiego.",
        "Kontakty społeczne są satysfakcjonujące, a nie przebodźcowujące.",
        "Macie jasną rutynę towarzyską na tydzień.",
      ],
      exerciseIds: ["e-such-drinnen", "e-cool-down-decke"],
    },
    {
      title: "Aktywne poszerzanie tolerancji na frustrację",
      schwerpunkt: "Nadpobudliwość często idzie w parze z niską tolerancją na frustrację. Trenujemy świadomie: {dogName} dostaje zadanie, które jest nieco trudne, i uczy się wytrwać.",
      wochenziele: [
        "{dogName} wytrzymuje 5+ min przy trudniejszym zadaniu.",
        "Zachowanie frustracyjne (skomlenie, poddawanie się) się zmniejsza.",
        "{dogName} lepiej radzi sobie z krótkimi czasami czekania.",
      ],
      tagesplan: "Dziennie jedno 'trudne' zadanie: podchwytliwy Kong, mata węchowa z mniejszymi smakołykami, zadanie szukania z wyższymi kryjówkami. {dogName} musi się wysilić. Obserwujesz, ale NIE pomagasz. Frustracja jest częścią tego.",
      no_gos: [
        "Natychmiastowa pomoc przy frustracji — efekt nauki przepada.",
        "Robienie zadań zbyt trudnymi — zadanie potrzebuje 60-80% szans na sukces.",
        "Kompensowanie frustracji ekscytacją — zamiast zmiany aktywności spokój.",
      ],
      fortschritt: [
        "{dogName} dłużej wytrzymuje przy zadaniach.",
        "Oznaki frustracji stają się rzadsze i krótsze.",
        "{dogName} rozwija zdolność wytrwania.",
      ],
      exerciseIds: ["e-warte-impuls", "e-kong-mahlzeit"],
    },
    {
      title: "Utrwalenie fazy wzrostu",
      schwerpunkt: "Ostatni tydzień fazy wzrostu. Wszystkie narzędzia zaspokajania potrzeb są ustanowione: praca węchowa, praca umysłowa, wyciszenie, zabawa w zatrzymanie, kontrolowane kontakty społeczne. {dogName} jest innym psem niż 8 tygodni temu.",
      wochenziele: [
        "Wszystkie narzędzia działają płynnie w codzienności.",
        "Dzienny poziom {dogName} jest wyraźnie spokojniejszy.",
        "Masz jasny plan na fazę 3 (generalizacja i utrzymanie).",
      ],
      tagesplan: "Zrób tydzień bilansowy: co działa świetnie, a co się chwieje? Których narzędzi używasz najczęściej, których rzadko? Gdzie jest {dogName} teraz w porównaniu z tygodniem 1? Zanotuj uczciwie, to podstawa dla fazy 3.",
      no_gos: [
        "Porzucanie narzędzi, bo 'teraz działa' — utrzymanie to faza 3.",
        "Testowanie {dogName} zbyt wieloma bodźcami — nie jesteśmy na finałowym etapie.",
        "Podkręcanie oczekiwań zbyt wysoko — plateau jest normalne.",
      ],
      fortschritt: [
        "{dogName} ma wyraźnie spokojniejszy poziom energii.",
        "Rutyna zaspokajania potrzeb jest zakorzeniona w codzienności.",
        "Czujesz się jak kompetentny menedżer zaspokajania potrzeb.",
      ],
      exerciseIds: ["e-mantrailing-basis", "e-cool-down-decke"],
    },
  ],
  generalisierung: [
    {
      title: "Ustanowienie tygodniowego planu zaspokajania potrzeb",
      schwerpunkt: "Faza 3 to struktura w codzienności. Tworzysz jasny 7-dniowy plan, który równoważy zaspokojenie fizyczne, umysłowe i społeczne. Z planem koniec chaosu, bez planu dni nie wystarczają.",
      wochenziele: [
        "Masz 7-dniowy plan zaspokajania potrzeb na ścianie.",
        "{dogName} dostaje każdego dnia 3 rodzaje zaspokojenia: ruch + węch + głowa.",
        "Godziny snu są osiągane w sposób ciągły (16-20h).",
      ],
      tagesplan: "Stwórz plan: dziennie 1 zaspokojenie fizyczne (spacer 30-60 min), 1 praca węchowa (zabawa w szukanie/tropienie), 1 praca umysłowa (shaping/Kong). Spotkanie towarzyskie 2x w tygodniu. Wyciszenie po wszystkim, co ekscytujące. Plan na ścianę, wieczorem stawiaj odhaczenia.",
      no_gos: [
        "Robienie planu tylko na 1 dzień — rutyna powstaje przez powtarzanie.",
        "Więcej niż 2 silnie ekscytujące aktywności tego samego dnia.",
        "Plan bez wyraźnych faz odpoczynku — są one aktywnie zaplanowane.",
      ],
      fortschritt: [
        "Masz 7-dniowy plan widoczny na ścianie i realizujesz codziennie 3 z 3 rodzajów zaspokojenia (ruch + węch + głowa).",
        "W co najmniej 5 z 7 dni {dogName} osiąga 14+ godzin odpoczynku.",
        "Przy narastającym nadmiernym pobudzeniu wykonujesz 3 kroki (usuń bodźce, koc, marker) bez zastanowienia — a {dogName} jest spokojny w 10-15 minut.",
        "Wieczorem {dogName} w 6 z 7 dni jest dobrowolnie w legowisku, zamiast być nakręcony.",
      ],
      exerciseIds: ["e-auslastungs-plan", "e-anti-hyperarousal"],
    },
    {
      title: "Spokój jako tryb domyślny",
      schwerpunkt: "W tym tygodniu ustanawiasz spokój jako stan standardowy. Aktywność jest wyjątkiem, a nie normą. Brzmi nudno, ale to rzeczywistość dla zrównoważonego psa.",
      wochenziele: [
        "{dogName} jest min. 60% dnia w fazie spokoju.",
        "Nie wymagasz od {dogName} nieustannie, lecz pozwalasz mu też po prostu być.",
        "Nakręcanie się jest rzadsze i bardziej kontrolowane.",
      ],
      tagesplan: "Uświadom sobie: fazy aktywne to 2-4 razy dziennie, po 30-60 min każda. Pomiędzy nimi JEST spokój. Nie 'niestety przerwa', lecz 'aktywna faza spokoju'. {dogName} leży w legowisku lub na kocu, ty pracujesz, jesteście razem cicho w pomieszczeniu.",
      no_gos: [
        "Wyrzuty sumienia z powodu 'zbyt mało akcji'.",
        "Ciągłe zagadywanie lub głaskanie {dogName} w fazach spokoju.",
        "Postrzeganie spokoju jako 'bezczynności' — jest aktywnym elementem regeneracji.",
      ],
      fortschritt: [
        "{dogName} sam z siebie szuka miejsc odpoczynku.",
        "Nie czujesz się już zobowiązany do ciągłego zabawiania.",
        "Fazy spokoju to już nie 'czas oczekiwania', lecz część relacji.",
      ],
      exerciseIds: ["e-entspannungs-marker", "e-cool-down-decke"],
    },
    {
      title: "Zaspokajanie potrzeb w trudne dni",
      schwerpunkt: "Niektóre dni są ciężkie: deszcz, mało czasu, choroba. Budujemy mini-pakiet zaspokajania potrzeb na takie dni, żeby {dogName} mimo to był zadowolony.",
      wochenziele: [
        "Masz gotowy 15-minutowy awaryjny pakiet zaspokajania potrzeb.",
        "{dogName} pozostaje spokojny także w trudne dni.",
        "Czujesz się przygotowany, zamiast przeciążony.",
      ],
      tagesplan: "Zaplanuj pakiet awaryjny: 10 min maty węchowej + 5 min powtórki trików w domu. ALBO: 15 min tropu szukania w mieszkaniu. ALBO: 1 wymagający Kong + wyciszenie. Przetestuj w tym tygodniu w normalny dzień, żeby {dogName} to znał.",
      no_gos: [
        "Wyrzuty sumienia z powodu 'tylko 15 min' — dobrze zainwestowane wystarczy.",
        "Pozwalanie {dogName} w trudne dni po prostu 'przebrnąć' — frustruje.",
        "Nieprzetestowanie pakietu awaryjnego — wtedy nie zadziała w potrzebie.",
      ],
      fortschritt: [
        "{dogName} pozostaje w trudne dni rozpoznawalnie spokojniejszy.",
        "Masz elastyczność bez poczucia winy.",
        "15 min jakości > 60 min złego zaspokajania potrzeb.",
      ],
      exerciseIds: ["e-kong-mahlzeit", "e-such-drinnen"],
    },
    {
      title: "Zmniejszanie nagród przy zaspokajaniu potrzeb",
      schwerpunkt: "Narzędzia zaspokajania potrzeb powinny kiedyś działać także bez ciągłego towarzyszenia z twojej strony. {dogName} może korzystać z maty węchowej samodzielnie, opracować Konga sam. To daje wam obu wolność.",
      wochenziele: [
        "{dogName} pracuje 20-30 min samodzielnie nad narzędziami zajęciowymi.",
        "Nie musisz już aktywnie towarzyszyć.",
        "Masz własny 'wolny czas', gdy {dogName} jest zajęty.",
      ],
      tagesplan: "Nie obserwuj już ciągle: daj Konga/matę węchową, idź do innego pokoju, rób swoje sprawy. {dogName} pracuje samodzielnie. Wróć dopiero po zakończeniu zajęcia. Oboje przyzwyczajacie się do samodzielności.",
      no_gos: [
        "Ciągłe zaglądanie podczas zajęcia.",
        "Robienie zajęcia zbyt łatwym — {dogName} kończy w 5 min.",
        "Zbyt szybkie oczekiwanie samodzielności — zwyczajowe fazy początkowe z towarzyszeniem są w porządku.",
      ],
      fortschritt: [
        "{dogName} ma samodzielną rutynę zajęciową.",
        "Cieszysz się własnym czasem bez poczucia winy.",
        "Wasza relacja staje się zdrowsza dzięki wspólnemu wolnemu czasowi ORAZ czasowi osobno.",
      ],
      exerciseIds: ["e-warte-impuls", "e-shape-trick"],
    },
    {
      title: "Ukierunkowana praca nad trudnymi wyzwalaczami",
      schwerpunkt: "Dzwonek do drzwi, listonosz, zapach zwierzyny — konkretne wyzwalacze, które regularnie nakręcają {dogName}. W tym tygodniu pracujesz w sposób ukierunkowany nad waszymi osobistymi punktami zapalnymi.",
      wochenziele: [
        "Wasze 2-3 najważniejsze wyzwalacze są jasno zidentyfikowane.",
        "{dogName} reaguje na jeden główny wyzwalacz rozpoznawalnie spokojniej.",
        "Masz konkretną strategię na każdy wyzwalacz.",
      ],
      tagesplan: "Dzień 1-2: zidentyfikuj 2-3 najważniejsze wyzwalacze i zanotuj reakcję {dogName}. Dzień 3-7: na wyzwalacz konkretna strategia: dzwonek do drzwi → DO MNIE + nagroda na kocu. Listonosz → koc + przygotowany Kong, gdy się zbliża. Zapach zwierzyny → krótka smycz + zabawa w szukanie jako odwrócenie uwagi.",
      no_gos: [
        "Ignorowanie wyzwalaczy w nadziei, że przejdzie — nie przechodzi.",
        "Kara lub podnoszenie głosu wobec wyzwalacza — wzmacnia nadmierne pobudzenie.",
        "Zajmowanie się kilkoma wyzwalaczami jednocześnie — skup się.",
      ],
      fortschritt: [
        "{dogName} reaguje na główny wyzwalacz rozpoznawalnie spokojniej.",
        "Masz gotowe narzędzia na każdy wyzwalacz.",
        "Wyzwalacze stają się okazją do ćwiczenia, a nie źródłem stresu.",
      ],
      exerciseIds: ["e-anti-hyperarousal", "e-entspannungs-marker"],
    },
    {
      title: "Opanowanie sytuacji towarzyskiej w parku",
      schwerpunkt: "Parki dla psów i spotkania z innymi psami często przeciążają. W tym tygodniu ustanawiasz reguły gry: krótkie fazy, jasne rutyny wyciszania, żadnych wielogodzinnych szaleństw.",
      wochenziele: [
        "{dogName} pokonuje 20-30 min pobytu w parku spokojnie.",
        "Pewnie rozpoznajesz oznaki przeciążenia {dogName}.",
        "Kontakty społeczne są satysfakcjonujące, a nie przebodźcowujące.",
      ],
      tagesplan: "Zaplanuj w tym tygodniu 2-3 świadome wyjścia do parku: maks. 30 min, co 10 min przerwa z przytrzymaniem na smyczy i CUDOWNIE. Przy oznakach przekręcania się: aktywnie się wycofaj, NIE wytrzymuj na siłę. Bezpośrednio po parku: 15 min wyciszenia w domu.",
      no_gos: [
        "Pobyty w parku dłuższe niż 45 min — przebodźcowanie.",
        "Pozwalanie {dogName} przy stresie 'przebrnąć'.",
        "Kilka wyjść do parku dziennie — przebodźcowuje.",
      ],
      fortschritt: [
        "{dogName} wraca spokojny z wizyty w parku.",
        "Oznaki przeciążenia są wcześnie rozpoznawane.",
        "Park staje się możliwą aktywnością, a nie obowiązkiem.",
      ],
      exerciseIds: ["e-cool-down-decke", "e-such-drinnen"],
    },
    {
      title: "Ustanowienie rutyny przeciw nadmiernemu pobudzeniu",
      schwerpunkt: "Niektóre dni idą źle. {dogName} nie może się wyciszyć. W tym tygodniu utrwalasz jasną trzystopniową rutynę (usuń bodźce, na koc, marker relaksu), którą w takich momentach możesz stosować odruchowo.",
      wochenziele: [
        "Rutyna przeciw nadmiernemu pobudzeniu siedzi: usuń bodźce, koc, marker.",
        "Stosujesz rutynę odruchowo, bez zastanowienia.",
        "{dogName} wycisza się po 10-15 min także z silniejszego nadmiernego pobudzenia.",
      ],
      tagesplan: "Ćwicz rutynę świadomie 2-3 razy w tym tygodniu: wywołaj lekką ekscytację (zasymuluj pukanie do drzwi, krótka zabawa), a potem od razu rutyna: zredukuj bodźce, zaprowadź na koc, CUDOWNIE i 10-15 min siedzenia obok. {dogName} uczy się: ekscytację zawsze można aktywnie zakończyć.",
      no_gos: [
        "Stosowanie rutyny tylko przy prawdziwym nadmiernym pobudzeniu — bez ćwiczenia nie zadziała w sytuacji awaryjnej.",
        "Skracanie rutyny — pełne 10-15 min jest konieczne.",
        "Natychmiastowa aktywność po rutynie — konsolidacja potrzebuje czasu.",
      ],
      fortschritt: [
        "Rutyna jest wyćwiczona i siedzi.",
        "{dogName} reaguje przewidywalnie na każdy krok.",
        "Czujesz się zdolny do działania także w gorączkowych momentach.",
      ],
      exerciseIds: ["e-anti-hyperarousal", "e-kong-mahlzeit"],
    },
    {
      title: "Przejście w tryb utrzymania",
      schwerpunkt: "Ostatni tydzień. Wszystkie narzędzia są ustanowione. Plan zaspokajania potrzeb działa, spokój jest standardem, strategie na wyzwalacze siedzą. {dogName} jest wyraźnie bardziej zrównoważonym psem. Plan utrzymania na przyszłość.",
      wochenziele: [
        "Wszystkie rutyny działają samodzielnie w codzienności.",
        "Masz jasny rytm utrzymania na nadchodzące miesiące.",
        "{dogName} jest długofalowo spokojniejszy niż na starcie planu.",
      ],
      tagesplan: "Zredukuj świadomy trening do minimum. Rutyny działają. Zaplanuj co 4-6 tygodni 'dzień odświeżenia': świadomie przejdź jeszcze raz przez wszystkie narzędzia, zidentyfikuj słabe punkty, naucz nowych trików. Sprawdź higienę snu.",
      no_gos: [
        "Nagłe porzucenie wszystkich rutyn — grozi krokiem wstecz.",
        "Rozluźnienie się i zaprzestanie obserwacji — małe nawroty rozpoznawaj wcześnie.",
        "Odkładanie odświeżenia utrzymania na nigdy — krótkie, regularne odświeżenia wystarczą.",
      ],
      fortschritt: [
        "{dogName} jest długofalowo bardziej zrównoważony.",
        "Macie wspólną rutynę, która wydaje się oczywista.",
        "Nadmierne pobudzenie to wyjątek, spokój to standard.",
      ],
      exerciseIds: ["e-auslastungs-plan", "e-such-drinnen"],
    },
  ],
};

const AGGRESSION_WEEKS: Record<Phase, WeekTemplate[]> = {
  fundament: [
    {
      title: "Zrozumienie i dokumentowanie progu",
      schwerpunkt: "Zanim zaczniesz pracować nad reaktywnością, musisz wiedzieć: od jakiej odległości {dogName} jest jeszcze w stanie SIĘ UCZYĆ, a od której tylko reaguje? To właśnie próg. W tym tygodniu zidentyfikujesz go i zapiszesz dla każdego typu bodźca.",
      wochenziele: [
        "Masz zapisane odległości progowe dla każdego typu bodźca.",
        "Pewnie rozpoznajesz wczesne sygnały stresu (mimika, oddech, ogon).",
        "Rozumiesz: każde ćwiczenie odbywa się PONIŻEJ progu, nigdy na jego granicy.",
      ],
      tagesplan: "Przez 4 dni w tym tygodniu: ukierunkowane sesje obserwacji w miejscu, gdzie bodźce pojawiają się przewidywalnie. Dystans startowy 50 m, testuj powoli. Dla każdego typu bodźca (pies, biegacz, rower, dziecko) zanotuj dokładną odległość, od której pojawiają się pierwsze sygnały stresu. To są Twoje progi na Fazę 2.",
      no_gos: [
        "Balansowanie na granicy progu — przy sygnałach stresu natychmiast zwiększaj dystans.",
        "Testowanie kilku bodźców jednocześnie — jeden bodziec na sesję.",
        "Przechodzenie z obserwacji do treningu — w tym tygodniu tylko obserwacja.",
      ],
      fortschritt: [
        "Masz spisaną mapę progów.",
        "Wczesne sygnały stresu są pewnie rozpoznawane.",
        "Rozumiesz reaktywność {dogName} w wymierny sposób.",
        "W domu {dogName} reaguje na słowo-marker PATRZ w mniej niż 2 sekundy.",
      ],
      exerciseIds: ["a-schwellenwert-finden", "a-lat"],
    },
    {
      title: "Pozytywne warunkowanie kagańca",
      schwerpunkt: "Kaganiec należy do zestawu narzędzi każdego reaktywnego psa — jako awaryjne zabezpieczenie. Ale działa tylko wtedy, gdy {dogName} skojarzy go pozytywnie. To zajmuje 2 tygodnie.",
      wochenziele: [
        "{dogName} dobrowolnie wsuwa nos w kaganiec.",
        "Czas noszenia jest wydłużony do 5 min z pozytywnym zajęciem.",
        "Kaganiec jest dostępny przed każdym 'trudnym' spacerem.",
      ],
      tagesplan: "Dzień 1-3: kaganiec leży widocznie w mieszkaniu, smakołyki przez pręty kraty. Dzień 4-7: {dogName} aktywnie wsuwa nos do środka i zgarnia nagrodę. Dzień 8-14 (w Fazie 2): wydłużaj czas noszenia, karm Kongiem przez pręty kraty. Nigdy nie zakładaj go za pierwszym razem i od razu nie wychodź.",
      no_gos: [
        "Zakładanie kagańca po raz pierwszy w sytuacji stresowej — dożywotnio zatruwa skojarzenie.",
        "Zbyt wczesne używanie kagańca jako kary.",
        "Wybór złego typu (materiałowa pętla na pysk) — takie uniemożliwiają też dyszenie i picie.",
      ],
      fortschritt: [
        "{dogName} aktywnie szuka kagańca.",
        "Noszenie przebiega spokojnie.",
        "Masz narzędzie bezpieczeństwa na sytuacje awaryjne.",
      ],
      exerciseIds: ["a-maulkorb-positiv", "a-bogen-aktiv"],
    },
    {
      title: "Budowanie patrzenia na bodziec (gra 'popatrz') w domu",
      schwerpunkt: "'Popatrz' to najważniejsza gra w treningu agresji. {dogName} może POPATRZEĆ na bodziec, ale potem musi spojrzeć z powrotem na Ciebie. Zaczynamy w domu od nieszkodliwych 'bodźców', zanim wyjdziemy na zewnątrz.",
      wochenziele: [
        "{dogName} rozumie zasadę 'popatrz' w domu.",
        "Po zobaczeniu bodźca patrzy na Ciebie w ciągu 2 sek.",
        "Marker nagrody PATRZ + DOBRZE jest zwarunkowany.",
      ],
      tagesplan: "Ćwiczenia w domu z aranżowanymi 'bodźcami': postaw kubek na stole, zostaw książkę leżącą w poprzek. {dogName} patrzy na to → mówisz PATRZ + klik + smakołyk. Powtarzaj 5-7 razy na sesję, 3 sesje dziennie. {dogName} uczy się: zobaczyć bodziec = od razu spojrzeć na Ciebie.",
      no_gos: [
        "Praca z prawdziwymi bodźcami na zewnątrz — jeszcze nie jesteśmy gotowi.",
        "Ponaglanie {dogName} — samodzielnie ma spojrzeć na opiekuna.",
        "Zbyt późne podanie nagrody — przy 'popatrz' timing jest wszystkim.",
      ],
      fortschritt: [
        "{dogName} rozumie zasadę 'popatrz' w mieszkaniu.",
        "Markery nagrody są jasno zwarunkowane.",
        "Jesteś gotowy, by przenieść 'popatrz' na zewnątrz w Fazie 2.",
      ],
      exerciseIds: ["a-lat", "a-engage-disengage"],
    },
    {
      title: "Warunkowanie protokołu awaryjnego",
      schwerpunkt: "Niektórych sytuacji nie da się uniknąć. W tym tygodniu ustalasz jasny 5-krokowy protokół awaryjny, który możesz zastosować odruchowo — zanim dojdzie do eskalacji.",
      wochenziele: [
        "Znasz 5 kroków na pamięć i potrafisz je zastosować odruchowo.",
        "{dogName} zna sygnał przerwania, który jest pozytywnie zwarunkowany.",
        "Czujesz się przygotowany na nieprzewidywalne spotkania.",
      ],
      tagesplan: "Ćwicz sekwencję kilka razy na sucho: zasymuluj pojawienie się bodźca, a potem od razu: 1. zachowaj spokój, 2. sygnał PRZERWANIA, 3. obrót o 90 stopni, 4. spokojnie odejdź, 5. po 50 m marker uspokojenia + smakołyk. Trenuj w domu bez prawdziwego bodźca.",
      no_gos: [
        "Pierwsze zastosowanie w realnej sytuacji awaryjnej — rutyna musi wcześniej siedzieć.",
        "Warunkowanie sygnału PRZERWANIA jako kary — to tylko sygnał 'w inną stronę'.",
        "Panika przy realnej sytuacji awaryjnej — trzymaj się rutyny.",
      ],
      fortschritt: [
        "Znasz sekwencję na pamięć.",
        "{dogName} zna sygnał PRZERWANIA.",
        "Czujesz się przygotowany, a nie bezsilny.",
      ],
      exerciseIds: ["a-emergency-protokoll", "a-bat-distanz"],
    },
    // Pogłębienia 6-miesięczne
    {
      title: "Wydłużanie czasu noszenia kagańca",
      schwerpunkt: "W nawiązaniu do tygodnia 2: wydłużanie czasu noszenia do 15-20 min, z zajęciem. {dogName} ma zaakceptować kaganiec jako normalny element spaceru.",
      wochenziele: [
        "{dogName} nosi kaganiec 15-20 min bez napięcia.",
        "Potrafi w kagańcu pić i wąchać.",
        "Kaganiec jest częścią przygotowań do spaceru, a nie dramatem.",
      ],
      tagesplan: "Codzienne sesje noszenia: zakładasz kaganiec, potem karmisz Kongiem przez kratę. Dzień 1-2 5 min, dzień 3-5 10 min, dzień 6-7 15 min. Następnie pozytywna aktywność: zabawa lub spacer jeszcze BEZ kagańca. Skojarzenie: kaganiec = następuje coś dobrego.",
      no_gos: [
        "Zbyt szybkie wydłużanie czasu noszenia — frustracja buduje negatywne skojarzenie.",
        "Sesje z kagańcem w stresie lub nadmiernym pobudzeniu.",
        "Zostawianie kagańca na dłużej samego sobie — to pomoc, a nie kara.",
      ],
      fortschritt: [
        "Noszenie przebiega spokojnie.",
        "{dogName} reaguje pozytywnie na przygotowanie kagańca.",
        "Kaganiec jest rutynową częścią waszego repertuaru.",
      ],
      exerciseIds: ["a-maulkorb-positiv", "a-schwellenwert-finden"],
    },
    {
      title: "'Popatrz' z mini-bodźcami w domu",
      schwerpunkt: "'Popatrz' ćwiczy się w mieszkaniu z trudniejszymi bodźcami: dźwięki, nagłe ruchy, inni domownicy jako 'bodźce'. {dogName} utrwala zasadę.",
      wochenziele: [
        "'Popatrz' działa przy 5+ różnych bodźcach w domu.",
        "{dogName} patrzy na opiekuna w ciągu 1-2 sek.",
        "Nagroda przychodzi szybko i konsekwentnie.",
      ],
      tagesplan: "Trenuj w domu z różnymi bodźcami: domownik porusza się w rzucający się w oczy sposób, dźwięk (cichutkie nagranie dzwonka), zabawka przelatuje przez pokój. Przy każdym bodźcu 'popatrz' + klik + nagroda. 3-4 sesje dziennie, każda 5 min.",
      no_gos: [
        "Zbyt intensywne bodźce — przeciążają młode 'popatrz'.",
        "Stosowanie bodźców bez markera PATRZ — rozmywa skojarzenie.",
        "Ponaglanie {dogName} — samodzielnie ma spojrzeć na opiekuna.",
      ],
      fortschritt: [
        "'Popatrz' działa przy różnych bodźcach w domu.",
        "Czas reakcji jest poniżej 2 sek.",
        "Jesteś gotowy na prawdziwe bodźce na zewnątrz.",
      ],
      exerciseIds: ["a-lat", "a-engage-disengage"],
    },
    {
      title: "Nauka czytania sygnałów stresu",
      schwerpunkt: "W tym tygodniu uczysz się DOKŁADNIE czytać mowę ciała {dogName}. Wczesne sygnały stresu to Twój system wczesnego ostrzegania. Kto ich nie rozpoznaje, zawsze reaguje za późno.",
      wochenziele: [
        "Znasz indywidualne sygnały stresu {dogName} (5+ kategorii).",
        "Pewnie rozpoznajesz stopnie stresu 1-2 (zanim dojdzie do eskalacji).",
        "Reagujesz na wczesne sygnały dystansem, a nie dopiero na późne korektą.",
      ],
      tagesplan: "Codziennie obserwuj 30 min spaceru z ukierunkowanym skupieniem na mowie ciała: wielkość źrenic, napięcie pyska, oddech, wysokość ogona, sposób poruszania się, ustawienie uszu. Zanotuj wieczorem: jakie wczesne sygnały zauważyłeś? W jakiej sytuacji? Poznaj indywidualny wzorzec {dogName}.",
      no_gos: [
        "Reagowanie dopiero na późne sygnały (warczenie, unoszenie wargi) — wtedy jest za późno.",
        "Ignorowanie lub bagatelizowanie sygnałów stresu ('to normalne').",
        "'Przeciąganie' {dogName} przez sytuacje stresowe — to tylko eskaluje.",
      ],
      fortschritt: [
        "Niezawodnie rozpoznajesz wczesne sygnały {dogName}.",
        "Reagujesz proaktywnie dystansem.",
        "Eskalacje zdarzają się rzadziej, bo wcześnie ucinasz sygnały stresu.",
      ],
      exerciseIds: ["a-schwellenwert-finden", "a-maulkorb-positiv"],
    },
    {
      title: "Sprawdzenie fundamentów przed Fazą 2",
      schwerpunkt: "Ostatni tydzień fundamentów. Kaganiec pozytywny? Progi znane? 'Popatrz' w domu siedzi? Protokół awaryjny przećwiczony? Te elementy są niezbędne dla Fazy 2 na zewnątrz.",
      wochenziele: [
        "Wszystkie 4 elementy są ustalone: kaganiec, próg, 'popatrz', sytuacja awaryjna.",
        "Czujesz się przygotowany do treningu na zewnątrz z prawdziwymi bodźcami.",
        "{dogName} zna te narzędzia.",
      ],
      tagesplan: "Zrób szczery bilans: co siedzi, co się chwieje? Jeśli coś się chwieje: dołóż 1 dodatkowy tydzień. Ta faza decyduje o kolejnych 8 tygodniach — porządne przygotowanie jest wszystkim. Jeszcze raz przećwicz protokół awaryjny na sucho.",
      no_gos: [
        "Przeskakiwanie do Fazy 2 z niecierpliwości — przy chwiejnym fundamencie dojdzie do eskalacji.",
        "Nadrabianie kilku słabości naraz w Fazie 2 — to chaos.",
        "Porzucanie planu, bo fundament trwa dłużej — trzymaj się go.",
      ],
      fortschritt: [
        "Czujesz się kompetentny i przygotowany.",
        "Narzędzia siedzą jasno.",
        "{dogName} zna te elementy.",
      ],
      exerciseIds: ["a-lat", "a-engage-disengage"],
    },
  ],
  steigerung: [
    {
      title: "'Popatrz' z prawdziwymi bodźcami z dużej odległości",
      schwerpunkt: "Teraz wychodzimy na zewnątrz. {dogName} widzi prawdziwe bodźce, ale z dużej odległości (50 m+, PONIŻEJ progu). 'Popatrz' staje się standardową reakcją na bodźce.",
      wochenziele: [
        "'Popatrz' działa na zewnątrz przy 3+ typach bodźców.",
        "{dogName} pozostaje poniżej progu.",
        "Częstotliwość nagradzania jest wysoka (żadnego oszczędzania na tym etapie).",
      ],
      tagesplan: "2 razy w tygodniu dedykowane sesje 'popatrz' w miejscu z przewidywalnymi bodźcami (skraj parku, trasa biegowa). Dystans startowy: 50 m+. Na sesję 4-6 powtórzeń 'popatrz', potem koniec. Kaganiec jako zabezpieczenie awaryjne.",
      no_gos: [
        "Balansowanie na granicy progu — nauka z rozpaczy zamienia się w reakcję.",
        "Zmniejszanie częstotliwości nagradzania — to przyjdzie dopiero w Fazie 3.",
        "'Popatrz' na zewnątrz bez czystego 'popatrz' w domu — brakuje fundamentu.",
      ],
      fortschritt: [
        "'Popatrz' działa na zewnątrz.",
        "Bodźce wyzwalają poszukiwanie uwagi, a nie reakcję.",
        "Zauważasz pierwsze sukcesy w nauce.",
        "{dogName} po popatrzeniu aktywnie się odwraca zamiast fiksować się na bodźcu.",
      ],
      exerciseIds: ["a-lat", "a-engage-disengage"],
    },
    {
      title: "Popatrz-i-odwróć się: aktywne odwracanie od bodźca",
      schwerpunkt: "Kolejny etap po 'popatrz': {dogName} patrzy na bodziec, a POTEM samodzielnie się odwraca. Odwrócenie wzroku nagradzasz jackpotem. {dogName} uczy się: mogę sam wybrać strategię.",
      wochenziele: [
        "{dogName} po zauważeniu bodźca sam odwraca wzrok.",
        "Odwrócenie wzroku jest nagradzane jackpotem.",
        "{dogName} rozwija zachowanie samodzielnego wyboru.",
      ],
      tagesplan: "2-3 sesje popatrz-i-odwróć się w tygodniu. Dystans jak przy 'popatrz', ale teraz czekasz na spontaniczne odwrócenie wzroku. Gdy {dogName} popatrzy, a potem sam odwróci wzrok: jackpot z 3 smakołyków po kolei. Gdy nadal się wpatruje: ciche przypomnienie PATRZ.",
      no_gos: [
        "Ponaglanie {dogName} lub wymuszanie odwrócenia wzroku — efekt nauki przepada.",
        "Przechodzenie do popatrz-i-odwróć się przed czystym 'popatrz'.",
        "Zbyt mała nagroda — jackpot jest tu kluczowy.",
      ],
      fortschritt: [
        "{dogName} aktywnie odwraca się od bodźców.",
        "Powstaje samoregulacja.",
        "Musisz mniej kierować.",
      ],
      exerciseIds: ["a-maulkorb-positiv", "a-schwellenwert-finden"],
    },
    {
      title: "ŁUK jako aktywna strategia",
      schwerpunkt: "Gdy bodziec podchodzi zbyt blisko: aktywny łuk z jasnym planem. Wcześniej wyznaczyłeś drogi ucieczki. {dogName} podąża za Tobą do strefy bezpieczeństwa, bez powstania konfliktu.",
      wochenziele: [
        "{dogName} niezawodnie podąża za sygnałem ŁUK.",
        "Aktywnie stosujesz 2-3 sekwencje łuku na spacer.",
        "Spotkania są opanowywane łukiem, bez eskalacji.",
      ],
      tagesplan: "Na każdy spacer zaplanuj 2-3 realne sytuacje łuku. Dystans przynajmniej 15 m do bodźca. Łuk zdecydowany, ale bez paniki. Po każdym udanym spotkaniu: 3 smakołyki + marker uspokojenia.",
      no_gos: [
        "Stosowanie łuku dopiero gdy {dogName} jest już spięty — prewencyjnie jest lepiej.",
        "Bezpośredni kontakt wzrokowy z nadchodzącym psem lub człowiekiem.",
        "Łuk bez wcześniejszego zaplanowania drogi ucieczki.",
      ],
      fortschritt: [
        "{dogName} płynnie podąża za sygnałem ŁUK.",
        "Spotkania przebiegają pod kontrolą.",
        "Czujesz, że masz wpływ na sytuację.",
      ],
      exerciseIds: ["a-bogen-aktiv", "a-lat"],
    },
    {
      title: "Intensywne przeciwwarunkowanie",
      schwerpunkt: "W tym tygodniu ukierunkowanie pracujesz nad skojarzeniem emocjonalnym: pojawia się bodziec = przychodzi smakołyk. Przez tygodnie bodziec staje się sygnałem 'pozytywnym', zamiast wyzwalaczem stresu.",
      wochenziele: [
        "{dogName} oczekuje smakołyka, gdy pojawia się bodziec.",
        "Oznaki stresu maleją.",
        "Skojarzenie emocjonalne zmienia się od podstaw.",
      ],
      tagesplan: "2-3 dedykowane sesje przeciwwarunkowania: miejsce z bodźcami w oddali. Pojawia się bodziec: PATRZ + nieprzerwane karmienie tak długo, jak bodziec jest widoczny. Bodziec znika = koniec smakołyków. {dogName} uczy się: pojawia się bodziec = kraina obfitości.",
      no_gos: [
        "Nagradzanie dopiero po reakcji — nie zmienia skojarzenia emocjonalnego.",
        "Zbyt niska częstotliwość nagradzania.",
        "Zbyt blisko — dystans jest wszystkim.",
      ],
      fortschritt: [
        "{dogName} przy bodźcach patrzy na Ciebie z oczekiwaniem.",
        "Oznaki stresu stają się krótsze i rzadsze.",
        "Bodźce wyzwalają pozytywne, a nie negatywne oczekiwanie.",
      ],
      exerciseIds: ["a-maulkorb-positiv", "a-engage-disengage"],
    },
    {
      title: "Stopniowe zmniejszanie dystansu",
      schwerpunkt: "Gdy 'popatrz' i popatrz-i-odwróć się siedzą z dużej odległości, zaczynasz STOPNIOWO zmniejszać dystans. Ale: tylko 1-2 m na tydzień, bez pośpiechu. Cierpliwość opłaca się tu bardziej niż gdziekolwiek indziej.",
      wochenziele: [
        "Odległość progowa zmniejszyła się o 5-10 m.",
        "{dogName} pozostaje poniżej progu przy bliższych bodźcach.",
        "Pracujesz cierpliwie i w sposób mierzalny.",
      ],
      tagesplan: "Dzień 1-3: dystans jak w zeszłym tygodniu, bardzo stabilne sesje. Dzień 4-7: 2 m bliżej, obserwuj. Przy oznakach stresu: natychmiast się cofnij. Gdy wszystko jasne: zostań tam na kolejny tydzień. Zmniejszanie dystansu to NIE zawody.",
      no_gos: [
        "Radykalne zmniejszanie dystansu — eskalacja.",
        "Zwiększanie presji w gorsze dni — plateau jest normalne.",
        "Ignorowanie progu, gdy się zmienił.",
      ],
      fortschritt: [
        "Próg zmniejsza się w sposób mierzalny.",
        "{dogName} pozostaje poniżej nowej wartości.",
        "Pracujesz cierpliwie i systematycznie.",
      ],
      exerciseIds: ["a-schwellenwert-finden", "a-lat"],
    },
    {
      title: "Wejście w trening dostosowania zachowania",
      schwerpunkt: "Trening dostosowania zachowania to królewska metoda przy reaktywnych psach. {dogName} ma długą linkę, więcej swobody ruchu, a Ty nagradzasz SAMODZIELNE ruchy rozładowania stresu dystansem. {dogName} odzyskuje kontrolę.",
      wochenziele: [
        "{dogName} rozumie zasadę treningu dostosowania zachowania: rozładowanie stresu = dystans się zwiększa.",
        "Pokazuje samodzielnie 3-4 ruchy rozładowania stresu.",
        "Wydaje się pewniejszy i bardziej opanowany.",
      ],
      tagesplan: "1-2 sesje dostosowania zachowania w tygodniu w spokojnym miejscu z kontrolowalnym bodźcem. Długa linka 5 m. {dogName} patrzy na bodziec: czekasz. Gdy tylko pokaże rozładowanie stresu (odwrócenie wzroku, otrząśnięcie się, lizanie ziemi, wąchanie): NATYCHMIAST aktywnie odejdź z nim, z dala od bodźca.",
      no_gos: [
        "Trening dostosowania zachowania w zalewie bodźców — działa tylko w kontrolowanym otoczeniu.",
        "Ponaglanie {dogName} lub wymuszanie rozładowania stresu — nie należy do tej zasady.",
        "Nagradzanie smakołykiem — funkcjonalna nagroda (dystans) jest tu kluczowa.",
      ],
      fortschritt: [
        "{dogName} aktywnie pokazuje zachowanie rozładowania stresu.",
        "Wydaje się pewniejszy i bardziej opanowany.",
        "Trening dostosowania zachowania staje się normalną metodą.",
      ],
      exerciseIds: ["a-bat-distanz", "a-emergency-protokoll"],
    },
    {
      title: "Zmienność przy bodźcach",
      schwerpunkt: "Do tej pory pracowałeś nad pojedynczymi typami bodźców. W tym tygodniu celowo zmieniasz: dziś psy, jutro biegacze, pojutrze rowery. {dogName} uczy się: strategia jest zawsze taka sama, niezależnie od bodźca.",
      wochenziele: [
        "{dogName} stosuje 'popatrz'/łuk/przeciwwarunkowanie przy różnych bodźcach.",
        "Strategia jest uogólniona, a nie przypisana do konkretnego bodźca.",
        "Czujesz się przygotowany na nieprzewidywalne spotkania.",
      ],
      tagesplan: "Zaplanuj celowo: 1 spacer w tym tygodniu ze skupieniem na psach, 1 na biegaczach, 1 na rowerach. Na każdym spacerze stosuj tę samą strategię, w razie potrzeby unikaj innych bodźców.",
      no_gos: [
        "Nakładanie kilku typów bodźców na jeden spacer — przeciąża.",
        "Zmiana strategii w zależności od bodźca — dezorientuje.",
        "Zauważanie dopiero przy trzecim bodźcu, że {dogName} jest już przebodźcowany.",
      ],
      fortschritt: [
        "Strategie działają niezależnie od bodźca.",
        "Pewnie rozpoznajesz, która strategia pasuje.",
        "{dogName} reaguje przewidywalnie na różne bodźce.",
      ],
      exerciseIds: ["a-lat", "a-bogen-aktiv"],
    },
    {
      title: "Utrwalenie etapu wzmożenia",
      schwerpunkt: "Ostatni tydzień etapu wzmożenia. Łączysz 'popatrz', popatrz-i-odwróć się, łuk, przeciwwarunkowanie, trening dostosowania zachowania. {dogName} ma kompletny repertuar. Faza 3 = zastosowanie w prawdziwej codzienności.",
      wochenziele: [
        "Wszystkie narzędzia można elastycznie łączyć.",
        "{dogName} po części samodzielnie stosuje strategie.",
        "Masz jasne wyobrażenie, które narzędzia będą kontynuowane w Fazie 3.",
      ],
      tagesplan: "Każdy spacer w tym tygodniu potraktuj jako bilans: która strategia działa i kiedy? Gdzie jeszcze musisz interweniować? Gdzie działa samodzielnie? Na koniec tygodnia zanotuj szczere podsumowanie.",
      no_gos: [
        "Traktowanie sukcesów jako oczywistości — uwaga pozostaje ważna.",
        "Zbyt mocne zmniejszanie częstotliwości nagradzania już w Fazie 3.",
        "Porównywanie z innymi zespołami pies-człowiek — wasza droga jest indywidualna.",
      ],
      fortschritt: [
        "{dogName} aktywnie stosuje min. 2 strategie na spacer.",
        "Czujesz się kompetentny i sprawczy.",
        "Reaktywność jest zauważalnie zmniejszona.",
      ],
      exerciseIds: ["a-bat-distanz", "a-maulkorb-positiv"],
    },
  ],
  generalisierung: [
    {
      title: "Ustanowienie treningu dostosowania zachowania w codzienności",
      schwerpunkt: "Faza 3 = trening dostosowania zachowania staje się standardem. {dogName} dostaje coraz więcej kontroli nad wyborem dystansu. W tym tygodniu ustanawiasz trening dostosowania zachowania we wszystkich normalnych sytuacjach spacerowych.",
      wochenziele: [
        "Trening dostosowania zachowania jest stosowany codziennie na normalnych spacerach.",
        "{dogName} sam wybiera strategie dystansu.",
        "Musisz mniej kierować.",
      ],
      tagesplan: "Na każdym spacerze aktywnie wplataj momenty treningu dostosowania zachowania: przy każdym bodźcu, który nie podchodzi ostro blisko, dajesz {dogName} czas na samoregulację. Gdy tylko pojawi się rozładowanie stresu: aktywnie z nim odejdź. Funkcjonalna nagroda staje się standardem.",
      no_gos: [
        "Wymuszanie treningu dostosowania zachowania — działa tylko gdy {dogName} sam go pokazuje.",
        "Kontynuowanie treningu dostosowania zachowania przy eskalacji — wtedy protokół awaryjny.",
        "Całkowite pomijanie innych strategii ('popatrz', łuk) — trening dostosowania zachowania uzupełnia, a nie zastępuje.",
      ],
      fortschritt: [
        "{dogName} samodzielnie się reguluje w wielu sytuacjach.",
        "Czujesz się towarzyszem, a nie sterującym.",
        "Spacery są spokojniejsze i pewniejsze.",
        "Przy niespodziewanym spotkaniu znasz 7-krokową sekwencję awaryjną i stosujesz ją bez dramatu.",
      ],
      exerciseIds: ["a-bat-distanz", "a-emergency-protokoll"],
    },
    {
      title: "Hierarchia bodźców i zarządzanie",
      schwerpunkt: "Określ jasno: które bodźce są dla {dogName} 'do ogarnięcia', a które pozostają tabu? Zarządzanie jest tak samo ważne jak trening — i rozróżnia między rzeczywistością a myśleniem życzeniowym.",
      wochenziele: [
        "Masz jasną hierarchię bodźców na papierze.",
        "Planujesz spacery odpowiednio.",
        "Rozpoznajesz, gdzie zarządzanie jest lepsze niż trening.",
      ],
      tagesplan: "Dzień 1-2: stwórz listę waszych bodźców według trudności. Dzień 3-7: planuj spacery odpowiednio. Trudne bodźce świadomie omijaj, średnie aktywnie trenuj, łatwe wprowadź w rutynę. Nigdy wszystkie bodźce jednego dnia.",
      no_gos: [
        "Zmuszanie do trudnych bodźców — eskaluje.",
        "Postrzeganie zarządzania jako 'poddania się' — to mądre uznanie rzeczywistości.",
        "Wyruszanie bez planu — ryzyko eskalacji.",
      ],
      fortschritt: [
        "Planujesz w sposób ustrukturyzowany.",
        "Eskalacje zdarzają się rzadziej.",
        "Akceptujesz, że nie wszystko da się wytrenować.",
      ],
      exerciseIds: ["a-schwellenwert-finden", "a-lat"],
    },
    {
      title: "Budowanie strefy buforowej przed konfrontacją",
      schwerpunkt: "Gdy wiesz, że nadchodzi spotkanie (wejście do parku, wąska ścieżka), pracujesz ze strefą buforową: 20 m wcześniej przestajesz mówić, trzymasz smakołyk w gotowości, przechodzisz w 'tryb treningowy'.",
      wochenziele: [
        "{dogName} zna rutynę strefy buforowej.",
        "Spotkania są przygotowane, a nie zaskakujące.",
        "Reakcje stresowe są prewencyjnie zapobiegane.",
      ],
      tagesplan: "Na każdym spacerze zaplanuj 3-5 stref buforowych: 20 m przed newralgicznym punktem przejdź w tryb treningowy. Dłoń w kieszeni gotowa, smycz krócej, aktywny sygnał PATRZ. Pojawia się bodziec: 'popatrz' lub przeciwwarunkowanie. Po 20 m poza linią widzenia: rozluźnienie.",
      no_gos: [
        "Zapomnienie o strefie buforowej i reagowanie dopiero reaktywnie.",
        "Strefa buforowa na łatwych odcinkach — rozmywa strategię.",
        "Zbyt wąska strefa buforowa — 5 m to za mało.",
      ],
      fortschritt: [
        "{dogName} reaguje na przygotowanie strefy buforowej spokojnym oczekiwaniem.",
        "Spotkania przebiegają pod kontrolą.",
        "Stosujesz tę strategię odruchowo.",
      ],
      exerciseIds: ["a-bogen-aktiv", "a-maulkorb-positiv"],
    },
    {
      title: "Aktywne sterowanie regeneracją po stresie",
      schwerpunkt: "Po każdym trudnym spotkaniu {dogName} potrzebuje czasu na regenerację. Hormony stresu w pełni się rozkładają dopiero po 72 h. Gdy to uwzględnisz, unikasz kumulującego się stresu.",
      wochenziele: [
        "Znasz zasadę 72 h: po silnym stresie min. 1-2 dni regeneracji.",
        "Plan spacerów {dogName} uwzględnia obciążenie stresem.",
        "Kumulujący się stres jest unikany.",
      ],
      tagesplan: "Po każdym spacerze zanotuj: faza silnego stresu tak/nie? Jeśli tak: następny dzień świadomie spokojny (krótszy spacer, więcej wyciszenia, mniej bodźców). Zasada 72 h: po silnym stresie 2 dni w 'trybie regeneracji'.",
      no_gos: [
        "Po stresie od razu znów wchodzić w strefę bodźców — kumuluje się.",
        "Zaprzeczanie fazom stresu — pies potrzebuje regeneracji.",
        "Postrzeganie trybu regeneracji jako 'straty' — to aktywny trening.",
      ],
      fortschritt: [
        "Pewnie rozpoznajesz obciążenie stresem.",
        "{dogName} ma jasne fazy regeneracji.",
        "Kumulacyjne eskalacje stresu są unikane.",
      ],
      exerciseIds: ["a-emergency-protokoll", "a-bat-distanz"],
    },
    {
      title: "Ostrożne zmniejszanie nagradzania",
      schwerpunkt: "Gdy strategie już siedzą, powoli zmniejszasz częstotliwość nagradzania. Ale: przy agresji NIGDY całkowicie nie odstawiaj. Nawet po latach wzmocnienie pozostaje ważne.",
      wochenziele: [
        "Częstotliwość nagradzania jest zmniejszona do ~50%.",
        "{dogName} utrzymuje strategie także przy mniejszej ilości nagród.",
        "Wybitne osiągnięcia są nadal nagradzane jackpotem.",
      ],
      tagesplan: "Przy bezpiecznych, znanych bodźcach: nie nagradzaj za każdym razem. Przy nowych lub trudnych bodźcach: nadal pełna częstotliwość nagradzania. {dogName} zauważa różnicę, ale szuka relacji zamiast smakołyka.",
      no_gos: [
        "Radykalne zmniejszanie częstotliwości nagradzania — ryzyko eskalacji.",
        "Oszczędzanie nagrody przy trudnych bodźcach — wybitne osiągnięcie kosztuje.",
        "Wymuszanie redukcji — cierpliwie, krok po kroku.",
      ],
      fortschritt: [
        "{dogName} pracuje także przy mniejszej ilości nagród.",
        "Relacja staje się cenniejsza niż smakołyk.",
        "Rzadziej sięgasz ręką do kieszeni.",
      ],
      exerciseIds: ["a-maulkorb-positiv", "a-lat"],
    },
    {
      title: "Trudne miejsca ukierunkowanie",
      schwerpunkt: "Miejsca, które do tej pory były omijane: poczekalnia u weterynarza, centrum miasta w godzinie szczytu. W tym tygodniu świadomie pracujesz nad pojedynczymi newralgicznymi punktami, zawsze z kagańcem jako zabezpieczeniem.",
      wochenziele: [
        "Ogarniasz 1 miejsce wysokiego ryzyka przez 10 min spokojnie.",
        "Kaganiec jest ustalony jako standard dla trudnych miejsc.",
        "{dogName} poszerza swój obszar komfortu.",
      ],
      tagesplan: "Wybierz na dzień dokładnie 1 miejsce wysokiego ryzyka. Kaganiec założony, przygotowany. 5-10 min pobytu z aktywnym 'popatrz'/przeciwwarunkowaniem. Przy stresie: wyjdź, żadnego dramatu. Ważne: nigdy zbyt długo.",
      no_gos: [
        "Kilka miejsc wysokiego ryzyka tego samego dnia — kumuluje się.",
        "Bez kagańca w nieznanych obszarach wysokiego ryzyka — bezpieczeństwo przede wszystkim.",
        "'Przeciąganie' {dogName} przy stresie — eskaluje.",
      ],
      fortschritt: [
        "Miejsca wysokiego ryzyka stają się do ogarnięcia.",
        "{dogName} poszerza swój repertuar.",
        "Jesteście bardziej elastyczni w codzienności.",
      ],
      exerciseIds: ["a-bogen-aktiv", "a-bat-distanz"],
    },
    {
      title: "Radzenie sobie z ruchomymi bodźcami",
      schwerpunkt: "Rowerzyści, deskorolkarze, szybko biegnący biegacze — ruchome bodźce są często największym wyzwaniem przy agresji. W tym tygodniu pracujesz nad tym ukierunkowanie.",
      wochenziele: [
        "{dogName} radzi sobie z przejeżdżającymi rowerami z 10 m odległości spokojnie.",
        "Masz jasne strategie stref buforowych dla ruchomych bodźców.",
        "Reakcje stresowe stają się rzadsze.",
      ],
      tagesplan: "Aktywnie szukaj tras z ruchomymi bodźcami (ścieżki rowerowe, trasy biegowe). Dystans startowy 15 m. 'Popatrz' przy każdym przejeździe. Utrzymuj wysoką częstotliwość nagradzania. Stopniowo zmniejszaj do 10 m.",
      no_gos: [
        "Od razu na wąską ścieżkę z ciągłym ruchem.",
        "Chęć prowokowania ruchomych bodźców — ryzyko eskalacji.",
        "Zamieranie przy eskalacji — stosuj protokół awaryjny.",
      ],
      fortschritt: [
        "{dogName} reaguje spokojniej na ruchome bodźce.",
        "Czujesz się pewnie na trasach z ruchem.",
        "Ruchome bodźce tracą swoją grozę.",
      ],
      exerciseIds: ["a-lat", "a-maulkorb-positiv"],
    },
    {
      title: "Przejście w tryb podtrzymania",
      schwerpunkt: "Ostatni tydzień. Praca nad agresją to zadanie na całe życie, a nie zakończony proces. Ale: narzędzia siedzą, strategie są przećwiczone, czujesz się kompetentny. Plan podtrzymania jest gotowy.",
      wochenziele: [
        "Wszystkie narzędzia działają w codzienności.",
        "Rytm podtrzymania jest jasny.",
        "Jesteś sprawczy długoterminowo.",
      ],
      tagesplan: "Zaplanuj plan podtrzymania: co 2-3 tygodnie jeden 'dzień treningowy', w którym celowo ćwiczysz jeszcze raz 'popatrz'/trening dostosowania zachowania/łuk. Co 3 miesiące bilans z trenerem psów. Kaganiec trzymaj w gotowości na sytuacje awaryjne. Nadal przestrzegaj zasady 72 h.",
      no_gos: [
        "Gwałtowne odstawienie wszystkich rutyn — ryzyko regresu.",
        "Postrzeganie agresji jako 'rozwiązanej' — potrzebuje dalszej uwagi.",
        "Ryzykowanie sytuacji wysokiego ryzyka bez kagańca — bezpieczeństwo pozostaje ważne.",
      ],
      fortschritt: [
        "{dogName} jest długoterminowo bardziej kontrolowalny.",
        "Czujesz się kompetentnym menedżerem reaktywności.",
        "Eskalacje są rzadkie i wcześnie rozpoznawane.",
      ],
      exerciseIds: ["a-bat-distanz", "a-emergency-protokoll"],
    },
  ],
};

// ────────────────────────────────────────────────────────────────────
// MOUTHING (podnoszenie przedmiotów) — PUŚĆ, zamiana, zarządzanie
// ────────────────────────────────────────────────────────────────────
const MOUTHING_WEEKS: Record<Phase, WeekTemplate[]> = {
  fundament: [
    {
      title: "Czyste budowanie sygnału PUŚĆ",
      schwerpunkt: "PUŚĆ to w ogóle najważniejszy sygnał. Musi być POZYTYWNY, inaczej {dogName} nic nie wypluje, gdy zrobi się poważnie. W tym tygodniu budujesz go w domu z przedmiotami o niskiej wartości.",
      wochenziele: [
        "{dogName} dobrowolnie oddaje przedmioty na PUŚĆ.",
        "Sygnał jest powiązany z pozytywną nagrodą.",
        "Możesz go pewnie stosować w spokojnych sytuacjach.",
      ],
      tagesplan: "3-4 sesje po 5 min dziennie. Zacznij od zabawki o niskiej wartości. Powiedz PUŚĆ + zaproponuj wartościowy smakołyk. {dogName} upuszcza → DOBRZE + smakołyk + zabawka z powrotem. {dogName} uczy się: PUŚĆ przynosi coś lepszego I odzyskuję oryginał.",
      no_gos: [
        "Sięganie ręką do pyska — zatruwa sygnał.",
        "PUŚĆ groźnym tonem — zostaje skojarzone negatywnie.",
        "Wartościowe przedmioty na początku — zbyt trudne.",
      ],
      fortschritt: [
        "{dogName} oddaje proste przedmioty na PUŚĆ.",
        "Czas reakcji jest poniżej 3 sek.",
        "Masz niezawodne narzędzie na sytuacje zamiany.",
      ],
      exerciseIds: ["m-aus-aufbauen", "m-pfui-konditionieren"],
    },
    {
      title: "Ustanowienie handlu wymiennego",
      schwerpunkt: "Gdy {dogName} coś podniesie na zewnątrz, zamiana musi być standardową reakcją. Nie konflikt, lecz dowartościowanie: oddaję, dostaję coś lepszego.",
      wochenziele: [
        "Reagujesz na podniesiony przedmiot zamianą, a nie konfliktem.",
        "{dogName} zna zasadę zamiany.",
        "Spacery przez newralgiczne miejsca przebiegają bez dramatu.",
      ],
      tagesplan: "Ćwicz w domu z różnymi przedmiotami: {dogName} ma coś w pysku, podchodzisz spokojnie, mówisz PUŚĆ, unosisz smakołyk, zamiana. Nigdy nie chwytaj ani nie biegnij. Dziennie 5-7 ćwiczeń zamiany w domu, potem przeniesienie na spacery.",
      no_gos: [
        "Bieganie za psem, gdy coś podniesie — wzmacnia zabawę.",
        "Oddawanie podniesionego przedmiotu — wtedy zamiana nie jest prawdziwa.",
        "Stosowanie groźby lub kary — zatruwa relację.",
      ],
      fortschritt: [
        "{dogName} oddaje, nie uciekając.",
        "Zamiana jest standardową reakcją w sytuacjach podnoszenia.",
        "Nie czujesz się już bezsilny.",
      ],
      exerciseIds: ["m-tausch-protokoll", "m-leinen-management"],
    },
    {
      title: "Warunkowanie FUJ jako sygnału stop",
      schwerpunkt: "FUJ stosuje się ZANIM {dogName} coś podniesie. Czysto zwarunkowane z alternatywną nagrodą, FUJ przez tygodnie staje się automatyczne. Nigdy jako kara.",
      wochenziele: [
        "{dogName} reaguje na FUJ zatrzymaniem się.",
        "Zwraca się po nagrodę do opiekuna.",
        "Sygnał jest pewnie zwarunkowany w domu.",
      ],
      tagesplan: "W domu ze smakołykiem na podłodze, którego {dogName} nie może dostać: FUJ stanowczym, ale spokojnym głosem, natychmiast zaproponuj wartościowy smakołyk z ręki. {dogName} odwraca się od smakołyka z podłogi do ręki → DOBRZE + smakołyk. 5-7 powtórzeń na sesję, 3 sesje dziennie.",
      no_gos: [
        "Używanie FUJ jako czystej kary.",
        "Nadużywanie — rozmywa znaczenie.",
        "Bez alternatywnej nagrody — {dogName} nie rozumie skojarzenia.",
      ],
      fortschritt: [
        "{dogName} pewnie reaguje na FUJ w domu.",
        "Czas reakcji jest poniżej 2 sek.",
        "Jesteś gotowy na przeniesienie na zewnątrz.",
      ],
      exerciseIds: ["m-pfui-konditionieren", "m-aus-aufbauen"],
    },
    {
      title: "Nauka zarządzania smyczą",
      schwerpunkt: "Większości sytuacji podnoszenia da się uniknąć dzięki zarządzaniu smyczą. W newralgicznych miejscach (śmietniki, wejścia do parku) trzymasz smycz krótko i aktywnie odwracasz uwagę. Prewencja zamiast reakcji.",
      wochenziele: [
        "Wyraźnie rozpoznajesz wasze typowe newralgiczne miejsca.",
        "W newralgicznych miejscach smycz odruchowo się skraca.",
        "{dogName} uczy się: w tych miejscach uwaga skierowana na opiekuna jest cenniejsza.",
      ],
      tagesplan: "Dzień 1-2: notuj na normalnych spacerach, gdzie {dogName} najczęściej podnosi. Dzień 3-7: w tych miejscach aktywnie smycz na 1 m, nagradzanie w pozycji przy nodze podczas przejścia, co 5 kroków smakołyk przy szwie nogawki.",
      no_gos: [
        "Ignorowanie newralgicznych miejsc — udane podniesienie wzmacnia zachowanie.",
        "Skracanie smyczy tylko przy widocznym zainteresowaniu {dogName} — prewencyjnie jest lepiej.",
        "Przechodzenie bez aktywnego nagradzania — staje się obciążeniem.",
      ],
      fortschritt: [
        "{dogName} w newralgicznych miejscach szuka pozycji przy nodze.",
        "Częstotliwość podnoszenia w znanych miejscach maleje.",
        "Jesteś proaktywny zamiast reaktywny.",
      ],
      exerciseIds: ["m-leinen-management", "m-maulkorb-uebergang"],
    },
    // Pogłębienia
    {
      title: "PUŚĆ przy rosnącej wartości",
      schwerpunkt: "W nawiązaniu do tygodnia 1: PUŚĆ teraz z bardziej wartościowymi przedmiotami, nawet kośćmi i ulubioną zabawką. {dogName} musi się nauczyć: nawet przy cennych przedmiotach zamiana to lepszy interes.",
      wochenziele: [
        "{dogName} oddaje na PUŚĆ także wartościowe przedmioty.",
        "Nagroda musi być odpowiednio wartościowa (kurczak, kiełbasa).",
        "Masz pełne zaufanie do sygnału.",
      ],
      tagesplan: "Zwiększaj wartość dzień po dniu: dzień 1-2: prosta zabawka. Dzień 3-4: ulubiona zabawka. Dzień 5-7: kość lub gryzak. Przy każdym PUŚĆ nagroda musi odpowiadać przedmiotowi — przy kości MEGA-kurczak.",
      no_gos: [
        "Zbyt szybkie zwiększanie wartości — frustracja.",
        "Zbyt niska nagroda — {dogName} nie oddaje.",
        "PUŚĆ przy skrajnie wartościowym przedmiocie (obrona zasobów) bez profesjonalnej pomocy — niebezpieczne.",
      ],
      fortschritt: [
        "PUŚĆ działa także przy wartościowych przedmiotach.",
        "{dogName} aktywnie szuka okazji do zamiany.",
        "Masz zaufanie do tego narzędzia.",
      ],
      exerciseIds: ["m-aus-aufbauen", "m-tausch-protokoll"],
    },
    {
      title: "Kaganiec na okres przejściowy",
      schwerpunkt: "Dopóki trening nie siedzi w 100%, kaganiec chroni {dogName} przed zatrutymi przynętami i ostrymi przedmiotami. W tym tygodniu warunkujesz go pozytywnie.",
      wochenziele: [
        "{dogName} nosi kaganiec 10-15 min bez napięcia.",
        "Potrafi w kagańcu pić i wąchać.",
        "Kaganiec jest narzędziem bezpieczeństwa, a nie karą.",
      ],
      tagesplan: "Dzień 1-3: kaganiec widocznie w mieszkaniu, smakołyki przez pręty kraty. Dzień 4-5: krótkie okresy noszenia 1-2 min z zajęciem. Dzień 6-7: 10-15 min noszenia z Kongiem. Przeniesienie w Fazie 2 na realne spacery wysokiego ryzyka.",
      no_gos: [
        "Zbyt szybkie zakładanie kagańca na długi czas — frustracja.",
        "Używanie kagańca jako kary — zatruwa skojarzenie.",
        "Wybór złego typu (materiałowa pętla) — blokuje też dyszenie.",
      ],
      fortschritt: [
        "{dogName} nosi kaganiec bez napięcia.",
        "Masz awaryjne zabezpieczenie.",
        "Kaganiec jest rutyną, a nie dramatem.",
      ],
      exerciseIds: ["m-maulkorb-uebergang", "m-leinen-management"],
    },
    {
      title: "Szukanie nagrody jako alternatywa",
      schwerpunkt: "Psy z popędem do podnoszenia mają często silny popęd do szukania. Kanalizujemy to produktywnie: aktywne szukanie zamiast przypadkowego podnoszenia. Nos zajmuje się DOZWOLONYM szukaniem.",
      wochenziele: [
        "{dogName} aktywnie szuka rzuconego jedzenia.",
        "Szukanie nagrody częściowo zastępuje przypadkowe podnoszenie.",
        "Popęd do szukania jest produktywnie kanalizowany.",
      ],
      tagesplan: "Na każdym spacerze w bezpiecznych miejscach (łąka, czysty park): rzuć mały smakołyk i powiedz SZUKAJ. {dogName} aktywnie szuka nosem. 5-7 razy na spacer. Zwiększanie: 2 smakołyki jednocześnie w różne strony.",
      no_gos: [
        "Gra w SZUKAJ na odcinkach z newralgicznymi miejscami — przeciąża.",
        "Aktywne wskazywanie {dogName} — samodzielne szukanie jest efektem nauki.",
        "Zbyt duże nagrody — pies się naje przed końcem spaceru.",
      ],
      fortschritt: [
        "{dogName} aktywnie szuka rzuconych nagród.",
        "Popęd do szukania jest produktywnie zaspokojony.",
        "Zachowanie podnoszenia częściowo maleje.",
      ],
      exerciseIds: ["m-belohnungs-suche", "m-pfui-konditionieren"],
    },
    {
      title: "Sprawdzenie fundamentów",
      schwerpunkt: "Ostatni tydzień fundamentów. PUŚĆ pozytywne? Zamiana siedzi? FUJ działa w domu? Kaganiec zaakceptowany? Te narzędzia są bazą do zastosowania na zewnątrz.",
      wochenziele: [
        "Wszystkie 4 elementy są ustalone: PUŚĆ, zamiana, FUJ, kaganiec.",
        "Czujesz się przygotowany do zastosowania na zewnątrz.",
        "{dogName} zna te narzędzia.",
      ],
      tagesplan: "Zrób szczery bilans: co siedzi, co się chwieje? Jeśli słabość: dołóż 1 dodatkowy tydzień. Czysty fundament jest warunkiem pracy na zewnątrz.",
      no_gos: [
        "Przeskakiwanie do Fazy 2 z niecierpliwości.",
        "Nadrabianie kilku słabości naraz.",
        "Porzucanie planu, bo fundament trwa dłużej.",
      ],
      fortschritt: [
        "Czujesz się kompetentny.",
        "Narzędzia siedzą jasno.",
        "{dogName} zna te elementy.",
      ],
      exerciseIds: ["m-aus-aufbauen", "m-tausch-protokoll"],
    },
  ],
  steigerung: [
    {
      title: "PUŚĆ na zewnątrz przy łatwych bodźcach",
      schwerpunkt: "Przeniesienie z domu na zewnątrz. {dogName} podniósł coś o niskiej wartości (kawałek papieru, liść): PUŚĆ-zamiana jak ćwiczone w domu. W prawdziwym otoczeniu.",
      wochenziele: [
        "PUŚĆ działa na zewnątrz przy podnoszeniu rzeczy o niskiej wartości.",
        "Reagujesz spokojnie i bez dramatu.",
        "{dogName} rozumie: ta zasada obowiązuje także na zewnątrz.",
      ],
      tagesplan: "Na każdym spacerze spodziewaj się 2-3 sytuacji podnoszenia, bądź przygotowany. Przy podniesieniu: spokojnie podejdź wzrokiem, powiedz PUŚĆ, zaproponuj wartościowy smakołyk. Wysoka częstotliwość nagradzania na tym etapie.",
      no_gos: [
        "Od razu PUŚĆ przy bardziej wartościowych przedmiotach (kość, mięso) — zbyt trudne na Fazę 2.",
        "Szukanie konfliktu, gdy PUŚĆ nie działa — eskaluje.",
        "Wyruszanie bez smakołyka — zamiana bez niego jest niemożliwa.",
      ],
      fortschritt: [
        "PUŚĆ działa na zewnątrz przy prostych przedmiotach.",
        "Czas reakcji jest akceptowalny.",
        "Czujesz się sprawczy.",
      ],
      exerciseIds: ["m-pfui-konditionieren", "m-tausch-protokoll"],
    },
    {
      title: "Stosowanie FUJ na zewnątrz",
      schwerpunkt: "FUJ stosuje się ZANIM {dogName} podniesie. Gdy widzisz, że pochyla się w stronę czegoś: FUJ + alternatywna nagroda. Przez tygodnie FUJ staje się automatyczne.",
      wochenziele: [
        "Rozpoznajesz wcześnie oznaki podnoszenia (nos przy ziemi, zmiana tempa chodu).",
        "FUJ jest stosowane prewencyjnie.",
        "{dogName} reaguje zatrzymaniem się i zwrotem do opiekuna.",
      ],
      tagesplan: "Na każdym spacerze 5-10 zastosowań FUJ, za każdym razem prewencyjnie: zanim {dogName} podniesie. Przy reakcji: DOBRZE + smakołyk. Przy braku reakcji: podejdź 1 m bliżej, zablokuj ciałem, zaproponuj smakołyk.",
      no_gos: [
        "Nadużywanie FUJ — przestaje działać.",
        "FUJ bez alternatywnej nagrody — kara zamiast treningu.",
        "Ignorowanie oznak podnoszenia — FUJ przychodzi za późno.",
      ],
      fortschritt: [
        "FUJ działa na zewnątrz.",
        "Rozpoznajesz oznaki wcześnie.",
        "Próby podnoszenia maleją.",
      ],
      exerciseIds: ["m-aus-aufbauen", "m-maulkorb-uebergang"],
    },
    {
      title: "Zarządzanie smyczą w newralgicznych miejscach",
      schwerpunkt: "Aktywne zarządzanie smyczą w waszych typowych newralgicznych miejscach podnoszenia. Smycz krótko, nagroda w pozycji przy nodze. Prewencja przez kontrolę przestrzeni.",
      wochenziele: [
        "W newralgicznych miejscach smycz odruchowo się skraca.",
        "{dogName} w newralgicznych miejscach szuka pozycji przy nodze.",
        "Częstotliwość podnoszenia w znanych miejscach wyraźnie maleje.",
      ],
      tagesplan: "Na każdym spacerze w 3-5 newralgicznych miejscach smycz na 1 m, ciągłe nagradzanie przy szwie nogawki co 5 kroków. {dogName} skupia się na Tobie, a nie na ziemi. Po newralgicznym miejscu: smycz znów luźniej.",
      no_gos: [
        "Skracanie smyczy TYLKO w newralgicznych miejscach — {dogName} to zapamiętuje.",
        "Bez aktywnego nagradzania — staje się obciążeniem.",
        "Unikanie odcinków z newralgicznymi miejscami, gdy da się ich uniknąć — unikanie też jest rozwiązaniem.",
      ],
      fortschritt: [
        "Zachowanie podnoszenia w newralgicznych miejscach maleje.",
        "{dogName} aktywnie szuka pozycji przy nodze.",
        "Spacery są bardziej kontrolowane.",
      ],
      exerciseIds: ["m-leinen-management", "m-pfui-konditionieren"],
    },
    {
      title: "Aktywne wykorzystanie szukania nagrody",
      schwerpunkt: "Popęd do szukania jest produktywnie wykorzystywany: na każdym spacerze kilka rzuconych nagród, {dogName} uczy się aktywnie szukać nosem zamiast przypadkowo podnosić.",
      wochenziele: [
        "5-7 jednostek SZUKAJ na spacer.",
        "{dogName} szuka aktywnie i w skupieniu.",
        "Popęd do szukania jest kanalizowany.",
      ],
      tagesplan: "Na każdym spacerze w bezpiecznych miejscach (czysto, bez śmieci) 5-7 razy rzuć smakołyk + SZUKAJ. Zwiększanie w ciągu tygodnia: trudniejsze kryjówki, 2 smakołyki jednocześnie, wyższa trawa. Spacery stają się mini-sesjami tropienia.",
      no_gos: [
        "W niebezpiecznych miejscach ze śmieciami lub ryzykiem zatrutej przynęty — gra w szukanie z kontrolowanymi nagrodami, a nie swobodne podnoszenie.",
        "Zbyt duże smakołyki — {dogName} się naje przed końcem spaceru.",
        "Gra w szukanie jako główny posiłek — powinna być dodatkiem.",
      ],
      fortschritt: [
        "Gra w szukanie jest wyćwiczona.",
        "{dogName} aktywnie pracuje nosem.",
        "Zachowanie podnoszenia maleje.",
      ],
      exerciseIds: ["m-belohnungs-suche", "m-maulkorb-uebergang"],
    },
    // Pogłębienia 6-miesięczne
    {
      title: "PUŚĆ przy bardziej wartościowych przedmiotach",
      schwerpunkt: "Zwiększenie trudności: {dogName} podnosi kość lub żywność. PUŚĆ musi działać także tutaj. MEGA-kurczak jako nagroda jest w gotowości.",
      wochenziele: [
        "PUŚĆ działa przy wartościowych przedmiotach na zewnątrz.",
        "MEGA-nagroda jest konsekwentnie oferowana.",
        "{dogName} oddaje także cenne przedmioty.",
      ],
      tagesplan: "Przygotowanie: na każdym spacerze kieszeń z MEGA-nagrodą (mały kawałek kiełbasy lub kurczaka). Przy bardziej wartościowym podniesionym przedmiocie: PUŚĆ + od razu zaproponuj kiełbasę. Nigdy nie wchodź w takie sytuacje bez MEGA-nagrody.",
      no_gos: [
        "Oszczędzanie MEGA-nagrody — przy wartościowych przedmiotach to kosztuje.",
        "Oddawanie podniesionego wartościowego przedmiotu — wtedy zamiana nie jest prawdziwa.",
        "Szukanie konfliktu, gdy PUŚĆ nie działa — grozi obrona zasobów.",
      ],
      fortschritt: [
        "PUŚĆ działa przy różnych wartościach.",
        "Czujesz się przygotowany.",
        "Handel wymienny jest solidnie ustalony.",
      ],
      exerciseIds: ["m-aus-aufbauen", "m-tausch-protokoll"],
    },
    {
      title: "Kaganiec w strefach wysokiego ryzyka",
      schwerpunkt: "Na szczególnie trudnych odcinkach (skraj parku ze śmieciami, spacery po mieście) stosujesz kaganiec. Bezpieczeństwo przed myśleniem życzeniowym.",
      wochenziele: [
        "Kaganiec jest rutynowo noszony na spacerach wysokiego ryzyka.",
        "{dogName} reaguje pozytywnie na przygotowanie kagańca.",
        "Czujesz się bezpiecznie w trudnych sytuacjach.",
      ],
      tagesplan: "Zidentyfikuj wasze odcinki wysokiego ryzyka. W te dni przed startem spaceru: kaganiec założony z nagrodą Kong. Spacer normalnie, PUŚĆ-zamiana gdzie się da. Po spacerze: kaganiec zdjęty, MEGA-nagroda.",
      no_gos: [
        "Kaganiec przy pierwszym spacerze bez pozytywnego warunkowania — frustracja.",
        "Kaganiec na WSZYSTKIE spacery — to narzędzie, a nie standard.",
        "Ryzykowanie bez kagańca w skrajnie ryzykownych obszarach — porażka bezpieczeństwa.",
      ],
      fortschritt: [
        "Noszenie kagańca jest rutyną.",
        "Spacery wysokiego ryzyka są bezpieczne.",
        "Jesteś spokojniejszy w trudnych sytuacjach.",
      ],
      exerciseIds: ["m-maulkorb-uebergang", "m-leinen-management"],
    },
    {
      title: "Strategia łączona: FUJ + PUŚĆ + zamiana",
      schwerpunkt: "W tym tygodniu łączysz płynnie wszystkie trzy narzędzia: FUJ przy oznakach podnoszenia, PUŚĆ gdy już podniesione, zamiana jako nagroda. Sekwencja staje się automatyczna.",
      wochenziele: [
        "Stosujesz sekwencję odruchowo.",
        "{dogName} rozumie system.",
        "Sytuacje podnoszenia są rozwiązywane elastycznie.",
      ],
      tagesplan: "Na każdym spacerze aktywnie stosuj sekwencję: 1. FUJ przy oznakach → jeśli działa, DOBRZE. 2. PUŚĆ gdy już podniesione → zamiana. 3. Przy wysokim ryzyku: kaganiec. Sekwencja staje się płynna w ciągu tygodnia.",
      no_gos: [
        "Stosowanie narzędzi w złej kolejności — FUJ jest prewencyjne, PUŚĆ reaktywne.",
        "Pomijanie pojedynczych narzędzi — system to więcej niż suma części.",
        "Nerwowe przełączanie — spokojna sekwencja.",
      ],
      fortschritt: [
        "Stosujesz sekwencję odruchowo.",
        "{dogName} reaguje przewidywalnie na każdy krok.",
        "Zachowanie podnoszenia jest wyraźnie zmniejszone.",
      ],
      exerciseIds: ["m-pfui-konditionieren", "m-aus-aufbauen", "m-tausch-protokoll"],
    },
    {
      title: "Utrwalenie etapu wzmożenia",
      schwerpunkt: "Ostatni tydzień etapu wzmożenia. Wszystkie narzędzia siedzą, sekwencja jest płynna. Faza 3 = generalizacja w prawdziwej codzienności ze zmniejszaniem nagradzania.",
      wochenziele: [
        "Wszystkie narzędzia działają płynnie.",
        "Częstotliwość podnoszenia jest wyraźnie zmniejszona.",
        "Jesteś przygotowany na Fazę 3.",
      ],
      tagesplan: "Tydzień bilansu: co działa świetnie, co się chwieje? Zanotuj typowe wzorce podnoszenia {dogName}. Zaplanuj na Fazę 3 zmniejszanie nagradzania i nowe trasy.",
      no_gos: [
        "Traktowanie sukcesów jako oczywistości.",
        "Zbyt szybkie zmniejszanie częstotliwości nagradzania.",
        "Całkowite odstawienie kagańca, gdy nadal są spacery wysokiego ryzyka.",
      ],
      fortschritt: [
        "Zachowanie podnoszenia jest wyraźnie zmniejszone.",
        "Czujesz się kompetentny.",
        "Narzędzia siedzą płynnie.",
      ],
      exerciseIds: ["m-leinen-management", "m-belohnungs-suche"],
    },
  ],
  generalisierung: [
    {
      title: "Zmniejszanie nagradzania z ostrożnością",
      schwerpunkt: "Faza 3 zaczyna się od ostrożnego zmniejszania częstotliwości nagradzania. Ale: NIGDY całkowicie nie odstawiaj, inaczej stare zachowanie wróci. Zmienne wzmocnienie pozostaje.",
      wochenziele: [
        "Częstotliwość nagradzania jest zmniejszona do ~50%.",
        "{dogName} reaguje na narzędzia także przy mniejszej ilości nagród.",
        "Wybitne osiągnięcia są nadal nagradzane jackpotem.",
      ],
      tagesplan: "W bezpiecznych, rutynowych sytuacjach: nie każde PUŚĆ czy zamiana ze smakołykiem. W nowych lub trudnych sytuacjach: nadal pełna nagroda. {dogName} uczy się: system zostaje, ale nie za każdym razem kurczak.",
      no_gos: [
        "Całkowite skreślenie nagrody — nawrót.",
        "Redukcja na trudnych odcinkach — za wcześnie.",
        "Radykalne obniżanie częstotliwości nagradzania — stopniowo.",
      ],
      fortschritt: [
        "{dogName} reaguje także przy mniejszej ilości nagród.",
        "Rzadziej sięgasz do kieszeni.",
        "Zachowanie staje się stabilniejsze bez ciągłego wzmacniania.",
      ],
      exerciseIds: ["m-belohnungs-suche", "m-leinen-management"],
    },
    {
      title: "Różne trasy: generalizacja",
      schwerpunkt: "{dogName} przenosi zarządzanie podnoszeniem na nowe trasy. Nowe otoczenie = nowe bodźce do podnoszenia, ale ta sama strategia.",
      wochenziele: [
        "{dogName} pokonuje z powodzeniem 2-3 nowe trasy.",
        "Strategie działają niezależnie od trasy.",
        "Jesteś elastyczny w wyborze spaceru.",
      ],
      tagesplan: "Zaplanuj w tygodniu 3 różne trasy: waszą zwyczajną, nową w sąsiedniej miejscowości, jedną w mieście. Na nowych trasach: częstotliwość nagradzania znów wyższa, bo nowe bodźce. FUJ/PUŚĆ/zamiana jak ćwiczone.",
      no_gos: [
        "Na nowych trasach nagroda jak na znanych — za mało.",
        "Kilka nowych tras dziennie — przeciąża.",
        "Oczekiwanie, że wszędzie zadziała dokładnie jak w domu.",
      ],
      fortschritt: [
        "Strategie działają w różnych otoczeniach.",
        "Czujesz się elastyczny.",
        "Zachowanie podnoszenia jest zmniejszone w sposób uogólniony.",
      ],
      exerciseIds: ["m-aus-aufbauen", "m-pfui-konditionieren"],
    },
    {
      title: "Przećwiczenie newralgicznych miejsc",
      schwerpunkt: "W tym tygodniu świadomie pracujesz nad waszymi osobistymi newralgicznymi miejscami. Wejście do weterynarza? Przystanek autobusowy? Wejście do parku? Na każde newralgiczne miejsce konkretna strategia.",
      wochenziele: [
        "Masz strategię na każde główne newralgiczne miejsce.",
        "{dogName} pokonuje najtrudniejsze punkty.",
        "Częstotliwość podnoszenia w newralgicznych miejscach maleje w sposób mierzalny.",
      ],
      tagesplan: "Zidentyfikuj wasze 3 najważniejsze newralgiczne miejsca. Zaplanuj na każde specyficzną strategię: kaganiec? Krótka smycz + przy nodze? FUJ prewencyjnie? Ćwicz tę strategię 3-4 razy w danym miejscu.",
      no_gos: [
        "Kilka newralgicznych miejsc dziennie — kumulacyjny zalew bodźców.",
        "Unikanie newralgicznych miejsc zamiast świadomej pracy — utrata okazji do ćwiczeń.",
        "Zmiana strategii na każde newralgiczne miejsce — konsekwencja jest wszystkim.",
      ],
      fortschritt: [
        "Masz jasne strategie na każde newralgiczne miejsce.",
        "{dogName} reaguje przewidywalnie.",
        "Newralgiczne miejsca tracą swoją grozę.",
      ],
      exerciseIds: ["m-leinen-management", "m-maulkorb-uebergang"],
    },
    {
      title: "Praca węchowa jako główne zajęcie",
      schwerpunkt: "Popęd {dogName} do szukania jest intensywnie i produktywnie wykorzystywany: dłuższe sesje tropienia, bardziej złożone gry węchowe, wędrówki z wąchaniem. Więcej zaspokojenia potrzeby szukania = mniej przypadkowego podnoszenia.",
      wochenziele: [
        "Min. 1 dłuższa sesja pracy węchowej na spacer.",
        "Popęd do szukania jest intensywnie kanalizowany.",
        "{dogName} jest po pracy węchowej spokojny i zadowolony.",
      ],
      tagesplan: "Na każdym spacerze 1 dłuższa jednostka szukania (10-15 min): trop 20-30 m, wędrówka z wąchaniem przez wysoką trawę z rozłożonymi nagrodami, gry węchowe o różnym stopniu trudności.",
      no_gos: [
        "Postrzeganie pracy węchowej jako czystego odwrócenia uwagi — to podstawowe zaspokojenie potrzeby.",
        "Zbyt łatwe zadania węchowe — nie przeciążają, ale i nie zajmują.",
        "Spacery bez jednostki szukania — popęd do szukania znajdzie sobie coś innego.",
      ],
      fortschritt: [
        "Popęd do szukania jest produktywnie zaspokojony.",
        "Zachowanie podnoszenia jest wyraźnie zmniejszone.",
        "Spacery są satysfakcjonujące.",
      ],
      exerciseIds: ["m-belohnungs-suche", "m-tausch-protokoll"],
    },
    {
      title: "Trudne pory dnia",
      schwerpunkt: "Godziny szczytu, gdy dużo psów jest na dworze. Gdy ryzyko podnoszenia jest wysokie (park w weekend, miasto w porze lunchu). W tym tygodniu opanowujesz także te fazy.",
      wochenziele: [
        "Radzisz sobie z godzinami szczytu spokojnie.",
        "Strategie działają także przy zalewie bodźców.",
        "Planujesz elastycznie.",
      ],
      tagesplan: "1-2 razy w tygodniu świadomie wybierz trudną porę dnia: niedzielne południe w parku, początek lekcji pod szkołą. Przygotowanie: garść smakołyków, kaganiec przy wysokim ryzyku. Na spacer 1-2 trudne sytuacje, maksymalnie.",
      no_gos: [
        "Przecenianie się i wchodzenie w największy tłok.",
        "Kontynuowanie przy stresie — przerwij.",
        "Generalne unikanie trudnych pór — zbytnio was ogranicza.",
      ],
      fortschritt: [
        "Radzisz sobie z trudnymi porami dnia.",
        "Strategie działają także pod presją.",
        "Wasz promień aktywności się powiększa.",
      ],
      exerciseIds: ["m-leinen-management", "m-aus-aufbauen"],
    },
    {
      title: "Redukcja kagańca (jeśli możliwe)",
      schwerpunkt: "Gdy narzędzia po kilku miesiącach pewnie siedzą, możesz zdejmować kaganiec w określonych sytuacjach. Ale TYLKO gdy PUŚĆ i FUJ działają w 95%+.",
      wochenziele: [
        "Masz jasną decyzję: kiedy kaganiec tak, kiedy nie.",
        "Przy braku kagańca narzędzia są niezawodne.",
        "Bezpieczeństwo pozostaje najwyższą zasadą.",
      ],
      tagesplan: "Dzień 1-3: oceń szczerze, czy PUŚĆ i FUJ na znanych trasach działają w 95%+. Jeśli tak: testuj bez kagańca na tych znanych trasach. Jeśli nie: utrzymaj rutynę kagańca. Na trasach wysokiego ryzyka: nadal kaganiec.",
      no_gos: [
        "Redukcja kagańca z wygody bez rzetelnej oceny.",
        "Bez kagańca na nowych lub trudnych trasach — zbyt ryzykowne.",
        "Całkowite pozbycie się kagańca — przy reaktywnych psach pozostaje narzędziem.",
      ],
      fortschritt: [
        "Używasz kagańca celowo, a nie odruchowo.",
        "Narzędzia są niezawodne.",
        "Bezpieczeństwo jest zapewnione.",
      ],
      exerciseIds: ["m-maulkorb-uebergang", "m-tausch-protokoll"],
    },
    {
      title: "Podtrzymanie i awaryjne przy zalewie bodźców",
      schwerpunkt: "Rutyna podtrzymania na kolejne miesiące. Plus: jasny protokół awaryjny na zalew bodźców (np. w dzień wywozu śmieci), gdyby {dogName} jednak wrócił do starego zachowania.",
      wochenziele: [
        "Plan podtrzymania jest jasny.",
        "Protokół awaryjny na zalew bodźców jest przećwiczony.",
        "Czujesz się sprawczy długoterminowo.",
      ],
      tagesplan: "Plan podtrzymania: co 2 tygodnie jeden 'dzień odświeżający' ze wszystkimi narzędziami. Protokół awaryjny: przy masowym zalewie bodźców natychmiast kaganiec, krótka smycz, przerwij odcinek, inna trasa. Szkic planu na papierze.",
      no_gos: [
        "Gwałtowne odstawienie wszystkich rutyn.",
        "Postrzeganie nawrotów jako 'porażki' — krótkie odświeżenia często wystarczają.",
        "Ćwiczenie protokołu awaryjnego dopiero w sytuacji awaryjnej — wcześniej sekwencja na sucho.",
      ],
      fortschritt: [
        "Masz jasną rutynę podtrzymania.",
        "Protokół awaryjny siedzi.",
        "Czujesz się kompetentny długoterminowo.",
      ],
      exerciseIds: ["m-aus-aufbauen", "m-pfui-konditionieren"],
    },
    {
      title: "Przejście w tryb podtrzymania",
      schwerpunkt: "Ostatni tydzień. Zachowanie podnoszenia jest wyraźnie zmniejszone, narzędzia siedzą, plan podtrzymania jest gotowy. {dogName} to inny pies niż na początku planu.",
      wochenziele: [
        "Wszystkie rutyny działają samodzielnie.",
        "Rytm podtrzymania jest jasny.",
        "{dogName} jest długoterminowo pewniejszy w sytuacjach podnoszenia.",
      ],
      tagesplan: "Zredukuj aktywny trening do minimum. Obserwuj. Planuj co 4-6 tygodni odświeżenie z powtórkami PUŚĆ/FUJ/zamiana. Kaganiec w gotowości na trasy wysokiego ryzyka.",
      no_gos: [
        "Gwałtowne odstawienie rutyn.",
        "Zaprzestanie obserwacji — wcześnie rozpoznawaj drobne nawroty.",
        "Odkładanie odświeżeń podtrzymania na nigdy.",
      ],
      fortschritt: [
        "{dogName} jest długoterminowo bardziej niezawodny.",
        "Czujesz się kompetentny.",
        "Zachowanie podnoszenia jest wyjątkiem, a nie normą.",
      ],
      exerciseIds: ["m-tausch-protokoll", "m-leinen-management"],
    },
  ],
};

const RECALL_WEEKS: Record<Phase, WeekTemplate[]> = {
  fundament: [
    {
      title: "DO MNIE od nowa z najlepszymi smakołykami",
      schwerpunkt: "Jeśli DO MNIE nie jest w 100% pozytywne, {dogName} nie przybiega niezawodnie. W tym tygodniu ładujesz DO MNIE (lub nowe słowo DO MNIE) od nowa absolutnie najlepszymi smakołykami.",
      wochenziele: [
        "{dogName} reaguje w mieszkaniu w mniej niż 2 sek na DO MNIE.",
        "Nagroda jest wysokiej jakości: kurczak lub ser, nie sucha karma.",
        "Skojarzenie DO MNIE = najlepszy moment dnia jest utrwalone.",
      ],
      tagesplan: "W domu, 3 sesje dziennie. Z odległości 3 m: DO MNIE wesołym, spokojnym tonem. {dogName} przybiega → JACKPOT z 5 kawałków kurczaka jeden po drugim. Potem pozwól znów odejść, bez żądań. Bez zapinania smyczy, bez kojarzenia z końcem.",
      no_gos: [
        "Używanie DO MNIE do rzeczy negatywnych (kąpiel, weterynarz, zapinanie smyczy) — zatruwa sygnał.",
        "Sucha karma jako nagroda — zbyt niskiej wartości.",
        "Kojarzenie z końcem spaceru — DO MNIE nigdy nie kończy zabawy.",
      ],
      fortschritt: [
        "{dogName} przybiega w domu błyskawicznie.",
        "Entuzjazm przy usłyszeniu sygnału jest widoczny.",
        "Położyłeś fundament pod fazę 2.",
        "Gwizdek jest pozytywnie skojarzony jako drugi sygnał.",
      ],
      exerciseIds: ["r-hier-laden", "r-pfeife-aufbauen"],
    },
    {
      title: "Przywołanie z przytrzymaniem: gra w przytrzymanie",
      schwerpunkt: "Klasyczna gra z pomocnikiem: ktoś przytrzymuje {dogName}, ty odbiegasz, wołasz DO MNIE. {dogName} sprintuje z wysoką energią. Działa prawie zawsze i mocno zwiększa motywację.",
      wochenziele: [
        "{dogName} sprintuje na DO MNIE do ciebie.",
        "Przybiega z wysoką motywacją.",
        "Dystans zostaje zwiększony do 30-50 m.",
      ],
      tagesplan: "Z pomocnikiem (partnerem): {dogName} jest przytrzymywany, ty odchodzisz 10 m w zasięgu wzroku. Kucasz nisko, wołasz wesoło DO MNIE + pomocnik puszcza. {dogName} sprintuje do ciebie. JACKPOT z 5-7 kawałków kurczaka + wylewna pochwała. Powtórz 4-6 razy na sesję.",
      no_gos: [
        "Ćwiczenie bez pomocnika — brakuje napięcia.",
        "Zbyt szybkie zwiększanie dystansu — przeciąża.",
        "Osłabianie nagrody — motywacja spada.",
      ],
      fortschritt: [
        "{dogName} sprintuje niezawodnie.",
        "Dystans zwiększony do 30-50 m.",
        "Motywacja jest wysoka.",
      ],
      exerciseIds: ["r-restraint-recall", "r-hier-mit-ablenkung"],
    },
    {
      title: "Rozpoczęcie pracy z długą linką",
      schwerpunkt: "Zanim zaryzykujesz swobodny bieg: praca z długą linką. Linka 5-10 m daje {dogName} swobodę ruchu, ty masz kontrolę na wypadek nagłej sytuacji. Most między domem a swobodnym biegiem.",
      wochenziele: [
        "Długa linka dobrze leży i jest użyteczna.",
        "{dogName} jest oswojony z długą linką.",
        "Pierwsze spacery na długiej lince są utrwalone.",
      ],
      tagesplan: "Zainwestuj w długą linkę z biothane 5-10 m. W spokojnych miejscach bez innych psów: {dogName} może węszyć na dystansie 5-10 m. Co 5 min: DO MNIE. Gdy przybiega: jackpot. Gdy nie przybiega: spokojnie zbierz linkę, bez dramatu.",
      no_gos: [
        "Długa linka jako lina — parzy ręce, ryzyko urazu.",
        "W miejscach o dużym natężeniu ruchu — ryzyko zaplątania.",
        "Używanie długiej linki jako kary — zatruwa narzędzie.",
      ],
      fortschritt: [
        "Spacery na długiej lince są zgrane.",
        "{dogName} czuje się swobodnie, ale bezpiecznie.",
        "Masz most bezpieczeństwa.",
      ],
      exerciseIds: ["r-schleppleine", "r-hier-laden"],
    },
    {
      title: "Gwizdek jako sygnał zapasowy",
      schwerpunkt: "Gwizdek niesie się na 200 m+, brzmi zawsze tak samo, nie da się go „zatruć”. W tym tygodniu warunkujesz go jako drugi sygnał przywołania — zapas na nagłą sytuację.",
      wochenziele: [
        "{dogName} reaguje na dźwięk gwizdka niezawodnie.",
        "Skojarzenie gwizdek = jackpot jest utrwalone.",
        "Masz głośny sygnał zapasowy.",
      ],
      tagesplan: "Kup gwizdek ACME 211.5. W domu: gwizdnij wyraźny podwójny ton, daj jackpot. 5-7 powtórzeń na sesję, 2 sesje dziennie. {dogName} kojarzy gwizdek z nagrodą. Nigdy nie używaj do rzeczy negatywnych.",
      no_gos: [
        "Nadużywanie gwizdka — traci magię.",
        "Gwizdek do rzeczy negatywnych — zatruwa jak przy DO MNIE.",
        "Eksperymentowanie z różnymi tonami gwizdka — konsekwencja jest wszystkim.",
      ],
      fortschritt: [
        "{dogName} reaguje na gwizdek w 2-3 sek.",
        "Masz zapas na problemy z głosem.",
        "Gwizdek staje się gwarancją.",
      ],
      exerciseIds: ["r-pfeife-aufbauen", "r-restraint-recall"],
    },
    // Pogłębienia 6-miesięczne
    {
      title: "Bezpieczeństwo i rutyna długiej linki",
      schwerpunkt: "Praca z długą linką staje się codzienną rutyną. {dogName} porusza się swobodnie, ale pod kontrolą. Ćwiczysz DO MNIE w różnych miejscach.",
      wochenziele: [
        "Codzienne spacery na długiej lince to standard.",
        "{dogName} przybiega niezawodnie na przywołanie.",
        "Objąłeś różne miejsca.",
      ],
      tagesplan: "Na każdym spacerze długa linka. Wypróbuj różne miejsca: łąka, las, brzeg parku. DO MNIE co 5-10 min, jackpot przy sukcesie. Przy braku sukcesu: spokojnie zbliż na lince, przy pojawieniu się mimo to 2 smakołyki.",
      no_gos: [
        "W miejscach wysokiego ryzyka (blisko drogi) — ryzyko urazu.",
        "Trzymanie długiej linki zbyt napiętej — {dogName} nie czuje się swobodnie.",
        "Ruszanie bez wystarczającej ilości nagród.",
      ],
      fortschritt: [
        "Rutyna jest zgrana.",
        "{dogName} reaguje niezawodnie.",
        "Zbierasz doświadczenie z długą linką.",
      ],
      exerciseIds: ["r-schleppleine", "r-hier-laden"],
    },
    {
      title: "DO MNIE przy minimalnym rozproszeniu",
      schwerpunkt: "Pierwsze lekkie rozproszenia podczas przywołania: ptak w tle, inny pies w odległości 30 m. {dogName} uczy się: DO MNIE działa też z bodźcami.",
      wochenziele: [
        "{dogName} przybiega przy lekkim rozproszeniu.",
        "Skuteczność wynosi 70-80%.",
        "Przy braku przybiegnięcia: spokojnie zbliż na lince, bez dramatu.",
      ],
      tagesplan: "Z długą linką w miejscach z lekkim rozproszeniem. Wołaj DO MNIE, gdy {dogName} węszy lub obserwuje bodziec. Sukces: SUPER-jackpot. Brak sukcesu: linka delikatnie do siebie, przy pojawieniu się 3 smakołyki.",
      no_gos: [
        "Zwiększanie presji, gdy skuteczność spada — zredukuj rozproszenie.",
        "Rozproszenie zbyt duże jak na fazę 1 — respektuj próg.",
        "Wielokrotne wołanie DO MNIE — raz to raz.",
      ],
      fortschritt: [
        "Skuteczność rośnie przy rozproszeniu.",
        "{dogName} rozumie: DO MNIE zawsze się opłaca.",
        "Jesteś gotowy do fazy 2.",
      ],
      exerciseIds: ["r-hier-mit-ablenkung", "r-pfeife-aufbauen"],
    },
    {
      title: "Kiedy NIE używać DO MNIE",
      schwerpunkt: "W tym tygodniu rozumiesz, kiedy NIE używać DO MNIE: gdy nie jesteś pewien, czy {dogName} przybiegnie. Każde nieprzybiegnięcie osłabia sygnał. Lepiej w ogóle nie wołać niż wołać bez skutku.",
      wochenziele: [
        "Rozpoznajesz, kiedy DO MNIE jest bezsensowne.",
        "Używasz go tylko przy prawdopodobieństwie sukcesu 80%+.",
        "Przy niższym prawdopodobieństwie: delikatnie zbierz długą linkę.",
      ],
      tagesplan: "Świadoma obserwacja: w jakich sytuacjach {dogName} przybiega w 100%, 80%, 50%, 20%? Notuj. Używaj DO MNIE tylko przy prawdopodobieństwie 80%+. Przy niskim prawdopodobieństwie: w ogóle nie wołaj, zbierz długą linkę.",
      no_gos: [
        "Wołanie DO MNIE, gdy {dogName} goni — zatrucie sygnału.",
        "Wielokrotne wołanie — osłabia za każdym razem.",
        "Złoszczenie się przy nieprzybiegnięciu — zatruwa skojarzenie.",
      ],
      fortschritt: [
        "Używasz DO MNIE strategicznie.",
        "Skuteczność pozostaje wysoka.",
        "Rozumiesz pedagogikę przywołania.",
      ],
      exerciseIds: ["r-hier-laden", "r-restraint-recall"],
    },
    {
      title: "Sprawdzenie fundamentu",
      schwerpunkt: "Ostatni tydzień fundamentu. DO MNIE w domu siedzi? Przywołanie z przytrzymaniem działa? Długa linka jest rutyną? Gwizdek zwarunkowany? Te elementy są niezbędne.",
      wochenziele: [
        "Wszystkie 4 elementy są utrwalone.",
        "{dogName} zna system.",
        "Czujesz się przygotowany do fazy nasilenia.",
      ],
      tagesplan: "Bilans: co siedzi na 90%+, co się chwieje? Jeśli słabość: dołóż 1 dodatkowy tydzień. Faza 2 = na zewnątrz przy rozproszeniu, fundament musi stać.",
      no_gos: [
        "Przeskakiwanie do fazy 2 z niecierpliwości.",
        "Naprawianie kilku słabości jednocześnie.",
        "Poddawanie się, bo fundament trwa dłużej.",
      ],
      fortschritt: [
        "Czujesz się kompetentny.",
        "Narzędzia siedzą.",
        "Faza 2 jest w zasięgu ręki.",
      ],
      exerciseIds: ["r-schleppleine", "r-pfeife-aufbauen"],
    },
  ],
  steigerung: [
    {
      title: "DO MNIE przy umiarkowanym rozproszeniu",
      schwerpunkt: "Na zewnątrz z długą linką, umiarkowane rozproszenia: inne psy w odległości 30 m, biegacze, zapach dzikiej zwierzyny. {dogName} uczy się: DO MNIE opłaca się bardziej niż jakiekolwiek rozproszenie — jeśli nagroda jest odpowiednia.",
      wochenziele: [
        "Skuteczność przy umiarkowanym rozproszeniu: 80%+.",
        "Nagroda jest konsekwentnie SUPER (kurczak, ser).",
        "{dogName} aktywnie szuka momentu przywołania.",
      ],
      tagesplan: "W miejscach z umiarkowanym rozproszeniem (brzeg parku, trasa biegowa). Długa linka 10 m. DO MNIE 4-6 razy na spacer. Przy sukcesie: SUPER-jackpot z 5-7 smakołyków. Przy nieprzybiegnięciu: spokojnie zbierz długą linkę, przy przybyciu mimo to 2 smakołyki.",
      no_gos: [
        "Skąpienie nagrody — najlepsze wyniki kosztują.",
        "Zbyt wysokie oczekiwania — 80% to dobry wynik w fazie 2.",
        "Wielokrotne wołanie, gdy nie przybiega — raz to raz.",
      ],
      fortschritt: [
        "Skuteczność się stabilizuje.",
        "{dogName} reaguje przewidywalnie.",
        "Czujesz się przygotowany.",
      ],
      exerciseIds: ["r-hier-mit-ablenkung", "r-schleppleine"],
    },
    {
      title: "Gwizdek w prawdziwych sytuacjach",
      schwerpunkt: "Gwizdek zostaje użyty na zewnątrz w prawdziwych sytuacjach przywołania. Pozostaje sygnałem zapasowym, ale teraz z prawdziwymi bodźcami. Warunkowanie musi pozostać stabilne.",
      wochenziele: [
        "{dogName} reaguje na sygnał gwizdka na zewnątrz niezawodnie.",
        "Skuteczność przy gwizdku: 90%+ (wyższa niż przy głosie).",
        "Gwizdek staje się sygnałem gwarancji.",
      ],
      tagesplan: "Na każdym spacerze 2-3 przywołania na gwizdek. Przy sukcesie: MEGA-jackpot. Przy braku sukcesu: zbierz długą linkę, bez dramatu. Używaj gwizdka strategicznie: przy dużym dystansie lub nadmiarze bodźców.",
      no_gos: [
        "Nadużywanie gwizdka — traci magię.",
        "Gwizdek w sytuacjach bez dystansu — jeśli działa bez gwizdka, pomiń go.",
        "Gwizdek przy frustracji głosem — eskaluje.",
      ],
      fortschritt: [
        "Gwizdek jest niezawodnym zapasem.",
        "Używasz gwizdka strategicznie, nie nadmiernie.",
        "{dogName} reaguje przewidywalnie.",
      ],
      exerciseIds: ["r-pfeife-aufbauen", "r-hier-laden"],
    },
    {
      title: "Utrwalenie rutyny długiej linki",
      schwerpunkt: "Praca z długą linką staje się rutyną. {dogName} porusza się swobodnie w promieniu 10 m. Pewnie rozpoznajesz punkty nadmiaru bodźców.",
      wochenziele: [
        "Codzienne spacery na długiej lince przebiegają płynnie.",
        "{dogName} reaguje na DO MNIE z długą linką w 90%.",
        "Rozpoznajesz oznaki nadmiaru bodźców.",
      ],
      tagesplan: "Na każdym spacerze długa linka. Różne trasy. Przy nadmiarze bodźców (kilka psów, zapach dzikiej zwierzyny): trzymaj dystans, delikatnie zbierz długą linkę, skróć spacer.",
      no_gos: [
        "Spacery na długiej lince w miejscach wysokiego ryzyka.",
        "Trzymanie długiej linki napiętej — swoboda ruchu jest sensem.",
        "Zapominanie długiej linki — brakuje zabezpieczenia.",
      ],
      fortschritt: [
        "Rutyna długiej linki to standard.",
        "Nadmiar bodźców jest pewnie rozpoznawany.",
        "Spacery są kontrolowane.",
      ],
      exerciseIds: ["r-schleppleine", "r-hier-mit-ablenkung"],
    },
    {
      title: "Warunkowanie przywołania awaryjnego",
      schwerpunkt: "W tym tygodniu utrwalasz przywołanie awaryjne: jedno słowo lub gwizd, którego używasz TYLKO w prawdziwych nagłych sytuacjach. Nagroda: ekstremalna (polędwica wołowa, kawałki piersi z kurczaka).",
      wochenziele: [
        "{dogName} reaguje na sygnał awaryjny niezawodnie.",
        "Nagroda jest MEGA: prawdziwa polędwica wołowa lub filet z kurczaka.",
        "Masz zapas awaryjny na prawdziwe kryzysy.",
      ],
      tagesplan: "Wybierz słowo/ton gwizdu, którego poza tym NIGDY nie używasz (np. STOP-DO MNIE). Warunkuj w domu 2 razy dziennie z MEGA-nagrodą. Przenieś w fazie 3 do prawdziwych nagłych sytuacji.",
      no_gos: [
        "Używanie przywołania awaryjnego do normalnych przywołań — traci magię.",
        "Skąpienie nagrody — przy MEGA-nagrodzie MEGA-reakcja.",
        "Wielokrotne wołanie w nagłej sytuacji — liczy się pierwsza reakcja.",
      ],
      fortschritt: [
        "Sygnał awaryjny jest zwarunkowany.",
        "Masz zaufanie do zapasu.",
        "W razie potrzeby masz rozwiązanie.",
      ],
      exerciseIds: ["r-emergency-recall", "r-pfeife-aufbauen"],
    },
    // Pogłębienia 6-miesięczne
    {
      title: "Przywołanie przy silniejszym rozproszeniu",
      schwerpunkt: "Silniejsze rozproszenia: inne psy bliżej, intensywne zapachy, płynąca woda. Skuteczność powinna pozostać na poziomie 70%+. Jeśli niższa: cofnij się, zredukuj rozproszenie.",
      wochenziele: [
        "{dogName} reaguje przy silnym rozproszeniu w 70-80%.",
        "Rozpoznajesz, kiedy rozproszenie jest zbyt duże.",
        "Częstotliwość nagradzania pozostaje wysoka.",
      ],
      tagesplan: "Świadomie szukaj miejsc z silniejszym rozproszeniem. Długa linka. DO MNIE przy bodźcach. Obserwuj skuteczność. Przy poniżej 70%: zredukuj rozproszenie, nie zwiększaj presji.",
      no_gos: [
        "Zwiększanie presji — przeciwskuteczne.",
        "Redukowanie częstotliwości nagradzania przy spadającej skuteczności.",
        "Praca z frustracją — udziela się.",
      ],
      fortschritt: [
        "Skuteczność się stabilizuje.",
        "{dogName} skupia się także przy rozproszeniu.",
        "Pracujesz cierpliwie.",
      ],
      exerciseIds: ["r-hier-mit-ablenkung", "r-schleppleine"],
    },
    {
      title: "Przywołanie z przytrzymaniem na zewnątrz z pomocnikiem",
      schwerpunkt: "Klasyczne przywołanie z przytrzymaniem teraz na zewnątrz z pomocnikiem. Ogromna motywacja, sprint do ciebie. Działa nawet, gdy inne metody zawodzą.",
      wochenziele: [
        "{dogName} sprintuje na zewnątrz przy przywołaniu z przytrzymaniem.",
        "Układ z pomocnikiem jest zgrany.",
        "Motywacja na zewnątrz jest tak samo wysoka jak w domu.",
      ],
      tagesplan: "2-3 razy w tygodniu sesje z przytrzymaniem na zewnątrz. Pomocnik przytrzymuje, ty odbiegasz 20-30 m, DO MNIE. Sprint + JACKPOT. Wariacja: pomocnik się zmienia, ty się zmieniasz, ta sama zabawa.",
      no_gos: [
        "Ćwiczenie bez pomocnika — brakuje napięcia.",
        "Zbyt szybkie ekstremalne dystanse — przeciąża.",
        "W miejscach wysokiego ryzyka — ryzyko bezpieczeństwa.",
      ],
      fortschritt: [
        "{dogName} sprintuje niezawodnie na zewnątrz.",
        "Motywacja jest wysoka.",
        "Masz narzędzie do zabawy.",
      ],
      exerciseIds: ["r-restraint-recall", "r-hier-laden"],
    },
    {
      title: "Rozszerzenie wariantów przywołania",
      schwerpunkt: "Dotychczas miałeś 1-2 słowa przywołania. W tym tygodniu utrwalasz warianty: NORMALNE przywołanie (codzienne, lekka nagroda), JACKPOT-przywołanie (średnio trudne, duża nagroda), AWARYJNE (ekstremalne, MEGA-nagroda).",
      wochenziele: [
        "Masz jasno 3 różne poziomy przywołania.",
        "{dogName} rozumie różne sygnały.",
        "Stosujesz poziomy zależnie od sytuacji.",
      ],
      tagesplan: "Ćwiczenia na sucho na każdy poziom: CODZIENNE przywołanie z normalną nagrodą, JACKPOT-przywołanie z dużą nagrodą, AWARYJNE z MEGA-nagrodą. Na każdym spacerze kilka z każdego poziomu.",
      no_gos: [
        "Mieszanie poziomów — rozmywa skojarzenia.",
        "Regularne używanie przywołania awaryjnego — traci magię.",
        "Mylenie poziomu nagrody.",
      ],
      fortschritt: [
        "Poziomy są jasno utrwalone.",
        "{dogName} reaguje różnie zależnie od sytuacji.",
        "Masz stopniowany system przywołania.",
      ],
      exerciseIds: ["r-schleppleine", "r-emergency-recall"],
    },
    {
      title: "Utrwalenie nasilenia",
      schwerpunkt: "Ostatni tydzień nasilenia. Wszystkie narzędzia przywołania siedzą, długa linka to rutyna, sygnał awaryjny zwarunkowany. Faza 3 = pierwszy swobodny bieg, kontrolowany.",
      wochenziele: [
        "Wszystkie narzędzia siedzą na 80%+.",
        "Jesteś przygotowany na pierwszy swobodny bieg.",
        "Zabezpieczenia są utrwalone.",
      ],
      tagesplan: "Tydzień bilansu: co działa na 80%+? Długa linka? Gwizdek? Przytrzymanie? Awaryjne? Jeśli słabość: dołóż 1 dodatkowy tydzień. Faza 3 = bardziej ryzykowna, fundament musi stać.",
      no_gos: [
        "Przeskakiwanie do swobodnego biegu z niecierpliwości.",
        "Ignorowanie kilku słabości.",
        "Postrzeganie zabezpieczeń jako „zbędnych”.",
      ],
      fortschritt: [
        "Czujesz się dobrze przygotowany.",
        "{dogName} zna system.",
        "Narzędzia siedzą.",
      ],
      exerciseIds: ["r-hier-mit-ablenkung", "r-pfeife-aufbauen"],
    },
  ],
  generalisierung: [
    {
      title: "Pierwszy kontrolowany swobodny bieg",
      schwerpunkt: "Faza 3 zaczyna się od pierwszego prawdziwego swobodnego biegu — ale kontrolowanego. Bezpieczna strefa (ogrodzona lub topograficznie bezpieczna), długa linka odpięta, ale pozostaje na szelkach.",
      wochenziele: [
        "Pierwszy swobodny bieg udany (10-15 min).",
        "{dogName} reaguje na DO MNIE podczas swobodnego biegu.",
        "Utrwaliłeś układ bezpieczeństwa.",
      ],
      tagesplan: "Wybierz najbezpieczniejszą strefę (ogrodzone wybiegisko, leśna polana daleko od drogi). Długa linka pozostaje na szelkach, ale 5-10 m luzu jest dozwolone. DO MNIE co 5 min. Przy niezawodnym przywołaniu: kontynuuj.",
      no_gos: [
        "Swobodny bieg w miejscach wysokiego ryzyka — ryzyko eskalacji.",
        "Całkowite odpięcie długiej linki — utrata bezpieczeństwa.",
        "Swobodny bieg dłuższy niż 15-20 min — grozi nadmiarem bodźców.",
      ],
      fortschritt: [
        "Pierwszy swobodny bieg jest udany.",
        "{dogName} pozostaje w zasięgu.",
        "Czujesz się (ostrożnie) pewniej.",
        "Sygnał awaryjny jest zwarunkowany i gotowy na prawdziwe kryzysy.",
      ],
      exerciseIds: ["r-freilauf-erste", "r-emergency-recall"],
    },
    {
      title: "Utrwalenie rutyny swobodnego biegu",
      schwerpunkt: "Swobodny bieg staje się rutyną — na 2-3 bezpiecznych trasach. Długa linka staje się zabezpieczeniem, ale pozostaje przy tym. {dogName} uczy się bezpieczeństwa swobodnego biegu.",
      wochenziele: [
        "2-3 bezpieczne trasy swobodnego biegu są utrwalone.",
        "Spacery ze swobodnym biegiem przebiegają rutynowo.",
        "{dogName} przybiega na DO MNIE w 85%+.",
      ],
      tagesplan: "Na tydzień 3-4 spacery ze swobodnym biegiem na bezpiecznych trasach. Długa linka pozostaje na szelkach. DO MNIE regularnie. Przy nieprzybiegnięciu: zbierz długą linkę, później znów poluzuj.",
      no_gos: [
        "Swobodny bieg na nieznanych trasach — zbyt ryzykowne.",
        "Zapominanie długiej linki — zabezpieczenie.",
        "Swobodny bieg, gdy {dogName} jest spięty lub rozproszony.",
      ],
      fortschritt: [
        "Rutyna swobodnego biegu jest zgrana.",
        "{dogName} reaguje niezawodnie.",
        "Spacery są satysfakcjonujące.",
      ],
      exerciseIds: ["r-schleppleine", "r-hier-laden"],
    },
    {
      title: "Trening podtrzymujący podczas swobodnego biegu",
      schwerpunkt: "Nawet gdy swobodny bieg działa: DO MNIE pozostaje aktywnie ćwiczone. Inaczej sygnał rdzewieje. 2-3 razy na spacer DO MNIE z jackpotem. {dogName} pozostaje zmotywowany.",
      wochenziele: [
        "DO MNIE jest aktywnie podtrzymywane podczas swobodnego biegu.",
        "Gęstość nagradzania pozostaje akceptowalna.",
        "{dogName} nie traci motywacji do przywołania.",
      ],
      tagesplan: "Na każdym spacerze 3-4 momenty DO MNIE, każdy z jackpotem. Wariacja: przywołanie z przytrzymaniem z pomocnikiem raz w tygodniu. Gwizdek co 2 tygodnie z MEGA-nagrodą.",
      no_gos: [
        "Zaniedbywanie DO MNIE — sygnał blaknie.",
        "Skąpienie nagrody — motywacja spada.",
        "Nadużywanie gwizdka.",
      ],
      fortschritt: [
        "DO MNIE pozostaje niezawodne.",
        "{dogName} pozostaje zmotywowany.",
        "Aktywnie podtrzymujesz system.",
      ],
      exerciseIds: ["r-hier-mit-ablenkung", "r-restraint-recall"],
    },
    {
      title: "Ostrożna redukcja nagród",
      schwerpunkt: "Gdy przywołanie pewnie siedzi, powoli redukujesz gęstość nagradzania przy zwykłych przywołaniach. Ale: w cennych sytuacjach (prawdziwe nagłe przypadki) nadal JACKPOT.",
      wochenziele: [
        "Częstotliwość nagradzania zostaje zredukowana do ~50-60%.",
        "Najlepsze wyniki nadal nagradzane jackpotem.",
        "{dogName} reaguje także przy mniejszej ilości nagród.",
      ],
      tagesplan: "W prostych sytuacjach przywołania: nie za każdym razem kurczak. W trudnych (silne rozproszenie, duży dystans): jackpot. {dogName} zauważa różnicę, ale szuka momentu przywołania.",
      no_gos: [
        "Całkowite skreślenie nagrody — grozi nawrót.",
        "Redukcja na trudnych trasach — zbyt wcześnie.",
        "Zamieszanie w poziomie nagrody.",
      ],
      fortschritt: [
        "{dogName} reaguje także przy mniejszej ilości nagród.",
        "Przywołanie jest ustabilizowane.",
        "Rzadziej sięgasz do kieszeni.",
      ],
      exerciseIds: ["r-hier-laden", "r-schleppleine"],
    },
    {
      title: "Opanowanie trudnych sytuacji",
      schwerpunkt: "W tym tygodniu świadomie planujesz trudne sytuacje: inne psy blisko, intensywne zapachy, zmieniające się trasy. {dogName} się sprawdza lub korygujesz.",
      wochenziele: [
        "{dogName} radzi sobie z 3 trudnymi sytuacjami.",
        "Rozpoznajesz, gdzie długa linka znów jest potrzebna.",
        "Skuteczność pozostaje na poziomie 70%+.",
      ],
      tagesplan: "Świadomie planuj spotkania z innymi psami, zapach dzikiej zwierzyny, zmieniające się trasy. DO MNIE przy bodźcach. Przy sukcesie: SUPER-jackpot. Przy braku sukcesu: długa linka z powrotem, później spróbuj ponownie.",
      no_gos: [
        "Kilka trudnych sytuacji tego samego dnia — kumuluje się.",
        "Kontynuowanie przy spadającej skuteczności — pauza.",
        "Zbyt wysokie oczekiwania — 70% to dobry wynik w fazie 3.",
      ],
      fortschritt: [
        "{dogName} radzi sobie z trudnymi sytuacjami.",
        "Pewnie rozpoznajesz granice.",
        "Przywołanie jest odporne.",
      ],
      exerciseIds: ["r-hier-mit-ablenkung", "r-pfeife-aufbauen"],
    },
    {
      title: "Przywołanie awaryjne w praktyce",
      schwerpunkt: "W tym tygodniu testujesz przywołanie awaryjne w 1-2 prawdziwych sytuacjach ryzyka (np. {dogName} biegnie w złym kierunku). MEGA-nagroda musi nadejść.",
      wochenziele: [
        "Przywołanie awaryjne zostaje użyte z sukcesem w 1-2 prawdziwych sytuacjach.",
        "MEGA-nagroda jest dawana konsekwentnie.",
        "Czujesz się przygotowany na prawdziwe nagłe sytuacje.",
      ],
      tagesplan: "W kontrolowanych „quasi-nagłych sytuacjach” (np. {dogName} węszy coś interesującego, ty wołasz sygnał awaryjny): NATYCHMIAST MEGA-nagroda przy pojawieniu się. Nigdy „na próbę” ani bez nagrody — inaczej zatruwa magię.",
      no_gos: [
        "Testowanie przywołania awaryjnego bez MEGA-nagrody — zatruwa skojarzenie.",
        "Regularne używanie sygnału awaryjnego — traci moc.",
        "Wpadanie w panikę w prawdziwej nagłej sytuacji — trzymaj się rutyny.",
      ],
      fortschritt: [
        "Przywołanie awaryjne jest przetestowane i działa.",
        "Masz zaufanie do zapasu.",
        "Prawdziwe nagłe sytuacje są do opanowania.",
      ],
      exerciseIds: ["r-emergency-recall", "r-restraint-recall"],
    },
    {
      title: "Spacery z przywołaniem bez długiej linki",
      schwerpunkt: "Gdy przywołanie pewnie siedzi (90%+ sukcesu na znanych trasach), możesz pominąć długą linkę w określonych warunkach. Ale: TYLKO na bezpiecznych trasach, TYLKO przy dobrej koncentracji.",
      wochenziele: [
        "Zidentyfikowałeś trasy, gdzie brak długiej linki jest bezpieczny.",
        "{dogName} reaguje tam w 95%+.",
        "Bezpieczeństwo pozostaje najwyższą zasadą.",
      ],
      tagesplan: "Oceń szczerze każdą trasę: przywołanie pewne na 95%? Bodźce wysokiego ryzyka mało prawdopodobne? Jeśli tak: przetestuj bez długiej linki. W każdej sytuacji w zasięgu wzroku: DO MNIE + jackpot. Przy wątpliwości: długa linka z powrotem.",
      no_gos: [
        "Bez długiej linki na nieznanych trasach.",
        "Bez długiej linki, gdy inne psy blisko.",
        "Bez długiej linki, gdy {dogName} jest nadpobudliwy.",
      ],
      fortschritt: [
        "Używasz długiej linki strategicznie.",
        "{dogName} reaguje niezawodnie.",
        "Spacery są swobodniejsze i bardziej satysfakcjonujące.",
      ],
      exerciseIds: ["r-freilauf-erste", "r-hier-laden"],
    },
    {
      title: "Przejście w tryb podtrzymania",
      schwerpunkt: "Ostatni tydzień. Przywołanie jest niezawodne, długa linka używana celowo, zapas awaryjny stoi. {dogName} jest wyraźnie bardziej niezawodnym psem niż na początku planu.",
      wochenziele: [
        "Wszystkie narzędzia przywołania działają rutynowo.",
        "Plan podtrzymania stoi.",
        "Czujesz się przygotowany długoterminowo.",
      ],
      tagesplan: "Zaplanuj tryb podtrzymania: co 2 tygodnie jedno przywołanie z przytrzymaniem z MEGA-nagrodą. Co 4 tygodnie jeden test przywołania awaryjnego (w kontrolowanym układzie). Gwizdek co 2 tygodnie z MEGA-nagrodą. Rutyna pozostaje.",
      no_gos: [
        "Nagłe porzucenie wszystkich rutyn — przywołanie blaknie.",
        "Zapominanie gwizdka lub przywołania awaryjnego — narzędzia wymagają podtrzymania.",
        "Zapominanie długiej linki — zabezpieczenie na nagłą sytuację.",
      ],
      fortschritt: [
        "Przywołanie jest długoterminowo niezawodne.",
        "Czujesz się kompetentny.",
        "{dogName} jest bezpieczniejszy podczas swobodnego biegu.",
      ],
      exerciseIds: ["r-restraint-recall", "r-emergency-recall"],
    },
  ],
};

// ────────────────────────────────────────────────────────────────────
// BARKING (nadmierne szczekanie) — oddzielenie wyzwalaczy + nagradzanie spokoju
// ────────────────────────────────────────────────────────────────────
const BARKING_WEEKS: Record<Phase, WeekTemplate[]> = {
  fundament: [
    {
      title: "Dziennik wyzwalaczy: co wywołuje szczekanie?",
      schwerpunkt: "Zanim zaczniesz trening, potrzebujesz danych. Przez tydzień dokumentujesz KIEDY, GDZIE i NA CO {dogName} szczeka. Dopiero wtedy rozpoznasz wzorce i będziesz mógł pracować celowo.",
      wochenziele: [
        "Masz listę top 3 wyzwalaczy szczekania.",
        "Znasz typowe pory szczekania w ciągu dnia.",
        "Rozumiesz własną reakcję i to, czy ją wzmacnia.",
      ],
      tagesplan: "Miej przy sobie notes. Przy każdym incydencie szczekania: godzina, miejsce, wyzwalacz, czas trwania + twoja reakcja. Pod koniec tygodnia zobaczysz wzorce: dzwonek? Pies przechodzi? Frustracja? Uwaga? Na każdy wyzwalacz własna strategia od tygodnia 2.",
      no_gos: [
        "Trenowanie bez wiedzy CO zamierzasz zaadresować.",
        "Zrzędzenie podczas dokumentowania — psuje dane.",
        "Bagatelizowanie wyzwalaczy („taki już jest”) — bez analizy nie ma rozwiązania.",
      ],
      fortschritt: [
        "Masz jasną listę wyzwalaczy.",
        "Rozpoznajesz własną rolę w zachowaniu.",
        "Jesteś gotowy na celowy trening.",
        "Pierwsze fazy ciszy są nagradzane 8-10 razy dziennie, milczenie zostaje wzmocnione.",
      ],
      exerciseIds: ["b-trigger-tagebuch", "b-ruhe-marker"],
    },
    {
      title: "Utrwalenie markera CICHO",
      schwerpunkt: "Zamiast karać szczekanie, nagradzasz milczenie. Każda faza ciszy dostaje cichy marker DOBRZE i smakołyk. {dogName} uczy się: milczenie się opłaca.",
      wochenziele: [
        "8-10 nagród za ciszę dziennie.",
        "{dogName} zauważa: bycie cicho coś daje.",
        "Ty sam nie reagujesz już na szczekanie głośnością.",
      ],
      tagesplan: "Obserwuj aktywnie. Gdy tylko 5 sek ciszy: cicho DOBRZE + smakołyk. Najpierw 5 sek, potem 10, 20, 30, 1 min. Nagroda przychodzi CICHO i SPOKOJNIE. Przy samym szczekaniu: nie krzycz, nie patrz, zachowaj neutralność.",
      no_gos: [
        "Głośne „Puść!” albo „Cicho!” — uwaga za szczekanie.",
        "Podchodzenie, gdy {dogName} szczeka — wzmacnia to.",
        "Dawanie nagrody z podekscytowaniem — chcemy skojarzyć spokój.",
      ],
      fortschritt: [
        "Nagrody za ciszę stają się rutyną.",
        "{dogName} aktywnie szuka faz ciszy.",
        "Częstotliwość szczekania wyraźnie się zmniejsza.",
      ],
      exerciseIds: ["b-tuerklingel-decke", "b-tuerklingel-decke"],
    },
    {
      title: "Dzwonek do drzwi = rutyna dzwonek-koc",
      schwerpunkt: "Jeśli szczekanie na dzwonek jest tematem, utrwalamy konkretną alternatywę: przy dzwonku {dogName} nie biegnie do drzwi, tylko na koc. Klasyka Pawłowa.",
      wochenziele: [
        "{dogName} reaguje na nagranie dzwonka ruchem w stronę koca.",
        "Głośność dzwonka można zwiększać bez eskalacji.",
        "Skojarzenie dzwonek-koc siedzi.",
      ],
      tagesplan: "Nagranie dzwonka cicho z telefonu, natychmiast WARUJ + koc + smakołyk. 10 powtórzeń na sesję, 2 sesje dziennie. Zwiększaj głośność przez tydzień. Prawdziwe testy dzwonka w fazie 2 z pomocnikiem.",
      no_gos: [
        "Prawdziwe testy dzwonka bez przygotowania — zbyt trudne.",
        "Koc bez wcześniejszego ćwiczenia koca relaksacyjnego — koc musi być pozytywnie skojarzony.",
        "Przy szczekaniu: krzyczenie — przeciwskuteczne.",
      ],
      fortschritt: [
        "{dogName} łączy dzwonek z kocem + nagrodą.",
        "Ruch w stronę koca staje się automatyczny.",
        "Jesteś gotowy na prawdziwą sytuację z dzwonkiem.",
      ],
      exerciseIds: ["b-trigger-tagebuch", "b-ruhe-marker"],
    },
    {
      title: "Budowanie tolerancji na frustrację",
      schwerpunkt: "Jeśli {dogName} szczeka z frustracji (wiewiórka, coś nieosiągalnego): budujemy tolerancję na frustrację. Sygnał CZEKAJ przy jedzeniu i zabawce jest narzędziem.",
      wochenziele: [
        "{dogName} utrzymuje 10 sek CZEKAJ przed jedzeniem.",
        "Oznaki frustracji stają się rzadsze.",
        "Używasz CZEKAJ w codziennych mini-sytuacjach frustracji.",
      ],
      tagesplan: "3-4 sytuacje CZEKAJ dziennie: przed jedzeniem, zabawką, drzwiami. Zwiększaj od 1 sek do 10 sek przez tydzień. Przy szczekaniu podczas CZEKAJ: cofnij rękę, nie zwalniaj. Dopiero przy 3 sek ciszy: zwolnienie.",
      no_gos: [
        "Zwalnianie przy szczekaniu — wzmacnia szczekanie z frustracji.",
        "Zbyt szybkie wydłużanie czasu czekania — frustracja eskaluje.",
        "Podnoszenie głosu — wzmacnia podekscytowanie.",
      ],
      fortschritt: [
        "{dogName} pozostaje spokojny przy krótkich okresach czekania.",
        "Szczekanie z frustracji się zmniejsza.",
        "Masz narzędzie na mini-sytuacje frustracji.",
      ],
      exerciseIds: ["b-frust-management", "b-tuerklingel-decke"],
    },
    // Pogłębienia 6-miesięczne
    {
      title: "Przeciwwarunkowanie przy bodźcach zewnętrznych",
      schwerpunkt: "Jeśli bodźce zewnętrzne (pies przechodzi, listonosz) są wyzwalaczami szczekania: przeciwwarunkowanie. Pojawia się bodziec = przychodzi smakołyk. Odwraca skojarzenie emocjonalne.",
      wochenziele: [
        "{dogName} patrzy na ciebie przy bodźcach zewnętrznych.",
        "Reakcja szczekania na bodźce się zmniejsza.",
        "Skojarzenie emocjonalne się zmienia.",
      ],
      tagesplan: "Na typowej pozycji szczekania (okno, ogród). Gdy tylko pojawia się bodziec PRZED szczekaniem: PATRZ + smakołyk nieprzerwanie, dopóki bodziec widoczny. Bodziec znika: smakołyk znika. Jeśli {dogName} już szczeka: za późno, zwiększ dystans.",
      no_gos: [
        "Nagradzanie dopiero, gdy {dogName} już szczeka — błędne skojarzenie.",
        "Prowokowanie bodźców — przeciwskuteczne.",
        "Skąpienie nagrody — najlepsze wyniki kosztują.",
      ],
      fortschritt: [
        "{dogName} reaguje uwagą skierowaną na ciebie przy bodźcach.",
        "Szczekanie wyraźnie się zmniejsza.",
        "Skojarzenie emocjonalne staje się pozytywne.",
      ],
      exerciseIds: ["b-counter-cond-aussen", "b-ruhe-marker"],
    },
    {
      title: "Wygaszanie szczekania o uwagę",
      schwerpunkt: "Jeśli {dogName} szczeka na ciebie, żeby coś dostać: konsekwentne ignorowanie. Wygaszanie przez 2-3 tygodnie. Wymaga żelaznej konsekwencji od wszystkich domowników.",
      wochenziele: [
        "Przy szczekaniu o uwagę konsekwentnie odwracasz się plecami.",
        "Domownicy trzymają się zasad.",
        "Szczekanie o uwagę zmniejsza się po szczycie nasilenia.",
      ],
      tagesplan: "Przy szczekaniu o uwagę natychmiast odwróć się plecami, wyjdź z pokoju, jeśli to możliwe. Wróć, gdy 30 sek spokoju. Spodziewaj się szczytu nasilenia w dniu 3-7: szczekanie najpierw się nasili, potem zniknie. Wytrzymaj.",
      no_gos: [
        "Ustępowanie podczas szczytu nasilenia — całkowicie sabotuje pracę.",
        "Domownicy, którzy się nie stosują — 1 niekonsekwencja = 1 tydzień wstecz.",
        "Zrzędzenie przy szczekaniu — to też uwaga.",
      ],
      fortschritt: [
        "Szczekanie o uwagę zmniejsza się wymiernie.",
        "{dogName} szuka innych dróg do uwagi (przychodzi cicho).",
        "Wewnętrznie stajesz się spokojniejszy.",
      ],
      exerciseIds: ["b-aufmerksamkeits-bellen", "b-trigger-tagebuch"],
    },
    {
      title: "Stopniowe zmniejszanie dystansu do wyzwalacza",
      schwerpunkt: "Przy szczekaniu wywołanym bodźcem powoli zmniejszasz dystans do wyzwalacza. 50 m → 40 m → 30 m. {dogName} pozostaje poniżej progu, uczy się tolerować bodźce.",
      wochenziele: [
        "Dystans do wyzwalacza zmniejsza się o 5-10 m.",
        "{dogName} pozostaje poniżej progu.",
        "Pracujesz cierpliwie i systematycznie.",
      ],
      tagesplan: "Świadome sesje przy źródłach wyzwalaczy z kontrolowalnym dystansem. Przeciwwarunkowanie przy każdym bodźcu. Zmniejszaj dystans tylko wtedy, gdy {dogName} jest stabilny przez kilka dni. Nigdy nie redukuj radykalnie w jeden dzień.",
      no_gos: [
        "Zbyt szybkie zmniejszanie dystansu — eskalacja.",
        "Zwiększanie presji w gorsze dni.",
        "Ignorowanie progu, gdy się zmienia.",
      ],
      fortschritt: [
        "Próg zmniejsza się wymiernie.",
        "{dogName} lepiej toleruje bodźce.",
        "Pracujesz systematycznie.",
      ],
      exerciseIds: ["b-counter-cond-aussen", "b-ruhe-marker"],
    },
    {
      title: "Sprawdzenie fundamentu",
      schwerpunkt: "Ostatni tydzień fundamentu. Dziennik wyzwalaczy przeanalizowany, marker CICHO utrwalony, dzwonek-koc siedzi, tolerancja na frustrację zbudowana. Faza 2 = prawdziwe zastosowanie.",
      wochenziele: [
        "Wszystkie elementy siedzą.",
        "Częstotliwość szczekania jest wymiernie zmniejszona.",
        "Jesteś przygotowany na fazę 2.",
      ],
      tagesplan: "Bilans: co siedzi, co się chwieje? Jeśli słabość: dołóż 1 dodatkowy tydzień. Przy szczekaniu o uwagę pozostań szczególnie konsekwentny.",
      no_gos: [
        "Przeskakiwanie do fazy 2 z niecierpliwości.",
        "Ignorowanie kilku słabości.",
        "Porzucanie planu, bo 1 tydzień poszedł źle.",
      ],
      fortschritt: [
        "Czujesz się kompetentny.",
        "Narzędzia siedzą.",
        "Faza 2 jest w zasięgu ręki.",
      ],
      exerciseIds: ["b-trigger-tagebuch", "b-tuerklingel-decke"],
    },
  ],
  steigerung: [
    {
      title: "Prawdziwe testy dzwonka z pomocnikiem",
      schwerpunkt: "Teraz odważamy się na prawdziwe testy dzwonka. Pomocnik dzwoni z zewnątrz, {dogName} musi pobiec na koc. Konsekwencja przez 2-3 tygodnie, aż stanie się standardem.",
      wochenziele: [
        "{dogName} biegnie przy prawdziwym dzwonku na koc.",
        "Zachowanie jest stabilne także przy prawdziwym gościu.",
        "Drzwi można otworzyć, pies pozostaje w miejscu.",
      ],
      tagesplan: "Wcześniej: pomocnik przychodzi w odwiedziny, koc przygotowany. Dzwonek: zaprowadź {dogName} na koc (lub sam pójdzie). Otwórz drzwi, wpuść gościa, ignoruj {dogName}. Pozostaje na kocu: co 30 sek smakołyk. Po 5 min: sygnał OK.",
      no_gos: [
        "Prawdziwe testy dzwonka bez porządnego przygotowania w domu — frustracja.",
        "Gość głaszcze podczas szczekania — sabotuje.",
        "Odruchowe bieganie do drzwi przy szczekaniu — wzmacnia.",
      ],
      fortschritt: [
        "{dogName} radzi sobie z prawdziwym dzwonkiem spokojniej.",
        "Przyjmowanie gości staje się rutynowe.",
        "Czujesz się przygotowany.",
        "Przy bodźcach zewnętrznych {dogName} częściej patrzy na ciebie zamiast od razu szczekać.",
      ],
      exerciseIds: ["b-läuten-routine", "b-counter-cond-aussen"],
    },
    {
      title: "Aktywna praca z bodźcami zewnętrznymi",
      schwerpunkt: "Przy przechodzącym psie, listonoszu, dźwiękach z zewnątrz: aktywnie stosuj przeciwwarunkowanie. Wysoka gęstość nagradzania, zmiana skojarzenia.",
      wochenziele: [
        "Reakcja szczekania na bodźce zewnętrzne zmniejsza się o 50%+.",
        "{dogName} sam z siebie patrzy na ciebie przy bodźcach.",
        "Gęstość nagradzania jest wysoka.",
      ],
      tagesplan: "Aktywnie pracuj przy oknie lub w ogrodzie. Gdy widzisz bodziec wcześniej niż {dogName}: PATRZ + smakołyk nieprzerwanie. Jeśli {dogName} już szczeka: stwórz dystans (inny pokój), nie forsuj.",
      no_gos: [
        "Kontynuowanie przy stresie.",
        "Redukowanie gęstości nagradzania.",
        "Praca zbyt blisko bodźca.",
      ],
      fortschritt: [
        "Reakcja na bodźce zmniejsza się wymiernie.",
        "{dogName} aktywnie szuka kontaktu wzrokowego.",
        "Czujesz się bardziej zdolny do działania.",
      ],
      exerciseIds: ["b-trigger-tagebuch", "b-ruhe-marker"],
    },
    {
      title: "Wygaszanie szczekania o uwagę",
      schwerpunkt: "Konsekwentne wygaszanie przez 2-3 tygodnie. Odwracanie się plecami, ignorowanie, nieustępowanie. Kto jest tu niekonsekwentny, sabotuje całą pracę.",
      wochenziele: [
        "Szczekanie o uwagę zmniejsza się o 70%+.",
        "Konsekwencja rodziny stoi.",
        "Wewnętrznie stajesz się spokojniejszy i bardziej konsekwentny.",
      ],
      tagesplan: "Każdą próbę szczekania o uwagę konsekwentnie ignoruj. Odwróć się plecami, wyjdź z pokoju. Wróć po 30 sek ciszy. Z domownikami: omów wspólną konsekwencję zasad.",
      no_gos: [
        "Niekonsekwencja — sabotuje pracę.",
        "Ustępowanie przy szczycie nasilenia — udoskonala szczekanie.",
        "Zrzędzenie — uwaga to też nagroda.",
      ],
      fortschritt: [
        "Szczekanie o uwagę zmniejsza się wymiernie.",
        "Stajesz się bardziej konsekwentny.",
        "Konsekwencja rodziny stoi.",
      ],
      exerciseIds: ["b-aufmerksamkeits-bellen", "b-tuerklingel-decke"],
    },
    {
      title: "Redukcja szczekania z frustracji",
      schwerpunkt: "Sygnał CZEKAJ jest stosowany w większej liczbie sytuacji. Tolerancja na frustrację rośnie, szczekanie z frustracji się zmniejsza. Cierpliwa praca.",
      wochenziele: [
        "{dogName} utrzymuje 30 sek CZEKAJ w różnych sytuacjach.",
        "Szczekanie z frustracji wyraźnie się zmniejsza.",
        "Używasz CZEKAJ intuicyjnie.",
      ],
      tagesplan: "5-7 sytuacji CZEKAJ dziennie. Zwiększaj od 10 do 30 sek. Przy szczekaniu podczas CZEKAJ: nie zwalniaj. Dopiero przy 3 sek ciszy: zwolnienie + nagroda.",
      no_gos: [
        "Zwalnianie przy szczekaniu.",
        "Radykalne zwiększanie czasu czekania.",
        "Podnoszenie głosu przy szczekaniu z frustracji.",
      ],
      fortschritt: [
        "Tolerancja na frustrację rośnie.",
        "Szczekanie z frustracji się zmniejsza.",
        "{dogName} pozostaje dłużej spokojny w sytuacjach czekania.",
      ],
      exerciseIds: ["b-frust-management", "b-ruhe-marker"],
    },
    // Pogłębienia 6-miesięczne
    {
      title: "Zmienność wyzwalaczy",
      schwerpunkt: "Dotychczas pracowałeś nad pojedynczymi wyzwalaczami. W tym tygodniu je łączysz: dzwonek + bodźce zewnętrzne + uwaga. Strategia pozostaje spójna, wyzwalacze się zmieniają.",
      wochenziele: [
        "Stosujesz właściwą strategię do każdego wyzwalacza.",
        "Szczekanie zmniejsza się w różnych wyzwalaczach.",
        "Czujesz się przygotowany na różne sytuacje.",
      ],
      tagesplan: "Na każdym spacerze/dniu świadomie adresuj różne wyzwalacze. Dzwonek: koc. Pies przechodzi: przeciwwarunkowanie. Frustracja: CZEKAJ. Uwaga: ignorowanie. Konsekwencja we wszystkim.",
      no_gos: [
        "Zmienianie strategii zależnie od wyzwalacza — konsekwencja jest ważna.",
        "Nakładanie kilku wyzwalaczy jednocześnie — przeciąża.",
        "Kontynuowanie przy stresie.",
      ],
      fortschritt: [
        "Strategie są zgeneralizowane.",
        "Reagujesz właściwie zależnie od sytuacji.",
        "Częstotliwość szczekania zmniejszona we wszystkich obszarach.",
      ],
      exerciseIds: ["b-counter-cond-aussen", "b-trigger-tagebuch"],
    },
    {
      title: "Szczekanie ze stresu vs. szczekanie z potrzeby",
      schwerpunkt: "Naucz się rozróżniać: czy {dogName} szczeka ze stresu (lęk, przeciążenie) czy z potrzeby (uwaga, frustracja)? Oba wymagają różnych strategii.",
      wochenziele: [
        "Pewnie rozróżniasz szczekanie ze stresu i z potrzeby.",
        "Do każdego typu stosujesz właściwą strategię.",
        "Stan emocjonalny {dogName} jest lepiej odczytywany.",
      ],
      tagesplan: "Obserwuj aktywnie: czy {dogName} szczeka z napiętą mimiką, wysoko uniesionym ogonem, obnażonymi zębami (stres)? Czy jest rozluźniony, patrzy na ciebie, macha ogonem (potrzeba)? Stres: stwórz dystans, uspokój. Potrzeba: ignoruj.",
      no_gos: [
        "Traktowanie obu typów tak samo — błędna reakcja.",
        "Ignorowanie szczekania ze stresu — może eskalować.",
        "„Uspokajanie” szczekania z potrzeby — wzmacnia je.",
      ],
      fortschritt: [
        "Pewnie odczytujesz stan emocjonalny {dogName}.",
        "Reakcje stają się właściwe zależnie od sytuacji.",
        "Szczekanie zmniejsza się we wszystkich obszarach.",
      ],
      exerciseIds: ["b-ruhe-marker", "b-tuerklingel-decke"],
    },
    {
      title: "Ostrożna redukcja nagród",
      schwerpunkt: "Gdy marker CICHO i przeciwwarunkowanie siedzą, powoli redukujesz gęstość nagradzania. Ale: nie pomijaj całkowicie. Zmienne wzmacnianie utrzymuje zachowanie stabilniejsze.",
      wochenziele: [
        "Częstotliwość nagradzania zostaje zredukowana do ~50%.",
        "{dogName} reaguje także przy mniejszej ilości nagród.",
        "Najlepsze wyniki nadal nagradzane jackpotem.",
      ],
      tagesplan: "W prostych sytuacjach: nie nagradzaj każdej ciszy. W trudnych (wyzwalacz): nadal pełna nagroda. {dogName} zauważa: system zostaje, ale nieprzewidywalny.",
      no_gos: [
        "Całkowite skreślenie nagrody — nawrót.",
        "Redukcja na trudnych trasach.",
        "Radykalna zmiana.",
      ],
      fortschritt: [
        "Zachowanie staje się stabilniejsze bez ciągłej nagrody.",
        "Wkładasz mniej smakołyków.",
        "Częstotliwość szczekania pozostaje niska.",
      ],
      exerciseIds: ["b-trigger-tagebuch", "b-tuerklingel-decke"],
    },
    {
      title: "Utrwalenie nasilenia",
      schwerpunkt: "Ostatni tydzień nasilenia. Wszystkie narzędzia siedzą, wyzwalacze są obsługiwane elastycznie. Faza 3 = długoterminowe zastosowanie i stabilizacja.",
      wochenziele: [
        "Wszystkie narzędzia działają płynnie.",
        "Częstotliwość szczekania jest wyraźnie zmniejszona.",
        "Jesteś przygotowany na fazę 3.",
      ],
      tagesplan: "Tydzień bilansu: co działa świetnie, co się chwieje? Zanotuj pozostałe wyzwalacze {dogName}. Zaplanuj na fazę 3 rutynę podtrzymania.",
      no_gos: [
        "Traktowanie sukcesów jako oczywistości.",
        "Radykalne redukowanie gęstości nagradzania.",
        "Rozluźnianie konsekwencji rodziny.",
      ],
      fortschritt: [
        "Szczekanie jest wymiernie zmniejszone.",
        "Czujesz się kompetentny.",
        "Narzędzia siedzą płynnie.",
      ],
      exerciseIds: ["b-counter-cond-aussen", "b-aufmerksamkeits-bellen"],
    },
  ],
  generalisierung: [
    {
      title: "Prawdziwe codzienne sytuacje z wyzwalaczami",
      schwerpunkt: "Faza 3 = zastosowanie w normalnej codzienności. Dzwonek, bodźce zewnętrzne, frustracja, uwaga — wszystkie wyzwalacze w normalnym rytmie dnia. Strategie siedzą elastycznie.",
      wochenziele: [
        "Wyzwalacze w codzienności są obsługiwane elastycznie.",
        "{dogName} reaguje przewidywalnie na strategie.",
        "Czujesz się kompetentny w radzeniu sobie ze szczekaniem.",
      ],
      tagesplan: "Każdą sytuację z wyzwalaczem w codzienności aktywnie adresuj właściwą strategią. Obserwuj, co działa. Odświeżenie w razie potrzeby. Utrzymuj wysoką konsekwencję rodziny.",
      no_gos: [
        "Rozluźnianie codziennej konsekwencji.",
        "Unikanie trudnych sytuacji — brak treningu.",
        "Dopuszczanie stresu do siebie — udziela się.",
      ],
      fortschritt: [
        "Codzienność przebiega bardziej rutynowo.",
        "Szczekanie jest wyjątkiem.",
        "Wewnętrznie stajesz się spokojniejszy.",
      ],
      exerciseIds: ["b-läuten-routine", "b-ruhe-marker"],
    },
    {
      title: "Opanowanie trudnych pór dnia",
      schwerpunkt: "Godziny szczytu z wieloma przechodzącymi psami, weekendy z dużą ilością dzwonków, czasy stresu. W tym tygodniu {dogName} radzi sobie także z gęstymi fazami wyzwalaczy.",
      wochenziele: [
        "{dogName} radzi sobie z trudnymi porami dnia.",
        "Efekt kumulacji wyzwalaczy jest unikany.",
        "Planujesz elastycznie.",
      ],
      tagesplan: "Świadomie zaplanuj 1-2 sesje w trudnych porach dnia. Wcześniej zajęcie, potem celowo sytuacja z wyzwalaczem, wyciszenie potem. Gęstość nagradzania w tych fazach wyższa.",
      no_gos: [
        "Kilka trudnych faz na dzień.",
        "Kontynuowanie przy stresie.",
        "Pomijanie zajęcia przed trudną fazą.",
      ],
      fortschritt: [
        "Trudne fazy są opanowane.",
        "Planujesz strukturalnie.",
        "Szczekanie pozostaje pod kontrolą.",
      ],
      exerciseIds: ["b-counter-cond-aussen", "b-trigger-tagebuch"],
    },
    {
      title: "Rutynizacja przyjmowania gości",
      schwerpunkt: "Gdy rutyna koca przy dzwonku siedzi, utrwalamy całe przyjmowanie gości jako stałą sekwencję. Dzwonek → koc → drzwi → powitanie z warunkami.",
      wochenziele: [
        "Przyjmowanie gości przebiega jako stała sekwencja.",
        "Goście są wcześniej instruowani.",
        "{dogName} pozostaje spokojny podczas przyjmowania.",
      ],
      tagesplan: "Poinformuj gości wcześniej: „Proszę, ignoruj go przez pierwsze 5 min, on musi pozostać na kocu.” Dzwonek: koc. Drzwi: gość wchodzi. Powitanie obu ludzi najpierw bez psa. Po 5 min: sygnał OK, {dogName} może ostrożnie się przywitać.",
      no_gos: [
        "Nieinformowanie gości — głaszczą szczekającego psa.",
        "Zbyt wczesny sygnał OK.",
        "Wpuszczanie {dogName} do drzwi, gdy gość wchodzi.",
      ],
      fortschritt: [
        "Przyjmowanie gości jest rutyną.",
        "{dogName} pozostaje spokojny podczas dzwonka + wejścia.",
        "Czujesz się bardziej rozluźniony przy gościach.",
      ],
      exerciseIds: ["b-läuten-routine", "b-tuerklingel-decke"],
    },
    {
      title: "Stabilne utrzymanie redukcji nagród",
      schwerpunkt: "Gęstość nagradzania jest dalej redukowana, ale stabilizowana. {dogName} reaguje na marker CICHO także bez ciągłych smakołyków. Ale: jackpot przy najlepszym wyniku pozostaje.",
      wochenziele: [
        "Częstotliwość nagradzania jest zredukowana do ~30%.",
        "{dogName} reaguje także przy mniejszej ilości nagród.",
        "W sytuacjach z wyzwalaczami: nadal pełna nagroda.",
      ],
      tagesplan: "Codzienna cisza: nie nagradzaj każdej sekundy, tylko wyrywkowo. Sytuacje z wyzwalaczami: nadal pełna gęstość nagradzania. {dogName} zauważa: nieprzewidywalne, ale opłacalne.",
      no_gos: [
        "Całkowite pomijanie.",
        "Redukowanie nagrody przy wyzwalaczu.",
        "Niekonsekwentna redukcja — myli.",
      ],
      fortschritt: [
        "Zachowanie pozostaje stabilne bez ciągłej nagrody.",
        "Stajesz się bardziej rozluźniony.",
        "Szczekanie pozostaje rzadkie.",
      ],
      exerciseIds: ["b-ruhe-marker", "b-tuerklingel-decke"],
    },
    {
      title: "Długoterminowe utrzymanie konsekwencji",
      schwerpunkt: "Szczekanie może wrócić, gdy konsekwencja słabnie. W tym tygodniu utrwalasz konsekwencję rodziny i rutyny na kolejne miesiące.",
      wochenziele: [
        "Domownicy pozostają konsekwentni.",
        "Rutyny są utrwalone.",
        "Rozpoznajesz małe nawroty wcześnie.",
      ],
      tagesplan: "Odprawa rodzinna: krótkie przypomnienie wszystkich zasad. Zapisz je na kartce. Obserwuj: czy są małe nawroty? Natychmiastowa reakcja. Nie rozluźniaj rutyn jak dzwonek-koc.",
      no_gos: [
        "Rozluźnianie konsekwencji — szczekanie wraca.",
        "Ignorowanie nawrotów.",
        "Zaniedbywanie rutyn.",
      ],
      fortschritt: [
        "Konsekwencja rodziny stoi.",
        "Rutyny są utrwalone.",
        "Nawroty są rozpoznawane wcześnie.",
      ],
      exerciseIds: ["b-aufmerksamkeits-bellen", "b-läuten-routine"],
    },
    {
      title: "Redukcja stresu w rytmie dnia",
      schwerpunkt: "Szczekanie jest często objawem stresu. W tym tygodniu celowo redukujesz czynniki stresu: więcej snu, więcej pracy węchowej, mniej nadmiaru bodźców.",
      wochenziele: [
        "{dogName} ma min. 16 h snu dziennie.",
        "Nadmiar bodźców jest celowo unikany.",
        "Poziom stresu wyraźnie spada.",
      ],
      tagesplan: "Sprawdź rytm dnia: dość snu? Przewidywalne rutyny? Fazy pracy węchowej? Minimalizuj czynniki stresu jak nadmiar bodźców. Higiena snu jak przy planie energetycznym.",
      no_gos: [
        "Ignorowanie stresu.",
        "Postrzeganie nadmiaru bodźców jako „normalnego”.",
        "Ciągłe stymulowanie psa.",
      ],
      fortschritt: [
        "Poziom stresu spada.",
        "Częstotliwość szczekania dalej się zmniejsza.",
        "Stajesz się uważniejszy na oznaki stresu.",
      ],
      exerciseIds: ["b-ruhe-marker", "b-tuerklingel-decke"],
    },
    {
      title: "Strategie awaryjne na nawroty",
      schwerpunkt: "Jeśli szczekanie nagle się nasila: co robić? W tym tygodniu utrwalasz jasną sekwencję awaryjną. Wczesne rozpoznanie, przeciwdziałanie, unikanie eskalujących faz.",
      wochenziele: [
        "Masz jasny plan awaryjny na nawroty.",
        "Wczesne oznaki są rozpoznawane.",
        "Nawroty są opanowywane w 1 tydzień.",
      ],
      tagesplan: "Plan awaryjny: 1) natychmiast 1 tydzień wyjątkowo konsekwentnie. 2) Gęstość nagradzania znów wysoka. 3) Redukuj wyzwalacze (więcej zarządzania). 4) Zwiększ zajęcie. 5) Obserwuj, co się zmieniło (nowe mieszkanie, inna rutyna, nowe wyzwalacze).",
      no_gos: [
        "Ignorowanie nawrotów — nasilają się.",
        "Wpadanie w panikę — udziela się.",
        "Nagłe zmienianie rutyn.",
      ],
      fortschritt: [
        "Plan awaryjny siedzi.",
        "Nawroty są opanowywane wcześnie.",
        "Czujesz się kompetentny długoterminowo.",
      ],
      exerciseIds: ["b-trigger-tagebuch", "b-counter-cond-aussen"],
    },
    {
      title: "Przejście w tryb podtrzymania",
      schwerpunkt: "Ostatni tydzień. Szczekanie jest mocno zmniejszone, wyzwalacze są obsługiwane, konsekwencja rodziny stoi. Podtrzymanie na nadchodzące miesiące stoi.",
      wochenziele: [
        "Wszystkie rutyny działają samodzielnie.",
        "Rytm podtrzymania jest jasny.",
        "{dogName} jest długoterminowo spokojniejszy.",
      ],
      tagesplan: "Zredukuj aktywny trening do minimum. Obserwuj. Zaplanuj co 4-6 tygodni dzień odświeżenia ze wszystkimi strategiami. Odprawa rodzinna co 3 miesiące.",
      no_gos: [
        "Nagłe porzucenie wszystkich rutyn.",
        "Rozluźnianie konsekwencji rodziny.",
        "Zaprzestanie obserwacji.",
      ],
      fortschritt: [
        "{dogName} jest długoterminowo spokojniejszy.",
        "Szczekanie jest wyjątkiem, nie normą.",
        "Czujesz się kompetentny.",
      ],
      exerciseIds: ["b-ruhe-marker", "b-läuten-routine"],
    },
  ],
};

const ANXIETY_WEEKS: Record<Phase, WeekTemplate[]> = {
  fundament: [
    {
      title: "Identyfikacja wyzwalaczy pożegnania",
      schwerpunkt: "Psy z lękiem separacyjnym często stresują się już ZANIM wyjdziesz. Odczytują wyzwalacze takie jak klucze, buty, kurtka. W tym tygodniu identyfikujesz pełny zestaw wyzwalaczy.",
      wochenziele: [
        "Znasz indywidualny zestaw wyzwalaczy {dogName}.",
        "Wcześnie rozpoznajesz pierwsze oznaki stresu.",
        "Rozumiesz, jak przebiega proces lęku.",
      ],
      tagesplan: "Przez 3-5 dni dokładnie obserwuj moment wychodzenia. Notuj: od którego momentu zmienia się zachowanie? Oddech? Oblizywanie? Dyszenie? Chodzenie w kółko? Zidentyfikuj zestaw: często klucze + buty + torba + kurtka + ręka na klamce.",
      no_gos: [
        "Zaczynać trening bez znajomości zestawu wyzwalaczy.",
        "Rozpatrywać wyzwalacze tylko pojedynczo — często działają w połączeniu.",
        "Bagatelizować oznaki stresu.",
      ],
      fortschritt: [
        "Masz jasną listę wyzwalaczy.",
        "Rozumiesz proces lęku u {dogName}.",
        "Jesteś gotowy na ukierunkowane odczulanie.",
        "Pierwsze 2-5 sekund samotności przechodzi bez dramatu.",
      ],
      exerciseIds: ["ax-trigger-stack", "ax-mini-sekunden"],
    },
    {
      title: "Odczulanie wyzwalaczy",
      schwerpunkt: "Zidentyfikowane wyzwalacze pozbawiamy ich znaczenia. Bierzesz klucze, ale nie wychodzisz, wkładasz buty, ale nie wychodzisz. Przez tygodnie wyzwalacze tracą swoje działanie wywołujące lęk.",
      wochenziele: [
        "{dogName} nie reaguje już na pojedyncze wyzwalacze.",
        "Wyzwalacze są oddzielone od wychodzenia.",
        "Wplatasz to mimochodem w codzienny dzień.",
      ],
      tagesplan: "10x dziennie różne wyzwalacze bez konsekwencji: weź klucze, odłóż. Włóż buty, zdejmij. Dotknij klamki, puść. {dogName} najpierw patrzy zaciekawiony, potem traci zainteresowanie. Właśnie to jest efekt uczenia.",
      no_gos: [
        "Robić z tego coś podobnego do treningu — mimochodem jest lepiej.",
        "Oczekiwać, że uda się w 3 dni — to praca na tygodnie.",
        "Kontynuować przy oznakach stresu.",
      ],
      fortschritt: [
        "Wyzwalacze tracą swoje działanie.",
        "{dogName} pozostaje spokojniejszy przy widoku wyzwalaczy.",
        "Pracujesz na luzie, przy okazji.",
        "Przed wyjściem jest teraz dobrze wypełniony Kong jako pozytywne skojarzenie.",
      ],
      exerciseIds: ["ax-trigger-entkoppeln", "ax-kong-beim-gehen"],
    },
    {
      title: "Budowanie samotności w sekundach",
      schwerpunkt: "Teraz budujesz czas samotności — od 2 sekund do godzin. Cierpliwie, przez tygodnie. Kto zwiększa za szybko, na nowo buduje lęk.",
      wochenziele: [
        "{dogName} pozostaje 1-3 min spokojnie sam.",
        "Wychodzisz i wracasz bez dramatu.",
        "Oznaki stresu się zmniejszają.",
      ],
      tagesplan: "Dzień 1: 2 sek samotności, 10 powtórzeń. Dzień 2: 5 sek. Dzień 3: 10 sek. Dzień 4: 30 sek. Dzień 5: 1 min. Dzień 6-7: 2-3 min. Wracaj, gdy {dogName} jest spokojny, a NIE w reakcji na stres.",
      no_gos: [
        "Wracać przy reakcji stresowej — uczy to 'skomlenie = opiekun wraca'.",
        "Zwiększać za szybko — lęk eskaluje.",
        "Dramat przy powitaniu/pożegnaniu.",
      ],
      fortschritt: [
        "Czas samotności rośnie w mierzalny sposób.",
        "Oznaki stresu się zmniejszają.",
        "Pracujesz cierpliwie.",
      ],
      exerciseIds: ["ax-mini-sekunden", "ax-trigger-stack"],
    },
    {
      title: "Kong jako pozytywne skojarzenie",
      schwerpunkt: "Ulubiony Kong pojawia się TYLKO wtedy, gdy wychodzisz. Dzięki temu wychodzenie zostaje pozytywnie skojarzone. {dogName} cieszy się na samotność, zamiast się jej bać.",
      wochenziele: [
        "{dogName} zaczyna zajmować się Kongiem, gdy wychodzisz.",
        "Skojarzenie Kong + nieobecność jest ustanowione.",
        "Oznaki stresu przy wychodzeniu się zmniejszają.",
      ],
      tagesplan: "Wypełnij Kong bardzo dobrze mokrą karmą, zamrożenie = trudniejsze. Tuż przed wyjściem: podaj Kong w stałym miejscu. Wyjdź bez dramatu. Wróć. Zabierz Kong — jest zarezerwowany TYLKO na nieobecność.",
      no_gos: [
        "Dawać Kong także poza nieobecnością — traci swoją magię.",
        "Kontynuować przy stresie — {dogName} nie jest jeszcze gotowy.",
        "Dramatyczne pożegnanie podczas podawania Konga.",
      ],
      fortschritt: [
        "{dogName} cieszy się na czas z Kongiem.",
        "Oznaki stresu się zmniejszają.",
        "Skutecznie budujesz pozytywne skojarzenie.",
      ],
      exerciseIds: ["ax-kong-beim-gehen", "ax-trigger-entkoppeln"],
    },
    // Pogłębienia 6-miesięczne
    {
      title: "Ustanowienie koca bezpieczeństwa",
      schwerpunkt: "Koc relaksacyjny staje się kotwicą bezpieczeństwa na czas samotności. {dogName} spędza czas samotności na kocu. Warunkowanie pawłowowskie: koc = bezpieczeństwo.",
      wochenziele: [
        "Koc jest ustanowiony jako kotwica bezpieczeństwa.",
        "{dogName} szuka koca także poza treningiem.",
        "Czas samotności na kocu staje się rutyną.",
      ],
      tagesplan: "Koc w stałym miejscu, najlepiej z osłoną (kosz, kanapa dla psa). Przy wychodzeniu: {dogName} na kocu, do tego Kong. Gdy wstaje: spokojnie odprowadź z powrotem. Przez tygodnie koc staje się wyspą czasu samotności.",
      no_gos: [
        "Używać koca do kary.",
        "Używać koca tylko w fazach stresu.",
        "Zmuszać {dogName} do leżenia.",
      ],
      fortschritt: [
        "{dogName} sam szuka koca.",
        "Koc zostaje pozytywnie nacechowany emocjonalnie.",
        "Stres związany z samotnością się zmniejsza.",
      ],
      exerciseIds: ["ax-sicherheits-decke", "ax-trigger-stack"],
    },
    {
      title: "Budowanie godzin z obserwacją wideo",
      schwerpunkt: "Gdy krótkie fazy są opanowane, powoli budujesz godziny. Smartfon jako kamera, żebyś dokładnie wiedział, co {dogName} robi, gdy cię nie ma. Nie zgadywać.",
      wochenziele: [
        "{dogName} pozostaje 30-60 min spokojnie sam.",
        "Obserwujesz przez wideo, co naprawdę się dzieje.",
        "Pewnie rozpoznajesz stres od odprężenia.",
      ],
      tagesplan: "Zainstaluj kamerę w smartfonie lub kamerę smart z transmisją na żywo. Dzień 1-3: 30 min nieobecności, obserwuj. Dzień 4-7: przy powodzeniu na 45 min, potem zwiększaj do 60 min. Przy stresie: powrót do ostatniego stabilnego poziomu.",
      no_gos: [
        "Zgadywać, co się dzieje, bez wideo.",
        "Zwiększać za szybko.",
        "Kontynuować przy stresie.",
      ],
      fortschritt: [
        "Czas samotności rośnie stabilnie.",
        "Masz dane, a nie tylko przypuszczenia.",
        "Stres {dogName} zmniejsza się w mierzalny sposób.",
      ],
      exerciseIds: ["ax-langzeit-aufbau", "ax-tagesroutine"],
    },
    {
      title: "Przewidywalna rutyna dnia",
      schwerpunkt: "Psy z lękiem separacyjnym ogromnie korzystają z przewidywalnego przebiegu dnia. Te same pory spaceru, karmienia, zajęcia, czasu samotności.",
      wochenziele: [
        "Rutyna dnia jest ustanowiona i spisana.",
        "Także w weekend zachowywane są te same pory.",
        "Przewidywalność zmniejsza lęk.",
      ],
      tagesplan: "Zapisz stałe pory na lodówce: pobudka, pierwsze wyjście, karmienie, spacer, czas samotności, kolejny spacer, kolacja, sen. Zachowuj je także w weekend.",
      no_gos: [
        "Robić pory inaczej w weekend — to dezorientuje.",
        "Pomijać wysiłek przed czasem samotności.",
        "Spontanicznie odbiegać bez ważnego powodu.",
      ],
      fortschritt: [
        "{dogName} zna rutynę dnia.",
        "Niepewność się zmniejsza.",
        "Lęk separacyjny spada wraz z przewidywalnością.",
      ],
      exerciseIds: ["ax-trigger-stack", "ax-kong-beim-gehen"],
    },
    {
      title: "Sprawdzenie fundamentu",
      schwerpunkt: "Ostatni tydzień fundamentu. Wyzwalacze odczulone, budowanie czasu samotności trwa, skojarzenie z Kongiem opanowane, koc jest kotwicą. Faza 2 = budowanie godzin.",
      wochenziele: [
        "Wszystkie elementy są opanowane.",
        "Jesteś przygotowany na fazę 2.",
        "Stres {dogName} zmniejsza się w mierzalny sposób.",
      ],
      tagesplan: "Podsumowanie: co jest opanowane, co się chwieje? Jeśli czas samotności poniżej 2 min nadal powoduje stres: 1 dodatkowy tydzień w fazie 1. Faza 2 = dłuższe czasy, tam nic nie może się chwiać.",
      no_gos: [
        "Z niecierpliwości przeskakiwać do fazy 2.",
        "Ignorować próg tolerancji.",
        "Naciskać na zwiększanie.",
      ],
      fortschritt: [
        "Czujesz się kompetentny.",
        "Narzędzia są opanowane.",
        "Faza 2 jest w zasięgu ręki.",
      ],
      exerciseIds: ["ax-mini-sekunden", "ax-trigger-entkoppeln"],
    },
  ],
  steigerung: [
    {
      title: "Wydłużanie faz minutowych",
      schwerpunkt: "W oparciu o fundament: czas samotności z 3 min do 15-30 min. Nagrodą pozostaje Kong, koc jest kotwicą, obserwacja przez wideo.",
      wochenziele: [
        "{dogName} pozostaje 15-30 min spokojnie sam.",
        "Kong jest zjadany spokojnie.",
        "Oznaki stresu już się nie pojawiają.",
      ],
      tagesplan: "Dzień 1: 5 min. Dzień 2: 10. Dzień 3: 15. Dzień 4: 20. Dzień 5: 30. Jeśli któregoś dnia pojawi się stres: powrót do ostatniego stabilnego poziomu, pozostań tam 2-3 dni.",
      no_gos: [
        "Zwiększać za szybko.",
        "Brnąć dalej przy stresie.",
        "Dramat przy pożegnaniu/powitaniu.",
      ],
      fortschritt: [
        "Czas samotności rośnie stabilnie.",
        "Skojarzenie z Kongiem jest opanowane.",
        "Stres się zmniejsza.",
      ],
      exerciseIds: ["ax-mini-sekunden", "ax-kong-beim-gehen"],
    },
    {
      title: "Pierwsza godzina samotności",
      schwerpunkt: "Magiczny próg: 1 godzina samotności. Gdy to jest opanowane, większość pracy nad lękiem separacyjnym jest wykonana. Ostrożnie i z wideo.",
      wochenziele: [
        "{dogName} wytrzymuje 1 godzinę spokojnie sam.",
        "Wideo pokazuje fazy odpoczynku podczas nieobecności.",
        "Czujesz ulgę.",
      ],
      tagesplan: "Dzień 1-2: 45 min. Dzień 3-4: 50 min. Dzień 5-7: 60 min. Obserwuj wideo. Przy stresie: cofnij się. Przy powodzeniu: ostrożnie dalej.",
      no_gos: [
        "Oczekiwać, że 1h uda się od razu.",
        "Testować równolegle kilka godzin.",
        "Kontynuować przy stresie.",
      ],
      fortschritt: [
        "1 godzina samotności jest osiągnięta.",
        "Czujesz ulgę.",
        "{dogName} pozostaje spokojny.",
      ],
      exerciseIds: ["ax-langzeit-aufbau", "ax-tagesroutine"],
    },
    {
      title: "Bodźce zewnętrzne podczas samotności",
      schwerpunkt: "{dogName} musi radzić sobie także z bodźcami zewnętrznymi podczas czasu samotności. Hałas z ulicy, dzwonek, szczekanie innych psów — {dogName} ma to wszystko spokojnie znosić.",
      wochenziele: [
        "{dogName} pozostaje spokojny przy bodźcach zewnętrznych podczas samotności.",
        "Koc pozostaje kotwicą także pod wpływem bodźców.",
        "Oznaki stresu już się nie pojawiają.",
      ],
      tagesplan: "Zaplanuj czas samotności na pory z normalnym hałasem z zewnątrz. Obserwuj przez wideo. Jeśli {dogName} reaguje na bodźce zewnętrzne: 1) osłona na oknach, 2) cicha muzyka w tle (spokojna klasyka), 3) odsuń koc od źródeł dźwięku.",
      no_gos: [
        "Testować czas samotności podczas burzy — za trudne.",
        "Wchodzić przy szczekaniu na bodźce — to wzmacnia.",
        "Zostawiać bez obserwacji.",
      ],
      fortschritt: [
        "{dogName} pozostaje spokojny przy bodźcach zewnętrznych.",
        "Rutyna z kotwicą jest odporna.",
        "Czujesz się bardziej kompetentny.",
      ],
      exerciseIds: ["ax-sicherheits-decke", "ax-kong-beim-gehen"],
    },
    {
      title: "Utrwalanie odczulania wyzwalaczy",
      schwerpunkt: "Także po 4 tygodniach dalej odczulaj wyzwalacze. Klucze, buty, kurtka bez znaczenia. {dogName} NIE może już reagować na pojedyncze wyzwalacze.",
      wochenziele: [
        "Wszystkie dawne wyzwalacze są pozbawione znaczenia.",
        "{dogName} reaguje już tylko na faktyczne wychodzenie.",
        "Narastanie stresu przy przygotowaniach jest wyeliminowane.",
      ],
      tagesplan: "Nadal 10x dziennie różne wyzwalacze bez konsekwencji. Zwiększaj nieprzewidywalność: czasem bierzesz klucze I buty, ale NIE wychodzisz. Zmienność jest kluczem.",
      no_gos: [
        "Pomijać odczulanie wyzwalaczy.",
        "Odczulać tylko pojedyncze wyzwalacze.",
        "Oczekiwać, że utrzyma się bez dalszej pracy.",
      ],
      fortschritt: [
        "Wyzwalacze są trwale odczulone.",
        "Narastanie stresu przy przygotowaniach jest wyeliminowane.",
        "Pracujesz na luzie w codzienności.",
      ],
      exerciseIds: ["ax-trigger-entkoppeln", "ax-trigger-stack"],
    },
    // Pogłębienia
    {
      title: "Fazy 2-godzinne",
      schwerpunkt: "2 godziny samotności. To próg, od którego możliwe staje się prawdziwe życie codzienne (zakupy, przerwa obiadowa w pracy). Ostrożnie, z wideo.",
      wochenziele: [
        "{dogName} wytrzymuje 2 godziny spokojnie sam.",
        "Wideo pokazuje fazy snu.",
        "Odzyskujesz swobodę w codzienności.",
      ],
      tagesplan: "Dzień 1-2: 90 min. Dzień 3-4: 100 min. Dzień 5-7: 2 godziny. Nagroda z Kongiem + kocem. Jeśli stres: powrót do stabilnego poziomu.",
      no_gos: [
        "Oczekiwać, że 2h uda się od razu.",
        "Zgadywać bez wideo.",
        "Brnąć dalej przy stresie.",
      ],
      fortschritt: [
        "2h samotności jest osiągnięte.",
        "Odzyskujesz swobodę w codzienności.",
        "{dogName} pozostaje spokojny.",
      ],
      exerciseIds: ["ax-langzeit-aufbau", "ax-tagesroutine"],
    },
    {
      title: "Zmienny czas samotności",
      schwerpunkt: "Dotąd miałeś stały czas samotności. Teraz go różnicujesz: raz 30 min, raz 2h, raz 90 min. {dogName} uczy się: czas samotności jest nieprzewidywalny, ale zawsze przemijający.",
      wochenziele: [
        "{dogName} pozostaje spokojny niezależnie od długości czasu.",
        "Zmienność jest wćwiczona.",
        "Planujesz elastycznie.",
      ],
      tagesplan: "Dziennie 2-3 różne długości czasu samotności: rano 30 min, po południu 2h, wieczorem 45 min. {dogName} uczy się: nigdy nie wiem dokładnie jak długo, więc pozostaję spokojny.",
      no_gos: [
        "Więcej niż 3h z rzędu — za długo na tę fazę.",
        "Zbyt duże różnice w ciągu jednego dnia.",
        "Nie cofać się przy stresie.",
      ],
      fortschritt: [
        "Zmienność zostaje zaakceptowana.",
        "{dogName} pozostaje spokojny niezależnie od długości.",
        "Planujesz bardziej elastycznie.",
      ],
      exerciseIds: ["ax-trigger-stack", "ax-kong-beim-gehen"],
    },
    {
      title: "Kontakt społeczny jako reduktor stresu",
      schwerpunkt: "Więcej kontaktów społecznych z innymi psami, gdy jesteś obecny, często zmniejsza lęk separacyjny. {dogName} jest mniej skupiony wyłącznie na tobie.",
      wochenziele: [
        "{dogName} ma 2-3 przewidywalnych psich przyjaciół.",
        "Spotkania towarzyskie są ustanowione co tydzień.",
        "Skupienie na tobie się zmniejsza.",
      ],
      tagesplan: "Tygodniowo 2-3 spotkania towarzyskie: 30-45 min ze spokojnymi, przewidywalnymi psami. Nigdy dłużej. Po spotkaniu: wyciszenie. {dogName} uczy się: mam więcej źródeł kontaktu niż tylko opiekuna.",
      no_gos: [
        "Wielogodzinne szaleństwa.",
        "Nieznane psy o niejasnych kompetencjach społecznych.",
        "Kilka spotkań towarzyskich dziennie.",
      ],
      fortschritt: [
        "{dogName} ma sieć kontaktów społecznych.",
        "Skupienie na tobie się zmniejsza.",
        "Lęk separacyjny spada.",
      ],
      exerciseIds: ["ax-tagesroutine", "ax-trigger-entkoppeln"],
    },
    {
      title: "Utrwalenie fazy zwiększania",
      schwerpunkt: "Ostatni tydzień fazy zwiększania. 2h samotności opanowane, wyzwalacze odczulone, rutyny opanowane. Faza 3 = codzienność i podtrzymanie.",
      wochenziele: [
        "Wszystkie narzędzia są opanowane.",
        "Czas samotności do 2-3h jest wykonalny.",
        "Jesteś przygotowany na fazę 3.",
      ],
      tagesplan: "Podsumowanie: gdzie jesteś? Co się chwieje? Zaplanuj fazę 3: przewidywalna rutyna dnia, regularne odświeżenia, długoterminowa redukcja stresu.",
      no_gos: [
        "Forsować już 4h+ samotności.",
        "Rozluźniać rutyny.",
        "Traktować sukcesy jako oczywistość.",
      ],
      fortschritt: [
        "Czujesz ulgę.",
        "Narzędzia są opanowane.",
        "Czas samotności jest wykonalny.",
      ],
      exerciseIds: ["ax-langzeit-aufbau", "ax-sicherheits-decke"],
    },
  ],
  generalisierung: [
    {
      title: "3-4 godziny w codzienności",
      schwerpunkt: "Faza 3 = realistyczna codzienność. 3-4h samotności są wykonalne dla większości pracujących opiekunów. Więcej jest graniczne nawet dla zrównoważonych psów.",
      wochenziele: [
        "{dogName} pozostaje 3-4h spokojnie sam.",
        "Codzienne życie (praca, zakupy) jest wykonalne.",
        "Nie czujesz się już ograniczony.",
      ],
      tagesplan: "Świadomie testuj 3-4h samotności. Wideo. Utrzymaj stabilnie przez kilka dni, zanim wyjdziesz na dłużej. Kong + koc + spokojne przygotowanie.",
      no_gos: [
        "5h+ bez przerwy na toaletę — za długo.",
        "Brnąć dalej przy stresie.",
        "Spontaniczne zmiany.",
      ],
      fortschritt: [
        "3-4h są ustanowione.",
        "Codzienność jest znów wykonalna.",
        "Czujesz się wolny.",
        "Przewidywalna rutyna dnia (spacer, karmienie, czas samotności) wisi na lodówce.",
      ],
      exerciseIds: ["ax-langzeit-aufbau", "ax-tagesroutine"],
    },
    {
      title: "Utrzymanie przewidywalnej struktury dnia",
      schwerpunkt: "Także po sukcesie: rutyna dnia pozostaje. Psy z (dawnym) lękiem separacyjnym są podatne na regresy przy nieregularności.",
      wochenziele: [
        "Rutyna dnia jest konsekwentnie utrzymywana.",
        "Także w weekend żadnych odstępstw.",
        "Przewidywalność jest ustanowiona długoterminowo.",
      ],
      tagesplan: "Trzymaj się kartki z rutyną. Weekendy: te same pory co w dni robocze. Unikaj spontanicznych zmian. Przy naprawdę koniecznych zmianach: wcześniej stopniowo je wprowadzaj.",
      no_gos: [
        "Weekendowa dowolność bez rutyny.",
        "Spontaniczne zmiany planu.",
        "Pomijać wysiłek przed czasem samotności.",
      ],
      fortschritt: [
        "Rutyna jest ustanowiona długoterminowo.",
        "{dogName} pozostaje stabilny.",
        "Planujesz w sposób uporządkowany.",
      ],
      exerciseIds: ["ax-trigger-stack", "ax-kong-beim-gehen"],
    },
    {
      title: "Długoterminowa redukcja stresu",
      schwerpunkt: "Stres w innych obszarach może przywrócić lęk separacyjny. Dożywotnia higiena stresu: dość snu, dobry wysiłek, kontakty społeczne, spokojne otoczenie.",
      wochenziele: [
        "{dogName} ma 16-20h snu dziennie.",
        "Czynniki stresu są aktywnie redukowane.",
        "Regresy lęku separacyjnego są unikane.",
      ],
      tagesplan: "Sprawdzaj regularnie: higiena snu? Wysiłek? Kontakty społeczne? Fazy odpoczynku? Przy stresie w innym obszarze: redukuj, zanim lęk separacyjny wróci.",
      no_gos: [
        "Ignorować stres w innym obszarze.",
        "Dopuszczać przebodźcowanie.",
        "Zapominać o higienie snu.",
      ],
      fortschritt: [
        "{dogName} pozostaje długoterminowo zrównoważony.",
        "Regresy są unikane.",
        "Dbasz o higienę stresu.",
      ],
      exerciseIds: ["ax-tagesroutine", "ax-sicherheits-decke"],
    },
    {
      title: "Utrwalenie rutyny z Kongiem",
      schwerpunkt: "Kong pozostaje wyłącznym narzędziem czasu samotności. NIGDY nie podawaj go w swojej obecności. Różnicuj zawartość, żeby pozostał ekscytujący.",
      wochenziele: [
        "Rutyna z Kongiem jest ustanowiona długoterminowo.",
        "Zawartość jest wystarczająco urozmaicona.",
        "Kong pozostaje magiczną przekąską czasu samotności.",
      ],
      tagesplan: "Przy każdym czasie samotności Kong. Urozmaicenie: dziś mokra karma+ser, jutro sucha karma+kiełbasa, pojutrze masło orzechowe (oszczędnie). Zamrożony = trudniejszy. Po czasie samotności: zabierz Kong.",
      no_gos: [
        "Dawać Kong także poza czasem samotności.",
        "Zawsze ta sama zawartość — nudne.",
        "Zabierać Kong po 5 min — to frustruje.",
      ],
      fortschritt: [
        "Kong pozostaje pozytywnie nacechowany.",
        "{dogName} cieszy się na samotność.",
        "Skojarzenie utrzymuje się długoterminowo.",
      ],
      exerciseIds: ["ax-kong-beim-gehen", "ax-mini-sekunden"],
    },
    {
      title: "Rutyna obserwacji",
      schwerpunkt: "Także po sukcesie regularnie kontroluj przez wideo, co {dogName} robi podczas czasu samotności. Dzięki temu regresy wykrywasz wcześnie.",
      wochenziele: [
        "Obserwujesz przez wideo co 2-3 tygodnie.",
        "Regresy są wykrywane wcześnie.",
        "Masz dane, a nie tylko przypuszczenia.",
      ],
      tagesplan: "Co 2-3 tygodnie: nagraj 1 czas samotności na wideo. Obejrzyj: co {dogName} robił? Spał? Gryzł? Chodził w kółko? Rozpoznaj tendencje.",
      no_gos: [
        "Zakładać zamiast obserwować.",
        "Ignorować regresy.",
        "Zaniedbywać rutynę wideo.",
      ],
      fortschritt: [
        "Pewność oparta na danych.",
        "Regresy są wykrywane wcześnie.",
        "Czujesz się bardziej kompetentny.",
      ],
      exerciseIds: ["ax-langzeit-aufbau", "ax-tagesroutine"],
    },
    {
      title: "Radzenie sobie z trudnymi okazjami",
      schwerpunkt: "Weterynarz, fryzjer, nagła wizyta. Okazje, które zatrzymują cię dłużej. Trenuj wcześniej, nie ucz się dopiero w sytuacji awaryjnej.",
      wochenziele: [
        "Planujesz trudne okazje w sposób uporządkowany.",
        "{dogName} pozostaje spokojny także przy dłuższych fazach.",
        "Czujesz się przygotowany.",
      ],
      tagesplan: "Zanim nadejdą trudne okazje: tydzień wcześniej poćwicz 1-2 nietypowo długie czasy samotności. Wzbogać zawartość Konga. Utrzymaj rutynę dnia możliwie podobnie. W razie potrzeby: opiekun dla psa na sytuacje awaryjne.",
      no_gos: [
        "Spontaniczne wydłużenie bez przygotowania.",
        "Opiekun dla psa bez wcześniejszego zapoznania.",
        "Przeciążać {dogName} przy nagłej konieczności.",
      ],
      fortschritt: [
        "Trudne okazje są opanowane.",
        "Planujesz w sposób uporządkowany.",
        "{dogName} pozostaje stabilny.",
      ],
      exerciseIds: ["ax-trigger-stack", "ax-trigger-entkoppeln"],
    },
    {
      title: "Protokół awaryjny przy regresie",
      schwerpunkt: "Jeśli lęk separacyjny wróci (nowe mieszkanie, zmiany): jasna sekwencja awaryjna. Wczesne rozpoznanie, przeciwdziałanie, tygodnie dodatkowej konsekwencji.",
      wochenziele: [
        "Masz plan awaryjny.",
        "Wczesne oznaki są rozpoznawane.",
        "Regresy są wyłapywane w 2-3 tygodnie.",
      ],
      tagesplan: "Plan awaryjny: 1) powrót do krótszych czasów samotności. 2) wzmocnienie skojarzenia z Kongiem. 3) ścisłe trzymanie rutyny dnia. 4) redukcja czynników stresu. 5) kontrola u weterynarza, by wykluczyć przyczyny medyczne.",
      no_gos: [
        "Ignorować regresy.",
        "Przy regresie kontynuować z dotychczasowym czasem samotności.",
        "Zwiększać nacisk.",
      ],
      fortschritt: [
        "Plan awaryjny jest opanowany.",
        "Regresy są zarządzane.",
        "Czujesz się długoterminowo kompetentny.",
      ],
      exerciseIds: ["ax-mini-sekunden", "ax-kong-beim-gehen"],
    },
    {
      title: "Przejście w tryb podtrzymania",
      schwerpunkt: "Ostatni tydzień. Lęk separacyjny jest wyraźnie zmniejszony, czas samotności działa, rutyny są opanowane. Podtrzymanie na kolejne lata.",
      wochenziele: [
        "Wszystkie rutyny działają długoterminowo.",
        "Rytm podtrzymania jest jasny.",
        "{dogName} jest długoterminowo zrównoważony.",
      ],
      tagesplan: "Zredukuj aktywny trening do minimum. Rutyna dnia pozostaje. Rutyna z Kongiem pozostaje. Obserwacja co 4-6 tygodni. Przy zmianach (przeprowadzka, nowa rutyna): ostrożnie dostosuj.",
      no_gos: [
        "Nagle porzucać rutyny.",
        "Nie dostosowywać się przy zmianach.",
        "Przestać obserwować.",
      ],
      fortschritt: [
        "{dogName} jest długoterminowo zrównoważony.",
        "Czujesz się wolny.",
        "Lęk separacyjny to przeszłość.",
      ],
      exerciseIds: ["ax-tagesroutine", "ax-trigger-stack"],
    },
  ],
};

// ────────────────────────────────────────────────────────────────────
// JUMPING (Skakanie) — 4 łapy = nagroda, skakanie = ignorowanie
// ────────────────────────────────────────────────────────────────────
const JUMPING_WEEKS: Record<Phase, WeekTemplate[]> = {
  fundament: [
    {
      title: "Cztery łapy na ziemi = nagroda",
      schwerpunkt: "Najważniejsza zasada: tylko spokojne stanie dostaje uwagę. Przy skakaniu {dogName} jest konsekwentnie ignorowany. Przez 2-3 tygodnie konsekwencji skakanie zanika.",
      wochenziele: [
        "Przy czterech łapach na ziemi: spokojnie się przywitaj, pogłaszcz.",
        "Przy skakaniu: odwróć się plecami, ignoruj.",
        "{dogName} zauważa: skakanie = odchodzisz.",
      ],
      tagesplan: "Przy każdym powitaniu stosuj aktywnie: cztery łapy na ziemi = spokojne cześć. Skacze? Odwróć się plecami, żadnego kontaktu wzrokowego. Cztery łapy z powrotem na ziemi: znów się zwróć. Spójność ze wszystkimi członkami rodziny.",
      no_gos: [
        "Karcić przy skakaniu — uwaga też jest nagrodą.",
        "Członkowie rodziny, którzy raz ustąpią — sabotuje to pracę.",
        "Odpychać kolanem — może zranić, pies tego nie rozumie.",
      ],
      fortschritt: [
        "{dogName} skacze rzadziej.",
        "Stajesz się bardziej konsekwentny.",
        "Rodzina współpracuje.",
        "{dogName} sam oferuje SIAD, gdy ktoś podchodzi do {dogName}.",
      ],
      exerciseIds: ["j-vier-pfoten-belohnen", "j-sitz-als-gruess"],
    },
    {
      title: "SIAD jako alternatywa powitania",
      schwerpunkt: "Zamiast tylko powstrzymywać skakanie, dajemy {dogName} alternatywę: SIAD to nowe powitanie. Przy spotkaniu siada i za to dostaje uwagę.",
      wochenziele: [
        "{dogName} siada na SIAD przed powitaniem.",
        "Uwaga pojawia się TYLKO, gdy siedzi.",
        "SIAD staje się automatycznym powitaniem.",
      ],
      tagesplan: "Przy spotkaniach (rodzina, goście): powiedz SIAD. Siedzi: głaskanie + smakołyk. Wstaje do skoku: przerwij głaskanie. Znów SIAD: zwróć się. Poinstruuj też gości: 'Tylko przy SIAD.'",
      no_gos: [
        "Głaskać także przy staniu — błędne skojarzenie.",
        "Nie informować gości — głaszczą skaczącego psa.",
        "Nie wyćwiczyć wcześniej SIAD.",
      ],
      fortschritt: [
        "SIAD staje się standardem powitania.",
        "Skakanie się zmniejsza.",
        "Czujesz się przygotowany.",
        "Spójność rodziny działa i wszyscy domownicy współpracują.",
      ],
      exerciseIds: ["j-tuergaeste-routine", "j-konsistenz-familie"],
    },
    {
      title: "Ustanowienie spójności rodziny",
      schwerpunkt: "Skakanie to problem spójności. Jeśli 1 członek rodziny pozwala na skakanie, sabotuje całą pracę. W tym tygodniu ustanawiasz spójność rodziny.",
      wochenziele: [
        "Wszyscy członkowie rodziny znają zasadę.",
        "Niespójność jest zredukowana do 0.",
        "Goście są informowani z wyprzedzeniem.",
      ],
      tagesplan: "Odprawa rodzinna: cztery łapy = cześć, skakanie = ignorowanie. Włącz też dzieci. Kartka z zasadą przy wejściu dla gości. Poruszaj temat zasady kilka razy w tygodniu.",
      no_gos: [
        "Członkowie rodziny, którzy 'tylko raz' pozwolą na skakanie.",
        "Zapominać o informowaniu gości.",
        "Tolerować niekonsekwencję.",
      ],
      fortschritt: [
        "Rodzina współpracuje.",
        "Goście są informowani.",
        "Niespójność jest wyeliminowana.",
      ],
      exerciseIds: ["j-spazier-vorbeigaenger", "j-vier-pfoten-belohnen"],
    },
    {
      title: "Rutyna ponownego spotkania",
      schwerpunkt: "Powrót do domu jest często największą okazją do skakania. W tym tygodniu ustanawiamy spokojną rutynę ponownego spotkania: bez dramatu, bez skakania, spokojne cześć.",
      wochenziele: [
        "{dogName} podchodzi spokojnie do drzwi, bez skakania.",
        "Powitanie jest spokojne i kontrolowane.",
        "Podekscytowanie przy ponownym spotkaniu się zmniejsza.",
      ],
      tagesplan: "Wracasz do domu: gdy {dogName} skacze, ignoruj go 30 sek. Cztery łapy na ziemi: spokojne cześć. Nigdy nie witaj dramatycznie. Zdejmij buty, dopiero potem się zwróć.",
      no_gos: [
        "Dramatyczne 'Cześć, mój skarbie!' — wzmacnia podekscytowanie.",
        "Głaskać od razu, gdy pies skacze.",
        "Oczekiwać, że spokojne powitanie uda się od razu.",
      ],
      fortschritt: [
        "Rutyna ponownego spotkania staje się spokojna.",
        "Podekscytowanie się zmniejsza.",
        "Stajesz się spokojniejszy przy powrocie do domu.",
      ],
      exerciseIds: ["j-tuergaeste-routine", "j-sitz-als-gruess"],
    },
    // Pogłębienia 6-miesięczne
    {
      title: "Spotkania przy gościach",
      schwerpunkt: "W oparciu o poprzednie: stosuj przy gościach to, co jest opanowane przy rodzinie. Goście są szczegółowo instruowani, {dogName} musi SIEDZIEĆ, gdy gość wchodzi.",
      wochenziele: [
        "{dogName} pozostaje spokojny przy przyjmowaniu gości.",
        "Goście są poinformowani i współpracują.",
        "Przyjmowanie gości jest rutyną.",
      ],
      tagesplan: "Przed przyjęciem gości: poinformuj gości z wyprzedzeniem wiadomością: 'Proszę, ignoruj go przez pierwsze 5 min, musi nauczyć się siadać.' Dzwonek: koc lub SIAD. Gość wchodzi, nie zwraca uwagi na psa. Po 3-5 min spokoju: sygnał OK.",
      no_gos: [
        "Nie informować gości.",
        "Oczekiwać, że wszyscy goście współpracują bez wyjaśnienia.",
        "Dawać sygnał OK za wcześnie.",
      ],
      fortschritt: [
        "Przyjmowanie gości staje się rutynowe.",
        "{dogName} pozostaje spokojny przy przyjmowaniu.",
        "Czujesz się bardziej odprężony.",
      ],
      exerciseIds: ["j-tuergaeste-routine", "j-vier-pfoten-belohnen"],
    },
    {
      title: "Opanowanie spotkań na spacerze",
      schwerpunkt: "Skakanie na zewnątrz jest delikatną sprawą: nie każdy człowiek chce, by na niego skoczono. Ustanawiamy SIAD w pozycji przy nodze przy mijanych osobach.",
      wochenziele: [
        "{dogName} siada przy mijanych osobach w pozycji przy nodze.",
        "Na mijane osoby nikt nie skacze.",
        "Czujesz się przygotowany na spotkania na spacerze.",
      ],
      tagesplan: "Spacery z oczekiwaniem mijanych osób. Na widok człowieka (15m+): SIAD obok twojej nogi. Nagroda podczas mijania. Mijane osoby przechodzą obok, NIE wchodzą w interakcję z psem.",
      no_gos: [
        "Pozwalać mijanym osobom głaskać psa podczas skakania.",
        "Oczekiwać, że mijane osoby się na to zgodzą.",
        "Kontynuować przy stresie.",
      ],
      fortschritt: [
        "SIAD przy mijanych osobach staje się rutyną.",
        "Skakanie na zewnątrz się zmniejsza.",
        "Spacery wydają się bardziej kontrolowane.",
      ],
      exerciseIds: ["j-spazier-vorbeigaenger", "j-sitz-als-gruess"],
    },
    {
      title: "Koc dla trudnych gości",
      schwerpunkt: "Przy trudnych gościach (dzieci, osoby lękliwe, osoby starsze) {dogName} należy na koc. Jasne oddzielenie, żadnego ryzyka.",
      wochenziele: [
        "{dogName} pozostaje na kocu przy trudnych gościach.",
        "Ryzykowne spotkania są unikane.",
        "Czujesz się odpowiedzialnie przygotowany.",
      ],
      tagesplan: "Przy dzieciach, lękliwych gościach lub osobach starszych: {dogName} od razu odprowadź na koc. Zostaw na kocu także podczas wizyty. Nagroda z Kongiem. W razie potrzeby: oddzielenie w innym pokoju.",
      no_gos: [
        "Oczekiwać, że wszyscy goście tolerują psa.",
        "Wymuszać ryzykowne spotkania.",
        "Zostawiać {dogName} bez kontroli przy lękliwych gościach.",
      ],
      fortschritt: [
        "Ryzykowne spotkania są unikane.",
        "Rutyna z kocem jest odporna.",
        "Działasz odpowiedzialnie.",
      ],
      exerciseIds: ["j-tuergaeste-routine", "j-tuergaeste-routine"],
    },
    {
      title: "Utrwalenie fundamentu",
      schwerpunkt: "Ostatni tydzień fundamentu. Rutyna czterech łap opanowana, SIAD jako powitanie, spójność rodziny, przyjmowanie gości. Faza 2 = więcej stosowania.",
      wochenziele: [
        "Wszystkie elementy są opanowane.",
        "Skakanie jest wyraźnie zmniejszone.",
        "Czujesz się kompetentny.",
      ],
      tagesplan: "Podsumowanie: co jest opanowane, co się chwieje? Jeśli słabość: 1 dodatkowy tydzień. Faza 2 = jeszcze więcej stosowania w prawdziwych sytuacjach.",
      no_gos: [
        "Rozluźniać spójność.",
        "Ignorować słabości.",
        "Traktować sukcesy jako oczywistość.",
      ],
      fortschritt: [
        "Czujesz się kompetentny.",
        "Narzędzia są opanowane.",
        "Skakanie jest rzadsze.",
      ],
      exerciseIds: ["j-vier-pfoten-belohnen", "j-sitz-als-gruess"],
    },
  ],
  steigerung: [
    {
      title: "Spójność w większej liczbie sytuacji",
      schwerpunkt: "W tym tygodniu stosujesz zasady w jeszcze większej liczbie sytuacji: rano przy wstawaniu, przy karmieniu, przy zabawie. Skakanie samo ustępuje.",
      wochenziele: [
        "Zasada czterech łap w 5+ sytuacjach dziennie.",
        "Skakanie zmniejsza się w wielu obszarach.",
        "Stajesz się odruchowo konsekwentny.",
      ],
      tagesplan: "Stosuj aktywnie: rano przy wstawaniu, przed spacerem, przed karmieniem, przy zabawie, przy powrocie do domu. Każdy skok jest ignorowany, każde stanie na czterech łapach jest nagradzane.",
      no_gos: [
        "Rozluźniać zasadę zależnie od sytuacji.",
        "Usprawiedliwiać się ('jest po prostu podekscytowany').",
        "Pomijać spójność z powodu pośpiechu.",
      ],
      fortschritt: [
        "Spójność rośnie.",
        "Skakanie zmniejsza się w wielu obszarach.",
        "Stajesz się wewnętrznie bardziej konsekwentny.",
        "Przy mijanych osobach {dogName} coraz częściej sam siada przy twojej nodze.",
      ],
      exerciseIds: ["j-vier-pfoten-belohnen", "j-spazier-vorbeigaenger"],
    },
    {
      title: "Rozszerzona sekwencja przy gościach",
      schwerpunkt: "Przy kilku gościach naraz robi się złożenie. W tym tygodniu ustanawiamy sekwencję przy gościach także w grupach.",
      wochenziele: [
        "{dogName} radzi sobie spokojnie z wizytą grupy.",
        "Koc jest kotwicą także przy podekscytowaniu.",
        "Planujesz w sposób uporządkowany.",
      ],
      tagesplan: "Zaplanuj świadomie wizyty grupowe (3-4 osoby). {dogName} od razu na koc. Wszyscy goście są poinformowani. Faza powitania 5-10 min, w której {dogName} pozostaje na kocu. Dopiero potem sygnał OK.",
      no_gos: [
        "Kilka nieznanych osób bez wcześniejszej informacji.",
        "Sygnał OK za wcześnie.",
        "Koc bez wcześniejszego warunkowania.",
      ],
      fortschritt: [
        "Wizyty grupowe są opanowane.",
        "Rutyna z kocem jest odporna.",
        "Czujesz się bardziej odprężony przy grupach.",
      ],
      exerciseIds: ["j-tuergaeste-routine", "j-sitz-als-gruess"],
    },
    {
      title: "SIAD na sygnał w prawdziwym otoczeniu",
      schwerpunkt: "SIAD jako standardowe powitanie nie jest już odwoływany — {dogName} oferuje je automatycznie. Częstotliwość nagradzania można zmniejszyć.",
      wochenziele: [
        "{dogName} siada automatycznie przy powitaniach.",
        "Nie musisz już aktywnie mówić SIAD.",
        "Częstotliwość nagradzania się zmniejsza.",
      ],
      tagesplan: "Przy powitaniach odczekaj 2-3 sek — czy {dogName} oferuje SIAD? Jeśli tak: od razu głaskanie, czasem smakołyk. Jeśli nie: powiedz SIAD. Przez tygodnie ustanawia się automatyzm.",
      no_gos: [
        "Głaskać przy pozostawaniu w staniu.",
        "Zmniejszać częstotliwość nagradzania za szybko.",
        "Oczekiwać, że utrzyma się bez odświeżania.",
      ],
      fortschritt: [
        "SIAD jest oferowany automatycznie.",
        "Częstotliwość nagradzania spada.",
        "Czujesz się bardziej odprężony.",
      ],
      exerciseIds: ["j-vier-pfoten-belohnen", "j-konsistenz-familie"],
    },
    {
      title: "Utrwalanie spotkań na spacerze",
      schwerpunkt: "SIAD przy mijanych osobach staje się rutyną. {dogName} siada automatycznie, gdy zbliżają się ludzie.",
      wochenziele: [
        "Automatyczny SIAD przy mijanych osobach.",
        "Skakanie na zewnątrz jest niemal wyeliminowane.",
        "Spacery są bardziej odprężone.",
      ],
      tagesplan: "Podczas każdego spaceru aktywnie sekwencje SIAD przy każdym spotkaniu. Nagroda. Przy braku automatycznego SIAD: daj sygnał. Gdy automatyczny: SUPER-nagroda.",
      no_gos: [
        "Pozwalać mijanym osobom głaskać psa podczas stania.",
        "Oczekiwać, że wszyscy współpracują.",
        "Kontynuować przy stresie.",
      ],
      fortschritt: [
        "Automatyczny SIAD zostaje ustanowiony.",
        "Spotkania na spacerze są kontrolowane.",
        "Czujesz się kompetentny.",
      ],
      exerciseIds: ["j-spazier-vorbeigaenger", "j-sitz-als-gruess"],
    },
    // Pogłębienia
    {
      title: "Kontrolowana zabawa",
      schwerpunkt: "Podczas zabawy skakanie jest często dozwolone (lub pożądane). W tym tygodniu różnicujemy: zabawa = wolno, powitanie = nie wolno. Jasne sygnały.",
      wochenziele: [
        "{dogName} odróżnia skakanie w zabawie od skakania na powitanie.",
        "Jasne sygnały dla obu trybów.",
        "Zabawa pozostaje dozwolona, skakanie na powitanie jest powstrzymywane.",
      ],
      tagesplan: "Przed zabawą: jasny sygnał 'BIEGNIJ' lub 'ZABAWA' — teraz wolno skakać. Przed powitaniem: jasny sygnał 'CICHO' — teraz nie. Konsekwencja z oboma sygnałami.",
      no_gos: [
        "Dawać sygnały niespójnie.",
        "Zabawa podczas sytuacji powitalnej.",
        "Oczekiwać, że pies sam różnicuje bez sygnału.",
      ],
      fortschritt: [
        "{dogName} odróżnia tryby.",
        "Zabawa pozostaje dozwolona.",
        "Ustanowiłeś jasne sygnały.",
      ],
      exerciseIds: ["j-vier-pfoten-belohnen", "j-tuergaeste-routine"],
    },
    {
      title: "Doskonalenie rutyny powitania",
      schwerpunkt: "Rutyna ponownego spotkania staje się stałą sekwencją. Drzwi się otwierają, buty zdjęte, spokojne cześć. {dogName} dokładnie wie, co nastąpi.",
      wochenziele: [
        "Rutyna ponownego spotkania jest wćwiczona.",
        "Podekscytowanie przy powrocie do domu jest minimalne.",
        "Stajesz się wewnętrznie spokojny przy powrocie do domu.",
      ],
      tagesplan: "Przy każdym powrocie do domu ta sama sekwencja: drzwi otwarte, ignoruj psa, buty zdjęte, kurtka zdjęta. Potem spokojnie się zwróć, gdy cztery łapy są na ziemi. {dogName} uczy się: ten przebieg to standard.",
      no_gos: [
        "Spontanicznie odbiegać.",
        "Dramatyczne cześć przy stresującym dniu.",
        "Członkowie rodziny, którzy współpracują, ale niekonsekwentnie.",
      ],
      fortschritt: [
        "Rutyna ponownego spotkania jest standardem.",
        "Stajesz się spokojniejszy przy powrocie do domu.",
        "{dogName} pozostaje odprężony.",
      ],
      exerciseIds: ["j-spazier-vorbeigaenger", "j-sitz-als-gruess"],
    },
    {
      title: "Koc jako kotwica w sytuacjach stresowych",
      schwerpunkt: "Gdy grożą stresowe spotkania (kilka psów, wielu gości): koc jest kotwicą. {dogName} może na nim pozostać zamiast interweniować.",
      wochenziele: [
        "Koc jako kotwica w sytuacjach stresowych.",
        "{dogName} aktywnie szuka koca.",
        "Stresowe spotkania są rozładowywane.",
      ],
      tagesplan: "Przy stresowym spotkaniu: {dogName} aktywnie odprowadź na koc z Kongiem. Pozostaje tam podczas trudnej fazy. Nagroda ze słowem-markerem wyciszenia.",
      no_gos: [
        "Stresowe spotkania bez przygotowania.",
        "Koc bez wcześniejszego pozytywnego warunkowania.",
        "Zmuszać {dogName} do pozostania.",
      ],
      fortschritt: [
        "Koc jako kotwica działa.",
        "Stresowe spotkania są rozładowane.",
        "{dogName} sam się reguluje.",
      ],
      exerciseIds: ["j-tuergaeste-routine", "j-vier-pfoten-belohnen"],
    },
    {
      title: "Utrwalenie fazy zwiększania",
      schwerpunkt: "Ostatni tydzień fazy zwiększania. Skakanie jest wyraźnie zmniejszone, rutyny powitania są opanowane. Faza 3 = długoterminowe stosowanie i stabilizacja.",
      wochenziele: [
        "Skakanie jest wyraźnie zmniejszone.",
        "Rutyny powitania działają płynnie.",
        "Czujesz się kompetentny.",
      ],
      tagesplan: "Podsumowanie: co działa świetnie? Gdzie zdarzają się jeszcze nawroty? Zanotuj strategie podtrzymania na fazę 3.",
      no_gos: [
        "Traktować sukcesy jako oczywistość.",
        "Rozluźniać spójność.",
        "Zaniedbywać spójność rodziny.",
      ],
      fortschritt: [
        "Skakanie jest rzadsze.",
        "Czujesz się kompetentny.",
        "Narzędzia są opanowane.",
      ],
      exerciseIds: ["j-sitz-als-gruess", "j-konsistenz-familie"],
    },
  ],
  generalisierung: [
    {
      title: "Ustanowienie rutyny podtrzymania",
      schwerpunkt: "Skakanie może wrócić, gdy spójność słabnie. Rutyna podtrzymania na kolejne miesiące: 1x dziennie świadomie ćwicz powitania.",
      wochenziele: [
        "Masz codzienną rutynę podtrzymania.",
        "Ćwiczenie ponownego spotkania jest robione regularnie.",
        "Rozpoznajesz regresy wcześnie.",
      ],
      tagesplan: "Dziennie 1 świadome ćwiczenie powitania: wyjdź z pokoju, wróć spokojnie. SIAD + głaskanie + smakołyk. Przy skakaniu: 30 sek ignorowania. Aktywnie utrzymuj, zamiast liczyć na szczęście.",
      no_gos: [
        "Zaniedbywać rutynę.",
        "Ignorować regresy.",
        "Rozluźniać spójność rodziny.",
      ],
      fortschritt: [
        "Rutyna podtrzymania jest ustanowiona.",
        "Regresy są wykrywane wcześnie.",
        "{dogName} pozostaje długoterminowo stabilny.",
        "Przyjmowanie gości przebiega jako wćwiczona sekwencja, bez dramatu.",
      ],
      exerciseIds: ["j-wartungs-routine", "j-tuergaeste-routine"],
    },
    {
      title: "Testy stresowe",
      schwerpunkt: "Co 2-3 tygodnie: świadomy test stresowy z nowymi osobami. Jak reaguje {dogName}? Czy rutyna SIAD pozostaje stabilna, czy znów skacze?",
      wochenziele: [
        "{dogName} radzi sobie z testami stresowymi.",
        "Rozpoznajesz słabe punkty wcześnie.",
        "Korygujesz w razie potrzeby.",
      ],
      tagesplan: "Zaplanuj 1-2 razy w miesiącu test stresowy: kurier, nieznany gość, kilka osób naraz. Obserwuj. Przy skakaniu: 1 tydzień dodatkowej konsekwencji.",
      no_gos: [
        "Unikać testów stresowych — prawdziwa reaktywność pozostaje ukryta.",
        "Ignorować przy nawrocie.",
        "Robić testy stresowe zbyt trudnymi.",
      ],
      fortschritt: [
        "Masz dane o odporności.",
        "Nawroty są rozpoznawane.",
        "Zachowanie {dogName} jest przetestowane jako stabilne.",
      ],
      exerciseIds: ["j-tuergaeste-routine", "j-sitz-als-gruess"],
    },
    {
      title: "Spójność rodziny długoterminowo",
      schwerpunkt: "Spójność rodziny wymaga regularnego przypominania. W tym tygodniu odświeżasz zasady, poruszasz je, zwracasz uwagę na nową niespójność.",
      wochenziele: [
        "Rodzina jest na bieżąco.",
        "Nowa niespójność jest unikana.",
        "Stajesz się uważniejszym obserwatorem.",
      ],
      tagesplan: "Powtórz odprawę rodzinną. Zaktualizuj kartkę przy wejściu. Aktywnie zwracaj uwagę na nowe niespójności: dziecko głaszcze w skoku? Gość pozwala na siebie skakać? Od razu reaguj.",
      no_gos: [
        "Tolerować członków rodziny, którzy nie współpracują.",
        "Zapominać o odprawach.",
        "Milczeć przy niespójności.",
      ],
      fortschritt: [
        "Spójność rodziny pozostaje wysoka.",
        "Nowe niespójności są wykrywane wcześnie.",
        "{dogName} pozostaje stabilny.",
      ],
      exerciseIds: ["j-konsistenz-familie", "j-vier-pfoten-belohnen"],
    },
    {
      title: "Opanowanie trudnych spotkań",
      schwerpunkt: "W tym tygodniu świadomie trudne spotkania: osoby lękliwe, dzieci, osoby starsze. Koc + dystans zamiast konfrontacji.",
      wochenziele: [
        "Trudne spotkania są zaplanowane z wyprzedzeniem.",
        "Koc pozostaje kotwicą.",
        "Czujesz się odpowiedzialnie przygotowany.",
      ],
      tagesplan: "Przy spodziewanych trudnych spotkaniach: {dogName} wcześniej na koc. Zachowaj dystans. Jeśli konieczne: inny pokój. Nigdy nie wymuszaj.",
      no_gos: [
        "Trudne spotkania bez przygotowania.",
        "Zaskakiwać dzieci lub osoby lękliwe.",
        "Zostawiać {dogName} bez kontroli przy lękliwych osobach.",
      ],
      fortschritt: [
        "Trudne spotkania są opanowane.",
        "Działasz odpowiedzialnie.",
        "Ryzykowne sytuacje są unikane.",
      ],
      exerciseIds: ["j-tuergaeste-routine", "j-sitz-als-gruess"],
    },
    {
      title: "Ostrożna redukcja nagradzania",
      schwerpunkt: "Powitanie z SIAD staje się tak oczywiste, że można zmniejszyć gęstość nagradzania. Ale: zmienne wzmocnienie utrzymuje zachowanie stabilniej.",
      wochenziele: [
        "Częstotliwość nagradzania zmniejszona do ~50%.",
        "{dogName} siada także przy mniejszej ilości nagród.",
        "Wybitne osiągnięcia są dalej nagradzane jackpotem.",
      ],
      tagesplan: "Przy powitaniach rodzinnych: smakołyk co 2-3 razy zamiast za każdym razem. Przy gościach: nadal nagroda za każdym razem. {dogName} zauważa: system pozostaje, ale jest nieprzewidywalny.",
      no_gos: [
        "Całkowicie skreślać nagrodę.",
        "Zmniejszać nagrodę przy gościach.",
        "Rozluźniać zmienność.",
      ],
      fortschritt: [
        "{dogName} siada także przy mniejszej ilości nagród.",
        "SIAD jest automatyczny.",
        "Wkładasz do kieszeni mniej smakołyków.",
      ],
      exerciseIds: ["j-vier-pfoten-belohnen", "j-konsistenz-familie"],
    },
    {
      title: "Utrwalanie rutyny spacerowej",
      schwerpunkt: "SIAD przy mijanych osobach staje się standardem. Nie musisz już aktywnie mówić SIAD — {dogName} oferuje go, gdy zbliżają się ludzie.",
      wochenziele: [
        "{dogName} oferuje SIAD automatycznie.",
        "Mijane osoby są mijane spokojnie.",
        "Spacery wydają się kontrolowane.",
      ],
      tagesplan: "Podczas każdego spaceru aktywnie obserwuj: czy {dogName} oferuje SIAD automatycznie? Przy automatycznym SIAD: SUPER-nagroda. Przy staniu: daj sygnał SIAD.",
      no_gos: [
        "Pozwalać mijanym osobom głaskać podczas stania.",
        "Spacery bez obserwacji.",
        "Oczekiwanie automatyzmu bez dalszego nagradzania.",
      ],
      fortschritt: [
        "Automatyczny SIAD jest ustanowiony.",
        "Spotkania na spacerze są spokojne.",
        "Czujesz się kompetentny.",
      ],
      exerciseIds: ["j-spazier-vorbeigaenger", "j-sitz-als-gruess"],
    },
    {
      title: "Plan awaryjny przy nawrotach",
      schwerpunkt: "Jeśli skakanie wróci: jasna sekwencja awaryjna. 1 tydzień dodatkowej konsekwencji, odprawa rodzinna, gęstość nagradzania znów wysoka.",
      wochenziele: [
        "Masz plan awaryjny.",
        "Regresy są wykrywane wcześnie.",
        "Nawroty są wyłapywane w 1-2 tygodnie.",
      ],
      tagesplan: "Plan awaryjny: 1) 1 tydzień dodatkowej konsekwencji z ignorowaniem. 2) powtórzenie odprawy rodzinnej. 3) gęstość nagradzania znów wysoka. 4) obserwacja, co się zmieniło.",
      no_gos: [
        "Ignorować regresy.",
        "Wpadać w panikę.",
        "Radykalnie zmieniać rutyny.",
      ],
      fortschritt: [
        "Plan awaryjny jest opanowany.",
        "Nawroty są zarządzane.",
        "Czujesz się długoterminowo kompetentny.",
      ],
      exerciseIds: ["j-vier-pfoten-belohnen", "j-konsistenz-familie"],
    },
    {
      title: "Przejście w tryb podtrzymania",
      schwerpunkt: "Ostatni tydzień. Skakanie jest mocno zmniejszone, rutyny są opanowane, spójność rodziny stabilna. Podtrzymanie na kolejne miesiące.",
      wochenziele: [
        "Wszystkie rutyny działają długoterminowo.",
        "Rytm podtrzymania jest jasny.",
        "{dogName} jest długoterminowo stabilny.",
      ],
      tagesplan: "Zredukuj aktywny trening do minimum. Rutyna podtrzymania 1x dziennie. Odprawa rodzinna co 3 miesiące. Testy stresowe co 4-6 tygodni. Przy nawrotach: zastosuj plan awaryjny.",
      no_gos: [
        "Nagle porzucać wszystkie rutyny.",
        "Rozluźniać spójność rodziny.",
        "Zaniedbywać podtrzymanie.",
      ],
      fortschritt: [
        "Skakanie jest wyjątkiem.",
        "{dogName} pozostaje długoterminowo stabilny.",
        "Czujesz się kompetentny.",
      ],
      exerciseIds: ["j-wartungs-routine", "j-tuergaeste-routine"],
    },
  ],
};

const DESTRUCTIVE_WEEKS: Record<Phase, WeekTemplate[]> = {
  fundament: [
    {
      title: "Analiza przyczyn: dlaczego {dogName} niszczy?",
      schwerpunkt: "Niszczenie ma różne przyczyny, które wymagają różnych rozwiązań. W tym tygodniu ustalasz główny powód: nuda, lęk separacyjny, potrzeba gryzienia albo zmiana uzębienia.",
      wochenziele: [
        "Znasz główny powód niszczenia.",
        "Rozumiesz, co jest środkiem pomocniczym, a co objawem.",
        "Masz jasno określony główny punkt treningu.",
      ],
      tagesplan: "Przez tydzień dokumentuj: co jest niszczone? Kiedy? Ile lat ma {dogName}? Jakie ma zajęcie? Jak zachowuje się w czasie sam na sam? Ustal główną przyczynę: nuda, lęk separacyjny albo potrzeba gryzienia.",
      no_gos: [
        "Zaczynać trening bez znajomości przyczyny.",
        "Mieszać przyczyny.",
        "Zwalczać objawy zamiast przyczyn.",
      ],
      fortschritt: [
        "Znasz przyczynę.",
        "Wiesz, który obszar trzeba trenować.",
        "Jesteś gotowy do ukierunkowanej pracy.",
        "Pierwsze 4-5 dozwolonych gryzaków / przedmiotów do gryzienia jest kupione i w rotacji.",
      ],
      exerciseIds: ["d-ursachen-analyse", "d-kauobjekte-etablieren"],
    },
    {
      title: "Wprowadzenie dozwolonych gryzaków / przedmiotów do gryzienia",
      schwerpunkt: "{dogName} ma potrzebę gryzienia, którą trzeba zaspokoić. Zamiast ją tłumić, kierujemy ją na DOZWOLONE przedmioty. 4-5 różnych, w rotacji.",
      wochenziele: [
        "Dostępne są 4-5 różnych gryzaków / przedmiotów do gryzienia.",
        "Rotacja jest wprowadzona.",
        "{dogName} ma jasną listę tego, co wolno.",
      ],
      tagesplan: "Zainwestuj w 4-5 gryzaków / przedmiotów do gryzienia: naturalne przysmaki do gryzienia (skóra bawola, penis wołowy), Kong, mata węchowa, drewniana kość, poroże. Dziennie 1-2 różne, w rotacji. Wprowadź długie sesje gryzienia.",
      no_gos: [
        "Tylko 1 gryzak — robi się nudny.",
        "Wszystkie przedmioty dostępne naraz — brak atrakcyjności.",
        "Tanie kości do gryzienia (surowa skóra) — ryzyko urazu.",
      ],
      fortschritt: [
        "{dogName} ma ulubione gryzaki / przedmioty do gryzienia.",
        "Potrzeba gryzienia jest ukierunkowana.",
        "Niszczenie się zmniejsza.",
        "Bezpieczne strefy zarządzania na czas nieobecności są urządzone.",
      ],
      exerciseIds: ["d-langeweile-auslasten", "d-management-zonen"],
    },
    {
      title: "Urządzanie stref zarządzania",
      schwerpunkt: "Dopóki trening nie jest ugruntowany, pomaga zarządzanie. {dogName} nie ma możliwości zniszczyć butów ani mebli — bo są niedostępne.",
      wochenziele: [
        "Bezpieczne strefy są urządzone.",
        "Obszary ryzyka są zablokowane.",
        "{dogName} podczas nieobecności nie przebywa w strefach ryzyka.",
      ],
      tagesplan: "Zidentyfikuj strefy ryzyka. Podczas nieobecności lub braku nadzoru: {dogName} w bezpiecznej strefie (kojec, kuchnia z bramką zabezpieczającą). W tej strefie: dozwolone gryzaki / przedmioty do gryzienia + woda. Nigdy jako kara.",
      no_gos: [
        "Bezpieczna strefa jako więzienie.",
        "Zostawiać strefy ryzyka otwarte z wygody.",
        "Puszczać psa luzem, gdy ryzyko jest nieprzewidywalne.",
      ],
      fortschritt: [
        "Bezpieczna strefa jest wprowadzona.",
        "Niszczenie jest zapobiegane.",
        "Działasz odpowiedzialnie.",
      ],
      exerciseIds: ["d-ursachen-analyse", "d-kauobjekte-etablieren"],
    },
    {
      title: "Wprowadzenie zamiany zamiast kary",
      schwerpunkt: "Gdy {dogName} ma zakazany przedmiot: zamiana jest właściwą reakcją, nie kara. Spokojnie podejść, zaproponować smakołyk, dokonać zamiany.",
      wochenziele: [
        "Zamiana jest standardową reakcją na zakazany przedmiot.",
        "Eskalacji konfliktów się unika.",
        "Stajesz się wewnętrznie spokojniejszy.",
      ],
      tagesplan: "{dogName} ma zakazany przedmiot: NIE krzycz, NIE goń. Spokojnie podejdź, PUŚĆ, wartościowy smakołyk. Zamiana. Zaproponuj dozwolony gryzak / przedmiot do gryzienia. Nigdy nie oddawaj zakazanego przedmiotu.",
      no_gos: [
        "Zrzędzenie — działa odwrotnie.",
        "Gonienie — wzmacnia zabawę.",
        "Oddawanie zakazanego przedmiotu.",
      ],
      fortschritt: [
        "{dogName} dobrowolnie oddaje zakazane przedmioty.",
        "Stajesz się wewnętrznie spokojniejszy.",
        "Konfliktów się unika.",
      ],
      exerciseIds: ["d-tausch-statt-strafe", "d-management-zonen"],
    },
    // Pogłębienia dla planu 6-miesięcznego
    {
      title: "Podwojenie zajęcia",
      schwerpunkt: "Jeśli przyczyną jest nuda (często u młodych psów): mieszanka zajęć. Ruch + praca głową + praca węchowa, nie tylko ruch.",
      wochenziele: [
        "Plan dnia z mieszanym zajęciem jest gotowy.",
        "Co najmniej 3 rodzaje zajęcia dziennie.",
        "{dogName} wieczorem jest zmęczony, nie pobudzony.",
      ],
      tagesplan: "Dziennie: 1 spacer (30-60 min ze zmianami tempa), 1 praca węchowa (zabawa w szukanie), 1 praca głową (trik, Kong). Jeśli młody: mniej bezmyślnego szaleństwa, więcej pracy głową. Jeśli dorosły: więcej tropienia.",
      no_gos: [
        "Tylko ruch jako zajęcie — prowadzi do przepobudzenia.",
        "Wielogodzinne szaleństwa — działają odwrotnie.",
        "Praca węchowa / praca głową jako 'opcjonalne'.",
      ],
      fortschritt: [
        "{dogName} wieczorem jest spokojny.",
        "Niszczenie mierzalnie się zmniejsza.",
        "Masz rutynę zajęcia.",
        "Gdy zauważasz zakazane przedmioty, reagujesz spokojną zamianą zamiast konfliktem.",
      ],
      exerciseIds: ["d-langeweile-auslasten", "d-ursachen-analyse"],
    },
    {
      title: "Długie fazy leżenia",
      schwerpunkt: "Część niszczenia bierze się z nieumiejętności siedzenia w spokoju. {dogName} musi nauczyć się aktywnie utrzymywać długie fazy spokoju — nawet gdy nic się nie dzieje.",
      wochenziele: [
        "{dogName} pozostaje 30-60 min odprężony na kocu.",
        "Trenuje się siedzenie w spokoju.",
        "Uczy się bycia sam na sam ze sobą.",
      ],
      tagesplan: "Dziennie 1-2 sesje na kocu: 30-60 min na kocu, ty pracujesz obok. {dogName} nie może wstawać, dostaje Kong jako zajęcie. Nagroda za spokojne leżenie.",
      no_gos: [
        "Ciągle stymulować {dogName} podczas sesji na kocu.",
        "Koc bez wcześniejszego wypracowania skojarzenia.",
        "Zbyt krótkie sesje — nie działają.",
      ],
      fortschritt: [
        "{dogName} pozostaje spokojny dłużej.",
        "Siedzenie w spokoju staje się oczywistością.",
        "Niszczenie z nudy się zmniejsza.",
      ],
      exerciseIds: ["d-management-zonen", "d-allein-zeit-kong"],
    },
    {
      title: "Kong na czas samotności w przypadkach lęku separacyjnego",
      schwerpunkt: "Jeśli współprzyczyną jest lęk separacyjny: dobrze wypełniony Kong przed każdą nieobecnością. 30 min zajęcia pomaga przetrwać krytyczną fazę.",
      wochenziele: [
        "{dogName} zaczyna zajmować się Kongiem, gdy wychodzisz.",
        "Niszczenie podczas samotności się zmniejsza.",
        "Pozytywne skojarzenie nieobecność–Kong.",
      ],
      tagesplan: "Przed każdą nieobecnością: dobrze wypełniony Kong (zamrożony = trudniejszy). Wychodź bez dramatu. Zabierz Kong po powrocie. Wariant: mata węchowa z suchą karmą.",
      no_gos: [
        "Dawać Kong także pod swoją obecność.",
        "Kong niezamrożony — zbyt szybko skończony.",
        "Dramatyczne pożegnania / powitania.",
      ],
      fortschritt: [
        "Niszczenie podczas samotności się zmniejsza.",
        "Pozytywne skojarzenie jest wypracowane.",
        "Czujesz się bardziej odprężony przy wychodzeniu.",
      ],
      exerciseIds: ["d-ursachen-analyse", "d-kauobjekte-etablieren"],
    },
    {
      title: "Sprawdzenie fundamentu",
      schwerpunkt: "Ostatni tydzień fundamentu. Przyczyna jasna, gryzaki wprowadzone, strefy zarządzania bezpieczne, rutyna zamiany działa. Faza 2 = więcej zajęcia i rutyn.",
      wochenziele: [
        "Wszystkie elementy działają.",
        "Niszczenie jest mierzalnie zmniejszone.",
        "Czujesz się kompetentny.",
      ],
      tagesplan: "Podsumowanie: co działa świetnie, co się chwieje? Jeśli słabość: 1 dodatkowy tydzień. Faza 2 = jeszcze więcej zajęcia i utrwalanie rutyn.",
      no_gos: [
        "Z niecierpliwości przeskakiwać do fazy 2.",
        "Ignorować słabości.",
        "Rozluźniać zarządzanie.",
      ],
      fortschritt: [
        "Czujesz się kompetentny.",
        "Narzędzia działają.",
        "Niszczenie zdarza się rzadziej.",
      ],
      exerciseIds: ["d-management-zonen", "d-tausch-statt-strafe"],
    },
  ],
  steigerung: [
    {
      title: "Wdrożenie planu zajęcia",
      schwerpunkt: "Uporządkowany plan dnia z mieszanym zajęciem staje się rutyną. Ruch + praca węchowa + praca głową + spokój w jasnym podziale.",
      wochenziele: [
        "Plan zajęcia jest spisany.",
        "Plan jest realizowany codziennie.",
        "{dogName} jest bardziej zrównoważony.",
      ],
      tagesplan: "Napisz plan na 7 dni: dziennie 1 ruch, 1 praca węchowa, 1 praca głową. Więcej zajęcia w trudne dni. Higiena snu 16-20 h. Kontakt społeczny 2-3x w tygodniu.",
      no_gos: [
        "Plan bez spisania — zostaje zapomniany.",
        "Robić inaczej w weekendy.",
        "Pomijać zajęcie w pośpiechu.",
      ],
      fortschritt: [
        "{dogName} jest bardziej zrównoważony.",
        "Niszczenie zmniejsza się dalej.",
        "Planujesz w sposób uporządkowany.",
      ],
      exerciseIds: ["d-langeweile-auslasten", "d-kauobjekte-etablieren"],
    },
    {
      title: "Dopracowanie rotacji gryzaków / przedmiotów do gryzienia",
      schwerpunkt: "Rotacja gryzaków / przedmiotów do gryzienia staje się codzienną rutyną. {dogName} jest zawsze zajęty, potrzeba gryzienia stale zaspokojona.",
      wochenziele: [
        "Rotacja gryzaków / przedmiotów do gryzienia działa automatycznie.",
        "{dogName} ma zawsze dostępny ulubiony gryzak / przedmiot do gryzienia.",
        "Potrzeba gryzienia jest zaspokojona.",
      ],
      tagesplan: "Codziennie dostępne 1-2 gryzaki / przedmioty do gryzienia, w rotacji. Co tydzień testuj 1 nowy przedmiot. Świadomie wprowadzaj długie sesje gryzienia (15-30 min) — przygotowanie do snu.",
      no_gos: [
        "Zapominać o rotacji.",
        "Gryzaki / przedmioty do gryzienia słabej jakości.",
        "Traktować długie sesje jako 'stracony czas'.",
      ],
      fortschritt: [
        "{dogName} ma ulubiony zestaw.",
        "Potrzeba gryzienia jest zaspokojona.",
        "Niszczenie mebli się zmniejsza.",
      ],
      exerciseIds: ["d-ursachen-analyse", "d-management-zonen"],
    },
    {
      title: "Powolne ograniczanie zarządzania",
      schwerpunkt: "Gdy przez 4 tygodnie nie dochodzi do niszczenia: ostrożnie ograniczaj zarządzanie. Najpierw 1 strefa ryzyka, obserwuj, potem następna.",
      wochenziele: [
        "Jedna strefa ryzyka staje się znów dostępna.",
        "{dogName} się sprawdza albo korygujesz.",
        "Rozpoznajesz, gdzie zarządzanie musi pozostać.",
      ],
      tagesplan: "Dzień 1-2: 1 wcześniej zablokowana strefa staje się znów dostępna (tylko pod obecność). Obserwuj. Dzień 3-4: przy sukcesie 1-2 godziny z dostępem. Dzień 5-7: przy sukcesie także dłużej.",
      no_gos: [
        "Otwierać wszystkie strefy ryzyka naraz.",
        "Kontynuować mimo niszczenia.",
        "Całkowicie rezygnować z zarządzania.",
      ],
      fortschritt: [
        "Bezpieczne strefy się poszerzają.",
        "{dogName} się sprawdza.",
        "Codzienność staje się bardziej elastyczna.",
      ],
      exerciseIds: ["d-langeweile-auslasten", "d-kauobjekte-etablieren"],
    },
    {
      title: "Dopracowanie rutyny zamiany",
      schwerpunkt: "Zamiana działa automatycznie. {dogName} dobrowolnie oddaje zakazane przedmioty. Reagujesz spokojnie i na luzie.",
      wochenziele: [
        "Zamiana udaje się niezawodnie w 90%+.",
        "Reagujesz spokojnie na zakazane przedmioty.",
        "Eskalacje konfliktów są wyeliminowane.",
      ],
      tagesplan: "Gdy zauważasz zakazany przedmiot: spokojnie podejdź, PUŚĆ, smakołyk, zamiana. Bez dramatu. Rutyna staje się reakcją odruchową.",
      no_gos: [
        "Zrzędzić z frustracji.",
        "Oddawać zakazany przedmiot.",
        "Sięgać ręką do pyska.",
      ],
      fortschritt: [
        "Zamiana udaje się odruchowo.",
        "Stajesz się wewnętrznie spokojny.",
        "Konflikty są rzadkie.",
      ],
      exerciseIds: ["d-tausch-statt-strafe", "d-ursachen-analyse"],
    },
    // Pogłębienia
    {
      title: "Intensyfikacja pracy umysłowej",
      schwerpunkt: "U młodych psów przy zmianie uzębienia: intensyfikuj sesje gryzienia. U dorosłych: więcej pracy głową (shaping, triki, nowe zadania).",
      wochenziele: [
        "Kilka intensywnych sesji gryzienia dziennie.",
        "Uczy się nowych trików metodą shapingu.",
        "Praca umysłowa jest intensywna.",
      ],
      tagesplan: "U szczeniąt / młodych psów: długie sesje gryzienia z naturalnymi przysmakami 2x dziennie. U dorosłych: 10 min treningu metodą swobodnego kształtowania z nowym trikiem dziennie. Celem jest zmęczenie umysłowe.",
      no_gos: [
        "Robić zbyt krótkie sesje gryzienia.",
        "Trening swobodnego kształtowania w fazach stresu.",
        "Traktować pracę umysłową jako 'opcjonalną'.",
      ],
      fortschritt: [
        "{dogName} jest umysłowo zajęty.",
        "Niszczenie zmniejsza się dalej.",
        "Rozpoznajesz fazy zmęczenia.",
      ],
      exerciseIds: ["d-langeweile-auslasten", "d-kauobjekte-etablieren"],
    },
    {
      title: "Redukcja czynników stresu",
      schwerpunkt: "Niszczenie może być objawem stresu. Zidentyfikuj czynniki stresu i aktywnie je ograniczaj: za mało snu, przebodźcowanie, niejasne rutyny.",
      wochenziele: [
        "Czynniki stresu są zidentyfikowane i ograniczone.",
        "{dogName} ma dość snu (16-20 h).",
        "Przebodźcowaniu się zapobiega.",
      ],
      tagesplan: "Sprawdź przebieg dnia: dość snu? Przewidywalne rutyny? Przebodźcowanie w weekendy? Ostatnie zmiany (przeprowadzka, nowy domownik)? Aktywnie ograniczaj.",
      no_gos: [
        "Ignorować stres.",
        "Ciągle stymulować psa.",
        "Wprowadzać zmiany radykalnie.",
      ],
      fortschritt: [
        "Poziom stresu spada.",
        "Niszczenie zmniejsza się dalej.",
        "Stajesz się uważniejszy na oznaki stresu.",
      ],
      exerciseIds: ["d-ursachen-analyse", "d-management-zonen"],
    },
    {
      title: "Utrwalanie rutyny na czas samotności",
      schwerpunkt: "Rutyna Konga na czas samotności zostaje wprowadzona długofalowo. {dogName} kojarzy nieobecność z pozytywną przekąską, nie z niszczeniem.",
      wochenziele: [
        "Rutyna na czas samotności jest stabilna.",
        "Kong podawany jest przed każdą nieobecnością.",
        "Niszczenie podczas nieobecności jest wyeliminowane.",
      ],
      tagesplan: "Przy każdej nieobecności Kong. Zmiana zawartości. Zamrożony = trudniejszy. Wychodź spokojnie, wracaj spokojnie. {dogName} pozostaje w tym czasie zajęty.",
      no_gos: [
        "Zapomnieć o Kongu — czas samotności bez zajęcia.",
        "Zawsze ta sama zawartość — robi się nudno.",
        "Dramat przy pożegnaniu.",
      ],
      fortschritt: [
        "Czas samotności jest bezpieczny.",
        "Rutyna Konga jest solidna.",
        "Czujesz się bardziej odprężony przy wychodzeniu.",
      ],
      exerciseIds: ["d-allein-zeit-kong", "d-kauobjekte-etablieren"],
    },
    {
      title: "Utrwalenie fazy wzmocnienia",
      schwerpunkt: "Ostatni tydzień fazy wzmocnienia. Zajęcie działa, rutyna gryzienia wprowadzona, zarządzanie rozluźnione. Faza 3 = długoterminowe utrzymanie.",
      wochenziele: [
        "Wszystkie narzędzia działają płynnie.",
        "Niszczenie jest wyraźnie zmniejszone.",
        "Czujesz się kompetentny.",
      ],
      tagesplan: "Tydzień podsumowania: co działa świetnie, co się chwieje? Zaplanuj fazę 3: rutyny podtrzymujące, higiena stresu, dalej plan zajęcia.",
      no_gos: [
        "Traktować sukcesy jako oczywiste.",
        "Całkowicie rezygnować z zarządzania.",
        "Rozluźniać plan zajęcia.",
      ],
      fortschritt: [
        "Niszczenie jest mierzalnie zmniejszone.",
        "Czujesz się kompetentny.",
        "Narzędzia działają.",
      ],
      exerciseIds: ["d-langeweile-auslasten", "d-ursachen-analyse"],
    },
  ],
  generalisierung: [
    {
      title: "Długoterminowy plan zajęcia",
      schwerpunkt: "Plan zajęcia zostaje wprowadzony długofalowo. Każdego dnia mieszane zajęcie, plus dni podtrzymujące z odświeżeniem.",
      wochenziele: [
        "Plan działa długofalowo.",
        "Dni podtrzymujące są zaplanowane.",
        "{dogName} pozostaje długofalowo zrównoważony.",
      ],
      tagesplan: "Dziennie standardowe zajęcie (ruch + węch + głowa). 1x w tygodniu 'dzień specjalny' z nowym trikiem lub nowym zajęciem. Utrzymuj stałą higienę snu.",
      no_gos: [
        "Rozluźniać plan.",
        "Zapominać o dniach specjalnych.",
        "Ignorować higienę snu.",
      ],
      fortschritt: [
        "Plan jest wprowadzony długofalowo.",
        "{dogName} pozostaje zrównoważony.",
        "Planujesz w sposób uporządkowany.",
        "Przed każdą nieobecnością jest dobrze wypełniony Kong jako pozytywne skojarzenie z czasem samotności.",
      ],
      exerciseIds: ["d-langeweile-auslasten", "d-allein-zeit-kong"],
    },
    {
      title: "Utrzymanie gryzaków / przedmiotów do gryzienia",
      schwerpunkt: "Zestaw gryzaków / przedmiotów do gryzienia jest utrzymywany: stare wymieniać, nowe wypróbowywać, trzymać rotację. Potrzeba gryzienia pozostaje zaspokojona.",
      wochenziele: [
        "Zestaw jest aktualny.",
        "{dogName} ma zawsze ulubione opcje.",
        "Potrzeba gryzienia pozostaje zaspokojona.",
      ],
      tagesplan: "Sprawdzaj co tydzień: które przedmioty są nadal chętnie używane? Które są zepsute lub zużyte? Wymień. Co 4-6 tygodni wypróbuj 1 nowy przedmiot.",
      no_gos: [
        "Pozwolić, by zestaw się zestarzał.",
        "Dalej używać uszkodzonych przedmiotów.",
        "Nie wprowadzać żadnej zmienności.",
      ],
      fortschritt: [
        "Zestaw jest aktualny.",
        "Potrzeba gryzienia pozostaje zaspokojona.",
        "{dogName} ma zawsze coś dla siebie.",
      ],
      exerciseIds: ["d-kauobjekte-etablieren", "d-management-zonen"],
    },
    {
      title: "Znalezienie równowagi w zarządzaniu",
      schwerpunkt: "Długoterminowa równowaga w zarządzaniu: co musi pozostać zamknięte, a co może być otwarte? Zachowanie {dogName} ci to pokazuje.",
      wochenziele: [
        "Znasz idealną równowagę w zarządzaniu.",
        "Bezpieczne strefy są jasno określone.",
        "Obszary ryzyka są mądrze obsługiwane.",
      ],
      tagesplan: "Sprawdź: które strefy mogą być trwale otwarte? Które wymagają blokady podczas nieobecności? Które są ogólnie niedostępne? Spisz to.",
      no_gos: [
        "Całkowicie rezygnować z zarządzania.",
        "Nie doceniać obszarów ryzyka.",
        "Porównywać z innymi psami.",
      ],
      fortschritt: [
        "Masz jasną strategię zarządzania.",
        "Ryzyko jest zminimalizowane.",
        "Codzienność przebiega odprężenie.",
      ],
      exerciseIds: ["d-ursachen-analyse", "d-tausch-statt-strafe"],
    },
    {
      title: "Radzenie sobie z trudnymi fazami",
      schwerpunkt: "Okresy dużego stresu (święta, urlop, nowi domownicy) to ryzyko nawrotu niszczenia. W tym tygodniu planujesz na trudne fazy.",
      wochenziele: [
        "Masz strategie na trudne fazy.",
        "Fazy ryzyka są zaplanowane z wyprzedzeniem.",
        "Czujesz się przygotowany.",
      ],
      tagesplan: "Zidentyfikuj nadchodzące fazy stresu. Zaplanuj z wyprzedzeniem: więcej zarządzania, więcej zajęcia, więcej gryzaków / przedmiotów do gryzienia. Przy zmianach: wprowadzaj stopniowo.",
      no_gos: [
        "Ignorować trudne fazy.",
        "Spontaniczne zmiany.",
        "Rozluźniać rutynę pod wpływem stresu.",
      ],
      fortschritt: [
        "Trudne fazy są opanowane.",
        "Planujesz z wyprzedzeniem.",
        "{dogName} pozostaje stabilny.",
      ],
      exerciseIds: ["d-management-zonen", "d-langeweile-auslasten"],
    },
    {
      title: "Równowaga między kontaktem społecznym a samotnością",
      schwerpunkt: "Psy z niszczeniem na tle lęku separacyjnego korzystają z dostatecznej ilości kontaktów społecznych. Ale: czas samotności też musi być dalej ćwiczony.",
      wochenziele: [
        "Spotkania towarzyskie 2-3x w tygodniu.",
        "Rutyna na czas samotności pozostaje wprowadzona.",
        "Równowaga między kontaktem społecznym a samotnością jest dobra.",
      ],
      tagesplan: "Co tydzień 2-3 spotkania towarzyskie (psi przyjaciel). Rutyna na czas samotności pozostaje: Kong przed nieobecnością. Utrzymuj równowagę — nie wyłącznie życie towarzyskie ani wyłącznie samotność.",
      no_gos: [
        "Tylko kontakt społeczny — rutyna samotności zapomniana.",
        "Tylko samotność — lęk separacyjny eskaluje.",
        "Fazy intensywnego życia towarzyskiego bez wyciszenia.",
      ],
      fortschritt: [
        "Równowaga jest wprowadzona.",
        "{dogName} jest towarzyski i niezależny.",
        "Planujesz w sposób uporządkowany.",
      ],
      exerciseIds: ["d-allein-zeit-kong", "d-kauobjekte-etablieren"],
    },
    {
      title: "Utrwalanie rutyny zamiany w codzienności",
      schwerpunkt: "Rutyna zamiany pozostaje długofalowo ważna. Nawet po miesiącach bez incydentu: pozostań uważny, reaguj spokojnie na zakazane przedmioty.",
      wochenziele: [
        "Zamiana pozostaje odruchowa.",
        "Na zakazane przedmioty reagujesz spokojnie.",
        "Eskalacje konfliktów są wyeliminowane.",
      ],
      tagesplan: "W rzadkich sytuacjach z zakazanym przedmiotem: spokojnie podejdź, PUŚĆ, smakołyk, zamiana. Trzymaj się rutyny, nawet jeśli {dogName} jest przeważnie grzeczny.",
      no_gos: [
        "Przereagowywać przy rzadkich incydentach.",
        "Zapominać rutynę zamiany.",
        "Sięgać ręką do pyska.",
      ],
      fortschritt: [
        "Rutyna zamiany pozostaje solidna.",
        "Stajesz się wewnętrznie spokojny.",
        "Konflikty są wyeliminowane.",
      ],
      exerciseIds: ["d-tausch-statt-strafe", "d-ursachen-analyse"],
    },
    {
      title: "Plan awaryjny przy nawrotach",
      schwerpunkt: "Jeśli niszczenie wraca: jasna sekwencja awaryjna. Sprawdzenie przyczyn, ponowne zacieśnienie zarządzania, zwiększenie zajęcia.",
      wochenziele: [
        "Masz plan awaryjny.",
        "Nawroty są wcześnie rozpoznawane.",
        "Opanowane w 1-2 tygodnie.",
      ],
      tagesplan: "Plan awaryjny: 1) Sprawdzenie przyczyn (co się zmieniło?). 2) Ponowne zacieśnienie zarządzania. 3) Zwiększenie zajęcia. 4) Odświeżenie zestawu gryzaków. 5) Redukcja czynników stresu.",
      no_gos: [
        "Ignorować nawroty.",
        "Wpadać w panikę.",
        "Kara jako reakcja.",
      ],
      fortschritt: [
        "Plan awaryjny działa.",
        "Nawroty są opanowane.",
        "Czujesz się kompetentny.",
      ],
      exerciseIds: ["d-langeweile-auslasten", "d-management-zonen"],
    },
    {
      title: "Przejście w tryb podtrzymania",
      schwerpunkt: "Ostatni tydzień. Niszczenie jest znacznie zmniejszone, rutyny działają, zajęcie jest wprowadzone. Podtrzymanie na najbliższe miesiące.",
      wochenziele: [
        "Wszystkie rutyny działają długofalowo.",
        "Rytm podtrzymania jest jasny.",
        "{dogName} jest długofalowo zrównoważony.",
      ],
      tagesplan: "Ogranicz aktywny trening do minimum. Plan zajęcia pozostaje. Rutyna gryzienia pozostaje. Zarządzanie pozostaje zależne od sytuacji. Co 4-6 tygodni odświeżenie.",
      no_gos: [
        "Nagle porzucać wszystkie rutyny.",
        "Całkowicie rezygnować z zarządzania.",
        "Zaniedbywać zajęcie.",
      ],
      fortschritt: [
        "{dogName} pozostaje długofalowo stabilny.",
        "Niszczenie jest wyjątkiem.",
        "Czujesz się kompetentny.",
      ],
      exerciseIds: ["d-ursachen-analyse", "d-kauobjekte-etablieren"],
    },
  ],
};

// ────────────────────────────────────────────────────────────────────
// SOILING (brak czystości w domu) — Rutyna + nagradzanie na miejscu
// ────────────────────────────────────────────────────────────────────
const SOILING_WEEKS: Record<Phase, WeekTemplate[]> = {
  fundament: [
    {
      title: "Wprowadzenie rutyny toaletowej",
      schwerpunkt: "Czystość w domu buduje się poprzez rutyny. {dogName} musi wiedzieć: teraz jest czas na toaletę, tu jest to miejsce. Przewidywalność ogromnie przyspiesza naukę.",
      wochenziele: [
        "Co najmniej 5-7 rund toaletowych dziennie.",
        "Rutyna jest przewidywalna.",
        "Masz dziennik toaletowy.",
      ],
      tagesplan: "Dziennie co najmniej 5-7 rund toaletowych: rano, po posiłkach, po śnie, wieczorem, przed snem. U młodych lub nieczystych psów: co 1-2 godziny. Zawsze w tym samym miejscu. Notuj, kiedy co się dzieje.",
      no_gos: [
        "Utrzymywać niespójną rutynę.",
        "Pomijać w pośpiechu.",
        "Różne miejsca jako toaletę.",
      ],
      fortschritt: [
        "Rutyna jest wprowadzona.",
        "Znasz wzorce {dogName}.",
        "Pierwsze poprawy są widoczne.",
      ],
      exerciseIds: ["s-toiletten-routine", "s-belohnen-am-platz"],
    },
    {
      title: "Nagradzanie we właściwym miejscu",
      schwerpunkt: "Nagroda musi przyjść BEZPOŚREDNIO we właściwym miejscu i NATYCHMIAST po załatwieniu. Timing to wszystko — opóźnienie 5+ sek nic nie daje.",
      wochenziele: [
        "Nagroda następuje niezwłocznie w miejscu toaletowym.",
        "{dogName} kojarzy miejsce z nagrodą.",
        "Zawsze masz przy sobie smakołyki.",
      ],
      tagesplan: "Na każdej rundzie toaletowej miej przy sobie smakołyki. {dogName} się załatwia: PODCZAS załatwiania cicho DOBRZE. Gdy tylko skończy: natychmiast smakołyk bezpośrednio na miejscu. Słowo pochwały plus smakołyk. Bezpośrednie skojarzenie.",
      no_gos: [
        "Nagradzać dopiero w domu — za późno.",
        "Sucha karma — zbyt mało wartościowa.",
        "Nagroda bez markera DOBRZE.",
      ],
      fortschritt: [
        "{dogName} aktywnie szuka miejsca toaletowego.",
        "Skojarzenie miejsce–nagroda jest wypracowane.",
        "Zawsze masz przy sobie smakołyki.",
      ],
      exerciseIds: ["s-unfaelle-managen", "s-trigger-lesen"],
    },
    {
      title: "Nauka odczytywania sygnałów",
      schwerpunkt: "Gdy WCZEŚNIE rozpoznasz parcie na mocz/kał, możesz w porę wyjść na zewnątrz. Węszenie przy podłodze, kręcenie się w kółko, nagły niepokój — to są sygnały.",
      wochenziele: [
        "Rozpoznajesz sygnały ostrzegawcze {dogName}.",
        "Czas reakcji jest poniżej 30 sek.",
        "Wpadki w mieszkaniu się zmniejszają.",
      ],
      tagesplan: "Aktywnie obserwuj: węszenie przy podłodze, kręcenie się w kółko, nagłe wstawanie, spoglądanie w stronę drzwi. Gdy tylko zauważysz jeden z nich: NATYCHMIAST wyjdź, ŻADNEGO zwlekania. Zaprowadź do zwykłego miejsca.",
      no_gos: [
        "Ignorować sygnały ostrzegawcze.",
        "Najpierw zakładać buty z długim opóźnieniem.",
        "'Wyprowadzić {dogName} później'.",
      ],
      fortschritt: [
        "Rozpoznajesz sygnały pewnie.",
        "Czas reakcji jest krótki.",
        "Wpadki zdarzają się rzadziej.",
      ],
      exerciseIds: ["s-stress-reduktion", "s-toiletten-routine"],
    },
    {
      title: "Radzenie sobie z wpadkami bez kary",
      schwerpunkt: "Wpadki są częścią procesu nauki. Kto zrzędzi, pogarsza wszystko — {dogName} następnym razem będzie się chować. Dokładne sprzątanie + środek enzymatyczny + cierpliwość.",
      wochenziele: [
        "Przy wpadkach reagujesz spokojnie.",
        "Środek enzymatyczny jest dostępny.",
        "{dogName} nie rozwija zachowania ukrywania się.",
      ],
      tagesplan: "Przy wpadce: spokojnie posprzątaj środkiem enzymatycznym (sklep zoologiczny). ŻADNEGO zrzędzenia, ŻADNEGO wtykania nosa. Wyprowadź {dogName} na zewnątrz, może jeszcze coś się załatwi. Zanotuj incydent: kiedy, co?",
      no_gos: [
        "Zrzędzenie lub kara — działa odwrotnie.",
        "Zwykły środek bez enzymu — zapach zostaje dla psa.",
        "Zostawiać psa stojącego, gdy sprzątasz — wzmaga stres.",
      ],
      fortschritt: [
        "Reagujesz spokojnie.",
        "Sprzątanie jest dokładne.",
        "{dogName} się nie chowa.",
      ],
      exerciseIds: ["s-unfaelle-managen", "s-belohnen-am-platz"],
    },
    // Pogłębienia dla planu 6-miesięcznego
    {
      title: "Częstsze rundy toaletowe",
      schwerpunkt: "Jeśli wpadki są częste: gęstsze rundy toaletowe. U młodych psów co 1-2 h, u starszych nieczystych co 2-3 h. Zapobieganie zamiast reagowania.",
      wochenziele: [
        "Rundy toaletowe w odpowiedniej częstotliwości.",
        "Wpadki mierzalnie się zmniejszają.",
        "Rozpoznajesz optymalną częstotliwość.",
      ],
      tagesplan: "U małych szczeniąt (8-16 tygodni): na zewnątrz co 1-2 h. U starszych nieczystych: co 2-3 h. Zmniejszaj częstotliwość przez tygodnie, jeśli nie ma wpadek. Przy wpadce: znów gęściej.",
      no_gos: [
        "Zbyt szybko zmniejszać częstotliwość.",
        "Pomijać rundy w pośpiechu.",
        "Oczekiwać, że 'po prostu się uda'.",
      ],
      fortschritt: [
        "Optymalna częstotliwość jest znaleziona.",
        "Wpadki stają się rzadkie.",
        "{dogName} rozwija pęcherz.",
      ],
      exerciseIds: ["s-toiletten-routine", "s-trigger-lesen"],
    },
    {
      title: "Redukcja stresu przy brudzeniu na tle stresu",
      schwerpunkt: "Niektóre psy załatwiają się w mieszkaniu pod wpływem stresu — burza, nowi ludzie, zmiany. Rozwiązanie: aktywnie ograniczać stres.",
      wochenziele: [
        "Wyzwalacze stresu są zidentyfikowane.",
        "Stres jest aktywnie ograniczany.",
        "Brudzenie na tle stresu się zmniejsza.",
      ],
      tagesplan: "Zidentyfikuj: co stresuje {dogName}? Burza? Nowi ludzie? Zmiany? Aktywnie ograniczaj. Przed spodziewanym stresem: dodatkowa runda toaletowa. Przy stresie: pozostań spokojny.",
      no_gos: [
        "Ignorować stres.",
        "'Zwalczać' brudzenie na tle stresu jak zachowanie — to objaw.",
        "Przy brudzeniu na tle stresu zapominać o kontroli weterynaryjnej.",
      ],
      fortschritt: [
        "Czynniki stresu ograniczone.",
        "{dogName} jest spokojniejszy.",
        "Brudzenie na tle stresu się zmniejsza.",
      ],
      exerciseIds: ["s-stress-reduktion", "s-belohnen-am-platz"],
    },
    {
      title: "Budowanie nocnej czystości w domu",
      schwerpunkt: "Szczenięta i nieczyste psy często potrzebują nocnej rundy toaletowej. W tym tygodniu budujesz nocną rutynę.",
      wochenziele: [
        "Nocna rutyna jest wprowadzona.",
        "Nocne wpadki się zmniejszają.",
        "Pęcherz powoli się wzmacnia.",
      ],
      tagesplan: "Ostatnia runda toaletowa tuż przed snem. U małych szczeniąt (8-16 tygodni): raz w nocy na zewnątrz. U starszych nieczystych psów: najpierw co 4-5 h, potem zmniejszać. Nocna runda: spokojnie, bez zabawy.",
      no_gos: [
        "Zapominać o nocnej rutynie.",
        "Zrzędzić przy nocnej wpadce.",
        "Oczekiwać zbyt długich faz.",
      ],
      fortschritt: [
        "Nocna rutyna jest zgrana.",
        "Pęcherz się wzmacnia.",
        "Nocne wpadki się zmniejszają.",
      ],
      exerciseIds: ["s-nächtliche-blase", "s-toiletten-routine"],
    },
    {
      title: "Sprawdzenie fundamentu",
      schwerpunkt: "Ostatni tydzień fundamentu. Rutyna, nagradzanie, odczytywanie sygnałów, radzenie sobie z wpadkami — wszystkie elementy. Faza 2 = więcej generalizacji i utrwalania.",
      wochenziele: [
        "Wszystkie elementy działają.",
        "Wpadki są wyraźnie zmniejszone.",
        "Czujesz się kompetentny.",
      ],
      tagesplan: "Podsumowanie: co działa świetnie, co się chwieje? Jeśli słabość: 1 dodatkowy tydzień. Przy częstych wpadkach: kontrola weterynaryjna (wykluczyć zapalenie pęcherza itp.).",
      no_gos: [
        "Z niecierpliwości iść dalej zbyt szybko.",
        "Ignorować przyczyny medyczne.",
        "Rozluźniać rutynę.",
      ],
      fortschritt: [
        "Czujesz się kompetentny.",
        "Rutyna działa.",
        "Wpadki są rzadsze.",
      ],
      exerciseIds: ["s-trigger-lesen", "s-belohnen-am-platz"],
    },
  ],
  steigerung: [
    {
      title: "Zmniejszanie częstotliwości przy sukcesie",
      schwerpunkt: "Gdy wpadki stają się rzadsze, powoli zmniejszasz częstotliwość rund toaletowych. {dogName} rozwija pęcherz i kontrolę.",
      wochenziele: [
        "Częstotliwość rund toaletowych jest powoli zmniejszana.",
        "{dogName} rozwija pęcherz i kontrolę.",
        "Masz trwałą rutynę.",
      ],
      tagesplan: "Dzień 1-3: pomiń 1 rundę toaletową dziennie (np. tę nadmiarową przed południem). Dzień 4-7: przy sukcesie pomiń kolejną. Przy wpadce: wróć do gęstszej częstotliwości.",
      no_gos: [
        "Pomijać kilka rund toaletowych naraz.",
        "Uparcie kontynuować mimo wpadki.",
        "Oczekiwać, że zmniejszenie uda się od razu.",
      ],
      fortschritt: [
        "Częstotliwość jest zmniejszana.",
        "Pęcherz się wzmacnia.",
        "Codzienność staje się bardziej elastyczna.",
      ],
      exerciseIds: ["s-toiletten-routine", "s-belohnen-am-platz"],
    },
    {
      title: "Dopracowanie odczytywania sygnałów",
      schwerpunkt: "Odczytywanie sygnałów staje się reakcją odruchową. Pewnie rozpoznajesz nawet subtelne oznaki. Czas reakcji jest poniżej 10 sek.",
      wochenziele: [
        "Odczytywanie sygnałów jest odruchowe.",
        "Czas reakcji jest bardzo krótki.",
        "Wpadki są unikane.",
      ],
      tagesplan: "Aktywna obserwacja, gdy {dogName} nie śpi. Rozpoznawaj też subtelne oznaki: krótki niepokój, krótkie węszenie, krótkie odwrócenie wzroku. Działaj natychmiast.",
      no_gos: [
        "Nie doceniać sygnałów ostrzegawczych.",
        "Ignorować oznaki w pośpiechu.",
        "Nie mieć {dogName} na oku.",
      ],
      fortschritt: [
        "Odczytywanie sygnałów jest odruchowe.",
        "Wpadki są wyeliminowane.",
        "Jesteś uważny.",
      ],
      exerciseIds: ["s-trigger-lesen", "s-unfaelle-managen"],
    },
    {
      title: "Stopniowe zmniejszanie nagradzania",
      schwerpunkt: "Gdy czystość w domu działa, możesz powoli zmniejszać nagradzanie. Ale: NIGDY całkowicie nie rezygnować. Zmienne wzmacnianie utrzymuje zachowanie stabilnym.",
      wochenziele: [
        "Częstotliwość nagradzania jest zmniejszona do ~60%.",
        "{dogName} pozostaje niezawodny.",
        "Wybitne osiągnięcia są dalej nagradzane jackpotem.",
      ],
      tagesplan: "Przy zwykłych rundach toaletowych: nie za każdym razem smakołyk. Przy szczególnych sukcesach (w nowym miejscu, po długim czasie): jackpot. {dogName} zauważa: system zostaje, ale jest nieprzewidywalny.",
      no_gos: [
        "Całkowicie skreślać nagradzanie.",
        "Zmniejszać nagradzanie przy częstych wpadkach.",
        "Rozluźniać zmienność.",
      ],
      fortschritt: [
        "{dogName} pozostaje niezawodny.",
        "Masz przy sobie mniej smakołyków.",
        "Zmienne wzmacnianie działa.",
      ],
      exerciseIds: ["s-belohnen-am-platz", "s-stress-reduktion"],
    },
    {
      title: "Generalizacja różnych tras",
      schwerpunkt: "Dotąd toaleta była w jednym miejscu. W tym tygodniu generalizujesz: załatwiać się wolno także w innych miejscach. Przy sukcesie: nagradzaj.",
      wochenziele: [
        "{dogName} załatwia się też w nowych miejscach.",
        "Generalizacja czystości w domu.",
        "Jesteś bardziej elastyczny w codzienności.",
      ],
      tagesplan: "Spacery nowymi trasami. Gdy {dogName} załatwi się w nowym miejscu: SUPER nagroda. Generalizacja to prawdziwy efekt nauki.",
      no_gos: [
        "Akceptować jako toaletę tylko jedno miejsce.",
        "Oczekiwać, że wszędzie uda się od razu.",
        "Kontynuować w nowym miejscu przy stresie.",
      ],
      fortschritt: [
        "{dogName} załatwia się też w nowych miejscach.",
        "Jesteś bardziej elastyczny.",
        "Generalizacja działa.",
      ],
      exerciseIds: ["s-toiletten-routine", "s-trigger-lesen"],
    },
    // Pogłębienia
    {
      title: "Budowanie tolerancji na stres",
      schwerpunkt: "Przy brudzeniu na tle stresu: aktywnie buduj tolerancję na stres. Ćwicz mini-sytuacje stresowe, {dogName} pozostaje spokojny.",
      wochenziele: [
        "{dogName} radzi sobie z mini-sytuacjami stresowymi bez brudzenia.",
        "Tolerancja na stres rośnie.",
        "Rozpoznajesz wartości progowe.",
      ],
      tagesplan: "Zaplanuj mini-sytuacje stresowe: krótka wizyta, nowy dźwięk, krótka zmiana. {dogName} pozostaje w tym czasie spokojny (koc + Kong). Nagroda za spokój.",
      no_gos: [
        "Wymuszać tolerancję na stres — eskalacja.",
        "Zbyt silne stresory na początku.",
        "Przy stresie nic nie robić.",
      ],
      fortschritt: [
        "Tolerancja na stres rośnie.",
        "Brudzenie na tle stresu się zmniejsza.",
        "Czujesz się przygotowany.",
      ],
      exerciseIds: ["s-stress-reduktion", "s-belohnen-am-platz"],
    },
    {
      title: "Wydłużanie nocnego snu",
      schwerpunkt: "Nocne rundy toaletowe są powoli zmniejszane. U młodych psów: najpierw 1x w nocy, potem przespanie nocy. U starszych nieczystych: 4 h, potem 6 h, potem 8 h.",
      wochenziele: [
        "Nocny sen się wydłuża.",
        "Nocne wpadki zmniejszają się do 0.",
        "Pęcherz wzmacnia się długofalowo.",
      ],
      tagesplan: "Wydłużaj nocną fazę o 30 min tygodniowo. Przy wpadce: wróć do krótszej fazy. Ostatnia runda toaletowa wieczorem tak późno, jak to możliwe. Rano tak wcześnie, jak to konieczne.",
      no_gos: [
        "Zbyt szybko wydłużać.",
        "Uparcie kontynuować mimo wpadki.",
        "Późne posiłki — napełniają pęcherz.",
      ],
      fortschritt: [
        "Nocny sen się wydłuża.",
        "Pęcherz się wzmacnia.",
        "Ty śpisz lepiej.",
      ],
      exerciseIds: ["s-nächtliche-blase", "s-toiletten-routine"],
    },
    {
      title: "Rutynowe radzenie sobie z wpadkami",
      schwerpunkt: "Przy rzadkich wpadkach reagujesz rutynowo. Spokojnie, środek enzymatyczny, bez dramatu. Notuj, co się stało.",
      wochenziele: [
        "Przy wpadkach reagujesz odruchowo spokojnie.",
        "Środek enzymatyczny jest zawsze pod ręką.",
        "Dalej prowadzisz dziennik.",
      ],
      tagesplan: "Przy rzadkiej wpadce: obsłuż spokojnie. Użyj środka enzymatycznego. Zanotuj w dzienniku: kiedy, co, poprzednie wyjście do toalety? Wcześnie rozpoznawaj wzorce.",
      no_gos: [
        "Zrzędzić lub karać przy wpadce.",
        "Używać zwykłego środka.",
        "Zapominać o dzienniku.",
      ],
      fortschritt: [
        "Reagujesz rutynowo.",
        "Wzorce są rozpoznawane.",
        "{dogName} nie rozwija zachowania stresowego.",
      ],
      exerciseIds: ["s-unfaelle-managen", "s-belohnen-am-platz"],
    },
    {
      title: "Utrwalenie fazy wzmocnienia",
      schwerpunkt: "Ostatni tydzień fazy wzmocnienia. Rutyna działa, częstotliwość jest optymalna, generalizacja się udaje. Faza 3 = długoterminowa stabilność.",
      wochenziele: [
        "Wszystkie narzędzia działają płynnie.",
        "Wpadki są bardzo rzadkie.",
        "Czujesz się kompetentny.",
      ],
      tagesplan: "Podsumowanie: co działa świetnie, co jeszcze się chwieje? Zaplanuj fazę 3 z długoterminową rutyną i podtrzymaniem.",
      no_gos: [
        "Rozluźniać rutynę.",
        "Przestać obserwować.",
        "Traktować sukcesy jako oczywiste.",
      ],
      fortschritt: [
        "Narzędzia działają.",
        "{dogName} jest czysty w domu.",
        "Czujesz się kompetentny.",
      ],
      exerciseIds: ["s-toiletten-routine", "s-trigger-lesen"],
    },
  ],
  generalisierung: [
    {
      title: "Długoterminowa rutyna",
      schwerpunkt: "Rutyna zostaje wprowadzona długofalowo. Dziennie 3-4 rundy toaletowe w regularnych odstępach. Także na starość utrzymuje to czystość w domu.",
      wochenziele: [
        "Rutyna jest długofalowo stabilna.",
        "{dogName} ma przewidywalne pory.",
        "Czystość w domu jest oczywistością.",
      ],
      tagesplan: "Dziennie 3-4 stałe rundy toaletowe: rano, w południe, po południu, wieczorem. Przed snem opcjonalnie, zależnie od psa. Rutyna staje się normą.",
      no_gos: [
        "Utrzymywać niespójną rutynę.",
        "Pomijać w pośpiechu.",
        "Oczekiwać, że 'po prostu się uda'.",
      ],
      fortschritt: [
        "Rutyna jest standardem.",
        "{dogName} pozostaje czysty w domu.",
        "Planujesz odprężenie.",
      ],
      exerciseIds: ["s-toiletten-routine", "s-belohnen-am-platz"],
    },
    {
      title: "Opanowanie nowych otoczeń",
      schwerpunkt: "Przy urlopie, wizycie, przeprowadzce: czysty w domu pies musi radzić sobie także w nowych otoczeniach. W tym tygodniu generalizujesz dalej.",
      wochenziele: [
        "{dogName} pozostaje czysty w domu także w nowych otoczeniach.",
        "Pierwsza runda toaletowa w nowym miejscu jest nagradzana.",
        "Planujesz sytuacje urlopowe z wyprzedzeniem.",
      ],
      tagesplan: "W nowych otoczeniach: gęste rundy toaletowe w pierwszych dniach, plus aktywna obserwacja. Pierwsze załatwienie się w nowym miejscu: SUPER nagroda. Generalizacja z czasem się udaje.",
      no_gos: [
        "Oczekiwać, że uda się od razu.",
        "Nie działać przy stresie w nowym otoczeniu.",
        "Zaniedbywać rutynę w nowym otoczeniu.",
      ],
      fortschritt: [
        "{dogName} pozostaje czysty w domu także na urlopie.",
        "Planujesz podróże bardziej odprężenie.",
        "Generalizacja jest długofalowa.",
      ],
      exerciseIds: ["s-trigger-lesen", "s-unfaelle-managen"],
    },
    {
      title: "Dostosowanie do wieku",
      schwerpunkt: "Z wiekiem {dogName} może znów potrzebować częstszych rund toaletowych. Obserwuj zmiany, dostosuj rutynę.",
      wochenziele: [
        "Rozpoznajesz zmiany związane z wiekiem.",
        "Rutyna jest dostosowywana w razie potrzeby.",
        "Senior pozostaje czysty w domu.",
      ],
      tagesplan: "Obserwuj: czy {dogName} potrzebuje częstszych rund? Zmieniła się pojemność pęcherza? Kontrola weterynaryjna przy wyraźnych zmianach. Elastycznie dostosowuj rutynę.",
      no_gos: [
        "Ignorować zmiany związane ze starzeniem.",
        "Oczekiwać starej częstotliwości u starszego psa.",
        "Zapominać o kontroli weterynaryjnej.",
      ],
      fortschritt: [
        "Dostosowania są wprowadzone.",
        "Senior pozostaje czysty w domu.",
        "Planujesz elastycznie.",
      ],
      exerciseIds: ["s-toiletten-routine", "s-belohnen-am-platz"],
    },
    {
      title: "Zarządzanie nawrotem brudzenia na tle stresu",
      schwerpunkt: "Jeśli brudzenie na tle stresu wraca (przeprowadzka, nowi domownicy, zmiany życiowe): aktywnie ograniczaj stres, zagęść rutynę.",
      wochenziele: [
        "Rozpoznajesz oznaki nawrotu na tle stresu.",
        "Stres jest aktywnie ograniczany.",
        "Rutyna jest dostosowywana.",
      ],
      tagesplan: "Przy objawach stresu: znów gęstsza częstotliwość, redukcja czynników stresu, koc jako kotwica. Przy silniejszym stresie: kontrola weterynaryjna, by wykluczyć przyczyny medyczne.",
      no_gos: [
        "Traktować nawrót na tle stresu jak problem behawioralny.",
        "Zrzędzić przy wpadkach na tle stresu.",
        "Zapominać o kontroli weterynaryjnej.",
      ],
      fortschritt: [
        "Nawrót na tle stresu jest opanowany.",
        "Rutyna jest solidna.",
        "Wcześnie rozpoznajesz oznaki.",
      ],
      exerciseIds: ["s-stress-reduktion", "s-unfaelle-managen"],
    },
    {
      title: "Stabilizacja redukcji nagradzania",
      schwerpunkt: "Nagradzanie staje się długofalowo zmienne. {dogName} pozostaje czysty w domu, także bez ciągłych smakołyków. Ale: od czasu do czasu nagradzaj jackpotem.",
      wochenziele: [
        "Częstotliwość nagradzania jest ustabilizowana na ~30%.",
        "{dogName} pozostaje niezawodny.",
        "Wybitne osiągnięcia są nagradzane.",
      ],
      tagesplan: "Przy zwykłych rundach: czasem smakołyk, czasem nie. W szczególnych sytuacjach (nowe otoczenie, długi czas): zawsze jackpot. Zmienne wzmacnianie.",
      no_gos: [
        "Całkowicie skreślać nagradzanie.",
        "Skąpić w szczególnych sytuacjach.",
        "Rozluźniać zmienność.",
      ],
      fortschritt: [
        "Zmienne wzmacnianie działa.",
        "{dogName} pozostaje niezawodny.",
        "Planujesz odprężenie.",
      ],
      exerciseIds: ["s-belohnen-am-platz", "s-trigger-lesen"],
    },
    {
      title: "Plan awaryjny przy nawrotach",
      schwerpunkt: "Jeśli czystość w domu nagle się pogarsza: plan awaryjny. Kontrola weterynaryjna, gęstsza rutyna, sprawdzenie czynników stresu.",
      wochenziele: [
        "Masz plan awaryjny.",
        "Regres jest wcześnie rozpoznawany.",
        "Opanowany w 1-2 tygodnie.",
      ],
      tagesplan: "Plan awaryjny: 1) Kontrola weterynaryjna (zapalenie pęcherza itp.). 2) Zagęszczenie rutyny. 3) Sprawdzenie czynników stresu. 4) Ponowne zwiększenie gęstości nagradzania. 5) Prowadzenie dziennika, by znaleźć wzorce.",
      no_gos: [
        "Ignorować regres.",
        "Zapominać o przyczynach medycznych.",
        "Zrzędzić z frustracji.",
      ],
      fortschritt: [
        "Plan awaryjny działa.",
        "Regres jest opanowany.",
        "Czujesz się kompetentny.",
      ],
      exerciseIds: ["s-unfaelle-managen", "s-stress-reduktion"],
    },
    {
      title: "Higiena stresu na całe życie",
      schwerpunkt: "Czystość w domu zależy długofalowo także od stresu. Dobra higiena stresu = stabilna czystość w domu. Sen, rutyna, zajęcie.",
      wochenziele: [
        "Higiena stresu jest rutyną.",
        "{dogName} jest długofalowo zrównoważony.",
        "Czystość w domu pozostaje stabilna.",
      ],
      tagesplan: "Sprawdzaj regularnie: Sen? Rutyna? Zajęcie? Kontakty społeczne? Przy stresie w innym obszarze: aktywnie ograniczaj, zanim ucierpi czystość w domu.",
      no_gos: [
        "Ignorować stres w innym obszarze.",
        "Zaniedbywać rutynę.",
        "Zaniedbywać zajęcie.",
      ],
      fortschritt: [
        "Higiena stresu jest wprowadzona.",
        "{dogName} pozostaje zrównoważony.",
        "Czystość w domu jest stabilna.",
      ],
      exerciseIds: ["s-trigger-lesen", "s-toiletten-routine"],
    },
    {
      title: "Przejście w tryb podtrzymania",
      schwerpunkt: "Ostatni tydzień. Czystość w domu jest stabilna, rutyna działa, generalizacja działa. Podtrzymanie na najbliższe lata.",
      wochenziele: [
        "Wszystkie rutyny działają długofalowo.",
        "Rytm podtrzymania jest jasny.",
        "{dogName} pozostaje czysty w domu.",
      ],
      tagesplan: "Ogranicz aktywny trening do minimum. Rutyna pozostaje: 3-4 rundy toaletowe dziennie. Przy nawrotach znów prowadź dziennik. Przy zmianach: ostrożnie dostosuj.",
      no_gos: [
        "Nagle porzucać wszystkie rutyny.",
        "Wpadać w panikę przy nawrocie.",
        "Przestać obserwować.",
      ],
      fortschritt: [
        "{dogName} jest długofalowo czysty w domu.",
        "Czujesz się kompetentny.",
        "Wpadki są wyjątkiem.",
      ],
      exerciseIds: ["s-unfaelle-managen", "s-belohnen-am-platz"],
    },
  ],
};

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

// ── Miesięczne przeglądy: specyficzne dla problemu, żaden ogólny tekst o ciągnięciu ──
// Każda faza w ramach danego problemu ma własne elementy, własne pułapki, własne
// punkty "co powinno być już zauważalne". Bez anglicyzmów.

interface PhaseDaten {
  bausteine: string;       // krótka lista elementów budowanych w tej fazie
  schon_merken: string;    // konkretnie: co powinno być obserwowalne
  jetzt_anpassen: string;  // jak korygować
  stolperfallen: string;   // częste błędy w tej fazie
  vermeidet: string;       // czego teraz nie robić
}

const PHASE_TEXTE: Record<ProblemKey, Record<Phase, PhaseDaten>> = {
  pulling: {
    fundament: {
      bausteine: "Słowo-marker DOBRZE i sygnał PATRZ, mechanika „Bądź drzewem” w domu, pozycja przy nodze jako złota strefa nagradzania, spokojny rytuał przy drzwiach oraz koc relaksacyjny jako kotwica",
      schon_merken: "{dogName} reaguje w mieszkaniu w mniej niż 2 sekundy na PATRZ. Przy napiętej lince w domu {dogName} odwraca się do ciebie po 5-10 sekundach, a liczba przystanków na sesję spada z 20+ do poniżej 10. Drzwi otwierają się bez napierania, a rękę z kieszeni spodni wyciągasz rzadziej niż na starcie planu. {dogName} rozpoznaje koc jako spokojne miejsce.",
      jetzt_anpassen: "Jeśli „Bądź drzewem” w domu nie działa jeszcze bez twojej pomocy, dorzuć tydzień i ćwicz celowo przy niższym poziomie bodźców. Jeśli natomiast ogród albo klatka schodowa już wychodzą spokojnie, w fazie 2 możesz być odważniejszy. Zapisz sobie, który z czterech elementów siedzi najsłabiej — to będzie punkt ciężkości w fazie 2.",
      stolperfallen: "Wielu z niecierpliwości chce już w 4. tygodniu wprowadzać prawdziwe bodźce z zewnątrz. To rujnuje fundament. Klasyk również: dawanie nagrody przed ciałem zamiast przy szwie nogawki — tak wabisz {dogName} do przodu i wzmacniasz ciągnięcie. Podawaj nagrodę konsekwentnie przy swoim kolanie.",
      vermeidet: "Pełne codzienne spacery z oczekiwaniem, że to zadziała. Faza 1 to praca w domu. Faza 2 buduje przejście."
    },
    steigerung: {
      bausteine: "„Bądź drzewem” na zewnątrz z prawdziwymi bodźcami, zmiana kierunku jako konsekwencja przy uporczywym ciągnięciu, nagradzanie w pozycji przy nodze w prawdziwej codzienności, zmiany tempa i kierunku jako narzędzie uwagi",
      schon_merken: "{dogName} zatrzymuje się na pierwszym prawdziwym spacerze po kilku przystankach, gdy linka się napina, zamiast przeć dalej. Konsekwencji ze zmianą kierunku potrzebujesz rzadziej niż w pierwszym tygodniu tej fazy. Liczba przystanków na spacer jest jednocyfrowa, a {dogName} sam szuka pozycji przy nodze na skrzyżowaniach czy w niepewnych miejscach.",
      jetzt_anpassen: "Jeśli {dogName} na zewnątrz ma jeszcze wiele przystanków, wróć na spokojniejszą trasę i pracuj tam czysto. Twoim pokrętłem regulacji jest dystans i poziom bodźców, a nie presja czy głośniejszy głos. Jeśli natomiast spokojne trasy idą już bardzo dobrze: ostrożnie w gęstsze rejony, ale zawsze z „Bądź drzewem” jako kotwicą.",
      stolperfallen: "Zbyt szybkie zmniejszanie gęstości nagród, bo akurat idzie tak dobrze. Faza 2 to faza inwestycji — każdy dobry fragment na luźnej lince jest nagradzany. Powszechne również: brnięcie dalej w stresujący dzień zamiast wyboru spokojniejszej trasy.",
      vermeidet: "Przeć w stresującej sytuacji z myślą „przecież jesteśmy już prawie na miejscu”. Plateau są normalne. Kto teraz pracuje czysto, w fazie 3 zrobi najwyraźniejsze skoki."
    },
    generalisierung: {
      bausteine: "Luźna linka na prawdziwym codziennym spacerze, radzenie sobie z różnymi trasami, przerwy na węszenie jako nagroda za spokojne fragmenty, stopniowa redukcja nagród",
      schon_merken: "{dogName} radzi sobie z 20-30-minutowym codziennym spacerem przy mniej niż 5 prawdziwych epizodach ciągnięcia. Narzędzi takich jak „Bądź drzewem” i nagradzanie przy nodze używasz bez zastanowienia. Także na nowej trasie {dogName} pozostaje w większości spokojny. Przerwy na węszenie są aktywną nagrodą, a nie „momentem zakłócenia” jak dawniej.",
      jetzt_anpassen: "Zmniejszaj częstotliwość nagradzania dalej, ale nigdy całkowicie. Za szczytowe osiągnięcia nadal nagradzaj hojnie. Jeśli {dogName} bez nagrody wyraźnie odpuszcza: krok wstecz do wyższej gęstości. Zaplanuj rytm podtrzymujący: co 3-4 miesiące świadomy spacer treningowy w trudnym miejscu.",
      stolperfallen: "Całkowite skreślenie nagród. Wzmacnianie pozostaje ważne, zmienia się tylko częstotliwość i przewidywalność. Klasyk również: traktowanie sukcesów jako oczywistości i zaprzestanie obserwacji. Drobne nawroty się zdarzają — zauważone wcześnie, są szybko naprawione.",
      vermeidet: "Odłożyć plan całkowicie i myśleć „to już na zawsze utrwalone”. Dobre rutyny zostają tylko wtedy, gdy dalej o nie dbasz."
    }
  },
  energy: {
    fundament: {
      bausteine: "Inwentaryzacja rytmu snu i dnia, jedzenie jako zajęcie zamiast pożerania z miski, sygnał CZEKAJ jako tolerancja na frustrację, marker relaksu (np. CUDOWNIE)",
      schon_merken: "{dogName} pracuje 20-30 minut nad zabawą węchową albo Kongiem zamiast łykać przez 30 sekund. Po tych zajęciach {dogName} spokojnie się wycisza zamiast pozostawać nakręcony. CZEKAJ przed miską wychodzi przez 5-10 sekund bez szczekania z frustracji. Marker relaksu daje się obserwowalnie połączyć ze spokojnymi fazami.",
      jetzt_anpassen: "Jeśli {dogName} wieczorem jest dalej nakręcony, sprawdź sen: dorosłe psy potrzebują 16-20 godzin odpoczynku dziennie. Wiele nadpobudliwych psów śpi za mało. Jeśli zabawa węchowa kończy się za szybko, utrudnij ją (wyższe kryjówki, mrożony Kong). Jeśli CZEKAJ jeszcze się chwieje: znów skróć czas czekania.",
      stolperfallen: "Dostarczać więcej akcji, bo {dogName} jest taki nakręcony. To jest dokładnie ten błąd. Nadmierne pobudzenie potrzebuje mniej bodźców, nie więcej. Klasyk również: traktowanie pracy głową jako „opcjonalnej”. Zabawa węchowa i Kong nie zastępują szaleństw — są ważniejszym zajęciem.",
      vermeidet: "Wielogodzinne szaleństwa albo długie spotkania z psami. Jedno i drugie wzmacnia nadmierne pobudzenie. Faza 1 to budowanie wyciszenia w domu."
    },
    steigerung: {
      bausteine: "Praca węchowa na zewnątrz (podążanie tropem, stopniowane szukanie), ustrukturyzowane spacery z zadaniami szukania, gra w stop jako przełącznik pobudzenia, rutyna wyciszania na kocu po każdym pobudzeniu",
      schon_merken: "{dogName} podąża skupiony za 20-metrowym tropem z jedzenia i jest potem widocznie zmęczony. Przy grze w stop {dogName} wycisza się w ciągu 3 sekund. Po spacerach {dogName} dzięki rutynie wyciszania szybciej odnajduje spokój niż na starcie planu. Rozpiętość skupienia rośnie zauważalnie.",
      jetzt_anpassen: "Jeśli {dogName} po pracy węchowej dalej się nakręca, utrudnij zadania szukania (bardziej złożone, więcej kryjówek) zamiast je wydłużać. Większa trudność męczy bardziej niż dłuższy, monotonny ruch. Jeśli wyciszanie nie chwyta: wprowadź przed każdą sesją 10 minut spokojnego przygotowania.",
      stolperfallen: "Piętrzenie kilku ekscytujących aktywności tego samego dnia. Park rano, szaleństwa po południu, wizyta wieczorem — to zalew bodźców, nie zajęcie. Powszechne również: pomijanie wyciszania, bo „pies przecież już śpi”. Aktywny odpoczynek jest częścią rutyny.",
      vermeidet: "Wielogodzinne szaleństwa z innymi psami. Nadmierne pobudzenie jest tym wzmacniane, a nie redukowane."
    },
    generalisierung: {
      bausteine: "Tygodniowy plan zajęć z jasną mieszanką ruchu, węchu, głowy i kontaktu społecznego, spokój jako tryb domyślny w codzienności, jasna rutyna przeciw nadmiernemu pobudzeniu na trudne dni",
      schon_merken: "{dogName} przez co najmniej 60% dnia jest w fazie spokoju. Nie musisz już ciągle zapewniać zajęć, {dogName} odpręża się także sam. Przy narastającym nadmiernym pobudzeniu niezawodnie pomaga ci rutyna przeciw pobudzeniu (usunąć bodźce, na koc, ustawić marker relaksu). Spacery nie są już obowiązkiem, lecz prawdziwym wzbogaceniem.",
      jetzt_anpassen: "Sprawdzaj regularnie swój plan tygodnia: czy {dogName} codziennie dostaje ruch plus węch plus głowę? Jeśli brakuje jednego filaru, to zwykle źródło ponownego niepokoju. W fazach stresu (przeprowadzka, wizyta, zmiany) zagęść plan.",
      stolperfallen: "Odłożyć plan, bo „teraz przecież działa”. Nadmierne pobudzenie może wrócić bardzo szybko, gdy tylko zniknie struktura. Klasyk również: przerywanie faz spokoju głaskaniem albo zagadywaniem. Pozwól {dogName} spać.",
      vermeidet: "Rozmiękczać higienę snu. 16-20 godzin odpoczynku nie podlega negocjacji, także u młodych psów."
    }
  },
  aggression: {
    fundament: {
      bausteine: "Mapa progów dla wszystkich typów wyzwalaczy, słowo-marker PATRZ i komunikacja przez nagrody, pozytywnie zwarunkowany kaganiec, patrzenie-na-bodziec-i-z-powrotem w domu z ustawionymi bodźcami, jasny protokół awaryjny przy eskalacji",
      schon_merken: "Znasz dystans, od którego każdy wyzwalacz wywołuje u {dogName} stres, i wcześnie rozpoznajesz sygnały stresu (mimika, oddech, ogon). {dogName} dobrowolnie wkłada nos w kaganiec i akceptuje krótkie noszenie. W domu {dogName} reaguje na słowo-marker PATRZ w mniej niż 2 sekundy. Sekwencję awaryjną przećwiczyłeś na sucho, wiesz co robisz.",
      jetzt_anpassen: "Jeśli mapa progów jeszcze się chwieje, wyjdź jeszcze raz i obserwuj celowo. Bez tej wiedzy faza 2 nie ma sensu. Jeśli kaganiec dalej prowadzi do frustracji, wróć do krótkiego noszenia z pozytywnym zajęciem. Cierpliwość opłaca się tutaj bardziej niż gdziekolwiek indziej.",
      stolperfallen: "Pracować z prawdziwymi wyzwalaczami już w fazie 1, bo „to przecież musi zadziałać”. To eskaluje. Klasyk również: zakładanie kagańca dopiero w sytuacji stresowej. Nigdy. Musi być wcześniej w 100% pozytywnie skojarzony. Inaczej skojarzenie jest zatrute na całe życie.",
      vermeidet: "Prowokować wyzwalacze albo szukać bliskich spotkań. Faza 1 to przygotowanie. Faza 2 to zastosowanie z dużym dystansem."
    },
    steigerung: {
      bausteine: "Patrzenie-na-bodziec-i-z-powrotem na zewnątrz z prawdziwymi wyzwalaczami z dystansu 50m+, aktywne odwracanie od bodźca (zasada spojrzeć-i-odwrócić-się), ŁUK jako strategia omijania oraz trening modyfikacji zachowania w układzie z dystansem",
      schon_merken: "{dogName} przy wyzwalaczach z dużego dystansu pozostaje poniżej progu i patrzy na ciebie, zamiast skupiać się na bodźcu. Oznaki stresu są krótsze i rzadsze. {dogName} podąża za sygnałem ŁUK bez oporu. Podczas treningu modyfikacji zachowania {dogName} pokazuje własne ruchy rozładowujące stres (odwracanie wzroku, odwracanie się, węszenie), które nagradzasz dystansem.",
      jetzt_anpassen: "Jeśli dystans progowy pozostaje jeszcze bardzo duży, to w porządku. Redukcja następuje powoli, 2-5m na tydzień, nie radykalnie. Jeśli natomiast {dogName} jest już spokojny przy 10m, podchodź ostrożnie bliżej, ale tylko przy jednym typie wyzwalacza naraz.",
      stolperfallen: "Piętrzenie kilku typów wyzwalaczy na jeden spacer. Pies + biegacz + rowerzysta w jednej sesji to zalew bodźców. Klasyk również: dawanie nagrody dopiero po reakcji, zamiast gdy bodziec jest widoczny. Wtedy skojarzenie emocjonalne się nie zmienia.",
      vermeidet: "Ocierać się o próg albo go przekraczać, bo „raz spróbować”. Każda eskalacja kosztuje 2 tygodnie zysku z nauki."
    },
    generalisierung: {
      bausteine: "Trening modyfikacji zachowania w codzienności, jasna hierarchia wyzwalaczy ze świadomym zarządzaniem, strefa buforowa przed spodziewanymi spotkaniami oraz reguła 72 godzin regeneracji po stresie",
      schon_merken: "{dogName} w wielu sytuacjach reguluje się sam, musisz interweniować rzadziej. Przy spodziewanych spotkaniach odruchowo stosujesz rutynę strefy buforowej. Planujesz spacery świadomie według hierarchii wyzwalaczy i unikasz kumulacji stresu. Eskalacje stają się rzadkie i krótkie, bo widzisz je wcześnie.",
      jetzt_anpassen: "Zmniejszaj gęstość nagród powoli, ale nigdy całkowicie. Przy nowych albo trudnych wyzwalaczach nadal pełna nagroda. Planuj regularne dni odświeżające przy średnio trudnym wyzwalaczu — to utrzymuje strategie w świeżości.",
      stolperfallen: "Odłożyć kaganiec całkowicie, bo „teraz przecież działa”. U reaktywnych psów pozostaje on narzędziem w sytuacjach wysokiego ryzyka. Klasyk również: ignorowanie reguły 72 godzin. Hormony stresu rozkładają się w pełni dopiero po 3 dniach.",
      vermeidet: "Zrezygnować całkowicie z unikania wyzwalaczy z oczekiwaniem „przetrenujemy to na wylot”. Jasne zarządzanie jest częścią rozwiązania, a nie porażką."
    }
  },
  mouthing: {
    fundament: {
      bausteine: "Sygnał PUŚĆ czysto zbudowany na pozytywnej wymianie, wymiana jako odruchowa reakcja przy podnoszeniu, FUJ jako sygnał stop w domu z alternatywną nagrodą, zarządzanie linką w waszych gorących punktach podnoszenia",
      schon_merken: "{dogName} oddaje proste przedmioty na PUŚĆ dobrowolnie, nie musisz gonić ani sięgać do pyska. Przy FUJ {dogName} w domu przystaje i szuka ciebie. W znanych gorących punktach na spacerze {dogName} już szuka pozycji przy nodze. Zawsze masz pod ręką wartościowy smakołyk na wymianę.",
      jetzt_anpassen: "Jeśli PUŚĆ przy wartościowych obiektach jeszcze nie wychodzi, wróć do mało wartościowych rzeczy w domu. Wartość podnoś powoli. Jeśli FUJ staje się inflacyjny (używasz go 20 razy dziennie), zredukuj do 3-5 naprawdę ważnych sytuacji.",
      stolperfallen: "Gonienie, gdy {dogName} ma zakazany przedmiot. Dla psa to zabawa i wzmacnia podnoszenie. Klasyk również: oddawanie podniesionego przedmiotu po PUŚĆ. Wtedy wymiana nie jest prawdziwa i gotowość maleje.",
      vermeidet: "Chodzić po trasach wysokiego ryzyka (dużo śmietnisk, rejony z trutkami) bez kagańca, dopóki narzędzia nie działają jeszcze na zewnątrz. Bezpieczeństwo najpierw."
    },
    steigerung: {
      bausteine: "PUŚĆ na prawdziwym spacerze przy nisko- i średnio wartościowych znaleziskach, FUJ jako sygnał prewencyjny przed podniesieniem, szukanie nagrody jako alternatywne zajęcie dla popędu szukania, kaganiec jako standard bezpieczeństwa na trasach wysokiego ryzyka",
      schon_merken: "{dogName} reaguje na zewnątrz na FUJ w mniej niż 2 sekundy i zwraca się do ciebie. PUŚĆ wychodzi przy prostych znaleziskach bez dramatu, a ty pozostajesz wewnętrznie spokojny. Przy szukaniu nagrody {dogName} aktywnie szuka nosem rzuconych smakołyków, zamiast przypadkowo podnosić.",
      jetzt_anpassen: "Jeśli PUŚĆ przy średnio wartościowych znaleziskach jeszcze nie wychodzi, nagroda jest prawdopodobnie za niska. Przejdź na kurczaka albo kiełbasę. Jeśli popęd szukania także po większym obciążeniu dalej prowadzi do podnoszenia, zintensyfikuj fazy pracy węchowej.",
      stolperfallen: "Traktować kaganiec jako „przyznanie się do porażki”. To narzędzie, nie kara. Klasyk również: używanie FUJ jako słowa do zbesztania. Musi pozostać jasnym sygnałem stop z alternatywną nagrodą.",
      vermeidet: "Chodzić po krytycznych trasach (przed szkołami, w dni wywozu śmieci) bez kagańca. Prewencja jest tu cenniejsza niż trening po zdarzeniu."
    },
    generalisierung: {
      bausteine: "Redukcja nagród do wzmacniania zmiennego, PUŚĆ przy wartościowych znaleziskach z MEGA-nagrodą, praca węchowa jako główne zajęcie zamiast przedmiotu pobocznego, jasne strategie na gorące punkty w waszych najtrudniejszych miejscach",
      schon_merken: "{dogName} radzi sobie z trasami wysokiego ryzyka bez dramatu, planujesz je świadomie zamiast unikać. PUŚĆ przy rzadkich, wartościowych znaleziskach działa z MEGA-nagrodą. Rękę z kieszeni spodni wyciągasz rzadziej, bo {dogName} także bez ciągłego wzmacniania niezawodnie oddaje.",
      jetzt_anpassen: "Sprawdzaj konieczność kagańca dla każdej trasy osobno. Znane spokojne trasy: bez. Wysokie ryzyko: dalej z nim. Przy nawrotach znów prowadź ściślej. Popęd szukania potrzebuje zaspokajania przez całe życie — wpisz pracę węchową na stałe w plan tygodnia.",
      stolperfallen: "Zredukować częstotliwość nagród całkowicie do zera. Wzmacnianie zmienne oznacza „czasami”, a nie „nigdy”. Klasyk również: iść w strefę wysokiego ryzyka w słaby dzień, bo „w zasadzie przecież działa”. Ego kosztuje w sytuacji awaryjnej bardzo dużo.",
      vermeidet: "Zrezygnować z kagańca z powodu odbioru otoczenia. To odpowiedzialny sprzęt, a nie wstyd."
    }
  },
  recall: {
    fundament: {
      bausteine: "Słowo przywołania DO MNIE na nowo pozytywnie naładowane top-nagrodami, przytrzymywane przywołanie z pomocnikiem dla wysokiej motywacji, praca na długiej lince jako most bezpieczeństwa oraz gwizdek jako drugi zapasowy sygnał",
      schon_merken: "{dogName} reaguje w domu błyskawicznie na DO MNIE i przychodzi widocznie z entuzjazmem. Przy zabawie w przytrzymywanie {dogName} sprintuje do ciebie z wysoką energią. Długa linka to spokojna rutyna, nie dramat. Gwizdek jest w domu czysto zwarunkowany z nagrodą.",
      jetzt_anpassen: "Jeśli DO MNIE w domu jeszcze nie wychodzi w 100%, nagroda jest prawdopodobnie za niska. Przejdź na kurczaka albo ser, nie suchą karmę. Jeśli długa linka prowadzi do zamieszania, ćwicz najpierw samo noszenie bez przywołań, żeby {dogName} przyzwyczaił się do materiału.",
      stolperfallen: "Używanie słowa przywołania do negatywnych rzeczy (kąpiel, weterynarz, zapinanie na koniec spaceru). Tym zatruwasz sygnał na całe życie. Do negatywów użyj innego słowa. Klasyk również: wołanie sygnału wielokrotnie, gdy {dogName} nie przychodzi. Tym {dogName} uczy się, że pierwszy raz jest opcjonalny.",
      vermeidet: "Ryzykować prawdziwy wybieg już w fazie 1. Najpierw słowo musi siedzieć w 100%, potem długa linka, potem gwizdek. Faza 2 buduje przejście."
    },
    steigerung: {
      bausteine: "DO MNIE przy umiarkowanym rozproszeniu z długą linką, gwizdek w prawdziwych sytuacjach na zewnątrz, awaryjne słowo przywołania na prawdziwe kryzysy (używane tylko w sytuacji awaryjnej, MEGA-nagroda), trzy jasne poziomy nagradzania",
      schon_merken: "Przy umiarkowanym rozproszeniu {dogName} przychodzi niezawodnie (80% lub więcej). Pewnie rozpoznajesz, kiedy rozproszenie jest za duże na przywołanie, i nie przeceniasz własnego głosu. Gwizdek działa na zewnątrz tak samo niezawodnie jak słowo. Sygnał awaryjny jest zwarunkowany i nieużywany.",
      jetzt_anpassen: "Jeśli skuteczność spada poniżej 70%, rozproszenie jest za duże. Zredukuj je, zamiast zwiększać presję. Jeśli natomiast wszystko idzie na 90%: trudniejsze rozproszenia, ale tylko o jeden poziom na tydzień.",
      stolperfallen: "Używanie sygnału awaryjnego do zwykłych przywołań. Tym traci swoją magię. Klasyk również: skąpienie nagrody przy trudnych przywołaniach. Szczytowe osiągnięcie kosztuje, właśnie w fazie 2.",
      vermeidet: "Bez długiej linki w nieznanych rejonach. Długa linka pozostaje mostem bezpieczeństwa aż do fazy 3."
    },
    generalisierung: {
      bausteine: "Pierwsze kontrolowane fazy wybiegu w bezpiecznych strefach, rutyna podtrzymująca dla DO MNIE i gwizdka, zabawa w przytrzymywanie jako regularne odświeżenie, stopniowane poziomy nagradzania zależnie od trudności",
      schon_merken: "{dogName} radzi sobie z wybiegiem w bezpiecznej strefie i przychodzi na sygnał w mniej niż 5 sekund. Długiej linki używasz celowo, a nie automatycznie. Sygnał awaryjny zastosowałeś i zadziałał — masz zaufanie do systemu.",
      jetzt_anpassen: "Sprawdzaj dla każdej trasy osobno: długa linka tak czy nie? Przy wątpliwości: długa linka. Także po miesiącach bez incydentu sygnał awaryjny pozostaje wyłącznym słowem z MEGA-nagrodą, nigdy do rutyny.",
      stolperfallen: "„Pozwolić, by przywołanie się rozluźniło”, bo przecież siedzi. Bez regularnego podtrzymywania skojarzenie blednie. Zaplanuj 2-3 momenty DO MNIE na spacer z jackpotem.",
      vermeidet: "Wybieg na trasach blisko ulic albo z wysokim prawdopodobieństwem gonienia zwierzyny. Bezpieczeństwo zawsze przed komfortem."
    }
  },
  barking: {
    fundament: {
      bausteine: "Dziennik wyzwalaczy z top-3 wyzwalaczami szczekania, marker CICHO jako nagroda za milczenie, rutyna „dzwonek-koc” jako konkretna alternatywa, budowanie tolerancji na frustrację przez sygnały CZEKAJ",
      schon_merken: "Znasz najważniejsze wyzwalacze szczekania u {dogName} i nie reagujesz już odruchowo. {dogName} dostaje dziennie 8-10 nagród za fazy milczenia. Przy dźwięku dzwonka {dogName} już biegnie w stronę koca. CZEKAJ wychodzi w 3-4 codziennych sytuacjach.",
      jetzt_anpassen: "Jeśli jeden typ wyzwalacza wywołuje jeszcze silniejsze szczekanie niż inne, uczyń go punktem ciężkości fazy 2. Jeśli marker CICHO jeszcze nie chwyta, gęstość nagród jest prawdopodobnie za niska. Wróć na 1 tydzień do 10+ nagród dziennie.",
      stolperfallen: "Krzyczenie, gdy {dogName} szczeka. Tym dajesz uwagę za szczekanie, więc staje się częstsze. Klasyk również: ćwiczenie rutyny „dzwonek-koc” tylko w domu, a potem bezradność przy prawdziwym gościu. Realistyczne testy muszą przychodzić stopniowo.",
      vermeidet: "„Pozwolić psu wyszczekać się do końca” z myślą „kiedyś przecież przestanie”. Szczekanie o uwagę wygasa przez konsekwentne odwracanie się, a nie przez znoszenie."
    },
    steigerung: {
      bausteine: "Prawdziwe testy z dzwonkiem z pomocnikiem i gościem, przeciwwarunkowanie przy bodźcach z zewnątrz, konsekwentne wygaszanie szczekania o uwagę przez 2-3 tygodnie, pogłębiona tolerancja na frustrację",
      schon_merken: "Przy prawdziwym dzwonku {dogName} już biegnie do koca zamiast do drzwi. Bodźce z zewnątrz prowadzą do spojrzenia na ciebie zamiast do szczekania. Szczekanie o uwagę stało się zauważalnie rzadsze, szczyt wygaszania macie już za sobą. CZEKAJ wychodzi przez 20+ sekund bez szczekania.",
      jetzt_anpassen: "Jeśli szczyt wygaszania jeszcze nie opadł, wytrzymaj. Jeden członek rodziny, który ustępuje, sabotuje 2 tygodnie pracy, dlatego ważna jest odprawa rodzinna. Jeśli rutyna koca chwieje się przy prawdziwym dzwonku, wróć do dźwięku dzwonka + pomocnik.",
      stolperfallen: "Zajmować się kilkoma typami wyzwalaczy jednocześnie. Skup się na jednym punkcie ciężkości na tydzień. Klasyk również: zbyt szybkie zmniejszanie gęstości nagród, bo „przecież prawie już nie szczeka”. Faza 2 potrzebuje dalej wysokiego wzmacniania.",
      vermeidet: "W trudne dni (burza, fajerwerki, stres) forsować rutynę. Lepiej zredukować bodźce i następnego dnia normalnie kontynuować."
    },
    generalisierung: {
      bausteine: "Rutyna „dzwonek-koc” w codzienności z prawdziwymi gośćmi, jasna higiena stresu, by unikać nawrotów szczekania, odświeżenie podtrzymujące co 4-6 tygodni, strategia awaryjna przy nagłym wybuchu szczekania",
      schon_merken: "Przy dzwonku albo bodźcach z zewnątrz {dogName} reaguje spokojnie i przewidywalnie. Przyjmowanie gości to rutyna, nie dramat. Wcześnie rozpoznajesz drobne nawroty i przeciwdziałasz, zanim się rozrosną.",
      jetzt_anpassen: "Sprawdzaj spójność rodziny co kilka tygodni. Niespójne reakcje pojedynczych osób są najczęstszym źródłem nawrotów. Przy nawrotach: 1 tydzień ekstra-konsekwentnie z podwyższoną nagrodą.",
      stolperfallen: "Odhaczyć strategie jako „załatwione”. Szczekanie może wrócić bardzo szybko, gdy tylko spada spójność. Klasyk również: ignorowanie stresu w innym miejscu (przeprowadzka, nowy członek rodziny), a wtedy {dogName} znów szczeka.",
      vermeidet: "Rozluźnić się i celowo prowokować wyzwalacze szczekania, żeby testować. Dobre psy to nie „przetestowane psy”, lecz stabilnie wytrenowane psy."
    }
  },
  anxiety: {
    fundament: {
      bausteine: "Rozpoznanie stosu wyzwalaczy pożegnania, rozdzielenie pojedynczych wyzwalaczy (klucze bez wyjścia, buty bez wyjścia), samotność zbudowana w sekundach do minut, ulubiony Kong jako pozytywne skojarzenie z wyjściem",
      schon_merken: "Znasz wyzwalacze pożegnania u {dogName} (klucze, buty, kurtka, klamka) i pracujesz nad ich rozdzieleniem mimochodem. Czas samotności 1-3 minuty jest znoszony bez oznak stresu. {dogName} zaczyna zajęcie z Kongiem, gdy wychodzisz, zamiast już drżeć.",
      jetzt_anpassen: "Jeśli fazy sekundowe jeszcze się chwieją, wróć i pracuj krócej. Przy lęku separacyjnym cierpliwość to cała gra, kto za szybko podnosi poprzeczkę, ten na nowo buduje lęk. Jeśli Kong leży nieużywany, czas samotności jest za długi jak na obecny etap.",
      stolperfallen: "Dramatyczne żegnanie się albo witanie. Jedno i drugie zabarwia akt „samotności” negatywnie. Klasyk również: wracanie przy momencie skomlenia. Tym {dogName} uczy się, że skomlenie sprowadza opiekuna z powrotem — to utrwala lęk.",
      vermeidet: "Zostawiać na godziny, bo pojawia się termin. Także nie w aucie, także nie u sąsiada. Faza 1 to praca w sekundach i minutach. Jeśli coś wypadnie — opiekun do psa."
    },
    steigerung: {
      bausteine: "Fazy minutowe rozciągnięte do 30-60 minut, koc bezpieczeństwa jako mobilna kotwica, pierwsza godzina samotności jako kamień milowy, regularna obserwacja przez kamerę w smartfonie",
      schon_merken: "{dogName} zostaje sam na 30-60 minut i jest na kocu odprężony, nie spięty. Wyzwalacze są w dużej mierze rozdzielone, rutyny przygotowań nie wywołują już szczytów stresu. Na wideo widzisz fazy spokoju zamiast chodzenia w kółko czy szczekania.",
      jetzt_anpassen: "Jeśli godzina jeszcze nie wychodzi, pozostań przy krótszych fazach i utrwalaj je stabilnie. Jeśli natomiast wszystko jest spokojne, możesz powoli przejść na 90 minut i 2 godziny. Obserwacja z wideo jest tu ważniejsza niż przeczucie, bo psy często pokazują stres dopiero po kilku minutach.",
      stolperfallen: "Kontrolować przebieg za późno. Bez wideo zgadujesz, czy czas samotności był dobry czy nie. Klasyk również: radykalne wydłużanie jednego dnia, bo „dziś wydaje się dobrze”. Cierpliwość robi różnicę.",
      vermeidet: "Testować długie fazy, gdy na zewnątrz jest stres (burza, roboty drogowe, święta). Faza 2 potrzebuje stabilnych warunków brzegowych."
    },
    generalisierung: {
      bausteine: "3-4 godziny samotności jako przydatność w codzienności, przewidywalna rutyna dnia, którą {dogName} zna, higiena stresu dla długoterminowej stabilności, regularna kontrola wideo jako wczesne wykrywanie nawrotów",
      schon_merken: "Możesz pracować albo iść na zakupy, a {dogName} pozostaje spokojny. Rutyna dnia jest stała i przewidywalna. Na wideo {dogName} przez większość czasu śpi lub odpoczywa, rutyna z Kongiem jest dograna. Czujesz się gotowy na codzienność.",
      jetzt_anpassen: "Trzymaj rutynę ściśle, także w weekend. Psy nie rozróżniają dnia roboczego i niedzieli. Przy zmianach życiowych (przeprowadzka, nowy współlokator) zwiększ na chwilę częstotliwość krótkich faz samotności.",
      stolperfallen: "Ryzykować wielogodzinną nieobecność, bo „przecież działa”. Także stabilny pies potrzebuje między czasem kontaktu społecznego. Klasyk również: ignorowanie stresu w innym miejscu, a wtedy lęk separacyjny wraca jako objaw.",
      vermeidet: "Więcej niż 4-5 godzin z rzędu bez przerwy na toaletę czy ruch. Nawet bez lęku separacyjnego to dla psów za długo."
    }
  },
  jumping: {
    fundament: {
      bausteine: "Zasada czterech łap na ziemi jako centralna reguła, sygnał SIAD jako alternatywa powitania, spójność rodziny ze wszystkimi domownikami, spokojna rutyna ponownego spotkania bez ekscytacji",
      schon_merken: "{dogName} aktywnie szuka pozycji SIAD przy twoim powitaniu. Skakanie stało się rzadsze, rodzina konsekwentnie trzyma się reguły. Także twoje własne reakcje na ponowne spotkanie stały się spokojniejsze, bez dramatycznego „cześć”.",
      jetzt_anpassen: "Jeśli jeden członek rodziny jeszcze ustępuje, to najważniejszy plac budowy. Jedna niekonsekwencja na tydzień kosztuje tydzień postępu w nauce. Jeśli SIAD jako powitanie jeszcze nie przychodzi sam z siebie, ćwicz go znów aktywnie w 10 powitaniach dziennie.",
      stolperfallen: "Odpychanie psa kolanem albo krzyczenie. Jedno i drugie to uwaga za skakanie, czyli nagroda. Klasyk również: „przepuszczenie skoku ten jeden raz”, gdy się spieszysz. Bardzo szybko robi się z tego powtarzalny wzorzec.",
      vermeidet: "Pracować już ze skomplikowanymi scenariuszami z gośćmi, zanim stoi spójność rodziny. Najpierw dom, potem goście."
    },
    steigerung: {
      bausteine: "Rozszerzona sekwencja z gościem z dzwonkiem i kocem, SIAD jako automatyczna reakcja powitania bez sygnału, konsekwencja w większej liczbie codziennych sytuacji (wstawanie, start spaceru, czas zabawy), kontrolowane spotkania z przechodniami na zewnątrz",
      schon_merken: "Przy dzwonku {dogName} biegnie do koca. Goście są wcześniej poinformowani i poprawnie poinstruowani. SIAD jest w kilku sytuacjach dnia oferowany automatycznie, bez potrzeby zapowiadania. Także na spacerze {dogName} siada przy przechodniach.",
      jetzt_anpassen: "Przy trudnych gościach (dzieci, lękliwi ludzie) zaprowadź {dogName} na koc i tam zostaw. Dopiero po jasnym sygnale OK — powitanie. Jeśli SIAD przy przechodniach jeszcze się chwieje, wróć do większego dystansu i ćwicz przy mniejszym zalewie bodźców.",
      stolperfallen: "Nie informować gości z założeniem „jakoś to będzie”. Będą głaskać skaczącego psa i tym wzmacniać zachowanie. Klasyk również: stawanie się niekonsekwentnym wobec siebie samego, bo „przecież się ucieszył”.",
      vermeidet: "Wizyty grupowe bez przygotowania. Więcej osób oznacza więcej potencjalnej niespójności."
    },
    generalisierung: {
      bausteine: "Rutyna podtrzymująca z codziennym ćwiczeniem powitania, regularne testy stresowe z nowymi gośćmi, długoterminowa spójność rodziny, plan awaryjny przy nawrotach",
      schon_merken: "Skakanie jest wyjątkiem, nie normą. Czujesz się przygotowany na nowe osoby albo wizyty grupowe. Rutyna podtrzymująca działa mimochodem. Testy stresowe pokazują stabilne reakcje.",
      jetzt_anpassen: "Przy nawrotach: 1 tydzień ekstra-konsekwentnie, powtórzyć odprawę rodzinną, znów wysoka częstotliwość nagród. Nowych członków rodziny (partner, współlokator) od razu włącz, inaczej skakanie wróci przez nich.",
      stolperfallen: "Pozwolić, by spójność w codzienności się rozluźniła, bo „przecież zrobił się grzeczny”. Skakanie jest zawsze 1 niekonsekwencję od powrotu. Klasyk również: przy własnej ekscytacji (święto, urodziny) pozwolić psu skakać, bo „dziś jest przecież coś wyjątkowego”.",
      vermeidet: "Całkiem pomijać testy stresowe, bo „przecież działa”. Bez testu stresowego zauważysz nawroty dopiero, gdy już są w rutynie."
    }
  },
  destructive: {
    fundament: {
      bausteine: "Analiza przyczyn zakończona (nuda vs lęk separacyjny vs potrzeba gryzienia), 4-5 dozwolonych przedmiotów do gryzienia ustalonych w rotacji, strefy zarządzania na czas nieobecności urządzone, wymiana zamiast kary przy zakazanych przedmiotach",
      schon_merken: "Wiesz, czy niszczenie bierze się z nudy, lęku czy potrzeby gryzienia, i punkt ciężkości treningu jest jasny. {dogName} ma ulubione przedmioty do gryzienia i używa ich dłużej niż tylko kilka minut. Przy zakazanych przedmiotach reagujesz wymianą, a nie besztaniem.",
      jetzt_anpassen: "Jeśli przedmiot do gryzienia szybko się nudzi, odłóż go na 1-2 tygodnie, potem znów jest interesujący. Jeśli strefa zarządzania nie jest akceptowana, zbuduj ją jako ulubione miejsce z pozytywnym skojarzeniem.",
      stolperfallen: "Besztać psa, gdy znajdujesz zniszczony przedmiot. {dogName} nie potrafi tego połączyć z czynem, a stres i tak pozostaje. Klasyk również: gonienie psa, gdy ma coś w pysku. Czysta radość zabawy dla psa.",
      vermeidet: "Oddawać podniesiony zakazany przedmiot po wymianie. Wtedy wymiana nie jest prawdziwa i gotowość maleje."
    },
    steigerung: {
      bausteine: "Ustrukturyzowany plan zajęć wdrożony z mieszanką ruchu, węchu i głowy, przedmioty do gryzienia rotują rutynowo, zarządzanie ostrożnie rozluźnione tam, gdzie jest bezpiecznie, długie fazy leżenia świadomie trenowane",
      schon_merken: "{dogName} jest wieczorem wyczerpany, nie nakręcony. Mieszanka zajęć chwyta, niszczenie w obecności jest wyraźnie rzadsze. Długie fazy na kocu są znoszone spokojnie. Pierwsze udostępnione strefy są akceptowane bez niszczenia.",
      jetzt_anpassen: "U młodych psów (4-9 miesięcy): więcej pracy głową, mniej monotonnego szaleństwa. U dorosłych: więcej pracy węchowej. Jeśli długie fazy leżenia jeszcze się chwieją, wróć do krótszych z zajęciem z Kongiem.",
      stolperfallen: "Zrezygnować całkowicie z zarządzania, bo „przez tydzień nic się nie stało”. Rejony ryzyka pozostają rejonami ryzyka. Klasyk również: robienie sesji gryzienia za krótkich. 15-30 minut to czas działania, a nie 5 minut.",
      vermeidet: "Piętrzenie kilku ekscytujących aktywności tego samego dnia. Jeśli niszczenie jest objawem stresu, stres zaostrza je dalej."
    },
    generalisierung: {
      bausteine: "Długoterminowy tygodniowy plan zajęć ustalony, asortyment przedmiotów do gryzienia regularnie utrzymywany i rozszerzany, znaleziona równowaga zarządzania z jasnymi strefami bezpiecznymi i zakazanymi, plan awaryjny na fazy stresu",
      schon_merken: "{dogName} jest długoterminowo zrównoważony, niszczenie to wyjątek. Masz jasny obraz, które strefy są bezpieczne, a które nie. Na fazy stresu (Boże Narodzenie, urlop, zmiany) masz strategię.",
      jetzt_anpassen: "Trzymaj plan zajęć także w weekend. Przy nowych sytuacjach życiowych (przeprowadzka, zmiana w rodzinie) zwiększ na chwilę znów zarządzanie i zajęcia. Sprawdzaj co kilka tygodni asortyment do gryzienia pod kątem zużycia.",
      stolperfallen: "Rozmiękczać plan zajęć, bo „zrobił się przecież spokojny”. Spokój bierze się z planu, a nie znikąd. Klasyk również: w stresujące dni mniej zajęć, bo brak czasu. Wtedy {dogName} niszczy z frustracji.",
      vermeidet: "Otwierać rejony ryzyka całkowicie z oczekiwaniem „teraz przecież działa”. Ostrożność jest tańsza niż zniszczona sofa."
    }
  },
  soiling: {
    fundament: {
      bausteine: "Przewidywalna rutyna toaletowa z 5-7 stałymi rundami dziennie, nagroda bezpośrednio na miejscu i we właściwym momencie, nauka czytania sygnałów (węszenie, kręcenie się, niepokój), spokojne obchodzenie się z wypadkami bez kary",
      schon_merken: "Znasz wzorzec toaletowy {dogName} i wychodzisz proaktywnie, nie reaktywnie. Przy większości rund wychodzi w zwykłym miejscu. Wypadki stały się rzadsze, a jeśli się zdarzą, pozostajesz spokojny i używasz środka enzymatycznego. Oznaki sygnałów rozpoznajesz szybciej niż na starcie planu.",
      jetzt_anpassen: "Jeśli wypadki są dalej częste, poproś weterynarza o wykluczenie zapalenia pęcherza albo innej przyczyny medycznej. U młodych psów: podnieś jeszcze częstotliwość na co 1-2 godziny. Przy zabrudzaniu wywołanym stresem: zredukuj czynniki stresu.",
      stolperfallen: "Besztanie albo wtykanie nosa przy wypadku. Tym {dogName} uczy się chować, a nie stawać czystym w domu. Klasyk również: akceptowanie tylko jednego miejsca na zewnątrz zamiast generalizowania. Później {dogName} jest wtedy niepewny w innych miejscach.",
      vermeidet: "Oczekiwać, że czystość w domu rozwinie się sama. Potrzebuje aktywnej nagrody i rutyny."
    },
    steigerung: {
      bausteine: "Częstotliwość toaletowa stopniowo zredukowana przy sukcesie, czytanie sygnałów zautomatyzowane, nagroda stopniowo urozmaicana, generalizacja na różne trasy",
      schon_merken: "{dogName} wytrzymuje dłuższe fazy bez parcia na toaletę, planujesz z wyraźnie większym marginesem. W nowych miejscach wychodzi po krótkim oswojeniu. Oznaki sygnałów są rozpoznawane i obsługiwane niemal odruchowo.",
      jetzt_anpassen: "Jeśli zredukowana częstotliwość przynosi wypadki, wróć do ściślejszej rutyny. Przy zabrudzaniu wywołanym stresem: pracuj nad tolerancją na stres przy mini-stresorach. U starszych psów: kontrola u weterynarza, gdy częstotliwość znów rośnie.",
      stolperfallen: "Zrezygnować całkowicie z nagrody, bo działa. Wzmacnianie zmienne pozostaje ważne, inaczej zachowanie może erodować. Klasyk również: mieć za mało cierpliwości przy nowych trasach.",
      vermeidet: "Ryzykować długie fazy bez rundy toaletowej w stresujące dni albo w nowych otoczeniach. Bezpieczeństwo najpierw."
    },
    generalisierung: {
      bausteine: "Długoterminowa rutyna z 3-4 stałymi rundami dziennie, czystość w domu także w nowych otoczeniach, dożywotnia higiena stresu, dopasowanie do wieku u starszych psów",
      schon_merken: "{dogName} jest długoterminowo czysty w domu, także przy podróżach czy wizytach. Masz jasną rutynę, która wydaje się oczywista. Stres w innych miejscach rozpoznajesz wcześnie, zanim wpłynie na czystość w domu.",
      jetzt_anpassen: "Z wiekiem {dogName} potrzebuje ewentualnie znów częstszych rund, obserwuj aktywnie. U starszych psów przy wzroście częstotliwości: kontrola u weterynarza. Przy nawrotach wywołanych stresem: na chwilę zagęść rutynę.",
      stolperfallen: "Zapominać o rutynie we własnym pośpiechu. Czystość w domu potrzebuje dalej aktywnej pielęgnacji. Klasyk również: ignorowanie zmian związanych z wiekiem z myślą „przecież jest czysty w domu”. Starsze psy potrzebują dopasowań.",
      vermeidet: "Przy wypadkach znów zaczynać z besztaniem. Także po latach czystości w domu kara jest błędem."
    }
  }
};
function phaseName(phase: Phase): string {
  if (phase === "fundament") return "faza fundamentu";
  if (phase === "steigerung") return "faza wzmacniania";
  return "faza generalizacji";
}

function buildMonatsUebersichten(
  problem: ProblemKey,
  weeksTotal: number,
  monthsTotal: number,
  dog: DogProfile,
  problemLabel: string,
  customProblemText?: string
): Array<{ monat: number; text: string }> {
  const dogName = dog.dogName || "Twój pies";
  const out: Array<{ monat: number; text: string }> = [];
  const ranges = phaseRanges(weeksTotal);

  const customRef = customProblemText
    ? `\n\nSzczególnie w waszej sytuacji: "${customProblemText.slice(0, 200)}". Trzymaj ten kontekst aktywnie w głowie — to właśnie jest prawdziwa dźwignia treningu.`
    : "";

  // Fallback na dane pulling, jeśli dany problem nie jest jeszcze uzupełniony
  const phaseDaten = PHASE_TEXTE[problem] || PHASE_TEXTE.pulling;

  for (let m = 1; m <= monthsTotal; m++) {
    const endWeek = Math.min(m * 4, weeksTotal);
    const phase = phaseForWeek(endWeek, weeksTotal);
    const isEndOfPhase = endWeek === ranges[phase].end;
    const daten = phaseDaten[phase];

    const phaseHeader = isEndOfPhase
      ? `Po tygodniu ${endWeek} ${phaseName(phase)} jest zakończona. Te tygodnie zbudowały u Ciebie najważniejsze elementy: ${daten.bausteine}.`
      : `Półmetek w fazie: ${phaseName(phase)} (po tygodniu ${endWeek}). Elementy tej fazy: ${daten.bausteine}. Nie jesteśmy jeszcze na końcu, ale kierunek jest wyznaczony.`;

    const text = `${phaseHeader}

Co już teraz powinieneś zauważyć: ${personalize(daten.schon_merken, dog)}

Co teraz możesz dostosować: ${personalize(daten.jetzt_anpassen, dog)}

Częste pułapki na tym etapie: ${personalize(daten.stolperfallen, dog)}

Czego teraz unikasz: ${personalize(daten.vermeidet, dog)}${customRef}`;

    out.push({ monat: m, text });
  }

  return out;
}

// ── Dodatkowe gry: 3 specyficzne dla problemu ćwiczenia bonusowe na problem ───
// Uzupełniają one plany tygodniowe i celowo NIE są kopiami
// ćwiczeń podstawowych. Pasują do tego samego zestawu umiejętności, ale dają
// urozmaicenie dla opiekunów, którym zadania tygodniowe to za mało lub którzy
// szukają zabawy na chwilę pomiędzy.
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
      name: "Loteria kontaktu wzrokowego",
      ziel: "Wzmocnienie dobrowolnego kontaktu wzrokowego na spacerze",
      schritte: [
        "Podczas marszu: za każdym razem, gdy {dogName} na Ciebie spojrzy, DOBRZE + smakołyk przy szwie nogawki",
        "Ważne: nie wołaj, nie klaszcz — nagradzaj tylko dobrowolne spojrzenie",
        "Przez trzy dni konsekwentnie, potem wystarczy nagradzać co 3. spojrzenie",
        "Po 7 dniach: {dogName} przy niepewności samo zerka na Ciebie",
      ],
      warum: "Niezawodny kontakt wzrokowy to podstawa każdej korekty na smyczy. {dogName} uczy się: to ja jestem punktem odniesienia, a nie otoczenie.",
    },
    {
      nummer: 2,
      name: "Slalom między nogami",
      ziel: "Budowanie uwagi i związania z tempem w domu",
      schritte: [
        "Stań swobodnie, nogi rozstawione na szerokość barków",
        "Zwab {dogName} smakołykiem przez lewą nogę do tyłu, a potem przez prawą nogę znów do przodu",
        "5 rundek slalomu, potem jackpot z 3 smakołyków",
        "Podniesienie poprzeczki: tempo, potem bez zwabiania smakołykiem, tylko za pomocą gestu ręką",
      ],
      warum: "Ćwiczy dopasowanie do tempa i obserwację — dokładnie te umiejętności, które później zadziałają przy chodzeniu na luźnej smyczy.",
    },
    {
      nummer: 3,
      name: "Zmiana stój-siad na dystans",
      ziel: "Doszlifowanie hamowania impulsu i wrażliwości na słuch",
      schritte: [
        "{dogName} stoi 2 m przed Tobą, bez smyczy, w domu",
        "Powiedz spokojnie SIAD — gdy tylko usiądzie: DOBRZE, a zaraz potem STÓJ",
        "Zmieniaj 6-8 razy, nigdy nie zwabiając, zawsze tylko głosem",
        "Podniesienie poprzeczki: 5 m dystansu, potem z krótkim rozproszeniem (otwarte drzwi, dźwięk)",
      ],
      warum: "Sygnały głosowe na dystans to niezawodny sprawdzian, jak pewnie naprawdę siedzą podstawy.",
    },
  ],
  energy: [
    {
      nummer: 1,
      name: "Wybór z trzech kubków",
      ziel: "Praca umysłowa, 5 minut koncentracji",
      schritte: [
        "3 odwrócone kubki na podłodze, w jednym smakołyk — {dogName} patrzy, jak go pod nim chowasz",
        "Mieszaj kubki powoli, powiedz WYBIERZ — {dogName} wskazuje łapą lub nosem",
        "Trafione: DOBRZE + smakołyk, nowa runda. Pudło: brak reakcji, mieszaj jeszcze raz",
        "Na sesję 5-7 rund, potem koniec — koncentracja męczy szybciej niż ruch",
        "Podniesienie poprzeczki po 1 tygodniu: 4 albo 5 kubków, albo zamieniasz kubki podczas mieszania",
      ],
      warum: "Praca umysłowa kosztuje wymiernie więcej energii niż fizyczna. Pięć minut zabawy z kubkami jest bardziej męczące niż pół godziny aportowania.",
    },
    {
      nummer: 2,
      name: "Kong z kostką lodu na kanapę",
      ziel: "Długie zajęcie się sobą przy wieczornym niepokoju",
      schritte: [
        "Napełnij Kong mokrą karmą i cienką warstwą jogurtu, zamroź na 4 godziny",
        "{dogName} dostaje go na swoim kocu obok kanapy, wieczorem",
        "Ty w tym czasie spokojnie oglądasz telewizję, świadomie nie zwracasz uwagi na {dogName}",
        "{dogName} pracuje 40-60 minut w skupieniu i potem najczęściej zasypia",
        "Jeśli po 30 minutach pojawia się frustracja: kostka lodu jest za twarda — następnym razem daj mniej jogurtu",
      ],
      warum: "Lód wydłuża zajęcie trzykrotnie, a przy okazji chłodzi. Idealne na wieczorną fazę, w której {dogName} inaczej się nakręca.",
    },
    {
      nummer: 3,
      name: "Spokojne przeciąganie ze stopem",
      ziel: "Kontrolowane podkręcanie i wyciszanie pobudzenia",
      schritte: [
        "Weź miękką zabawkę, przyjaźnie zaproś {dogName} do przeciągania",
        "Baw się 30-60 sekund powoli i pod kontrolą, to Ty trzymasz tempo",
        "Powiedz nagle STOP i zastygnij — żadnego ruchu, żadnego powtarzania słowa",
        "Gdy tylko {dogName} puści albo się uspokoi: DOBRZE, smakołyk, krótka przerwa",
        "Zabawa rusza dalej dopiero po 5-10 sekundach spokoju — na sesję 4-6 zmian",
        "Podniesienie poprzeczki: STOP w środku obrotu, a nie tylko przy przeciąganiu",
      ],
      warum: "{dogName} uczy się wyciszać w środku ekscytującej zabawy. Wyłącznik w głowie, którego brakuje wielu nadpobudliwym psom — oparty na ruchu, nie tylko na węchu.",
    },
  ],
  aggression: [
    {
      nummer: 1,
      name: "Zabawa w koc-wyspę",
      ziel: "Koc staje się bezpiecznym schronieniem w sytuacjach stresowych",
      schritte: [
        "Koc leży na stałe w spokojnym miejscu, nigdy gdzie indziej",
        "5x dziennie: wejście na koc = DOBRZE + smakołyk + spokojne głaskanie",
        "Po 7 dniach: przy małym niepokoju powiedz KOC, {dogName} tam idzie",
        "Przy prawdziwym stresie później: koc jest kotwicą, tam się wycisza",
      ],
      warum: "Potrzebujesz miejsca awaryjnego, które NIE jest smyczą. Koc przez tygodnie staje się warunkowym wyzwalaczem poczucia bezpieczeństwa.",
    },
    {
      nummer: 2,
      name: "Popatrz na wszystko",
      ziel: "Patrzenie na bodziec bez nakręcania się — kluczowe zachowanie",
      schritte: [
        "W domu z nieszkodliwymi przedmiotami: zabawka, poduszka, but",
        "Postaw przedmiot przed {dogName}: gdy tylko na niego spojrzy, DOBRZE + smakołyk",
        "Podnoszenie poprzeczki: ruchome przedmioty, potem z lekkim dźwiękiem",
        "Cel: spojrzenie na bodziec = oczekiwanie nagrody, zamiast narastania pobudzenia",
      ],
      warum: "Trenuje wzorzec emocjonalny, który później na dworze zadziała przy prawdziwych wyzwalaczach. Czysta praca wstępna w domu, bez ryzyka eskalacji.",
    },
    {
      nummer: 3,
      name: "Synchronizacja oddechu na kocu",
      ziel: "Redukcja stresu poprzez przekazanie własnego spokoju",
      schritte: [
        "{dogName} na kocu, Ty siadasz obok",
        "Oddychaj świadomie, głęboko i powoli, ręka spokojnie na klatce piersiowej psa",
        "{dogName} po 2-3 min synchronizuje oddech",
        "Utrzymaj 5-10 min — działa też po trudnym spacerze",
      ],
      warum: "Psy odczytują Twój poziom stresu. Kto sam się wycisza, wycisza swojego psa. Dobrze udokumentowane naukowo.",
    },
  ],
  mouthing: [
    {
      nummer: 1,
      name: "Piramida wymiany w domu",
      ziel: "Budowanie PUŚĆ przy rosnącej wartości bez stresu",
      schritte: [
        "Poziom 1: dajesz {dogName} nudną zabawkę, mówisz PUŚĆ + wymieniasz na smakołyk",
        "Poziom 2: ulubiona zabawka, PUŚĆ + wymiana na smakołyk",
        "Poziom 3: gryzak, PUŚĆ + kurczak jako mega-wymiana",
        "Ważne: oddawaj przedmiot po 3 sek — wymiana kończy się pozytywnie",
        "Dziennie 1 poziom, przez tydzień",
      ],
      warum: "PUŚĆ musi siedzieć zanim pojawi się gorący punkt na dworze. Stopniowanie wartości to jedyna droga bez zatrucia sygnału.",
    },
    {
      nummer: 2,
      name: "Szukanie nagrody zamiast podnoszenia",
      ziel: "Alternatywa dla popędu szukania na spacerze",
      schritte: [
        "Przed spacerem: 20 smakołyków w kieszeni spodni",
        "Gdy {dogName} węsząc schodzi do ziemi: rzuć 2-3 smakołyki w trawę",
        "Powiedz SZUKAJ — {dogName} szuka dozwolonej nagrody zamiast przypadkowych śmieci",
        "Przez 2 tygodnie: najpierw sprawdza Ciebie, potem ziemię",
      ],
      warum: "Popęd szukania zostaje zaspokojony, a {dogName} nie podnosi wszystkiego. Kieszeń spodni staje się lepszym dostawcą niż ziemia.",
    },
    {
      nummer: 3,
      name: "Memory z puszczaniem i trzema przedmiotami",
      ziel: "PUŚĆ także przy kilku pokusach z rzędu",
      schritte: [
        "Połóż 3 różne przedmioty (kość, zabawka, nieszkodliwy karton)",
        "{dogName} bierze jeden: PUŚĆ + wymiana + zabranie przedmiotu 1",
        "Pozwól podnieść następny: PUŚĆ + wymiana + zabranie",
        "5 rund na sesję — {dogName} uczy się: każde oddanie się opłaca",
      ],
      warum: "Kilka PUŚĆ pod rząd buduje tolerancję na frustrację. W codzienności na dworze rzadko trafia się tylko jedno znalezisko.",
    },
  ],
  recall: [
    {
      nummer: 1,
      name: "Przywołanie z chowanego",
      ziel: "Zakotwiczenie DO MNIE z wielkim entuzjazmem w zabawie",
      schritte: [
        "Druga osoba delikatnie przytrzymuje {dogName}",
        "Ty chowasz się 5-10 m dalej, a potem radośnie wołasz DO MNIE",
        "{dogName} zostaje puszczony — aktywnie Cię szuka",
        "Przy dotarciu: MEGA-nagroda, entuzjazm, zabawa",
        "10-15 rund działa cuda, bardziej niż każde ćwiczenie na sucho",
      ],
      warum: "Szukanie + znalezienie + sukces = najsilniejsze skojarzenie. DO MNIE staje się emocjonalnym highlightem zamiast obowiązkowym sygnałem.",
    },
    {
      nummer: 2,
      name: "Nagroda z rzucania smakołyków",
      ziel: "Uatrakcyjnienie przywołania dla psów z silnym popędem łowieckim",
      schritte: [
        "Miej woreczek ze szczególnie wartościowymi smakołykami (kurczak, ser)",
        "Przy każdym DO MNIE: przy dotarciu rzuć 2-3 smakołyki jeden po drugim przed jego łapy",
        "{dogName} goni nagrodę — popęd łowiecki zostaje zaspokojony",
        "Podniesienie poprzeczki: tylko 1 z 3 przywołań z rzucaniem, reszta klasycznie",
      ],
      warum: "Psy z popędem łowieckim potrzebują ruchu w nagrodzie, nie tylko smakołyka z ręki. Sprawia, że DO MNIE staje się najatrakcyjniejszą opcją na spacerze.",
    },
    {
      nummer: 3,
      name: "Gwizdek w trzech krokach",
      ziel: "Czyste zwarunkowanie gwizdka jako drugiego sygnału",
      schritte: [
        "W domu krok 1: krótki gwizd + natychmiast nagroda. 10x dziennie, przez 5 dni",
        "Krok 2: krótki gwizd, {dogName} przychodzi z 3 m dystansu: nagroda",
        "Krok 3: krótki gwizd na dworze z 10 m, na długiej lince: MEGA-nagroda",
        "Nigdy nie używaj gwizdka do negatywów — pozostaje pozytywnym zabezpieczeniem",
      ],
      warum: "Gwizdek sięga dalej niż głos, brzmi zawsze tak samo (niezależnie od tego, jak bardzo jesteś zestresowany) i w nagłej sytuacji jest pewniejszy niż słowo.",
    },
  ],
  barking: [
    {
      nummer: 1,
      name: "Marker ciszy na chwile milczenia",
      ziel: "Aktywne wzmacnianie faz ciszy zamiast tylko zarządzania szczekaniem",
      schritte: [
        "Gdy tylko {dogName} nie szczeka przez 3 sekundy po przerwie w szczekaniu: CICHO + miękki smakołyk",
        "Ważne: nie czekaj, aż zaszczeka — cisza jest nagrodą",
        "8-10 razy dziennie, w każdej spokojnej fazie",
        "Po 2 tygodniach: {dogName} aktywnie szuka faz ciszy, bo się opłacają",
      ],
      warum: "Psy szybciej uczą się tego, co mają DOSTAĆ, niż tego, czego mają ZANIECHAĆ. Wzmacnianie ciszy bije każdy środek na szczekanie.",
    },
    {
      nummer: 2,
      name: "Zwarunkowanie na nagranie dzwonka",
      ziel: "Emocjonalne przeuczenie dźwięku dzwonka, bez używania prawdziwego dzwonka",
      schritte: [
        "Nagraj dźwięk dzwonka na telefon (własny dzwonek, wiernie oddany)",
        "Odtwarzaj w domu na cichej głośności — jednocześnie smakołyk do pyska",
        "Po 10 powtórzeniach: lekko zwiększ głośność",
        "Przez 2 tygodnie: {dogName} przy prawdziwym dźwięku dzwonka oczekuje smakołyka zamiast się nakręcać",
      ],
      warum: "Klasyczne przeciwwarunkowanie. Przebudowujesz reakcję, ZANIM zaczniesz pracować z prawdziwymi gośćmi u drzwi.",
    },
    {
      nummer: 3,
      name: "Test trzech sekund",
      ziel: "Skracanie faz szczekania przez konsekwentne odwracanie się",
      schritte: [
        "Gdy tylko {dogName} zaszczeka: odwracasz się bez komentarza, nie patrzysz",
        "Gdy tylko 3 sek ciszy: CICHO + smakołyk + spokojne zwrócenie uwagi",
        "Konsekwencja jest kluczowa — jedna osoba z rodziny, która patrzy, sabotuje ćwiczenie",
        "Po 7 dniach: szczekanie dla uwagi wyraźnie się zmniejsza",
      ],
      warum: "Szczekanie dla uwagi jest wzmacniane przez KAŻDĄ reakcję — także przez besztanie. Odwrócenie się to jedyna czysta odpowiedź.",
    },
  ],
  anxiety: [
    {
      nummer: 1,
      name: "Zabawa klucze-cukierek",
      ziel: "Odczepienie wyzwalaczy pożegnania, bez wychodzenia",
      schritte: [
        "Weź klucze do ręki, pobrzęknij raz — natychmiast daj smakołyk",
        "Odłóż klucze z powrotem, ŻADNEGO wychodzenia",
        "10-15x dziennie, zupełnie niezależnie od faktycznego wychodzenia",
        "Po 2 tygodniach: brzęk kluczy wywołuje oczekiwanie nagrody zamiast lęku",
      ],
      warum: "Wyzwalacze przygotowań budują stres na długo przed tym, zanim otworzysz drzwi. Odczepienie to sedno każdej terapii lęku separacyjnego.",
    },
    {
      nummer: 2,
      name: "Samotny Kong na kocu bezpieczeństwa",
      ziel: "Budowanie doświadczenia bycia samemu krok po kroku",
      schritte: [
        "Przygotuj specjalny Kong (tylko na czas samotności, poza tym nigdy) — zamrożona mokra karma",
        "{dogName} dostaje Kong na kocu, Ty wychodzisz z pomieszczenia na 2-3 min",
        "Obserwuj przez wideo: pracuje przy Kongu czy pokazuje stres?",
        "Przy spokojnej pracy: kolejny krok 5 min, 10 min, 20 min",
      ],
      warum: "Kong staje się ekskluzywnym narzędziem na samotność. Stres zostaje sprzężony z zajęciem — pies ma coś do roboty, zamiast skupiać się na nieobecności.",
    },
    {
      nummer: 3,
      name: "Rutyna wejść-wyjść bez dramatu",
      ziel: "Uczynienie rutyn przy drzwiach tak banalnymi, że nie wyzwalają już stresu",
      schritte: [
        "Kilka razy dziennie: otwórz drzwi, wyjdź na chwilę, wróć",
        "Ani słowa, ani kontaktu wzrokowego z {dogName}, ani przy wejściu, ani przy wyjściu",
        "Podnoszenie poprzeczki: 30 sek na dworze, 2 min, 5 min — za każdym razem bez zamieszania",
        "Powitanie po powrocie jest spokojne, a nie radośnie głośne",
      ],
      warum: "Dramatyczne pożegnania mówią psu: to tutaj jest ważne wydarzenie. Banalność odbiera rozstaniu znaczenie.",
    },
  ],
  jumping: [
    {
      nummer: 1,
      name: "Loteria czterech łap",
      ziel: "Uczynienie kontaktu z podłogą standardową nagrodą",
      schritte: [
        "Kilka razy dziennie mimochodem: 4 łapy na podłodze = spokojnie połóż smakołyk między przednie łapy",
        "Kompletnie bez wezwania, po prostu przechodząc obok",
        "Gdy {dogName} skacze: brak reakcji, odejdź",
        "Po 10 dniach: pies aktywnie szuka podłogi, bo podłoga = nagroda",
      ],
      warum: "Skakania się nie oducza, tylko zastępuje bardziej atrakcyjną alternatywą. Kontakt z podłogą się opłaca.",
    },
    {
      nummer: 2,
      name: "Siad przed powitaniem",
      ziel: "Ustanowienie SIAD jako odruchowej reakcji na powitanie",
      schritte: [
        "Przy KAŻDYM powitaniu (rodzina, Ty sam, gość): najpierw żądaj SIAD, potem przyjaźnie się przywitaj",
        "Gdy {dogName} wstaje, żeby skoczyć: przerwij głaskanie, odejdź, zacznij od nowa",
        "Odprawa rodzinna: wszyscy ciągną wspólnie, inaczej jedna osoba sabotuje pracę",
        "Po 14 dniach: {dogName} sam siada przy każdym powitaniu",
      ],
      warum: "Powitanie to moment warunkowania numer 1. Konsekwencja przy każdym powitaniu wpłaca 10x, brak konsekwencji kasuje efekt uczenia.",
    },
    {
      nummer: 3,
      name: "Koc zamiast drzwi",
      ziel: "Przekierowanie reakcji na dzwonek: do koca zamiast do drzwi",
      schritte: [
        "Umieść koc 3 m od drzwi, z ulubionym gryzakiem",
        "Ćwiczenia na sucho: dźwięk dzwonka (telefon), sygnał KOC, {dogName} biegnie do koca",
        "Nagroda na kocu, nigdy przy drzwiach",
        "Po 1 tygodniu prawdziwi goście: jeden dzwoni, jeden w środku z nagrodą przy kocu",
      ],
      warum: "Strefa drzwi to punkt najwyższego pobudzenia. Kto chce tam dotrzeć, skacze. Koc dokonuje przesunięcia w przestrzeni — pobudzenie nie może się rozładować.",
    },
  ],
  destructive: [
    {
      nummer: 1,
      name: "Siedmiodniowa rotacja gryzaków",
      ziel: "Utrzymanie dozwolonych gryzaków atrakcyjnymi",
      schritte: [
        "Zdobądź 5-7 różnych gryzaków: skóra bawola, kość drewniana, mata węchowa, Kong, naturalne gryzaki",
        "Dziennie udostępniany jest JEDEN przedmiot, wszystkie inne schowane",
        "Rotacja dzienna: po 7 dniach każdy przedmiot znów jest ekscytujący",
        "Zakazany materiał (buty, kanapa): proaktywnie poza zasięgiem, a nie przez karę",
      ],
      warum: "Ten sam gryzak każdego dnia robi się nudny. Rotacja utrzymuje atrakcyjność wysoko, bez ciągłego dokupowania.",
    },
    {
      nummer: 2,
      name: "Trening kojca z zajęciem",
      ziel: "Ustanowienie kojca lub strefy jako spokojnego miejsca do zajęć",
      schritte: [
        "Otwórz kojec, włóż do środka Kong/matę węchową — drzwiczki otwarte",
        "{dogName} może wchodzić/wychodzić, zajęcie odbywa się tylko w środku",
        "Przez 2 tygodnie: pies sam wchodzi do środka po zajęcie",
        "Krok 2: zamknij drzwiczki raz na 5 min, przy aktywnym Kongu — pies prawie tego nie zauważa",
      ],
      warum: "Bezpieczna strefa na fazy samotności + zapobiega niszczeniu przedmiotów na zewnątrz. Kojec to narzędzie, nie kara.",
    },
    {
      nummer: 3,
      name: "Poszukiwanie skarbu w salonie",
      ziel: "Rozładowanie energii przez nos zamiast przez zęby",
      schritte: [
        "Schowaj 10 małych smakołyków w salonie — pod poduszkami, za nogami, lekko wyżej",
        "{dogName} dostaje sygnał SZUKAJ, Ty odchylasz się do tyłu",
        "10-15 min skupionego zajęcia szukaniem",
        "3-4 razy w tygodniu — zastępuje spacer w deszczowe dni",
      ],
      warum: "Popęd gryzienia i niszczenia wymiernie spada po pracy węchowej. Zmęczony nos = spokojne łapy.",
    },
  ],
  soiling: [
    {
      nummer: 1,
      name: "Zwarunkowanie słowa na siusiu",
      ziel: "Budowanie hasła na robienie siusiu — cenne w podróży",
      schritte: [
        "Gdy tylko {dogName} zaczyna robić siusiu na dworze: powiedz spokojne słowo SIU-SIU",
        "Podczas aktu NIE chwal (rozprasza), DOPIERO POTEM: DOBRZE + mega-smakołyk",
        "Przez 3-4 tygodnie słowo połączy się z aktem",
        "Później: w nowych miejscach albo przed długą jazdą samochodem celowo powiedz SIU-SIU",
      ],
      warum: "Oszczędza później godziny w trybie zaparkuj-i-czekaj. Jedno słowo zamiast nadziei.",
    },
    {
      nummer: 2,
      name: "Tracker picia na 7 dni",
      ziel: "Rozpoznanie korelacji między ilością wody a wypadkami",
      schritte: [
        "Zaznacz rano poziom w misce na wodę (taśma na wysokości napełnienia)",
        "Codziennie dokumentuj: ile pies wypił, kiedy, ile wypadków",
        "Po 7 dniach widać wzorzec: pije za dużo naraz, za mało rano itd.",
        "Dostosowanie: ograniczenie wody 2h przed snem przy nocnych wypadkach",
      ],
      warum: "Czystość w domu to często kwestia timingu i ilości, a nie dyscypliny. Dane szybko pokazują problem.",
    },
    {
      nummer: 3,
      name: "Rutyna z dzwonkiem przy klamce",
      ziel: "{dogName} sam sygnalizuje, kiedy musi wyjść",
      schritte: [
        "Zamocuj dzwoneczek przy klamce",
        "Przed każdą rundą do toalety: przyłóż rękę do dzwonka, trąć raz",
        "Otwórz drzwi, wyjdź, nagroda w miejscu na siusiu",
        "Po 3 tygodniach: {dogName} sam trąca dzwonek, kiedy musi wyjść",
      ],
      warum: "Daje {dogName} jednoznaczną możliwość zakomunikowania potrzeby. Redukuje wypadki wynikające z nieporozumień.",
    },
  ],
};

export function composePlan(args: ComposeArgs): TrainingPlanContent {
  const { problem, planLengthMonths, dog, introText, zieleText, abschlussText, customProblemText } = args;
  const weeksTotal = planLengthMonths * 4;
  const monthsTotal = planLengthMonths;

  const problemLabel = PROBLEM_LABELS_PL[problem] || problem;
  const dogName = dog.dogName || "Twój pies";

  // Pula do wyszukiwania ćwiczeń
  let rawPool = EXERCISE_LIBRARY_PL[problem] || [];
  if (rawPool.length === 0) {
    rawPool = EXERCISE_LIBRARY_PL.pulling || [];
    console.warn(`[plan-composer] brak puli dla "${problem}" — fallback pulling`);
  }
  const filteredPool = filterSuitable(rawPool, dog);
  const pool = filteredPool.length > 0 ? filteredPool : rawPool;
  const exById = new Map<string, ExerciseTemplate>();
  for (const e of pool) exById.set(e.id, e);

  // Szablony tygodni specyficzne dla problemu. Fallback: pulling (uwaga
  // + kontrola impulsu są uniwersalnie pomocne), dopóki nie ma dedykowanych
  // bibliotek dla wszystkich 10 problemów.
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

  // Śledzenie: które to z kolei użycie danego ID ćwiczenia w bieżącym planie.
  // Przy powtórzeniu (2., 3., 4. raz) ćwiczenie dostaje w tytule marker etapu
  // plus konkretne zwiększenie jako pierwszy krok. Dzięki temu opiekun widzi:
  // to nie jest 1:1 to samo ćwiczenie, tu dochodzi coś nowego.
  const exerciseUsageCount = new Map<string, number>();

  // Tryb utrwalania: gdy ćwiczenie jest powtarzane i nie ma zdefiniowanego
  // wariantu, uruchamia się osobna choreografia refleksji — ŻADNEGO
  // kopiuj-wklej oryginalnych kroków. Dzięki temu nie powstaje sprzeczność,
  // a opiekun dostaje prawdziwą instrukcję refleksji zamiast czytać ten sam
  // tekst co w tygodniu X.
  function buildFestigungsSchritte(e: ExerciseTemplate, phase: Phase): string[] {
    const exTitle = personalize(e.title, dog);
    const dogN = dog.dogName || "Twój pies";
    const grundDetail =
      phase === "fundament"
        ? "Podstawy muszą najpierw pewnie usiąść, zanim zaczniemy zwiększać poziom."
        : phase === "steigerung"
          ? "Ta faza to inwestycja — kto tu pracuje starannie, w fazie 3 robi największe skoki."
          : "W codzienności każde zachowanie potrzebuje wielu powtórzeń, zanim stanie się odruchem.";

    return [
      `W tym tygodniu utrwalasz ćwiczenie "${exTitle}". ${grundDetail} Zamiast budować nowe treści, patrzysz celowo na to, co jeszcze się chwieje.`,
      `Dzień 1: Obserwacja bez treningu. Który etap ćwiczenia idzie już pewnie, a który nie? Przyjrzyj się ${dogN} świadomie i zanotuj 2-3 konkretne obserwacje.`,
      `Dzień 2-3: Zidentyfikuj TEN jeden krok, który jeszcze nie siedzi w 100%. Nie dwa czy trzy — jeden. Skup się w tym tygodniu tylko na tym jednym miejscu, zamiast przechodzić całe ćwiczenie od nowa.`,
      `Dzień 4-5: Dziennie 3-5 celowych mini-powtórzeń TYLKO w tym miejscu. Krótsze sesje, za to precyzyjniej. Przykład: jeśli marker działa w domu, ale na zewnątrz się chwieje, ćwiczysz na zewnątrz — nie w domu.`,
      `Dzień 6: Niższe wymaganie niż zwykle. Zredukuj słaby punkt do najprostszej formy, którą ${dogN} niezawodnie wykonuje. Sukces jest ważniejszy niż tempo.`,
      `Dzień 7: Podsumowanie. Czy słaby punkt stał się stabilniejszy? Jeśli tak: ćwiczenie w przyszłym tygodniu wraca do normalnego biegu. Jeśli nie: kolejny tydzień utrwalania albo powrót do wcześniejszego etapu.`,
      `Konkretne kroki ćwiczenia znajdziesz w tygodniu, w którym ćwiczenie zostało wprowadzone. Ten tydzień utrwalania to celowe pogłębienie, a nie nauka od nowa.`,
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

    // Przy powtórzeniu ze zdefiniowanym wariantem: CAŁKOWICIE inne kroki
    // (żadnego mieszania z base-steps, które by się z tym kłóciło).
    const variant =
      Array.isArray(e.variants) && stage - 2 < e.variants.length
        ? e.variants[stage - 2]
        : null;

    if (variant) {
      const suffix = variant.titleSuffix || `Etap ${stage}`;
      return {
        name: `${baseTitle} — ${suffix}`,
        schritte: variant.steps.map((s) => personalize(s, dog)),
        stage,
      };
    }

    // Tryb utrwalania: własne kroki refleksji, żadnego kopiuj-wklej.
    return {
      name: `${baseTitle} — tydzień utrwalania`,
      schritte: buildFestigungsSchritte(e, phase),
      stage,
    };
  }

  for (let w = 1; w <= weeksTotal; w++) {
    const phase = phaseForWeek(w, weeksTotal);
    // Pozycja tygodnia WEWNĄTRZ fazy (od 1)
    const positionInPhase = w - ranges[phase].start + 1;

    // Z 8 szablonów na fazę wybierz właściwy.
    // Jeśli tygodni jest mniej niż szablonów, bierz kolejno pierwsze.
    const phaseTpls = weekTpls[phase];
    const tpl = phaseTpls[Math.min(positionInPhase - 1, phaseTpls.length - 1)];

    // Ćwiczenia pobierane z ID zapisanych w szablonie — śledzenie progresji
    // sprawia, że powtórzenia pojawiają się jako etap 2/3/4.
    const uebungen = tpl.exerciseIds
      .map((id) => exById.get(id))
      .filter((e): e is ExerciseTemplate => !!e)
      .map((e) => buildExerciseFromTemplate(e, phase));

    // Jeśli nie znaleziono ćwiczenia (inny problem z fallbackiem pulling, a
    // ID nie ma w puli), weź pierwsze pasujące ćwiczenie danej fazy.
    if (uebungen.length === 0) {
      const fallback = pool.find((e) => e.phase === phase);
      if (fallback) {
        uebungen.push(buildExerciseFromTemplate(fallback, phase));
      }
    }

    // Jeśli dostępne było tylko jedno ćwiczenie: dołóż drugie z puli fazy,
    // żeby każdy tydzień miał co najmniej 2 ćwiczenia. Preferuj takie, które
    // w bieżącym planie nie było jeszcze (lub rzadziej) używane.
    if (uebungen.length === 1) {
      const usedIds = new Set(tpl.exerciseIds);
      const filler = pool
        .filter((e) => e.phase === phase && !usedIds.has(e.id))
        .sort((a, b) => (exerciseUsageCount.get(a.id) || 0) - (exerciseUsageCount.get(b.id) || 0))[0];
      if (filler) {
        uebungen.push(buildExerciseFromTemplate(filler, phase));
      }
    }

    // Tekst akcentu dynamicznie dostosowany, gdy ćwiczenia tygodnia działają
    // już na wyższym etapie. Dzięki temu nie ma sprzeczności między
    // "Łączymy słowo..." (pierwsze wprowadzenie) w tekście akcentu a
    // ćwiczeniem na etapie 3 poniżej.
    const maxStage = Math.max(0, ...uebungen.map((u) => (u as any).stage || 1));
    let weekSchwerpunkt = personalize(tpl.schwerpunkt, dog);
    if (maxStage >= 2) {
      const verb = maxStage === 2 ? "pogłębiamy" : maxStage === 3 ? "utrwalamy" : "zakotwiczamy w codzienności";
      const intro = uebungen
        .filter((u) => (u as any).stage > 1)
        .map((u) => {
          const cleanName = u.name
            .replace(/ — tydzień utrwalania$/, "")
            .replace(/ — .+$/, "");
          return cleanName;
        })
        .slice(0, 2)
        .join(" i ");
      weekSchwerpunkt = `W tym tygodniu ${verb} już wprowadzone ćwiczenie "${intro}". ${weekSchwerpunkt}`;
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

  // Ton zależny od długości planu: 1M = zwięzły + skupiony, 3M = solidny z czasem
  // na każdy krok, 6M = spokojny + dogłębny.
  const tempoBeschreibung =
    planLengthMonths === 1
      ? `Cztery tygodnie to zwięzły dystans. Działamy celowo: najpierw najważniejsze narzędzia, potem szybkie przeniesienie do codzienności. Nastaw się na napięty rytm.`
      : planLengthMonths === 3
        ? `Dwanaście tygodni to spokojny dystans. Masz czas, żeby każdy krok zbudować starannie, zamiast się śpieszyć. Na tydzień wystarczy jedna rzecz, która naprawdę usiądzie.`
        : `Sześć miesięcy to dużo czasu i właśnie to jest zaletą. Możemy w spokoju utrwalić każdy element, wyłapać drobne cofnięcia bez stresu i na końcu osiągnąć prawdziwą generalizację, a nie tylko pierwsze warunkowanie.`;

  const fallbackEinleitung = `Ten plan treningowy został opracowany specjalnie dla ${dogName} i tematu ${problemLabel}. Prowadzi Cię przez ${weeksTotal} tygodni krok po kroku — od spokojnego fundamentu w domu aż po pewne radzenie sobie z trudnymi sytuacjami codzienności.\n\n${tempoBeschreibung}\n\nKażde ćwiczenie jest tak zaprojektowane, żeby dało się je wykonać bez wcześniejszej wiedzy. Potrzebujesz miękkich smakołyków, smyczy, koca i przede wszystkim cierpliwości.`;

  // Briefing sprzętowy specyficzny dla problemu.
  const equipmentBriefings: Record<ProblemKey, string> = {
    pulling: `\n\nSprawdzenie sprzętu: pracuj z dobrze dopasowanymi szelkami typu Y (pas brzuszny leży PRZED klatką piersiową, krzyżak nigdy na szyi). Obroża NIE nadaje się do nauki chodzenia na smyczy, halti/kantar/obroża kolczatka są tabu. Smycz powinna mieć 2-3 m, ŻADNEJ smyczy automatycznej (fleksji).`,
    energy: `\n\nSprawdzenie sprzętu: mata węchowa (ok. 30 €), Kong Classic (rozmiar dopasowany do ${dogName}), 2-3 różne zabawki do węszenia i szukania (Trixie Mover, Buster Cube). Wartościowe smakołyki treningowe — miękkie i małe. Na później: długa linka 5-10 m z biothane do tropienia na zewnątrz.`,
    aggression: `\n\nSprawdzenie sprzętu WAŻNE: kaganiec koszykowy (Baskerville Ultra lub BUMAS, indywidualnie dopasowany — kaganiec z materiału NIE nadaje się, blokuje ziajanie). Smycz prowadząca 2 m, ŻADNEJ smyczy automatycznej. Wartościowa nagroda (kurczak, ser, kiełbasa) ZAWSZE pod ręką. Szelki dla większego bezpieczeństwa przy reakcji.`,
    mouthing: `\n\nSprawdzenie sprzętu: kaganiec koszykowy (Baskerville Ultra) na trasy wysokiego ryzyka — zapobiega podnoszeniu, ale NIE blokuje picia ani ziajania. Smycz prowadząca 2 m na hot-spoty. Wartościowa nagroda do zamiany zawsze w kieszeni.`,
    recall: `\n\nSprawdzenie sprzętu: długa linka 5-10 m z biothane (linka ze sznura parzy dłonie), dobrze dopasowane szelki (długa linka NIGDY przy obroży). Gwizdek dla psa ACME 211.5 jako sygnał zapasowy. Wartościowa nagroda MEGA: kurczak, ser, małe kawałki kiełbasy.`,
    barking: `\n\nSprawdzenie sprzętu: koc relaksacyjny (min. 60x80 cm, stałe miejsce), nagranie dzwonka na telefonie do treningu dzwonka do drzwi, wartościowa nagroda do wzmacniania ciszy. Opcjonalnie: muzyka w tle (klasyka adagio) w fazach z bodźcami z zewnątrz.`,
    anxiety: `\n\nSprawdzenie sprzętu: Kong Classic (rozmiar dopasowany do ${dogName}) jako narzędzie zarezerwowane na czas samotności, koc relaksacyjny jako kotwica bezpieczeństwa, kamera w smartfonie lub kamera smart z podglądem na żywo do obserwacji czasu samotności. Wartościowy wsad do Konga (mokra karma, zamrożenie = trudniej).`,
    jumping: `\n\nSprawdzenie sprzętu: sygnał SIAD musi wcześniej działać niezawodnie. Koc relaksacyjny na przyjmowanie gości. Kartka z instrukcją dla rodziny/gości przy wejściu. Wartościowe smakołyki pod ręką na każde spotkanie.`,
    destructive: `\n\nSprawdzenie sprzętu: 4-5 różnych gryzaków do rotacji (naturalne przysmaki do gryzienia jak skóra bawoli/ścięgno wołowe, Kong Classic, mata węchowa, drewniana kość, poroże). ŻADNYCH gryzaków ze skóry surowej (rawhide) — ryzyko urazu. Kojec lub bramka zabezpieczająca na bezpieczne strefy samotności. Środek enzymatyczny.`,
    soiling: `\n\nSprawdzenie sprzętu WAŻNE: środek enzymatyczny (sklep zoologiczny) na wypadki — zwykły środek nie wystarczy, zapach dla psa pozostaje. Wartościowe nagrody pod ręką na każdą rundę toaletową. Przy częstych wypadkach dorosłego psa: kontrola u weterynarza (zapalenie pęcherza itp.) przed startem treningu.`,
  };
  const equipmentBriefing = equipmentBriefings[problem] || "";

  // Podział na fazy jawnie według długości planu: pokazuje opiekunowi, gdzie
  // jest zapas czasu (3M/6M) i gdzie robi się napięcie (1M).
  const phasenBeschreibung =
    planLengthMonths === 1
      ? `Plan jest podzielony na trzy fazy: fundament w domu (tydzień 1-2), wzmacnianie na zewnątrz (tydzień 3) i generalizacja w codzienności (tydzień 4). Przy zaledwie czterech tygodniach każdy tydzień musi usiąść, zanim otworzymy kolejny.`
      : planLengthMonths === 3
        ? `Plan jest podzielony na trzy fazy: fundament w domu (tydzień 1-4), wzmacnianie na zewnątrz (tydzień 5-8) i generalizacja w codzienności (tydzień 9-12). Na każdą fazę masz cztery tygodnie, co daje zapas przy plateau i cofnięciach.`
        : `Plan jest podzielony na trzy fazy: fundament w domu (tydzień 1-8), wzmacnianie na zewnątrz (tydzień 9-16) i generalizacja w codzienności (tydzień 17-24). Osiem tygodni na fazę pozwala na prawdziwy trening w głąb, z tygodniami podtrzymującymi i przeniesieniem na wiele kontekstów.`;

  const fallbackAufbau = `${phasenBeschreibung}\n\nKażdy tydzień zawiera jasne cele tygodniowe, plan dnia i konkretne ćwiczenia z instrukcją krok po kroku. Jedna do dwóch dobrze wykonanych sesji treningowych dziennie wystarczy. Jakość bije czas trwania.${equipmentBriefing}`;
  // Zdanie o celu specyficzne dla problemu, zamiast toporne wstawianie wprost
  const ZIEL_FORMULIERUNGEN: Record<ProblemKey, string> = {
    pulling: "chodzić wyraźnie spokojniej na smyczy",
    energy: "wyraźnie lepiej regulować swoją energię i częściej dochodzić do spokoju",
    aggression: "wyraźnie spokojniej radzić sobie ze spotkaniami z innymi psami, biegaczami i rowerzystami",
    mouthing: "dobrowolnie oddawać zakazane przedmioty, zamiast ich bronić",
    recall: "niezawodnie i radośnie wracać na przywołanie",
    barking: "szczekać wyraźnie rzadziej i z większą kontrolą",
    anxiety: "spokojniej zostawać sam, bez stresu separacyjnego",
    jumping: "spokojnie witać ludzi, zamiast na nich skakać",
    destructive: "wyraźnie rzadziej niszczyć rzeczy i więcej czerpać z dozwolonych zajęć",
    soiling: "niezawodnie stać się czysty w domu, z jasną rutyną toaletową",
  };
  const zielSatz = ZIEL_FORMULIERUNGEN[problem] || "kształtować wspólne życie wyraźnie spokojniej";
  const fallbackZiele = `Pod koniec tych ${weeksTotal} tygodni ${dogName} będzie ${zielSatz}. Nie przez karę czy przymus, lecz przez pozytywne wzmacnianie i jasne rutyny. Będziesz lepiej rozumieć ${dogName} i mieć razem spokojniejszą codzienność.`;

  return {
    intro: {
      headline: `${planLengthMonths}-miesięczny plan dla ${dogName}`,
      einleitung: introText || fallbackEinleitung,
      aufbau: fallbackAufbau,
      ziele: zieleText || fallbackZiele,
    },
    weeks,
    monats_uebersichten: buildMonatsUebersichten(problem, weeksTotal, monthsTotal, dog, problemLabel, customProblemText),
    abschluss:
      abschlussText ||
      `Prowadziłeś ${dogName} systematycznie przez ${weeksTotal} tygodni — to prawdziwe osiągnięcie. Podtrzymuj rutyny, obserwuj małe postępy i bądź cierpliwy wobec was obojga. Zmiana to nie linia, lecz fala.`,
    zusatz_spiele: (BONUS_BY_PROBLEM[problem] || []).map((bs) => ({
      ...bs,
      name: personalize(bs.name, dog),
      ziel: personalize(bs.ziel, dog),
      schritte: bs.schritte.map((s) => personalize(s, dog)),
      warum: personalize(bs.warum, dog),
    })),
  };
}

