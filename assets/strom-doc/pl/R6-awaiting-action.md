<a id="R6"></a>
# R6 Czeka na decyzję

Czego badanie potrzebuje od człowieka, gdzie to się pokazuje i jak zadanie po załatwieniu wraca do kolejki. Opisuje
badanie 1.25.2 i aplikację Strom 3.21.2. Zmiany z nowszej wersji mają przy sobie jej numer.

<a id="R6.1"></a>
## R6.1 Co czeka to jedna lista

Wszystko, na co badanie czeka od człowieka, tworzy jedną uporządkowaną listę: zadania ustawione na oczekiwanie, pytania
archiwów, nowe wersje zatwierdzonych opowieści i pytania o miejsca. Terminal pokazuje ponadto to, co załatwia się
tylko w nim. Lista jest za każdym razem obliczana z badania, nic się do niej nie zapisuje.

- **Granice:** zadanie, które czeka tylko na zgodę archiwum i nie ma skanów, należy do pytania archiwum. Badanie, które
  służy jako archiwum, nie ma na liście zadań ani miejsc.
- **Obsługa:** aplikacja: sekcja **Czeka na decyzję** · terminal: menu **Co czeka (n)**, wiersz stanu **Czeka: N** ·
  strona na telefon: **Co czeka · N**.
- **Obowiązuje od:** badanie 1.3.0. Lista według miejsc załatwienia i w aplikacji od 1.14.0 (aplikacja 3.11.0).

<!-- zdroj: research:src/core/waiting.ts:1-12, waitingFor :303-460 (filtr :321), actsAsArchive (v1.15.0) · src/cli/menu.ts:234, :379 · CHANGELOG.cs.md 1.14.0 · app:src/ui/research-overview-ui.ts research.waiting -->

<a id="R6.1.1"></a>
### R6.1.1 Liczba i co jest tylko w terminalu

- Wiersz **Czeka: N (w tym X tylko tutaj w terminalu, Y czeka na odpowiedź)** dzieli liczbę tak jak aplikacja.
  Liczba w aplikacji to N bez pozycji tylko dla terminala i bez wysłanych zapytań.
