<a id="R1"></a>
# R1 The research in brief

How the research works as a whole, on one page. Each section leads to a chapter with the exact rules. Describes
the research 1.25.2 and the Strom app 3.21.2.

<a id="R1.1"></a>
## R1.1 The research is a record, not a conversation

The research is a folder on the computer. An AI agent (for example Claude Code or Codex) writes into it only with the
`strom` command: persons, events, sources, searches made, hypotheses and conflicts. What is not written into the
research is lost when the session ends, so the agent writes as it goes.

- **Limits:** nothing is deleted. A wrong fact is withdrawn with a reason, a changed fact is corrected with a reason,
  and the history keeps the original form too.
- **Since:** research 1.0.0

<!-- zdroj: research:assets/method/core.md „Nothing is deleted“, „Write as you go“ -->

<a id="R1.2"></a>
## R1.2 What the agent works on

What the research investigates is set by its **lines**: the ancestors of a person, the descendants of a person, or one
question. Lines give rise to tasks, and the open tasks form one **queue**. The agent always takes the first task in the
queue. Work on people no line reaches comes after the work on the lines.

- Tasks have kinds, in the order they go when their place in the queue is otherwise equal: material from the user,
  where the records are, proving a link, verification, enriching a person, a request to an archive, a story.
- **The tree first, then above it:** a family found in the records that no proven link joins to the tree is not
  researched further until the link is proven ([R10.4](R10-people-and-hypotheses.md#R10.4)).
- What the research does with material from the user: [R11](R11-material-from-the-user.md).
- In detail: [R2](R2-lines-and-queue.md).

<!-- zdroj: research:src/core/queue.ts LEVEL_ORDER · assets/method/core.md „The tree first, then above it“ -->

<a id="R1.3"></a>
## R1.3 How the agent works: sessions

The agent works in **sessions**. One session is one task with a time limit. At the end the agent writes what is done
and what should come next, and closes the session. When working alone, session follows session as long as there is
work and the condition set by a person allows it (for example the pace of the weekly subscription limit).

- A research can also be only a **Strom archive**, which the agent does not work on:
  [R7.8](R7-when-the-agent-works.md#R7.8).
- In detail: [R7](R7-when-the-agent-works.md).

<!-- zdroj: research:src/commands/run.ts · assets/method/core.md „The time is strom's to say“ -->

<a id="R1.4"></a>
## R1.4 How the research weighs evidence

The agent works by the **Genealogical Proof Standard** (GPS): a reasonably exhaustive search, a citation for every fact,
analysis and correlation of the evidence, resolution of conflicts, and a written conclusion another researcher can follow.

- Every fact has a degree of certainty: **Lead**, **Possible**, **Probable**, **Proven**. A family tree and family
  memory are always only a lead; an index serves to find the entry. In detail: [R3](R3-verification-and-citation.md).
- A namesake is not the person sought. A person is identified by year, place, house, occupation, spouse and parents.
  Two records with the same name and different parents are two persons. Identifying persons, their names and
  competing hypotheses: [R10](R10-people-and-hypotheses.md).
- A search that finds nothing is a result. What exactly was searched is written down, so the same book is not searched
  twice.
- When records differ, the agent does not choose silently: it writes a **conflict**. In detail: [R5](R5-conflicts.md).
- A place gets a position on the map only when it is certain which place it is. In detail: [R4](R4-places.md).

<!-- zdroj: research:assets/method/core.md (úvod, „Certainty is explicit“, „A namesake is not your person“, „Negative results are results“) -->

<a id="R1.5"></a>
## R1.5 What a person decides

Some decisions belong to a person only. The research asks about them in **Awaiting action**, and the agent does not
answer for the person.

- What waits for a person (letters, images to download, questions about places, conflicts, stories to approve) and
  where it is dealt with: [R6](R6-awaiting-action.md).
- A person's decision holds. The agent changes it only on the strength of a new source: [R5.4](R5-conflicts.md#R5.4).
- A place position set by a person does not change: [R4.3](R4-places.md#R4.3).
- Settings that change what the agent may do are confirmed by a person (for example the condition for working alone,
  [R7](R7-when-the-agent-works.md)).

<!-- zdroj: research:assets/method/waiting.md · src/core/conflicts.ts againAllowed · src/core/placeid.ts personsHand · src/core/config.ts run.gate -->

<a id="R1.6"></a>
## R1.6 The research and the Strom app

The Strom app shows the research as a family tree: persons, facts with their degree of certainty, sources and conflicts,
and, while the agent works, the work in progress. Edits in the app are sent back to the research. An edit of a fact a
record proves does not overwrite it but becomes a conflict ([R5](R5-conflicts.md)). Part S will describe how the app
and the research work together.

<!-- zdroj: research:src/core/sync.ts:1-19 · app:strings.ts research.knows -->

<a id="R1.7"></a>
## R1.7 How the research reads scans

Most facts come from scans of parish registers and other books. The research first determines the book, downloads
images only through the archive's downloader and only those needed. A book is browsed by **readers** (`strom read`):
separate agents, each with a batch of images. An entry that will be cited the main agent reads itself from a crop at
full resolution and records it with a clip and a transcription. Reading by an AI model is not one hundred per cent;
important facts should ideally be verified by a person as well.

- In detail, step by step: [R8](R8-reading-scans.md).
- **Since:** research 1.0.0

<!-- zdroj: research:assets/method/reading.md · assets/method/locate.md · assets/method/recording.md · src/commands/read.ts:183-200 -->
