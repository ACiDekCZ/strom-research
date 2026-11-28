// The tree check's built-in part (spec 091 K5): what strom knows already, free, no agent and nothing written — strom
// check's state, what the tree grew by in 30 days, the lines and the queue, requests sent long ago, what waits for the
// person's decision, strom's fixes, verification by line, the edges unsearched, the material, the tasks' waits, the
// citations; and the steps it recommends (K6.10). The AI checks (A–L) are a task (core/audit.ts).

import fs from "node:fs";
import path from "node:path";
import { check } from "./check.ts";
import { DEFAULT_RUN_MINUTES, Settings } from "./config.ts";
import { directionOf, scopes, type Scope } from "./directions.ts";
import { treeEdges } from "./edge.ts";
import * as git from "./git.ts";
import type { Env } from "./paths.ts";
import { researchPeople } from "./frontier.ts";
import { batchStatus } from "./batches.ts";
import { materialWaiting } from "./originals.ts";
import type { Family, Input, Person, Research, Session, Source, Task } from "./model.ts";
import { runOrder } from "./queue.ts";
import { unprovenPeople } from "./review.ts";
import { costPartial, sessionCost } from "./session.ts";
import { actsAsArchive } from "./state.ts";
import { auditTasks } from "./taskaudit.ts";
import { now, type Tree } from "./tree.ts";
import { verifyWaiting } from "./verify.ts";
import { daysFrom, localDay, sentDay } from "./waitkind.ts";
import { waitingFor } from "./waiting.ts";
import { AUDIT_TYPES, decisionsOf, healthRev, lastAiReport, listReports, runInfo, type AuditType, type HealthScope, type RunInfo } from "./audit.ts";

/** A request with no reply for more days than this is said (as the menu's What waits says it). */
export const SENT_OLD_DAYS = 30;
/** A scope of more people than this is large: the app offers only what changed (Q4). */
export const LARGE_SCOPE = 2000;
export const STEPS_MAX = 10;
export const EDGE_PEOPLE_MAX = 50;

/** One AI check of the catalog: on by default or not (heavy), and what it takes per 100 people of the scope (minutes). */
export interface AuditCatalogItem {
  type: AuditType;
  heavy: boolean;
  per100: [number, number];
  /** Only with the research of houses on (L). */
  houses?: true;
}

export const AUDIT_CATALOG: Record<AuditType, AuditCatalogItem> = {
  A: { type: "A", heavy: false, per100: [1, 3] },
  B: { type: "B", heavy: false, per100: [1, 2] },
  C: { type: "C", heavy: false, per100: [0.5, 1.5] },
  D: { type: "D", heavy: false, per100: [1, 2] },
  E: { type: "E", heavy: true, per100: [4, 8] },
  F: { type: "F", heavy: true, per100: [4, 8] },
  G: { type: "G", heavy: false, per100: [2, 4] },
  H: { type: "H", heavy: false, per100: [1, 3] },
  I: { type: "I", heavy: false, per100: [0.5, 1.5] },
  J: { type: "J", heavy: true, per100: [3, 6] },
  K: { type: "K", heavy: true, per100: [3, 6] },
  L: { type: "L", heavy: false, per100: [1, 2], houses: true },
};
/** The least any one check takes (a person's check too: their records, families and sources read). */
const LEAST: [number, number] = [3, 5];
/** The order the agent goes through them: where to look next and the stories first (Q4). */
export const AUDIT_ORDER: AuditType[] = ["G", "A", "B", "C", "D", "H", "I", "L", "E", "F", "J", "K"];

/** The checks of `default` (G,A,B,C,D,H,I and L with houses on) — or `all`, `none`, or a list (G,A,…). Throws on an unknown. */
export function aiOf(raw: string | readonly string[] | undefined, housesOn: boolean): AuditType[] {
  if (raw === undefined) return [];
  const words = (Array.isArray(raw) ? raw : String(raw).split(/[,\s]+/u)).map((w) => String(w).trim()).filter(Boolean);
  const out = new Set<AuditType>();
  for (const w of words) {
    const lower = w.toLowerCase();
    if (lower === "none") continue;
    if (lower === "all") AUDIT_TYPES.forEach((t) => out.add(t));
    else if (lower === "default") AUDIT_TYPES.filter((t) => !AUDIT_CATALOG[t].heavy && (!AUDIT_CATALOG[t].houses || housesOn)).forEach((t) => out.add(t));
    else {
      const t = w.toUpperCase();
      if (!(AUDIT_TYPES as readonly string[]).includes(t)) throw Object.assign(new Error(`unknown check ${w}`), { unknownCheck: w });
      out.add(t as AuditType);
    }
  }
  return AUDIT_ORDER.filter((t) => out.has(t));
}

