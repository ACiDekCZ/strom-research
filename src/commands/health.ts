// strom health: the tree check (spec 091) — its built-in part (free, no agent, nothing written), the AI checks asked
// as a task first in the queue (strom health --ai), the reports (strom health list|show|stop). strom audit …: the AI's
// findings — written only by the agent of the check's task, in its session (add, checked, summary, order); accepted,
// dismissed or taken back only by the person (accept, dismiss, undo — here in the terminal, or the Strom app through
// the bridge), never by an agent. Nothing of the tree changes by a finding: an accepted one is a task of the queue.

import { register, type CommandDef } from "../cli/registry.ts";
import type { Context } from "../cli/context.ts";
import { lines } from "../cli/format.ts";
import { UsageError } from "../core/errors.ts";
import { Settings } from "../core/config.ts";
import { displayName } from "../core/people.ts";
import { phrase } from "../core/phrases.ts";
import { currentSession } from "../core/session.ts";
import { actsAsArchive } from "../core/state.ts";
import { isDemo } from "../core/mode.ts";
import type { Person, Research } from "../core/model.ts";
import type { Tree } from "../core/tree.ts";
import {
  addFinding,
  AUDIT_MAX,
  AUDIT_TYPES,
  decide,
  decisionsOf,
  findingView,
  healthRev,
  isAuditType,
  isReportId,
  listReports,
  markChecked,
  readReport,
  runInfo,
  saveBuiltin,
  scopeOf,
  scopeText,
  SEVERITIES,
  setSummary,
  startRun,
  stopRun,
  type AuditProof,
  type AuditType,
  type DecideDo,
  type HealthReport,
  type HealthScope,
  type RunInfo,
  type StoredFinding,
} from "../core/audit.ts";
import { aiOf, AUDIT_CATALOG, builtin, changedOf, estimate, scopePeople, type FixSeen, type HealthBuiltin } from "../core/health.ts";
import { askFinish } from "../core/clock.ts";

const PERSON = "Accepting or dismissing a finding of the tree check is the person's own decision (in the Strom app, or in their terminal): never an agent's";
const STOP = "Stopping a tree check is the person's own (in the Strom app, or in their terminal)";

/** The scope as the research's language names it (the task's words). */
function scopeWords(tree: Tree, s: HealthScope): string {
  const lang = tree.lang;
  if (s.kind === "tree") return phrase(lang, "health.scope.tree");
  if (s.kind === "line") return phrase(lang, "health.scope.line", { name: tree.get<Research>(s.id)?.name ?? s.id });
  const p = tree.get<Person>(s.id);
  return phrase(lang, "health.scope.person", { name: p ? `${displayName(p)} (${s.id})` : s.id });
}

const checksWords = (lang: string, ai: AuditType[]) => ai.map((t) => `${t} ${phrase(lang, `audit.type.${t}`)}`).join(", ");

/** The words of an accepted finding's task (the research's language: the finding's own texts are in it). */
export function findingTaskWords(f: StoredFinding, lang: string, run: string): { what: string; why: string; doneWhen: string; where: string } {
  const what = f.what[lang] ?? Object.values(f.what)[0] ?? f.code;
  const fix = f.fix[lang] ?? Object.values(f.fix)[0] ?? f.code;
  return {
    what: fix,
    why: phrase(lang, "audit.why", { run, check: `${f.type} ${phrase(lang, `audit.type.${f.type}`)}`, what }),
    doneWhen: f.suggestOnly ? phrase(lang, "audit.done.suggest", { fix }) : fix,
    where: phrase(lang, "audit.where", { records: f.records.join(", ") }),
  };
}

/** strom's fixes, as the built-in part takes them (free: no agent, no network, nothing written). */
async function fixesSeen(tree: Tree, ctx: Context): Promise<FixSeen[]> {
  try {
    const m = await import("./fixchecks.ts");
    return m.fixesForApp(tree, new Settings(ctx.env, {}), ctx.env, { archive: actsAsArchive(tree) }).fixes.map((f) => ({ id: f.id, count: f.count, state: f.state, ...(f.cost ? { cost: f.cost } : {}), paid: f.paid }));
  } catch {
    return [];
  }
}

const said = (x: Record<string, string> | undefined, lang: string) => (x ? (x[lang] ?? Object.values(x)[0] ?? "") : "");

