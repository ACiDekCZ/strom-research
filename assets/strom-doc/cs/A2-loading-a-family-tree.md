<a id="A2"></a>
# A2 Načtení rodokmenu (GEDCOM)

Kapitola říká, co aplikace převezme ze souboru GEDCOM z jiného programu, co přeskočí a jak to přizná v souhrnu
importu. Popisuje aplikaci Strom 3.21.2 (a výzkum 1.25.2); změny z novější verze mají u sebe její číslo. Otevření
souboru výzkumu a vazba stromu na výzkum patří do kapitoly S1.

<a id="A2.1"></a>
## A2.1 Co se načte a co ne

Aplikace převezme osoby, rodiny, prameny, poznámky, události a média, které zná. Co nezná, nepřenese, ale přizná to:
každá nepřenesená značka se započítá do dlaždice **Nepodporováno** a jmenovitě do řádku **Přeskočené záznamy**. Nic se
tiše neztratí na úrovni záznamu ani přímého údaje osoby, rodiny a pramene.

- **Hranice:** Počítají se neznámé záznamy (úroveň 0) a neznámé přímé údaje osoby, rodiny a pramene (úroveň 1).
  Neznámé podrobnosti hlouběji v záznamu (úroveň 2 a níž) se přeskočí bez započtení. Účetní značky jiných programů
  (`_UPD`, `RIN`, `_UID`, `CHAN`, `_PROJECT_GUID`, `_EXPORTED_FROM_SITE_ID`) se přeskočí tiše; nic o rodině neříkají.
  Značky `ANCI`, `DESI`, `RFN`, `AFN` a `RESN` se počítají. Řada údajů bez vlastního místa v aplikaci se nezahodí, ale
  zapíše se do poznámky osoby jako popsaný řádek: požehnání, odchod na odpočinek, společenské postavení, popis,
  identifikační číslo, počet dětí, počet sňatků, majetek, číslo pojištěnce, obecný údaj a „Také uváděn jako“. Výzkumné
  bloky Stromu se z obyčejného souboru nečtou a počítají se (viz [A2.7](#A2.7)).
- **Ovládání:** **Import → Import GEDCOM** (soubor `.ged`). V novém stromu i tlačítko na prázdném stromu. Souhrn viz
  [A2.1.1](#A2.1.1).
- **Platí od:** aplikace 1.9.0 (souhrn nepřenesených značek); poznámkové řádky od aplikace 3.0.0.

<!-- zdroj: app:src/ged-parser.ts:1450 KNOWN_INDI_TAGS, :1453 KNOWN_FAM_TAGS, :1464 KNOWN_RECORD_TYPES, :1478 IGNORED_BOOKKEEPING_TAGS, :636 NOTED_INDI_TAGS, :2094 drop, :2410, :2486, :2194 · strings.ts gedcom.unsupported, gedcom.skippedTags, gedcomNotes.factLabels -->

<a id="A2.1.1"></a>
### A2.1.1 Souhrn importu

Po převodu se otevře okno **Konverze GEDCOM**. Dlaždice **Osob**, **Vztahů**, **Zástupné** a **Nepodporováno** jsou
vždy; **Fotografie**, **Dokumenty**, **Výřezy**, **Prameny** a **Události** jen s nenulovým počtem. Řádek **Přeskočené
záznamy** vyjmenuje značky od nejčastější („`OBJE` ×12“). Další řádky hlásí osoby s neznámým pohlavím a děti zapsané
ve více rodinách. „Vše ze souboru bylo naimportováno.“ se ukáže, jen když nic přeskočeno nebylo. Pohlaví se nehádá z
role v rodině; jiná hodnota než `M` nebo `F` je neznámé pohlaví.

Volby: **Importovat jako nový strom** (aktuální strom zůstane), **Sloučit s existujícím** (viz [A2.8](#A2.8)),
**Uložit jako JSON**; z prázdného stromu ještě **Vložit do stromu**. Zaškrtávátko **Importovat obrázky (výřezy,
přílohy, fotky)** ukáže odhad velikosti. Výchozí stav bere z **Nastavení → Při importu načítat obrázky** a platí jen
pro tento import. Bez obrázků zůstanou přepisy, archivy a odkazy na strany. Cesty a adresy k souborům se nabídnou k
napojení.

- **Od aplikace 3.22.0:** Nad seznamem přeskočených značek je věta, co dlaždice **Nepodporováno** počítá: části
  souboru, které Strom nezná a nepřenesl, ne osoby a vztahy.

<!-- zdroj: app:src/ui/import-export.ts:374 handleGedcomFile, :410 showGedcomResultDialog · app:src/ged-parser.ts:3880 statistiky convertToStrom, :3186 pohlaví · strings.ts gedcom.*, importImages.* -->

<a id="A2.2"></a>
## A2.2 Kódování a verze GEDCOM

Aplikace čte GEDCOM 5.5.1 i GEDCOM 7 a kódování pozná sama. Exportuje vždy GEDCOM 5.5.1 v UTF-8.

- **Hranice:** Kódování určí nejdřív značka BOM (UTF-8, UTF-16 LE a BE). Bez ní rozhodne řádek `1 CHAR` v hlavičce:
  `ANSEL` má vlastní převod (neznámý bajt se ukáže jako „�“), `UNICODE` je UTF-16, `ANSI` je Windows-1252, cokoli
  jiného UTF-8. Konce řádků CR, LF i CRLF jsou rovnocenné. Pokračování `CONC` a `CONT` se spojí; u míst, jmen,
  stránek, adres a poznámek se zachová i mezera na začátku pokračování. Z GEDCOM 7 se čte `SNOTE` jako sdílená
  poznámka a záznamy bez identifikátoru. Samostatné záznamy médií `0 @O1@ OBJE` se nečtou a počítají se do
  **Nepodporováno**; obrázek odkázaný jen ukazatelem tak nepřijde. Balík GEDZIP se nenačte, okno přijímá
  jen `.ged`.
- **Ovládání:** Žádné; kódování se nevolí.
- **Platí od:** aplikace 1.16.0 (převod ANSEL a kódování podle hlavičky).
- **Od aplikace 3.22.0:** Značky GEDCOM 7 `UID`, `CREA` a `EXID` se přeskočí tiše jako účetní údaje; v 3.21.2 se
  počítají do **Nepodporováno**.

<!-- zdroj: app:src/ged-parser.ts:1262 decodeGedcomFile, :1236 decodeAnsel, :1290–1380 předzpracování CONC/CONT, :1683 parseGedcom · app:src/ged-exporter.ts:508 exportToGedcom · index.html input accept=".ged" -->

<a id="A2.3"></a>
## A2.3 Jména a příjmení

Jméno a příjmení se berou z podznaček `GIVN` a `SURN`, jinak z řádku `NAME` podle lomítek. Tituly z `NPFX` a `NSFX` se
drží zvlášť a z řádku se odstraní; bez těchto značek se titul nehádá. Pravidla jsou stejná jako ve výzkumu.

- **Hranice:** Bez lomítek se řádek rozdělí na první mezeře. Text za zavíracím lomítkem patří k příjmení. Zápisy typu
  „N.N.“, „neznámý“, „unknown“, „nieznany“ dají jméno „?“. Popisy místo jména („syn“, „dcera“, „mrtvě narozený“,
  „totgeboren“, „filius“, text v závorce) dají „?“ a slova jdou do poznámky osoby. Další řádky `NAME` jsou varianty.
  Jméno s `TYPE married` nebo `_MARNM` je příjmení po sňatku, ne varianta; poslední takové vyhrává. Je-li vdané jméno
  první a rodné až další, prohodí se. `2 _STROM_PRIMARY Y` označí jméno, kterým osoba chodí. Osoba bez jména i
  příjmení je zástupná osoba (dlaždice **Zástupné**). Skupiny variant příjmení a rody řeší
  [A4](A4-surnames-and-families.md).
- **Ovládání:** Žádné; výsledek se upraví v kartě osoby.
- **Platí od:** aplikace 3.10.0 (tituly), 3.13.0 (příjmení po sňatku), 3.18.0 (`_STROM_PRIMARY`).

<!-- zdroj: app:src/gedcom-names.ts:197 readGedcomName, :114 splitNameLine, :85 noName, :96 notAName, :260 stripTitles · app:src/ged-parser.ts:1404 readMarriedSurname, :2250 varianty, :2955 prohození TYPE -->

<a id="A2.4"></a>
## A2.4 Data a jejich tvary

Data GEDCOM se převedou na tvar aplikace: `3 JUN 1900` na den, `JUN 1900` na měsíc, `1900` na rok. Odhad (`ABT`,
`EST`, `CAL`, `INT`) je „přibližně“, `BEF` „před“, `AFT` „po“, `BET … AND` a `FROM … TO` rozmezí. Co se do tvaru
nevejde, zůstane v poznámce osoby, nic se nezahodí.

- **Hranice:** Dvojí rok (1699/00) drží první rok. Jiný kalendář než gregoriánský se odstraní a poznámka řekne „Datum
  v juliánském kalendáři: …“ (také židovský, francouzský revoluční, římský). Text v závorce se zachová jako „Datum v
  záznamu: …“. Neznámý měsíc nechá jen rok s poznámkou. Slova v češtině, slovenštině, polštině, němčině, ruštině a
  ukrajinštině („po“, „před“, „kolem“, „mezi … a“, „nach“, „około“) se čtou jako značky jen tehdy, když za nimi stojí
  platné datum; „po válce“ zůstane textem. Věk u události (`AGE`) se zapíše jako „61 let“, `INFANT` jako „kojenec“.
  Tvar data, který by aplikace zapsala jinak (např. `EST` nebo `CAL`), se pamatuje u osoby a vztahu. Export ho vrátí v
  původní podobě, dokud se datum nezmění.
- **Ovládání:** Žádné.
- **Platí od:** aplikace 3.0.0 (poznámky k datům), 3.7.0 (slova jazyků), 3.17.0 (zachované tvary).

<!-- zdroj: app:src/gedcom-date-read.ts:22 parseGedcomDate, :33 gedcomDatePhrase, :55 readGedcomDate · app:src/date-words.ts · app:src/ged-parser.ts:702 kalendář, :1157 gedcomDates · app:src/gedcom-date-form.ts · strings.ts gedcomNotes.datePhrase -->

<a id="A2.5"></a>
## A2.5 Vztahy a stav páru

Rodina (`FAM`) dá vztah dvou partnerů a jejich děti. Stav páru určí sňatky a rozvody v pořadí souboru; datované
události se porovnají podle data. Značka `_STAT` má přednost před událostmi.

- **Hranice:** `_STAT` zná hodnoty sezdaní, rozvedení, odloučení a nesezdaní partneři (anglicky `married`, `divorced`,
  `separated`, `partners`, `unmarried`, `cohabiting` aj.). Rozvod a nový sňatek téhož páru dají poznámku „Rozvod …,
  nový sňatek …“. Stejný pár ve dvou rodinách se spojí. Třetí partner v jedné rodině se nepřenese a počítá se. Rodina
  s jedním rodičem dostane zástupného druhého rodiče „?“. Rodina bez dětí a bez rodiče zůstane jen tehdy, když něco
  říká (sňatek, datum, pramen, poznámka). Dítě zapsané ve více rodinách se ukáže u rodné rodiny; ostatní se zapíší do
  poznámky („Rovněž zapsáno jako osvojené dítě rodičů …“). Osvojení a pěstounství se čte z `PEDI` a přesněji z `_FREL`
  a `_MREL`. Export píše `_STAT` jen pro nesezdané a odloučené páry.
- **Ovládání:** Žádné; stav se upraví ve vztahu v kartě osoby.
- **Platí od:** aplikace 3.0.0 (`_STAT`), 1.16.0 (dítě ve více rodinách), 3.8.0 (další události páru).
- **Od aplikace 3.22.0:** Čte se i `_RELATIONSHIP_STATUS`; v 3.21.2 se počítá do **Nepodporováno**. Hodnoty obou
  značek se poznají i česky, polsky a německy („manželé“, „rozvedeni“, „druh a družka“, „rozwiedzeni“,
  „Lebensgemeinschaft“). Neznámá hodnota se počítá do **Nepodporováno**. Mají-li rodina obě značky, vyhrává `_STAT`.

<!-- zdroj: app:src/ged-parser.ts:1496 resolveUnionStatus, :1545 statusFromStat, :1563 přednost _STAT, :3453 dítě ve více rodinách, :2684 PEDI · app:src/ged-exporter.ts:70 GEDCOM_STAT · strings.ts gedcom.otherFamilyLinks -->

<a id="A2.6"></a>
## A2.6 Prameny, citace a QUAY

Záznam pramene (`SOUR`) dá pramen aplikace: název, archiv, signaturu, přepis (`TEXT`), odkaz a výřezy. Citace u
narození a úmrtí doloží narození a úmrtí osoby, citace u osoby osobu, citace u rodiny pár. Hodnocení `QUAY` se ukáže
jako **Spolehlivost pramene**: 3 je **Originál**, 2 **Opis / index**, 1 a 0 **Nejisté**.

- **Hranice:** Bez `TITL` se vezme zkratka `ABBR`, jinak „?“. Vydavatel, autor a signatura v archivu jdou do poznámky
  pramene. Citace se stranou (`PAGE`) jinou než u pramene vytvoří odvozený pramen pro tu stranu se stejným názvem a
  archivem; přepis a výřezy na něj nepřejdou. `QUAY` záznamu má přednost před `QUAY` citace a u každého pramene platí
  první citace. `DATA` a `TEXT` uvnitř citace se nečtou. Každý obrázek u pramene je výřez. Jistotu z cizího programu
  aplikace nemění. Jak výzkum `QUAY` převezme jako formu a informaci pramene, říká
  [R3.2.1](R3-verification-and-citation.md#R3.2.1); kdy je údaj doložený,
  [R3.8](R3-verification-and-citation.md#R3.8). Prameny v aplikaci popisuje [A3](A3-evidence-in-the-app.md).
- **Ovládání:** **Spolehlivost pramene** v detailu pramene (**Originál**, **Opis / index**, **Nejisté**).
- **Platí od:** aplikace 1.9.4 (`QUAY`), 3.9.0 (odvozený pramen pro stranu).
- **Od aplikace 3.22.0:** Příběh osoby (`_STORY`) čte a exportuje i odkazy na prameny.

<!-- zdroj: app:src/ged-parser.ts:2140–2230 záznam SOUR, :1700 noteQuay, :3010–3055 citace a odvozené prameny, :3099–3140 převod pramenů · app:src/ui/sources.ts:75 qualityLabel · app:src/ged-exporter.ts pushCitation · strings.ts gedcom.quality1–3, gedcom.reliabilityLabel · research:src/sync.ts:4660 QUAY_EVIDENCE -->

<a id="A2.7"></a>
## A2.7 Vlastní značky Stromu a co se vrací

Export aplikace píše vlastní značky s předponou `_STROM`, aby se při novém načtení vrátilo to, co GEDCOM 5.5.1 neumí.
Hlavička `1 SOUR STROM` říká, že soubor psal Strom.

- **Hranice:** Při exportu a novém načtení se vrací: příjmení po sňatku (jako druhé `NAME` s `TYPE married`), jméno,
  kterým osoba chodí, rodové linie, skupiny variant příjmení, otázky a příběhy osoby, stav údajů, druh a otisk
  obrázků, ověření přepisu (`_STROM_VERIFIED`), čtení záznamu, výřezy s ořezem, rodiny bez páru (`_STROM_NO_COUPLE`),
  poměr dítěte k rodičům a svědci. Z exportu se nevrací: kdo přepis četl (`_STROM_READ`), obrázek vynechaný kvůli
  velikosti a záznamy míst. Výzkumné bloky (rozpory, hypotézy, hledání, vazby, ostrovy, koncepty) se čtou jen ze
  souboru výzkumu a export aplikace je nepíše. Soubor bez hlavičky Stromu se čte bez jeho zvyklostí: popisy místo
  jména jdou do poznámky ([A2.3](#A2.3)). Řádky vazby na výzkum v hlavičce (`_STROM_TREE` aj.) řeší S1 a S2.
- **Ovládání:** **Export → Export GEDCOM**.
- **Platí od:** aplikace 3.9.0 nebo dřív (jednotlivé značky přibývaly do 3.19.0).

<!-- zdroj: app:src/ged-exporter.ts:506 STROM_SEX_U_LINE, :508 exportToGedcom, :680 TYPE married · app:src/ged-parser.ts:2174 _STROM_VERIFIED/_STROM_READ, :2324 výzkumné bloky, :2574 _DRAFT, :2654 _STROM_STATUS, :1914 _STROM_PLACE · app:src/research-link.ts:2936 researchHeaderLines -->

<a id="A2.8"></a>
## A2.8 Opakovaný import a sloučení

Každý import jako nový strom založí nový strom; staré stromy se nemění. **Sloučit s existujícím** spáruje osoby ze
souboru s osobami aktuálního stromu a výsledek uloží jako další nový strom ([A8](A8-merging-trees.md)).

- **Hranice:** opakovaný import souboru výzkumu do stromu výzkumu řeší [S1](S1-connecting-app-and-research.md).
- **Ovládání:** **Import → Import GEDCOM → Importovat jako nový strom** nebo **Sloučit s existujícím**.
- **Platí od:** aplikace 1.0.0

<!-- zdroj: app:src/merge/ui.ts:1447 TreeManager.createTree · strings.ts treeManager.importAsNewTree, importDialog.mergeExisting -->
