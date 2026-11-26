<a id="A4"></a>
# A4 Rody a příjmení

Kapitola popisuje, jak aplikace ze stromu skládá rody a jak zachází s příjmeními. Patří sem rodné příjmení, příjmení
po sňatku, ženské tvary a spojené tvary jednoho jména.
Popisuje aplikaci Strom 3.21.2. Změny z novější verze mají u sebe její číslo.
Jak se jména dostanou do stromu z GEDCOM, popisuje [A2](A2-loading-a-family-tree.md).

<a id="A4.1"></a>
## A4.1 Rod a jeho zakladatel

Rod je linie po meči od nejstaršího známého nositele jména. Aplikace ho počítá jen z dat stromu a ukládá pouze ruční
opravy, takže stejný strom dá vždy stejné rody.
Rod určuje zakladatel, ne příjmení. Jedno příjmení tak může mít několik nespojených rodů a jeden rod může mít několik
zápisů jména.

Každá osoba má jeden rodný rod. Aplikace ho najde po „rodiči v linii“:

| Situace | Rodič v linii |
|---|---|
| Je zapsaný otec | otec, i když je příjmení dítěte zapsané jinak |
| Dítě nese příjmení matky a ne otcovo | matka (dítě patří do jejího rodného rodu) |
| Otec chybí a dítě nenese příjmení matky | nikdo, dítě zakládá vlastní rod |
| Osoba bez použitelného příjmení | otec, jinak matka |

