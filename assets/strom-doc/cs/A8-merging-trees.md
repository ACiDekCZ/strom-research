<a id="A8"></a>
# A8 Sloučení stromů

Jak aplikace Strom slučuje dva rodokmeny: soubor GEDCOM se stromem, dva stromy, nebo pohled se stromem. Popisuje
aplikaci 3.21.2; změny z novější verze mají u sebe její číslo. Sloučení duplicitní osoby uvnitř jednoho stromu je jiná věc ([A5.6](A5-tree-check.md#A5.6)).

<a id="A8.1"></a>
## A8.1 Sloučení vždy založí nový strom

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

<!-- zdroj: app:src/merge/executor.ts:211 executeMerge (mergeSourceCatalogs, places, mergePlaceRecords, mergePlaceAliases, addSurnameGroup, delete defaultPersonId/defaultView) · src/merge/ui.ts countNewMergeIssues · strings.ts merge.preValidationWarning, merge.newIssues · git v1.19.0 (00e5d38) · 3.27.0: app:dde0151a src/merge/executor.ts sourceKey bez quality, takeCitationQuality, remapCitations; app:5721b016 unionCitations -->
