<a id="S7"></a>
# S7 Reliability of facts and verification against the originals

At each fact the app shows how reliable it is, and the card in the tree has one mark for the whole person. The
research can verify a fact against the original record: in the background, for one fact, for a person or for a large
part of the tree. Certainty, though, comes only when a **person** compares the fact with the scan of the record and
confirms it (**Confirm against the scan**, [S7.8](#S7.8)). Verification by the agent gives at most **Proven**; a
person's confirmation is stronger and the agent never changes it. The chapter describes the Strom app 3.26.0 and the
research 1.30.0. What works only with the research's bridge and what works without it is summed up in [S7.9](#S7.9).

<!-- zdroj: dirigent:spec/065-spolehlivost-a-znovu-overeni/spec.md · app:7b0471f8 CHANGELOG.cs.md 3.26.0 (Ověřit údaje, Jedna značka na kartičce) · research:6c6e7c3b CHANGELOG.cs.md 1.30.0 (ověření podle originálů) -->

<a id="S7.1"></a>
## S7.1 The mark at a fact in the person card

In the person card each fact has a mark: who confirmed or proved it, how sure the research is, or that it came from
another program's family tree and nobody has verified it. The steps differ by a tick, dots and a frame, never by
colour alone.

| Mark | Meaning (the label on hover) |
|---|---|
| **Confirmed** (✓) | **Confirmed by a person**: a person confirmed the fact against the scan, entered or reverted it, or accepted a proposal of the research |
| **Proven** (●●) | **Proven by AI: two readers of the record agree** |
| **Proven** (●○) | **Proven by AI: one reader of the record** |
| Probable, Possible, Lead | the research's degree of certainty ([R3.1](R3-verification-and-citation.md#R3.1)) |
| **From family tree** (○○) | taken from another program's family tree, or from a family tree from the Strom app that the research took in; unverified ([S6.2](S6-tree-from-another-program.md#S6.2)) |

- **The tip at the mark** (on a click): the fact's sources; with two readers **two readers agree**; for a fact that
  stayed probable or possible after verification, the line “Stays {degree} · verified by the research on {date}” and
  the reason why it could not be proven; for a confirmed one “✓ Confirmed against the scan on {date}”; for
  a fact from the family tree that the family tree cites, **cited in the family tree, not verified in Strom**. The tip
  also holds the actions **Verify** ([S7.3](#S7.3)), **Confirm against the scan** and **Undo** ([S7.8](#S7.8)), where
  they apply.
  From app 3.27.0 each source in the bubble has the reliability of the citation at this fact (**Original**, **Copy /
  index**, **Uncertain**), not the source's default reliability ([A2.6.1](A2-loading-a-family-tree.md#A2.6.1)).
- **Enforced by the code:**
  - two dots go only to a fact for which two readers of the record agreed when the research verified it
    ([R8.8.1](R8-reading-scans.md#R8.8.1)); a fact proven otherwise has one;
  - only a person gives ✓: by confirming against the scan, or by writing, changing or putting back the value
    themselves, or by accepting a proposal of the research. A fact the research took in from a family tree from the
    Strom app and nobody has changed since has the mark of its degree of certainty, without a degree **From family
    tree** (○○); never ✓ ([S6.3](S6-tree-from-another-program.md#S6.3));
  - the marks of a research tree are the same with the bridge and without it, also right after the page loads: the
    app takes them from the stored tree, not from the running bridge;
  - a person's confirmation holds only while the fact has the confirmed value ([S7.8](#S7.8)).
- **Limits:** the app does not yet show the mark **No source** at a fact: a fact without a source has no mark. A
  person without a source is shown by the mark on the card ([S7.2](#S7.2)).
- **Controls:** the person card → the mark at the fact; the help **What the marks mean**. **Settings → Person card →
  Reliability at facts in the person card** (on by default).
- **Since:** app 3.26.0, research 1.30.0

<!-- zdroj: app:7b0471f8 src/reliability.ts (RELIABILITY_ORDER, reliabilityStep: readers ≥ 2 → dvě tečky; noSource se z aplikace nekrmí, verifyLocalEvidence dává jen confirmedByHuman) · src/verify.ts factVerifyReaders (_STROM_CHECKED proven, readers) · src/ui/fact-status.ts titleProven2/titleProven1 · src/ui/status-tip.ts readersAgree · 3.27.0: app:dde0151a src/ui/status-tip.ts factSourcesModel, sourceSub(quality citace) · src/settings.ts display.reliabilityCard (ON) · index.html settings-group-card · strings.ts reliability.*, verify.reasonHead, verify.confirmedAt · app:669c08f0 src/reliability.ts userTreeOrigin (_STROM_ORIGIN tree → import, nikdy human), treeOriginWords, reliabilityOptionsOf (původ z dat stromu, ne z mostu) · research:94d75934 src/core/model.ts ValueOrigin.tree, src/core/import.ts (soubor aplikace Strom → user + tree) -->

<a id="S7.2"></a>
## S7.2 One mark on the card in the tree

A person's card in the tree has one mark in the bottom right corner: how well the person is backed and who stands
behind the facts. It takes the weakest of the card's three facts: name, birth and death.

| Mark | When |
|---|---|
| ✓ | a person confirmed the fact |
| ●● | proven, whatever the number of readers |
| ●○ | probable or possible with a citation of the original or of a copy with primary information (quality 2 or 3) |
| ○ | only a trace: a lead, or probable or possible without such a citation |
| ○○ (dashed) | from a family tree (another program's, or from the Strom app, taken in by the research), unverified |
| a dotted frame | no source |

- **Enforced by the code:**
  - only facts that have a degree count; when neither the name, nor the birth, nor the death has one, the person's
    other facts and those of their families decide (residence, occupation, a marriage): one confirmed or proven
    fact, or a citation of quality 2 or 3, is enough and the mark is ●○ (the person is known from a record, for
    example as the father in a child's baptism);
  - from app 3.27.0 the quality of a citation is its own reliability, otherwise the source's default reliability
    ([A2.6.1](A2-loading-a-family-tree.md#A2.6.1)): the same source can be a citation of quality 3 at the occupation
    and of quality 2 at the birth. A record of a change by the research that is not cited at the fact counts by its
    source;
  - a research tree whose stored data carry the research's origin of facts has the mark by degrees right after the
    page loads, the same with the bridge and without it; this holds for trees stored earlier too;
  - a tree that does not know where its facts come from (without research and without an import from another
    program) shows the mark by the person's citations: ●● documented, ●○ partly documented, the dotted frame no
    source. A tree with neither sources nor origin has no mark;
  - a placeholder person (“?”) has no mark.
- **The tip at the mark:** “Weakest fact on the card: …” and in words what the mark means.
- **Controls:** **Settings → Person card → Show on card → Sources and reliability** (on by default).
- **Since:** app 3.26.0

<!-- zdroj: app:7b0471f8 src/reliability.ts CARD_STATUS_FACTS, CardStatusClass, cardStatusClassOfFact, otherFactsClass, card status bez původu (full/partial/none) · src/ui/card-signals-ui.ts (signál status, CARD_SIGNAL_DEFAULTS vše zapnuto) · 3.27.0: app:dde0151a src/reliability.ts citesSourceRead (FactCitationRef, citationQuality; holé id = záznam změny výzkumu podle pramene), cardFactCitations, withChangeRecord · strings.ts cardDensity.cardShow, cardStatus, cardStatusSub, cardShowHint, reliability.cardFacts, cardMark.* · CHANGELOG.cs.md 3.26.0 (Jedna značka na kartičce) · app:669c08f0 src/reliability.ts reliabilityOptionsOf, treeOriginWords (strom výzkumu s původem v datech: stejně s mostem i bez) -->

<a id="S7.3"></a>
## S7.3 Verify at a fact

At a birth, baptism, marriage, death and burial that is neither proven nor confirmed, the tip at the mark offers
**Verify**. The research then verifies the fact against the original record: in the background, apart from the work
on the lines.

- **Preview before starting** (**Verify {fact}**):
  - **What** is verified;
  - **How**: “AI reads the record {record}” (the record is known, low · one known record), or “AI looks for the record
    by the family tree's citation ({citation}) and reads it”, or “AI looks for the record in the registers and reads
    it” (higher · the record is still to be found);
  - **Estimate**: about how many agent sessions it takes;
  - “Runs in the research's background. The result shows at the fact.” When searching also “If the record is not
    found, the fact stays from the family tree and the tip says why.”
- **After starting** (**Start verifying**) the fact has a mark with a clock “Waiting to be verified · {n}th in the
  research's queue” and **Verify** is not offered at it again.
- **Verify first:** a fact the research queued for verification by itself ([S7.6](#S7.6)) and that is not next in
  line has **Verify first** in its tip. The same preview with the estimate as at **Verify** follows; after **Start
  verifying** the research moves the task with this fact to the head of its queue and the tip shows the place the
  research answers (“1st in the research's queue”).
  - **From research 1.31.0:** a task the person moved up this way is kept as asked for by a person (`asked`) in the
    file for the app, in the bridge's state (`/status`) and in the counts of `strom verify status`, until a session on
    it ends. The app then does not offer **Verify first** at the fact again after a reload; before, it offered it
    again. This holds for the whole person too ([S7.4](#S7.4)).
- **Enforced by the code:**
  - a verification asked for by a person goes first in the research's queue ([R2](R2-lines-and-queue.md));
  - **Verify** is offered only for a tree linked to the research, when the bridge runs and the research can verify
    ([S7.9](#S7.9));
  - name, sex, divorce and other events are not verified;
  - **Verify first** is not offered at a fact whose verification a person asked for already (it is first in the
    queue), at a fact waiting for scans or for an archive's permission, at the one next in line, and when the research
    does not give the fact's place. A task the agent is working on right now the research does not move.
- **Limits:** a tree without research has, instead of the action, the line “With the ancestor research an AI agent
  verifies the fact in the registers itself.” in the tip. When the research does not respond: “Verifying could not
  start; the research does not respond.”; when there is nothing to verify: “The research has nothing to verify here
  now.” When the research refuses the verification, the tip says why, for example that the research is an archive,
  that it no longer has the fact, or that it is busy right now.
- **Controls:** app: the person card → the fact's mark → **Verify** (or **Verify first**) → **Start verifying**.
  Terminal: `strom verify facts P…|F…|E… [--fact …] [--dry-run]`.
- **Since:** research 1.30.0, app 3.26.0

<!-- zdroj: app:7cf409bd src/verify-offer.ts verifyOffer (prioritize: pending wait, position > 1, step, researchVerifies) · src/verify-ui-model.ts factOffer (čekání spuštěné tady: position null) · src/ui/verify-ui.ts (tlačítko prioritize → verifyOpenPreview; verifyStart: pozice z odpovědi) · strings.ts verify.prioritize, verify.pending · research:a4a2f6c0 src/core/verify.ts verifyAsk (držený úkol → queueAt next; doing nebo už next beze změny), verifyWait (wait / asked / images / permission, position) · app:7b0471f8 src/verify-offer.ts verifyOffer (Verify jen u nedoložených, s feature verify, ne archiv, ne čekající; cost low/high) · src/verify-ui-model.ts verifyFactKind (BIRT, BAPM, MARR, DEAT, BURI) · strings.ts verify.btn, previewHead, what, how, estimate1, howRead, howSearch, costLow, costHigh, sessions, previewNote, previewNoteSearch, start, pending, failed, nothing, noResearch · app:669c08f0 strings.ts verify.busy, locked, whyArchive, whyRetracted, whyGone, whyMerged, whyOld, whyRefused (odmítnutí podle kódu) · research:6c6e7c3b strom help verify facts (první ve frontě; bez přečteného originálu se záznam hledá) · research:4ac323ef src/core/verify.ts askedFor (úkol přeřazený člověkem, queueAt next, do konce sezení na něm → asked v souboru, /status, verify status) · app:src/verify-offer.ts (asked: Verify first se nenabízí) · CHANGELOG.cs.md 1.31.0 -->

<a id="S7.4"></a>
## S7.4 Verify facts at a person

All unverified facts of one person can be sent to be verified at once: with the button **Verify facts (N)** in the
person card and in the tip at the mark on the card, or with the item **Verify facts · N** in the person's menu.

- **Where:**
  - the person card: the button **Verify facts (N)** above the section **Events**. When the person has nothing to
    offer for verification but their facts are waiting to be verified, it shows “N facts waiting to be verified”
    instead of the button; otherwise nothing is there;
  - the tip at the mark on the card in the tree ([S7.2](#S7.2)): **Verify facts (N)**, the same as in the person card;
  - the person's menu: **Verify facts · N**, while verifying **Verifying · N**.
- **The window Verify the person's facts:** “{name} · N unverified facts”, a list of facts to tick, each **low** or
  **higher**, “Estimate: {n} low, {n} higher” (“Low = read a known record. Higher = the record is still to be
  found.”) and the button **Verify (N)** by the ticked ones. After starting “N facts queued for verification.” and the
  menu item shows **Verifying · N**.
- **Verify first for the whole person:** when the person has nothing to offer for verification and some of their
  facts waits further down the queue as the research queued it by itself, the person's menu has the item **Verify
  first** under **Verifying · N**, and the tip at the mark on the card has the button **Verify first** under “N facts
  waiting to be verified”. It opens the person's preview with this title; after starting, the research moves the tasks
  with the person's waiting facts to the head of its queue ([S7.3](#S7.3)). The person card keeps only the line “N facts
  waiting to be verified”.
- **Enforced by the code:** N is exactly what the research takes: the facts of the person and their families that the
  research knows (residences too, and facts already proven by another reader), except those confirmed by a person,
  those waiting to be verified, the name and the sex. The count in the menu, in the window and in the message after
  starting is the same.
- **Limits:** the button and the item show only with the research's bridge running ([S7.9](#S7.9)) and only when at
  least one fact of the person offers **Verify**.
- **Controls:** app: the person card → **Verify facts (N)** above **Events**; the tip at the mark on the card →
  **Verify facts (N)** or **Verify first**; the person's menu → **Verify facts · N**, or **Verify first** under
  **Verifying · N**; then in the window **Verify (N)**. Terminal: `strom verify facts P…`.
- **Since:** research 1.30.0, app 3.26.0

<!-- zdroj: app:7cf409bd src/ui/verify-person-ui.ts personVerifyMenu (pending + prioritize), verifyCardTipActions (st-verify-first), renderPersonVerifyRow (jen pending řádek), showVerifyPersonDialog prioritize (titulek verify.prioritize) · src/ui/card-signals-ui.ts signal-verify-first · src/ui/context-menu.ts · research:a4a2f6c0 src/core/verify.ts verifyAsk (osoba: držené úkoly na začátek) · app:7b0471f8 src/verify-ui-model.ts personVerifyAskCount · strings.ts verify.menu, menuPending, personTitle, estimate, startN, bulkStarted · app:7eb903a3 src/ui/verify-person-ui.ts renderPersonVerifyRow, personVerifyMenu (karta osoby nad #events-section; jinak personPending), verifyCardTipActions · strings.ts verify.personBtn, personPending, events.title · dirigent:prace/1109-app-jeden-rodic/karta.md Výsledek (6f58068a: menu = náhled = toast; i bydliště, i doložené) -->

<a id="S7.5"></a>
## S7.5 Verify facts in the tree

Verification against the originals can be started for a whole line, a family, or the whole tree. The window **Verify
facts in the tree** shows the scope, the order and the cost estimate first and verifies only unverified facts
(probable, possible, lead, from family tree).

- **Where:** **Verify facts in the tree…** in the section **Verifying** in What the research knows
  ([S3](S3-what-the-research-knows.md)), in the research menu and on the card **What next** after an import as
  **Check facts against sources** ([S6.4](S6-tree-from-another-program.md#S6.4)).
- **Choices:**
  - **Scope**: **Line: {name}**, **The {surname} family**, **Whole tree**;
  - **Order**: **Nearest ancestors first**, **Weakest evidence first**, **Longest unverified first**;
  - **Try on 5 people first**: “After 5 people it stops and shows the result.” The button is then **Try on 5**,
    otherwise **Verify (N)**.
- **Enforced by the code:**
  - it takes births, baptisms, marriages, deaths and burials with a citation of the original that no person has
    confirmed; proven ones too (another reader reads them), except those the current model has already verified; and
    leads from another program's family tree and from a family tree from the Strom app that nobody has changed (the
    record is searched for);
  - never living people (born less than 100 years ago with no death recorded);
  - one task per person (a marriage per family), with low priority, after the work on the lines;
  - only a person may start it: in the app, or at their own terminal. The agent may only run `--dry-run` (how many and
    at what cost).
- **Stop:** the section **Verifying** shows “Waiting to be verified: N facts · verified one by one, nearest ancestors
  first” and **Stop** (“Verification stopped.”). Stopping drops the tasks nobody has started yet; started ones run to
  the end. Dropped facts are not queued again by themselves, only with a new citation of the original or when asked
  for again.
- **Controls:** app: see above. Terminal: `strom verify bulk --scope line|lineage|tree [--of G…|P…]
  [--order ancestors|weakest|oldest] [--try N] [--budget …] [--dry-run]`, `strom verify status`,
  `strom verify stop [--bulk]`.
- **Since:** research 1.30.0, app 3.26.0

<!-- zdroj: app:7b0471f8 src/ui/verify-person-ui.ts verifyRowsHtml, treeVerifyBlock, showVerifyBulkDialog · src/ui/research-actions-ui.ts:371 (nabídka výzkumu) · src/import-next.ts IMPORT_NEXT_VERIFY_FEATURES ['verify.bulk'] · src/verify-ui-model.ts VERIFY_TRY_PEOPLE 5 · strings.ts verify.bulkRow, bulkRowSub, bulkTitle, bulkSub, scope, order, scopeLine, scopeSurname, scopeTree, orderAncestors, orderWeakest, orderOldest, tryFirst, tryFirstSub, tryN, startN, bulkNote, section, pendingRow, pendingRowSub, stop, stopped · research:6c6e7c3b strom help verify bulk, verify stop, verify status · src/core/verify.ts (žijící) · research:94d75934 src/core/verify.ts verifyBulk (origin import nebo tree → search) -->

<a id="S7.6"></a>
## S7.6 Verifying by itself in the research's queue

A fact that cites the original record and stayed probable or possible is verified against it by itself: the research
queues it without anybody asking.

- **Enforced by the code:**
  - the queue is filled after the planning of each session and after `strom sync`;
  - it takes births, baptisms, marriages, deaths and burials of people linked to the tree, off side branches, not
    living; never in the Strom archive;
  - one task per person (a marriage per family), after the work on the lines; after every 5 sessions one verification
    task moves forward (the nearest ancestor first);
  - a fact verified, kept with a reason, confirmed or lowered is not queued again, only with a new citation of the
    original or when a person asks;
  - a task that waits for scans or for an archive's permission waits like any other
    ([R6.2.1](R6-awaiting-action.md#R6.2.1), [R6.3.1](R6-awaiting-action.md#R6.3.1)).
- **Where the count shows:** `strom check` (“note: N facts with the original cited waiting to be verified against it
  → strom verify status”), the `strom doctor` row **verification against the originals** (“N facts with the original
  cited waiting to be verified, bit by bit”), `strom stats`, `strom verify status` (**Verification against
  the originals**: waiting, of them asked for, waiting for the scans to be downloaded, waiting for an archive's
  permission; verified and kept with the reason; confirmed against the scan; and why a fact was left out of the
  selection) and in the app the section **Verifying** ([S7.5](#S7.5)).
- **Since:** research 1.30.0

<!-- zdroj: research:6c6e7c3b src/core/verify.ts (záhlaví: sweep po plánování, po strom sync, VERIFY_EVERY 5, jen napojené, mimo vedlejší větve, ne žijící, ne archiv, bez znovuzařazení) · cs.json ui.check.verify, ui.doc.verify, ui.stats.verify, ui.verify.status.* -->

<a id="S7.6.1"></a>
### S7.6.1 A one-time fix of older researches

A research started before version 1.30.0 has facts citing the original that nobody has verified against the
original. The fix **Facts to verify against their originals** queues them for verification once.

- **Enforced by the code:**
  - the fix runs by itself once, at the first start of the new version after the research's backup; then similar
    facts are queued as they come ([S7.6](#S7.6));
  - only tasks: nothing on the facts changes. “Nothing is raised without a look at the original; no value is
    overwritten.”;
  - `strom fixes undo verify-originals` drops the tasks nobody has started; started or finished ones stay;
  - in the Strom archive it is only noted that it ran.
- **In the app:** after the research is updated, once the message “N facts with an original are waiting to be
  verified, one by one.”
- **Controls:** terminal: `strom fixes` (the list of fixes and what they did), `strom fixes undo verify-originals`.
- **Since:** research 1.30.0, app 3.26.0

<!-- zdroj: research:6c6e7c3b src/commands/fixchecks.ts VERIFY_ORIGINALS (Applied by itself once, at the first start of this strom after its backup; agentWork) · src/commands/fixes.ts "verify-originals" (undo: nobody started) · cs.json ui.fixes.verify-originals.name, .does, .not · app:7b0471f8 strings.ts verify.queuedToast -->

<a id="S7.7"></a>
## S7.7 The result of verifying

The session that verifies a fact opens the scan of the record and reads it. The result is one of two: the fact is
proven by the scan, or it stays as it was, with a reason.

- **Enforced by the code:**
  - proving is possible only with a scan read; without a look at the original nothing is proven;
  - a kept fact has a reason that the app shows in the tip (“Stays {degree} · verified by the research on {date}”);
  - verification overwrites no value. When the record says something else, a proposal or a conflict arises for a
    person to decide ([S6.3](S6-tree-from-another-program.md#S6.3), [R5](R5-conflicts.md)); a fact entered or
    confirmed by a person the agent never changes;
  - the result is written only by the session doing the verification task (`strom verify done`).
- **Why:** the agent proves, a person confirms. Even two readers agreeing is a reading by AI; certainty comes only from
  a person with the scan ([S7.8](#S7.8)).
- **Since:** research 1.30.0, app 3.26.0

<!-- zdroj: research:6c6e7c3b strom help verify done (--proven --image | --kept --reason, jen uvnitř sezení) · cs.json ui.fixes.verify-originals.not · app:7b0471f8 strings.ts verify.reasonHead -->

<a id="S7.8"></a>
## S7.8 Confirm against the scan: confirmation by a person

The strongest mark is given by a person: they look at the scan of the record, compare it with the fact and in the tip
at the mark click **Confirm against the scan**. The fact is then **Confirmed** (✓), and in place of the action the
tip shows the state “✓ Confirmed against the scan on {date}” and **Undo**.

- **Enforced by the code:**
  - **Confirm against the scan** is offered only for a fact with a source: a citation, or the record the research read
    the value from. A fact without a source does not have it: there is nothing to confirm against;
  - what is confirmed is the value the person sees. When the research has changed it meanwhile, nothing is confirmed:
    the tip closes, the app says “The fact has changed meanwhile; nothing was confirmed. Only the research's current
    value can be confirmed.” and loads the research's current version (a tree with changes the research does not have
    yet asks first, **Load the research version?**). A value changed in the app and not sent yet is not sent to be
    confirmed; the tip says the same;
  - **Undo** takes the confirmation back (“Confirmation undone”); the fact then has the degree it had before;
  - a confirmation holds only for the confirmed value: a change of the fact ends it, and when the value comes back it
    holds again;
  - a confirmed fact the agent never changes, it only proposes ([S6.3](S6-tree-from-another-program.md#S6.3));
  - a tree without research: the app keeps the confirmation itself, at a fact that cites a source, when the tree can be
    edited. The confirmation and its undoing go with the tree into the research, also through a GEDCOM file;
  - a confirmation the app keeps is a change of the tree: it has a step back (“confirming a fact of {name} against
    the scan”, “undoing the confirmation of {name}”) and an entry in the change history (“Fact of {name} confirmed
    against the scan”, “Confirmation against the scan undone: {name}”);
  - a tree linked to the research: the research writes the confirmation through the bridge, only when the bridge runs
    and the research can do it; the name and the sex are not confirmed here;
  - in the terminal only a person at their own terminal confirms: `strom verify confirm E… [--undo]`. To the agent
    `strom` refuses the confirmation.
- **Limits:** a tree linked to the research whose bridge does not run offers neither **Confirm against the scan** nor
  **Undo**; confirming works only with the bridge running, or in the terminal. When the research refuses the
  confirmation, the tip says why, for example that the research is an archive, or that another session holds it;
  “Not changed: the research does not respond.” only when it does not respond.
- **Why:** certainty about a fact comes from a person seeing the record themselves. Verification by the agent is a
  reading by AI; ✓ says that a person saw the record. A confirmed transcript
  ([A3.1.1](A3-evidence-in-the-app.md#A3.1.1), [R3.4.1](R3-verification-and-citation.md#R3.4.1)) confirms the
  text of the record, **Confirm against the scan** a fact of the person.
- **Controls:** app: the person card → the fact's mark → **Confirm against the scan** / **Undo**. Terminal:
  `strom verify confirm E…`, `strom verify confirm E… --undo`.
- **Since:** research 1.30.0, app 3.26.0

<!-- zdroj: app:7b0471f8 src/verify-offer.ts (human → Vzít zpět; bez výzkumu scan u citovaného; ve stromu výzkumu scan jen s researchConfirms) · src/verify.ts factConfirmation/researchConfirmation (platí jen s nezměněnou hodnotou) · src/verify-ui-model.ts (jméno, pohlaví bez scan ve stromu výzkumu) · strings.ts verify.scan, undo, undone, confirmedAt · app:7eb903a3 src/ui/verify-ui.ts (✓ jen u stavu, akce bez ✓; verifyConfirm: bez mostu DataManager.confirmFact) · src/data.ts confirmFact/unconfirmFact (undo.confirmFact, unconfirmFact, auditLog.confirmedFact, unconfirmedFact) · strings.ts verify.scan, confirmedAt · CHANGELOG.cs.md 3.26.0 · dirigent:test/vysledek-1109-zaver-c-potvrzeni.md (N2: bez mostu ✓ ani Vzít zpět ve stromu výzkumu) · prace/1109-app-potvrzeni-zmena · research:6c6e7c3b strom help verify confirm (jen uživatel, most; mimo něj requireHuman) · app:669c08f0 src/verify-offer.ts verifyOffer (scan jen se source: citace nebo záznam, ze kterého výzkum četl), src/verify.ts factConfirmMark (3 _TXT; changed), src/ui/verify-ui.ts verifyConfirm (409 confirm.changed → zavřít bublinu, toast, researchLoadNewer; změněno tady → jen důvod), strings.ts verify.confirmChanged, confirmLocked, confirmBusy, confirmFailed, sync.loadTitle · research:94d75934 POST /facts/confirm {txt} → 409 confirm.changed, feature facts.confirm.value -->

<a id="S7.9"></a>
## S7.9 What works with the bridge and what without it

| | Tree linked to the research, the bridge runs | Tree linked to the research, the bridge does not run | Tree without research |
|---|---|---|---|
| Marks at facts and on the card | yes | yes, the same as with the bridge (by the last state from the file) | yes, from the import and the citations |
| **Verify**, **Verify first**, **Verify facts · N**, **Verify facts in the tree…** | yes | no | no (a line about the ancestor research) |
| **Confirm against the scan**, **Undo** | yes, the research writes it | no | yes, the app keeps it |
| **Stop** verifying | yes | no; `strom verify stop` in the terminal | – |
| Verifying in the research's queue | runs | runs (the research does not wait for the app) | – |

- **Enforced by the code:** the research verifies even without the app: in the terminal `strom verify facts`,
  `strom verify bulk`, `strom verify status`, `strom verify stop` and (only a person) `strom verify confirm` work.
  The research's bridge: [S1.1](S1-connecting-app-and-research.md#S1.1).
- **Since:** research 1.30.0, app 3.26.0

<!-- zdroj: app:7b0471f8 src/verify-offer.ts (feature verify a facts.confirm jen ze stavu výzkumu přes most) · dirigent:test/vysledek-1109-zaver-c-potvrzeni.md (N2) · research:6c6e7c3b strom help verify -->
