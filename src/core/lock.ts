// Cross-platform file lock: a hard link of a file written aside (or exclusive create) + owner info.
// A lock whose process is gone (same host) or which is older than `staleMs`
// is taken over; an unreadable one only after a long watch. Works the same on Windows, macOS and Linux.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { LockedError } from "./errors.ts";

export interface LockInfo {
  pid: number;
  host: string;
  at: string;
  owner: string;
  /** The version of strom that holds it (a worker's lock: a research another version works in is never migrated meanwhile). */
  version?: string;
  /** The computer that holds it (machineId; a worker's lock): its pid decides here even when the computer's name changed. */
  machine?: string;
}

/** This computer's identity as the system keeps it (undefined: not asked yet, null: none to be had). */
let machineHere: string | null | undefined;

/**
 * The system's own id of this computer, unchanged by its name, where its pids are its own: macOS IOPlatformUUID, Linux
 * machine-id with the pid namespace, Windows MachineGuid.
 */
function systemMachineId(): string | undefined {
  const quiet = { encoding: "utf8" as const, timeout: 5000, windowsHide: true, stdio: ["ignore", "pipe", "ignore"] as ("ignore" | "pipe")[] };
  if (process.platform === "darwin") return /"IOPlatformUUID"\s*=\s*"([^"]+)"/.exec(execFileSync("/usr/sbin/ioreg", ["-rd1", "-c", "IOPlatformExpertDevice"], quiet))?.[1];
  if (process.platform === "win32") {
    const reg = path.join(process.env.SystemRoot ?? "C:\\Windows", "System32", "reg.exe");
    return /MachineGuid\s+REG_SZ\s+(\S+)/i.exec(execFileSync(reg, ["query", "HKLM\\SOFTWARE\\Microsoft\\Cryptography", "/v", "MachineGuid"], quiet))?.[1];
  }
  // (with the processes' namespace: containers made of one image share their machine-id, never their pids)
  let ns = "";
  try {
    ns = fs.readlinkSync("/proc/self/ns/pid");
  } catch {
    // none on this system
  }
  for (const file of ["/etc/machine-id", "/var/lib/dbus/machine-id"]) {
    try {
      const id = fs.readFileSync(file, "utf8").trim();
      if (id) return `${id} ${ns}`;
    } catch {
      // the next
    }
  }
  return undefined;
}

/**
 * This computer, said in short (the system's id hashed: never the id itself), the same whatever its name — a Mac's
 * hostname changes with the network it joins. Asked once per process; undefined where the system gives none.
 */
