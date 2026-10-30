// A strom started by an app packaged as MSIX (Claude's desktop app on Windows): every file it creates under AppData goes
// to a private copy of the app's (%LOCALAPPDATA%\Packages\<app>\LocalCache\Local\…), read before the real one and seen
// by no other program (learn.microsoft.com/windows/msix/desktop/desktop-to-uwp-behind-the-scenes, "AppData operations
// on Windows 10, version 1903 and later"). strom's program is in %LOCALAPPDATA%\Programs\Strom: an update installed
// from there would be that app's alone — the app on the new version, the terminal on the old one for good (found
// 2026-10-30). Whether this process writes so is tried, not guessed: a file made in the folder and looked for in the
// private copies.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { userHome, type Env } from "./paths.ts";
import { installation, type Installation } from "./self.ts";

/** The AppData folders a packaged app's new files are taken from, each with its folder in the private copy. */
function appData(env: Env): { real: string; copy: string }[] {
  const home = env.USERPROFILE || userHome(env);
  return [
    { real: env.LOCALAPPDATA || path.join(home, "AppData", "Local"), copy: "Local" },
    { real: env.APPDATA || path.join(home, "AppData", "Roaming"), copy: "Roaming" },
  ];
}

/** Where the packaged apps keep their private copies of `dir`, whether they are there or not (none: dir outside AppData). */
function copiesOf(env: Env, dir: string): string[] {
  const packages = path.join(appData(env)[0]!.real, "Packages");
  for (const { real, copy } of appData(env)) {
    const rel = path.relative(real, dir);
    if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) continue;
    let apps: string[] = [];
    try {
      apps = fs.readdirSync(packages);
    } catch {
      // no packaged apps
    }
    return apps.map((a) => path.join(packages, a, "LocalCache", copy, rel));
  }
  return [];
}

/** The private copies of `dir` some packaged app made (from the terminal: the update it installed only for itself). */
export function privateCopies(env: Env, dir: string, platform: NodeJS.Platform = process.platform): string[] {
  if (platform !== "win32") return [];
  return copiesOf(env, dir).filter((d) => fs.existsSync(d));
}

/**
 * Whether a file this process makes in `dir` lands in a packaged app's private copy instead. STROM_TEST_PACKAGED=1 (the
 * sources only) stands for it. `make` writes the file (a test makes it where Windows would).
 */
export function writesPrivately(
  env: Env,
  dir: string,
  platform: NodeJS.Platform = process.platform,
  inst: Installation = installation(),
  make: (file: string) => void = (file) => fs.writeFileSync(file, "", { flag: "wx" }),
): boolean {
  if (inst.kind === "source" && env.STROM_TEST_PACKAGED !== undefined) return env.STROM_TEST_PACKAGED === "1";
  if (platform !== "win32") return false;
  const copies = copiesOf(env, dir);
  if (!copies.length) return false;
  const name = `.strom-probe-${crypto.randomBytes(6).toString("hex")}`;
  try {
    make(path.join(dir, name));
  } catch {
    return false;
  }
  // the private copy says so; the real folder could have it as well — what counts is the copy
  const hit = copies.some((c) => fs.existsSync(path.join(c, name)));
  for (const at of [dir, ...copies]) fs.rmSync(path.join(at, name), { force: true });
  return hit;
}
