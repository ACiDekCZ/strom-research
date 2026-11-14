<a id="R1"></a>
# R1 Výzkum v kostce

Jak výzkum pracuje jako celek, na jedné stránce. Každý oddíl vede na kapitolu s přesnými pravidly. Popisuje
výzkum 1.25.2 a aplikaci Strom 3.21.2; změny z novější verze mají u sebe její číslo.

<a id="R1.1"></a>
## R1.1 Výzkum je záznam, ne rozhovor

Výzkum je složka na počítači. Agent AI (například Claude Code nebo Codex) do ní zapisuje jen příkazem `strom`:
osoby, události, prameny, provedená hledání, hypotézy a rozpory. Co není zapsané ve výzkumu, se ztratí s koncem
sezení, proto agent zapisuje průběžně.

- **Hranice:** nic se nemaže. Chybný údaj se stáhne s důvodem, změněný údaj se opraví s důvodem a v historii zůstane
  i původní podoba.
- **Platí od:** výzkum 1.0.0

<!-- zdroj: research:assets/method/core.md „Nothing is deleted“, „Write as you go“ -->

<a id="R1.2"></a>
## R1.2 Na čem agent pracuje

Co výzkum zkoumá, určují **linie**: předkové osoby, potomci osoby, nebo jedna otázka. Z linií vznikají úkoly
a otevřené úkoly tvoří jednu **frontu**. Agent bere vždy první úkol fronty. Práce na lidech, kam žádná linie
nesahá, jde až po práci na liniích.

- Úkoly mají druhy v pořadí, v jakém jdou při jinak stejném místě ve frontě: podklady od uživatele, kde jsou
  záznamy, doložení vazby, ověření, obohacení osoby, žádost do archivu, vyprávění.
