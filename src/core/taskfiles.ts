// A file that came for what a task waited for (strom intake --answers, the Strom app's PUT /media/<sha256> with
// X-Strom-Task): the file is an input of the research like any material, the task gets it (Task.files: which input,
// who handed it over, what it asked) and goes back into the queue — no intake task of its own; the agent reads the file
// as the task's next step. Only that the file came is written, never words as the person's: an answer in words is the
// person's alone (strom task wake --answer). The caller holds the tree lock and commits.

import { UsageError } from "./errors.ts";
import type { Person, Task, TaskFile } from "./model.ts";
import { normId, requireRecord, update } from "./records.ts";
import { truncate } from "../cli/format.ts";
import type { Tree } from "./tree.ts";

/** Why a task takes no file now: it does not wait, or it waits for what only the person's word answers. */
export function fileRefused(task: Task | undefined, id: string): { code: string; message: string; hint: string } | undefined {
  if (!task || task.type !== "task" || task.retracted) return { code: "task.none", message: `no task ${id} in this research`, hint: "strom task list --state waiting" };
  if (task.state !== "waiting")
    return { code: "task.not-waiting", message: `${id} does not wait (it is ${task.state}) — a file for it is material: strom intake <file>`, hint: `strom task show ${id}` };
  if (task.awaitsCheck)
    return { code: "task.no-file", message: `${id} waits for the person's check of ${task.awaitsCheck.url} — only their answer brings it back`, hint: "the file as material: strom intake <file>" };
  if (task.awaitsPermission)
    return { code: "task.no-file", message: `${id} waits for the person's decision about an archive — only the decision brings it back`, hint: "the file as material: strom intake <file>" };
  return undefined;
}

/** The task a file is for, checked: it waits and takes a file (else an error that says why). */
export function taskForFile(tree: Tree, ref: string): Task {
  const id = normId(ref, "task");
  const why = fileRefused(tree.get<Task>(id), id);
  if (why) throw new UsageError(why.message, { hint: why.hint, code: why.code });
  return requireRecord<Task>(tree, id, "task");
}

/** The people a task is about (its subject's persons, through merges): the file is theirs. */
export function taskPeople(tree: Tree, task: Task): string[] {
  const out = new Set<string>();
  for (const s of task.subject) {
    if (!/^P\d+$/u.test(s)) continue;
    let p = tree.get<Person>(s);
    for (let hops = 0; p?.mergedInto && hops < 10; hops++) p = tree.get<Person>(p.mergedInto);
    if (p && p.type === "person" && !p.retracted) out.add(p.id);
  }
  return [...out];
}

/**
 * Hand files to a waiting task: kept on it (Task.files) with who handed them over and what it asked, named where it
 * looks (its where), and the task back in the queue — what it waited for, and that its request was sent, go with the
 * wait (as on any wake).
 */
export function handFiles(tree: Tree, ref: string, inputs: string[], by: string): Task {
  const before = taskForFile(tree, ref);
  const ids = [...new Set(inputs)];
  if (!ids.length) throw new UsageError("no file came for the task");
  const at = new Date().toISOString();
  const asked = truncate(before.waitingOn || before.what, 300);
  const files: TaskFile[] = ids.map((input) => ({ input, by, asked, at }));
  return update<Task>(
    tree,
    before.id,
    "task",
    (t) => {
      const { waitingOn: _o, awaits: _a, awaitsCheck: _c, awaitsPermission: _p, wait: _w, sent: _s, parkedUntil: _u, parkedReason: _r, ...rest } = t;
      return { ...rest, state: "open", where: [...new Set([...t.where, ...ids])], files: [...(t.files ?? []), ...files] };
    },
    { op: "task.file", summary: `${before.id} file ${ids.join(", ")} came (${by}) — back in the queue`, targets: ids },
  );
}

/** Who hands a file over: the Strom app (what the bridge writes for it), else the tree's actor (the user, an agent, a session). */
export function fileBy(tree: Tree, env: { STROM_FOR_APP?: string | undefined }): string {
  return env.STROM_FOR_APP === "1" ? "app" : tree.actor;
}
