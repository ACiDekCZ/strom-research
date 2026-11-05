<a id="R4"></a>
# R4 Místa

Jak výzkum ztotožňuje místa z údajů, kdy místo dostane polohu na mapě a co o místě rozhoduje člověk. Popisuje
výzkum 1.25.2 a aplikaci Strom 3.21.2. Změny z novější verze mají u sebe její číslo.

<a id="R4.1"></a>
## R4.1 Místo dostane polohu, jen když je jisté

Výzkum určuje, která obec daného jména to je, z kontextu záznamů: fara, okres, roky. Špatné místo je horší než žádné.
Proto má ztotožnění tři stupně a souřadnice dostane jen jisté místo.

- **Jisté:** fara, okres a roky záznamů souhlasí s jedinou obcí. Místo dostane souřadnice, názvy a příslušnost.
- **Pravděpodobné:** výzkum navrhne 1 až 3 kandidáty a rozhodne člověk v Čeká na vyřízení (viz [R4.5](#R4.5)).
- **Nelze určit:** místo zůstane mimo mapu. Výzkum zapíše, proč to nejde a co by rozhodlo.
- **Hranice:** nejvýš 3 kandidáti. Důvod a „co by rozhodlo“ mají každý nejvýš 300 znaků. Výzkum hledá od levného
  k dražšímu: nejdřív strom a jeho prameny, potom pravidla zápisu, web až nakonec. K vyhledávání jdou jen názvy míst,
  far a okresů, nikdy jména osob ani data jejich života.
- **Ovládání:** aplikace: stav místa **Zatím není na mapě**, **Ve frontě výzkumu**, **Hledá se…**, **K potvrzení**,
  **Neurčeno**, **Ověřit**; původ polohy **Určil výzkum**; v detailu **Proč tady**, **Co by rozhodlo**, **Zdroj** ·
  terminál: `strom place identify`, `strom place propose`, `strom place unlocated` (příkazy agenta)
- **Platí od:** výzkum 1.25.0, aplikace 3.21.0

<!-- zdroj: research:src/commands/placeid.ts:80 identify, :124 unlocated (why/needs ≤300), :144 propose (candidate 1–3) · research:src/brief/places.ts (tři stupně, web až nakonec) · research:assets/lang/cs.json ui.link.places.private · app:src/strings.ts cs places (v3.21.2 :9897) -->

<a id="R4.1.1"></a>
### R4.1.1 Stejné jméno, jiné místo

Obcí stejného jména bývá víc. Rozliší je fara a okres ze záznamů, ne jméno samo. Smyšlený příklad: rodina Horákových
žila „v Lhotě“; z matriky je známa fara, a ta ukáže, která Lhota to je.

- **Hranice:** záznam jiného místa blíž než 1,5 km výzkum nesmí přehlédnout. Buď jde o jedno místo a záznamy spojí,
  nebo výslovně řekne, že jde o jiné místo (část obce, soused). Spojit jde jen záznamy do 1,5 km a poloha zadaná
  člověkem má přednost. Záznamy dál od sebe výzkum nespojí a zeptá se člověka. Jméno, které nesou dva záznamy,
  se musí zadat identifikátorem místa (L0012).
- **Ovládání:** terminál: `strom place identify --separate <L…>`, `strom place merge <L…> --into <L…>`
- **Platí od:** výzkum 1.25.2

<!-- zdroj: research:src/core/placeid.ts NEAR_KM=1.5 (:575), mergePlaces, errors place.near / place.far · research:src/commands/placeid.ts:80 --separate, :203 merge · CHANGELOG.cs.md 1.25.2 -->

<a id="R4.1.2"></a>
### R4.1.2 Nedohledané místo se vrátí samo

Místo, které nešlo určit, výzkum zařadí znovu, když o něm strom ví víc: přibude údaj s citací, příslušnost nebo
nadřazené místo. Člověk o to žádat nemusí.

- **Hranice:** takové místo neběží přednostně, protože ho nezařadil člověk (viz [R4.4](#R4.4)).
- **Platí od:** výzkum 1.25.0

<!-- zdroj: research:src/core/placeid.ts contextOf, requeue of unlocated (K2.3) · placesFirst counts only entries queued by the person · CHANGELOG.cs.md 1.25.0 -->

<a id="R4.2"></a>
## R4.2 Názvy a příslušnost místa

První název místa je dnešní úřední název v jazyce země, kde místo dnes leží. Staré názvy, názvy v jiných jazycích
a jiné zápisy z pramenů jsou u místa vedle něj, s jazykem a roky. Příslušnost říká, kam místo patřilo: fara, obec,
okres a další, vždy s roky od–do.

- **Hranice:** jiný název má jazyk a roky; jeden rok znamená, že název je v tom roce doložen. Druhy příslušnosti:
  fara, civilní správa, diecéze, panství, okres, kraj, stát, jiné. Odebrat jde jen název, který není první a který
  už žádný údaj nepíše. Chybnou příslušnost výzkum odebere jen s důvodem.
- **Ovládání:** aplikace: v detailu místa **Dnes**, **Dřív**, **Jiné jméno**, **Jiný zápis**; štítky **hlavní tvar**,
  **jiný zápis**, **starý název**, **jiné jméno** · terminál: `strom place identify|verify --name --alt
  <název@jazyk:od-do> --form --jurisdiction <druh:název:od-do>`, `strom place names <L…> --drop <název> --why`
- **Platí od:** výzkum 1.25.0; dnešní název jako první a `strom place names` od výzkumu 1.25.2

<!-- zdroj: research:src/core/placeid.ts todayName, parseJurisdiction, dropPlaceNames · research:src/core/places.ts JURISDICTIONS = parish, civil, diocese, manor, district, county, state, other · research:src/commands/placeid.ts:167 verify, :258 names · research:src/brief/places.ts (today's name rule) · app:src/strings.ts cs places tags/detail -->

<a id="R4.2.1"></a>
### R4.2.1 Jak údaje zapisují místo

V údaji je místem obec. Ulice a číslo domu patří do zvláštního pole domu. Když údaje zapisují místo jinak, výzkum
změnu jen navrhne a člověk ji potvrdí otázkou **Návrh zápisu**.

- **Hranice:** už zapsaný dům se nepřepisuje. Přepis pramene se nemění v žádném případě.
- **Ovládání:** aplikace: Čeká na vyřízení, **Návrh zápisu**, **Ano** / **Ne** · terminál: **Zapsat údaje takto** /
  **Nechat údaje, jak jsou**; `strom place rewrite --propose`, `--house`
- **Platí od:** výzkum 1.25.0

<!-- zdroj: research:src/commands/placeid.ts:225 rewrite · app:src/strings.ts formExplain · research:src/cli/menu-waiting.ts:523–560 (v1.25.2) -->

<a id="R4.3"></a>
## R4.3 Polohu zadanou člověkem výzkum nemění

Poloha, kterou člověk umístil ručně, patří člověku. Výzkum ji nepřesune, nesmaže ani neoznačí jako nedohledanou.
Když záznamy říkají něco jiného, zeptá se v Čeká na vyřízení otázkou **Rozpor polohy**.

- **Hranice:** ruční poloha je každá poloha bez záznamu o tom, kdo ji určil, a každá poloha z aplikace. Výzkum u ní
  smí jen potvrdit, že záznamy souhlasí, nebo zapsat, že to nejde rozhodnout. Přitom zapíše názvy a příslušnost,
  souřadnice nechá. Odpověď **Ponechat** platí, dokud se poloha nezmění; na stejný rozpor se výzkum znovu neptá.
  Hromadné vyřízení ruční polohy nepřijme za člověka (viz [R4.5](#R4.5)).
- **Ovládání:** aplikace: původ **Umístěno ručně**, **Umístit ručně v mapě**; text „Ruční polohu výzkum nemění,
  jen se zeptá v Čeká, když najde rozpor.“ · terminál: původ „zadáno ručně“; `strom place verify --ok|--undecided`,
  `strom place propose --conflict` (příkazy agenta)
- **Platí od:** výzkum 1.25.0, aplikace 3.21.0

<!-- zdroj: research:src/core/placeid.ts personsHand (:714), proposePlace kept → place.kept · research:src/commands/sources.ts place edit ~:976 (agent refused on personsHand) · research:src/core/sync.ts:3401 byPerson · research:assets/lang/cs.json ui.wait.place.by.person · app:src/strings.ts whoHand, pvHand -->

<a id="R4.4"></a>
## R4.4 Fronta míst

Místa ke ztotožnění zařazuje člověk. Zařazení samo nic nezapíše a agent při něm nepracuje. Výzkum frontu zpracuje v sezeních po oblastech, kde
oblast je archiv většiny pramenů místa.

- **Hranice:** nejvýš 15 míst na sezení, malé oblasti jdou spolu. Napřed jdou místa, u kterých aplikace hlásí **Ověřit**,
  potom podle času zařazení. Jedno zařazení má nejvýš 5000 míst. Místo už na mapě se zařazuje jen k prověření.
  Místo, na kterém právě běží sezení, nejde zařadit ani vyřadit. Odhad trvání se ukáže hned, odhad ceny až po 3 změřených
  sezeních. Úkol míst zařazených člověkem je krátká práce, která jde napřed (klíč 5 v
  [R2.2](R2-lines-and-queue.md#R2.2)). Úkol nepatří k žádné linii, proto nikdy není práce mimo linie.
- **Ovládání:** aplikace: **Dohledat ve výzkumu**, **Prověřit ve výzkumu**, **Zrušit zařazení**, **Spustit teď**,
  **Dohledat všechna mimo mapu (n)**, **Prověřit všechna přiřazení (n)** · terminál: úkol „Ztotožnit místa údajů
  ve frontě (n)“; `strom place queue [--all] [--check]`, `strom place unqueue [--all]`
- **Platí od:** výzkum 1.25.0, aplikace 3.21.0; sezení po oblastech od výzkumu 1.25.2

<!-- zdroj: research:src/core/placeid.ts BATCH_MAX=15 (:31), REQUEST_MAX=5000, BATCH_MINUTES, MEASURED_MIN=3, PLACE_FLAGS, queueOrder (:225), raisePlacesTask (priority 5, level enrich), placesFirst · research:src/core/queue.ts rankTasks first (v1.25.2 :142–280) · research:src/commands/placeid.ts:283 queue, :320 unqueue · app:src/place-check.ts PLACE_FAR_KM=60 -->

<a id="R4.4.1"></a>
### R4.4.1 Kdy aplikace hlásí Ověřit

Aplikace sama, bez výzkumu, označí polohu, která do stromu nesedí. Nic na ní nemění.

- **Hranice:** místo leží dál než 60 km od všech ostatních míst rodiny v rozmezí ±20 let; záznam výzkumu jmenuje jinou
  faru nebo okres; nalezený popis je ulice nebo část obce; hledání našlo víc obcí toho jména. Poloha s odpovědí
  **Ponechat** a poloha potvrzená výzkumem se nehlásí, dokud se nepohnou.
- **Platí od:** aplikace 3.21.0; hranice 60 km od aplikace 3.21.1

<!-- zdroj: app:src/place-check.ts:1–31 PLACE_FAR_KM=60, PLACE_YEARS=20 · app CHANGELOG.cs.md 3.21.1 -->

<a id="R4.5"></a>
## R4.5 Otázky k místům v Čeká na vyřízení

Na otázky k místům odpovídá jen člověk, v aplikaci nebo v terminálu. Agent na ně neodpovídá. Otázky jsou tří druhů:
**Kde je** (kandidáti), **Rozpor polohy** (poloha na mapě proti záznamům) a **Návrh zápisu** (jak údaje zapisují místo).

| Odpověď (aplikace) | Terminál | Co se stane |
|---|---|---|
| **Je to A** (B, C) | jméno kandidáta | Místo dostane polohu kandidáta jako ruční polohu. |
| **Žádný z nich** | **Žádné z nich** | Místo zůstane mimo mapu. |
| **Nevím** | **Nelze říct** | Místo zůstane mimo mapu. |
| **Ponechat** | **Ponechat polohu na mapě** | Poloha zůstane a na stejný rozpor se výzkum znovu neptá. |
| **Ano** / **Ne** | **Zapsat údaje takto** / **Nechat údaje, jak jsou** | Údaje se přepíšou, nebo zůstanou. |

- **Hranice:** **Žádný z nich** a **Nevím** výzkum přijme jen u otázky **Kde je**. Odpověď se nezapíše, když se
  otázka mezitím změnila; aplikace pak Čeká obnoví. **Přijmout všechny navržené (n)** vezme u otázky **Kde je**
  kandidáta A, u rozporu polohy polohu ponechá. **Ponechat všechny (n)** ponechá polohu u rozporů. Hromadné
  vyřízení vynechá ruční polohy. Jeden krok **Zpět** vrátí celé hromadné vyřízení. Pořadí otázek mezi ostatními
  věcmi v Čeká popisuje [R6](R6-awaiting-action.md).
- **Ovládání:** aplikace: okno **Čeká na vyřízení · Místa**, skupina **Místa**, **Odpovědět**, **Po oblastech:** ·
  terminál: **Co čeká → Místa ke ztotožnění**; `strom place answer <L…> --take c1|c2|c3|keep|unknown|none|yes|no|first`
  s `--dry` a `--expect`
- **Platí od:** výzkum 1.25.0, aplikace 3.21.0
- **Od výzkumu 1.26.0:** malá mapa u otázky ukazuje jen body otázky a vzdálenost od návrhu (aplikace 3.22.0).
- **Od výzkumu 1.26.0:**
  - terminál říká slovy aplikace **Nevím** a **Žádný z nich**;
  - **Nevím** jde i u **Rozporu polohy** (poloha zůstane, otázka zmizí, výzkum se může zeptat znovu) a u **Návrhu
    zápisu** (údaje zůstanou, jak jsou). Aplikace 3.22.0 ho tam nabídne jen s výzkumem 1.26.0. **Žádný z nich**
    zůstává jen u otázky **Kde je**;
  - **Přijmout všechny navržené (n)** (`--take first`) vezme kandidáta A i u rozporu polohy. Ručně zadanou polohu
    nepřepíše nikdy: takový rozpor vynechá.

<!-- zdroj: research:src/commands/placeid.ts:345 answer (person only) · research:src/core/placeid.ts PLACE_TAKES, answerOne ~:1195 · research:src/core/waiting.ts:395–420 (v1.25.2) wait.group.places · research:src/cli/menu-waiting.ts:523–560 · app:src/waiting-places.ts placeQuestionChoices :40, bulkAcceptable :140, bulkKeepable, placeAreas · app:src/strings.ts waiting.* · app CHANGELOG.cs.md 3.22.0 · 1.26.0: research:src/core/placeid.ts answerOne (first: locating.by person vynechá; unknown u conflict a form), cs.json ui.wait.place.unknown/none (commit fe59fb40) · app:src/waiting-places.ts PLACES_UNKNOWN_ALL_SINCE, ui/waiting-places-ui.ts:645 take first -->

<a id="R4.5.1"></a>
### R4.5.1 Vrácení kroku

Každý krok u míst jde vrátit: odpověď, odebraný název, úklid fronty i jednorázovou opravu záznamů míst. Vrácení je
věc člověka.

- **Hranice:** posledních 20 kroků, každý zvlášť podle svého identifikátoru. Krok nejde vrátit, když se místo od té
  doby změnilo.
- **Ovládání:** aplikace: **Zpět** · terminál: `strom place undo <krok>`
- **Platí od:** výzkum 1.25.2 (ve výzkumu 1.25.0 jen poslední krok)

<!-- zdroj: research:src/core/placeid.ts UNDO_KEPT=20 (:102), undoPlaces · research:src/commands/placeid.ts:399 undo (person only) · CHANGELOG.cs.md 1.25.0 / 1.25.2 -->

<a id="R4.6"></a>
## R4.6 Místa z jiných výzkumů na tomto počítači

Výzkum nepřebírá souřadnice ani údaje z jiných stromů. Převezme jen přiřazení místa k regionu dějin a záznamy
jiných výzkumů ukáže agentovi jako návrh.

- **Hranice:** výzkum 1.24.0 převezme přiřazení k regionu dějin, jen když ho mají všechny výzkumy stejně. Stejné místo
  je to, které leží do 2 km, má stejnou faru, nebo stejný okres či kraj; dál než 5 km je to jiné místo. Z rodiny se
  nic nepřesouvá. Výzkum 1.25.0 ukáže při ztotožnění faru, okres a souřadnice místa z jiného výzkumu. Agent je
  použije jen tam, kde souhlasí fara nebo okres.
- **Ovládání:** terminál: `strom history adopt --dry-run` (jen se zapnutými dějinami)
- **Platí od:** výzkum 1.24.0 (regiony), výzkum 1.25.0 (návrh při ztotožnění)

<!-- zdroj: research:src/core/placeadopt.ts SAME_KM=2, OTHER_KM=5 · research:src/brief/places.ts othersRecords · research:src/core/placeid.ts PLACE_BY (adopted never written) · CHANGELOG.cs.md 1.24.0 (l.114), 1.25.0 (l.77) -->

<a id="R4.7"></a>
## R4.7 Dějiny míst

Dějiny míst jsou doložené události v místech, kde rodina žila. Hledají se jen tehdy, když je člověk zapne.
Výzkum k tomu přiřadí místa k regionům dějin.

- **Hranice:** úkol dějin přijde na řadu jen občas: zhruba každé 5. sezení (výchozí), řídce zhruba každé 10., nebo jen
  když jiná práce nezbývá (klíč 3 v [R2.2](R2-lines-and-queue.md#R2.2)).
  Přiřazení míst k regionům a místo, o které člověk požádal, jdou před
  výzkumem. Dějiny místa zahrnují místo a okolí zhruba do 10 km. Úkol dějin agent bere jen při `strom run` nebo
  `strom task next --history`, v rozhovoru sám ne. Místo, které nejde přiřadit, se označí jako nedohledané.
- **Ovládání:** aplikace: **Dějiny míst**, **Najít dějiny místa a okolí…**, **Přiřadit region**, stavy **Dějiny místa:
  čeká**, **Dějiny místa: hledá se**, **Výzkum místo nedohledal** · terminál: **Nastavení → Samostatná práce agenta →
  Dějiny**; `strom config set experiments.history on`, `strom history place <L…>`, `strom history map --unlocated`
- **Platí od:** výzkum 1.22.0

<!-- zdroj: research:src/core/pastevents.ts PACE_EVERY (:2621), experiments.historyPace · research:src/core/placehistory.ts · research:src/commands/history.ts place, map --unlocated, adopt · research:assets/lang/cs.json ui.alone.title, ui.alone.history · app:src/strings.ts history.* (v3.21.2 :13121–13235) · CHANGELOG.cs.md 1.22.0 (l.229) -->
