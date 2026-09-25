// A browser that lets the Strom app reach strom on this computer. The app is a
// web page (https://stromapp.info); it takes a research from strom's bridge on
// 127.0.0.1. Chrome, Edge and the other Chromium browsers allow that; Safari
// does not (and Firefox is not proven), so strom opens the research in a
// Chromium browser when there is one — never in whatever is the default — and
// otherwise shows the file to drag into the app's window.

import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import type { Env } from "./paths.ts";
import { userHome } from "./paths.ts";
import { which } from "./which.ts";

export interface Chromium {
  name: string;
  /** The .app (macOS), the .exe (Windows) or the command (Linux). */
  path: string;
}

const BROWSERS: { name: string; mac: string; win: string[]; linux: string[] }[] = [
  { name: "Google Chrome", mac: "Google Chrome.app", win: ["Google\\Chrome\\Application\\chrome.exe"], linux: ["google-chrome", "google-chrome-stable"] },
  { name: "Microsoft Edge", mac: "Microsoft Edge.app", win: ["Microsoft\\Edge\\Application\\msedge.exe"], linux: ["microsoft-edge", "microsoft-edge-stable"] },
  { name: "Brave", mac: "Brave Browser.app", win: ["BraveSoftware\\Brave-Browser\\Application\\brave.exe"], linux: ["brave-browser", "brave"] },
  { name: "Chromium", mac: "Chromium.app", win: ["Chromium\\Application\\chrome.exe"], linux: ["chromium", "chromium-browser"] },
  { name: "Vivaldi", mac: "Vivaldi.app", win: ["Vivaldi\\Application\\vivaldi.exe"], linux: ["vivaldi", "vivaldi-stable"] },
  { name: "Arc", mac: "Arc.app", win: [], linux: [] },
];

/** A Chromium browser on this computer, the most common first. STROM_APP_DIRS: folders to look in instead (tests). */
export function chromiumBrowser(env: Env, platform: NodeJS.Platform = process.platform): Chromium | undefined {
  return chromiumBrowsers(env, platform)[0];
}

/** Every Chromium browser on this computer, the most common first. */
export function chromiumBrowsers(env: Env, platform: NodeJS.Platform = process.platform): Chromium[] {
  const found: Chromium[] = [];
  const own = env.STROM_APP_DIRS !== undefined ? env.STROM_APP_DIRS.split(path.delimiter).filter(Boolean) : undefined;
  for (const b of BROWSERS) {
    let hit: string | undefined;
    if (platform === "darwin") hit = (own ?? ["/Applications", path.join(userHome(env), "Applications")]).map((d) => path.join(d, b.mac)).find((f) => fs.existsSync(f));
    else if (platform === "win32") {
      const roots = own ?? [env.LOCALAPPDATA, env.ProgramFiles, env["ProgramFiles(x86)"]].filter((r): r is string => Boolean(r));
      hit = roots.flatMap((root) => b.win.map((rel) => (own ? path.join(root, path.win32.basename(rel)) : path.join(root, rel)))).find((f) => fs.existsSync(f));
    } else hit = b.linux.map((cmd) => (own ? own.map((d) => path.join(d, cmd)).find((f) => fs.existsSync(f)) : which(cmd, env, platform))).find(Boolean);
    if (hit) found.push({ name: b.name, path: hit });
  }
  return found;
}

function launch(cmd: string, args: string[], env: Env): boolean {
  try {
    const child = spawn(cmd, args, { detached: true, stdio: "ignore", windowsHide: true, env: env as NodeJS.ProcessEnv });
    child.on("error", () => undefined);
    child.unref();
    return true;
  } catch {
    return false;
  }
}

