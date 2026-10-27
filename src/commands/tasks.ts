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
import { LIST_PAGE_MAX, lines, moreLine, paginate, runs, table, truncate } from "../cli/format.ts";
import { UsageError } from "../core/errors.ts";
import { CHECK_ANSWERS, TASK_LEVELS, type CheckAnswer, type PersonAnswer, type Input, type Lesson, type Note, type RecordSet, type Research, type Search, type Session, type Source, type Strategy, type Task } from "../core/model.ts";
import { create, csvOpt, listOpt, normId, requireRecord, update } from "../core/records.ts";
import { directionOf, ofResearch, scopes } from "../core/directions.ts";
import { resolvePerson } from "../core/people.ts";
import { foldText } from "../core/text.ts";
import { now, typeOfId, type Tree } from "../core/tree.ts";
import { resolveResearch } from "./research.ts";
import { makeNote, makeNotes, splitText } from "../core/actions.ts";
import { phrase } from "../core/phrases.ts";
import { readJsonLines } from "../core/json.ts";
import { lacksImages, rankTasks, waitsForArchive, waitsForDecision, type Ranked } from "../core/queue.ts";
import { clockUp } from "../core/net.ts";
import type { Asleep } from "../core/leftalone.ts";
import { joiningHypotheses, offTree } from "../core/kin.ts";
import { aboutPeople } from "../core/directions.ts";
import { storiesToApprove } from "../core/stories.ts";
import { permissionsWaiting, permissionWaitingLines } from "../core/archiveasks.ts";
import { receivedPending } from "../core/sync.ts";
import { clipNote, inboxFolderFor, parseImageList, transcriptNote } from "../core/media.ts";
import { actsAsArchive } from "../core/state.ts";
import { conflictsToDecide } from "../core/conflicts.ts";
import { othersAtWork } from "../core/session.ts";
import { isAgent } from "../core/which.ts";
import { currentSession } from "../core/session.ts";
import { webDomain } from "../core/metrics.ts";
import { permissionWait } from "../core/archivewait.ts";
import type { Repository } from "../core/model.ts";
import { WAIT_KINDS } from "../core/model.ts";
import { SENDABLE, waitKindOf, waitState } from "../core/waitkind.ts";
import { requestNote } from "../core/waiting.ts";
import { addressesPerson } from "../core/impersonal.ts";


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
    .filter((t) => t.state === "waiting" && !actsAsArchive(tree))
    .map((t) => ({ id: t.id, what: t.what, on: t.waitingOn ?? "" }));
}

/**
 * The lines that tell the user what the research waits for. Images they save by hand come with
 * the book's link and the folder they go into: facts, while the request itself is in their language.
 */
export function waitingLines(tree: Tree, where: { shared?: string; display?: (p: string) => string } = {}, max = 5): string | undefined {
  const w = actsAsArchive(tree) ? [] : tree.list<Task>("task").filter((t) => t.state === "waiting");
  // the new versions of stories the user approved: they decide (the lock)
  const stories = storiesToApprove(tree).map((s) => s.id);
  const storyLine = stories.length ? `  ${ui(tree.lang, "ui.wait.stories", { ids: stories.join(" ") })}` : undefined;
  // trees the Strom app sent on its own: the user writes or throws them away (the menu), never the agent
  const sent = receivedPending(tree.root);
  const sentLine = sent.length ? `  ${ui(tree.lang, "ui.wait.sent", { n: sent.length, changes: sent.reduce((a, r) => a + r.changes, 0) })}` : undefined;
  // an archive's images wait for the person's decision (shared by every tree here): one line, only until it is answered
  const asked = permissionsWaiting(tree);
  const askedLine = asked.length ? lines(...permissionWaitingLines(tree, tree.lang).map((l) => `  ${l}`)) : undefined;
  // the open conflicts the person decides (an archive: every one — nobody else decides them): how many, how to go through them
  const conflicts = conflictsToDecide(tree).map((c) => c.id);
  const conflictLine = conflicts.length ? `  ${ui(tree.lang, "ui.wait.conflicts", { n: conflicts.length, ids: `${conflicts.slice(0, 5).join(" ")}${conflicts.length > 5 ? " …" : ""}` })}` : undefined;
  const others = stories.length + sent.length + asked.length + conflicts.length;
  if (!w.length) return others ? lines(ui(tree.lang, "ui.wait.title", { n: others }), sentLine, conflictLine, askedLine, storyLine) : undefined;
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
    ui(lang, "ui.wait.title", { n: w.length + others }),
    sentLine,
    conflictLine,
    askedLine,
    ...w.slice(0, max).flatMap((t) => [`  ${t.id}  ${truncate(t.waitingOn || t.what, 150)}`, ...images(t)]),
    w.length > max ? `  … strom task list --state waiting` : undefined,
    storyLine,
    `  ${ui(lang, "ui.wait.how1")}`,
    `  ${ui(lang, "ui.wait.how2")}`,
  );
}

/** The open tasks of the queue in the order to work on them (see core/queue.ts). */
export function taskQueue(tree: Tree, filter: { research?: string; level?: string; strategy?: Strategy; storyTurn?: boolean; awake?: boolean } = {}): Task[] {
  return rankedQueue(tree, filter).map((r) => r.task);
}

