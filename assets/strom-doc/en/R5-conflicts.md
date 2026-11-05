<a id="R5"></a>
# R5 Conflicts

How a conflict arises in the research, who decides it, what the agent must not overwrite, and where a conflict is
shown and decided. Describes the research 1.25.2 and the Strom app 3.21.2.

<a id="R5.1"></a>
## R5.1 A conflict records that the sources disagree

When the records about one person differ (name, date, age), the agent does not silently pick one of them. It writes
a conflict: both claims with their sources and the question that needs deciding. The conflict stays open until
someone decides it with a reasoning ([R5.3](#R5.3)).

- **Limits:**
  - a conflict has at least 2 claims and concerns at least one person or another record;
  - the fact it concerns is written with a GEDCOM tag (BIRT, DEAT, NAME, SEX…). The app then shows the conflict at
    that fact;
  - a conflict also arises when two independent readings of the same cell differ (see
    [R3](R3-verification-and-citation.md));
  - what would decide the conflict is written as a task for the conflict;
  - an open conflict at a person with documented facts is reported by the tree check as a warning.
- **Controls:** terminal: `strom conflict add "<question>" --about P… --fact BIRT --claim "S…: …" --claim "S…: …"`,
  `strom conflict list [--about P…] [--all]`, `strom conflict show X…`, a task for the conflict
  `strom task add … --about X…`, the check `strom check`.
- **Since:** research 1.0.0

<!-- zdroj: research:assets/method/recording.md:69-85 · assets/method/core.md:38-41 „Nothing is deleted“ · assets/method/verify.md:11-12 · src/commands/analysis.ts:470-512 conflict add, :601 list, :626 show · src/core/check.ts:98 open-conflict -->

<a id="R5.1.1"></a>
### R5.1.1 Other parents mean two persons, not a conflict

Two records that give the same name other parents (another mother) describe **two persons**. This holds even in the
same house and with the same father's name. The difference is not explained by a scribe's error and is not decided
by a majority of records.

- **Limits:** “Is it the same woman?” is a hypothesis, not a conflict. It is one person with a conflict only when
  another record shows it. A made-up example: two baptisms of Marie Vlková in the same village, once with the mother
  Horáková, once with another mother. These are two Maries and a hypothesis whether they are one.
- **Controls:** terminal: `strom hypothesis add`.
- **Since:** research 1.0.0

<!-- zdroj: research:assets/method/core.md:15-22 „A namesake is not your person“ · assets/method/recording.md:74-76 -->

<a id="R5.2"></a>
## R5.2 An edit from the app to a fact a record documents becomes a conflict

The research writes edits sent from the Strom app so that nothing it relies on disappears. A change to a fact that
a record documented therefore does not overwrite the fact. A conflict arises between the value from the app and the
value of the research.

- **Limits:** what happens to an edit from the app:
  1. a new fact or person: written as a **Lead** with the source “Edits in the Strom app ({day})”;
  2. a change to a fact no record documents: the fact is corrected (with a reason);
  3. a refinement of a fact a record documents (a place where there was none, a day to a year, a more detailed
     place): added to the fact, without a conflict;
  4. any other change to a fact a record documents: a **conflict**. The same for the name, the title before and after
     the name, and sex;
  5. a child placed with other parents than those the research has as the child's birth parents: always a “parents”
     conflict;
  6. a person removed in one copy of the app and edited elsewhere meanwhile (in another copy or in the research):
     a conflict whether the person stays in the tree.
- A fact a record documents is a fact in the state **Proven** or **Probable** that cites a source other than a family
  tree, family memory or the author's own text.
- Until the decision, the app keeps the value from the app, and the research keeps its own in that place.
- The same edit sent again does not open a new conflict. An edit changed in another way only overwrites the app's
  side in the open conflict.
- **Controls:** app: after sending **Written, {n} conflicts to decide** and **Show**. Terminal: the `strom sync`
  output says at each change **a conflict to decide (the research has it from a record)** or **a conflict to decide
  (the research gives other parents)**. A send can be undone: `strom sync undo I…`.
- **Since:** research 1.5.0. Refinement without a conflict and the parents conflict from 1.12.0, the conflict of
  a removed person from 1.20.0.

<!-- zdroj: research:src/core/sync.ts:1-19, recordBacked :2238, výběr akce :2406-2520 (refine :2511, addsTo :3475), parentsConflict :2848, openConflict :3486, conflictOfEdit :4888 · src/core/conflicts.ts:19 isEditConflict · cs.json ui.sync.do.conflict, ui.sync.do.parents, ui.sync.do.refine, ui.sync.source.app.day · app:strings.ts sync.flyConflict, sync.showConflicts, sync.writtenConflictsSub · CHANGELOG.cs.md 1.20.0 -->

<a id="R5.2.1"></a>
### R5.2.1 When the edit from the app wins

A tree setting decides what happens to a change of a fact a record documents:

- **a conflict to decide** (default): the research keeps the value from the record and opens a conflict;
- **the edit wins:** the fact from the record is withdrawn with a reason and the edit holds. Nothing is deleted; it
  stays in the history.
- **Limits:** a Strom archive and a research waiting for its agent always take edits from the app as valid. The
  parents conflict and the conflict of a removed person arise there too.
- **Controls:** terminal: `strom config set sync.edits conflict|user`. The setting holds for one tree. Only a person
  may switch on **the edit wins**: strom asks “Let edits in the Strom app win over what a record says?”.
- **Since:** research 1.5.0; the Strom archive and the question to a person from 1.12.0.

<!-- zdroj: research:v1.25.2 src/core/config.ts:283 sync.edits · src/commands/setup.ts:1163-1167 syncDecisions requireHuman · src/core/sync.ts:2283-2285 mirror · src/core/state.ts:44 actsAsArchive · cs.json ui.sync.mode.conflict, ui.sync.mode.user, ui.sync.edits.archive, ui.consent.edits.user -->

<a id="R5.3"></a>
## R5.3 Who decides a conflict

A conflict between sources is decided by the agent when the sources allow a conclusion. A conflict from an edit in
the app waits for a person. In a Strom archive and in a research waiting for its agent, a person decides all
conflicts. Every decision has a conclusion and a reasoning: which evidence outweighed which.

- **Limits:**
  - a decision without a conclusion or without a reasoning is not written;
  - the decision records who decided: the user (the terminal without an agent, a link from the app) or the agent
    (its session). From the menu and from a link, the reasoning ends with “(the user's decision)”;
  - a person can also decide a conflict between sources: they pick the claim that holds, or write their own
    conclusion;
  - a decided conflict can be decided again only with a reason. The earlier decision stays in the conflict's note
    (“earlier decided by the user…”, “earlier decided in the research…”).
- **Controls:** terminal: `strom conflict resolve X… --resolution "…" --reasoning "…"`, again with `--reason "…"`.
  Where it is decided in the menu and in the app: [R5.6](#R5.6).
- **Since:** research 1.0.0. A second decision only with a reason from 1.6.0, the record of who decided from 1.14.0.
- **From research 1.26.0:**
  - only a person decides a conflict from an edit. The research refuses the agent's decision until a person leaves it
    to the agent (`strom conflict leave X…`, in the app **Leave it to the agent**); `strom conflict leave` is for a
    person only;
  - conflicts from edits the agent decided earlier are opened again by the fix `strom fixes show|run|undo
    edit-decisions`. The agent's decision stays in the conflict's note, the facts do not change. Only a person runs
    the fix in the terminal; it is not in a Strom archive. Until it has run, `strom check` points such conflicts out.

<!-- zdroj: research:assets/method/recording.md:76-78 · src/commands/analysis.ts:515-598 conflict resolve (by :561, poznámka „earlier decided“ :572-573, zápis :581) · src/core/conflicts.ts:105-113 againAllowed conflict.decided · src/core/conflicts.ts:27 conflictsToDecide · src/cli/context.ts:577 actor · cs.json ui.link.conflict.by, ui.conflict.earlier.* · 1.26.0: src/commands/analysis.ts:525, :572 conflict.users, :625 conflict leave (commit 1189532f) · src/commands/fixes.ts edit-decisions, strom check agent-decided-edit (commit 740e1893) -->

<a id="R5.3.1"></a>
### R5.3.1 A conflict from an edit is decided by a side

A conflict from an edit in the app has two sides: the value from the app and the value of the research. It is
decided by picking a side.

- **The value from the app:** written into the fact. The fact from the record is withdrawn with a reason and stays
  in the history. The value from the app stands beside it as **Possible**. A lead is corrected directly.
- **The value of the research:** the fact in the research stays as it is. The app gets the research's value after
  loading its version (a backup is saved first).
- **Limits:** a conclusion that matches the value of one side exactly counts as picking that side. A conclusion that
  matches neither side closes the conflict but does not change the fact; the output says how to take the value from
  the app. Parents conflict: the value from the app moves the child to the parents from the app.
- **Controls:** terminal: `strom conflict resolve X… --take user|research --reasoning "…"`.
- **Since:** research 1.12.0

<!-- zdroj: research:src/core/sync.ts:4771-4800 takeSide · src/commands/analysis.ts:543-550 (strana podle závěru), :596 ui.conflict.left · cs.json ui.conflict.left · app:strings.ts conflict.keepNote, conflict.takeNote -->

<a id="R5.4"></a>
## R5.4 A person's decision holds

What a person decided (in the app, by a link from it, or in the terminal) holds. The agent decides it again only on
the strength of a source the decision has not yet weighed, and with a reason. A new reading of the same record changes
nothing.

- **Limits:**
  - the weighed sources are the sources of all claims of the conflict, and for a conflict from an edit also the
    sources of the edited fact;
  - the same rule holds for a new conflict about the same fact of the same person: the agent opens it only with a new
    source and a reason;
  - a side once taken cannot be taken again; the fact is then changed with the commands for facts. The exception:
    whether a person stays in the tree can be decided again in both directions;
  - the agent can decide again a decision of the agent with a reason, without a new source.
- **Controls:** terminal: `strom conflict resolve X… --resolution "…" --reasoning "…" --source S… --reason "<what
  the new record shows>"`. Without a new source strom refuses and proposes asking a person.
- **Since:** research 1.14.0

<!-- zdroj: research:src/core/conflicts.ts:89-98 weighedSources, :100-132 againAllowed (conflict.taken, conflict.user-decided) · src/commands/analysis.ts:495-509 conflict add · assets/method/recording.md:78-82 -->

<a id="R5.5"></a>
## R5.5 What the agent does not overwrite

Some things are a person's word. The agent does not overwrite them even when it finds something else. It writes the
difference beside them, or asks.

- **A user's transcription:** the agent reads a record transcribed in the app blind, on its own. A match: a note at
  the source that the research read it too. A difference: a conflict with both readings. A user's transcription is
  not overwritten and is not taken as documented. This is a rule of the agent's method.
- **An approved story:** once a person approves it, it is locked. The agent writes a new version beside it, and that
  waits for a person: approve it in place of the old one, or keep the old one.
- **A hand-placed position of a place:** a position placed by hand does not change. When the records say otherwise,
  the question **Location conflict** appears in **Awaiting action** ([R4.3](R4-places.md#R4.3)).
- **A person's decision in a conflict:** [R5.4](#R5.4).
- **Controls:** terminal: `strom story approve P…`, `strom story discard P…`; the menu **What waits**.
- **Since:** a user's transcription research 1.12.0, an approved story 1.10.0, a position by hand 1.25.0.
- **From research 1.26.0:** only a person runs `strom story approve|discard`. The research also refuses the agent
  writing a story as approved straight away (`strom story set --final`).

<!-- zdroj: research:assets/method/verify.md:19-24 · src/commands/story.ts:94-96, :103 story approve, :121 story discard (1.26.0 person only, story.final) · src/core/placeid.ts:714 personsHand, :805-808 place.manual, :924 · app:strings.ts places.dialog.whoHand, places.waiting.kind.conflict -->

<a id="R5.6"></a>
## R5.6 Where conflicts are seen and where they are decided

In the app, conflicts are seen at the person and at their facts. The decision, though, is always written in the
research, on the computer where the research runs. The app opens the research in a terminal, and that asks for
confirmation and a reason.

- **The app – where a conflict is seen:**
  - the person's menu **What the research knows** with the number of conflicts, in the dialog the section
    **Conflicts** (open and decided);
  - the research panel, section **What the research knows**: a row for each open conflict;
  - in editing a person, the tag **conflict ›** at the field;
  - on the person's card, a conflict tag (switched on in **Show on card → Conflicting sources**).
- **The app – a conflict from an edit:** a card with the sides **From the app** and **In the research** and the
  choices **Keep the value from the app** and **Take the research's value**. A choice opens the research. Away from
  the computer with the research, the card says **Decided in a terminal on the computer with the research: strom →
  What waits.**
- **The app – a conflict between sources:** “The sources disagree here; this is decided in the research.” The choices
  **Decide in the research** (terminal: **Which is right?**, a claim or **Something else (I write it)**, then
  **Why? (what decides it)**) and **Leave it to the agent** (a conversation with the agent; strom says beforehand that
  the agent works on the subscription or AI credit). In a Strom archive there is no **Leave it to the agent**.
- **Terminal:** the menu **What waits**, the group **Conflicts to decide**, oldest first. The choices **The value from
  the Strom app holds**, **The research's value holds** (in an archive **The Strom archive's value holds**), **Leave
  it open**. A conflict between sources offers the claims as in the link.
- **Limits:** in a research with an agent, **What waits** shows only conflicts from edits in the app. Conflicts between
  sources are there only in a Strom archive and in a research waiting for an agent. Otherwise the terminal shows them
  only in `strom conflict list`. Conflicts are not in the app's **Awaiting action**.
- **Controls:** see above; in the terminal also `strom conflict show X…`.
- **Since:** app 3.4.0 (**What the research knows**, **conflict ›**, **Decide in the research**, **Leave it to the
  agent**), the section in the research panel and the tag on the card from app 3.5.0. Picking a side from app 3.11.0
  with research 1.14.0. Conflicts in **What waits** from research 1.20.0.
- **From research 1.26.0:**
  - the app offers **Leave it to the agent** also for a conflict from an edit; the link first leaves the conflict to
    the agent (`strom conflict leave`);
  - a side picked in the app is only confirmed in the terminal, the reason is optional (**Why? (what decides it;
    Enter: no reason, 0: nothing decided)**). Without a reason, “picked in the Strom app” is written;
  - **What waits** offers the choices in the app's words: **Keep the value from the app**, **Take the research's
    value** (in an archive **Take the Strom archive's value**), **Leave it open**.

<!-- zdroj: research:src/core/waiting.ts:127 TERMINAL_ONLY, :443-449 · src/cli/menu-waiting.ts:486-513 decideConflictHere · src/cli/menu-links.ts:510-561 decideConflict, pickClaim · src/commands/links.ts:235-246 · src/core/live.ts:2063 decide.link · src/core/stromapp.ts APP_DECIDES_CONFLICTS="3.11.0" · app:v3.21.2 strings.ts research.knows, research.conflicts, research.conflictTag, research.decide, research.leaveToAgent, conflict.*, cardDensity.cardConflict · ui/person-research-ui.ts:139-150, :178-210 · ui/conflict-decide-ui.ts · research-decide.ts:55 canDecideInApp · 1.26.0: research:cs.json ui.wait.conflict.take.*, ui.link.conflict.whyMaybe, ui.link.conflict.inApp (commit 1189532f) · app:src/research-conflict-card.ts conflictCardView (agent u rozporu z úpravy) -->

<a id="R5.6.1"></a>
### R5.6.1 What can be decided by a side from the app

The app offers picking a side only for an open conflict from an edit that has both sides and concerns a person of
the research.

- **Limits:**
  - it concerns the value of an event (date, place, value) of a person or a couple, the name, the title before and
    after the name, sex;
  - at least one side has a value; an empty side shows as **(empty)**;
  - a parents conflict cannot be decided by the app's side. The app shows only **Decide in the research** for it, or
    it is decided in the terminal in **What waits**;
  - a person removed or edited in another window: the app asks **Return to the tree** / **Keep removed**, or **Remove
    from the tree** / **Keep in the tree**. The choice also opens the research in a terminal.
- **Since:** app 3.11.0 with research 1.14.0

<!-- zdroj: research:src/core/conflicts.ts:48-62 BY_SIDE, sidesOf · app:v3.21.2 research-decide.ts:28-66 DECIDE_FACTS, canDecideInApp · ui/research-removed-ui.ts:97-125 · strings.ts conflict.person.* -->
