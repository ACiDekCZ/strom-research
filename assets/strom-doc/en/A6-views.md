<a id="A6"></a>
# A6 Views and the choice of people

How the Strom app chooses which people to show and how each view shows them. Describes the app 3.21.2; changes from a later version carry its number.

A view is a different reading of **the same surroundings of the central person**. The surroundings are set by the
central person (the one clicked) and the depth **Ancestors** and **Descendants**. Family, Descendants, Timeline and Map show the same
surroundings of the central person. The Fan counts ancestors and descendants on its own by the number of generations
([A6.4](#A6.4)). The Table shows the whole tree ([A6.7](#A6.7)), from app 3.30.0 also only one list of people
([A6.7.19](#A6.7.19)).
From app 3.31.0 a window also has a **Selection**: one named group of people (a family line, the ancestors or
descendants of a person, a research line, a list of people) that Family, Descendants and the Fan highlight and the
Map shows alone ([A6.6](#A6.6)).
On a computer each view can also be opened in a separate window ([A6.8](#A6.8)).

Views: **Family**, **Descendants**, **Timeline**, **Fan**, **Map**, **Table**.

<!-- zdroj: app:src/types.ts:1237 ViewMode · strings.ts viewModeSwitch.* · Tabulka od aplikace 3.27.0 (viewModeSwitch.table) -->

<a id="A6.1"></a>
## A6.1 The surroundings of the central person in the Family view

The Family view shows the central person within their family, not the whole tree.

- The surroundings include:
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

<a id="A6.1.4"></a>
### A6.1.4 Photo on the card

The option **Photo on the card** sets the size and the shape of the person's photo on the card in the tree. The
defaults **Small** and **Circle** leave the card as before.

| | **Small** | **Medium** | **Large** |
|---|---|---|---|
| card **Normal** | 188 × 64 px | 200 × 64 px | 236 × 96 px |
| photo on the card **Normal** | 34 px | 48 px | 80 px |
| photo in the card's header **Detailed**, **Register**, **Custom** | 30 px | 44 px | 72 px |

- A larger card is only in a view where at least one shown person has a photo. The cards without a photo in that
  view are as wide, with small initials, and the names in a row stand at the same height. A view without photos has
  cards of 188 × 64 px.
- The card **Normal** has the photo beside the name. **Detailed**, **Register** and **Custom** have it in the header
  beside the name and the years, with the rows of details below it in full width; the card is taller by the photo
  (**Custom** 70 or 98 px and 17 px per row instead of 56 px).
- **From app 3.30.0:** the chosen size applies to every card with an avatar, with a photo or without one. The
  initials of a card without a photo have the photo's size and shape (**Normal** 48 or 80 px, in the card's header
  44 or 72 px) and a font in proportion (17 and 29 px, in the header 16 and 26 px). A view has larger cards whenever
  at least one card with an avatar is in it (before, only with a photo); a placeholder person has no avatar. The image
  export, the poster and its PDF draw the initials the same way. **Small** looks as before. The sentence under the
  option: "People without a photo get initials of the same size. Applies to the tree, its image export and poster on
  this device."
- **Shape:** **Circle** or **Rounded square** (rounding of 12 px for a large photo, 5 px for a small one; the same for
  the initials). The card's marks stand on the edge of the photo in both shapes.
- **Export:** the image export, the poster and its tiled PDF ([A7](A7-book-pages-and-export.md)) draw the cards with
  the chosen photo size and shape as the screen does: a **Normal** card has its size on the screen, **Detailed** and
  **Register** have the photo on the left of their header. A photo hidden for a living person leaves the initials on
  the card. An output where nobody has a photo, and the default **Small** with **Circle**, look as before. The
  sentence under the option: "Applies to the tree, its image export and poster on this device."
- **Limits:** the card **Compact** has no photo: the row stays, the options are off and below them is "The Compact
  card has no photo."; the chosen size is kept. The option belongs to the device and is not saved with the tree. The
  preview in the settings shows the card's size ("card 236 × 96 px").
- **Controls:** **Settings** → **Person card** → **Photo on the card** (between **Card detail** and the preview):
  **Size** **Small** · **Medium** · **Large**; **Shape** **Circle** · **Rounded square**.
- **Since:** app 3.29.0; 3.30.0: initials in the photo's size

<!-- zdroj: app:28480ea1 src/types.ts NORMAL_PHOTO_BOX (188×64/34, 200×64/48, 236×96/80), src/settings.ts (zařízení, výchozí small + circle), src/ui/card-fields-ui.ts, src/renderer.ts · b71d561a src/card-width.ts cardAvatarSize (30/44/72), výška Vlastní 70/98 + 17 na řádek · strings.ts cardDensity.photoTitle, photoSize, photoSmall, photoMedium, photoLarge, photoShape, photoCircle, photoRounded, photoCompact, size · CHANGELOG.cs.md 3.29.0 „Fotka na kartě“ · dirigent:test/vysledek-1115-app-096-fotka.md · spec 096 P1 · export: app:64ae50ca src/export-image.ts, src/renderer.ts (poster, PDF po listech; výchozí small + circle bajt po bajtu jako dřív), strings.ts cardDensity.photoScope · spec 096 P2 · 3.30.0: app:0bed2a88 src/types.ts NORMAL_PHOTO_BOX (avatar = fotka i iniciály), src/renderer.ts viewHasAvatar (dřív viewHasPhoto), src/card-width.ts normalCardTextWidth (126 px u každého avataru), avatarInitialsSize (avatar × 0,36: 17/29, 16/26), src/export-image.ts getPosterCardPhoto (každá karta s avatarem), strings.ts cardDensity.photoScope · e2e/card-photo.spec.ts, poster-card-photo.spec.ts · CHANGELOG.cs.md 3.30.0 „Fotka na kartě“ · spec 103 K2.1–K2.3 · dirigent:test/vysledek-1116-app-103-tabulka.md -->

<a id="A6.1.5"></a>
### A6.1.5 Lineage markers

The lineage markers mark the cards in the tree by the lineage the person belongs to relative to the central person
(in the settings "focused person"): **paternal**, **maternal**, **descendants**. The default is **Arc** on the left
edge of the card.

| Option | What the marker looks like | Second sign besides the colour |
|---|---|---|
| **Arc** (default) | a strip along the left edge of the card | none |
| **Letter tag** | a tag over the left edge of the card | a letter: P paternal, M maternal, D descendants |
| **Stripe** | a vertical stripe at the left edge | paternal solid, maternal dashed, descendants dotted |
| **Corner** | a triangle in the top left corner | paternal filled, maternal hatched, descendants outlined |
| **No shape** | no marker; with the tint switched on only the card's background marks the lineage | – |

- **Colours:** paternal blue, maternal pink, descendants ochre. One fixed palette, without a choice. The colours also
  differ in lightness (paternal dark, descendants medium, maternal light), so they can be told apart with weaker colour
  vision and in grey too. The dark appearance has its own shades; its tints have the card's lightness and differ in
  hue, so the three lineages and a tinted card from an untinted one can be told apart even without a shape. The card's
  text has a contrast of at least 4.5:1 on every tint.
- **Tint cards in lineage colour** (off by default) lightly tints the card in the lineage colour. It is a switch of its
  own and holds with every shape and with **No shape**:
  - a shape with the tint: the marker and the background;
  - **No shape** with the tint: only the background marks the card;
  - **No shape** without the tint: the cards do not mark the lineage at all.
- **Who has a marker:**
  - the paternal and the maternal lineage: the parent, all their ancestors and the siblings of each of them (aunts,
    uncles, great-uncles…);
  - descendants: all descendants of the central person;
  - without a marker are the central person, partners (partners of descendants and step-parents too), the central
    person's siblings, cousins and placeholder persons (an empty place for an unknown parent).
- **A person in both lineages** (for example an ancestor from a marriage of relatives) has both markers: **Arc**,
  **Stripe** and **Corner** split into a paternal and a maternal half, **Letter tag** two tags one above the other. Up
  to 3.29.0 the person got only the paternal one.
- **Parents of the same sex** (both parents of the central person known, both men or both women): the lineages are
  called **First parent's line** and **Second parent's line**, the tag carries 1 and 2, the colours stay.
- **Tree legend** (the Family and Descendants views, the setting **Tree legend**): the gender rings, a sample of each
  lineage in the chosen shape with its name and the row "No marker: focused person, partners, siblings, cousins". With
  **No shape** and the tint the samples are squares of the tint framed in the lineage colour (the same in the Settings);
  without the tint the part about the lineages is missing. Folding the legend: [A9.6](A9-using-the-app.md#A9.6).
- **A screen reader** reads the lineage at the card in words ("paternal line", "paternal and maternal line",
  "descendant", "first parent's line").
- **The same markers elsewhere:** the Timeline has a lineage sign before the name ([A6.3](#A6.3)), the Table the column
  **Lineage** ([A6.7.2](#A6.7.2)); the Fan in the colours **Lines** ([A6.4](#A6.4)) and the ancestors' path on the Map
  ([A6.5.5](#A6.5.5)) have the same shades. With **No shape** neither the Timeline nor the Table has a sign.
- **Export and printing:** the image export and the poster draw the chosen shape and the tint, always in the light
  colours. In printing from the browser all cards have the same grey frame; the gender is shown by the ring at the
  photo or the initials, the lineage by the marker. The marker is printed even without printing backgrounds, the tint
  is not printed (**No shape** with the tint marks nothing in print).
- **Limits:** the marker is only a layer on the edge of the card; it changes neither the size nor the content of the
  card. The lineage is computed again at each change of the central person. The option belongs to the device and is
  not saved with the tree.
- **Controls:** **Settings** → **Tree view** → **Lineage markers**: **Arc** · **Letter tag** · **Stripe** ·
  **Corner** · **No shape**; below it **Tint cards in lineage colour**. Each option has a card preview.
- **Since:** branch colours app 1.8.0 (orange, blue and green); 3.30.0: **Lineage markers** instead of the switch
  **Branch colours**, new colours, shapes, the tint, both markers, the first and second parent's lines. **Branch
  colours** switched on are taken over as **Arc**, switched off as **No shape** without the tint.

<!-- zdroj: app:0e403ec6 src/branch-colors.ts classifyBranches (collectAncestorSide: předci + sourozenci každého předka; collectDescendants přes childIds; obě strany se sčítají R4; descendant jen mimo strany; focus smazán; numbered = oba rodiče známí a stejného pohlaví R5), src/settings.ts getBranchMarker (výchozí arc; branchColors false → off), isBranchTintOn (jen se značkou), isBranchTintChosen, save (migrace při prvním zápisu), src/renderer.ts renderCards (!isPlaceholder, viewMode ≠ timeline), src/branch-marker-attrs.ts (čtečka ariaPaternal/ariaBoth/ariaSlot1), index.html tokeny --branch-paternal #234e8c / --branch-maternal #d0679a / --branch-descendant #8a6400, tmavé #9cc2f2 / #f6a9cb / #e3b552, --branch-*-tint, CSS tvarů (arc, tag, stripe, corner; R4 .branch-paternal.branch-maternal) · app:c8afe382 index.html #branch-marker-setting (skupina settings.groupTree), #branch-tint-toggle, src/ui/branch-marker-ui.ts syncBranchLegend, src/ui/misc.ts (legenda jen family/descendants, isBranchLegendEnabled) · app:b94f3816 src/branch-marker-svg.ts, src/ui/export-image-ui.ts treeCardDrawing (branchMarker, branchTint, numbered; světlé hex), index.html @media print (R6: border 2px #999, white background, tiskové --branch-*, print-color-adjust) · strings.ts branchColors.* (settingLabel, markerArc…markerOff, defaultTag, tintLabel, legendPaternal…legendSlot2, legendNone, letterPaternal O, letterMaternal M, letterDescendant P) · barvy větví: app:6f86ad39 (v1.8.0) · CHANGELOG.cs.md 3.30.0 „Značení linií“ · dirigent:spec/112-znaceni-linii K1–K4, app:docs/ZADANI_DEV_linie-na-kartach.md R1–R6 · prace/1119-app-112-linie · Bez tvaru: app:999c373f src/types.ts BRANCH_MARKERS (none), src/settings.ts getBranchMarker (uložené off → none; branchColors false → none), isBranchTintOn (samostatně), isBranchMarkingOn, src/ui/branch-marker-ui.ts syncBranchLegend (none jen s podbarvením), src/branch-marker-attrs.ts, src/export-image.ts buildTreeSvg (none + tint = výplň karty), strings.ts branchColors.markerNone, tintHint · app:34aca82c index.html tmavé --branch-*-tint #172a41 / #3b1e2c / #372600 (světlost karty), světlé --text-faint #6a6254, .branch-swatch[data-shape="none"] rámeček var(--sw), src/__tests__/branch-tint-contrast.test.ts (4,5:1) · test/vysledek-1119-app-112-podbarveni -->

<a id="A6.1.6"></a>
### A6.1.6 Back to the default person: ⌂

The button ⌂ at the start of **Focused on** focuses the tree's default person ([A6.1.1](#A6.1.1)), wherever the
centre is. It does the same as **Focus** at a card: a new step of the history and the notice "Focused on {name} ·
↩ Back"; **↩ Back**, the arrow ↩ at the bottom left or Alt+← returns the previous centre.

| Tree setting (**Default person and view**) | Whom ⌂ focuses |
|---|---|
| **Specific person:** | that person; when they are no longer in the tree, the tree's first person |
| **Last focused** | the person the tree focused on when it opened (or when this tree was switched to) |
| no setting | the tree's first person |

- **Where ⌂ is:**
  - Family: in **Focused on** on a computer, in the bar on a tablet and on a phone held sideways, in the person panel
    on a phone;
  - Descendants: at the start of the view's badge;
  - Fan: top left; with a fixed centre ([S4.1.3](S4-research-from-the-app.md#S4.1.3)) before **Centre: {name} ·
    Release**, and it releases the fixed centre first.
- **The default person is the centre already:** ⌂ stays in its place, filled and dimmed, with the tooltip "Default
  person is in focus: {name}". Neither a click nor the key does anything.
- **Tooltip:** "Focus default person: {name}", for the tree's first person with the addition " – first person in the
  tree", for **Last focused** " – focused when the tree opened", and "(H)".
- **Keys:** H (outside a text field and an open menu); also ⌘1 on a Mac and Ctrl+1 on Windows and Linux, when the
  browser passes them to the app. In a browser tab the browser usually takes them itself to switch to the first tab.
  Overview of the keys: [A9.8](A9-using-the-app.md#A9.8).
- **While following the research** ⌂ and H act as another choice of a person: they interrupt following the agent in
  the main window (**Back to the agent**, [S4.1.1](S4-research-from-the-app.md#S4.1.1)). When the default person is
  the centre already, they do not.
- **Limits:** an empty tree has no ⌂. The Map, the Timeline, the Table and other windows ([A6.8](#A6.8)) have no ⌂,
  and H does nothing there.
- **Controls:** ⌂ at **Focused on** (Descendants: in the badge, Fan: top left); the key H.
- **Since:** app 3.30.0

<!-- zdroj: app:e52adde6 src/default-person.ts defaultTarget (specific, first, opened, fallbackFirst; prázdný strom null), startupPerson · src/ui/default-focus.ts FALLBACK_TO_FIRST = true, rememberOpenedFocus, isAtDefault (Vějíř: liveFollowPinned ?? focus), isDefaultFocusContext (hlavní okno, HOME_VIEWS family/descendants/fan), focusDefaultPerson (unpinFanCenter, TreeRenderer.focusFromTab → showFocusToast) · app:b6df0770 §3 telefon (panel osoby), §6 defaultFocusKey (H/h bez Ctrl/⌘/Alt mimo pole; ⌘1 / Ctrl+1 podle code Digit1 i z pole), src/ui/misc.ts defaultFocusKeyHeld, §7 Potomci (#descendants-badge), Vějíř (pilulka vlevo nahoře, pin), §9 pauza sledování · strings.ts focus.focusedOn, focusHome, focusHomeFirst, focusHomeOpened, focusHomeAt, focusToast, focusToastBack · CHANGELOG.cs.md 3.30.0 „Zpět na výchozí osobu“ · dirigent:spec/111 K1.1–K1.6 · app:docs/ZADANI_DEV_vychozi-osoba.md §1–§9 · ⌘1 / Ctrl+1 v kartě prohlížeče neměřeno (spec 111 Otevřené) -->

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
- Under the axis of years runs the history row ([A6.3.1](#A6.3.1)). Without the research or without events of
  history there is no row.
- A shared event of two rows or more ([A10.2](A10-shared-events.md#A10.2)) is one mark across the rows of its people,
  with a label; hovering over the label names the people. When the history row lies above the first row, the label
  of a mark from the first row does not stand in it but lower, beside the mark.
- **Since:** timeline app 1.5.0; the history row app 3.19.0, across the whole timeline app 3.31.0; the mark of a
  shared event app 3.28.0
- **From app 3.30.0:** with the **Lineage markers** on ([A6.1.5](#A6.1.5)) a lineage sign in the chosen shape stands
  before the person's name (a person in both lineages two signs, with parents of the same sex 1 and 2); hovering over
  the sign says the lineage in words. The life bar keeps the gender colour and is not tinted. The timeline poster
  draws the sign the same way. With **No shape** there is no sign.

<!-- zdroj: app:src/timeline.ts computeTimelineModel, :59 TimelineHistory · strings.ts timeline.omitted · CHANGELOG.cs.md 3.19.0 -->
<!-- zdroj: app:cecd72a4 src/renderer.ts timelineBranchSigns (znak legendy před jménem, title linie slovy, dvě značky R4, číslice R5; plakát SVG) · CHANGELOG.cs.md 3.30.0 „Značení linií“ · dirigent:spec/112-znaceni-linii -->
<!-- zdroj: app:55ac8a08 src/timeline-chart.ts sharedMarkSvg (jedna značka přes řádky, popisek jednou, jména v title) · app:f8531340 placeSharedLabels · app:cc6f3104 placeSharedLabels topTaken (s řádkem dějin popisek značky z prvního řádku níž, ne v řádku dějin) · dirigent:spec/085 §2e -->

<a id="A6.3.1"></a>
### A6.3.1 The history row across the whole timeline

The history row shows the history of the whole period and of all people on the timeline: each event of a country or
region where at least one person with a row lived in its year.

- **Which events:** events of the scope country or region (**Regional history**). An event is taken when the person
  lived, in the year of the event, in a place the research assigned the event to. For a period one of its years is
  enough, and only within the years of the person's life. Where a person lived in which year is decided as for
  history on the person card.
- Each event is in the row once, even when it concerns more people. A person without a row (without a year of
  birth, a placeholder) does not count.
- **Hiding:** an event hidden in the whole tree or for the whole region is nowhere. An event hidden at one place is
  shown by another place of the person that does not hide it.
- **Look:** the row's tint spans the whole axis. The life of the central person is a thin line at the bottom of the
  row. Periods have stripes on two tracks.
- **Clusters:** events close together form a cluster (16 px on a computer, 22 px on a phone). A cluster has the
  symbol of the kind most frequent in it (on a tie the earlier one), in the colour of its origin. More events show a
  badge with the count. Two clusters whose marks would touch merge.
- **The country or region** is named in the label and the detail only when the row's events come from at least two
  countries or regions.
- **A cluster's detail:** hovering shows a line per event (year, kind, country or region, text).
  - Computer: a click opens a popover at the cluster. In it each event with its years, symbol, text, "kind · country
    or region" and "Concerns:" with at most two names and "and N more"; the central person comes first. A name opens
    the person card on the event's row. Esc, a click beside it or scrolling closes the popover.
  - Phone and touch screen: a bottom sheet "History 1880–1891" with the events and under **Open in the person card**
    a row for each person the cluster concerns (at most four and "and N more ›"). A person opens the card on the
    first event of the cluster that concerns them.
- **When the row is there:** the tree has a research with history, **History in the life timeline** is on in
  Settings and the chip **History** in the timeline of the person card. Origins switched off in Settings (**Regional
  history**, **Local history**, **From research sources**) are not drawn.
- **Limits:** the history row is on the screen only. Printing and the timeline poster do not draw it.
- **Controls:** app: the **Timeline** view, the row **History ▾** ([A6.3.2](#A6.3.2))
- **Since:** app 3.31.0 (until then the history row of the central person only)

<!-- zdroj: app:e843ab70 src/history.ts computeTimelineHistory (místa života personResidence, livedYear v letech života, období jeden rok, jednou na osobu, skrytí treeHidden/regionHidden/hidingFor, scope region → řádek, place/local → čáry; kinds z Nastavení) · src/timeline.ts timelineHistoryRow (jen řádky, které se kreslí; region jen při ≥ 2), timelineClusterKind, timelinePeriodTracks · app:a7391d4f src/timeline-chart.ts historyRowSvg (podklad přes celou osu, tl-hist-life, jen obrazovka) · app:79312e31 clusterTimelineHistory clearance, historyClusterClearance · app:1d2f8b55 src/ui/timeline-history-ui.ts showTimelineHistoryPopover, timelineConcernPersons (max 2, ústřední první), showTimelineHistorySheet, timelineClusterPersons (4 a „a N další ›“) · src/ui/history-ui.ts historyTimelineSource (vrstva, výzkum, čip Dějiny karty) · strings.ts history.timelineRowLabel, timelineClusterAria, timelineEventLine, timelineYearsTitle, timelineConcerns, timelinePeopleMore, openInCard, settingLabel, kindRegion, kindPlace, kindLocal · dirigent:spec/121 K1.1–K1.4, Rozhodnutí 20. 11. · prace/1120-app-121-casova-osa -->

<a id="A6.3.2"></a>
### A6.3.2 History options: kinds and country

The row's label **History ▾** opens the timeline's history options. The options hold for the tree and the device
remembers them.

- **Kinds of history:** **All** and nine kinds (war, epidemic, census, state and borders, emigration, law, economy,
  disaster, other), each with its symbol and the number of events on the timeline. The number counts the history row
  and the local history on the life lines together; an event on several lines is one. A kind without an event can be
  chosen; the filter stays for other timelines.
- **Country or region:** only with at least two countries or regions in the row. **All** and the countries and
  regions by the number of events, one choice. It applies to the history row only.
- **On the life lines:** the option **Local history on the life lines** ([A6.3.3](#A6.3.3)).
- **The filter in the label:** "History · 3 kinds" (the chosen kinds the timeline has), "History · country or
  region", with both "History · 2 filters". A label with a filter is tinted.
- **Nothing left:** the row says "No history for the chosen kinds" (on a phone "No history") and **Clear filter**.
  **Clear filter** drops the kinds and the country at once; local history on the life lines stays.
- **Limits:** the options are not data of the tree: they go into no export, GEDCOM or backup. A country the research
  no longer knows is not used. Another window ([A6.8](#A6.8)) takes over the change.
- **Controls:** app: **History ▾** → **Kinds of history**, **Country or region**, **On the life lines**, **Clear
  filter**. On a computer a popover under the label, on a phone and a touch screen a bottom sheet.
- **Since:** app 3.31.0

<!-- zdroj: app:3e3e4949 src/ui/timeline-history-ui.ts showTimelineHistoryOptions, drawTimelineHistoryOptions (oblast jen hist.regions ≥ 2 nebo uložená; místní off/none), clearTimelineHistoryFilter · src/timeline.ts filterTimelineHistory (oblast jen řádek), timelineHistoryRowState, toggleTimelineKind, clearTimelineFilter (local zůstane), timelineFilterKindCount · app:601f52d4 timelineHistoryFacets (počty jednou podle id, řádek + místní), .tl-hist-btn.is-filtered · src/timeline-chart.ts historyFilterText · src/settings.ts getTimelineHistory/setTimelineHistory (lifelineByTree.timeline, jen zařízení), TimelineHistoryOptions · src/history.ts timelineHistoryRegion (neznámá oblast → všechny) · strings.ts history.timelineOptKinds, timelineOptRegion, timelineOptAllRegions, timelineOptLines, timelineFilterKinds, timelineFilterBoth, timelineClearFilter, timelineEmptyFilter, timelineEmptyFilterShort, kinds.* · dirigent:spec/121 K3.1 -->

<a id="A6.3.3"></a>
### A6.3.3 Local history on the life lines

The option **Local history on the life lines** draws local history and the research's findings from records right
on the person's life bar, in the year of the event.

- **Which events:** **Local history** and **From research sources** ([R4.7](R4-places.md#R4.7)) in the place where
  the person lived in the year of the event. For a period from the first year the person lived there; under the bar
  a stripe then runs to the end of the period (at most to the end of the bar).
- **Look:** the kind's symbol in a box in the colour of its origin. A symbol closer than 10 px to an event's dot or
  to a shared event's mark steps 11 px aside. Symbols close together group as in the history row, with a count
  badge. Below 1.5 px per year (a long axis on a phone) a line has one symbol with all its events.
- **Detail:** hovering shows a line per event with the place and, for a finding, its source. A click on a computer
  opens the person card on the event's row. On a phone and a touch screen a bottom sheet with the events and **Open in
  the person card ›**.
- **Default:** off. The option holds for the tree and is remembered ([A6.3.2](#A6.3.2)). The filter of kinds applies
  to it too.
- **Limits:** when **Local history** and **From research sources** are both off in Settings, the option cannot be
  switched on. Without local history on the timeline the option says "There is no local history on the timeline."
  The symbols are on the screen only; printing and the poster do not draw them. The keyboard does not reach them
  (Tab).
- **Controls:** app: **History ▾** → **Local history on the life lines**
- **Since:** app 3.31.0

<!-- zdroj: app:967b6b97 src/history.ts computeTimelineHistory (place/local → čáry, rok příchodu moved, year2, source) · src/timeline.ts layoutTimelineLocal, timelineLocalX (LOCAL_CLEAR_PX 10, LOCAL_STEP_PX 11), LOCAL_DENSE_PX_PER_YEAR 1.5, timelineLocalOptionState (off/none), timelineHistoryRow (filtr druhů i na čáry) · src/timeline-chart.ts localSvg (jen screen, tl-loc-box, tl-loc-period, title se zdrojem LOCAL_SOURCE_MAX 60, role img mimo Tab) · src/ui/timeline-history-ui.ts openTimelineHistory, showTimelineLocalSheet · src/settings.ts TimelineHistoryOptions.local (výchozí false) · strings.ts history.timelineOptLocal, timelineOptLocalHint, timelineOptLocalOff, timelineOptLocalNone, timelineLocalAria, timelineLocalSource, openInCard · dirigent:spec/121 K2.1–K2.3 -->

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
  - **From app 3.30.0:** **Lines** in the colours of the **Lineage markers** ([A6.1.5](#A6.1.5)): the father's side
    blue (father's father blue, father's mother teal), the mother's side pink (mother's father pink, mother's mother
    raspberry), the parents in a light shade of their side, the descendants in the shape Two-way ochre. Up to 3.29.0
    other shades.
  - **From app 3.30.0:** **Family lines** colours by the side of the fan, with a legend by sides and highlighting of
    a family line ([A6.4.1](#A6.4.1)).
- **Original person** returns the fan to the person it started from.
- **Since:** fan app 1.8.0; the new fan with shapes, colours and pedigree collapse app 3.20.0
- **From app 3.27.0:** a union without a date of marriage is ordered by the latest date the marriage can have
  been: the earlier of the end of the union (a divorce) and the birth of the union's first child. A marriage “before
  1982” comes before a marriage in 1982. A union without these dates comes after the others. The partners next to a
  person and the marriage-order marks (“1. ∞”) on the cards follow the same order.

<!-- zdroj: app:src/fan-chart.ts FAN_MIN_GENERATIONS, FAN_MAX_GENERATIONS, FAN_DEFAULT_GENERATIONS, parentSlots, repeatOf · strings.ts fan.shapeHalf, fan.shapeFull, fan.shapeTwo, fan.colorGender, fan.colorLine, fan.colorRod, fan.legendRepeats, fan.originPerson, fan.showFirst, fanChart.kekuleHint · settings fanKekule (výchozí false) · spec 029 · CHANGELOG.cs.md 3.20.0 · 3.30.0: app:cecd72a4 src/fan-colors.ts LINE_HUE [258, 232, 352, 5], PARENT_LINE_HUE, DESCENDANT_LINE_HUE 82, parentLineColor, descLineColor (dřív 50/95/215/320, rodiče 70/250, potomci 150) · 3.27.0: app:ad1ca16c src/marriage-order.ts marriageKey (BOUND 0.5, qualifier „<“; bez sňatku min(endDate, narození dětí)), marriageDates, compareMarriages, marriagesInOrder (partneři vedle osoby, značka „1. ∞“) · src/fan-chart.ts familiesOf · CHANGELOG.cs.md 3.27.0 · dirigent:prace/1109-app-tester-vlna1 (T50, T13) -->

<a id="A6.4.1"></a>
### A6.4.1 Family line colours and highlighting a family line

In the colours **Family lines** each family line in the fan has its own colour, and the colour says on which side of
the fan the line is: the father's side cold shades of blue and green, the mother's side warm pink and orange, the
descendants (the shape Two-way) ochre.

- **The side of a family line:** the central person's family line belongs to the father's side. A line that is in the
  fan only among the descendants belongs to the descendants. Every other line belongs to the side where it is nearest
  to the centre (in the lowest ring); on a tie to the father's side.
- **Order of the lines:** by the number of sectors in the fan (a repeated person counts each time), then by the size
  in the tree. The first ten lines with at least two sectors and the central person's line have a strong shade, the
  others a muted one.
- **Grey** are only persons without a family line, unknown persons (?) and empty places (+). Every family line in the
  fan has a colour.
- **Neighbours:** when a side's shades run out, they repeat, but never on neighbouring sectors (side by side, across
  a generation, nor across the seam of the full circle), and a newly given shade not even one sector further. A line
  takes a shade of another side only when none of its own is distinct enough.
- **Memory of the colours:** the window remembers the shade of every family line, also of a line not in view right
  now. After re-centring and after a return to an earlier centre the lines have the same colours. A remembered shade
  gives way only to a neighbour with the same shade, so after a return the same shade can appear one sector further.
  A new line first gets a shade that no line remembers. The memory is gone after leaving the view or the tree;
  another window ([A6.8](#A6.8)) takes it over from the main window.
- **Legend:** the groups **Father's side**, **Mother's side** and **Descendants**; in each first the central person's
  line ("· centre"), then the lines by the number of persons in the fan ("7×"). The main part holds at most twenty
  lines with at least two sectors and the central person's line.
  - **Other · N lines** folds the smaller lines into one row with a two-tone sample and a number of persons (persons
    without a family line count here). Unfolded, it shows the smaller lines in their colours, by number and name.
    Unfolding is remembered on the device.
  - **no family line** is inside **Other**, and when **Other** is missing, a row of its own.
  - The rows are buttons in one stop of the Tab key (arrows, Home, End). Hovering the mouse over a row highlights the
    line as a preview.
- **Highlighting a family line:** a click on a legend row or **Highlight the {line} family line** in the sector's menu
  highlights the tree's family line ([A6.6](#A6.6)), as in the Family view. The line's sectors have a dashed outline,
  the others are subdued. The highlight stays after re-centring. A second click, **Clear the family line highlight**,
  × on the label or Esc clears it. When fitting, the fan keeps clear of the band with the highlight's label; a zoomed
  view stays as it is. From app 3.31.0 the highlighted family line is the window's selection ([A6.6](#A6.6)): it holds
  in Family and Descendants too, and clearing the highlight clears the window's selection.
- **Phone:** a tap on a row in the legend sheet highlights the line (or clears it) and closes the sheet. The colours
  chip then shows the line's sample and name instead of the dots. **Tablet:** the legend rows have the size of
  a control.
- **Image, poster and print:** the highlight carries over (dashed outline, the other fills lighter), the subtitle says
  "{line} family line highlighted" when a person of the line is drawn. The poster's legend is by sides, the
  highlighted line bold and underlined. The highlight labels are not printed.
- **Limits:** the fan on the person page has only the gender colours.
- **Controls:** **Colours** › **Family lines**; the legend rows; in the sector's menu **Highlight the {line} family
  line** / **Clear the family line highlight**; × on the label; Esc.
- **Since:** app 3.30.0 (the colours **Family lines** since app 3.20.0; up to 3.29.0 only the ten largest lines in
  colour, the others grey)

<!-- zdroj: app:src/fan-rod-assign.ts (strany P/M/D: rod středu P, jen potomci D, jinak nejnižší prstenec, shoda P; pořadí počet výsečí › velikost › id; FAN_ROD_MAX_STRONG 10, FAN_ROD_LEGEND_MAIN 20, tier S/T; opakování odstínů ne na sousedních výsečích ani o jednu dál, výpůjčka jiné strany) · src/fan-colors.ts paleta P/M/D světlá, tmavá, tisk, fanRodLegend, fanRodOtherSwatch (K1.7), legendOther, legendNoRod · src/ui/fan-view.ts legenda (FAN_STORAGE_KEYS.legendOtherOpen, náhled jen při (hover: hover)), setRodSelection(…, 'legend'), forgetRodColors · strings.ts fan.legendFatherSide, legendMotherSide, legendDescendants, legendOther, legendNoRod, legendCentre, colorsChipRod, menuHighlightRod, menuUnhighlightRod, posterHighlighted · app:1d9dad0f, 7231dd13 (legenda po stranách), 77282e4e (telefon, tablet), b31c74a9 (štítky se netisknou), defe20a6, 7821ea72 (vějíř mimo štítek), 1ad91795 (paleta P/M/D), a265a3cc (paměť barev při návratu, další okna) · dirigent:spec/114-vejir-barvy-rodu · test/vysledek-1119-app-vejir-rody, vysledek-1119-app-vejir-barvy-vse · CHANGELOG.cs.md 3.30.0 · 3.31.0: src/ui/rod-view.ts selectRodFromFan → setRodSelection / clearRodSelection = clearSelection (app:51ad8fd6) -->

<a id="A6.4.2"></a>
### A6.4.2 Fan appearance

The button **Appearance** in the fan's bar (in a narrow bar only an icon) opens the panel **Fan appearance**. It
changes how the fan looks, not the tree: it works also in a read-only tree, while following a research and in a saved
page.

- **Style:**
  - **Colour** (for the screen): the default, the drawing as before;
  - **Pastel** (less ink);
  - **Antique** (as a gift): sepia and parchment, the font Strom Serif;
  - **Black and white** (black-and-white printer): shades of grey and patterns (lines, grid, dots, rings, crosses,
    dashes), none of them diagonal. Diagonal hatching stays only for a repeated person (pedigree collapse).

  Each style has a version for the light and the dark appearance and for print.
- **Family line colours** (only for the colours **Family lines**, otherwise "Only for colours by family line."):
  - **All lines**: colours as in [A6.4.1](#A6.4.1);
  - **Main lines**: "the 10 largest in the fan in colour, the others grey." The central person's line is always among
    the main lines (it replaces the tenth). The legend has a grey row **Other lines (N)**, the poster's subtitle "colours
    of the main lines". The colours of the main lines and the memory of the colours do not change.
- **Text in the sectors:** **Name and years** (default) · **Name, dates and places** (birth and death with the date and
  the place, of the place only the part before the first comma, for example "* 22 Nov 1888 Kessenau"; only where it
  fits) · **Names only** (in a slightly larger font). "Where the text does not fit, it is shortened."
- **Portraits** (off by default): a round portrait; in app 3.31.0 ("In the centre, for parents and grandparents") in
  the centre and in the first two rings, from 3.32.0 in every ring (**From app 3.32.0** below). A protected living
  person has no portrait. The text takes precedence: a portrait for which no
  room would be left is not drawn. While loading, the panel says "Portraits loading (k / n)"; "Nobody in the fan has a
  portrait yet."
- **Three levels of appearance:**
  - the **default** appearance is in **Settings → Fan** (style, family line colours, text, portraits) and the device
    keeps it: "Every start begins with this appearance; the Appearance panel changes it for the current work only."
    A fan that shows the default appearance takes over a change in Settings right away;
  - the **current** appearance from the panel holds until the app is closed; reloading the page keeps it;
  - the **output appearance** (poster, image, print) is not remembered ([A6.4.3](#A6.4.3)).

  A lower level never overwrites a higher one; only **Save as default** does.
<!-- zdroj 3.32.0: app:a938802d, bcdcab9e, f229be62 src/fan-chart.ts FAN_PORTRAIT_MIN_PX 32, portraitOf (každý prstenec předků i potomků, dPx < portraitMin → nic, fotka se pak ani nežádá; text výseče jako bez portrétu), opts.portrait jen pro výseče v pohledu, ne chráněná osoba · strings.ts fanLook.portraits, portraitsSub · CHANGELOG.cs.md 3.32.0 · dirigent:spec/118 K2.7, K2.8 -->
- **Panel footer:** when the appearance differs from the default, "Differs from the default appearance." with **Save
  as default** ("Saved as the default fan appearance.") and **Back to default**; the button **Appearance** then
  carries a dot. Otherwise "Default appearance · can be changed in Settings"; the link opens Settings at the group
  **Fan**.
- Another window ([A6.8](#A6.8)) starts from the current appearance of the main window and keeps its changes to
  itself.
- **Phone:** **Colours** and **Appearance** are tabs of one sheet from below; the sheet opens on the one used last.
- **Limits:** the fan on the person page does not change (only the gender colours).
- **Controls:** the fan's bar → **Appearance**; **Settings → Fan**.
- **Since:** app 3.31.0; 3.32.0: portraits in every ring
- **From app 3.32.0:** **Portraits** "Ancestors and descendants where there is room; zooming in shows more": a round
  portrait in the centre and in any sector of any ring, for ancestors and (in the shape Two-way) also for descendants
  and partners.
  - A portrait is drawn only where at the current zoom it has a diameter of at least 32 px and the sector's text
    beside it says the same as without it; otherwise the sector has no portrait. The text still takes precedence.
  - Zooming in shows the portraits of the outer rings; photos are loaded only for the sectors that are visible and
    would show a portrait.
  - On the poster and in print a portrait has a diameter of at least 7 mm on paper ([A6.4.3](#A6.4.3)).

<!-- zdroj: app:53ad42f1 src/fan-look.ts (hlavička: tři úrovně, ne úprava stromu, další okno; FAN_LOOK_DEFAULT color/all/years/portraits false), storage-keys.ts FAN_STORAGE_KEYS, FAN_LOOK_SESSION_KEY · 2236bbd4 src/fan-rod-assign.ts (rodScope main: 10 největších, rod středu vždy), src/fan-colors.ts FAN_STYLES, FAN_PATTERNS (vl, hl, grid, dot, dot2, ring, plus, dash), palety světlá/tmavá/tisk · c2dc2520 src/fan-labels.ts (content years/places/names, místo před čárkou), src/fan-chart.ts portréty prstence 1–2, chránění žijící, text má přednost · 2e9d8ad0 Nastavení → Vějíř (index.html settings-group-fan, setFanDefaultLook; vějíř s výchozím vzhledem změnu převezme) · e07ed419 (stránka osoby) · strings.ts fan.look*, style*, scope*, content*, portraits*, lookDiffers, lookIsDefault, lookSaveDefault, lookResetDefault, lookSavedToast, defaultsDesc, textNote, legendOtherGrey, posterColorsMain · SPEC.md 1120-app-vejir-vzhled · spec 118 K1.1–K2.6 · CHANGELOG.cs.md 3.31.0 -->

<a id="A6.4.3"></a>
### A6.4.3 Poster appearance

The dialog **Export as poster** (menu **Export poster**: SVG, PNG, Print / PDF) has for the fan the group **Poster
appearance** with the same options as the panel **Appearance** ([A6.4.2](#A6.4.2)) and with **Preview**.

- The options are prefilled with the appearance from the screen. "Applies to this output only; the screen and the
  default stay as they are." A changed option carries "changed for this output only"; **As on screen** returns the
  appearance of the screen.
- In another style or colouring the family lines keep the colours from the screen.
- On a phone the group is folded into one row.
- **Limits:** the output appearance is not remembered; the next export starts again from the appearance of the
  screen.
- **Controls:** **Export poster** → **Poster appearance**.
- **Since:** app 3.31.0
- **From app 3.32.0:** with **Portraits** switched on, the poster and the print of the fan (also Ctrl+P from the view
  on an A4 landscape sheet) draw a portrait where it has a diameter of at least 7 mm on paper; otherwise the same holds
  as on the screen ([A6.4.2](#A6.4.2)).

<!-- zdroj 3.32.0: app:a938802d, bcdcab9e, f229be62 src/fan-chart.ts FAN_PORTRAIT_MIN_MM 7, renderFanPoster portraitMinPx = 7 mm / mmPerPx (0,26), fanPrintPortraitMinPx (A4 na šířku 277 × 0,85·190 mm, ne pod 32 px) · src/ui/fan-view.ts printing → fanPrintPortraitMinPx · dirigent:spec/118 K2.8 -->

<!-- zdroj: app:2e9d8ad0 src/ui/export-image-ui.ts (PosterLook předvyplněný z obrazovky, náhled toutéž funkcí plakátu, Jako na obrazovce, sloty rodů z obrazovky, telefon jeden řádek), src/fan-look.ts (vzhled výstupu se nepamatuje) · e2e/fan-look-output.spec.ts · strings.ts poster.menu, title, lookTitle, lookPreview, lookOnlyHere, lookAsScreen, lookChanged · SPEC.md 1120-app-vejir-vzhled · spec 118 -->

<a id="A6.5"></a>
## A6.5 Map

The Map shows the places of people's events.

- **Scope:** **This view** (default, the people of the view) · **Whole tree**. From app 3.31.0 there is
  **Selection** between them, the people of the window's selection ([A6.5.7](#A6.5.7)), and the main window remembers
  the chosen scope for each tree.
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

<!-- zdroj: app:src/places.ts collectPlaces, groupTownPoints · src/ui/map-ui.ts (localStorage strom.map.kinds) · strings.ts map.scopeView, map.scopeTree, map.kinds · CHANGELOG.cs.md 3.21.0 · 3.31.0: app:src/settings.ts mapScopeByTree, getMapScopeForTree, setMapScopeForTree · src/ui/map-scope-ui.ts (jen hlavní okno) · spec 098 -->

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
    line), so the family lines can be told apart with weaker colour vision too. The two quarters of the same side (the
    father's blue and teal, the mother's pink and raspberry) differ in lightness and in pattern. The light and the
    dark appearance have their own shades;
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
- **From app 3.30.0:** the quarters in the shades of the **Lineage markers** ([A6.1.5](#A6.1.5)): the father's side
  blue and teal, the mother's pink and raspberry. Up to 3.29.0 other shades.

<!-- zdroj: app:src/map-line-colors.ts (LINE_HUE z fan-colors.ts jako vějíř Linie, tabulka OKLCH světlý/tmavý, QUARTER_DASH, lineCap, LINE_WIDTH base 3 / fresh 4 / trunk 4.5, pathLineOpacity max(0.55, 1 − věk/60·0.45), LINE_FOCUS_DIM, pointFill, lineSwatch; hlavička: dvojice 50↔95 a 215↔320 se liší světlostí i vzorem; app:cecd72a4 LINE_HUE 258/232/352/5, tabulka OKLCH q0–q3, e1–e7 (dvojice téže strany se liší světlostí)) · src/map-lines.ts lineClassOf (gen ≤ 2 kmen), pointClassOf (rodiče kmen), branchSurname (rodné příjmení, jinak křestní), quarters/eighths · src/ui/map-path-ui.ts drawMapPathLayer (čísla osmin na nejdelší viditelné čáře, LEGEND_WIDTH) · src/ui/map-lines-legend-ui.ts mapLinesLegendHtml (eighthsOff < 2 známé osminy, řádky, neznámý, kmen, pata), mapLinesImplexText, toggleMapLineFocus, setMapLineHover, setMapLineMode (připnutí pryč), setMapLineColors, setMapLegendCollapsed, openMapLinesSheet / closeMapLinesSheets, mapLinesUndatedHtml, offTimeline (count 0: is-unknown, is-off-timeline, swatch is-empty, app caea192a) · strings.ts map.linesOffTimeline, map.linesTitle, linesChip, linesQuarters, linesEighths, linesCollapse, linesRow, linesUnknown, linesTrunk, linesOff, linesImplex, pathUndated, pathUndatedList, pathUndatedTitle, lineE8–lineE15; fan.lineFatherFather… · app 388e5a87, b01693bc, 5853882e, 8e27df4a, 34e82d43 (app:81f2adf0) · spec 054 K1.1, K1.2 · CHANGELOG.cs.md 3.28.0 -->

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

<a id="A6.5.7"></a>
### A6.5.7 The map with the scope Selection

With the scope **Selection** the map works only with the people of the window's selection ([A6.6](#A6.6)).

- **What is counted from the selection:** the places' points, the counts in the bar, the places to look up in the
  research ([A6.5.2](#A6.5.2)), **Migration over time** with its range of years ([A6.5.3](#A6.5.3)) and the
  ancestors' path ([A6.5.4](#A6.5.4)).
- **The part Selection** of the scope switch carries the selection's name and the number of people ("Line Horák ·
  14"); a window without a selection has only **Selection ▾**. A click on a part that is not chosen switches the
  scope at once. A click on the chosen part or on the part without a selection opens the selection menu
  ([A6.6](#A6.6)). A selection chosen on the map is the window's selection: Family then highlights it.
- **A place with people outside the selection:** the place's panel shows only the people of the selection and under
  them "and {n} people outside the selection ·" with **Whole tree** (switches the scope). A marriage of which only one
  partner is in the selection is shown on the map; the panel lists only that partner.
- **Finding a person on the map:** a person outside the selection has the label "outside the selection" in the result
  and the link **Show in the whole tree** (switches the scope to **Whole tree**).
- **The path to a person:** the choice of the path's person offers only people of the selection. When the path's
  target is outside the selection, the path chip is dimmed with "· outside the selection", the path is not drawn and
  the bar says "The path's person is outside the selection – the path is not shown."
- **An empty selection:** in the middle of the map "The selection is empty."; a selection none of whose people has a
  place: "No one in the selection has a place yet." with a link to the people without a place ([A6.5.8](#A6.5.8)).
  The status bar is not shown then.
- **Clearing the selection or its end** returns the scope to **This view**. The scope **Selection** remembered for a
  tree holds only when the window has a selection after the tree opens.
- **The Places window** opened from the map has the same scope switch (the part **Selection** only when the window
  has a selection) and changes both the map's scope and the list of places. Opened from elsewhere it shows the places
  of the whole tree.
- **Phone:** instead of the switch there is the button **Scope: {name} ▾** next to the kinds of events. It opens the
  sheet **Scope**: the section **Map scope** (three scopes with numbers of people), **Change the selection** (at
  most 5 selections: family lines, the central person's ancestors, lists) and **All selections…** (the whole
  selection menu). A phone held sideways has the switch as on a computer.
- **Controls:** app: map → the scope switch **This view** · **Selection** · **Whole tree** (phone **Scope: … ▾**);
  **On the map** at a list of people ([A11.3](A11-lists-of-people.md#A11.3)) and in the Table's **⋯**
  ([A6.7.19](#A6.7.19)).
- **Since:** app 3.31.0

<!-- zdroj: app:src/map-scope.ts mapScopePersonIds · src/ui/map-ui.ts mapScopePersons (body, počty, mapMissingPlaces, mapTimeHarvest, map-lines) · src/ui/map-scope-ui.ts (díl Výběr: nezvolený → rozsah hned, zvolený nebo bez výběru → nabídka; vyprázdnění selEmpty / selNoPlaces; mimo výběr popupOutside, popupWhole, outside, showInTree; zrušený / zaniklý výběr → 'view'; zapamatovaný 'sel' jen s výběrem; list Rozsah s selectionQuickRows(5)) · src/ui/selection-picker-ui.ts selectionQuickRows (2 rody, předci, seznamy, další rody) · src/places.ts collectPlaces (fact.persons.filter(kept): sňatek jen s osobou výběru) · src/ui/map-path-ui.ts (osoby cesty z výběru, pathOutside) · src/ui/places-manager-ui.ts (rozsah okna Místa jen z mapy) · strings.ts map.scopeSel, scopeSelNamed, scopeAria, scopeGroup, scopeBtn, scopeSheet, scopeSheetSec, scopeViewHint, scopeChange, scopeAll, selEmpty, selNoPlaces, selUnplacedLink, outside, showInTree, popupOutside, popupWhole, popupSelCount, pathOutside · app:90c09692, 95752f6d, 74d3a34e · ZADANI_DEV_vyber-osob §3, §4, §10 · spec 098 (spec 120 K1.1–K1.3) · dirigent:test/vysledek-1121-app-098-vyber-p1.md -->

<a id="A6.5.8"></a>
### A6.5.8 People of the selection without a place

In the scope **Selection** the map's status bar has a second row "{n} people in the selection have no place ›" when
at least one person of the selection has no place in any kind of the map (birth, death, marriage or divorce, other
events of the person and of the couple). A place without coordinates counts as a place.

- A click opens the **Table** with the people of the selection and the chip **No place** on ([A6.7.6](#A6.7.6)): for
  a list in the scope of that list, for another selection in the scope "Selection: {name}" ([A6.7.19](#A6.7.19)).
  The chip can be switched off like other filters.
- **Limits:** the row is not shown when everyone has a place, while coordinates are being looked up, and on an error
  or offline.
- **Controls:** app: map → status bar → "… have no place ›"; on an empty map the link "{n} people without a place ›".
- **Since:** app 3.31.0

<!-- zdroj: app:src/places.ts personHasMapPlace (narození, úmrtí, události osoby, svazek start/end/události; místo bez souřadnic se počítá) · src/ui/map-ui.ts renderMapStatus (map-status-unplaced, ne při geocodingu, chybě, offline) · src/ui/map-scope-ui.ts (Tabulka v rozsahu výběru s filter noPlace) · src/ui/table-view/table-ui.ts openTableForSelection · src/ui/table-view/table-filter.ts CHIP_ORDER noPlace · strings.ts map.selUnplaced, selUnplacedLink, table.chip.noPlace, chipNoPlaceTitle · app:2a578474, 39020cf1 · ZADANI_DEV_vyber-osob §5 · spec 120 K1.4 -->

<a id="A6.6"></a>
## A6.6 The selection of people

The selection is one named group of people a window has. It holds in all views of the window: Family, Descendants and
the Fan highlight it, the Map can show it alone ([A6.5.7](#A6.5.7)) and the Table can have it as its scope
([A6.7.19](#A6.7.19)). The selection is not stored in the tree's data; lists of people
([A11](A11-lists-of-people.md)) stay as they are.

| Selection | Who is in it | Name on the label and in the menu |
|---|---|---|
| family line | the real members of the family line ([A4](A4-surnames-and-families.md)) | Line {line} |
| ancestors of a person | the person's ancestors as the rule **Ancestors of a person** ([A11.2](A11-lists-of-people.md#A11.2)): all generations, or 1 to 10 | Ancestors: {person} |
| descendants of a person | the person's descendants as the rule **Descendants of a person**, all generations or 1 to 10 | Descendants: {person} |
| research line | the people of the research line as the rule **Research line** | Research line: {line} |
| list of people | the people of the list | List: {list} |

- A window has at most one selection. The selection's people are counted again after each change of the tree (an
  automatic list and the rule of ancestors, descendants and a line too). Placeholder persons and people no longer in
  the tree do not belong to the selection.
- **Highlight** in Family, Descendants and the Fan: the selection's people fully, the others subdued. For a family
  line, wives and husbands who married into it are shown more faintly; they are not in the selection.
- **The selection's label** above the tree: "{name} · {n} people ▾" (opens the selection menu, [A6.6.1](#A6.6.1)),
  **Hide others** ([A6.6.2](#A6.6.2)), **Next person ›** (focuses the next person of the selection) and × **Clear the
  selection** (also Esc). An empty selection has a label with the count 0 and **Next person ›** cannot be used. The
  label is not shown on the Timeline and on the Map.
- **Another highlight** (evidence, checks, live changes) covers the selection for a while and the label belongs to
  it. When it ends, the selection returns; **Hide others** does not hold while it is covered. Choosing a selection
  ends another highlight.
- **Nothing of the selection is drawn** (after choosing a selection, not after restoring it from memory):
  - Family and the Fan move the central person to the person of the selection fewest steps away (through parents,
    children and partners; on a tie to the one born earlier). When the selection is not connected to the person, the
    central person goes to the founder of the family line or to the person whose ancestors or descendants they are;
    for a line and a list to the earliest-born person of the selection;
  - Descendants always moves the central person to the founder of the family line, the person of the ancestors or
    descendants, otherwise to the earliest-born;
  - the notice "Focus: {person}, selection {name}" has **↩ Back**.
  - On the Timeline, on the Map and in the Table the central person does not move.
- **Controls:** app: **Selection ▾** in the bar of Family, Descendants and the Fan; in the person's menu **Select ›**;
  the selection's label; on a phone **More → Selection** ([A6.6.1](#A6.6.1)).
- **Since:** app 3.21.0 (only a family line: **Family lines** in the bar, in the person's menu **Only the … line**);
  3.31.0: the selection of people (family line, ancestors, descendants, research line, list), the menu
  **Selection ▾**, **Hide others**

<!-- zdroj: app:src/view-selection.ts (SelectionRef rod / ancestors / descendants / line / list; selectionPersonIds: realRodMembers, rulePersonIds, listPersonIds; cache na lineage index = změnu dat; selectionLabel předpony) · src/ui/view-selection-ui.ts (jeden výběr okna, selectionGroup: rod faint realRodSpouses, zakrytí jinou skupinou a návrat selectionUncovered, setSelection ukončí jinou skupinu, ne přesun při 'restore') · src/ui/evidence-ui.ts (kind 'selection': štítek ▾ otevře nabídku, Skrýt ostatní, Další osoba, × a Esc = clearSelection; prázdný výběr 0 a Další nedostupné) · src/ui/rod-view.ts moveFocusToSelection (ne timeline, map, table) · src/rod-focus.ts selectionFocusTarget (nejméně kroků, shoda dříve narozený; root = zakladatel / osoba předků a potomků; jinak nejdříve narozený; Potomci vždy root) · strings.ts selection.pill, hideOthers, clear, moved, prefix · app:51ad8fd6, cb97070c, 61873988, 39e84ca0, e5da4a61 · ZADANI_DEV_vyber-osob §0, §1, §8, §9, §12 · spec 098 Rozhodnutí 1–5 (Milan 21. 11. „jak doporucujes“) · dřív: src/ui/rod-view.ts, spec 039, CHANGELOG.cs.md 3.21.0 -->

<a id="A6.6.1"></a>
### A6.6.1 The menu Selection ▾

One menu chooses the window's selection everywhere: in the tree's bar, on the selection's label, in the part
**Selection** of the map's scope switch and on a phone in the sheet **More**.

- **Contents** from the top:
  1. the field **Find a line, person, list…**;
  2. for a selection of ancestors or descendants the block **Window selection**: the name and the count, "Person:
     {person}" with **Change…** and **Generations** (− and +: all, or 1 to 10);
  3. **No selection** (whole tree, the number of the tree's people);
  4. the section **Family lines** as the earlier list **Family lines** ([A4.4](A4-surnames-and-families.md#A4.4)):
     family lines with the bar of their period and their count, and **Other families**; only when the tree has a
     family line that is not small;
  5. the section **Ancestors and descendants**: "Ancestors: {central person}" and "Descendants: {central person}" with
     counts, in the heading **Another person…**;
  6. the section **Research lines**, only in a tree with lines;
  7. the section **Lists of people**: lists by name with the icon of the kind, the kind (an automatic one with its
     rule, a checklist with "a of b left") and the count; without lists "The tree has no lists yet.";
  8. **Save the selection as a list…** (a selection that is not a list; not in a read-only tree) opens a new list
     with the selection's rule ([A11.6](A11-lists-of-people.md#A11.6)); **Lists of people…** opens the management of
     lists.
- **Search** goes through family lines (also the name's forms), lines, lists and people, regardless of diacritics.
  Found people (at most 5, with years and place) are in the section **People** with the rows "Ancestors: …" and
  "Descendants: …".
- **The person's menu:** **Select ›** offers the person's family lines (the line by birth first, then lines the
  person married into, with at least two real members), **Ancestors** and **Descendants** with counts (without them
  when the person has no ancestors or descendants). When the person is in the window's selection, **Clear the
  selection** is under it.
- **Phone:** the tree's bar has no button; in Family, Descendants and the Fan the sheet **More** has the row
  **Selection** with the selection's name (without a selection **No selection**), not on the Timeline, the Map and in
  the Table. The menu is a sheet with the search field at the top. A phone held sideways has the row **Selection** at
  the end of the line **View**. A tablet has **Selection ▾** on the right of the top bar.
- **Controls:** app: **Selection ▾** in the bar of Family, Descendants and the Fan; the name ▾ on the selection's
  label; the person's menu **Select ›**; phone **More → Selection**.
- **Since:** app 3.31.0

<!-- zdroj: app:src/ui/selection-picker-ui.ts (lišta Rodiny, Potomků, Vějíře, ne timeline/map/table; tablet vpravo; každý strom s osobami; MAX_GENERATIONS 10 pak všechny; FOUND_LIMIT 5; rody jen když rodPickerOffered – ne jen malé rody; pole hledání vždy (rod-picker.ts:382); canSave ref ≠ list && !listsReadOnly; saveListOptions; Seznamy osob…) · src/rod-picker.ts selectionPickerHtml (pořadí oddílů, patička) · src/ui/rod-picker-ui.ts wireRodPicker (hledání přes oddíly, bez diakritiky) · src/ui/context-menu.ts (Vybrat ›: rodný rod první, rody sňatkem s ≥ 2 skutečnými členy, Předky / Potomky s počty, Zrušit výběr když osoba patří do výběru) · src/ui/bottom-sheet.ts (řádek Výběr v Rodině, Potomcích, Vějíři; na šířku valueInPair na konci řádku Pohled) · strings.ts selection.* · app:61873988, 07fd4946, a273ef05, 1eb97c1f, 8cfb01da · ZADANI_DEV_vyber-osob §2, §10 -->

<a id="A6.6.2"></a>
### A6.6.2 Hide others

**Hide others** on the selection's label leaves only the selection's people in Family and Descendants: the other
cards disappear and the tree is laid out again from them alone, within the central person and the depth **Ancestors**
and **Descendants** ([A6.1](#A6.1)). The selection **Ancestors: {person}** thus shows the person's pure pedigree.

- The central person is always drawn ([A6.6.3](#A6.6.3)). The view never draws more cards than without the filter.
- For a family line, wives and husbands who married into it stay with their member.
- Lines are drawn only between people who are both drawn. A family of which only one parent is drawn hangs under that
  parent. People of the selection not connected to the others stand in the row of their generation as separate
  groups, in the order they would have in the full view.
- The tabs of hidden relatives on the cards and **Children and siblings** ([A6.1.3](#A6.1.3)) count only the
  selection's people.
- The card nearest the middle of the screen stays in place after the new layout (otherwise the central person); the
  zoom does not change.
- The choice is remembered with the selection ([A6.6.4](#A6.6.4)) and is switched off when the selection is cleared.
- The **Fan** offers the choice only for the selection **Ancestors: {person}**. The sectors of the other people stay in
  their places as empty dashed outlines (no name, years, fill or **+**) and cannot be opened or reached with the
  keyboard; the selection's sectors and the centre stay where they were.
- **Limits:** with any other selection the Fan does not have the choice (the selection is only highlighted); **Hide
  others** switched on in Family changes nothing there and stays on. Outputs (image, print, export) draw the whole
  view.
- **Controls:** app: the selection's label → **Hide others** (a checkbox); on a phone the label is one row and **Hide
  others** is only a checkbox without text.
- **Since:** app 3.31.0

<!-- zdroj: app:src/layout/pipeline/person-filter.ts (filtr při sběru osob: jen osoby celého pohledu a jejich generace a pořadí, ústřední vždy; restrictSelection: čáry jen mezi nakreslenými, rodina s jedním rodičem pod ním; nespojené osoby ve vlastních skupinách vedle sebe v pořadí celého pohledu) · src/layout/pipeline/index.ts drawnOrder · src/renderer.ts setPersonFilter (Rodina a Potomci; záložky a bulk-family jen osoby výběru tabInView; karta nejblíž středu zůstane, jinak ústřední; přiblížení beze změny; výstupy kreslí celý pohled) · src/ui/evidence-ui.ts (rod: faint partneři do filtru; ve vějíři jen předci: setPersonFilter fan = ref.kind ancestors, syncEvidencePillHide evidence-pill--no-hide) · src/fan-chart.ts buildFanSvg keepOnly (offSector: prázdný čárkovaný obrys, bez +, pointer-events none, aria-hidden; střed vždy) · src/ui/fan-view.ts svgExtras keepOnly (jen obrazovka; výstup fan-chart.ts:1249 bez keepOnly), klávesnice přeskočí · app:493f330c · src/ui/view-selection-ui.ts setHideOthers (pamatuje s výběrem, bez výběru vypnuto) · strings.ts selection.hideOthers, hideOthersTitle · app:39e84ca0, e5da4a61 · ZADANI_DEV_vyber-osob §8 · dirigent:prace/1121-app-098-vyber-p1 (telefon: štítek v jednom řádku, Skrýt ostatní čtvereček 44 px), test/vysledek-1121-app-098-vyber-p1.md -->

<a id="A6.6.3"></a>
### A6.6.3 The central person outside the selection

A central person who is not in the selection stays fully visible in Family and Descendants, also with **Hide others**.
On the card's top edge it has the label "outside the selection"; a screen reader reads "{name} – outside the
selection".

- In the Fan the centre is not subdued; it has no label.
- Following the research agent ([S4.1.7](S4-research-from-the-app.md#S4.1.7)) changes only the central person; the
  selection stays and does not hold back the jumps after the agent. A jump to a person outside the selection is shown
  with the label "outside the selection".
- **Controls:** a click on the card of a person outside the selection.
- **Since:** app 3.31.0

<!-- zdroj: app:src/renderer.ts setEvidenceHighlight (ústřední osoba nikdy dim; mimo výběr card-tag „mimo výběr“, aria; ve vějíři jen střed bez dim) · src/layout/pipeline/person-filter.ts (ústřední vždy) · src/ui/live-follow-ui.ts (skok agenta mění zaměření, výběr nechá a skoky nezdržuje) · strings.ts selection.outside, outsideAria · app:39e84ca0, e5da4a61 · ZADANI_DEV_vyber-osob §7 (sledování), §9 -->

<a id="A6.6.4"></a>
### A6.6.4 The selection in windows and in memory

The selection belongs to a window and holds in it across views. For a tree the main window's selection is
remembered.

| What | Main window | Another window ([A6.8](#A6.8)) |
|---|---|---|
| the selection and **Hide others** | remembered for each tree on the device; after the tree opens it returns and the central person does not move | on opening takes over the selection of the window it was opened from; then has its own and keeps it until closed (also after F5) |
| the map's scope ([A6.5](#A6.5)) | remembered for each tree | takes it over on opening, then its own |

- A change of the selection in one window does not change the other windows. The exception is **On the map** from the
  Table of another window: the main window carries it out ([A6.7.19](#A6.7.19)).
- **A selection that is gone** (a deleted list, a family line that ceased to exist, a removed research line, a
  deleted person of ancestors or descendants): the selection is cleared, **Hide others** is switched off and the
  map's scope **Selection** returns to **This view**. When the selection was visible (the highlight in Family,
  Descendants or the Fan, the Map with the scope **Selection**), a notice says why: "Selection cleared: the list
  “{list}” was deleted.", "Selection cleared: the {line} line is gone.", "Selection cleared: the research line was
  removed.", "Selection cleared: {person} was deleted."
- A locked tree or a tree still loading does not drop the remembered selection; it applies after unlocking or
  loading.
- The earlier choice of a family line (up to app 3.30.0) is taken over as a selection of the family line.
- **Since:** app 3.31.0

<!-- zdroj: app:src/settings.ts selectionByTree (migrace rodByTree → { ref rod, hideOthers false }), mapScopeByTree · src/ui/view-selection-ui.ts (hlavní okno zapisuje, další okno jen stav okna; adoptWindowSelection; obnova bez přesunu; selectionDataChanged: zaniklý výběr zrušen, hideOthers vypnuto, toast jen když byl vidět; zapomenout jen u skutečně načtených dat; pending u zamčeného stromu) · src/windows/view-window-state.ts (selection, mapScope v přenášeném stavu; F5) · src/windows/window-show-on-map.ts · src/ui/map-scope-ui.ts (zrušený / zaniklý → 'view') · strings.ts selection.goneList, goneRod, goneLine, gonePerson · app:9f1fe7c4, 27e6a511, 287d10d5, f5e531e9 · ZADANI_DEV_vyber-osob §7, §12 -->

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
    **Family line** ([A6.7.6](#A6.7.6)), from app 3.31.0 also the window's selection as the scope
    ([A6.7.19](#A6.7.19));
  - the research's columns, chips and views are only in a tree from the research ([A6.7.14](#A6.7.14));
  - a read-only tree (a followed tree, a tree saved by a newer version of the app, a locked tree) the table only
    shows: “Read only: edits and “Not an error” are not available here.” Browsing, filter, sort and CSV and XLSX
    export work; a view cannot be saved, renamed or deleted;
  - the arrows **↩ ↪** in the bottom left corner (the previous and the next central person) and Alt+← / Alt+→ are not
    in the Table: the table neither shows the central person nor changes it while working;
  - **from app 3.30.0** Alt+← / Alt+→ in the table go back and forward through the jumps over people's names
    ([A6.7.16](#A6.7.16)); even so they do not change the central person.
- **From app 3.30.0:** **Scope ▾** narrows the table to a list of people ([A6.7.19](#A6.7.19)) and the Table's **⋯**
  (at every width; on a computer hidden until the table has rows) offers **Group by ›** ([A6.7.20](#A6.7.20)) and
  **Save as list of people…** ([A11.6](A11-lists-of-people.md#A11.6)).
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
- **From app 3.30.0:** for unions, the column **Photo** in the group **Children and sources** with a thumbnail of the
  couple's photo, hidden by default; the filter **with photo** / **without photo**
  ([A12.6](A12-portrait-and-couple-photo.md#A12.6)).
- **From app 3.30.0:** for persons, the column **Added** in the group **Person**, hidden by default: the day the person
  was added to the tree ([A11.7](A11-lists-of-people.md#A11.7)), in the app's language. A person without the date has
  "earlier" in grey italics; the cell is empty, so it is at the end in both directions of sorting and **Only empty**
  finds it. It sorts by the moment of adding (within a day by the time), the date filter by year.
- **From app 3.30.0:** for persons, the column **Lineage** in the group **Person**, hidden by default: the person's
  lineage relative to the tree's central person ([A6.1.5](#A6.1.5)) in words, **Paternal**, **Paternal and
  maternal**, **Maternal**, **Descendant** (with parents of the same sex **First parent's line**, **First and second
  parent's line**, **Second parent's line**), before the text a sign in the chosen shape (with **No shape** only the
  text). A person without a lineage has an empty cell. It sorts in this order, empty ones at the end; the filter by
  values. It has nothing to do with the column **Line** of the group **Research** ([A6.7.14](#A6.7.14)).
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
<!-- zdroj: app:src/ui/table-view/table-columns.ts PERSON_GROUPS, UNION_GROUPS, katalog sloupců (surname marriedSurname || lastName, birthSurname lastName, researchId /^P\d{1,7}$/, eventValues nejnovější první, sortKey jména), pinnedWidth 156 na telefonu · table-state.ts MIN_COLUMN_WIDTH, BAND_WIDTH, lockedColumn · table-checks.ts bandSeverity · table-colpanel.ts panelGroups · table-headmenu.ts headMenuItems · strings.ts table.group.*, col.*, columns, columnsCount, searchColumn, all, pinnedLabel, resetColumns, done, coverageRow, sortAsc, sortDesc, sortAdd, sortAddHint, filterColumn, pin, unpin, moveLeft, moveRight, hide, collapseGroup, expandGroup, computedFrom · commity 89602f35, 49b96d92, e4a35406 · refn (skupina person, textCell p.refn; commit 7e648e24, T54 F3), question, crossTree (crossTreeCell), personStatus (personStatusCell, cardStatus, CARD_STATUS_CLASSES), strings.ts table.col.refn, question, crossTree, personStatus · „Celé jméno“ (id `name`) a sloupec firstName, záhlaví „Ref. číslo“ bez „(REFN)“: commity 79764eba, 8fdf52ca (T54 G10, G3) · 3.30.0: app:45f7ca2a table-columns.ts:732 uPhoto (group uextra, skrytý) · app:0971647c table-columns.ts addedCell (dateCell, sortKey + zlomek dne, bez údaje emptyCell s textem earlier), sloupec added (group person, nenabízí se ve výchozím stavu), strings.ts table.col.added, table.earlier · e2e/person-list-table.spec.ts, src/__tests__/table-view-added.test.ts · app:cecd72a4 table-columns.ts lineage (group person, skrytý, getFocusPersonId, řazení paternal → both → maternal → descendant, prázdné poslední, filtr hodnot), table-grid.ts lineageHtml (znak ve zvoleném tvaru), strings.ts branchColors.tableColumn, tableBoth, tableDescendant, tableSlotBoth · app:675e1c5e strings.ts table.col.rLine „Linie výzkumu“ (do 3.29.0 „Linie“), src/__tests__/table-column-labels-unique.test.ts -->

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
  - **From app 3.31.0:** after **No birth date** there is the chip **No place**: people without a place of birth,
    marriage, death or another event, that is without a place the map would show ([A6.5.8](#A6.5.8)).
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
- **From app 3.30.0:**
  - exclusions add up: each **Without “{value}”** from the cell menu ([A6.7.15](#A6.7.15)) is a separate chip
    “{Column} ≠ {value} ×” beside the column's main filter, in the same column and in another one. × cancels only its
    own chip, **Clear filters** all of them. The chip's form edits only that chip, the form in the header the
    column's main filter;
  - a second **Only “{value}”** in a column adds the value: “Father = A or B” (from four values “A, B +2”), a row
    passes with any of them. **Without** such a value removes it again (with the last one it becomes an exclusion),
    **Only** of an excluded value cancels the exclusion. In a column with values from a list the chosen values are
    added and taken away the same way;
  - the chip “= …” (and the column's header while its filter is **is**) has, instead of a text field, the column's
    values to tick: the ticked ones at the top, the others below them in the column's order, each once (the same
    person, otherwise the same text regardless of letter case and diacritics). A ticked value is added, an unticked
    one disappears, and with the last one the chip disappears. **contains**, **starts with** or **is not** brings back
    the text field with the first ticked value. On a phone the rows of the list are 48 px;
  - a person whose name another person of the tree also shows has the year of birth in the chip, in the list of
    values and in the summary of filters: “Jan Horák (b. 1850)”. Other values are unchanged;
  - the view saves the chips ([A6.7.7](#A6.7.7)), a view saved before opens unchanged and the data version stays.
    An older app applies all the exclusions and from “A or B” only the first value;
  - many chips are shortened with “…”, **Clear filters** stays in the row.

<!-- zdroj: app:src/ui/table-view/table-filter.ts CHIP_ORDER, setChip (Žijící × Zemřelí), personPassesChip (finding: chyba nebo k ověření; unusual; unconfirmed jen researchTree, relN/relB/relD), CHECK_CHIPS, rodChoices, generationSpan, filterKindOf, cellPasses, foldText · table-filterbar.ts SEARCH_DELAY_MS, columnFilterForm, chipChoiceForm · table-state.ts řazení (vzestupně → sestupně → vypnuto; Shift přidá, otočí, odebere; prázdné na konci; Intl.Collator numeric) · strings.ts table.chip.*, chipRod, chipGen, moreN, filters, clearFilters, search, matches, noMatch, checksWait, matchContains, matchStarts, rangeFrom, rangeTo, rangeYears, onlyEmpty, onlyFilled · commity dd1d74bc, e64b8b06, fc746037 · je / není: strings.ts table.matchEquals, matchNotEquals (commit 05d9a9ab, T54 F4) · 3.30.0: app:ec39d469 table-filter.ts isExclusionItem, addWithoutFilter, addOnlyFilter (or, picked), removeColumnItemAt, mainItemIndex, setColumnFilter(at), equalValues · strings.ts joinOr (od 4 hodnot „A, B +2“), table.filterOr · app:8891a860 table-filter.ts columnEqualValues, equalChoices, equalsOf, equalValueLabel, namesakes, table.nameBorn (nar.), table-filterbar.ts (.tv-ff-values, 48 px na telefonu) · CHANGELOG.cs.md 3.30.0 „Filtry Tabulky“ · spec 103 K1.1–K1.5 · dirigent:test/vysledek-1116-app-103-tabulka.md, vysledek-1116-app-103-odkazy-083-razeni.md -->

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
  filter, the sort and the expanding of unions; from app 3.30.0 also the scope ([A6.7.19](#A6.7.19)) and the grouping
  of rows with the collapsed groups of rows ([A6.7.20](#A6.7.20)), not for sources. It does not save the search, the
  selected row or the scroll.
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
- **From app 3.30.0:** the row menu (and the row's panel on a phone) has **Add to list ›** for the row's people, a
  selection across several rows **Add N people to a list ›**; in the scope of a fixed list also **Remove from the
  list** ([A11.5](A11-lists-of-people.md#A11.5), [A6.7.19](#A6.7.19)).
- **Limits:** in a read-only tree there is no **Edit…** and no **Add to list ›**.
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
- **From app 3.30.0:** in the scope of a list of people the first columns are **#** and, for a checklist, **Done**
  (✓) ([A6.7.19](#A6.7.19)); a grouped table has the column **Group** before them ([A6.7.20](#A6.7.20)).
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
  **From app 3.30.0** the menu (also the bottom panel on a phone and a touch device) of a participant who is a
  person of the tree begins with the item **Go to {name}**: a jump to their row in the People table
  ([A6.7.16](#A6.7.16)). The names in the column **Person or couple** stay as they were.
- **A godparent who keeps turning up** ([A5.5](A5-tree-check.md#A5.5)) is in the participant's cell as a **lead**.
- **Controls:** the built-in view **All events**; the row actions ([A6.7.8](#A6.7.8)) concern the first person of
  the row. **Edit…** opens, for an event of a person, editing of the person at that event (for a shared one at the
  first copy), for a birth and death editing of the person, for an event of a couple its dialog, for a marriage and
  divorce the person's relationships on that union.
- **Limits:** placeholder persons have no rows; a birth and death without a recorded fact have no row.
- **Since:** app 3.27.0; 3.28.0: a census at a person is a shared event, a shared event is one row;
  3.30.0: **Go to …** in the participant's menu

<!-- zdroj: app:src/ui/table-view/table-events.ts buildEventRows (narození/úmrtí jen se zapsaným údajem, weddingRow: manželství vždy kromě marriageUnrecorded, partnersStart jen se zápisem; divorceRow), SHARED_TYPES (od 3.28.0 i census, app:34b2174c), shareKey (typ, vlastní název, datum, místo, adresa, poznámka, prameny; datum a místo nebo pramen), mergeParticipants, eventEditTarget, MARRIAGE_COUPLE_TYPES · table-columns.ts EVENT_COLUMNS, eventPersons (pokrevní první), eventAgeCell, eventAge (dny < 366), eventValueCell, eventSourceCell, eventPill, DEFAULT_VIEWS.events · table-filter.ts EVENT_CHIP_ORDER, EVENT_KIND_CHIPS, lifeCategory, participantChip, eventHasParticipant (foldName), setParticipantFilter · table-ui.ts tableNameAction, tableRowAction (event → editTableEvent) · table-checks.ts PARTICIPANT_ROLE, recurring (recurringGodparent v buňkách účastníků) · 3.28.0: app:80c2ffb9 table-events.ts (shareId → jeden řádek, bez shareId odhad podle shareKey), strings.ts table agePerPerson, sharedDiffers, events.sharedCellChanged · strings.ts table.rows.events, group.event, participants, source, col.ev*, godparents, witnesses, officiants, others, chip.ev*, chipParticipant.*, filterParticipant.*, evKind.*, ageDays, viewName.events · commity 8de751c2, 63ed9def · spec 073 §14.1 · dirigent:prace/1110-app-tabulka-p2 · 3.30.0: app:0b833e3d table-ui.ts tableNameAction (goTo první, i v listu isPhoneBar | isCoarsePointer; jména Osoba nebo pár beze změny), strings.ts table.link.goTo · spec 103 rozhodnutí D6 c -->

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
- **Controls:** the built-in view **All sources**. At a row **Open source** and **Edit…**; **Show in tree** is not
  here.
  - **Open source** opens the source viewer (clippings, citations; in it **Edit**, when the tree can be changed).
  - **Edit…** (also a double click, on a phone **Edit…** in the row's panel) opens editing the source straight away,
    the same as in the source manager.
  - After closing, the table is as it was: the selection, the scroll and the active cell. The source manager
    (**Actions → Sources**) still opens from the menu.
  - Up to app 3.29.0 both **Open source** and **Edit…** opened the source manager at that source.
- **Limits:** in a read-only tree (a locked one too) the source is only shown, without edits.
- **Since:** app 3.27.0; **Call number**, **Folio/page**, **Image** and **Other location** (before, **Book, reference,
  folio**) also 3.27.0; the source viewer and editing straight away 3.30.0

<!-- zdroj: app:a97de984 table-columns.ts:898-901 srcSig/srcFolio/srcImageNo, :1026 DEFAULT_VIEWS.sources, přirozené řazení · 8dd21adf table-bar.ts nabídka rozdělení · app:src/ui/table-view/table-sources.ts sourceUsage (PERSON_CITATION_FIELDS, události, PARTNERSHIP_CITATION_FIELDS pro oba partnery, bez zástupných, ne příběh), buildSourceRows (katalog data.sources), sourceReaders (readBy user/research/both) · table-columns.ts SOURCE_COLUMNS, urlCell, shortUrl, readersCell, DEFAULT_VIEWS.sources · table-filter.ts SOURCE_CHIP_ORDER (srcNoPerson persons 0, srcUnread, srcTranscript, srcOnline safeHttpUrl) · table-grid.ts rowTail (source: open + edit) · table-ui.ts tableRowAction (source → openTableSource), openTableSourceId (zamčený strom → showSourceViewer readOnly; od 3.30.0 app:05e24806: bez edit → showSourceViewer, s edit → showEditSourceModal, jen ke čtení → prohlížeč, focusTableAfterSource) · strings.ts table.rows.sources, group.source, group.use, col.src*, chip.src*, readers, act.openSource, viewName.allSources, sources.readBy.* · commity 1a3a49f1, 3cf69ffa · spec 073 §14.2 · dirigent:prace/1110-app-tabulka-p2 · odkaz a čip Online: safeWebUrl (http/https, www. → https, rel noopener noreferrer), commit 7e648e24 (T54 F10, F11) -->

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
  opens the bubble **Other citations** (on a phone a bottom panel); a click on a source in it opens the source viewer
  (in it **Edit**), up to app 3.29.0 the source manager. After closing, the table is as it was.
- **Since:** app 3.27.0; the source viewer 3.30.0

<!-- zdroj: app:src/ui/table-view/table-sources.ts factCitations (narození: birthSourceIds + birth/baptism; úmrtí: deathSourceIds + death/burial/cremation; sňatek: sourceIds svazku; neznámé id ven, každý jednou) · table-columns.ts citeCell (první pramen, moreSources), bArch…dUrl (group sources, unionScoped, deathOnly → naCell), godparentsCell (group birth), personGodparents · table-checks.ts personRecurring (sloupec godparents) · table-grid.ts moreCitesHtml · table-ui.ts showTableCites, openTableSourceId (od 3.30.0 prohlížeč pramene, app:05e24806) · strings.ts table.col.bArch…dUrl (bUrl „Narození: URL“, commit 7e648e24, T54 F10); 3.27.0: a97de984 bSig/bFolio/bImage/bRef…dRef, table-bubble.ts, table-events source text, godparents, moreCites, citesTitle · commity 208d8b92, 21a132c1 · spec 073 §14.3, §14.5 · dirigent:prace/1110-app-tabulka-p2 (citace: jen citace v datech, ne FactReliability.sourceIds) -->

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
- **From app 3.30.0:** the research in the Table of another window, the agent's row and the scroll to it, the label
  "The research filter is not applied now": [A6.7.18](#A6.7.18).

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
  - **From app 3.30.0:** **Without** adds a further exclusion beside the earlier ones and a second **Only** in a
    column adds its value (“= A or B”), instead of replacing the column's filter ([A6.7.6](#A6.7.6)). A cell with a
    person's name is a link to their row ([A6.7.16](#A6.7.16)); the row menu also has **Pin row**
    ([A6.7.17](#A6.7.17)).
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

<!-- zdroj: app:src/ui/table-view/table-grid.ts copyKey (Ctrl/Cmd+C, copyPlainText), F2, Enter (has-issue → onIssue, has-finds → onFindings, jinak startEditAt, jinak open), Escape, Tab · table-ui.ts showTableRowMenu (cellPart, cell-edit „Upravit buňku“ s F2), tableCellChoices, tableCellSheetBlocks, :1663 úprava na místě ne v jen ke čtení, archivu, na telefonu (isPhoneBar) · table-edit.ts editTargetOf, PERSON_FIELDS (surname: marriedSurname || lastName, birthSurname, marriedSurname, bDate…burPlace, occ), UNION_FIELDS (wDate, wPlace), editChangeOf (normalizeDateInput, první křest a pohřeb, prázdné pole smaže jen údaj, beze jména neuloží) · strings.ts table.cell.copy, only, without, edit, badDate, nameNeeded, editLabel, onlyEmpty, onlyFilled, matchEquals, matchNotEquals, savedToast · commity 05d9a9ab, be9ca8cd, 28aabdc8 · spec 073 U9 (T54 F4, F8, F9) · T54 2. kolo: table-edit.ts PERSON_FIELDS (firstName, gender, refn, dCause, dAgeRec), UNION_FIELDS (wAgeRec, pAgeRec, rec1, rec2, divDate, divPlace, uStatus), WEDDING_FIELDS (ne u unionWithoutWedding), editOptionsOf (GENDERS, UNION_STATUSES v pořadí formuláře svazku), table-grid.ts select (klik myší uloží hned), commity 8fdf52ca, 79764eba (T54 G3, G10) · nabídka u buňky jiného řádku: commit 400ccda8 (T54 G7) · pole v buňce: table-grid.ts EDITOR_MIN_WIDTH (text 100, date 100, place 140, select 90), placeEditor, commit 80c2ffb9 · panel klepnutím: commit ee38c7a6 · 3.30.0: app:ec39d469 table-ui.ts tableCellChoices (addOnlyFilter, addWithoutFilter) -->

<a id="A6.7.16"></a>
### A6.7.16 Links to people and jumps ‹ ›

In the People and Unions tables the name of a person of the tree in a cell is a link to their row. From a father,
mother, partner, godparent or witness this leads to their row without searching, and back.

- **Where:** the cells of the People and Unions tables that name a person of the tree: **Father**, **Mother**,
  **Partner**, godparents, witnesses, the union's partners. The row's own name (**Full name**) is not a link. The name
  looks like the cell's text and is underlined only under the mouse pointer; the tooltip shows the full name. Several
  names in one cell each have their own link.
- **Jump:** always leads to the People table (also from the Unions table). The person's row is in the middle, the
  column scrolls into view, the cell is active and the row flashes briefly. The target cell:
  - via a partner the cell **Partner** on the row of that union (the union expands), with the name the jump came from
    marked in it while the cell is active;
  - otherwise the cell **Full name**; also when the column **Partner** is not visible.
- **‹ ›:** at the start of the table's bar from the first jump. ‹ brings back the row type, the scroll position and
  the cell the jump started from, and collapses the union the jump expanded; › repeats the jump. The tooltip says
  where (“Back to Jan Horák”, “Forward to Marie Vlková”); without a step in that direction the button is off. The
  steps are only jumps over names, not a manual change of the row type, the view or the filter. The memory holds 50
  steps and each window ([A6.8](#A6.8)) has its own; another tree starts it anew.
- **A person hidden by the filter or the search:** the jump is not made and a strip appears under the bar: “Hidden
  by the filter: {name}.”:
  - **Show for now** shows the row at its place in the sort, dimmed with “outside the filter”, outside the row count.
    It disappears with a change of the filter, sort, view or row type and with ‹;
  - **Clear filters** turns off the filter and the search and makes the jump;
  - × or Esc closes the strip, nothing changes.
  - a person whose row is pinned ([A6.7.17](#A6.7.17)): the jump goes straight to their pinned row under the table's
    header, without the strip.
- **Events:** in the Events table names are not links; the participant's menu begins with **Go to {name}**
  ([A6.7.10](#A6.7.10)).
- **Limits:**
  - only a plain click with a mouse or a pen starts a jump (without Ctrl, Shift, Alt and without dragging). Selecting
    text, editing the cell by a double click elsewhere in the cell and F2 work as before; a double click right after
    a jump does nothing;
  - a finger's tap opens the row panel as before; it begins with the section **People in the cell** with a row **Go
    to {name}** for each person of the cell;
  - the tree's central person does not change with a jump.
- **Controls:** a click on the name; **Enter** on the active cell with one name jumps, with several names it offers
  **Go to…**; ‹ › on the bar and Alt+← / Alt+→ in the table.
- **Since:** app 3.30.0

<!-- zdroj: app:0b833e3d src/ui/table-view/table-grid.ts personLinks (osoba bez role účastníka, ne agregát), namesHtml (tv-nm--jump, title celé jméno), linksIn (ne sloupec name), klik jen isMouseLikePointer bez modifikátorů a e.detail 1, jumpedAt + JUMP_DOUBLE_MS (dvojklik po skoku nic), Enter (tableLinkPick), Alt+←/→ onHistory · table-ui.ts tableNameAction (persons, unions), tableJumpStep (přes p1/p2 nebo partner → via partner), tableJumpBy, tablePersonShown, tableRunJump (rowType persons, setExpanded, flash, jumpTo), tableHistory (rowType, scroll, buňka, zavře rozbalený svazek, ruší dočasné zobrazení), tableLinkPick, showTableRowSheet (link.inCell) · table-jump.ts JUMP_HISTORY_MAX 50, JumpHistory, jumpTargetCell (partner jen je-li sloupec vidět, jinak name) · table-notice.ts (role status, Zobrazit dočasně, Zrušit filtry, ×, Esc) · table-bar.ts updateNav (vidět od prvního skoku, aria-disabled) · strings.ts table.link.goTo, pick, inCell, enterHint, hidden, showTemp; table.nav.back, backTo, forward, forwardTo; table.outsideFilter · e2e/table-view-links.spec.ts · CHANGELOG.cs.md 3.30.0 „Odkazy v Tabulce“ · spec 103 K3.1–K3.3, ZADANI_DEV_tabulka-odkazy-ukotveni D1–D4, D6 · dirigent:test/vysledek-1116-app-103-odkazy-083-razeni.md · ukotvená osoba skrytá filtrem: app:9b2b6dca table-ui.ts tablePersonPinned, grid.jumpToPin (bez pruhu) · spec 103 Rozhodnutí 16. 11. (díl C) -->

<a id="A6.7.17"></a>
### A6.7.17 Pinned rows

A pinned row stays under the table's header while the table scrolls. It serves for comparing rows that are far apart
in the table.

- **How a row is pinned:** the row menu → **Pin row** (after **Edit…**). Text selected across several rows (by
  dragging or Shift+click) and a right click into it offer **Pin rows (n)** for the people of those rows; a union
  sub-row counts as its person. A pinned row has **Unpin row** there instead.
- **How they look:** under the header in the table's order, a person with the sub-rows of their unions as in the
  table's body. The name of a pinned row has a solid pin, its own row in the table's body an outlined one. They take
  at most a third of the table's height; more rows scroll in their own scrollbar. The active cell, editing in the
  cell, the keyboard and the row actions work in them.
- **The filter does not hide a pinned row:** a row that the filter or the search hides stays pinned, dimmed with
  “outside the filter”.
- **The chip** “Pinned rows (n) ×” at the start of the row of filters: × unpins all of them. **Clear filters** leaves
  the pinning.
- **Limits:**
  - at most 10 rows; an item that would go over the limit is off with “At most 10 rows can be pinned.”;
  - pinning holds for one tree and one row type in this window: another tree or row type unpins them, the view, the
    filter and the search do not. It is not saved into the view and the view does not get **changed** because of it.
    After the tree is closed or the page is reloaded it is gone;
  - the order of the pinned rows does not change after an edit until the sort, filter, search or view changes;
  - a row that disappears from the tree is unpinned by itself;
  - only a computer and a tablet (on a tablet in the row panel). A phone, even turned to landscape, has no pinning.
- **Controls:** the row menu (right button, Shift+F10) **Pin row** / **Pin rows (n)** / **Unpin row**; the chip
  **Pinned rows (n)** with ×.
- **Since:** app 3.30.0

<!-- zdroj: app:354e3675 src/ui/table-view/table-pins.ts PIN_MAX 10, TablePins (jeden strom a typ řádků; pohled, filtr, hledání je nechají; jen paměť okna, ne v pohledu), prune, ordered (pořadí do změny řazení, filtru, hledání, pohledu; D7 a), pinRanks · table-ui.ts tableRowPinEntry (ne isPhoneBar; many z tableAreaRowKeys, unpin, disabled + limit), tablePinnedLines (podřádky svazků jako v těle, D5 a; outside), showTableRowSheet (tablet), changeTablePins · table-grid.ts .tv-pinrows (role rowgroup, nejvýš třetina těla s vlastním posuvem), tv-outside · table-filterbar.ts štítek pinRow.chip s × (unpinAll; Zrušit filtry ukotvení nechá) · strings.ts table.pinRow.one, many, unpin, chip, unpinAll, zone, rowSr, limit; table.outsideFilter · e2e/table-view-pins.spec.ts · CHANGELOG.cs.md 3.30.0 „Odkazy v Tabulce“ · spec 103 K4.1–K4.4, D5, D7 · dirigent:test/vysledek-1116-app-103-odkazy-083-razeni.md -->

<a id="A6.7.18"></a>
### A6.7.18 The research in the Table of another window

The Table in another window ([A6.8](#A6.8)) shows the research as the main window has it: the research columns,
chips and views, the agent's mark at the person they are working on, and their queue ([A6.7.14](#A6.7.14)). Only
the main window talks to the research; another window gets its state. While research is followed, the Table of
another window follows the agent ([S4.1.7](S4-research-from-the-app.md#S4.1.7)).

- **Chips and views:** the group **Research** is in the Table of every window with a research tree. The chips that
  apply only while following are live when the main window follows research, otherwise they are as in the main
  window ([A6.7.14](#A6.7.14)). A saved view with research filters opens the same in both windows.
- **A research filter without research** (in every window, the main one too): a view that filters by the research (a
  research chip or a filter of a research column) shows all rows when the table has no research data, and says next
  to the view's name "The research filter is not applied now". On a phone there is only an amber dot with this text
  in the tooltip.
- **The agent's row:** the row of the person the agent is working on has, in another window, a background in the
  following colour, a line in the name cell and the name in bold, also in a detached window. The main window keeps
  the vertical bar at the name ([A6.7.14](#A6.7.14)).
- **The scroll to the agent:** a window that follows the agent and is not paused scrolls the agent's row to the middle
  when the agent moves to another person and their row is not fully visible. The scroll is smooth (300 ms, at once
  with reduced motion); the active cell, the selection and the focus do not change and nothing scrolls sideways. A
  visible row and a pinned row of the agent ([A6.7.17](#A6.7.17)) do not scroll the table. A paused or detached
  window does not scroll.
- **Pause:** the wheel over the grid, dragging the scrollbar, a press in the rows (a cell, a name) and the keys for
  moving and scrolling in the grid pause following in the window ([S4.1.7](S4-research-from-the-app.md#S4.1.7)).
  The Table's bar, the table's header and the status line do not start a pause, they only extend a running one.
- **The agent's row hidden by the filter:** in a window that follows the agent (also a paused one) the table does not
  scroll, and the status line says "The agent’s row is hidden by the filter" with **Show for now**. That shows a
  temporary row as with a jump to a person ([A6.7.16](#A6.7.16)) and scrolls to it. The note disappears as soon as
  the agent's row is visible. While the note shows, the research state and "Read-only" in the status line give way
  (the window's strip says both); in a window up to 400 px the row count and **Marks ⓘ** give way too. A pinned row
  of the agent has no note.
- **Research bubbles:** an action from the bubble of a research cell ([A6.7.14](#A6.7.14)) is carried out by the main
  window: it runs it only when its bubble offers it at that person right now, and comes to the front (not for an
  action that opens the research terminal). A source in the Sources table and an archive's web open in the other
  window. An own answer to a waiting item is not offered in another window; **Awaiting action ›** opens the panel in
  the main window. When the main window is closed, the actions it would carry out are not in the bubble.
- **Controls:** app: **Show for now** in the Table's status line; the state of following in the window's strip
  ([S4.1.7](S4-research-from-the-app.md#S4.1.7)).
- **Since:** app 3.30.0

<!-- zdroj: app:34513c94 src/windows/agent-state.ts, agent-mirror.ts, src/ui/agent-window-ui.ts (zrcadlo stavu agenta, Tabulka čte vstup výzkumu z hlavního okna) · src/ui/table-view/table-filter.ts researchFilterIdle (čip výzkumu nebo sloupec fromResearch, bez ctx.research) · table-viewbar.ts .tv-view-note (role status) · index.html .tv-view-note na telefonu jen tečka · d24ff2ec src/ui/table-view/table-ui.ts tableAgentRow (jen windowAgentFollow, tj. další okno; attached posune, attached/paused poznámka, ukotvený ne), tableShowAgentRow, tableAgentFollowChanged · table-grid.ts revealKey(center, smooth, keepSelection), REVEAL_GLIDE_MS 300, prefers-reduced-motion · index.html .tv-row.is-agent (--follow-c1-soft, linka, font-weight 600, bez tv-agent-bar) · src/ui/live-follow-ui.ts (pauza Tabulky: kolečko, posuvník, stisk v řádcích, klávesy; lišta, hlava, stavový řádek ne) · table-bar.ts updateAgentNote (tv-status-agent, aria-live polite, showTemp) · 18dbb544 (poznámka: stav výzkumu a jen ke čtení ustoupí; do 400 px počet, Značky, ◎) · b8d21457 src/windows/window-table-research.ts (TABLE_BUBBLE_ACTION, bubbleRunsHere source / web, hlavní okno ověří nabídku, do popředí ne u terminálu, bez odpovědi čekající položky, při zavřeném hlavním okně vynechané) · strings.ts table.agentRowHidden, table.researchFilterOff, table.link.showTemp · CHANGELOG.cs.md 3.30.0 „Výzkum v Tabulce dalšího okna“, „Sledování agenta ve všech oknech“ · spec 097 K1.2, K3.1, K3.2, O4, dotaz 6 · app:docs/ZADANI_DEV_sledovani-ve-vsech-oknech.md §5; ZADANI_UIX dotazy 11, 14, 15 · prace/1116-app-097-sledovani-okna -->

<a id="A6.7.19"></a>
### A6.7.19 Scope: a list of people

The table shows the whole tree or one list of people ([A11](A11-lists-of-people.md)). The scope narrows the rows to
the people of the list; the filter, the search and the chips then apply within it.

| Rows | In the scope of a list |
|---|---|
| **People** | the people of the list in the list's order; the first column **#** is the position, the sort “Sort: # (list order)” |
| **Unions** | unions where at least one partner is in the list; a partner outside the list is grey |
| **Events** | events in which at least one person of the list takes part |
| **Sources** | always the whole tree: “Sources have no scope by list.” |

- The scope applies to People, Unions and Events at once. The counts in the switch **Rows** and above the table count
  only the scope. Sorting by another column is possible; back on the whole tree the list's order disappears.
- The scope is not a filter chip: **Clear filters** does not cancel it.
- **Checklist** ([A11.8](A11-lists-of-people.md#A11.8)): after **#** there is the column **Done** (a box, a click or
  Space) and among the chips **Left** and **Done** (they exclude each other).
- **Remove from the list:** in the scope of a fixed list it is in the row menu of a person (also for a selection
  across several rows); the person disappears from the table at once, the notice has **Undo**.
- **A person outside the list:** a jump through a link ([A6.7.16](#A6.7.16)) to a person who is not in the list says
  “Not in the list: {name}.” with **Show for now** · **Whole tree** · ×. A row shown for now or a pinned row
  ([A6.7.17](#A6.7.17)) outside the list is dimmed, has **#** “–” and the label “outside the list”.
- **A deleted list:** the table returns to the whole tree and says “The view’s list is gone; the whole tree is shown.”
- The scope is remembered with the view ([A6.7.7](#A6.7.7)), with the table's unfinished state and in a new window
  (⧉, [A6.8](#A6.8)).
- **CSV and XLSX export** ([A6.7.9](#A6.7.9)) in the scope has the columns **#** and **Done** first; **All … without
  the filter** means all rows of the scope.
- **Limits:** a tree without lists has in **Scope** only **Whole tree** and **Manage lists…**; a read-only tree has
  neither **Manage lists…** nor **Done** and **Remove from the list** as edits.
- **Controls:** **Scope ▾** in the table's bar: **Whole tree**, **Lists of people** (the icon of the kind, the number
  of people, ✓ at the chosen one), **Manage lists…**. On a computer the first row of the bar stays one row: where
  space is short, the word **Scope** is hidden and the whole tree is only a mark. On a phone **⋯ → Scope ›**. From a
  list: **Open in Table** ([A11.3](A11-lists-of-people.md#A11.3)).
- **Since:** app 3.30.0
- **From app 3.31.0:**
  - the **window's selection** ([A6.6](#A6.6)) that is not a list (a family line, ancestors, descendants, a research
    line) is in **Scope ▾** as the section **Window selection** with the row "Selection: {name} · {count}"; the table's
    bar then shows "Selection: {name}". The rows are as in the scope of a list, only without an order of their own:
    without the columns **#** and **Done**. A person outside the selection: "Not in the selection: {name}.";
  - the scope of the selection follows the window's selection: another selection replaces it, a selection of a list
    switches to the scope of that list, a cleared selection or one that is gone returns **Whole tree**. The scope of
    the selection belongs to the window and is not saved with the Table's view;
  - in the scope of a list or a selection the last row of the Table's **⋯** is **On the map**: the window's selection
    is set to that list or selection and the Map opens with the scope **Selection** ([A6.5.7](#A6.5.7)). In another
    window ([A6.8](#A6.8)) the main window carries it out; without the main window the row is unavailable ("The main
    window is not open.").

<!-- zdroj 3.31.0: app:src/ui/table-view/table-scope.ts (kind 'selection', klíč sel:…, jen pos, bez # a Hotovo) · table-ui.ts (oddíl scopeSelGroup jen pro výběr, který není seznam; rozsah sleduje výběr okna; openTableForSelection; ⋯ Na mapě jen v rozsahu seznamu nebo výběru, poslední řádek) · table-views.ts (rozsah výběru se s pohledem neukládá) · table-bar.ts (název výběru a ikona druhu) · table-notice.ts notInSelection · src/windows/window-show-on-map.ts (další okno → hlavní okno) · strings.ts table.scopeSelGroup, scopeSel, notInSelection, onMap, onMapNoMain · app:2a578474, 39020cf1 · ZADANI_DEV_vyber-osob §5, §6 · spec 098 -->
<!-- zdroj: app:src/ui/table-view/table-scope.ts tableScopeOf, scopeRows (Osoby v pořadí, svazek s partnerem, událost s osobou, prameny nikdy), scopeCounts, outsideScope, applyScopeCells · table-ui.ts setTableScope (Osoby, Svazky, Události najednou; LIST_SORT # ↑; zpět bez num), dropGoneScopes + scopeGone, tableScopeRows (Spravovat seznamy… ne v isReadOnly), showTableScopeMenu, tableScopeSheetRows, toggleTableDone, tableRowRemoveIds, hiddenJump.outsideList (:2204), leadColumnsOf (# a Hotovo), export :3125 scopeRows · table-notice.ts:60 (scopeGone, notInList, Celý strom) · table-views.ts:258, :272 view.scope · table-bar.ts tv-scope-btn · strings.ts table.scope, scopeWhole, scopeManage, scopeSources, scopeGone, notInList, outsideList, sortList, col.num, col.done, chip.left, chip.done, lists.toast.removed · app:211323e8, 33fa6cd4 (# a Hotovo v exportu), 9681a1f4 (N1 jeden řádek lišty) · ZADANI_DEV §9, §13d · spec 084 K3.* -->

<a id="A6.7.20"></a>
### A6.7.20 Group by

The table's rows can be grouped by one value. Each group has a header with the value and the number of rows and can
be collapsed.

| Rows | Group by |
|---|---|
| **People** | **Research line** (only a tree with lines), **Family line**, **Surname**, **Birthplace**, **Century of birth**, **Decade of birth**, **Generation**, **Sex**, **Occupation**, **Added – day** / **month** / **year** ([A11.7](A11-lists-of-people.md#A11.7)), **Done / left** (only in the scope of a checklist) |
| **Unions** | **Decade of marriage**, **Place of marriage**, **Partners’ family lines**, **Number of children** |
| **Events** | **Event type**, **Decade**, **Place** |
| **Sources** | not grouped |

- Grouping has one level only. Groups go up by value (time, number, alphabet); rows without a value are the last
  group “no value” (for Added “earlier”). Within a group the table's sort applies. An empty group is not shown.
- A row with several values (several lines, several occupations, a union of two family lines) is in each of its
  groups. The status line then says “N different people · K groups”.
- Grouping shows as the chip “Grouped: …” with ×; the filter and the search still apply. A jump to a row in a
  collapsed group opens it.
- Grouping is remembered with the view ([A6.7.7](#A6.7.7)). A value the row type or the tree does not offer is not
  used.
- **CSV and XLSX export** of a grouped table has the first column **Group**; a row in several groups is there in each.
- **Controls:** the Table's **⋯** → **Group by ›** (**No grouping** cancels it), **Collapse all groups** / **Expand all
  groups**. A group's header: a click, Enter or Space collapses and expands, ← collapses, → expands. On a phone
  **⋯ → Group by**; the group's header stays on top while scrolling.
- **Since:** app 3.30.0

<!-- zdroj: app:src/ui/table-view/table-group.ts PERSON_KEYS, UNION_KEYS, EVENT_KEYS, offeredGroupKeys (lines jen s liniemi, done jen pracovní seznam), multiValued, groupRows (vzestupně, NO_VALUE_KEY poslední, řazení uvnitř, prázdné ne), noValueLabel (lists.earlier), groupKeysOfRow (skok otevře), groupedExportRows · table-export.ts:131 groupCol · table-views.ts:259, :273 view.group, groupingFits · table-ui.ts tableGroupOffer, tableExportGroups, setTableGroupBy, ⋯ Tabulky :3377, telefon :3423 · strings.ts table.groupBy, groupNone, grouped, groupsCollapse, groupsExpand, groupKey.*, groupNoValue, distinct, groupsN, groupCol · app:84331c31 · ZADANI_DEV §10, §11 · spec 084 K4.* -->

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
- **What the window has:** instead of the app's toolbar it has a heading: the tree's name, the view switch (below 960 px
  as "{view} ▾"), **Follow selection** ([A6.8.1](#A6.8.1)), **Undo**, **Redo** and ⧉ **Open another window**. It has no
  tree switcher, no **Research** menu, no Settings and no small research panel. From app 3.30.0 the switch **Selection**
  ([A6.8.4](#A6.8.4)) stands in place of **Follow selection**, from app 3.31.0 it is called **Chosen person**
  ([A6.8.1](#A6.8.1)). The window has its own selection of people ([A6.6](#A6.6)).
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
- **From app 3.30.0:** while research is followed live, every window follows the agent in its own view and the
  window's strip says how the window follows, instead of "Read-only · the main window is following research"
  ([S4.1.7](S4-research-from-the-app.md#S4.1.7)). The Table in a window shows the research as in the main window
  ([A6.7.18](#A6.7.18)).

<!-- zdroj: app:4b1373a7 src/windows/window-open.ts isDesktopSystem, windowsOffered (role main, ne isViewMode, > MOBILE_MAX 640, ne isPhoneBar), openInNewWindow · src/windows/window-controls.ts openWindow (BLOCKED_TOAST_MS 10 s, win.retry; MANY_WINDOWS 5, manyWindows), INDICATOR_TEXT_MIN_WIDTH 1280, renderMenu (6 pohledů, thisView, overview jen UI.canOpenResearchOverview), wireTabs (ctrl/meta click, auxclick button 1, contextmenu, Shift+F10 / ContextMenu) · src/windows/view-window-state.ts (přenos stavu, F5 satelitu) · src/windows/sat-header.ts · src/windows/satellite.ts readOnly (live, locked) · src/windows/sat-states.ts (live strip readOnlyLive, goToMain; CONFLICT_TOAST_MS) · src/windows/window-drafts.ts (draftKept) · src/windows/window-research-menu.ts (researchInMain) · src/windows/window-title.ts · index.html html.window-satellite .toolbar skryto · strings.ts win.* · CHANGELOG.cs.md 3.28.0 · spec 079 K1.1–K1.4, K1.7 · prace/1112-app-okna-zaklad, 1112-app-okna-pohledy -->

<a id="A6.8.1"></a>
### A6.8.1 Chosen person

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
- **From app 3.30.0:** a window that follows the agent while research is followed and is not paused only marks a
  person chosen in another window, also in the mode **switch**; the jump after the agent is not sent as a choice of a
  person ([S4.1.7](S4-research-from-the-app.md#S4.1.7)).
- **From app 3.30.0:** the switch is called **Selection ▾**, and these modes are in its group **This window** ·
  selection from other windows. The second group **Main window** says what a choice in this window does in the main
  window ([A6.8.4](#A6.8.4)).
- **From app 3.31.0:** the switch is called **Chosen person ▾**, with the groups **This window** · person chosen in
  another window and **Main window** · person chosen in this window. At **off** it says "The window keeps its own
  chosen person and sends none." The word **Selection** in the app means only the selection of people
  ([A6.6](#A6.6)).

<!-- zdroj: app:4b1373a7 src/windows/follow-mode.ts RECENTERING (family, descendants, fan), defaultFollowMode, followModesFor, effectiveFollowMode, followChoiceToStore (sessionStorage pro okno) · src/windows/window-selection.ts (origin, bez smyčky) · src/windows/sat-header.ts · strings.ts win.followSelectionState, followModeSwitch, followModeMark, followModeOff, followModeSwitchNote, followModeMarkNote, followSelectionOff · spec 079 K1.3, K2.1 · prace/1112-app-okna-sledovat (7bb1b8b2) · 3.31.0: strings.ts satFollow.menu, label, groupThisSub, groupMainSub, recvOffNote, sendDisabled, agentNote (app:51ad8fd6, ZADANI_DEV_vyber-osob §1.1) -->

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
- **From app 3.30.0:** when the main window closes while research is followed, one of the other windows becomes the
  main window by itself and following continues in it ([S4.1.7](S4-research-from-the-app.md#S4.1.7)). When that is
  not possible, the windows show "Following can’t be restored · the main window closed" with **Make this the main
  window** and **Open Strom**.

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

<a id="A6.8.4"></a>
### A6.8.4 What a choice in another window does in the main window

A person chosen in the Table, on the Timeline or on the Map of another window is marked in the main window, or
becomes its centre. This is set by the group **Main window** in the switch **Selection** (from app 3.31.0 **Chosen person**) in the
heading of the other window.

| Choice | What happens in the main window |
|---|---|
| **mark only** (default on the Timeline and on the Map) | the person is marked as in the mode **mark only** ([A6.8.1](#A6.8.1)); the centre stays |
| **focus** (default in the Table) | the person becomes the centre of the main window as after **Focus** at a card, and the tree is redrawn around them, even when it did not draw them before |

- **Where:** the choice is in the Table, the Timeline and the Map of another window (on the Map a choice of a person
  at a place; a click on the place alone sends nothing). Family, Descendants and the Fan of another window move their
  own centre with a click and only mark the person in the main window.
- **Running down the rows:** the arrow keys and a click do the same. The main window marks the person at once and
  changes its centre only 200 ms after the last choice, and only to the last person chosen. Running down the rows
  with the arrow keys thus changes the centre once.
- **Notice and return:** at the bottom middle of the main window's tree stands "Centre chosen in another window" with
  the button **↶ {name}** (the centre before the first choice) and ×. A run of choices from one window is one step of
  the main window's history: one step back (↩ at the bottom left, Alt+←) or ↶ returns the centre from before it. The run
  ends with a step of the main window's own (Focus, Go to, ↩, ↪, another view), with the notice closed, with the choice
  switched to **mark only** and with the other window closed. Switching the choice does not return the centre.
- **A person the main window does not draw** (with **mark only**): the view Family, Descendants or Fan of the main
  window says "{name} is not in this view." with **Go to** (the person becomes the centre) and ×.
- **Limits:**
  - a main window that follows the research agent only marks the person; the centre stays with the agent
    ([S4.1.7](S4-research-from-the-app.md#S4.1.7)). Once per run it says "Following the agent – a person chosen in
    another window is only marked."; the other window has "(agent)" at the choice and in its menu "The main window
    follows the agent – the chosen person is only marked there." After a pause or the end of following nothing is
    switched back: **focus** holds from the next choice;
  - a person who is no longer in the tree: the centre stays, "The selected person is no longer in the tree." A notice
    without × goes after 6 s;
  - a person the main window's Table leaves out (filter, search or list; not a pinned row nor a row shown only for
    now): the centre stays, the person is not marked and the notice without a name "The selected person is hidden in
    this window." goes after 6 s. Family, Descendants and the Fan hide no one;
  - a person who is the centre already: nothing happens;
  - with **off** in the group **This window** and when the main window is not open, the group **Main window** is
    greyed out with the note "Unavailable – sharing the chosen person is off in this window." or "The main window is not
    open."; the choice stays stored;
  - the choice holds for one window and its Table, Timeline and Map, and survives the window's reload (F5); each
    other window has its own. Until a choice is made, the view decides: the Table focuses, the Timeline and the Map
    mark. **mark only** once chosen holds in the Table too and survives the window's reload.
- **Controls:** app: in the heading of another window **Chosen person ▾** → **Main window** · person chosen in this window:
  **mark only**, **focus**. The closed switch shows what is chosen (in a narrow window shortened to icons); its
  tooltip has the whole wording.
- **Since:** app 3.30.0

<!-- zdroj: app:e7d3bb11 src/windows/follow-mode.ts SendMode mark|focus, SENDING table/timeline/map, sendModeKey (sessionStorage okna), getSendModeChoice · src/windows/sat-header.ts followControlParts (FOLLOW_LABEL_MIN_WIDTH 1280, FOLLOW_BOTH_MIN_WIDTH 1100), followSendGroupState (off, no-main, agent), sendModeName = contextMenu.focus malým písmenem, followControlAria · src/windows/satellite.ts sendMode (followSelection && sendModeAvailable), post select intent, seq · app:edaec740 src/windows/window-focus.ts WINDOW_FOCUS_DELAY_MS 200, take (seq), fire (deleted, hidden, followingAgent, focusId), run push/replace, endRun · src/windows/window-selection.ts wireMainSelection (markNotice not-in-view, VIEW_STEP_EVENT, onSendEnded), src/windows/window-start.ts mainFocusDeps (hidden: () => false, drawn family/descendants/fan) · src/ui/window-notice.ts PLAIN_NOTICE_MS 6000 · strings.ts satFollow.*, mainNotice.* · CHANGELOG.cs.md 3.30.0 · dirigent:spec/110 (rozhodnutí 18. 11. 17:35 a 17:45: „Zaměřit“ = nový střed) · app:docs/ZADANI_DEV_vyber-z-okna.md §1–§7 · app:6be873dc src/windows/follow-mode.ts defaultSendMode (table → focus, jinak mark), parseSendMode, setSendMode (ukládá focus i mark) · app:4927ccab src/ui/table-view/table-ui.ts tableHidesPerson (filtr, hledání, seznam; ne pinOutside, tempShown, sources), src/windows/window-start.ts mainFocusDeps hidden, src/windows/window-focus.ts { kind: 'hidden' }, strings.ts mainNotice (skrytá osoba), e2e/windows-send-focus.spec.ts -->
