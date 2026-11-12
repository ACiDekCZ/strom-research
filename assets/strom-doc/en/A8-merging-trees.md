<a id="A8"></a>
# A8 Merging trees

How the Strom app merges two family trees: a GEDCOM file with a tree, two trees, or a view with a tree. Describes the
app 3.21.2; changes from a later version carry its number. Merging a duplicate person within one tree is a different matter
([A5.6](A5-tree-check.md#A5.6)).

<a id="A8.1"></a>
## A8.1 A merge always creates a new tree

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

<!-- zdroj: app:src/merge/executor.ts:211 executeMerge (mergeSourceCatalogs, places, mergePlaceRecords, mergePlaceAliases, addSurnameGroup, delete defaultPersonId/defaultView) · src/merge/ui.ts countNewMergeIssues · strings.ts merge.preValidationWarning, merge.newIssues · git v1.19.0 (00e5d38) · 3.27.0: app:dde0151a src/merge/executor.ts sourceKey bez quality, takeCitationQuality, remapCitations; app:5721b016 unionCitations -->
