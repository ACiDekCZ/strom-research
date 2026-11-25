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
- **Controls:** app: the panel, buttons **⤢ Open overview** and **End following**; menu **Research → Research
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
  **Research** it is always first, second is **Follow live**, while following **End following** in its place; in
  the Strom archive there is no **Follow live**. From the **Tree overview** it is opened by **Research ›** in the
  heading of **Where to focus**. The button **⤢ Open overview** in the small panel is there only while following.
  - The summary shows only the parts switched on ([S4.1.2](#S4.1.2)): **Last 24 h** people and sources, **This
    month** the number of sessions. The cost (the amount and the readers of scans) shows only once switched on,
    otherwise not even in the hover text. Under the small panel stands "Agent this month: 4 sessions", the amount,
    both, or nothing.
  - In a direction's row in the section **Directions**, the work shows only as "being worked on" when the section
    **Now** is visible (expanded or collapsed); the whole "Now: …" is in the hover text. With **Now** hidden, the
    row says the whole "Now: …".
- **From app 3.28.0:** on a computer the overview also opens in a separate window ([S4.1.6](#S4.1.6)). From app
  3.30.0 the small panel next to this window has only the header and **At work**.
- **From app 3.28.0:** the small panel remembers on this device whether it is folded: one choice for all researches,
  open by default. A page reload, new following and the panel of another research take it over; only the panel's
  arrow writes it. An open overview no longer unfolds the panel behind it. A phone neither reads nor writes the choice
  (the strip opens the overview as before). Without the browser's storage (private window) it lasts until the page is
  closed.
- **From app 3.31.0:** on a phone held sideways the unfolded panel of a followed research folds to its strip when the
  indicator of loading photos **Photos k / n** ([S1.4.1](S1-connecting-app-and-research.md#S1.4.1)) or a notice appears (not the **Undo** pill nor the confirmation of the
  focus). It does not unfold again by itself, not even when the indicator or the notice goes; a tap on its header
  unfolds it. The folding is not remembered as the device's choice. On a computer, a tablet and a phone held upright
  nothing changes.
- **From app 3.31.0 with research 1.36.0:** **At work** and **Now** also show an agent working directly in the
  research ("Claude Code working directly"). For work that holds a task ([R7.9](R7-when-the-agent-works.md#R7.9)),
  it says "last sign 14:31; free by 15:01 at the latest" (the last sign only when it differs from the start; for a
  process on this computer without the time of release). A run waiting for a restricted archive
  ([R9.13](R9-archives.md#R9.13)) has the state "Paused · waiting for the archive … (at most until 14:40)". With an
  older research everything is as before.
- **From app 3.31.0 with research 1.36.0:** with several runs **Now** has a block for each run; each is followed and
  stopped on its own ([S4.1.8](#S4.1.8)).
- **From app 3.32.0 with research 1.37.0:** when the agent saves a book's images through its browser
  ([R9.5](R9-archives.md#R9.5)), its row says "agent saving images (k of n)" at the task: in the live panel, in
  **Now** with one run, in a direction's row, in a run's block and at the directions. No progress bar; the number
  grows with the images. Such a task is not in **Awaiting action** nor in the counts
  ([R6.2.1](R6-awaiting-action.md#R6.2.1)). With an older research the rows are as before.

<!-- zdroj: app:v3.21.2 src/ui/research-ui.ts:223 PANEL_CHANGES, (3.28.0: app 8da3f11e MINI_OPEN_KEY strom-research-mini-open, miniPanelFolded, rememberMiniPanelFolded, ne na telefonu; otevřený Přehled panel nerozbalí), :227 AUTO_FOLD, :3326 appendQueueSection(…, 3), renderLivePanel, renderIdleResearchPanel · src/ui/research-overview-ui.ts:5 (≥1280), :51 FOLDED_BY_DEFAULT, :53 GROUP_MS, :59 MAX_STEPS, :74, :309-311 · strings.ts live.overviewTitle, research.panelLabel, research.stop, research.atWork, research.queue · 3.27.0 Teď: app 4e4f6d8c src/research-link.ts WORKING_HELPS_FEATURE (working.helps), sanitizeWorking (helps jen s linií, branch) · src/ui/research-offline-ui.ts workingWhyText (helps → qWhyHelps + qWhyHow / qWhyHowBranch; větev mimo linie → qWhyOutBranch, ve skupině qWhyHowBranch) · src/ui/research-overview-ui.ts (Teď: důvod místo názvu linie) · strings.ts live.qWhyHelps, qWhyHow.*, qWhyHowBranch, qWhyOutBranch · spec 036 K1.8 · malý panel: app 2c018779 src/ui/research-ui.ts, research-directions-ui.ts (pod nadpisem linie jen jak) · 3.27.0 spec 057: app f05fff8e src/ui/research-actions-ui.ts overviewRows (research-item-overview první; stop při sledování, jinak followLive, ne bez agenta), src/ui/tree-actions.ts researchOverview · 8d564b35 src/ui/tree-overview.ts treeOverviewResearchLinkHtml (live.researchLink v záhlaví focus) · 28bbebeb src/ui/live-section-prefs.ts TOP_DEFAULTS (month.price false), research-overview-ui.ts appendOverviewSummary, strings.ts live.spendSessions, spendAmount · 87a6ea88 live.dirWorkedOn · strings.ts live.openOverview · 3.31.0: app 7be40d24 src/ui/landscape-panel-fold.ts (MQ_PHONE_LANDSCAPE, jen rozbalený panel, images nebo toast message, nerozbalí se sám, nepamatuje se) · SPEC.md 1120-app-108-diry · spec 116 · 3.31.0 spec 127: app:f89b5166, 040e42e6 src/research-holds.ts workingHoldText, waitsText, src/ui/research-ui.ts pausedText (statePaused · waitsArchive), workingHoldEl, src/ui/research-overview-ui.ts:921, src/research-link.ts features task.holds, archive.holds · strings.ts live.holdLast, holdFreeBy, waitsArchive · research cs.json who.agent · 3.32.0: app:7a10c93f (working[].saving jen s working.saving: kniha, dvě celá čísla, saved ≤ of) strings.ts live.workingSaving · research:81de7cdb src/core/live.ts working[].saving, feature working.saving -->

<a id="S4.1.1"></a>
### S4.1.1 Follow the agent in the tree

The tree can move by itself to the person the agent is working on right now (the first work not paused in the section
**Now**).

- **Limits:** at most one move every 8 s. When the tree is zoomed out more than 0.55, it zooms in to 0.8. Moving the
  tree, selecting another person or another view interrupts following (**Back to the agent**); after 20 s without a
  touch it returns by itself. The choice is remembered for the device.
- **Controls:** app: **Research overview → Follow the agent in the tree** / **Stop following here**.
- **Since:** app 3.5.0
- **From app 3.24.0:** following also works in the fan and on the map ([S4.1.3](#S4.1.3)); moving the map pauses it the same way.
- **From app 3.30.0:** ◎ **Stop following here** stops the jumps only in the window where it is clicked; the other
  windows keep following, each in its own view ([S4.1.7](#S4.1.7)).
- **From app 3.30.0:** the arc around the portrait of the person the agent works on also shows beside the research
  marks on the card ([S4.4.1](#S4.4.1)).

<!-- zdroj: app:src/ui/live-follow-ui.ts:7, :26 ZOOM_FAR, :27 ZOOM_READABLE, :32 gap 8000 / idle 20_000 · strings.ts live.followOn, live.followOff · 3.30.0: spec 097 O1, O3, ZADANI_DEV §6 (◎ v hlavním okně další okna nevypne) · oblouk vedle značek: app:16cba085 src/card-signals.ts showAgent -->

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
- **From app 3.30.0:** **Follow the agent in** applies only to the main window; other windows follow in the view they
  show ([S4.1.7](#S4.1.7)). On a computer with a mouse (a window wider than 640 px) the help in Settings says so:
  "Applies to the main window when following starts and on Back to the agent. Other windows follow in their own
  view."

<!-- zdroj: app:src/ui/live-follow-ui.ts (hlavička, followIn) · src/live-follow-prefs.ts · src/live-follow-targets.ts TRAIL_MAX=8, TRAIL_MAX_AGE_MS=60 min, fanCenter, sessionNumbers, sessionTone · src/live-follow-map.ts · src/fan-follow-anchor.ts MAX_UP=12 · src/ui/fan-follow-ui.ts · src/ui/map-follow-ui.ts PAN_MARGIN=64, PAN_MS=400, telefon bez čáry · strings.ts settings.groupResearchFollow, researchFollowNote, followView(Help), followFanCenter*, followTrail(Help); live.followIn, mapPaused, legendTitle, legendTrail, legendRecord, legendPerson, legendOut; fan.pin, unpin, centerLabel, workOutside; map workRecord, workPerson, outScope, noCoords, noPlace, locate · CHANGELOG.cs.md 3.24.0, 3.25.0 · spec 043 · 3.30.0: app:e7e79873 src/ui/live-section-edit-ui.ts (isMouseWide → settings.followViewHelpWindows) · src/breakpoints.ts MQ_MOUSE_WIDE · spec 097 O5, ZADANI_DEV §8 -->

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
- **From app 3.32.0:** a placeholder person "?" that got a new ID in a load is neither new nor removed: neither the
  mark at the edge nor the screen reader announces it; only real people are announced. This also holds after a send
  to the research and after undoing a merge.
- **Since:** app 3.24.0

<!-- zdroj: app:src/live-transition.ts LIVE (move 320 ms, maxAnimatedNew=12, maxChangedForScene=60, ×0.875 touch), src/live-diff.ts (merge guess: surname, birth ±1, parent/partner) · strings.ts settings.liveMotion, liveMotionHelp, liveMotionReduced, edgeAdded · CHANGELOG.cs.md 3.24.0 · spec 055 · 3.32.0: app:6c90cc34 (134 V-N6: realPeople, zástupná „?“ s novým ID se nehlásí) -->

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
  beside it shows again once the overview closes. **End following** in the open overview only ends following and the
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
- **From app 3.30.0:** while the overview window is open, the small panel in the main window on a computer (a window
  wider than 1024 px) shows only the header and **At work**. **Awaiting action**, **Latest changes** and **Up next**
  are in the overview window.
  - **At work** is always expanded, even when it is collapsed or hidden in **Customize panel** ([S4.1.2](#S4.1.2));
    the choice is kept and applies again after the window is closed. When the agent is not working, it says
    "Nothing is being worked on now";
  - the chip **Waiting N** in the header, the chips of waiting items and of new changes in the summary of the
    collapsed panel and "All sections are hidden." are not there then. The strips under the header (for example
    **Follow in**) and the number of sessions under the panel stay;
  - the panel does not fold by itself; when **At work** does not fit, it scrolls;
  - after the overview window is closed, the panel is whole and the sections are collapsed and expanded as before.
    When the window narrows to 1024 px and less, the panel is whole, after widening again only **At work**;
  - **⤢** in the panel brings the overview window to the front;
  - a phone, a tablet, ended following and a panel without following are unchanged.
- **Controls:** app: ⧉ in the overview's heading (between ⋯ and ⤡); ⧉ **Open in a new window** next to the view
  switch → **Research overview**.
- **Since:** app 3.28.0; 3.30.0: the small panel next to the window only with **At work**

<!-- zdroj: app:4b1373a7 src/windows/overview-window.ts (research-state bez adresy a tokenu mostu, OVERVIEW_ACTION_IDS, OVERVIEW_ACTIONS_TO_MAIN, 6g) · src/windows/overview-main.ts · src/ui/research-overview-ui.ts OVERVIEW_WINDOW_COLS_MIN 1100, WINDOW_LEFT (working, waiting, directions), overviewMode 'window', overviewWindowButton (jen canOpenWindows, ne sheet), canOpenResearchOverview · index.html html.window-overview (bez ⤡, ×, ⧉, Follow in) · src/windows/window-controls.ts renderMenu (overview: focusOverviewWindow / openInNewWindow) · strings.ts win.overviewHead, overviewOffNote, noResearch, noResearchNote, overviewInWindow, mainClosed · CHANGELOG.cs.md 3.28.0 · spec 079 P3 (K3), ZADANI_DEV §6 · prace/1113-app-okna-prehled (8a7575f0..4387a662) · app:3c2fde77 src/ui/overview-window-view.ts readQueuePage přes akci queue-list do hlavního okna (okno most nevolá) · app:3f9a5ca4 overview-window-view.ts treeVerifyNow (extras.verify), verifyStop → verify-stop, showVerifyBulkDialog → verify-bulk; evidenceHighlightNow (extras.highlight), endEvidenceHighlight → highlight-end, startPersonHighlight quiet · src/ui/research-ui.ts lightsGroup, markOverviewLit (is-lit, aria-current; nic při zavřeném hlavním okně) · research-overview-ui.ts lightsGroup direction (show-in-tree v Teď), changed (showChanged) · research-directions-ui.ts lightsGroup direction (dirShow), direction-found (dirFoundPersons) · strings.ts verify.section, bulkRow, stop, live.showInTree, dirShow, showChanged · spec 079 K3 · prace/1113-app-dorovnani-052-okna (2876d570..27f0bafb) · app:7f307c74 src/overview-columns.ts OVERVIEW_WINDOW_COLS_2 1100, OVERVIEW_WINDOW_COLS_3 1600, OVERVIEW_COLS_HYSTERESIS 24, OVERVIEW_SMALL_COLUMN 0.2, OVERVIEW_COLUMN_MAX 660, partitionContiguous, planOverviewColumns · src/ui/overview-columns-ui.ts (souhrn a pruhy nad sloupci, každý sloupec se posouvá sám, nové rozdělení jen při změně sloupců, sbalení, skrytí, přesunu, Načíst další; lepkavá hlava: pole nebo > 8 řádků; fokus, výběr v poli a oddíl na očích při změně šířky) · e2e/windows-overview-columns.spec.ts · CHANGELOG.cs.md 3.28.0 (e540e4b5) · spec 083 U3 · prace/1113-app-hledani-v-prehledu · 3.30.0: app:965e83f8 src/ui/live-panel-working-only.ts livePanelWorkingOnly (okno Přehledu, isDesktop > 1024 px, ne ukončené), livePanelDrawnSections (jen working), livePanelNothingAtWork · src/ui/research-ui.ts (třída working-only, bez štítků waiting a nových změn, bez samoskládání; overviewWindowOpenChanged, placeLivePanel při přechodu 1024 px; openResearchOverview → focusOverviewWindow) · strings.ts live.nothingAtWork · e2e/windows-overview-panel.spec.ts · CHANGELOG.cs.md 3.30.0 „Panel výzkumu vedle okna Přehledu“ · spec 079 U9 (rozhodnutí 27, 16. 11.) · dirigent:test/vysledek-1116-app-079-panel.md -->

<a id="S4.1.7"></a>
### S4.1.7 Following the agent in other windows

While research is followed ([S1.4](S1-connecting-app-and-research.md#S1.4)), every other window of the tree
([A6.8](A6-views.md#A6.8)) follows the agent too, each in its own view. One window can be detached to look at
something else meanwhile; the other windows keep following. All windows are read-only during that.

- **When:** while the main window follows research live. Every other window joins, also one opened before following
  was turned on (without a reload) or only during it. Another window does not connect to the research bridge: the
  main window sends it the agent's state, without the bridge's address.
- **View:** a window follows in the view it shows. **Follow the agent in** ([S4.1.3](#S4.1.3)) applies only to the
  main window, and **Back to the agent** does not switch the view of another window.
  - **Family**, **Fan**, **Map:** the jump after the agent, the marks, the trail and the legend as in the main window
    ([S4.1.1](#S4.1.1), [S4.1.3](#S4.1.3));
  - **Table:** the agent's row ([A6.7.18](A6-views.md#A6.7.18));
  - **Descendants**, **Timeline:** no jumps, the strip says so. Scrolling in them does not pause following. After a
    switch to Family, Fan or Map the window jumps to the agent at once.
- **The strip under the window's heading** says how the window follows (with an icon and text). The last button is
  always **Go to the main window**.

| Window state | Strip | Buttons |
|---|---|---|
| following | "Following the agent · read-only"; in Descendants and Timeline "Following the agent · no jumps in this view · read-only" | **Detach this window** |
| following, the agent is working on nobody of this tree | "The agent is not working now · read-only" | **Detach this window** |
| paused | "Following paused · read-only" | **Back to the agent**, **Detach this window** |
| detached | "This window is not following the agent · read-only" | **Follow the agent** |
| the connection to the bridge dropped | "The connection to the research dropped · trying again" (amber) | **Detach this window**, in a detached window **Follow the agent** |

- **Pause:** a manual move, zoom or choice of a person in the window (in the Table scrolling or a click into the rows)
  pauses following only in this window. **Back to the agent** brings it back, or it comes back by itself after 20 s
  without a touch. The strip tells of the pause; another window has no floating pause label and no "Map panning
  paused". A pause in the main window does not affect the other windows, and a pause in another window does not
  affect the main one or other windows. Reloading the window (F5) cancels the pause.
- **Detaching:** **Detach this window** stops the jumps after the agent in this window; the window can be browsed
  freely and stays read-only. The agent's marks (the card of the person being worked on, the agent's row in the
  Table, the marks and the trail in the Fan and on the Map) stay in it. **Follow the agent** attaches the window again
  and it jumps to the agent at once. Detaching survives reloading the window (F5) and is forgotten when following
  ends.
- **A choice from another window:** a following window that is not paused only marks a person chosen in another window,
  even with **Chosen person** → **This window**: **switch** ([A6.8.1](A6-views.md#A6.8.1)); the centre stays with the agent.
  The Table selects that person's row but does not scroll to it. The jump after the agent is not sent to the other
  windows as a choice of a person. A paused or detached window goes by the choice **This window** as outside following.
  A choice sent to the main window with **focus** is only marked by a main window following the agent
  ([A6.8.4](A6-views.md#A6.8.4)).
- **End:**
  - ◎ **Stop following here** in the main window stops the jumps only in the main window; the other windows keep
    following;
  - **End following** (the research panel, the **Research** menu, the person menu) and the end of the session end
    following in all windows: the strip disappears, the tree can be edited again, detaching is forgotten and every
    other window reports it ("Following the research ended · the tree can be edited").
- **The main window closed during following:** one of the other windows becomes the main window by itself and
  following continues in it.
  - The closing is recognised by 3 s without a message from the main window ([A6.8.2](A6-views.md#A6.8.2)).
    Reloading the main window (F5) triggers none of this;
  - order: first the windows following the agent (following and paused), then the detached ones; in each group from
    the oldest window. The Research overview window ([S4.1.6](#S4.1.6)) does not become the main one. Each window in
    the order waits 400 ms longer than the one before, and only one becomes the main window;
  - that window shows "The main window closed · following continues in this window…", reloads as the main window with
    the same view and with ◎ on if it was on in the closed main window. The other windows report "Another window took
    over following" and stay as they were (a detached one stays detached);
  - when this browser has no stored address of the research bridge, no window becomes the main one and the windows
    show "Following can’t be restored · the main window closed" with **Make this the main window** and **Open Strom**
    ([A6.8.2](A6-views.md#A6.8.2));
  - without following, [A6.8.2](A6-views.md#A6.8.2) applies unchanged.
- **Limits:** other windows exist only on a computer ([A6.8](A6-views.md#A6.8)); a phone and a tablet are unchanged.
  The main window does not show how many windows are following.
- **Controls:** app: in the strip of another window **Detach this window**, **Follow the agent**, **Back to the
  agent**, **Go to the main window**; in the main window ◎ **Stop following here** and **End following**.
- **Since:** app 3.30.0

<!-- zdroj: app:9cec9c30 (od 3714c539) src/windows/agent-follow-state.ts AgentFollow attached/paused/detached, agentFollowKey (sessionStorage jen detached), setLive (konec sezení zapomene odpojení), detach, attach, setPaused · src/windows/agent-state.ts, agent-mirror.ts, src/ui/agent-window-ui.ts (stav agenta z hlavního okna bez adresy a tokenu mostu, K1.3) · src/windows/sat-states.ts SatStrip, liveStrip (lost › paused › detached › idle › attachedNoJump › attached), STRIP_ICON, AMBER, writeStrip (tlačítka, goToMain poslední) · src/main.ts noJump (descendants, timeline) · src/ui/live-follow-ui.ts (další okno: pohled okna, Zpět pohled nepřepne, bez štítku pauzy ani mapPaused, pauza jen v okně, návrat po 20 s) · src/windows/window-selection.ts (připojené okno výběr jen vyznačí; skok agenta se nerozesílá) · src/windows/takeover.ts TAKEOVER_STEP_MS 400, takeoverOrder (sledující, pak odpojená; okno bez vlastního sledování ne), hasBridge (storedResearchBridge) · src/windows/become-main.ts, window-start.ts (◎ jako v zavřeném hlavním okně) · strings.ts win.agentAttached, agentAttachedNoJump, agentIdle, agentPaused, agentDetached, detach, attach, bridgeLost, followEnded, takingOver, takenOver, takeoverFailed, goToMain; live.followOff, followBack; research.stop · CHANGELOG.cs.md 3.30.0 „Sledování agenta ve všech oknech“ · spec 097 K1.1–K1.4, K2.1–K2.6, Rozhodnutí 16. 11. O1–O5, dotazy 3–5, 8 · app:docs/ZADANI_DEV_sledovani-ve-vsech-oknech.md §1–§4, §6, §7; ZADANI_UIX dotazy 10, 12 · prace/1116-app-097-sledovani-okna -->

<a id="S4.1.8"></a>
### S4.1.8 Now with several runs

With a research that can do runs of lines ([R7.10](R7-when-the-agent-works.md#R7.10)), the section **Now** in the
**Research overview** shows one block for each run: the run of the whole queue and the run of each direction
separately. Each run can be followed and stopped on its own.

- **A run's block:**
  - the heading: the direction's mark, its name and number (G…), for the run of the whole queue **Whole queue**; on
    the right the state: **working**, **starting…**, **waiting for the subscription limit until 14:00**, **waiting
    for the archive until 14:40**, **waiting for the archive browser** (“Another run has the archive browser; this
    one waits until it is free.”), **waiting for a download**, **waiting until …**, **finishing – the agent writes up
    findings**, **ended at 11:52**;
  - under the heading the agent, since when and for how long, and the last step (person – task) as before
    ([S4.1](#S4.1));
  - a run of the whole queue beside which directions have runs of their own: “Skips: Ancestors of Jan Horák,
    Descendants of Marie Vlková”. When it is finishing a task of a direction that has meanwhile got a run of its own:
    “Finishes T0103 of the direction …, then skips it.”;
  - an ended run stays in **Now** for 60 s with the state **ended at …**. Under it, only at an end by the limit,
    **The subscription limit ran out.** and at an error **The agent stopped with an error; the details are in the
    research terminal.**; at a run of a direction also **The whole queue takes the direction again.** Then the block
    goes. A new opening of the app does not show ended blocks.
- **Order of the blocks:** the run of the whole queue first, then the runs of directions in the order of the
  directions ([R2.1.4](R2-lines-and-queue.md#R2.1.4)). The section's heading is “Now · 3 agents”; the summary
  **State** with two or more runs “3 agents working” and possibly “1 waiting for the limit until 14:00”. From app
  3.32.0 a run waiting for an archive, the archive browser or a download is counted too: then only “1 waiting”
  (without a time).
- **The block's actions:**
  - **Show in tree**: the people of the direction, at the run of the whole queue the person the agent works on;
  - **Follow this run** / **● Followed**: only with two or more runs and with following switched on;
  - **Stop** (“Finishes the task in progress and starts no other”): right through the bridge, without a terminal, at
    a working or waiting run; while it is written **Stopping…**, at a refusal **The agent was not stopped.** The
    meaning is that of `strom run stop` ([R7.10.2](R7-when-the-agent-works.md#R7.10.2));
  - **Finish and stop**: opens the research terminal and asks that run to finish and end
    ([R7.3](R7-when-the-agent-works.md#R7.3)); at a working run and at a run waiting for the archive browser or a
    download. A run waiting for the limit or an archive does not have it;
  - a finishing run has only **Show in tree**. Stopping one run does not change the others; stopping all at once is
    not possible.
- **Following:** one run is followed. The default is the first run not paused in the order of **Now**; a new run does
  not switch the following. When the followed run ends, the default one is followed again.
  - in the tree, with two or more runs, there is the pill **Following: Ancestors of Jan Horák ▾** with the menu
    **Follow run** (the block's number and name, under them the agent and the person; a waiting run grey with its
    state; at the end **Stop following here**);
  - the people of all runs are marked as before ([S4.1.1](#S4.1.1)); the followed run has the first colour of
    following, the others the second. Instead of the session's number they carry the run's label: the direction's
    mark and the block's number in **Now** (“↑ 2”), the run of the whole queue only the number;
  - other windows of the tree ([S4.1.7](#S4.1.7)) follow the same run as the main window.
- **Phone:** the blocks and states are the same, without **Stop**, **Finish and stop** and the choice of the followed
  run; the pill only says which run is followed, and only the people of the followed run are marked.
- **Limits:** with an older research or with a single run of the whole queue, **Now** is as before.
- **Controls:** app: **Research overview → Now**; the pill **Following:** in the tree. Terminal:
  `strom run stop <run-…> [--finish]`.
- **Since:** app 3.31.0 (research 1.36.0)

<!-- zdroj: 3.32.0: app:f09e9722 src/research-runs-text.ts runsWaitingText (stateAgentsWaitingAny, když některý běh nečeká na limit) · app:4de0835a src/research-runs.ts (run.lines, RUN_ENDED_MS 60 s, orderRuns obecný první a linie v pořadí, runCount, noteEndedRuns jen v paměti) · src/ui/research-overview-ui.ts vykreslení bloku (runStateWorking/Starting/Limit/Archive/Waiting/WaitingUntil/Browser/Download/Finishing/Ended, runBrowserNote, runSkips, runFinishesThen, runEndedText jen limit|error, runAfterStop), overviewRunActions (Ukázat ve stromu; Sledovat tento běh jen ≥ 2 běhy a sledování, ne telefon; Zastavit s run.stop u working|waiting, ne telefon; Dokončit a skončit finish?run= u working a čekání na prohlížeč nebo stahování) · src/ui/live-follow-ui.ts pilulka followRunPill, followRunMenu, followOff · strings.ts live.nowAgents, stateAgents, stateAgentsWaiting, runWhole, run*, followRun* · app:docs/ZADANI_DEV_beh-po-liniich.md §3, §4, §7, Kolo 2 C2 · dirigent:spec/126 K2.1, K2.2, K2.5, prace/1121-app-126-linie, 1122-app-126-kolo2 · research: /status runs[], runsEnded[] (POST runs/stop) -->

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
- **From app 3.31.0 with research 1.36.0:** a task in the queue held by another session has the note "The task is
  held by Claude Code (session N0040) since 14:05, last sign 14:31; free by 15:01 at the latest." A task whose
  restricted archive another session is using now has "The archive … is used by another research now (since 14:05,
  last sign 14:31); free by 15:01 at the latest."; instead of "another research" it can say "session N0040",
  "another session" or "a bulk download". When other work has waited longer for the archive: "Other work has waited
  longer for the archive …; its turn by 15:01 at the latest." The research refuses to start a task another session
  holds ([R7.9](R7-when-the-agent-works.md#R7.9), [R9.13](R9-archives.md#R9.13)). With an older research without
  the notes.
- **From app 3.31.0 with research 1.36.0:** the tasks of a direction with a run of its own
  ([R7.10](R7-when-the-agent-works.md#R7.10)), and the tasks that help it, are not in the numbered rows without a
  filter. In their place one row per direction stands above the rows: the mark, the direction's name, the number of
  tasks, “done by the direction's own agent (Claude)” and **Show ›** (the direction's filter). The count in the
  **Queue** and in the chip **All directions** and the ordinal numbers cover only the tasks for the run of the whole
  queue. In the filter of such a direction its tasks are numbered in its order, and above them stands “This direction
  has its own agent at work (Claude, since 10:42). The whole queue skips it.” Work outside the directions, branches
  and local history stay with the run of the whole queue.
  On a phone the **Queue** is the same.

<!-- zdroj: app:v3.21.2 src/ui/research-ui.ts:308 queueNoteText, :3373 appendQueueSection · research-overview-ui.ts:311 (20) · strings.ts research.queue, research.park/drop/wake, research.queueMore, research.queueOffLast, research.queueOffNever, research.queueHelps · HEAD src/research-queue-pages.ts:19 QUEUE_PAGE, :28 QUEUE_ROWS_CAP · src/ui/research-ui.ts:3884 taskDoNext/taskDoLast · strings.ts live.taskDoing, live.queueLoadMore, live.queueCapNote, live.branchQueueChip, live.branchQueueChipClear · 3.27.0: app 2ee3718d (queue[].kind ze /status i ze stránek fronty, jiná hodnota zahozena) strings.ts live.queueKind · research 5f48cdaf src/core/queue.ts RUN_TURNS, runOrder (most /status queue[], GET /queue, menu před strom run), kind story|history · 3.28.0: app 4ad34832 src/ui/research-ui.ts appendQueueSection (counted: queueTitleCount místo summary, když je pole nebo akce záhlaví) · spec 052 · 3.31.0 spec 127: app:f89b5166 src/research-holds.ts heldByText, archiveHeldText, queueHoldText (linie vynechána), src/ui/research-ui.ts queueHoldNote · strings.ts live.heldByTask, archiveHeld, archiveHolderOther, archiveHolderFetch, archiveHolderOwn, archiveHolderSession, archiveHeldWaiting · app:docs/ZADANI_VYZKUM_rezervace.md Odpověď aplikace -->

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
- **In Now:** while the agent does not work and no run goes on, the section **Now** of the **Research overview**,
  in its own window too, also offers **Work on the queue…** with the same mark, dialog and conditions. While the
  agent works, **Now** keeps **Finish and stop** only. Closing the dialog puts the focus back on the button in
  **Now**.
- **The dialog Work on the queue:**
  - **Automatically** (the default): "The agent takes one task after another as long as the subscription limit
    allows." When the research reports that the subscription gate (the condition, [R7.4](R7-when-the-agent-works.md#R7.4))
    is not set, under it stands **Automatic work needs a subscription gate; the terminal offers to set one up.** The
    choice stays;
  - **Only 5 tasks**: a number 1–100, the default 5. The work stops after that many completed tasks; a task that ends
    in waiting, postponing or giving up counts too. Only with a research that can do it; otherwise there is only
    **Automatically**;
  - **First up**: the task set next ([S4.2.2](#S4.2.2)), otherwise the first task of the queue;
  - **More (n)** under the task of **First up** unfolds the queue's next tasks in the research's order: first a task
    set next, then by the place in the queue; postponed tasks and tasks outside the directions that are not taken are
    left out. Above them stand **In queue order** and "The agent may take them in another order." A row is the task's
    number and text with its **next** tag and its kind; with places in the queue the rows are numbered "2.", "3.".
    Under them "and N more tasks in the queue" with **Research overview ›** (unfolds the **Queue**), or "The queue may
    hold more tasks." **Hide more** folds the unfolded list. The count in **Only 5 tasks** does not change the list;
    every opening of the dialog starts folded, and without more tasks there is no button;
  - when the research reports it, the session's length and the gate ("Session up to 3 h · subscription gate: …");
  - **Cancel** and **Open terminal** (the mark AI and terminal) with the sentence **The research terminal confirms the
    start. Ctrl-C in its window or Finish and stop in Now stops the work.**
- **Controls:** app: **Work on the queue…** on the right of the unfolded **Queue** heading in the **Research
  overview**; menu **Research → Work on the queue…** ([S4.5.2](#S4.5.2)). Terminal: `strom run --tasks N`,
  `strom run --loop` ([R7.1](R7-when-the-agent-works.md#R7.1)).
- **Since:** app 3.28.0 (research 1.32.0); in **Now** and **More (n)** from app 3.29.0
- **From app 3.30.0:** after **Open terminal**, **Now** shows **Starting work on the queue…** with “The agent starts
  in the research terminal.”, and both **Work on the queue…** buttons say that it is starting and open nothing again.
  The row goes as soon as the research confirms the link ([S4.5.4](#S4.5.4)) or a session or run starts; the
  session's row then takes its place. Without confirmation within 30 s **Now** asks **Did the queue work not
  start?** (“The terminal did not respond within 30 s.”) with **Try again** and the hint, and the buttons are free
  again.
- **From app 3.31.0 with research 1.36.0:** when directions have runs of their own
  ([R7.10](R7-when-the-agent-works.md#R7.10)):
  - **Work on the queue…** is taken (**● At work ›**) only during a run of the whole queue, not during runs of
    directions;
  - at the full number of runs ([S4.4.12](#S4.4.12)) the button is unavailable with “3 agents are working; the
    settings allow no more.” and **Settings ›**; in the menu **Research** the item is grey with the same explanation;
  - the dialog shows the queue without the tasks of directions with a run of their own, and under the task of
    **First up** “Skips the direction Ancestors of Jan Horák (its own agent works on it).”; when a run is already
    working, also “1 agent is already working. Subscription usage adds up.”

<!-- zdroj: app:9cf43b22, 34accb13 (8a10387e) src/ui/queue-work-dialog.ts queueWorkOffer (live, ne phone/sheet, ne noAgent, linkAvailable work, work.link; busy sessions|runs → 'busy'), queueWorkHead (queue-work-busy → showOverviewNowFinish), queueWorkCounted (run.tasks), queueWorkFirst (own next, pos 1), queueWorkSessionLine, WORK_TASKS_DEFAULT 5, noGate (work.gate === null) · src/research-link.ts WORK_TASKS_MIN/MAX, WORK_LINK_FEATURE, RUN_TASKS_FEATURE · src/ui/research-ui.ts queueHeadAction (jen rozbalená Fronta) · src/ui/research-overview-ui.ts showOverviewNowFinish · strings.ts live.queueWork*, queueWorkingLink · spec 052 K6.1, K6.2, K6.4, K6.6 · ZADANI_DEV_fronta-hledani §5; D6 (řádek sezení i bez brány) · 3.29.0: app:a0a66d45 Teď nabízí Pracovat na frontě… (bez práce agenta a běhu; okno přehledu; fokus zpět) · 3c8f4128 src/ui/queue-work-dialog.ts Další (n) (pořadí: ruční další, místo ve frontě; bez odložených a mimo linie, které se neberou; queue.page; zbytek, Přehled výzkumu ›; sbalené při otevření) · strings.ts live.queueWorkMore, queueWorkLess, queueWorkByQueue, queueWorkByQueueHint, queueWorkRest, queueWorkRestUnknown, queueWorkOverview, queueTagNext · 3.30.0: app:574e7ef9 src/ui/queue-start.ts (QUEUE_START_MS 30 s, důkaz handoff nebo sezení/běh, silent → queueNotStarted, proven bez sezení zmizí potichu) · src/ui/research-overview-ui.ts (live-now-starting, terminalSilent) · strings.ts busy.queueStarting, queueStartingSub, queueNotStarted, terminalSilent -->

<a id="S4.2.4"></a>
### S4.2.4 The queue by task type

With a research that gives the kind of work of its tasks, the **Queue** in the Research overview has a row **Task
type** under the direction chips: a chip for each type that has a task in the queue, with its count (“Verification
12”). The type is set by the research ([R2.2](R2-lines-and-queue.md#R2.2)).

- **Types** in this order: **Verification**, **Registers**, **Census**, **Material**, **Places**, **Beyond the
  registers**, **Requests**, **Stories**, **History**, **Other**.
- **Limits:**
  - the chosen chip narrows the queue to tasks of that type and shows ×; a second click clears the choice (“Show all
    task types”). The chosen type stays in the row even at zero when its last task goes;
  - the filter combines with a direction or branch and with the search in the queue ([S4.2.1](#S4.2.1)): “12 tasks
    found · type Verification”; with no result “Nothing found among tasks of type Verification.” with **Search all
    task types**;
  - the choice holds for the research it was made with, until it is cleared or following ends;
  - with an older research the row is not shown and the queue is as before;
  - **Census** only with a research that offers census records ([R9.12](R9-archives.md#R9.12)); census tasks are then
    not under **Other**. Census tasks set aside ([R9.12.4](R9-archives.md#R9.12.4)) are not in the queue.
- **From the section Verifying:** the row “Waiting to be verified” in What the research knows › **Verifying**
  ([S7.5](S7-reliability-and-verification.md#S7.5)) has **Show in the queue**. It opens the **Queue** in the Research
  overview narrowed to **Verification**. It stays in the app and has no mark.
- **Controls:** app: **Research overview** → **Queue** → the row **Task type**; What the research knows ›
  **Verifying** → **Show in the queue**. Terminal: `strom task list --kind verify` ([R2.2](R2-lines-and-queue.md#R2.2)).
- **Since:** app 3.31.0, research 1.36.0

<!-- zdroj: dirigent:spec/065-spolehlivost-a-znovu-overeni K7.4 · app:53ef9cbe src/ui/queue-kind-ui.ts (queueKindChips: jen druhy s úkolem v pevném pořadí, vybraný i s 0; queueKindRow aria-pressed, ×, taskKindClear; volba pro bridge.base) · src/research-link.ts QUEUE_KIND_FEATURE queue.kind, QUEUE_TASK_KINDS · src/research-queue-pages.ts (kind= s linií, větví a q) · src/ui/research-ui.ts queueSearchInKind, queueSearchNoneKind, queueSearchAllKinds · src/ui/verify-person-ui.ts verifyRowsHtml (pendingQueue, bez značky), showOverviewQueueKind('verify') · strings.ts live.taskKinds, taskKindLabel, taskKindClear, queueSearchFound, verify.pendingQueue · research:7116bb60 src/core/taskkind.ts, GET /queue?kind=, queueCounts.kind · CHANGELOG.cs.md 3.31.0 · sčítání: app:6edc7dc7 src/research-link.ts QUEUE_TASK_KINDS (census za records), CENSUS_FEATURE · src/research-queue-pages.ts queuePageQuery (kind=census jen s funkcí census, other + known=census) · strings.ts live.taskKinds.census · research:c7b117cd src/core/taskkind.ts (census, KINDS_065, kindMatches known) -->

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
- **From app 3.31.0 with research 1.36.0:** each direction can be given an agent of its own, **Put an agent on this
  direction** ([S4.3.3](#S4.3.3)). The row of a direction with a run of its own says “Agent at work: Claude” with the
  link **In Now ›**, which unfolds **Now** and highlights the run's block ([S4.1.8](#S4.1.8)). The conversation
  **Work on this direction** has the hint “A conversation with the agent about the direction in the terminal”.

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
- **From app 3.31.0 with research 1.36.0:** a new direction inside a wider direction
  ([R2.1.5](R2-lines-and-queue.md#R2.1.5)): the form **New direction** says “The new direction lies inside the
  direction Ancestors of Jan Horák. The people in it stay in the wider direction too.” and offers the ticked “Move 7
  open tasks here from the direction Ancestors of Jan Horák (about the people of this direction)” (with more wider
  directions “from the wider directions”). After creating it with the move, a bubble stays for 10 s: “Direction
  created. 7 tasks moved.” with **Undo the move** and **Work on this direction**. **Undo the move** (**Undoing…**)
  undoes only the move, the direction stays: “Move undone · 7 tasks back in the wider direction”; when the tasks have
  changed meanwhile, **Nothing to undo.** Without a move (the box unticked, nothing to move, an older research) the
  bubble is as before; on a phone without **Work on this direction**.

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
  - The research's choice beside the heading **Outside the directions** (e.g. "at the end") opens **Research for
    this tree…** at the group **Work outside the directions** with the chosen card, also without following and from
    the overview's own window (the dialog opens in the main window). For the Strom archive and for a research that
    waits for its agent the group is not there and the choice is plain text. A branch's tag is no link: it unfolds
    the branch, as its whole head does.
- **Controls:** app: **Research overview**, the section of work outside the directions, at a branch **⋯** (**Branch
  options**); **Research for this tree…**.
- **Since:** app 3.22.0 (research 1.26.0); the choice beside **Outside the directions** without following and from
  the overview's window from app 3.29.0

<!-- zdroj: app:HEAD src/ui/research-offline-ui.ts:3, :104 (caps.offLineBranches, ≥2 linie) · src/research-directions-write.ts setBranchMode, setOffLineTree, answerBranchWaiting · strings.ts live.offModeLink, live.offModeCap, live.branchAddPick, live.branchCreate, live.branchNever, live.branchReset · research-offline-ui.ts:202-228 growingBranchLine, :542 branch choices, :680 branchQueueBeyond, :740 pick · strings.ts live.dirNear, branchGrows, branchOwnChoice, branchQueueHead, branchQueuePos, branchAllTasks, branchTaken, branchDefaultTag, branchAdd(Paused), branchNeverGroup, waitBranchLeave, waitBranchHint, setOutTitle, setOutOcc, setSuggest, setOwnChoice, setManualTasks, menu treeSettings · spec 038 K7 · 3.27.0: strings.ts live.setOutIntro (app 4e4f6d8c, spec 036 K1.8) · 3.29.0: app:70d50162 research-offline-ui.ts openOffLineSettings bez sledování (prohlížený strom), overview-window offline-settings → hlavní okno · 0a00fb2b research-tree-settings-ui.ts offLineSettingsOffered (archiv, čeká na agenta: text, ne odkaz) -->

<a id="S4.3.3"></a>
### S4.3.3 Put an agent on this direction

At each active direction a run of its own can be asked for: an agent that takes only the tasks of that direction
([R7.10](R7-when-the-agent-works.md#R7.10)). The app starts nothing: it opens the research terminal in a new window,
and that starts the run ([R7.10.4](R7-when-the-agent-works.md#R7.10.4)). The agent's work uses the AI subscription.

- **Where:** the direction detail, the button **Put an agent on this direction** (the mark AI and terminal) with the
  sentence “The agent takes this direction's tasks by itself (7 in the queue), in a new terminal window.”; the menu
  **⋯** at the direction, the item before **Work on this direction** (hint “The agent takes the direction's tasks by
  itself”).
- **A direction with a run:** in the detail, in place of the button, “● Agent at work · Claude · since 10:42” and
  **In Now ›**; in the menu the item is not there. A second run of the same direction is not possible.
- **When it is not possible:** the button and the item stay, unavailable, with the reason:
  - “The direction is paused.” (**Restart** stays beside it);
  - “Nothing in the direction's queue.”;
  - “3 agents are working; the settings allow no more.” with **Settings ›** ([S4.4.12](#S4.4.12));
  - “This computer has no agent installed that the research can start.”;
  - “An agent started by an older version of the research is working on the tree; a direction's agent cannot start
    beside it. It can once that one ends.”;
  - otherwise “An agent cannot be put on this direction now.”
  At an ended direction the action is not there.
- **The dialog Put an agent on the direction:** in the heading the direction's mark, name and number.
  - **Agent** (only when the research knows two or more agents): the choice of the agent, the default one with
    “(default)”, under it “The choice is kept for this direction.” Preselected is the agent the direction last ran
    with, otherwise the research's default agent;
  - **Automatically** (“The agent takes one task of this direction after another as long as the subscription limit
    allows.”) or **Only 5 tasks**, **First up** and **More (n)** as in [S4.2.3](#S4.2.3), only from the direction's
    queue; under them “and 12 more of the direction's tasks in the queue”;
  - when a run is already working: “1 agent is already working. Subscription usage adds up.” This blocks nothing;
  - **Cancel** and **Start** (the mark AI and terminal) with the sentence “The agent starts in a new terminal window.
    Ctrl-C in its window or Finish and stop in Now stops the work.” When the direction becomes blocked meanwhile,
    **Start** is unavailable with the reason.
- **After Start:** **Now** shows at once “Starting… · Ancestors of Jan Horák (G0002)” with “The agent starts in a new
  research terminal window.”; without a response within 30 s “Did the direction's run not start? · Ancestors of Jan Horák” with **Try again**
  as in [S4.2.3](#S4.2.3).
- **Limits:** only with a research that can do runs of lines, with a bridge that answers, and with an agent; not in a
  Strom archive, not in a research waiting for an agent, and not on a phone (there runs are only shown,
  [S4.1.8](#S4.1.8)).
- **Controls:** app: **Research overview → Directions**, the direction detail or **⋯**. Terminal: `strom run
  --research G…`, the menu **Let the agent work on its own** ([R7.10](R7-when-the-agent-works.md#R7.10)).
- **Since:** app 3.31.0 (research 1.36.0)

<!-- zdroj: app:4de0835a src/ui/research-directions-ui.ts (managedDirectionDetail blok běhu, openManagedDirectionMenu položka před dirWork, managedDirectionMeta lineRunWorkingMeta + lineRunInNow, lineRunWhy) · src/research-runs.ts lineRunBlock (ended, running, canStart/why z mostu, paused > empty > limit), atRunLimit · src/ui/queue-work-dialog.ts showLineRunDialog, syncLineRunDialog (lineRunKicker, lineRunAgent, lineRunAgentDefault, lineRunAgentKept, lineRunAutoHint, lineRunRest, runsAddUp, lineRunStart, lineRunConfirm) · beginRunWork (work?research=G&agent=), lineRunStarting, lineRunStartingSub, lineRunNotStarted · strings.ts live.lineRun*, runsLimitReached, runsSettingsLink, dirWorkHint · app:docs/ZADANI_DEV_beh-po-liniich.md §1, §2, Kolo 2 B · dirigent:spec/126 K2.1, K2.2, K2.4, K2.7, K2.8 · research: researches[].run/canStart/why/agent, agents[] -->

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
- **From app 3.30.0:** in the **Research overview** the section can be sorted from the newest or the oldest items
  ([S4.4.3](#S4.4.3)).
- **From app 3.30.0 with research 1.35.0:** the items can be grouped by book, with the order **Most tasks** and the
  subsection **Faster by downloading** ([S4.4.4](#S4.4.4), [S4.4.5](#S4.4.5)); the books' settings in **Research for
  this tree** ([S4.4.6](#S4.4.6)).
- **From app 3.30.0:** the groups and the opened item (also with a research without books):
  - each group (a place, an archive, an office, a book) stands in its own band with its whole name, under it the
    group's details and actions (at an archive those of **Archive website ↗**, **Chat**, **Sent** and **All queries'
    text** that the research offers). The name wraps to at most 3 lines (on a phone, in the small panel and in a
    narrow column of the overview window to 4); a longer one ends with "…" and the link **more**, which unfolds the
    name and does not collapse the group (**less** shortens it again). The group's items hang under the band on a
    vertical line. A list without groups and the subheading **No book** have no line;
  - the opened item shows its text whole and only once, in its row. The body begins with the block **Waiting on**
    with the whole description of the manual step as the research wrote it (addresses in the text are links). A text
    longer than 10 lines (on a phone sideways 3) ends with "…" and **more** / **less**. The second line of the block,
    **To**, says whom the request goes to. An item that waits only for a person has no block. Under the block the
    state of the images, person · direction and the actions;
  - the text "waiting on" has up to 1500 characters (before, the app cut it to 120). The small panel shows it in the
    row on 2 lines, whole on hover;
  - an item of a site has in the opened body **Open website ↗** and next to it the site's address (not on a phone);
  - an item waiting for images begins with the block **Deliver** with steps ([S4.4.7](#S4.4.7)).
- **From app 3.30.0 with research 1.35.0:** a task whose wait for images is not written the way strom needs it has
  a mark and, in the open item, a fix in one step ([S4.4.8](#S4.4.8), [S4.4.9](#S4.4.9)).
- **From app 3.32.0 with research 1.37.0:** an item that can be returned to the agent has the line **Now** and the
  button **Retry with the agent**, an archive's band **Retry all with the agent** ([S4.4.14](#S4.4.14)).

<!-- zdroj: app:7d7c0783 src/ui/research-overview-ui.ts overviewWaitingGroupHead, overviewWaitingBookHead (pás .research-overview__waiting-grouphead, akce skupiny v pásu, ul.is-grouped; bez skupin a Bez knihy bez linky), src/ui/waiting-order-ui.ts groupTitleMoreEl (strop GROUP_TITLE_LINES 3, telefon, panel a úzký sloupec 4; víc/méně stav title:<skupina>, stopPropagation), src/ui/research-ui.ts (panel: pás, víc, is-grouped), appendWaitingWebHost, strings.ts live.titleMore, titleLess, waitingWebHostAria · app:1176f465 overviewWaitingRow (text celý v řádku, detail ho neopakuje), overviewWaitingOnBox (waitsOnUser → bez bloku; appendLinkedText; waitingOnMoreEl 10 / na šířku 3 řádky; waitingToLabel Adresát), strings.ts live.waitingOnLabel, waitingToLabel · app:96b35bbd src/research-link.ts sanitizeWaiting MAX_WAITING_ON 1500, panel .live-waiting-on 2 řádky + title · CHANGELOG.cs.md 3.30.0 · dirigent:prace/1117-app-knihy-zahlavi, 1117-app-cekana-cely-text · app:docs/ZADANI_DEV_knihy-zahlavi.md §1–§3 -->

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
- **From app 3.30.0:** the agent at a person and the marks show together:
  - the turning arc around the portrait of the person the agent works on also shows beside one or more marks; the
    marks stay in the corner. A card without a portrait has a ring around the mark's dot instead of the arc;
  - a screen reader hears both, what waits and “research is working on this person”;
  - the menu of a person with a mark also offers **Follow the research ›**;
  - the tick after the agent's work ends shows only on a card without a mark;
  - the card preview in **Settings → Person card** shows the arc and the mark together.

<!-- zdroj: app:16461aca, 85c1f704, abf7620f src/card-signals.ts ACTION_ORDER (waiting, conflict, question), presentActions (zapnuté v Na kartě ukázat), stackChoices (waiting, story, knows, agent), ACTION_GLYPH · src/card-signal-marks.ts cardActionMarksHtml (stoh n2/n3, tečky), stackAriaLabel, stackTipHtml (tipClickChoose / tipClickKnows), stackMenuItemsHtml (menuAnswer / dotyk menuWaiting, story.compare, menuKnows, menuAgent; bez značky výzkumu), placeStackMenu · index.html .card-signal-stack, #tree-canvas.zoom-far (src/zoom.ts ZOOM_FAR = 0.55; index.html:13732-13741 jedna tečka u všech Detailů karet, e2e/card-signals.spec.ts:353), body.view-mode-print bez značek, compact dvě tečky · strings.ts card.stackLabel, stackWaiting, stackMenuLabel, tipClickChoose, cardDensity.cardWaiting, cardConflict, cardQuestion, compact · CHANGELOG.cs.md 3.27.0 „Více značek na kartě“ · dirigent:prace/1111-app-karta-vice-znacek · 3.30.0: app:16cba085 src/card-signals.ts showAgent i se značkou, doneSince jen bez značky · src/renderer.ts (oblouk vedle značky, kompaktní kroužek kolem tečky, aria-label obojí) · src/ui/card-fields-ui.ts náhled · src/ui/card-signals-ui.ts signal-agent (card.menuAgent) · strings.ts card.ariaAgent, card.menuAgent · CHANGELOG.cs.md 3.30.0 „Agent při práci i vedle odznaku“ · spec 109 -->

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

<a id="S4.4.3"></a>
### S4.4.3 The order of Awaiting action

The section **Awaiting action** in the **Research overview** can also be sorted by since when an item has been
waiting. A newly added item is then at the top and does not get lost among places and groups.

- **Order:**
  - **Recommended** (default): the research's order by phases, places and directions as before;
  - **Newest first** and **Oldest first**: by the time since when the item has been waiting, as the research sent
    it. Sorting is within each phase (**To do** and **Awaiting a reply**). The same time keeps the research's order,
    items without a time are at the end in both directions.
- **Groups** (a switch next to the order, only with an order by time and with a research with groups by places):
  - on: sorting is within the groups and each place stands where its newest (or oldest) item stands; also **Other**
    and **Places**, which in **Recommended** stand at the end. A place's heading shows the time of its first item;
  - off: each phase is one list and each row has a tag of its place (the whole name in the hover text).
- **The time at a row** (only in an order by time): within an hour relative ("25 min. ago"), today the hour
  ("08:30 AM"), "yesterday", this year the day ("11/4"), earlier the day and the year ("10/6/2025"). The time
  refreshes by itself.
- **The tag "new"** (in every order): items to do that have not yet been seen on this device in the expanded section
  **Awaiting action** (the same record as **N new**, [S4.1.2](#S4.1.2)). The tag stays until the overview closes;
  a collapsed place says "new: 2". A tree nobody has looked at on this device yet has nothing new.
- **Limits:**
  - the choice of order is there from two items in the section;
  - the order and the switch **Groups** are remembered on this device for all trees (at first **Recommended**,
    **Groups** on); another window of the same device, also the overview window ([S4.1.6](#S4.1.6)), adapts;
  - the order holds also with a search ([S4.4.2](#S4.4.2)) and the kind chips. With groups off, the head and the
    foot of the hypotheses' selection concern the hypotheses of the whole phase;
  - it holds in the overview (as a side panel and over the tree), in the overview window and on a phone. The small
    panel is unchanged (except with a research with books, [S4.4.4](#S4.4.4)).
- **With a research that knows books** (research 1.35.0): the switch **Groups** is a choice **Archive** | **Book** |
  **No groups**, and the order has a fourth option **Most tasks** ([S4.4.4](#S4.4.4)).
- **From app 3.32.0 with research 1.37.0:** the order **Most helpful**: by how much dealing with an item gives the
  research. For each item with tasks behind it, the research sends a score and a reason
  ([R6.4.1](R6-awaiting-action.md#R6.4.1)):
  - the highest score at the top; the same score keeps the research's order, items without a score (stories,
    conflicts, places…) are at the end;
  - groups as in an order by time: each place stands where its most helpful item stands; groups off give one list;
  - the research's reason stands quietly under the row, only in this order ("a new generation: the parents of Jan
    Horák · the direct line · unblocks 3 tasks"); in the overview, in the overview window, on a phone and in the
    small panel with books. A long word without spaces wraps in the row;
  - the choice is remembered like the other orders. An older research sends no score and does not have the choice;
    a remembered **Most helpful** shows there as **Recommended**, and the choice stays remembered.
- **Controls:** app: **Research overview → Awaiting action**, the button "⇅ Recommended ▾" after the kind chips (in
  the overview window in the section's sticky head) with the menu **Recommended** · **Newest first** · **Oldest
  first**, on a phone the sheet **Order**; the switch **Groups**.
- **Since:** app 3.30.0

<!-- zdroj: app:f3bb5631 src/research-waiting.ts WaitingOrder, WAITING_ORDERS, waitingSince (at), sortWaitingByTime (stejný čas v pořadí výzkumu, bez času na konci), phaseRows (recommended = groupWaiting; skupiny podle první položky, Ostatní a Místa také; bez skupin FLAT_GROUP), waitingPhases (todo i sent) · src/live-time.ts formatWaitingSince (do hodiny relativně, dnes čas, včera, den, den s rokem) · src/ui/waiting-order-ui.ts WAITING_ORDER_KEY strom-live-overview-waiting-order, WAITING_GROUPS_KEY, storedWaitingOrder, watchWaitingOrderStorage (storage event), noteWaitingNew (todoWaiting, waitingSeen; strom bez záznamu nic nového), waitingSideEl, waitingGroupTagEl, ORDER_ICON · src/ui/research-overview-ui.ts overviewWaitingOrderEl (total >= 2; přepínač role switch jen v časovém pořadí a se skupinami; list na telefonu isPhoneBar / sheet) · src/ui/overview-columns-ui.ts (lepkavá hlava v okně) · src/ui/hypothesis-waiting-ui.ts (hlava a pata za fázi) · src/ui/live-section-prefs.ts waitingSeen, noteWaitingSeen · strings.ts live.waitingOrder, waitingOrderRec, waitingOrderNew, waitingOrderOld, waitingGroups, waitingNewTag, waitingNewCount, waitingSinceYesterday, waitingOtherGroup, places.waiting.group · e2e/overview-waiting-order.spec.ts · CHANGELOG.cs.md 3.30.0 „Pořadí v Čeká na vyřízení“ · spec 083 K5.1–K5.4, rozhodnutí H1–H5 · dirigent:test/vysledek-1116-app-103-odkazy-083-razeni.md · 3.32.0: app:5979d5c4 src/research-waiting.ts (gain: nejvyšší skóre, stejné v pořadí výzkumu, bez gain na konci; skupiny jako časové pořadí), src/research-link.ts (waiting[].gain jen s waiting.gain), src/ui/waiting-order-ui.ts, src/ui/research-overview-ui.ts (důvod pod řádkem jen v pořadí gain), f4050b1c (zalomení dlouhého slova) · strings.ts live.waitingOrderGain · research:44d3f750 src/core/waitgain.ts · dirigent:spec/105 K4.1 -->

<a id="S4.4.4"></a>
### S4.4.4 Awaiting action by book

With a research that knows books ([R6.8](R6-awaiting-action.md#R6.8)), the items of **Awaiting action** can be grouped
by the book they need. At a book it shows how many tasks wait for it, what can be downloaded from it and where to save
the images.

- **Groups** (a choice next to the order):
  - **Archive**: groups as before (places, archives, **Other**, [S4.4.3](#S4.4.3));
  - **Book**: in each phase the groups of books first, then the other items in groups of archives under the
    subheading **No book** (only when there is some book). The book of an item is the book the item waits for,
    otherwise the only book the task works in;
  - **No groups**: one list (only with an order by time, like **Groups** off).

  In the **Recommended** order the choice is **Archive** | **Book**; the groups of books stand by their first item, in
  an order by time by the time of their first item.
- **The order Most tasks:** the groups are always books (the choice of groups disappears).
  - at the top the books to download (they lack images, or the number of images is not known), below them the books
    whole on disk. In each part the books go from the one most tasks need, on a tie more waiting, then the book's
    number. **Faster by downloading** is sorted the same way ([S4.4.5](#S4.4.5));
  - when a phase has both parts, the subheadings "To download · 2 books" and "Whole on disk · 1 book" stand above them
    (the counts in the phase). With a single part there is no subheading;
  - under the order stands the sentence "Books missing images come first: downloading them settles the most tasks at
    once. Books whole on disk follow." In the order menu **Most tasks** has the second line "books to download first";
  - within a book the items are in the **Recommended** order. Items without a book are at the end in groups of
    archives.
- **The book's band** (like the band of every group, [S4.4](#S4.4)):
  - the book's title (with the years) whole, wrapped, at most on 3 lines (4 on a phone) and **more**. On the right the
    tag **Book**, **new: N** at a collapsed book and the number of items. On hover the title, the archive and how many
    tasks need the book (of these parked);
  - the second line: the archive, whole;
  - the third line: "12 tasks" (how many tasks need the book) · "3 waiting" · "+M in the queue" (the book's tasks
    that do not wait) · "2 parked" · images ("240 images · on disk 12 · missing 228", a book whole on disk "240 images
    · whole book on disk") · "N files to be taken in" (files that lie in the book's folder and have not been taken in
    yet) · "archive website requires sign-in". "In the queue" and "parked" only above zero. In the order **Most
    tasks** the number of tasks and "missing N" are in bold;
  - actions under the details: what can be downloaded by the archive's terms
    ([R6.8.1](R6-awaiting-action.md#R6.8.1)) – "Whole book can be downloaded · N images", "Images 31–36 can be
    downloaded · 6 images" or "Selected images … can be downloaded"; **Archive website ↗**; **Open the book’s
    folder** (the book's folder in the shared folder, the research opens it without a terminal and creates it if
    needed, [R6.8.2](R6-awaiting-action.md#R6.8.2)); **Chat** (not on a phone). A click on an action does not
    collapse the book;
  - a book the research did not send in the overview of books: only the title (or the book's number), the tag and the
    count.
- **Search** ([S4.4.2](#S4.4.2)) also finds items by the title and archive of their book.
- **Small panel:** the order button and "Groups: Book ▾" with a menu; the book's band only with the title (at most 4
  lines and **more**) and "N waiting", the items on the line, the subheading **No book**; the books' actions are only
  in the **Research overview**. The numbers of items are the same as before.
- **Limits:**
  - the choice **Book** and the order **Most tasks** are there only with a research that sends books, and not in a
    Strom archive or a research waiting for an agent. Otherwise everything looks as before, and a saved choice
    **Book** or **Most tasks** shows as **Archive** and **Recommended** without being overwritten;
  - the choice of groups is remembered on this device with the order ([S4.4.3](#S4.4.3)).
- **Controls:** app: **Research overview → Awaiting action**, next to the order button the switch **Groups**
  (**Archive** | **Book** | **No groups**); on a phone (also sideways) and in the small panel the button "Groups: Book
  ▾" with a menu (on a phone a sheet). The order "⇅ … ▾" › **Most tasks**.
- **The item's book** is set by the research: a waiting task belongs under the book that has to be searched
  ([R6.8.4](R6-awaiting-action.md#R6.8.4)).
- **Since:** research 1.35.0, app 3.30.0

<!-- zdroj: app:7d7c0783 src/research-books.ts bookMetaParts (tasks · waiting · inQueue >0 · parked >0 · obrázky · pending · login), bookHeadImagesPieces (missing 0 → wholeOnDisk), research-overview-ui.ts overviewWaitingBookHead (archiv na vlastním řádku, akce v pásu, books.folderBook), research-ui.ts appendPanelWaitingBooks (název 4 řádky + víc, is-grouped) · app:1176f465 src/research-books.ts sortBooksMost (bookWholeOnDisk napřed false, pak tasks ↓, waiting ↓, číslo), research-waiting.ts phaseRows (part download / disk jen při obou částech, počty ve fázi), research-overview-ui.ts :1200 order-note books.mostNote, :1236 books.toDownload / onDiskAll, is-key (tasks, missing), table-headmenu.ts sub books.orderMostSub · strings.ts live.books.tasks, parked, wholeOnDisk, folderBook, toDownload, onDiskAll, mostNote, orderMostSub · research:8d19d4f6 src/core/books.ts bookOfTask (waitTarget) · ZADANI_DEV_knihy-zahlavi.md §1, §2, §4 -->
<!-- zdroj: app:224a1358, 7c39e663 src/ui/waiting-order-ui.ts shownWaitingGroups (most → book; book bez knih → archive; none v doporučeném → archive), waitingGroupModesFor, storedWaitingGroupMode (klíč přepínače Skupiny) · src/research-waiting.ts phaseRows (by book, afterBooks, most: sortBooksMost, uvnitř doporučené) · src/research-books.ts booksOn, bookOfItem, bookMetaParts, bookImagesText, bookOfferText (whole/range/selected), bookHeadTitle, bookWebUrl, sortBooksMost · src/ui/research-overview-ui.ts overviewWaitingBookHead (štítek Kniha, nové, počet, meta, is-key u most), overviewWaitingBookActions (nabídka, Web archivu, Otevřít složku book?do=folder, Chat), waitingGroupsChoiceEl (segment, compact/sheet) · src/ui/research-ui.ts appendPanelWaitingBooks (malý panel: název, N čeká, Bez knihy, akce jen v přehledu) · research:b1749433 src/core/live.ts /status books (feature books; ne archiv ani čekání na agenta), bookOfTask · strings.ts live.books · dirigent:spec/105-co-nejvic-pomuze U5, K5.1 · app:docs/ZADANI_DEV_knihy-ukolu.md §1–§2 -->

<a id="S4.4.5"></a>
### S4.4.5 Faster by downloading

Books that enough tasks need and that nothing waits for are offered by the app for download separately. Images saved
to the book's folder are read by the agent from disk, faster and cheaper. Nothing waits for them, and so they are not
counted among the items.

- **What is there:** books the research offers ([R6.8](R6-awaiting-action.md#R6.8): at least `books.minTasks` tasks,
  something can be downloaded) and that no task waits for. A book something waits for is in the list as a group
  ([S4.4.4](#S4.4.4)). The order as **Most tasks**.
- **The subsection** **Faster by downloading · N books** stands at the bottom under **Awaiting a reply**, collapsed
  at first:
  - the sentence "Images saved to the book’s folder are read by the agent from disk – faster and cheaper. Nothing
    waits for them." and the link **Settings…** (opens **Research for this tree** at the group **Books**,
    [S4.4.6](#S4.4.6));
  - a book's row: the title; the archive · "N tasks in the queue" · images · "N files to be taken in" · sign-in; what
    can be downloaded · **Archive website ↗** · **Open folder**. A click on the title unfolds the details: **Tasks**
    (of these parked), **Folder**, **Access**;
  - books beyond the list only as a count: "and N more books are in the research" (the whole list in the terminal,
    `strom task books`).
- **Limits:**
  - only with the kind chip **All** and **Images**; with a search only books whose title or archive matches;
  - an empty subsection is not shown. It shows also when nothing waits (under the empty section);
  - it does not count into the section's number, the summary, "Waiting N" or the small panel.
- **Small panel:** under the list the line "Faster by downloading · N books ⤢", which opens the **Research overview**
  with the subsection unfolded.
- **Controls:** app: **Research overview → Awaiting action → Faster by downloading**. Terminal: `strom task books`
  ([R6.8](R6-awaiting-action.md#R6.8)).
- **Since:** research 1.35.0, app 3.30.0

<!-- zdroj: app:bc8fc5fd src/research-books.ts urgentBooks (offer && waiting === 0, sortBooksMost), urgentBooksShown (filtr all/images, hledání název a archiv) · src/ui/research-overview-ui.ts appendOverviewBooksOffer (sectionPartOpen urgent, výchozí zavřený; urgentText, Nastavení… → openBooksSettings; more), overviewUrgentBookRow (detail Úkoly, Složka, Přístup) · src/ui/research-ui.ts renderLivePanel panelUrgent (showOverviewBooksOffer) · strings.ts live.books.urgent* · research:b1749433 src/core/live.ts booksStatus (offer, more) · ZADANI_DEV_knihy-ukolu.md §3, §5 -->

<a id="S4.4.6"></a>
### S4.4.6 Research for this tree › Books

The research's books settings ([R6.8.3](R6-awaiting-action.md#R6.8.3)) can be changed in the app too. They are written
through the bridge into the research, so they hold just as in the terminal.

- **The group Books** (after **Reading documents**, collapsed with the summary "from 5 tasks · no preference"):
  - **Book offered from this many tasks**: a whole number from 1 to 999. It is saved on leaving the field or with
    Enter. Another value shows "A whole number from 1 to 999." and nothing is sent; an empty field returns the saved
    value. The default value has "(default)", the link **Restore default (5)** returns it;
  - **Downloaded book first** (a switch): after a task of a book that is on disk the queue takes the next task of the
    same book, at most 5 sessions in a row ([R2.2.4](R2-lines-and-queue.md#R2.2.4)).
- **Writing:** right after a change "Saving to the research…", then "The research confirmed. Also applies to changes
  in the terminal." A busy research: "The research is busy right now; nothing changed." and **Try again**. Without
  the bridge the group is dimmed. A change from the terminal redraws the dialog, but not the field being typed into.
- **Limits:** only with a research that sends books; not in a Strom archive or a research waiting for an agent. When
  the research meanwhile switches to a Strom archive, the group disappears.
- **Controls:** app: **Research → Other actions → Research for this tree… → Books**, or **Settings…** in **Faster by
  downloading** ([S4.4.5](#S4.4.5)). Terminal: [R6.8.3](R6-awaiting-action.md#R6.8.3).
- **Since:** research 1.35.0, app 3.30.0

<!-- zdroj: app:224a1358 src/ui/books-setting-view.ts (pole, (výchozí), Vrátit výchozí, přepínač) · src/ui/research-tree-settings-ui.ts showResearchTreeSettings group books, booksBody, překreslení mimo fokus · src/research-link.ts booksSettings, POST books (400 books.body, 409 directions.archive → skupina zmizí, 503 research.busy) · strings.ts researchTree.booksGroup, booksSum, minTasks*, sameBook*, resetDefault, booksOk, booksBusyErr, booksRetry · research:b1749433 src/core/live.ts POST /books · ZADANI_DEV_knihy-ukolu.md §4 -->

<a id="S4.4.7"></a>
### S4.4.7 An item waiting for images

An opened item that waits for images first says what to deliver and where, and then shows the steps in the order in
which they are done. The result is files in a folder, not an answer.

- **Which items it concerns:** a task waiting for images (kind **Images**) and a task waiting for a site that the
  research gave a book's folder ([R6.8.4](R6-awaiting-action.md#R6.8.4)); only when images can be added through the
  bridge. The other items are unchanged.
- **The block Deliver** (at the start of the body, before **Waiting on**, [S4.4](#S4.4)): a sentence saying which
  images as files and into which folder, for example "Images 112–113 as files (JPG or PNG) in the folder of the book
  …" with the book's title:
  - the numbers are those still missing; without known numbers the sentence has no numbers ("Images as files (JPG or
    PNG) in the folder of the book …");
  - the book's folder when the research has it in the list of books with a folder and the link into the research can
    open it; otherwise "… in the task’s folder". The sentence always names the folder that step ② opens.
- **Steps** (computer and tablet), with arrows between them:
  1. **Archive website ↗**: the item's website, otherwise the website of the book or of its archive;
  2. **Open the book’s folder** (the research opens it without a terminal, [R6.8.2](R6-awaiting-action.md#R6.8.2)),
     otherwise **Open folder** of the task (opens the research in the terminal, with the terminal mark);
  3. **Add images**: the only main action, opens the place for uploading images.

  A step that cannot be done from here is missing and the next one takes its number. An arrow never wraps away from
  the step it leads to. Below 380 px of width the steps are one under another without arrows. While images are being
  added and an answer written, the steps hide.
- **Under the block:** the state of the images, the place for dropping files, person · direction and the link
  **Images can’t be obtained…**. It opens the field **Why the images can’t be obtained** with the hint "This is for
  why the images can’t be supplied or what the archive lacks. A reading of the entry does not belong here: the
  research reads the images." Sending returns the task to the queue like every answer
  ([R6.7](R6-awaiting-action.md#R6.7)). The other actions (**Discuss with the agent** and others the research offers)
  are under **⋯**.
- **Phone:** only the block **Deliver** with the sentence and "Images are saved on the computer.", without steps.
  **Images can’t be obtained…** opens the answer sheet with the same heading and hint.
- **Small panel:** the window **Add images** begins with the same block, with the steps one under another; the place
  for uploading under it is the last step.
- **Controls:** app: **Research overview → Awaiting action**, a click on an item with images; in the small panel
  **Add images**.
- **Since:** app 3.30.0
- **From app 3.32.0 with research 1.37.0:** with a task that can be returned to the agent, the line **Now** and
  **Retry with the agent** stand under the block; as the main action it makes the step **Add images** outlined
  ([S4.4.14](#S4.4.14)).

<!-- zdroj: app:449e6962, 429839f0 src/ui/waiting-task-ui.ts waitingTakesImages (waitingActions images přes most), waitingAnswerTexts (answerImagesLabel, answerImagesHint), waitingDeliverEl (věta deliverSentence, phone → deliverPhone bez kroků, kroky deliverSteps web → folder → images, krok ② books.folderBook přes odkaz book jen s book.folder, jinak openFolder task?do=folder se značkou, ③ haveImages waiting-action--primary → openWaitingImages, deliver-pair šipka s krokem, is-column), panel dialog (column, upload: true, title haveImages) · src/research-waiting.ts waitingForImages (images, web s inbox), waitingDeliver (chybějící čísla jen u detail full; kniha jen ze seznamu se složkou), deliverSentence, deliverWebUrl (w.url, jinak bookWebUrl), deliverSteps · src/ui/research-overview-ui.ts appendWaitingTaskActions deliver (answer → link-button cannotGet, ostatní pod ⋯, na telefonu nic pod ⋯) · strings.ts live.waitingTask.deliverLabel, deliverBook, deliverTask, deliverBookAny, deliverTaskAny, deliverPhone, stepAria, cannotGet, answerImagesLabel, answerImagesHint · e2e/waiting-images.spec.ts, overview-waiting-books.spec.ts · ZADANI_DEV_knihy-zahlavi.md §5 · dirigent:prace/1117-app-knihy-zahlavi (D12, D13) -->

<a id="S4.4.8"></a>
### S4.4.8 A task not recorded as needed

For waiting tasks the research checks whether the wait for images is written the way strom needs it: images of one
book of the research, one book per task ([R6.9](R6-awaiting-action.md#R6.9)). When it is not, saved images do not
bring the task back to the queue. At such an item the app shows the finding and offers a fix in one step. The item
keeps waiting, the counts do not change.

- **Mark:** the item's row has a warning triangle with an exclamation mark before its title (bubble and screen reader
  **Task not recorded as needed**). The small panel has only the mark (**Task not recorded as needed – opens in the
  overview**).
- **Block in the open item** (**Research overview**, in its own window too): under the waiting text and the state of
  the images, above the item's actions, the heading **Task not recorded as needed** and a sentence saying what is
  wrong:

  | Research finding | Sentence |
  |---|---|
  | images only in text | **Images are only described in text, with no book – saved images do not bring the task back.** |
  | several books in one wait | **Waits for images from several books**, with an unknown book **; the research does not know one of them.** |
  | a book the research does not know | **The research does not know the book – the task has no folder for images.** |
  | the folder is missing | **The folder for images is missing – the fix creates it.** |

  When the research offers no fix and has an agent, the sentence ends **The agent adds the book to the research.**
  A finding the app does not know has the heading only.
- **Block actions:**
  - **Fix**, only when the research offers a whole or partial fix: shows the preview of the fix ([S4.4.9](#S4.4.9));
  - **Discuss with the agent** (the mark AI and terminal, [S4.5.1](#S4.5.1)) opens a conversation about the task: the
    agent gets the finding and proposes a fix. Only with a research that has an agent, not on a phone. At an item
    with a finding this action is not under **⋯**;
  - **Leave as is** writes at once, without a preview, that the wait is right as it is. The finding goes and the
    notice **The finding is no longer offered** has **Undo** for 8 s. The research offers the finding again when the
    task's wait changes.
- **Limits:**
  - research not available (following has ended or the bridge does not answer): **Fix** and **Leave as is** do not
    work and under them stands **The research is not available – the fix cannot be written now.**;
  - a finding that has gone meanwhile: the notice **The finding no longer applies – the task is recorded
    correctly.**;
  - a click just after the rows move (another finding was fixed or went) does nothing, so that another item is not
    hit;
  - a research without the check: the items are as before, without the mark and the block.
- **Controls:** app: **Research overview → Awaiting action**, a click on an item with the mark. Terminal:
  `strom task audit` ([R6.9](R6-awaiting-action.md#R6.9)).
- **Since:** app 3.30.0, research 1.35.0

<!-- zdroj: app:929d7813, ed7f7a04, 287ebc72, 01a1e760 src/research-audit.ts TASKS_AUDIT_FEATURE tasks.audit, auditExplain (text; books + BooksUnknown; unknown; folder; agentAdds jen fix none s agentem; neznámý druh jen nadpis) · src/ui/waiting-task-ui.ts waitingAuditShown, waitingAuditMarkEl (trojúhelník, title), waitingAuditEl (auditFix jen fix ≠ none, discuss s researchLinkMark task chat jen s agentem a ne sheet, auditKeep), keepWaitingAudit (toast auditKept 8000 ms, Vrátit → unkeep), waitingAuditGone (auditGone), auditResearchUnavailable (ended, lostSince), shiftHeld · src/ui/research-overview-ui.ts:1899 značka v hlavičce, :2088 blok v detailu, :2192 a :2462 chat ne pod ⋯ · src/ui/research-ui.ts panel auditMarkPanel · strings.ts live.waitingAudit.* · CHANGELOG.cs.md 3.30.0 „Kontrola úkolu“ · ZADANI_DEV_kontrola-ukolu.md · dirigent:spec/109 K1.4–K1.6, prace/1117-app-109-kontrola (D1 složka, D2 neznámý kód) · app:cf12b70d auditKindBooks „z více knih“ -->

<a id="S4.4.9"></a>
### S4.4.9 Preview of the fix and Undo

**Fix** writes nothing at once. It first shows what the fix changes and writes only with the second **Fix** under the
preview.

- **Preview** (in place of the block's actions; **Loading preview…** until the research sends it):
  - **What changes**: **This task** “will wait for images 112–113 of the book …”, “will wait for images of the book
    …; image numbers are not known” or “the folder … will be created”; **New task** for each further book (“for
    images … of the book …”, “for the book …”; for a book that is not in the research, “the book is not in the
    research, the new task keeps waiting as text”);
  - **What remains**: what the fix does not do, for example “The book … is missing from the research – the agent adds
    it.” At the first such book there is **Discuss with the agent**;
  - under the preview “The fix changes only what the task waits for and can be undone.” and **Cancel** · **Fix**.
    **Cancel** or Esc closes the preview and returns the focus to **Fix** in the block. Only one preview is open at a
    time.
- **After writing** (**Fixing…**): the notice **Fixed** with **Undo** for 8 s. When the images already lie in the
  folder and the task has them all, **Fixed – the images are already saved, the task continues.** **Undo** takes the
  fix back without a preview (**Undone – the task waits as before.**). When the task has changed meanwhile, **Undo is
  no longer possible – the task has changed meanwhile.** Once the notice has gone, the fix can be undone only in the
  terminal (`strom task audit T… --unfix`, [R6.9.1](R6-awaiting-action.md#R6.9.1)).
- **Limits:**
  - the preview holds for the task as it was when the preview showed. When the task has changed meanwhile: **The task
    has changed meanwhile.** **The preview does not match the current state.** with **Reload**. Other refusals stand
    under the preview: **The research is writing right now – another attempt is possible shortly.**, **The research
    is locked – the fix cannot be written now.**, **No space left on the research disk – the fix was not
    written.**;
  - on a phone (up to 640 px) the preview is a sheet from below with **Cancel** · **Fix** at the bottom, without
    **Discuss with the agent**;
  - in the separate window of the **Research overview** the main window shows the notice.
- **Controls:** app: **Fix** in the block **Task not recorded as needed**; **Undo** in the notice.
- **Since:** app 3.30.0, research 1.35.0

<!-- zdroj: app:929d7813, ed7f7a04, 287ebc72, 01a1e760 src/ui/waiting-task-ui.ts openWaitingAuditFix (GET waiting/<T>/fix, auditLoading, jeden náhled), náhled (auditChanges, auditThisTask, auditNewTask, auditRemains, chat u první knihy, ne sheet; auditFixNote), confirmWaitingAuditFix (auditBusy, expect = stamp), writeWaitingAuditFix (toast auditFixed / auditFixedWoke 8000 ms, Vrátit = waitingWrite.undo), undoWaitingAuditFix (unfix, auditUndone, auditUndoFailed), cancelWaitingAuditFix (Esc, fokus na audit-fix), auditErrorText (409 auditErr409 + auditReload, 503, locked, disk), AUDIT_SHEET_ID (telefon) · src/research-audit.ts auditChangeLines (wait-images, wait-book, folder, split), auditLeftLines · src/research-link.ts postWaitingAudit (do fix/unfix/keep/unkeep, expect) · strings.ts live.waitingAudit.* · ZADANI_DEV_kontrola-ukolu.md §2 · dirigent:prace/1117-app-109-kontrola (D3 texty náhledu z op/images/title, D5 Vrátit jen v toastu) -->

<a id="S4.4.10"></a>
### S4.4.10 Research for this tree › Census records

Census records as a source of the research ([R9.12](R9-archives.md#R9.12)) can be switched on and off in the app as
well. The change is written through the bridge right after the click, both ways, and it is the person's decision in
the app: no system window is shown.

- **The group Sources** with the switch **Census records** and the sentence “The research may use census records as
  a source: a household in one year shows who lived together and where each person came from. Most archives only
  display census records, so the sheets are mostly supplied by hand as screenshots.”
- **Limits:**
  - only with a research that offers census records; with an older research the group is not there. Not with the
    Strom archive nor with a research waiting for an agent; when the research switches to the Strom archive meanwhile,
    the group disappears;
  - after the click the new state shows at once, dashed and locked, until the research confirms the write;
  - off with tasks set aside ([R9.12.4](R9-archives.md#R9.12.4)): under the row “Set aside: 3 census tasks. They come
    back when this is switched on.”;
  - without the bridge the switch is inactive: “The research isn't running. This can be changed once it runs.”;
  - a refusal gives its reason under the row and the switch stays as it was (e.g. “The research is busy. It will work
    again shortly.”, a locked research, a full disk).
- **Controls:** app: **Research → Other actions → Research for this tree… → Sources → Census records**. Terminal:
  [R9.12](R9-archives.md#R9.12).
- **Since:** research 1.36.0, app 3.31.0

<!-- zdroj: app:6edc7dc7 src/research-link.ts CENSUS_FEATURE census, LiveCensus {on, held}, sanitizeCensus · src/history-bridge.ts postBridgeCensus, censusReply (held, invalid, archive 409 census.archive, busy, locked, full) · app:80d6358c src/ui/research-tree-settings-ui.ts renderResearchCensusRow (jen s funkcí census, ne archiv ani výzkum bez agenta, gone po 409; pend přerušovaně a zamčeno; censusHeld jen vypnuto a held > 0; bez mostu storiesBridgeDown), setResearchCensus · strings.ts history.censusSection, censusTitle, censusDesc, censusHeld, storiesBridgeDown, errBusy · e2e/research-census.spec.ts · research:c7b117cd src/core/live.ts POST /census (config set census --for-tree v prostředí aplikace, bez okna) · CHANGELOG.cs.md 3.31.0 „Sčítání lidu z výzkumu“ · dirigent:spec/106 K1.1, K1.4 -->

<a id="S4.4.11"></a>
### S4.4.11 Research for this tree › Materials: the agent goes through files by itself

Whether the agent goes through files sent to the research by itself ([R11.6](R11-material-from-the-user.md#R11.6))
can be switched on and off in the app as well. The change is written through the bridge right after the click, both
ways, and it is the person's decision in the app.

- **The group Materials** with the switch **The agent goes through files sent to the research by itself** and the
  sentence “Files sent to the research (batches, single files, scans of sources) get tasks for the agent: it attaches
  them to people, names them and adds sources. Uses the subscription or credit. Off: the files wait in Materials and
  are sorted only on request.” It is off by default.
- **Limits:**
  - only with a research that offers the setting; with an older research the group is not there and the earlier
    texts apply. Not with the Strom archive nor with a research waiting for an agent; when the research switches to
    the Strom archive meanwhile, the group disappears;
  - after the click the new state shows at once, dashed and locked, until the research confirms the write;
  - without the bridge the switch is inactive: “The research isn't running. This can be changed once it runs.”;
  - a refusal gives its reason under the row and the switch stays as the research has it (a busy or locked
    research, the write held by another, a full disk);
  - the switch applies to this tree; the same setting applies to photos from the phone too ([S5.4](S5-phone.md#S5.4)).
- **Controls:** app: **Research → Other actions → Research for this tree… → Materials → The agent goes through files
  sent to the research by itself**. Terminal: [R11.6](R11-material-from-the-user.md#R11.6).
- **Since:** research 1.36.0, app 3.31.0

<!-- zdroj: app:74d06317 src/ui/research-tree-settings-ui.ts renderResearchIntakeRow (features intake.auto, /status.intake, researchAgentlessFor, storiesBridgeDown, pend), setResearchIntake (POST /intake, archive → gone, busy, held, locked, full) · src/research-link.ts postBridgeIntake · strings.ts history.intakeSection, intakeTitle, intakeDesc · research:src/core/live.ts POST /intake (intake.body, intake.archive), /status intake · dirigent:spec/130 K2.1 -->

<a id="S4.4.12"></a>
### S4.4.12 Research for this tree › Agents at once, at most

In the window **Research for this tree…**, under the choice of the agent, there is the row **Agents at once, at
most**: how many runs may work on the tree at once, the run of the whole queue and the runs of directions together
([R7.10.1](R7-when-the-agent-works.md#R7.10.1)).

- **Limits:**
  - a field with **−** and **+**, from 1 up to the cap the research gives (10); under it “Default 3. Work on the
    whole queue counts too.”;
  - the app writes a lowering through the bridge at once. Lowering below the number of runs going on stops none; new
    ones do not start;
  - raising it from the app is not possible: the value goes back and the row says “Raising it is possible only in the
    research terminal.” with the command `strom config set run.parallel 4` to copy;
  - at the full number both **Put an agent on this direction** ([S4.3.3](#S4.3.3)) and **Work on the queue…**
    ([S4.2.3](#S4.2.3)) are unavailable, and the link **Settings ›** opens this window at this row. The runs going on
    do not change;
  - the row is not there with an older research (3 applies), in a Strom archive and at a research waiting for an
    agent.
- **Controls:** app: **Research → Other actions → Research for this tree… → Agents at once, at most**. Terminal:
  `strom config set run.parallel <n>`.
- **Since:** app 3.31.0 (research 1.36.0)

<!-- zdroj: app:4de0835a src/ui/research-tree-settings-ui.ts renderResearchRunsRow (pod dl.research-tree-agent; bez run.limit, v archivu a bez agenta se nekreslí; RUN_LIMIT_MIN 1, cap z výzkumu), setResearchRunsMax (POST settings/runs, 403 runs.raise → runsMaxRaise + příkaz) · src/research-runs.ts atRunLimit · strings.ts research.runsMax, runsMaxHint, runsMaxRaise, live.runsLimitReached, runsSettingsLink · research:src/core/live.ts runsLimitWrite, src/core/liveruns.ts runLimits (cap 10) · app:docs/ZADANI_DEV_beh-po-liniich.md §5 · dirigent:spec/126 K2.3 -->

<a id="S4.4.13"></a>
### S4.4.13 Research for this tree › Materials: sort with the agent without asking

In the group **Materials** of the window **Research for this tree…** there is the switch **Sort with the agent
without asking** ([R11.5.3](R11-material-from-the-user.md#R11.5.3)). It can be switched off in the app at once;
switched on in the app after a confirmation or in the research terminal.

- **Switch:** “Sort with the agent… does not say the cost before each sorting; it still starts only on a click. Each
  sorting uses the subscription or credit. Applies to this tree.” It is off by default; it shows what the research
  says.
- **Limits:**
  - the app writes switching off through the bridge at once, without a question;
  - switching on asks first: **Sort with the agent without asking?** “Sorting then no longer asks to confirm the cost
    each time and uses the subscription or credit of the AI agent without another question. Applies to this tree.”
    with **Switch on**. **Cancel** writes nothing and the switch stays off. After **Switch on** the research writes
    `sort.confirm no` for this research and one line in the bridge's log that the Strom app on this computer turned
    the question off;
  - switching on from the app is possible only in the app on the computer with the research and with a research that
    offers it. Otherwise the research refuses switching on: the switch stays off, and under it stands “Not switched
    on. The command for the research terminal:” with the command `strom config set sort.confirm no --for-tree` to
    copy. The sentence goes as soon as the research says it is on. A research that does not offer switching on from
    the app also has in the switch's description the sentence “Switching it on is possible only in the research
    terminal.” and the app then does not ask beforehand;
  - on: the dialog **Sort with the agent…** does not say the cost; sorting still starts only by its button, and the
    AI tag and the number of files stay ([A3.5.8](A3-evidence-in-the-app.md#A3.5.8));
  - only with a research that offers the setting; not in the Strom archive nor at a research waiting for an agent.
    Without the bridge the switch is inactive as with **The agent goes through files sent to the research by
    itself** ([S4.4.11](#S4.4.11)).
- **Controls:** app: **Research → Other actions → Research for this tree… → Materials → Sort with the agent without
  asking**. Terminal: `strom config set sort.confirm no|ask --for-tree`.
- **Since:** app 3.32.0 (research 1.37.0)

<!-- zdroj: app:7674ee44 src/ui/research-tree-settings-ui.ts sortConfirm, showSort (SORT_CONFIRM_FEATURE, /status.sort, ne bez agenta), setResearchSortConfirm (POST /settings/sort ask hned; 403 sort.raise → příkaz, přepínač vypnutý, dokud status neřekne no; bez mostu storiesBridgeDown) · src/research-link.ts postBridgeSortConfirm · src/ui/material-sort-ui.ts (no: bez ceny, jen tlačítkem, štítek AI a počet) · strings.ts history.sortConfirmTitle, sortConfirmDesc, sortConfirmRaise · research:5520e0ac src/core/live.ts POST /settings/sort (403 sort.raise {command}, 409 sort.archive), /status sort · dirigent:spec/102 U8 · zapnutí z aplikace: app:e02c706d switchResearchConfirm (s SORT_CONFIRM_APP_FEATURE showConfirm sortConfirmAskText/Title, confirmSwitchOn; Zrušit nic), raiseNote (403 sort.raise → sortConfirmRaise + příkaz), bez sort.confirm.app sortConfirmTerminalOnly a bez dialogu · strings.ts history.sortConfirmAskTitle, sortConfirmAskText, confirmSwitchOn · research:ce89202a src/core/live.ts sortConfirmWrite (lowersFrom: jen fetch prohlížeče na tomto počítači, jinak 403 sort.raise {command}), noteLive ui.live.unasked.sort · BRIDGE_FEATURES sort.confirm.app · dirigent:spec/123 P2 K2.1–K2.6 -->

<a id="S4.4.14"></a>
### S4.4.14 Retry with the agent

An item the research allows to be returned to the agent ([R6.7.3](R6-awaiting-action.md#R6.7.3)) says why it waits
now and has the button **Retry with the agent**. An archive's group with more such items returns them at once.

- **The line Now** (the opened item, in place of the note about the browser): **Now:** and the reason by the
  research:
  - "The agent's browser held back downloads from … Once automatic downloads are allowed in the agent's browser
    profile, the agent saves them itself." (without a known website "… from the archive's website …");
  - "Saving the images stopped; the agent's session ended midway.";
  - "The agent's browser is ready now; the agent saves the images itself.";
  - "The page is in an archive viewer images cannot be saved from: the agent only reads them on screen, no image is
    saved.";
  - the extension not connected: "With the Claude in Chrome extension the agent would save the images itself. Once
    the extension is connected, the task can go back to the agent." and on a computer a link to the extension; the
    agent without a browser: "With Claude Code and the Claude in Chrome extension the agent would save the images
    itself.";
  - an item returned before that waits again ends with "– retried 18:40, held back again" (or "waiting again"); the
    time today, "yesterday 18:40", otherwise with the day and month.
- **The item's button:** **Retry with the agent** with the number of images the task still misses ("· 2 images"),
  for a page only read on screen "· read only"; without a known number, no number.
  - It is the main action when the agent can go on at once (downloads held back, saving stopped, the browser ready,
    reading on screen); the step **Add images** of the block **Deliver** ([S4.4.7](#S4.4.7)) is then only outlined.
    With the extension not connected or the agent without a browser it is outlined beside the main action.
  - With the block **Deliver** it stands under the line **Now**, otherwise among the item's actions.
  - A click returns the task at once, without a confirmation: the item disappears and a notice says "Returned to the
    agent – it takes it up next." (the research is working), otherwise "Returned to the agent – first in the queue;
    the agent takes it up at the next start."
  - A refusal stands in the item's row: "The task now waits for something else; not returned.", "The task can no
    longer go back.", "The research is not responding; nothing was returned."
- **Limit:** an item returned 3 times in 24 hours has in place of the button "Can go back to the agent again tomorrow
  9:12 – 3 attempts in 24 hours."
- **An archive's group:** in the band of an archive ([S4.4](#S4.4)) with at least two items that can be returned now
  stands **Retry all with the agent (N tasks, M images)**, also in a folded group:
  - the numbers are of the whole group, not only of the items a search shows. When an item does not say its number
    of images, it says "at least M images"; when all are only read on screen, "read only"; without known images only
    "(N tasks)". The items at the limit follow the button: "· 1 only tomorrow 9:12";
  - a click opens in place the question "Return 2 tasks (5 images) to the agent? They go to the front of the queue."
    with **Return** and **Cancel** (also Esc). **Return** returns all the group's items that can go back at once, or
    none; the notice "Returned to the agent: 2 tasks, first in the queue.", on a refusal "Nothing was returned: …" and
    the button stays;
  - when two or more items of the group wait for the same reason, the line **Now** stands once in the band and the
    items do not have it.
  - In groups by book and with questions about places, the group's button is not there.
- **Phone:** only the line **Now** and the sentence "Returning to the agent is possible in the app on a computer."
  (at the limit the sentence of the limit), without buttons; each item has its own line **Now**.
- **Limits:** only in the **Research overview** and its own window ([S4.1.6](#S4.1.6)), not in the small panel;
  only with a research that can return tasks. With an older research the item has neither the line **Now** nor the
  button. An agent does not run the button: only a person returns tasks ([R6.6](R6-awaiting-action.md#R6.6)).
- **Controls:** app: **Research overview → Awaiting action**, the opened item, **Retry with the agent**; in an
  archive's band **Retry all with the agent** · terminal: **What waits** → **Return to the agent**
  ([R6.7.3](R6-awaiting-action.md#R6.7.3)).
- **Since:** app 3.32.0 (research 1.37.0)

<!-- zdroj: app:c574752a, 3c6a554d, 75b71f5a src/research-waiting.ts waitingRetryReason (held/heldNoHost, stopped, ready, screen, no-extension waitNoExt + afterExt + extLink, agent-without-browser waitAgent, again → againHeld/againWaits), retryWhenText (dnes, včera, zítra, den a měsíc), waitingRetryCount, waitingRetryLimitText, waitingRetryMain (ne no-extension/agent-without-browser), waitingActions ctx.retry (jen přehled, ne telefon, w.retry.can), waitingGroupRetry (n, atLeast, readOnly, later), groupRetry*Text, waitingGroupRetryReason (≥ 2, stejné why+host) · src/ui/research-overview-ui.ts waitingRetryEl (Teď, limit, telefon R.phone, tlačítko primary/secondary), waitingRetryOffered (ne sheet, can, writes.retry), waitingGroupRetryOffer (ne sheet, ne kniha, ne místa, offer.n < 2 → nic, celá skupina s.waiting), waitingGroupRetryNow (ne telefon), browserNote jen bez w.retry · src/ui/waiting-task-ui.ts waitingDeliverEl retryMain (③ obrysová) · src/ui/research-waiting-write-ui.ts retryWaitingItem (doneRunning/doneIdle podle běhu, limit → can false, waitingRetryRefusedText) · src/ui/overview-window-ui.ts waiting-agent-retry, waiting-group-agent-retry · src/research-link.ts WAITING_RETRY_FEATURE · strings.ts live.waitingRetry, research.browser.waitNoExt, waitAgent · e2e/waiting-retry.spec.ts, waiting-retry-group.spec.ts · dirigent:prace/1124-app-089-zkusit-znovu (Výsledek, odchylky sub1–sub3), spec/089 K1.1–K3.1 -->

<a id="S4.4.15"></a>
### S4.4.15 Research for this tree › Starting the agent: start the agent without confirming

In the group **Starting the agent** of the window **Research for this tree…** there is the switch **Start the agent
without confirming**: the setting of this computer `run.confirm` ([S4.5.5](#S4.5.5)) from the app. It can be switched
off at once, switched on after a confirmation.

- **Switch:** “Actions in the app that start the agent run in the research terminal without a confirmation. Each run
  uses the subscription or credit. Applies to all researches on this computer.” It is off by default; it shows what
  the research says.
- **Limits:**
  - it applies to all researches on this computer, not only to this tree;
  - the app writes switching off through the bridge at once, without a question (`strom config unset run.confirm`);
  - switching on asks first: **Start the agent without confirming?** “Actions in the app that start the AI agent then
    run in the research terminal without a question and use the subscription or credit of the AI. Applies to all
    researches on this computer.” with **Switch on**. **Cancel** writes nothing and the switch stays off. After
    **Switch on** the research writes `run.confirm no` and one line in the bridge's log that the Strom app on this
    computer turned the question off;
  - switching on is possible only in the app on the computer with the research. Otherwise the research refuses
    switching on: the switch stays off, and under it stands “Not switched on. The command for the research terminal:”
    with the command `strom config set run.confirm no` to copy;
  - what then starts without a question and what still asks is decided by the research ([S4.5.5](#S4.5.5)); a
    question with a price in money stays;
  - only with a research that offers the setting; not in the Strom archive nor at a research waiting for an agent.
    Without the bridge the switch is inactive as with **The agent goes through files sent to the research by
    itself** ([S4.4.11](#S4.4.11)).
- **Controls:** app: **Research → Other actions → Research for this tree… → Starting the agent → Start the agent
  without confirming**. Terminal: [S4.5.5](#S4.5.5).
- **Since:** app 3.32.0 (research 1.37.0)

<!-- zdroj: app:e02c706d src/ui/research-tree-settings-ui.ts runConfirm (RUN_CONFIRM_FEATURE, /status.work.confirm, ne bez agenta), renderResearchIntakeRow (fieldset runConfirmSection), switchResearchConfirm (vypnout hned; zapnout showConfirm runConfirmAskText/Title, confirmSwitchOn; Zrušit nic), setResearchRunConfirm (raise → raiseNote sortConfirmRaise + příkaz; archive → řádek pryč; bez mostu storiesBridgeDown) · src/history-bridge.ts postBridgeRunConfirm · strings.ts history.runConfirmSection, runConfirmTitle, runConfirmDesc, runConfirmAskTitle, runConfirmAskText, confirmSwitchOn, sortConfirmRaise · research:ce89202a src/core/live.ts POST /settings/run (ask: config unset run.confirm; no: jen fetch prohlížeče na tomto počítači, jinak 403 run.raise {command: strom config set run.confirm no}; 409 run.archive), noteLive ui.live.unasked.run · BRIDGE_FEATURES run.confirm · dirigent:spec/123 P2 K2.1–K2.6 -->

<a id="S4.5"></a>
## S4.5 Actions that open the research

Most research actions in the app are a `strom-research://` link. The link opens the research's terminal on the same
computer. The terminal says what the app asks for and asks. Without confirmation in the terminal nothing is written
or paid. The only exception is the agent's work on the subscription or AI credit, when this computer is set so
([S4.5.5](#S4.5.5)).

- **Limits:**
  - An action is visible only on a computer (not on a touch device), only when the research has announced the link and
    only when **Strom Research on this computer** is on.
  - The link carries only record numbers and fixed values, no names and no free text.
  - The terminal begins **The Strom app asks for: … / Research: …** and asks **Go on?** For the agent's work
    it adds **The agent works on the subscription or AI credit of its account.**, for assigning tasks **The research
    writes tasks for the agent — nothing is searched and nothing is paid now.** With **Starting the agent from the
    Strom app: without the question** the agent's work starts without asking ([S4.5.5](#S4.5.5)).
  - A Strom archive and a research waiting for an agent refuse the agent's work (conversation, review, search,
    places, history).
  - When the same active direction already exists, **Find ancestors** only says **This research is there already:
    “…” — the agent goes on with it.**
  - The element that opened the link says **Opening the research…** (for the agent's work **Opening the agent…**,
    for a link without a terminal **Loading…**) until the research confirms that it has taken the link
    ([S4.5.4](#S4.5.4)), at most 10 s (work on the queue 30 s, [S4.2.3](#S4.2.3)). A second click meanwhile opens
    nothing again. Without confirmation the element is freed and under it stands **Did the terminal not open?** with
    **Try again** and the hint **If nothing opened, Strom Research needs to be started.** For a link without a
    terminal it says **If nothing happens, Strom Research is not running yet.** A research older than 1.35.0 cannot
    confirm the takeover: without a new agent session the element is freed quietly after 10 s, without a sentence.
  - The browser's system dialog that asks before opening the link is not visible to the app. Confirmed late, it
    clears the sentence after the limit by itself ([S4.5.4](#S4.5.4)).
- **Controls:** app: **Settings → Data and privacy → Strom Research on this computer**.
- **Since:** app 3.4.0 (research 1.6.0). Refusal in a Strom archive from research 1.14.0, while waiting for an agent
  from 1.15.0. Waiting for the opening from app 3.30.0; up to 3.29.0 the app did not know whether the terminal opened
  and only showed the notice **Opening the research…** with a hint.

<!-- zdroj: app:v3.21.2 src/ui/research-ui.ts researchLinkAvailable, launchResearchLink, :841 onComputer · strings.ts research.linksSetting, research.openingQuietHint · index.html linksSetting · research:v1.25.2 src/commands/links.ts:128 refusedHere, :153 inTerminal, :351 ui.research.exists · src/core/links.ts (hlavička) · assets/lang/cs.json ui.link.asks, ui.link.go, ui.link.cost, ui.link.tasks, ui.archive.refuse, ui.waiting.refuse · 3.30.0: app:574e7ef9, f63cc742 src/ui/research-ui.ts launchResearchLink → src/ui/research-open-busy.ts openResearchBusy (openingResearch / openingAgent / generic podle značky, BUSY_TIMEOUTS.terminal 10 s, queueWork 30 s, notOpened + notOpenedHint, bez terminálu research.openingQuietHint, retry) · strings.ts busy.* · CHANGELOG.cs.md 3.30.0 „Tlačítka, která čekají“ · ZADANI_DEV_tlacitka-cekani.md §3.1 · app:c3e09951 (79a05311) research-open-busy.ts unprovable → tichý konec u výzkumu bez handoffs (n1 N2) -->

<a id="S4.5.1"></a>
### S4.5.1 Action marks

Each research action has one of three marks according to what it opens.

| Mark | What happens | Actions |
|---|---|---|
| no mark | nothing opens the terminal | **Follow live**, the crop and the original in the viewer, loading the tree |
| terminal | the terminal shows or asks; a click pays nothing | **Open the research**, sending edits, **Review again…**, **Find ancestors**, **Park**, **Drop**, direction actions, **Finish and stop**, **Undo last send**, settings, **Research check** |
| AI and terminal | the agent's work, paid by the AI subscription | **Continue with the agent**, **Ask the agent**, **Work on this direction**, a conversation about a task or a conflict, research of places, the history of a place |

- **Limits:** for the agent's work the element says while opening **Opening the agent…** ([S4.5](#S4.5)). A
  conversation can open the agent's app instead of the terminal when the research is set up that way.
- **Since:** app 3.21.0. Up to 3.29.0 the app showed, while opening the agent's work, the notice **Opening the
  agent…** with **Tell the agent what to find out. The agent's work uses the AI subscription.**
- **From app 3.28.0:** **Work on the queue…** and **Open terminal** in its dialog have the mark AI and terminal
  ([S4.2.3](#S4.2.3)). Searching the queue, **Do next** and **Undo** have no mark: they go through the bridge and
  open nothing ([S4.2.1](#S4.2.1), [S4.2.2](#S4.2.2)).

<!-- zdroj: app:v3.21.2 src/research-link.ts:66 RESEARCH_LINK_MARKS, researchLinkMark (task do=chat, conflict do=agent, experiment do=off, fixes paid) · strings.ts research.openingAgent, research.openingAgentHint · research:v1.25.2 src/commands/links.ts:373 whereToTalk · 3.28.0: app 9cf43b22 researchLinkMark('work') u queue-work-btn, research-item-queue-work, Otevřít terminál; ZADANI_DEV_fronta-hledani „Značení akcí“ · 3.30.0: app:574e7ef9 research-open-busy.ts busy.openingAgent na prvku; research.openingAgentHint se už nepoužívá -->

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
- **From research 1.36.0:** with **Starting the agent from the Strom app: without the question** the conversation
  starts without asking only while the price of similar sessions is not known yet. With a known price it still asks
  ([S4.5.5](#S4.5.5)).

<!-- zdroj: research:c2a690ea src/cli/menu-links.ts (odkaz task bez do, úkol open) · assets/lang/cs.json ui.link.open.title/why/done/pick/chat/ahead/keep/already/kept/busy/estimate/estimate.none, ui.chat.task.open.say · strom help chat (--task: „a task in the queue (open): gone through now, taken up in the conversation“) · commit 9bd14e84 · test/cli/link-open-task.test.ts · dirigent:prace/1107-vyzkum-drobnosti-ukoly/karta.md Výsledek (Popis chování 7; klik v aplikaci neověřen) · app:6bd8609e strings.ts read.openTaskN, src/__tests__/read-source-state-view.test.ts:75 (researchLinkMark task) -->

<a id="S4.5.4"></a>
### S4.5.4 The research confirms a link it has taken

The research tells the app that it has taken a link: the terminal has come up, or an action that needs no terminal is
done. The app then stops waiting at once and speaks up only when nothing opened ([S4.5](#S4.5)).

- **Enforced by the code:**
  - the app gives each research link a new handoff number (`&handoff=<uuid>`). The research takes only a number in
    the form of a UUID; another value it quietly leaves out and carries out the link as without it. Nothing is ever
    started from the number;
  - `strom link open` writes the number to `.strom/handoffs/` in every copy of that tree's research on the computer.
    For a link that opens a terminal, as soon as the terminal comes up, before the first question. For a link without
    a terminal (detail, images, book, following and others) only after the action is done;
  - the number is not written when the terminal could not be opened, for a refused link (unknown research, archive,
    window with a message) or for a link to a new research from the app's tree (`new?app=…`): that has no research
    and no bridge yet. A browser system dialog closed without opening does not start strom at all;
  - the research bridge gives in `GET /status` (`handoffs`, also with `parts=1`) the numbers of the links taken in
    the last minute, the newest first, at most 64; older numbers and their files go. It reads them at every request,
    not only when the research's state changes. This holds in a Strom archive and in a research waiting for an agent
    too;
  - after handing over the link the app asks the bridge every second until the limit. A confirmation that comes
    within a minute after the limit (the browser dialog confirmed late) clears the sentence **Did the terminal not
    open?**;
  - a bridge that did not answer a request less than 30 s ago counts as not available: the sentence shows at once,
    without waiting;
  - the same link opened again within 400 ms does nothing.
- **Limits:**
  - a research without the confirmation (older than 1.35.0): a new agent session counts as the confirmation.
    Otherwise the element is freed quietly after the limit, without the sentence **Did the terminal not open?**: the
    app cannot tell whether the terminal started. A bridge that does not answer says the sentence here too. Work on
    the queue has its own proof and sentence ([S4.2.3](#S4.2.3));
  - a link to a new research (`new?app=…`) ends quietly after the limit; the app then waits until the research takes
    the tree;
  - without a running bridge nothing is reported, and the written file lapses by itself.
- **Controls:** app: every action with the mark terminal or AI and terminal ([S4.5.1](#S4.5.1)). Terminal:
  `strom link open '<link>'`.
- **Since:** app 3.30.0, research 1.35.0

<!-- zdroj: research:fbae81fc src/core/handoffs.ts (HANDOFF tvar UUID, HANDOFF_MS 60 s, HANDOFF_MAX 64, handoffsNow úklid, noteHandoff) · src/core/links.ts parseLink (handoff malými písmeny, jiná hodnota vynechána), linkText · src/commands/links.ts link open noteTaken (tty hned; bez terminálu done: true; researchesWithId) · src/core/live.ts withHandoffs (/status i parts=1, mimo stav), BRIDGE_FEATURES handoffs · test/cli/link-handoffs.test.ts · CHANGELOG.cs.md 1.35.0 (odkaz aplikace Strom … výzkum aplikaci potvrdí) · app:574e7ef9, f63cc742 src/ui/research-open-busy.ts (handoffProven: handoffs s feature handoffs, jinak nové sezení; OPEN_ASK_MS 1000, OPEN_LATE_ASK_MS 2000, OPEN_LATE_WATCH_MS 60 s, OPEN_REPEAT_MS 400, bridgeDown 30 s, quietLimit new?app=) · src/research-link.ts HANDOFFS_FEATURE · app:docs/ZADANI_VYZKUM_tlacitka-cekani.md „Odpověď výzkumu“ · app:c3e09951 (79a05311) src/ui/research-open-busy.ts unprovable (poslední status bez feature handoffs → quietEnd: po limitu bez věty a bez pozdního hlídání; most dole → věta hned; opts.proof fronty beze změny) · dirigent:prace/1118-app-tlacitka-n1 (N2, Milan 18. 11.) -->

<a id="S4.5.5"></a>
### S4.5.5 Starting the agent from the app without confirmation

The setting of this computer **Starting the agent from the Strom app** decides whether the terminal asks **Go on?** before
agent's work that the app asked for. The default is **asked first**: the terminal says what the app asks for, that the
agent works on the subscription or AI credit, and waits for a yes ([S4.5](#S4.5)). **Without the question** the
agent's work starts at once and the terminal says so in one line: **▶ Started without the question (research …): …**
and where the question is turned on again.

- **Enforced by the code:**
  - only actions that start the agent on the subscription or AI credit start without asking: a conversation with the
    agent (also about a person or a direction), a conversation about a task in the queue ([S4.5.3](#S4.5.3)) or in
    **Awaiting action**, a conflict left to the agent ([R5.6](R5-conflicts.md#R5.6)), the work on the queue
    ([R7.1.2](R7-when-the-agent-works.md#R7.1.2)) and the identification of places;
  - still asked:
    - a question that says a price in money: the estimate of a task in the queue, the identification of places with
      a measured price of sessions;
    - every link opened by an agent or by a script without a person's terminal;
    - a request sent, consents of archives and hosts (`strom allow`), deletions, assigning tasks to the agent and the
      history of a place;
    - the condition of working alone (`run.gate`): the work on the queue asks it as before
      ([R7.4](R7-when-the-agent-works.md#R7.4), [R7.4.1](R7-when-the-agent-works.md#R7.4.1));
  - when another session or run is already running in the research, nothing more starts, not even without the
    question;
  - the setting applies to every research on this computer, not to one tree. In a Strom archive the menu does not
    offer it;
  - only a person turns on **without the question**: the terminal says what is still asked and wants a second yes
    (Enter = no). When an agent or a command without a terminal sets it, a system window asks the person; without a
    window strom refuses the setting. Anyone may go back to **asked first**, without a question;
  - the Strom app shows and changes it in the window **Research for this tree…** with the switch **Start the agent
    without confirming** ([S4.4.15](#S4.4.15)); switching on there wants a confirmation in the app's dialog and is
    possible only on the computer with the research. The value is shown by `strom config` and by the report
    `strom error` ([R13](R13-reporting-a-problem.md#R13)).
- **Controls:** terminal: the menu **Settings** → **Language, agent, model, what the agent may do alone, stories… (the
  setup)** → **Starting the agent from the Strom app: …** → **Ask before it starts (default)** or **Start without the
  question**; `strom config set run.confirm no`, back `strom config unset run.confirm`. The value in force is shown by
  `strom config where`. App: [S4.4.15](#S4.4.15).
- **Since:** research 1.36.0; 1.37.0 (app 3.32.0): it can be switched on and off also from the Strom app on this
  computer

<!-- zdroj: research:8aa0f374 src/core/config.ts run.confirm (ask|no, tree: false, env žádná), Settings.runConfirm · src/cli/menu-links.ts asksToStart (priced || runConfirm !== no || !ctx.interactive || isAgent → asks; jinak ui.link.noconfirm) u openTask (priced = taskEstimate), waitingDo chat, placesRun (priced = est.session.usd || fronta), workRun, workOn · src/commands/links.ts conflict do=agent, chat (direction/person) · placeSearch dál asks (placeCost), review/research ui.link.tasks dál asks · src/commands/setup.ts setUserSetting run.confirm no → requireHumanYes (ui.consent.run.confirm), FALLBACKS run.confirm ask · src/cli/context.ts requireHuman (terminál → humanYes, jinak okno systému, jinak odmítnutí) · src/cli/menu-settings.ts runConfirmStep (ui.runconfirm.*, ui.runconfirm.about; jen !archive), unset pro ask · src/core/report.ts CONFIG_PLAIN runConfirm · cs.json ui.settings.runconfirm, ui.runconfirm.*, ui.link.noconfirm · strom help link · CHANGELOG.cs.md 1.36.0 „Agent z aplikace Strom bez potvrzení“ · test/cli/run-confirm.test.ts, test/cli/gates.test.ts · spec 123 K1.1–K1.5 (K1.4 bez zápisu do logu výzkumu: rozhodnutí dirigenta 20. 11.) -->

<a id="S4.6"></a>
## S4.6 What is only in the terminal

The app shows and asks, the terminal decides. What needs a person's consent or costs money is always confirmed in the
research's terminal, even when it starts with a click in the app.

- **Limits:**
  - Only in the terminal: starting the agent's work alone and its limits ([R7.1](R7-when-the-agent-works.md#R7.1)),
    the condition, the choice of agent, the queue settings and the items **Only here in the terminal (not in the
    Strom app)** ([R6.1.1](R6-awaiting-action.md#R6.1.1)).
  - Confirmed in the terminal: everything with the mark terminal or AI ([S4.5.1](#S4.5.1)), in 3.21.2 also the
    actions of directions and of the queue. From research 1.36.0 the agent's work without a price in money can start
    without confirmation ([S4.5.5](#S4.5.5)); only a person turns this on: in the terminal, or from app 3.32.0 with
    research 1.37.0 after a confirmation in the app on the computer with the research ([S4.4.15](#S4.4.15)).
  - On a phone there are no links; answers are given in the research on the computer ([S5](S5-phone.md)).
- **Since:** app 3.4.0 (research 1.6.0)
- **From app 3.22.0:** with research 1.26.0 directions ([S4.3.1](#S4.3.1)), work outside the directions by branches
  ([S4.3.2](#S4.3.2)) and a task's place in the queue ([S4.2](#S4.2)) go without the terminal.
- **From app 3.28.0:** with research 1.32.0 the agent's work alone on the queue can be asked for from the app
  ([S4.2.3](#S4.2.3)). The research's terminal starts it only after confirmation
  ([R7.1.2](R7-when-the-agent-works.md#R7.1.2)); the condition and its settings stay in the terminal.

<!-- zdroj: research:v1.25.2 src/core/links.ts (hlavička: nic se nezapíše bez slova člověka v terminálu) · src/core/live.ts (hlavička mostu) · app:v3.21.2 src/research-link.ts:66 · HEAD src/research-directions-write.ts · 3.28.0: app 9cf43b22 src/ui/queue-work-dialog.ts (aplikace nic nespouští, odkaz work) · spec 052 K6.2 (cesta terminál) -->
