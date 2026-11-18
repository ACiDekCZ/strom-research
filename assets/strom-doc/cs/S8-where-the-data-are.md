<a id="S8"></a>
# S8 Kde jsou data

Aplikace drží stromy v úložišti prohlížeče na tomto zařízení. Výzkum a Archiv Stromu drží svůj strom ve složce na
disku tohoto počítače, s prameny, materiálem a historií. Od výzkumu 1.35.0 drží výzkum i portréty, fotky svazků
a přílohy stromu z aplikace. Kapitola popisuje aplikaci Strom 3.30.0 a výzkum 1.35.0. Jak most mezi nimi strom
přenáší, popisuje [S1](S1-connecting-app-and-research.md) a [S2](S2-edits-from-the-app.md).

| Co | Kde je | Trvalá kopie | Ovládání |
|---|---|---|---|
| strom v aplikaci, zálohy v aplikaci | úložiště prohlížeče | soubor JSON (**Uložit do souboru**, **Exportovat**) | aplikace: **Kde jsou data** |
| originály čekající na výzkum | úložiště prohlížeče, nejvýš 2 GB | žádná, dokud je výzkum nepřijme ([A3.4.1](A3-evidence-in-the-app.md#A3.4.1)) | aplikace: **Nastavení → Data a soukromí** |
| strom výzkumu, prameny, materiál, historie | složka výzkumu (výchozí `Strom` v Dokumentech) | balík `strom pack` | terminál |
| skeny z archivů, originály, soubory stromu z aplikace | sdílená složka výzkumu (`shared`) | balík `strom pack` | terminál |
| portréty, fotky svazků, přílohy | ve stromu v aplikaci; od výzkumu 1.35.0 i ve výzkumu | soubor JSON s obrázky, nebo výzkum 1.35.0 | aplikace i terminál |

<!-- zdroj: dirigent:spec/108-kde-se-co-uklada · app:src/storage.ts strom-db, strom-originals · strings.ts fileCopy.title „Kde jsou data“, fileCopy.intro, backupsNote · research:src/core/paths.ts:148 (Dokumenty/Strom), src/core/config.ts:276 shared · research:c9a4b614 CHANGELOG.cs.md 1.35.0 -->

<a id="S8.1"></a>
## S8.1 Co je jen v prohlížeči

Strom v aplikaci je jen v úložišti tohoto prohlížeče, dokud se neuloží do souboru. Prohlížeč může úložiště
smazat; zálohy v aplikaci leží ve stejném úložišti a zmizí s ním.

- Okno **Kde jsou data** řekne, jestli prohlížeč úložiště drží trvale, kdy byl strom naposledy uložený do souboru
  a jak úložiště udržet (instalace jako aplikace, trvalé úložiště ve Firefoxu, Dock nebo plocha v Safari).
- **Uložit do souboru** uloží celý strom se všemi údaji a obrázky do souboru JSON, který jde znovu otevřít ve
  Stromu. Šifrovaný strom jde uložit šifrovaně.
- Soukromé okno prohlížeče stromy po zavření smaže.
- **Hranice:**
  - každý prohlížeč a každé zařízení má vlastní úložiště: strom otevřený v Chrome v Edgi ani v telefonu není;
  - originály čekající na výzkum nejsou ve stromu, v zálohách ani v exportu ([A3.4.1](A3-evidence-in-the-app.md#A3.4.1));
  - u stromu bez výzkumu jsou portréty, fotky svazků a přílohy jen ve stromu v prohlížeči a v jeho souborech:
    „Soubory jsou jen v tomto prohlížeči. Záloha: Exportovat vše.“
- **Ovládání:** aplikace: ukazatel **Jen v prohlížeči** v liště, **Kde jsou moje data?**; **Nastavení →
  Připomínat uložení do souboru**.
- **Platí od:** aplikace 3.0.0

<!-- zdroj: app:src/storage.ts strom-db · src/ui/file-copy-ui.ts · strings.ts fileCopy.title, intro, statePersistent, stateNotPersistent, statePrivate, backupsNote, save, quickHint, saveEncryptedBtn, details, settingLabel · materials.whereApp · S1.8 -->

<a id="S8.2"></a>
## S8.2 Co je ve výzkumu a v Archivu Stromu

Výzkum i Archiv Stromu drží strom ve vlastní složce na disku. Mají v ní strom s historií, prameny, materiál
a úkoly; skeny z archivů, originály a soubory stromu z aplikace jsou ve sdílené složce, každý soubor jednou.

- Strom v aplikaci a strom ve výzkumu jsou dvě kopie. Co aplikace pošle, výzkum zapíše podle [S2](S2-edits-from-the-app.md).
- Soubory výzkumu, které ve stromu nejsou, ukáže aplikace v okně **Materiály** jako **jen v archivu**
  ([A3.5](A3-evidence-in-the-app.md#A3.5)).
- **Hranice:**
  - šifrovaný strom v aplikaci neznamená šifrovaný výzkum: „Strom je šifrovaný, výzkum na disku šifrovaný není.“;
  - materiál výzkumu je vidět jen v aplikaci na počítači.
- **Ovládání:** terminál: `strom pack` (balík jako záloha nebo k předání), `strom unpack`, `strom trees remove`
  ([S8.6](#S8.6)); aplikace: ⓘ **Kde soubory jsou** v okně **Materiály**.
- **Platí od:** výzkum 1.0.0; soubory stromu z aplikace ve výzkumu 1.35.0

<!-- zdroj: research:src/core/paths.ts, src/core/config.ts (home, shared), src/core/media.ts sharedMediaPath (media/<sha[0:2]>/<sha[2:4]>/<sha><ext>) · app:strings.ts materials.whereTitle, whereArchiveResearch, whereEncryptedResearch, desktopOnlyResearch -->

<a id="S8.3"></a>
## S8.3 Fotky a přílohy stromu ve výzkumu

Výzkum 1.35.0 a Archiv Stromu 1.35.0 drží portréty, fotky svazků a přílohy stromu z aplikace Strom. Zápis stromu
je předá všechny; výzkum každý soubor uloží jednou, podle obsahu, s jeho místy ve stromu
([R11.5.1](R11-material-from-the-user.md#R11.5.1)).

- Originál portrétu jde do výzkumu jako originál přílohy se štítkem **Portrét**, originál fotky svazku jako
  materiál obou partnerů. Originál vytvoří úkol podklady; v Archivu Stromu čeká odložený.
- Načtení stromu z výzkumu vrátí soubory podle otisku: aplikace dostane portréty, fotky svazků a přílohy na jejich
  místa. Soubor odebraný v aplikaci výzkum skryje, nesmaže ho ([A3.5.6](A3-evidence-in-the-app.md#A3.5.6)).
- **Hranice:**
  - výzkum nedrží, kde v celé fotce je výřez portrétu. Strom v aplikaci si ho při načtení nové verze ponechá;
    strom poprvé načtený z výzkumu má portrét i celou fotku, ale **Upravit výřez** jde jen uvnitř čtverce portrétu
    ([A12.3](A12-portrait-and-couple-photo.md#A12.3));
  - výzkum do 1.34 soubory stromu nedrží: portréty, fotky svazků a přílohy jsou jen v aplikaci a načtení z výzkumu
    je ve stromu ponechá ([A12.8](A12-portrait-and-couple-photo.md#A12.8));
  - jen na počítači a jen s mostem výzkumu.
- **Ovládání:** aplikace: zápis stromu (**Poslat**, [S2](S2-edits-from-the-app.md)); **Výzkum u stromu →
  Posílat originály souborů**.
- **Platí od:** aplikace 3.30.0, výzkum 1.35.0

<!-- zdroj: dirigent:spec/108-kde-se-co-uklada (U8, K2.3, K2.6, K2.7) · app:3419afff POST /sync?media=app, 7263f1f6 GET /tree.ged?images=ref&media=app, 402b7d9b, e3e415f6 (X-Strom-Person, originál se štítkem Portrét), 59ff465e · src/research-link.ts carryOverMedia (photoSource ponechaný, base K2.3) · research:0834987b (X-Strom-Family), 3925b84a (_PRIM Y), 815bc90d, 91ab6230, 771d8af0 · research:src/core/treemedia.ts (hlavička) · research:c9a4b614 CHANGELOG.cs.md 1.35.0 -->

<a id="S8.4"></a>
## S8.4 Ukazatel Jen v prohlížeči

Ukazatel **Jen v prohlížeči** svítí, když strom má změny, které žádný soubor nedrží. U stromu s výzkumem na
počítači nesvítí, když výzkum drží všechny jeho úpravy.

- Úpravy poslané výzkumu, nebo čerstvé, poslané do 10 minut, se počítají jako držené. Úprava neposlaná déle (most
  neběží, výzkum ji odmítl, posílá se ručně) ukazatel rozsvítí.
- Portréty, fotky svazků a přílohy výzkum do 1.34 nedrží: dokud je nemá soubor, ukazatel svítí i u stromu, jehož
  úpravy výzkum drží.
- U výzkumu 1.35.0 se fotky a přílohy počítají jako držené po prvním zápisu stromu, který je předal. Obrázek
  přidaný potom čeká jako každá neposlaná úprava.
- **Hranice:** export bez fotek se jako kopie fotek nepočítá. Strom výzkumu neotevřený od aktualizace aplikace se
  počítá jako dřív, dokud se neotevře.
- **Ovládání:** aplikace: ukazatel v liště otevře **Kde jsou data**; **Uložit do souboru**.
- **Platí od:** aplikace 3.0.0; 3.30.0: fotky a přílohy v ukazateli

<!-- zdroj: app:e434e730, a678b253 src/browser-media.ts browserMediaFingerprint, browserMediaSafe, archiveHoldsAppMedia · src/ui/research-sync-ui.ts researchHoldsTree, RESEARCH_HOLD_MS=10 min, researchArchiveHoldsMedia · src/tree-manager.ts noteFileCopy (export bez fotek), learnMediaFingerprints · src/ui/file-copy-ui.ts unsavedOutsideResearch · strings.ts fileCopy.indicatorShort, indicatorTitle · dirigent:spec/108-kde-se-co-uklada K1b.1, K2.6 -->

<a id="S8.5"></a>
## S8.5 Fotky z výzkumu se nepodařilo načíst

Když se strom načte z výzkumu, který soubory stromu drží, ale jeho fotky podle otisku nejdou načíst, aplikace
strom načte bez nich a nic, co výzkum má, neodebere.

- Do příchodu fotek zápisy stromu jen přidávají: soubor, který strom v aplikaci teď nemá, výzkum neodebere.
- Aplikace to zkusí znovu sama po 5 a po 30 sekundách. Když to nejde, oznámí „Fotky z výzkumu se nepodařilo
  načíst.“ s **Zkusit znovu**.
- **Hranice:** **Zkusit znovu** načte verzi z výzkumu jako každé načtení: když se strom mezitím změnil, zeptá se.
- **Ovládání:** aplikace: oznámení → **Zkusit znovu**.
- **Platí od:** aplikace 3.30.0, výzkum 1.35.0

<!-- zdroj: app:6bbc2f82 src/ui/research-ui.ts noteResearchMediaMissed (zápisy jen přidávají), 61ef1bdd MEDIA_RETRY_MS=[5000, 30000], researchMediaMissed, tellResearchMediaMissed, researchRetryMedia · strings.ts sync.mediaMissed, sync.retry -->

<a id="S8.6"></a>
## S8.6 Balík a odebrání stromu: skeny a rodinné fotky

`strom pack` a `strom trees remove` rozlišují **skeny z archivů** a **rodinné fotky a originály**. Skeny jdou
z archivu stáhnout znovu, rodinné fotky a originály ne.

- Sken je obrázek z archivu (svazek nebo stažený snímek). Soubor, který je obojí, se počítá jako rodinný.
- `strom pack` vypíše obojí zvlášť. Ze skenů přibalí ty se zápisy a ty, které nikdo znovu nestáhne (nebo všechny);
  rodinné fotky a originály vždy všechny, i se zmenšenými kopiemi souborů stromu. Balík nese i dávky z aplikace.
- `strom trees remove` nejdřív nabídne zálohu balíkem, pak se zeptá zvlášť na skeny a zvlášť na rodinné fotky
  a originály, které žádný jiný rodokmen nepoužívá; u rodinných fotek je výchozí odpověď ne. Odebrání potvrdí
  napsaný název rodokmenu. Soubory jdou do koše jako jedna složka „<název> – soubory“.
- **Hranice:**
  - balík nad 4 GB nebo nad 65 535 souborů výzkum odmítne, než cokoli zapíše: výzkum přenese zkopírovaná celá
    složka (na disk USB, do složky v cloudu). `strom trees remove` to u zálohy řekne a pokračuje bez ní;
  - rodokmen odebírá jen člověk u počítače, ne agent.
- **Ovládání:** terminál: `strom pack [--all-images]`, `strom unpack "<soubor>"`, `strom trees remove`.
- **Platí od:** výzkum 1.35.0

<!-- zdroj: research:31def74a src/commands/pack.ts (ui.pack.images, ui.pack.family, ui.pack.batches, pack.too-large), src/core/pack.ts (bez ZIP64), src/core/zip.ts ZIP_MAX_FILES=0xffff · src/commands/trees.ts:271-287 (záloha výchozí ano, skeny ano jen se zálohou, rodinné ne, název), ui.remove.images.folder · research:771d8af0 (zmenšené kopie v balíku) · assets/lang/cs.json ui.pack.*, ui.remove.*, ui.error.pack.too-large -->
