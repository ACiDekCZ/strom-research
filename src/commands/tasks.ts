// task add · next · list · show · edit · start · done · park · wake · wait · drop
//
// A task is a contract: WHAT to find, WHERE to look (record sets or a clear
// description), WHY it matters, and WHEN it is done. A task without "where"
// is a wish; strom refuses it.

import { opsLogs } from "../core/opslog.ts";
import fs from "node:fs";
import path from "node:path";
import { ui } from "../cli/ui.ts";
import { register } from "../cli/registry.ts";
import type { Context } from "../cli/context.ts";
import { lines, moreLine, paginate, runs, table, truncate } from "../cli/format.ts";
import { UsageError } from "../core/errors.ts";
import { TASK_LEVELS, type Input, type Lesson, type Note, type RecordSet, type Research, type Search, type Session, type Source, type Strategy, type Task } from "../core/model.ts";
import { create, csvOpt, listOpt, normId, requireRecord, update } from "../core/records.ts";
import { directionOf, ofResearch, scopes } from "../core/directions.ts";
import { resolvePerson } from "../core/people.ts";
import { foldText } from "../core/text.ts";
import { now, typeOfId, type Tree } from "../core/tree.ts";
import { resolveResearch } from "./research.ts";
import { makeNote, makeNotes, splitText } from "../core/actions.ts";
import { phrase } from "../core/phrases.ts";
import { readJsonLines } from "../core/json.ts";
import { lacksImages, rankTasks, type Ranked } from "../core/queue.ts";
import { joiningHypotheses, offTree } from "../core/kin.ts";
import { aboutPeople } from "../core/directions.ts";
import { storiesToApprove } from "../core/stories.ts";
import { receivedPending } from "../core/sync.ts";
import { clipNote, inboxFolderFor, parseImageList, transcriptNote } from "../core/media.ts";
import { isArchive } from "../core/mode.ts";
import { othersAtWork } from "../core/session.ts";
import { isAgent } from "../core/which.ts";


function written(tree: Tree): string {
  return lines(...tree.written.map((o) => o.summary));
}

/** Resolve subject references: IDs of any type, or person names. */
function subjects(tree: Tree, refs: string[]): string[] {
  return refs.map((r) => {
    const id = normId(r);
    if (typeOfId(id)) {
      const rec = tree.get(id);
      if (!rec) throw new UsageError(`no record ${id}`);
      if (rec.mergedInto) throw new UsageError(`${id} was merged into ${rec.mergedInto}`, { hint: `use ${rec.mergedInto}`, code: "record.merged", params: { id, into: rec.mergedInto } });
      return id;
    }
    return resolvePerson(tree, r).id;
  });
}

/**
 * The highest priority a task may get from an agent at work: the priority of the task its session works on — a
 * follow-up never goes before the work it came from (a chain of follow-ups one higher held a night's queue on one
 * family). A person at their own terminal sets any priority; a session without a task, or none, caps nothing.
 */
function priorityCap(ctx: Context, tree: Tree): { cap: number; from: string } | undefined {
  if (ctx.interactive && !isAgent(ctx.env)) return undefined;
  const session = typeOfId(tree.actor) === "session" ? tree.get<Session>(tree.actor) : undefined;
  const from = session?.task ? tree.get<Task>(session.task) : undefined;
  return from?.type === "task" ? { cap: from.priority, from: from.id } : undefined;
}

/** The priority asked, held at the cap (never below what the task has already); the line that says it was lowered. */
function cappedPriority(ctx: Context, tree: Tree, asked: number, id: string, has?: number): { priority: number; line?: string; lowered?: { asked: number; to: number; from: string } } {
  const limit = priorityCap(ctx, tree);
  if (!limit) return { priority: asked };
  const most = Math.max(limit.cap, has ?? 0);
  if (asked <= most) return { priority: asked };
  return {
    priority: most,
    line: `· priority ${asked} → ${most}: no higher than ${limit.from} (p${limit.cap}), the task of this session — a higher one is the user's: strom task edit ${id} --priority ${asked} in their own terminal`,
    lowered: { asked, to: most, from: limit.from },
  };
}

