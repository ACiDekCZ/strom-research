// strom offline list · show · set · answer, strom task order — work off the lines (spec 038 K7): the branches no line
// reaches, how each is taken (the person's choice on three floors: the tree, the branch, the task), the line proposed
// for a branch that grows. core/offline.ts computes the branches; the choices are kept in quality/offline.json and on
// the task (Task.queueAt).

import { register } from "../cli/registry.ts";
import type { Context } from "../cli/context.ts";
import { lines, table } from "../cli/format.ts";
import { UsageError } from "../core/errors.ts";
import type { Person, Research, Session, Task } from "../core/model.ts";
import { displayName } from "../core/people.ts";
import type { Tree } from "../core/tree.ts";
import { update, requireRecord } from "../core/records.ts";
import { detectAgent } from "../core/which.ts";
import { refuseInArchive } from "../core/state.ts";
import { answerBranch, BRANCH_MODES, branchJson, branchKey, branchOf, offLineJson, offLineView, readOffline, setBranch, type BranchView } from "../core/offline.ts";
import { ownTurn, rankTasks } from "../core/queue.ts";
import { resolveResearch } from "./research.ts";
import { rankData } from "./tasks.ts";

const who = (tree: Tree, id: string) => {
  const p = tree.get<Person>(id);
  return p ? `${displayName(p)} [${id}]` : id;
};

const REL: Record<string, string> = { sibling: "sibling of", partner: "partner of", child: "child of", parent: "parent of", other: "related to" };

function branchLine(tree: Tree, b: BranchView): string[] {
  const how = b.mode === "line" ? `added to ${b.line}` : `${b.mode}${b.own ? " (its own choice)" : " (the tree's)"}`;
  return [b.id, who(tree, b.person), `${REL[b.via.rel] ?? "related to"} ${who(tree, b.via.person)}${b.nearest ? ` (${b.nearest})` : ""}`, `${b.tasks.length} tasks · ${b.persons.length} people`, `${how}${b.grows ? " · grows: a line proposed (What waits)" : ""}`];
}

/** The branch named, or a refusal that says how to find them. */
function requireBranch(ctx: Context, tree: Tree, ref: string): BranchView {
  const key = branchKey(ref);
  if (!key) throw new UsageError(`${ref} is no branch: B-<person ID>, e.g. B-P0006`, { hint: "strom offline list", code: "offline.none", params: { branch: ref } });
  const b = branchOf(tree, ctx.settings, key);
  if (!b) throw new UsageError(`no branch ${key} now: its person is in a line, or nothing off the lines hangs on them`, { hint: "strom offline list", code: "offline.none", params: { branch: key } });
  return b;
}

/** A line to add a branch to: one of the research, not taken back. */
function lineFor(tree: Tree, ref: string): Research {
  const r = resolveResearch(tree, ref);
  if (r.retracted) throw new UsageError(`${r.id} was taken back`, { hint: "strom research list", code: "directions.none", params: { research: r.id } });
  return r;
}

const refuse = (ctx: Context, tree: Tree, what: string) => refuseInArchive(tree, what, detectAgent(ctx.env) ?? ctx.settings.agent(tree.config).value);

