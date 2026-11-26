<a id="A8"></a>
# A8 Sloučení stromů

Jak aplikace Strom slučuje dva rodokmeny: soubor GEDCOM se stromem, dva stromy, nebo pohled se stromem. Popisuje
aplikaci 3.21.2; změny z novější verze mají u sebe její číslo. Od aplikace 3.32.0 vede každé sloučení průvodce
**Sloučení stromů** v šesti krocích ([A8.5](#A8.5) až [A8.13](#A8.13)) a spojení stromů nabízí **Změnit strukturu…**
([A14.5](A14-trees-and-structure.md#A14.5)). Sloučení duplicitní osoby uvnitř jednoho
stromu je jiná věc ([A5.6](A5-tree-check.md#A5.6)).

<a id="A8.1"></a>
## A8.1 Sloučení vždy založí nový strom

Neplatí od aplikace 3.32.0, nahrazuje ho [A8.5](#A8.5): průvodce zapíše do vybraného stromu, nebo založí nový.

Výsledek sloučení se uloží jako **nový strom**. Oba původní stromy i soubor zůstávají beze změny.

| Odkud | Ovládání |
|---|---|
| soubor GEDCOM | **Import → Import GEDCOM → Sloučit s existujícím** |
| jiný strom | správa stromů, u stromu **Sloučit strom** → **Vybrat cílový strom** → **Zahájit sloučení** |
| osoby právě zobrazené v pohledu | **Sloučit tento pohled do…** a výběr jiného stromu |

- Před uložením se aplikace zeptá na **Název sloučeného stromu:** (výchozí „cíl + zdroj“). Po sloučení ukáže
  počet sloučených a přidaných osob a nabídne přepnutí na nový strom.
- **Hranice:** prázdný pohled se sloučit nedá; pohled se slučuje jen do jiného stromu.
- **Platí od:** aplikace 1.0.0; Sloučit tento pohled do… aplikace 1.19.0

<!-- zdroj: app:src/merge/ui.ts:1421 newTreeNamePrompt, :1447 TreeManager.createTree · src/ui/merge-ui.ts:595 mergeViewInto · strings.ts merge.newTreeNamePrompt, merge.switchToNewTree, merge.mergeViewInto, merge.mergeViewEmpty, merge.mergeViewNoTarget, treeManager.mergeSourceTree, treeManager.selectTargetTree, treeManager.startMerge, importDialog.mergeExisting · git v1.19.0 (cf43bde) -->

<a id="A8.2"></a>
## A8.2 Párování osob

Aplikace ke každé osobě ze slučovaného zdroje hledá osobu v cílovém stromu a dvojici dá skóre shody.

- Skóre se počítá z podobnosti jména, data a místa narození, data úmrtí a ze shody rodičů a partnerů. Pohlaví nesmí
  odporovat.
- **Vysoká** je shoda 85 a víc, **Střední** 55 a víc, jinak **Nízká**. Osoba bez shody je **Nová**.
- Průvodce u shody uvádí důvod (například „Jméno a rok narození“, „Dítě spárované osoby“).
- **Hranice:** zástupné osoby (prázdné místo pro neznámého rodiče) se nepárují. Osoba bez křestního jména spárovaná přes
  příbuzného jde vždy ke kontrole.
- **Platí od:** aplikace 1.0.0
- **Od aplikace 3.26.0:** osoby se párují i podle ID programu (`_UID` = `UID`, `_FSFTID` = `EXID` s adresou
  familysearch.org), s důvodem **Stejné ID v souboru**. Jistá je taková shoda jen s podobným jménem, pohlavím ne muž
  proti ženě, roky narození nejvýš 3 od sebe a bez rozdílného globálního ID; jinak je to návrh se skóre nejvýš 79.
  Označení záznamu a `RIN` přidají ke shodě jmen 25 bodů jen u souborů téhož programu. Rodiny se podle ID nepárují
  ([S6.7](S6-tree-from-another-program.md#S6.7)).
- **Od aplikace 3.27.0:** ID programu (`_UID`, `UID`, `_FSFTID`, `AFN`, `EXID`), které ve stromu nese víc osob,
  neříká, která z nich to je: shodu samo nezaloží, jen ji nabídne.
- **Od aplikace 3.32.0:** průvodce ukazuje skóre jako procenta („N %“) a dvojice dělí na **Stejní** (skóre 80
  a víc) a **Možná stejní** (nižší skóre); osoba bez shody je mezi **Noví** ([A8.7](#A8.7)). Označení **Vysoká**,
  **Střední** a **Nízká** se už neukazuje.

<!-- zdroj: app:src/merge/matching.ts:318 findMatches, :781 (85 high, 55 medium), :790 calculateMatchScore, :618 UNKNOWN_NAME_MATCH_SCORE · strings.ts merge.highConfidence, merge.mediumConfidence, merge.lowConfidence, merge.matchReasons · 3.27.0: app:b5595ca1 src/merge/matching.ts idNamesSeveral (víc osob stromu se stejným silným ID → jen idCandidate), findDirectMatches · src/merge/id-match.ts STRONG_TAGS · CHANGELOG.cs.md 3.27.0 · spec 066 K3.2 -->

<a id="A8.3"></a>
## A8.3 Co rozhoduje člověk

Průvodce **Sloučení dat** ukáže shody, konflikty a nové osoby. Každou shodu jde rozhodnout.

| Volba | Co se stane s osobou ze zdroje |
|---|---|
| **Potvrdit** | sloučí se s osobou stromu |
| **Odmítnout** | přidá se jako nová osoba |
| **Přeskočit** | nepřenese se vůbec |
| **Přiřadit k existující** | sloučí se s ručně vybranou osobou |

- Nerozhodnutá shoda se skóre 50 a víc se při sloučení potvrdí sama; nerozhodnutá pod 50 se přidá jako nová osoba.
  Zbývají-li nerozhodnuté nejisté shody, aplikace se před sloučením zeptá.
- **Jen doplnit existující osoby (nepřidávat nové)** doplní spárované osoby a žádnou novou osobu nepřidá.
- Údaj, který mají obě strany jinak, je konflikt: **Ponechat stávající** nebo **Použít z importu**; přesnější datum
  nebo úplnější hodnota je **navrženo**. U páru se tak řeší stav vztahu, datum a místo sňatku a datum konce.
  Údaj jen na jedné straně se doplní.
- Rozpracované sloučení jde při zavření **Uložit na později**; vrátí se jako **Nedokončená sloučení**.
- **Platí od:** aplikace 1.0.0; konflikty páru aplikace 3.0.0; Přeskočit a Jen doplnit existující osoby aplikace
  1.19.0
- **Od aplikace 3.26.0:** nerozhodnutá shoda se potvrdí sama až od skóre 80 (v průvodci předem potvrzená, ✓). Shoda
  50–79 se jen nabídne (?) a bez rozhodnutí člověka se přidá jako nová osoba: zdvojenou osobu jde sloučit později,
  chybné sloučení vrátit nejde.
- **Od aplikace 3.32.0:** rozhoduje se v průvodci: dvojice v kroku **Kdo je kdo** ([A8.7](#A8.7)), rozdílné údaje
  v kroku **Kdo má pravdu** ([A8.9](#A8.9)). Volby **Potvrdit**, **Odmítnout**, **Přeskočit** a **Jen doplnit
  existující osoby** nahrazují **Stejná osoba**, **Nová osoba**, **Nepřidávat** a rozsah **d) Jen doplnit stávající
  osoby**. Navíc platí:
  - dvojice se skóre pod 80 se bez rozhodnutí člověka nespojí; zbylé nerozhodnuté jde naráz přidat jako nové, nebo
    vynechat ([A8.7](#A8.7)). Každá osoba importu skončí právě jednou: spojená, přidaná, nebo vynechaná výslovnou
    volbou;
  - návrh importu je jen rada: rozdílný údaj bez volby člověka nechá hodnotu stromu;
  - sloučení, při kterém by se něco ztratilo, se neuloží: před zápisem se kontrolují součty osob, párů, vazeb,
    pramenů, fotek a souborů a odkazy; když nesedí, řekne „Součty nesedí: nic se neuložilo.“ a co nesedí;
  - pramen importu s ID, které strom už má pro jiný pramen, přijde jako nový pramen;
  - úspěch se ohlásí až po skutečném zápisu do úložiště.

<!-- zdroj: app:src/merge/executor.ts:78 AUTO_CONFIRM_SCORE, :110 detectPartnershipConflicts, :302 toAdd (updateOnly, skip, reject), :792 mergePersonData · src/merge/ui.ts:1408 pendingGate · strings.ts merge.confirm, merge.reject, merge.skip, merge.manualMatch, merge.updateOnlyLabel, merge.keepExisting, merge.useImport, merge.suggestedPrecise, merge.partnershipFields, merge.closeSave, merge.pendingMerges · git v3.0.0 (2218cea), v1.19.0 (cf43bde) -->

<a id="A8.4"></a>
## A8.4 Co se přenese se stromem

Kromě osob a vztahů se sloučí i seznamy, které patří celému stromu.

- **Prameny:** stejný pramen (stejná signatura, jinak stejný popis) se nezdvojí; citace se převedou na ponechaný
  pramen a chybějící přepis a datum se doplní.
- **Od aplikace 3.27.0:** pramen, který se od ponechaného liší jen výchozí spolehlivostí, je týž pramen a nezdvojí se;
  převedené citace si nechají svou spolehlivost ([A2.6.1](A2-loading-a-family-tree.md#A2.6.1)). Jiné datum zápisu
  nebo jiné řádky citace dál dávají samostatný pramen.
- **Místa:** souřadnice, záznamy míst a jiné názvy míst se sjednotí; kde oba stromy znají totéž místo, platí cílový
  strom.
- **Tvary příjmení** ([A4.5](A4-surnames-and-families.md#A4.5)) se sjednotí; skupiny, které se překrývají, se spojí.
- Nový strom začíná bez výchozí osoby a pohledu ([A6.1.1](A6-views.md#A6.1.1)).
- Aplikace před sloučením řekne, kolik problémů kontroly mají oba stromy, a po sloučení nabídne kontrolu, když
  sloučení přineslo nové ([A5](A5-tree-check.md)).
- **Hranice:** opakovaný import souboru výzkumu do stromu výzkumu řeší [S1](S1-connecting-app-and-research.md).
- **Platí od:** aplikace 1.0.0; hlášení problémů kontroly aplikace 1.19.0
- **Od aplikace 3.26.0:** poznámky osoby, vztahu i pramene se při sloučení nezdvojí. Před sloučením se uloží záloha
  stromu ([S6.5](S6-tree-from-another-program.md#S6.5)). Po sloučení souboru jiného programu ukáže aplikace kartu
  **Co teď** ([S6.4](S6-tree-from-another-program.md#S6.4)). Ruční sloučení dvou osob
  ([A5.6](A5-tree-check.md#A5.6)) poznámky nespojuje.
- **Od aplikace 3.28.0:** společné události ([A10.1](A10-shared-events.md#A10.1)) se nezdvojí: spárují se s událostmi
  cílového stromu a převezmou jeho společnou událost; vlastní událost „Census“ se páruje se sčítáním lidu. Souhrn
  „Sdílené události: n spojeno“ ([A10.6](A10-shared-events.md#A10.6)).
- **Od aplikace 3.32.0:**
  - zálohu **Před sloučením** si průvodce vezme ze všech vstupů a vždy, i s vypnutými automatickými zálohami
    ([A8.10](#A8.10), [S6.5](S6-tree-from-another-program.md#S6.5));
  - rozpracované sloučení uložené na později pozná, že se strom mezitím změnil: návrhy se přepočítají, rozhodnuté
    dvojice zůstanou ([A8.5](#A8.5));
  - karta **Co teď** se ukáže jen po sloučení, které založí nový strom; po sloučení do stávajícího stromu je
    kontrola dat v kroku **Co se stalo** (**Zkontrolovat strom**, [A8.11](#A8.11));
  - strom si pamatuje záznam svých sloučení (datová verze 26); starší verze aplikace takový strom otevřou jen ke
    čtení.

<!-- zdroj: app:src/merge/executor.ts:211 executeMerge (mergeSourceCatalogs, places, mergePlaceRecords, mergePlaceAliases, addSurnameGroup, delete defaultPersonId/defaultView) · src/merge/ui.ts countNewMergeIssues · strings.ts merge.preValidationWarning, merge.newIssues · git v1.19.0 (00e5d38) · 3.27.0: app:dde0151a src/merge/executor.ts sourceKey bez quality, takeCitationQuality, remapCitations; app:5721b016 unionCitations · 3.28.0: app:80c2ffb9 src/merge/* (shareId, Census ↔ census), strings.ts merge.sharedJoined -->

<a id="A8.5"></a>
## A8.5 Průvodce Sloučení stromů

Každý import rodokmenu do stromu a každé sloučení dvou stromů vede jeden průvodce v šesti krocích. Do stromu se nic
nezapíše, dokud se zápis nepotvrdí v kroku **Co se stane**.

| Odkud | Průvodce | Ovládání |
|---|---|---|
| soubor GEDCOM | **Import rodokmenu** | **Import → Import GEDCOM**; ze Správy stromů začíná volbou **Nový strom** |
| jiný strom | **Sloučení stromů** | **Změnit strukturu…** › **Výběr nebo celý strom do jiného stromu…** › **Celý strom** ([A14.5](A14-trees-and-structure.md#A14.5)); cíl je otevřený strom, u otevřeného stromu jiný |
| výběr osob stromu (rod, seznam, linie, pohled, ručně) | **Sloučení stromů** | **Změnit strukturu…** › **Výběr nebo celý strom do jiného stromu…** › **Výběr…** |
| soubor GEDCOM nebo Strom (JSON) do otevřeného stromu | **Import rodokmenu** | **Změnit strukturu…** › **Přidat ze souboru do tohoto stromu…** |
| jiný strom do otevřeného stromu | **Sloučení stromů** | **Změnit strukturu…** › **Z jiného stromu do tohoto stromu…** ([A14.5](A14-trees-and-structure.md#A14.5)) |
| soubor GEDCOM nebo strom Strom (`.json`) puštěný na okno aplikace | **Import rodokmenu** | přetáhnout soubor na okno; cílem je otevřený strom ([A8.5.1](#A8.5.1)) |
| soubor puštěný na řádek stromu ve Správě stromů, řádek stromu přetažený na jiný řádek | **Import rodokmenu** / **Sloučení stromů** | Správa stromů; cílem je strom řádku, na který se pustilo ([A8.5.1](#A8.5.1)) |
| změny poslané z jiného Stromu | **Přijaté změny** | náhled přijatých změn → **Prohlédnout podrobně** |

- **Kroky:** **Co s tím** ([A8.6](#A8.6)), **Kdo je kdo** ([A8.7](#A8.7)), **Koho přidat** ([A8.8](#A8.8)), **Kdo
  má pravdu** ([A8.9](#A8.9)), **Co se stane** ([A8.10](#A8.10)), **Co se stalo** ([A8.11](#A8.11)). Krok, který
  pro zvolenou cestu nic nerozhoduje, se přeskočí a průvodce to u něj řekne.
- Nad kroky stojí průběžné počty osob importu: **Spojení**, **Noví**, **Nepřidaní** a **K rozhodnutí**; jejich součet
  je počet osob importu.
- Na širším okně (tablet, počítač) zabírá průvodce skoro celou obrazovku a kroky s počty jsou v jedné liště: počty
  slovy a „= N osob importu“; pod 1100 px šířky mají ostatní kroky jen číslo. Na telefonu je průvodce beze změny.
- Průvodce spuštěný ze zdroje (otevřený strom se slučuje do jiného) jmenuje všude cílový strom: v nadpisu, ve
  stavovém řádku, v „Porovnat … se stromem …“ i v řádku rozpracovaného sloučení.
- Porovnání velkého stromu ukazuje průběh a odhad času. **Přerušit** nic neztratí: volby z kroku 1 zůstanou
  a porovnání jde spustit znovu.
- Průvodce zavřený před zápisem řekne „Zatím se nic nezapsalo.“ a rozhodnutí jde **Uložit na později**. Uložené
  sloučení čeká ve Správě stromů pod svým cílovým stromem jako **Rozpracované sloučení** ([A14.1](A14-trees-and-structure.md#A14.1)). Když se cílový strom mezitím změnil, průvodce to při
  pokračování řekne; návrhy se přepočítají, rozhodnuté dvojice zůstanou.
- Sloučení, které se minule nedokončilo (zavřené okno, pád), aplikace při dalším otevření ohlásí: strom i soubor
  jsou beze změny.
- **Hranice:** soubor GEDCOM do prázdného stromu se dál vkládá přes **Vložit do stromu** bez průvodce
  ([A2](A2-loading-a-family-tree.md)). Sloučení dvou osob jednoho stromu je jiná věc ([A5.6](A5-tree-check.md#A5.6)).
- **Platí od:** aplikace 3.32.0; dřív sloučení vždy zakládalo nový strom ([A8.1](#A8.1)). Dřívější **Sloučit do jiného
  stromu…** v ⋯ Správy stromů a **Sloučit pohled do…** nahradilo v téže verzi **Změnit strukturu…**.

<!-- zdroj: app:debf50cc (3.32.0) src/merge/ui.ts startMerge, repeatLine, resume, step6Env · src/merge/wizard-steps.ts stepInfo (přeskočené kroky) · src/merge/wizard-ui.ts title (titleImport, titleTrees, titleShare, titleCompare) · src/ui/import-export.ts openGedcomGuide (prázdný strom → showGedcomResultDialog), src/ui/merge-ui.ts (crashed, pendingMergeFound) · src/ui/share-ui.ts reviewChangePacketInMerge · strings.ts mergeWizard.steps, cntJoined, cntNew, cntSkipped, cntPending, cntTotal, comparing, comparingNote, stop, closeMsg, savedLater, resumeChanged, crashed, treeManager.mergeInto, menu.mergeViewInto, shareDiff.reviewDetail, merge.pendingMerges · CHANGELOG.cs.md 3.32.0 · dirigent:spec/134-bezpecne-slouceni-stromu §1–§13 · dirigent:test/vysledek-1123-scenare-app.md · app:52171573 (dotaz 10: větší okno, lišta kroků s počty, pod 1100 px číslem) · 6e36ad08 (V-N4: cílový strom v nadpisu, stavovém řádku, Porovnat, řádku rozpracovaného) · a9bc0b6b, f0c5a3fb (139: Sloučit do jiného stromu a Sloučit pohled do… nahrazené Změnit strukturu; mergeViewInto bez volajícího) · strings.ts structure.pendingRow -->

<a id="A8.5.1"></a>
### A8.5.1 Soubor nebo strom puštěný myší

Soubor GEDCOM i strom Strom (`.json`) jde do průvodce dostat přetažením: na okno aplikace, nebo na řádek stromu ve
Správě stromů. Co se stane, určuje soubor a místo, kam se pustí.

- **Na okno aplikace:**
  - jeden soubor `.ged` otevře průvodce **Import rodokmenu** s cílem v otevřeném stromu (**Nový strom**, **Přidat do
    stromu**, **Jen porovnat**);
  - jeden soubor `.json` se nejdřív přečte. Strom otevře týž průvodce; zašifrovaný strom se napřed zeptá na heslo.
    Záloha **Exportovat vše** a balíček změn z jiného Stromu jdou cestou importu JSON. Jiný soubor `.json` je pro
    výzkum, který přijímá dávky, materiál ([R11.4](R11-material-from-the-user.md#R11.4)); jinak aplikace řekne
    „{soubor} není čitelný soubor rodokmenu (.json). Nic se nezměnilo.“;
  - víc souborů najednou jde u výzkumu, který přijímá dávky, do dávky; jinak rozhodne první soubor;
  - během tažení se jeden soubor typu JSON bere jako strom: nápis nad oknem řekne, že se otevře průvodce, ne dávka;
  - jiný soubor okno odmítne: „Sem lze přetáhnout jen soubory GEDCOM (.ged) a stromy Strom (.json).“ Prázdná
    obrazovka nabízí „Stačí pustit soubor .ged nebo .json a otevře se“.
- **Na řádek stromu ve Správě stromů:**
  - soubor `.ged` nebo `.json` puštěný na řádek otevře průvodce s volbou **Přidat do stromu** a stromem toho řádku
    jako cílem. Otevřený strom zůstane otevřený; zavření průvodce vrátí do Správy stromů;
  - řádek stromu přetažený myší na jiný řádek otevře průvodce **Sloučení stromů**: přetažený strom je import, strom
    pod ním cíl;
  - řádek pod taženým souborem je čárkovaně orámovaný a říká, co puštění udělá: „Pustit: přidat {soubor} do stromu
    {strom}“;
  - strom, do kterého teď zapsat nejde (zamčený, sledovaný živě, z novější verze aplikace), se cílem nestane:
    průvodce zůstane u volby **Přidat do stromu** bez vybraného cíle a dlaždice toho stromu v kroku 1 řekne proč.
    Jiný strom se sám nevybere;
  - řádek puštěný sám na sebe, dotykem nebo v aplikaci jen ke čtení neudělá nic. Nabídka ⋯ řádku zůstává.
- **Hranice:** nic se nezapíše bez průvodce; zápis platí jako každé sloučení a jde odvolat ([A8.12](#A8.12)).
- **Ovládání:** přetažení souboru na okno nebo na řádek Správy stromů; přetažení řádku stromu na jiný řádek.
- **Platí od:** aplikace 3.32.0

<!-- zdroj: app:b907d506 src/drop-route.ts dropRoute (guide-ged, json, batch, refuse), jsonDropKind (tree / šifrovaný, app-file: záloha Exportovat vše a balíček změn, other), dragLooksLikeJson · strings.ts onlyGedcom, dropHint, unreadableJson · app:73ee4625 src/tree-drop.ts treeRowDrop (sám na sebe, jen ke čtení nic), treeRowFileRoute, počáteční cíl (blokovaný strom nevybrán, důvod na dlaždici kroku 1, keepAdd) · src/ui/tree-management.ts (čárkovaný řádek, dotyk nic, ⋯ zůstává) · strings.ts mergeWizard.dropOnTree · dirigent:spec/134 K10.2, K10.3 -->

<a id="A8.6"></a>
## A8.6 Krok 1: Co s tím

V prvním kroku se volí, co s importem, do kterého stromu a co se stane s osobou, která už ve stromu je.

| Volba | Co se stane |
|---|---|
| **Nový strom** | vznikne nový strom s osobami importu; na výzkum napojený nebude; stávající stromy zůstanou beze změny |
| **Přidat do stromu** | osoby importu se přidají do vybraného stromu (**Do kterého stromu**) |
| **Jen porovnat** | projdou se stejné kroky, ale nic se nezapíše (strom, zálohy ani soubory); výčet jde na konci uložit |
| **Uložit jako JSON** | **Stáhnout JSON** stáhne převedená data jako soubor `.json`; do stromu se nic nezapíše |

- **Co s osobou, která už ve stromu je** (u **Přidat do stromu**):

  | Rozsah | U spojených osob | Nové osoby |
  |---|---|---|
  | **a) Jen chybějící osoby** | nic se nezmění | přidají se |
  | **b) Chybějící osoby a prázdné údaje** | doplní se jen prázdné údaje | přidají se |
  | **c) Rozhodnout údaj po údaji** | rozdíly se vyberou v kroku 4 ([A8.9](#A8.9)) | přidají se |
  | **d) Jen doplnit stávající osoby** | údaje podle kroku 4 | nikdo nový nepřibude |

- **Strom nepřevezme:** co aplikace ze souboru nepřevezme, je vyjmenované s počtem a příkladem; **Uložit seznam…**
  seznam uloží. Nic z toho se neztratí tiše.
- **Prohodit** u dvou stromů obrátí, co se do čeho přidává.
- Tentýž soubor sloučený do stromu znovu průvodce pozná a řekne, kolik osob je nových; osoby spojené minule se
  nezdvojí. Přidají se tak jen osoby, které se minule vynechaly. Totéž platí pro strom: „Ze stromu Horákovi už se
  sem slučovalo (12. 11. 2026). Nových je jen 5 osob; 40 je spojeno s tím dřívějším sloučením a nezdvojí se.“
- **Pravidla podle programu:** soubor GEDCOM z programu, pro který je uložené pravidlo, má rozsah a volby kroku 4
  předvyplněné: „Předvyplněno podle pravidla uloženého pro soubory z {program} (jde změnit).“ ([A8.6.1](#A8.6.1))
- Kopie stromu a strom bez výzkumu mají v kroku 1 popis „kopie stromu „{název}“ · bez výzkumu“; u cíle bez výzkumu
  stojí „{strom} nemá výzkum: po sloučení se nic neposílá.“ ([S1.10](S1-connecting-app-and-research.md#S1.10)).
- **Hranice:** cílem nemůže být zamčený strom (odemknout jde ve Správě stromů) ani strom z novější verze aplikace.
  Strom, na kterém právě běží živé sledování výzkumu (◎ **Sledovat agenta ve stromu**), je jen pro čtení; průvodce
  u něj nabídne **Vypnout sledování a sloučit sem**: před zápisem se uloží záloha, posílání do výzkumu se pozastaví
  a změny se tam pošlou až po volbě v posledním kroku. Kopie stromu výzkumu a strom bez výzkumu jdou cílem být, i když
  se jinde sleduje živě. Ze stromu otevřeného jen ke čtení jde import jen jako **Nový strom**.
- **Platí od:** aplikace 3.32.0

<!-- zdroj: app:debf50cc src/merge/steps/step1-what.ts (mode, scope, notTaken, swap, repeat), src/merge/ui.ts repeatLine (isRepeatOf podle otisku souboru, importedBefore), src/merge/plan.ts:715–717 (d: updateOnly, a: joinedDetails none, b: empty) · strings.ts mergeWizard.modeNew, modeNewDesc, modeAdd, modeAddDesc, modeCompare, modeCompareDesc, modeJson, modeJsonDesc, btnJson, whichTree, existingWhat, scopeA–scopeD, scopeADesc–scopeDDesc, notTaken, notTakenNote, saveList, swap, repeat, blockLive, blockLiveAction, blockLocked, blockReadOnly, blockNewer · app:166fbffd, 5c4bcc0c (1123-134 bod 10: blokuje jen strom s běžícím sledováním, kopie stromu výzkumu jde; nabídka Vypnout sledování a sloučit sem) src/live-follow-block.ts · CHANGELOG.cs.md 3.32.0 („tentýž soubor sloučený znovu přidá jen osoby, které se minule vynechaly“) · spec 134 K0.7 · app:7b967fd8 strings.ts mergeWizard.repeatTree (134 N1 doplněk) · bcb2a0fa strings.ts research.copyOf, structure.mergeNoResearch · app:02165311 strings.ts mergeWizard.repeat, repeatTree (datum dřívějšího sloučení v závorce) · app:fcddfcab (Jen porovnat: otisk všech stromů, záloh a souborů před a po; writePlan/applyPlan plán porovnání odmítnou) src/merge/write.ts · app:ad0ea45a strings.ts mergeWizard.prefilledFrom -->

<a id="A8.6.1"></a>
### A8.6.1 Pravidla pro soubory jednoho programu

Rozsah z kroku 1 a pravidla kroku 4 jde zapamatovat pro soubory GEDCOM z téhož programu. Další soubor z toho
programu začne průvodce s nimi; jde je změnit.

- **Uložit:** v kroku 5 nad tlačítkem zápisu stojí zaškrtávací políčko „Zapamatovat pro soubory z {program}: rozsah
  c), Platí můj strom“ (s pravidly podle druhu údaje „…, s výjimkami podle druhu údaje“). Pod ním: „Příště se v kroku 1
  předvyplní (jde změnit). Uložená pravidla jsou v Nastavení → Data a soukromí.“ Políčko je ve výchozím stavu
  nezaškrtnuté, i u předvyplněného kroku 1.
- **Kdy se uloží:** až po zápisu; u **Jen porovnat** po **Uložit výčet…**. Zavřený průvodce nic neuloží.
- **Co se uloží:** rozsah a pravidla pro celé sloučení a podle druhu údaje. Pravidla pro jednu osobu nebo jednu
  hodnotu se neukládají: patří lidem jednoho stromu. Pro jeden program platí jedno pravidlo; novější nahradí starší.
- **Kde:** v nastavení tohoto zařízení, ne ve stromu. **Nastavení** → **Data a soukromí** → **Uložená pravidla
  importu** („Předvyplní krok 1 průvodce importem pro soubory ze stejného programu.“) má řádek pro každý program
  (rozsah · pravidla) s **Odebrat**. Bez uloženého pravidla se skupina neukazuje.
- **Předvyplnění:** krok 1 dalšího souboru z téhož programu má rozsah a pravidla z uloženého pravidla a pod rozsahem
  větu „Předvyplněno podle pravidla uloženého pro soubory z {program} (jde změnit).“ Rozpracované sloučení si nechá
  své volby.
- **Hranice:** jen soubor GEDCOM, který uvádí program, jenž ho vytvořil (hlavička souboru, `HEAD.SOUR`), a jen
  u **Přidat do stromu** a **Jen porovnat**. Strom, výběr a soubor `.json` program neuvádějí; **Nový strom** rozsah ani
  pravidla nemá.
- **Ovládání:** krok 5 průvodce; **Nastavení** → **Data a soukromí** → **Uložená pravidla importu**.
- **Platí od:** aplikace 3.32.0

<!-- zdroj: app:ad0ea45a src/merge/saved-rules.ts sourceProgram (jen ged s program), canRemember (add | compare, ne json), ruleFromChoices (scope, rules.all, rules.kind; ne osoba ani hodnota), applySavedRule, rememberLabel, savedRuleDetail · src/merge/steps/step5-plan.ts:549 (políčko nad tlačítkem, rememberNote) · strings.ts mergeWizard.rememberRules, rememberNote, rememberKinds, prefilledFrom, settings.rulesSetting, rulesSettingHint, rulesRowDetail, rulesRemove, groupData · dirigent:spec/134 K10.4 -->

<a id="A8.7"></a>
## A8.7 Krok 2: Kdo je kdo

Krok 2 ukáže osoby importu ve třech skupinách a o každé dvojici rozhodne člověk. Spojení, které se zapíše, je vždy
vidět a jde zrušit.

- **Skupiny:** **Možná stejní** (skóre pod 80), **Stejní** (skóre 80 a víc, předem spojení) a **Noví** (bez shody).
  Skóre a důvody shody popisuje [A8.2](#A8.2).
- **Dvojice:** osoba importu a osoba stromu vedle sebe v řádcích **Jméno**, **Narození**, **Úmrtí**, **Rodiče**,
  **Partneři**, **Děti** a **Doklady**, s **Proč ano:** a **Co odporuje:**.
- **Rozhodnutí:** **Stejná osoba** (S), **Nová osoba** (N), **Jiná osoba…** (J, spojit s jinou osobou stromu)
  a **Nepřidávat** (X); ↑ ↓ přejde na další dvojici.
- Rozhodnutí přepočítá návrhy u příbuzných; rozhodnuté dvojice se nemění.
- **Opakované sloučení:** sloučení téhož zdroje podruhé pozná osoby, které přineslo nebo spojilo dřívější
  neodvolané sloučení. Jsou ve **Stejní** s důvodem „Už sloučeno dřív z tohoto zdroje“ a nic se nezdvojí.
- **Proč ano** jmenuje jen to, co dávají oba záznamy: „Přesné jméno a datum narození“ jen při stejném datu narození
  na obou stranách, při shodě jen roku „Jméno a rok narození“, jinak „Přesné jméno“.
- **Zbylé nerozhodnuté** jde vyřídit naráz: „Zbylých N nerozhodnutých:“ **Přidat jako nové (N)** (průvodce upozorní,
  že to může zdvojit osoby, které už ve stromu jsou), nebo **Nepřidávat (N)**. Dvojice se stejnými rodiči, dítětem
  nebo partnerem hromadné rozhodnutí vynechá; pod tlačítky stojí „2 dvojice se stejnými rodiči, dítětem nebo
  partnerem je potřeba rozhodnout jednotlivě.“ Když zbývají jen takové, zůstane jen ta věta. Dokud zbývá nerozhodnutá
  dvojice, krok 3 se neodemkne.
- **Na širším okně:** nad dvojicí je řádek ovládání (‹ skrýt seznam · „Dvojice i z n“ · skupina · ↑ ↓ · rozhodnutí),
  kandidáti stromu jsou v řádcích („Ve stromu Horákovi 2 kandidáti“) a tabulka dvojice roluje sama s pevnou
  hlavičkou (sloupec „Import · {soubor}“). Příbuzní jsou po řádcích, z dokladů první tři a „a N dalších ▸“ /
  **Sbalit**. Zbytek nerozhodnutých je v patě seznamu; seznam jde složit do úzké lišty (**Skrýt seznam dvojic** /
  **Ukázat seznam dvojic**). Telefon má krok beze změny.
- **Kde se krok otevře:** když v **Možná stejní** čeká nerozhodnutá dvojice, krok 2 se otevře tam, na první z nich
  (i po návratu z kroku 1 nebo z pozdějšího kroku a u rozpracovaného sloučení); jinak na skupině ukázané naposled.
  Skupina přepnutá ručně uvnitř kroku zůstane.
- **K rozhodnutí N** v počtech (na telefonu řádek počtů) a „· N k rozhodnutí“ pod krokem 2 vedou na první
  nerozhodnutou dvojici v **Možná stejní** (na telefonu na její záhlaví). Když zbývají jen nenapojené skupiny, vedou
  do kroku 3. Při 0 a po zápisu nevedou nikam.
- **Partner spojené osoby:** když je osoba importu spojená a jejich společné děti také, nabídne se její partner
  z importu v **Možná stejní** s druhým rodičem těch dětí ve stromu, s důvodem „Partner spojené osoby, společné
  děti“, i při jiném příjmení (rodném × po sňatku). Podmínky: pohlaví se neliší a jedno křestní jméno je stejné
  (iniciála nebo zkrácený tvar jména jen při podobném příjmení, nebo když je to příjmení partnera po sňatku). Skóre je
  pod hranicí 80, rozhodne tedy člověk. Slabší dvojice jiné osoby bez takového dokladu (jmenovkyně, švagrová)
  ustoupí. Manžel potvrzený nebo vybraný ručně v kroku 2 takto přivede i manželku.
- Dvojice spojená v kroku 4 volbou **Stejná osoba** ([A8.9](#A8.9)) má v kroku 2 důvod „stejná osoba, zvoleno
  v kroku 4“.
- **Hranice:** u **Nový strom** se krok přeskočí: všechny osoby jsou nové.
- **Platí od:** aplikace 3.32.0

<!-- zdroj: app:debf50cc src/merge/steps/step2-who.ts pairRows (AUTO_CONFIRM_SCORE → same, jinak maybe), decisions, recalc, rest · src/merge/executor.ts AUTO_CONFIRM_SCORE = 80 · src/merge/wizard-steps.ts stepInfo (step2 skip newTree, person-pending blokuje) · strings.ts mergeWizard.grpMaybe, grpSame, grpNew, rows, whyYes, whyNo, decSame, decNew, decOther, decSkip, decKeys, keysHint, recalc, restLabel, restAdd, restSkip, restAddWarn, sameNote · spec 134 §4 · app:1046e99b (1123-134 N1, N3) strings.ts merge.matchReasons.merged_before, exact_name, exact_name_gender_birthdate, name_gender_birthyear · app:878f29b7, f6dc2c4f strings.ts mergeWizard.restOneByOne (134 N2: stejní rodiče, dítě, partner) · 0af3e450, 642b2d05 (dotaz 10: řádek ovládání, candidatesIn, importCol, recordsMore, recordsLess, pairsHide, pairsShow, zbytek v patě) · app:e1c98f45 (K10.5: otevření na první nerozhodnuté dvojici Možná stejní, jinak skupina naposled; K rozhodnutí N a · N k rozhodnutí jako tlačítka, jen nenapojené → krok 3, při 0 a po zápisu nic) strings.ts mergeWizard.cntPending, subPending · app:fd66ae63 (K10.6: partner spojené osoby se společnými spojenými dětmi, pod AUTO_CONFIRM_SCORE, pohlaví, jedno křestní jméno, iniciála či zkrácený tvar jen při podobném příjmení nebo příjmení po sňatku; slabší dvojice ustoupí; manžel potvrzený v kroku 2 přivede manželku) strings.ts merge.matchReasons.partner_shared_children · app:d6333eab strings.ts mergeWizard.joinedInStep4 · dirigent:spec/134 K10.5, K10.6 -->

<a id="A8.8"></a>
## A8.8 Krok 3: Koho přidat

Krok 3 vybere, které nové osoby se přidají. Nová osoba, kterou nic nespojuje se stromem, se nepřidá bez rozhodnutí.

- **Koho výběr vezme:** **Všichni noví**, **Jen napojení, do N kroků** (jen osoby spojené se stromem nejvýš přes
  N příbuzných), **Předci osoby…**, **Potomci osoby…** (s počtem generací), **Rod / příjmení…** a **Ručně**.
  Výběr předků, potomků nebo rodu ostatní nové odškrtne.
- **Noví napojení:** seznam nových osob s cestou ke stromu („napojí se přes osobu …“), hledáním, **Filtry**
  (**Příjmení**, **Roky**, **Místo**, **S pramenem**, **Napojení**, **Žijící**), **Vynechat žijící (N)**
  a **Náhledem** větve.
- Odškrtnutí osoby, přes kterou se ke stromu napojují další, se zeptá: **Vynechat i je**, **Nechat je jako
  nenapojené**, **Ponechat osobu …** nebo **Nechat jako „?“** (na jejím místě zůstane spojovací „?“ bez údajů
  a příbuzní zůstanou napojení).
- **Nenapojené skupiny:** osoby bez cesty k osobám stromu, po rodech. Každá skupina potřebuje rozhodnutí: **Napojit
  na osobu…** (osoba skupiny je rodič, dítě nebo partner osoby stromu), **Přidat nenapojené**, **Samostatný strom**
  (po zápisu vlastní strom) nebo **Nepřidávat**. Nerozhodnutá skupina zdrží zápis.
- **Hranice:** napojení, které by dítěti dalo třetího rodiče, se nezapíše. Rozsah **d)** nikoho nového nepřidá a krok
  přeskočí. U **Nový strom** krok vezme všechny osoby.
- **Platí od:** aplikace 3.32.0

<!-- zdroj: app:debf50cc src/merge/steps/step3-whom.ts, step3-model.ts, src/merge/plan-select.ts (scope d → 'scope', :392), src/merge/wizard-steps.ts (step3 skip allNew, group-pending) · strings.ts mergeWizard.vAll, vLinked, vAnc, vDesc, vRod, vManual, variants, pickAnc, pickDesc, pickRod, generations, tabLinked, tabGroups, linksVia, skipLiving, s3Tools, fSurname, fYears, fPlace, fSource, fLinking, fLiving, previewBtn, branchPreview, unlinkTitle, unlinkAll, unlinkLoose, unlinkKeep, unlinkQ, unlinkQDesc, groupsLead, gConnect, gLoose, gOwn, gSkip, relParent, relChild, relPartner, connectThird, groupsWhy · spec 134 §5, §6 -->

<a id="A8.9"></a>
## A8.9 Krok 4: Kdo má pravdu

Krok 4 rozhodne údaje, které mají spojené osoby jinak. Bez volby člověka platí strom.

- **Pravidla:** **Platí můj strom** (výchozí), **Platí import**, **Nechat obojí** (hodnota importu se uloží vedle,
  „Import uvádí: …“), **Přesnější, když neodporuje** a **Rozhodnout jednotlivě**.
- Pravidlo jde dát celému sloučení, druhu údaje (**Jméno**, **Narození**, **Úmrtí**, **Místa**, **Události**,
  **Poznámky**, **Fotky**, **Pohlaví**, **Sňatek**), osobě i jedné hodnotě. Užší pravidlo má přednost: celé → druh
  údaje → osoba → hodnota. U každého pravidla je vidět, kolik rozdílů zůstane, změní se nebo se uloží vedle.
- **Chráněné údaje:** údaj ve stromu označený „doloženo“, „potvrzeno“ nebo „z výzkumu“ hromadná volba nezmění; jde
  změnit jen jednotlivě. Přepis doloženého údaje se zeptá **Přepsat doložený údaj?**; po zápisu je údaj „Z rodokmenu“
  a doklad zůstane u osoby jako pramen.
- **Rozpory vazeb** (jiní rodiče, druhý partner, jiný sňatek, třetí rodič, smyčka předek–potomek) hromadná volba
  nerozhodne: **Nechat moje**, **Z importu** nebo **Obojí** se volí u každého řádku. Smyčka se nikdy nezapíše.
- **Děti jednoho páru:** děti, jejichž rodiče mají tentýž rozpor (třetí rodič, jiní rodiče), jsou jeden řádek
  s počtem („třetí rodič · 6 dětí“, jména prvních tří a „+3“) a rozhodnou se jednou za všechny. Počet rozporů v kroku
  počítá řádky.
- **Stejná osoba:** u třetího rodiče nebo druhého partnera, který je pro strom nový, když na druhé straně stojí jedna
  osoba stromu, kterou import nezná, je navíc volba **Stejná osoba**. Spojí obě osoby jako rozhodnutí kroku 2 (ručně
  vybraná dvojice, uloží se se sloučením jako každá jiná). Rozpory, které tím odpadnou, zmizí a počty se přepočtou.
  Pod rozpory stojí „Spojeno jako stejná osoba: {osoba importu} = {osoba stromu}“ se **Zpět** (vrátí rozhodnutí, které
  platilo předtím). Nenabízí se u jiného pohlaví, u osoby stromu spojené už s někým jiným, u spojení, které by
  udělalo smyčku, ani u spojovacího „?“.
- **Hranice:** u rozsahu **a)** a **b)** se krok přeskočí; když jsou rozpory vazeb, ukáže jen je. U **Nový strom** se
  přeskočí vždy.
- **Platí od:** aplikace 3.32.0

<!-- zdroj: app:debf50cc src/merge/steps/step4-rules.ts (relOnly, s4SkippedTitle, protected), src/merge/plan.ts:438 relationConflicts, :534 (scope a), :542 (scope b jen prázdné) · src/merge/wizard-steps.ts step4 (newTree, scope a/b skip) · strings.ts mergeWizard.ruleAll, ruleOrder, rMine, rImport, rBoth, rPrecise, rEach, rDefault, importSays, kinds, protectedLine, protKinds, protTitle, protText, protAfter, relConf, relKinds, relAlways, keepMine, fromImport, both, loopNever, step4Skipped, s4SkippedTitle, relOnly · spec 134 §7, K0.3 · app:d6333eab (K10.7, K10.8: děti jednoho páru se stejným rozporem jeden řádek, počet řádků; Stejná osoba u třetího rodiče či druhého partnera, spojení jako rozhodnutí kroku 2, Zpět; ne jiné pohlaví, osoba spojená s jiným, smyčka, „?“) strings.ts mergeWizard.relChildren, samePerson, samePersonTitle, joinedSame, undoSame · dirigent:spec/134 K10.7, K10.8 -->

<a id="A8.10"></a>
## A8.10 Krok 5: Co se stane a zápis

Krok 5 ukáže celý výčet změn po skupinách. Zapíše se až jeho tlačítkem a jen to, co výčet ukazuje.

- **Výčet:** **Noví**, **Spojení**, **Změny údajů**, **Doplněné údaje**, **Spojené prameny**, **Páry a vazby**,
  **Prameny**, **Místa**, **Fotky a soubory**, **Nepřidaní** (u každé osoby proč: krok a volba) a **Strom
  nepřevezme**. Položku jde odškrtnout. **Uložit výčet…** ho uloží jako text (`.txt`) a jako data (`.json`); text
  končí počty slovy („Spojení 40 · Noví 5 · Nepřidaní 0 · K rozhodnutí 0 · = 45 osob importu“).
- **Doplněné údaje** (jen když nějaké jsou): prázdné údaje spojených osob, které zápis doplní, po řádcích osoba ·
  údaj (e-mail, další tvary jména, události, prameny, otevřená otázka…).
- **Spojené prameny:** pramen zdroje se spojí jen se stejným pramenem cílového stromu (stejné číslo výzkumu, citace,
  nebo název, archiv a místo): „1 pramen spojen se stávajícím“. Skupina **Prameny** uvádí jen nové. Prameny zdroje se
  mezi sebou nespojují: dva záznamy jedné matriky, které se liší jen číslem pramenu výzkumu, zůstanou dva. Výsledek
  má tak stejné prameny bez ohledu na směr (**Prohodit**).
- **Počty sedí všude:** nové páry a změny údajů jsou v kroku 5, v kroku 6, v záznamu sloučení i v dialogu odvolání
  stejné číslo jako to, co se zapíše. Spojovací „?“ bez dětí ani rozsah **d)** pár nepřidají ani nehlásí; dvě osoby
  importu spojené s jednou osobou mění údaj jednou (i v kroku 4).
- Jiná fotka se stejným názvem a velikostí je ve **Změny údajů** jako „Fotka: photo (3222) → jiná fotka se stejným
  názvem a velikostí“ (i v kroku 4, v Historii sloučení, v odvolání a v uloženém výčtu).
- **Kam zapsat:** **Zapsat do stromu …**, nebo **Zapsat do nového stromu** (kopie cílového stromu s importem; cílový
  strom zůstane beze změny).
- **Záloha:** před zápisem do stromu se vytvoří záloha **Před sloučením**, vždy, i s vypnutými automatickými
  zálohami. Zůstane, dokud jde sloučení odvolat; rotace záloh ji nesmaže. Když by se na ni nevešlo místo, průvodce
  se zeptá (**Ponechat obě (nad limit)** nebo **Smazat nejstarší jinou zálohu**). Bez zálohy se nic nezapíše:
  „Záloha se nepovedla, proto se nic nezapsalo.“
- **Pojistky:** když se cílový strom mezitím změnil, výčet se přepočítá a nic se nezapíše naslepo. Před uložením se
  kontrolují součty a odkazy; když nesedí: „Součty nesedí: nic se neuložilo.“ Zavřít okno během zápisu nic
  nerozbije: zápis se dokončí, nebo se nezapíše nic.
- Zápis je jeden krok **Zpět**.
- **Zapamatovat pravidla:** u souboru GEDCOM, který uvádí svůj program, stojí nad tlačítkem „Zapamatovat pro
  soubory z {program}: …“ ([A8.6.1](#A8.6.1)).
- **Hranice:** u **Jen porovnat** je hlavní tlačítko **Uložit výčet…**: uloží výčet a průvodce zavře. Nezapíše se nic:
  strom, zálohy ani soubory zůstanou, jak byly, a plán porovnání aplikace k zápisu nepustí. Kontrola nepočítá do
  **Změny údajů** prázdné údaje doplněné rozsahem **b)**.
- **Ovládání:** tlačítko „Přidat N osob, změnit M údajů“, s doplněnými údaji „…, doplnit F“, u nového stromu
  „Vytvořit strom s N osobami“.
- **Platí od:** aplikace 3.32.0

<!-- zdroj: app:debf50cc src/merge/steps/step5-plan.ts (skupiny, retentionAsk, targetChanged), src/merge/write.ts (backupBeforeMerge keepFor, storageFull, badTotals, one undo step strings.undo.mergeTrees) · src/data.ts:2047 backupBeforeMerge (bez ohledu na automatické zálohy, keepFor mimo rotaci) · src/snapshots.ts planRetention (keepFor se nesmaže) · strings.ts mergeWizard.gNew, gJoined, gFields, gLinks, gSources, gPlaces, gMedia, gSkipped, gNotTaken, skipWhy, whereTo, writeInto, writeNew, writeNewDesc, backupLine, savePlan, btnWrite, btnNewTree, backupFailed, retentionAsk, keepBoth, dropOldest, targetChanged, replanned, writingSafe, badTotals · dirigent:test/vysledek-1123-scenare-app.md N1 (doplněná prázdná pole se v kroku 5 nepočítají) · spec 134 §8, K0.2, K0.4, K0.5 · app:235afcd5 (134 N4, S-N2, S-N1: gFills, btnWrite …, doplnit F, jeden počet párů a údajů) · 834ceab8 (134 S-N3: gSourcesJoined, sourcesJoinedSum, prameny zdroje se mezi sebou nespojují) · a2567f81 strings.ts mergeWizard.otherPhoto · app:fcddfcab (K10.1) src/merge/write.ts (plán compare se nezapíše), src/merge/plan-export.ts exportPlan (počty slovy cntTotal), src/merge/ui.ts savePlan (.txt a .json), src/merge/wizard-ui.ts primary (compare: savePlan, finishCompare) · app:ad0ea45a step5-plan.ts merge-s5-remember -->

<a id="A8.11"></a>
## A8.11 Krok 6: Co se stalo a Historie sloučení

Po zápisu krok 6 řekne, co se stalo, a sloučení zůstane ve stromu jako záznam, ke kterému jde později se vrátit.

- **Co se stalo:** „Zapsáno do stromu …“ a „Součty sedí: N osob importu = spojené + nové + nepřidané“; záloha
  **Před sloučením** je v Zálohách.
- **Akce:** **Ukázat ve stromu**, **Uložit jako seznam osob** ([A11](A11-lists-of-people.md)), **Zkontrolovat strom**
  ([A5](A5-tree-check.md)) a **Odvolat sloučení…** ([A8.12](#A8.12)).
- Po sloučení souboru jiného programu do stávajícího stromu se karta **Co teď** neukáže; kontrola dat je tady.
  Nový strom ze souboru jiného programu kartu dostane ([S6.4](S6-tree-from-another-program.md#S6.4)).
- Krok 6 a Historie sloučení uvádějí i **Doplněné údaje** a počet spojených pramenů, se stejnými čísly jako krok 5.
- **Historie sloučení:** každé sloučení do stromu s datem, zdrojem, počty (nové, spojené, údaje) a stavem **platí**,
  **zčásti odvolané** nebo **odvolané**. U sloučení **Otevřít výčet** a **Odvolat…**; v okně i **Zálohy…**
  a **Historie změn…**. Celý strom vrátí Zálohy; tady jde odvolat jen to, co přineslo jedno sloučení.
- **Hranice:** záznam sloučení nese strom od datové verze 26; starší verze aplikace takový strom otevřou jen ke čtení.
  Sloučení z doby před aplikací 3.32.0 v historii nejsou.
- **Ovládání:** akce stromu → **Historie sloučení…** (jen u stromu, který sloučení má); Správa stromů, ⋯ u stromu
  → **Historie sloučení…**.
- **Platí od:** aplikace 3.32.0

<!-- zdroj: app:debf50cc src/merge/steps/step6-done.ts (notes inHistory, noNextCard), src/merge/ui.ts step6Env (noNextCard = !newTree && gedcom) · src/ui/tree-actions.ts:199 menuHistory (jen se záznamy) · src/ui/merge-history-ui.ts · strings.ts mergeWizard.doneTitle, doneTotals, doneBackup, showInTree, saveAsList, checkTree, undoMerge, inHistory, noNextCard, menuHistory, histTitle, histLead, stValid, stPartial, stUndone, histCounts, openList, undoEllipsis, histBackups, histChanges · CHANGELOG.cs.md 3.32.0 (datová verze 26) · spec 134 §9 · app:235afcd5, 834ceab8 (doplněné údaje a spojené prameny v kroku 6 a historii) -->

<a id="A8.12"></a>
## A8.12 Odvolání sloučení

**Odvolat sloučení** vezme zpět jen to, co přineslo jedno sloučení. Práce udělaná po sloučení nezmizí.

- **Co se odvolá:** **Odeberou se** nové osoby sloučení s jeho páry, prameny, místy a soubory; **Vrátí se** změněné
  údaje na hodnotu před sloučením; **Vrátí se ve stromu** páry, osoby, prameny a soubory stromu, na které sloučení
  navázalo, jak byly před ním; **Spojení se zruší**: osoby stromu zůstanou, jen bez údajů z importu.
- **Zůstane, protože se od té doby změnilo:** osoba nebo údaj upravený po sloučení, údaj potvrzený, osoba s novým
  příbuzným, věc, na které staví pozdější sloučení, a věc, kterou cituje něco, co zůstává. U každé položky jde zvolit
  **Ponechat** nebo **Odvolat**.
- Obrázek, který sloučení nahradilo, vrátí jen záloha **Před sloučením**. Průvodce ukáže i rozdíl proti obnovení
  zálohy: záloha by vrátila i všechno ostatní, co se od sloučení ve stromu stalo.
- **Odvolat vše**, nebo **Vybrat jen některé…** (odvolá se jen zaškrtnuté). Zčásti odvolané sloučení jde odvolat
  dál. Odvolání si vezme zálohu **Před odvoláním sloučení**, vždy, i s vypnutými automatickými zálohami; rotace ji
  nesmaže, dokud jde sloučení vrátit. Odvolání je v historii změn a jde ho vrátit (**Vrátit odvolání**).
- **Hranice:** zamčený strom jde odvolat po odemknutí ve Správě stromů; strom jen ke čtení, až půjde upravovat.
  Když na sloučení staví pozdější sloučení, průvodce to řekne. Odvolání sloučení, které už je ve výzkumu, popisuje
  [A8.13](#A8.13).
- **Ovládání:** krok 6 → **Odvolat sloučení…**; **Historie sloučení…** → **Odvolat…**; tlačítko „Odebrat N osob“.
- **Platí od:** aplikace 3.32.0

<!-- zdroj: app:debf50cc src/merge/undo-plan.ts, src/merge/undo-view.ts, src/ui/merge-history-ui.ts (zápis se zálohou write.ts writeUndo, AuditLogManager, toast s redo) · strings.ts mergeWizard.undoTitle, undoLead, uRemove, uRestore, uUnjoin, uRemoveDesc, uRestoreDesc, uUnjoinDesc, uKeepHead, uEdited, uProven, uRelative, uLaterMerge, uUsed, uPicture, segKeep, segUndo, vsBackup, pickSome, pickAll, pickLead, btnUndo, builtOn, partlyDone, lockedUndo, undoReadOnly, undoNothing, undone, redo · spec 134 §10 · app:235afcd5 strings.ts mergeWizard.uTree, uTreeDesc · e2a6d712 strings.ts backups pre-merge-undo „Před odvoláním sloučení“ (134 N5, keepFor) -->

<a id="A8.13"></a>
## A8.13 Sloučení do stromu s výzkumem

Do stromu napojeného na výzkum se sloučení zapíše v aplikaci a do výzkumu nejde nic samo. O odeslání rozhodne člověk
v kroku 6.

- Napojení stromu na výzkum zůstane. Nové osoby a vazby čekají v aplikaci („neodesláno do výzkumu · N osob“), dokud se
  nevybere **Poslat do výzkumu…** nebo **Zatím nechat jen v aplikaci**.
- Do výzkumu jdou údaje jako „Z rodokmenu (neověřeno)“, nikdy doložené. Osoby výzkumu si nechají čísla, stav údajů
  i citace. Výzkum dostane změny přes most; agent se nespouští. Když agent právě pracuje, odeslání počká na konec
  jeho kroku.
- Výzkum starší verze posílání po sloučení nezná: pošle se celý strom přes **Co se pošle**
  ([S1](S1-connecting-app-and-research.md)).
- **Co se pošle:** úvodní věta má stejná čísla jako seznam pod ní: „Do výzkumu Horákovi: 5 nových osob, 2 další
  změněné osoby, 3 páry, 4 prameny.“ Spojovací „?“ není nová osoba; nový pár se počítá u svých partnerů a **Páry**
  jsou jen vlastní změny páru. Bez přesného seznamu zůstane věta s tím, co sloučení přineslo.
- **Odvolání před odesláním:** výzkum nedostane nic. **Po odeslání:** výzkum osoby sám nesmaže. Odvolání v aplikaci
  odebere i osoby, kterým odeslání dalo číslo výzkumu (číslo není úprava). Dialog řekne „Sloučení bylo {datum}
  odesláno do výzkumu, takže výzkum jeho osoby už má. Odvolání v aplikaci je odtamtud neodebere.“ a „V aplikaci se
  odvolání provede hned. Ve výzkumu je potřeba jeden krok v terminálu výzkumu:“ s příkazem `strom sync undo I0042`
  a **Kopírovat**; se známým číslem vstupu i **Vzít zpět ve výzkumu**, jinak `I…` a kde číslo najít (`strom input
  list`). Hlášení „Sloučení odvoláno…“ nabídne **Vzít zpět ve výzkumu**. Jinak dialog odkáže na nápovědu **Osoba odebraná v aplikaci**
  ([S2.6](S2-edits-from-the-app.md#S2.6)). Do té doby výzkum při příští verzi osoby vrátí a aplikace je nabídne
  k odebrání.
- **Hranice:**
  - **Nový strom** z importu na výzkum napojený nebude; zápis do nového stromu (kopie cíle s importem) je kopie bez
    výzkumu ([S1.10](S1-connecting-app-and-research.md#S1.10));
  - kopie stromu z výzkumu a strom bez výzkumu po sloučení nic neposílají;
  - když je na výzkum napojený zdroj a cíl ne, napojení se do cíle nepřenese; průvodce nabídne **Prohodit**;
  - když jsou napojené oba stromy, vazba ani čísla zdroje se nepřenesou a osoby zdroje jsou ve výzkumu cíle nové;
  - když jsou stejní lidé i v jiném stromu napojeném na výzkum, průvodce na to upozorní.
- **Platí od:** aplikace 3.32.0

<!-- zdroj: app:debf50cc src/merge/ui.ts step6Research (mergeHold, unsentMerges), src/merge/research-hold.ts, research-marks.ts, same-people.ts · strings.ts mergeWizard.researchKept, resStep5, resPending, sendRes, keepLocal, notSent, resSendLead, resSendNote, resSent, resUndoStep, resUndoHelp, resUndoHelpLink, resComesBack, copy, resAgent, resOld, resNewTree, resSwap, resSwapBtn, resTwo, resSamePeople, modeNewDesc · src/help/topics.ts:38 HELP_LINKS.mergeUndoResearch = 'S2.6' · undoResearchStep (jen záznam I\d+) · research:src/commands/sync.ts:627 sync undo · spec 134 K9.1–K9.6 · app:7a317a1e resSendLeadList (134 V-N5) · 20fb4782 (134 V-N3: číslo výzkumu není úprava, resSent, resUndoStep) · fd794063, 023879dd src/ui/research-undo-step.ts (Kopírovat, undoStepInput, undoStepRun, hlášení odvolání) · f3c66503 (zápis do nového stromu = kopie bez výzkumu) -->
