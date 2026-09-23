// Cross-platform file lock: exclusive create ("wx") + owner info.
// A lock whose process is gone (same host) or which is older than `staleMs`
// is taken over. Works the same on Windows, macOS and Linux.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { LockedError } from "./errors.ts";

export interface LockInfo {
  pid: number;
  host: string;
  at: string;
  owner: string;
}

function sleepSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function processAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === "EPERM";
  }
}

export function readLock(file: string): LockInfo | undefined {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as LockInfo;
  } catch {
    return undefined;
  }
}

function isStale(info: LockInfo | undefined, staleMs: number): boolean {
  if (!info) return true; // unreadable: locks appear whole, so this one was damaged (a crash, a full disk)
  // On this computer the process decides: a live holder keeps its lock however
  // long it works (a big intake), a dead one loses it at once.
  if (info.host === os.hostname()) return !processAlive(info.pid);
  return Date.now() - Date.parse(info.at) > staleMs;
}

/** Who holds the lock now, if anyone alive does. */
export function liveHolder(file: string, staleMs = 24 * 3600_000): LockInfo | undefined {
  if (!fs.existsSync(file)) return undefined;
  const info = readLock(file);
  return isStale(info, staleMs) ? undefined : info;
}

export interface LockOptions {
  owner: string;
  /** Wait this long for a busy lock before failing (0 = fail at once). */
  waitMs?: number;
  staleMs?: number;
}

/** Acquire the lock or throw LockedError. Returns the release function. */
export function acquireLock(file: string, opts: LockOptions): () => void {
  const waitMs = opts.waitMs ?? 5000;
  const staleMs = opts.staleMs ?? 10 * 60 * 1000;
  const deadline = Date.now() + waitMs;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const info: LockInfo = { pid: process.pid, host: os.hostname(), at: new Date().toISOString(), owner: opts.owner };

  // The lock appears whole or not at all: written aside, then linked in under its name
  // (a link fails if the name exists). A lock created empty and filled a moment later
  // looked abandoned to a process that read it in that moment — and two held it.
  const body = JSON.stringify(info);
  const aside = `${file}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
  fs.writeFileSync(aside, body);
  try {
    for (;;) {
      try {
        fs.linkSync(aside, file);
        return () => {
          const cur = readLock(file);
          if (cur && cur.pid === info.pid && cur.at === info.at) fs.rmSync(file, { force: true });
        };
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
      }
      const holder = readLock(file);
      if (isStale(holder, staleMs)) {
        // Taken out of the way in one step; of several waiters only one moves it, and only
        // the lock it judged dead — another one is put back.
        const dead = `${file}.dead.${process.pid}.${Math.random().toString(36).slice(2)}`;
        try {
          fs.renameSync(file, dead);
          const moved = readLock(dead);
          if (holder && moved && (moved.pid !== holder.pid || moved.at !== holder.at)) {
            try {
              fs.linkSync(dead, file);
            } catch {
              // someone took the name meanwhile: that one holds it now
            }
          }
          fs.rmSync(dead, { force: true });
        } catch {
          // someone else moved it first
        }
        continue;
      }
      if (Date.now() >= deadline) {
        throw new LockedError(
          `locked by ${holder?.owner ?? "another process"} (pid ${holder?.pid ?? "?"} since ${holder?.at ?? "?"})`,
          "wait for it to finish, or check `strom status`",
        );
      }
      sleepSync(50);
    }
  } finally {
    fs.rmSync(aside, { force: true });
  }
}

export function withLock<T>(file: string, opts: LockOptions, fn: () => T): T {
  const release = acquireLock(file, opts);
  try {
    return fn();
  } finally {
    release();
  }
}