/** Where each browser keeps its profiles, under the system's folder for application data. */
const USER_DATA: Record<string, { mac: string; win: string; linux: string }> = {
  "Google Chrome": { mac: "Google/Chrome", win: "Google\\Chrome\\User Data", linux: "google-chrome" },
  "Microsoft Edge": { mac: "Microsoft Edge", win: "Microsoft\\Edge\\User Data", linux: "microsoft-edge" },
  Brave: { mac: "BraveSoftware/Brave-Browser", win: "BraveSoftware\\Brave-Browser\\User Data", linux: "BraveSoftware/Brave-Browser" },
  Chromium: { mac: "Chromium", win: "Chromium\\User Data", linux: "chromium" },
  Vivaldi: { mac: "Vivaldi", win: "Vivaldi\\User Data", linux: "vivaldi" },
};

/** The profile of the browser an installed web app belongs to: the one that holds its files (only folder names are looked at). */
export function webAppProfile(browser: string, appId: string, env: Env, platform: NodeJS.Platform = process.platform): string | undefined {
  const d = USER_DATA[browser];
  if (!d) return undefined;
  const home = userHome(env);
  const root =
    platform === "darwin"
      ? path.join(home, "Library", "Application Support", d.mac)
      : platform === "win32"
        ? path.join(env.LOCALAPPDATA ?? path.join(home, "AppData", "Local"), d.win)
        : path.join(env.XDG_CONFIG_HOME ?? path.join(home, ".config"), d.linux);
  let dirs: string[] = [];
  try {
    dirs = fs.readdirSync(root);
  } catch {
    return undefined;
  }
  return dirs.find((p) => fs.existsSync(path.join(root, p, "Web Applications", "Manifest Resources", appId)));
}

/**
 * Open an address in a web app installed from a Chromium browser — its own window, not a tab: the browser
 * is asked to launch the app (its id, its profile) at that address, which must lie within the app.
 */
export function openWebApp(app: { browser: string; appId: string; profile?: string }, url: string, env: Env, platform: NodeJS.Platform = process.platform): boolean {
  if (env.STROM_NO_OPEN === "1") return false;
  const b = chromiumBrowsers(env, platform).find((x) => x.name === app.browser);
  if (!b) return false;
  const profile = app.profile ?? webAppProfile(app.browser, app.appId, env, platform);
  const args = [...(profile ? [`--profile-directory=${profile}`] : []), `--app-id=${app.appId}`, `--app-launch-url-for-shortcuts-menu-item=${url}`];
  // macOS: the browser's own program — it hands the request to the browser already running.
  const exe = platform === "darwin" ? path.join(b.path, "Contents", "MacOS", path.basename(b.path, ".app")) : b.path;
  if (platform !== "darwin" && platform !== "win32" && !env.DISPLAY && !env.WAYLAND_DISPLAY) return false;
  return launch(exe, args, env);
}

/** Open an address in that browser; false when this computer cannot (no desktop) or tests ask not to. */
export function openInBrowser(browser: Chromium, url: string, env: Env, platform: NodeJS.Platform = process.platform): boolean {
  if (env.STROM_NO_OPEN === "1") return false;
  if (platform === "darwin") return launch("open", ["-a", browser.path, url], env);
  if (platform === "win32") return launch(browser.path, [url], env);
  if (!env.DISPLAY && !env.WAYLAND_DISPLAY) return false;
  return launch(browser.path, [url], env);
}

/** Open a file with an app (the installed Strom app takes a .ged through its file handler) — macOS. */
export function openFileWith(app: string, file: string, env: Env, platform: NodeJS.Platform = process.platform): boolean {
  if (env.STROM_NO_OPEN === "1" || platform !== "darwin") return false;
  return launch("open", ["-a", app, file], env);
}

/** Show a file in Finder / Explorer / the file manager, selected where the system can. */
export function revealFile(file: string, env: Env, platform: NodeJS.Platform = process.platform): boolean {
  if (env.STROM_NO_OPEN === "1") return false;
  if (platform === "darwin") return launch("open", ["-R", file], env);
  if (platform === "win32") return launch("explorer.exe", [`/select,${file}`], env);
  if (!env.DISPLAY && !env.WAYLAND_DISPLAY) return false;
  return launch("xdg-open", [path.dirname(file)], env);
}
