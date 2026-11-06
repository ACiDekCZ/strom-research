<a id="S1"></a>
# S1 Propojení aplikace a výzkumu

Jak se aplikace Strom spojí s výzkumem na stejném počítači, jaké druhy stromů z toho vzniknou a co se děje, když
spojení nejde. Popisuje aplikaci Strom 3.21.2 (a výzkum 1.25.2). Změny z novější verze mají u sebe její číslo. Co se
s úpravami děje po spojení, popisuje [S2](S2-edits-from-the-app.md), telefon [S5](S5-phone.md).

<a id="S1.1"></a>
## S1.1 Most výzkumu běží jen na tomto počítači

Aplikace mluví s výzkumem přes most: malý server, který výzkum spustí na tomto počítači. Most poslouchá jen na
adrese `127.0.0.1`, na náhodném portu, a každá jeho adresa nese tajný klíč. Data stromu přes most nikam jinam
nejdou.

- **Hranice:**
  - Most přijme dotaz jen ze stránky aplikace Strom na stromapp.info nebo z místní adresy. Přijde-li jeho
    klíč z cizí stránky, výzkum klíč hned vymění a ten dotaz nedostane odpověď.
  - Most skončí sám, když se ho dvě hodiny nikdo na nic nezeptá a ve stromu přitom nikdo nepracuje. Pravidelný
    dotaz aplikace na stav most při životě nedrží.
  - Když se most spustí znovu sám (aktualizace, nečinnost, pád), drží si adresu: stejný port, je-li volný, a stejný
    klíč. Aplikace se pak spojí bez nového odkazu.
  - `strom live stop` klíč zahodí: aplikaci pak znovu spojí až `strom app`. Je-li port obsazený jiným programem,
    most vezme jiný port a aplikace potřebuje nový odkaz.
  - Zápis most odmítne, když je strom zapečetěný na jiném počítači, když soubory stromu ve složce v cloudu ještě
    nejsou stažené a když je plný disk. Úpravy pak čekají v aplikaci ([S2](S2-edits-from-the-app.md)).
- **Ovládání:** terminál: `strom live` (běží most?), `strom live start`, `strom live stop` (`--forget` zapomene
  i port), `strom config set live.idleMinutes <minuty>` (0: nikdy sám). Záznam běhu je ve složce výzkumu
  v `.strom/live.log`.
- **Platí od:** výzkum 1.0.0. Stejná adresa po novém spuštění od 1.8.0, `live.idleMinutes` od 1.25.0.

<!-- zdroj: research:src/core/live.ts (v1.25.2) header :1-80, token crypto.randomBytes :1702, leaked :1809, :1995, LIVE_IDLE_MS / live.idleMinutes :1705, live-last.json :518, seal.foreign / tree.not-downloaded / disk.full · src/commands/start.ts live · src/core/config.ts live.idleMinutes -->

<a id="S1.2"></a>
## S1.2 Výzkum se otevře v aplikaci odkazem z terminálu

Výzkum se v aplikaci otevře příkazem `strom app`. Výzkum spustí most a otevře v prohlížeči aplikaci s odkazem na
svůj strom. Poprvé vznikne v aplikaci nový strom, příště se aktualizuje tentýž.

