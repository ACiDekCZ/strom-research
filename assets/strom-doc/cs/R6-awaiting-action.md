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
  stránka pro telefon: **Co čeká · {n}**.
- **Platí od:** výzkum 1.3.0. Seznam po místech vyřízení a v aplikaci od 1.14.0 (aplikace 3.11.0).

<!-- zdroj: research:src/core/waiting.ts:1-12, waitingFor :303-460 (filtr :321), actsAsArchive (v1.15.0) · src/cli/menu.ts:234, :379 · CHANGELOG.cs.md 1.14.0 · app:src/ui/research-overview-ui.ts research.waiting -->

<a id="R6.1.1"></a>
### R6.1.1 Počet a co je jen v terminálu

- Řádek **Čeká: N (z toho X jen tady v terminálu, Y čeká na odpověď)** dělí počet jako aplikace. Číslo aplikace je
  N bez položek jen pro terminál a bez odeslaných dotazů.
- Jen v terminálu jsou stromy poslané z aplikace (**Aplikace Strom**), otázky ke čtení snímků (**Čtení snímků**),
  rozpory (**K rozhodnutí – rozpory**, viz [R5](R5-conflicts.md)) a mírnější podmínky archivu. V přehledu **Co čeká** jdou napřed pod
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
  **Otevřít složku (uloženo {have}/{want})**. Aplikace: **Otevřít složku** (od aplikace 3.23.0; dřív **Složka**).
- Archivy jen přes prohlížeč, snímky z aplikace a co udělá člověk: [R9.6](R9-archives.md#R9.6), [R9.9](R9-archives.md#R9.9).
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
podmínky, ověřit web, vyprávění, místo (viz [R4](R4-places.md)), rozpor (viz [R5](R5-conflicts.md)), stromy z aplikace a čtení snímků. Rozhodnutí
jdou v seznamu první.

- **Ovládání:** terminál: **Co čeká** → položka; `strom allow archive --way`, `strom place answer`,
  `strom conflict resolve`, `strom media calibrate --answer`.
- **Platí od:** výzkum 1.14.0. Rozpory od 1.20.0, místa od 1.25.0.

<!-- zdroj: research:src/core/waiting.ts:51-65 SECTION, :75 DECIDE_RANK · src/cli/menu-waiting.ts:486 decideConflictHere, :518 decidePlace, :712 decideTune · CHANGELOG.cs.md 1.20.0, 1.25.0 -->

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

<!-- zdroj: research:src/commands/tasks.ts:897-970 (requireHuman :941, task.check-person :932) · src/commands/archives.ts:586-645 · src/commands/calibrate.ts:320 · src/commands/placeid.ts:343 person · assets/method/waiting.md, narrate.md:26-31 · src/cli/menu-waiting.ts:45 ANSWER_MAX · 1.26.0: userOnly u story approve/discard, offline answer, conflict leave, sync undo/discard (commity 4683a22d, 1189532f, 942c56f9), fixes.ts edit-decisions/woken-waits (person at the terminal) -->

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
  - úkoly, které snímky vrátily dřív neprávem, vrátí do čekání oprava `strom fixes show|run|undo woken-waits`:
    úkol čeká jako předtím, i s odesláním. Úkol, na kterém se mezitím pracovalo, zůstane. Opravu spustí jen člověk
    v terminálu, v Archivu Stromu není. Dokud neproběhne, `strom check` na takové úkoly upozorní.

<!-- zdroj: research:src/commands/media.ts:135-170 wakeWaiting (1.26.0: awaits jen ta kniha, check nikdy, letter/family/web jen waitingOn; 1.27.0: web i singleBook) · src/commands/fixes.ts:835 woken-waits (commit 740e1893) · src/core/archivewait.ts:188 wakeForArchive · src/commands/tasks.ts:880-895 task park · src/core/queue.ts:112 effectiveState · app:src/ui/research-ui.ts:3473-3500 -->
