// The tree check (spec 091): its reports and the AI's findings, kept with the research in quality/ (sealed operations of
// the tree, like quality/dismissed.json; no records of data/, no SCHEMA_VERSION raised — an older strom leaves them be).
//
//   quality/health/C0001.json — one report: when, its scope, the AI checks chosen (none: only the built-in part, saved by
//                               strom health --save), the head it ran at, its task, the built-in part then, what the AI
//                               found (at most AUDIT_MAX), checked, its summary and order of the steps
//   quality/audit.json        — the person's decisions on findings, by the finding's id: accepted (its task), dismissed —
//                               kept across runs, so a dismissed finding is never reported again (K2.2)
//
// Only the agent of the report's task writes findings (strom audit add, in its session); only the person decides them
// (strom audit accept|dismiss|undo, the Strom app through the bridge) — never an agent. Nothing of the tree changes by a
// finding: an accepted one is a task of the queue, done by the research's usual commands (K1.3, K2.3).

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { readJsonIfExists, stringifyCanonical } from "./json.ts";
import { UsageError } from "./errors.ts";
import * as git from "./git.ts";
import { TASK_LEVELS, type Session, type Task } from "./model.ts";
import { create, update } from "./records.ts";
import { now, typeOfId, type Tree } from "./tree.ts";
import { directionOf, scopes } from "./directions.ts";

export const HEALTH_DIR = "quality/health";
export const AUDIT_FILE = "quality/audit.json";
/** At most so many findings a run (spec 091 K1.3, Q4): the whole run, every type together. */
export const AUDIT_MAX = 30;
/** At most so many reports GET /health gives (the newest). */
export const REPORTS_LISTED = 10;
export const RECORDS_MAX = 20;
export const TEXT_MAX = 400;
export const QUOTE_MAX = 300;
export const PROOFS_MAX = 10;
export const ORDER_MAX = 10;
/** The origin of a task of the AI check: health:<C…>. */
export const HEALTH_ORIGIN = "health:";
/** The origin of a task of an accepted finding: audit:<its id>. */
export const AUDIT_ORIGIN = "audit:";

/** The AI checks (spec 091 catalog A–L). */
export const AUDIT_TYPES = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"] as const;
export type AuditType = (typeof AUDIT_TYPES)[number];
export const SEVERITIES = ["error", "warning", "info"] as const;

/** The level of the task an accepted finding becomes, by its type (strom audit add --level says another). */
export const LEVEL_OF: Record<AuditType, Task["level"]> = { A: "narrate", B: "enrich", C: "intake", D: "enrich", E: "link", F: "link", G: "locate", H: "enrich", I: "enrich", J: "locate", K: "enrich", L: "enrich" };

export type HealthScope = { kind: "tree" } | { kind: "line"; id: string } | { kind: "person"; id: string };

/** A text the research wrote, in its language: { [lang]: text } (spec 091 Q8 — the agent writes the research's language alone). */
export type Said = Record<string, string>;

export interface AuditProof {
  id: string;
  quote?: string;
}

export interface StoredFinding {
  id: string;
  type: AuditType;
  /** The kind of problem the agent names it by (a-z, 0-9, -): with the type and the records, the finding's id. */
  code: string;
  severity: (typeof SEVERITIES)[number];
  records: string[];
  what: Said;
  fix: Said;
  proof: AuditProof[];
  suggestOnly?: boolean;
  estimate?: { minutes: [number, number] };
  /** The level of its task once accepted. */
  level: Task["level"];
  at: string;
}

export interface HealthReport {
  id: string;
  at: string;
  scope: HealthScope;
  ai: AuditType[];
  changed?: boolean;
  /** --changed: the head of the last report of the AI of the same scope — what changed since it is checked. */
  since?: string;
  head?: string;
  task?: string;
  /** The built-in part when the report was made (strom health --json's builtin). */
  builtin?: Record<string, unknown>;
  /** The AI checks the agent said it went through (strom audit checked). */
  checked?: AuditType[];
  findings?: StoredFinding[];
  summary?: Said;
  order?: { kind: string; subject?: string; why: Said }[];
  /** The person asked it to stop (POST /health/stop, strom health stop): when. */
  stopped?: string;
  lang: string;
}

