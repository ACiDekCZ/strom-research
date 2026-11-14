<a id="A9"></a>
# A9 Using the app

Where things are in the Strom app, what the controls are called and what stays with a person. It applies the same
to a person, to a screen reader and to an agent that reads the page with a browser's tools. It describes the Strom
app 3.25.0 and the research 1.29.0.

<!-- zdroj: dirigent:spec/063-computer-use-usnadnit K1.1, K1.3, K1.4, K1.5 · test/vysledek-063-pruzkum.md kolo 2 (A1–A7) · app:CHANGELOG.cs.md 3.25.0 -->

<a id="A9.1"></a>
## A9.1 Where things are

The app shows the surroundings of one person ([A1.3](A1-the-app-in-brief.md#A1.3)). What concerns a person is in the
person menu; what concerns the whole tree is in the bar and in the **Actions** menu.

| Task | Where in the app | Rule |
|---|---|---|
| find a person | the field **Search person...** in the bar | [A4.8](A4-surnames-and-families.md#A4.8) |
| the person menu | a click on a person's card, or Enter on the card; on a touch device a long press on the card opens a bottom sheet with the same actions | [A6.1](A6-views.md#A6.1) |
| what the research knows about a person | person menu → **Research → What the research knows** | [S3.2](S3-what-the-research-knows.md#S3.2) |
| a person's sources | person menu → **Sources** | [A3.6](A3-evidence-in-the-app.md#A3.6) |
| the tree's sources | **Actions → Sources** | [A3.1](A3-evidence-in-the-app.md#A3.1) |
| edit a person | person menu → **Edit** | [S2](S2-edits-from-the-app.md), while following [A9.3](#A9.3) |
| the Map view and other views | the view switch in the bar; on a phone, a tablet and in a window up to 1024 px the bottom bar and **More → View** | [A6](A6-views.md), [A9.5](#A9.5) |
| the whole tree in rows, CSV and XLSX export | **Table** in the view switch; on a phone, a tablet and in a window up to 1024 px **Table** on the bottom bar | [A6.7](A6-views.md#A6.7) |
| fold the minimap or the tree legend | the tab above the minimap; **◯** in the legend | [A9.6](#A9.6) |
| full screen (phone and tablet) | **More → Full screen**; on an iPhone in Safari **More → Full screen…** | [A9.5](#A9.5) |
| a view or the Research overview in a separate window (on a computer) | ⧉ **Open in a new window** next to the view switch; Ctrl+click (macOS ⌘+click) on a view's tab; ⧉ in the Table's bar and in the overview's heading | [A6.8](A6-views.md#A6.8), [S4.1.6](S4-research-from-the-app.md#S4.1.6) |
| the map's base layer | **Show the map** at the notice that the base layer loads from openstreetmap.org | [A9.4](#A9.4) |
| places off the map | the map's status bar → **In the research**; in the research the section **Awaiting action** | [A6.5.2](A6-views.md#A6.5.2), [R4.5](R4-places.md#R4.5) |
| the research's work | the research panel, **⤢ Open overview**; menu **Research → Research overview** | [S4.1](S4-research-from-the-app.md#S4.1) |
| what waits for a person | the panel, section **Awaiting action**; menu **Research → Awaiting action** | [S4.4](S4-research-from-the-app.md#S4.4) |
| following the research | **Follow live**; the end **Stop following** | [S1.4](S1-connecting-app-and-research.md#S1.4), [A9.3](#A9.3) |
| sending edits to the research | **Research → Other actions → Research for this tree… → Sending changes** | [S2.2](S2-edits-from-the-app.md#S2.2) |
| rules and terms | **Actions → How Strom works** | [A1.7](A1-the-app-in-brief.md#A1.7) |

- **Limits:**
  - the research's items are only at a tree from the research; the buttons that open the research only on the
    computer where the research runs ([S3.2](S3-what-the-research-knows.md#S3.2));
  - the app connects to the research by a link from the terminal, `strom app` ([S1.2](S1-connecting-app-and-research.md#S1.2)).
- **Controls:** as in the table.
- **Since:** app 3.25.0 (summary; each place applies since the version in its rule)

<!-- zdroj: app:index.html search input (search.placeholder) · src/renderer.ts card.onclick → UI.showContextMenu, klávesy Enter/Space · src/ui/bottom-sheet.ts (dlouhý stisk, menu.sectionView) · SPEC.md Long-press → bottom sheet · strings.ts search.placeholder, mobileMenu.more, menu.sectionView, map.tilesNotice, map.tilesNoticeOk, research.stop · cesty z pravidel A3.1, A3.6, A6, A6.5.2, S1.4, S2.2, S3.2, S4.1, S4.4, A1.7 · okna: A6.8, S4.1.6 (app:4b1373a7 src/windows/window-controls.ts) · dolní lišta a Celá obrazovka: A9.5 (app:4b1373a7, commit bb5e4d12) -->

<a id="A9.2"></a>
## A9.2 Controls have a readable name

Every control has a name that a screen reader reads, and so does a browser's tool that reads the page. The look does
not change by it.

- **Limits:**
  - buttons with only an icon have a name: zoom, filters, back and forward, rotating a photo, the preview, the list at
    the person search (**Show list**), a linked file, the link to a place's source (**Open the source**) and others;
  - closed dialogs and menus are not read: they are neither in the accessibility tree nor in what a browser's tool
    finds on the page;
  - the bottom sheet takes no click or tap while it slides in, so that no other item is hit;
  - with reduced motion (a system setting) menus, notices and the bottom sheet appear without animation;
  - a greyed-out item is read with its reason too, but starts nothing ([A9.3](#A9.3)).
- **Controls:** nothing: it applies by itself. Reduced motion: the system settings.
- **Since:** app 3.25.0

<!-- zdroj: app:commity c641f7b8 (aria-label ikonových prvků, e2e a11y-names), 76f08f6a + 322b08c3 (zavřené dialogy a menu mimo strom přístupnosti, spodní panel inert při vysouvání, prefers-reduced-motion), 4a8b4fed · strings.ts personPicker.showList, places…dSourceOpen · CHANGELOG.cs.md 3.25.0 „Čtečky obrazovky“ · dirigent:test/vysledek-063-pruzkum.md A1–A3 -->

<a id="A9.3"></a>
## A9.3 Editing while following the research

A tree that is followed live is read-only ([S1.4](S1-connecting-app-and-research.md#S1.4)). The app shows why an
edit does not go and how to stop following.

- **Limits:**
  - while following, the person menu shows a greyed-out **Edit** with the reason **Read-only while following the
    research.** and right under it **Stop following**. It applies on a computer and on a phone;
  - **Stop following** in the person menu stops following the same way as the button in the research panel;
  - after following stops, the app right away asks once **How should changes go to the research?**, when it has not
    asked at the tree yet and the research runs and takes edits ([S2.2](S2-edits-from-the-app.md#S2.2)).
- **Controls:** app: person menu → **Stop following**; the research panel → **Stop following**.
- **Since:** app 3.25.0

<!-- zdroj: app:src/ui/context-menu.ts (edit-following disabled + note, live-stop link), src/ui/bottom-sheet.ts (aria-disabled), src/ui/research-sync-ui.ts researchAskSendModeAfterFollow · strings.ts contextMenu.editFollowing, research.stop, treeSettings.askTitle · commity ffed0d42, cc26c35a, cf0352cd · CHANGELOG.cs.md 3.25.0 „Úpravy během sledování výzkumu“ · dirigent:spec/063-computer-use-usnadnit K1.4 -->

<a id="A9.4"></a>
## A9.4 The agent in the app

An agent that controls the Strom app controls it by the page tools in the browser, the same way a screen reader reads
it. The research's actions go more reliably by the command `strom`. strom nowhere recommends turning computer use on
([R12.10](R12-where-the-agent-works.md#R12.10)).

- **Limits:**
  - the page tools are in the Claude app's built-in browser and in Claude in Chrome. Computer use in the Claude app
    only reads a browser (a screenshot): clicking and typing in it does not go
    ([R12.10](R12-where-the-agent-works.md#R12.10));
  - the bridge to the Strom app stays closed to the agent: the agent works with the page, not with the bridge
    ([R12.2](R12-where-the-agent-works.md#R12.2));
  - the consent to the map's base layer (**Show the map**), the question **How should changes go to the research?**
    and a person's other choices and settings stay with the person.
- **Method only:** the agent clicks a control by the reference that the page's find tool gave it, not by coordinates,
  and waits until the bottom sheet has stopped before it clicks again. It does the research's actions by the command
  `strom` in its command line; in the app only what the command does not have. It does not click a person's choice:
  it says what waits for the person.
- **Controls:** nothing: the instructions in the research folder apply (`AGENTS.md`).
- **Since:** research 1.29.0; app 3.25.0

<!-- zdroj: research:src/agents/files.ts AGENTS.md „## When you have computer use“ (page tools, click by the reference find gives, never by coordinates, wait until a sliding panel has stopped; Claude's computer use only looks at browsers; research through strom; consent or setting left to the person: map's OpenStreetMap, how edits are sent) · CHANGELOG.cs.md 1.29.0 · src/core/browser.ts + src/core/bridgeguard.ts (most odmítnut) · dirigent:test/vysledek-063-pruzkum.md kolo 1 (úrovně), kolo 2 (klik přes ref z find spolehlivý, klik podle souřadnic během vysouvání trefil jinou položku; souhlas Zobrazit mapu nekliknut; místo mimo mapu v Čeká na vyřízení) · spec/063-computer-use-usnadnit K1.2, K1.3, K1.5 -->

<a id="A9.5"></a>
## A9.5 The bottom bar on a phone and a tablet

On a phone, a tablet and in a window up to 1024 px the app has a bottom bar instead of the view switch. The other
views and actions are in the **More** sheet.

- **Bottom bar:** **Family** | **Descendants** | **＋** (add a person; only in a tree that can be edited) | **Table** |
  **More**. An open Family, Descendants or Table view is highlighted on the bar; an open Fan, Map or Timeline
  highlights **More**.
- **More → View:** **Fan** | **Map** | **Timeline**. On a phone the choice of the family line ([A6.6](A6-views.md#A6.6))
  is under them when the tree offers it; not in the Timeline, the Map and the Table.
- **Full screen:** the **More** sheet has **Full screen**, in full screen **Exit full screen**. The browser's bars
  then take no room.
  - It is offered only where the browser allows a page full screen, and only with the bottom bar. A phone held
    sideways has it as a fourth tile in the **View** row.
  - On an iPhone or iPad whose browser does not allow a page full screen (Safari on an iPhone) there is
    **Full screen…** instead, with a hint: Strom added to the Home Screen (**Share → Add to Home Screen**) opens
    without the browser's bars, but has its own separate storage; a tree gets there by export and import. The app
    started from the Home Screen has no such row.
  - When the browser refuses full screen, the window stays as it is.
- **Controls:** the bottom bar; **More → View**; **More → Full screen**.
- **Since:** app 3.28.0 (up to 3.27.0 the bottom bar had **Timeline** instead of **Table**, and the Table was in
  **More → View**)

<!-- zdroj: app:4b1373a7 index.html #bottom-bar (bb-view-family, bb-view-descendants, bottom-bar-fab edit-only, bb-view-table, bb-view-more) · src/ui/misc.ts:530–533 (active: table na liště; fan, map, timeline → Více) · src/breakpoints.ts isTabletOrMobile (≤ 1024 px), isPhoneBar, MQ_PHONE_LANDSCAPE · src/ui/bottom-sheet.ts blok 5 (Pohled: fan, map, timeline; rodRow jen isPhoneBar, ne timeline/map/table; fullscreenRow jen isTabletOrMobile, na šířku čtvrtá dlaždice) · src/ui/fullscreen.ts fullscreenOffer (fullscreenEnabled → enter/exit; iOS a ne standalone → ios-hint; jinak nic), toggleFullscreen (odmítnutí: okno beze změny) · src/file-copy.ts isIosDevice · src/pwa.ts isStandaloneDisplay · strings.ts mobileMenu.fullscreen, fullscreenExit, fullscreenIos, fullscreenIosText, menu.sectionView, viewModeSwitch.* · commit bb5e4d12 (dřív bb-view-timeline a v Pohledu Tabulka) · dirigent:spec/082-tester-3.28 K1.1, K1.3 · prace/1112-app-tester-328-telefon -->

<a id="A9.6"></a>
## A9.6 The minimap and the tree legend fold away

The minimap and the tree legend can be folded so that they do not cover the tree. The device remembers the choice for
all trees. Folding is not switching off: whether the element shows at all is still decided by the settings
**Minimap** and **Tree legend**.

- **Minimap** (computer and tablet, the Family and Descendants views, when the tree is larger than the window):
  - on the top edge of the minimap block there is a tab: ⌄ folds the minimap (**Collapse minimap**), a folded one has
    a tab with the minimap sign (**Expand minimap**). With a mouse the tab shows only on hovering over the block or on
    keyboard focus, on touch always;
  - a folded minimap is hidden and not drawn; the zoom buttons stay in their place;
  - the default is open. A phone has no minimap.
- **Tree legend:**
  - **◯** folds the legend into a chip "◯ Legend" and the chip opens it again. The button is the first part of the
    pill (on hover it turns into ⌄, **Collapse legend**) and, in the panel with the card marks, the whole head
    "◯ Legend ⌄";
  - the default is open. Dragging the mouse over the legend outside the button still moves the tree;
  - a folded chip has a dot when the view shows a kind of card mark that the legend has not yet shown open on this
    device; a screen reader reads "Legend, new mark". After opening the dot goes;
  - **phone** (upright and sideways): the legend is always a chip. A tap opens it as a sheet from the bottom
    (sideways as a panel on the right) with the heading "◯ Legend" and **Done**. It is closed by **Done**, a tap
    beside it, dragging down (sideways to the right) and Esc. After the page is reloaded it does not open by itself,
    and the phone neither reads nor writes the device's choice.
- **Limits:** without the browser's storage (private window) the choice lasts until the page is closed.
- **Controls:** the tab above the minimap; **◯** in the legend, the chip "◯ Legend". Switching off: the settings
  **Minimap**, **Tree legend**.
- **Since:** app 3.28.0

<!-- zdroj: app:f5d56ed3 src/ui/minimap.ts readMinimapOpen (strom-minimap-open, výchozí otevřeno), setMinimapFold (ouško jen když je minimapa nabízená), updateMinimap (isMinimapEnabled, mobil a telefon na šířku bez minimapy, STANDALONE_VIEWS, sbaleno: display none, nic se nekreslí) · src/ui/tree-legend.ts readTreeLegendOpen (strom-tree-legend-open, výchozí otevřeno), readTreeLegendSeen / noteTreeLegendSeen (strom-tree-legend-seen), syncTreeLegendFold (tečka, aria-label title + newMark, telefon vždy čip), openTreeLegendSheet (Hotovo = tour.done, klepnutí vedle, tažení 80 px dolů / doprava na šířku, nečte ani nepíše volbu), paměť bez úložiště · src/ui/misc.ts updateLegendMarks (data-marks: story-own, story-other, action, cross) · src/storage-keys.ts TREE_UI_STORAGE_KEYS · index.html .minimap-toggle (hover / pointer coarse), #tree-legend .tree-legend-toggle, pointer-events · strings.ts minimap.title, collapse, expand, settingLabel; legend.title, collapse, expand, newMark; settings legendLabel · app d78ba58b · dirigent:prace/1113-app-drobnosti-1112 · ZADANI_DEV_drobnosti-1112 §2 -->
