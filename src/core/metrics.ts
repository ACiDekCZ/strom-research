// What strom measures of the reading of scans and the load on the archives, for itself: in .strom/metrics beside a
// research (never data/, never git, never a pack — another computer measures again). Only recorded here; nothing is
// decided from it yet (a summary and the tuning come later).
//
//   fetch.jsonl        each run of strom fetch (and a connector's test, a probe, the browser's plan and take-over):
//                      who, which connector, book and record set, how many requests to each host, the waits for the
//                      host's pace and hourly cap, a limit used up (later), a part's gain or "no sharper"
//   usage/<name>.jsonl the agent's use per request (or turn, or step) as the agent says it, and its own id of the
//                      session — one file per session of strom run and per reader; nothing when the agent says nothing
//   readers.jsonl      each reader strom started (strom read, clips, transcripts, a calibration): its agent and model,
//                      views, outcome, what it found, its tokens and cost
//
// Each record one JSON line, appended (several processes at once write whole lines). Recording never fails a command
// nor holds it up: what cannot be written is left out. An archive records nothing (nobody reads there).

import fs from "node:fs";
import path from "node:path";
import { isArchive } from "./mode.ts";
import { isWorkerId } from "./workers.ts";
import type { UsageSample } from "../runners/runner.ts";
import type { Env } from "./paths.ts";

/** The folder of the measurements of a research. */
export function metricsDir(root: string): string {
  return path.join(root, ".strom", "metrics");
}

/** Whether this research records: not an archive, not a dry run. */
export function metricsOn(tree: { config: { mode?: string }; dryRun?: boolean }): boolean {
  return !isArchive(tree) && !tree.dryRun;
}

