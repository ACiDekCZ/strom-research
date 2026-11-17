<a id="R6"></a>
# R6 Czeka na załatwienie

Czego badanie potrzebuje od człowieka, gdzie to się pokazuje i jak zadanie po załatwieniu wraca do kolejki. Opisuje
badanie 1.25.2 i aplikację Strom 3.21.2. Zmiany z nowszej wersji mają przy sobie jej numer.

<a id="R6.1"></a>
## R6.1 Co czeka to jedna lista

Wszystko, na co badanie czeka od człowieka, tworzy jedną uporządkowaną listę: zadania ustawione na oczekiwanie, pytania
archiwów, nowe wersje zatwierdzonych opowieści i pytania o miejsca. Terminal pokazuje ponadto to, co załatwia się
tylko w nim. Lista jest za każdym razem obliczana z badania, nic się do niej nie zapisuje.

- **Granice:** zadanie, które czeka tylko na zgodę archiwum i nie ma skanów, należy do pytania archiwum. Badanie, które
  służy jako archiwum, nie ma na liście zadań ani miejsc.
- **Obsługa:** aplikacja: sekcja **Czeka na załatwienie** · terminal: menu **Co czeka (n)**, wiersz stanu **Czeka: N** ·
  strona na telefon: **Co czeka · N**.
- **Obowiązuje od:** badanie 1.3.0. Lista według miejsc załatwienia i w aplikacji od 1.14.0 (aplikacja 3.11.0).

<!-- zdroj: research:src/core/waiting.ts:1-12, waitingFor :303-460 (filtr :321), actsAsArchive (v1.15.0) · src/cli/menu.ts:234, :379 · CHANGELOG.cs.md 1.14.0 · app:src/ui/research-overview-ui.ts research.waiting -->

<a id="R6.1.1"></a>
### R6.1.1 Liczba i co jest tylko w terminalu

- Wiersz **Czeka: N (w tym X tylko tutaj w terminalu, Y czeka na odpowiedź)** dzieli liczbę tak jak aplikacja.
  Liczba w aplikacji to N bez pozycji tylko dla terminala i bez wysłanych zapytań.
