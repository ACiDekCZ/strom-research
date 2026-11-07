<a id="R5"></a>
# R5 Rozpory

Jak ve výzkumu vzniká rozpor, kdo ho rozhoduje, co agent nesmí přepsat a kde se rozpor ukazuje a rozhoduje.
Popisuje výzkum 1.25.2 a aplikaci Strom 3.21.2.

<a id="R5.1"></a>
## R5.1 Rozpor zapisuje, že se prameny neshodují

Když se záznamy o jedné osobě liší (jméno, datum, věk), agent nevybírá potichu jeden z nich. Zapíše rozpor:
obě tvrzení s prameny a otázku, kterou je potřeba rozhodnout. Rozpor zůstává otevřený, dokud ho někdo nerozhodne
se zdůvodněním ([R5.3](#R5.3)).

- **Hranice:**
  - rozpor má aspoň 2 tvrzení a týká se aspoň jedné osoby nebo jiného záznamu;
  - údaj, kterého se týká, se zapisuje značkou GEDCOM (BIRT, DEAT, NAME, SEX…). Aplikace pak rozpor ukáže
    u tohoto údaje;
  - rozpor vzniká i tehdy, když se dvě nezávislá čtení téže buňky liší (viz [R3](R3-verification-and-citation.md));
  - co by rozpor rozhodlo, se zapíše jako úkol k rozporu;
  - otevřený rozpor u osoby s doloženými údaji hlásí kontrola stromu jako varování.
- **Ovládání:** terminál: `strom conflict add "<otázka>" --about P… --fact BIRT --claim "S…: …" --claim "S…: …"`,
  `strom conflict list [--about P…] [--all]`, `strom conflict show X…`, úkol k rozporu `strom task add … --about X…`,
  kontrola `strom check`.
- **Platí od:** výzkum 1.0.0

<!-- zdroj: research:assets/method/recording.md:69-85 · assets/method/core.md:38-41 „Nothing is deleted“ · assets/method/verify.md:11-12 · src/commands/analysis.ts:470-512 conflict add, :601 list, :626 show · src/core/check.ts:98 open-conflict -->

<a id="R5.1.1"></a>
### R5.1.1 Jiní rodiče znamenají dvě osoby, ne rozpor

Dva záznamy, které dávají stejnému jménu jiné rodiče (jinou matku), popisují **dvě osoby**. Platí to i ve stejném
domě a se stejným jménem otce. Rozdíl se nevysvětluje chybou písaře a nerozhoduje se většinou záznamů.

- **Hranice:** „Je to tatáž žena?“ je hypotéza, ne rozpor. Jedna osoba s rozporem to je až tehdy, když to doloží
  jiný záznam. Smyšlený příklad: dva křty Marie Vlkové ve stejné obci, jednou s matkou Horákovou, jednou s jinou
  matkou. To jsou dvě Marie a hypotéza, zda jde o jednu.
- **Ovládání:** terminál: `strom hypothesis add`.
- **Platí od:** výzkum 1.0.0

<!-- zdroj: research:assets/method/core.md:15-22 „A namesake is not your person“ · assets/method/recording.md:74-76 -->

<a id="R5.2"></a>
## R5.2 Úprava z aplikace u údaje doloženého záznamem se stane rozporem

Úpravy poslané z aplikace Strom výzkum zapíše tak, aby nic, o co se opírá, nezmizelo. Změna údaje, který doložil
záznam, proto údaj nepřepíše. Vznikne rozpor mezi hodnotou z aplikace a hodnotou výzkumu.

- **Hranice:** co se stane s úpravou z aplikace:
  1. nový údaj nebo osoba: zapíše se jako **Vodítko** s pramenem „Úpravy v aplikaci Strom (…)“;
  2. změna údaje, který záznam nedokládá: údaj se opraví (s důvodem);
  3. zpřesnění údaje doloženého záznamem (místo tam, kde žádné nebylo, den k roku, podrobnější místo): doplní se
     k údaji, bez rozporu;
  4. jiná změna údaje doloženého záznamem: **rozpor**. Totéž u jména, titulu před jménem a za jménem a pohlaví;
  5. dítě zařazené k jiným rodičům, než u kterých ho výzkum vede jako narozené: vždy rozpor „rodiče“;
  6. osoba odebraná v jedné kopii aplikace a mezitím upravená jinde (v jiné kopii nebo ve výzkumu): rozpor, zda
     zůstane ve stromu.
- Údaj doložený záznamem je údaj ve stavu **Doložené** nebo **Pravděpodobné**, který cituje pramen jiný než rodokmen,
  rodinnou paměť nebo vlastní text autora.
- Do rozhodnutí zůstává v aplikaci hodnota z aplikace, výzkum má na tom místě svou.
- Stejná úprava poslaná znovu nový rozpor nezaloží. Jinak změněná úprava jen přepíše stranu aplikace v otevřeném
  rozporu.
- **Ovládání:** aplikace: po poslání **Zapsáno, N rozporů k rozhodnutí** a **Ukázat**. Terminál: výpis
  `strom sync` u každé změny řekne **rozpor k rozhodnutí (výzkum to má ze záznamu)** nebo **rozpor k rozhodnutí
  (výzkum má jiné rodiče)**. Poslání jde vrátit: `strom sync undo I…`.
- **Platí od:** výzkum 1.5.0. Zpřesnění bez rozporu a rozpor rodičů od 1.12.0, rozpor odebrané osoby od 1.20.0.

<!-- zdroj: research:src/core/sync.ts:1-19, recordBacked :2238, výběr akce :2406-2520 (refine :2511, addsTo :3475), parentsConflict :2848, openConflict :3486, conflictOfEdit :4888 · src/core/conflicts.ts:19 isEditConflict · cs.json ui.sync.do.conflict, ui.sync.do.parents, ui.sync.do.refine, ui.sync.source.app.day · app:strings.ts sync.flyConflict, sync.showConflicts, sync.writtenConflictsSub · CHANGELOG.cs.md 1.20.0 -->

<a id="R5.2.1"></a>
### R5.2.1 Když platí úprava z aplikace

Volba stromu určuje, co se stane se změnou údaje doloženého záznamem:

- **rozpor k rozhodnutí** (výchozí): výzkum drží hodnotu ze záznamu a založí rozpor;
- **platí úprava z aplikace:** údaj ze záznamu se stáhne s důvodem a platí úprava. Nic se nemaže, v historii zůstane.
- **Hranice:** Archiv Stromu a výzkum, který čeká na svého agenta, berou úpravy z aplikace vždy jako platné. Rozpor
  rodičů a rozpor odebrané osoby vznikají i tam.
- **Ovládání:** terminál: `strom config set sync.edits conflict|user`. Volba platí pro jeden strom. Zapnout
  **platí úprava z aplikace** smí jen člověk: strom se zeptá „Mají mít úpravy v aplikaci Strom přednost před tím,
  co říká záznam?“.
- **Platí od:** výzkum 1.5.0; Archiv Stromu a otázka člověku od 1.12.0.

<!-- zdroj: research:v1.25.2 src/core/config.ts:283 sync.edits · src/commands/setup.ts:1163-1167 syncDecisions requireHuman · src/core/sync.ts:2283-2285 mirror · src/core/state.ts:44 actsAsArchive · cs.json ui.sync.mode.conflict, ui.sync.mode.user, ui.sync.edits.archive, ui.consent.edits.user -->

<a id="R5.3"></a>
## R5.3 Kdo rozpor rozhoduje

Rozpor mezi prameny rozhoduje agent, když prameny dovolí závěr. Rozpor z úpravy v aplikaci čeká na člověka.
V Archivu Stromu a ve výzkumu, který čeká na svého agenta, rozhoduje všechny rozpory člověk. Každé rozhodnutí má
závěr a zdůvodnění: který doklad převážil který.

- **Hranice:**
  - rozhodnutí bez závěru nebo bez zdůvodnění se nezapíše;
  - u rozhodnutí se zapíše, kdo rozhodl: uživatel (terminál bez agenta, odkaz z aplikace) nebo agent (jeho
    sezení). Z menu a z odkazu končí zdůvodnění slovy „(rozhodnutí uživatele)“;
  - člověk může rozhodnout i rozpor mezi prameny: vybere tvrzení, které platí, nebo napíše vlastní závěr;
  - rozhodnutý rozpor jde rozhodnout znovu jen s důvodem. Dřívější rozhodnutí zůstane v poznámce rozporu
    („dříve rozhodl uživatel…“, „dříve rozhodnuto ve výzkumu…“).
- **Ovládání:** terminál: `strom conflict resolve X… --resolution "…" --reasoning "…"`, znovu s `--reason "…"`.
  Kde se rozhoduje v menu a v aplikaci: [R5.6](#R5.6).
- **Platí od:** výzkum 1.0.0. Druhé rozhodnutí jen s důvodem od 1.6.0, záznam, kdo rozhodl, od 1.14.0.
- **Od výzkumu 1.26.0:**
  - rozpor z úpravy rozhoduje jen člověk. Agentovi výzkum rozhodnutí odmítne, dokud mu ho člověk nenechá
    (`strom conflict leave X…`, v aplikaci **Nechat na agentovi**); `strom conflict leave` je jen pro člověka;
  - rozpory z úprav, které agent rozhodl dřív, otevře znovu oprava `strom fixes show|run|undo edit-decisions`.
    Rozhodnutí agenta zůstane v poznámce rozporu, údaje se nezmění. Opravu spustí jen člověk v terminálu, v Archivu
    Stromu není. Dokud neproběhne, `strom check` na takové rozpory upozorní.

<!-- zdroj: research:assets/method/recording.md:76-78 · src/commands/analysis.ts:515-598 conflict resolve (by :561, poznámka „earlier decided“ :572-573, zápis :581) · src/core/conflicts.ts:105-113 againAllowed conflict.decided · src/core/conflicts.ts:27 conflictsToDecide · src/cli/context.ts:577 actor · cs.json ui.link.conflict.by, ui.conflict.earlier.* · 1.26.0: src/commands/analysis.ts:525, :572 conflict.users, :625 conflict leave (commit 1189532f) · src/commands/fixes.ts edit-decisions, strom check agent-decided-edit (commit 740e1893) -->

<a id="R5.3.1"></a>
### R5.3.1 Rozpor z úpravy se rozhoduje stranou

Rozpor z úpravy v aplikaci má dvě strany: hodnotu z aplikace a hodnotu výzkumu. Rozhoduje se výběrem strany.

- **Hodnota z aplikace:** zapíše se do údaje. Údaj ze záznamu se stáhne s důvodem a zůstane v historii. Hodnota
  z aplikace stojí vedle jako **Možné**. Vodítko se opraví přímo.
- **Hodnota výzkumu:** údaj ve výzkumu zůstane, jak je. Aplikace hodnotu výzkumu dostane po načtení jeho verze
  (předtím se uloží záloha).
- **Hranice:** závěr, který se přesně shoduje s hodnotou jedné strany, platí jako výběr této strany. Závěr, který
  neodpovídá žádné straně, rozpor uzavře, ale údaj nezmění; výpis řekne, jak vzít hodnotu z aplikace.
  Rozpor rodičů: hodnota z aplikace přesune dítě k rodičům z aplikace.
- **Ovládání:** terminál: `strom conflict resolve X… --take user|research --reasoning "…"`.
- **Platí od:** výzkum 1.12.0

<!-- zdroj: research:src/core/sync.ts:4771-4800 takeSide · src/commands/analysis.ts:543-550 (strana podle závěru), :596 ui.conflict.left · cs.json ui.conflict.left · app:strings.ts conflict.keepNote, conflict.takeNote -->

<a id="R5.4"></a>
## R5.4 Rozhodnutí člověka platí

Co člověk rozhodl (v aplikaci, odkazem z ní nebo v terminálu), platí. Agent ho rozhodne znovu jen na základě
pramene, který rozhodnutí ještě nezvážilo, a s důvodem. Nové čtení téhož záznamu nic nemění.

- **Hranice:**
  - zvážené prameny jsou prameny všech tvrzení rozporu a u rozporu z úpravy i prameny upraveného údaje;
  - stejné pravidlo platí pro nový rozpor o témž údaji téže osoby: agent ho založí jen s novým pramenem a důvodem;
  - jednou vzatou stranu nejde vzít znovu, údaj se pak mění příkazy pro údaje. Výjimka: zda osoba zůstane ve
    stromu, jde rozhodnout znovu oběma směry;
  - rozhodnutí agenta může agent rozhodnout znovu s důvodem, bez nového pramene.
- **Ovládání:** terminál: `strom conflict resolve X… --resolution "…" --reasoning "…" --source S… --reason "<co
  nový záznam ukazuje>"`. Bez nového pramene strom odmítne a navrhne zeptat se člověka.
- **Platí od:** výzkum 1.14.0

<!-- zdroj: research:src/core/conflicts.ts:89-98 weighedSources, :100-132 againAllowed (conflict.taken, conflict.user-decided) · src/commands/analysis.ts:495-509 conflict add · assets/method/recording.md:78-82 -->

<a id="R5.5"></a>
## R5.5 Co agent nepřepíše

Některé věci jsou slovem člověka. Agent je nepřepíše, ani když najde něco jiného. Rozdíl zapíše vedle, nebo se zeptá.

- **Přepis uživatele:** přepis záznamu z aplikace agent přečte naslepo sám. Shoda: poznámka u pramene, že ho
  přečetl i výzkum. Rozdíl: rozpor s oběma čteními. Přepis uživatele se nepřepisuje a nebere se jako doložený.
  Je to pravidlo metodiky agenta.
- **Schválené vyprávění:** po schválení člověkem je zamčené. Novou verzi agent zapíše vedle a ta čeká na člověka:
  schválit místo staré, nebo ponechat starou.
- **Ruční poloha místa:** poloha umístěná ručně se nemění. Když záznamy říkají jinak, objeví se v **Čeká na
  vyřízení** otázka **Rozpor polohy** ([R4.3](R4-places.md#R4.3)).
- **Rozhodnutí člověka v rozporu:** [R5.4](#R5.4).
- **Ovládání:** terminál: `strom story approve P…`, `strom story discard P…`; menu **Co čeká**.
- **Platí od:** přepis uživatele výzkum 1.12.0, schválené vyprávění 1.10.0, ruční poloha 1.25.0.
- **Od výzkumu 1.26.0:** `strom story approve|discard` spustí jen člověk. Agentovi výzkum odmítne i zápis
  vyprávění rovnou jako schváleného (`strom story set --final`).

<!-- zdroj: research:assets/method/verify.md:19-24 · src/commands/story.ts:94-96, :103 story approve, :121 story discard (1.26.0 person only, story.final) · src/core/placeid.ts:714 personsHand, :805-808 place.manual, :924 · app:strings.ts places.dialog.whoHand, places.waiting.kind.conflict -->

<a id="R5.6"></a>
## R5.6 Kde jsou rozpory vidět a kde se rozhodují

V aplikaci jsou rozpory vidět u osoby a u jejích údajů. Rozhodnutí se ale vždy zapíše ve výzkumu, na počítači,
kde výzkum běží. Aplikace otevře výzkum v terminálu a ten se zeptá na potvrzení a na důvod.

- **Aplikace – kde je rozpor vidět:**
  - nabídka osoby **Co ví výzkum** s počtem rozporů, v dialogu oddíl **Rozpory** (otevřené i rozhodnuté);
  - panel výzkumu, oddíl **Co ví výzkum**: řádek pro každý otevřený rozpor;
  - v úpravě osoby u pole značka **rozpor ›**;
  - na kartě osoby značka rozporu (zapíná se v **Na kartě ukázat → Rozpory v pramenech**).
- **Aplikace – rozpor z úpravy:** karta se stranami **Z aplikace** a **Ve výzkumu** a volbami **Ponechat hodnotu
  z aplikace** a **Převzít hodnotu výzkumu**. Volba otevře výzkum. Mimo počítač s výzkumem karta řekne
  **Rozhoduje se v terminálu na počítači s výzkumem: strom → Co čeká.**
- **Aplikace – rozpor mezi prameny:** „Tady se rozcházejí prameny; rozhoduje se ve výzkumu.“ Volby **Rozhodnout ve
  výzkumu** (terminál: **Co platí?**, tvrzení nebo **Něco jiného (napíšu sám)**, pak **Proč? (co rozhoduje)**)
  a **Nechat na agentovi** (rozhovor s agentem; strom předem řekne, že agent pracuje na předplatné nebo kredit AI).
  V Archivu Stromu volba **Nechat na agentovi** není.
- **Terminál:** menu **Co čeká**, skupina **K rozhodnutí – rozpory**, nejstarší první. Volby **Platí hodnota
  z aplikace Strom**, **Platí hodnota ve výzkumu** (v archivu **Platí hodnota v Archivu Stromu**), **Nechat otevřený**.
  Rozpor mezi prameny nabídne tvrzení jako v odkazu.
- **Hranice:** ve výzkumu s agentem ukazuje **Co čeká** jen rozpory z úprav v aplikaci. Rozpory mezi prameny jsou
  tam jen v Archivu Stromu a ve výzkumu, který čeká na agenta. Jinak je terminál ukáže jen v `strom conflict list`.
  V **Čeká na vyřízení** aplikace rozpory nejsou.
- **Ovládání:** viz výše; terminál dále `strom conflict show X…`.
- **Platí od:** aplikace 3.4.0 (**Co ví výzkum**, **rozpor ›**, **Rozhodnout ve výzkumu**, **Nechat na agentovi**),
  oddíl v panelu výzkumu a značka na kartě od aplikace 3.5.0. Volba strany od aplikace 3.11.0 s výzkumem 1.14.0.
  Rozpory v **Co čeká** od výzkumu 1.20.0.
- **Od výzkumu 1.26.0:**
  - **Nechat na agentovi** nabídne aplikace i u rozporu z úpravy; odkaz rozpor nejdřív nechá agentovi
    (`strom conflict leave`);
  - strana vybraná v aplikaci se v terminálu jen potvrdí, důvod je nepovinný (**Proč? (co rozhoduje; Enter = bez
    důvodu, 0 = nic nerozhodnout)**). Bez důvodu se zapíše „vybráno v aplikaci Strom“;
  - **Co čeká** nabízí volby slovy aplikace: **Ponechat hodnotu z aplikace**, **Převzít hodnotu výzkumu** (v archivu
    **Převzít hodnotu Archivu Stromu**), **Nechat otevřený**.

<!-- zdroj: research:src/core/waiting.ts:127 TERMINAL_ONLY, :443-449 · src/cli/menu-waiting.ts:486-513 decideConflictHere · src/cli/menu-links.ts:510-561 decideConflict, pickClaim · src/commands/links.ts:235-246 · src/core/live.ts:2063 decide.link · src/core/stromapp.ts APP_DECIDES_CONFLICTS="3.11.0" · app:v3.21.2 strings.ts research.knows, research.conflicts, research.conflictTag, research.decide, research.leaveToAgent, conflict.*, cardDensity.cardConflict · ui/person-research-ui.ts:139-150, :178-210 · ui/conflict-decide-ui.ts · research-decide.ts:55 canDecideInApp · 1.26.0: research:cs.json ui.wait.conflict.take.*, ui.link.conflict.whyMaybe, ui.link.conflict.inApp (commit 1189532f) · app:src/research-conflict-card.ts conflictCardView (agent u rozporu z úpravy) -->

<a id="R5.6.1"></a>
### R5.6.1 Co jde rozhodnout stranou z aplikace

Volbu strany nabídne aplikace jen u otevřeného rozporu z úpravy, který má obě strany a týká se osoby výzkumu.

- **Hranice:**
  - jde o hodnotu události (datum, místo, hodnota) osoby nebo páru, jméno, titul před jménem a za jménem, pohlaví;
  - aspoň jedna strana má hodnotu; prázdná strana se ukáže jako **(prázdné)**;
  - rozpor rodičů stranou z aplikace rozhodnout nejde. Aplikace u něj ukáže jen **Rozhodnout ve výzkumu**,
    nebo se rozhodne v terminálu v **Co čeká**;
  - osoba odebraná nebo upravená v jiném okně: aplikace se zeptá **Vrátit do stromu** / **Nechat odebranou**,
    nebo **Odebrat ze stromu** / **Nechat ve stromu**. Volba také otevře výzkum v terminálu.
- **Platí od:** aplikace 3.11.0 s výzkumem 1.14.0

<!-- zdroj: research:src/core/conflicts.ts:48-62 BY_SIDE, sidesOf · app:v3.21.2 research-decide.ts:28-66 DECIDE_FACTS, canDecideInApp · ui/research-removed-ui.ts:97-125 · strings.ts conflict.person.* -->