const live = <T extends { retracted?: unknown; mergedInto?: string }>(xs: T[]) => xs.filter((x) => !x.retracted && !x.mergedInto);

/** The people a scope is of (a line's, a person alone, the whole tree's). */
export function scopePeople(tree: Tree, scope: HealthScope): string[] {
  if (scope.kind === "person") return [scope.id];
  if (scope.kind === "line") {
    const r = tree.get<Research>(scope.id);
    return r ? [...researchPeople(tree, r).keys()].filter((id) => !!tree.get(id)) : [];
  }
  return live(tree.list<Person>("person")).map((p) => p.id);
}

/** The records changed since a commit (persons, families, sources, stories' and houses' records): what --changed checks. */
export function changedSince(tree: Tree, head: string): string[] | undefined {
  const r = git.runGit(tree.root, ["diff", "--name-only", `${head}..HEAD`, "--", "data"]);
  if (r.status !== 0) return undefined;
  const ids = new Set<string>();
  for (const line of r.stdout.split("\n")) {
    const m = /(?:^|\/)([A-Z]\d{1,9})\.json$/u.exec(line.trim());
    if (m && !line.includes("/ops/")) ids.add(m[1]!);
  }
  return [...ids].sort();
}

export interface HealthEstimate {
  total: { minutes: [number, number]; sessions: number; usd?: number };
  byType: Partial<Record<AuditType, { minutes: [number, number] }>>;
  people: number;
  large: boolean;
}

/** What a session here costs on average (the ended ones whose cost strom knows), or undefined. */
function sessionAvg(tree: Tree): number | undefined {
  const ended = tree.list<Session>("session").filter((s) => s.state !== "open" && !costPartial(s.metrics) && sessionCost(s.metrics) !== undefined);
  return ended.length ? ended.reduce((n, s) => n + sessionCost(s.metrics)!, 0) / ended.length : undefined;
}

/** What the AI checks would take (minutes, sessions, what they cost here as sessions so far did): never exact. */
export function estimate(tree: Tree, settings: Settings, ai: AuditType[], people: number): HealthEstimate {
  const byType: HealthEstimate["byType"] = {};
  let lo = 0;
  let hi = 0;
  for (const t of ai) {
    const [a, b] = AUDIT_CATALOG[t].per100;
    const m: [number, number] = [Math.max(LEAST[0], Math.round((a * people) / 100)), Math.max(LEAST[1], Math.round((b * people) / 100))];
    byType[t] = { minutes: m };
    lo += m[0];
    hi += m[1];
  }
  const limit = Math.max(5, settings.number("run.minutes", tree.config, DEFAULT_RUN_MINUTES));
  const sessions = ai.length ? Math.max(1, Math.ceil(hi / limit)) : 0;
  const avg = sessionAvg(tree);
  return {
    total: { minutes: [lo, hi], sessions, ...(avg !== undefined && sessions ? { usd: Math.round(avg * sessions * 100) / 100 } : {}) },
    byType,
    people,
    large: people > LARGE_SCOPE,
  };
}

export interface HealthBuiltin {
  at: string;
  head: string;
  check: { ok: boolean; errors: number; warnings: number; unproven: number; at: string };
  growth: { days: 30; persons: number; facts: number; sources: number; agentLast?: string };
  lines: { id: string; name: string; state: string; tasks: number; waiting: number; stuck: boolean }[];
  queue: { open: number; parked: number; empty: boolean };
  sentOld: { id: string; what: string; sentDay: string; days: number; research?: string }[];
  decide: Record<string, number>;
  fixes: { id: string; count: number; cost?: string; paid: boolean }[];
  verify: { waiting: number; byLine: Record<string, { people: number; facts: number }> };
  edges: { unsearched: number; people: string[] };
  batches: { open: number; unsorted: number };
  material: { unlinked: number };
  tasksAudit: number;
  citations: { noPage: number; noImage: number };
  steps: HealthStep[];
}

export interface HealthStep {
  kind: "check" | "line-stuck" | "sent-old" | "decide" | "queue-empty" | "fix" | "verify-line" | "edge" | "material";
  subject?: string;
  count?: number;
  action: string;
}

