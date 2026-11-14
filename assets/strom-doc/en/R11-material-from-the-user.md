<a id="R11"></a>
# R11 Material from the user

What the research does with the files, texts and family trees the user gives it: in the terminal, or from the Strom
app. How material is sent from the app is described in [A3.5](A3-evidence-in-the-app.md#A3.5); answering a waiting
task with a file in [R6.7.1](R6-awaiting-action.md#R6.7.1). Describes the research 1.27.0. Each rule says what is
**enforced by the code** and what is only a **rule of the method**.

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
- **Controls:** terminal: `strom intake <soubory nebo složky>`, `strom intake --text "…"` (what the user says),
  `strom input list`, `strom input show I…`. App: **Send material…**, **Add materials…**
  ([A3.5](A3-evidence-in-the-app.md#A3.5)).
- **Since:** research 1.0.0

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
    **Wedding witness** named in the research's language, with a reference to the baptism or marriage
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

<!-- zdroj: research:src/core/import.ts hlavička ("as LEADS", oursByRefn), source kind family-tree form authored :113-117, status lead :294 · research:src/commands/intake.ts --no-import · research:assets/method/intake.md krok 5 · research:94d75934 src/core/import.ts (soubor aplikace Strom → origin user + tree), src/core/model.ts ValueOrigin.tree · 1.32.0: research:ac489205 src/core/import.ts importStromJson (godparent/weddingWitness → EVEN v jazyce výzkumu s roleAt, participants, partnerships[].participants, shareId/shareRole), src/core/roles.ts, src/gedcom/export.ts (porodní bába RELA Present + poznámka), celá poznámka události · research:f8eb2032 Note.whole, makeNote 500, factDetails, partnersAges, childRelation · research:01125661 appNobody, appMarriedName, appUnionFacts, appLooseFamilies · research:CHANGELOG 1.32.0 „Events shared in the Strom app“ · src/core/live.ts BRIDGE_FEATURES event.share · dirigent:prace/1113-vyzkum-085-json, 1113-vyzkum-json-intake-uplny, 1113-vyzkum-json-intake-drobnosti Výsledek -->

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

<!-- zdroj: research:src/core/batches.ts hlavička, BATCH_TASK_FILES=25 (od v1.12.0), BATCH_IDLE_MS, PHONE_BATCH_IDLE_MS (od v1.18.0) · research:src/commands/intake.ts input batch done (--idle), input sort (unrelated --reason) · research:assets/method/intake.md "A batch from the Strom app" -->