/** The built-in part, as the terminal shows it (compact: one line a part, nothing said where nothing is). */
export function builtinLines(b: HealthBuiltin): string[] {
  const out: string[] = [];
  out.push(`check: ${b.check.ok ? "ok" : "PROBLEM"}${b.check.errors ? ` · ${b.check.errors} error(s)` : ""}${b.check.warnings ? ` · ${b.check.warnings} warning(s)` : ""}${b.check.unproven ? ` · ${b.check.unproven} people without a record that proves them` : ""}${b.check.ok ? "" : " (strom check)"}`);
  const g = b.growth;
  out.push(`grew in ${g.days} days: +${g.persons} people, +${g.facts} facts, +${g.sources} sources${g.agentLast ? ` · the agent last worked ${g.agentLast.slice(0, 10)}` : ""}`);
  if (b.lines.length) out.push(`lines: ${b.lines.map((l) => `${l.id} ${l.name} (${l.state}${l.state === "active" ? `, ${l.tasks} queued${l.waiting ? `, ${l.waiting} waiting` : ""}${l.stuck ? ", STUCK" : ""}` : ""})`).join("; ")}`);
  if (b.lines.length || b.queue.open || b.queue.parked) out.push(`queue: ${b.queue.open} open, ${b.queue.parked} put aside${b.queue.empty ? " — EMPTY" : ""}`);
  if (b.sentOld.length) out.push(`sent with no reply for long: ${b.sentOld.slice(0, 5).map((s) => `${s.id} (${s.days} days)`).join(", ")}${b.sentOld.length > 5 ? ` and ${b.sentOld.length - 5} more` : ""}`);
  const decide = Object.entries(b.decide);
  if (decide.length) out.push(`waits for a decision: ${decide.map(([k, n]) => `${k} ${n}`).join(", ")}`);
  if (b.fixes.length) out.push(`fixes waiting: ${b.fixes.map((f) => `${f.id} ${f.count}${f.cost ? ` (${f.cost})` : ""}`).join(", ")} (strom fixes)`);
  if (b.verify.waiting) out.push(`verification waiting: ${b.verify.waiting} facts${Object.keys(b.verify.byLine).length ? ` (${Object.entries(b.verify.byLine).map(([g, v]) => `${g}: ${v.facts} of ${v.people} people`).join(", ")})` : ""}`);
  if (b.edges.unsearched) out.push(`edges unsearched: ${b.edges.unsearched} (${b.edges.people.slice(0, 8).join(" ")}${b.edges.unsearched > 8 ? " …" : ""}; strom edge)`);
  if (b.material.unlinked || b.batches.open) out.push(`material: ${b.material.unlinked} waiting to be sorted${b.batches.open ? ` · ${b.batches.open} batch(es) open, ${b.batches.unsorted} files unsorted` : ""}`);
  if (b.tasksAudit) out.push(`task waits not as strom needs them: ${b.tasksAudit} (strom task audit)`);
  if (b.citations.noPage || b.citations.noImage) out.push(`citations of originals: ${b.citations.noPage} without a page, ${b.citations.noImage} without an image`);
  if (b.steps.length) out.push("next steps:", ...b.steps.map((s, i) => `  ${i + 1}. ${s.kind}${s.subject ? ` ${s.subject}` : ""}${s.count !== undefined ? ` (${s.count})` : ""} → ${s.action}`));
  return out;
}

function runLine(r: RunInfo, lang: string): string {
  const what = r.ai.length ? `AI ${r.ai.join(",")}` : "built-in";
  const progress = r.total ? ` · ${r.done}/${r.total} checked, ${r.findings} finding(s)` : "";
  const counts = r.ai.length ? ` · new ${r.counts.new}, accepted ${r.counts.accepted}, dismissed ${r.counts.dismissed}` : "";
  return `${r.id}  ${r.at.slice(0, 16).replace("T", " ")}  ${what} · ${scopeText(r.scope)} · ${r.state}${r.task ? ` (${r.task})` : ""}${progress}${counts}${r.reason ? ` — ${r.reason}` : ""}${r.summary ? `\n    ${said(r.summary, lang)}` : ""}`;
}

