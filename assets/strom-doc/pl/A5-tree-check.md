<a id="A5"></a>
# A5 Kontrola drzewa

Co aplikacja sprawdza w drzewie, z jakimi progami i co można zrobić z wynikiem: naprawić, oznaczyć jako **To nie
błąd** albo zostawić do oceny badaniu. Opisuje aplikację Strom 3.21.2 (i badanie 1.25.2).
Badanie ma własną kontrolę `strom check` ([R5](R5-conflicts.md)). Nie jest tu opisana, poza miejscami, w których
obie się zgadzają.

<a id="A5.1"></a>
## A5.1 Kontrola i jej wyniki

Aplikacja sprawdza całe drzewo za każdym razem, gdy kontrola się otwiera. Nic się nie zapisuje i drzewo się nie
zmienia.
Każdy wynik ma wagę:

| Waga | Sekcja w oknie | Znaczenie |
|---|---|---|
| błąd | **Do sprawdzenia** | dane sobie przeczą albo są uszkodzone ([A5.2](#A5.2), [A5.3](#A5.3), [A5.4](#A5.4)) |
| do sprawdzenia | **Do sprawdzenia** | nietypowa wartość, mało prawdopodobna, ale możliwa; warto ją sprawdzić |
| info | **Wskazówki** | „To nie są błędy. Wskazówki, które mogą pomóc w poszukiwaniach.” ([A5.5](#A5.5), [A5.6](#A5.6)) |

- **Granice:**
  - Wyniki tego samego rodzaju tworzą grupę, uporządkowaną według wagi, wielkości i nazwy. Otwarta jest tylko grupa
    z błędem.
    Powyżej 50 wyników kolejne pokazują się po 20. Na telefonie (do 640 px) **Wskazówki** są zwinięte, jeśli jest też
    sekcja **Do sprawdzenia**.
  - **Od aplikacji 3.27.0:** sekcja błędów i wyników do sprawdzenia nazywa się **Do sprawdzenia** (wcześniej
    **Problemy**). Drzewo bez nich ma „Nic do sprawdzenia”, ze wskazówkami „Nic do sprawdzenia. 3 wskazówki.”
  - **Od aplikacji 3.28.0:** w **Do sprawdzenia** jest grupa **Wspólne wydarzenia**: kopie jednego wspólnego
    wydarzenia, których wspólne dane się różnią, z **Ujednolić…** i **Odłącz różniącą się kopię**
    ([A10.3](A10-shared-events.md#A10.3)).
  - Osób zastępczych się nie zgłasza. Wynik oznaczony **To nie błąd** ([A5.7](#A5.7)) nie jest liczony ani
    pokazywany.
  - Drzewo tylko do odczytu wyniki tylko pokazuje. Przy innym niż otwarte drzewie naprawa lub oznaczenie najpierw
    drzewo otwiera.
  - **Od aplikacji 3.27.0:** waga, która wcześniej nazywała się „ostrzeżenie”, nazywa się **do sprawdzenia**, także
    w podsumowaniach i liczbach („2 błędy, 1 do sprawdzenia, 3 wskazówki.”). Widok Tabela pokazuje wyniki
    bezpośrednio w komórkach, a wynik oznaczony **To nie błąd** jako **nietypowe** ([A6.7.5](A6-views.md#A6.7.5)).
- **Obsługa:** okno **Walidacja drzewa**: **Przegląd drzewa → Jakość danych → Szybkie działania → Szczegóły
  walidacji**, wiersz „n wskazówek ›” w **Spójność** (otwiera od razu **Wskazówki**), karta z błędami w **Na czym się
  skupić**.
  Od aplikacji 3.27.0 także **Jakość danych ›** w dymku wyniku w widoku Tabela: otwiera okno na grupie tego wyniku
  (przy wyniku oznaczonym **To nie błąd** na liście oznaczonych).
  Po imporcie GEDCOM aplikacja pyta („Kontrola danych”) tylko wtedy, gdy znajdzie błędy lub wyniki do sprawdzenia
  ([A2](A2-loading-a-family-tree.md)).
  To samo po scaleniu z innym drzewem, dla nowych wyników. Własnej pozycji w menu kontrola nie ma.
- **Obowiązuje od:** aplikacja 1.0.0; sekcje **Problemy** i **Wskazówki** aplikacja 3.17.0; nazwa **do sprawdzenia**
  i odnośnik z widoku Tabela aplikacja 3.27.0; sekcja **Do sprawdzenia** i „Nic do sprawdzenia” aplikacja 3.27.0

<!-- zdroj: app:src/validation.ts:83 validateTreeData, :1370 groupValidationIssues · src/ui/tree-stats.ts:101 LONG_GROUP, :148 showTreeValidationDialog · src/ui/import-export.ts:1341 offerPostImportValidation · src/ui/merge/ui.ts:1515 · strings.ts treeManager.validationTitle, valProblems, valLeads, leadsIntro, valReadOnly, valShowMore, postImportCheck · 3.27.0: app:59a8eed0 strings.ts treeManager.validationWarnings „k ověření“, summaryErrors, summaryNoErrors, treeOverview.countWarnings · src/ui/table-view/table-bubble.ts (Kvalita dat ›) → src/ui/tree-stats.ts showTreeValidationDialog focus · table.sev.* · commit e530019b · „K ověření“: strings.ts treeManager.valProblems, commit 79764eba; „Nic k ověření“: validationPassed, summaryLeadsOnly, commit b1cbe546 (T54 G15) -->

<a id="A5.1.1"></a>
### A5.1.1 Naprawa jednym kliknięciem

Niektóre wyniki mają przycisk **Napraw**; podsumowanie nad wynikami ma **Napraw wszystko (n)** dla wszystkich wyników,
które da się naprawić. Naprawa to jeden krok wstecz („naprawa z walidacji”) i zapisuje się w historii zmian.

- Pod **Napraw wszystko (n)** jest, co zostanie naprawione, z liczbami, tylko dla rodzajów, które drzewo ma: „Do
  naprawy: uszkodzone powiązania między osobami a związkami (2); związek osoby z samą sobą – zostanie usunięty (1);
  zduplikowany związek – zostanie połączony z pierwszym, dzieci zostają (1); miejsce zapisane na kilka sposobów –
  zostanie ujednolicone do najczęstszego zapisu (3). Pozostałe wyniki pozostaną bez zmian.” W drzewie tylko do
  odczytu nie ma ani przycisku, ani tego wiersza.

| Wynik | Co zrobi naprawa |
|---|---|
| Odwołanie do nieistniejącego rekordu, uczestnik bez osoby | usunie odwołanie |
| Rodzic nie ma odwołania do dziecka, dziecko do rodzica, osoba do związku | uzupełni brakujące odwołanie (rodziców tylko dziecku z mniej niż 2 rodzicami) |
| Związek osoby z samą sobą | usunie go |
| Zduplikowany związek | zostawi pierwszy, dzieci przeniesie do niego |
| Jedno miejsce zapisane na kilka sposobów | przepisze wszystkie zapisy na najczęstszy |

- **Obowiązuje od:** aplikacja 1.1.0; naprawa miejsc 1.10.0; wiersz pod **Napraw wszystko (n)** aplikacja 3.27.0

<!-- zdroj: app:src/data.ts:4071 FIXABLE_TYPES, :4097 repairValidationIssue · strings.ts treeManager.valFix, valFixAll · řádek: src/ui/tree-stats.ts fixAllNoteText (orphaned*/missing* → links, selfPartnership, duplicatePartnership, placeSpelling), strings.ts treeManager.valFixAllNote, jen bez ro, commit 79764eba (T54 G15) -->

<a id="A5.2"></a>
## A5.2 Relacje w rodzinie

Kontrola szuka relacji, które nie mogą być prawdziwe. Wszystkie są błędami, poza zduplikowanym związkiem
(do sprawdzenia).

| Wynik w aplikacji | Kiedy |
|---|---|
| **Wykryto cykl przodków** | osoba jest swoim własnym przodkiem; zgłasza się tylko pierwszy cykl |
| **Związek osoby z samą sobą** / **Zduplikowany związek** | partner to ta sama osoba / dwa związki tej samej pary |
| **Rodzic nie ma odwołania do dziecka**, **Dziecko nie ma odwołania do rodzica**, **Niezgodność dziecka w związku** | relacja jest zapisana tylko z jednej strony |
| **Odwołanie do nieistniejącego rekordu** | brakuje rodzica, dziecka, partnera lub związku |
| **Uczestnik zdarzenia odwołuje się do osoby, która już nie istnieje** | chrzestny lub świadek (także świadek ślubu) to usunięta osoba |
| **Więcej niż 2 rodziców** | |
| **Osoba w kilku pokoleniach** | liczenie pokoleń trafia na sprzeczność; partner jest w tym samym pokoleniu |
| **Partner jest też rodzicem / dzieckiem**, **Brat lub siostra jest też rodzicem / dzieckiem** | |

- **Obowiązuje od:** aplikacja 1.0.0; uczestnik zdarzenia 1.16.0

<!-- zdroj: app:src/validation.ts:142 checkCycles, :200, :223, :255, :293, :346-464 orphaned*, :471 tooManyParents, :554 generationConflict, :621 · strings.ts treeManager.val* -->

<a id="A5.3"></a>
## A5.3 Daty i wiek

Kontrola zgłasza tylko to, co na pewno nie jest prawdziwe. Niepełną lub przybliżoną datę liczy w całym możliwym
zakresie: bez miesiąca od stycznia do grudnia, „około” ± 2 lata, „przed” do 20 lat wcześniej, „po” do 20 lat później,
zakres do swojego końca. Dopiero gdy naruszenie obowiązuje w całym zakresie, jest wynikiem. Wyjątkiem są łagodniejsze
granice do sprawdzenia z aplikacji 3.27.0 (niżej): tam wystarczy, że granicę przekroczy jeden koniec możliwego wieku.

| Wynik w aplikacji | Waga | Kiedy |
|---|---|---|
| **Data zgonu jest przed urodzeniem** | błąd | |
| **Nieprawdopodobnie długie życie** | do sprawdzenia | ponad 115 lat |
| **Rodzic młodszy niż dziecko** | błąd | według daty urodzenia |
| **Rodzic bardzo młody / bardzo stary w chwili urodzenia dziecka** | do sprawdzenia | mniej niż 12 / ponad 80 lat; tylko daty urodzenia |
| **Matka przy urodzeniu poniżej 16 lat** / **… powyżej 45 lat** | do sprawdzenia | od aplikacji 3.27.0, zob. niżej |
| **Ojciec przy urodzeniu poniżej 18 lat** / **… powyżej 60 lat** | do sprawdzenia | od aplikacji 3.27.0, zob. niżej |
| **Zdarzenie datowane przed urodzeniem** | do sprawdzenia | |
| **Zdarzenie datowane po zgonie** | do sprawdzenia | poza: Pochówek, Kremacja, Testament, Postępowanie spadkowe |
| **Dziecko urodzone po śmierci matki** | błąd | ponad 1 miesiąc po śmierci; tylko biologiczni rodzice |
| **Dziecko urodzone długo po śmierci ojca** (… **rodzica**, płeć nieznana) | do sprawdzenia | ponad 10 miesięcy |
| **Ślub datowany przed urodzeniem partnera** | błąd | |
| **Ślub datowany po zgonie partnera** | do sprawdzenia | |
| **Ślub w wieku dziecięcym** | do sprawdzenia | mniej niż 14 lat |
| **Ślub w wieku poniżej 16 lat** | do sprawdzenia | od aplikacji 3.27.0, zob. niżej |
| **Zapisany wiek różni się o więcej niż 2 lata** | do sprawdzenia | od aplikacji 3.27.0, zob. niżej |
| **Skrajna różnica wieku partnerów** | info (**Wskazówki**) | 40 lat i więcej |
| **Urodzenie/zgon wpisane jako zdarzenie życiowe** | błąd | urodzenie lub zgon na liście zdarzeń |
| **Własne zdarzenie nie ma nazwy** / **Zdarzenie ma nieprawidłową datę** | do sprawdzenia | |

- **Granice:** te same wyjątki po zgonie ma `strom check` badania. Rodzic bez rodzaju relacji liczy się jako
  biologiczny.
- **Od aplikacji 3.27.0:** łagodniejsze granice do sprawdzenia:
  - **matka** młodsza niż 16 lub starsza niż 45 lat i **ojciec** młodszy niż 18 lub starszy niż 60 lat w chwili
    urodzenia dziecka. Tylko biologiczny rodzic o znanej płci, wiek z obu dat urodzenia;
  - **ślub** w wieku poniżej 16 lat;
  - wystarczy, że granicę przekroczy jeden koniec możliwego wieku (wiek „15–16” jest poniżej 16). Data z **ok.**
    liczy się jako szacunek wieku; daty z **przed** lub **po** się nie porównuje;
  - zgłasza się tylko surowszy wynik: gdzie już obowiązuje **Rodzic młodszy niż dziecko**, **Rodzic bardzo młody /
    bardzo stary** lub **Ślub w wieku dziecięcym**, łagodniejszego wyniku nie ma;
  - **zapisany wiek** (przy ślubie wiek każdego z pary, przy zgonie, przy urodzeniu) porównuje się z wiekiem z daty
    urodzenia i daty zdarzenia. Wynik jest, gdy odbiega od możliwego zakresu o więcej niż 2 lata. Wieku zapisanego
    słowem albo z ok., przed, po się nie porównuje, ani gdy któraś z dat jest tylko szacunkiem;
  - wiersz wyniku pokazuje daty i wiek („* 1850 → * 1866: 15–16”, „⚭ 1872: 30 ≠ 26–27”).
- **Obowiązuje od:** aplikacja 1.0.0 (wiek rodziców); 1.4.0 (zdarzenia); 1.7.0 (daty i zgon); dziecko po śmierci
  rodzica o nieznanej płci 3.10.0; cztery wyjątki po zgonie 3.17.0 (wcześniej tylko pochówek); łagodniejsze granice
  wieku rodziców i ślubu oraz zapisany wiek 3.27.0

<!-- zdroj: app:src/validation.ts:493 checkAgePlausibility MIN_PARENT_AGE MAX_PARENT_AGE, :863 checkDateConsistency MAX_LIFESPAN_YEARS CHILD_MARRIAGE_YEARS PARTNER_AGE_GAP_YEARS POSTHUMOUS_FATHER_MONTHS AFTER_DEATH_EVENT_TYPES, :120 checkLifeEvents · monthRange, certainlyBefore · research:src/core/afterdeath.ts AFTER_BY_NATURE · strings.ts treeManager.val* · 3.27.0: app:59a8eed0 src/validation.ts MOTHER_MIN_AGE 16, MOTHER_MAX_AGE 45, FATHER_MIN_AGE 18, FATHER_MAX_AGE 60, checkParentAgeLimits (gender female/male, parentRelTypes biological, jen když není parentYoungerThanChild/parentTooYoung/parentTooOld), ageSpan (< > → null; ~ approxAgeBetween), spanText, MARRIAGE_MIN_YEARS 16 (else za childMarriage), checkRecordedAges SLACK_YEARS 2 (Partnership.ages, deathAge, birthAge), src/dates.ts recordedAgeGap, ageRangeBetween · strings.ts treeManager.valMotherTooYoung16, valMotherTooOld45, valFatherTooYoung18, valFatherTooOld60, valMarriageUnder16, valRecordedAgeMismatch, validationWarnings, countWarnings, summaryErrors · spec 073 §7.6 · CHANGELOG.cs.md 3.27.0 -->

<a id="A5.4"></a>
## A5.4 Źródła, załączniki i scalenie przy imporcie

| Wynik w aplikacji | Waga | Kiedy |
|---|---|---|
| **Cytat odwołuje się do nieistniejącego źródła** | do sprawdzenia | cytat przy osobie, zdarzeniu, związku lub załączniku |
| **Załącznik nie ma użytecznych danych** | do sprawdzenia | dane nie są obrazem ani PDF (załącznika tylko z oryginałem się nie zgłasza) |
| **Zdjęcie nie jest obsługiwanym obrazem** | do sprawdzenia | inny format niż JPEG, PNG, WebP, GIF |
| Prawdopodobnie dwie osoby scalone w jedną podczas importu pliku GEDCOM (Strom 3.8.1 i starsze)… | błąd | zob. niżej |

Starsze wersje mogły przy imporcie dać dwóm osobom ten sam identyfikator. Kontrola zgłasza to przy wyraźnym znaku
(więcej niż 2 rodziców, osoba sama swoim rodzicem, dzieckiem lub partnerem) albo gdy dziecko urodziło się wcześniej
niż 12 lat po rodzicu, a do tego rodzice lub partner są tej samej płci. Sami rodzice tej samej płci wyniku nie dają.
Rozwiązanie jest w tekście wyniku: pierwotny plik zaimportować ponownie jako nowe drzewo.

- **Obowiązuje od:** aplikacja 1.7.0 (źródła i załączniki); 3.0.0 (zdjęcia); 3.9.0 (scalenie przy imporcie)

<!-- zdroj: app:src/validation.ts:982 checkSourceIntegrity, checkPhotoData, :1199 checkImportMerges · strings.ts treeManager.valCitationMissingSource, valAttachmentNoData, valPhotoUnsafeData, valImportMerge -->

<a id="A5.5"></a>
## A5.5 Wskazówki: chrzestni i zapisy miejsc

**Wskazówki** nie są błędami. Pokazują, gdzie może być pokrewieństwo albo niejednolity zapis.

- **Powtarzający się chrzestny – często to krewny:** ten sam chrzestny lub świadek występuje przy zdarzeniach co
  najmniej 2 osób, które nie są ze sobą spokrewnione, a te osoby należą do co najmniej 2 grup rodzeństwa. Wiersz
  pokazuje, przy ilu zdarzeniach i osobach.
  Przykład: Marie Vlková jest chrzestną dzieci Horáków i dzieci ich sąsiadów.
- **Jedno miejsce zapisane na kilka sposobów:** zapisy, które różnią się tylko wielkością liter, znakami
  diakrytycznymi albo kropką czy przecinkiem, np. „Brno” i „brno.”. Wiersz pokazuje każdy zapis z liczbą; naprawa
  jest w [A5.1.1](#A5.1.1).
- **Granice:** krewni to osoby najwyżej 3 kroki przez rodziców, dzieci i partnerów. Liczą się uczestnicy zdarzeń
  osoby, świadkowie ślubu i uczestnicy wspólnych zdarzeń pary. We **Wskazówkach** jest też różnica wieku partnerów
  ([A5.3](#A5.3)).
- **Obowiązuje od:** aplikacja 1.10.0 (miejsca); 1.16.0 (chrzestni); grupy rodzeństwa i osoby urzędowe 3.17.0
- **Od aplikacji 3.28.0:** we **Wskazówkach** są jeszcze:
  - to samo wydarzenie zapisane osobno u kilku osób, z **Połącz w jedno wydarzenie** lub **Przejrzyj po kolei**
    ([A10.4](A10-shared-events.md#A10.4));
  - chrzestni i świadkowie zapisani z nazwiska, którym odpowiada osoba w drzewie, z **Przejrzyj po kolei**
    ([A10.5.2](A10-shared-events.md#A10.5.2)).

<!-- zdroj: app:src/godparents.ts:42 RECURRING_THRESHOLD, :188 recurringParticipants, :270 siblingGroupCount, :300 godparentLeads · src/validation.ts:1034 checkPlaceSpellings, checkRecurringGodparents · strings.ts treeManager.valRecurringGodparent, valRecurringGodparentDetail, valPlaceSpelling, leadsSkipped -->

<a id="A5.5.1"></a>
### A5.5.1 Jak rozpoznaje się tego samego chrzestnego

- Osobę połączoną z drzewem rozpoznaje się po rekordzie. Tylko zapisane imię i nazwisko porównuje się jako tekst,
  wiersz ma wtedy „dopasowanie według imienia”.
- Z zapisu bierze się imię i nazwisko do pierwszego przecinka, małej litery lub cyfry. Tytuły i zwroty grzecznościowe
  (kmotr, pan, Mgr. …) się pomija, partykuły (von, de …) zostają, tekst w nawiasie to uwaga. Porównuje się bez
  znaków diakrytycznych i wielkości liter.
- Imię i nazwisko musi mieć co najmniej 2 słowa. Samo imię nigdy nie daje zgodności.
- Nie zgłasza się tego, kto jest przy zdarzeniu z urzędu: udzielającego ślubu, akuszerki i duchownego (farář, kaplan,
  Pfarrer, parochus …). Duchowny zapisany jako chrzestny jest zgłaszany.

<!-- zdroj: app:src/godparents.ts:48 NAME_PARTICLES, :54 NAME_PREFIXES, :80 participantName, :117 CLERGY_WORDS, :121 MIDWIFE_WORDS, :134 attendsByOffice · strings.ts treeManager.valRecurringGodparentByName -->

<a id="A5.6"></a>
## A5.6 Możliwy duplikat osoby

Dwie osoby to być może ta sama, gdy mają to samo nazwisko i to samo imię i urodziły się w tych samych latach.
Porównuje się bez wielkości liter i znaków diakrytycznych. Wynik jest we **Wskazówkach** w grupie **Możliwy duplikat
osoby**.

- **Granice:**
  - Rok urodzenia: data urodzenia; bez niej chrzest (rok chrztu lub rok przed nim); bez niego zgon lub pochówek
    z wiekiem w chwili zgonu. Jeśli oba lata są z urodzenia, muszą się nakładać. W przeciwnym razie mogą być od
    siebie o 2 lata.
  - Gdy u jednej osoby brakuje imienia, wystarczy nazwisko i lata.
  - Osoby bez daty łączy się w pary tylko przy dokładnie tym samym imieniu i nazwisku. Osoby z datą nie łączy się
    w parę z osobą bez daty.
  - Nie zgłasza się: osób zastępczych i bez imienia i nazwiska, niezgodnej płci, rodzica i dziecka oraz par, w których
    jedna osoba na pewno zmarła przed urodzeniem (lub chrztem) drugiej.
- **Obsługa:** **To dwie różne osoby** ([A5.7](#A5.7)); przy werdykcie badania **Scal…** ([A5.6.1](#A5.6.1)).
- **Obowiązuje od:** aplikacja 1.9.9; lata z chrztu i zgonu 3.17.0

<!-- zdroj: app:src/validation.ts:1084 birthYears, :1127 checkPossibleDuplicates STAND_IN_YEARS_SLACK · strings.ts treeManager.valGroupPossibleDuplicate, twoPeople -->

<a id="A5.6.1"></a>
### A5.6.1 Werdykt badania

Przy drzewie z badania aplikacja po otwarciu okna pyta badanie o wszystkie pary. Okno na odpowiedź nie czeka.
Badanie ocenia tylko osoby, które mają jego numer (P…). Rozstrzyga pierwsza reguła, która obowiązuje:

| Kolejność | Badanie ustaliło | Werdykt w aplikacji |
|---|---|---|
| 1 | nie zna osoby | brak |
| 2 | osoby już scaliło | **Scalono w badaniu** |
| 3–9 | dwie osoby oznaczone przez człowieka; inna płeć; rodzic i dziecko; urodzenie lub chrzest ponad 3 lata od siebie; jedna osoba zmarła, zanim druga się urodziła; rodzeństwo (drugie dziecko dostało imię zmarłego); inni rodzice | **Dwie osoby** |
| 10 | imiona i nazwiska różnią się w badaniu | **Niepewne** |
| 11–12 | ci sami rodzice i znane lata; ten sam zapis w źródle u obu | **Prawdopodobnie ta sama osoba** |
| 13–14 | bliskie lata i nic więcej; u jednej osoby brak daty | **Niepewne** |

- **Granice:**
  - Pary z werdyktem **Prawdopodobnie ta sama osoba** i **Scalono w badaniu** idą na górę, potem **Niepewne**, potem
    bez werdyktu.
  - Pary **Dwie osoby** idą na bok do wiersza **Rozróżnione przez badanie: n** i nie są liczone.
  - Werdykt, który przyjdzie do otwartej grupy, tylko dodaje etykietę. Kolejność zmieni się dopiero przy kolejnym
    otwarciu.
  - Pod grupą jest **Badanie ocenia…** lub **Ocenione przez badanie**. Gdy nie działa badanie, które oceniało przy
    ostatnim połączeniu: „Bez oceny badania – badanie nie działa.” Badania, które oceniać nie umie, się nie wymienia.
- **Obsługa:** przy werdykcie **Scal…** (scalenie osób) lub **Wczytaj nową wersję** · terminal:
  `strom person compare P… P…`, dla wielu par `--pairs-from`. Połączenie z badaniem:
  [S1](S1-connecting-app-and-research.md).
- **Obowiązuje od:** aplikacja 3.17.0 (badanie 1.22.0)

<!-- zdroj: app:src/duplicate-verdicts.ts:18 MAX_JUDGE_PAIRS, :54 issueResearchPair, :142 verdictRank, :154 verdictsMode, :192 verdictReasonText · src/quality-bridge.ts:172 postDuplicates · strings.ts treeManager.verdict*, reason* · research:src/core/duplicates.ts judge YEARS_CLOSE · src/core/live.ts:168-192 · src/commands/quality.ts person compare -->

<a id="A5.6.2"></a>
### A5.6.2 Podpowiedź przy wpisywaniu osoby

Przy wpisywaniu nowej osoby aplikacja pokaże najwyżej 3 podobne osoby („Podobne osoby już istnieją:”). Porównuje
inaczej niż [A5.6](#A5.6): wynikiem podobieństwa jak przy scalaniu, nigdy z niezgodną płcią.
- **Obsługa:** **Przejdź do osoby**, **Użyj istniejącej** · wyłączenie **Ustawienia → Powiadomienia → Podpowiedzi
  duplikatów**.
- **Obowiązuje od:** aplikacja 1.4.0

<!-- zdroj: app:src/ui/duplicate-suggest.ts:22 MAX_SUGGESTIONS, :75 runDuplicateCheck · findSimilarPersons SIMILAR_PERSON_THRESHOLD · strings.ts duplicateSuggest.settingLabel, useExisting -->

<a id="A5.7"></a>
## A5.7 To nie błąd

Wynik, który nie jest błędem, się oznacza. Potem nie jest już zgłaszany, nawet gdy drzewo zostanie sprawdzone
ponownie.
Oznaczenie to zmiana drzewa: ma krok wstecz i wpis w historii zmian. Przy możliwym duplikacie przycisk nazywa się
**To dwie różne osoby**.

- **Granice:**
  - Ten sam wynik aplikacja rozpoznaje po rodzaju, osobach i przedmiocie. Przedmiot to rok przy zdarzeniu lub ślubie
    po zgonie, imię i nazwisko przy chrzestnym i najczęstszy zapis przy miejscu. Gdy coś z tego się zmieni, wynik
    pokaże się ponownie.
  - Przy drzewie z badania oznaczenie trafia do badania, gdy wszystkie osoby wyniku mają numer badania (najwyżej 20
    osób). Plik GEDCOM z badania oznaczeń nie niesie; przy wczytaniu nowej wersji przejmuje się je ze starej wersji
    drzewa.
  - Badanie respektuje oznaczenia przy zdarzeniu i ślubie po zgonie: `strom check` ich nie zgłasza, a agent ich nie
    bada.
  - Stan oznaczenia: **Wysłano do badania**, **Czeka na badanie** (badanie nie działa, wyśle się przy następnym
    połączeniu), **Tylko w aplikacji** (badanie go nie przyjęło albo osoby nie mają numeru; ponownie się nie
    wysyła), **Oznaczono w badaniu**.
  - Oznaczenie przy miejscu nie ma osób, dlatego do badania się go nie wysyła. Przy wydzieleniu części drzewa zostają
    tylko oznaczenia, których wszystkie osoby zostają.
  - Oznaczenie zapisane w badaniu aplikacja zna tylko przy otwartym drzewie z badania, gdy badanie działa.
  - **Od aplikacji 3.27.0:** przedmiot przy **Ślub w wieku poniżej 16 lat** to rok ślubu, przy **Zapisany wiek różni
    się o więcej niż 2 lata** dana (urodzenie, ślub, zgon), a przy ślubie jego rok. Oznaczony wynik widok Tabela
    pokazuje jako **nietypowe** i stamtąd można go też oznaczyć i przywrócić ([A6.7.5](A6-views.md#A6.7.5)).
- **Obsługa:** w wierszu wyniku **To nie błąd** / **To dwie różne osoby**, przez 6 s propozycja **Cofnij**. Lista
  **Oznaczono jako „to nie błąd”: n** pod wynikami, przy każdym oznaczeniu data lub **Oznaczono w badaniu**, przycisk
  **Przywróć** · terminal: `strom quality list`, `strom quality dismiss possibleDuplicate P… P…`,
  `strom quality dismiss eventAfterDeath P… --subject 1861`, `strom quality undo …`. Oznaczenie zapisuje tylko
  człowiek, nigdy agent.
- **Obowiązuje od:** aplikacja 3.17.0 (badanie 1.22.0)

<!-- zdroj: app:src/validation.ts:1415 qualityFinding (3.27.0: marriageUnder16 rok, recordedAgeMismatch field + rok) · src/ui/table-view/table-bubble.ts · src/quality-dismiss.ts:47 sanitizeQualityDismissed, :152 dismissalFor, :186 dismissBody, mergeResearchMarks, carryOverTreeDecisions, dismissalsWithin · src/quality-bridge.ts:74 dismissReply · src/ui/quality-ui.ts:155 flushQuality, :257 readQualityMarks · src/data.ts:1674 dismissQualityFinding · src/ui/tree-stats.ts:104 DISMISS_TOAST_MS · strings.ts treeManager.notAnError, twoPeople, dismissedRow, sentToResearch, waitingForResearch, appOnly, markedInResearch · research:src/commands/quality.ts PERSON · src/core/afterdeath.ts -->

<a id="A5.8"></a>
## A5.8 Przegląd drzewa → Jakość danych

Sekcja podsumowuje kontrolę i kompletność drzewa. Liczy tak samo jak okno, bez oznaczonych wyników i bez par, które
badanie rozróżniło.

| Blok | Co pokazuje |
|---|---|
| **Spójność** | podsumowanie („2 błędy, 1 do sprawdzenia, 3 wskazówki.”), 5 najpoważniejszych błędów i wyników do sprawdzenia, „i jeszcze n…”, wiersz „n wskazówek ›” |
| **Kompletność danych** | udział osób z **Data urodzenia**, **Data zgonu (u zmarłych)**, **Miejsce urodzenia**, **Zdjęcie**; poniżej 50 % wyróżnione; „Zawartość drzewa:” (zdjęcia, zdarzenia, źródła, załączniki) |
| **Pewność danych z badania**, **Gdzie brakuje dowodów** | udokumentowanie, zob. [R3.8](R3-verification-and-citation.md#R3.8) i [A3](A3-evidence-in-the-app.md) |
| **Struktura** | liczba związków; niepołączone części albo „Wszystkie osoby są połączone w jedną rodzinę.” |
| **Szybkie działania** | **Szczegóły walidacji**, **Usuń osierocone miejsca (n)**, **Podziel na rodziny** |

- **Granice:**
  - Powyżej 10 MB zdjęć i załączników dochodzi powiadomienie („Media zajmują ponad 10 MB. Plik drzewa wolniej się
    zapisuje i udostępnia.”). Osierocone miejsce to miejsce, do którego nic się nie odwołuje.
  - Niepołączona część nie ma drogi do głównej rodziny; można ją wydzielić (**Wydziel niepołączone części**).
  - Karta w **Na czym się skupić** pokazuje liczbę błędów i najczęstszy rodzaj. Ma przycisk **Popraw** (otwarte
    drzewo) lub **Szczegóły walidacji**; oba otwierają okno.
- **Obsługa:** **Przegląd drzewa → Jakość danych**; w menu drzewa także bezpośrednio **Jakość danych**.
  Działania, które zmieniają dane, są możliwe tylko w otwartym drzewie.
- **Obowiązuje od:** aplikacja 3.13.0; wskazówki i oznaczenia 3.17.0; „do sprawdzenia” zamiast „ostrzeżenie” 3.27.0

<!-- zdroj: app:src/ui/tree-overview.ts:101 TOP_ISSUES, :108 LOW_SHARE, :1882 treeOverviewQualityHtml, :925 selectFocusCards · src/ui/tree-actions.ts:191 overview-quality · strings.ts treeOverview.consistencyTitle, completenessTitle, field*, contentLabel, mediaWarning, structureTitle, allConnected, quickActions, actValidation, actCleanPlaces, actSplitFamilies, cardValidation -->
