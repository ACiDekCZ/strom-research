// Where strom opens the Strom app (the app's ZADANI_VYZKUM_prenos-prohlizece.md): the app keeps its trees in the
// browser it runs in, so the research opens it in that one — the browser its tree came from, kept as app.browser —,
// else in the default browser when the app reaches strom from it, else the app installed from a browser, else the
// first browser here it reaches strom from. In a browser it was installed from, its own window first (the same
// storage as the browser's profile). Never one it cannot reach strom from (Safari).

import type { Env } from "./paths.ts";
import type { Settings } from "./config.ts";
import { appBrowsers, browserKind, browserName, defaultBrowser, openInBrowser, openWebApp, type Browser, type BrowserKind } from "./chromium.ts";
import { installedStromApp, stromAppUrl } from "./stromapp.ts";

export interface AppWindow {
  /** The browser the app opens in (a tab, or the app installed from it). */
  browser?: Browser;
  /** The Strom app installed from that browser: its own window. */
  webApp?: { browser: string; appId: string; profile?: string };
  /** The browser kept for the app (app.browser in the user config) that is no longer here (uninstalled). */
  gone?: BrowserKind;
}

/** Where the Strom app opens on this computer — nothing when no browser here reaches strom. */
export function appWindow(settings: Settings, env: Env, platform: NodeJS.Platform = process.platform): AppWindow {
  const reach = appBrowsers(env, platform);
  const installed = installedStromApp(env, platform, stromAppUrl(settings));
  const webApp = installed?.appId && installed.browser ? { browser: installed.browser, appId: installed.appId, ...(installed.profile ? { profile: installed.profile } : {}) } : undefined;
  // the browser its tree came from, or the person's choice (another Chromium: the default one when it is such)
  const kind = browserKind(settings.appBrowser());
  const chosen = kind ? reach.find((b) => b.kind === kind) : undefined;
  // kept in the user config and gone from this computer: said, and another taken (replaceGone)
  const gone = kind && kind !== "other" && !chosen && browserKind(settings.config.appBrowser) === kind ? kind : undefined;
  const inIt = (b: Browser): AppWindow => ({ browser: b, ...(webApp && webApp.browser === b.name ? { webApp } : {}), ...(gone ? { gone } : {}) });
  if (chosen) return inIt(chosen);
  const def = reach.find((b) => b.name === defaultBrowser(env, platform));
  if (def) return inIt(def);
  if (webApp) {
    const of = reach.find((b) => b.name === webApp.browser);
    return { ...(of ? { browser: of } : {}), webApp, ...(gone ? { gone } : {}) };
  }
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
export function openAppIn(w: AppWindow, url: string, env: Env): { opened: boolean; via?: "app" | "browser" } {
  if (w.webApp && openWebApp(w.webApp, url, env)) return { opened: true, via: "app" };
  if (w.browser && openInBrowser(w.browser, url, env)) return { opened: true, via: "browser" };
  return { opened: false };
}
