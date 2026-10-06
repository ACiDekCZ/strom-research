// The browsers the Strom app reaches strom from. The app is a web page (https://stromapp.info); it takes a research
// from strom's bridge on 127.0.0.1. Chrome, Edge, Opera and the other Chromium browsers allow that, and Firefox
// (it takes http://127.0.0.1 as a secure origin); Safari does not. strom opens the app in the browser its tree came
// from (app.browser), else the default one when the app reaches strom from it, else the app installed from a
// browser, else the first such browser here — never one it cannot reach strom from (core/appbrowser.ts).

import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import type { Env } from "./paths.ts";
import { userHome } from "./paths.ts";
import { which } from "./which.ts";

/** What the Strom app says of the browser it runs in (STROM_FROM_BROWSER, a link's browser=); anything else is "other". */
// "mobile": the app on a phone or tablet (its 3.9.1) — no browser of this computer, the tree comes as a file
export const BROWSER_KINDS = ["chrome", "edge", "brave", "opera", "firefox", "safari", "chromium", "mobile", "other"] as const;
export type BrowserKind = (typeof BROWSER_KINDS)[number];

/** The kind the app said, read safely: an unknown word (or none) is "other" — undefined only when nothing was said. */
export function browserKind(said: string | undefined): BrowserKind | undefined {
  const v = said?.trim().toLowerCase();
  if (!v) return undefined;
  return (BROWSER_KINDS as readonly string[]).includes(v) ? (v as BrowserKind) : "other";
}

/**
 * Firefox lets a page of https://stromapp.info reach the bridge on http://127.0.0.1 (a secure origin to it since its
 * version 84, no mixed content; the bridge's CORS as for Chrome). Not tried live with the app here — see the answer
 * in the app's ZADANI_VYZKUM_prenos-prohlizece.md; false makes it a browser the tree moves away from, as Safari.
 */
export const FIREFOX_REACHES_BRIDGE = true;

export interface Chromium {
  name: string;
  /** The .app (macOS), the .exe (Windows) or the command (Linux). */
  path: string;
}

/** A browser on this computer: its kind, and whether the Strom app in it reaches strom's bridge. */
export interface Browser extends Chromium {
  kind: BrowserKind;
  reaches: boolean;
  /** A Chromium browser: the Strom app can be installed from it (its own window). */
  chromium: boolean;
}

const BROWSERS: { name: string; kind: BrowserKind; chromium: boolean; mac: string; win: string[]; linux: string[]; ids: string[] }[] = [
  { name: "Google Chrome", kind: "chrome", chromium: true, mac: "Google Chrome.app", win: ["Google\\Chrome\\Application\\chrome.exe"], linux: ["google-chrome", "google-chrome-stable"], ids: ["com.google.chrome", "chromehtml", "google-chrome"] },
  { name: "Microsoft Edge", kind: "edge", chromium: true, mac: "Microsoft Edge.app", win: ["Microsoft\\Edge\\Application\\msedge.exe"], linux: ["microsoft-edge", "microsoft-edge-stable"], ids: ["com.microsoft.edgemac", "msedgehtm", "microsoft-edge"] },
  { name: "Brave", kind: "brave", chromium: true, mac: "Brave Browser.app", win: ["BraveSoftware\\Brave-Browser\\Application\\brave.exe"], linux: ["brave-browser", "brave"], ids: ["com.brave.browser", "bravehtml", "brave-browser", "brave"] },
  { name: "Opera", kind: "opera", chromium: true, mac: "Opera.app", win: ["Programs\\Opera\\opera.exe", "Opera\\opera.exe"], linux: ["opera"], ids: ["com.operasoftware.opera", "operastable", "opera"] },
  { name: "Chromium", kind: "chromium", chromium: true, mac: "Chromium.app", win: ["Chromium\\Application\\chrome.exe"], linux: ["chromium", "chromium-browser"], ids: ["org.chromium.chromium", "chromiumhtm", "chromium", "chromium-browser"] },
  { name: "Vivaldi", kind: "chromium", chromium: true, mac: "Vivaldi.app", win: ["Vivaldi\\Application\\vivaldi.exe"], linux: ["vivaldi", "vivaldi-stable"], ids: ["com.vivaldi.vivaldi", "vivaldihtm", "vivaldi", "vivaldi-stable"] },
  { name: "Arc", kind: "chromium", chromium: true, mac: "Arc.app", win: [], linux: [], ids: ["company.thebrowser.browser"] },
  {
    name: "Firefox",
    kind: "firefox",
    chromium: false,
    mac: "Firefox.app",
    win: ["Mozilla Firefox\\firefox.exe"],
    linux: ["firefox", "firefox-esr", "/snap/bin/firefox", "/var/lib/flatpak/exports/bin/org.mozilla.firefox", "~/.local/share/flatpak/exports/bin/org.mozilla.firefox"],
    ids: ["org.mozilla.firefox", "firefoxurl", "firefox", "firefox-esr", "firefox_firefox"],
  },
  { name: "Safari", kind: "safari", chromium: false, mac: "Safari.app", win: [], linux: [], ids: ["com.apple.safari"] },
];

/** The name of a browser of that kind, as a person knows it (Safari, Firefox, Google Chrome…); none for "other". */
export function browserName(kind: BrowserKind): string | undefined {
  return kind === "chromium" || kind === "other" ? undefined : BROWSERS.find((b) => b.kind === kind)?.name;
}

