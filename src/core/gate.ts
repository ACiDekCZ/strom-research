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
export function loadGate(shared: string, spec: string): Gate {
  const [name = "", ...args] = spec.trim().split(/\s+/);
  if (!NAME_RE.test(name)) throw new UsageError(`invalid gate name "${name}"`, { hint: "lowercase letters, digits and dashes, e.g. claude-usage" });
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
  const r = spawnSync(program, [...args, ...gate.args], {
    cwd: gate.dir,
    encoding: "utf8",
    timeout,
    windowsHide: true,
    env: {
      ...env,
      STROM_GATE: gate.name,
      STROM_TREE: facts.tree,
      STROM_LANG: facts.lang,
      STROM_AGENT: facts.agent,
      STROM_MODEL: facts.model ?? "",
      STROM_SESSIONS: String(facts.sessions),
      STROM_COST_USD: facts.costUsd.toFixed(2),
      STROM_NEXT_TASK: facts.nextTask ?? "",
    },
  });
  if (r.error) {
    const timedOut = (r.error as NodeJS.ErrnoException).code === "ETIMEDOUT";
    return { verdict: "error", reason: timedOut ? `no answer within ${timeout / 1000} s` : r.error.message };
  }
  const said = parseSaid(r.stdout ?? "");
  const reason = said.reason ?? (r.status !== 0 && r.status !== 1 && r.status !== 2 ? lastLine(r.stderr ?? "") : undefined);
  switch (r.status) {
    case 0:
      return { verdict: "go", ...(reason ? { reason } : {}) };
    case 1:
      return { verdict: "wait", ...(reason ? { reason } : {}), waitMs: Math.max(MIN_WAIT_MS, said.waitMs ?? DEFAULT_WAIT_MS) };
    case 2:
      return { verdict: "stop", ...(reason ? { reason } : {}) };
    default:
      return { verdict: "error", reason: reason ?? (r.signal ? `ended by ${r.signal}` : `exit status ${r.status}`) };
  }
}

/** The last line of JSON the gate printed: {"reason", "wait" (seconds) | "until" (a time)}; plain text is the reason. */
function parseSaid(stdout: string): { reason?: string; waitMs?: number } {
  const line = lastLine(stdout);
  if (!line) return {};
  if (!line.startsWith("{")) return { reason: line.slice(0, 300) };
  try {
    const j = JSON.parse(line) as { reason?: unknown; wait?: unknown; until?: unknown };
    const out: { reason?: string; waitMs?: number } = {};
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
