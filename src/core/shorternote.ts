// A participant's note the Strom app sends that is only the beginning of the research's (core/sync.ts cutShort): a
// tree the app kept since its 3.28.0 sends a longer note cut short still, or the user cut it — strom cannot tell, so it
// never takes it (nothing guessed) and asks the person instead: one task waiting for them (origin sync:note-shorter,
// Task.shorterNote) — the shorter note taken, or the research's kept (strom sync note <T…> take|keep: the person's
// decision, at their terminal; an agent only carries out the person's answer to the task). One task per fact, who and
// pair of notes: a send of the same file again asks nothing more, nor does one after the person decided it.

import type { Family, Participant, Person, ShorterNote, Task } from "./model.ts";
import type { Tree } from "./tree.ts";
import { create, update } from "./records.ts";
import { phrase } from "./phrases.ts";
import { displayName } from "./people.ts";
import { UsageError } from "./errors.ts";
import { foldText } from "./text.ts";
import { noteLine } from "./sync.ts";
import { truncate } from "../cli/format.ts";

/** The origin of the person's task of a participant's note sent shorter than the research's. */
export const SHORTER_ORIGIN = "sync:note-shorter";

/** The person's decision: the shorter note taken, or the research's kept. */
export type ShorterTake = "take" | "keep";

const whoKey = (s: { person?: string; name?: string }) => s.person ?? foldText(noteLine(s.name ?? ""));
const sameAsk = (a: ShorterNote, b: ShorterNote) => a.event === b.event && a.role === b.role && whoKey(a) === whoKey(b) && a.sent === b.sent && a.whole === b.whole;

/** Whether the person was asked of this note already (a task of it, waiting or decided; one a sync's undo dropped: no). */
export function shorterAsked(tree: Tree, s: ShorterNote): boolean {
  return tree.list<Task>("task").some((t) => t.origin === SHORTER_ORIGIN && t.state !== "dropped" && !!t.shorterNote && sameAsk(t.shorterNote, s));
}

/** The research's participant the note is of: the role, who, the note as asked. */
function partAt(parts: readonly Participant[], s: ShorterNote): number {
  return parts.findIndex((x) => x.role === s.role && (s.person ? x.person === s.person : !x.person && whoKey(x) === whoKey(s)) && noteLine(x.note ?? "") === s.whole);
}

function ownerOfEvent(tree: Tree, event: string): Person | Family | undefined {
  return [...tree.list<Person>("person"), ...tree.list<Family>("family")].find((o) => !o.retracted && o.events.some((e) => e.id === event && !e.retracted));
}

const whoWords = (tree: Tree, s: ShorterNote) => (s.person ? `${tree.get<Person>(s.person) ? displayName(tree.get<Person>(s.person)!) : s.person}` : (s.name ?? "?"));

/**
 * The person asked whether the shorter note is taken (inside the tree's lock, a sync writing): a task waiting for
 * them, in the research's language — none when they were asked of it already. `input`: the sync's input (I…).
 */
export function askShorterNote(tree: Tree, s: ShorterNote, input: string): Task | undefined {
  if (shorterAsked(tree, s)) return undefined;
  const owner = ownerOfEvent(tree, s.event);
  if (!owner) return undefined;
  const lang = tree.lang;
  const quote = (t: string) => `„${truncate(t, 300)}“`;
  const name = owner.type === "person" ? displayName(owner as Person) : owner.id;
  const who = whoWords(tree, s);
  const id = tree.peekId("T");
  const said = { event: s.event, owner: name, who, task: id, input, sent: quote(s.sent), whole: quote(s.whole) };
  return create<Task>(
    tree,
    "task",
    {
      level: "verify",
      priority: 3,
      what: truncate(phrase(lang, "note.shorter.what", said), 200),
      where: [s.event],
      why: truncate(phrase(lang, "note.shorter.why", said), 1000),
      doneWhen: truncate(phrase(lang, "note.shorter.done", said), 500),
      subject: [owner.id, ...(s.person && s.person !== owner.id ? [s.person] : [])],
      state: "waiting",
      waitingOn: phrase(lang, "note.shorter.on", said),
      wait: { kind: "other" },
      shorterNote: s,
      origin: SHORTER_ORIGIN,
    } as never,
    (tid) => `+${tid} task: the person says whether the note of ${who} at ${s.event} the Strom app sent shorter than the research's is taken`,
  );
}

/**
 * The person's decision of a task of a note sent shorter (`take`: the shorter note written as the participant's;
 * `keep`: the research's note stays): the task done either way. Only the person — or an agent carrying out the person's
 * answer to the task (it holds one). The task and whether the note changed.
 */
export function decideShorterNote(tree: Tree, taskId: string, take: ShorterTake): { task: Task; changed: boolean } {
  return tree.withTreeLock(() => {
    const t = tree.get<Task>(taskId);
    if (!t || t.type !== "task" || !t.shorterNote) throw new UsageError(`${taskId} asks of no note sent shorter`, { code: "shorter.none", params: { task: taskId }, hint: "strom task list --state waiting" });
    if (t.state === "done" || t.state === "dropped") throw new UsageError(`${t.id} is decided already (${t.result ?? t.state})`, { code: "shorter.decided", params: { task: t.id } });
    if (!tree.personWrites && !t.answers?.length)
      throw new UsageError(`whether the shorter note is taken is the person's to decide (strom's menu, What waits; the Strom app) — carry out their answer once ${t.id} has one`, { code: "shorter.person", params: { task: t.id } });
    const s = t.shorterNote;
    let changed = false;
    if (take === "take") {
      const owner = ownerOfEvent(tree, s.event);
      const ev = owner?.events.find((e) => e.id === s.event);
      const parts = ev?.participants ?? [];
      const at = partAt(parts, s);
      if (!owner || !ev || at < 0)
        throw new UsageError(`the note of ${whoWords(tree, s)} at ${s.event} changed since ${t.id} asked — nothing taken (keep it: strom sync note ${t.id} keep)`, { code: "shorter.changed", params: { task: t.id, event: s.event } });
      update<Person | Family>(
        tree,
        owner.id,
        owner.type,
        (o) => ({ ...o, events: o.events.map((e) => (e.id === s.event ? { ...e, participants: parts.map((x, i) => (i === at ? { ...x, note: s.sent } : x)) } : e)) }),
        { op: "event.edit", summary: `${s.event} ${ev.kind} participants: the note of ${whoWords(tree, s)} as the Strom app sent it, shorter (the person's decision, ${t.id})`, reason: `the person took the shorter note (${t.id})` },
      );
      changed = true;
    }
    const task = update<Task>(
      tree,
      t.id,
      "task",
      (x) => {
        const next: Task = { ...x, state: "done", result: phrase(tree.lang, take === "take" ? "note.shorter.taken" : "note.shorter.kept", { event: s.event, who: whoWords(tree, s) }) };
        delete next.waitingOn;
        delete next.wait;
        return next;
      },
      { op: "task.done", summary: `${t.id} done: the ${take === "take" ? "shorter note taken" : "research's note kept"} (the person's decision)` },
    );
    return { task, changed };
  });
}
