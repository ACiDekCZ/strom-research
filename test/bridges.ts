// The bridges a run of the tests started: each notes itself (src/core/live.ts noteTestBridge) in the run's folder
// STROM_TEST_BRIDGES — test/setup.ts makes it once for the runner and every test file it starts. A world's bridges end
// with it (World.cleanup, and at the end of its test file when a test failed before that); the run fails when one is
// left after the last test (test/global-setup.ts). Only bridges of this run: another run's (a second checkout, the
// person's own strom) are never looked at.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

export interface NotedBridge {
  pid: number;
  root: string;
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
  return !!out && !out.startsWith("Z") && /\blive\s+serve\b/u.test(out);
}

/** A path as it compares: its form of letters one (a folder named with "ěš" given either way), on Windows any case. */
function key(p: string): string {
  const k = path.resolve(p).normalize("NFC");
  return process.platform === "win32" ? k.toLowerCase() : k;
}

/** Whether a bridge's research is in one of the folders (each also as its real path: /var is /private/var on a Mac). */
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
 * End these bridges and wait until they are gone: asked first (SIGTERM — a bridge then ends as it should), ended for good
 * after `waitMs` (SIGKILL). All at once, never one after another. Those still running after that.
 */
export function endBridges(pids: number[], waitMs = 5000): number[] {
  let left = pids.filter(bridgeRuns);
  for (const pid of left) {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      // gone meanwhile
    }
  }
  const until = (ms: number) => {
    for (let t = 0; left.length && t < ms; t += 100) {
      sleep(100);
      left = left.filter(bridgeRuns);
    }
  };
  until(waitMs);
  for (const pid of left) {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      // gone meanwhile
    }
  }
  until(2000);
  return left;
}
