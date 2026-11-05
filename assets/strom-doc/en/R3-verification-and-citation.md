<a id="R3"></a>
# R3 Verification and citation

How the research sets how certain each fact is, what must hold for a fact to be proven, and how the app shows it.
Describes the research 1.25.2 and the Strom app 3.21.2; changes from a later version carry its number.
The rules separate what **the code enforces** (the `strom` command refuses the entry otherwise) from what is only
**a rule of the method** (an instruction to the agent that the code does not check).

<a id="R3.1"></a>
## R3.1 Degrees of certainty of a fact

Every fact (birth, baptism, marriage, occupation…) has one of four degrees of certainty. The degree says how certain
the conclusion is from all the fact's sources, not how good one source is ([R3.2.1](#R3.2.1)).

| App | Terminal | Meaning by the method |
|---|---|---|
| **Proven** | proven | the agent read the original record itself and the record states the fact directly |
| **Probable** | probable | good evidence, but indirect, or a single reading of hard handwriting |
| **Possible** | possible | weak evidence |
| **Lead** | only a lead | a family story, a family tree, an index or an estimate: something to verify, not a fact |

- **Limits:** a fact can also be disproven (`--status disproven`) or withdrawn (`strom event retract E… --reason "…"`).
  Nothing is deleted. A withdrawn fact is shown nowhere and cannot be cited or edited. `strom person show` shows the
  names in the user's language to a person only; the agent reads `proven`, `probable`, `possible`, `lead` there.
- **Controls:** app: the label at the fact (a person's events, marriage and divorce, a couple's shared events),
  read-only · terminal: `strom person show`, `strom person card`, `strom stats` (the line “Facts: proven … · only
  leads …”); entry `strom event add … --status`, `strom cite E… S… --status`, `strom event edit E… --status …
  --reason "…"`.
- **Since:** research 1.0.0; names in the user's language in the terminal 1.1.0 (for `strom person show` 1.12.0);
  the label in the app 3.9.0
- **From research 1.26.0:** the terminal names the degrees in the app's words: **proven**, **probable**, **possible**,
  **lead**, **disproven**. The summary `strom stats` still writes “only leads”.

<!-- zdroj: research:src/core/model.ts:36 STATUSES · assets/method/core.md:8-12 · src/cli/human.ts:138 statusName · assets/lang/cs.json ui.st.*, ui.stats.facts · src/commands/people.ts:115 wordsFor · src/core/actions.ts:629 notRetracted · app:src/ui/fact-status.ts · strings.ts factStatus · 1.26.0: src/cli/human.ts:139 STATUS, cs.json ui.st.* (commit fe59fb40) -->

<a id="R3.1.1"></a>
### R3.1.1 The default degree and the citation that raises it

