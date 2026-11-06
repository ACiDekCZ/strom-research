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
- Hypotézu rozhoduje jen člověk; agent rozhodnutí navrhne (od výzkumu 1.28.0):
  [R10.3.1](R10-people-and-hypotheses.md#R10.3.1).
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
