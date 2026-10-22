// Whose settings these are (V2): an agent that runs strom with a settings folder of its own (STROM_CONFIG_DIR, HOME,
// XDG_CONFIG_HOME, APPDATA of its own) would read permissions nobody gave — an archive's images allowed, a faster
// pace, a milder level, a connector accepted. So under an agent — its marks in the environment, or (for a command that
// goes to an archive, once per process) an agent among strom's parent processes — the settings folder is verified:
// the person's default one for the real home (os.userInfo, never $HOME), one the person ran strom with outside an
// agent (listed in the default folder: settings-folders.json), or the installation's own (install.json) — and never
// one inside a family tree or the shared folder. The shared folder: the one the settings name, not an agent's own
// STROM_SHARED or STROM_HOME.
//
// Soft: an unverified folder stops nothing. strom takes from it no permission, no person's pace, no milder level, no
// acceptance; what restricts (a floor, a refusal, robots.txt, a person's "by hand") is taken from every place, the
// person's default folder too, and the stricter wins. strom run from its sources is not checked (STROM_TEST_V2 for a
// test, with STROM_TEST_REAL_HOME and STROM_TEST_ANCESTRY standing for the real home and the parent processes).
//
// What this does not hold (said where the consents are explained): an agent at the level full, or with no sandbox, can
// write the person's own settings itself — there the rule in its instructions is what holds; on Windows the parent
// processes are read less reliably; an agent that starts strom outside itself (a daemon) is not seen as one.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { configDir, isolated, type Env } from "./paths.ts";
import { installation, type Installation } from "./self.ts";
import { isAgent } from "./which.ts";
import { Settings } from "./config.ts";
import { findTreeUpwards, isTreeDir } from "./tree.ts";
import { readJsonIfExists, writeJson } from "./json.ts";

export interface SettingsTrust {
  /** The check applies (an installation by strom's installer or npm; a test that asks for it). */
  checked: boolean;
  /** An agent runs strom (its marks, or one among the parent processes). */
  agent: boolean;
  /** The settings folder may give permissions, paces, milder levels, acceptances. */
  verified: boolean;
  /** The shared folder is the one the settings name (a person's pace for a host is kept there). */
  sharedVerified: boolean;
  /** Why not, in words for the agent. */
  why?: string;
  /** The person's default settings folder for the real home: its restrictions count too (none for an isolated installation). */
  restrictionsFrom?: string;
  /** The shared folder the settings name, when this command uses another: its hosts' state restricts too. */
  sharedNamed?: string;
}

/** The programs of the agents strom knows (and those it does not drive but sees), as their processes are named. */
const AGENT_PROCESS = /(?:^|[\\/\s])(claude|codex(?:-windows-sandbox(?:-setup)?|-command-runner)?|opencode|grok|agy|antigravity|gemini|cursor-agent)(?:\.exe|\.js|\.mjs|\.cjs)?(?=\s|$)/i;

/** A process table's line: its id, its parent's, its command. */
export interface ProcessRow {
  pid: number;
  ppid: number;
  command: string;
}

/** The first agent among a process's parents (its name), walking up the table. */
export function agentAmong(rows: ProcessRow[], from: number): string | undefined {
  const byPid = new Map(rows.map((r) => [r.pid, r]));
  let pid = from;
  for (let i = 0; i < 64 && pid > 1; i++) {
    const r = byPid.get(pid);
    if (!r) return undefined;
    const m = AGENT_PROCESS.exec(r.command);
    if (m) return agentOfProcess(m[1]!);
    if (r.ppid === pid) return undefined;
    pid = r.ppid;
  }
  return undefined;
}

/** The agent a process of it is (its sandbox's helper on Windows is Codex, agy is Antigravity). */
function agentOfProcess(name: string): string {
  const n = name.toLowerCase();
  return n.startsWith("codex") ? "codex" : n === "agy" ? "antigravity" : n === "cursor-agent" ? "cursor" : n;
}

/** POSIX `ps -A -o pid= -o ppid= -o args=` read into rows. */
export function parsePs(text: string): ProcessRow[] {
  const out: ProcessRow[] = [];
  for (const line of text.split(/\r?\n/u)) {
    const m = /^\s*(\d+)\s+(\d+)\s+(.*)$/u.exec(line);
    if (m) out.push({ pid: Number(m[1]), ppid: Number(m[2]), command: m[3]! });
  }
  return out;
}

/** Windows' Win32_Process as CSV (ProcessId, ParentProcessId, Name, CommandLine) read into rows. */
export function parseCim(text: string): ProcessRow[] {
  const out: ProcessRow[] = [];
  for (const line of text.split(/\r?\n/u).slice(1)) {
    const cells = [...line.matchAll(/"((?:[^"]|"")*)"/gu)].map((m) => m[1]!.replace(/""/g, '"'));
    if (cells.length < 3) continue;
    const pid = Number(cells[0]);
    const ppid = Number(cells[1]);
    if (Number.isFinite(pid) && Number.isFinite(ppid)) out.push({ pid, ppid, command: `${cells[2]} ${cells[3] ?? ""}`.trim() });
  }
  return out;
}

