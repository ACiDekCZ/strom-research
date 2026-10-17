// The terminal strom opens its windows in (a link from the Strom app, a
// conversation handed over): the system's — what opens a .command file — unless
// the person chose another (terminal, a setting of this computer alone: never a
// research's strom.json, never a link). macOS only for now: each choice maps to
// a fixed bundle ID, opened with `open -b`; one not installed: the system's.
// Windows decides it itself (its default terminal application), Linux keeps its
// order (core/shortcut.ts).

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import type { Env } from "./paths.ts";
import { userHome } from "./paths.ts";

export interface MacTerminal {
  /** Its bundle ID: what `open -b` opens. */
  id: string;
  /** Its bundle's name in /Applications. */
  app: string;
  /** Its name, as a person sees it. */
  name: string;
  /** Its mark in the windows it opens (TERM_PROGRAM). */
  mark: string;
}

export const MAC_TERMINALS: Record<string, MacTerminal> = {
  terminal: { id: "com.apple.Terminal", app: "Terminal.app", name: "Terminal", mark: "Apple_Terminal" },
  iterm2: { id: "com.googlecode.iterm2", app: "iTerm.app", name: "iTerm2", mark: "iTerm.app" },
};

/** Every value of the setting, on any system (the help names them). */
export const TERMINAL_CHOICES = ["system", ...Object.keys(MAC_TERMINALS)] as const;

/** The values this system takes: macOS its terminals, elsewhere the system's alone. */
export function terminalChoices(platform: NodeJS.Platform = process.platform): string[] {
  return platform === "darwin" ? [...TERMINAL_CHOICES] : ["system"];
}

/** The chosen terminal of macOS (none: the system's) — one of its own keys only, never one of an object's prototype. */
export function macTerminal(choice: string | undefined, platform: NodeJS.Platform = process.platform): MacTerminal | undefined {
  return platform === "darwin" && choice && Object.hasOwn(MAC_TERMINALS, choice) ? MAC_TERMINALS[choice] : undefined;
}

/** The folders apps lie in (STROM_APP_DIRS: folders to look in instead — tests). */
function appDirs(env: Env): string[] {
  if (env.STROM_APP_DIRS !== undefined) return env.STROM_APP_DIRS.split(path.delimiter).filter(Boolean);
  return ["/Applications", "/Applications/Utilities", "/System/Applications/Utilities", path.join(userHome(env), "Applications")];
}

/** Ask the system (JXA) — nothing when tests give folders of their own. */
function jxa(env: Env, js: string, args: string[] = []): string | undefined {
  if (env.STROM_APP_DIRS !== undefined) return undefined;
  const r = spawnSync("osascript", ["-l", "JavaScript", "-e", js, ...args], { encoding: "utf8", timeout: 10_000 });
  return r.status === 0 ? r.stdout.trim() : undefined;
}

/** The terminals of macOS on this computer, in strom's order: by their bundle ID (NSWorkspace), else in the app folders. */
export function terminalsHere(env: Env, platform: NodeJS.Platform = process.platform): string[] {
  if (platform !== "darwin") return [];
  const keys = Object.keys(MAC_TERMINALS);
  const js = 'function run(a){ObjC.import("AppKit");return a.map(function(id){var u=$.NSWorkspace.sharedWorkspace.URLForApplicationWithBundleIdentifier(id);return u.isNil()?"":"y"}).join(",")}';
  const said = jxa(env, js, keys.map((k) => MAC_TERMINALS[k]!.id))?.split(",");
  return keys.filter((k, i) => said?.[i] === "y" || appDirs(env).some((d) => fs.existsSync(path.join(d, MAC_TERMINALS[k]!.app))));
}

/** Is the chosen terminal on this computer? (the system's always is) */
export function terminalHere(choice: string | undefined, env: Env, platform: NodeJS.Platform = process.platform): boolean {
  return !macTerminal(choice, platform) || terminalsHere(env, platform).includes(choice!);
}

/** What opens a .command file here (the system's terminal), when the system says: one of the choices, else its name. */
export function systemTerminal(env: Env, platform: NodeJS.Platform = process.platform): { choice?: string; name?: string } | undefined {
  if (platform !== "darwin") return undefined;
  const js =
    'ObjC.import("CoreServices");ObjC.import("AppKit");var r=$.LSCopyDefaultRoleHandlerForContentType($("com.apple.terminal.shell-script"),$.kLSRolesAll);var id=r?ObjC.castRefToObject(r):$();var s=id.isNil()?"":id.js;var u=s?$.NSWorkspace.sharedWorkspace.URLForApplicationWithBundleIdentifier(s):$();s+"\\n"+(s&&!u.isNil()?$.NSFileManager.defaultManager.displayNameAtPath(u.path).js:"")';
  const said = jxa(env, js);
  if (!said) return undefined;
  const [id, shown] = said.split("\n");
  const choice = Object.keys(MAC_TERMINALS).find((k) => MAC_TERMINALS[k]!.id.toLowerCase() === id?.toLowerCase());
  if (choice) return { choice, name: MAC_TERMINALS[choice]!.name };
  const name = shown?.replace(/\.app$/u, "");
  return name ? { name } : undefined;
}

/** The terminal a window runs in, by its mark (TERM_PROGRAM): one of the choices, else none. */
export function terminalOfMark(mark: string | undefined): string | undefined {
  return Object.keys(MAC_TERMINALS).find((k) => MAC_TERMINALS[k]!.mark === mark);
}