- **Hranice:**
  - Bez použitelného příjmení je zástupná osoba, osoba bez příjmení a žena zapsaná pod příjmením manžela, pokud nemá
    zapsaného otce. Taková osoba rod nikdy nerozdělí ani nezaloží.
  - Nevlastní a pěstounský rodič rod nepředává. Adoptivní rodič ho předává, když jiný otec zapsaný není.
  - Rod vznikne jen tam, kde je aspoň jedna skutečná osoba s příjmením. Zakladatel je osoba na vrcholu linie, pokud je
    skutečná a má příjmení. Jinak je to nejstarší nositel jména v nejvyšší generaci, která nějakého má.
  - Jiný zápis příjmení v linii rod nerozdělí. Ukáže se jako nepotvrzený tvar rodu, viz [A4.7](#A4.7).
  - „Nejstarší známý“ neznamená doložený. Doložení osoby určuje [R3.8](R3-verification-and-citation.md#R3.8), na rod
    nemá vliv.
  - Dcera zůstává členkou rodu svého otce. Manželka, která se do rodu přivdala, se v rodu ukazuje vedle členů, ale do
    členů se nepočítá.
- **Ovládání:** **Přehled stromu → Rody**. Detail rodu ukazuje **Obce**, **Tvary jména** a **Členové po generacích**;
  generace se číslují římsky od zakladatele.
- **Platí od:** aplikace 3.19.0

<!-- zdroj: app:src/lineage.ts:1 hlavička modulu · :296 fatherOf · :317 surnameLooksMarried · :328 birthSurname · :393 computeLineages (kroky 1–4) · :756 rodGenerations · strings.ts treeOverview.rods.intro -->

<a id="A4.1.1"></a>
### A4.1.1 Ruční úprava rodu

Výpočet jde opravit v dialogu **Upravit rod…** (detail rodu nebo nabídka **Akce rodu** u řádku **Rod** osoby).

| Úprava | Prvek | Co se stane |
|---|---|---|
| Jiný zakladatel | **Zakladatel → Změnit…** | linie nad vybranou osobou rod nepředá |
| Samostatná linie | **Založit rod od osoby…** (u osoby **Založit rod od této osoby…**) | osoba a její potomci tvoří nový rod |
| Návrat | **Vrátit automatického** | rod je zase podle výpočtu |
| Tvar jména | **+ tvar**, **Odebrat tvar** | změní tvary příjmení celého stromu ([A4.7](#A4.7)) |

- **Hranice:**
  - Před každou změnou se ukáže náhled **Co se stane** s počty členů a přivdaných. Změna je jeden krok zpět: „Každou
    změnu jde vrátit (Zpět, Historie změn).“
  - Přidaný tvar může dva rody sloučit a odebraný tvar může rod rozdělit. Rody spojuje vztah rodič–dítě, ne tvar jména
    („Linie nespojuje tvar, ale vztah rodič–dítě.“).
  - Strom jen ke čtení a sledovaný strom jdou jen prohlížet. Měnit lze jen otevřený strom.
  - U stromu propojeného s výzkumem dostane výzkum opravu rodu stejně jako skupiny tvarů (odeslání změn viz S2).
- **Platí od:** aplikace 3.19.0

<!-- zdroj: app:src/lineage.ts:1036 LineageChange · :1176 applyLineageChange · :1247 previewOverride · src/ui/lineage-edit-ui.ts · src/ged-exporter.ts _STROM_LINE · strings.ts lineage.edit.*, lineage.preview.* -->

<a id="A4.2"></a>
## A4.2 Rodný rod, přivdaní a přiženění

Karta osoby a stránka osoby mají řádek **Rod**. Člen rodu má u něj rodný rod a případně „· vdala se do rodu …“ nebo „·
přiženil se do rodu …“. Kdo se do rodu přivdal, má „manželka v rodu …“ nebo „manžel v rodu …“ a případně „· rodný rod
…“.

- **Hranice:**
  - Jako manželka nebo manžel se osoba ukáže, když vlastní rod nemá, když je její rod jen ona sama, nebo když je její
    rod malý ([A4.3](#A4.3)) a sňatek vede do velkého rodu. Jinak se ukáže jako člen.
  - Rodný rod manžela nebo manželky se jmenuje jen tehdy, když má víc než jednu osobu.
  - Zástupná osoba a osoba bez rodu a bez sňatku do rodu řádek nemají.
  - Ve stránkách a exportu s ochranou žijících se řádek u žijící osoby ukáže jen při volbě **Plná data** nebo
    **Ponechat jen příjmení**.
- **Ovládání:** nabídka **Akce rodu** u řádku: **Ukázat rod ve stromu**, **Upravit rod…**, **Založit rod od této
  osoby…**, **Kniha rodu…**. Rod jako výběr osob v pohledu na strom popisuje [A6.6](A6-views.md#A6.6).
- **Platí od:** aplikace 3.19.0

<!-- zdroj: app:src/lineage.ts:793 marriedInto · :857 personRodRow · src/lineage-row.ts:40 personRodRowValue · :70 rodRowShown · strings.ts lineage.row.* -->

<a id="A4.3"></a>
## A4.3 Malé rody a Další rodiny

Rod s nejvýš 4 skutečnými členy je malý. Přivdaní a přiženění se do těch 4 nepočítají. Malé rody stojí pod **Další
rodiny** (do 4 osob), velké rody mají vlastní řádek.

- **Hranice:**
  - Do **Dalších rodin** nepatří rod, který tvoří jediná osoba přivdaná nebo přiženěná do jiného rodu. Takový rod není
    v seznamu rodů vůbec; osoba je vidět u rodu, do kterého se přivdala.
  - Dvě odlišná pravidla: velký rod se od stejnojmenných rodů odlišuje jen proti jiným velkým, malý proti všem
    ([A4.4](#A4.4)).
- **Ovládání:** **Přehled stromu → Rody → Další rodiny**. V liště nástrojů **Výběr ▾ → Rody → Další rodiny**
  ([A6.6.1](A6-views.md#A6.6.1); do aplikace 3.30.0 **Rody → Další rodiny**).
- **Platí od:** aplikace 3.19.0

<!-- zdroj: app:src/lineage.ts:72 SMALL_ROD_MAX_MEMBERS · :710 isMarriedInOnly · :722 otherFamilyRods · strings.ts treeOverview.rods, familyPages.otherFams -->

<a id="A4.4"></a>
## A4.4 Pořadí a názvy rodů

Rod se jmenuje příjmením zakladatele. Rod, který založila žena, nese tvar prvního muže v linii. Mají-li rod stejné
jméno jako jiné rody, dostane do závorky rozlišení.

| Pořadí rozlišení | Příklad |
|---|---|
| nejčastější obec rodu, když ji jiný rod nemá | Horák (Brno) |
| rok zakladatele, když ho jiný rod nemá | Horák (1702) |
| křestní jméno zakladatele | Horák (Jan) |
| křestní jméno a rok | Horák (Jan, 1702) |

- **Hranice:**
  - Rody jsou seřazené od největšího podle počtu skutečných členů, při shodě podle narození zakladatele.
  - Rok zakladatele je rok narození, jinak křtu, jinak nejstaršího záznamu. Přibližný rok se čte „asi“.
  - Obec zakladatele je místo narození, jinak křtu, jinak první událost s místem.
  - Řazení v přehledu: **velikost** (členové a přivdaní), **nejstarší** (začátek rodu), **abecedně** (podle názvu v
    jazyce aplikace). Volba se pamatuje v zařízení, ne ve stromu.
  - Od 20 velkých rodů má přehled hledání a ukáže prvních 20 rodů, zbytek po rozbalení. Hledá se v názvu, tvarech
    jména, obcích a jménech členů.
  - Časová osa rodů je zaokrouhlená na 50 let.
- **Ovládání:** **Přehled stromu → Rody**, pole „Hledat rod, obec nebo osobu…“. Oddíl **Rody** nabídky **Výběr ▾**
  v liště nástrojů má stejné pořadí a názvy, s **Další rodiny** ([A6.6.1](A6-views.md#A6.6.1)).
- **Platí od:** aplikace 3.19.0 (seznam **Rody** v liště nástrojů 3.21.0, od 3.31.0 oddíl **Rody** nabídky **Výběr ▾**)

<!-- zdroj: app:src/lineage.ts:393 computeLineages (řazení) · :567 summarise · :672 founderYearOf · :938 rodLabel · src/rods-overview.ts:23 rodSize · :33 sortRods · :46 AXIS_STEP · :79 rodMatches · :98 ROD_SEARCH_FROM · :114 founderPlace · src/ui/tree-overview.ts:160 RODS_SORT_KEY -->

<a id="A4.5"></a>
## A4.5 Ženské a mužské tvary příjmení

Aplikace páruje mužský a ženský tvar příjmení jako jedno jméno: Horák a Horáková, Vlk a Vlková, Jaworski a Jaworska.
Párování platí pro hledání, slučování osob, rody a návrh příjmení po sňatku.

| Pravidlo | Kdy platí | Příklad |
|---|---|---|
| polské -ski/-cki/-dzki ↔ -ska/-cka/-dzka | mužský tvar vždy | Jaworski → Jaworska |
| české -ský ↔ -ská, -ý ↔ -á | v českém stromu | Lomský ↔ Lomská |
| české + -ová, -a → -ová | v českém stromu | Horák → Horáková, Vlk → Vlková |
| vypadlé e před k, c, l | v českém stromu | Jalůvek → Jalůvková, Krušec → Krušcová |
| nesklonné -ů, -í, -ých | nikdy se nemění | Macků, Kočí |

- **Hranice:**
  - Strom je český, když aplikace běží v češtině, nebo když některé příjmení či skupina tvarů obsahuje české písmeno
    (á é í ý č ď ě ň ř š ť ů ž ú ľ ĺ ŕ ä ô). Písmeno ó strom českým nedělá.
  - Mimo český strom se česká pravidla nepoužijí. Ivanova se tak nepáruje s Ivan.
  - Ženský tvar -ska/-cka/-dzka mimo český strom patří k -ski. V českém stromu zůstává pod českými pravidly, protože
    může jít o zápis bez diakritiky (Liska místo Liška). Jaworski se s Jaworska páruje i tak, ale hledání „Jaworski“
    ženu zapsanou jako Jaworska nenajde.
  - Polský tvar musí mít před koncovkou -i/-a aspoň 4 znaky. Příjmení kratší než 3 znaky ženský tvar nedostane.
  - Z -ová zpět se zkouší všechny možné mužské tvary (Jalůvková → Jalůvk, Jalůvka, Jalůvek). Kmen musí mít aspoň 3 znaky,
    jinak se -ová čte jako přídavné jméno (Nová → Nový).
  - Tvary, které spojí uživatel ([A4.7](#A4.7)), platí vždy, i mimo český strom.
- **Od aplikace 3.22.0:** Strom s převahou polských příjmení je polský a česká pravidla nedostane ani při aplikaci
  v češtině (Nowak nedostane tvar Nowaková). Ženský tvar -ska se páruje s -ski v každém stromu, kde -ski je.
- **Platí od:** aplikace 1.16.0 (polské tvary 3.21.2)

<!-- zdroj: app:src/surnames.ts (v3.21.2):29 CZECH_LETTERS · :39 POLISH_ADJECTIVAL · :42 polishPair · :64 genderRulesApply · :69 ruleForms · :89 czechRulesApply · :132 masculineForm · :164 masculineCandidates · :192 feminineForm · :263 sameSurname · HEAD src/surnames.ts treeSignals · CHANGELOG.cs.md 3.21.2, 3.22.0 -->

<a id="A4.6"></a>
## A4.6 Příjmení po sňatku a používané příjmení

Osoba má rodné **Příjmení** a zvlášť **Příjmení po sňatku**. Rodné příjmení určuje rod a tvary jména. Příjmení po
sňatku slouží k zobrazení a hledání.

Když je u ženy příjmení po sňatku prázdné, editor osoby nabídne „Návrh: …“ z příjmení manžela, přechýlené podle
[A4.5](#A4.5). **Použít** ho vyplní, **Skrýt návrh** ho skryje a stejný návrh se už nenabídne.

- **Hranice:**
  - Manžel je muž ze svazku, který je nebo byl sňatkem (i rozvedeným). Ze sňatků s datem vyhrává ten s posledním
    datem, jinak poslední v pořadí. Svazek bez sňatku návrh nedá.
  - Zástupný manžel návrh nedá. Návrh se nenabídne, když se shoduje s rodným příjmením.
  - Mimo platnost pravidel se nabídne příjmení manžela beze změny (Brenntaler).
  - Pole **Příjmení po sňatku** je vidět, když je vyplněné, u ženy se svazkem, nebo po **+ příjmení po sňatku**.
  - **Používané příjmení** (**Rodné** / **Po sňatku**) se ukáže jen pod vyplněným příjmením po sňatku. Hodí se třeba
    po rozvodu.
- **Ovládání:** zobrazení všech osob mění **Nastavení → Karta osoby → Zobrazení příjmení**:

| Volba | Používá příjmení po sňatku | Používá rodné |
|---|---|---|
| **Rodné** | Marie Horáková | Marie Horáková |
| **Po sňatku (roz. rodné)** (výchozí) | Marie Vlková (roz. Horáková) | Marie Horáková (dříve Vlková) |
| **Po sňatku** | Marie Vlková | Marie Horáková (dříve Vlková) |

  Poznámka „dříve“ je jen v detailu osoby (nabídka karty, panel vztahů, hlavička editoru), ne na kartách.
- **Od aplikace 3.22.0:** u ženy má pole rodného příjmení nápovědu „Příjmení z narození“ a prázdné příjmení po
  sňatku říká, že sem patří příjmení získané sňatkem.
- **Platí od:** aplikace 3.13.0 (používané příjmení 3.18.0)

<!-- zdroj: app:src/married-suggestion.ts:46 suggestionHusband · :65 wifeSurnameOf · :83 suggestMarriedSurname · src/person-name.ts:46 surnameDisplay · :79 shownNameParts · src/ui/person-modal.ts:1483 refreshMarriedSurname · strings.ts person.*, settings.surnameDisplay, name.* -->

<a id="A4.6.1"></a>
### A4.6.1 Více sňatků: příjmení z posledního sňatku

Osoba, která má víc jmen po sňatku, má jako **Příjmení po sňatku** to z posledního sňatku, ne poslední zapsané.
Ostatní jména po sňatku jsou v **Další tvary jména**.

Marie Horáková má dva sňatky: roku 1880 (manžel Jan Vlk) a roku 1900 (manžel Josef Jaworski). Výzkum zapsal
nejdřív „Marie Jaworska“, potom „Marie Vlková“. **Příjmení po sňatku** je Jaworska, „Marie Vlková“ je v **Další tvary
jména**.

- **Hranice:**
  - Sňatek je svazek, který je nebo byl sňatkem (i rozvedený); svazek bez sňatku (**Partneři**, **Odloučení**) se
    nepočítá.
  - Vyhrává jméno, jehož příjmení patří partnerovi ze sňatku s nejpozdějším datem. Sňatky bez data přicházejí na
    řadu až po nich, od posledního v pořadí sňatků ([A6.4](A6-views.md#A6.4)).
  - Příjmení patří partnerovi i přechýlené (Vlk → Vlková, Jaworski → Jaworska), bez ohledu na velikost písmen
    a diakritiku, i ve stromu, kde pravidla tvarů ([A4.5](#A4.5)) ženský tvar nedávají.
  - Jméno, které žádnému partnerovi nepatří, přichází na řadu až za nimi; když nepatří žádné, platí poslední
    zapsané.
  - Nevybraná jména po sňatku zůstávají v **Další tvary jména** i se svými křestními jmény. Nic se nemaže.
  - Platí při načtení stromu z výzkumu i souboru GEDCOM jiného programu (`NAME` s `TYPE married` i `_MARNM`).
    Výzkum řadí jména po sňatku ve svém souboru pro aplikaci podle stejného pravidla, aktuální na konec, a aplikace
    jeho pořadí bere, jak je. U staršího výzkumu a u souboru jiného programu pravidlo počítá aplikace sama. Starší
    aplikace bere poslední zapsané jméno, takže od výzkumu dostane také to aktuální.
- **Proč:** jména po sňatku přibývají v pořadí, v jakém je výzkum najde: novější příjmení třeba z úmrtního zápisu
  dřív než starší z oddacího. Poslední zapsané tak nemusí být to z posledního sňatku.
- **Ovládání:** jiné příjmení po sňatku se zvolí ručně ([A4.6.2](#A4.6.2)).
- **Platí od:** aplikace 3.31.0, výzkum 1.36.0 (dřív platilo poslední zapsané jméno po sňatku)

<!-- zdroj: app:bb706ed0 src/married-suggestion.ts marriagePartnersLatestFirst (married|divorced; s datem od nejpozdějšího, pak bez data od posledního v marriagesInOrder), surnameOfSpouse (surnameKey, wifeSurnameOf, feminineForm, masculineFormIn), lastMarriageSurnameIndex (bez shody Infinity, shoda → poslední v pořadí souboru) · src/ged-parser.ts readMarriedSurname (TYPE married, _MARNM), chooseLastMarriageName (nevybrané do nameVariants s křestními), MARRIED_LAST_TAG (se značkou bez přepočtu) · test src/__tests__/married-surname-last-marriage.test.ts · research:5476514e src/core/married.ts marriagesOf (union partners|separated mimo), marriedInOrder, namesInOrder · src/gedcom/export.ts (Strom soubor: jména po sňatku na konci, aktuální poslední; HEAD _STROM_MARRIED_LAST) · spec 010 K4.1, K4.3, K4.4 · dirigent:prace/1120-app-010-posledni-snatek, 1120-vyzkum-010-posledni-snatek -->

<a id="A4.6.2"></a>
### A4.6.2 Ruční změna příjmení po sňatku

Změna **Příjmení po sňatku** na jiné příjmení (v editoru osoby nebo v tabulce) je volba uživatele: dřívější příjmení
po sňatku zůstane v **Další tvary jména** a zvolené z nich odejde.

- **Hranice:**
  - Oprava pravopisu (stejné příjmení, jiná jen diakritika nebo velikost písmen) ani vymazání pole do dalších tvarů
    nic nepřidá.
  - Dřívější jméno si nechá svá vlastní křestní jména, pokud je mělo.
  - Výzkum volbu převezme jako aktuální jméno po sňatku a drží ji proti pravidlu [A4.6.1](#A4.6.1), i po nových
    záznamech a novém sňatku, dokud se v aplikaci nezvolí jiné. Ostatní jména po sňatku ve výzkumu zůstávají.
  - Jméno po sňatku, které výzkum ještě nemá, výzkum přidá a rovnou ho vezme jako aktuální.
  - Volbou je jen změna proti verzi, kterou aplikace od výzkumu dostala. Aplikace, která novější verzi ještě
    nenačetla, nic nevolí.
  - Jméno, kterým se osoba ve výzkumu ukazuje (`strom name primary`, [R10.5](R10-people-and-hypotheses.md#R10.5)),
    má přednost před volbou z aplikace.
  - Volba jména, které výzkum mezitím odebral nebo odvolal ([R10.5.1](R10-people-and-hypotheses.md#R10.5.1)), se
    nepřevezme.
  - S výzkumem starším než 1.36.0 se ruční volba při dalším načtení stromu vrátí podle pravidla
    [A4.6.1](#A4.6.1).
- **Proč:** aktuální nemusí být příjmení z posledního sňatku, třeba po rozvodu ponechané příjmení.
- **Ovládání:** volbu nastaví jen aplikace (pole **Příjmení po sňatku**); terminál pro ni příkaz nemá. Při převzetí
  ukáže `strom sync` řádek „aktuální jméno po sňatku — …“, `strom sync undo I…` volbu vrátí.
- **Platí od:** aplikace 3.31.0, výzkum 1.36.0

<!-- zdroj: app:bb706ed0 src/data.ts updatePerson (marriedBefore/marriedNow, surnameKey: oprava pravopisu nic nepřidá, vymazání nic nepřidá, dřívější s marriedFirstName do nameVariants, zvolené z nameVariants pryč) · src/ui/table-view/table-ui.ts updatePerson · research:5476514e src/core/sync.ts name.now (porovnání se základem _STROM_HEAD, off: odebrané od základu nebo retractedNames, shown/primaryName přednost), apply name.now (addName kind married, marriedNow), undo name.now · src/core/married.ts marriedInOrder (primary > marriedNow > pravidlo) · assets/lang/cs.json ui.sync.name.now, ui.sync.do.name.now · strings.ts person.marriedSurname, nameVariants „Další tvary jména“ · spec 010 K4.2, K4.4 · ZADANI_VYZKUM_prijmeni-posledni-snatek.md „Odpověď výzkumu“ (odchylky) · Name.marriedNow a HEAD _STROM_MARRIED_LAST se nepopisují (vnitřní) -->

<a id="A4.7"></a>
## A4.7 Tvary příjmení stromu a návrhy z výzkumu

Různé zápisy jednoho jména (Horák, Horak, Horrák) jde spojit ve skupinu. Skupina platí pro celý strom: hledání,
slučování osob i rody pak berou tvary jako jedno jméno, i u osob přidaných později.

- **Hranice:**
  - Skupina, která se překrývá s jinou, se s ní spojí do jedné.
  - Odebraný tvar si strom pamatuje jako odmítnutou dvojici.
  - Tvar jedné osoby (přezdívka, jméno po statku) patří do **Další tvary jména** u osoby, ne do skupin stromu. Hledání ([A4.8](#A4.8)) i slučování osob
    porovnávají i tyto tvary; po sloučení zůstanou tvary obou osob a tvar, který prohrál ve sporu o jméno, přibude
    mezi ně.
  - **Navrhnout z výzkumu** zobrazí návrhy výzkumu ve dvou úrovních: **Doloženo** a **Podle pravidel**, každý s
    důvodem a doklady. Nic se nespojí bez potvrzení (**Přijmout** / **Odmítnout**, **Vrátit**).
  - Návrhy se nenabídnou, když jsou odmítnuté, už leží v jedné skupině, nebo by spojily dvě skupiny. Ukazuje se 10
    návrhů, další po **Ukázat dalších …**.
  - **Přijmout všechny doložené** a **Přijmout všechny, které se liší jen diakritikou** se ukážou od 2 návrhů.
  - „Návrhy jsou k dispozici, když výzkum běží.“ Bez výzkumu se ukážou naposledy načtené návrhy. Přijatá skupina
    „výzkumu odejde s odesláním změn“ (S2).
- **Ovládání:** **Nastavení stromu → Tvary příjmení…** (jen u otevřeného stromu), **Propojit**, **Zrušit propojení**,
  **Navrhnout z výzkumu**. Tvar jednoho rodu: **Upravit rod… → + tvar** ([A4.1.1](#A4.1.1)).
- **Platí od:** aplikace 1.15.0 (návrhy z výzkumu 3.17.0)

<!-- zdroj: app:src/surnames.ts:291 addSurnameGroup · :329 removeSurnameForm · src/surname-suggest.ts:197 isRejected · :208 suggestionGroup · src/ui/surname-suggest-ui.ts:41 PAGE · src/ui/surnames-ui.ts · src/ui/tree-actions.ts:217 · strings.ts surnames.*, surnameSuggest.* · src/merge/matching.ts:197 writtenSurnames · src/merge/executor.ts:781 addLosingNameVariant, :951 nameVariants -->

<a id="A4.8"></a>
## A4.8 Hledání a řazení jmen

Hledání osoby nevidí velká a malá písmena, diakritiku ani interpunkci. Osobu najde pod rodným příjmením, příjmením po
sňatku, všemi jejich tvary ([A4.5](#A4.5), [A4.7](#A4.7)) a pod jejími dalšími tvary jména.

| Shoda dotazu | Pořadí |
|---|---|
| začátek křestního jména | 1. |
| začátek příjmení | 2. |
| začátek celého jména | 3. |
| uvnitř křestního jména, pak uvnitř příjmení (dřív v textu je výš) | 4.–5. |
| jiný tvar příjmení nebo jména: začátek, pak uvnitř | 6.–7. |
| víc slov rozložených mezi jméno a jiný tvar | 8. |
| rok narození | 9. |
| příčina úmrtí nebo dům (jen hledání v liště nástrojů) | 10. |

- **Hranice:**
  - Při shodě i bez dotazu se řadí podle „příjmení jméno“, abecedou prohlížeče.
  - Když osobu najde jen příjmení, které jméno na kartě neukazuje, výsledek ho uvede pod jménem („po sňatku …“, „roz.
    …“, „dříve …“).
  - Latinská a německá podoba křestního jména (Wenceslaus, Wenzel × Václav) se páruje jen při porovnání přečteného
    dokumentu se stromem, ne v hledání.
- **Ovládání:** hledání v liště nástrojů, výběr osoby a pole příjmení v rozšířeném filtru.
- **Platí od:** aplikace 3.0.0 (příjmení po sňatku v hledání 3.13.0)

<!-- zdroj: app:src/name-search.ts:26 searchableSurnames · :82 surnameMatchesQuery · src/merge/matching.ts:38 normalizeName · src/person-picker.ts:18 sortByName · :28 calculateMatchScore · :98 hiddenSurnameMatchHtml · src/search-filter.ts:95 · src/given-names.ts -->

<a id="A4.8.1"></a>
### A4.8.1 Stejná jména ve výběru osoby

Když se ve výsledku hledání opakuje stejné jméno, má každý takový řádek pod jménem druhý, šedý řádek s nejkratším
údajem, který ho od ostatních stejnojmenných odliší. Řádek s jedinečným jménem vypadá jako dřív.

- **Kdy:** stejné je to, co řádek ukazuje: jméno s tituly a poznámkou rodného nebo dřívějšího příjmení, a rok
  narození, když ho seznam za jménem píše. Porovnává se jako při hledání, bez velkých a malých písmen a diakritiky.
  Počítá se v celém výsledku, i v řádcích za prvními 50.
- **Pořadí údajů:**
  1. roky: „* 1820 – † 1866“, jen známé části a jen rok. Rok narození, který seznam píše za jménem, se neopakuje;
  2. partner: „⚭ jméno“; při víc sňatcích první partner, kterého ostatní řádky nemají;
  3. rodiče: „dcera: otec a matka“ (u muže „syn:“, bez pohlaví „dítě:“), jen známí rodiče;
  4. místo: „rodiště …“, bez něj „bydliště …“ (poslední bydliště s místem).
- **Hranice:**
  - údaje se berou v tomto pořadí, dokud kombinace žádnému jinému řádku skupiny neodpovídá. Ukáže se z nich jen
    to, co je známé a co nemají stejné všechny ostatní řádky skupiny, spojené „ · “. Sestry se stejnými rodiči tak
    rozliší rodiště, ne rodiče; dvě „Radegunda Pokusná“ narozené 1900 mají „⚭ Bohuchval Zkoušek“ a „⚭ Sudivoj Pokus“, ne
    „* 1900 · ⚭ …“. Údaj, který mají stejný jen některé řádky, se ukáže;
  - když řádek odliší jen údaj, který u něj není známý, ukáže se jeho první známý údaj, který nemají stejný všichni
    ostatní, a když takový není, „bez dalších údajů“. Řádek, který od jiného neodliší nic, ukáže všechny své známé
    údaje;
  - osoba nalezená podle údaje (příjmení po sňatku, příčina úmrtí, dům, [A4.8](#A4.8)) má jeden řádek: rozlišení
    a za „ · “ nález. Rok, který už nález říká („† 1866 …“), se v rozlišení neopakuje;
  - řádek rozlišení seznam nerozšíří: delší konec se zkrátí „…“. Celý text je v bublině řádku a čtečka obrazovky
    řádek přečte jako „jméno, rozlišení“;
  - na telefonu má seznam šířku obrazovky.
- **Kde:** každý výběr osoby z pole: hledání v liště, přidání vztahu, zjištění vztahu, čtení
  dokumentu, výchozí osoba stromu a další. Výběr osoby pro cestu předků na mapě ([A6.5.4](A6-views.md#A6.5.4)) má
  vlastní seznam a rozlišení nemá.
- **Ovládání:** nic: platí samo. Klávesy a načítání po 50 řádcích beze změny.
- **Platí od:** aplikace 3.28.0

<!-- zdroj: app:f5d56ed3 src/picker-distinguish.ts rowKey (shownNameParts + birthNoteText, rok narození jen se showBirthYear, normalizeSearchText), distinguishFeatures (roky * – †, bez roku v řádku a bez části, kterou říká nález; partner první, kterého jiné řádky nemají; rodiče otec, matka, ostatní, bez zástupných; rodiště, jinak poslední bydliště s místem), distinguishLine (nejkratší předpona údajů, kterou nemá nikdo jiný; jinak první známý; jinak distNone), PickerDistinguisher (celý výsledek, i za 50) · src/person-picker.ts renderItem (person-picker-dist, nález na jednom řádku za „ · “, role option, aria-label a title „jméno, rozlišení“) · index.html .person-picker-dist (výpustka, min-width 330 px, telefon 100vw) · všechny new PersonPicker (search.ts, relation-modal.ts, kinship-ui.ts, read-document-ui.ts, tree-management.ts …); PathPersonPicker samostatný · strings.ts personPicker.distNone, distChild, distAnd, distBorn, distLived · app ac34f598 · dirigent:prace/1113-app-drobnosti-1112 · ZADANI_DEV_drobnosti-1112 §1 · app:1c4b7d19 distinguishLine (údaj shodný u všech ostatních řádků skupiny se vynechá; jinak první známý nesdílený; bez rozlišení vše) · dirigent:spec/085 A4.8.1 -->

<a id="A4.8.2"></a>
### A4.8.2 Rozsah hledání: Celý strom, Přímá linie, V pohledu

Výsledky hledání osoby jde zúžit na přímou linii jedné osoby nebo na osoby, které pohled právě ukazuje. Přepínač
**Rozsah hledání** je v hlavičce rozbalených výsledků: **Celý strom**, **Přímá linie**, **V pohledu**.

- **Přímá linie** je osoba sama, všichni její předci a všichni její potomci, bez partnerů, sourozenců a
  zástupných osob. Řádek pod přepínačem řekne čí: „Přímá linie: Jan Horák · s předky a potomky“.
- **V pohledu** jsou osoby, které pohled právě ukazuje: nakreslený strom nebo vějíř, výběr na mapě, řádky tabulky
  po filtru („V pohledu: Tabulka po filtru · 24 osob“).
- **Čí linie:**
  - v liště nástrojů osoba ve středu pohledu; na mapě a v tabulce hlavní osoba stromu („Přímá linie: Jan Horák,
    hlavní osoba stromu · s předky a potomky“): osoba z **Výchozí osoba a pohled** ([A6.1.1](A6-views.md#A6.1.1)),
    bez ní první osoba stromu;
  - ve výběru osoby v dialogu osoba, ze které se dialog otevřel; v Materiálech osoba materiálu, bez ní hlavní
    osoba stromu.
- **Hranice:**
  - zúžení není filtr: počet aktivních filtrů se nezmění a samo nic nezvýrazní. S dotazem nebo filtrem zúží
    výsledky, zvýraznění ve stromu i počty; pata panelu filtrů dopíše „jen přímá linie“ nebo „jen v pohledu“, na
    telefonu list filtrů řekne „Hledá se jen v přímé linii: Jan Horák.“;
  - rozsah, který výběr nabídnout nemůže, se neukáže a hledá se v celém stromu: **Přímá linie** bez osoby,
    **V pohledu** bez pohledu za dialogem (zakrývá ho jiný dialog, stránka osoby, okno Seznamy osob nebo
    Materiály) a u pohledu, který ukazuje celý strom (časová osa s celým stromem);
  - když v zúženém rozsahu nikdo není, výsledek řekne „V přímé linii nikdo. V celém stromu 3 shody.“ (nebo „V
    pohledu nikdo. …“) s odkazem **Hledat v celém stromu**; Enter hledá tam;
  - volba je jedna pro lištu i všechny výběry osoby a platí, dokud se aplikace nezavře. Neukládá se: po spuštění je
    vždy **Celý strom**.
- **Kde:** hledání v liště nástrojů; výběr osoby v dialozích přidání vztahu, rodiče dítěte, společné události,
  **Zjistit vztah**, sloučení dvou osob; přiřazení osoby v Materiálech a v dialogu materiálu.
- **Ovládání:** klik na rozsah; Alt+←/→ mezi rozsahy (bublina ukazuje „(Alt+←/→)“). Bublina rozsahu řekne, co
  zúžení drží („Jen osoba Jan Horák, její předci a potomci“, „Jen osoby, které pohled právě ukazuje (24)“). Na
  telefonu je počet výsledků na konci řádku pod přepínačem.
- **Platí od:** aplikace 3.32.0

<!-- zdroj: app:82cfdbd3 src/search-scope.ts SearchScope, SEARCH_SCOPES, getSearchScope/setSearchScope (jen v paměti, po startu 'tree'), directLineIds (selection ancestors + descendants, bez zástupných), effectiveScope, offeredScopes, narrowIds, stepScope · app:7a72bd1e src/person-picker.ts PickerScopeSource, renderScopeHead (skryté nenabízené rozsahy, titulky, altKeys, lineRef/lineRefMain/viewRef, telefon počet na konci řádku), prázdné zúžení emptyLine/emptyView + searchWhole, Enter · src/ui/search-scope-ui.ts toolbarRefPerson (střed, mapa a tabulka hlavní osoba), mainPerson (defaultPersonId, startupPerson), toolbarViewIds (mapScopePersons, timelineScope 'tree' = null, tableShownPersonIds, getVisiblePersonIds), toolbarScopeSource, viewBehindDialog (stránka osoby, Seznamy osob, Materiály, víc dialogů), dialogScopeSource, materialScopeSource, toolbarScopeNote (footLine/footView, sheetLine/sheetView) · src/ui/search.ts applySearchFilter (zúžení není filtr, zvýraznění a počty) · scope: v relation-modal.ts, relationships-panel.ts, person-events.ts, kinship-ui.ts, merge-ui.ts, materials-window.ts, material-attach-ui.ts, search.ts · strings.ts searchScope.* · app:d5b87792 · dirigent:spec/137 K1, prace/1123-app-137-linie-material (Výsledek, dotazy A1–A2: osa s celým stromem bez V pohledu; bez hlavní osoby první osoba stromu) · ZADANI_UIX_hledani-linie-material-seznam „Rozhodnuto 23. 11.“ bod 4 (bez partnerů) -->