export function rankedQueue(tree: Tree, filter: { research?: string; level?: string; strategy?: Strategy; storyTurn?: boolean; awake?: boolean } = {}): Ranked[] {
  const scope = filter.research ? scopes(tree).find((s) => s.research.id === filter.research) : undefined;
  const tasks = tree
    .list<Task>("task")
    .filter((t) => !filter.research || (scope ? ofResearch(tree, t, scope) : t.research === filter.research))
    .filter((t) => !filter.level || t.level === filter.level);
  return rankTasks(tree, tasks, filter.strategy, { storyTurn: filter.storyTurn, awake: filter.awake });
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

/**
 * The open tasks out of the queue because their images wait for the person's decision about an archive (core/queue.ts
 * waitsForDecision): one line per archive, for the agent — why, since when, and the way on. Undefined: none.
 */
export function decisionLines(tree: Tree, filter: (t: Task) => boolean = () => true): string | undefined {
  const dec = waitsForDecision(tree);
  const by = new Map<string, { title: string; at: string; ids: string[] }>();
  for (const t of tree.list<Task>("task")) {
    if (t.state !== "open" || !filter(t)) continue;
    const q = dec(t);
    if (!q) continue;
    const e = by.get(q.host!) ?? { title: q.title ?? q.host!, at: q.at, ids: [] };
    e.ids.push(t.id);
    by.set(q.host!, e);
  }
  if (!by.size) return undefined;
  return lines(
    ...[...by].map(([host, e]) => `${e.ids.length} more wait out of the queue (${e.ids.join(", ")}): their images are at ${e.title} (${host}), whose question waits for the person since ${e.at.slice(0, 10)} — another source meanwhile, or strom task wait ${e.ids[0]} --images B…:<from-to> --on "…"; never strom fetch there again before the person decides`),
  );
}

/**
 * The open tasks out of the queue for a while because strom leaves their archive alone (core/queue.ts
 * waitsForArchive): one line per archive, for the agent — until when, and that they come back by themselves.
 */
export function asleepLines(tree: Tree, filter: (t: Task) => boolean = () => true): string | undefined {
  const held = waitsForArchive(tree);
  const by = new Map<string, { until: number; ids: string[] }>();
  for (const t of tree.list<Task>("task")) {
    if (t.state !== "open" || !filter(t)) continue;
    const a = held(t);
    if (!a) continue;
    const e = by.get(a.host) ?? { until: a.until, ids: [] };
    e.ids.push(t.id);
    by.set(a.host, e);
  }
  if (!by.size) return undefined;
  return lines(
    ...[...by].map(([host, e]) => `${e.ids.length} more wait out of the queue until ${clockUp(e.until)} (${e.ids.join(", ")}): their books are at ${host}, left alone after it went silent or asked to slow down — back in the queue by themselves then; no strom fetch there before`),
  );
}

/**
 * The queue empty now: the first time a task out of it only because its archive is left alone comes back (another
 * agent's tasks left out) — what strom run waits for. Undefined: none.
 */
export function nextAwake(tree: Tree, filter: { research?: string; strategy?: Strategy }, others: Set<string> = new Set()): Asleep | undefined {
  const held = waitsForArchive(tree);
  return taskQueue(tree, { ...filter, awake: true })
    .filter((t) => !others.has(t.id))
    .map(held)
    .filter((a): a is Asleep => !!a)
    .sort((a, b) => a.until - b.until)[0];
}

function taskLine(t: Task): string[] {
  const state = t.state === "waiting" ? `[waiting ${waitKindOf(t)}${t.sent ? " sent" : ""}]` : `[${t.state}]`;
  return [t.id, `p${t.priority}`, t.level, t.state === "open" ? "" : state, truncate(t.what, 70)];
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
  // the request's text: the file it was given, else the one its words name (a task that waited before it could say so)
  const request = t.state === "waiting" ? requestNote(tree, t) : undefined;
  const where = t.where.map((w) => {
    const b = /^B\d{4,}$/.test(w) ? tree.get<RecordSet>(w) : undefined;
    return b ? `${b.id} ${b.title}${b.url ? ` · ${b.url}` : ""}` : w;
  });
  const searches = tree.list<Search>("search").filter((s) => s.task === t.id || s.recordsets.some((b) => t.where.includes(b)));
  const lessons = tree.list<Lesson>("lesson").filter((l) => !l.retracted && l.target && t.where.includes(l.target));
  return lines(
    `${t.id} ${t.what}`,
    `level ${t.level} · priority ${t.priority} · ${t.state}${t.research ? ` · research ${t.research}` : ""}${t.parkedUntil ? ` · parked until ${t.parkedUntil}` : ""}${t.waitingOn ? ` · waiting on ${t.waitingOn}` : ""}`,
    // put aside by the archive: its own sentence in the research's language (back when research is switched on, no wake)
    t.state === "parked" ? (t.heldBy === "archive" && t.parkedReason ? t.parkedReason : `parked ${parkedWhy(tree, t) ?? "(no reason recorded)"} — strom task wake ${t.id} to go on`) : undefined,
    `where  ${where.join("\n       ")}`,
    `why    ${t.why}`,
    `done   ${t.doneWhen}`,
    t.subject.length ? `about  ${t.subject.join(" ")}` : undefined,
    t.result ? `result ${t.result}${t.produced?.length ? ` → ${t.produced.join(" ")}` : ""}` : undefined,
    searches.length ? "\nalready searched there\n" + table(searches.map((s) => [`  ${s.id}`, s.result, truncate(s.question, 60), s.scope.years ?? ""])) : undefined,
    lessons.length ? "\nlessons for these record sets\n" + lessons.map((l) => `  ${l.id} ${l.rule}`).join("\n") : undefined,
    ...t.notes.map((n) => `note   ${n.text}`),
    t.awaitsCheck ? `check  the person checks ${t.awaitsCheck.url}: ${t.awaitsCheck.ask}` : undefined,
    t.state === "waiting" ? `waits  ${waitSaid(tree, t)}` : undefined,
    t.state === "waiting" && t.wait?.to ? `to     ${t.wait.to}` : undefined,
    request ? `text   ${request}` : undefined,
    t.state === "waiting" && t.wait?.url ? `url    ${t.wait.url}` : undefined,
    // the person's own answers (only theirs: strom task wake --answer/--check), apart from the notes
    ...(t.answers ?? []).map((a) => `person ${a.at.slice(0, 10)} answered${a.check ? ` ${a.check}` : ""}${a.answer ? `: ${a.answer}` : ""} (asked: ${truncate(a.asked, 80)})`),
    // the files that came for what it waited for: only that they came (strom intake --answers, the Strom app)
    ...(t.files ?? []).map((f) => `file   ${f.at.slice(0, 10)} ${f.input} came (${f.by}; asked: ${truncate(f.asked, 80)})`),
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

/**
 * A task put aside or set waiting in a session whose fetch met an archive's question the person has not answered: it
 * says the archive's hosts, so the person's decision wakes it (core/archivewait.ts). Nothing when there was none.
 */
function decisionAwaited(ctx: Context, tree: Tree, ref: string): Pick<Task, "awaitsPermission"> {
  try {
    const t = tree.get<Task>(normId(ref, "task"));
    const s = currentSession(tree, ctx.env, ctx.refs);
    const w = t && s ? permissionWait(tree, t, s.id) : undefined;
    return w ? { awaitsPermission: w } : {};
  } catch {
    return {};
  }
}

function stateChange(tree: Tree, ref: string, state: Task["state"], fields: Partial<Task>, reason: string | undefined, verb: string, notes: Note[] = []): Task {
  const id = normId(ref, "task");
  return update<Task>(tree, id, "task", (t) => {
    if (t.state === "done" && state !== "open") throw new UsageError(`${id} is already done`);
    const next: Task = { ...t, state, ...fields, ...(notes.length ? { notes: [...t.notes, ...notes] } : {}) };
    if (state !== "parked") {
      delete next.parkedUntil;
      delete next.parkedReason;
    } else if (reason) next.parkedReason = reason;
    // the archive's decision it waited for goes with any change but the one that says it
    if (!fields.awaitsPermission) delete next.awaitsPermission;
    if (state !== "waiting") {
      delete next.waitingOn;
      delete next.awaits;
      delete next.awaitsCheck;
      delete next.wait;
      delete next.sent;
    } else {
      // set waiting (again): what it waits for now, nothing of an earlier wait — a request sent went with it
      if (!fields.awaits) delete next.awaits;
      if (!fields.awaitsCheck) delete next.awaitsCheck;
      if (!fields.wait) delete next.wait;
      if (!fields.sent) delete next.sent;
    }
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

/**
 * The site of a check by the person (strom task wait --check): an http(s) address, and only once another way was
 * tried and the blocked way recorded (D9) — a search of this session (else of the task) that names the site: its
 * host or domain in its question or notes, or a record set of it.
 */
function checkUrl(ctx: Context, tree: Tree, id: string, raw: string): string {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    throw new UsageError(`--check takes the address of the site to check — not "${raw}"`, { hint: `strom task wait ${id} --check https://archive.example.org/book/5359 --on "…"` });
  }
  if (!/^https?:$/.test(u.protocol)) throw new UsageError(`--check takes an http(s) address — not "${raw}"`);
  const host = u.hostname.toLowerCase();
  const site = webDomain(host);
  const session = currentSession(tree, ctx.env, ctx.refs);
  const of = (x: string | undefined) => {
    if (!x || !URL.canParse(x)) return false;
    return webDomain(new URL(x).hostname.toLowerCase()) === site;
  };
  const names = (q: Search) => {
    const text = foldText([q.question, q.scope.pages ?? "", ...q.notes.map((n) => n.text)].join(" "));
    if (text.includes(foldText(host)) || text.includes(foldText(site))) return true;
    return q.recordsets.some((r) => {
      const b = tree.get<RecordSet>(r);
      return of(b?.url) || of(b?.repository ? tree.get<Repository>(b.repository)?.url : undefined);
    });
  };
  const recorded = tree.list<Search>("search").some((q) => !q.retracted && (session ? q.created >= session.started : q.task === id) && names(q));
  if (!recorded)
    throw new UsageError(
      `--check asks the user to look at ${host} — only after another way: no search recorded for ${site}${session ? " in this session" : ` for ${id}`}. ` +
        `First another way to the same records (another archive or fonds of the jurisdiction, the parish, an index, secondary sources); then record the blocked way: ` +
        `strom search add "<what was looked for>" --method web --result inconclusive --task ${id} --note "${host} refused automated access (or its terms forbid it); tried instead: <the other way>"`,
      { hint: `then strom task wait ${id} --check ${u.href} --on "<what the user checks there — impersonal, in the research language>"`, code: "task.check-search" },
    );
  return u.href;
}

/** The options that say what a waiting task waits for (task wait, task edit). */
const WAIT_OPTIONS = [
  { name: "kind", type: "string", value: WAIT_KINDS.join("|"), description: "what it waits for: letter (a request by post or e-mail — a registry office, an archive), family (a question to the family), web (a site to look at), other" },
  { name: "to", type: "string", value: "<whom>", description: "whom it waits on, as the user names them: the registry office, the archive, the family (impersonal)", max: 300 },
  { name: "request", type: "string", value: "notes/<file>.md", description: "the request's text, saved in the tree's notes/ first (the letter, the question to the family)" },
  { name: "url", type: "string", value: "<URL>", description: "the site it is about (http or https)" },
] as const;

/**
 * A text the person reads (what a task waits for, whom): impersonal, never speaking as the agent — refused, with how to
 * write it, when it clearly addresses them (core/impersonal.ts).
 */
function impersonal(tree: Tree, flag: string, text: string): string {
  const word = addressesPerson(text, tree.lang);
  if (word)
    throw new UsageError(
      `${flag} speaks to the user ("${word}"): they read it in strom's menu and the Strom app, where nothing addresses them nor speaks as the agent — say what is needed and from whom, impersonal, in the research language`,
      { hint: `e.g. --on "reply of the registry office of <place> to the request of <date>", --on "images 40–45 of the baptisms to be saved from <link>"`, code: "task.addresses", params: { flag, word } },
    );
  return text.trim();
}

/** What --kind, --to, --request and --url say of a wait, checked; undefined: none given. */
function waitOptions(tree: Tree, id: string, opts: Record<string, unknown>, has: { images?: boolean; check?: boolean } = {}): NonNullable<Task["wait"]> | undefined {
  const wait: NonNullable<Task["wait"]> = {};
  if (opts.kind !== undefined) {
    const k = String(opts.kind).trim().toLowerCase();
    if (has.images || has.check)
      throw new UsageError(`--kind: --${has.images ? "images" : "check"} says the kind itself (${has.images ? "images the user saves by hand" : "a site only the user checks"})`, { hint: `leave out --kind` });
    if (!(WAIT_KINDS as readonly string[]).includes(k)) throw new UsageError(`--kind is one of ${WAIT_KINDS.join(", ")} — not "${opts.kind}"`, { hint: "images saved by hand: --images B…:<numbers>; a site only the user checks: --check <URL>" });
    wait.kind = k as NonNullable<Task["wait"]>["kind"];
  }
  if (typeof opts.to === "string" && opts.to.trim()) wait.to = impersonal(tree, "--to", opts.to).slice(0, 300);
  if (opts.request !== undefined) {
    const raw = String(opts.request).trim();
    const parts = raw.split(/[\\/]+/);
    // a path of the tree's notes/, as given (never normalized): no absolute path, no way out of notes/
    if (!raw || path.isAbsolute(raw) || /^[A-Za-z]:/.test(raw) || parts[0] !== "notes" || parts.length < 2 || parts.some((p) => p === ".." || p === "."))
      throw new UsageError(`--request takes a file of the tree's notes/, as notes/<file>.md — not "${raw}"`, { hint: `save the request's text first (notes/request-<what>.md), then strom task wait ${id} … --request notes/request-<what>.md` });
    let file = false;
    try {
      file = fs.statSync(path.join(tree.root, ...parts)).isFile();
    } catch {
      file = false;
    }
    if (!file) throw new UsageError(`--request: no file ${raw} in this tree`, { hint: `save the request's text there first, then name it again`, code: "task.request-missing" });
    wait.note = parts.join("/");
  }
  if (opts.url !== undefined) {
    if (has.check) throw new UsageError("--url with --check: --check carries the site's address itself", { hint: "leave out --url" });
    const raw = String(opts.url).trim();
    if (!URL.canParse(raw) || !/^https?:$/.test(new URL(raw).protocol)) throw new UsageError(`--url takes an http(s) address — not "${raw}"`);
    wait.url = new URL(raw).href;
  }
  return Object.keys(wait).length ? wait : undefined;
}

/** What a waiting task says of its wait, in a line: its kind, where it is dealt with, sent or not. */
function waitSaid(tree: Tree, t: Task): string | undefined {
  const w = waitState(tree, t);
  if (!w) return undefined;
  return `${w.waitKind} · ${w.group.name} (${w.group.key}) · ${w.phase === "sent" ? `sent ${w.sentAt!.slice(0, 10)}` : SENDABLE.includes(w.waitKind) ? "not sent yet" : "with the user"}`;
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
        // work whose archive is left alone for a while: it comes back by itself, nothing to add for it
        const later = asleepLines(tree);
        const text = held
          ? `no open task of the tree — ${held} wait about people nothing links to it yet (strom task list --off-tree): test the hypothesis that would join them, or ask the user`
          : later
            ? "no open task to work on now"
            : "no open tasks → strom research show <G…> to see what is missing, then strom task add";
        return { text: lines(text, decisionLines(tree), later), data: { task: null, offTree: held } };
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
      // a page at most LIST_PAGE_MAX rows, whatever --limit says: under ~20 kB
      const page = paginate(all, Math.min(ctx.limit, LIST_PAGE_MAX), ctx.page);
      // the queue says what waits out of it for a link to the tree
      const held = !opts.state && !opts["off-tree"] && !opts.about ? tree.list<Task>("task").filter((t) => t.state === "open" && off(t)).length : 0;
      return {
        text: lines(
          all.length ? lines(table(page.items.map(taskLine)), moreLine(page, "strom task list")) : ui(tree.lang, "ui.task.none"),
          held ? `${held} more wait out of the queue: about people nothing links to the tree yet (strom task list --off-tree)` : undefined,
          !opts.state && !opts["off-tree"] && !opts.about ? decisionLines(tree, (t) => (!opts.level || t.level === opts.level) && (!research || t.research === research)) : undefined,
          !opts.state && !opts["off-tree"] && !opts.about ? asleepLines(tree, (t) => (!opts.level || t.level === opts.level) && (!research || t.research === research)) : undefined,
        ),
        data: {
          total: page.total,
          tasks: page.items.map((t) => ({
            ...(opts.full ? t : { id: t.id, priority: t.priority, level: t.level, state: t.state, what: t.what, subject: t.subject, ...(t.wait ? { wait: t.wait } : {}) }),
            ...(why.has(t.id) ? { why: why.get(t.id) } : {}),
            ...waitState(tree, t),
          })),
        },
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
      const note = t.state === "waiting" ? requestNote(tree, t) : undefined;
      return { text: taskDetail(tree, t), data: { task: t, ...waitState(tree, t), ...(t.state === "waiting" && t.wait ? { wait: t.wait } : {}), ...(note ? { note } : {}) } };
    },
  },
  {
    path: ["task", "edit"],
    summary: "Change a task: point it at record sets, sharpen what/why/done-when, priority, who it is about",
    group: "tasks",
    tree: true,
    writes: true,
    description:
      "--where and --about replace the old values (repeat them for several). A task written before its books were\nknown is pointed at them here — that is how a locate task hands over to a link task.\n" +
      "A waiting task: --on, --kind, --to, --request, --url change what it waits for (as strom task wait says them) —\nhow a task set waiting before gets its kind and whom it waits on.",
    args: [{ name: "task", description: "task ID", required: true }],
    options: [
      { name: "what", type: "string", value: "<text>", description: "what to find" },
      { name: "where", type: "string", multiple: true, value: "<B…|text>", description: "record set ID or a precise description (repeatable; replaces)" },
      { name: "why", type: "string", value: "<text>", description: "why it matters" },
      { name: "done-when", type: "string", value: "<text>", description: "what counts as done", aliases: ["done"] },
      { name: "priority", type: "string", value: "1-5", description: "priority" },
      { name: "about", type: "string", multiple: true, value: "<who>", description: "person/record the task is about, also a conflict X… or hypothesis H… it decides (repeatable; replaces)" },
      { name: "note", type: "string", value: "<text>", description: "add a short note (what a later finding means for this task)" },
      { name: "on", type: "string", value: "<for the user: impersonal, research language>", description: "a waiting task: what it waits for, for the user" },
      ...WAIT_OPTIONS.map((o) => ({ ...o, description: `a waiting task: ${o.description}` })),
    ],
    examples: [
      "strom task edit T0001 --where B0001 --priority 4",
      'strom task edit T0001 --note "the baptism of the son names the bride\'s father"',
      'strom task edit T0003 --kind letter --to "the registry office of Lhota"',
    ],
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
      // what a waiting task waits for: only a waiting task's
      const waitAsked = ["on", "kind", "to", "request", "url"].filter((k) => opts[k] !== undefined);
      if (waitAsked.length) {
        const before = requireRecord<Task>(tree, id, "task");
        if (before.state !== "waiting")
          throw new UsageError(`${id} does not wait (it is ${before.state}) — --${waitAsked.join(", --")} say what a waiting task waits for`, {
            hint: `set it waiting: strom task wait ${id} --on "<what it waits for, impersonal>" --kind ${WAIT_KINDS.join("|")}`,
            code: "task.not-waiting",
          });
        if (typeof opts.on === "string" && opts.on.trim()) {
          change.waitingOn = impersonal(tree, "--on", opts.on);
          if (before.awaitsCheck) change.awaitsCheck = { ...before.awaitsCheck, ask: change.waitingOn };
        }
        const w = waitOptions(tree, id, opts, { images: !!before.awaits, check: !!before.awaitsCheck });
        if (w) change.wait = { ...before.wait, ...w };
      }
      const note = typeof opts.note === "string" ? makeNotes(tree, opts.note) : undefined;
      const fields = [...Object.keys(change), ...(note ? ["note"] : [])];
      if (!fields.length) throw new UsageError("nothing to change", { hint: `e.g. strom task edit ${id} --where B0001` });
      const t = update<Task>(tree, id, "task", (t) => ({ ...t, ...change, ...(note ? { notes: [...t.notes, ...note] } : {}) }), {
        op: "task.edit",
        summary: `${id} ${fields.map((f) => (f === "doneWhen" ? "done-when" : f === "subject" ? "about" : f === "waitingOn" ? "on" : f)).join(", ")}${change.where ? ` → ${truncate(change.where.join("; "), 50)}` : ""}`,
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
    examples: ['strom task park T0002 --reason "waiting until the register is digitised"', 'strom task park T0002 --until 2027-01-15 --reason "the archive reopens in January"'],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      if (!opts.reason) throw new UsageError("--reason is required", { hint: 'e.g. --reason "waiting until the register is digitised"' });
      const until = opts.until ? String(opts.until) : undefined;
      if (until && !/^\d{4}-\d{2}-\d{2}$/.test(until)) throw new UsageError("--until must be YYYY-MM-DD");
      const t = stateChange(tree, args[0]!, "parked", { ...(until ? { parkedUntil: until } : {}), ...decisionAwaited(ctx, tree, args[0]!) }, String(opts.reason), "park");
      return { text: written(tree), data: { task: t } };
    },
  },
  {
    path: ["task", "wake"],
    summary: "Bring a parked or waiting task back into the queue",
    group: "tasks",
    tree: true,
    writes: true,
    description:
      "--answer: what the user found or decided for a task that waited for them (a link, a book's number), --check: the\n" +
      "user's answer to a check of a site (strom task wait --check) — works (the book and its images are there), view\n" +
      "(only to be viewed there), no (nothing there). Both are the user's alone: in their own terminal or strom's menu;\n" +
      "from an agent's session a window of the system shows the answer to the person to confirm (none: exit 4). Kept on\n" +
      "the task apart from its notes, with what it asked, so the agent reads it in its brief as the person's answer. A\n" +
      "task that waits for the user's check of a site comes back only with their answer.",
    args: [{ name: "task", description: "task ID", required: true }],
    options: [
      { name: "answer", type: "string", value: "<text>", description: "the user's answer to what the task waited for (the user's alone)" },
      { name: "check", type: "string", value: "works|view|no", description: "the user's answer to a check of a site: works, view (only to be viewed there), no (the user's alone)" },
    ],
    examples: ["strom task wake T0002", 'strom task wake T0003 --answer "https://archive.example.org/book/5359"', 'strom task wake T0004 --check view --answer "the book is there, its images only in the viewer"'],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      const id = normId(args[0]!, "task");
      const answer = typeof opts.answer === "string" && opts.answer.trim() ? opts.answer.trim() : undefined;
      let check: CheckAnswer | undefined;
      if (opts.check !== undefined) {
        const c = String(opts.check).trim().toLowerCase();
        if (!(CHECK_ANSWERS as readonly string[]).includes(c)) throw new UsageError(`--check is one of ${CHECK_ANSWERS.join(", ")} — not "${opts.check}"`);
        check = c as CheckAnswer;
      }
      const seen = requireRecord<Task>(tree, id, "task");
      if (check && !seen.awaitsCheck) throw new UsageError(`${id} waits for no check of a site — --check answers strom task wait --check`, { hint: answer ? `strom task wake ${id} --answer "…"` : `strom task show ${id}` });
      // a check of a site comes back with the person's answer only — never woken round it by an agent
      if (seen.state === "waiting" && seen.awaitsCheck && !check && (isAgent(ctx.env) || !ctx.interactive))
        throw new UsageError(`${id} waits for the person's check of ${seen.awaitsCheck.url} — only the person answers it (strom's menu, What waits; or strom task wake ${id} --check works|view|no in their own terminal)`, {
          hint: "go on with other work; the task comes back with their answer",
          code: "task.check-person",
        });
      // the person's answer is theirs alone: their terminal, else a window that shows it to them (none: exit 4)
      let via: PersonAnswer["via"];
      if (answer || check) {
        if (seen.state !== "waiting")
          throw new UsageError(`${id} does not wait for the user (it is ${seen.state}) — the answer is not needed there`, { hint: `strom task show ${id}` });
        const lang = ctx.uiLang();
        const words = [check ? ui(lang, `ui.waiting.check.${check}`) : "", answer ?? ""].filter(Boolean).join(" – ");
        via = ctx.requireHuman(
          `Write the user's answer to ${id}: ${check ? `${check}${answer ? " — " : ""}` : ""}${answer ? `"${truncate(answer, 120)}"` : ""}?`,
          `strom task wake ${id}${check ? ` --check ${check}` : ""}${answer ? ` --answer "…"` : ""}`,
          `task.answer:${id}`,
          ui(lang, "ui.task.answer.window", { task: id, answer: truncate(words, 300) }),
        );
      }
      const t = tree.withTreeLock(() => {
        const before = requireRecord<Task>(tree, id, "task");
        // only what was put aside comes back: a task at work stays its session's, a task done stays done
        if (before.state === "doing")
          throw new UsageError(`${id} is being worked on — it comes back to the queue when its session closes`, { hint: `strom session close --continue --summary "…" --next "…"`, code: "task.wake-doing" });
        if (before.state === "done") throw new UsageError(`${id} is done (${truncate(before.result ?? "", 80)}) — what is left is a new task`, { hint: `strom task add "…" --about …`, code: "task.wake-done" });
        // an answer is to what the task waits for: one that waits no more (done, dropped, taken up) is left as it is
        if ((answer || check) && before.state !== "waiting")
          throw new UsageError(`${id} does not wait for the user (it is ${before.state}) — the answer is not needed there`, { hint: `strom task show ${id}` });
        const said: PersonAnswer | undefined =
          answer || check
            ? {
                by: "person",
                asked: truncate(before.awaitsCheck?.ask || before.waitingOn || before.what, 300),
                ...(before.awaitsCheck ? { url: before.awaitsCheck.url } : {}),
                ...(check ? { check } : {}),
                ...(answer ? { answer: truncate(answer, 500) } : {}),
                at: now(),
                ...(via ? { via } : {}),
              }
            : undefined;
        return stateChange(tree, id, "open", said ? { answers: [...(before.answers ?? []), said] } : {}, undefined, "wake");
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
      "--on says what it waits for, to the user: they read it in strom's menu and the Strom app — impersonal (what\n" +
      "is needed, never addressed to them: \"Images 40–45 of the baptisms to be saved from <link>\", not \"Open … and\n" +
      "save …\"), in the research language. When it is images the user downloads by hand\n" +
      "(no connector may fetch them), name them with --images B…:<numbers>: strom makes the folder of the shared\n" +
      "inbox they go into and shows it to the user, checks the numbers of what arrives, and the task comes back\n" +
      "by itself once they are registered.\n" +
      "--check <URL>: the user looks at a site strom and your web tools may not read (it refused strom, or its terms\n" +
      "forbid or restrict automation) — only after another way to the same records was tried and the blocked way recorded\n" +
      "in this session (strom search add … --note \"<host>: …\"); --on says what to check there. They answer in strom's\n" +
      "menu: works (the book and its images are there), view (only to be viewed there), no — the task comes back with it.\n" +
      "Anything else: --kind says what it waits for — letter (a request by post or e-mail to a registry office or an\n" +
      "archive), family (a question to the family), web (a site the user looks at), other; --to whom (as the user names\n" +
      "them), --request the request's text saved in the tree's notes/ first, --url the site. The menu groups what waits by\n" +
      "them. Once the user says the request went out: strom task sent <task> (the task still waits for the reply).\n" +
      "Set waiting again, it waits for that alone: what was said of an earlier wait, and that it was sent, go.",
    args: [{ name: "task", description: "task ID", required: true }],
    options: [
      // the sheet of a brief shows the placeholder: how to write it, where the agent writes it (a live run: "Otevřete …")
      { name: "on", type: "string", value: "<for the user: impersonal, research language>", description: "what it waits for, for the user: which book, its link, which images" },
      { name: "images", type: "string", value: "<B…:n-m>", description: "the images the user saves by hand, numbered as the portal's viewer counts them (B0001:40-69, B0001:9,12)" },
      { name: "check", type: "string", value: "<URL>", description: "a site for the user to check (one strom may not read): only after another way was tried and the blocked way recorded (strom search add)" },
      ...WAIT_OPTIONS,
    ],
    examples: [
      'strom task wait T0002 --on "reply of the archive to the request of 21 Sep"',
      'strom task wait T0002 --on "reply of the registry office of Lhota to the request of 21 Sep" --kind letter --to "the registry office of Lhota" --request notes/request-lhota.md',
      'strom task wait T0002 --images B0001:40-45 --on "images 40–45 of the baptisms of Týnec 1784–1820 (https://archive.example.org/book/5359)"',
      'strom task wait T0002 --check https://archive.example.org/book/5359 --on "whether the baptisms of 1784–1820 are there, with their images"',
    ],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      if (!opts.on) throw new UsageError("--on is required", { hint: 'e.g. --on "reply of the archive to the request of 21 Sep"' });
      const on = impersonal(tree, "--on", String(opts.on));
      const wait = waitOptions(tree, normId(args[0]!, "task"), opts, { images: opts.images !== undefined, check: opts.check !== undefined });
      let awaits: Task["awaits"];
      let awaitsCheck: Task["awaitsCheck"];
      let b: RecordSet | undefined;
      if (opts.check !== undefined && opts.images !== undefined) throw new UsageError("--check or --images, not both: the check first; the images by hand after the user's answer");
      if (opts.check !== undefined) awaitsCheck = { url: checkUrl(ctx, tree, normId(args[0]!, "task"), String(opts.check)), ask: on };
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
      const t = stateChange(tree, args[0]!, "waiting", { waitingOn: on, ...(wait ? { wait } : {}), ...(awaits ? { awaits } : {}), ...(awaitsCheck ? { awaitsCheck } : {}), ...(awaitsCheck ? {} : decisionAwaited(ctx, tree, args[0]!)), ...where }, undefined, "wait");
      if (awaitsCheck) return { text: lines(written(tree), `the user checks ${awaitsCheck.url} (strom's menu, What waits; the Strom app): the task comes back with their answer — meanwhile other work`), data: { task: t } };
      if (!awaits) {
        const sendable = SENDABLE.includes(waitKindOf(t));
        return {
          text: lines(written(tree), `waits  ${waitSaid(tree, t)}`, sendable ? `once the user says the request went out: strom task sent ${t.id} — the task still waits for the reply` : undefined),
          data: { task: t, ...waitState(tree, t) },
        };
      }
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
    path: ["task", "sent"],
    summary: "The request a waiting task waits on went out (a letter mailed, the family asked) — the task still waits",
    group: "tasks",
    tree: true,
    writes: true,
    description:
      "Only when the user said it was sent: the menu then shows the task as sent, waiting for the reply, apart from what\n" +
      "is still to be sent. Not an answer and not a wake — the task waits until the reply comes (strom task wake).\n" +
      "For a task that waits for a letter, the family or other (strom task wait --kind); --undo takes it back. Several\n" +
      "tasks (one e-mail for a place): each checked first, all written at once.",
    args: [{ name: "tasks", description: "task IDs", variadic: true }],
    options: [{ name: "undo", type: "boolean", description: "it was not sent after all" }],
    examples: ["strom task sent T0003", "strom task sent T0003 --undo"],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      if (!args.length) throw new UsageError("give the task (T…)", { hint: "strom task list --state waiting" });
      const ids = [...new Set(args.map((a) => normId(a, "task")))];
      const undo = !!opts.undo;
      const r = tree.withTreeLock((): { task: Task; same: boolean }[] => {
        const all = ids.map((id) => {
          const before = requireRecord<Task>(tree, id, "task");
          if (before.state !== "waiting")
            throw new UsageError(`${id} does not wait (it is ${before.state}) — strom task sent is for a request a waiting task waits on`, {
              hint: `first strom task wait ${id} --on "<what it waits for>" --kind letter|family|other`,
              code: "task.not-waiting",
              params: { task: id },
            });
          const kind = waitKindOf(before);
          if (!SENDABLE.includes(kind))
            throw new UsageError(`${id} waits for ${kind === "images" ? "images the user saves by hand" : kind === "check" ? "the user's check of a site" : kind === "permission" ? "the user's decision about an archive" : "a site the user looks at"} (kind ${kind}) — nothing is sent there`, {
              hint: `a request by post, e-mail or to the family: strom task edit ${id} --kind letter|family|other`,
              code: "task.not-sendable",
              params: { kind, task: id },
            });
          return before;
        });
        return all.map((before) => {
          // said again: nothing to change, said so (no error: the same word twice)
          if (undo ? !before.sent : before.sent) return { task: before, same: true };
          const after = update<Task>(
            tree,
            before.id,
            "task",
            (x) => {
              const { sent: _s, ...rest } = x;
              return undo ? rest : { ...rest, sent: { at: now(), by: tree.actor } };
            },
            { op: undo ? "task.unsent" : "task.sent", summary: `${before.id} ${undo ? "not sent after all" : "request sent"}`, reason: opts.reason as string | undefined },
          );
          return { task: after, same: false };
        });
      });
      const marked = r.filter((x) => !x.same).map((x) => x.task.id);
      const same = r
        .filter((x) => x.same)
        .map((x) => (undo ? `${x.task.id} was not marked sent — nothing changed` : `${x.task.id} was marked sent on ${x.task.sent!.at.slice(0, 10)} already — nothing changed`));
      const text = lines(marked.length ? written(tree) : undefined, ...same, undo ? undefined : `${ids.join(", ")} still wait${ids.length === 1 ? "s" : ""} for the reply — when it comes: strom task wake ${ids.length === 1 ? ids[0] : "<task>"} (the user's answer: --answer)`);
      if (r.length === 1) {
        const t = r[0]!.task;
        return { text, data: { task: t, changed: !r[0]!.same, marked, ...waitState(tree, t) } };
      }
      return { text, data: { tasks: r.map((x) => ({ id: x.task.id, changed: !x.same, ...waitState(tree, x.task) })), marked } };
    },
  },
  {
    path: ["task", "drop"],
    summary: "Give up a task (kept, with the reason)",
    group: "tasks",
    tree: true,
    writes: true,
    args: [{ name: "task", description: "task ID", required: true }],
    examples: ['strom task drop T0002 --reason "the book was destroyed; no other copy is known"'],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      if (!opts.reason) throw new UsageError("--reason is required");
      const t = stateChange(tree, args[0]!, "dropped", {}, String(opts.reason), "drop");
      return { text: written(tree), data: { task: t } };
    },
  },
);
