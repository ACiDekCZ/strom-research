// The bridge's writer kept warm: one strom of its own that lives on between writes (src/core/warmwriter-child.ts) and
// runs the commands that take what the app sent — an original, the queue of originals, an input said of again, a batch
// closed — one after another through main(), each as a strom started for it would: the same environment (forApp), the
// research's folder, its exit code, what it printed. Node and strom's code loaded once instead of for every file; the
// index of the research's files (core/shaindex.ts) read as it starts, not while the app waits. Started with the first
// write of the app's (an original as it comes), never by a bridge that only answers reads. Any other command, and
// whatever comes while it could not start or after it failed, is run by a strom started for it, as before. With nothing
// to write for a while (STROM_WARM_IDLE_MS, 2 minutes) it ends; the bridge's end ends it.

import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, type ChildProcess } from "node:child_process";
import { stromLauncher } from "./self.ts";

/** What a strom said: its exit code (null: ended by a signal), and what it printed. */
export interface StromResult {
  code: number | null;
  signal?: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  /** It could not be started at all. */
  error?: Error;
}

/** Runs a strom command (its arguments, --json among them) as the person's in the research's folder. */
export type RunStrom = (argv: string[], done: (r: StromResult) => void) => void;

/** The commands the warm writer runs: those that take what the app sent, none reading what is typed. */
const WARM = ["media original", "media queued", "input amend", "input batch done"];
export const warmCommand = (argv: string[]): boolean => WARM.some((c) => argv.slice(0, c.split(" ").length).join(" ") === c);

/** A strom started for one command (the way before the warm writer), its output read. */
export function spawnRun(cwd: string, env: NodeJS.ProcessEnv, track: (child: ChildProcess) => void): RunStrom {
  return (argv, done) => {
    const { command, args } = stromLauncher();
    let child: ChildProcess;
    try {
      child = spawn(command, [...args, ...argv], { cwd, env, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    } catch (e) {
      return done({ code: null, stdout: "", stderr: "", error: e as Error });
    }
    track(child);
    let stdout = "";
    let stderr = "";
    let said = false;
    child.stdout!.on("data", (d: Buffer) => (stdout += d.toString("utf8")));
    child.stderr!.on("data", (d: Buffer) => (stderr += d.toString("utf8")));
    child.on("error", (e) => {
      if (said) return;
      said = true;
      done({ code: null, stdout, stderr, error: e });
    });
    child.on("close", (code, signal) => {
      if (said) return;
      said = true;
      done({ code, signal, stdout, stderr });
    });
  };
}

export interface WarmWriter {
  run: RunStrom;
  /** Started now (as an original comes: what it needs read while its bytes come). */
  warm(): void;
  /** A command at work in it now. */
  busy(): boolean;
  /** Its process (none: not running). */
  pid(): number | undefined;
  /** Ended (the bridge ends): what it runs now finishes first. */
  end(): void;
}

/**
 * The warm writer of a bridge: the commands it takes (warmCommand) run in it one after another, the rest — and all while
 * it is not there to take them (not started, failed lately) — by a strom started for each.
 */
export function warmWriter(o: { root: string; env: NodeJS.ProcessEnv; note(text: string): void; track(child: ChildProcess): void; idleMs?: number; retryMs?: number }): WarmWriter {
  const cold = spawnRun(o.root, o.env, o.track);
  const idleMs = o.idleMs ?? Number(o.env.STROM_WARM_IDLE_MS ?? 120_000);
  const retryMs = o.retryMs ?? Number(o.env.STROM_WARM_RETRY_MS ?? 60_000);
  let child: ChildProcess | undefined;
  let next = 1;
  const waiting = new Map<number, (r: StromResult) => void>();
  let idle: ReturnType<typeof setTimeout> | undefined;
  let failedAt = 0;
  let ended = false;
  let tail = "";
  // the writers let go (their end expected)
  const letGo = new WeakSet<ChildProcess>();

  const stopIdle = () => {
    if (idle) clearTimeout(idle);
    idle = undefined;
  };
  const armIdle = () => {
    stopIdle();
    if (waiting.size || !child) return;
    idle = setTimeout(() => {
      idle = undefined;
      if (!waiting.size) quit("nothing to write for a while");
    }, idleMs);
    idle.unref();
  };
  const quit = (why?: string) => {
    const c = child;
    if (!c) return;
    child = undefined;
    letGo.add(c);
    // (its end with the bridge's needs no line of its own: the bridge's "ended" says it)
    if (why) o.note(`the writer ends (pid ${c.pid}): ${why}`);
    try {
      if (c.connected) c.disconnect();
    } catch {
      // gone already
    }
  };
  const start = (): ChildProcess | undefined => {
    if (child) return child;
    if (ended || Date.now() - failedAt < retryMs) return undefined;
    const here = fileURLToPath(import.meta.url);
    let c: ChildProcess;
    try {
      c = spawn(process.execPath, [path.join(path.dirname(here), `warmwriter-child${path.extname(here)}`)], { cwd: o.root, env: o.env, stdio: ["ignore", "ignore", "pipe", "ipc"], windowsHide: true });
    } catch (e) {
      failedAt = Date.now();
      o.note(`the writer did not start (${(e as Error).message}): each write by a strom of its own`);
      return undefined;
    }
    child = c;
    tail = "";
    // never what keeps the bridge's process alive: the bridge's end ends it
    c.unref();
    (c.channel as { unref?: () => void } | undefined)?.unref?.();
    c.stderr!.on("data", (d: Buffer) => (tail = (tail + d.toString("utf8")).slice(-2000)));
    c.on("message", (m: { id?: number; code?: number; stdout?: string; stderr?: string }) => {
      const done = typeof m?.id === "number" ? waiting.get(m.id) : undefined;
      if (!done) return;
      waiting.delete(m.id!);
      done({ code: typeof m.code === "number" ? m.code : 1, stdout: m.stdout ?? "", stderr: m.stderr ?? "" });
      armIdle();
    });
    c.on("error", (e) => o.note(`the writer: ${e.message}`));
    c.once("exit", (code, signal) => {
      if (child === c) child = undefined;
      // ended while it wrote: what it wrote is said as a strom that ended so says it (its lock and commit its own)
      if (waiting.size || !letGo.has(c)) {
        // ended unasked: each write by a strom of its own for a while
        failedAt = Date.now();
        o.note(`the writer ended${waiting.size ? " while it wrote" : ""} (exit ${code ?? signal})${tail.trim() ? `: ${tail.trim().split("\n").slice(-3).join(" | ")}` : ""}`);
        for (const [id, done] of waiting) {
          waiting.delete(id);
          done({ code, signal, stdout: "", stderr: tail });
        }
      }
      stopIdle();
    });
    o.note(`the writer started (pid ${c.pid})`);
    return c;
  };

  const run: RunStrom = (argv, done) => {
    if (!warmCommand(argv)) return cold(argv, done);
    const c = start();
    if (!c || !c.connected) return cold(argv, done);
    stopIdle();
    const id = next++;
    waiting.set(id, done);
    try {
      c.send({ id, argv });
    } catch {
      waiting.delete(id);
      cold(argv, done);
    }
  };

  return {
    run,
    warm() {
      start();
      armIdle();
    },
    busy: () => waiting.size > 0,
    pid: () => child?.pid,
    end() {
      ended = true;
      stopIdle();
      if (!waiting.size) quit();
      else {
        // what it writes now finishes first: then it ends
        const c = child;
        c?.once("message", function after() {
          if (!waiting.size) quit();
          else c.once("message", after);
        });
      }
    },
  };
}
