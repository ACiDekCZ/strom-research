// Platform-aware default locations. Nothing here touches the disk except
// existence checks; resolution order lives in config.ts.

import os from "node:os";
import path from "node:path";
import fs from "node:fs";

export type Env = Record<string, string | undefined>;

/**
 * An isolated installation (STROM_ISOLATED=1, its installer keeps it in install.json): a second strom beside the
 * person's own, for trying a version — nothing outside its folders: no PATH, no strom-research:// links, nothing
 * taught to the agents.
 */
export function isolated(env: Env): boolean {
  return env.STROM_ISOLATED === "1";
}

/**
 * The tar that unpacks strom's downloads (.tar.gz, and .zip on Windows): on Windows the system's own bsdtar
 * (%SystemRoot%\System32\tar.exe, Windows 10 and later) — with Git's usr\bin first on PATH (strom started from Git
 * Bash, as agents often are) "tar" is GNU tar, which reads C:\… as a remote host and fails (found on Windows); PATH's
 * only where the system has none.
 */
export function tarProgram(env: Env, platform: NodeJS.Platform = process.platform, exists: (file: string) => boolean = fs.existsSync): string {
  if (platform !== "win32") return "tar";
  const own = path.win32.join(env.SystemRoot ?? env.SYSTEMROOT ?? env.windir ?? "C:\\Windows", "System32", "tar.exe");
  return exists(own) ? own : "tar";
}

/** The name of a second installation's own command: strom-<letters and digits>, never strom itself. */
export const COMMAND_NAME = /^strom-[a-z0-9]{1,20}$/;

/**
 * A second strom's own command (STROM_COMMAND, the installer keeps it in install.json: strom-beta): only an isolated
 * installation has one. It has its own links (strom-research-<suffix>://) and its own folder of researches.
 */
export function ownCommand(env: Env): string | undefined {
  const c = env.STROM_COMMAND;
  return isolated(env) && c && COMMAND_NAME.test(c) ? c : undefined;
}

/** What tells a second installation with a command of its own apart: "beta" of strom-beta. */
export function ownSuffix(env: Env): string | undefined {
  return ownCommand(env)?.slice("strom-".length);
}

/** An isolated installation without a command of its own: no links at all (they stay the person's own strom's). */
export function noLinks(env: Env): boolean {
  return isolated(env) && !ownCommand(env);
}

export function userHome(env: Env): string {
  return env.HOME || env.USERPROFILE || os.homedir();
}

/** Directory holding the small user config (the pointer to the Strom home). */
export function configDir(env: Env, platform: NodeJS.Platform = process.platform): string {
  if (env.STROM_CONFIG_DIR) return path.resolve(env.STROM_CONFIG_DIR);
  if (platform === "win32") {
    const appData = env.APPDATA || path.join(userHome(env), "AppData", "Roaming");
    return path.join(appData, "strom");
  }
  const xdg = env.XDG_CONFIG_HOME || path.join(userHome(env), ".config");
  return path.join(xdg, "strom");
}

/** A folder of the XDG user dirs on Linux (XDG_DOCUMENTS_DIR, XDG_DESKTOP_DIR), if it is set. */
function xdgUserDir(env: Env, key: string): string | undefined {
  const home = userHome(env);
  const fromEnv = env[key];
  if (fromEnv) return fromEnv.replace(/^\$HOME/, home);
  const userDirs = path.join(env.XDG_CONFIG_HOME || path.join(home, ".config"), "user-dirs.dirs");
  try {
    const m = new RegExp(`^${key}="(.+)"$`, "m").exec(fs.readFileSync(userDirs, "utf8"));
    if (m?.[1]) return m[1].replace(/^\$HOME/, home);
  } catch {
    // no user-dirs file
  }
  return undefined;
}

/** The user's documents folder (localized names are resolved by the OS). */
export function documentsDir(env: Env, platform: NodeJS.Platform = process.platform): string {
  if (env.STROM_DOCUMENTS) return path.resolve(expandHome(env.STROM_DOCUMENTS, env));
  const home = userHome(env);
  if (platform === "linux") return (isolated(env) ? undefined : xdgUserDir(env, "XDG_DOCUMENTS_DIR")) ?? path.join(home, "Documents");
  // OneDrive keeps the documents on Windows when it backs them up, as it does the desktop.
  if (platform === "win32") {
    // (an isolated installation: its own HOME only)
    const oneDrive = env.OneDrive && !isolated(env) ? path.join(env.OneDrive, "Documents") : undefined;
    if (oneDrive && fs.existsSync(oneDrive)) return oneDrive;
  }
  return path.join(home, "Documents");
}

/** The desktop folder (OneDrive keeps it on Windows when it backs the desktop up). */
export function desktopDir(env: Env, platform: NodeJS.Platform = process.platform): string {
  const home = userHome(env);
  if (platform === "linux") return (isolated(env) ? undefined : xdgUserDir(env, "XDG_DESKTOP_DIR")) ?? path.join(home, "Desktop");
  if (platform === "win32") {
    // (an isolated installation: its own HOME only)
    const oneDrive = env.OneDrive && !isolated(env) ? path.join(env.OneDrive, "Desktop") : undefined;
    if (oneDrive && fs.existsSync(oneDrive)) return oneDrive;
  }
  return path.join(home, "Desktop");
}

/**
 * Suggested Strom home: <Documents>/Strom. A second installation never the person's own: with a command of its own
 * <Documents>/Strom <suffix> ("Strom beta"), else a folder inside its own settings folder (STROM_CONFIG_DIR) —
 * never inside the program's folder, which strom uninstall takes away (found 2026-10-07: the research and its
 * backups went with it); the settings folder stays, and so does the research in it. Named "Strom research".
 * (Isolated installations set up before keep the home their settings name: nothing is moved.)
 */
export function defaultHome(env: Env, platform: NodeJS.Platform = process.platform): string {
  if (!isolated(env)) return path.join(documentsDir(env, platform), "Strom");
  const suffix = ownSuffix(env);
  if (suffix) return path.join(documentsDir(env, platform), `Strom ${suffix}`);
  return path.join(configDir(env, platform), ISOLATED_HOME);
}

/** The research folder of an isolated installation without a command of its own, inside its settings folder. */
export const ISOLATED_HOME = "Strom research";

/** Expand a leading "~" so users and agents can pass "~/Documents/Strom". */
export function expandHome(p: string, env: Env): string {
  if (p === "~") return userHome(env);
  if (p.startsWith("~/") || p.startsWith("~\\")) return path.join(userHome(env), p.slice(2));
  return p;
}

/** Show paths inside the user's home as "~/..." to keep output short. */
export function displayPath(p: string, env: Env): string {
  const home = userHome(env);
  if (p === home) return "~";
  if (p.startsWith(home + path.sep)) return "~" + path.sep + p.slice(home.length + 1);
  return p;
}
