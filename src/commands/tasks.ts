// task add · next · list · show · edit · start · done · park · wake · wait · drop
//
// A task is a contract: WHAT to find, WHERE to look (record sets or a clear
// description), WHY it matters, and WHEN it is done. A task without "where"
// is a wish; strom refuses it.

import fs from "node:fs";
import path from "node:path";
import { ui } from "../cli/ui.ts";
import { register } from "../cli/registry.ts";
import type { Context } from "../cli/context.ts";
import { lines, moreLine, paginate, runs, table, truncate } from "../cli/format.ts";
import { UsageError } from "../core/errors.ts";
import { TASK_LEVELS, type Input, type Lesson, type RecordSet, type Research, type Search, type Source, type Strategy, type Task } from "../core/model.ts";
import { create, csvOpt, listOpt, normId, requireRecord, update } from "../core/records.ts";
import { resolvePerson } from "../core/people.ts";
import { foldText } from "../core/text.ts";
import { now, typeOfId, type Tree } from "../core/tree.ts";
import { resolveResearch } from "./research.ts";
import { makeNote } from "../core/actions.ts";
import { phrase } from "../core/phrases.ts";
import { readJsonLines } from "../core/json.ts";
import { lacksImages, rankTasks, type Ranked } from "../core/queue.ts";
import { clipNote, inboxFolderFor, parseImageList, transcriptNote } from "../core/media.ts";


function written(tree: Tree): string {
  return lines(...tree.written.map((o) => o.summary), tree.dryRun ? "(dry run — nothing written)" : undefined);
}

/** Resolve subject references: IDs of any type, or person names. */
function subjects(tree: Tree, refs: string[]): string[] {
  return refs.map((r) => {
    const id = normId(r);
    if (typeOfId(id)) {
      if (!tree.get(id)) throw new UsageError(`no record ${id}`);
      return id;
    }
    return resolvePerson(tree, r).id;
  });
}

function defaultResearch(tree: Tree, ref: unknown): string | undefined {
  if (typeof ref === "string") return resolveResearch(tree, ref).id;
  const active = tree.list<Research>("research").filter((r) => r.state === "active");
  return active.length === 1 ? active[0]!.id : undefined;
}

/** What the research waits for from outside — mostly from the user: scans to download, a book to find, a reply. */
export function waitingForUser(tree: Tree): { id: string; what: string; on: string }[] {
  return tree
    .list<Task>("task")
    .filter((t) => t.state === "waiting")
    .map((t) => ({ id: t.id, what: t.what, on: t.waitingOn ?? "" }));
}

/**
 * The lines that tell the user what the research waits for. Images they save by hand come with
 * the book's link and the folder they go into: facts, while the request itself is in their language.
 */
export function waitingLines(tree: Tree, where: { shared?: string; display?: (p: string) => string } = {}, max = 5): string | undefined {
  const w = tree.list<Task>("task").filter((t) => t.state === "waiting");
  if (!w.length) return undefined;
  const show = where.display ?? ((p: string) => p);
  const lang = tree.lang;
  const images = (t: Task) => {
    if (!t.awaits) return [];
    const b = tree.get<RecordSet>(t.awaits.recordset);
    const dir = where.shared ? show(path.join(where.shared, "inbox", t.awaits.folder)) : `inbox/${t.awaits.folder}`;
    return [
      `         ${ui(lang, "ui.wait.images", { images: t.awaits.images, book: `${t.awaits.recordset}${b ? ` ${b.title}` : ""}` })}${b?.url ? ` · ${b.url}` : ""}`,
      `         ${ui(lang, "ui.wait.save", { dir: `${dir}${path.sep}` })}`,
    ];
  };
  return lines(
    ui(lang, "ui.wait.title", { n: w.length }),
    ...w.slice(0, max).flatMap((t) => [`  ${t.id}  ${truncate(t.waitingOn || t.what, 150)}`, ...images(t)]),
    w.length > max ? `  … strom task list --state waiting` : undefined,
    `  ${ui(lang, "ui.wait.how1")}`,
    `  ${ui(lang, "ui.wait.how2")}`,
  );
}

/** The open tasks of the queue in the order to work on them (see core/queue.ts). */
export function taskQueue(tree: Tree, filter: { research?: string; level?: string; strategy?: Strategy; storyTurn?: boolean } = {}): Task[] {
  return rankedQueue(tree, filter).map((r) => r.task);
}