/** One line appended to a journal of .strom/metrics; a failure is left out. */
export function appendMetric(root: string, rel: string, record: Record<string, unknown>): void {
  try {
    const file = path.join(metricsDir(root), rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.appendFileSync(file, JSON.stringify({ at: new Date().toISOString(), ...record }) + "\n");
  } catch {
    // a measurement is no reason to fail
  }
}

/** Who did it: the session (N…) at work, the agent's name beside others (STROM_WORKER), a reader. */
export function whoOf(tree: { actor: string }, env: Env): { session?: string; by: string; worker?: string; reader?: 1 } {
  return {
    ...(/^N\d+$/.test(tree.actor) ? { session: tree.actor } : {}),
    by: tree.actor,
    ...(isWorkerId(env.STROM_WORKER) ? { worker: env.STROM_WORKER } : {}),
    ...(env.STROM_READER === "1" ? { reader: 1 as const } : {}),
  };
}

/** A file name of the usage of a session or a reader: its letters and digits, nothing that leads elsewhere. */
export function usageFileName(name: string): string {
  const safe = name.normalize("NFC").replace(/[^\p{L}\p{M}\p{N}._-]+/gu, "_").replace(/^\.+/, "").slice(0, 120);
  return `${safe || "run"}.jsonl`;
}

/**
 * What a runner says of its agent's use, written to .strom/metrics/usage/<name>.jsonl: the head (agent, the key of the
 * agent and model, the session) with the first thing the agent says, its own id of the session once (and a subagent's),
 * then each sample as it comes. Nothing at all when the agent says nothing.
 */
export function usageRecorder(tree: { root: string; config: { mode?: string }; dryRun?: boolean }, name: string, head: Record<string, unknown>): ((u: UsageSample) => void) | undefined {
  if (!metricsOn(tree)) return undefined;
  const rel = path.join("usage", usageFileName(name));
  let started = false;
  const ids = new Set<string>();
  return (u: UsageSample) => {
    try {
      if (!started) {
        started = true;
        appendMetric(tree.root, rel, { start: true, ...head });
      }
      const { agentSession, sub, ...rest } = u;
      if (agentSession && !ids.has(`${sub ?? ""} ${agentSession}`)) {
        ids.add(`${sub ?? ""} ${agentSession}`);
        appendMetric(tree.root, rel, { agentSession, ...(sub ? { sub } : {}), ...(rest.model ? { model: rest.model } : {}) });
      }
      const said = Object.entries(rest).filter(([k, v]) => k !== "model" && v !== undefined);
      if (said.length) appendMetric(tree.root, rel, { ...rest, ...(sub ? { sub } : {}) });
    } catch {
      // a measurement is no reason to fail
    }
  };
}

/** The runner's option that writes the use of a session or a reader (nothing in an archive). */
export function usageOpt(tree: { root: string; config: { mode?: string }; dryRun?: boolean }, name: string, head: Record<string, unknown>): { onUsage?: (u: UsageSample) => void } {
  const on = usageRecorder(tree, name, head);
  return on ? { onUsage: on } : {};
}

/** The tokens of a run as a reader's record carries them (only what the agent said). */
export function tokensOf(m: { inputTokens?: number; outputTokens?: number; cacheReadTokens?: number; cacheWriteTokens?: number }): Record<string, number> | undefined {
  const t: Record<string, number> = {};
  if (m.inputTokens !== undefined) t.in = m.inputTokens;
  if (m.outputTokens !== undefined) t.out = m.outputTokens;
  if (m.cacheReadTokens !== undefined) t.cr = m.cacheReadTokens;
  if (m.cacheWriteTokens !== undefined) t.cw = m.cacheWriteTokens;
  return Object.keys(t).length ? t : undefined;
}

/** What one host was asked in a run of a connector: requests, the pauses for its pace, the waits for its limits. */
export interface HostLoad {
  requests: number;
  /** All pauses for the host's pace together (ms). */
  paceMs?: number;
  /** Each wait for its hourly cap or a limit it said was used up. */
  waits?: { ms: number; why: "cap" | "limit" }[];
}

/** Counts what a run asks of each host (fed by the connector's run and the limiter). */
export class FetchMeter {
  readonly hosts = new Map<string, HostLoad>();
  readonly started = Date.now();
  private of(host: string): HostLoad {
    let h = this.hosts.get(host);
    if (!h) this.hosts.set(host, (h = { requests: 0 }));
    return h;
  }
  request = (host: string): void => {
    this.of(host).requests++;
  };
  pause = (p: { host: string; ms: number; why: "pace" | "cap" | "limit" }): void => {
    if (!(p.ms > 0)) return;
    const h = this.of(p.host);
    if (p.why === "pace") h.paceMs = (h.paceMs ?? 0) + Math.round(p.ms);
    else (h.waits ??= []).push({ ms: Math.round(p.ms), why: p.why });
  };
  json(): Record<string, HostLoad> {
    return Object.fromEntries(this.hosts);
  }
  requests(): number {
    let n = 0;
    for (const h of this.hosts.values()) n += h.requests;
    return n;
  }
}

/** A run of a connector (strom fetch and its kin), written to fetch.jsonl. */
export function recordFetch(tree: { root: string; actor: string; config: { mode?: string }; dryRun?: boolean }, env: Env, rec: Record<string, unknown>, meter?: FetchMeter): void {
  if (!metricsOn(tree)) return;
  try {
    const clean = Object.fromEntries(Object.entries(rec).filter(([, v]) => v !== undefined && !(Array.isArray(v) && v.length === 0)));
    appendMetric(tree.root, "fetch.jsonl", {
      ...whoOf(tree, env),
      ...clean,
      ...(meter ? { hosts: meter.json(), ms: Date.now() - meter.started } : {}),
    });
  } catch {
    // a measurement is no reason to fail
  }
}

/** The runs of fetch.jsonl a connector's requests per image are learned from: the last ones that got images. */
const PER_IMAGE_RUNS = 20;
/** At most this much of the end of fetch.jsonl is read for it. */
const PER_IMAGE_TAIL = 512 * 1024;

/**
 * How many requests a connector's run took for each image it got (`fetch`) or each part (`part`), as the hosts' counter
 * took them — redirects, retries and pages of the book included — over this research's last runs that got any. None
 * measured yet: undefined.
 */
export function requestsPerImage(root: string, connector: string, cmd: "fetch" | "part"): number | undefined {
  let text: string;
  try {
    const file = path.join(metricsDir(root), "fetch.jsonl");
    const size = fs.statSync(file).size;
    const fd = fs.openSync(file, "r");
    try {
      const n = Math.min(size, PER_IMAGE_TAIL);
      const buf = Buffer.alloc(n);
      fs.readSync(fd, buf, 0, n, size - n);
      text = buf.toString("utf8");
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return undefined;
  }
  let requests = 0;
  let images = 0;
  let runs = 0;
  for (const line of text.split("\n").reverse()) {
    if (runs >= PER_IMAGE_RUNS) break;
    let r: { connector?: unknown; cmd?: unknown; via?: unknown; got?: unknown; hosts?: Record<string, { requests?: unknown }> };
    try {
      r = JSON.parse(line);
    } catch {
      continue;
    }
    if (r.connector !== connector || r.cmd !== cmd || r.via === "browser" || !Array.isArray(r.got) || !r.got.length || !r.hosts) continue;
    const sent = Object.values(r.hosts).reduce((n, h) => n + (typeof h?.requests === "number" ? h.requests : 0), 0);
    if (!sent) continue;
    requests += sent;
    images += r.got.length;
    runs++;
  }
  return images ? requests / images : undefined;
}

/** One reader strom started, written to readers.jsonl. */
export function recordReader(tree: { root: string; actor: string; config: { mode?: string }; dryRun?: boolean }, env: Env, rec: Record<string, unknown>): void {
  if (!metricsOn(tree)) return;
  try {
    const clean = Object.fromEntries(Object.entries(rec).filter(([, v]) => v !== undefined));
    appendMetric(tree.root, "readers.jsonl", { ...whoOf(tree, env), ...clean });
  } catch {
    // a measurement is no reason to fail
  }
}
