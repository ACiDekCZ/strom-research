<a id="A2"></a>
# A2 Wczytanie drzewa genealogicznego (GEDCOM)

Rozdział mówi, co aplikacja przejmie z pliku GEDCOM z innego programu, co pominie i jak to przyzna w podsumowaniu
importu. Opisuje aplikację Strom 3.21.2 (i badanie 1.25.2); zmiany z nowszej wersji mają przy sobie jej numer. Otwarcie
pliku badania i powiązanie drzewa z badaniem należy do rozdziału S1.

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

<!-- zdroj: app:src/ged-parser.ts:1450 KNOWN_INDI_TAGS, :1453 KNOWN_FAM_TAGS, :1464 KNOWN_RECORD_TYPES, :1478 IGNORED_BOOKKEEPING_TAGS, :636 NOTED_INDI_TAGS, :2094 drop, :2410, :2486, :2194 · strings.ts gedcom.unsupported, gedcom.skippedTags, gedcomNotes.factLabels -->

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

<!-- zdroj: app:src/ui/import-export.ts:374 handleGedcomFile, :410 showGedcomResultDialog · app:src/ged-parser.ts:3880 statistiky convertToStrom, :3186 pohlaví · strings.ts gedcom.*, importImages.* -->

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

<!-- zdroj: app:src/ged-parser.ts:1262 decodeGedcomFile, :1236 decodeAnsel, :1290–1380 předzpracování CONC/CONT, :1683 parseGedcom · app:src/ged-exporter.ts:508 exportToGedcom · index.html input accept=".ged" -->

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

<!-- zdroj: app:src/gedcom-date-read.ts:22 parseGedcomDate, :33 gedcomDatePhrase, :55 readGedcomDate · app:src/date-words.ts · app:src/ged-parser.ts:702 kalendář, :1157 gedcomDates · app:src/gedcom-date-form.ts · strings.ts gedcomNotes.datePhrase -->

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
  z tym samym tytułem i archiwum; transkrypcja i wycinki na nie nie przechodzą. `QUAY` rekordu ma pierwszeństwo przed
  `QUAY` cytatu, a dla każdego źródła obowiązuje pierwszy cytat. `DATA` i `TEXT` wewnątrz cytatu się nie czyta. Każdy
  obraz przy źródle to wycinek. Pewności z obcego programu aplikacja nie zmienia. Jak badanie przejmuje `QUAY` jako
  formę i informację źródła, mówi [R3.2.1](R3-verification-and-citation.md#R3.2.1); kiedy dana jest udokumentowana,
  [R3.8](R3-verification-and-citation.md#R3.8). Źródła w aplikacji opisuje [A3](A3-evidence-in-the-app.md).
- **Obsługa:** **Wiarygodność źródła** w szczegółach źródła (**Oryginał**, **Odpis / indeks**, **Niepewne**).
- **Obowiązuje od:** aplikacja 1.9.4 (`QUAY`), 3.9.0 (pochodne źródło dla strony).
- **Od aplikacji 3.22.0:** Opowieść osoby (`_STORY`) czyta i eksportuje także odnośniki do źródeł.

<!-- zdroj: app:src/ged-parser.ts:2140–2230 záznam SOUR, :1700 noteQuay, :3010–3055 citace a odvozené prameny, :3099–3140 převod pramenů · app:src/ui/sources.ts:75 qualityLabel · app:src/ged-exporter.ts pushCitation · strings.ts gedcom.quality1–3, gedcom.reliabilityLabel · research:src/sync.ts:4660 QUAY_EVIDENCE -->

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

<!-- zdroj: app:src/ged-exporter.ts:506 STROM_SEX_U_LINE, :508 exportToGedcom, :680 TYPE married · app:src/ged-parser.ts:2174 _STROM_VERIFIED/_STROM_READ, :2324 výzkumné bloky, :2574 _DRAFT, :2654 _STROM_STATUS, :1914 _STROM_PLACE · app:src/research-link.ts:2936 researchHeaderLines -->

<a id="A2.8"></a>
## A2.8 Ponowny import i scalanie

Każdy import jako nowe drzewo zakłada nowe drzewo; stare drzewa się nie zmieniają. **Scal z istniejącym** łączy
w pary osoby z pliku z osobami bieżącego drzewa, a wynik zapisuje jako kolejne nowe drzewo
([A8](A8-merging-trees.md)).

- **Granice:** ponowny import pliku badania do drzewa badania omawia [S1](S1-connecting-app-and-research.md).
- **Obsługa:** **Import → Import GEDCOM → Importuj jako nowe drzewo** lub **Scal z istniejącym**.
- **Obowiązuje od:** aplikacja 1.0.0

<!-- zdroj: app:src/merge/ui.ts:1447 TreeManager.createTree · strings.ts treeManager.importAsNewTree, importDialog.mergeExisting -->
