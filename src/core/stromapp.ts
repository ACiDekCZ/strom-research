// The Strom app (https://stromapp.info) — a web app, often installed from the
// browser as an app of its own. strom notices it quietly and never asks: the
// app says so when it starts strom (STROM_APP), or its shortcut is found among
// the apps the browser installed (only names are looked at — never the
// browser's history). What strom does with it: say which file to import into
// the app. The user can say yes or no for good (strom config set strom.app).

import fs from "node:fs";
import path from "node:path";
import type { Env } from "./paths.ts";
import { userHome } from "./paths.ts";
import type { Settings } from "./config.ts";
import { foldText } from "./text.ts";

export const STROM_APP_URL = "https://stromapp.info/run/";

/** The Strom app's address: STROM_APP_URL points strom at another copy of it (its development, http://127.0.0.1:8080/). */
export function stromAppUrl(env: Env): string {
  const url = env.STROM_APP_URL?.trim();
  return url && /^https?:\/\//.test(url) ? url : STROM_APP_URL;
}

/**
 * The Strom app opens a research by itself (from its version 3.0.0; its import
 * contract, docs/GEDCOM-IMPORT.md in the Strom repository): ?import-url=<the
 * tree's GEDCOM on this computer> opens that tree — created the first time,
 * updated after — and ?live=<the bridge> follows it while it goes on (see
 * core/live.ts). On since stromapp.info runs 3.0.0; a copy of the app named by
 * STROM_APP_URL (a beta, its development) is taken as current too.
 */
export const APP_OPENS_RESEARCH = true;

export function appOpensResearch(env: Env): boolean {
  return APP_OPENS_RESEARCH || Boolean(env.STROM_APP_URL?.trim());
}

/** The address that opens the Strom app following a research through its bridge. */
export function liveAppUrl(bridge: string, env: Env): string {
  return `${stromAppUrl(env)}?live=${encodeURIComponent(bridge)}`;
}

/** The address that opens a research's GEDCOM (served on this computer) in the Strom app. */
export function importAppUrl(file: string, env: Env): string {
  return `${stromAppUrl(env)}?import-url=${encodeURIComponent(file)}`;
}

/** The page for people starting research with an AI agent: what an agent is, which one, how to install it. */
export const RESEARCH_URL = "https://stromapp.info/research/";

/** That page in the user's language (it speaks en, cs, de), at a section: "agents". */
export function researchUrl(lang: string, section?: string): string {
  return `${RESEARCH_URL}${["cs", "de"].includes(lang) ? `?lang=${lang}` : ""}${section ? `#${section}` : ""}`;
}

export interface InstalledApp {
  /** What to open to start it (an .app, a shortcut, a .desktop entry). */
  path: string;
  /** Where it was found, for the user: "Chrome app", "Safari web app", … */
  kind: string;
}

/** "Strom", "Strom - Family Tree" — not this tool ("Strom Research"). */
export function isStromName(name: string): boolean {
  const n = foldText(name).trim();
  return /^strom(\s*[-–:|]\s*.*)?$/u.test(n) && !/research|vyzkum/u.test(n);
}

function entries(dir: string): string[] {
  try {
    return fs.readdirSync(dir);
  } catch {
    return [];
  }
}

/** The Strom app installed from a browser, if there is one. */
export function installedStromApp(env: Env, platform: NodeJS.Platform = process.platform): InstalledApp | undefined {
  const home = userHome(env);
  if (platform === "darwin") {
    const apps = path.join(home, "Applications");
    const browsers: [string, string][] = [
      ["Chrome Apps.localized", "Chrome app"],
      ["Chrome Apps", "Chrome app"],
      ["Edge Apps.localized", "Edge app"],
      ["Brave Browser Apps.localized", "Brave app"],
      ["Chromium Apps.localized", "Chromium app"],
      ["Vivaldi Apps.localized", "Vivaldi app"],
    ];
    for (const [dir, kind] of browsers)
      for (const f of entries(path.join(apps, dir))) if (f.endsWith(".app") && isStromName(f.slice(0, -4))) return { path: path.join(apps, dir, f), kind };
    // Safari: File → Add to Dock puts the web app straight into ~/Applications.
    for (const f of entries(apps)) if (f.endsWith(".app") && isStromName(f.slice(0, -4))) return { path: path.join(apps, f), kind: "Safari web app" };
    return undefined;
  }
  if (platform === "win32") {
    const programs = path.join(env.APPDATA ?? path.join(home, "AppData", "Roaming"), "Microsoft", "Windows", "Start Menu", "Programs");
    for (const dir of ["Chrome Apps", "Edge Apps", ""]) {
      const d = path.join(programs, dir);
      for (const f of entries(d)) if (f.toLowerCase().endsWith(".lnk") && isStromName(f.slice(0, -4))) return { path: path.join(d, f), kind: dir ? dir.replace(/s$/, "") : "app" };
    }
    return undefined;
  }
  const dir = path.join(env.XDG_DATA_HOME ?? path.join(home, ".local", "share"), "applications");
  for (const f of entries(dir)) {
    if (!f.endsWith(".desktop")) continue;
    let text = "";
    try {
      text = fs.readFileSync(path.join(dir, f), "utf8");
    } catch {
      continue;
    }
    const name = /^Name=(.*)$/m.exec(text)?.[1];
    if (name && isStromName(name) && /--app-id=|--app=/.test(text)) return { path: path.join(dir, f), kind: "browser app" };
  }
  return undefined;
}

export type StromAppState = "yes" | "no" | "seen" | "unknown";

/** What strom knows of the Strom app: the user's word first, then what it noticed. */
export function stromAppState(settings: Settings): StromAppState {
  const said = settings.config.stromApp;
  if (said === "yes" || said === "no") return said;
  return settings.config.stromAppSeen ? "seen" : "unknown";
}

/**
 * Notice the Strom app and remember it (quietly, in the user config). `look`
 * also checks the apps installed from browsers — a few folder listings, done
 * where it is cheap to do (setup, the menu), not on every command.
 */
export function noticeStromApp(settings: Settings, env: Env, opts: { look?: boolean } = {}): InstalledApp | undefined {
  if (settings.config.stromApp === "no") return undefined;
  const at = new Date().toISOString();
  if (env.STROM_APP) {
    const version = env.STROM_APP_VERSION;
    const seen = settings.config.stromAppSeen;
    if (!seen || seen.via !== "started strom" || seen.version !== version) {
      settings.config.stromAppSeen = { via: "started strom", at, ...(version ? { version } : {}) };
      settings.save();
    }
  }
  if (!opts.look) return undefined;
  const app = installedStromApp(env);
  if (app && !settings.config.stromAppSeen) {
    settings.config.stromAppSeen = { via: app.kind, at };
    settings.save();
  }
  return app;
}
