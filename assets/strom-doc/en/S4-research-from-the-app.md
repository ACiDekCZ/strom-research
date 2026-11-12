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

<!-- zdroj: app:v3.21.2 src/ui/research-ui.ts:223 PANEL_CHANGES, :227 AUTO_FOLD, :3326 appendQueueSection(…, 3), renderLivePanel, renderIdleResearchPanel · src/ui/research-overview-ui.ts:5 (≥1280), :51 FOLDED_BY_DEFAULT, :53 GROUP_MS, :59 MAX_STEPS, :74, :309-311 · strings.ts live.overviewTitle, research.panelLabel, research.stop, research.atWork, research.queue · 3.27.0 Teď: app 4e4f6d8c src/research-link.ts WORKING_HELPS_FEATURE (working.helps), sanitizeWorking (helps jen s linií, branch) · src/ui/research-offline-ui.ts workingWhyText (helps → qWhyHelps + qWhyHow / qWhyHowBranch; větev mimo linie → qWhyOutBranch, ve skupině qWhyHowBranch) · src/ui/research-overview-ui.ts (Teď: důvod místo názvu linie) · strings.ts live.qWhyHelps, qWhyHow.*, qWhyHowBranch, qWhyOutBranch · spec 036 K1.8 · malý panel: app 2c018779 src/ui/research-ui.ts, research-directions-ui.ts (pod nadpisem linie jen jak) · 3.27.0 spec 057: app f05fff8e src/ui/research-actions-ui.ts overviewRows (research-item-overview první; stop při sledování, jinak followLive, ne bez agenta), src/ui/tree-actions.ts researchOverview · 8d564b35 src/ui/tree-overview.ts treeOverviewResearchLinkHtml (live.researchLink v záhlaví focus) · 28bbebeb src/ui/live-section-prefs.ts TOP_DEFAULTS (month.price false), research-overview-ui.ts appendOverviewSummary, strings.ts live.spendSessions, spendAmount · 87a6ea88 live.dirWorkedOn · strings.ts live.openOverview -->

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

<!-- zdroj: app:f05fff8e, 48573de6 src/ui/research-overview-ui.ts renderResearchOverview (source live | bridge | tree; fromTree vynechá working, changes, queue), appendOverviewStateOff (notRunning, turnOn / researchLiveStartHow; telefon phoneTreeOnly, phoneWhy), overviewFollowStrip (activeResearchAgentless → bez pruhu; agentStarted, followNote), appendOverviewWaitingAsOf (asOf), appendOverviewSkeletonLines, appendOverviewFoot (missingLink) · src/research-overview-source.ts BRIDGE_ONLY_SECTIONS, afterTurnOnKeys, skeletonLines (_STROM_DIRECTION, místa osob) · src/research-device.ts WAITING_MAX_AGE_MS = 7 dní · src/ui/research-ui.ts OverviewViewing (refreshedAt, agentStarted, waitingAt) · src/ui/tree-actions.ts researchOverview · 8d564b35 src/ui/tree-overview.ts treeOverviewResearchLinkHtml (sekce focus, bez osob v záhlaví) · strings.ts live.followNote, agentStarted, notRunning, turnOn, afterTurnOn, refreshedAgo, asOf, phoneTreeOnly, phoneWhy, researchLink, missingLink, treeOverview focus · CHANGELOG.cs.md 3.27.0 · spec 057 K1.8–K1.12 -->

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

<!-- zdroj: app:v3.21.2 src/ui/research-ui.ts:308 queueNoteText, :3373 appendQueueSection · research-overview-ui.ts:311 (20) · strings.ts research.queue, research.park/drop/wake, research.queueMore, research.queueOffLast, research.queueOffNever, research.queueHelps · HEAD src/research-queue-pages.ts:19 QUEUE_PAGE, :28 QUEUE_ROWS_CAP · src/ui/research-ui.ts:3884 taskDoNext/taskDoLast · strings.ts live.taskDoing, live.queueLoadMore, live.queueCapNote, live.branchQueueChip, live.branchQueueChipClear · 3.27.0: app 2ee3718d (queue[].kind ze /status i ze stránek fronty, jiná hodnota zahozena) strings.ts live.queueKind · research 5f48cdaf src/core/queue.ts RUN_TURNS, runOrder (most /status queue[], GET /queue, menu před strom run), kind story|history -->

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

<!-- zdroj: app:v3.21.2 src/research-link.ts:66 RESEARCH_LINK_MARKS, researchLinkMark (task do=chat, conflict do=agent, experiment do=off, fixes paid) · strings.ts research.openingAgent, research.openingAgentHint · research:v1.25.2 src/commands/links.ts:373 whereToTalk -->

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

<!-- zdroj: app:v3.21.2 src/ui/research-actions-ui.ts:152 UNDO_MAX_AGE_MS, :158 FIRST_LEVEL_MAX, :300 researchMenuShown, :435 tools, :1000 personResearchActions · src/research-link.ts:115 RESEARCH_TOOL_GROUPS, :132 RESEARCH_TOOL_ACTIONS · research-overview-ui.ts:811, :870 finishSession · strings.ts research.footerFull, research.tools.*, research.reviewWhere, research.continueAgent -->

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

<!-- zdroj: research:v1.25.2 src/core/links.ts (hlavička: nic se nezapíše bez slova člověka v terminálu) · src/core/live.ts (hlavička mostu) · app:v3.21.2 src/research-link.ts:66 · HEAD src/research-directions-write.ts -->
