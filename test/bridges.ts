// The processes of strom a run of the tests started that serve in the background — bridges (strom live serve) and the
// phone's servers (strom phone serve): each notes itself (src/core/testnote.ts) in the run's folder STROM_TEST_BRIDGES —
// test/setup.ts makes it once for the runner and every test file it starts. A world's servers end with it
// (World.cleanup, and at the end of its test file when a test failed before that); the run fails when one is left after
// the last test (test/global-setup.ts). Only servers of this run: another run's (a second checkout, the person's own
// strom) are never looked at. A process is ended only when it is the one a test started (`ours`): its command and its
// working folder — never by a number alone, which the system gives again to another process (the person's own bridge).

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

export interface NotedBridge {
  pid: number;
  /** the research (a bridge), the settings folder (the phone's server) */
  root: string;
  /** its working folder when it started (noted since 1.32) */
  cwd?: string;
  /** a bridge when not said */
  kind?: "live" | "phone";
}

/** The command line of a bridge, of the phone's server. */
export const BRIDGE = /\blive\s+serve\b/u;
export const PHONE = /\bphone\s+serve\b/u;

/** A process a test started, as it is known: its number, what its command line says, the folders its working folder is in. */
export interface Ours {
  pid: number;
  command: RegExp;
  dirs: string[];
}

/** The folder of this run's bridges: made when none is set (a test file run alone without test/setup.ts). */
export function bridgesFolder(): string {
  let dir = process.env.STROM_TEST_BRIDGES;
  if (!dir) {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "strom-test-bridges-"));
    process.env.STROM_TEST_BRIDGES = dir;
    const made = dir;
    // gone with the process that made it (the runner: after its last check)
    process.on("exit", () => {
      try {
        fs.rmSync(made, { recursive: true, force: true });
      } catch {
        // left for the system's own cleaning of its temp folder
      }
    });
  }
  return dir;
}

/** Every bridge this run noted (running or not). */
export function notedBridges(dir = process.env.STROM_TEST_BRIDGES): NotedBridge[] {
  if (!dir) return [];
  const out: NotedBridge[] = [];
  let names: string[];
  try {
    names = fs.readdirSync(dir);
  } catch {
    return [];
  }
  for (const name of names) {
    if (!name.endsWith(".json")) continue;
    try {
      const b = JSON.parse(fs.readFileSync(path.join(dir, name), "utf8")) as NotedBridge;
      if (Number.isInteger(b.pid) && typeof b.root === "string") out.push(b);
    } catch {
      // being written: its bridge has just started
    }
  }
  return out;
}

/** Whether the process runs (never one that only waits for its parent to hear it ended) and is a bridge. */
export function bridgeRuns(pid: number): boolean {
  try {
    process.kill(pid, 0);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "EPERM") return false;
  }
  if (process.platform === "win32") return true;
  const r = spawnSync("ps", ["-o", "stat=,command=", "-p", String(pid)], { encoding: "utf8" });
  const out = (r.stdout ?? "").trim();
  if (r.error || r.status === null) return true;
  return !!out && !out.startsWith("Z") && BRIDGE.test(out);
}

/** The working folder of a process as the system says it (one removed since still named); undefined when not said. */
export function cwdOf(pid: number): string | undefined {
  if (process.platform === "win32") return undefined;
  if (process.platform === "linux") {
    try {
      return fs.readlinkSync(`/proc/${pid}/cwd`).replace(/ \(deleted\)$/u, "");
    } catch {
      return undefined;
    }
  }
  const r = spawnSync("lsof", ["-a", "-p", String(pid), "-d", "cwd", "-Fn"], { encoding: "utf8", timeout: 10_000 });
  const line = (r.stdout ?? "").split("\n").find((l) => l.startsWith("n"));
  return line ? line.slice(1) : undefined;
}

/**
 * Whether the process is the one a test started: it runs (never one that only waits for its parent to hear it ended),
 * its command line says what it was started for, and its working folder is in one of `dirs` — a number the system gave
 * again to another process (the person's own bridge, another run's server) is never taken for it. Never ours when that
 * cannot be told (ps not answering, another user's process). Windows: running is what there is.
 */
