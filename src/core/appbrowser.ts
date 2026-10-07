// Where strom opens the Strom app (the app's ZADANI_VYZKUM_prenos-prohlizece.md; Milan, 2026-10-07: the installed
// app always comes before the default browser): the Strom app installed from a browser here — its own window, the
// same storage as that browser's profile; installed from several, the one of the browser its tree came from (kept as
// app.browser), else of the default browser, else the first —, else a tab of the browser its tree came from, else
// of the default browser when the app reaches strom from it, else of the first browser here it reaches strom from.
// Never one it cannot reach strom from (Safari). A tree handed over (`holdsTree`: ?adopt=) waits in the storage of
// the browser it came from: there only — its app, else its tab — while that browser is here.

import type { Env } from "./paths.ts";
import type { Settings } from "./config.ts";
import { appBrowsers, browserKind, browserName, defaultBrowser, openInBrowser, openWebApp, type Browser, type BrowserKind } from "./chromium.ts";
import { installedStromApps, stromAppUrl } from "./stromapp.ts";

export interface AppWindow {
  /** The browser the app opens in (a tab, or the app installed from it). */
  browser?: Browser;
  /** The Strom app installed from that browser: its own window. */
  webApp?: { browser: string; appId: string; profile?: string };
  /** The browser kept for the app (app.browser in the user config) that is no longer here (uninstalled). */
  gone?: BrowserKind;
}

/**
 * Where the Strom app opens on this computer — nothing when no browser here reaches strom. `holdsTree`: the address
 * needs the app's storage in the browser its tree came from (a tree handed over), so another browser's app is no use.
 */
export function appWindow(settings: Settings, env: Env, platform: NodeJS.Platform = process.platform, opts: { holdsTree?: boolean } = {}): AppWindow {
  const reach = appBrowsers(env, platform);
  // the copies of the app (strom.app.url) installed from a browser that is here
  const apps = installedStromApps(env, platform, stromAppUrl(settings)).filter((a) => a.appId && a.browser && reach.some((b) => b.name === a.browser));
  const appOf = (b: Browser | undefined): AppWindow["webApp"] => {
    const a = b && apps.find((x) => x.browser === b.name);
    return a?.appId && a.browser ? { browser: a.browser, appId: a.appId, ...(a.profile ? { profile: a.profile } : {}) } : undefined;
  };
  // the browser its tree came from, or the person's choice (another Chromium: the default one when it is such)
  const kind = browserKind(settings.appBrowser());
  const chosen = kind ? reach.find((b) => b.kind === kind) : undefined;
  // kept in the user config and gone from this computer: said, and another taken (replaceGone)
  const gone = kind && kind !== "other" && !chosen && browserKind(settings.config.appBrowser) === kind ? kind : undefined;
  const inIt = (b: Browser): AppWindow => {
    const webApp = appOf(b);
    return { browser: b, ...(webApp ? { webApp } : {}), ...(gone ? { gone } : {}) };
  };
  const def = reach.find((b) => b.name === defaultBrowser(env, platform));
  if (chosen && (opts.holdsTree || appOf(chosen))) return inIt(chosen);
  // the installed app first, whatever the default browser (that of the default browser when several)
  const withApp = (def && appOf(def) ? def : undefined) ?? reach.find((b) => appOf(b));
  if (withApp) return inIt(withApp);
  if (chosen) return inIt(chosen);
  if (def) return inIt(def);
  return reach[0] ? inIt(reach[0]) : gone ? { gone } : {};
}

/**
 * The browser kept for the app is gone (uninstalled): the one the app opens in now is kept instead, and what to say
 * of it — the browser gone and the one now (none: nothing changed, the person installs one or says another).
 */
export function replaceGone(settings: Settings, w: AppWindow): { gone: string; now?: string } | undefined {
  if (!w.gone) return undefined;
  const gone = browserName(w.gone) ?? "Chromium";
  const now = w.browser;
  if (!now) return { gone };
  settings.config.appBrowser = now.kind;
  settings.save();
  return { gone, now: now.name };
}

/** Open an address of the Strom app where it opens (appWindow): its own window first, else a tab of that browser. */
export function openAppIn(w: AppWindow, url: string, env: Env, openApp: (app: NonNullable<AppWindow["webApp"]>, url: string, env: Env) => boolean = openWebApp): { opened: boolean; via?: "app" | "browser" } {
  if (w.webApp && openApp(w.webApp, url, env)) return { opened: true, via: "app" };
  if (w.browser && openInBrowser(w.browser, url, env)) return { opened: true, via: "browser" };
  return { opened: false };
}
