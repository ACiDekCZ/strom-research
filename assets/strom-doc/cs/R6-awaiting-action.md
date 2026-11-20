<a id="R6"></a>
# R6 Čeká na vyřízení

Co výzkum potřebuje od člověka, kde se to ukazuje a jak se úkol po vyřízení vrátí do fronty. Popisuje výzkum 1.25.2 a aplikaci Strom 3.21.2. Změny z novější verze mají u sebe její číslo.

<a id="R6.1"></a>
## R6.1 Co čeká je jeden seznam

Všechno, na co výzkum čeká od člověka, tvoří jeden seřazený seznam: úkoly nastavené na čekání, otázky archivů,
nové verze schválených vyprávění a otázky k místům. Terminál ukazuje navíc to, co se vyřizuje jen v něm.
Seznam se pokaždé spočítá z výzkumu, nic se do něj nezapisuje.

- **Hranice:** úkol, který čeká jen na svolení archivu a nemá snímky, patří k otázce archivu. Výzkum, který slouží
  jako archiv, nemá v seznamu úkoly ani místa.
- **Ovládání:** aplikace: oddíl **Čeká na vyřízení** · terminál: menu **Co čeká (n)**, stavový řádek **Čeká: N** ·
  stránka pro telefon: **Co čeká · N**.
- **Platí od:** výzkum 1.3.0. Seznam po místech vyřízení a v aplikaci od 1.14.0 (aplikace 3.11.0).

<!-- zdroj: research:src/core/waiting.ts:1-12, waitingFor :303-460 (filtr :321), actsAsArchive (v1.15.0) · src/cli/menu.ts:234, :379 · CHANGELOG.cs.md 1.14.0 · app:src/ui/research-overview-ui.ts research.waiting -->

<a id="R6.1.1"></a>
### R6.1.1 Počet a co je jen v terminálu

- Řádek **Čeká: N (z toho X jen tady v terminálu, Y čeká na odpověď)** dělí počet jako aplikace. Číslo aplikace je
  N bez položek jen pro terminál a bez odeslaných dotazů.
