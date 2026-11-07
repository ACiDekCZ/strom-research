// A new wording for a transcript the person read or confirmed (spec 065 K2.3): never written over theirs
// (core/transcriptguard.ts) — proposed to them instead. The proposal is a note on the source, and one task for the person
// per source (Task.proposal, waiting): a further proposal goes to the same task. Only the person decides it — at their
// terminal (strom's menu, What waits; a link of the Strom app), or in the Strom app through its bridge (POST
// <token>/sources/proposal): the proposed wording taken (written as theirs, their reading of it), or the transcript
// kept (the wording declined: never proposed again). The task is never the queue's nor an agent's to close.
//
// For other parts of strom that hand on a new wording (a reading of the record again): proposeTranscript, and
// rejectedProposal to leave out what the person declined already.

import type { ProposalWas, Source, Task, UserReading } from "./model.ts";
import { now, type Tree } from "./tree.ts";
import { create, requireRecord, update } from "./records.ts";
import { makeNotes } from "./actions.ts";
import { phrase, type PhraseKey } from "./phrases.ts";
import { markOf, transcriptMark, userReading } from "./readers.ts";
import { readingWords, transcriptDiffers } from "./transcriptguard.ts";
import { UsageError } from "./errors.ts";
import { actsAsArchive } from "./state.ts";
import { truncate } from "../cli/format.ts";

/** The origin of the person's task of a proposed transcript. */
export const PROPOSAL_ORIGIN = "transcript:proposal";

/** What became of a wording proposed (proposeTranscript). */
export type ProposalOutcome =
  /** a task for the person made */
  | "proposed"
  /** another wording: in the task that waits already (its note), the task's proposal now this one */
  | "appended"
  /** the wording the task proposes already: nothing written */
  | "same"
  /** declined by the person before: nothing written, never proposed again */
  | "declined"
  /** the transcript's own words: nothing to propose */
  | "unchanged"
  /** nobody's reading holds the transcript: nothing proposed — the transcript may be changed as any other */
  | "unconfirmed";

export interface ProposalResult {
  outcome: ProposalOutcome;
  source: string;
  /** The person's task of it (proposed, appended, same). */
  task?: string;
  /** What the agent is told (English). */
  line: string;
}

/** The person's task of a proposal for a source that waits for them (or put aside while the research is an archive). */
export function openProposal(tree: Tree, sourceId: string): Task | undefined {
  return tree
    .list<Task>("task")
    .find((t) => t.proposal?.source === sourceId && (t.state === "waiting" || (t.state === "parked" && t.heldBy === "archive")));
}

/** Whether the person declined this wording for the source's transcript before (kept theirs): never proposed again. */
export function rejectedProposal(tree: Tree, sourceId: string, text: string): boolean {
  const s = tree.get<Source>(sourceId);
  return !!s?.read?.declined?.includes(transcriptMark(text.normalize("NFC").trim()));
}

/** How the person read the transcript, in the research's language. */
function readPhrase(lang: string, u: UserReading | undefined): string {
  return u ? phrase(lang, `proposal.read.${u.how}` as PhraseKey) : "";
}

/**
 * Propose a new wording for a transcript the person read or confirmed, instead of changing it: a note on the source,
 * and the person's task (one per source — a further wording goes into it). Nothing of the transcript changes. `by`: who
 * proposes (default: the tree's actor); `why`: the reason, when said; `reading`: the document's reading (D…) it came
 * from. A source nobody's reading holds is left alone ("unconfirmed": the caller changes it as any other).
 */
