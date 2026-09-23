// What strom put on this computer outside the research, and taking it away
// again (strom uninstall): what the agents were taught, the shortcut, strom's
// own git, the PATH lines of the installer and the program itself. The
// research stays, and so do the settings with the keys that seal it — they
// are the user's; strom says where they are.

import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import type { Env } from "./paths.ts";
import { desktopDir, userHome } from "./paths.ts";
import { ownGitDir } from "./git.ts";
import { globalTargets, isInstalled, uninstallGlobal } from "../agents/global.ts";
import { PROFILES } from "../agents/profiles.ts";
import { installation, type Installation } from "./self.ts";

/** The mark the installer (install/install.sh) puts on the PATH line it adds. */
const MARK = "# strom research";

export interface Removal {
  /** What it is: what an agent was taught, the shortcut, strom's own git, a PATH entry, the program. */
  kind: "agent" | "shortcut" | "git" | "path" | "program";
  /** The agent's name (kind agent). */
  agent?: string;
  path: string;
  remove(): boolean;
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
        ? names.map((n) => path.join(desktop, `${n}.cmd`))
        : [path.join(env.XDG_DATA_HOME ?? path.join(userHome(env), ".local", "share"), "applications", "strom-research.desktop"), path.join(desktop, "strom-research.desktop")];
  return [...new Set(files)].filter((f) => {
    try {
      return /strom/i.test(fs.readFileSync(f, "utf8"));
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
function removeInstallation(root: string, launchers: string[], platform: NodeJS.Platform): boolean {
  const outside = launchers.filter((l) => path.dirname(l) !== root);
  for (const l of outside) fs.rmSync(l, { force: true });
  if (platform !== "win32") {
    fs.rmSync(root, { recursive: true, force: true });
    return true;
  }
  const child = spawn(process.env.ComSpec ?? "cmd.exe", ["/d", "/c", `ping 127.0.0.1 -n 3 >nul & rmdir /s /q "${root}"`], {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });
  child.unref();
  return true;
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
  const inst = opts.install ?? installation();
  const git = ownGitDir(env);
  // strom's own git lives in the installation's folder on Windows; alone, it goes by itself.
  if (platform === "win32" && exists(git) && !(inst.root && git.startsWith(inst.root + path.sep)))
    remove.push({ kind: "git", path: git, remove: () => (fs.rmSync(git, { recursive: true, force: true }), true) });
  if (platform !== "win32") {
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
    if (platform === "win32") for (const d of dirs.filter((d) => onWindowsPath(d))) remove.push({ kind: "path", path: d, remove: () => dropWindowsPath(d) });
    remove.push({ kind: "program", path: program, remove: () => removeInstallation(program, launchers, platform) });
  }
  return { remove, npm: inst.kind === "npm", ...(program ? { program } : {}) };
}
