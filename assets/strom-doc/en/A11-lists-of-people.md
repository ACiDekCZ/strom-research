<a id="A11"></a>
# A11 Lists of people

A list of people keeps chosen people of the tree under one name so they can be worked with again and again: in the
Table as its scope ([A6.7.19](A6-views.md#A6.7.19)), in export and as a checklist with ticking off. A list is made
from a rule (family line, ancestors, descendants, research line, Table filter, when the people came into the tree),
from search results or by hand. The chapter describes the Strom app 3.30.0.

<!-- zdroj: dirigent:spec/084-seznamy-osob (K1.1–K8.4, rozhodnutí 14. a 16. 11.) · app:714a8ab2..60265541 (dirigent:prace/1116-app-084-seznamy) · app:docs/ZADANI_DEV_seznamy-osob.md §1–§13, §15, §16 · app:src/person-lists.ts, src/person-lists-data.ts · app:CHANGELOG.cs.md 3.30.0 „Pojmenované seznamy osob“ -->

<a id="A11.1"></a>
## A11.1 Fixed list, automatic list and checklist

A list is **fixed** or **automatic**. A fixed list holds its people and changes only by hand. An automatic list is a
saved rule: its people are worked out again each time.

| Kind | What it holds | Add and remove by hand | Manual order |
|---|---|---|---|
| **fixed** | people in a manual order; the rule it was made from (**Created from**), when it has one | yes | yes |
| **automatic** | only the rule (**Based on**) | no: “The rule decides the content – nothing is added or removed by hand.” | no |
| **checklist** | a fixed list with **Tick off done** switched on ([A11.8](#A11.8)) | yes | yes |

- The kind shows at the list in the overview (an icon and the word **fixed**, **automatic**, **checklist**), in the
  detail (the badge **Fixed list**, **Automatic list**, **Checklist**) and in the Table's **Scope** (an icon).
- A list has a name. The name is unique in the tree; it is compared without diacritics, case and extra spaces. A
  taken name is not saved: “A list with this name exists. Suggested: “{name} (2)”.” (the next free number).
- Placeholder persons are never in a list.
- **Limits:** lists change only in a tree that can be changed. In a read-only tree (an exported HTML page, a followed
  tree, a tree saved by a newer version of the app, a locked tree) the lists can be viewed and opened in the Table,
  without edits; the dialog has the badge **Read only**. A locked person can be added to a list.
- **Controls:** **Actions → Lists of people…** ([A11.3](#A11.3)).
- **Since:** app 3.30.0

<!-- zdroj: app:src/person-lists.ts listKind (dynamic → auto, checklist → work), listPersonIds (bez zástupných osob) · src/person-lists-data.ts foldListName, isListNameTaken, suggestListName · src/data.ts:2130 listsReadOnly (isReadOnly || isTreeLocked; isTreeLocked: sledovaný strom liveTreeId, isNewerData, isLocked) · src/ui/person-list-add.ts personListMenuRows (zamčená osoba ano, app:60265541) · strings.ts lists.kind.*, badge.*, rule.key, rule.origin, autoInfo, save.dup, readOnly · ZADANI_DEV §1, §16c, Q1 -->

<a id="A11.2"></a>
## A11.2 The rule of a list

A rule says which people belong to the list. A fixed list uses it once when it is made, an automatic list every time.

| Rule | Whom it finds | Name of the new list | Default sort |
|---|---|---|---|
| **Empty** | nobody, people are added by hand | – | **Manual** |
| **Family line** | the blood members of the family line ([A4](A4-surnames-and-families.md)) | the name of the family line | **Oldest first** |
| **Ancestors of a person** | the ancestors of the chosen person, **all generations** or **up to N generations** | “Ancestors – {person}” | **By generation** |
| **Descendants of a person** | the descendants of the chosen person, all generations or up to N generations | “Descendants – {person}” | **By generation** |
| **Research line** | the people of the research line, as the line's chip in the Table ([A6.7.14](A6-views.md#A6.7.14)) | the name of the line | **Oldest first** |
| **Added in a period** | the people added to the tree in the last 7, 30, 90 or another number of days ([A11.7](#A11.7)) | “Added in the last {n} days” | **By date added** |
| Table filter | the Table's rows after the filter and sort ([A11.6](#A11.6)) | the name of the view | **Manual** (the Table's order) |

- **Partners:** a family line, ancestors and descendants take blood relatives only. A partner who came into the family
  by marriage is not in the list until added by hand.
- Generations can be chosen from 1 to 10, or **all generations**. The number of days is 1 to 3650. The day the list
  is worked out is the first day of the period (“in the last 30 days” = today and the 29 days before).
- The name follows the choice of rule until the field **Name** is typed over.
- Each choice shows the number of people the list would get. Research line is offered only in a tree with lines.
- **Keep up to date** (off by default) makes an automatic list; otherwise a fixed list is made: “Fixed list: the
  people are chosen now and change only by hand. The rule is kept for “Add from the rule”.”
- **Controls:** **Lists of people → New list…** → **Based on**, **Keep up to date**, **Create**; at a list
  **Edit rule…**. Then the dialog opens on the new list with the notice “List “{name}” saved.”
- **Since:** app 3.30.0

<!-- zdroj: app:src/person-lists.ts rulePersonIds (rods/ancestors/descendants přes selection().memberIds – jen pokrevní, Q2; line přes personLineRole jako čip linie; tableFilter filterRows + sortRows; added: startOfDay − (days − 1) dní), ruleLabel · src/ui/person-list-new-ui.ts PERIODS 7/30/90, MAX_GENERATIONS 10, MAX_DAYS 3650, jméno podle pravidla do přepsání, počet u volby · ZADANI_DEV §3 (výchozí řazení podle pravidla), Q2 · app:e09dcacb · strings.ts lists.new.*, keep, keepOn, keepOff, create, toast.saved, rule.* -->

<a id="A11.2.1"></a>
### A11.2.1 Add from the rule

A fixed list made from a rule can use it again: **Add from the rule** adds the people the rule finds today who are
not in the list.

- A person removed from the list by hand does not come back this way, only when added by hand.
- The new people go to the end of the manual order, in the list's sort (with the manual sort **Oldest first**).
- Notice: “N people added from the rule.” with **Undo**; when nobody is added, “The list is complete.”
- A fixed list without a rule (made empty or from search results) does not have this option.
- **Controls:** the list's detail, the line **Created from** → **Add from the rule**.
- **Since:** app 3.30.0

<!-- zdroj: app:src/person-lists.ts withRuleFilled (bez personIds a removed, na konec, ruční → old), withPersonsRemoved (removed jen s pravidlem), withPersonsAdded (ruční přidání vyjme z removed) · strings.ts lists.fill, toast.filled, toast.full · ZADANI_DEV §3c -->

<a id="A11.2.2"></a>
### A11.2.2 Freezing an automatic list

**Freeze** turns an automatic list into a fixed one with its current people in their current order (“Becomes fixed
with the people it has now”). The rule stays as **Created from**.

- Notice “List frozen – it is fixed now.” with **Undo**.
- A fixed list cannot be made automatic.
- **Controls:** **⋯** of an automatic list → **Freeze**.
- **Since:** app 3.30.0

<!-- zdroj: app:src/person-lists.ts withFrozen (dynamic false, personIds = listPersonIds, rule zůstává) · strings.ts lists.menu.freeze, freezeSub, toast.frozen · app:3dc8e709 -->

<a id="A11.2.3"></a>
### A11.2.3 A rule that finds nothing any more

When what the rule stands on disappears, the list stays, only empty, and says why:

- “The rule finds nothing any more: {name} was deleted.” (ancestors or descendants of a deleted person; the rule
  keeps the name from when it was made);
- “The rule finds nothing any more: the family line is gone.”;
- “The rule finds nothing any more: the line was removed.”
- Under the sentence are **Edit rule…** and **Delete list**.
- **Since:** app 3.30.0

<!-- zdroj: app:src/person-lists.ts ruleBroken (person podle rule.personName, rod, line) · strings.ts lists.ruleGone, ruleGoneRod, ruleGoneLine, deleteList · ZADANI_DEV §7d -->

<a id="A11.3"></a>
## A11.3 Managing the lists: Lists of people

All the lists of the tree are in one place, the dialog **Lists of people**: the overview on the left, the chosen list
on the right.

- **Overview:** each list with the icon of its kind, its name, the number of people and a line under the name
  (**fixed · changed …**, **automatic ·** the rule, **checklist · a of b left**). Sorted **By name** or **By change**.
  From 9 lists there is a field **Search the lists** above them (regardless of diacritics).
- **Detail:** the name (renamed in place: a click, ✎ or F2; Enter saves, Esc goes back), the badge of the kind, the
  line of the rule (**Based on** / **Created from**), the summary ([A11.3.1](#A11.3.1)) and **People in the list · N**
  with the sort ([A11.4](#A11.4)). In a fixed list × at a person (**Remove from the list**) and **Add person…**
  ([A11.5](#A11.5)). Beside a person, depending on the sort, is the generation, the date added or the birthplace.
- **⋯ of a list** (at a row in the overview and in the detail): **Open in Table**, **On the map** (from app
  3.31.0), **Rename**, **Duplicate**,
  **Tick off done** (fixed, [A11.8](#A11.8)) or **Freeze** (automatic, [A11.2.2](#A11.2.2)), **Export ›**
  ([A11.9](#A11.9)), **Delete**.
  - **Open in Table** closes the dialog and opens the Table in the list's scope ([A6.7.19](A6-views.md#A6.7.19)).
  - **On the map** (also a button next to **Open in Table** in the detail) closes the dialog, sets the list as the
    window's selection ([A6.6](A6-views.md#A6.6)) and opens the Map with the scope **Selection**
    ([A6.5.7](A6-views.md#A6.5.7)). In another window the main window carries it out; without it **On the map** is
    unavailable ("The main window is not open.").
  - **Duplicate** makes a copy of the same kind with the same rule, order, people removed by hand and people ticked
    off, named “{name} (2)”.
  - **Delete** does not ask: the notice “List “{name}” deleted.” with **Undo**.
- **Limits:**
  - the detail shows at most 200 people: “The first 200 of N people.” with a link to the Table, which has them all;
  - every change of a list is one **Undo** step; making (a duplicate too), renaming, freezing and deleting are
    recorded in the change history;
  - in another window of the app ([A6.8](A6-views.md#A6.8)) a change of a list is saved through the main window.
- **Controls:** **Actions → Lists of people…**; on a phone **More → Lists of people**; in the Table **Scope ▾ →
  Manage lists…**. Keys in the overview: ↑ ↓ choose, Enter renames, Delete deletes, Esc closes the dialog. On a phone
  the overview and the list take turns on the whole screen (‹ **Back to the lists**), **⋯** is a bottom panel.
- **Since:** app 3.30.0

<!-- zdroj: app:src/ui/person-lists-ui.ts (OVERLAY_ID person-lists-modal, SEARCH_FROM 9, LIST_DETAIL_ROWS 200, NARROW_QUERY, přejmenování klik/✎/F2, klávesy ↑↓ Enter Delete) · src/ui/person-list-hooks.ts listMenu (freezeAndChecklistRows, exportRows) · src/data.ts duplicatePersonList (structuredClone, suggestPersonListName), deletePersonList (Vrátit), storePersonList audit (personList.save, :2224 přejmenování, :2254 personList.delete, :2330 zmrazení) · index.html #actions-lists-row · src/ui/bottom-sheet.ts řádek Seznamy osob v listu Více · strings.ts menu.lists, lists.title, search, byName, byChange, changed, left, people, remove, addPerson, openTable, menu.*, large, back, toast.deleted, undo.*, audit.* · app:4acf7a09, 3dc8e709 · ZADANI_DEV §2, §16 (okna 079: WindowEditSink) · 3.31.0 Na mapě: src/ui/person-lists-ui.ts (tlačítko pl-onmap v detailu, ⋯ řádek map za open), src/ui/person-list-hooks.ts showOnMap, src/windows/window-show-on-map.ts, strings.ts lists.onMap, onMapTitle, table.onMapNoMain (app:2a578474, 39020cf1, ZADANI_DEV_vyber-osob §6) -->

<a id="A11.3.1"></a>
### A11.3.1 The summary of a list

The list's detail sums up its people in tiles: **people** · **born** (the earliest and latest year of birth, without
years “–”) · **with photo** · **with citation** · **with story**; a checklist first also **left**.

- **With citation** is a person with at least one source citation at the person, their facts, events or unions.
- Under the tiles is the link “N without citation ›”: it opens the Table in the list's scope with the chip
  **No source**.
- **Since:** app 3.30.0

<!-- zdroj: app:src/person-lists.ts listSummary (birthMin/Max, photo, personEvidence sources > 0, story.text, noCite, left jen u pracovního) · src/ui/person-list-hooks.ts openInTable (noSource) · strings.ts lists.sum.* · app:211323e8 (Otevřít v Tabulce s čipem Bez pramene) · spec 084 K8.2 -->

<a id="A11.4"></a>
## A11.4 The order of a list

A list has one of five sorts. The Table (the column **#**) and export use the list's order.

| Sort | Order |
|---|---|
| **Oldest first** | by date of birth; without a date at the end |
| **By generation** | in a list of ancestors or descendants the generation from the person of the rule, otherwise the generation as in the Table's column; within a generation oldest first |
| **Alphabetically** | surname, then given name, by the app's language |
| **By date added** | the most recently added first; people without the date added at the end |
| **Manual** | the order a fixed list holds |

- Only a fixed list has **Manual**. For an automatic list the option is unavailable: “Only a fixed list has a manual
  order – Freeze”.
- Switching to another sort does not delete the manual order; back on **Manual** it is as it was. A newly added
  person goes to the end of the manual order.
- Every move is one **Undo** step; a screen reader announces it (“Moved: … is at position 3 of 12.”).
- **Controls:** **Sort: … ▾** above the list's people. Manual order: dragging a row by its handle (mouse or finger),
  Esc cancels the drag; Alt+↑ / Alt+↓ on a row; **⋯** of a person → **Move up** / **Move down**. On a phone there is
  no handle, only **⋯**.
- **Since:** app 3.30.0

<!-- zdroj: app:src/person-lists.ts sortListIds (old birthKey, gen ruleGenerations / assignGenerations, name Intl.Collator, added sestupně bez data na konec, manual), withSort (automatický bez manual), withPersonMoved, withManualOrder, withPersonsAdded (na konec) · src/ui/person-lists-ui.ts úchyt, Alt+↑/↓, Esc · strings.ts lists.sortBy, sort.*, manualOff, handle, up, down, moved · app:3dc8e709 · ZADANI_DEV §5 -->

<a id="A11.5"></a>
## A11.5 Add to list and remove

A person can be added to a fixed list from the person's menu, from the Table, from search results and from the
list's detail. An automatic list does not change by hand, so the menus do not offer it (“Automatic lists fill
themselves from their rule.”).

- **Person's menu → Add to list ›:** the fixed lists by last change, at most 8, then **More lists…**; a list the
  person is in has ✓ and a click takes them out of it. Below them **New list with this person…**: the dialog of a new
  list ([A11.2](#A11.2)), the option **Empty** with this person; for **Ancestors of a person** and **Descendants of a
  person** this person is preselected. On a phone a second page of the person's panel.
- **Table:** the row's menu → **Add to list ›** (the row's person; for a union both partners, for an event its
  people). A selection across several rows: **Add N people to a list ›** and **New list with these people…**. In the
  scope of a fixed list the row's menu also has **Remove from the list** ([A6.7.19](A6-views.md#A6.7.19)).
- **Search results → Results to a list ›:** adds all the results, not only those shown, or starts **New list from the
  results (N)…** (fixed, named “Search: {query}”).
- **List's detail → Add person…:** people picked by name, several at once; people already in the list are grey
  (“already in the list”).
- A person already in the list is not added twice (“All of them are already in “{list}”.”). A removed person is no
  longer ticked off.
- Removing has **Undo** in the notice.
- **Limits:** a read-only tree has none of these menus ([A11.1](#A11.1)).
- **Since:** app 3.30.0

<!-- zdroj: app:src/ui/person-list-add.ts MENU_LISTS 8, addTargets (pevné podle updated), personListMenuRows (✓, Další seznamy…, Nový seznam s touto osobou…, poznámka), listMenuEntries (víc osob, bez zdvojení), showAddPersonsToList (PICK_ROWS 200, inList) · src/ui/context-menu.ts getPersonMenuActions (za Hledat v archivech) · src/ui/person-list-new-ui.ts:215 (personIds → volba Prázdný s osobami; jedna osoba = osoba pravidla předků a potomků) · src/ui/table-view/table-ui.ts showTableRowMenu (toListN, tableAreaRowKeys, svazek oba partneři) · src/ui/search.ts (Výsledky do seznamu, všechny výsledky) · src/person-lists.ts withPersonsRemoved (done ven) · strings.ts contextMenu.toList, newListWith, newListWithMany, autoListsNote, moreLists, table.act.toListN, search.toList, newFromResults, lists.save.searchName, inList, addN, toast.added, removed, addedN, allIn · app:68363dbe · ZADANI_DEV §4 -->

<a id="A11.6"></a>
## A11.6 Saving a view as a list

Some views can be saved as a list: only where a choice of people makes sense.

| From | Option | Default |
|---|---|---|
| Table › People | the Table's **⋯** or the menu **View** → **Save as list of people…** | fixed: the people in the order of the Table's rows |
| Table › Unions | the Table's **⋯** → **Save as list of people…** | fixed: both partners of each union, each person once |
| search results | **Results to a list ›** ([A11.5](#A11.5)) | fixed only |
| the window's selection | **Selection ▾**, the footer **Save the selection as a list…** (family line, ancestors, descendants, research line; [A6.6.1](A6-views.md#A6.6.1)); up to app 3.30.0 only a family line: **Save the {family line} family line as a list…** | automatic |
| research line | **⋯** of the line → **Save as list…** | automatic |

- From the Table the people after the filter and sort are saved; rows shown for now are not. A pinned row outside the
  filter is not saved (“The pinned row outside the filter (…) is not saved.”).
- **Keep in line with the filter** makes an automatic list with a copy of today's filter and sort of the Table. A
  later change of the Table's view does not change it. **Edit rule…** of such a list opens the Table with its filter
  and the Table's **⋯** offers **Save to the list {name}**.
- **Limits:** Events, Sources and the Family, Descendants, Fan, Timeline and Map views are not saved as a list.
- **Since:** app 3.30.0

<!-- zdroj: app:src/ui/person-list-new-ui.ts (SAVE_ID person-list-save; zdroje table/unions/search/rod/line, pinOut, keepFilter) · src/ui/table-view/table-ui.ts saveTableAsList, saveTableRule (lists.saveRule), canSaveAsList · src/ui/rod-view.ts (rodView.saveList) · src/ui/research-directions-ui.ts:1127 directionSaveListItem · src/person-lists.ts rulePersonIds tableFilter (unions: p1, p2) · strings.ts lists.saveAs, save.*, saveRule, rodView.saveList, research.dirSaveList · app:e09dcacb, 68363dbe, 211323e8 · ZADANI_DEV §6 · spec 084 K1.4, K6.3 a · 3.31.0: src/ui/selection-picker-ui.ts saveListOptions (rod, line, selection = předci/potomci), person-list-new-ui.ts dynamic pro rod/line/selection, strings.ts selection.saveList (app:61873988, ZADANI_DEV_vyber-osob §2) -->

<a id="A11.7"></a>
## A11.7 When a person came: Added in the last 30 days

From app 3.30.0 the tree remembers for each person when they came into it. The date is not edited by hand and does
not show on the person's card; the rule **Added in a period**, the sort **By date added**, the column **Added** in the
Table ([A6.7.2](A6-views.md#A6.7.2)) and grouping in the Table ([A6.7.20](A6-views.md#A6.7.20)) use it.

- **When it is recorded:**
  - a new person in the app: the time it is made (a placeholder person only once it becomes a real person);
  - loading a GEDCOM file: the day of loading;
  - merging trees: the time of the merge for the people who came into the tree; a merged person keeps the earlier
    date;
  - a new person from the research: the date the research gives for them, otherwise the time of loading.
- People from before 3.30.0 do not have the date (in the list's detail, in the column **Added** and in the Table's
  groups “earlier”); nothing is worked out afterwards.
- **Added in the last 30 days** is a ready-made automatic list of every tree, also a new or loaded one. The period can
  be changed (**Edit rule…**); the name then follows the period until the list is renamed. Once deleted it does not
  come back. Empty, it says “Nothing yet – the date added is recorded from version 3.30.”
- **Limits:** GEDCOM does not carry the date. An export with living people protected leaves it out for living people
  ([A7.2](A7-book-pages-and-export.md#A7.2)).
- **Since:** app 3.30.0

<!-- zdroj: app:src/data.ts:2636 createPerson (addedAt, ne zástupná), :2847 zástupná osoba při první úpravě, :5435 mergePersons earlierAddedAt · src/ged-parser.ts:6594 stampAddedAt(origin.at) · src/merge/executor.ts:573 (mergedAt), :1962 · src/person-lists-data.ts builtinAdded30, personListsOf (i nový strom a import, personListsDropped), keepPersonListData, stampResearchTree (research.added nebo now) · src/person-lists.ts listDisplayName (jméno podle období do přejmenování) · src/ui/person-lists-ui.ts:41 ADDED_SINCE '3.30', :534 lists.earlier · src/ui/table-view/table-group.ts:238 · src/privacy.ts:373 (stripDetails žijících: delete addedAt) · strings.ts lists.builtin.added30, addedNone, earlier · ZADANI_DEV §8, Q3 · app:714a8ab2 · sloupec Přidáno app:0971647c (table.earlier) -->

<a id="A11.8"></a>
## A11.8 A checklist: Tick off done

A fixed list can be used as a checklist: each person has a box and the people done are ticked off.

- A person done is struck through in the detail. Above the people is **All** / **Left N** / **Done N**, in the
  overview “a of b left” and in the summary the tile **left**.
- Ticking off belongs to the list, not to the person: a duplicate of the list takes it over, another list does not.
  A removed person is no longer ticked off.
- Switching **Tick off done** off does not delete the ticks; switched on again, they are back.
- A tick is an **Undo** step, without a notice.
- In the Table in the scope of a checklist there is the column **Done** and the chips **Left** and **Done**
  ([A6.7.19](A6-views.md#A6.7.19)).
- **Limits:** an automatic list cannot be ticked off. In a read-only tree the people done show without boxes.
- **Controls:** **⋯** of a fixed list → **Tick off done** (✓); the box by a click or Space.
- **Since:** app 3.30.0

<!-- zdroj: app:src/person-lists.ts withChecklist (vypnutí drží done), withDoneToggled, withPersonsRemoved (done ven), listSummary left · src/data.ts duplicatePersonList (done převezme) · src/ui/person-lists-ui.ts zaškrtávátka, segment · strings.ts lists.menu.work, filter.*, left, sum.left, table.col.done, table.chip.left, chip.done · app:3dc8e709, 211323e8 · ZADANI_DEV §13 · spec 084 K8.4 -->

<a id="A11.9"></a>
## A11.9 Exporting a list

A list can be exported in two ways: as a part of the tree (GEDCOM, JSON backup) or as a table (CSV).

- **Export dialog → What to export → List of people:** the option **List** offers the lists of the open tree that
  have people. **GEDCOM export** then holds the people of the list and the families between them, the **JSON backup**
  the tree's data narrowed to the people of the list. Protecting the living and the file's content apply as for the
  whole tree ([A7.2](A7-book-pages-and-export.md#A7.2), [A7.3](A7-book-pages-and-export.md#A7.3)). The other formats
  are unavailable: “This format exports the whole tree”. The choice is remembered; a list that is gone returns the
  choice to **Whole tree**.
- **⋯ of a list → Export ›:**
  - **GEDCOM…** opens the Export dialog on this list;
  - **CSV (list order)** downloads at once the table of the list's people in its order: the columns as the Table ›
    People has them, before them **#** (and **Done** for a checklist). File `{tree}_{list}_{YYYY-MM-DD}.csv`.
- **Lists in the export:** a JSON backup of the whole tree carries the lists whole. An export of a part of the tree
  (a list, **Current view only**) keeps in fixed lists only the people of that part and leaves out a list with nobody
  left. Automatic lists stay whole; their rule works with what the part has.
- The names of lists stay in the export, also with living people protected.
- **Limits:** GEDCOM does not carry lists, not even for the whole tree. An exported HTML page only shows the lists and
  opens them in the Table.
- **Since:** app 3.30.0

<!-- zdroj: app:src/ui/import-export.ts exportableLists (jen s osobami, podle jména), scope 'list' (neplatný seznam → tree), exportScopeList, exportPersonListJSON (exportFocusedJSON), GEDCOM podstrom (:389), option.disabled scopeWholeOnly · src/subtree.ts:153 subsetForSubtree · src/person-lists-data.ts subsetForSubtree (pevný zúžit, prázdný ven, automatický celý) · src/ui/table-view/table-ui.ts:3215 exportPersonListCsv (leadColumnsOf: # a Hotovo, shownColumns persons, tableCsvFileName) · src/ui/person-list-hooks.ts exportRows (jen seznam s osobami) · strings.ts exportMenu.scopeLabel, scopeList, listPick, backupListDesc, gedcomListDesc, scopeWholeOnly, scopeView, lists.menu.export, export.ged, export.csv · app:33fa6cd4 · dirigent:MILAN.md 35 (4) jména seznamů v exportu zůstávají -->

<a id="A11.10"></a>
## A11.10 Lists in the data of the tree

Lists are part of the tree (data version 22): they go with the tree into the backup and transfer, and every change
of them has an **Undo** step.

- **A deleted person** disappears from all lists, the order of the others stays. The notice of the deletion says so
  (“… deleted, also removed from 2 lists.”); **Undo** returns them to the lists too.
- **Merged people:** the kept person takes the place of the removed one; when both are in a list, the person stays
  once at the earlier position. The person is done when either was done; removed by hand only when both were.
- **A tree from the research** keeps its lists and the dates added when a new version is loaded from the research.
- **Limits:** an older app (from 3.19.0) opens a tree with lists read-only and does not save it, so the lists are not
  lost ([A6.7.7](A6-views.md#A6.7.7)).
- **Since:** app 3.30.0

<!-- zdroj: app:src/types.ts STROM_DATA_VERSION 22 (seznamy, addedAt; app:714a8ab2) · src/data.ts:436 sanitizePersonLists při načtení · src/person-lists-data.ts onPersonDeleted, onPersonsMerged, keepPersonListData · src/research-link.ts:1903 keepPersonListData · strings.ts lists.toast.personDeleted · src/tree-manager.ts isTreeNewer, src/data.ts isNewerData · app:714a8ab2 · ZADANI_DEV „Data a rozhraní“, §16a, §16b -->