- **Hranice:**
  - Pracuje-li ve stromu agent (nebo s volbou `--live`), aplikace strom rovnou sleduje živě ([S1.4](#S1.4)).
    Jinak si strom jednou načte.
  - Aplikace vezme jen odkaz na `127.0.0.1` nebo `localhost`. Jiný odkaz ignoruje s hlášením „Odkaz mířil na
    soubor, který není na tomto počítači, proto byl ignorován.“
  - Strom z výzkumu už v aplikaci je a od posledního načtení se v aplikaci nezměnil: aktualizuje se. Změnil se:
    aplikace se zeptá, zda ho **Aktualizovat**, nebo **Otevřít jako kopii**. Před aktualizací se uloží záloha.
  - Safari webové stránce spojení s programem na tomto počítači nedovolí. `strom app` proto Safari nikdy neotevře.
    Bez vhodného prohlížeče soubor převezme nainstalovaná aplikace, nebo jde do okna aplikace přetáhnout soubor
    `output/tree-strom.ged` ze složky výzkumu.
  - Chrome a Edge se poprvé zeptají na povolení přístupu k zařízením v místní síti. Bez něj se aplikace k výzkumu
    nedostane ([S1.5](#S1.5)).
- **Ovládání:** terminál: `strom app`, `strom app --live`. Aplikace: **Výzkum → Další → Výzkum u tohoto
  stromu…**
- **Platí od:** aplikace 3.0.0, výzkum 1.0.0

<!-- zdroj: research:src/commands/start.ts (v1.25.2) app, liveAppUrl / importAppUrl, Safari · app:src/research-link.ts:584 parseLoopbackUrl, :747 decideResearchOpen · src/ui/research-ui.ts:1088 initExternalOpen, :1350 importResearchFromUrl · src/local-network.ts · strings.ts research.notLocal, research.editedMessage, research.safariBlocked -->

<a id="S1.2.1"></a>
### S1.2.1 Odkazy, které aplikace přijme

| Odkaz | Co aplikace udělá |
|---|---|
| `?live=` | otevře strom a sleduje ho živě |
| `?import-url=` | strom jednou načte z mostu |
| `?send=` | pošle úpravy na adresu, kterou dal výzkum spuštěný z aplikace k poslání |
| `?research=install` | otevře instalaci výzkumu (odkaz poslaný z telefonu) |
| `?tree=…&research=…&person=…` | otevře strom výzkumu na zadané osobě |

Parametry aplikace po zpracování z adresy odebere. Po obnovení stránky během sledování se sledování tiše obnoví.

<!-- zdroj: app:src/ui/research-ui.ts initExternalOpen :1088, rememberedLiveBridge · src/deep-link.ts · src/research-install.ts -->

<a id="S1.3"></a>
## S1.3 Druhy stromů v aplikaci

Strom v aplikaci je buď vlastní, nebo patří k výzkumu na tomto počítači. Strom z výzkumu nese v souboru číslo
výzkumu a verzi, ze které vznikl. Podle toho aplikace ví, kam ho poslat zpět.

| Druh | V přepínači stromů | Co to je |
|---|---|---|
| Vlastní strom | bez značky | strom jen v aplikaci, bez výzkumu |
| Výzkum | **Výzkum** | strom, ve kterém pracuje agent výzkumu |
| Archiv Stromu | **Archiv** | strom, který výzkum drží s prameny na disku, bez agenta |
| Výzkum čeká na agenta | **Archiv** | výzkum, který zatím nemá agenta; aplikace s ním zachází jako s archivem |
| Kopie | bez značky | starší kopie stromu z výzkumu (**Otevřít jako kopii**, duplikát, druhý import); z výzkumu se už neaktualizuje |

- **Hranice:** zda je strom výzkum, nebo archiv, rozhoduje výzkum, ne aplikace. Přepnout jde jen ve výzkumu.
- **Ovládání:** aplikace: přepínač stromů. Terminál: menu výzkumu.
- **Platí od:** aplikace 3.12.0 (název Archiv Stromu), značky v přepínači od 3.16.0

<!-- zdroj: app:src/research-link.ts _STROM_TREE, _STROM_HEAD · src/types.ts:1695 ResearchLink (copy, mode) · src/research-others.ts researchAgentless · src/ui/research-sync-ui.ts researchKindOf :654, researchAgentAway · strings.ts treeSwitcher.kindArchive, kindResearch · spec 002 · CHANGELOG.cs.md 3.12.0, 3.16.0 -->

<a id="S1.4"></a>
## S1.4 Sledování živě

Při sledování živě přicházejí změny z výzkumu do aplikace samy. Sledovaný strom je mezitím jen pro čtení, aby se
úprava v aplikaci nepotkala s prací agenta.

- **Hranice:**
  - Živě se sleduje vždy jen jeden strom. Sledování jiného stromu to předchozí ukončí.
  - Přepnutí na strom, kde pracuje agent, ho začne sledovat bez dotazu. Neodeslané úpravy otevřeného stromu se
    předtím pošlou.
  - Sledování skončí, když agent přestane pracovat nebo když se z výzkumu stane archiv. Strom jde pak zase upravovat.
  - Když se automatické sledování nepodaří, aplikace mlčí a strom zůstane, jak byl.
- **Ovládání:** aplikace: **Sledovat živě** · terminál: `strom app --live`
- **Platí od:** aplikace 3.0.0; přepnutí na strom s agentem od 3.13.1

<!-- zdroj: app:src/ui/research-ui.ts startLiveFollow :2376 (opts.auto), researchReconnectOnly · strings.ts live.followLive, live.followingTree, live.followStarted, live.followMoved, live.liveEndedArchive, live.liveEndedNoAgent · CHANGELOG.cs.md 3.13.1 · spec 011 -->

<a id="S1.5"></a>
## S1.5 Když výzkum neběží nebo spojení nejde

Když aplikace výzkum nezastihne, strom v aplikaci se nemění a úpravy v něm počkají. Co přesně se stalo, ukáže
aplikace v okně **Výzkum se nepodařilo spojit**.

| Příčina | Co aplikace ukáže | Co pomůže |
|---|---|---|
| prohlížeč nepouští stránku k zařízením v místní síti | **{prohlížeč} blokuje spojení** | povolit **Aplikace na zařízení** (Brave: **Přístup k localhostu**) v nastavení webu |
| prohlížeč se teprve ptá | **Prohlížeč čeká na povolení** | odpovědět na dotaz prohlížeče |
| most neběží | **Výzkum neodpovídá** | spustit výzkum; na nové adrese ho spojí `strom app --live` |
| na adrese odpovídá jiný most (změněný klíč, jiný strom) | **Výzkum odmítl spojení** | `strom app --live` |
| Safari | **Safari výzkum nepustí** | otevřít odkaz v Chrome nebo Edge (**Zkopírovat odkaz**) |

- **Hranice:**
  - Okno vždy řekne, že se nic nezměnilo a strom zůstává, jak byl. **Zkusit znovu** zkusí spojení znovu.
  - Strom z výzkumu jde upravovat i tehdy, když výzkum neběží. Úpravy se pošlou, až se výzkum znovu spojí.
  - Most běží, ale neodpovídá: pomůže `strom live stop` a nové spuštění.
- **Ovládání:** aplikace: **Zkusit znovu**, **Zavřít**, **Jak povolit** · terminál: `strom app --live`,
  `strom live stop`
- **Platí od:** aplikace 3.9.0

<!-- zdroj: app:src/ui/research-ui.ts:1406 showResearchConnectFailed (denied, prompt, down, refused, safari) · src/local-network.ts · strings.ts sync.stateBlocked, sync.blockedSub, sync.settingApps, sync.settingBrave, sync.bridgeDownSub, sync.notRespondingSub, sync.addressRefusedSub, researchOthers.offPanel -->

<a id="S1.6"></a>
## S1.6 Starší a novější verze

Aplikace a výzkum se vydávají zvlášť. Výzkum aplikaci ve stavu řekne, co umí, a aplikace podle toho zapne jen to,
co výzkum přijme. Výzkum zase podle verze aplikace volí, co jí pošle.

- **Hranice:**
  - **Starší výzkum** (bez automatického posílání, nebo bez titulů): aplikace ukáže **Výzkum má starší verzi (v)**
    s nabídkou **Aktualizovat výzkum**. Úpravy se pak posílají jen ručně: aplikace výzkum spustí v terminálu a ten
    si je vezme. Tituly do aktualizace zůstanou jen v aplikaci.
  - **Nová verze výzkumu k dispozici:** aplikace ukáže **Nová verze Strom Research {v}** s tlačítkem
    **Aktualizovat**. Co právě běží, doběhne na současné verzi.
  - **Výzkum, který zapsala novější verze programu `strom`:** starší program ho neotevře ani do něj nezapíše.
  - **Strom uložený novější verzí aplikace:** v aplikaci je jen ke čtení, dokud se aplikace neaktualizuje.
- **Ovládání:** aplikace: **Aktualizovat výzkum**, **Zkontrolovat znovu** · terminál: `strom update`
- **Platí od:** aplikace 3.9.0 (výzkum 1.12.0); strom jen ke čtení od aplikace 3.19.0
- **Od aplikace 3.22.0:** linie z aplikace a panel bez spojení se zapnou jen s výzkumem 1.26.0
  ([S4](S4-research-from-the-app.md)).

<!-- zdroj: app:src/ui/research-update-ui.ts · strings.ts researchUpdate.line, researchUpdate.titlesLine, research.updateAvailable, research.updateBusyHint, storage.newerReadOnly · research:src/core/live.ts (v1.25.2) status locked :1516, :2810, appVersionOf :1492 · CHANGELOG.cs.md 3.19.0 -->

<a id="S1.7"></a>
## S1.7 Více výzkumů na jednom počítači

Každý strom z výzkumu má vlastní most. Aplikace se ptá i mostů stromů, které právě nejsou otevřené, a jejich stav
ukáže v přepínači stromů.

- **Hranice:**
  - Značky u stromu v přepínači: **živě** (sleduje se), **běží** nebo **N linie** (agent pracuje), **čeká N**
    (věci k vyřízení), **neběží**.
  - Ptá se vždy jen jednoho mostu naráz a jen tehdy, když je stránka vidět: poprvé po 3 sekundách, pak každou
    minutu. Na odpověď čeká nejvýš 1,5 sekundy.
  - Neběžící výzkum se znovu spojí otevřením stromu z výzkumu (`strom app`).
- **Ovládání:** aplikace: přepínač stromů; panel výzkumu, řádek **Jinde**
- **Platí od:** aplikace 3.13.1

<!-- zdroj: app:src/research-others.ts ResearchTreeKind, OTHER_BRIDGES_TIMINGS · src/ui/research-others-ui.ts · strings.ts researchOthers.otherTreeLabel, researchOthers.offReconnect · CHANGELOG.cs.md 3.13.1 -->

<a id="S1.8"></a>
## S1.8 Data zůstávají na počítači

Aplikace drží stromy v úložišti prohlížeče na tomto zařízení. Výzkum drží svůj strom ve své složce na disku. Mezi
nimi jde strom jen přes most na tomto počítači ([S1.1](#S1.1)).

- **Hranice:**
  - Každý prohlížeč má vlastní úložiště. Strom otevřený v Chrome v Edge není.
  - Strom v aplikaci a strom ve výzkumu jsou dvě kopie. Hlavní je strom v aplikaci, výzkum má vlastní kopii, a co
    výzkum nezapíše, je v aplikaci vždy vidět ([S2](S2-edits-from-the-app.md)).
- **Platí od:** aplikace 3.0.0

<!-- zdroj: app:src/storage.ts strom-db, strom-originals · strings.ts treeSettings.principles · research:src/core/live.ts 127.0.0.1 -->
