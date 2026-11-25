<a id="A14"></a>
# A14 Správa stromů a změna struktury

Stromy v aplikaci se spravují v jednom okně, **Správa stromů**. Co se se stromem má stát (nový strom z výběru, kopie,
rozdělení, spojení s jiným stromem, přidání ze souboru), nabízí jedna položka **Změnit strukturu…**. U každé volby je
napsané, který strom se změní. Ke každému výzkumu patří jen jeden strom; kopie a nové stromy jsou bez výzkumu
([S1.10](S1-connecting-app-and-research.md#S1.10)). Kapitola popisuje aplikaci Strom 3.32.0; změny z novější verze
mají u sebe její číslo.

<!-- zdroj: dirigent:spec/139-zmenit-strukturu-dialog · app:a9bc0b6b src/structure-options.ts, src/ui/structure-ui.ts · 518c9654, e9f50b62 src/ui/structure-select-ui.ts · 3110125c, fbd97361 src/ui/tree-management.ts, src/tree-row.ts · bcb2a0fa, 023879dd, f3c66503 · strings.ts structure.*, treeManager.* · dirigent:prace/1123-app-139-* -->

<a id="A14.1"></a>
## A14.1 Správa stromů

Správa stromů ukazuje všechny stromy v aplikaci, každý ve stejném řádku se stejnými fakty. Údaje řádku se berou
z rejstříku stromů; data stromu se kvůli nim nečtou.

- **Řádek stromu:**
  - název a značky **Otevřený**, **Zamčený**, **Skrytý**;
  - „N osob · M párů · velikost · upraveno …“. Strom, který má část obrázků společnou s jiným stromem (kopie,
    sloučení), má u velikosti „· obrázky sdílené“. Nápověda při najetí: „Část obrázků má strom společnou s jiným
    stromem: velikost je počítá, místo ale zabírají jen jednou.“ ([S8.7](S8-where-the-data-are.md#S8.7));
  - řádek původu, první, který platí:

    | Strom | Řádek |
    |---|---|
    | strom, který patří k výzkumu | „Výzkum {číslo}“ a přepínač **Výzkum zapnutý** ([S1.9](S1-connecting-app-and-research.md#S1.9)) |
    | kopie stromu | „kopie stromu „{název}“ · bez výzkumu“ a vypnutý přepínač ([S1.10](S1-connecting-app-and-research.md#S1.10)) |
    | nový strom z výběru | „výřez ze stromu „{název}“ · bez výzkumu“ |
    | strom ze souboru | „z GEDCOM {soubor} · bez výzkumu“, „ze souboru {soubor} · bez výzkumu“ |
    | ostatní | „bez výzkumu“ |

  - strom sledovaný živě má „◎ Sleduje se živě“, a když do něj zápis čeká, i „· zápis do stromu stojí“;
  - strom se sloučeními má odkaz **Historie sloučení (N)** ([A8.11](A8-merging-trees.md#A8.11));
  - tlačítka **Otevřít** (ne u otevřeného stromu), **Změnit strukturu…** ([A14.2](#A14.2)), **Export…** a ⋯
    **Další akce**.
- **Rozpracovaná sloučení** stojí pod stromem, do kterého zapíšou: „Rozpracované sloučení: {zdroj} → {cíl}“, „N k
  rozhodnutí“ (stejné číslo jako krok 2 průvodce), kolik dvojic je prohlédnutých, „uloženo …“, a odkazy
  **Pokračovat**, **Přejmenovat**, **Zahodit**. Sloučení, jehož cílový strom byl smazán, je v oddílu **Rozpracovaná
  sloučení bez stromu** s poznámkou „cílový strom byl smazán“.
- **⋯ Další akce** u stromu, po skupinách oddělených čarou:
  1. **Přehled stromu**, **Statistiky** ([A13](A13-tree-statistics.md#A13)), **Kvalita dat**, **Zálohy**, **Historie
     sloučení** (jen se sloučením), **Historie změn**;
  2. výzkum: **Přehled výzkumu** (telefon a tablet), **Poslat úpravy do výzkumu** (jen strom, který k výzkumu
     patří), a jeden řádek výzkumu: u kopie **Zapnout výzkum…**, jinak nastavení výzkumu, **Začít výzkum** nebo
     instalace;
  3. **Přejmenovat…**, **Výchozí osoba a pohled** ([A6.1.1](A6-views.md#A6.1.1)), **Otevírat při spuštění**,
     výchozí nastavení osy života, u otevřeného stromu **Místa** a **Tvary příjmení**;
  4. **Změnit strukturu…**;
  5. **Skrýt strom** / **Zobrazit strom**, **Zamknout strom** / **Odemknout strom**;
  6. **Smazat strom…**.
- Pata okna: **Exportovat vše**, **Nový strom**, **Zavřít**. Od 6 stromů je nad seznamem pole **Hledat strom…**.
- **Puštění na řádek:** soubor GEDCOM nebo strom Strom (`.json`) puštěný na řádek stromu otevře průvodce sloučením
  s tímto stromem jako cílem; řádek stromu přetažený myší na jiný řádek ho do toho stromu sloučí přes průvodce.
  Řádek pod taženým souborem je čárkovaně orámovaný a říká „Pustit: přidat {soubor} do stromu {strom}“
  ([A8.5.1](A8-merging-trees.md#A8.5.1)).
- **Hranice:**
  - zamčený strom má v ⋯ jen čtení a **Odemknout**; strom uložený novější verzí aplikace jen čtení;
  - **Duplikovat**, **Sloučit do jiného stromu…**, **Rozdělit** a **Oddělit nespojené části** v ⋯ nejsou; jsou
    v **Změnit strukturu…**. Oddělit nespojené části nabízí dál i import ([S6.4](S6-tree-from-another-program.md#S6.4))
    a Přehled stromu v **Rychlé akce** ([A5](A5-tree-check.md));
  - kopie stromu výzkumu nemá akce výzkumu, jen **Zapnout výzkum…**.
- **Ovládání:** **Akce › Strom › Správa stromů…**; přepínač stromů → **Správa stromů…**; na telefonu list stromů
  → **Správa stromů ›**.
- **Platí od:** aplikace 3.32.0

<!-- zdroj: app:3110125c src/ui/tree-management.ts renderTreeManagerList (stats z indexu, badges, canStructure, pendingRow, mergeFacts subPending 134 S-P2, pendingOrphans, targetGone, searchable ≥ 6) · fbd97361 src/tree-row.ts treeOriginLine (research → copy → fromTree → importedFrom → none) · src/ui/tree-actions.ts treeActionGroups (overview, research, settings, structure, manage, delete, trees; manageTrees jen mimo správu) · 7b967fd8 strings.ts treeManager.imagesShared, imagesSharedTip (134 S-P1) · bcb2a0fa (kopie s vypnutým přepínačem, ◎ Sleduje se živě, zápis stojí) · strings.ts structure.research, followed, writeStopped, fromTree, fromGedcom, fromFile, mergeHistory, pendingRow, savedAt, pendingOrphans, targetGone, treeManager.* · app:73ee4625 src/tree-drop.ts, src/ui/tree-management.ts (puštění na řádek) · strings.ts mergeWizard.dropOnTree -->

<a id="A14.2"></a>
## A14.2 Změnit strukturu…

Okno **Změnit strukturu: {strom}** nabízí všechno, co ze stromu udělá jiný strom nebo co do něj přidá, ve třech
skupinách. U každé volby je napsané, který strom se změní: „Co se má se stromem stát. U každé volby je napsané,
který strom se změní.“

| Skupina | Volba | Co se stane |
|---|---|---|
| **Nový strom** | **Z výběru…** | rod, seznam osob, linie nebo pohled; vznikne nový strom ([A14.3](#A14.3)) |
| | **Kopie celého stromu** | vznikne kopie bez napojení na výzkum ([A14.3](#A14.3)) |
| **Rozdělit** | **Na rodiny…** | podle rodů, větví nebo pohledu osoby vzniknou nové stromy ([A14.4](#A14.4)) |
| | **Oddělit nespojené části…** | z částí, které nic nespojuje, vzniknou nové stromy ([A14.4](#A14.4)) |
| **Spojit** | **Výběr nebo celý strom do jiného stromu…** | přes průvodce sloučením; změní se cílový strom, jde vrátit ([A14.5](#A14.5)) |
| | **Z jiného stromu do tohoto stromu…** | jiný strom aplikace přes průvodce sloučením; změní se tento strom, jde vrátit ([A14.5](#A14.5)) |
| | **Přidat ze souboru do tohoto stromu…** | GEDCOM nebo soubor Strom (JSON) přes průvodce sloučením; změní se tento strom, jde vrátit ([A14.5](#A14.5)) |

Nový strom, kopie i rozdělení původní strom nemění.

- **Šedá volba** ukazuje pod sebou důvod:
  - **Z výběru…** a **Přidat ze souboru…** u stromu, který není otevřený: „Po otevření stromu.“ s odkazem
    **Otevřít strom {název}** (otevře strom a okno znovu);
  - **Oddělit nespojené části…** u stromu, který je celý spojený: „Strom je celý spojený.“ U velkého stromu se to
    počítá na pozadí a volba zůstane aktivní, dokud to není jisté;
  - **Výběr nebo celý strom do jiného stromu…**, když jiný strom není: „Není jiný strom.“ Cíl, do kterého teď
    zapisovat nejde, volbu nezašedí: proč, řekne průvodce sloučením ([A8.5](A8-merging-trees.md#A8.5));
  - **Přidat ze souboru…** u stromu sledovaného živě: „Strom se sleduje živě, zapisovat do něj teď nejde.“
    s odkazem **Ukončit sledování**;
  - **Z jiného stromu do tohoto stromu…**, první důvod, který platí: „Není jiný strom.“ → „Po otevření stromu.“ →
    „Strom se sleduje živě, zapisovat do něj teď nejde.“ s odkazem **Ukončit sledování**.
- Všechny volby jsou vidět bez posouvání na obrazovce notebooku 1366 × 657 i 1024 × 768, i se šedými volbami
  a důvody pod nimi. Kde je pod okrajem okna ještě něco, spodek okna se rozplyne.
- **Hranice:** zamčený strom a strom jen ke čtení okno nemají (položka chybí). Na volbách má okno **Zavřít**, na
  dalších krocích **Zpět** · **Zrušit** a tlačítko kroku; otevřené ze Správy stromů se do ní vrátí.
- **Ovládání:** **Akce › Strom › Změnit strukturu…**; Správa stromů, tlačítko **Změnit strukturu…** v řádku stromu
  i v ⋯; na telefonu z nabídky **Další** u stromu. Šipky nahoru a dolů, Home a End přecházejí mezi aktivními
  volbami.
- **Platí od:** aplikace 3.32.0

<!-- zdroj: app:a9bc0b6b src/structure-options.ts (OPTIONS, STRUCTURE_GROUPS, blocked: select notOpen, parts connected, into noOther, file notOpen/followed+stopFollowing; readOnly bez dialogu), src/ui/structure-ui.ts structureOptionRow (důvod pod volbou, Ukončit sledování), structureOpenTree, structureRunOption, arrowKeys · defe53b4 (Zavřít na volbách, Zpět · Zrušit · primární na krocích) · 45d5be44 (telefon) · strings.ts structure.intro, group.*, opt*, why*, openTree, research.stop · app:5e85dfc1 src/structure-options.ts (from: noOther → notOpen → followed + stopFollowing) · fef250eb, f4050b1c (všechny volby bez posouvání do 1366 × 657 a 1024 × 768, rozplynutí spodku okna) · dirigent:spec/139 K3.2, K3.3 -->

<a id="A14.3"></a>
## A14.3 Nový strom z výběru a kopie celého stromu

**Z výběru…** vede dvěma kroky: **Koho vzít** a **Souhrn**. **Kopie celého stromu** jde rovnou na souhrn. Výsledek je
nový strom bez výzkumu; původní strom se nemění.

- **Koho vzít:** sedm zdrojů, pod každým „Vybráno: …“ se skutečným počtem osob:

  | Zdroj | Co vezme |
  |---|---|
  | **Aktuální pohled** | „Osoby, které jsou teď na obrazovce:“; jen v pohledu Rodina nebo Potomci, jinak šedý s „Jen v pohledu Rodina nebo Potomci.“ |
  | **Rod / příjmení** | jeden rod; malé rody jsou ve složeném řádku **Další rodiny** |
  | **Seznam osob** | linie výzkumu, **Pevné seznamy**, **Automatické seznamy** ([A11](A11-lists-of-people.md#A11)); pole **Hledat seznam…** |
  | **Předci osoby** | osoba a počet generací 1–10 nebo všechny |
  | **Potomci osoby** | totéž dolů |
  | **Přímá linie osoby** | „Přímá linie: předci a potomci osoby, bez sourozenců a jejich rodin.“, generace nahoru i dolů |
  | **Ručně** | osoby vybrané jedna po druhé |

- **Souhrn:** „{Co} – nový strom dostane:“ (u kopie „Kopie dostane celý strom {název}:“) a počty osob, párů, pramenů
  a obrázků podle stejných pravidel, podle kterých strom vznikne. S vybraným dítětem přejde i jeho druhý rodič.
  Obrázky se jen počítají, do paměti se nenačítají. Velký výběr se počítá po dávkách („Počítá se… N z M osob“)
  a **Vytvořit strom** (**Vytvořit kopii**) čeká na konec počítání.
- **Samostatné části:** osoby napojené jen přes nevybrané lidi budou v novém stromu samostatně: „N osob je
  napojených jen přes nevybrané lidi a bude v novém stromu samostatně.“ **Ukázat jména (N)** je vypíše i s tím, kdo
  je spojuje („spojuje {jméno}“).
- **Název:** nový strom „{strom} — {co}“ (třeba „Horákovi — rod Vlková“), kopie první volný z „{strom} (kopie)“,
  „{strom} (kopie 2)“, „(kopie 3)“… Název, který už jiný strom má, pole řekne pod sebou („Strom s tímto názvem už
  existuje.“) a uložit jde dál. Volný název bere i kopie stromu vloženého sdíleným odkazem.
- **Po vytvoření:** aplikace přejde na nový strom, na jeho výchozí osobu uprostřed, a ohlásí „Vytvořen strom „{název}“
  (N osob).“ s akcí **Zpět na {původní strom}**. Kopie vrátí okno, ze kterého přišla.
- **Hranice:**
  - z výběru jde jen u otevřeného stromu; kopie i u zavřeného;
  - nový strom ani kopie nejsou napojené na výzkum: „Původní strom se nemění. Nový strom není napojený na výzkum.“;
    u kopie „…vlastní výzkum jde zapnout později ve Správě stromů.“ ([S1.10](S1-connecting-app-and-research.md#S1.10));
  - nový strom z výběru má ve Správě stromů původ „výřez ze stromu „{název}““, kopie „kopie stromu „{název}““;
    kopie kopie nese název té kopie.
- **Ovládání:** **Změnit strukturu…** › **Z výběru…**, **Kopie celého stromu** (nahrazuje dřívější **Duplikovat**).
- **Platí od:** aplikace 3.32.0

<!-- zdroj: app:518c9654, b79b55ad, 1ff40d37 src/ui/structure-select-ui.ts (WHO_KINDS, CUT_VIEWS family/descendants, paneList selectionLines + pevné/automatické, panePerson generace 1–10/všechny, directNote, summarizeSubsetSteps po dávkách, create disabled do konce) · src/structure-options.ts summarizeSubset, keptWithGlue (druhý rodič vybraného dítěte), islands · e9f50b62 (Duplikovat → souhrn kopie, bez dialogu názvu) · 7b967fd8 src/tree-copy-name.ts freeCopyName, treeNameTaken (134 S-N4) · 21989997 (nový strom na výchozí osobě) · src/tree-manager.ts duplicateTree copyOf · strings.ts structure.kind.*, chosen, summaryLead, copyLead, islands, islandVia, showNames, defaultName, keepNote, copyKeepNote, create, createCopy, counting, imagesNotLoaded, createdToast, backTo, treeManager.duplicateSuffix, duplicateSuffixN, duplicateNameTaken -->

<a id="A14.4"></a>
## A14.4 Rozdělit

Rozdělení dělá z jednoho stromu několik nových. Původní strom zůstává přesně, jak je; nechtěný jde smazat ve Správě
stromů.

- **Na rodiny…** otevře okno **Rozdělit na rodiny**. **Co je jedna rodina:**
  - **Rody podle příjmení:** děti patří k rodiči, jehož příjmení nesou; přivdaná či přiženěná osoba bez vlastní
    rodiny zůstává u partnera;
  - **Větve stromu:** hlavní linie se všemi přivdanými a přiženěnými a každá připojená větev zvlášť;
  - **Z pohledu osoby:** základní strom je linie zvolené osoby (přímí předci, jejich pokrevní sourozenci, vlastní
    sourozenci, všichni potomci); **Rodiny sourozenců nechat po** bratrance, druhé bratrance nebo nikoho; další
    základní stromy přes **Přidat osobu…**; **Řezy na sourozencích** volí, čí rodina bude vedlejší strom.

  Stejný strom se rozdělí vždy stejně; zobrazená osoba určí jen, která rodina je první. Nové stromy zůstávají
  propojené přes společné osoby. Tlačítko **Vytvořit N stromů**.
- **Oddělit nespojené části…** otevře **Nespojené části tohoto stromu**: rodiny, mezi kterými nevede žádný rodič,
  dítě ani sňatek, s počtem osob a nejstarší osobou. Vybrané se vyčlení do nových stromů (**Vyčlenit N**), každý
  pojmenovaný podle své části. Strom, který je celý spojený, tuhle volbu nemá ([A14.2](#A14.2)).
- **Hranice:** **Na rodiny…** jde i u stromu, který není otevřený: návrhy se ukážou hned, seřazené od výchozí osoby
  stromu (bez ní od první osoby); rozdělení na osobě nezávisí.
- **Ovládání:** **Změnit strukturu…** › **Na rodiny…**, **Oddělit nespojené části…**; po importu souboru s víc
  rodinami **Oddělit nespojené části…** ([S6.4](S6-tree-from-another-program.md#S6.4)); Přehled stromu, **Rychlé
  akce** ([A5](A5-tree-check.md)). Z obou oken vede cesta zpět do Změnit strukturu.
- **Platí od:** aplikace 3.32.0 (v okně Změnit strukturu); rozdělení samo je starší

<!-- zdroj: app:src/ui/split-families-ui.ts (kopie, originál nedotčen), src/split-families.ts · src/ui/split-ui.ts (nespojené části, components.ts) · src/ui/structure-ui.ts structureRunOption families (aktivní: showSplitFamiliesDialog, jinak showSplitFamiliesPickerDialog), parts showSplitDialog · 3e3b6c35 (cesta zpět do Změnit strukturu, oddělená část pojmenuje svůj strom, části spočítané jednou) · strings.ts splitFamilies.*, split.* -->

<a id="A14.5"></a>
## A14.5 Spojit

Spojení vede vždy přes průvodce sloučením ([A8.5](A8-merging-trees.md#A8.5)): kam, kdo je kdo, co se změní.
Zapíše se až po potvrzení v průvodci a jde vrátit ([A8.12](A8-merging-trees.md#A8.12)).

- **Výběr nebo celý strom do jiného stromu…** otevře **Spojit do jiného stromu**, krok „co spojit“:
  - **Celý strom {název}:** do cílového stromu se přidá, co v něm chybí;
  - **Výběr…:** krok **Koho vzít** jako u nového stromu ([A14.3](#A14.3)); jen u otevřeného stromu. Pod výběrem
    stojí, kolik partnerů průvodce vezme navíc: „S nimi přejdou i 2 partneři, druzí rodiče vybraných dětí – celkem
    9 osob.“ Import se v průvodci jmenuje „{strom} — {co}“.

  **Pokračovat k průvodci** otevře průvodce, kde se vybere cílový strom. Tento strom se nemění.
- **Z jiného stromu do tohoto stromu…** otevře **Přidat z jiného stromu**, krok „z kterého stromu“: „Který strom
  přidat do tohoto stromu. Vybírá se celý; zúžit ho jde v prvním kroku průvodce.“ Nabízí všechny ostatní stromy
  aplikace podle abecedy, i skryté a kopie, každý s „N osob · řádek původu · Skrytý“ ([A14.1](#A14.1)). **Pokračovat
  k průvodci** otevře průvodce sloučením s vybraným celým stromem jako importem a tímto stromem jako cílem
  ([A8.5](A8-merging-trees.md#A8.5)). Vybraný strom se nemění; tento strom se změní až po potvrzení v průvodci
  a sloučení jde vrátit (**Zpět** v oznámení, **Historie sloučení**). Dlouhý název bez mezer se na telefonu zalomí
  v řádku.
- **Přidat ze souboru do tohoto stromu…:** **Soubor GEDCOM (.ged)** (z jiného programu: MyHeritage, Geni, Ancestry,
  Gramps…) nebo **Soubor Strom (.json)** (export ze Stromu, třeba od příbuzného). Po výběru souboru se otevře
  průvodce sloučením s tímto stromem jako cílem. Do stromu se nic nezapíše, dokud to průvodce nepotvrdí.
- **Hranice:** když teď žádný strom sloučení vzít nemůže, okno Změnit strukturu zůstane a průvodce řekne proč.
  Přidat ze souboru a z jiného stromu jde jen do otevřeného stromu, který není sledovaný živě. Co se po sloučení pošle do výzkumu,
  řeší [A8.13](A8-merging-trees.md#A8.13).
- **Ovládání:** **Změnit strukturu…** › **Výběr nebo celý strom do jiného stromu…**, **Z jiného stromu do tohoto
  stromu…**, **Přidat ze souboru do tohoto stromu…**; soubor nebo řádek stromu puštěný na řádek Správy stromů
  ([A8.5.1](A8-merging-trees.md#A8.5.1))
- **Platí od:** aplikace 3.32.0

<!-- zdroj: app:f0c5a3fb src/ui/structure-ui.ts structureJoinWhatStep, structureJoin (whole → showMergeTreesDialog, selection → structureWhoStep mode join → mergeSubsetInto „{strom} — {co}“), structureFileStep (startGedcomImportPlain, startJsonImportIntoTree) · 29d02a8c joinPartners · strings.ts structure.joinTitle, joinWhatIntro, joinWhole, joinWholeDesc, joinSelection, joinSelectionDesc, joinNote, continueGuide, joinPartners, fileTitle, fileGed*, fileJson*, fileNote · app:5e85dfc1 src/ui/structure-ui.ts (from: ostatní stromy podle abecedy, persons · treeOriginText · hiddenBadge; celý strom jako import, otevřený strom cíl) · fef250eb (dlouhý název na telefonu) · strings.ts structure.optFrom, optFromDesc, fromTitle, fromStep, fromIntro, fromNote · dirigent:spec/139 K3.2 -->
