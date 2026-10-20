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