export interface Decision {
  id: string;
  state: "accepted" | "dismissed";
  at: string;
  by: "app" | "research";
  /** The report whose finding it was. */
  run: string;
  task?: string;
  /** The finding as it was decided (its type, records, what): a dismissed one is shown in strom audit list after its report is gone. */
  type?: AuditType;
  records?: string[];
}

export interface AuditFile {
  decisions: Decision[];
}

/** The state of a run, worked out from its task and sessions — never stored. */
export type RunState = "built" | "queued" | "running" | "done" | "stopped" | "failed";

const REPORT_ID = /^C\d{4,9}$/u;
const FINDING_ID = /^[A-L]-[0-9a-f]{8}$/u;
const CODE = /^[\p{Ll}\p{N}][\p{Ll}\p{N}-]{0,39}$/u;
const RECORD = /^(?:[A-Z]\d{1,9}|E\d{1,9})$/u;
const byCodePoint = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export const isReportId = (id: unknown): id is string => typeof id === "string" && REPORT_ID.test(id);
export const isFindingId = (id: unknown): id is string => typeof id === "string" && FINDING_ID.test(id);
export const isAuditType = (t: unknown): t is AuditType => typeof t === "string" && (AUDIT_TYPES as readonly string[]).includes(t);
/** The report of a task of the AI check (origin health:C…), or undefined. */
export const reportOfTask = (t: Pick<Task, "origin"> | undefined): string | undefined =>
  t && typeof t.origin === "string" && t.origin.startsWith(HEALTH_ORIGIN) && isReportId(t.origin.slice(HEALTH_ORIGIN.length)) ? t.origin.slice(HEALTH_ORIGIN.length) : undefined;
/** The finding of a task of an accepted finding (origin audit:<id>), or undefined. */
export const findingOfTask = (t: Pick<Task, "origin">): string | undefined => (typeof t.origin === "string" && t.origin.startsWith(AUDIT_ORIGIN) ? t.origin.slice(AUDIT_ORIGIN.length) : undefined);

/** A finding's id, the same across runs (Q3): its type, its records sorted and the code of the problem — never its text. */
export function findingId(type: AuditType, records: readonly string[], code: string): string {
  const key = JSON.stringify([type, [...new Set(records)].sort(byCodePoint), code]);
  return `${type}-${crypto.createHash("sha256").update(key).digest("hex").slice(0, 8)}`;
}

const reportFile = (id: string) => `${HEALTH_DIR}/${id}.json`;
const abs = (tree: { root: string }, rel: string) => path.join(tree.root, ...rel.split("/"));

/** The reports' IDs, oldest first. */
export function reportIds(tree: { root: string }): string[] {
  let names: string[] = [];
  try {
    names = fs.readdirSync(abs(tree, HEALTH_DIR));
  } catch {
    return [];
  }
  return names
    .filter((n) => n.endsWith(".json") && REPORT_ID.test(n.slice(0, -5)))
    .map((n) => n.slice(0, -5))
    .sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
}

export function readReport(tree: { root: string }, id: string): HealthReport | undefined {
  if (!isReportId(id)) return undefined;
  try {
    const r = readJsonIfExists<HealthReport>(abs(tree, reportFile(id)));
    return r && r.id === id ? r : undefined;
  } catch {
    return undefined;
  }
}

export function readAudit(tree: { root: string }): AuditFile {
  try {
    const f = readJsonIfExists<Partial<AuditFile>>(abs(tree, AUDIT_FILE));
    return { decisions: Array.isArray(f?.decisions) ? f.decisions.filter((d) => d && isFindingId(d.id) && (d.state === "accepted" || d.state === "dismissed")) : [] };
  } catch {
    return { decisions: [] };
  }
}

/** A fingerprint of every report, every decision and the state of their tasks: /status.health.rev, POST /audit expect. */
export function healthRev(tree: Tree, head?: string): string {
  const h = crypto.createHash("sha256");
  for (const id of reportIds(tree)) {
    try {
      h.update(fs.readFileSync(abs(tree, reportFile(id))));
    } catch {
      // gone meanwhile
    }
  }
  try {
    h.update(fs.readFileSync(abs(tree, AUDIT_FILE)));
  } catch {
    // none yet
  }
  for (const r of reportIds(tree).slice(-REPORTS_LISTED)) h.update(`${r}:${runState(tree, readReport(tree, r)!)}`);
  return `${((head ?? git.head(tree.root)) || "0000000").slice(0, 7)}-${h.digest("hex").slice(0, 6)}`;
}

