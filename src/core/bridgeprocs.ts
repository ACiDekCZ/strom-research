// The bridges to the Strom app running on this computer (strom live serve): how many, of which research, how much memory
// each holds — what strom doctor and strom error's report say (K046: a computer slow with no work to see, bridges of
// several researches running on for days). Only read: the system's table of processes, one look (POSIX: ps; Windows: one
// CIM query of node.exe), nothing ended, nothing written. A bridge is named by its research's folder — never a path, which
// carries the user's name. A table that cannot be read is said as such; memory not given for a process is said unknown.

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { liveFile } from "./live.ts";
import { installation, type Installation } from "./self.ts";
import type { Env } from "./paths.ts";

/** One process of the table that serves as a bridge: its number, its memory in bytes (resident set; Windows: working set). */
export interface BridgeRow {
  pid: number;
  rss?: number;
  command: string;
}

/** A bridge running here, as doctor and the report say it. */
export interface BridgeHere {
  pid: number;
  /** memory in bytes; undefined: not measured */
  rss?: number;
  /** known: a research strom knows (its live.json names it) · other: a research of a folder strom does not know ·
   *  orphan: its research's folder is gone · unknown: whose cannot be told (Windows: a bridge runs in the settings' folder) */
  state: "known" | "other" | "orphan" | "unknown";
  /** the research's folder name (never a path) */
  name?: string;
  /** the research's folder (known only; for the caller, never shown) */
  root?: string;
}

export interface BridgesHere {
  /** the table could be read */
  read: boolean;
  list: BridgeHere[];
  /** the memory of those measured, in bytes */
  rss: number;
  /** how many have no memory said */
  unmeasured: number;
}

/** What runs a command and gives its output (tests stand in for it). */
export type Run = (cmd: string, args: string[], timeoutMs: number) => { status: number | null; stdout: string };

const run: Run = (cmd, args, timeoutMs) => {
  const r = spawnSync(cmd, args, { encoding: "utf8", timeout: timeoutMs, windowsHide: true, maxBuffer: 32 * 1024 * 1024 });
  return { status: r.error ? null : r.status, stdout: r.stdout ?? "" };
};

