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
    title: "Pies szczeka przy drzwiach",
    situation: "Dzwoni dzwonek, a Twój pies wariuje: szczeka bez opamiętania, rzuca się do drzwi i ledwo daje się uspokoić. To stresuje Ciebie, Twoich gości i samego psa.",
    steps: [
      { title: "Daj sygnał spokoju", desc: "Powiedz spokojnie i stanowczo \"Zostaw\" albo \"Cisza\". Nie krzycz, bo to tylko wzmaga pobudzenie. Poczekaj, aż pies na Ciebie spojrzy." },
      { title: "Odeślij psa na miejsce", desc: "Odeślij psa na jego stałe miejsce (kocyk, legowisko). Spokojnie wskaż tam ręką. Kiedy się położy, potwierdź słowem \"Dobrze\" albo smaczkiem." },
      { title: "Zapanuj nad gościem", desc: "Poproś gościa, żeby chwilę zaczekał. Podejdź do drzwi, zasłoń szparę swoim ciałem i otwórz dopiero wtedy, gdy pies nie stoi już tuż przy nich. Realistycznie: nie musi być idealnie, liczy się każda sekunda spokoju." },
      { title: "Nagradzaj spokojne zachowanie", desc: "Gdy tylko pies zostaje spokojny w chwili otwierania drzwi, nagradzaj go. Każde ponowne szczekanie całkowicie ignoruj: odwróć się, żaden kontakt wzrokowy." },
      { title: "Ćwicz 5 razy dziennie bez gościa", desc: "Zadzwoń dzwonkiem sam, odeślij psa na miejsce. Wystarczy 5 powtórzeń dziennie. Po 1 do 2 tygodni rutyna się utrwali i zadziała też przy prawdziwych gościach." },
    ],
    tipp: "Zacznij od cichych dźwięków dzwonka i stopniowo zwiększaj głośność. Dzięki temu nie przeciążysz psa.",
    wennNicht: [
      "Pobudzenie jest za duże? Cofnij się o 3 kroki: najpierw ćwicz komendę \"Miejsce\" BEZ dzwonka, aż będzie opanowana w 100 procentach. Dopiero potem łącz jedno z drugim.",
      "Nie chce iść na miejsce? Nigdy go nie zmuszaj, zwab go tam smaczkiem. Powtarzaj to 10 razy dziennie bez stresu, aż miejsce zacznie mu się kojarzyć pozytywnie.",
      "Działa tylko bez prawdziwego gościa? To normalne! Zwiększaj poziom powoli: najpierw dzwonek bez gości, potem ze znajomymi osobami, potem z obcymi.",
    ],
  },
  {
    nr: 2,
    title: "Pies nagle rusza do przodu",
    situation: "Idziecie spokojnie na spacer i nagle Twój pies ciągnie z całej siły w jedną stronę: wiewiórka, inny pies albo ciekawy zapach.",
    steps: [
      { title: "Natychmiast się zatrzymaj", desc: "Stań jak wryty. Nie zrób ani kroku w stronę, w którą pies ciągnie. Trzymaj smycz mocno, ale nie szarp do tyłu, po prostu stój." },
      { title: "Czekaj, aż smycz się poluzuje", desc: "Po prostu stój nieruchomo i czekaj. W końcu pies przestanie ciągnąć, nawet jeśli potrwa to 30 sekund. Tu liczy się cierpliwość." },
      { title: "Zmień kierunek", desc: "Gdy tylko smycz się poluzuje, odwróć się i idź w drugą stronę. Powiedz przy tym spokojnie \"Tędy\". Rób tak konsekwentnie za każdym razem." },
      { title: "Od razu nagradzaj luźną smycz", desc: "Gdy tylko pies idzie obok Ciebie na luźnej smyczy, natychmiast go pochwal: \"Super!\" albo daj smaczek. Tak uczy się: luźna smycz oznacza, że idziemy dalej." },
      { title: "Nagradzaj co 10 do 15 kroków", desc: "W pierwszych tygodniach nagradzaj luźną smycz co 10 do 15 kroków. Brzmi jak dużo, ale to buduje nawyk. Później wystarczy co kilka minut." },
    ],
    tipp: "Zabierz wartościowe smaczki, ser albo wędlinę. Sucha karma nie wygra z wiewiórką.",
    wennNicht: [
      "Bodziec jest za silny? Ćwicz najpierw w spokojnym otoczeniu (ogród, cicha ulica). Kiedy tam zadziała, zwiększaj poziom powoli.",
      "Mimo to ciągnie jak szalony? Szelki z przednim ringiem kierują siłę ciągnięcia na bok i sprawiają, że ciągnięcie robi się niewygodne. Wielu psom to od razu pomaga.",
      "Prawie Cię przewraca? NIGDY nie owijaj smyczy wokół dłoni. Trzymaj ją mocno obiema rękami przed ciałem. Przy bardzo silnych psach użyj smyczy 3 metrowej zamiast flexi.",
    ],
  },
  {
    nr: 3,
    title: "Pies szczeka na innego psa",
    situation: "Spotykacie innego psa, a Twój szczeka, warczy albo szarpie się na smyczy. Nie wiesz, czy to strach, czy agresja, ale czujesz się z tym niezręcznie.",
    steps: [
      { title: "Zwiększ dystans", desc: "Odejdź natychmiast 3 do 5 metrów w bok albo zawróć. Twój pies potrzebuje większego dystansu, żeby poczuć się bezpiecznie. Znajdź odległość, przy której widzi drugiego psa, ale nie wariuje." },
      { title: "Skieruj uwagę na siebie", desc: "Podsuń smaczek pod nos i powiedz jego imię. Gdy tylko spojrzy na Ciebie zamiast na drugiego psa, powiedz \"Tak!\" i daj smaczek." },
      { title: "Deszcz smaczków przy spotkaniu psa", desc: "Dopóki drugi pies jest w zasięgu wzroku, dawaj smaczek co 2 do 3 sekund. Twój pies uczy się: inny pies oznacza deszcz smaczków u mnie." },
      { title: "Omiń szerokim łukiem", desc: "Przejdź szerokim łukiem obok drugiego psa. To Ty jesteś między psami. Chwal psa za każdą sekundę spokoju. Sam zachowaj spokój, bo Twój stres mu się udziela." },
      { title: "Świętuj sukces i idź dalej", desc: "Kiedy już miniecie: duża pochwała, dodatkowy smaczek. Zamień to w pozytywne doświadczenie. Im częściej Twój pies spokojnie mija innego, tym bardziej staje się to normalne." },
    ],
    tipp: "Zacznij od dystansu ponad 20 metrów. Zmniejszaj odległość dopiero, gdy pies zostanie spokojny 3 razy z rzędu.",
    wennNicht: [
      "Ważne: najpierw wyklucz u weterynarza ból. Psy, które cierpią, często reagują agresywnie na inne, to częsta i przeoczana przyczyna.",
      "Nie bierze smaczka? To znaczy, że jesteś za blisko. Zwiększ dystans znacznie, nawet do 30 metrów. Przez tygodnie pracuj nad zbliżaniem się.",
      "Zabierz najlepsze smaczki, jakie masz (pasztet, ser). Zwykła sucha karma nie wystarczy przy wysokim poziomie stresu, potrzebujesz czegoś silniejszego niż bodziec.",
    ],
  },
  {
    nr: 4,
    title: "Pies skacze na gości",
    situation: "Przychodzą goście, a Twój pies skacze, liże twarze, jest kompletnie rozentuzjazmowany. Jedni goście uważają to za urocze, inni się boją.",
    steps: [
      { title: "Poinstruuj wcześniej wszystkich gości", desc: "Wytłumacz KAŻDEMU gościowi zasadę z góry: żaden kontakt wzrokowy, żadne dotykanie, gdy pies skacze. Jedna osoba, która uzna to za \"urocze\", niszczy tydzień treningu." },
      { title: "Każ całkowicie ignorować", desc: "Każdy ma się odwrócić, gdy pies skacze. Ręce skrzyżowane, wzrok w sufit. Żadnego karcenia, bo negatywna uwaga to też uwaga." },
      { title: "Wyegzekwuj \"Siad\"", desc: "Gdy tylko pies stoi na czterech łapach, powiedz \"Siad\". Kiedy usiądzie, gość może go spokojnie przywitać, krótkie głaskanie, spokojny głos." },
      { title: "Przy nawrocie natychmiast przerwij", desc: "Jeśli znów skacze, gość od razu znów się odwraca. Żadnego tam i z powrotem, zasada jest krystalicznie jasna: cztery łapy na ziemi oznaczają uwagę." },
      { title: "Zapanuj nad pierwszymi 2 minutami", desc: "Największe pobudzenie jest w pierwszych 2 minutach. Wytrzymaj! Potem pies się uspokaja. Po 1 do 2 tygodni zrozumie: siedzenie daje więcej niż skakanie." },
    ],
    tipp: "Ćwicz też sam: wyjdź za drzwi, wróć do środka. Ignoruj, gdy skacze, nagradzaj, gdy siedzi.",
    wennNicht: [
      "W ogóle nie przestaje? Nie zaczynaj od prawdziwych gości. Ćwicz najpierw z osobą, którą pies dobrze zna i przy której jest mniej pobudzony.",
      "Przypnij psa na smycz, zanim przyjdą goście. Wtedy fizycznie nie może skoczyć i szybciej uczy się, że siedzenie to lepsza opcja.",
      "Twój gość nie trzyma się zasad? Wtedy poproś go, żeby zaczekał na zewnątrz, aż pies się uspokoi.",
    ],
  },
  {
    nr: 5,
    title: "Pies podnosi coś z ziemi",
    situation: "Twój pies chwyta coś z ziemi podczas spaceru: starą bułkę, coś nieokreślonego, może nawet trutkę.",
    steps: [
      { title: "Zachowaj spokój", desc: "Nie rzucaj się gwałtownie do chwytania, bo to tylko przyspiesza psa. Zatrzymaj się i weź krótki oddech. Pośpiech to dla psa rywalizacja." },
      { title: "Powiedz \"Zostaw\" i pokaż smaczek", desc: "Powiedz spokojnie i stanowczo \"Zostaw\". Jednocześnie podsuń wartościowy smaczek pod sam nos (ser, pasztet). Większość psów puszcza, gdy alternatywa jest lepsza." },
      { title: "Wymieniaj zamiast zabierać", desc: "Gdy tylko wypuści przedmiot, powiedz \"Tak!\" i od razu daj smaczek. Potem spokojnie podnieś przedmiot. Nigdy nie goń, bo to zamienia się w zabawę." },
      { title: "Ćwicz w domu z zabawką", desc: "Ćwicz \"Zostaw\" codziennie z zabawką. Daj zabawkę, powiedz \"Zostaw\", podsuń smaczek. Kiedy puści, dostaje smaczek i zabawkę z powrotem. Tak uczy się: puszczanie się opłaca." },
      { title: "Idź z wyprzedzeniem", desc: "Skanuj ziemię 5 metrów przed sobą. Jeśli widzisz coś podejrzanego, wcześniej odciągnij psa. Zapobieganie jest łatwiejsze niż reagowanie." },
    ],
    tipp: "Przy podejrzeniu trutki: ostrożnie otwórz pysk, nie naciskaj. W razie wątpliwości natychmiast do weterynarza.",
    wennNicht: [
      "Absolutnie nic nie chce puścić? Wymień na coś jeszcze lepszego. Pasztet z tubki tuż pod nosem jest dla większości psów nie do odparcia.",
      "Ćwicz wymianę setki razy w domu, najpierw z nudnymi przedmiotami, potem z coraz ciekawszymi. Na zewnątrz wymiana musi być rutyną.",
      "Połyka od razu? Trenuj \"Pokaż\", pies ma Ci pokazywać znaleziska, NIE podnosząc ich. To wymaga czasu, ale zapobiega połykaniu.",
    ],
  },
  {
    nr: 6,
    title: "Pies goni biegacza albo rowerzystę",
    situation: "Obok przebiega biegacz albo przejeżdża rowerzysta, a Twój pies chce za nim: szarpie smycz, szczeka, całkowicie się nakręca.",
    steps: [
      { title: "Rozpoznaj wcześnie i przygotuj się", desc: "Gdy tylko zobaczysz biegacza albo rowerzystę, skróć smycz (ale nie naprężaj). Stań bokiem, żeby pies nie mógł rzucić się prosto na cel." },
      { title: "Ustaw kotwicę na smaczku", desc: "Powiedz spokojnie \"Patrz\" i trzymaj smaczek przy twarzy. Twój pies ma się nauczyć, że \"Patrz\" oznacza, że u Ciebie jest coś dobrego." },
      { title: "Utrzymaj siad i kontakt wzrokowy", desc: "Powiedz \"Siad\" i utrzymaj kontakt wzrokowy. Dopóki pies patrzy na Ciebie zamiast na biegacza, karm go smaczkiem co 2 do 3 sekund. To Ty jesteś imprezą, nie biegacz." },
      { title: "Przepuść i mocno nagródź", desc: "Poczekaj, aż biegacz całkowicie przejdzie. Potem: \"Brawo!\" plus duża pochwała plus dodatkowy smaczek. Twój pies uczy się: spokój oznacza, że dzieje się coś dobrego." },
      { title: "Smycz treningowa jako najważniejsze narzędzie", desc: "Przy popędzie łowieckim smycz treningowa 10 metrowa jest Twoim najlepszym przyjacielem. Daje psu swobodę ruchu, ale Ty zachowujesz kontrolę. Zawsze mocuj ją do szelek (nigdy do obroży!) i pozwól, żeby wlokła się po ziemi, nadepnij na nią, gdy pies chce wystartować." },
    ],
    tipp: "Znajdź trasę, gdzie regularnie biegają biegacze, i ćwicz tam celowo ze smyczą treningową. Powtarzanie to klucz.",
    wennNicht: [
      "Mimo smaczka wariuje? Popęd łowiecki to jeden z najsilniejszych instynktów. Zacznij od filmów z biegaczami na telefonie, nagradzaj spokojne oglądanie. Potem z dużej odległości prawdziwi biegacze.",
      "Ćwicz kontrolę impulsów osobno: smaczek na ziemi, pies musi czekać, jeść dopiero na sygnał. To wzmacnia samokontrolę i pomaga przy każdym bodźcu, nie tylko przy biegaczach.",
      "Nigdy nie pozwól, żeby smycz treningowa naprężyła się gwałtownie, bo to rani psa. Nadepnij delikatnie albo hamuj dłonią (noś rękawice!). Praktyka czyni mistrza.",
    ],
  },
  {
    nr: 7,
    title: "Pies szczeka w samochodzie",
    situation: "Twój pies szczeka bez przerwy w samochodzie: przy każdym przechodniu, każdym psie, każdym światle. Jazda samochodem zamienia się w koszmar.",
    steps: [
      { title: "Ogranicz pole widzenia", desc: "Zasłoń okna (osłona przeciwsłoneczna, koc). Mniej bodźców oznacza mniej szczekania. Idealny jest transporter, w którym pies mniej widzi i czuje się bezpiecznie." },
      { title: "Ćwicz w stojącym samochodzie", desc: "Usiądź z psem w zaparkowanym samochodzie. Silnik wyłączony. Kiedy jest spokojny: smaczek. Kiedy szczeka: czekaj, ignoruj. Gdy tylko przestanie (choćby na 3 sekundy): natychmiast nagródź." },
      { title: "Silnik włączony, to samo ćwiczenie", desc: "Kiedy stojący samochód zadziała, włącz silnik. Te same zasady: spokój oznacza smaczek, szczekanie ignorujesz. Dopiero gdy to jest opanowane, ruszaj." },
      { title: "Buduj krótkie przejazdy", desc: "Jedź tylko 2 minuty, potem przerwa. Kiedy pies zostaje spokojny: wysiądźcie, duża pochwała, krótki spacer. Wydłużaj czas jazdy powoli przez kolejne dni." },
      { title: "Zaproponuj zajęcie", desc: "Wypełniony kong albo gryzak działa w samochodzie cuda. Twój pies jest zajęty i ma mniej energii na szczekanie. Dawaj konga TYLKO w samochodzie, tak jazda staje się pozytywna." },
    ],
    tipp: "Na początku jeźdźcie tylko do świetnych miejsc (las, wybieg dla psów). Tak pies łączy jazdę samochodem z pozytywnymi przeżyciami.",
    wennNicht: [
      "Szczeka mimo zasłoniętych okien? Słyszy dźwięki. Włącz spokojną muzykę albo podcast, żeby zagłuszyć odgłosy z zewnątrz.",
      "Jeśli szczeka w transporterze: zarzuć na niego koc. Niektóre psy są w samochodzie skrajnie zestresowane, wtedy najpierw jeźdźcie tylko po podjeździe w tę i z powrotem.",
      "Twój pies wymiotuje w samochodzie? To nie problem z zachowaniem, tylko choroba lokomocyjna. Porozmawiaj z weterynarzem o środkach na to.",
    ],
  },
  {
    nr: 8,
    title: "Pies warczy przy jedzeniu",
    situation: "Twój pies warczy albo kłapie, gdy zbliżasz się do miski. Boisz się, że Cię ugryzie, zwłaszcza gdy w domu są dzieci.",
    steps: [
      { title: "Natychmiast chroń dzieci i domowników", desc: "Najważniejsza zasada: dopóki pies warczy przy misce, dzieci NIE mogą się zbliżać. Bez wyjątków. Karm w spokojnym miejscu, gdzie nikt przypadkiem nie przejdzie obok." },
      { title: "Zachowaj dystans i uszanuj go", desc: "Warczenie to ostrzeżenie, uszanuj je. Cofnij się 2 do 3 metrów. Nigdy nie zabieraj miski, żeby pokazać, kto tu rządzi, bo to znacznie pogarsza sprawę." },
      { title: "Z dystansu wrzuć coś dobrego", desc: "Przejdź w bezpiecznej odległości obok miski i wrzuć do niej coś smakowitego (kawałek sera, kurczaka). Nie wkładaj ręki! Tak pies uczy się: człowiek podchodzi bliżej oznacza, że moje jedzenie robi się LEPSZE." },
      { title: "Buduj pozytywne skojarzenie", desc: "Powtarzaj to przy każdym posiłku. Przez tygodnie powoli zmniejszaj dystans: najpierw 2 metry, potem 1,5, potem 1. Zawsze z nagrodą. Nie spiesz się." },
      { title: "Karm z ręki", desc: "Przez jakiś czas karm część posiłku prosto z ręki. Tak stajesz się źródłem jedzenia zamiast zagrożeniem. Twój pies nabiera zaufania, że niczego mu nie zabierasz." },
    ],
    tipp: "Wyraźnie oddziel miejsce jedzenia od strefy rodzinnej. Stałe, spokojne miejsce karmienia ogromnie redukuje stres przy jedzeniu, dla wszystkich.",
    wennNicht: [
      "Twój pies już kłapie zębami? To NIE porażka, obrona zasobów to poważny temat. Poproś o profesjonalną pomoc certyfikowanego trenera psów.",
      "Do tego czasu: karm w stałym miejscu, nie przeszkadzaj i trzymaj dzieci z dala. Bezpieczeństwo zawsze przed treningiem.",
      "Czujesz się niepewnie? Zaufaj swojemu przeczuciu. To w porządku poprosić o pomoc. Niektóre problemy wymagają obecności specjalisty na miejscu.",
    ],
  },
  {
    nr: 9,
    title: "Pies wariuje podczas burzy",
    situation: "Grzmi, a Twój pies drży, dyszy, chowa się albo panicznie szczeka. Chcesz pomóc, ale nie wiesz, czego teraz potrzebuje.",
    steps: [
      { title: "Zapewnij spokojne schronienie", desc: "Zabierz psa do wewnętrznego pomieszczenia z małą liczbą okien. Zaciągnij zasłony, połóż jego ulubiony kocyk. Jeśli chce pod stół, pozwól mu." },
      { title: "Zagłusz odgłosy", desc: "Włącz cicho muzykę albo telewizor, żeby zagłuszyć grzmoty. Spokojne, równomierne dźwięki działają najlepiej." },
      { title: "Bądź spokojnie obok i daj poczucie bezpieczeństwa", desc: "Możesz spokojnie głaskać psa i być przy nim, to nie wzmacnia strachu. Ważne jest tylko: sam zostań rozluźniony. Nerwowe pocieszanie albo pobudzone mówienie przenosi na niego TWOJE zdenerwowanie." },
      { title: "Pokazuj normalność", desc: "Rób normalne rzeczy: idź do kuchni, usiądź, ziewnij demonstracyjnie. Zaproponuj gryzak, jeśli go weźmie, to dobry znak." },
      { title: "Odczulaj długofalowo", desc: "Odtwarzaj cicho odgłosy burzy i dawaj przy tym smaczki. Głośność zwiększaj powoli przez tygodnie. Tak pies uczy się: grzmot oznacza czas na smaczki." },
    ],
    tipp: "Nie zmuszaj do spacerów podczas burzy. Jeśli pies nie chce się załatwić, to w porządku. Przeczekajcie to razem.",
    wennNicht: [
      "Twój pies jest w absolutnej panice (drży bardzo mocno, biega bez orientacji)? To wykracza poza zwykły trening. Porozmawiaj z weterynarzem o wsparciu.",
      "Istnieją ziołowe środki uspokajające, a w ciężkich przypadkach pomoc farmakologiczna. To nie słabość, niektóre psy mają prawdziwe fobie dźwiękowe.",
      "Kamizelki uciskowe (obcisłe kamizelki) pomagają niektórym psom dzięki delikatnemu naciskowi. Wypróbuj to, u około 50 procent psów przynosi efekt.",
    ],
  },
  {
    nr: 10,
    title: "Pies ciągnie do innego psa",
    situation: "Twój pies widzi innego psa i koniecznie chce do niego: ciągnie, skomli, szczeka z podniecenia. Jesteś ciągnięty po całej okolicy.",
    steps: [
      { title: "Natychmiast się zatrzymaj", desc: "Zatrzymaj się, gdy tylko pies zaczyna ciągnąć. Nie daj się pociągnąć, nawet nie \"tylko na chwilę powąchać\". Zasada jest krystalicznie jasna: ciągnięcie oznacza, że nie idziemy dalej." },
      { title: "Wyegzekwuj kontakt wzrokowy", desc: "Powiedz \"Patrz na mnie\". Trzymaj smaczek przy twarzy. Gdy tylko pies na Ciebie spojrzy, choćby na sekundę, powiedz \"Tak!\" i daj smaczek." },
      { title: "Czekaj, aż smycz się poluzuje", desc: "Idź dalej dopiero, gdy smycz zwisa całkowicie luźno, a pies jest rozluźniony. To może potrwać, wytrzymaj. Konsekwencja jest tu wszystkim." },
      { title: "Pozwól na kontakt tylko przy spokoju", desc: "Kiedy smycz jest luźna, a oba psy wyglądają na rozluźnione, możesz WTEDY podejść bliżej. Zasada: jeśli któryś jest pobudzony, mijacie się łukiem." },
      { title: "Nie dopuszczaj każdego spotkania", desc: "Większość spotkań z psami nie musi się odbyć. Twój pies musi się nauczyć, że nie każdy pies jest kolegą do zabawy, i to jest całkowicie w porządku." },
    ],
    tipp: "Nagradzaj psa za każdym razem, gdy widzi innego psa i mimo to patrzy na Ciebie. To na wagę złota.",
    wennNicht: [
      "Całkowicie Cię ignoruje? Przekroczył swój próg pobudzenia. Zwiększ dystans znacznie, pracuj najpierw z odległości 20 do 30 metrów.",
      "Nagradzaj za każdym razem, gdy widzi psa i NIE wariuje. Przez tygodnie bliżej. Cierpliwości! Frustracja po Twojej stronie się udziela.",
      "Twój pies chce do KAŻDEGO psa? To często frustracja, bo nigdy nie może. Pozwalaj czasem na kontrolowany kontakt ze spokojnymi psami, to zdejmuje presję.",
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
  console.log("Startuje generowanie PDF...");
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

  const titleText = "Karty ratunkowe";
  const titleWidth = fontBold.widthOfTextAtSize(titleText, 36);
  cover.drawText(titleText, { x: (A4_W - titleWidth) / 2, y: A4_H - 120, size: 36, font: fontBold, color: TEXT_DARK });

  const subtitle = "10 natychmiastowych rozwiązań na typowe trudne sytuacje";
  const subWidth = fontRegular.widthOfTextAtSize(subtitle, 15);
  cover.drawText(subtitle, { x: (A4_W - subWidth) / 2, y: A4_H - 155, size: 15, font: fontRegular, color: TEXT_MEDIUM });

  const descText = "Każda karta wyjaśnia Ci krok po kroku, co możesz zrobić w typowej trudnej sytuacji z psem. Jasno, spokojnie, od razu do zastosowania. Do wydrukowania albo zapisania w telefonie.";
  const descLines = wrapText(descText, fontRegular, 12, CONTENT_W - 60);
  let descY = A4_H - 220;
  for (const line of descLines) {
    const lw = fontRegular.widthOfTextAtSize(line, 12);
    cover.drawText(line, { x: (A4_W - lw) / 2, y: descY, size: 12, font: fontRegular, color: TEXT_MEDIUM });
    descY -= 18;
  }

  let overviewY = descY - 30;
  cover.drawText("Spis treści:", { x: MARGIN + 30, y: overviewY, size: 14, font: fontBold, color: TEXT_DARK });
  overviewY -= 28;
  for (const k of karten) {
    cover.drawText(`${k.nr}.`, { x: MARGIN + 40, y: overviewY, size: 12, font: fontBold, color: GOLD });
    cover.drawText(k.title, { x: MARGIN + 65, y: overviewY, size: 12, font: fontRegular, color: TEXT_DARK });
    overviewY -= 22;
  }

  const footerText = "ŁapaPlan · lapaplan.pl";
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

    page.drawText("Sytuacja", { x: MARGIN, y, size: 10.5, font: fontBold, color: DARK_BROWN });
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

    page.drawText("Wskazówka:", { x: MARGIN + 12, y, size: 9.5, font: fontBold, color: DARK_BROWN });
    y -= 13;
    for (const line of tippLines) {
      page.drawText(line, { x: MARGIN + 12, y, size: 9.5, font: fontRegular, color: TEXT_MEDIUM });
      y -= 12;
    }

    // "Co, jesli pies nie wspolpracuje?" Box - 3 punkty
    y -= 16;
    const wennNichtTitle = "Co, jeśli Twój pies nie współpracuje?";

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

    const pageFooter = `Karta ratunkowa ${karte.nr}/10 · ŁapaPlan`;
    const pfWidth = fontRegular.widthOfTextAtSize(pageFooter, 9);
    page.drawText(pageFooter, { x: (A4_W - pfWidth) / 2, y: 30, size: 9, font: fontRegular, color: TEXT_MEDIUM });
    page.drawRectangle({ x: 0, y: 0, width: A4_W, height: 3, color: GOLD });
  }

  const pdfBytes = await doc.save();
  writeFileSync(join(process.cwd(), "public", "notfall-karten-pl.pdf"), pdfBytes);
  console.log(`PDF zapisany: public/notfall-karten-pl.pdf (${pdfBytes.byteLength} bytes)`);
}

main().catch(console.error);