export function proposeTranscript(tree: Tree, sourceId: string, text: string, o: { by?: string; why?: string; reading?: string; unsure?: boolean } = {}): ProposalResult {
  return tree.withTreeLock(() => {
    const s = requireRecord<Source>(tree, sourceId, "source");
    const id = s.id;
    const words = text.normalize("NFC").trim();
    const u = userReading(s);
    if (!u) return { outcome: "unconfirmed" as const, source: id, line: `${id}: nobody's reading holds its transcript — nothing proposed (change it as any other: strom source edit ${id} --transcript …)` };
    if (!transcriptDiffers(s.transcript?.trim(), words)) return { outcome: "unchanged" as const, source: id, line: `${id}: the wording is its transcript's own — nothing to propose` };
    if (s.read?.declined?.includes(transcriptMark(words)))
      return { outcome: "declined" as const, source: id, line: `${id}: the person declined this wording for its transcript before and kept theirs — not proposed again` };
    const lang = tree.lang;
    const by = o.by ?? tree.actor;
    const why = o.why?.normalize("NFC").trim() || undefined;
    const byWords = `${by}${why ? `: ${why}` : ""}`;
    const proposal = { source: id, text: words, by, at: now(), ...(why ? { why: truncate(why, 1000) } : {}), ...(o.reading ? { reading: o.reading } : {}), ...(o.unsure ? { unsure: true as const } : {}) };
    const waiting = openProposal(tree, id);
    if (waiting?.proposal && !transcriptDiffers(waiting.proposal.text, words))
      return { outcome: "same" as const, source: id, task: waiting.id, line: `${id}: this wording waits for the person's decision already (${waiting.id}) — nothing more to do` };
    // the source keeps every wording proposed for it, as a note (never its transcript)
    update<Source>(tree, id, "source", (x) => ({ ...x, notes: [...x.notes, ...makeNotes(tree, phrase(lang, "proposal.note", { by: byWords, text: words }))] }), {
      op: "source.proposal",
      summary: `${id}: a new wording of its transcript proposed to the person — the transcript, their own reading, unchanged`,
    });
    if (waiting) {
      const t = update<Task>(tree, waiting.id, "task", (x) => ({ ...x, proposal, notes: [...x.notes, ...makeNotes(tree, phrase(lang, "proposal.note.task", { by: byWords, text: words }))] }), {
        op: "task.proposal",
        summary: `${waiting.id}: another wording proposed for the transcript of ${id}`,
      });
      return { outcome: "appended" as const, source: id, task: t.id, line: proposedLine(s, t.id, true) };
    }
    const task = create<Task>(
      tree,
      "task",
      {
        level: "verify",
        priority: 3,
        what: truncate(phrase(lang, "proposal.what", { source: id, title: truncate(s.title, 80) }), 200),
        where: [id],
        why: truncate(phrase(lang, "proposal.why", { source: id, read: readPhrase(lang, u), by: byWords, text: words }), 1000),
        doneWhen: truncate(phrase(lang, "proposal.done", { source: id }), 500),
        subject: [id],
        state: "waiting",
        waitingOn: phrase(lang, "proposal.on", { source: id }),
        wait: { kind: "other" },
        proposal,
        origin: PROPOSAL_ORIGIN,
      } as never,
      (tid) => `+${tid} task: the person decides a new wording proposed for the transcript of ${id}`,
    );
    return { outcome: "proposed" as const, source: id, task: task.id, line: proposedLine(s, task.id, false) };
  });
}

function proposedLine(s: Source, task: string, again: boolean): string {
  return `${s.id}: its transcript is the person's own reading (${readingWords(s)}) — not changed; the new wording is proposed to them${again ? `, in ${task} which waited already` : ` as ${task}`} (their decision alone: strom's menu, What waits; the Strom app). Go on with other work; never ask them to change it for you.`;
}

/** The person's decision on a proposed transcript: the proposed wording taken, the transcript kept, or the decision undone. */
export type ProposalTake = "proposal" | "keep" | "undo";

/**
 * The person decides a proposal: `take` the proposed wording (written as theirs: their reading of it, `how` — typed by
 * hand at their terminal, confirmed in the Strom app), or `keep` the transcript (the wording declined: never proposed
 * again). The task done either way, the notes kept. `task`: the task the person saw (else the source's that waits);
 * `expect`: the mark of the wording they saw (another proposed since: refused, proposal.changed). Only as the person.
 */
