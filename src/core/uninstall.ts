// What strom put on this computer outside the research, and taking it away
// again (strom uninstall): what the agents were taught, the shortcut, strom's
// own git, the PATH lines of the installer and the program itself. The
// research stays, and so do the settings with the keys that seal it — they
// are the user's; strom says where they are.

import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import type { Env } from "./paths.ts";
import { desktopDir, isolated, userHome } from "./paths.ts";
import { ownGitDir } from "./git.ts";
import { shortcutCmdDir } from "./shortcut.ts";
import { globalTargets, isInstalled, uninstallGlobal } from "../agents/global.ts";
import { PROFILES } from "../agents/profiles.ts";
import { installation, type Installation } from "./self.ts";
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
 * strom as the installer put it: its folder (Node, strom's code, strom's own
 * git) and the commands on PATH. A running program can be deleted on macOS and
 * Linux; on Windows the folder is deleted by a small command a moment after
 * strom ends.
 */
function removeInstallation(root: string, launchers: string[], platform: NodeJS.Platform): boolean | "later" {
  const outside = launchers.filter((l) => path.dirname(l) !== root);
  for (const l of outside) fs.rmSync(l, { force: true });
  if (platform !== "win32") {
    fs.rmSync(root, { recursive: true, force: true });
    return !fs.existsSync(root);
  }
  // Windows: its Node runs this — the folder goes once it has ended (tried a while: a window closing)
  // (verbatim: Node would put backslashes before the quotes, which cmd does not read)
  const command = `for /l %i in (1,1,15) do @(ping 127.0.0.1 -n 3 >nul & rmdir /s /q "${root}" 2>nul & if not exist "${root}" exit /b 0)`;
  const child = spawn(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", `"${command}"`], {
    windowsVerbatimArguments: true,
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });
  child.unref();
  return "later";
}

export interface UninstallPlan {
  remove: Removal[];
  /** Installed through npm: the program is removed by npm, not by strom. */
  npm: boolean;
  program?: string;
}

/** What strom uninstall takes away here. `names` are the shortcut's names in the languages strom speaks. */
export function uninstallPlan(env: Env, names: string[], opts: { platform?: NodeJS.Platform; install?: Installation } = {}): UninstallPlan {
  const platform = opts.platform ?? process.platform;
  const remove: Removal[] = [];
  for (const t of globalTargets(env).filter((t) => isInstalled(t)))
    remove.push({ kind: "agent", agent: PROFILES[t.agent]?.name ?? t.agent, path: t.file, remove: () => uninstallGlobal(t) });
  for (const f of shortcuts(env, platform, names)) remove.push({ kind: "shortcut", path: f, remove: () => (fs.rmSync(f, { force: true }), true) });
  // this strom's links (or a strom's no longer there) — never another installation's
  // (an isolated installation made none)
  if (!isolated(env) && linkOwner(env, platform).owner !== "other")
    for (const f of linkFiles(env, platform)) remove.push({ kind: "links", path: f, remove: () => unregisterLinks(env, platform) });
  const inst = opts.install ?? installation();
  const git = ownGitDir(env);
  // strom's own git lives in the installation's folder on Windows; alone, it goes by itself.
  if (platform === "win32" && exists(git) && !(inst.root && git.startsWith(inst.root + path.sep)))
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
  if (program) {
    const launchers = inst.launchers ?? [];
    const dirs = [...new Set([program, ...launchers.map((l) => path.dirname(l))])];
    if (platform === "win32" && !isolated(env)) for (const d of dirs.filter((d) => onWindowsPath(d))) remove.push({ kind: "path", path: d, remove: () => dropWindowsPath(d) });
    remove.push({ kind: "program", path: program, remove: () => removeInstallation(program, launchers, platform) });
  }
  return { remove, npm: inst.kind === "npm", ...(program ? { program } : {}) };
}