register(
  {
    path: ["offline", "list"],
    summary: "The branches off the lines: whose, how they hang on a line, their tasks and people, how each is taken",
    group: "tasks",
    tree: true,
    description:
      "A research of several lines: a branch is the person off the lines nearest to one (an ancestor's sister), with\n" +
      "everyone reached only through them (her husband, her children). How its tasks come is the user's choice:\n" +
      "the tree's (queue.offLine occasional|last|normal|never), each branch's own (strom offline set), each task's\n" +
      "(strom task order). The partner of a person of a line is the line's work, no branch.",
    examples: ["strom offline list", "strom offline list --json"],
    run(ctx) {
      const tree = ctx.tree();
      const v = offLineView(tree, ctx.settings);
      if (!v) return { text: "one line or none: nothing is off the lines", data: { offLine: null } };
      const tree1 = `the tree: queue.offLine ${v.mode}${v.own ? "" : " (default)"} · one in ${v.share} sessions · lines proposed: ${v.suggest ? "yes" : "no"} · off the lines: ${v.tasks} open tasks, ${v.queued} in the queue · the person's own turn: ${v.ownTasks}`;
      return {
        text: lines(v.branches.length ? table(v.branches.map((b) => branchLine(tree, b))) : "no branch off the lines with a task or a choice", tree1, v.branches.length ? "one branch: strom offline show B-…" : undefined),
        data: { offLine: offLineJson(v, (t) => t.what) },
      };
    },
  },
  {
    path: ["offline", "show"],
    summary: "One branch off the lines: its people, all its tasks (also those not taken), its choice",
    group: "tasks",
    tree: true,
    args: [{ name: "branch", description: "B-<person ID>, e.g. B-P0006", required: true }],
    examples: ["strom offline show B-P0006"],
    run(ctx, { args }) {
      const tree = ctx.tree();
      const b = requireBranch(ctx, tree, args[0]!);
      const answer = readOffline(tree).answers[b.person];
      return {
        text: lines(
          table([branchLine(tree, b)]),
          `people: ${b.persons.map((p) => who(tree, p)).join(", ")}`,
          b.tasks.length ? table(b.tasks.map((t) => [t.id, t.state, t.queueAt ? `own: ${t.queueAt.do}` : "", t.what])) : "no open task",
          answer ? `answered ${answer.do} at ${answer.tasks} tasks, ${answer.persons} people (${answer.at.slice(0, 10)})` : undefined,
        ),
        data: {
          branch: { ...branchJson(b, (t) => t.what), people: b.persons },
          tasks: b.tasks.map((t) => ({ id: t.id, text: t.what, ...(t.subject[0]?.startsWith("P") ? { person: t.subject[0] } : {}), ...(t.queueAt ? { own: t.queueAt.do } : {}) })),
          ...(answer ? { answer } : {}),
        },
      };
    },
  },
  {
    path: ["offline", "set"],
    summary: "How one branch off the lines is taken: its own mode, added to a line, or back to the tree's",
    group: "tasks",
    tree: true,
    writes: true,
    description:
      "The user's choice: occasional, last, normal, never (its tasks wait out of the queue, nothing deleted, no new\n" +
      "task proposed there) — or --line G…: its tasks help that line and go with it. --default: as the tree says.\n" +
      "It holds for the branch's new tasks too.",
    args: [{ name: "branch", description: "B-<person ID>", required: true }],
    options: [
      { name: "mode", type: "string", value: "<mode>", description: "occasional, last, normal, never" },
      { name: "line", type: "string", value: "<G…>", description: "add the branch to this line" },
      { name: "default", type: "boolean", description: "back to the tree's choice (queue.offLine)" },
    ],
    examples: ["strom offline set B-P0006 --mode never", "strom offline set B-P0006 --line G0001", "strom offline set B-P0006 --default"],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      refuse(ctx, tree, "strom offline set");
      const given = [opts.mode !== undefined, opts.line !== undefined, !!opts.default].filter(Boolean).length;
      if (given !== 1) throw new UsageError("give exactly one of --mode <occasional|last|normal|never>, --line <G…> or --default", { code: "offline.body" });
      const key = branchKey(args[0]!);
      // back to the default also for a branch that is none now (its person joined a line): the choice kept goes
      if (opts.default && key && readOffline(tree).branches[key.slice(2)] && !branchOf(tree, ctx.settings, key)) {
        setBranch(tree, key.slice(2), { mode: "default" });
        return { text: `${key}: back to the tree's choice`, data: { branch: { id: key, person: key.slice(2), mode: ctx.settings.offLine(tree.config), own: false } } };
      }
      const b = requireBranch(ctx, tree, args[0]!);
      if (opts.default) setBranch(tree, b.person, { mode: "default" });
      else if (opts.line !== undefined) setBranch(tree, b.person, { mode: "line", line: lineFor(tree, String(opts.line)).id });
      else {
        const mode = String(opts.mode);
        if (!(BRANCH_MODES as readonly string[]).includes(mode) || mode === "line")
          throw new UsageError(`--mode is one of occasional, last, normal, never (to a line: --line G…)`, { code: "offline.body" });
        setBranch(tree, b.person, { mode: mode as "occasional" | "last" | "normal" | "never" });
      }
      const now = branchOf(tree, ctx.settings, b.id) ?? b;
      return { text: lines(...tree.written.map((o) => o.summary), table([branchLine(tree, now)])), data: { branch: branchJson(now, (t) => t.what) } };
    },
  },
  {
    path: ["offline", "answer"],
    summary: "Answer the line proposed for a branch that grows: add it to a line, leave it as it is, or not research it",
    group: "tasks",
    tree: true,
    writes: true,
    person: "The answer for a branch that grows is the user's own: the Strom app, or strom → What waits — never an agent",
    description:
      "The user's answer to What waits (a branch off the lines grew): line — its tasks help the nearest line (or\n" +
      "--line G…); keep — as it is (proposed again only at twice the size); never — not researched. A new line for\n" +
      "it: strom research new … --person <its person> --branch B-….",
    args: [
      { name: "branch", description: "B-<person ID>", required: true },
      { name: "answer", description: "line, keep or never", required: true },
    ],
    options: [{ name: "line", type: "string", value: "<G…>", description: "with line: this line instead of the nearest" }],
    examples: ["strom offline answer B-P0006 keep", "strom offline answer B-P0006 line --line G0002"],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      refuse(ctx, tree, "strom offline answer");
      const answer = args[1]!;
      if (!["line", "keep", "never"].includes(answer)) throw new UsageError(`the answer is line, keep or never`, { code: "offline.body" });
      const b = requireBranch(ctx, tree, args[0]!);
      const line = answer === "line" ? (opts.line !== undefined ? lineFor(tree, String(opts.line)).id : b.nearest) : undefined;
      if (answer === "line" && !line) throw new UsageError(`${b.id} is near no line: name one with --line G…`, { hint: "strom research list", code: "directions.none" });
      answerBranch(tree, b, answer as "line" | "keep" | "never", line);
      const now = branchOf(tree, ctx.settings, b.id) ?? b;
      return { text: lines(...tree.written.map((o) => o.summary), table([branchLine(tree, now)])), data: { branch: branchJson(now, (t) => t.what), answer } };
    },
  },
  {
    path: ["task", "order"],
    summary: "The user's turn for one task: next (once, before everything but the work at hand), last, or back to the queue's order",
    group: "tasks",
    tree: true,
    writes: true,
    description:
      "--next: the task comes next, before the lines, the places and history — once: when a session on it ends,\n" +
      "the choice goes by itself; several in the order given. --last: after everything else, until done or\n" +
      "--default. Also a task off the lines whose branch is not researched. (strom task next is another command:\n" +
      "what comes next.)",
    args: [{ name: "task", description: "task ID", required: true }],
    options: [
      { name: "next", type: "boolean", description: "next, once" },
      { name: "last", type: "boolean", description: "at the end" },
      { name: "default", type: "boolean", description: "back to the queue's own order" },
    ],
    examples: ["strom task order T0002 --next", "strom task order T0002 --default"],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      refuse(ctx, tree, "strom task order");
      const given = [!!opts.next, !!opts.last, !!opts.default].filter(Boolean).length;
      if (given !== 1) throw new UsageError("give exactly one of --next, --last or --default", { code: "queue.body" });
      const t = requireRecord<Task>(tree, args[0]!, "task");
      if (t.state === "doing") throw new UsageError(`${t.id} is in progress: its turn is now`, { code: "queue.doing", params: { task: t.id } });
      if (t.state !== "open") throw new UsageError(`${t.id} is ${t.state}: only an open task has a turn in the queue`, { hint: "strom task list", code: "queue.none", params: { task: t.id } });
      const want = opts.next ? "next" : opts.last ? "last" : undefined;
      const ended = tree.list<Session>("session").filter((s) => s.state !== "open" && s.task);
      // as it is already ("next" only while it holds: a session on the task since used it up)
      if (want ? t.queueAt?.do === want && ownTurn(t, ended) === want : !t.queueAt) return { text: `${t.id}: nothing to change`, data: taskTurn(ctx, tree, t.id) };
      update<Task>(
        tree,
        t.id,
        "task",
        (x) => {
          const { queueAt: _old, ...rest } = x;
          return want ? { ...rest, queueAt: { do: want, at: new Date().toISOString() } } : rest;
        },
        { op: "task.order", summary: `${t.id} ${want ? `${want} in the queue, the person's choice` : "back to the queue's order"}` },
      );
      return { text: lines(...tree.written.map((o) => o.summary)), data: taskTurn(ctx, tree, t.id) };
    },
  },
);

/** The task as the queue has it now (its why, its branch, the person's turn); not in the queue: the task alone. */
function taskTurn(ctx: Context, tree: Tree, id: string): { task: Task } & Record<string, unknown> {
  const t = tree.get<Task>(id)!;
  const ranked = rankTasks(tree, tree.list<Task>("task"), ctx.settings.strategy(tree.config));
  const at = ranked.findIndex((r) => r.task.id === id);
  const r = ranked[at];
  return { task: t, ...(r ? { why: r.why, ...rankData(r), place: at + 1 } : {}) };
}

