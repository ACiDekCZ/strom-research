<a id="R7"></a>
# R7 Kiedy i jak długo agent pracuje

Jak długo agent badania pracuje sam, kiedy zaczyna się kolejna sesja i dlaczego przebieg się kończy. Opisuje
badanie 1.25.2 i aplikację Strom 3.21.2. Zmiany z nowszej wersji mają przy sobie jej numer.

<a id="R7.1"></a>
## R7.1 Samodzielna praca przebiega sesjami

Przy samodzielnej pracy agent bierze zadania z kolejki ([R2.2](R2-lines-and-queue.md#R2.2)) bez człowieka. Jedna sesja
to jedno zadanie. Przebieg uruchamia jedną lub więcej sesji po kolei; między nimi może pytać warunek ([R7.4](#R7.4)).

- **Granice:**
  - bez opcji 1 sesja; `--max <n>` najwyżej n; `--loop` sesja za sesją, dopóki jest praca;
  - `--task T…`: wybrane zadania w podanej kolejności, każde jedna sesja; zadanie w międzyczasie ukończone lub
    podjęte zostaje pominięte;
  - `--until HH:MM`: potem żadna sesja się nie zaczyna, rozpoczęta dobiega końca. Godzina, która dziś już minęła,
    oznacza jutro;
  - bez otwartego zadania w kolejce każdy przebieg się kończy.
- **Obsługa:** terminal: menu **Pozwól agentowi pracować samodzielnie**, opcje **Praca według kolejki – liczba zadań
  do podania** (1–100, jak `--max`), **Tylko wybrane zadania z listy** (jak `--task`) i **Pozwól mu pracować, dopóki
  jest co robić i pozwala na to warunek „…”** (jak `--loop`, tylko z ustawionym warunkiem); polecenie
  `strom run`. Aplikacja Strom 3.21.2 samodzielnej pracy nie ustawia; pokazuje stan przebiegu ([R7.4](#R7.4)),
  a sesję można z niej dokończyć ([R7.3](#R7.3)).
- **Obowiązuje od:** badanie 1.0.0 (`--max`, `--until`, `--task`), `--loop` od 1.2.0
- **Od badania 1.32.0:** `--tasks <n>` (1–100) kończy się po n załatwionych zadaniach: ukończonych, czekających na
  człowieka, odłożonych lub porzuconych po swojej sesji (także zadania, które przebieg odłożył, bo na nim utknął).
  Nieukończone zadanie, które wraca do kolejki (agent go nie skończył, limit czasu, przerwanie), się nie liczy.
  Najwyżej 2×n sesji. `--tasks` nie łączy się z `--max`, `--loop`, `--task`, `--until` ani z innym wyborem zadań.
  Warunek pyta się raz, jak przy `--max` ([R7.4.1](#R7.4.1)). Praca nad kolejką z linku aplikacji Strom:
  [R7.1.2](#R7.1.2).

<!-- zdroj: research:src/commands/session.ts:737-783 (popis a volby run), :830 max, :694 parseUntil · src/cli/menu.ts:288-375 (v1.25.2) · cs.json ui.menu.run, ui.run.queue, ui.run.pick, ui.run.loop, ui.run.how · 1.32.0: src/commands/session.ts TASKS_MAX=100, SETTLED (done, waiting, parked, dropped), --tasks (max = 2×n, odmítnutí s --max, --loop, --task, --until a dalšími volbami výběru), popis run · CHANGELOG.cs.md 1.32.0 · spec 052 K6.3 -->

<a id="R7.1.1"></a>
### R7.1.1 Dlaczego przebieg się kończy

- Na końcu przebieg wypisuje **N sesji · koniec: …**: **gotowe**, **brak otwartych zadań**, **limit czasu**
  (`--until`), **zatrzymano ręcznie** ([R7.3](#R7.3)), **limit subskrypcji** ([R7.6](#R7.6)), **agent nie jest
  zalogowany** ([R7.7](#R7.7)), odpowiedź warunku ([R7.4](#R7.4)) albo błąd (dowody, awaria agenta, model).
- Gdy pozostałe zadania potrzebują archiwum, które nie odpowiada, przebieg z `--loop` i `--until` czeka
  (**⏸ oczekiwanie do …**), inny się kończy.
- **Obowiązuje od:** badanie 1.0.0; czekanie na archiwum, które nie odpowiada, od 1.22.0
- **Od badania 1.32.0:** przebieg z `--tasks` kończy się **załatwione zadania: N** albo po 2×n sesjach **sesje: …
  (najwięcej dla żądanej liczby zadań) – załatwione zadania: …**.
- **Od badania 1.36.0:** przebieg, któremu zostały tylko zadania w archiwum z ograniczeniami, którego używa inna sesja,
  czeka najwyżej `archive.wait` i kończy się **nic więcej do zrobienia – pozostałe zadania potrzebują archiwum …**
  ([R9.13](R9-archives.md#R9.13)).

<!-- zdroj: research:src/commands/session.ts:853 Stop, :1220-1268, :1277-1285 · cs.json ui.run.summary, ui.run.stop.*, ui.run.asleep.wait · CHANGELOG.cs.md 1.22.0 · 1.32.0: session.ts Stop tasks|sessions, cs.json ui.run.stop.tasks, ui.run.stop.sessions -->

<a id="R7.1.2"></a>
### R7.1.2 Praca nad kolejką z linku aplikacji Strom

- Linkiem `strom-research://work` aplikacja Strom może poprosić o samodzielną pracę agenta nad kolejką: określoną
  liczbę zadań albo pracę, dopóki jest co robić. Link otwiera terminal badania
  ([S4.5](S4-research-from-the-app.md#S4.5)). Terminal pokazuje, co by się uruchomiło, i uruchamia to dopiero po
  „tak”; domyślna odpowiedź to nie.
- **Granice:**
  - terminal pokazuje pierwsze 5 zadań w kolejności, w jakiej bierze je `strom run` (zadanie wybrane **od razu**
    pierwsze), ile jest dalszych, kiedy przebieg się skończy, limit czasu sesji i warunek ([R7.4](#R7.4));
  - liczba zadań 1–100, bez podanej liczby 5. Uruchamia się `strom run --tasks N` ([R7.1](#R7.1)); warunek pyta się
    raz, przed pierwszą sesją;
  - praca, dopóki jest co robić, idzie tylko pod warunkiem i uruchamia `strom run --loop`. Bez ustawionego warunku nic
    się nie uruchamia: terminal proponuje zamiast tego określoną liczbę zadań, ustawienie warunku albo nic
    (domyślnie);
  - gdy nad badaniem już pracuje przebieg lub sesja, nic więcej się nie uruchamia. Przy pustej kolejce też nie. Gdy na
    komputerze brakuje programu agenta dla terminala, terminal mówi to, zanim o cokolwiek zapyta;
  - przebieg idzie w tym samym oknie terminala. Ctrl-C prosi rozpoczętą sesję o dokończenie i zatrzymuje przebieg
    ([R7.3](#R7.3)); reszta zostaje w kolejce;
  - most nie uruchamia pracy agenta, tylko terminal po potwierdzeniu.
- **Obsługa:** link z aplikacji Strom (`strom-research://work` z `do=tasks` i `n` albo `do=loop`), w aplikacji
  3.28.0 **Praca nad kolejką…** ([S4.2.3](S4-research-from-the-app.md#S4.2.3)); terminal:
  `strom link open "<link>"`.
- **Obowiązuje od:** badanie 1.32.0
- **Od badania 1.36.0:** przy **Uruchamianie agenta z aplikacji Strom: bez potwierdzenia** praca uruchamia się bez
  pytania o tak; warunek pyta dalej ([S4.5.5](S4-research-from-the-app.md#S4.5.5)).
- **Od badania 1.36.0:** link może wymienić zadania (`do=tasks` z `task=T…,T…`, tylko numery zadań, najwyżej
  100, nigdy z `n`): **Przetwórz teraz** po próbie weryfikacji ([S7.5.1](S7-reliability-and-verification.md#S7.5.1)).
  Terminal pokaże „Te zadania, w tej kolejności:” i „Jedna sesja na zadanie (N sesji), potem koniec; co nie zostanie
  skończone, wraca do kolejki.” Po „tak” uruchomi `strom run --task` z tymi zadaniami w kolejności linku.
  Zadania, które już nie czekają (zrobione, cofnięte lub zajęte przez innego), pominie i powie ile; gdy nie czeka
  żadne, nic się nie uruchamia.

<!-- zdroj: 1.36.0: research:7116bb60 src/cli/menu-links.ts workOn, src/core/links.ts (task= jen s do=tasks, ne s n, 1–LINK_WORK_MAX) · cs.json ui.link.work.picked.* · research:src/cli/menu-links.ts workRun (WORK_LIST=5, agentCliHere, busyIn, taskQueue s RUN_TURNS, loop jen s run.gate, choose výchozí „Teď nic“, asks … false, run --tasks | --loop) · src/core/links.ts LINK_WORK_DOS, LINK_WORK_MAX=100, LINK_WORK_DEFAULT=5 · src/commands/links.ts case "work" · cs.json ui.link.work.*, ui.link.what.work.*, ui.run.next, ui.run.limit, ui.link.cost · CHANGELOG.cs.md 1.32.0 · spec 052 K6.2 (cesta terminál, most agenta nespouští) -->

<a id="R7.2"></a>
## R7.2 Każda sesja ma limit czasu

Jedna sesja trwa najwyżej ustawioną liczbę minut, domyślnie 60. Agent zna czas końca z góry, a strom mu go przypomina.
Przy limicie strom go zatrzymuje, a nieukończone zadanie przywraca do kolejki.

- **Granice:**
  - przez ostatnie 10 minut (krótka sesja: ostatnią ćwiartkę) każde polecenie `strom` podaje, ile czasu zostało;
    przez ostatnie 3 minuty (krótka sesja: ostatnią ósmą część) wzywa do zapisania znalezisk i zamknięcia sesji;
  - przy limicie agent, który to potrafi (Claude Code, Codex, OpenCode, Grok), dostaje jeszcze 5 minut na zapis
    i zamknięcie;
  - zadanie, przy którym 2 sesje z rzędu nic nie zapisały, zostaje odłożone (**… odłożone**); sesje zakończone
    przez człowieka się nie liczą;
  - kolejność: `--minutes` > zmienna `STROM_RUN_MINUTES` > ustawienie drzewa genealogicznego >
    ustawienie komputera > 60.
- **Obsługa:** terminal: **Ustawienia: agent, praca samodzielna, wiadomości, archiwa, konserwacja → Samodzielna praca
  agenta → Czas na jedno zadanie: N min** (5–600; 0 wraca bez zmian); `strom config set run.minutes <n>`
  (`--for-tree`: tylko to drzewo genealogiczne). Aplikacja: nic.
- **Obowiązuje od:** badanie 1.0.0 (60 minut, odłożenie zadania); przypomnienia i 5 minut na zapis od 1.2.0

<!-- zdroj: research:src/core/config.ts:223 DEFAULT_RUN_MINUTES=60, run.minutes tree:true · src/core/clock.ts REMIND_MS, CLOSE_MS, WRAP_UP_MS, clockLine :103-118 · session.ts:705 MAX_IDLE_SESSIONS=2, :750 popis · src/cli/menu-settings.ts:300-317 (v1.25.2) · cs.json ui.alone.minutes, ui.alone.minutes.ask, ui.run.parked -->

<a id="R7.3"></a>
## R7.3 Sesję można poprosić o dokończenie

Człowiek może poprosić trwającą sesję, aby się zakończyła. Agent nie zaczyna nic nowego, zapisuje, co znalazł,
i zamyka sesję. Potem przebieg się kończy, a kolejna sesja się nie zaczyna. Nic nie jest zatrzymywane siłą.

- **Granice:**
  - agent widzi prośbę przy następnym poleceniu `strom`; nowy czytelnik się nie zaczyna, pracy subagenta strom nie
    zatrzymuje w połowie;
  - Ctrl-C w terminalu przebiegu: za pierwszym razem ta sama prośba, za drugim natychmiastowe zatrzymanie (zadanie
    wraca do kolejki). W Windows i z `--interactive` zatrzymuje od razu pierwsze Ctrl-C.
- **Obsługa:** terminal: `strom session finish [N…]` (gdy trwa więcej sesji, podać które), Ctrl-C. Aplikacja:
  **Przegląd badania**, przy pracującym agencie **Dokończ i zakończ**; potwierdza się w terminalu badania. Gdy
  przebieg czeka na warunek, przycisku nie ma.
- **Obowiązuje od:** badanie 1.8.0, aplikacja 3.5.0
- **Od badania 1.36.0:** przebieg można zatrzymać także z zewnątrz i pojedynczo, `strom run stop <run-…>
  [--finish]`; przy kilku przebiegach każdy ma w aplikacji własne **Dokończ i zakończ** ([R7.10.2](#R7.10.2)).

<!-- zdroj: research:src/commands/session.ts:198-221 session finish, :865 onSignal, :1194 askedToFinish · src/core/clock.ts askFinish, refuseReadersWhenFinishing · runners/runner.ts:296 OWN_GROUP · src/cli/menu-links.ts:473 finishSession · app:v3.21.2 research-overview-ui.ts:810,868 (!w.paused) · strings.ts live.finishSession -->

<a id="R7.4"></a>
## R7.4 Warunek rozstrzyga, czy zacznie się kolejna sesja

Warunek to program, który strom pyta przed sesją: kontynuować, czekać czy zatrzymać. Ustawia go tylko człowiek, dla
całego komputera. Bez warunku przebieg trwa, dopóki jest praca.

- **Granice:**
  - **kontynuować**: sesja się zaczyna; **czekać**: przebieg czeka i pyta ponownie; **zatrzymać**: przebieg się
    kończy. Cokolwiek innego (awaria programu, brak odpowiedzi w ciągu 120 s, `claude-usage` 660 s) jest błędem
    i przebieg się kończy;
  - kiedy zapytać ponownie, mówi warunek; w przeciwnym razie za 15 minut, nigdy wcześniej niż za 1 minutę. Ctrl-C
    kończy czekanie; z `--until` kończy je podana godzina (**limit czasu**);
  - `--loop` i `--until`: pytanie przed każdą sesją; zadania uruchomione ręcznie: jedno pytanie ([R7.4.1](#R7.4.1));
  - strom dostarcza warunek `claude-usage` ([R7.5](#R7.5)); własny warunek to folder `plugins/gates/<nazwa>/`;
  - przebieg bez ustawionego warunku (`--no-gate`) lub z innym (`--gate`) wymaga zgody człowieka.
- **Obsługa:** terminal: **Ustawienia → Samodzielna praca agenta → Praca bez przerwy pod warunkiem: …**
  (warunek albo **brak**); `strom config set run.gate "<nazwa> [co jej przekazać]"`, `strom config unset run.gate`; oba
  potwierdza człowiek. Aplikacja: **Przegląd badania** przy czekającym przebiegu pokazuje **Wstrzymano** i **wznowi
  o …**.
- **Obowiązuje od:** badanie 1.2.0, aplikacja 3.5.0 (stan Wstrzymano)

<!-- zdroj: research:src/core/gate.ts:27-34 DEFAULT_TIMEOUT_S, DEFAULT_WAIT_MS, MIN_WAIT_MS, askGate :209-254, SHIPPED :124 · session.ts:911 gateHolds, :1038-1063 wait, markPaused, runGate :1357-1380 · config.ts run.gate tree:false · setup.ts:1537-1548 · app:v3.21.2 research-overview-ui.ts:340-347, strings.ts live.statePaused, live.pausedUntil -->

<a id="R7.4.1"></a>
### R7.4.1 Zadania uruchomione ręcznie: „Uruchomić mimo to?”

- Jedna sesja, `--max`, `--task` i menu to wybór człowieka. Warunek pyta raz, przed pierwszą sesją. Gdyby nie
  uruchomił (czekać, zatrzymać, błąd), pada pytanie **Warunek „…” teraz by nie uruchomił – …. Uruchomić
  mimo to?** Enter oznacza nie: przebieg się kończy (**nie uruchomiono – warunek „…”: …**). Tak: sesje
  się zaczynają, a warunek dalej nie pyta, z wyjątkiem pułapu ([R7.4.2](#R7.4.2)).
- Gdy przebieg uruchamia agent, odpowiada człowiek w oknie systemowym. Skrypt, którego nikt nie może zapytać,
  trzyma się warunku.
- **Obowiązuje od:** badanie 1.2.0

<!-- zdroj: research:src/commands/session.ts:1027-1037, startAnyway :1400-1411 · cs.json ui.run.gate.once, ui.run.gate.anyway, ui.run.stop.gate.declined -->

<a id="R7.4.2"></a>
### R7.4.2 Pułap: sztywna granica

- Warunek może oznaczyć odpowiedź jako sztywną granicę człowieka (`hard`). Przebieg się wtedy kończy (**pułap warunku
  „…”**) i żadne „mimo to” jej nie przekroczy.
- Warunek może pilnować okna planu agenta (`watch`). Wtedy pyta przed każdą sesją każdego przebiegu, a sesja w toku
  dostaje prośbę o dokończenie ([R7.3](#R7.3)), gdy agent zgłosi wykorzystanie okna na podanej granicy.
- **Obowiązuje od:** badanie 1.14.0

<!-- zdroj: research:src/core/gate.ts:64-71 hard, watch, parseSaid :330-348 · session.ts:1012-1026, onLimits :1175-1182 · cs.json ui.run.gate.cap, ui.run.cap.finish, ui.run.stop.gate.cap -->

<a id="R7.4.3"></a>
### R7.4.3 Zapis odpowiedzi warunku

- Każda odpowiedź ma wiersz w wydruku przebiegu: **· warunek …: … (kod …; .strom/gate.log)**: nazwa warunku, jego
  odpowiedź z powodem i kod.
- Jednocześnie wiersz JSON w `.strom/gate.log` drzewa genealogicznego: kiedy, warunek i co mu przekazano, kod, werdykt,
  powód, czekanie, limity planu i co zrobił przebieg (`go`, `wait`, `stop`, `anyway`). Przechowuje się 90 dni,
  najwyżej 2 MB.
- **Obsługa:** terminal: **Samodzielna praca agenta → Co powiedziałby warunek teraz?**, `strom gate test`.
- **Obowiązuje od:** badanie 1.14.0 (zapis); pytanie z menu od 1.3.0

<!-- zdroj: research:src/core/gate.ts GATE_LOG, GateRecord :264-287, recordGate :311 · session.ts:1003-1007, :1069-1078 · src/core/tidy.ts:49 gate {days: 90, bytes: 2 MB} · menu-settings.ts:432-452 (v1.25.2) -->

<a id="R7.5"></a>
## R7.5 Warunek claude-usage trzyma tempo tygodnia

`claude-usage` utrzymuje samodzielną pracę w tygodniowym limicie subskrypcji Claude. Porównuje, ile procent tygodnia
upłynęło od jego odnowienia (dzień ≈ 14,3 %), z wykorzystaniem tygodnia. Sesja zaczyna się tylko wtedy, gdy zapas
(upłynęło − wykorzystano) wynosi co najmniej podaną liczbę n.

- **Granice:** kroki idą w tej kolejności, rozstrzyga pierwszy, który obowiązuje:
  1. n nie jest liczbą całkowitą 0–99 albo pułap nie jest liczbą całkowitą 1–100: zatrzymać (każdy przebieg);
  2. agent nie jest Claude Code albo Claude Code działa na kluczu API: kontynuować;
  3. wykorzystanie ze zgłoszenia agenta w tym przebiegu (najwyżej sprzed 15 minut), w przeciwnym razie
     z `claude -p /usage`. Nie da się odczytać: 3 próby co 30 s, potem czekać 15 minut. Claude Code nie jest
     zalogowany: zatrzymać ([R7.7](#R7.7));
  4. tydzień bez czasu odnowienia: wykorzystano 0 % → kontynuować, w przeciwnym razie czekać 15 minut;
  5. wykorzystano ≥ pułap: zatrzymać, sztywnie ([R7.5.4](#R7.5.4));
  6. pięciogodzinne okno wyczerpane (100 %): czekać do jego odnowienia i 1 minutę;
  7. zapas ≥ potrzeba ([R7.5.1](#R7.5.1)), po czekaniu z dodatkiem ([R7.5.2](#R7.5.2)): kontynuować;
  8. ostatnie 2 godziny przed odnowieniem tygodnia, a do 100 % (lub do pułapu) zostaje co najmniej 10 punktów:
     kontynuować;
  9. w przeciwnym razie czekać ([R7.5.3](#R7.5.3)).
- **Obsługa:** terminal: **Praca bez przerwy pod warunkiem** → **Claude usage** → podać n (proponuje 10; tylko
  z Claude Code na komputerze); `strom config set run.gate "claude-usage 10"`. Bez liczby obowiązuje 0.
- **Obowiązuje od:** badanie 1.2.0; nieczytelne wykorzystanie i brak zalogowania od 1.25.2
- **Od badania 1.26.0:** menu i `strom config set` przyjmują tylko całkowite n 0–99 (w 1.25.2 także dziesiętne, które potem
  zatrzymuje przebieg).

<!-- zdroj: research:assets/plugins/gates/claude-usage/gate.ts (v1.25.2 = HEAD) :209-312, FRESH_MS, ATTEMPTS=3, RETRY_MS=30 s, UNREAD_WAIT=15 min, AFTER_RESET=60 s, END_WINDOW=2 h, SESSION_POINTS=10 · gate.json timeout 660 · menu-settings.ts:322-357 (v1.25.2) · HEAD src/core/gate.ts pointsProblem -->

<a id="R7.5.1"></a>
### R7.5.1 Początek tygodnia

- Potrzeba to mniejsza z liczb n i połowa upłyniętej części tygodnia; pełne n obowiązuje od 2·n % tygodnia. Zaraz po
  odnowieniu sesja się zaczyna. Przykład: n = 10, upłynęło 12 % → potrzeba 6; sesja zaczyna się przy wykorzystaniu
  najwyżej 6 %.
- **Obowiązuje od:** badanie 1.15.0

<!-- zdroj: research:assets/plugins/gates/claude-usage/gate.ts:280 need = min(min, gone/2) · CHANGELOG.cs.md 1.15.0 -->

<a id="R7.5.2"></a>
### R7.5.2 Dodatek po czekaniu

- Gdy warunek czekał z powodu małego zapasu, puszcza ponownie dopiero z dodatkiem 2 punktów (przy 15: zapas 17), na
  początku tygodnia proporcjonalnie mniejszym (2 · potrzeba / n). Potem puszcza sesje po kolei, dopóki zapas nie
  spadnie poniżej potrzeby.
- Tydzień czekania zapamiętuje w `hold.json` w swoim folderze; nowy tydzień zaczyna się bez dodatku.
- **Obowiązuje od:** badanie 1.22.0

<!-- zdroj: research:assets/plugins/gates/claude-usage/gate.ts RESERVE=2 :71, reserve :287, holding/hold :368-387 · CHANGELOG.cs.md 1.22.0 -->

<a id="R7.5.3"></a>
### R7.5.3 Jak długo czeka

- Do pierwszej z chwil: tydzień dogoni zapas z dodatkiem; zaczną się ostatnie 2 godziny tygodnia (tylko gdy do 100 %
  lub do pułapu zostaje co najmniej 10 punktów); tydzień się odnowi (i 1 minuta). Nigdy poza odnowienie, zawsze co
  najmniej 5 minut.
- Odpowiedź podaje wykorzystanie, upłyniętą część, zapas i na jaki zapas czeka.
- **Obowiązuje od:** badanie 1.2.0; ostatnie 2 godziny od 1.15.0

<!-- zdroj: research:assets/plugins/gates/claude-usage/gate.ts:294-312 (caught, last, after, now + 5 min), T.cs head, hold -->

<a id="R7.5.4"></a>
### R7.5.4 Pułap tygodnia

- `claude-usage 10 --cap 95`: przy wykorzystaniu tygodnia 95 % i więcej żadna sesja się nie zaczyna, w żadnym
  przebiegu ani po „Uruchomić mimo to?”. Przebieg się kończy i podaje wykorzystanie oraz kiedy tydzień się odnowi.
- Pyta przed każdą sesją każdego przebiegu ([R7.4.2](#R7.4.2)). Rozpoczęta sesja dostaje prośbę o dokończenie dopiero
  przy 99 % tygodnia, nawet gdy pułap jest niższy. `--cap` bez n: obowiązuje pułap i tempo z n = 0.
- **Obsługa:** terminal: `strom config set run.gate "claude-usage 10 --cap 95"`. Menu w 1.25.2 pułapu nie przyjmuje,
  od 1.26.0 tak.
- **Obowiązuje od:** badanie 1.14.0
- **Od badania 1.26.0:** rozpoczęta sesja dostaje prośbę o dokończenie już przy pułapie (`--cap 95`: przy 95 %
  tygodnia; `--cap 100`: przy 99 %).

<!-- zdroj: research:assets/plugins/gates/claude-usage/gate.ts:213-219 --cap, :271-272 cap hard, FINISH_AT=0.99 :54, answer() watch :204 · src/core/gate.ts capProblem :159 · menu-settings.ts:350 (v1.25.2) · 1.26.0: gate.ts finish min(0.99, cap/100) (commit 6276a16f) -->

<a id="R7.6"></a>
## R7.6 Limit subskrypcji zatrzymuje przebieg

Gdy agent w trakcie sesji natrafi na limit swojej subskrypcji, sesja się zamyka, a przebieg się kończy: **limit
subskrypcji (odnowi się …)**. Do badania 1.33.0 przebieg nie czeka nawet z `--loop` i nie zależy to od warunku; od
1.34.0 zob. niżej.

- **Granice:** zadanie wraca do kolejki; czas odnowienia pokazuje się tylko wtedy, gdy podał go agent. Czekać potrafi
  tylko warunek.
- **Obowiązuje od:** badanie 1.0.0
- **Od badania 1.34.0:** przebieg, który trwa sam (`--loop`, `--until`) i ma warunek ([R7.4](#R7.4)), po limicie się
  nie kończy. Zadanie wraca do kolejki (jako następne może przyjść inne), przebieg czeka do odnowienia limitu i minutę
  dłużej, potem ponownie pyta warunek i pracuje dalej. Terminal: „⏸ limit planu agenta wyczerpał się (okno
  pięciogodzinne) – oczekiwanie do jego odnowienia (…), potem ponowne pytanie warunku i praca idzie dalej (Ctrl-C
  kończy przebieg)”; aplikacja Strom pokazuje przebieg jako wstrzymany z powodem.
  - czas odnowienia: z informacji agenta o wyczerpanym oknie planu (okno pięciogodzinne, tydzień; wyczerpane oba:
    późniejsze z nich), w przeciwnym razie z czasu, który podał agent (data i godzina, „in 2 hours”, „7pm” tylko
    w strefie czasowej komputera). Czasu za więcej niż 8 dni ani w przeszłości się nie bierze. Nieznany czas:
    przebieg czeka 15 minut („…, czas odnowienia nieznany – oczekiwanie do …, potem ponowne pytanie warunku”);
  - odnowienie dopiero po czasie `--until`: przebieg kończy się **limit czasu**;
  - sesja przerwana limitem nie liczy się zadaniu jako niepowodzenie agenta;
  - bez zmian: przebieg ręczny (jedno zadanie, `--tasks n`, `--max` bez `--loop`) i przebieg bez warunku kończą się
    **limit subskrypcji** jak dotąd. Komunikat Claude Code „You've hit your limit · resets …” i odmowa agenta z powodu
    limitu są traktowane jako limit.
- **Od badania 1.36.0:** limit, na który trafi jeden przebieg, wstrzymuje nowe sesje wszystkich przebiegów tego
  samego agenta na komputerze ([R7.10.3](#R7.10.3)).

<!-- zdroj: research:src/commands/session.ts:1196-1206 closeSession (session.limit), :1255-1259 · src/core/session.ts:248-262 · runners/runner.ts:226 looksLikeLimit · cs.json ui.run.stop.limit, ui.run.stop.resets · 1.34.0: research:8f24e9f7 src/commands/session.ts:1453-1483 (gateHolds && gate, limitResume, limitReserve, DEFAULT_WAIT_MS 15 min, until → time, markPaused), :1363 metrics.limit, src/core/planlimit.ts limitResume, timeOf, LIMIT_RESERVE_MS 60 s, FURTHEST_MS · 03146702 (B8: „You've hit your limit“, odmítnutý rate_limit_event) · cs.json ui.run.limit.wait, ui.run.limit.unknown, ui.run.limit.why, ui.run.limit.five_hour, ui.run.limit.seven_day · dirigent:prace/1115-vyzkum-k036-limit-obnova -->

<a id="R7.7"></a>
## R7.7 Niezalogowany agent

Agent, który nie jest zalogowany do swojej subskrypcji, nie przeprowadzi sesji. Przebieg się kończy: **agent nie jest
zalogowany – raz uruchomić … i się zalogować**.

- **Granice:**
  - przed pierwszą sesją strom sprawdza to przy Claude Code: do badania 1.33.0 tylko z osobnym folderem
    (`agent.claudeConfigDir` lub `CLAUDE_CONFIG_DIR`, innym niż `~/.claude`), od 1.34.0 także z domyślnym. Przebieg
    kończy się wtedy bez sesji i bez pytania warunku;
  - w przeciwnym razie rozpoznaje to warunek `claude-usage` (zatrzymuje; przy przebiegu ręcznym pada **Uruchomić
    mimo to?**, [R7.4.1](#R7.4.1)) albo sesja, która kończy się błędem logowania.
- **Obowiązuje od:** badanie 1.25.2; zatrzymanie po sesji z błędem logowania od 1.0.0
- **Od badania 1.34.0:** Claude Code w terminalu, który strom uruchamia sam (praca samodzielna, czytelnicy skanów
  i dokumentów, [R8.3](R8-reading-scans.md#R8.3)), ma własne logowanie, nie logowanie aplikacji Claude. Gdy
  `claude auth status` powie, że nie jest zalogowany:
  - `strom read` i inne czytanie przez czytelników (wycinki, transkrypcje, dokument z aplikacji) nie uruchomią
    żadnego czytelnika i od razu się kończą: **Claude Code w terminalu nie jest zalogowany – … uruchamia go sam (nie
    aplikacja Claude, która ma własne logowanie)**, ze wskazówką **raz zalogować się w terminalu: …, potem /login**;
  - czytelnik, który skończy się błędem logowania, mówi to ze wskazówką logowania, w trakcie i w podsumowaniu,
    nigdy tylko „auth“;
  - `strom doctor` ma własny wiersz **logowanie Claude Code**: **Claude Code w terminalu zalogowany** albo
    ostrzeżenie **Claude Code w terminalu nie jest zalogowany – …** z poprawką **… w terminalu, potem /login**.
    W archiwum Stromu logowanie nie jest sprawdzane ani podawane.

  Odpowiedź, z której logowania nie da się poznać, niczego nie rozstrzyga. Terminal: `claude`, potem `/login`;
  `strom doctor`.
- **Od badania 1.35.0:** sprawdzenie logowania, które nie odpowie w ciągu 5 s, niczego nie rozstrzyga i kończy
  wszystko, co uruchomiło, także w Windows, gdzie program agenta mógł wcześniej działać dalej.

<!-- zdroj: research:src/commands/session.ts:916 loggedOut, :1260-1264 auth · src/core/claudedir.ts claudeConfigSet :33, forClaude, claudeLoggedIn :91 · gate.ts:253-258 loggedIn · CHANGELOG.cs.md 1.25.2 · 1.34.0 (K040): src/core/agentcli.ts requireClaudeLogin, agentLoggedOut (agent.logged-out) · src/commands/readers.ts refuseReadersLoggedOut, readerAuthSaid · src/commands/read.ts · src/commands/session.ts loggedOut bez claudeConfigSet · src/commands/setup.ts doctor login (ne v archivu) · assets/lang/*.json ui.read.auth, ui.doc.login*, ui.error.agent.logged-out* · CHANGELOG 1.34.0 · 1.35.0: research:bb79ee54 src/core/claudedir.ts AUTH_STATUS_MS 5000, claudeLoggedIn přes src/core/runsync.ts runSync (win32 taskkill /T /F, jinde skupina procesů) · CHANGELOG.cs.md 1.35.0 „Windows: po kontrole přihlášení nic neběží dál“ -->

<a id="R7.8"></a>
## R7.8 Archiwum Strom: badanie, nad którym agent nie pracuje

Badanie może być tylko **Archiwum Strom**: dane wprowadza się w aplikacji Strom, a badanie przechowuje je razem ze
źródłami, oryginałami i historią. Agent nad nim nie pracuje i niczego nie bada. Archiwum włącza i wyłącza tylko
człowiek, w obie strony; nic się przy tym nie usuwa.

- **Pilnuje kod:**
  - praca agenta jest w archiwum odrzucana: rozmowa (`strom chat`), samodzielna praca, nowa linia, przegląd osoby,
    odczyt skanów (`strom read`, `strom clips`, `strom transcripts`), odczyt dokumentu, identyfikacja miejsc. Odmowa
    mówi jednym zdaniem, gdzie włącza się badanie;
  - przełączenie na archiwum odkłada otwarte, rozpoczęte i czekające zadania z powodem „odłożone: badanie jest
    Archiwum Strom”. Nowe zadanie w archiwum czeka odłożone. Po włączeniu badania zadania wracają tam, gdzie były: do
    kolejki albo z powrotem do czekania na człowieka;
  - na archiwum nie można przełączyć, dopóki ktoś pracuje nad badaniem. Sesja najpierw dobiega końca;
  - włączenie badania bez agenta na komputerze proponuje instalację agenta. Bez agenta archiwum zostaje takie, jakie
    było;
  - przełączenie potwierdza człowiek; agent go nie wykona.
- To, co aplikacja wyśle do archiwum, zapisuje się tak, jak przyjdzie: [S2.4](S2-edits-from-the-app.md#S2.4). Jak
  archiwum pokazuje aplikacja: [S1.3](S1-connecting-app-and-research.md#S1.3).
- **Dlaczego:** archiwum jest dla drzewa genealogicznego bez agenta AI: dane z aplikacji mają swoją historię, źródła
  i kopię zapasową (`strom pack`), a za odczyt nic się nie płaci (kod, CHANGELOG 1.20.0).
- **Obsługa:** terminal: menu badania, pierwsza pozycja; `strom mode` (pokazuje), `strom mode archive`, `strom mode
  research`. O nowe badania pyta `strom setup` (**Czym ma być nowe badanie na tym komputerze?**); zmienia to
  **Ustawienia → Nowe badania: badanie czy tylko Archiwum Strom**.
- **Obowiązuje od:** badanie 1.12.0; wybór dla nowych badań także z agentem na komputerze 1.15.0; odrzucony odczyt
  skanów 1.20.0

<!-- zdroj: research:src/core/mode.ts (hlavička, switchMode, holdForArchive, heldInArchive) · research:src/core/state.ts refuseInArchive · research:src/commands/trees.ts strom mode (liveWorkers, agentReady, requireHuman "mode") · refuseInArchive v session.ts:805 (run), start.ts (chat), research.ts (research new, review), document.ts, placeid.ts, calibrate.ts · cs.json archive.held, ui.mode.*, ui.archive.refuse · CHANGELOG 1.15.0, 1.20.0 · switchMode od v1.12.0 -->

<a id="R7.8.1"></a>
### R7.8.1 Badanie czeka na agenta

Badanie, którego agenta nie ma na tym komputerze (niezainstalowany albo badanie przeniesione z innego komputera), czeka
na niego. Do tego czasu zachowuje się jak Archiwum Strom.

- **Pilnuje kod:**
  - to, co wyśle aplikacja, zapisuje się jak w archiwum; agent nic nie dostaje, a praca agenta jest odrzucana
    ze zdaniem, że badanie czeka na agenta, i gdzie go zainstalować albo wybrać innego;
  - zapisany tryb się nie zmienia, a zadania, które badanie miało, nie są odkładane. Po instalacji agenta badanie samo kontynuuje
    z zadaniami, które miało;
  - agent, który właśnie pracuje w badaniu (także inny niż ustawiony), czyni je badaniem.
- **Dlaczego:** archiwum to wybór człowieka i strom go za niego nie zapisze. Badanie bez agenta tylko zachowuje się
  jak archiwum, więc po instalacji agenta samo kontynuuje z zadaniami, które miało.
- **Obsługa:** terminal: menu, pierwsza pozycja (**Zostaw tylko jako Archiwum Strom: przechowywanie danych z aplikacji
  Strom** albo instalacja agenta); `strom mode` pokazuje stan. Aplikacja pokazuje takie badanie jako **Archiwum**
  ([S1.3](S1-connecting-app-and-research.md#S1.3)).
- **Obowiązuje od:** badanie 1.15.0; 1.35.0: nowe zadania odłożone
- **Od badania 1.35.0:** zadanie, które w międzyczasie przyjdzie (do wysłanego materiału, skan do odczytania), powstaje
  odłożone jak w archiwum. Do kolejki wraca, gdy tylko agent zacznie pracować nad badaniem (początek sesji,
  `strom run`, czat; także inny niż ustawiony), albo gdy ustawiony agent jest znów na komputerze.

<!-- zdroj: research:src/core/state.ts (hlavička, stateOf, actsAsArchive, kindOf, refuseInArchive agent.missing) · cs.json ui.mode.is.waiting, ui.waiting.refuse, ui.menu.keeparchive · CHANGELOG 1.15.0 · 1.35.0: research:31def74a src/core/state.ts heldWhereNobody (parked, heldBy archive, waiting.held), settleWaiting (atWork: session start, run, chat; jinak stateOf research) · src/core/records.ts create · CHANGELOG.cs.md 1.35.0 „Rodinný materiál … odložený, dokud tu agent není“ -->

<a id="R7.9"></a>
## R7.9 Zadanie trzyma sesja, która nad nim pracuje

Nad jednym badaniem może pracować naraz kilku agentów: samodzielna praca (`strom run`), rozmowa (`strom chat`), agent,
który wywołuje `strom` bezpośrednio w swoim terminalu, a także inny komputer nad tym samym badaniem. Zadanie ma zawsze
tylko jednego wykonawcę: trzyma je otwarta sesja, dopóki jej agent daje znak życia. Porzucone zadanie zwalnia się samo.

- **Pilnuje kod:**
  - wybór zadania i jego zajęcie odbywają się naraz. Gdy o to samo zadanie starają się dwaj, dostaje je jeden; drugi
    bierze następne wolne. Dotyczy to `strom run`, `strom chat`, `strom session start`, `strom task start`, linku
    z aplikacji Strom i agenta, który pracuje bezpośrednio;
  - znak życia: proces przebiegu lub rozmowy, który uruchomił strom, na tym komputerze; inaczej każde polecenie
    `strom` tej sesji. Agenta, który pracuje bezpośrednio, badanie rozpoznaje po numerze jego rozmowy (Claude Code,
    Codex…): dwaj tacy agenci mają każdy swoją sesję;
  - bez znaku życia dłużej niż `task.hold` (domyślnie 30 min) trzymanie wygasa. Gdy proces trzymającego na tym
    komputerze się zakończył, wygasa od razu;
  - wygasłą sesję przejmuje tylko jeden chętny. Stara sesja zostaje zamknięta jako przerwana z notatką „przejęte po
    N minutach bez oznak życia; rozpoczęta praca w N…”; to, co w niej zapisano, zostaje, a zadanie wraca do kolejki;
  - stary trzymający, który obudzi się po przejęciu (uśpiony komputer, zatrzymany proces), nic już nie zapisze:
    polecenie zapisujące zostaje odrzucone i mówi, która sesja przejęła zadanie i kiedy. Czytać może dalej. `strom
    task done` i inne zapisy do zadania, które trzyma inna sesja, zostają odrzucone;
  - kto chce zadanie, które trzyma inna sesja, dostaje jedno zdanie: „T12 trzyma Claude Code (sesja N0040) od 14:05,
    ostatnio 14:31; zwolni się najpóźniej o 15:01.” Gdy trzyma je żywy proces na tym komputerze, zamiast godziny
    stoi „zwolni się, gdy skończy”. `strom run` bierze następne wolne zadanie, `strom session start T…` zostaje
    odrzucone z propozycją następnego (`strom task next`). Na zwolnienie się nie czeka;
  - `strom run` przejmuje wygasłe sesje na początku każdej sesji i pomija zadania, które trzyma inna sesja („T12
    pominięte: pracuje nad nim inny agent”).
- **Tylko metodyka:** agent, który pracuje bezpośrednio, wydaje polecenie `strom` co najmniej raz na 20 minut; długie
  czytanie skanów bez niego zwolniłoby zadanie.
- **Granice:**
  - czas pochodzi z tego samego komputera; przy badaniu na wspólnym dysku z innego komputera rozstrzyga tylko ostatni
    znak życia. Przy przesuniętych zegarach rezerwacja trzyma raczej dłużej, nigdy się nie podwoi;
  - starszy strom obok tego zadań nie trzyma: jego sesje nowy strom ocenia według jego przebiegu i ostatniego zapisu,
    inaczej od początku sesji;
  - nic z tego nie jest w danych badania; trzymanie to tylko lokalny stan obok badania.
- **W aplikacji:** kto trzyma zadanie i do kiedy, pokazuje Przegląd badania
  ([S4.1](S4-research-from-the-app.md#S4.1), [S4.2](S4-research-from-the-app.md#S4.2)).
- **Obsługa:** terminal: `strom config set task.hold <minuty>` (np. `45m`, `2h`; od 5 min do 24 h, obowiązuje dla tego
  komputera, nie dla jednego badania), `strom task next`; menu pokazuje w wierszu o pracy także agentów, którzy
  pracują bezpośrednio („Agent pracuje teraz bezpośrednio w badaniu.”).
- **Obowiązuje od:** badanie 1.36.0

<!-- zdroj: research:1e58aa7b, f08b6574, 23b20c27 src/core/holds.ts (Hold by run|chat|agent, agentSession, BEAT_MS 60 s, holdAlive: proces tady mrtvý → hned, jinak lastSign < task.hold; lastSign max(beat, mtime), budoucnost jako teď; sessionLife: bez holdu worker, run.lock, ops logy, jinak start) · src/core/session.ts claimTask, takeOver (session.taken: „převzato po … bez známky života; rozdělaná práce v …“), :574 session.taken · src/core/errors.ts:122 task.held, task.held.here · src/commands/session.ts:217-225 (session start: sign of life, at least once every 20 minutes, task.held), :985-997 (run: vynechá držené, převzetí na začátku sezení) · src/brief/brief.ts:1668, src/commands/guide.ts:152 (aspoň jednou za 20 minut) · src/core/config.ts:242-246, :335 task.hold (tree: false, 5 min–24 h, výchozí 30) · ověřeno: strom config set task.hold 3 / 25h / --for-tree odmítnuto (izolovaně) · cs.json ui.error.task.held(.here), ui.error.session.taken, ui.run.skip.held, ui.menu.working.direct(.more), session.taken · CHANGELOG.cs.md 1.36.0 „Více agentů a výzkumů najednou“ · dirigent:spec/127 K1.1–K1.5, K5.1–K5.3, navrh-rezervace.md kap. 1–4, 6 -->

<a id="R7.10"></a>
## R7.10 Przebieg linii: każda linia może mieć własny przebieg

Samodzielną pracę ([R7.1](#R7.1)) można uruchomić dla jednej linii (`strom run --research G…`). Każda linia ma
najwyżej jeden przebieg. Przebiegi różnych linii i przebieg całej kolejki pracują obok siebie, każdy nad innymi
zadaniami.

- **Pilnuje kod:**
  - przebieg linii trzyma swoją linię, dopóki żyje jego proces. Drugi przebieg tej samej linii zostaje od razu
    odrzucony jednym zdaniem: „Linia Przodkowie Jana Horáka ma już przebieg (od 14:05) – jedna linia, jeden przebieg.
    Zatrzymać go można w jego oknie.”;
  - przebieg linii bierze zadania, których główną linią jest jego linia. Główna linia zadania to jego własna linia,
    a gdy ta się zakończyła, najwęższa aktywna linia jego ludzi ([R2.1.3](R2-lines-and-queue.md#R2.1.3)). Bierze też
    zadania wspólne (wspólny przodek, pomoc innej linii, [R2.3](R2-lines-and-queue.md#R2.3)), których główna linia
    nie ma własnego przebiegu. Zadania, którego główną linię trzyma inny przebieg, nie bierze nigdy;
  - przebieg całej kolejki pomija każde zadanie linii z własnym przebiegiem, a także zadanie wspólne, którego ludzie
    należą do takiej linii. Praca poza liniami, historia miejsc i miejsca zostają przy nim;
  - ocenia się to przy każdym wyborze zadania, zanim zadanie zostanie zajęte ([R7.9](#R7.9)). Zadania, nad którym
    pracuje już inna sesja, się nie przejmuje: rozpoczęta sesja je dokończy;
  - rozmowy (`strom chat`) nie trzymają linii i nie liczą się do przebiegów ([R7.10.1](#R7.10.1));
  - przebieg linii nie uruchomi się obok przebiegu strom starszego niż 1.25. Obok przebiegu nowszego strom, który
    nie zna linii, uruchomi się i powie to: tamten może wziąć także zadania tej linii, ale nigdy tego, nad którym się
    pracuje.
- **Granice:**
  - przebieg linii ma własne okno terminala z tytułem „Strom · Horákowie · Przodkowie Jana Horáka (G0002)”; agent
    nazywa swoją sesję według linii. W tym czasie z menu można uruchomić przebieg innej linii;
  - okno tej samej linii nie otworzy się ponownie zaraz po pierwszym („Okno dla linii … otworzyło się przed chwilą –
    przebieg trwa tam.”);
  - tylko aktywna linia: przebiegu nie dostanie ani linia wstrzymana, ani zakończona
    ([R2.1.2](R2-lines-and-queue.md#R2.1.2));
  - badanie pamięta agenta, z którym linia pracowała ostatnio, i proponuje go następnym razem w menu i w aplikacji;
  - ostrzeżenie przy przebiegu obok innego przebiegu mówi, że zużycie subskrypcji się sumuje.
- **W aplikacji:** **Uruchom agenta na tej linii** ([S4.3.3](S4-research-from-the-app.md#S4.3.3)); przebiegi
  w sekcji **Teraz** ([S4.1.8](S4-research-from-the-app.md#S4.1.8)).
- **Obsługa:** terminal: menu **Pozwól agentowi pracować samodzielnie**; przy dwóch i więcej aktywnych liniach pyta
  **Nad czym ma pracować agent?**: **Kolejka zadań – następne: <jej pierwsze zadanie>** (linia z własnym przebiegiem
  tylko jako uwaga za nią) albo jedna linia badania we własnym oknie (w niej linie; linia z przebiegiem „– ma już
  przebieg” i się nie uruchomi). Polecenie `strom run --research G…` (z pozostałymi
  opcjami z [R7.1](#R7.1)); numery linii pokazuje `strom research list`.
- **Obowiązuje od:** badanie 1.36.0; kolejka najpierw z tym, co następne, od 1.38.0

<!-- zdroj: research:089875ec src/core/linerun.ts (lineHolds .strom/lines/<G>.json zámek s procesem, run.line.held, run.line.older pro strom před 1.25, lineRunFilter: obecný běh vynechá úkol s linií drženou jiným během; běh linie bere hlavní linii G nebo úkoly v G, jejichž hlavní linii nedrží jiný běh; linie úkolu = vlastní + hlavní (placer core/offline.ts) + linie jeho lidí; mimo linie, dějiny, místa žádnou; rememberLineAgent) · src/cli/menu.ts runMenu (ui.run.where, ui.run.whole, ui.run.line.item/busy/held, openInNewTerminal title Strom · strom · linie (G…), key linie, ui.run.window, ui.run.window.recent; dějiny jen celá fronta) · src/commands/session.ts:1107 enterRun (research, agent) · cs.json ui.run.line, ui.run.line.older, ui.run.beside, ui.run.others · help run (Runs of lines) · CHANGELOG.cs.md 1.36.0 · dirigent:spec/126 U11, prace/1121-research-126-linie-b1 -->

<a id="R7.10.1"></a>
### R7.10.1 Najwyżej przebiegów naraz: `run.parallel`

W jednym drzewie pracuje naraz najwyżej `run.parallel` przebiegów (domyślnie 3, 1–10): przebieg całej kolejki
i przebiegi linii razem. Rozmowy się nie liczą.

- **Pilnuje kod:**
  - liczy się przy starcie przebiegu, pod krótką blokadą linii drzewa. Przebieg ponad limit zostaje odrzucony i mówi,
    które przebiegi pracują i jak je zatrzymać;
  - zwiększyć wartość może tylko człowiek: `strom config set run.parallel <n>` pyta „Pozwolić na maksymalnie N
    przebiegów agenta naraz w jednym drzewie (teraz M)? Każdy przebieg zużywa subskrypcję agenta – zużycie się
    sumuje.” Agent wartości nie zwiększa. Zmniejszyć ją może każdy, także aplikacja
    ([S4.4.12](S4-research-from-the-app.md#S4.4.12));
  - zmniejszenie poniżej liczby trwających przebiegów żadnego nie zatrzyma; nowy przebieg uruchomi się, gdy będzie ich
    mniej.
- **Granice:** ustawienie obowiązuje dla tego komputera, nie dla jednego drzewa.
- **Obsługa:** terminal: `strom config set run.parallel <n>`, z powrotem `strom config unset run.parallel`.
- **Obowiązuje od:** badanie 1.36.0

<!-- zdroj: research:089875ec src/core/linerun.ts (run.parallel, hint strom config set run.parallel <n>, rozhovory se nepočítají) · src/core/config.ts run.parallel (tree: false, DEFAULT_RUN_PARALLEL 3, RUN_PARALLEL_MAX 10, „only you raise it“) · src/commands/setup.ts runsDecision (requireHuman jen při zvýšení), cs.json ui.consent.runParallel · src/core/live.ts runsLimitWrite (POST settings/runs: snížení, zvýšení 403 runs.raise s příkazem, mimo 1–10 400 runs.max) · src/core/liveruns.ts runLimits · help run -->

<a id="R7.10.2"></a>
### R7.10.2 Zatrzymanie jednego przebiegu

Każdy przebieg można zatrzymać osobno; pozostałe przebiegi pracują dalej. Zatrzymanie niczego nie przerywa siłą.

- **Granice:**
  - `strom run stop <run-…>`: rozpoczęta sesja dokończy swoje zadanie i następna się nie uruchomi. Z `--finish`
    rozpoczęta sesja zostaje ponadto poproszona, by od razu skończyła: agent zapisze, co znalazł, i zamknie sesję jak
    `strom session finish` ([R7.3](#R7.3));
  - przebieg, który czeka (na warunek, limit subskrypcji albo archiwum), kończy się od razu;
  - przebieg odczyta prośbę w ciągu sekundy, dwóch i powie to w swoim terminalu. Ctrl-C w oknie przebiegu zatrzymuje
    tylko ten przebieg;
  - numer przebiegu (`run-…`) podaje odrzucenie przebiegu ponad limit ([R7.10.1](#R7.10.1)) i
    `strom session list --open`;
  - po zakończeniu przebiegu linii jej zadania bierze znowu przebieg całej kolejki.
- **W aplikacji:** **Zatrzymaj** i **Dokończ i zakończ** w bloku przebiegu
  ([S4.1.8](S4-research-from-the-app.md#S4.1.8)).
- **Obsługa:** terminal: `strom run stop <run-…> [--finish]`, Ctrl-C w oknie przebiegu.
- **Obowiązuje od:** badanie 1.36.0

<!-- zdroj: research:src/commands/session.ts run stop (help: the task at work is finished, no next one starts; --finish; a run that waits ends at once; read within a second or two) · src/core/live.ts POST runs/stop · src/commands/links.ts finish?run= finishRun (strom run stop <run> --finish) · STOP_HINT src/core/linerun.ts · help run stop -->

<a id="R7.10.3"></a>
### R7.10.3 Co dzielą przebiegi na komputerze

Przebiegi na jednym komputerze (wszystkie badania z tym samym wspólnym folderem) dzielą limit subskrypcji agenta,
pytania do warunku, zapytania do stron internetowych i czytniki skanów.

- **Pilnuje kod:**
  - limit subskrypcji, na który trafi jeden przebieg ([R7.6](#R7.6)), obowiązuje dla wszystkich przebiegów tego
    samego agenta (i konta) na komputerze: żadna nowa sesja się nie uruchomi, dopóki limit się nie odnowi. Przebieg
    pod warunkiem z `--loop` albo `--until` czeka, każdy inny się kończy (**limit subskrypcji**). Rozpoczęta sesja
    pracuje dalej;
  - przebiegi pytają swoje warunki ([R7.4](#R7.4)) po kolei: następny dopiero po tym, jak uruchomiła się sesja,
    którą warunek przepuścił;
  - strony jednej witryny, które agenci otwierają, liczą się do `web.perHost` ([R9.3](R9-archives.md#R9.3)) ze
    wszystkich sesji na komputerze w ostatnich `run.minutes`;
  - na całym komputerze skany czyta naraz najwyżej `read.parallel` czytników
    ([R8.3.1](R8-reading-scans.md#R8.3.1)).
- **Obowiązuje od:** badanie 1.36.0

<!-- zdroj: research:src/core/machine.ts (limit-<agent>.json ve sdílené složce agents/, brána po jednom, sloty čtenářů) · src/core/web.ts web.perHost za run.minutes ze všech sezení · src/core/config.ts read.parallel, web.perHost (počítáno na počítač) · help run (What runs share on this computer) · CHANGELOG.cs.md 1.36.0 · dirigent:spec/126 U8 -->

<a id="R7.10.4"></a>
### R7.10.4 Przebieg linii z odnośnika aplikacji Strom

- Odnośnik `strom-research://work` z `research=G…` (i ewentualnie `agent=…`) prosi o przebieg jednej linii. Terminal
  badania otworzy go w nowym oknie z nazwą linii, powie „Przebieg linii …: tylko jej zadania – inna linia może mieć
  obok własny przebieg.”, agenta i pierwszych 5 zadań linii i uruchomi `strom run --research G…` z `--tasks N` albo
  `--loop` jak w [R7.1.2](#R7.1.2).
- **Granice:**
  - nic się nie uruchomi, gdy linii nie ma w badaniu albo jest wstrzymana lub zakończona, gdy programu wybranego
    agenta nie ma na komputerze, gdy linia ma już przebieg, gdy nad badaniem pracuje przebieg strom starszego niż 1.25,
    ani przy pełnej liczbie przebiegów („Naraz pracuje już najwięcej przebiegów (3 z 3, ustawienie run.parallel). Nic
    więcej nie uruchomiono.”);
  - potwierdzenie zależy od ustawienia **Uruchamianie agenta z aplikacji Strom**
    ([S4.5.5](S4-research-from-the-app.md#S4.5.5));
  - odnośnik dla całej kolejki jest nadal odrzucany obok przebiegu całej kolejki albo sesji poza przebiegami linii.
    Przebiegi linii liczą się dla niego tylko do `run.parallel`; kolejka, którą pokazuje, nie ma zadań linii
    z własnym przebiegiem;
  - `strom-research://finish` z `run=run-…` prosi przebieg, by dokończył i zakończył się jak
    `strom run stop <run-…> --finish` ([R7.10.2](#R7.10.2)).
- **Obsługa:** aplikacja ([S4.3.3](S4-research-from-the-app.md#S4.3.3)); terminal: `strom link open "<link>"`.
- **Obowiązuje od:** badanie 1.36.0

<!-- zdroj: research:src/cli/menu-links.ts workRun byLine (ui.link.direction.none, ui.link.work.line.state, ui.link.work.agent, ui.link.work.older, ui.run.line.held, ui.link.work.cap; obecný odkaz: busy bez běhů linií, runRefusal max; lineRunFilter; ui.run.line, ui.link.work.agent.is; run --research [--agent] --tasks|--loop) · src/commands/links.ts lineWindow (titulek Strom · strom · linie (G…), klíč linie), finish run= → finishRun · src/core/links.ts work research=, agent= -->