function writeReport(tree: Tree, r: HealthReport, op: string, summary: string): void {
  tree.putFile(reportFile(r.id), stringifyCanonical(r), { op, targets: r.task ? [r.task] : [], summary });
}

function writeAudit(tree: Tree, f: AuditFile, summary: string): void {
  const sorted = [...f.decisions].sort((a, b) => byCodePoint(a.id, b.id));
  tree.putFile(AUDIT_FILE, stringifyCanonical({ decisions: sorted }), { op: "audit.decide", targets: [], summary });
}

/** The next report's ID. */
function nextId(tree: Tree): string {
  const last = reportIds(tree).at(-1);
  return `C${String((last ? Number(last.slice(1)) : 0) + 1).padStart(4, "0")}`;
}

export function scopeText(s: HealthScope): string {
  return s.kind === "tree" ? "tree" : `${s.kind}:${s.id}`;
}

/** A scope as the command line or the app says it: tree, line:G…, person:P… (also {kind, id}). Throws health.scope. */
export function scopeOf(tree: Tree, raw: unknown): HealthScope {
  const bad = (why: string) => new UsageError(`the scope: ${why}`, { code: "health.scope", hint: "--scope tree | line:G0001 | person:P0001" });
  let kind: string;
  let id: string | undefined;
  if (raw === undefined || raw === null || raw === "" || raw === "tree") return { kind: "tree" };
  if (typeof raw === "string") [kind, id] = raw.split(":", 2) as [string, string | undefined];
  else if (typeof raw === "object") ({ kind, id } = raw as { kind: string; id?: string });
  else throw bad("tree, line:G… or person:P…");
  if (kind === "tree" && !id) return { kind: "tree" };
  const ref = typeof id === "string" ? id.trim().toUpperCase() : "";
  if (kind === "line") {
    const r = tree.get(ref);
    if (!r || r.type !== "research" || r.retracted) throw bad(`no line ${ref || "(none)"} (strom research list)`);
    return { kind: "line", id: ref };
  }
  if (kind === "person") {
    const p = tree.get(ref);
    if (!p || p.type !== "person" || p.retracted) throw bad(`no person ${ref || "(none)"} (strom person list)`);
    return { kind: "person", id: ref };
  }
  throw bad("tree, line:G… or person:P…");
}

const sameScope = (a: HealthScope, b: HealthScope) => scopeText(a) === scopeText(b);

/** The tasks of the research by ID (one listing). */
const tasksById = (tree: Tree) => new Map(tree.list<Task>("task").map((t) => [t.id, t]));

/** How the run of a report goes now (from its task and the sessions on it). */
export function runState(tree: Tree, r: HealthReport, sessions?: Session[]): RunState {
  if (!r.task) return "built";
  const t = tree.get<Task>(r.task);
  if (!t || t.type !== "task") return "failed";
  const open = (sessions ?? tree.list<Session>("session")).some((s) => s.state === "open" && s.task === t.id);
  if (open) return "running";
  if (t.state === "done") return "done";
  if (r.stopped) return "stopped";
  if (t.state === "dropped" || t.state === "waiting" || (t.state === "parked" && !t.parkedUntil)) return "failed";
  return "queued";
}

/** Why a run did not end, as the research has it (its task's result, the reason it was put aside). */
function reasonOf(tree: Tree, r: HealthReport, state: RunState): string | undefined {
  if (state !== "failed" && state !== "stopped") return undefined;
  const t = r.task ? tree.get<Task>(r.task) : undefined;
  return t?.parkedReason ?? t?.result ?? t?.notes.at(-1)?.text ?? (t ? undefined : `its task ${r.task} is gone`);
}

export interface FindingView extends Omit<StoredFinding, "at"> {
  lang: string;
  state: "new" | "accepted" | "dismissed";
  task?: string;
  taskStarted?: boolean;
  run: string;
}

