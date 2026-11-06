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
  - Without following, the panel shows the last known **Awaiting action** with the sentence **As of {d}. The research
    is not running.**
- **Controls:** app: the panel, buttons **⤢ Open overview** and **Stop following**; menu **Research → Research
  overview**.
- **Since:** app 3.5.0
- **From app 3.22.0:** each section can be expanded, collapsed or hidden, and the choice holds for the panel and the
  overview ([S4.1.2](#S4.1.2)). **Awaiting action** does not expand by itself, not even with a new item.

<!-- zdroj: app:v3.21.2 src/ui/research-ui.ts:223 PANEL_CHANGES, :227 AUTO_FOLD, :3326 appendQueueSection(…, 3), renderLivePanel, renderIdleResearchPanel · src/ui/research-overview-ui.ts:5 (≥1280), :51 FOLDED_BY_DEFAULT, :53 GROUP_MS, :59 MAX_STEPS, :74, :309-311 · strings.ts live.overviewTitle, research.panelLabel, research.stop, research.atWork, research.queue -->

<a id="S4.1.1"></a>
### S4.1.1 Follow the agent in the tree

The tree can move by itself to the person the agent is working on right now (the first work not paused in the section
**Now**).

- **Limits:** at most one move every 8 s. When the tree is zoomed out more than 0.55, it zooms in to 0.8. Moving the
  tree, selecting another person or another view interrupts following (**Back to the agent**); after 20 s without a
  touch it returns by itself. The choice is remembered for the device.
- **Controls:** app: **Research overview → Follow the agent in the tree** / **Stop following**.
- **Since:** app 3.5.0

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
  - a new item does not expand the section. The heading shows the count and **{n} new**; highlighted when a decision
    or a permission is among them (**includes a decision or permission**);
  - hidden, it leaves the chip **Waiting {n}** in the panel's header, in the summary of the collapsed panel, in the
    strip on a phone and in the overview. A click shows the section in the overview until the overview closes
    (**Hidden section, shown until the overview closes.**).
- **Controls:** app: **⋯ → Customize panel…** in the header of the panel and of the overview; right click or long
  press on a section's heading (also the Menu key or Shift+F10); **Settings → Following research**. On a phone as a
  sheet from below.
- **Since:** app 3.22.0

<!-- zdroj: app:src/ui/live-section-prefs.ts SECTION_PREFS_KEY, PREF_KEYS, OVERVIEW_KEYS, OLD_PANEL_KEY · src/ui/live-section-edit.ts · src/ui/live-section-edit-ui.ts · src/ui/research-ui.ts:282 waitingHeadInfo, :312 waitingChip, :3180 toggle, :3215 resetLiveSections, :3225 hideLiveSection · src/ui/research-overview-ui.ts:376 shownOnce · strings.ts live.editPanel(Menu), sectionExpanded/Collapsed/Hidden/Default, resetDefaults, autoFoldedNote, allHidden, waitingShort, importantHint, shownOnce, settings groupResearchFollow · commity c4b1dcc, a56232a · spec 044 K1–K5 -->

<a id="S4.2"></a>
## S4.2 The queue in the app

The app shows the beginning of the research's queue in the order in which the agent takes it
([R2.2](R2-lines-and-queue.md#R2.2)). The whole queue stays in the research.

- **Limits:**
  - The panel shows 3 tasks (**Up next**), the overview 20 (**Queue**). The rest is shown by the row **and {n} more in
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
  The branch chip (**Branch {n} {k}**) narrows the whole queue to the branch's tasks; **Show the whole queue**
  cancels it.

<!-- zdroj: app:v3.21.2 src/ui/research-ui.ts:308 queueNoteText, :3373 appendQueueSection · research-overview-ui.ts:311 (20) · strings.ts research.queue, research.park/drop/wake, research.queueMore, research.queueOffLast, research.queueOffNever, research.queueHelps · HEAD src/research-queue-pages.ts:19 QUEUE_PAGE, :28 QUEUE_ROWS_CAP · src/ui/research-ui.ts:3884 taskDoNext/taskDoLast · strings.ts live.taskDoing, live.queueLoadMore, live.queueCapNote, live.branchQueueChip, live.branchQueueChipClear -->

<a id="S4.3"></a>
## S4.3 Directions in the app

The overview shows the research's directions ([R2.1](R2-lines-and-queue.md#R2.1)): what waits on each and how far it
got. In app 3.21.2 directions are only read; every change is confirmed in the research's terminal.

- **Limits:**
  - The section **Directions · {n} active** is there only with two or more directions, or with one direction when work
    outside it runs too (row **Outside the directions**). Paused and ended directions are folded under **Paused and
    ended · {n}**.
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
  direction's row shows what is being worked on now (**Now: …**) and the limits (**up to {n} generations**, **before
  {year}**; not for a paused direction). The direction detail says what the direction found over the last days
  (**Last {n} days:** sessions, people, sources); it shows the people in the tree. Ended directions are collapsed at
  the end (**Ended · {n}**). In a narrow window and on a phone the overview is a sheet: arrows ▲▼ instead of the
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
  - When the same direction already exists, the form says so (**The direction {n} is already running.**) and offers
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
  - A branch's row: the branch's person, its relation to a direction (**near the direction {n}**), the number of
    tasks, **growing**, **own choice**.
  - A click on a branch shows its first tasks with their place in the queue (**In the queue · first {k} of {n}**,
    **{i} in the queue**) and the link **All {n} tasks in the queue ›**. When the branch's tasks stand beyond the
    loaded part of the queue: **The branch's tasks stand further on in the queue ({n}).**
  - For a branch: **Taken:** **Now and then** / **At the end** / **As usual** (the research's choice has
    **(default)**), **Add to the direction {n}** (the nearest direction first), **Create a direction from this
    branch**, **Do not research** (the tasks leave the queue, nothing is deleted), **Reset to default**. Branches not
    researched are together (**Not researched · {n} branches**).
  - Questions about growing branches ([R2.3.2](R2-lines-and-queue.md#R2.3.2)) are in **Awaiting action**: add to a
    direction (for a paused direction **Add to the direction {n} (paused)**), create a direction, **Leave as it is**,
    do not research. Without an answer the branch goes on being taken as before.
  - The window **Research for this tree…**, the group **Work outside the directions**: the choice for the whole
    research (**Now and then**: “About 1 task outside the directions per {k} tasks of the directions.”), **Suggest
    directions for growing branches**, **Branches with their own choice** and tasks with a manual order.
- **Controls:** app: **Research overview**, the section of work outside the directions, at a branch **⋯** (**Branch
  options**); **Research for this tree…**.
- **Since:** app 3.22.0 (research 1.26.0)

<!-- zdroj: app:HEAD src/ui/research-offline-ui.ts:3, :104 (caps.offLineBranches, ≥2 linie) · src/research-directions-write.ts setBranchMode, setOffLineTree, answerBranchWaiting · strings.ts live.offModeLink, live.offModeCap, live.branchAddPick, live.branchCreate, live.branchNever, live.branchReset · research-offline-ui.ts:202-228 growingBranchLine, :542 branch choices, :680 branchQueueBeyond, :740 pick · strings.ts live.dirNear, branchGrows, branchOwnChoice, branchQueueHead, branchQueuePos, branchAllTasks, branchTaken, branchDefaultTag, branchAdd(Paused), branchNeverGroup, waitBranchLeave, waitBranchHint, setOutTitle, setOutOcc, setSuggest, setOwnChoice, setManualTasks, menu treeSettings · spec 038 K7 -->

<a id="S4.4"></a>
## S4.4 Awaiting action in the app

The panel and the overview show the same list as the research ([R6.1](R6-awaiting-action.md#R6.1)). What can be dealt
with in the app and what only in the research is said in [R6.5](R6-awaiting-action.md#R6.5).

- **Limits:** below the list it says where to answer: **Answer in the research. The tree updates by itself
  afterwards.**, for questions about places **Questions about places are answered here.**, for both **Questions about
  places are answered here, the others in the research.** Items only for the terminal do not reach the app
  ([R6.1.1](R6-awaiting-action.md#R6.1.1)).
- **Controls:** app: the panel, section **Awaiting action**; menu **Research → Awaiting action**.
- **Since:** app 3.4.0. Questions about places from research 1.25.0.

<!-- zdroj: app:v3.21.2 src/ui/research-ui.ts renderLivePanel (waiting) · strings.ts research.answerWhere, research.answerHere, research.answerMixed -->

<a id="S4.5"></a>
## S4.5 Actions that open the research

Most research actions in the app are a `strom-research://` link. The link opens the research's terminal on the same
computer. The terminal says what the app asks for and asks. Without confirmation in the terminal nothing is written
or paid.

- **Limits:**
  - An action is visible only on a computer (not on a touch device), only when the research has announced the link and
    only when **Strom Research on this computer** is on.
  - The link carries only record numbers and fixed values, no names and no free text.
  - The terminal begins **The Strom app asks for: {what} / Research: {name}** and asks **Go on?** For the agent's work
    it adds **The agent works on the subscription or AI credit of its account.**, for assigning tasks **The research
    writes tasks for the agent — nothing is searched and nothing is paid now.**
  - A Strom archive and a research waiting for an agent refuse the agent's work (conversation, review, search,
    places, history).
  - When the same active direction already exists, **Find ancestors** only says **This research is there already:
    “{name}” — the agent goes on with it.**
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
