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
  const own = env.STROM_APP_DIRS !== undefined ? env.STROM_APP_DIRS.split(path.delimiter).filter(Boolean) : undefined;
  for (const b of BROWSERS) {
    if (platform === "darwin") {
      for (const d of own ?? ["/Applications", path.join(userHome(env), "Applications")]) if (fs.existsSync(path.join(d, b.mac))) return { name: b.name, path: path.join(d, b.mac) };
    } else if (platform === "win32") {
      const roots = own ?? [env.LOCALAPPDATA, env.ProgramFiles, env["ProgramFiles(x86)"]].filter((r): r is string => Boolean(r));
      for (const root of roots)
        for (const rel of b.win) {
          const exe = own ? path.join(root, path.win32.basename(rel)) : path.join(root, rel);
          if (fs.existsSync(exe)) return { name: b.name, path: exe };
        }
    } else {
      for (const cmd of b.linux) {
        const hit = own ? own.map((d) => path.join(d, cmd)).find((f) => fs.existsSync(f)) : which(cmd, env, platform);
        if (hit) return { name: b.name, path: hit };
      }
    }
  }
  return undefined;
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