/** strom's fixes as the built-in part takes them (fixes/AppFix of commands/fixchecks.ts: given by the caller). */
export interface FixSeen {
  id: string;
  count: number;
  state: string;
  cost?: string;
  paid: boolean;
}

const DAY_MS = 24 * 60 * 60_000;

/** Each part worked out alone: one that fails says nothing rather than the whole check failing. */
function safely<T>(fn: () => T, none: T): T {
  try {
    return fn();
  } catch {
    return none;
  }
}

/** The ops of the last days (data/ops/<month>/<day>/*.jsonl): their names and targets. */
function opsSince(tree: Tree, since: number): { op: string; targets: string[] }[] {
  const out: { op: string; targets: string[] }[] = [];
  const base = path.join(tree.root, "data", "ops");
  let months: string[] = [];
  try {
    months = fs.readdirSync(base);
  } catch {
    return out;
  }
  const first = new Date(since).toISOString().slice(0, 10);
  for (const month of months.filter((m) => /^\d{4}-\d{2}$/u.test(m) && m >= first.slice(0, 7))) {
    let days: string[] = [];
    try {
      days = fs.readdirSync(path.join(base, month));
    } catch {
      continue;
    }
    for (const day of days.filter((d) => /^\d{2}$/u.test(d) && `${month}-${d}` >= first)) {
      let files: string[] = [];
      try {
        files = fs.readdirSync(path.join(base, month, day)).filter((f) => f.endsWith(".jsonl"));
      } catch {
        continue;
      }
      for (const f of files) {
        let text = "";
        try {
          text = fs.readFileSync(path.join(base, month, day, f), "utf8");
        } catch {
          continue;
        }
        for (const line of text.split("\n")) {
          if (!line) continue;
          try {
            const op = JSON.parse(line) as { op?: string; at?: string; targets?: string[] };
            if (op.op && op.at && Date.parse(op.at) >= since) out.push({ op: op.op, targets: op.targets ?? [] });
          } catch {
            // a line half written
          }
        }
      }
    }
  }
  return out;
}

function growthOf(tree: Tree, archive: boolean, at: number): HealthBuiltin["growth"] {
  const since = at - 30 * DAY_MS;
  const recent = (x: { created: string }) => Date.parse(x.created) >= since;
  const persons = live(tree.list<Person>("person")).filter(recent);
  const sources = live(tree.list<Source>("source")).filter(recent).length;
  const born = new Set(persons.map((p) => p.id));
  let facts = persons.reduce((n, p) => n + p.events.filter((e) => !e.retracted).length, 0);
  facts += live(tree.list<Family>("family")).filter(recent).reduce((n, f) => n + f.events.filter((e) => !e.retracted).length, 0);
  facts += opsSince(tree, since).filter((o) => o.op === "event.add" && !o.targets.some((t) => born.has(t))).length;
  const ended = archive ? undefined : tree.list<Session>("session").map((s) => s.ended ?? (s.state === "open" ? s.started : undefined)).filter((x): x is string => !!x).sort().at(-1);
  return { days: 30, persons: persons.length, facts, sources, ...(ended ? { agentLast: ended } : {}) };
}

function citationsOf(tree: Tree): HealthBuiltin["citations"] {
  const sources = new Map(live(tree.list<Source>("source")).map((s) => [s.id, s]));
  const media = new Set<string>();
  for (const i of tree.list<Input>("input")) if (!i.retracted && i.source) media.add(i.source);
  let noPage = 0;
  let noImage = 0;
  for (const owner of [...live(tree.list<Person>("person")), ...live(tree.list<Family>("family"))]) {
    for (const e of owner.events) {
      if (e.retracted) continue;
      for (const c of e.citations) {
        const s = sources.get(c.source);
        if (!s || s.form !== "original") continue;
        if (!c.locator && !s.locator && !s.folio) noPage++;
        if (!s.image && !s.input && !media.has(s.id)) noImage++;
      }
    }
  }
  return { noPage, noImage };
}

/**
 * The built-in part of the tree check (strom health, GET /health/builtin): read only. In an archive, or a research
 * waiting for its agent, nothing of an agent — no lines, queue, requests, verification, edges, task waits or fixes
 * an agent does (an archive says nothing of an agent: test archive-no-ai).
 */
