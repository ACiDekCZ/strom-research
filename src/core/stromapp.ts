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

/** The pages of the Strom app — on the web, its beta, a copy on this computer (its development): the only ones strom opens with a research, and the only ones its bridge lets in. */
export function isStromAppOrigin(origin: string): boolean {
  return origin === "https://stromapp.info" || origin === "https://beta.stromapp.info" || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

/** The Strom app's address: the setting strom.app.url (STROM_APP_URL) points strom at another copy of it (its beta, its development). */
export function stromAppUrl(settings: Settings): string {
  const url = settings.resolve("strom.app.url")?.value;
  return typeof url === "string" && url ? url : STROM_APP_URL;
}

/**
 * The Strom app opens a research by itself (from its version 3.0.0; its import
 * contract, docs/GEDCOM-IMPORT.md in the Strom repository): ?import-url=<the
 * tree's GEDCOM on this computer> opens that tree — created the first time,
 * updated after — and ?live=<the bridge> follows it while it goes on (see
 * core/live.ts). On since stromapp.info runs 3.0.0; another copy of the app
 * (strom.app.url: a beta, its development) is taken as current too.
 */
export const APP_OPENS_RESEARCH = true;

export function appOpensResearch(settings: Settings): boolean {
  return APP_OPENS_RESEARCH || stromAppUrl(settings) !== STROM_APP_URL;
}

/** The address that opens the Strom app following a research through its bridge. */
export function liveAppUrl(bridge: string, settings: Settings): string {
  return `${stromAppUrl(settings)}?live=${encodeURIComponent(bridge)}`;
}

/** The address that opens a research's GEDCOM (served on this computer) in the Strom app. */
export function importAppUrl(file: string, settings: Settings): string {
  return `${stromAppUrl(settings)}?import-url=${encodeURIComponent(file)}`;
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
  /** Installed from a Chromium browser: that browser, and the app's id there (and its profile, when the shortcut says it). */
  browser?: string;
  appId?: string;
  profile?: string;
}

/** A Chromium web app's id: 32 letters a–p. */
const APP_ID = /--app-id=([a-p]{32})/;
const PROFILE = /--profile-directory=(?:"([^"]+)"|(\S+))/;
/** The browser a folder of web apps belongs to. */
const BROWSER_OF: Record<string, string> = { Chrome: "Google Chrome", Edge: "Microsoft Edge", "Brave Browser": "Brave", Chromium: "Chromium", Vivaldi: "Vivaldi" };

function read(file: string, encoding: BufferEncoding = "utf8"): string {
  try {
    return fs.readFileSync(file, encoding);
  } catch {
    return "";
  }
}

/** The id and profile a shortcut starts the app with (a .lnk keeps its arguments in UTF-16, a .desktop entry in its Exec line). */
function launchOf(text: string): { appId?: string; profile?: string } {
  const id = APP_ID.exec(text)?.[1];
  const p = PROFILE.exec(text);
  return { ...(id ? { appId: id } : {}), ...(p ? { profile: p[1] ?? p[2] } : {}) };
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

function originOf(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return "";
  }
}

/**
 * The Strom app installed from a browser, if there is one — the copy at `url`
 * (default: stromapp.info; its beta installed beside it is another app). A
 * shortcut that says its address (macOS: the app's Info.plist; Linux: --app=)
 * is matched by it; one that does not (Windows, Safari) is taken by its name,
 * and only for stromapp.info itself.
 */
export function installedStromApp(env: Env, platform: NodeJS.Platform = process.platform, url: string = STROM_APP_URL): InstalledApp | undefined {
  const home = userHome(env);
  const want = originOf(url);
  const byName = want === originOf(STROM_APP_URL);
  /** Is it that copy: its address when the shortcut gives one, else its name. */
  const isIt = (name: string, address: string | undefined): boolean => (address ? originOf(address) === want : byName && isStromName(name));
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
      for (const f of entries(path.join(apps, dir))) {
        if (!f.endsWith(".app")) continue;
        const at = path.join(apps, dir, f);
        const plist = read(path.join(at, "Contents", "Info.plist"));
        const address = /<key>CrAppModeShortcutURL<\/key>\s*<string>([^<]+)<\/string>/.exec(plist)?.[1];
        if (!isIt(f.slice(0, -4), address)) continue;
        const id = /<key>CrAppModeShortcutID<\/key>\s*<string>([a-p]{32})<\/string>/.exec(plist)?.[1];
        const browser = BROWSER_OF[dir.replace(/ Apps(\.localized)?$/, "")];
        return { path: at, kind, ...(id && browser ? { browser, appId: id } : {}) };
      }
    // Safari: File → Add to Dock puts the web app straight into ~/Applications.
    if (byName) for (const f of entries(apps)) if (f.endsWith(".app") && isStromName(f.slice(0, -4))) return { path: path.join(apps, f), kind: "Safari web app" };
    return undefined;
  }
  if (platform === "win32") {
    if (!byName) return undefined;
    const programs = path.join(env.APPDATA ?? path.join(home, "AppData", "Roaming"), "Microsoft", "Windows", "Start Menu", "Programs");
    for (const dir of ["Chrome Apps", "Edge Apps", ""]) {
      const d = path.join(programs, dir);
      for (const f of entries(d))
        if (f.toLowerCase().endsWith(".lnk") && isStromName(f.slice(0, -4))) {
          const at = path.join(d, f);
          const launch = launchOf(read(at, "utf16le"));
          const browser = BROWSER_OF[dir.replace(/ Apps$/, "")] ?? (dir ? undefined : "Google Chrome");
          return { path: at, kind: dir ? dir.replace(/s$/, "") : "app", ...(launch.appId && browser ? { browser, ...launch } : {}) };
        }
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
    const exec = /^Exec=(.*)$/m.exec(text)?.[1] ?? "";
    if (name && /--app-id=|--app=/.test(text) && isIt(name, /--app=(?:"([^"]+)"|(\S+))/.exec(exec)?.slice(1).find(Boolean))) {
      const browser = /edge/.test(exec) ? "Microsoft Edge" : /brave/.test(exec) ? "Brave" : /vivaldi/.test(exec) ? "Vivaldi" : /chromium/.test(exec) ? "Chromium" : /chrome/.test(exec) ? "Google Chrome" : undefined;
      const launch = launchOf(exec);
      return { path: path.join(dir, f), kind: "browser app", ...(launch.appId && browser ? { browser, ...launch } : {}) };
    }
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
  const app = installedStromApp(env, process.platform, stromAppUrl(settings));
  if (app && !settings.config.stromAppSeen) {
    settings.config.stromAppSeen = { via: app.kind, at };
    settings.save();
  }
  return app;
}