export function decideProposal(tree: Tree, sourceId: string, take: ProposalTake, o: { how: UserReading["how"]; task?: string; expect?: string }): { source: Source; task: Task } {
  if (!tree.personWrites)
    throw new UsageError(`the wording of the transcript of ${sourceId} is the person's to decide — at their terminal (strom's menu, What waits) or in the Strom app, never an agent`, { code: "proposal.person", params: { source: sourceId } });
  return tree.withTreeLock(() => {
    if (actsAsArchive(tree)) throw new UsageError("an archive: no proposal is decided here", { code: "proposal.archive" });
    const s = tree.get<Source>(sourceId);
    if (!s || s.type !== "source") throw new UsageError(`no source ${sourceId} in the research`, { code: "proposal.none", params: { source: sourceId } });
    const named = o.task ? tree.get<Task>(o.task) : undefined;
    if (o.task && (!named || named.type !== "task" || named.proposal?.source !== s.id))
      throw new UsageError(`${o.task} proposes no wording for ${s.id}`, { code: "proposal.none", params: { source: s.id, task: o.task } });
    if (take === "undo") return undoProposal(tree, s, named);
    const t = named ?? openProposal(tree, s.id);
    if (!t?.proposal) throw new UsageError(`no proposed wording of ${s.id} waits for a decision`, { code: "proposal.none", params: { source: s.id } });
    if (t.state !== "waiting" && !(t.state === "parked" && t.heldBy === "archive"))
      throw new UsageError(`${t.id} is decided already (${t.result ?? t.state})`, { code: "proposal.decided", params: { source: s.id, task: t.id } });
    const mark = transcriptMark(t.proposal.text);
    if (o.expect && o.expect !== mark)
      throw new UsageError(`another wording was proposed for ${s.id} since — decide the one proposed now`, { code: "proposal.changed", params: { source: s.id, task: t.id, proposed: mark } });
    const at = now();
    const was: ProposalWas = {
      take,
      at,
      ...(s.transcript !== undefined ? { transcript: s.transcript } : {}),
      ...(s.read?.user ? { user: s.read.user } : {}),
      ...(s.read?.declined?.length ? { declined: s.read.declined } : {}),
      state: t.state,
      ...(t.waitingOn !== undefined ? { waitingOn: t.waitingOn } : {}),
      ...(t.wait !== undefined ? { wait: t.wait } : {}),
      ...(t.parkedReason !== undefined ? { parkedReason: t.parkedReason } : {}),
      ...(t.heldBy !== undefined ? { heldBy: t.heldBy } : {}),
      ...(t.heldFrom !== undefined ? { heldFrom: t.heldFrom } : {}),
    };
    const source = update<Source>(
      tree,
      s.id,
      "source",
      (x) => {
        if (take === "proposal") {
          const read: NonNullable<Source["read"]> = { ...x.read, user: { how: o.how, at, txt: mark } };
          const declined = read.declined?.filter((m) => m !== mark);
          if (declined?.length) read.declined = declined;
          else delete read.declined;
          return { ...x, transcript: t.proposal!.text, read };
        }
        return { ...x, read: { ...x.read, declined: [...new Set([...(x.read?.declined ?? []), mark])] } };
      },
      take === "proposal"
        ? { op: "source.proposal.take", summary: `${s.id}: the wording proposed in ${t.id} taken by the user as the transcript — their reading of it` }
        : { op: "source.proposal.keep", summary: `${s.id}: the transcript kept by the user — the wording proposed in ${t.id} declined` },
    );
    const task = update<Task>(
      tree,
      t.id,
      "task",
      (x) => {
        const next: Task = { ...x, state: "done", result: phrase(tree.lang, take === "proposal" ? "proposal.result.taken" : "proposal.result.kept", { source: s.id }), proposal: { ...x.proposal!, was } };
        delete next.waitingOn;
        delete next.wait;
        delete next.parkedReason;
        delete next.heldBy;
        delete next.heldFrom;
        return next;
      },
      { op: "task.done", summary: `${t.id} done: ${take === "proposal" ? "the proposed wording taken" : "the transcript kept"}` },
    );
    return { source, task };
  });
}

/**
 * The person's decision on a proposal undone (the Strom app's "Undo" after the wording was taken): the transcript and
 * their reading of it as they were before — their confirmation too — or, a kept transcript, the wording no longer
 * declined; the task waits for their decision again. `named`: the task decided (else the source's newest one decided).
 * Refused when nothing is to undo (proposal.undo: not decided, decided before strom kept what it replaced, or undone
 * already) or the transcript changed since, or another wording waits for the source (proposal.changed).
 */