function findingLine(f: ReturnType<typeof findingView>): string {
  return `${f.id}  ${f.type} ${f.severity} · ${f.records.join(" ")} · ${f.state}${f.task ? ` (${f.task}${f.taskStarted ? ", started" : ""})` : ""}\n    ${said(f.what, f.lang)}\n    → ${said(f.fix, f.lang)}${f.suggestOnly ? " (proposed only)" : ""}`;
}

/** The proofs as given: ID or ID:"what it says word for word". */
function proofsOf(raw: unknown): AuditProof[] {
  const items = (Array.isArray(raw) ? raw : raw === undefined ? [] : [raw]).map(String);
  return items.map((p) => {
    const at = p.indexOf(":");
    if (at < 0) return { id: p.trim() };
    const quote = p.slice(at + 1).trim().replace(/^["„“”']|["„“”']$/gu, "");
    return { id: p.slice(0, at).trim(), ...(quote ? { quote } : {}) };
  });
}

const listOf = (raw: unknown): string[] =>
  (Array.isArray(raw) ? raw : raw === undefined ? [] : [raw])
    .flatMap((x) => String(x).split(/[,\s]+/u))
    .map((x) => x.trim())
    .filter(Boolean);

const byOf = (ctx: Context): "app" | "research" => (ctx.env.STROM_FOR_APP === "1" ? "app" : "research");

const CATALOG_TEXT =
  "AI checks (--ai): " +
  AUDIT_TYPES.map((t) => `${t} ${phrase("en", `audit.type.${t}`)}${AUDIT_CATALOG[t].heavy ? " (heavy, off by default)" : ""}${AUDIT_CATALOG[t].houses ? " (with houses on)" : ""}`).join("; ") +
  ". default = G,A,B,C,D,H,I and L with houses on; all = A–L; none = the built-in part alone.";

register(
  {
    path: ["health"],
    summary: "The tree check: what strom knows of the research's state and what to do next (read only); --ai asks the AI checks",
    group: "analysis",
    tree: true,
    writes: true,
    writesWith: (input) => !input.opts.dry && (input.opts.save === true || (typeof input.opts.ai === "string" && aiOf(input.opts.ai, false).length > 0)),
    description:
      "Without --ai: the built-in checks — strom check's state, what the tree grew by in 30 days, the lines and the queue, requests sent long ago, " +
      "what waits for the person's decision, strom's fixes, verification by line, edges unsearched, the material, task waits, citations — and the steps it recommends; nothing written " +
      "(--save keeps it as a report C…). With --ai: a task of the AI checks first in the queue (the next session does it; it reads and proposes, never changes the tree) and its report C…; " +
      `--dry only says what it would take. ${CATALOG_TEXT} At most ${AUDIT_MAX} findings a run. --changed: only what changed since the last AI check of the same scope.`,
    options: [
      { name: "ai", type: "string", value: "<G,A,…|default|all|none>", description: "the AI checks to ask for (a task first in the queue)" },
      { name: "scope", type: "string", value: "<tree|line:G…|person:P…>", description: "what is checked (default: the whole tree)" },
      { name: "changed", type: "boolean", description: "the AI checks only of what changed since the last one of the same scope" },
      { name: "dry", type: "boolean", description: "with --ai: only what it would take (minutes, sessions, cost), nothing written" },
      { name: "save", type: "boolean", description: "keep the built-in part as a report C… (strom health list)" },
    ],
    examples: ["strom health", "strom health --json", "strom health --scope line:G0001", "strom health --ai default --dry", "strom health --ai G,A --scope person:P0001", "strom health --save"],
    async run(ctx, { opts }) {
      const tree = ctx.tree();
      const settings = new Settings(ctx.env, {});
      const scope = scopeOf(tree, opts.scope);
      let ai: AuditType[];
      try {
        ai = aiOf(typeof opts.ai === "string" ? opts.ai : undefined, settings.houses(tree.config));
      } catch (e) {
        throw new UsageError(`--ai: ${(e as { unknownCheck?: string }).unknownCheck ?? ""} is no check — ${AUDIT_TYPES.join(", ")}, default, all, none`, { code: "health.body" });
      }
      if (typeof opts.ai === "string" && !ai.length && opts.ai.trim().toLowerCase() !== "none") throw new UsageError("--ai: which checks (G,A,… default, all)", { code: "health.body" });
      if (opts.changed && !ai.length) throw new UsageError("--changed goes with --ai", { code: "health.body" });
      const fixes = await fixesSeen(tree, ctx);
      const b = builtin(tree, ctx.env, { scope, fixes });
      if (!ai.length) {
        const saved = opts.save && !opts.dry ? saveBuiltin(tree, scope, b as unknown as Record<string, unknown>) : undefined;
        return {
          text: lines(`tree check · ${scopeText(scope)} · ${b.head.slice(0, 7) || "no commit yet"}`, ...builtinLines(b), saved ? `saved: ${saved.id}` : actsAsArchive(tree) || isDemo(tree.config) ? undefined : "the AI checks: strom health --ai default --dry (what they take), strom health --ai default"),
          data: { scope, builtin: b, ...(saved ? { id: saved.id } : {}) },
        };
      }
      if (actsAsArchive(tree) || isDemo(tree.config)) throw new UsageError("an archive (or a research without its agent here) is not checked by the AI: nobody researches it", { code: "health.archive" });
      const changed = opts.changed ? changedOf(tree, scope) : {};
      const people = opts.changed && changed.records ? changed.records.length : scopePeople(tree, scope).length;
      const est = estimate(tree, settings, ai, people);
      if (opts.dry) {
        return {
          text: lines(
            `the AI checks ${ai.join(",")} of ${scopeText(scope)}${opts.changed ? (changed.records ? ` (what changed since ${changed.report}: ${changed.records.length} records)` : " (no AI check of this scope before: all of it)") : ""}: about ${est.total.minutes[0]}–${est.total.minutes[1]} min, ${est.total.sessions} session(s)${est.total.usd !== undefined ? `, about $${est.total.usd}` : ""}`,
            ...ai.map((t) => `  ${t} ${phrase("en", `audit.type.${t}`)}: ${est.byType[t]!.minutes[0]}–${est.byType[t]!.minutes[1]} min`),
            est.large ? `a large scope (${est.people} people): --changed, or a line's scope` : undefined,
          ),
          data: { estimate: est, ...(opts.changed ? { changed } : {}) },
        };
      }
      const lang = tree.lang;
      const where = scopeWords(tree, scope);
      const { report, task } = startRun(tree, {
        scope,
        ai,
        changed: !!opts.changed,
        ...(changed.since ? { since: changed.since } : {}),
        builtin: b as unknown as Record<string, unknown>,
        words: {
          what: (id) => phrase(lang, "health.what", { id, checks: ai.join(", ") }),
          why: changed.report ? phrase(lang, "health.why.changed", { checks: checksWords(lang, ai), scope: where, since: changed.report }) : phrase(lang, "health.why", { checks: checksWords(lang, ai), scope: where }),
          doneWhen: phrase(lang, "health.done"),
          where: phrase(lang, "health.where", { scope: where }),
        },
      });
      return {
        text: lines(`${report.id}: the AI checks ${ai.join(",")} of ${scopeText(scope)} — task ${task.id} first in the queue (the next session does it)`, `about ${est.total.minutes[0]}–${est.total.minutes[1]} min, ${est.total.sessions} session(s)${est.total.usd !== undefined ? `, about $${est.total.usd}` : ""}`),
        data: { id: report.id, task: task.id, head: report.head ?? "", estimate: est },
      };
    },
  },
  {
    path: ["health", "list"],
    summary: "The tree check's reports, newest first",
    group: "analysis",
    tree: true,
    options: [{ name: "all", type: "boolean", description: "every report (else the newest 10)" }],
    examples: ["strom health list", "strom health list --json"],
    run(ctx, { opts }) {
      const tree = ctx.tree();
      const decisions = decisionsOf(tree);
      const reports = listReports(tree, opts.all ? Infinity : undefined).map((r) => runInfo(tree, r, { decisions }));
      return { text: lines(reports.length ? undefined : "no report yet (strom health --save, strom health --ai default)", ...reports.map((r) => runLine(r, tree.lang))), data: { reports } };
    },
  },
  {
    path: ["health", "show"],
    summary: "One report of the tree check: its state, the built-in part then, the AI's findings",
    group: "analysis",
    tree: true,
    args: [{ name: "report", description: "the report (C…)", required: true }],
    examples: ["strom health show C0001", "strom health show C0001 --json"],
    run(ctx, { args }) {
      const tree = ctx.tree();
      const r = reportOr(tree, args[0]);
      const decisions = decisionsOf(tree);
      const info = runInfo(tree, r, { builtin: true, decisions });
      const findings = (r.findings ?? []).map((f) => findingView(tree, r, f, decisions));
      const b = r.builtin as HealthBuiltin | undefined;
      return {
        text: lines(
          runLine(info, tree.lang),
          ...(info.order ?? []).map((o, i) => `  ${i + 1}. ${o.kind}${o.subject ? ` ${o.subject}` : ""}: ${said(o.why, info.lang)}`),
          ...findings.map(findingLine),
          b && b.check ? "the built-in part then:" : undefined,
          ...(b && b.check ? builtinLines(b).map((l) => `  ${l}`) : []),
        ),
        data: { report: info, findings },
      };
    },
  },
  {
    path: ["health", "stop"],
    summary: "Stop the tree check of the AI: queued, its task is put aside; at work, its session is asked to finish (what it found stays)",
    group: "analysis",
    tree: true,
    writes: true,
    person: STOP,
    args: [{ name: "report", description: "the report (C…); default: the one queued or at work" }],
    examples: ["strom health stop", "strom health stop C0002"],
    run(ctx, { args }) {
      const tree = ctx.tree();
      const r = stopRun(tree, args[0] ? reportOr(tree, args[0]).id : undefined);
      if (r.session) askFinish(tree.root, r.session, "user", "the tree check stopped");
      const state = r.was === "queued" ? "stopped" : "running";
      return { text: r.was === "queued" ? `${r.report.id} stopped: its task ${r.report.task} put aside` : `${r.report.id}: its session ${r.session ?? ""} asked to finish — what it found stays`, data: { ok: true, id: r.report.id, state } };
    },
  },
  {
    path: ["audit", "list"],
    summary: "The AI's findings of the tree check: new, accepted (their task), dismissed",
    group: "analysis",
    tree: true,
    options: [
      { name: "run", type: "string", value: "<C…>", description: "of one report (default: every report)" },
      { name: "state", type: "string", value: "<new|accepted|dismissed>", description: "only so decided" },
    ],
    examples: ["strom audit list", "strom audit list --state new --json", "strom audit list --run C0002"],
    run(ctx, { opts }) {
      const tree = ctx.tree();
      const state = opts.state;
      if (state !== undefined && !["new", "accepted", "dismissed"].includes(String(state))) throw new UsageError("--state: new, accepted or dismissed", { code: "audit.body" });
      const decisions = decisionsOf(tree);
      const reports = typeof opts.run === "string" ? [reportOr(tree, opts.run)] : listReports(tree, Infinity);
      const seen = new Set<string>();
      const findings = reports
        .flatMap((r) => (r.findings ?? []).map((f) => findingView(tree, r, f, decisions)))
        .filter((f) => (seen.has(f.id) ? false : (seen.add(f.id), true)))
        .filter((f) => !state || f.state === state);
      return { text: lines(findings.length ? undefined : "no finding", ...findings.map(findingLine)), data: { findings } };
    },
  },
  {
    path: ["audit", "add"],
    summary: "Write a finding of the tree check (the agent of its task, in its session): what is wrong, the fix proposed, its proof",
    group: "analysis",
    tree: true,
    writes: true,
    description:
      `Only in a session of the task of the tree check (origin health:C…; else audit.no-run), only of a check it asked for, at most ${AUDIT_MAX} a run (audit.limit). ` +
      "Read only: a finding changes nothing — the user accepts it (a task of the queue) or dismisses it (never reported again: audit.dismissed). " +
      "Its id is the same across runs: the type, the records and --code (the kind of problem in words joined by -, never the text). Written again with the same id: replaced. " +
      "--what and --fix one sentence each in the research's language; --proof each record that shows it, with what it says word for word (ID:\"quote\"). " +
      "--suggest-only: the user's values or the family tree's (spec 066) — only proposed, never changed.",
    options: [
      { name: "type", type: "string", value: "<A–L>", description: "the check" },
      { name: "code", type: "string", value: "<kind-of-problem>", description: "the kind of problem (lower case, digits, -; at most 40)" },
      { name: "record", type: "string", value: "<P…[,S…]>", description: "the records it is of (1–20)", multiple: true },
      { name: "what", type: "string", value: "<sentence>", description: "what is wrong" },
      { name: "fix", type: "string", value: "<sentence>", description: "the fix proposed (the task's done-when once accepted)" },
      { name: "proof", type: "string", value: '<ID[:"quote"]>', description: "a record that shows it, with what it says (1–10)", multiple: true },
      { name: "severity", type: "string", value: "<error|warning|info>", description: "how bad (default warning)" },
      { name: "suggest-only", type: "boolean", description: "the user's or the family tree's values: only proposed" },
      { name: "minutes", type: "string", value: "<5-15>", description: "what setting it right would take an agent" },
      { name: "level", type: "string", value: "<level>", description: "the level of its task once accepted (default by the check)" },
    ],
    examples: [
      'strom audit add --type A --code story-no-facts --record P0001 --what "The story rests on no fact." --fix "Attach the facts the story tells." --proof P0001:"born 1850 in Lhota"',
      'strom audit add --type G --code next-source --record P0004 --what "The line ends at the baptism of 1801." --fix "Search the baptisms of Lhota 1770–1801." --proof P0004 --minutes 10-20',
    ],
    run(ctx, { opts }) {
      const tree = ctx.tree();
      const type = String(opts.type ?? "").trim().toUpperCase();
      if (!isAuditType(type)) throw new UsageError(`--type: ${AUDIT_TYPES.join(", ")}`, { code: "audit.body" });
      const severity = opts.severity === undefined ? undefined : String(opts.severity);
      if (severity !== undefined && !(SEVERITIES as readonly string[]).includes(severity)) throw new UsageError("--severity: error, warning or info", { code: "audit.body" });
      let minutes: [number, number] | undefined;
      if (opts.minutes !== undefined) {
        const m = /^(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?$/u.exec(String(opts.minutes).trim());
        if (!m) throw new UsageError("--minutes: 5-15", { code: "audit.body" });
        minutes = [Number(m[1]), Number(m[2] ?? m[1])];
      }
      const r = addFinding(tree, currentSession(tree, ctx.env, ctx.refs), {
        type,
        code: String(opts.code ?? "").trim(),
        records: listOf(opts.record),
        what: String(opts.what ?? ""),
        fix: String(opts.fix ?? ""),
        proof: proofsOf(opts.proof),
        ...(severity ? { severity: severity as StoredFinding["severity"] } : {}),
        ...(opts["suggest-only"] ? { suggestOnly: true } : {}),
        ...(minutes ? { minutes } : {}),
        ...(typeof opts.level === "string" ? { level: opts.level as StoredFinding["level"] } : {}),
      });
      const n = r.report.findings?.length ?? 0;
      return { text: `${r.finding.id} ${r.replaced ? "written again" : "written"} (${n}/${AUDIT_MAX} in ${r.report.id})`, data: { id: r.finding.id, replaced: r.replaced, run: r.report.id, findings: n, max: AUDIT_MAX } };
    },
  },
  {
    path: ["audit", "checked"],
    summary: "Say a check of the tree check gone through (the agent of its task, in its session)",
    group: "analysis",
    tree: true,
    writes: true,
    args: [{ name: "type", description: "the check (A–L), or several", required: true, variadic: true }],
    examples: ["strom audit checked G", "strom audit checked A B"],
    run(ctx, { args }) {
      const tree = ctx.tree();
      const session = currentSession(tree, ctx.env, ctx.refs);
      let r: HealthReport | undefined;
      for (const raw of listOf(args)) {
        const t = raw.toUpperCase();
        if (!isAuditType(t)) throw new UsageError(`not a check: ${raw} (${AUDIT_TYPES.join(", ")})`, { code: "audit.body" });
        r = markChecked(tree, session, t);
      }
      const left = r ? r.ai.filter((t) => !(r!.checked ?? []).includes(t)) : [];
      return { text: `${r?.id}: ${(r?.checked ?? []).join(",")} gone through${left.length ? ` · left ${left.join(",")}` : " · all — write the summary (strom audit summary) and close the task"}`, data: { run: r?.id, checked: r?.checked ?? [], left } };
    },
  },
  {
    path: ["audit", "summary"],
    summary: "The tree check's summary in a sentence (the agent of its task, in its session; the research's language)",
    group: "analysis",
    tree: true,
    writes: true,
    args: [{ name: "text", description: "the summary", required: true, variadic: true }],
    examples: ['strom audit summary "Two lines wait for requests; the stories of three people rest on no facts."'],
    run(ctx, { args }) {
      const tree = ctx.tree();
      const r = setSummary(tree, currentSession(tree, ctx.env, ctx.refs), { summary: args.join(" ") });
      return { text: `${r.id}: summary written`, data: { run: r.id } };
    },
  },
  {
    path: ["audit", "order"],
    summary: "A step of what to do next, in order, with why (the agent of the tree check's task; K6.10)",
    group: "analysis",
    tree: true,
    writes: true,
    description: "The kinds of the built-in steps (line-stuck, sent-old, decide, queue-empty, fix, verify-line, edge, material, check) with their subject (line-stuck:G0001, fix:places); written in the order said; at most 10.",
    args: [{ name: "step", description: "<kind>[:<subject>]", required: true }],
    options: [{ name: "why", type: "string", value: "<sentence>", description: "why it comes here (the research's language)" }],
    examples: ['strom audit order line-stuck:G0001 --why "The line waits for two answers of the archive; nothing grows it until then."'],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      const [kind, subject] = String(args[0]).split(":", 2) as [string, string | undefined];
      const r = setSummary(tree, currentSession(tree, ctx.env, ctx.refs), { order: { kind: kind.trim().toLowerCase(), ...(subject ? { subject: subject.trim() } : {}), why: String(opts.why ?? "") } });
      return { text: `${r.id}: step ${r.order?.length} ${args[0]}`, data: { run: r.id, order: r.order } };
    },
  },
  ...(["accept", "dismiss", "undo"] as const).map((how): CommandDef => ({
    path: ["audit", how],
    summary:
      how === "accept"
        ? "Accept findings of the tree check (the person's own): each a task of the queue"
        : how === "dismiss"
          ? "Dismiss findings of the tree check (the person's own): never reported again"
          : "Take a decision on findings back (the person's own): new again; an accepted one's task dropped if not started",
    group: "analysis",
    tree: true,
    writes: true,
    person: PERSON,
    args: [{ name: "finding", description: "the findings (A-1a2b3c4d …)", required: true, variadic: true }],
    options: [{ name: "expect", type: "string", value: "<rev>", description: "refused if the findings changed since (the app's /status health.rev)" }],
    examples: [`strom audit ${how} A-1a2b3c4d`, `strom audit ${how} A-1a2b3c4d G-5e6f7a8b`],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      if (typeof opts.expect === "string" && opts.expect) {
        const rev = healthRev(tree);
        if (rev !== opts.expect) throw new UsageError("the findings changed meanwhile: read them again", { code: "health.rev", params: { rev } });
      }
      const ids = listOf(args);
      const done = decide(tree, ids, how as DecideDo, byOf(ctx), (f, lang) => findingTaskWords(f, lang, findRun(tree, f.id)));
      const decisions = decisionsOf(tree);
      const findings = ids.map((id) => {
        for (const r of listReports(tree, Infinity)) {
          const f = r.findings?.find((x) => x.id === id);
          if (f) return findingView(tree, r, f, decisions);
        }
        return undefined;
      });
      return {
        text: lines(...done.map((d, i) => `${d.id}: ${d.changed ? (how === "accept" ? `accepted → task ${findings[i]?.task ?? ""}` : how === "dismiss" ? "dismissed" : "new again") : "unchanged"}`)),
        data: { changed: done.filter((d) => d.changed).map((d) => d.id), findings: findings.filter(Boolean) },
      };
    },
  })),
);

/** The report a finding is of (its newest). */
function findRun(tree: Tree, id: string): string {
  return listReports(tree, Infinity).find((r) => r.findings?.some((f) => f.id === id))?.id ?? "";
}

function reportOr(tree: Tree, raw: string | undefined): HealthReport {
  const id = String(raw ?? "").trim().toUpperCase();
  const r = isReportId(id) ? readReport(tree, id) : undefined;
  if (!r) throw new UsageError(`no report ${raw ?? ""} of the tree check`, { code: "health.unknown", hint: "strom health list" });
  return r;
}