- A fact entered without `--status`: with no citation **Lead**; with a citation of at least one source that is not
  weak ([R3.3](#R3.3)), **Probable**; otherwise Lead.
- `strom cite` without `--status` raises Lead to Probable when the new source is not weak. It changes no other degree.
- A change of degree with `strom event edit --status` needs `--reason`; a citation with a degree
  (`strom cite … --status`) does not.
- Enforced by the code. **Since:** research 1.0.0

<!-- zdroj: research:src/core/evidence.ts:49 defaultStatus · src/core/actions.ts:636-650 citeEvent, :903-913 event.needs-reason -->

<a id="R3.2"></a>
## R3.2 What the code lets through as Probable and Proven

A degree must not claim more than the fact's citations give. The code checks this at every entry of a degree:
`event add`, `cite`, `event edit`, and for facts that come from the app.

- **Limits (enforced by the code),** in this order:
  1. Probable and Proven need at least one citation.
  2. At least one citation must be from a source that is not weak. Weak are a family tree (`--kind family-tree`),
     a memory (`--kind family-memory`) and an authored work (`--form authored`).
  3. Proven additionally needs, among the citations from sources that are not weak, at least one with primary
     information (`--information primary`): a record written at the time of the event by someone who knew. The
     information at a citation takes precedence over the information at the source.
- **Method only:** the code does not check that the source is an original (`--form original`), that the agent read it
  itself, that the record states the fact directly, or a blind second reading ([R3.5](#R3.5)). Proven therefore also
  passes for a copy or an index with primary information.
- **Controls:** terminal: `strom event add P… BIRT --date "…" --cite S… --information primary --status proven`.
  A refusal gives the reason and what to do instead (leave it a Lead, `--status possible`, or `--status probable`).
- **Since:** research 1.0.0

<!-- zdroj: research:src/core/evidence.ts:27 isWeak, :32 informationOf, :55-68 checkStatus · src/core/actions.ts:196-209 makeEvent, :648, :906 · src/commands/people.ts:745 -->

<a id="R3.2.1"></a>
### R3.2.1 A source: form and information

- `strom source add --form original` (default) · `derivative` (a copy, an index; the default for `--kind index` and in
  a book that is only an index) · `authored` (a compiled work).
- `--information primary|secondary|unknown` (default `unknown`) applies at a source; at a citation (`event add`,
  `cite`) only for that fact. A record that names the parents (a grandchild's baptism) is secondary information for
  them (method).
- The quality of a citation goes into GEDCOM as QUAY: 3 an original with primary information · 2 an original
  otherwise, or a copy with primary information · 1 a copy otherwise, or an authored work · 0 a family tree and
  a memory.
- A change of a source's form, information, kind or transcription (`strom source edit`) needs `--reason`; adding one
  does not.
- App: the **Reliability** of a source comes into the research as **Original** = an original with primary
  information, **Copy / index** = an original with secondary information, **Uncertain** = a copy with unknown
  information.
- **Since:** research 1.0.0; Reliability from the app research 1.12.0

<!-- zdroj: research:src/commands/sources.ts:197-198, :221, :837 · src/core/evidence.ts:40 quay · src/core/sync.ts:4660 QUAY_EVIDENCE · assets/method/recording.md:38-46 · app:strings.ts sources.quality1-3, src/ui/sources.ts:76 -->

<a id="R3.3"></a>
## R3.3 A source, or a lead

A family tree, a memory, an index, a catalogue and an online tree say where to look. They are not evidence of a fact.
A fact from them stays a Lead until a record proves it.

- **Enforced by the code:** a family tree, a memory and an authored work are weak sources: a fact only from them is
  never Probable or Proven ([R3.2](#R3.2)). A family tree taken over: [R11.3](R11-material-from-the-user.md#R11.3).
- **Method only:** an index. The code does not treat it as weak: with its citation a fact without `--status` gets the
  degree Probable, and with `--information primary` even Proven passes. The method wants an index only for finding the
  page; the entry is read in the register. Even an entry missing from an index is only a lead: a similar form of the
  surname is a candidate.
- Material from the user (a document, a photo, a letter, what the user says): [R11.2](R11-material-from-the-user.md#R11.2).
- **Since:** research 1.0.0

<!-- zdroj: research:assets/method/core.md:8-12 · locate.md:22-24 · link.md:6-12 · intake.md:9-16 · src/core/evidence.ts:27 isWeak · src/core/import.ts:1-7, :113-117 · src/commands/sources.ts:221 -->

<a id="R3.4"></a>
## R3.4 A citation: clip and transcription

A citation says where exactly in a source the fact stands. A source is one entry; several entries on one page are
several sources.

- **Method only:** every entry from a scan gets `--clip` (the cut-out in which the agent read it) and `--transcript`
  (the words of the entry as they stand, line by line, an unread letter `[?]`), plus `--locator` (folio, page, entry
  number) and, at the fact, `--quote`. A field (`--date`, `--house`, `--age`, a name) takes only what is read with
  certainty; what is uncertain goes into the transcription with `[?]` and into the fact's note.
- **Enforced by the code:** at most 3 clips per source (the entry and its continuation across a page break). The code
  does not refuse a missing clip or transcription; it only reminds about it for a source on a scan: after
  `strom source add`, after `strom source edit` with an image or a clip, and at `strom task done` for the sources the
  task entered.
- Older sources: `strom clips` adds the clip, `strom transcripts` the transcription (readers; a second look checks them).
- **Controls:** terminal: `strom source add "…" --clip B…:57@x,y,w,h --transcript @notes/entry.txt --locator "…"`.
  The app shows the clip of the entry beside the transcription.
- **Since:** research 1.1.0 (clip, `strom clips`, `strom transcripts`); transcription 1.0.0
- **From research 1.26.0:** the help of the `--clip` option says “another for each page break, at most 3” (in 1.25.2
  “a second”). The rule does not change.

<!-- zdroj: research:assets/method/recording.md:19-27, :55-62 · src/core/media.ts:285 MAX_CLIPS, :481 transcriptNote, :492 clipNote · src/commands/sources.ts:183, :214, :250, :893 · src/commands/tasks.ts:366-369 finishTask · src/commands/clips.ts · src/commands/transcripts.ts · HEAD commit 6bc7430b -->

<a id="R3.5"></a>
## R3.5 A blind second reading

A conclusion that rests on one hard-to-read cell (a house number, an age, a given or maiden name) needs a second,
independent reading. A fact goes above Probable only when two independent readings agree.

- **Method only:** the second reader does not know the expected value, the name, the place, or why it matters. One
  cell, one reader. First `strom readings B… --image N`: two readings may already exist. The readings differ: the agent
  looks again; a real difference is a conflict with both readings (see [R5](R5-conflicts.md)), not a choice.
- **Enforced by the code:** `strom read --blind` tells the reader it reads blind (transcribe exactly, add nothing).
  It gives a double page as two sharper halves; the reader's report has “Blind: yes” in its header. The code does
  **not check** that a Proven fact has a blind reading ([R3.2](#R3.2)).
- **When the method wants it:** before Proven for a fact on one hard cell; in a verification task from a person review
  (Probable facts that cite a source with an image: agreement → Proven, difference → conflict); for a user's
  transcription ([R3.5.1](#R3.5.1)).
- **Controls:** terminal: `strom read M… --blind --crop x,y,w,h --question "…"`; a person review: menu **Review one
  person: check and complete what is known of them**, `strom review`.
- **Since:** research 1.0.0; the verification task from a person review 1.1.0

<!-- zdroj: research:assets/method/verify.md:3-18 · recording.md:62-65 · src/commands/read.ts:192, :206, :334, :506 · src/core/reader.ts:194 readerPrompt · src/core/review.ts:205 singleReadings, :269 · src/core/phrases.ts review.verify.* · cs.json ui.menu.review -->

<a id="R3.5.1"></a>
### R3.5.1 Transcriptions and readings from the app

A transcription a user writes in the app is never taken as Proven by the research, and the research does not
overwrite it. How the research counts it is set by the tree setting in the app.

- **My source transcriptions → Lead** (default): a new fact from the transcription is a Lead. The research proposes
  a verification task.
- **My source transcriptions → Evidence**, or **Transcription verified** ticked at the source: the transcription counts
  as a first reading. The facts on it are Probable, not Proven. The choice applies to sources new or changed from the
  next send.
- A document read by the research's readers: one reader → Possible; two blind readers agreeing → Probable;
  a transcription edited in the app, differing readings, an uncertain reader, or a fact the reading does not state →
  Lead.
- **Enforced by the code:** these degrees. Nothing from the app ever becomes Proven.
- **Method only:** in a verification task the agent finds the record, registers the image and reads it blind itself.
  Agreement → a note at the source; difference → a conflict with both readings.
- **Since:** research 1.12.0, app 3.9.0; a document read by the research's readers 1.18.0

<!-- zdroj: research:assets/method/verify.md:19-24 · src/core/sync.ts:220, :824, :3367 readsFor, :3870 reading, :3992 · src/core/readsync.ts:190 readingGrade · cs.json sync.verify.*, read.note.* · app:strings.ts treeSettings.transcripts/guide/evidence/evidenceDesc/notRetroactive, sources.verified -->

<a id="R3.6"></a>
## R3.6 A negative search

A search that finds nothing is a result. Every search is entered, even without a find, with what exactly it covered.
The costliest mistake is searching the same book twice.

- **Limits (enforced by the code):**
  - `--result found|negative|partial|inconclusive`; `found` needs `--found S…` (the source is entered first);
  - the code refuses `negative` while the searched range still holds a spot a reader reported as unclear and nobody
    has looked at it since at full size, on the right side of the double page. Readings count from the task's first
    session (otherwise the last 24 hours). What remains is `--result inconclusive` with the spot in `--note`, or
    `--result partial` with the clearly read pages in `--pages`;
  - a search in an index that finds nothing (`--method index`) is listed as “negative in the index only”;
  - `strom task done` for a task of the kinds where the records are, proving a link, verification and enriching
    a person reminds when the task entered no search.
- **Method only:** a negative only after looking at the pages at full size. Missing pages of a book are not searched
  (`--pages 40-52,55-69`). After `--until-found` only the images read, as `--result partial`.
- **Controls:** terminal: `strom search add "…" --recordset B… --years … --surname … --pages … --method
  index|page-by-page|full-text|catalog|web|request|other --result negative --by main|reader|user --note "…"`.
- **Since:** research 1.0.0; the refusal over an unclear spot and “in the index only” 1.14.0

<!-- zdroj: research:assets/method/core.md:22-25 · reading.md:22-30, :70-84 · src/commands/analysis.ts:208-268 · src/core/model.ts:484-485 · src/commands/readings.ts:347-380 openUnclear, :414 refuseNegativeOverUnclear · src/core/evidence.ts:21 searchedAs · src/commands/tasks.ts:348-351 -->

<a id="R3.7"></a>
## R3.7 When the agent asks a person

The agent sets readings and degrees of certainty itself. It asks a person only where it cannot go on without them.
The question goes to **Awaiting action** (see [R6](R6-awaiting-action.md)) as an impersonal sentence.

- **Method only,** the agent asks (`strom task wait T… --on "…"`): a similar form of the surname in the right house or
  years (it asks for the page before ruling it out); a catalogue the agent cannot open (`--kind web --url`); images
  the archive does not allow to be downloaded automatically (`--images B…:40-69`); a page that blocks automation
  (`--check <url>`), only when no other way worked and the source remains necessary.
- **Enforced by the code,** a person only: the answer to a waiting task (`strom task wake T… --answer`) and to a page
  check (`--check`) is confirmed by a person in their terminal or in a window; “not a mistake” for a check's finding
  (`strom quality dismiss`).
- **Method only:** a conflict the user decided holds; the agent reopens it only for a source the decision did not
  weigh (see [R5](R5-conflicts.md)). The agent does not overwrite a user's transcription ([R3.5.1](#R3.5.1)).
- **Since:** research 1.0.0; the answer by a person only 1.14.0 at the latest; “not a mistake” 1.22.0

<!-- zdroj: research:assets/method/link.md:6-12 · locate.md:17-27 · reading.md:105-121 · waiting.md:14-17 · core.md:124-130 · recording.md:77-81 · src/commands/tasks.ts:928-946 task.check-person, task.answer · src/commands/quality.ts PERSON · src/cli/main.ts:287-290 requireHuman -->

<a id="R3.8"></a>
## R3.8 How the app shows evidence

The app uses the word “documented” in more than one sense. The degree of certainty is set by the research; the
documentation level of a person is counted by the app itself, from citations only.

| Where in the app | What it shows | Based on |
|---|---|---|
| the label at a fact, e.g. **Proven** | the degree of certainty of the fact | the research ([R3.1](#R3.1)) |
| **Tree overview → Data quality → Certainty of research facts** | births, deaths and marriages by degree | the research |
| the person page, **For researchers → Certainty of the facts** | the degree of each of the person's facts | the research |
| **Documented** / **Partly documented** / **Undocumented** (● ◐ ○) | the documentation level of a person | citations ([R3.8.1](#R3.8.1)) |
| **For researchers**, “Backed by sources: {n} of {m} facts” | the person's facts with a source | citations |
| **Tree overview → Ancestors**, column **documented** | ancestors with a documented birth | with a research only Proven, otherwise citations |
| **Where evidence is missing → Births not proven in the research** | ancestors' births that are not Proven | the research |
| book, **Researcher data**: ● documented · ◐ conflict · ○ not documented | the evidence state of a fact | Proven, **or** any citation |
| **My source transcriptions → Evidence** | how the research takes the user's transcriptions | first reading, Probable ([R3.5.1](#R3.5.1)) |

- **Limits:** the app only shows degrees of certainty; they cannot be changed there. A conflict at a fact in the book
  overrides both ● and ○.
- **Since:** app 3.5.0 (person level), 3.9.0 (label, My source transcriptions), 3.13.0 (Certainty of research facts),
  3.13.1 (column documented), 3.18.0 (For researchers), 3.19.0 (book)

<!-- zdroj: app:src/ui/fact-status.ts · src/tree-overview.ts:224-233 birthDocumented · src/ui/tree-overview.ts:1037, :1960, :1650-1680 · src/person-page.ts:1014-1019 · src/book-blocks.ts:468-484 evidenceMark · strings.ts treeOverview.*, personPage.research.*, book.evidence.*, book.dlg.research(Hint), treeSettings.evidence -->

<a id="R3.8.1"></a>
### R3.8.1 The documentation level of a person

- **Undocumented** (○): neither the person, nor their events, nor their unions cite any source.
- **Documented** (●): a cited birth (or baptism) and, when the person has a death (a date, a place, a death or burial
  event), also a cited death (or burial, cremation).
- **Partly documented** (◐): everything in between, including a source attached only to the person (to the name, to
  a residence).
- The degree of certainty is not counted: a birth citing even a family tree taken over (Lead) gives ●. The app says so
  at **Certainty of research facts**: “Not the same as source evidence.”
- When nobody in the tree cites a source, the card does not show the level. A placeholder person has no level.
- **Controls:** app: the card option **Evidence from sources**; the highlight **Evidence** in the tree; **Tree
  overview → Data quality → Where evidence is missing**.
- **Since:** app 3.5.0

<!-- zdroj: app:src/evidence-level.ts personEvidence, treeHasAnySource · strings.ts treeHealth.evidenceMode/evFull/evPartial/evNone, cardDensity.cardEvidence/cardShowHint, treeOverview.certaintyDesc -->

<a id="R3.9"></a>
## R3.9 A story keeps its sources

A story says which sources it rests on. A new version of a story loses nothing of the previous version without a
reason.

- **Limits:**
  - the sources of a story are the sources its facts cite, the sources of the background of the place and time, and
    the sources the text names only by an identifier;
  - a new version must keep every fact, source and reference of the previous version, or leave it out with a reason.
    Otherwise the research refuses it and lists what would be missing. What a version left out and why stays with the
    story;
  - a story told from a lead names in the text the title of the source and that nobody has read the record yet. When
    the text does not name the source, the research points it out;
  - approving a story stays with a person ([R5.5](R5-conflicts.md#R5.5)).
- **Controls:** terminal: `strom story show P…` (every fact with its sources, then the background), `strom story set
  P… --fact E… --source S… --drop "E… <why>"`. The Strom file: the story's sources as `2 SOUR` under `_STORY`.
- **Since:** research 1.26.0

<!-- zdroj: research:src/core/storykeep.ts StoryVersion, StoryDrop, StorySource, storySources · src/commands/story.ts:104 --drop, :151 told from a lead, :231 story show · assets/method/narrate.md · CHANGELOG.cs.md 1.26.0 -->

<a id="R3.9.1"></a>
### R3.9.1 What a story claims

A story is written from the facts, for the family. What has not been proven is not made up.

- **Method only:**
  - every claim rests on a recorded fact; what is inferred is marked as an inference; what is not known is said;
  - the background of the place and time (a war, an epidemic, a fire, what the village lived on) only from a source
    recorded in the research and only as background, never as the cause of what a person did, unless the record says
    so;
  - a couple's story tells their shared life: the marriage, the household, the homes, the children, being widowed.
    The life of each of them before and after it belongs to their own story and is mentioned in one sentence;
  - an old occupation and a term the reader does not understand are explained; the story is written in the language
    of the research;
  - the format of the text: only paragraphs, subheadings, bullets, bold and italics. Anything else (links, tables,
    quotations, numbered lists) the app shows as plain text, according to the method.
- Approval and a new version of an approved story: [R6.3.2](R6-awaiting-action.md#R6.3.2).
- **Controls:** terminal: `strom story set P… --text @notes/… --fact E… --source S… --note "co je odvozené"`
  (a couple's story on the family F…).
- **Since:** research 1.0.0; the background of the place and time 1.10.0; the format of the text 1.8.0; a couple's
  story 1.23.0

<!-- zdroj: research:assets/method/narrate.md (celé; formát od v1.8.0, pozadí od v1.10.0, pár od v1.23.0) · research:src/commands/story.ts --note -->