/** Whether a task of an accepted finding has started: anything but open, or a session on it. */
function started(tree: Tree, task: Task | undefined): boolean {
  if (!task) return false;
  return task.state !== "open" || tree.list<Session>("session").some((s) => s.task === task.id);
}

export function findingView(tree: Tree, r: HealthReport, f: StoredFinding, decisions: Map<string, Decision>, tasks?: Map<string, Task>): FindingView {
  const d = decisions.get(f.id);
  const { at: _at, ...rest } = f;
  const task = d?.task ? (tasks ?? tasksById(tree)).get(d.task) : undefined;
  return {
    ...rest,
    lang: r.lang,
    state: d ? d.state : "new",
    ...(d?.task ? { task: d.task, taskStarted: started(tree, task) } : {}),
    run: r.id,
  };
}

export interface RunInfo {
  id: string;
  at: string;
  scope: HealthScope;
  ai: AuditType[];
  changed?: boolean;
  head?: string;
  task?: string;
  state: RunState;
  done?: number;
  total?: number;
  findings?: number;
  counts: { new: number; accepted: number; dismissed: number };
  reason?: string;
  order?: HealthReport["order"];
  summary?: Said;
  lang: string;
  builtin?: Record<string, unknown>;
}

/** A report as GET /health gives it (without its built-in part unless asked). */
export function runInfo(tree: Tree, r: HealthReport, o: { builtin?: boolean; decisions?: Map<string, Decision> } = {}): RunInfo {
  const decisions = o.decisions ?? new Map(readAudit(tree).decisions.map((d) => [d.id, d]));
  const state = runState(tree, r);
  const counts = { new: 0, accepted: 0, dismissed: 0 };
  for (const f of r.findings ?? []) counts[decisions.get(f.id)?.state ?? "new"]++;
  const reason = reasonOf(tree, r, state);
  return {
    id: r.id,
    at: r.at,
    scope: r.scope,
    ai: r.ai,
    ...(r.changed ? { changed: true } : {}),
    ...(r.head ? { head: r.head } : {}),
    ...(r.task ? { task: r.task } : {}),
    state,
    ...(r.ai.length ? { done: (r.checked ?? []).length, total: r.ai.length, findings: (r.findings ?? []).length } : {}),
    counts,
    ...(reason ? { reason } : {}),
    ...(r.order?.length ? { order: r.order } : {}),
    ...(r.summary ? { summary: r.summary } : {}),
    lang: r.lang,
    ...(o.builtin && r.builtin ? { builtin: r.builtin } : {}),
  };
}

/** The reports, newest first (at most `max`). */
export function listReports(tree: Tree, max = REPORTS_LISTED): HealthReport[] {
  return reportIds(tree)
    .reverse()
    .slice(0, max)
    .map((id) => readReport(tree, id))
    .filter((r): r is HealthReport => !!r);
}

/** The newest report of the AI of this scope (for --changed), if any. */
export function lastAiReport(tree: Tree, scope: HealthScope): HealthReport | undefined {
  return listReports(tree, Infinity).find((r) => r.ai.length && sameScope(r.scope, scope) && r.head && runState(tree, r) === "done");
}

/** A run of the AI not ended yet (queued or at work), of this scope or any. */
export function liveRun(tree: Tree, scope?: HealthScope): HealthReport | undefined {
  return listReports(tree, Infinity).find((r) => r.ai.length && (!scope || sameScope(r.scope, scope)) && ["queued", "running"].includes(runState(tree, r)));
}

/** A report of the built-in part alone (strom health --save). */
export function saveBuiltin(tree: Tree, scope: HealthScope, builtin: Record<string, unknown>): HealthReport {
  return tree.withTreeLock(() => {
    const r: HealthReport = { id: nextId(tree), at: now(), scope, ai: [], head: git.head(tree.root) || undefined, builtin, lang: tree.lang };
    if (!r.head) delete r.head;
    writeReport(tree, r, "health.save", `tree check ${r.id} saved (${scopeText(scope)})`);
    return r;
  });
}

/** The words of the task of an AI check (in the research's language: the queue and the app show them). */
export interface RunTaskWords {
  what: (id: string) => string;
  why: string;
  doneWhen: string;
  where: string;
}

