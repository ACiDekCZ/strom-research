<a id="R2"></a>
# R2 Linie a fronta

Podle čeho agent výzkumu vybírá, na čem bude pracovat. Popisuje výzkum 1.25.2 a aplikaci Strom 3.21.2.
Změny z novější verze mají u sebe její číslo.

<a id="R2.1"></a>
## R2.1 Linie určuje, co výzkum zkoumá

Linie výzkumu je jeden cíl: předkové osoby, potomci osoby, nebo jedna otázka. Každý úkol patří k některé linii
a agent pracuje na úkolech linií.

- **Ovládání:** aplikace: panel výzkumu, oddíl **Linie · N aktivní** · terminál: menu **Rozšířit výzkum →
  Nová linie výzkumu**, příkaz `strom research new`
- **Platí od:** výzkum 1.0.0

<!-- zdroj: research:src/core/model.ts DIRECTIONS, RESEARCH_STATES · research:src/commands/research.ts · app:strings.ts live.dirTitle -->

<a id="R2.1.1"></a>
### R2.1.1 Druhy linií a meze

- **Předkové osoby**, nejvýš zadaný počet generací, nebo jen předkové narození před zadaným rokem.
- **Potomci osoby.**
- **Jedna otázka** (smyšlený příklad: „Kdo byl otec Marie Vlkové?“).
- **Revize osoby** vzniká z revize osoby, ne z nabídky nové linie.
- **Ovládání:** terminál: `strom research new --direction ancestors|descendants --generations <n> --before <rok>
  --question "<otázka>"`. Aplikace: **+ Nová linie**, s mezemi **Nejvýš generací** a **Jen před rokem** (aplikace 3.22.0 s výzkumem 1.26.0).
- **Platí od:** výzkum 1.0.0

<!-- zdroj: research:src/commands/research.ts:79 · assets/lang/cs.json ui.research.kind · app:src/ui/research-directions-ui.ts DIRECTIONS_WRITE_SINCE -->

<a id="R2.1.2"></a>
### R2.1.2 Pozastavená a ukončená linie

- **Pozastavená:** její úkoly čekají mimo frontu, agent bere úkoly jiných linií.
- **Ukončená:** její úkoly odejdou z fronty. Nic se nemaže a linii jde znovu spustit.
- **Ovládání:** terminál: **Rozšířit výzkum → Linie výzkumu: pozastavit, ukončit nebo znovu spustit**,
  `strom research pause|done|resume`. Aplikace: oddíl Linie, akce **Pozastavit**, **Ukončit**, **Znovu spustit**.
  V aplikaci 3.21.2 se akce potvrzuje v terminálu výzkumu, od aplikace 3.22.0 přímo v panelu.
- **Platí od:** výzkum 1.8.0

<!-- zdroj: research:src/commands/research.ts:168-175 · src/cli/menu-research.ts:233-263 · app:v3.21.2 research-directions-ui.ts:554 -->

<a id="R2.1.3"></a>
### R2.1.3 Kdo do linie patří

- Linie předků: osoba, její předkové v mezích linie a manžel nebo manželka předka.
- Linie s otázkou: osoba, které se otázka týká.
- Úkol bez určené linie patří nejužší linii, do které spadají jeho lidé.
- **Platí od:** výzkum 1.0.0. Manželé a osoba otázky od 1.26.0.

<!-- zdroj: research:src/core/frontier.ts:159-194 researchPeople/linePeople · src/core/directions.ts:75-82 directionOf · CHANGELOG.cs.md 1.26.0 -->

<a id="R2.1.4"></a>
### R2.1.4 Pořadí linií je pořadí práce

Linie mají jedno pořadí a v něm na ně přichází práce: první linie má přednost.

