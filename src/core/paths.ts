// Platform-aware default locations. Nothing here touches the disk except
// existence checks; resolution order lives in config.ts.

import os from "node:os";
import path from "node:path";
import fs from "node:fs";

export type Env = Record<string, string | undefined>;

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
  if (platform === "linux") return xdgUserDir(env, "XDG_DOCUMENTS_DIR") ?? path.join(home, "Documents");
  // OneDrive keeps the documents on Windows when it backs them up, as it does the desktop.
  if (platform === "win32") {
    const oneDrive = env.OneDrive ? path.join(env.OneDrive, "Documents") : undefined;
    if (oneDrive && fs.existsSync(oneDrive)) return oneDrive;
  }
  return path.join(home, "Documents");
}

/** The desktop folder (OneDrive keeps it on Windows when it backs the desktop up). */
export function desktopDir(env: Env, platform: NodeJS.Platform = process.platform): string {
  const home = userHome(env);
  if (platform === "linux") return xdgUserDir(env, "XDG_DESKTOP_DIR") ?? path.join(home, "Desktop");
  if (platform === "win32") {
    const oneDrive = env.OneDrive ? path.join(env.OneDrive, "Desktop") : undefined;
    if (oneDrive && fs.existsSync(oneDrive)) return oneDrive;
  }
  return path.join(home, "Desktop");
}

/** Suggested Strom home: <Documents>/Strom. */
export function defaultHome(env: Env, platform: NodeJS.Platform = process.platform): string {
  return path.join(documentsDir(env, platform), "Strom");
}

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