/** A new task's research: the one named, else the session's that adds it, else the one active research its people belong to. */
function defaultResearch(tree: Tree, ref: unknown, subject: string[] = []): string | undefined {
  if (typeof ref === "string") return resolveResearch(tree, ref).id;
  const session = typeOfId(tree.actor) === "session" ? tree.get<Session>(tree.actor) : undefined;
  if (session?.research) return session.research;
  const active = tree.list<Research>("research").filter((r) => r.state === "active");
  if (active.length === 1) return active[0]!.id;
  return directionOf(tree, { subject }, scopes(tree).filter((s) => s.research.state === "active"));
}

/** What the research waits for from outside — mostly from the user: scans to download, a book to find, a reply. */
export function waitingForUser(tree: Tree): { id: string; what: string; on: string }[] {
  return tree
    .list<Task>("task")
    .filter((t) => t.state === "waiting" && !isArchive(tree))
    .map((t) => ({ id: t.id, what: t.what, on: t.waitingOn ?? "" }));
}

/**
 * The lines that tell the user what the research waits for. Images they save by hand come with
 * the book's link and the folder they go into: facts, while the request itself is in their language.
 */
export function waitingLines(tree: Tree, where: { shared?: string; display?: (p: string) => string } = {}, max = 5): string | undefined {
  const w = isArchive(tree) ? [] : tree.list<Task>("task").filter((t) => t.state === "waiting");
  // the new versions of stories the user approved: they decide (the lock)
  const stories = storiesToApprove(tree).map((s) => s.id);
  const storyLine = stories.length ? `  ${ui(tree.lang, "ui.wait.stories", { ids: stories.join(" ") })}` : undefined;
  // trees the Strom app sent on its own: the user writes or throws them away (the menu), never the agent
  const sent = receivedPending(tree.root);
  const sentLine = sent.length ? `  ${ui(tree.lang, "ui.wait.sent", { n: sent.length, changes: sent.reduce((a, r) => a + r.changes, 0) })}` : undefined;
  if (!w.length) return stories.length || sent.length ? lines(ui(tree.lang, "ui.wait.title", { n: stories.length + sent.length }), sentLine, storyLine) : undefined;
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
    ui(lang, "ui.wait.title", { n: w.length + stories.length + sent.length }),
    sentLine,
    ...w.slice(0, max).flatMap((t) => [`  ${t.id}  ${truncate(t.waitingOn || t.what, 150)}`, ...images(t)]),
    w.length > max ? `  … strom task list --state waiting` : undefined,
    storyLine,
    `  ${ui(lang, "ui.wait.how1")}`,
    `  ${ui(lang, "ui.wait.how2")}`,
  );
}

/** The open tasks of the queue in the order to work on them (see core/queue.ts). */
export function taskQueue(tree: Tree, filter: { research?: string; level?: string; strategy?: Strategy; storyTurn?: boolean } = {}): Task[] {
  return rankedQueue(tree, filter).map((r) => r.task);
}

export function rankedQueue(tree: Tree, filter: { research?: string; level?: string; strategy?: Strategy; storyTurn?: boolean } = {}): Ranked[] {
  const scope = filter.research ? scopes(tree).find((s) => s.research.id === filter.research) : undefined;
  const tasks = tree
    .list<Task>("task")
    .filter((t) => !filter.research || (scope ? ofResearch(tree, t, scope) : t.research === filter.research))
    .filter((t) => !filter.level || t.level === filter.level);
  return rankTasks(tree, tasks, filter.strategy, { storyTurn: filter.storyTurn });
}

/**
 * What an agent is told of a task about people nothing links to the tree (core/kin.ts offTree): it waits out of the
 * queue until the user asks for it or the hypothesis that would join them is decided; the task that tests that
 * hypothesis names it. Undefined for a task of the tree.
 */
export function offTreeLine(tree: Tree, t: Task, starting = false): string | undefined {
  if (!offTree(tree)(t)) return undefined;
  const joins = joiningHypotheses(tree, aboutPeople(tree, t.subject));
  const first = joins.length
    ? `test first what would join them: ${joins.map((h) => `${h.id} "${truncate(h.question, 70)}"`).join("; ")} — a task that tests it names it (--about ${joins[0]!.id})`
    : "first a link to a person of the tree: a hypothesis (strom hypothesis add … --about P… of the tree) and a task that tests it, naming it (--about H…)";
  return starting
    ? `⚠ ${t.id} is about people nothing links to the tree yet: go on only if the user asked for this work. Else close the session (strom session close --continue …) and ${first}`
    : `· ${t.id} is about people nothing links to the tree yet: it waits out of the queue until the user asks for it or a hypothesis joins them — ${first}`;
}

