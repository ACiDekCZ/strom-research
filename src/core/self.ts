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

import { createHash } from "node:crypto";
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
 * For an agent on Windows (AGENTS.md, the guide): Windows PowerShell 5.1 decodes a native program's output kept in a
 * variable, piped into a cmdlet or redirected in the console's OEM code page — names with diacritics come out broken,
 * and an agent that parses that JSON writes them back so. Read straight, the agent's tool shows it right. `q`: the quote
 * around code (AGENTS.md's backtick, the guide's none). Empty on another system.
 */
export function powershellUtf8Rule(q: string, platform: NodeJS.Platform = process.platform): string {
  return platform === "win32"
    ? `In Windows PowerShell 5.1, set ${q}[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()${q} before keeping strom's output in a variable, piping it or redirecting it, or names with diacritics are misread.`
    : "";
}

const nonAscii = (a: string) => /[^\x00-\x7f]/.test(a);
/** A path as a line of a batch file names it: cmd turns %% into %, a % alone would begin a variable. */
const batchLiteral = (a: string) => a.replace(/%/g, "%%");

/** The folders of the person's profile cmd expands whatever the code page (Windows keeps them in UTF-16), in this order. */
const SHIM_VARS = ["LOCALAPPDATA", "APPDATA", "USERPROFILE"] as const;

/** The line that keeps a ! of a path a !, whatever the caller's cmd does with delayed expansion (cmd /v:on). */
const NO_DELAYED = "setlocal DisableDelayedExpansion";

/**
 * The line of the tree's strom.cmd with each path outside ASCII named through a folder of the profile
 * (%LOCALAPPDATA%\Programs\Strom\…) when the rest of it is ASCII — undefined when one stays outside ASCII. The paths so
 * named, for the file to check they are there; `vars`: the folder of the profile each element is named through (none:
 * written as it is). A value with %, " or ^ (or a line break) is never used.
 */
