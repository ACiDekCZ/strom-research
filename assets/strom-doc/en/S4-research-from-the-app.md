<a id="S4"></a>
# S4 Research run from the app

What the app shows of the research and what can be started in the research from it: running work, the queue,
directions and actions that open the research. Describes the Strom app 3.21.2 (and the research 1.25.2). Changes from a later version carry its number. The app calls a line of the research ([R2.1](R2-lines-and-queue.md#R2.1)) a
*direction*.

<a id="S4.1"></a>
## S4.1 The panel and the Research overview show running work

While the research is followed ([S1](S1-connecting-app-and-research.md)), the app shows a small panel **Live research
from Strom Research** and from it the larger **Research overview**. Both only read. What they show, the research sends
through the bridge.

- **Limits:**
  - Panel: **At work**, **Awaiting action**, **Latest changes** (the 5 newest, link **All changes in the overview
    ›**), **Up next** (3 tasks) and below that the number of the agent's sessions this month.
  - When the panel is taller than the window, it folds by itself first **Up next**, then the changes, then **At
    work**. **Awaiting action** never folds by itself. A section folded or unfolded by a person stays as it is.
  - Overview, sections in this order: summary (**State**, the last 24 h, **This month** with the number of sessions),
    **Now**, **Awaiting action** (only when something waits), **Directions** ([S4.3](#S4.3)), **Progress**, **Queue**
    ([S4.2](#S4.2)), **What the research knows** ([S3](S3-what-the-research-knows.md)). **Queue** and **What the
    research knows** are folded at the start.
  - **Progress** merges steps by 15 minutes and shows at most 20 steps.
  - On a wide window (from 1280 px) the overview is a side panel next to the tree, on a tablet a layer over the tree,
    on a phone the whole screen. On a phone the panel is a strip, and a tap opens the overview.
  - Without following, the panel shows the last known **Awaiting action** with the sentence **As of …. The research
    is not running.**
- **Controls:** app: the panel, buttons **⤢ Open overview** and **Stop following**; menu **Research → Research
  overview**.
- **Since:** app 3.5.0
- **From app 3.22.0:** each section can be expanded, collapsed or hidden, and the choice holds for the panel and the
  overview ([S4.1.2](#S4.1.2)). **Awaiting action** does not expand by itself, not even with a new item.
- **From app 3.27.0:** with research 1.31.0 the row in **Now** shows, at a task of no direction, why it is being
  worked on: at a task that only helps a direction, which one and how ("helps the direction Ancestors: Jan Horák ·
  connects people to the tree"; also "a question of the direction", "as the agent says", "spouse of an ancestor",
  "branch …"), at a task outside the directions its branch ("outside the directions · branch Josef Horák", under the
  heading **Outside the directions** only "branch Josef Horák"). What helps a direction is in
  [R2.3](R2-lines-and-queue.md#R2.3). The rows **At work** in the small panel say it the same way; under a
  direction's heading only how, without its name.
- **From app 3.27.0:** the **Research overview** opens also without following ([S4.1.5](#S4.1.5)): in the menu
  **Research** it is always first, second is **Follow live**, while following **Stop following** in its place; in
  the Strom archive there is no **Follow live**. From the **Tree overview** it is opened by **Research ›** in the
  heading of **Where to focus**. The button **⤢ Open overview** in the small panel is there only while following.
  - The summary shows only the parts switched on ([S4.1.2](#S4.1.2)): **Last 24 h** people and sources, **This
    month** the number of sessions. The cost (the amount and the readers of scans) shows only once switched on,
    otherwise not even in the hover text. Under the small panel stands "Agent this month: 4 sessions", the amount,
    both, or nothing.
  - In a direction's row in the section **Directions**, the work shows only as "being worked on" when the section
    **Now** is visible (expanded or collapsed); the whole "Now: …" is in the hover text. With **Now** hidden, the
    row says the whole "Now: …".
- **From app 3.28.0:** on a computer the overview also opens in a separate window ([S4.1.6](#S4.1.6)).
- **From app 3.28.0:** the small panel remembers on this device whether it is folded: one choice for all researches,
  open by default. A page reload, new following and the panel of another research take it over; only the panel's
  arrow writes it. An open overview no longer unfolds the panel behind it. A phone neither reads nor writes the choice
  (the strip opens the overview as before). Without the browser's storage (private window) it lasts until the page is
  closed.

<!-- zdroj: app:v3.21.2 src/ui/research-ui.ts:223 PANEL_CHANGES, (3.28.0: app 8da3f11e MINI_OPEN_KEY strom-research-mini-open, miniPanelFolded, rememberMiniPanelFolded, ne na telefonu; otevřený Přehled panel nerozbalí), :227 AUTO_FOLD, :3326 appendQueueSection(…, 3), renderLivePanel, renderIdleResearchPanel · src/ui/research-overview-ui.ts:5 (≥1280), :51 FOLDED_BY_DEFAULT, :53 GROUP_MS, :59 MAX_STEPS, :74, :309-311 · strings.ts live.overviewTitle, research.panelLabel, research.stop, research.atWork, research.queue · 3.27.0 Teď: app 4e4f6d8c src/research-link.ts WORKING_HELPS_FEATURE (working.helps), sanitizeWorking (helps jen s linií, branch) · src/ui/research-offline-ui.ts workingWhyText (helps → qWhyHelps + qWhyHow / qWhyHowBranch; větev mimo linie → qWhyOutBranch, ve skupině qWhyHowBranch) · src/ui/research-overview-ui.ts (Teď: důvod místo názvu linie) · strings.ts live.qWhyHelps, qWhyHow.*, qWhyHowBranch, qWhyOutBranch · spec 036 K1.8 · malý panel: app 2c018779 src/ui/research-ui.ts, research-directions-ui.ts (pod nadpisem linie jen jak) · 3.27.0 spec 057: app f05fff8e src/ui/research-actions-ui.ts overviewRows (research-item-overview první; stop při sledování, jinak followLive, ne bez agenta), src/ui/tree-actions.ts researchOverview · 8d564b35 src/ui/tree-overview.ts treeOverviewResearchLinkHtml (live.researchLink v záhlaví focus) · 28bbebeb src/ui/live-section-prefs.ts TOP_DEFAULTS (month.price false), research-overview-ui.ts appendOverviewSummary, strings.ts live.spendSessions, spendAmount · 87a6ea88 live.dirWorkedOn · strings.ts live.openOverview -->

<a id="S4.1.1"></a>
### S4.1.1 Follow the agent in the tree

The tree can move by itself to the person the agent is working on right now (the first work not paused in the section
**Now**).

- **Limits:** at most one move every 8 s. When the tree is zoomed out more than 0.55, it zooms in to 0.8. Moving the
  tree, selecting another person or another view interrupts following (**Back to the agent**); after 20 s without a
  touch it returns by itself. The choice is remembered for the device.
- **Controls:** app: **Research overview → Follow the agent in the tree** / **Stop following**.
- **Since:** app 3.5.0
- **From app 3.24.0:** following also works in the fan and on the map ([S4.1.3](#S4.1.3)); moving the map pauses it the same way.

<!-- zdroj: app:src/ui/live-follow-ui.ts:7, :26 ZOOM_FAR, :27 ZOOM_READABLE, :32 gap 8000 / idle 20_000 · strings.ts live.followOn, live.followOff -->

<a id="S4.1.2"></a>
### S4.1.2 Customizing the panel

Each section of research following has one choice: **Expanded**, **Collapsed** or **Hidden**. The choice holds for
the panel and the overview.

- **Limits:**
  - sections: **At work** (in the overview **Now**), **Awaiting action**, **Latest changes** (in the overview
    **Progress**), **Up next** (in the overview **Queue**) and only in the overview **Directions** and **What the
    research knows**;
  - a section without a choice (**default**) shows as before: the panel folds what does not fit (**folded to fit**),
    the overview has **Queue** and **What the research knows** collapsed. The panel does not fold a section with a
    choice by itself;
  - a click on a section's heading is a lasting choice (expand / collapse);
  - the choice is kept on this device for all trees, nothing is synchronized. An earlier manual folding of sections
    is taken over once;
  - **Restore defaults** cancels all choices. Restoring the defaults and hiding a section from its menu can be taken
    back for a while (**Undo**). When all sections are hidden, the panel says **All sections are hidden.**
- **Awaiting action collapsed or hidden:**
  - a new item does not expand the section. The heading shows the count and **N new**; highlighted when a decision
    or a permission is among them (**includes a decision or permission**);
  - hidden, it leaves the chip **Waiting N** in the panel's header, in the summary of the collapsed panel, in the
    strip on a phone and in the overview. A click shows the section in the overview until the overview closes
    (**Hidden section, shown until the overview closes.**).
- **Controls:** app: **⋯ → Customize panel…** in the header of the panel and of the overview; right click or long
  press on a section's heading (also the Menu key or Shift+F10); **Settings → Following research**. On a phone as a
  sheet from below.
- **Since:** app 3.22.0
- **From app 3.27.0:** **Customize panel** has two cards, the same in the window, in the sheet on a phone (closed by
  **Done**) and in **Settings → Following research**:
  - **Sections and order:** all six sections in one list and in one order for the panel and the overview (the panel
    leaves out **Directions** and **What the research knows**). Each row has the choice **Expanded** / **Collapsed**
    / **Hidden** (a hidden row "hidden"). A row moves with the arrows ↑ ↓ (not past the ends), Alt+↑ / Alt+↓, by
    dragging the ⠿ grip (Esc cancels the drag; on a phone there is no grip) or in the section's menu **Move up** /
    **Move down**. A screen reader says the new place ("… moved to position 2 of 6."). Default order: **At work**
    (**Now**), **Awaiting action**, **Directions**, **Latest changes** (**Progress**), **Up next** (**Queue**),
    **What the research knows**. When the panel does not fit, it folds sections from the bottom of this order;
  - **At the top:** **State** is always shown ("always shown"). **Last 24 h** (parts **people**, **sources**) and
    **This month** (parts **sessions**, **cost**) each have a switch and their parts; a tile with both parts off
    disappears. **Cost** is off by default ("Cost shows only when switched on."). On a phone **This month** is grey
    ("Not shown on the phone."). **Follow in** can be hidden ("Only while following live."); following then runs in
    the view chosen earlier;
  - the foot: **Restore defaults** restores the sections' states, the order and **At the top** (cost hidden again),
    without a question, with the notice "Defaults restored" and **Undo** for 8 s; **All following settings ›** opens
    Settings. Hiding a section right in the **Customize panel** window is not announced, hiding it from the
    section's menu is ("Section hidden", **Undo**);
  - the choices hold on this device for all trees, for the panel and the Research overview, with following and
    without. Choices saved earlier stay.

<!-- zdroj: app:src/ui/live-section-prefs.ts SECTION_PREFS_KEY, PREF_KEYS, OVERVIEW_KEYS, OLD_PANEL_KEY · src/ui/live-section-edit.ts · src/ui/live-section-edit-ui.ts · src/ui/research-ui.ts:282 waitingHeadInfo, :312 waitingChip, :3180 toggle, :3215 resetLiveSections, :3225 hideLiveSection · src/ui/research-overview-ui.ts:376 shownOnce · strings.ts live.editPanel(Menu), sectionExpanded/Collapsed/Hidden/Default, resetDefaults, autoFoldedNote, allHidden, waitingShort, importantHint, shownOnce, settings groupResearchFollow · commity c4b1dcc, a56232a · spec 044 K1–K5 · 3.27.0: app 28bbebeb src/ui/live-section-prefs.ts DEFAULT_ORDER, TOP_KEYS, TOP_DEFAULTS (záznam v2: pořadí, nahoře; v1 se čte beze změny) · 0b090a80 src/ui/live-section-edit-ui.ts (Sekce a pořadí / Nahoře, ⠿ ne v listu, Alt+↑↓, Escape tažení, Hotovo) · src/ui/research-ui.ts resetLiveSections (RESTORED_TOAST_MS 8000, live.undo), hideLiveSection (hiddenToast, undo.undo) · strings.ts live.groupSections, groupTop, alwaysShown, topDay, partPersons, partSources, topMonth, partSessions, partPrice, priceHelp, monthPhoneNote, topFollowIn, followInHelp, moveUp, moveDown, movedSr, allFollowSettings, settingsNote, restoredToast, hiddenToast, done · spec 057 K1.1–K1.7, K2.1 -->

<a id="S4.1.3"></a>
### S4.1.3 Following in the fan and on the map

Following the agent ([S4.1.1](#S4.1.1)) works in Family, in the fan and on the map. The switch **Follow in** changes
the view and following stays on. The fan does not move; it only marks where the work is; the map shows the place of
the work with a ring.

- **Fan:**
  - the centre of the fan is the **Focused person** before following was turned on (the default), the **Default
    person**, or a **Chosen person** (for one tree). It is never the person the agent works on. **Pin as centre** holds
    a person as the centre, **Release centre** lets it go; a new centre cross-fades in 150 ms;
  - the person worked on has an outline in the session's colour and flashes twice when the work moves and when
    following comes to the fan. A narrow sector gets a mark outside the fan;
  - a person outside the fan gets the label **Work outside the fan:** at the nearest person of the fan, in this order:
    husband or wife, sibling, an ancestor beyond the edge of the fan, for a descendant the centre, otherwise the first
    ancestor up to 12 generations back.
- **Map:**
  - the place of the work has a ring in the session's colour: a solid ring is the **record place** (the place of the
    source the agent works on, when the research sends it), a dashed one the **person's place** (the first place with a
    position from birth, residence, marriage, death). It is never an archive's seat;
  - the ring pulses once when following comes to the map. The map moves only when the place of the first session is
    out of view and the map is not paused. Moving the map by hand pauses it (**Map panning paused**) until **Back to
    the agent**;
  - a place without a position shows a line at the top "… – no position on the map" with **Find position** (for a
    tree with a research **Look up in the research**, [A6.5.2](A6-views.md#A6.5.2)); a person without a place "… – no
    place";
  - the legend **What the highlights mean** explains the rings, the trail and the hollow marker.
- **Session trail:** in Family, the fan and on the map the people and places worked on fade with age: at most the last
  8 changes, none older than 60 minutes. On the map these are empty rings; a dotted line joins the places of one
  session (not on a phone). The trail can be turned off.
- **Limits:**
  - when several sessions run, each has a number (shown from two) and a colour: the first the main one, the others an
    accent one;
  - work on a marriage is followed at the couple: the husband is focused, otherwise the wife;
  - the choices apply on this device for all trees, the chosen person only for its tree. On a phone the display is
    simplified.
- **Controls:** app: while following **Follow in** (Family, Fan, Map); **Settings → Following research** → **Follow the
  agent in** (used when following is turned on and at **Back to the agent**), **Fan centre while following** (**Choose
  person**, **Change**), **Session trail in Family, fan and map**; in the fan **Pin as centre** / **Release centre**.
- **Since:** app 3.24.0
- **From app 3.25.0:** the map's legend says "Hollow marker: a place without a person among the places shown" and a
  place of work without a person on the map "no person on the map yet" (before, "out of the map's range").

<!-- zdroj: app:src/ui/live-follow-ui.ts (hlavička, followIn) · src/live-follow-prefs.ts · src/live-follow-targets.ts TRAIL_MAX=8, TRAIL_MAX_AGE_MS=60 min, fanCenter, sessionNumbers, sessionTone · src/live-follow-map.ts · src/fan-follow-anchor.ts MAX_UP=12 · src/ui/fan-follow-ui.ts · src/ui/map-follow-ui.ts PAN_MARGIN=64, PAN_MS=400, telefon bez čáry · strings.ts settings.groupResearchFollow, researchFollowNote, followView(Help), followFanCenter*, followTrail(Help); live.followIn, mapPaused, legendTitle, legendTrail, legendRecord, legendPerson, legendOut; fan.pin, unpin, centerLabel, workOutside; map workRecord, workPerson, outScope, noCoords, noPlace, locate · CHANGELOG.cs.md 3.24.0, 3.25.0 · spec 043 -->

<a id="S4.1.4"></a>
### S4.1.4 Changes from the research without flicker

A change from the research shows in the tree at once, without redrawing the whole screen. Cards that stay keep their
place; what was added, removed or changed shows briefly with motion.

- **Limits:**
  - cards that stay move smoothly (320 ms). A new person grows out of their line and a light runs along the line; a
    removed one shrinks back into their line; a merged person flows into the one that stays (by the same surname, birth
    ±1 year, a common parent or partner); a changed card has an outline in the session's colour;
  - at most 12 new cards show with motion; with more than 60 changed people the motion is skipped and the changes show
    at once. On a phone and a tablet the times are shorter (×0.875);
  - a new person out of view gets a mark at the edge ("Added outside the view: …", 4 s). The zoom and the focused
    person do not change. A screen reader announces the changes;
  - **Motion when changes load** turned off, and reduced motion in the system, show the changes at once, only
    highlighted ("Reduced motion is on in the system, so changes appear without motion.").
- **Controls:** app: **Settings → Following research → Motion when changes load** (on by default).
- **Since:** app 3.24.0

<!-- zdroj: app:src/live-transition.ts LIVE (move 320 ms, maxAnimatedNew=12, maxChangedForScene=60, ×0.875 touch), src/live-diff.ts (merge guess: surname, birth ±1, parent/partner) · strings.ts settings.liveMotion, liveMotionHelp, liveMotionReduced, edgeAdded · CHANGELOG.cs.md 3.24.0 · spec 055 -->

<a id="S4.1.5"></a>
### S4.1.5 The Research overview without following

The **Research overview** can be opened for every tree from a research also without following. The tree then does
not switch to the research version, does not lock and can still be edited. What the overview shows depends on
whether the research bridge answers.

- **The bridge answers** (the research runs on this computer): the overview shows the same as while following (the
  tiles and all sections) from a regular ask of the bridge; under **State** "refreshed …". **Awaiting action** and
  managing the directions work through the bridge. Under the heading stands "The tree switches to the research
  version and cannot be edited." with the button **Follow live**. When the agent starts working meanwhile, above it
  stands "The agent started" and the button is more prominent; nothing switches by itself. In the Strom archive
  this strip is not there.
- **The bridge does not answer:**
  - **State** "The research is not running" with **Turn on** (where the research cannot be turned on from the app,
    it says how to start it);
  - **Awaiting action** as the research last said it on this device, with "as of …"; older than 7 days it is not
    shown;
  - **Directions** from the tree's file: the name and the number of people, nothing about the work on them; **What
    the research knows** and in the foot **Missing evidence: N people ›**;
  - **Now**, **Progress** and **Queue** are not there; one line names them, e.g. "Now, Progress and Queue: once the
    research is on." (it leaves out hidden sections; when all three are hidden, there is no line). As soon as the
    bridge answers, the overview redraws by itself.
- **A phone** does not ask the bridge: **State** "From the tree only" and "The agent's work is visible on the
  computer with the research." Sideways the state stays at the top and the sections scroll below it.
- **Elsewhere in the app:** without following, the Table view also shows the agent's work and the queue when the
  bridge answers ([A6.7.14](A6-views.md#A6.7.14)).
- **Controls:** app: **Research → Research overview**; **Tree overview → Where to focus → Research ›** (for a tree
  without people in the dialog's heading); on a phone and a tablet in the tree's actions, group **Research**; in the
  overview **Follow live**.
- **Since:** app 3.27.0
- **From app 3.28.0:** when the bridge answers, **⋯** at a task in the **Queue** changes its place as while
  following: **Do next** with **Undo** ([S4.2.2](#S4.2.2)) and, where the research offers them, **To the end** and
  **Reset to default** ([S4.2](#S4.2)). The same in the search results ([S4.2.1](#S4.2.1)) and in the overview's own
  window ([S4.1.6](#S4.1.6)), where the main window does it. The research's bridge writes it; following does not
  start, the tree does not switch and can still be edited. The queue is read from the research right after, without
  waiting for the regular ask. Without the bridge (the overview from the tree, a phone) nothing changes.
  In the same way the overview without following asks the bridge for the state right after every write through the
  bridge: in **Awaiting action** an answer, **Add a file**, **Sent** and **Back to To do**, an answer to the questions
  about places and about a growing branch; in **Directions** creating, editing, moving, pausing, ending and resuming
  a direction; deciding a conflict, reverting a value and verifying or confirming a fact through the bridge. The
  overview's window ([S4.1.6](#S4.1.6)) gets the new state from the main window, which makes the write.
- **From app 3.28.0:** the Research overview without following closes with ⤡ and ×; a research panel that was shown
  beside it shows again once the overview closes. **Stop following** in the open overview only ends following and the
  overview stays open without following; an end the app makes itself (for example a switch to an archive) closes it.
  A switch to another view closes the overview without following as ⤡ does; a followed research's overview stays.

<!-- zdroj: app:f05fff8e, 48573de6 src/ui/research-overview-ui.ts renderResearchOverview (source live | bridge | tree; fromTree vynechá working, changes, queue), appendOverviewStateOff (notRunning, turnOn / researchLiveStartHow; telefon phoneTreeOnly, phoneWhy), overviewFollowStrip (activeResearchAgentless → bez pruhu; agentStarted, followNote), appendOverviewWaitingAsOf (asOf), appendOverviewSkeletonLines, appendOverviewFoot (missingLink) · src/research-overview-source.ts BRIDGE_ONLY_SECTIONS, afterTurnOnKeys, skeletonLines (_STROM_DIRECTION, místa osob) · src/research-device.ts WAITING_MAX_AGE_MS = 7 dní · src/ui/research-ui.ts OverviewViewing (refreshedAt, agentStarted, waitingAt) · src/ui/tree-actions.ts researchOverview · 8d564b35 src/ui/tree-overview.ts treeOverviewResearchLinkHtml (sekce focus, bez osob v záhlaví) · strings.ts live.followNote, agentStarted, notRunning, turnOn, afterTurnOn, refreshedAgo, asOf, phoneTreeOnly, phoneWhy, researchLink, missingLink, treeOverview focus · CHANGELOG.cs.md 3.27.0 · spec 057 K1.8–K1.12 · 3.28.0: app:bb6c0d07 src/ui/research-ui.ts researchSession (sledovaný, jinak prohlížený přes most), openLiveTaskMenu, researchStatusAfterWrite / statusAfterWriteWay (bez sledování hned askResearchBridge, jen počítač), src/ui/research-offline-ui.ts taskMenuOrders (queue.next; queue.own last, default), changeTaskOrder, writeTaskOrder · CHANGELOG.cs.md 3.28.0 (c04a7199) · spec 052 K5.1, K5.6; spec 057 §7 · prace/1113-app-jako-dalsi-bez-sledovani · app:3c751bea src/ui/research-ui.ts researchStatusAfterWrite (Čeká: sent, unsent, odpověď, soubor; linie; větev), researchViewedStatusAfterWrite, viewedWriteSession (jen prohlížený přes most, ne sledovaný, ne ze stromu) · research-waiting-write-ui.ts, research-directions-ui.ts, direction-form-ui.ts, research-offline-ui.ts, research-sync-ui.ts, verify-ui.ts, waiting-places-ui.ts · e2e/overview-write-unfollowed.spec.ts (do 3 s, okno bez dotazu na most) · strings.ts live.waitingWrite.sent, unsent, file · spec 083 · prace/1113-app-hledani-v-prehledu bod 2 · od 3.28.0 zavření a Ukončit sledování: app commit 3f2e19f8 (panel výzkumu skrytý pod Přehledem bez sledování, Ukončit sledování nechá Přehled otevřený, jiný pohled ho zavře) -->

<a id="S4.1.6"></a>
### S4.1.6 The Research overview in a separate window

On a computer the **Research overview** can be opened in a separate window, for example on a second monitor. The
window only shows: the main window sends it the research's state, and what is done in the window, the main window
carries out. The window does not talk to the research bridge.

- **Where it works:** for a tree from a research, with or without following ([S4.1.5](#S4.1.5)), under the same
  conditions as a view in a window ([A6.8](A6-views.md#A6.8)): a computer, a window wider than 640 px.
- **Layout:** the summary across the whole width, under it the sections in columns by the window's width:
  - under 1100 px one column as the overview in the main window, from 1100 px two, from 1600 px three. The window
    goes back to fewer columns only 24 px under the threshold, so that dragging the edge does not flicker;
  - a column is at most 660 px wide, the columns stand in the middle and each scrolls on its own;
  - the sections go in the overview's order (**Customize panel**, [S4.1.2](#S4.1.2)) and are split into the columns
    one after another so that the tallest column is as low as possible. Three columns of which one would have less
    than a fifth of the height are two;
  - the split changes when the number of columns changes, when a section is folded, unfolded, hidden or moved, and
    after **Load more** in the **Queue**; new data from the research and typing do not change it;
  - a long section (with a search field or with more than 8 rows) has a sticky head in its column: the heading, the
    search field, the chips and the number found stay at the top, the rows scroll under them;
  - when the width changes across a threshold, a search being typed, the caret and the section that was in view
    stay;
  - the section choices ([S4.1.2](#S4.1.2)) hold in the window too.
- **The window's heading:** "{tree} · Research overview", below it the research's name, on the right by state
  **Follow live** or ending the following, and ⋯. Without ⤡, × and **Follow in**.
- **Actions:** showing a person in the tree, an answer in **Awaiting action**, managing the directions, a task's
  place in the queue, searching the **Queue** ([S4.2.1](#S4.2.1)), **Follow live** and ending it, **Turn on** and in
  the section **Verifying** **Stop** and **Verify facts in the tree…** ([S7.5](S7-reliability-and-verification.md#S7.5))
  are carried out by the main window. The main window reads the search and the queue's pages from its bridge and
  sends the result to the window. After an action whose result shows in the main window (for example showing in the
  tree, or the dialog **Verify facts in the tree**, which opens in the main window), the window asks for the main
  window to be brought to the front; after **Stop** it does not. Searching in **Awaiting action** and **What the research knows**
  ([S4.4.2](#S4.4.2), [S3.7.1](S3-what-the-research-knows.md#S3.7.1)) the window filters by itself.
- **Highlighting:** what the tree in the main window highlights right now, the window shows by lighting the button of
  that group: **Show in tree** at a direction in **Now** and in **Directions**, the number of a direction's found
  people and **Show changed in tree** in **Progress**. Once the highlighting ends or the main window closes, nothing
  is lit. When a filter of **Progress** highlights the changed people again, the main window is not brought to the
  front; a filter with nobody left ends the highlighting in the main window.
- **States of the window:**

| State | What the window shows |
|---|---|
| followed live | the same as the overview while following |
| not followed, the bridge answers | the same as the overview without following ([S4.1.5](#S4.1.5)) with the strip **Follow live** |
| the research is not running | "The research is not running · showing what is in the tree" with **Turn on**; **Awaiting action** from memory with "as of …" |
| the main window switched to a tree without a research | "This tree has no research", "The main window switched to {tree}, which has no research." and **Close window**; back on a tree with a research the window comes back by itself |
| the main window is closed | the strip "The main window is closed · as of {time}, read-only", the last state, actions greyed out; **Open Strom** ([A6.8.2](A6-views.md#A6.8.2)) |
| the tree deleted or locked | as a view in a window ([A6.8.2](A6-views.md#A6.8.2)) |

- **Limits:** while the overview window is open, the main window does not draw its own overview; an open one closes
  when the window opens. The small research panel stays. **⤢ Open overview**, **Research → Research overview** and
  the item in the ⧉ menu then only bring the overview window to the front ("The research overview is in a separate
  window · click brings it to the front"). After the window is closed, all is as before.
- **Controls:** app: ⧉ in the overview's heading (between ⋯ and ⤡); ⧉ **Open in a new window** next to the view
  switch → **Research overview**.
- **Since:** app 3.28.0

<!-- zdroj: app:4b1373a7 src/windows/overview-window.ts (research-state bez adresy a tokenu mostu, OVERVIEW_ACTION_IDS, OVERVIEW_ACTIONS_TO_MAIN, 6g) · src/windows/overview-main.ts · src/ui/research-overview-ui.ts OVERVIEW_WINDOW_COLS_MIN 1100, WINDOW_LEFT (working, waiting, directions), overviewMode 'window', overviewWindowButton (jen canOpenWindows, ne sheet), canOpenResearchOverview · index.html html.window-overview (bez ⤡, ×, ⧉, Follow in) · src/windows/window-controls.ts renderMenu (overview: focusOverviewWindow / openInNewWindow) · strings.ts win.overviewHead, overviewOffNote, noResearch, noResearchNote, overviewInWindow, mainClosed · CHANGELOG.cs.md 3.28.0 · spec 079 P3 (K3), ZADANI_DEV §6 · prace/1113-app-okna-prehled (8a7575f0..4387a662) · app:3c2fde77 src/ui/overview-window-view.ts readQueuePage přes akci queue-list do hlavního okna (okno most nevolá) · app:3f9a5ca4 overview-window-view.ts treeVerifyNow (extras.verify), verifyStop → verify-stop, showVerifyBulkDialog → verify-bulk; evidenceHighlightNow (extras.highlight), endEvidenceHighlight → highlight-end, startPersonHighlight quiet · src/ui/research-ui.ts lightsGroup, markOverviewLit (is-lit, aria-current; nic při zavřeném hlavním okně) · research-overview-ui.ts lightsGroup direction (show-in-tree v Teď), changed (showChanged) · research-directions-ui.ts lightsGroup direction (dirShow), direction-found (dirFoundPersons) · strings.ts verify.section, bulkRow, stop, live.showInTree, dirShow, showChanged · spec 079 K3 · prace/1113-app-dorovnani-052-okna (2876d570..27f0bafb) · app:7f307c74 src/overview-columns.ts OVERVIEW_WINDOW_COLS_2 1100, OVERVIEW_WINDOW_COLS_3 1600, OVERVIEW_COLS_HYSTERESIS 24, OVERVIEW_SMALL_COLUMN 0.2, OVERVIEW_COLUMN_MAX 660, partitionContiguous, planOverviewColumns · src/ui/overview-columns-ui.ts (souhrn a pruhy nad sloupci, každý sloupec se posouvá sám, nové rozdělení jen při změně sloupců, sbalení, skrytí, přesunu, Načíst další; lepkavá hlava: pole nebo > 8 řádků; fokus, výběr v poli a oddíl na očích při změně šířky) · e2e/windows-overview-columns.spec.ts · CHANGELOG.cs.md 3.28.0 (e540e4b5) · spec 083 U3 · prace/1113-app-hledani-v-prehledu -->

<a id="S4.2"></a>
## S4.2 The queue in the app

The app shows the beginning of the research's queue in the order in which the agent takes it
([R2.2](R2-lines-and-queue.md#R2.2)). The whole queue stays in the research.

- **Limits:**
  - The panel shows 3 tasks (**Up next**), the overview 20 (**Queue**). The rest is shown by the row **and N more in
    the research**, which opens the research.
  - With two or more running directions, tasks can be filtered by direction (**Queue by direction**).
  - A task outside the directions has a note: **Waits until the directions' work is done · helps no direction**,
    **Not taken · work outside the directions is switched off**, or why it helps a direction (**Helps the direction:
    the direction's question**, **Helps the direction: connects people to the tree**, **Helps the direction, as the
    agent states**). The rules are in [R2.3](R2-lines-and-queue.md#R2.3).
  - Task menu **Task options**: **Park** and **Drop**; for a parked task **Resume**. Each of them opens the research's
    terminal and is confirmed there ([S4.5](#S4.5)).
- **Controls:** app: the panel, section **Up next**; **Research overview**, section **Queue**; at a task **⋯**.
- **Since:** app 3.5.0. Notes at tasks outside the directions from 3.21.0 (research 1.25.0).
- **From app 3.22.0:** with research 1.26.0 each task has a line saying why it stands where it stands
  ([R2.4](R2-lines-and-queue.md#R2.4)).
  **Do next** and **To the end** (and **Reset to default**) change the task's place right from the app, without the
  terminal ([R2.3.1](R2-lines-and-queue.md#R2.3.1)); not for the task the agent is working on. The queue is read in
  pages: **Load more** adds 50 tasks, the list holds at most 300, and the filter of a direction or a branch narrows
  the rest.
  The branch chip (**Branch … K**) narrows the whole queue to the branch's tasks; **Show the whole queue**
  cancels it.
- **From app 3.27.0:** with research 1.31.0 the queue in the app is in the same order in which `strom run` takes the
  tasks and in which the research menu shows them before it ([R2.2](R2-lines-and-queue.md#R2.2)): in a story turn
  one story is at the top, and the queue also holds history tasks. A task carries a quiet tag **story** or
  **history** after its text (in **Up next**, in the **Queue**, at set-aside tasks and in a branch's tasks); a task
  without it looks as before. Without following, the overview ([S4.1.5](#S4.1.5)) and the Table show the queue when
  the bridge answers.
- **From app 3.28.0:** with research 1.32.0 the **Queue** can be searched ([S4.2.1](#S4.2.1)), a task set next and
  undone ([S4.2.2](#S4.2.2)), and the agent's work on the queue asked for ([S4.2.3](#S4.2.3)). The unfolded
  **Queue** then has the number of tasks in its heading ("Queue · 1,240") instead of on the right. With an older
  research the Queue is as before.

<!-- zdroj: app:v3.21.2 src/ui/research-ui.ts:308 queueNoteText, :3373 appendQueueSection · research-overview-ui.ts:311 (20) · strings.ts research.queue, research.park/drop/wake, research.queueMore, research.queueOffLast, research.queueOffNever, research.queueHelps · HEAD src/research-queue-pages.ts:19 QUEUE_PAGE, :28 QUEUE_ROWS_CAP · src/ui/research-ui.ts:3884 taskDoNext/taskDoLast · strings.ts live.taskDoing, live.queueLoadMore, live.queueCapNote, live.branchQueueChip, live.branchQueueChipClear · 3.27.0: app 2ee3718d (queue[].kind ze /status i ze stránek fronty, jiná hodnota zahozena) strings.ts live.queueKind · research 5f48cdaf src/core/queue.ts RUN_TURNS, runOrder (most /status queue[], GET /queue, menu před strom run), kind story|history · 3.28.0: app 4ad34832 src/ui/research-ui.ts appendQueueSection (counted: queueTitleCount místo summary, když je pole nebo akce záhlaví) · spec 052 -->

<a id="S4.2.1"></a>
### S4.2.1 Searching the queue

The **Queue** in the **Research overview** (also in its own window, [S4.1.6](#S4.1.6)) has the field **Search tasks, people, archives…**. The research searches its
whole queue, also beyond the loaded pages; the app sends it only the text searched for
([R2.2](R2-lines-and-queue.md#R2.2)).

- **When the field is there:** in the unfolded **Queue**, with a research whose bridge can search and answers, and
  only when the queue has at least one task (a postponed one too). With an older research the field is not there
  and the Queue is as before.
- **What is found:**
  - a task number (`T0815`, `t815`, `815`): that task first, then the tasks whose text holds that number;
  - a person number (`P12`): the tasks about that person;
  - other text: the tasks that have every word in the task's text, in the names of its people, in its book, call
    number, archive or place, or in the task's or a person's number; ignoring case and diacritics. The results are
    in the order of the queue.
- **Limits:**
  - the search runs 300 ms after the last typed character, at most 100 characters are sent; an empty field brings
    back the queue;
  - the direction and branch chips ([S4.2](#S4.2)) combine with the search: the result is the chip's tasks that match
    the text. The counts in the chips stay the queue's counts;
  - a result row is a queue row (place in the queue, text, **⋯**) with the task number in grey. Only a match of the
    task or person number is highlighted ("P0108 Jan Horák"), a text match is not. Postponed tasks are at the end with
    the place "–" and the tag **postponed**;
  - above the results stands their count ("12 tasks found"). Without a result **Nothing found.** and **Clear search**,
    with a direction chip also **Search all directions**;
  - the number of a task that is no longer in the queue: "T0815 is no longer in the queue (done)", the state **done**,
    **awaiting action**, **postponed** or **given up**;
  - more than 50 results: **Load more** by 50, at most 300 rows as in the queue;
  - the bridge does not answer or is busy: **Search failed; the research is not responding.** or **The research is
    busy; search is not available right now.** and **Try again**; the text stays in the field;
  - when the queue changes during a search, the result refreshes by itself; the text and the caret stay in the field;
  - the search lasts until it is cleared (×, Escape in the field, **Clear search**) or until the overview closes. The
    text searched for is kept nowhere.
- **Controls:** app: **Research overview → Queue**, the search field; in the small panel under **Up next** the link
  **Search the queue…**: it opens the overview, unfolds the **Queue** only until it closes (the section's saved choice
  does not change) and puts the caret in the field. On a phone, where the panel is a strip, the link is not there.
- **Since:** app 3.28.0 (research 1.32.0)

<!-- zdroj: app:4ad34832 (8a10387e) src/ui/queue-search-ui.ts QUEUE_SEARCH_PAUSE_MS 300, queueSearchOffered (queue.search, queuePaged, queue/queueMore/queueCounts next+parked), resetQueueSearch (zavření Přehledu), Escape · src/research-queue-pages.ts QUEUE_QUERY_MAX 100, QUEUE_PAGE 50, QUEUE_ROWS_CAP 300, QUEUE_ELSEWHERE_STATES · src/ui/research-ui.ts appendQueueSection (searchable jen v Přehledu, ne při sbalení), appendQueueSearchResult (štítek + q, queueSearchBusy/Err, dirRetry), řádek výsledku (live-queue-num „–“, research-queue__match id/person, queueTagDeferred), live-queue-search-link (canExpandLivePanel) · src/ui/research-overview-ui.ts openQueueSearch (unfoldOverviewSection queue do zavření) · strings.ts live.queueSearch*, queueState, queueTagDeferred, queueTitleCount, dirRetry · research 1.32.0 src/core/live.ts searchQueue (TASK_NUMBER, PERSON_NUMBER, každé slovo v jednom poli, pořadí fronty, elsewhere) · spec 052 K1.1–K1.7 · ZADANI_DEV_fronta-hledani §1, §2; D1 (bez řádku pole) · app:08268b9f strings.ts live.queueSearchInDir, queueSearchNoneDir, queueSearchAllDirs (linie) · app:3c2fde77 okno Přehledu (queue-list) · spec 052 K1.1 -->

<a id="S4.2.2"></a>
### S4.2.2 Do next and Undo

A task can be sent from the app to come up next, without the terminal. The agent does not interrupt the work in
progress: the task comes up after it ([R2.3.1](R2-lines-and-queue.md#R2.3.1)).

- **Limits:**
  - **Do next** ("Comes up after the task in progress") is the first item in **⋯** at a task in the **Queue**, in the
    search results ([S4.2.1](#S4.2.1)) and in **Up next** of the small panel, without a mark. It takes the place of
    the earlier **Do next** (3.22.0); **To the end** and **Reset to default** stay with a research that offers them
    ([S4.2](#S4.2));
  - it is not offered for a task that is first already, that the agent is working on, or that is postponed;
  - it works with or without following: in the **Research overview** opened without following ([S4.1.5](#S4.1.5)),
    when the research bridge answers; following does not start and the tree stays editable. After the change the
    queue is read from the research at once;
  - the task moves to the first place, its row is briefly highlighted and its text has the tag **next** until it comes
    up. Of several tasks set next, the last one marked is first; all of them have the tag. The search stays;
  - the bubble with the task's number (“T0103 comes up next”) and **Undo** stays 6 s. **Undo** puts the task back
    exactly in its former place, with its former choice; the row is at that place as soon as the research answers,
    also in the overview's own window ([S4.1.6](#S4.1.6));
  - when the agent took the task meanwhile: **The agent is working on this task now; its place cannot change.** and
    the queue refreshes. When the bridge does not answer: **The research is not responding; the order has not
    changed.** and **Try again**;
  - nothing is confirmed: nothing starts and nothing is paid;
  - on a phone the menu is a bottom sheet like the app's other sheets (a handle, the window darkened under it) with
    the task's number and text at the top; a tap on the darkened window or Escape closes it.
- **Controls:** app: at a task **⋯ → Do next**, in the bubble **Undo**. Terminal: `strom task order T… --next`,
  `--restore` ([R2.3.1](R2-lines-and-queue.md#R2.3.1)).
- **Since:** app 3.28.0 (research 1.32.0)

<!-- zdroj: app:623d9c77 (8a10387e) src/ui/research-offline-ui.ts queueNextOffered (queue.next, most odpovídá), queueNextFor (state next, ne pozice 1, ne práce agenta), doTaskNext (toast queueMoved 6000 ms, queueUndo → restoreTaskPlace {do: restore, was}), taskOrderRefusedToast (taken → taskDoing, bridge → queueBridgeErr + dirRetry), QUEUE_FLASH_MS 1600 · src/ui/research-ui.ts openLiveTaskMenu (nextOn: queueNext místo taskDoNext; taskOrderOffered: last, default; list na telefonu ≤ 640 px s titulem), markQueueNextRow (queueTagNext) · strings.ts live.queueNext, queueNextHint, queueTagNext, queueMoved, queueUndo, queueBridgeErr, taskDoing · research 1.32.0 rankTasks (naposledy zvolený první) · spec 052 K5.1, K5.3, K5.4, K5.6 · ZADANI_DEV_fronta-hledani §4 · app:2876d570 placeQueueItemInLists (odpověď restore: pos, own, why), strings.ts live.queueMoved(id) · app:7dc924ee list ⋯ = bottom-sheet (úchyt, ztmavení, Escape) · app:3f9a5ca4 Vrátit v okně Přehledu · spec 052 K5.4 · app:bb6c0d07 bez sledování přes most (researchSession, taskMenuOrders, researchStatusAfterWrite) · spec 057 §7 -->

<a id="S4.2.3"></a>
### S4.2.3 Work on the queue…

The app can ask for the agent's work alone on the queue. The app starts nothing: it opens the research's terminal,
which shows what will run and starts it only on a **yes** ([R7.1.2](R7-when-the-agent-works.md#R7.1.2)). The agent's
work uses the AI subscription.

- **When it is offered:** with a bridge that answers, for a research that announced the work link, with an agent (not
  in a Strom archive nor in a research waiting for an agent), only where the app opens the research's links
  ([S4.5](#S4.5)); not on a phone. While the agent works or a run goes on, the action is not there; in the **Queue**
  heading **● At work ›** stands in its place, which unfolds **Now** and goes to **Finish and stop**.
- **The dialog Work on the queue:**
  - **Automatically** (the default): "The agent takes one task after another as long as the subscription limit
    allows." When the research reports that the subscription gate (the condition, [R7.4](R7-when-the-agent-works.md#R7.4))
    is not set, under it stands **Automatic work needs a subscription gate; the terminal offers to set one up.** The
    choice stays;
  - **Only 5 tasks**: a number 1–100, the default 5. The work stops after that many completed tasks; a task that ends
    in waiting, postponing or giving up counts too. Only with a research that can do it; otherwise there is only
    **Automatically**;
  - **First up**: the task set next ([S4.2.2](#S4.2.2)), otherwise the first task of the queue;
  - when the research reports it, the session's length and the gate ("Session up to 3 h · subscription gate: …");
  - **Cancel** and **Open terminal** (the mark AI and terminal) with the sentence **The research terminal confirms the
    start. Ctrl-C in its window or Finish and stop in Now stops the work.**
- **Controls:** app: **Work on the queue…** on the right of the unfolded **Queue** heading in the **Research
  overview**; menu **Research → Work on the queue…** ([S4.5.2](#S4.5.2)). Terminal: `strom run --tasks N`,
  `strom run --loop` ([R7.1](R7-when-the-agent-works.md#R7.1)).
- **Since:** app 3.28.0 (research 1.32.0)

<!-- zdroj: app:9cf43b22, 34accb13 (8a10387e) src/ui/queue-work-dialog.ts queueWorkOffer (live, ne phone/sheet, ne noAgent, linkAvailable work, work.link; busy sessions|runs → 'busy'), queueWorkHead (queue-work-busy → showOverviewNowFinish), queueWorkCounted (run.tasks), queueWorkFirst (own next, pos 1), queueWorkSessionLine, WORK_TASKS_DEFAULT 5, noGate (work.gate === null) · src/research-link.ts WORK_TASKS_MIN/MAX, WORK_LINK_FEATURE, RUN_TASKS_FEATURE · src/ui/research-ui.ts queueHeadAction (jen rozbalená Fronta) · src/ui/research-overview-ui.ts showOverviewNowFinish · strings.ts live.queueWork*, queueWorkingLink · spec 052 K6.1, K6.2, K6.4, K6.6 · ZADANI_DEV_fronta-hledani §5; D6 (řádek sezení i bez brány) -->

<a id="S4.3"></a>
## S4.3 Directions in the app

The overview shows the research's directions ([R2.1](R2-lines-and-queue.md#R2.1)): what waits on each and how far it
got. In app 3.21.2 directions are only read; every change is confirmed in the research's terminal.

- **Limits:**
  - The section **Directions · N active** is there only with two or more directions, or with one direction when work
    outside it runs too (row **Outside the directions**). Paused and ended directions are folded under **Paused and
    ended · N**.
  - A direction's row: kind (↑ ancestors, ↓ descendants, ⌕ question), name, person, number of tasks and what awaits
    action. A direction without work has **Nothing to do, it can be ended.**
  - Direction detail: known ancestors by generations, when it was last worked on, **Work on this direction** (a
    conversation with the agent, not in a Strom archive) and **Show in tree**.
  - Menu **Direction actions**: **Pause**, **End**, **Restart**. Each opens the terminal, which says what will happen
    and asks for a reason ([R2.1.2](R2-lines-and-queue.md#R2.1.2)).
  - On a phone the menu is missing: **Nothing to do · it can be ended in the research on the computer**.
  - With two or more directions the panel divides the work by direction, and one direction can be selected; the queue
    is filtered by it.
- **Controls:** app: **Research overview → Directions**, at a direction **⋯**.
- **Since:** app 3.5.0 (research 1.8.0). The panel divided by direction from 3.13.1.
- **From app 3.22.0:** with research 1.26.0 directions are changed right in the app ([S4.3.1](#S4.3.1)). A
  direction's row shows what is being worked on now (**Now: …**) and the limits (**up to N generations**, **before
  …** (year); not for a paused direction). The direction detail says what the direction found over the last days
  (**Last N days:** sessions, people, sources); it shows the people in the tree. Ended directions are collapsed at
  the end (**Ended · N**). In a narrow window and on a phone the overview is a sheet: arrows ▲▼ instead of the
  order handle.

<!-- zdroj: app:v3.21.2 src/ui/research-directions-ui.ts:156 linesMulti, :350-353 appendOverviewDirections, :385 canDo, :528 dirWork · strings.ts live.dirTitle, live.dirOutside, live.dirInactive, live.dirWork · research:v1.25.2 assets/lang/cs.json ui.link.what.direction.pause/done/resume · 3.22.0: research-directions-ui.ts:703 dirEnded, :852 dirNow, :878 dirFoundIn, :720 sheet; strings.ts live.dirLimitGen, dirLimitBefore, dirFound* -->

<a id="S4.3.1"></a>
### S4.3.1 Managing directions from the app

With a research that can do it, the app writes changes of directions right through the bridge. No terminal opens and
nothing is paid.

- **Limits:**
  - **+ New direction** (form **New direction**: **Kind** Ancestors / Descendants / Question, **Person**,
    **Question**, **Name**, **Limit…**). Creating it costs nothing, and the agent starts on the direction in the next
    run. A new direction goes to the end of the order.
  - **Edit**: the kind and the person cannot be changed (another person = a new direction). An edit holds from the
    next choice of a task.
  - Order of directions: by dragging, by arrows or **Move to the top**. Below the list it says how the research takes
    the order: **The research spends most time on the directions at the top; the others keep going.** or **The
    research takes the directions in order.**
  - **Pause** and **Restart** can be taken back (**Undo**). **End…** asks and takes an optional reason.
  - When the same direction already exists, the form says so (**The direction … is already running.**) and offers
    **Show it** or **Create anyway**.
  - **Find ancestors** and **Find descendants** at a person open this form.
  - Read-only: in a Strom archive (**Archive: directions are read-only.**), on a phone (**Directions can be changed in
    Strom on the computer where the research runs.**), and when the research is not running (**The research is not
    running. Directions can be changed once it runs.**).
  - Research older than 1.26.0: the actions stay in the terminal (**The research manages directions from the app from
    version 1.26.0.**).
  - When the research refuses the write (for example it is busy), the app changes nothing and offers **Try again**.
- **Controls:** app: **Research overview → Directions**, **+ New direction**, at a direction **⋯**; person menu
  **Research ›**.
- **Since:** app 3.22.0 (research 1.26.0)

<!-- zdroj: app:HEAD src/ui/research-directions-ui.ts:372 DIRECTIONS_WRITE_SINCE, :628 · src/research-directions-write.ts createDirection, editDirection, setDirectionState, writeDirectionOrder · src/ui/research-actions-ui.ts:1015-1024, :1067 openDirectionForm · strings.ts live.dirNew, dirFormNew, dirFree, dirEditFree, dirLocked, dirOrderWeight, dirOrderStrict, dirArchive, dirPhoneOnly, dirBridgeDown, dirOldResearch, dirBusy, dirRetry, dirDupActive, dirShowIt, dirAnyway · research:src/core/live.ts /directions -->

<a id="S4.3.2"></a>
### S4.3.2 Work outside the directions by branches

With two or more directions, the overview shows the work outside the directions by branches. The choices from
[R2.3](R2-lines-and-queue.md#R2.3) and [R2.3.1](R2-lines-and-queue.md#R2.3.1) can be set right from the app.

- **Limits:**
  - For the whole research: **How work outside the directions is taken**: **Now and then**, **At the end**, **As
    usual**, **Never**.
  - A branch's row: the branch's person, its relation to a direction (**near the direction …**), the number of
    tasks, **growing**, **own choice**.
  - A click on a branch shows its first tasks with their place in the queue (**In the queue · first K of N**,
    **I in the queue**) and the link **All N tasks in the queue ›**. When the branch's tasks stand beyond the
    loaded part of the queue: **The branch's tasks stand further on in the queue (N).**
  - For a branch: **Taken:** **Now and then** / **At the end** / **As usual** (the research's choice has
    **(default)**), **Add to the direction …** (the nearest direction first), **Create a direction from this
    branch**, **Do not research** (the tasks leave the queue, nothing is deleted), **Reset to default**. Branches not
    researched are together (**Not researched · N branches**).
  - Questions about growing branches ([R2.3.2](R2-lines-and-queue.md#R2.3.2)) are in **Awaiting action**: add to a
    direction (for a paused direction **Add to the direction … (paused)**), create a direction, **Leave as it is**,
    do not research. Without an answer the branch goes on being taken as before.
  - The window **Research for this tree…**, the group **Work outside the directions**: the choice for the whole
    research (**Now and then**: “About 1 task outside the directions per K tasks of the directions.”), **Suggest
    directions for growing branches**, **Branches with their own choice** and tasks with a manual order. From app
    3.27.0 the group's introduction says what helps a direction and always goes with it: "a question of the
    direction, connecting people to someone in it or to their spouse, a reason the agent gives"
    ([R2.3](R2-lines-and-queue.md#R2.3)).
- **Controls:** app: **Research overview**, the section of work outside the directions, at a branch **⋯** (**Branch
  options**); **Research for this tree…**.
- **Since:** app 3.22.0 (research 1.26.0)

<!-- zdroj: app:HEAD src/ui/research-offline-ui.ts:3, :104 (caps.offLineBranches, ≥2 linie) · src/research-directions-write.ts setBranchMode, setOffLineTree, answerBranchWaiting · strings.ts live.offModeLink, live.offModeCap, live.branchAddPick, live.branchCreate, live.branchNever, live.branchReset · research-offline-ui.ts:202-228 growingBranchLine, :542 branch choices, :680 branchQueueBeyond, :740 pick · strings.ts live.dirNear, branchGrows, branchOwnChoice, branchQueueHead, branchQueuePos, branchAllTasks, branchTaken, branchDefaultTag, branchAdd(Paused), branchNeverGroup, waitBranchLeave, waitBranchHint, setOutTitle, setOutOcc, setSuggest, setOwnChoice, setManualTasks, menu treeSettings · spec 038 K7 · 3.27.0: strings.ts live.setOutIntro (app 4e4f6d8c, spec 036 K1.8) -->

<a id="S4.4"></a>
## S4.4 Awaiting action in the app

The panel and the overview show the same list as the research ([R6.1](R6-awaiting-action.md#R6.1)). What can be dealt
with in the app and what only in the research is said in [R6.5](R6-awaiting-action.md#R6.5).

- **Limits:** below the list it says where to answer: **Answer in the research. The tree updates by itself
  afterwards.**, for questions about places **Questions about places are answered here.**, for both **Questions about
  places are answered here, the others in the research.** Items only for the terminal do not reach the app
  ([R6.1.1](R6-awaiting-action.md#R6.1.1)).
- **From the tree:** the card of a person something waits on has the mark **!** (tip: **Click: answer**). A click on
  it and the item **Answer · N waiting** in the person's menu do the same:
  - with one item waiting on the person, its answer opens as with the button in its row in the panel;
  - with more, the panel opens at the section **Awaiting action** with the person's items first, highlighted. On a
    phone, with the section folded or hidden and with the overview open, they are highlighted in the **Research
    overview**;
  - when none of the person's items (not even a single one) can be answered here, the panel opens all the same and
    under each item stands **Not answerable here: the answer is given in the research, on the computer where it is
    installed.** A click never goes without a response;
  - a new version of a story opens the comparison;
  - on a touch device the person's menu has the item **Waiting · N ›** instead of **Answer · N waiting**: it
    highlights the person's items, and they are answered from their rows.
  - when the card has two or three marks, a click offers what to open ([S4.4.1](#S4.4.1)).
- **Hypotheses:** with a research that can decide them in the app, hypotheses to decide are in the group
  **Hypotheses to decide** (chip **Decisions**), also with accepting the agent's proposals at once ([S3.5.2](S3-what-the-research-knows.md#S3.5.2)).
- **Controls:** app: the panel, section **Awaiting action**; menu **Research → Awaiting action**; the mark **!** on
  the card and **Answer · N waiting** in the person's menu.
- **Since:** app 3.4.0. Questions about places from research 1.25.0. The mark **!** and **Answer · N waiting** work
  this way since app 3.26.0. Hypotheses from app 3.27.0 with research 1.31.0. Several marks on a card from app 3.27.0
  ([S4.4.1](#S4.4.1)).
- **From app 3.28.0:** in the **Research overview** the section has a search field from 10 items ([S4.4.2](#S4.4.2)).

<!-- zdroj: app:v3.21.2 src/ui/research-ui.ts renderLivePanel (waiting) · strings.ts research.answerWhere, research.answerHere, research.answerMixed · app:7cf409bd src/ui/card-signals-ui.ts answerPersonWaiting (vyprávění → porovnání; 1 položka → waitingAnswerAction; jinak showPersonWaiting, why jen když žádná nejde), personSignalsMenuHtml (dotyk: menuWaiting → signal-waiting-list) · src/ui/research-ui.ts showPersonWaiting (telefon, sbalený/skrytý oddíl, otevřený přehled → přehled), waitingWhyEl · src/research-waiting.ts personWaiting, panelWaiting (focus první) · src/ui/waiting-task-ui.ts waitingAnswerAction · src/card-signals.ts ACTION_GLYPH waiting '!' · strings.ts card.menuAnswer, card.menuWaiting, card.tipClickAnswer, live.waitingNoAnswerHere · e2e/card-waiting-answer.spec.ts · hypotézy: app:src/ui/hypothesis-waiting-ui.ts (commit 8d7f1597), research:src/core/waiting.ts hypothesesApp -->

<a id="S4.4.1"></a>
### S4.4.1 Several marks on a person card

A person card has in the corner of the portrait (the photo or the initials) at most one research mark of each kind:
**!** (something waits, [S4.4](#S4.4)), **≠** (conflicting sources, [R5](R5-conflicts.md)) and **?** (an open
question). With one mark the card behaves as before. Two or three marks stand stacked as one button.

- **Limits:**
  - order of the marks: waiting › conflict › question; in front, where a single mark stands, is the most urgent one,
    the ones behind have no sign. Only the kinds switched on in **Settings → Person card → Show on card** show
    (**Awaiting action**, **Conflicting sources**, **Open questions**);
  - the hover bubble has a row for each mark (what waits with the text of the first task, conflicts and hypotheses,
    the question) and under them "Click: choose what to open". A screen reader hears what waits ("3 waiting, 2
    conflicts, 1 hypothesis, 1 question");
  - a click opens by the marks a small window with the person's name and years (screen reader: "{name}: what
    waits") and the choices: **Answer · N waiting** with the text of the first task (on a touch device **Waiting · N
    ›**), **Compare** (a new version of a story), **What the research knows · … ›** (conflicts, hypotheses and the
    question as one choice), **Follow the research ›** (the agent is working on the person). The choices stay in
    the app, none has the research mark ([S4.5.1](#S4.5.1));
  - only a conflict and a question give a single choice: a click opens **What the research knows** straight away
    ("Click: what the research knows");
  - the window stands below the marks, at the right or bottom edge of the window the other way round, where it fits
    nowhere at the top, and it scrolls. It is closed by a click beside it (which does nothing else), a second click
    on the marks, Esc, a choice, scrolling or zooming the tree, resizing the window and redrawing the tree. On a
    phone (up to 640 px) it is a sheet from below with rows of 48 px, closed by a tap beside it or dragging down; on
    a tablet and a phone sideways a window with rows of 44 px;
  - keyboard: Enter, space or down arrow on the marks opens the window on the first choice, the arrows go round,
    Home and End, Enter chooses, Esc returns to the marks, Tab goes on;
  - a card without a portrait (**Card detail → Compact**) has two dots instead of the marks. With the tree zoomed out
    below 0.55 every card, in every **Card detail**, has one dot instead of the marks. A printed tree has no marks.
- **Controls:** app: a click on the marks in the corner of the portrait; **Settings → Person card → Show on card**.
- **Since:** app 3.27.0

<!-- zdroj: app:16461aca, 85c1f704, abf7620f src/card-signals.ts ACTION_ORDER (waiting, conflict, question), presentActions (zapnuté v Na kartě ukázat), stackChoices (waiting, story, knows, agent), ACTION_GLYPH · src/card-signal-marks.ts cardActionMarksHtml (stoh n2/n3, tečky), stackAriaLabel, stackTipHtml (tipClickChoose / tipClickKnows), stackMenuItemsHtml (menuAnswer / dotyk menuWaiting, story.compare, menuKnows, menuAgent; bez značky výzkumu), placeStackMenu · index.html .card-signal-stack, #tree-canvas.zoom-far (src/zoom.ts ZOOM_FAR = 0.55; index.html:13732-13741 jedna tečka u všech Detailů karet, e2e/card-signals.spec.ts:353), body.view-mode-print bez značek, compact dvě tečky · strings.ts card.stackLabel, stackWaiting, stackMenuLabel, tipClickChoose, cardDensity.cardWaiting, cardConflict, cardQuestion, compact · CHANGELOG.cs.md 3.27.0 „Více značek na kartě“ · dirigent:prace/1111-app-karta-vice-znacek -->

<a id="S4.4.2"></a>
### S4.4.2 Searching Awaiting action

The section **Awaiting action** in the **Research overview** has the field **Search people, places, archives,
tasks…**. The app searches by itself in the items it already has and sends nothing to the research. It filters right
while typing, also without following, when the research is not running (the items the research said last,
[S4.1.5](#S4.1.5)), and in the overview's window ([S4.1.6](#S4.1.6)).

- **When the field is there:** in an unfolded section with 10 or more items, under the section's heading and above
  the kind chips. With a text typed the field stays even when the items get fewer.
- **What is found:** items that have every typed word (in any order; words are split by a space, a comma or
  a semicolon) in what their row, their detail or their group's heading shows:
  - the item's text and what it waits on;
  - people's names and numbers (`P47` and `P0047`);
  - a task's number (`T0815`, `t815`) and a hypothesis's (`H22`); a bare number (`815`) finds the task with that
    number, else the hypothesis, else text (a year, for example);
  - the group's name (a place, an archive, an office), the archive's address at a permission and whom a letter goes
    to.
- **Text matching:** regardless of upper and lower case and diacritics; ß, ł, đ, ø, æ and œ are also found as ss, l,
  d, o, ae and oe (`grosshof` finds "Großhof"). A word of 5 or more characters also finds words that begin like it
  without its last character (`bialy` finds "Białe").
- **Limits:**
  - the kind chips (**Decisions**, **Images**, **Archives and offices**…) show the number found; a kind without
    a match is dashed and can still be chosen. The search is in the chosen kind;
  - above the list "Found 12 of 40" (of the chosen kind's items). With no result **Nothing found.**, in a chosen kind
    "Nothing found in Images." with **Search all kinds**, and **Clear search**;
  - phases (**To do**, **Awaiting a reply**) and groups with a match unfold, those without a match are not shown.
    What is folded during a search holds only for that search; after the field is cleared, the manual unfolding
    comes back;
  - a match of a person's, task's or hypothesis's number has an amber tag at the row ("P0108 Jan Horák"); a text
    match is not highlighted;
  - hypotheses in the group **Hypotheses to decide**: the selection's head **Select found with a proposal (n)**
    selects only those found. Those selected outside the search stay selected and the foot says so ("5 selected,
    2 outside the search.") with **Deselect outside the search**. **Accept proposals (n)** counts all selected
    ([S3.5.2](S3-what-the-research-knows.md#S3.5.2));
  - a folded section with a search typed has in its heading a magnifier and the searched text instead of the
    summary;
  - an older research without kinds and groups: the search is in the rows as they follow;
  - × or Escape clears the field (Escape in an empty field closes the overview), ↓ moves to the first row, a screen
    reader says the number after a short pause. The text holds until the overview closes and is kept nowhere;
  - a phone: the field is 44 px high; after a tap into the field the section moves under the overview's heading and
    the overview ends above the keyboard, so what is found is between the field and the keyboard.
- **Controls:** app: **Research overview → Awaiting action**, the search field.
- **Since:** app 3.28.0

<!-- zdroj: app:8cbada1c src/section-search-match.ts foldSearch2 (ß ł đ ø æ œ), tokenize (mezera, čárka, středník; p/t/h + číslo, samotné číslo), matchDoc (každé slovo; n: úkol, hypotéza, text), textMatches (≥ 5 znaků bez posledního na začátku slova), fieldVisible (≥ 10 nebo text) · src/ui/section-search.ts (×, Escape: nejdřív hledání, prázdné pole zavře Přehled; ↓; searchOpen se vymaže s textem; zavření Přehledu text zahodí) · app:9ebf7f2c src/section-search-filter.ts searchSection, chipCount, sectionPartOpen, toggleSectionPart, sheetOverKeyboard · src/ui/section-search-view.ts mountSectionSearch, paintSearchChip (čárkovaný), appendSearchOutcome (sectionSearchFound, queueSearchNone, sectionSearchNoneKind + sectionSearchAllKinds, queueSearchCancel), searchHitTag, searchSummaryEl (lupa a text), bindSheetSearch, keepSheetOverKeyboard · src/ui/research-overview-ui.ts appendOverviewWaiting (pole jen v rozbaleném oddílu, starší výzkum bez skupin), waitingSearchDoc (what, on, osoby, person, partner, task, hypo, group.name / otázky k místům, host, to), overviewWaitingRow (hit t, p) · app:cd0030b0 src/ui/hypothesis-waiting-ui.ts hypothesisAcceptHeadEl (bulkSelectFound), hypothesisAcceptFootEl (bulkSelectedHidden, bulkDeselectHidden), hwr-id hit h · strings.ts live.waitingSearchPlaceholder, waitingSearchAria, sectionSearchFound, sectionSearchNoneKind, sectionSearchAllKinds, bulkSelectFound, bulkSelectedHidden, bulkDeselectHidden, sectionSearchQuoted, waitingPhaseTodo, waitingPhaseSent, waitingChips · e2e/overview-waiting-search.spec.ts · CHANGELOG.cs.md 3.28.0 (e540e4b5) · spec 083 K1.1–K1.3 · prace/1113-app-hledani-v-prehledu (pole 44 px na telefonu) -->

<a id="S4.5"></a>
## S4.5 Actions that open the research

Most research actions in the app are a `strom-research://` link. The link opens the research's terminal on the same
computer. The terminal says what the app asks for and asks. Without confirmation in the terminal nothing is written
or paid.

- **Limits:**
  - An action is visible only on a computer (not on a touch device), only when the research has announced the link and
    only when **Strom Research on this computer** is on.
  - The link carries only record numbers and fixed values, no names and no free text.
  - The terminal begins **The Strom app asks for: … / Research: …** and asks **Go on?** For the agent's work
    it adds **The agent works on the subscription or AI credit of its account.**, for assigning tasks **The research
    writes tasks for the agent — nothing is searched and nothing is paid now.**
  - A Strom archive and a research waiting for an agent refuse the agent's work (conversation, review, search,
    places, history).
  - When the same active direction already exists, **Find ancestors** only says **This research is there already:
    “…” — the agent goes on with it.**
  - The app does not know whether the terminal opened. It shows **Opening the research…** and the hint **If nothing
    happens, Strom Research is not running yet.**
- **Controls:** app: **Settings → Data and privacy → Strom Research on this computer**.
- **Since:** app 3.4.0 (research 1.6.0). Refusal in a Strom archive from research 1.14.0, while waiting for an agent
  from 1.15.0.

<!-- zdroj: app:v3.21.2 src/ui/research-ui.ts researchLinkAvailable, launchResearchLink, :841 onComputer · strings.ts research.linksSetting, research.openingQuietHint · index.html linksSetting · research:v1.25.2 src/commands/links.ts:128 refusedHere, :153 inTerminal, :351 ui.research.exists · src/core/links.ts (hlavička) · assets/lang/cs.json ui.link.asks, ui.link.go, ui.link.cost, ui.link.tasks, ui.archive.refuse, ui.waiting.refuse -->

<a id="S4.5.1"></a>
### S4.5.1 Action marks

Each research action has one of three marks according to what it opens.

| Mark | What happens | Actions |
|---|---|---|
| no mark | nothing opens the terminal | **Follow live**, the crop and the original in the viewer, loading the tree |
| terminal | the terminal shows or asks; a click pays nothing | **Open the research**, sending edits, **Review again…**, **Find ancestors**, **Park**, **Drop**, direction actions, **Finish and stop**, **Undo last send**, settings, **Research check** |
| AI and terminal | the agent's work, paid by the AI subscription | **Continue with the agent**, **Ask the agent**, **Work on this direction**, a conversation about a task or a conflict, research of places, the history of a place |

- **Limits:** for the agent's work the app shows while opening **Opening the agent…** and **Tell the agent what to
  find out. The agent's work uses the AI subscription.** A conversation can open the agent's app instead of the
  terminal when the research is set up that way.
- **Since:** app 3.21.0
- **From app 3.28.0:** **Work on the queue…** and **Open terminal** in its dialog have the mark AI and terminal
  ([S4.2.3](#S4.2.3)). Searching the queue, **Do next** and **Undo** have no mark: they go through the bridge and
  open nothing ([S4.2.1](#S4.2.1), [S4.2.2](#S4.2.2)).

<!-- zdroj: app:v3.21.2 src/research-link.ts:66 RESEARCH_LINK_MARKS, researchLinkMark (task do=chat, conflict do=agent, experiment do=off, fixes paid) · strings.ts research.openingAgent, research.openingAgentHint · research:v1.25.2 src/commands/links.ts:373 whereToTalk · 3.28.0: app 9cf43b22 researchLinkMark('work') u queue-work-btn, research-item-queue-work, Otevřít terminál; ZADANI_DEV_fronta-hledani „Značení akcí“ -->

<a id="S4.5.2"></a>
### S4.5.2 Where the actions are

- **Research menu** (only on a computer, not for a locked tree): at the top at most 6 items: **Awaiting action**,
  **Continue with the agent**, **Research overview** or **Follow live**, **Open the research**, sending edits. Below
  that **Load the new version**, **Research tools**, **Undo last send** (at most 7 days old) and the research
  settings. At the bottom it says **continues in the research on this computer. Nothing is written or paid without
  confirmation there.**
- **Research tools**: groups **Look**, **Assign work**, **Run the agent**. In 3.21.2 they hold only **Research
  check**.
- Person menu **Research ›** (only for a person the research knows): **Review again…** (a window with the scope: the
  person only, with the family, with the ancestors; **Continues in the research terminal, where the tasks are shown
  and confirmed. Free.**), **Find ancestors**, **Find descendants**, **Ask the agent**.
- **Research overview → Now**: for a working agent **Finish and stop** ([R7.3](R7-when-the-agent-works.md#R7.3)).
- In a Strom archive everything that needs an agent is missing, **Follow live** too.
- **Since:** app 3.4.0; the top 6 items from 3.14.0, **Research tools** from 3.19.0, **Finish and stop** from 3.5.0
- **From app 3.28.0:**
  - the **Research** menu has under **Continue with the agent** the item **Work on the queue…** ([S4.2.3](#S4.2.3))
    when it is offered. When there are more than 6 items at the top, **Open the research** is the first to move to
    **More actions**;
  - in **Now** the actions stand under the text of each session, in one row: **Show in tree** · **Finish and stop**.
    On a phone there is only **Show in tree**.

<!-- zdroj: app:v3.21.2 src/ui/research-actions-ui.ts:152 UNDO_MAX_AGE_MS, :158 FIRST_LEVEL_MAX, :300 researchMenuShown, :435 tools, :1000 personResearchActions · src/research-link.ts:115 RESEARCH_TOOL_GROUPS, :132 RESEARCH_TOOL_ACTIONS · research-overview-ui.ts:811, :870 finishSession · strings.ts research.footerFull, research.tools.*, research.reviewWhere, research.continueAgent · 3.28.0: app 9cf43b22 src/ui/research-actions-ui.ts research-item-queue-work za research-item-chat (queueWorkMenuOffered), FIRST_LEVEL_MAX 6: research-item-open do more · 623d9c77 src/ui/research-overview-ui.ts overviewNowActions (now-actions pod textem: showInTree · finishSession, finish ne v sheet), overviewNowLine (každé sezení svůj řádek) · ZADANI_DEV_fronta-hledani §6 (varianta A) -->

<a id="S4.5.3"></a>
### S4.5.3 Opening a task in the queue

**Open task T…** opens a task in the queue in the research's terminal. The terminal shows the task and asks what to do
with it now.

- **Limits:**
  - the terminal shows **Task T… is in the queue: the agent takes it up in its turn.**, **Why: …** and **Done when:
    …** and asks **What now?**:
    - **Go through it with the agent (…) now, in a conversation**: it asks first and says what similar sessions cost
      here, or that this is not known yet;
    - **Put it ahead in the queue (the highest priority)**: priority 5; if the task already has it, nothing happens;
    - **Leave it in the queue as it is**;
  - Enter or 0 writes nothing. Nothing happens to a task the agent is working on right now;
  - a task that waits for a person opens its existing question.
- **Controls:** app: **Open task T…** (terminal mark) after a task from a new reading is created, and in the line at
  the source ([R8.8.3](R8-reading-scans.md#R8.8.3)). Terminal: `strom chat --task T…` takes the task from the queue
  straight into a conversation.
- **Since:** research 1.29.0, app 3.25.0

<!-- zdroj: research:c2a690ea src/cli/menu-links.ts (odkaz task bez do, úkol open) · assets/lang/cs.json ui.link.open.title/why/done/pick/chat/ahead/keep/already/kept/busy/estimate/estimate.none, ui.chat.task.open.say · strom help chat (--task: „a task in the queue (open): gone through now, taken up in the conversation“) · commit 9bd14e84 · test/cli/link-open-task.test.ts · dirigent:prace/1107-vyzkum-drobnosti-ukoly/karta.md Výsledek (Popis chování 7; klik v aplikaci neověřen) · app:6bd8609e strings.ts read.openTaskN, src/__tests__/read-source-state-view.test.ts:75 (researchLinkMark task) -->

<a id="S4.6"></a>
## S4.6 What is only in the terminal

The app shows and asks, the terminal decides. What needs a person's consent or costs money is always confirmed in the
research's terminal, even when it starts with a click in the app.

- **Limits:**
  - Only in the terminal: starting the agent's work alone and its limits ([R7.1](R7-when-the-agent-works.md#R7.1)),
    the condition, the choice of agent, the queue settings and the items **Only here in the terminal (not in the
    Strom app)** ([R6.1.1](R6-awaiting-action.md#R6.1.1)).
  - Confirmed in the terminal: everything with the mark terminal or AI ([S4.5.1](#S4.5.1)), in 3.21.2 also the
    actions of directions and of the queue.
  - On a phone there are no links; answers are given in the research on the computer ([S5](S5-phone.md)).
- **Since:** app 3.4.0 (research 1.6.0)
- **From app 3.22.0:** with research 1.26.0 directions ([S4.3.1](#S4.3.1)), work outside the directions by branches
  ([S4.3.2](#S4.3.2)) and a task's place in the queue ([S4.2](#S4.2)) go without the terminal.
- **From app 3.28.0:** with research 1.32.0 the agent's work alone on the queue can be asked for from the app
  ([S4.2.3](#S4.2.3)). The research's terminal starts it only after confirmation
  ([R7.1.2](R7-when-the-agent-works.md#R7.1.2)); the condition and its settings stay in the terminal.

<!-- zdroj: research:v1.25.2 src/core/links.ts (hlavička: nic se nezapíše bez slova člověka v terminálu) · src/core/live.ts (hlavička mostu) · app:v3.21.2 src/research-link.ts:66 · HEAD src/research-directions-write.ts · 3.28.0: app 9cf43b22 src/ui/queue-work-dialog.ts (aplikace nic nespouští, odkaz work) · spec 052 K6.2 (cesta terminál) -->