- Tylko w terminalu są drzewa wysłane z aplikacji (**Aplikacja Strom**), pytania do odczytu skanów (**Odczyt
  skanów**), sprzeczności (**Do rozstrzygnięcia – sprzeczności**, zob. [R5](R5-conflicts.md)), hipotezy do
  rozstrzygnięcia (od badania 1.28.0; od 1.31.0 dostaje je też aplikacja Strom, która umie je rozstrzygnąć,
  [R6.3.4](#R6.3.4)) i łagodniejsze warunki archiwum. W przeglądzie **Co czeka** idą najpierw pod nagłówkiem **Tylko tutaj w terminalu (nie ma ich w aplikacji
  Strom)**, za nimi **Także w aplikacji Strom**.
- Strona na telefon tylko czyta: bez pozycji tylko dla terminala, z opowieściami, najpierw 20 pozycji, najwyżej 200
  naraz. Podaje **Decyzje podejmuje się na komputerze w Przeglądzie badania.**
- **Obowiązuje od:** badanie 1.21.0. Strona na telefon od 1.18.0, zapamiętana liczba w menu od 1.22.0.

<!-- zdroj: research:src/core/waiting.ts:127 TERMINAL_ONLY, :139 waitingSplit, :149 waitingLine · src/cli/menu-waiting.ts:215-232 · src/core/waitkept.ts · src/core/phone-watch.ts WAITING_SHOWN, WAITING_ASKED · assets/lang/cs.json ui.waiting.split*, ui.wait.only.head, ui.phone.page.waiting.where -->

<a id="R6.2"></a>
## R6.2 Zadanie czeka na człowieka

Gdy agent nie może kontynuować bez człowieka, ustawia zadanie na oczekiwanie i bezosobowo zapisuje, co jest potrzebne.
Rodzaj oczekiwania wyznacza sekcję, grupę i możliwe akcje: **skany**, **witryna do sprawdzenia**, **zgoda archiwum**,
**list**, **rodzina**, **internet**, **inne**.

- **Granice:** `--kind` przyjmuje tylko `letter`, `family`, `web`, `other`; skany i sprawdzenie witryny mają własne
  opcje, których nie można łączyć. Bez `--kind` rodzaj wywodzi się ze słów: pytanie do człowieka to **rodzina**,
  w przeciwnym razie rozstrzyga pierwsze zdanie, potem cały tekst, gdy wymienia dokładnie jeden rodzaj; w przeciwnym
  razie **inne**. Tekst zwracający się do człowieka badanie odrzuca. Nowe ustawienie oczekiwania usuwa poprzednie
  i znacznik wysłania.
- **Obsługa:** terminal: `strom task wait T… --on "<co>" --kind <rodzaj> --to "<komu>" --request notes/<plik>
  --url <adres>`, później `strom task edit T… --kind --to --request`.
- **Od badania 1.26.0:** `--kind images` przy `--images` i `--kind check` przy `--check` traktuje się jako powtórzenie,
  nie błąd.
- **Obowiązuje od:** badanie 1.0.0. Rodzaje, `--to` i `--request` od 1.14.0.

<!-- zdroj: research:src/commands/tasks.ts:975-1050 task wait, :497-520 waitOptions, :392-417 stateChange · src/core/model.ts:540 WAIT_KINDS · src/core/waitkind.ts:150 waitKindOf (ASK_USER, firstClause) · assets/method/waiting.md -->

<a id="R6.2.1"></a>
### R6.2.1 Skany zapisane ręcznie

- Badanie przygotowuje folder w `inbox/` folderu współdzielonego. Plik nosi numer skanu (`9.jpg`, `9a.jpg`).
- Po zapisaniu skanów do badania zadanie się budzi z notatką, których skanów brakuje ([R6.7.2](#R6.7.2)).
- **Obsługa:** terminal: `strom task wait T… --images B…:<od>-<do>`, potem `strom media add --inbox`; w **Co czeka**
  **Otwórz folder (zapisano M/N)**. Aplikacja: **Otwórz folder** (od aplikacji 3.23.0; wcześniej **Folder**).
- Archiwa tylko przez przeglądarkę, skany z aplikacji i co robi człowiek: [R9.6](R9-archives.md#R9.6), [R9.9](R9-archives.md#R9.9).
- **Obowiązuje od:** badanie 1.0.0. Budzenie po zapisaniu od 1.15.0.

<!-- zdroj: research:src/commands/tasks.ts:1000-1025 (--images, inbox) · src/commands/media.ts:135-170 wakeWaiting · assets/method/waiting.md · app:src/research-waiting.ts:251 waitingActions (folder) · src/ui/research-overview-ui.ts:1023, src/ui/waiting-task-ui.ts:231 · src/strings.ts waitingTask.openFolder -->

<a id="R6.2.2"></a>
### R6.2.2 Witryna do sprawdzenia

Zadanie czeka, aż człowiek obejrzy stronę, której agent sam nie otworzy. Odpowiedź to **Działa – widać księgę
i skany**, **Tylko do przeglądania** lub **Nie działa**, z opcjonalną notatką.

- **Granice:** `--check` wymaga wyszukiwania zapisanego w tej sesji lub przy zadaniu, które wymienia tę samą witrynę.
  Odpowiada tylko człowiek ([R6.6](#R6.6)). Pozycja należy do **decyzji**, nie do **internetu**.
- **Obsługa:** terminal: `strom task wait T… --check <adres> --on "<co>"`; w **Co czeka** **Co tam jest?**,
  `strom task wake T… --check=works|view|no`.
- **Obowiązuje od:** badanie 1.14.0

<!-- zdroj: research:src/commands/tasks.ts:439-470 checkUrl (task.check-search) · src/core/model.ts:510 CHECK_ANSWERS · src/core/waiting.ts:51-65 SECTION · src/cli/menu-waiting.ts:637 checkSite -->

<a id="R6.3"></a>
## R6.3 Decyzje

Sekcja **decyzje** zbiera pytania, które wstrzymują agenta: zgoda archiwum, programy pobierające do potwierdzenia,
łagodniejsze warunki, witryna do sprawdzenia, opowieść, miejsce (zob. [R4](R4-places.md)), sprzeczność (zob.
[R5](R5-conflicts.md)), hipoteza (zob. [R6.3.4](#R6.3.4)), drzewa z aplikacji, odczyt skanów i propozycja brzmienia transkrypcji (grupa **Do rozstrzygnięcia –
transkrypcje**, zob. [R3.4.1](R3-verification-and-citation.md#R3.4.1)). Decyzje idą na liście pierwsze.

- **Obsługa:** terminal: **Co czeka** → pozycja; `strom allow archive --way`, `strom place answer`,
  `strom conflict resolve`, `strom media calibrate --answer`.
- **Obowiązuje od:** badanie 1.14.0. Sprzeczności od 1.20.0, miejsca od 1.25.0, hipotezy od 1.28.0, transkrypcje od 1.29.0.

<!-- zdroj: research:src/core/waiting.ts:51-65 SECTION, :75 DECIDE_RANK · src/cli/menu-waiting.ts:486 decideConflictHere, :518 decidePlace, :712 decideTune · CHANGELOG.cs.md 1.20.0, 1.25.0 · 1.29.0: src/core/waiting.ts:375-390 (kind transcript, section decide, wait.group.transcripts) -->

<a id="R6.3.1"></a>
### R6.3.1 Zgoda archiwum

- Pytania są w grupie według archiwum, programy pobierające do zatwierdzenia w grupie **Programy pobierające**.
  Zadanie, którego pobieranie natrafiło na pytanie, czeka na decyzję.
- Decyzja budzi zadania czekające na to archiwum we wszystkich badaniach na komputerze. Przy opcji **Tylko ręcznie –
  skany zapisuje się do przygotowanego folderu** zadania czekają dalej na ręcznie zapisane skany. Zadanie **witryna do
  sprawdzenia** nie budzi się nigdy.
- **Obsługa:** terminal: `strom allow archive --way`, menu archiwów, okno pobierania. Aplikacja: odnośnik do
  terminala.
- **Obowiązuje od:** badanie 1.14.0

<!-- zdroj: research:src/core/archivewait.ts:188-215 wakeForArchive (way "manual", check :205), waitingForDecision · src/core/waiting.ts:303-340 · assets/lang/cs.json wait.group.takeover -->

<a id="R6.3.2"></a>
### R6.3.2 Opowieść do zatwierdzenia

- Na liście jest tylko nowa wersja już zatwierdzonej opowieści, w grupie **Opowieści**. Wybór: **nową wersję, zamiast
  starej** albo **zostawić starą (nowa wersja zostanie odrzucona)**.
- **Obsługa:** aplikacja: **Nowa wersja opowieści**, **Porównaj**, decyzja odnośnikiem do terminala. Terminal:
  **Którą opowieść ma mieć Księga rodu?**, `strom story approve|discard`.
- **Obowiązuje od:** badanie 1.14.0
- **Od badania 1.26.0:** decyduje tylko człowiek; agentowi badanie `strom story approve|discard` odrzuca
  ([R6.6](#R6.6)).

<!-- zdroj: research:src/core/stories.ts:169 storiesToApprove · src/core/waiting.ts:369-390 · src/cli/menu-waiting.ts:686 decideStory · src/commands/story.ts:102-134 · app:src/ui/story-compare-ui.ts -->

<a id="R6.3.3"></a>
### R6.3.3 Gałęzie poza liniami

- Rosnąca gałąź poza liniami dostaje pytanie w grupie **Gałęzie poza liniami** ([R2.3.2](R2-lines-and-queue.md#R2.3.2)):
  **Dodać do linii**, **Założyć linię**, **Zostawić bez zmian**, **Nie badać**.
- **Granice:** odpowiada tylko człowiek ([R6.6](#R6.6)).
- **Obsługa:** terminal: **Co czeka** → pozycja, `strom offline answer`.
- **Obowiązuje od:** badanie 1.26.0

<!-- zdroj: research:HEAD src/core/waiting.ts:428-451 (group branches) · src/cli/menu-waiting.ts decideBranch · assets/lang/cs.json:2359 wait.group.branches -->

<a id="R6.3.4"></a>
### R6.3.4 Hipotezy do rozstrzygnięcia

- Hipoteza, której rozstrzygnięcie zaproponował agent ([R10.3.1](R10-people-and-hypotheses.md#R10.3.1)), czeka
  w grupie **Hipotezy do rozstrzygnięcia**: pytanie, wersje i propozycja („Propozycja: wariant B – …”). Wybór:
  **Rozstrzygnąć zgodnie z propozycją**, **Rozstrzygnąć inaczej** (inna wersja albo żadna, z powodem), **Zostawić bez
  zmian (propozycja nieprzyjęta)**.
- Po propozycjach czekają otwarte hipotezy bez propozycji. Wybór: **Rozstrzygnąć** (wersja albo żadna, z tekstem
  rozstrzygnięcia), **Zostawić otwartą**. Zostawiona hipoteza pojawi się w Co czeka znowu, gdy agent zaproponuje, jak
  ją rozstrzygnąć.
- Rozstrzygnięta albo porzucona hipoteza otwarta z menu oferuje **Zmienić rozstrzygnięcie**: nowy tekst
  rozstrzygnięcia jest obowiązkowy i jest zarazem powodem zmiany. Jeśli rozstrzygnął ją agent, stoi przy niej
  **Rozstrzygnął agent (dzień).**
- **Granice:** obowiązuje, gdy hipotezy rozstrzyga człowiek (zapisany wybór **Rozstrzyga człowiek**; bez zapisanego
  wyboru rozstrzyga AI, [R10.3.2](R10-people-and-hypotheses.md#R10.3.2)); rozstrzyga tylko człowiek ([R6.6](#R6.6)).
  Gdy czeka 10 lub więcej otwartych hipotez, aplikacja w **Co wie badanie** proponuje przełączenie na **Rozstrzyga
  AI** (potwierdza się w badaniu). Przy **Rozstrzyga AI**
  agent rozstrzyga sam to, co potwierdza cytowany akt, i czekają tylko jego propozycje (rozstrzygnięcia, których sam
  podjąć nie może). Aplikacja Strom, która umie rozstrzygać hipotezy, też pokazuje tę grupę
  ([S3.5.2](S3-what-the-research-knows.md#S3.5.2)); starsza aplikacja jej nie dostaje ([R6.1.1](#R6.1.1)). W Archiwum
  Strom tej grupy nie ma.
- **Obsługa:** terminal: **Co czeka** → pozycja, `strom hypothesis decide H… --proposed | --keep-open`. Te same wybory
  są w przeglądzie osoby: **Rozszerz badanie** → **Przegląd osoby** → **Hipotezy o osobie (n)**.
- **Obowiązuje od:** badanie 1.28.0
- **Od badania 1.29.0:** także otwarte hipotezy bez propozycji (**Rozstrzygnąć**, **Zostawić otwartą**), **Zmienić
  rozstrzygnięcie** i wybór **Kto rozstrzyga hipotezy**.

<!-- zdroj: research:src/core/waiting.ts (kind hypothesis, section decide, DECIDE_RANK 0, open: priority -1 a hypothesesOpen jen při person, leftOpen, TERMINAL_ONLY hypotheses, actsAsArchive) · src/cli/menu-waiting.ts decideHypothesis (proposed / open / decided) · src/cli/menu-research.ts:532 · assets/lang/cs.json wait.group.hypotheses, ui.wait.hypothesis.proposed/accept/other/keep/decide/keepOpen/change/byAgent · CHANGELOG.cs.md 1.29.0 · src/cli/wizard.ts 5c (doporučení) · app:src/ui/person-research-ui.ts HYPOTHESES_OFFER_MIN -->

<a id="R6.4"></a>
## R6.4 Grupy i kolejność

Każda pozycja należy do grupy według miejsca, gdzie się ją załatwia: archiwum, urząd, rodzina, internet lub inne.
Pozycje jednej grupy trzymają się razem w miejscu swojej pierwszej pozycji, aby można je było załatwić jedną
wiadomością.

- **Granice:** kolejność wyznaczają te klucze, każdy następny tylko przy równości poprzednich:
  1. **Do załatwienia** przed **Czeka na odpowiedź**; wysłane od najdawniej wysłanego;
  2. sekcja: decyzje → skany i internet → archiwa i urzędy, rodzina → inne;
  3. w decyzjach: drzewa z aplikacji i sprzeczności → zgoda archiwum → programy pobierające → łagodniejsze warunki →
     witryna do sprawdzenia → opowieści i miejsca (oraz gałęzie) → odczyt skanów;
  4. priorytet zadania, wyższy najpierw;
  5. wiek, starsze najpierw.
- Grupa zadania: adresat `--to` (urząd lub archiwum badania) → **Rodzina** → urząd z listu → archiwum lub serwer
  z adresu witryny → archiwum księgi zadania → archiwum według adresu → urząd → serwer → **Inne**. Stałe grupy:
  **Opowieści**, **Programy pobierające**, **Aplikacja Strom**, **Odczyt skanów**, **Do rozstrzygnięcia –
  sprzeczności**, **Miejsca do identyfikacji**, **Gałęzie poza liniami**.
- **Obsługa:** aplikacja: **Do załatwienia** / **Czeka na odpowiedź**, filtr **Pokaż według rodzaju** (**Decyzje**,
  **Obrazy**, **Archiwa i urzędy**, **Rodzina**, **Internet**, **Inne**) · terminal: w **Co czeka** litera sekcji,
  `?` przełącza na **Czeka na odpowiedź**.
- **Obowiązuje od:** badanie 1.14.0
- **Od badania 1.35.0:** badanie przy pozycji wysyła także jej księgę. Aplikacja 3.30.0 umie pogrupować pozycje według
  księgi ([S4.4.4](S4-research-from-the-app.md#S4.4.4)); w **Co czeka** jest przegląd ksiąg z największą liczbą
  zadań ([R6.8](#R6.8)).

<!-- zdroj: research:src/core/waiting.ts:73 SECTION_RANK, :75 DECIDE_RANK, :468 together, :478-492 ordered · src/core/waitkind.ts:238 waitGroupOf · assets/lang/cs.json:2313-2320 wait.group.* (:2359) · src/cli/menu-waiting.ts:205-232 · app:strings.ts:11958 waitingFilterLabel -->

<a id="R6.5"></a>
## R6.5 Co można załatwić gdzie

Aplikacja sama zapisuje tylko fakt: zapytanie zostało wysłane, wraca do załatwienia, przyszedł plik z odpowiedzią.
Decyzje i zgody przyjmuje tylko terminal; przyciski, które ich wymagają, otwierają terminal badania na komputerze.

- **Granice:**
  - Aplikacja załatwia sama: **Wysłano** (także za grupę), **Przywróć do załatwienia**, **Dodaj plik** (tylko obrazy
    i PDF), **Treść wszystkich zapytań** i odpowiedź na pytanie o miejsce (okno **Czeka na załatwienie · Miejsca**).
  - Odnośnikiem do terminala: **Odpowiedz**, **Czat**, **Treść zapytania**, **Folder**, opowieść, zgoda archiwum.
  - Na wąskim ekranie aplikacja nie ma odnośników i podaje **odpowiedź w badaniu na komputerze**; na pytania
    o miejsca można odpowiedzieć także tam.
- **Obsługa:** terminal: **Co czeka** → grupa (**Tekst wszystkich zapytań naraz**, **Wysłano za całą grupę**,
  **Rozmowa z agentem o całej grupie**) lub pozycja.
- **Obowiązuje od:** badanie 1.14.0 (aplikacja 3.11.0). Miejsca od 1.25.0.

<!-- zdroj: research:src/core/live.ts:60-80 (POST /waiting, /group, PUT /media X-Strom-Task, POST /places/answer, /conflict 403), :2761 · src/core/waiting.ts:78-88 actionsOf · app:src/ui/research-overview-ui.ts · strings.ts:9972, :10078, :11953 -->

<a id="R6.6"></a>
## R6.6 Co może tylko człowiek

Odpowiedzi za człowieka agent nie napisze. Gdy polecenie zastrzeżone dla człowieka uruchomi agent, badanie pyta
człowieka w oknie systemowym albo odrzuca polecenie.

- **Granice:**
  - tylko człowiek: odpowiedź na czekające zadanie, odpowiedź na sprawdzenie witryny, zgoda archiwum, odpowiedź na
    pytanie do odczytu skanów i na pytanie o miejsce; zadania czekającego na sprawdzenie witryny agent bez odpowiedzi
    nie budzi;
  - zatwierdzenie opowieści i **Wysłano** agent wykonuje tylko na słowo człowieka; tak mówi metodyka.
- **Obsługa:** terminal: **Odpowiedz tekstem** (najwyżej 300 znaków), `strom task wake T… --answer "<tekst>"`.
- **Obowiązuje od:** badanie 1.14.0. Miejsca od 1.25.0.
- **Od badania 1.26.0:** tylko człowiek także: zatwierdzenie i odrzucenie opowieści (`strom story approve|discard`;
  agentowi badanie odrzuca też `strom story set --final`), odpowiedź na rosnącą gałąź (`strom offline answer`),
  zostawienie sprzeczności ze zmiany agentowi (`strom conflict leave`), cofnięcie i odrzucenie wysłania z aplikacji
  (`strom sync undo|discard`) oraz poprawki `strom fixes … edit-decisions|woken-waits`.
- **Od badania 1.28.0:** tylko człowiek także rozstrzyga hipotezę (`strom hypothesis decide`, także wewnątrz
  `strom batch`); agent ją tylko proponuje ([R10.3.1](R10-people-and-hypotheses.md#R10.3.1)).
- **Od badania 1.29.0:** obowiązuje to przy **Rozstrzyga człowiek**; bez zapisanego wyboru rozstrzyga AI
  ([R10.3.2](R10-people-and-hypotheses.md#R10.3.2)). Zapisać **Rozstrzyga AI** tam, gdzie zapisane jest **Rozstrzyga
  człowiek**, albo ten wybór usunąć może tylko człowiek. Tylko człowiek decyduje też, co dalej ze źródłem przeczytanym ponownie
  (`strom source reading`, [R8.8.3](R8-reading-scans.md#R8.8.3)), i o propozycji brzmienia transkrypcji, którą napisał
  lub potwierdził (`strom source proposal`, także o jej cofnięciu, [R3.4.1](R3-verification-and-citation.md#R3.4.1)).
- **Od badania 1.35.0:** tylko człowiek decyduje też, czy przejąć krótszą notatkę uczestnika z aplikacji
  (`strom sync note`, [S2.3.2](S2-edits-from-the-app.md#S2.3.2)); agent wykonuje tylko odpowiedź człowieka na to
  zadanie.

<!-- zdroj: research:src/commands/tasks.ts:897-970 (requireHuman :941, task.check-person :932) · src/commands/archives.ts:586-645 · src/commands/calibrate.ts:320 · src/commands/placeid.ts:343 person · assets/method/waiting.md, narrate.md:26-31 · src/cli/menu-waiting.ts:45 ANSWER_MAX · 1.26.0: userOnly u story approve/discard, offline answer, conflict leave, sync undo/discard (commity 4683a22d, 1189532f, 942c56f9), fixes.ts edit-decisions/woken-waits (person at the terminal) · 1.28.0: analysis.ts hypothesis decide (person), batch.ts def.person (commit 9b12256a) · 1.29.0: setup.ts syncDecisions hypotheses.decide (requireHuman), config.ts hypothesesDecide výchozí agent; strom help source reading („The person's alone … an agent never decides it“), strom help source proposal („Only the person decides it“) · 1.35.0: research:fb94435f src/commands/sync.ts sync note (person, agentMay s odpovědí), src/core/shorternote.ts decideShorterNote (shorter.person) -->

<a id="R6.7"></a>
## R6.7 Wysłano, odpowiedź i powrót do kolejki

List, zapytanie do rodziny lub inne zapytanie po wysłaniu przechodzi do **Czeka na odpowiedź**. Odpowiedź przywraca
zadanie do kolejki, a agent przetwarza ją przy następnej pracy.

- **Granice:** **Wysłano** można tylko przy czekającym zadaniu rodzaju list, rodzina lub inne. Po 30 dniach bez
  odpowiedzi terminal podaje **bez odpowiedzi ponad 30 dni**.
- **Obsługa:** aplikacja: **Wysłano**, **Przywróć do załatwienia** · terminal: **Wysłano**, `strom task sent T…`,
  cofnięcie `--undo`.
- **Obowiązuje od:** badanie 1.14.0

<!-- zdroj: research:src/commands/tasks.ts:1053-1118 task sent (task.not-waiting, task.not-sendable) · src/core/waitkind.ts:23 SENDABLE · src/cli/menu-waiting.ts:49 NO_REPLY_DAYS, :126 -->

<a id="R6.7.1"></a>
### R6.7.1 Odpowiedź plikiem lub słowami

- **Plikiem:** pliki stają się materiałami osób zadania, a zadanie wraca do kolejki. Zadanie przyjęcia materiałów nie
  powstaje. Pliku nie można dodać do zadania, które nie czeka, czeka na sprawdzenie witryny lub na zgodę archiwum.
- **Słowami:** odpowiedź zapisuje się przy zadaniu razem z pytaniem, a zadanie wraca do kolejki. `intake --text`
  z `--answers` badanie odrzuca: odpowiedź słowami należy tylko do człowieka.
- **Obsługa:** aplikacja: **Dodaj plik** · terminal: **Dodaj plik**, **Odpowiedz tekstem**;
  `strom intake <plik> --answers T…`, `strom task wake T… --answer "<tekst>"`.
- **Obowiązuje od:** badanie 1.3.0 (słowami). Plikiem od 1.14.0.

<!-- zdroj: research:src/commands/intake.ts:164-205 (--answers) · src/core/taskfiles.ts fileRefused · src/commands/tasks.ts:969 answers · src/core/live.ts PUT /media X-Strom-Task -->

<a id="R6.7.2"></a>
### R6.7.2 Kiedy zadanie wraca samo i odłożenie

- Zadanie wraca samo, gdy do badania zapisze się skany księgi, na którą czeka lub którą wymienia, albo gdy archiwum
  dostanie decyzję ([R6.3.1](#R6.3.1)).
- Zadania odłożonego nie ma na liście ani w kolejce. Z datą `--until` wraca samo, otwarte jest już w tym dniu. Bez daty
  czeka, aż ktoś je obudzi. Odłożenie wymaga powodu.
- **Obsługa:** terminal: `strom task park T… --reason "<dlaczego>" --until RRRR-MM-DD`, cofnięcie `strom task wake T…`.
  Aplikacja: sekcja **Kolejka**, **Odłóż** (odnośnik do terminala, bez daty).
- **Obowiązuje od:** badanie 1.0.0. Powrót po skanach od 1.15.0, po decyzji archiwum od 1.14.0.
- **Od badania 1.26.0:**
  - skany przywracają tylko zadanie, które czeka na skany właśnie tej księgi. Zadania czekającego na sprawdzenie
    witryny przez człowieka nie przywracają nigdy. List, zapytanie do rodziny lub internet przywraca tylko księga, na
    którą zadanie czeka, a nie księga, w której tylko pracuje;
  - od badania 1.27.0 zadanie czekające na internet (`--kind web`) przywraca także jedyna księga, w której pracuje:
    zapisane tam skany są tym, na co czekało. List i zapytanie do rodziny nadal tylko księga, na którą czekają;
  - zadania, które skany przywróciły wcześniej niesłusznie, przywraca do czekania poprawka `strom fixes show|run|undo
    woken-waits`: zadanie czeka jak przedtem, także z wysłaniem. Zadanie, nad którym w międzyczasie pracowano,
    zostaje. Poprawkę uruchamia tylko człowiek w terminalu, w Archiwum Strom jej nie ma. Dopóki nie zostanie
    wykonana, `strom check` zwraca uwagę na takie zadania.

<!-- zdroj: research:src/commands/media.ts:135-170 wakeWaiting (1.26.0: awaits jen ta kniha, check nikdy, letter/family/web jen waitingOn; 1.27.0: web i singleBook) · src/commands/fixes.ts:835 woken-waits (commit 740e1893) · src/core/archivewait.ts:188 wakeForArchive · src/commands/tasks.ts:880-895 task park · src/core/queue.ts:112 effectiveState · app:src/ui/research-ui.ts:3473-3500 -->

<a id="R6.8"></a>
## R6.8 Księgi z największą liczbą zadań

Badanie oblicza, których ksiąg potrzebuje najwięcej jego zadań. Jedno ręczne pobranie księgi służy wtedy wszystkim
jej zadaniom naraz. To propozycja, a nie pozycja, która czeka: do liczby **Czeka: N** się nie wlicza, a bez pobrania
agent czyta księgę dalej online.

- **Pilnuje kod:**
  - liczą się zadania otwarte (także rozpoczęte), odłożone i czekające. Księga zadania to księga (B…), którą zadanie
    wymienia w tym, gdzie pracuje, oraz księga, na której skany czeka. Zadanie, które księgi nie wymienia, się nie
    liczy i księga nie jest mu dopowiadana: liczby są dolną granicą, nie szacunkiem;
  - księga scalona z inną liczy się jako ta druga, księga wycofana jako żadna;
  - kolejność: najwięcej zadań, przy równości najwięcej czekających, potem numer księgi;
  - przy księdze: archiwum, lata, dostęp, ile zadań jej potrzebuje (w tym czekające i odłożone), skany łącznie, na
    dysku i brakujące (łącznie i brakujące tylko tam, gdzie katalog zna liczbę skanów), potrzebne skany, których
    jeszcze nie ma na dysku (numery, na które czekają jej czekające zadania), folder w folderze współdzielonym i adres
    księgi;
  - księga zostaje **zaproponowana** do pobrania, gdy potrzebuje jej co najmniej `books.minTasks` zadań (domyślnie 5,
    [R6.8.3](#R6.8.3)), dostęp jest wolny lub z logowaniem (`online-free`, `online-login`), nie jest cała na dysku
    i jest co zaproponować: cała księga tam, gdzie pozwalają na to warunki archiwum, w przeciwnym razie potrzebne
    skany, których jeszcze nie ma na dysku ([R6.8.1](#R6.8.1)). Księga, z której warunki nie pozwalają pobrać
    niczego, nie zostaje zaproponowana nigdy;
  - Archiwum Strom ksiąg nie proponuje ([R7.8](R7-when-the-agent-works.md#R7.8)).
- **Agent przy zadaniu:** na początku zadania agent dowiaduje się, które kolejne zadania potrzebują tej samej księgi,
  aby wykonał je razem: w briefie przy księdze i w `strom task show` wiersz „the same book is needed by N more tasks:
  …”. Najpierw otwarte, potem czekające i odłożone, najwyżej 10 numerów zadań, reszta liczbą.
- **Obsługa:** terminal:
  - `strom task books`: proponowane księgi; `--min <n>` inna granica tylko dla tego wypisu (1–999), `--all` każda
    księga, której potrzebuje jakieś zadanie, `--json`;
  - `strom task list --book B…`: zadania jednej księgi, najpierw otwarte, potem odłożone i czekające; z `--state`
    tylko zadania tego stanu;
  - menu **Co czeka**: klawisz **k** „księgi z największą liczbą zadań N”; gdy nic nie czeka, księgi pokazują się
    pod **Nic nie czeka.** Ekran pokazuje najwyżej 9 ksiąg, pozostałe `strom task books`.

  Aplikacja: Czeka na załatwienie, grupy według księgi i **Szybciej dzięki pobraniu**
  ([S4.4.4](S4-research-from-the-app.md#S4.4.4), [S4.4.5](S4-research-from-the-app.md#S4.4.5)).
- **Dlaczego:** skany należą do księgi, nie do zadania: jeden folder i jedno pobranie służą wszystkim zadaniom księgi.
- **Obowiązuje od:** badanie 1.35.0

<!-- zdroj: research:c533bc0e, 198eed31, b1749433 src/core/books.ts needsBooks (open, doing, parked, waiting; ne proposal ani shorterNote), liveBook (mergedInto, retracted), booksOfTask (where B…, awaits.recordset), bookRows (registered, missing jen s images, need = awaits.images bez registrovaných, řazení tasks ↓, waiting ↓, id), offerable (minTasks, DOWNLOADABLE online-free/online-login, missing !== 0, whole nebo range/selected s needCount), tasksOfBook (open, parked, waiting), sameBookLine (SAME_BOOK_IDS_MAX 10) · src/brief/brief.ts sameBookLine u knihy (ne u odhadnutého místa) · src/commands/tasks.ts task books (--min 1–999, --all, --json), task list --book (task.book), taskDetail řádek book · src/cli/menu-waiting.ts booksHere (actsAsArchive → žádné), showBooks (BOOKS_SHOWN 9), ui.wait.c.books · src/cli/menu.ts (Nic nečeká → showBooks) · assets/lang/cs.json ui.wait.c.books, ui.books.* · CHANGELOG.cs.md 1.35.0 „Knihy s nejvíc úkoly“ · dirigent:spec/105-co-nejvic-pomuze K1.1–K1.3 -->

<a id="R6.8.1"></a>
### R6.8.1 Co można pobrać z księgi: warunki archiwum

Co badanie zaproponuje z księgi, mówią warunki archiwum. Lista archiwów, którą strom ma u siebie, podaje przy
archiwum, co człowiek może z księgi pobrać ręcznie, z dosłownym cytatem warunków, ich strony albo pisemnej odpowiedzi
archiwum.

- **Pilnuje kod:**

  | Warunki archiwum | Co zostaje zaproponowane |
  |---|---|
  | archiwum oferuje całą księgę (przycisk, ZIP) albo warunki pozwalają ją pobrać | cała księga |
  | tylko wybrane skany, nigdy cała księga ani jej istotna część | tylko potrzebne skany, których nie ma na dysku |
  | nic | nic, księga nie zostaje zaproponowana |
  | lista archiwum nie zna | potrzebne skany, których nie ma na dysku |

  - rozstrzyga adres księgi, w przeciwnym razie adres jej archiwum;
  - potrzebne skany znają tylko zadania, które na skany czekają. Księga bez czekającego zadania nie zostaje więc
    zaproponowana poza archiwami, które pozwalają na całą księgę.
- **Przykłady z listy:** cała księga: eBadatelna SOA Praha (pobierać mogą zarejestrowani) i inne archiwa,
  których warunki na to pozwalają; tylko wybrane skany: DigiArchiv SOA Třeboň (pisemna odpowiedź archiwum); nic:
  FamilySearch, Archion. Moravský zemský archiv nie ma na liście tej
  informacji (brak dosłownego cytatu): proponowane są potrzebne skany ([R9.10.1](R9-archives.md#R9.10.1)).
- **Granice:** warunki archiwum mają pierwszeństwo przed propozycją. Całą księgę aplikacja i terminal zaproponują
  tylko wtedy, gdy mówią tak warunki.
- **Obsługa:** terminal: `strom task books --json` (pole `download`: `whole`, `range`, `selected`, `none`, oraz
  cytat `downloadTerms`). Aplikacja: „Do pobrania cała księga”, „Do pobrania skany …”, „Do pobrania wybrane skany …”
  ([S4.4.4](S4-research-from-the-app.md#S4.4.4)).
- **Obowiązuje od:** badanie 1.35.0

<!-- zdroj: research:b1749433 assets/archives.json wholeBook {how offered|allowed|selected|never, says, from terms|termsPage|reply} (ebadatelna.soapraha.cz offered termsPage; digi.ceskearchivy.cz, www.ceskearchivy.cz selected reply; aron./imgx.vychodoceskearchivy.cz, vychodoceskearchivy.cz, www.landesarchiv-nrw.de, apertus.rlp.de allowed terms; agad.gov.pl, agadd*.home.net.pl allowed reply; familysearch.org, www.archion.de never; mza.cz bez wholeBook) · src/core/terms.ts wholeBookFor · src/core/books.ts downloadOf (b.url, jinak repo.url; bez údaje range), offerable · karta prace/1116-vyzkum-105-knihy-a (V4: čísla snímků znají jen čekající úkoly), -b (MZA bez citace, range) · spec 105 rozhodnutí U1 -->

<a id="R6.8.2"></a>
### R6.8.2 Skany zapisane w folderze księgi

Skany, które człowiek zapisze w folderze księgi w folderze współdzielonym, strom bierze sam, nawet gdy na księgę nie
czeka żadne zadanie. Należą do księgi i wszystkie jej zadania czytają je potem z dysku.

- **Pilnuje kod:**
  - folder jest taki sam jak przy oczekiwaniu na skany, `inbox/<B… tytuł księgi>` ([R9.6](R9-archives.md#R9.6)).
    Tworzy go odnośnik **Otwórz folder** z aplikacji, bez terminala; most pilnuje tylko folderów, które już są;
  - przejęcie: od razu, gdy działa most do aplikacji Strom (plik dopiero po 3 s bez zmian); w przeciwnym razie przy
    starcie kolejnej sesji; albo poleceniem `strom media add --inbox --waiting`. Najpierw foldery czekających zadań,
    potem foldery ksiąg;
  - numer skanu bierze się **tylko z nazwy pliku** (`40.jpg`), nigdy z kolejności. Plik bez numeru zostaje w folderze
    i wypis mówi, ile ich zostało; pozostałe zostają przejęte. Gdy numeru nie ma żaden plik, nie zostaje przejęte nic,
    a badanie mówi, jak pliki nazwać;
  - pliki JPEG 2000 (`.jp2`) z portalu Moravský zemský archiv mają w nazwie skan × 10: strom przelicza je z powrotem.
    Numer, który nie jest wielokrotnością 10, nie jest numerem skanu i plik zostaje w folderze;
  - księga, która jest cała na dysku, znika z propozycji. Pliki, które leżą w folderze i jeszcze nie zostały
    przejęte, aplikacja pokazuje jako „N plików do przejęcia”.
- **Granice:** foldery czekających zadań rządzą się [R9.6](R9-archives.md#R9.6) (tam inaczej nazwane pliki numeruje
  się także według kolejności).
- **Obsługa:** terminal: `strom media add --inbox --waiting`, folder w `strom task books`. Aplikacja: **Otwórz
  folder** przy księdze ([S4.4.4](S4-research-from-the-app.md#S4.4.4)).
- **Obowiązuje od:** badanie 1.35.0

<!-- zdroj: research:b1749433 src/core/inboxwait.ts bookFolders (knihy, které úkoly potřebují, bez čekající složky; nic se nevytváří), imageFileTimesOf (assets/archives.json mza.cz imageFileTimes 10) · edfd2b88 numberBookFiles (jen čísla ze jmen, .jp2 ÷ times, nenásobek → bez čísla, left; žádné číslo → inbox.unnamed), src/commands/media.ts (po čekajících složky knih, book: true, „N file(s) left lying“), src/core/live.ts (live.log) · src/core/inboxwatch.ts (most hlídá i složky knih) · src/commands/links.ts book?tree=&id=&do=folder (mkdir, openForUser, bez terminálu) · src/core/live.ts booksStatus pending · CHANGELOG.cs.md 1.35.0 „Snímky uložené do složky knihy“ · karta prace/1116-vyzkum-105-knihy-c -->

<a id="R6.8.3"></a>
### R6.8.3 Ustawienia ksiąg

Od ilu zadań księga jest proponowana i czy kolejka kontynuuje w tej samej księdze, każde badanie ma swoje.

- **Pilnuje kod:**
  - `books.minTasks`: od ilu zadań księga zostaje zaproponowana ([R6.8](#R6.8)). Liczba całkowita od 1 do 999,
    domyślnie 5;
  - `queue.sameBook`: `no` (domyślnie: agent dostaje tylko zdanie o kolejnych zadaniach księgi) albo `yes` (kolejka
    po sesji w księdze ze skanami na dysku bierze najpierw kolejne zadanie tej samej księgi,
    [R2.2.4](R2-lines-and-queue.md#R2.2.4));
  - zmiana w terminalu pokazuje się w aplikacji i odwrotnie (aplikacja zapisuje przez most tymi samymi poleceniami).
- **Obsługa:** terminal: `strom config set books.minTasks <1–999> --for-tree`,
  `strom config set queue.sameBook yes|no --for-tree`, wartość domyślna `strom config unset … --for-tree`; menu
  **Ustawienia › Archiwa › Księgi z największą liczbą zadań** (**Księga proponowana do ręcznego pobrania od N zadań**,
  **Następna sesja w tej samej księdze**). Aplikacja: **Badanie dla drzewa › Księgi**
  ([S4.4.6](S4-research-from-the-app.md#S4.4.6)).
- **Obowiązuje od:** badanie 1.35.0

<!-- zdroj: research:b1749433 src/core/config.ts BOOKS_MIN_TASKS 5, BOOKS_MIN_TASKS_MAX 999, SETTINGS books.minTasks, queue.sameBook (tree, no|yes), validace „whole number from 1 to 999“ · src/cli/menu-settings.ts booksSettings (1 ui.books.min, 2 ui.books.same), položka Archivy ui.archives.books (poslední) · src/core/live.ts POST /books (config set/unset --for-tree), booksSettings · assets/lang/cs.json ui.books.settings.title, ui.books.min, ui.books.same · CHANGELOG.cs.md 1.35.0 „Knihy v aplikaci Strom a jejich nastavení“ -->
