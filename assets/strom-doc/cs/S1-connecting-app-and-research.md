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
  - Most běží, dokud ho člověk nevypne (`strom live stop`, v aplikaci přepínač **Výzkum zapnutý**, [S1.9](#S1.9)),
    nebo do vypnutí počítače. Sám skončí jen tehdy, když to člověk zvolil (`live.idleMinutes`, v aplikaci **Po
    2 hodinách nečinnosti**): když se ho ta doba nikdo na nic nezeptá a ve stromu přitom nikdo nepracuje.
    Pravidelný dotaz aplikace na stav most při životě nedrží.
  - Most skončí sám také tehdy, když jeho výzkum ze složky zmizí a chybí i při další kontrole aspoň o 10 s později.
    Disk nedostupný jen na chvíli most neukončí. Most téhož výzkumu spuštěný navíc vedle běžícího hned skončí.
  - Když se most spustí znovu sám (aktualizace, nečinnost, pád), drží si adresu: stejný port, je-li volný, a stejný
    klíč. Aplikace se pak spojí bez nového odkazu.
  - `strom live stop` klíč zahodí: aplikaci pak znovu spojí až `strom app`. Je-li port obsazený jiným programem,
    most vezme jiný port a aplikace potřebuje nový odkaz.
  - Zápis most odmítne, když je strom zapečetěný na jiném počítači, když soubory stromu ve složce v cloudu ještě
    nejsou stažené a když je plný disk. Úpravy pak čekají v aplikaci ([S2](S2-edits-from-the-app.md)).
- **Ovládání:** terminál: `strom live` (běží most?), `strom live start`, `strom live stop` (`--forget` zapomene
  i port), `strom config set live.idleMinutes <minuty>` (0: nikdy sám, výchozí). Záznam běhu je ve složce výzkumu
  v `.strom/live.log`.
- **Platí od:** výzkum 1.0.0. Stejná adresa po novém spuštění od 1.8.0, `live.idleMinutes` od 1.25.0.
- **Od výzkumu 1.29.0:** most sám po nečinnosti nekončí (výchozí `live.idleMinutes` 0); dřív skončil sám po dvou
  hodinách. Hodnota, kterou si člověk uložil, zůstává.
- **Od výzkumu 1.30.0:** most, jehož výzkum zmizel, skončí až po druhé kontrole aspoň o 10 s později (dřív hned);
  druhý most téhož výzkumu hned skončí.
- **Od výzkumu 1.31.0:** i po aktualizaci zůstane u výzkumu jeden most. Most, který běží vedle mostu výzkumu (toho,
  kterého jmenuje `.strom/live.json`), skončí sám při nejbližší kontrole (každých 10 s). Most, kterému aktualizace
  smazala strom, ze kterého běží, skončí také a zapíše to do `.strom/live.log`. Nový most, který skončí, protože
  výzkum drží jiný most, ukončí i most, který ho spustil k předání, pokud to není most výzkumu. Předání mostu
  novějšímu stromu je rychlejší: starý most odpovídá, zatímco se nový strom ověřuje.

<!-- zdroj: research:src/core/live.ts (v1.25.2) header :1-80, token crypto.randomBytes :1702, leaked :1809, :1995, LIVE_IDLE_MS / live.idleMinutes :1705, config.ts DEFAULT_LIVE_IDLE_MINUTES = 0 (od 1.29.0), live-last.json :518, seal.foreign / tree.not-downloaded / disk.full · src/commands/start.ts live · src/core/config.ts live.idleMinutes · research:94d75934 src/core/live.ts GONE_MS 10_000 (researchGone: dvě kontroly aspoň 10 s od sebe), otherBridge (most téhož stromu už běží → konec) · CHANGELOG.cs.md 1.30.0 · research:0c6f2205 src/core/live.ts OWNER_MS 10_000 (most mimo live.json skončí), kód stromu smazaný aktualizací (dvě kontroly GONE_MS, live.log), EXIT.locked → konec mostu, který spustil předání (STROM_LIVE_REPLACES), kromě mostu z live.json · 0239e6c3 předání: starý most odpovídá během ověření nového · CHANGELOG.cs.md 1.31.0 -->

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
    **Otevřít jako kopii** udělá z výzkumu nový strom, který bere další aktualizace; strom se změnami zůstane, jak je,
    od aplikace 3.32.0 jako kopie bez výzkumu ([S1.10](#S1.10)).
  - Safari webové stránce spojení s programem na tomto počítači nedovolí. `strom app` proto Safari nikdy neotevře.
    Bez vhodného prohlížeče soubor převezme nainstalovaná aplikace, nebo jde do okna aplikace přetáhnout soubor
    `output/tree-strom.ged` ze složky výzkumu.
  - Chrome a Edge se poprvé zeptají na povolení přístupu k zařízením v místní síti. Bez něj se aplikace k výzkumu
    nedostane ([S1.5](#S1.5)).
- **Ovládání:** terminál: `strom app`, `strom app --live`. Aplikace: **Výzkum → Další → Výzkum u tohoto
  stromu…**
- **Platí od:** aplikace 3.0.0, výzkum 1.0.0
- **Od výzkumu 1.30.0:** na macOS předá výzkum adresu aplikaci nainstalované z prohlížeče na Chromiu (Chrome, Edge…)
  prohlížeči, který už běží, stejně jako by ji předalo jeho druhé spuštění. Žádný další program se nespustí a v Docku
  nepřibude ikona prohlížeče. Když prohlížeč neběží nebo do 5 s neodpoví, výzkum ho spustí jako dřív.

<!-- zdroj: research:a4a2f6c0 src/core/chromium.ts openWebApp (darwin: handToRunning SingletonSocket, jinak launch), handToRunning (ACK, timeout 5000), singletonMessage · dirigent:prace/1109-vyzkum-dock-chrome/karta.md Výsledek (živě Chrome, Edge, Canary) · research:src/commands/start.ts (v1.25.2) app, liveAppUrl / importAppUrl, Safari · app:src/research-link.ts:584 parseLoopbackUrl, :747 decideResearchOpen · src/ui/research-ui.ts:1088 initExternalOpen, :1350 importResearchFromUrl · src/local-network.ts · strings.ts research.notLocal, research.editedMessage, research.safariBlocked -->

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
| Kopie | bez značky | kopie stromu z výzkumu (**Otevřít jako kopii**, kopie celého stromu, druhý import); z výzkumu se neaktualizuje a od aplikace 3.32.0 je bez výzkumu ([S1.10](#S1.10)) |

- **Hranice:** zda je strom výzkum, nebo archiv, rozhoduje výzkum, ne aplikace. Přepnout jde jen ve výzkumu.
- **Ovládání:** aplikace: přepínač stromů. Terminál: menu výzkumu.
- **Platí od:** aplikace 3.12.0 (název Archiv Stromu), značky v přepínači od 3.16.0

<!-- zdroj: app:src/research-link.ts _STROM_TREE, _STROM_HEAD · src/types.ts:1695 ResearchLink (copy, mode) · src/research-others.ts researchAgentless · src/ui/research-sync-ui.ts researchKindOf :654, researchAgentAway · strings.ts treeSwitcher.kindArchive, kindResearch · spec 002 · CHANGELOG.cs.md 3.12.0, 3.16.0 -->

<a id="S1.3.1"></a>
### S1.3.1 Ukázkový strom

Ukázkový strom slouží k vyzkoušení aplikace. S výzkumem se nikdy nepropojí a do výzkumu se z něj nic nepošle.

- **Výzkum předků** v ukázkovém stromu nic nenastaví a řekne: „Ukázkový strom slouží k vyzkoušení aplikace
  a s výzkumem se nikdy nepropojí. Výzkum začíná se skutečným rodokmenem.“
- Otevření ukázkového stromu ukončí sledování otevřeného výzkumu stejně jako přepnutí na jiný strom
  ([S1.4](#S1.4)).
- **Hranice:** ukázkový strom ze starší verze aplikace aplikace pozná podle obsahu a při otevření nebo importu ho
  označí. Ukázka, která už s výzkumem propojená je, se neoznačí a zůstane propojená.
- **Ovládání:** aplikace: **Vyzkoušet ukázkový strom**
- **Platí od:** aplikace 3.29.0

<!-- zdroj: app:bbcc2b17 src/types.ts TreeMetadata.demo · src/demo-sample.ts (starší ukázka podle obsahu; propojená se neoznačí) · src/tree-manager.ts, src/ui/import-export.ts (označení při otevření a importu) · src/ui/research-promo-ui.ts showResearchInfoDialog (demo → demo.noResearch, nic se nenastaví) · src/ui/research-adopt-ui.ts (nikdy ukázka) · src/ui/research-follow-ui.ts researchFollowBeforeSwitch(null) · strings.ts demo.tryDemo, demo.noResearch, research.menuItem · CHANGELOG.cs.md 3.29.0 „Přepnutí stromu“ · prace/1115-app-prepnuti-stromu -->

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
- **Od aplikace 3.26.0 s výzkumem 1.30.0:**
  - výzkum má strom pro aplikaci sestavený pro každý stav a drží ho i po novém spuštění mostu;
  - aplikace ukáže strom hned v poslední sestavené podobě. Když výzkum mezitím pokročil, panel výzkumu ukáže
    „Připravuje se novější verze…“ a novější verze strom sama nahradí, jakmile je hotová;
  - když se výzkum od posledního načtení nezměnil a strom v aplikaci je stále přesně ten načtený, aplikace ho znovu
    nestahuje ani nenačítá;
  - během sledování výzkum změnu ohlásí, až je její strom připravený.

<!-- zdroj: app:src/ui/research-ui.ts startLiveFollow :2376 (opts.auto), researchReconnectOnly · strings.ts live.followLive, live.followingTree, live.followStarted, live.followMoved, live.liveEndedArchive, live.liveEndedNoAgent · CHANGELOG.cs.md 3.13.1 · spec 011 · app:669c08f0 src/research-tree-file.ts (ged.stale → tree.ged?stale=1, treeFileState preparing; ged.etag → If-None-Match jen u stromu přesně z toho souboru, 304 = strom zůstává), src/ui/research-ui.ts livePreparing, strings.ts research.newerPreparing · research:94d75934 src/core/liveged.ts (strom pro aplikaci jednou pro stav a variantu, na disku i po restartu mostu), src/core/live.ts (change až s hotovým stromem; ETag u tree.ged) · CHANGELOG.cs.md 1.30.0 -->

<a id="S1.4.1"></a>
### S1.4.1 Strom hned, fotky přibývají

Strom otevřený přes **Sledovat živě** se ukáže hned, s fotkami, které aplikace už má. Ostatní portréty, fotky svazků,
přílohy a výřezy pramenů přicházejí z výzkumu potom, na pozadí. Jména, vztahy a karty jdou prohlížet hned.

- **Pořadí:** nejdřív fotky karet na obrazovce, pak kolem středu. Posun nebo přiblížení stromu pořadí přeřadí.
  První dávka má 30 fotek, další po 500, nejvýš 2 dotazy najednou. Každá fotka se před vložením do stromu ověří
  podle svého otisku.
- **Fotka na cestě:** karta ukazuje iniciály pod klidným, pomalu pulzujícím závojem; karta se starší fotkou ukazuje
  pod závojem ji, dokud nepřijde nová. Text při najetí říká „Fotka se načítá…“, nebo „Načítá se nová fotka…“.
  Fotka, která přijde, se na místě prolne; strom se kvůli ní nepřekresluje.
  - Stejný závoj mají dialog osoby, stránka osoby a stránky rodiny v okně aplikace, okno **Materiály**, soubory
    a materiál osoby, náhledy pramenů a výřezů a fotka svazku v Tabulce. Prezentace, změny z výzkumu a rozpor při
    sloučení ukazují iniciály, dokud portrét nepřijde.
- **Fotka, která nepřišla:** karta vypadá jako karta bez fotky; text při najetí „Fotka se nenačetla.“ Dlaždice
  v seznamech ukáže přeškrtnutý obrázek, od velikosti 64 px s nápisem **Nenačteno**. Dialog osoby a stránka osoby
  mají u fotky **Zkusit znovu**.
- **Ukazatel Fotky k / n:** objeví se, když se fotky načítají déle než 400 ms, a počítá fotky celého stromu
  („Fotky 846 / 860“, s „· 3 nenačteno“) s pruhem průběhu. Na počítači stojí nahoře, v okně do šířky 1024 px dole
  nad oznámeními. Kliknutí ukáže podrobnost: „Zbývá N · nenačteno M“ a co jde se stromem mezitím dělat: při živém
  sledování „Strom se mezitím dá prohlížet.“ (strom je jen pro čtení, [S1.4](#S1.4)), jinak „Strom lze mezitím
  upravovat.“ Když přijdou všechny, ukáže na 2 s ✓ a zmizí.
- **Některé se nenačetly:** ukazatel zmizí a zůstane jedna hláška „Některé fotky se nenačetly (N).“ s důvodem
  („Výzkum neběží. Je potřeba spustit Strom Research.“, „Výzkum neodpověděl do 60 s.“, nebo „Výzkum tyto fotky
  nemá.“) a **Zkusit znovu**. To načte nenačtené fotky znovu a ukazatel počítá znovu celý strom.
- **Hlídá kód:** fotka na cestě nikdy nesmaže ani nepřepíše uloženou fotku.
  - Uložení stromu před příchodem fotek ponechá u portrétu a fotky svazku dosavadní fotku (nebo žádnou). Fotky,
    které ještě nepřišly, si aplikace poznamená ke stromu a při dalším připojení k výzkumu je dotáhne.
  - Dialog osoby zapíše fotku, jen když ji člověk v dialogu změnil. Fotka, která přijde při otevřeném dialogu, se
    v něm doplní.
  - **Zpět**, **Znovu**, zahozený dialog, denní záloha i další okna drží fotky, které už přišly.
  - **Upravit výřez** portrétu nebo fotky svazku počká na fotku: „Výřez půjde upravit po načtení fotky.“
  - Příchod fotky není úprava stromu: nejde vrátit jako krok a strom v souladu s výzkumem v souladu zůstane.
  - Fotky, které nepřišly, výzkum nebere jako odebrané: zápisy stromu do jejich příchodu jen přidávají
    ([S8.5](S8-where-the-data-are.md#S8.5)).
- **Hranice:**
  - jen při otevření stromu přes **Sledovat živě**. Novější verze během sledování, převzetí stromu a jiná načtení
    verze z výzkumu přinášejí fotky najednou se stromem jako dřív;
  - výzkum do 1.29 posílá strom s fotkami uvnitř souboru: strom se ukáže až s nimi;
  - jiný strom otevřený během načítání načítání zruší a ukazatel zmizí. Fotka přistane jen ve stromu a v načtení,
    pro které se stahovala;
  - další okna aplikace ([A6.8](A6-views.md#A6.8)) stav načítání nemají a ukazují strom bez závoje;
  - u šifrovaného stromu přijdou soubory a výřezy pramenů, které nepřišly do zavření stránky, až s další verzí
    výzkumu;
  - na telefonu drženém na šířku se rozbalený panel výzkumu při ukazateli sbalí ([S4.1](S4-research-from-the-app.md#S4.1)).
- **Ovládání:** aplikace: **Sledovat živě**; ukazatel **Fotky k / n** (kliknutí: podrobnost, Esc ji zavře);
  hláška → **Zkusit znovu**; dialog osoby a stránka osoby → **Zkusit znovu**.
- **Platí od:** aplikace 3.31.0, výzkum 1.30.0

<!-- zdroj: dirigent:spec/116-fotky-nacitat-pozdeji K1.2–K1.6, K2.1 · prace/1119-app-116-fotky (Výsledek, odchylky) · app:45dd3426 src/image-loads.ts (ImageLoadQueue, IMAGE_FIRST_BATCH 30, takePendingImages, write jen do současného stromu a načtení, bez kroku zpět), src/research-image-refs.ts IMAGE_BATCH 500, IMAGE_CONCURRENCY 2, IMAGE_ANSWER_MS 60 s · src/ui/research-ui.ts startLiveFollow (ged.imagesByHash → later, priority TreeRenderer.imagePriority: na obrazovce, pak kolem středu; setPendingImages I1; researchResumePendingImages) · research:33ac2e38 (1.30.0) src/core/live.ts ged.imagesByHash · app:95e68ac7 (K1.5 I1–I7: TreeMetadata.pendingImages, notes(records) bez záznamů u šifrovaného stromu) · 87b9ec30 src/ui/image-slot.ts (data-img-state loading/refresh/failed, IMG_PULSE_MS, TILE_NOTE_MIN_PX 64) · ad9e82a0 src/ui/person-modal.ts renderPhotoState, photoModel · 05cf608c, e188236f (další místa) · 4afeb434, b1bcb476 src/ui/image-load-chip.ts CHIP_SHOW_MS 400, BUSY_DONE_MS, detailNote(readOnly), failedReasonText (offline → timeout → missing), treeSwitched · 4afeb434 src/image-loads.ts abort (strom už není současný) · strings.ts photos.loading, loadingNew, failed, failedNew, tileFailed, recropWait, chipLabel, chipFailed, detailLeft, detailEditable, detailViewOnly, someFailed, whyMissing · busy.errOffline, errTimeout, retry · a2feee6b (≤ 1024 dole nad oznámením) · 7be40d24 src/ui/landscape-panel-fold.ts · CHANGELOG.cs.md 3.31.0 -->

<a id="S1.4.2"></a>
### S1.4.2 Výstupy čekají na fotky

Výstup vyžádaný ve chvíli, kdy fotky stromu ještě přicházejí ([S1.4.1](#S1.4.1)), na ně počká a vznikne až
s nimi. Bez fotek vznikne jen na výslovnou volbu.

- **Které výstupy:** tisk plakátu, obrázek PNG a vektor SVG, stránka osoby, stránky rodiny, kniha rodu, záloha
  dat (**Uložit do souboru**, zápis do propojeného souboru, soubor ke sdílení, **Exportovat** zálohu) a export
  GEDCOM. Soubor CSV fotky nemá a nečeká.
- **Čekání:** tlačítko nebo řádek výstupu říká „Čeká se na fotky · k z n“ a druhé kliknutí nic nespustí. Oznámení
  s názvem výstupu („Tisk plakátu“, „Kniha rodu“…) počítá fotky s pruhem a má **Zrušit**. Ukazatel **Fotky k / n**
  se mezitím schová.
- **Když některé nepřišly:** jedna hláška „Některé fotky se nenačetly (N).“ s důvodem a třemi volbami: **Zkusit
  znovu**, **Pokračovat bez N fotek** (výstup z dat, jak jsou) a **Zrušit**.
- **Hlídá kód:** výstup nikdy neobsahuje závoj ani znak nenačtené fotky. Tisk před otevřením tisku načte a vykreslí
  i obrázky, které stránka načítá až při posunu.
- **Ovládání:** aplikace: výstup jako vždy; v oznámení **Zrušit**; v hlášce **Zkusit znovu**, **Pokračovat bez
  N fotek**, **Zrušit**.
- **Platí od:** aplikace 3.31.0

<!-- zdroj: dirigent:spec/116-fotky-nacitat-pozdeji K1.7 · app:9d326239 src/ui/output-images.ts imagesBeforeOutput, waitingLine, someFailedText, toastImagesView (retry, without, cancel; suspendImageLoadChip), imagesReadyForPrint · src/image-loads.ts awaitTreeImages · volající: src/ui/export-image-ui.ts (poster, png, svg), person-page-ui.ts (personPage, familyPages), book-ui.ts (book, familyPages), file-copy-ui.ts, file-access-ui.ts, share-ui.ts (backup), encryption-ui.ts (backup, gedcom; csv ne) · src/ui/fan-view.ts (live false: fotka nebo nic) · strings.ts photos.waiting, continueWithout, out.*, busy.kOfN, buttons.cancel · CHANGELOG.cs.md 3.31.0 -->

<a id="S1.5"></a>
## S1.5 Když výzkum neběží nebo spojení nejde

Když aplikace výzkum nezastihne, strom v aplikaci se nemění a úpravy v něm počkají. Co přesně se stalo, ukáže
aplikace v okně **Výzkum se nepodařilo spojit**.

| Příčina | Co aplikace ukáže | Co pomůže |
|---|---|---|
| prohlížeč nepouští stránku k zařízením v místní síti | **… blokuje spojení** (název prohlížeče) | povolit **Aplikace na zařízení** (Brave: **Přístup k localhostu**) v nastavení webu |
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
  - **Nová verze výzkumu k dispozici:** aplikace ukáže **Nová verze Strom Research …** s tlačítkem
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
  - Od výzkumu 1.35.0 má výzkum i portréty, fotky svazků a přílohy stromu. Co je kde uložené a co je jen
    v prohlížeči, popisuje [S8](S8-where-the-data-are.md).
- **Platí od:** aplikace 3.0.0

<!-- zdroj: app:src/storage.ts strom-db, strom-originals · strings.ts treeSettings.principles · research:src/core/live.ts 127.0.0.1 · S8: dirigent:spec/108-kde-se-co-uklada, research:c9a4b614 CHANGELOG.cs.md 1.35.0 -->

<a id="S1.9"></a>
## S1.9 Výzkum zapnutý: přepínač mostu u stromu

Každý strom z výzkumu na tomto počítači má v aplikaci přepínač **Výzkum zapnutý**. Ukazuje skutečný stav mostu:
zapnutý, když most odpovídá, jinak vypnutý. Zapnutý most běží do vypnutí přepínačem nebo `strom live stop`, do vypnutí
počítače, nebo podle nastavení **Vypnout výzkum po nečinnosti**.

- **Hranice:**
  - Vypnutí ukončí most jako `strom live stop`, jen si most nechá adresu (port a klíč). Vypnutý most zůstane vypnutý:
    nová práce ve stromu ho sama nevrátí. Strom v aplikaci zůstává a jde dál upravovat
    ([S1.5](#S1.5)). Pod přepínačem stojí „Vypnutý. Zůstane vypnutý, dokud se znovu nezapne.“
  - Most vypnutý nečinností se vrátí sám s novou prací ve stromu, na téže adrese. Pod přepínačem stojí „Vypnul se po
    nečinnosti. S novou prací ve stromu se zase zapne sám.“
  - Zapnutí pošle výzkumu odkaz, který spustí jen most na jeho poslední adrese, bez okna. Když se nic nestane, nebo
    výzkum zapnutí z aplikace neumí, aplikace ukáže příkaz `strom live start` (spustit v terminálu ve složce stromu)
    s tlačítkem **Kopírovat**. Starší výzkum, který vypnutí z aplikace neumí, ukáže stejně příkaz `strom live stop`.
  - Přepínač mezitím ukazuje nový stav a **Zapíná se…** (**Vypíná se…**). Když most do 30 s neodpoví, přepínač se
    vrátí a stojí u něj **Výzkum se do 30 s neozval. Je potřeba spustit Strom Research.** s příkazem a **Zkusit
    znovu** ([A9.7.2](A9-using-the-app.md#A9.7.2)).
  - Po vypnutí nebo restartu počítače most neběží a sám se nespustí. Zapne ho člověk: v panelu výzkumu **Zapnout**,
    nebo `strom live start`.
  - **Vypnout výzkum po nečinnosti** má dvě volby: **Do vypnutí počítače** (výchozí) a **Po 2 hodinách nečinnosti**.
    Platí pro všechny stromy na tomto počítači a drží ji výzkum (`live.idleMinutes` 0 nebo 120). Běžící mosty ji
    převezmou do minuty. Hodnota nastavená v terminálu se ukáže jako **Vlastní hodnota (N min)**. Neběží-li výzkum,
    který volbu umí, aplikace místo voleb ukáže příkazy do terminálu.
  - Na telefonu a tabletu přepínač není (výzkum běží na počítači). Kopie stromu z výzkumu má ve Správě stromů
    přepínač vypnutý; jeho zapnutí otevře **Výzkum pro kopii stromu** ([S1.10.1](#S1.10.1)).
- **Ovládání:** aplikace: přepínač **Výzkum zapnutý** v panelu výzkumu (strom bez sledování živě a po skončení
  sledování) a ve **Správě stromů** u řádku stromu; panel výzkumu, když výzkum neběží: **Zapnout**; **Nastavení** →
  **Výzkum na tomto počítači** → **Vypnout výzkum po nečinnosti**. Terminál: `strom live start`, `strom live stop`,
  `strom config set live.idleMinutes 0` (do vypnutí počítače) nebo `120` (po 2 hodinách nečinnosti).
- **Platí od:** aplikace 3.25.0, výzkum 1.29.0. Stav na přepínači a věta po 30 s od aplikace 3.30.0.

<!-- zdroj: research:src/core/live.ts liveWrite (POST <token>/live {idleMinutes 0…10080} → strom config set live.idleMinutes; {do: stop} → konec stopped, adresa zůstává), liveState (/status live idleMinutes, idleChoices), IDLE_READ_MS 60 s, reviveLive + endedIdle (zpět s prací jen konec idle; bez slova: zpět s menu, prací, aktualizací), stop SIGTERM → signal · src/core/config.ts DEFAULT_LIVE_IDLE_MINUTES 0, LIVE_IDLE_AFTER_MINUTES 120, LIVE_IDLE_CHOICES, LIVE_IDLE_MAX_MINUTES · src/core/links.ts LINK_LIVE_DOS start · src/commands/links.ts startBridge (bez okna) · app:src/ui/research-live-ui.ts researchLiveState (onComputer, link.copy, features live.stop / live.start), fillResearchLiveSlot, fillResearchLiveStart, renderResearchLiveSettings (LIVE_IDLE_FOREVER, LIVE_IDLE_TWO_HOURS, idleCustom), COMMAND_START / COMMAND_STOP · src/ui/research-ui.ts researchLiveSlot (panel po skončení sledování, idle, start) · src/ui/tree-management.ts researchLiveSlotHtml · strings.ts researchLive.* · index.html settings-group-research-live · spec 064 K1.1–K2.3 · 3.30.0: app:cd35804c src/ui/research-live-ui.ts START_CONFIRM_MS 30 s, researchLiveTimedOut (liveSilent, COMMAND_START, retry) · src/ui/switch-pend.ts (turningOn, turningOff) -->

<a id="S1.10"></a>
## S1.10 Jeden výzkum, jeden strom: kopie bez výzkumu

Do jednoho výzkumu zapisuje jen jeden strom v aplikaci: ten, který s výzkumem vznikl nebo ho převzal. Každá kopie
stromu z výzkumu je strom bez výzkumu. Nic do výzkumu neposílá: sama, tlačítkem ani prvním zápisem souborů.

- **Co je kopie:** **Kopie celého stromu** (dřív **Duplikovat**, [A14.3](A14-trees-and-structure.md#A14.3)),
  dosavadní strom po **Otevřít jako kopii** u stromu z výzkumu (nový strom z výzkumu bere jeho aktualizace, strom
  se změnami zůstane, jak je, jako kopie; [S1.2](#S1.2)), druhé načtení souboru JSON téhož výzkumu, sloučení
  do nového stromu ([A8.10](A8-merging-trees.md#A8.10)) a stromy obnovené ze zálohy všech stromů jako nové.
- **Jak se kopie ukáže:** ve Správě stromů a v kroku 1 průvodce sloučením „kopie stromu „{název}“ · bez výzkumu“,
  s vypnutým přepínačem **Výzkum zapnutý**. Akce výzkumu nemá; ⋯ nabízí jen **Zapnout výzkum…**.
- **Poslat změny z výzkumu:** odkaz, kterým si výzkum o úpravy řekne, pošle vždy jen strom, který k výzkumu patří.
  Dotaz, který strom poslat, už není.
- **Hranice:** kopie kopie nese název té kopie. Nový strom z výběru a stromy z rozdělení jsou také bez výzkumu
  ([A14](A14-trees-and-structure.md#A14)).
- **Ovládání:** Správa stromů ([A14.1](A14-trees-and-structure.md#A14.1)).
- **Platí od:** aplikace 3.32.0. Dřív zůstávala kopie napojená na výzkum originálu, jen se z něj neaktualizovala.

<!-- zdroj: app:7d4236f8 (134 bod 11, 13: kopie stromu výzkumu nic nezapisuje do výzkumu originálu) · src/tree-manager.ts canSendToResearch (isResearchOwner), duplicateTree copyOf · src/research-owner.ts · src/ui/research-ui.ts sendChangesToResearch (?send= jen vlastník, „Only the research's owner is sent“) · f3c66503 (sloučení do nového stromu a obnovená záloha = kopie bez výzkumu) · src/tree-row.ts treeOriginLine · strings.ts research.copyOf, structure.turnOnResearch · dirigent:prace/_drobnosti/doc.md 134 bod 11+13 -->

<a id="S1.10.1"></a>
### S1.10.1 Výzkum pro kopii stromu

Kopie může dostat vlastní, nový výzkum, nebo převzít výzkum originálu. Obojí nabízí okno **Výzkum pro kopii stromu**:
„„{kopie}“ je kopie stromu „{originál}“. Do jednoho výzkumu zapisuje jen jeden strom, proto kopie dostane vlastní,
nový výzkum.“

- **Založit nový výzkum:** pole **Složka nového výzkumu** má předvyplněný název kopie (s cestou, kde výzkum na tomto
  počítači výzkumy zakládá, když ji výzkum řekne). Dál pokračuje založení výzkumu jako u **Začít výzkum**
  ([S4](S4-research-from-the-app.md)). Do nového výzkumu nejdou čísla osob a pramenů jiného výzkumu; kopie dostane
  čísla nového výzkumu.
- **Převzít výzkum stromu „{originál}“…:** jen když originál výzkum má; okno pak řekne i „Výzkum „{číslo}“ zůstává
  stromu „{originál}“.“ Převzetí se potvrzuje varováním: „Strom „{originál}“ se od výzkumu „{číslo}“ odpojí
  a přestane do něj zapisovat. Zapisovat bude jen kopie.“ a „Originál zůstane jako strom bez výzkumu.“, tlačítko
  **Převzít výzkum**. Převzetí proběhne jen v aplikaci; do výzkumu se nic neposílá.
- **Hranice:** okno je jen na počítači, kde lze výzkum založit z aplikace; ne u ukázkového stromu.
- **Ovládání:** Správa stromů, přepínač u kopie; ⋯ u kopie → **Zapnout výzkum…**.
- **Platí od:** aplikace 3.32.0

<!-- zdroj: app:023879dd src/ui/research-adopt-ui.ts showCopyResearchDialog (složka = název kopie, treesRoot, copyResearchStays a Převzít jen u vlastníka originálu, is-danger potvrzení), src/research-owner.ts transferResearchTie (jen v aplikaci), src/research-link.ts (bez REFN P…/S… jiného výzkumu, K5.4) · a236a31e (název složky i přes soubor v Safari, cesta výzkumů) · strings.ts structure.copyResearch*, createResearch, takeOver* · spec 139 K5.1–K5.4 -->

<a id="S1.10.2"></a>
### S1.10.2 Jednorázové odpojení stromů, které sdílely výzkum

Stromy, které před aplikací 3.32.0 sdílely jeden výzkum (starší kopie nebo dva stromy téhož výzkumu), se při prvním
spuštění nové verze jednou rozdělí. Výzkum si nechá jeden strom, ostatní jsou kopie bez výzkumu.

- **Který strom zůstane:** strom, který není kopií; z několika takových nejstarší. Jsou-li všechny kopiemi, nejstarší
  kopie zůstane, jak je, a do výzkumu dál nic nezapisuje.
- **Ostatní:** před odpojením dostanou zálohu **Před úpravou dat pro novou verzi** ([S6.5](S6-tree-from-another-program.md#S6.5)),
  data zůstanou beze změny. Zamčený šifrovaný strom se nečte a nezálohuje; změní se jen jeho záznam ve Správě
  stromů.
- **Při prvním otevření** odpojeného stromu se jednou ukáže okno **Kopie bez výzkumu**: „Strom „{název}“ byl kopií
  napojenou na výzkum stromu „{originál}“. Vazba se zrušila, aby do výzkumu zapisoval jen jeden strom. Vlastní
  výzkum jde založit ve Správě stromů.“ Když kopie do výzkumu předtím poslala změny:
  - čekají-li ve výzkumu: „Předtím kopie do toho výzkumu poslala změny ({datum}). Čekají ve výzkumu a jde je tam
    zahodit.“;
  - jsou-li zapsané: „…Výzkum je vezme zpět jedním krokem ve svém terminálu:“ a příkaz `strom sync undo I0042`
    s **Kopírovat**; se známým vstupem i **Vzít zpět ve výzkumu**, jinak `I…` a „I… je číslo toho odeslání ve
    výzkumu (ukáže ho strom input list).“ ([S2.6](S2-edits-from-the-app.md#S2.6)).

  Okno má **Zavřít** a, kde to jde, **Začít výzkum**.
- **Hranice:** oprava proběhne jednou; starší rejstřík stromů vrácený zpět se prohlédne znovu.
- **Platí od:** aplikace 3.32.0

<!-- zdroj: app:e4e3eeea src/tree-manager.ts repairSharedResearchTies (researchTiesRepaired, planSharedTieRepair, backupBeforeTieRepair 'pre-migration' bez čtení zamčeného šifrovaného, detachAsCopy, researchDetached) · src/research-owner.ts planSharedTieRepair (keeper: bez copyOf, nejstarší; jinak nejstarší kopie) · src/ui/research-detached-ui.ts showResearchDetached (jednou, sentAfterCopy pending/undo step, adoptTree) · strings.ts research.detached*, undoStep*, backups label pre-migration · dirigent:prace/_drobnosti/doc.md 134 bod 13 -->
