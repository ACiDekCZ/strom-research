<a id="A2"></a>
# A2 Načtení rodokmenu (GEDCOM)

Kapitola říká, co aplikace převezme ze souboru GEDCOM z jiného programu, co přeskočí a jak to přizná v souhrnu
importu. Popisuje aplikaci Strom 3.21.2 (a výzkum 1.25.2); změny z novější verze mají u sebe její číslo. Otevření
souboru výzkumu a vazba stromu na výzkum patří do kapitoly S1. Celou cestu rodokmenu z jiného programu (značky
spolehlivosti, ochrana údajů z rodokmenu, karta **Co teď**, export zpět) popisuje [S6](S6-tree-from-another-program.md).

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
- **Od aplikace 3.26.0:**
  - `_UID`, `RIN`, `AFN` a další ID programu (`UID`, `EXID`, `_FSFTID`) se nepřeskakují: uchovají se u osoby a rodiny
    spolu s původním označením záznamu (`@I12@`) jako ID programu ([S6.1](S6-tree-from-another-program.md#S6.1));
  - vlastní značky programu (`_XXX`) přímo u osoby, rodiny a pramene se uchovají pro export **Zpět do {program}**
    ([S6.6](S6-tree-from-another-program.md#S6.6)); hlubší vlastní značky se spočítají;
  - výřezy fotek MyHeritage (`_POSITION`, `_CUTOUT`) jsou evidenční a nepočítají se;
  - rozvod zapsaný před sňatkem (PAF) se neztratí a sňatek nepřepíše; prázdný sňatek nebo rozvod zapsaný před
    jiným s datem (MyHeritage) si nechá datum a místo toho s datem;
  - jméno zapsané jako popis (`Son`, `Unknown`) se vrací tak, jak bylo zapsané, bez poznámky z něj udělané; text na
    řádku údaje (vzdělání, pohřeb, vlastní událost), adresa po částech (`ADR1`, `CITY`…) a webový odkaz v textu
    pramene zůstanou a vrátí se tak, jak je soubor měl.
- **Od aplikace 3.28.0:**
  - `CENS` u osoby je událost osoby **Sčítání lidu** s datem, místem, věkem podle zápisu, domem nebo adresou,
    poznámkou a prameny; ve výběru událostí osoby je hned za **Bydliště**. Import ho tak čte (i ze souboru výzkumu)
    a export ho píše jako `1 CENS` u osoby. Do aplikace 3.27.0 se `CENS` u osoby četl jako vlastní událost se jménem
    „Sčítání lidu“. `CENS` u rodiny zůstává událostí páru. Vlastní události „Sčítání lidu“ ve stromech uložených
    dřív se při úpravě dat pro novou verzi stanou sčítáním lidu, se zálohou ([A10.7](A10-shared-events.md#A10.7));
  - `2 TYPE` pod `CENS` (druh sčítání) se stane prvním řádkem poznámky. Export ho vrátí jako `2 TYPE`, dokud jím
    poznámka začíná;
  - společná událost z jiného programu: RootsMagic, Legacy a Family Historian píšou událost jednou a ostatní osoby
    pod ni (`2 _SHAR @I…@` s rolí `ROLE`, `_ROLE` nebo `RELA` a s poznámkou; Family Historian i `2 _SHAN` se jménem
    osoby bez záznamu). Člen domácnosti (role prázdná, „Household“, „Principal“, „Head“…) dostane kopii společné
    události ([A10.1](A10-shared-events.md#A10.1)); jeho vlastní stejná událost se připojí, nezdvojí se. Jiná role
    než prostý člen domácnosti zůstane jako role kopie. Sčítání, bydliště nebo vlastní událost páru s členy
    domácnosti se stane společnou událostí partnerů a jmenovaných osob. Svědek, kmotr a jiná role jsou účastníci
    události; u události jen pro jednu osobu (křest…) jsou osoby účastníky **Přítomen** s rolí v poznámce;
  - GEDCOM 7: `ASSO` s `3 ROLE GODP`, `WITN`, `CLERGY` nebo `OFFICIATOR` je kmotr, svědek nebo oddávající; jiná role
    je **Přítomen** se slovem role v poznámce (`OTHER` s `PHRASE`, `NGHBR` soused, `FRIEND` přítel …). `ASSO
    @VOID@` s `PHRASE` je účastník zapsaný jménem;
  - značky Stromu pro společnou událost a role čte import podle [A2.7](#A2.7).

<!-- zdroj: app:src/ged-parser.ts:1450 KNOWN_INDI_TAGS, :1453 KNOWN_FAM_TAGS, :1464 KNOWN_RECORD_TYPES, :1478 IGNORED_BOOKKEEPING_TAGS, :636 NOTED_INDI_TAGS, :2094 drop, :2410, :2486, :2194 · strings.ts gedcom.unsupported, gedcom.skippedTags, gedcomNotes.factLabels · 3.28.0: app:34b2174c src/ged-parser.ts EVENT_TAG_TO_TYPE CENS → census (dřív CENS u INDI vlastní událost s gedcomNotes.census), src/ged-exporter.ts EVENT_TAG_TO_TYPE census → CENS, src/events.ts SELECTABLE_EVENT_TYPES (census za residence), src/ui/event-details-ui.ts offeredDetails census (age, address), strings.ts events.census, strings-pl part1 · CENS u FAM coupleEventTypeOfTag · dirigent:prace/1113-app-scitani-u-osoby Výsledek · spec 053 U2 K1.1 · 3.28.0 sdílení: app:80c2ffb9 src/ged-shares.ts (_SHAR, _SHAN, isHouseholdShareRole, convertGedShares, sharRoleWord), src/ged-parser.ts (ASSO ROLE GODP/WITN/CLERGY/OFFICIATOR, OTHER PHRASE, @VOID@ PHRASE; CENS 2 TYPE → první řádek poznámky + gedcomType), src/ged-exporter.ts (2 TYPE zpět), migrace vlastní „Census“ (A10.7) · dirigent:prace/1113-app-sdilena-udalost, 1113-app-085-nalezy Výsledek · spec 085 §7 -->

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
- **Od aplikace 3.26.0:**
  - řádek „Uchováno pro export „Zpět do {program}“: N značek (…)“, když soubor má vlastní značky programu;
  - řádek **Kódování textu** u souboru s odhadnutým nebo jednobajtovým kódováním ([A2.2](#A2.2));
  - po importu souboru jiného programu karta **Co teď** ([S6.4](S6-tree-from-another-program.md#S6.4)); nahrazuje
    dřívější otázky po importu;
  - **Vložit do stromu** si nejdřív uloží zálohu stromu ([S6.5](S6-tree-from-another-program.md#S6.5)).
- **Od aplikace 3.28.0:** řádek „Sdílené události z {program}: n převedeno (m osob)“, když soubor jiného programu
  měl společné události (`_SHAR`, [A2.1](#A2.1)).

<!-- zdroj: app:src/ui/import-export.ts:374 handleGedcomFile, :410 showGedcomResultDialog · app:src/ged-parser.ts:3880 statistiky convertToStrom, :3186 pohlaví · strings.ts gedcom.*, importImages.* · 3.28.0: app:80c2ffb9 strings.ts gedcom.sharedConverted -->

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
- **Od aplikace 3.26.0:**
  - `CHAR CP1250` nebo `WINDOWS-1250` je Windows-1250. `ANSI` znamená kódovou stránku počítače, který soubor psal:
    platné UTF-8 zůstane UTF-8, jinak rozhodnou slova souboru mezi Windows-1250 (střední Evropa: č ř ě ł ż)
    a Windows-1252 (západní Evropa). Stejně se odhadne soubor bez `CHAR` a soubor s `CHAR UTF-8`, který platné UTF-8
    není;
  - když bylo kódování odhadnuté nebo je jednobajtové a soubor má text s diakritikou, souhrn importu ukáže řádek
    **Kódování textu** s **Ukázka jmen:** a volbou jiného kódování (**UTF-8**, **Windows-1250 (střední Evropa)**,
    **Windows-1252 (západní Evropa)**, **ISO-8859-2 (Latin-2)**, **ANSEL (starší GEDCOM)**). Zkomolené znaky ve
    jménech (è místo č, ø místo ř) znamenají, že sedí jiné kódování. **Ovládání:** volba v řádku **Kódování textu**;
  - samostatné záznamy médií `0 @O1@ OBJE` se čtou přes odkazy na ně; fotka rodiny odkázaná takto se jen spočítá.
- **Od aplikace 3.27.0:** fotka rodiny (`1 OBJE` u rodiny, zapsaná na místě i odkazem `@O1@`) se v aplikaci neukáže,
  ale uchová se tak, jak ji soubor zapsal, pro export **Zpět do {program}** ([S6.6](S6-tree-from-another-program.md#S6.6)).
  Záznam média, na který rodina odkazuje, jde zpět jako fotka zapsaná přímo u rodiny. Souhrn importu ji uvádí
  v řádku „Uchováno pro export „Zpět do {program}“…“, ne v **Nepodporováno**. Neplatí pro soubor výzkumu.

<!-- zdroj: app:src/ged-parser.ts:1262 decodeGedcomFile, :1236 decodeAnsel, :1290–1380 předzpracování CONC/CONT, :1683 parseGedcom · app:src/ged-exporter.ts:508 exportToGedcom · index.html input accept=".ged" · 3.27.0: app:a5fc9656 src/ged-parser.ts fam.mediaLinks, keptMedia (řádky záznamu média pod rodinu o úroveň níž), extraBlock OBJE na místě, keepsExtra (ne soubor výzkumu), convertToStrom usedMedia · CHANGELOG.cs.md 3.27.0 · dirigent:prace/1109-app-drobnosti-ged Výsledek bod 5 -->

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
- **Od aplikace 3.27.0:** měsíc a rok číslicemi (`07/1987`, `7/1987`, `07.1987`, `7.1987`) se čtou jako ten měsíc,
  i se značkou nebo slovem před nimi (`ABT`, „cca“, „kolem“, „před“, „po“). Platí jen měsíc 1–12: `13/1987` se jako měsíc
  nečte. Dvojí rok (1699/00) a datum s dnem (12.03.1919) se tak nečtou.
  Data psaná lidsky (`cca 1850`, `14/6/1850`, `mezi 1850-1852`) čte [A2.4.1](#A2.4.1).

<!-- zdroj: app:src/gedcom-date-read.ts:22 parseGedcomDate, :33 gedcomDatePhrase, :55 readGedcomDate · app:src/date-words.ts · app:src/ged-parser.ts:702 kalendář, :1157 gedcomDates · app:src/gedcom-date-form.ts · strings.ts gedcomNotes.datePhrase · 3.27.0: app:655212fd src/gedcom-date-read.ts readGedcomDate numericMonth (/^(\d{1,2})[./](\d{3,4})$/, měsíc 1–12), bareDate · CHANGELOG.cs.md 3.27.0 · dirigent:prace/1109-app-tester-vlna1 (T42) -->

<a id="A2.4.1"></a>
### A2.4.1 Data psaná lidsky

Datum zapsané tak, jak ho lidé píšou, a ne slovy GEDCOM, se čte jako datum. Platí stejně pro pole data (osoba,
událost, svazek), pro import GEDCOM a pro text, který už v datech stromu je (např. z ručně upraveného JSON).

| Zápis (příklad) | Čte se jako |
|---|---|
| `cca 1850`, `asi 1850`, `okolo 1850`, `kolem 1850`, `ca 1850`; i s měsícem nebo dnem | přibližně (`ABT`) |
| `před 1850`, `před 14.6.1850` | před (`BEF`) |
| `po 1850`, `po roce 1850`, `po 6/1850` | po (`AFT`) |
| `14/6/1850`, `cca 14/6/1850` | den, měsíc a rok |
| `1850-1852`, `mezi 1850-1852`, `mezi 1850 - 1852` | rozmezí (`BET … AND`) |
| `mezi 1850-11/1851` | rozmezí od 1850 do listopadu 1851 (`BET 1850 AND NOV 1851`) |
| `1850-11/1851`; v poli data i `1850/1851` | období od–do (`FROM … TO`): od listopadu 1850 do 1851, od 1850 do 1851 |
| `5-7/1850`, `14-15/6/1850` | rozmezí v roce (květen až červenec 1850) nebo v měsíci (14. až 15. 6. 1850) |
| `cca 1850-1852`, `asi 1850-1852` | rozmezí; rozsah sám říká „někdy mezi“, „cca“ se vynechá |

- Slova se čtou i v angličtině, němčině a polštině („about“, „um“, „około“, „zwischen“, „między“ …).
- **Den a měsíc, které jdou zaměnit** (`7/8/1850`: oba do 12 a různé), se čtou podle jazyka aplikace: v češtině,
  němčině a polštině den první, v angličtině měsíc první. Stejný soubor GEDCOM načtený v jiném jazyce aplikace tak
  dá jiné datum. Jednoznačné datum (`25/3/1919`, `3/3/1919`) se čte všude stejně.
- **Import GEDCOM** u zaměnitelného dne a měsíce a u „cca“ před rozsahem nechá vedle data poznámku s původním
  zápisem („Datum v záznamu: Cca 1850-1852“). `Mezi 1850 - 1852` se čte jako rozmezí 1850–1852.
- **Text v datech** se ukáže, řadí, počítá z něj věk a do GEDCOM jde jako datum (`ABT`, `BEF`, `AFT`, `BET … AND`).
  Sám text se nemění; uložení formuláře osoby, události nebo svazku ho zapíše v zápisu aplikace.
- **Hranice:**
  - lomítko mezi dvěma roky (`1850/1851`) čte pole data jako období od 1850 do 1851; import GEDCOM ho nechá textem
    (dva roky jako alternativa);
  - textem zůstane: otazník (`1850?`), neznámé číslice (`18XX`), čtvrtletí (`Q4/1850`), roční období, „nebo“,
    „cca po“ a „cca před“ a slovní hodnoty. Pole data je odmítne jako neplatné datum; import je nechá v poznámce
    „Datum v záznamu: …“ (`Cca po 1850` a `Cca podzim 1850` čte jako „přibližně 1850“ s poznámkou);
  - textem zůstane i datum, které neexistuje (`31/4/1850`), rok s pěti číslicemi a rozsah, jehož začátek je po
    konci;
  - stromy importované dřív se samy neopraví; opraví je nový import GEDCOM.
- **Ovládání:** pole data ve formuláři; import GEDCOM ([A2.1](#A2.1)).
- **Platí od:** aplikace 3.27.0

<!-- zdroj: app:src/dates.ts normalizeDateInput → normalizeDateForm ?? readWrittenForms (readDateWords, readHyphenRange: slovo „mezi“, „cca“ před rozsahem → rozmezí, začátek po konci → null), readWrittenDate (lomítkové datum, zaměnitelné ≤ 12 a různé → assumed), parseFlexDate → parseCanonical ?? readStoredText (text v datech čten v jazyce UI, nemění se), canonicalDate · src/date-words.ts isAboutWord, isBetweenWord · src/gedcom-date-read.ts readGedcomDate (readWrittenDate, lossy → poznámka gedcomDatePhrase) · src/ged-exporter.ts canonicalDate · strings.ts gedcomNotes.datePhrase · commit 7ed8123c · ověřeno voláním normalizeDateInput a parseGedcomDate v cs a en (10. 11.); lomítko: normalizeDateInput('1850/1851') → FROM 1850 TO 1851, '1850-11/1851' → FROM NOV 1850 TO 1851, 'mezi 1850-11/1851' → BET 1850 AND NOV 1851, parseGedcomDate('1850/1851') → text (dirigent:test/vysledek-1110-doc-tabulka-p2.md nález 1, sonda 10. 11. na app f34d41e1) · dirigent:prace/1110-app-tabulka-opravy/t42-tabulka.md (Pravidla opravy, Bez opravy, Rizika); vzory smyšlené -->

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
  archivem; přepis a výřezy na něj nepřejdou. Od aplikace 3.26.0 totéž udělá citace téže strany s jiným datem zápisu
  (`DATA` › `DATE`). Spolehlivost patří citaci ([A2.6.1](#A2.6.1)). `DATA` a `TEXT` uvnitř citace se nečtou. Každý obrázek u pramene je výřez. Jistotu z cizího programu
  aplikace nemění. Jak výzkum `QUAY` převezme jako formu a informaci pramene, říká
  [R3.2.1](R3-verification-and-citation.md#R3.2.1); kdy je údaj doložený,
  [R3.8](R3-verification-and-citation.md#R3.8). Prameny v aplikaci popisuje [A3](A3-evidence-in-the-app.md).
- **Ovládání:** **Spolehlivost pramene** v detailu pramene (**Originál**, **Opis / index**, **Nejisté**).
- **Platí od:** aplikace 1.9.4 (`QUAY`), 3.9.0 (odvozený pramen pro stranu).
- **Od aplikace 3.22.0:** Příběh osoby (`_STORY`) čte a exportuje i odkazy na prameny.
- **Od aplikace 3.27.0:** signatura z `REPO` › `CALN` jde do pole **Signatura** (první `CALN`), ne do
  poznámky; vydavatel a autor zůstávají v poznámce. Export píše knihu jako `1 REPO` s `2 CALN` a jednu čitelnou
  `PAGE` složenou z polí: folium, další umístění, snímek („fol. 12v, č. 5, snímek 34“; slovo pro snímek v jazyce
  aplikace). Číslo, které už další umístění jmenuje, se neopakuje. Pramen bez folia a snímku se exportuje přesně jako
  dřív. Pole pramene popisuje [A3.9](A3-evidence-in-the-app.md#A3.9).

<!-- zdroj: app:src/ged-parser.ts:2140–2230 záznam SOUR, :1700 noteQuay, :3010–3055 citace a odvozené prameny, :3099–3140 převod pramenů · app:src/ui/sources.ts:75 qualityLabel · app:src/ged-exporter.ts pushCitation · strings.ts gedcom.quality1–3, gedcom.reliabilityLabel · research:src/sync.ts:4660 QUAY_EVIDENCE · 3.27.0: app:c3278633 src/ged-parser.ts (REPO jen první, CALN → callNumber), src/ged-exporter.ts (1 REPO / 2 CALN, composePage), src/source-location.ts composePage, imageWord · datum zápisu: app:fcfc71d2 (v3.26.0) pageSources klíč s datem, spec 066 K3.1 -->

<a id="A2.6.1"></a>
### A2.6.1 Spolehlivost u citace

Tentýž zápis bývá pro jeden údaj originálem a pro jiný druhotnou informací: sčítání lidu uvádí povolání z první
ruky, věk z druhé. Proto `QUAY` patří citaci, ne prameni. Pramen má výchozí spolehlivost a citace s jinou hodnotou si
nechá svou.

- **Hlídá kód:**
  - citace téhož zápisu se stejnou stranou, stejným datem zápisu a stejnými dalšími řádky citace, které se liší jen
    `QUAY`, jsou citace jednoho pramene. Pramen je v **Prameny** jednou, i se svými obrázky (`OBJE`);
  - jiná strana nebo jiné datum zápisu dál dělá samostatný pramen pro ten zápis ([A2.6](#A2.6));
  - výchozí spolehlivost pramene je `QUAY` jeho první citace (citace bez `QUAY` bere `QUAY` záznamu, když ho má);
    citace s jiným `QUAY` si ho nechá, citace bez `QUAY` u pramene s výchozí spolehlivostí zůstane bez ní;
  - export (do výzkumu, **Zpět do {program}** i **Ke sdílení s ostatními**) píše u každé citace její `QUAY`:
    vlastní, jinak výchozí pramene. Strom bez citací s vlastní spolehlivostí se exportuje přesně jako dřív. Načtení a nový export proto
    `QUAY` žádné citace nezmění.
- **Strom uložený starší verzí:** při otevření se prameny, které načtení v aplikaci 3.26.0 udělalo jen kvůli jinému
  `QUAY` téže strany, sloučí zpět do svého pramene. Jejich citace se převedou na ten pramen a spolehlivost přejde na
  citaci. Předtím aplikace uloží zálohu **Před úpravou dat pro novou verzi** ([S6.5](S6-tree-from-another-program.md#S6.5)).
  Slučuje se jen pramen, který se od svého liší jedině spolehlivostí; pramen s vlastní poznámkou, přepisem, výřezem
  nebo jiným textem zůstane. Výzkum, se kterým je strom propojený, tím nedostane žádnou změnu (pramen i strana jsou
  stejné) a štítek **Obraz jen ve výzkumu** u sloučeného pramene zmizí ([A3.8](A3-evidence-in-the-app.md#A3.8)).
- **Hranice:** spolehlivost jednotlivé citace se v aplikaci jen ukazuje ([A3.6](A3-evidence-in-the-app.md#A3.6),
  [S7.1](S7-reliability-and-verification.md#S7.1)); měnit jde jen výchozí **Spolehlivost pramene** v editoru
  pramene ([A3.1](A3-evidence-in-the-app.md#A3.1)).
- **Platí od:** aplikace 3.27.0 (ve 3.26.0 udělala citace s jiným `QUAY` druhý pramen bez obrázků)

<!-- zdroj: dirigent:spec/077-spolehlivost-u-citace/spec.md K1.1–K1.7 · app:5721b016 src/ged-parser.ts pageSources (klíč bez quay), citedQuay, citationQuay (null = citace bez QUAY), src/citation-quality.ts citationQuality, setCitationQuality, qualityOnlySources (DERIVED_FIELDS, entryKey), joinQualityOnlySources, src/ged-exporter.ts pushCitation(cited), src/data.ts v19, src/tree-manager.ts joinQualityOnlySourcesOf (createSnapshot pre-migration, fingerprint, rebaseResearchCopies), strings.ts snapshots pre-migration · app:dde0151a src/research-changes.ts citedKey · dirigent:test/vysledek-1111-app-spolehlivost-citace.md (import 1 pramen s obrázkem, round trip QUAY 2/3, migrace v18) -->

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
- **Od aplikace 3.26.0:** ID programů se vracejí pod `_STROM_IMPORT` a `_STROM_XID`; soubor se při novém načtení
  podle nich páruje ([S6.7](S6-tree-from-another-program.md#S6.7)). Soubor s hlavičkou Stromu není rodokmen z jiného
  programu: nemá značku **Z rodokmenu** ani kartu **Co teď**.
- **Od aplikace 3.27.0:** folium, snímek a další umístění pramene se vracejí pod `_STROM_FOLIO`, `_STROM_IMAGE`
  a `_STROM_LOCATOR` vedle složené `PAGE`; se značkami platí pole, ne `PAGE`. Export **Zpět do {program}** ([S6.6](S6-tree-from-another-program.md#S6.6)) pro program, ze
  kterého strom přišel, je nepíše. Výzkumu je aplikace posílá, jen když výzkum říká, že je čte.
- **Od aplikace 3.28.0:** každý export GEDCOM (i **Zpět do {program}**) píše:
  - společnou událost ([A10.1](A10-shared-events.md#A10.1)) u každé osoby zvlášť i s pramenem, aby ji přečetly jiné
    programy, a pod ní `2 _STROM_SHARE` s označením události a `3 _ROLE` s rolí osoby. Jen když jsou v souboru
    aspoň 2 kopie (export části stromu nebo ochrana žijících mohou ostatní vynechat); při novém načtení se kopie
    zase spojí. Nápověda exportu: „Společná událost jde do souboru u každé
    osoby zvlášť i s pramenem, jiné programy ji tak přečtou. Strom ji při dalším importu zase spojí.“;
  - **Kmotrovství** a **Svědek při sňatku** ([A10.5.1](A10-shared-events.md#A10.5.1)) jako `1 EVEN` s `2 TYPE`
    a `2 _STROM_ROLE` (`godparent`, `witness`); je-li v souboru i osoba nebo rodina té události, pod ním
    `3 _STROM_AT` s odkazem na ni a `4 TYPE` se značkou té události (`BAPM`, `MARR` …);
  - odmítnuté propojení kmotra nebo svědka ([A10.5.2](A10-shared-events.md#A10.5.2)) jako `3 _STROM_NOT_LINK @I…@`
    pod účastníkem (`_WITN`, `ASSO`). Odkaz na osobu, která v souboru není, se při načtení zahodí.

<!-- zdroj: app:src/ged-exporter.ts:506 STROM_SEX_U_LINE, :508 exportToGedcom, :680 TYPE married · app:src/ged-parser.ts:2174 _STROM_VERIFIED/_STROM_READ, :2324 výzkumné bloky, :2574 _DRAFT, :2654 _STROM_STATUS, :1914 _STROM_PLACE · app:src/research-link.ts:2936 researchHeaderLines · 3.27.0: app:c3278633 src/ged-exporter.ts sourceFields (false pro výzkum bez sources.fields, nikdy u backTo), src/ged-parser.ts placeFields (s _STROM_* platí pole) · 3.28.0: app:80c2ffb9 src/ged-shares.ts (_STROM_SHARE + _ROLE/ROLE, _STROM_ROLE + _STROM_AT + 4 TYPE, LINK_REJECTED_TAG _STROM_NOT_LINK), src/ged-exporter.ts (_STROM_SHARE jen s ≥ 2 kopiemi v souboru), strings.ts exportHelp sharedEvents -->

<a id="A2.8"></a>
## A2.8 Opakovaný import a sloučení

Každý import jako nový strom založí nový strom; staré stromy se nemění. **Sloučit s existujícím** spáruje osoby ze
souboru s osobami aktuálního stromu a výsledek uloží jako další nový strom ([A8](A8-merging-trees.md)).

- **Hranice:** opakovaný import souboru výzkumu do stromu výzkumu řeší [S1](S1-connecting-app-and-research.md).
- **Ovládání:** **Import → Import GEDCOM → Importovat jako nový strom** nebo **Sloučit s existujícím**.
- **Platí od:** aplikace 1.0.0
- **Od aplikace 3.26.0:** rodokmen téhož programu načtený znovu se páruje i podle ID programu (důvod **Stejné ID
  v souboru**); shoda 50–79 se jen nabídne ([S6.7](S6-tree-from-another-program.md#S6.7)).

<!-- zdroj: app:src/merge/ui.ts:1447 TreeManager.createTree · strings.ts treeManager.importAsNewTree, importDialog.mergeExisting -->
