<a id="R11"></a>
# R11 Material from the user

What the research does with the files, texts and family trees the user gives it: in the terminal, or from the Strom
app. How material is sent from the app is described in [A3.5](A3-evidence-in-the-app.md#A3.5); answering a waiting
task with a file in [R6.7.1](R6-awaiting-action.md#R6.7.1). Describes the research 1.27.0; changes from a newer version
carry its number. Each rule says what is **enforced by the code** and what is only a **rule of the method**.

<a id="R11.1"></a>
## R11.1 Every file is material with a task

Every file is stored in the research unchanged as material and gets a material task. The agent records from it only
what really stands in it.

- **Enforced by the code:**
  - the same file a second time is skipped (it is recognised by its content, not by its name);
  - files up to 20 MB are in the tree and in its history, larger ones in the shared media store;
  - a folder with more than 20 images is taken as the scans of a book, not as family documents (`--documents` says the
    opposite);
  - a family tree has its own task; the other files of one folder have one shared task;
  - a material task never waits outside the queue ([R2.2.3](R2-lines-and-queue.md#R2.2.3)). In a Strom archive it is
    kept for later ([R7.8](R7-when-the-agent-works.md#R7.8)).
- **Method only:** names and places are recorded as they are written; only dates are standardised. The task is closed
  with what came out of the material and with further tasks: where to look for records that would prove the leads.
- **Why:**
  - 20 images: the scans of a register do not belong in the tree's history as hundreds of material tasks. The family
    documents of one folder are usually a handful to a few dozen files; more than 20 images are usually the scans of
    a book and are recorded as a book;
  - 20 MB: the tree's history is never rewritten and goes with the tree in backups and transfers. Large files (video,
    uncompressed scans) would enlarge it for good, so they lie in the shared media store.
- **Controls:** terminal: `strom intake <files or folders>`, `strom intake --text "…"` (what the user says),
  `strom input list`, `strom input show I…`. App: **Send material…**, **Add materials…**
  ([A3.5](A3-evidence-in-the-app.md#A3.5)).
- **Since:** research 1.0.0
- **From research 1.36.0:** a file gets a material task only with `intake.auto` switched on or with `--sort`;
  otherwise it waits in Materials unsorted ([R11.6](#R11.6)). A text (`--text`) always gets a task.

<!-- zdroj: research:src/commands/intake.ts intake (description, BOOK_OF_SCANS=20, sha256 known, intakeTask) · research:src/core/media.ts MAX_IN_TREE=20 MB · research 1.0.0 = commit 48698860 · research:assets/method/intake.md kroky 1, 4, 6, 7 -->

<a id="R11.2"></a>
## R11.2 A document is a source, the rest is a lead

Material can become a source that proves facts, or only a lead that says where to look. What decides is what kind of
document it is, not who sent it.

- **Method only:**
  - an official or church document (a birth, marriage or death certificate, a register extract, military papers) is
    a source (`--form original`; `--information primary` when it was written at the time of the event);
  - a photo, a letter, a family tree and a memory are an author's work or a derivative source: what comes from them
    stays a **Lead**;
  - what the user says is a family memory (`--kind family-memory --form authored --information secondary`);
  - several facts from one piece of material are recorded in one batch (`strom batch`): all or nothing.
- **Enforced by the code:** a fact only from a memory, a family tree or an author's work is never Probable or Proven
  ([R3.2](R3-verification-and-citation.md#R3.2)).
- **Controls:** terminal: `strom source add "…" --input I… --form … --information …`.
- **Since:** research 1.0.0

<!-- zdroj: research:assets/method/intake.md krok 2 · research:src/core (weak sources: family-tree, family-memory, authored) -->

<a id="R11.3"></a>
## R11.3 An imported family tree

A family tree (GEDCOM or a Strom app file) is someone else's conclusions, not a record. The research takes it over
whole, but only as leads.

- **Enforced by the code:**
  - the family tree is loaded at once when it is taken over: every person and every fact as a **Lead**, citing one
    source of the kind family tree (`--kind family-tree`, `--form authored`). Every person remembers where it came
    from;
  - persons of this research's tree that come back from a Strom app file are matched by their number in the research
    and are not created a second time. Numbers of another research are never matched;
  - `--no-import` only stores the family tree and does not load it.
- **Method only:**
  - duplicates and impossible dates are checked, but not “corrected” from memory; they are leads;
  - a person of the family tree who is already researched in the research is merged **into** the researched person,
    their parents first ([R10.2](R10-people-and-hypotheses.md#R10.2)). The researched person keeps their documents;
  - where the family tree differs stays a lead or becomes a conflict; never a fact.
- **Controls:** terminal: `strom intake rodokmen.ged`. Loading a family tree into the app is described in
  [A2](A2-loading-a-family-tree.md).
- **Since:** research 1.0.0
- **From research 1.30.0:**
  - each fact has an origin (from the family tree, from a person, from the research). The agent changes a fact from
    the family tree only with a cited record, otherwise it proposes; a person's fact it only proposes. The value from
    the family tree stays stored and only a person may revert it (`strom event revert`, `strom person revert`)
    ([S6.3](S6-tree-from-another-program.md#S6.3)). A value from a Strom app file that nobody has changed since it was
    taken in is from the user's own family tree: protected like a person's fact, but it does not count as confirmed
    by a person;
  - program IDs (`_UID`, `EXID`, `_FSFTID` …) are kept: the same family tree taken over again adds nobody twice;
    a person who is only possibly the same is not joined and the result names them (`candidates`); what was not taken
    over the result counts (`notTaken`) ([S6.8](S6-tree-from-another-program.md#S6.8));
  - a file in Windows-1250 or Windows-1252 (“ANSI”) is read with the right letters;
  - the family tree's source has no page (`PAGE`): each fact gives its own line from the family tree;
  - research set up earlier is marked once after the update (`strom fixes undo origins` takes it back).
- **From research 1.32.0:**
  - a tree from the Strom app gives the same from a JSON file and from GEDCOM. Also taken over are a shared event of
    several people with each person's role ([A10.1](A10-shared-events.md#A10.1)), the own events **Godparent** and
    **Wedding witness** named in the research's language (from a GEDCOM file since research 1.34.0, before by the file's TYPE in the language the app ran in), with a reference to the baptism or marriage
    ([A10.5.1](A10-shared-events.md#A10.5.1)), godparents, witnesses, officiants and the midwife at a person's events
    (linked to a person and by name only), marriage witnesses and other events of a couple with participants and
    a note. The research keeps them at each fact and gives them back to the app as they came;
  - from a JSON file also taken over are the cause and age of death, the address of birth and death, the address and
    ages at a marriage, a child's relationship to each parent, a divorce and a separation with a date, the couple's
    note, a person's age at a shared census, a family of one parent only and the married surname. Placeholder
    persons (“?”) are left out;
  - an event's note is taken over whole. The note of a person and a family from the user's tree is not shortened to
    500 characters; the limit of 500 characters holds for notes written by the research and the agent;
  - a participant's `ROLE` as in GEDCOM 7 is read in another program's file too;
  - a midwife goes to the app as **Present** with the note “midwife”.
- **From research 1.36.0:** in the file for the Strom app each citation of a family tree without a location of its
  own has its own line of the family tree as the page (`PAGE`), so the app shows each citation's line. A pointer that
  an import or a sync wrote ("I1 BIRT", "BIRT DATE PLAC", "family") and a citation without a line get no `PAGE`. The
  line also stays in `DATA` › `TEXT`. A family tree given back by the app unchanged is no edit of the user and nothing
  is cited twice; a line changed in the app is the user's edit as at any source.

<!-- zdroj: research:src/core/import.ts hlavička ("as LEADS", oursByRefn), source kind family-tree form authored :113-117, status lead :294 · research:src/commands/intake.ts --no-import · research:assets/method/intake.md krok 5 · research:94d75934 src/core/import.ts (soubor aplikace Strom → origin user + tree), src/core/model.ts ValueOrigin.tree · 1.32.0: research:ac489205 src/core/import.ts importStromJson (godparent/weddingWitness → EVEN v jazyce výzkumu s roleAt, participants, partnerships[].participants, shareId/shareRole), src/core/roles.ts, src/gedcom/export.ts (porodní bába RELA Present + poznámka), celá poznámka události · research:f8eb2032 Note.whole, makeNote 500, factDetails, partnersAges, childRelation · research:01125661 appNobody, appMarriedName, appUnionFacts, appLooseFamilies · research:CHANGELOG 1.32.0 „Events shared in the Strom app“ · src/core/live.ts BRIDGE_FEATURES event.share · dirigent:prace/1113-vyzkum-085-json, 1113-vyzkum-json-intake-uplny, 1113-vyzkum-json-intake-drobnosti Výsledek · 1.34.0: research:aa0d53d5 src/core/import.ts gedRoleEventLabel (B6) · 1.36.0: research:519951b3 src/gedcom/export.ts stromPage (family-tree: PAGE = locator citace, ne treePointer), citation where (DATA TEXT i vedle PAGE), src/core/sourcefields.ts treePointer · test/cli/origin-ids.test.ts · CHANGELOG.cs.md 1.36.0 -->

<a id="R11.4"></a>
## R11.4 A batch from the app

A folder, a ZIP or a box of documents sent from the app is received by the research as one batch. The agent then
sorts it by tasks.

- **Enforced by the code:**
  - a batch is closed when the app reports that it is complete, or a day after the last file (a batch from a phone
    an hour after the last photo, [S5.4](S5-phone.md#S5.4));
  - then it becomes material tasks of about 25 files each, by the folders the files came in. In a Strom archive the
    tasks wait, kept for later;
  - the files of a batch are stored as originals in the shared media store, not in the tree's history. What the agent
    does not record from them stays private;
  - a file marked as unrelated (`--as unrelated`) needs a reason. It is skipped and nothing from it is recorded.
- **Method only:**
  - the agent first looks cheaply through all files of the task (previews in a grid) and sorts each one at once:
    a record (source), a document, a photo, unrelated, and whose it is. It reads in depth only what belongs to the
    research's people;
  - nothing is recorded about a living person; the file is only sorted;
  - the scans of one book (many numbered images) are not read file by file: they are recorded as a book, and entries
    are read from it as from any book ([R8](R8-reading-scans.md));
  - the task is closed once each of its files is sorted; a further part of the batch is a task of its own.
- **Why:**
  - a day after the last file: the app sends files one by one. A batch nobody said is complete is closed with what
    came, so that nothing waits longer; a day without another file means the sending has ended. A phone's page is
    easily closed without handing the batch over, so an hour is enough there;
  - 25 files: one material task is read by one agent session, and about 25 files fit into it;
  - a file's path in a batch says a lot (`Babička/Dopisy/1946.jpg`); what does not belong to the family should not get
    into the tree (the method).
- **Controls:** terminal: `strom input batch` (batches and how much is sorted), `strom input sort I… --as
  source|document|photo|unrelated --person P…`. App: **Add materials…** in the research menu.
- **Since:** research 1.12.0; a batch from a phone 1.18.0
- **From research 1.36.0:** sorting tasks arise only with `intake.auto` switched on, or when a person asks for the
  batch to be sorted; otherwise the batch is closed without tasks and the files wait in Materials unsorted
  ([R11.6](#R11.6)).

<!-- zdroj: research:src/core/batches.ts hlavička, BATCH_TASK_FILES=25 (od v1.12.0), BATCH_IDLE_MS, PHONE_BATCH_IDLE_MS (od v1.18.0) · research:src/commands/intake.ts input batch done (--idle), input sort (unrelated --reason) · research:assets/method/intake.md "A batch from the Strom app" -->

<a id="R11.5"></a>
## R11.5 The research's material and the tree's files from the app

Every file the research holds is a material record (`I…`): a file sent at a person, a file of a batch, a file from
the terminal and a file of the tree from the Strom app. The record has a title, kind and date, the people it belongs
to, and for a file of the tree also its places in the app's tree.

- The kind is `photo`, `document`, `record` or `other` (in the app **Photo**, **Document**, **Record**, **Other**).
  The research remembers who gave the title: a person (the app, the terminal), or the research.
- A hidden file (`unrelated`, `duplicate`, without a reason) stays in the research with its original and can be shown
  again.
- **Enforced by the code:**
  - hiding, removing from the tree or undoing a writing does not delete a file: the original and the record stay.
    Only `strom input delete` deletes, with the person's consent ([R11.5.6](#R11.5.6));
  - an edit of the title, kind and date of a file outside the tree is written by the research at once. For a file of
    the tree the change shows in the app with the next loading of the tree;
  - the research refuses the whole edit when it does not know one of the files or cannot read a value
    ([R11.5.2](#R11.5.2)).
- **Limits:** records with places in the tree are in tree schema 3 (from the research 1.35.0). The move rewrites
  nothing; an older `strom` does not open a tree in schema 3. Material in the app is described in
  [A3.5](A3-evidence-in-the-app.md#A3.5).
- **Controls:** terminal: `strom input list`, `strom input show I…` (where the file is and what came from it), `strom
  input edit`, `strom input assign`, `strom input hide`, `strom input unskip`, `strom input delete`, `strom
  material`. App: the window **Materials**.
- **Since:** research 1.35.0

<!-- zdroj: research:0cc2cfca src/commands/intake.ts input delete · research:2aeeb228 src/core/model.ts SCHEMA_VERSION 3, Input (origin, working, orient, titled, materialKind, families, links), MEDIA_ORIGINS, LINK_TYPES, MATERIAL_KINDS, LINK_RETRACTIONS, HIDE_REASONS · src/core/material.ts hideMaterial, unhideMaterial, editMaterial, MATERIAL_MOST_EDIT, MATERIAL_TITLE_MAX · research:c9a4b614 CHANGELOG.cs.md 1.35.0 · help input, material -->

<a id="R11.5.1"></a>
### R11.5.1 The tree's files from the app

The research 1.35.0 also holds the portraits, couples' photos and attachments of the tree from the Strom app. It
stores each file once, by its content, and remembers its places in the tree: an attachment or portrait of a person,
an attachment or photo of a couple, a file of an event, the evidence of a source.

- A file whose original came earlier (`PUT /media`) the research recognises by the original's fingerprint; otherwise
  by the fingerprint of the bytes sent. The reduced copy the app shows it stores unchanged beside the original.
- A new portrait replaces the old one: the old one stays as an older version (the place withdrawn with the reason
  `replaced`).
- A record is **in the tree** as long as it has at least one place that is not withdrawn.
- **Enforced by the code:**
  - the research writes a removal in the app only when the writing carries all the tree's files (`media=app`), and
    only against what the app received with its files. What another window added it does not remove;
  - a removed file stays in the material, hidden with the reason **Removed from the tree**. Shown again, it gets back
    the places the last writing took from it;
  - `strom sync undo I…` also restores the places the writing removed;
  - to the app a file is returned by its fingerprint (`GET /tree.ged?images=ref&media=app`), only files with a place
    in the tree. The crop of a portrait in the original photo is not returned, the portrait is
    ([S8.3](S8-where-the-data-are.md#S8.3)).
- **Limits:** a research that does not hold the tree's files (up to 1.34) does none of this; the app then counts the
  photos and attachments as only in the browser ([S8.4](S8-where-the-data-are.md#S8.4)).
- **Controls:** app: writing the tree ([S2](S2-edits-from-the-app.md)), **Remove from the tree…** and **Restore** in
  the window **Materials**; terminal: `strom sync undo I…`, `strom input unskip I…`.
- **Since:** research 1.35.0

<!-- zdroj: research:2aeeb228 · src/core/appmedia.ts (hlavička: soubor jednou podle otisku, keepBytes, MediaReader) · src/core/treemedia.ts (návrat GET /tree.ged?images=ref&media=app, POST /images, GET /image/<sha>) · research:91ab6230 (odebrání jen se všemi soubory, proti základu media=app, sync undo, restoreTakenOff) · research:d5e99375, 815bc90d, 7d7628eb · src/core/material.ts unhideMaterial (spec 102 M3) · dirigent:spec/108-kde-se-co-uklada K2.3 (photoSource se nevrací) -->

<a id="R11.5.2"></a>
### R11.5.2 Title, kind, date and people from the terminal

The title, kind and date of a file are set by `strom input edit`, the people by `strom input assign`. Both apply to
the research's material and to the tree's files from the app; the app gets them with the next tree file.

- `strom input edit I… --title … --kind photo|document|record|other --date …`: at most 500 files, a title at most 200
  characters, a date as in GEDCOM (`1932`, `ABT 1930`, `12 MAY 1932`); `""` removes the value. The answer gives what
  each file had before (`was`): the same edit with these values reverts it. More files with `--files-from`.
- `strom input assign` adds (`--add P…`) or removes (`--remove P…`) people of files or of whole batches (`--batch`).
  For a file of the tree an added person is a new place: in the app an attachment of the person.
- `strom input hide I… --why unrelated|duplicate` hides a file; `strom input unskip I…` shows it again.
- **Enforced by the code:** all or nothing: an unknown file, a title too long, an unreadable kind or date and nothing
  is written. `--dry-run` only shows what would change.
- **Controls:** terminal, see above. The window **Materials** in the app does the same through the bridge.
- **Since:** research 1.20.0 (`strom input assign`, `hide`, `unskip`); 1.35.0: `strom input edit`, places of the
  tree's files

<!-- zdroj: research:a7df632d src/commands/intake.ts input edit, assign, hide, unskip · src/core/material.ts checkEdit, editMaterial, MATERIAL_MOST_EDIT=500, MATERIAL_TITLE_MAX=200, assignMaterial (místo u souboru stromu, spec 102 M4) · research:cc709045 příklady v helpu · help input edit, input assign, input hide -->

<a id="R11.5.3"></a>
### R11.5.3 Sorting material: `strom material sort`

`strom material sort` has the research's readers read the material's files. For each file they propose a title, date,
kind and links to people, couples, their events and the tree's sources, with a reason and a certainty. Nothing is
written to the research.

- The proposal is stored beside the research (`strom material show <id>`). What a person accepts from it is written
  as theirs: in the app, or with `strom input edit`.
- `--text` is what a person knows about the files; the readers follow it where the files do not say otherwise.
- `--queue` only puts the sorting into the queue; `strom material cancel <id>` stops it.
- **Enforced by the code:**
  - at most 50 files and 2000 characters of text; from a PDF the first 10 pages. A file no reader opens is judged by
    its name, path and notes;
  - it never proposes a title, kind or date a person gave, a link a person gave or removed, or an ID the research
    does not have. It proposes neither a portrait nor a couple's photo;
  - paid readings start only after a person's consent: in their own terminal (Enter is no) or in a system window.
    When there is no one to ask, the command ends with code 4. The agent never answers for the person;
  - the bridge starts a sorting from the app only with its own signature, and it is good once. A record that only
    pretends to be a sorting from the app never starts;
  - at most 3 sortings wait in the queue.
- **From research 1.35.0:**
  - a text file (.txt, .md, .markdown, .text or the type text/plain or markdown) is read by the reader as text and
    judged by what it says: at most the first 20 000 characters. With a longer one the reader knows it got only the
    beginning and how large the file is. Text in UTF-8, or in UTF-16 with a byte order mark; otherwise it is read as
    windows-1252;
  - during the sorting `strom material show` tells how many files the readers have already judged ("N of M files
    done"); the app shows "k of n" from it;
  - in a finished sorting every file without a proposal has a reason: the reader said nothing about it, the file
    already has everything proposed, the proposal could not be used, the agent left the file out, or the file could
    not be read (with the reader's outcome). What the reader wrote about the file stands at the reason.
  - a file plainly not about the family (a screenshot, a receipt, a file sent by mistake) the reader marks
    `unrelated: yes`, with a reason and a certainty. The reader's instruction: only a file plainly outside the family,
    never a file it merely cannot place. The research proposes no title, date, kind or link for such a file (what the
    reader wrote anyway is dropped). `strom material show` says "unrelated (not of the family)" at it. The research
    never hides or deletes the file by itself; only a person hides it: in the app
    ([A3.5.9](A3-evidence-in-the-app.md#A3.5.9)), in the terminal `strom input hide I… --why unrelated`;
  - the reader may also say which of the sent files is the back of another photo or page (the link `back` to the
    `I…` of a file the same reader got: one back to one front, never a back of a back nor a text file) and which
    image is a person's portrait (the link `portrait` to one `P…`; only an image, not a portrait the person removed,
    and not a file that already is the portrait);
  - more than 50 files can be sorted only by the app, as a run in batches ([R11.5.5](#R11.5.5)).
- **Limits:** only a research with an agent: the Strom archive and a research waiting for an agent do not sort
  material.
- **Controls:** terminal: `strom material sort I… [--text …] [--queue]`, `strom material show`, `strom material
  cancel`; app: **Sort with the agent…** ([A3.5.8](A3-evidence-in-the-app.md#A3.5.8)).
- **Since:** research 1.35.0

<!-- zdroj: research:acb5d1ce src/core/sort.ts SORT_MOST_FILES=50, SORT_TEXT_MAX=2000, SORT_QUEUE_MAX=3, SORT_PDF_PAGES=10, SORT_FILES_PER_READING=10, typy vazeb person/family/event/source · research:0cc2cfca src/core/sort.ts SORT_LINK_TYPES back, portrait · research:d667304d (souhlas člověka, exit 4) · research:2978645b, 19e525e5, 5b76fb43 (podpis mostu APP_SORT_FROM, platí jednou) · src/commands/material.ts · help material sort · research:ae866bb7 src/core/sort.ts SORT_TEXT_FILE_MAX=20_000, SORT_TEXT_TYPES, isTextFile, textOfFile (UTF-8 / UTF-16 BOM, jinak windows-1252; cut), řádek „read as text (only its first … characters: the file is … KB)“, unproposedOf (nothing-said, nothing-new, dropped, left-out, reader-failed + outcome; said) · src/commands/material.ts filesDone (+ group.length po čtenáři), show „N of M files done“, „no proposal: why (outcome)“ · research:f36b3941 (ve vydání 1.35.0) src/core/sort.ts pokyn čtenáři „unrelated: yes“ (jen soubor zjevně mimo rodinu, nikdy jen nezařazený), YES, keptProposals (unrelated: jen why a sure, ostatní dropped „unrelated“) · src/commands/material.ts show „· unrelated (not of the family)“ · src/core/live.ts GET /material/sort/<id> unrelated?: true („the person hides it, never strom“) · CHANGELOG.md 1.35.0 -->

<a id="R11.5.4"></a>
### R11.5.4 Material through the bridge

The window **Materials** in the app reads and changes material through the research's bridge. Each change is the same
command as in the terminal, with the same limits.

| Bridge | What it does | Command |
|---|---|---|
| `GET /material` | files with title, kind, date, people, for the tree's files their places and for each its uses; the file of a source (`uses.of`), what the agent left unassigned (`left`), the same content (`sameAs`) | |
| `GET /material/<I…>/uses` | excerpts, sources and tasks that use the file | |
| `POST /material/assign` | people of files | `strom input assign` |
| `POST /material/hide` | hide and show again (for a removed file of the tree with its places) | `strom input hide`, `unskip` |
| `POST /material/edit` | title, kind and date, 1–500 files | `strom input edit` |
| `POST /material/sort` | sorting 1–50 files; progress `GET /material/sort/<id>`, cancelling `…/cancel` | `strom material sort` |
| `POST /material/sort` (51–1,500) | a run in batches ([R11.5.5](#R11.5.5)); progress `GET /material/sort/<run-…>`, cancelling `…/<run-…>/cancel` | |
| `POST /material/delete` | delete 1–500 files permanently: first `dryRun` (the list and a confirmation), then with the confirmation | `strom input delete` |

- The research announces what it can in `/status.features`: `media.app`, `material.links`, `material.edit`,
  `material.uses` and `material.sort` (only where there is an agent). Without them the app behaves as with an older
  research.
- **From research 1.35.0:** also `material.sourceOf`, `material.left`, `material.sameAs`, `material.sortRun` and
  `material.delete`. Deleting refuses a changed list (`material.delete-changed` with the new list), a missing or old
  confirmation (`material.body`) and a writing that did not come from the app.
- **Enforced by the code:** an edit is whole or none; a busy research answers that it changed nothing. Sorting is
  refused without an agent, with the reading limit used up, with a full queue and when the agent cannot work now.
- **Controls:** app: the window **Materials**, with the bridge running ([S1.1](S1-connecting-app-and-research.md#S1.1)).
- **Since:** research 1.35.0

<!-- zdroj: research:0cc2cfca src/core/live.ts (GET /material uses.of, left {at, sort, why, said}, sameAs; POST /material/sort run 51–1500, GET/POST /material/sort/<run-…>[/cancel]; POST /material/delete dryRun → impacts + confirm, chyby material.delete-changed, material.body, material.file, material.readonly, material.busy, app.only; BRIDGE_FEATURES material.sourceOf, left, sameAs, sortRun, delete) · research:src/core/live.ts:134-160 (GET /material, /material/<I…>/uses, POST /material/assign|hide|edit|sort, chyby material.body|date|file|readonly|busy) · src/core/live-sort.ts (sort.none, sort.limit, sort.queue, sort.not-ready) · research:a7df632d, 87376d11, 7754968e -->

<a id="R11.5.5"></a>
### R11.5.5 A sorting run from the app

The app can have 51 to 1,500 files sorted as one run (`run-…`). The research splits it into batches of 50 and sorts
them one after another while the bridge runs. The proposal of each finished batch is available at once.

- Each batch is a sorting of its own with its own proposal; it carries which run it belongs to and its number.
- In the queue (at most 3 sortings) a run counts as one.
- **The app's readings:** the first batch is counted when the research takes the run; the next ones when they
  start. When the app's reading limit does not let a batch go, the run waits and tries again by itself
  (`material.sort-waiting`).
- A batch that fails does not stop the other batches. `strom material show run-…` says the state of the run, how
  many files are done and its batches. `strom material cancel run-…` stops the batch at work, cancels the waiting
  ones and keeps the finished ones with their proposals.
- **Enforced by the code:** only the app starts a run, through the bridge; an agent never starts a run, and
  `strom material sort` from the terminal takes at most 50 files ([R11.5.3](#R11.5.3)).
- **Limits:** only a research with an agent and with `material.sortRun` ([R11.5.4](#R11.5.4)); an older research
  takes one batch from the app.
- **Controls:** app: **Sort with the agent…** ([A3.5.12](A3-evidence-in-the-app.md#A3.5.12)); terminal:
  `strom material show run-…`, `strom material cancel run-…`.
- **Since:** research 1.35.0

<!-- zdroj: research:0cc2cfca src/core/sort.ts SORT_RUN_MOST_FILES=1500, SORT_QUEUE_MAX=3 (běh jako jedna položka), run/part/parts, první dávka započtená při přijetí, další při startu podle read.app, jinak čeká a zkusí znovu; selhaná dávka nezastaví další · src/core/live-sort.ts, src/core/live.ts POST /material/sort (51–1500 → 202 {state queued, run}), GET /material/sort/<run-…>, POST …/<run-…>/cancel · src/commands/material.ts show run-… („N of M files done“, dávky), cancel run-…, material.sort-waiting · CHANGELOG.md 1.35.0 -->

<a id="R11.5.6"></a>
### R11.5.6 Delete permanently: `strom input delete`

`strom input delete I…` deletes files of the material for good. Only a person may do it: in the terminal with their
consent, or in the app through **Delete permanently…** ([A3.5.16](A3-evidence-in-the-app.md#A3.5.16)).

- For each file its record is taken back, together with its places in the app's tree. A source made of it keeps
  its text and citations, only without the link to the file. A task holding the file lets it go; a task with no
  other files is given up.
- The file's content (the original, the working copy, the previews) goes only when no other file of the research
  and no other research on this computer has the same content. Then the images of sources with the same content and
  their excerpts go too; a source loses the image, never its text.
- `--dry-run` says all of it, file by file (`--json`: `impacts`). Many files: `--files-from <file>` (one ID a line,
  `-` is the standard input).
- `strom input show I…` says of a deleted file that the person deleted it for good; `strom input list` does not
  show it. The same content brought again is new material.
- **Enforced by the code:**
  - all or nothing: a file the research does not have, and nothing is deleted; at most 500 files;
  - without `--dry-run` the person says yes in their own terminal (Enter says no), else in a window of the system;
    when there is nobody to ask, the command ends with code 4;
  - an agent never runs it nor offers it; with the app's confirmation it is refused (`material.agent`);
  - the app's confirmation holds only for the list the person saw in the app and for at most 15 minutes. A changed
    list (`material.delete-changed`) or an old confirmation deletes nothing;
  - when another research on this computer cannot be read (a newer `strom`'s), the content stays stored.
- **Limits:** it cannot be undone in the Strom app; a file stays only in a backup (`strom backup`) or a pack made
  before. The research's history keeps the record.
- **From research 1.36.0:** a family tree file (an imported GEDCOM, the app's JSON file) is deleted the same way.
  When a source was made of it and that source still stands, the command ends (`material.source-live`): the file can
  be deleted only together with that source, `--retract-sources S…`. The source is deleted first, as with `strom
  source retract` ([R3.10](R3-verification-and-citation.md#R3.10)); one yes is enough for both and everything is
  written in one commit. The source can be restored afterwards, but without the file.
- **Controls:** terminal: `strom input delete I… [--dry-run] [--files-from …] [--retract-sources S…]`; app:
  **Delete permanently…** through the bridge (`POST /material/delete`, [R11.5.4](#R11.5.4)).
- **Since:** research 1.35.0

<!-- zdroj: research:0cc2cfca src/commands/intake.ts input delete (popis, --files-from, skrytý --confirm, isAgent → material.agent, checkDeleteConfirm → material.delete-changed, material.body, souhlas člověka, exit 4) · src/core/materialdelete.ts (hlavička: historie drží záznam, bajty jen v záloze nebo balíčku; DELETE_MOST_FILES=MATERIAL_MOST_EDIT=500, DELETE_CONFIRM_MS 15 min; nečitelný jiný výzkum → nic se nesmaže) · input show („deleted for good“), input list bez smazaných · CHANGELOG.md 1.35.0 · 1.36.0: e6bbfb40 src/commands/intake.ts input delete (--retract-sources, material.source-live, jeden commit), ui.input.delete.retracted · src/core/live.ts POST /material/delete {files, confirm, sources} -->

<a id="R11.6"></a>
## R11.6 Sent files are gone through by the agent only once switched on

A file sent to the research does not start the agent's work by itself. It is stored and waits in Materials unsorted
until a person asks for sorting, or switches on in the research's settings that the agent goes through sent files by
itself (`intake.auto`).

- **Enforced by the code:**
  - `intake.auto` is off by default, also in researches created earlier; nothing is converted and nothing is asked;
  - off: a closed batch (the app, a phone, closing a day after the last file) makes no sorting tasks. No task arises
    either for a single file from the app (a person's material, a scan of a source, the original of a portrait or of
    a union's photo from the tree's record, [S8.3](S8-where-the-data-are.md#S8.3)), for a file sent again with
    a further person or note, for a file shown again, for a supplemented input or for the files of `strom intake`;
  - on: as before. A batch gives sorting tasks of about 25 files each, which go first in the queue
    ([R11.4](#R11.4)), a file its material task ([R11.1](#R11.1)), a scan of a source a task to read it;
  - a task always arises from an explicit action of a person: **Sort with the agent…** ([R11.5.3](#R11.5.3)),
    `--sort`, a file as the answer to a waiting task ([R6.7.1](R6-awaiting-action.md#R6.7.1)), **Read a document…**,
    and a text (`strom intake --text`), which is what a person says;
  - only a person may switch it on: in the terminal, in the menu, or in the Strom app. Switching it on is refused to
    the agent. Anyone may switch it off. Sorting tasks that have already arisen stay after it is switched off;
  - the setting applies to one research (`--for-tree`), or to all researches on the computer.
- **Why:** sorting uses the AI subscription and changes the tree (it attaches files to people, names them, records
  sources). Uploading a file alone must not start AI work; the family's documents need a person's consent.
- **In the app:** the switch in the research's settings ([S4.4.11](S4-research-from-the-app.md#S4.4.11)), the end of
  sending a batch and **Send material…** ([A3.5](A3-evidence-in-the-app.md#A3.5)).
- **Controls:** terminal: `strom config set intake.auto on|off --for-tree`; the menu **Settings** → “Files sent to the
  research gone through by the agent by themselves: off”; `strom intake <files> --sort` (the agent goes through the
  files at once); the menu **Material from the family** asks “Have the agent go through it (tasks for the agent, using
  the AI plan)?” (default no); `strom input batch done <batch> --sort` (sort a batch closed without tasks). Bridge:
  `POST /intake {auto}`, `POST /batch/<id>/done` with `sort`.
- **Since:** research 1.36.0

<!-- zdroj: research:da86bbe7, 90f33705 src/core/config.ts:400 intake.auto (tree: true, off|on, výchozí off), :962 intakeAuto · src/commands/setup.ts:1311, :1655-1673 intakeDecision (requireHuman, STROM_FOR_APP bez agenta, off kdokoli) · src/commands/intake.ts:202-225 (--sort, --text vždy úkol), :829-848 input batch done --sort/--no-sort · src/cli/menu-research.ts:110-125 (ui.intake.sort.ask, výchozí ne; ui.intake.done.waits) · src/cli/menu-settings.ts:98, :247-250 · src/core/live.ts:6693 POST /intake, BRIDGE_FEATURES intake.auto · cs.json ui.settings.intake(.about, .on, .off), ui.intake.sort.ask, ui.intake.done.waits · CHANGELOG.cs.md 1.36.0 · dirigent:spec/130 K1.1–K1.3, K2.1, K3.1, K4.1, rozhodnutí 21. 11. · app:docs/ZADANI_VYZKUM_trideni-davek.md (Most, Doplněk K1.3) · app:strings.ts read.menu (položka menu s „…“, titulek read.title bez) · dirigent:prace/1122-app-nalezy-330 -->