let ancestry: { agent?: string; unread?: boolean } | undefined;

/** For tests in this process: forget what was read of the parent processes. */
export function forgetAncestry(): void {
  ancestry = undefined;
}

/**
 * An agent among strom's parent processes (its name): read once per process — POSIX one `ps`, Windows one CIM query.
 * STROM_TEST_ANCESTRY (the sources only): the names standing for them ("" none, "!" the table unreadable).
 */
export function agentInAncestry(env: Env, inst: Installation = installation(), platform: NodeJS.Platform = process.platform): string | undefined {
  if (inst.kind === "source") {
    if (env.STROM_TEST_ANCESTRY === undefined || env.STROM_TEST_ANCESTRY === "!") return undefined;
    return agentAmong(
      env.STROM_TEST_ANCESTRY.split(",").filter(Boolean).map((command, i, all) => ({ pid: 100 + i, ppid: i + 1 < all.length ? 101 + i : 1, command })),
      100,
    );
  }
  if (ancestry) return ancestry.agent;
  let rows: ProcessRow[] = [];
  try {
    if (platform === "win32") {
      const r = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", "Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,Name,CommandLine | ConvertTo-Csv -NoTypeInformation"], { encoding: "utf8", timeout: 15_000, windowsHide: true, maxBuffer: 32 * 1024 * 1024 });
      rows = parseCim(r.stdout ?? "");
    } else {
      const r = spawnSync("ps", ["-A", "-o", "pid=", "-o", "ppid=", "-o", "args="], { encoding: "utf8", timeout: 10_000, maxBuffer: 32 * 1024 * 1024 });
      rows = parsePs(r.stdout ?? "");
    }
  } catch {
    rows = [];
  }
  const agent = agentAmong(rows, process.ppid);
  ancestry = agent ? { agent } : { unread: !rows.length };
  return agent;
}

/**
 * The process table could not be read at all (after agentInAncestry): measured 2026-10-22, inside Codex's sandbox on
 * macOS and Windows reading it fails — a sign of a sandbox, not a certainty. STROM_TEST_ANCESTRY "!" (the sources only).
 */
export function ancestryUnread(env: Env, inst: Installation = installation()): boolean {
  if (inst.kind === "source") return env.STROM_TEST_ANCESTRY === "!";
  return ancestry?.unread === true;
}

/** The person's real home (never $HOME, which an agent may set). STROM_TEST_REAL_HOME (the sources only) for a test. */
export function realHome(env: Env, inst: Installation = installation()): string {
  if (inst.kind === "source" && env.STROM_TEST_REAL_HOME) return path.resolve(env.STROM_TEST_REAL_HOME);
  try {
    return os.userInfo().homedir;
  } catch {
    return os.homedir();
  }
}

/** The person's default settings folder for the real home (no STROM_CONFIG_DIR, XDG_CONFIG_HOME or APPDATA of anyone's). */
export function defaultSettingsDir(env: Env, platform: NodeJS.Platform = process.platform, inst: Installation = installation()): string {
  const home = realHome(env, inst);
  return configDir({ HOME: home, USERPROFILE: home }, platform);
}

const FOLDERS = "settings-folders.json";

function real(p: string): string {
  try {
    return fs.realpathSync.native(p);
  } catch {
    return path.resolve(p);
  }
}

function same(a: string, b: string): boolean {
  const x = real(a);
  const y = real(b);
  return process.platform === "win32" || process.platform === "darwin" ? x.toLowerCase() === y.toLowerCase() : x === y;
}

