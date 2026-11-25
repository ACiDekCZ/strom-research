<a id="A14"></a>
# A14 Managing trees and changing the structure

The trees in the app are managed in one window, **Manage trees**. What should happen to a tree (a new tree from a
selection, a copy, splitting, joining with another tree, adding from a file) is offered by one item, **Change
structure…**. Each option says which tree changes. Only one tree belongs to each research; copies and new trees are
without research ([S1.10](S1-connecting-app-and-research.md#S1.10)). The chapter describes the Strom app 3.32.0;
changes from a newer version carry its number.

<!-- zdroj: dirigent:spec/139-zmenit-strukturu-dialog · app:a9bc0b6b src/structure-options.ts, src/ui/structure-ui.ts · 518c9654, e9f50b62 src/ui/structure-select-ui.ts · 3110125c, fbd97361 src/ui/tree-management.ts, src/tree-row.ts · bcb2a0fa, 023879dd, f3c66503 · strings.ts structure.*, treeManager.* · dirigent:prace/1123-app-139-* -->

<a id="A14.1"></a>
## A14.1 Manage trees

Manage trees shows all trees in the app, each in the same row with the same facts. The row's details are taken from
the register of trees; the tree's data are not read for them.

- **The row of a tree:**
  - the name and the marks **Open**, **Locked**, **Hidden**;
  - "N people · M couples · size · edited …". A tree that shares part of its images with another tree (a copy, a
    merge) has "· images shared" at the size. The hint on hover: "Some images are shared with another tree: the size
    counts them, but they take their space only once." ([S8.7](S8-where-the-data-are.md#S8.7));
  - the line of origin, the first that applies:

    | Tree | Line |
    |---|---|
    | a tree that belongs to a research | "Research {number}" and the switch **Research on** ([S1.9](S1-connecting-app-and-research.md#S1.9)) |
    | a copy of a tree | "copy of the tree “{name}” · no research" and the switch off ([S1.10](S1-connecting-app-and-research.md#S1.10)) |
    | a new tree from a selection | "cut from the tree “{name}” · no research" |
    | a tree from a file | "from GEDCOM {file} · no research", "from the file {file} · no research" |
    | others | "no research" |

  - a tree followed live has "◎ Followed live", and when writing to it waits, also "· writing to the tree is paused";
  - a tree with merges has the link **Merge history (N)** ([A8.11](A8-merging-trees.md#A8.11));
  - the buttons **Open** (not at the open tree), **Change structure…** ([A14.2](#A14.2)), **Export…** and ⋯ **More
    actions**.
- **Unfinished merges** stand under the tree they will write into: "Unfinished merge: {source} → {target}", "N to
  decide" (the same number as step 2 of the guide), how many pairs are reviewed, "saved …", and the links **Resume**,
  **Rename**, **Discard**. A merge whose target tree was deleted is in the section **Unfinished merges without a
  tree** with the note "the target tree was deleted".
- **⋯ More actions** at a tree, in groups separated by a line:
  1. **Tree overview**, **Statistics** ([A13](A13-tree-statistics.md#A13)), **Data quality**, **Backups**, **Merge
     history** (only with a merge), **Change history**;
  2. research: **Research overview** (phone and tablet), **Send changes to the research** (only a tree that belongs
     to a research), and one research row: at a copy **Turn on research…**, otherwise the research settings, **Start
     research** or the installation;
  3. **Rename…**, **Default person and view** ([A6.1.1](A6-views.md#A6.1.1)), **Open at startup**, the default
     settings of the lifeline, at the open tree **Places** and **Surname spellings**;
  4. **Change structure…**;
  5. **Hide tree** / **Show tree**, **Lock tree** / **Unlock tree**;
  6. **Delete tree…**.
- The window's footer: **Export all**, **New tree**, **Close**. From 6 trees there is the field **Search trees…**
  above the list.
- **Dropping on a row:** a GEDCOM file or a Strom tree (`.json`) dropped on a tree's row opens the merge guide with
  this tree as the target; a tree's row dragged with the mouse onto another row merges it into that tree through the
  guide. The row under a dragged file has a dashed outline and says "Drop: add {file} to the tree {tree}"
  ([A8.5.1](A8-merging-trees.md#A8.5.1)).
- **Limits:**
  - a locked tree has in ⋯ only reading and **Unlock**; a tree saved by a newer version of the app only reading;
  - **Duplicate**, **Merge into another tree…**, **Split** and **Separate disconnected parts** are not in ⋯; they are
    in **Change structure…**. Separating disconnected parts is still offered by the import
    ([S6.4](S6-tree-from-another-program.md#S6.4)) and by the Tree overview in **Quick actions**
    ([A5](A5-tree-check.md));
  - a copy of a research's tree has no research actions, only **Turn on research…**.
- **Controls:** **Actions › Tree › Manage trees…**; the tree switcher → **Manage trees…**; on a phone the sheet of
  trees → **Manage trees ›**.
- **Since:** app 3.32.0

<!-- zdroj: app:3110125c src/ui/tree-management.ts renderTreeManagerList (stats z indexu, badges, canStructure, pendingRow, mergeFacts subPending 134 S-P2, pendingOrphans, targetGone, searchable ≥ 6) · fbd97361 src/tree-row.ts treeOriginLine (research → copy → fromTree → importedFrom → none) · src/ui/tree-actions.ts treeActionGroups (overview, research, settings, structure, manage, delete, trees; manageTrees jen mimo správu) · 7b967fd8 strings.ts treeManager.imagesShared, imagesSharedTip (134 S-P1) · bcb2a0fa (kopie s vypnutým přepínačem, ◎ Sleduje se živě, zápis stojí) · strings.ts structure.research, followed, writeStopped, fromTree, fromGedcom, fromFile, mergeHistory, pendingRow, savedAt, pendingOrphans, targetGone, treeManager.* · app:73ee4625 src/tree-drop.ts, src/ui/tree-management.ts (puštění na řádek) · strings.ts mergeWizard.dropOnTree -->

<a id="A14.2"></a>
## A14.2 Change structure…

The window **Change structure: {tree}** offers everything that makes another tree out of the tree or adds to it, in
three groups. Each option says which tree changes: "What should happen to the tree. Each option says which tree
changes."

| Group | Option | What happens |
|---|---|---|
| **New tree** | **From a selection…** | a family line, a list of people, a line or a view; a new tree is created ([A14.3](#A14.3)) |
| | **Copy of the whole tree** | a copy without a link to a research is created ([A14.3](#A14.3)) |
| **Split** | **Into families…** | new trees are created by family lines, branches or one person's view ([A14.4](#A14.4)) |
| | **Separate disconnected parts…** | new trees are created from parts that nothing connects ([A14.4](#A14.4)) |
| **Join** | **A selection or the whole tree into another tree…** | through the merge guide; the target tree changes, can be undone ([A14.5](#A14.5)) |
| | **From another tree into this tree…** | another tree of the app through the merge guide; this tree changes, can be undone ([A14.5](#A14.5)) |
| | **Add from a file to this tree…** | GEDCOM or a Strom file (JSON) through the merge guide; this tree changes, can be undone ([A14.5](#A14.5)) |

A new tree, a copy and a split do not change the original tree.

- **A greyed option** shows the reason under it:
  - **From a selection…** and **Add from a file…** at a tree that is not open: "Once the tree is open." with the link
    **Open the tree {name}** (opens the tree and the window again);
  - **Separate disconnected parts…** at a tree that is wholly connected: "The whole tree is connected." For a large
    tree this is computed in the background and the option stays active until it is certain;
  - **A selection or the whole tree into another tree…** when there is no other tree: "There is no other tree." A
    target that cannot be written to now does not grey the option: why, the merge guide says
    ([A8.5](A8-merging-trees.md#A8.5));
  - **Add from a file…** at a tree followed live: "The tree is followed live; it cannot be written to now." with the
    link **End following**;
  - **From another tree into this tree…**, the first reason that applies: "There is no other tree." → "Once the tree
    is open." → "The tree is followed live; it cannot be written to now." with the link **End following**.
- All options are visible without scrolling on a notebook screen of 1366 × 657 and of 1024 × 768, even with the
  greyed options and the reasons under them. Where something is still below the window's edge, the bottom of the
  window fades out.
- **Limits:** a locked tree and a read-only tree do not have the window (the item is missing). On the options the
  window has **Close**, on further steps **Back** · **Cancel** and the step's button; opened from Manage trees it
  returns there.
- **Controls:** **Actions › Tree › Change structure…**; Manage trees, the button **Change structure…** in the tree's
  row and in ⋯; on a phone from the menu **More** at a tree. The arrows up and down, Home and End move between the
  active options.
- **Since:** app 3.32.0

<!-- zdroj: app:a9bc0b6b src/structure-options.ts (OPTIONS, STRUCTURE_GROUPS, blocked: select notOpen, parts connected, into noOther, file notOpen/followed+stopFollowing; readOnly bez dialogu), src/ui/structure-ui.ts structureOptionRow (důvod pod volbou, Ukončit sledování), structureOpenTree, structureRunOption, arrowKeys · defe53b4 (Zavřít na volbách, Zpět · Zrušit · primární na krocích) · 45d5be44 (telefon) · strings.ts structure.intro, group.*, opt*, why*, openTree, research.stop · app:5e85dfc1 src/structure-options.ts (from: noOther → notOpen → followed + stopFollowing) · fef250eb, f4050b1c (všechny volby bez posouvání do 1366 × 657 a 1024 × 768, rozplynutí spodku okna) · dirigent:spec/139 K3.2, K3.3 -->

<a id="A14.3"></a>
## A14.3 New tree from a selection and a copy of the whole tree

**From a selection…** leads through two steps: **Who to take** and **Summary**. **Copy of the whole tree** goes
straight to the summary. The result is a new tree without research; the original tree does not change.

- **Who to take:** seven sources, under each "Selected: …" with the real number of people:

  | Source | What it takes |
  |---|---|
  | **Current view** | "The people now on screen:"; only in the Family or Descendants view, otherwise greyed with "Only in the Family or Descendants view." |
  | **Family line / surname** | one family line; small family lines are in the folded row **Other families** |
  | **List of people** | research lines, **Fixed lists**, **Automatic lists** ([A11](A11-lists-of-people.md#A11)); the field **Find a list…** |
  | **Ancestors of a person** | the person and the number of generations 1–10 or all |
  | **Descendants of a person** | the same downwards |
  | **Direct line of a person** | "Direct line: the person's ancestors and descendants, without siblings and their families.", generations up and down |
  | **By hand** | people chosen one by one |

- **Summary:** "{What} – the new tree gets:" (for a copy "The copy gets the whole tree {name}:") and the numbers of
  people, couples, sources and images by the same rules by which the tree will be created. With a chosen child its
  other parent comes along too. Images are only counted, not loaded into memory. A large selection is counted in
  batches ("Counting… N of M people") and **Create tree** (**Create copy**) waits for the counting to end.
- **Separate parts:** people connected only through people not selected will stand alone in the new tree: "N people
  are connected only through people not selected and will stand alone in the new tree." **Show names (N)** lists
  them together with who connects them ("linked by {name}").
- **Name:** a new tree "{tree} — {what}" (for example "Horákovi — Vlková line"), a copy the first free one of "{tree}
  (copy)", "{tree} (copy 2)", "(copy 3)"… A name another tree already has is pointed out by the field under it ("A
  tree with this name already exists.") and saving still works. A copy of a tree inserted through a shared link also
  takes a free name.
- **After creating:** the app goes to the new tree, to its default person in the centre, and announces "Tree “{name}”
  created (N people)." with the action **Back to {original tree}**. A copy returns the window it came from.
- **Limits:**
  - from a selection only at an open tree; a copy also at a closed one;
  - neither a new tree nor a copy is linked to a research: "The original tree stays as it is. The new tree is not
    linked to research."; for a copy "…a research of its own can be turned on later in Manage trees."
    ([S1.10](S1-connecting-app-and-research.md#S1.10));
  - a new tree from a selection has in Manage trees the origin "cut from the tree “{name}”", a copy "copy of the tree
    “{name}”"; a copy of a copy carries the name of that copy.
- **Controls:** **Change structure…** › **From a selection…**, **Copy of the whole tree** (replaces the former
  **Duplicate**).
- **Since:** app 3.32.0

<!-- zdroj: app:518c9654, b79b55ad, 1ff40d37 src/ui/structure-select-ui.ts (WHO_KINDS, CUT_VIEWS family/descendants, paneList selectionLines + pevné/automatické, panePerson generace 1–10/všechny, directNote, summarizeSubsetSteps po dávkách, create disabled do konce) · src/structure-options.ts summarizeSubset, keptWithGlue (druhý rodič vybraného dítěte), islands · e9f50b62 (Duplikovat → souhrn kopie, bez dialogu názvu) · 7b967fd8 src/tree-copy-name.ts freeCopyName, treeNameTaken (134 S-N4) · 21989997 (nový strom na výchozí osobě) · src/tree-manager.ts duplicateTree copyOf · strings.ts structure.kind.*, chosen, summaryLead, copyLead, islands, islandVia, showNames, defaultName, keepNote, copyKeepNote, create, createCopy, counting, imagesNotLoaded, createdToast, backTo, treeManager.duplicateSuffix, duplicateSuffixN, duplicateNameTaken -->

<a id="A14.4"></a>
## A14.4 Split

A split makes several new trees out of one tree. The original tree stays exactly as it is; an unwanted one can be
deleted in Manage trees.

- **Into families…** opens the window **Split into families**. **What counts as one family:**
  - **Surname lines:** children belong to the parent whose surname they bear; a person who married in without a
    family of their own stays with the partner;
  - **Branches:** the main line with all who married in, and each attached branch separately;
  - **One person's view:** the base tree is the line of the chosen person (direct ancestors, their blood siblings,
    own siblings, all descendants); **Keep sibling families down to** first cousins, second cousins or no one;
    further base trees through **Add a person…**; **Cuts at siblings** chooses whose family becomes a side tree.

  The same tree is always split the same way; the person shown decides only which family comes first. The new trees
  stay connected through shared people. The button **Create N trees**.
- **Separate disconnected parts…** opens **Disconnected parts of this tree**: families between which no parent, child
  or marriage leads, with the number of people and the oldest person. The selected ones are split off into new trees
  (**Split off N**), each named after its part. A tree that is wholly connected does not have this option
  ([A14.2](#A14.2)).
- **Limits:** **Into families…** also works at a tree that is not open: the proposals show at once, ordered from the
  tree's default person (without one from the first person); the split does not depend on the person.
- **Controls:** **Change structure…** › **Into families…**, **Separate disconnected parts…**; after importing a file
  with several families **Separate disconnected parts…** ([S6.4](S6-tree-from-another-program.md#S6.4)); Tree
  overview, **Quick actions** ([A5](A5-tree-check.md)). From both windows a way leads back to Change structure.
- **Since:** app 3.32.0 (in the window Change structure); the split itself is older

<!-- zdroj: app:src/ui/split-families-ui.ts (kopie, originál nedotčen), src/split-families.ts · src/ui/split-ui.ts (nespojené části, components.ts) · src/ui/structure-ui.ts structureRunOption families (aktivní: showSplitFamiliesDialog, jinak showSplitFamiliesPickerDialog), parts showSplitDialog · 3e3b6c35 (cesta zpět do Změnit strukturu, oddělená část pojmenuje svůj strom, části spočítané jednou) · strings.ts splitFamilies.*, split.* -->

<a id="A14.5"></a>
## A14.5 Join

Joining always goes through the merge guide ([A8.5](A8-merging-trees.md#A8.5)): where to, who is who, what changes.
It is written only after confirmation in the guide and can be undone ([A8.12](A8-merging-trees.md#A8.12)).

- **A selection or the whole tree into another tree…** opens **Join into another tree**, the step "what to join":
  - **The whole tree {name}:** what the target tree lacks is added to it;
  - **A selection…:** the step **Who to take** as for a new tree ([A14.3](#A14.3)); only at an open tree. Under the
    selection it says how many partners the guide takes in addition: "With them come 2 partners too, the other parents
    of chosen children – 9 people in all." The import is named "{tree} — {what}" in the guide.

  **Continue to the guide** opens the guide, where the target tree is chosen. This tree does not change.
- **From another tree into this tree…** opens **Add from another tree**, the step "from which tree": "Which tree to add
  to this tree. The whole tree is chosen; the guide's first step can narrow it." It offers all other trees of the app
  in alphabetical order, hidden ones and copies too, each with "N people · line of origin · Hidden"
  ([A14.1](#A14.1)). **Continue to the guide** opens the merge guide with the chosen whole tree as the import and this
  tree as the target ([A8.5](A8-merging-trees.md#A8.5)). The chosen tree does not change; this tree changes only after
  confirmation in the guide, and the merge can be undone (**Undo** in the notice, **Merge history**). A long name
  without spaces wraps in the row on a phone.
- **Add from a file to this tree…:** **GEDCOM file (.ged)** (from another program: MyHeritage, Geni, Ancestry,
  Gramps…) or **Strom file (.json)** (an export from Strom, for example from a relative). After the file is chosen,
  the merge guide opens with this tree as the target. Nothing is written to the tree until the guide confirms it.
- **Limits:** when no tree can take the merge now, the window Change structure stays and the guide says why. Adding
  from a file and from another tree works only into an open tree that is not followed live. What is sent to the
  research after a merge is covered by [A8.13](A8-merging-trees.md#A8.13).
- **Controls:** **Change structure…** › **A selection or the whole tree into another tree…**, **From another tree
  into this tree…**, **Add from a file to this tree…**; a file or a tree's row dropped on a row of Manage trees
  ([A8.5.1](A8-merging-trees.md#A8.5.1))
- **Since:** app 3.32.0

<!-- zdroj: app:f0c5a3fb src/ui/structure-ui.ts structureJoinWhatStep, structureJoin (whole → showMergeTreesDialog, selection → structureWhoStep mode join → mergeSubsetInto „{strom} — {co}“), structureFileStep (startGedcomImportPlain, startJsonImportIntoTree) · 29d02a8c joinPartners · strings.ts structure.joinTitle, joinWhatIntro, joinWhole, joinWholeDesc, joinSelection, joinSelectionDesc, joinNote, continueGuide, joinPartners, fileTitle, fileGed*, fileJson*, fileNote · app:5e85dfc1 src/ui/structure-ui.ts (from: ostatní stromy podle abecedy, persons · treeOriginText · hiddenBadge; celý strom jako import, otevřený strom cíl) · fef250eb (dlouhý název na telefonu) · strings.ts structure.optFrom, optFromDesc, fromTitle, fromStep, fromIntro, fromNote · dirigent:spec/139 K3.2 -->