- **Nejdřív strom, pak nad ním:** rodina nalezená v záznamech, kterou se stromem nespojuje žádná doložená vazba, se
  dál nezkoumá, dokud se vazba nedoloží ([R10.4](R10-people-and-hypotheses.md#R10.4)).
- Co výzkum udělá s podklady od uživatele: [R11](R11-material-from-the-user.md).
- Podrobně: [R2](R2-lines-and-queue.md).

<!-- zdroj: research:src/core/queue.ts LEVEL_ORDER · assets/method/core.md „The tree first, then above it“ -->

<a id="R1.3"></a>
## R1.3 Jak agent pracuje: sezení

Agent pracuje po **sezeních**. Jedno sezení je jeden úkol s časovým limitem. Na konci agent zapíše, co je hotovo
a co má přijít dál, a sezení zavře. Při samostatné práci jde sezení za sezením, dokud je práce a dovolí to
podmínka, kterou nastavil člověk (například tempo týdenního limitu předplatného).

- Výzkum může být i jen **Archiv Stromu**, na kterém agent nepracuje: [R7.8](R7-when-the-agent-works.md#R7.8).
- Podrobně: [R7](R7-when-the-agent-works.md).
- Kde se s agentem mluví (terminál, aplikace Claude nebo ChatGPT) a co strom kde hlídá: [R12](R12-where-the-agent-works.md).

<!-- zdroj: research:src/commands/run.ts · assets/method/core.md „The time is strom's to say“ -->

<a id="R1.4"></a>
## R1.4 Jak výzkum váží důkazy

Agent pracuje podle **Genealogical Proof Standard** (GPS): důkladné hledání, citace každého údaje, rozbor
a srovnání důkazů, řešení rozporů a sepsaný závěr, kterému další badatel porozumí.

- Každý údaj má stupeň jistoty: **Vodítko**, **Možné**, **Pravděpodobné**, **Doložené**. Rodokmen, rodinná paměť
  a rejstřík jsou vždy jen vodítko: rejstřík vede k zápisu, doloží až zápis sám (rejstřík hlídá kód od výzkumu
  1.28.0). Podrobně: [R3](R3-verification-and-citation.md).
- Jmenovec není hledaná osoba. Osobu určuje rok, místo, dům, povolání, manžel nebo manželka a rodiče. Dva záznamy se
  stejným jménem a jinými rodiči jsou dvě osoby. Ztotožnění osob, jejich jména a soupeřící hypotézy:
  [R10](R10-people-and-hypotheses.md).
- Neúspěšné hledání je výsledek. Zapíše se, co přesně se prohledalo, aby se stejná kniha neprohledávala dvakrát.
- Když se záznamy liší, agent nevybírá potichu: zapíše **rozpor**. Podrobně: [R5](R5-conflicts.md).
- Místo dostane polohu na mapě, jen když je jisté, které místo to je. Podrobně: [R4](R4-places.md).

<!-- zdroj: research:assets/method/core.md (úvod, „Certainty is explicit“, „A namesake is not your person“, „Negative results are results“) · src/core/evidence.ts isWeak (rejstřík od 1.28.0) -->

<a id="R1.5"></a>
## R1.5 Co rozhoduje člověk

Některá rozhodnutí patří jen člověku. Výzkum se na ně ptá v **Čeká na vyřízení** a agent za člověka neodpoví.

- Co čeká na člověka (dopisy, snímky k stažení, otázky k místům, rozpory, hypotézy, vyprávění ke schválení) a kde se
  to vyřizuje: [R6](R6-awaiting-action.md).
- Hypotézu rozhoduje člověk a agent rozhodnutí navrhne (od výzkumu 1.28.0):
  [R10.3.1](R10-people-and-hypotheses.md#R10.3.1). Od výzkumu 1.29.0 je to volba výzkumu: bez uložené volby
  rozhoduje agent (**Rozhoduje AI**), **Rozhoduje člověk** si člověk zvolí: [R10.3.2](R10-people-and-hypotheses.md#R10.3.2).
- Rozhodnutí člověka platí. Agent ho změní jen na základě nového pramene: [R5.4](R5-conflicts.md#R5.4).
- Poloha místa zadaná člověkem se nemění: [R4.3](R4-places.md#R4.3).
- Nastavení, která mění, co smí agent, potvrzuje člověk (například podmínka samostatné práce, [R7](R7-when-the-agent-works.md)).

<!-- zdroj: research:assets/method/waiting.md · src/core/conflicts.ts againAllowed · src/core/placeid.ts personsHand · src/core/config.ts run.gate · src/commands/analysis.ts hypothesis decide (person, od 1.28.0) -->

<a id="R1.6"></a>
## R1.6 Výzkum a aplikace Strom

Aplikace Strom ukazuje výzkum jako rodokmen: osoby, údaje s jejich stupněm jistoty, prameny a rozpory, a když agent
pracuje, i běžící práci. Úpravy v aplikaci se posílají zpět do výzkumu. Úprava údaje, který doložil záznam, ho
nepřepíše, ale stane se rozporem ([R5](R5-conflicts.md)). Spolupráci aplikace a výzkumu popíše část S.

<!-- zdroj: research:src/core/sync.ts:1-19 · app:strings.ts research.knows -->

<a id="R1.7"></a>
## R1.7 Jak výzkum čte skeny

Většina údajů pochází ze skenů matrik a jiných knih. Výzkum nejdřív určí knihu, snímky stahuje jen přes stahovač
archivu a jen ty potřebné. Knihou listují **čtenáři** (`strom read`): samostatní agenti, každý s dávkou snímků.
Zápis, který se bude citovat, si hlavní agent přečte sám z výřezu v plném rozlišení a zapíše ho s výřezem
a přepisem. Čtení modelem AI není stoprocentní; důležité údaje má ideálně ověřit ještě člověk.

- Podrobně, s postupem krok za krokem: [R8](R8-reading-scans.md).
- **Platí od:** výzkum 1.0.0

<!-- zdroj: research:assets/method/reading.md · assets/method/locate.md · assets/method/recording.md · src/commands/read.ts:183-200 -->

<a id="R1.8"></a>
## R1.8 Jak Strom funguje: `strom doc`

Tato dokumentace je přibalená ve výzkumu a čte se i bez internetu. `strom doc` vypíše obsah, `strom doc R10.1`
jedno pravidlo i s pravidly pod ním a `strom doc <slova>` hledá v nadpisech, rejstříku pojmů a textu.

- **Hranice:**
  - číslo jde napsat i malými písmeny nebo s pomlčkou (`r4.3`, `R4-3`). Neznámé číslo skončí chybou, která řekne
    nejbližší čísla;
  - hledání nedbá na diakritiku ani velikost písmen. Ukáže nejvýš 10 pravidel, nejlepší první, a kolik jich je
    dalších (`--limit` jiný počet);
  - text je v jazyce výzkumu (`--lang` jiný). Jazyk, do kterého dokumentace přeložená není, dostane angličtinu
    s poznámkou;
  - u pravidla je odkaz na stejné pravidlo na stromapp.info;
  - funguje i mimo výzkum a v Archivu Stromu a nic nezapisuje.
- **Jen metodika:** na otázku člověka, jak nebo proč Strom něco dělá, agent odpoví podle `strom doc`: s číslem
  pravidla a s odkazem, který `strom doc` vypíše.
- **Ovládání:** terminál: `strom doc`, `strom doc R2.3`, `strom doc hypotéza --lang en`, `--json`. Nápověda pro
  člověka (`strom help --human`) končí odkazem na `strom doc`. Aplikace má stejnou dokumentaci v **Jak Strom
  funguje** ([A1.7](A1-the-app-in-brief.md#A1.7)).
- **Platí od:** výzkum 1.28.0

<!-- zdroj: research:src/commands/doc.ts (SEARCH_ROWS=10, --limit, ui.docs.fallback, docUrl) · src/core/doc.ts · assets/strom-doc/ (PIN) · src/agents/files.ts:188 "answer from `strom doc`" · src/cli/help.ts (help --human, poslední řádek) · CHANGELOG.cs.md 1.28.0 · commity 314ab218, 4acfb170 -->

<a id="R1.9"></a>
## R1.9 Otázky nad daty stromu: `strom query`

Na otázku nad daty stromu (kolik mlynářů je v rodu, kdo žil v čísle 12, kdo se narodil v jednom místě v jednom
století) odpoví jedno volání `strom query`. Vypíše řádek za každý údaj osoby: kdo to je a jak je příbuzný výchozí
osobě, co údaj říká, kde, kdy, jak je jistý a z jakého pramene. Příkaz jen čte: nic neověřuje a nic nezapisuje.

- **Hranice:**
  - údaj rodiny (sňatek) má řádek za každého partnera. Odvolané osoby a údaje nikdy, vyvrácené údaje jen
    s `--status disproven`;
  - vztah k výchozí osobě (nastavení `main.person`, jinak `--of P…`) je slovy v jazyce výzkumu, se stranou
    a generací, například **děd, z otcovy strany (G3)**. G1 je výchozí osoba, G2 její rodiče. Bez výchozí osoby, nebo když je odvolaná,
    `strom query` odmítne a řekne, jak dál (`strom config set main.person P…`, nebo `--of P…`);
  - čí údaje (`--kin`): `ancestors` výchozí osoba a přímá linie; `blood` (výchozí) předkové a všichni jejich
    potomci, i boční větve; `family` pokrevní příbuzní a jejich partneři; `all` celý strom;
  - filtry platí všechny zároveň: `--kind` (druh údaje: OCCU, RESI, BIRT …; neznámý druh se odmítne se seznamem
    platných), `--occupation`, `--value` (opakovaný: kterékoli ze slov), `--place`, `--house` (12 najde i č. 12
    a Nr. 12), `--years` (1750-1850 nebo jeden rok), `--surname` (i další tvary příjmení: Horáková), `--source`
    (S… nebo slova názvu), `--status`;
  - slovo se hledá na začátku slova v hodnotě, popisu nebo příčině údaje, ne v poznámce, bez ohledu na diakritiku.
    Povolání se hledá i v českých, německých, latinských a polských tvarech (mlynar najde i Müller a molitor)
    a ve vlastních tvarech výzkumu ([R1.9.2](#R1.9.2)); hlavička výpisu tvary vyjmenuje. Povolání, které žádný
    seznam nezná, se hledá jen v napsaném tvaru a výpis to řekne. `--exact` hledá jen slovo samo;
  - `--count` vypíše jen počty osob a údajů; `--by generation|kin|place|decade|surname` je rozdělí do skupin (podle
    generace mají boční větve vlastní skupinu), bez `--count` řádky po skupinách. Řádky jdou po stránkách
    (`--limit`, nejvýš 100, `--page`); `--json` dává u osoby i odkaz, který ji otevře v aplikaci Strom;
  - osoby, které mají hledané slovo jen jinde (jméno, poznámka), se počítají zvlášť, s příkazem `strom find`, který
    je najde. Když se nic nenajde, výpis nabídne `strom find` a širší okruh `--kin`.
- **Jen metodika:** na otázku nad daty agent odpoví jedním voláním `strom query`, ne hledáním osobu po osobě. Osobu
  jmenuje jménem s ID v závorce (Jan Horák (P0012)), vztah celý, jak ho dal `strom query`, nikdy zkrácený, a pramen
  názvem s S… v závorce. U každého údaje řekne, jak je jistý: jako fakt jen doložený; pravděpodobný a možný údaj ani
  vodítko doložené nejsou. Řádek `strom query` nestačí k tomu, čí je zápis a kdo je kdo, ani k ověření a zápisu
  údaje: to jde dál z pramenů a podle metodiky ([R3](R3-verification-and-citation.md),
  [R10](R10-people-and-hypotheses.md)).
- **Ovládání:** terminál: `strom query`, například `strom query --occupation mlynar --count --by generation`;
  `strom app --person P…` otevře aplikaci Strom na osobě (aplikace před 3.21 otevře strom). `strom find` dál hledá
  slovo v jakémkoli textu výzkumu a jeho nápověda vede na `strom query`. `strom facts …` nic neprovede: řekne
  **„strom facts“ je teď „strom query“ (stejné přepínače)** a celé volání s `strom query`.
- **Platí od:** výzkum 1.32.0

<!-- zdroj: research:src/commands/query.ts (popis, volby, KIN_SETS, FACT_GROUPS, LIST_PAGE_MAX=100, elsewhereOf, tries) · src/core/query.ts (hlavička, kinSet, SHOWN_STATUSES, ASKED_STATUSES) · src/core/occupations.ts · src/commands/analysis.ts help find („the facts recorded of people … strom query“) · src/cli/execute.ts RENAMED, renamedCommand · src/agents/files.ts AGENTS.md „Questions over the data“ · src/commands/start.ts app --person · cs.json ui.query.*, ui.error.command.renamed · test/cli/query.test.ts · CHANGELOG.cs.md 1.32.0 · spec 081 K1–K7 · query bez hlavní osoby / odvolaná: src/commands/query.ts ofPerson (query.no-main, query.retracted), cs.json ui.error.query.*, commit 6cdab11b -->

<a id="R1.9.1"></a>
### R1.9.1 Vyprávění: `strom query --story`

- `--story <slovo>` vypíše osoby a páry, v jejichž vyprávění slovo je: řádek za vyprávění, s větou, ve které slovo
  je, a s prameny, o které se věta opírá.
- **Hranice:**
  - slovo se hledá jako u `--value` (bez ohledu na diakritiku, s tvary povolání, `--exact`); opakované: kterékoli;
  - dlouhá věta je zkrácená kolem slova. Vyprávění, které čeká na schválení (i nová verze u schváleného), má
    **koncept**;
  - prameny věty jsou ty, které věta jmenuje, jinak prameny údajů vyprávění z let, která věta zmiňuje. Když je
    určit nejde, řádek ukáže **prameny celého vyprávění**;
  - vyprávění páru má řádek za každého partnera. Ostatní filtry vybírají osoby (ty, které mají odpovídající údaj);
    `--by` jen `generation`, `kin`, `surname`.
- **Jen metodika:** vyprávění převypráví údaje. Agent odpovídá z údajů a pramenů; vyprávění jen ukazuje, kde hledat.
- **Platí od:** výzkum 1.32.0

<!-- zdroj: research:src/commands/query.ts (--story, --by place|decade odmítnuto, storyText, storyData) · src/core/query.ts findStories (hlavička: sourcesNamed, storySources, basis sentence|story) · cs.json ui.query.story.* · src/agents/files.ts „A story retells the facts“ · CHANGELOG.cs.md 1.32.0 -->

<a id="R1.9.2"></a>
### R1.9.2 Vlastní tvary povolání: `strom occupation`

Vestavěný seznam povolání (83 povolání, každé v českých, německých, latinských a polských tvarech) jde doplnit
o vlastní tvary výzkumu: jiný jazyk, starý pravopis nebo povolání, které seznam nezná. `strom query --occupation`
([R1.9](#R1.9)) pak najde všechny tvary jako jedno povolání, i s `--exact`, `--count` a `--story` ([R1.9.1](#R1.9.1)).

- **Hranice:**
  - `strom occupation add` bere aspoň dva tvary jednoho povolání. Tvar, který seznam zná, k sobě připojí ostatní
    (další tvar mlynáře); tvary, které seznam nezná, jsou nové povolání. Tvar je v jazyce výzkumu, jiný jazyk se
    píše kódem před tvarem: `de:Ölschläger`. Když už tvary jedno povolání jsou, nic se nezapíše;
  - každá skupina nese, kdo ji přidal (člověk ručně, nebo agent při výzkumu), den a s `--source` pramen, ve kterém
    se tvar našel;
  - člověk přidává a odebírá ve svém terminálu, bez agenta, a odebrat smí kterýkoli vlastní tvar. Agent odebere jen
    tvar, který přidal agent; co přidal člověk, nikdy nemění ani neodebere. Vestavěný seznam zůstává, jak je;
  - `strom query` řekne, když hledané povolání není v žádném seznamu (hledá se jen napsaný tvar), a vypíše příkaz,
    který jeho tvary přidá: „{slovo}: povolání není v seznamu, hledá se jen tento tvar; další tvary přidá: strom
    occupation add {slovo} <tvar> [la:<tvar> …]“;
  - vlastní seznam je soubor výzkumu `quality/occupations.json` pod pečetí ([R14](R14-seal-and-integrity.md)).
    Když ho nejde přečíst, `strom query` a `strom occupation list` hledají jen ve vestavěném seznamu a řeknou to
    jedním řádkem se `strom repair`; `add` a `remove` přes něj nic nezapíšou.
- **Jen metodika:** povolání, které `strom query` v žádném seznamu nenajde, nebo tvar z pramene, který seznam nemá,
  agent přidá se `strom occupation add … --source S…` s dalšími tvary a řekne to uživateli.
- **Ovládání:** terminál: `strom occupation add olejník de:Ölschläger`; `strom occupation list` (skupiny výzkumu:
  kdo, kdy, prameny), `strom occupation list mlynar` (tvary jednoho povolání, vlastní s `*`), `strom occupation list
  --all` (všechna povolání); `strom occupation remove de:Ölschläger`.
- **Platí od:** výzkum 1.32.0

<!-- zdroj: research:src/commands/occupation.ts (add: aspoň dva tvary, --source ověřený pramen, by human | agent podle tree.personWrites; list: bez slova skupiny s by/at/sources, se slovem tvary s * u vlastních, --all; remove: agent jen své, persons, builtin, unknown) · src/core/occupations.ts (OCCUPATIONS_FILE quality/occupations.json, parseForm kód jazyka, addOccupation: nic se nezapíše, když už jedno povolání; mergeOccupations, ownOrRefuse: nečitelný soubor → UsageError strom repair; writeOwn putFile zapečetěná operace) · src/commands/query.ts:254–265 (ui.query.occupation.unknown, ui.occupation.unreadable) · assets/terms/occupations.json (83 skupin) · src/agents/files.ts AGENTS.md „An occupation strom query says is in no list“ · cs.json ui.occupation.*, ui.query.occupation.unknown · commity 84e7fc0e, 0abe8793 · CHANGELOG.cs.md 1.32.0 -->