- **Hranice:**
  - pozastavená a ukončená linie si místo drží; po znovuspuštění je zpět, kde byla. Nová linie jde na konec;
  - co pořadí pro frontu znamená, záleží na strategii ([R2.2.1](#R2.2.1)): **balanced** a **depth** dají úkolům
    první běžící linie přídavek 2 body, poslední 0, ostatním poměrně; žádná linie nestojí. **priority** bere linie
    přísně popořadě: první, dokud má práci, pak další; úkoly bez linie až po nich;
  - výzkum bez uloženého pořadí řadí linie podle priority, pak podle data založení;
  - užší mez linie (`strom research edit`) nic nesmaže: úkoly za mezí čekají mimo linii.
- **Ovládání:** terminál: `strom research list` (v pořadí práce), `strom research order G… G…`, `strom research move
  G… --to <n>|--up|--down|--first`, `strom research edit G… --name|--question|--generations|--before`. Aplikace:
  oddíl **Linie** ([S4.3.1](S4-research-from-the-app.md#S4.3.1)), telefon ([S5](S5-phone.md)).
- **Platí od:** výzkum 1.26.0

<!-- zdroj: research:src/core/order.ts workOrder, orderMode · src/core/queue.ts:237-240 lineBonus, :396 priority lineRank · src/commands/research.ts:215 research edit, :303 research order, :326 research move -->

<a id="R2.2"></a>
## R2.2 Fronta určuje, který úkol přijde na řadu

Otevřené úkoly všech běžících linií tvoří jednu frontu. Agent vždy bere první úkol. Rozdělaný úkol jde před všemi.

- **Hranice:** pořadí určují tyto klíče, každý další jen při shodě předchozích:
  1. rozdělaný úkol;
  2. ruční volba **hned** / **na konec** ([R2.3.1](#R2.3.1));
  3. úkoly dějin míst jdou za ostatními, ve vlastním pořadí; když jsou dějiny na řadě, jde jejich první úkol napřed;
  4. práce mimo linie ([R2.3](#R2.3));
  5. krátká práce napřed: propojení variant hypotéz s osobami stromu a místa, jejichž ztotožnění člověk požádal;
  6. vyprávění: když je na řadě, jde první ([R2.2.2](#R2.2.2)), jinak až po výzkumu;
  7. úkol, který jde udělat hned, před úkolem, který čeká na snímky stažené člověkem;
  8. strategie fronty ([R2.2.1](#R2.2.1));
  9. druh úkolu: podklady → kde jsou záznamy → doložení vazby → ověření → obohacení osoby → žádost do archivu →
     vyprávění;
  10. stáří úkolu.
- **Ovládání:** terminál: `strom task list`, `strom task next`. Aplikace: oddíl **Fronta**.
- **Platí od:** výzkum 1.0.0 (klíče 1, 7–10). Klíč 6 od 1.1.0, propojení hypotéz od 1.17.0, klíč 3 od 1.22.0,
  klíč 4 a místa na žádost od 1.25.0. Klíč 2 od 1.26.0.

<!-- zdroj: research:src/core/queue.ts rankTasks (řazení :374-396), LEVEL_ORDER :52, linksFirst (hypolinks.ts:453), placesFirst · verze klíčů: git log -S na „a.blocked - b.blocked“ (v1.0.0), „a.story - b.story“ (v1.1.0), „a.first - b.first“ (v1.17.0), „a.hist - b.hist“ (v1.22.0), „a.offLine - b.offLine“ a placesFirst (v1.25.0) -->

<a id="R2.2.1"></a>
### R2.2.1 Strategie fronty

- **balanced** (výchozí): střídá linie. Výš řadí vyšší prioritu linie, bližší generaci a linii, na které se poslední
  4 sezení nepracovalo. Níž řadí úkol, který už neuspěl.
- **depth:** drží se linie, na které se právě pracuje.
- **priority:** podle priority linie (1–5, výchozí 3), pak podle generace.
- **Ovládání:** terminál: `strom config set queue.strategy balanced|depth|priority`, priorita linie
  `strom research new … --priority <1–5>`.
- **Platí od:** výzkum 1.0.0
- **Od výzkumu 1.26.0:** váhu má i pořadí linií ([R2.1.4](#R2.1.4)); **priority** bere linie popořadě, uvnitř linie
  podle priority úkolu a generace.

<!-- zdroj: research:src/core/queue.ts:294-299, RECENT=4 :58 · src/core/config.ts queue.strategy · model.ts priority -->

<a id="R2.2.2"></a>
### R2.2.2 Vyprávění na řadě

Vyprávění jinak čeká, až výzkum nemá co dělat. Po 5 sezeních bez vyprávění ale přijde jedno čekající vyprávění
na řadu jako první (při samostatné práci agenta). Se strategií priority to neplatí.

- **Platí od:** výzkum 1.1.0
- **Od výzkumu 1.31.0:** při tahu vyprávění jde napřed jen první vyprávění v pořadí, ostatní zůstanou za výzkumem.
  Pořadí, v jakém úkoly bere `strom run` (s tahem vyprávění a s úkoly dějin, když jsou na řadě), ukazuje i menu
  před `strom run` („Na řadě jsou tyto úkoly, v pořadí, v jakém je agent vezme:“) a fronta v aplikaci Strom
  ([S4.2](S4-research-from-the-app.md#S4.2)); fronta mostu nese u úkolu, jestli je to vyprávění, nebo dějiny.
  `strom task next` a `strom task list` mají pořadí rozhovoru: bez tahu vyprávění.

<!-- zdroj: research:src/core/queue.ts STORY_EVERY=5 :61 · 1.31.0: research 5f48cdaf src/core/queue.ts rankTasks (turnStory: jen první vyprávění tahu), RUN_TURNS, runOrder; src/cli/menu.ts (ui.run.next), src/core/live.ts (/status queue[], GET /queue, kind story|history), src/commands/tasks.ts CONVERSATION_ORDER (task next, task list) · CHANGELOG.cs.md 1.31.0 -->

<a id="R2.2.3"></a>
### R2.2.3 Úkoly, které čekají mimo frontu

Úkol se nebere, dokud:
- je jeho linie pozastavená nebo ukončená ([R2.1.2](#R2.1.2));
- se týká jen lidí, které se stromem nespojuje žádná rodinná vazba. Nejdřív se musí doložit vazba ke stromu,
  pak se zkoumá dál. Úkol, který tu vazbu ověřuje, se bere;
- chybějí snímky knihy, kterou má číst, a čeká se na rozhodnutí, jak je získat;
- archiv, ze kterého čte, je dočasně nedostupný;
- je mimo linie s volbou **nikdy** ([R2.3](#R2.3)).

Podklady (úkol typu podklady) a rozdělaný úkol nečekají nikdy.

- **Ovládání:** terminál: `strom task list --off-tree` (úkoly mimo strom).
- **Platí od:** výzkum 1.9.0 (mimo strom); ostatní důvody podle verzí v odkazovaných pravidlech.

<!-- zdroj: research:src/core/queue.ts:205-210 waits · src/core/kin.ts:98 offTree · assets/method/core.md „The tree first, then above it“ -->

<a id="R2.3"></a>
## R2.3 Práce mimo linie

Ve výzkumu s více liniemi je **práce mimo linie** úkol o lidech, kam žádná linie nesahá (sestra předka a její rodina),
který žádné linii nepomáhá. Taková práce jde **až po práci na liniích**.

- **Hranice:** úkol linii pomáhá, a není tedy mimo linie, když jmenuje hypotézu nebo rozpor linie, připojuje lidi
  ke stromu přes člověka linie nebo jeho partnera, nebo agent zapsal, jak linii pomáhá (sourozenec předka jako kmotr
  nebo svědek, stejný dům, příjmení předka). Sourozencova vlastní rodina linii nepomáhá: připojení lidí k vedlejší
  větvi (třeba k sourozenci předka) patří do té větve a přijde na řadu podle její volby ([R2.3.1](#R2.3.1)).
  Hypotéza linie a důvod zapsaný agentem platí dál.
- **Volby:** **na konci, až po liniích** (výchozí) · **normálně, jako práce linií** · **nikdy** (úkoly se neberou, nic
  se nemaže).
- **Ovládání:** terminál: **Nastavení → Samostatná práce agenta → Práce mimo linie**,
  `strom config set queue.offLine last|normal|never`. Aplikace 3.21.2 u úkolu ukazuje **Čeká až po liniích ·
  nepomáhá žádné linii**.
- **Platí od:** výzkum 1.25.0
- **Od výzkumu 1.26.0:** nová výchozí volba **občas, jednou za čas**: jeden úkol mimo linie za 10 sezení
  (`queue.offLineShare`), z nejbližší větve. Do práce mimo linie patří i manžel nebo manželka předka ([R2.1.3](#R2.1.3)).
- **Od výzkumu 1.31.0:** linii pomáhá jen připojení lidí k člověku linie nebo k jeho partnerovi; dřív stačilo
  připojení ke komukoli ze stromu, i k sourozenci předka. Most v `/status` říká u úkolu, na kterém se pracuje, jak
  linii pomáhá (funkce `working.helps`). Aplikace 3.27.0 to ukáže v **Přehledu výzkumu** v řádku **Teď**
  („pomáhá linii … · připojuje lidi ke stromu“, „mimo linie · větev …“, [S4.1](S4-research-from-the-app.md#S4.1))
  a v úvodu volby práce mimo linie ([S4.3.2](S4-research-from-the-app.md#S4.3.2)).

<!-- zdroj: research:v1.25.2 src/core/config.ts:278 queue.offLine (popis), :715 výchozí last · HEAD model.ts OFF_LINE_CHOICES, config.ts OFF_LINE_SHARE=10 · assets/method/core.md „The lines first“ · app:strings.ts research.queueOffLast · výzkum 1.31.0: src/core/offline.ts (b: joins jen k osobě linie nebo partnerovi, jinak větev; a, c mají přednost), HelpsBy, /status working[].helps, branch · commity 576cf7e5, 2e54c8d5 · CHANGELOG.cs.md 1.31.0 „Připojení rodiny k vedlejší větvi je práce mimo linie“ · spec 036 K1.7 -->

<a id="R2.3.1"></a>
### R2.3.1 Volba pro jednu větev a jeden úkol

Kromě volby pro celý výzkum může mít vlastní volbu jedna větev (i „přidat k linii“) a jeden úkol (**hned** / **na
konec**). Užší volba vyhrává: úkol před větví, větev před výzkumem.

- **Hranice:**
  - větev: **občas**, **na konci**, **normálně**, **nikdy** (úkoly čekají mimo frontu, nic se nesmaže a nový úkol
    se v ní nenavrhne), nebo přidat k linii: úkoly větve pak linii pomáhají a jdou s ní. Volba platí i pro nové úkoly
    větve. Návrat k volbě výzkumu: výchozí;
  - úkol **hned** přijde na řadu jako další, před liniemi, místy i dějinami, a jen jednou: po sezení na něm volba
    zmizí sama. **Na konec** platí, dokud úkol není hotový nebo dokud se volba nevrátí. Úkol, na kterém agent
    pracuje, místo nezmění.
- **Ovládání:** terminál: `strom offline list|show`, `strom offline set B-P… --mode occasional|last|normal|never`,
  `--line G…`, `--default`; `strom task order T… --next|--last|--default`. Aplikace 3.22.0:
  **Udělat hned**, **Na konec**, volby větve ([S4.3.2](S4-research-from-the-app.md#S4.3.2)).
- **Platí od:** výzkum 1.26.0

<!-- zdroj: research:src/commands/offline.ts:101 offline set (BRANCH_MODES), :171 task order (next once, queue.doing) · quality/offline.json -->

<a id="R2.3.2"></a>
### R2.3.2 Rostoucí větev dostane návrh linie

Když větev mimo linie naroste na 10 otevřených úkolů nebo 5 osob, objeví se v **Čeká na vyřízení** otázka: přidat
k linii, založit linii, nechat, jak je, nebo nezkoumat. Po odpovědi „nechat“ se znovu navrhne až při dvojnásobné
velikosti. Větev s vlastní volbou a volba **nikdy** návrh nedostanou.

- **Hranice:** odpovídá jen člověk (aplikace nebo **Co čeká**); agentovi výzkum odpověď odmítne. Když je linie
  u větve pozastavená nebo ukončená, aplikace nabídne nejužší běžící linii, do které osoba větve patří; když žádná
  není, pozastavenou linii s poznámkou **(pozastavená)**.
- **Ovládání:** terminál: **Navrhovat linie u rostoucích větví** (zapnout/vypnout), `strom offline answer B-P…
  line|keep|never`, `strom config set queue.suggestTasks|queue.suggestPersons <n>`. Aplikace: **Čeká na vyřízení**,
  nastavení **Navrhovat linie u rostoucích větví** ([S4.3.2](S4-research-from-the-app.md#S4.3.2)).
- **Platí od:** výzkum 1.26.0

<!-- zdroj: research:src/core/offline.ts:449-455 grows · config.ts SUGGEST_TASKS=10, SUGGEST_PERSONS=5 · cs.json ui.wait.branch.done.keep · src/commands/offline.ts:142 offline answer (person) · app:src/ui/research-offline-ui.ts answerGrowingBranch · strings.ts live.setSuggest, live.branchAddPaused -->

<a id="R2.4"></a>
## R2.4 Proč úkol stojí, kde stojí

Každý úkol ve frontě říká důvod svého místa: v linii, pomáhá linii (a jak), mimo linie (a v jaké větvi), ruční volba,
nebo čeká, protože je linie pozastavená.

- **Ovládání:** aplikace 3.22.0: oddíl **Fronta**, řádek u úkolu (např. „pomáhá linii N · …“).
- **Platí od:** výzkum 1.26.0

<!-- zdroj: research:src/core/queue.ts:312-349 · app:strings.ts live.qWhyLine, qWhyHelps, qWhyOut, qWhyManualNext, qWhyPaused -->
