// What strom put on this computer outside the research, and taking it away
// again (strom uninstall): what the agents were taught, the shortcut, strom's
// own git, the PATH lines of the installer and the program itself. The
// research stays, and so do the settings with the keys that seal it — they
// are the user's; strom says where they are.

import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import type { Env } from "./paths.ts";
import { desktopDir, isolated, noLinks, ownCommand, userHome } from "./paths.ts";
import { ownGitDir } from "./git.ts";
import { shortcutCmdDir } from "./shortcut.ts";
import { globalTargets, isInstalled, uninstallGlobal } from "../agents/global.ts";
import { PROFILES } from "../agents/profiles.ts";
import { holdsPath, installation, pathForms, PROGRAM_ENTRIES, type Installation } from "./self.ts";
import { linkFiles, linkOwner, unregisterLinks } from "./links.ts";

/** The mark the installer (install/install.sh) puts on the PATH line it adds. */
const MARK = "# strom research";

export interface Removal {
  /** What it is: what an agent was taught, the shortcut, strom's own git, a PATH entry, the program. */
  kind: "agent" | "shortcut" | "links" | "git" | "path" | "program";
  /** The agent's name (kind agent). */
  agent?: string;
  path: string;
  /** Done; false: it failed; "later": once this process has ended (the program on Windows: its Node runs it). */
  remove(): boolean | "later";
}

/** A strom of this installation running now (not this one): a bridge, or one in another window. */
export interface OwnProcess {
  pid: number;
  /** strom's arguments ("live serve", "menu", "" for the menu). */
  args: string;
  bridge: boolean;
}

type Sys = (cmd: string, args: string[]) => { status: number | null; stdout: string };
const sys: Sys = (cmd, args) => {
  const r = spawnSync(cmd, args, { encoding: "utf8", timeout: 20_000, windowsHide: true });
  return { status: r.status, stdout: r.stdout ?? "" };
};

/** End a process of this installation (a bridge nobody could stop as a bridge): asked, then forced. */
export function endProcess(pid: number, waitMs = 3000): boolean {
  const alive = () => {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  };
  try {
    process.kill(pid);
  } catch {
    return !alive();
  }
  for (const until = Date.now() + waitMs; Date.now() < until && alive(); ) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
  if (alive())
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      // gone meanwhile
    }
  return !alive();
}

/**
 * The strom processes of the installation in `root` — its own Node running its code — other than this one and the
 * one that started it (found on Windows: an open menu and a bridge kept the folder, which then stayed whole).
 */
