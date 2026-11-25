<a id="R2"></a>
# R2 Lines and the queue

What the research agent bases its choice of work on. Describes the research 1.25.2 and the Strom app 3.21.2.
Changes from a later version carry its number.

<a id="R2.1"></a>
## R2.1 A line sets what the research investigates

A line of the research is one goal: the ancestors of a person, the descendants of a person, or one question. Every task
belongs to some line, and the agent works on the tasks of the lines. The app calls a line a *direction*.

- **Controls:** app: the research panel, section **Directions · N active** · terminal: menu **Add to the research →
  A new direction**, command `strom research new`
- **Since:** research 1.0.0

<!-- zdroj: research:src/core/model.ts DIRECTIONS, RESEARCH_STATES · research:src/commands/research.ts · app:strings.ts live.dirTitle -->

<a id="R2.1.1"></a>
### R2.1.1 Kinds of lines and their limits

- **Ancestors of a person**, at most a given number of generations, or only ancestors born before a given year.
- **Descendants of a person.**
- **One question** (a made-up example: “Who was the father of Marie Vlková?”).
- **A person review** comes from reviewing a person, not from the offer of a new line.
- **Controls:** terminal: `strom research new --direction ancestors|descendants --generations <n> --before <year>
  --question "<question>"`. App: **+ New direction**, with the limits **Generations at most** and **Only before the
  year** (app 3.22.0 with research 1.26.0).
- **Since:** research 1.0.0

<!-- zdroj: research:src/commands/research.ts:79 · assets/lang/cs.json ui.research.kind · app:src/ui/research-directions-ui.ts DIRECTIONS_WRITE_SINCE -->

<a id="R2.1.2"></a>
### R2.1.2 A paused and an ended line

- **Paused:** its tasks wait outside the queue; the agent takes the tasks of other lines.
- **Ended:** its tasks leave the queue. Nothing is deleted and the line can be started again.
- **Controls:** terminal: **Add to the research → The directions of the research: pause, end or take one up again**,
  `strom research pause|done|resume`. App: the Directions section, actions **Pause**, **End**, **Restart**.
  In the app 3.21.2 the action is confirmed in the research terminal; from the app 3.22.0 directly in the panel.
- **Since:** research 1.8.0

<!-- zdroj: research:src/commands/research.ts:168-175 · src/cli/menu-research.ts:233-263 · app:v3.21.2 research-directions-ui.ts:554 -->

<a id="R2.1.3"></a>
### R2.1.3 Who belongs to a line

- An ancestors line: the person, their ancestors within the line's limits, and the spouse of an ancestor.
- A line with a question: the person the question concerns.
- A task with no line set belongs to the narrowest line its people fall into.
- **Since:** research 1.0.0. Spouses and the person of a question from 1.26.0.

<!-- zdroj: research:src/core/frontier.ts:159-194 researchPeople/linePeople · src/core/directions.ts:75-82 directionOf · CHANGELOG.cs.md 1.26.0 -->

<a id="R2.1.4"></a>
### R2.1.4 The order of the lines is the order of work

The lines have one order, and work comes to them in it: the first line has precedence.

