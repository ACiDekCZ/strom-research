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
- **Od badania 1.30.0:** `strom event show` i `strom event edit` wypisują daną człowiekowi w języku badania
  (na przykład „[wskazówka]”); agent nadal dostaje wypis po angielsku.
- **Od badania 1.36.0:** stopień ma także imię i nazwisko osoby, poza **Obalone** (`strom cite P… S… --status`,
  [R10.5.2](R10-people-and-hypotheses.md#R10.5.2)).

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
  3. Udokumentowane wymaga ponadto cytatu samego aktu oryginalnego (od badania 1.29.0, zob. niżej).
  4. Wśród cytatów aktu oryginalnego co najmniej jeden musi mieć informację pierwotną (`--information primary`): akt
     spisany w czasie wydarzenia przez kogoś, kto o nim wiedział. Informacja przy cytacie ma pierwszeństwo przed
     informacją przy źródle.
- **Tylko metodyka:** kod nie sprawdza, czy agent sam przeczytał akt, czy akt podaje daną wprost, ani ślepego drugiego
  odczytu ([R3.5](#R3.5)).
- **Obsługa:** terminal: `strom event add P… BIRT --date "…" --cite S… --information primary --status proven`.
  Odrzucenie podaje powód i co zamiast tego (zostawić Wskazówkę, `--status possible` lub `--status probable`).
- **Obowiązuje od:** badanie 1.0.0
- **Od badania 1.29.0:** akt oryginalny to źródło w formie oryginału (`--form original`), które jest aktem (nie
  słabe źródło, więc też nie indeks) i nie jest wycofane. Źródło, które przyszło z aplikacji Strom, liczy się tylko
  wtedy, gdy powstało z odczytu dokumentu przez czytelników badania, który użytkownik w aplikacji wysłał do drzewa
  (**Zaproponuj do drzewa…**, [R8.8](R8-reading-scans.md#R8.8)); sama wiarygodność **Oryginał** z aplikacji
  ([R3.2.1](#R3.2.1)) aktu oryginalnego nie tworzy. Odpis, indeks, cudza transkrypcja ani słowo aplikacji o źródle
  dają najwyżej Prawdopodobne; odrzucenie ma kod `status.original`. Do badania 1.28.0 Udokumentowane przechodziło
  przy każdym niesłabym źródle z informacją pierwotną, także przy odpisie; takie dane starszych badań raz wyrówna
  poprawka [R3.2.2](#R3.2.2).

<!-- zdroj: research:src/core/evidence.ts:27 isWeak, :32 informationOf, :55-68 checkStatus · src/core/actions.ts:196-209 makeEvent, :648, :906 · src/commands/people.ts:745 · od v1.28.0 evidence.ts isWeak (kind index), checkStatus "… or an index cannot make a fact" · 1.29.0: research:v1.35.0 src/core/evidence.ts isOriginalHere, provesIt, checkStatus (code status.original) · src/core/model.ts Source.reading · CHANGELOG.cs.md 1.29.0 -->

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
- **Od aplikacji 3.27.0:** aplikacja trzyma wiarygodność także przy każdym cytacie i zapisuje ją w pliku dla badania
  jako `QUAY` tego cytatu ([A2.6.1](A2-loading-a-family-tree.md#A2.6.1)). Badanie bierze z niej tylko formę
  i informację nowego źródła (domyślną wiarygodność źródła, w przeciwnym razie `QUAY` jego pierwszego cytatu); `QUAY`
  cytatu, który badanie zapisało samo, nie zmienia się po drodze przez aplikację.

<!-- zdroj: research:src/commands/sources.ts:197-198, :221, :837 · src/core/evidence.ts:40 quay · src/core/sync.ts:4660 QUAY_EVIDENCE · assets/method/recording.md:38-46 · app:strings.ts sources.quality1-3, src/ui/sources.ts:76 · 3.27.0: research:ff760309 src/core/sync.ts:1095 (zdroj aplikace a.quality), :963 citedDetails (s.quay z první citace), :4361 QUAY_EVIDENCE · app:5721b016 export QUAY citace · dirigent:test/vysledek-1111-app-spolehlivost-citace.md (round trip QUAY 2/3, sync --dry-run nic nového) -->

<a id="R3.2.2"></a>
### R3.2.2 Udokumentowane bez aktu oryginalnego w starszych badaniach

Badanie założone przed wersją 1.29.0 może mieć dane Udokumentowane bez cytatu aktu oryginalnego ([R3.2](#R3.2)). Raz
wyrówna je poprawka według reguł; nic nie kosztuje i można ją cofnąć.

- **Pilnuje kod:**
  - poprawka przebiega sama raz, przy pierwszym uruchomieniu nowej wersji po kopii zapasowej badania;
  - dana bez cytatu aktu oryginalnego, którą jako Udokumentowane zapisał agent albo zapis zbiorczy (import,
    przekształcenie starego badania, partia), dostaje Prawdopodobne; Możliwe, gdy nie wspiera jej żadne źródło, które
    nie jest słabe. Powód stoi w historii danej;
  - dana, którą jako Udokumentowane zapisał człowiek, zostaje bez zmian i czeka na jego ocenę: w Co czeka jako jedna
    pozycja z liczbą w grupie **Pewność do sprawdzenia** („N danych udokumentowanych przez użytkownika bez oryginału
    zapisu: zostawić udokumentowane czy zmienić na prawdopodobne?“). Dana, którą człowiek po ocenie zostawił, nie
    jest proponowana ponownie;
  - decyduje tylko człowiek w swoim terminalu, nigdy agent;
  - dana z cytatem aktu oryginalnego zostaje.
- **Obsługa:** terminal: Co czeka → **Zostawić udokumentowane** / **Zmienić na prawdopodobne**;
  `strom fixes review proven-originals keep|lower [E…]` (bez numerów danych wszystkie czekające), `strom fixes show
  proven-originals`, `strom fixes undo proven-originals`.
- **Obowiązuje od:** badanie 1.29.0

<!-- zdroj: research:v1.35.0 src/core/provenfix.ts (PROVEN_SINCE 1.29.0, PROVEN_SETTLED, PROVEN_FIX_FILE quality/proven.json, provenFixes: by user a ne bulkWrites → left, jinak probable/possible podle isWeak) · src/commands/fixchecks.ts PROVEN_ORIGINALS (paid false, "Applied by itself once, at the first start of this strom after its backup") · src/commands/fixes.ts review proven-originals keep|lower · assets/lang/cs.json wait.group.proven, ui.waiting.proven, ui.wait.proven.keep/lower, ui.fixes.proven-originals.* · CHANGELOG.cs.md 1.29.0 -->

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
- **Od badania 1.31.0:** miejsce wpisu w księdze zapisuje się w polach `--folio`, `--image`, `--call-number`;
  `--locator` trzyma resztę ([R3.4.3](#R3.4.3)).

<!-- zdroj: research:assets/method/recording.md:19-27, :55-62 · src/core/media.ts:285 MAX_CLIPS, :481 transcriptNote, :492 clipNote · src/commands/sources.ts:183, :214, :250, :893 · src/commands/tasks.ts:366-369 finishTask · src/commands/clips.ts · src/commands/transcripts.ts · HEAD commit 6bc7430b · překlad: assets/method/recording.md "--translation", link.md krok 7, src/brief/brief.ts (Research language), src/commands/sources.ts:196 translation, src/gedcom/export.ts:557 (oddíl poznámky pramene „Překlad:“), commit a1ccd24e -->

<a id="R3.4.1"></a>
### R3.4.1 Transkrypcję człowieka zmienia tylko człowiek

Transkrypcji, którą człowiek napisał lub potwierdził, nie zmieni nikt poza człowiekiem. Inne brzmienie od agenta
człowiek dostaje tylko jako propozycję. Odczyt przez model AI jest propozycją; pewność daje sprawdzenie przez
człowieka.

- **Pilnuje kod:**
  - transkrypcja człowieka to transkrypcja napisana ręcznie w jego terminalu albo z aplikacji z zaznaczonym
    **Transkrypcja zweryfikowana** lub z ustawieniem **Moje transkrypcje źródeł → Udokumentowane**
    ([R3.5.1](#R3.5.1)). To, co pod kontem człowieka zapisały importy, konwersje i partie, transkrypcją człowieka nie
    jest;
  - takiej transkrypcji nie zmieni żadne polecenie agenta: edycja, partia, synchronizacja, poprawka, cofnięcie, import
    ani konwersja. Jako człowiek może zapisywać tylko jego terminal i most aplikacji Strom;
  - inne brzmienie od agenta (`strom source edit S… --transcript …`) zostaje zamiast tego zaproponowane: notatka przy
    źródle i jedno zadanie dla człowieka na źródło. Czeka w **Co czeka**, grupa **Do rozstrzygnięcia – transkrypcje**.
    Żadna kolejka go nie oferuje; agent go nie weźmie, nie zamknie, nie odłoży ani nie uruchomi;
  - decyduje tylko człowiek:
    - **Przyjmij propozycję**: transkrypcją staje się proponowane brzmienie, a potwierdzenie człowieka przechodzi na
      nie;
    - **Zostaw dotychczasową**: transkrypcja zostaje; proponowane brzmienie jest odrzucone i nie zostanie
      zaproponowane ponownie, ani jego miejsca;
    - **Cofnij** (po jednym i drugim): transkrypcja i potwierdzenie jak wcześniej, a propozycja znów czeka. Cofnięcie
      zostanie odrzucone, gdy transkrypcja w międzyczasie się zmieniła albo czeka inna propozycja.
- **Transkrypcja, której człowiek nie potwierdził:** agent zmienia ją tylko w zadaniu i tylko tam, gdzie pokazuje to
  sam akt na skanie, z powodem. Nowy odczyt ([R8.8.2](R8-reading-scans.md#R8.8.2)) jest tylko podpowiedzią: gdzie nie
  da się tego rozstrzygnąć na skanie, agent zapisuje notatkę przy źródle, a transkrypcja zostaje.
- **Tylko metodyka:** zadanie z nowego odczytu agent zamyka, oglądając sam akt na skanie obok obu odczytów.
- **Obsługa:** aplikacja: podgląd źródła, blok **Propozycja agenta do transkrypcji** (**Cały tekst obok siebie**,
  **Przyjmij propozycję**, **Zostaw dotychczasową**, **Cofnij**); przy transkrypcji potwierdzonej przez człowieka po
  nowym odczycie **Odłóż do oceny** ([R8.8.3](R8-reading-scans.md#R8.8.3)). Terminal: **Co czeka** → **Proponowane
  brzmienie** / **Transkrypcja bez zmian**; `strom source proposal S… --take proposal|keep|undo`.
- **Dlaczego:** transkrypcja człowieka to jego własny odczyt aktu. Zasada projektu: nic potwierdzonego przez człowieka
  nie zostaje nadpisane; nowy wynik, który się różni, jest zadaniem albo propozycją do rozstrzygnięcia.
- **Obowiązuje od:** badanie 1.29.0, aplikacja 3.25.0

<!-- zdroj: research:c2a690ea strom help source proposal (--take proposal|keep|undo, --task, --proposed) · src/core/waiting.ts:375-390 (kind transcript, group transcripts, choices proposal/keep, ne TERMINAL_ONLY) · src/core/sync.ts:3862 (app read = evidence || verified) · assets/lang/cs.json proposal.*, ui.proposal.*, wait.group.transcripts, read.source.why, read.source.done · CHANGELOG.cs.md 1.29.0 („Přepis, který uživatel přečetl nebo potvrdil, je uživatelův“) · commity 284605bf, 8803cd70 · dirigent:prace/1107-vyzkum-drobnosti-ukoly/karta.md Výsledek (Popis chování 4, 5) · app:6bd8609e strings.ts read.pTitle, pWhole, pAccept, pKeep, pUndo, pAccepted2, pKept2, pNote, tReview · src/ui/read-source-state-view.ts proposalHtml · spec 065 K2.3, spec 059 K3.2 -->

<a id="R3.4.2"></a>
### R3.4.2 Nakładające się wycinki są jednym

Dwa wycinki tego samego obrazu, które mocno się nakładają, to jeden wpis wycięty dwa razy. Badanie łączy je w jeden.

- **Pilnuje kod:**
  - dwa wycinki tego samego obrazu, które nakładają się co najmniej w 30 % mniejszego z nich, łączą się
    w prostokąt obejmujący oba, w miejscu pierwszego. Wielokrotnie: trzy wycinki w rzędzie to jeden;
  - wycinek, który leży co najmniej w 90 % wewnątrz większego (szczegół imienia lub daty, wpis obok całej strony),
    zostaje. Dwa prawie jednakowe prostokąty (każdy co najmniej w 90 % w drugim) się łączą;
  - wycinki oddzielne, tylko się stykające lub na innych obrazach zostają;
  - łączy się tylko to, co zapisało badanie (agent, sesja, partia agenta, `strom clips`); agent dostaje informację, co
    się połączyło. Wycinek od człowieka (terminal, aplikacja) nigdy się nie zmienia;
  - starsze badanie łączy się raz, przy pierwszym starcie nowej wersji albo starcie mostu: tylko wycinki, które według
    historii zapisał agent lub sesja, jedna zapisana operacja na źródło. Transkrypcja i potwierdzenie człowieka
    zostają.
- **Dlaczego:** czytelnik jednym wycinkiem utnie dolne wiersze, drugim prawą część, a aplikacja pokazuje potem dwa
  prawie jednakowe wycinki tego samego wpisu.
- **Obsługa:** nic: łączy się samo przy zapisie wycinka (`strom source add|edit --clip` przez agenta, `strom clips`).
- **Obowiązuje od:** badanie 1.29.0

<!-- zdroj: research:c2a690ea src/core/clipmerge.ts (hlavička, CLIP_OVERLAP = 0.3, CLIP_NESTED = 0.9, cutTwice, mergeOverlappingClips, handClipped, agentClipped, settleClips, CLIPS_SETTLED) · commity 599f9681, 326bae02 · CHANGELOG.cs.md 1.29.0 · dirigent:prace/1107-vyzkum-drobnosti-ukoly/karta.md Výsledek (Popis chování 6) -->

<a id="R3.4.3"></a>
### R3.4.3 Gdzie stoi wpis: folio, skan, sygnatura

Gdzie wpis stoi w księdze, badanie trzyma w polach, aby odnaleźć wpis ponownie także wtedy, gdy link do skanu
przestanie się otwierać.

- **Pola źródła:** `--folio` (strona albo folio, tak jak numeruje je księga, także ze słowem: „pag. 112”, „fol. 12v”),
  `--image` (numer skanu na portalu archiwum), `--call-number` (sygnatura księgi przy wpisie spoza zarejestrowanych
  ksiąg badania), a obok nich `--locator` na resztę (numer wpisu, kolumna).
- **Tylko metodyka:** agent wypełnia pola przy zapisie. Folio zawsze, skan tylko przy wpisie bez zarejestrowanego skanu
  (wtedy numer skanu daje wycinek), sygnaturę tylko poza zarejestrowaną księgą. Link, który już nie otwiera wpisu,
  agent odszukuje po archiwum, sygnaturze, folio i skanie z `strom source show` (numer skanu może się przesunąć o kilka,
  folio nie), tylko przez strom, i poprawia go `strom source edit S… --url … [--image …] --reason "…"`.
- **Pilnuje kod:**
  - `strom source show` ma wiersz `find` z archiwum, sygnaturą, folio i skanem razem (skan także z zarejestrowanych
    skanów). Przy starszym źródle, którego lokalizacja wymienia folio albo skan, proponuje „from its locator: --folio …
    --image … --locator …”; sam niczego nie zapisuje;
  - uzupełnienie pustego pola nie potrzebuje powodu, zmiana wypełnionego pola tak (`--reason`). `--locator ""`
    (z powodem) opróżnia lokalizację, gdy nie zostało w niej nic poza folio i skanem z pól; `source show` wtedy to
    proponuje;
  - GEDCOM: jedna czytelna `PAGE` złożona z pól („pag. 112, nr 3, skan 57”, w języku badania) dla aplikacji Strom
    i innych programów, sygnatura jako `CALN`. Same pola (`_STROM_FOLIO`, `_STROM_IMAGE`, `_STROM_LOCATOR`) dostaje
    tylko aplikacja Strom, która je czyta. Źródło bez tych pól eksportuje się dokładnie jak dotąd;
  - `PAGE` nigdy nie poda dwóch numerów skanu ani folio. Gdy lokalizacja wymienia inny numer niż pole, w `PAGE`
    obowiązuje pole, sama lokalizacja zostaje, a `source add|edit|show` ostrzega i proponuje resztę lokalizacji
    (`--locator "<reszta>"`).
- **Granice:** rozpoznanie folio i skanu to kod drzewa, bez agenta, takie samo jak w aplikacji
  ([A3.9](A3-evidence-in-the-app.md#A3.9)). Dwa folia albo dwa skany w jednej lokalizacji nie zostaną rozpoznane.
  Istniejące źródła zostają, jakie są, dopóki człowiek ich nie podzieli ([R3.4.4](#R3.4.4)). Zmiany pól z aplikacji
  i ich usunięcie: [S2.2.2](S2-edits-from-the-app.md#S2.2.2).
- **Obsługa:** terminal: `strom source add "…" --folio "pag. 112" --image 57 --locator "nr 3"`, `strom source edit S…
  --folio … --image … --call-number … [--reason "…"]`, `strom source show S…`; `strom source list <tekst>` szuka
  także w folio i skanie.
- **Obowiązuje od:** badanie 1.31.0
- **Od badania 1.36.0:** numer skanu, który dają tylko zarejestrowane skany, ma w pliku dla aplikacji Strom pod
  `_STROM_IMAGE` znacznik `2 _STROM_DERIVED Y`. Aplikacja dodaje go wtedy do lokalizacji i nie wycina z niej numeru
  innego skanu ([A2.6](A2-loading-a-family-tree.md#A2.6)).

<!-- zdroj: research:4de28f00 src/core/model.ts Source.folio/image/callNumber, src/core/sourcefields.ts recognizeLocation, composedPage, sourceImage, sourceCallNumber, locatorOverlap · src/commands/sources.ts:117-145 (--reason jen při přepsání), :210 --call-number, :287 filtr list, :330-336 řádky find a „from its locator“, :374 locatorArg · src/gedcom/export.ts:239, :374-379, :723-728 PAGE/CALN/_STROM_* · a0751973 (N1: PAGE bez dvou čísel) · 320a7738 (--locator "") · assets/method/recording.md:25-31, reading.md:85-89 · CHANGELOG.cs.md 1.31.0 „Zápis se najde znovu“ · spec 075 P2 · 1.36.0: research:519951b3 src/gedcom/export.ts (image.derived → 2 _STROM_DERIVED Y), src/core/sourcefields.ts sourceImage derived, src/gedcom/validate.ts · app:2e68d373 src/source-location.ts composePage · CHANGELOG.cs.md 1.36.0 -->

<a id="R3.4.4"></a>
### R3.4.4 Podział starszych lokalizacji: podgląd, zapisuje człowiek

Starsze źródła mają lokalizację jednym tekstem („fol. 12, skan 3”). Polecenie `strom source split` dzieli je na pola
naraz: kod, bez agenta i bez kosztów.

- **Pilnuje kod:**
  - bez przełącznika to tylko **podgląd**: ile źródeł by się podzieliło, pierwsze 10 „przed → po” (`--all` wszystkie),
    ilu nie rozpoznano, z najwyżej trzema przykładami tak, jak są zapisane. Nic się nie zapisuje. Podgląd może uruchomić także agent;
  - `--apply` zapisuje podział jednym krokiem i wypisuje `undo: strom source split --undo <id>`; `--undo <id>`
    przywraca wszystkie źródła, jakie były. Jedno i drugie tylko człowiek w swoim terminalu, agentowi strom tego
    odmawia;
  - wypełnione folio albo skan zostaje. Skanu, który dają zarejestrowane skany, się nie bierze. Część, którą pole podaje
    inaczej, zostaje w lokalizacji. Lokalizacja, w której nic nie zostanie rozpoznane, zostaje, jaka jest. Źródło, które ma już
    folio lub skan, nie liczy się do nierozpoznanych: reszta jego lokalizacji nie jest niczym do podziału;
  - cofnąć można ostatnie 5 podziałów, każdy jego id. Źródło zmienione po podziale odrzuca cofnięcie w całości.
- **Tylko metodyka:** agent proponuje podział człowiekowi, nigdy nie potwierdza go sam.
- **Z aplikacji Strom:** badanie oferuje ten sam podział także aplikacji, gdy działa: podgląd z liczbą, podział na
  kliknięcie człowieka jednym krokiem według tego podglądu, cofnięcie w całości
  ([A3.9.1](A3-evidence-in-the-app.md#A3.9.1)). Źródła zmienione w międzyczasie podgląd odrzuca i pokazuje ponownie.
  W Archiwum Strom podziału nie ma.
- **Obsługa:** terminal: `strom source split`, `strom source split --all`, `strom source split --apply`, `strom source
  split --undo <id>` (podgląd wypisuje id do cofnięcia).
- **Obowiązuje od:** badanie 1.31.0

<!-- zdroj: research:c6260e50 src/commands/sourcesplit.ts (SHOWN 10, PERSON, agentMay jen bez --apply a --undo), src/core/sourcesplit.ts splitOf, UNDO_KEPT 5, SOURCE_SPLIT_FILE quality/source-split.json, undoSplit (po změně odmítne celé) · c4fe4fac most GET/POST <token>/sources/split, /sources/split/undo, feature sources.split, 409 plan/changed/archive, 503 busy · assets/method/recording.md:30-31 · CHANGELOG.cs.md 1.31.0 · spec 075 K4.1, K4.3 · příklady nerozpoznaných a nic u zbytku vedle pole: research:ff760309 src/core/sourcesplit.ts splitPlan (unrecognizedExamples, EXAMPLES 3, nothing), src/commands/sourcesplit.ts:67 -->

<a id="R3.4.5"></a>
### R3.4.5 Kolejność cytatów faktu i cytat główny

Cytaty danej badanie porządkuje tak samo jak aplikacja ([A3.2.2](A3-evidence-in-the-app.md#A3.2.2)): pierwszy jest
cytat główny, który wybrał użytkownik, potem pierwotny zapis wydarzenia, potem pozostałe według wiarygodności.
Zapisana kolejność się nie zmienia; kolejność obowiązuje w każdym pliku GEDCOM (dla aplikacji Strom, `/tree.ged`,
plik dla innych programów), w briefie agenta i w wypisach `strom … show`.

- **Pilnuje kod:**
  - kolejność: 1. cytat główny; 2. pierwotny zapis wydarzenia: wpis tego rodzaju wydarzenia (chrzest lub urodzenie
    przy urodzeniu i chrzcie, zgon lub pogrzeb przy zgonie, pogrzebie i kremacji, ślub przy ślubie, zapowiedziach
    i zaręczynach, spis przy spisie), źródło oryginalne z informacją pierwotną (`QUAY` 3) albo źródło oryginalne,
    którego informacji nikt nie ocenił (`QUAY` 2 tylko z braku słowa, [R3.2.1](#R3.2.1)), spisane najwyżej
    12 miesięcy od danej; wcześniej spisane pierwsze, bez daty spisania za tymi z datą; brakująca lub nieczytelna
    data nie rozstrzyga; 3. pozostałe `QUAY` 3; 4. pozostałe według `QUAY` malejąco; 5. liczbowa część numeru źródła
    (bez numeru za numerowanymi), potem kolejność dodania;
  - cytat wpisu innego wydarzenia, który nie ma własnej informacji, ma w kolejności i w eksporcie `QUAY` informacji
    wtórnej (wpis pogrzebu przy urodzeniu). Stopień pewności danej się przez to nie zmienia;
  - imiona i nazwiska oraz cytaty osoby i rodziny (`1 SOUR`) porządkuje się bez kroku 2;
  - jakie wydarzenia źródło zapisuje, eksport podaje jako `1 DATA` › `2 EVEN` przy źródle: zawsze w pliku dla innych
    programów, aplikacji Strom tylko tej, która to czyta;
  - `strom event main <E> <S>` oznacza cytat źródła S jako główny, `--locator "<gdzie>"` wybiera jeden z kilku
    cytatów tego samego źródła, `--clear` usuwa cytat główny (obowiązuje kolejność badania). Wypis: „wybrano główny
    zapis danej: …”, „dana bez głównego zapisu (kolejność badań): …”, „nie ma czego zmieniać: …”;
  - cytat główny wybiera tylko człowiek, w aplikacji Strom ([S2.3.1](S2-edits-from-the-app.md#S2.3.1)) albo w swoim
    terminalu. Agentowi `strom event main` odmawia (`main.person`) z radą, by powiedział to użytkownikowi. Nowy cytat
    agenta porządkuje się za głównym, nigdy go nie zastąpi;
  - `strom person show`, `strom family show` i `strom event show` wypisują cytaty w tej kolejności, główny
    z „(główne, wybór użytkownika)”; `--json` ma `citationOrder`.
- **Granice:** ogólnego cofnięcia cytatu głównego z terminala nie ma: usuwa się go `--clear` albo ustawia się
  ponownie poprzedni.
- **Obsługa:** terminal: `strom event main E0001 S0001`, `strom event main E0001 S0001 --locator "fol. 12"`,
  `strom event main E0001 --clear`, `strom event show E0001`.
- **Obowiązuje od:** badanie 1.34.0

<!-- zdroj: research:355df0a5 src/core/citeorder.ts (pořadí K1.1, SOURCE_EVENTS, FACT_RECORDS, monthsApart, quayAt, mainCitation), src/gedcom/export.ts (1 DATA / 2 EVEN, _STROM_MAIN) · ce8dc753 src/commands/people.ts ["event","main"] (personWrites, code main.person, a source or --clear, which source?, --locator not with --clear), core chooseMainCitation · src/core/actions.ts citeEvent (main nikdy) · assets/lang/cs.json ui.event.main, ui.event.main.off, ui.event.main.same, ui.show.main · ZADANI_VYZKUM_hlavni-citace.md Odpověď V1–V3 · dirigent:prace/1115-vyzkum-095-cli-drobnosti (U6: undo není) · spec 095 K1.1, K2.3 -->

<a id="R3.4.6"></a>
### R3.4.6 Cytat usunięty przez użytkownika

Cytat, który użytkownik usunął z danej ([A3.2.3](A3-evidence-in-the-app.md#A3.2.3),
[S2.3.1](S2-edits-from-the-app.md#S2.3.1)), badanie pamięta przy danej: źródło, miejsce w nim i kiedy. Agent sam go
tam nie przywróci.

- **Pilnuje kod:**
  - `strom cite` odmawia agentowi takiego źródła przy tej samej danej (`cite.removedByUser`: „the user removed S…
    from E… (data): it is not cited there again on its own”) z radą, by cytować tylko z nowym powodem, dlaczego wpis
    należy do danej: `strom cite E… S… --reason "<dlaczego>"`. Z powodem cytat się zapisuje, a usunięcie zostaje
    zamknięte;
  - człowiek w swoim terminalu może cytować zawsze; tym zamyka usunięcie. To samo robi aplikacja Strom, która cytat
    ponownie doda;
  - według miejsca: usunięcie bez miejsca blokuje każde miejsce źródła; usunięcie jednego miejsca blokuje to miejsce
    i cytat bez miejsca. Inne miejsce tego samego źródła można cytować (jedna księga często ma chrzest i pogrzeb tej
    samej osoby);
  - `strom … show` wypisuje przy danej „(usunięte przez użytkownika: S…)”, brief agenta tak samo.
- **Granice:** wskazówki metodyki o usuniętych cytatach nic nie mówią; pilnuje ich tylko kod.
- **Obsługa:** terminal: `strom cite E0001 S0001 --reason "…"`, `strom event show E0001`.
- **Obowiązuje od:** badanie 1.34.0

<!-- zdroj: research:355df0a5 src/core/citeorder.ts removedByUser (locator), refuseRemoved (cite.removedByUser), clearRemoved · src/core/actions.ts:690 citeEvent (personWrites, --reason) · src/core/model.ts Event.uncited · src/core/sync.ts:5268 (aplikace cituje znovu) · src/brief/brief.ts:169 · assets/lang/cs.json ui.show.uncited · 4cd81f14 (vrácení: značka odebrání patří svému poslání) · spec 095 K3.2, K3.3 -->

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

<a id="R3.5.2"></a>
### R3.5.2 Kiedy źródło przeczytał użytkownik

Przy każdym źródle badanie przechowuje, kto je przeczytał: badanie (model sesji, czytelnicy dokumentu), użytkownik
albo obaj. Czytelnikiem jest użytkownik tylko z rzeczywistego odczytu. Źródła, które użytkownik przeczytał, badanie
nie proponuje do ponownego odczytu.

- **Pilnuje kod:** odczytem użytkownika jest tylko:
  - transkrypcja, którą użytkownik napisał w aplikacji albo przy której zaznaczył **Transkrypcja zweryfikowana**
    ([R3.5.1](#R3.5.1));
  - odczyt dokumentu, który użytkownik w aplikacji wysłał do drzewa ([R8.8](R8-reading-scans.md#R8.8));
  - transkrypcja badania, którą użytkownik potwierdził w aplikacji (**Potwierdź transkrypcję**,
    [A3.1.3](A3-evidence-in-the-app.md#A3.1.3));
  - transkrypcja, którą człowiek wpisał ręcznie w swoim terminalu.
- **Granice:**
  - import, przekształcenie starego badania, partia, skrypt ani agent, którego strom nie rozpozna, nie uczynią
    użytkownika czytelnikiem, nawet gdy zapisują w imieniu użytkownika. GEDCOM z innego programu (`strom import`)
    daje dane jako Wskazówkę;
  - potwierdzenie obowiązuje dla brzmienia transkrypcji, które użytkownik widział. Gdy badanie potem transkrypcję
    zmieni, potwierdzenie przestaje się liczyć (zostaje w historii) i można potwierdzić nowe brzmienie;
  - samo potwierdzenie nie zmienia stopnia żadnej danej. Jeśli źródło jest aktem oryginalnym z informacją
    pierwotną, dana na nim może być Udokumentowane ([R3.2](#R3.2)); inaczej najwyżej Prawdopodobne;
  - potwierdzić i cofnąć można tylko z aplikacji, przez człowieka; agentowi nie wolno. Potwierdzić nie można
    w Archiwum Strom, przy źródle scalonym lub wycofanym, bez transkrypcji ani przy transkrypcji, której badanie nie
    czytało albo którą użytkownik już przeczytał.
- **Poprawka starszych badań:** do badania 1.28.0 za odczyt użytkownika liczył się każdy zapis w imieniu
  użytkownika. Raz, przy pierwszym uruchomieniu nowej wersji po kopii zapasowej: źródło, które zapisał tylko przebieg
  zbiorczy (import, przekształcenie, partia), traci odczyt użytkownika; źródło, które człowiek zapisał ręcznie, go
  zachowa. Nic nie kosztuje; `strom fixes undo readers` odczyt przywróci.
- **Obsługa:** aplikacja: **Potwierdź transkrypcję** / **Cofnij potwierdzenie** pod transkrypcją źródła
  ([A3.1.3](A3-evidence-in-the-app.md#A3.1.3)); terminal: `strom fixes show readers`, `strom fixes undo readers`.
- **Obowiązuje od:** badanie 1.29.0, aplikacja 3.25.0

<!-- zdroj: research:v1.35.0 src/core/readers.ts (komentář: čtení uživatele jen app.read, Source.reading, POST /sources/confirm, read.user z terminálu; userReading jen pro aktuální transcriptMark) · src/core/readerfix.ts (READERS_SINCE 1.29.0, bulkWrites, how "earlier", undo) · src/commands/fixchecks.ts READERS (paid false) · src/core/confirm.ts confirmCheck (confirm.archive/none/merged/retracted/reader/changed), shrnutí „original … primary may make a fact proven; of anything else at most probable“ · src/commands/sources.ts source confirm (STROM_FOR_APP, ne agent: confirm.app) · src/core/import.ts (status lead) · CHANGELOG.cs.md 1.29.0 · app:v3.30.0 src/source-confirm.ts · CHANGELOG 3.25.0 -->

<a id="R3.6"></a>
## R3.6 Negatywne wyszukiwanie

Daremne wyszukiwanie to wynik. Każde wyszukiwanie się zapisuje, także bez znaleziska, wraz z tym, co dokładnie
objęło. Najdroższy błąd to przeszukać tę samą księgę dwa razy.

- **Granice (pilnuje kod):**
  - `--result found|negative|partial|inconclusive`; `found` wymaga `--found S…`: źródło zapisuje się najpierw
    (`strom source add`). Bez `--found` kod odrzuca wyszukiwanie i podaje tę kolejność z dokładnym następnym
    poleceniem (od badania 1.33.0);
  - źródło dołączone do wyszukiwania omyłkowo usuwa `strom search edit Q… --drop-found S… --reason "…"` (także kilka
    źródeł), `--no-found` usuwa wszystkie. Wyszukiwanie `found`, któremu nie zostanie żadne źródło, musi powiedzieć,
    czym jest teraz (`--result negative|partial|inconclusive`), w przeciwnym razie zmiana zostaje odrzucona (od
    badania 1.33.0);
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
  index|page-by-page|full-text|catalog|web|request|other --result negative --by main|reader|user --note "…"`
  (`--by agent` to to samo co `main`); poprawka `strom search edit Q… --drop-found S…|--no-found --reason "…"`.
- **Obowiązuje od:** badanie 1.0.0; odrzucenie przy niejasnym miejscu i „tylko w indeksie” 1.14.0; kolejność ze
  źródłem, `search edit --drop-found|--no-found` i `--by agent` 1.33.0

<!-- zdroj: research:assets/method/core.md:22-25 · reading.md:22-30, :70-84 · src/commands/analysis.ts:208-268 · src/core/model.ts:484-485 · src/commands/readings.ts:347-380 openUnclear, :414 refuseNegativeOverUnclear · src/core/evidence.ts:21 searchedAs · src/commands/tasks.ts:348-351 · 1.33.0: research:7bdba196 search add (search.found.first), search edit --drop-found/--no-found (search.found.none|empty|not|which), strom help search edit · c50f80f5 --by agent (= main) · CHANGELOG.cs.md 1.33.0 -->

<a id="R3.7"></a>
## R3.7 Kiedy agent pyta człowieka

Odczyty i stopnie pewności ustala agent sam. Człowieka pyta tylko tam, gdzie bez niego nie da się iść dalej. Pytanie
trafia do **Czeka na załatwienie** (zob. [R6](R6-awaiting-action.md)) jako zdanie bezosobowe.

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
| **Udokumentowane** / **Częściowo udokumentowane** / **Nieudokumentowane** | poziom udokumentowania osoby | cytaty ([R3.8.1](#R3.8.1)) |
| **Dla badaczy**, „Potwierdzone źródłami: N z M informacji” | dane osoby ze źródłem | cytaty |
| **Przegląd drzewa → Przodkowie**, kolumna **udokumentowani** | przodkowie z udokumentowanym urodzeniem | z badaniem tylko Udokumentowane, w przeciwnym razie cytaty |
| **Gdzie brakuje dowodów → Urodzenia niesprawdzone w badaniu** | urodzenia przodków, które nie są Udokumentowane | badanie |
| książka, **Dane dla badaczy**: udokumentowane · sprzeczność · nieudokumentowane | stan udokumentowania danej | Udokumentowane **albo** jakikolwiek cytat |
| **Moje transkrypcje źródeł → Udokumentowane** | jak badanie traktuje transkrypcje użytkownika | pierwszy odczyt, Prawdopodobne ([R3.5.1](#R3.5.1)) |

- **Granice:** stopnie pewności aplikacja tylko pokazuje, nie można ich zmienić. Sprzeczność przy danej w książce
  przeważa nad „udokumentowane” i „nieudokumentowane”.
- **Obowiązuje od:** aplikacja 3.5.0 (poziom osoby), 3.9.0 (etykieta, Moje transkrypcje źródeł), 3.13.0 (Pewność
  danych z badania), 3.13.1 (kolumna udokumentowani), 3.18.0 (Dla badaczy), 3.19.0 (książka)

<!-- zdroj: app:src/ui/fact-status.ts · src/tree-overview.ts:224-233 birthDocumented · src/ui/tree-overview.ts:1037, :1960, :1650-1680 · src/person-page.ts:1014-1019 · src/book-blocks.ts:468-484 evidenceMark · strings.ts treeOverview.*, personPage.research.*, book.evidence.*, book.dlg.research(Hint), treeSettings.evidence -->

<a id="R3.8.1"></a>
### R3.8.1 Poziom udokumentowania osoby

- **Nieudokumentowane**: osoba, jej wydarzenia ani jej związki nie cytują żadnego źródła.
- **Udokumentowane**: cytowane urodzenie (lub chrzest) i, gdy osoba ma zgon (datę, miejsce, wydarzenie zgonu lub
  pochówku), także cytowany zgon (lub pochówek, kremacja).
- **Częściowo udokumentowane**: wszystko pomiędzy, także źródło dołączone tylko do osoby (do imienia, do miejsca
  zamieszkania).
- Stopnia pewności się nie liczy: urodzenie cytujące nawet przejęte drzewo genealogiczne (Wskazówka) daje **Udokumentowane**. Aplikacja
  mówi to przy **Pewność danych z badania**: „Nie mylić z udokumentowaniem źródłem.”
- Gdy w drzewie nikt nie cytuje źródła, karta poziomu nie pokazuje. Osoba zastępcza nie ma poziomu.
- **Obsługa:** aplikacja: znacznik na karcie w drzewie, które nie zna pochodzenia danych
  ([S7.2](S7-reliability-and-verification.md#S7.2)); tryb **Udokumentowanie** w drzewie ([A3.7](A3-evidence-in-the-app.md#A3.7));
  **Przegląd drzewa → Jakość danych → Gdzie brakuje dowodów**.
- **Obowiązuje od:** aplikacja 3.5.0; 3.26.0: poziom pokazuje jeden znacznik na karcie ([S7.2](S7-reliability-and-verification.md#S7.2))

<!-- zdroj: app:src/evidence-level.ts personEvidence, treeHasAnySource · strings.ts treeHealth.evidenceMode/evFull/evPartial/evNone, cardDensity.cardShowHint, treeOverview.certaintyDesc · app:7eb903a3 src/reliability.ts cardStatus (bez původu: full ●●, partial ●○, none) · src/ui/fact-status.ts card.evTitle · strings.ts cardDensity.cardStatus (3.26.0 nahradila cardEvidence) -->

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
  --source S… --drop "E… <dlaczego>"`. Plik Stromu: źródła opowieści jako `2 SOUR` pod `_STORY`.
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

<a id="R3.10"></a>
## R3.10 Usunięte źródło zostaje wycofane

Źródła, które człowiek usunie, badanie nie usuwa, tylko je wycofuje (powód „deleted”): znika z drzewa
genealogicznego, które dostaje aplikacja, a `strom source restore` przywraca je razem z cytatami.

- **Co robi wycofanie:**
  - cytaty źródła zdejmuje się z danych, imion i rodzin i przechowuje w źródle. Wartości danych zostają;
  - dana, której stanu pozostałe cytaty nie uniosą jako pewnego, zostaje obniżona. Cytat główny źródła znika i inny
    nie zostaje wybrany na jego miejsce;
  - zadanie, które pracuje tylko z tym źródłem, zostaje porzucone; zadanie z innymi miejscami toczy się dalej bez
    niego;
  - sprzeczność, która opiera się na źródle, dostaje znacznik do przejrzenia, a jej stan zostaje. Znacznik zdejmuje
    `strom conflict keep` (decyzja obowiązuje) albo nowe rozstrzygnięcie sprzeczności;
  - tekst opowieści nigdy się nie zmienia; źródło tylko wypada z jej listy źródeł.
- **Przywrócenie** (`strom source restore`): źródło dostaje z powrotem to samo ID, a każdy cytat wraca do danej,
  przy której był (przy osobie w międzyczasie scalonej do tej, do której weszła), o ile dana jeszcze jest, a źródło
  jej już nie cytuje. Cytat główny wraca tylko tam, gdzie w międzyczasie główny nie stał się inny; obniżony stan
  wraca tylko tam, gdzie w międzyczasie nikt go nie zmienił; zadania tylko tam, gdzie się nie zmieniły. Znaczniki
  do przejrzenia znikają.
- **Co mówi badanie:**
  - `strom source show S…` przy usuniętym źródle mówi, kiedy człowiek je usunął i gdzie (w terminalu albo
    w aplikacji Strom), ile cytatów jest w nim przechowanych i jak je przywrócić;
  - `strom source list --retracted` wypisuje tylko wycofane źródła: usunięte (z liczbą przechowanych cytatów
    i wierszem, jak źródło przywrócić), scalone i cofnięte.
- **Pilnuje kod:**
  - wszystko albo nic: źródło, którego badanie nie ma albo które jest już wycofane, i nie zapisze się nic; najwyżej
    50 źródeł naraz; całe usunięcie to jedna operacja historii;
  - `--dry-run` (co by usunięcie zabrało, z liczbami) może uruchomić każdy, także agent;
  - bez `--dry-run` człowiek mówi tak we własnym terminalu (Enter to nie), inaczej w oknie systemu; gdy nie ma kogo
    zapytać, polecenie kończy się kodem 4. Agent nigdy nie usunie źródła, nawet z potwierdzeniem aplikacji; może
    usunięcie tylko zaproponować z liczbami z `--dry-run`;
  - `strom source restore` odrzuci źródło, które nie jest wycofane (`source.notRetracted`), i źródło wycofane
    inaczej: scalone albo cofnięte przy synchronizacji (`source.notRestorable`);
  - `strom conflict keep` odrzuci otwartą sprzeczność i sprzeczność bez znacznika (`conflict.notMarked`). Agent może
    człowiekowi znacznik tylko zgłosić, nigdy go nie zdejmie;
  - usunięte źródło ani to, co się do niego odwołuje, już nie wróci z późniejszym plikiem z aplikacji ani importem.
- **Granice:**
  - kopią zapasową jest historia badania i cytaty przechowane w źródle; pełnej kopii zapasowej badania przed
    usunięciem się nie robi;
  - cytat, którego nie da się przywrócić (dana zniknęła albo źródło już ją cytuje), zostaje wypisany, a reszta się
    przywraca.
- Usunięcie w aplikacji: [A3.1.2](A3-evidence-in-the-app.md#A3.1.2), usunięcie przy edycji i synchronizacja:
  [S2.6.1](S2-edits-from-the-app.md#S2.6.1), plik drzewa genealogicznego razem ze źródłem:
  [R11.5.6](R11-material-from-the-user.md#R11.5.6).
- **Obsługa:** terminal: `strom source retract S… [--dry-run] [--reason "…"] [--sources-from <plik>]`,
  `strom source restore S…`, `strom source list --retracted`, `strom conflict keep X…`; aplikacja: **Usuń
  źródło…** przez most ([A3.1.2](A3-evidence-in-the-app.md#A3.1.2)).
- **Obowiązuje od:** badanie 1.36.0

<!-- zdroj: research:e6bbfb40 src/core/sourceretract.ts (hlavička; DELETED, RETRACT_MOST 50, RETRACT_CONFIRM_MS 15 min, REVIEW_RETRACTED, ACTIVE open/doing/parked/waiting) · src/commands/sourceretract.ts source retract (description, agentMay --dry-run, source.agent, source.retract-changed, requireHumanYes), source restore (description, source.notRetracted, source.notRestorable), ui.source.restore.skipped · src/commands/analysis.ts conflict keep (conflict.notMarked, agent jen říká) · src/commands/sources.ts source list --retracted, source show RETRACTED … the person puts it back · src/core/sync.ts withholdDeleted (spec 117 J6) · assets/lang/cs.json ui.consent.retract, ui.source.retract.would · CHANGELOG.cs.md 1.36.0 · spec 117 K1.1–K1.7, J3 (záloha = historie + citace v prameni) -->