/**
 * A run of the AI checks asked for (strom health --ai, POST /health): its report and its task, first in the queue (the
 * person asked: queueAt next). Refused while a run of the same scope is not ended (health.running).
 */
export function startRun(tree: Tree, o: { scope: HealthScope; ai: AuditType[]; changed?: boolean; since?: string; builtin?: Record<string, unknown>; words: RunTaskWords }): { report: HealthReport; task: Task } {
  return tree.withTreeLock(() => {
    const running = liveRun(tree, o.scope);
    if (running) throw new UsageError(`a tree check of this scope is not done yet: ${running.id} (task ${running.task})`, { code: "health.running", params: { id: running.id, task: running.task ?? "" }, hint: "strom health show " + running.id });
    const id = nextId(tree);
    const at = now();
    const scopePeople = o.scope.kind === "person" ? [o.scope.id] : [];
    const task = create<Task>(
      tree,
      "task",
      {
        level: "enrich",
        priority: 4,
        what: o.words.what(id).slice(0, 200),
        where: [o.words.where.slice(0, 500)],
        why: o.words.why.slice(0, 1000),
        doneWhen: o.words.doneWhen.slice(0, 500),
        subject: scopePeople,
        ...(o.scope.kind === "line" ? { research: o.scope.id } : {}),
        state: "open",
        origin: `${HEALTH_ORIGIN}${id}`,
        queueAt: { do: "next", at },
        asked: at,
      },
      (t) => `+${t} task "tree check ${id}" (${o.ai.join(",")}, ${scopeText(o.scope)})`,
    );
    const head = git.head(tree.root);
    const report: HealthReport = {
      id,
      at,
      scope: o.scope,
      ai: [...o.ai],
      ...(o.changed ? { changed: true } : {}),
      ...(o.changed && o.since ? { since: o.since } : {}),
      ...(head ? { head } : {}),
      task: task.id,
      ...(o.builtin ? { builtin: o.builtin } : {}),
      checked: [],
      findings: [],
      lang: tree.lang,
    };
    writeReport(tree, report, "health.run", `tree check ${id} asked: ${o.ai.join(",")} (${scopeText(o.scope)}), task ${task.id}`);
    return { report, task };
  });
}

/** The report of the session at work (its task an AI check's), or why not (audit.no-run). */
export function reportOfSession(tree: Tree, session: Session | undefined): HealthReport {
  const task = session?.task ? tree.get<Task>(session.task) : undefined;
  const id = reportOfTask(task);
  const r = id ? readReport(tree, id) : undefined;
  if (!r) throw new UsageError("findings of the tree check are written only in a session of its task (origin health:C…)", { code: "audit.no-run", hint: "strom task list — the task \"tree check\" (strom session start T…)" });
  return r;
}

export interface FindingAsk {
  type: AuditType;
  code: string;
  records: string[];
  what: string;
  fix: string;
  proof: AuditProof[];
  severity?: StoredFinding["severity"];
  suggestOnly?: boolean;
  minutes?: [number, number];
  level?: Task["level"];
}

const text = (raw: string, name: string, max = TEXT_MAX): string => {
  const t = raw.normalize("NFC").replace(/\s+/gu, " ").trim();
  if (!t) throw new UsageError(`${name}: a sentence`, { code: "audit.body" });
  if (Array.from(t).length > max) throw new UsageError(`${name}: at most ${max} characters (one sentence)`, { code: "audit.body" });
  return t;
};

/** A record a finding names, as the research has it (an event's E… taken as written), or why not. */
function recordOf(tree: Tree, raw: string): string {
  const id = raw.trim().toUpperCase();
  if (!RECORD.test(id)) throw new UsageError(`not a record's ID: ${raw.slice(0, 40)}`, { code: "audit.body", hint: "P…, S…, L…, I…, H…, T…, B…, Q…, K…, F…, X…, A…, E…" });
  if (id.startsWith("E")) return id;
  if (!typeOfId(id)) throw new UsageError(`not a record's ID: ${id}`, { code: "audit.body" });
  if (!tree.get(id)) throw new UsageError(`no record ${id} in the research`, { code: "audit.body" });
  return id;
}

