<a id="S3"></a>
# S3 What the research knows

The chapter describes what the app shows about a person from the research: the dialog **What the research knows** with
the sections **Above the person**, **Conflicts**, **Hypotheses** and **Searched**, and the section of the same name in
the research panel. Describes the Strom app 3.21.2 (and the research 1.25.2). Changes from a later version carry its number.

<a id="S3.1"></a>
## S3.1 What the research knows only reads what the research sent

For each person the research adds special blocks to the family tree for the app: conflicts, hypotheses, searched
sources and the edge of the tree above the person. The app only shows them. Nothing in them changes in the app and the
app does not send them back; they live in the research. The dialog's header carries the date of the research "as of
{date}".

- **Where from:** from the bridge (the family tree the app loads from the running research, see
  [S1](S1-connecting-app-and-research.md)) or from the file `output/tree-strom.ged`. Both come from the same export of
  the research.
- **What the dialog does not show:**
  - levels of certainty of facts ([R3.1](R3-verification-and-citation.md#R3.1)) and evidence
    ([R3.8](R3-verification-and-citation.md#R3.8));
  - **Awaiting action** ([R6](R6-awaiting-action.md));
  - directions and the queue as a whole ([S4](S4-research-from-the-app.md)); the person's directions and tasks are
    only in the section **Above the person** ([S3.3](#S3.3)).
- **Limits:**
  - A family tree from another program and a copy without the research's blocks do not have the dialog.
  - Conflicts may be taken from a newer version of the research that the app has read but not loaded yet
    ([S2](S2-edits-from-the-app.md)). A conflict decided from the app disappears at once, even before the new version
    is loaded. The dialog can thus differ from the loaded data.
- **Controls:** app: nothing to set. Terminal: the file is created at every write of the research.
- **Since:** app 3.4.0 with research 1.6.0

<!-- zdroj: app:src/ged-parser.ts:185-335 _STROM_CONFLICT/_STROM_HYPO/_STROM_SEARCHED/_STROM_EDGE, :2351-2375 _STROM_ASOF · src/ged-exporter.ts (bloky nepíše) · src/ui/research-sync-ui.ts:2908-2937 researchConflictsOf, researchConflictsShown, settledConflicts · research:src/gedcom/export.ts:760-805 known() · src/commands/output.ts:94 · src/core/live.ts (hlavička: "The app never sends them back") -->

<a id="S3.1.1"></a>
### S3.1.1 When the research sends the blocks

The research adds the blocks only to the family tree for the Strom app, and only when the app can show that part. It
follows the version of the app it knows.

| Part | App from | Research from |
|---|---|---|
| conflicts, searched sources, "as of" | 3.4.0 | 1.6.0 |
| **Above the person** | 3.6.0 | 1.9.0 |
| hypotheses with versions and the switch **Show** | 3.11.0 | 1.14.0 |

- **Limits:** an unknown version of the app and another copy of the app (its own address of the app) are taken as
  current.
- **Since:** research 1.6.0

<!-- zdroj: research:src/core/stromapp.ts APP_OPENS_LINKS="3.4.0", APP_SHOWS_EDGES="3.6.0", APP_SHOWS_HYPOTHESIS_LINKS="3.11.0" · src/commands/output.ts:94 appOpensLinks, appShowsEdges -->

<a id="S3.2"></a>
## S3.2 Where What the research knows opens

The dialog opens from the person menu, submenu **Research → What the research knows**. The item is there only when the
research knows something about the person: at least one conflict, hypothesis, searched source, or the section **Above
the person**. It carries open conflicts as a number, e.g. "2 conflicts".

- **Other ways into the dialog** (each opens it at its own place):
  - the mark **conflict ›** at a field when editing a person (at the date and place of birth and death, the name,
    sex, title and name suffix): a single conflict that can be decided by a side opens the conflict card, otherwise
    the dialog;
  - the person menu, the block of signals "n conflicts · n hypotheses" with the link **What the research knows ›**;
  - the stub of the research edge above the card opens the section **Above the person** ([S3.3](#S3.3));
  - at a link shown in the view only, **What research knows about the link**, and the line label "unproven"
    ([S3.5.1](#S3.5.1));
  - the conflict card, **More in What the research knows ›**;
  - a row of the section in the research panel ([S3.7](#S3.7)).
- **Limits:**
  - Reading works everywhere: on a phone, in a locked family tree and in a read-only one.
  - Buttons that open the research are only on a computer (a device without a touch pointer), with **Strom Research
    on this computer** on, and only those the research announced ([S1](S1-connecting-app-and-research.md)).
  - An island alone (a family outside the tree) does not add the item to the menu.
- **Controls:** app: person menu → **Research → What the research knows**.
- **Since:** app 3.4.0
- **From app 3.22.0:** at the top of the submenu **Research** are the directions the person is in.

<!-- zdroj: app:src/ui/person-research-ui.ts:140-150 personResearchKnows, markResearchConflicts · src/ui/context-menu.ts personSection · src/ui/card-signals-ui.ts · src/card-signals.ts:171-194 · src/ui/view-links-ui.ts:326 · src/renderer.ts:5479 · src/ui/research-edge-ui.ts:205, :364 · src/ui/conflict-panel-ui.ts:274 · src/ui/research-ui.ts:2119 researchLinkAvailable · HEAD context-menu.ts personInLineItems (spec 038 §5.1) -->

<a id="S3.3"></a>
## S3.3 Above the person shows where the tree ends and what comes next

The section is at a person above whom the tree does not continue: the person has no parents, only one, or no record
supports the parents. It says why the search stops here and what happens next.

- **Why it ends:** e.g. "Father not named in the entry", "The registers did not survive", "Known registers begin
  1784", "A gap in the registers", "Searched, not found", "An archive remains", "Partly searched", "Not searched
  yet", "Birthplace unknown", "The parents are not documented by a record". A limit of the direction replaces it:
  "The direction's limit ends here", "The direction is paused", "The direction has ended", "Probably living, not
  researched" ([R2.1.2](R2-lines-and-queue.md#R2.1.2)).
- **What next:** "The agent is working on it right now", "Waiting for an answer", "In the queue as no. 3", "A task
  will be added with the next session", "Waiting outside the queue (paused direction)", "Strom has nothing more to
  suggest. A decision is needed.", "Nothing is planned". The app computes it live from what the research is doing
  right now.
- **Timeline "Baptism 1780–1800":** the years where a baptism is searched for, with the legend *searched, not found*
  / *no registers* / *not searched* and an estimate of the year of birth (▲, e.g. "estimate 1790 from the marriage
  1815").
- **Known birth registers** with access: *free online*, *online, login*, *reading room*, *on request*, *not
  preserved*.
- **Tasks:** the position in the queue, or why it stands (*paused direction*, *ended direction*, *family outside the
  tree*, *put off until …*); finished ones under **Tried tasks · n**.
- **Work:** the number of searches, the number of the agent's sessions with the cost, "last {date}". In an archive
  there are neither sessions nor cost.
- **Hypotheses:** a possible link to another person, a family outside the tree ("family outside the tree, 4
  people"), how many tasks are waiting, which tasks test the hypothesis.
- The link "2 open conflicts ↓" scrolls to the section **Conflicts**.
- **Limits:** "as of {date}" is in the section header only when the research is older than today.
- **Controls:** app: **Settings → Tree view → Research edge** (*Off* / *To decide* / *All*) controls only the stubs
  above the cards, not this section. The option is only for a family tree from the research. *To decide* is missing
  for a copy that has no queue. Terminal: `strom edge`.
- **Since:** app 3.6.0 with research 1.9.0; several families outside the tree from app 3.13.0 with research 1.16.0

<!-- zdroj: app:src/ui/research-edge-ui.ts researchEdgeSectionHtml, :372-373 stale asOf, :445-448 sessions/cost, edgeOf · :560-600 nastavení · index.html:22496, :22540 · strings.ts researchEdge.* · research:src/core/edge.ts EDGE_MISSING, EDGE_SCOPES, EDGE_ENDS, EDGE_NEXT · CHANGELOG 3.13.0 -->

<a id="S3.3.1"></a>
### S3.3.1 Actions at Above the person

| Button | When it is there | What it opens |
|---|---|---|
| **Chat** (**Decide in the chat** when "A decision is needed") | always | a conversation with the agent about the person |
| **Person review** | always | a review of the person in the research |
| **Resume the direction** | the direction is paused or ended | the terminal with the choice of the direction |
| **Answer** | a task of the person waits for an answer | the task in the research ([R6](R6-awaiting-action.md)) |

- **Limits:** only for a person from the research, only where the research announced the link ([S3.2](#S3.2)). In an
  archive and in a research waiting for an agent there are none, because each leads to the agent.
- **Controls:** app: the buttons under the section.
- **Since:** app 3.6.0
- **From app 3.22.0:** **Resume the direction** resumes the direction right through the bridge when the research can
  do it, without the terminal.

<!-- zdroj: app:v3.21.2 src/ui/research-edge-ui.ts:489-506, :539-548 · HEAD research-edge-ui.ts managesDirections -->

<a id="S3.4"></a>
## S3.4 Conflicts

The section **Conflicts** shows the conflicts of the person and of the families where the person is a partner. Open
ones come first, then decided ones with the row "decided: {value} ({source})". The source can be opened in the source
viewer. What a conflict is, where it is visible and how it is decided is described in [R5.6](R5-conflicts.md#R5.6).
Deciding by a side from the app is described in [R5.6.1](R5-conflicts.md#R5.6.1).

- **Limits:** **Decide in the research** and **Leave it to the agent** are only for a person from the research and
  only where the research announced them.
  **Leave it to the agent** is missing in an archive and in a research waiting for an agent.
- **Controls:** see [R5.6](R5-conflicts.md#R5.6).
- **Since:** app 3.4.0 with research 1.6.0
- **From app 3.22.0:** a conflict that arose from an edit in the app carries the text "An edit made in the app
  differs from the research here; this is decided in the research." (until now always "The sources disagree here;
  this is decided in the research.").

<!-- zdroj: app:src/ui/person-research-ui.ts showPersonResearchDialog (Rozpory), activeResearchNoAgent · research:src/gedcom/export.ts:760-805 · HEAD person-research-ui.ts conflictFromEdit, strings.ts conflict.editOnly · HEAD research-decide.ts conflictFromEdit -->

<a id="S3.5"></a>
## S3.5 Hypotheses

The section **Hypotheses** shows the hypotheses that concern the person: the person is their subject, or some version
names the person. Each hypothesis can be expanded. Under the title are the number and the state: *open*, *decided for
B*, *abandoned*, the number of versions and a note. Open ones are expanded.

- **Row of a version:** the letter and the claim (a long one expands) and what the version does with the tree:
  "shown · + 2 people · Find", "+ 2 people", "The tree records this already", "Text only, cannot be shown.", "no link
  to people in the tree", for a decided one *chosen*, "Now linked for real", "No longer valid: …".
- **Which hypotheses the research sends:** open ones; decided and abandoned ones only those whose versions carry
  links. Withdrawn ones never.
- **Who decided:** a hypothesis the agent decided ([R10.3.2](R10-people-and-hypotheses.md#R10.3.2)) carries *decided
  by the agent* with the day and **Reason** (the text of the decision in the research's language; a long one expands).
- **Limits:** a hypothesis cannot be decided from the app; it is decided in the research, in the terminal
  ([R10.3.1](R10-people-and-hypotheses.md#R10.3.1)). Who decides, a person or the agent, is a choice of the research
  ([R10.3.2](R10-people-and-hypotheses.md#R10.3.2)).
- **Controls:** app: the switch **Show** at a version ([S3.5.1](#S3.5.1)); **Decide in the research**, at a decided
  one **Change in the research**, opens the hypothesis in the research on this computer.
- **Since:** app 3.11.0 with research 1.14.0 (versions, state, **Show**); the list of hypotheses from app 3.4.0
- **From app 3.25.0:** *decided by the agent* with the reason (with research 1.29.0), **Decide in the research** and
  **Change in the research**.

<!-- zdroj: app:src/ui/person-research-ui.ts researchHypothesesHtml · strings.ts research.hypo*, hypoByAgent, hypoReason, hypoChange, decideInResearch, viewLinks.* · research:src/gedcom/export.ts:309-325 hypothesisPeople, _BY agent / DECI / _AT (brána APP_SHOWS_HYPOTHESIS_DECIDER) · CHANGELOG 3.11.0, 3.25.0 -->

<a id="S3.5.1"></a>
### S3.5.1 Show: linked in the view only

The switch **Show** draws a version of a hypothesis into the tree as "Linked in the view only". The family tree's data
do not change. The versions of one hypothesis exclude each other; at most one can be on, or none.

- **Limits:**
  - the switch is only at an open hypothesis and only at a version that can be drawn;
  - it is drawn only in the views Family and Descendants ([A6](A6-views.md));
  - the choice belongs to the device and the family tree; it goes with the backup of everything, not with a copy of
    the family tree;
  - with the bridge only when the research sends the links of hypotheses.
- **Controls:** app: **Show** in the dialog; at a drawn link the menu **What research knows about the link**.
- **Since:** app 3.11.0 with research 1.14.0

<!-- zdroj: app:src/view-links.ts strom-view-links:{treeId}, strom-view-links-master:{treeId}, viewLinksAvailable (HYPOTHESIS_LINKS) · src/ui/view-links-ui.ts:326 · strings.ts viewLinks.state -->

<a id="S3.6"></a>
## S3.6 Searched

The section **Searched** is a table of searches the research wrote for the person: **Record**, **Years**, **Result**
(*found* / *nothing*). It is sorted by the first year. It includes searches from tasks whose subject is the person.

- **Limits:** the research tells apart more results than the app shows. *found* is only a found record. Everything
  else, a partial search or one without a conclusion too, is *nothing*. What a search without a result is, is
  described in [R3.6](R3-verification-and-citation.md#R3.6).
- **Controls:** app: reading only. Terminal: the agent writes the searches.
- **Since:** app 3.4.0 with research 1.6.0

<!-- zdroj: app:src/ui/person-research-ui.ts (Prohledáno) · src/ged-parser.ts _STROM_SEARCHED (TITL, DATE, RESN, _AT) · research:src/gedcom/export.ts:760-805 RESN found|none · strings.ts research.searched*, found, none -->

<a id="S3.7"></a>
## S3.7 The section What the research knows in the research panel

The research panel has the section **What the research knows** with the summary "3 conflicts · 1 hypothesis". It has
a row for each open conflict ("Marie Vlková · birth: 1790 × 1791") and then for each open hypothesis ("Marie Vlková ·
Hypothesis: Father from the Horák mill"). A click opens the person's dialog at the given conflict or hypothesis.

- **Limits:**
  - the panel is visible only when following live a research that has not ended and belongs to the open family tree
    ([S4](S4-research-from-the-app.md));
  - without open conflicts and hypotheses the section is not there.
- **Controls:** app: the research panel, section **What the research knows**.
- **Since:** app 3.5.0

<!-- zdroj: app:src/ui/research-overview-ui.ts appendOverviewKnows · strings.ts live.knowsTitle, live.hypothesisRow · commit 228ac6a -->
