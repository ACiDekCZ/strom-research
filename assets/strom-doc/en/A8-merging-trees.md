<a id="A8"></a>
# A8 Merging trees

How the Strom app merges two family trees: a GEDCOM file with a tree, two trees, or a view with a tree. Describes the
app 3.21.2; changes from a later version carry its number. From app 3.32.0 every merge is led by the guide **Merge
trees** in six steps ([A8.5](#A8.5) to [A8.13](#A8.13)), and joining trees is offered by **Change structure…**
([A14.5](A14-trees-and-structure.md#A14.5)). Merging a duplicate person within one tree is a different
matter ([A5.6](A5-tree-check.md#A5.6)).

<a id="A8.1"></a>
## A8.1 A merge always creates a new tree

No longer valid from app 3.32.0, replaced by [A8.5](#A8.5): the guide writes into the chosen tree or creates a new one.

The result of a merge is saved as a **new tree**. Both original trees and the file stay unchanged.

| From | Controls |
|---|---|
| a GEDCOM file | **Import → Import GEDCOM → Merge with existing** |
| another tree | tree management, at the tree **Merge tree** → **Select target tree** → **Start merge** |
| the people shown in the view right now | **Merge this view into…** and the choice of another tree |

- Before saving, the app asks for the name of the merged tree (default "target + source"). After the merge it shows
  the number of merged and added people and offers to switch to the new tree.
- **Limits:** an empty view cannot be merged; a view is merged only into another tree.
- **Since:** app 1.0.0; Merge this view into… app 1.19.0

<!-- zdroj: app:src/merge/ui.ts:1421 newTreeNamePrompt, :1447 TreeManager.createTree · src/ui/merge-ui.ts:595 mergeViewInto · strings.ts merge.newTreeNamePrompt, merge.switchToNewTree, merge.mergeViewInto, merge.mergeViewEmpty, merge.mergeViewNoTarget, treeManager.mergeSourceTree, treeManager.selectTargetTree, treeManager.startMerge, importDialog.mergeExisting · git v1.19.0 (cf43bde) -->

<a id="A8.2"></a>
## A8.2 Pairing people

For each person from the merged source the app looks for a person in the target tree and gives the pair a match
score.

- The score is computed from the similarity of the name, the date and place of birth, the date of death, and from the
  match of parents and partners. The sex must not contradict.
- **High** is a match of 85 and more, **Medium** 55 and more, otherwise **Low**. A person without a match is **New**.
- The wizard gives the reason for a match (for example "Name and birth year", "Child of matched person").
- **Limits:** placeholder persons (an empty place for an unknown parent) are not paired. A person without a given name
  paired through a relative always goes to review.
- **Since:** app 1.0.0
- **From app 3.26.0:** people are also paired by program ID (`_UID` = `UID`, `_FSFTID` = `EXID` with the address
  familysearch.org), with the reason **Same ID in the file**. Such a match is certain only with a similar name, sex
  not man against woman, years of birth at most 3 apart and no differing global ID; otherwise it is a proposal with a
  score of at most 79. The record identifier and `RIN` add 25 points to a name match only for files of the same
  program. Families are not paired by ID ([S6.7](S6-tree-from-another-program.md#S6.7)).
- **From app 3.27.0:** a program's ID (`_UID`, `UID`, `_FSFTID`, `AFN`, `EXID`) that more than one person in
  the tree carries does not say which of them it is: it does not make a match by itself, it only offers it.
- **From app 3.32.0:** the guide shows the score as a percentage (“N%”) and splits the pairs into **The same** (score
  80 and more) and **Maybe the same** (a lower score); a person without a match is among **New** ([A8.7](#A8.7)). The
  labels **High**, **Medium** and **Low** are no longer shown.

<!-- zdroj: app:src/merge/matching.ts:318 findMatches, :781 (85 high, 55 medium), :790 calculateMatchScore, :618 UNKNOWN_NAME_MATCH_SCORE · strings.ts merge.highConfidence, merge.mediumConfidence, merge.lowConfidence, merge.matchReasons · 3.27.0: app:b5595ca1 src/merge/matching.ts idNamesSeveral (víc osob stromu se stejným silným ID → jen idCandidate), findDirectMatches · src/merge/id-match.ts STRONG_TAGS · CHANGELOG.cs.md 3.27.0 · spec 066 K3.2 -->

<a id="A8.3"></a>
## A8.3 What a person decides

The wizard **Merge data** shows the matches, conflicts and new people. Each match can be decided.

| Option | What happens to the person from the source |
|---|---|
| **Confirm** | merged with the person in the tree |
| **Reject** | added as a new person |
| **Skip** | not brought over at all |
| **Match to existing** | merged with a person chosen by hand |

- An undecided match with a score of 50 and more is confirmed by itself in the merge; an undecided one under 50 is
  added as a new person. When undecided uncertain matches remain, the app asks before the merge.
- **Only update existing people (don't add new)** completes the paired people and adds no new person.
- A fact that both sides have differently is a conflict: **Keep existing** or **Use from import**; the more precise
  date or the more complete value is **suggested**. For a couple this covers the status of the relationship, the date
  and place of marriage and the end date. A fact on one side only is filled in.
- A merge in progress can be kept on closing with **Save for later**; it comes back as **Pending merges**.
- **Since:** app 1.0.0; couple conflicts app 3.0.0; Skip and Only update existing people app 1.19.0
- **From app 3.26.0:** an undecided match is confirmed by itself only from a score of 80 (confirmed in advance in the
  wizard, ✓). A match of 50–79 is only offered (?) and without a person's decision it is added as a new person: a
  doubled person can be merged later, a wrong merge cannot be undone.
- **From app 3.32.0:** the decisions are made in the guide: pairs in the step **Who is who** ([A8.7](#A8.7)), differing
  details in the step **Who is right** ([A8.9](#A8.9)). The options **Confirm**, **Reject**, **Skip** and **Only update
  existing people** are replaced by **Same person**, **New person**, **Do not add** and the scope **d) Only enrich
  existing people**. In addition:
  - a pair with a score under 80 is not joined without a person's decision; the remaining undecided ones can be added
    as new or left out at once ([A8.7](#A8.7)). Each person of the import ends up exactly once: joined, added, or left
    out by an explicit choice;
  - the import's suggestion is only advice: a differing detail without a person's choice keeps the tree's value;
  - a merge in which something would be lost is not saved: before writing, the totals of people, couples, links,
    sources, photos and files and the references are checked; when they do not match, it says “The totals do not
    match: nothing was saved.” and what does not match;
  - a source of the import with an ID that the tree already has for another source comes as a new source;
  - success is reported only after the actual write to storage.

<!-- zdroj: app:src/merge/executor.ts:78 AUTO_CONFIRM_SCORE, :110 detectPartnershipConflicts, :302 toAdd (updateOnly, skip, reject), :792 mergePersonData · src/merge/ui.ts:1408 pendingGate · strings.ts merge.confirm, merge.reject, merge.skip, merge.manualMatch, merge.updateOnlyLabel, merge.keepExisting, merge.useImport, merge.suggestedPrecise, merge.partnershipFields, merge.closeSave, merge.pendingMerges · git v3.0.0 (2218cea), v1.19.0 (cf43bde) -->

<a id="A8.4"></a>
## A8.4 What comes along with the tree

Besides people and relationships, the lists that belong to the whole tree are merged too.

- **Sources:** the same source (the same call number, otherwise the same description) is not doubled; citations are
  moved to the kept source and a missing transcription and date are filled in.
- **From app 3.27.0:** a source that differs from the kept one only in its default reliability is the same source and
  is not doubled; the moved citations keep their reliability ([A2.6.1](A2-loading-a-family-tree.md#A2.6.1)). Another
  record date or other lines of the citation still give a source of its own.
- **Places:** coordinates, place records and other names of places are joined; where both trees know the same place,
  the target tree wins.
- **Surname spellings** ([A4.5](A4-surnames-and-families.md#A4.5)) are joined; groups that overlap are combined.
- The new tree starts without a default person and view ([A6.1.1](A6-views.md#A6.1.1)).
- Before the merge the app says how many problems of the check both trees have, and after the merge it offers the
  check when the merge brought new ones ([A5](A5-tree-check.md)).
- **Limits:** a repeated import of the research's file into the research's tree is covered by
  [S1](S1-connecting-app-and-research.md).
- **Since:** app 1.0.0; reporting problems of the check app 1.19.0
- **From app 3.26.0:** notes of a person, a relationship and a source are not doubled in a merge. Before the merge a
  backup of the tree is saved ([S6.5](S6-tree-from-another-program.md#S6.5)). After merging another program's file
  the app shows the card **What next** ([S6.4](S6-tree-from-another-program.md#S6.4)). A manual merge of two people
  ([A5.6](A5-tree-check.md#A5.6)) does not join notes.
- **From app 3.28.0:** shared events ([A10.1](A10-shared-events.md#A10.1)) are not doubled: they are paired with
  the events of the target tree and take over its shared event; a custom event “Census” is paired with a census. The
  summary “Shared events: n joined” ([A10.6](A10-shared-events.md#A10.6)).
- **From app 3.32.0:**
  - the guide takes the backup **Before merge** for every input and always, even with automatic backups turned off
    ([A8.10](#A8.10), [S6.5](S6-tree-from-another-program.md#S6.5));
  - a merge in progress saved for later recognizes that the tree has changed meanwhile: the suggestions are
    recalculated, the decided pairs stay ([A8.5](#A8.5));
  - the card **What next** shows only after a merge that creates a new tree; after a merge into an existing tree the
    data check is in the step **What happened** (**Check the tree**, [A8.11](#A8.11));
  - the tree keeps a record of its merges (data version 26); older app versions open such a tree read-only.

<!-- zdroj: app:src/merge/executor.ts:211 executeMerge (mergeSourceCatalogs, places, mergePlaceRecords, mergePlaceAliases, addSurnameGroup, delete defaultPersonId/defaultView) · src/merge/ui.ts countNewMergeIssues · strings.ts merge.preValidationWarning, merge.newIssues · git v1.19.0 (00e5d38) · 3.27.0: app:dde0151a src/merge/executor.ts sourceKey bez quality, takeCitationQuality, remapCitations; app:5721b016 unionCitations · 3.28.0: app:80c2ffb9 src/merge/* (shareId, Census ↔ census), strings.ts merge.sharedJoined -->

<a id="A8.5"></a>
## A8.5 The Merge trees guide

Every import of a family tree into a tree and every merge of two trees is led by one guide in six steps. Nothing is
written to the tree until the write is confirmed in the step **What will happen**.

| From | Guide | Controls |
|---|---|---|
| a GEDCOM file | **Import a family tree** | **Import → Import GEDCOM**; from Manage trees it starts with the option **New tree** |
| another tree | **Merge trees** | **Change structure…** › **A selection or the whole tree into another tree…** › **The whole tree** ([A14.5](A14-trees-and-structure.md#A14.5)); the target is the open tree, for the open tree another one |
| a selection of the tree's people (family line, list, line, view, by hand) | **Merge trees** | **Change structure…** › **A selection or the whole tree into another tree…** › **A selection…** |
| a GEDCOM or Strom (JSON) file into the open tree | **Import a family tree** | **Change structure…** › **Add from a file to this tree…** |
| another tree into the open tree | **Merge trees** | **Change structure…** › **From another tree into this tree…** ([A14.5](A14-trees-and-structure.md#A14.5)) |
| a GEDCOM file or a Strom tree (`.json`) dropped on the app's window | **Import a family tree** | dragging the file onto the window; the target is the open tree ([A8.5.1](#A8.5.1)) |
| a file dropped on a tree's row in Manage trees, a tree's row dragged onto another row | **Import a family tree** / **Merge trees** | Manage trees; the target is the tree of the row it was dropped on ([A8.5.1](#A8.5.1)) |
| changes sent from another Strom | **Received changes** | the preview of received changes → **Review in detail** |

- **Steps:** **What to do** ([A8.6](#A8.6)), **Who is who** ([A8.7](#A8.7)), **Whom to add** ([A8.8](#A8.8)), **Who
  is right** ([A8.9](#A8.9)), **What will happen** ([A8.10](#A8.10)), **What happened** ([A8.11](#A8.11)). A step
  that decides nothing for the chosen path is skipped, and the guide says so at it.
- Above the steps stand running counts of the import's people: **Joined**, **New**, **Not added** and **To decide**;
  their sum is the number of people in the import.
- On a wider window (tablet, computer) the guide takes up almost the whole screen and the steps with the counts are in
  one bar: the counts in words and “= N people in the import”; under 1100 px of width the other steps have only a
  number. On a phone the guide is unchanged.
- A guide started from the source (the open tree is merged into another one) names the target tree everywhere: in the
  title, in the status line, in “Compare … with the tree …” and in the row of the unfinished merge.
- Comparing a large tree shows progress and an estimate of time. **Stop** loses nothing: the choices of step 1 stay
  and the comparison can be run again.
- A guide closed before the write says “Nothing has been written yet.” and the decisions can be kept with **Save for
  later**. The saved merge waits in Manage trees under its target tree as an **Unfinished merge**
  ([A14.1](A14-trees-and-structure.md#A14.1)). When the target tree has changed meanwhile, the guide says so on
  continuing; the suggestions are recalculated, the decided pairs stay.
- A merge that did not finish last time (a closed window, a crash) is reported by the app on the next opening: the
  tree and the file are unchanged.
- **Limits:** a GEDCOM file into an empty tree is still inserted through **Insert into tree** without the guide
  ([A2](A2-loading-a-family-tree.md)). Merging two people of one tree is a different matter
  ([A5.6](A5-tree-check.md#A5.6)).
- **Since:** app 3.32.0; before, a merge always created a new tree ([A8.1](#A8.1)). The earlier **Merge into another
  tree…** in ⋯ of Manage trees and **Merge view into…** were replaced in the same version by **Change structure…**.

<!-- zdroj: app:debf50cc (3.32.0) src/merge/ui.ts startMerge, repeatLine, resume, step6Env · src/merge/wizard-steps.ts stepInfo (přeskočené kroky) · src/merge/wizard-ui.ts title (titleImport, titleTrees, titleShare, titleCompare) · src/ui/import-export.ts openGedcomGuide (prázdný strom → showGedcomResultDialog), src/ui/merge-ui.ts (crashed, pendingMergeFound) · src/ui/share-ui.ts reviewChangePacketInMerge · strings.ts mergeWizard.steps, cntJoined, cntNew, cntSkipped, cntPending, cntTotal, comparing, comparingNote, stop, closeMsg, savedLater, resumeChanged, crashed, treeManager.mergeInto, menu.mergeViewInto, shareDiff.reviewDetail, merge.pendingMerges · CHANGELOG.cs.md 3.32.0 · dirigent:spec/134-bezpecne-slouceni-stromu §1–§13 · dirigent:test/vysledek-1123-scenare-app.md · app:52171573 (dotaz 10: větší okno, lišta kroků s počty, pod 1100 px číslem) · 6e36ad08 (V-N4: cílový strom v nadpisu, stavovém řádku, Porovnat, řádku rozpracovaného) · a9bc0b6b, f0c5a3fb (139: Sloučit do jiného stromu a Sloučit pohled do… nahrazené Změnit strukturu; mergeViewInto bez volajícího) · strings.ts structure.pendingRow -->

<a id="A8.5.1"></a>
### A8.5.1 A file or tree dropped with the mouse

A GEDCOM file and a Strom tree (`.json`) can be brought into the guide by dragging: onto the app's window, or onto a
tree's row in Manage trees. What happens is decided by the file and by the place where it is dropped.

- **On the app's window:**
  - one `.ged` file opens the guide **Import a family tree** with the target in the open tree (**New tree**, **Add to
    a tree**, **Only compare**);
  - one `.json` file is read first. A tree opens the same guide; an encrypted tree asks for the password first.
    The backup **Export all** and a package of changes from another Strom go the way of the JSON import. Another
    `.json` file is material for a research that accepts batches ([R11.4](R11-material-from-the-user.md#R11.4));
    otherwise the app says “{file} is not a readable family tree file (.json). Nothing changed.”;
  - several files at once go into a batch with a research that accepts batches; otherwise the first file decides;
  - while dragging, one file of the JSON type is taken as a tree: the banner above the window says that the guide
    opens, not a batch;
  - any other file is refused by the window: “Only GEDCOM files (.ged) and Strom trees (.json) can be dropped here.”
    The empty screen offers “Drop a .ged or .json file to open it”.
- **On a tree's row in Manage trees:**
  - a `.ged` or `.json` file dropped on a row opens the guide with the option **Add to a tree** and the tree of that
    row as the target. The open tree stays open; closing the guide returns to Manage trees;
  - a tree's row dragged with the mouse onto another row opens the guide **Merge trees**: the dragged tree is the
    import, the tree under it the target;
  - the row under a dragged file has a dashed outline and says what the drop does: “Drop: add {file} to the tree
    {tree}”;
  - a tree that cannot be written to now (locked, followed live, from a newer app version) does not become the
    target: the guide stays at the option **Add to a tree** with no target chosen, and the tile of that tree in
    step 1 says why. No other tree is chosen by itself;
  - a row dropped on itself, a drop by touch, or a drop in an app open read-only does nothing. The row's ⋯ menu
    stays.
- **Limits:** nothing is written without the guide; the write counts as any merge and can be undone ([A8.12](#A8.12)).
- **Controls:** dragging a file onto the window or onto a row of Manage trees; dragging a tree's row onto another row.
- **Since:** app 3.32.0

<!-- zdroj: app:b907d506 src/drop-route.ts dropRoute (guide-ged, json, batch, refuse), jsonDropKind (tree / šifrovaný, app-file: záloha Exportovat vše a balíček změn, other), dragLooksLikeJson · strings.ts onlyGedcom, dropHint, unreadableJson · app:73ee4625 src/tree-drop.ts treeRowDrop (sám na sebe, jen ke čtení nic), treeRowFileRoute, počáteční cíl (blokovaný strom nevybrán, důvod na dlaždici kroku 1, keepAdd) · src/ui/tree-management.ts (čárkovaný řádek, dotyk nic, ⋯ zůstává) · strings.ts mergeWizard.dropOnTree · dirigent:spec/134 K10.2, K10.3 -->

<a id="A8.6"></a>
## A8.6 Step 1: What to do

The first step chooses what to do with the import, into which tree, and what happens to a person already in the tree.

| Option | What happens |
|---|---|
| **New tree** | a new tree with the import's people is created; it will not be linked to a research; existing trees stay unchanged |
| **Add to a tree** | the import's people are added to the chosen tree (**Into which tree**) |
| **Only compare** | the same steps are gone through, but nothing is written (the tree, backups or files); the list can be saved at the end |
| **Save as JSON** | **Download JSON** downloads the converted data as a `.json` file; nothing is written to a tree |

- **What to do with a person already in the tree** (with **Add to a tree**):

  | Scope | For joined people | New people |
  |---|---|---|
  | **a) Only missing people** | nothing changes | added |
  | **b) Missing people and empty details** | only empty details are filled in | added |
  | **c) Decide detail by detail** | the differences are chosen in step 4 ([A8.9](#A8.9)) | added |
  | **d) Only enrich existing people** | details according to step 4 | no one new is added |

- **The tree will not take over:** what the app does not take over from the file is listed with a count and an
  example; **Save list…** saves the list. None of it is lost silently.
- **Swap** with two trees reverses what is added into what.
- The same file merged into the tree again is recognized by the guide, which says how many people are new; the people
  joined last time are not doubled. So only the people left out last time are added. The same holds for a tree: “The
  tree Horákovi was already merged into this one (12. 11. 2026). Only 5 people are new; 40 are joined with that
  earlier merge and will not be duplicated.”
- **Rules by program:** a GEDCOM file from a program for which a rule is saved has the scope and the choices of step 4
  filled in: “Filled in from the rule saved for files from {program} (can be changed).” ([A8.6.1](#A8.6.1))
- A copy of a tree and a tree without a research have in step 1 the description “copy of the tree “{name}” · no
  research”; at a target without a research stands “{tree} has no research: nothing is sent after the merge.”
  ([S1.10](S1-connecting-app-and-research.md#S1.10)).
- **Limits:** the target cannot be a locked tree (it can be unlocked in Manage trees) or a tree from a newer app
  version. A tree on which live following of the research is running right now (◎ **Follow the agent in the tree**)
  is read-only; for it the guide offers **Turn off following and merge here**: a backup is saved before writing,
  sending to the research is paused and the changes go there only after the choice in the last step. A copy of the
  research's tree and a tree without a research can be the target even while live following runs elsewhere. From
  a tree open read-only the import is possible only as a **New tree**.
- **Since:** app 3.32.0

<!-- zdroj: app:debf50cc src/merge/steps/step1-what.ts (mode, scope, notTaken, swap, repeat), src/merge/ui.ts repeatLine (isRepeatOf podle otisku souboru, importedBefore), src/merge/plan.ts:715–717 (d: updateOnly, a: joinedDetails none, b: empty) · strings.ts mergeWizard.modeNew, modeNewDesc, modeAdd, modeAddDesc, modeCompare, modeCompareDesc, modeJson, modeJsonDesc, btnJson, whichTree, existingWhat, scopeA–scopeD, scopeADesc–scopeDDesc, notTaken, notTakenNote, saveList, swap, repeat, blockLive, blockLiveAction, blockLocked, blockReadOnly, blockNewer · app:166fbffd, 5c4bcc0c (1123-134 bod 10: blokuje jen strom s běžícím sledováním, kopie stromu výzkumu jde; nabídka Vypnout sledování a sloučit sem) src/live-follow-block.ts · CHANGELOG.cs.md 3.32.0 („tentýž soubor sloučený znovu přidá jen osoby, které se minule vynechaly“) · spec 134 K0.7 · app:7b967fd8 strings.ts mergeWizard.repeatTree (134 N1 doplněk) · bcb2a0fa strings.ts research.copyOf, structure.mergeNoResearch · app:02165311 strings.ts mergeWizard.repeat, repeatTree (datum dřívějšího sloučení v závorce) · app:fcddfcab (Jen porovnat: otisk všech stromů, záloh a souborů před a po; writePlan/applyPlan plán porovnání odmítnou) src/merge/write.ts · app:ad0ea45a strings.ts mergeWizard.prefilledFrom -->

<a id="A8.6.1"></a>
### A8.6.1 Rules for the files of one program

The scope from step 1 and the rules of step 4 can be remembered for GEDCOM files from the same program. The next file
from that program starts the guide with them; they can be changed.

- **Saving:** in step 5, above the write button, stands the checkbox “Remember for files from {program}: scope c),
  My tree wins” (with rules by kind of detail “…, with exceptions by kind of detail”). Under it: “Next time step 1 is
  filled in with it (can be changed). Saved rules are in Settings → Data and privacy.” The checkbox is unticked by
  default, even with a filled-in step 1.
- **When it is saved:** only after the write; with **Only compare** after **Save the list…**. A closed guide saves
  nothing.
- **What is saved:** the scope and the rules for the whole merge and by kind of detail. Rules for one person or one
  value are not saved: they belong to the people of one tree. One rule holds for one program; a newer one replaces
  the older one.
- **Where:** in the settings of this device, not in the tree. **Settings** → **Data and privacy** → **Saved import
  rules** (“Fill in step 1 of the import guide for files from the same program.”) has a row for each program
  (scope · rules) with **Remove**. Without a saved rule the group is not shown.
- **Prefilling:** step 1 of the next file from the same program has the scope and the rules from the saved rule, and
  under the scope the sentence “Filled in from the rule saved for files from {program} (can be changed).” An
  unfinished merge keeps its choices.
- **Limits:** only a GEDCOM file that names the program that created it (the file's header, `HEAD.SOUR`), and only
  with **Add to a tree** and **Only compare**. A tree, a selection and a `.json` file name no program; **New tree** has
  neither a scope nor rules.
- **Controls:** step 5 of the guide; **Settings** → **Data and privacy** → **Saved import rules**.
- **Since:** app 3.32.0

<!-- zdroj: app:ad0ea45a src/merge/saved-rules.ts sourceProgram (jen ged s program), canRemember (add | compare, ne json), ruleFromChoices (scope, rules.all, rules.kind; ne osoba ani hodnota), applySavedRule, rememberLabel, savedRuleDetail · src/merge/steps/step5-plan.ts:549 (políčko nad tlačítkem, rememberNote) · strings.ts mergeWizard.rememberRules, rememberNote, rememberKinds, prefilledFrom, settings.rulesSetting, rulesSettingHint, rulesRowDetail, rulesRemove, groupData · dirigent:spec/134 K10.4 -->

<a id="A8.7"></a>
## A8.7 Step 2: Who is who

Step 2 shows the import's people in three groups, and a person decides about each pair. A join that is written is
always visible and can be undone.

- **Groups:** **Maybe the same** (score under 80), **The same** (score 80 and more, joined in advance) and **New**
  (without a match). The score and the reasons of a match are described in [A8.2](#A8.2).
- **Pair:** the person of the import and the person of the tree side by side in the rows **Name**, **Birth**,
  **Death**, **Parents**, **Partners**, **Children** and **Records**, with **Why yes:** and **What speaks against:**.
- **Decision:** **Same person** (S), **New person** (N), **Another person…** (A, join with another person of the
  tree) and **Do not add** (X); ↑ ↓ moves to the next pair.
- A decision recalculates the suggestions for relatives; decided pairs do not change.
- **Repeated merge:** merging the same source a second time recognises the people an earlier merge that was not
  undone brought or joined. They are in **The same** with the reason “Merged before from this source”, and nothing
  is doubled.
- **Why yes** names only what both records give: “Exact name and birth date” only with the same birth date on both
  sides, with only the year matching “Name and birth year”, otherwise “Exact name”.
- The **Remaining undecided** can be settled at once: “Remaining N undecided:” **Add as new (N)** (the guide warns
  that this can double people already in the tree), or **Do not add (N)**. Pairs with the same parents, child or
  partner are left out of the bulk decision; below the buttons stands “2 pairs with the same parents, child or partner
  need deciding one by one.” When only such pairs remain, only that sentence stays. While an undecided pair remains,
  step 3 does not unlock.
- **On a wider window:** above the pair is a row of controls (‹ hide the list · “Pair i of n” · group · ↑ ↓ ·
  decision), the tree's candidates are in rows (“2 candidates in the tree Horákovi”) and the pair's table scrolls by
  itself with a fixed header (the column “Import · {file}”). Relatives are row by row, of the records the first three
  and “N more ▸” / **Collapse**. The rest of the undecided is in the footer of the list; the list can be folded into a
  narrow bar (**Hide the list of pairs** / **Show the list of pairs**). On a phone the step is unchanged.
- **Where the step opens:** when an undecided pair waits in **Maybe the same**, step 2 opens there, on the first of
  them (also after returning from step 1 or from a later step, and with an unfinished merge); otherwise on the group
  shown last. A group switched by hand inside the step stays.
- **To decide N** in the counts (on a phone the row of counts) and “· N to decide” under step 2 lead to the first
  undecided pair in **Maybe the same** (on a phone to its header). When only unlinked groups remain, they lead to
  step 3. At 0 and after the write they lead nowhere.
- **Partner of a joined person:** when a person of the import is joined and their shared children are too, their
  partner from the import is offered in **Maybe the same** with the other parent of those children in the tree, with
  the reason “Partner of a joined person, shared children”, even with a different surname (birth × married).
  Conditions: the sex does not differ and one given name is the same (an initial or a short form of the name only
  with a similar surname, or when it is the partner's married surname). The score is under the threshold of 80, so
  a person decides. A weaker pair of another person without such evidence (a namesake, a sister-in-law) gives way.
  A husband confirmed or chosen by hand in step 2 brings the wife this way too.
- A pair joined in step 4 with **Same person** ([A8.9](#A8.9)) has in step 2 the reason “same person, chosen in
  step 4”.
- **Limits:** with **New tree** the step is skipped: all people are new.
- **Since:** app 3.32.0

<!-- zdroj: app:debf50cc src/merge/steps/step2-who.ts pairRows (AUTO_CONFIRM_SCORE → same, jinak maybe), decisions, recalc, rest · src/merge/executor.ts AUTO_CONFIRM_SCORE = 80 · src/merge/wizard-steps.ts stepInfo (step2 skip newTree, person-pending blokuje) · strings.ts mergeWizard.grpMaybe, grpSame, grpNew, rows, whyYes, whyNo, decSame, decNew, decOther, decSkip, decKeys, keysHint, recalc, restLabel, restAdd, restSkip, restAddWarn, sameNote · spec 134 §4 · app:1046e99b (1123-134 N1, N3) strings.ts merge.matchReasons.merged_before, exact_name, exact_name_gender_birthdate, name_gender_birthyear · app:878f29b7, f6dc2c4f strings.ts mergeWizard.restOneByOne (134 N2: stejní rodiče, dítě, partner) · 0af3e450, 642b2d05 (dotaz 10: řádek ovládání, candidatesIn, importCol, recordsMore, recordsLess, pairsHide, pairsShow, zbytek v patě) · app:e1c98f45 (K10.5: otevření na první nerozhodnuté dvojici Možná stejní, jinak skupina naposled; K rozhodnutí N a · N k rozhodnutí jako tlačítka, jen nenapojené → krok 3, při 0 a po zápisu nic) strings.ts mergeWizard.cntPending, subPending · app:fd66ae63 (K10.6: partner spojené osoby se společnými spojenými dětmi, pod AUTO_CONFIRM_SCORE, pohlaví, jedno křestní jméno, iniciála či zkrácený tvar jen při podobném příjmení nebo příjmení po sňatku; slabší dvojice ustoupí; manžel potvrzený v kroku 2 přivede manželku) strings.ts merge.matchReasons.partner_shared_children · app:d6333eab strings.ts mergeWizard.joinedInStep4 · dirigent:spec/134 K10.5, K10.6 -->

<a id="A8.8"></a>
## A8.8 Step 3: Whom to add

Step 3 chooses which new people are added. A new person whom nothing links to the tree is not added without a
decision.

- **Whom the selection takes:** **All new**, **Only linked, within N steps** (only people linked to the tree through
  at most N relatives), **Ancestors of…**, **Descendants of…** (with the number of generations), **Family /
  surname…** and **By hand**. Selecting ancestors, descendants or a family unticks the other new people.
- **Linked new:** a list of the new people with their path to the tree (“links via …”), search, **Filters**
  (**Surname**, **Years**, **Place**, **With a source**, **Linking**, **Living**), **Leave out living (N)** and a
  **Preview** of the branch.
- Unticking a person through whom others link to the tree asks: **Leave them out too**, **Keep them as unlinked**,
  **Keep …** or **Keep as “?”** (a linking “?” without details stays in the person's place and the relatives stay
  linked).
- **Unlinked groups:** people without a path to the tree's people, by family. Each group needs a decision: **Link to a
  person…** (a person of the group is a parent, child or partner of a person of the tree), **Add unlinked**,
  **Separate tree** (a tree of its own after the write) or **Do not add**. An undecided group holds up the write.
- **Limits:** a link that would give a child a third parent is not written. The scope **d)** adds no one new and
  skips the step. With **New tree** the step takes all people.
- **Since:** app 3.32.0

<!-- zdroj: app:debf50cc src/merge/steps/step3-whom.ts, step3-model.ts, src/merge/plan-select.ts (scope d → 'scope', :392), src/merge/wizard-steps.ts (step3 skip allNew, group-pending) · strings.ts mergeWizard.vAll, vLinked, vAnc, vDesc, vRod, vManual, variants, pickAnc, pickDesc, pickRod, generations, tabLinked, tabGroups, linksVia, skipLiving, s3Tools, fSurname, fYears, fPlace, fSource, fLinking, fLiving, previewBtn, branchPreview, unlinkTitle, unlinkAll, unlinkLoose, unlinkKeep, unlinkQ, unlinkQDesc, groupsLead, gConnect, gLoose, gOwn, gSkip, relParent, relChild, relPartner, connectThird, groupsWhy · spec 134 §5, §6 -->

<a id="A8.9"></a>
## A8.9 Step 4: Who is right

Step 4 decides the details that the joined people have differently. Without a person's choice the tree wins.

- **Rules:** **My tree wins** (default), **The import wins**, **Keep both** (the import's value is saved beside it,
  “The import says: …”), **More precise, if not contradicting** and **Decide one by one**.
- A rule can be given to the whole merge, to a kind of detail (**Name**, **Birth**, **Death**, **Places**,
  **Events**, **Notes**, **Photos**, **Sex**, **Marriage**), to a person and to a single value. A narrower rule wins:
  whole → kind of detail → person → value. Each rule shows how many differences stay, change or are saved beside.
- **Protected details:** a detail in the tree marked “proven”, “confirmed” or “from the research” is not changed by a
  bulk choice; it can be changed only one by one. Overwriting a proven detail asks **Overwrite a documented
  detail?**; after the write the detail is “From a family tree” and the record stays with the person as a source.
- **Relationship conflicts** (other parents, a second partner, a different marriage, a third parent, an
  ancestor–descendant loop) are not decided by a bulk choice: **Keep mine**, **From the import** or **Both** is chosen
  at each row. A loop is never written.
- **Children of one couple:** children whose parents have the same conflict (a third parent, other parents) are one
  row with a count (“third parent · 6 children”, the names of the first three and “+3”) and are decided once for all
  of them. The count of conflicts in the step counts rows.
- **Same person:** at a third parent or a second partner who is new to the tree, when on the other side stands one
  person of the tree whom the import does not know, there is in addition the choice **Same person**. It joins both
  people as a decision of step 2 (a pair chosen by hand, saved with the merge like any other). Conflicts that this
  removes disappear and the counts are recalculated. Under the conflicts stands “Joined as the same person: {person of
  the import} = {person of the tree}” with **Undo** (it restores the decision that held before). It is not offered with
  a different sex, at a person of the tree already joined with someone else, at a join that would make a loop, nor at
  a linking “?”.
- **Limits:** with the scopes **a)** and **b)** the step is skipped; when there are relationship conflicts, it shows
  only them. With **New tree** it is always skipped.
- **Since:** app 3.32.0

<!-- zdroj: app:debf50cc src/merge/steps/step4-rules.ts (relOnly, s4SkippedTitle, protected), src/merge/plan.ts:438 relationConflicts, :534 (scope a), :542 (scope b jen prázdné) · src/merge/wizard-steps.ts step4 (newTree, scope a/b skip) · strings.ts mergeWizard.ruleAll, ruleOrder, rMine, rImport, rBoth, rPrecise, rEach, rDefault, importSays, kinds, protectedLine, protKinds, protTitle, protText, protAfter, relConf, relKinds, relAlways, keepMine, fromImport, both, loopNever, step4Skipped, s4SkippedTitle, relOnly · spec 134 §7, K0.3 · app:d6333eab (K10.7, K10.8: děti jednoho páru se stejným rozporem jeden řádek, počet řádků; Stejná osoba u třetího rodiče či druhého partnera, spojení jako rozhodnutí kroku 2, Zpět; ne jiné pohlaví, osoba spojená s jiným, smyčka, „?“) strings.ts mergeWizard.relChildren, samePerson, samePersonTitle, joinedSame, undoSame · dirigent:spec/134 K10.7, K10.8 -->

<a id="A8.10"></a>
## A8.10 Step 5: What will happen, and the write

Step 5 shows the whole list of changes by group. The write happens only with its button, and only what the list
shows.

- **List:** **New**, **Joined**, **Detail changes**, **Filled-in details**, **Joined sources**, **Couples and
  links**, **Sources**, **Places**, **Photos and files**, **Not added** (for each person why: the step and the choice)
  and **Not taken over**. An item can be unticked. **Save the list…** saves it as text (`.txt`) and as data (`.json`);
  the text ends with the counts in words (“Joined 40 · New 5 · Not added 0 · To decide 0 · = 45 people in the
  import”).
- **Filled-in details** (only when there are some): empty details of joined people that the write fills in, row by
  row person · detail (e-mail, other forms of the name, events, sources, an open question…).
- **Joined sources:** a source of the source tree is joined only with the same source of the target tree (the same
  research number, citation, or title, archive and place): “1 source joined with an existing one”. The group
  **Sources** lists only new ones. The sources of the source tree are not joined with each other: two records of one
  register that differ only in the research's source number stay two. So the result has the same sources whatever
  the direction (**Swap**).
- **The totals match everywhere:** new couples and detail changes are the same number in step 5, in step 6, in the
  merge's record and in the undo dialog as what is written. A linking “?” without children and the scope **d)**
  neither add nor report a couple; two people of the import joined with one person change a detail once (in step 4
  too).
- Another photo with the same name and size is in **Detail changes** as “Photo: photo (3222) → another photo of the
  same name and size” (in step 4, in Merge history, in the undo and in the saved list too).
- **Where to write:** **Write into …**, or **Write into a new tree** (a copy of the target tree with the import; the
  target tree stays unchanged).
- **Backup:** before writing into the tree the backup **Before merge** is made, always, even with automatic backups
  turned off. It stays as long as the merge can be undone; backup rotation does not delete it. When there would be no
  room for it, the guide asks (**Keep both (over the limit)** or **Delete the oldest other backup**). Without a backup
  nothing is written: “The backup failed, so nothing was written.”
- **Safeguards:** when the target tree has changed meanwhile, the list is recalculated and nothing is written
  blindly. Before saving, the totals and the references are checked; when they do not match: “The totals do not
  match: nothing was saved.” Closing the window during the write breaks nothing: the write finishes, or nothing is
  written.
- The write is one **Undo** step.
- **Remember rules:** at a GEDCOM file that names its program, above the button stands “Remember for files from
  {program}: …” ([A8.6.1](#A8.6.1)).
- **Limits:** with **Only compare** the main button is **Save the list…**: it saves the list and closes the guide.
  Nothing is written: the tree, backups and files stay as they were, and the app does not let a comparison plan through
  to the write. The check does not count the empty details filled in by the scope **b)** into **Detail changes**.
- **Controls:** the button “Add N people, change M details”, with filled-in details “…, fill in F”, for a new tree
  “Create a tree with N people”.
- **Since:** app 3.32.0

<!-- zdroj: app:debf50cc src/merge/steps/step5-plan.ts (skupiny, retentionAsk, targetChanged), src/merge/write.ts (backupBeforeMerge keepFor, storageFull, badTotals, one undo step strings.undo.mergeTrees) · src/data.ts:2047 backupBeforeMerge (bez ohledu na automatické zálohy, keepFor mimo rotaci) · src/snapshots.ts planRetention (keepFor se nesmaže) · strings.ts mergeWizard.gNew, gJoined, gFields, gLinks, gSources, gPlaces, gMedia, gSkipped, gNotTaken, skipWhy, whereTo, writeInto, writeNew, writeNewDesc, backupLine, savePlan, btnWrite, btnNewTree, backupFailed, retentionAsk, keepBoth, dropOldest, targetChanged, replanned, writingSafe, badTotals · dirigent:test/vysledek-1123-scenare-app.md N1 (doplněná prázdná pole se v kroku 5 nepočítají) · spec 134 §8, K0.2, K0.4, K0.5 · app:235afcd5 (134 N4, S-N2, S-N1: gFills, btnWrite …, doplnit F, jeden počet párů a údajů) · 834ceab8 (134 S-N3: gSourcesJoined, sourcesJoinedSum, prameny zdroje se mezi sebou nespojují) · a2567f81 strings.ts mergeWizard.otherPhoto · app:fcddfcab (K10.1) src/merge/write.ts (plán compare se nezapíše), src/merge/plan-export.ts exportPlan (počty slovy cntTotal), src/merge/ui.ts savePlan (.txt a .json), src/merge/wizard-ui.ts primary (compare: savePlan, finishCompare) · app:ad0ea45a step5-plan.ts merge-s5-remember -->

<a id="A8.11"></a>
## A8.11 Step 6: What happened, and Merge history

After the write, step 6 says what happened, and the merge stays in the tree as a record that can be returned to later.

- **What happened:** “Written into the tree …” and “The totals match: N people in the import = joined + new + not
  added”; the backup **Before merge** is in Backups.
- **Actions:** **Show in the tree**, **Save as a list of people** ([A11](A11-lists-of-people.md)), **Check the
  tree** ([A5](A5-tree-check.md)) and **Undo the merge…** ([A8.12](#A8.12)).
- After merging another program's file into an existing tree the card **What next** does not show; the data check is
  here. A new tree from another program's file gets the card ([S6.4](S6-tree-from-another-program.md#S6.4)).
- Step 6 and Merge history also list **Filled-in details** and the number of joined sources, with the same numbers as
  step 5.
- **Merge history:** each merge into the tree with its date, source, counts (new, joined, details) and the state
  **stands**, **partly undone** or **undone**. At a merge **Open the list** and **Undo…**; in the window also
  **Backups…** and **Change history…**. Backups restore the whole tree; here only what one merge brought can be
  undone.
- **Limits:** the tree carries the record of merges from data version 26; older app versions open such a tree
  read-only. Merges from before app 3.32.0 are not in the history.
- **Controls:** the tree's actions → **Merge history…** (only for a tree that has merges); Manage trees, ⋯ at the
  tree → **Merge history…**.
- **Since:** app 3.32.0

<!-- zdroj: app:debf50cc src/merge/steps/step6-done.ts (notes inHistory, noNextCard), src/merge/ui.ts step6Env (noNextCard = !newTree && gedcom) · src/ui/tree-actions.ts:199 menuHistory (jen se záznamy) · src/ui/merge-history-ui.ts · strings.ts mergeWizard.doneTitle, doneTotals, doneBackup, showInTree, saveAsList, checkTree, undoMerge, inHistory, noNextCard, menuHistory, histTitle, histLead, stValid, stPartial, stUndone, histCounts, openList, undoEllipsis, histBackups, histChanges · CHANGELOG.cs.md 3.32.0 (datová verze 26) · spec 134 §9 · app:235afcd5, 834ceab8 (doplněné údaje a spojené prameny v kroku 6 a historii) -->

<a id="A8.12"></a>
## A8.12 Undoing a merge

**Undo the merge** takes back only what one merge brought. Work done after the merge does not disappear.

- **What is undone:** **Removed**: the new people of the merge with its couples, sources, places and files;
  **Restored**: the changed details, back to their value before the merge; **Restored in the tree**: the tree's
  couples, people, sources and files the merge linked to, as they were before it; **Joins undone**: the tree's people
  stay, only without the import's details.
- **Stays because it changed since:** a person or a detail edited after the merge, a confirmed detail, a person with
  a new relative, a thing a later merge builds on, and a thing cited by something that stays. For each item
  **Keep** or **Undo** can be chosen.
- A picture the merge replaced is brought back only by the backup **Before merge**. The guide also shows the
  difference from restoring the backup: the backup would also revert everything else done in the tree since the
  merge.
- **Undo everything**, or **Choose only some…** (only what is ticked is undone). A partly undone merge can be undone
  further. The undo takes the backup **Before undoing a merge**, always, even with automatic backups turned off;
  rotation does not delete it while the merge can be restored. The undo is in the change history and can be reverted
  (**Redo the merge**).
- **Limits:** a locked tree can be undone after unlocking in Manage trees; a read-only tree once it can be edited.
  When a later merge builds on the merge, the guide says so. Undoing a merge that is already in the research is
  described in [A8.13](#A8.13).
- **Controls:** step 6 → **Undo the merge…**; **Merge history…** → **Undo…**; the button “Remove N people”.
- **Since:** app 3.32.0

<!-- zdroj: app:debf50cc src/merge/undo-plan.ts, src/merge/undo-view.ts, src/ui/merge-history-ui.ts (zápis se zálohou write.ts writeUndo, AuditLogManager, toast s redo) · strings.ts mergeWizard.undoTitle, undoLead, uRemove, uRestore, uUnjoin, uRemoveDesc, uRestoreDesc, uUnjoinDesc, uKeepHead, uEdited, uProven, uRelative, uLaterMerge, uUsed, uPicture, segKeep, segUndo, vsBackup, pickSome, pickAll, pickLead, btnUndo, builtOn, partlyDone, lockedUndo, undoReadOnly, undoNothing, undone, redo · spec 134 §10 · app:235afcd5 strings.ts mergeWizard.uTree, uTreeDesc · e2a6d712 strings.ts backups pre-merge-undo „Před odvoláním sloučení“ (134 N5, keepFor) -->

<a id="A8.13"></a>
## A8.13 A merge into a tree with a research

Into a tree linked to a research the merge is written in the app, and nothing goes to the research by itself. A person
decides about sending in step 6.

- The tree's link to the research stays. New people and links wait in the app (“not sent to the research · N
  people”) until **Send to the research…** or **Keep in the app for now** is chosen.
- Details go to the research as “From a family tree (unverified)”, never proven. The research's people keep their
  numbers, the state of their details and their citations. The research gets the changes through the bridge; no
  agent is started. When the agent is working right now, sending waits until it finishes its step.
- A research of an older version does not know sending after a merge: the whole tree is sent via **What will be
  sent** ([S1](S1-connecting-app-and-research.md)).
- **What will be sent:** the opening sentence has the same numbers as the list below it: “To the research Horákovi:
  5 new people, 2 other people changed, 3 couples, 4 sources.” A linking “?” is not a new person; a new couple is
  counted with its partners, and **Couples** are only the couple's own changes. Without an exact list the sentence
  stays with what the merge brought.
- **Undo before sending:** the research gets nothing. **After sending:** the research does not delete people by
  itself. The undo in the app also removes the people to whom the sending gave a research number (the number is not
  an edit). The dialog says “The merge was sent to the research on {date}, so the research has its people. An undo in
  the app does not remove them there.” and “In the app the undo happens at once. In the research one step in the
  research’s terminal is needed:” with the command `strom sync undo I0042` and **Copy**; with a known input number
  also **Take back in the research**, otherwise `I…` and where to find the number (`strom input list`). The notice
  “Merge undone…” offers **Take back in the research**. Otherwise the dialog points to the help **A person removed in
  the app** ([S2.6](S2-edits-from-the-app.md#S2.6)). Until then the research brings the people back with its next
  version and the app offers them for removal.
- **Limits:**
  - a **New tree** from an import will not be linked to a research; writing into a new tree (a copy of the target with
    the import) is a copy without a research ([S1.10](S1-connecting-app-and-research.md#S1.10));
  - a copy of a tree from the research and a tree without a research send nothing after the merge;
  - when the source is linked to a research and the target is not, the link does not carry over to the target; the
    guide offers **Swap**;
  - when both trees are linked, neither the source's link nor its numbers carry over, and the source's people are new
    in the target's research;
  - when the same people are also in another tree linked to a research, the guide points this out.
- **Since:** app 3.32.0

<!-- zdroj: app:debf50cc src/merge/ui.ts step6Research (mergeHold, unsentMerges), src/merge/research-hold.ts, research-marks.ts, same-people.ts · strings.ts mergeWizard.researchKept, resStep5, resPending, sendRes, keepLocal, notSent, resSendLead, resSendNote, resSent, resUndoStep, resUndoHelp, resUndoHelpLink, resComesBack, copy, resAgent, resOld, resNewTree, resSwap, resSwapBtn, resTwo, resSamePeople, modeNewDesc · src/help/topics.ts:38 HELP_LINKS.mergeUndoResearch = 'S2.6' · undoResearchStep (jen záznam I\d+) · research:src/commands/sync.ts:627 sync undo · spec 134 K9.1–K9.6 · app:7a317a1e resSendLeadList (134 V-N5) · 20fb4782 (134 V-N3: číslo výzkumu není úprava, resSent, resUndoStep) · fd794063, 023879dd src/ui/research-undo-step.ts (Kopírovat, undoStepInput, undoStepRun, hlášení odvolání) · f3c66503 (zápis do nového stromu = kopie bez výzkumu) -->