export function ownProcesses(root: string, platform: NodeJS.Platform = process.platform, run: Sys = sys): OwnProcess[] {
  const node = platform === "win32" ? path.win32.join(root, "node", "node.exe") : path.posix.join(root, "node", "bin", "node");
  const lines: { pid: number; exe: string; command: string }[] = [];
  if (platform === "win32") {
    const r = run("powershell.exe", [
      "-NoProfile", "-NonInteractive", "-Command",
      "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Select-Object ProcessId,ExecutablePath,CommandLine | ConvertTo-Json -Compress",
    ]);
    try {
      const got = JSON.parse(r.stdout || "[]") as { ProcessId: number; ExecutablePath?: string; CommandLine?: string } | { ProcessId: number; ExecutablePath?: string; CommandLine?: string }[];
      for (const p of Array.isArray(got) ? got : [got]) lines.push({ pid: p.ProcessId, exe: p.ExecutablePath ?? "", command: p.CommandLine ?? "" });
    } catch {
      return [];
    }
  } else {
    const r = run("ps", ["-axo", "pid=,command="]);
    for (const l of r.stdout.split("\n")) {
      const m = /^\s*(\d+)\s+(.*)$/.exec(l);
      if (m && m[2]!.startsWith(node)) lines.push({ pid: Number(m[1]), exe: node, command: m[2]! });
    }
  }
  const same = (a: string, b: string) => (platform === "win32" ? a.toLowerCase() === b.toLowerCase() : a === b);
  return lines
    .filter((l) => same(l.exe, node) && l.pid !== process.pid && l.pid !== process.ppid)
    .map((l) => {
      const args = (/cli\.js"?\s*(.*)$/.exec(l.command)?.[1] ?? "").trim();
      return { pid: l.pid, args, bridge: /^live serve\b/.test(args) };
    });
}

function exists(p: string): boolean {
  try {
    fs.lstatSync(p);
    return true;
  } catch {
    return false;
  }
}

/** A shortcut strom made: its name in any language strom speaks, and it starts strom. */
function shortcuts(env: Env, platform: NodeJS.Platform, names: string[]): string[] {
  const desktop = desktopDir(env, platform);
  const files =
    platform === "darwin"
      ? names.map((n) => path.join(desktop, `${n}.command`))
      : platform === "win32"
        ? names.flatMap((n) => [path.join(desktop, `${n}.lnk`), path.join(desktop, `${n}.cmd`), path.join(shortcutCmdDir(env, platform), `${n}.cmd`)])
        : [path.join(env.XDG_DATA_HOME ?? path.join(userHome(env), ".local", "share"), "applications", "strom-research.desktop"), path.join(desktop, "strom-research.desktop")];
  return [...new Set(files)].filter((f) => {
    try {
      // a .lnk holds its paths in UTF-16: read it without the zero bytes
      return /strom/i.test(fs.readFileSync(f).toString("latin1").replace(/\0/g, ""));
    } catch {
      return false;
    }
  });
}

/** Shell files with the installer's PATH line. */
function pathLines(env: Env): string[] {
  const home = userHome(env);
  return [".zshrc", ".bashrc", ".bash_profile", ".profile"].map((f) => path.join(home, f)).filter((f) => {
    try {
      return fs.readFileSync(f, "utf8").includes(MARK);
    } catch {
      return false;
    }
  });
}

function dropLines(file: string): boolean {
  const text = fs.readFileSync(file, "utf8");
  const kept = text.split("\n").filter((l) => !l.includes(MARK));
  // the installer put a blank line before its own
  const out = kept.join("\n").replace(/\n\n+$/, "\n");
  fs.writeFileSync(file, out);
  return true;
}

/** The user's PATH on Windows without this folder. */
function dropWindowsPath(dir: string): boolean {
  const ps = `$d='${dir.replace(/'/g, "''")}'; $p=[Environment]::GetEnvironmentVariable('Path','User'); if ($p) { [Environment]::SetEnvironmentVariable('Path', (($p -split ';') | Where-Object { $_ -and $_ -ne $d }) -join ';', 'User') }`;
  return spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", ps], { stdio: "ignore", windowsHide: true }).status === 0;
}

function onWindowsPath(dir: string): boolean {
  const r = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", "[Environment]::GetEnvironmentVariable('Path','User')"], { encoding: "utf8", windowsHide: true });
  return r.status === 0 && r.stdout.split(";").map((s) => s.trim()).includes(dir);
}

/**
 * What the installer, strom update and strom's own git put into an installation's folder — the one thing strom
 * uninstall takes from it (found 2026-10-07: the whole folder went, an isolated installation's research and its
 * backups in it). Folders: Node, strom's code (and the one an update or the installer set aside), strom's own git
 * (MinGit on Windows) with what its download leaves; files: install.json, the launchers (strom, strom.cmd; strom.exe of
 * an older strom). Besides: the update's work folders (.update-…), bin with a second installation's launchers (only
 * when nothing else is left in it), and what a system leaves in any folder it shows (.DS_Store, Thumbs.db,
 * desktop.ini). Anything else — a research, backups, a file the person put there — stays, and so does the folder.
 */
const OUR_DIRS = new Set<string>(PROGRAM_ENTRIES);
const OUR_FILES = new Set(["install.json", "strom", "strom.cmd", "strom.exe", "git.zip", ".DS_Store", "Thumbs.db", "desktop.ini"]);

/** One entry of an installation's folder that strom uninstall takes away. */
export interface OurEntry {
  name: string;
  dir: boolean;
}

/** `entry` is, or holds, one of `keep` (a research, the home, the trees, the shared folder, the backups, the settings). */
export function holdsKept(entry: string, keep: string[], platform: NodeJS.Platform = process.platform): boolean {
  return keep.some((k) => holdsPath(entry, k, platform));
}

/**
 * The entries of the installation's folder strom uninstall takes away: only those the installer, update or strom's own
 * git made (a launcher only as a file: on a disk that ignores case "strom" may be a folder "Strom"), never one that is
 * or holds what `keep` names.
 */
export function ourEntries(root: string, keep: string[] = [], platform: NodeJS.Platform = process.platform): OurEntry[] {
  let names: string[];
  try {
    names = fs.readdirSync(root);
  } catch {
    return [];
  }
  const out: OurEntry[] = [];
  for (const name of names) {
    let st: fs.Stats;
    try {
      st = fs.lstatSync(path.join(root, name));
    } catch {
      continue;
    }
    const dir = st.isDirectory();
    const ours = dir ? OUR_DIRS.has(name) || /^\.update-/.test(name) : OUR_FILES.has(name);
    if (!ours || holdsKept(path.join(root, name), keep, platform)) continue;
    out.push({ name, dir });
  }
  return out;
}

/** What stays in the installation's folder after strom uninstall: everything it did not make (bin: its launchers only). */
export function notOurs(root: string, launchers: string[] = [], keep: string[] = [], platform: NodeJS.Platform = process.platform): string[] {
  const ours = new Set(ourEntries(root, keep, platform).map((e) => e.name));
  const launcherSet = new Set(launchers.flatMap((l) => pathForms(l, platform)));
  let names: string[];
  try {
    names = fs.readdirSync(root);
  } catch {
    return [];
  }
  return names.filter((n) => {
    if (ours.has(n)) return false;
    if (n === "bin") {
      try {
        return fs.readdirSync(path.join(root, n)).some((f) => !pathForms(path.join(root, n, f), platform).some((x) => launcherSet.has(x)));
      } catch {
        return true;
      }
    }
    return true;
  });
}

/** The names the installers give strom's launchers: strom, strom.cmd (strom.exe of an older strom), a second installation's strom-<suffix>(.cmd). */
const LAUNCHER_NAME = /^strom(-[a-z0-9]{1,20})?(\.(cmd|exe))?$/i;

/**
 * The launchers install.json names that strom uninstall takes: a file of a launcher's name only, never one lying in
 * what is kept (a research, its backups, the home, the trees, the shared folder, the settings) — install.json is a file
 * anyone can edit (found 2026-10-07: a tree's strom.json listed there went, while the output said the research stays).
 * `skipped`: the others, said and left where they are.
 */
export function launchersToTake(launchers: string[], keep: string[] = [], platform: NodeJS.Platform = process.platform): { take: string[]; skipped: string[] } {
  const take: string[] = [];
  const skipped: string[] = [];
  for (const l of launchers) {
    if (typeof l !== "string" || !l) continue;
    const name = platform === "win32" ? path.win32.basename(l) : path.basename(l);
    const ok = LAUNCHER_NAME.test(name) && !keep.some((k) => holdsPath(k, l, platform)) && !holdsKept(l, keep, platform);
    (ok ? take : skipped).push(l);
  }
  return { take, skipped };
}

/**
 * strom as the installer put it: what it made in its folder (Node, strom's code, strom's own git, the launchers,
 * install.json) and the commands on PATH; the folder itself only when nothing else is left in it. A running program
 * can be deleted on macOS and Linux; on Windows a small command deletes it a moment after strom ends. True: all of
 * strom's own is gone (the folder may stay with what is not strom's).
 */
function removeInstallation(root: string, launchers: string[], platform: NodeJS.Platform, keep: string[], later: (command: string) => void = runLater): boolean | "later" {
  if (platform !== "win32") {
    for (const l of launchers.filter((l) => path.dirname(l) !== root)) {
      // a launcher is a file: never a folder of that name, never what is kept
      if (!holdsKept(l, keep, platform) && !isDir(l)) fs.rmSync(l, { force: true });
    }
    for (const e of ourEntries(root, keep, platform)) fs.rmSync(path.join(root, e.name), { recursive: e.dir, force: true });
    for (const d of [path.join(root, "bin"), root]) {
      try {
        fs.rmdirSync(d); // only when empty
      } catch {
        // something stays in it: kept
      }
    }
    return ourEntries(root, keep, platform).length === 0;
  }
  later(windowsRemoval(root, launchers, ourEntries(root, keep, platform)));
  return "later";
}

function isDir(p: string): boolean {
  try {
    return fs.lstatSync(p).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Windows: the command that takes the installation away once this strom has ended. Its Node runs this, and cmd runs
 * the launcher (strom.cmd, bin\strom-beta.cmd) that started it: a launcher deleted while cmd still reads it ends in
 * "The batch file cannot be found." and exit 1 (found on Windows). So nothing goes before its node.exe can be deleted
 * (a running program cannot), then a moment for cmd to finish the launcher, then the launchers outside the folder and
 * the entries strom made in it (`entries`, from ourEntries) — tried a while (a window closing); bin and the folder
 * itself only when empty (rmdir without /s): what strom did not make stays, and the folder with it.
 */
export function windowsRemoval(root: string, launchers: string[], entries: OurEntry[]): string {
  const join = path.win32.join;
  const node = join(root, "node", "node.exe");
  // (a launcher by its name only: launchersToTake chose them, this command holds to it too)
  const outside = launchers.filter((l) => LAUNCHER_NAME.test(path.win32.basename(l)) && path.win32.dirname(l) !== root && path.dirname(l) !== root);
  const del = outside.length ? `del /f /q ${outside.map((l) => `"${l}"`).join(" ")} 2>nul & ` : "";
  const ours = entries.map((e) => (e.dir ? `rmdir /s /q "${join(root, e.name)}" 2>nul & ` : `del /f /q "${join(root, e.name)}" 2>nul & `)).join("");
  const dirs = entries.filter((e) => e.dir).map((e) => join(root, e.name));
  // done once every folder of strom's is gone (the files go with a plain del)
  const done = dirs.length ? `${dirs.map((d) => `if not exist "${d}" `).join("")}exit /b 0` : "exit /b 0";
  // (verbatim: Node would put backslashes before the quotes, which cmd does not read)
  return `for /l %i in (1,1,30) do @(ping 127.0.0.1 -n 3 >nul & del /f /q "${node}" 2>nul & if not exist "${node}" (ping 127.0.0.1 -n 2 >nul & ${del}${ours}rmdir "${join(root, "bin")}" 2>nul & rmdir "${root}" 2>nul & ${done}))`;
}

function runLater(command: string): void {
  const child = spawn(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", `"${command}"`], {
    windowsVerbatimArguments: true,
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });
  child.unref();
}

export interface UninstallPlan {
  remove: Removal[];
  /** Installed through npm: the program is removed by npm, not by strom. */
  npm: boolean;
  program?: string;
  /** The program's launchers (install.json) strom uninstall takes. */
  launchers?: string[];
  /** What install.json names as a launcher but is none (another name, or it lies in the research): left where it is. */
  skipped?: string[];
}

/** What strom uninstall takes away here. `names` are the shortcut's names in the languages strom speaks. */
export function uninstallPlan(
  env: Env,
  names: string[],
  opts: {
    platform?: NodeJS.Platform;
    install?: Installation;
    /** Windows: runs the command that removes the program once strom has ended (tests). */ later?: (command: string) => void;
    /** What is never taken, nor a folder holding it: the researches, the home, the trees, the shared folder, the backups, the settings. */
    keep?: string[];
  } = {},
): UninstallPlan {
  const platform = opts.platform ?? process.platform;
  const remove: Removal[] = [];
  for (const t of globalTargets(env).filter((t) => isInstalled(t)))
    remove.push({ kind: "agent", agent: PROFILES[t.agent]?.name ?? t.agent, path: t.file, remove: () => uninstallGlobal(t) });
  for (const f of shortcuts(env, platform, names)) remove.push({ kind: "shortcut", path: f, remove: () => (fs.rmSync(f, { force: true }), true) });
  // this strom's links (or a strom's no longer there) — never another installation's
  // (an isolated installation made none — one with a command of its own only its own scheme's)
  if (!noLinks(env) && linkOwner(env, platform).owner !== "other")
    for (const f of linkFiles(env, platform)) remove.push({ kind: "links", path: f, remove: () => unregisterLinks(env, platform) });
  const inst = opts.install ?? installation();
  const git = ownGitDir(env);
  // strom's own git lives in the installation's folder on Windows; alone, it goes by itself.
  const keep = opts.keep ?? [];
  if (platform === "win32" && exists(git) && !(inst.root && git.startsWith(inst.root + path.sep)) && !holdsKept(git, keep, platform))
    remove.push({ kind: "git", path: git, remove: () => (fs.rmSync(git, { recursive: true, force: true }), true) });
  // an isolated installation put no line on PATH: those there are the person's own strom's
  if (platform !== "win32" && !isolated(env)) {
    for (const f of pathLines(env)) remove.push({ kind: "path", path: f, remove: () => dropLines(f) });
    const fish = path.join(env.XDG_CONFIG_HOME ?? path.join(userHome(env), ".config"), "fish", "conf.d", "strom.fish");
    try {
      if (fs.readFileSync(fish, "utf8").includes(MARK)) remove.push({ kind: "path", path: fish, remove: () => (fs.rmSync(fish, { force: true }), true) });
    } catch {
      // none
    }
  }
  const program = inst.kind === "installed" ? inst.root : undefined;
  // install.json's launchers: those of a launcher's name outside the research only
  const chosen = launchersToTake(inst.launchers ?? [], keep, platform);
  if (program) {
    const launchers = chosen.take;
    const dirs = [...new Set([program, ...launchers.map((l) => path.dirname(l))])];
    // (an isolated installation: none — one with a command of its own, the folder of that command)
    if (platform === "win32" && (!isolated(env) || ownCommand(env))) for (const d of dirs.filter((d) => onWindowsPath(d))) remove.push({ kind: "path", path: d, remove: () => dropWindowsPath(d) });
    remove.push({ kind: "program", path: program, remove: () => removeInstallation(program, launchers, platform, keep, opts.later) });
  }
  // a launcher in the program's folder itself goes with what the installer put there (ourEntries) — the research lying
  // in that folder too (found on a Mac: said to stay, and taken): what is said to stay is what stays
  const taken = new Set(program ? ourEntries(program, keep, platform).filter((e) => !e.dir).flatMap((e) => pathForms(path.join(program, e.name), platform)) : []);
  const skipped = chosen.skipped.filter((l) => !pathForms(l, platform).some((f) => taken.has(f)));
  return { remove, npm: inst.kind === "npm", ...(program ? { program, launchers: chosen.take, skipped } : {}) };
}