function taskLine(t: Task): string[] {
  return [t.id, `p${t.priority}`, t.level, t.state === "open" ? "" : `[${t.state}]`, truncate(t.what, 70)];
}

/** Why a task was put aside: on the task, or — parked by an older strom — in the history. */
export function parkedWhy(tree: Tree, t: Task): string | undefined {
  if (t.state !== "parked") return undefined;
  if (t.parkedReason) return t.parkedReason;
  let last: { at: string; reason?: string } | undefined;
  try {
    for (const f of opsLogs(tree.dataDir))
      for (const o of readJsonLines<{ op: string; targets: string[]; at: string; reason?: string }>(f))
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
  const lessons = tree.list<Lesson>("lesson").filter((l) => !l.retracted && l.target && t.where.includes(l.target));
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

/**
 * A task's result as long as it is: over what a result holds (RESULT_MAX), its start is the result and the rest is kept
 * in the task's notes — said, never an error the agent answers by cutting the result short (K3).
 */
export function longResult(tree: Tree, text: string): { result: string; more: Note[] } {
  const t = text.trim();
  if (t.length <= RESULT_MAX) return { result: t, more: [] };
  const { head, rest } = splitText(t, RESULT_MAX - 2);
  tree.notices.push(`note: the result was ${t.length} characters (a result holds ${RESULT_MAX}): its start is the result, the rest went into the task's notes`);
  return { result: `${head} …`, more: makeNotes(tree, `… ${rest}`) };
}

/**
 * Close a task with its result (strom task done, strom session close --done): the inputs of an intake task processed,
 * and what the agent should hear of it (no search recorded, link tasks to point at the books found, entries unclipped).
 */
export function finishTask(tree: Tree, ref: string, text: string, produced: string[]): { task: Task; said: string[] } {
  const { result, more } = longResult(tree, text);
  const t = stateChange(tree, ref, "done", { result, produced: produced.map((x) => normId(x)) }, undefined, "done", more);
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
  return { task: t, said: [noSearch, handover, ...unclipped].filter((x): x is string => !!x) };
}

/** What a task's result holds (schema task.result). */
const RESULT_MAX = 1000;
/** What a task's what holds (schema task.what): one line. */
const WHAT_MAX = 200;

function stateChange(tree: Tree, ref: string, state: Task["state"], fields: Partial<Task>, reason: string | undefined, verb: string, notes: Note[] = []): Task {
  const id = normId(ref, "task");
  return update<Task>(tree, id, "task", (t) => {
    if (t.state === "done" && state !== "open") throw new UsageError(`${id} is already done`);
    const next: Task = { ...t, state, ...fields, ...(notes.length ? { notes: [...t.notes, ...notes] } : {}) };
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
      "narrate (write the story). Priority 1 (low) – 5 (urgent), default 3 — added in a session, at most the priority of\n" +
      "the session's task (a follow-up never goes before the work it came from).",
    args: [{ name: "what", description: 'what to find, one line: "Baptism of Jan Novák (~1905)"', required: true }],
    options: [
      { name: "level", type: "string", value: "<level>", description: TASK_LEVELS.join(", ") },
      { name: "where", type: "string", multiple: true, value: "<B…|text>", description: "record set ID or a precise description (repeatable)" },
      { name: "why", type: "string", value: "<text>", description: "why it matters for the research", max: 1000 },
      { name: "done-when", type: "string", value: "<text>", description: "what counts as done (found, or searched completely)", aliases: ["done"], max: 500 },
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
      const asked = opts.priority === undefined ? 3 : Number(opts.priority);
      if (!Number.isInteger(asked) || asked < 1 || asked > 5) throw new UsageError("--priority must be 1..5");
      const where = listOpt(opts.where).map((w) => (/^[Bb]\d+$/.test(w) ? requireRecord<RecordSet>(tree, w, "recordset").id : w));
      const subject = subjects(tree, listOpt(opts.about));
      const research = defaultResearch(tree, opts.research, subject);
      // a "what" longer than one line holds: its start is the what, the rest the task's first note (K3)
      let what = args[0]!.trim();
      let whatMore: string | undefined;
      if (what.length > WHAT_MAX) {
        const was = what.length;
        const { head, rest } = splitText(what, WHAT_MAX - 2);
        what = `${head} …`;
        whatMore = `… ${rest}`;
        tree.notices.push(`note: the what was ${was} characters (a task's what holds ${WHAT_MAX}): its start is the what, the rest went into the task's notes`);
      }
      // The same work again: an open task of the same person and level that reads the same (or nearly, in the same
      // books) — not added; what is new goes into that one.
      if (!opts.anyway) {
        const books = new Set(where.filter((w) => /^B\d+$/.test(w)));
        const same = tree
          .list<Task>("task")
          .filter((x) => OPEN_STATES.includes(x.state) && x.level === opts.level && x.research === research && x.subject.some((s) => subject.includes(s)))
          .map((x) => ({ x, alike: alikeness(x.what, what), books: x.where.some((w) => books.has(w)) }))
          .filter((m) => m.alike >= SAME_TEXT || (m.books && m.alike >= SAME_TEXT_IN_BOOK))
          .sort((a, b) => b.alike - a.alike)[0];
        if (same)
          throw new UsageError(`a task like this is open already: ${same.x.id} p${same.x.priority} ${same.x.level} "${truncate(same.x.what, 70)}"`, {
            hint: `add to it: strom task edit ${same.x.id} --priority … --where … --note "…" — or, if it is really other work: --anyway`,
            details: { task: same.x.id },
          });
      }
      const held = cappedPriority(ctx, tree, asked, "T…");
      const priority = held.priority;
      const t = create<Task>(
        tree,
        "task",
        {
          level: opts.level as Task["level"],
          priority,
          what,
          where,
          why: String(opts.why).trim(),
          doneWhen: String(opts["done-when"]).trim(),
          subject,
          research,
          state: "open",
          origin: tree.actor,
          note: [whatMore, typeof opts.note === "string" ? opts.note : undefined].filter(Boolean).join("\n") || undefined,
        },
        (id) => `+${id} task "${truncate(what, 60)}"`,
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
          held.line?.replace("T…", t.id),
          ...similar.map((x) => `⚠ similar ${x.state} task ${x.id} "${truncate(x.what, 60)}" — if it is the same, keep one: strom task drop ${t.id} --reason "duplicate of ${x.id}" and strom task edit ${x.id} --where … --note "…"`),
          offTreeLine(tree, t),
          noImages ? `· no images for it here yet — if the user has to download them, say which now: strom task wait ${t.id} --images B…:<numbers> --on "<the book, its link, which images>"` : undefined,
        ),
        data: { task: t, similar: similar.map((x) => x.id), needsImages: noImages, ...(held.lowered ? { priorityLowered: held.lowered } : {}) },
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
      // never a task another agent works on now (other conversations, runs in this tree)
      const held = othersAtWork(tree, ctx.env).tasks;
      const queue = rankedQueue(tree, { ...(research ? { research } : {}), ...(opts.level ? { level: String(opts.level) } : {}), strategy }).filter((r) => !held.has(r.task.id));
      const first = queue[0];
      if (!first) {
        const held = tree.list<Task>("task").filter(offTree(tree)).filter((t) => t.state === "open").length;
        const text = held
          ? `no open task of the tree — ${held} wait about people nothing links to it yet (strom task list --off-tree): test the hypothesis that would join them, or ask the user`
          : "no open tasks → strom research show <G…> to see what is missing, then strom task add";
        return { text, data: { task: null, offTree: held } };
      }
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
      { name: "off-tree", type: "boolean", description: "the open tasks that wait out of the queue: about people nothing links to the tree yet" },
      { name: "full", type: "boolean", description: "--json: whole records instead of one row each" },
    ],
    run(ctx, { opts }) {
      const tree = ctx.tree();
      const research = typeof opts.research === "string" ? resolveResearch(tree, opts.research).id : undefined;
      let all: Task[];
      const why = new Map<string, string>();
      const off = offTree(tree);
      if (opts["off-tree"]) all = tree.list<Task>("task").filter((t) => t.state === "open" && off(t) && (!opts.level || t.level === opts.level));
      else if (!opts.state) {
        const ranked = rankedQueue(tree, { ...(research ? { research } : {}), ...(opts.level ? { level: String(opts.level) } : {}), strategy: ctx.settings.strategy(tree.config) });
        for (const r of ranked) why.set(r.task.id, r.why);
        all = ranked.map((r) => r.task);
      } else {
        all = tree.list<Task>("task").filter((t) => opts.state === "all" || t.state === opts.state);
        const scope = research ? scopes(tree).find((s) => s.research.id === research) : undefined;
        if (scope) all = all.filter((t) => ofResearch(tree, t, scope));
        if (opts.level) all = all.filter((t) => t.level === opts.level);
      }
      if (opts.about) {
        const id = subjects(tree, [String(opts.about)])[0]!;
        all = all.filter((t) => t.subject.includes(id));
      }
      const page = paginate(all, ctx.limit, ctx.page);
      // the queue says what waits out of it for a link to the tree
      const held = !opts.state && !opts["off-tree"] && !opts.about ? tree.list<Task>("task").filter((t) => t.state === "open" && off(t)).length : 0;
      return {
        text: lines(
          all.length ? lines(table(page.items.map(taskLine)), moreLine(page, "strom task list")) : "no tasks",
          held ? `${held} more wait out of the queue: about people nothing links to the tree yet (strom task list --off-tree)` : undefined,
        ),
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
      { name: "done-when", type: "string", value: "<text>", description: "what counts as done", aliases: ["done"] },
      { name: "priority", type: "string", value: "1-5", description: "priority" },
      { name: "about", type: "string", multiple: true, value: "<who>", description: "person/record the task is about, also a conflict X… or hypothesis H… it decides (repeatable; replaces)" },
      { name: "note", type: "string", value: "<text>", description: "add a short note (what a later finding means for this task)" },
    ],
    examples: ["strom task edit T0001 --where B0001 --priority 4", 'strom task edit T0001 --note "the baptism of the son names the bride\'s father"'],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      const id = normId(args[0]!, "task");
      const change: Partial<Task> = {};
      let held: ReturnType<typeof cappedPriority> | undefined;
      if (typeof opts.what === "string" && opts.what.trim()) change.what = opts.what.trim();
      if (listOpt(opts.where).length) change.where = listOpt(opts.where).map((w) => (/^[Bb]\d+$/.test(w) ? requireRecord<RecordSet>(tree, w, "recordset").id : w));
      if (typeof opts.why === "string" && opts.why.trim()) change.why = opts.why.trim();
      if (typeof opts["done-when"] === "string" && opts["done-when"].trim()) change.doneWhen = opts["done-when"].trim();
      if (opts.priority !== undefined) {
        const priority = Number(opts.priority);
        if (!Number.isInteger(priority) || priority < 1 || priority > 5) throw new UsageError("--priority must be 1..5");
        held = cappedPriority(ctx, tree, priority, id, requireRecord<Task>(tree, id, "task").priority);
        change.priority = held.priority;
      }
      if (listOpt(opts.about).length) change.subject = subjects(tree, listOpt(opts.about));
      const note = typeof opts.note === "string" ? makeNotes(tree, opts.note) : undefined;
      const fields = [...Object.keys(change), ...(note ? ["note"] : [])];
      if (!fields.length) throw new UsageError("nothing to change", { hint: `e.g. strom task edit ${id} --where B0001` });
      const t = update<Task>(tree, id, "task", (t) => ({ ...t, ...change, ...(note ? { notes: [...t.notes, ...note] } : {}) }), {
        op: "task.edit",
        summary: `${id} ${fields.map((f) => (f === "doneWhen" ? "done-when" : f === "subject" ? "about" : f)).join(", ")}${change.where ? ` → ${truncate(change.where.join("; "), 50)}` : ""}`,
        reason: opts.reason as string | undefined,
      });
      return { text: lines(written(tree), held?.line, change.subject ? offTreeLine(tree, t) : undefined), data: { task: t, ...(held?.lowered ? { priorityLowered: held.lowered } : {}) } };
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
      const taken = othersAtWork(tree, ctx.env).sessions.find((x) => x.task === normId(args[0]!, "task"));
      if (taken)
        throw new UsageError(`${taken.task} is being worked on in session ${taken.id}${taken.agent ? ` (${taken.agent})` : ""}`, { hint: "take another task: strom task next", code: "task.held" });
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
      const { task, said } = finishTask(tree, args[0]!, String(opts.result), csvOpt(opts.produced));
      return { text: lines(written(tree), ...said), data: { task } };
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
        // only what was put aside comes back: a task at work stays its session's, a task done stays done
        if (before.state === "doing")
          throw new UsageError(`${id} is being worked on — it comes back to the queue when its session closes`, { hint: `strom session close --continue --summary "…" --next "…"`, code: "task.wake-doing" });
        if (before.state === "done") throw new UsageError(`${id} is done (${truncate(before.result ?? "", 80)}) — what is left is a new task`, { hint: `strom task add "…" --about …`, code: "task.wake-done" });
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