export function builtin(tree: Tree, env: Env, o: { scope?: HealthScope; fixes?: FixSeen[] } = {}): HealthBuiltin {
  const settings = new Settings(env, {});
  const archive = actsAsArchive(tree);
  const at = Date.now();
  const stamp = now();
  const head = git.head(tree.root) ?? "";
  const all: Scope[] = archive ? [] : safely(() => scopes(tree), []);
  const inScope = o.scope && o.scope.kind !== "tree" ? new Set(scopePeople(tree, o.scope)) : undefined;
  const lineOk = (id: string | undefined) => !o.scope || o.scope.kind !== "line" || id === o.scope.id;

  const found = safely(() => check(tree), []);
  const checkPart = { ok: !found.some((f) => f.level === "error"), errors: found.filter((f) => f.level === "error").length, warnings: found.filter((f) => f.level === "warn").length, unproven: safely(() => unprovenPeople(tree).length, 0), at: stamp };

  const tasks = tree.list<Task>("task").filter((t) => !t.retracted);
  const ranked = archive ? [] : safely(() => runOrder(tree, tasks, settings.strategy(tree.config)), []);
  const lineOf = new Map<string, string | undefined>();
  const lineOfTask = (t: Task) => {
    if (!lineOf.has(t.id)) lineOf.set(t.id, safely(() => directionOf(tree, t, all), undefined));
    return lineOf.get(t.id);
  };
  const lines = archive
    ? []
    : all
        .filter((s) => !s.research.retracted && lineOk(s.research.id))
        .map(({ research: r }) => {
          const queued = ranked.filter((x) => lineOfTask(x.task) === r.id).length;
          const waiting = tasks.filter((t) => t.state === "waiting" && lineOfTask(t) === r.id).length;
          return { id: r.id, name: r.name, state: r.state, tasks: queued, waiting, stuck: r.state === "active" && queued === 0 };
        });
  const parked = archive ? 0 : tasks.filter((t) => t.state === "parked" && lineOk(lineOfTask(t))).length;
  const open = archive ? 0 : ranked.filter((x) => lineOk(lineOfTask(x.task))).length;

  const items = archive ? [] : safely(() => waitingFor(tree, { scopes: all }), []);
  const today = localDay(at);
  const sentOld = items
    .filter((w) => w.item.phase === "sent" && w.task?.sent && lineOk(lineOfTask(w.task)))
    .map((w) => {
      const day = sentDay(w.task!.sent!.at);
      const research = lineOfTask(w.task!);
      return { id: w.task!.id, what: w.task!.what, sentDay: day, days: Math.max(0, daysFrom(day, today)), ...(research ? { research } : {}) };
    })
    .filter((x) => x.days > SENT_OLD_DAYS)
    .sort((a, b) => b.days - a.days);
  const decide: Record<string, number> = {};
  for (const w of items) if (w.item.section === "decide") decide[w.item.kind] = (decide[w.item.kind] ?? 0) + 1;

  const fixes = (o.fixes ?? []).filter((f) => f.state === "pending" && f.count > 0).map((f) => ({ id: f.id, count: f.count, ...(f.cost ? { cost: f.cost } : {}), paid: f.paid }));

  const byLine: Record<string, { people: number; facts: number }> = {};
  let verifyWaitingFacts = 0;
  if (!archive) {
    const people = new Map<string, Set<string>>();
    for (const [, { task }] of safely(() => verifyWaiting(tree), new Map())) {
      const line = lineOfTask(task);
      if (!lineOk(line)) continue;
      verifyWaitingFacts++;
      if (!line) continue;
      const b = (byLine[line] ??= { people: 0, facts: 0 });
      b.facts++;
      const set = people.get(line) ?? new Set<string>();
      for (const s of task.subject) set.add(s);
      people.set(line, set);
    }
    for (const [line, set] of people) byLine[line]!.people = set.size;
  }

  const edgePeople = archive
    ? []
    : [...safely(() => treeEdges(tree, { named: false }).edges, new Map()).values()]
        .filter((e) => ["unsearched", "no-books", "no-place"].includes(e.end) && e.next === "none" && (!inScope || inScope.has(e.person)))
        .map((e) => e.person)
        .sort();

  const batches = safely(() => batchStatus(tree), []);
  const tasksAudit = archive ? 0 : safely(() => auditTasks(tree, { shared: settings.shared()?.value }).tasks.length, 0);

  const part: Omit<HealthBuiltin, "steps"> = {
    at: stamp,
    head,
    check: checkPart,
    growth: safely(() => growthOf(tree, archive, at), { days: 30, persons: 0, facts: 0, sources: 0 }),
    lines,
    queue: { open, parked, empty: !archive && open === 0 },
    sentOld,
    decide,
    fixes,
    verify: { waiting: verifyWaitingFacts, byLine },
    edges: { unsearched: edgePeople.length, people: edgePeople.slice(0, EDGE_PEOPLE_MAX) },
    batches: {
      open: batches.filter((b) => b.state === "open" && !b.kept).length,
      unsorted: batches.filter((b) => b.state === "open" && !b.kept).reduce((n, b) => n + Math.max(0, Number(b.files ?? 0) - Number(b.sorted ?? 0)), 0),
    },
    material: { unlinked: safely(() => materialWaiting(tree), 0) },
    tasksAudit,
    citations: safely(() => citationsOf(tree), { noPage: 0, noImage: 0 }),
  };
  return { ...part, steps: stepsOf(part, archive) };
}

