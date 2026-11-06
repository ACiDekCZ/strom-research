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
- Only in the terminal are trees sent from the app (**The Strom app**), questions about reading scans (**The reading
  of scans**), conflicts (**Conflicts to decide**, see [R5](R5-conflicts.md)), hypotheses to decide (from research 1.28.0) and
  milder terms of an archive. In the
  overview **What waits** they come first under the heading **Only here in the terminal (not in the Strom app)**,
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
[R5](R5-conflicts.md)), a hypothesis (see [R6.3.4](#R6.3.4)), trees from the app and the reading of scans. Decisions come first in the list.

- **Controls:** terminal: **What waits** → the item; `strom allow archive --way`, `strom place answer`,
  `strom conflict resolve`, `strom media calibrate --answer`.
- **Since:** research 1.14.0. Conflicts from 1.20.0, places from 1.25.0, hypotheses from 1.28.0.

<!-- zdroj: research:src/core/waiting.ts:51-65 SECTION, :75 DECIDE_RANK · src/cli/menu-waiting.ts:486 decideConflictHere, :518 decidePlace, :712 decideTune · CHANGELOG.cs.md 1.20.0, 1.25.0 -->

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
- **Limits:** this applies when a person decides the hypotheses (**The user decides**, the default;
  [R10.3.2](R10-people-and-hypotheses.md#R10.3.2)); only a person decides ([R6.6](#R6.6)). With **The AI decides** the
  agent decides itself what a cited record supports, and only its proposals wait (decisions it may not make itself).
  The group is only in the terminal; the Strom app does not show it ([R6.1.1](#R6.1.1)). In a Strom archive the group
  does not exist.
- **Controls:** terminal: **What waits** → the item, `strom hypothesis decide H… --proposed | --keep-open`. The same
  choices are in the person review: **Add to the research** → **Review one person** → **Hypotheses about the person
  (n)**.
- **Since:** research 1.28.0
- **From research 1.29.0:** also open hypotheses without a proposal (**Decide**, **Leave it open**), **Change the
  decision** and the choice **Who decides the hypotheses**.

<!-- zdroj: research:src/core/waiting.ts (kind hypothesis, section decide, DECIDE_RANK 0, open: priority -1 a hypothesesOpen jen při person, leftOpen, TERMINAL_ONLY hypotheses, actsAsArchive) · src/cli/menu-waiting.ts decideHypothesis (proposed / open / decided) · src/cli/menu-research.ts:532 · assets/lang/cs.json wait.group.hypotheses, ui.wait.hypothesis.proposed/accept/other/keep/decide/keepOpen/change/byAgent · CHANGELOG.cs.md 1.29.0 -->

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

<!-- zdroj: research:src/commands/tasks.ts:897-970 (requireHuman :941, task.check-person :932) · src/commands/archives.ts:586-645 · src/commands/calibrate.ts:320 · src/commands/placeid.ts:343 person · assets/method/waiting.md, narrate.md:26-31 · src/cli/menu-waiting.ts:45 ANSWER_MAX · 1.26.0: userOnly u story approve/discard, offline answer, conflict leave, sync undo/discard (commity 4683a22d, 1189532f, 942c56f9), fixes.ts edit-decisions/woken-waits (person at the terminal) · 1.28.0: analysis.ts hypothesis decide (person), batch.ts def.person (commit 9b12256a) -->

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
  - tasks that images returned wrongly before are put back to waiting by the fix `strom fixes show|run|undo
    woken-waits`: the task waits as before, including the sending. A task worked on in the meantime stays. Only a
    person runs the fix in the terminal; it is not in a Strom archive. Until it has run, `strom check` points such
    tasks out.

<!-- zdroj: research:src/commands/media.ts:135-170 wakeWaiting (1.26.0: awaits jen ta kniha, check nikdy, letter/family/web jen waitingOn; 1.27.0: web i singleBook) · src/commands/fixes.ts:835 woken-waits (commit 740e1893) · src/core/archivewait.ts:188 wakeForArchive · src/commands/tasks.ts:880-895 task park · src/core/queue.ts:112 effectiveState · app:src/ui/research-ui.ts:3473-3500 -->
