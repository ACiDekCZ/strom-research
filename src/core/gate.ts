// Gates: a condition the user sets on working alone. Before each session of
// `strom run` (--loop runs on for as long as there is work) strom asks the
// gate the user chose (setting run.gate) whether to go on, wait or stop — the
// subscription's capacity, a budget, the night's tariff: whatever the gate's
// program decides, strom holds only the interface.
//
// A gate is a folder in the plugins folder, <shared>/plugins/gates/<name>/,
// with gate.json ({"interface": 1, "command": [...]}) and its program; the
// user may give it arguments after its name (run.gate "claude-usage 10"). The
// interface (assets/plugins/gates/README.md, copied next to the gates): the
// program's exit status says it — 0 go on, 1 wait, 2 stop — and one line of
// JSON on stdout may add why ("reason") and how long to wait ("wait" seconds
// or "until" a time). Anything else (a crash, no answer in time) stops the
// run: working alone never spends blind.

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { StromError, UsageError } from "./errors.ts";
import type { Env } from "./paths.ts";
import { NAME_RE, pluginsDir } from "./connector.ts";
import { readAsset } from "./assets.ts";
import type { AgentLimit } from "../runners/runner.ts";
import { ui } from "../cli/ui.ts";

export const GATE_INTERFACE = 1;
const MANIFEST = "gate.json";
/** How long a gate may think (it may ask a service). */
const DEFAULT_TIMEOUT_S = 120;
/** A gate that says wait without saying how long is asked again after this. */
export const DEFAULT_WAIT_MS = 15 * 60_000;
/** Never ask again sooner than this (a gate answering "wait 0" must not spin). */
const MIN_WAIT_MS = 60_000;

export interface GateManifest {
  interface: number;
  /** What the user sees, e.g. "Claude usage". */
  title?: string;
  /** The program and its arguments, run in the gate's folder; "node" is strom's own Node. */
  command: string[];
  /** Seconds the gate may take (default 120). */
  timeout?: number;
}

export interface Gate {
  name: string;
  dir: string;
  manifest: GateManifest;
  /** What the user gave it after its name ("claude-usage 10"): added to its command. */
  args: string[];
}

export interface GateAnswer {
  verdict: "go" | "wait" | "stop" | "error";
  /** Why, in the gate's words (for the user). */
  reason?: string;
  /** When to ask again (wait). */
  waitMs?: number;
  /** The answer is the user's own hard limit (a cap set in run.gate): no "start anyway" goes past it, the run ends. */
  hard?: boolean;
  /**
   * The gate holds a hard limit on this window of the agent's plan: ask it before every session (also of the runs the
   * user started), and ask a session at work to finish once the agent says the window's use reached `finish` (0–1).
   */
  watch?: { kind: AgentLimit["kind"]; finish: number };
}

/** What strom tells the gate about the run (environment variables STROM_*). */
export interface GateFacts {
  tree: string;
  lang: string;
  agent: string;
  model?: string | undefined;
  /** Sessions this run has had. */
  sessions: number;
  /** What this run has cost so far, as the agent reported it. */
  costUsd: number;
  /** The task the next session would take. */
  nextTask?: string | undefined;
  /** The limits of the agent's plan as the agent said them last in this run (STROM_AGENT_LIMITS). */
  limits?: AgentLimit[] | undefined;
}

export function gatesDir(shared: string): string {
  return path.join(pluginsDir(shared), "gates");
}

/** The gates folder with strom's own files: the interface and the gates strom ships (refreshed). */
export function ensureGatesDir(shared: string): string {
  const dir = gatesDir(shared);
  try {
    fs.mkdirSync(dir, { recursive: true });
    const own: [string, string | undefined][] = [[path.join(dir, "README.md"), readAsset("plugins", "gates", "README.md")]];
    for (const name of SHIPPED) for (const f of ["gate.json", "gate.ts"]) own.push([path.join(dir, name, f), readAsset("plugins", "gates", name, f)]);
    for (const [file, text] of own) {
      if (text === undefined) continue;
      let old: string | undefined;
      try {
        old = fs.readFileSync(file, "utf8");
      } catch {
        old = undefined;
      }
      if (old === text) continue;
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, text);
    }
  } catch (err) {
    // a folder strom may not write here (an agent's sandbox): the gates there still run
    if (!["EACCES", "EPERM", "EROFS"].includes((err as NodeJS.ErrnoException)?.code ?? "")) throw err;
  }
  return dir;
}