- **Limits:**
  - a paused and an ended line keep their place; when started again, it is back where it was. A new line goes to the
    end;
  - what the order means for the queue depends on the strategy ([R2.2.1](#R2.2.1)): **balanced** and **depth** give
    the tasks of the first running line a bonus of 2 points, the last 0, the others in proportion; no line stands
    still. **priority** takes the lines strictly in order: the first while it has work, then the next; tasks without
    a line only after them;
  - a research without a saved order ranks the lines by priority, then by the date they were created;
  - a narrower limit of a line (`strom research edit`) deletes nothing: the tasks beyond the limit wait outside the
    line.
- **Controls:** terminal: `strom research list` (in the order of work), `strom research order G… G…`, `strom research
  move G… --to <n>|--up|--down|--first`, `strom research edit G… --name|--question|--generations|--before`. App:
  section **Directions** ([S4.3.1](S4-research-from-the-app.md#S4.3.1)), phone ([S5](S5-phone.md)).
- **Since:** research 1.26.0

<!-- zdroj: research:src/core/order.ts workOrder, orderMode · src/core/queue.ts:237-240 lineBonus, :396 priority lineRank · src/commands/research.ts:215 research edit, :303 research order, :326 research move -->

<a id="R2.1.5"></a>
### R2.1.5 Moving tasks into a narrower line

A line lies inside a wider line when its person belongs to the wider one (the ancestors of a grandfather inside the
ancestors of his grandson). Open tasks of the wider line that concern only people of the narrower line can be moved
into the narrower line. The move is a person's decision and can be undone.

- **Enforced by the code:**
  - only tasks that name the wider line as their own, are open or wait for a person, and whose people all belong to
    the narrower line are moved. A task with no line of its own already counts for the narrowest line
    ([R2.1.3](#R2.1.3));
  - never a task being worked on (started or held by an open session, [R7.9](R7-when-the-agent-works.md#R7.9)), a
    parked or a done task, a task with no people, nor a task with someone outside the narrower line;
  - nothing is moved from a paused wider line;
  - the move is one operation of the history that remembers where each task came from. Undoing takes the line's last
    move and returns each task that still has the line to the line it came from.
- **Limits:**
  - when creating a line inside a wider one: `--move-tasks` moves the tasks, `--keep-tasks` leaves them; without
    either, a person at the terminal is asked (yes proposed). An agent, `--yes` or a run without a terminal leaves the
    tasks and says how many would be moved and that `strom research gather G…` moves them;
  - the agent starts a move only when a person asks for it;
  - for a run of a line ([R7.10](R7-when-the-agent-works.md#R7.10)) this means that the moved tasks are taken by its
    run, not by the run of the wider line.
- **Controls:** terminal: `strom research new … --move-tasks|--keep-tasks`, `strom research gather G…` (`--dry-run`
  shows what would change), `strom research gather G… --undo`. App: the form **New direction**, **Undo the move**
  ([S4.3.1](S4-research-from-the-app.md#S4.3.1)).
- **Since:** research 1.36.0

<!-- zdroj: research:src/core/gather.ts widerLines (bez pozastavených a vzatých zpět), gatherable (MOVABLE open, waiting; ne doing, držené sezením, odložené, hotové, bez lidí, s někým mimo), gatherPreview, gather, lastGather, ungather; operace research.gather / research.ungather · src/commands/research.ts research new --move-tasks|--keep-tasks (dotaz u terminálu, jinak movable {count, from}), research gather [--undo] · src/core/live.ts directions/preview, POST directions moveTasks, gather/undo (409 gather.none) · help research gather, research new · dirigent:spec/126 U11 -->

<a id="R2.2"></a>
## R2.2 The queue sets which task comes next

The open tasks of all running lines form one queue. The agent always takes the first task. A task in progress goes
before all others.

- **Limits:** the order is set by these keys, each next one only when the previous ones are equal:
  1. a task in progress;
  2. a manual choice **Do next** / **To the end** ([R2.3.1](#R2.3.1));
  3. local history tasks go after the others, in their own order; when the history is due, its first task goes first;
  4. work off the lines ([R2.3](#R2.3));
  5. short work first: linking hypothesis variants to persons in the tree, and places a person asked to identify;
  6. a story: when it is due, it goes first ([R2.2.2](#R2.2.2)), otherwise after the research;
  7. a task that can be done now before a task waiting for images downloaded by a person;
  8. the queue strategy ([R2.2.1](#R2.2.1));
  9. the kind of task: material → where the records are → proving a link → verification → enriching a person →
     request to an archive → story;
  10. the age of the task.
- **Controls:** terminal: `strom task list` (`--all`: every task in any state, since research 1.33.0),
  `strom task next`. App: section **Queue**.
- **Since:** research 1.0.0 (keys 1, 7–10). Key 6 from 1.1.0, linking hypotheses from 1.17.0, key 3 from 1.22.0,
  key 4 and places on request from 1.25.0. Key 2 from 1.26.0.
- **From research 1.32.0:** the bridge searches the whole queue (a task or person number, the names of persons, the
  words of the task, its book, call number, archive and place, ignoring diacritics), and the text searched for is
  kept nowhere, not even in the bridge's log. In the app: the search field in the **Queue**
  ([S4.2.1](S4-research-from-the-app.md#S4.2.1)).
- **From research 1.35.0:** with `queue.sameBook yes`, between keys 7 and 8 the next task of the book the last
  session worked in goes first ([R2.2.4](#R2.2.4)).
- **From research 1.36.0:** the tasks of a trial of bulk verification (`strom verify bulk --try N`) get a place like
  a task **Do next** ([R2.3.1](#R2.3.1)) and the next session takes them; two trials in a row go in the order they were
  given, the older first ([S7.5.1](S7-reliability-and-verification.md#S7.5.1)). `strom task list --kind <type>` shows
  only the tasks of one kind of work: `verify` (verification), `records` (registers), `material` (material), `places`
  (places), `enrich` (beyond the registers), `request` (requests), `story` (stories), `history` (history), `census`
  (census records, [R9.12](R9-archives.md#R9.12)), `other` (other); an unknown type ends with an error listing the
  types. In the app the row **Task type** in the **Queue** ([S4.2.4](S4-research-from-the-app.md#S4.2.4)).
- **From research 1.37.0:** a task a person returned to the agent from **What waits**
  ([R6.7.3](R6-awaiting-action.md#R6.7.3)) gets a place as a task **Do next** (key 2); several returned at once go
  among themselves in the queue's order. The strategy counts for it only the sessions since the return, and key 7
  does not hold it back while its turn lasts.

<!-- zdroj: 1.36.0: research:7116bb60 src/core/taskkind.ts (TASK_KINDS, taskKind; census: research:c7b117cd), src/commands/task.ts list --kind, src/core/verify.ts verifyBulk try (priority 3, queueAt next) · CHANGELOG.cs.md 1.36.0 · research:src/core/queue.ts rankTasks (řazení :374-396), LEVEL_ORDER :52, linksFirst (hypolinks.ts:453), placesFirst · verze klíčů: git log -S na „a.blocked - b.blocked“ (v1.0.0), „a.story - b.story“ (v1.1.0), „a.first - b.first“ (v1.17.0), „a.hist - b.hist“ (v1.22.0), „a.offLine - b.offLine“ a placesFirst (v1.25.0) · 1.32.0: src/core/live.ts searchQueue, queueAsk (GET /queue?q=, q nikdy v logu mostu), funkce queue.search · CHANGELOG.cs.md 1.32.0 · 1.33.0: research:c50f80f5 task list --all (= --state all), strom help task list -->

<a id="R2.2.1"></a>
### R2.2.1 The queue strategy

- **balanced** (default): takes turns between lines. It ranks higher a line with a higher priority, a nearer
  generation, and a line not worked on in the last 4 sessions. It ranks lower a task that has already failed.
- **depth:** stays with the line being worked on.
- **priority:** by the line's priority (1–5, default 3), then by generation.
- **Controls:** terminal: `strom config set queue.strategy balanced|depth|priority`, a line's priority
  `strom research new … --priority <1–5>`.
- **Since:** research 1.0.0
- **From research 1.26.0:** the order of the lines counts too ([R2.1.4](#R2.1.4)); **priority** takes the lines in
  order, within a line by the task's priority and generation.

<!-- zdroj: research:src/core/queue.ts:294-299, RECENT=4 :58 · src/core/config.ts queue.strategy · model.ts priority -->

<a id="R2.2.2"></a>
### R2.2.2 A story is due

Otherwise a story waits until the research has nothing to do. After 5 sessions without a story, though, one waiting
story comes up first (when the agent works alone). This does not apply with the priority strategy.

- **Since:** research 1.1.0
- **From research 1.31.0:** in a story turn only the first story in the order goes first, the others stay behind the
  research. The order in which `strom run` takes the tasks (with the story turn and with history tasks when they are
  due) is shown also by the menu before `strom run` ("Next in the queue, in the order the agent takes them:") and by
  the queue in the Strom app ([S4.2](S4-research-from-the-app.md#S4.2)); the bridge's queue says at a task whether it
  is a story or history. `strom task next` and `strom task list` have the conversation's order: without the story
  turn.

<!-- zdroj: research:src/core/queue.ts STORY_EVERY=5 :61 · 1.31.0: research 5f48cdaf src/core/queue.ts rankTasks (turnStory: jen první vyprávění tahu), RUN_TURNS, runOrder; src/cli/menu.ts (ui.run.next), src/core/live.ts (/status queue[], GET /queue, kind story|history), src/commands/tasks.ts CONVERSATION_ORDER (task next, task list) · CHANGELOG.cs.md 1.31.0 -->

<a id="R2.2.3"></a>
### R2.2.3 Tasks that wait outside the queue

A task is not taken while:
- its line is paused or ended ([R2.1.2](#R2.1.2));
- it concerns only people no family link joins to the tree. The link to the tree must be proven first, then the
  research goes on. A task that verifies that link is taken;
- the images of the book it should read are missing, and a decision on how to get them is awaited;
- the archive it reads from is temporarily unavailable;
- it is work off the lines with the choice **never** ([R2.3](#R2.3)).

Material (a task of the kind material) and a task in progress never wait.

- **Controls:** terminal: `strom task list --off-tree` (tasks off the tree).
- **Since:** research 1.9.0 (off the tree); the other reasons by the versions in the rules referred to.

<!-- zdroj: research:src/core/queue.ts:205-210 waits · src/core/kin.ts:98 offTree · assets/method/core.md „The tree first, then above it“ -->

<a id="R2.2.4"></a>
### R2.2.4 The next task of the same book: `queue.sameBook`

With the choice `queue.sameBook yes`, after a session in a book that has images on disk the queue takes the next task
of the same book first. The images are already downloaded and the agent reads them from disk.

- **Enforced by the code:**
  - the book of the last session: the book of its task that has at least one image on disk;
  - the tasks of the same book that can be done now go first (not waiting for images downloaded by a person). Not
    local history tasks;
  - at most 5 sessions in a row in one book, then the queue's own order again;
  - in the order of [R2.2](#R2.2) this is a key between 7 and 8: a task in progress, a manual choice, work off the
    lines, short work and a story when due still go first. In the strategy **priority** it comes only after the
    order of the lines;
  - `no` (default): the order does not change. The agent only gets a sentence saying which other tasks need the book
    ([R6.8](R6-awaiting-action.md#R6.8)).
- **Controls:** terminal: `strom config set queue.sameBook yes|no --for-tree`, the menu **Settings › Archives › Books
  with the most tasks**; `strom task list` gives the reason at such a task ("the same book as the last session …").
  App: **Research for this tree › Books › Downloaded book first** ([S4.4.6](S4-research-from-the-app.md#S4.4.6)).
- **Since:** research 1.35.0

<!-- zdroj: research:b1749433 src/core/queue.ts SAME_BOOK_MAX 5, sameBookTurn (ended[0], kniha se snímky: setsWithImages count > 0; inRow < 5), rankTasks inBook (!blocked, !forHistory), cmp (za a.blocked a lineRank u priority, před score), why „the same book as the last session …“ · src/core/mediaindex.ts setsWithImages · src/core/config.ts queue.sameBook (no výchozí) · CHANGELOG.cs.md 1.35.0 -->

<a id="R2.3"></a>
## R2.3 Work off the lines

In a research with several lines, **work off the lines** is a task about people no line reaches (an ancestor's sister
and her family) that helps no line. Such work comes **after the work on the lines**.

- **Limits:** a task helps a line, and so is not off the lines, when it names a hypothesis or conflict of the line,
  joins people to the tree through a person of the line or that person's partner, or the agent wrote how it helps
  the line (an ancestor's sibling as godparent or witness, the same house, an ancestor's surname). The sibling's own
  family does not help the line: joining people to a side branch (for example to an ancestor's sibling) belongs to that
  branch and comes in turn by its choice ([R2.3.1](#R2.3.1)). A hypothesis of the line and a reason the agent wrote
  still count.
- **Choices:** **at the end, after the lines** (default) · **as the lines' work** · **never** (the tasks are not taken,
  nothing is deleted).
- **Controls:** terminal: **Settings → The agent working alone → Work off the lines**,
  `strom config set queue.offLine last|normal|never`. The app 3.21.2 shows at the task **Waits until the directions'
  work is done · helps no direction**.
- **Since:** research 1.25.0
- **From research 1.26.0:** a new default choice **occasionally, one in a while**: one task off the lines per 10 sessions
  (`queue.offLineShare`), from the nearest branch. The spouse of an ancestor also belongs to work off the lines
  ([R2.1.3](#R2.1.3)).
- **From research 1.31.0:** only joining people to a person of the line or to that person's partner helps the line;
  before, joining them to anyone in the tree was enough, also to an ancestor's sibling. The bridge in `/status` says
  at the task being worked on how it helps the line (the feature `working.helps`). App 3.27.0 shows it in the
  **Research overview** in the row **Now** ("helps the direction … · connects people to the tree", "outside the
  directions · branch …", [S4.1](S4-research-from-the-app.md#S4.1)) and in the introduction of the choice of work
  outside the directions ([S4.3.2](S4-research-from-the-app.md#S4.3.2)).

<!-- zdroj: research:v1.25.2 src/core/config.ts:278 queue.offLine (popis), :715 výchozí last · HEAD model.ts OFF_LINE_CHOICES, config.ts OFF_LINE_SHARE=10 · assets/method/core.md „The lines first“ · app:strings.ts research.queueOffLast · výzkum 1.31.0: src/core/offline.ts (b: joins jen k osobě linie nebo partnerovi, jinak větev; a, c mají přednost), HelpsBy, /status working[].helps, branch · commity 576cf7e5, 2e54c8d5 · CHANGELOG.cs.md 1.31.0 „Připojení rodiny k vedlejší větvi je práce mimo linie“ · spec 036 K1.7 -->

<a id="R2.3.1"></a>
### R2.3.1 A choice for one branch and one task

Besides the choice for the whole research, one branch (also “add to a line”) and one task (**Do next** / **To the
end**) can have their own choice. The narrower choice wins: the task before the branch, the branch before the research.

- **Limits:**
  - a branch: **now and then**, **at the end**, **as usual**, **never** (the tasks wait outside the queue, nothing is
    deleted and no new task is proposed in it), or add it to a line: the branch's tasks then help the line and go
    with it. The choice holds for new tasks of the branch too. Back to the research's choice: the default;
  - a task **Do next** comes next, before the lines, places and history, and only once: after a session on it the
    choice goes by itself. **To the end** holds until the task is done or until the choice is reset. A task the agent
    is working on does not change its place.
- **Controls:** terminal: `strom offline list|show`, `strom offline set B-P… --mode occasional|last|normal|never`,
  `--line G…`, `--default`; `strom task order T… --next|--last|--default`. App 3.22.0:
  **Do next**, **To the end**, the branch's choices ([S4.3.2](S4-research-from-the-app.md#S4.3.2)). App 3.28.0
  with research 1.32.0: **Do next** and **Undo** ([S4.2.2](S4-research-from-the-app.md#S4.2.2)).
- **Since:** research 1.26.0
- **From research 1.32.0:** of several tasks chosen **Do next** the last chosen goes first (one chosen again goes to
  the top); before, the first chosen. The task the agent is working on stays first. `strom task order T… --restore
  next@<time>` (or `last@<time>`) puts the task's choice back exactly as it was: the time is the one the previous
  change gave in `--json` (`was`), at most 30 days old and not later than now.

<!-- zdroj: research:src/commands/offline.ts:101 offline set (BRANCH_MODES), :171 task order (next once, queue.doing) · quality/offline.json · 1.32.0: src/core/queue.ts rankTasks (b.nextAt před a.nextAt: naposledy zvolený první; doing první), turnWas, restoredTurn, RESTORE_DAYS=30 · src/commands/offline.ts task order --restore, was · src/core/live.ts POST /queue/<T…> was, {do: restore} · CHANGELOG.cs.md 1.32.0 · spec 052 K5.3, K5.4 -->

<a id="R2.3.2"></a>
### R2.3.2 A growing branch gets a line proposed

When a branch off the lines grows to 10 open tasks or 5 persons, a question appears in **Awaiting action**: add it to
a line, start a line, leave it as it is, or not research it. After the answer “leave it”, it is proposed again only at
double the size. A branch with its own choice, and the choice **never**, get no proposal.

- **Limits:** only a person answers (the app or **What waits**); the research refuses the agent's answer. When the
  line at the branch is paused or ended, the app offers the narrowest running line the branch's person belongs to;
  when there is none, the paused line with the note **(paused)**.
- **Controls:** terminal: **Propose lines for branches that grow** (on/off), `strom offline answer B-P…
  line|keep|never`, `strom config set queue.suggestTasks|queue.suggestPersons <n>`. App: **Awaiting action**,
  the setting **Suggest directions for growing branches** ([S4.3.2](S4-research-from-the-app.md#S4.3.2)).
- **Since:** research 1.26.0

<!-- zdroj: research:src/core/offline.ts:449-455 grows · config.ts SUGGEST_TASKS=10, SUGGEST_PERSONS=5 · cs.json ui.wait.branch.done.keep · src/commands/offline.ts:142 offline answer (person) · app:src/ui/research-offline-ui.ts answerGrowingBranch · strings.ts live.setSuggest, live.branchAddPaused -->

<a id="R2.4"></a>
## R2.4 Why a task stands where it stands

Every task in the queue gives the reason for its place: in a line, helps a line (and how), off the lines (and in which
branch), a manual choice, or it waits because the line is paused.

- **Controls:** app 3.22.0: section **Queue**, the line at the task (e.g. “helps the direction N · …”).
- **Since:** research 1.26.0

<!-- zdroj: research:src/core/queue.ts:312-349 · app:strings.ts live.qWhyLine, qWhyHelps, qWhyOut, qWhyManualNext, qWhyPaused -->
