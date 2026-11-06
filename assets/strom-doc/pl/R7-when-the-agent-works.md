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

<!-- zdroj: research:src/commands/session.ts:737-783 (popis a volby run), :830 max, :694 parseUntil · src/cli/menu.ts:288-375 (v1.25.2) · cs.json ui.menu.run, ui.run.queue, ui.run.pick, ui.run.loop, ui.run.how -->

<a id="R7.1.1"></a>
### R7.1.1 Dlaczego przebieg się kończy

- Na końcu przebieg wypisuje **N sesji · koniec: …**: **gotowe**, **brak otwartych zadań**, **limit czasu**
  (`--until`), **zatrzymano ręcznie** ([R7.3](#R7.3)), **limit subskrypcji** ([R7.6](#R7.6)), **agent nie jest
  zalogowany** ([R7.7](#R7.7)), odpowiedź warunku ([R7.4](#R7.4)) albo błąd (dowody, awaria agenta, model).
- Gdy pozostałe zadania potrzebują archiwum, które nie odpowiada, przebieg z `--loop` i `--until` czeka
  (**⏸ oczekiwanie do …**), inny się kończy.
- **Obowiązuje od:** badanie 1.0.0; czekanie na archiwum, które nie odpowiada, od 1.22.0

<!-- zdroj: research:src/commands/session.ts:853 Stop, :1220-1268, :1277-1285 · cs.json ui.run.summary, ui.run.stop.*, ui.run.asleep.wait · CHANGELOG.cs.md 1.22.0 -->

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
  - strom dostarcza warunek `claude-usage` ([R7.5](#R7.5)); własny warunek to folder `plugins/gates/<název>/`;
  - przebieg bez ustawionego warunku (`--no-gate`) lub z innym (`--gate`) wymaga zgody człowieka.
- **Obsługa:** terminal: **Ustawienia → Samodzielna praca agenta → Praca bez przerwy pod warunkiem: …**
  (warunek albo **brak**); `strom config set run.gate "<název> [co jí předat]"`, `strom config unset run.gate`; oba
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
subskrypcji (odnowi się …)**. Przebieg nie czeka nawet z `--loop`. Nie zależy to od warunku.

- **Granice:** zadanie wraca do kolejki; czas odnowienia pokazuje się tylko wtedy, gdy podał go agent. Czekać potrafi
  tylko warunek.
- **Obowiązuje od:** badanie 1.0.0

<!-- zdroj: research:src/commands/session.ts:1196-1206 closeSession (session.limit), :1255-1259 · src/core/session.ts:248-262 · runners/runner.ts:226 looksLikeLimit · cs.json ui.run.stop.limit, ui.run.stop.resets -->

<a id="R7.7"></a>
## R7.7 Niezalogowany agent

Agent, który nie jest zalogowany do swojej subskrypcji, nie przeprowadzi sesji. Przebieg się kończy: **agent nie jest
zalogowany – raz uruchomić … i się zalogować**.

- **Granice:**
  - przed pierwszą sesją strom sprawdza to tylko przy Claude Code z osobnym folderem (`agent.claudeConfigDir` lub
    `CLAUDE_CONFIG_DIR`, innym niż `~/.claude`). Przebieg kończy się wtedy bez sesji i bez pytania warunku;
  - w przeciwnym razie rozpoznaje to warunek `claude-usage` (zatrzymuje; przy przebiegu ręcznym pada **Uruchomić
    mimo to?**, [R7.4.1](#R7.4.1)) albo sesja, która kończy się błędem logowania.
- **Obowiązuje od:** badanie 1.25.2; zatrzymanie po sesji z błędem logowania od 1.0.0

<!-- zdroj: research:src/commands/session.ts:916 loggedOut, :1260-1264 auth · src/core/claudedir.ts claudeConfigSet :33, forClaude, claudeLoggedIn :91 · gate.ts:253-258 loggedIn · CHANGELOG.cs.md 1.25.2 -->

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
  - to, co wyśle aplikacja, zapisuje się jak w archiwum; dla agenta nic nie powstaje, a praca agenta jest odrzucana
    ze zdaniem, że badanie czeka na agenta, i gdzie go zainstalować albo wybrać innego;
  - zapisany tryb się nie zmienia, a zadania nie są odkładane. Po instalacji agenta badanie samo kontynuuje
    z zadaniami, które miało;
  - agent, który właśnie pracuje w badaniu (także inny niż ustawiony), czyni je badaniem.
- **Dlaczego:** archiwum to wybór człowieka i strom go za niego nie zapisze. Badanie bez agenta tylko zachowuje się
  jak archiwum, więc po instalacji agenta samo kontynuuje z zadaniami, które miało; żadne nie jest odłożone.
- **Obsługa:** terminal: menu, pierwsza pozycja (**Zostaw tylko jako Archiwum Strom: przechowywanie danych z aplikacji
  Strom** albo instalacja agenta); `strom mode` pokazuje stan. Aplikacja pokazuje takie badanie jako **Archiwum**
  ([S1.3](S1-connecting-app-and-research.md#S1.3)).
- **Obowiązuje od:** badanie 1.15.0

<!-- zdroj: research:src/core/state.ts (hlavička, stateOf, actsAsArchive, kindOf, refuseInArchive agent.missing) · cs.json ui.mode.is.waiting, ui.waiting.refuse, ui.menu.keeparchive · CHANGELOG 1.15.0 -->
