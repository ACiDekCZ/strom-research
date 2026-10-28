// How long each step of a command took, and how much of the disk it went through (strom --timing, STROM_TIMING=1):
// one line a person can send when strom is slow — found on Windows, a research on OneDrive: five minutes before the
// menu showed, nothing said what it waited for. Off, it costs nothing: no step is measured, no file call counted.

import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";

/** The calls of the disk counted for each step: what is slow on a network drive or a cloud folder. */
const FS_CALLS = ["statSync", "lstatSync", "readdirSync", "openSync", "readFileSync", "existsSync"] as const;
type FsCall = (typeof FS_CALLS)[number];

interface Step {
  /** Its own time (the steps measured inside it left out), ms. */
  self: number;
  /** Its whole time, ms. */
  total: number;
  /** How many times it ran. */
  runs: number;
  /** The disk's calls it made itself, and the programs it started (git). */
  calls: Partial<Record<FsCall | "git", number>>;
}

let on = false;
let patched = false;
let since = performance.now();
const steps = new Map<string, Step>();
/** The steps running now, the innermost last: what a call of the disk is counted to. */
const stack: { label: string; t0: number; inner: number }[] = [];

const stepOf = (label: string): Step => {
  let s = steps.get(label);
  if (!s) steps.set(label, (s = { self: 0, total: 0, runs: 0, calls: {} }));
  return s;
};

function count(call: FsCall | "git"): void {
  const s = stepOf(stack.at(-1)?.label ?? "other");
  s.calls[call] = (s.calls[call] ?? 0) + 1;
}

/** Each call of the disk counted to the step it is made in (once a process; the functions stay as they were otherwise). */
function patchFs(): void {
  if (patched) return;
  patched = true;
  const target = fs as unknown as Record<FsCall, (...a: unknown[]) => unknown>;
  // a call made inside another (readFileSync opens the file itself) counted once, as the outer one
  let inside = false;
  for (const name of FS_CALLS) {
    const orig = target[name];
    target[name] = function (this: unknown, ...a: unknown[]) {
      if (!on || inside) return orig.apply(this, a);
      count(name);
      inside = true;
      try {
        return orig.apply(this, a);
      } finally {
        inside = false;
      }
    };
  }
  // the named imports (import { statSync } from "node:fs") see the same functions
  syncBuiltinESMExports();
}

export function timingOn(): boolean {
  return on;
}

/** Measuring from now on (the time of the whole counted from here). */
export function startTiming(): void {
  if (on) return;
  on = true;
  since = performance.now();
  patchFs();
}

/** Measuring off, all measured forgotten (tests). */
export function stopTiming(): void {
  on = false;
  steps.clear();
  stack.length = 0;
}

/** Measured from now on again, what was measured forgotten (the menu: each of its rounds its own line). */
export function restartTiming(): void {
  if (!on) return;
  steps.clear();
  since = performance.now();
}

/** A program strom started (git): counted to the step it ran in. */
export function noteSpawn(): void {
  if (on) count("git");
}

function begin(label: string): void {
  stack.push({ label, t0: performance.now(), inner: 0 });
}

function end(): void {
  const top = stack.pop();
  if (!top) return;
  const ms = performance.now() - top.t0;
  const s = stepOf(top.label);
  s.total += ms;
  s.self += ms - top.inner;
  s.runs++;
  const outer = stack.at(-1);
  if (outer) outer.inner += ms;
}

/** A step measured (when measuring is on): its time and the calls of the disk it made. */
export function timed<T>(label: string, fn: () => T): T {
  if (!on) return fn();
  begin(label);
  try {
    return fn();
  } finally {
    end();
  }
}

/** A step measured from here to stepEnd (a block of code left as it is; a step that throws is not ended). */
export function stepStart(label: string): void {
  if (on) begin(label);
}

export function stepEnd(): void {
  if (on) end();
}

/** timed of a step that waits (async). */
export async function timedAsync<T>(label: string, fn: () => Promise<T>): Promise<T> {
  if (!on) return fn();
  begin(label);
  try {
    return await fn();
  } finally {
    end();
  }
}

export interface TimingStep {
  label: string;
  ms: number;
  total: number;
  runs: number;
  calls: Partial<Record<FsCall | "git", number>>;
}

/** What was measured: the whole time and each step, the slowest (its own time) first. */
export function timingReport(): { ms: number; steps: TimingStep[] } {
  const list = [...steps.entries()].map(([label, s]) => ({ label, ms: Math.round(s.self), total: Math.round(s.total), runs: s.runs, calls: { ...s.calls } }));
  return { ms: Math.round(performance.now() - since), steps: list.sort((a, b) => b.ms - a.ms) };
}

const CALL_NAMES: Record<FsCall | "git", string> = {
  openSync: "open",
  readFileSync: "read",
  statSync: "stat",
  lstatSync: "lstat",
  readdirSync: "dir",
  existsSync: "exists",
  git: "git",
};

/** Seconds as a person reads them: 0.04 s, 1.2 s, 312 s. */
function secs(ms: number): string {
  const s = ms / 1000;
  return s >= 100 ? `${Math.round(s)} s` : s >= 10 ? `${s.toFixed(1)} s` : `${s.toFixed(2)} s`;
}

/**
 * The measured in one line to send: the whole time, then the slowest steps with the disk's calls they made
 * ("fixes 290 s [open 3585, git 2]"). Steps of under 10 ms left out; at most `most` of them.
 */
export function timingLine(most = 8): string {
  const r = timingReport();
  const shown = r.steps.filter((s) => s.ms >= 10 && s.label !== "other").slice(0, most);
  const step = (s: TimingStep) => {
    const calls = (Object.keys(CALL_NAMES) as (FsCall | "git")[]).filter((c) => s.calls[c]).map((c) => `${CALL_NAMES[c]} ${s.calls[c]}`);
    return `${s.label} ${secs(s.ms)}${s.runs > 1 ? ` ×${s.runs}` : ""}${calls.length ? ` [${calls.join(", ")}]` : ""}`;
  };
  return [`total ${secs(r.ms)}`, ...shown.map(step)].join(" · ");
}