- Jen v terminálu jsou stromy poslané z aplikace (**Aplikace Strom**), otázky ke čtení snímků (**Čtení snímků**),
  rozpory (**K rozhodnutí – rozpory**, viz [R5](R5-conflicts.md)), hypotézy k rozhodnutí (od výzkumu 1.28.0; od 1.31.0
  je dostane i aplikace Strom, která je umí rozhodnout, [R6.3.4](#R6.3.4)) a mírnější podmínky archivu. V přehledu **Co čeká** jdou napřed pod
  nadpisem **Jen tady v terminálu (v aplikaci Strom nejsou)**, za nimi **I v aplikaci Strom**.
- Stránka pro telefon jen čte: bez položek jen pro terminál, s vyprávěním, napřed 20 položek, nejvýš 200 najednou.
  Píše **Rozhodnout jde na počítači v Přehledu výzkumu.**
- **Platí od:** výzkum 1.21.0. Stránka pro telefon od 1.18.0, zapamatovaný počet v menu od 1.22.0.

<!-- zdroj: research:src/core/waiting.ts:127 TERMINAL_ONLY, :139 waitingSplit, :149 waitingLine · src/cli/menu-waiting.ts:215-232 · src/core/waitkept.ts · src/core/phone-watch.ts WAITING_SHOWN, WAITING_ASKED · assets/lang/cs.json ui.waiting.split*, ui.wait.only.head, ui.phone.page.waiting.where -->

<a id="R6.2"></a>
## R6.2 Úkol čeká na člověka

Když agent nemůže pokračovat bez člověka, nastaví úkol na čekání a neosobně napíše, co je potřeba. Druh čekání
určuje oddíl, skupinu a možné akce: **snímky**, **ověřit web**, **svolení archivu**, **dopis**, **rodina**,
**web**, **jiné**.

- **Hranice:** `--kind` bere jen `letter`, `family`, `web`, `other`; snímky a ověření webu mají vlastní volby, které
  spolu nejdou. Bez `--kind` se druh odvodí ze slov: otázka na člověka je **rodina**, jinak rozhodne první věta,
  potom celý text, když jmenuje právě jeden druh; jinak **jiné**. Text oslovující člověka výzkum odmítne. Nové
  nastavení čekání smaže předchozí i značku odeslání.
- **Ovládání:** terminál: `strom task wait T… --on "<co>" --kind <druh> --to "<komu>" --request notes/<soubor>
  --url <adresa>`, dodatečně `strom task edit T… --kind --to --request`.
- **Od výzkumu 1.26.0:** `--kind images` u `--images` a `--kind check` u `--check` se bere jako opakování, ne chyba.
- **Platí od:** výzkum 1.0.0. Druhy, `--to` a `--request` od 1.14.0.

<!-- zdroj: research:src/commands/tasks.ts:975-1050 task wait, :497-520 waitOptions, :392-417 stateChange · src/core/model.ts:540 WAIT_KINDS · src/core/waitkind.ts:150 waitKindOf (ASK_USER, firstClause) · assets/method/waiting.md -->

<a id="R6.2.1"></a>
### R6.2.1 Snímky uložené ručně

- Výzkum připraví složku v `inbox/` sdílené složky. Soubor nese číslo snímku (`9.jpg`, `9a.jpg`).
- Po uložení snímků do výzkumu se úkol probudí s poznámkou, které snímky chybí ([R6.7.2](#R6.7.2)).
- **Ovládání:** terminál: `strom task wait T… --images B…:<od>-<do>`, potom `strom media add --inbox`; v **Co čeká**
  **Otevřít složku (uloženo M/N)**. Aplikace: **Otevřít složku** (od aplikace 3.23.0; dřív **Složka**).
- Archivy jen přes prohlížeč, snímky z aplikace a co udělá člověk: [R9.6](R9-archives.md#R9.6), [R9.9](R9-archives.md#R9.9).
- **Od aplikace 3.30.0:** otevřená položka v aplikaci začíná blokem **Dodat** (které snímky a do které složky) s kroky
  **Web archivu ↗** → **Otevřít složku knihy** nebo **Otevřít složku** → **Mám snímky**
  ([S4.4.7](S4-research-from-the-app.md#S4.4.7)).
- **Od výzkumu 1.35.0:** čekání na snímky zapsané jinak (snímky jen ve slovech, víc knih, kniha, kterou výzkum
  nemá) `strom task wait` nezapíše a `strom task audit` takové úkoly najde a opraví ([R6.9](#R6.9)).
- **Platí od:** výzkum 1.0.0. Probuzení po uložení od 1.15.0.

<!-- zdroj: research:src/commands/tasks.ts:1000-1025 (--images, inbox) · src/commands/media.ts:135-170 wakeWaiting · assets/method/waiting.md · app:src/research-waiting.ts:251 waitingActions (folder) · src/ui/research-overview-ui.ts:1023, src/ui/waiting-task-ui.ts:231 · src/strings.ts waitingTask.openFolder -->

<a id="R6.2.2"></a>
### R6.2.2 Ověřit web

Úkol čeká, až se člověk podívá na stránku, kterou agent sám neotevře. Odpověď je **Jde to – kniha i snímky jsou
vidět**, **Jen prohlížet** nebo **Nejde to**, s nepovinnou poznámkou.

- **Hranice:** `--check` vyžaduje hledání zapsané v tomto sezení nebo u úkolu, které jmenuje stejný web. Odpovídá
  jen člověk ([R6.6](#R6.6)). Položka patří mezi **rozhodnutí**, ne mezi **web**.
- **Ovládání:** terminál: `strom task wait T… --check <adresa> --on "<co>"`; v **Co čeká** **Co tam je?**,
  `strom task wake T… --check=works|view|no`.
- **Platí od:** výzkum 1.14.0

<!-- zdroj: research:src/commands/tasks.ts:439-470 checkUrl (task.check-search) · src/core/model.ts:510 CHECK_ANSWERS · src/core/waiting.ts:51-65 SECTION · src/cli/menu-waiting.ts:637 checkSite -->

<a id="R6.3"></a>
## R6.3 Rozhodnutí

Oddíl **rozhodnutí** sbírá otázky, které zdržují agenta: svolení archivu, stahovače k potvrzení, mírnější
podmínky, ověřit web, vyprávění, místo (viz [R4](R4-places.md)), rozpor (viz [R5](R5-conflicts.md)), hypotézu (viz [R6.3.4](#R6.3.4)), stromy
z aplikace, čtení snímků a návrh znění přepisu (skupina **K rozhodnutí – přepisy**, viz
[R3.4.1](R3-verification-and-citation.md#R3.4.1)). Rozhodnutí jdou v seznamu první.

- **Ovládání:** terminál: **Co čeká** → položka; `strom allow archive --way`, `strom place answer`,
  `strom conflict resolve`, `strom media calibrate --answer`.
- **Platí od:** výzkum 1.14.0. Rozpory od 1.20.0, místa od 1.25.0, hypotézy od 1.28.0, přepisy od 1.29.0.

<!-- zdroj: research:src/core/waiting.ts:51-65 SECTION, :75 DECIDE_RANK · src/cli/menu-waiting.ts:486 decideConflictHere, :518 decidePlace, :712 decideTune · CHANGELOG.cs.md 1.20.0, 1.25.0 · 1.29.0: src/core/waiting.ts:375-390 (kind transcript, section decide, wait.group.transcripts) -->

<a id="R6.3.1"></a>
### R6.3.1 Svolení archivu

- Otázky jsou ve skupině podle archivu, stahovače ke schválení ve skupině **Stahovače**. Úkol, jehož stahování
  narazilo na otázku, čeká na rozhodnutí.
- Rozhodnutí probudí úkoly čekající na tento archiv ve všech výzkumech na počítači. Při volbě **Jen ručně – snímky
  se uloží do připravené složky** čekají dál úkoly na ručně uložené snímky. Úkol **ověřit web** se neprobudí nikdy.
- **Ovládání:** terminál: `strom allow archive --way`, menu archivů, okno stahování. Aplikace: odkaz do terminálu.
- **Platí od:** výzkum 1.14.0

<!-- zdroj: research:src/core/archivewait.ts:188-215 wakeForArchive (way "manual", check :205), waitingForDecision · src/core/waiting.ts:303-340 · assets/lang/cs.json wait.group.takeover -->

<a id="R6.3.2"></a>
### R6.3.2 Vyprávění ke schválení

- V seznamu je jen nová verze už schváleného vyprávění, ve skupině **Příběhy**. Volba: **novou verzi, místo
  staré** nebo **nechat staré (nová verze se zahodí)**.
- **Ovládání:** aplikace: **Nová verze vyprávění**, **Porovnat**, rozhodnutí odkazem do terminálu. Terminál:
  **Které vyprávění má mít rodinná kniha?**, `strom story approve|discard`.
- **Platí od:** výzkum 1.14.0
- **Od výzkumu 1.26.0:** rozhoduje jen člověk; agentovi výzkum `strom story approve|discard` odmítne ([R6.6](#R6.6)).

<!-- zdroj: research:src/core/stories.ts:169 storiesToApprove · src/core/waiting.ts:369-390 · src/cli/menu-waiting.ts:686 decideStory · src/commands/story.ts:102-134 · app:src/ui/story-compare-ui.ts -->

<a id="R6.3.3"></a>
### R6.3.3 Větve mimo linie

- Rostoucí větev mimo linie dostane otázku ve skupině **Větve mimo linie** ([R2.3.2](R2-lines-and-queue.md#R2.3.2)):
  **Přidat k linii**, **Založit linii**, **Nechat, jak je**, **Nezkoumat**.
- **Hranice:** odpovídá jen člověk ([R6.6](#R6.6)).
- **Ovládání:** terminál: **Co čeká** → položka, `strom offline answer`.
- **Platí od:** výzkum 1.26.0

<!-- zdroj: research:HEAD src/core/waiting.ts:428-451 (group branches) · src/cli/menu-waiting.ts decideBranch · assets/lang/cs.json:2359 wait.group.branches -->

<a id="R6.3.4"></a>
### R6.3.4 Hypotézy k rozhodnutí

- Hypotéza, jejíž rozhodnutí agent navrhl ([R10.3.1](R10-people-and-hypotheses.md#R10.3.1)), čeká ve skupině
  **Hypotézy k rozhodnutí**: otázka, verze a návrh („Návrh: varianta B – …“). Volba: **Rozhodnout podle návrhu**,
  **Rozhodnout jinak** (jiná verze, nebo žádná, s důvodem), **Nechat, jak je (návrh nepřijat)**.
- Za návrhy čekají otevřené hypotézy bez návrhu. Volba: **Rozhodnout** (verze, nebo žádná, s textem rozhodnutí),
  **Nechat otevřenou**. Ponechaná hypotéza se v Co čeká znovu ukáže, až agent navrhne, jak ji rozhodnout.
- Rozhodnutá nebo zrušená hypotéza otevřená z menu nabízí **Změnit rozhodnutí**: nový text rozhodnutí je povinný
  a je zároveň důvodem změny. Rozhodl-li ji agent, stojí u ní **Rozhodl agent (den).**
- **Hranice:** platí, když hypotézy rozhoduje člověk (uložená volba **Rozhoduje člověk**; bez uložené volby
  rozhoduje AI, [R10.3.2](R10-people-and-hypotheses.md#R10.3.2)); rozhoduje jen člověk ([R6.6](#R6.6)). Čeká-li
  10 a více otevřených hypotéz, aplikace v **Co ví výzkum** nabídne přepnutí na **Rozhoduje AI** (potvrdí se ve
  výzkumu). Při **Rozhoduje AI** agent
  rozhodne sám, co citovaný záznam dokládá, a čekají jen jeho návrhy (rozhodnutí, které sám udělat nesmí). Aplikace
  Strom, která hypotézy umí rozhodnout, skupinu ukáže taky ([S3.5.2](S3-what-the-research-knows.md#S3.5.2)); starší
  aplikace ji nedostane ([R6.1.1](#R6.1.1)). V Archivu Stromu skupina není.
- **Ovládání:** terminál: **Co čeká** → položka, `strom hypothesis decide H… --proposed | --keep-open`. Tytéž volby
  jsou v revizi osoby: **Rozšířit výzkum** → **Revize osoby** → **Hypotézy o osobě (n)**.
- **Platí od:** výzkum 1.28.0
- **Od výzkumu 1.29.0:** i otevřené hypotézy bez návrhu (**Rozhodnout**, **Nechat otevřenou**), **Změnit
  rozhodnutí** a volba **Kdo rozhoduje hypotézy**.

<!-- zdroj: research:src/core/waiting.ts (kind hypothesis, section decide, DECIDE_RANK 0, open: priority -1 a hypothesesOpen jen při person, leftOpen, TERMINAL_ONLY hypotheses, actsAsArchive) · src/cli/menu-waiting.ts decideHypothesis (proposed / open / decided) · src/cli/menu-research.ts:532 · assets/lang/cs.json wait.group.hypotheses, ui.wait.hypothesis.proposed/accept/other/keep/decide/keepOpen/change/byAgent · CHANGELOG.cs.md 1.29.0 · src/cli/wizard.ts 5c (doporučení) · app:src/ui/person-research-ui.ts HYPOTHESES_OFFER_MIN -->

<a id="R6.4"></a>
## R6.4 Skupiny a pořadí

Každá položka patří do skupiny podle místa, kde se vyřizuje: archiv, úřad, rodina, web nebo ostatní. Položky jedné
skupiny drží pohromadě na místě své první položky, aby šly vyřídit jednou zprávou.

- **Hranice:** pořadí určují tyto klíče, každý další jen při shodě předchozích:
  1. **K vyřízení** před **Čeká na odpověď**; odeslané od nejdéle odeslaného;
  2. oddíl: rozhodnutí → snímky a web → archivy a úřady, rodina → jiné;
  3. v rozhodnutích: stromy z aplikace a rozpory → svolení archivu → stahovače → mírnější podmínky → ověřit web →
     vyprávění a místa (a větve) → čtení snímků;
  4. priorita úkolu, vyšší napřed;
  5. stáří, starší napřed.
- Skupina úkolu: adresát `--to` (úřad nebo archiv výzkumu) → **Rodina** → úřad z dopisu → archiv nebo server
  z adresy webu → archiv knihy úkolu → archiv podle adresy → úřad → server → **Ostatní**. Pevné skupiny:
  **Příběhy**, **Stahovače**, **Aplikace Strom**, **Čtení snímků**, **K rozhodnutí – rozpory**,
  **Místa ke ztotožnění**, **Větve mimo linie**.
- **Ovládání:** aplikace: **K vyřízení** / **Čeká na odpověď**, filtr **Ukázat podle druhu** (**Rozhodnutí**,
  **Snímky**, **Archivy a úřady**, **Rodina**, **Web**, **Jiné**) · terminál: v **Co čeká** písmeno oddílu,
  `?` přepne na **Čeká na odpověď**.
- **Platí od:** výzkum 1.14.0
- **Od výzkumu 1.35.0:** výzkum u položky posílá i její knihu. Aplikace 3.30.0 umí položky seskupit podle knihy
  ([S4.4.4](S4-research-from-the-app.md#S4.4.4)); v **Co čeká** je přehled knih s nejvíc úkoly ([R6.8](#R6.8)).

<!-- zdroj: research:src/core/waiting.ts:73 SECTION_RANK, :75 DECIDE_RANK, :468 together, :478-492 ordered · src/core/waitkind.ts:238 waitGroupOf · assets/lang/cs.json:2313-2320 wait.group.* (:2359) · src/cli/menu-waiting.ts:205-232 · app:strings.ts:11958 waitingFilterLabel -->

<a id="R6.5"></a>
## R6.5 Co jde vyřídit kde

Aplikace sama zapíše jen fakt: dotaz odešel, vrací se mezi k vyřízení, přišel soubor s odpovědí. Rozhodnutí a
souhlasy bere jen terminál; tlačítka, která je potřebují, otevřou terminál výzkumu na počítači.

- **Hranice:**
  - Aplikace vyřídí sama: **Odesláno** (i za skupinu), **Vrátit mezi k vyřízení**, **Přidat soubor** (jen obrázky
    a PDF), **Text všech dotazů** a odpověď na otázku k místu (okno **Čeká na vyřízení · Místa**).
  - Odkazem do terminálu: **Odpovědět**, **Chat**, **Text dotazu**, **Složka**, vyprávění, svolení archivu.
  - Na úzké obrazovce aplikace odkazy nemá a píše **odpovídá se ve výzkumu na počítači**; na otázky k místům jde
    odpovědět i tam.
- **Ovládání:** terminál: **Co čeká** → skupina (**Text všech dotazů najednou**, **Odesláno za celou skupinu**,
  **Rozhovor s agentem k celé skupině**) nebo položka.
- **Platí od:** výzkum 1.14.0 (aplikace 3.11.0). Místa od 1.25.0.

<!-- zdroj: research:src/core/live.ts:60-80 (POST /waiting, /group, PUT /media X-Strom-Task, POST /places/answer, /conflict 403), :2761 · src/core/waiting.ts:78-88 actionsOf · app:src/ui/research-overview-ui.ts · strings.ts:9972, :10078, :11953 -->

<a id="R6.6"></a>
## R6.6 Co smí jen člověk

Odpověď za člověka agent nenapíše. Když příkaz vyhrazený člověku spustí agent, výzkum se zeptá člověka
v systémovém okně, nebo příkaz odmítne.

- **Hranice:**
  - jen člověk: odpověď na čekající úkol, odpověď na ověření webu, svolení archivu, odpověď na otázku ke čtení
    snímků a na otázku k místu; úkol čekající na ověření webu agent bez odpovědi neprobudí;
  - schválení vyprávění a **Odesláno** dává agent jen na slovo člověka; tak to říká metodika.
- **Ovládání:** terminál: **Odpovědět textem** (nejvýš 300 znaků), `strom task wake T… --answer "<text>"`.
- **Platí od:** výzkum 1.14.0. Místa od 1.25.0.
- **Od výzkumu 1.26.0:** jen člověk také: schválení a zahození vyprávění (`strom story approve|discard`; agentovi
  výzkum odmítne i `strom story set --final`), odpověď na rostoucí větev (`strom offline answer`), nechání rozporu
  z úpravy agentovi (`strom conflict leave`), vrácení a zahození poslání z aplikace (`strom sync undo|discard`)
  a opravy `strom fixes … edit-decisions|woken-waits`.
- **Od výzkumu 1.28.0:** jen člověk také rozhoduje hypotézu (`strom hypothesis decide`, i uvnitř `strom batch`);
  agent ji jen navrhne ([R10.3.1](R10-people-and-hypotheses.md#R10.3.1)).
- **Od výzkumu 1.29.0:** to platí při **Rozhoduje člověk**; bez uložené volby rozhoduje AI
  ([R10.3.2](R10-people-and-hypotheses.md#R10.3.2)). Uložit **Rozhoduje AI** tam, kde je uložené **Rozhoduje člověk**,
  nebo tu volbu smazat, smí jen člověk. Jen člověk také rozhodne, co dál s pramenem přečteným znovu
  (`strom source reading`, [R8.8.3](R8-reading-scans.md#R8.8.3)), a návrh znění přepisu, který napsal nebo
  potvrdil (`strom source proposal`, i jeho vrácení, [R3.4.1](R3-verification-and-citation.md#R3.4.1)).
- **Od výzkumu 1.35.0:** jen člověk také rozhodne, zda převzít kratší poznámku účastníka z aplikace
  (`strom sync note`, [S2.3.2](S2-edits-from-the-app.md#S2.3.2)); agent provede jen odpověď člověka na ten úkol.

<!-- zdroj: research:src/commands/tasks.ts:897-970 (requireHuman :941, task.check-person :932) · src/commands/archives.ts:586-645 · src/commands/calibrate.ts:320 · src/commands/placeid.ts:343 person · assets/method/waiting.md, narrate.md:26-31 · src/cli/menu-waiting.ts:45 ANSWER_MAX · 1.26.0: userOnly u story approve/discard, offline answer, conflict leave, sync undo/discard (commity 4683a22d, 1189532f, 942c56f9), fixes.ts edit-decisions/woken-waits (person at the terminal) · 1.28.0: analysis.ts hypothesis decide (person), batch.ts def.person (commit 9b12256a) · 1.29.0: setup.ts syncDecisions hypotheses.decide (requireHuman), config.ts hypothesesDecide výchozí agent; strom help source reading („The person's alone … an agent never decides it“), strom help source proposal („Only the person decides it“) · 1.35.0: research:fb94435f src/commands/sync.ts sync note (person, agentMay s odpovědí), src/core/shorternote.ts decideShorterNote (shorter.person) -->

<a id="R6.7"></a>
## R6.7 Odesláno, odpověď a návrat do fronty

Dopis, dotaz na rodinu nebo jiný dotaz se po odeslání přesune do **Čeká na odpověď**. Odpověď vrátí úkol do
fronty a agent ji zpracuje při další práci.

- **Hranice:** **Odesláno** jde jen u čekajícího úkolu druhu dopis, rodina nebo jiné. Po 30 dnech bez odpovědi
  píše terminál **bez odpovědi přes 30 dní**.
- **Ovládání:** aplikace: **Odesláno**, **Vrátit mezi k vyřízení** · terminál: **Odesláno**, `strom task sent T…`,
  zpět `--undo`.
- **Platí od:** výzkum 1.14.0

<!-- zdroj: research:src/commands/tasks.ts:1053-1118 task sent (task.not-waiting, task.not-sendable) · src/core/waitkind.ts:23 SENDABLE · src/cli/menu-waiting.ts:49 NO_REPLY_DAYS, :126 -->

<a id="R6.7.1"></a>
### R6.7.1 Odpověď souborem nebo slovy

- **Souborem:** soubory se stanou podklady lidí úkolu a úkol se vrátí do fronty. Úkol pro příjem podkladů nevznikne.
  Soubor nejde k úkolu, který nečeká, čeká na ověření webu nebo na svolení archivu.
- **Slovy:** odpověď se uloží k úkolu i s otázkou a úkol se vrátí do fronty. `intake --text` s `--answers` výzkum
  odmítne: odpověď slovy je jen člověka.
- **Ovládání:** aplikace: **Přidat soubor** · terminál: **Přidat soubor**, **Odpovědět textem**;
  `strom intake <soubor> --answers T…`, `strom task wake T… --answer "<text>"`.
- **Platí od:** výzkum 1.3.0 (slovy). Souborem od 1.14.0.

<!-- zdroj: research:src/commands/intake.ts:164-205 (--answers) · src/core/taskfiles.ts fileRefused · src/commands/tasks.ts:969 answers · src/core/live.ts PUT /media X-Strom-Task -->

<a id="R6.7.2"></a>
### R6.7.2 Kdy se úkol vrátí sám a odložení

- Úkol se vrátí sám, když se do výzkumu uloží snímky knihy, na kterou čeká nebo kterou jmenuje, nebo když archiv
  dostane rozhodnutí ([R6.3.1](#R6.3.1)).
- Odložený úkol není v seznamu ani ve frontě. S datem `--until` se vrátí sám, otevřený je už v ten den. Bez data
  čeká, až ho někdo probudí. Odložení vyžaduje důvod.
- **Ovládání:** terminál: `strom task park T… --reason "<proč>" --until RRRR-MM-DD`, zpět `strom task wake T…`.
  Aplikace: oddíl **Fronta**, **Odložit** (odkaz do terminálu, bez data).
- **Platí od:** výzkum 1.0.0. Návrat po snímcích od 1.15.0, po rozhodnutí archivu od 1.14.0.
- **Od výzkumu 1.26.0:**
  - snímky vrátí jen úkol, který čeká na snímky právě té knihy. Úkol čekající na ověření webu člověkem nevrátí
    nikdy. Dopis, dotaz na rodinu nebo web vrátí jen kniha, na kterou úkol čeká, ne kniha, ve které jen pracuje;
  - od výzkumu 1.27.0 vrátí úkol čekající na web (`--kind web`) i jediná kniha, ve které pracuje: snímky tam uložené
    jsou to, na co čekal. Dopis a dotaz na rodinu dál jen kniha, na kterou čekají;
  - od výzkumu 1.35.0 vrátí úkol čekající na web místo jediné knihy, ve které pracuje, kniha, pod kterou čeká
    ([R6.8.4](#R6.8.4)). Úkol, který čeká bez knihy, vrátí jen kniha, kterou jmenuje;
  - úkoly, které snímky vrátily dřív neprávem, vrátí do čekání oprava `strom fixes show|run|undo woken-waits`:
    úkol čeká jako předtím, i s odesláním. Úkol, na kterém se mezitím pracovalo, zůstane. Opravu spustí jen člověk
    v terminálu, v Archivu Stromu není. Dokud neproběhne, `strom check` na takové úkoly upozorní.

<!-- zdroj: research:src/commands/media.ts:135-170 wakeWaiting (1.26.0: awaits jen ta kniha, check nikdy, letter/family/web jen waitingOn; 1.27.0: web i singleBook) · src/commands/fixes.ts:835 woken-waits (commit 740e1893) · src/core/archivewait.ts:188 wakeForArchive · src/commands/tasks.ts:880-895 task park · src/core/queue.ts:112 effectiveState · app:src/ui/research-ui.ts:3473-3500 -->

<a id="R6.8"></a>
## R6.8 Knihy s nejvíc úkoly

Výzkum spočítá, které knihy potřebuje nejvíc jeho úkolů. Jedno ruční stažení knihy pak poslouží všem jejím úkolům
najednou. Je to nabídka, ne položka, která čeká: do počtu **Čeká: N** se nepočítá a bez stažení agent čte knihu dál
online.

- **Hlídá kód:**
  - počítají se úkoly otevřené (i rozdělané), odložené a čekající. Kniha úkolu je kniha (B…), kterou úkol jmenuje
    v tom, kde pracuje, kniha, na jejíž snímky čeká, a u čekajícího úkolu kniha, kterou mu dal agent (`--book`,
    [R6.8.4](#R6.8.4)). Úkol, který knihu nejmenuje, se nepočítá a kniha se mu nedomýšlí: počty jsou dolní mez, ne
    odhad;
  - kniha sloučená do jiné se počítá za tu druhou, kniha vzatá zpět za žádnou;
  - pořadí: nejvíc úkolů, při shodě nejvíc čekajících, pak číslo knihy;
  - u knihy: archiv, roky, přístup, kolik úkolů ji potřebuje (z toho čekají a odloženo), snímky celkem, na disku
    a chybí (celkem a chybí jen tam, kde katalog počet snímků zná), potřebné snímky, které ještě nejsou na disku
    (čísla, na která čekají její čekající úkoly), složka ve sdílené schránce a adresa knihy;
  - kniha se **nabídne** ke stažení, když ji potřebuje aspoň `books.minTasks` úkolů (výchozí 5, [R6.8.3](#R6.8.3)),
    přístup je volný nebo s přihlášením (`online-free`, `online-login`), není celá na disku a je co nabídnout: celá
    kniha tam, kde to podmínky archivu dovolují, jinak potřebné snímky, které ještě nejsou na disku
    ([R6.8.1](#R6.8.1)). Kniha, ze které podmínky nedovolují stáhnout nic, se nenabídne nikdy;
  - Archiv Stromu knihy nenabízí ([R7.8](R7-when-the-agent-works.md#R7.8)).
- **Agent u úkolu:** na začátku úkolu se agent dozví, které další úkoly potřebují stejnou knihu, aby je udělal
  spolu: v briefu u knihy a v `strom task show` řádek „the same book is needed by N more tasks: …“. Napřed otevřené,
  pak čekající a odložené, nejvýš 10 čísel úkolů, zbytek počtem.
- **Ovládání:** terminál:
  - `strom task books`: nabízené knihy; `--min <n>` jiná hranice jen pro tento výpis (1–999), `--all` každá kniha,
    kterou nějaký úkol potřebuje, `--json`;
  - `strom task list --book B…`: úkoly jedné knihy, otevřené napřed, pak odložené a čekající; s `--state` jen
    úkoly toho stavu;
  - menu **Co čeká**: klávesa **k** „knihy s nejvíc úkoly N“; když nic nečeká, knihy se ukážou pod **Nic nečeká.**
    Obrazovka ukáže nejvýš 9 knih, ostatní `strom task books`.

  Aplikace: Čeká na vyřízení, skupiny podle knihy a **Urychlit stažením**
  ([S4.4.4](S4-research-from-the-app.md#S4.4.4), [S4.4.5](S4-research-from-the-app.md#S4.4.5)).
- **Proč:** snímky patří knize, ne úkolu: jedna složka a jedno stažení slouží všem úkolům knihy.
- **Platí od:** výzkum 1.35.0

<!-- zdroj: research:c533bc0e, 198eed31, b1749433 src/core/books.ts needsBooks (open, doing, parked, waiting; ne proposal ani shorterNote), liveBook (mergedInto, retracted), booksOfTask (where B…, awaits.recordset), bookRows (registered, missing jen s images, need = awaits.images bez registrovaných, řazení tasks ↓, waiting ↓, id), offerable (minTasks, DOWNLOADABLE online-free/online-login, missing !== 0, whole nebo range/selected s needCount), tasksOfBook (open, parked, waiting), sameBookLine (SAME_BOOK_IDS_MAX 10) · src/brief/brief.ts sameBookLine u knihy (ne u odhadnutého místa) · src/commands/tasks.ts task books (--min 1–999, --all, --json), task list --book (task.book), taskDetail řádek book · src/cli/menu-waiting.ts booksHere (actsAsArchive → žádné), showBooks (BOOKS_SHOWN 9), ui.wait.c.books · src/cli/menu.ts (Nic nečeká → showBooks) · assets/lang/cs.json ui.wait.c.books, ui.books.* · CHANGELOG.cs.md 1.35.0 „Knihy s nejvíc úkoly“ · dirigent:spec/105-co-nejvic-pomuze K1.1–K1.3 -->

<a id="R6.8.1"></a>
### R6.8.1 Co z knihy jde stáhnout: podmínky archivu

Co výzkum z knihy nabídne, říkají podmínky archivu. Seznam archivů, který strom má u sebe, u archivu uvádí, co smí
člověk z knihy stáhnout ručně, s doslovnou citací podmínek, jejich stránky nebo písemné odpovědi archivu.

- **Hlídá kód:**

  | Podmínky archivu | Co se nabídne |
  |---|---|
  | archiv celou knihu nabízí (tlačítko, ZIP) nebo ji podmínky dovolují stáhnout | celá kniha |
  | jen vybrané snímky, nikdy celá kniha ani její podstatná část | jen potřebné snímky, které nejsou na disku |
  | nic | nic, kniha se nenabídne |
  | seznam archiv nezná | potřebné snímky, které nejsou na disku |

  - rozhoduje adresa knihy, jinak adresa jejího archivu;
  - potřebné snímky znají jen úkoly, které na snímky čekají. Kniha bez čekajícího úkolu se tak mimo archivy, které
    dovolují celou knihu, nenabídne.
- **Příklady ze seznamu:** celá kniha: eBadatelna SOA Praha (stahovat mohou registrovaní) a další archivy, jejichž
  podmínky to dovolují; jen vybrané snímky: DigiArchiv SOA Třeboň (písemná odpověď archivu); nic: FamilySearch,
  Archion. Moravský zemský archiv v seznamu údaj nemá
  (doslovná citace chybí): nabízejí se potřebné snímky ([R9.10.1](R9-archives.md#R9.10.1)).
- **Hranice:** podmínky archivu mají přednost před nabídkou. Celou knihu aplikace i terminál nabídnou, jen když to
  podmínky říkají.
- **Ovládání:** terminál: `strom task books --json` (pole `download`: `whole`, `range`, `selected`, `none`, a citace
  `downloadTerms`). Aplikace: „Ke stažení celá kniha“, „Ke stažení snímky …“, „Ke stažení vybrané snímky …“
  ([S4.4.4](S4-research-from-the-app.md#S4.4.4)).
- **Platí od:** výzkum 1.35.0

<!-- zdroj: research:b1749433 assets/archives.json wholeBook {how offered|allowed|selected|never, says, from terms|termsPage|reply} (ebadatelna.soapraha.cz offered termsPage; digi.ceskearchivy.cz, www.ceskearchivy.cz selected reply; aron./imgx.vychodoceskearchivy.cz, vychodoceskearchivy.cz, www.landesarchiv-nrw.de, apertus.rlp.de allowed terms; agad.gov.pl, agadd*.home.net.pl allowed reply; familysearch.org, www.archion.de never; mza.cz bez wholeBook) · src/core/terms.ts wholeBookFor · src/core/books.ts downloadOf (b.url, jinak repo.url; bez údaje range), offerable · karta prace/1116-vyzkum-105-knihy-a (V4: čísla snímků znají jen čekající úkoly), -b (MZA bez citace, range) · spec 105 rozhodnutí U1 -->

<a id="R6.8.2"></a>
### R6.8.2 Snímky uložené do složky knihy

Snímky, které člověk uloží do složky knihy ve sdílené schránce, si strom vezme sám, i když na knihu žádný úkol
nečeká. Patří knize a všechny její úkoly je pak čtou z disku.

- **Hlídá kód:**
  - složka je stejná jako u čekání na snímky, `inbox/<B… název knihy>` ([R9.6](R9-archives.md#R9.6)). Vytvoří ji
    odkaz **Otevřít složku** z aplikace, bez terminálu; most hlídá jen složky, které už jsou;
  - převzetí: hned, když běží most do aplikace Strom (soubor až po 3 s beze změny); jinak při startu dalšího sezení;
    nebo příkazem `strom media add --inbox --waiting`. Napřed složky čekajících úkolů, pak složky knih;
  - číslo snímku se bere **jen z názvu souboru** (`40.jpg`), nikdy z pořadí. Soubor bez čísla zůstane ve složce
    ležet a výpis řekne, kolik jich zůstalo; ostatní se převezmou. Když číslo nemá žádný soubor, nepřevezme se nic
    a výzkum řekne, jak soubory pojmenovat;
  - soubory JPEG 2000 (`.jp2`) z portálu Moravského zemského archivu mají v názvu snímek × 10: strom je přepočte
    zpět. Číslo, které není násobkem 10, není číslo snímku a soubor zůstane ležet;
  - kniha, která je celá na disku, z nabídky zmizí. Soubory, které ve složce leží a ještě se nepřevzaly, aplikace
    ukáže jako „převezme se N souborů“;
  - kopie od správce souborů („33 2.jpg“, „33 kopie.jpg“) je snímek 33 a soubor, který je tentýž sken jako snímek
    pod jiným číslem, se odloží vedle jako `<soubor>.same-as-M…` a ohlásí, nikdy se potichu nesmaže; stejně jako
    ve složce čekajícího úkolu ([R9.6](R9-archives.md#R9.6)).
- **Hranice:** složky čekajících úkolů se řídí [R9.6](R9-archives.md#R9.6) (tam se jinak pojmenované soubory
  očíslují i podle pořadí).
- **Ovládání:** terminál: `strom media add --inbox --waiting`, složka v `strom task books`. Aplikace: **Otevřít
  složku** u knihy ([S4.4.4](S4-research-from-the-app.md#S4.4.4)).
- **Platí od:** výzkum 1.35.0

<!-- zdroj: research:b1749433 src/core/inboxwait.ts bookFolders (knihy, které úkoly potřebují, bez čekající složky; nic se nevytváří), imageFileTimesOf (assets/archives.json mza.cz imageFileTimes 10) · edfd2b88 numberBookFiles (jen čísla ze jmen, .jp2 ÷ times, nenásobek → bez čísla, left; žádné číslo → inbox.unnamed), src/commands/media.ts (po čekajících složky knih, book: true, „N file(s) left lying“), src/core/live.ts (live.log) · src/core/inboxwatch.ts (most hlídá i složky knih) · src/commands/links.ts book?tree=&id=&do=folder (mkdir, openForUser, bez terminálu) · src/core/live.ts booksStatus pending · CHANGELOG.cs.md 1.35.0 „Snímky uložené do složky knihy“ · karta prace/1116-vyzkum-105-knihy-c · research:dddeb8a6 numberBookFiles stem = copyless(f), takeFiles same-as (i u knih: asideLine(b, …)) · 18fd10ec -->

<a id="R6.8.3"></a>
### R6.8.3 Nastavení knih

Od kolika úkolů se kniha nabízí a zda fronta pokračuje v téže knize, má každý výzkum svoje.

- **Hlídá kód:**
  - `books.minTasks`: od kolika úkolů se kniha nabídne ([R6.8](#R6.8)). Celé číslo od 1 do 999, výchozí 5;
  - `queue.sameBook`: `no` (výchozí: agent jen dostane větu o dalších úkolech knihy) nebo `yes` (fronta po sezení
    v knize se snímky na disku vezme napřed další úkol téže knihy, [R2.2.4](R2-lines-and-queue.md#R2.2.4));
  - změna v terminálu se ukáže v aplikaci a obráceně (aplikace zapisuje přes most týmiž příkazy).
- **Ovládání:** terminál: `strom config set books.minTasks <1–999> --for-tree`,
  `strom config set queue.sameBook yes|no --for-tree`, výchozí hodnota `strom config unset … --for-tree`; menu
  **Nastavení › Archivy › Knihy s nejvíc úkoly** (**Kniha nabízená ke stažení ručně od N úkolů**, **Další sezení
  v téže knize**). Aplikace: **Výzkum u stromu › Knihy** ([S4.4.6](S4-research-from-the-app.md#S4.4.6)).
- **Platí od:** výzkum 1.35.0

<!-- zdroj: research:b1749433 src/core/config.ts BOOKS_MIN_TASKS 5, BOOKS_MIN_TASKS_MAX 999, SETTINGS books.minTasks, queue.sameBook (tree, no|yes), validace „whole number from 1 to 999“ · src/cli/menu-settings.ts booksSettings (1 ui.books.min, 2 ui.books.same), položka Archivy ui.archives.books (poslední) · src/core/live.ts POST /books (config set/unset --for-tree), booksSettings · assets/lang/cs.json ui.books.settings.title, ui.books.min, ui.books.same · CHANGELOG.cs.md 1.35.0 „Knihy v aplikaci Strom a jejich nastavení“ -->

<a id="R6.8.4"></a>
### R6.8.4 Pod kterou knihou úkol čeká

Čekající úkol patří pod knihu, kterou je třeba prohledat, ne pod knihu, ve které agent našel stopu (poznámka
v matrice narozených, která vede k oddacím jiné farnosti). Pod tou knihou ho ukazuje aplikace Strom ve skupinách
podle knihy ([S4.4.4](S4-research-from-the-app.md#S4.4.4)) a do její složky se ukládají snímky pro úkol čekající na
web.

- **Hlídá kód:** kniha čekajícího úkolu, v tomto pořadí:
  1. úkol čeká na snímky s čísly (`--images`): kniha těch snímků;
  2. kniha, kterou úkolu dal agent (`strom task wait|edit --book B…`);
  3. jediná kniha, jejíž číslo (B…) stojí v textu toho, na co úkol čeká, a která není mezi knihami, ve kterých úkol
     pracuje. Čísel víc: platí další body;
  4. úkol čeká na web nebo na ověření webu (`--kind web`, `--check`), pracuje v jedné knize a vedle ní jmenuje
     volným textem místo nebo knihu, která se teprve hledá: **bez knihy** (v aplikaci pod **Bez knihy**). Čísla
     záznamů (B…, R…) se za volný text nepočítají;
  5. jinak jediná kniha, ve které úkol pracuje; žádná nebo víc: bez knihy.
- **Co se tím řídí:**
  - kniha položky v aplikaci Strom a počty knih ([R6.8](#R6.8); kniha z `--book` se počítá vedle knihy, ve které
    úkol pracuje);
  - úkol čekající na web: jeho složka ve sdílené schránce (v **Co čeká** **Otevřít složku**, v aplikaci blok **Dodat**,
    [S4.4.7](S4-research-from-the-app.md#S4.4.7)) a návrat úkolu po uložení snímků do ní ([R6.7.2](#R6.7.2)). Úkol bez knihy složku nemá a složka knihy, ve které se našla
    stopa, se mu nenabízí.
- **Hranice:**
  - jen pro čekající úkoly. Fronta, otevřené a odložené úkoly zůstávají u knihy, ve které úkol pracuje;
  - nic se nepřepisuje: body 3–5 se počítají při čtení, text čekání ani odpovědi lidí se nemění;
  - `--book` jen u čekajícího úkolu a jen se živou knihou (neznámá nebo vzatá zpět je chyba). S `--images` jen táž
    kniha jako u snímků, jiná je chyba. Nové nastavení čekání `--book` smaže ([R6.2](#R6.2)). Starší strom pole
    nechá být.
- **Agent u úkolu:** `strom task show` ukáže řádek `book B… — the book to be searched`. Když úkol čekající na web
  nebo na ověření webu knihu nemá, výstup `strom task wait` agentovi řekne, jak ji dát, až bude založená
  (`strom recordset add`, pak `strom task edit T… --book B…`).
- **Jen metodika:** průvodce agenta: kniha k prohledání, ne ta, ve které se našla stopa: `--book B…`.
- **Proč:** lepší žádná kniha než cizí.
- **Ovládání:** terminál: `strom task wait T… --kind web --book B… --on "<co>"`, `strom task edit T… --book B…`,
  `strom task show T…`. Aplikace: **Čeká na vyřízení**, skupiny podle knihy
  ([S4.4.4](S4-research-from-the-app.md#S4.4.4)).
- **Platí od:** výzkum 1.35.0

<!-- zdroj: research:8d19d4f6 src/core/books.ts waitTarget (jen waiting bez awaits: wait.book → jediné živé B… ve waitingOn mimo where (BOOK_ID_IN) → null pro web/check s jednou knihou ve where a volným textem (RECORD_ID) → undefined), bookOfTask (awaits → waitTarget → jediná kniha where), booksOfTask (+ wait.book u waiting) · src/core/inboxwait.ts webWaitBook, inboxWaitOf (web) · src/commands/media.ts wakeWaiting (web: named || webWaitBook) · src/core/waiting.ts:441 book · src/core/live.ts:2180 · src/commands/tasks.ts waitOptions --book (requireRecord recordset, liveBook → chyba vzatá zpět, s --images jen táž kniha), task edit (jen waiting, task.not-waiting), taskDetail řádek book, task wait řádek pro web/check bez knihy · src/core/model.ts wait.book · assets/method/core.md (locate, request) „The book to search, not the one the trail was found in: `--book B…`.“ · CHANGELOG.cs.md 1.35.0 „Čekající úkol pod knihou, kterou je třeba prohledat“ · dirigent:prace/1117-vyzkum-kniha-cile (Návrh A–F, „lepší žádná kniha než cizí“), 1117-research-kniha-cile -->

<a id="R6.9"></a>
## R6.9 Kontrola zápisu čekání: `strom task audit`

Úkol čekající na snímky, které člověk uloží ručně, se vrátí do fronty sám jen tehdy, když je jeho čekání zapsané
tak, jak ho strom potřebuje: snímky jedné knihy výzkumu podle čísel (`--images B…:<čísla>`), nebo podle knihy
(`--kind web --book B…`). Jedna kniha na úkol, kniha je ve výzkumu (B…) a má složku ve sdílené schránce.
`strom task audit` najde čekající úkoly zapsané jinak a ke každému řekne opravu.

- **Hlídá kód:**
  - kontrolují se čekající úkoly, které nejsou vzaté zpět, nečekají na prověření ani na povolení a nečekají na
    dopis, rodinu ani na jiné;
  - nálezy:

    | Kód | Co je špatně |
    |---|---|
    | `images-as-text` | snímky knihy jsou jen ve slovech, bez knihy a čísel; i čekání podle knihy, jehož text jmenuje přesná čísla snímků té knihy |
    | `several-books` | jedno čekání chce snímky dvou nebo více knih |
    | `book-unknown` | kniha, kterou výzkum nemá (B…) |
    | `folder-missing` | úkolu chybí jeho složka ve sdílené schránce; jen když se čekání jinak nemění |

  - odhad („≈ sn. 160“, „asi“, „cca“) není číslo snímku. Slova pro snímky se poznají česky, německy, anglicky
    a polsky;
  - u každého nálezu je oprava, kterou strom navrhne: celá (`whole`), zčásti (`part`) nebo žádná (`none`, opravu
    napíše agent), a přesné příkazy ([R6.9.1](#R6.9.1));
  - jen čte, zdarma, bez sítě. Úkol, u kterého člověk čekání nechal, jak je, se nevypíše ([R6.9.1](#R6.9.1)).
- **Agent u úkolu:** nález se agentovi řekne, když čekání zapisuje, a strom takové čekání nezapíše
  ([R6.9.2](#R6.9.2)).
- **Ovládání:** terminál:
  - `strom task audit`: všechny čekající úkoly s nálezem; na konci kontrolní seznam čekání (`each wait: …`).
    Bez nálezu „every waiting task's wait is as strom needs it“;
  - `strom task audit T…`: jeden úkol; `--all` i úkoly, které člověk nechal, jak jsou; `--json`.

  Aplikace: značka a oprava v **Čeká na vyřízení** ([S4.4.8](S4-research-from-the-app.md#S4.4.8)).
- **Platí od:** výzkum 1.35.0

<!-- zdroj: research:61c95c53, 1fe47bf3, 15312d00, 6775c199 src/core/taskaudit.ts audited (waiting, ne retracted, awaitsCheck, awaitsPermission, ne letter/family/other), findingsOf (images-as-text, several-books, book-unknown, folder-missing jen se sdílenou schránkou a bez jiného přepisu), fixOf (can whole/part/none), odhad ≈/asi/cca není číslo, slova snímků cs/de/en/pl, WAIT_CHECKLIST · src/commands/tasks.ts task audit (--all, --json, „every waiting task's wait is as strom needs it“, each wait: checklist) · strom help task audit („Reads only, free, no network.“) · CHANGELOG.cs.md 1.35.0 · app:docs/ZADANI_VYZKUM_kontrola-ukolu.md „Odpověď výzkumu (U2)“ · dirigent:spec/109 K1.3 -->

<a id="R6.9.1"></a>
### R6.9.1 Oprava v jednom kroku a cesta zpět

Oprava se zapíše jednou operací a jde vzít zpět, dokud se nic z ní nezměnilo. Co člověk chce nechat, jak je, může
nechat.

- **Hlídá kód:**
  - `--fix` (operace `task.audit-fix`, jeden commit): úkol čeká na snímky jedné knihy, podle čísel, jinak podle
    knihy. Každá další kniha dostane vlastní úkol se stejným co, proč a hotovo, když, oddělený od původního. Text
    čekání se rozdělí tak, aby se žádné slovo neztratilo: nadpis seznamu jde s každým úkolem, závěr a části bez
    knihy zůstanou u původního, položka knihy zůstane celá;
  - kniha, kterou výzkum nemá, zůstane čekáním ve slovech ve vlastním úkolu: napřed kniha
    (`strom recordset add`), pak `--images`. Když jsou všechny knihy neznámé, strom nic nemění a opravu napíše agent;
  - oprava založí složky a vezme snímky, které v nich už leží: úkol, který má všechny snímky, se vrátí do fronty;
  - `--expect <stamp>`: zapíše jen úkol, který je stejný jako při návrhu opravy, jinak odmítne (`audit.changed`).
    Úkol, který už nečeká, nebo oprava bez změny se odmítne (`audit.none`);
  - `--unfix` (operace `task.audit-unfix`) vrátí opravu, dokud se žádný z jejích úkolů nezměnil, jinak
    `audit.changed`. Oddělené úkoly se vezmou zpět (nikdy se nesmažou), původní úkol čeká přesně jako dřív. Uložené
    snímky zůstanou zaregistrované;
  - `--keep` (operace `task.audit-keep`): člověk nechá čekání, jak je. Jen člověk, agentovi strom `--keep`
    i `--unkeep` odmítne (`audit.person-only`). Platí, dokud se čekání nezmění a nové nálezy jsou mezi těmi, které
    člověk nechal. Zapíše se, kdo a kde to dal (terminál nebo aplikace). `--unkeep` (operace `task.audit-unkeep`) to
    vezme zpět.
- **Historie úkolu:** `strom task show T…` ukáže řádek „audit  kept as it is …“ nebo „fixed by the audit … (T…
  split off) — undone by strom task audit T… --unfix“.
- **Aplikace:** most dává u čekající položky nález (`audit`: druhy, oprava, razítko), náhled opravy
  (`GET <token>/waiting/<T…>/fix`) a zápis (`POST <token>/waiting/<T…>` s `do: fix|unfix|keep|unkeep`
  a `expect`), funkce `tasks.audit`. Platí i v Archivu Stromu
  ([S4.4.8](S4-research-from-the-app.md#S4.4.8), [S4.4.9](S4-research-from-the-app.md#S4.4.9)).
- **Ovládání:** terminál: `strom task audit T… --fix`, `--unfix`, `--keep`, `--unkeep`, `--expect <stamp>`,
  `--dry-run`. Aplikace: **Opravit**, **Vrátit** v oznámení, **Nechat, jak je**.
- **Platí od:** výzkum 1.35.0

<!-- zdroj: research:61c95c53, 15312d00, 6775c199 src/core/taskaudit.ts fixOf (wait-images / wait-book, split, left book-unknown, jen neznámé → nic), applyAuditFix (atomicky, expect → audit.changed, bez změn audit.none, before, rozdělení textu, splitFrom, op task.audit-fix), takeWaiting, sealAuditFix, undoAuditFix (audit.changed, dropped + retracted, original přesně, snímky zůstanou, op task.audit-unfix), keepAudit (auditKept at, by, givenIn, kinds, wait; podmnožina druhů; op task.audit-keep / task.audit-unkeep) · src/commands/tasks.ts task audit (--fix, --unfix, --keep, --unkeep, --expect jen s fix/keep, audit.person-only, STROM_FOR_APP → by app), task show řádky audit · strom help task audit · app:docs/ZADANI_VYZKUM_kontrola-ukolu.md „Odpověď výzkumu (U2)“ (most, kódy 409/404/503/423/507, i v archivu) · dirigent:spec/109 K1.5 -->

<a id="R6.9.2"></a>
### R6.9.2 Čekání se nezapíše špatně a agent se to dozví

Strom čekání s nálezem nezapíše a agentovi řekne, co u úkolu ještě není, jak má být.

- **Hlídá kód:**
  - `strom task wait` a `strom task edit` s `--on`, `--kind`, `--url` nebo `--book` čekání s nálezem odmítnou
    (`task.wait-images`) a dají přesné příkazy. Chybějící složka se neodmítá;
  - po `strom task wait` dostane agent řádek „check the task's wait: …“ s kontrolním seznamem, když čekání ještě
    není, jak má být. `strom task park`, jehož důvod jmenuje snímky knihy výzkumu, agentovi řekne, že ručně
    ukládané snímky jsou čekání, ne odložení, s přesným příkazem;
  - `strom session close` řekne totéž za úkoly sezení (`--json`: `audit`); `strom session finish` ne;
  - `strom chat --task T…` u úkolu s nálezem začne pro agenta větou „Jeho čekání není zapsané tak, jak ho strom
    potřebuje (…). Spusť `strom task audit T…`, navrhni mi opravu a zapiš ji, až s ní tady budu souhlasit.“
- **Hranice:** agent opravu zapíše až po souhlasu člověka v rozhovoru. Nechat čekání, jak je, smí jen člověk
  ([R6.9.1](#R6.9.1)).
- **Ovládání:** terminál: `strom task wait`, `strom task edit`, `strom task park`, `strom session close`,
  `strom chat --task T…`. Aplikace: **Probrat s agentem** u nálezu ([S4.4.8](S4-research-from-the-app.md#S4.4.8)).
- **Platí od:** výzkum 1.35.0

<!-- zdroj: research:61c95c53, 15312d00 src/core/taskaudit.ts refuseWait (task.wait-images, kromě folder-missing, waitCommands), WAIT_CHECKLIST · src/commands/tasks.ts checkWaitLine, parkedForImages · src/commands/session.ts:373 session close (check of each wait, --json audit) · assets/lang/cs.json ui.chat.task.audit.say, ui.chat.task.audit.images/books/unknown/folder.say · CHANGELOG.cs.md 1.35.0 · app:docs/ZADANI_VYZKUM_kontrola-ukolu.md „Odpověď výzkumu (U2)“ K1.1, K1.2, V11 · dirigent:spec/109 K1.1, K1.2 -->
