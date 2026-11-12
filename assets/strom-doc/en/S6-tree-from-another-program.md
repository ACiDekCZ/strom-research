<a id="S6"></a>
# S6 A tree from another program

A family tree from another program (MyHeritage, Gramps, FamilySearch, Windows programs and others) comes into the app
and into the research as a GEDCOM file. The chapter follows the whole path: what loads and what is lost, how it shows
where a fact comes from, why the family tree's facts are only leads, how to go back to a fact from the family tree,
what the card **What next** offers, how to go back in time, how to send the tree back and what a family tree loaded
again does. Describes the Strom app 3.26.0 and the research 1.30.0. The details of reading the file are in
[A2](A2-loading-a-family-tree.md), the export in [A7](A7-book-pages-and-export.md), merging in
[A8](A8-merging-trees.md) and the research taking over a family tree in [R11.3](R11-material-from-the-user.md#R11.3).

A file written by Strom itself (the header `1 SOUR STROM`) and the app's JSON file are not a family tree from another
program: they have no origin mark, no card **What next** and no protection of the family tree's facts. Research that
takes in such a file has its values as the user's family tree ([S6.3](#S6.3)).

<!-- zdroj: dirigent:spec/066-import-ged-a-ai/spec.md (rozhodnutí: GED s 1 SOUR STROM není import) · app:1c9b2392 src/ui/import-next-ui.ts, src/reliability.ts · research:v1.30.0 CHANGELOG.cs.md 1.30.0 -->

<a id="S6.1"></a>
## S6.1 What loads from a family tree and what is lost

The app takes over the people, families, sources, notes, events and media it knows, and in addition the IDs the
program gave to people and families. What it does not take over it counts and shows in the import summary; nothing is
lost silently.

| Program or file | What loads | What is not carried over or only counted |
|---|---|---|
| MyHeritage | people and families with program IDs (`_UID`, `RIN`) and the original record identifier (`@I12@`); photos from standalone media records (`0 @O1@ OBJE`) through the references to them; the program's own tags (`_XXX`) directly on a person, family and source are kept for the export back | photo cutouts (`_POSITION`, `_CUTOUT`) are bookkeeping and are not counted; deeper own tags are counted; a family photo through a standalone media record is only counted |
| FamilySearch | people with a FamilySearch ID (`_FSFTID`, or `EXID` with the address familysearch.org) | as above |
| Gramps | people with the original record identifier (`@I0001@`) and `RIN` when the file has them | Gramps gives no ID by which a person could be recognised with certainty (`_UID` is missing): a file loaded again is paired mainly by names and dates ([S6.7](#S6.7)) |
| Windows programs | text in the Windows-1250 (Central Europe) and Windows-1252 (Western Europe) encodings with the right letters; with a guessed or single-byte encoding and text with diacritics, the row **Text encoding** with a sample of names and a choice of another encoding ([A2.2](A2-loading-a-family-tree.md#A2.2)) | – |
| GEDCOM 7 | `UID`, `EXID` as a person's ID | a GEDZIP package is not loaded |

- **Enforced by the code:**
  - the IDs of a person and a family (`_UID`, `UID`, `RIN`, `EXID`, `_FSFTID`, `AFN`) and the original record
    identifier are kept and come back in the export ([S6.6](#S6.6)) and into the research;
  - the import summary has the line “Kept for the export “Back to {program}”: N tags (…)” when the file has the
    program's own tags.
- **Limits:** photos the file only references by a path or an address are not in the file: the summary offers
  **Attach media files…** ([A2.1.1](A2-loading-a-family-tree.md#A2.1.1)).
- **Controls:** **Import → Import GEDCOM**; the import summary (the window **GEDCOM conversion**).
- **Since:** app 3.26.0 (IDs, media records, own tags, the Windows-1250 encoding), research 1.30.0

<!-- zdroj: app:1c9b2392 src/ged-parser.ts (původní ID, OBJE přes odkazy, _XXX úrovně 1, výřezy MyHeritage evidenční), docs/GEDCOM-IMPORT.md (kódování) · strings.ts gedcom.keptTags, encodingLabel, encodingSample, attachMedia · dirigent:prace/1108-app-066-u8/karta.md Výsledek (f9735c6a, d2551dbc, 281e19e1; FAM se podle ID nepárují; fotka rodiny přes OBJE jen spočítaná) · prace/1108-app-066-u1u2 · research:v1.30.0 src/core/import.ts candidates, notTaken -->

<a id="S6.2"></a>
## S6.2 Reliability marks: where a fact comes from

Each fact of a person has a mark of how reliable it is: who confirmed or proved it, or that it came from another
program's family tree and nobody has verified it yet. The steps differ by dots, a tick and a frame, never by colour
alone.

| Mark | Meaning (the label on hover) |
|---|---|
| **Confirmed** (✓) | **Confirmed by a person**: a person confirmed, entered or reverted the fact, or accepted a proposal of the research |
| **Proven** (full dots) | the fact is proven ([R3.1](R3-verification-and-citation.md#R3.1)); two full dots only with two readers of the record agreeing ([S7.1](S7-reliability-and-verification.md#S7.1)) |
| **From family tree** (empty dots) | “From the family tree (unverified): taken from {program}, file {date}” |

Other facts show the research's degree of certainty ([R3.1](R3-verification-and-citation.md#R3.1)). All the marks, the
mark on the card in the tree and verifying facts against the originals are described in
[S7](S7-reliability-and-verification.md).

- **Enforced by the code:**
  - the mark **From family tree** holds while the fact has the value from the file. An edit ends the mark; for a fact
    changed in part it says which part is from the family tree and which a person changed;
  - for a tree linked to the research ([S1](S1-connecting-app-and-research.md)) the app takes the fact's origin from
    the research; otherwise from the app's record of the import;
  - a tree without a record of the import (an older import, Strom's file) does not show the mark **From family
    tree**: nothing is guessed;
  - in a research tree, a fact the research took in from a family tree from the Strom app and nobody has changed since
    has the mark of its degree of certainty, without a degree **From family tree**; never ✓
    ([S6.3](S6-tree-from-another-program.md#S6.3));
  - a line at the person says where the facts come from: “All of this person's facts come from {program} (file {date},
    loaded {date}).”, or “Facts marked “from family tree” come from …”.
- **Limits:** that a fact has no source the app does not yet show at the fact: there is no mark **No source** at a
  fact ([S7.1](S7-reliability-and-verification.md#S7.1)).
- **Controls:** the person card (the mark at the fact, **What the marks mean**); **Settings → Person card →
  Reliability at facts in the person card** (on by default) and **Show on card → Sources and reliability** (on by
  default; the card shows the weakest of the facts name, birth, death,
  [S7.2](S7-reliability-and-verification.md#S7.2)).
- **From app 3.26.0:** two full dots at **Proven** go to a fact for which two readers of the record agreed when the
  research verified it; the card in the tree has one mark instead of the earlier two settings.
- **Since:** app 3.26.0, research 1.30.0

<!-- zdroj: app:7b0471f8 src/reliability.ts (pořadí human, proven, probable, possible, import, lead, none; tečky, ✓ a rámeček, ne barva; feature origin; bez záznamu o importu žádné Z rodokmenu; readers z _STROM_CHECKED, noSource nekrmeno) · src/ui/fact-status.ts · src/ui/person-reliability-ui.ts · src/settings.ts display.reliabilityCard (ON) · src/ui/card-signals-ui.ts (signál status, výchozí zapnuto) · index.html settings-group-card · strings.ts reliability.settingCard, cardDensity.cardStatus, settings.groupCard · app:669c08f0 src/reliability.ts userTreeOrigin (_STROM_ORIGIN tree) -->

<a id="S6.3"></a>
## S6.3 Facts from a family tree are leads: the agent proposes, a person decides

Another program's family tree holds someone else's conclusions. The research takes its facts as leads: it changes
them only by a record it cites, otherwise it only proposes the change. What a person entered or changed, in the Strom
app or in the research, the agent never changes: it only proposes.

- **Enforced by the code:**
  - each fact in the research has an origin: from the family tree, from a person, or from the research;
  - a value from a family tree from the Strom app (a file or a tree of the app that the research took in) that nobody
    has changed since it was taken in is the user's family tree's: the agent does not change it, it only proposes, as
    for a person's fact, but it does not count as confirmed by a person. An edit, a value put back, an accepted proposal
    and an edit sent from the app are a person's fact;
  - a fact from the family tree the agent changes only with a cited record; without one, and always when a person
    decides about hypotheses ([R10.3.2](R10-people-and-hypotheses.md#R10.3.2)), a proposal arises as a conflict for
    a person to decide;
  - a person's fact the agent never changes, not even through a file loaded via `strom sync`; always only a proposal;
  - a proposal whose proposed value already holds closes by itself. A proposal whose value has changed since it arose
    is stale: it cannot be accepted, only closed with the value kept;
  - the value from the family tree stays stored next to the changed one ([S6.3.1](#S6.3.1)).
- **Result in the app:** at a fact with a proposal, the line **The research proposes changing a fact from the family
  tree** (or **The research proposes changing a fact entered by a person**) and **Conflict ›**. In the conflict,
  **Now · from the family tree** (or **Now · entered by a person**) stands against **Research proposal**; the choices
  are **Keep the family tree's** and **Accept the proposal**. Once accepted, the fact is confirmed by a person and
  **Originally from the family tree: …** with **Revert** stays at the fact.
- **Why:** a family tree gives a direction for searching, not proof. What a person entered is their decision; the
  agent can only back it up with a proposal.
- **Controls:** app: **Conflict ›** at the fact. Terminal: `strom conflict list`, `strom conflict show X…` (the
  agent's proposal and where today's value comes from), `strom conflict resolve X… --take research|user`.
- **Since:** research 1.30.0, app 3.26.0

<!-- zdroj: research:v1.30.0 CHANGELOG.cs.md 1.30.0 (údaje z převzatého rodokmenu jsou chráněné) · dirigent:prace/1108-vyzkum-066-u3/karta.md, u3-nalezy, u3-nalezy2 Výsledek (původ import/user/research; --cite/--locator; conflict proposal; event edit/retract, person edit, name primary, place rewrite, source edit --transcript, sync; conflict.stale) · strom help conflict resolve (--take user|research) · app:1c9b2392 strings.ts origin.proposeImport, proposeUser, conflictOpen, sideImport, sideUser, sideProposal, keepImport, accept, acceptNote · research:94d75934 src/core/model.ts ValueOrigin.tree, src/core/origin.ts (user i tree: agent jen navrhuje), src/core/import.ts importGedcom/importStromJson (soubor aplikace → user + tree) -->

<a id="S6.3.1"></a>
### S6.3.1 Originally from the family tree and Revert

A fact from the family tree that the research or a person changed keeps its original value. The app shows it at the
fact as **Originally from the family tree:** with what it was changed by, and with the button **Revert**.

- **Enforced by the code:**
  - **Revert** writes the value from the family tree again (with a citation of the family tree). The reverted fact is
    then a person's fact and the research no longer changes it by itself; the record it was changed by stays with the
    source;
  - only a person may revert: in the app, or at their own terminal. `strom` refuses reverting to an agent;
  - the date, place or value of an event (each part separately) and a person's name or sex can be reverted.
- **Limits:**
  - **Revert** works only on the computer where the research runs (**Reverting works while the research runs on this
    computer.**); not on a phone;
  - only a tree linked to the research has the line **Originally from the family tree** and **Revert**; the shared
    facts of a couple (marriage, divorce) do not have it.
- **Controls:** app: the person card → **Revert** at the fact → **Revert to the family tree's value?**. Terminal:
  `strom event revert E… [--part date|place|value]`, `strom person revert P… --name N [--part given|surname]`,
  `strom person revert P… --sex`.
- **Since:** research 1.30.0, app 3.26.0

<!-- zdroj: research:v1.30.0 strom help event revert, person revert („Only the user: in the Strom app or at their own terminal“) · most /facts/revert · app:1c9b2392 strings.ts origin.was, by, accepted, revert, confirmTitle, confirmNote, noBridge, phone · src/ui (Původně/Vrátit jen s feature origin; vztahy páru bez řádku) -->

<a id="S6.4"></a>
## S6.4 The What next card

After loading a family tree from another program the app shows the card **What next**: where the tree comes from and
what can be done with it next. It shows once after each import, whether the tree was created new, inserted or merged.

- **Contents:**
  - the origin: “Tree from {program} (file {date}) · N people” (for inserting and merging, into which tree and how many
    people);
  - the data check line: “Found N things worth a look. Nothing is corrected automatically.” and **Review**
    ([A5](A5-tree-check.md)), or “The data check found nothing to fix.”;
  - when the file holds several families with nothing connecting them: **Separate disconnected parts…**;
  - the research: without research on this computer **Ancestor research with this tree** and **Ancestor research**;
    with research **Start research with this tree**; a tree linked to the research **Research with this tree**
    (places without a location and people with facts from the family tree), **Find places** and, when the research
    can verify in bulk, **Check facts against sources** (opens **Verify facts in the tree**,
    [S7.5](S7-reliability-and-verification.md#S7.5));
  - the sentence “The research takes facts from the family tree as leads: without proof from a source it does not
    overwrite them, and changed ones can be reverted.”;
  - the links **Back to {program}: export with sources…** ([S6.6](#S6.6)) and the help **A tree from another
    program**.
- **Limits:** the card is only for another program's file. It replaces the earlier questions after an import (the
  check, separating families).
- **Since:** app 3.26.0

<!-- zdroj: app:7b0471f8 src/ui/import-next-ui.ts (IMPORT_NEXT_HELP_TOPIC = 'A2', nextCardClosed, :302 verify → showVerifyBulkDialog) · src/import-next.ts IMPORT_NEXT_VERIFY_FEATURES ['verify.bulk'] · strings.ts importNext.* · dirigent:prace/1108-app-066-u5 -->

<a id="S6.5"></a>
## S6.5 Backups and going back in time

Before each import into a tree and before a merge the app saves a backup of the tree. The state before the import can
thus be restored.

- **Enforced by the code:**
  - automatic backups of the tree arise daily and before an import or merge; **Insert into tree** takes a backup
    too;
  - backups live in this browser, not in the tree's file: they disappear when the browser's data are cleared and are
    not on another computer. A lasting copy comes from exporting the tree to a file;
  - with large backups the oldest are deleted sooner; the newest three always stay.
- **Controls:** app: the tree menu → **Backups** → the window **Backup history**: **Create backup now**, **Restore**,
  **Download**; the switch **Automatic backups of this tree**.
- **Since:** app 3.26.0 (the backup before **Insert into tree**)
- **From app 3.27.0:** the backup **Before the data update of a new version** is made before the app, on opening,
  adjusts a tree saved by an older version; today only to join sources that differed only in reliability
  ([A2.6.1](A2-loading-a-family-tree.md#A2.6.1)).

<!-- zdroj: app:1c9b2392 src/snapshots.ts SnapshotReason pre-import, pre-merge · src/ui/import-export.ts:818, :940 snapshotNow('pre-import') · src/data.ts:892 · src/ui/merge-ui.ts:769 · src/ui/tree-actions.ts:196 · strings.ts snapshots.menu, title, autoLabel, autoHint, inBrowser, budgetNote, createNow, restore, download · 3.27.0: app:5721b016 src/snapshots.ts SnapshotReason pre-migration, src/tree-manager.ts joinQualityOnlySourcesOf, strings.ts pre-migration -->

<a id="S6.6"></a>
## S6.6 Export back to the program, or to share

The GEDCOM export first asks **What the file is for**: **Back to {program}** (or **Back to another program**), or **To
share with others**. By that it protects living people and returns program IDs.

- **Back to {program}:** “The whole tree with sources and citations, for one's own genealogy program.” Full data of
  everyone, living people included; sources and citations. People and families from that program's family tree get
  back their original record identifier where that is safe, and the lines of their IDs (`_UID`, `RIN`, `EXID` …); an
  identifier that cannot be used goes as `REFN` with `TYPE {program} xref`. The program's own tags (`_XXX`) from
  imports of the same program come back.
- **To share with others:** “Protects living people; the content can be adjusted.” (the default GEDCOM protection,
  [A7.2.1](A7-book-pages-and-export.md#A7.2.1)). The deceased keep their sources; for living people the citations are
  left out and the window says so (“For N living people, K citations are left out. The deceased keep their
  sources.”).
- **Enforced by the code:**
  - the GEDCOM export keeps the sources and citations of deceased people in every option; the JSON, HTML and CSV
    exports do not change ([A7.2](A7-book-pages-and-export.md#A7.2));
  - the file has no photos and attachments: other programs do not read them from the file;
  - at **Back to {program}** the summary's row **Sources and citations (N sources, M citations)** counts the source
    records the file writes. The sources the import made from one source record for each page cited
    ([A2.6](A2-loading-a-family-tree.md#A2.6)) go back as that one record: two registers cited at 81 facts give
    “2 sources, 81 citations”. The tree keeps a source for each page cited;
  - **Mark the research's facts with a note** (on by default, only when the tree has facts from the research): a fact
    the research added or corrected gets the note “Derived by the Strom research (per: …)”;
  - otherwise program IDs are written under Strom's own tags (`_STROM_IMPORT`), so that they come back on the next
    load into Strom.
- **Controls:** **Export → Export GEDCOM → What the file is for**; from the card **What next** the link **Back to
  {program}: export with sources…** (opens the export with the choice back).
- **Since:** app 3.26.0
- **From app 3.27.0:** a family's photo from another program's file goes back at the family in **Back to
  {program}** as the file wrote it; a reference to a media record goes back as a photo written directly at the family
  ([A2.2](A2-loading-a-family-tree.md#A2.2)).

<!-- zdroj: app:7cf409bd src/ged-exporter.ts backSourceRecordCount (sourceGroups: jeden záznam za skupinu) · src/ui/export-gedcom-ui.ts backSources → exportGed.sumSources · e2e/export-gedcom-back.spec.ts · app:1c9b2392 src/ged-exporter.ts backToXrefs (původní xref, ID řádky úrovně 1, REFN + TYPE {prog} xref, _XXX téhož programu, jinak _STROM_IMPORT / _STROM_XID) · src/ui/import-export.ts:267 keepDeceasedSources: true (jen GEDCOM) · strings.ts exportGed.* -->

<a id="S6.7"></a>
## S6.7 A family tree loaded again and merging

A family tree of the same program loaded again and merged with the tree finds its people by program ID. A person who
has the same ID but otherwise does not match is only offered.

- **Enforced by the code:**
  - a match by ID counts as certain only when the name is similar, the sex is not man against woman, the years of
    birth (otherwise of baptism) differ by at most 3 and no other global ID (for example FamilySearch) differs.
    Otherwise it is only a proposed match with a score of at most 79. The reason for the match is **Same ID in the
    file**;
  - `_UID` is paired with `UID`, `_FSFTID` with `EXID` with the address familysearch.org;
  - the record identifier and `RIN` add 25 points to a name match, only for files of the same program; by themselves
    they make no match;
  - an undecided match is confirmed by itself in a merge only from a score of 80; a match of 50–79 is only offered (?)
    and without a person's decision it is not joined ([A8.3](A8-merging-trees.md#A8.3));
  - a note of a person, a relationship and a source is not doubled in a merge;
  - siblings known only by surname are not added a second time when the same file is merged again.
- **A tree loaded by an older version of the app:** merging the same file gives the same tree and the same **Back to
  {program}** as a new import: families (also a family with one named parent) are not doubled and no marriage the file
  does not have is added. A person with only a given name and no dates is paired with the person of the same name in
  the tree through a matched relative (the reason for example **Child of matched person**, **Sibling of matched
  person**, **In-law of matched person**); score 50, always only for review. No pairing when the relative has two
  people of that name, the sex differs or the dates of birth or death differ.
- **Limits:**
  - families are not paired by ID;
  - an ID that more than one person in the tree carries does not make a match by itself, it only offers it
    ([A8.2](A8-merging-trees.md#A8.2));
  - the marks **From family tree** are not added by merging into a tree from an older version: its values stay a
    person's facts. A new import of the file gives the marks;
  - doubles from an earlier merge are not removed by merging; they are deleted by hand.
- **A manual merge of two people** (the window **Merge people**) joins the notes of both people and of both
  joined families, each part once.
- **Controls:** **Import → Import GEDCOM → Merge with existing** ([A8](A8-merging-trees.md)).
- **Since:** app 3.26.0; 3.27.0: an ID of more people in the tree only offers; a manual merge of people joins
  notes (before it did not)

<!-- zdroj: app:7b0471f8 CHANGELOG.cs.md 3.26.0 (Slučování) · src/merge matchSameNamedRelatives, standInsOfKnownFamilies (b3c3ce00) · strings.ts merge reasons partner_of_matched, child_of_matched, parent_of_matched, sibling_of_matched, in_law_of_matched · dirigent:prace/1109-app-slouceni-325, 1109-app-gedy-opravy (N6: značky importu se starému stromu nedoplní), 1109-app-jeden-rodic Výsledek -->
<!-- zdroj: app:1c9b2392 src/merge/matching.ts ID_MATCH_SCORE 100, ID_CANDIDATE_SCORE 60, ID_MAX_YEAR_GAP 3, WEAK_ID_BONUS 25, offerOnlyCap · src/merge/executor.ts:82 AUTO_CONFIRM_SCORE = 80 · src/merge/notes.ts · strings.ts merge reason id „Stejné ID v souboru“ · dirigent:prace/1108-app-066-u8/karta.md Výsledek (FAM se podle ID nepárují; mergePersons neslučuje poznámky) -->
<!-- zdroj: 3.27.0: app:ffe1da9f src/data.ts mergePersons (notes: mergeNoteText keep+remove; partnership note: mergeNoteText) · app:b5595ca1 src/merge/matching.ts idNamesSeveral, findDirectMatches · app:a5fc9656 src/ged-parser.ts keptMedia, extras OBJE (export zpět jako ostatní _XXX rodiny) · strings.ts personMerge.title „Sloučit osoby“ · CHANGELOG.cs.md 3.27.0 · dirigent:test/vysledek-1109-app-drobnosti-ged.md P1 (dialog poznámku jako konflikt nenabízí: detectFieldConflicts jen jméno, příjmení, narození, úmrtí) -->

<a id="S6.8"></a>
## S6.8 A family tree in the research

The research takes over a family tree from another program with the command `strom intake` as leads
([R11.3](R11-material-from-the-user.md#R11.3)) and keeps the origin of each fact ([S6.3](#S6.3)).

- **Enforced by the code:**
  - program IDs are kept: the same family tree taken over a second time (or another program's family tree) finds the
    people by them, adds nobody twice, and new facts are added as leads;
  - a person who is only possibly the same (another name, another FamilySearch ID, or only an ID without `_UID` as with
    Gramps) is not joined: the result says “Maybe the same person as one of the research by an ID of the program (not
    joined, to be decided): …” (in `--json` `candidates`);
  - what the file has and is not taken over (media records, links to media, the program's own tags) the result
    counts: “Not taken from the file: …” (in `--json` `notTaken`);
  - a file in the Windows-1250 or Windows-1252 encoding (“ANSI”) is read with the right letters; a character that
    cannot be read is reported, never silently replaced;
  - the IDs go back with the research into the Strom app;
  - research set up earlier marks itself once after the update (which facts came from the family tree and which are a
    person's); no value changes. Where this is not certain, the fact counts as a person's. A value from a family tree
    from the Strom app is told by the research's history: it was there right after the family tree was taken in, not
    before, and it is the same today; only such a value is the user's family tree's ([S6.3](#S6.3)).
    `strom fixes undo origins` takes the marks back, `strom fixes run origins` then sets them again. Even before the marking, a family tree taken
    over again finds people by the IDs of earlier imports.
- **Controls:** terminal: `strom intake rodokmen.ged`, `strom conflict list`, `strom event revert`,
  `strom person revert`, `strom fixes show origins` (what the fix is and what it found here),
  `strom fixes undo origins`, `strom fixes run origins`.
- **Since:** research 1.30.0

<!-- zdroj: research:v1.30.0 CHANGELOG.cs.md 1.30.0 · src/core/import.ts ImportResult.candidates, notTaken · src/commands/intake.ts:300-313 · assets/lang/cs.json ui.intake.candidates, ui.intake.notTaken* · strom help fixes run („readers, proven-originals and origins are set right by themselves once, run again only after strom fixes undo“) · dirigent:prace/1108-vyzkum-066-u3, 1108-vyzkum-066-u8 Výsledek (origins-1, nejisté → user; Gramps bez _UID kandidáti) · research:94d75934 src/core/originfix.ts ORIGINS_TREE_SETTLED origins-tree-1 (podle historie: stejná hodnota hned po převzetí, ne před ním, stejná dnes), settleOrigins · cs.json ui.fixes.origins.example.tree · strom help fixes show -->