function shimViaEnv(line: string[], env: NodeJS.ProcessEnv): { line: string[]; named: string[]; vars: (string | undefined)[] } | undefined {
  const out: string[] = [];
  const named: string[] = [];
  const vars: (string | undefined)[] = [];
  for (const a of line) {
    if (!nonAscii(a)) {
      out.push(batchLiteral(a));
      vars.push(undefined);
      continue;
    }
    const at = a.normalize("NFC");
    let found: string | undefined;
    for (const name of SHIM_VARS) {
      const value = env[name]?.normalize("NFC").replace(/[\\/]+$/, "");
      if (!value || /[%"^\r\n]/.test(value)) continue;
      const rest = at.slice(value.length);
      if (at.slice(0, value.length).toLowerCase() !== value.toLowerCase() || !/^([\\/]|$)/.test(rest) || nonAscii(rest)) continue;
      found = `%${name}%${batchLiteral(rest)}`;
      vars.push(name);
      break;
    }
    if (!found) return undefined;
    out.push(found);
    named.push(found);
  }
  return { line: out, named, vars };
}

/**
 * The name of the empty file beside strom's entry script that tells this installation from another one at the place a
 * folder of the profile names (another LOCALAPPDATA, the person's own strom there): .strom-shim-<the first 16 hex of
 * the SHA-256 of the script's path as written, Windows' way — backslashes, lower case, NFC>. Another installation's
 * path differs, so it never has this one; strom update replaces the folder, and the mark with it.
 */
export function shimMarker(cli: string): string {
  const key = cli.replace(/\//g, "\\").normalize("NFC").toLowerCase();
  return `.strom-shim-${createHash("sha256").update(key, "utf8").digest("hex").slice(0, 16)}`;
}

/**
 * The mark beside strom's entry script there, or made now (empty); false when it cannot be (no right to write there:
 * npm's folder under Program Files) — never an error. Never in a checkout of the sources (src/cli.ts, a dist/ built
 * there): the mark is made on the person's computer only, never in what is packed.
 */
export function ensureShimMarker(cli: string): boolean {
  try {
    if (fs.existsSync(path.join(path.dirname(path.dirname(cli)), ".git"))) return false;
    const file = path.join(path.dirname(cli), shimMarker(cli));
    try {
      if (fs.statSync(file).isFile()) return true;
    } catch {
      // not there yet
    }
    fs.writeFileSync(file, "", { flag: "wx" });
    return true;
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === "EEXIST";
  }
}

/** Whether the mark beside the entry script (`cli`) is there or made now. */
export type ShimMark = (cli: string) => boolean;

/**
 * The line of the tree's strom.cmd named through one folder of the profile, with what the file checks before it runs
 * it — undefined when it may not be: the entry script (`line[1]`) must be named through it and carry this installation's
 * mark, Node too when it is named so (never a Node of another profile running this strom, nor this strom's path running
 * another strom: the person's own installation where the folder of the profile is another).
 */
function shimBranch(line: string[], env: NodeJS.ProcessEnv, mark: ShimMark): { line: string[]; checks: string[] } | undefined {
  const via = shimViaEnv(line, env);
  const cli = line[1];
  if (!via || cli === undefined) return undefined;
  const v = via.vars[1];
  if (!v || via.vars.some((x) => x !== undefined && x !== v)) return undefined;
  if (!mark(cli)) return undefined;
  const folder = via.line[1]!.replace(/[\\/][^\\/]*$/, "");
  return { line: via.line, checks: [...via.named, `${folder}\\${shimMarker(cli)}`] };
}

/**
 * The tree's strom.cmd. cmd reads each line of a batch file in the console's code page (852, 437…), so a path with
 * letters outside ASCII (C:\Users\Lukáš…) would be misread. Named through a folder of the profile it reads right in any
 * code page, with no console too — only when that folder holds this very installation (its mark beside cli.js, see
 * `shimBranch`); the literal path stays for another environment (an isolated installation's, another LOCALAPPDATA):
 * there the console is put to UTF-8 before the line that names it — every line before it ASCII — and given back after,
 * as the console is the caller's (its code page the last word of chcp's line, in any language). Delayed expansion is
 * off for the whole file (a ! of a path kept; an ASCII path only when it holds one). Every way out says strom's exit (a bare exit /b gives cmd /c and PowerShell 0). A
 * path in ASCII: the two lines alone, no chcp started at each call, no mark. A % in a path is written %% (cmd would read
 * %…% as a variable); the folders of the profile are never named through a value that holds one. `mark`: the mark
 * there or made (tests: their own).
 */
export function shimCmd(command: string, args: string[], env: NodeJS.ProcessEnv = process.env, mark: ShimMark = ensureShimMarker): string {
  const line = [command, ...args];
  const quoted = (l: string[]) => l.map((a) => `"${a}"`).join(" ");
  // (the paths as they are, every % doubled: a % in a folder's name is no variable)
  const literal = line.map(batchLiteral);
  // (a ! in a path is lost where the caller's cmd has delayed expansion on, cmd /v:on: off for this file)
  if (!line.some(nonAscii)) return `@echo off\r\n${line.some((a) => a.includes("!")) ? `${NO_DELAYED}\r\n` : ""}${quoted(literal)} %*\r\n`;
  const via = shimBranch(line, env, mark);
  return [
    "@echo off",
    NO_DELAYED,
    ...(via ? [...via.checks.map((p) => `if not exist "${p}" goto literal`), `${quoted(via.line)} %*`, "exit /b %ERRORLEVEL%", ":literal"] : []),
    // the console's code page: the last word of chcp's line, whatever its language (852, 850. — its dot taken off below)
    'for /f "delims=" %%l in (\'chcp\') do for %%w in (%%l) do set "_STROMCP=%%w"',
    "chcp 65001 >nul 2>nul",
    `${quoted(literal)} %*`,
    'set "_STROMRC=%ERRORLEVEL%"',
    "if defined _STROMCP chcp %_STROMCP:.=% >nul 2>nul",
    "exit /b %_STROMRC%",
    "",
  ].join("\r\n");
}

/**
 * Whether the tree's strom.cmd of this installation works only by the console's code page (Windows: strom doctor says
 * it): no folder of the profile names it, or the mark beside cli.js cannot be made there.
 */
export function shimNeedsCodePage(command: string, args: string[], env: NodeJS.ProcessEnv = process.env, mark: ShimMark = ensureShimMarker): boolean {
  const line = [command, ...args];
  return line.some(nonAscii) && !shimBranch(line, env, mark);
}

/** The program a shim starts: this installation's Node and entry script (tests: their own). */
export type Launcher = { command: string; args: string[] };

/**
 * A `strom` in the tree's .strom/bin for the agent — on its PATH when strom starts it, named by the tree's agent hooks —
 * pointing at this very installation (a shell script and a .cmd; strom-hook.cmd: the .cmd whose exit is always 0, for
 * a hook). Written only when it differs, each file whole (a temporary file renamed over it: an agent running it that
 * moment never reads half of it). The folder, and the files written now.
 */
export function putShim(root: string, env: NodeJS.ProcessEnv = process.env, launcher: Launcher = stromLauncher()): { dir: string; changed: string[] } {
  const dir = path.join(root, ".strom", "bin");
  const { command, args } = launcher;
  const run = [command, ...args].map((a) => `"${a}"`).join(" ");
  fs.mkdirSync(dir, { recursive: true });
  const changed: string[] = [];
  const put = (name: string, text: string, mode?: number) => {
    const file = path.join(dir, name);
    try {
      if (fs.readFileSync(file, "utf8") === text) return;
    } catch {
      // not there yet
    }
    const tmp = path.join(dir, `.${name}.${process.pid}.${Math.random().toString(36).slice(2, 10)}.tmp`);
    try {
      fs.writeFileSync(tmp, text, mode === undefined ? {} : { mode });
      if (mode !== undefined) fs.chmodSync(tmp, mode);
      fs.renameSync(tmp, file);
    } catch {
      // (Windows: a file another process holds open is not replaced by a rename) — written in place
      fs.rmSync(tmp, { force: true });
      fs.writeFileSync(file, text, mode === undefined ? {} : { mode });
    }
    changed.push(name);
  };
  put("strom", `#!/bin/sh\nexec ${run} "$@"\n`, 0o755);
  put("strom.cmd", shimCmd(command, args, env));
  // for an agent's hook on Windows run by a shell that is not PowerShell (Grok's): strom's answer passed on, its
  // failure never blocking the call — an older strom that knows not the command exits 2, which would block the call
  put("strom-hook.cmd", `@echo off\r\ncall "%~dp0strom.cmd" %*\r\nexit /b 0\r\n`);
  return { dir, changed };
}

/** `putShim`'s folder. */
export function writeShim(root: string, env: NodeJS.ProcessEnv = process.env, launcher: Launcher = stromLauncher()): string {
  return putShim(root, env, launcher).dir;
}

/**
 * The shim of a research written again for this installation (the first run of another strom: an older one's shim,
 * one whose mark went with the app/ an update replaced) — only where the research has one (.strom/bin), never in an
 * archive (no agent's files there), never an error. Whether anything was written.
 */
export function refreshTreeShim(root: string, env: NodeJS.ProcessEnv = process.env, launcher: Launcher = stromLauncher()): boolean {
  try {
    if (!fs.statSync(path.join(root, ".strom", "bin")).isDirectory()) return false;
    const config = JSON.parse(fs.readFileSync(path.join(root, "strom.json"), "utf8")) as { mode?: unknown };
    if (config.mode === "archive") return false;
    return putShim(root, env, launcher).changed.length > 0;
  } catch {
    return false;
  }
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
