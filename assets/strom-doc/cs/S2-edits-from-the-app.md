<a id="S2"></a>
# S2 Úpravy z aplikace ve výzkumu

Co se z aplikace posílá do výzkumu, kdy, co s tím výzkum udělá a co nepřijme. Popisuje aplikaci Strom 3.21.2
(a výzkum 1.25.2). Jak se aplikace s výzkumem spojí, popisuje
[S1](S1-connecting-app-and-research.md). Co se z úpravy doloženého údaje stane, popisuje
[R5.2](R5-conflicts.md#R5.2).

<a id="S2.1"></a>
## S2.1 Hlavní je strom v aplikaci

Strom v aplikaci a strom ve výzkumu jsou dvě kopie. Úpravy z aplikace jdou do výzkumu posláním celého stromu.
Výzkum porovná, co aplikaci dal, co přišlo a co má teď, a zapíše jen to, co se v aplikaci změnilo. Co výzkum
nezapíše, zůstává v aplikaci a je vidět.

- **Hranice:**
  - Co výzkum mezitím udělal sám, nikdy nebere jako úpravu z aplikace, která by to vracela.
  - Strom z jiného programu nebo starší export bez údaje, ze které verze výzkumu vznikl: výzkum vezme jen nové
    údaje a rozdíly jen ukáže.
  - Jedno poslání je v historii výzkumu jeden záznam s jedním pramenem a jde vrátit ([S2.7](#S2.7)).
- **Platí od:** výzkum 1.0.0

<!-- zdroj: research:src/core/sync.ts (v1.25.2) :1-19 · app:strings.ts treeSettings.principles -->

<a id="S2.2"></a>
## S2.2 Kdy se úpravy posílají

Každý strom z výzkumu má svůj způsob posílání. Volí se v okně **Výzkum u stromu**, oddíl **Posílat úpravy**.

| Volba | Co se děje |
|---|---|
| **Ručně** | posílá se až tlačítkem **Poslat**; předtím je vidět **Co se pošle** |
| **Automaticky** | úpravy se pošlou samy po chvíli klidu |
| **Jen načítat z výzkumu (nic neposílat)** | nic se neposílá, z výzkumu se jen načítá |

- **Hranice:**
  - Výchozí volba: **Ručně** u výzkumu s agentem, **Automaticky** u Archivu Stromu a u výzkumu, který čeká na
    agenta. Strom spojený s výzkumem před aplikací 3.9.0 posílá automaticky. U takového stromu a u stromu otevřeného
    z výzkumu se aplikace jednou zeptá **Jak posílat úpravy do výzkumu?**; dosavadní způsob je označený **(dosud)**.
  - **Automaticky** pošle úpravy po 2 minutách bez další úpravy, při přepnutí na jiný strom a při opuštění
    stránky. Posílá jen do běžícího výzkumu a vždy jen za jeden strom naráz.
  - Strom, který se sleduje živě, je jen pro čtení a nic neposílá ([S1](S1-connecting-app-and-research.md)).
  - Výzkum neběží: úpravy počkají a pošlou se po jeho spuštění. **Poslat** ho umí spustit odkazem v terminálu.
  - Na odpověď výzkumu čeká aplikace nejvýš 2 minuty. Pak ukáže **Výzkum včas neodpověděl**; úpravy zůstanou
    v aplikaci.
  - Po přepnutí z **Jen načítat** jde první poslání vždy ručně přes **Co se pošle**.
  - Posílá se jen z počítače, na kterém výzkum běží. Telefon úpravy neposílá ([S5](S5-phone.md)).
- **Ovládání:** aplikace: **Výzkum → Další → Výzkum u tohoto stromu… → Posílat úpravy**; tlačítko **Poslat**
  (**Poslat do výzkumu**); **Poslat teď**; **Příště posílat bez náhledu**
- **Platí od:** aplikace 3.9.0 (výzkum 1.12.0); posílání při opuštění stránky od aplikace 3.16.0

<!-- zdroj: app:src/research-sync.ts:43 newTieSendMode · src/types.ts:1735 ResearchLink.sendMode · src/ui/research-sync-ui.ts (v3.21.2) AUTO_QUIET_MS :136, SEND_TIMEOUT_MS :130, pagehide :428, researchAutoSend :1438, researchSendNow · src/ui/research-tree-settings-ui.ts researchSendModeCardsHtml, maybeAskResearchSendMode · strings.ts treeSettings.sending, auto, manual, off, askTitle, askWas, deviceNote · changes.skipPreview · sync.sendNoAnswer, sync.sendWhenRunning · CHANGELOG.cs.md 3.16.0 -->

<a id="S2.2.1"></a>
### S2.2.1 Co se pošle

Před ručním posláním ukáže aplikace seznam **Co se pošle**: změněné osoby (nová osoba, smazána, jméno, narození,
úmrtí, sňatek, událost, kmotři, svědci), změněné prameny s místy, kde jsou citované, páry, místa s novými
souřadnicemi a varianty příjmení. Každá skupina má vlastní oddíl. Po zápisu ukáže stejným způsobem **Co se zapsalo**
s oddíly **Zapsáno** a **Nezapsáno**.

- **Hranice:** když přesný seznam nejde spočítat, pošle se strom, jak je, a výzkum zapíše jen rozdíly.
- **Platí od:** aplikace 3.14.0

<!-- zdroj: app:strings.ts changes.willSendTitle, changes.kind*, changes.inexact, changes.writtenSection, changes.notWrittenSection · CHANGELOG.cs.md 3.14.0 -->

<a id="S2.3"></a>
## S2.3 Co výzkum s poslanými úpravami udělá

Výzkum s agentem zapíše poslání hned. Nový údaj nebo osoba z aplikace je vždy **Vodítko** s pramenem „Úpravy
v aplikaci Strom“, nikdy Doložené. Změna údaje doloženého záznamem se stane rozporem. Podrobná pravidla jsou
v [R5.2](R5-conflicts.md#R5.2); přepisy pramenů z aplikace v [R3.5.1](R3-verification-and-citation.md#R3.5.1).

- **Hranice:**
  - S volbou výzkumu `sync.review on` výzkum poslání nezapíše hned. Čeká na slovo člověka v terminálu
    ([R6](R6-awaiting-action.md)); aplikace mezitím ukazuje **Čeká na potvrzení ve výzkumu.**
  - Po zápisu aplikace sama načte novou verzi výzkumu, když by se tím v aplikaci nic neztratilo.
  - Rozpory vzniklé posláním ukáže aplikace hláškou **Zapsáno, {n} rozporů k rozhodnutí** s **Ukázat**. Rozhoduje
    se ve výzkumu (**Rozhodnout ve výzkumu**); hodnota z aplikace do té doby v aplikaci zůstává.
- **Ovládání:** terminál: `strom config set sync.review on|off`, `strom config set sync.edits conflict|user`
  ([R5.2.1](R5-conflicts.md#R5.2.1)). Aplikace: okno **Výzkum u stromu** ukáže, co volba znamená
  („Úpravy se ve výzkumu zapíšou až po potvrzení.“).
- **Platí od:** výzkum 1.5.0; `sync.review` od 1.12.0

<!-- zdroj: research:src/core/sync.ts (v1.25.2) :1-19 · src/core/config.ts:285 sync.review · src/core/live.ts accepts() :1455 sync.auto write|off|mirror · app:src/ui/research-sync-ui.ts :1-21 · strings.ts sync.statePendingSub, sync.flyConflict, sync.showConflicts, sync.decideInResearch, sync.writtenConflictsSub, treeSettings.effectReview -->

<a id="S2.4"></a>
## S2.4 Archiv Stromu a výzkum bez agenta

Archiv Stromu a výzkum, který čeká na svého agenta, strom z aplikace zrcadlí: platí slovo z aplikace. Zapíší
každé poslání hned, i když je zapnuté `sync.review`.

- **Hranice:**
  - Změna údaje doloženého záznamem nezaloží rozpor; údaj ze záznamu se stáhne s důvodem. Rozpor rodičů a rozpor
    odebrané osoby vznikají i tady ([R5.2.1](R5-conflicts.md#R5.2.1)).
  - Co se v aplikaci smaže, výzkum odloží s důvodem a jde to vrátit.
  - Co Archiv Stromu má a toto okno aplikace nikdy nemělo, archiv nesmaže. Aplikace to u nezapsaných úprav
    uvede: **Archiv Stromu ji pořád drží: toto okno tyto údaje nikdy nemělo**.
  - Úkoly ověřit přepis z aplikace tu nevznikají, protože nikdo nečte
    ([R3.5.1](R3-verification-and-citation.md#R3.5.1)).
- **Platí od:** výzkum 1.12.0

<!-- zdroj: research:src/core/sync.ts (v1.25.2) :2283-2287 mirror = actsAsArchive, gone :2355 · app:strings.ts treeSettings.effectArchive, sync.notWrittenKept, sync.archiveBridgeDownSub · spec 002 -->

<a id="S2.5"></a>
## S2.5 Co výzkum nepřijme

Výzkum může poslání odmítnout celé, nebo zapsat jen část. Úpravy, které nezapsal, zůstávají v aplikaci a nic se
neztratí.

| Kdy | Co aplikace řekne |
|---|---|
| strom je větší než 200 MB | strom je na poslání takto příliš velký; lze ho vyexportovat jako GEDCOM a načíst ve výzkumu |
| strom patří jinému výzkumu | tento strom patří jinému výzkumu |
| strom nevypadá jako rodokmen tohoto výzkumu | lze ho vyexportovat a načíst ve výzkumu jako jiný rodokmen |
| strom přišel prázdný nebo nečitelný | strom přišel prázdný nebo nečitelný |
| výzkum strom právě přebírá | výzkum tento strom právě přebírá |
| kopie stromu ještě nemá čísla osob výzkumu | **Neodesláno.** Nejdřív je potřeba **Načíst verzi výzkumu** |

- **Hranice:**
  - Zápis výzkum odloží, když je strom zapečetěný na jiném počítači (**Převzít na tomto počítači**), když soubory
    ve složce v cloudu ještě nejsou stažené, nebo když je plný disk. Úpravy do té doby čekají neodeslané.
  - Zapíše-li výzkum jen část, aplikace ukáže **Zapsáno {n}, nezapsáno {m}** a u každé nezapsané úpravy důvod
    (například „nemá společný základ: je potřeba vybrat ve výzkumu“).
  - Po odmítnutí se automatické posílání zastaví. Samo se znovu pošle až po další úpravě.
- **Ovládání:** aplikace: **Výzkum úpravy nepřijal** v panelu výzkumu, **Zkusit znovu**, **Podrobnosti (k předání)**
- **Platí od:** aplikace 3.11.0 (výzkum 1.12.0); odložený zápis od výzkumu 1.20.0
- **Od výzkumu 1.26.0:** velký rodokmen (zhruba 1 500 osob a víc) převzatý ve Windows se zapíše celý. Dřív skončil
  chybou gitu o příliš dlouhém příkazu (ENAMETOOLONG) a nezapsalo se nic.

<!-- zdroj: research:src/core/sync.ts (v1.25.2) SYNC_MAX_BYTES :1325, tree.empty :1218, tree.other-research :2038, tree.foreign :2068, tree.no-ids :2345 · src/core/live.ts seal.foreign, tree.not-downloaded, disk.full · app:src/research-write-held.ts · strings.ts sync.refusedCodes, sync.refusedDetails, sync.noIdsToast, sync.held, sync.writtenCount, sync.notWrittenPick, sync.rejectedAutoSub · 1.26.0: research:src/core/git.ts commitAll po částech (commit 0e7238fc) -->

<a id="S2.6"></a>
## S2.6 Osoba odebraná v aplikaci

Výzkum s agentem osobu ani údaj, které v aplikaci zmizely, sám nesmaže. Odstranění si jen poznamená a aplikace
u nezapsaných úprav uvede: „odstraněno jen tady: výzkum si odstranění poznamenal, ale sám nic nemaže; smazat se
dá ve výzkumu“. Archiv Stromu odebrání zrcadlí ([S2.4](#S2.4)).

- **Hranice:** když jedno okno aplikace osobu odebere a jinde se mezitím upraví, výzkum se zeptá, zda osoba ve
  stromu zůstane ([R5.2](R5-conflicts.md#R5.2), bod 6). Aplikace ukáže jednu otázku na osobu:
  - **Odebráno v jiném okně:** **Vrátit do stromu**, nebo **Nechat odebranou**;
  - **Upraveno jinde:** **Odebrat ze stromu**, nebo **Nechat ve stromu**.
  Rozhodnutí potvrzuje výzkum. Pak aplikace načte jeho verzi.
- **Platí od:** výzkum 1.0.0; otázka odebrané osoby od aplikace 3.16.0 (výzkum 1.20.0)

<!-- zdroj: research:src/core/sync.ts (v1.25.2) :1-19 „What the app no longer has is only reported“, gone :2355 · app:src/ui/research-removed-ui.ts :1-14 · strings.ts sync.notWrittenReport, conflict.person.* · CHANGELOG.cs.md 3.16.0 -->

<a id="S2.7"></a>
## S2.7 Vrácení poslání

Poslání jde ve výzkumu vrátit. Úpravy v aplikaci přitom zůstanou; z výzkumu odejdou jen změny toho poslání.

- **Hranice:**
  - Z aplikace jde vrátit poslední poslání do 7 dní. Potvrzuje se v terminálu výzkumu.
  - Po vrácení aplikace nic dalšího nepošle, dokud se nezvolí: **Poslat znovu**, nebo vrácení ponechat volbou
    **Načíst verzi výzkumu** (nahradí úpravy z aplikace, záloha zůstane).
  - Načtení verze výzkumu jde vrátit volbou **Vrátit stav před načtením**.
- **Ovládání:** aplikace: **Výzkum → Další → Vrátit poslední poslání** · terminál: `strom sync undo`
- **Platí od:** aplikace 3.4.0, výzkum 1.0.0
- **Od výzkumu 1.26.0:** vrátit poslání (`strom sync undo`) a zahodit poslaný strom, který čeká (`strom sync
  discard`), smí jen člověk; agentovi výzkum odmítne. Úpravy v aplikaci po zahození zůstanou a jdou poslat znovu.

<!-- zdroj: app:src/ui/research-actions-ui.ts (v3.21.2) :448 researchActionUndoSend, UNDO_MAX_AGE_MS :152 · src/research-link.ts:73 sync-undo terminal · strings.ts research.undoSend, sync.undoneSub, sync.sendAgain, sync.loadVersion, sync.againNothing, sync.restoreBeforeLoad · research:src/core/sync.ts :19 strom sync undo · 1.26.0: src/commands/sync.ts:503 sync discard (person), sync undo (person) (commit 942c56f9) -->
