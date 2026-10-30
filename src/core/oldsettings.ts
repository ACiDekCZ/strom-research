// strom's settings on Windows before 1.23: %APPDATA%\strom. An app packaged as MSIX (Claude's desktop app) gets every
// file it creates in AppData as a private copy of its own (%LOCALAPPDATA%\Packages\<app>\LocalCache\Roaming\strom),
// read before the real one and seen by no other program — a strom it started and a strom of a terminal each had their
// own seal key for one research, each side's writes "outside strom" to the other (found 2026-10-30). Microsoft: "all
// newly created files and folders in the user's AppData folder are written to a private per-user, per-app location";
// "apart from AppData, the app can write to any location where the user has write access, including other parts of
// %userprofile%" (learn.microsoft.com/windows/msix/desktop/flexible-virtualization). The settings are outside AppData
// now (paths.ts configDir); these folders are read, taken over once, and never moved or deleted: an older strom reads
// them still (a switch back to an older version).

import fs from "node:fs";
import path from "node:path";
import { configDir, userHome, type Env } from "./paths.ts";
import { writesPrivately } from "./packaged.ts";
import { installation, type Installation } from "./self.ts";

/**
 * The folders strom kept its settings in before, as this process sees them: %APPDATA%\strom first (in a packaged app
 * its private copy where there is one, else the real one), then each packaged app's copy, read by its path. None with
 * settings of their own (STROM_CONFIG_DIR) and none off Windows. STROM_TEST_OLD_SETTINGS (the sources only): the folders
 * standing for them, separated as PATH is.
 */
export function oldSettingsDirs(env: Env, platform: NodeJS.Platform = process.platform, inst: Installation = installation()): string[] {
  if (inst.kind === "source" && env.STROM_TEST_OLD_SETTINGS !== undefined) return env.STROM_TEST_OLD_SETTINGS.split(path.delimiter).filter(Boolean);
  if (env.STROM_CONFIG_DIR || platform !== "win32") return [];
  const home = env.USERPROFILE || userHome(env);
  const roaming = path.join(env.APPDATA || path.join(home, "AppData", "Roaming"), "strom");
  const packages = path.join(env.LOCALAPPDATA || path.join(home, "AppData", "Local"), "Packages");
  let apps: string[] = [];
  try {
    apps = fs.readdirSync(packages);
  } catch {
    // no packaged apps
  }
  const copies = apps.map((a) => path.join(packages, a, "LocalCache", "Roaming", "strom")).filter((d) => fs.existsSync(d));
  return [roaming, ...copies];
}

/**
 * Every packaged app's copy of the old settings as one pattern, those made later too:
 * `%LOCALAPPDATA%\Packages\*\LocalCache\Roaming\strom` — kept from the agents whole (a key an agent put into a copy
 * made after the rules were written would make a commit of nobody's another key of this computer, offered to unite).
 * None where oldSettingsDirs has none. STROM_TEST_PACKAGES (the sources only): the folder standing for Packages.
 */
export function packagedSettingsPattern(env: Env, platform: NodeJS.Platform = process.platform, inst: Installation = installation()): string | undefined {
  if (inst.kind === "source" && env.STROM_TEST_PACKAGES !== undefined) return path.join(env.STROM_TEST_PACKAGES, "*", "LocalCache", "Roaming", "strom");
  if (env.STROM_CONFIG_DIR || platform !== "win32") return undefined;
  const home = env.USERPROFILE || userHome(env);
  return path.join(env.LOCALAPPDATA || path.join(home, "AppData", "Local"), "Packages", "*", "LocalCache", "Roaming", "strom");
}

/** What is never copied over: a lock or a file half written of a strom running meanwhile, and the keys (seal.ts). */
function copied(from: string, file: string): boolean {
  if (/\.(lock|tmp)$/u.test(file)) return false;
  return path.relative(from, file).split(path.sep)[0] !== "keys";
}

/**
 * The settings taken over into the folder of today once, before anything reads them (no config.json there yet): every
 * old folder with settings copied in, the first one's word kept where two say something. The seal keys are taken one by
 * one when a research needs its own (seal.ts settleKey). The folder taken from, or undefined.
 */
export function takeOverOldSettings(env: Env, platform: NodeJS.Platform = process.platform, inst: Installation = installation()): string | undefined {
  const dir = configDir(env, platform);
  if (fs.existsSync(path.join(dir, "config.json"))) return undefined;
  const old = oldSettingsDirs(env, platform, inst).filter((d) => fs.existsSync(path.join(d, "config.json")));
  if (!old.length) return undefined;
  fs.mkdirSync(dir, { recursive: true });
  for (const from of old) fs.cpSync(from, dir, { recursive: true, force: false, errorOnExist: false, filter: (file) => copied(from, file) });
  return old[0];
}

/** A research's seal key in the old folders, each different one once with where it was (the first seen first). */
export function oldKeys(env: Env, treeId: string, inst: Installation = installation()): { file: string; key: Buffer }[] {
  const out: { file: string; key: Buffer }[] = [];
  for (const dir of oldSettingsDirs(env, process.platform, inst)) {
    const file = path.join(dir, "keys", `${treeId}.key`);
    let key: Buffer;
    try {
      key = Buffer.from(fs.readFileSync(file, "utf8").trim(), "hex");
    } catch {
      continue;
    }
    if (key.length && !out.some((o) => o.key.equals(key))) out.push({ file, key });
  }
  return out;
}

/**
 * Whether this strom was started by an app packaged for Windows that keeps its own copy of the old settings: the key a
 * strom of the terminal keeps there it cannot see (its own copy reads first) — what is sealed with it is another key of
 * this computer, not git used directly. Tried (core/packaged.ts), only when a seal does not match.
 */
export function settingsHidden(env: Env, inst: Installation = installation()): boolean {
  const dir = oldSettingsDirs(env, process.platform, inst)[0];
  return !!dir && fs.existsSync(dir) && writesPrivately(env, dir, process.platform, inst);
}