/** The steps recommended, in order (K6.10): what blocks the research first, then what grows the tree, then what tidies it. */
export function stepsOf(b: Omit<HealthBuiltin, "steps">, archive: boolean): HealthStep[] {
  const out: HealthStep[] = [];
  if (b.check.errors) out.push({ kind: "check", count: b.check.errors, action: "open" });
  if (!archive) {
    for (const l of b.lines.filter((x) => x.stuck)) out.push({ kind: "line-stuck", subject: l.id, ...(l.waiting ? { count: l.waiting } : {}), action: l.waiting ? `waiting?research=${l.id}` : `work?research=${l.id}` });
    if (b.sentOld.length) out.push({ kind: "sent-old", count: b.sentOld.length, action: "waiting" });
    const decide = Object.values(b.decide).reduce((n, x) => n + x, 0);
    if (decide) out.push({ kind: "decide", count: decide, action: "waiting" });
    if (b.queue.empty && b.lines.some((l) => l.state === "active")) out.push({ kind: "queue-empty", action: "open" });
    for (const f of [...b.fixes].sort((x, y) => Number(x.paid) - Number(y.paid) || y.count - x.count)) out.push({ kind: "fix", subject: f.id, count: f.count, action: `fixes?id=${f.id}` });
    for (const [line, v] of Object.entries(b.verify.byLine).sort((x, y) => y[1].facts - x[1].facts)) out.push({ kind: "verify-line", subject: line, count: v.facts, action: `verify-line:${line}` });
    if (b.edges.unsearched) out.push({ kind: "edge", count: b.edges.unsearched, action: "open" });
  }
  if (b.material.unlinked || b.batches.unsorted) out.push({ kind: "material", count: Math.max(b.material.unlinked, b.batches.unsorted), action: "materials" });
  return out.slice(0, STEPS_MAX);
}

/** What the AI checks would go through for --changed: the records changed since the last report of the same scope. */
export function changedOf(tree: Tree, scope: HealthScope): { since?: string; report?: string; records?: string[] } {
  const last = lastAiReport(tree, scope);
  if (!last?.head) return {};
  const records = changedSince(tree, last.head);
  return records ? { since: last.head, report: last.id, records } : {};
}

/**
 * /status.health (spec 091 V4, feature health): the fingerprint of every report and decision (GET /health asked again
 * only when it changes), the newest report (without its built-in part), and for a run of the AI not ended how many
 * tasks of the queue come before its own and about how many minutes its checks not gone through take.
 */
export function healthStatus(tree: Tree, settings: Settings, head: string | undefined, ranked: readonly { task: Pick<Task, "id"> }[], archive = false): { rev: string; last?: RunInfo; before?: number; left?: number } {
  const rev = healthRev(tree, head);
  // an archive: its newest built-in report (it says nothing of an agent or the AI)
  const r = archive ? listReports(tree, Infinity).find((x) => !x.ai.length) : listReports(tree, 1)[0];
  if (!r) return { rev };
  const last = runInfo(tree, r, { decisions: decisionsOf(tree) });
  if (last.state !== "queued" && last.state !== "running") return { rev, last };
  const at = ranked.findIndex((x) => x.task.id === r.task);
  const left = r.ai.filter((t) => !(r.checked ?? []).includes(t));
  const people = r.changed && r.since ? (changedSince(tree, r.since)?.length ?? scopePeople(tree, r.scope).length) : scopePeople(tree, r.scope).length;
  return { rev, last, ...(last.state === "queued" && at >= 0 ? { before: at } : {}), left: left.length ? estimate(tree, settings, left, people).total.minutes[1] : 0 };
}
