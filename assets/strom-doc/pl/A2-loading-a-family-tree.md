<a id="A2"></a>
# A2 Wczytanie drzewa genealogicznego (GEDCOM)

Rozdział mówi, co aplikacja przejmie z pliku GEDCOM z innego programu, co pominie i jak to przyzna w podsumowaniu
importu. Opisuje aplikację Strom 3.21.2 (i badanie 1.25.2); zmiany z nowszej wersji mają przy sobie jej numer. Otwarcie
pliku badania i powiązanie drzewa z badaniem należy do rozdziału S1. Całą drogę drzewa z innego programu (znaczniki
wiarygodności, ochrona danych z drzewa, karta **Co dalej**, eksport z powrotem) opisuje
[S6](S6-tree-from-another-program.md).

<a id="A2.1"></a>
## A2.1 Co się wczytuje, a co nie

Aplikacja przejmie osoby, rodziny, źródła, notatki, zdarzenia i media, które zna. Czego nie zna, nie przeniesie, ale
to przyzna: każdy nieprzeniesiony znacznik liczy się do kafelka **Nieobsługiwane** i z nazwy do wiersza **Pominięte
rekordy**. Nic nie ginie po cichu na poziomie rekordu ani bezpośredniej danej osoby, rodziny i źródła.

- **Granice:** Liczą się nieznane rekordy (poziom 0) i nieznane bezpośrednie dane osoby, rodziny i źródła (poziom 1).
  Nieznane szczegóły głębiej w rekordzie (poziom 2 i niżej) pomija się bez liczenia. Znaczniki ewidencyjne innych
  programów (`_UPD`, `RIN`, `_UID`, `CHAN`, `_PROJECT_GUID`, `_EXPORTED_FROM_SITE_ID`) pomija się po cichu; nic nie
  mówią o rodzinie. Znaczniki `ANCI`, `DESI`, `RFN`, `AFN` i `RESN` się liczą. Wiele danych bez własnego miejsca
  w aplikacji nie przepada, lecz zapisuje się w notatce osoby jako opisany wiersz: błogosławieństwo, przejście na
  emeryturę, pozycja społeczna, opis, numer identyfikacyjny, liczba dzieci, liczba małżeństw, majątek, numer
  ubezpieczenia, informacja ogólna i „Występuje także jako”. Bloków badawczych Stromu nie czyta się ze zwykłego pliku
  i się je liczy (zob. [A2.7](#A2.7)).
- **Obsługa:** **Import → Import GEDCOM** (plik `.ged`). W nowym drzewie także przycisk na pustym drzewie.
  Podsumowanie zob. [A2.1.1](#A2.1.1).
- **Obowiązuje od:** aplikacja 1.9.0 (podsumowanie nieprzeniesionych znaczników); wiersze w notatce od aplikacji
  3.0.0.
- **Od aplikacji 3.26.0:**
  - `_UID`, `RIN`, `AFN` i inne identyfikatory programu (`UID`, `EXID`, `_FSFTID`) nie są pomijane: zachowują się przy
    osobie i rodzinie razem z pierwotnym oznaczeniem rekordu (`@I12@`) jako identyfikator programu
    ([S6.1](S6-tree-from-another-program.md#S6.1));
  - własne znaczniki programu (`_XXX`) bezpośrednio przy osobie, rodzinie i źródle zachowują się do eksportu **Z powrotem
    do {program}** ([S6.6](S6-tree-from-another-program.md#S6.6)); głębsze własne znaczniki się liczy;
  - wycinki zdjęć MyHeritage (`_POSITION`, `_CUTOUT`) są ewidencyjne i się ich nie liczy;
  - rozwód zapisany przed ślubem (PAF) nie ginie i nie nadpisuje ślubu; pusty ślub lub rozwód zapisany przed innym
    z datą (MyHeritage) zachowuje datę i miejsce tego z datą;
  - imię zapisane jako opis (`Son`, `Unknown`) wraca tak, jak było zapisane, bez zrobionej z niego notatki; tekst
    w wierszu danej (wykształcenie, pogrzeb, własne zdarzenie), adres w częściach (`ADR1`, `CITY`…) i odnośnik
    internetowy w tekście źródła zostają i wracają tak, jak miał je plik.
- **Od aplikacji 3.28.0:**
  - `CENS` przy osobie to wydarzenie osoby **Spis ludności** z datą, miejscem, wiekiem według zapisu, domem lub
    adresem, notatką i źródłami; w wyborze wydarzeń osoby jest zaraz po **Miejsce zamieszkania**. Import tak go
    czyta (także z pliku badania), a eksport zapisuje go jako `1 CENS` przy osobie. Do aplikacji 3.27.0 `CENS` przy
    osobie czytało się jako własne wydarzenie o nazwie „Spis ludności”. `CENS` przy rodzinie pozostaje wydarzeniem
    pary. Własne wydarzenia „Spis ludności” w drzewach zapisanych wcześniej przy dostosowaniu danych do nowej wersji
    stają się spisem ludności, z kopią zapasową ([A10.7](A10-shared-events.md#A10.7));
  - `2 TYPE` pod `CENS` (rodzaj spisu) staje się pierwszym wierszem notatki. Eksport zwraca go jako `2 TYPE`, dopóki
    notatka się od niego zaczyna;
  - wspólne wydarzenie z innego programu: RootsMagic, Legacy i Family Historian zapisują wydarzenie raz, a pozostałe
    osoby pod nim (`2 _SHAR @I…@` z rolą `ROLE`, `_ROLE` lub `RELA` i z notatką; Family Historian także `2 _SHAN`
    z imieniem osoby bez rekordu). Członek gospodarstwa (rola pusta, „Household”, „Principal”, „Head”…) dostaje
    kopię wspólnego wydarzenia ([A10.1](A10-shared-events.md#A10.1)); jego własne takie samo wydarzenie dołącza się,
    nie podwaja się. Rola inna niż zwykły członek gospodarstwa zostaje jako rola kopii. Spis, miejsce zamieszkania
    lub własne wydarzenie pary z członkami gospodarstwa staje się wspólnym wydarzeniem partnerów i wymienionych
    osób. Świadek, chrzestny i inna rola są uczestnikami wydarzenia; przy wydarzeniu tylko dla jednej osoby
    (chrzest…) osoby są uczestnikami **Obecny** z rolą w notatce;
  - GEDCOM 7: `ASSO` z `3 ROLE GODP`, `WITN`, `CLERGY` lub `OFFICIATOR` to chrzestny, świadek lub celebrans; inna
    rola to **Obecny** ze słowem roli w notatce (`OTHER` z `PHRASE`, `NGHBR` sąsiad, `FRIEND` przyjaciel …). `ASSO
    @VOID@` z `PHRASE` to uczestnik zapisany z nazwiska;
  - znaczniki Stromu dla wspólnego wydarzenia i ról import czyta według [A2.7](#A2.7).

<!-- zdroj: app:src/ged-parser.ts:1450 KNOWN_INDI_TAGS, :1453 KNOWN_FAM_TAGS, :1464 KNOWN_RECORD_TYPES, :1478 IGNORED_BOOKKEEPING_TAGS, :636 NOTED_INDI_TAGS, :2094 drop, :2410, :2486, :2194 · strings.ts gedcom.unsupported, gedcom.skippedTags, gedcomNotes.factLabels · 3.28.0: app:34b2174c src/ged-parser.ts EVENT_TAG_TO_TYPE CENS → census (dřív CENS u INDI vlastní událost s gedcomNotes.census), src/ged-exporter.ts EVENT_TAG_TO_TYPE census → CENS, src/events.ts SELECTABLE_EVENT_TYPES (census za residence), src/ui/event-details-ui.ts offeredDetails census (age, address), strings.ts events.census, strings-pl part1 · CENS u FAM coupleEventTypeOfTag · dirigent:prace/1113-app-scitani-u-osoby Výsledek · spec 053 U2 K1.1 · 3.28.0 sdílení: app:80c2ffb9 src/ged-shares.ts (_SHAR, _SHAN, isHouseholdShareRole, convertGedShares, sharRoleWord), src/ged-parser.ts (ASSO ROLE GODP/WITN/CLERGY/OFFICIATOR, OTHER PHRASE, @VOID@ PHRASE; CENS 2 TYPE → první řádek poznámky + gedcomType), src/ged-exporter.ts (2 TYPE zpět), migrace vlastní „Census“ (A10.7) · dirigent:prace/1113-app-sdilena-udalost, 1113-app-085-nalezy Výsledek · spec 085 §7 -->

<a id="A2.1.1"></a>
### A2.1.1 Podsumowanie importu

Po konwersji otwiera się okno **Konwersja GEDCOM**. Kafelki **Osób**, **Relacji**, **Zastępcze** i **Nieobsługiwane**
są zawsze; **Zdjęcia**, **Dokumenty**, **Wycinki**, **Źródła** i **Zdarzenia** tylko przy niezerowej liczbie. Wiersz
**Pominięte rekordy** wymienia znaczniki od najczęstszego („`OBJE` ×12”). Kolejne wiersze zgłaszają osoby o nieznanej
płci i dzieci zapisane w kilku rodzinach. „Zaimportowano wszystko z pliku.” pokazuje się tylko wtedy, gdy nic nie
pominięto. Płci nie zgaduje się z roli w rodzinie; inna wartość niż `M` lub `F` to nieznana płeć.

Opcje: **Importuj jako nowe drzewo** (bieżące drzewo zostaje), **Scal z istniejącym** (zob. [A2.8](#A2.8)),
**Zapisz jako JSON**; z pustego drzewa jeszcze **Wstaw do drzewa**. Pole wyboru **Importuj obrazy (wycinki,
załączniki, zdjęcia)** pokazuje szacowany rozmiar. Stan domyślny bierze z **Ustawienia → Wczytywanie obrazów przy
imporcie** i obowiązuje tylko dla tego importu. Bez obrazów zostają transkrypcje, archiwa i odnośniki do stron.
Ścieżki i adresy plików aplikacja proponuje podłączyć.

- **Od aplikacji 3.22.0:** Nad listą pominiętych znaczników jest zdanie, co liczy kafelek **Nieobsługiwane**:
  części pliku, których Strom nie zna i nie przeniósł, nie osoby i relacje.
- **Od aplikacji 3.26.0:**
  - wiersz „Zachowano do eksportu „Z powrotem do {program}”: N znaczników (…)”, gdy plik ma własne znaczniki programu;
  - wiersz **Kodowanie tekstu** przy pliku z rozpoznanym na podstawie zawartości lub jednobajtowym kodowaniem
    ([A2.2](#A2.2));
  - po imporcie pliku innego programu karta **Co dalej** ([S6.4](S6-tree-from-another-program.md#S6.4)); zastępuje
    dawne pytania po imporcie;
  - **Wstaw do drzewa** najpierw zapisuje kopię zapasową drzewa ([S6.5](S6-tree-from-another-program.md#S6.5)).
- **Od aplikacji 3.28.0:** wiersz „Wspólne wydarzenia z {program}: n przeniesiono (m osób)”, gdy plik innego programu
  miał wspólne wydarzenia (`_SHAR`, [A2.1](#A2.1)).

<!-- zdroj: app:src/ui/import-export.ts:374 handleGedcomFile, :410 showGedcomResultDialog · app:src/ged-parser.ts:3880 statistiky convertToStrom, :3186 pohlaví · strings.ts gedcom.*, importImages.* · 3.28.0: app:80c2ffb9 strings.ts gedcom.sharedConverted -->

<a id="A2.2"></a>
## A2.2 Kodowanie i wersja GEDCOM

Aplikacja czyta GEDCOM 5.5.1 i GEDCOM 7, a kodowanie rozpoznaje sama. Eksportuje zawsze GEDCOM 5.5.1 w UTF-8.

- **Granice:** Kodowanie określa najpierw znacznik BOM (UTF-8, UTF-16 LE i BE). Bez niego rozstrzyga wiersz `1 CHAR`
  w nagłówku: `ANSEL` ma własną konwersję (nieznany bajt pokazuje się jako „�”), `UNICODE` to UTF-16, `ANSI` to
  Windows-1252, cokolwiek innego UTF-8. Końce wierszy CR, LF i CRLF są równoważne. Kontynuacje `CONC` i `CONT` się
  łączy; przy miejscach, imionach, stronach, adresach i notatkach zachowuje się także spację na początku kontynuacji.
  Z GEDCOM 7 czyta się `SNOTE` jako notatkę współdzieloną i rekordy bez identyfikatora. Samodzielnych rekordów mediów
  `0 @O1@ OBJE` się nie czyta i liczą się do **Nieobsługiwane**; obraz wskazany tylko odsyłaczem więc nie
  przyjdzie. Pakietu GEDZIP się nie wczytuje, okno przyjmuje tylko `.ged`.
- **Obsługa:** Brak; kodowania się nie wybiera.
- **Obowiązuje od:** aplikacja 1.16.0 (konwersja ANSEL i kodowanie według nagłówka).
- **Od aplikacji 3.22.0:** Znaczniki GEDCOM 7 `UID`, `CREA` i `EXID` pomija się po cichu jako dane ewidencyjne;
  w 3.21.2 liczą się do **Nieobsługiwane**.
- **Od aplikacji 3.26.0:**
  - `CHAR CP1250` lub `WINDOWS-1250` to Windows-1250. `ANSI` oznacza stronę kodową komputera, który plik zapisał:
    prawidłowe UTF-8 zostaje UTF-8, w przeciwnym razie słowa pliku rozstrzygają między Windows-1250 (Europa Środkowa:
    č ř ě ł ż) a Windows-1252 (Europa Zachodnia). Tak samo rozpoznaje się plik bez `CHAR` i plik z `CHAR UTF-8`, który
    nie jest prawidłowym UTF-8;
  - gdy kodowanie rozpoznano na podstawie zawartości lub jest jednobajtowe, a plik ma tekst ze znakami diakrytycznymi,
    podsumowanie importu pokazuje wiersz **Kodowanie tekstu** z **Przykładowe nazwiska:** i wyborem innego kodowania
    (**UTF-8**, **Windows-1250 (Europa Środkowa)**, **Windows-1252 (Europa Zachodnia)**, **ISO-8859-2 (Latin-2)**,
    **ANSEL (starszy GEDCOM)**). Zniekształcone znaki w nazwiskach (³ zamiast ł, ¿ zamiast ż) oznaczają, że pasuje inne
    kodowanie. **Obsługa:** wybór w wierszu **Kodowanie tekstu**;
  - samodzielne rekordy mediów `0 @O1@ OBJE` czyta się przez odsyłacze do nich; zdjęcie rodziny wskazane w ten sposób
    tylko się liczy.
- **Od aplikacji 3.27.0:** zdjęcie rodziny (`1 OBJE` przy rodzinie, zapisane na miejscu albo odsyłaczem `@O1@`)
  nie jest pokazywane w aplikacji, ale zostaje zachowane tak, jak zapisał je plik, do eksportu **Z powrotem do
  {program}** ([S6.6](S6-tree-from-another-program.md#S6.6)). Rekord medium, do którego odsyła rodzina, wraca jako
  zdjęcie zapisane bezpośrednio przy rodzinie. Podsumowanie importu podaje je w wierszu „Zachowano do eksportu „Z
  powrotem do {program}”…”, nie w **Nieobsługiwane**. Nie dotyczy pliku badania.

<!-- zdroj: app:src/ged-parser.ts:1262 decodeGedcomFile, :1236 decodeAnsel, :1290–1380 předzpracování CONC/CONT, :1683 parseGedcom · app:src/ged-exporter.ts:508 exportToGedcom · index.html input accept=".ged" · 3.27.0: app:a5fc9656 src/ged-parser.ts fam.mediaLinks, keptMedia (řádky záznamu média pod rodinu o úroveň níž), extraBlock OBJE na místě, keepsExtra (ne soubor výzkumu), convertToStrom usedMedia · CHANGELOG.cs.md 3.27.0 · dirigent:prace/1109-app-drobnosti-ged Výsledek bod 5 -->

<a id="A2.3"></a>
## A2.3 Imiona i nazwiska

Imię i nazwisko bierze się z podznaczników `GIVN` i `SURN`, w przeciwnym razie z wiersza `NAME` według ukośników.
Tytuły z `NPFX` i `NSFX` przechowuje się osobno i usuwa z wiersza; bez tych znaczników tytułu się nie zgaduje.
Zasady są takie same jak w badaniu.

- **Granice:** Bez ukośników wiersz dzieli się na pierwszej spacji. Tekst za ukośnikiem zamykającym należy do
  nazwiska. Zapisy typu „N.N.”, „neznámý”, „unknown”, „nieznany” dają imię „?”. Opisy zamiast imienia („syn”,
  „dcera”, „mrtvě narozený”, „totgeboren”, „filius”, tekst w nawiasie) dają „?”, a słowa trafiają do notatki osoby.
  Kolejne wiersze `NAME` to warianty. Imię z `TYPE married` lub `_MARNM` to nazwisko po ślubie, nie wariant; wygrywa
  ostatnie takie. Jeśli nazwisko po ślubie jest pierwsze, a rodowe dopiero kolejne, zamienia się je. `2 _STROM_PRIMARY
  Y` oznacza imię i nazwisko, którego osoba używa. Osoba bez imienia i nazwiska to osoba zastępcza (kafelek
  **Zastępcze**). Grupy wariantów nazwiska i rody omawia [A4](A4-surnames-and-families.md).
- **Obsługa:** Brak; wynik poprawia się w karcie osoby.
- **Obowiązuje od:** aplikacja 3.10.0 (tytuły), 3.13.0 (nazwisko po ślubie), 3.18.0 (`_STROM_PRIMARY`).

<!-- zdroj: app:src/gedcom-names.ts:197 readGedcomName, :114 splitNameLine, :85 noName, :96 notAName, :260 stripTitles · app:src/ged-parser.ts:1404 readMarriedSurname, :2250 varianty, :2955 prohození TYPE -->

<a id="A2.4"></a>
## A2.4 Daty i ich formy

Daty GEDCOM przekształca się na formę aplikacji: `3 JUN 1900` na dzień, `JUN 1900` na miesiąc, `1900` na rok.
Szacunek (`ABT`, `EST`, `CAL`, `INT`) to „około”, `BEF` „przed”, `AFT` „po”, `BET … AND` i `FROM … TO` przedział.
Co nie mieści się w formie, zostaje w notatce osoby, nic nie przepada.

- **Granice:** Podwójny rok (1699/00) zachowuje pierwszy rok. Kalendarz inny niż gregoriański się usuwa, a notatka
  mówi „Data w kalendarzu juliańskim: …” (także żydowskim, francuskim republikańskim, rzymskim). Tekst w nawiasie
  zachowuje się jako „Data w zapisie: …”. Nieznany miesiąc zostawia tylko rok z notatką. Słowa po czesku, słowacku,
  polsku, niemiecku, rosyjsku i ukraińsku („po”, „před”, „kolem”, „mezi … a”, „nach”, „około”) czyta się jako
  znaczniki tylko wtedy, gdy stoi za nimi prawidłowa data; „po válce” zostaje tekstem. Wiek przy zdarzeniu (`AGE`)
  zapisuje się jako „61 lat”, `INFANT` jako „niemowlę”. Formę daty, którą aplikacja zapisałaby inaczej (np. `EST` lub
  `CAL`), pamięta się przy osobie i relacji. Eksport zwraca ją w pierwotnej postaci, dopóki data się nie zmieni.
- **Obsługa:** Brak.
- **Obowiązuje od:** aplikacja 3.0.0 (notatki do dat), 3.7.0 (słowa języków), 3.17.0 (zachowane formy).
- **Od aplikacji 3.27.0:** miesiąc i rok cyframi (`07/1987`, `7/1987`, `07.1987`, `7.1987`) czyta się jako ten
  miesiąc, także ze znacznikiem lub słowem przed nimi (`ABT`, „cca”, „kolem”, „před”, „po”). Liczy się tylko miesiąc
  1–12: `13/1987` nie czyta się jako miesiąca. Podwójny rok (1699/00) i data z dniem (12.03.1919) nie czytają się
  w ten sposób.
  Daty zapisane tak, jak piszą je ludzie (`cca 1850`, `14/6/1850`, `mezi 1850-1852`), czyta [A2.4.1](#A2.4.1).

<!-- zdroj: app:src/gedcom-date-read.ts:22 parseGedcomDate, :33 gedcomDatePhrase, :55 readGedcomDate · app:src/date-words.ts · app:src/ged-parser.ts:702 kalendář, :1157 gedcomDates · app:src/gedcom-date-form.ts · strings.ts gedcomNotes.datePhrase · 3.27.0: app:655212fd src/gedcom-date-read.ts readGedcomDate numericMonth (/^(\d{1,2})[./](\d{3,4})$/, měsíc 1–12), bareDate · CHANGELOG.cs.md 3.27.0 · dirigent:prace/1109-app-tester-vlna1 (T42) -->

<a id="A2.4.1"></a>
### A2.4.1 Daty zapisane tak, jak piszą je ludzie

Data zapisana tak, jak piszą ją ludzie, a nie słowami GEDCOM, czyta się jako data. Dotyczy to tak samo pól daty
(osoba, wydarzenie, związek), importu GEDCOM i tekstu, który już jest w danych drzewa (np. z ręcznie zmienionego
JSON).

| Zapis (przykład) | Czyta się jako |
|---|---|
| `cca 1850`, `asi 1850`, `okolo 1850`, `kolem 1850`, `ca 1850`; także z miesiącem lub dniem | około (`ABT`) |
| `před 1850`, `před 14.6.1850` | przed (`BEF`) |
| `po 1850`, `po roce 1850`, `po 6/1850` | po (`AFT`) |
| `14/6/1850`, `cca 14/6/1850` | dzień, miesiąc i rok |
| `1850-1852`, `mezi 1850-1852`, `mezi 1850 - 1852` | przedział (`BET … AND`) |
| `mezi 1850-11/1851` | przedział od 1850 do listopada 1851 (`BET 1850 AND NOV 1851`) |
| `1850-11/1851`; w polu daty także `1850/1851` | okres od–do (`FROM … TO`): od listopada 1850 do 1851, od 1850 do 1851 |
| `5-7/1850`, `14-15/6/1850` | przedział w roku (maj do lipca 1850) lub w miesiącu (14. do 15. 6. 1850) |
| `cca 1850-1852`, `asi 1850-1852` | przedział; zakres sam mówi „kiedyś między”, „cca” się pomija |

- Słowa czyta się po czesku, a także po angielsku, niemiecku i polsku („about”, „um”, „około”, „zwischen”, „między” …).
- **Dzień i miesiąc, które można zamienić** (`7/8/1850`: oba do 12 i różne), czyta się według języka aplikacji: po
  czesku, niemiecku i polsku dzień pierwszy, po angielsku miesiąc pierwszy. Ten sam plik GEDCOM wczytany w innym
  języku aplikacji daje więc inną datę. Jednoznaczną datę (`25/3/1919`, `3/3/1919`) czyta się wszędzie tak samo.
- **Import GEDCOM** przy zamienialnym dniu i miesiącu oraz przy „cca” przed zakresem zostawia obok daty notatkę
  z pierwotnym zapisem („Data w zapisie: Cca 1850-1852”). `Mezi 1850 - 1852` czyta się jako przedział 1850–1852.
- **Tekst w danych** pokazuje się, sortuje, liczy się z niego wiek i do GEDCOM idzie jako data (`ABT`, `BEF`, `AFT`,
  `BET … AND`). Sam tekst się nie zmienia; zapisanie formularza osoby, wydarzenia lub związku zapisze go w zapisie
  aplikacji.
- **Granice:**
  - ukośnik między dwoma latami (`1850/1851`) pole daty czyta jako okres od 1850 do 1851; import GEDCOM zostawia go
    tekstem (dwa lata jako alternatywa);
  - tekstem zostaje: znak zapytania (`1850?`), nieznane cyfry (`18XX`), kwartał (`Q4/1850`), pora roku, „nebo”,
    „cca po” i „cca před” oraz wartości słowne. Pole daty odrzuca je jako nieprawidłową datę; import zostawia je
    w notatce „Data w zapisie: …” (`Cca po 1850` i `Cca podzim 1850` czyta jako „około 1850” z notatką);
  - tekstem zostaje też data, która nie istnieje (`31/4/1850`), rok z pięcioma cyframi i zakres, którego początek
    jest po końcu;
  - drzewa zaimportowane wcześniej same się nie poprawią; poprawi je nowy import GEDCOM.
- **Obsługa:** pole daty w formularzu; import GEDCOM ([A2.1](#A2.1)).
- **Obowiązuje od:** aplikacja 3.27.0

<!-- zdroj: app:src/dates.ts normalizeDateInput → normalizeDateForm ?? readWrittenForms (readDateWords, readHyphenRange: slovo „mezi“, „cca“ před rozsahem → rozmezí, začátek po konci → null), readWrittenDate (lomítkové datum, zaměnitelné ≤ 12 a různé → assumed), parseFlexDate → parseCanonical ?? readStoredText (text v datech čten v jazyce UI, nemění se), canonicalDate · src/date-words.ts isAboutWord, isBetweenWord · src/gedcom-date-read.ts readGedcomDate (readWrittenDate, lossy → poznámka gedcomDatePhrase) · src/ged-exporter.ts canonicalDate · strings.ts gedcomNotes.datePhrase · commit 7ed8123c · ověřeno voláním normalizeDateInput a parseGedcomDate v cs a en (10. 11.); lomítko: normalizeDateInput('1850/1851') → FROM 1850 TO 1851, '1850-11/1851' → FROM NOV 1850 TO 1851, 'mezi 1850-11/1851' → BET 1850 AND NOV 1851, parseGedcomDate('1850/1851') → text (dirigent:test/vysledek-1110-doc-tabulka-p2.md nález 1, sonda 10. 11. na app f34d41e1) · dirigent:prace/1110-app-tabulka-opravy/t42-tabulka.md (Pravidla opravy, Bez opravy, Rizika); vzory smyšlené -->

<a id="A2.5"></a>
## A2.5 Relacje i stan pary

Rodzina (`FAM`) daje relację dwojga partnerów i ich dzieci. Stan pary określają śluby i rozwody w kolejności pliku;
zdarzenia z datą porównuje się według daty. Znacznik `_STAT` ma pierwszeństwo przed zdarzeniami.

- **Granice:** `_STAT` zna wartości małżonkowie, rozwiedzeni, w separacji i partnerzy bez ślubu (po angielsku
  `married`, `divorced`, `separated`, `partners`, `unmarried`, `cohabiting` i in.). Rozwód i ponowny ślub tej samej
  pary dają notatkę „Rozwód …, ponowny ślub …”. Tę samą parę w dwóch rodzinach się łączy. Trzeci partner w jednej
  rodzinie nie zostaje przeniesiony i się go liczy. Rodzina z jednym rodzicem dostaje zastępczego drugiego rodzica
  „?”. Rodzina bez dzieci i bez rodzica zostaje tylko wtedy, gdy coś mówi (ślub, data, źródło, notatka). Dziecko
  zapisane w kilku rodzinach pokazuje się przy rodzinie biologicznej; pozostałe zapisuje się w notatce („Zapisano
  również jako dziecko adoptowane rodziców …”). Adopcję i rodzinę zastępczą czyta się z `PEDI`, a dokładniej
  z `_FREL` i `_MREL`. Eksport pisze `_STAT` tylko dla par bez ślubu i w separacji.
- **Obsługa:** Brak; stan poprawia się w relacji w karcie osoby.
- **Obowiązuje od:** aplikacja 3.0.0 (`_STAT`), 1.16.0 (dziecko w kilku rodzinach), 3.8.0 (kolejne zdarzenia pary).
- **Od aplikacji 3.22.0:** Czyta się też `_RELATIONSHIP_STATUS`; w 3.21.2 liczy się do **Nieobsługiwane**.
  Wartości obu znaczników rozpoznaje się także po czesku, polsku i niemiecku („manželé”, „rozvedeni”, „druh
  a družka”, „rozwiedzeni”, „Lebensgemeinschaft”). Nieznana wartość liczy się do **Nieobsługiwane**. Jeśli rodzina
  ma oba znaczniki, wygrywa `_STAT`.

<!-- zdroj: app:src/ged-parser.ts:1496 resolveUnionStatus, :1545 statusFromStat, :1563 přednost _STAT, :3453 dítě ve více rodinách, :2684 PEDI · app:src/ged-exporter.ts:70 GEDCOM_STAT · strings.ts gedcom.otherFamilyLinks -->

<a id="A2.6"></a>
## A2.6 Źródła, cytaty i QUAY

Rekord źródła (`SOUR`) daje źródło aplikacji: tytuł, archiwum, sygnaturę, transkrypcję (`TEXT`), odnośnik
i wycinki. Cytat przy urodzeniu i zgonie dokumentuje urodzenie i zgon osoby, cytat przy osobie osobę, cytat przy
rodzinie parę. Ocena `QUAY` pokazuje się jako **Wiarygodność źródła**: 3 to **Oryginał**, 2 **Odpis / indeks**, 1 i 0
**Niepewne**.

- **Granice:** Bez `TITL` bierze się skrót `ABBR`, w przeciwnym razie „?”. Wydawca, autor i sygnatura w archiwum
  trafiają do notatki źródła. Cytat ze stroną (`PAGE`) inną niż przy źródle tworzy pochodne źródło dla tej strony
  z tym samym tytułem i archiwum; transkrypcja i wycinki na nie nie przechodzą. Od aplikacji 3.26.0 to samo robi cytat tej samej strony z inną datą zapisu (`DATA` › `DATE`). Wiarygodność
  należy do cytatu ([A2.6.1](#A2.6.1)). `DATA` i `TEXT` wewnątrz cytatu się nie czyta. Każdy
  obraz przy źródle to wycinek. Pewności z obcego programu aplikacja nie zmienia. Jak badanie przejmuje `QUAY` jako
  formę i informację źródła, mówi [R3.2.1](R3-verification-and-citation.md#R3.2.1); kiedy dana jest udokumentowana,
  [R3.8](R3-verification-and-citation.md#R3.8). Źródła w aplikacji opisuje [A3](A3-evidence-in-the-app.md).
- **Obsługa:** **Wiarygodność źródła** w szczegółach źródła (**Oryginał**, **Odpis / indeks**, **Niepewne**).
- **Obowiązuje od:** aplikacja 1.9.4 (`QUAY`), 3.9.0 (pochodne źródło dla strony).
- **Od aplikacji 3.22.0:** Opowieść osoby (`_STORY`) czyta i eksportuje także odnośniki do źródeł.
- **Od aplikacji 3.27.0:** sygnatura z `REPO` › `CALN` trafia do pola **Sygnatura** (pierwszy `CALN`), nie do
  notatki; wydawca i autor zostają w notatce. Eksport pisze księgę jako `1 REPO` z `2 CALN` i jedną
  czytelną `PAGE` złożoną z pól: folio, dalsza lokalizacja, skan („fol. 12v, nr 5, skan 34”; słowo dla skanu w języku
  aplikacji). Numer, który dalsza lokalizacja już wymienia, się nie powtarza. Źródło bez folio i skanu eksportuje się
  dokładnie jak dotąd. Pola źródła opisuje [A3.9](A3-evidence-in-the-app.md#A3.9).

<!-- zdroj: app:src/ged-parser.ts:2140–2230 záznam SOUR, :1700 noteQuay, :3010–3055 citace a odvozené prameny, :3099–3140 převod pramenů · app:src/ui/sources.ts:75 qualityLabel · app:src/ged-exporter.ts pushCitation · strings.ts gedcom.quality1–3, gedcom.reliabilityLabel · research:src/sync.ts:4660 QUAY_EVIDENCE · 3.27.0: app:c3278633 src/ged-parser.ts (REPO jen první, CALN → callNumber), src/ged-exporter.ts (1 REPO / 2 CALN, composePage), src/source-location.ts composePage, imageWord · datum zápisu: app:fcfc71d2 (v3.26.0) pageSources klíč s datem, spec 066 K3.1 -->

<a id="A2.6.1"></a>
### A2.6.1 Wiarygodność przy cytacie

Ten sam zapis bywa dla jednej danej oryginałem, a dla innej informacją wtórną: spis ludności podaje zawód z pierwszej
ręki, wiek z drugiej. Dlatego `QUAY` należy do cytatu, nie do źródła. Źródło ma domyślną wiarygodność, a cytat z inną
wartością zachowuje własną.

- **Pilnuje kod:**
  - cytaty tego samego zapisu z tą samą stroną, tą samą datą zapisu i tymi samymi dalszymi wierszami cytatu, które
    różnią się tylko `QUAY`, są cytatami jednego źródła. Źródło jest w **Źródła** raz, ze swoimi obrazami (`OBJE`);
  - inna strona albo inna data zapisu nadal tworzy osobne źródło dla tego zapisu ([A2.6](#A2.6));
  - domyślna wiarygodność źródła to `QUAY` jego pierwszego cytatu (cytat bez `QUAY` bierze `QUAY` rekordu, jeśli go
    ma); cytat z innym `QUAY` go zachowuje, cytat bez `QUAY` przy źródle z domyślną wiarygodnością zostaje bez niej;
  - eksport (do badania, **Z powrotem do {program}** i **Do udostępnienia innym**) pisze przy każdym cytacie jego
    `QUAY`: własne, w przeciwnym razie domyślne źródła. Drzewo bez cytatów z własną wiarygodnością eksportuje się
    dokładnie jak dotąd. Wczytanie i ponowny eksport nie zmieniają więc `QUAY` żadnego cytatu.
- **Drzewo zapisane starszą wersją:** przy otwarciu źródła, które wczytanie w aplikacji 3.26.0 utworzyło tylko z powodu
  innego `QUAY` tej samej strony, łączą się z powrotem ze swoim źródłem. Ich cytaty przechodzą na to źródło,
  a wiarygodność przechodzi na cytat. Przedtem aplikacja zapisuje kopię zapasową **Przed dostosowaniem danych do nowej
  wersji** ([S6.5](S6-tree-from-another-program.md#S6.5)). Łączy się tylko źródło, które różni się od swojego
  jedynie wiarygodnością; źródło z własną notatką, transkrypcją, wycinkiem albo innym tekstem zostaje. Badanie,
  z którym drzewo jest połączone, nie dostaje przez to żadnej zmiany (źródło i strona są te same), a etykieta **Obraz
  tylko w badaniu** przy połączonym źródle znika ([A3.8](A3-evidence-in-the-app.md#A3.8)).
- **Granice:** wiarygodność pojedynczego cytatu aplikacja tylko pokazuje ([A3.6](A3-evidence-in-the-app.md#A3.6),
  [S7.1](S7-reliability-and-verification.md#S7.1)); zmienić można tylko domyślną **Wiarygodność źródła** w edytorze
  źródła ([A3.1](A3-evidence-in-the-app.md#A3.1)).
- **Obowiązuje od:** aplikacja 3.27.0 (w 3.26.0 cytat z innym `QUAY` tworzył drugie źródło bez obrazów)

<!-- zdroj: dirigent:spec/077-spolehlivost-u-citace/spec.md K1.1–K1.7 · app:5721b016 src/ged-parser.ts pageSources (klíč bez quay), citedQuay, citationQuay (null = citace bez QUAY), src/citation-quality.ts citationQuality, setCitationQuality, qualityOnlySources (DERIVED_FIELDS, entryKey), joinQualityOnlySources, src/ged-exporter.ts pushCitation(cited), src/data.ts v19, src/tree-manager.ts joinQualityOnlySourcesOf (createSnapshot pre-migration, fingerprint, rebaseResearchCopies), strings.ts snapshots pre-migration · app:dde0151a src/research-changes.ts citedKey · dirigent:test/vysledek-1111-app-spolehlivost-citace.md (import 1 pramen s obrázkem, round trip QUAY 2/3, migrace v18) -->

<a id="A2.7"></a>
## A2.7 Własne znaczniki Stromu i co wraca

Eksport aplikacji pisze własne znaczniki z przedrostkiem `_STROM`, aby przy ponownym wczytaniu wróciło to, czego
GEDCOM 5.5.1 nie potrafi. Nagłówek `1 SOUR STROM` mówi, że plik napisał Strom.

- **Granice:** Przy eksporcie i ponownym wczytaniu wraca: nazwisko po ślubie (jako drugie `NAME` z `TYPE married`),
  imię i nazwisko, którego osoba używa, linie rodowe, grupy wariantów nazwiska, pytania i opowieści osoby, stan
  danych, rodzaj i odcisk obrazów, weryfikacja transkrypcji (`_STROM_VERIFIED`), odczyt zapisu, wycinki z kadrowaniem,
  rodziny bez pary (`_STROM_NO_COUPLE`), stosunek dziecka do rodziców i świadkowie. Z eksportu nie wraca: kto czytał
  transkrypcję (`_STROM_READ`), obraz pominięty z powodu rozmiaru i rekordy miejsc. Bloki badawcze (sprzeczności,
  hipotezy, wyszukiwania, powiązania, wyspy, szkice) czyta się tylko z pliku badania, a eksport aplikacji ich nie
  pisze. Plik bez nagłówka Stromu czyta się bez jego zwyczajów: opisy zamiast imienia trafiają do notatki
  ([A2.3](#A2.3)). Wiersze powiązania z badaniem w nagłówku (`_STROM_TREE` i in.) omawiają S1 i S2.
- **Obsługa:** **Eksport → Eksport GEDCOM**.
- **Obowiązuje od:** aplikacja 3.9.0 lub wcześniej (poszczególne znaczniki przybywały do 3.19.0).
- **Od aplikacji 3.26.0:** identyfikatory programów wracają pod `_STROM_IMPORT` i `_STROM_XID`; przy ponownym
  wczytaniu plik paruje się według nich ([S6.7](S6-tree-from-another-program.md#S6.7)). Plik z nagłówkiem Stromu nie jest
  drzewem z innego programu: nie ma znacznika **Z drzewa** ani karty **Co dalej**.
- **Od aplikacji 3.27.0:** folio, skan i dalsza lokalizacja źródła wracają pod `_STROM_FOLIO`, `_STROM_IMAGE`
  i `_STROM_LOCATOR` obok złożonej `PAGE`; ze znacznikami obowiązują pola, nie `PAGE`. Eksport **Z powrotem do
  {program}** ([S6.6](S6-tree-from-another-program.md#S6.6)) dla programu, z którego drzewo przyszło, ich nie pisze.
  Badaniu aplikacja wysyła je tylko wtedy, gdy badanie mówi, że je czyta.
- **Od aplikacji 3.28.0:** każdy eksport GEDCOM (także **Z powrotem do {program}**) pisze:
  - wspólne wydarzenie ([A10.1](A10-shared-events.md#A10.1)) przy każdej osobie osobno, także ze źródłem, aby
    odczytały je inne programy, a pod nim `2 _STROM_SHARE` z oznaczeniem wydarzenia i `3 _ROLE` z rolą osoby. Tylko
    gdy w pliku są co najmniej 2 kopie (eksport części drzewa lub ochrona osób żyjących mogą pozostałe pominąć);
    przy ponownym wczytaniu kopie znów się łączą. Podpowiedź eksportu: „Wspólne wydarzenie zapisuje się u każdej osoby
    osobno, ze źródłem, aby inne programy mogły je odczytać. Strom przy następnym imporcie znów je połączy.”;
  - **Chrzestny** i **Świadek ślubu** ([A10.5.1](A10-shared-events.md#A10.5.1)) jako `1 EVEN` z `2 TYPE`
    i `2 _STROM_ROLE` (`godparent`, `witness`); jeśli w pliku jest też osoba lub rodzina tego wydarzenia, pod nim
    `3 _STROM_AT` z odnośnikiem do niej i `4 TYPE` ze znacznikiem tego wydarzenia (`BAPM`, `MARR` …);
  - odrzucone połączenie chrzestnego lub świadka ([A10.5.2](A10-shared-events.md#A10.5.2)) jako
    `3 _STROM_NOT_LINK @I…@` pod uczestnikiem (`_WITN`, `ASSO`). Odnośnik do osoby, której w pliku nie ma, przy
    wczytaniu się odrzuca.

<!-- zdroj: app:src/ged-exporter.ts:506 STROM_SEX_U_LINE, :508 exportToGedcom, :680 TYPE married · app:src/ged-parser.ts:2174 _STROM_VERIFIED/_STROM_READ, :2324 výzkumné bloky, :2574 _DRAFT, :2654 _STROM_STATUS, :1914 _STROM_PLACE · app:src/research-link.ts:2936 researchHeaderLines · 3.27.0: app:c3278633 src/ged-exporter.ts sourceFields (false pro výzkum bez sources.fields, nikdy u backTo), src/ged-parser.ts placeFields (s _STROM_* platí pole) · 3.28.0: app:80c2ffb9 src/ged-shares.ts (_STROM_SHARE + _ROLE/ROLE, _STROM_ROLE + _STROM_AT + 4 TYPE, LINK_REJECTED_TAG _STROM_NOT_LINK), src/ged-exporter.ts (_STROM_SHARE jen s ≥ 2 kopiemi v souboru), strings.ts exportHelp sharedEvents -->

<a id="A2.8"></a>
## A2.8 Ponowny import i scalanie

Każdy import jako nowe drzewo zakłada nowe drzewo; stare drzewa się nie zmieniają. **Scal z istniejącym** łączy
w pary osoby z pliku z osobami bieżącego drzewa, a wynik zapisuje jako kolejne nowe drzewo
([A8](A8-merging-trees.md)).

- **Granice:** ponowny import pliku badania do drzewa badania omawia [S1](S1-connecting-app-and-research.md).
- **Obsługa:** **Import → Import GEDCOM → Importuj jako nowe drzewo** lub **Scal z istniejącym**.
- **Obowiązuje od:** aplikacja 1.0.0
- **Od aplikacji 3.26.0:** drzewo tego samego programu wczytane ponownie paruje się także według identyfikatora
  programu (powód **Ten sam identyfikator w pliku**); dopasowanie 50–79 jest tylko proponowane
  ([S6.7](S6-tree-from-another-program.md#S6.7)).

<!-- zdroj: app:src/merge/ui.ts:1447 TreeManager.createTree · strings.ts treeManager.importAsNewTree, importDialog.mergeExisting -->