export function ours(o: Ours): boolean {
  try {
    process.kill(o.pid, 0);
  } catch {
    return false;
  }
  if (process.platform === "win32") return true;
  const r = spawnSync("ps", ["-o", "stat=,command=", "-p", String(o.pid)], { encoding: "utf8", timeout: 10_000 });
  const out = (r.stdout ?? "").trim();
  if (r.error || r.status !== 0 || !out || out.startsWith("Z") || !o.command.test(out)) return false;
  const cwd = cwdOf(o.pid);
  return cwd === undefined || within(cwd, o.dirs);
}

/** A noted server as it is known: its kind's command, the folders it was started in. */
export function ourNoted(b: NotedBridge): Ours {
  return { pid: b.pid, command: b.kind === "phone" ? PHONE : BRIDGE, dirs: [b.root, ...(b.cwd ? [b.cwd] : [])] };
}

/**
 * A path as it compares: its links followed (/var is /private/var on a Mac) — for one removed since, those of the nearest
 * folder above it that is still there —, its form of letters one (a folder named with "ěš" given either way), on Windows
 * any case.
 */
function key(p: string): string {
  let head = path.resolve(p);
  let rest = "";
  for (;;) {
    try {
      head = fs.realpathSync.native(head);
      break;
    } catch {
      const up = path.dirname(head);
      if (up === head) break;
      rest = rest ? path.join(path.basename(head), rest) : path.basename(head);
      head = up;
    }
  }
  const k = (rest ? path.join(head, rest) : head).normalize("NFC");
  return process.platform === "win32" ? k.toLowerCase() : k;
}

/** Whether a path is in one of the folders (each compared by its real path: /var is /private/var on a Mac). */
export function within(root: string, dirs: string[]): boolean {
  const r = key(root);
  return dirs.some((d) => {
    const k = key(d);
    return r === k || r.startsWith(k.endsWith(path.sep) ? k : k + path.sep);
  });
}

function sleep(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * End these processes a test started and wait until they are gone: asked first (`first`, SIGTERM — a bridge then ends as
 * it should), ended for good after `waitMs` (SIGKILL). All at once, never one after another. Each only while it is the
 * one started (`ours`): one gone meanwhile, its number given to another process, is left alone. The numbers of those
 * still running after that.
 */
export function endOurs(list: Ours[], o: { waitMs?: number; first?: NodeJS.Signals } = {}): number[] {
  let left = list.filter(ours);
  const send = (signal: NodeJS.Signals) => {
    for (const p of left) {
      try {
        process.kill(p.pid, signal);
      } catch {
        // gone meanwhile
      }
    }
  };
  const until = (ms: number) => {
    for (let t = 0; left.length && t < ms; t += 100) {
      sleep(100);
      left = left.filter(ours);
    }
  };
  send(o.first ?? "SIGTERM");
  if (o.first !== "SIGKILL") {
    until(o.waitMs ?? 5000);
    send("SIGKILL");
  }
  until(2000);
  return left.map((p) => p.pid);
}

/**
 * The processes a test file started in the background (a fetch, a reader's helper, a bridge), each as it is known — its
 * number, its command, the folders of its world — ended at the end of the file (`after`) or of a test, each only while
 * it is the one started: a number the system gave again to another process (the person's own bridge) is left alone.
 */
export class Started {
  private list: Ours[] = [];

  /** Noted while its world is there (`dirs`: World.dirs(), which names the folder also by its real path). */
  add(pid: number, command: RegExp, dirs: string[]): void {
    if (Number.isInteger(pid) && pid > 0) this.list.push({ pid, command, dirs });
  }

  has(pid: number): boolean {
    return this.list.some((p) => p.pid === pid);
  }

  /** Every one still running ended (`first`: SIGKILL at once, the default; SIGTERM — asked first, then ended). */
  end(first: NodeJS.Signals = "SIGKILL"): void {
    endOurs(this.list, { first, waitMs: 3000 });
    this.list = [];
  }
}

/** The command line of a fetch in the background (strom fetch … --background starts strom fetch …). */
export const FETCH = /\bfetch\b/u;
