<a id="R7"></a>
# R7 Kdy a jak dlouho agent pracuje

Jak dlouho agent výzkumu pracuje sám, kdy začne další sezení a proč běh skončí. Popisuje výzkum 1.25.2
a aplikaci Strom 3.21.2. Změny z novější verze mají u sebe její číslo.

<a id="R7.1"></a>
## R7.1 Samostatná práce běží po sezeních

Při samostatné práci agent bere úkoly z fronty ([R2.2](R2-lines-and-queue.md#R2.2)) bez člověka. Jedno sezení je
jeden úkol. Běh spustí jedno nebo víc sezení za sebou; mezi nimi se může ptát podmínky ([R7.4](#R7.4)).

- **Hranice:**
  - bez volby 1 sezení; `--max <n>` nejvýš n; `--loop` sezení za sezením, dokud je práce;
  - `--task T…`: vybrané úkoly v zadaném pořadí, každý jedno sezení; mezitím hotový nebo vzatý úkol se vynechá;
  - `--until HH:MM`: potom žádné sezení nezačne, rozběhnuté doběhne. Čas, který dnes už byl, znamená zítra;
  - bez otevřeného úkolu ve frontě skončí každý běh.
- **Ovládání:** terminál: menu **Nechat agenta pracovat samotného**, volby **Pracovat v pořadí fronty – počet úkolů se
  zadá** (1–100, jako `--max`), **Jen vybrané úkoly ze seznamu** (jako `--task`) a **Nechat ho pracovat, dokud je co
  dělat a dovolí to podmínka „…“** (jako `--loop`, jen s nastavenou podmínkou); příkaz `strom run`. Aplikace
  Strom 3.21.2 samostatnou práci nenastavuje; ukazuje stav běhu ([R7.4](#R7.4)) a sezení z ní jde dokončit
  ([R7.3](#R7.3)).
- **Platí od:** výzkum 1.0.0 (`--max`, `--until`, `--task`), `--loop` od 1.2.0
- **Od výzkumu 1.32.0:** `--tasks <n>` (1–100) skončí po n vyřízených úkolech: hotových, čekajících na člověka,
  odložených nebo vzdaných po svém sezení (i úkolu, který běh odložil, protože na něm uvízl). Nedokončený
  úkol, který se vrátí do fronty (agent ho nedokončil, časový limit, přerušení), se nepočítá. Nejvýš 2×n sezení.
  `--tasks` nejde s `--max`, `--loop`, `--task`, `--until` ani s jinou volbou výběru úkolů. Podmínka se zeptá jednou,
  jako u `--max` ([R7.4.1](#R7.4.1)). Práce na frontě z odkazu aplikace Strom: [R7.1.2](#R7.1.2).

<!-- zdroj: research:src/commands/session.ts:737-783 (popis a volby run), :830 max, :694 parseUntil · src/cli/menu.ts:288-375 (v1.25.2) · cs.json ui.menu.run, ui.run.queue, ui.run.pick, ui.run.loop, ui.run.how · 1.32.0: src/commands/session.ts TASKS_MAX=100, SETTLED (done, waiting, parked, dropped), --tasks (max = 2×n, odmítnutí s --max, --loop, --task, --until a dalšími volbami výběru), popis run · CHANGELOG.cs.md 1.32.0 · spec 052 K6.3 -->

<a id="R7.1.1"></a>
### R7.1.1 Proč běh skončí

- Na konci běh vypíše **sezení: N · konec: …**: **hotovo**, **žádné otevřené úkoly**, **časový limit**
  (`--until`), **zastaveno ručně** ([R7.3](#R7.3)), **limit předplatného** ([R7.6](#R7.6)), **agent není
  přihlášený** ([R7.7](#R7.7)), odpověď podmínky ([R7.4](#R7.4)), nebo chyba (doklady, agent selhal, model).
- Když zbylé úkoly potřebují archiv, který neodpovídá, běh s `--loop` a `--until` počká (**⏸ čekám do …**), jiný
  skončí.
- **Platí od:** výzkum 1.0.0; čekání na archiv, který neodpovídá, od 1.22.0
- **Od výzkumu 1.32.0:** běh s `--tasks` skončí **vyřízené úkoly: N**, nebo po 2×n sezeních **sezení: … (nejvíc pro
  žádaný počet úkolů) – vyřízené úkoly: …**.
- **Od výzkumu 1.36.0:** běh, kterému zbyly jen úkoly na omezeném archivu, který používá jiné sezení, počká nejvýš
  `archive.wait` a skončí **nic dalšího k práci – zbylé úkoly potřebují archiv …**
  ([R9.13](R9-archives.md#R9.13)).

<!-- zdroj: research:src/commands/session.ts:853 Stop, :1220-1268, :1277-1285 · cs.json ui.run.summary, ui.run.stop.*, ui.run.asleep.wait · CHANGELOG.cs.md 1.22.0 · 1.32.0: session.ts Stop tasks|sessions, cs.json ui.run.stop.tasks, ui.run.stop.sessions -->

<a id="R7.1.2"></a>
### R7.1.2 Práce na frontě z odkazu aplikace Strom

- Aplikace Strom může odkazem `strom-research://work` požádat o samostatnou práci agenta na frontě: určitý počet
  úkolů, nebo práci, dokud je co dělat. Odkaz otevře terminál výzkumu ([S4.5](S4-research-from-the-app.md#S4.5)).
  Ten ukáže, co se pustí, a spustí to až na **ano**; výchozí odpověď je ne.
- **Hranice:**
  - terminál ukáže prvních 5 úkolů v pořadí, v jakém je bere `strom run` (úkol zvolený **hned** první), kolik je
    dalších, kdy běh skončí, časový limit sezení a podmínku ([R7.4](#R7.4));
  - počet úkolů 1–100, bez zadaného počtu 5. Spustí se `strom run --tasks N` ([R7.1](#R7.1)); podmínka se zeptá
    jednou, před prvním sezením;
  - práce, dokud je co dělat, běží jen pod podmínkou a spustí `strom run --loop`. Bez nastavené podmínky se nic
    nespustí: terminál nabídne místo toho určitý počet úkolů, nastavení podmínky, nebo nic (výchozí);
  - když na výzkumu už běží běh nebo sezení, nic dalšího se nespustí. S prázdnou frontou také ne. Když na počítači
    chybí program agenta pro terminál, terminál to řekne dřív, než se na cokoli zeptá;
  - běh jde v tomtéž okně terminálu. Ctrl-C požádá rozpracované sezení o dokončení a běh zastaví
    ([R7.3](#R7.3)); zbytek zůstane ve frontě;
  - most práci agenta nespouští, jen terminál po potvrzení.
- **Ovládání:** odkaz z aplikace Strom (`strom-research://work` s `do=tasks` a `n`, nebo `do=loop`), v aplikaci
  3.28.0 **Pracovat na frontě…** ([S4.2.3](S4-research-from-the-app.md#S4.2.3)); terminál:
  `strom link open "<odkaz>"`.
- **Platí od:** výzkum 1.32.0
- **Od výzkumu 1.36.0:** při **Spouštění agenta z aplikace Strom: bez potvrzení** se práce spustí bez dotazu na ano;
  podmínka se ptá dál ([S4.5.5](S4-research-from-the-app.md#S4.5.5)).
- **Od výzkumu 1.36.0:** odkaz může jmenovat úkoly (`do=tasks` s `task=T…,T…`, jen čísla úkolů, nejvýš 100, nikdy
  s `n`): **Zpracovat hned** po zkoušce ověření ([S7.5.1](S7-reliability-and-verification.md#S7.5.1)). Terminál
  ukáže „Tyto úkoly, v tomto pořadí:“ a „Každý úkol jedno sezení (N sezení), pak konec; co se nedokončí, vrátí se
  do fronty.“ Po **ano** spustí `strom run --task` s těmi úkoly v pořadí odkazu. Úkoly, které už nečekají (hotové,
  vzaté zpět nebo je má jiný), vynechá a řekne kolik; když nečeká žádný, nic se nespustí.

<!-- zdroj: 1.36.0: research:7116bb60 src/cli/menu-links.ts workOn, src/core/links.ts (task= jen s do=tasks, ne s n, 1–LINK_WORK_MAX) · cs.json ui.link.work.picked.* · research:src/cli/menu-links.ts workRun (WORK_LIST=5, agentCliHere, busyIn, taskQueue s RUN_TURNS, loop jen s run.gate, choose výchozí „Teď nic“, asks … false, run --tasks | --loop) · src/core/links.ts LINK_WORK_DOS, LINK_WORK_MAX=100, LINK_WORK_DEFAULT=5 · src/commands/links.ts case "work" · cs.json ui.link.work.*, ui.link.what.work.*, ui.run.next, ui.run.limit, ui.link.cost · CHANGELOG.cs.md 1.32.0 · spec 052 K6.2 (cesta terminál, most agenta nespouští) -->

<a id="R7.2"></a>
## R7.2 Každé sezení má časový limit

Jedno sezení trvá nejvýš nastavený počet minut, výchozí 60. Agent čas konce zná předem a strom mu ho připomíná. Při
limitu ho strom zastaví a nedokončený úkol vrátí do fronty.

- **Hranice:**
  - posledních 10 minut (krátké sezení: poslední čtvrtinu) každý příkaz `strom` řekne, kolik času zbývá; poslední
    3 minuty (krátké sezení: poslední osminu) vyzve zapsat nalezené a sezení zavřít;
  - při limitu dostane agent, který to umí (Claude Code, Codex, OpenCode, Grok), ještě 5 minut na zápis a zavření;
  - úkol, na kterém 2 sezení za sebou nic nezapsala, se odloží (**… odložen**); sezení ukončená člověkem se nepočítají;
  - pořadí: `--minutes` > proměnná `STROM_RUN_MINUTES` > nastavení rodokmenu > nastavení počítače > 60.
- **Ovládání:** terminál: **Nastavení: agent, samostatná práce, zprávy, archivy, údržba → Samostatná práce agenta →
  Čas na jeden úkol: N min** (5–600; 0 vrátí zpět beze změny); `strom config set run.minutes <n>`
  (`--for-tree`: jen tento rodokmen). Aplikace: nic.
- **Platí od:** výzkum 1.0.0 (60 minut, odložení úkolu); připomínky a 5 minut na zápis od 1.2.0

<!-- zdroj: research:src/core/config.ts:223 DEFAULT_RUN_MINUTES=60, run.minutes tree:true · src/core/clock.ts REMIND_MS, CLOSE_MS, WRAP_UP_MS, clockLine :103-118 · session.ts:705 MAX_IDLE_SESSIONS=2, :750 popis · src/cli/menu-settings.ts:300-317 (v1.25.2) · cs.json ui.alone.minutes, ui.alone.minutes.ask, ui.run.parked -->

<a id="R7.3"></a>
## R7.3 Sezení jde požádat o dokončení

Člověk může běžící sezení požádat, aby skončilo. Agent nezačne nic nového, zapíše, co našel, a sezení zavře. Pak běh
skončí a další sezení nezačne. Nic se nezastaví násilím.

- **Hranice:**
  - agent žádost uvidí u dalšího příkazu `strom`; nový čtenář nezačne, práci subagenta strom v půli nezastaví;
  - Ctrl-C v terminálu běhu: poprvé tatáž žádost, podruhé okamžité zastavení (úkol se vrátí do fronty). Ve Windows
    a s `--interactive` zastaví hned první Ctrl-C.
- **Ovládání:** terminál: `strom session finish [N…]` (běží-li víc sezení, uvést které), Ctrl-C. Aplikace: **Přehled
  výzkumu**, u pracujícího agenta **Dokončit a skončit**; potvrzuje se v terminálu výzkumu. Když běh čeká na podmínku,
  tlačítko chybí.
- **Platí od:** výzkum 1.8.0, aplikace 3.5.0
- **Od výzkumu 1.36.0:** běh jde zastavit i zvenku a zvlášť, `strom run stop <run-…> [--finish]`; při více bězích
  má každý v aplikaci vlastní **Dokončit a skončit** ([R7.10.2](#R7.10.2)).

<!-- zdroj: research:src/commands/session.ts:198-221 session finish, :865 onSignal, :1194 askedToFinish · src/core/clock.ts askFinish, refuseReadersWhenFinishing · runners/runner.ts:296 OWN_GROUP · src/cli/menu-links.ts:473 finishSession · app:v3.21.2 research-overview-ui.ts:810,868 (!w.paused) · strings.ts live.finishSession -->

<a id="R7.4"></a>
## R7.4 Podmínka rozhoduje, zda začne další sezení

Podmínka je program, kterého se strom před sezením ptá: pokračovat, počkat, nebo zastavit. Nastavuje ji jen člověk,
pro celý počítač. Bez podmínky běh pokračuje, dokud je práce.

- **Hranice:**
  - **pokračovat**: sezení začne; **počkat**: běh počká a zeptá se znovu; **zastavit**: běh skončí. Cokoli jiného
    (pád programu, žádná odpověď do 120 s, `claude-usage` 660 s) je chyba a běh skončí;
  - kdy se zeptat znovu, řekne podmínka; jinak za 15 minut, nikdy dřív než za 1 minutu. Ctrl-C čekání ukončí;
    s `--until` ho ukončí zadaný čas (**časový limit**);
  - `--loop` a `--until`: dotaz před každým sezením; ručně spuštěné úkoly: jeden dotaz ([R7.4.1](#R7.4.1));
  - strom dodává podmínku `claude-usage` ([R7.5](#R7.5)); vlastní podmínka je složka `plugins/gates/<název>/`;
  - běh bez nastavené podmínky (`--no-gate`) nebo s jinou (`--gate`) potřebuje souhlas člověka.
- **Ovládání:** terminál: **Nastavení → Samostatná práce agenta → Práce pořád dál pod podmínkou: …** (podmínka,
  nebo **žádná**); `strom config set run.gate "<název> [co jí předat]"`, `strom config unset run.gate`; obojí
  potvrzuje člověk. Aplikace: **Přehled výzkumu** u čekajícího běhu ukáže **Pozastaveno** a **pokračuje v …**.
- **Platí od:** výzkum 1.2.0, aplikace 3.5.0 (stav Pozastaveno)

<!-- zdroj: research:src/core/gate.ts:27-34 DEFAULT_TIMEOUT_S, DEFAULT_WAIT_MS, MIN_WAIT_MS, askGate :209-254, SHIPPED :124 · session.ts:911 gateHolds, :1038-1063 wait, markPaused, runGate :1357-1380 · config.ts run.gate tree:false · setup.ts:1537-1548 · app:v3.21.2 research-overview-ui.ts:340-347, strings.ts live.statePaused, live.pausedUntil -->

<a id="R7.4.1"></a>
### R7.4.1 Ručně spuštěné úkoly: „Spustit přesto?“

- Jedno sezení, `--max`, `--task` a menu jsou volba člověka. Podmínka se zeptá jednou, před prvním sezením. Když
  by nespouštěla (počkat, zastavit, chyba), padne otázka **Podmínka „…“ by teď nespouštěla — ….
  Spustit přesto?** Enter znamená ne: běh skončí (**nespuštěno — podmínka „…“: …**). Ano: sezení začnou
  a podmínka se dál neptá, kromě stropu ([R7.4.2](#R7.4.2)).
- Spouští-li běh agent, odpovídá člověk v okně systému. Skript, kterého se nikdo nemůže zeptat, se podmínky drží.
- **Platí od:** výzkum 1.2.0

<!-- zdroj: research:src/commands/session.ts:1027-1037, startAnyway :1400-1411 · cs.json ui.run.gate.once, ui.run.gate.anyway, ui.run.stop.gate.declined -->

<a id="R7.4.2"></a>
### R7.4.2 Strop: pevná hranice

- Podmínka může odpověď označit jako pevnou hranici člověka (`hard`). Běh pak skončí (**strop podmínky „…“**)
  a žádné „přesto“ ji nepřekročí.
- Podmínka může hlídat okno plánu agenta (`watch`). Pak se ptá před každým sezením každého běhu a sezení v práci
  dostane žádost o dokončení ([R7.3](#R7.3)), když agent ohlásí využití okna na zadané hranici.
- **Platí od:** výzkum 1.14.0

<!-- zdroj: research:src/core/gate.ts:64-71 hard, watch, parseSaid :330-348 · session.ts:1012-1026, onLimits :1175-1182 · cs.json ui.run.gate.cap, ui.run.cap.finish, ui.run.stop.gate.cap -->

<a id="R7.4.3"></a>
### R7.4.3 Záznam odpovědí podmínky

- Každá odpověď má řádek ve výstupu běhu: **· podmínka …: … (kód …; .strom/gate.log)**: název podmínky, její odpověď s důvodem a kód.
- Zároveň řádek JSON v `.strom/gate.log` rodokmenu: kdy, podmínka a co jí bylo předáno, kód, verdikt, důvod, čekání,
  limity plánu a co běh udělal (`go`, `wait`, `stop`, `anyway`). Drží se 90 dní, nejvýš 2 MB.
- **Ovládání:** terminál: **Samostatná práce agenta → Co by podmínka řekla teď?**, `strom gate test`.
- **Platí od:** výzkum 1.14.0 (záznam); dotaz z menu od 1.3.0

<!-- zdroj: research:src/core/gate.ts GATE_LOG, GateRecord :264-287, recordGate :311 · session.ts:1003-1007, :1069-1078 · src/core/tidy.ts:49 gate {days: 90, bytes: 2 MB} · menu-settings.ts:432-452 (v1.25.2) -->

<a id="R7.5"></a>
## R7.5 Podmínka claude-usage drží tempo týdne

`claude-usage` drží samostatnou práci v týdenním limitu předplatného Claude. Porovná, kolik procent týdne uplynulo od
jeho obnovení (den ≈ 14,3 %), s využitím týdne. Sezení začne, jen když je náskok (uplynulo − využito) aspoň zadané
číslo n.

- **Hranice:** kroky jdou v tomto pořadí, rozhodne první, který platí:
  1. n není celé číslo 0–99, nebo strop není celé číslo 1–100: zastavit (každý běh);
  2. agent není Claude Code, nebo Claude Code běží na API klíči: pokračovat;
  3. využití z hlášení agenta v tomto běhu (nejvýš 15 minut staré), jinak z `claude -p /usage`. Nejde přečíst:
     3 pokusy po 30 s, pak počkat 15 minut. Claude Code není přihlášený: zastavit ([R7.7](#R7.7));
  4. týden bez času obnovení: využito 0 % → pokračovat, jinak počkat 15 minut;
  5. využito ≥ strop: zastavit, pevně ([R7.5.4](#R7.5.4));
  6. pětihodinové okno vyčerpané (100 %): počkat do jeho obnovení a 1 minutu;
  7. náskok ≥ potřeba ([R7.5.1](#R7.5.1)), po čekání s přídavkem ([R7.5.2](#R7.5.2)): pokračovat;
  8. poslední 2 hodiny před obnovením týdne a do 100 % (nebo do stropu) zbývá aspoň 10 bodů: pokračovat;
  9. jinak počkat ([R7.5.3](#R7.5.3)).
- **Ovládání:** terminál: **Práce pořád dál pod podmínkou** → **Claude usage** → zadat n (nabízí 10; jen s Claude
  Code na počítači); `strom config set run.gate "claude-usage 10"`. Bez čísla platí 0.
- **Platí od:** výzkum 1.2.0; nečitelné využití a nepřihlášení od 1.25.2
- **Od výzkumu 1.26.0:** menu i `strom config set` přijmou jen celé n 0–99 (v 1.25.2 i desetinné, které pak běh zastaví).

<!-- zdroj: research:assets/plugins/gates/claude-usage/gate.ts (v1.25.2 = HEAD) :209-312, FRESH_MS, ATTEMPTS=3, RETRY_MS=30 s, UNREAD_WAIT=15 min, AFTER_RESET=60 s, END_WINDOW=2 h, SESSION_POINTS=10 · gate.json timeout 660 · menu-settings.ts:322-357 (v1.25.2) · HEAD src/core/gate.ts pointsProblem -->

<a id="R7.5.1"></a>
### R7.5.1 Začátek týdne

- Potřeba je menší z čísel n a polovina uplynulé části týdne; celé n platí od 2·n % týdne. Hned po obnovení sezení
  začne. Příklad: n = 10, uplynulo 12 % → potřeba 6; sezení začne při využití nejvýš 6 %.
- **Platí od:** výzkum 1.15.0

<!-- zdroj: research:assets/plugins/gates/claude-usage/gate.ts:280 need = min(min, gone/2) · CHANGELOG.cs.md 1.15.0 -->

<a id="R7.5.2"></a>
### R7.5.2 Přídavek po čekání

- Když podmínka čekala pro malý náskok, pustí znovu až s přídavkem 2 bodů (při 15: náskok 17), na začátku týdne
  poměrně menším (2 · potřeba / n). Pak pouští sezení za sebou, dokud náskok neklesne pod potřebu.
- Týden čekání si pamatuje v `hold.json` ve své složce; nový týden začíná bez přídavku.
- **Platí od:** výzkum 1.22.0

<!-- zdroj: research:assets/plugins/gates/claude-usage/gate.ts RESERVE=2 :71, reserve :287, holding/hold :368-387 · CHANGELOG.cs.md 1.22.0 -->

<a id="R7.5.3"></a>
### R7.5.3 Jak dlouho čeká

- Do první z chvil: týden dožene náskok s přídavkem; začnou poslední 2 hodiny týdne (jen když do 100 % nebo do
  stropu zbývá aspoň 10 bodů); týden se obnoví (a 1 minuta). Nikdy přes obnovení, vždy aspoň 5 minut.
- Odpověď říká využití, uplynulou část, náskok a na jaký náskok čeká.
- **Platí od:** výzkum 1.2.0; poslední 2 hodiny od 1.15.0

<!-- zdroj: research:assets/plugins/gates/claude-usage/gate.ts:294-312 (caught, last, after, now + 5 min), T.cs head, hold -->

<a id="R7.5.4"></a>
### R7.5.4 Strop týdne

- `claude-usage 10 --cap 95`: při využití týdne 95 % a víc žádné sezení nezačne, v žádném běhu ani po „Spustit
  přesto?“. Běh skončí a řekne využití a kdy se týden obnoví.
- Ptá se před každým sezením každého běhu ([R7.4.2](#R7.4.2)). Rozběhnuté sezení dostane žádost o dokončení až při
  99 % týdne, i když je strop nižší. `--cap` bez n: platí strop i tempo s n = 0.
- **Ovládání:** terminál: `strom config set run.gate "claude-usage 10 --cap 95"`. Menu strop v 1.25.2 nepřijme,
  od 1.26.0 ano.
- **Platí od:** výzkum 1.14.0
- **Od výzkumu 1.26.0:** rozběhnuté sezení dostane žádost o dokončení už při stropu (`--cap 95`: při 95 % týdne;
  `--cap 100`: při 99 %).

<!-- zdroj: research:assets/plugins/gates/claude-usage/gate.ts:213-219 --cap, :271-272 cap hard, FINISH_AT=0.99 :54, answer() watch :204 · src/core/gate.ts capProblem :159 · menu-settings.ts:350 (v1.25.2) · 1.26.0: gate.ts finish min(0.99, cap/100) (commit 6276a16f) -->

<a id="R7.6"></a>
## R7.6 Limit předplatného zastaví běh

Když agent během sezení narazí na limit svého předplatného, sezení se zavře a běh skončí: **limit předplatného
(obnoví se …)**. Do výzkumu 1.33.0 běh nečeká ani s `--loop` a nezávisí to na podmínce; od 1.34.0 viz níže.

- **Hranice:** úkol se vrátí do fronty; čas obnovení se ukáže, jen když ho agent řekl. Čekat umí jen podmínka.
- **Platí od:** výzkum 1.0.0
- **Od výzkumu 1.34.0:** běh, který pokračuje sám (`--loop`, `--until`) a má podmínku ([R7.4](#R7.4)), po limitu
  neskončí. Úkol se vrátí do fronty (jako další může přijít jiný), běh počká do obnovy limitu a minutu navíc, pak se
  znovu zeptá podmínky a pokračuje. Terminál: „⏸ limit plánu agenta se vyčerpal (pětihodinové okno) – čekání do jeho
  obnovy (…), pak nový dotaz na podmínku a práce pokračuje (Ctrl-C běh ukončí)“; aplikace Strom ukazuje běh jako
  pozastavený s důvodem.
  - čas obnovy: z údaje agenta o vyčerpaném okně plánu (pětihodinové okno, týden; vyčerpaná obě: pozdější z nich),
    jinak z času, který agent řekl (datum a čas, „in 2 hours“, „7pm“ jen v časovém pásmu počítače). Čas za víc než
    8 dní nebo v minulosti se nebere. Neznámý čas: běh čeká 15 minut („…, čas obnovy neznámý – čekání do …, pak nový
    dotaz na podmínku“);
  - obnova až po čase `--until`: běh skončí **časový limit**;
  - sezení přerušené limitem se úkolu nepočítá jako neúspěch agenta;
  - beze změny: ruční běh (jeden úkol, `--tasks n`, `--max` bez `--loop`) a běh bez podmínky skončí **limit
    předplatného** jako dřív. Claude Code hláška „You've hit your limit · resets …“ i odmítnutí agenta kvůli limitu
    se berou jako limit.
- **Od výzkumu 1.36.0:** limit, na který narazí jeden běh, zastaví nová sezení všech běhů téhož agenta na počítači
  ([R7.10.3](#R7.10.3)).

<!-- zdroj: research:src/commands/session.ts:1196-1206 closeSession (session.limit), :1255-1259 · src/core/session.ts:248-262 · runners/runner.ts:226 looksLikeLimit · cs.json ui.run.stop.limit, ui.run.stop.resets · 1.34.0: research:8f24e9f7 src/commands/session.ts:1453-1483 (gateHolds && gate, limitResume, limitReserve, DEFAULT_WAIT_MS 15 min, until → time, markPaused), :1363 metrics.limit, src/core/planlimit.ts limitResume, timeOf, LIMIT_RESERVE_MS 60 s, FURTHEST_MS · 03146702 (B8: „You've hit your limit“, odmítnutý rate_limit_event) · cs.json ui.run.limit.wait, ui.run.limit.unknown, ui.run.limit.why, ui.run.limit.five_hour, ui.run.limit.seven_day · dirigent:prace/1115-vyzkum-k036-limit-obnova -->

<a id="R7.7"></a>
## R7.7 Nepřihlášený agent

Agent, který není přihlášený ke svému předplatnému, sezení neudělá. Běh skončí: **agent není přihlášený – jednou
spustit … a přihlásit se**.

- **Hranice:**
  - před prvním sezením to strom ověří u Claude Code: do výzkumu 1.33.0 jen se zvláštní složkou
    (`agent.claudeConfigDir` nebo `CLAUDE_CONFIG_DIR`, jiná než `~/.claude`), od 1.34.0 i s výchozí. Běh pak skončí
    bez sezení a bez dotazu na podmínku;
  - jinak to pozná podmínka `claude-usage` (zastaví; u ručního běhu padne **Spustit přesto?**,
    [R7.4.1](#R7.4.1)), nebo sezení, které skončí chybou přihlášení.
- **Platí od:** výzkum 1.25.2; zastavení po sezení s chybou přihlášení od 1.0.0
- **Od výzkumu 1.34.0:** Claude Code v terminálu, který strom spouští sám (samostatná práce, čtenáři skenů
  a dokumentů, [R8.3](R8-reading-scans.md#R8.3)), má vlastní přihlášení, ne přihlášení aplikace Claude. Když
  `claude auth status` řekne, že přihlášený není:
  - `strom read` a další čtení čtenáři (výřezy, přepisy, dokument z aplikace) nespustí žádného čtenáře a hned
    skončí: **Claude Code v terminálu není přihlášený – … ho spouští sám (ne aplikace Claude, ta má vlastní
    přihlášení)**, s radou **jednou se přihlásit v terminálu: …, pak /login**;
  - čtenář, který skončí chybou přihlášení, to řekne i s návodem k přihlášení, v průběhu i ve shrnutí, nikdy jen
    „auth“;
  - `strom doctor` má vlastní řádek **přihlášení Claude Code**: **Claude Code v terminálu přihlášen**, nebo varování
    **Claude Code v terminálu není přihlášený – …** s opravou **… v terminálu, pak /login**. V archivu Stromu se
    přihlášení neověřuje ani neříká.

  Odpověď, ze které přihlášení nejde poznat, nic nerozhoduje. Terminál: `claude`, pak `/login`; `strom doctor`.
- **Od výzkumu 1.35.0:** kontrola přihlášení, která do 5 s neodpoví, nic nerozhoduje a ukončí všechno, co spustila,
  i na Windows, kde dřív program agenta mohl běžet dál.

<!-- zdroj: research:src/commands/session.ts:916 loggedOut, :1260-1264 auth · src/core/claudedir.ts claudeConfigSet :33, forClaude, claudeLoggedIn :91 · gate.ts:253-258 loggedIn · CHANGELOG.cs.md 1.25.2 · 1.34.0 (K040): src/core/agentcli.ts requireClaudeLogin, agentLoggedOut (agent.logged-out) · src/commands/readers.ts refuseReadersLoggedOut, readerAuthSaid · src/commands/read.ts · src/commands/session.ts loggedOut bez claudeConfigSet · src/commands/setup.ts doctor login (ne v archivu) · assets/lang/*.json ui.read.auth, ui.doc.login*, ui.error.agent.logged-out* · CHANGELOG 1.34.0 · 1.35.0: research:bb79ee54 src/core/claudedir.ts AUTH_STATUS_MS 5000, claudeLoggedIn přes src/core/runsync.ts runSync (win32 taskkill /T /F, jinde skupina procesů) · CHANGELOG.cs.md 1.35.0 „Windows: po kontrole přihlášení nic neběží dál“ -->

<a id="R7.8"></a>
## R7.8 Archiv Stromu: výzkum, na kterém agent nepracuje

Výzkum může být jen **Archiv Stromu**: data se zadávají v aplikaci Strom a výzkum je drží i s prameny, originály
a historií. Agent na něm nepracuje a nic nezkoumá. Archiv zapíná a vypíná jen člověk, tam i zpět; nic se při tom
nemaže.

- **Hlídá kód:**
  - práce agenta je v archivu odmítnutá: rozhovor (`strom chat`), samostatná práce, nová linie, revize osoby,
    čtení skenů (`strom read`, `strom clips`, `strom transcripts`), čtení dokumentu, ztotožnění míst. Odmítnutí řekne
    jednou větou, kde se výzkum zapíná;
  - přepnutí na archiv odloží otevřené, rozdělané i čekající úkoly s důvodem „odloženo: výzkum je Archiv Stromu“.
    Nový úkol v archivu čeká odložený. Po zapnutí výzkumu se úkoly vrátí, kde byly: do fronty, nebo zpět k čekání
    na člověka;
  - na archiv nejde přepnout, dokud někdo na výzkumu pracuje. Sezení se nejdřív dokončí;
  - zapnutí výzkumu bez agenta na počítači nabídne agenta nainstalovat. Bez agenta zůstane archiv, jak byl;
  - přepnutí potvrzuje člověk; agent ho neudělá.
- Co aplikace do archivu pošle, se zapíše, jak to přijde: [S2.4](S2-edits-from-the-app.md#S2.4). Jak archiv
  ukazuje aplikace: [S1.3](S1-connecting-app-and-research.md#S1.3).
- **Proč:** archiv je pro rodokmen bez AI agenta: data z aplikace mají svou historii, prameny a zálohu (`strom pack`)
  a nic se neplatí za čtení (kód, CHANGELOG 1.20.0).
- **Ovládání:** terminál: menu výzkumu, první položka; `strom mode` (ukáže), `strom mode archive`, `strom mode
  research`. Pro nové výzkumy se ptá `strom setup` (**Čím má být nový výzkum na tomto počítači?**); změní to
  **Nastavení → Nové výzkumy: výzkum, nebo jen Archiv Stromu**.
- **Platí od:** výzkum 1.12.0; volba pro nové výzkumy i s agentem na počítači 1.15.0; odmítnuté čtení skenů 1.20.0

<!-- zdroj: research:src/core/mode.ts (hlavička, switchMode, holdForArchive, heldInArchive) · research:src/core/state.ts refuseInArchive · research:src/commands/trees.ts strom mode (liveWorkers, agentReady, requireHuman "mode") · refuseInArchive v session.ts:805 (run), start.ts (chat), research.ts (research new, review), document.ts, placeid.ts, calibrate.ts · cs.json archive.held, ui.mode.*, ui.archive.refuse · CHANGELOG 1.15.0, 1.20.0 · switchMode od v1.12.0 -->

<a id="R7.8.1"></a>
### R7.8.1 Výzkum čeká na agenta

Výzkum, jehož agent na tomto počítači není (nenainstalovaný, nebo výzkum přenesený z jiného počítače), na něj čeká.
Do té doby se chová jako Archiv Stromu.

- **Hlídá kód:**
  - co pošle aplikace, se zapíše jako v archivu; agent nic nedostane a práce agenta je odmítnutá s větou, že
    výzkum čeká na agenta, a kde ho nainstalovat nebo vybrat jiného;
  - uložený režim se nemění a úkoly, které výzkum měl, se neodkládají. Po instalaci agenta výzkum pokračuje sám s úkoly, které měl;
  - agent, který ve výzkumu právě pracuje (i jiný než nastavený), ho dělá výzkumem.
- **Proč:** archiv je volba člověka a strom ji za něj nezapíše. Výzkum bez agenta se jen chová jako archiv, takže po
  instalaci agenta sám pokračuje s úkoly, které měl.
- **Ovládání:** terminál: menu, první položka (**Nechat jen jako Archiv Stromu: ukládat data z aplikace Strom**,
  nebo instalace agenta); `strom mode` ukáže stav. Aplikace ukazuje takový výzkum jako **Archiv**
  ([S1.3](S1-connecting-app-and-research.md#S1.3)).
- **Platí od:** výzkum 1.15.0; 1.35.0: nové úkoly odložené
- **Od výzkumu 1.35.0:** úkol, který mezitím přijde (k poslanému materiálu, sken ke čtení), vznikne odložený jako
  v archivu. Do fronty se vrátí, jakmile na výzkumu začne pracovat agent (začátek sezení, `strom run`, chat; i jiný
  než nastavený), nebo když je nastavený agent zase na počítači.

<!-- zdroj: research:src/core/state.ts (hlavička, stateOf, actsAsArchive, kindOf, refuseInArchive agent.missing) · cs.json ui.mode.is.waiting, ui.waiting.refuse, ui.menu.keeparchive · CHANGELOG 1.15.0 · 1.35.0: research:31def74a src/core/state.ts heldWhereNobody (parked, heldBy archive, waiting.held), settleWaiting (atWork: session start, run, chat; jinak stateOf research) · src/core/records.ts create · CHANGELOG.cs.md 1.35.0 „Rodinný materiál … odložený, dokud tu agent není“ -->

<a id="R7.9"></a>
## R7.9 Úkol drží sezení, které na něm pracuje

Na jednom výzkumu může pracovat víc agentů najednou: samostatná práce (`strom run`), rozhovor (`strom chat`), agent,
který volá `strom` přímo ve svém terminálu, i jiný počítač nad týmž výzkumem. Úkol má vždy jen jednoho pracujícího:
drží ho otevřené sezení, dokud jeho agent dává znamení života. Opuštěný úkol se uvolní sám.

- **Hlídá kód:**
  - výběr úkolu a jeho zabrání proběhnou naráz. Když o tentýž úkol stojí dva, dostane ho jeden; druhý vezme další volný.
    Platí pro `strom run`, `strom chat`, `strom session start`, `strom task start`, odkaz z aplikace Strom i agenta,
    který pracuje přímo;
  - znamení života: proces běhu nebo rozhovoru, který spustil strom, na tomto počítači; jinak každý příkaz `strom`
    toho sezení. Agenta, který pracuje přímo, pozná výzkum podle čísla jeho konverzace (Claude Code, Codex…): dva
    takoví agenti mají každý své sezení;
  - bez znamení života déle než `task.hold` (výchozí 30 min) držení propadne. Když proces držitele na tomto počítači
    skončil, propadne hned;
  - propadlé sezení převezme jen jeden zájemce. Staré sezení se zavře jako přerušené s poznámkou „převzato po N
    minutách bez známky života; rozdělaná práce v N…“; co v něm bylo zapsáno, zůstává, a úkol se vrátí do fronty;
  - starý držitel, který se po převzetí probudí (uspaný počítač, zastavený proces), už nic nezapíše: zapisující příkaz
    se odmítne a řekne, které sezení úkol převzalo a kdy. Číst smí dál. `strom task done` a další zápisy k úkolu, který
    drží jiné sezení, se odmítnou;
  - kdo chce úkol, který drží jiné sezení, dostane jednu větu: „T12 drží Claude Code (sezení N0040) od 14:05,
    naposledy 14:31; uvolní se nejpozději v 15:01.“ Když ho drží živý proces na tomto počítači, místo času stojí
    „uvolní se, až skončí“. `strom run` vezme další volný úkol, `strom session start T…` se odmítne s nabídkou dalšího
    (`strom task next`). Na uvolnění se nečeká;
  - `strom run` převezme propadlá sezení na začátku každého sezení a úkoly, které drží jiné sezení, vynechá („T12
    vynechán: pracuje na něm jiný agent“).
- **Jen metodika:** agent, který pracuje přímo, dá aspoň jednou za 20 minut příkaz `strom`; dlouhé čtení skenů bez
  něj by úkol uvolnilo.
- **Hranice:**
  - čas je ze stejného počítače; u výzkumu na sdíleném disku z jiného počítače rozhoduje jen poslední znamení života.
    Při posunutých hodinách drží rezervace spíš déle, nikdy se nezdvojí;
  - starší strom vedle tohoto úkoly nedrží: jeho sezení posuzuje nový strom podle jeho běhu a podle posledního zápisu,
    jinak od začátku sezení;
  - nic z toho není v datech výzkumu; držení je jen místní stav vedle výzkumu.
- **V aplikaci:** kdo úkol drží a do kdy, ukazuje Přehled výzkumu ([S4.1](S4-research-from-the-app.md#S4.1),
  [S4.2](S4-research-from-the-app.md#S4.2)).
- **Ovládání:** terminál: `strom config set task.hold <minuty>` (např. `45m`, `2h`; 5 min až 24 h, platí pro tento
  počítač, ne pro jeden výzkum), `strom task next`; menu ukazuje v řádku o práci i agenty, kteří pracují přímo
  („Přímo ve výzkumu teď pracuje agent.“).
- **Platí od:** výzkum 1.36.0

<!-- zdroj: research:1e58aa7b, f08b6574, 23b20c27 src/core/holds.ts (Hold by run|chat|agent, agentSession, BEAT_MS 60 s, holdAlive: proces tady mrtvý → hned, jinak lastSign < task.hold; lastSign max(beat, mtime), budoucnost jako teď; sessionLife: bez holdu worker, run.lock, ops logy, jinak start) · src/core/session.ts claimTask, takeOver (session.taken: „převzato po … bez známky života; rozdělaná práce v …“), :574 session.taken · src/core/errors.ts:122 task.held, task.held.here · src/commands/session.ts:217-225 (session start: sign of life, at least once every 20 minutes, task.held), :985-997 (run: vynechá držené, převzetí na začátku sezení) · src/brief/brief.ts:1668, src/commands/guide.ts:152 (aspoň jednou za 20 minut) · src/core/config.ts:242-246, :335 task.hold (tree: false, 5 min–24 h, výchozí 30) · ověřeno: strom config set task.hold 3 / 25h / --for-tree odmítnuto (izolovaně) · cs.json ui.error.task.held(.here), ui.error.session.taken, ui.run.skip.held, ui.menu.working.direct(.more), session.taken · CHANGELOG.cs.md 1.36.0 „Více agentů a výzkumů najednou“ · dirigent:spec/127 K1.1–K1.5, K5.1–K5.3, navrh-rezervace.md kap. 1–4, 6 -->

<a id="R7.10"></a>
## R7.10 Běh linie: každá linie může mít vlastní běh

Samostatnou práci ([R7.1](#R7.1)) jde pustit na jednu linii (`strom run --research G…`). Každá linie má nejvýš jeden
běh. Běhy různých linií a běh celé fronty pracují vedle sebe, každý na jiných úkolech.

- **Hlídá kód:**
  - běh linie drží svou linii, dokud jeho proces žije. Druhý běh téže linie se hned odmítne jednou větou: „Linie
    Předci Jana Horáka už má běh (od 14:05) – jedna linie, jeden běh. Zastavit ho jde v jeho okně.“;
  - běh linie bere úkoly, jejichž hlavní linie je jeho. Hlavní linie úkolu je jeho vlastní linie, a když ta skončila,
    nejužší aktivní linie jeho lidí ([R2.1.3](R2-lines-and-queue.md#R2.1.3)). Dál bere sdílené úkoly (společný
    předek, pomoc jiné linii, [R2.3](R2-lines-and-queue.md#R2.3)), jejichž hlavní linie vlastní běh nemá. Úkol,
    jehož hlavní linii drží jiný běh, nevezme nikdy;
  - běh celé fronty vynechá každý úkol linie, která má vlastní běh, i sdílený úkol, jehož lidé do takové linie
    patří. Práce mimo linie, dějiny a místa zůstávají jemu;
  - posuzuje se při každém výběru úkolu, před jeho zabráním ([R7.9](#R7.9)). Úkol, na kterém už pracuje jiné
    sezení, se nepřebírá: rozpracované sezení ho dokončí;
  - rozhovory (`strom chat`) linii nedrží a do počtu běhů se nepočítají ([R7.10.1](#R7.10.1));
  - běh linie nezačne vedle běhu stromu staršího než 1.25. Vedle běhu novějšího stromu, který linie nezná, začne
    a řekne to: ten může brát i úkoly této linie, nikdy ale ten rozpracovaný.
- **Hranice:**
  - běh linie má vlastní okno terminálu s názvem „Strom · Horákovi · Předci Jana Horáka (G0002)“; agent pojmenuje
    své sezení podle linie. Mezitím jde z menu pustit běh jiné linie;
  - okno téže linie se znovu neotevře hned po prvním („Okno pro linii … se otevřelo před chvílí – běh pokračuje
    tam.“);
  - jen aktivní linie: pozastavená ani ukončená linie běh nedostane ([R2.1.2](R2-lines-and-queue.md#R2.1.2));
  - výzkum si pamatuje agenta, se kterým linie běžela naposledy, a nabídne ho příště v menu i v aplikaci;
  - varování při běhu vedle jiného běhu říká, že se čerpání předplatného sčítá.
- **V aplikaci:** **Pustit agenta na tuto linii** ([S4.3.3](S4-research-from-the-app.md#S4.3.3)); běhy v oddílu
  **Teď** ([S4.1.8](S4-research-from-the-app.md#S4.1.8)).
- **Ovládání:** terminál: menu **Nechat agenta pracovat samotného**; se dvěma a více aktivními liniemi se zeptá **Na
  čem má agent pracovat?**: **Fronta úkolů – na řadě: <první úkol> (a N dalších)** (linie s vlastním během jen poznámkou
  za ní), nebo **Jen jedna linie výzkumu (ve vlastním okně) ›** a v ní linie (linie s během „– už má běh“ a nespustí se). Příkaz `strom run --research G…` (s dalšími volbami [R7.1](#R7.1));
  `strom research list` ukáže čísla linií.
- **Platí od:** výzkum 1.36.0; fronta první s tím, co je na řadě, od 1.38.0

<!-- zdroj: research:089875ec src/core/linerun.ts (lineHolds .strom/lines/<G>.json zámek s procesem, run.line.held, run.line.older pro strom před 1.25, lineRunFilter: obecný běh vynechá úkol s linií drženou jiným během; běh linie bere hlavní linii G nebo úkoly v G, jejichž hlavní linii nedrží jiný běh; linie úkolu = vlastní + hlavní (placer core/offline.ts) + linie jeho lidí; mimo linie, dějiny, místa žádnou; rememberLineAgent) · src/cli/menu.ts runMenu (ui.run.where, ui.run.whole, ui.run.line.item/busy/held, openInNewTerminal title Strom · strom · linie (G…), key linie, ui.run.window, ui.run.window.recent; dějiny jen celá fronta) · src/commands/session.ts:1107 enterRun (research, agent) · cs.json ui.run.line, ui.run.line.older, ui.run.beside, ui.run.others · help run (Runs of lines) · CHANGELOG.cs.md 1.36.0 · dirigent:spec/126 U11, prace/1121-research-126-linie-b1 -->

<a id="R7.10.1"></a>
### R7.10.1 Nejvýš běhů najednou: `run.parallel`

V jednom stromu pracuje najednou nejvýš `run.parallel` běhů (výchozí 3, 1–10): běh celé fronty a běhy linií
dohromady. Rozhovory se nepočítají.

- **Hlídá kód:**
  - počítá se při startu běhu pod krátkým zámkem linií stromu. Běh navíc se odmítne a řekne, které běhy pracují
    a jak je zastavit;
  - zvýšit hodnotu smí jen člověk: `strom config set run.parallel <n>` se zeptá „Dovolit až N běhů agenta najednou
    v jednom rodokmenu (nyní M)? Každý běh čerpá předplatné agenta – čerpání se sčítá.“ Agent hodnotu nezvýší.
    Snížit smí kdokoli, i aplikace ([S4.4.12](S4-research-from-the-app.md#S4.4.12));
  - snížení pod počet běžících běhů žádný nezastaví; nový běh se spustí, až jich bude méně.
- **Hranice:** nastavení platí pro tento počítač, ne pro jeden strom.
- **Ovládání:** terminál: `strom config set run.parallel <n>`, zpět `strom config unset run.parallel`.
- **Platí od:** výzkum 1.36.0

<!-- zdroj: research:089875ec src/core/linerun.ts (run.parallel, hint strom config set run.parallel <n>, rozhovory se nepočítají) · src/core/config.ts run.parallel (tree: false, DEFAULT_RUN_PARALLEL 3, RUN_PARALLEL_MAX 10, „only you raise it“) · src/commands/setup.ts runsDecision (requireHuman jen při zvýšení), cs.json ui.consent.runParallel · src/core/live.ts runsLimitWrite (POST settings/runs: snížení, zvýšení 403 runs.raise s příkazem, mimo 1–10 400 runs.max) · src/core/liveruns.ts runLimits · help run -->

<a id="R7.10.2"></a>
### R7.10.2 Zastavit jeden běh

Každý běh jde zastavit zvlášť; ostatní běhy pracují dál. Zastavení nic nepřeruší násilím.

- **Hranice:**
  - `strom run stop <run-…>`: rozpracované sezení dokončí svůj úkol a další nezačne. S `--finish` je i rozpracované
    sezení požádáno o dokončení hned: agent zapíše, co našel, a sezení zavře jako `strom session finish`
    ([R7.3](#R7.3));
  - běh, který čeká (na podmínku, limit předplatného nebo archiv), skončí hned;
  - běh žádost přečte do jedné až dvou sekund a řekne ji ve svém terminálu. Ctrl-C v okně běhu zastaví jen ten běh;
  - číslo běhu (`run-…`) říká odmítnutí běhu navíc ([R7.10.1](#R7.10.1)) a `strom session list --open`;
  - po konci běhu linie bere její úkoly zase běh celé fronty.
- **V aplikaci:** **Zastavit** a **Dokončit a skončit** v bloku běhu ([S4.1.8](S4-research-from-the-app.md#S4.1.8)).
- **Ovládání:** terminál: `strom run stop <run-…> [--finish]`, Ctrl-C v okně běhu.
- **Platí od:** výzkum 1.36.0

<!-- zdroj: research:src/commands/session.ts run stop (help: the task at work is finished, no next one starts; --finish; a run that waits ends at once; read within a second or two) · src/core/live.ts POST runs/stop · src/commands/links.ts finish?run= finishRun (strom run stop <run> --finish) · STOP_HINT src/core/linerun.ts · help run stop -->

<a id="R7.10.3"></a>
### R7.10.3 Co si běhy na počítači dělí

Běhy na jednom počítači (všechny výzkumy se stejnou sdílenou složkou) si dělí limit předplatného agenta, dotazy
podmínky, požadavky na weby a čtenáře skenů.

- **Hlídá kód:**
  - limit předplatného, na který narazí jeden běh ([R7.6](#R7.6)), platí pro všechny běhy téhož agenta (a účtu) na
    počítači: do obnovy limitu nezačne žádné nové sezení. Běh pod podmínkou s `--loop` nebo `--until` počká, jiný
    skončí (**limit předplatného**). Rozpracované sezení pokračuje;
  - podmínky ([R7.4](#R7.4)) se běhy ptají jeden po druhém: další až poté, co začalo sezení, které podmínka pustila;
  - stránky jednoho webu, které agenti otevřou, se do `web.perHost` ([R9.3](R9-archives.md#R9.3)) počítají ze všech
    sezení na počítači za posledních `run.minutes`;
  - skeny čte najednou nejvýš `read.parallel` čtenářů na celém počítači ([R8.3.1](R8-reading-scans.md#R8.3.1)).
- **Platí od:** výzkum 1.36.0

<!-- zdroj: research:src/core/machine.ts (limit-<agent>.json ve sdílené složce agents/, brána po jednom, sloty čtenářů) · src/core/web.ts web.perHost za run.minutes ze všech sezení · src/core/config.ts read.parallel, web.perHost (počítáno na počítač) · help run (What runs share on this computer) · CHANGELOG.cs.md 1.36.0 · dirigent:spec/126 U8 -->

<a id="R7.10.4"></a>
### R7.10.4 Běh linie z odkazu aplikace Strom

- Odkaz `strom-research://work` s `research=G…` (a případně `agent=…`) požádá o běh jedné linie. Terminál výzkumu ho
  otevře v novém okně s názvem linie, řekne „Běh linie … : jen její úkoly – jiná linie může mít vedle něj vlastní
  běh.“, agenta a prvních 5 úkolů linie, a spustí `strom run --research G…` s `--tasks N` nebo `--loop` jako
  [R7.1.2](#R7.1.2).
- **Hranice:**
  - nic se nespustí, když linie ve výzkumu není, je pozastavená nebo ukončená, když program zvoleného agenta na
    počítači není, když linie už má běh, když na výzkumu pracuje běh stromu staršího než 1.25, nebo při plném počtu
    běhů („Najednou už pracuje nejvíc běhů (3 z 3, nastavení run.parallel). Nic dalšího se nespustilo.“);
  - potvrzení se řídí **Spouštěním agenta z aplikace Strom** ([S4.5.5](S4-research-from-the-app.md#S4.5.5));
  - odkaz na celou frontu se dál odmítne vedle běhu celé fronty nebo sezení mimo běhy linií. Běhy linií se mu
    počítají jen do `run.parallel`; fronta, kterou ukáže, je bez úkolů linií s vlastním během;
  - `strom-research://finish` s `run=run-…` požádá běh o dokončení a konec jako `strom run stop <run-…> --finish`
    ([R7.10.2](#R7.10.2)).
- **Ovládání:** aplikace ([S4.3.3](S4-research-from-the-app.md#S4.3.3)); terminál: `strom link open "<odkaz>"`.
- **Platí od:** výzkum 1.36.0

<!-- zdroj: research:src/cli/menu-links.ts workRun byLine (ui.link.direction.none, ui.link.work.line.state, ui.link.work.agent, ui.link.work.older, ui.run.line.held, ui.link.work.cap; obecný odkaz: busy bez běhů linií, runRefusal max; lineRunFilter; ui.run.line, ui.link.work.agent.is; run --research [--agent] --tasks|--loop) · src/commands/links.ts lineWindow (titulek Strom · strom · linie (G…), klíč linie), finish run= → finishRun · src/core/links.ts work research=, agent= -->