export function rankedQueue(tree: Tree, filter: { research?: string; level?: string; strategy?: Strategy; storyTurn?: boolean } = {}): Ranked[] {
  const tasks = tree
    .list<Task>("task")
    .filter((t) => !filter.research || !t.research || t.research === filter.research)
    .filter((t) => !filter.level || t.level === filter.level);
  return rankTasks(tree, tasks, filter.strategy, { storyTurn: filter.storyTurn });
}

function taskLine(t: Task): string[] {
  return [t.id, `p${t.priority}`, t.level, t.state === "open" ? "" : `[${t.state}]`, truncate(t.what, 70)];
}

/** Why a task was put aside: on the task, or — parked by an older strom — in the history. */
export function parkedWhy(tree: Tree, t: Task): string | undefined {
  if (t.state !== "parked") return undefined;
  if (t.parkedReason) return t.parkedReason;
  const dir = path.join(tree.dataDir, "ops");
  let last: { at: string; reason?: string } | undefined;
  try {
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".jsonl")))
      for (const o of readJsonLines<{ op: string; targets: string[]; at: string; reason?: string }>(path.join(dir, f)))
        if (o.op === "task.park" && o.targets.includes(t.id) && (!last || o.at > last.at)) last = o;
  } catch {
    // no history to read
  }
  return last?.reason;
}

function taskDetail(tree: Tree, t: Task): string {
  const where = t.where.map((w) => {
    const b = /^B\d{4,}$/.test(w) ? tree.get<RecordSet>(w) : undefined;
    return b ? `${b.id} ${b.title}${b.url ? ` · ${b.url}` : ""}` : w;
  });
  const searches = tree.list<Search>("search").filter((s) => s.task === t.id || s.recordsets.some((b) => t.where.includes(b)));
  const lessons = tree.list<Lesson>("lesson").filter((l) => l.target && t.where.includes(l.target));
  return lines(
    `${t.id} ${t.what}`,
    `level ${t.level} · priority ${t.priority} · ${t.state}${t.research ? ` · research ${t.research}` : ""}${t.parkedUntil ? ` · parked until ${t.parkedUntil}` : ""}${t.waitingOn ? ` · waiting on ${t.waitingOn}` : ""}`,
    t.state === "parked" ? `parked ${parkedWhy(tree, t) ?? "(no reason recorded)"} — strom task wake ${t.id} to go on` : undefined,
    `where  ${where.join("\n       ")}`,
    `why    ${t.why}`,
    `done   ${t.doneWhen}`,
    t.subject.length ? `about  ${t.subject.join(" ")}` : undefined,
    t.result ? `result ${t.result}${t.produced?.length ? ` → ${t.produced.join(" ")}` : ""}` : undefined,
    searches.length ? "\nalready searched there\n" + table(searches.map((s) => [`  ${s.id}`, s.result, truncate(s.question, 60), s.scope.years ?? ""])) : undefined,
    lessons.length ? "\nlessons for these record sets\n" + lessons.map((l) => `  ${l.id} ${l.rule}`).join("\n") : undefined,
    ...t.notes.map((n) => `note   ${n.text}`),
  );
}

function stateChange(tree: Tree, ref: string, state: Task["state"], fields: Partial<Task>, reason: string | undefined, verb: string): Task {
  const id = normId(ref, "task");
  return update<Task>(tree, id, "task", (t) => {
    if (t.state === "done" && state !== "open") throw new UsageError(`${id} is already done`);
    const next: Task = { ...t, state, ...fields };
    if (state !== "parked") {
      delete next.parkedUntil;
      delete next.parkedReason;
    } else if (reason) next.parkedReason = reason;
    if (state !== "waiting") {
      delete next.waitingOn;
      delete next.awaits;
    } else if (!fields.awaits) delete next.awaits;
    return next;
  }, { op: `task.${verb}`, summary: `${id} ${verb}${fields.result ? `: ${truncate(fields.result, 60)}` : ""}`, reason });
}

/** Tasks still to be done — the ones a new task must not repeat. */
const OPEN_STATES: string[] = ["open", "doing", "waiting", "parked"];
/** How alike two tasks' texts must be to be the same work: anywhere, or in the same books. */
const SAME_TEXT = 0.75;
const SAME_TEXT_IN_BOOK = 0.6;