export function machineId(): string | undefined {
  if (machineHere === undefined) {
    try {
      const id = systemMachineId()?.trim().toLowerCase();
      machineHere = id ? crypto.createHash("sha256").update(`strom machine\n${id}`).digest("hex").slice(0, 16) : null;
    } catch {
      machineHere = null;
    }
  }
  return machineHere ?? undefined;
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

/** How a lock's file is read and its time taken: a test puts a slow disk in their place (diskForTests). */
let disk = {
  read: (file: string) => fs.readFileSync(file, "utf8"),
  stat: (file: string) => fs.statSync(file),
};

/**
 * For tests: a disk whose content of a file appears late or whose times are wrong (a drive redirected over Remote
 * Desktop), or back to the real one (no argument).
 */
export function diskForTests(d?: { read?: (file: string) => string; stat?: (file: string) => fs.Stats }): void {
  disk = { read: d?.read ?? ((file) => fs.readFileSync(file, "utf8")), stat: d?.stat ?? ((file) => fs.statSync(file)) };
}

export function readLock(file: string): LockInfo | undefined {
  try {
    return JSON.parse(disk.read(file)) as LockInfo;
  } catch {
    return undefined;
  }
}

/**
 * An unreadable lock was damaged (a crash, a full disk) only when it stayed so, unchanged, while this process watched it
 * UNREADABLE_SEEN_MS — and its file is older than UNREADABLE_OLD_MS; or at once when the disk's own clock says it was
 * made longer ago than UNREADABLE_LONG_MS. Measured on Windows: on a drive redirected over Remote Desktop the content of
 * a lock appears hundreds of milliseconds after it was made, and its file's time is not this computer's (nor always
 * right: 0 while the content is not there); a lock taken over by a short time was held by two processes at once. Locks
 * on the usual disks are never unreadable (a hard link: whole at once), so their way is not slowed.
 */
const UNREADABLE_SEEN_MS = 5000;
const UNREADABLE_OLD_MS = 30_000;
const UNREADABLE_LONG_MS = 10 * 60_000;

/** A file's identity as the disk says it: another lock under the same name differs in it. */
function identity(file: string): string | undefined {
  try {
    const st = disk.stat(file);
    return `${st.ino}:${st.size}:${st.mtimeMs}:${st.birthtimeMs}`;
  } catch {
    return undefined;
  }
}

/**
 * How old a file is: by this computer's clock and by the disk's own (the file `ref` beside it written again just now:
 * both times from the same disk, whatever its clock). A time of 0 or less is no time.
 */
function ageOf(file: string, ref: string): { here: number; disk: number } | undefined {
  try {
    const at = disk.stat(file).mtimeMs;
    if (!(at > 0)) return undefined;
    fs.writeFileSync(ref, fs.readFileSync(ref));
    return { here: Date.now() - at, disk: disk.stat(ref).mtimeMs - at };
  } catch {
    return undefined;
  }
}

function rawOf(file: string): string {
  try {
    return disk.read(file);
  } catch {
    return "";
  }
}

/** An unreadable lock as one process watches it: since when, unchanged. */
interface Unreadable {
  id: string | undefined;
  since: number;
}

/** Was the unreadable lock damaged — `fresh`: the watch begins now, `seen`: the watch so far? */
function damaged(file: string, seen: Unreadable, fresh: boolean, ref: string): boolean {
  if (fresh) {
    const age = ageOf(file, ref);
    return !!age && age.disk >= UNREADABLE_LONG_MS;
  }
  if (performance.now() - seen.since < UNREADABLE_SEEN_MS) return false;
  const age = ageOf(file, ref);
  return !!age && Math.max(age.here, age.disk) >= UNREADABLE_OLD_MS;
}

function isStale(info: LockInfo | undefined, staleMs: number, maxAgeMs?: number): boolean {
  if (!info) return false; // unreadable: damaged only as acquireLock watches it (damaged)
  // held longer than any holder of this lock ever holds it: its pid lives on in another process (taken again by the system)
  if (maxAgeMs !== undefined && Date.now() - Date.parse(info.at) > maxAgeMs) return true;
  // On this computer the process decides: a live holder keeps its lock however
  // long it works (a big intake), a dead one loses it at once. This computer under another name (a worker's lock says
  // which computer): the same — a conversation that ended stayed at work a week once the Mac's name changed. Another
  // computer (a research on a network disk): its pid says nothing here, the time decides.
  if (info.host === os.hostname() || (info.machine !== undefined && info.machine === machineId())) return !processAlive(info.pid);
  return Date.now() - Date.parse(info.at) > staleMs;
}

/** Who holds the lock now, if anyone alive does. */
export function liveHolder(file: string, staleMs = 24 * 3600_000): LockInfo | undefined {
  if (!fs.existsSync(file)) return undefined;
  const info = readLock(file);
  // (unreadable: one being written, or damaged long ago — then nobody's)
  if (!info) return undefined;
  return isStale(info, staleMs) ? undefined : info;
}

export interface LockOptions {
  owner: string;
  /** Wait this long for a busy lock before failing (0 = fail at once). */
  waitMs?: number;
  staleMs?: number;
  /** Older than this the lock is taken over even when a process of its pid lives here (a pid the system gave again). */
  maxAgeMs?: number;
  /** The version of strom written into the lock (LockInfo.version). */
  version?: string;
  /** This computer's identity written into the lock (LockInfo.machine): its pid decides here whatever the computer's name. */
  machine?: boolean;
}

/**
 * Codes of a hard link that cannot be made on this disk, though writing there goes (the lock's own file was just
 * written beside it): measured on Windows, a drive redirected over Remote Desktop says EISDIR; network shares and
 * other file systems ENOTSUP, EXDEV, ENOSYS or EPERM.
 */
const NO_LINK = new Set(["EISDIR", "ENOTSUP", "EXDEV", "ENOSYS", "EPERM"]);

/** Folders whose disk takes no hard links, found in this process: their locks go by exclusiveCreate at once. */
const linkless = new Set<string>();

/** How a hard link is made: a test puts a refusing one in its place (a disk without hard links). */
let makeLink: (from: string, to: string) => void = (from, to) => fs.linkSync(from, to);

/** For tests: a disk without hard links (a function throwing as such a disk does), or back to the real one (undefined). */
export function linkForTests(fn?: (from: string, to: string) => void): void {
  makeLink = fn ?? ((from, to) => fs.linkSync(from, to));
  linkless.clear();
}

/** Can this folder's disk make hard links (where a lock appears whole at once)? Tries one and takes it away. */
export function hardLinksHere(dir: string): boolean {
  const a = path.join(dir, `.link-test.${process.pid}.${Math.random().toString(36).slice(2)}`);
  const b = `${a}.2`;
  try {
    fs.writeFileSync(a, "");
    makeLink(a, b);
    return true;
  } catch {
    return false;
  } finally {
    fs.rmSync(a, { force: true });
    fs.rmSync(b, { force: true });
  }
}

/**
 * The lock created where hard links cannot be made: an exclusive create ("wx"), its content written at once. On
 * Windows "wx" now and then says EPERM (or EBUSY) while several processes take the same lock — a name another one is
 * removing (measured: NTFS, four processes) — so it is tried again a few times before that counts. EEXIST: held.
 */
function exclusiveCreate(file: string, body: string): void {
  for (let attempt = 0; ; attempt++) {
    let fd: number;
    try {
      fd = fs.openSync(file, "wx");
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if ((code === "EPERM" || code === "EBUSY") && attempt < 5) {
        sleepSync(20 + attempt * 10);
        continue;
      }
      throw err;
    }
    try {
      fs.writeSync(fd, body);
    } catch (err) {
      fs.closeSync(fd);
      fs.rmSync(file, { force: true });
      throw err;
    }
    fs.closeSync(fd);
    return;
  }
}

/**
 * Put the lock under its name unless the name is taken (EEXIST): a hard link of the file written aside — it appears
 * whole — or, on a disk without hard links, an exclusive create.
 */
function place(aside: string, file: string, body: string): void {
  const dir = path.dirname(file);
  if (!linkless.has(dir)) {
    try {
      makeLink(aside, file);
      return;
    } catch (err) {
      if (!NO_LINK.has((err as NodeJS.ErrnoException).code ?? "")) throw err;
      linkless.add(dir);
    }
  }
  exclusiveCreate(file, body);
}

/** Acquire the lock or throw LockedError. Returns the release function. */
export function acquireLock(file: string, opts: LockOptions): () => void {
  const waitMs = opts.waitMs ?? 5000;
  const staleMs = opts.staleMs ?? 10 * 60 * 1000;
  const deadline = Date.now() + waitMs;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const machine = opts.machine ? machineId() : undefined;
  const info: LockInfo = { pid: process.pid, host: os.hostname(), at: new Date().toISOString(), owner: opts.owner, ...(opts.version ? { version: opts.version } : {}), ...(machine ? { machine } : {}) };

  // The lock appears whole or not at all: written aside, then linked in under its name
  // (a link fails if the name exists). A lock created empty and filled a moment later
  // looked abandoned to a process that read it in that moment — and two held it. A disk
  // without hard links (a network share, a redirected drive) creates it exclusively and
  // fills it at once; an unreadable lock counts as damaged only after a long watch (damaged).
  const body = JSON.stringify(info);
  const aside = `${file}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
  fs.writeFileSync(aside, body);
  let unreadable: Unreadable | undefined;
  try {
    for (;;) {
      try {
        place(aside, file, body);
        return () => {
          const cur = readLock(file);
          if (cur && cur.pid === info.pid && cur.at === info.at) fs.rmSync(file, { force: true });
        };
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
      }
      const holder = readLock(file);
      // an unreadable lock watched while it stays so and unchanged (another one under its name starts the watch again)
      let fresh = false;
      if (holder) unreadable = undefined;
      else {
        const id = identity(file);
        fresh = !unreadable || unreadable.id !== id;
        if (fresh) unreadable = { id, since: performance.now() };
      }
      if (holder ? isStale(holder, staleMs, opts.maxAgeMs) : !!unreadable && damaged(file, unreadable, fresh, aside)) {
        // Taken out of the way in one step; of several waiters only one moves it, and only
        // the lock it judged dead — another one is put back.
        const dead = `${file}.dead.${process.pid}.${Math.random().toString(36).slice(2)}`;
        try {
          fs.renameSync(file, dead);
          const moved = readLock(dead);
          const other = holder ? !!moved && (moved.pid !== holder.pid || moved.at !== holder.at) : !!moved || identity(dead) !== unreadable?.id;
          if (other) {
            try {
              place(dead, file, moved ? JSON.stringify(moved) : rawOf(dead));
            } catch {
              // someone took the name meanwhile: that one holds it now
            }
          }
          fs.rmSync(dead, { force: true });
        } catch {
          // someone else moved it first
        }
        unreadable = undefined;
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
