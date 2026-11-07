<a id="R10"></a>
# R10 People: identification, names and hypotheses

How the research recognises that an entry belongs to the person sought, what it does with two records of one person,
how it keeps competing explanations (hypotheses), and how it records names and the people an entry names. Describes
the research 1.27.0 and the Strom app 3.23.0; changes from a later version carry its number. Each rule says what is **enforced by the code** and what is only a
**rule of the method**.

<a id="R10.1"></a>
## R10.1 A namesake is not the person sought

An entry belongs to the person sought only when more than the name identifies them. Two people of the same name in
one village are common.

- **Method only:**
  - a person is identified by year, place, house number, occupation, spouse and parents. Most cases are decided by the
    mother's maiden name;
  - two entries that give the same name other parents (another mother) are **two persons**, even in the same house
    and with the same father's name. The difference is not explained by a scribe's error and is not decided by
    a majority ([R5.1.1](R5-conflicts.md#R5.1.1));
  - the person sought is the one named by the entry about their own family. The others are separate persons;
    “the same woman?” is a hypothesis ([R10.3](#R10.3)) with what would decide it;
  - a source outside the registers (a newspaper, a directory, the web): it is enough when the name, place and time
    agree **and one more detail** (house, occupation, spouse, age, a relative). Otherwise a hypothesis.
- **Why:** two people of the same name in one village are common; the mother's maiden name decides most cases (the
  method).
- **Controls:** terminal (agent). The app shows hypotheses at a person in **What the research knows → Hypotheses**
  ([S3.5](S3-what-the-research-knows.md#S3.5)).
- **Since:** research 1.0.0; a source outside the registers 1.10.0

<!-- zdroj: research:assets/method/core.md "A namesake is not your person" · research:assets/method/link.md krok 4 "Identify" · research:assets/method/enrich.md "Your person, not a namesake" (od v1.10.0) -->

<a id="R10.2"></a>
## R10.2 Two records of one person: merging

When two records in the research turn out to be one person, they are merged. The second record does not disappear:
it stays retracted, with a note saying into whom it was merged.

- **Enforced by the code** (`strom person merge <zůstává> <druhý> --reason "…"`):
  - a merge needs a reason;
  - names, facts, notes, families and all references (tasks, hypotheses, godparents…) pass to the person who stays;
  - facts are not merged: two births after a merge are two. strom points out which facts are now there twice; the
    better one is kept with its citations, the other is retracted with a reason;
  - it refuses to merge persons of different sex (when neither has an unknown sex), the partners of one family,
    an ancestor with a descendant, and persons with **different parents**. When they are the same parents in two
    records, the families are merged first (`strom family merge`).
- **Method only:** a person from an imported family tree who is already researched in the research is merged **into**
  the researched person; that person keeps their documents ([R11.3](R11-material-from-the-user.md#R11.3)).
- **Why:** strom never chooses quietly between two facts: the evidence decides which one stands. The other is retracted
  with a reason, so what stood where stays visible.
- **Controls:** terminal: `strom person merge`, `strom family merge`. Possible duplicates in the tree are reported by
  the app in the Tree check ([A5.6](A5-tree-check.md#A5.6)).
- **Since:** research 1.0.0

<!-- zdroj: research:src/commands/people.ts person merge (description, SINGLE_KINDS) · research:src/core (mergePersons: merge.needs-reason, sex, partners, ancestor, different birth parents) · research:assets/method/intake.md krok 5 -->

<a id="R10.3"></a>
## R10.3 A hypothesis: competing explanations

When the records allow more than one explanation (whose child it is, whether two entries are one person, whether it
is a married couple), the research does not choose silently. It records a hypothesis: the question and its versions
A, B, C… with what speaks for each and what against.

- **Enforced by the code:**
  - a hypothesis has at least two versions and concerns at least one person or record (`--about`);
  - the letter of a version belongs to one claim for good. A new claim gets the next free letter; a letter once used
    is not used again. A version can be added only to an open hypothesis;
  - a version can say what it would connect: a child of a family or of parents, two records of one person, a couple,
    siblings. Nothing is connected in the tree by that; the connection is recorded only after the hypothesis is
    decided.
- **Method only:** what would decide the hypothesis is a task (`strom task add … --about H…`), not a detour in another
  task. The connection of a version is recorded only when the claim states it beyond doubt; a namesake stays out.
- **Controls:** terminal: `strom hypothesis add "<otázka>" --about P… --variant "…" --variant "…"`,
  `hypothesis argue`, `hypothesis variant`, `hypothesis link`, `hypothesis show`, `hypothesis list`. The app shows the
  versions and lets them be drawn into the tree for the view only ([S3.5](S3-what-the-research-knows.md#S3.5),
  [S3.5.1](S3-what-the-research-knows.md#S3.5.1)).
- **Since:** research 1.0.0; connections of versions and a new version for an open hypothesis 1.14.0

<!-- zdroj: research:src/commands/analysis.ts hypothesis add ("at least two --variant", "--about is required"), variant (VARIANT_LABEL, nextLabel, "a letter is never used twice"), link (description) · research:assets/method/core.md "Say what a hypothesis would connect" -->

<a id="R10.3.1"></a>
### R10.3.1 Deciding a hypothesis

A hypothesis is decided for one version, or abandoned when none can be decided. Who decides it is a choice of the
research ([R10.3.2](#R10.3.2)): **The AI decides** (the agent decides itself, only by a cited record; the default
when no choice is saved), or **The user decides** (the agent only proposes the decision). The app does not let a
hypothesis be decided; it points to the research.

- **Enforced by the code:**
  - with **The user decides**, a decision is a person's step. When the agent runs `strom hypothesis decide` (also
    inside `strom batch`), strom refuses it;
  - the agent proposes the decision: a version and the text of the decision (`strom hypothesis propose`), or
    abandoning (`--abandon`). A new proposal replaces the previous one. The work does not wait for the answer;
  - the proposal waits in **What waits** in the group **Hypotheses to decide** ([R6.3.4](R6-awaiting-action.md#R6.3.4)):
    a person decides as proposed, otherwise (another version or none, with a reason), or leaves the hypothesis as it
    is. A proposal not taken stays in a note of the hypothesis;
  - with **The user decides**, an open hypothesis without a proposal waits in the same group too: a person decides it
    (a version or none, with the text of the decision), or leaves it open. A hypothesis left open shows up in What
    waits again once the agent proposes how to decide it;
  - a decision and a proposal need the text of the decision (`--decision`); abandoning is `--abandon`;
  - a hypothesis whose versions say what they would connect is decided and proposed only with the version named
    (`--variant B`). Without it strom refuses and writes nothing;
  - deciding again (and proposing again) is possible only with a reason (`--reason`). The previous decision stays in
    a note of the hypothesis, also with the fact that the agent decided it. A decided or abandoned hypothesis offers
    **Change the decision** in the menu;
  - what a person's decision connects, and the sources the hypothesis names that no fact of its persons cites, the
    agent gets at the start of its next work as the first task to record on the tree.
- **Method only:** the agent proposes a decision when the records point to one version, and tells the person in one
  sentence. A decided hypothesis that a new record overturns the agent proposes again, with a reason. What the agent
  held back while the person was only a hypothesis it records at the person once the hypothesis is decided.
- **Why:** a new decision needs a reason because decisions change in the open: the previous one stays readable and
  the new one says what changed it (usually a new record).
- **Controls:** terminal: the `strom` menu → **What waits** → **Hypotheses to decide** → **Decide as proposed**,
  **Decide otherwise**, **Leave it as it is (the proposal not taken)**; at an open hypothesis without a proposal
  **Decide**, **Leave it open**; at a decided or abandoned one **Change the decision** (text and reason required). The
  same screen is in the person review: **Add to the research** → **Review one person** → **Hypotheses about the person
  (n)**. By command `strom hypothesis decide H… --proposed`, `--keep-open`, or `--variant B --decision "…"` (again
  with `--reason "…"`). The agent: `strom hypothesis propose H… --variant B --decision "…"`. App: **What the research
  knows** → the hypothesis → **Decide in the research**, at a decided one **Change in the research**
  ([S3.5](S3-what-the-research-knows.md#S3.5)).
- **Since:** research 1.0.0; the list of sources not recorded 1.12.0
- **From research 1.28.0:** only a person decides, the agent proposes; the code enforces the named version (formerly
  method only). Hypotheses the agent decided before stay as they were.
- **From research 1.29.0:** who decides is a choice of the research ([R10.3.2](#R10.3.2)); without a saved choice the
  AI decides, also in a research set up earlier. What waits also offers
  open hypotheses without a proposal (**Decide**, **Leave it open**) and the menu **Change the decision**. Up to 1.28.0
  an open hypothesis without a proposal was not in What waits and was decided only by the command `strom hypothesis
  decide`.
- **From app 3.25.0:** **Decide in the research** and **Change in the research** in **What the research knows**, where
  the research on this computer offers them.

<!-- zdroj: research:src/commands/analysis.ts hypothesis propose, hypothesis decide (person: …, agentMay, --proposed, --keep-open bez návrhu → leftOpen, againNeedsReason, decidedVariant, "earlier … by the agent") · src/cli/main.ts:288 def.person && isAgent && !def.agentMay · src/commands/batch.ts (def.agentMay) · src/core/waiting.ts (hypotheses, hypothesesOpen, TERMINAL_ONLY) · src/cli/menu-waiting.ts decideHypothesis (proposed / open / decided: ui.wait.hypothesis.change) · src/cli/menu-research.ts:532 ui.review.hypotheses · src/core/hypolinks.ts decidedToRecord, sourcesNotOnPeople · src/brief/brief.ts "Decided by the user — record it on the tree first" · assets/lang/cs.json wait.group.hypotheses, ui.wait.hypothesis.*, ui.review.hypotheses · research:assets/method/core.md "The user decides a hypothesis" · assets/method/recording.md "is proposed again" · CHANGELOG.cs.md 1.28.0, 1.29.0 · research 1.28.0 = commit 94a593db · app:src/strings.ts research.decideInResearch, research.hypoChange · CHANGELOG.cs.md 3.25.0 -->

<a id="R10.3.2"></a>
### R10.3.2 Who decides the hypotheses: the user or the AI

The research's choice **Who decides the hypotheses** sets who decides a hypothesis. **The AI decides** is the
default: the agent decides itself once a cited record points to one version; its decision is marked and a person can
change it at any time. **The user decides**: the agent only proposes and the decision waits in **What waits**. Back to
the user deciding: `strom config set hypotheses.decide person`.

- **Enforced by the code:**
  - without a saved choice the AI decides: in a new research, in a research set up earlier (up to version 1.28.0 the
    choice did not exist), in a setup without a terminal and when an agent runs the setup. A saved choice (**The user
    decides** and **The AI decides** alike) stays. Switching does not change hypotheses already decided;
  - the setup (`strom setup`) offers **The AI decides (recommended)** first, with the sentence "Recommended: the AI
    decides – the research goes on without hypotheses waiting; each of its decisions is marked and can be changed."
    Enter takes it without a further confirmation. **The user decides**, when chosen, is saved, and the next `strom
    setup` offers it as the current choice;
  - where **The user decides** is saved, only a person in the terminal turns **The AI decides** on again: the question
    explains what it means and asks for a second yes. The same holds for removing the saved choice (`strom config unset
    hypotheses.decide`), because without it the AI decides. strom refuses both to the agent. Going back to **The user
    decides** is possible at any time, without confirmation;
  - with **The user decides** saved and 10 or more open hypotheses in the tree, the app offers the switch in one
    sentence in **What the research knows**, the section **Hypotheses**: "N open hypotheses wait for a person to decide;
    with "The AI decides" the agent decides them itself, each with its reason." **Switch to "The AI decides"** opens
    the research in the terminal, where the choice is confirmed with a second yes; the app does not turn the AI on.
    **Hide** hides the offer for this research for good (in this browser). The offer is only at a research on this
    computer that knows the choice and offers the link into the research
    ([S3.5](S3-what-the-research-knows.md#S3.5));
  - the choice applies to the research on this computer. One research can have its own (`--for-tree`); the choice from
    the app is written only for that research;
  - the agent decides only a version that a cited source of the research (S…) supports. Without one strom refuses and
    offers a proposal (`strom hypothesis propose`);
  - a version that would connect a branch of 10 or more people off the tree to it the agent decides only with two cited
    sources and no objection against it; otherwise it only proposes it;
  - the agent never changes a person's decision; when a new record overturns it, the agent proposes it again
    ([R10.3.1](#R10.3.1));
  - a hypothesis that cannot be decided the agent abandons with the text of the decision;
  - the agent's decision carries a mark and the day. Terminal: at the hypothesis **Decided by the agent (day).**, in the
    list of changes "H… decided by the agent: …" and "H… abandoned by the agent: …". App: **What the research knows** →
    **decided by the agent** with the day and the reason;
  - what the agent's decision connects the agent records on the tree at once;
  - when a person changes the agent's decision, the mark goes and the previous decision stays in a note of the
    hypothesis;
  - in a Strom archive the choice does not exist.
- **Method only:** the agent tells the person in one sentence what it decided.
- **Controls:** terminal: the setup `strom setup`, the step **Who decides the hypotheses — the uncertain links between
  people?** (only when a person runs the setup in the terminal; without a terminal it does not ask and the saved
  choice applies, without one **The AI decides**; the recommendation is only here, the menu Settings offers the
  current choice); the menu **Settings** → **Language, agent, model, what the agent may do alone, stories… (the
  setup)** → **Who decides the hypotheses: …**; `strom config set hypotheses.decide person|agent [--for-tree]`, the
  value in force is shown by `strom config where`. Back to the user deciding: `strom config set hypotheses.decide
  person`. App: **Research** → **Other actions** → **Research for this tree…** →
  **Who decides hypotheses**: **The user decides** is written to the research at once, **The AI decides** the research
  confirms in the terminal (**Confirm in the research**). The row shows only with a research that knows the choice. The offer in **What the research knows** →
  **Hypotheses**: **Switch to "The AI decides"**, **Hide**.
- **Since:** research 1.29.0, app 3.25.0

<!-- zdroj: research:src/core/config.ts:301 hypotheses.decide (choices person|agent, tree: true), hypothesesDecide · src/commands/setup.ts:1203 requireHuman (ui.consent.hypotheses.agent), :1686 help config set · src/cli/wizard.ts 5c (ctx.interactive && !isAgent) · src/cli/menu-settings.ts:87 hypothesesStep · src/commands/analysis.ts agentMayDecide (hypothesis.user, hypothesis.evidence, hypothesis.branch), citedInSupport · src/core/kin.ts BIG_BRANCH=10, branchJoined · src/core/model.ts:730 decidedByAgent, decidedAt · src/core/changelog.ts:360 · src/core/live.ts:2039 /status.hypotheses, :4647 POST /hypotheses (person hned, agent 403 hypotheses.link) · src/core/links.ts:112 · assets/lang/cs.json ui.setup.hypotheses, ui.hypotheses.decide.*, ui.settings.hypotheses, ui.consent.hypotheses.agent, ui.wait.hypothesis.byAgent, log.hypothesis.decide.agent, log.hypothesis.abandon.agent · CHANGELOG.cs.md 1.29.0 · app:src/strings.ts research.hypoDecideTitle/Person/Agent, hypoDecideConfirm(Link), hypoByAgent, hypoReason, research.treeSettings · src/ui/research-tree-settings-ui.ts · CHANGELOG.cs.md 3.25.0 · spec 060 K1.1–K1.5, K2.1 · výchozí AI (výzkum 1.29.0): research:src/core/config.ts hypothesesDecide (=== person ? person : agent), getDefault hypotheses.decide agent · src/commands/setup.ts syncDecisions/layerChange (agent nebo unset tam, kde je person → requireHuman) · src/cli/wizard.ts 5c (was = stored === person ? 0 : 1; druhé ano jen při uloženém person; person uloženo; ui.setup.model.recommended, ui.setup.hypotheses.recommended) · src/cli/menu-settings.ts hypothesesStep (bez doporučení) · CHANGELOG.cs.md 1.29.0 „Kde nic zvoleno není, rozhoduje AI“ · spec 060 K1.9 · nabídka: app:src/ui/person-research-ui.ts HYPOTHESES_OFFER_MIN = 10, researchHypothesesOffer (HYPOTHESES_DECIDE_FEATURE, hypothesesDecide === person, isOpenHypothesis celého stromu, activeResearchLink hypotheses decide=agent), hideHypothesesOffer (localStorage na výzkum) · strings.ts research.hypoOfferAgent, hypoOfferSwitch, hypoOfferHide · spec 060 K1.6–K1.8 -->

<a id="R10.4"></a>
## R10.4 A family outside the tree waits for a proven link

A family found in the records that no proven link joins to the tree is not researched further: neither its parents
nor its children. First it must be proven that it belongs in the tree.

- **Method only:** the agent records a hypothesis that would attach the family to a person of the tree (`--about` the
  person of the tree), and a task that verifies it and names it (`--about H…`). The agent researches a family outside
  the tree further only at the user's request.
- **Enforced by the code:** the queue holds back the other tasks about people outside the tree. They return by
  themselves once the link is recorded ([R2.2.3](R2-lines-and-queue.md#R2.2.3)).
- **Why:** work on a family that does not belong in the tree is lost work; the link decides, not the name (the method
  “The tree first, then above it”).
- **Controls:** terminal: `strom task list --off-tree`. The app shows a family outside the tree at a person in **Above
  the person** ([S3.3](S3-what-the-research-knows.md#S3.3)).
- **Since:** research 1.9.0

<!-- zdroj: research:assets/method/core.md "The tree first, then above it" · research:src/commands/tasks.ts --off-tree (od v1.9.0) -->

<a id="R10.5"></a>
## R10.5 A person's names

A person can have more than one name: a birth name, a married name, a religious name, another one. Each name has its
own record. Names are recorded as they stand in the entry; only dates are standardised.

- **Enforced by the code:**
  - kinds of name: birth (`birth`), married (`married`), religious (`religious`), another name (`alias`), no kind;
  - a name without a surname (“Marie”) is completed by the full name from the entry, and the person is then shown by
    it. The same name again only adds a citation;
  - a woman is shown by her birth name; the married name stays beside it;
  - a title written with the name (“Ing.”, “MUDr.”, “ml.”) goes into the prefix or suffix of the name (`--prefix`,
    `--suffix`), not into the given name or the surname;
  - **the name a person is shown by** (a divorced woman back at her birth surname) is the user's choice, not a fact
    from a record: `strom name primary`. The person's identity (correcting the name, matching) stays with the birth
    name.
- **Method only:**
  - a rank or office the entry states is a fact (`TITL`, `OCCU`), not part of the name;
  - a child the entry does not name (stillborn, died unbaptised) has no given name; a description is not written in
    place of the name;
  - a person whom a weaker record named differently keeps that name as a variant; the correct name is marked as the
    main one. Nothing is deleted;
  - a name read only in part: [R8.6](R8-reading-scans.md#R8.6).
- **Why:** a description in place of a name (“stillborn son”) would be shown and searched as a given name by the app
  and by GEDCOM, and name matching would take it for a name. That the child died without a name is a fact (a death,
  a note).
- **Controls:** terminal: `strom name add P… "Marie /Vlková/" --kind birth --cite S…`, `strom name primary P…
  "…"` (`--clear` returns the birth name). Surname forms in the app: [A4.5](A4-surnames-and-families.md#A4.5),
  [A4.6](A4-surnames-and-families.md#A4.6).
- **Since:** research 1.0.0; prefix and suffix 1.13.0; the name a person is shown by 1.27.0; an unnamed child 1.27.0

<!-- zdroj: research:src/core/model.ts NAME_KINDS · research:src/commands/people.ts name add (description), name primary (od v1.27.0), TITLE_OPTIONS (od v1.13.0) · research:assets/method/recording.md "The names a record gives", "A child the record does not name" (od v1.27.0), "People named wrongly by the weaker record" · research:assets/method/intake.md krok 4 -->

<a id="R10.5.1"></a>
### R10.5.1 A wrong name and a note are retracted

A name or a note that turns out to be wrong is not deleted. It is retracted with a reason and stays only in the
history.

- **Enforced by the code:**
  - a retracted name disappears from everything that shows, reads or matches names: `strom person show`, the agent's
    briefing, GEDCOM (the app does not show it after loading the tree), searching and matching;
  - the name a person is shown by can be retracted only when the person has another name as well. A typo in it is
    corrected with `strom person edit --name`;
  - a retracted name cannot be added again; it is brought back with `strom name restore` and a reason;
  - a note is corrected (`strom note edit`) or retracted (`strom note retract`) with a reason; it is brought back with
    `strom note restore`.
- **Controls:** terminal: `strom name retract P… "Josef /Horák/" --reason "…"`, `strom person show P… --history`.
- **Since:** research 1.18.0

<!-- zdroj: research:src/commands/people.ts name retract (description), name restore, name add ("name.retracted"), note edit/retract/restore (od v1.18.0) · GitHub issue strom-research #3 -->

<a id="R10.6"></a>
## R10.6 People a record names

An entry names more people than the main person: godparents, witnesses, the midwife, the officiating priest, the
informant, parents and grandparents. Everything the entry says about them is recorded at the first reading.

- **Method only:**
  - everyone in a role goes to the event as the role and the name, with what the entry says about them in brackets:
    “godparent: Jan Horák (farmer, Lhota No. 12)”. A priest is the one who married or baptised;
  - a person in a role is linked to a person of the tree only when the entry says so. The same name is not enough;
  - what the entry says about each person it names (occupation, residence, house number) becomes their fact with the
    date of the entry, for grandparents too. An entry that names the parents (a grandchild's baptism) is secondary
    information for them ([R3.2.1](R3-verification-and-citation.md#R3.2.1));
  - a place is only the municipality; the house number goes into its own field.
- **Why:** godparents and witnesses are often relatives and prove a further link; by occupation and house the person
  is searched for further. Opening the same page again costs more than recording it at once (the method).
- **Controls:** terminal: `strom event add … --with "godparent:…" --house 13`. App: a recurring godparent in the
  Leads of the Tree check ([A5.5](A5-tree-check.md#A5.5)).
- **Since:** research 1.0.0

<!-- zdroj: research:assets/method/recording.md "Everyone the entry names in a role", "What the entry says about each person", "A place is the municipality only" · research:assets/method/core.md "Extract everything the first time" · research:assets/method/link.md krok 6 -->
