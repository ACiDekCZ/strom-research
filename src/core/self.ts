// This very installation of strom: how it was installed and how to start it
// again — for the agent's `strom` on PATH, the shortcut on the desktop, a
// process strom starts itself.
//
// strom is JavaScript on Node, installed one of three ways:
//   installed  by strom's installer: a folder with the official Node from
//              nodejs.org (node/) and strom's code (app/), install.json beside
//              them naming the command(s) on PATH that start it
//   npm        npm install -g strom-research, on the Node of the computer
//   source     run from the repository (node src/cli.ts)

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export interface Installation {
  kind: "installed" | "npm" | "source";
  /** installed: the folder holding node/ and app/. */
  root?: string;
  /** installed: the commands on PATH that start strom (strom; on Windows strom.cmd too). */
  launchers?: string[];
  /** installed: the Node version the installer put there. */
  node?: string;
  /**
   * installed: the environment it was installed with (its settings folder, its HOME, STROM_ISOLATED) — every start of
   * this installation takes it, however it starts (a link, the shortcut, a bridge revived): see `withInstallEnv`.
   */
  env?: Record<string, string>;
}

/** What install.json may carry for every start of its installation; nothing else is taken from it. */
export const INSTALL_ENV_KEYS = ["STROM_CONFIG_DIR", "HOME", "STROM_ISOLATED"] as const;

/**
 * The environment with what the installation was installed with: what the process has set wins — but an isolated
 * installation's own win always (a link or the shortcut starts it with the person's HOME: isolated however it starts).
 */
export function withInstallEnv<T extends Record<string, string | undefined>>(env: T, own: Record<string, string> | undefined): T {
  const out = { ...env } as Record<string, string | undefined>;
  const isolated = own?.STROM_ISOLATED === "1";
  for (const k of INSTALL_ENV_KEYS) if ((isolated || out[k] === undefined) && typeof own?.[k] === "string" && own[k]) out[k] = own[k];
  return out as T;
}

const here = fileURLToPath(import.meta.url);

/** How this strom was installed (read once). */
let cached: Installation | undefined;
export function installation(): Installation {
  if (cached) return cached;
  if (here.endsWith(".ts")) return (cached = { kind: "source" });
  // …/app/dist/core/self.js
  const app = path.resolve(path.dirname(here), "..", "..");
  const root = path.dirname(app);
  try {
    if (path.basename(app) === "app") {
      const info = JSON.parse(fs.readFileSync(path.join(root, "install.json"), "utf8")) as { launchers?: string[]; node?: string; env?: Record<string, string> };
      const env = info.env && typeof info.env === "object" ? info.env : undefined;
      return (cached = { kind: "installed", root, launchers: info.launchers ?? [], ...(info.node ? { node: info.node } : {}), ...(env ? { env } : {}) });
    }
  } catch {
    // not the installer's folder
  }
  return (cached = { kind: "npm" });
}

/**
 * The version of strom on disk now — the installer's (app/package.json) or npm's package — which a process started
 * long ago may not run (an update, the installer run again, npm install -g). Run from the sources: none (each edit of
 * them would count). STROM_LIVE_DISK_VERSION (tests): a file standing for the package on disk.
 */
export function diskVersion(env: Record<string, string | undefined>): { version: string; probe?: "fail" } | undefined {
  const inst = installation();
  const file = env.STROM_LIVE_DISK_VERSION ?? (inst.kind === "installed" && inst.root ? path.join(inst.root, "app", "package.json") : inst.kind === "npm" ? path.resolve(path.dirname(here), "..", "..", "package.json") : undefined);
  if (!file) return undefined;
  try {
    const pkg = JSON.parse(fs.readFileSync(file, "utf8")) as { version?: unknown; probe?: unknown };
    return typeof pkg.version === "string" ? { version: pkg.version, ...(pkg.probe === "fail" ? { probe: "fail" as const } : {}) } : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Another strom on disk than the one running (strom update replaced its code or its Node): this process goes on
 * with what it loaded, so a person is told to start strom again. `version`: the running one's.
 */
export function replacedOnDisk(version: string): boolean {
  const inst = installation();
  if (inst.kind !== "installed" || !inst.root) return false;
  try {
    const app = JSON.parse(fs.readFileSync(path.join(inst.root, "app", "package.json"), "utf8")) as { version?: string };
    const info = JSON.parse(fs.readFileSync(path.join(inst.root, "install.json"), "utf8")) as { node?: string };
    return app.version !== version || info.node !== inst.node;
  } catch {
    return false;
  }
}

/** The program and arguments that run strom: this Node and its entry script (cli.ts from sources, cli.js built). */
export function stromLauncher(): { command: string; args: string[] } {
  const cli = path.resolve(path.dirname(here), "..", here.endsWith(".ts") ? "cli.ts" : "cli.js");
  return { command: process.execPath, args: [cli] };
}
