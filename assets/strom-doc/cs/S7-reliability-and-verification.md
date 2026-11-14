<a id="S7"></a>
# S7 Spolehlivost údajů a ověření podle originálů

U každého údaje aplikace ukazuje, jak spolehlivý je, a kartička ve stromu má jednu značku za celou osobu. Výzkum umí
údaj ověřit podle originálu záznamu: na pozadí, u jednoho údaje, u osoby nebo ve velké části stromu. Jistota ale
vzniká až tím, že **člověk** sám porovná údaj se skenem záznamu a potvrdí ho (**Potvrdit podle skenu**, [S7.8](#S7.8)).
Ověření agentem dá nejvýš **Doloženo**; potvrzení člověkem je silnější a agent ho nikdy nezmění. Kapitola popisuje
aplikaci Strom 3.26.0 a výzkum 1.30.0. Co jde jen s mostem výzkumu a co i bez něj, shrnuje [S7.9](#S7.9).

<!-- zdroj: dirigent:spec/065-spolehlivost-a-znovu-overeni/spec.md · app:7b0471f8 CHANGELOG.cs.md 3.26.0 (Ověřit údaje, Jedna značka na kartičce) · research:6c6e7c3b CHANGELOG.cs.md 1.30.0 (ověření podle originálů) -->

<a id="S7.1"></a>
## S7.1 Značka u údaje v kartě osoby

V kartě osoby má každý údaj značku: kdo ho potvrdil nebo doložil, jak jistý je výzkum, nebo že přišel z rodokmenu
jiného programu a nikdo ho neověřil. Stupně se liší fajfkou, tečkami a rámečkem, nikdy jen barvou.

| Značka | Význam (popisek po najetí) |
|---|---|
| **Potvrzeno** (✓) | **Potvrdil člověk**: údaj potvrdil podle skenu, zapsal nebo vrátil člověk, nebo přijal návrh výzkumu |
| **Doloženo** (●●) | **Doloženo AI: dva čtenáři záznamu shodně** |
| **Doloženo** (●○) | **Doloženo AI: jeden čtenář záznamu** |
| Pravděpodobné, Možné, Vodítko | stupeň jistoty výzkumu ([R3.1](R3-verification-and-citation.md#R3.1)) |
| **Z rodokmenu** (○○) | převzato z rodokmenu jiného programu, nebo z rodokmenu z aplikace Strom, který převzal výzkum; neověřeno ([S6.2](S6-tree-from-another-program.md#S6.2)) |

- **Bublina u značky** (po kliknutí): prameny údaje; u dvou čtenářů **dva čtenáři shodně**; u údaje, který po
  ověření zůstal pravděpodobný nebo možný, řádek „Zůstává {stupeň} · výzkum ověřil {datum}“ a důvod, proč se doložit
  nedal; u potvrzeného „✓ Potvrzeno podle skenu {datum}“; u údaje z rodokmenu, který rodokmen cituje,
  **citováno v rodokmenu, ve Stromu neověřeno**. V bublině jsou i akce **Ověřit** ([S7.3](#S7.3)), **Potvrdit podle
  skenu** a **Vzít zpět** ([S7.8](#S7.8)), kde platí.
  Od aplikace 3.27.0 je u každého pramene v bublině spolehlivost citace u tohoto údaje (**Originál**, **Opis /
  index**, **Nejisté**), ne výchozí spolehlivost pramene ([A2.6.1](A2-loading-a-family-tree.md#A2.6.1)).
- **Hlídá kód:**
  - dvě tečky dostane jen údaj, u kterého se při ověření výzkumem shodli dva čtenáři záznamu
    ([R8.8.1](R8-reading-scans.md#R8.8.1)); doložený jinak má jednu;
  - ✓ dává jen člověk: potvrzením podle skenu, nebo tím, že hodnotu sám zapsal, změnil, vrátil, nebo přijal návrh
    výzkumu. Údaj, který výzkum převzal z rodokmenu z aplikace Strom a nikdo ho od té doby nezměnil, má značku podle
    stupně jistoty, bez stupně **Z rodokmenu** (○○); ✓ nikdy ([S6.3](S6-tree-from-another-program.md#S6.3));
  - značky stromu výzkumu jsou stejné s mostem i bez něj, i hned po načtení stránky: aplikace je bere z uloženého
    stromu, ne z běžícího mostu;
  - potvrzení člověkem platí, jen dokud má údaj potvrzenou hodnotu ([S7.8](#S7.8)).
- **Hranice:** značku **Bez pramene** u údaje aplikace zatím neukazuje: údaj bez pramene je bez značky. Osobu bez
  pramene ukáže značka na kartičce ([S7.2](#S7.2)).
- **Ovládání:** karta osoby → značka u údaje; nápověda **Co značky znamenají**. **Nastavení → Karta osoby →
  Spolehlivost u údajů v kartě osoby** (výchozí zapnuto).
- **Platí od:** aplikace 3.26.0, výzkum 1.30.0

<!-- zdroj: app:7b0471f8 src/reliability.ts (RELIABILITY_ORDER, reliabilityStep: readers ≥ 2 → dvě tečky; noSource se z aplikace nekrmí, verifyLocalEvidence dává jen confirmedByHuman) · src/verify.ts factVerifyReaders (_STROM_CHECKED proven, readers) · src/ui/fact-status.ts titleProven2/titleProven1 · src/ui/status-tip.ts readersAgree · 3.27.0: app:dde0151a src/ui/status-tip.ts factSourcesModel, sourceSub(quality citace) · src/settings.ts display.reliabilityCard (ON) · index.html settings-group-card · strings.ts reliability.*, verify.reasonHead, verify.confirmedAt · app:669c08f0 src/reliability.ts userTreeOrigin (_STROM_ORIGIN tree → import, nikdy human), treeOriginWords, reliabilityOptionsOf (původ z dat stromu, ne z mostu) · research:94d75934 src/core/model.ts ValueOrigin.tree, src/core/import.ts (soubor aplikace Strom → user + tree) -->

<a id="S7.2"></a>
## S7.2 Jedna značka na kartičce ve stromu

Kartička osoby ve stromu má vpravo dole jednu značku: jak je osoba doložená a kdo za jejími údaji stojí. Bere
nejslabší ze tří údajů kartičky: jméno, narození a úmrtí.

| Značka | Kdy |
|---|---|
| ✓ | údaj potvrdil člověk |
| ●● | doloženo, bez ohledu na počet čtenářů |
| ●○ | pravděpodobné nebo možné s citací originálu nebo opisu s primární informací (kvalita 2 nebo 3) |
| ○ | jen stopa: vodítko, nebo pravděpodobné či možné bez takové citace |
| ○○ (čárkovaně) | z rodokmenu (jiného programu, nebo z aplikace Strom, který převzal výzkum), neověřeno |
| tečkovaný rámeček | bez pramene |

- **Hlídá kód:**
  - počítají se jen údaje, které mají stupeň; když ho nemá ani jméno, ani narození, ani úmrtí, rozhodnou ostatní údaje
    osoby a jejích rodin (bydliště, povolání, sňatek): stačí jeden potvrzený nebo doložený údaj, nebo citace kvality
    2 nebo 3, a značka je ●○ (osoba je známá ze záznamu, třeba jako otec v křtu dítěte);
  - od aplikace 3.27.0 je kvalita citace její vlastní spolehlivost, jinak výchozí spolehlivost pramene
    ([A2.6.1](A2-loading-a-family-tree.md#A2.6.1)): tentýž pramen může být u povolání citací kvality 3 a u narození
    kvality 2. Záznam změny od výzkumu, který u údaje citovaný není, se počítá podle pramene;
  - strom výzkumu, jehož uložená data nesou původ údajů od výzkumu, má značku podle stupňů hned po načtení stránky,
    stejnou s mostem i bez něj; platí i pro stromy uložené dřív;
  - strom, který původ údajů nezná (bez výzkumu a bez importu z jiného programu), ukáže značku podle citací osoby:
    ●● doloženo, ●○ doloženo zčásti, tečkovaný rámeček bez pramene. Strom bez pramenů i bez původu značku nemá;
  - zástupná osoba („?“) značku nemá.
- **Bublina u značky:** „Nejslabší údaj kartičky: …“ a slovy, co značka znamená.
- **Ovládání:** **Nastavení → Karta osoby → Na kartě ukázat → Doložení a spolehlivost** (výchozí zapnuto).
- **Platí od:** aplikace 3.26.0
- **Od aplikace 3.28.0:** při oddálení stromu pod 0,55 je značka větší (asi 10 px na obrazovce), pod 0,3 se
  nekreslí. Řádek kartičky (jméno, data) končí před zvětšenou značkou s „…“ jen tam, kam značka při daném
  přiblížení dosáhne; řádky nad ní zůstanou celé a pod 0,3 jsou celé všechny. Jména se rozvrhují jako při 100 %,
  takže po přiblížení zpět nezůstanou zúžená.

<!-- zdroj: app:7b0471f8 src/reliability.ts CARD_STATUS_FACTS, CardStatusClass, cardStatusClassOfFact, otherFactsClass, card status bez původu (full/partial/none) · src/ui/card-signals-ui.ts (signál status, CARD_SIGNAL_DEFAULTS vše zapnuto) · 3.27.0: app:dde0151a src/reliability.ts citesSourceRead (FactCitationRef, citationQuality; holé id = záznam změny výzkumu podle pramene), cardFactCitations, withChangeRecord · strings.ts cardDensity.cardShow, cardStatus, cardStatusSub, cardShowHint, reliability.cardFacts, cardMark.* · CHANGELOG.cs.md 3.26.0 (Jedna značka na kartičce) · app:669c08f0 src/reliability.ts reliabilityOptionsOf, treeOriginWords (strom výzkumu s původem v datech: stejně s mostem i bez) · 3.28.0: app c0bc007f src/zoom.ts ZOOM_FAR 0.55, ZOOM_TINY 0.3 · index.html #tree-canvas.zoom-far .card-status-mark (scale 0.85 / zoom), .zoom-tiny skrytá, --mark-gap, --far-step (okraj jen u řádků, kam značka dosáhne), text-overflow ellipsis · src/renderer.ts fitCardNames (jako při 100 %), markGapRows · dirigent:prace/1113-app-drobnosti-1112 §5 -->

<a id="S7.3"></a>
## S7.3 Ověřit u údaje

U narození, křtu, sňatku, úmrtí a pohřbu, který není doložený ani potvrzený, nabídne bublina značky **Ověřit**.
Výzkum pak údaj ověří podle originálu záznamu: na pozadí, mimo práci na liniích.

- **Náhled před spuštěním** (**Ověřit {údaj}**):
  - **Co** se ověřuje;
  - **Jak**: „AI přečte záznam {záznam}“ (záznam je známý, levné · jeden známý záznam), nebo „AI hledá záznam podle
    citace v rodokmenu ({citace}) a přečte ho“, případně „AI hledá záznam v matrikách a přečte ho“ (dražší · záznam se
    teprve hledá);
  - **Odhad**: asi kolik sezení agenta to vezme;
  - „Běží na pozadí výzkumu. Výsledek se ukáže u údaje.“ U hledání navíc „Když se záznam nenajde, údaj zůstane
    z rodokmenu a bublina řekne proč.“
- **Po spuštění** (**Spustit ověření**) má údaj značku s hodinami „Čeká na ověření · ve frontě výzkumu, {pořadí}. na
  řadě“ a **Ověřit** se u něj znovu nenabídne.
- **Ověřit přednostně:** údaj, který výzkum zařadil k ověření sám ([S7.6](#S7.6)) a který není první na řadě, má
  v bublině **Ověřit přednostně**. Následuje stejný náhled s odhadem jako u **Ověřit**; po **Spustit ověření** dá
  výzkum úkol s tímto údajem na začátek fronty a bublina ukáže pořadí, které výzkum odpoví („1. na řadě“).
  - **Od výzkumu 1.31.0:** úkol, který člověk takto přeřadil, je v souboru pro aplikaci, ve stavu mostu (`/status`)
    i v počtech `strom verify status` vedený jako vyžádaný člověkem (`asked`), dokud neskončí sezení na něm. Aplikace
    pak **Ověřit přednostně** u údaje po obnovení znovu nenabídne; dřív ho nabízela znovu. Platí i pro celou osobu
    ([S7.4](#S7.4)).
- **Hlídá kód:**
  - ověření vyžádané člověkem jde ve frontě výzkumu první ([R2](R2-lines-and-queue.md));
  - **Ověřit** se nabízí jen u stromu napojeného na výzkum, když most běží a výzkum ověřování umí ([S7.9](#S7.9));
  - jméno, pohlaví, rozvod a ostatní události se neověřují;
  - **Ověřit přednostně** se nenabízí u údaje, o jehož ověření už požádal člověk (je první ve frontě), u údaje, který
    čeká na snímky nebo na svolení archivu, u prvního na řadě a když výzkum pořadí údaje neuvádí. Úkol, na kterém
    agent právě pracuje, výzkum nepřeřadí.
- **Hranice:** strom bez výzkumu má v bublině místo akce řádek „S výzkumem předků AI agent údaj ověří v matrikách
  sám.“ Když výzkum neodpoví: „Ověření se nepodařilo spustit, výzkum neodpovídá.“; když není co ověřit: „Výzkum tu
  teď nemá co ověřit.“ Když výzkum ověření odmítne, řekne bublina proč, například že výzkum je archiv, že údaj už
  nemá, nebo že je teď zaneprázdněný.
- **Ovládání:** aplikace: karta osoby → značka údaje → **Ověřit** (nebo **Ověřit přednostně**) → **Spustit
  ověření**. Terminál: `strom verify facts P…|F…|E… [--fact …] [--dry-run]`.
- **Platí od:** výzkum 1.30.0, aplikace 3.26.0

<!-- zdroj: app:7cf409bd src/verify-offer.ts verifyOffer (prioritize: pending wait, position > 1, step, researchVerifies) · src/verify-ui-model.ts factOffer (čekání spuštěné tady: position null) · src/ui/verify-ui.ts (tlačítko prioritize → verifyOpenPreview; verifyStart: pozice z odpovědi) · strings.ts verify.prioritize, verify.pending · research:a4a2f6c0 src/core/verify.ts verifyAsk (držený úkol → queueAt next; doing nebo už next beze změny), verifyWait (wait / asked / images / permission, position) · app:7b0471f8 src/verify-offer.ts verifyOffer (Verify jen u nedoložených, s feature verify, ne archiv, ne čekající; cost low/high) · src/verify-ui-model.ts verifyFactKind (BIRT, BAPM, MARR, DEAT, BURI) · strings.ts verify.btn, previewHead, what, how, estimate1, howRead, howSearch, costLow, costHigh, sessions, previewNote, previewNoteSearch, start, pending, failed, nothing, noResearch · app:669c08f0 strings.ts verify.busy, locked, whyArchive, whyRetracted, whyGone, whyMerged, whyOld, whyRefused (odmítnutí podle kódu) · research:6c6e7c3b strom help verify facts (první ve frontě; bez přečteného originálu se záznam hledá) · research:4ac323ef src/core/verify.ts askedFor (úkol přeřazený člověkem, queueAt next, do konce sezení na něm → asked v souboru, /status, verify status) · app:src/verify-offer.ts (asked: Verify first se nenabízí) · CHANGELOG.cs.md 1.31.0 -->

<a id="S7.4"></a>
## S7.4 Ověřit údaje u osoby

Všechny neověřené údaje jedné osoby se dají poslat k ověření najednou: tlačítkem **Ověřit údaje (N)** v kartě osoby
a v bublině značky na kartičce, nebo položkou **Ověřit údaje · N** v nabídce osoby.

- **Kde:**
  - karta osoby: tlačítko **Ověřit údaje (N)** nad oddílem **Události**. Když osoba nemá co nabídnout k ověření, ale
    její údaje čekají na ověření, je tam místo tlačítka „N údajů čeká na ověření“; jinak tam není nic;
  - bublina značky na kartičce ve stromu ([S7.2](#S7.2)): **Ověřit údaje (N)**, stejně jako v kartě osoby;
  - nabídka osoby: **Ověřit údaje · N**, při ověřování **Ověřuje se · N**.
- **Okno Ověřit údaje osoby:** „{jméno} · N neověřených údajů“, seznam údajů k zaškrtnutí, u každého **levné** nebo
  **dražší**, „Odhad: {n} levné, {n} dražší“ („Levné = přečíst známý záznam. Dražší = záznam se teprve hledá.“)
  a tlačítko **Ověřit (N)** podle zaškrtnutých. Po spuštění „N údajů je zařazeno k ověření.“ a položka v nabídce
  ukazuje **Ověřuje se · N**.
- **Ověřit přednostně pro celou osobu:** když osoba nemá co nabídnout k ověření a některý její údaj čeká dál ve
  frontě tak, jak ho výzkum zařadil sám, je v nabídce osoby pod **Ověřuje se · N** položka **Ověřit přednostně**
  a v bublině značky na kartičce pod „N údajů čeká na ověření“ tlačítko **Ověřit přednostně**. Otevře náhled osoby
  s tímto titulkem; po spuštění dá výzkum úkoly s čekajícími údaji osoby na začátek fronty ([S7.3](#S7.3)). Karta
  osoby má dál jen řádek „N údajů čeká na ověření“.
- **Hlídá kód:** N je přesně to, co výzkum vezme: údaje osoby a jejích rodin, které výzkum zná (i bydliště a údaje
  už doložené jiným čtenářem), kromě potvrzených člověkem, čekajících na ověření, jména a pohlaví. Počet v nabídce,
  v okně a ve zprávě po spuštění je stejný.
- **Hranice:** tlačítko i položka se ukážou jen s běžícím mostem výzkumu ([S7.9](#S7.9)) a jen tehdy, když aspoň
  jeden údaj osoby nabízí **Ověřit**.
- **Ovládání:** aplikace: karta osoby → **Ověřit údaje (N)** nad **Událostmi**; bublina značky na kartičce →
  **Ověřit údaje (N)** nebo **Ověřit přednostně**; nabídka osoby → **Ověřit údaje · N**, nebo **Ověřit přednostně**
  pod **Ověřuje se · N**; pak v okně **Ověřit (N)**. Terminál: `strom verify facts P…`.
- **Platí od:** výzkum 1.30.0, aplikace 3.26.0

<!-- zdroj: app:7cf409bd src/ui/verify-person-ui.ts personVerifyMenu (pending + prioritize), verifyCardTipActions (st-verify-first), renderPersonVerifyRow (jen pending řádek), showVerifyPersonDialog prioritize (titulek verify.prioritize) · src/ui/card-signals-ui.ts signal-verify-first · src/ui/context-menu.ts · research:a4a2f6c0 src/core/verify.ts verifyAsk (osoba: držené úkoly na začátek) · app:7b0471f8 src/verify-ui-model.ts personVerifyAskCount · strings.ts verify.menu, menuPending, personTitle, estimate, startN, bulkStarted · app:7eb903a3 src/ui/verify-person-ui.ts renderPersonVerifyRow, personVerifyMenu (karta osoby nad #events-section; jinak personPending), verifyCardTipActions · strings.ts verify.personBtn, personPending, events.title · dirigent:prace/1109-app-jeden-rodic/karta.md Výsledek (6f58068a: menu = náhled = toast; i bydliště, i doložené) -->

<a id="S7.5"></a>
## S7.5 Ověřit údaje ve stromu

Ověření podle originálů jde spustit pro celou linii, rod, nebo celý strom. Okno **Ověřit údaje ve stromu** ukáže
rozsah, pořadí a odhad ceny předem a ověřuje jen neověřené údaje (pravděpodobné, možné, vodítko, z rodokmenu).

- **Kde:** **Ověřit údaje ve stromu…** v oddílu **Ověřování** v Co ví výzkum ([S3](S3-what-the-research-knows.md)),
  v nabídce výzkumu a na kartě **Co teď** po importu jako **Ověřit údaje v pramenech**
  ([S6.4](S6-tree-from-another-program.md#S6.4)).
- **Volby:**
  - **Rozsah**: **Linie: {jméno}**, **Rod {příjmení}**, **Celý strom**;
  - **Pořadí**: **Nejbližší předci první**, **Nejdřív nejslabší doložení**, **Nejdřív nejdéle neověřené**;
  - **Nejdřív vyzkoušet na 5 osobách**: „Po 5 osobách se ověřování zastaví a ukáže výsledek.“ Tlačítko je pak
    **Vyzkoušet na 5**, jinak **Ověřit (N)**.
- **Hlídá kód:**
  - bere narození, křest, sňatek, úmrtí a pohřeb s citací originálu, které člověk nepotvrdil; i doložené (přečte je
    další čtenář), kromě těch, které už ověřil současný model; a vodítka z rodokmenu jiného programu i z rodokmenu
    z aplikace Strom, která nikdo nezměnil (záznam se hledá);
  - nikdy žijící osoby (narozené před méně než 100 lety bez zapsaného úmrtí);
  - jeden úkol na osobu (sňatek na rodinu), s nízkou prioritou, po práci na liniích;
  - spustit smí jen člověk: v aplikaci, nebo u svého terminálu. Agent smí jen `--dry-run` (kolik a za kolik).
- **Zastavit:** oddíl **Ověřování** ukazuje „Čeká na ověření: N údajů · ověřují se postupně, nejbližší předci
  první“ a **Zastavit** („Ověřování zastaveno.“). Zastavení zahodí úkoly, které ještě nikdo nezačal; začaté doběhnou.
  Zahozené údaje se samy znovu nezařadí, jen s novou citací originálu nebo na nové vyžádání.
- **Ovládání:** aplikace: viz výše. Terminál: `strom verify bulk --scope line|lineage|tree [--of G…|P…]
  [--order ancestors|weakest|oldest] [--try N] [--budget …] [--dry-run]`, `strom verify status`,
  `strom verify stop [--bulk]`.
- **Platí od:** výzkum 1.30.0, aplikace 3.26.0

<!-- zdroj: app:7b0471f8 src/ui/verify-person-ui.ts verifyRowsHtml, treeVerifyBlock, showVerifyBulkDialog · src/ui/research-actions-ui.ts:371 (nabídka výzkumu) · src/import-next.ts IMPORT_NEXT_VERIFY_FEATURES ['verify.bulk'] · src/verify-ui-model.ts VERIFY_TRY_PEOPLE 5 · strings.ts verify.bulkRow, bulkRowSub, bulkTitle, bulkSub, scope, order, scopeLine, scopeSurname, scopeTree, orderAncestors, orderWeakest, orderOldest, tryFirst, tryFirstSub, tryN, startN, bulkNote, section, pendingRow, pendingRowSub, stop, stopped · research:6c6e7c3b strom help verify bulk, verify stop, verify status · src/core/verify.ts (žijící) · research:94d75934 src/core/verify.ts verifyBulk (origin import nebo tree → search) -->

<a id="S7.6"></a>
## S7.6 Ověřování samo ve frontě výzkumu

Údaj, který cituje originál záznamu a zůstal pravděpodobný nebo možný, se ověří podle něj sám: výzkum ho zařadí do
fronty, aniž by o to kdo žádal.

- **Hlídá kód:**
  - fronta se doplňuje po plánování každého sezení a po `strom sync`;
  - bere narození, křest, sňatek, úmrtí a pohřeb osob napojených na strom, mimo vedlejší větve, ne žijících; v Archivu
    Stromu nikdy;
  - jeden úkol na osobu (sňatek na rodinu), po práci na liniích; po každých 5 sezeních jde jeden úkol ověření
    dopředu (nejbližší předek první);
  - údaj ověřený, ponechaný s důvodem, potvrzený nebo snížený se znovu nezařadí, jen s novou citací originálu nebo na
    vyžádání člověka;
  - úkol, který čeká na snímky nebo na svolení archivu, čeká jako každý jiný
    ([R6.2.1](R6-awaiting-action.md#R6.2.1), [R6.3.1](R6-awaiting-action.md#R6.3.1)).
- **Kde je vidět počet:** `strom check` („pozn.: N údajů s citací originálu čeká na ověření podle něj → strom verify
  status“), řádek `strom doctor` **ověření podle originálů** („N údajů s citací originálu čeká na ověření, ověřují se
  postupně“), `strom stats`, `strom verify status` (**Ověření podle originálů**: čeká, z toho vyžádáno, čeká na
  stažení skenů, čeká na povolení archivu; ověřeno a ponecháno s důvodem; potvrzeno podle skenu; a proč který údaj
  vypadl z výběru) a v aplikaci oddíl **Ověřování** ([S7.5](#S7.5)).
- **Platí od:** výzkum 1.30.0

<!-- zdroj: research:6c6e7c3b src/core/verify.ts (záhlaví: sweep po plánování, po strom sync, VERIFY_EVERY 5, jen napojené, mimo vedlejší větve, ne žijící, ne archiv, bez znovuzařazení) · cs.json ui.check.verify, ui.doc.verify, ui.stats.verify, ui.verify.status.* -->

<a id="S7.6.1"></a>
### S7.6.1 Jednorázová oprava starších výzkumů

Výzkum založený před verzí 1.30.0 má údaje s citací originálu, které nikdo podle originálu neověřil. Oprava **Údaje
k ověření podle originálů** je jednou zařadí k ověření.

- **Hlídá kód:**
  - oprava proběhne sama jednou, při prvním spuštění nové verze po záloze výzkumu; pak se podobné údaje zařazují
    průběžně ([S7.6](#S7.6));
  - jen úkoly: na údajích se nic nemění. „Nic se nedoloží bez pohledu na originál; žádná hodnota se nepřepíše.“;
  - `strom fixes undo verify-originals` zahodí úkoly, které nikdo nezačal; začaté nebo hotové zůstanou;
  - v Archivu Stromu se jen poznamená, že proběhla.
- **V aplikaci:** po aktualizaci výzkumu jednou zpráva „N údajů s originálem čeká na ověření, ověřují se postupně.“
- **Ovládání:** terminál: `strom fixes` (seznam oprav a co udělaly), `strom fixes undo verify-originals`.
- **Platí od:** výzkum 1.30.0, aplikace 3.26.0

<!-- zdroj: research:6c6e7c3b src/commands/fixchecks.ts VERIFY_ORIGINALS (Applied by itself once, at the first start of this strom after its backup; agentWork) · src/commands/fixes.ts "verify-originals" (undo: nobody started) · cs.json ui.fixes.verify-originals.name, .does, .not · app:7b0471f8 strings.ts verify.queuedToast -->

<a id="S7.7"></a>
## S7.7 Výsledek ověření

Sezení, které údaj ověřuje, si otevře snímek záznamu a přečte ho. Výsledek je jeden ze dvou: údaj je podle snímku
doložený, nebo zůstal, jak byl, s důvodem.

- **Hlídá kód:**
  - doložit jde jen s přečteným snímkem; bez pohledu na originál se nic nedoloží;
  - ponechaný údaj má důvod, který aplikace ukáže v bublině („Zůstává {stupeň} · výzkum ověřil {datum}“);
  - ověření žádnou hodnotu nepřepíše. Když záznam říká něco jiného, vznikne návrh nebo rozpor k rozhodnutí člověka
    ([S6.3](S6-tree-from-another-program.md#S6.3), [R5](R5-conflicts.md)); údaj zapsaný nebo potvrzený člověkem
    agent nikdy nezmění;
  - výsledek zapíše jen sezení, které úkol ověření dělá (`strom verify done`).
- **Proč:** agent dokládá, člověk potvrzuje. I shoda dvou čtenářů je čtení AI; jistotu dá až člověk se skenem
  ([S7.8](#S7.8)).
- **Platí od:** výzkum 1.30.0, aplikace 3.26.0

<!-- zdroj: research:6c6e7c3b strom help verify done (--proven --image | --kept --reason, jen uvnitř sezení) · cs.json ui.fixes.verify-originals.not · app:7b0471f8 strings.ts verify.reasonHead -->

<a id="S7.8"></a>
## S7.8 Potvrdit podle skenu: potvrzení člověkem

Nejsilnější značku dá člověk: podívá se na sken záznamu, porovná ho s údajem a v bublině značky klikne **Potvrdit
podle skenu**. Údaj je pak **Potvrzeno** (✓) a bublina místo akce ukazuje stav „✓ Potvrzeno podle skenu {datum}“
a **Vzít zpět**.

- **Hlídá kód:**
  - **Potvrdit podle skenu** se nabízí jen u údaje s pramenem: s citací, nebo se záznamem, ze kterého výzkum hodnotu
    přečetl. Údaj bez pramene ho nemá: není podle čeho potvrdit;
  - potvrzuje se hodnota, kterou člověk vidí. Když ji výzkum mezitím změnil, nic se nepotvrdí: bublina se zavře,
    aplikace řekne „Údaj se mezitím změnil, nic se nepotvrdilo. Potvrdit jde jen aktuální hodnotu z výzkumu.“ a načte
    aktuální verzi výzkumu (strom se změnami, které výzkum ještě nemá, se nejdřív zeptá **Načíst verzi výzkumu?**).
    Hodnota změněná v aplikaci a ještě neposlaná se k potvrzení nepošle; bublina řekne totéž;
  - **Vzít zpět** potvrzení zruší („Potvrzení vzato zpět“); údaj má pak zase stupeň, který měl;
  - potvrzení platí jen pro potvrzenou hodnotu: změna údaje ho ukončí, a když se hodnota vrátí, platí zase;
  - potvrzený údaj agent nikdy nezmění, jen navrhne ([S6.3](S6-tree-from-another-program.md#S6.3));
  - strom bez výzkumu: potvrzení drží aplikace sama, u údaje, který cituje pramen, když strom jde upravovat.
    Potvrzení i jeho vzetí zpět přejde se stromem do výzkumu, i přes soubor GEDCOM;
  - potvrzení, které drží aplikace, je změna stromu: má krok zpět („potvrzení údaje u {jméno} podle skenu“, „vzetí
    zpět potvrzení u {jméno}“) a zápis v historii změn („Údaj u {jméno} potvrzen podle skenu“, „Potvrzení podle skenu
    vzato zpět: {jméno}“);
  - strom napojený na výzkum: potvrzení zapíše výzkum přes most, jen když most běží a výzkum to umí; jméno a pohlaví
    se tu nepotvrzují;
  - v terminálu potvrzuje jen člověk u svého terminálu: `strom verify confirm E… [--undo]`. Agentovi `strom`
    potvrzení odmítne.
- **Hranice:** strom napojený na výzkum, jehož most neběží, **Potvrdit podle skenu** ani **Vzít zpět** nenabídne;
  potvrdit jde až s běžícím mostem, nebo v terminálu. Když výzkum potvrzení odmítne, řekne bublina proč, například
  že výzkum je archiv, nebo že ho drží jiná relace; „Nezměněno, výzkum neodpovídá.“ jen tehdy, když neodpoví.
- **Proč:** jistota o údaji vzniká tím, že člověk sám vidí záznam. Ověření agentem je čtení AI; ✓ říká, že záznam
  viděl člověk. Potvrzený přepis ([A3.1.1](A3-evidence-in-the-app.md#A3.1.1),
  [R3.4.1](R3-verification-and-citation.md#R3.4.1)) potvrzuje text záznamu, **Potvrdit podle skenu** údaj osoby.
- **Ovládání:** aplikace: karta osoby → značka údaje → **Potvrdit podle skenu** / **Vzít zpět**. Terminál:
  `strom verify confirm E…`, `strom verify confirm E… --undo`.
- **Platí od:** výzkum 1.30.0, aplikace 3.26.0

<!-- zdroj: app:7b0471f8 src/verify-offer.ts (human → Vzít zpět; bez výzkumu scan u citovaného; ve stromu výzkumu scan jen s researchConfirms) · src/verify.ts factConfirmation/researchConfirmation (platí jen s nezměněnou hodnotou) · src/verify-ui-model.ts (jméno, pohlaví bez scan ve stromu výzkumu) · strings.ts verify.scan, undo, undone, confirmedAt · app:7eb903a3 src/ui/verify-ui.ts (✓ jen u stavu, akce bez ✓; verifyConfirm: bez mostu DataManager.confirmFact) · src/data.ts confirmFact/unconfirmFact (undo.confirmFact, unconfirmFact, auditLog.confirmedFact, unconfirmedFact) · strings.ts verify.scan, confirmedAt · CHANGELOG.cs.md 3.26.0 · dirigent:test/vysledek-1109-zaver-c-potvrzeni.md (N2: bez mostu ✓ ani Vzít zpět ve stromu výzkumu) · prace/1109-app-potvrzeni-zmena · research:6c6e7c3b strom help verify confirm (jen uživatel, most; mimo něj requireHuman) · app:669c08f0 src/verify-offer.ts verifyOffer (scan jen se source: citace nebo záznam, ze kterého výzkum četl), src/verify.ts factConfirmMark (3 _TXT; changed), src/ui/verify-ui.ts verifyConfirm (409 confirm.changed → zavřít bublinu, toast, researchLoadNewer; změněno tady → jen důvod), strings.ts verify.confirmChanged, confirmLocked, confirmBusy, confirmFailed, sync.loadTitle · research:94d75934 POST /facts/confirm {txt} → 409 confirm.changed, feature facts.confirm.value -->

<a id="S7.9"></a>
## S7.9 Co jde s mostem a co bez něj

| | Strom napojený na výzkum, most běží | Strom napojený na výzkum, most neběží | Strom bez výzkumu |
|---|---|---|---|
| Značky u údajů a na kartičce | ano | ano, stejné jako s mostem (podle posledního stavu ze souboru) | ano, z importu a z citací |
| **Ověřit**, **Ověřit přednostně**, **Ověřit údaje · N**, **Ověřit údaje ve stromu…** | ano | ne | ne (řádek o výzkumu předků) |
| **Potvrdit podle skenu**, **Vzít zpět** | ano, zapíše výzkum | ne | ano, drží aplikace |
| **Zastavit** ověřování | ano | ne; `strom verify stop` v terminálu | – |
| Ověřování ve frontě výzkumu | běží | běží (výzkum na aplikaci nečeká) | – |

- **Hlídá kód:** výzkum ověřuje i bez aplikace: v terminálu jdou `strom verify facts`, `strom verify bulk`,
  `strom verify status`, `strom verify stop` a (jen člověk) `strom verify confirm`. Most výzkumu:
  [S1.1](S1-connecting-app-and-research.md#S1.1).
- **Platí od:** výzkum 1.30.0, aplikace 3.26.0

<!-- zdroj: app:7b0471f8 src/verify-offer.ts (feature verify a facts.confirm jen ze stavu výzkumu přes most) · dirigent:test/vysledek-1109-zaver-c-potvrzeni.md (N2) · research:6c6e7c3b strom help verify -->
