<a id="S6"></a>
# S6 Strom z jiného programu

Rodokmen z jiného programu (MyHeritage, Gramps, FamilySearch, programy pro Windows a další) přijde do aplikace
i do výzkumu jako soubor GEDCOM. Kapitola vede celou cestou: co se načte a co se ztratí, jak je vidět, odkud údaj je,
proč jsou údaje z rodokmenu jen vodítka, jak se k údaji z rodokmenu vrátit, co nabídne karta **Co teď**, jak se vrátit
v čase, jak strom poslat zpět a co udělá rodokmen načtený znovu. Popisuje aplikaci Strom 3.26.0 a výzkum 1.30.0.
Podrobnosti čtení souboru jsou v [A2](A2-loading-a-family-tree.md), export v [A7](A7-book-pages-and-export.md),
slučování v [A8](A8-merging-trees.md) a převzetí rodokmenu výzkumem v [R11.3](R11-material-from-the-user.md#R11.3).

Soubor, který napsal sám Strom (hlavička `1 SOUR STROM`), ani soubor JSON aplikace není rodokmen z jiného programu:
nemá značku původu, kartu **Co teď** ani ochranu údajů z rodokmenu. Výzkum, který takový soubor převezme, má jeho
hodnoty za rodokmen uživatele ([S6.3](#S6.3)).

<!-- zdroj: dirigent:spec/066-import-ged-a-ai/spec.md (rozhodnutí: GED s 1 SOUR STROM není import) · app:1c9b2392 src/ui/import-next-ui.ts, src/reliability.ts · research:v1.30.0 CHANGELOG.cs.md 1.30.0 -->

<a id="S6.1"></a>
## S6.1 Co se z rodokmenu načte a co se ztratí

Aplikace převezme osoby, rodiny, prameny, poznámky, události a média, které zná, a navíc ID, která program dal lidem
a rodinám. Co nepřevezme, spočítá a ukáže v souhrnu importu; nic se tiše neztratí.

| Program nebo soubor | Co se načte | Co se nepřenese nebo jen spočítá |
|---|---|---|
| MyHeritage | osoby a rodiny s ID programu (`_UID`, `RIN`) a původním označením záznamu (`@I12@`); fotky ze samostatných záznamů médií (`0 @O1@ OBJE`) přes odkazy na ně; vlastní značky programu (`_XXX`) přímo u osoby, rodiny a pramene se uchovají pro export zpět | výřezy fotek (`_POSITION`, `_CUTOUT`) jsou evidenční a nepočítají se; hlubší vlastní značky se spočítají; fotka rodiny přes samostatný záznam médií se jen spočítá |
| FamilySearch | osoby s ID FamilySearch (`_FSFTID`, nebo `EXID` s adresou familysearch.org) | jako výše |
| Gramps | osoby s původním označením záznamu (`@I0001@`) a `RIN`, když je soubor má | ID, podle kterého by šla osoba poznat jistě, Gramps nedává (`_UID` chybí): znovu načtený soubor se páruje hlavně podle jmen a dat ([S6.7](#S6.7)) |
| programy pro Windows | text v kódování Windows-1250 (střední Evropa) i Windows-1252 (západní Evropa) se správnými písmeny; u odhadnutého nebo jednobajtového kódování a textu s diakritikou řádek **Kódování textu** s ukázkou jmen a volbou jiného kódování ([A2.2](A2-loading-a-family-tree.md#A2.2)) | – |
| GEDCOM 7 | `UID`, `EXID` jako ID osoby | balík GEDZIP se nenačte |

- **Hlídá kód:**
  - ID osoby a rodiny (`_UID`, `UID`, `RIN`, `EXID`, `_FSFTID`, `AFN`) a původní označení záznamu se uchovají a vrátí
    se v exportu ([S6.6](#S6.6)) i do výzkumu;
  - souhrn importu má řádek „Uchováno pro export „Zpět do {program}“: N značek (…)“, když soubor má vlastní značky
    programu.
- **Hranice:** fotky, které soubor jen odkazuje cestou nebo adresou, v souboru nejsou: souhrn nabídne
  **Napojit soubory médií…** ([A2.1.1](A2-loading-a-family-tree.md#A2.1.1)).
- **Ovládání:** **Import → Import GEDCOM**; souhrn importu (okno **Konverze GEDCOM**).
- **Platí od:** aplikace 3.26.0 (ID, záznamy médií, vlastní značky, kódování Windows-1250), výzkum 1.30.0

<!-- zdroj: app:1c9b2392 src/ged-parser.ts (původní ID, OBJE přes odkazy, _XXX úrovně 1, výřezy MyHeritage evidenční), docs/GEDCOM-IMPORT.md (kódování) · strings.ts gedcom.keptTags, encodingLabel, encodingSample, attachMedia · dirigent:prace/1108-app-066-u8/karta.md Výsledek (f9735c6a, d2551dbc, 281e19e1; FAM se podle ID nepárují; fotka rodiny přes OBJE jen spočítaná) · prace/1108-app-066-u1u2 · research:v1.30.0 src/core/import.ts candidates, notTaken -->

<a id="S6.2"></a>
## S6.2 Značky spolehlivosti: odkud údaj je

U každého údaje osoby je značka, jak spolehlivý je: kdo ho potvrdil nebo doložil, nebo že přišel z rodokmenu jiného
programu a nikdo ho zatím neověřil. Stupně se liší tečkami, fajfkou a rámečkem, nikdy jen barvou.

| Značka | Význam (popisek po najetí) |
|---|---|
| **Potvrzeno** (✓) | **Potvrdil člověk**: údaj potvrdil, zapsal nebo vrátil člověk, nebo přijal návrh výzkumu |
| **Doloženo** (plné tečky) | údaj je doložený ([R3.1](R3-verification-and-citation.md#R3.1)); dvě plné tečky jen u dvou čtenářů záznamu shodně ([S7.1](S7-reliability-and-verification.md#S7.1)) |
| **Z rodokmenu** (prázdné tečky) | „Z rodokmenu (neověřeno): převzato z rodokmenu {program}, soubor {datum}“ |

Ostatní údaje ukazují stupeň jistoty výzkumu ([R3.1](R3-verification-and-citation.md#R3.1)). Všechny značky, značku
na kartičce ve stromu a ověření údajů podle originálů popisuje [S7](S7-reliability-and-verification.md).

- **Hlídá kód:**
  - značka **Z rodokmenu** platí, dokud má údaj hodnotu ze souboru. Úprava značku ukončí; u údaje se částečně
    změněného řekne, která část je z rodokmenu a kterou změnil člověk;
  - u stromu napojeného na výzkum ([S1](S1-connecting-app-and-research.md)) bere aplikace původ údaje z výzkumu;
    jinak ze záznamu o importu v aplikaci;
  - strom bez záznamu o importu (starší import, soubor Stromu) značku **Z rodokmenu** neukáže: nic se nehádá;
  - ve stromu výzkumu má údaj, který výzkum převzal z rodokmenu z aplikace Strom a nikdo ho od té doby nezměnil,
    značku podle stupně jistoty, bez stupně **Z rodokmenu**; ✓ nikdy ([S7.1](S7-reliability-and-verification.md#S7.1));
  - řádek u osoby říká, odkud údaje jsou: „Všechny údaje osoby jsou z {program} (soubor {datum}, načteno {datum}).“,
    nebo „Údaje se značkou z rodokmenu jsou z …“.
- **Hranice:** že údaj nemá pramen, aplikace u údaje zatím neukazuje: značka **Bez pramene** u údaje není
  ([S7.1](S7-reliability-and-verification.md#S7.1)).
- **Ovládání:** karta osoby (u údaje značka, **Co značky znamenají**); **Nastavení → Karta osoby → Spolehlivost
  u údajů v kartě osoby** (výchozí zapnuto) a **Na kartě ukázat → Doložení a spolehlivost** (výchozí zapnuto;
  kartička ukáže nejslabší z údajů jméno, narození, úmrtí, [S7.2](S7-reliability-and-verification.md#S7.2)).
- **Od aplikace 3.26.0:** dvě plné tečky u **Doloženo** dostane údaj, u kterého se při ověření výzkumem shodli dva
  čtenáři záznamu; kartička ve stromu má jednu značku místo dřívějších dvou voleb.
- **Platí od:** aplikace 3.26.0, výzkum 1.30.0

<!-- zdroj: app:7b0471f8 src/reliability.ts (pořadí human, proven, probable, possible, import, lead, none; tečky, ✓ a rámeček, ne barva; feature origin; bez záznamu o importu žádné Z rodokmenu; readers z _STROM_CHECKED, noSource nekrmeno) · src/ui/fact-status.ts · src/ui/person-reliability-ui.ts · src/settings.ts display.reliabilityCard (ON) · src/ui/card-signals-ui.ts (signál status, výchozí zapnuto) · index.html settings-group-card · strings.ts reliability.settingCard, cardDensity.cardStatus, settings.groupCard · app:669c08f0 src/reliability.ts userTreeOrigin (_STROM_ORIGIN tree) -->

<a id="S6.3"></a>
## S6.3 Údaje z rodokmenu jsou vodítka: agent navrhuje, člověk rozhoduje

Rodokmen jiného programu jsou závěry někoho jiného. Výzkum jeho údaje bere jako vodítka: změní je jen podle záznamu,
který cituje, jinak změnu jen navrhne. Co zapsal nebo změnil člověk, v aplikaci Strom nebo ve výzkumu, agent nikdy
nezmění: jen navrhne.

- **Hlídá kód:**
  - každý údaj ve výzkumu má původ: z rodokmenu, od člověka, nebo z výzkumu;
  - hodnota z rodokmenu z aplikace Strom (soubor nebo strom aplikace, který výzkum převzal), kterou nikdo od převzetí
    nezměnil, je z rodokmenu uživatele: agent ji nezmění, jen navrhne, jako údaj člověka, ale za potvrzenou člověkem
    neplatí. Úprava, vrácení, přijatý návrh a úprava poslaná z aplikace jsou údaj člověka;
  - údaj z rodokmenu agent změní jen s citovaným záznamem; bez něj, a vždy když o hypotézách rozhoduje člověk
    ([R10.3.2](R10-people-and-hypotheses.md#R10.3.2)), vznikne návrh jako rozpor k rozhodnutí člověka;
  - údaj člověka agent nezmění nikdy, ani souborem načteným přes `strom sync`; vždy jen návrh;
  - návrh, jehož navržená hodnota už platí, se uzavře sám. Návrh, jehož hodnota se od vzniku změnila, je zastaralý:
    přijmout nejde, jen uzavřít s ponechanou hodnotou;
  - hodnota z rodokmenu zůstane uložená vedle změněné ([S6.3.1](#S6.3.1)).
- **Výsledek v aplikaci:** u údaje se návrhem řádek **Výzkum navrhuje změnit údaj z rodokmenu** (nebo **Výzkum
  navrhuje změnit údaj zapsaný člověkem**) a **Rozpor ›**. V rozporu stojí proti sobě **Dnes · z rodokmenu** (nebo
  **Dnes · zapsal člověk**) a **Návrh výzkumu**; volby **Ponechat z rodokmenu** a **Přijmout návrh**. Po přijetí je
  údaj potvrzený člověkem a u údaje zůstane **Původně z rodokmenu: …** s **Vrátit**.
- **Proč:** rodokmen dává směr hledání, ne doklad. Co člověk zapsal, je jeho rozhodnutí; agent ho může jen podložit
  návrhem.
- **Ovládání:** aplikace: **Rozpor ›** u údaje. Terminál: `strom conflict list`, `strom conflict show X…` (návrh
  agenta a odkud je dnešní hodnota), `strom conflict resolve X… --take research|user`.
- **Platí od:** výzkum 1.30.0, aplikace 3.26.0

<!-- zdroj: research:v1.30.0 CHANGELOG.cs.md 1.30.0 (údaje z převzatého rodokmenu jsou chráněné) · dirigent:prace/1108-vyzkum-066-u3/karta.md, u3-nalezy, u3-nalezy2 Výsledek (původ import/user/research; --cite/--locator; conflict proposal; event edit/retract, person edit, name primary, place rewrite, source edit --transcript, sync; conflict.stale) · strom help conflict resolve (--take user|research) · app:1c9b2392 strings.ts origin.proposeImport, proposeUser, conflictOpen, sideImport, sideUser, sideProposal, keepImport, accept, acceptNote · research:94d75934 src/core/model.ts ValueOrigin.tree, src/core/origin.ts (user i tree: agent jen navrhuje), src/core/import.ts importGedcom/importStromJson (soubor aplikace → user + tree) -->

<a id="S6.3.1"></a>
### S6.3.1 Původně z rodokmenu a Vrátit

Údaj z rodokmenu, který výzkum nebo člověk změnil, si drží původní hodnotu. Aplikace ji ukáže u údaje jako
**Původně z rodokmenu:** s tím, podle čeho se změnil, a s tlačítkem **Vrátit**.

- **Hlídá kód:**
  - **Vrátit** zapíše hodnotu z rodokmenu znovu (s citací rodokmenu). Vrácený údaj je pak údaj člověka a výzkum ho
    už sám nezmění; záznam, podle kterého se měnil, zůstane u pramene;
  - vrátit smí jen člověk: v aplikaci, nebo u svého terminálu. Agentovi `strom` vrácení odmítne;
  - vrátit jde datum, místo nebo hodnotu události (každou část zvlášť) a jméno nebo pohlaví osoby.
- **Hranice:**
  - **Vrátit** jde jen na počítači, kde běží výzkum (**Vrátit jde, když na tomto počítači běží výzkum.**); na
    telefonu ne;
  - řádek **Původně z rodokmenu** a **Vrátit** má jen strom napojený na výzkum; společné údaje páru (sňatek, rozvod)
    ho nemají.
- **Ovládání:** aplikace: karta osoby → u údaje **Vrátit** → **Vrátit údaj z rodokmenu?**. Terminál:
  `strom event revert E… [--part date|place|value]`, `strom person revert P… --name N [--part given|surname]`,
  `strom person revert P… --sex`.
- **Platí od:** výzkum 1.30.0, aplikace 3.26.0

<!-- zdroj: research:v1.30.0 strom help event revert, person revert („Only the user: in the Strom app or at their own terminal“) · most /facts/revert · app:1c9b2392 strings.ts origin.was, by, accepted, revert, confirmTitle, confirmNote, noBridge, phone · src/ui (Původně/Vrátit jen s feature origin; vztahy páru bez řádku) -->

<a id="S6.4"></a>
## S6.4 Karta Co teď

Po načtení rodokmenu z jiného programu ukáže aplikace kartu **Co teď**: odkud strom je a co s ním jde udělat dál.
Ukáže se jednou po každém importu, ať se strom založil nový, vložil, nebo sloučil.

- **Obsah:**
  - původ: „Strom z {program} (soubor {datum}) · N osob“ (u vložení a sloučení do kterého stromu a kolik osob);
  - řádek kontroly dat: „Našla N věcí k prohlédnutí. Nic se samo neopravuje.“ a **Prohlédnout**
    ([A5](A5-tree-check.md)), nebo „Kontrola dat nenašla nic k opravě.“;
  - když soubor obsahuje víc rodin, které nic nespojuje: **Oddělit nespojené části…**;
  - výzkum: bez výzkumu na tomto počítači **Výzkum předků s tímto stromem** a **Výzkum předků**; s výzkumem **Začít
    výzkum s tímto stromem**; strom napojený na výzkum **Výzkum s tímto stromem** (místa bez polohy a osoby s údaji
    z rodokmenu), **Dohledat místa** a, když výzkum umí hromadné ověření, **Ověřit údaje v pramenech** (otevře
    **Ověřit údaje ve stromu**, [S7.5](S7-reliability-and-verification.md#S7.5));
  - věta „Údaje z rodokmenu bere výzkum jako vodítka: bez dokladu z pramene je nepřepíše a změněné jde vrátit.“;
  - odkazy **Zpět do {program}: export s prameny…** ([S6.6](#S6.6)) a nápověda **Strom z jiného programu**.
- **Hranice:** karta je jen u souboru jiného programu. Nahrazuje dřívější otázky po importu (kontrola, oddělení
  rodin).
- **Platí od:** aplikace 3.26.0

<!-- zdroj: app:7b0471f8 src/ui/import-next-ui.ts (IMPORT_NEXT_HELP_TOPIC = 'A2', nextCardClosed, :302 verify → showVerifyBulkDialog) · src/import-next.ts IMPORT_NEXT_VERIFY_FEATURES ['verify.bulk'] · strings.ts importNext.* · dirigent:prace/1108-app-066-u5 -->

<a id="S6.5"></a>
## S6.5 Zálohy a návrat v čase

Před každým importem do stromu a před sloučením si aplikace uloží zálohu stromu. Ke stavu před importem se tak jde
vrátit.

- **Hlídá kód:**
  - automatické zálohy stromu vznikají denně a před importem nebo sloučením; **Vložit do stromu** si zálohu
    vezme také;
  - zálohy žijí v tomto prohlížeči, ne v souboru se stromem: zmizí s vymazáním dat prohlížeče a na jiném počítači
    nejsou. Trvalou kopii dá export stromu do souboru;
  - u velkých záloh se nejstarší mažou dřív; tři nejnovější zůstávají vždy.
- **Ovládání:** aplikace: nabídka stromu → **Zálohy** → okno **Historie záloh**: **Vytvořit zálohu teď**,
  **Obnovit**, **Stáhnout**; přepínač **Automatické zálohy tohoto stromu**.
- **Platí od:** aplikace 3.26.0 (záloha před **Vložit do stromu**)

<!-- zdroj: app:1c9b2392 src/snapshots.ts SnapshotReason pre-import, pre-merge · src/ui/import-export.ts:818, :940 snapshotNow('pre-import') · src/data.ts:892 · src/ui/merge-ui.ts:769 · src/ui/tree-actions.ts:196 · strings.ts snapshots.menu, title, autoLabel, autoHint, inBrowser, budgetNote, createNow, restore, download -->

<a id="S6.6"></a>
## S6.6 Export zpět do programu, nebo ke sdílení

Export GEDCOM se nejdřív ptá, **K čemu soubor je**: **Zpět do {program}** (nebo **Zpět do jiného programu**), nebo
**Ke sdílení s ostatními**. Podle toho chrání žijící osoby a vrací ID programu.

- **Zpět do {program}:** „Celý strom i s prameny a citacemi, pro vlastní rodopisný program.“ Plná data všech osob,
  i žijících; prameny a citace. Osoby a rodiny z rodokmenu toho programu dostanou zpět své původní označení záznamu,
  kde je to bezpečné, a řádky svých ID (`_UID`, `RIN`, `EXID` …); označení, které použít nejde, jde jako `REFN`
  s `TYPE {program} xref`. Vlastní značky programu (`_XXX`) z importů téhož programu se vrátí.
- **Ke sdílení s ostatními:** „Chrání žijící osoby, obsah jde upravit.“ (výchozí ochrana GEDCOM,
  [A7.2.1](A7-book-pages-and-export.md#A7.2.1)). Zemřelým prameny zůstanou; u žijících osob se citace vynechají a okno
  to řekne („U N žijících osob se vynechá K citací. Zemřelým prameny zůstanou.“).
- **Hlídá kód:**
  - export GEDCOM drží prameny a citace zemřelých v každé volbě; export JSON, HTML a CSV se nemění
    ([A7.2](A7-book-pages-and-export.md#A7.2));
  - fotky a přílohy soubor nemá: cizí programy je ze souboru nečtou;
  - u **Zpět do {program}** počítá řádek souhrnu **Prameny a citace (N pramenů, M citací)** záznamy pramenů, které
    soubor zapíše. Prameny, které import udělal z jednoho záznamu pramene pro každou citovanou stranu
    ([A2.6](A2-loading-a-family-tree.md#A2.6)), jdou zpět jako ten jeden záznam: dvě matriky citované u 81 údajů dají
    „2 prameny, 81 citací“. Ve stromu zůstává pramen pro každou citovanou stranu;
  - **Označit údaje z výzkumu poznámkou** (výchozí zapnuto, jen když strom má údaje z výzkumu): údaj, který doplnil
    nebo opravil výzkum, dostane poznámku „Odvodil výzkum Strom (podle: …)“;
  - jinak se ID programu zapíší pod vlastní značky Stromu (`_STROM_IMPORT`), ať se při dalším načtení do Stromu
    vrátí.
- **Ovládání:** **Export → Export GEDCOM → K čemu soubor je**; z karty **Co teď** odkaz **Zpět do {program}: export
  s prameny…** (otevře export s volbou zpět).
- **Platí od:** aplikace 3.26.0

<!-- zdroj: app:7cf409bd src/ged-exporter.ts backSourceRecordCount (sourceGroups: jeden záznam za skupinu) · src/ui/export-gedcom-ui.ts backSources → exportGed.sumSources · e2e/export-gedcom-back.spec.ts · app:1c9b2392 src/ged-exporter.ts backToXrefs (původní xref, ID řádky úrovně 1, REFN + TYPE {prog} xref, _XXX téhož programu, jinak _STROM_IMPORT / _STROM_XID) · src/ui/import-export.ts:267 keepDeceasedSources: true (jen GEDCOM) · strings.ts exportGed.* -->

<a id="S6.7"></a>
## S6.7 Rodokmen načtený znovu a sloučení

Rodokmen téhož programu načtený znovu a sloučený se stromem najde své lidi podle ID programu. Osoba, která má stejné
ID, ale jinak se neshoduje, se jen nabídne.

- **Hlídá kód:**
  - shoda podle ID platí jako jistá jen tehdy, když se jméno podobá, pohlaví není muž proti ženě, roky narození
    (jinak křtu) se liší nejvýš o 3 a žádné jiné globální ID (například FamilySearch) se neliší. Jinak je to jen
    návrh shody se skóre nejvýš 79. Důvod shody je **Stejné ID v souboru**;
  - `_UID` se páruje s `UID`, `_FSFTID` s `EXID` s adresou familysearch.org;
  - označení záznamu a `RIN` přidají ke shodě jmen 25 bodů, jen u souborů téhož programu; samy shodu nezaloží;
  - nerozhodnutá shoda se při sloučení potvrdí sama až od skóre 80; shoda 50–79 se jen nabídne (?) a bez rozhodnutí
    člověka se nespojí ([A8.3](A8-merging-trees.md#A8.3));
  - poznámka osoby, vztahu i pramene se při sloučení nezdvojí;
  - sourozenci známí jen příjmením při opakovaném sloučení téhož souboru nepřibudou podruhé.
- **Strom načtený starší verzí aplikace:** sloučení téhož souboru dá stejný strom a stejné **Zpět do {program}** jako
  nový import: rodiny (ani rodina s jedním pojmenovaným rodičem) se nezdvojí a nepřibude sňatek, který soubor nemá.
  Osoba jen s křestním jménem a bez dat se spáruje se stejnojmennou osobou stromu přes spárovaného příbuzného (důvod
  například **Dítě spárované osoby**, **Sourozenec spárované osoby**, **Tchán, tchyně, zeť nebo snacha spárované
  osoby**); skóre 50, vždy jen ke kontrole. Nespáruje se, když má příbuzný dvě stejnojmenné osoby, liší se pohlaví
  nebo data narození či úmrtí.
- **Hranice:**
  - rodiny se podle ID nepárují. Ruční sloučení dvou osob poznámky nespojuje;
  - značky **Z rodokmenu** sloučení stromu ze starší verze nedoplní: jeho hodnoty zůstanou údaji člověka. Značky dá
    nový import souboru;
  - dvojníky z dřívějšího sloučení sloučení neodstraní; mažou se ručně.
- **Ovládání:** **Import → Import GEDCOM → Sloučit s existujícím** ([A8](A8-merging-trees.md)).
- **Platí od:** aplikace 3.26.0

<!-- zdroj: app:7b0471f8 CHANGELOG.cs.md 3.26.0 (Slučování) · src/merge matchSameNamedRelatives, standInsOfKnownFamilies (b3c3ce00) · strings.ts merge reasons partner_of_matched, child_of_matched, parent_of_matched, sibling_of_matched, in_law_of_matched · dirigent:prace/1109-app-slouceni-325, 1109-app-gedy-opravy (N6: značky importu se starému stromu nedoplní), 1109-app-jeden-rodic Výsledek -->
<!-- zdroj: app:1c9b2392 src/merge/matching.ts ID_MATCH_SCORE 100, ID_CANDIDATE_SCORE 60, ID_MAX_YEAR_GAP 3, WEAK_ID_BONUS 25, offerOnlyCap · src/merge/executor.ts:82 AUTO_CONFIRM_SCORE = 80 · src/merge/notes.ts · strings.ts merge reason id „Stejné ID v souboru“ · dirigent:prace/1108-app-066-u8/karta.md Výsledek (FAM se podle ID nepárují; mergePersons neslučuje poznámky) -->

<a id="S6.8"></a>
## S6.8 Rodokmen ve výzkumu

Výzkum převezme rodokmen z jiného programu příkazem `strom intake` jako vodítka ([R11.3](R11-material-from-the-user.md#R11.3))
a drží si původ každého údaje ([S6.3](#S6.3)).

- **Hlídá kód:**
  - ID programu se uchovají: tentýž rodokmen převzatý podruhé (nebo rodokmen jiného programu) najde lidi podle nich,
    nikoho nepřidá dvakrát a nové údaje přibudou jako vodítka;
  - osoba jen možná tatáž (jiné jméno, jiné ID FamilySearch, nebo jen ID bez `_UID` jako u Gramps) se nespojí:
    výsledek řekne „Možná tatáž osoba jako ve výzkumu podle ID programu (nespojeno, k rozhodnutí): …“ (v `--json`
    `candidates`);
  - co soubor má a nepřevezme se (záznamy médií, odkazy na média, vlastní značky programu), výsledek spočítá: „Ze
    souboru nepřevzato: …“ (v `--json` `notTaken`);
  - soubor v kódování Windows-1250 nebo Windows-1252 („ANSI“) se čte se správnými písmeny; znak, který přečíst nejde,
    se ohlásí, nikdy se tiše nenahradí;
  - ID se s výzkumem vracejí do aplikace Strom;
  - výzkum založený dřív se po aktualizaci jednou sám označí (které údaje přišly z rodokmenu a které jsou člověka);
    žádná hodnota se nemění. Kde to jisté není, platí údaj za údaj člověka. Hodnotu z rodokmenu z aplikace Strom pozná
    podle historie výzkumu: hned po převzetí rodokmenu byla, předtím ne, a je stejná i dnes; jen ta je z rodokmenu
    uživatele ([S6.3](#S6.3)). `strom fixes undo origins` značky vezme zpět, `strom fixes run origins` je pak dá znovu. I před označením najde znovu převzatý rodokmen lidi podle ID
    dřívějších importů.
- **Ovládání:** terminál: `strom intake rodokmen.ged`, `strom conflict list`, `strom event revert`,
  `strom person revert`, `strom fixes show origins` (co oprava je a co tu našla), `strom fixes undo origins`,
  `strom fixes run origins`.
- **Platí od:** výzkum 1.30.0

<!-- zdroj: research:v1.30.0 CHANGELOG.cs.md 1.30.0 · src/core/import.ts ImportResult.candidates, notTaken · src/commands/intake.ts:300-313 · assets/lang/cs.json ui.intake.candidates, ui.intake.notTaken* · strom help fixes run („readers, proven-originals and origins are set right by themselves once, run again only after strom fixes undo“) · dirigent:prace/1108-vyzkum-066-u3, 1108-vyzkum-066-u8 Výsledek (origins-1, nejisté → user; Gramps bez _UID kandidáti) · research:94d75934 src/core/originfix.ts ORIGINS_TREE_SETTLED origins-tree-1 (podle historie: stejná hodnota hned po převzetí, ne před ním, stejná dnes), settleOrigins · cs.json ui.fixes.origins.example.tree · strom help fixes show -->
