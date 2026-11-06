<a id="R3"></a>
# R3 Weryfikacja i cytowanie

Jak badanie ustala, na ile pewna jest każda dana, co musi być spełnione, aby była udokumentowana, i jak pokazuje to
aplikacja. Opisuje badanie 1.25.2 i aplikację Strom 3.21.2; zmiany z nowszej wersji mają przy sobie jej numer. Przy zasadach rozróżnia się, czego **pilnuje kod** (polecenie `strom` w przeciwnym razie odrzuci zapis),
a co jest tylko **zasadą metodyki** (wskazówką dla agenta, której kod nie sprawdza).

<a id="R3.1"></a>
## R3.1 Stopnie pewności danej

Każda dana (urodzenie, chrzest, ślub, zawód…) ma jeden z czterech stopni pewności. Stopień mówi, na ile pewny jest
wniosek ze wszystkich źródeł danej, a nie, na ile dobre jest jedno źródło ([R3.2.1](#R3.2.1)).

| Aplikacja | Terminal | Znaczenie według metodyki |
|---|---|---|
| **Udokumentowane** | udokumentowane | agent sam przeczytał akt oryginalny, a akt podaje daną wprost |
| **Prawdopodobne** | prawdopodobne | dobry dowód, ale pośredni, albo jedyny odczyt trudnego pisma |
| **Możliwe** | możliwe | słaby dowód |
| **Wskazówka** | tylko wskazówka | opowieść rodzinna, drzewo genealogiczne, indeks lub szacunek: co zweryfikować, nie dana |

- **Granice:** dana może też być obalona (`--status disproven`) lub wycofana (`strom event retract E… --reason "…"`).
  Nic nie jest usuwane. Dana wycofana nigdzie się nie pokazuje i nie można jej cytować ani edytować.
  `strom person show` pokazuje nazwy w języku interfejsu tylko człowiekowi; agent czyta tam `proven`, `probable`,
  `possible`, `lead`.
- **Obsługa:** aplikacja: etykieta przy danej (wydarzenia osoby, ślub i rozwód, wspólne wydarzenia pary), tylko do
  odczytu · terminal: `strom person show`, `strom person card`, `strom stats` (wiersz „Dane: udokumentowane … · tylko
  wskazówki …”); zapis `strom event add … --status`, `strom cite E… S… --status`,
  `strom event edit E… --status … --reason "…"`.
- **Obowiązuje od:** badanie 1.0.0; nazwy w języku interfejsu w terminalu 1.1.0 (przy `strom person show` 1.12.0);
  etykieta w aplikacji 3.9.0
- **Od badania 1.26.0:** terminal nazywa stopnie słowami aplikacji: **udokumentowane**, **prawdopodobne**,
  **możliwe**, **wskazówka**, **obalone**. Podsumowanie `strom stats` pisze nadal „tylko wskazówki”.

<!-- zdroj: research:src/core/model.ts:36 STATUSES · assets/method/core.md:8-12 · src/cli/human.ts:138 statusName · assets/lang/cs.json ui.st.*, ui.stats.facts · src/commands/people.ts:115 wordsFor · src/core/actions.ts:629 notRetracted · app:src/ui/fact-status.ts · strings.ts factStatus · 1.26.0: src/cli/human.ts:139 STATUS, cs.json ui.st.* (commit fe59fb40) -->

<a id="R3.1.1"></a>
### R3.1.1 Stopień domyślny i cytat, który go podnosi

- Dana zapisana bez `--status`: bez cytatu **Wskazówka**; z cytatem co najmniej jednego źródła, które nie jest słabe
  ([R3.3](#R3.3)), **Prawdopodobne**; w przeciwnym razie Wskazówka. Od badania 1.28.0 słaby jest także indeks.
- `strom cite` bez `--status` podnosi Wskazówkę do Prawdopodobne, gdy nowe źródło nie jest słabe. Innego stopnia nie
  zmienia.
- Zmiana stopnia przez `strom event edit --status` wymaga `--reason`; cytat ze stopniem (`strom cite … --status`) nie.
- Pilnuje kod. **Obowiązuje od:** badanie 1.0.0

<!-- zdroj: research:src/core/evidence.ts:49 defaultStatus · src/core/actions.ts:636-650 citeEvent, :903-913 event.needs-reason -->

<a id="R3.2"></a>
## R3.2 Co kod przepuszcza jako Prawdopodobne i Udokumentowane

Stopień nie może twierdzić więcej, niż dają cytaty danej. Kod sprawdza to przy każdym zapisie stopnia: `event add`,
`cite`, `event edit`, a także przy danych, które przychodzą z aplikacji.

- **Granice (pilnuje kod),** w tej kolejności:
  1. Prawdopodobne i Udokumentowane wymagają co najmniej jednego cytatu.
  2. Co najmniej jeden cytat musi pochodzić ze źródła, które nie jest słabe. Słabe jest drzewo genealogiczne
     (`--kind family-tree`), wspomnienie (`--kind family-memory`), dzieło autorskie (`--form authored`) i od badania
     1.28.0 indeks (`--kind index`).
  3. Udokumentowane wymaga ponadto wśród cytatów ze źródeł niesłabych co najmniej jednego z informacją pierwotną
     (`--information primary`): akt spisany w czasie wydarzenia przez kogoś, kto o nim wiedział. Informacja przy
     cytacie ma pierwszeństwo przed informacją przy źródle.
- **Tylko metodyka:** kod nie sprawdza, czy źródło jest oryginalne (`--form original`), czy agent sam je przeczytał,
  czy akt podaje daną wprost, ani ślepego drugiego odczytu ([R3.5](#R3.5)). Udokumentowane przechodzi więc także przy
  odpisie z informacją pierwotną (przy indeksie do badania 1.27.0 również).
- **Obsługa:** terminal: `strom event add P… BIRT --date "…" --cite S… --information primary --status proven`.
  Odrzucenie podaje powód i co zamiast tego (zostawić Wskazówkę, `--status possible` lub `--status probable`).
- **Obowiązuje od:** badanie 1.0.0

<!-- zdroj: research:src/core/evidence.ts:27 isWeak, :32 informationOf, :55-68 checkStatus · src/core/actions.ts:196-209 makeEvent, :648, :906 · src/commands/people.ts:745 · od v1.28.0 evidence.ts isWeak (kind index), checkStatus "… or an index cannot make a fact" -->

<a id="R3.2.1"></a>
### R3.2.1 Źródło: forma i informacja

- `strom source add --form original` (domyślnie) · `derivative` (odpis, indeks; domyślnie dla `--kind index`
  i w księdze, która jest tylko indeksem) · `authored` (dzieło opracowane).
- `--information primary|secondary|unknown` (domyślnie `unknown`) obowiązuje przy źródle; przy cytacie (`event add`,
  `cite`) tylko dla tej danej. Akt, który wymienia rodziców (chrzest wnuka), jest dla nich informacją wtórną
  (metodyka).
- Do GEDCOM jakość cytatu trafia jako QUAY: 3 źródło oryginalne z informacją pierwotną · 2 źródło oryginalne
  w pozostałych przypadkach albo odpis z informacją pierwotną · 1 odpis w pozostałych przypadkach albo dzieło autorskie
  · 0 drzewo genealogiczne i wspomnienie.
- Zmiana formy, informacji, rodzaju lub transkrypcji źródła (`strom source edit`) wymaga `--reason`, uzupełnienie nie.
- Aplikacja: **Wiarygodność** źródła trafia do badania jako **Oryginał** = źródło oryginalne z informacją pierwotną,
  **Odpis / indeks** = źródło oryginalne z informacją wtórną, **Niepewne** = odpis z nieznaną informacją.
- **Obowiązuje od:** badanie 1.0.0; Wiarygodność z aplikacji badanie 1.12.0

<!-- zdroj: research:src/commands/sources.ts:197-198, :221, :837 · src/core/evidence.ts:40 quay · src/core/sync.ts:4660 QUAY_EVIDENCE · assets/method/recording.md:38-46 · app:strings.ts sources.quality1-3, src/ui/sources.ts:76 -->

<a id="R3.3"></a>
## R3.3 Źródło czy wskazówka

Drzewo genealogiczne, wspomnienie, indeks, katalog i drzewo online mówią, gdzie szukać. Nie są dowodem danej. Dana
z nich pozostaje Wskazówką, dopóki nie udokumentuje jej akt.

- **Pilnuje kod:** drzewo genealogiczne, wspomnienie, dzieło autorskie i indeks (`--kind index`) są źródłami słabymi:
  dana tylko z nich nigdy nie jest Prawdopodobne ani Udokumentowane ([R3.2](#R3.2)). Dana, która cytuje tylko indeks,
  pozostaje Wskazówką, dopóki nie odczyta się i nie zacytuje samego wpisu; z cytatem wpisu jest to dana wpisu.
  Przejęte drzewo genealogiczne: [R11.3](R11-material-from-the-user.md#R11.3).
- **Granice:** przy zmianach z aplikacji indeks liczy się jako akt: zmiana danej udokumentowanej indeksem staje się
  sprzecznością ([R5.2](R5-conflicts.md#R5.2)), nic nie nadpisuje się po cichu.
- **Tylko metodyka:** indeks służy tylko do odnalezienia strony; wpis czyta się w księdze metrykalnej. Także
  brakujący wpis w indeksie jest tylko wskazówką: podobna forma nazwiska to kandydat.
- Materiał od użytkownika (dokument, zdjęcie, list, to, co powie):
  [R11.2](R11-material-from-the-user.md#R11.2).
- **Obowiązuje od:** badanie 1.0.0
- **Od badania 1.28.0:** indeksu pilnuje kod jako słabego źródła (wcześniej tylko metodyka: z jego cytatem dana
  dostawała Prawdopodobne, a z `--information primary` przechodziło nawet Udokumentowane).

<!-- zdroj: research:assets/method/core.md:8-12 · locate.md:22-24 · link.md:6-12 · intake.md:9-16 · src/core/evidence.ts isWeak (kind index od v1.28.0), isCompiled (sync) · src/core/sync.ts isCompiled · src/core/import.ts:1-7, :113-117 · src/commands/sources.ts:221 · test/cli/index-weak.test.ts · commit 9685fcbe -->

<a id="R3.4"></a>
## R3.4 Cytat: wycinek i transkrypcja

Cytat mówi, gdzie dokładnie w źródle stoi dana. Źródło to jeden wpis; kilka wpisów jednej strony to kilka źródeł.

- **Tylko metodyka:** każdy wpis ze skanu dostaje `--clip` (wycinek, w którym agent go czytał) i `--transcript`
  (słowa wpisu tak, jak stoją, wiersz po wierszu, nieodczytana litera `[?]`), do tego `--locator` (folio, strona,
  numer wpisu), a przy danej `--quote`. Do pola (`--date`, `--house`, `--age`, imię) trafia tylko to, co odczytano
  pewnie; niepewne trafia do transkrypcji z `[?]` i do notatki danej.
- **Tylko metodyka, od badania 1.28.0:** wpis w innym języku lub piśmie niż język badania (łacina, kurrenta,
  czeski, cyrylica…) dostaje obok dosłownej transkrypcji także tłumaczenie na język badania (`--translation`).
  Transkrypcja pozostaje w języku wpisu. Aplikacja pokazuje tłumaczenie zwinięte pod transkrypcją
  ([A3.1.1](A3-evidence-in-the-app.md#A3.1.1)).
- **Pilnuje kod:** najwyżej 3 wycinki na źródło (wpis i jego ciąg dalszy przez łamanie strony). Brakującego wycinka
  ani transkrypcji kod nie odrzuca, tylko przypomina o nich przy źródle na skanie: po `strom source add`, po
  `strom source edit` ze skanem lub wycinkiem i przy `strom task done` dla źródeł, które zapisało zadanie.
- Starsze źródła: wycinek uzupełnia `strom clips`, transkrypcję `strom transcripts` (czytelnicy, drugie spojrzenie
  je sprawdza).
- **Obsługa:** terminal: `strom source add "…" --clip B…:57@x,y,w,h --transcript @notes/zapis.txt --translation
  @notes/preklad.txt --locator "…"`; uzupełnienie `strom source edit S… --translation "…"`.
  Aplikacja pokazuje wycinek wpisu obok transkrypcji.
- **Obowiązuje od:** badanie 1.1.0 (wycinek, `strom clips`, `strom transcripts`); transkrypcja 1.0.0
- **Od badania 1.26.0:** pomoc opcji `--clip` mówi „kolejny na każde łamanie strony, najwyżej 3” (w 1.25.2 „drugi”).
  Zasada się nie zmienia.

<!-- zdroj: research:assets/method/recording.md:19-27, :55-62 · src/core/media.ts:285 MAX_CLIPS, :481 transcriptNote, :492 clipNote · src/commands/sources.ts:183, :214, :250, :893 · src/commands/tasks.ts:366-369 finishTask · src/commands/clips.ts · src/commands/transcripts.ts · HEAD commit 6bc7430b · překlad: assets/method/recording.md "--translation", link.md krok 7, src/brief/brief.ts (Research language), src/commands/sources.ts:196 translation, src/gedcom/export.ts:557 (oddíl poznámky pramene „Překlad:“), commit a1ccd24e -->

<a id="R3.5"></a>
## R3.5 Ślepy drugi odczyt

Wniosek, który opiera się na jednej trudno czytelnej komórce (numer domu, wiek, imię lub nazwisko rodowe), wymaga
drugiego, niezależnego odczytu. Powyżej Prawdopodobne dana idzie tylko wtedy, gdy dwa niezależne odczyty się zgadzają.

- **Tylko metodyka:** drugi czytelnik nie zna oczekiwanej wartości, imienia, miejsca ani powodu, dla którego ma to
  znaczenie. Jedna komórka, jeden czytelnik. Najpierw `strom readings B… --image N`: dwa odczyty mogą już istnieć.
  Odczyty się różnią: agent patrzy jeszcze raz; rzeczywista różnica to sprzeczność z oboma odczytami (zob.
  [R5](R5-conflicts.md)), nie wybór.
- **Pilnuje kod:** `strom read --blind` mówi czytelnikowi, że czyta na ślepo (przepisać dokładnie, niczego nie
  uzupełniać). Rozkładówkę podaje w dwóch ostrzejszych połówkach; raport czytelnika ma w nagłówku „Blind: yes”. Kod
  **nie sprawdza**, czy Udokumentowana dana ma ślepy odczyt ([R3.2](#R3.2)).
- **Kiedy chce go metodyka:** przed Udokumentowane przy danej na jednej trudnej komórce; w zadaniu weryfikacji
  z przeglądu osoby (dane Prawdopodobne, które cytują źródło ze skanem: zgodność → Udokumentowane, różnica →
  sprzeczność); przy transkrypcji użytkownika ([R3.5.1](#R3.5.1)).
- **Obsługa:** terminal: `strom read M… --blind --crop x,y,w,h --question "…"`; przegląd osoby: menu **Przegląd
  osoby: sprawdzenie i uzupełnienie tego, co o niej wiadomo**, `strom review`.
- **Obowiązuje od:** badanie 1.0.0; zadanie weryfikacji z przeglądu osoby 1.1.0

<!-- zdroj: research:assets/method/verify.md:3-18 · recording.md:62-65 · src/commands/read.ts:192, :206, :334, :506 · src/core/reader.ts:194 readerPrompt · src/core/review.ts:205 singleReadings, :269 · src/core/phrases.ts review.verify.* · cs.json ui.menu.review -->

<a id="R3.5.1"></a>
### R3.5.1 Transkrypcje i odczyty z aplikacji

Transkrypcji, którą użytkownik napisze w aplikacji, badanie nigdy nie uznaje za Udokumentowane i jej nie nadpisuje.
Jak ją uwzględnia, wyznacza ustawienie drzewa w aplikacji.

- **Moje transkrypcje źródeł → Wskazówka** (domyślnie): nowa dana z transkrypcji jest Wskazówką. Badanie proponuje
  zadanie weryfikacji.
- **Moje transkrypcje źródeł → Udokumentowane** albo zaznaczone przy źródle **Transkrypcja zweryfikowana**:
  transkrypcja obowiązuje jako pierwszy odczyt. Dane na niej oparte są Prawdopodobne, nie Udokumentowane. Wybór
  obowiązuje dla źródeł nowych lub zmienionych od następnego wysłania.
- Dokument odczytany przez czytelników badania: jeden czytelnik → Możliwe; dwóch ślepych czytelników zgodnie →
  Prawdopodobne; transkrypcja zmieniona w aplikacji, różne odczyty, niepewny czytelnik lub dana, której odczyt nie
  podaje → Wskazówka.
- **Pilnuje kod:** tych stopni. Z aplikacji nigdy nie powstaje Udokumentowane.
- **Tylko metodyka:** w zadaniu weryfikacji agent odszukuje akt, rejestruje skan i sam czyta go na ślepo. Zgodność →
  notatka przy źródle; różnica → sprzeczność z oboma odczytami.
- **Obowiązuje od:** badanie 1.12.0, aplikacja 3.9.0; odczyt dokumentu przez czytelników badania 1.18.0

<!-- zdroj: research:assets/method/verify.md:19-24 · src/core/sync.ts:220, :824, :3367 readsFor, :3870 reading, :3992 · src/core/readsync.ts:190 readingGrade · cs.json sync.verify.*, read.note.* · app:strings.ts treeSettings.transcripts/guide/evidence/evidenceDesc/notRetroactive, sources.verified -->

<a id="R3.6"></a>
## R3.6 Negatywne wyszukiwanie

Daremne wyszukiwanie to wynik. Każde wyszukiwanie się zapisuje, także bez znaleziska, wraz z tym, co dokładnie
objęło. Najdroższy błąd to przeszukać tę samą księgę dwa razy.

- **Granice (pilnuje kod):**
  - `--result found|negative|partial|inconclusive`; `found` wymaga `--found S…` (źródło zapisuje się najpierw);
  - `negative` kod odrzuca, dopóki w przeszukanym zakresie zostaje miejsce, które czytelnik zgłosił jako niejasne,
    a nikt od tego czasu nie obejrzał go w pełnym rozmiarze, na właściwej stronie rozkładówki. Liczą się odczyty od
    pierwszej sesji zadania (w przeciwnym razie z ostatnich 24 godzin). Wtedy zostaje `--result inconclusive`
    z miejscem w `--note` albo `--result partial` z wyraźnie odczytanymi stronami w `--pages`;
  - daremne wyszukiwanie w indeksie (`--method index`) wypisuje się jako „negative in the index only”;
  - `strom task done` przy zadaniu gdzie są akty, potwierdzenie powiązania, weryfikacja i wzbogacenie osoby
    przypomina, gdy zadanie nie zapisało żadnego wyszukiwania.
- **Tylko metodyka:** wynik negatywny dopiero po obejrzeniu stron w pełnym rozmiarze. Brakujące strony księgi nie są
  przeszukane (`--pages 40-52,55-69`). Po `--until-found` tylko odczytane skany, jako `--result partial`.
- **Obsługa:** terminal: `strom search add "…" --recordset B… --years … --surname … --pages … --method
  index|page-by-page|full-text|catalog|web|request|other --result negative --by main|reader|user --note "…"`.
- **Obowiązuje od:** badanie 1.0.0; odrzucenie przy niejasnym miejscu i „tylko w indeksie” 1.14.0

<!-- zdroj: research:assets/method/core.md:22-25 · reading.md:22-30, :70-84 · src/commands/analysis.ts:208-268 · src/core/model.ts:484-485 · src/commands/readings.ts:347-380 openUnclear, :414 refuseNegativeOverUnclear · src/core/evidence.ts:21 searchedAs · src/commands/tasks.ts:348-351 -->

<a id="R3.7"></a>
## R3.7 Kiedy agent pyta człowieka

Odczyty i stopnie pewności ustala agent sam. Człowieka pyta tylko tam, gdzie bez niego nie da się iść dalej. Pytanie
trafia do **Czeka na decyzję** (zob. [R6](R6-awaiting-action.md)) jako zdanie bezosobowe.

- **Tylko metodyka,** agent pyta (`strom task wait T… --on "…"`): podobna forma nazwiska we właściwym domu lub latach
  (prosi o stronę, zanim ją wykluczy); katalog, którego agent nie otworzy (`--kind web --url`); skany, których
  archiwum nie pozwala pobierać automatycznie (`--images B…:40-69`); strona, która blokuje automatyzację
  (`--check <url>`), tylko gdy inna droga nie prowadziła do celu, a źródło pozostaje konieczne.
- **Pilnuje kod,** tylko człowiek: odpowiedź na czekające zadanie (`strom task wake T… --answer`) i na sprawdzenie
  strony (`--check`) potwierdza człowiek we własnym terminalu lub w oknie; „to nie błąd” przy znalezisku kontroli
  (`strom quality dismiss`).
- **Tylko metodyka:** sprzeczność, którą rozstrzygnął użytkownik, obowiązuje; agent otwiera ją ponownie tylko z powodu
  źródła, którego decyzja nie ważyła (zob. [R5](R5-conflicts.md)). Transkrypcji użytkownika agent nie nadpisuje
  ([R3.5.1](#R3.5.1)).
- **Obowiązuje od:** badanie 1.0.0; odpowiedź tylko przez człowieka najpóźniej 1.14.0; „to nie błąd” 1.22.0

<!-- zdroj: research:assets/method/link.md:6-12 · locate.md:17-27 · reading.md:105-121 · waiting.md:14-17 · core.md:124-130 · recording.md:77-81 · src/commands/tasks.ts:928-946 task.check-person, task.answer · src/commands/quality.ts PERSON · src/cli/main.ts:287-290 requireHuman -->

<a id="R3.8"></a>
## R3.8 Jak udokumentowanie pokazuje aplikacja

Aplikacja używa słowa „udokumentowane” w kilku znaczeniach. Stopień pewności ustala badanie; poziom udokumentowania
osoby aplikacja liczy sama, tylko z cytatów.

| Gdzie w aplikacji | Co pokazuje | Na podstawie czego |
|---|---|---|
| etykieta przy danej, np. **Udokumentowane** | stopień pewności danej | badanie ([R3.1](#R3.1)) |
| **Przegląd drzewa → Jakość danych → Pewność danych z badania** | urodzenia, zgony i śluby według stopnia | badanie |
| strona osoby, **Dla badaczy → Pewność danych** | stopień każdej danej osoby | badanie |
| **Udokumentowane** / **Częściowo udokumentowane** / **Nieudokumentowane** (● ◐ ○) | poziom udokumentowania osoby | cytaty ([R3.8.1](#R3.8.1)) |
| **Dla badaczy**, „Potwierdzone źródłami: {n} z {m} informacji” | dane osoby ze źródłem | cytaty |
| **Przegląd drzewa → Przodkowie**, kolumna **udokumentowani** | przodkowie z udokumentowanym urodzeniem | z badaniem tylko Udokumentowane, w przeciwnym razie cytaty |
| **Gdzie brakuje dowodów → Urodzenia niesprawdzone w badaniu** | urodzenia przodków, które nie są Udokumentowane | badanie |
| książka, **Dane dla badaczy**: ● udokumentowane · ◐ sprzeczność · ○ nieudokumentowane | stan udokumentowania danej | Udokumentowane **albo** jakikolwiek cytat |
| **Moje transkrypcje źródeł → Udokumentowane** | jak badanie traktuje transkrypcje użytkownika | pierwszy odczyt, Prawdopodobne ([R3.5.1](#R3.5.1)) |

- **Granice:** stopnie pewności aplikacja tylko pokazuje, nie można ich zmienić. Sprzeczność przy danej w książce
  przeważa nad ● i ○.
- **Obowiązuje od:** aplikacja 3.5.0 (poziom osoby), 3.9.0 (etykieta, Moje transkrypcje źródeł), 3.13.0 (Pewność
  danych z badania), 3.13.1 (kolumna udokumentowani), 3.18.0 (Dla badaczy), 3.19.0 (książka)

<!-- zdroj: app:src/ui/fact-status.ts · src/tree-overview.ts:224-233 birthDocumented · src/ui/tree-overview.ts:1037, :1960, :1650-1680 · src/person-page.ts:1014-1019 · src/book-blocks.ts:468-484 evidenceMark · strings.ts treeOverview.*, personPage.research.*, book.evidence.*, book.dlg.research(Hint), treeSettings.evidence -->

<a id="R3.8.1"></a>
### R3.8.1 Poziom udokumentowania osoby

- **Nieudokumentowane** (○): osoba, jej wydarzenia ani jej związki nie cytują żadnego źródła.
- **Udokumentowane** (●): cytowane urodzenie (lub chrzest) i, gdy osoba ma zgon (datę, miejsce, wydarzenie zgonu lub
  pochówku), także cytowany zgon (lub pochówek, kremacja).
- **Częściowo udokumentowane** (◐): wszystko pomiędzy, także źródło dołączone tylko do osoby (do imienia, do miejsca
  zamieszkania).
- Stopnia pewności się nie liczy: urodzenie cytujące nawet przejęte drzewo genealogiczne (Wskazówka) daje ●. Aplikacja
  mówi to przy **Pewność danych z badania**: „Nie mylić z udokumentowaniem źródłem.”
- Gdy w drzewie nikt nie cytuje źródła, karta poziomu nie pokazuje. Osoba zastępcza nie ma poziomu.
- **Obsługa:** aplikacja: opcja karty **Udokumentowanie w źródłach**; wyróżnienie **Udokumentowanie** w drzewie;
  **Przegląd drzewa → Jakość danych → Gdzie brakuje dowodów**.
- **Obowiązuje od:** aplikacja 3.5.0

<!-- zdroj: app:src/evidence-level.ts personEvidence, treeHasAnySource · strings.ts treeHealth.evidenceMode/evFull/evPartial/evNone, cardDensity.cardEvidence/cardShowHint, treeOverview.certaintyDesc -->

<a id="R3.9"></a>
## R3.9 Opowieść zachowuje swoje źródła

Opowieść mówi, na których źródłach się opiera. Nowa wersja opowieści nie traci bez powodu niczego z poprzedniej
wersji.

- **Granice:**
  - źródła opowieści to źródła, które cytują jej dane, źródła tła miejsca i czasu oraz źródła, które tekst wymienia
    tylko identyfikatorem;
  - nowa wersja musi zachować każdą daną, źródło i odnośnik poprzedniej wersji albo pominąć je z powodem. W przeciwnym
    razie badanie ją odrzuca i wypisuje, czego by brakowało. Co wersja pominęła i dlaczego, zostaje przy opowieści;
  - opowieść oparta na wskazówce wymienia w tekście nazwę źródła i to, że zapisu jeszcze nikt nie przeczytał. Gdy
    tekst źródła nie wymienia, badanie na to zwraca uwagę;
  - zatwierdzenie opowieści należy do człowieka ([R5.5](R5-conflicts.md#R5.5)).
- **Obsługa:** terminal: `strom story show P…` (każda dana ze źródłami, potem tło), `strom story set P… --fact E…
  --source S… --drop "E… <proč>"`. Plik Stromu: źródła opowieści jako `2 SOUR` pod `_STORY`.
- **Obowiązuje od:** badanie 1.26.0

<!-- zdroj: research:src/core/storykeep.ts StoryVersion, StoryDrop, StorySource, storySources · src/commands/story.ts:104 --drop, :151 told from a lead, :231 story show · assets/method/narrate.md · CHANGELOG.cs.md 1.26.0 -->

<a id="R3.9.1"></a>
### R3.9.1 Co twierdzi opowieść

Opowieść pisze się z danych dla rodziny. Tego, czego nie udokumentowano, się nie dopowiada.

- **Tylko metodyka:**
  - każde twierdzenie opiera się na zapisanej danej; to, co jest wywnioskowane, jest oznaczone jako wywnioskowane;
    czego się nie wie, mówi się wprost;
  - tło miejsca i czasu (wojna, epidemia, pożar, z czego żyła wieś) tylko ze źródła zapisanego w badaniu i tylko jako
    tło, nigdy jako przyczyna tego, co osoba zrobiła, o ile nie mówi tego akt;
  - opowieść pary opowiada wspólne życie: ślub, gospodarstwo domowe, domy, dzieci, owdowienie. Życie każdego z nich
    przed nim i po nim należy do jego własnej opowieści i wspomina się je jednym zdaniem;
  - dawny zawód i pojęcie, którego czytelnik nie rozumie, się objaśnia; pisze się w języku badania;
  - format tekstu: tylko akapity, śródtytuły, wypunktowania, pogrubienie i kursywa. Pozostałe (linki, tabele, cytaty,
    listy numerowane) aplikacja zgodnie z metodyką pokaże jako zwykły tekst.
- **Dlaczego:**
  - nic się nie dopowiada: opowieść jest dla rodziny i opiera się na dowodach. To, co brzmiałoby prawdopodobnie, ale
    nie jest udokumentowane, zaczęłoby w rodzinie uchodzić za fakt;
  - tło: jest udokumentowane dla miejsca, nie dla człowieka; jako przyczyna tego, co osoba zrobiła, byłoby domysłem
    podawanym za fakt. Opowieść wymienia źródło tła (`--source`), żeby dało się je sprawdzić;
  - opowieść pary: wspólne życie opowiada się raz, przy parze, żeby tego samego życia nie opowiadać dwa razy i żeby
    wersje się nie rozchodziły;
  - format: aplikacja Strom pokaże tylko akapity, śródtytuły, wypunktowania, pogrubienie i kursywę; resztę czytelnik
    widziałby jako zwykły tekst ze znakami.
- Zatwierdzenie i nowa wersja zatwierdzonej opowieści: [R6.3.2](R6-awaiting-action.md#R6.3.2).
- **Obsługa:** terminal: `strom story set P… --text @notes/… --fact E… --source S… --note "co je odvozené"`
  (opowieść pary przy rodzinie F…).
- **Obowiązuje od:** badanie 1.0.0; tło miejsca i czasu 1.10.0; format tekstu 1.8.0; opowieść pary 1.23.0

<!-- zdroj: research:assets/method/narrate.md (celé; formát od v1.8.0, pozadí od v1.10.0, pár od v1.23.0) · research:src/commands/story.ts --note -->
