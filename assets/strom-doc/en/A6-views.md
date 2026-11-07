<a id="A6"></a>
# A6 Views and the choice of people

How the Strom app chooses which people to show and how each view shows them. Describes the app 3.21.2; changes from a later version carry its number.

A view is a different reading of **the same choice of people**. The choice is set by the central person (the one
clicked) and the depth **Ancestors** and **Descendants**. Family, Descendants, Timeline and Map show the same
surroundings of the central person. The Fan counts ancestors and descendants on its own by the number of generations
([A6.4](#A6.4)).

| View (cs) | en | de | pl |
|---|---|---|---|
| **Rodina** | Family | Familie | Rodzina |
| **Potomci** | Descendants | Nachkommen | Potomkowie |
| **Časová osa** | Timeline | Zeitleiste | Oś czasu |
| **Vějíř** | Fan | Fächer | Wachlarz |
| **Mapa** | Map | Karte | Mapa |

<!-- zdroj: app:src/types.ts:1237 ViewMode · strings.ts viewModeSwitch.* -->

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

<!-- zdroj: app:src/fan-chart.ts FAN_MIN_GENERATIONS, FAN_MAX_GENERATIONS, FAN_DEFAULT_GENERATIONS, parentSlots, repeatOf · strings.ts fan.shapeHalf, fan.shapeFull, fan.shapeTwo, fan.colorGender, fan.colorLine, fan.colorRod, fan.legendRepeats, fan.originPerson, fan.showFirst, fanChart.kekuleHint · settings fanKekule (výchozí false) · spec 029 · CHANGELOG.cs.md 3.20.0 -->

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