/** A finding written by the agent of the check (strom audit add): its id, whether it was new, or refused. */
export function addFinding(tree: Tree, session: Session | undefined, ask: FindingAsk): { report: HealthReport; finding: StoredFinding; replaced: boolean } {
  return tree.withTreeLock(() => {
    const r = reportOfSession(tree, session);
    if (!r.ai.includes(ask.type)) throw new UsageError(`the check ${ask.type} was not asked for in ${r.id} (${r.ai.join(",")})`, { code: "audit.type" });
    if (!CODE.test(ask.code)) throw new UsageError("--code: the kind of problem in a word or a few joined by - (lower case, at most 40)", { code: "audit.body", hint: "--code story-no-facts" });
    const records = [...new Set(ask.records.map((x) => recordOf(tree, x)))];
    if (!records.length || records.length > RECORDS_MAX) throw new UsageError(`--record: 1–${RECORDS_MAX} records the finding is of`, { code: "audit.body" });
    if (!ask.proof.length || ask.proof.length > PROOFS_MAX) throw new UsageError(`--proof: 1–${PROOFS_MAX} records with what they say word for word (ID:"quote")`, { code: "audit.body" });
    const proof = ask.proof.map((p) => ({ id: recordOf(tree, p.id), ...(p.quote ? { quote: text(p.quote, "a quote", QUOTE_MAX) } : {}) }));
    const id = findingId(ask.type, records, ask.code);
    const decided = readAudit(tree).decisions.find((d) => d.id === id);
    if (decided?.state === "dismissed") throw new UsageError(`${id}: the user dismissed this finding (${decided.at.slice(0, 10)}) — never reported again`, { code: "audit.dismissed", params: { id } });
    if (decided?.state === "accepted") throw new UsageError(`${id}: accepted already — its task ${decided.task ?? "?"} sets it right`, { code: "audit.accepted", params: { id, task: decided.task ?? "" } });
    const findings = r.findings ?? [];
    const had = findings.findIndex((f) => f.id === id);
    if (had < 0 && findings.length >= AUDIT_MAX) throw new UsageError(`${AUDIT_MAX} findings are the most a run reports: write the summary and close the task`, { code: "audit.limit" });
    if (ask.level && !(TASK_LEVELS as readonly string[]).includes(ask.level)) throw new UsageError(`--level: ${TASK_LEVELS.join(", ")}`, { code: "audit.body" });
    if (ask.minutes && !(ask.minutes[0] >= 0 && ask.minutes[1] >= ask.minutes[0] && ask.minutes[1] <= 600)) throw new UsageError("--minutes: 5-15 (the least and the most, at most 600)", { code: "audit.body" });
    const lang = r.lang;
    const finding: StoredFinding = {
      id,
      type: ask.type,
      code: ask.code,
      severity: ask.severity ?? "warning",
      records,
      what: { [lang]: text(ask.what, "--what") },
      fix: { [lang]: text(ask.fix, "--fix") },
      proof,
      ...(ask.suggestOnly ? { suggestOnly: true } : {}),
      ...(ask.minutes ? { estimate: { minutes: ask.minutes } } : {}),
      level: ask.level ?? LEVEL_OF[ask.type],
      at: now(),
    };
    const next = had >= 0 ? findings.map((f, i) => (i === had ? finding : f)) : [...findings, finding];
    const report = { ...r, findings: next };
    writeReport(tree, report, "audit.add", `${r.id}: ${had >= 0 ? "finding written again" : "finding"} ${id} (${ask.type} ${records.slice(0, 3).join(" ")}${records.length > 3 ? " …" : ""})`);
    return { report, finding, replaced: had >= 0 };
  });
}

/** An AI check gone through (strom audit checked G). */
export function markChecked(tree: Tree, session: Session | undefined, type: AuditType): HealthReport {
  return tree.withTreeLock(() => {
    const r = reportOfSession(tree, session);
    if (!r.ai.includes(type)) throw new UsageError(`the check ${type} was not asked for in ${r.id} (${r.ai.join(",")})`, { code: "audit.type" });
    if ((r.checked ?? []).includes(type)) return r;
    const report = { ...r, checked: AUDIT_TYPES.filter((t) => t === type || (r.checked ?? []).includes(t)) };
    writeReport(tree, report, "audit.checked", `${r.id}: check ${type} gone through`);
    return report;
  });
}

