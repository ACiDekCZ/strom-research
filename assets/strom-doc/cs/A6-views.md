<a id="A6"></a>
# A6 Pohledy a výběr osob

Jak aplikace Strom vybírá, které osoby ukáže, a jak je ukazují jednotlivé pohledy. Popisuje aplikaci 3.21.2; změny z novější verze mají u sebe její číslo.

Pohled je jiné čtení **téhož výběru osob**. Výběr určuje ústřední osoba (ta, na kterou se klikne) a hloubka
**Předci** a **Potomci**. Rodina, Potomci, Časová osa a Mapa ukazují stejné okolí ústřední osoby. Vějíř si
předky a potomky počítá sám podle počtu generací ([A6.4](#A6.4)). Tabulka ukazuje celý strom ([A6.7](#A6.7)),
od aplikace 3.30.0 i jen jeden seznam osob ([A6.7.19](#A6.7.19)).
Na počítači jde každý pohled otevřít i v samostatném okně ([A6.8](#A6.8)).

Pohledy: **Rodina**, **Potomci**, **Časová osa**, **Vějíř**, **Mapa**, **Tabulka**.

<!-- zdroj: app:src/types.ts:1237 ViewMode · strings.ts viewModeSwitch.* · Tabulka od aplikace 3.27.0 (viewModeSwitch.table) -->

<a id="A6.1"></a>
## A6.1 Okolí ústřední osoby v pohledu Rodina

Pohled Rodina ukazuje ústřední osobu v její rodině, ne celý strom.

- Do výběru patří:
  1. ústřední osoba a všichni její partneři;
  2. její potomci do hloubky **Potomci**, s partnery;
  3. přímí předci přes oba rodiče do hloubky **Předci**;
  4. sourozenci, i nevlastní (jejich druhý rodič se nepřidává), s partnery a potomky do hloubky Potomci;
  5. tety a strýcové (sourozenci rodičů) s partnery;
  6. bratranci a sestřenice, tedy děti tet a strýců zapsané v jejich svazku, s potomky do hloubky Potomci.
- **Hranice:** předci partnera ústřední osoby se do výběru nepřidávají nikdy. Kdo do okolí nepatří, ve stromu
  zůstává, jen ho pohled neukazuje; ukáže ho nová ústřední osoba.
- **Hloubka:** po výběru nové ústřední osoby je Předci i Potomci nastavená na největší hloubku, kterou strom u té
  osoby má. Nabídka dává 1 až tuto největší hloubku. Děti partnera z jiného svazku přidávají jednu generaci dolů.
- **Ovládání:** klik na kartu osoby; volby **Předci** a **Potomci** v liště pohledu.
- **Platí od:** aplikace 1.0.0

<!-- zdroj: app:src/layout/pipeline/1-select-subgraph.ts selectSubgraph · src/layout/pipeline/index.ts:962 includeSpouseAncestors: false · src/renderer.ts:719 computeTreeLayout, setFocus (maxGenerations) · src/focus-depth.ts maxAncestorDepth, maxDescendantDepth · strings.ts focus.ancestorsLabel, focus.descendantsLabel -->

<a id="A6.1.1"></a>
### A6.1.1 Výchozí osoba a pohled

S čím se strom otevře, určuje nastavení stromu **Výchozí osoba a pohled**.

| Volba | Možnosti |
|---|---|
| osoba | **Naposledy zobrazená** · **Konkrétní osoba:** (vybraná) |
| pohled | **Rodina** · **Naposledy použitý** (na tomto zařízení) |

- **Hranice:** bez nastavení se strom otevře na první osobě stromu. Obnovení stránky drží strom, pohled
  i ústřední osobu.
- **Ovládání:** správa stromů, u stromu **Výchozí osoba a pohled**.
- **Platí od:** výchozí osoba aplikace 1.0.0; volba pohledu a obnovení stránky aplikace 3.21.0

<!-- zdroj: app:src/renderer.ts:1178 findDefaultFocusPerson, getStartupFocus · strings.ts treeManager.defaultPersonViewTitle, focus.defaultPersonLastFocused, focus.defaultPersonSpecific, focus.defaultViewFamily, focus.defaultViewLast · CHANGELOG.cs.md 3.21.0 -->

<a id="A6.1.2"></a>
### A6.1.2 Rozestupy: Normální a Husté

Volba **Rozestupy** určuje mezery mezi kartami a mezi generacemi v pohledech Rodina a Potomci. **Husté** je zmenší,
takže se na obrazovku vejde víc osob. **Normální** je výchozí, i na telefonu.

| Mezera | Normální | Husté |
|---|---|---|
| mezi kartami vedle sebe | 31 px | 20 px |
| mezi generacemi | 80 px | 48 px |
| mezi partnery | 18 px | 14 px |

- Po přepnutí se strom hned překreslí a zůstane na stejné osobě: na kartě ústřední osoby, když je celá vidět, jinak
  na kartě nejblíž středu. Stejně se strom chová po změně **Detail karet**.
- **Pořadí sňatku:** v Husté je místo pilulky „1. ∞ 1866“ jen krátké „∞ 1“ na okraji karty, tedy pořadí tohoto
  sňatku. Celé pořadí ukáže bublina (myší, klávesnicí i klepnutím). Pilulka, pro kterou u karty není místo, se
  nekreslí.
- **Export:** export plakátu má vlastní volbu **Rozestupy** (za formátem papíru a orientací). Když se liší od
  obrazovky, obrázek, plakát i PDF po listech se rozloží znovu s vybranými rozestupy, se stejným výběrem osob a
  stejnými kartami; obrazovka se nemění. Pod každou volbou je počet listů („26 listů A4“), když se počty liší. Tisk
  (Ctrl+P) bere rozestupy obrazovky.
- **Hranice:** volba patří zařízení, se stromem se neukládá. Časová osa, Vějíř, Mapa a Tabulka mají vlastní
  rozložení a volba se jich netýká; export plakátu z Vějíře a Časové osy řádek **Rozestupy** nemá.
- **Ovládání:** **Nastavení** → **Karta osoby** → **Rozestupy** (za **Detail karet**): **Normální** · **Husté**. Na malé
  obrazovce bez kompaktní karty stojí pod volbou „Na malé obrazovce pomůže i Kompaktní karta.“ Export: **Export
  plakátu** → **Rozestupy**.
- **Platí od:** aplikace 3.27.0

<!-- zdroj: app:src/types.ts TreeSpacing, DEFAULT_LAYOUT_CONFIG (31/80/18), DENSE_LAYOUT_CONFIG (20/48/14), layoutConfigFor · src/settings.ts getTreeSpacing/setTreeSpacing (treeSpacing), getPosterSpacing/setPosterSpacing (posterSpacing), výchozí normal · src/renderer.ts:804 STANDALONE_VIEWS (timeline, fan, map, table), getPosterLayout({spacing}), kotva překreslení (ústřední karta celá v obraze, jinak nejbližší středu; i při změně typu karty) · src/marriage-order.ts (husté: „∞ N“ na okraji karty, bez místa se nekreslí) · src/ui/export-image-ui.ts (řádek za formátem a orientací, skrytý u vějíře a časové osy, sheetsCount) · strings.ts spacing.label, normal, dense, desc, scope, scopeExport, smallHint, marriageOrder.short, poster.menu, poster.sheetsCount, settings.groupCard, cardDensity.settingLabel · commity 68b9dde4, 03918007, 928db183, e2891a8a · spec 069 K1.1, K3.1 -->

<a id="A6.1.3"></a>
### A6.1.3 Děti a sourozenci najednou

V pohledu Rodina jde jedním krokem ukázat na místě děti osoby a sourozence osoby i jejích předků. Fokus, hloubka
a přiblížení zůstanou, karta osoby stojí na stejném místě obrazovky.

- **Kdo přibude:**
  - děti osoby (ne vnoučata);
  - sourozenci osoby a každého jejího předka, který je v pohledu a jehož rodiče jsou v pohledu. Horní řada hloubky
    **Předci** se nerozbaluje (její sourozenci by přinesli novou generaci, to je práce hloubky); u ní zůstává
    „▸ rodiče“;
  - sourozenci jsou děti rodičů v pohledu ze všech sňatků, stejně jako u jednotlivého „Ukázat sourozence tady“.
    S dětmi přibude i jejich druhý rodič, partneři, které pohled s nimi kreslí, a to, co pod nimi drží hloubka
    **Potomci**.
- **Počet +n:** kolik karet krok přidá; počítá ho stejné rozvržení jako pohled, takže po kroku přibude právě n
  karet. Přepočítá se po každém vykreslení.
- **Hranice:**
  - krok je jedno rozvržení, jeden krok historie a jeden krok **Skrýt ukázané · n** (n + 1). Vrátí ho **Zpět**
    v historii, **Skrýt ukázané** (vrátí všechno ukázané) nebo znovu stejná volba („Sbalit děti a sourozence“);
  - na dotčených kartách jsou záložky „▾ děti“ a „▾ sourozenci“ a jednotlivé rodiny jdou dál sbalit po jedné;
  - nová osoba ve fokusu, jiný pohled nebo strom krok zruší. Změna hloubky **Předci** nebo **Potomci** ukončí
    všechny kroky „najednou“: jejich karty zmizí, rodiny ukázané po jedné zůstanou a volba nabídne „+n“ nové hloubky;
  - nad 150 osob se aplikace nejdřív zeptá bublinou: „Přibude n osob“, „Strom se rozšíří asi na k šířek obrazovky.
    Přiblížení se nemění.“ (k ze skutečného rozvržení při dnešním přiblížení, zaokrouhleno nahoru) a tlačítka
    **Rozbalit +n**, **Jen 2 generace předků +m** (jen sourozenci osoby, rodičů a prarodičů; chybí, když m je n
    nebo 0) a **Zrušit**. Esc, klik vedle nebo změna velikosti okna = Zrušit. Do 150 osob bez ptaní.
- **Ovládání:** aplikace, pohled Rodina:
  - lišta pohledu, hned za volbami **Předci** a **Potomci**: **Děti a sourozenci +n** pro osobu ve fokusu. Zapnutý
    krok ukáže ✓ a klik ho vrátí; když není co přidat, je volba ztlumená („Všechny děti a sourozenci už jsou
    vidět“). Na tabletu ikona a „+n“; když se do lišty nevejde, ustoupí (nabídka osoby ji má dál). Telefon volbu
    v liště nemá;
  - nabídka osoby (na dotyku spodní panel osoby) pod řádky, které ukazují na místě rodiče, sourozence a děti: **Rozbalit
    děti a sourozence · +n** s podřádkem „děti osoby, sourozenci osoby a jejích předků“, jen když je co přidat;
    při stojícím kroku osoby **Sbalit děti a sourozence**. U osoby ve fokusu je to tentýž krok jako v liště.
- **Platí od:** aplikace 3.28.0

<!-- zdroj: app:f5d56ed3 src/bulk-family.ts collectBulkFamily (childrenOf osoba; siblingsOf osoba a předci v pohledu s rodiči v pohledu; maxGeneration), bulkParents, bulkNewIds (drawnPersonIds, kroky 1–5 pipeline), BULK_CONFIRM_ABOVE 150, BULK_TWO_GENERATIONS 2 · src/renderer.ts bulkFamilyPlan (jen family), bulkFamilyState (offer/on/none), bulkFamilyScreens (ceil šířka × zoom / plátno), showBulkFamily → showChildrenOf (jeden krok historie, zoom beze změny, kotva), undoBulkFamily, bulkStepOf (jen při stejné hloubce), forgetBulkSteps při změně hloubky, resetChildrenShown při změně fokusu, pohledu, stromu, hiddenShownCount (+1 za krok) · src/ui/bulk-family-ui.ts confirmBulkFamily (Esc, klik vedle, resize = zrušit; two jen m > 0 a m ≠ n), runBulkFamily, updateBulkFamilySwitches (title treeTip/menuOff/treeNone, aria-disabled) · src/ui/context-menu.ts bulkFamilyRows (offer: menu, +n, menuSub; on: menuOff) · src/ui/toolbar-fit.ts (tablet: přepínač ustoupí před hledáním, f5d56ed3) · index.html button.bulk-family (telefon skrytý) · strings.ts bulk.*, menu.showChildrenHere, showSiblingsHere, focusBar hideAllShown, history back · app 2eb013ba, cecea43f, 8dc34565, f5d56ed3 · dirigent:prace/1113-app-drobnosti-1112 · ZADANI_DEV_drobnosti-1112 §3 -->

<a id="A6.1.4"></a>
### A6.1.4 Fotka na kartě

Volba **Fotka na kartě** určuje velikost a tvar fotky osoby na kartě ve stromu. Výchozí **Malá** a **Kruh** nechávají
kartu jako dřív.

| | **Malá** | **Střední** | **Velká** |
|---|---|---|---|
| karta **Normální** | 188 × 64 px | 200 × 64 px | 236 × 96 px |
| fotka na kartě **Normální** | 34 px | 48 px | 80 px |
| fotka v hlavičce karty **Podrobná**, **Matriční**, **Vlastní** | 30 px | 44 px | 72 px |

- Větší karta je jen v pohledu, kde aspoň jedna zobrazená osoba fotku má. Karty bez fotky v tom pohledu jsou stejně
  široké, s malými iniciálami, a jména v řadě stojí ve stejné výšce. Pohled bez fotek má karty 188 × 64 px.
- Karta **Normální** má fotku vedle jména. **Podrobná**, **Matriční** a **Vlastní** ji mají v hlavičce vedle jména
  a let, řádky údajů pod ní v plné šířce; karta je o fotku vyšší (**Vlastní** 70 nebo 98 px a 17 px na řádek místo
  56 px).
- **Od aplikace 3.30.0:** zvolená velikost platí pro každou kartu s avatarem, s fotkou i bez ní. Iniciály karty bez fotky
  mají velikost a tvar fotky (**Normální** 48 nebo 80 px, v hlavičce karty 44 nebo 72 px) a písmo úměrné (17 a 29 px,
  v hlavičce 16 a 26 px). Pohled má větší karty, kdykoli v něm je aspoň jedna karta s avatarem (dřív jen s fotkou);
  zástupná osoba avatar nemá. Export obrázku, plakát i jeho PDF kreslí iniciály stejně. **Malá** vypadá jako dosud. Věta pod volbou:
  „Osoby bez fotky mají iniciály ve stejné velikosti. Platí pro strom, export obrázku a plakát na tomto zařízení.“
- **Tvar:** **Kruh** nebo **Zaoblený čtverec** (zaoblení 12 px u velké fotky, 5 px u malé; stejně i iniciály).
  Značky karty stojí na okraji fotky v obou tvarech.
- **Export:** export obrázku, plakát i jeho PDF po listech ([A7](A7-book-pages-and-export.md)) kreslí karty se
  zvolenou velikostí a tvarem fotky jako obrazovka: **Normální** karta má rozměr jako na obrazovce, **Podrobná**
  a **Matriční** mají fotku vlevo v hlavičce. Skrytá fotka žijící osoby nechá na kartě iniciály. Výstup, ve kterém
  nikdo fotku nemá, a výchozí **Malá** s **Kruh** vypadají jako dosud. Věta pod volbou: „Platí pro strom, export
  obrázku a plakát na tomto zařízení.“
- **Hranice:** karta **Kompaktní** fotku nemá: řádek zůstane, volby jsou vypnuté a pod nimi stojí „Kompaktní karta
  fotku nemá.“; zvolená velikost se drží. Volba patří zařízení, se stromem se neukládá. Náhled v nastavení ukazuje
  rozměr karty („karta 236 × 96 px“).
- **Ovládání:** **Nastavení** → **Karta osoby** → **Fotka na kartě** (mezi **Detail karet** a náhledem):
  **Velikost** **Malá** · **Střední** · **Velká**; **Tvar** **Kruh** · **Zaoblený čtverec**.
- **Platí od:** aplikace 3.29.0; 3.30.0: iniciály ve velikosti fotky

<!-- zdroj: app:28480ea1 src/types.ts NORMAL_PHOTO_BOX (188×64/34, 200×64/48, 236×96/80), src/settings.ts (zařízení, výchozí small + circle), src/ui/card-fields-ui.ts, src/renderer.ts · b71d561a src/card-width.ts cardAvatarSize (30/44/72), výška Vlastní 70/98 + 17 na řádek · strings.ts cardDensity.photoTitle, photoSize, photoSmall, photoMedium, photoLarge, photoShape, photoCircle, photoRounded, photoCompact, size · CHANGELOG.cs.md 3.29.0 „Fotka na kartě“ · dirigent:test/vysledek-1115-app-096-fotka.md · spec 096 P1 · export: app:64ae50ca src/export-image.ts, src/renderer.ts (poster, PDF po listech; výchozí small + circle bajt po bajtu jako dřív), strings.ts cardDensity.photoScope · spec 096 P2 · 3.30.0: app:0bed2a88 src/types.ts NORMAL_PHOTO_BOX (avatar = fotka i iniciály), src/renderer.ts viewHasAvatar (dřív viewHasPhoto), src/card-width.ts normalCardTextWidth (126 px u každého avataru), avatarInitialsSize (avatar × 0,36: 17/29, 16/26), src/export-image.ts getPosterCardPhoto (každá karta s avatarem), strings.ts cardDensity.photoScope · e2e/card-photo.spec.ts, poster-card-photo.spec.ts · CHANGELOG.cs.md 3.30.0 „Fotka na kartě“ · spec 103 K2.1–K2.3 · dirigent:test/vysledek-1116-app-103-tabulka.md -->

<a id="A6.1.5"></a>
### A6.1.5 Značení linií

Značení linií označí karty ve stromu podle toho, do které linie osoba patří vůči ústřední osobě (v nastavení
„zaměřená osoba“): **otcovská**, **mateřská**, **potomci**. Výchozí je **Oblouček** na levé hraně karty.

| Volba | Jak značka vypadá | Druhý znak kromě barvy |
|---|---|---|
| **Oblouček** (výchozí) | pruh po levé hraně karty | žádný |
| **Štítek s písmenem** | štítek přes levou hranu karty | písmeno: O otcovská, M mateřská, P potomci |
| **Proužek** | svislý proužek u levé hrany | otcovská plný, mateřská čárkovaný, potomci tečkovaný |
| **Roh** | trojúhelník v levém horním rohu | otcovská plný, mateřská šrafovaný, potomci obrysový |
| **Bez tvaru** | bez značky; se zapnutým podbarvením značí linii jen podklad karty | – |

- **Barvy:** otcovská modrá, mateřská růžová, potomci okrová. Jedna pevná paleta, bez volby. Barvy se liší i světlostí
  (otcovská tmavá, potomci střední, mateřská světlá), takže se rozliší i při slabším barvocitu a v šedi. Tmavý vzhled
  má vlastní odstíny; jeho podbarvení mají světlost karty a liší se odstínem, takže se tři linie a podbarvená karta
  od nepodbarvené rozliší i bez tvaru. Text karty má na každém podbarvení kontrast aspoň 4,5:1.
- **Podbarvit karty barvou linie** (výchozí vypnuto) jemně podbarví kartu barvou linie. Je to samostatný přepínač,
  platí s každým tvarem i s **Bez tvaru**:
  - tvar s podbarvením: značka i podklad;
  - **Bez tvaru** s podbarvením: kartu značí jen podklad;
  - **Bez tvaru** bez podbarvení: karty linii neznačí vůbec.
- **Kdo značku má:**
  - otcovská a mateřská linie: rodič, všichni jeho předci a sourozenci každého z nich (tety, strýcové, prastrýcové…);
  - potomci: všichni potomci ústřední osoby;
  - bez značky jsou ústřední osoba, partneři (i partneři potomků a nevlastní rodiče), sourozenci ústřední osoby,
    bratranci a sestřenice a zástupné osoby (prázdné místo pro neznámého rodiče).
- **Osoba v obou liniích** (například předek ze sňatku příbuzných) má obě značky: **Oblouček**, **Proužek** a **Roh**
  rozdělené na otcovskou a mateřskou půlku, **Štítek s písmenem** dva štítky nad sebou. Do 3.29.0 dostala jen
  otcovskou.
- **Rodiče stejného pohlaví** (oba rodiče ústřední osoby známí, oba muži nebo obě ženy): linie se jmenují
  **Linie 1. rodiče** a **Linie 2. rodiče**, štítek nese 1 a 2, barvy zůstávají.
- **Legenda stromu** (pohledy Rodina a Potomci, nastavení **Legenda stromu**): prstence pohlaví, vzorek každé linie ve
  zvoleném tvaru s názvem a řádek „Bez značky: zaměřená osoba, partneři, sourozenci, bratranci“. Při **Bez tvaru**
  s podbarvením jsou vzorky čtverečky podbarvení orámované barvou linie (stejně v Nastavení), bez podbarvení část
  o liniích chybí. Sbalení legendy: [A9.6](A9-using-the-app.md#A9.6).
- **Čtečka obrazovky** čte u karty linii slovy („otcovská linie“, „otcovská i mateřská linie“, „potomek“,
  „linie 1. rodiče“).
- **Stejné značení jinde:** Časová osa má znak linie před jménem ([A6.3](#A6.3)), Tabulka sloupec **Linie**
  ([A6.7.2](#A6.7.2)); Vějíř v barvách **Linie** ([A6.4](#A6.4)) a cesta předků na Mapě ([A6.5.5](#A6.5.5)) mají
  stejné odstíny. Při **Bez tvaru** Časová osa ani Tabulka znak nemají.
- **Export a tisk:** export obrázku a plakát kreslí zvolený tvar i podbarvení, vždy ve světlých barvách. V tisku
  z prohlížeče mají všechny karty stejný šedý rámeček; pohlaví ukazuje prstenec u fotky nebo iniciál, linii značka.
  Značka se tiskne i bez tisku pozadí, podbarvení se netiskne (**Bez tvaru** s podbarvením tisk neoznačí).
- **Hranice:** značka je jen vrstva na okraji karty, rozměr ani obsah karty nemění. Linie se počítá znovu při každé
  změně ústřední osoby. Volba patří zařízení, se stromem se neukládá.
- **Ovládání:** **Nastavení** → **Zobrazení stromu** → **Značení linií**: **Oblouček** · **Štítek s písmenem** ·
  **Proužek** · **Roh** · **Bez tvaru**; pod tím **Podbarvit karty barvou linie**. Každá volba má náhled karty.
- **Platí od:** barvy větví aplikace 1.8.0 (oranžová, modrá a zelená); 3.30.0: **Značení linií** místo přepínače
  **Barvy větví**, nové barvy, tvary, podbarvení, obě značky, linie 1. a 2. rodiče. Zapnuté **Barvy větví** se
  převezmou jako **Oblouček**, vypnuté jako **Bez tvaru** bez podbarvení.

<!-- zdroj: app:0e403ec6 src/branch-colors.ts classifyBranches (collectAncestorSide: předci + sourozenci každého předka; collectDescendants přes childIds; obě strany se sčítají R4; descendant jen mimo strany; focus smazán; numbered = oba rodiče známí a stejného pohlaví R5), src/settings.ts getBranchMarker (výchozí arc; branchColors false → off), isBranchTintOn (jen se značkou), isBranchTintChosen, save (migrace při prvním zápisu), src/renderer.ts renderCards (!isPlaceholder, viewMode ≠ timeline), src/branch-marker-attrs.ts (čtečka ariaPaternal/ariaBoth/ariaSlot1), index.html tokeny --branch-paternal #234e8c / --branch-maternal #d0679a / --branch-descendant #8a6400, tmavé #9cc2f2 / #f6a9cb / #e3b552, --branch-*-tint, CSS tvarů (arc, tag, stripe, corner; R4 .branch-paternal.branch-maternal) · app:c8afe382 index.html #branch-marker-setting (skupina settings.groupTree), #branch-tint-toggle, src/ui/branch-marker-ui.ts syncBranchLegend, src/ui/misc.ts (legenda jen family/descendants, isBranchLegendEnabled) · app:b94f3816 src/branch-marker-svg.ts, src/ui/export-image-ui.ts treeCardDrawing (branchMarker, branchTint, numbered; světlé hex), index.html @media print (R6: border 2px #999, white background, tiskové --branch-*, print-color-adjust) · strings.ts branchColors.* (settingLabel, markerArc…markerOff, defaultTag, tintLabel, legendPaternal…legendSlot2, legendNone, letterPaternal O, letterMaternal M, letterDescendant P) · barvy větví: app:6f86ad39 (v1.8.0) · CHANGELOG.cs.md 3.30.0 „Značení linií“ · dirigent:spec/112-znaceni-linii K1–K4, app:docs/ZADANI_DEV_linie-na-kartach.md R1–R6 · prace/1119-app-112-linie · Bez tvaru: app:999c373f src/types.ts BRANCH_MARKERS (none), src/settings.ts getBranchMarker (uložené off → none; branchColors false → none), isBranchTintOn (samostatně), isBranchMarkingOn, src/ui/branch-marker-ui.ts syncBranchLegend (none jen s podbarvením), src/branch-marker-attrs.ts, src/export-image.ts buildTreeSvg (none + tint = výplň karty), strings.ts branchColors.markerNone, tintHint · app:34aca82c index.html tmavé --branch-*-tint #172a41 / #3b1e2c / #372600 (světlost karty), světlé --text-faint #6a6254, .branch-swatch[data-shape="none"] rámeček var(--sw), src/__tests__/branch-tint-contrast.test.ts (4,5:1) · test/vysledek-1119-app-112-podbarveni -->

<a id="A6.1.6"></a>
### A6.1.6 Zpět na výchozí osobu: ⌂

Tlačítko ⌂ na začátku **Zaměřeno na** zaměří výchozí osobu stromu ([A6.1.1](#A6.1.1)), ať je střed kdekoli. Udělá
totéž co **Zaměřit** u karty: nový krok historie a oznámení „Zaměřeno na {jméno} · ↩ Zpět“; **↩ Zpět**, šipka ↩
vlevo dole nebo Alt+← vrátí předchozí střed.

| Nastavení stromu (**Výchozí osoba a pohled**) | Koho ⌂ zaměří |
|---|---|
| **Konkrétní osoba:** | tu osobu; když už ve stromu není, první osobu stromu |
| **Naposledy zobrazená** | osobu, na kterou se strom zaměřil při otevření (nebo při přepnutí na tento strom) |
| bez nastavení | první osobu stromu |

- **Kde ⌂ je:**
  - Rodina: v **Zaměřeno na** na počítači, v liště na tabletu a na telefonu na šířku, v panelu osoby na telefonu;
  - Potomci: na začátku odznaku pohledu;
  - Vějíř: vlevo nahoře; u zafixovaného středu ([S4.1.3](S4-research-from-the-app.md#S4.1.3)) před **Střed: {jméno} ·
    Uvolnit** a zafixování nejdřív uvolní.
- **Výchozí osoba už je středem:** ⌂ zůstane na místě, vyplněný a ztlumený, s bublinou „Výchozí osoba je zaměřená:
  {jméno}“. Klik ani klávesa nic neudělají.
- **Bublina:** „Zaměřit výchozí osobu: {jméno}“, u první osoby stromu s dovětkem „– první osoba stromu“, u
  **Naposledy zobrazená** „– zaměřená při otevření“, a „(H)“.
- **Klávesy:** H (mimo textové pole a otevřenou nabídku); navíc ⌘1 na Macu a Ctrl+1 ve Windows a Linuxu, když je
  prohlížeč aplikaci předá. V kartě prohlížeče je prohlížeč obvykle použije sám pro přepnutí na první kartu.
  Přehled kláves: [A9.8](A9-using-the-app.md#A9.8).
- **Při sledování výzkumu** se ⌂ i H chovají jako jiný výběr osoby: sledování agenta v hlavním okně přeruší
  (**Zpět k agentovi**, [S4.1.1](S4-research-from-the-app.md#S4.1.1)). Když je výchozí osoba už středem, nepřeruší.
- **Hranice:** prázdný strom ⌂ nemá. Mapa, Časová osa, Tabulka a další okna ([A6.8](#A6.8)) ⌂ nemají a H v nich nic
  nedělá.
- **Ovládání:** ⌂ u **Zaměřeno na** (Potomci: v odznaku, Vějíř: vlevo nahoře); klávesa H.
- **Platí od:** aplikace 3.30.0

<!-- zdroj: app:e52adde6 src/default-person.ts defaultTarget (specific, first, opened, fallbackFirst; prázdný strom null), startupPerson · src/ui/default-focus.ts FALLBACK_TO_FIRST = true, rememberOpenedFocus, isAtDefault (Vějíř: liveFollowPinned ?? focus), isDefaultFocusContext (hlavní okno, HOME_VIEWS family/descendants/fan), focusDefaultPerson (unpinFanCenter, TreeRenderer.focusFromTab → showFocusToast) · app:b6df0770 §3 telefon (panel osoby), §6 defaultFocusKey (H/h bez Ctrl/⌘/Alt mimo pole; ⌘1 / Ctrl+1 podle code Digit1 i z pole), src/ui/misc.ts defaultFocusKeyHeld, §7 Potomci (#descendants-badge), Vějíř (pilulka vlevo nahoře, pin), §9 pauza sledování · strings.ts focus.focusedOn, focusHome, focusHomeFirst, focusHomeOpened, focusHomeAt, focusToast, focusToastBack · CHANGELOG.cs.md 3.30.0 „Zpět na výchozí osobu“ · dirigent:spec/111 K1.1–K1.6 · app:docs/ZADANI_DEV_vychozi-osoba.md §1–§9 · ⌘1 / Ctrl+1 v kartě prohlížeče neměřeno (spec 111 Otevřené) -->

<a id="A6.2"></a>
## A6.2 Pohled Potomci

Pohled Potomci ukazuje jen ústřední osobu a její potomky do hloubky Potomci: bez předků, tet, strýců
a bratranců.

- **Jen pokrevní** (výchozí): pokrevní potomci ústřední osoby.
- **Úplné rodiny**: navíc další svazky partnerů a jejich nevlastní děti, znevýrazněně.
- **Ovládání:** přepínač v liště pohledu; výchozí volbu drží nastavení **Pohled Potomci**.
- **Platí od:** pohled aplikace 1.4.0; Úplné rodiny aplikace 1.9.2

<!-- zdroj: app:src/layout/pipeline/index.ts includeAuntsUncles: !descendantsOnly, expandLineageOnly: descendantsOnly && !isDescendantsFullFamilies() · strings.ts viewModeSwitch.bloodOnly, viewModeSwitch.fullFamilies, viewModeSwitch.settingLabel · settings descendantsFullFamilies (výchozí false) -->

<a id="A6.3"></a>
## A6.3 Časová osa

Časová osa ukazuje osoby pohledu jako pruhy života na ose let.

- Řádek dostane jen osoba s rokem narození. Ostatní pohled spočítá a napíše „N osoby bez roku narození nejsou
  zobrazeny“. Zástupné osoby (prázdné místo pro neznámého rodiče) se vynechávají.
- Pořadí řádků: rok narození, pak jméno bez titulů.
- Pruh žijící osoby sahá do dneška. Zemřelá osoba bez data úmrtí má pruh do poslední známé události a otevřený
  konec.
- Rok sňatku se bere z data začátku svazku. Osa je zaokrouhlená na desetiletí.
- Pod osou let běží řádek dějin ústřední osoby (události doby a míst jejího života, symboly druhů). Bez výzkumu
  nebo bez takových událostí řádek není.
- **Platí od:** časová osa aplikace 1.5.0; řádek dějin aplikace 3.19.0
- **Od aplikace 3.30.0:** se zapnutým **Značením linií** ([A6.1.5](#A6.1.5)) stojí před jménem osoby znak linie ve
  zvoleném tvaru (osoba v obou liniích dva znaky, u rodičů stejného pohlaví 1 a 2); najetí na znak řekne linii
  slovy. Pruh života má dál barvu pohlaví a nepodbarvuje se. Plakát časové osy kreslí znak stejně.
  Při **Bez tvaru** znak není.

<!-- zdroj: app:src/timeline.ts computeTimelineModel, :59 TimelineHistory · strings.ts timeline.omitted · CHANGELOG.cs.md 3.19.0 -->
<!-- zdroj: app:cecd72a4 src/renderer.ts timelineBranchSigns (znak legendy před jménem, title linie slovy, dvě značky R4, číslice R5; plakát SVG) · CHANGELOG.cs.md 3.30.0 „Značení linií“ · dirigent:spec/112-znaceni-linii -->

<a id="A6.4"></a>
## A6.4 Vějíř

Vějíř ukazuje předky ústřední osoby v kruhových výsečích, generaci po generaci.

- **Tvar:** **Půlkruh** · **Celý kruh** · **Oboustranný** (předci i potomci).
- **Generace** předků 3–10, výchozí 5. V tvaru Oboustranný **Potomci** 1–5, výchozí 3.
- Číslování předků: 1 je ústřední osoba, otec osoby n má číslo 2n, matka 2n+1. Otcova linie je vlevo.
  Čísla u výsečí zapíná nastavení **Vějíř** „Zobrazit Kekulého (ahnentafel) čísla předků“ (výchozí vypnuto).
- Rodiče jsou první dva zapsaní rodiče osoby. Vztah, který není biologický (adopce, nevlastní, pěstoun), je
  u výseče označený.
- Předek, který se ve vějíři objeví podruhé, se nakreslí znovu, ale dál se nerozvíjí; legenda **↻ opakuje se
  (implex)**. Volba **Ukázat první výskyt** skočí na jeho první místo.
- Potomci (tvar Oboustranný): svazky v pořadí sňatků (datum sňatku, pak pořadí v datech), děti podle narození.
  Neznámý partner sbírá děti bez druhého rodiče. Svazek bez dětí je vidět jen u ústřední osoby.
- **Barvy:** **Pohlaví** · **Linie** (čtyři linie prarodičů: otcův otec, otcova matka, matčin otec, matčina matka) ·
  **Rody** ([A4](A4-surnames-and-families.md)).
  - **Od aplikace 3.30.0:** **Linie** v barvách **Značení linií** ([A6.1.5](#A6.1.5)): otcova strana modrá (otcův
    otec modrý, otcova matka modrozelená), matčina růžová (matčin otec růžový, matčina matka malinová), rodiče
    v jemném odstínu své strany, potomci v tvaru Oboustranný okroví. Do 3.29.0 jiné odstíny.
  - **Od aplikace 3.30.0:** **Rody** barví podle strany vějíře, s legendou po stranách a zvýrazněním rodu
    ([A6.4.1](#A6.4.1)).
- **Původní osoba** vrátí vějíř na osobu, ze které se vyšlo.
- **Platí od:** vějíř aplikace 1.8.0; nový vějíř s tvary, barvami a implexem aplikace 3.20.0
- **Od aplikace 3.27.0:** svazek bez data sňatku se řadí podle nejpozdějšího možného data sňatku: dřívějšího z konce
  svazku (rozvodu) a narození prvního dítěte svazku. Sňatek „před 1982“ jde před sňatek v roce 1982. Svazek bez
  těchto dat jde za ostatní. Stejné pořadí mají partneři vedle osoby a značky pořadí manželství („1. ∞“) na kartách.

<!-- zdroj: app:src/fan-chart.ts FAN_MIN_GENERATIONS, FAN_MAX_GENERATIONS, FAN_DEFAULT_GENERATIONS, parentSlots, repeatOf · strings.ts fan.shapeHalf, fan.shapeFull, fan.shapeTwo, fan.colorGender, fan.colorLine, fan.colorRod, fan.legendRepeats, fan.originPerson, fan.showFirst, fanChart.kekuleHint · settings fanKekule (výchozí false) · spec 029 · CHANGELOG.cs.md 3.20.0 · 3.30.0: app:cecd72a4 src/fan-colors.ts LINE_HUE [258, 232, 352, 5], PARENT_LINE_HUE, DESCENDANT_LINE_HUE 82, parentLineColor, descLineColor (dřív 50/95/215/320, rodiče 70/250, potomci 150) · 3.27.0: app:ad1ca16c src/marriage-order.ts marriageKey (BOUND 0.5, qualifier „<“; bez sňatku min(endDate, narození dětí)), marriageDates, compareMarriages, marriagesInOrder (partneři vedle osoby, značka „1. ∞“) · src/fan-chart.ts familiesOf · CHANGELOG.cs.md 3.27.0 · dirigent:prace/1109-app-tester-vlna1 (T50, T13) -->

<a id="A6.4.1"></a>
### A6.4.1 Barvy rodů a zvýraznění rodu

V barvách **Rody** má každý rod ve vějíři svou barvu a barva říká, na které straně vějíře rod je: otcova strana
studené odstíny modré a zelené, matčina teplé růžové a oranžové, potomci (tvar Oboustranný) okrové.

- **Strana rodu:** rod ústřední osoby patří na otcovu stranu. Rod, který je ve vějíři jen mezi potomky, patří
  k potomkům. Ostatní rody patří na stranu, kde jsou nejblíž středu (v nejnižším prstenci); při shodě na otcovu.
- **Pořadí rodů:** podle počtu výsečí ve vějíři (opakovaná osoba se počítá pokaždé), pak podle velikosti ve stromu.
  Prvních deset rodů s aspoň dvěma výsečemi a rod ústřední osoby má sytý odstín, ostatní tlumený.
- **Šedá** jsou jen osoby bez rodu, neznámí (?) a prázdná místa (+). Každý rod ve vějíři má barvu.
- **Sousedé:** když odstíny strany dojdou, opakují se, ale nikdy na sousedních výsečích (vedle sebe, přes generaci,
  ani přes šev celého kruhu) a nově přidělený odstín ani o jednu výseč dál. Odstín jiné strany si rod vezme, jen
  když žádný vlastní není dost odlišný.
- **Paměť barev:** okno si pamatuje odstín každého rodu, i rodu, který právě není vidět. Při přecentrování a po
  návratu na dřívější střed mají rody stejné barvy. Zapamatovaný odstín ustoupí jen sousedovi se stejným odstínem,
  takže se po návratu může stejný odstín objevit o jednu výseč dál. Nový rod dostane nejdřív odstín, který si
  žádný rod nepamatuje. Paměť zmizí po odchodu z pohledu nebo ze stromu; další okno ([A6.8](#A6.8)) ji převezme
  z hlavního okna.
- **Legenda:** skupiny **Otcova strana**, **Matčina strana** a **Potomci**; v každé nejdřív rod ústřední osoby
  („· střed“), pak rody podle počtu osob ve vějíři („7×“). V hlavní části je nejvýš dvacet rodů s aspoň dvěma
  výsečemi a rod ústřední osoby.
  - **Ostatní · N rodů** sbalí menší rody do jednoho řádku s dvoubarevným vzorkem a počtem osob (osoby bez rodu
    se počítají sem). Rozbalené ukáže menší rody v jejich barvách, podle počtu a jména. Rozbalení se pamatuje
    na zařízení.
  - **bez rodu** je uvnitř **Ostatní**, a když **Ostatní** chybí, samostatný řádek.
  - Řádky jsou tlačítka v jedné zastávce klávesy Tab (šipky, Home, End). Najetí myší na řádek rod náhledově
    zvýrazní.
- **Zvýraznění rodu:** klik na řádek legendy nebo **Zvýraznit rod {rod}** v nabídce výseče zvýrazní rod stromu
  ([A6.6](#A6.6)), stejně jako v pohledu Rodina. Výseče rodu mají přerušovaný obrys, ostatní jsou potlačené.
  Zvýraznění zůstane při přecentrování. Zruší ho druhý klik, **Zrušit zvýraznění rodu**, × u štítku nebo Esc.
  Vějíř se při přizpůsobení vyhne pásu se štítkem zvýraznění; přiblížený pohled zůstane, jak je.
- **Telefon:** ťuknutí na řádek v listu legendy rod zvýrazní (nebo zruší) a list zavře. Čip barev pak místo teček
  ukazuje vzorek a jméno rodu. **Tablet:** řádky legendy mají velikost ovládacího prvku.
- **Obrázek, plakát a tisk:** zvýraznění se přenese (přerušovaný obrys, ostatní výplně světlejší), podtitul uvádí
  „zvýrazněn rod {rod}“, když je některá osoba rodu nakreslená. Legenda plakátu je po stranách, zvýrazněný rod
  tučně a podtržený. Štítky zvýraznění se netisknou.
- **Hranice:** vějíř na stránce osoby má jen barvy pohlaví.
- **Ovládání:** **Barvy** › **Rody**; řádky legendy; v nabídce výseče **Zvýraznit rod {rod}** / **Zrušit zvýraznění
  rodu**; × u štítku; Esc.
- **Platí od:** aplikace 3.30.0 (barvy **Rody** od aplikace 3.20.0; do 3.29.0 barevně jen deset největších rodů,
  ostatní šedě)

<!-- zdroj: app:src/fan-rod-assign.ts (strany P/M/D: rod středu P, jen potomci D, jinak nejnižší prstenec, shoda P; pořadí počet výsečí › velikost › id; FAN_ROD_MAX_STRONG 10, FAN_ROD_LEGEND_MAIN 20, tier S/T; opakování odstínů ne na sousedních výsečích ani o jednu dál, výpůjčka jiné strany) · src/fan-colors.ts paleta P/M/D světlá, tmavá, tisk, fanRodLegend, fanRodOtherSwatch (K1.7), legendOther, legendNoRod · src/ui/fan-view.ts legenda (FAN_STORAGE_KEYS.legendOtherOpen, náhled jen při (hover: hover)), setRodSelection(…, 'legend'), forgetRodColors · strings.ts fan.legendFatherSide, legendMotherSide, legendDescendants, legendOther, legendNoRod, legendCentre, colorsChipRod, menuHighlightRod, menuUnhighlightRod, posterHighlighted · app:1d9dad0f, 7231dd13 (legenda po stranách), 77282e4e (telefon, tablet), b31c74a9 (štítky se netisknou), defe20a6, 7821ea72 (vějíř mimo štítek), 1ad91795 (paleta P/M/D), a265a3cc (paměť barev při návratu, další okna) · dirigent:spec/114-vejir-barvy-rodu · test/vysledek-1119-app-vejir-rody, vysledek-1119-app-vejir-barvy-vse · CHANGELOG.cs.md 3.30.0 -->

<a id="A6.5"></a>
## A6.5 Mapa

Mapa ukazuje místa událostí osob.

- **Rozsah:** **Tento pohled** (výchozí, osoby pohledu) · **Celý strom**.
- **Druhy:** **Narození** · **Úmrtí** · **Sňatky** · **Ostatní události**. Výchozí jsou zapnuté všechny; volba
  se pamatuje na zařízení.
  - Křest se počítá k narození, pohřeb a kremace k úmrtí.
  - Zasnoubení, ohlášky, povolení ke sňatku a svatební smlouvy se počítají ke sňatku. Ostatní události páru jsou
    Ostatní události.
- Místo sňatku se ukáže, když je v pohledu aspoň jeden z partnerů.
- Místo se píše v nejčastějším zápisu. Obec je jeden bod i s čísly domů; místo s vlastními přesnými souřadnicemi
  zůstává samostatným bodem.
- **Migrace v čase** ukáže místa podle let a cestu předků k jedné osobě ([A6.5.3](#A6.5.3)).
- **Platí od:** mapa aplikace 1.10.0; druhy událostí a body obcí aplikace 3.21.0

<!-- zdroj: app:src/places.ts collectPlaces, groupTownPoints · src/ui/map-ui.ts (localStorage strom.map.kinds) · strings.ts map.scopeView, map.scopeTree, map.kinds · CHANGELOG.cs.md 3.21.0 -->

<a id="A6.5.1"></a>
### A6.5.1 Odkud mapa bere polohu místa

Ve vlastním stromu (bez výzkumu) dohledá polohu míst aplikace sama, ve službě OpenStreetMap (Nominatim). Pošle jen
název místa, jak je zapsaný ve stromu, a jen se souhlasem. Ve stromu z výzkumu ztotožňuje místa výzkum
([R4](R4-places.md)).

- **Hranice:**
  - před prvním dohledáním se aplikace zeptá (**Dohledat souřadnice online?**). Odejdou jen názvy míst, žádná jména,
    data ani vztahy. Nejvýš jeden dotaz zhruba za sekundu;
  - souřadnice se uloží do stromu: každé místo se dohledá jednou a mapa pak funguje i bez připojení;
  - automatické dohledání vezme **první výsledek** služby pro zapsaný název. Do aplikace 3.23.0 při tom stejnojmenné
    obce nerozlišilo: místo tak mohlo padnout do obce stejného jména jinde. Polohu, která do stromu nesedí, označí
    **Ověřit** ([R4.4.1](R4-places.md#R4.4.1));
  - jen místo s číslem domu, které služba nenašla, se dohledá podle obce. Z obcí toho jména se vybere ta nejblíž
    ostatním místům stromu („Obec toho jména je víckrát; vybrána ta nejblíž ostatním místům stromu.“); u místa stojí
    **Poloha podle obce**;
  - **od aplikace 3.24.0** se nejbližší obec vybírá u každého místa: když se dvě a víc obcí jmenují přesně jako
    zapsané místo (bez ohledu na velikost písmen a diakritiku), vezme se ta nejbližší středu stromu, ne první
    výsledek. Střed je medián poloh zadaných ručně nebo potvrzených **Ponechat**, když jsou aspoň 3; jinak medián
    všech poloh stromu a míst, která dohledání našlo bez pochyb. Místo s dalším určením („Lhota u Kolína“,
    „Lhota 16“), jediná obec nebo strom bez poloh dostane první výsledek jako dřív. Pořád jde o jeden dotaz na místo;
  - kontrola místa řekne, kolik obcí toho jména mapa našla („Mapa našla 3 obce toho jména a vzala tu nejbližší
    ostatním místům stromu.“); od aplikace 3.24.0, dřív vždy „dvě“;
  - poloha, která už ve stromu je, se nepřesune: dohledání hledá jen místa bez polohy. Ani sloučení s jiným stromem
    nebo souborem GEDCOM nepřepíše polohu zadanou ručně nebo potvrzenou **Ponechat**, jen doplní chybějící. Špatnou
    starší polohu jde přesunout jen ručně;
  - co se nenajde, zůstane bez polohy. Aplikace nic nehádá: „pomůže opravit zápis nebo doplnit zemi“.
- **Ovládání:** aplikace: **Nastavení → Dohledávat místa online**; v okně míst **Špatné místo? Opravit**, **Najít toto
  místo pod jiným názvem** (připojí se jen poloha, zápis ve stromu se nemění), **Použít i pro další čísla domů v …**,
  **Vyčistit osiřelá místa (n)**.
- **Proč:** dohledání míst je jediná část aplikace, která něco posílá ven; proto jen se souhlasem, jen názvy a každé
  místo jednou (komentář v kódu). Limit jednoho dotazu za sekundu je podmínka služby.
- **Platí od:** aplikace 1.10.0; **Špatné místo? Opravit** 1.10.1; **Vyčistit osiřelá místa** 2.1.0; poloha podle obce
  3.21.0; nejbližší stejnojmenná obec u každého místa a počet obcí v kontrole 3.24.0

<!-- zdroj: app:src/geocode.ts hlavička, REQUEST_INTERVAL_MS=1100, geocodePlace (limit 1, parseGeocodeResponse první výsledek), geocodeTown/pickTownHit nearestTo (od v3.21.0), geocodePlaces townFallback · app:src/strings.ts map.consentTitle, consentBody, settingLabel, wrongSpot (v1.10.1), searchLabel, attachOnly, useForOthers, cleanOrphans (v2.1.0), nearestTown, byTown, doneWithMisses · FB podnět 2026-11-04 (stejnojmenná obec) · od 3.24.0: geocode.ts treeCenter (medián, PERSONS_CENTER_MIN=3), sameNamedTowns, pickPlaceHit (townChoices), buildGeocodeUrl limit · place-check.ts multi count · strings.ts checkMulti(n) · merge-executor test (ruční poloha zůstane) · commit 046967d -->

<a id="A6.5.2"></a>
### A6.5.2 Místa mimo mapu dohledat ve výzkumu

U stromu s výzkumem nabízí stavový pruh mapy místa bez polohy k dohledání ve výzkumu ([R4.4](R4-places.md#R4.4)).
Tlačítko otevře okno **Místa** s náhledem; do fronty výzkumu jdou místa až po **Zařadit**.

- **Hranice:**
  - před dohledáním mapou stojí v pruhu vedle dohledání mapou **Ve výzkumu**. Po dohledání, když mapa některá místa
    nenašla, pruh ukáže „N míst na mapě · K mapa nenašla“ a **Dohledat ve výzkumu (K)**, případně „N k potvrzení ›“
    (otevře **Čeká** v panelu výzkumu);
  - tlačítko je jen u stromu s výzkumem a jen když je co dohledat: místo bez polohy nebo neztotožněné, které ještě
    není ve frontě, nepracuje se na něm a nečeká na odpověď;
  - okno **Místa** ukáže náhled „Dohledat ve výzkumu N míst mimo mapu“. Před **Zařadit N míst** se nic nezařadí
    a žádné místo se nezařadí dvakrát;
  - když výzkum běží na jiném počítači, nebo jde o telefon, aplikace místo okna řekne, kde dohledání jde: „Dohledat
    a prověřit jde ve výzkumu na počítači, kde běží. Stav míst se sem přenáší se stromem.“, na telefonu „Dohledat
    a prověřit jde na počítači s výzkumem. Na otázky k místům jde odpovědět i odsud, v Čeká.“ Starší výzkum: „Tato
    verze výzkumu místa ještě nedohledává.“;
  - při sledování výzkumu na mapě ([S4.1.3](S4-research-from-the-app.md#S4.1.3)) řádek „… – bez polohy na
    mapě“ nabízí **Dohledat ve výzkumu**: zařadí to jedno místo hned, bez náhledu; zařazení jde vrátit
    v oznámení.
- **Ovládání:** aplikace: mapa → stavový pruh → **Ve výzkumu**, po dohledání mapou **Dohledat ve výzkumu (K)** →
  okno **Místa** → **Zařadit N míst**.
- **Platí od:** aplikace 3.25.0

<!-- zdroj: app:src/ui/map-ui.ts (stavový pruh, lookResearch, lookable), src/ui/place-actions.ts, src/ui/places-research-ui.ts (bulkLook, bulkLookHead, bulkLookGo, nic dvakrát), src/ui/map-follow-ui.ts (noCoords + places.research.look, Undo) · strings.ts map.onMap.notFound, lookResearch, lookResearchShort, lookResearchTitle, confirm; places.dialog.elsewhere, phoneLine, oldResearch · CHANGELOG.cs.md 3.25.0 · commit 2246ca28 · spec 058 -->

<a id="A6.5.3"></a>
### A6.5.3 Migrace v čase

**Migrace v čase** ukazuje místa podle let. Posuvník v liště pod mapou určí rok a mapa ukáže místa, která do toho
roku přibyla, a čáry stěhování rodu.

- **Hranice:**
  - na liště jsou jen místa s rokem a polohou. Místa s polohou, ale bez data stavový pruh spočítá („N míst bez data
    se na časové ose nezobrazuje.“);
  - lišta jde od nejstaršího po nejmladší rok míst v rozsahu (**Tento pohled** / **Celý strom**) a zapnutých druhů
    ([A6.5](#A6.5)). Bez datovaných míst režim zapnout nejde;
  - bod, kde se něco stalo v posledních deseti letech před zvoleným rokem, je zvýrazněný;
  - čára vede z místa narození rodiče do místa narození dítěte, když obě mají rok a polohu a liší se. Sourozenci se
    stejnou cestou mají jednu čáru. Čára s věkem dítěte bledne, po 60 letech na 15 %. Kreslí se jen čáry s koncem
    u výřezu mapy, nejvýš 400. Bez druhu **Narození** se čáry nekreslí („Cesta rodu jen s Narozeními.“);
  - **Přehrát** posouvá rok zhruba po 120 ms až k poslednímu roku. Na posledním roce začne **Přehrát** znovu od
    začátku.
- **Od aplikace 3.28.0:**
  - tlačítko **◷ V čase** má u ikony i text;
  - mapa nabídne režim jednou: dokud nebyl zapnutý a strom má aspoň dvě datovaná místa s polohou, stojí u tlačítka
    karta **Migrace v čase** („Přehraje, jak se rody stěhovaly, a ukáže cestu předků k jedné osobě.“). **Vyzkoušet**
    režim zapne, **Teď ne** kartu zavře. Po kterékoli z obou se karta na tomto zařízení už neukáže;
  - klávesy na posuvníku: šipky o rok, PageUp a PageDown o 10 let, Home a End na začátek a konec. Mezerník kdekoli
    na mapě (mimo pole a tlačítka) přehraje nebo pozastaví. Ruční posun přehrávání pozastaví;
  - v režimu jde vybrat osobu, ke které vede cesta jejích předků ([A6.5.4](#A6.5.4));
  - **Přehrát** a **Pozastavit** mají stejnou šířku (delšího z obou slov v daném jazyce), takže se posuvník, jeho
    značky ani rok při spuštění a zastavení neposunou. Telefon má jen ikonu.
- **Ovládání:** aplikace: mapa → **◷ V čase** (**Migrace v čase**) → posuvník, **Přehrát** / **Pozastavit**.
- **Platí od:** aplikace 2.4.0; druhy míst 3.21.0; text tlačítka, jednorázová nabídka, klávesy a stálá šířka
  **Přehrát** 3.28.0

<!-- zdroj: app:src/map-time.ts collectDatedPlacePoints (undatedPlaceCount, minYear/maxYear) · src/ui/map-ui.ts drawMapTimeLayer (fresh = posledních 10 let, slice(0, 400) s koncem u výřezu), mapMigrationSegments (místa narození rodič → dítě, opacity max(0.15, 1 − věk/60·0.85), bez Narození nic), toggleMapTimePlay (setInterval 120, na konci od začátku), renderMapTimeTip / dismissMapTimeTip (strom.map.timeTipSeen, ≥ 2 datovaná místa s polohou, podklad mapy potvrzený), klávesy na posuvníku a mezerník (setMapTimeYear pozastaví) · strings.ts map.timeMode, timeModeShort, timeModeEmpty, timePlay, timePause, timeUndated, noFamilyPath, timeTipTitle, timeTipText, timeTipTry, timeTipLater · Migrace v čase od v2.4.0 (app 44a903bc) · 3.28.0: app 34e82d43, cce82a89 (app:81f2adf0) · CHANGELOG.cs.md 3.21.0, 3.28.0 · spec 054 P2 · stálá šířka Přehrát/Pozastavit: app 35ed67f9 src/ui/map-ui.ts (obě slova v jedné buňce, map-time-play-word), index.html .map-time-play-text -->

<a id="A6.5.4"></a>
### A6.5.4 Cesta předků k osobě

V Migraci v čase jde vybrat jednu osobu. Mapa pak ukáže jen její přímé předky, čáry od každého předka k jeho
dítěti až k vybrané osobě a lišta končí u ní.

- **Hranice:**
  - předkové jsou rodiče, jejich rodiče a dál, nejvýš 30 generací. Rodiče se berou jako ve Vějíři
    ([A6.4](#A6.4)). Zástupný druhý rodič rodiny s jedním rodičem předkem není: jeho větev je neznámá;
  - předek, ke kterému vede víc cest (implex), je na mapě jeden bod, ale počítá se v každé větvi, do které patří.
    Ve stejné větvi se jeho předkové nerozvíjejí podruhé;
  - předek stojí na místě narození, bez něj na místě křtu, bez něj na prvním datovaném bydlišti; vždy jen na místě
    s polohou. Jeho rok je rok narození, bez něj rok křtu, bez něj rok toho místa. Předek bez roku nebo bez místa
    s polohou na liště není: legenda ho spočítá a **Seznam ›** ho jmenuje s tím, co chybí (**bez data narození**,
    **bez místa**, **bez data a místa**) a **Stránka osoby ›** ([A6.5.5](#A6.5.5));
  - vybraná osoba stojí stejně. Je to cíl: kroužek „◎ cíl: jméno“, na konci lišty plný kroužek „◎ jméno · rok“
    (u místa křtu „· křest rok“, u bydliště „· bydliště rok“). Cíl bez místa na mapě se nekreslí a na konci lišty
    stojí „… nemá místo na mapě.“;
  - lišta jde od roku nejstaršího předka na mapě do pozdějšího z roků posledního předka a cíle;
  - cesta bere předky z celého stromu: místo rozsahu stojí čip s osobou, po zrušení cesty se rozsah vrátí.
    Druhy míst se na cestu nevztahují. Bod obce sbírá i její domy jako bez cesty;
  - bublina místa ukáže jen lidi cesty na tom místě, předky do zvoleného roku a cíl, se štítky jejich rodů;
  - po výběru osoby se mapa jednou posune a přiblíží na celou cestu, pak se sama nehýbe (výjimka na konci
    přehrávání, [A6.5.6](#A6.5.6));
  - čar je nejvýš 400 jako bez cesty. Když jich je víc, mají přednost: kmen (rodiče a prarodiče), čáry z posledních
    10 let, bližší generace, konec ve výřezu mapy, delší čára. Legenda to řekne („Ukázáno N z M čar“, „Přednost
    mají bližší generace a čáry, které právě přibyly.“);
  - vypnutí **V čase** cestu jen skryje. Po zapnutí se vrátí a běží od prvního roku. Zruší ji **×** na čipu;
  - nové okno s mapou ([A6.8](#A6.8)) převezme osobu cesty, čtvrtiny nebo osminy a barvy rodů.
- **Výběr osoby:** **Cesta k osobě** hledá v celém stromu („Jméno, příjmení nebo rok“), nejvýš 30 osob. Prázdné
  pole ukáže ústřední osobu (**Naposledy zaměřená**). U každé osoby stojí, kolik jejích předků je na mapě; osoba bez
  nich je zašedlá („předkové zatím bez míst na mapě“) a vybrat nejde. Na telefonu a dotykové obrazovce se výběr
  otevře jako list zespodu. Když žádný předek na mapě není, lišta řekne „Předkové zatím nemají místa na mapě.“
  a nabídne **Vybrat jinou osobu**.
- **Ovládání:** aplikace:
  - mapa → **◷ V čase** → v liště **◎ Cesta k osobě…** → osoba. Čip **◎ Cesta k:** jméno otevře výběr znovu
    (**Změnit osobu**), **×** cestu zruší (**Zrušit cestu**);
  - v bublině místa klik na osobu → **◎ Cesta k této osobě** (vedle **Stránka osoby ›**), i bez vybrané osoby;
  - na stránce osoby **◎ Cesta předků na mapě ›** ([A7.6](A7-book-pages-and-export.md#A7.6)): stránka se zavře,
    mapa ukáže cestu od prvního roku a oznámení nabídne **‹ Zpět na stránku osoby**. Odkaz je v oddílu **Místa
    života**. Osoba s nejvýš jedním vlastním místem tento oddíl nemá; když má předky na mapě, stojí odkaz na vlastním
    řádku tam, kde by oddíl byl. Když osoba předky má, ale žádný není na mapě, je odkaz zašedlý („Předkové zatím
    nemají místa na mapě.“) a jen v oddílu **Místa života**. Bez předků ve stromu odkaz není.
- **Platí od:** aplikace 3.28.0

<!-- zdroj: app:src/map-lines.ts buildPathModel (maxGen 30, fatherMother přes parentSlots jako vějíř, isPlaceholder není předek, implex záznam na cestu, expanded podle osoby a větve), placeOf (narození → křest → první datované bydliště, jen s polohou; rok narození → křest → místa), missing (date/place/both), yearFrom/yearTo, links, pathSegments (PATH_LINE_CAP 400, pořadí kmen, fresh < 10 let, generace, výřez, délka) · src/ui/map-path-ui.ts (mapEffectiveScope celý strom, čip místo rozsahu, clearMapPath vrátí rozsah, jednorázový výřez framed, cíl čárkovaný → plný, pathTargetNoPlace, pathNoAncestors + pathOtherPerson) · src/person-picker.ts PathPersonPicker (limit 30, recentId = ústřední osoba, onMapCount 0 = aria-disabled, celý strom) · src/ui/map-lines-legend-ui.ts mapPathBubbleParts · src/ui/map-ui.ts showMapPathPlace, toggleMapTime (vypnutí skryje, zapnutí od začátku) · src/ui/person-page-ui.ts personPageMapPath (on/off/null), openPersonPageMapPath (toast map-path-back) · src/person-page-map.ts (pp-map-path, aria-disabled, jen v okně aplikace; mapPathRowHtml vlastní řádek bez oddílu Místa života jen pro mapPath on, app caea192a) · src/person-page.ts mapPathRow · src/windows/view-window-state.ts MapTimeState path, mode, colors · strings.ts map.pathPick, pathPickTitle, pathPickPlaceholder, pathPickRecent, pathPickOnMap, pathPickNone, pathChip, pathChange, pathClear, pathFromPage, pathThisPerson, pathBackToPage, pathGoal, pathGoalEnd, pathTargetNoPlace, pathNoAncestors, pathOtherPerson, linesCut, linesCutWhy, missingDate, missingPlace, missingBoth · app 388e5a87, b01693bc, 5853882e, 34e82d43 (app:81f2adf0) · dirigent:prace/1113-app-mapa-rody-v-case · ZADANI_UIX_mapa-rody-v-case D3, D4 (ponechat) · spec 054 K2.1, P2 · CHANGELOG.cs.md 3.28.0 -->

<a id="A6.5.5"></a>
### A6.5.5 Barvy rodů a legenda Rody

Cesta předků je barevná podle rodů. Rod je tu větev jednoho prarodiče (čtvrtina) nebo jednoho praprarodiče
(osmina) vybrané osoby, pojmenovaná jeho příjmením za svobodna. Není to rod podle příjmení
([A4](A4-surnames-and-families.md)).

- **Hranice:**
  - čtvrtiny jsou otcův otec, otcova matka, matčin otec a matčina matka, ve stejných odstínech jako barvy **Linie**
    ve Vějíři ([A6.4](#A6.4)). Každá čtvrtina má i vlastní vzor čáry (první plnou), takže se rody rozliší i při
    slabším barvocitu. Dvě čtvrtiny téže strany (modrá a modrozelená otcovy, růžová a malinová matčiny) se liší
    světlostí i vzorem. Světlý a tmavý vzhled mají vlastní odstíny;
  - osmina má barvu své čtvrtiny, druhá osmina téže čtvrtiny tmavší odstín. Číslo osminy (1–8) stojí na nejdelší
    viditelné čáře každé osminy;
  - čáry od rodičů a prarodičů jsou kmen: barvou textu a širší. Body rodičů mají barvu kmene, body prarodičů barvu
    své čtvrtiny. Bod, kde se potkává víc rodů, má barvy všech;
  - čára z posledních 10 let je širší. Starší čáry blednou, nejvýš na 55 %, aby byla na konci vidět celá cesta;
  - příjmení rodu je rodné příjmení prarodiče nebo praprarodiče; bez příjmení jeho křestní jméno.
- **Legenda Rody** (vpravo pod ovládáním mapy, když je na mapě aspoň jeden předek):
  - **Čtvrtiny** · **Osminy**. **Osminy** jdou zvolit, když strom zná aspoň dvě osminy;
  - řádek rodu: vzor čáry, příjmení, vztah a počet předků na mapě („otcův otec · 12 předků“). V osminách stojí
    řádky pod nadpisem své čtvrtiny („1 · příjmení“). Neznámý prarodič má řádek bez barvy („otcova matka –
    neznámá“). Rod, jehož žádný předek na liště není (všichni bez data nebo místa), má řádek tlumený jako neznámý,
    s prázdným čárkovaným vzorkem a „mimo lištu“ místo počtu („otcova matka · mimo lištu“); zvýraznit ani připnout
    nejde. Poslední řádek je **Kmen: rodiče a prarodiče**;
  - najetí na řádek rod na chvíli zvýrazní, klik ho připne a ostatní rody utlumí. Esc nebo druhý klik připnutí
    zruší, přepnutí čtvrtin a osmin taky;
  - pod řádky stojí: první osoba ve dvou větvích („↻ jméno (rok) je ve dvou větvích: … a ….“), ořez velkého stromu
    ([A6.5.4](#A6.5.4)), předkové mimo lištu („N předků bez data nebo místa na liště není.“ a **Seznam ›**,
    seznam **Předkové mimo lištu**) a **Bez barev rodů**;
  - **Bez barev rodů** nakreslí celou cestu jednou barvou a skryje řádky rodů. Kmen zůstane širší a osoba
    zůstane vybraná;
  - **▴** (**Sbalit**) složí legendu do čipu „Rody (N)“ s barvami rodů. Mapa se tím neposune.
- **Telefon:** legenda se otevře jako list zespodu z čipu **Rody (N)** nad lištou, **Seznam ›** také. Otevřený je
  vždy jen jeden list (legenda, seznam, bublina nebo výběr osoby). Telefon na šířku má čip v horní řadě.
- **Ovládání:** aplikace: mapa → **◷ V čase** → cesta k osobě ([A6.5.4](#A6.5.4)) → legenda **Rody**.
- **Platí od:** aplikace 3.28.0
- **Od aplikace 3.30.0:** čtvrtiny v odstínech **Značení linií** ([A6.1.5](#A6.1.5)): otcova strana modrá
  a modrozelená, matčina růžová a malinová. Do 3.29.0 jiné odstíny.

<!-- zdroj: app:src/map-line-colors.ts (LINE_HUE z fan-colors.ts jako vějíř Linie, tabulka OKLCH světlý/tmavý, QUARTER_DASH, lineCap, LINE_WIDTH base 3 / fresh 4 / trunk 4.5, pathLineOpacity max(0.55, 1 − věk/60·0.45), LINE_FOCUS_DIM, pointFill, lineSwatch; hlavička: dvojice 50↔95 a 215↔320 se liší světlostí i vzorem; app:cecd72a4 LINE_HUE 258/232/352/5, tabulka OKLCH q0–q3, e1–e7 (dvojice téže strany se liší světlostí)) · src/map-lines.ts lineClassOf (gen ≤ 2 kmen), pointClassOf (rodiče kmen), branchSurname (rodné příjmení, jinak křestní), quarters/eighths · src/ui/map-path-ui.ts drawMapPathLayer (čísla osmin na nejdelší viditelné čáře, LEGEND_WIDTH) · src/ui/map-lines-legend-ui.ts mapLinesLegendHtml (eighthsOff < 2 známé osminy, řádky, neznámý, kmen, pata), mapLinesImplexText, toggleMapLineFocus, setMapLineHover, setMapLineMode (připnutí pryč), setMapLineColors, setMapLegendCollapsed, openMapLinesSheet / closeMapLinesSheets, mapLinesUndatedHtml, offTimeline (count 0: is-unknown, is-off-timeline, swatch is-empty, app caea192a) · strings.ts map.linesOffTimeline, map.linesTitle, linesChip, linesQuarters, linesEighths, linesCollapse, linesRow, linesUnknown, linesTrunk, linesOff, linesImplex, pathUndated, pathUndatedList, pathUndatedTitle, lineE8–lineE15; fan.lineFatherFather… · app 388e5a87, b01693bc, 5853882e, 8e27df4a, 34e82d43 (app:81f2adf0) · spec 054 K1.1, K1.2 · CHANGELOG.cs.md 3.28.0 -->

<a id="A6.5.6"></a>
### A6.5.6 Přehrát cestu k osobě

S vybranou osobou projde **Přehrát** celou lištu za 24 sekund, od nejstaršího předka k vybrané osobě.

- **Hranice:**
  - rok po roku, žádný se nepřeskočí. Rok, ve kterém přibyl předek nebo cíl, trvá pětkrát déle než rok bez nich;
  - přehrávání skončí u cíle. Další **Přehrát** začne od začátku;
  - pozastaví ho **Pozastavit**, posuvník, klávesy ([A6.5.3](#A6.5.3)) i značka nad posuvníkem;
  - značky nad posuvníkem: každá známá čtvrtina v roce svého nejstaršího předka na mapě, v barvě rodu („příjmení:
    nejstarší předek rok“), a cíl na konci. Klik na značku skočí na její rok;
  - řádek pod posuvníkem říká, co naposledy přibylo: „rok · jméno · místo rodiče → místo“ se vzorkem barvy rodu,
    cíl tučně. Přibylo-li v jednom roce víc osob, ukáže cíl, jinak osobu z nejbližší generace. Čtečka obrazovky
    řádek přečte při změně. Bez vybrané osoby řádek není a věta o místech bez data zůstává ve stavovém pruhu;
  - mapa se při přehrávání nehýbe. Jen když ji od výběru osoby nikdo neposunul ani nepřiblížil a cíl je na konci
    mimo dohled, posune se k němu jednou;
  - na telefonu je **▶** bez textu a lišta v jedné řadě.
- **Ovládání:** aplikace: mapa → **◷ V čase** → cesta k osobě ([A6.5.4](#A6.5.4)) → **Přehrát**.
- **Platí od:** aplikace 3.28.0

<!-- zdroj: app:src/map-lines.ts pathPlaySchedule (PATH_PLAY_MS 24000, PATH_EVENT_WEIGHT 5, krok rok, součet 24 000), pathAddedIn (nejbližší generace, pak rel, cíl poslední), pathLastAdded · src/ui/map-path-ui.ts playMapPath (konec u cíle), panMapToPathEnd (framed, jednou), renderMapTimeMarks (čtvrtiny podle firstYear, cíl), renderMapTimeCaption (cíl, jinak items[0]; aria-live, aria-valuetext; bez cesty skryto) · src/ui/map-ui.ts toggleMapTimePlay (na konci od začátku), setMapTimeYear (pozastaví), značky → setMapTimeYear · strings.ts map.timeMarkTitle, pathGoalEnd · app cce82a89, 34e82d43 (app:81f2adf0) · ZADANI_UIX_mapa-rody-v-case D5 (ponechat) · spec 054 K2.2 · CHANGELOG.cs.md 3.28.0 -->

<a id="A6.6"></a>
## A6.6 Rod v pohledu

Pohled může zvýraznit jeden rod ([A4](A4-surnames-and-families.md)): jeho členy plně, manželky a manžele, kteří
do rodu přišli sňatkem, slaběji, ostatní potlačeně. Platí v pohledech Rodina, Potomci a Vějíř.

- Volba se pamatuje pro každý strom na zařízení. Rod, který už ve stromu není, se tiše zruší.
- Když v pohledu není nakreslený žádný člen rodu:
  - Rodina a Vějíř přesunou ústřední osobu na nejbližšího člena rodu (přes rodiče, děti a partnery; při shodě
    na staršího), a když s ním osoba není spojená, na zakladatele rodu;
  - Potomci přesunou ústřední osobu vždy na zakladatele;
  - lišta nabídne **↩ Zpět**.
- **Hranice:** obnovení volby z paměti ústřední osobu nepřesouvá.
- **Ovládání:** **Rody** v liště; v nabídce osoby **Jen rod …** (rodný rod osoby je první); konec přes × u štítku
  nebo **Ukázat celý strom**.
- **Platí od:** aplikace 3.21.0

<!-- zdroj: app:src/ui/rod-view.ts · src/rod-focus.ts (BFS přes rodiče, děti, partnery) · strings.ts rodView.only, rodView.whole, rodView.moved · spec 039 · CHANGELOG.cs.md 3.21.0 -->

<a id="A6.7"></a>
## A6.7 Tabulka

Tabulka ukazuje celý strom po řádcích: každou osobu, každý svazek, každou událost nebo každý pramen, s údaji ve
sloupcích. Slouží k hledání mezer, rozporů a nálezů kontroly napříč stromem. Nezávisí na hloubce **Předci** a **Potomci**.
Pohled Tabulka vychází z tabulky od Ondřeje Chrpy.

- **Řádky:** přepínač **Řádky**: **Osoby** · **Svazky** · **Události** · **Prameny**. Každý typ řádků má vlastní sloupce,
  filtr a řazení.
  - **Osoby:** jeden řádek na osobu stromu; zástupné osoby (prázdné místo pro neznámého rodiče) se vynechávají.
  - **Svazky:** jeden řádek na svazek, který má aspoň jednoho skutečného partnera. **Partner 1** je ten z dvojice,
    kdo je pokrevní příbuzný hlavní osoby; jinak první partner svazku.
  - **Události:** jeden řádek na událost stromu ([A6.7.10](#A6.7.10)).
  - **Prameny:** jeden řádek na pramen stromu ([A6.7.11](#A6.7.11)).
- **Hlavní osoba** je ústřední osoba stromu ([A6.1](#A6.1)). Podle ní se počítá sloupec **Vztah k hlavní osobě**
  a čip **Pokrevní příbuzní**: předci hlavní osoby (i ona sama) a všichni jejich potomci. Partneři, kteří do rodiny
  přišli sňatkem, mezi ně nepatří.
- **Generace** 1 je nejstarší generace stromu; partner má generaci svého partnera.
- **Žijící** (sloupec, hodnota „žijící“) počítá jako ochrana žijících ([A7.1](A7-book-pages-and-export.md#A7.1)).
- Nad tabulkou je počet („42 z 120 osob“) a řazení („Řazení: …“). Pole **Hledat osobu...** v liště v tabulce
  řádek osoby vybere a posune na něj; ústřední osoba se nemění.
- **Ústřední osoba mezi pohledy:** po přepnutí do Tabulky je aktivní řádek ústřední osoby a tabulka se na něj posune
  (vybraný řádek, který se jí týká, zůstane; když osobu vynechá filtr nebo hledání, aktivní řádek není). Po přepnutí
  z Tabulky je ústřední osobou osoba aktivního řádku: u svazku partner, který už ústřední osobou je, jinak
  **Partner 1**; u události ústřední osoba, je-li mezi jejími osobami, jinak první osoba; řádek pramene ústřední osobu
  nemění.
- **Hranice:**
  - zvýraznění rodu ([A6.6](#A6.6)) se v tabulce nepoužije; rod jde vybrat čipem **Rod** ([A6.7.6](#A6.7.6));
  - sloupce, čipy a pohledy výzkumu jsou jen ve stromu z výzkumu ([A6.7.14](#A6.7.14));
  - strom jen ke čtení (sledovaný strom, strom uložený novější verzí aplikace, zamčený strom) tabulka jen
    ukazuje: „Jen ke čtení: úpravy a „Není chyba“ tu nejsou.“ Prohlížení, filtr, řazení a export CSV a XLSX
    fungují; pohled uložit, přejmenovat ani smazat nejde;
  - šipky **↩ ↪** vlevo dole (předchozí a další ústřední osoba) a Alt+← / Alt+→ v Tabulce nejsou: tabulka ústřední
    osobu neukazuje ani během práce nemění;
  - **od aplikace 3.30.0** vedou Alt+← / Alt+→ v tabulce zpět a vpřed po skocích přes jména osob
    ([A6.7.16](#A6.7.16)); ústřední osobu ani tak nemění.
- **Od aplikace 3.30.0:** **Rozsah ▾** zúží tabulku na seznam osob ([A6.7.19](#A6.7.19)) a **⋯** Tabulky (na každé
  šířce; na počítači skryté, dokud tabulka nemá řádky) nabízí **Seskupit podle ›** ([A6.7.20](#A6.7.20)) a **Uložit
  jako seznam osob…** ([A11.6](A11-lists-of-people.md#A11.6)).
- **Ovládání:** v liště pohledů **Tabulka** (za **Mapa**); na telefonu, tabletu a v okně do 1024 px **Tabulka** na dolní
  liště ([A9.5](A9-using-the-app.md#A9.5); do aplikace 3.27.0 **Více → Pohled → Tabulka**).
  Pohled se pamatuje jako ostatní ([A6.1.1](#A6.1.1)).
- **Platí od:** aplikace 3.27.0

<!-- zdroj: app:src/ui/table-view/table-model.ts ROW_TYPES, buildTableModel (isPlaceholder ven, svazek aspoň s jedním skutečným partnerem), bloodOf (předci hlavní osoby a všichni jejich potomci), makeContext (homeId, isLivingPerson) · table-columns.ts unionPartners (pokrevní partner jako Partner 1), gen (assignGenerations + 1), kin (findRelationship, kinSelf) · src/ui/table-view/table-ui.ts tableReadOnly (isReadOnly: viewMode, isLocked, isNewerData) · src/data.ts:655 isReadOnly · src/ui/bottom-sheet.ts:443 (do 3.27.0 Více → Pohled: Vějíř, Mapa, Tabulka; od 3.28.0 app:4b1373a7 index.html bb-view-table, commit bb5e4d12) · table-bar.ts countText, sortText · perf-budget test 5 000 osob · strings.ts viewModeSwitch.table, table.rows, rowType, rowTypeNote, countOf, sortedBy, readOnly, readOnlyShort · commity c34c47ff, 1b72e6d8 · spec 073 U2 · Události a Prameny (spec 073 U3 P2, K5.1–K5.4): commity 8de751c2, 63ed9def, 1a3a49f1, 3cf69ffa, strings.ts table.rows.events, rows.sources, perf-budget 5 000 osob (Události) a 2 000 pramenů · poděkování: Milan 10. 11. (dirigent:prace/1110-doc-tabulka, bod 4) · CHANGELOG.cs.md 3.27.0 · dirigent:prace/1110-app-tabulka-p1 · Žijící: strings.ts table.col.living, table.living (commit 7e648e24) · ústřední osoba mezi pohledy: commit 75de3a9b (T54 F1) · ↩ ↪ a Alt+šipky v Tabulce skryté: commity 79764eba, b1cbe546 (T54 G14) -->

<a id="A6.7.1"></a>
### A6.7.1 Svazky v tabulce osob

Osoba se dvěma a více svazky má v tabulce osob vlastní řádek a pod ním podřádek pro každý svazek („Svazek 2 z 3“).
Řádek osoby má ve sloupci **Partner** počet („3 svazky“) a ostatní sloupce svazku prázdné.

- Svazky jdou v pořadí sňatků jako ve stromu ([A6.4](#A6.4)): **Svazek 1** je ten, který má na kartě značku „1. ∞“.
  Svazek bez data sňatku se řadí podle nejpozdějšího možného data sňatku (dřívější z rozvodu a narození prvního
  dítěte); svazek bez těchto dat jde za ostatní. Při shodě rozhoduje pořadí svazků u osoby v datech. Prázdná
  zástupná rodina („?“) jde na konec v pořadí zápisu.
- **Sbaleno:** řádek osoby ukáže první svazek a počet ostatních. Výchozí je rozbaleno; vestavěný pohled **Mezery**
  má svazky sbalené.
- **Filtr ve sloupci svazku** se posuzuje u každého svazku zvlášť. Osoba zůstane, když vyhoví aspoň jeden svazek;
  ostatní se schovají pod řádek „2 svazky mimo filtr · ukázat“. Ukázané jsou znevýrazněné do další změny filtru.
- **Řazení podle sloupce svazku** bere první svazek, který vyhoví filtru.
- Osoba s jedním svazkem má jeho údaje přímo ve svém řádku.
- Podřádek svazku nese jen nálezy svého svazku. Nálezy osoby (třeba věk matky při narození) a pruhy sbalených skupin
  zůstávají v řádku osoby.
- **Ovládání:** **Rozbalit svazky** / **Sbalit svazky** (na telefonu v nabídce **⋯**); klávesy → a ← ve sloupci
  **Celé jméno**, * pro všechny osoby; nabídka řádku. Stav se ukládá s pohledem ([A6.7.7](#A6.7.7)).

<!-- zdroj: app:src/ui/table-view/table-subrows.ts defaultUnionCollapse (collapsed: false), isExpanded, setAllExpanded, passingUnions, personPassesUnions, sortUnionOf, buildLines · table-model.ts unionsInMarriageOrder (marriagesInOrder z src/marriage-order.ts: Svazek 1 = „1. ∞“; bez data sňatku podle rozvodu nebo prvního dítěte; shoda podle seznamu partnerships osoby; zástupné rodiny „?“ za nimi v pořadí dat; commit 2e0346f9, T13) · table-views.ts BUILTIN_VIEWS gaps (unions collapsed) · strings.ts table.unionsN, unionKofN, hiddenUnions, expandAll, collapseAll · commity 8833da14, 8192621d · nálezy podřádku: commit 75de3a9b (T54 F6) -->

<a id="A6.7.2"></a>
### A6.7.2 Sloupce

Sloupce jsou ve skupinách. Které jsou vidět a v jakém pořadí, je část pohledu ([A6.7.7](#A6.7.7)).

| Řádky | Skupiny sloupců |
|---|---|
| **Osoby** | **Osoba** · **Narození a křest** · **Rodiče** · **Svazky** · **Rozvod** · **Úmrtí a pohřeb** · **Události** · **Prameny** · **Spolehlivost a výzkum** · **Kontroly** |
| **Svazky** | **Pár** · **Sňatek** · **Rozvod** · **Děti a prameny** |

- **Celé jméno** (u svazků **Partner 1**) je vždy ukotvené vlevo; odkotvit ani skrýt nejde. Řadí se podle příjmení,
  pak křestního jména.
  Skládá se z částí jména, proto je zvlášť sloupec **Křestní jméno** (ve výchozím stavu skrytý), který jde upravit
  v buňce ([A6.7.15](#A6.7.15)). **Příjmení** je příjmení po sňatku, jinak rodné; **Rodné příjmení** je zapsané příjmení.
- **ID výzkumu** ukazuje jen číslo osoby z výzkumu (P…). **Ref. číslo** je referenční číslo osoby (REFN), jak ho
  přinesl soubor GEDCOM (a jak do něj zase jde); řadí a filtruje se jako text.
- **Otevřená otázka**, **⇄ V jiném stromu** (stromy na tomto zařízení, ve kterých osoba je) a **Stav osoby** (značka
  doložení a spolehlivosti z karty, slovy; řadí se od nejsilnější; od aplikace 3.27.0 podle spolehlivosti citací,
  [S7.2](S7-reliability-and-verification.md#S7.2)) jsou v každém stromu. Skupina **Výzkum** je jen ve
  stromu z výzkumu ([A6.7.14](#A6.7.14)).
- **Události** (**Povolání**, **Bydliště**, **Vyznání**, **Vojsko**, **Vystěhování**, **Vzdělání**) ukazují
  každou hodnotu jednou, nejnovější první.
- Sloupce **Spolehlivost …** a **Jistota z výzkumu** mají hodnotu jen ve stromu z výzkumu
  ([S7](S7-reliability-and-verification.md)).
- Sloupce **Křestní jméno**, **Ref. číslo**, **Otevřená otázka**, **⇄ V jiném stromu** a **Stav osoby** jsou ve výchozím stavu skryté.
- **Od aplikace 3.30.0:** u svazků ve skupině **Děti a prameny** sloupec **Fotka** s náhledem fotky svazku, ve
  výchozím stavu skrytý; filtr **s fotkou** / **bez fotky** ([A12.6](A12-portrait-and-couple-photo.md#A12.6)).
- **Od aplikace 3.30.0:** u osob ve skupině **Osoba** sloupec **Přidáno**, ve výchozím stavu skrytý: den, kdy osoba
  přibyla do stromu ([A11.7](A11-lists-of-people.md#A11.7)), v jazyce aplikace. Osoba bez údaje má „dříve“ šedou
  kurzívou; buňka je prázdná, takže je na konci v obou směrech řazení a najde ji **Jen prázdné**. Řadí se podle
  okamžiku přidání (v rámci dne podle času), filtr data podle roku.
- **Od aplikace 3.30.0:** u osob ve skupině **Osoba** sloupec **Linie**, ve výchozím stavu skrytý: linie osoby vůči
  ústřední osobě stromu ([A6.1.5](#A6.1.5)) slovy, **Otcovská**, **Otcovská i mateřská**, **Mateřská**, **Potomek**
  (u rodičů stejného pohlaví **Linie 1. rodiče**, **Linie 1. i 2. rodiče**, **Linie 2. rodiče**), před textem znak
  ve zvoleném tvaru (při **Bez tvaru** jen text). Osoba bez linie má buňku prázdnou. Řadí se v tomto pořadí, prázdné
  na konci; filtr podle hodnot. Se sloupcem **Linie výzkumu** skupiny **Výzkum** ([A6.7.14](#A6.7.14)) nesouvisí.
- **Hranice:** sbalená skupina je úzký pruh; ukazuje nejvyšší úroveň nálezu ve svých buňkách. Na telefonu je
  ukotvené jméno užší a hlavičku jde jen číst, ne měnit.
- **Ovládání:**
  - panel **Sloupce** („12 z 58“): **Hledat sloupec**, skupiny se zaškrtávátkem **vše**, přetažení pořadí,
    **Řádek pokrytí**, **Obnovit výchozí**, **Hotovo**;
  - nabídka v hlavičce sloupce: **Řadit vzestupně**, **Řadit sestupně**, **Přidat k řazení** (Shift + klik),
    **Filtr…**, **Ukotvit vlevo** / **Uvolnit**, **Posunout vlevo** / **Posunout vpravo**, **Skrýt sloupec**,
    **Sbalit skupinu …** / **Rozbalit skupinu …**; u dopočteného sloupce „Vypočteno z: …“;
  - šířka sloupce tažením okraje hlavičky.
- **Pořadí sloupců:**
  - v ukotvené části jde kterýkoli ukotvený sloupec přesunout na kterékoli místo mezi ukotvenými, i **Celé jméno**
    (nemusí být první);
  - mimo ukotvenou část se sloupec posouvá jen v rámci své skupiny;
  - posun, který nejde, se nenabízí: v nabídce hlavičky chybí **Posunout vlevo** nebo **Posunout vpravo**, v panelu
    **Sloupce** šipka ↑ nebo ↓.
- **Od aplikace 3.28.0:** ukotvené sloupce v libovolném pořadí. Do 3.27.0 bylo **Celé jméno** vždy první a nešlo
  posunout, ukotvené sloupce se posouvaly jen v rámci své skupiny a posun, který nešel, byl zašedlý.

<!-- zdroj: app:4b1373a7 src/ui/table-view/table-state.ts normalizeColumns (zamčený sloupec ukotvený, kdekoli v ukotvené části), columnRun (ukotvená část: [0, pinned − 1]; mimo ni skupina), canMoveColumn, moveColumnBy · table-headmenu.ts headMenuItems (moveLeft/moveRight jen canMove; Skrýt ne u zamčeného; Uvolnit ne u zamčeného) · table-colpanel.ts (šipka jen pro možný posun) · commit 19dbb595 (dřív columnRun locked = 1, disabled/aria-disabled) · dirigent:spec/082-tester-3.28 K2.1 -->
<!-- zdroj: app:src/ui/table-view/table-columns.ts PERSON_GROUPS, UNION_GROUPS, katalog sloupců (surname marriedSurname || lastName, birthSurname lastName, researchId /^P\d{1,7}$/, eventValues nejnovější první, sortKey jména), pinnedWidth 156 na telefonu · table-state.ts MIN_COLUMN_WIDTH, BAND_WIDTH, lockedColumn · table-checks.ts bandSeverity · table-colpanel.ts panelGroups · table-headmenu.ts headMenuItems · strings.ts table.group.*, col.*, columns, columnsCount, searchColumn, all, pinnedLabel, resetColumns, done, coverageRow, sortAsc, sortDesc, sortAdd, sortAddHint, filterColumn, pin, unpin, moveLeft, moveRight, hide, collapseGroup, expandGroup, computedFrom · commity 89602f35, 49b96d92, e4a35406 · refn (skupina person, textCell p.refn; commit 7e648e24, T54 F3), question, crossTree (crossTreeCell), personStatus (personStatusCell, cardStatus, CARD_STATUS_CLASSES), strings.ts table.col.refn, question, crossTree, personStatus · „Celé jméno“ (id `name`) a sloupec firstName, záhlaví „Ref. číslo“ bez „(REFN)“: commity 79764eba, 8fdf52ca (T54 G10, G3) · 3.30.0: app:45f7ca2a table-columns.ts:732 uPhoto (group uextra, skrytý) · app:0971647c table-columns.ts addedCell (dateCell, sortKey + zlomek dne, bez údaje emptyCell s textem earlier), sloupec added (group person, nenabízí se ve výchozím stavu), strings.ts table.col.added, table.earlier · e2e/person-list-table.spec.ts, src/__tests__/table-view-added.test.ts · app:cecd72a4 table-columns.ts lineage (group person, skrytý, getFocusPersonId, řazení paternal → both → maternal → descendant, prázdné poslední, filtr hodnot), table-grid.ts lineageHtml (znak ve zvoleném tvaru), strings.ts branchColors.tableColumn, tableBoth, tableDescendant, tableSlotBoth · app:675e1c5e strings.ts table.col.rLine „Linie výzkumu“ (do 3.29.0 „Linie“), src/__tests__/table-column-labels-unique.test.ts -->

<a id="A6.7.3"></a>
### A6.7.3 Dopočtené a náhradní hodnoty

Co ve stromu zapsané není, ale jde z dat spočítat, tabulka dopočte. Nic přitom do stromu nezapisuje.

| Hodnota | Jak se počítá |
|---|---|
| věk (při narození dítěte, sňatku, úmrtí) | z dat s dnem přesně („67“); z roku, měsíce nebo rozsahu jako rozsah („28–29“); z data s cca, před nebo po jako odhad („≈ 67“) |
| náhradní datum a místo | bez narození křest („křt. 3. 5. 1850“), bez úmrtí pohřeb („pohř. …“); věk z nich je odhad (≈) |
| **Rozdíl zapsaného věku** | o kolik let je zapsaný věk mimo rozsah věku z dat („+3“, „−2“); slovní věk a věk s cca, před, po se neporovnává |
| **Délka svazku** | od sňatku do rozvodu, jinak do první smrti z dvojice |
| **Pořadí mezi sourozenci**, **Počet sourozenců**, **Počet dětí**, **Počet svazků**, **Počet pramenů** | z vazeb a pramenů stromu |

- Data mají slovo přesnosti před sebou (**cca**, **před**, **po**). Nejisté datum je podtržené tečkami; nález to
  není. Datum se řadí podle svého začátku.
- **Hranice:** věk se nepočítá, když konec předchází začátek. Sloupce úmrtí mají u žijící osoby **Nevztahuje se**
  (u **Úplnost úmrtí** „žije“). **Věk otce/matky při narození** bez zapsaného rodiče je **Nevztahuje se**.
- **Ovládání:** nápověda u buňky („Křest, narození neznámé“, „Pohřeb, úmrtí neznámé“); u dopočteného sloupce
  v nabídce hlavičky „Vypočteno z: …“; legenda **Značky** ([A6.7.13](#A6.7.13)).

<!-- zdroj: app:src/ui/table-view/table-columns.ts ageCell (přesně / rozsah ageRangeBetween / ≈ approxAgeBetween; nic, když konec před začátkem), dateCell, qualifierWord, birthOrBaptism, deathOrBurial (náhrada, ≈), gapCell (recordedAgeGap), unionLength, naCell, parentsOf · src/dates.ts:448 ageRangeBetween, recordedAgeGap · table-model.ts dateNumber (začátek rozsahu) · strings.ts table.na, living, subst.*, qual.*, computedFrom, from.* · commit 8833da14 -->

<a id="A6.7.4"></a>
### A6.7.4 Úplnost a řádek pokrytí

Sloupce **Úplnost …** říkají, kolik sledovaných polí je vyplněno, v procentech.

| Sloupec | Počítá se z |
|---|---|
| **Úplnost narození** | datum, místo, otec, matka, pramen |
| **Úplnost svazku** | datum, místo, partner, pramen sňatku; u svazku bez sňatku (**Partneři**, **Odloučení**) jen partner |
| **Úplnost úmrtí** | datum, místo, pramen (ne u žijící osoby) |
| **Úplnost celkem** | narození, každý svazek a úmrtí, váženo počtem polí |

- Náhradní hodnota (křest, pohřeb) pole nevyplní. Nápověda u buňky vypíše, co chybí („chybí: místo narození,
  pramen narození“).
- **Řádek pokrytí** pod hlavičkou ukazuje u každého sloupce, kolik procent řádků má hodnotu („vyplněno 64 %“,
  nápověda „77 z 120“). Slovo „vyplněno“ stojí v prvním sloupci, ať je jím kterýkoli (od aplikace 3.28.0; dřív
  ve sloupci jména), v exportu XLSX také. U sloupců **Úplnost …** ukazuje průměrnou úplnost řádků (nápověda „průměr z 120“).
  Počítá jen řádky, které jsou právě vidět (po filtru a hledání). Buňky **Nevztahuje se**
  se nepočítají; u sloupců svazku se počítají svazky, které vyhoví filtru. Pod 50 % je číslo tučně; bez buňky,
  které by se týkal, je „–“.
- **Svazek bez sňatku** (typ **Partneři** nebo **Odloučení**): prázdné buňky sňatku (datum, místo, věk a zapsaný věk
  obou, rozdíl zapsaného věku, svědci, **Spolehlivost sňatku**) mají „–“ s nápovědou „Nevztahuje se: svazek bez
  sňatku“ a do řádku pokrytí ani úplnosti se nepočítají. Hodnota, která tam přesto je (začátek vztahu z formuláře
  svazku), se ukáže jako dřív.
- **Ovládání:** **Řádek pokrytí** v panelu **Sloupce** (na telefonu v **⋯**); ukládá se s pohledem.

<!-- zdroj: app:src/ui/table-view/table-columns.ts compCell, unionComp (pole a váhy, náhrada nevyplní) · table-coverage.ts cellFilled, columnCoverage, coverageCell, coverageLabel (LOW pod 50 %) · table-subrows.ts coverageUnionsOf · strings.ts table.compList.*, compField.*, missing, missingNone, compCounts, coverage, coverageOf · rozhodnutí Milan 10. 11. (spec 073, bod 5) · commit 8833da14 · průměr u sloupců úplnosti (kind percent): table-coverage.ts columnCoverage average, strings.ts table.coverageAverage, i XLSX, commit 56f3418c (T54 G12) · „vyplněno“ v prvním sloupci: app:4b1373a7 table-ui.ts coverageOf (firstId), table-xlsx.ts labelAt, commit 19dbb595 · svazek bez sňatku: table-columns.ts unionWithoutWedding (partners, separated), weddingCell, oneUnionFields (jen partner), strings.ts table.naNoWedding, compList.unionNoWedding, commit 8fdf52ca (T54 G5, MILAN.md rozhodnutí 21) -->

<a id="A6.7.5"></a>
### A6.7.5 Nálezy kontroly v buňkách

Tabulka ukazuje nálezy Kvality dat ([A5](A5-tree-check.md)) přímo u údaje, kterého se týkají: buňka je
podbarvená a má značku úrovně. Kontrola běží nad celým stromem na pozadí, když je aplikace volná.

| Úroveň | Značka v legendě |
|---|---|
| **chyba** | „Údaje si odporují.“ |
| **k ověření** | „Neobvyklá hodnota, stojí za ověření.“ |
| **stopa** | „Stopa pro pátrání, není to chyba.“ |
| **neobvyklé** (☆) | „Nález označený „Není chyba“.“ |

- Nález jde do buňky údaje: věk rodiče při narození do **Věk otce/matky při narození** u dítěte, nález ke sňatku
  do věku a data sňatku, zapsaný věk do zapsaného věku a jeho rozdílu, úmrtí před narozením do obou dat a věku,
  událost do sloupce události, rozdíl věku partnerů do partnera, možná duplicita do jména, zápis místa do buněk
  s tím místem. Nález bez vlastní buňky je jen ve sloupcích kontrol.
- Sloupce skupiny **Kontroly**: **Nálezy** (počet; „…“, dokud kontrola běží), **Nejvyšší úroveň**, **Neobvyklé,
  ověřené** (počet nálezů označených **Není chyba**).
- Nález označený **Není chyba** ([A5.7](A5-tree-check.md#A5.7)) v buňce zůstane jako **neobvyklé** („Neobvyklé,
  ale ověřeno“) a nepočítá se do nálezů.
- **Hranice:** strom jen ke čtení nález označit nedovolí („Strom je jen ke čtení: nález nejde označit.“).
- **Ovládání:** klik na značku otevře bublinu (na telefonu panel zdola): úroveň, text nálezu, „Nález 1 z 2“ a
  - **Není chyba** (oznámení „Označeno: není chyba“ s **Vrátit**); u neobvyklého **Hlásit znovu**;
  - **Kvalita dat ›** otevře dialog Kvality dat na skupině tohoto nálezu; u neobvyklého na seznamu označených.

  Buňky **Nálezy** a **Nejvyšší úroveň** otevřou seznam všech nálezů osoby (klik, Enter, klepnutí; na telefonu panel
  zdola): u každého úroveň, text a koho nebo čeho se týká; hlášené podle úrovně, označené **Není chyba** na konci.

  Legenda **Značky** („Značky v buňkách“) vysvětluje i nejisté datum, spolehlivost, náhradní hodnotu, dopočet
  a **Nevztahuje se**. Jak která značka vypadá: [A6.7.13](#A6.7.13).

<!-- zdroj: app:src/ui/table-view/table-checks.ts severityRank, parentAgeColumn, issueTargets (mapování nálezů na buňky), buildCheckIndex, CHECK_COLUMNS, applyChecks · table-ui.ts whenIdle (validateTreeData jednou), cellFindings · table-bubble.ts bubbleHeading, bubbleHtml, legendHtml, openBubblePanel, sheetElement · src/ui/tree-stats.ts showTreeValidationDialog (focus: skupina otevřená a posunutá; označené → seznam) · strings.ts table.sev.*, unusualChecked, notError, reReport, toQuality, dismissedToast, roNote, checksRunning, findingOf, legend, legendTitle, legendKind.*, legendText.* · commity 19cf28ea, e530019b, 59a8eed0 · seznam nálezů osoby z buněk Nálezy a Nejvyšší úroveň: commit 75de3a9b (T54 F5) -->

<a id="A6.7.6"></a>
### A6.7.6 Filtr, hledání a řazení

Filtr vybere řádky, hledání je zúží dál, řazení určí pořadí.

- **Čipy** tabulky osob (svazky čipy nemají, události a prameny mají vlastní, [A6.7.10](#A6.7.10), [A6.7.11](#A6.7.11)): **Žijící**, **Zemřelí** (vylučují se), **Pokrevní příbuzní**, **Rod** (výběr rodů),
  **Generace** (rozsah), **Víc svazků**, **Bez data narození**, **Nejisté datum** (narození nebo úmrtí),
  **Bez pramene**, **S nálezem** (chyba nebo k ověření; stopa ne), **Neobvyklé**, **Nepotvrzené z výzkumu**
  (jen strom z výzkumu). Čipy nálezů čekají na kontrolu („Až doběhnou kontroly“). Co se nevejde, je v **Další (n)**.
- **Filtr ve sloupci** (**Filtr…** v hlavičce) podle druhu sloupce:
  - hodnoty ze seznamu (pohlaví, stav svazku, úroveň nálezu, rod …);
  - rozsah **od**–**do** (u data **Rok**, u věku, počtu a procent číslo);
  - text: **obsahuje** · **začíná** · **je** · **není** (bez ohledu na velikost písmen a diakritiku; čip „Sloupec =
    hodnota ×“ nebo „Sloupec ≠ hodnota ×“; rychle z nabídky buňky, [A6.7.15](#A6.7.15));
  - u každého **Jen prázdné** · **Jen vyplněné**.
- Platí všechny filtry zároveň. Počet filtrů je na **Filtry (n)**, vše ruší **Zrušit filtry**. Bez řádku:
  „Nic nevyhovuje filtru“.
- **Hledat v tabulce:** od 2 znaků, bez ohledu na velikost písmen a diakritiku, ve viditelných sloupcích i
  v podřádcích svazků; shody jsou zvýrazněné, nad tabulkou je jejich počet.
- **Řazení:** klik na hlavičku řadí vzestupně, další klik sestupně, třetí řazení zruší; řadí se jen podle toho
  sloupce. Shift + klik přidá sloupec jako další klíč (další klik ho otočí, třetí odebere). Šipka ↑ ↓ u hlavičky
  má číslo pořadí klíče. Prázdné hodnoty jsou vždy na konci, v obou směrech. Čísla v textu se řadí jako čísla.
- **Hranice:** hledání se do pohledu neukládá ([A6.7.7](#A6.7.7)).
- **Od aplikace 3.30.0:**
  - vyloučení se sčítají: každé **Bez „{hodnota}“** z nabídky buňky ([A6.7.15](#A6.7.15)) je samostatný štítek
    „{Sloupec} ≠ {hodnota} ×“ vedle hlavního filtru sloupce, ve stejném i jiném sloupci. × zruší jen svůj štítek,
    **Zrušit filtry** všechny. Formulář štítku upravuje jen ten štítek, formulář v hlavičce hlavní filtr sloupce;
  - druhé **Jen „{hodnota}“** ve sloupci hodnotu přidá: „Otec = A nebo B“ (od čtyř hodnot „A, B +2“), řádek projde
    s kteroukoli z nich. **Bez** takové hodnoty ji zase odebere (s poslední se z ní stane vyloučení), **Jen**
    vyloučené hodnoty vyloučení zruší. Ve sloupci s hodnotami ze seznamu se vybrané hodnoty sčítají a ubírají stejně;
  - štítek „= …“ (a hlavička sloupce, dokud je jeho filtr **je**) má místo textového pole hodnoty sloupce
    k zaškrtnutí: nahoře zaškrtnuté, pod nimi ostatní v pořadí sloupce, každá jednou (stejná osoba, jinak stejný
    text bez ohledu na velikost písmen a diakritiku). Zaškrtnutá hodnota přibude, odškrtnutá zmizí a s poslední
    zmizí štítek. **obsahuje**, **začíná** nebo **není** vrátí textové pole s první zaškrtnutou hodnotou. Na telefonu
    mají řádky seznamu 48 px;
  - osoba, jejíž jméno ve stromu ukazuje i jiná osoba, má ve štítku, v seznamu hodnot a v souhrnu filtrů rok
    narození: „Jan Horák (nar. 1850)“. Ostatní hodnoty jsou beze změny;
  - pohled si štítky uloží ([A6.7.7](#A6.7.7)), pohled uložený dřív se otevře beze změny a verze dat zůstává.
    Starší aplikace použije všechna vyloučení a z „A nebo B“ jen první hodnotu;
  - hodně štítků se zkrátí „…“, **Zrušit filtry** zůstane v řádku.

<!-- zdroj: app:src/ui/table-view/table-filter.ts CHIP_ORDER, setChip (Žijící × Zemřelí), personPassesChip (finding: chyba nebo k ověření; unusual; unconfirmed jen researchTree, relN/relB/relD), CHECK_CHIPS, rodChoices, generationSpan, filterKindOf, cellPasses, foldText · table-filterbar.ts SEARCH_DELAY_MS, columnFilterForm, chipChoiceForm · table-state.ts řazení (vzestupně → sestupně → vypnuto; Shift přidá, otočí, odebere; prázdné na konci; Intl.Collator numeric) · strings.ts table.chip.*, chipRod, chipGen, moreN, filters, clearFilters, search, matches, noMatch, checksWait, matchContains, matchStarts, rangeFrom, rangeTo, rangeYears, onlyEmpty, onlyFilled · commity dd1d74bc, e64b8b06, fc746037 · je / není: strings.ts table.matchEquals, matchNotEquals (commit 05d9a9ab, T54 F4) · 3.30.0: app:ec39d469 table-filter.ts isExclusionItem, addWithoutFilter, addOnlyFilter (or, picked), removeColumnItemAt, mainItemIndex, setColumnFilter(at), equalValues · strings.ts joinOr (od 4 hodnot „A, B +2“), table.filterOr · app:8891a860 table-filter.ts columnEqualValues, equalChoices, equalsOf, equalValueLabel, namesakes, table.nameBorn (nar.), table-filterbar.ts (.tv-ff-values, 48 px na telefonu) · CHANGELOG.cs.md 3.30.0 „Filtry Tabulky“ · spec 103 K1.1–K1.5 · dirigent:test/vysledek-1116-app-103-tabulka.md, vysledek-1116-app-103-odkazy-083-razeni.md -->

<a id="A6.7.7"></a>
### A6.7.7 Pohledy tabulky

Pohled je uložené nastavení tabulky pod jménem. Vestavěné pohledy jsou hotová čtení stromu; vlastní pohled si
uloží člověk.

| Vestavěný pohled | Řádky | Co ukazuje |
|---|---|---|
| **Přehled** (výchozí pro osoby) | osoby | jméno, datum a místo narození, datum úmrtí, věk při úmrtí, partner, datum sňatku a věk při něm, nálezy, úplnost celkem; řazeno podle data narození |
| **Narození a rodiče** | osoby | narození a křest, rodiče, jejich věk při narození, úplnost narození; řazeno podle data narození |
| **Sňatky** (výchozí pro svazky) | svazky | pár, datum a místo sňatku, věk a zapsaný věk obou, stav, svědci, rozvod, děti, délka, prameny, úplnost; řazeno podle data sňatku |
| **Úmrtí** | osoby | úmrtí, příčina, pohřeb, věk a zapsaný věk při úmrtí, úplnost úmrtí; čip **Zemřelí**; řazeno podle data úmrtí |
| **Prameny a citace** | osoby | počet pramenů, doložení, spolehlivost narození a úmrtí; od nejméně pramenů |
| **Mezery** | osoby | úplnost celkem i po částech, narození, rodiče, prameny; od nejméně úplných; svazky sbalené |
| **Kontroly** | osoby | úroveň a počet nálezů, data, věk rodičů, sňatek; čip **S nálezem**; od nejvyšší úrovně, pak počtu nálezů |
| **Všechny události** (výchozí pro události) | události | typ, osoba nebo pár, datum, místo, věk při události, kmotři, svědci, oddávající, pramen; řazeno podle data |
| **Všechny prameny** (výchozí pro prameny) | prameny | titul, archiv, kniha a signatura, online, osob, údajů, přečteno výzkumem, přepis; řazeno podle titulu |

- **Pohled ukládá:** typ řádků, sloupce (pořadí, šířky, ukotvení, sbalené skupiny), řádek pokrytí, filtr, řazení
  a rozbalení svazků; od aplikace 3.30.0 i rozsah ([A6.7.19](#A6.7.19)) a seskupení řádků se sbalenými
  skupinami řádků ([A6.7.20](#A6.7.20)), u pramenů ne. Neukládá hledání, výběr řádku ani posun.
- Změněný pohled má štítek **změněno** a volby **Uložit**, **Uložit jako nový**, **Zahodit změny**. Vestavěný
  pohled se nemění ani nejde přejmenovat či smazat; jeho změny jdou jen **Uložit jako nový**. Vlastní pohled:
  **Přejmenovat…**, **Smazat** (s potvrzením). Vlastní pohledy jsou seřazené podle jména.
- Rozpracovaný stav tabulky si aplikace pamatuje pro každý strom na tomto zařízení; po obnovení stránky nebo
  aktualizaci aplikace je tabulka, jak zůstala. Patří k němu neuložené změny každého pohledu, i toho, ze kterého se
  přepnulo: po návratu má pohled dál štítek **změněno**. **Uložit**, **Uložit jako nový** a **Zahodit změny** je
  vyřídí. Poškozená část rozpracovaného stavu se vynechá.
- **Uložené pohledy jsou součástí stromu** (verze dat 17): uložení, přejmenování i smazání má krok zpět a zápis
  v historii změn. Jdou se stromem do zálohy (JSON) a při oddělení části stromu i do nového stromu.
  GEDCOM je nenese; strom z výzkumu si je při načtení nové verze ponechá. Poškozený pohled se při načtení vynechá.
- **Hranice:** starší aplikace (od 3.19.0) otevře strom uložený aplikací 3.27.0 jen ke čtení a nikdy ho
  neuloží; po aktualizaci aplikace jde strom zase měnit.
- **Ovládání:** nabídka **Pohled** v liště tabulky (**Vestavěné**, **Vlastní**, **Uložit jako nový…**,
  **Přejmenovat…**, **Smazat**).

<!-- zdroj: app:src/ui/table-view/table-views.ts BUILTIN_VIEWS (9: overview, births, marriages, deaths, sources, gaps, checks, events, allSources), defaultViewId (události → Všechny události, prameny → Všechny prameny), defaultViewId, viewFromState, viewChanged, uniqueViewName, customViews (podle jména), workStorageKey strom.table.{treeId}, readTableWork, writeTableWork · table-columns.ts výchozí sloupce pohledů (:683 Sňatky, DEFAULT_VIEWS.events, .sources) · src/table-views-data.ts sanitizeTableView, keepTableViews (verze z výzkumu ponechá pohledy) · src/data.ts:298 sanitizeTableViews při načtení, :1720 saveTableView, deleteTableView (krok zpět, historie změn) · src/subtree.ts:148 · src/types.ts STROM_DATA_VERSION 17, StromData.tableViews · src/tree-manager.ts:630 isTreeNewer, src/data.ts:649 isNewerData (jen ke čtení, od aplikace 3.19.0) · src/ui/research-ui.ts, conflict-decide-ui.ts keepTableViews · strings.ts table.view, views.*, viewName.* (events, allSources), changed, save, saveAs, discard, builtinNote, saveAsMenu, renameMenu, deleteMenu, builtinLocked, viewWhat, deleteConfirm · commity d19a5942, c2d48747, 8ca649ff · neuložené změny všech pohledů v pracovním stavu (localStorage) se sanitizací: commit b1cbe546 (T54 G9, varianta c) -->

<a id="A6.7.8"></a>
### A6.7.8 Akce u řádku a úpravy

Klik vybere řádek (i podřádek svazku); šipky, Page Up/Down a Ctrl+Home/End výběr posouvají, Esc ho zruší.

| Akce | Co udělá |
|---|---|
| **Ukázat ve stromu** | přepne na pohled Rodina s osobou jako ústřední osobou, vystředěnou a zvýrazněnou |
| **Otevřít osobu** (Enter) | otevře stránku osoby |
| **Upravit…** (dvojklik) | otevře úpravu osoby; u podřádku svazku a v tabulce svazků vztahy osoby na tom svazku |

- V tabulce svazků se akce týkají osoby **Partner 1**.
- V tabulce událostí se týkají první osoby řádku a **Upravit…** otevře úpravu té události ([A6.7.10](#A6.7.10)); v tabulce
  pramenů je **Otevřít pramen** ([A6.7.11](#A6.7.11)).
- Po úpravě oznámení „Uloženo: …“, řádek krátce blikne a řádky zůstanou v pořadí. Řádek, který už filtru
  nevyhovuje, zůstane se štítkem „nevyhovuje filtru“ do další změny řazení, filtru nebo pohledu. Změnu z výzkumu
  ohlásí „Výzkum změnil 3 údaje: …“.
- Jeden údaj jde upravit i přímo v buňce ([A6.7.15](#A6.7.15)).
- **Od aplikace 3.30.0:** nabídka řádku (a panel řádku na telefonu) má **Přidat do seznamu ›** pro osoby řádku, výběr
  přes více řádků **Přidat N osob do seznamu ›**; v rozsahu pevného seznamu i **Odebrat ze seznamu**
  ([A11.5](A11-lists-of-people.md#A11.5), [A6.7.19](#A6.7.19)).
- **Hranice:** ve stromu jen ke čtení **Upravit…** není, ani **Přidat do seznamu ›**.
- **Ovládání:** tlačítka ⌖ ▤ ✎ na konci řádku, nad žádným textem buňky: u myši se ukážou, až ukazatel stál na
  řádku mimo ně, u vybraného řádku i s ukazatelem jinde; nabídka řádku (pravé tlačítko; i rozbalení svazků).
  Klepnutí prstem na řádek (telefon, úzké okno, zařízení ovládané hlavně dotykem) otevře panel s akcemi a se svazky („Svazek 1: … ·
  Upravit ›“).
- **Od aplikace 3.28.0:** klik myší nebo perem jen vybere řádek a buňku na každém zařízení, i na notebooku
  s dotykovou obrazovkou, na tabletu s myší a v úzkém okně; rozhoduje ukazatel kliku, ne zařízení. Do 3.27.0
  otevíral na dotykovém zařízení a v úzkém okně panel řádku každý klik. Akce řádku stojí na jeho konci, takže
  sloupec osob má na vybraném řádku celou šířku.

<!-- zdroj: app:src/ui/table-view/table-ui.ts tableMethods (tableRowAction: tree → Rodina, focus, highlight; open; edit → dialog osoby / panel vztahů na svazku), personOfRow (Partner 1), keepWork · table-refresh.ts keepOrder, watchEdit, changedKeys, bridgeChanges, namesList · table-grid.ts FLASH_MS · strings.ts table.act.*, dblClickHint, actionsOf, unionWith, editMore, staleRow, savedToast, bridgeToast · commity da6b9786, de46ae30, e4a35406 · od 3.28.0: table-grid.ts clickPointerType, isMouseLikePointer, table-ui.ts onRowClick (panel jen klepnutí a isPhoneBar | isCoarsePointer), commit ee38c7a6; rowActions ⌖ ▤ ✎ v .tv-acts-dock, armRowActions (myš a pero), commit 80c2ffb9 -->

<a id="A6.7.9"></a>
### A6.7.9 Export CSV a XLSX

Export uloží tabulku, jak je vidět, do souboru pro tabulkové programy: **CSV** nebo **XLSX** (sešit Excelu).

- **Co jde ven:** viditelné sloupce v pořadí tabulky (sloupce sbalené skupiny celé) a řádky po filtru, hledání a
  řazení. Hodnoty jsou, jak je tabulka píše: data v zápisu aplikace, „cca …“, „≈ 67“, „křt. …“, „–“.
- **Řádky:** bez filtru a hledání jdou ven všechny řádky („Vše zobrazené · 120 osob“). S filtrem nebo hledáním je
  na výběr:
  - **Zobrazené** (výchozí): jen řádky, které tabulka ukazuje, s počtem a připomínkou filtru („Zobrazené · 28 z 866
    osob (platí filtr: …)“);
  - **Všechny … bez filtru** („Všechny osoby bez filtru · 866“): všechny řádky toho typu v pořadí podle řazení, bez
    filtru i hledání.

  Řádek se štítkem „nevyhovuje filtru“ ([A6.7.8](#A6.7.8)) do zobrazených nepatří.
- Osoba se dvěma a více svazky: první svazek, který vyhoví filtru, je v jejím řádku, každý další v pokračovacím
  řádku s prázdnými údaji osoby. Za jménem je sloupec **Svazek** („1 z 3“).
- **CSV:** text, UTF-8 se značkou BOM, oddělovač středník, konce řádků CRLF; buňka, která by se v tabulkovém programu
  spustila jako vzorec, se zneškodní. Značky nálezů a barvy se nevyvážejí.
- **XLSX:** jeden list pojmenovaný podle pohledu.
  - Řádek 1 jsou skupiny sloupců (sloučené buňky), řádek 2 záhlaví, řádek 3 řádek pokrytí ([A6.7.4](#A6.7.4)).
    Ukotvené sloupce tabulky a tyto tři řádky jsou v listu ukotvené.
  - Každá skupina sloupců je osnova: jde sbalit, její první sloupec zůstane. Pokračovací řádky svazků jsou o úroveň
    níž pod řádkem osoby (úroveň 2 osnovy řádků).
  - Buňka s nálezem **chyba** nebo **k ověření** je podbarvená a nálezy má v komentáři. Stopa a neobvyklé barvu
    ani komentář nemají.
  - Počty, věky v celých letech a úplnost jsou čísla (úplnost a pokrytí jako procento); ostatní je text, jak ho píše
    tabulka (i „≈ 67“, „28–29“, data). Text se nikdy nestane vzorcem. Odkaz pramene je v buňce jako odkaz.
- **Od aplikace 3.30.0:** v rozsahu seznamu osob jsou první sloupce **#** a u pracovního seznamu **Hotovo** (✓)
  ([A6.7.19](#A6.7.19)); seskupená tabulka má před nimi sloupec **Skupina** ([A6.7.20](#A6.7.20)).
- **Soubor:** `{strom}_{pohled}_{RRRR-MM-DD}.csv` nebo `.xlsx`, bez diakritiky.
- **Ovládání:** **Export ▾** v liště tabulky (na telefonu v **⋯**): **Formát** „CSV · pro Excel a Tabulky Google“ nebo
  „XLSX · skupiny, ukotvení, barvy kontrol“, **Řádky**, **Stáhnout CSV** / **Stáhnout XLSX**; oznámení „Staženo: …“
  s počtem osob, řádků a sloupců.
- **Hranice:** export z menu stromu (**Tabulka osob (CSV)**, [A7](A7-book-pages-and-export.md)) je jiný soubor
  s pevnými sloupci.
- **Platí od:** aplikace 3.27.0

<!-- zdroj: app:src/ui/table-view/table-export.ts tableCsvField (neutralizace vzorců), buildExportTable, buildTableCsv (BOM, ;, CRLF, pokračovací řádky, sloupec Svazek), fileNamePart, tableCsvFileName (csv | xlsx) · table-xlsx.ts buildTableXlsx (řádky 1–3, merges, outline sloupců za ukotvenou částí, pokračovací řádky outline 1, freeze, errorFill/warningFill + findingsComment jen chyba a k ověření, href), xlsxNumber (COUNT_COLUMNS, věk ^\d+$, procento) · src/xlsx.ts (ignoredErrors numberStoredAsText, styl @ pro text) · table-viewbar.ts exportForm (Formát, Řádky: Zobrazené / Všechny bez filtru jen s filtrem nebo hledáním) · table-ui.ts tableExportNow (unfiltered: všechny řádky typu v řazení, stale ven) · strings.ts table.export, exportFormat, exportRows, exportCsv, exportXlsx, exportAll, exportShown, exportFilterNote, exportUnfiltered.*, exportWhat.*, exportWhatAll.*, exportFile, exportDownload, exportDownloadXlsx, csvUnionCol, csvUnionOf, exportedToast · commity 2368683b, 5a67797b, 4308633b, e0ce4ec2, ebc1542f, e5b97725 · dirigent:prace/1110-app-tabulka-p2, 1110-app-tabulka-opravy -->

<a id="A6.7.10"></a>
### A6.7.10 Události v řádcích

Tabulka událostí má řádek na každou událost stromu: kdo, kdy, kde, v jakém věku a kdo byl u toho.

- **Co je řádek:**
  - každá událost osoby (křest, povolání, bydliště, vojsko …) a každá událost páru;
  - narození a úmrtí z údajů osoby, když je u nich něco zapsané (datum, místo, adresa, pramen; u úmrtí i příčina
    nebo věk);
  - sňatek svazku: u manželství vždy, u jiného vztahu („Začátek vztahu“) jen se zapsaným údajem; rozvod („Konec
    vztahu“), když je svazek rozvedený nebo je zapsaný jeho konec.
- **Sdílená událost** (bydliště, sčítání lidu, vojsko, vystěhování, přistěhování, naturalizace, vlastní událost) zapsaná u více osob
  stejně je jeden řádek se všemi osobami. Stejně znamená stejný typ, datum, místo, adresu, poznámku a prameny; datum
  musí být zapsané a k němu místo nebo pramen. Křest, povolání nebo titul je vždy jen jedné osoby.
- **Od aplikace 3.28.0:**
  - společná událost ([A10.1](A10-shared-events.md#A10.1)) je jeden řádek se všemi svými osobami, i když se její
    kopie liší. Stejné kopie bez společné události (starší data) se dál spojí do jednoho řádku podle údajů; to je jen
    pohled, úprava jde do jedné kopie;
  - buňka osob má počet („N osob“). Věk ukazuje věk každé osoby („42 · 38“) s bublinou „Věk podle zápisu · každý
    svůj“; liší-li se kopie, buňka má „liší se u N“ ([A10.3](A10-shared-events.md#A10.3));
  - úprava **Datum** nebo **Místo** přímo v buňce změní všechny kopie společné události („{Pole}: změněno u N osob
    ({událost}).“), jeden krok **Zpět**.
- **Sloupce** ve skupinách **Událost** · **Účastníci** · **Pramen**:
  - **Typ**, **Osoba nebo pár** (u páru nejdřív pokrevní příbuzný hlavní osoby), **Datum**, **Místo**;
  - **Věk při události** jako jinde ([A6.7.3](#A6.7.3)); do jednoho roku z přesných dat ve dnech („12 d.“); u více
    osob věk každé v pořadí jmen („–“ neznámý); u narození **Nevztahuje se**;
  - **Údaj**: hodnota události (povolání, titul), jinak příčina; u úmrtí příčina úmrtí;
  - **Kmotři**, **Svědci**, **Oddávající, křtitel**, **Jiní přítomní**: účastníci podle role; osoba stromu je odkaz;
  - **Pramen**: citované prameny „titul, signatura“, více oddělených středníkem; **Spolehlivost** údaje.
- **Čipy:** **Narození a křty** (i narození z údajů osoby), **Sňatky** (i zasnoubení, ohlášky, povolení, smlouva),
  **Úmrtí a pohřby** (i kremace), **Ostatní události**, **Bez pramene**.
- **Filtr podle účastníka:** klik na jméno účastníka nabídne „Filtr: kmotr …“ (u osoby stromu i **Otevřít osobu**).
  Filtr je čip „Kmotr: … ×“ (Svědek, Oddávající, křtitel, Přítomen) a nahradí předchozí filtr účastníka. Osobu stromu
  hledá podle osoby, zapsané jméno podle písmen bez ohledu na velikost, diakritiku a mezery.
  **Od aplikace 3.30.0** začíná nabídka (i list na telefonu a dotykovém zařízení) účastníka, který je osobou stromu,
  položkou **Přejít na {jméno}**: skok na jeho řádek v tabulce osob ([A6.7.16](#A6.7.16)). Jména ve sloupci
  **Osoba nebo pár** zůstávají, jak byla.
- **Kmotr, který se opakuje** ([A5.5](A5-tree-check.md#A5.5)) je v buňce účastníka jako **stopa**.
- **Ovládání:** vestavěný pohled **Všechny události**; akce u řádku ([A6.7.8](#A6.7.8)) se týkají první osoby řádku.
  **Upravit…** otevře u události osoby úpravu osoby na té události (u sdílené na první kopii), u narození a úmrtí
  úpravu osoby, u události páru její dialog, u sňatku a rozvodu vztahy osoby na tom svazku.
- **Hranice:** zástupné osoby řádky nemají; narození a úmrtí bez zapsaného údaje řádek nemají.
- **Platí od:** aplikace 3.27.0; 3.28.0: sčítání lidu u osoby je sdílená událost, společná událost je jeden řádek;
  3.30.0: **Přejít na …** v nabídce účastníka

<!-- zdroj: app:src/ui/table-view/table-events.ts buildEventRows (narození/úmrtí jen se zapsaným údajem, weddingRow: manželství vždy kromě marriageUnrecorded, partnersStart jen se zápisem; divorceRow), SHARED_TYPES (od 3.28.0 i census, app:34b2174c), shareKey (typ, vlastní název, datum, místo, adresa, poznámka, prameny; datum a místo nebo pramen), mergeParticipants, eventEditTarget, MARRIAGE_COUPLE_TYPES · table-columns.ts EVENT_COLUMNS, eventPersons (pokrevní první), eventAgeCell, eventAge (dny < 366), eventValueCell, eventSourceCell, eventPill, DEFAULT_VIEWS.events · table-filter.ts EVENT_CHIP_ORDER, EVENT_KIND_CHIPS, lifeCategory, participantChip, eventHasParticipant (foldName), setParticipantFilter · table-ui.ts tableNameAction, tableRowAction (event → editTableEvent) · table-checks.ts PARTICIPANT_ROLE, recurring (recurringGodparent v buňkách účastníků) · 3.28.0: app:80c2ffb9 table-events.ts (shareId → jeden řádek, bez shareId odhad podle shareKey), strings.ts table agePerPerson, sharedDiffers, events.sharedCellChanged · strings.ts table.rows.events, group.event, participants, source, col.ev*, godparents, witnesses, officiants, others, chip.ev*, chipParticipant.*, filterParticipant.*, evKind.*, ageDays, viewName.events · commity 8de751c2, 63ed9def · spec 073 §14.1 · dirigent:prace/1110-app-tabulka-p2 · 3.30.0: app:0b833e3d table-ui.ts tableNameAction (goTo první, i v listu isPhoneBar | isCoarsePointer; jména Osoba nebo pár beze změny), strings.ts table.link.goTo · spec 103 rozhodnutí D6 c -->

<a id="A6.7.11"></a>
### A6.7.11 Prameny v řádcích

Tabulka pramenů má řádek na každý pramen stromu (**Akce → Prameny**, [A3.1](A3-evidence-in-the-app.md#A3.1)) a říká,
kolik toho pramen ve stromu dokládá.

- **Sloupce** ve skupinách **Pramen** · **Použití**:
  - **Titul**, **Archiv**, **Signatura**, **Folium/strana**, **Snímek**, **Další umístění** ([A3.9](A3-evidence-in-the-app.md#A3.9)),
    **Online** (adresa pramene, jinak stránka jeho prvního výpisu,
    bez `https://`; webová adresa je odkaz ↗ do nového okna, jen http a https, zapsaná bez schématu („www.…“) se
    otevře přes https; klik na odkaz výběr řádku nezmění);
  - **Osob**: kolik osob má údaj, který pramen cituje; údaj svazku dokládá oba partnery;
  - **Údajů**: kolik údajů pramen cituje. Údaj je jeden seznam citací: citace osoby, narození, úmrtí, každá událost
    osoby, sňatek, rozvod a každá událost páru;
  - **Přečteno výzkumem**: kolik čtenářů přepis četlo („1 čtenář“, „2 čtenáři“: člověk v aplikaci a výzkum), jinak „ne“;
  - **Přepis**: ano / ne; v katalogu sloupců je i **Datum záznamu**.
- Výchozí sloupce: **Titul**, **Archiv**, **Signatura**, **Folium/strana**, **Snímek**, **Další umístění**, **Online**,
  **Osob**, **Údajů**. **Přečteno výzkumem** a **Přepis** jsou jen v panelu **Sloupce**.
- Starší pramen má celé umístění v **Další umístění** a nové buňky prázdné. **Signatura**, **Folium/strana** a
  **Snímek** se řadí přirozeně (9 před 10, 57–58 za 34), prázdné na konci v obou směrech; filtrují se jako text.
- Nad tabulkou může stát nabídka **Rozdělit podle návrhu…** ([A3.9.1](A3-evidence-in-the-app.md#A3.9.1)).
- Citace zástupných osob a pramenů příběhu se nepočítají.
- **Čipy:** **Bez osoby** (žádná osoba ho necituje), **Nepřečteno**, **S přepisem**, **Online** (stejně jako sloupec
  **Online**, i s adresou bez `https://`).
- **Ovládání:** vestavěný pohled **Všechny prameny**. U řádku **Otevřít pramen** a **Upravit…**; **Ukázat ve stromu**
  tu není.
  - **Otevřít pramen** otevře prohlížeč pramene (výřezy, citace; v něm **Upravit**, když jde strom měnit).
  - **Upravit…** (i dvojklik, na telefonu **Upravit…** v panelu řádku) otevře rovnou úpravu pramene, stejnou jako ve
    správě pramenů.
  - Po zavření je tabulka, jak byla: výběr, posun i aktivní buňka. Správa pramenů (**Akce → Prameny**) se otevírá
    dál z menu.
  - Do aplikace 3.29.0 otevíralo **Otevřít pramen** i **Upravit…** správce pramenů na tom pramenu.
- **Hranice:** ve stromu jen ke čtení (i zamčeném) se pramen jen ukáže, bez úprav.
- **Platí od:** aplikace 3.27.0; **Signatura**, **Folium/strana**, **Snímek** a **Další umístění** (dřív **Kniha,
  signatura, folio**) také 3.27.0; prohlížeč pramene a úprava rovnou 3.30.0

<!-- zdroj: app:a97de984 table-columns.ts:898-901 srcSig/srcFolio/srcImageNo, :1026 DEFAULT_VIEWS.sources, přirozené řazení · 8dd21adf table-bar.ts nabídka rozdělení · app:src/ui/table-view/table-sources.ts sourceUsage (PERSON_CITATION_FIELDS, události, PARTNERSHIP_CITATION_FIELDS pro oba partnery, bez zástupných, ne příběh), buildSourceRows (katalog data.sources), sourceReaders (readBy user/research/both) · table-columns.ts SOURCE_COLUMNS, urlCell, shortUrl, readersCell, DEFAULT_VIEWS.sources · table-filter.ts SOURCE_CHIP_ORDER (srcNoPerson persons 0, srcUnread, srcTranscript, srcOnline safeHttpUrl) · table-grid.ts rowTail (source: open + edit) · table-ui.ts tableRowAction (source → openTableSource), openTableSourceId (zamčený strom → showSourceViewer readOnly; od 3.30.0 app:05e24806: bez edit → showSourceViewer, s edit → showEditSourceModal, jen ke čtení → prohlížeč, focusTableAfterSource) · strings.ts table.rows.sources, group.source, group.use, col.src*, chip.src*, readers, act.openSource, viewName.allSources, sources.readBy.* · commity 1a3a49f1, 3cf69ffa · spec 073 §14.2 · dirigent:prace/1110-app-tabulka-p2 · odkaz a čip Online: safeWebUrl (http/https, www. → https, rel noopener noreferrer), commit 7e648e24 (T54 F10, F11) -->

<a id="A6.7.12"></a>
### A6.7.12 Citace a kmotři v tabulce osob

Tabulka osob má sloupce, které ukážou, z jakého pramene je narození, sňatek a úmrtí, a kdo byl kmotrem.

- **Citace** (skupina **Prameny**): **Narození: archiv**, **Narození: signatura**, **Narození: folium/strana**,
  **Narození: snímek**, **Narození: další umístění**, **Narození: URL** a totéž pro **Sňatek** a **Úmrtí**, v tomto
  pořadí; výchozí nejsou. Buňka ukáže hodnotu prvního citovaného pramene; další prameny jsou v tlačítku „+N“. Starší
  pramen má celé umístění v **… další umístění**. Bublina **Další citace**, list řádku pramene na telefonu a sloupec
  pramene v tabulce událostí uvádějí i signaturu, folium a snímek. Webová adresa ve sloupci **… URL** je odkaz do nového okna, jako ve sloupci **Online**
  ([A6.7.11](#A6.7.11)).
  - Narození bere citace narození, pak událostí narození a křtu; úmrtí citace úmrtí, pak událostí úmrtí, pohřbu a
    kremace; sňatek citace svazku (u podřádku svazku toho svazku). Každý pramen jednou.
  - Prameny z původu údaje ve výzkumu se nepočítají, jen citace v datech.
  - U žijící osoby mají sloupce úmrtí **Nevztahuje se**.
  - Řadí a filtruje se podle prvního pramene.
- **Od aplikace 3.27.0:** sloupce signatury, folia/strany, snímku a dalšího umístění (**… signatura** dřív ukazovala
  celé umístění).
- **Kmotři** (skupina **Narození a křest**): kmotři událostí narození a křtu, každý jednou; osoba stromu je odkaz.
  Kmotr, který se opakuje ([A5.5](A5-tree-check.md#A5.5)), má v buňce značku **stopa**.
- **Ovládání:** sloupce se zapínají po jednom v panelu **Sloupce** ([A6.7.2](#A6.7.2)). Klik na „+N“ otevře bublinu
  **Další citace** (na telefonu panel zdola); klik na pramen v ní otevře prohlížeč pramene (v něm **Upravit**), do
  aplikace 3.29.0 správce pramenů. Po zavření je tabulka, jak byla.
- **Platí od:** aplikace 3.27.0; prohlížeč pramene 3.30.0

<!-- zdroj: app:src/ui/table-view/table-sources.ts factCitations (narození: birthSourceIds + birth/baptism; úmrtí: deathSourceIds + death/burial/cremation; sňatek: sourceIds svazku; neznámé id ven, každý jednou) · table-columns.ts citeCell (první pramen, moreSources), bArch…dUrl (group sources, unionScoped, deathOnly → naCell), godparentsCell (group birth), personGodparents · table-checks.ts personRecurring (sloupec godparents) · table-grid.ts moreCitesHtml · table-ui.ts showTableCites, openTableSourceId (od 3.30.0 prohlížeč pramene, app:05e24806) · strings.ts table.col.bArch…dUrl (bUrl „Narození: URL“, commit 7e648e24, T54 F10); 3.27.0: a97de984 bSig/bFolio/bImage/bRef…dRef, table-bubble.ts, table-events source text, godparents, moreCites, citesTitle · commity 208d8b92, 21a132c1 · spec 073 §14.3, §14.5 · dirigent:prace/1110-app-tabulka-p2 (citace: jen citace v datech, ne FactReliability.sourceIds) -->

<a id="A6.7.13"></a>
### A6.7.13 Značky v buňkách

Přehled všeho, čím tabulka označí buňku nebo řádek. Legenda **Značky ⓘ** vpravo nad tabulkou (bublina „Značky
v buňkách“, na telefonu panel zdola) ukazuje první dvě tabulky: čtyři úrovně nálezu a pět druhů hodnoty; ve stromu
z výzkumu i třetí, značky výzkumu.

**Nálezy kontroly** ([A6.7.5](#A6.7.5)). Značka stojí na konci buňky za hodnotou; klik na buňku s nálezem otevře
bublinu nálezu.

| Značka | Jak vypadá | Co znamená (legenda) | Kde se objeví |
|---|---|---|---|
| **chyba** | plné červené kolečko s bílým „!“; buňka podbarvená do červena | „Údaje si odporují.“ | buňka údaje, kterého se nález týká; **Nálezy**, **Nejvyšší úroveň**; sbalená skupina |
| **k ověření** | plný jantarový čtvereček se zaoblenými rohy a „?“; buňka podbarvená do jantarova | „Neobvyklá hodnota, stojí za ověření.“ | jako chyba |
| **stopa** | malý prázdný šedý kroužek; buňka bez podbarvení | „Stopa pro pátrání, není to chyba.“ | jako chyba; kmotr, který se opakuje ([A6.7.10](#A6.7.10), [A6.7.12](#A6.7.12)) |
| **neobvyklé** | šedá prázdná hvězdička „☆“; buňka bez podbarvení | „Nález označený „Není chyba“.“ | buňka údaje; **Neobvyklé, ověřené**; **Nejvyšší úroveň**, když jsou všechny nálezy osoby označené |

- Kolečko a čtverec se liší tvarem i znakem, nejen barvou. Čtečka obrazovky značku přečte jako úroveň a text nálezu.
- **Nálezy** má značku nejvyšší úrovně za počtem; **Nejvyšší úroveň** ji má před slovem. Osoba bez nálezu má ve
  sloupci **Nálezy** bledou „0“.
- Sbalená skupina sloupců (úzký pruh) ukazuje nejvyšší značku ze svých buněk.

**Druhy hodnoty.** Žádná z nich není nález.

| Značka | Jak vypadá | Co znamená (legenda) | Kde se objeví |
|---|---|---|---|
| **nejisté datum** | datum podtržené tečkami; slovo **cca**, **před** nebo **po** menším šedým písmem před datem | „Cca, před, po nebo rozsah; není to nález.“ | sloupce dat ([A6.7.3](#A6.7.3)) |
| **spolehlivost** | šedý název stupně (v legendě **Potvrzeno**): **Potvrzeno**, **Doloženo**, **Pravděpodobné**, **Možné**, **Z rodokmenu**, **Vodítko**, **Bez pramene** | „Ve sloupcích Spolehlivost a výzkum; u svazků ve skupině Sňatek, u událostí ve skupině Pramen.“ | **Spolehlivost jména**, **narození**, **úmrtí**, **sňatku** (osoby, svazky), **Spolehlivost** (události); stupně: [S7.1](S7-reliability-and-verification.md#S7.1) |
| **náhradní hodnota** | zkratka **křt.** nebo **pohř.** v malém rámečku před hodnotou, hodnota kurzívou; nápověda „Křest, narození neznámé“, „Pohřeb, úmrtí neznámé“ | „Křest místo narození, pohřeb místo úmrtí.“ | datum a místo narození a úmrtí ([A6.7.3](#A6.7.3)) |
| **dopočteno** | šedé písmo; „≈ 67“ odhad, „28–29“ rozsah | „Rozsah z nepřesného data, ≈ z odhadu.“ | věky, rozdíl zapsaného věku, délka svazku, počty, generace, úplnost; u hlavičky „Vypočteno z: …“ |
| **nevztahuje se** | „–“ šedou kurzívou, v legendě stejně; nápověda „Nevztahuje se“ | „Údaj se osoby netýká.“ | úmrtí u žijící osoby (u **Úplnost úmrtí** „žije“), věk otce nebo matky bez zapsaného rodiče, sloupce svazku u osoby bez svazku, buňky sňatku u svazku bez sňatku (nápověda „Nevztahuje se: svazek bez sňatku“, [A6.7.4](#A6.7.4)), **Věk při události** u narození |

- Ve sloupcích **Spolehlivost …** se řadí od **Potvrzeno** po **Bez pramene** v pořadí z tabulky.

**Značky výzkumu** ([A6.7.14](#A6.7.14)), jen ve stromu z výzkumu. Kolečko výzkumu má kolem sebe lem, takže se i bez
barvy liší od kolečka chyby (bez lemu) a čtverečku k ověření. Legenda dodá: „Kruh s lemem znamená výzkum. ! a ?
výzkumu jsou jen ve sloupcích Výzkum, na údaji smí být jen ≠.“

| Značka | Jak vypadá | Co znamená (legenda) | Kde se objeví |
|---|---|---|---|
| **čeká** | plné jantarové kolečko s lemem a „!“ | „Výzkum čeká na rozhodnutí.“ | **Výzkum**, **Čeká na rozhodnutí** |
| **čeká zvenku** | prázdný jantarový kroužek s „!“ | „Čeká se na odpověď zvenku (dopis, archiv), rozhodovat není co.“ | **Výzkum**, **Čeká na rozhodnutí** |
| **rozpor** | plné jantarové kolečko s lemem a „≠“ | „Prameny se neshodují. Není to chyba v datech: rozhoduje se, kterému prameni věřit.“ | před hodnotou v buňce údaje (bez podbarvení, klik otevře rozpory); **Výzkum**, **Rozpory** |
| **otázka** | plné jantarové kolečko s lemem a „?“ | „Otevřená otázka nebo hypotéza.“ | **Výzkum**, **Hypotézy** |
| **agent** | otáčející se oblouk (při omezeném pohybu stojí) | „Agent u osoby právě pracuje (jen při sledování).“ | **Výzkum**, **Agent**; u jména osoby svislý pruh 3 px |
| **hotovo** | „✓“ | „Agent práci dokončil (na 4 s).“ | za jménem, **Agent** |

- Ve sloupci **Výzkum** je u osoby ve frontě agenta šedá tečka „·“ s „ve frontě“; „+2“ za značkou jsou další druhy
  signálu. Nové od výzkumu má ve svém sloupci tečku „•“.
- Sloupec, který má hodnotu jen při sledování výzkumu, má bez sledování „–“ se štítkem „živě“ (nápověda „Jen při
  sledování výzkumu“). Od aplikace 3.27.0 jen tehdy, když neodpovídá ani most výzkumu ([A6.7.14](#A6.7.14)).

**Další značky** (legenda je neukazuje):

| Značka | Jak vypadá | Co znamená | Kde se objeví |
|---|---|---|---|
| „…“ | bledé tři tečky; nápověda „Kontroly se počítají…“ | kontrola stromu ještě běží | **Nálezy**, **Nejvyšší úroveň**, **Neobvyklé, ověřené** |
| „◌ Kontroly se počítají…“ | prázdný kroužek a text vpravo nad tabulkou | totéž pro celou tabulku; čipy nálezů zatím čekají | nad tabulkou, vedle **Značky ⓘ** |
| procento s proužkem | číslo a krátký proužek, jehož vyplněná část je hodnota | úplnost ([A6.7.4](#A6.7.4)) | sloupce **Úplnost …** |
| tučné číslo, „–“ | v řádku pokrytí | pokrytí pod 50 % (u sloupců úplnosti průměr pod 50 %); „–“ sloupec bez buňky, které by se týkal | **Řádek pokrytí** ([A6.7.4](#A6.7.4)) |
| „+2“ | číslo v oválném rámečku za první citací | další citované prameny; klik otevře **Další citace** | citace narození, sňatku, úmrtí ([A6.7.12](#A6.7.12)) |
| „↗“ | za podtrženou webovou adresou | odkaz do nového okna | **Online**, citace „… URL“ ([A6.7.11](#A6.7.11), [A6.7.12](#A6.7.12)) |
| obrys buňky | tenký obrys 1 px | aktivní buňka ([A6.7.15](#A6.7.15)) | buňka vybraného řádku |
| textový kurzor | při najetí myší | buňka jde upravit na místě ([A6.7.15](#A6.7.15)) | upravitelné buňky |
| ●○, ●● | jedna nebo dvě plné tečky před „1 čtenář“, „2 čtenáři“; nápověda, kdo přepis četl | kolik čtenářů přepis četlo | **Přečteno výzkumem** ([A6.7.11](#A6.7.11)) |
| „12 d.“ | číslo s „d.“ | věk do jednoho roku ve dnech | **Věk při události** ([A6.7.10](#A6.7.10)) |
| ▾, ▸ | trojúhelník před jménem | svazky osoby rozbalené, sbalené ([A6.7.1](#A6.7.1)) | **Celé jméno** osoby se dvěma a více svazky |
| „3 svazky“ | u sbalené osoby v oválném rámečku za jménem; u rozbalené ve sloupci **Partner** šedou kurzívou | počet svazků osoby | řádek osoby |
| „└ Svazek 2 z 3“ | odsazený podřádek | jeden svazek osoby | podřádek svazku |
| „2 svazky mimo filtr · ukázat“ | tlačítko v odsazeném řádku | svazky, které nevyhoví filtru; ukázané jsou znevýrazněné | pod podřádky svazků |
| „nevyhovuje filtru“ | celý řádek bledý, text kurzívou na konci | řádek po úpravě už filtru nevyhovuje ([A6.7.8](#A6.7.8)) | do další změny řazení, filtru nebo pohledu |
| zvýraznění | podbarvené písmo shody | shoda hledání ([A6.7.6](#A6.7.6)) | viditelné sloupce |
| ↑, ↓ (↑1, ↓2) | šipka v hlavičce, s číslem při více klíčích | směr a pořadí klíče řazení ([A6.7.6](#A6.7.6)) | hlavička sloupce |
| −, + | znak u názvu skupiny | sbalit, rozbalit skupinu sloupců ([A6.7.2](#A6.7.2)) | řádek skupin nad hlavičkou |

- **Hranice:** export CSV značky ani barvy nenese; XLSX nese jen podbarvení a komentář u chyby a k ověření ([A6.7.9](#A6.7.9)).
- **Ovládání:** **Značky ⓘ** vpravo nad tabulkou.
- **Platí od:** aplikace 3.27.0

<!-- zdroj: app:src/ui/table-view/table-grid.ts MARK_GLYPH (error „!“, warning „?“, info prázdný, unusual „☆“), markHtml (role img, aria-label úroveň: text), cellClasses (aggregate, na, computed, uncertain, subst, ghost, issue), cellText („–“), cellInner (značka za hodnotou; u čísla vpravo za, jinak před slovem), moreCitesHtml „+N“, cellValueCore (tv-comp proužek 30 px, tv-subst, tv-qual), linkHtml „ ↗“, readersHtml (fs-dots), nameCell (▾/▸, tv-unions-pill unionsN, └ unionKofN, hiddenUnions), sort mark ↑/↓ s číslem, tv-group-toggle −/+ · table-bubble.ts legendHtml (4 značky + uncertain „1890–1892“, reliability ✓, subst křt., computed „≈ 67“, na „–“) · table-bar.ts createStatus (◌ checksRunning, legenda „Značky ⓘ“) · table-columns.ts checksPendingCell („…“ ghost), findingsCell („0“ ghost), topSeverityCell, unusualCell (☆), pillCell + reliabilityText + RELIABILITY_RANK (human, proven, probable, possible, import, lead, none), readersCell (dots [true, n > 1]), naCell (relD, fAge, mAge, unionScoped bez svazku, evAge narození), eventAge (ageDays) · table-subrows.ts aggregate „n svazků“ · table-checks.ts bandSeverity · table-coverage.ts LOW pod 50 % · index.html CSS .tv-mark--error (kolečko 16 px, --danger), --warning (čtverec radius 3px, --warning), --info (kroužek 10 px, okraj --text-faint), --unusual, .tv-cell--error/--warning (danger-soft, warning-soft), --uncertain (dotted), --na (kurzíva), --computed, .tv-subst, .tv-cites-more, .tv-row.is-stale, .tv-stale-note, mark.tv-hit · strings.ts table.legend, legendTitle, legendKind.*, legendText.*, sev.*, subst.*, qual.*, na, living, checksRunning, moreCites, citesTitle, readers, ageDays, unionsN, unionKofN, hiddenUnions, staleRow, col.relN/relB/relD/relW/evRel, reliability.human/proven/import/none, factStatus.probable/possible/lead · app f34d41e1 · Milan 10. 11. (dirigent:prace/1110-doc-tabulka-znacky bod 1) · pořadí stupňů podle RELIABILITY_RANK (Z rodokmenu před Vodítko), dirigent:prace/_drobnosti/doc.md · značky výzkumu: table-grid.ts RESEARCH_GLYPH (wait „!“, ext „!“, conf „≠“, q „?“, agent oblouk, done „✓“, queue „·“, new „•“), researchMarkHtml, conflictMarkHtml (≠ před hodnotou) · index.html .tv-rmark--wait/conf/q (kolečko 16 px, --signal-warn, lem box-shadow), --ext (prázdný kroužek), --agent (agSpin, prefers-reduced-motion), --done, .tv-agent-bar (3 px) · strings.ts table.res.legendName, legendText, legendNote, liveTag, liveOnly · aktivní buňka a kurzor: commity 05d9a9ab, be9ca8cd · spec 073 §16.3, U7 -->

<a id="A6.7.14"></a>
### A6.7.14 Výzkum v tabulce

Ve stromu z výzkumu ([S1](S1-connecting-app-and-research.md)) tabulka ukáže i to, co o osobách ví výzkum: co čeká na
rozhodnutí, rozpory pramenů, hypotézy, práci agenta, linie a výměnu se stromem. Do stromu nic nezapisuje.

- **Sloupce osob** (skupina **Výzkum**, ve výchozím stavu skrytá; zaškrtávátko **vše** zapne **Výzkum**, **Čeká na
  rozhodnutí**, **Rozpory**, **Hypotézy** a **Agent**):

  | Sloupec | Co ukazuje |
  |---|---|
  | **Výzkum** | nejnaléhavější signál osoby v pořadí čeká › rozpor › otázka nebo hypotéza › agent › ve frontě; „+n“ další druhy |
  | **Čeká na rozhodnutí** | počet a první položka; u čekání na jiné „zvenku: …“ (dopis odeslán, dotaz na rodinu …) |
  | **Rozpory** | počet otevřených rozporů a údaje („· narození, …“); „· lze rozhodnout v aplikaci“, kde to jde ([S2](S2-edits-from-the-app.md)) |
  | **Hypotézy** | počet otevřených hypotéz; „rozhodl agent“ |
  | **Úkoly výzkumu** | úkoly osoby ve frontě („2 · nejbližší 3. ve frontě“, „1 · právě běží“) |
  | **Agent** | „pracuje: {úkol}“, „ve frontě“, „hotovo“ |
  | **Linie výzkumu** (do aplikace 3.29.0 **Linie**) | místo osoby mezi liniemi (níže) |
  | **Materiály**, **Strom tu končí**, **Hledáno bez výsledku**, **Výměna s výzkumem**, **Původně v rodokmenu**, **Příběh**, **Kde se vyřizuje**, **Nové od výzkumu**, **Dostupnost pramenů**, **Farnost (výzkum)**, **Odhad narození** | co výzkum ví o materiálech osoby, o kraji stromu, o výměně se stromem, o pramenech a místech |

- **Svazky:** **ID výzkumu** (F…), **Linie výzkumu** (podle partnera z linie), **Agent** („pracuje na páru: …“) a
  **Rozpory** (rozpory ke sňatku a rozvodu u obou partnerů). **Prameny:** **ID výzkumu** (S…) a **Obraz**: „v počítači
  výzkumu“, „sken chybí v počítači výzkumu“ (zvýrazněné), „online (archiv)“.
- **Linie výzkumu:** v linii (partner osoby z linie „· partner“; vedlejší větev přidaná k linii patří do té linie),
  „vedlejší větev: {jméno}“, „ostrov“, „mimo linie“. **Mimo linie** jsou vedlejší větve nepřidané k linii, ostrovy a
  ostatní ([R2.3](R2-lines-and-queue.md#R2.3)). Linie bere tabulka živě z výzkumu, jinak ze souboru výzkumu; řadí se
  v pořadí linií výzkumu, pak větve, ostrovy a mimo linie, uvnitř podle generace. Sloupec i čipy linií jsou jen
  u výzkumu s liniemi.
- **Rozpor na údaji:** buňka údaje s otevřeným rozporem pramenů má před hodnotou „≠“, bez podbarvení. Klik na „≠“
  otevře bublinu s rozpory; čtečka obrazovky přečte „{hodnota}, rozpor pramenů: {údaj}“. Značky „!“ a „?“ výzkumu
  jsou jen ve sloupcích výzkumu ([A6.7.13](#A6.7.13)).
- **Čip Výzkum ▾:** jeden čip s nabídkou v oddílech **Signály**, **Linie**, **Výměna, prameny a místa**, **Další čipy
  výzkumu** a **Nové od výzkumu**; „Výběrem se blok Výzkum v řadě rozbalí.“ Čipy: **Čeká na rozhodnutí**, **S
  rozporem**, **S otázkou**, **Agent pracuje / ve frontě**, jeden na každou linii a **Mimo linie** (s počty),
  **Neodesláno**, **Změněno výzkumem**, **Rozhodnout tady**, **Čeká zvenku**, **Nové od výzkumu** (za 24 h, za 7 dní,
  od posledního otevření), **Jen v badatelně**, **Místo neurčeno**, **Rozhodl agent**, **Pozastaveno / odloženo**,
  **Strom tu končí**. Na telefonu je oddíl **Výzkum** v panelu **Filtry**, méně časté čipy pod **Další výzkum (n)**.
- **Vestavěné pohledy** (oddíl **Výzkum** v nabídce **Pohled**; jako ostatní vestavěné se nemění, [A6.7.7](#A6.7.7)):

  | Pohled | Co ukazuje |
  |---|---|
  | **Výzkum** | osoby se signálem: jméno, Výzkum, Čeká na rozhodnutí, Rozpory, Hypotézy, Agent, Úkoly výzkumu, narození, úmrtí; řazeno od nejnaléhavějšího, pak podle jména |
  | **Linie: {linie}** (pro každou linii) a **Mimo linie** | jméno, Linie výzkumu, generace, Výzkum, narození, úmrtí, Rozpory, Agent; čip linie; řazeno podle linie |
  | **Výměna s výzkumem** | osoby s výměnou: jméno, Výměna s výzkumem, Původně v rodokmenu, Nové od výzkumu, Rozpory, narození |

  Svazky jsou v nich sbalené a řádek pokrytí zapnutý. Prázdný pohled řekne „Výzkum teď nic nepotřebuje“ nebo „Strom a
  výzkum jsou srovnané“.
- **Bublina výzkumu:** klik na buňku výzkumu otevře bublinu (na telefonu panel zdola) s oddíly podle toho, co osoba
  má: **Čeká na rozhodnutí · n** (**Porovnat verze ›**, **Čeká na vyřízení ›**), **Čeká zvenku**, **Rozpory pramenů · n**
  (**Rozhodnout ›**), **Hypotézy** nebo **Otevřená otázka** (**Co ví výzkum ›**, [S3.5](S3-what-the-research-knows.md#S3.5)),
  **Agent pracuje** (**Sledovat výzkum ›**), **Úkoly výzkumu ve frontě** (**Otevřít úkol ve výzkumu**), **Materiály ›**,
  **Linie** nebo **Mimo linie** (**Ukázat linii ve stromu**, **Změnit ve výzkumu**), **Původně v rodokmenu** (**Vrátit
  hodnotu z rodokmenu**, jen s výzkumem na tomto počítači) a **Dostupnost pramenů**. Akce, která se potvrzuje ve
  výzkumu, má značku jako jinde ([S4.5.1](S4-research-from-the-app.md#S4.5.1)).
- **Naživo:** při sledování výzkumu se mění jen buňky, kterých se změna týká, pořadí řádků zůstane. U jména osoby,
  na které agent pracuje, běží svislý pruh. Nad tabulkou stojí „● Výzkum sledován naživo“, jinak „Výzkum: stav z
  {kdy}“.
- **Export:** CSV a XLSX nesou texty a počty („čeká; rozpor (1)“, „1: narození“, bez rozporu „0“), bez značek.
  Bez sledování (od aplikace 3.27.0 jen bez odpovědi mostu) jsou **Agent** a **Úkoly výzkumu** prázdné a oznámení řekne „Agent a Úkoly výzkumu jsou prázdné:
  výzkum se nesleduje.“ Řádek pokrytí má u sloupců výzkumu „–“.
- **Hranice:**
  - bez agenta (Archiv Stromu) a ve stromu jen ke čtení nejsou **Čeká na rozhodnutí**, **Úkoly výzkumu** a **Agent**
    ani čipy **Neodesláno** a **Rozhodnout tady**; pohled **Výměna s výzkumem** je jen ve výzkumu s agentem, který
    jde měnit;
  - **Agent** a **Úkoly výzkumu** mají hodnotu jen při sledování výzkumu, jinak „–“ se štítkem „živě“; čip **Agent
    pracuje / ve frontě** bez sledování nefiltruje. Od aplikace 3.27.0 platí obojí jen bez odpovědi mostu (níž);
  - ve stromu jen ke čtení bublina nemá akce: „Jen ke čtení: rozpory tu nejde rozhodnout.“
- **Bez sledování s mostem:** když most výzkumu na tomto počítači odpovídá, berou **Agent** a **Úkoly výzkumu** (i pruh
  u jména, čip **Agent** a export) práci agenta a frontu z pravidelného dotazu na most a vypadají jako při
  sledování. Prázdná fronta mostu nechá buňky prázdné. Tabulka se překreslí, když se odpověď mostu změní. Telefon se
  mostu neptá. Stejně funguje Přehled výzkumu bez sledování ([S4.1.5](S4-research-from-the-app.md#S4.1.5)).
- **Ovládání:** panel **Sloupce** → skupina **Výzkum**; čip **Výzkum ▾**; **Pohled** → oddíl **Výzkum**; **Značky ⓘ**.
- **Platí od:** aplikace 3.27.0 s výzkumem 1.31.0
- **Od aplikace 3.30.0:** výzkum v Tabulce dalšího okna, řádek agenta a posun k němu, štítek „Filtr výzkumu se teď
  nepoužije“: [A6.7.18](#A6.7.18).

<!-- zdroj: app:src/ui/table-view/table-research.ts RESEARCH_COLUMNS, RESEARCH_DEFAULT_COLUMNS (rSum, rWait, rConf, rHyp, rAgent), LIVE_ONLY (rTasks, rAgent), NEEDS_AGENT (rWait, rTasks, rAgent), rSum pořadí (čeká 5 › rozpor 4 › otázka 3 › agent 2 › fronta 1), researchLinesOf (živě /directions/people, jinak soubor _STROM_DIRECTION), personLineRole, isOffLine, researchChips, RESEARCH_SIGNAL_CHIPS, RESEARCH_MORE_CHIPS, researchChipOffer (xUnsent, xDecideHere jen research a ne jen ke čtení), researchChipActive (live), unionLineRole, unionResearchCell (UNION_FACTS), sourceImageCell, unionResearchIdCell, sourceResearchIdCell · table-views.ts pohledy Výzkum, Linie, Mimo linie, Výměna s výzkumem · table-research-bubble.ts, table-research-ui.ts · table-grid.ts conflictMarkHtml · table-export.ts (exportNotLive) · strings.ts table.res.*, table.col.r*, uResearchId, srcResearchId, srcImage · commity 53137620, 99b60acb, a2e1dc73, 02e88e9a, 32958eb4, fd9c220f, cf9e63d8, 4635c16e, 5857be6b, 970e6b88, 6b66e037, 9e51ff66 · research: GET /directions/people, funkce directions.places, brána APP_SHOWS_RESEARCH_TABLE (src/core/stromapp.ts), CHANGELOG.cs.md 1.31.0 „Výzkum v tabulce aplikace Strom“ · spec 073 §16, K7.1–K7.8 · bez sledování s mostem: app 8d564b35 src/ui/research-ui.ts unfollowedAgentNow (onComputer, researchStatusNow, status.working a queue), src/ui/table-view/table-ui.ts tableResearchAgentChanged · spec 057 K1.12 -->

<a id="A6.7.15"></a>
### A6.7.15 Aktivní buňka, nabídka buňky a úprava na místě

Klik na buňku vybere řádek a udělá z buňky aktivní buňku (tenký obrys); šipky ji posouvají. Aktivní buňku jde
zkopírovat, podle její hodnoty filtrovat a údaj v ní upravit přímo v tabulce.

- **Kopírovat:** Ctrl/Cmd+C bez vybraného textu zkopíruje text, který aktivní buňka ukazuje, bez značek, ikon a
  pilulek. Ručně vybraný text se kopíruje jako obvykle.
- **Nabídka buňky:** nabídka řádku (pravé tlačítko, Shift+F10) a panel řádku (klepnutí prstem na buňku) začínají
  volbami buňky **Kopírovat**, **Jen „{hodnota}“** a **Bez „{hodnota}“** (hodnota zkrácená asi na 24 znaků s „…“); pod
  nimi jsou akce řádku ([A6.7.8](#A6.7.8)). Nabídka se otevře u buňky, i když byl vybraný jiný řádek.
  - **Jen** a **Bez** nastaví filtr sloupce **je** / **není** ([A6.7.6](#A6.7.6)), čip „{Sloupec} = {hodnota} ×“ nebo
    „{Sloupec} ≠ {hodnota} ×“; porovnává se bez ohledu na velikost písmen a diakritiku. Buňka se jménem osoby porovnává
    osobu: **Jen „{otec}“** ve sloupci **Otec** ukáže sourozence, ne děti jmenovce.
  - Prázdná buňka nabídne **Jen prázdné** a **Jen vyplněné**, buňka s výčtem nastaví filtr hodnot. Buňka bez jedné
    hodnoty k porovnání (značka výzkumu, více jmen, úplnost, počet svazků) nabídne jen **Kopírovat**; vlastní jméno
    nebo titul řádku má jen akce řádku.
  - Filtr se uloží s pohledem ([A6.7.7](#A6.7.7)).
  - **Od aplikace 3.30.0:** **Bez** přidá další vyloučení vedle dřívějších a druhé **Jen** ve sloupci přidá svou
    hodnotu („= A nebo B“), místo aby filtr sloupce nahradily ([A6.7.6](#A6.7.6)). Buňka se jménem osoby je odkaz
    na její řádek ([A6.7.16](#A6.7.16)); nabídka řádku má navíc **Ukotvit řádek** ([A6.7.17](#A6.7.17)).
- **Úprava na místě:** upravit jde buňku, která stojí za jedním údajem stromu:
  - **Křestní jméno**, **Příjmení** (ukazuje-li příjmení po sňatku, upraví ho), **Rodné příjmení**, **Příjmení po
    sňatku**;
  - **Pohlaví** výběrem (**Muž**, **Žena**, **Neznámé**) a **Ref. číslo**;
  - datum a místo narození, křtu, úmrtí a pohřbu, **Příčina úmrtí** a **Zapsaný věk při úmrtí**;
  - **Povolání**, dokud má osoba nejvýš jedno;
  - údaje svazku (tabulka svazků, podřádek svazku, řádek osoby s jedním svazkem): **Stav svazku** výběrem
    (**Manželství**, **Partneři**, **Rozvedení**, **Odloučení**, jako ve formuláři svazku), datum a místo sňatku,
    zapsaný věk každého z partnerů při sňatku (**Zapsaný věk při sňatku**, **Zapsaný věk partnera**, **Zapsaný věk
    1** a **2**), **Datum rozvodu** a **Místo rozvodu**. Prázdná buňka údaj svazku založí, jako ho založí formulář
    svazku. U svazku bez sňatku ([A6.7.4](#A6.7.4)) se buňky sňatku neupravují.

  **Celé jméno** se v buňce neupravuje (skládá se z více částí), stejně jako dopočtené buňky, kontroly, výzkum, citace,
  počty a vztahy; dvojklik na ně otevře **Upravit…**.
- **Pole** stojí v buňce. Jen ve sloupci užším než nejmenší šířka pole (text a datum 100 px, místo 140 px, výběr
  90 px) je pole širší a leží nad řádkem se stínem (od aplikace 3.28.0; dřív leželo přes sousední buňku). **Enter** uloží, **Esc** zruší, **Tab** a **Shift+Tab** uloží a přejdou na další nebo
  předchozí upravitelnou buňku řádku, klik jinam uloží. Ve výběru uloží hodnotu klik myší hned; po výběru šipkami
  ji uloží Enter, Tab nebo klik jinam. Datum se čte jako ve formuláři osoby; nečitelné zůstane
  v poli s chybou „Datum nejde přečíst (např. 15.5.1880, 1880, kolem 1880)“. Místo nabízí místa stromu. Bez jména
  i příjmení se neuloží nic: „Jméno nebo příjmení musí zůstat“.
- **Uložení** jde stejnou cestou jako formulář osoby (údaje svazku jako formulář svazku) a je to jeden krok zpět
  (Ctrl/Cmd+Z), i když prázdná buňka údaj založila. Křest a pohřeb upraví první
  takovou událost (její další údaje a citace zůstanou), nebo ji přidá; prázdné pole smaže jen ten údaj. Pak řádek
  blikne, zůstane na místě a oznámení řekne „Uloženo: {jméno}“.
- **Hranice:** na místě nejde upravovat ve stromu jen ke čtení nebo zamčeném, v Archivu Stromu, na telefonu a
  u zamčené osoby. Na telefonu se údaj upraví přes panel řádku → **Upravit…**.
- **Ovládání:** dvojklik, **F2**, **Enter** na aktivní buňce (u buňky s nálezem otevře Enter nejdřív bublinu nálezu),
  v nabídce řádku **Upravit buňku** (F2). Upravitelná buňka má při najetí myší textový kurzor.
- **Platí od:** aplikace 3.27.0

<!-- zdroj: app:src/ui/table-view/table-grid.ts copyKey (Ctrl/Cmd+C, copyPlainText), F2, Enter (has-issue → onIssue, has-finds → onFindings, jinak startEditAt, jinak open), Escape, Tab · table-ui.ts showTableRowMenu (cellPart, cell-edit „Upravit buňku“ s F2), tableCellChoices, tableCellSheetBlocks, :1663 úprava na místě ne v jen ke čtení, archivu, na telefonu (isPhoneBar) · table-edit.ts editTargetOf, PERSON_FIELDS (surname: marriedSurname || lastName, birthSurname, marriedSurname, bDate…burPlace, occ), UNION_FIELDS (wDate, wPlace), editChangeOf (normalizeDateInput, první křest a pohřeb, prázdné pole smaže jen údaj, beze jména neuloží) · strings.ts table.cell.copy, only, without, edit, badDate, nameNeeded, editLabel, onlyEmpty, onlyFilled, matchEquals, matchNotEquals, savedToast · commity 05d9a9ab, be9ca8cd, 28aabdc8 · spec 073 U9 (T54 F4, F8, F9) · T54 2. kolo: table-edit.ts PERSON_FIELDS (firstName, gender, refn, dCause, dAgeRec), UNION_FIELDS (wAgeRec, pAgeRec, rec1, rec2, divDate, divPlace, uStatus), WEDDING_FIELDS (ne u unionWithoutWedding), editOptionsOf (GENDERS, UNION_STATUSES v pořadí formuláře svazku), table-grid.ts select (klik myší uloží hned), commity 8fdf52ca, 79764eba (T54 G3, G10) · nabídka u buňky jiného řádku: commit 400ccda8 (T54 G7) · pole v buňce: table-grid.ts EDITOR_MIN_WIDTH (text 100, date 100, place 140, select 90), placeEditor, commit 80c2ffb9 · panel klepnutím: commit ee38c7a6 · 3.30.0: app:ec39d469 table-ui.ts tableCellChoices (addOnlyFilter, addWithoutFilter) -->

<a id="A6.7.16"></a>
### A6.7.16 Odkazy na osoby a skoky ‹ ›

V tabulce osob a svazků je jméno osoby stromu v buňce odkazem na její řádek. Z otce, matky, partnera, kmotra nebo
svědka se tak jde na jejich řádek bez hledání a zpět.

- **Kde:** buňky tabulky osob a svazků, které jmenují osobu stromu: **Otec**, **Matka**, **Partner**, kmotři,
  svědci, partneři svazku. Vlastní jméno řádku (**Celé jméno**) odkazem není. Jméno vypadá jako text buňky,
  podtrhne se jen pod ukazatelem myši; text při najetí ukáže celé jméno. Víc jmen v jedné buňce má každé svůj odkaz.
- **Skok:** vede vždy do tabulky osob (i z tabulky svazků). Řádek osoby je uprostřed, sloupec se posune do
  zorného pole, buňka je aktivní a řádek krátce blikne. Cílová buňka:
  - přes partnera buňka **Partner** na řádku toho svazku (svazek se rozbalí) a v ní je vyznačené jméno, odkud se
    přišlo, dokud je buňka aktivní;
  - jinak buňka **Celé jméno**; také když sloupec **Partner** není vidět.
- **‹ ›:** na začátku lišty tabulky od prvního skoku. ‹ vrátí typ řádků, posun a buňku, odkud skok vyšel, a zavře
  svazek, který skok rozbalil; › skok zopakuje. Text při najetí říká kam („Zpět na Jan Horák“, „Znovu na Marie
  Vlková“); bez kroku tím směrem je tlačítko vypnuté. Kroky jsou jen skoky přes jména, ne ruční změna typu řádků,
  pohledu nebo filtru. Paměť má 50 kroků a každé okno ([A6.8](#A6.8)) svou; jiný strom ji začne znovu.
- **Osoba skrytá filtrem nebo hledáním:** skok se neprovede a pod lištou se objeví pruh „Filtr skrývá: {jméno}.“:
  - **Zobrazit dočasně** ukáže řádek na jeho místě v řazení, ztlumený s „mimo filtr“, mimo počet řádků. Zmizí
    se změnou filtru, řazení, pohledu nebo typu řádků a s ‹;
  - **Zrušit filtry** vypne filtr i hledání a skok provede;
  - × nebo Esc pruh zavře, nic se nezmění.
  - osoba, jejíž řádek je ukotvený ([A6.7.17](#A6.7.17)): skok vede rovnou na její ukotvený řádek pod záhlavím,
    bez pruhu.
- **Události:** v tabulce událostí jména odkazem nejsou; nabídka účastníka začíná **Přejít na {jméno}**
  ([A6.7.10](#A6.7.10)).
- **Hranice:**
  - skok spustí jen prostý klik myší nebo perem (bez Ctrl, Shift, Alt a bez tažení). Výběr textu, úprava buňky
    dvojklikem jinde v buňce a F2 fungují jako dřív; dvojklik hned po skoku neudělá nic;
  - klepnutí prstem otevře panel řádku jako dřív; ten začíná oddílem **Osoby v buňce** s řádkem **Přejít na
    {jméno}** pro každou osobu buňky;
  - ústřední osoba stromu se skokem nemění.
- **Ovládání:** klik na jméno; **Enter** na aktivní buňce s jedním jménem skočí, s více jmény nabídne **Přejít na…**;
  ‹ › na liště a Alt+← / Alt+→ v tabulce.
- **Platí od:** aplikace 3.30.0

<!-- zdroj: app:0b833e3d src/ui/table-view/table-grid.ts personLinks (osoba bez role účastníka, ne agregát), namesHtml (tv-nm--jump, title celé jméno), linksIn (ne sloupec name), klik jen isMouseLikePointer bez modifikátorů a e.detail 1, jumpedAt + JUMP_DOUBLE_MS (dvojklik po skoku nic), Enter (tableLinkPick), Alt+←/→ onHistory · table-ui.ts tableNameAction (persons, unions), tableJumpStep (přes p1/p2 nebo partner → via partner), tableJumpBy, tablePersonShown, tableRunJump (rowType persons, setExpanded, flash, jumpTo), tableHistory (rowType, scroll, buňka, zavře rozbalený svazek, ruší dočasné zobrazení), tableLinkPick, showTableRowSheet (link.inCell) · table-jump.ts JUMP_HISTORY_MAX 50, JumpHistory, jumpTargetCell (partner jen je-li sloupec vidět, jinak name) · table-notice.ts (role status, Zobrazit dočasně, Zrušit filtry, ×, Esc) · table-bar.ts updateNav (vidět od prvního skoku, aria-disabled) · strings.ts table.link.goTo, pick, inCell, enterHint, hidden, showTemp; table.nav.back, backTo, forward, forwardTo; table.outsideFilter · e2e/table-view-links.spec.ts · CHANGELOG.cs.md 3.30.0 „Odkazy v Tabulce“ · spec 103 K3.1–K3.3, ZADANI_DEV_tabulka-odkazy-ukotveni D1–D4, D6 · dirigent:test/vysledek-1116-app-103-odkazy-083-razeni.md · ukotvená osoba skrytá filtrem: app:9b2b6dca table-ui.ts tablePersonPinned, grid.jumpToPin (bez pruhu) · spec 103 Rozhodnutí 16. 11. (díl C) -->

<a id="A6.7.17"></a>
### A6.7.17 Ukotvené řádky

Ukotvený řádek zůstane pod záhlavím tabulky, zatímco se tabulka posouvá. Slouží k porovnání řádků, které jsou
v tabulce daleko od sebe.

- **Jak se ukotví:** nabídka řádku → **Ukotvit řádek** (za **Upravit…**). Text vybraný přes víc řádků (tažením
  nebo Shift+klik) a pravý klik do něj nabídne **Ukotvit řádky (n)** pro osoby těch řádků; podřádek svazku se počítá
  jako jeho osoba. Na ukotveném řádku je místo toho **Uvolnit řádek**.
- **Jak vypadají:** pod záhlavím v pořadí tabulky, osoba i s podřádky svazků jako v těle tabulky. Jméno ukotveného
  řádku má plný špendlík, jeho vlastní řádek v těle tabulky obrysový. Zabírají nejvýš třetinu výšky tabulky, víc
  řádků se posouvá ve vlastním posuvníku. Aktivní buňka, úprava v buňce, klávesnice i akce řádku v nich fungují.
- **Filtr ukotvený řádek neskryje:** řádek, který filtr nebo hledání skrývá, zůstane ukotvený, ztlumený
  s „mimo filtr“.
- **Štítek** „Ukotvené řádky (n) ×“ na začátku řady filtrů: × uvolní všechny. **Zrušit filtry** ukotvení nechá.
- **Hranice:**
  - nejvýš 10 řádků; položka, která by mez překročila, je vypnutá s „Ukotvit jde nejvýš 10 řádků.“;
  - ukotvení platí pro jeden strom a jeden typ řádků v tomto okně: jiný strom nebo typ řádků je uvolní, pohled,
    filtr ani hledání ne. Do pohledu se neukládá a pohled kvůli němu nemá **změněno**. Po zavření stromu nebo
    obnovení stránky není;
  - pořadí ukotvených řádků se po úpravě nemění, dokud se nezmění řazení, filtr, hledání nebo pohled;
  - řádek, který ze stromu zmizí, se uvolní sám;
  - jen počítač a tablet (na tabletu v panelu řádku). Telefon, ani otočený na šířku, ukotvení nemá.
- **Ovládání:** nabídka řádku (pravé tlačítko, Shift+F10) **Ukotvit řádek** / **Ukotvit řádky (n)** / **Uvolnit
  řádek**; štítek **Ukotvené řádky (n)** s ×.
- **Platí od:** aplikace 3.30.0

<!-- zdroj: app:354e3675 src/ui/table-view/table-pins.ts PIN_MAX 10, TablePins (jeden strom a typ řádků; pohled, filtr, hledání je nechají; jen paměť okna, ne v pohledu), prune, ordered (pořadí do změny řazení, filtru, hledání, pohledu; D7 a), pinRanks · table-ui.ts tableRowPinEntry (ne isPhoneBar; many z tableAreaRowKeys, unpin, disabled + limit), tablePinnedLines (podřádky svazků jako v těle, D5 a; outside), showTableRowSheet (tablet), changeTablePins · table-grid.ts .tv-pinrows (role rowgroup, nejvýš třetina těla s vlastním posuvem), tv-outside · table-filterbar.ts štítek pinRow.chip s × (unpinAll; Zrušit filtry ukotvení nechá) · strings.ts table.pinRow.one, many, unpin, chip, unpinAll, zone, rowSr, limit; table.outsideFilter · e2e/table-view-pins.spec.ts · CHANGELOG.cs.md 3.30.0 „Odkazy v Tabulce“ · spec 103 K4.1–K4.4, D5, D7 · dirigent:test/vysledek-1116-app-103-odkazy-083-razeni.md -->

<a id="A6.7.18"></a>
### A6.7.18 Výzkum v Tabulce dalšího okna

Tabulka v dalším okně ([A6.8](#A6.8)) ukazuje výzkum tak, jak ho má hlavní okno: sloupce, čipy a pohledy výzkumu,
značku agenta u osoby, na které pracuje, i jeho frontu ([A6.7.14](#A6.7.14)). S výzkumem mluví jen hlavní okno;
další okno dostává jeho stav. Při sledování výzkumu Tabulka dalšího okna sleduje agenta
([S4.1.7](S4-research-from-the-app.md#S4.1.7)).

- **Čipy a pohledy:** skupina **Výzkum** je v Tabulce každého okna se stromem výzkumu. Čipy, které platí jen při
  sledování, jsou živé, když hlavní okno sleduje výzkum, jinak jsou jako v hlavním okně ([A6.7.14](#A6.7.14)).
  Uložený pohled s filtry výzkumu se v obou oknech otevře stejně.
- **Filtr výzkumu bez výzkumu** (v každém okně, i v hlavním): pohled, který filtruje podle výzkumu (čip výzkumu nebo
  filtr sloupce výzkumu), když tabulka údaje výzkumu nemá, ukáže všechny řádky a vedle názvu pohledu řekne „Filtr
  výzkumu se teď nepoužije“. Na telefonu je tam jen jantarová tečka s tímto textem v nápovědě.
- **Řádek agenta:** řádek osoby, na které agent pracuje, má v dalším okně podklad v barvě sledování, linku v buňce
  jména a jméno tučně, i v odpojeném okně. Hlavní okno má dál svislý pruh u jména ([A6.7.14](#A6.7.14)).
- **Posun k agentovi:** okno, které agenta sleduje a není pozastavené, posune řádek agenta doprostřed, když agent
  přejde na jinou osobu a její řádek není celý vidět. Posun je plynulý (300 ms, při omezeném pohybu hned), aktivní
  buňka, výběr ani fokus se nemění a vodorovně se nic neposouvá. Řádek, který je vidět, a ukotvený řádek agenta
  ([A6.7.17](#A6.7.17)) tabulku neposunou. Pozastavené a odpojené okno neposouvá.
- **Pauza:** kolečko nad mřížkou, tah posuvníku, stisk v řádcích (buňka, jméno) a klávesy pohybu a posunu v mřížce
  sledování v okně pozastaví ([S4.1.7](S4-research-from-the-app.md#S4.1.7)). Lišta, záhlaví a stavový řádek Tabulky
  pauzu nespustí, jen prodlouží běžící.
- **Řádek agenta skrytý filtrem:** v okně, které agenta sleduje (i pozastaveném), se tabulka neposune a stavový řádek
  řekne „Řádek agenta skrývá filtr“ s **Zobrazit dočasně**. To ukáže dočasný řádek jako u skoku na osobu
  ([A6.7.16](#A6.7.16)) a posune se k němu. Poznámka zmizí, jakmile je řádek agenta vidět. Dokud je poznámka vidět,
  stav výzkumu a „Jen ke čtení“ ve stavovém řádku ustoupí (obojí říká pruh okna); v okně do 400 px ustoupí i počet
  řádků a **Značky ⓘ**. Ukotvený řádek agenta poznámku nemá.
- **Bubliny výzkumu:** akci z bubliny buňky výzkumu ([A6.7.14](#A6.7.14)) provede hlavní okno: spustí ji, jen když
  ji jeho bublina u té osoby právě nabízí, a přenese se do popředí (ne u akce, která otevírá terminál výzkumu).
  Pramen v tabulce pramenů a web archivu se otevřou v dalším okně. Vlastní odpověď na čekající položku se v dalším
  okně nenabízí; **Čeká na vyřízení ›** otevře panel v hlavním okně. Když je hlavní okno zavřené, akce, které by
  provedlo, v bublině nejsou.
- **Ovládání:** aplikace: **Zobrazit dočasně** ve stavovém řádku Tabulky; stav sledování v pruhu okna
  ([S4.1.7](S4-research-from-the-app.md#S4.1.7)).
- **Platí od:** aplikace 3.30.0

<!-- zdroj: app:34513c94 src/windows/agent-state.ts, agent-mirror.ts, src/ui/agent-window-ui.ts (zrcadlo stavu agenta, Tabulka čte vstup výzkumu z hlavního okna) · src/ui/table-view/table-filter.ts researchFilterIdle (čip výzkumu nebo sloupec fromResearch, bez ctx.research) · table-viewbar.ts .tv-view-note (role status) · index.html .tv-view-note na telefonu jen tečka · d24ff2ec src/ui/table-view/table-ui.ts tableAgentRow (jen windowAgentFollow, tj. další okno; attached posune, attached/paused poznámka, ukotvený ne), tableShowAgentRow, tableAgentFollowChanged · table-grid.ts revealKey(center, smooth, keepSelection), REVEAL_GLIDE_MS 300, prefers-reduced-motion · index.html .tv-row.is-agent (--follow-c1-soft, linka, font-weight 600, bez tv-agent-bar) · src/ui/live-follow-ui.ts (pauza Tabulky: kolečko, posuvník, stisk v řádcích, klávesy; lišta, hlava, stavový řádek ne) · table-bar.ts updateAgentNote (tv-status-agent, aria-live polite, showTemp) · 18dbb544 (poznámka: stav výzkumu a jen ke čtení ustoupí; do 400 px počet, Značky, ◎) · b8d21457 src/windows/window-table-research.ts (TABLE_BUBBLE_ACTION, bubbleRunsHere source / web, hlavní okno ověří nabídku, do popředí ne u terminálu, bez odpovědi čekající položky, při zavřeném hlavním okně vynechané) · strings.ts table.agentRowHidden, table.researchFilterOff, table.link.showTemp · CHANGELOG.cs.md 3.30.0 „Výzkum v Tabulce dalšího okna“, „Sledování agenta ve všech oknech“ · spec 097 K1.2, K3.1, K3.2, O4, dotaz 6 · app:docs/ZADANI_DEV_sledovani-ve-vsech-oknech.md §5; ZADANI_UIX dotazy 11, 14, 15 · prace/1116-app-097-sledovani-okna -->

<a id="A6.7.19"></a>
### A6.7.19 Rozsah: seznam osob

Tabulka ukazuje celý strom, nebo jeden seznam osob ([A11](A11-lists-of-people.md)). Rozsah zúží řádky na osoby
seznamu; filtr, hledání a čipy pak platí uvnitř něj.

| Řádky | V rozsahu seznamu |
|---|---|
| **Osoby** | osoby seznamu v pořadí seznamu; první sloupec **#** je pořadí, řazení „Řazení: # (pořadí seznamu)“ |
| **Svazky** | svazky, kde je aspoň jeden partner v seznamu; partner mimo seznam je šedý |
| **Události** | události, kterých se účastní aspoň jedna osoba seznamu |
| **Prameny** | vždy celý strom: „Prameny nemají rozsah podle seznamu.“ |

- Rozsah platí pro Osoby, Svazky a Události najednou. Počty v přepínači **Řádky** a nad tabulkou počítají jen
  rozsah. Řazení podle jiného sloupce jde; po návratu na celý strom pořadí seznamu zmizí.
- Rozsah není čip filtru: **Zrušit filtry** ho nezruší.
- **Pracovní seznam** ([A11.8](A11-lists-of-people.md#A11.8)): za **#** je sloupec **Hotovo** (zaškrtávátko, klik nebo
  mezerník) a mezi čipy **Zbývá** a **Hotovo** (vylučují se).
- **Odebrat ze seznamu:** v rozsahu pevného seznamu je v nabídce řádku osoby (i pro výběr přes více řádků); osoba
  z tabulky hned zmizí, oznámení má **Zpět**.
- **Osoba mimo seznam:** skok na osobu odkazem ([A6.7.16](#A6.7.16)) na osobu, která v seznamu není, řekne
  „Osoba není v seznamu: {jméno}.“ s **Zobrazit dočasně** · **Celý strom** · ×. Dočasně ukázaný nebo ukotvený řádek
  ([A6.7.17](#A6.7.17)) mimo seznam je znevýrazněný, má **#** „–“ a štítek „mimo seznam“.
- **Smazaný seznam:** tabulka se vrátí na celý strom a řekne „Seznam pohledu už není, ukazuje se celý strom.“
- Rozsah se pamatuje s pohledem ([A6.7.7](#A6.7.7)), s rozpracovaným stavem tabulky a v novém okně (⧉, [A6.8](#A6.8)).
- **Export CSV a XLSX** ([A6.7.9](#A6.7.9)) v rozsahu nese sloupce **#** a **Hotovo** první; **Všechny … bez filtru**
  znamená všechny řádky rozsahu.
- **Hranice:** strom bez seznamů má v **Rozsah** jen **Celý strom** a **Spravovat seznamy…**; ve stromu jen ke čtení
  není ani **Spravovat seznamy…**, ani **Hotovo** a **Odebrat ze seznamu** jako úpravy.
- **Ovládání:** **Rozsah ▾** v liště tabulky: **Celý strom**, **Seznamy osob** (ikona druhu, počet osob, ✓ u zvoleného),
  **Spravovat seznamy…**. Na počítači zůstane první řádek lišty jeden: kde je místa málo, nápis **Rozsah** se
  skryje a celý strom je jen značka. Na telefonu **⋯ → Rozsah ›**. Ze seznamu: **Otevřít v Tabulce**
  ([A11.3](A11-lists-of-people.md#A11.3)).
- **Platí od:** aplikace 3.30.0

<!-- zdroj: app:src/ui/table-view/table-scope.ts tableScopeOf, scopeRows (Osoby v pořadí, svazek s partnerem, událost s osobou, prameny nikdy), scopeCounts, outsideScope, applyScopeCells · table-ui.ts setTableScope (Osoby, Svazky, Události najednou; LIST_SORT # ↑; zpět bez num), dropGoneScopes + scopeGone, tableScopeRows (Spravovat seznamy… ne v isReadOnly), showTableScopeMenu, tableScopeSheetRows, toggleTableDone, tableRowRemoveIds, hiddenJump.outsideList (:2204), leadColumnsOf (# a Hotovo), export :3125 scopeRows · table-notice.ts:60 (scopeGone, notInList, Celý strom) · table-views.ts:258, :272 view.scope · table-bar.ts tv-scope-btn · strings.ts table.scope, scopeWhole, scopeManage, scopeSources, scopeGone, notInList, outsideList, sortList, col.num, col.done, chip.left, chip.done, lists.toast.removed · app:211323e8, 33fa6cd4 (# a Hotovo v exportu), 9681a1f4 (N1 jeden řádek lišty) · ZADANI_DEV §9, §13d · spec 084 K3.* -->

<a id="A6.7.20"></a>
### A6.7.20 Seskupit podle

Řádky tabulky jdou seskupit podle jedné hodnoty. Každá skupina má záhlaví s hodnotou a počtem řádků a jde sbalit.

| Řádky | Seskupit podle |
|---|---|
| **Osoby** | **Linie výzkumu** (jen strom s liniemi), **Rod**, **Příjmení**, **Místo narození**, **Století narození**, **Desetiletí narození**, **Generace**, **Pohlaví**, **Povolání**, **Přidáno – den** / **měsíc** / **rok** ([A11.7](A11-lists-of-people.md#A11.7)), **Hotovo / zbývá** (jen v rozsahu pracovního seznamu) |
| **Svazky** | **Desetiletí sňatku**, **Místo sňatku**, **Rod partnerů**, **Počet dětí** |
| **Události** | **Druh události**, **Desetiletí**, **Místo** |
| **Prameny** | neseskupují se |

- Seskupuje se jen jednou úrovní. Skupiny jdou vzestupně podle hodnoty (čas, číslo, abeceda); řádky bez hodnoty
  jsou poslední skupina „bez hodnoty“ (u Přidáno „dříve“). Uvnitř skupiny platí řazení tabulky. Prázdná skupina
  se neukáže.
- Řádek s více hodnotami (více linií, více povolání, svazek dvou rodů) je v každé své skupině. Stavový řádek pak
  řekne „N různých osob · K skupin“.
- Seskupení je vidět jako čip „Seskupeno: …“ s ×; filtr a hledání platí dál. Skok na řádek ve sbalené skupině ji
  otevře.
- Seskupení se pamatuje s pohledem ([A6.7.7](#A6.7.7)). Hodnota, kterou typ řádků nebo strom nenabízí, se nepoužije.
- **Export CSV a XLSX** seskupené tabulky má první sloupec **Skupina**; řádek ve více skupinách je tam v každé.
- **Ovládání:** **⋯** Tabulky → **Seskupit podle ›** (**Bez seskupení** zruší), **Sbalit všechny skupiny** /
  **Rozbalit všechny skupiny**. Záhlaví skupiny: klik, Enter nebo mezerník sbalí a rozbalí, ← sbalí, → rozbalí.
  Na telefonu **⋯ → Seskupit podle**; záhlaví skupiny zůstává nahoře při posunu.
- **Platí od:** aplikace 3.30.0

<!-- zdroj: app:src/ui/table-view/table-group.ts PERSON_KEYS, UNION_KEYS, EVENT_KEYS, offeredGroupKeys (lines jen s liniemi, done jen pracovní seznam), multiValued, groupRows (vzestupně, NO_VALUE_KEY poslední, řazení uvnitř, prázdné ne), noValueLabel (lists.earlier), groupKeysOfRow (skok otevře), groupedExportRows · table-export.ts:131 groupCol · table-views.ts:259, :273 view.group, groupingFits · table-ui.ts tableGroupOffer, tableExportGroups, setTableGroupBy, ⋯ Tabulky :3377, telefon :3423 · strings.ts table.groupBy, groupNone, grouped, groupsCollapse, groupsExpand, groupKey.*, groupNoValue, distinct, groupsN, groupCol · app:84331c31 · ZADANI_DEV §10, §11 · spec 084 K4.* -->

<a id="A6.8"></a>
## A6.8 Pohled v samostatném okně

Na počítači jde každý pohled otevřít v samostatném okně, třeba na druhém monitoru, a to v libovolném počtu. Hlavní
okno zůstane na svém pohledu. Ukládá jen hlavní okno; ostatní okna mu úpravy posílají a dostávají od něj strom.

- **Kde to jde:** na počítači (Windows, macOS, Linux, ChromeOS), i s dotykovou obrazovkou, v okně širším než 640 px.
  Na telefonu a tabletu (Android, iOS, iPadOS) a v exportované aplikaci (soubor HTML) se ⧉ neukazuje a zkratky nic
  neotevřou.
- **Co okno převezme:** strom, osobu ve středu a to, co pohled ukazuje: u Tabulky typ řádků, filtry, hledání,
  uložený pohled, řazení a vybraný řádek; u Rodiny přiblížení, u Vějíře kruhy, u Mapy místa a přiblížení. Pak má
  okno vlastní stav. Obnovení okna (F5) drží jeho pohled i osobu.
- **Co okno umí:** místo lišty aplikace má hlavičku: název stromu, přepínač pohledů (pod 960 px jako „{pohled} ▾“),
  **Sledovat výběr** ([A6.8.1](#A6.8.1)), **Vrátit**, **Znovu** a ⧉ **Otevřít další okno**. Přepínač stromů, nabídku **Výzkum**,
  Nastavení ani malý panel výzkumu okno nemá. Od aplikace 3.30.0 je místo **Sledovat výběr** přepínač **Výběr**
  ([A6.8.4](#A6.8.4)).
- **Úpravy:** v okně jde upravovat osobu (nabídka osoby, **Upravit**) i buňku Tabulky. Uloží je hlavní okno, jdou
  vrátit jako jeho kroky a hned se ukážou ve všech oknech. **Vrátit** a **Znovu** v hlavičce okna vrací a opakují kroky hlavního okna. Když se
  strom mezitím změnil v jiném okně, úprava se nepoužije: „Strom se mezitím změnil v jiném okně. Úprava se nepoužila,
  data jsou obnovená.“ Rozepsaná buňka Tabulky přitom zůstane („Rozepsané zůstalo · Enter použije, Esc zahodí“).
- **Výzkum:** spojení s výzkumem (most, sledování, posílání úprav) obsluhuje jen hlavní okno. Položky výzkumu
  v nabídce osoby v okně stojí pod nadpisem **Výzkum · provede hlavní okno** a provede je hlavní okno. Při živém
  sledování výzkumu ([S1.4](S1-connecting-app-and-research.md#S1.4)) jsou okna jen ke čtení jako hlavní okno: „Jen ke
  čtení · hlavní okno sleduje výzkum“ s **Přejít do hlavního okna**.
- **Hranice:**
  - ⧉ v hlavním okně ukazuje počet dalších oken („2 další okna“, pod 1280 px jen číslo). Jeho nabídka má nahoře
    **Otevřená okna** (u každého **Přenést do popředí** a ×) a **Zavřít vše**;
  - od 5 otevřených oken aplikace upozorní, že každé další okno potřebuje paměť; nic nezakáže;
  - okno zablokované prohlížečem se ohlásí („Prohlížeč nové okno zablokoval…“) se **Zkusit znovu**;
  - titulek okna nese pohled a strom („Tabulka – Horákovi – Strom“), titulek hlavního okna strom („Horákovi – Strom“).
- **Ovládání:** aplikace: ⧉ **Otevřít v novém okně** vedle přepínače pohledů (nabídka šesti pohledů, u
  stromu z výzkumu i **Přehled výzkumu**, [S4.1.6](S4-research-from-the-app.md#S4.1.6)); ⧉ v liště Tabulky za
  **Export ▾**; na záložce pohledu Ctrl+klik (macOS ⌘+klik), prostřední tlačítko nebo pravý klik (Shift+F10) →
  **{pohled} v novém okně**.
- **Platí od:** aplikace 3.28.0
- **Od aplikace 3.30.0:** při živém sledování výzkumu sleduje agenta každé okno ve svém pohledu a pruh okna říká,
  jak okno sleduje, místo „Jen ke čtení · hlavní okno sleduje výzkum“ ([S4.1.7](S4-research-from-the-app.md#S4.1.7)).
  Tabulka v okně ukazuje výzkum jako v hlavním okně ([A6.7.18](#A6.7.18)).

<!-- zdroj: app:4b1373a7 src/windows/window-open.ts isDesktopSystem, windowsOffered (role main, ne isViewMode, > MOBILE_MAX 640, ne isPhoneBar), openInNewWindow · src/windows/window-controls.ts openWindow (BLOCKED_TOAST_MS 10 s, win.retry; MANY_WINDOWS 5, manyWindows), INDICATOR_TEXT_MIN_WIDTH 1280, renderMenu (6 pohledů, thisView, overview jen UI.canOpenResearchOverview), wireTabs (ctrl/meta click, auxclick button 1, contextmenu, Shift+F10 / ContextMenu) · src/windows/view-window-state.ts (přenos stavu, F5 satelitu) · src/windows/sat-header.ts · src/windows/satellite.ts readOnly (live, locked) · src/windows/sat-states.ts (live strip readOnlyLive, goToMain; CONFLICT_TOAST_MS) · src/windows/window-drafts.ts (draftKept) · src/windows/window-research-menu.ts (researchInMain) · src/windows/window-title.ts · index.html html.window-satellite .toolbar skryto · strings.ts win.* · CHANGELOG.cs.md 3.28.0 · spec 079 K1.1–K1.4, K1.7 · prace/1112-app-okna-zaklad, 1112-app-okna-pohledy -->

<a id="A6.8.1"></a>
### A6.8.1 Sledovat výběr

Vybraná osoba je mezi okny sdílená. Co výběr z jiného okna udělá v tomto okně, určuje přepínač **Sledovat výběr**
v hlavičce okna.

| Režim | Co udělá osoba vybraná v jiném okně | Výchozí v pohledech |
|---|---|---|
| **přepnout** | stane se středem okna jako po Zaměřit: Potomci ukáže její potomky, Vějíř předky, Rodina její rodinu | Rodina, Potomci, Vějíř |
| **jen vyznačit** | jen se vyznačí: karta prstencem, ve Vějíři výseč, na Časové ose řádek, na Mapě její místa, v Tabulce řádek; střed zůstane | Časová osa, Mapa, Tabulka |
| **vypnuto** | nic; okno má vlastní výběr osoby a svůj výběr neposílá | – |

- **Hranice:**
  - **přepnout** se nabízí jen v Rodině, Potomcích a Vějíři; jinde jsou jen **jen vyznačit** a **vypnuto**;
  - vlastní klik v okně mění střed jen v tomto okně; okno, které se přepnulo podle jiného okna, výběr dál nerozesílá;
  - hlavní okno sleduje výběr vždy a přepínač nemá;
  - volba platí pro jedno okno a vydrží jeho obnovení (F5). Zvolený režim, který není výchozí, platí i po přepnutí
    pohledu v okně (**přepnout** tam, kde není, jako **jen vyznačit**); jinak platí výchozí režim nového pohledu.
- **Ovládání:** aplikace: v hlavičce okna **Sledovat výběr: {režim} ▾**.
- **Platí od:** aplikace 3.28.0
- **Od aplikace 3.30.0:** okno, které při sledování výzkumu sleduje agenta a není pozastavené, osobu vybranou
  v jiném okně jen vyznačí, i v režimu **přepnout**; skok za agentem se jako výběr osoby neposílá
  ([S4.1.7](S4-research-from-the-app.md#S4.1.7)).
- **Od aplikace 3.30.0:** přepínač se jmenuje **Výběr ▾** a tyto režimy jsou v jeho skupině **Toto okno** · výběr
  z jiných oken. Druhá skupina **Hlavní okno** říká, co udělá výběr v tomto okně v hlavním okně ([A6.8.4](#A6.8.4)).

<!-- zdroj: app:4b1373a7 src/windows/follow-mode.ts RECENTERING (family, descendants, fan), defaultFollowMode, followModesFor, effectiveFollowMode, followChoiceToStore (sessionStorage pro okno) · src/windows/window-selection.ts (origin, bez smyčky) · src/windows/sat-header.ts · strings.ts win.followSelectionState, followModeSwitch, followModeMark, followModeOff, followModeSwitchNote, followModeMarkNote, followSelectionOff · spec 079 K1.3, K2.1 · prace/1112-app-okna-sledovat (7bb1b8b2) -->

<a id="A6.8.2"></a>
### A6.8.2 Když hlavní okno chybí

Okno bez hlavního okna nic neztratí a nic se samo nezavře. Zůstane jen ke čtení s posledními daty.

| Stav | Co okno ukáže | Volby |
|---|---|---|
| hlavní okno je zavřené (3 s bez zprávy od něj) | pruh „Hlavní okno je zavřené · stav k {čas}, jen ke čtení“; položky výzkumu v nabídce osoby pod **Výzkum · jen s hlavním oknem** nejdou použít | **Otevřít Strom**, **Udělat hlavním** |
| strom byl v hlavním okně smazán | „Strom už neexistuje“ místo obsahu | **Zavřít okno** |
| strom je zamčený | „Strom je zamčený · Heslo se zadává v hlavním okně.“ | **Přejít do hlavního okna** |
| hlavní okno přepnulo strom | okno přepne s ním, pohled zůstane, výběr se zruší („{strom} → {strom}“) | – |

- **Hranice:**
  - **Otevřít Strom** otevře nové hlavní okno; okna se k němu připojí a pruh zmizí;
  - **Udělat hlavním** udělá hlavním toto okno: načte strom z úložiště (data v okně mohla být starší než uložená),
    dostane lištu aplikace a pohled zůstane. Když mezitím vzniklo jiné hlavní okno, nestane se nic;
  - obnovení hlavního okna (F5) pruh neukáže.
- **Ovládání:** aplikace: tlačítka v pruhu a místo obsahu okna.
- **Platí od:** aplikace 3.28.0
- **Od aplikace 3.30.0:** když se hlavní okno zavře během sledování výzkumu, stane se hlavním oknem samo jedno
  z dalších oken a sledování pokračuje v něm ([S4.1.7](S4-research-from-the-app.md#S4.1.7)). Když to nejde, okna
  ukážou „Sledování nejde obnovit · hlavní okno se zavřelo“ s **Udělat hlavním** a **Otevřít Strom**.

<!-- zdroj: app:4b1373a7 src/windows/satellite.ts MAIN_SILENCE_MS 3000, lastHeardAt, treeGone · src/windows/sat-states.ts (closed strip mainClosed, treeGone, treeLocked, SWITCHED_TOAST_MS) · src/windows/become-main.ts (zámek ifAvailable, znovunačtení jako hlavní z IndexedDB) · src/windows/window-research-menu.ts researchMainOnly · strings.ts win.mainClosed, openStrom, makeMain, treeGone, treeGoneNote, treeLocked, treeLockedNote, closeWindow, goToMain, treeSwitched · spec 079 K1.5 · prace/1112-app-okna-zaklad (stavy 1–6) -->

<a id="A6.8.3"></a>
### A6.8.3 Druhá karta aplikace

Aplikace otevřená podruhé v obyčejné kartě nebo okně prohlížeče nenačte druhou kopii stromu. Ukáže „Strom už je
otevřený v jiném okně“ s vysvětlením „Ukládá jen jedno okno, aby se úpravy navzájem nepřepisovaly. Další okna se
k němu připojí.“

- **Hranice:**
  - **Přepnout tam** přenese do popředí hlavní okno. Když to prohlížeč nedovolí, karta to řekne a dodá „Tuto kartu
    lze zavřít.“;
  - **Otevřít jako další okno** z karty udělá okno podle [A6.8](#A6.8) s Tabulkou;
  - odkaz otevřený v druhé kartě (osoba, hledání, odkazy výzkumu, soubor otevřený instalovanou aplikací) dostane
    hlavní okno právě jednou: „Odkaz se otevřel v hlavním okně.“;
  - druhá karta nic nezapíše do seznamu stromů ani do Nastavení.
- **Ovládání:** aplikace: **Přepnout tam**, **Otevřít jako další okno**.
- **Platí od:** aplikace 3.28.0

<!-- zdroj: app:4b1373a7 src/windows/window-role.ts (Web Lock strom-main ifAvailable → main, jinak second-tab) · src/windows/second-tab.ts (secondTabSatelliteKind table) · src/windows/window-link.ts (předání odkazu hlavnímu jednou) · src/windows/window-start.ts openLinkFromWindow · strings.ts win.alreadyOpen, alreadyOpenNote, switchThere, openAsWindow, switchFailed, tabCanClose, linkForwarded · CHANGELOG.cs.md 3.28.0 · spec 079 K1.6 · prace/1112-app-okna-zaklad (7d22e396) -->

<a id="A6.8.4"></a>
### A6.8.4 Co výběr v dalším okně udělá v hlavním okně

Osoba vybraná v Tabulce, na Časové ose nebo na Mapě dalšího okna se v hlavním okně vyznačí, nebo se stane jeho
středem. Určuje to skupina **Hlavní okno** v přepínači **Výběr** v hlavičce dalšího okna.

| Volba | Co se stane v hlavním okně |
|---|---|
| **jen vyznačit** (výchozí na Časové ose a na Mapě) | osoba se vyznačí jako v režimu **jen vyznačit** ([A6.8.1](#A6.8.1)); střed zůstane |
| **zaměřit** (výchozí v Tabulce) | osoba se stane středem hlavního okna jako po **Zaměřit** u karty a strom se kolem ní překreslí, i když ji předtím nekreslil |

- **Kde:** volbu mají Tabulka, Časová osa a Mapa dalšího okna (na Mapě výběr osoby u místa; klik na samotné místo nic
  nepošle). Rodina, Potomci a Vějíř dalšího okna mění klikem vlastní střed a v hlavním okně osobu jen vyznačí.
- **Přeskakování po řádcích:** šipky i klik dělají totéž. Hlavní okno osobu vyznačí hned, střed změní až 200 ms po
  posledním výběru a jen na poslední vybranou osobu. Projití řádků šipkami tak změní střed jednou.
- **Oznámení a návrat:** dole uprostřed stromu hlavního okna stojí „Střed vybrán v dalším okně“ s tlačítkem **↶
  {jméno}** (střed před prvním výběrem) a ×. Série výběrů z jednoho okna je v historii hlavního okna jeden krok: jeden
  krok zpět (↩ vlevo dole, Alt+←) nebo ↶ vrátí střed, který byl před ní. Série končí vlastním krokem v hlavním okně
  (Zaměřit, Přejít na, ↩, ↪, jiný pohled), zavřením oznámení, přepnutím volby na **jen vyznačit** a zavřením dalšího
  okna. Přepnutí volby střed nevrací.
- **Osoba, kterou hlavní okno nekreslí** (při **jen vyznačit**): pohled Rodina, Potomci nebo Vějíř hlavního okna řekne
  „{jméno} v tomto pohledu není.“ s **Přejít na** (osoba se stane středem) a ×.
- **Hranice:**
  - hlavní okno, které sleduje agenta výzkumu, osobu jen vyznačí; střed zůstane u agenta
    ([S4.1.7](S4-research-from-the-app.md#S4.1.7)). Jednou za sérii řekne „Sleduje se agent – výběr z dalšího okna se
    jen vyznačí.“; další okno má u volby „(agent)“ a v nabídce „Hlavní okno sleduje agenta – výběr se tam jen
    vyznačí.“ Po pozastavení nebo konci sledování se nic zpětně nepřepne: **zaměřit** platí od dalšího výběru;
  - osoba, která mezitím ve stromu není: střed zůstane, „Vybraná osoba už ve stromu není.“ Oznámení bez × zmizí
    po 6 s;
  - osoba, kterou Tabulka hlavního okna vynechá (filtr, hledání nebo seznam; ne připnutý řádek ani řádek ukázaný
    jen dočasně): střed zůstane, osoba se nevyznačí a oznámení bez jména „Vybraná osoba je v tomto okně skrytá.“
    zmizí po 6 s. Rodina, Potomci a Vějíř nikoho neskrývají;
  - osoba, která už je středem: nic se nestane;
  - při **vypnuto** ve skupině **Toto okno** a když hlavní okno není otevřené, je skupina **Hlavní okno** zašedlá
    s poznámkou „Nedostupné – sdílení výběru je v tomto okně vypnuté.“ nebo „Hlavní okno není otevřené.“; volba
    zůstane uložená;
  - volba platí pro jedno okno a jeho Tabulku, Časovou osu i Mapu, vydrží obnovení okna (F5); každé další okno má
    svou. Dokud se nezvolí, rozhoduje pohled: Tabulka zaměří, Časová osa a Mapa vyznačí. Zvolené **jen vyznačit**
    platí i v Tabulce a vydrží obnovení okna.
- **Ovládání:** aplikace: v hlavičce dalšího okna **Výběr ▾** → **Hlavní okno** · výběr v tomto okně: **jen
  vyznačit**, **zaměřit**. Zavřený přepínač ukazuje, co je zvolené (v úzkém okně zkráceně ikonami); celé znění má
  v bublině.
- **Platí od:** aplikace 3.30.0

<!-- zdroj: app:e7d3bb11 src/windows/follow-mode.ts SendMode mark|focus, SENDING table/timeline/map, sendModeKey (sessionStorage okna), getSendModeChoice · src/windows/sat-header.ts followControlParts (FOLLOW_LABEL_MIN_WIDTH 1280, FOLLOW_BOTH_MIN_WIDTH 1100), followSendGroupState (off, no-main, agent), sendModeName = contextMenu.focus malým písmenem, followControlAria · src/windows/satellite.ts sendMode (followSelection && sendModeAvailable), post select intent, seq · app:edaec740 src/windows/window-focus.ts WINDOW_FOCUS_DELAY_MS 200, take (seq), fire (deleted, hidden, followingAgent, focusId), run push/replace, endRun · src/windows/window-selection.ts wireMainSelection (markNotice not-in-view, VIEW_STEP_EVENT, onSendEnded), src/windows/window-start.ts mainFocusDeps (hidden: () => false, drawn family/descendants/fan) · src/ui/window-notice.ts PLAIN_NOTICE_MS 6000 · strings.ts satFollow.*, mainNotice.* · CHANGELOG.cs.md 3.30.0 · dirigent:spec/110 (rozhodnutí 18. 11. 17:35 a 17:45: „Zaměřit“ = nový střed) · app:docs/ZADANI_DEV_vyber-z-okna.md §1–§7 · app:6be873dc src/windows/follow-mode.ts defaultSendMode (table → focus, jinak mark), parseSendMode, setSendMode (ukládá focus i mark) · app:4927ccab src/ui/table-view/table-ui.ts tableHidesPerson (filtr, hledání, seznam; ne pinOutside, tempShown, sources), src/windows/window-start.ts mainFocusDeps hidden, src/windows/window-focus.ts { kind: 'hidden' }, strings.ts mainNotice (skrytá osoba), e2e/windows-send-focus.spec.ts -->
