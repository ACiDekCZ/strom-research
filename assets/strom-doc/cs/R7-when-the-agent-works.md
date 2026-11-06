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
  dělat a dovolí to podmínka „{name}“** (jako `--loop`, jen s nastavenou podmínkou); příkaz `strom run`. Aplikace
  Strom 3.21.2 samostatnou práci nenastavuje; ukazuje stav běhu ([R7.4](#R7.4)) a sezení z ní jde dokončit
  ([R7.3](#R7.3)).
- **Platí od:** výzkum 1.0.0 (`--max`, `--until`, `--task`), `--loop` od 1.2.0

<!-- zdroj: research:src/commands/session.ts:737-783 (popis a volby run), :830 max, :694 parseUntil · src/cli/menu.ts:288-375 (v1.25.2) · cs.json ui.menu.run, ui.run.queue, ui.run.pick, ui.run.loop, ui.run.how -->

<a id="R7.1.1"></a>
### R7.1.1 Proč běh skončí

- Na konci běh vypíše **sezení: {n} · konec: {důvod}**: **hotovo**, **žádné otevřené úkoly**, **časový limit**
  (`--until`), **zastaveno ručně** ([R7.3](#R7.3)), **limit předplatného** ([R7.6](#R7.6)), **agent není
  přihlášený** ([R7.7](#R7.7)), odpověď podmínky ([R7.4](#R7.4)), nebo chyba (doklady, agent selhal, model).
- Když zbylé úkoly potřebují archiv, který neodpovídá, běh s `--loop` a `--until` počká (**⏸ čekám do {at}**), jiný
  skončí.
- **Platí od:** výzkum 1.0.0; čekání na archiv, který neodpovídá, od 1.22.0

<!-- zdroj: research:src/commands/session.ts:853 Stop, :1220-1268, :1277-1285 · cs.json ui.run.summary, ui.run.stop.*, ui.run.asleep.wait · CHANGELOG.cs.md 1.22.0 -->

<a id="R7.2"></a>
## R7.2 Každé sezení má časový limit

Jedno sezení trvá nejvýš nastavený počet minut, výchozí 60. Agent čas konce zná předem a strom mu ho připomíná. Při
limitu ho strom zastaví a nedokončený úkol vrátí do fronty.

- **Hranice:**
  - posledních 10 minut (krátké sezení: poslední čtvrtinu) každý příkaz `strom` řekne, kolik času zbývá; poslední
    3 minuty (krátké sezení: poslední osminu) vyzve zapsat nalezené a sezení zavřít;
  - při limitu dostane agent, který to umí (Claude Code, Codex, OpenCode, Grok), ještě 5 minut na zápis a zavření;
  - úkol, na kterém 2 sezení za sebou nic nezapsala, se odloží (**{task} odložen**); sezení ukončená člověkem se nepočítají;
  - pořadí: `--minutes` > proměnná `STROM_RUN_MINUTES` > nastavení rodokmenu > nastavení počítače > 60.
- **Ovládání:** terminál: **Nastavení: agent, samostatná práce, zprávy, archivy, údržba → Samostatná práce agenta →
  Čas na jeden úkol: {minutes} min** (5–600; 0 vrátí zpět beze změny); `strom config set run.minutes <n>`
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
- **Ovládání:** terminál: **Nastavení → Samostatná práce agenta → Práce pořád dál pod podmínkou: {gate}** (podmínka,
  nebo **žádná**); `strom config set run.gate "<název> [co jí předat]"`, `strom config unset run.gate`; obojí
  potvrzuje člověk. Aplikace: **Přehled výzkumu** u čekajícího běhu ukáže **Pozastaveno** a **pokračuje v {t}**.
- **Platí od:** výzkum 1.2.0, aplikace 3.5.0 (stav Pozastaveno)

<!-- zdroj: research:src/core/gate.ts:27-34 DEFAULT_TIMEOUT_S, DEFAULT_WAIT_MS, MIN_WAIT_MS, askGate :209-254, SHIPPED :124 · session.ts:911 gateHolds, :1038-1063 wait, markPaused, runGate :1357-1380 · config.ts run.gate tree:false · setup.ts:1537-1548 · app:v3.21.2 research-overview-ui.ts:340-347, strings.ts live.statePaused, live.pausedUntil -->

<a id="R7.4.1"></a>
### R7.4.1 Ručně spuštěné úkoly: „Spustit přesto?“

- Jedno sezení, `--max`, `--task` a menu jsou volba člověka. Podmínka se zeptá jednou, před prvním sezením. Když
  by nespouštěla (počkat, zastavit, chyba), padne otázka **Podmínka „{name}“ by teď nespouštěla — {reason}.
  Spustit přesto?** Enter znamená ne: běh skončí (**nespuštěno — podmínka „{name}“: {reason}**). Ano: sezení začnou
  a podmínka se dál neptá, kromě stropu ([R7.4.2](#R7.4.2)).
- Spouští-li běh agent, odpovídá člověk v okně systému. Skript, kterého se nikdo nemůže zeptat, se podmínky drží.
- **Platí od:** výzkum 1.2.0

<!-- zdroj: research:src/commands/session.ts:1027-1037, startAnyway :1400-1411 · cs.json ui.run.gate.once, ui.run.gate.anyway, ui.run.stop.gate.declined -->

<a id="R7.4.2"></a>
### R7.4.2 Strop: pevná hranice

- Podmínka může odpověď označit jako pevnou hranici člověka (`hard`). Běh pak skončí (**strop podmínky „{name}“**)
  a žádné „přesto“ ji nepřekročí.
- Podmínka může hlídat okno plánu agenta (`watch`). Pak se ptá před každým sezením každého běhu a sezení v práci
  dostane žádost o dokončení ([R7.3](#R7.3)), když agent ohlásí využití okna na zadané hranici.
- **Platí od:** výzkum 1.14.0

<!-- zdroj: research:src/core/gate.ts:64-71 hard, watch, parseSaid :330-348 · session.ts:1012-1026, onLimits :1175-1182 · cs.json ui.run.gate.cap, ui.run.cap.finish, ui.run.stop.gate.cap -->

<a id="R7.4.3"></a>
### R7.4.3 Záznam odpovědí podmínky

- Každá odpověď má řádek ve výstupu běhu: **· podmínka {name}: {word}{reason} (kód {status}; .strom/gate.log)**.
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
(obnoví se {at})**. Běh nečeká ani s `--loop`. Nezávisí to na podmínce.

- **Hranice:** úkol se vrátí do fronty; čas obnovení se ukáže, jen když ho agent řekl. Čekat umí jen podmínka.
- **Platí od:** výzkum 1.0.0

<!-- zdroj: research:src/commands/session.ts:1196-1206 closeSession (session.limit), :1255-1259 · src/core/session.ts:248-262 · runners/runner.ts:226 looksLikeLimit · cs.json ui.run.stop.limit, ui.run.stop.resets -->

<a id="R7.7"></a>
## R7.7 Nepřihlášený agent

Agent, který není přihlášený ke svému předplatnému, sezení neudělá. Běh skončí: **agent není přihlášený – jednou
spustit {command} a přihlásit se**.

- **Hranice:**
  - před prvním sezením to strom ověří jen u Claude Code se zvláštní složkou (`agent.claudeConfigDir` nebo
    `CLAUDE_CONFIG_DIR`, jiná než `~/.claude`). Běh pak skončí bez sezení a bez dotazu na podmínku;
  - jinak to pozná podmínka `claude-usage` (zastaví; u ručního běhu padne **Spustit přesto?**,
    [R7.4.1](#R7.4.1)), nebo sezení, které skončí chybou přihlášení.
- **Platí od:** výzkum 1.25.2; zastavení po sezení s chybou přihlášení od 1.0.0

<!-- zdroj: research:src/commands/session.ts:916 loggedOut, :1260-1264 auth · src/core/claudedir.ts claudeConfigSet :33, forClaude, claudeLoggedIn :91 · gate.ts:253-258 loggedIn · CHANGELOG.cs.md 1.25.2 -->

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
  - co pošle aplikace, se zapíše jako v archivu; pro agenta nic nevzniká a práce agenta je odmítnutá s větou, že
    výzkum čeká na agenta, a kde ho nainstalovat nebo vybrat jiného;
  - uložený režim se nemění a úkoly se neodkládají. Po instalaci agenta výzkum pokračuje sám s úkoly, které měl;
  - agent, který ve výzkumu právě pracuje (i jiný než nastavený), ho dělá výzkumem.
- **Proč:** archiv je volba člověka a strom ji za něj nezapíše. Výzkum bez agenta se jen chová jako archiv, takže po
  instalaci agenta sám pokračuje s úkoly, které měl; žádný není odložený.
- **Ovládání:** terminál: menu, první položka (**Nechat jen jako Archiv Stromu: ukládat data z aplikace Strom**,
  nebo instalace agenta); `strom mode` ukáže stav. Aplikace ukazuje takový výzkum jako **Archiv**
  ([S1.3](S1-connecting-app-and-research.md#S1.3)).
- **Platí od:** výzkum 1.15.0

<!-- zdroj: research:src/core/state.ts (hlavička, stateOf, actsAsArchive, kindOf, refuseInArchive agent.missing) · cs.json ui.mode.is.waiting, ui.waiting.refuse, ui.menu.keeparchive · CHANGELOG 1.15.0 -->
