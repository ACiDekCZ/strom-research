<a id="R3"></a>
# R3 Ověřování a citace

Jak výzkum určuje, jak jistý je každý údaj, co musí platit, aby byl doložený, a jak to ukazuje aplikace. Popisuje
výzkum 1.25.2 a aplikaci Strom 3.21.2; změny z novější verze mají u sebe její číslo.
U pravidel je rozlišeno, co **hlídá kód** (příkaz `strom` zápis jinak odmítne) a co je jen **pravidlo metodiky**
(pokyn agentovi, který kód nekontroluje).

<a id="R3.1"></a>
## R3.1 Stupně jistoty údaje

Každý údaj (narození, křest, sňatek, povolání…) má jeden ze čtyř stupňů jistoty. Stupeň říká, jak jistý je závěr
ze všech pramenů údaje, ne jak dobrý je jeden pramen ([R3.2.1](#R3.2.1)).

| Aplikace | Terminál | Význam podle metodiky |
|---|---|---|
| **Doložené** | doloženo | agent přečetl původní záznam sám a záznam údaj uvádí přímo |
| **Pravděpodobné** | pravděpodobné | dobrý doklad, ale nepřímý, nebo jediné čtení těžkého písma |
| **Možné** | možné | slabý doklad |
| **Vodítko** | jen stopa | rodinný příběh, rodokmen, rejstřík nebo odhad: co ověřit, ne údaj |

- **Hranice:** údaj může být i vyvrácený (`--status disproven`) nebo odvolaný (`strom event retract E… --reason "…"`).
  Nic se nemaže. Odvolaný údaj se nikde neukazuje a nejde ho citovat ani upravit. `strom person show` ukazuje
  české názvy jen člověku; agent tam čte `proven`, `probable`, `possible`, `lead`.
- **Ovládání:** aplikace: štítek u údaje (události osoby, sňatek a rozvod, společné události páru), jen ke čtení ·
  terminál: `strom person show`, `strom person card`, `strom stats` (řádek „Údaje: doložené … · jen stopy …“);
  zápis `strom event add … --status`, `strom cite E… S… --status`, `strom event edit E… --status … --reason "…"`.
- **Platí od:** výzkum 1.0.0; české názvy v terminálu 1.1.0 (u `strom person show` 1.12.0); štítek v aplikaci 3.9.0
- **Od výzkumu 1.26.0:** terminál říká stupně slovy aplikace: **doložené**, **pravděpodobné**, **možné**,
  **vodítko**, **vyvrácené**. Souhrn `strom stats` píše dál „jen stopy“.

<!-- zdroj: research:src/core/model.ts:36 STATUSES · assets/method/core.md:8-12 · src/cli/human.ts:138 statusName · assets/lang/cs.json ui.st.*, ui.stats.facts · src/commands/people.ts:115 wordsFor · src/core/actions.ts:629 notRetracted · app:src/ui/fact-status.ts · strings.ts factStatus · 1.26.0: src/cli/human.ts:139 STATUS, cs.json ui.st.* (commit fe59fb40) -->

<a id="R3.1.1"></a>
### R3.1.1 Výchozí stupeň a citace, která ho zvedne

- Údaj zapsaný bez `--status`: bez citace **Vodítko**; s citací aspoň jednoho pramene, který není slabý
  ([R3.3](#R3.3)), **Pravděpodobné**; jinak Vodítko. Od výzkumu 1.28.0 je slabý i rejstřík.
- `strom cite` bez `--status` zvedne Vodítko na Pravděpodobné, když nový pramen není slabý. Jiný stupeň nemění.
- Změna stupně přes `strom event edit --status` potřebuje `--reason`; citace se stupněm (`strom cite … --status`) ne.
- Hlídá kód. **Platí od:** výzkum 1.0.0

<!-- zdroj: research:src/core/evidence.ts:49 defaultStatus · src/core/actions.ts:636-650 citeEvent, :903-913 event.needs-reason -->

<a id="R3.2"></a>
## R3.2 Co kód pustí jako Pravděpodobné a Doložené

Stupeň nesmí tvrdit víc, než dávají citace údaje. Kód to kontroluje při každém zápisu stupně: `event add`, `cite`,
`event edit` i u údajů, které přijdou z aplikace.

- **Hranice (hlídá kód),** v tomto pořadí:
  1. Pravděpodobné i Doložené potřebuje aspoň jednu citaci.
  2. Aspoň jedna citace musí být z pramene, který není slabý. Slabý je rodokmen (`--kind family-tree`), vzpomínka
     (`--kind family-memory`), autorské dílo (`--form authored`) a od výzkumu 1.28.0 rejstřík (`--kind index`).
  3. Doložené navíc potřebuje mezi citacemi z ne-slabých pramenů aspoň jednu s primární informací
     (`--information primary`): záznam psaný v době události někým, kdo to věděl. Informace u citace má přednost
     před informací u pramene.
- **Jen metodika:** kód nekontroluje, že je pramen originál (`--form original`), že ho agent přečetl sám, že záznam
  údaj uvádí přímo, ani slepé druhé čtení ([R3.5](#R3.5)). Doložené proto projde i u opisu s primární informací
  (u rejstříku do výzkumu 1.27.0 také).
- **Ovládání:** terminál: `strom event add P… BIRT --date "…" --cite S… --information primary --status proven`.
  Odmítnutí řekne důvod a co místo toho (nechat Vodítko, `--status possible`, nebo `--status probable`).
- **Platí od:** výzkum 1.0.0

<!-- zdroj: research:src/core/evidence.ts:27 isWeak, :32 informationOf, :55-68 checkStatus · src/core/actions.ts:196-209 makeEvent, :648, :906 · src/commands/people.ts:745 · od v1.28.0 evidence.ts isWeak (kind index), checkStatus "… or an index cannot make a fact" -->

<a id="R3.2.1"></a>
### R3.2.1 Pramen: forma a informace

- `strom source add --form original` (výchozí) · `derivative` (opis, rejstřík; výchozí pro `--kind index` a v knize,
  která je jen rejstřík) · `authored` (sestavené dílo).
- `--information primary|secondary|unknown` (výchozí `unknown`) platí u pramene; u citace (`event add`, `cite`) jen
  pro ten údaj. Záznam, který jmenuje rodiče (křest vnuka), je pro ně sekundární informace (metodika).
- Do GEDCOM jde kvalita citace jako QUAY: 3 originál s primární informací · 2 originál jinak, nebo opis s primární
  informací · 1 opis jinak, nebo autorské dílo · 0 rodokmen a vzpomínka.
- Změna formy, informace, druhu nebo přepisu pramene (`strom source edit`) potřebuje `--reason`, doplnění ne.
- Aplikace: **Spolehlivost** pramene přijde do výzkumu jako **Originál** = originál s primární informací,
  **Opis / index** = originál se sekundární informací, **Nejisté** = opis s neznámou informací.
- **Platí od:** výzkum 1.0.0; Spolehlivost z aplikace výzkum 1.12.0

<!-- zdroj: research:src/commands/sources.ts:197-198, :221, :837 · src/core/evidence.ts:40 quay · src/core/sync.ts:4660 QUAY_EVIDENCE · assets/method/recording.md:38-46 · app:strings.ts sources.quality1-3, src/ui/sources.ts:76 -->

<a id="R3.3"></a>
## R3.3 Pramen, nebo vodítko

Rodokmen, vzpomínka, rejstřík, katalog a online strom říkají, kde hledat. Nejsou dokladem údaje. Údaj z nich zůstává
Vodítko, dokud ho nedoloží záznam.

- **Hlídá kód:** rodokmen, vzpomínka, autorské dílo a rejstřík (`--kind index`) jsou slabé prameny: údaj jen
  z nich nikdy není Pravděpodobné ani Doložené ([R3.2](#R3.2)). Údaj, který cituje jen rejstřík, zůstane Vodítko,
  dokud se nepřečte a necituje samotný zápis; s citací zápisu je údaj zápisu. Převzatý rodokmen:
  [R11.3](R11-material-from-the-user.md#R11.3).
- **Hranice:** u úprav z aplikace se rejstřík počítá jako záznam: úprava údaje doloženého rejstříkem se stane
  rozporem ([R5.2](R5-conflicts.md#R5.2)), nic se tiše nepřepíše.
- **Jen metodika:** rejstřík slouží jen k nalezení stránky; zápis se čte v matrice. I chybějící zápis v rejstříku
  je jen vodítko: podobný tvar příjmení je kandidát.
- Materiál od uživatele (doklad, fotka, dopis, co řekne): [R11.2](R11-material-from-the-user.md#R11.2).
- **Platí od:** výzkum 1.0.0
- **Od výzkumu 1.28.0:** rejstřík hlídá kód jako slabý pramen (dřív jen metodika: s jeho citací dostal údaj
  Pravděpodobné a s `--information primary` prošlo i Doložené).

<!-- zdroj: research:assets/method/core.md:8-12 · locate.md:22-24 · link.md:6-12 · intake.md:9-16 · src/core/evidence.ts isWeak (kind index od v1.28.0), isCompiled (sync) · src/core/sync.ts isCompiled · src/core/import.ts:1-7, :113-117 · src/commands/sources.ts:221 · test/cli/index-weak.test.ts · commit 9685fcbe -->

<a id="R3.4"></a>
## R3.4 Citace: výřez a přepis

Citace říká, kde přesně v prameni údaj stojí. Pramen je jeden zápis; víc zápisů jedné stránky jsou víc pramenů.

- **Jen metodika:** každý zápis ze skenu dostane `--clip` (výřez, ve kterém ho agent četl) a `--transcript` (slova
  zápisu, jak stojí, po řádcích, nepřečtené písmeno `[?]`), k tomu `--locator` (folio, strana, číslo zápisu)
  a u údaje `--quote`. Do pole (`--date`, `--house`, `--age`, jméno) jde jen to, co je přečtené jistě; nejisté jde
  do přepisu s `[?]` a do poznámky údaje.
- **Jen metodika, od výzkumu 1.28.0:** zápis v jiném jazyce nebo písmu, než je jazyk výzkumu (latina, kurent,
  polština, azbuka…), dostane vedle doslovného přepisu i překlad do jazyka výzkumu (`--translation`). Přepis zůstává
  v jazyce zápisu. Aplikace překlad ukazuje sbalený pod přepisem
  ([A3.1.1](A3-evidence-in-the-app.md#A3.1.1)).
- **Hlídá kód:** nejvýš 3 výřezy na pramen (zápis a jeho pokračování přes zlom stránky). Chybějící výřez nebo přepis
  kód neodmítne, jen připomene u pramene na skenu: po `strom source add`, po `strom source edit` se snímkem nebo
  výřezem a při `strom task done` u pramenů, které úkol zapsal.
- Starší prameny: výřez doplní `strom clips`, přepis `strom transcripts` (čtenáři, druhý pohled je zkontroluje).
- **Ovládání:** terminál: `strom source add "…" --clip B…:57@x,y,w,h --transcript @notes/zapis.txt --translation
  @notes/preklad.txt --locator "…"`; doplnění `strom source edit S… --translation "…"`.
  Aplikace ukazuje výřez zápisu vedle přepisu.
- **Platí od:** výzkum 1.1.0 (výřez, `strom clips`, `strom transcripts`); přepis 1.0.0
- **Od výzkumu 1.26.0:** nápověda volby `--clip` říká „další na každý zlom stránky, nejvýš 3“ (v 1.25.2 „druhý“).
  Pravidlo se nemění.

<!-- zdroj: research:assets/method/recording.md:19-27, :55-62 · src/core/media.ts:285 MAX_CLIPS, :481 transcriptNote, :492 clipNote · src/commands/sources.ts:183, :214, :250, :893 · src/commands/tasks.ts:366-369 finishTask · src/commands/clips.ts · src/commands/transcripts.ts · HEAD commit 6bc7430b · překlad: assets/method/recording.md "--translation", link.md krok 7, src/brief/brief.ts (Research language), src/commands/sources.ts:196 translation, src/gedcom/export.ts:557 (oddíl poznámky pramene „Překlad:“), commit a1ccd24e -->

<a id="R3.5"></a>
## R3.5 Slepé druhé čtení

Závěr, který stojí na jedné těžko čitelné buňce (číslo domu, věk, křestní nebo rodné jméno), potřebuje druhé,
nezávislé čtení. Nad Pravděpodobné jde údaj jen tehdy, když se dvě nezávislá čtení shodnou.

- **Jen metodika:** druhý čtenář neví očekávanou hodnotu, jméno, místo ani proč na tom záleží. Jedna buňka, jeden
  čtenář. Nejdřív `strom readings B… --image N`: dvě čtení už možná jsou. Čtení se liší: agent se znovu podívá;
  skutečný rozdíl je rozpor s oběma čteními (viz [R5](R5-conflicts.md)), ne volba.
- **Hlídá kód:** `strom read --blind` řekne čtenáři, že čte slepě (přepsat přesně, nic nedoplňovat). Dvoustranu dá
  ve dvou ostřejších půlkách; zpráva čtenáře má v hlavičce „Blind: yes“. Kód **nekontroluje**, že Doložený údaj
  slepé čtení má ([R3.2](#R3.2)).
- **Kdy ho metodika chce:** před Doložené u údaje na jedné těžké buňce; v úkolu ověření z revize osoby (údaje
  Pravděpodobné, které citují pramen se snímkem: shoda → Doložené, rozdíl → rozpor); u přepisu uživatele
  ([R3.5.1](#R3.5.1)).
- **Ovládání:** terminál: `strom read M… --blind --crop x,y,w,h --question "…"`; revize osoby: menu **Revize osoby:
  prověřit a doplnit, co o ní víme**, `strom review`.
- **Platí od:** výzkum 1.0.0; úkol ověření z revize osoby 1.1.0

<!-- zdroj: research:assets/method/verify.md:3-18 · recording.md:62-65 · src/commands/read.ts:192, :206, :334, :506 · src/core/reader.ts:194 readerPrompt · src/core/review.ts:205 singleReadings, :269 · src/core/phrases.ts review.verify.* · cs.json ui.menu.review -->

<a id="R3.5.1"></a>
### R3.5.1 Přepisy a čtení z aplikace

Přepis, který uživatel napíše v aplikaci, výzkum nikdy nebere za Doložené a nepřepíše ho. Jak s ním počítá, určuje
nastavení stromu v aplikaci.

- **Moje přepisy pramenů → Vodítko** (výchozí): nový údaj z přepisu je Vodítko. Výzkum navrhne úkol ověření.
- **Moje přepisy pramenů → Doloženo**, nebo u pramene zaškrtnuté **Přepis ověřen**: přepis platí jako první čtení.
  Údaje na něm jsou Pravděpodobné, ne Doložené. Volba platí pro prameny nové nebo změněné od dalšího poslání.
- Dokument přečtený čtenáři výzkumu: jeden čtenář → Možné; dva slepí čtenáři shodně → Pravděpodobné; přepis
  upravený v aplikaci, rozdílná čtení, nejistý čtenář nebo údaj, který čtení neuvádí → Vodítko.
- **Hlídá kód:** tyto stupně. Z aplikace nikdy nevznikne Doložené.
- **Jen metodika:** v úkolu ověření agent dohledá záznam, zaregistruje snímek a přečte ho slepě sám. Shoda →
  poznámka u pramene; rozdíl → rozpor s oběma čteními.
- **Platí od:** výzkum 1.12.0, aplikace 3.9.0; čtení dokumentu čtenáři výzkumu 1.18.0

<!-- zdroj: research:assets/method/verify.md:19-24 · src/core/sync.ts:220, :824, :3367 readsFor, :3870 reading, :3992 · src/core/readsync.ts:190 readingGrade · cs.json sync.verify.*, read.note.* · app:strings.ts treeSettings.transcripts/guide/evidence/evidenceDesc/notRetroactive, sources.verified -->

<a id="R3.6"></a>
## R3.6 Negativní hledání

Marné hledání je výsledek. Každé hledání se zapíše, i bez nálezu, s tím, co přesně pokrylo. Nejdražší chyba je
prohledat stejnou knihu dvakrát.

- **Hranice (hlídá kód):**
  - `--result found|negative|partial|inconclusive`; `found` potřebuje `--found S…` (pramen se zapíše první);
  - `negative` kód odmítne, dokud v prohledaném rozsahu zůstává místo, které čtenář nahlásil jako nejasné, a nikdo
    se na ně od té doby nepodíval v plné velikosti, na správné straně dvoustrany. Počítají se čtení od prvního
    sezení úkolu (jinak posledních 24 hodin). Pak zbývá `--result inconclusive` s místem v `--note`, nebo
    `--result partial` s jasně přečtenými stranami v `--pages`;
  - marné hledání v rejstříku (`--method index`) se vypisuje jako „negative in the index only“;
  - `strom task done` u úkolu kde jsou záznamy, doložení vazby, ověření a obohacení osoby připomene, když úkol
    nezapsal žádné hledání.
- **Jen metodika:** negativ až po pohledu na strany v plné velikosti. Chybějící strany knihy nejsou prohledané
  (`--pages 40-52,55-69`). Po `--until-found` jen přečtené snímky, jako `--result partial`.
- **Ovládání:** terminál: `strom search add "…" --recordset B… --years … --surname … --pages … --method
  index|page-by-page|full-text|catalog|web|request|other --result negative --by main|reader|user --note "…"`.
- **Platí od:** výzkum 1.0.0; odmítnutí nad nejasným místem a „jen v rejstříku“ 1.14.0

<!-- zdroj: research:assets/method/core.md:22-25 · reading.md:22-30, :70-84 · src/commands/analysis.ts:208-268 · src/core/model.ts:484-485 · src/commands/readings.ts:347-380 openUnclear, :414 refuseNegativeOverUnclear · src/core/evidence.ts:21 searchedAs · src/commands/tasks.ts:348-351 -->

<a id="R3.7"></a>
## R3.7 Kdy se agent ptá člověka

Čtení a stupně jistoty určuje agent sám. Člověka se ptá jen tam, kde bez něj nejde dál. Otázka jde do **Čeká na
vyřízení** (viz [R6](R6-awaiting-action.md)) jako neosobní věta.

- **Jen metodika,** agent se ptá (`strom task wait T… --on "…"`): podobný tvar příjmení ve správném domě nebo letech
  (požádá o stránku, než ho vyloučí); katalog, který agent neotevře (`--kind web --url`); snímky, které archiv
  nedovolí stahovat automaticky (`--images B…:40-69`); stránka, která automatizaci brání (`--check <url>`), jen když
  jiná cesta nevedla a pramen zůstává nutný.
- **Hlídá kód,** jen člověk: odpověď na čekající úkol (`strom task wake T… --answer`) a na kontrolu stránky
  (`--check`) potvrdí člověk ve svém terminálu nebo v okně; „není chyba“ u nálezu kontroly (`strom quality dismiss`).
- **Jen metodika:** rozpor, který rozhodl uživatel, platí; agent ho otevře znovu jen kvůli prameni, který
  rozhodnutí nevážilo (viz [R5](R5-conflicts.md)). Přepis uživatele agent nepřepíše ([R3.5.1](#R3.5.1)).
- **Platí od:** výzkum 1.0.0; odpověď jen člověkem nejpozději 1.14.0; „není chyba“ 1.22.0

<!-- zdroj: research:assets/method/link.md:6-12 · locate.md:17-27 · reading.md:105-121 · waiting.md:14-17 · core.md:124-130 · recording.md:77-81 · src/commands/tasks.ts:928-946 task.check-person, task.answer · src/commands/quality.ts PERSON · src/cli/main.ts:287-290 requireHuman -->

<a id="R3.8"></a>
## R3.8 Jak doložení ukazuje aplikace

Aplikace používá slovo „doloženo“ ve více významech. Stupeň jistoty určuje výzkum; úroveň doložení osoby počítá
aplikace sama, jen z citací.

| Kde v aplikaci | Co ukazuje | Podle čeho |
|---|---|---|
| štítek u údaje, např. **Doložené** | stupeň jistoty údaje | výzkum ([R3.1](#R3.1)) |
| **Přehled stromu → Kvalita dat → Jistota údajů z výzkumu** | narození, úmrtí a sňatky podle stupně | výzkum |
| stránka osoby, **Pro badatele → Jistota údajů** | stupeň každého údaje osoby | výzkum |
| **Doloženo** / **Částečně doloženo** / **Nedoloženo** (● ◐ ○) | úroveň doložení osoby | citace ([R3.8.1](#R3.8.1)) |
| **Pro badatele**, „Doloženo prameny: N z M údajů“ | údaje osoby s pramenem | citace |
| **Přehled stromu → Předci**, sloupec **doloženo** | předci s doloženým narozením | s výzkumem jen Doložené, jinak citace |
| **Kde chybí doklady → Narození neověřená výzkumem** | narození předků, která nejsou Doložené | výzkum |
| kniha, **Údaje pro badatele**: ● doloženo · ◐ rozpor · ○ nedoloženo | stav doložení údaje | Doložené, **nebo** jakákoli citace |
| **Moje přepisy pramenů → Doloženo** | jak výzkum bere přepisy uživatele | první čtení, Pravděpodobné ([R3.5.1](#R3.5.1)) |

- **Hranice:** stupně jistoty aplikace jen ukazuje, změnit je nejde. Rozpor u údaje v knize přebije ● i ○.
- **Platí od:** aplikace 3.5.0 (úroveň osoby), 3.9.0 (štítek, Moje přepisy pramenů), 3.13.0 (Jistota údajů
  z výzkumu), 3.13.1 (sloupec doloženo), 3.18.0 (Pro badatele), 3.19.0 (kniha)

<!-- zdroj: app:src/ui/fact-status.ts · src/tree-overview.ts:224-233 birthDocumented · src/ui/tree-overview.ts:1037, :1960, :1650-1680 · src/person-page.ts:1014-1019 · src/book-blocks.ts:468-484 evidenceMark · strings.ts treeOverview.*, personPage.research.*, book.evidence.*, book.dlg.research(Hint), treeSettings.evidence -->

<a id="R3.8.1"></a>
### R3.8.1 Úroveň doložení osoby

- **Nedoloženo** (○): osoba, její události ani její svazky necitují žádný pramen.
- **Doloženo** (●): citované narození (nebo křest) a, když má osoba úmrtí (datum, místo, událost úmrtí nebo
  pohřbu), i citované úmrtí (nebo pohřeb, kremace).
- **Částečně doloženo** (◐): všechno mezi tím, i pramen přiložený jen k osobě (ke jménu, k bydlišti).
- Stupeň jistoty se nepočítá: narození citující i převzatý rodokmen (Vodítko) dává ●. Aplikace to říká u **Jistota
  údajů z výzkumu**: „Nezaměňovat s doložením pramenem.“
- Když ve stromu necituje pramen nikdo, karta úroveň neukazuje. Zástupná osoba úroveň nemá.
- **Ovládání:** aplikace: volba karty **Doložení prameny**; zvýraznění **Doložení** ve stromu; **Přehled stromu →
  Kvalita dat → Kde chybí doklady**.
- **Platí od:** aplikace 3.5.0

<!-- zdroj: app:src/evidence-level.ts personEvidence, treeHasAnySource · strings.ts treeHealth.evidenceMode/evFull/evPartial/evNone, cardDensity.cardEvidence/cardShowHint, treeOverview.certaintyDesc -->

<a id="R3.9"></a>
## R3.9 Vyprávění drží své prameny

Vyprávění říká, o které prameny se opírá. Nová verze vyprávění nic z předchozí verze neztratí bez důvodu.

- **Hranice:**
  - prameny vyprávění jsou prameny, které citují jeho údaje, prameny pozadí místa a doby a prameny, které text
    jmenuje jen identifikátorem;
  - nová verze musí ponechat každý údaj, pramen a odkaz předchozí verze, nebo ho vynechat s důvodem. Jinak ji
    výzkum odmítne a vypíše, co by chybělo. Co verze vynechala a proč, zůstane u vyprávění;
  - vyprávění podle vodítka jmenuje v textu název pramene a to, že záznam zatím nikdo nečetl. Když text pramen
    nejmenuje, výzkum na to upozorní;
  - schválení vyprávění zůstává na člověku ([R5.5](R5-conflicts.md#R5.5)).
- **Ovládání:** terminál: `strom story show P…` (každý údaj s prameny, pak pozadí), `strom story set P… --fact E…
  --source S… --drop "E… <proč>"`. Soubor Stromu: prameny vyprávění jako `2 SOUR` pod `_STORY`.
- **Platí od:** výzkum 1.26.0

<!-- zdroj: research:src/core/storykeep.ts StoryVersion, StoryDrop, StorySource, storySources · src/commands/story.ts:104 --drop, :151 told from a lead, :231 story show · assets/method/narrate.md · CHANGELOG.cs.md 1.26.0 -->

<a id="R3.9.1"></a>
### R3.9.1 Co vyprávění tvrdí

Vyprávění se píše z údajů pro rodinu. Co se nedoložilo, se nedomýšlí.

- **Jen metodika:**
  - každé tvrzení stojí na zapsaném údaji; co je odvozené, je označené jako odvození; co se neví, se řekne;
  - pozadí místa a doby (válka, epidemie, požár, čím vesnice žila) jen z pramene zapsaného ve výzkumu a jen jako
    pozadí, nikdy jako příčina toho, co osoba udělala, pokud to neříká záznam;
  - vyprávění páru vypráví společný život: sňatek, domácnost, domovy, děti, ovdovění. Život každého před ním a po něm
    patří jeho vlastnímu vyprávění a zmíní se jednou větou;
  - staré povolání a pojem, kterému čtenář nerozumí, se vysvětlí; píše se v jazyce výzkumu;
  - formát textu: jen odstavce, podnadpisy, odrážky, tučné písmo a kurzíva. Ostatní (odkazy, tabulky, citace,
    číslované seznamy) aplikace podle metodiky ukáže jako prostý text.
- **Proč:**
  - nic se nedomýšlí: vyprávění je pro rodinu a stojí na dokladech. Co by znělo pravděpodobně, ale doložené není,
    by se v rodině začalo brát jako fakt;
  - pozadí: je doložené pro místo, ne pro člověka; jako příčina toho, co osoba udělala, by bylo domněnkou vydávanou
    za fakt. Pramen pozadí vyprávění jmenuje (`--source`), aby šel ověřit;
  - vyprávění páru: společný život se vypráví jednou, u páru, aby se tentýž život nevyprávěl dvakrát a verze se
    nerozcházely;
  - formát: aplikace Strom ukáže jen odstavce, podnadpisy, odrážky, tučné písmo a kurzívu; ostatní by čtenář viděl
    jako prostý text se značkami.
- Schválení a nová verze schváleného vyprávění: [R6.3.2](R6-awaiting-action.md#R6.3.2).
- **Ovládání:** terminál: `strom story set P… --text @notes/… --fact E… --source S… --note "co je odvozené"`
  (vyprávění páru na rodině F…).
- **Platí od:** výzkum 1.0.0; pozadí místa a doby 1.10.0; formát textu 1.8.0; vyprávění páru 1.23.0

<!-- zdroj: research:assets/method/narrate.md (celé; formát od v1.8.0, pozadí od v1.10.0, pár od v1.23.0) · research:src/commands/story.ts --note -->
