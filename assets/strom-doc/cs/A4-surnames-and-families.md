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
  osoby…**, **Kniha rodu…**. Výběr rodu v pohledu na strom popisuje A6.
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
- **Ovládání:** **Přehled stromu → Rody → Další rodiny**. V liště nástrojů **Rody → Další rodiny** (A6).
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
- **Ovládání:** **Přehled stromu → Rody**, pole „Hledat rod, obec nebo osobu…“. Seznam **Rody** v liště nástrojů má
  stejné pořadí a názvy, s **Celý strom** a **Další rodiny** (A6).
- **Platí od:** aplikace 3.19.0 (seznam **Rody** v liště nástrojů 3.21.0)

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
