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

<a id="S2.2.2"></a>
### S2.2.2 Folium, snímek a signatura z aplikace

Aplikace, která pole pramene uchovává ([A3.9](A3-evidence-in-the-app.md#A3.9)), posílá výzkumu signaturu, folium,
snímek a další umístění po polích. Výzkum je porovná po polích a úpravu zapíše jako úpravu strany pramene.

- **Smazání:** folium, snímek nebo signatura, které člověk v aplikaci smaže, smaže i výzkum. Vrátí je vrácení
  synchronizace ([S2.7](#S2.7)).
- **Hranice:**
  - starší aplikace, která pole nezná, nesmaže nic. Úprava celé strany ze starší aplikace nahradí umístění a smaže
    zadané folium a snímek (vrácení je vrátí);
  - nesmaže se hodnota, kterou soubor aplikace ještě jmenuje: folium nebo snímek ve straně (`PAGE`), signatura jako
    celá strana nebo na vlastním řádku poznámky pramene („Signatura: …“, v jakémkoli jazyce). Raději zůstane, než aby
    se smazalo, co aplikace jako pole neviděla;
  - signatura knihy a číslo snímku z evidovaných skenů nejsou pole pramene: smazání v aplikaci je nemění;
  - u pramene, který přečetl výzkum, se úprava ani smazání nezapíše do pramene; zapíše se poznámka vedle
    („folio/strana: odstraněno v aplikaci Strom (bylo fol. 12v)“).
- **V seznamu Co se pošle** ([S2.2.1](#S2.2.1)) je změněná signatura, folium nebo snímek jako změna strany pramene.
- **Platí od:** aplikace 3.27.0 s výzkumem 1.31.0

<!-- zdroj: research:337787ff, 87785596 src/core/sync.ts:3534 SOURCE_EDITS, SOURCE_FIELDS, :3551 removedFields (fieldsKept, entryWords, locatorOverlap, isValue, noteCallNumbers, CALL_NUMBER_LABELS), removedLine (sync.reading.removed) · 4de28f00 (úprava celé PAGE ze starší aplikace nahradí locator a smaže folio/snímek, undo vrátí) · app:c3278633 src/research-changes.ts (změna signatury, folia, snímku jako strana), src/ged-exporter.ts sourceFields · CHANGELOG.cs.md 1.31.0 · dirigent:prace/1111-vyzkum-citace-most-n1, prace/1111-vyzkum-citace-pole · spec 075 U1c B -->

<a id="S2.2.3"></a>
### S2.2.3 Který strom se pošle

Do výzkumu odchází vždy strom, který je s ním propojený, se svými vlastními daty. Přepnutí na jiný strom na tom nic
nemění.

- **Přepnutí stromu:** neodeslané úpravy stromu, ze kterého se odchází, odejdou hned ([S2.2](#S2.2)). Strom, na
  který se přepíná, se pošle až otevřený, při nejbližší odpovědi mostu. Úprava uložená během přepínání zůstane ve
  stromu, ve kterém vznikla.
- **Kopie bez osob výzkumu:** aplikace nepošle kopii, která skoro nenese osoby výzkumu: verze výzkumu, ze které
  strom vychází, má aspoň 10 osob s číslem výzkumu, v poslání by z nich bylo méně než 10 % a méně než 10 % posílaných
  osob by takové číslo neslo. Nepošle ji sama, tlačítkem **Poslat** ani při opuštění stránky; úpravy zůstanou
  v aplikaci neodeslané. Poslání tlačítkem to řekne hláškou „Neodesláno: otevřený strom skoro nemá osoby tohoto
  výzkumu, četl by se tam jako jiný rodokmen. Úpravy zůstávají tady.“, **Poslat znovu** vráceného poslání
  hláškou „Znovu neodesláno: to poslání neneslo osoby tohoto stromu. Úpravy zůstávají tady.“ Samo poslání a odchod
  ze stránky nic nehlásí; čekající úpravy ukazuje značka.
- **Ukázkový strom** se do výzkumu nikdy nepošle ([S1.3.1](S1-connecting-app-and-research.md#S1.3.1)).
- **Hranice:** malý jiný strom pod propojením výzkumu odmítne od výzkumu 1.34.0 i výzkum sám ([S2.5](#S2.5)).
  Vrácené poslání, které neneslo osoby stromu, aplikace znovu nenabízí ([S2.7](#S2.7)).
- **Platí od:** aplikace 3.29.0

<!-- zdroj: app:7e92c784 src/data.ts switchTree/loadStartupTree (switchSeq, id stromu spolu s daty), getDataFor(treeId), save() páruje id s daty · 92f9e978 DataManager.isSwitchingTo(treeId) (odkládá se jen poslání stromu, na který se přepíná; autoDue při odpovědi mostu) · bbcc2b17 src/research-foreign-send.ts foreignSendCheck (FOREIGN_SEND_MIN_BASE 10, FOREIGN_SEND_SHARE 0.1, čísla REFN P…), src/ui/research-sync-ui.ts (auto, ruční, odchod ze stránky) · 302a2d3d (bez navigator.locks bez zámku) · CHANGELOG.cs.md 3.29.0 „Přepnutí stromu“ · prace/1115-app-prepnuti-stromu, prace/1115-app-odeslani-pred-prepnutim · hláška ručního poslání: app:65e7cba0 strings.ts sync.foreignNotSent, sync.undoneForeignNotSent (jen ručně a Poslat znovu) -->

<a id="S2.3"></a>
## S2.3 Co výzkum s poslanými úpravami udělá

Výzkum s agentem zapíše poslání hned. Nový údaj nebo osoba z aplikace je vždy **Vodítko** s pramenem „Úpravy
v aplikaci Strom“, nikdy Doložené. Změna údaje doloženého záznamem se stane rozporem. Podrobná pravidla jsou
v [R5.2](R5-conflicts.md#R5.2); přepisy pramenů z aplikace v [R3.5.1](R3-verification-and-citation.md#R3.5.1).

- **Hranice:**
  - S volbou výzkumu `sync.review on` výzkum poslání nezapíše hned. Čeká na slovo člověka v terminálu
    ([R6](R6-awaiting-action.md)); aplikace mezitím ukazuje **Čeká na potvrzení ve výzkumu.**
  - Po zápisu aplikace sama načte novou verzi výzkumu, když by se tím v aplikaci nic neztratilo.
  - Rozpory vzniklé posláním ukáže aplikace hláškou **Zapsáno, N rozporů k rozhodnutí** s **Ukázat**. Rozhoduje
    se ve výzkumu (**Rozhodnout ve výzkumu**); hodnota z aplikace do té doby v aplikaci zůstává.
- **Ovládání:** terminál: `strom config set sync.review on|off`, `strom config set sync.edits conflict|user`
  ([R5.2.1](R5-conflicts.md#R5.2.1)). Aplikace: okno **Výzkum u stromu** ukáže, co volba znamená
  („Úpravy se ve výzkumu zapíšou až po potvrzení.“).
- **Platí od:** výzkum 1.5.0; `sync.review` od 1.12.0
- **Od výzkumu 1.32.0:** `strom sync` stromu z aplikace (JSON i GEDCOM) drží společné události, role, vlastní
  události **Kmotrovství** a **Svědek při sňatku** a účastníky událostí ([A10](A10-shared-events.md)), jako převzetí
  rodokmenu ([R11.3](R11-material-from-the-user.md#R11.3)). Výzkum, který strom z aplikace převzal dřív, se sám
  neopraví; další `strom sync` z aplikace doplní, co chybí:
  - poznámku osoby nebo rodiny, kterou dřívější převzetí zkrátilo na 500 znaků, na celou (jde vrátit);
  - chybějící vlastní události kmotrovství a svědka jako nové údaje a chybějící účastníky událostí;
  - osobu nebo rodinu, kterou převzetí GEDCOM ve výzkumu 1.31 vynechalo kvůli dlouhé poznámce se znakem mimo
    základní sadu (emoji), nabídne jako novou.

  Poznámky událostí a poznámky účastníků `strom sync` ve výzkumu 1.32.0 a 1.33.0 neporovnává, a tak je nedoplní;
  aplikace je drží celé.
- **Od aplikace 3.28.0:** výzkum starší než 1.32.0 společné události a vlastní události kmotrovství a svědka
  nevrací. Aplikace je při načtení nové verze takového výzkumu převezme z předchozího stavu stromu: osobu pozná podle
  čísla ve výzkumu, událost podle typu, data, místa a hodnoty, jen když je shoda jediná. Událost, kterou výzkum
  změnil, je obyčejná událost své osoby; ostatní kopie zůstanou spojené.
- **Od výzkumu 1.34.0:** `strom sync` porovnává i poznámku události, ze souboru GEDCOM i JSON aplikace, třícestně: poznámku, kterou výzkum nemá, doplní; poznámku, kterou uživatel od
  posledního předání změnil, opraví (předchozí zůstane v historii poznámky); poznámku změněnou na obou stranách nechá
  na volbě. Odebraná poznámka nic neodebere. Řádky, které do poznámky píše export (stav, slova záznamu, věky), vlastní
  řádky výzkumu a poznámka, kterou aplikace dává každé kopii společné události, se za úpravu nepočítají. Úpravu jde
  vrátit. Sync spuštěný agentem poznámku uživatele ani importovaného údaje nemění. Nový údaj z aplikace poznámku zatím
  nepřenáší.
  - **Která událost:** událost ze souboru se páruje s událostí výzkumu nejdřív podle jejího čísla ve výzkumu (E…),
    které soubor aplikace nese, pak podle podrobností a názvu. Poznámka jedné události nikdy neopraví jinou; u dvou
    stejných událostí jedné osoby (stejný typ, den a pramen), které nic z toho nerozliší, se poznámka nebere u žádné.
    Strom z aplikace bez úprav žádnou poznámku nezmění.
  - **Poznámka účastníka:** poznámku účastníka události (kmotra, svědka…) z aplikace výzkum 1.34.0 nebere, ani od
    aplikace 3.29.0: strom uložený v aplikaci ze starší verze může mít delší poznámku účastníka zkrácenou a výzkum by
    ji zkrátil také.

<!-- zdroj: research:src/core/sync.ts (v1.25.2) :1-19 · src/core/config.ts:285 sync.review · src/core/live.ts accepts() :1455 sync.auto write|off|mirror · app:src/ui/research-sync-ui.ts :1-21 · strings.ts sync.statePendingSub, sync.flyConflict, sync.showConflicts, sync.decideInResearch, sync.writtenConflictsSub, treeSettings.effectReview · 1.32.0: research:ac489205 src/core/sync.ts readStromJson (appPersonEvent, appParticipants; fact.new, fact.part, fact.share), research:f8eb2032 note.correct (zkrácená poznámka → celá), research:01125661 (NFD zkrácená poznámka), dirigent:prace/1113-vyzkum-json-intake-drobnosti bod 5 (vynechané osoby 1.31 → nové), postřeh 2 (sync poznámek událostí a účastníků) · 3.28.0: app:80c2ffb9 src/research-link.ts keepEventShares, EVENT_SHARE_FEATURE event.share, eventMatchKey · 1.34.0: research:4cfc233c src/core/sync.ts fact.note, fact.part.note (noteEdits, pick, smazání nic), dirigent:prace/1115-vyzkum-095-cli-drobnosti B1 · párování podle čísla: src/core/sync.ts planSync (byId `2 _STROM_EID`, sure), poznámka účastníka: src/core/stromapp.ts APP_SENDS_PART_NOTES undefined (dirigent:prace/1115-release-vyzkum-1.34.0 Průběh 22:02) -->

<a id="S2.3.1"></a>
### S2.3.1 Hlavní citace a odebraná citace z aplikace

Hlavní citaci ([A3.2.2](A3-evidence-in-the-app.md#A3.2.2)) a citaci odebranou od údaje
([A3.2.3](A3-evidence-in-the-app.md#A3.2.3)) výzkum převezme jako úpravu uživatele. Každou jde vrátit
([S2.7](#S2.7)) a historie výzkumu říká kdo a kdy.

- **Hlavní citace:**
  - citace označená v aplikaci je hlavní i ve výzkumu ([R3.4.5](R3-verification-and-citation.md#R3.4.5)); jiná
    citace téhož údaje hlavní přestane být;
  - zrušení výzkum pozná, když soubor z aplikace vychází z verze výzkumu, ve které hlavní citace byla, a u citace už
    není. U souboru, kterému výzkum nic nedal, se hlavní citace bere jen jako nastavení;
  - hlavní citaci u citace, kterou výzkum nemá, výzkum nejdřív přidá a pak označí. Když citaci nepřidá, hlavní
    nenastaví a řekne to ([S2.5.1](#S2.5.1));
  - hlavní citaci u údaje, kterému uživatel ve stejném poslání změnil datum nebo druh, výzkum nezapíše (údaj
    nespáruje); stačí ji po dalším načtení poslat znovu.
- **Odebraná citace:**
  - výzkum ji od údaje odebere a odebrání si pamatuje ([R3.4.6](R3-verification-and-citation.md#R3.4.6)). Pramen
    a jeho snímky zůstanou. Odebraná hlavní citace zruší i hlavní;
  - u společné události se odebere jednou, z té jedné společné události výzkumu;
  - odebere se jen citace, kterou údaj měl ve verzi výzkumu, ze které soubor aplikace vychází. Citace téhož pramene,
    kterou agent přidal později, zůstane.
- **Hranice:**
  - odebrání výzkum bere jen ze souboru GEDCOM, který aplikace posílá přes most, a jen u narození, úmrtí, událostí
    osoby, sňatku, událostí páru a rozvodu. Citace osoby, jména a rodiny se z aplikace neodebírají;
  - chybí-li v souboru celý pramen, nic se neodebere: pramen zůstane ve výzkumu i s citacemi a maže se ve výzkumu;
  - aplikace, která odebrání ještě neposílá, nic neodebere; citace ve výzkumu zůstane;
  - ze souboru JSON aplikace výzkum čte hlavní citaci (od verze dat 21), odebrání ne;
  - aplikace nabízí hlavní citaci jen u výzkumu, který ji drží, a u výzkumu, který odebrání nepřebírá, to řekne
    ([A3.2.3](A3-evidence-in-the-app.md#A3.2.3)). Výzkum píše `_STROM_MAIN` a `1 DATA` › `2 EVEN` jen aplikaci, která
    je čte ([A2.7](A2-loading-a-family-tree.md#A2.7)).
- Co z toho výzkum nepřevzal, aplikace vypíše jmenovitě ([S2.5.1](#S2.5.1)).
- **Platí od:** aplikace 3.29.0 s výzkumem 1.34.0

<!-- zdroj: research:355df0a5 src/core/sync.ts fact.main (op event.main, _STROM_HEAD: zrušení), fact.uncite (jen s HEAD, APP_SENDS_UNCITE, BIRT/DEAT/LifeEvent/MARR/události páru/DIV; cite.notCarried, cite.sourceRemoved, cite.olderApp, fact.noMatch, main.notCarried), :5268 · src/core/stromapp.ts:806-820 APP_READS_MAIN_CITATION, APP_SENDS_UNCITE, APP_DATA_MAIN_CITATION 21 · src/core/live.ts features citations.order, citations.main, citations.remove, sync.notWritten.codes · 4cd81f14 (vrácení) · app:src/citation-gates.ts · ZADANI_VYZKUM_hlavni-citace.md 3.2, 4.1, Upřesnění 3 a 5, V6, V7 · spec 095 K2, K3 -->

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
  - Zapíše-li výzkum jen část, aplikace ukáže **Zapsáno N, nezapsáno M** a u každé nezapsané úpravy důvod
    (například „nemá společný základ: je potřeba vybrat ve výzkumu“).
  - Po odmítnutí se automatické posílání zastaví. Samo se znovu pošle až po další úpravě.
- **Ovládání:** aplikace: **Výzkum úpravy nepřijal** v panelu výzkumu, **Zkusit znovu**, **Podrobnosti (k předání)**
- **Platí od:** aplikace 3.11.0 (výzkum 1.12.0); odložený zápis od výzkumu 1.20.0
- **Od výzkumu 1.26.0:** velký rodokmen (zhruba 1 500 osob a víc) převzatý ve Windows se zapíše celý. Dřív skončil
  chybou gitu o příliš dlouhém příkazu (ENAMETOOLONG) a nezapsalo se nic.
- **Od výzkumu 1.34.0:** výzkum odmítne i malý jiný strom poslaný pod jeho propojením (třeba ukázkový strom), ve
  kterém z rodokmenu výzkumu zůstala méně než polovina osob: z poslaných osob má číslo výzkumu méně než 10 % (při
  10 a více poslaných) nebo žádná (při 5 a více). Nic se nezapíše a úpravy zůstanou v aplikaci. Je-li to záměr, vezme takový soubor
  terminál: `strom sync <soubor> --force`.

<!-- zdroj: research:src/core/sync.ts (v1.25.2) SYNC_MAX_BYTES :1325, tree.empty :1218, tree.other-research :2038, tree.foreign :2068, tree.no-ids :2345 · src/core/live.ts seal.foreign, tree.not-downloaded, disk.full · app:src/research-write-held.ts · strings.ts sync.refusedCodes, sync.refusedDetails, sync.noIdsToast, sync.held, sync.writtenCount, sync.notWrittenPick, sync.rejectedAutoSub · 1.26.0: research:src/core/git.ts commitAll po částech (commit 0e7238fc) · 1.34.0: research:4a5887dc src/core/sync.ts planSync (jiný strom: poslaných ≥ 10 a s id výzkumu < 10 %, nebo ≥ 5 a žádná; kept < given/2, strangers > 0; --force) · CHANGELOG.cs.md 1.34.0 „Jiný rodokmen pod jménem výzkumu“ · prace/1115-vyzkum-cizi-strom -->

<a id="S2.5.1"></a>
### S2.5.1 Nepřevzaté změny jmenovitě

Výzkum, který ke každé nepřevzaté změně posílá důvod jako kód, dostane v aplikaci u každé takové změny vlastní řádek
s důvodem jejími slovy.

- **Hláška:** když výzkum z poslání nic nepřevzal, ale změny pojmenoval: „Výzkum nepřevzal 3 změny. Zůstávají tady
  v aplikaci.“ s **Ukázat**. Oddíl poslání v panelu výzkumu má nadpis „Výzkum nepřevzal 3 změny“. Takové poslání
  nikdy neříká „nic nového“.
- **Seznam:** **Co se zapsalo** ([S2.2.1](#S2.2.1)) má u každé nepřevzaté změny řádek osoba · údaj · pramen (osoba
  a pramen se dají otevřít, co není známé, se vynechá; „Změna“, když není známá osoba ani pramen) a důvod:

| Kdy | Co aplikace řekne |
|---|---|
| starší aplikace, která odebrání citace neposílá | citace ve výzkumu zůstává: tato verze aplikace odebrání ještě neposílá |
| v souboru chybí celý pramen | pramen zůstává ve výzkumu i s citacemi; pramen se maže ve výzkumu |
| pramen zmizel z celé osoby nebo rodiny | citace osoby, jména nebo rodiny se z aplikace neodebírají |
| hlavní citace u citace, kterou výzkum nepřidal | hlavní citace nenastavena: výzkum tuto citaci nepřevzal |
| údaj se nespároval | výzkum tento fakt nenašel (změnilo se datum nebo druh) |
| výzkum údaj mezitím stáhl | výzkum tento fakt mezitím stáhl; do aplikace se už nevrátí |
| v souboru chybí osoba, údaj, jméno, dítě nebo partner | v souboru chybí; výzkum nemaže, jen hlásí |
| na totéž už čeká rozpor | na totéž už čeká otevřený rozpor |
| pozdější poslání z jiného okna | pozdější poslání z jiného okna fakt změnilo; tato kopie je starší |
| potvrzení údaje, který výzkum mezitím změnil | potvrzení nepřevzato: výzkum fakt mezitím změnil |
| vztah dítěte slovem, které výzkum nezná | vztah dítěte: výzkum toto slovo nezná |
| skupinu tvarů příjmení výzkum mezitím změnil | skupinu tvarů příjmení výzkum drží (mezitím ji změnil) |
| skupina tvarů příjmení s varováním | skupina tvarů příjmení: ve výzkumu jen s varováním |
| hodnota z importu nebo od uživatele, kterou agent jen navrhne | hodnota z importu nebo od uživatele: výzkum ji jen navrhne |
| osoba se nespárovala | výzkum osobu nespároval |
| zápis, který výzkum chtěl udělat a nepovedl se | zápis ve výzkumu se nepovedl |
| kód, který aplikace nezná | nepřevzato |

- Změny, které výzkum zapsat chtěl a nepovedlo se, jsou ve stejném seznamu, ne ve vlastní hlášce. Důvody, které
  aplikace uváděla už dřív (čeká na volbu, archiv ji drží, osoba odebraná, vzato zpět), zůstávají jejich dosavadními
  slovy.
- **Údaj, který výzkum mezitím stáhl** (`strom event retract`, [R3.1](R3-verification-and-citation.md#R3.1)) po verzi,
  ze které soubor aplikace vychází: odebrání citace, hlavní citace, nová citace, poznámka, podrobnost ani potvrzení
  takového údaje se nezapíší a každá z nich má v seznamu řádek s tímto důvodem. Citace staženého údaje ve výzkumu
  zůstanou. Terminál při `strom sync` píše „nezapíše se: výzkum tento údaj mezitím stáhl (do aplikace se už
  nevrátí)“.
- Řádek nové citace, kterou výzkum nepřevzal, uvádí všechny citované prameny, které strom má, i pramen v aplikaci
  nový.
- Pozdější stav výzkumu doplní tentýž seznam bez hlášky.
- **Hranice:** výzkum bez kódů se chová jako dřív: poslání, ze kterého nic nepřevzal, hlásí „Výzkum z tohoto
  poslání nic nového nepřevzal.“ Důvody u citací (první tři řádky tabulky) posílá výzkum jen aplikaci, která hlavní
  citaci čte; starší aplikace je nedostane.
- **Platí od:** aplikace 3.29.0 s výzkumem 1.34.0

<!-- zdroj: app:1e10a1dd src/ui/research-sync-ui.ts:1985-2005 (SYNC_NW_CODES_FEATURE, notTakenToast, nothingTakenToast), :2849 notTakenTitle · src/ui/research-changes-ui.ts nwReason, NW_TODAY_WHY · strings.ts sync.notTakenToast, notTakenTitle, nw.*, nwUnknown, nothingTakenToast · research:355df0a5 src/core/sync.ts notWritten codes, skipped codes, /status sends[].notWritten (nejvýš 50) · ZADANI_VYZKUM_hlavni-citace.md V4, V5 · spec 095 K3.4 · event.retracted: app:bcf456ee strings.ts sync.nw.event.retracted (notWritten i skipped), src/ui/research-changes-ui.ts nwRowParts more (cites) · research:4a5887dc src/core/sync.ts retractedDiff (code event.retracted: fact.uncite, fact.main, fact.cite s cites, fact.note, fact.detail, fact.confirm), cli/ui.ts + cs/de/pl.json ui.sync.do.event.retracted · prace/1115-vyzkum-095-retract -->

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
- **Od aplikace 3.29.0:** vrácené poslání, které neneslo osoby tohoto stromu (záznam výzkumu o poslání jmenuje jiný
  strom aplikace, nebo poslaná verze skoro nejmenuje jeho osoby), se znovu nenabízí ani nepošle. Panel výzkumu
  řekne „To poslání neneslo osoby tohoto stromu, proto se znovu neposílá. Načtením verze výzkumu vrácení zůstane.“
  a hlavní akcí je **Načíst verzi výzkumu**. Kde to aplikace poznat nemůže, platí dosavadní volba.

<!-- zdroj: app:src/ui/research-actions-ui.ts (v3.21.2) :448 researchActionUndoSend, UNDO_MAX_AGE_MS :152 · src/research-link.ts:73 sync-undo terminal · strings.ts research.undoSend, sync.undoneSub, sync.sendAgain, sync.loadVersion, sync.againNothing, sync.restoreBeforeLoad · research:src/core/sync.ts :19 strom sync undo · 1.26.0: src/commands/sync.ts:503 sync discard (person), sync undo (person) (commit 942c56f9) · 3.29.0: app:bbcc2b17 src/ui/research-changes-ui.ts researchUndoneForeign (záznam poslání jmenuje jiný strom aplikace, nebo uložená verze poslání skoro nejmenuje osoby druhé uložené verze), strings.ts sync.undoneForeignSub -->

<a id="S2.7.1"></a>
### S2.7.1 Načíst verzi výzkumu?

Než verze výzkumu nahradí strom v aplikaci, aplikace se zeptá **Načíst verzi výzkumu?** a ukáže, co se v aplikaci
změní nebo zmizí.

- **Seznam:** řádek na každou hodnotu: osoba · údaj · **tady → z výzkumu**. Prvních 8 řádků, další pod „a dalších
  N“. Pod seznamem, co z výzkumu přibude („Z výzkumu přibude: + 2 osoby, 3 údaje“), a „Před načtením se uloží
  záloha, půjde vrátit.“
- **Poznámka po řádcích:** když poznámku mají obě verze, společné řádky zůstanou obyčejné, odebrané jsou
  přeškrtnuté a přidané nebo změněné zvýrazněné (změněný řádek: starý přeškrtnutý, pak nový). Odstavec, který
  výzkum jen přidal, nic nepřeškrtne. Mezery na konci řádku a konce řádků z Windows nejsou změna. Poznámka jen na
  jedné straně má dál **tady → z výzkumu**. Načtou se tatáž data jako dřív.
- **Hranice:** u stromu, který z výzkumu jen načítá ([S2.2](#S2.2)), a když se z posledního poslání něco
  nezapsalo, dialog řekne, že načtení tyto úpravy přepíše; tlačítka jsou **Načíst a přepsat** a **Otevřít jako
  kopii**.
- **Ovládání:** aplikace: **Načíst verzi výzkumu**
- **Platí od:** aplikace 3.9.0; poznámka po řádcích od 3.29.0

<!-- zdroj: app:src/ui/research-load-ui.ts askResearchLoad (ROWS_SHOWN 8, overwrite: sendMode off nebo nezapsané z posledního poslání → loadOverwrite + research.openCopy), src/ui/research-ui.ts:2377 · 03352a9c src/line-diff.ts diffLines (LCS po řádcích, mezery na konci a CRLF nejsou změna), research-load-ui.ts notes · strings.ts sync.loadTitle, loadColChange, loadMore, loadAdded, loadBackupNote, loadOverwrite, loadOverNotWritten · CHANGELOG.cs.md 3.29.0 „Načíst verzi výzkumu?“ · v3.9.0 (loadColChange) -->