/** Gates strom ships: ready in the gates folder, used only when the user sets run.gate. */
export const SHIPPED = ["claude-usage"];

export function listGates(shared: string): Gate[] {
  const dir = gatesDir(shared);
  let names: string[] = [];
  try {
    names = fs.readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory() && NAME_RE.test(d.name)).map((d) => d.name);
  } catch {
    return [];
  }
  const out: Gate[] = [];
  for (const name of names.sort()) {
    try {
      out.push(loadGate(shared, name));
    } catch {
      // not a gate (yet): no gate.json, or one strom cannot read — `strom gate test <name>` says why
    }
  }
  return out;
}

/** A gate as the user names it: its name, then what it is given ("claude-usage 10"). */
/**
 * A cap given to a gate (--cap n, --cap=n): the share of the week in % a run never goes past — a whole number from 1
 * to 100. What else was given, said at once (setting it, testing it, a run), never first before a session.
 */
export function capProblem(args: string[]): string | undefined {
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a !== "--cap" && !a.startsWith("--cap=")) continue;
    const v = a === "--cap" ? args[i + 1] : a.slice("--cap=".length);
    if (v !== undefined && /^\d{1,3}$/u.test(v) && Number(v) >= 1 && Number(v) <= 100) continue;
    return v === undefined || v === "" || v.startsWith("--") ? "--cap without a number" : `--cap ${v}`;
  }
  return undefined;
}

export function loadGate(shared: string, spec: string): Gate {
  const [name = "", ...args] = spec.trim().split(/\s+/);
  if (!NAME_RE.test(name)) throw new UsageError(`invalid gate name "${name}"`, { hint: "lowercase letters, digits and dashes, e.g. claude-usage" });
  const cap = capProblem(args);
  if (cap)
    throw new UsageError(`${cap}: the cap is a whole number from 1 to 100 — the % of the week a run never goes past`, {
      hint: `e.g. strom config set run.gate "${name} 15 --cap 95"`,
    });
  const dir = path.join(gatesDir(shared), name);
  const file = path.join(dir, MANIFEST);
  if (!fs.existsSync(file)) throw new StromError(`no gate "${name}" (no ${file})`, { hint: `the gates here: strom gate list — a gate is a folder in ${gatesDir(shared)} with ${MANIFEST}` });
  let m: GateManifest;
  try {
    m = JSON.parse(fs.readFileSync(file, "utf8")) as GateManifest;
  } catch (err) {
    throw new StromError(`gate "${name}": ${MANIFEST} is not valid JSON (${(err as Error).message})`);
  }
  if (m.interface !== GATE_INTERFACE)
    throw new StromError(`gate "${name}" is for interface ${m.interface}, this strom knows ${GATE_INTERFACE}`, { hint: m.interface > GATE_INTERFACE ? "update strom: strom update" : `see ${path.join(gatesDir(shared), "README.md")}` });
  if (!Array.isArray(m.command) || !m.command.length || !m.command.every((c) => typeof c === "string" && c))
    throw new StromError(`gate "${name}": "command" must be a list of strings, e.g. ["node", "gate.ts"]`);
  return { name, dir, manifest: m, args };
}

