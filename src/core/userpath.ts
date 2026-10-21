// The PATH of the person's terminal, for a strom started without it.
//
// A strom the system starts — a link from the Strom app through the applet (macOS: do shell script), the bridge and
// the phone's server it starts, a login item — gets the system's bare PATH (/usr/bin:/bin:/usr/sbin:/sbin), not the
// one the person's shell profile builds: the agent in ~/.local/bin, Node of an agent installed by npm, are not on it
// (found on Mac: "Read the document" from the app said no agent is set up). strom remembers the PATH of the last
// strom the person ran in a terminal, and every strom puts what of it, and of the folders the agents' installers use,
// is missing at the end of its own PATH — never before it: what the process was given comes first (the strom of a
// research's .strom/bin before the person's own). The person's shell is never run to ask (a profile may print,
// ask, take long — or be fish's).

import path from "node:path";
import { agentBinDirs } from "./install.ts";
import type { Env } from "./paths.ts";

/** The PATH of this environment (Windows: Path in a copy of it). */
export function pathOf(env: Env): string {
  return env.PATH ?? env.Path ?? "";
}

/**
 * The PATH to remember from a strom the person runs in a terminal (not an agent's, not one strom started), or
 * undefined: none to remember, or the one remembered already.
 */
export function pathToRemember(env: Env, remembered: string | undefined): string | undefined {
  const now = pathOf(env);
  if (!now.trim() || now === remembered) return undefined;
  return now;
}

/** The PATH with what is missing of the remembered one and of the agents' folders at its end; undefined: nothing missing. */
export function fullerPath(env: Env, remembered: string | undefined, platform: NodeJS.Platform = process.platform): string | undefined {
  const now = pathOf(env);
  const delimiter = platform === "win32" ? ";" : ":";
  const key = (dir: string): string => {
    const d = dir.replace(/[\\/]+$/, "") || dir;
    return platform === "win32" ? d.replace(/\//g, "\\").toLowerCase() : d;
  };
  const dirs = now.split(delimiter).filter(Boolean);
  const have = new Set(dirs.map(key));
  const more: string[] = [];
  for (const dir of [...(remembered ?? "").split(delimiter), ...agentBinDirs(env, platform)]) {
    if (!dir || !(platform === "win32" ? path.win32 : path.posix).isAbsolute(dir) || have.has(key(dir))) continue;
    have.add(key(dir));
    more.push(dir);
  }
  return more.length ? [...dirs, ...more].join(delimiter) : undefined;
}

/** The environment given the fuller PATH (in place: what this strom starts gets it too). Whether it changed. */
export function completePath(env: Env, remembered: string | undefined, platform: NodeJS.Platform = process.platform): boolean {
  const fuller = fullerPath(env, remembered, platform);
  if (fuller === undefined) return false;
  // (a copy of Windows' environment keeps the name Path; the process's own takes either)
  if (platform === "win32" && env.PATH === undefined && env.Path !== undefined) env.Path = fuller;
  else env.PATH = fuller;
  return true;
}

/**
 * How the menu's goodbye says to start strom again in the terminal it ends in.
 *   name    `strom` (its own command's name): the folder of its command is on the PATH this terminal gave it
 *   new     a new terminal window knows `strom`, this one not yet: its full path for this one — the folder is not on
 *           the PATH it was given (install.sh writes it into the shell's profile, which a window already open never
 *           reads), and on Windows whenever the one-line installer started it (STROM_INSTALLER): install.ps1 puts the
 *           folder on the user's PATH and on the PATH of the process it starts strom from, never on the PATH of the
 *           window it was run from (the Strom app's line runs it in a child powershell -c), and Windows Terminal's new
 *           tabs keep the old one until it is started again — what PATH strom was given then says nothing of the window
 *   path    an isolated installation: nothing of it on PATH — always its full path; and any installation whose name
 *           another command of that name answers first (`found`: one in a folder of the PATH before its own, or on it
 *           when its own is not — an older installation, npm's: found on Windows, `strom` ran 1.12.0)
 * Not installed by the installers (npm, the sources): `name`, as before.
 */
export function startAgain(o: {
  platform: NodeJS.Platform;
  given: string;
  installer: boolean;
  launchers: readonly string[];
  command: string;
  isolated: boolean;
  /** Whether a file is there (another command of the name on the PATH); nothing said: none is. */
  found?: (file: string) => boolean;
}): { kind: "name" } | { kind: "new" | "path"; path: string } {
  const p = o.platform === "win32" ? path.win32 : path.posix;
  const want = o.platform === "win32" ? `${o.command}.cmd` : o.command;
  const launcher = o.launchers.find((l) => (o.platform === "win32" ? p.basename(l).toLowerCase() === want.toLowerCase() : p.basename(l) === want));
  if (!launcher) return { kind: "name" };
  const key = (dir: string): string => {
    const d = dir.replace(/[\\/]+$/, "") || dir;
    return o.platform === "win32" ? d.replace(/\//g, "\\").toLowerCase() : d;
  };
  const dir = key(p.dirname(launcher));
  // the folders in the order the terminal looks: its own, or another command of the name before it
  // (Windows: what PowerShell and cmd run by the name — never a file without its extension)
  const names = o.platform === "win32" ? [".ps1", ".exe", ".cmd", ".bat", ".com"].map((e) => `${o.command}${e}`) : [o.command];
  let onPath = false;
  let other = false;
  for (const d of o.given.split(o.platform === "win32" ? ";" : ":")) {
    if (!d) continue;
    if (key(d) === dir) {
      onPath = true;
      break;
    }
    if (o.found && names.some((n) => o.found!(p.join(d, n)))) {
      other = true;
      break;
    }
  }
  // written so that the terminal runs it: PowerShell (where the one-line installer runs) needs & before a quoted path
  const shown = !/[\s'"&;$`()]/.test(launcher) ? launcher : o.platform === "win32" ? `& "${launcher}"` : `'${launcher.replace(/'/g, `'\\''`)}'`;
  if (other) return { kind: "path", path: shown };
  if (o.isolated) return onPath ? { kind: "name" } : { kind: "path", path: shown };
  if (onPath && !(o.platform === "win32" && o.installer)) return { kind: "name" };
  return { kind: "new", path: shown };
}