/** How alike two task texts are (0–1): the share of their words in common, any script, accents and punctuation aside. */
export function alikeness(a: string, b: string): number {
  const words = (t: string) => new Set(foldText(t).split(/[^\p{L}\p{M}\p{N}]+/u).filter(Boolean));
  const [x, y] = [words(a), words(b)];
  if (!x.size || !y.size) return 0;
  const common = [...x].filter((w) => y.has(w)).length;
  return common / (x.size + y.size - common);
}

register(
  {
    path: ["task", "add"],
    summary: "Add a task: what, where, why, done-when (all required)",
    group: "tasks",
    tree: true,
    writes: true,
    description:
      "Levels: intake (process an input), locate (find where records are), link (prove a parent/marriage),\n" +
      "verify (independent second reading), enrich (details of a placed person), request (ask an archive),\n" +
      "narrate (write the story). Priority 1 (low) – 5 (urgent), default 3.",
    args: [{ name: "what", description: 'what to find, one line: "Baptism of Jan Novák (~1905)"', required: true }],
    options: [
      { name: "level", type: "string", value: "<level>", description: TASK_LEVELS.join(", ") },
      { name: "where", type: "string", multiple: true, value: "<B…|text>", description: "record set ID or a precise description (repeatable)" },
      { name: "why", type: "string", value: "<text>", description: "why it matters for the research" },
      { name: "done-when", type: "string", value: "<text>", description: "what counts as done (found, or searched completely)" },
      { name: "priority", type: "string", value: "1-5", description: "default 3" },
      { name: "about", type: "string", multiple: true, value: "<who>", description: "person/record the task is about, also a conflict X… or hypothesis H… it decides (repeatable)" },
      { name: "research", type: "string", value: "<G…>", description: "research it belongs to (default: the only active one)" },
      { name: "note", type: "string", value: "<text>", description: "short note" },
      { name: "anyway", type: "boolean", description: "add it although an open task of the same person and level reads the same (it is really other work)" },
    ],
    examples: [
      'strom task add "Křest Jana Nováka (~1905)" --level link --where B0001 --why "potvrdí otce Josefa" --done-when "zápis nalezen, nebo ročníky 1903–1907 prohledány celé" --about P0001 --priority 4',
    ],
    run(ctx: Context, { args, opts }) {
      const tree = ctx.tree();
      const missing = [!opts.level && "--level", !listOpt(opts.where).length && "--where", !opts.why && "--why", !opts["done-when"] && "--done-when"].filter(Boolean);
      if (missing.length)
        throw new UsageError(`a task needs ${missing.join(", ")}`, { hint: "a task without where is a wish: name the record set (B…) or describe exactly where to look" });
      if (!TASK_LEVELS.includes(opts.level as (typeof TASK_LEVELS)[number])) throw new UsageError(`invalid --level "${opts.level}"`, { hint: TASK_LEVELS.join(", ") });
      const priority = opts.priority === undefined ? 3 : Number(opts.priority);
      if (!Number.isInteger(priority) || priority < 1 || priority > 5) throw new UsageError("--priority must be 1..5");
      const where = listOpt(opts.where).map((w) => (/^[Bb]\d+$/.test(w) ? requireRecord<RecordSet>(tree, w, "recordset").id : w));
      const subject = subjects(tree, listOpt(opts.about));
      const research = defaultResearch(tree, opts.research);
      // The same work again: an open task of the same person and level that reads the same (or nearly, in the same
      // books) — not added; what is new goes into that one.
      if (!opts.anyway) {
        const books = new Set(where.filter((w) => /^B\d+$/.test(w)));
        const same = tree
          .list<Task>("task")
          .filter((x) => OPEN_STATES.includes(x.state) && x.level === opts.level && x.research === research && x.subject.some((s) => subject.includes(s)))
          .map((x) => ({ x, alike: alikeness(x.what, args[0]!), books: x.where.some((w) => books.has(w)) }))
          .filter((m) => m.alike >= SAME_TEXT || (m.books && m.alike >= SAME_TEXT_IN_BOOK))
          .sort((a, b) => b.alike - a.alike)[0];
        if (same)
          throw new UsageError(`a task like this is open already: ${same.x.id} p${same.x.priority} ${same.x.level} "${truncate(same.x.what, 70)}"`, {
            hint: `add to it: strom task edit ${same.x.id} --priority … --where … --note "…" — or, if it is really other work: --anyway`,
            details: { task: same.x.id },
          });
      }
      const t = create<Task>(
        tree,
        "task",
        {
          level: opts.level as Task["level"],
          priority,
          what: args[0]!.trim(),
          where,
          why: String(opts.why).trim(),
          doneWhen: String(opts["done-when"]).trim(),
          subject,
          research,
          state: "open",
          origin: tree.actor,
          note: opts.note as string | undefined,
        },
        (id) => `+${id} task "${truncate(args[0]!, 60)}"`,
      );
      // the same person, the same kind of work, the same books: most likely the same task
      const books = new Set(where.filter((w) => /^B\d+$/.test(w)));
      const similar = tree
        .list<Task>("task")
        .filter((x) => x.id !== t.id && OPEN_STATES.includes(x.state) && x.level === t.level)
        .filter((x) => x.subject.some((s) => t.subject.includes(s)) && (books.size === 0 || x.where.some((w) => books.has(w))));
      // A link without images can only wait for the user: say now what to download, while
      // it is known — not in a session spent finding out that there is nothing to read.
      const noImages = lacksImages(tree, t);
      return {
        text: lines(
          written(tree),
          ...similar.map((x) => `⚠ similar ${x.state} task ${x.id} "${truncate(x.what, 60)}" — if it is the same, keep one: strom task drop ${t.id} --reason "duplicate of ${x.id}" and strom task edit ${x.id} --where … --note "…"`),
          noImages ? `· no images for it here yet — if the user has to download them, say which now: strom task wait ${t.id} --images B…:<numbers> --on "<the book, its link, which images>"` : undefined,
        ),
        data: { task: t, similar: similar.map((x) => x.id), needsImages: noImages },
      };
    },
  },
  {
    path: ["task", "next"],
    summary: "The task to work on now (never asks — the queue is ordered)",
    group: "tasks",
    tree: true,
    options: [
      { name: "research", type: "string", value: "<G…>", description: "only this research" },
      { name: "level", type: "string", value: "<level>", description: "only this level" },
    ],
    run(ctx, { opts }) {
      const tree = ctx.tree();
      const research = typeof opts.research === "string" ? resolveResearch(tree, opts.research).id : undefined;
      const strategy = ctx.settings.strategy(tree.config);
      const queue = rankedQueue(tree, { ...(research ? { research } : {}), ...(opts.level ? { level: String(opts.level) } : {}), strategy });
      const first = queue[0];
      if (!first) return { text: 'no open tasks → strom research show <G…> to see what is missing, then strom task add', data: { task: null } };
      const t = first.task;
      return {
        text: lines(taskDetail(tree, t), "", `first because: ${first.why} (queue: ${strategy})`, `start it: strom task start ${t.id}`),
        data: { task: t, why: first.why, strategy, queueLength: queue.length },
      };
    },
  },
  {
    path: ["task", "list"],
    summary: "The task queue in order (or all tasks with --state)",
    description:
      "The order (setting queue.strategy): balanced — work that can be done now before work waiting for a download,\n" +
      "the nearest ancestors first, a line that just had sessions waits for the others, a task tried again and again\n" +
      "sinks; depth — stay on the line of the last sessions; priority — strict priority. --json says why for each.",
    group: "tasks",
    tree: true,
    options: [
      { name: "state", type: "string", value: "<state>", description: "open (default queue), doing, done, parked, waiting, dropped, all" },
      { name: "research", type: "string", value: "<G…>", description: "only this research" },
      { name: "level", type: "string", value: "<level>", description: "only this level" },
      { name: "about", type: "string", value: "<who>", description: "only tasks about this person/record (also X…, H…)" },
      { name: "full", type: "boolean", description: "--json: whole records instead of one row each" },
    ],
    run(ctx, { opts }) {
      const tree = ctx.tree();
      const research = typeof opts.research === "string" ? resolveResearch(tree, opts.research).id : undefined;
      let all: Task[];
      const why = new Map<string, string>();
      if (!opts.state) {
        const ranked = rankedQueue(tree, { ...(research ? { research } : {}), ...(opts.level ? { level: String(opts.level) } : {}), strategy: ctx.settings.strategy(tree.config) });
        for (const r of ranked) why.set(r.task.id, r.why);
        all = ranked.map((r) => r.task);
      } else {
        all = tree.list<Task>("task").filter((t) => opts.state === "all" || t.state === opts.state);
        if (research) all = all.filter((t) => t.research === research);
        if (opts.level) all = all.filter((t) => t.level === opts.level);
      }
      if (opts.about) {
        const id = subjects(tree, [String(opts.about)])[0]!;
        all = all.filter((t) => t.subject.includes(id));
      }
      const page = paginate(all, ctx.limit, ctx.page);
      return {
        text: all.length ? lines(table(page.items.map(taskLine)), moreLine(page, "strom task list")) : "no tasks",
        data: { total: page.total, tasks: opts.full ? page.items : page.items.map((t) => ({ id: t.id, priority: t.priority, level: t.level, state: t.state, what: t.what, subject: t.subject, ...(why.has(t.id) ? { why: why.get(t.id) } : {}) })) },
      };
    },
  },
  {
    path: ["task", "show"],
    summary: "One task with what was already searched there and lessons for those record sets",
    group: "tasks",
    tree: true,
    args: [{ name: "task", description: "task ID (T0001)", required: true }],
    run(ctx, { args }) {
      const tree = ctx.tree();
      const t = requireRecord<Task>(tree, args[0]!, "task");
      return { text: taskDetail(tree, t), data: { task: t } };
    },
  },
  {
    path: ["task", "edit"],
    summary: "Change a task: point it at record sets, sharpen what/why/done-when, priority, who it is about",
    group: "tasks",
    tree: true,
    writes: true,
    description: "--where and --about replace the old values (repeat them for several). A task written before its books were\nknown is pointed at them here — that is how a locate task hands over to a link task.",
    args: [{ name: "task", description: "task ID", required: true }],
    options: [
      { name: "what", type: "string", value: "<text>", description: "what to find" },
      { name: "where", type: "string", multiple: true, value: "<B…|text>", description: "record set ID or a precise description (repeatable; replaces)" },
      { name: "why", type: "string", value: "<text>", description: "why it matters" },
      { name: "done-when", type: "string", value: "<text>", description: "what counts as done" },
      { name: "priority", type: "string", value: "1-5", description: "priority" },
      { name: "about", type: "string", multiple: true, value: "<who>", description: "person/record the task is about, also a conflict X… or hypothesis H… it decides (repeatable; replaces)" },
      { name: "note", type: "string", value: "<text>", description: "add a short note (what a later finding means for this task)" },
    ],
    examples: ["strom task edit T0001 --where B0001 --priority 4", 'strom task edit T0001 --note "the baptism of the son names the bride\'s father"'],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      const id = normId(args[0]!, "task");
      const change: Partial<Task> = {};
      if (typeof opts.what === "string" && opts.what.trim()) change.what = opts.what.trim();
      if (listOpt(opts.where).length) change.where = listOpt(opts.where).map((w) => (/^[Bb]\d+$/.test(w) ? requireRecord<RecordSet>(tree, w, "recordset").id : w));
      if (typeof opts.why === "string" && opts.why.trim()) change.why = opts.why.trim();
      if (typeof opts["done-when"] === "string" && opts["done-when"].trim()) change.doneWhen = opts["done-when"].trim();
      if (opts.priority !== undefined) {
        const priority = Number(opts.priority);
        if (!Number.isInteger(priority) || priority < 1 || priority > 5) throw new UsageError("--priority must be 1..5");
        change.priority = priority;
      }
      if (listOpt(opts.about).length) change.subject = subjects(tree, listOpt(opts.about));
      const note = typeof opts.note === "string" ? makeNote(tree, opts.note) : undefined;
      const fields = [...Object.keys(change), ...(note ? ["note"] : [])];
      if (!fields.length) throw new UsageError("nothing to change", { hint: `e.g. strom task edit ${id} --where B0001` });
      const t = update<Task>(tree, id, "task", (t) => ({ ...t, ...change, ...(note ? { notes: [...t.notes, note] } : {}) }), {
        op: "task.edit",
        summary: `${id} ${fields.map((f) => (f === "doneWhen" ? "done-when" : f === "subject" ? "about" : f)).join(", ")}${change.where ? ` → ${truncate(change.where.join("; "), 50)}` : ""}`,
        reason: opts.reason as string | undefined,
      });
      return { text: written(tree), data: { task: t } };
    },
  },
  {
    path: ["task", "start"],
    summary: "Mark a task as being worked on",
    group: "tasks",
    tree: true,
    writes: true,
    args: [{ name: "task", description: "task ID", required: true }],
    run(ctx, { args }) {
      const tree = ctx.tree();
      const t = stateChange(tree, args[0]!, "doing", {}, undefined, "start");
      return { text: lines(written(tree), `details: strom task show ${t.id}`), data: { task: t } };
    },
  },
  {
    path: ["task", "done"],
    summary: "Close a task with its result (also a negative one)",
    group: "tasks",
    tree: true,
    writes: true,
    args: [{ name: "task", description: "task ID", required: true }],
    options: [
      { name: "result", type: "string", value: "<text>", description: "what came out — 'not found in 1903–1907, searched completely' is a result" },
      { name: "produced", type: "string", multiple: true, value: "<ID>", description: "records created (sources, events, searches…)" },
    ],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      if (!opts.result) throw new UsageError("--result is required", { hint: "say what was found — or where it was searched without success" });
      const t = stateChange(tree, args[0]!, "done", { result: String(opts.result).trim(), produced: csvOpt(opts.produced).map((x) => normId(x)) }, undefined, "done");
      // A search that is not recorded will be done again: nudge when a search task records none.
      const noSearch =
        ["locate", "link", "verify", "enrich"].includes(t.level) && !tree.list<Search>("search").some((s) => s.task === t.id)
          ? `note: no search is recorded for ${t.id} — record what you looked at, found or not: strom search add "<what>" --task ${t.id} --method web|catalog|index|page-by-page --result found|negative`
          : undefined;
      // A locate task hands over: the link tasks that name no record set yet should now name one.
      const unpointed =
        t.level === "locate"
          ? tree.list<Task>("task").filter((x) => x.level === "link" && ["open", "doing", "parked"].includes(x.state) && !x.where.some((w) => /^B\d{4,}$/.test(w)))
          : [];
      const handover = unpointed.length
        ? `note: ${unpointed.map((x) => x.id).join(", ")} name no record set yet — point them at the books found: strom task edit ${unpointed[0]!.id} --where B…`
        : undefined;
      // Finishing an intake task finishes its input: nothing is left dangling as "new".
      if (t.level === "intake")
        for (const id of new Set([...t.subject, ...t.where]))
          if (typeOfId(id) === "input" && tree.get<Input>(id)?.state === "new")
            update<Input>(tree, id, "input", (i) => ({ ...i, state: "processed" }), { op: "input.done", summary: `${id} processed (${t.id} done)` });
      // The entries it recorded from scans: each with where it is on its image.
      const recorded = (t.produced ?? []).filter((id) => typeOfId(id) === "source").flatMap((id) => tree.get<Source>(id) ?? []);
      const unclipped = recorded.flatMap((s) => [clipNote(tree, s), transcriptNote(tree, s)].filter((n): n is string => !!n));
      return { text: lines(written(tree), noSearch, handover, ...unclipped), data: { task: t } };
    },
  },
  {
    path: ["task", "park"],
    summary: "Put a task aside (it stops being offered) — optionally until a date",
    group: "tasks",
    tree: true,
    writes: true,
    args: [{ name: "task", description: "task ID", required: true }],
    options: [{ name: "until", type: "string", value: "<YYYY-MM-DD>", description: "offer it again after this date" }],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      if (!opts.reason) throw new UsageError("--reason is required", { hint: 'e.g. --reason "waiting until the register is digitised"' });
      const until = opts.until ? String(opts.until) : undefined;
      if (until && !/^\d{4}-\d{2}-\d{2}$/.test(until)) throw new UsageError("--until must be YYYY-MM-DD");
      const t = stateChange(tree, args[0]!, "parked", until ? { parkedUntil: until } : {}, String(opts.reason), "park");
      return { text: written(tree), data: { task: t } };
    },
  },
  {
    path: ["task", "wake"],
    summary: "Bring a parked or waiting task back into the queue",
    group: "tasks",
    tree: true,
    writes: true,
    description: "--answer: what the user found or decided for a task that waited for them (a link, a book's number) — kept on\nthe task with what it asked, so the agent reads both in its brief.",
    args: [{ name: "task", description: "task ID", required: true }],
    options: [{ name: "answer", type: "string", value: "<text>", description: "the user's answer to what the task waited for" }],
    examples: ["strom task wake T0002", 'strom task wake T0003 --answer "https://archive.example.org/book/5359"'],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      const id = normId(args[0]!, "task");
      const answer = typeof opts.answer === "string" && opts.answer.trim() ? opts.answer.trim() : undefined;
      const t = tree.withTreeLock(() => {
        const before = requireRecord<Task>(tree, id, "task");
        // an answer is to what the task waits for: one that waits no more (done, dropped, taken up) is left as it is
        if (answer && before.state !== "waiting")
          throw new UsageError(`${id} does not wait for the user (it is ${before.state}) — the answer is not needed there`, { hint: `strom task show ${id}` });
        const note = answer ? makeNote(tree, phrase(tree.lang, "task.answer", { asked: truncate(before.waitingOn || before.what, 120), answer })) : undefined;
        return stateChange(tree, id, "open", note ? { notes: [...before.notes, note] } : {}, undefined, "wake");
      });
      return { text: written(tree), data: { task: t } };
    },
  },
  {
    path: ["task", "wait"],
    summary: "The task waits for something outside (an archive's reply, the user) — images the user saves by hand: --images",
    group: "tasks",
    tree: true,
    writes: true,
    description:
      "--on says what it waits for, to the user, in their language. When it is images the user downloads by hand\n" +
      "(no connector may fetch them), name them with --images B…:<numbers>: strom makes the folder of the shared\n" +
      "inbox they go into and shows it to the user, checks the numbers of what arrives, and the task comes back\n" +
      "by itself once they are registered.",
    args: [{ name: "task", description: "task ID", required: true }],
    options: [
      { name: "on", type: "string", value: "<text>", description: "what it waits for, for the user: which book, its link, which images" },
      { name: "images", type: "string", value: "<B…:n-m>", description: "the images the user saves by hand, numbered as the portal's viewer counts them (B0001:40-69, B0001:9,12)" },
    ],
    examples: [
      'strom task wait T0002 --on "reply of the archive to the request of 21 Sep"',
      'strom task wait T0002 --images B0001:40-45 --on "images 40–45 of the baptisms of Týnec 1784–1820 (https://archive.example.org/book/5359)"',
    ],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      if (!opts.on) throw new UsageError("--on is required", { hint: 'e.g. --on "reply of the archive to the request of 21 Sep"' });
      let awaits: Task["awaits"];
      let b: RecordSet | undefined;
      if (opts.images !== undefined) {
        const m = /^\s*([Bb]\d+)\s*:\s*(.+)$/.exec(String(opts.images));
        const nums = m ? parseImageList(m[2]!) : undefined;
        if (!m || !nums) throw new UsageError(`--images: a record set and its image numbers, e.g. B0001:40-45 or B0001:9,12 — not "${opts.images}"`);
        b = requireRecord<RecordSet>(tree, m[1]!, "recordset");
        awaits = { recordset: b.id, images: runs(nums), folder: inboxFolderFor(b) };
      }
      const id = normId(args[0]!, "task");
      const task = tree.get<Task>(id);
      const where = b && task && !task.where.includes(b.id) ? { where: [...task.where, b.id] } : {};
      const t = stateChange(tree, args[0]!, "waiting", { waitingOn: String(opts.on), ...(awaits ? { awaits } : {}), ...where }, undefined, "wait");
      if (!awaits) return { text: written(tree), data: { task: t } };
      // the folder is there before the user looks for it
      const s = ctx.settings.shared()?.value;
      const dir = s ? path.join(s, "inbox", awaits.folder) : undefined;
      if (dir && !tree.dryRun) fs.mkdirSync(dir, { recursive: true });
      return {
        text: lines(
          written(tree),
          `the user saves images ${awaits.images} of ${b!.id} into ${dir ? ctx.display(dir) : `the inbox folder "${awaits.folder}"`}, each named by its number (${parseImageList(awaits.images)![0]}.jpg)`,
          "they see it in strom's overview; once the images are registered (strom media add --inbox), the task comes back by itself",
        ),
        data: { task: t, folder: dir },
      };
    },
  },
  {
    path: ["task", "drop"],
    summary: "Give up a task (kept, with the reason)",
    group: "tasks",
    tree: true,
    writes: true,
    args: [{ name: "task", description: "task ID", required: true }],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      if (!opts.reason) throw new UsageError("--reason is required");
      const t = stateChange(tree, args[0]!, "dropped", {}, String(opts.reason), "drop");
      return { text: written(tree), data: { task: t } };
    },
  },
);