/** Ask the gate once. Never throws: a gate that fails answers "error". */
export function askGate(gate: Gate, env: Env, facts: GateFacts): GateAnswer {
  const [cmd, ...args] = gate.manifest.command;
  const program = cmd === "node" ? process.execPath : cmd!;
  const timeout = (gate.manifest.timeout ?? DEFAULT_TIMEOUT_S) * 1000;
  // what strom knows of the agent's limits, and nothing an older process left in the environment
  const { STROM_AGENT_LIMITS: _old, ...inherited } = env;
  const r = spawnSync(program, [...args, ...gate.args], {
    cwd: gate.dir,
    encoding: "utf8",
    timeout,
    windowsHide: true,
    env: {
      ...inherited,
      STROM_GATE: gate.name,
      STROM_TREE: facts.tree,
      STROM_LANG: facts.lang,
      STROM_AGENT: facts.agent,
      STROM_MODEL: facts.model ?? "",
      STROM_SESSIONS: String(facts.sessions),
      STROM_COST_USD: facts.costUsd.toFixed(2),
      STROM_NEXT_TASK: facts.nextTask ?? "",
      ...(facts.limits?.length ? { STROM_AGENT_LIMITS: JSON.stringify(facts.limits) } : {}),
    },
  });
  if (r.error) {
    const timedOut = (r.error as NodeJS.ErrnoException).code === "ETIMEDOUT";
    // strom's own words in the research language (the Strom app shows them); the system's are said as they are
    return { verdict: "error", reason: timedOut ? ui(facts.lang, "ui.gate.timeout", { s: timeout / 1000 }) : r.error.message };
  }
  const said = parseSaid(r.stdout ?? "");
  const reason = said.reason ?? (r.status !== 0 && r.status !== 1 && r.status !== 2 ? lastLine(r.stderr ?? "") : undefined);
  const more = { ...(said.watch ? { watch: said.watch } : {}), ...(said.hard && r.status !== 0 ? { hard: true } : {}) };
  switch (r.status) {
    case 0:
      return { verdict: "go", ...(reason ? { reason } : {}), ...more };
    case 1:
      return { verdict: "wait", ...(reason ? { reason } : {}), waitMs: Math.max(MIN_WAIT_MS, said.waitMs ?? DEFAULT_WAIT_MS), ...more };
    case 2:
      return { verdict: "stop", ...(reason ? { reason } : {}), ...more };
    default:
      return { verdict: "error", reason: reason ?? (r.signal ? ui(facts.lang, "ui.gate.signal", { signal: r.signal }) : ui(facts.lang, "ui.gate.status", { status: String(r.status) })) };
  }
}

/**
 * The last line of JSON the gate printed: {"reason", "wait" (seconds) | "until" (a time), "hard", "watch"}; plain text
 * is the reason.
 */
function parseSaid(stdout: string): { reason?: string; waitMs?: number; hard?: boolean; watch?: GateAnswer["watch"] } {
  const line = lastLine(stdout);
  if (!line) return {};
  if (!line.startsWith("{")) return { reason: line.slice(0, 300) };
  try {
    const j = JSON.parse(line) as { reason?: unknown; wait?: unknown; until?: unknown; hard?: unknown; watch?: unknown };
    const out: { reason?: string; waitMs?: number; hard?: boolean; watch?: GateAnswer["watch"] } = {};
    if (j.hard === true) out.hard = true;
    const w = j.watch as { kind?: unknown; finish?: unknown } | undefined;
    if (w && typeof w === "object" && (w.kind === "five_hour" || w.kind === "seven_day") && typeof w.finish === "number" && w.finish > 0 && w.finish <= 1)
      out.watch = { kind: w.kind, finish: w.finish };
    if (typeof j.reason === "string" && j.reason.trim()) out.reason = j.reason.trim().slice(0, 300);
    if (typeof j.wait === "number" && Number.isFinite(j.wait) && j.wait >= 0) out.waitMs = j.wait * 1000;
    else if (typeof j.until === "string" && !Number.isNaN(Date.parse(j.until))) out.waitMs = Date.parse(j.until) - Date.now();
    return out;
  } catch {
    return { reason: line.slice(0, 300) };
  }
}

function lastLine(s: string): string | undefined {
  return s
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .pop();
}