/** A command line of strom's bridge: its entry (cli.js, the sources' cli.ts) followed by `live serve`. */
const BRIDGE_COMMAND = /(?:^|[\s"'/\\])cli\.[jt]s["']?\s+live\s+serve(?:\s|$)/u;

/** Is this command line a bridge's? */
export function isBridgeCommand(command: string): boolean {
  return BRIDGE_COMMAND.test(command);
}

/** POSIX `ps -A -ww -o pid= -o uid= -o rss= -o args=` (rss in KiB) read into the bridges of user `uid` (any user when undefined). */
export function parsePsBridges(text: string, uid?: number): BridgeRow[] {
  const out: BridgeRow[] = [];
  for (const line of text.split(/\r?\n/u)) {
    const m = /^\s*(\d+)\s+(\d+)\s+(\d+|-)\s+(.*)$/u.exec(line);
    if (!m || !isBridgeCommand(m[4]!)) continue;
    if (uid !== undefined && Number(m[2]) !== uid) continue;
    const kb = Number(m[3]);
    out.push({ pid: Number(m[1]), ...(Number.isFinite(kb) && kb > 0 ? { rss: kb * 1024 } : {}), command: m[4]! });
  }
  return out;
}

/** Windows' Win32_Process of node.exe as JSON (ProcessId, WorkingSetSize, CommandLine) read into its bridges. */
export function parseCimBridges(text: string): BridgeRow[] {
  let got: unknown;
  try {
    got = JSON.parse(text.trim() || "[]");
  } catch {
    return [];
  }
  const out: BridgeRow[] = [];
  for (const p of (Array.isArray(got) ? got : [got]) as Record<string, unknown>[]) {
    if (!p || typeof p !== "object") continue;
    const pid = Number(p.ProcessId);
    const command = typeof p.CommandLine === "string" ? p.CommandLine : "";
    if (!Number.isInteger(pid) || !isBridgeCommand(command)) continue;
    const ws = Number(p.WorkingSetSize);
    out.push({ pid, ...(Number.isFinite(ws) && ws > 0 ? { rss: ws } : {}), command });
  }
  return out;
}

const WIN_QUERY = "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Select-Object ProcessId,WorkingSetSize,CommandLine | ConvertTo-Json -Compress";

/** The bridges in the table of processes of this user; undefined when the table cannot be read. */
export function bridgeRows(platform: NodeJS.Platform = process.platform, exec: Run = run): BridgeRow[] | undefined {
  try {
    if (platform === "win32") {
      const r = exec("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", WIN_QUERY], 8000);
      // nothing at all said: no node.exe runs (ConvertTo-Json of nothing) — only a failed query is no reading
      if (r.status !== 0) return undefined;
      return parseCimBridges(r.stdout);
    }
    const r = exec("ps", ["-A", "-ww", "-o", "pid=", "-o", "uid=", "-o", "rss=", "-o", "args="], 5000);
    if (r.status !== 0 || !r.stdout.trim()) return undefined;
    return parsePsBridges(r.stdout, typeof process.getuid === "function" ? process.getuid() : undefined);
  } catch {
    return undefined;
  }
}

/**
 * The working folders of these processes (POSIX: a bridge runs in its research's folder) — Linux /proc, macOS one lsof;
 * a folder removed since is said with `gone`. Nothing for Windows, where a bridge runs in the settings' folder.
 */
export function cwdsOf(pids: number[], platform: NodeJS.Platform = process.platform, exec: Run = run): Map<number, { dir: string; gone?: true }> {
  const out = new Map<number, { dir: string; gone?: true }>();
  if (!pids.length || platform === "win32") return out;
  if (platform === "linux") {
    for (const pid of pids) {
      try {
        const link = fs.readlinkSync(`/proc/${pid}/cwd`);
        const gone = / \(deleted\)$/u.test(link);
        out.set(pid, { dir: link.replace(/ \(deleted\)$/u, ""), ...(gone ? { gone: true as const } : {}) });
      } catch {
        // not ours to read
      }
    }
    return out;
  }
  try {
    const r = exec("lsof", ["-a", "-p", pids.join(","), "-d", "cwd", "-Fpn"], 3000);
    let pid: number | undefined;
    for (const line of r.stdout.split(/\r?\n/u)) {
      if (line.startsWith("p")) pid = Number(line.slice(1));
      else if (line.startsWith("n") && pid !== undefined) out.set(pid, { dir: line.slice(1) });
    }
  } catch {
    // lsof not there: whose is not said
  }
  return out;
}

/** The pid live.json of a research names (its bridge's note), never a note that came with a copy from another folder. */
function notedPid(root: string): number | undefined {
  try {
    const note = JSON.parse(fs.readFileSync(liveFile(root), "utf8")) as { pid?: unknown; root?: unknown };
    if (typeof note.pid !== "number") return undefined;
    if (typeof note.root === "string" && real(note.root) !== real(root)) return undefined;
    return note.pid;
  } catch {
    return undefined;
  }
}

function real(p: string): string {
  try {
    return fs.realpathSync.native(p).normalize("NFC");
  } catch {
    return path.resolve(p).normalize("NFC");
  }
}

/** A folder's last part, whichever separator its system uses. */
function folderName(dir: string): string {
  return dir.split(/[\\/]+/u).filter(Boolean).at(-1) ?? dir;
}

/**
 * STROM_TEST_PROCESS_TABLE (the sources only): a JSON file standing for the system — {platform, stdout, cwd?: {pid: dir},
 * fail?: true} — its stdout what ps or the CIM query would say.
 */
function standIn(env: Env, inst: Installation): { platform: NodeJS.Platform; exec: Run } | undefined {
  const file = env.STROM_TEST_PROCESS_TABLE;
  if (!file || inst.kind !== "source") return undefined;
  const t = JSON.parse(fs.readFileSync(file, "utf8")) as { platform: NodeJS.Platform; stdout?: string; cwd?: Record<string, string>; fail?: boolean };
  return {
    platform: t.platform,
    exec: (cmd) => {
      if (cmd === "lsof") return { status: 0, stdout: Object.entries(t.cwd ?? {}).map(([pid, dir]) => `p${pid}\nfcwd\nn${dir}`).join("\n") };
      return t.fail ? { status: null, stdout: "" } : { status: 0, stdout: t.stdout ?? "" };
    },
  };
}

/**
 * The bridges running on this computer for this user, each with its research (`known`: the researches strom knows) and
 * its memory. Never throws: a table not readable is `read: false`. `self`: the process left out of the table (this one;
 * a stand-in table's made-up PIDs are none of this process's, so none is left out of it).
 */
export function bridgesHere(
  known: { name: string; root: string }[],
  o: { env: Env; platform?: NodeJS.Platform; exec?: Run; inst?: Installation; self?: number },
): BridgesHere {
  let platform = o.platform ?? process.platform;
  let exec = o.exec ?? run;
  let self: number | undefined = o.self ?? process.pid;
  try {
    const stand = standIn(o.env, o.inst ?? installation());
    if (stand) {
      ({ platform, exec } = stand);
      self = o.self;
    }
  } catch {
    // a stand-in not readable: the system's own table
  }
  const rows = bridgeRows(platform, exec);
  if (!rows) return { read: false, list: [], rss: 0, unmeasured: 0 };
  const own = rows.filter((r) => r.pid !== self);
  const byPid = new Map<number, { name: string; root: string }>();
  for (const k of known) {
    const pid = notedPid(k.root);
    if (pid !== undefined && !byPid.has(pid)) byPid.set(pid, k);
  }
  const rest = own.filter((r) => !byPid.has(r.pid)).map((r) => r.pid);
  // the researches strom knows by their real folders: a bridge in one of them without its note is still that research's
  const knownDirs = new Map(known.map((k) => [real(k.root), k] as const));
  const cwds = cwdsOf(rest, platform, exec);
  const list: BridgeHere[] = own.map((r) => {
    const mem = r.rss !== undefined ? { rss: r.rss } : {};
    const k = byPid.get(r.pid);
    if (k) return { pid: r.pid, ...mem, state: "known", name: k.name, root: k.root };
    const cwd = cwds.get(r.pid);
    if (!cwd) return { pid: r.pid, ...mem, state: "unknown" };
    const of = knownDirs.get(real(cwd.dir));
    if (of && !cwd.gone) return { pid: r.pid, ...mem, state: "known", name: of.name, root: of.root };
    const gone = cwd.gone || !fs.existsSync(cwd.dir);
    return { pid: r.pid, ...mem, state: gone ? "orphan" : "other", name: folderName(cwd.dir) };
  });
  list.sort((a, b) => (b.rss ?? -1) - (a.rss ?? -1) || a.pid - b.pid);
  return { read: true, list, rss: list.reduce((n, b) => n + (b.rss ?? 0), 0), unmeasured: list.filter((b) => b.rss === undefined).length };
}
