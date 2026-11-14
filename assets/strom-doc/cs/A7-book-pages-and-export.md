<a id="A7"></a>
# A7 Kniha, stránky a export

Co aplikace Strom dává ze stromu ven (kniha rodu, stránky, soubory pro rodinu i pro jiné programy) a jak přitom
chrání žijící osoby. Popisuje aplikaci 3.21.2.

| Výstup | Co to je |
|---|---|
| **Kniha rodu** | kniha ke čtení od začátku, k tisku na A4 nebo uložení jako HTML ([A7.4](#A7.4)) |
| **Stránky rodu**, **Stránky stromu** | propojený soubor stránek rodů, rodin a osob ([A7.5](#A7.5)) |
| **Stránka osoby** | celý život jedné osoby, k prohlížení, tisku a uložení jako HTML ([A7.6](#A7.6)) |
| **Aplikace i s daty (HTML)** | samostatný soubor s aplikací a stromem ([A7.7](#A7.7)) |
| **Poslat rodině** | jeden soubor e-mailem k otevření, doplnění a poslání zpět |
| **Plakát** | aktuální pohled jako SVG, PNG nebo vícestránkové PDF |
| **Záloha dat (JSON)**, **GEDCOM**, **Tabulka osob (CSV)** | data pro obnovení a pro jiné programy ([A2](A2-loading-a-family-tree.md)); vlastní sloupce, filtr a řazení: export z pohledu Tabulka ([A6.7.9](A6-views.md#A6.7.9)) |

- Zálohu a aplikaci s daty jde zašifrovat heslem (**Zašifrovat heslem**); GEDCOM ne. Šifrování funguje jen na zabezpečené
  adrese: přes https, na `localhost` nebo `127.0.0.1` a v souboru otevřeném z disku; na adrese `http://` v síti ne a dialog
  hesla to řekne ([A1.1](A1-the-app-in-brief.md#A1.1)).

<!-- zdroj: app:strings.ts importExport.app, importExport.share, importExport.poster, importExport.book, importExport.backup, importExport.gedcom, importExport.csv · src/ui/import-export.ts (exportTargetTreeJSON, exportTargetTreeApp s heslem; GEDCOM bez hesla) · šifrování jen na zabezpečené adrese: src/crypto.ts isCryptoAvailable, src/crypto-errors.ts resetPasswordError, strings.ts encryptToggle, insecureContext, commit 266d6a76, dirigent:prace/1110-app-github-11-13 -->

<a id="A7.1"></a>
## A7.1 Kdo je žijící osoba

Ochrana žijících ([A7.2](#A7.2)) se týká jen osob, které aplikace považuje za žijící.

1. Osoba označená jako zemřelá (**Zemřel/a**) je zemřelá; osoba, která má v datech výslovně „žije“, je žijící.
2. Osoba s datem úmrtí je zemřelá.
3. Jinak je žijící, když od jejího nejpozdějšího možného roku narození uplynulo méně než 110 let.
4. Osoba bez roku narození a bez jiného vodítka je žijící (bezpečná volba).

- Nejpozdější možný rok narození se bere z vlastních dat a událostí osoby, ze sňatku (nejméně 14 let před ním)
  a z dětí (rodič je nejméně o 12 let starší než dítě, přes další generace).
- **Hranice:** značka † u osoby ve stromu je jiné pravidlo (domněle zemřelá po 120 letech) a ochranu neřídí.
  Úmrtí potomka samo předka za zemřelého neoznačí.
- **Ovládání:** zaškrtávátko **Zemřel/a** v úpravě osoby; při přidání příbuzného se zaškrtne samo, když se vyplní
  datum nebo místo úmrtí.
- **Platí od:** aplikace 1.2.0; samočinné zaškrtnutí Zemřel/a aplikace 3.21.2

<!-- zdroj: app:src/privacy.ts:215 ASSUMED_MAX_AGE, :217 MIN_PARENT_AGE, :219 MIN_MARRIAGE_AGE, :229 isLivingPerson, inferBirthUpperBounds · presumedDeceasedSet · strings.ts person.deceased · CHANGELOG.cs.md 3.21.2 -->

<a id="A7.2"></a>
## A7.2 Ochrana žijících

Před výstupem ze stromu se volí, jak ukázat žijící osoby. V exportu se volba jmenuje **Soukromí žijících osob**,
v knize rodu **Ochrana žijících**.

| Volba | Jméno žijící osoby |
|---|---|
| **Plná data** | beze změny, nic se neskrývá |
| **Iniciály + rok narození** | iniciály jména a příjmení, rok narození zůstává; příjmení po sňatku jen iniciála |
| **Skrýt jména** | „Žijící osoba“, bez příjmení |
| **Ponechat jen příjmení** | „Žijící osoba“ a příjmení |

- Každá volba kromě Plná data žijícím odebere všechna data a místa, poznámky, vyprávění, fotku, události,
  citace, přílohy, varianty jména, tituly, příjmení po sňatku, otevřenou otázku, REFN a údaje výzkumu.
  U Iniciál zůstává rok narození.
- Údaje páru (data, místo, poznámka, svědci, vyprávění, události) zmizí, když je žijící aspoň jeden z partnerů.
  Iniciály ponechají rok začátku svazku.
- **Hranice:** struktura zůstává vždy: osoby, vztahy a pohlaví. Zemřelé osoby se nemění.
- **Prameny:** v exportu (Aplikace i s daty, JSON, GEDCOM) každá volba kromě Plná data vynechá katalog pramenů,
  citace a přílohy **u všech osob, i zemřelých** (aplikace to u volby napíše). Kniha rodu, stránky a stránka osoby
  berou prameny jen žijícím; pramen citovaný jen u žijících vypadne.
- **Platí od:** aplikace 1.2.0; prameny zemřelých v knize a na stránkách aplikace 3.18.0
- **Od aplikace 3.26.0:** export GEDCOM drží prameny a citace zemřelých v každé volbě; vynechá jen citace žijících
  osob a řekne to („U N žijících osob se vynechá K citací. Zemřelým prameny zůstanou.“, volba **Ponechat prameny**).
  Export Aplikace i s daty a JSON se nemění. Export GEDCOM se nejdřív ptá, **K čemu soubor je**: **Zpět do
  {program}** (plná data, prameny a ID programu), nebo **Ke sdílení s ostatními**
  ([S6.6](S6-tree-from-another-program.md#S6.6)).

<!-- zdroj: app:src/privacy.ts applyPrivacy (keepDeceasedSources) · strings.ts privacy.label, privacy.modeFull, privacy.modeInitials, privacy.modeAnonymous, privacy.modeMinimal, privacy.livingPerson, privacy.dropsSources · book.dlg.privacy · CHANGELOG.cs.md 3.18.0 -->

<a id="A7.2.1"></a>
### A7.2.1 Výchozí ochrana podle výstupu

| Výstup | Výchozí volba |
|---|---|
| Aplikace i s daty (HTML) | Iniciály + rok narození |
| GEDCOM | Iniciály + rok narození |
| Poslat rodině | Iniciály + rok narození |
| Kniha rodu | Iniciály + rok narození |
| Stránka osoby | Plná data, když na stránce není žádná žijící osoba; jinak naposledy zvolená, jinak Iniciály |
| Tabulka osob (CSV), Exportovat všechny stromy | Plná data |

- **Hranice:** Stránky rodu a Stránky stromu s chráněnou osobou nedělají vlastní stránku ani odkaz; v rejstříku je
  pod chráněným jménem. Když výběr obsahuje žijící osoby a ochrana je vypnutá, dialog upozorní, že soubor ponese
  jejich jména, data a místa.
- **Platí od:** aplikace 1.2.0; stránka osoby aplikace 3.18.0; kniha rodu aplikace 3.19.0
- **Od aplikace 3.26.0:** GEDCOM s volbou **Ke sdílení s ostatními** (výchozí) má Iniciály + rok narození, s volbou
  **Zpět do {program}** Plná data ([S6.6](S6-tree-from-another-program.md#S6.6)).

<!-- zdroj: app:src/ui/import-export.ts (výchozí privacy podle formátu) · src/book-options.ts:55 · src/person-page.ts:94, :104 personPageExportPrivacy · src/family-pages.ts:309 · src/ui/share-ui.ts · strings.ts familyPages.privacyWarn -->

<a id="A7.3"></a>
## A7.3 Obsah souboru

Při exportu se vedle ochrany volí **Obsah**: co se uloží do souboru.

| Předvolba | Fotky | Přílohy a výřezy pramenů | Poznámky | Zdroje a citace |
|---|---|---|---|---|
| **Kompletní archiv** | ano | ano | ano | ano |
| **Malý soubor k odeslání** | ne | ne | ano | ano |
| **Jen kostra** | ne | ne | ne | ne |

- **Hranice:** struktura stromu a jména zůstávají vždy. Pracovní dílna výzkumu (fronta, úkoly, koncepty
  vyprávění) se do exportu nedává nikdy. Volba ochrany může zdroje a přílohy vynechat i při Kompletním archivu
  ([A7.2](#A7.2)).
- **Platí od:** aplikace 2.4.0

<!-- zdroj: app:src/privacy.ts CONTENT_PRESETS, stripResearchWork · strings.ts privacy.contentLabel, privacy.presetComplete, privacy.presetSmall, privacy.presetSkeleton, privacy.dropsSourcesContent -->

<a id="A7.4"></a>
## A7.4 Kniha rodu

Kniha rodu je kniha ke čtení od začátku: rodokmen, rodiny po generacích, vyprávění a prameny.

- **Co do knihy:** **Celý strom** · **Rody** (jeden nebo víc) · **Předci osoby** · **Potomci osoby** (výběr osob
  [A7.4.1](#A7.4.1)).
- **Části knihy** v tomto pořadí: **Obsah**, **Rodokmen rodu**, **Rodiny** (vždy), **Vyprávění**, **Graf a časová
  osa života**, **Doba (dějiny)**, **Prameny**, **Výřezy zápisů a fotky**, **Další rodiny (malé rody)**,
  **Rejstřík osob**.
- Část bez obsahu se vynechá a dialog řekne proč: Vyprávění potřebuje vyprávění, graf jinou podrobnost než
  stručnou, Doba dějiny, Prameny citované prameny, Výřezy fotku nebo výřez. Další rodiny jsou jen v knize celého
  stromu.
- **Předvolba:** **Pro rodinu** (všechny části, běžná podrobnost, bez poznámek a údajů pro badatele) ·
  **Pro badatele** (plná podrobnost, poznámky, údaje pro badatele: stav doložení a rozpory,
  [R3.8](R3-verification-and-citation.md#R3.8)) · **Vlastní**. Výchozí je Celý strom, Pro rodinu, Iniciály + rok
  narození a jazyk aplikace.
- **Název** se tvoří podle výběru (název stromu, Rod X, Předci: jméno, Potomci: jméno) a jde přepsat.
- **Jazyk knihy** mění nadpisy a popisky; údaje ze stromu se nepřekládají.
- Volby se pamatují pro každý strom.
- **Ovládání:** export **Kniha rodu**; okno knihy: tisk na A4 a **Uložit jako HTML**.
- **Platí od:** aplikace 3.19.0; předvolba Vlastní aplikace 3.21.0

<!-- zdroj: app:src/book-options.ts (části, předvolby, výchozí :55) · strings.ts book.dlg.kind, book.dlg.parts, book.dlg.preset, book.dlg.lang, book.parts, book.unavailable · CHANGELOG.cs.md 3.19.0, 3.21.0 -->

<a id="A7.4.1"></a>
### A7.4.1 Výběr osob do knihy a stránek

| Výběr | Osoby | Pořadí |
|---|---|---|
| Celý strom | všechny osoby | podle narození |
| Rody | členové rodů s rodinami a manželky a manželé členů | kapitola na každý rod |
| Předci osoby | předci do zvoleného počtu generací a svazky, ze kterých členové pocházejí | generace po generaci, otec před matkou |
| Potomci osoby | potomci do zvoleného počtu generací přes syny i dcery, s partnery a všemi svazky | podle narození |
| Vybrané osoby (jen stránky) | jen vybrané osoby; rodina jen tehdy, když jsou vybraní oba partneři | – |

- **Hranice:** linii předků a potomků nesou rodiče biologičtí a osvojitelé. Nevlastní rodič a pěstoun linii
  nenesou. Otcem se rozumí rodič muž, biologický před osvojitelem.
- **Platí od:** aplikace 3.19.0; Vybrané osoby aplikace 3.21.0

<!-- zdroj: app:src/lineage.ts selection, :279 isDescentLink · strings.ts book.dlg.kind, book.dlg.kindHint -->

<a id="A7.5"></a>
## A7.5 Stránky rodu a stránky stromu

Stránky jsou propojený soubor stránek: rod, rodiny a osoby s odkazy mezi sebou a s rejstříky osob, rodin,
příjmení a obcí.

- **Stránky rodu:** jeden nebo víc rodů ([A4](A4-surnames-and-families.md)).
- **Stránky stromu:** **Stránky celého stromu** (všechny rody a Další rodiny), **Vybrané osoby**, předci osoby
  se zvoleným počtem generací.
- Ochrana žijících a prameny podle [A7.2](#A7.2); výchozí Iniciály + rok narození.
- **Platí od:** Stránky rodu aplikace 3.20.0; Stránky stromu aplikace 3.21.0

<!-- zdroj: app:src/family-pages.ts · strings.ts familyPages.menuItem, familyPages.treePages, familyPages.treePagesAction, familyPages.indexTitle · spec 026 · CHANGELOG.cs.md 3.20.0, 3.21.0 -->

<a id="A7.6"></a>
## A7.6 Stránka osoby

**Stránka osoby** ukazuje celý život jedné osoby: data slovy, rodinu jako malý rodokmen, vyprávění, místa života
na mapě, osu života s dějinami, výřezy z matrik a prameny a oddíl **Pro badatele**.

- **Uložit jako HTML** vytvoří jeden samonosný soubor, který se otevře offline v každém prohlížeči. Skupiny
  obsahu a ochrana žijících jdou zvolit ([A7.2.1](#A7.2.1)); volba se pamatuje.
- **Od aplikace 3.28.0:** v okně aplikace vede **◎ Cesta předků na mapě ›** na cestu předků osoby v Migraci
  v čase ([A6.5.4](A6-views.md#A6.5.4)). Uložená stránka ho nemá. Stojí v oddílu **Místa života**; osoba s nejvýš
  jedním vlastním místem, která má předky na mapě, ho má na vlastním řádku tam, kde by oddíl byl.
- **Ovládání:** nabídka karty osoby, **Stránka osoby**; také z vějíře.
- **Platí od:** aplikace 3.18.0

<!-- zdroj: app:src/person-page.ts · strings.ts personPage.save, fan.personPage · CHANGELOG.cs.md 3.18.0 · 3.28.0: app:src/person-page-map.ts pp-map-path (jen mode app), src/ui/person-page-ui.ts personPageMapPath, commit 34e82d43 · mapPathRowHtml (bez oddílu Místa života), commit caea192a -->

<a id="A7.7"></a>
## A7.7 Uložené HTML (samostatný soubor)

**Aplikace i s daty (HTML)** uloží aplikaci a strom do jednoho souboru, který se otevře v každém prohlížeči bez
instalace. **Exportovat jako aplikaci** v **Exportovat všechny stromy** dá všechny stromy do jednoho souboru.

- Takový soubor má vlastní úložiště v prohlížeči. S aplikací na stromapp.info se **nesynchronizuje**; změny
  zachová **Uložit soubor** (stáhne kopii) a do webové aplikace se přenesou importem (**Ze Strom HTML**).
- **Hranice:** soubor ve výchozím stavu chrání žijící (Iniciály, [A7.2.1](#A7.2.1)).
- **Platí od:** aplikace 1.0.0

<!-- zdroj: app:strings.ts importExport.app, importExport.appDesc, importExport.exportAllApp, importExport.fromHtml, embeddedMode.* · src/ui/import-export.ts -->

<a id="A7.8"></a>
## A7.8 Vyprávění

Vyprávění je souvislý text o osobě nebo o manželství, sestavený nad fakty stromu. Není to pramen: fakta dokládají
prameny, vyprávění je jen převypráví ([A3.6](A3-evidence-in-the-app.md#A3.6)).

- **Kde je vidět:** okno **Vyprávění** (z nabídky karty osoby), stránka osoby ([A7.6](#A7.6)) a v knize rodu část
  **Vyprávění** až za **Rodinami** ([A7.4](#A7.4)). Vyprávění páru, jedno za každé manželství, stojí pod vyprávěním
  osoby; v knize má vlastní podkapitolu.
- **Formát textu:** prázdný řádek dělí odstavce; řádek `## …` je podnadpis; řádky `- …` jsou odrážky; `**tučně**`
  a `*kurzíva*`. Jiné značky zůstanou obyčejným textem. `* 1831` (narození) ani `1. ledna` na začátku řádku odrážku
  nezačnou. Úvodní `# …`, který jen opakuje podnadpis kapitoly, se vynechá. Holý kód pramene v textu se čte jako
  jeho název.
- **Hranice:**
  - vlastní vyprávění osoby jde psát a upravovat v úpravě osoby, oddíl **Vyprávění**: **Podnadpis kapitoly** a **Text
    vyprávění**. Oddíl je vidět, když je zapnuté **Nastavení → Karta osoby → Pokročilá pole** nebo už nějaký text
    existuje. Vyprávění páru a **Opírá se o** (fakta a výhrada autora) přicházejí se souborem a jsou jen ke čtení;
  - koncept od výzkumu, dosud neschválený, nese štítek **Návrh** a odkaz **Schválit ve výzkumu**. Nová verze od
    výzkumu čeká vedle schválené („Nová verze čeká“, **Porovnat**); úprava v aplikaci ji nezruší, rozhoduje se ve
    výzkumu ([R3.9.1](R3-verification-and-citation.md#R3.9.1));
  - v knize ani v tisku pod textem nejsou prameny; prameny vyprávění jsou očíslované v seznamu pramenů knihy;
  - v souboru GEDCOM je vyprávění ve vlastní značce `_STORY`, ne v poznámce.
- **Ovládání:** nabídka karty osoby → **Vyprávění**; úprava osoby → oddíl **Vyprávění**.
- **Platí od:** aplikace 2.8.0; vyprávění páru a stránka osoby 3.18.0; v knize rodu 3.19.0

<!-- zdroj: app:src/story-text.ts:1 storyProseHtml (odstavce, ##, -, **, *) · src/ui/person-modal.ts:662 fillStoryFields · index.html pm-story-section · src/book-blocks.ts:594 storyBlock · src/book.ts proseHtml · src/person-page.ts · src/ged-exporter.ts:449 pushStory _STORY · strings.ts story.* · commit 52000825 (aplikace 2.8.0) · CHANGELOG.cs.md 3.18.0, 3.22.0 -->
