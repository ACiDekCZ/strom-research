<a id="A6"></a>
# A6 Views and the choice of people

How the Strom app chooses which people to show and how each view shows them. Describes the app 3.21.2; changes from a later version carry its number.

A view is a different reading of **the same choice of people**. The choice is set by the central person (the one
clicked) and the depth **Ancestors** and **Descendants**. Family, Descendants, Timeline and Map show the same
surroundings of the central person. The Fan counts ancestors and descendants on its own by the number of generations
([A6.4](#A6.4)). The Table shows the whole tree ([A6.7](#A6.7)).
On a computer each view can also be opened in a separate window ([A6.8](#A6.8)).

Views: **Family**, **Descendants**, **Timeline**, **Fan**, **Map**, **Table**.

<!-- zdroj: app:src/types.ts:1237 ViewMode · strings.ts viewModeSwitch.* · Tabulka od aplikace 3.27.0 (viewModeSwitch.table) -->

<a id="A6.1"></a>
## A6.1 The surroundings of the central person in the Family view

The Family view shows the central person within their family, not the whole tree.

- The choice includes:
  1. the central person and all their partners;
  2. their descendants down to the depth **Descendants**, with partners;
  3. direct ancestors through both parents up to the depth **Ancestors**;
  4. siblings, half-siblings too (their other parent is not added), with partners and descendants down to the depth
     Descendants;
  5. aunts and uncles (the parents' siblings) with partners;
  6. cousins, that is the children of aunts and uncles recorded in their union, with descendants down to the depth
     Descendants.
- **Limits:** the ancestors of the central person's partner are never added. Whoever is not in the surroundings stays
  in the tree; the view just does not show them. A new central person shows them.
- **Depth:** after a new central person is chosen, Ancestors and Descendants are set to the greatest depth the tree
  has for that person. The menu offers 1 up to that greatest depth. The partner's children from another union add one
  generation down.
- **Controls:** a click on a person's card; the options **Ancestors** and **Descendants** in the view bar.
- **Since:** app 1.0.0

<!-- zdroj: app:src/layout/pipeline/1-select-subgraph.ts selectSubgraph · src/layout/pipeline/index.ts:962 includeSpouseAncestors: false · src/renderer.ts:719 computeTreeLayout, setFocus (maxGenerations) · src/focus-depth.ts maxAncestorDepth, maxDescendantDepth · strings.ts focus.ancestorsLabel, focus.descendantsLabel -->

<a id="A6.1.1"></a>
### A6.1.1 Default person and view

What a tree opens with is set by the tree setting **Default person and view**.

| Option | Choices |
|---|---|
| person | **Last focused** · **Specific person:** (chosen) |
| view | **Family** · **Last used** (on this device) |

- **Limits:** without the setting the tree opens on the tree's first person. Reloading the page keeps the tree, the
  view and the central person.
- **Controls:** tree management, at the tree **Default person and view**.
- **Since:** default person app 1.0.0; the choice of view and reloading the page app 3.21.0

<!-- zdroj: app:src/renderer.ts:1178 findDefaultFocusPerson, getStartupFocus · strings.ts treeManager.defaultPersonViewTitle, focus.defaultPersonLastFocused, focus.defaultPersonSpecific, focus.defaultViewFamily, focus.defaultViewLast · CHANGELOG.cs.md 3.21.0 -->

<a id="A6.1.2"></a>
### A6.1.2 Spacing: Normal and Dense

The option **Spacing** sets the gaps between cards and between generations in the Family and Descendants views.
**Dense** makes them smaller, so more people fit on the screen. **Normal** is the default, on a phone too.

| Gap | Normal | Dense |
|---|---|---|
| between cards side by side | 31 px | 20 px |
| between generations | 80 px | 48 px |
| between partners | 18 px | 14 px |

- After a switch the tree is redrawn at once and stays on the same person: on the central person's card when it is
  wholly visible, otherwise on the card nearest the centre. The tree behaves the same after a change of **Card
  detail**.
- **Marriage order:** in Dense, instead of the pill “1. ∞ 1866” there is only a short “∞ 1” at the edge of the card,
  that is the order of this marriage. The whole order is shown by a bubble (with the mouse, the keyboard and a tap). A
  pill that has no room at the card is not drawn.
- **Export:** the poster export has its own option **Spacing** (after the paper format and the orientation). When it
  differs from the screen, the image, the poster and the PDF in sheets are laid out again with the chosen spacing,
  with the same choice of people and the same cards; the screen does not change. Under each option is the number of
  sheets (“26 A4 sheets”) when the numbers differ. Printing (Ctrl+P) takes the spacing of the screen.
- **Limits:** the option belongs to the device and is not saved with the tree. Timeline, Fan, Map and Table have their
  own layout and the option does not concern them; the poster export from the Fan and the Timeline has no row
  **Spacing**.
- **Controls:** **Settings** → **Person card** → **Spacing** (after **Card detail**): **Normal** · **Dense**. On a
  small screen without the compact card, under the option stands “On a small screen, the Compact card helps too.”
  Export: **Export poster** → **Spacing**.
- **Since:** app 3.27.0

<!-- zdroj: app:src/types.ts TreeSpacing, DEFAULT_LAYOUT_CONFIG (31/80/18), DENSE_LAYOUT_CONFIG (20/48/14), layoutConfigFor · src/settings.ts getTreeSpacing/setTreeSpacing (treeSpacing), getPosterSpacing/setPosterSpacing (posterSpacing), výchozí normal · src/renderer.ts:804 STANDALONE_VIEWS (timeline, fan, map, table), getPosterLayout({spacing}), kotva překreslení (ústřední karta celá v obraze, jinak nejbližší středu; i při změně typu karty) · src/marriage-order.ts (husté: „∞ N“ na okraji karty, bez místa se nekreslí) · src/ui/export-image-ui.ts (řádek za formátem a orientací, skrytý u vějíře a časové osy, sheetsCount) · strings.ts spacing.label, normal, dense, desc, scope, scopeExport, smallHint, marriageOrder.short, poster.menu, poster.sheetsCount, settings.groupCard, cardDensity.settingLabel · commity 68b9dde4, 03918007, 928db183, e2891a8a · spec 069 K1.1, K3.1 -->

<a id="A6.1.3"></a>
### A6.1.3 Children and siblings at once

In the Family view one step shows in place the person's children and the siblings of the person and of the person's
ancestors. The focus, the depth and the zoom stay, and the person's card stays at the same place on the screen.

- **Who is added:**
  - the person's children (not grandchildren);
  - the siblings of the person and of each of the person's ancestors who is in the view and whose parents are in the
    view. The top row of the depth **Ancestors** is not expanded (its siblings would bring a new generation, which is
    the depth's job); it keeps "▸ parents";
  - siblings are the children of the parents in the view from all marriages, the same as with a single "Show siblings
    here". With the children come their other parent, the partners the view draws with them and what the depth
    **Descendants** keeps under them.
- **Count +n:** how many cards the step adds; it is computed by the same layout as the view, so exactly n cards are
  added by the step. It is recounted after each drawing.
- **Limits:**
  - the step is one layout, one history step and one step of **Hide shown · n** (n + 1). It is undone by **Back** in
    the history, by **Hide shown** (undoes everything shown) or by the same option again ("Collapse children and
    siblings");
  - the affected cards have the tabs "▾ children" and "▾ siblings", and single families can still be collapsed one by
    one;
  - a new person in the focus, another view or tree cancels the step. A change of the depth **Ancestors** or
    **Descendants** ends all "at once" steps: their cards go, families shown one by one stay and the option offers
    the "+n" of the new depth;
  - above 150 people the app asks first in a bubble: "n people will be added", "The tree will grow to about k screen
    widths. The zoom stays." (k from the actual layout at the current zoom, rounded up) and the buttons **Expand
    +n**, **Only 2 ancestor generations +m** (only the siblings of the person, the parents and the grandparents;
    missing when m is n or 0) and **Cancel**. Esc, a click beside it or a change of the window size = Cancel. Up to
    150 people without asking.
- **Controls:** app, Family view:
  - the view bar, right after the options **Ancestors** and **Descendants**: **Children & siblings +n** for the person
    in the focus. A step that is on shows ✓ and a click undoes it; when there is nothing to add, the option is muted
    ("All children and siblings are already shown"). On a tablet an icon and "+n"; when it does not fit into the bar,
    it gives way (the person's menu still has it). A phone has no option in the bar;
  - the person's menu (on touch the person's bottom panel) under the rows that show parents, siblings and children in
    place: **Expand children and siblings · +n** with the sub-line "the person's children, siblings of the person and
    of their ancestors", only when there is something to add; while the person's step stands, **Collapse children and
    siblings**. For the person in the focus it is the same step as in the bar.
- **Since:** app 3.28.0

<!-- zdroj: app:f5d56ed3 src/bulk-family.ts collectBulkFamily (childrenOf osoba; siblingsOf osoba a předci v pohledu s rodiči v pohledu; maxGeneration), bulkParents, bulkNewIds (drawnPersonIds, kroky 1–5 pipeline), BULK_CONFIRM_ABOVE 150, BULK_TWO_GENERATIONS 2 · src/renderer.ts bulkFamilyPlan (jen family), bulkFamilyState (offer/on/none), bulkFamilyScreens (ceil šířka × zoom / plátno), showBulkFamily → showChildrenOf (jeden krok historie, zoom beze změny, kotva), undoBulkFamily, bulkStepOf (jen při stejné hloubce), forgetBulkSteps při změně hloubky, resetChildrenShown při změně fokusu, pohledu, stromu, hiddenShownCount (+1 za krok) · src/ui/bulk-family-ui.ts confirmBulkFamily (Esc, klik vedle, resize = zrušit; two jen m > 0 a m ≠ n), runBulkFamily, updateBulkFamilySwitches (title treeTip/menuOff/treeNone, aria-disabled) · src/ui/context-menu.ts bulkFamilyRows (offer: menu, +n, menuSub; on: menuOff) · src/ui/toolbar-fit.ts (tablet: přepínač ustoupí před hledáním, f5d56ed3) · index.html button.bulk-family (telefon skrytý) · strings.ts bulk.*, menu.showChildrenHere, showSiblingsHere, focusBar hideAllShown, history back · app 2eb013ba, cecea43f, 8dc34565, f5d56ed3 · dirigent:prace/1113-app-drobnosti-1112 · ZADANI_DEV_drobnosti-1112 §3 -->

<a id="A6.2"></a>
## A6.2 The Descendants view

The Descendants view shows only the central person and their descendants down to the depth Descendants: without
ancestors, aunts, uncles and cousins.

- **Blood only** (default): the central person's blood descendants.
- **Whole families**: also the partners' other unions and their stepchildren, dimmed.
- **Controls:** a switch in the view bar; the default is kept by the setting **Descendants view**.
- **Since:** the view app 1.4.0; Whole families app 1.9.2

<!-- zdroj: app:src/layout/pipeline/index.ts includeAuntsUncles: !descendantsOnly, expandLineageOnly: descendantsOnly && !isDescendantsFullFamilies() · strings.ts viewModeSwitch.bloodOnly, viewModeSwitch.fullFamilies, viewModeSwitch.settingLabel · settings descendantsFullFamilies (výchozí false) -->

<a id="A6.3"></a>
## A6.3 Timeline

The Timeline shows the people of the view as life bars on an axis of years.

- Only a person with a year of birth gets a row. The view counts the others and writes "N people without a birth
  year not shown". Placeholder persons (an empty place for an unknown parent) are left out.
- The order of rows: year of birth, then the name without titles.
- The bar of a living person reaches today. A deceased person without a date of death has a bar up to the last known
  event and an open end.
- The year of a marriage is taken from the start date of the union. The axis is rounded to decades.
- Under the axis of years runs a row of history for the central person (events of the time and the places of their
  life, symbols of kinds). Without the research or without such events there is no row.
- **Since:** timeline app 1.5.0; the row of history app 3.19.0

<!-- zdroj: app:src/timeline.ts computeTimelineModel, :59 TimelineHistory · strings.ts timeline.omitted · CHANGELOG.cs.md 3.19.0 -->

<a id="A6.4"></a>
## A6.4 Fan

The Fan shows the central person's ancestors in circular segments, generation by generation.

- **Shape:** **Half circle** · **Full circle** · **Two-way** (ancestors and descendants).
- **Generations** of ancestors 3–10, default 5. In the shape Two-way, **Descendants** 1–5, default 3.
- Numbering of ancestors: 1 is the central person, the father of person n has the number 2n, the mother 2n+1. The
  father's line is on the left. The numbers on the segments are turned on by the setting **Fan chart** "Show Kekulé
  (ancestor) numbers" (off by default).
- The parents are the person's first two recorded parents. A relationship that is not biological (adoption, step,
  foster) is marked at the segment.
- An ancestor who appears in the fan a second time is drawn again but not expanded further; legend **↻ repeats
  (pedigree collapse)**. The option **Show first occurrence** jumps to their first place.
- Descendants (shape Two-way): unions in the order of marriages (date of marriage, then the order in the data),
  children by birth. An unknown partner gathers the children without a second parent. A union without children is
  shown only for the central person.
- **Colours:** **Gender** · **Lines** (the four lines of the grandparents: father's father, father's mother, mother's
  father, mother's mother) · **Family lines** ([A4](A4-surnames-and-families.md)).
- **Original person** returns the fan to the person it started from.
- **Since:** fan app 1.8.0; the new fan with shapes, colours and pedigree collapse app 3.20.0
- **From app 3.27.0:** a union without a date of marriage is ordered by the latest date the marriage can have
  been: the earlier of the end of the union (a divorce) and the birth of the union's first child. A marriage “before
  1982” comes before a marriage in 1982. A union without these dates comes after the others. The partners next to a
  person and the marriage-order marks (“1. ∞”) on the cards follow the same order.

<!-- zdroj: app:src/fan-chart.ts FAN_MIN_GENERATIONS, FAN_MAX_GENERATIONS, FAN_DEFAULT_GENERATIONS, parentSlots, repeatOf · strings.ts fan.shapeHalf, fan.shapeFull, fan.shapeTwo, fan.colorGender, fan.colorLine, fan.colorRod, fan.legendRepeats, fan.originPerson, fan.showFirst, fanChart.kekuleHint · settings fanKekule (výchozí false) · spec 029 · CHANGELOG.cs.md 3.20.0 · 3.27.0: app:ad1ca16c src/marriage-order.ts marriageKey (BOUND 0.5, qualifier „<“; bez sňatku min(endDate, narození dětí)), marriageDates, compareMarriages, marriagesInOrder (partneři vedle osoby, značka „1. ∞“) · src/fan-chart.ts familiesOf · CHANGELOG.cs.md 3.27.0 · dirigent:prace/1109-app-tester-vlna1 (T50, T13) -->

<a id="A6.5"></a>
## A6.5 Map

The Map shows the places of people's events.

- **Scope:** **This view** (default, the people of the view) · **Whole tree**.
- **Kinds:** **Births** · **Deaths** · **Marriages** · **Other events**. All are on by default; the choice is
  remembered on the device.
  - A baptism counts as a birth, a burial and a cremation as a death.
  - An engagement, banns, a marriage licence and a marriage contract count as a marriage. The couple's other events
    are Other events.
- The place of a marriage is shown when at least one of the partners is in the view.
- A place is written in its most frequent spelling. A town is one point, house numbers included; a place with its own
  exact coordinates stays a separate point.
- **Migration over time** shows the places by year and the ancestors' path to one person ([A6.5.3](#A6.5.3)).
- **Since:** map app 1.10.0; kinds of events and town points app 3.21.0

<!-- zdroj: app:src/places.ts collectPlaces, groupTownPoints · src/ui/map-ui.ts (localStorage strom.map.kinds) · strings.ts map.scopeView, map.scopeTree, map.kinds · CHANGELOG.cs.md 3.21.0 -->

<a id="A6.5.1"></a>
### A6.5.1 Where the map gets a place's location

In a tree of its own (without the research) the app looks up the location of places itself, in the OpenStreetMap
service (Nominatim). It sends only the name of the place as it is written in the tree, and only with consent. In a
tree from the research, places are identified by the research ([R4](R4-places.md)).

- **Limits:**
  - before the first lookup the app asks (**Look up coordinates online?**). Only place names leave the app, no names
    of people, dates or relations. At most one request about every second;
  - the coordinates are saved into the tree: each place is looked up once, and the map then works offline too;
  - the automatic lookup takes the service's **first result** for the written name. Up to app 3.23.0 it did not tell
    apart towns of the same name: a place could thus land in a town of the same name elsewhere. A location that does
    not fit the tree is marked **Check** ([R4.4.1](R4-places.md#R4.4.1));
  - only a place with a house number that the service did not find is looked up by its town. Of the towns of that
    name, the one nearest the tree's other places is chosen (“Several towns have this name; the one nearest the tree’s
    other places was chosen.”); the place shows **Located by the town of …**;
  - **from app 3.24.0** the nearest town is chosen for every place: when two or more towns are named exactly like the
    written place (regardless of letter case and diacritics), the one nearest the centre of the tree is taken, not the
    first result. The centre is the median of the locations set by hand or confirmed with **Keep**, when there are at
    least 3; otherwise the median of all the tree's locations and of the places the lookup found without doubt.
    A place with a further detail (“Lhota u Kolína”, “Lhota 16”), a single town or a tree without locations gets the
    first result as before. It is still one request per place;
  - the place check says how many towns of that name the map found (“The map found 3 towns with this name and took the
    one nearest the tree’s other places.”); from app 3.24.0, formerly always “two”;
  - a location already in the tree is not moved: the lookup looks up only places without a location. Not even a merge
    with another tree or a GEDCOM file overwrites a location set by hand or confirmed with **Keep**; it only adds
    missing ones. A wrong older location can be moved only by hand;
  - what is not found stays without a location. The app guesses nothing: “check the spelling, or add the country”.
- **Controls:** app: **Settings → Look up places online**; in the places window **Wrong spot? Fix this place**,
  **Search for this place under another name** (only the location is attached, the entry in the tree does not
  change), **Use for the other house numbers in … too**, **Clean orphaned places (n)**.
- **Why:** looking up places is the only part of the app that sends anything out; therefore only with consent, only
  names, and each place once (a comment in the code). The limit of one request per second is a condition of the
  service.
- **Since:** app 1.10.0; **Wrong spot? Fix this place** 1.10.1; **Clean orphaned places** 2.1.0; the location by the
  town 3.21.0; the nearest town of the same name for every place and the number of towns in the check 3.24.0

<!-- zdroj: app:src/geocode.ts hlavička, REQUEST_INTERVAL_MS=1100, geocodePlace (limit 1, parseGeocodeResponse první výsledek), geocodeTown/pickTownHit nearestTo (od v3.21.0), geocodePlaces townFallback · app:src/strings.ts map.consentTitle, consentBody, settingLabel, wrongSpot (v1.10.1), searchLabel, attachOnly, useForOthers, cleanOrphans (v2.1.0), nearestTown, byTown, doneWithMisses · FB podnět 2026-11-04 (stejnojmenná obec) · od 3.24.0: geocode.ts treeCenter (medián, PERSONS_CENTER_MIN=3), sameNamedTowns, pickPlaceHit (townChoices), buildGeocodeUrl limit · place-check.ts multi count · strings.ts checkMulti(n) · merge-executor test (ruční poloha zůstane) · commit 046967d -->

<a id="A6.5.2"></a>
### A6.5.2 Looking up places off the map in the research

For a tree with a research, the map's status bar offers the places without a location for looking up in the research
([R4.4](R4-places.md#R4.4)). The button opens the **Places** window with a preview; places go to the research's queue
only after **Queue**.

- **Limits:**
  - before the map's lookup the bar has **In the research** beside the map's own lookup. After the lookup, when the
    map did not find some places, the bar shows "N places on the map · K not found by the map" and **Look up in the
    research (K)**, possibly "N to confirm ›" (opens **Waiting** in the research panel);
  - the button is there only for a tree with a research and only when something can be looked up: a place without a
    location or not identified that is not in the queue yet, not being worked on and not waiting for an answer;
  - the **Places** window shows the preview "Look up N places not on the map in the research". Nothing is queued
    before **Queue N places**, and no place is queued twice;
  - when the research runs on another computer, or on a phone, the app says instead of the window where the lookup
    works: "Look up and check work in the research on the computer where it runs. Place states come here with the
    tree.", on a phone "Look up and check work on the computer with the research. Questions about places can be
    answered here too, in Waiting." An older research: "This version of the research does not look up places yet.";
  - while following the research on the map ([S4.1.3](S4-research-from-the-app.md#S4.1.3)) the line "… – no position
    on the map" offers **Look up in the research**: it queues that one place at once, without a preview; the queuing
    can be undone in the notice.
- **Controls:** app: the map → the status bar → **In the research**, after the map's lookup **Look up in the research
  (K)** → the **Places** window → **Queue N places**.
- **Since:** app 3.25.0

<!-- zdroj: app:src/ui/map-ui.ts (stavový pruh, lookResearch, lookable), src/ui/place-actions.ts, src/ui/places-research-ui.ts (bulkLook, bulkLookHead, bulkLookGo, nic dvakrát), src/ui/map-follow-ui.ts (noCoords + places.research.look, Undo) · strings.ts map.onMap.notFound, lookResearch, lookResearchShort, lookResearchTitle, confirm; places.dialog.elsewhere, phoneLine, oldResearch · CHANGELOG.cs.md 3.25.0 · commit 2246ca28 · spec 058 -->

<a id="A6.5.3"></a>
### A6.5.3 Migration over time

**Migration over time** shows the places by year. The slider in the bar under the map sets the year, and the map
shows the places added up to that year and the lines of the family's moves.

- **Limits:**
  - the bar has only places with a year and a location. The status bar counts the places with a location but no date
    ("N places without a date are not shown on the timeline.");
  - the bar runs from the earliest to the latest year of the places in the scope (**This view** / **Whole tree**) and
    of the kinds turned on ([A6.5](#A6.5)). Without dated places the mode cannot be turned on;
  - a point where something happened in the last ten years before the chosen year is highlighted;
  - a line runs from a parent's place of birth to the child's place of birth when both have a year and a location
    and differ. Siblings on the same route share one line. A line fades with the child's age, to 15 % after 60
    years. Only lines with an end near the map's view are drawn, at most 400. Without the kind **Births** no lines
    are drawn ("The family path shows only with Births.");
  - **Play** moves the year about every 120 ms up to the last year. On the last year, **Play** starts again from the
    beginning.
- **From app 3.28.0:**
  - the button **◷ Over time** has text next to its icon;
  - the map offers the mode once: while it has never been on and the tree has at least two dated places with a
    location, the card **Migration over time** stands by the button ("Plays how the family lines moved and shows the
    ancestors' path to one person."). **Try it** turns the mode on, **Not now** closes the card. After either, the
    card does not come back on this device;
  - keys on the slider: the arrows by a year, PageUp and PageDown by 10 years, Home and End to the beginning and the
    end. The space bar anywhere on the map (outside fields and buttons) plays or pauses. Moving by hand pauses the
    playback;
  - in the mode a person can be chosen, and the map shows the path of that person's ancestors
    ([A6.5.4](#A6.5.4));
  - **Play** and **Pause** have the same width (that of the longer of the two words in the given language), so the
    slider, its marks and the year do not move when the playback starts and stops. A phone has only the icon.
- **Controls:** app: the map → **◷ Over time** (**Migration over time**) → the slider, **Play** / **Pause**.
- **Since:** app 2.4.0; kinds of places 3.21.0; the button's text, the one-time offer, the keys and the fixed width
  of **Play** 3.28.0

<!-- zdroj: app:src/map-time.ts collectDatedPlacePoints (undatedPlaceCount, minYear/maxYear) · src/ui/map-ui.ts drawMapTimeLayer (fresh = posledních 10 let, slice(0, 400) s koncem u výřezu), mapMigrationSegments (místa narození rodič → dítě, opacity max(0.15, 1 − věk/60·0.85), bez Narození nic), toggleMapTimePlay (setInterval 120, na konci od začátku), renderMapTimeTip / dismissMapTimeTip (strom.map.timeTipSeen, ≥ 2 datovaná místa s polohou, podklad mapy potvrzený), klávesy na posuvníku a mezerník (setMapTimeYear pozastaví) · strings.ts map.timeMode, timeModeShort, timeModeEmpty, timePlay, timePause, timeUndated, noFamilyPath, timeTipTitle, timeTipText, timeTipTry, timeTipLater · Migrace v čase od v2.4.0 (app 44a903bc) · 3.28.0: app 34e82d43, cce82a89 (app:81f2adf0) · CHANGELOG.cs.md 3.21.0, 3.28.0 · spec 054 P2 · stálá šířka Přehrát/Pozastavit: app 35ed67f9 src/ui/map-ui.ts (obě slova v jedné buňce, map-time-play-word), index.html .map-time-play-text -->

<a id="A6.5.4"></a>
### A6.5.4 The ancestors' path to a person

In Migration over time one person can be chosen. The map then shows only that person's direct ancestors and the
lines from each ancestor to their child, down to the chosen person, and the bar ends at that person.

- **Limits:**
  - the ancestors are the parents, their parents and further, at most 30 generations. The parents are taken as in
    the Fan ([A6.4](#A6.4)). The stand-in second parent of a family with one parent is not an ancestor: that branch
    is unknown;
  - an ancestor reached by more than one path (pedigree collapse) is one point on the map but counts in every
    branch they belong to. Within the same branch their ancestors are not expanded a second time;
  - an ancestor stands at the place of birth, without it at the place of baptism, without it at the first dated
    residence; always only at a place with a location. Their year is the year of birth, without it the year of
    baptism, without it the year of that place. An ancestor without a year or without a place with a location is
    not on the bar: the legend counts them, and **List ›** names them with what is missing (**no birth date**,
    **no place**, **no date or place**) and **Person page ›** ([A6.5.5](#A6.5.5));
  - the chosen person stands the same way. They are the end: a ring "◎ end: name", at the end of the bar a full ring
    "◎ name · year" (at a place of baptism "· baptism year", at a residence "· residence year"). An end without a
    place on the map is not drawn, and at the end of the bar stands "… has no place on the map.";
  - the bar runs from the year of the earliest ancestor on the map to the later of the years of the last ancestor
    and the end;
  - the path takes the ancestors from the whole tree: a chip with the person stands in place of the scope, and
    clearing the path brings the scope back. The kinds of places do not apply to the path. A town's point gathers
    its houses as without the path;
  - a place's bubble shows only the people of the path at that place, the ancestors up to the chosen year and the
    end, with the tags of their family lines;
  - after a person is chosen, the map moves and zooms once to the whole path, then it does not move by itself
    (an exception at the end of the playback, [A6.5.6](#A6.5.6));
  - there are at most 400 lines, as without the path. When there are more, these come first: the trunk (parents and
    grandparents), lines from the last 10 years, closer generations, an end in the map's view, a longer line. The
    legend says so ("N of M lines shown", "Closer generations and newly added lines come first.");
  - turning **Over time** off only hides the path. When turned on again, it comes back and runs from the first year.
    **×** on the chip clears it;
  - a new window with the map ([A6.8](#A6.8)) takes over the path's person, quarters or eighths and the line
    colours.
- **Choosing the person:** **Path to a person** searches the whole tree ("Name, surname or year"), at most 30 people.
  An empty field shows the central person (**Last focused**). Each person shows how many of their ancestors are on
  the map; a person with none is greyed out ("ancestors have no places on the map yet") and cannot be chosen. On a
  phone and a touch screen the choice opens as a sheet from below. When no ancestor is on the map, the bar says
  "No ancestor has a place on the map yet." and offers **Choose another person**.
- **Controls:** app:
  - the map → **◷ Over time** → in the bar **◎ Path to a person…** → a person. The chip **◎ Path to:** name opens
    the choice again (**Change person**), **×** clears the path (**Clear the path**);
  - in a place's bubble a click on a person → **◎ Path to this person** (beside **Person page ›**), also without a
    chosen person;
  - on the person page **◎ Ancestors' path on the map ›** ([A7.6](A7-book-pages-and-export.md#A7.6)): the page
    closes, the map shows the path from the first year and a notice offers **‹ Back to the person page**. The link is
    in the section **Places of life**. A person with at most one place of their own does not have this section; when
    they have ancestors on the map, the link stands on its own row where the section would be. When the person has
    ancestors but none is on the map, the link is greyed out ("No ancestor has a place on the map yet.") and only in
    the section **Places of life**. Without ancestors in the tree there is no link.
- **Since:** app 3.28.0

<!-- zdroj: app:src/map-lines.ts buildPathModel (maxGen 30, fatherMother přes parentSlots jako vějíř, isPlaceholder není předek, implex záznam na cestu, expanded podle osoby a větve), placeOf (narození → křest → první datované bydliště, jen s polohou; rok narození → křest → místa), missing (date/place/both), yearFrom/yearTo, links, pathSegments (PATH_LINE_CAP 400, pořadí kmen, fresh < 10 let, generace, výřez, délka) · src/ui/map-path-ui.ts (mapEffectiveScope celý strom, čip místo rozsahu, clearMapPath vrátí rozsah, jednorázový výřez framed, cíl čárkovaný → plný, pathTargetNoPlace, pathNoAncestors + pathOtherPerson) · src/person-picker.ts PathPersonPicker (limit 30, recentId = ústřední osoba, onMapCount 0 = aria-disabled, celý strom) · src/ui/map-lines-legend-ui.ts mapPathBubbleParts · src/ui/map-ui.ts showMapPathPlace, toggleMapTime (vypnutí skryje, zapnutí od začátku) · src/ui/person-page-ui.ts personPageMapPath (on/off/null), openPersonPageMapPath (toast map-path-back) · src/person-page-map.ts (pp-map-path, aria-disabled, jen v okně aplikace; mapPathRowHtml vlastní řádek bez oddílu Místa života jen pro mapPath on, app caea192a) · src/person-page.ts mapPathRow · src/windows/view-window-state.ts MapTimeState path, mode, colors · strings.ts map.pathPick, pathPickTitle, pathPickPlaceholder, pathPickRecent, pathPickOnMap, pathPickNone, pathChip, pathChange, pathClear, pathFromPage, pathThisPerson, pathBackToPage, pathGoal, pathGoalEnd, pathTargetNoPlace, pathNoAncestors, pathOtherPerson, linesCut, linesCutWhy, missingDate, missingPlace, missingBoth · app 388e5a87, b01693bc, 5853882e, 34e82d43 (app:81f2adf0) · dirigent:prace/1113-app-mapa-rody-v-case · ZADANI_UIX_mapa-rody-v-case D3, D4 (ponechat) · spec 054 K2.1, P2 · CHANGELOG.cs.md 3.28.0 -->

<a id="A6.5.5"></a>
### A6.5.5 Line colours and the Family lines legend

The ancestors' path is coloured by family line. A family line here is the branch of one grandparent (a quarter) or
one great-grandparent (an eighth) of the chosen person, named by that person's birth surname. It is not a family
line by surname ([A4](A4-surnames-and-families.md)).

- **Limits:**
  - the quarters are father's father, father's mother, mother's father and mother's mother, in the same hues as the
    colours **Lines** in the Fan ([A6.4](#A6.4)). Each quarter also has its own line pattern (the first a solid
    line), so the family lines can be told apart with weaker colour vision too. Pairs that a weaker red–green vision
    merges differ in lightness and in pattern as well. The light and the dark appearance have their own shades;
  - an eighth has its quarter's colour, the second eighth of the same quarter a darker shade. The eighth's number
    (1–8) stands on the longest visible line of each eighth;
  - the lines from parents and grandparents are the trunk: in the text colour and wider. The parents' points have the
    trunk's colour, the grandparents' points the colour of their quarter. A point where several family lines meet
    has the colours of all of them;
  - a line from the last 10 years is wider. Older lines fade, at most to 55 %, so that the whole path is visible at
    the end;
  - the family line's surname is the birth surname of the grandparent or great-grandparent; without a surname their
    given name.
- **The Family lines legend** (on the right under the map's controls, when at least one ancestor is on the map):
  - **Quarters** · **Eighths**. **Eighths** can be chosen when the tree knows at least two eighths;
  - a family line's row: the line's pattern, the surname, the relationship and the number of ancestors on the map
    ("father's father · 12 ancestors"). With eighths the rows stand under the heading of their quarter ("1 ·
    surname"). An unknown grandparent has a row without a colour ("father's mother – unknown"). A family line none
    of whose ancestors is on the timeline (all without a date or a place) has a row muted like an unknown one, with an
    empty dashed swatch and "off the timeline" instead of the count ("father's mother · off the timeline"); it cannot
    be highlighted or pinned. The last row is **Trunk: parents and grandparents**;
  - hovering over a row highlights the family line for a moment, a click pins it and dims the others. Esc or a
    second click releases it, and so does switching between quarters and eighths;
  - under the rows stand: the first person in two branches ("↻ name (year) is in two lines: … and …."), the cut of
    a big tree ([A6.5.4](#A6.5.4)), the ancestors off the bar ("N ancestors without a date or place are not on the
    timeline." and **List ›**, the list **Ancestors not on the timeline**) and **No line colours**;
  - **No line colours** draws the whole path in one colour and hides the family lines' rows. The trunk stays wider
    and the person stays chosen;
  - **▴** (**Collapse**) folds the legend into the chip "Family lines (N)" with the family lines' colours. The map
    does not move.
- **Phone:** the legend opens as a sheet from below from the chip **Family lines (N)** above the bar, **List ›**
  too. Only one sheet is open at a time (the legend, the list, the bubble or the choice of a person). A phone held
  sideways has the chip in the top row.
- **Controls:** app: the map → **◷ Over time** → the path to a person ([A6.5.4](#A6.5.4)) → the legend **Family
  lines**.
- **Since:** app 3.28.0

<!-- zdroj: app:src/map-line-colors.ts (LINE_HUE z fan-colors.ts jako vějíř Linie, tabulka OKLCH světlý/tmavý, QUARTER_DASH, lineCap, LINE_WIDTH base 3 / fresh 4 / trunk 4.5, pathLineOpacity max(0.55, 1 − věk/60·0.45), LINE_FOCUS_DIM, pointFill, lineSwatch; hlavička: dvojice 50↔95 a 215↔320 se liší světlostí i vzorem) · src/map-lines.ts lineClassOf (gen ≤ 2 kmen), pointClassOf (rodiče kmen), branchSurname (rodné příjmení, jinak křestní), quarters/eighths · src/ui/map-path-ui.ts drawMapPathLayer (čísla osmin na nejdelší viditelné čáře, LEGEND_WIDTH) · src/ui/map-lines-legend-ui.ts mapLinesLegendHtml (eighthsOff < 2 známé osminy, řádky, neznámý, kmen, pata), mapLinesImplexText, toggleMapLineFocus, setMapLineHover, setMapLineMode (připnutí pryč), setMapLineColors, setMapLegendCollapsed, openMapLinesSheet / closeMapLinesSheets, mapLinesUndatedHtml, offTimeline (count 0: is-unknown, is-off-timeline, swatch is-empty, app caea192a) · strings.ts map.linesOffTimeline, map.linesTitle, linesChip, linesQuarters, linesEighths, linesCollapse, linesRow, linesUnknown, linesTrunk, linesOff, linesImplex, pathUndated, pathUndatedList, pathUndatedTitle, lineE8–lineE15; fan.lineFatherFather… · app 388e5a87, b01693bc, 5853882e, 8e27df4a, 34e82d43 (app:81f2adf0) · spec 054 K1.1, K1.2 · CHANGELOG.cs.md 3.28.0 -->

<a id="A6.5.6"></a>
### A6.5.6 Playing the path to a person

With a chosen person, **Play** goes through the whole bar in 24 seconds, from the earliest ancestor to the chosen
person.

- **Limits:**
  - year by year, none is skipped. A year in which an ancestor or the end was added lasts five times longer than a
    year without them;
  - the playback ends at the end person. The next **Play** starts from the beginning;
  - it is paused by **Pause**, the slider, the keys ([A6.5.3](#A6.5.3)) and a mark above the slider;
  - the marks above the slider: each known quarter at the year of its earliest ancestor on the map, in the family
    line's colour ("surname: earliest ancestor year"), and the end at the end. A click on a mark jumps to its year;
  - the line under the slider says what was added last: "year · name · parent's place → place" with a swatch of the
    family line's colour, the end in bold. When several people were added in one year, it shows the end, otherwise
    the person from the closest generation. A screen reader reads the line when it changes. Without a chosen person
    there is no such line, and the sentence about places without a date stays in the status bar;
  - the map does not move during the playback. Only when nobody has moved or zoomed it since the person was chosen
    and the end is out of sight at the end, it moves to it once;
  - on a phone **▶** has no text and the bar is in one row.
- **Controls:** app: the map → **◷ Over time** → the path to a person ([A6.5.4](#A6.5.4)) → **Play**.
- **Since:** app 3.28.0

<!-- zdroj: app:src/map-lines.ts pathPlaySchedule (PATH_PLAY_MS 24000, PATH_EVENT_WEIGHT 5, krok rok, součet 24 000), pathAddedIn (nejbližší generace, pak rel, cíl poslední), pathLastAdded · src/ui/map-path-ui.ts playMapPath (konec u cíle), panMapToPathEnd (framed, jednou), renderMapTimeMarks (čtvrtiny podle firstYear, cíl), renderMapTimeCaption (cíl, jinak items[0]; aria-live, aria-valuetext; bez cesty skryto) · src/ui/map-ui.ts toggleMapTimePlay (na konci od začátku), setMapTimeYear (pozastaví), značky → setMapTimeYear · strings.ts map.timeMarkTitle, pathGoalEnd · app cce82a89, 34e82d43 (app:81f2adf0) · ZADANI_UIX_mapa-rody-v-case D5 (ponechat) · spec 054 K2.2 · CHANGELOG.cs.md 3.28.0 -->

<a id="A6.6"></a>
## A6.6 A family line in the view

A view can highlight one family line ([A4](A4-surnames-and-families.md)): its members fully, wives and husbands who
married into it more faintly, the others subdued. This holds in the views Family, Descendants and Fan.

- The choice is remembered for each tree on the device. A family line that is no longer in the tree is cancelled
  silently.
- When no member of the family line is drawn in the view:
  - Family and Fan move the central person to the nearest member of the family line (through parents, children and
    partners; on a tie to the older one), and when the person is not connected to one, to the founder of the family
    line;
  - Descendants always moves the central person to the founder;
  - the bar offers **↩ Back**.
- **Limits:** restoring the choice from memory does not move the central person.
- **Controls:** **Family lines** in the bar; in the person's menu **Only the … line** (the person's own family line
  by birth comes first); the end through × on the label or **Show the whole tree**.
- **Since:** app 3.21.0

<!-- zdroj: app:src/ui/rod-view.ts · src/rod-focus.ts (BFS přes rodiče, děti, partnery) · strings.ts rodView.only, rodView.whole, rodView.moved · spec 039 · CHANGELOG.cs.md 3.21.0 -->

<a id="A6.7"></a>
## A6.7 Table

The Table shows the whole tree in rows: each person, each union, each event or each source, with the facts in
columns. It serves for finding gaps, contradictions and findings of the check across the tree. It does not depend on
the depth **Ancestors** and **Descendants**. The Table view is based on a table by Ondřej Chrpa.

- **Rows:** the switch **Rows**: **People** · **Unions** · **Events** · **Sources**. Each row type has its own
  columns, filter and sort.
  - **People:** one row per person of the tree; placeholder persons (an empty place for an unknown parent) are left
    out.
  - **Unions:** one row per union that has at least one real partner. **Partner 1** is the one of the couple who is a
    blood relative of the home person; otherwise the union's first partner.
  - **Events:** one row per event of the tree ([A6.7.10](#A6.7.10)).
  - **Sources:** one row per source of the tree ([A6.7.11](#A6.7.11)).
- The **home person** is the central person of the tree ([A6.1](#A6.1)). From them the column **Relationship to home
  person** and the chip **Blood relatives** are counted: the home person's ancestors (the home person too) and all
  their descendants. Partners who came into the family by marriage are not among them.
- **Generation** 1 is the oldest generation of the tree; a partner has the generation of their partner.
- **Living** (a column, the value “living”) is counted as for the privacy of living people
  ([A7.1](A7-book-pages-and-export.md#A7.1)).
- Above the table are the count (“42 of 120 people”) and the sort (“Sort: …”). The field **Search person...** in the
  bar selects the person's row in the table and scrolls to it; the central person does not change.
- **The central person between views:** after a switch to the Table the central person's row is the active row and
  the table scrolls to it (a selected row that concerns them stays; when the filter or the search leaves the person
  out, there is no active row). After a switch from the Table the central person is the person of the active row: for
  a union the partner who already is the central person, otherwise **Partner 1**; for an event the central person
  when they are among its people, otherwise the first person; a source row does not change the central person.
- **Limits:**
  - highlighting a family line ([A6.6](#A6.6)) is not used in the table; a family line can be chosen with the chip
    **Family line** ([A6.7.6](#A6.7.6));
  - the research's columns, chips and views are only in a tree from the research ([A6.7.14](#A6.7.14));
  - a read-only tree (a followed tree, a tree saved by a newer version of the app, a locked tree) the table only
    shows: “Read only: edits and “Not an error” are not available here.” Browsing, filter, sort and CSV and XLSX
    export work; a view cannot be saved, renamed or deleted;
  - the arrows **↩ ↪** in the bottom left corner (the previous and the next central person) and Alt+← / Alt+→ are not
    in the Table: the table neither shows the central person nor changes it while working.
- **Controls:** **Table** in the view bar (after **Map**); on a phone, a tablet and in a window up to 1024 px **Table**
  on the bottom bar ([A9.5](A9-using-the-app.md#A9.5); up to app 3.27.0 **More → View → Table**).
  The view is remembered like the others ([A6.1.1](#A6.1.1)).
- **Since:** app 3.27.0

<!-- zdroj: app:src/ui/table-view/table-model.ts ROW_TYPES, buildTableModel (isPlaceholder ven, svazek aspoň s jedním skutečným partnerem), bloodOf (předci hlavní osoby a všichni jejich potomci), makeContext (homeId, isLivingPerson) · table-columns.ts unionPartners (pokrevní partner jako Partner 1), gen (assignGenerations + 1), kin (findRelationship, kinSelf) · src/ui/table-view/table-ui.ts tableReadOnly (isReadOnly: viewMode, isLocked, isNewerData) · src/data.ts:655 isReadOnly · src/ui/bottom-sheet.ts:443 (do 3.27.0 Více → Pohled: Vějíř, Mapa, Tabulka; od 3.28.0 app:4b1373a7 index.html bb-view-table, commit bb5e4d12) · table-bar.ts countText, sortText · perf-budget test 5 000 osob · strings.ts viewModeSwitch.table, table.rows, rowType, rowTypeNote, countOf, sortedBy, readOnly, readOnlyShort · commity c34c47ff, 1b72e6d8 · spec 073 U2 · Události a Prameny (spec 073 U3 P2, K5.1–K5.4): commity 8de751c2, 63ed9def, 1a3a49f1, 3cf69ffa, strings.ts table.rows.events, rows.sources, perf-budget 5 000 osob (Události) a 2 000 pramenů · poděkování: Milan 10. 11. (dirigent:prace/1110-doc-tabulka, bod 4) · CHANGELOG.cs.md 3.27.0 · dirigent:prace/1110-app-tabulka-p1 · Žijící: strings.ts table.col.living, table.living (commit 7e648e24) · ústřední osoba mezi pohledy: commit 75de3a9b (T54 F1) · ↩ ↪ a Alt+šipky v Tabulce skryté: commity 79764eba, b1cbe546 (T54 G14) -->

<a id="A6.7.1"></a>
### A6.7.1 Unions in the People table

A person with two or more unions has a row of their own in the People table and under it a sub-row for each union
(“Union 2 of 3”). The person's row has a count in the column **Partner** (“3 unions”) and the other union columns
empty.

- Unions follow the order of marriages as in the tree ([A6.4](#A6.4)): **Union 1** is the one with the mark “1. ∞”
  on the card. A union without a wedding date is placed by the latest the wedding can have been (the earlier of a
  divorce and the birth of the first child); a union without these dates comes after the others. On a tie, the order
  of the person's unions in the data decides. An empty stand-in family (“?”) goes last in the order of entry.
- **Collapsed:** the person's row shows the first union and the number of the others. The default is expanded; the
  built-in view **Gaps** has the unions collapsed.
- **A filter in a union column** is judged for each union separately. The person stays when at least one union
  matches; the others are hidden under the row “2 unions outside the filter · show”. Those shown are dimmed until the next
  change of the filter.
- **Sorting by a union column** takes the first union that matches the filter.
- A person with one union has its facts directly in their own row.
- A union sub-row carries only the findings of its union. The person's findings (such as the mother's age at the
  birth) and the strips of collapsed groups stay in the person's row.
- **Controls:** **Expand unions** / **Collapse unions** (on a phone in the menu **⋯**); the keys → and ← in the
  column **Full name**, * for all people; the row menu. The state is saved with the view ([A6.7.7](#A6.7.7)).

<!-- zdroj: app:src/ui/table-view/table-subrows.ts defaultUnionCollapse (collapsed: false), isExpanded, setAllExpanded, passingUnions, personPassesUnions, sortUnionOf, buildLines · table-model.ts unionsInMarriageOrder (marriagesInOrder z src/marriage-order.ts: Svazek 1 = „1. ∞“; bez data sňatku podle rozvodu nebo prvního dítěte; shoda podle seznamu partnerships osoby; zástupné rodiny „?“ za nimi v pořadí dat; commit 2e0346f9, T13) · table-views.ts BUILTIN_VIEWS gaps (unions collapsed) · strings.ts table.unionsN, unionKofN, hiddenUnions, expandAll, collapseAll · commity 8833da14, 8192621d · nálezy podřádku: commit 75de3a9b (T54 F6) -->

<a id="A6.7.2"></a>
### A6.7.2 Columns

The columns are in groups. Which are visible and in what order is part of the view ([A6.7.7](#A6.7.7)).

| Rows | Groups of columns |
|---|---|
| **People** | **Person** · **Birth and baptism** · **Parents** · **Unions** · **Divorce** · **Death and burial** · **Events** · **Sources** · **Reliability and research** · **Checks** |
| **Unions** | **Couple** · **Marriage** · **Divorce** · **Children and sources** |

- **Full name** (for unions **Partner 1**) is always pinned on the left; it cannot be unpinned or hidden. It sorts
  by surname, then by given name.
  It is made of the parts of the name, so there is a separate column **First name** (hidden by default) that can be
  edited in the cell ([A6.7.15](#A6.7.15)).
  **Surname** is the married surname, otherwise the birth surname; **Birth surname** is the recorded surname.
- **Research ID** shows only the person's number from the research (P…). **Ref. number** is the person's
  reference number (REFN) as the GEDCOM file brought it (and as it goes back into one); it sorts and filters as text.
- **Open question**, **⇄ In another tree** (the trees on this device the person is in) and **Person status** (the mark
  of documentation and reliability from the card, in words; sorted from the strongest; from app 3.27.0 by the reliability of the
  citations, [S7.2](S7-reliability-and-verification.md#S7.2)) are in every tree. The group
  **Research** is only in a tree from the research ([A6.7.14](#A6.7.14)).
- **Events** (**Occupation**, **Residence**, **Religion**, **Military service**, **Emigration**, **Education**) show
  each value once, the newest first.
- The columns **… reliability** and **Research certainty** have a value only in a tree from the research
  ([S7](S7-reliability-and-verification.md)).
- The columns **First name**, **Ref. number**, **Open question**, **⇄ In another tree** and **Person status** are hidden by
  default.
- **Limits:** a collapsed group is a narrow strip; it shows the highest level of a finding in its cells. On a phone
  the pinned name is narrower and the header can only be read, not changed.
- **Controls:**
  - the panel **Columns** (“12 of 58”): **Find a column**, groups with the checkbox **all**, dragging the order,
    **Coverage row**, **Reset to default**, **Done**;
  - the menu in a column header: **Sort ascending**, **Sort descending**, **Add to sort** (Shift + click),
    **Filter…**, **Pin left** / **Unpin**, **Move left** / **Move right**, **Hide column**,
    **Collapse group …** / **Expand group …**; at a computed column “Computed from: …”;
  - the column width by dragging the edge of the header.
- **Order of the columns:**
  - in the pinned part any pinned column can be moved to any place among the pinned ones, **Full name** too (it
    need not be first);
  - outside the pinned part a column moves only within its group;
  - a move that cannot be made is not offered: the header menu leaves out **Move left** or **Move right**, the panel
    **Columns** the arrow ↑ or ↓.
- **From app 3.28.0:** pinned columns in any order. Up to 3.27.0 **Full name** was always first and could not be
  moved, pinned columns moved only within their group, and a move that could not be made was greyed out.

<!-- zdroj: app:4b1373a7 src/ui/table-view/table-state.ts normalizeColumns (zamčený sloupec ukotvený, kdekoli v ukotvené části), columnRun (ukotvená část: [0, pinned − 1]; mimo ni skupina), canMoveColumn, moveColumnBy · table-headmenu.ts headMenuItems (moveLeft/moveRight jen canMove; Skrýt ne u zamčeného; Uvolnit ne u zamčeného) · table-colpanel.ts (šipka jen pro možný posun) · commit 19dbb595 (dřív columnRun locked = 1, disabled/aria-disabled) · dirigent:spec/082-tester-3.28 K2.1 -->
<!-- zdroj: app:src/ui/table-view/table-columns.ts PERSON_GROUPS, UNION_GROUPS, katalog sloupců (surname marriedSurname || lastName, birthSurname lastName, researchId /^P\d{1,7}$/, eventValues nejnovější první, sortKey jména), pinnedWidth 156 na telefonu · table-state.ts MIN_COLUMN_WIDTH, BAND_WIDTH, lockedColumn · table-checks.ts bandSeverity · table-colpanel.ts panelGroups · table-headmenu.ts headMenuItems · strings.ts table.group.*, col.*, columns, columnsCount, searchColumn, all, pinnedLabel, resetColumns, done, coverageRow, sortAsc, sortDesc, sortAdd, sortAddHint, filterColumn, pin, unpin, moveLeft, moveRight, hide, collapseGroup, expandGroup, computedFrom · commity 89602f35, 49b96d92, e4a35406 · refn (skupina person, textCell p.refn; commit 7e648e24, T54 F3), question, crossTree (crossTreeCell), personStatus (personStatusCell, cardStatus, CARD_STATUS_CLASSES), strings.ts table.col.refn, question, crossTree, personStatus · „Celé jméno“ (id `name`) a sloupec firstName, záhlaví „Ref. číslo“ bez „(REFN)“: commity 79764eba, 8fdf52ca (T54 G10, G3) -->

<a id="A6.7.3"></a>
### A6.7.3 Computed and substitute values

What is not written in the tree but can be counted from the data, the table computes. It writes nothing into the tree.

| Value | How it is counted |
|---|---|
| age (at a child's birth, at marriage, at death) | from dates with a day exactly (“67”); from a year, month or range as a range (“28–29”); from a date with abt., bef. or aft. as an estimate (“≈ 67”) |
| substitute date and place | without a birth the baptism (“bap. 3 May 1850”), without a death the burial (“bur. …”); an age from them is an estimate (≈) |
| **Recorded age difference** | by how many years the recorded age is outside the range of the age from the dates (“+3”, “−2”); an age in words and an age with abt., bef., aft. is not compared |
| **Length of union** | from the marriage to the divorce, otherwise to the first death of the couple |
| **Birth order**, **Siblings**, **Children**, **Number of unions**, **Sources** | from the links and sources of the tree |

- Dates have the word of precision before them (**abt.**, **bef.**, **aft.**). An uncertain date is underlined with
  dots; it is not a finding. A date sorts by its start.
- **Limits:** an age is not counted when the end comes before the start. The death columns have **Does not apply**
  for a living person (for **Death completeness** “living”). **Father’s/Mother’s age at birth** without a recorded
  parent is **Does not apply**.
- **Controls:** the hint at a cell (“Baptism, birth unknown”, “Burial, death unknown”); at a computed column in the
  header menu “Computed from: …”; the legend **Marks** ([A6.7.13](#A6.7.13)).

<!-- zdroj: app:src/ui/table-view/table-columns.ts ageCell (přesně / rozsah ageRangeBetween / ≈ approxAgeBetween; nic, když konec před začátkem), dateCell, qualifierWord, birthOrBaptism, deathOrBurial (náhrada, ≈), gapCell (recordedAgeGap), unionLength, naCell, parentsOf · src/dates.ts:448 ageRangeBetween, recordedAgeGap · table-model.ts dateNumber (začátek rozsahu) · strings.ts table.na, living, subst.*, qual.*, computedFrom, from.* · commit 8833da14 -->

<a id="A6.7.4"></a>
### A6.7.4 Completeness and the coverage row

The columns **… completeness** say how many of the tracked fields are filled in, in percent.

| Column | Counted from |
|---|---|
| **Birth completeness** | date, place, father, mother, source |
| **Union completeness** | date, place, partner, marriage source; for a union without a wedding (**Partners**, **Separated**) only the partner |
| **Death completeness** | date, place, source (not for a living person) |
| **Overall completeness** | birth, each union and death, weighted by the number of fields |

- A substitute value (baptism, burial) does not fill a field. The hint at a cell lists what is missing (“missing:
  birth place, birth source”).
- The **Coverage row** under the header shows for each column what percentage of the rows has a value (“filled
  64 %”, hint “77 of 120”). The word “filled” stands in the first column, whichever it is (from app 3.28.0; before in
  the name column), in the XLSX export too. Under the columns **… completeness** it shows the average completeness of the rows (hint
  “average of 120”). It counts only the rows visible at the moment (after the filter and the search). Cells
  **Does not apply** are not counted; for union columns the unions that match the filter are counted. Under 50 % the
  number is bold; without a cell it would concern, it is “–”.
- **A union without a wedding** (type **Partners** or **Separated**): the empty cells of the wedding (date, place, the
  age and recorded age of both, the recorded age difference, witnesses, **Marriage reliability**) have “–” with the hint
  “Does not apply: a union without a wedding” and are counted neither in the coverage row nor in the completeness. A
  value that is there anyway (the start of the relationship from the union form) is shown as before.
- **Controls:** **Coverage row** in the panel **Columns** (on a phone in **⋯**); it is saved with the view.

<!-- zdroj: app:src/ui/table-view/table-columns.ts compCell, unionComp (pole a váhy, náhrada nevyplní) · table-coverage.ts cellFilled, columnCoverage, coverageCell, coverageLabel (LOW pod 50 %) · table-subrows.ts coverageUnionsOf · strings.ts table.compList.*, compField.*, missing, missingNone, compCounts, coverage, coverageOf · rozhodnutí Milan 10. 11. (spec 073, bod 5) · commit 8833da14 · průměr u sloupců úplnosti (kind percent): table-coverage.ts columnCoverage average, strings.ts table.coverageAverage, i XLSX, commit 56f3418c (T54 G12) · „vyplněno“ v prvním sloupci: app:4b1373a7 table-ui.ts coverageOf (firstId), table-xlsx.ts labelAt, commit 19dbb595 · svazek bez sňatku: table-columns.ts unionWithoutWedding (partners, separated), weddingCell, oneUnionFields (jen partner), strings.ts table.naNoWedding, compList.unionNoWedding, commit 8fdf52ca (T54 G5, MILAN.md rozhodnutí 21) -->

<a id="A6.7.5"></a>
### A6.7.5 Findings of the check in the cells

The table shows the findings of Data quality ([A5](A5-tree-check.md)) right at the fact they concern: the cell is
shaded and has a mark of the level. The check runs over the whole tree in the background when the app is idle.

| Level | Mark in the legend |
|---|---|
| **error** | “The facts contradict each other.” |
| **to check** | “An unusual value worth checking.” |
| **lead** | “A lead for the research, not an error.” |
| **unusual** (☆) | “A finding marked “Not an error”.” |

- A finding goes into the cell of its fact: a parent's age at birth into **Father’s/Mother’s age at birth** at the
  child, a finding about a marriage into the age and date of marriage, a recorded age into the recorded age and its
  difference, a death before birth into both dates and the age, an event into the event's column, the age difference
  of partners into the partner, a possible duplicate into the name, the spelling of a place into the cells with that
  place. A finding without a cell of its own is only in the check columns.
- The columns of the group **Checks**: **Findings** (the count; “…” while the check runs), **Highest level**,
  **Unusual, checked** (the number of findings marked **Not an error**).
- A finding marked **Not an error** ([A5.7](A5-tree-check.md#A5.7)) stays in the cell as **unusual** (“Unusual, but
  checked”) and is not counted among the findings.
- **Limits:** a read-only tree does not allow marking a finding (“The tree is read-only: findings cannot be
  marked.”).
- **Controls:** a click on the mark opens a bubble (on a phone a bottom panel): the level, the text of the finding,
  “Finding 1 of 2” and
  - **Not an error** (the notice “Marked: not an error” with **Undo**); for an unusual one **Report again**;
  - **Data quality ›** opens the Data quality dialog at the group of this finding; for an unusual one at the list of
    marked findings.

  The cells **Findings** and **Highest level** open the list of all the person's findings (click, Enter, tap; on a
  phone a bottom panel): for each the level, the text and whom or what it concerns; reported ones by level, those
  marked **Not an error** at the end.

  The legend **Marks** (“Marks in the cells”) also explains the uncertain date, reliability, a substitute value, a
  computed value and **Does not apply**. What each mark looks like: [A6.7.13](#A6.7.13).

<!-- zdroj: app:src/ui/table-view/table-checks.ts severityRank, parentAgeColumn, issueTargets (mapování nálezů na buňky), buildCheckIndex, CHECK_COLUMNS, applyChecks · table-ui.ts whenIdle (validateTreeData jednou), cellFindings · table-bubble.ts bubbleHeading, bubbleHtml, legendHtml, openBubblePanel, sheetElement · src/ui/tree-stats.ts showTreeValidationDialog (focus: skupina otevřená a posunutá; označené → seznam) · strings.ts table.sev.*, unusualChecked, notError, reReport, toQuality, dismissedToast, roNote, checksRunning, findingOf, legend, legendTitle, legendKind.*, legendText.* · commity 19cf28ea, e530019b, 59a8eed0 · seznam nálezů osoby z buněk Nálezy a Nejvyšší úroveň: commit 75de3a9b (T54 F5) -->

<a id="A6.7.6"></a>
### A6.7.6 Filter, search and sort

The filter chooses the rows, the search narrows them further, the sort sets the order.

- **Chips** of the People table (unions have no chips, events and sources have their own, [A6.7.10](#A6.7.10),
  [A6.7.11](#A6.7.11)): **Living**, **Deceased** (they exclude each other), **Blood relatives**, **Family
  line** (a choice of family lines), **Generation** (a range), **Several unions**, **No birth date**, **Uncertain
  date** (birth or death), **No source**, **With findings** (error or to check; not a lead), **Unusual**,
  **Unconfirmed research** (only a tree from the research). The finding chips wait for the check (“Once the checks
  finish”). What does not fit is in **More (n)**.
- **A filter in a column** (**Filter…** in the header) by the kind of column:
  - values from a list (sex, union status, level of a finding, family line …);
  - a range **from**–**to** (for a date **Year**, for an age, count and percentage a number);
  - text: **contains** · **starts with** · **is** · **is not** (regardless of letter case and diacritics; the chip
    “Column = value ×” or “Column ≠ value ×”; quickly from the cell menu, [A6.7.15](#A6.7.15));
  - for each **Only empty** · **Only filled**.
- All filters apply at once. The number of filters is on **Filters (n)**, **Clear filters** cancels all. Without a
  row: “Nothing matches the filter”.
- **Search the table:** from 2 characters, regardless of letter case and diacritics, in the visible columns and in the
  union sub-rows too; matches are highlighted, their number is above the table.
- **Sort:** a click on a header sorts ascending, another click descending, a third cancels the sort; it sorts only by
  that column. Shift + click adds the column as a further key (another click turns it, a third removes it). The arrow
  ↑ ↓ at the header has the number of the key's order. Empty values are always at the end, in both directions.
  Numbers in text sort as numbers.
- **Limits:** the search is not saved into the view ([A6.7.7](#A6.7.7)).

<!-- zdroj: app:src/ui/table-view/table-filter.ts CHIP_ORDER, setChip (Žijící × Zemřelí), personPassesChip (finding: chyba nebo k ověření; unusual; unconfirmed jen researchTree, relN/relB/relD), CHECK_CHIPS, rodChoices, generationSpan, filterKindOf, cellPasses, foldText · table-filterbar.ts SEARCH_DELAY_MS, columnFilterForm, chipChoiceForm · table-state.ts řazení (vzestupně → sestupně → vypnuto; Shift přidá, otočí, odebere; prázdné na konci; Intl.Collator numeric) · strings.ts table.chip.*, chipRod, chipGen, moreN, filters, clearFilters, search, matches, noMatch, checksWait, matchContains, matchStarts, rangeFrom, rangeTo, rangeYears, onlyEmpty, onlyFilled · commity dd1d74bc, e64b8b06, fc746037 · je / není: strings.ts table.matchEquals, matchNotEquals (commit 05d9a9ab, T54 F4) -->

<a id="A6.7.7"></a>
### A6.7.7 Table views

A view is a saved setting of the table under a name. The built-in views are ready readings of the tree; a person
saves a custom view.

| Built-in view | Rows | What it shows |
|---|---|---|
| **Overview** (default for people) | people | name, date and place of birth, date of death, age at death, partner, date of marriage and age at it, findings, overall completeness; sorted by date of birth |
| **Births and parents** | people | birth and baptism, parents, their age at the birth, birth completeness; sorted by date of birth |
| **Marriages** (default for unions) | unions | the couple, date and place of marriage, age and recorded age of both, status, witnesses, divorce, children, length, sources, completeness; sorted by date of marriage |
| **Deaths** | people | death, cause, burial, age and recorded age at death, death completeness; the chip **Deceased**; sorted by date of death |
| **Sources and citations** | people | number of sources, documentation, reliability of birth and death; from the fewest sources |
| **Gaps** | people | completeness overall and by parts, birth, parents, sources; from the least complete; unions collapsed |
| **Checks** | people | level and number of findings, dates, the parents' age, marriage; the chip **With findings**; from the highest level, then the number of findings |
| **All events** (default for events) | events | type, person or couple, date, place, age at the event, godparents, witnesses, officiant, source; sorted by date |
| **All sources** (default for sources) | sources | title, archive, book and reference, online, people, facts, read by the research, transcript; sorted by title |

- **A view saves:** the row type, the columns (order, widths, pinning, collapsed groups), the coverage row, the
  filter, the sort and the expanding of unions. It does not save the search, the selected row or the scroll.
- A changed view has the label **changed** and the options **Save**, **Save as new**, **Discard changes**. A built-in
  view does not change and cannot be renamed or deleted; its changes can only go **Save as new**. A custom view:
  **Rename…**, **Delete** (with a confirmation). Custom views are sorted by name.
- The table's work in progress is remembered by the app for each tree on this device; after the page is reloaded or
  the app is updated, the table is as it was left. It includes the unsaved changes of every view, also of one switched
  away from: back in it, the view still has the label **changed**. **Save**, **Save as new** and **Discard changes**
  settle them. A damaged part of the work in progress is left out.
- **Saved views are part of the tree** (data version 17): saving, renaming and deleting have a step back and an entry
  in the change history. They go with the tree into the backup (JSON) and, when a part of the tree is separated, into
  the new tree too. GEDCOM does not carry them; a tree from the research keeps them when a new version is loaded.
  A damaged view is left out when loading.
- **Limits:** an older app (from 3.19.0) opens a tree saved by app 3.27.0 read-only and never saves it; after the app
  is updated the tree can be changed again.
- **Controls:** the menu **View** in the table's bar (**Built-in**, **Custom**, **Save as new…**, **Rename…**,
  **Delete**).

<!-- zdroj: app:src/ui/table-view/table-views.ts BUILTIN_VIEWS (9: overview, births, marriages, deaths, sources, gaps, checks, events, allSources), defaultViewId (události → Všechny události, prameny → Všechny prameny), defaultViewId, viewFromState, viewChanged, uniqueViewName, customViews (podle jména), workStorageKey strom.table.{treeId}, readTableWork, writeTableWork · table-columns.ts výchozí sloupce pohledů (:683 Sňatky, DEFAULT_VIEWS.events, .sources) · src/table-views-data.ts sanitizeTableView, keepTableViews (verze z výzkumu ponechá pohledy) · src/data.ts:298 sanitizeTableViews při načtení, :1720 saveTableView, deleteTableView (krok zpět, historie změn) · src/subtree.ts:148 · src/types.ts STROM_DATA_VERSION 17, StromData.tableViews · src/tree-manager.ts:630 isTreeNewer, src/data.ts:649 isNewerData (jen ke čtení, od aplikace 3.19.0) · src/ui/research-ui.ts, conflict-decide-ui.ts keepTableViews · strings.ts table.view, views.*, viewName.* (events, allSources), changed, save, saveAs, discard, builtinNote, saveAsMenu, renameMenu, deleteMenu, builtinLocked, viewWhat, deleteConfirm · commity d19a5942, c2d48747, 8ca649ff · neuložené změny všech pohledů v pracovním stavu (localStorage) se sanitizací: commit b1cbe546 (T54 G9, varianta c) -->

<a id="A6.7.8"></a>
### A6.7.8 Row actions and edits

A click selects a row (a union sub-row too); the arrows, Page Up/Down and Ctrl+Home/End move the selection, Esc
cancels it.

| Action | What it does |
|---|---|
| **Show in tree** | switches to the Family view with the person as the central person, centred and highlighted |
| **Open person** (Enter) | opens the person's page |
| **Edit…** (double click) | opens editing of the person; at a union sub-row and in the Unions table the person's relationships on that union |

- In the Unions table the actions concern the person **Partner 1**.
- In the Events table they concern the first person of the row and **Edit…** opens editing of that event
  ([A6.7.10](#A6.7.10)); in the Sources table there is **Open source** ([A6.7.11](#A6.7.11)).
- After an edit the notice “Saved: …”, the row flashes briefly and the rows keep their order. A row that no longer
  matches the filter stays with the label “no longer matches” until the next change of the sort, filter or view.
  A change from the research is announced by “Research changed 3 facts: …”.
- One fact can also be edited right in the cell ([A6.7.15](#A6.7.15)).
- **Limits:** in a read-only tree there is no **Edit…**.
- **Controls:** the buttons ⌖ ▤ ✎ at the row's end, over no cell's text: with a mouse they show once the pointer has
  been on the row away from them, on the selected row also with the pointer elsewhere; the row menu (right button;
  expanding unions too). A finger's tap on a row (a phone, a narrow window, a device worked mainly by touch) opens a
  panel with the actions and the unions (“Union 1: … · Edit ›”).
- **From app 3.28.0:** a click with a mouse or a pen only selects the row and the cell on every device, also on a
  laptop with a touch screen, a tablet with a mouse and in a narrow window; the click's pointer decides, not the
  device. Up to 3.27.0 every click opened the row panel on a touch device and in a narrow window. The row's actions
  stand at its end, so the persons' column keeps its whole width on the selected row.

<!-- zdroj: app:src/ui/table-view/table-ui.ts tableMethods (tableRowAction: tree → Rodina, focus, highlight; open; edit → dialog osoby / panel vztahů na svazku), personOfRow (Partner 1), keepWork · table-refresh.ts keepOrder, watchEdit, changedKeys, bridgeChanges, namesList · table-grid.ts FLASH_MS · strings.ts table.act.*, dblClickHint, actionsOf, unionWith, editMore, staleRow, savedToast, bridgeToast · commity da6b9786, de46ae30, e4a35406 · od 3.28.0: table-grid.ts clickPointerType, isMouseLikePointer, table-ui.ts onRowClick (panel jen klepnutí a isPhoneBar | isCoarsePointer), commit ee38c7a6; rowActions ⌖ ▤ ✎ v .tv-acts-dock, armRowActions (myš a pero), commit 80c2ffb9 -->

<a id="A6.7.9"></a>
### A6.7.9 CSV and XLSX export

The export saves the table as it is seen into a file for spreadsheet programs: **CSV** or **XLSX** (an Excel
workbook).

- **What goes out:** the visible columns in the table's order (the columns of a collapsed group whole) and the rows
  after the filter, search and sort. The values are as the table writes them: dates in the app's notation,
  “abt. …”, “≈ 67”, “bap. …”, “–”.
- **Rows:** without a filter and search all rows go out (“Everything shown · 120 people”). With a filter or search
  there is a choice:
  - **Shown** (default): only the rows the table shows, with the count and a reminder of the filter (“Shown · 28 of
    866 people (filter: …)”);
  - **All … without the filter** (“All people without the filter · 866”): all rows of that type in the order of the
    sort, without the filter and the search.

  A row with the label “no longer matches” ([A6.7.8](#A6.7.8)) does not belong among those shown.
- A person with two or more unions: the first union that matches the filter is in their row, each further one in a
  continuation row with the person's facts empty. After the name is the column **Union** (“1 of 3”).
- **CSV:** text, UTF-8 with a BOM mark, the separator a semicolon, line ends CRLF; a cell that a spreadsheet program
  would run as a formula is neutralised. The marks of findings and the colours are not exported.
- **XLSX:** one sheet named after the view.
  - Row 1 holds the groups of columns (merged cells), row 2 the header, row 3 the coverage row ([A6.7.4](#A6.7.4)).
    The table's pinned columns and these three rows are frozen in the sheet.
  - Each group of columns is an outline: it can be collapsed, its first column stays. The continuation rows of
    unions are one level lower under the person's row (level 2 of the row outline).
  - A cell with a finding **error** or **to check** is shaded and has the findings in a comment. A lead and unusual
    have neither colour nor comment.
  - Counts, ages in whole years and completeness are numbers (completeness and coverage as a percentage); the rest is
    text as the table writes it (also “≈ 67”, “28–29”, dates). Text never becomes a formula. A source's link is a
    link in the cell.
- **File:** `{tree}_{view}_{YYYY-MM-DD}.csv` or `.xlsx`, without diacritics.
- **Controls:** **Export ▾** in the table's bar (on a phone in **⋯**): **Format** “CSV · for Excel and Google Sheets”
  or “XLSX · groups, frozen panes, check colours”, **Rows**, **Download CSV** / **Download XLSX**; the notice
  “Downloaded: …” with the number of people, rows and columns.
- **Limits:** the export from the tree menu (**Person table (CSV)**, [A7](A7-book-pages-and-export.md)) is a different
  file with fixed columns.
- **Since:** app 3.27.0

<!-- zdroj: app:src/ui/table-view/table-export.ts tableCsvField (neutralizace vzorců), buildExportTable, buildTableCsv (BOM, ;, CRLF, pokračovací řádky, sloupec Svazek), fileNamePart, tableCsvFileName (csv | xlsx) · table-xlsx.ts buildTableXlsx (řádky 1–3, merges, outline sloupců za ukotvenou částí, pokračovací řádky outline 1, freeze, errorFill/warningFill + findingsComment jen chyba a k ověření, href), xlsxNumber (COUNT_COLUMNS, věk ^\d+$, procento) · src/xlsx.ts (ignoredErrors numberStoredAsText, styl @ pro text) · table-viewbar.ts exportForm (Formát, Řádky: Zobrazené / Všechny bez filtru jen s filtrem nebo hledáním) · table-ui.ts tableExportNow (unfiltered: všechny řádky typu v řazení, stale ven) · strings.ts table.export, exportFormat, exportRows, exportCsv, exportXlsx, exportAll, exportShown, exportFilterNote, exportUnfiltered.*, exportWhat.*, exportWhatAll.*, exportFile, exportDownload, exportDownloadXlsx, csvUnionCol, csvUnionOf, exportedToast · commity 2368683b, 5a67797b, 4308633b, e0ce4ec2, ebc1542f, e5b97725 · dirigent:prace/1110-app-tabulka-p2, 1110-app-tabulka-opravy -->

<a id="A6.7.10"></a>
### A6.7.10 Events in rows

The Events table has a row for each event of the tree: who, when, where, at what age and who was present.

- **What a row is:**
  - each event of a person (baptism, occupation, residence, military service …) and each event of a couple;
  - birth and death from the person's facts, when something is recorded for them (date, place, address, source; for
    a death also the cause or the age);
  - the marriage of a union: for a marriage always, for another relationship (“Start of the relationship”) only with
    a recorded fact; the divorce (“End of the relationship”), when the union is divorced or its end is recorded.
- **A shared event** (residence, census, military service, emigration, immigration, naturalization, a custom event) recorded
  the same way at several people is one row with all those people. The same way means the same type, date, place,
  address, note and sources; the date must be recorded, and with it a place or a source. A baptism, occupation or
  title always belongs to one person only.
- **From app 3.28.0:**
  - a shared event ([A10.1](A10-shared-events.md#A10.1)) is one row with all its people, even when its copies
    differ. Same copies without a shared event (older data) are still joined into one row by their details; that is
    only a view, an edit goes to one copy;
  - the people cell has a count (“N people”). Age shows each person's age (“42 · 38”) with the tooltip “Age as
    recorded · per person”; when the copies differ, the cell has “differs for N”
    ([A10.3](A10-shared-events.md#A10.3));
  - editing **Date** or **Place** right in the cell changes all copies of the shared event (“{Field}: changed for N
    people ({event}).”), one **Undo** step.
- **Columns** in the groups **Event** · **Participants** · **Source**:
  - **Type**, **Person or couple** (for a couple the blood relative of the home person first), **Date**, **Place**;
  - **Age at the event** as elsewhere ([A6.7.3](#A6.7.3)); up to one year, from exact dates, in days (“12 d”); for
    several people the age of each in the order of the names (“–” unknown); for a birth **Does not apply**;
  - **Value**: the value of the event (occupation, title), otherwise the cause; for a death the cause of death;
  - **Godparents**, **Witnesses**, **Officiant**, **Others present**: the participants by role; a person of the tree
    is a link;
  - **Source**: the cited sources “title, reference”, several separated by a semicolon; **Reliability** of the fact.
- **Chips:** **Births and baptisms** (also births from the person's facts), **Marriages** (also engagements, banns,
  licences, a contract), **Deaths and burials** (also cremations), **Other events**, **No source**.
- **Filter by participant:** a click on a participant's name offers “Filter: godparent …” (for a person of the tree
  also **Open person**). The filter is the chip “Godparent: … ×” (Witness, Officiant, Present) and replaces the
  previous participant filter. A person of the tree is looked for by the person, a written name by its letters
  regardless of case, diacritics and spaces.
- **A godparent who keeps turning up** ([A5.5](A5-tree-check.md#A5.5)) is in the participant's cell as a **lead**.
- **Controls:** the built-in view **All events**; the row actions ([A6.7.8](#A6.7.8)) concern the first person of
  the row. **Edit…** opens, for an event of a person, editing of the person at that event (for a shared one at the
  first copy), for a birth and death editing of the person, for an event of a couple its dialog, for a marriage and
  divorce the person's relationships on that union.
- **Limits:** placeholder persons have no rows; a birth and death without a recorded fact have no row.
- **Since:** app 3.27.0; 3.28.0: a census at a person is a shared event, a shared event is one row

<!-- zdroj: app:src/ui/table-view/table-events.ts buildEventRows (narození/úmrtí jen se zapsaným údajem, weddingRow: manželství vždy kromě marriageUnrecorded, partnersStart jen se zápisem; divorceRow), SHARED_TYPES (od 3.28.0 i census, app:34b2174c), shareKey (typ, vlastní název, datum, místo, adresa, poznámka, prameny; datum a místo nebo pramen), mergeParticipants, eventEditTarget, MARRIAGE_COUPLE_TYPES · table-columns.ts EVENT_COLUMNS, eventPersons (pokrevní první), eventAgeCell, eventAge (dny < 366), eventValueCell, eventSourceCell, eventPill, DEFAULT_VIEWS.events · table-filter.ts EVENT_CHIP_ORDER, EVENT_KIND_CHIPS, lifeCategory, participantChip, eventHasParticipant (foldName), setParticipantFilter · table-ui.ts tableNameAction, tableRowAction (event → editTableEvent) · table-checks.ts PARTICIPANT_ROLE, recurring (recurringGodparent v buňkách účastníků) · 3.28.0: app:80c2ffb9 table-events.ts (shareId → jeden řádek, bez shareId odhad podle shareKey), strings.ts table agePerPerson, sharedDiffers, events.sharedCellChanged · strings.ts table.rows.events, group.event, participants, source, col.ev*, godparents, witnesses, officiants, others, chip.ev*, chipParticipant.*, filterParticipant.*, evKind.*, ageDays, viewName.events · commity 8de751c2, 63ed9def · spec 073 §14.1 · dirigent:prace/1110-app-tabulka-p2 -->

<a id="A6.7.11"></a>
### A6.7.11 Sources in rows

The Sources table has a row for each source of the tree (**Actions → Sources**, [A3.1](A3-evidence-in-the-app.md#A3.1))
and tells how much the source documents in the tree.

- **Columns** in the groups **Source** · **Use**:
  - **Title**, **Archive**, **Call number**, **Folio/page**, **Image**, **Other location**
    ([A3.9](A3-evidence-in-the-app.md#A3.9)), **Online** (the address of the source, otherwise the page of its
    first excerpt, without `https://`; a web address is a link ↗ into a new window, only http and https; one written
    without a scheme (“www.…”) opens via https; a click on the link does not change the row selection);
  - **People**: how many people have a fact that cites the source; a fact of a union documents both partners;
  - **Facts**: how many facts cite the source. A fact is one list of citations: the person's citation, birth, death,
    each event of the person, marriage, divorce and each event of the couple;
  - **Read by the research**: how many readers read the transcript (“1 reader”, “2 readers”: a person in the app and
    the research), otherwise “no”;
  - **Transcript**: yes / no; the catalogue of columns also has **Record date**.
- Default columns: **Title**, **Archive**, **Call number**, **Folio/page**, **Image**, **Other location**, **Online**,
  **People**, **Facts**. **Read by the research** and **Transcript** are only in the panel **Columns**.
- An older source has its whole location in **Other location** and the new cells empty. **Call number**,
  **Folio/page** and **Image** sort naturally (9 before 10, 57–58 after 34), empty ones last in both directions; they
  filter as text.
- Above the table there can be the offer **Split as suggested…** ([A3.9.1](A3-evidence-in-the-app.md#A3.9.1)).
- Citations of placeholder persons and sources of a story are not counted.
- **Chips:** **No person** (no person cites it), **Unread**, **With transcript**, **Online** (the same as the column
  **Online**, also with an address without `https://`).
- **Controls:** the built-in view **All sources**. At a row **Open source** and **Edit…**: both open the source
  manager at that source; **Show in tree** is not here.
- **Limits:** in a locked tree the source is only shown, without edits.
- **Since:** app 3.27.0; **Call number**, **Folio/page**, **Image** and **Other location** (before, **Book, reference,
  folio**) also 3.27.0

<!-- zdroj: app:a97de984 table-columns.ts:898-901 srcSig/srcFolio/srcImageNo, :1026 DEFAULT_VIEWS.sources, přirozené řazení · 8dd21adf table-bar.ts nabídka rozdělení · app:src/ui/table-view/table-sources.ts sourceUsage (PERSON_CITATION_FIELDS, události, PARTNERSHIP_CITATION_FIELDS pro oba partnery, bez zástupných, ne příběh), buildSourceRows (katalog data.sources), sourceReaders (readBy user/research/both) · table-columns.ts SOURCE_COLUMNS, urlCell, shortUrl, readersCell, DEFAULT_VIEWS.sources · table-filter.ts SOURCE_CHIP_ORDER (srcNoPerson persons 0, srcUnread, srcTranscript, srcOnline safeHttpUrl) · table-grid.ts rowTail (source: open + edit) · table-ui.ts tableRowAction (source → openTableSource), openTableSourceId (zamčený strom → showSourceViewer readOnly) · strings.ts table.rows.sources, group.source, group.use, col.src*, chip.src*, readers, act.openSource, viewName.allSources, sources.readBy.* · commity 1a3a49f1, 3cf69ffa · spec 073 §14.2 · dirigent:prace/1110-app-tabulka-p2 · odkaz a čip Online: safeWebUrl (http/https, www. → https, rel noopener noreferrer), commit 7e648e24 (T54 F10, F11) -->

<a id="A6.7.12"></a>
### A6.7.12 Citations and godparents in the People table

The People table has columns that show from which source the birth, marriage and death come, and who was a
godparent.

- **Citations** (group **Sources**): **Birth: archive**, **Birth: call number**, **Birth: folio/page**,
  **Birth: image**, **Birth: other location**, **Birth: URL** and the same for **Marriage** and **Death**, in this
  order; they are not default. The cell shows the value of the first cited source; further sources are in the button
  “+N”. An older source has its whole location in **… other location**. The bubble **Other citations**, the row panel of a
  source on a phone and the source column in the Events table also give the call number, folio and image. A web
  address in the column **… URL** is a link into a new window, as in the column **Online** ([A6.7.11](#A6.7.11)).
  - Birth takes the citations of the birth, then of the events of birth and baptism; death the citations of the
    death, then of the events of death, burial and cremation; marriage the citations of the union (at a union sub-row
    of that union). Each source once.
  - Sources from the origin of a fact in the research are not counted, only citations in the data.
  - For a living person the death columns have **Does not apply**.
  - Sorting and filtering go by the first source.
- **From app 3.27.0:** columns of the call number, folio/page, image and other location (**… reference** showed the
  whole location before).
- **Godparents** (group **Birth and baptism**): the godparents of the events of birth and baptism, each once; a person
  of the tree is a link. A godparent who keeps turning up ([A5.5](A5-tree-check.md#A5.5)) has the mark **lead** in the
  cell.
- **Controls:** the columns are switched on one by one in the panel **Columns** ([A6.7.2](#A6.7.2)). A click on “+N”
  opens the bubble **Other citations** (on a phone a bottom panel); a click on a source opens it in the source
  manager.
- **Since:** app 3.27.0

<!-- zdroj: app:src/ui/table-view/table-sources.ts factCitations (narození: birthSourceIds + birth/baptism; úmrtí: deathSourceIds + death/burial/cremation; sňatek: sourceIds svazku; neznámé id ven, každý jednou) · table-columns.ts citeCell (první pramen, moreSources), bArch…dUrl (group sources, unionScoped, deathOnly → naCell), godparentsCell (group birth), personGodparents · table-checks.ts personRecurring (sloupec godparents) · table-grid.ts moreCitesHtml · table-ui.ts showTableCites, openTableSourceId · strings.ts table.col.bArch…dUrl (bUrl „Narození: URL“, commit 7e648e24, T54 F10); 3.27.0: a97de984 bSig/bFolio/bImage/bRef…dRef, table-bubble.ts, table-events source text, godparents, moreCites, citesTitle · commity 208d8b92, 21a132c1 · spec 073 §14.3, §14.5 · dirigent:prace/1110-app-tabulka-p2 (citace: jen citace v datech, ne FactReliability.sourceIds) -->

<a id="A6.7.13"></a>
### A6.7.13 Marks in the cells

An overview of everything the table uses to mark a cell or a row. The legend **Marks ⓘ** at the top right of the
table (the bubble “Marks in the cells”, on a phone a panel from below) shows the first two tables: the four levels
of a finding and the five kinds of value; in a tree from the research also a third, the research marks.

**Findings of the check** ([A6.7.5](#A6.7.5)). The mark stands at the end of the cell after the value; a click on a
cell with a finding opens the finding's bubble.

| Mark | What it looks like | What it means (legend) | Where it appears |
|---|---|---|---|
| **error** | a solid red circle with a white “!”; the cell tinted red | “The facts contradict each other.” | the cell of the fact the finding is about; **Findings**, **Highest level**; a collapsed group |
| **to check** | a solid amber square with rounded corners and “?”; the cell tinted amber | “An unusual value worth checking.” | as for error |
| **lead** | a small hollow grey ring; the cell not tinted | “A lead for the research, not an error.” | as for error; a godparent who recurs ([A6.7.10](#A6.7.10), [A6.7.12](#A6.7.12)) |
| **unusual** | a grey hollow star “☆”; the cell not tinted | “A finding marked “Not an error”.” | the cell of the fact; **Unusual, checked**; **Highest level** when all the person's findings are marked |

- The circle and the square differ in shape and sign, not only in colour. A screen reader reads the mark as the level
  and the text of the finding.
- **Findings** has the mark of the highest level after the number; **Highest level** has it before the word. A person
  without a finding has a faint “0” in the column **Findings**.
- A collapsed group of columns (a narrow band) shows the highest mark of its cells.

**Kinds of value.** None of them is a finding.

| Mark | What it looks like | What it means (legend) | Where it appears |
|---|---|---|---|
| **uncertain date** | the date underlined with dots; the word **abt.**, **bef.** or **aft.** in smaller grey type before the date | “About, before, after or a range; not a finding.” | date columns ([A6.7.3](#A6.7.3)) |
| **reliability** | the step's name in grey (in the legend **Confirmed**): **Confirmed**, **Proven**, **Probable**, **Possible**, **From family tree**, **Lead**, **No source** | “In the Reliability and research columns; for unions in the Marriage group, for events in the Source group.” | **Name reliability**, **Birth reliability**, **Death reliability**, **Marriage reliability** (people, unions), **Reliability** (events); the steps: [S7.1](S7-reliability-and-verification.md#S7.1) |
| **substitute** | the abbreviation **bap.** or **bur.** in a small frame before the value, the value in italics; the tooltip “Baptism, birth unknown”, “Burial, death unknown” | “A baptism for the birth, a burial for the death.” | date and place of birth and death ([A6.7.3](#A6.7.3)) |
| **computed** | grey type; “≈ 67” an estimate, “28–29” a range | “A range from an inexact date, ≈ from an estimate.” | ages, the difference of the recorded age, length of the union, counts, generation, completeness; in the header “Computed from: …” |
| **does not apply** | “–” in grey italics, the same in the legend; the tooltip “Does not apply” | “Does not apply to the person.” | death for a living person (in **Death completeness** “living”), the father's or mother's age without a recorded parent, union columns of a person without a union, the wedding's cells of a union without a wedding (hint “Does not apply: a union without a wedding”, [A6.7.4](#A6.7.4)), **Age at the event** for a birth |

- The columns **… reliability** sort from **Confirmed** to **No source** in the order of the table.

**Research marks** ([A6.7.14](#A6.7.14)), only in a tree from the research. The research circle has a rim around it,
so even without colour it differs from the error circle (no rim) and the to-check square. The legend adds: “A circle
with a rim means research. The research’s ! and ? stand only in the Research columns; a fact’s cell carries only ≠.”

| Mark | What it looks like | What it means (legend) | Where it appears |
|---|---|---|---|
| **waiting** | a solid amber circle with a rim and “!” | “The research is waiting for a decision.” | **Research**, **Awaiting decision** |
| **waiting on others** | a hollow amber ring with “!” | “An answer from outside is awaited (a letter, an archive); there is nothing to decide.” | **Research**, **Awaiting decision** |
| **conflict** | a solid amber circle with a rim and “≠” | “The sources disagree. This is not an error in the data: the question is which source to trust.” | before the value in the cell of the fact (no tint, a click opens the conflicts); **Research**, **Conflicts** |
| **question** | a solid amber circle with a rim and “?” | “An open question or a hypothesis.” | **Research**, **Hypotheses** |
| **agent** | a turning arc (with reduced motion it stands still) | “The agent is working on the person right now (only while following).” | **Research**, **Agent**; a vertical bar of 3 px at the person's name |
| **done** | “✓” | “The agent has finished its work (for 4 s).” | after the name, **Agent** |

- In the column **Research** a person in the agent's queue has a grey dot “·” with “in the queue”; “+2” after the mark
  are further kinds of signal. New from research has the dot “•” in its column.
- A column that has a value only while following the research has, without following, “–” with the label “live”
  (the tooltip “Only while following the research”). From app 3.27.0 only when the research bridge does not
  answer either ([A6.7.14](#A6.7.14)).

**Other marks** (the legend does not show them):

| Mark | What it looks like | What it means | Where it appears |
|---|---|---|---|
| “…” | three faint dots; the tooltip “Checks are running…” | the check of the tree is still running | **Findings**, **Highest level**, **Unusual, checked** |
| “◌ Checks are running…” | a hollow ring and text at the top right of the table | the same for the whole table; the finding chips wait for now | above the table, next to **Marks ⓘ** |
| a percentage with a bar | a number and a short bar whose filled part is the value | completeness ([A6.7.4](#A6.7.4)) | the columns **… completeness** |
| a bold number, “–” | in the coverage row | coverage under 50 % (under the completeness columns an average under 50 %); “–” a column with no cell it would apply to | **Coverage row** ([A6.7.4](#A6.7.4)) |
| “+2” | a number in an oval frame after the first citation | further cited sources; a click opens **Other citations** | citations of birth, marriage, death ([A6.7.12](#A6.7.12)) |
| “↗” | after an underlined web address | a link into a new window | **Online**, the citations “… URL” ([A6.7.11](#A6.7.11), [A6.7.12](#A6.7.12)) |
| cell outline | a thin outline of 1 px | the active cell ([A6.7.15](#A6.7.15)) | a cell of the selected row |
| text cursor | on hovering with the mouse | the cell can be edited in place ([A6.7.15](#A6.7.15)) | editable cells |
| ●○, ●● | one or two solid dots before “1 reader”, “2 readers”; the tooltip says who read the transcript | how many readers read the transcript | **Read by the research** ([A6.7.11](#A6.7.11)) |
| “12 d” | a number with “d” | an age under one year in days | **Age at the event** ([A6.7.10](#A6.7.10)) |
| ▾, ▸ | a triangle before the name | the person's unions expanded, collapsed ([A6.7.1](#A6.7.1)) | **Full name** of a person with two or more unions |
| “3 unions” | for a collapsed person in an oval frame after the name; for an expanded one in the column **Partner** in grey italics | the person's number of unions | the person's row |
| “└ Union 2 of 3” | an indented sub-row | one union of the person | the union sub-row |
| “2 unions outside the filter · show” | a button in an indented row | unions that do not match the filter; those shown are dimmed | under the union sub-rows |
| “no longer matches” | the whole row faint, the text in italics at the end | the row no longer matches the filter after an edit ([A6.7.8](#A6.7.8)) | until the next change of sort, filter or view |
| highlight | the matching text with a background | a match of the search ([A6.7.6](#A6.7.6)) | visible columns |
| ↑, ↓ (↑1, ↓2) | an arrow in the header, with a number for several keys | the direction and order of a sort key ([A6.7.6](#A6.7.6)) | the column header |
| −, + | a sign by the group's name | collapse, expand a group of columns ([A6.7.2](#A6.7.2)) | the row of groups above the header |

- **Limits:** the CSV export carries neither marks nor colours; XLSX carries only the tint and a comment for error and
  to check ([A6.7.9](#A6.7.9)).
- **Controls:** **Marks ⓘ** at the top right of the table.
- **Since:** app 3.27.0

<!-- zdroj: app:src/ui/table-view/table-grid.ts MARK_GLYPH (error „!“, warning „?“, info prázdný, unusual „☆“), markHtml (role img, aria-label úroveň: text), cellClasses (aggregate, na, computed, uncertain, subst, ghost, issue), cellText („–“), cellInner (značka za hodnotou; u čísla vpravo za, jinak před slovem), moreCitesHtml „+N“, cellValueCore (tv-comp proužek 30 px, tv-subst, tv-qual), linkHtml „ ↗“, readersHtml (fs-dots), nameCell (▾/▸, tv-unions-pill unionsN, └ unionKofN, hiddenUnions), sort mark ↑/↓ s číslem, tv-group-toggle −/+ · table-bubble.ts legendHtml (4 značky + uncertain „1890–1892“, reliability ✓, subst křt., computed „≈ 67“, na „–“) · table-bar.ts createStatus (◌ checksRunning, legenda „Značky ⓘ“) · table-columns.ts checksPendingCell („…“ ghost), findingsCell („0“ ghost), topSeverityCell, unusualCell (☆), pillCell + reliabilityText + RELIABILITY_RANK (human, proven, probable, possible, import, lead, none), readersCell (dots [true, n > 1]), naCell (relD, fAge, mAge, unionScoped bez svazku, evAge narození), eventAge (ageDays) · table-subrows.ts aggregate „n svazků“ · table-checks.ts bandSeverity · table-coverage.ts LOW pod 50 % · index.html CSS .tv-mark--error (kolečko 16 px, --danger), --warning (čtverec radius 3px, --warning), --info (kroužek 10 px, okraj --text-faint), --unusual, .tv-cell--error/--warning (danger-soft, warning-soft), --uncertain (dotted), --na (kurzíva), --computed, .tv-subst, .tv-cites-more, .tv-row.is-stale, .tv-stale-note, mark.tv-hit · strings.ts table.legend, legendTitle, legendKind.*, legendText.*, sev.*, subst.*, qual.*, na, living, checksRunning, moreCites, citesTitle, readers, ageDays, unionsN, unionKofN, hiddenUnions, staleRow, col.relN/relB/relD/relW/evRel, reliability.human/proven/import/none, factStatus.probable/possible/lead · app f34d41e1 · Milan 10. 11. (dirigent:prace/1110-doc-tabulka-znacky bod 1) · pořadí stupňů podle RELIABILITY_RANK (Z rodokmenu před Vodítko), dirigent:prace/_drobnosti/doc.md · značky výzkumu: table-grid.ts RESEARCH_GLYPH (wait „!“, ext „!“, conf „≠“, q „?“, agent oblouk, done „✓“, queue „·“, new „•“), researchMarkHtml, conflictMarkHtml (≠ před hodnotou) · index.html .tv-rmark--wait/conf/q (kolečko 16 px, --signal-warn, lem box-shadow), --ext (prázdný kroužek), --agent (agSpin, prefers-reduced-motion), --done, .tv-agent-bar (3 px) · strings.ts table.res.legendName, legendText, legendNote, liveTag, liveOnly · aktivní buňka a kurzor: commity 05d9a9ab, be9ca8cd · spec 073 §16.3, U7 -->

<a id="A6.7.14"></a>
### A6.7.14 The research in the Table

In a tree from the research ([S1](S1-connecting-app-and-research.md)) the table also shows what the research knows
about the people: what is awaiting a decision, conflicts of sources, hypotheses, the agent's work, the lines and the
exchange with the tree. It writes nothing into the tree.

- **Columns of people** (the group **Research**, hidden by default; the checkbox **all** switches on **Research**,
  **Awaiting decision**, **Conflicts**, **Hypotheses** and **Agent**):

  | Column | What it shows |
  |---|---|
  | **Research** | the person's most urgent signal in the order waiting › conflict › question or hypothesis › agent › in the queue; “+n” further kinds |
  | **Awaiting decision** | the count and the first item; when waiting on others “from outside: …” (letter sent, a query in the family …) |
  | **Conflicts** | the number of open conflicts and the facts (“· birth, …”); “· can be decided in the app” where that is possible ([S2](S2-edits-from-the-app.md)) |
  | **Hypotheses** | the number of open hypotheses; “decided by agent” |
  | **Research tasks** | the person's tasks in the queue (“2 · next no. 3 in the queue”, “1 · running now”) |
  | **Agent** | “working: {task}”, “in the queue”, “done” |
  | **Line** | the person's place among the lines (below) |
  | **Materials**, **Tree ends here**, **Searched, nothing found**, **Exchange with research**, **Originally in the family tree**, **Story**, **Where it is handled**, **New from research**, **Source availability**, **Parish (research)**, **Estimated birth** | what the research knows about the person's materials, about the edge of the tree, about the exchange with the tree, about sources and places |

- **Unions:** **Research ID** (F…), **Line** (by the partner from the line), **Agent** (“working on the couple: …”) and
  **Conflicts** (conflicts about the marriage and the divorce for both partners). **Sources:** **Research ID** (S…)
  and **Scan**: “on the research’s computer”, “scan missing on the research’s computer” (highlighted), “online
  (archive)”.
- **Line:** in a line (the partner of a person from the line “· partner”; a side branch added to a line belongs to
  that line), “side branch: {name}”, “island”, “off the lines”. **Off the lines** are side branches not added to a
  line, islands and the rest ([R2.3](R2-lines-and-queue.md#R2.3)). The table takes the lines live from the research,
  otherwise from the research's file; they are sorted in the order of the research's lines, then branches, islands and
  off the lines, within them by generation. The column and the line chips are only for a research with lines.
- **Conflict on a fact:** the cell of a fact with an open conflict of sources has “≠” before the value, without a
  tint. A click on “≠” opens the bubble with the conflicts; a screen reader reads “{value}, sources disagree: {fact}”.
  The research's marks “!” and “?” are only in the research columns ([A6.7.13](#A6.7.13)).
- **Chip Research ▾:** one chip with a menu in the sections **Signals**, **Lines**, **Exchange, sources and places**,
  **More research chips** and **New from research**; “A choice opens the Research block in the row.” Chips: **Awaiting
  decision**, **With conflicts**, **With questions**, **Agent working / queued**, one for each line and **Off the
  lines** (with counts), **Not sent**, **Changed by research**, **To decide here**, **Waiting on others**, **New from
  research** (last 24 h, last 7 days, since the last opening), **Reading room only**, **Place unidentified**,
  **Decided by agent**, **Paused / postponed**, **Tree ends here**. On a phone the section **Research** is in the
  panel **Filters**, the less frequent chips under **More research (n)**.
- **Built-in views** (the section **Research** in the menu **View**; like the other built-in ones they do not change,
  [A6.7.7](#A6.7.7)):

  | View | What it shows |
  |---|---|
  | **Research** | people with a signal: name, Research, Awaiting decision, Conflicts, Hypotheses, Agent, Research tasks, birth, death; sorted from the most urgent, then by name |
  | **Line: {line}** (for each line) and **Off the lines** | name, Line, generation, Research, birth, death, Conflicts, Agent; the line chip; sorted by line |
  | **Exchange with research** | people with an exchange: name, Exchange with research, Originally in the family tree, New from research, Conflicts, birth |

  The unions are collapsed in them and the coverage row is on. An empty view says “The research needs nothing right
  now” or “The tree and the research are in sync”.
- **Research bubble:** a click on a research cell opens a bubble (on a phone a bottom panel) with sections according
  to what the person has: **Awaiting decision · n** (**Compare versions ›**, **Awaiting action ›**), **Waiting on
  others**, **Source conflicts · n** (**Decide ›**), **Hypotheses** or **Open question** (**What the research knows ›**,
  [S3.5](S3-what-the-research-knows.md#S3.5)), **Agent working** (**Follow the research ›**), **Research tasks in the
  queue** (**Open the task in the research**), **Materials ›**, **Line** or **Off the lines** (**Show the line in the
  tree**, **Change in the research**), **Originally in the family tree** (**Restore the family tree value**, only with
  the research on this computer) and **Source availability**. An action that is confirmed in the research has a mark
  as elsewhere ([S4.5.1](S4-research-from-the-app.md#S4.5.1)).
- **Live:** while the research is followed only the cells the change concerns change; the order of the rows stays. At
  the name of a person the agent is working on a vertical bar runs. Above the table stands “● Following the research
  live”, otherwise “Research: as of {when}”.
- **Export:** CSV and XLSX carry texts and counts (“waiting; conflict (1)”, “1: birth”, without a conflict “0”),
  without marks. Without following (from app 3.27.0 only without an answer from the bridge), **Agent** and
  **Research tasks** are empty and the notice says “Agent and Research
  tasks are empty: the research is not being followed.” The coverage row has “–” for the research columns.
- **Limits:**
  - without an agent (Strom archive) and in a read-only tree there are no **Awaiting decision**, **Research tasks**
    and **Agent**, nor the chips **Not sent** and **To decide here**; the view **Exchange with research** is only in a
    research with an agent that can be changed;
  - **Agent** and **Research tasks** have a value only while the research is followed, otherwise “–” with the label
    “live”; the chip **Agent working / queued** does not filter without following. From app 3.27.0 both hold only
    without an answer from the bridge (below);
  - in a read-only tree the bubble has no actions: “Read-only: conflicts cannot be decided here.”
- **Without following, with the bridge:** when the research bridge on this computer answers, **Agent** and
  **Research tasks** (also the bar by the name, the chip **Agent** and the export) take the agent's work and the
  queue from a regular ask of the bridge and look as while following. An empty bridge queue leaves the cells empty.
  The table redraws when the bridge's answer changes. A phone does not ask the bridge. The Research overview without
  following works the same way ([S4.1.5](S4-research-from-the-app.md#S4.1.5)).
- **Controls:** the panel **Columns** → the group **Research**; the chip **Research ▾**; **View** → the section
  **Research**; **Marks ⓘ**.
- **Since:** app 3.27.0 with research 1.31.0

<!-- zdroj: app:src/ui/table-view/table-research.ts RESEARCH_COLUMNS, RESEARCH_DEFAULT_COLUMNS (rSum, rWait, rConf, rHyp, rAgent), LIVE_ONLY (rTasks, rAgent), NEEDS_AGENT (rWait, rTasks, rAgent), rSum pořadí (čeká 5 › rozpor 4 › otázka 3 › agent 2 › fronta 1), researchLinesOf (živě /directions/people, jinak soubor _STROM_DIRECTION), personLineRole, isOffLine, researchChips, RESEARCH_SIGNAL_CHIPS, RESEARCH_MORE_CHIPS, researchChipOffer (xUnsent, xDecideHere jen research a ne jen ke čtení), researchChipActive (live), unionLineRole, unionResearchCell (UNION_FACTS), sourceImageCell, unionResearchIdCell, sourceResearchIdCell · table-views.ts pohledy Výzkum, Linie, Mimo linie, Výměna s výzkumem · table-research-bubble.ts, table-research-ui.ts · table-grid.ts conflictMarkHtml · table-export.ts (exportNotLive) · strings.ts table.res.*, table.col.r*, uResearchId, srcResearchId, srcImage · commity 53137620, 99b60acb, a2e1dc73, 02e88e9a, 32958eb4, fd9c220f, cf9e63d8, 4635c16e, 5857be6b, 970e6b88, 6b66e037, 9e51ff66 · research: GET /directions/people, funkce directions.places, brána APP_SHOWS_RESEARCH_TABLE (src/core/stromapp.ts), CHANGELOG.cs.md 1.31.0 „Výzkum v tabulce aplikace Strom“ · spec 073 §16, K7.1–K7.8 · bez sledování s mostem: app 8d564b35 src/ui/research-ui.ts unfollowedAgentNow (onComputer, researchStatusNow, status.working a queue), src/ui/table-view/table-ui.ts tableResearchAgentChanged · spec 057 K1.12 -->

<a id="A6.7.15"></a>
### A6.7.15 The active cell, the cell menu and editing in place

A click on a cell selects the row and makes the cell the active cell (a thin outline); the arrows move it. The active
cell can be copied, the table filtered by its value and the fact in it edited right in the table.

- **Copy:** Ctrl/Cmd+C without selected text copies the text the active cell shows, without marks, icons and pills.
  Text selected by hand is copied as usual.
- **Cell menu:** the row menu (right button, Shift+F10) and the row panel (a finger's tap on the cell) begin with
  the cell's choices **Copy**, **Only “{value}”** and **Without “{value}”** (the value shortened to about 24 characters
  with “…”); under them are the row actions ([A6.7.8](#A6.7.8)). The menu opens at the cell, also when another row was
  selected.
  - **Only** and **Without** set the column filter **is** / **is not** ([A6.7.6](#A6.7.6)), the chip “{Column} =
    {value} ×” or “{Column} ≠ {value} ×”; the comparison ignores letter case and diacritics. A cell with a person's
    name compares the person: **Only “{father}”** in the column **Father** shows the siblings, not the children of a
    namesake.
  - An empty cell offers **Only empty** and **Only filled**, a cell with a list of values sets the value filter. A
    cell without one value to compare (a research mark, several names, completeness, the number of unions) offers only
    **Copy**; the row's own name or title has only the row actions.
  - The filter is saved with the view ([A6.7.7](#A6.7.7)).
- **Editing in place:** a cell can be edited when it stands for one fact of the tree:
  - **First name**, **Surname** (when it shows the married surname, it edits that), **Birth surname**, **Married
    surname**;
  - **Sex** by a choice (**Male**, **Female**, **Unknown**) and **Ref. number**;
  - the date and place of birth, baptism, death and burial, **Cause of death** and **Recorded age at death**;
  - **Occupation**, as long as the person has at most one;
  - the union's facts (the Unions table, a union sub-row, the row of a person with one union): **Union status** by a
    choice (**Married**, **Partners**, **Divorced**, **Separated**, as in the union form), the date and place of the
    marriage, each partner's recorded age at the marriage (**Recorded age at marriage**, **Partner’s recorded age**,
    **Recorded age 1** and **2**), **Divorce date** and **Divorce place**. An empty cell creates the union's fact as the
    union form creates it. In a union without a wedding ([A6.7.4](#A6.7.4)) the wedding's cells are not edited.

  **Full name** is not edited in the cell (it is made of several parts), nor are computed cells, checks, research,
  citations, counts and relationships; a double click on them opens **Edit…**.
- **The field** stands in the cell. Only in a column narrower than the field's least width (text and date 100 px,
  place 140 px, a choice 90 px) is the field wider, lying over the row with a shadow (from app 3.28.0; before, it
  lay over the next cell). **Enter** saves, **Esc** cancels, **Tab** and **Shift+Tab** save and go to the next
  or previous editable cell of the row, a click elsewhere saves. In a choice a click with the mouse saves the value at
  once; after choosing with the arrows, Enter, Tab or a click elsewhere saves it. The date is read as in the person form; an unreadable
  one stays in the field with the error “The date cannot be read (e.g. 1880-05-15, 1880, about 1880)”. The place
  offers the places of the tree. Without a first name and a surname nothing is saved: “A first name or a surname has
  to stay”.
- **Saving** goes the same way as the person form (the union's facts as the union form) and is one step back
  (Ctrl/Cmd+Z), also when an empty cell created the fact. Baptism and burial edit the first
  such event (its other facts and citations stay), or add one; an empty field deletes only that fact. Then the row
  flashes, stays in place and the notice says “Saved: {name}”.
- **Limits:** editing in place is not possible in a read-only or locked tree, in the Strom archive, on a phone and for
  a locked person. On a phone a fact is edited via the row panel → **Edit…**.
- **Controls:** a double click, **F2**, **Enter** on the active cell (for a cell with a finding Enter first opens the
  finding's bubble), in the row menu **Edit cell** (F2). An editable cell has a text cursor on hovering with the mouse.
- **Since:** app 3.27.0

<!-- zdroj: app:src/ui/table-view/table-grid.ts copyKey (Ctrl/Cmd+C, copyPlainText), F2, Enter (has-issue → onIssue, has-finds → onFindings, jinak startEditAt, jinak open), Escape, Tab · table-ui.ts showTableRowMenu (cellPart, cell-edit „Upravit buňku“ s F2), tableCellChoices, tableCellSheetBlocks, :1663 úprava na místě ne v jen ke čtení, archivu, na telefonu (isPhoneBar) · table-edit.ts editTargetOf, PERSON_FIELDS (surname: marriedSurname || lastName, birthSurname, marriedSurname, bDate…burPlace, occ), UNION_FIELDS (wDate, wPlace), editChangeOf (normalizeDateInput, první křest a pohřeb, prázdné pole smaže jen údaj, beze jména neuloží) · strings.ts table.cell.copy, only, without, edit, badDate, nameNeeded, editLabel, onlyEmpty, onlyFilled, matchEquals, matchNotEquals, savedToast · commity 05d9a9ab, be9ca8cd, 28aabdc8 · spec 073 U9 (T54 F4, F8, F9) · T54 2. kolo: table-edit.ts PERSON_FIELDS (firstName, gender, refn, dCause, dAgeRec), UNION_FIELDS (wAgeRec, pAgeRec, rec1, rec2, divDate, divPlace, uStatus), WEDDING_FIELDS (ne u unionWithoutWedding), editOptionsOf (GENDERS, UNION_STATUSES v pořadí formuláře svazku), table-grid.ts select (klik myší uloží hned), commity 8fdf52ca, 79764eba (T54 G3, G10) · nabídka u buňky jiného řádku: commit 400ccda8 (T54 G7) · pole v buňce: table-grid.ts EDITOR_MIN_WIDTH (text 100, date 100, place 140, select 90), placeEditor, commit 80c2ffb9 · panel klepnutím: commit ee38c7a6 -->

<a id="A6.8"></a>
## A6.8 A view in a separate window

On a computer each view can be opened in a separate window, for example on a second monitor, as many as needed. The
main window stays on its view. Only the main window saves; the other windows send it their edits and get the tree
from it.

- **Where it works:** on a computer (Windows, macOS, Linux, ChromeOS), also with a touch screen, in a window wider
  than 640 px. On a phone and a tablet (Android, iOS, iPadOS) and in the exported app (an HTML file) ⧉ is not shown
  and the shortcuts open nothing.
- **What the window takes over:** the tree, the person in the centre and what the view shows: for the Table the
  row type, filters, search, saved view, sorting and the selected row; for Family the zoom, for the Fan the rings,
  for the Map the places and the zoom. Then the window has its own state. Reloading the window (F5) keeps its view
  and person.
- **What the window has:** instead of the app's toolbar it has a heading: the tree's name, the view switch (below
  960 px as "{view} ▾"), **Follow selection** ([A6.8.1](#A6.8.1)), **Undo**, **Redo** and ⧉ **Open another window**. It has no
  tree switcher, no **Research** menu, no Settings and no small research panel.
- **Edits:** in the window a person can be edited (the person menu, **Edit**) and so can a Table cell. The main
  window saves them, they can be undone as its steps and show in all windows at once. **Undo** and **Redo** in the window's heading
  undo and redo the main window's steps. When the tree changed in another window meanwhile, the edit is not applied:
  "The tree changed in another window meanwhile. The edit was not applied; the data is refreshed." A Table cell being
  typed stays then ("Draft kept · Enter applies, Esc discards").
- **Research:** only the main window handles the connection to the research (the bridge, following, sending edits).
  The research items in the person menu of a window stand under the heading **Research · runs in the main window**
  and the main window runs them. While the research is followed live
  ([S1.4](S1-connecting-app-and-research.md#S1.4)), the windows are read-only like the main window: "Read-only · the
  main window is following research" with **Go to the main window**.
- **Limits:**
  - ⧉ in the main window shows the number of other windows ("2 more windows", below 1280 px the number only). Its
    menu has **Open windows** at the top (each with **Bring to front** and ×) and **Close all**;
  - from 5 open windows on, the app warns that each extra window needs memory; it forbids nothing;
  - a window blocked by the browser is reported ("The browser blocked the new window…") with **Try again**;
  - the window's title carries the view and the tree ("Table – Horáks – Strom"), the main window's title the tree
    ("Horáks – Strom").
- **Controls:** app: ⧉ **Open in a new window** next to the view switch (a menu of the six views, for a tree from a
  research also **Research overview**, [S4.1.6](S4-research-from-the-app.md#S4.1.6)); ⧉ in the Table's bar after
  **Export ▾**; on a view's tab Ctrl+click (macOS ⌘+click), the middle button or a right click (Shift+F10) →
  **{view} in a new window**.
- **Since:** app 3.28.0

<!-- zdroj: app:4b1373a7 src/windows/window-open.ts isDesktopSystem, windowsOffered (role main, ne isViewMode, > MOBILE_MAX 640, ne isPhoneBar), openInNewWindow · src/windows/window-controls.ts openWindow (BLOCKED_TOAST_MS 10 s, win.retry; MANY_WINDOWS 5, manyWindows), INDICATOR_TEXT_MIN_WIDTH 1280, renderMenu (6 pohledů, thisView, overview jen UI.canOpenResearchOverview), wireTabs (ctrl/meta click, auxclick button 1, contextmenu, Shift+F10 / ContextMenu) · src/windows/view-window-state.ts (přenos stavu, F5 satelitu) · src/windows/sat-header.ts · src/windows/satellite.ts readOnly (live, locked) · src/windows/sat-states.ts (live strip readOnlyLive, goToMain; CONFLICT_TOAST_MS) · src/windows/window-drafts.ts (draftKept) · src/windows/window-research-menu.ts (researchInMain) · src/windows/window-title.ts · index.html html.window-satellite .toolbar skryto · strings.ts win.* · CHANGELOG.cs.md 3.28.0 · spec 079 K1.1–K1.4, K1.7 · prace/1112-app-okna-zaklad, 1112-app-okna-pohledy -->

<a id="A6.8.1"></a>
### A6.8.1 Follow selection

The selected person is shared between the windows. What a choice in another window does in this window is set by the
switch **Follow selection** in the window's heading.

| Mode | What a person chosen in another window does | Default in the views |
|---|---|---|
| **switch** | becomes the window's centre as after Focus: Descendants shows their descendants, the Fan their ancestors, Family their family | Family, Descendants, Fan |
| **mark only** | is only marked: the card with a ring, a sector in the Fan, a row on the Timeline, their places on the Map, a row in the Table; the centre stays | Timeline, Map, Table |
| **off** | nothing; the window has its own selection and does not send it | – |

- **Limits:**
  - **switch** is offered only in Family, Descendants and the Fan; elsewhere there are only **mark only** and **off**;
  - a click of its own in the window changes the centre only in this window; a window that switched after another
    window does not pass the choice on;
  - the main window always follows the selection and has no switch;
  - the choice holds for one window and survives its reload (F5). A chosen mode that is not the default holds also
    after the view is switched in the window (**switch**, where it is not offered, as **mark only**); otherwise the
    default of the new view applies.
- **Controls:** app: in the window's heading **Follow selection: {mode} ▾**.
- **Since:** app 3.28.0

<!-- zdroj: app:4b1373a7 src/windows/follow-mode.ts RECENTERING (family, descendants, fan), defaultFollowMode, followModesFor, effectiveFollowMode, followChoiceToStore (sessionStorage pro okno) · src/windows/window-selection.ts (origin, bez smyčky) · src/windows/sat-header.ts · strings.ts win.followSelectionState, followModeSwitch, followModeMark, followModeOff, followModeSwitchNote, followModeMarkNote, followSelectionOff · spec 079 K1.3, K2.1 · prace/1112-app-okna-sledovat (7bb1b8b2) -->

<a id="A6.8.2"></a>
### A6.8.2 When the main window is missing

A window without the main window loses nothing and nothing closes by itself. It stays read-only with the last data.

| State | What the window shows | Choices |
|---|---|---|
| the main window is closed (3 s without a message from it) | a strip "The main window is closed · as of {time}, read-only"; the research items in the person menu under **Research · main window only** cannot be used | **Open Strom**, **Make this the main window** |
| the tree was deleted in the main window | "The tree no longer exists" instead of the content | **Close window** |
| the tree is locked | "The tree is locked · The password is entered in the main window." | **Go to the main window** |
| the main window switched the tree | the window switches with it, the view stays, the selection is cleared ("{tree} → {tree}") | – |

- **Limits:**
  - **Open Strom** opens a new main window; the windows connect to it and the strip disappears;
  - **Make this the main window** makes this window the main one: it loads the tree from storage (the data in the
    window may be older than the saved data), gets the app's toolbar and the view stays. When another main window
    came up meanwhile, nothing happens;
  - reloading the main window (F5) does not show the strip.
- **Controls:** app: the buttons in the strip and in place of the window's content.
- **Since:** app 3.28.0

<!-- zdroj: app:4b1373a7 src/windows/satellite.ts MAIN_SILENCE_MS 3000, lastHeardAt, treeGone · src/windows/sat-states.ts (closed strip mainClosed, treeGone, treeLocked, SWITCHED_TOAST_MS) · src/windows/become-main.ts (zámek ifAvailable, znovunačtení jako hlavní z IndexedDB) · src/windows/window-research-menu.ts researchMainOnly · strings.ts win.mainClosed, openStrom, makeMain, treeGone, treeGoneNote, treeLocked, treeLockedNote, closeWindow, goToMain, treeSwitched · spec 079 K1.5 · prace/1112-app-okna-zaklad (stavy 1–6) -->

<a id="A6.8.3"></a>
### A6.8.3 A second tab of the app

The app opened a second time in an ordinary browser tab or window does not load a second copy of the tree. It shows
"Strom is already open in another window" with the explanation "Only one window saves, so edits don't overwrite each
other. Other windows connect to it."

- **Limits:**
  - **Switch there** brings the main window to the front. When the browser does not allow it, the tab says so and
    adds "This tab can be closed.";
  - **Open as another window** turns the tab into a window as in [A6.8](#A6.8), with the Table;
  - a link opened in the second tab (a person, a search, the research's links, a file opened by the installed app)
    goes to the main window exactly once: "The link opened in the main window.";
  - the second tab writes nothing to the list of trees or to Settings.
- **Controls:** app: **Switch there**, **Open as another window**.
- **Since:** app 3.28.0

<!-- zdroj: app:4b1373a7 src/windows/window-role.ts (Web Lock strom-main ifAvailable → main, jinak second-tab) · src/windows/second-tab.ts (secondTabSatelliteKind table) · src/windows/window-link.ts (předání odkazu hlavnímu jednou) · src/windows/window-start.ts openLinkFromWindow · strings.ts win.alreadyOpen, alreadyOpenNote, switchThere, openAsWindow, switchFailed, tabCanClose, linkForwarded · CHANGELOG.cs.md 3.28.0 · spec 079 K1.6 · prace/1112-app-okna-zaklad (7d22e396) -->