/** The run's summary in a sentence, and the order of the steps with why (K6.10): the agent's, at the end of its check. */
export function setSummary(tree: Tree, session: Session | undefined, o: { summary?: string; order?: { kind: string; subject?: string; why: string } }): HealthReport {
  return tree.withTreeLock(() => {
    const r = reportOfSession(tree, session);
    const lang = r.lang;
    let report = { ...r };
    if (o.summary !== undefined) report.summary = { [lang]: text(o.summary, "the summary", 500) };
    if (o.order) {
      const kind = o.order.kind.trim();
      if (!/^[\p{Ll}-]{1,30}$/u.test(kind)) throw new UsageError("the step's kind: line-stuck, sent-old, decide, queue-empty, fix, verify-line, edge, material, check, or a finding's id", { code: "audit.body" });
      const was = (r.order ?? []).filter((x) => !(x.kind === kind && x.subject === o.order!.subject));
      if (was.length >= ORDER_MAX) throw new UsageError(`at most ${ORDER_MAX} steps`, { code: "audit.limit" });
      report = { ...report, order: [...was, { kind, ...(o.order.subject ? { subject: o.order.subject } : {}), why: { [lang]: text(o.order.why, "--why") } }] };
    }
    writeReport(tree, report, "audit.summary", `${r.id}: ${o.order ? `step ${o.order.kind}${o.order.subject ? ` ${o.order.subject}` : ""}` : "summary"}`);
    return report;
  });
}

/** Where a finding is: its report (the newest that has it). */
export function findFinding(tree: Tree, id: string): { report: HealthReport; finding: StoredFinding } | undefined {
  for (const r of listReports(tree, Infinity)) {
    const f = r.findings?.find((x) => x.id === id);
    if (f) return { report: r, finding: f };
  }
  return undefined;
}

export type DecideDo = "accept" | "dismiss" | "undo";

/**
 * The person's decisions on findings (strom audit accept|dismiss|undo, POST /audit): all or none, one commit. Accepted:
 * a task of the queue (its records about, done when the fix is), suggest-only said so; dismissed: never reported again;
 * undo: new again — an accepted one's task dropped while it has not started (else audit.started).
 */
