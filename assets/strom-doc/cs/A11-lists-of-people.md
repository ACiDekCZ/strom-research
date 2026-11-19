<a id="A11"></a>
# A11 Seznamy osob

Seznam osob drží vybrané osoby stromu pod jedním jménem, aby se s nimi dalo pracovat opakovaně: v Tabulce jako její
rozsah ([A6.7.19](A6-views.md#A6.7.19)), v exportu a jako pracovní seznam s odškrtáváním. Seznam vznikne podle
pravidla (rod, předci, potomci, linie výzkumu, filtr Tabulky, kdy osoby přibyly), z výsledků hledání nebo ručně.
Kapitola popisuje aplikaci Strom 3.30.0.

<!-- zdroj: dirigent:spec/084-seznamy-osob (K1.1–K8.4, rozhodnutí 14. a 16. 11.) · app:714a8ab2..60265541 (dirigent:prace/1116-app-084-seznamy) · app:docs/ZADANI_DEV_seznamy-osob.md §1–§13, §15, §16 · app:src/person-lists.ts, src/person-lists-data.ts · app:CHANGELOG.cs.md 3.30.0 „Pojmenované seznamy osob“ -->

<a id="A11.1"></a>
## A11.1 Pevný, automatický a pracovní seznam

Seznam je **pevný**, nebo **automatický**. Pevný seznam drží své osoby a mění se jen ručně. Automatický seznam je
uložené pravidlo: jeho osoby se počítají vždy znovu.

| Druh | Co drží | Ručně přidat a odebrat | Ruční pořadí |
|---|---|---|---|
| **pevný** | osoby v ručním pořadí; pravidlo, ze kterého vznikl (**Vznikl z**), když nějaké má | ano | ano |
| **automatický** | jen pravidlo (**Podle**) | ne: „Obsah určuje pravidlo – ručně se nepřidává ani neodebírá.“ | ne |
| **pracovní** | pevný seznam se zapnutým **Odškrtávat hotové** ([A11.8](#A11.8)) | ano | ano |

- Druh je vidět u seznamu v přehledu (ikona a slovo **pevný**, **automatický**, **pracovní**), v detailu (štítek
  **Pevný seznam**, **Automatický seznam**, **Pracovní seznam**) a v **Rozsah** Tabulky (ikona).
- Seznam má jméno. Jméno je ve stromu jedinečné; porovnává se bez diakritiky, velikosti písmen a nadbytečných mezer.
  Obsazené jméno se neuloží: „Seznam s tímto jménem už je. Navrženo: „{jméno} (2)“.“ (další volné číslo).
- Zástupné osoby v seznamu nejsou nikdy.
- **Hranice:** seznamy se mění jen ve stromu, který jde měnit. Ve stromu jen ke čtení (exportovaná stránka HTML,
  sledovaný strom, strom uložený novější verzí aplikace, zamčený strom) jdou seznamy prohlížet a otevřít v Tabulce,
  úpravy chybí; správa má štítek **Jen ke čtení**. Zamčená osoba do seznamu přidat jde.
- **Ovládání:** **Akce → Seznamy osob…** ([A11.3](#A11.3)).
- **Platí od:** aplikace 3.30.0

<!-- zdroj: app:src/person-lists.ts listKind (dynamic → auto, checklist → work), listPersonIds (bez zástupných osob) · src/person-lists-data.ts foldListName, isListNameTaken, suggestListName · src/data.ts:2130 listsReadOnly (isReadOnly || isTreeLocked; isTreeLocked: sledovaný strom liveTreeId, isNewerData, isLocked) · src/ui/person-list-add.ts personListMenuRows (zamčená osoba ano, app:60265541) · strings.ts lists.kind.*, badge.*, rule.key, rule.origin, autoInfo, save.dup, readOnly · ZADANI_DEV §1, §16c, Q1 -->

<a id="A11.2"></a>
## A11.2 Pravidlo seznamu

Pravidlo říká, které osoby do seznamu patří. Pevný seznam ho použije jednou při vzniku, automatický pokaždé.

| Pravidlo | Koho najde | Jméno nového seznamu | Výchozí řazení |
|---|---|---|---|
| **Prázdný** | nikoho, osoby se přidají ručně | – | **Ručně** |
| **Rod** | pokrevní členy rodu ([A4](A4-surnames-and-families.md)) | **Rod** jméno rodu | **Od nejstaršího** |
| **Předci osoby** | předky vybrané osoby, **všechny generace** nebo **do N generací** | „Předci – {osoba}“ | **Po generacích** |
| **Potomci osoby** | potomky vybrané osoby, všechny generace nebo do N generací | „Potomci – {osoba}“ | **Po generacích** |
| **Linie výzkumu** | osoby linie výzkumu, stejně jako čip linie v Tabulce ([A6.7.14](A6-views.md#A6.7.14)) | název linie | **Od nejstaršího** |
| **Přidáno za období** | osoby přidané do stromu za posledních 7, 30, 90 nebo jiný počet dní ([A11.7](#A11.7)) | „Přidáno za posledních {n} dní“ | **Podle přidání** |
| filtr Tabulky | řádky Tabulky po filtru a řazení ([A11.6](#A11.6)) | název pohledu | **Ručně** (pořadí Tabulky) |

- **Partneři:** rod, předci a potomci berou jen pokrevní osoby. Partner, který do rodiny přišel sňatkem, v seznamu
  není, dokud se nepřidá ručně.
- Generace jdou vybrat od 1 do 10, nebo **všechny generace**. Počet dní je 1 až 3650. Den, kdy seznam počítá, je
  první den období („za posledních 30 dní“ = dnes a 29 dní před tím).
- Jméno se mění s volbou pravidla, dokud se pole **Jméno** nepřepíše.
- Každá volba ukazuje počet osob, které by seznam dostal. Linie výzkumu je jen ve stromu s liniemi.
- **Udržovat aktuální** (výchozí vypnuto) udělá automatický seznam; jinak vznikne pevný: „Pevný seznam: osoby se
  vyberou teď a dál se mění jen ručně. Pravidlo si pamatuje pro „Doplnit podle pravidla“.“
- **Ovládání:** **Seznamy osob → Nový seznam…** → **Podle**, **Udržovat aktuální**, **Vytvořit**; u seznamu
  **Upravit pravidlo…**. Pak se otevře správa s novým seznamem a oznámení „Seznam „{jméno}“ uložen.“
- **Platí od:** aplikace 3.30.0

<!-- zdroj: app:src/person-lists.ts rulePersonIds (rods/ancestors/descendants přes selection().memberIds – jen pokrevní, Q2; line přes personLineRole jako čip linie; tableFilter filterRows + sortRows; added: startOfDay − (days − 1) dní), ruleLabel · src/ui/person-list-new-ui.ts PERIODS 7/30/90, MAX_GENERATIONS 10, MAX_DAYS 3650, jméno podle pravidla do přepsání, počet u volby · ZADANI_DEV §3 (výchozí řazení podle pravidla), Q2 · app:e09dcacb · strings.ts lists.new.*, keep, keepOn, keepOff, create, toast.saved, rule.* -->

<a id="A11.2.1"></a>
### A11.2.1 Doplnit podle pravidla

Pevný seznam, který vznikl z pravidla, ho může použít znovu: **Doplnit podle pravidla** přidá osoby, které pravidlo
dnes najde a v seznamu nejsou.

- Osoba ze seznamu ručně odebraná se doplněním nevrátí. Vrátí se jen ručním přidáním.
- Nové osoby přijdou na konec ručního pořadí, seřazené podle řazení seznamu (u ručního řazení **Od nejstaršího**).
- Oznámení: „Přidáno N osob podle pravidla.“ s **Zpět**; když nic nepřibude, „Seznam je úplný.“
- Pevný seznam bez pravidla (vznikl prázdný nebo z výsledků hledání) tuto volbu nemá.
- **Ovládání:** detail seznamu, řádek **Vznikl z** → **Doplnit podle pravidla**.
- **Platí od:** aplikace 3.30.0

<!-- zdroj: app:src/person-lists.ts withRuleFilled (bez personIds a removed, na konec, ruční → old), withPersonsRemoved (removed jen s pravidlem), withPersonsAdded (ruční přidání vyjme z removed) · strings.ts lists.fill, toast.filled, toast.full · ZADANI_DEV §3c -->

<a id="A11.2.2"></a>
### A11.2.2 Zmrazit automatický seznam

**Zmrazit** udělá z automatického seznamu pevný se současnými osobami v současném pořadí („Stane se pevným se
současnými osobami“). Pravidlo zůstane jako **Vznikl z**.

- Oznámení „Seznam zmrazen – teď je pevný.“ s **Zpět**.
- Z pevného seznamu automatický udělat nejde.
- **Ovládání:** **⋯** automatického seznamu → **Zmrazit**.
- **Platí od:** aplikace 3.30.0

<!-- zdroj: app:src/person-lists.ts withFrozen (dynamic false, personIds = listPersonIds, rule zůstává) · strings.ts lists.menu.freeze, freezeSub, toast.frozen · app:3dc8e709 -->

<a id="A11.2.3"></a>
### A11.2.3 Pravidlo, které už nic nenajde

Když zmizí to, na čem pravidlo stojí, seznam zůstane, jen prázdný, a řekne proč:

- „Pravidlo už nic nenajde: osoba {jméno} byla smazána.“ (předci nebo potomci smazané osoby; jméno si pravidlo
  pamatuje z doby vzniku);
- „Pravidlo už nic nenajde: rod zanikl.“;
- „Pravidlo už nic nenajde: linie byla odebrána.“
- Pod větou jsou **Upravit pravidlo…** a **Smazat seznam**.
- **Platí od:** aplikace 3.30.0

<!-- zdroj: app:src/person-lists.ts ruleBroken (person podle rule.personName, rod, line) · strings.ts lists.ruleGone, ruleGoneRod, ruleGoneLine, deleteList · ZADANI_DEV §7d -->

<a id="A11.3"></a>
## A11.3 Správa seznamů: Seznamy osob

Všechny seznamy stromu jsou na jednom místě, v dialogu **Seznamy osob**: vlevo přehled, vpravo vybraný seznam.

- **Přehled:** každý seznam s ikonou druhu, jménem, počtem osob a řádkem pod jménem (**pevný · změněno …**,
  **automatický ·** pravidlo, **pracovní · zbývá a z b**). Řazení **Podle jména** nebo **Podle změny**. Od 9 seznamů
  je nad nimi pole **Hledat v seznamech** (bez ohledu na diakritiku).
- **Detail:** jméno (přejmenuje se na místě: klik, ✎ nebo F2; Enter uloží, Esc vrátí), štítek druhu, řádek pravidla
  (**Podle** / **Vznikl z**), souhrn ([A11.3.1](#A11.3.1)) a **Osoby v seznamu · N** s řazením ([A11.4](#A11.4)).
  U pevného seznamu × u osoby (**Odebrat ze seznamu**) a **Přidat osobu…** ([A11.5](#A11.5)). U osoby je podle
  řazení generace, datum přidání, nebo místo narození.
- **⋯ seznamu** (u řádku v přehledu i v detailu): **Otevřít v Tabulce**, **Přejmenovat**, **Duplikovat**,
  **Odškrtávat hotové** (pevný, [A11.8](#A11.8)) nebo **Zmrazit** (automatický, [A11.2.2](#A11.2.2)), **Exportovat ›**
  ([A11.9](#A11.9)), **Smazat**.
  - **Otevřít v Tabulce** zavře dialog a otevře Tabulku v rozsahu seznamu ([A6.7.19](A6-views.md#A6.7.19)).
  - **Duplikovat** udělá kopii stejného druhu se stejným pravidlem, pořadím, ručně odebranými i odškrtnutými, jménem
    „{jméno} (2)“.
  - **Smazat** se neptá: oznámení „Seznam „{jméno}“ smazán.“ s **Zpět**.
- **Hranice:**
  - detail ukáže nejvýš 200 osob: „Ukázáno prvních 200 z N osob.“ s odkazem do Tabulky, kde jsou všechny;
  - každá změna seznamu je jeden krok **Zpět**; vznik (i duplikát), přejmenování, zmrazení a smazání mají zápis
    v historii změn;
  - v dalším okně aplikace ([A6.8](A6-views.md#A6.8)) se změna seznamu uloží přes hlavní okno.
- **Ovládání:** **Akce → Seznamy osob…**; na telefonu **Více → Seznamy osob**; v Tabulce **Rozsah ▾ → Spravovat
  seznamy…**. Klávesy v přehledu: ↑ ↓ výběr, Enter přejmenovat, Delete smazat, Esc zavře dialog. Na telefonu se
  přehled a seznam střídají na celé obrazovce (‹ **Zpět na seznamy**), **⋯** je panel zdola.
- **Platí od:** aplikace 3.30.0

<!-- zdroj: app:src/ui/person-lists-ui.ts (OVERLAY_ID person-lists-modal, SEARCH_FROM 9, LIST_DETAIL_ROWS 200, NARROW_QUERY, přejmenování klik/✎/F2, klávesy ↑↓ Enter Delete) · src/ui/person-list-hooks.ts listMenu (freezeAndChecklistRows, exportRows) · src/data.ts duplicatePersonList (structuredClone, suggestPersonListName), deletePersonList (Vrátit), storePersonList audit (personList.save, :2224 přejmenování, :2254 personList.delete, :2330 zmrazení) · index.html #actions-lists-row · src/ui/bottom-sheet.ts řádek Seznamy osob v listu Více · strings.ts menu.lists, lists.title, search, byName, byChange, changed, left, people, remove, addPerson, openTable, menu.*, large, back, toast.deleted, undo.*, audit.* · app:4acf7a09, 3dc8e709 · ZADANI_DEV §2, §16 (okna 079: WindowEditSink) -->

<a id="A11.3.1"></a>
### A11.3.1 Souhrn seznamu

Detail seznamu shrne jeho osoby v dlaždicích: **osob** · **narození** (nejstarší a nejmladší rok narození, bez roků
„–“) · **s fotkou** · **s dokladem** · **s vyprávěním**; pracovní seznam navíc nejdřív **zbývá**.

- **S dokladem** je osoba s aspoň jednou citací pramene u osoby, jejích údajů, událostí nebo svazků.
- Pod dlaždicemi je odkaz „N bez dokladu ›“: otevře Tabulku v rozsahu seznamu s čipem **Bez pramene**.
- **Platí od:** aplikace 3.30.0

<!-- zdroj: app:src/person-lists.ts listSummary (birthMin/Max, photo, personEvidence sources > 0, story.text, noCite, left jen u pracovního) · src/ui/person-list-hooks.ts openInTable (noSource) · strings.ts lists.sum.* · app:211323e8 (Otevřít v Tabulce s čipem Bez pramene) · spec 084 K8.2 -->

<a id="A11.4"></a>
## A11.4 Řazení seznamu

Seznam má jedno z pěti řazení. Pořadí seznamu použije Tabulka (sloupec **#**) i export.

| Řazení | Pořadí |
|---|---|
| **Od nejstaršího** | podle data narození; bez data na konci |
| **Po generacích** | u seznamu z předků nebo potomků generace od osoby pravidla, jinak generace jako sloupec Tabulky; v generaci od nejstaršího |
| **Abecedně** | příjmení, pak jméno, podle jazyka aplikace |
| **Podle přidání** | od posledně přidaných; osoby bez údaje „přidáno“ na konci |
| **Ručně** | pořadí, které drží pevný seznam |

- **Ručně** má jen pevný seznam. U automatického je volba nedostupná: „Ruční pořadí má jen pevný seznam – Zmrazit“.
- Přepnutí na jiné řazení ruční pořadí nemaže; po návratu na **Ručně** platí, jak bylo. Nově přidaná osoba přijde
  na konec ručního pořadí.
- Každý přesun je jeden krok **Zpět**; čtečka obrazovky ho ohlásí („Přesun: … je na pozici 3 z 12.“).
- **Ovládání:** **Řazení: … ▾** nad osobami seznamu. Ruční pořadí: tažení řádku za úchyt (myš i prst), Esc tažení
  zruší; Alt+↑ / Alt+↓ na řádku; **⋯** osoby → **Posunout výš** / **Posunout níž**. Na telefonu úchyt není, jen **⋯**.
- **Platí od:** aplikace 3.30.0

<!-- zdroj: app:src/person-lists.ts sortListIds (old birthKey, gen ruleGenerations / assignGenerations, name Intl.Collator, added sestupně bez data na konec, manual), withSort (automatický bez manual), withPersonMoved, withManualOrder, withPersonsAdded (na konec) · src/ui/person-lists-ui.ts úchyt, Alt+↑/↓, Esc · strings.ts lists.sortBy, sort.*, manualOff, handle, up, down, moved · app:3dc8e709 · ZADANI_DEV §5 -->

<a id="A11.5"></a>
## A11.5 Přidat do seznamu a odebrat

Osoba jde do pevného seznamu přidat z nabídky osoby, z Tabulky, z výsledků hledání a z detailu seznamu.
Automatický seznam se ručně nemění, nabídky ho proto nenabízejí („Automatické seznamy se plní samy podle
pravidla.“).

- **Nabídka osoby → Přidat do seznamu ›:** pevné seznamy podle poslední změny, nejvýš 8, pak **Další seznamy…**;
  seznam, ve kterém osoba je, má ✓ a klik ji z něj odebere. Pod nimi **Nový seznam s touto osobou…**: dialog
  nového seznamu ([A11.2](#A11.2)), volba **Prázdný** s touto osobou; pro **Předci osoby** a **Potomci osoby** je
  předvybraná tato osoba. Na telefonu druhá stránka panelu osoby.
- **Tabulka:** nabídka řádku → **Přidat do seznamu ›** (osoba řádku; u svazku oba partneři, u události její osoby).
  Výběr přes více řádků: **Přidat N osob do seznamu ›** a **Nový seznam s těmito osobami…**. V rozsahu pevného
  seznamu je v nabídce řádku i **Odebrat ze seznamu** ([A6.7.19](A6-views.md#A6.7.19)).
- **Výsledky hledání → Výsledky do seznamu ›:** přidá všechny výsledky, ne jen ukázané, nebo založí **Nový seznam
  z výsledků (N)…** (pevný, jméno „Hledání: {dotaz}“).
- **Detail seznamu → Přidat osobu…:** výběr osob podle jména, více najednou; osoby už v seznamu jsou šedé
  („už v seznamu“).
- Osoba už v seznamu se nezdvojí („Všechny už v seznamu „{seznam}“ jsou.“). Odebraná osoba přestane být odškrtnutá.
- Odebrání má **Zpět** v oznámení.
- **Hranice:** ve stromu jen ke čtení tyto nabídky nejsou ([A11.1](#A11.1)).
- **Platí od:** aplikace 3.30.0

<!-- zdroj: app:src/ui/person-list-add.ts MENU_LISTS 8, addTargets (pevné podle updated), personListMenuRows (✓, Další seznamy…, Nový seznam s touto osobou…, poznámka), listMenuEntries (víc osob, bez zdvojení), showAddPersonsToList (PICK_ROWS 200, inList) · src/ui/context-menu.ts getPersonMenuActions (za Hledat v archivech) · src/ui/person-list-new-ui.ts:215 (personIds → volba Prázdný s osobami; jedna osoba = osoba pravidla předků a potomků) · src/ui/table-view/table-ui.ts showTableRowMenu (toListN, tableAreaRowKeys, svazek oba partneři) · src/ui/search.ts (Výsledky do seznamu, všechny výsledky) · src/person-lists.ts withPersonsRemoved (done ven) · strings.ts contextMenu.toList, newListWith, newListWithMany, autoListsNote, moreLists, table.act.toListN, search.toList, newFromResults, lists.save.searchName, inList, addN, toast.added, removed, addedN, allIn · app:68363dbe · ZADANI_DEV §4 -->

<a id="A11.6"></a>
## A11.6 Uložit pohled jako seznam

Některé pohledy jdou uložit jako seznam: jen tam, kde výběr osob dává smysl.

| Odkud | Volba | Výchozí |
|---|---|---|
| Tabulka › Osoby | **⋯** Tabulky nebo nabídka **Pohled** → **Uložit jako seznam osob…** | pevný: osoby v pořadí řádků Tabulky |
| Tabulka › Svazky | **⋯** Tabulky → **Uložit jako seznam osob…** | pevný: oba partneři každého svazku, každá osoba jednou |
| výsledky hledání | **Výsledky do seznamu ›** ([A11.5](#A11.5)) | jen pevný |
| rod | výběr rodu, poslední řádek **Uložit rod {rod} jako seznam…** | automatický |
| linie výzkumu | **⋯** linie → **Uložit jako seznam…** | automatický |

- Z Tabulky se uloží osoby po filtru a řazení; dočasně ukázané řádky ne. Ukotvený řádek mimo filtr se neuloží
  („Ukotvený řádek mimo filtr (…) se neuloží.“).
- **Udržovat podle filtru** udělá automatický seznam s kopií dnešního filtru a řazení Tabulky. Pozdější změna
  pohledu Tabulky ho nezmění. **Upravit pravidlo…** takového seznamu otevře Tabulku s jeho filtrem a v **⋯** Tabulky
  nabídne **Uložit do seznamu {jméno}**.
- **Hranice:** Události, Prameny a pohledy Rodina, Potomci, Vějíř, Časová osa a Mapa se jako seznam neukládají.
- **Platí od:** aplikace 3.30.0

<!-- zdroj: app:src/ui/person-list-new-ui.ts (SAVE_ID person-list-save; zdroje table/unions/search/rod/line, pinOut, keepFilter) · src/ui/table-view/table-ui.ts saveTableAsList, saveTableRule (lists.saveRule), canSaveAsList · src/ui/rod-view.ts (rodView.saveList) · src/ui/research-directions-ui.ts:1127 directionSaveListItem · src/person-lists.ts rulePersonIds tableFilter (unions: p1, p2) · strings.ts lists.saveAs, save.*, saveRule, rodView.saveList, research.dirSaveList · app:e09dcacb, 68363dbe, 211323e8 · ZADANI_DEV §6 · spec 084 K1.4, K6.3 a -->

<a id="A11.7"></a>
## A11.7 Kdy osoba přibyla: Přidáno za posledních 30 dní

Od aplikace 3.30.0 si strom u každé osoby pamatuje, kdy do něj přibyla. Údaj se ručně neupravuje a v kartě osoby se
neukazuje; používá ho pravidlo **Přidáno za období**, řazení **Podle přidání**, sloupec **Přidáno** v Tabulce
([A6.7.2](A6-views.md#A6.7.2)) a seskupení v Tabulce ([A6.7.20](A6-views.md#A6.7.20)).

- **Kdy se zapíše:**
  - nová osoba v aplikaci: čas vzniku (zástupná osoba, až když z ní je skutečná osoba);
  - načtení souboru GEDCOM: den načtení;
  - sloučení stromů: čas sloučení u osob, které do stromu přišly; sloučená osoba si nechá dřívější údaj;
  - nová osoba z výzkumu: datum, které k ní uvádí výzkum, jinak čas načtení.
- Osoby z doby před 3.30.0 údaj nemají (v detailu seznamu, ve sloupci **Přidáno** a ve skupinách Tabulky „dříve“); nic
  se nedopočítává.
- **Přidáno za posledních 30 dní** je připravený automatický seznam každého stromu, i nového a načteného. Období jde
  změnit (**Upravit pravidlo…**); jméno se pak mění s obdobím, dokud se nepřejmenuje. Smazaný se už nevrátí.
  Prázdný říká „Zatím nic – údaj o přidání se zapisuje od verze 3.30.“
- **Hranice:** GEDCOM údaj nenese. Export s ochranou žijících ho u žijících vynechá ([A7.2](A7-book-pages-and-export.md#A7.2)).
- **Platí od:** aplikace 3.30.0

<!-- zdroj: app:src/data.ts:2636 createPerson (addedAt, ne zástupná), :2847 zástupná osoba při první úpravě, :5435 mergePersons earlierAddedAt · src/ged-parser.ts:6594 stampAddedAt(origin.at) · src/merge/executor.ts:573 (mergedAt), :1962 · src/person-lists-data.ts builtinAdded30, personListsOf (i nový strom a import, personListsDropped), keepPersonListData, stampResearchTree (research.added nebo now) · src/person-lists.ts listDisplayName (jméno podle období do přejmenování) · src/ui/person-lists-ui.ts:41 ADDED_SINCE '3.30', :534 lists.earlier · src/ui/table-view/table-group.ts:238 · src/privacy.ts:373 (stripDetails žijících: delete addedAt) · strings.ts lists.builtin.added30, addedNone, earlier · ZADANI_DEV §8, Q3 · app:714a8ab2 · sloupec Přidáno app:0971647c (table.earlier) -->

<a id="A11.8"></a>
## A11.8 Pracovní seznam: Odškrtávat hotové

Pevný seznam jde použít jako pracovní: u každé osoby je zaškrtávátko a hotové osoby se odškrtnou.

- Hotová osoba je v detailu přeškrtnutá. Nad osobami je **Vše** / **Zbývá N** / **Hotovo N**, v přehledu „zbývá a
  z b“ a v souhrnu dlaždice **zbývá**.
- Odškrtnutí patří seznamu, ne osobě: duplikát seznamu ho převezme, jiný seznam ne. Odebraná osoba přestane být
  odškrtnutá.
- Vypnutí **Odškrtávat hotové** odškrtnutí nemaže; po dalším zapnutí jsou zpět.
- Odškrtnutí je krok **Zpět**, bez oznámení.
- V Tabulce v rozsahu pracovního seznamu je sloupec **Hotovo** a čipy **Zbývá** a **Hotovo** ([A6.7.19](A6-views.md#A6.7.19)).
- **Hranice:** automatický seznam odškrtávat nejde. Ve stromu jen ke čtení jsou hotové osoby vidět bez zaškrtávátek.
- **Ovládání:** **⋯** pevného seznamu → **Odškrtávat hotové** (✓); zaškrtávátko klikem nebo mezerníkem.
- **Platí od:** aplikace 3.30.0

<!-- zdroj: app:src/person-lists.ts withChecklist (vypnutí drží done), withDoneToggled, withPersonsRemoved (done ven), listSummary left · src/data.ts duplicatePersonList (done převezme) · src/ui/person-lists-ui.ts zaškrtávátka, segment · strings.ts lists.menu.work, filter.*, left, sum.left, table.col.done, table.chip.left, chip.done · app:3dc8e709, 211323e8 · ZADANI_DEV §13 · spec 084 K8.4 -->

<a id="A11.9"></a>
## A11.9 Export seznamu

Seznam jde vyvézt dvěma cestami: jako část stromu (GEDCOM, záloha JSON), nebo jako tabulku (CSV).

- **Dialog Export → Co exportovat → Seznam osob:** volba **Seznam** nabízí seznamy otevřeného stromu, které mají
  osoby. **Export GEDCOM** pak nese osoby seznamu a rodiny mezi nimi, **záloha JSON** data stromu zúžená na osoby
  seznamu. Ochrana žijících a obsah souboru platí jako u celého stromu ([A7.2](A7-book-pages-and-export.md#A7.2),
  [A7.3](A7-book-pages-and-export.md#A7.3)). Ostatní formáty jsou nedostupné: „Tento formát exportuje celý strom“.
  Volba se pamatuje; seznam, který zmizel, vrátí volbu na **Celý strom**.
- **⋯ seznamu → Exportovat ›:**
  - **GEDCOM…** otevře dialog Export na tomto seznamu;
  - **CSV (pořadí seznamu)** stáhne hned tabulku osob seznamu v jeho pořadí: sloupce, jak je má Tabulka › Osoby, před
    nimi **#** (a **Hotovo** u pracovního seznamu). Soubor `{strom}_{seznam}_{RRRR-MM-DD}.csv`.
- **Seznamy v exportu:** záloha JSON celého stromu nese seznamy celé. Export části stromu (seznam, **Jen aktuální
  pohled**) nechá v pevných seznamech jen osoby té části; seznam, ve kterém nikdo nezbyl, vypustí. Automatické
  seznamy zůstanou celé, jejich pravidlo počítá s tím, co část má.
- Jména seznamů zůstávají v exportu i s ochranou žijících.
- **Hranice:** GEDCOM seznamy nenese, ani u celého stromu. Exportovaná stránka HTML seznamy jen ukazuje a otevře
  v Tabulce.
- **Platí od:** aplikace 3.30.0

<!-- zdroj: app:src/ui/import-export.ts exportableLists (jen s osobami, podle jména), scope 'list' (neplatný seznam → tree), exportScopeList, exportPersonListJSON (exportFocusedJSON), GEDCOM podstrom (:389), option.disabled scopeWholeOnly · src/subtree.ts:153 subsetForSubtree · src/person-lists-data.ts subsetForSubtree (pevný zúžit, prázdný ven, automatický celý) · src/ui/table-view/table-ui.ts:3215 exportPersonListCsv (leadColumnsOf: # a Hotovo, shownColumns persons, tableCsvFileName) · src/ui/person-list-hooks.ts exportRows (jen seznam s osobami) · strings.ts exportMenu.scopeLabel, scopeList, listPick, backupListDesc, gedcomListDesc, scopeWholeOnly, scopeView, lists.menu.export, export.ged, export.csv · app:33fa6cd4 · dirigent:MILAN.md 35 (4) jména seznamů v exportu zůstávají -->

<a id="A11.10"></a>
## A11.10 Seznamy v datech stromu

Seznamy jsou součástí stromu (verze dat 22): jdou se stromem do zálohy a přenosu a každá jejich změna má krok
**Zpět**.

- **Smazaná osoba** zmizí ze všech seznamů, pořadí ostatních zůstane. Oznámení smazání to řekne („Osoba … smazána,
  odebrána i z 2 seznamů.“); **Zpět** ji vrátí i do seznamů.
- **Sloučené osoby:** místo odebrané osoby převezme ponechaná; jsou-li v seznamu obě, zůstane jednou na dřívější
  pozici. Je hotová, když byla hotová kterákoli; ručně odebraná, jen když byly odebrané obě.
- **Strom z výzkumu** si seznamy a údaje „přidáno“ při načtení nové verze z výzkumu ponechá.
- **Hranice:** starší aplikace (od 3.19.0) otevře strom se seznamy jen ke čtení a neuloží ho, aby seznamy nezahodila
  ([A6.7.7](A6-views.md#A6.7.7)).
- **Platí od:** aplikace 3.30.0

<!-- zdroj: app:src/types.ts STROM_DATA_VERSION 22 (seznamy, addedAt; app:714a8ab2) · src/data.ts:436 sanitizePersonLists při načtení · src/person-lists-data.ts onPersonDeleted, onPersonsMerged, keepPersonListData · src/research-link.ts:1903 keepPersonListData · strings.ts lists.toast.personDeleted · src/tree-manager.ts isTreeNewer, src/data.ts isNewerData · app:714a8ab2 · ZADANI_DEV „Data a rozhraní“, §16a, §16b -->
