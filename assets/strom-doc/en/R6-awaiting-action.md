<a id="R6"></a>
# R6 Awaiting action

What the research needs from a person, where it shows, and how a task returns to the queue once dealt with.
Describes the research 1.25.2 and the Strom app 3.21.2. Changes from a later version carry its number.

<a id="R6.1"></a>
## R6.1 What waits is one list

Everything the research waits for from a person forms one ordered list: tasks set to waiting, questions of archives,
new versions of approved stories, and questions about places. The terminal also shows what is dealt with only there.
The list is worked out from the research each time; nothing is written into it.

- **Limits:** a task that waits only for an archive's permission and has no images belongs to the archive's question.
  A research that serves as an archive has no tasks or places in the list.
- **Controls:** app: the section **Awaiting action** · terminal: the menu **What waits (n)**, the status line
  **Waiting: N** · the page for the phone: **What waits · N**.
- **Since:** research 1.3.0. The list by where things are dealt with, and in the app, from 1.14.0 (app 3.11.0).

<!-- zdroj: research:src/core/waiting.ts:1-12, waitingFor :303-460 (filtr :321), actsAsArchive (v1.15.0) · src/cli/menu.ts:234, :379 · CHANGELOG.cs.md 1.14.0 · app:src/ui/research-overview-ui.ts research.waiting -->

<a id="R6.1.1"></a>
### R6.1.1 The count and what is only in the terminal

- The line **Waiting: N (of these X only here in the terminal, Y waiting for a reply)** splits the count the way the
  app does. The app's number is N without the items for the terminal only and without requests sent.