- Tylko w terminalu są drzewa wysłane z aplikacji (**Aplikacja Strom**), pytania do odczytu skanów (**Odczyt
  skanów**), sprzeczności (**Do rozstrzygnięcia – sprzeczności**, zob. [R5](R5-conflicts.md)), hipotezy do
  rozstrzygnięcia (od badania 1.28.0) i łagodniejsze warunki archiwum. W przeglądzie **Co czeka** idą najpierw pod nagłówkiem **Tylko tutaj w terminalu (nie ma ich w aplikacji
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
- **Obsługa:** terminal: `strom task wait T… --on "<co>" --kind <druh> --to "<komu>" --request notes/<soubor>
  --url <adresa>`, później `strom task edit T… --kind --to --request`.
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
- **Obsługa:** terminal: `strom task wait T… --check <adresa> --on "<co>"`; w **Co czeka** **Co tam jest?**,
  `strom task wake T… --check=works|view|no`.
- **Obowiązuje od:** badanie 1.14.0

<!-- zdroj: research:src/commands/tasks.ts:439-470 checkUrl (task.check-search) · src/core/model.ts:510 CHECK_ANSWERS · src/core/waiting.ts:51-65 SECTION · src/cli/menu-waiting.ts:637 checkSite -->

<a id="R6.3"></a>
## R6.3 Decyzje

Sekcja **decyzje** zbiera pytania, które wstrzymują agenta: zgoda archiwum, programy pobierające do potwierdzenia,
łagodniejsze warunki, witryna do sprawdzenia, opowieść, miejsce (zob. [R4](R4-places.md)), sprzeczność (zob.
[R5](R5-conflicts.md)), hipoteza (zob. [R6.3.4](#R6.3.4)), drzewa z aplikacji i odczyt skanów. Decyzje idą na liście
pierwsze.

- **Obsługa:** terminal: **Co czeka** → pozycja; `strom allow archive --way`, `strom place answer`,
  `strom conflict resolve`, `strom media calibrate --answer`.
- **Obowiązuje od:** badanie 1.14.0. Sprzeczności od 1.20.0, miejsca od 1.25.0, hipotezy od 1.28.0.

<!-- zdroj: research:src/core/waiting.ts:51-65 SECTION, :75 DECIDE_RANK · src/cli/menu-waiting.ts:486 decideConflictHere, :518 decidePlace, :712 decideTune · CHANGELOG.cs.md 1.20.0, 1.25.0 -->

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
- **Granice:** obowiązuje, gdy hipotezy rozstrzyga człowiek (**Rozstrzyga człowiek**, domyślnie;
  [R10.3.2](R10-people-and-hypotheses.md#R10.3.2)); rozstrzyga tylko człowiek ([R6.6](#R6.6)). Przy **Rozstrzyga AI**
  agent rozstrzyga sam to, co potwierdza cytowany akt, i czekają tylko jego propozycje (rozstrzygnięcia, których sam
  podjąć nie może). Grupa jest tylko w terminalu, aplikacja Strom jej nie pokazuje ([R6.1.1](#R6.1.1)). W Archiwum
  Strom tej grupy nie ma.
- **Obsługa:** terminal: **Co czeka** → pozycja, `strom hypothesis decide H… --proposed | --keep-open`. Te same wybory
  są w przeglądzie osoby: **Rozszerz badanie** → **Przegląd osoby** → **Hipotezy o osobie (n)**.
- **Obowiązuje od:** badanie 1.28.0
- **Od badania 1.29.0:** także otwarte hipotezy bez propozycji (**Rozstrzygnąć**, **Zostawić otwartą**), **Zmienić
  rozstrzygnięcie** i wybór **Kto rozstrzyga hipotezy**.

<!-- zdroj: research:src/core/waiting.ts (kind hypothesis, section decide, DECIDE_RANK 0, open: priority -1 a hypothesesOpen jen při person, leftOpen, TERMINAL_ONLY hypotheses, actsAsArchive) · src/cli/menu-waiting.ts decideHypothesis (proposed / open / decided) · src/cli/menu-research.ts:532 · assets/lang/cs.json wait.group.hypotheses, ui.wait.hypothesis.proposed/accept/other/keep/decide/keepOpen/change/byAgent · CHANGELOG.cs.md 1.29.0 -->

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

<!-- zdroj: research:src/core/waiting.ts:73 SECTION_RANK, :75 DECIDE_RANK, :468 together, :478-492 ordered · src/core/waitkind.ts:238 waitGroupOf · assets/lang/cs.json:2313-2320 wait.group.* (:2359) · src/cli/menu-waiting.ts:205-232 · app:strings.ts:11958 waitingFilterLabel -->

<a id="R6.5"></a>
## R6.5 Co można załatwić gdzie

Aplikacja sama zapisuje tylko fakt: zapytanie zostało wysłane, wraca do załatwienia, przyszedł plik z odpowiedzią.
Decyzje i zgody przyjmuje tylko terminal; przyciski, które ich wymagają, otwierają terminal badania na komputerze.

- **Granice:**
  - Aplikacja załatwia sama: **Wysłano** (także za grupę), **Przywróć do załatwienia**, **Dodaj plik** (tylko obrazy
    i PDF), **Treść wszystkich zapytań** i odpowiedź na pytanie o miejsce (okno **Czeka na decyzję · Miejsca**).
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
- **Obsługa:** terminal: **Odpowiedz tekstem** (najwyżej 300 znaków), `strom task wake T… --answer "<text>"`.
- **Obowiązuje od:** badanie 1.14.0. Miejsca od 1.25.0.
- **Od badania 1.26.0:** tylko człowiek także: zatwierdzenie i odrzucenie opowieści (`strom story approve|discard`;
  agentowi badanie odrzuca też `strom story set --final`), odpowiedź na rosnącą gałąź (`strom offline answer`),
  zostawienie sprzeczności ze zmiany agentowi (`strom conflict leave`), cofnięcie i odrzucenie wysłania z aplikacji
  (`strom sync undo|discard`) oraz poprawki `strom fixes … edit-decisions|woken-waits`.
- **Od badania 1.28.0:** tylko człowiek także rozstrzyga hipotezę (`strom hypothesis decide`, także wewnątrz
  `strom batch`); agent ją tylko proponuje ([R10.3.1](R10-people-and-hypotheses.md#R10.3.1)).

<!-- zdroj: research:src/commands/tasks.ts:897-970 (requireHuman :941, task.check-person :932) · src/commands/archives.ts:586-645 · src/commands/calibrate.ts:320 · src/commands/placeid.ts:343 person · assets/method/waiting.md, narrate.md:26-31 · src/cli/menu-waiting.ts:45 ANSWER_MAX · 1.26.0: userOnly u story approve/discard, offline answer, conflict leave, sync undo/discard (commity 4683a22d, 1189532f, 942c56f9), fixes.ts edit-decisions/woken-waits (person at the terminal) · 1.28.0: analysis.ts hypothesis decide (person), batch.ts def.person (commit 9b12256a) -->

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
  `strom intake <soubor> --answers T…`, `strom task wake T… --answer "<text>"`.
- **Obowiązuje od:** badanie 1.3.0 (słowami). Plikiem od 1.14.0.

<!-- zdroj: research:src/commands/intake.ts:164-205 (--answers) · src/core/taskfiles.ts fileRefused · src/commands/tasks.ts:969 answers · src/core/live.ts PUT /media X-Strom-Task -->

<a id="R6.7.2"></a>
### R6.7.2 Kiedy zadanie wraca samo i odłożenie

- Zadanie wraca samo, gdy do badania zapisze się skany księgi, na którą czeka lub którą wymienia, albo gdy archiwum
  dostanie decyzję ([R6.3.1](#R6.3.1)).
- Zadania odłożonego nie ma na liście ani w kolejce. Z datą `--until` wraca samo, otwarte jest już w tym dniu. Bez daty
  czeka, aż ktoś je obudzi. Odłożenie wymaga powodu.
- **Obsługa:** terminal: `strom task park T… --reason "<proč>" --until RRRR-MM-DD`, cofnięcie `strom task wake T…`.
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