export function decide(tree: Tree, ids: string[], how: DecideDo, by: "app" | "research", taskWords: (f: StoredFinding, lang: string) => { what: string; why: string; doneWhen: string; where: string }): { id: string; changed: boolean }[] {
  return tree.withTreeLock(() => {
    const file = readAudit(tree);
    const decisions = new Map(file.decisions.map((d) => [d.id, d]));
    const asked = [...new Set(ids)];
    if (!asked.length) throw new UsageError("which findings: their ids (strom audit list)", { code: "audit.body" });
    const found = asked.map((id) => {
      if (!isFindingId(id)) throw new UsageError(`not a finding's id: ${String(id).slice(0, 40)}`, { code: "audit.body" });
      const at = findFinding(tree, id);
      if (!at) throw new UsageError(`no finding ${id}`, { code: "audit.unknown", params: { id }, hint: "strom audit list" });
      return at;
    });
    // checked all first: nothing written while one is refused
    for (const { finding } of found) {
      const d = decisions.get(finding.id);
      if (how === "undo" && d?.state === "accepted" && d.task && started(tree, tree.get<Task>(d.task)))
        throw new UsageError(`${finding.id}: its task ${d.task} has started — taken back only by dropping the task (strom task drop ${d.task})`, { code: "audit.started", params: { id: finding.id, task: d.task } });
    }
    const out: { id: string; changed: boolean }[] = [];
    const scopeAll = scopes(tree);
    for (const { report, finding } of found) {
      const d = decisions.get(finding.id);
      if (how === "undo") {
        if (!d) {
          out.push({ id: finding.id, changed: false });
          continue;
        }
        if (d.state === "accepted" && d.task) {
          const t = tree.get<Task>(d.task);
          if (t && t.state === "open")
            update<Task>(tree, t.id, "task", (x) => ({ ...x, state: "dropped", result: `the finding ${finding.id} taken back by the user` }), { op: "task.drop", summary: `${t.id} dropped: the finding ${finding.id} taken back` });
        }
        decisions.delete(finding.id);
        out.push({ id: finding.id, changed: true });
        continue;
      }
      const state = how === "accept" ? "accepted" : "dismissed";
      if (d?.state === state) {
        out.push({ id: finding.id, changed: false });
        continue;
      }
      if (d?.state === "accepted" && d.task && how === "dismiss") {
        const t = tree.get<Task>(d.task);
        if (t && started(tree, t)) throw new UsageError(`${finding.id}: its task ${d.task} has started`, { code: "audit.started", params: { id: finding.id, task: d.task } });
        if (t && t.state === "open") update<Task>(tree, t.id, "task", (x) => ({ ...x, state: "dropped", result: `the finding ${finding.id} dismissed by the user` }), { op: "task.drop", summary: `${t.id} dropped: the finding ${finding.id} dismissed` });
      }
      let task: string | undefined;
      if (how === "accept") {
        const words = taskWords(finding, tree.lang);
        const subject = finding.records.filter((r) => typeOfId(r) && !!tree.get(r) && !tree.get(r)!.mergedInto && !tree.get(r)!.retracted);
        const research = report.scope.kind === "line" ? report.scope.id : directionOf(tree, { subject }, scopeAll.filter((s) => s.research.state === "active"));
        task = create<Task>(
          tree,
          "task",
          {
            level: finding.level,
            priority: finding.severity === "error" ? 4 : 3,
            what: words.what.slice(0, 200),
            where: [words.where.slice(0, 500)],
            why: words.why.slice(0, 1000),
            doneWhen: words.doneWhen.slice(0, 500),
            subject,
            ...(research ? { research } : {}),
            state: "open",
            origin: `${AUDIT_ORIGIN}${finding.id}`,
            asked: now(),
          },
          (t) => `+${t} task of the finding ${finding.id} (${finding.type})`,
        ).id;
      }
      decisions.set(finding.id, { id: finding.id, state, at: now(), by, run: report.id, ...(task ? { task } : {}), type: finding.type, records: finding.records });
      out.push({ id: finding.id, changed: true });
    }
    if (out.some((o) => o.changed)) writeAudit(tree, { decisions: [...decisions.values()] }, `findings ${how === "accept" ? "accepted" : how === "dismiss" ? "dismissed" : "taken back"}: ${out.filter((o) => o.changed).map((o) => o.id).join(" ")}`);
    return out;
  });
}

/**
 * The person asks a run to stop (strom health stop, POST /health/stop): queued — its task put aside; at work — the
 * report says so (its session is asked to finish by the caller; what it found stays).
 */
export function stopRun(tree: Tree, id?: string): { report: HealthReport; was: RunState; session?: string } {
  return tree.withTreeLock(() => {
    const r = id ? readReport(tree, id) : liveRun(tree);
    if (!r || !r.ai.length) throw new UsageError(id ? `no tree check ${id} of the AI` : "no tree check of the AI is queued or at work", { code: "health.none" });
    const was = runState(tree, r);
    if (was !== "queued" && was !== "running") throw new UsageError(`${r.id} is ${was}: nothing to stop`, { code: "health.none", params: { id: r.id, state: was } });
    const stopped = now();
    const report = { ...r, stopped };
    writeReport(tree, report, "health.stop", `tree check ${r.id} stopped by the user`);
    const t = r.task ? tree.get<Task>(r.task) : undefined;
    if (t && was === "queued" && t.state === "open") {
      const { queueAt: _q, ...rest } = t;
      update<Task>(tree, t.id, "task", () => ({ ...rest, state: "parked", parkedReason: "the tree check stopped by the user" }) as Task, { op: "task.park", summary: `${t.id} put aside: the tree check stopped` });
    }
    const session = was === "running" ? tree.list<Session>("session").find((s) => s.state === "open" && s.task === r.task)?.id : undefined;
    return { report, was, ...(session ? { session } : {}) };
  });
}

/** The decisions by finding id. */
export const decisionsOf = (tree: Tree): Map<string, Decision> => new Map(readAudit(tree).decisions.map((d) => [d.id, d]));

/** The ids the person dismissed: the brief names them (never reported again). */
export function dismissedIds(tree: Tree): Decision[] {
  return readAudit(tree).decisions.filter((d) => d.state === "dismissed");
}