- Only in the terminal are trees sent from the app (**The Strom app**), questions about reading scans (**The reading of
  scans**), conflicts (**Conflicts to decide**, see [R5](R5-conflicts.md)), hypotheses to decide (from research 1.28.0;
  from 1.31.0 the Strom app that can decide them gets them too, [R6.3.4](#R6.3.4)) and milder terms of an archive. In
  the overview **What waits** they come first under the heading **Only here in the terminal (not in the Strom app)**,
  followed by **Also in the Strom app**.
- The page for the phone only reads: without the items for the terminal only, with stories, 20 items first, at most
  200 at once. It says **Decisions are made on the computer in the Research overview.**
- **Since:** research 1.21.0. The page for the phone from 1.18.0, the remembered count in the menu from 1.22.0.

<!-- zdroj: research:src/core/waiting.ts:127 TERMINAL_ONLY, :139 waitingSplit, :149 waitingLine · src/cli/menu-waiting.ts:215-232 · src/core/waitkept.ts · src/core/phone-watch.ts WAITING_SHOWN, WAITING_ASKED · assets/lang/cs.json ui.waiting.split*, ui.wait.only.head, ui.phone.page.waiting.where -->

<a id="R6.2"></a>
## R6.2 A task waits for a person

When the agent cannot go on without a person, it sets the task to waiting and writes, impersonally, what is needed.
The kind of waiting sets the section, the group and the possible actions: **images**, **a site to check**, **an
archive's permission**, **letter**, **family**, **web**, **other**.

- **Limits:** `--kind` takes only `letter`, `family`, `web`, `other`; images and checking a site have their own
  options, which do not go together. Without `--kind` the kind is derived from the words: a question to a person is
  **family**, otherwise the first sentence decides, then the whole text when it names exactly one kind; otherwise
  **other**. The research refuses a text that addresses a person. A new setting of waiting erases the previous one and
  the mark of sending.
- **Controls:** terminal: `strom task wait T… --on "<what>" --kind <kind> --to "<to whom>" --request notes/<file>
  --url <address>`, later `strom task edit T… --kind --to --request`.
- **From research 1.26.0:** `--kind images` with `--images` and `--kind check` with `--check` are taken as a repetition, not
  an error.
- **Since:** research 1.0.0. Kinds, `--to` and `--request` from 1.14.0.

<!-- zdroj: research:src/commands/tasks.ts:975-1050 task wait, :497-520 waitOptions, :392-417 stateChange · src/core/model.ts:540 WAIT_KINDS · src/core/waitkind.ts:150 waitKindOf (ASK_USER, firstClause) · assets/method/waiting.md -->

<a id="R6.2.1"></a>
### R6.2.1 Images saved by hand

- The research prepares a folder in `inbox/` of the shared folder. A file carries the number of the image (`9.jpg`,
  `9a.jpg`).
- After the images are saved into the research, the task wakes with a note of which images are missing
  ([R6.7.2](#R6.7.2)).
- **Controls:** terminal: `strom task wait T… --images B…:<from>-<to>`, then `strom media add --inbox`; in **What
  waits** **Open the folder (M/N saved)**. App: **Open folder** (from app 3.23.0; before, **Folder**).
- Browser-only archives, images from the app and what a person does: [R9.6](R9-archives.md#R9.6), [R9.9](R9-archives.md#R9.9).
- **From app 3.30.0:** the opened item in the app begins with the block **Deliver** (which images and into which
  folder) with the steps **Archive website ↗** → **Open the book’s folder** or **Open folder** → **Add images**
  ([S4.4.7](S4-research-from-the-app.md#S4.4.7)).
- **From research 1.35.0:** a wait for images written otherwise (images only in words, several books, a book the
  research does not have) is not written by `strom task wait`, and `strom task audit` finds such tasks and fixes them
  ([R6.9](#R6.9)).
- **Since:** research 1.0.0. Waking after saving from 1.15.0.

<!-- zdroj: research:src/commands/tasks.ts:1000-1025 (--images, inbox) · src/commands/media.ts:135-170 wakeWaiting · assets/method/waiting.md · app:src/research-waiting.ts:251 waitingActions (folder) · src/ui/research-overview-ui.ts:1023, src/ui/waiting-task-ui.ts:231 · src/strings.ts waitingTask.openFolder -->

<a id="R6.2.2"></a>
### R6.2.2 A site to check

The task waits until a person looks at a page the agent does not open by itself. The answer is **It works – the book
and its images can be seen**, **Only to be viewed there** or **It does not work**, with an optional note.

- **Limits:** `--check` requires a search written in this session or at the task that names the same site. Only
  a person answers ([R6.6](#R6.6)). The item belongs among **decisions**, not among **web**.
- **Controls:** terminal: `strom task wait T… --check <address> --on "<what>"`; in **What waits** **What is
  there?**, `strom task wake T… --check=works|view|no`.
- **Since:** research 1.14.0

<!-- zdroj: research:src/commands/tasks.ts:439-470 checkUrl (task.check-search) · src/core/model.ts:510 CHECK_ANSWERS · src/core/waiting.ts:51-65 SECTION · src/cli/menu-waiting.ts:637 checkSite -->

<a id="R6.3"></a>
## R6.3 Decisions

The section **decisions** gathers the questions that hold the agent up: an archive's permission, downloaders to
confirm, milder terms, a site to check, a story, a place (see [R4](R4-places.md)), a conflict (see
[R5](R5-conflicts.md)), a hypothesis (see [R6.3.4](#R6.3.4)), trees from the app, the reading of scans and a proposed wording of a transcription (group **Transcripts to
decide**, see [R3.4.1](R3-verification-and-citation.md#R3.4.1)). Decisions come first in the list.

- **Controls:** terminal: **What waits** → the item; `strom allow archive --way`, `strom place answer`,
  `strom conflict resolve`, `strom media calibrate --answer`.
- **Since:** research 1.14.0. Conflicts from 1.20.0, places from 1.25.0, hypotheses from 1.28.0, transcriptions from 1.29.0.

<!-- zdroj: research:src/core/waiting.ts:51-65 SECTION, :75 DECIDE_RANK · src/cli/menu-waiting.ts:486 decideConflictHere, :518 decidePlace, :712 decideTune · CHANGELOG.cs.md 1.20.0, 1.25.0 · 1.29.0: src/core/waiting.ts:375-390 (kind transcript, section decide, wait.group.transcripts) -->

<a id="R6.3.1"></a>
### R6.3.1 An archive's permission

- Questions are in a group by archive, downloaders to approve in the group **Downloaders**. A task whose download ran
  into a question waits for the decision.
- The decision wakes the tasks waiting for this archive in all researches on the computer. With the choice **By hand
  only – the images are saved into a folder made ready**, tasks for images saved by hand go on waiting. A task
  **a site to check** never wakes.
- **Controls:** terminal: `strom allow archive --way`, the archives menu, the download window. App: a link to the
  terminal.
- **Since:** research 1.14.0

<!-- zdroj: research:src/core/archivewait.ts:188-215 wakeForArchive (way "manual", check :205), waitingForDecision · src/core/waiting.ts:303-340 · assets/lang/cs.json wait.group.takeover -->

<a id="R6.3.2"></a>
### R6.3.2 A story to approve

- The list holds only a new version of an already approved story, in the group **Stories**. The choice: **the new
  version, in place of the old one** or **keep the old one (the new version goes)**.
- **Controls:** app: **New version of the story**, **Compare**, the decision by a link to the terminal. Terminal:
  **Which story should the family book have?**, `strom story approve|discard`.
- **Since:** research 1.14.0
- **From research 1.26.0:** only a person decides; the research refuses the agent `strom story approve|discard`
  ([R6.6](#R6.6)).

<!-- zdroj: research:src/core/stories.ts:169 storiesToApprove · src/core/waiting.ts:369-390 · src/cli/menu-waiting.ts:686 decideStory · src/commands/story.ts:102-134 · app:src/ui/story-compare-ui.ts -->

<a id="R6.3.3"></a>
### R6.3.3 Branches off the lines

- A growing branch off the lines gets a question in the group **Branches off the lines**
  ([R2.3.2](R2-lines-and-queue.md#R2.3.2)): **Add to a line**, **Create a line**, **Leave it as it is**, **Do not
  research**.
- **Limits:** only a person answers ([R6.6](#R6.6)).
- **Controls:** terminal: **What waits** → the item, `strom offline answer`.
- **Since:** research 1.26.0

<!-- zdroj: research:HEAD src/core/waiting.ts:428-451 (group branches) · src/cli/menu-waiting.ts decideBranch · assets/lang/cs.json:2359 wait.group.branches -->

<a id="R6.3.4"></a>
### R6.3.4 Hypotheses to decide

- A hypothesis whose decision the agent proposed ([R10.3.1](R10-people-and-hypotheses.md#R10.3.1)) waits in the
  group **Hypotheses to decide**: the question, the versions and the proposal (“Proposed: variant B — …”). The
  choice: **Decide as proposed**, **Decide otherwise** (another version, or none, with a reason), **Leave it as it is
  (the proposal not taken)**.
- After the proposals, open hypotheses without a proposal wait. The choice: **Decide** (a version, or none, with the
  text of the decision), **Leave it open**. A hypothesis left open shows up in What waits again once the agent proposes
  how to decide it.
- A decided or abandoned hypothesis opened from the menu offers **Change the decision**: the new text of the decision
  is required and is also the reason for the change. When the agent decided it, it carries **Decided by the agent
  (day).**
- **Limits:** this applies when a person decides the hypotheses (the saved choice **The user decides**; without a
  saved choice the AI decides, [R10.3.2](R10-people-and-hypotheses.md#R10.3.2)); only a person decides ([R6.6](#R6.6)).
  When 10 or more open hypotheses wait, the app offers the switch to **The AI decides** in **What the research
  knows** (confirmed in the research). With **The AI decides** the
  agent decides itself what a cited record supports, and only its proposals wait (decisions it may not make itself).
  The Strom app that can decide hypotheses shows the group too ([S3.5.2](S3-what-the-research-knows.md#S3.5.2)); an
  older app does not get it ([R6.1.1](#R6.1.1)). In a Strom archive the group does not exist.
- **Controls:** terminal: **What waits** → the item, `strom hypothesis decide H… --proposed | --keep-open`. The same
  choices are in the person review: **Add to the research** → **Review one person** → **Hypotheses about the person
  (n)**.
- **Since:** research 1.28.0
- **From research 1.29.0:** also open hypotheses without a proposal (**Decide**, **Leave it open**), **Change the
  decision** and the choice **Who decides the hypotheses**.

<!-- zdroj: research:src/core/waiting.ts (kind hypothesis, section decide, DECIDE_RANK 0, open: priority -1 a hypothesesOpen jen při person, leftOpen, TERMINAL_ONLY hypotheses, actsAsArchive) · src/cli/menu-waiting.ts decideHypothesis (proposed / open / decided) · src/cli/menu-research.ts:532 · assets/lang/cs.json wait.group.hypotheses, ui.wait.hypothesis.proposed/accept/other/keep/decide/keepOpen/change/byAgent · CHANGELOG.cs.md 1.29.0 · src/cli/wizard.ts 5c (doporučení) · app:src/ui/person-research-ui.ts HYPOTHESES_OFFER_MIN -->

<a id="R6.4"></a>
## R6.4 Groups and order

Each item belongs to a group by the place where it is dealt with: an archive, an office, the family, the web or
other. The items of one group keep together at the place of their first item, so they can be dealt with in one
message.

- **Limits:** the order is set by these keys, each next one only when the previous ones are equal:
  1. **To do** before **Awaiting a reply**; items sent, the longest sent first;
  2. the section: decisions → images and web → archives and offices, family → other;
  3. within decisions: trees from the app and conflicts → an archive's permission → downloaders → milder terms →
     a site to check → stories and places (and branches) → the reading of scans;
  4. the task's priority, higher first;
  5. age, older first.
- The group of a task: the addressee `--to` (an office or archive of the research) → **Family** → the office from
  the letter → the archive or server from the site's address → the archive of the task's book → the archive by the
  address → the office → the server → **Other**. Fixed groups: **Stories**, **Downloaders**, **The Strom app**,
  **The reading of scans**, **Conflicts to decide**, **Places to identify**, **Branches off the lines**.
- **Controls:** app: **To do** / **Awaiting a reply**, the filter **Show by kind** (**Decisions**, **Images**,
  **Archives and offices**, **Family**, **Web**, **Other**) · terminal: in **What waits** the section's letter,
  `?` switches to **Waiting for a reply**.
- **Since:** research 1.14.0
- **From research 1.35.0:** the research sends with an item also its book. The app 3.30.0 can group the items by book
  ([S4.4.4](S4-research-from-the-app.md#S4.4.4)); **What waits** has an overview of the books with the most tasks
  ([R6.8](#R6.8)).

<!-- zdroj: research:src/core/waiting.ts:73 SECTION_RANK, :75 DECIDE_RANK, :468 together, :478-492 ordered · src/core/waitkind.ts:238 waitGroupOf · assets/lang/cs.json:2313-2320 wait.group.* (:2359) · src/cli/menu-waiting.ts:205-232 · app:strings.ts:11958 waitingFilterLabel -->

<a id="R6.5"></a>
## R6.5 What can be dealt with where

The app by itself writes only a fact: a request went out, it returns among what is to do, a file with the answer
came. Decisions and consents are taken only by the terminal; buttons that need them open the research's terminal on
the computer.

- **Limits:**
  - The app deals by itself with: **Sent** (also for a group), **Back to To do**, **Add a file** (images and PDF
    only), **All queries' text**, and the answer to a question about a place (the window **Awaiting action ·
    Places**).
  - By a link to the terminal: **Answer**, **Chat**, **Query text**, **Folder**, stories, an archive's permission.
  - On a narrow screen the app has no links and says **answered in the research on the computer**; questions about
    places can be answered there too.
- **Controls:** terminal: **What waits** → the group (**The text of all requests at once**, **Sent for the whole
  group**, **A conversation with the agent about the whole group**) or the item.
- **Since:** research 1.14.0 (app 3.11.0). Places from 1.25.0.

<!-- zdroj: research:src/core/live.ts:60-80 (POST /waiting, /group, PUT /media X-Strom-Task, POST /places/answer, /conflict 403), :2761 · src/core/waiting.ts:78-88 actionsOf · app:src/ui/research-overview-ui.ts · strings.ts:9972, :10078, :11953 -->

<a id="R6.6"></a>
## R6.6 What only a person may do

The agent does not write an answer for a person. When the agent runs a command reserved for a person, the research
asks the person in a system window, or refuses the command.

- **Limits:**
  - only a person: the answer to a waiting task, the answer to checking a site, an archive's permission, the answer
    to a question about reading scans and to a question about a place; the agent does not wake a task waiting for
    a site to be checked without an answer;
  - the agent approves a story and marks **Sent** only on a person's word; this is what the method says.
- **Controls:** terminal: **Answer in words** (at most 300 characters), `strom task wake T… --answer "<text>"`.
- **Since:** research 1.14.0. Places from 1.25.0.
- **From research 1.26.0:** also only a person: approving and discarding a story (`strom story approve|discard`; the
  research also refuses the agent `strom story set --final`), the answer to a growing branch (`strom offline
  answer`), leaving a conflict from an edit to the agent (`strom conflict leave`), undoing and discarding a send from
  the app (`strom sync undo|discard`) and the fixes `strom fixes … edit-decisions|woken-waits`.
- **From research 1.28.0:** only a person also decides a hypothesis (`strom hypothesis decide`, also inside
  `strom batch`); the agent only proposes it ([R10.3.1](R10-people-and-hypotheses.md#R10.3.1)).
- **From research 1.29.0:** this holds with **The user decides**; without a saved choice the AI decides
  ([R10.3.2](R10-people-and-hypotheses.md#R10.3.2)). Saving **The AI decides** where **The user decides** is saved, or
  removing that choice, only a person may do. Only a person also decides what to do next with a source read again
  (`strom source reading`, [R8.8.3](R8-reading-scans.md#R8.8.3)), and a proposed wording of a transcription they wrote
  or confirmed (`strom source proposal`, also undoing it, [R3.4.1](R3-verification-and-citation.md#R3.4.1)).
- **From research 1.35.0:** only a person also decides whether to take a participant's shorter note from the app
  (`strom sync note`, [S2.3.2](S2-edits-from-the-app.md#S2.3.2)); the agent only carries out the person's answer to
  that task.

<!-- zdroj: research:src/commands/tasks.ts:897-970 (requireHuman :941, task.check-person :932) · src/commands/archives.ts:586-645 · src/commands/calibrate.ts:320 · src/commands/placeid.ts:343 person · assets/method/waiting.md, narrate.md:26-31 · src/cli/menu-waiting.ts:45 ANSWER_MAX · 1.26.0: userOnly u story approve/discard, offline answer, conflict leave, sync undo/discard (commity 4683a22d, 1189532f, 942c56f9), fixes.ts edit-decisions/woken-waits (person at the terminal) · 1.28.0: analysis.ts hypothesis decide (person), batch.ts def.person (commit 9b12256a) · 1.29.0: setup.ts syncDecisions hypotheses.decide (requireHuman), config.ts hypothesesDecide výchozí agent; strom help source reading („The person's alone … an agent never decides it“), strom help source proposal („Only the person decides it“) · 1.35.0: research:fb94435f src/commands/sync.ts sync note (person, agentMay s odpovědí), src/core/shorternote.ts decideShorterNote (shorter.person) -->

<a id="R6.7"></a>
## R6.7 Sent, the answer and the return to the queue

A letter, a request to the family or another request moves to **Awaiting a reply** once sent. The answer returns
the task to the queue, and the agent deals with it in its next work.

- **Limits:** **Sent** is possible only for a waiting task of the kind letter, family or other. After 30 days
  without an answer the terminal says **no reply for over 30 days**.
- **Controls:** app: **Sent**, **Back to To do** · terminal: **Sent**, `strom task sent T…`, back `--undo`.
- **Since:** research 1.14.0

<!-- zdroj: research:src/commands/tasks.ts:1053-1118 task sent (task.not-waiting, task.not-sendable) · src/core/waitkind.ts:23 SENDABLE · src/cli/menu-waiting.ts:49 NO_REPLY_DAYS, :126 -->

<a id="R6.7.1"></a>
### R6.7.1 An answer as a file or in words

- **As a file:** the files become material of the task's people, and the task returns to the queue. No task for
  taking in material arises. A file cannot go to a task that is not waiting, or that waits for a site to be checked
  or for an archive's permission.
- **In words:** the answer is saved at the task together with the question, and the task returns to the queue. The
  research refuses `intake --text` with `--answers`: an answer in words is only a person's.
- **Controls:** app: **Add a file** · terminal: **Add a file**, **Answer in words**;
  `strom intake <file> --answers T…`, `strom task wake T… --answer "<text>"`.
- **Since:** research 1.3.0 (in words). As a file from 1.14.0.

<!-- zdroj: research:src/commands/intake.ts:164-205 (--answers) · src/core/taskfiles.ts fileRefused · src/commands/tasks.ts:969 answers · src/core/live.ts PUT /media X-Strom-Task -->

<a id="R6.7.2"></a>
### R6.7.2 When a task returns by itself, and parking

- A task returns by itself when the images of the book it waits for or names are saved into the research, or when
  the archive gets a decision ([R6.3.1](#R6.3.1)).
- A parked task is neither in the list nor in the queue. With the date `--until` it returns by itself and is open
  already on that day. Without a date it waits until someone wakes it. Parking requires a reason.
- **Controls:** terminal: `strom task park T… --reason "<why>" --until YYYY-MM-DD`, back `strom task wake T…`.
  App: the section **Queue**, **Park** (a link to the terminal, without a date).
- **Since:** research 1.0.0. The return after images from 1.15.0, after an archive's decision from 1.14.0.
- **From research 1.26.0:**
  - images return only a task that waits for images of exactly that book. A task waiting for a person to check a
    site they never return. A letter, a request to the family or a site is returned only by the book the task waits
    for, not by a book it only works in;
  - from research 1.27.0 a task waiting for a site (`--kind web`) is also returned by the one book it works in: the
    images saved there are what it waited for. A letter and a request to the family still only by the book they
    wait for;
  - from research 1.35.0 a task waiting for a site is returned, instead of by the one book it works in, by the book
    it waits under ([R6.8.4](#R6.8.4)). A task that waits without a book is returned only by the book it names;
  - tasks that images returned wrongly before are put back to waiting by the fix `strom fixes show|run|undo
    woken-waits`: the task waits as before, including the sending. A task worked on in the meantime stays. Only a
    person runs the fix in the terminal; it is not in a Strom archive. Until it has run, `strom check` points such
    tasks out.

<!-- zdroj: research:src/commands/media.ts:135-170 wakeWaiting (1.26.0: awaits jen ta kniha, check nikdy, letter/family/web jen waitingOn; 1.27.0: web i singleBook) · src/commands/fixes.ts:835 woken-waits (commit 740e1893) · src/core/archivewait.ts:188 wakeForArchive · src/commands/tasks.ts:880-895 task park · src/core/queue.ts:112 effectiveState · app:src/ui/research-ui.ts:3473-3500 -->

<a id="R6.8"></a>
## R6.8 Books with the most tasks

The research counts which books most of its tasks need. One download of a book by hand then serves all its tasks at
once. It is an offer, not an item that waits: it does not count into **Waiting: N**, and without a download the agent
goes on reading the book online.

- **Enforced by the code:**
  - the tasks counted are open (also in progress), parked and waiting. The book of a task is a book (B…) the task
    names in where it works, a book whose images it waits for, and at a waiting task the book the agent gave it
    (`--book`, [R6.8.4](#R6.8.4)). A task that names no book is not counted, and no book is guessed for it: the
    counts are a lower bound, not an estimate;
  - a book merged into another counts as that other one, a book retracted as none;
  - the order: the most tasks, on a tie the most waiting, then the book's number;
  - at a book: the archive, the years, the access, how many tasks need it (of these waiting and parked), images in
    total, on disk and missing (in total and missing only where the catalog knows the number of images), the images
    needed that are not on disk yet (the numbers its waiting tasks wait for), the folder in the shared folder and the
    book's address;
  - a book is **offered** for download when at least `books.minTasks` tasks need it (default 5, [R6.8.3](#R6.8.3)),
    the access is free or with a sign-in (`online-free`, `online-login`), it is not whole on disk and there is
    something to offer: the whole book where the archive's terms allow it, otherwise the images needed that are not
    on disk yet ([R6.8.1](#R6.8.1)). A book from which the terms allow downloading nothing is never offered;
  - a Strom archive offers no books ([R7.8](R7-when-the-agent-works.md#R7.8)).
- **The agent at a task:** at the start of a task the agent learns which other tasks need the same book, so as to do
  them together: in the brief at the book and in `strom task show` the line "the same book is needed by N more tasks:
  …". Open ones first, then waiting and parked, at most 10 task numbers, the rest as a count.
- **Controls:** terminal:
  - `strom task books`: the books offered; `--min <n>` another threshold only for this listing (1–999), `--all` every
    book some task needs, `--json`;
  - `strom task list --book B…`: the tasks of one book, open ones first, then parked and waiting; with `--state` only
    the tasks in that state;
  - the menu **What waits**: the key **b** "books with the most tasks N"; when nothing waits, the books show under
    **Nothing waits.** The screen shows at most 9 books, the others `strom task books`.

  App: Awaiting action, groups by book and **Faster by downloading**
  ([S4.4.4](S4-research-from-the-app.md#S4.4.4), [S4.4.5](S4-research-from-the-app.md#S4.4.5)).
- **Why:** images belong to a book, not to a task: one folder and one download serve all the tasks of the book.
- **Since:** research 1.35.0

<!-- zdroj: research:c533bc0e, 198eed31, b1749433 src/core/books.ts needsBooks (open, doing, parked, waiting; ne proposal ani shorterNote), liveBook (mergedInto, retracted), booksOfTask (where B…, awaits.recordset), bookRows (registered, missing jen s images, need = awaits.images bez registrovaných, řazení tasks ↓, waiting ↓, id), offerable (minTasks, DOWNLOADABLE online-free/online-login, missing !== 0, whole nebo range/selected s needCount), tasksOfBook (open, parked, waiting), sameBookLine (SAME_BOOK_IDS_MAX 10) · src/brief/brief.ts sameBookLine u knihy (ne u odhadnutého místa) · src/commands/tasks.ts task books (--min 1–999, --all, --json), task list --book (task.book), taskDetail řádek book · src/cli/menu-waiting.ts booksHere (actsAsArchive → žádné), showBooks (BOOKS_SHOWN 9), ui.wait.c.books · src/cli/menu.ts (Nic nečeká → showBooks) · assets/lang/cs.json ui.wait.c.books, ui.books.* · CHANGELOG.cs.md 1.35.0 „Knihy s nejvíc úkoly“ · dirigent:spec/105-co-nejvic-pomuze K1.1–K1.3 -->

<a id="R6.8.1"></a>
### R6.8.1 What can be downloaded from a book: the archive's terms

What the research offers from a book is set by the archive's terms. The list of archives the tree keeps states at an
archive what a person may download from a book by hand, with a word-for-word quotation of the terms, their page or a
written answer of the archive.

- **Enforced by the code:**

  | The archive's terms | What is offered |
  |---|---|
  | the archive offers the whole book (a button, a ZIP) or its terms allow downloading it | the whole book |
  | only selected images, never the whole book or a substantial part of it | only the images needed that are not on disk |
  | nothing | nothing, the book is not offered |
  | the list does not know the archive | the images needed that are not on disk |

  - the book's address decides, otherwise the address of its archive;
  - only tasks that wait for images know which images are needed. A book without a waiting task is therefore not
    offered, except at archives that allow the whole book.
- **Examples from the list:** the whole book: eBadatelna SOA Praha (registered users may download) and other
  archives whose terms allow it; only selected images: DigiArchiv SOA Třeboň (a written answer of the
  archive); nothing: FamilySearch, Archion. Moravský zemský archiv has no entry in
  the list (the word-for-word quotation is missing): the images needed are offered
  ([R9.10.1](R9-archives.md#R9.10.1)).
- **Limits:** the archive's terms come before the offer. The app and the terminal offer the whole book only when the
  terms say so.
- **Controls:** terminal: `strom task books --json` (the field `download`: `whole`, `range`, `selected`, `none`, and
  the quotation `downloadTerms`). App: "Whole book can be downloaded", "Images … can be downloaded", "Selected images
  … can be downloaded" ([S4.4.4](S4-research-from-the-app.md#S4.4.4)).
- **Since:** research 1.35.0

<!-- zdroj: research:b1749433 assets/archives.json wholeBook {how offered|allowed|selected|never, says, from terms|termsPage|reply} (ebadatelna.soapraha.cz offered termsPage; digi.ceskearchivy.cz, www.ceskearchivy.cz selected reply; aron./imgx.vychodoceskearchivy.cz, vychodoceskearchivy.cz, www.landesarchiv-nrw.de, apertus.rlp.de allowed terms; agad.gov.pl, agadd*.home.net.pl allowed reply; familysearch.org, www.archion.de never; mza.cz bez wholeBook) · src/core/terms.ts wholeBookFor · src/core/books.ts downloadOf (b.url, jinak repo.url; bez údaje range), offerable · karta prace/1116-vyzkum-105-knihy-a (V4: čísla snímků znají jen čekající úkoly), -b (MZA bez citace, range) · spec 105 rozhodnutí U1 -->

<a id="R6.8.2"></a>
### R6.8.2 Images saved to the book's folder

Images a person saves into a book's folder in the shared folder are taken in by strom by itself, even when no task
waits for the book. They belong to the book, and all its tasks then read them from disk.

- **Enforced by the code:**
  - the folder is the same as when waiting for images, `inbox/<B… book title>` ([R9.6](R9-archives.md#R9.6)). It is
    created by the link **Open folder** in the app, without a terminal; the bridge watches only folders that already
    exist;
  - taking in: at once while the bridge to the Strom app runs (a file only after 3 s without a change); otherwise at
    the start of the next session; or by the command `strom media add --inbox --waiting`. The folders of waiting
    tasks first, then the folders of books;
  - the number of an image is taken **only from the file name** (`40.jpg`), never from the order. A file without a
    number stays lying in the folder, and the listing says how many stayed; the others are taken in. When no file
    has a number, nothing is taken in and the research says how to name the files;
  - JPEG 2000 files (`.jp2`) from the portal of Moravský zemský archiv have the image × 10 in their name: strom
    counts them back. A number that is not a multiple of 10 is not an image number, and the file stays lying;
  - a book that is whole on disk disappears from the offer. Files that lie in the folder and have not been taken in
    yet the app shows as "N files to be taken in";
  - a copy made by the file manager ("33 2.jpg", "33 kopie.jpg") is image 33, and a file that is the same scan as an
    image under another number is put aside as `<file>.same-as-M…` and reported, never silently deleted; the same as
    in the folder of a waiting task ([R9.6](R9-archives.md#R9.6)).
- **Limits:** the folders of waiting tasks follow [R9.6](R9-archives.md#R9.6) (there files named otherwise are also
  numbered by their order).
- **Controls:** terminal: `strom media add --inbox --waiting`, the folder in `strom task books`. App: **Open folder**
  at the book ([S4.4.4](S4-research-from-the-app.md#S4.4.4)).
- **Since:** research 1.35.0

<!-- zdroj: research:b1749433 src/core/inboxwait.ts bookFolders (knihy, které úkoly potřebují, bez čekající složky; nic se nevytváří), imageFileTimesOf (assets/archives.json mza.cz imageFileTimes 10) · edfd2b88 numberBookFiles (jen čísla ze jmen, .jp2 ÷ times, nenásobek → bez čísla, left; žádné číslo → inbox.unnamed), src/commands/media.ts (po čekajících složky knih, book: true, „N file(s) left lying“), src/core/live.ts (live.log) · src/core/inboxwatch.ts (most hlídá i složky knih) · src/commands/links.ts book?tree=&id=&do=folder (mkdir, openForUser, bez terminálu) · src/core/live.ts booksStatus pending · CHANGELOG.cs.md 1.35.0 „Snímky uložené do složky knihy“ · karta prace/1116-vyzkum-105-knihy-c · research:dddeb8a6 numberBookFiles stem = copyless(f), takeFiles same-as (i u knih: asideLine(b, …)) · 18fd10ec -->

<a id="R6.8.3"></a>
### R6.8.3 The books' settings

From how many tasks a book is offered, and whether the queue goes on in the same book, each research has its own.

- **Enforced by the code:**
  - `books.minTasks`: from how many tasks a book is offered ([R6.8](#R6.8)). A whole number from 1 to 999, default 5;
  - `queue.sameBook`: `no` (default: the agent only gets a sentence about the other tasks of the book) or `yes` (after
    a session in a book with images on disk the queue takes the next task of the same book first,
    [R2.2.4](R2-lines-and-queue.md#R2.2.4));
  - a change in the terminal shows in the app and the other way round (the app writes through the bridge with the same
    commands).
- **Controls:** terminal: `strom config set books.minTasks <1–999> --for-tree`,
  `strom config set queue.sameBook yes|no --for-tree`, the default value `strom config unset … --for-tree`; the menu
  **Settings › Archives › Books with the most tasks** (**A book offered to download by hand from N tasks**, **The next
  session in the same book**). App: **Research for this tree › Books** ([S4.4.6](S4-research-from-the-app.md#S4.4.6)).
- **Since:** research 1.35.0

<!-- zdroj: research:b1749433 src/core/config.ts BOOKS_MIN_TASKS 5, BOOKS_MIN_TASKS_MAX 999, SETTINGS books.minTasks, queue.sameBook (tree, no|yes), validace „whole number from 1 to 999“ · src/cli/menu-settings.ts booksSettings (1 ui.books.min, 2 ui.books.same), položka Archivy ui.archives.books (poslední) · src/core/live.ts POST /books (config set/unset --for-tree), booksSettings · assets/lang/cs.json ui.books.settings.title, ui.books.min, ui.books.same · CHANGELOG.cs.md 1.35.0 „Knihy v aplikaci Strom a jejich nastavení“ -->

<a id="R6.8.4"></a>
### R6.8.4 Which book a task waits under

A waiting task belongs under the book that has to be searched, not under the book in which the agent found the trail
(a note in a register of births that leads to the marriages of another parish). The Strom app shows it under that
book in the groups by book ([S4.4.4](S4-research-from-the-app.md#S4.4.4)), and images for a task waiting for a site
are saved into that book's folder.

- **Enforced by the code:** the book of a waiting task, in this order:
  1. the task waits for images with numbers (`--images`): the book of those images;
  2. the book the agent gave the task (`strom task wait|edit --book B…`);
  3. the only book whose number (B…) stands in the text of what the task waits for and that is not among the books
     the task works in. With more numbers: the next points hold;
  4. the task waits for a site or for a check of a site (`--kind web`, `--check`), works in one book and besides it
     names in free text a place or a book that is still to be found: **no book** (in the app under **No book**).
     Record numbers (B…, R…) do not count as free text;
  5. otherwise the only book the task works in; none or more: no book.
- **What it governs:**
  - the book of the item in the Strom app and the counts of books ([R6.8](#R6.8); the book from `--book` is counted
    besides the book the task works in);
  - a task waiting for a site: its folder in the shared folder (in **What waits** **Open the folder**, in the app the
    block **Deliver**, [S4.4.7](S4-research-from-the-app.md#S4.4.7)) and the task's return after images are saved
    into it ([R6.7.2](#R6.7.2)). A task without a book has no folder, and the folder of the book in which the trail
    was found is not offered to it.
- **Limits:**
  - only for waiting tasks. The queue, open and parked tasks stay at the book the task works in;
  - nothing is rewritten: points 3–5 are worked out when reading, the text of the wait and people's answers do not
    change;
  - `--book` only at a waiting task and only with a live book (an unknown or retracted one is an error). With
    `--images` only the same book as for the images, another is an error. A new setting of the wait clears `--book`
    ([R6.2](#R6.2)). An older strom leaves the field be.
- **The agent at a task:** `strom task show` shows the line `book B… — the book to be searched`. When a task waiting
  for a site or for a check of a site has no book, the output of `strom task wait` tells the agent how to give it one
  once it is created (`strom recordset add`, then `strom task edit T… --book B…`).
- **Method only:** the agent's guide: the book to be searched, not the one in which the trail was found: `--book B…`.
- **Why:** better no book than someone else's.
- **Controls:** terminal: `strom task wait T… --kind web --book B… --on "<what>"`, `strom task edit T… --book B…`,
  `strom task show T…`. App: **Awaiting action**, groups by book
  ([S4.4.4](S4-research-from-the-app.md#S4.4.4)).
- **Since:** research 1.35.0

<!-- zdroj: research:8d19d4f6 src/core/books.ts waitTarget (jen waiting bez awaits: wait.book → jediné živé B… ve waitingOn mimo where (BOOK_ID_IN) → null pro web/check s jednou knihou ve where a volným textem (RECORD_ID) → undefined), bookOfTask (awaits → waitTarget → jediná kniha where), booksOfTask (+ wait.book u waiting) · src/core/inboxwait.ts webWaitBook, inboxWaitOf (web) · src/commands/media.ts wakeWaiting (web: named || webWaitBook) · src/core/waiting.ts:441 book · src/core/live.ts:2180 · src/commands/tasks.ts waitOptions --book (requireRecord recordset, liveBook → chyba vzatá zpět, s --images jen táž kniha), task edit (jen waiting, task.not-waiting), taskDetail řádek book, task wait řádek pro web/check bez knihy · src/core/model.ts wait.book · assets/method/core.md (locate, request) „The book to search, not the one the trail was found in: `--book B…`.“ · CHANGELOG.cs.md 1.35.0 „Čekající úkol pod knihou, kterou je třeba prohledat“ · dirigent:prace/1117-vyzkum-kniha-cile (Návrh A–F, „lepší žádná kniha než cizí“), 1117-research-kniha-cile -->

<a id="R6.9"></a>
## R6.9 Checking how waits are written: `strom task audit`

A task waiting for images that a person saves by hand comes back to the queue by itself only when its wait is written
the way strom needs it: images of one book of the research by number (`--images B…:<numbers>`), or by book
(`--kind web --book B…`). One book per task; the book is in the research (B…) and has a folder in the shared
folder. `strom task audit` finds waiting tasks written otherwise and gives a fix for each.

- **Enforced by the code:**
  - checked are waiting tasks that are not retracted, do not wait for a check or a permission and do not wait for a
    letter, the family or something else;
  - findings:

    | Code | What is wrong |
    |---|---|
    | `images-as-text` | a book's images are only in words, without the book and numbers; also a wait by book whose text names exact image numbers of that book |
    | `several-books` | one wait wants images of two or more books |
    | `book-unknown` | a book the research does not have (B…) |
    | `folder-missing` | the task lacks its folder in the shared folder; only when the wait does not change otherwise |

  - an estimate (“≈ img. 160”, “about”, “approx.”) is not an image number. Words for images are recognised in Czech,
    German, English and Polish;
  - each finding has the fix strom proposes: whole (`whole`), partial (`part`) or none (`none`, the agent writes the
    fix), and the exact commands ([R6.9.1](#R6.9.1));
  - reads only, free, no network. A task whose wait a person left as it is is not listed ([R6.9.1](#R6.9.1)).
- **The agent at a task:** the agent is told the finding when it writes the wait, and strom does not write such a
  wait ([R6.9.2](#R6.9.2)).
- **Controls:** terminal:
  - `strom task audit`: all waiting tasks with a finding; at the end a checklist for waits (`each wait: …`). Without
    a finding “every waiting task's wait is as strom needs it”;
  - `strom task audit T…`: one task; `--all` also the tasks a person left as they are; `--json`.

  App: the mark and the fix in **Awaiting action** ([S4.4.8](S4-research-from-the-app.md#S4.4.8)).
- **Since:** research 1.35.0

<!-- zdroj: research:61c95c53, 1fe47bf3, 15312d00, 6775c199 src/core/taskaudit.ts audited (waiting, ne retracted, awaitsCheck, awaitsPermission, ne letter/family/other), findingsOf (images-as-text, several-books, book-unknown, folder-missing jen se sdílenou schránkou a bez jiného přepisu), fixOf (can whole/part/none), odhad ≈/asi/cca není číslo, slova snímků cs/de/en/pl, WAIT_CHECKLIST · src/commands/tasks.ts task audit (--all, --json, „every waiting task's wait is as strom needs it“, each wait: checklist) · strom help task audit („Reads only, free, no network.“) · CHANGELOG.cs.md 1.35.0 · app:docs/ZADANI_VYZKUM_kontrola-ukolu.md „Odpověď výzkumu (U2)“ · dirigent:spec/109 K1.3 -->

<a id="R6.9.1"></a>
### R6.9.1 The fix in one step and the way back

The fix is written in one operation and can be taken back as long as nothing of it has changed. What a person wants
to leave as it is can be left.

- **Enforced by the code:**
  - `--fix` (operation `task.audit-fix`, one commit): the task waits for images of one book, by number, otherwise by
    book. Each further book gets its own task with the same what, why and done when, split off from the original. The
    wait's text is divided so that no word is lost: the heading of a list goes with each task, the conclusion and the
    parts without a book stay with the original, a book's item stays whole;
  - a book the research does not have stays a wait in words in its own task: first the book
    (`strom recordset add`), then `--images`. When all books are unknown, strom changes nothing and the agent writes
    the fix;
  - the fix creates the folders and takes the images that already lie in them: a task that has all its images comes
    back to the queue;
  - `--expect <stamp>`: writes only a task that is the same as when the fix was proposed, otherwise refuses
    (`audit.changed`). A task that no longer waits, or a fix without a change, is refused (`audit.none`);
  - `--unfix` (operation `task.audit-unfix`) takes the fix back as long as none of its tasks has changed, otherwise
    `audit.changed`. The split-off tasks are retracted (never deleted), the original task waits exactly as before.
    Saved images stay registered;
  - `--keep` (operation `task.audit-keep`): a person leaves the wait as it is. Only a person; for the agent strom
    refuses `--keep` and `--unkeep` (`audit.person-only`). It holds as long as the wait does not change and new
    findings are among those the person left. Who gave it and where (terminal or app) is written. `--unkeep`
    (operation `task.audit-unkeep`) takes it back.
- **Task history:** `strom task show T…` shows the line “audit  kept as it is …” or “fixed by the audit … (T… split
  off) — undone by strom task audit T… --unfix”.
- **App:** the bridge gives at a waiting item the finding (`audit`: kinds, fix, stamp), the preview of the fix
  (`GET <token>/waiting/<T…>/fix`) and the write (`POST <token>/waiting/<T…>` with `do: fix|unfix|keep|unkeep` and
  `expect`), feature `tasks.audit`. This holds in a Strom archive too
  ([S4.4.8](S4-research-from-the-app.md#S4.4.8), [S4.4.9](S4-research-from-the-app.md#S4.4.9)).
- **Controls:** terminal: `strom task audit T… --fix`, `--unfix`, `--keep`, `--unkeep`, `--expect <stamp>`,
  `--dry-run`. App: **Fix**, **Undo** in the notice, **Leave as is**.
- **Since:** research 1.35.0

<!-- zdroj: research:61c95c53, 15312d00, 6775c199 src/core/taskaudit.ts fixOf (wait-images / wait-book, split, left book-unknown, jen neznámé → nic), applyAuditFix (atomicky, expect → audit.changed, bez změn audit.none, before, rozdělení textu, splitFrom, op task.audit-fix), takeWaiting, sealAuditFix, undoAuditFix (audit.changed, dropped + retracted, original přesně, snímky zůstanou, op task.audit-unfix), keepAudit (auditKept at, by, givenIn, kinds, wait; podmnožina druhů; op task.audit-keep / task.audit-unkeep) · src/commands/tasks.ts task audit (--fix, --unfix, --keep, --unkeep, --expect jen s fix/keep, audit.person-only, STROM_FOR_APP → by app), task show řádky audit · strom help task audit · app:docs/ZADANI_VYZKUM_kontrola-ukolu.md „Odpověď výzkumu (U2)“ (most, kódy 409/404/503/423/507, i v archivu) · dirigent:spec/109 K1.5 -->

<a id="R6.9.2"></a>
### R6.9.2 A wait is not written wrongly, and the agent learns of it

Strom does not write a wait with a finding and tells the agent what about the task is not yet as it should be.

- **Enforced by the code:**
  - `strom task wait` and `strom task edit` with `--on`, `--kind`, `--url` or `--book` refuse a wait with a finding
    (`task.wait-images`) and give the exact commands. A missing folder is not refused;
  - after `strom task wait` the agent gets the line “check the task's wait: …” with a checklist when the wait is not
    yet as it should be. `strom task park` whose reason names images of a book of the research tells the agent that
    images saved by hand are a wait, not a postponement, with the exact command;
  - `strom session close` says the same for the session's tasks (`--json`: `audit`); `strom session finish` does not;
  - `strom chat --task T…` at a task with a finding begins for the agent with the sentence “Its wait is not written
    the way strom needs it (…). Run `strom task audit T…`, suggest the fix to me and write it only once I agree to it
    here.”
- **Limits:** the agent writes the fix only after the person agrees in the conversation. Only a person may leave a
  wait as it is ([R6.9.1](#R6.9.1)).
- **Controls:** terminal: `strom task wait`, `strom task edit`, `strom task park`, `strom session close`,
  `strom chat --task T…`. App: **Discuss with the agent** at a finding ([S4.4.8](S4-research-from-the-app.md#S4.4.8)).
- **Since:** research 1.35.0

<!-- zdroj: research:61c95c53, 15312d00 src/core/taskaudit.ts refuseWait (task.wait-images, kromě folder-missing, waitCommands), WAIT_CHECKLIST · src/commands/tasks.ts checkWaitLine, parkedForImages · src/commands/session.ts:373 session close (check of each wait, --json audit) · assets/lang/cs.json ui.chat.task.audit.say, ui.chat.task.audit.images/books/unknown/folder.say · CHANGELOG.cs.md 1.35.0 · app:docs/ZADANI_VYZKUM_kontrola-ukolu.md „Odpověď výzkumu (U2)“ K1.1, K1.2, V11 · dirigent:spec/109 K1.1, K1.2 -->