function undoProposal(tree: Tree, s: Source, named: Task | undefined): { source: Source; task: Task } {
  const decided = (x: Task) => x.state === "done" && x.proposal?.source === s.id && !!x.proposal.was;
  const t =
    named ??
    tree
      .list<Task>("task")
      .filter(decided)
      .sort((a, b) => (b.proposal!.was!.at < a.proposal!.was!.at ? -1 : b.proposal!.was!.at > a.proposal!.was!.at ? 1 : 0))[0];
  if (!t || !decided(t)) {
    const id = t?.id ?? named?.id;
    throw new UsageError(`no decision on a proposed wording of ${s.id} to undo${id ? ` (${id}: ${t?.state === "waiting" ? "it waits for a decision" : "nothing kept of what it replaced"})` : ""}`, { code: "proposal.undo", params: { source: s.id, ...(id ? { task: id } : {}) } });
  }
  const p = t.proposal!;
  const was = p.was!;
  const mark = transcriptMark(p.text);
  const other = openProposal(tree, s.id);
  if (other && other.id !== t.id)
    throw new UsageError(`another wording was proposed for ${s.id} since (${other.id}) — decide that one`, { code: "proposal.changed", params: { source: s.id, task: other.id } });
  const changed = was.take === "proposal" ? transcriptDiffers(s.transcript?.trim(), p.text) || markOf(s) !== mark : !s.read?.declined?.includes(mark);
  if (changed)
    throw new UsageError(`the transcript of ${s.id} changed since ${t.id} was decided — nothing undone`, { code: "proposal.changed", params: { source: s.id, task: t.id } });
  const source = update<Source>(
    tree,
    s.id,
    "source",
    (x) => {
      const read: NonNullable<Source["read"]> = { ...x.read };
      if (was.take === "proposal") {
        if (was.user) read.user = was.user;
        else delete read.user;
      }
      const declined = was.take === "keep" ? (x.read?.declined ?? []).filter((m) => m !== mark) : was.declined;
      if (declined?.length) read.declined = declined;
      else delete read.declined;
      const next: Source = { ...x, read };
      if (!Object.keys(read).length) delete next.read;
      if (was.take === "proposal") {
        if (was.transcript !== undefined) next.transcript = was.transcript;
        else delete next.transcript;
      }
      return next;
    },
    was.take === "proposal"
      ? { op: "source.proposal.undo", summary: `${s.id}: the wording taken in ${t.id} undone by the user — their transcript and reading of it as before` }
      : { op: "source.proposal.undo", summary: `${s.id}: the wording declined in ${t.id} no longer declined — the user's decision undone` },
  );
  const task = update<Task>(
    tree,
    t.id,
    "task",
    (x) => {
      const next = { ...x, state: was.state === "parked" ? "parked" : "waiting", proposal: { ...x.proposal! } } as Task;
      delete next.proposal!.was;
      delete next.result;
      for (const k of ["waitingOn", "wait", "parkedReason", "heldBy", "heldFrom"] as const) if (was[k] !== undefined) (next as unknown as Record<string, unknown>)[k] = was[k];
      if (next.state === "waiting" && !next.waitingOn) next.waitingOn = phrase(tree.lang, "proposal.on", { source: s.id });
      if (next.state === "waiting" && !next.wait) next.wait = { kind: "other" };
      return next;
    },
    { op: "task.reopen", summary: `${t.id} waits for the user's decision again: their decision on the wording undone` },
  );
  return { source, task };
}

/** The proposal's wording as the Strom app gets it with its mark (a waiting item, the answer of POST /sources/proposal). */
export function proposalJson(tree: Tree, t: Task): Record<string, unknown> | undefined {
  const p = t.proposal;
  if (!p) return undefined;
  const s = tree.get<Source>(p.source);
  return { source: p.source, text: p.text, mark: transcriptMark(p.text), by: p.by, at: p.at, ...(p.why ? { why: p.why } : {}), ...(p.reading ? { reading: p.reading } : {}), current: s?.transcript ?? "", txt: s ? (markOf(s) ?? "") : "", choices: ["proposal", "keep"] };
}
