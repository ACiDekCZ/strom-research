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
  /** installed: installed for the beta versions (install.json channel); none: the releases. */
  channel?: "beta";
  /** installed: a second installation's own command beside the person's strom (install.json command: strom-beta). */
  command?: string;
}

/** What install.json may carry for every start of its installation; nothing else is taken from it. */
export const INSTALL_ENV_KEYS = ["STROM_CONFIG_DIR", "HOME", "STROM_ISOLATED", "STROM_COMMAND"] as const;

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
      const info = JSON.parse(fs.readFileSync(path.join(root, "install.json"), "utf8")) as { launchers?: string[]; node?: string; env?: Record<string, string>; channel?: unknown; command?: unknown };
      const env = info.env && typeof info.env === "object" ? info.env : undefined;
      return (cached = { kind: "installed", root, launchers: info.launchers ?? [], ...(info.node ? { node: info.node } : {}), ...(env ? { env } : {}), ...(info.channel === "beta" ? { channel: "beta" as const } : {}), ...(typeof info.command === "string" ? { command: info.command } : {}) });
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

/**
 * A `strom` in the tree's .strom/bin for the agent — on its PATH when strom starts it, named by the tree's agent hooks —
 * pointing at this very installation (a shell script and a .cmd; strom-hook.cmd: the .cmd whose exit is always 0, for
 * a hook). Written only when it differs. The folder.
 */
export function writeShim(root: string): string {
  const dir = path.join(root, ".strom", "bin");
  const { command, args } = stromLauncher();
  const run = [command, ...args].map((a) => `"${a}"`).join(" ");
  fs.mkdirSync(dir, { recursive: true });
  const put = (name: string, text: string, mode?: number) => {
    const file = path.join(dir, name);
    try {
      if (fs.readFileSync(file, "utf8") === text) return;
    } catch {
      // not there yet
    }
    fs.writeFileSync(file, text, mode === undefined ? {} : { mode });
  };
  put("strom", `#!/bin/sh\nexec ${run} "$@"\n`, 0o755);
  put("strom.cmd", `@echo off\r\n${run} %*\r\n`);
  // for an agent's hook on Windows run by a shell that is not PowerShell (Grok's): strom's answer passed on, its
  // failure never blocking the call — an older strom that knows not the command exits 2, which would
  put("strom-hook.cmd", `@echo off\r\ncall "%~dp0strom.cmd" %*\r\nexit /b 0\r\n`);
  return dir;
}

/**
 * A path as compared, both as named and as the disk has it (/tmp and /private/tmp — a folder not there yet by the
 * nearest one that is); case aside on macOS and Windows.
 */
export function pathForms(p: string, platform: NodeJS.Platform = process.platform): string[] {
  const named = path.resolve(p);
  const out = [named];
  let at = named;
  let rest = "";
  for (;;) {
    try {
      out.push(path.join(fs.realpathSync.native(at), rest));
      break;
    } catch {
      const up = path.dirname(at);
      if (up === at) break; // none of it there: as it is named
      rest = rest ? path.join(path.basename(at), rest) : path.basename(at);
      at = up;
    }
  }
  return [...new Set(platform === "win32" || platform === "darwin" ? out.map((x) => x.toLowerCase()) : out)];
}

/** `inner` is the folder `outer` or somewhere in it — as named or as the disk has it, case aside on macOS and Windows. */
export function holdsPath(outer: string, inner: string, platform: NodeJS.Platform = process.platform): boolean {
  const os = pathForms(outer, platform);
  return pathForms(inner, platform).some((i) => os.some((o) => i === o || i.startsWith(o.endsWith(path.sep) ? o : o + path.sep)));
}

/** The entries of the installer's folder that strom update replaces (app, node) or removes (app.old) — never a research's place. */
export const REPLACED_ENTRIES = ["app", "app.old", "node"] as const;
/** What the installer, strom update and strom's own git put into its folder (strom uninstall takes these). */
export const PROGRAM_ENTRIES = [...REPLACED_ENTRIES, "git", "git.part"] as const;

/**
 * The folder strom's program lives in, which an update replaces and strom uninstall takes away: the installer's (node/,
 * app/, install.json), npm's package; run from the sources: none.
 */
export function programFolder(inst: Installation = installation()): string | undefined {
  if (inst.kind === "installed") return inst.root;
  if (inst.kind === "npm") return path.resolve(path.dirname(here), "..", "..");
  return undefined;
}

/**
 * Is `folder` a place no research may be put (strom setup, config set, a move): inside strom's program folder — what
 * an update replaces and uninstall takes away (found 2026-10-07: a research inside app/ went with the next update, and
 * the backup made just before it). The settings folder of an isolated installation inside it stays allowed (its
 * research, "Strom research", lies there by default; uninstall keeps it), unless it is one of the program's own
 * entries. Returns the program's folder it lies in, else undefined.
 */
export function insideProgram(folder: string, opts: { inst?: Installation; settings?: string; platform?: NodeJS.Platform } = {}): string | undefined {
  const inst = opts.inst ?? installation();
  const root = programFolder(inst);
  if (!root) return undefined;
  const platform = opts.platform ?? process.platform;
  if (!holdsPath(root, folder, platform)) return undefined;
  if (inst.kind !== "installed") return root;
  const inEntry = PROGRAM_ENTRIES.some((e) => holdsPath(path.join(root, e), folder, platform)) || /^\.update-/.test(path.relative(root, folder).split(/[\\/]/)[0] ?? "");
  if (!inEntry && opts.settings && holdsPath(root, opts.settings, platform) && holdsPath(opts.settings, folder, platform)) return undefined;
  return root;
}

/**
 * What of `keep` (the research, its home, trees, shared folder, backups, the settings) lies inside the entries strom
 * update replaces or removes in the installer's folder `root` — app/, app.old/, node/: an update would take it away.
 */
export function replacedHolding(root: string, keep: string[], platform: NodeJS.Platform = process.platform): { folder: string; entry: string }[] {
  const out: { folder: string; entry: string }[] = [];
  for (const folder of keep) {
    const e = REPLACED_ENTRIES.find((e) => holdsPath(path.join(root, e), folder, platform));
    if (e) out.push({ folder, entry: path.join(root, e) });
  }
  return out;
}