function inside(dir: string, parent: string): boolean {
  const rel = path.relative(real(parent), real(dir));
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

/** The settings folders the person ran strom with outside an agent (kept in their default folder). */
export function personFolders(defaultDir: string): string[] {
  try {
    const v = readJsonIfExists<{ folders?: { path?: unknown }[] }>(path.join(defaultDir, FOLDERS));
    return (v?.folders ?? []).map((f) => f?.path).filter((p): p is string => typeof p === "string" && !!p);
  } catch {
    return [];
  }
}

/** The family trees and the shared folder a settings folder names (a settings folder inside one is never the person's). */
function placesOf(env: Env): string[] {
  try {
    const s = new Settings(env, {});
    const out: string[] = [];
    const shared = s.shared()?.value;
    if (shared) out.push(shared);
    const trees = s.trees()?.value;
    if (trees && fs.existsSync(trees)) for (const name of fs.readdirSync(trees)) if (isTreeDir(path.join(trees, name))) out.push(path.join(trees, name));
    for (const extra of s.config.extraTrees ?? []) out.push(extra);
    return out;
  } catch {
    return [];
  }
}

/** The environment without what names another shared folder than the settings do. */
function withoutShared(env: Env): Env {
  const { STROM_SHARED: _s, STROM_HOME: _h, ...rest } = env;
  return rest;
}

/** The installation's own settings folder (install.json): its STROM_CONFIG_DIR, or the default of its HOME. */
function installedSettings(inst: Installation, platform: NodeJS.Platform): string | undefined {
  if (inst.kind !== "installed" || !inst.env) return undefined;
  if (!inst.env.STROM_CONFIG_DIR && !inst.env.HOME) return undefined;
  return configDir({ HOME: inst.env.HOME, USERPROFILE: inst.env.HOME, STROM_CONFIG_DIR: inst.env.STROM_CONFIG_DIR }, platform);
}

/**
 * Whether this command's settings (and its shared folder) are the person's. `network`: a command that goes to an
 * archive — the parent processes are read too (once per process). `shared`: the shared folder the command uses.
 */
export function settingsTrust(env: Env, o: { network?: boolean; shared?: string; cwd?: string; inst?: Installation; platform?: NodeJS.Platform } = {}): SettingsTrust {
  const inst = o.inst ?? installation();
  const platform = o.platform ?? process.platform;
  const checked = inst.kind !== "source" || env.STROM_TEST_V2 === "1";
  if (!checked) return { checked: false, agent: isAgent(env), verified: true, sharedVerified: true };
  const marks = isAgent(env);
  const parent = marks ? undefined : o.network ? agentInAncestry(env, inst, platform) : ancestry?.agent ?? (inst.kind === "source" ? agentInAncestry(env, inst, platform) : undefined);
  const agent = marks || !!parent;
  if (!agent) return { checked, agent, verified: true, sharedVerified: true };
  const here = configDir(env, platform);
  const dflt = defaultSettingsDir(env, platform, inst);
  const own = installedSettings(inst, platform);
  const alone = isolated(env) || isolated(inst.env ?? {});
  const restrictionsFrom = !alone && !same(here, dflt) ? dflt : undefined;
  let why: string | undefined;
  const listed = same(here, dflt) || (own !== undefined && same(here, own)) || personFolders(dflt).some((p) => same(p, here));
  if (!listed) why = `this command reads the settings in ${here} — not the person's (their default ${dflt}, or one they ran strom with themselves)`;
  else {
    const cwdTree = findTreeUpwards(o.cwd ?? process.cwd());
    const places = [...placesOf(env), ...placesOf({ HOME: realHome(env, inst), USERPROFILE: realHome(env, inst) }), ...(cwdTree ? [cwdTree] : []), ...(env.STROM_TREE ? [env.STROM_TREE] : [])];
    const hit = places.find((p) => inside(here, p));
    if (hit) why = `this command reads the settings in ${here}, inside ${hit} — a family tree or the shared folder, where an agent writes`;
  }
  const verified = !why;
  // the shared folder the settings name (verified ones; else the person's default ones)
  let sharedNamed: string | undefined;
  try {
    sharedNamed = new Settings(withoutShared(verified ? env : { HOME: realHome(env, inst), USERPROFILE: realHome(env, inst) }), {}).shared()?.value;
  } catch {
    sharedNamed = undefined;
  }
  const sharedNow = o.shared;
  const sharedVerified = verified && (!sharedNow || !sharedNamed || same(sharedNow, sharedNamed));
  return {
    checked,
    agent,
    verified,
    sharedVerified,
    ...(why ? { why } : !sharedVerified ? { why: `this command uses the shared folder ${sharedNow} — not the one the settings name (${sharedNamed})` } : {}),
    ...(restrictionsFrom ? { restrictionsFrom } : {}),
    ...(sharedNamed && sharedNow && !same(sharedNow, sharedNamed) ? { sharedNamed } : {}),
  };
}

/**
 * The person runs strom outside an agent with settings of their own (another than the default for their home): that
 * folder is listed in the default one as the person's, so that an agent's later command there reads it. Not from the
 * sources, not for an isolated installation (nothing outside its folders), never a folder inside a tree or the shared
 * folder. Cheap: the list read first, the parent processes only for a folder not listed yet.
 */
export function notePersonFolder(env: Env, o: { cwd?: string; inst?: Installation; platform?: NodeJS.Platform } = {}): boolean {
  const inst = o.inst ?? installation();
  const platform = o.platform ?? process.platform;
  if (inst.kind === "source" && env.STROM_TEST_V2 !== "1") return false;
  if (isAgent(env) || isolated(env) || isolated(inst.env ?? {})) return false;
  const here = configDir(env, platform);
  const dflt = defaultSettingsDir(env, platform, inst);
  if (same(here, dflt) || !fs.existsSync(here)) return false;
  const listed = personFolders(dflt);
  if (listed.some((p) => same(p, here))) return false;
  if (agentInAncestry(env, inst, platform)) return false;
  const cwdTree = findTreeUpwards(o.cwd ?? process.cwd());
  if ([...placesOf(env), ...(cwdTree ? [cwdTree] : [])].some((p) => inside(here, p))) return false;
  try {
    fs.mkdirSync(dflt, { recursive: true });
    const file = path.join(dflt, FOLDERS);
    const v = readJsonIfExists<{ folders?: { path: string; at: string }[] }>(file) ?? {};
    writeJson(file, { ...v, folders: [...(v.folders ?? []).filter((f) => f && typeof f.path === "string"), { path: here, at: new Date().toISOString() }] });
    return true;
  } catch {
    return false;
  }
}
