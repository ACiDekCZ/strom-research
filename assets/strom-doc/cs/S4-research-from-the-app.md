<a id="S4"></a>
# S4 Výzkum řízený z aplikace

Co z výzkumu aplikace ukazuje a co z ní jde ve výzkumu spustit: běžící práce, fronta, linie a akce, které otevřou
výzkum. Popisuje aplikaci Strom 3.21.2 (a výzkum 1.25.2). Změny z novější verze mají u sebe její číslo.

<a id="S4.1"></a>
## S4.1 Panel a Přehled výzkumu ukazují běžící práci

Při sledování výzkumu ([S1](S1-connecting-app-and-research.md)) ukazuje aplikace malý panel **Živý výzkum ze Strom
Research** a z něj větší **Přehled výzkumu**. Oba jen čtou. Co ukazují, posílá výzkum přes most.

- **Hranice:**
  - Panel: **Pracuje se**, **Čeká na vyřízení**, **Poslední změny** (5 nejnovějších, odkaz **Všechny změny v přehledu
    ›**),
    **Na řadě** (3 úkoly) a pod tím počet sezení agenta za tento měsíc.
  - Když je panel vyšší než okno, sbalí se sám nejdřív **Na řadě**, pak změny, pak **Pracuje se**. **Čeká na
    vyřízení**
    se sám nesbalí nikdy. Oddíl, který sbalil nebo rozbalil člověk, zůstane, jak je.
  - Přehled, oddíly v tomto pořadí: souhrn (**Stav**, posledních 24 h, **Tento měsíc** s počtem sezení), **Teď**,
    **Čeká na vyřízení** (jen když něco čeká), **Linie** ([S4.3](#S4.3)), **Průběh**, **Fronta** ([S4.2](#S4.2)),
    **Co ví výzkum** ([S3](S3-what-the-research-knows.md)). **Fronta** a **Co ví výzkum** jsou na začátku sbalené.
  - **Průběh** slučuje kroky po 15 minutách, ukáže nejvýš 20 kroků.
  - Přehled je na širokém okně (od 1280 px) bočním panelem vedle stromu, na tabletu vrstvou přes strom, na telefonu
    celou obrazovkou. Na telefonu je z panelu pruh a klepnutí otevře přehled.
  - Bez sledování panel ukáže poslední známé **Čeká na vyřízení** s větou **Stav k {d}. Výzkum teď neběží.**
- **Ovládání:** aplikace: panel, tlačítka **⤢ Otevřít přehled** a **Ukončit sledování**; menu **Výzkum → Přehled
  výzkumu**.
- **Platí od:** aplikace 3.5.0
- **Od aplikace 3.22.0:** každý oddíl jde rozbalit, sbalit nebo skrýt a volba platí pro panel i Přehled
  ([S4.1.2](#S4.1.2)). **Čeká na vyřízení** se sám nerozbalí ani při nové položce.

<!-- zdroj: app:v3.21.2 src/ui/research-ui.ts:223 PANEL_CHANGES, :227 AUTO_FOLD, :3326 appendQueueSection(…, 3), renderLivePanel, renderIdleResearchPanel · src/ui/research-overview-ui.ts:5 (≥1280), :51 FOLDED_BY_DEFAULT, :53 GROUP_MS, :59 MAX_STEPS, :74, :309-311 · strings.ts live.overviewTitle, research.panelLabel, research.stop, research.atWork, research.queue -->

<a id="S4.1.1"></a>
### S4.1.1 Sledovat agenta ve stromu

Strom může sám přecházet na osobu, na které agent právě pracuje (první nepozastavená práce v oddílu **Teď**).

- **Hranice:** nejvýš jeden přechod za 8 s. Když je strom oddálený víc než na 0,55, přiblíží se na 0,8. Posun stromu,
  výběr jiné osoby nebo jiný pohled sledování přeruší (**Zpět k agentovi**); po 20 s bez dotyku se vrátí samo. Volba
  se pamatuje pro zařízení.
- **Ovládání:** aplikace: **Přehled výzkumu → Sledovat agenta ve stromu** / **Přestat sledovat**.
- **Platí od:** aplikace 3.5.0

<!-- zdroj: app:src/ui/live-follow-ui.ts:7, :26 ZOOM_FAR, :27 ZOOM_READABLE, :32 gap 8000 / idle 20_000 · strings.ts live.followOn, live.followOff -->

<a id="S4.1.2"></a>
### S4.1.2 Přizpůsobení panelu

Každý oddíl sledování výzkumu má jednu volbu: **Rozbalená**, **Sbalená** nebo **Skrytá**. Volba platí pro panel
i Přehled.

- **Hranice:**
  - oddíly: **Pracuje se** (v Přehledu **Teď**), **Čeká na vyřízení**, **Poslední změny** (v Přehledu **Průběh**),
    **Na řadě** (v Přehledu **Fronta**) a jen v Přehledu **Linie** a **Co ví výzkum**;
  - oddíl bez volby (**výchozí**) se ukáže jako dřív: panel sbalí, co se nevejde (**sbaleno, nevejde se**), Přehled
    má sbalenou **Frontu** a **Co ví výzkum**. Oddíl s volbou panel sám nesbalí;
  - klik na nadpis oddílu je trvalá volba (rozbalit / sbalit);
  - volba se drží na tomto zařízení pro všechny stromy, nic se nesynchronizuje. Dřívější ruční sbalení oddílů se
    převezme jednou;
  - **Vrátit výchozí** zruší všechny volby. Vrácení výchozího i skrytí oddílu z jeho menu jde chvíli vzít zpět
    (**Vrátit**). Když jsou skryté všechny oddíly, panel řekne **Všechny sekce jsou skryté.**
- **Čeká na vyřízení sbalené nebo skryté:**
  - nová položka oddíl nerozbalí. Nadpis ukáže počet a **{n} nových**; zvýrazněně, když je mezi nimi rozhodnutí
    nebo povolení (**mezi nimi rozhodnutí nebo povolení**);
  - skryté nechá štítek **Čeká {n}** v hlavičce panelu, ve shrnutí sbaleného panelu, v pruhu na telefonu
    a v Přehledu. Klik ukáže oddíl v Přehledu, dokud se Přehled nezavře (**Skrytá sekce, ukázaná do zavření
    Přehledu.**).
- **Ovládání:** aplikace: **⋯ → Upravit panel…** v hlavičce panelu i Přehledu; pravé tlačítko nebo dlouhý stisk na
  nadpisu oddílu (i klávesa Menu nebo Shift+F10); **Nastavení → Sledování výzkumu**. Na telefonu jako list zdola.
- **Platí od:** aplikace 3.22.0

<!-- zdroj: app:src/ui/live-section-prefs.ts SECTION_PREFS_KEY, PREF_KEYS, OVERVIEW_KEYS, OLD_PANEL_KEY · src/ui/live-section-edit.ts · src/ui/live-section-edit-ui.ts · src/ui/research-ui.ts:282 waitingHeadInfo, :312 waitingChip, :3180 toggle, :3215 resetLiveSections, :3225 hideLiveSection · src/ui/research-overview-ui.ts:376 shownOnce · strings.ts live.editPanel(Menu), sectionExpanded/Collapsed/Hidden/Default, resetDefaults, autoFoldedNote, allHidden, waitingShort, importantHint, shownOnce, settings groupResearchFollow · commity c4b1dcc, a56232a · spec 044 K1–K5 -->

<a id="S4.2"></a>
## S4.2 Fronta v aplikaci

Aplikace ukazuje začátek fronty výzkumu v pořadí, v jakém je agent bere ([R2.2](R2-lines-and-queue.md#R2.2)). Celá
fronta zůstává ve výzkumu.

- **Hranice:**
  - Panel ukáže 3 úkoly (**Na řadě**), přehled 20 (**Fronta**). Zbytek ukazuje řádek **a dalších {n} ve výzkumu**,
    který otevře výzkum.
  - Se dvěma a více běžícími liniemi jdou úkoly filtrovat podle linie (**Fronta podle linie**).
  - Úkol mimo linie má poznámku: **Čeká až po liniích · nepomáhá žádné linii**, **Nebere se · práce mimo linie je
    vypnutá**, nebo proč linii pomáhá (**Pomáhá linii: otázka linie**, **Pomáhá linii: připojuje lidi ke stromu**,
    **Pomáhá linii, jak uvádí agent**). Pravidla jsou v [R2.3](R2-lines-and-queue.md#R2.3).
  - Menu úkolu **Možnosti úkolu**: **Odložit** a **Vzdát**; u odloženého úkolu **Vrátit**. Každá z nich otevře
    terminál výzkumu a tam se potvrzuje ([S4.5](#S4.5)).
- **Ovládání:** aplikace: panel, oddíl **Na řadě**; **Přehled výzkumu**, oddíl **Fronta**; u úkolu **⋯**.
- **Platí od:** aplikace 3.5.0. Poznámky u úkolů mimo linie od 3.21.0 (výzkum 1.25.0).
- **Od aplikace 3.22.0:** s výzkumem 1.26.0 má každý úkol řádek, proč stojí, kde stojí
  ([R2.4](R2-lines-and-queue.md#R2.4)).
  **Udělat hned** a **Na konec** (a **Vrátit výchozí**) mění místo úkolu přímo z aplikace, bez terminálu
  ([R2.3.1](R2-lines-and-queue.md#R2.3.1)); u úkolu, na kterém agent pracuje, to nejde. Fronta se čte po stránkách:
  **Načíst další** přidá 50 úkolů, seznam drží nejvýš 300, zbytek zúží filtr linie nebo větve.
  Štítek větve (**Větev {n} {k}**) zúží celou frontu na úkoly větve; **Ukázat celou frontu** ho zruší.

<!-- zdroj: app:v3.21.2 src/ui/research-ui.ts:308 queueNoteText, :3373 appendQueueSection · research-overview-ui.ts:311 (20) · strings.ts research.queue, research.park/drop/wake, research.queueMore, research.queueOffLast, research.queueOffNever, research.queueHelps · HEAD src/research-queue-pages.ts:19 QUEUE_PAGE, :28 QUEUE_ROWS_CAP · src/ui/research-ui.ts:3884 taskDoNext/taskDoLast · strings.ts live.taskDoing, live.queueLoadMore, live.queueCapNote, live.branchQueueChip, live.branchQueueChipClear -->

<a id="S4.3"></a>
## S4.3 Linie v aplikaci

Přehled ukazuje linie výzkumu ([R2.1](R2-lines-and-queue.md#R2.1)): co na které čeká a kam došla. V aplikaci 3.21.2
se linie jen čtou; každá změna se potvrzuje v terminálu výzkumu.

- **Hranice:**
  - Oddíl **Linie · {n} aktivní** je jen při dvou a více liniích, nebo při jedné linii, když běží i práce mimo ni
    (řádek **Mimo linie**). Pozastavené a ukončené linie jsou sbalené pod **Pozastavené a ukončené · {n}**.
  - Řádek linie: druh (↑ předci, ↓ potomci, ⌕ otázka), název, osoba, počet úkolů a co čeká na vyřízení. Linie bez
    práce má **Nic nečeká, lze ji ukončit.**
  - Detail linie: známí předci po generacích, kdy se na ní naposledy pracovalo, **Pracovat na této linii**
    (rozhovor s agentem, ne v Archivu Stromu) a **Ukázat ve stromu**.
  - Menu **Akce linie**: **Pozastavit**, **Ukončit**, **Znovu spustit**. Každá otevře terminál, ten řekne, co se
    stane,
    a zeptá se na důvod ([R2.1.2](R2-lines-and-queue.md#R2.1.2)).
  - Na telefonu menu chybí: **Nic nečeká · ukončit jde ve výzkumu na počítači**.
  - Se dvěma a více liniemi panel dělí práci po liniích a jednu linii jde vybrat; podle ní se filtruje fronta.
- **Ovládání:** aplikace: **Přehled výzkumu → Linie**, u linie **⋯**.
- **Platí od:** aplikace 3.5.0 (výzkum 1.8.0). Dělení panelu po liniích od 3.13.1.
- **Od aplikace 3.22.0:** s výzkumem 1.26.0 se linie mění přímo v aplikaci ([S4.3.1](#S4.3.1)). Řádek linie
  ukáže, na čem se teď pracuje (**Teď: …**), a meze (**do {n} generací**, **před {rok}**; u pozastavené linie ne).
  Detail linie řekne, co linie našla za poslední dny (**Za {n} dní:** sezení, osoby, prameny); osoby ukáže ve
  stromu. Ukončené linie jsou sbalené na konci (**Ukončené · {n}**). V úzkém okně a na telefonu je přehled listem:
  místo úchytu pořadí šipky ▲▼.

<!-- zdroj: app:v3.21.2 src/ui/research-directions-ui.ts:156 linesMulti, :350-353 appendOverviewDirections, :385 canDo, :528 dirWork · strings.ts live.dirTitle, live.dirOutside, live.dirInactive, live.dirWork · research:v1.25.2 assets/lang/cs.json ui.link.what.direction.pause/done/resume · 3.22.0: research-directions-ui.ts:703 dirEnded, :852 dirNow, :878 dirFoundIn, :720 sheet; strings.ts live.dirLimitGen, dirLimitBefore, dirFound* -->

<a id="S4.3.1"></a>
### S4.3.1 Správa linií z aplikace

S výzkumem, který to umí, zapisuje aplikace změny linií přímo přes most. Terminál se neotevírá a nic se neplatí.

- **Hranice:**
  - **+ Nová linie** (formulář **Nová linie**: **Druh** Předci / Potomci / Otázka, **Osoba**, **Otázka**, **Název**,
    **Omezit…**). Založení nic nestojí a agent na linii začne při dalším běhu. Nová linie jde na konec pořadí.
  - **Upravit**: druh a osobu změnit nejde (jiná osoba = nová linie). Úprava platí od dalšího výběru úkolu.
  - Pořadí linií: tažením, šipkami nebo **Přesunout na začátek**. Pod seznamem stojí, jak výzkum pořadí bere:
    **Výzkum se věnuje nejvíc liniím nahoře, ostatní nestojí.** nebo **Výzkum bere linie popořadě.**
  - **Pozastavit** a **Znovu spustit** se dají vzít zpět (**Zpět**). **Ukončit…** se zeptá a vezme nepovinný důvod.
  - Když už stejná linie je, formulář to řekne (**Linie {n} už běží.**) a nabídne **Ukázat ji** nebo **Založit
    přesto**.
  - **Hledat předky** a **Hledat potomky** u osoby otevřou tento formulář.
  - Jen ke čtení: v Archivu Stromu (**Archiv: linie jen ke čtení.**), na telefonu (**Linie jde měnit ve Stromu na
    počítači, kde běží výzkum.**), a když výzkum neběží (**Výzkum neběží. Linie půjde změnit, až poběží.**).
  - Výzkum starší než 1.26.0: akce zůstávají v terminálu (**Řízení linií v aplikaci umí výzkum od verze 1.26.0.**).
  - Když výzkum zápis odmítne (například je zaneprázdněný), aplikace nic nezmění a nabídne **Zkusit znovu**.
- **Ovládání:** aplikace: **Přehled výzkumu → Linie**, **+ Nová linie**, u linie **⋯**; menu osoby **Výzkum ›**.
- **Platí od:** aplikace 3.22.0 (výzkum 1.26.0)

<!-- zdroj: app:HEAD src/ui/research-directions-ui.ts:372 DIRECTIONS_WRITE_SINCE, :628 · src/research-directions-write.ts createDirection, editDirection, setDirectionState, writeDirectionOrder · src/ui/research-actions-ui.ts:1015-1024, :1067 openDirectionForm · strings.ts live.dirNew, dirFormNew, dirFree, dirEditFree, dirLocked, dirOrderWeight, dirOrderStrict, dirArchive, dirPhoneOnly, dirBridgeDown, dirOldResearch, dirBusy, dirRetry, dirDupActive, dirShowIt, dirAnyway · research:src/core/live.ts /directions -->

<a id="S4.3.2"></a>
### S4.3.2 Práce mimo linie po větvích

Při dvou a více liniích ukazuje přehled práci mimo linie po větvích. Volby z [R2.3](R2-lines-and-queue.md#R2.3) a
[R2.3.1](R2-lines-and-queue.md#R2.3.1) jdou nastavit přímo z aplikace.

- **Hranice:**
  - Pro celý výzkum: **Jak se bere práce mimo linie**: **Občas**, **Na konci**, **Normálně**, **Nikdy**.
  - Řádek větve: osoba větve, vztah k linii (**u linie {n}**), počet úkolů, **roste**, **vlastní volba**.
  - Klik na větev ukáže její první úkoly s místem ve frontě (**Ve frontě · první {k} z {n}**, **{i}. ve frontě**)
    a odkaz **Všechny {n} úkolů ve Frontě ›**. Když úkoly větve stojí za načtenou částí fronty: **Úkoly větve
    stojí ve frontě dál ({n}).**
  - Pro větev: **Bere se:** **Občas** / **Na konci** / **Normálně** (volba výzkumu má **(výchozí)**), **Přidat
    k linii {n}** (nejbližší linie první), **Založit linii z této větve**, **Nezkoumat** (úkoly odejdou z fronty,
    nic se nesmaže), **Vrátit výchozí**. Nezkoumané větve jsou pohromadě (**Nezkoumá se · {n} větví**).
  - Otázky k rostoucím větvím ([R2.3.2](R2-lines-and-queue.md#R2.3.2)) jsou v **Čeká na vyřízení**: přidat k linii
    (u pozastavené linie **Přidat k linii {n} (pozastavená)**), založit linii, **Nechat, jak je**, nezkoumat. Bez
    odpovědi se větev bere dál jako dosud.
  - Okno **Výzkum u tohoto stromu…**, skupina **Práce mimo linie**: volba pro celý výzkum (**Občas**: „Zhruba 1 úkol
    mimo linie na {k} úkolů linií.“), **Navrhovat linie u rostoucích větví**, **Větve s vlastní volbou**
    a úkoly s ručním pořadím.
- **Ovládání:** aplikace: **Přehled výzkumu**, oddíl práce mimo linie, u větve **⋯** (**Možnosti větve**);
  **Výzkum u tohoto stromu…**.
- **Platí od:** aplikace 3.22.0 (výzkum 1.26.0)

<!-- zdroj: app:HEAD src/ui/research-offline-ui.ts:3, :104 (caps.offLineBranches, ≥2 linie) · src/research-directions-write.ts setBranchMode, setOffLineTree, answerBranchWaiting · strings.ts live.offModeLink, live.offModeCap, live.branchAddPick, live.branchCreate, live.branchNever, live.branchReset · research-offline-ui.ts:202-228 growingBranchLine, :542 branch choices, :680 branchQueueBeyond, :740 pick · strings.ts live.dirNear, branchGrows, branchOwnChoice, branchQueueHead, branchQueuePos, branchAllTasks, branchTaken, branchDefaultTag, branchAdd(Paused), branchNeverGroup, waitBranchLeave, waitBranchHint, setOutTitle, setOutOcc, setSuggest, setOwnChoice, setManualTasks, menu treeSettings · spec 038 K7 -->

<a id="S4.4"></a>
## S4.4 Čeká na vyřízení v aplikaci

Panel i přehled ukazují stejný seznam jako výzkum ([R6.1](R6-awaiting-action.md#R6.1)). Co jde vyřídit v aplikaci
a co jen ve výzkumu, říká [R6.5](R6-awaiting-action.md#R6.5).

- **Hranice:** pod seznamem stojí, kde se odpovídá: **Odpovídá se ve výzkumu. Strom se po odpovědi aktualizuje sám.**,
  u otázek k místům **Na otázky k místům se odpovídá tady.**, při obojím **Na otázky k místům se odpovídá tady, na
  ostatní ve výzkumu.** Položky jen pro terminál aplikace nedostane ([R6.1.1](R6-awaiting-action.md#R6.1.1)).
- **Ovládání:** aplikace: panel, oddíl **Čeká na vyřízení**; menu **Výzkum → Čeká na vyřízení**.
- **Platí od:** aplikace 3.4.0. Otázky k místům od výzkumu 1.25.0.

<!-- zdroj: app:v3.21.2 src/ui/research-ui.ts renderLivePanel (waiting) · strings.ts research.answerWhere, research.answerHere, research.answerMixed -->

<a id="S4.5"></a>
## S4.5 Akce, které otevřou výzkum

Většina akcí výzkumu v aplikaci je odkaz `strom-research://`. Odkaz otevře terminál výzkumu na tomtéž počítači.
Terminál řekne, co aplikace žádá, a zeptá se. Bez potvrzení v terminálu se nic nezapíše ani nezaplatí.

- **Hranice:**
  - Akce je vidět jen na počítači (ne na dotykovém zařízení), jen když výzkum odkaz ohlásil a jen když je zapnuté
    **Strom Research na tomto počítači**.
  - Odkaz nese jen čísla záznamů a pevné hodnoty, žádná jména ani volný text.
  - Terminál začne **Aplikace Strom žádá: {co} / Výzkum: {název}** a zeptá se **Pokračovat?** U práce agenta
    připíše **Agent pracuje na předplatné nebo kredit AI.**, u zadání úkolů **Výzkum zapíše úkoly pro agenta – teď
    se nic nehledá a nic se neplatí.**
  - Archiv Stromu a výzkum, který čeká na agenta, práci agenta odmítnou (rozhovor, prověření, hledání, místa, dějiny).
  - Když stejná aktivní linie už je, **Hledat předky** jen řekne **Taková linie výzkumu už je: „{name}“ – agent v ní
    pokračuje.**
  - Aplikace nepozná, jestli se terminál otevřel. Ukáže **Otevírám výzkum…** a radu **Když se nic neotevře, je potřeba
    spustit Strom Research a zkusit to znovu.**
- **Ovládání:** aplikace: **Nastavení → Data a soukromí → Strom Research na tomto počítači**.
- **Platí od:** aplikace 3.4.0 (výzkum 1.6.0). Odmítnutí v Archivu Stromu od výzkumu 1.14.0, při čekání na agenta od
  1.15.0.

<!-- zdroj: app:v3.21.2 src/ui/research-ui.ts researchLinkAvailable, launchResearchLink, :841 onComputer · strings.ts research.linksSetting, research.openingQuietHint · index.html linksSetting · research:v1.25.2 src/commands/links.ts:128 refusedHere, :153 inTerminal, :351 ui.research.exists · src/core/links.ts (hlavička) · assets/lang/cs.json ui.link.asks, ui.link.go, ui.link.cost, ui.link.tasks, ui.archive.refuse, ui.waiting.refuse -->

<a id="S4.5.1"></a>
### S4.5.1 Značky akcí

Každá akce výzkumu má jednu ze tří značek podle toho, co otevře.

| Značka | Co se stane | Akce |
|---|---|---|
| bez značky | nic neotevře terminál | **Sledovat živě**, výřez a originál v prohlížeči, načtení stromu |
| terminál | terminál ukáže nebo se zeptá; kliknutím se nic neplatí | **Otevřít výzkum**, poslání úprav, **Prověřit znovu…**, **Hledat předky**, **Odložit**, **Vzdát**, akce linie, **Dokončit a skončit**, **Vrátit poslední poslání**, nastavení, **Kontrola výzkumu** |
| AI a terminál | práce agenta, platí ji předplatné AI | **Pokračovat s agentem**, **Zeptat se agenta**, **Pracovat na této linii**, rozhovor k úkolu nebo rozporu, výzkum míst, dějiny místa |

- **Hranice:** u práce agenta aplikace při otevírání ukáže **Otevírám agenta…** a **Dotazy se zadávají agentovi.
  Práce agenta čerpá předplatné AI.** Rozhovor může místo terminálu otevřít aplikaci agenta, když je tak výzkum
  nastavený.
- **Platí od:** aplikace 3.21.0

<!-- zdroj: app:v3.21.2 src/research-link.ts:66 RESEARCH_LINK_MARKS, researchLinkMark (task do=chat, conflict do=agent, experiment do=off, fixes paid) · strings.ts research.openingAgent, research.openingAgentHint · research:v1.25.2 src/commands/links.ts:373 whereToTalk -->

<a id="S4.5.2"></a>
### S4.5.2 Kde akce jsou

- **Menu Výzkum** (jen na počítači, ne u zamčeného stromu): nahoře nejvýš 6 položek: **Čeká na vyřízení**,
  **Pokračovat s agentem**, **Přehled výzkumu** nebo **Sledovat živě**, **Otevřít výzkum**, poslání úprav. Pod tím
  **Načíst novou verzi**, **Nástroje výzkumu**, **Vrátit poslední poslání** (nejvýš 7 dní staré) a nastavení
  výzkumu. Dole stojí **pokračuje ve výzkumu na tomto počítači. Nic se nezapíše ani nezaplatí bez potvrzení tam.**
- **Nástroje výzkumu**: skupiny **Podívat se**, **Zadat práci**, **Spustit agenta**. V 3.21.2 je v nich jen
  **Kontrola výzkumu**.
- Menu osoby **Výzkum ›** (jen u osoby, kterou výzkum zná): **Prověřit znovu…** (okno s rozsahem: jen osoba, s
  rodinou,
  s předky; **Pokračuje v terminálu výzkumu, kde jsou úkoly vidět a potvrzují se. Zdarma.**), **Hledat předky**,
  **Hledat potomky**, **Zeptat se agenta**.
- **Přehled výzkumu → Teď**: u pracujícího agenta **Dokončit a skončit** ([R7.3](R7-when-the-agent-works.md#R7.3)).
- V Archivu Stromu chybí vše, co potřebuje agenta, i **Sledovat živě**.
- **Platí od:** aplikace 3.4.0; horních 6 položek od 3.14.0, **Nástroje výzkumu** od 3.19.0, **Dokončit a skončit** od
  3.5.0

<!-- zdroj: app:v3.21.2 src/ui/research-actions-ui.ts:152 UNDO_MAX_AGE_MS, :158 FIRST_LEVEL_MAX, :300 researchMenuShown, :435 tools, :1000 personResearchActions · src/research-link.ts:115 RESEARCH_TOOL_GROUPS, :132 RESEARCH_TOOL_ACTIONS · research-overview-ui.ts:811, :870 finishSession · strings.ts research.footerFull, research.tools.*, research.reviewWhere, research.continueAgent -->

<a id="S4.6"></a>
## S4.6 Co je jen v terminálu

Aplikace ukazuje a žádá, rozhoduje terminál. Co potřebuje souhlas člověka nebo stojí peníze, se vždy potvrzuje
v terminálu výzkumu, i když to začne kliknutím v aplikaci.

- **Hranice:**
  - Jen v terminálu: spuštění samostatné práce agenta a její meze ([R7.1](R7-when-the-agent-works.md#R7.1)),
    podmínka, volba agenta, nastavení fronty a položky **Jen tady v terminálu**
    ([R6.1.1](R6-awaiting-action.md#R6.1.1)).
  - Potvrzují se v terminálu: vše se značkou terminál nebo AI ([S4.5.1](#S4.5.1)), v 3.21.2 i akce linií a fronty.
  - Na telefonu odkazy nejsou; odpovídá se ve výzkumu na počítači ([S5](S5-phone.md)).
- **Platí od:** aplikace 3.4.0 (výzkum 1.6.0)
- **Od aplikace 3.22.0:** s výzkumem 1.26.0 jdou bez terminálu linie ([S4.3.1](#S4.3.1)), práce mimo linie po
  větvích
  ([S4.3.2](#S4.3.2)) a místo úkolu ve frontě ([S4.2](#S4.2)).

<!-- zdroj: research:v1.25.2 src/core/links.ts (hlavička: nic se nezapíše bez slova člověka v terminálu) · src/core/live.ts (hlavička mostu) · app:v3.21.2 src/research-link.ts:66 · HEAD src/research-directions-write.ts -->