/** A Chromium browser on this computer, the most common first. STROM_APP_DIRS: folders to look in instead (tests). */
export function chromiumBrowser(env: Env, platform: NodeJS.Platform = process.platform): Chromium | undefined {
  return chromiumBrowsers(env, platform)[0];
}

/** Every Chromium browser on this computer, the most common first. */
export function chromiumBrowsers(env: Env, platform: NodeJS.Platform = process.platform): Chromium[] {
  return browsersHere(env, platform)
    .filter((b) => b.chromium)
    .map((b) => ({ name: b.name, path: b.path }));
}

/** Every browser strom knows on this computer, Chromium ones first (the most common first), then Firefox, Safari. */
export function browsersHere(env: Env, platform: NodeJS.Platform = process.platform): Browser[] {
  const found: Browser[] = [];
  const own = env.STROM_APP_DIRS !== undefined ? env.STROM_APP_DIRS.split(path.delimiter).filter(Boolean) : undefined;
  for (const b of BROWSERS) {
    let hit: string | undefined;
    if (platform === "darwin") hit = (own ?? ["/Applications", path.join(userHome(env), "Applications")]).map((d) => path.join(d, b.mac)).find((f) => fs.existsSync(f));
    else if (platform === "win32") {
      const roots = own ?? [env.LOCALAPPDATA, env.ProgramFiles, env["ProgramFiles(x86)"]].filter((r): r is string => Boolean(r));
      hit = roots.flatMap((root) => b.win.map((rel) => (own ? path.join(root, path.win32.basename(rel)) : path.join(root, rel)))).find((f) => fs.existsSync(f));
    } else
      hit = b.linux
        .map((cmd) => {
          if (own) return own.map((d) => path.join(d, path.posix.basename(cmd))).find((f) => fs.existsSync(f));
          const abs = cmd.startsWith("~/") ? path.join(userHome(env), cmd.slice(2)) : cmd;
          return abs.startsWith("/") ? (fs.existsSync(abs) ? abs : undefined) : which(cmd, env, platform);
        })
        .find(Boolean);
    if (hit) found.push({ name: b.name, path: hit, kind: b.kind, chromium: b.chromium, reaches: b.chromium || (b.kind === "firefox" && FIREFOX_REACHES_BRIDGE) });
  }
  return found;
}

/** The browsers here the Strom app reaches strom from (Chromium ones, Firefox), the default one first. */
export function appBrowsers(env: Env, platform: NodeJS.Platform = process.platform): Browser[] {
  const reach = browsersHere(env, platform).filter((b) => b.reaches);
  const first = defaultBrowser(env, platform);
  return first ? [...reach.filter((b) => b.name === first), ...reach.filter((b) => b.name !== first)] : reach;
}

/** Whether the Strom app in a browser of that kind reaches strom's bridge. */
export function kindReaches(kind: BrowserKind): boolean {
  return kind === "firefox" ? FIREFOX_REACHES_BRIDGE : BROWSERS.some((b) => b.kind === kind && b.chromium);
}

/**
 * The default browser of this person, by the name strom knows it (Google Chrome, Safari…) — only its name is read:
 * macOS LaunchServices' https handler, Windows' UserChoice of https, Linux xdg-settings. STROM_DEFAULT_BROWSER says it
 * instead (tests: with STROM_APP_DIRS and without it, none).
 */
export function defaultBrowser(env: Env, platform: NodeJS.Platform = process.platform): string | undefined {
  const told = env.STROM_DEFAULT_BROWSER?.trim();
  if (told !== undefined) return BROWSERS.find((b) => b.name.toLowerCase() === told.toLowerCase() || b.kind === told.toLowerCase())?.name;
  if (env.STROM_APP_DIRS !== undefined) return undefined;
  const id = defaultBrowserId(env, platform)?.toLowerCase();
  if (!id) return platform === "darwin" ? "Safari" : platform === "win32" ? "Microsoft Edge" : undefined;
  return BROWSERS.find((b) => b.ids.some((x) => id === x || id.startsWith(x)))?.name;
}

const said = (cmd: string, args: string[]): string | undefined => {
  try {
    const r = spawnSync(cmd, args, { encoding: "utf8", timeout: 3000, windowsHide: true, stdio: ["ignore", "pipe", "ignore"] });
    return r.status === 0 ? r.stdout : undefined;
  } catch {
    return undefined;
  }
};

/** The system's mark of the default browser: a bundle id, a ProgId, a .desktop name. */
function defaultBrowserId(env: Env, platform: NodeJS.Platform): string | undefined {
  if (platform === "darwin") {
    const plist = path.join(userHome(env), "Library", "Preferences", "com.apple.LaunchServices", "com.apple.launchservices.secure.plist");
    if (!fs.existsSync(plist)) return undefined;
    const out = said("plutil", ["-extract", "LSHandlers", "json", "-o", "-", plist]);
    try {
      const all = JSON.parse(out ?? "[]") as { LSHandlerURLScheme?: string; LSHandlerRoleAll?: string }[];
      return (all.find((h) => h.LSHandlerURLScheme === "https") ?? all.find((h) => h.LSHandlerURLScheme === "http"))?.LSHandlerRoleAll;
    } catch {
      return undefined;
    }
  }
  if (platform === "win32") {
    const out = said("reg", ["query", "HKCU\\Software\\Microsoft\\Windows\\Shell\\Associations\\UrlAssociations\\https\\UserChoice", "/v", "ProgId"]);
    return out?.match(/ProgId\s+REG_SZ\s+(\S+)/)?.[1];
  }
  return said("xdg-settings", ["get", "default-web-browser"])?.trim().replace(/\.desktop$/, "") || undefined;
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
