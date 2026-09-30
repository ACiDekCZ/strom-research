// Links from the Strom app: strom-research://send?tree=… and
// strom-research://excerpt?tree=…&source=…&clip=… (the app's spec
// docs/ZADANI_VYZKUM_ODKAZY_Z_APLIKACE.md in the Strom repository). A web page
// may not start a program on the computer — only through a scheme of links the
// program registered with the system, and the browser asks first. strom
// registers it for this user alone, no admin rights, on the user's yes (the
// wizard, strom doctor --fix, strom link on):
//
//   macOS    a small AppleScript applet ~/Applications/Strom Research.app —
//            the system hands a link over as an Apple Event, never as an argument
//   Windows  HKCU\Software\Classes\strom-research, straight to strom's Node
//            (never through cmd, which would read the link again: %, &, ")
//   Linux    a .desktop entry, the default for x-scheme-handler/strom-research
//
// Any page can open such a link, so what it carries is never trusted: strom
// checks each part's shape, writes nothing without the user's word in the
// terminal, and an unknown action, research or excerpt is only said.
// The app learns that links work from strom itself (the bridge's /status,
// the GEDCOM it serves): only while the scheme here leads to this strom.

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import type { Env } from "./paths.ts";
import { userHome } from "./paths.ts";
import { stromLauncher } from "./self.ts";
import { ICON } from "./shortcut.ts";

export const LINK_SCHEME = "strom-research";
/**
 * What the links strom understands do: send the edited tree back, open an excerpt in full, send the research
 * as it is now into the app's window, open the research's menu, a conversation with the agent (of one person),
 * a task (answered, put aside, given up, back in the queue), a person's review, a new direction from a person —
 * and (the app's second wave) a new research with a tree of the app, strom's update, the agent's sessions and
 * what they cost, a conflict decided (by the user or the agent), a story approved, a sync taken back, the setup —
 * and (the app's 3.5.0) the research followed live in the app's window; a direction of the research paused, ended or
 * taken up again, a conversation about one direction, a session at work asked to finish.
 */
export const LINK_ACTIONS = ["send", "excerpt", "app", "open", "chat", "task", "review", "research", "new", "update", "sessions", "conflict", "story", "sync-undo", "setup", "live", "direction", "finish"] as const;
/** A person's review: the person, with the family, with the ancestors (strom review --scope). */
export const LINK_SCOPES = ["person", "family", "line"] as const;
/** A new direction from a person (strom research new --direction). */
export const LINK_DIRECTIONS = ["ancestors", "descendants"] as const;
/** What a link does with a task: put it aside, give it up, back into the queue (none: answer it). */
export const LINK_TASK_DOS = ["park", "drop", "wake"] as const;
/** What a link does with a direction of the research (strom research pause|done|resume). */
export const LINK_DIRECTION_DOS = ["pause", "done", "resume"] as const;
/** What a link does with a conflict: the user decides it, or leaves it to the agent. */
export const LINK_CONFLICT_DOS = ["decide", "agent"] as const;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SOURCE = /^S\d{1,9}$/;
const PERSON = /^P\d{1,9}$/;
const TASK = /^T\d{1,9}$/;
const CONFLICT = /^X\d{1,9}$/;
const INPUT = /^I\d{1,9}$/;
const RESEARCH = /^G\d{1,9}$/;
const SESSION = /^N\d{1,9}$/;
/** The app's own mark of a tree it hands over (32 random bytes, base64url). */
export const APP_TOKEN = /^[A-Za-z0-9_-]{22,43}$/;
/** An excerpt's mark (_STROM_CLIP): letters, digits and "-", at most 32. */
export const CLIP_MARK = /^[A-Za-z0-9-]{1,32}$/;

export type Link =
  | { action: "send"; tree: string }
  | { action: "app"; tree: string }
  | { action: "live"; tree: string }
  | { action: "open"; tree: string }
  | { action: "update"; tree: string }
  | { action: "sessions"; tree: string }
  | { action: "setup"; tree: string }
  | { action: "excerpt"; tree: string; source: string; clip: string }
  | { action: "chat"; tree: string; person?: string; research?: string }
  | { action: "task"; tree: string; task: string; do?: (typeof LINK_TASK_DOS)[number] }
  | { action: "review"; tree: string; person: string; scope: (typeof LINK_SCOPES)[number] }
  | { action: "research"; tree: string; person: string; direction: (typeof LINK_DIRECTIONS)[number] }
  | { action: "conflict"; tree: string; id: string; do: (typeof LINK_CONFLICT_DOS)[number] }
  | { action: "story"; tree: string; person: string; do: "final" }
  | { action: "sync-undo"; tree: string; intake: string }
  | { action: "direction"; tree: string; id: string; do: (typeof LINK_DIRECTION_DOS)[number] }
  | { action: "finish"; tree: string; session: string }
  | { action: "new"; app: string }
  | { action: "menu" };

/** Why a link was not taken: said to the user, never acted on. */
export class LinkError extends Error {}

/** One of fixed values, the default when none is given; anything else is a LinkError. */
function oneOf<T extends string>(q: URLSearchParams, name: string, values: readonly T[], fallback?: T): T {
  const v = q.get(name) ?? fallback;
  if (v === undefined || !(values as readonly string[]).includes(v)) throw new LinkError(`unknown ${name} "${(v ?? "").slice(0, 32)}"`);
  return v as T;
}

/** An ID of a kind (P…, T…): upper-cased, checked; none when not given and not needed. */
function idOf(q: URLSearchParams, name: string, shape: RegExp, needed: boolean): string | undefined {
  if (!q.has(name) && !needed) return undefined;
  const v = (q.get(name) ?? "").toUpperCase();
  if (!shape.test(v)) throw new LinkError(`no ${name} named`);
  return v;
}

/** A link, checked part by part; anything else is a LinkError. No link at all (the applet opened by itself): the menu. */
export function parseLink(text: string | undefined): Link {
  if (!text?.trim()) return { action: "menu" };
  const raw = text.trim();
  if (raw.length > 2048) throw new LinkError("too long");
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new LinkError("not a link");
  }
  if (url.protocol !== `${LINK_SCHEME}:`) throw new LinkError(`not a ${LINK_SCHEME} link`);
  // strom-research://send?… — and the forms systems make of it: …//send/?…, strom-research:send?…
  const action = (url.host || url.pathname).replace(/^\/+|\/+$/g, "").toLowerCase();
  const q = url.searchParams;
  // the one link without a research: a tree of the app becomes one
  if (action === "new") {
    const app = q.get("app") ?? "";
    if (!APP_TOKEN.test(app)) throw new LinkError("no tree of the app named");
    return { action, app };
  }
  const tree = q.get("tree") ?? "";
  if (!UUID.test(tree)) throw new LinkError("no research named");
  const id = tree.toLowerCase();
  const person = idOf(q, "person", PERSON, false);
  switch (action) {
    case "send":
    case "app":
    case "live":
    case "open":
    case "update":
    case "sessions":
    case "setup":
      return { action, tree: id };
    case "excerpt": {
      const source = (q.get("source") ?? "").toUpperCase();
      const clip = q.get("clip") ?? "";
      if (!SOURCE.test(source) || !CLIP_MARK.test(clip)) throw new LinkError("no excerpt named");
      return { action, tree: id, source, clip };
    }
    case "chat": {
      const research = idOf(q, "research", RESEARCH, false);
      return { action, tree: id, ...(person ? { person } : {}), ...(research ? { research } : {}) };
    }
    case "task": {
      const task = idOf(q, "task", TASK, true)!;
      return { action, tree: id, task, ...(q.has("do") ? { do: oneOf(q, "do", LINK_TASK_DOS) } : {}) };
    }
    case "review":
    case "research":
    case "story": {
      if (!person) throw new LinkError("no person named");
      if (action === "review") return { action, tree: id, person, scope: oneOf(q, "scope", LINK_SCOPES, "person") };
      if (action === "research") return { action, tree: id, person, direction: oneOf(q, "direction", LINK_DIRECTIONS, "ancestors") };
      return { action, tree: id, person, do: oneOf(q, "do", ["final"] as const) };
    }
    case "conflict":
      return { action, tree: id, id: idOf(q, "id", CONFLICT, true)!, do: oneOf(q, "do", LINK_CONFLICT_DOS, "decide") };
    case "sync-undo":
      return { action, tree: id, intake: idOf(q, "intake", INPUT, true)! };
    case "direction":
      return { action, tree: id, id: idOf(q, "id", RESEARCH, true)!, do: oneOf(q, "do", LINK_DIRECTION_DOS) };
    case "finish":
      return { action, tree: id, session: idOf(q, "session", SESSION, true)! };
  }
  throw new LinkError(`unknown action "${action.slice(0, 32)}"`);
}

/** A link written again from what was checked in it: only its known parts, in one form (handed to a new terminal). */
export function linkText(link: Exclude<Link, { action: "menu" }>): string {
  const { action, ...parts } = link;
  const q = new URLSearchParams(Object.entries(parts).filter((e): e is [string, string] => typeof e[1] === "string"));
  return `${LINK_SCHEME}://${action}?${q}`;
}

// ── the handler, per system ──

/** Where it is: whether the scheme leads to this strom, to another program (or an older place of strom), or nowhere. */
export type HandlerState = "ours" | "other" | "none";

/**
 * What the handler runs: this strom's Node and script, "link open", the link. A strom of its own settings folder
 * (STROM_CONFIG_DIR) gives its links that folder too (macOS, Linux: through env) — the same researches answer them.
 */
function handlerArgv(env: Env = {}, platform: NodeJS.Platform = process.platform): string[] {
  const { command, args } = stromLauncher();
  const own = env.STROM_CONFIG_DIR && platform !== "win32" ? ["/usr/bin/env", `STROM_CONFIG_DIR=${env.STROM_CONFIG_DIR}`] : [];
  return [...own, command, ...args, "link", "open"];
}

/** macOS: the applet strom makes. */
export function macApp(env: Env): string {
  return path.join(userHome(env), "Applications", "Strom Research.app");
}

/** Linux: the entry that takes the links (the shortcut's own is strom-research.desktop). */
export const LINUX_ENTRY = "strom-research-link.desktop";

function linuxEntry(env: Env): string {
  return path.join(env.XDG_DATA_HOME ?? path.join(userHome(env), ".local", "share"), "applications", LINUX_ENTRY);
}

const WIN_KEY = `HKCU\\Software\\Classes\\${LINK_SCHEME}`;

/** AppleScript string literal. */
function appleString(s: string): string {
  return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/** A POSIX shell word. */
function shellWord(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

/**
 * The applet's script: a link comes as an Apple Event (open location); opened by itself, the menu. strom runs in
 * the background, so the applet ends at once; what strom has to say it says in a window or a terminal of its own.
 */
export function macScript(argv: string[]): string {
  const run = argv.map(shellWord).join(" ");
  return [
    "on open location theURL",
    `\tdo shell script ${appleString(`${run} `)} & quoted form of theURL & ${appleString(" >/dev/null 2>&1 &")}`,
    "end open location",
    "on run",
    `\tdo shell script ${appleString(`${run} >/dev/null 2>&1 &`)}`,
    "end run",
    "",
  ].join("\n");
}

/** Windows: the command in the registry — strom's Node itself, the link one argument. */
export function windowsCommand(argv: string[] = handlerArgv({}, "win32")): string {
  return [...argv, "%1"].map((a) => `"${a}"`).join(" ");
}

/** A word of a .desktop Exec line, quoted as the spec says; "%" doubled. */
function desktopWord(s: string): string {
  const quoted = /[\s"'\\$`<>~|&;*?#()]/.test(s) ? `"${s.replace(/([\\"`$])/g, "\\$1")}"` : s;
  // …and a .desktop value escapes its backslashes once more
  return quoted.replace(/\\/g, "\\\\").replace(/%/g, "%%");
}

export function linuxDesktopEntry(argv: string[]): string {
  return [
    "[Desktop Entry]",
    "Type=Application",
    "Name=Strom Research",
    "NoDisplay=true",
    `Exec=${argv.map(desktopWord).join(" ")} %u`,
    `Icon=${ICON.png}`,
    "Terminal=false",
    `MimeType=x-scheme-handler/${LINK_SCHEME};`,
    "",
  ].join("\n");
}

type Sys = (cmd: string, args: string[]) => { status: number | null; stdout: string };

const sys: Sys = (cmd, args) => {
  const r = spawnSync(cmd, args, { encoding: "utf8", timeout: 30_000, windowsHide: true });
  return { status: r.error ? null : r.status, stdout: r.stdout ?? "" };
};

const LSREGISTER = "/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister";

/** The app the system opens a strom-research link with (macOS), or "". */
function macHandlerPath(run: Sys): string {
  const js = `ObjC.import("AppKit");var u=$.NSWorkspace.sharedWorkspace.URLForApplicationToOpenURL($.NSURL.URLWithString("${LINK_SCHEME}://status"));u.isNil()?"":u.path.js`;
  const r = run("osascript", ["-l", "JavaScript", "-e", js]);
  return r.status === 0 ? r.stdout.trim() : "";
}

/** The mark inside strom's applet: what it runs (another strom's applet, or one of an older place, is not ours). */
function macMark(app: string): string {
  return path.join(app, "Contents", "Resources", "strom-link.json");
}

/** Does the scheme lead to this strom? No system is asked from a test (STROM_NO_INSTALL). */
export function linkHandlerState(env: Env, platform: NodeJS.Platform = process.platform, run: Sys = sys): HandlerState {
  if (env.STROM_NO_INSTALL === "1" && run === sys) return "none";
  const argv = handlerArgv(env, platform);
  if (platform === "darwin") {
    const at = macHandlerPath(run);
    if (!at) return "none";
    const app = macApp(env);
    if (path.resolve(at) !== path.resolve(app)) return "other";
    try {
      return JSON.stringify((JSON.parse(fs.readFileSync(macMark(app), "utf8")) as { argv?: string[] }).argv) === JSON.stringify(argv) ? "ours" : "other";
    } catch {
      return "other";
    }
  }
  if (platform === "win32") {
    const r = run("reg.exe", ["query", `${WIN_KEY}\\shell\\open\\command`, "/ve"]);
    if (r.status !== 0) return "none";
    const value = /REG_(?:EXPAND_)?SZ\s+(.*)$/m.exec(r.stdout)?.[1]?.trim();
    return value === windowsCommand(argv) ? "ours" : value ? "other" : "none";
  }
  const r = run("xdg-mime", ["query", "default", `x-scheme-handler/${LINK_SCHEME}`]);
  const entry = r.status === 0 ? r.stdout.trim() : "";
  if (!entry) return "none";
  if (entry !== LINUX_ENTRY) return "other";
  try {
    return fs.readFileSync(linuxEntry(env), "utf8") === linuxDesktopEntry(argv) ? "ours" : "other";
  } catch {
    return "other";
  }
}

/** The actions a link can do here: all of them while the scheme leads to this strom, else none. */
export function linkActions(state: HandlerState): string[] {
  return state === "ours" ? [...LINK_ACTIONS] : [];
}

/** Register the scheme for this user (or register it again: this strom moved, was updated); true when it leads to this strom now. */
export function registerLinks(env: Env, platform: NodeJS.Platform = process.platform, run: Sys = sys): boolean {
  if (env.STROM_NO_INSTALL === "1" && run === sys) return false;
  const argv = handlerArgv(env, platform);
  if (platform === "darwin") {
    const app = macApp(env);
    fs.mkdirSync(path.dirname(app), { recursive: true });
    fs.rmSync(app, { recursive: true, force: true });
    const script = path.join(path.dirname(app), ".strom-link.applescript");
    fs.writeFileSync(script, macScript(argv));
    const made = run("osacompile", ["-o", app, script]);
    fs.rmSync(script, { force: true });
    if (made.status !== 0) return false;
    const plist = path.join(app, "Contents", "Info.plist");
    run("plutil", ["-replace", "CFBundleIdentifier", "-string", "info.stromapp.research.link", plist]);
    run("plutil", ["-replace", "CFBundleName", "-string", "Strom Research", plist]);
    run("plutil", ["-replace", "LSUIElement", "-bool", "true", plist]);
    run("plutil", ["-replace", "CFBundleURLTypes", "-json", JSON.stringify([{ CFBundleURLName: "Strom Research", CFBundleURLSchemes: [LINK_SCHEME] }]), plist]);
    // its icon: Strom Research's own
    if (fs.existsSync(ICON.png)) run("sips", ["-s", "format", "icns", ICON.png, "--out", path.join(app, "Contents", "Resources", "applet.icns")]);
    fs.writeFileSync(macMark(app), JSON.stringify({ argv }, null, 2));
    // the applet's seal covers its Info.plist: sealed again, by itself (no one's certificate)
    run("codesign", ["--force", "--sign", "-", app]);
    run(LSREGISTER, ["-f", app]);
    return linkHandlerState(env, platform, run) === "ours";
  }
  if (platform === "win32") {
    const add = (key: string, args: string[]) => run("reg.exe", ["add", key, ...args, "/f"]).status === 0;
    const ok =
      add(WIN_KEY, ["/ve", "/d", "URL:Strom Research"]) &&
      add(WIN_KEY, ["/v", "URL Protocol", "/d", ""]) &&
      add(`${WIN_KEY}\\DefaultIcon`, ["/ve", "/d", ICON.ico]) &&
      add(`${WIN_KEY}\\shell\\open\\command`, ["/ve", "/d", windowsCommand(argv)]);
    return ok && linkHandlerState(env, platform, run) === "ours";
  }
  const file = linuxEntry(env);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, linuxDesktopEntry(argv));
  run("xdg-mime", ["default", LINUX_ENTRY, `x-scheme-handler/${LINK_SCHEME}`]);
  run("update-desktop-database", [path.dirname(file)]);
  return linkHandlerState(env, platform, run) === "ours";
}

/** What strom put there for the links (for strom uninstall): the applet, the registry key or the entry. */
export function linkFiles(env: Env, platform: NodeJS.Platform = process.platform, run: Sys = sys): string[] {
  if (platform === "darwin") return fs.existsSync(macApp(env)) && fs.existsSync(macMark(macApp(env))) ? [macApp(env)] : [];
  if (platform === "win32") {
    if (env.STROM_NO_INSTALL === "1" && run === sys) return [];
    const r = run("reg.exe", ["query", `${WIN_KEY}\\shell\\open\\command`, "/ve"]);
    return r.status === 0 && /link"? "?open/.test(r.stdout) ? [WIN_KEY] : [];
  }
  return fs.existsSync(linuxEntry(env)) ? [linuxEntry(env)] : [];
}

/** Take the scheme off again (strom link off, strom uninstall); true when nothing of strom's is left for it. */
export function unregisterLinks(env: Env, platform: NodeJS.Platform = process.platform, run: Sys = sys): boolean {
  if (platform === "darwin") {
    const app = macApp(env);
    if (fs.existsSync(macMark(app))) {
      run(LSREGISTER, ["-u", app]);
      fs.rmSync(app, { recursive: true, force: true });
    }
    return !fs.existsSync(app) || !fs.existsSync(macMark(app));
  }
  if (platform === "win32") {
    if (!linkFiles(env, platform, run).length) return true;
    return run("reg.exe", ["delete", WIN_KEY, "/f"]).status === 0;
  }
  const file = linuxEntry(env);
  fs.rmSync(file, { force: true });
  // the default the entry was given goes with it
  const list = path.join(env.XDG_CONFIG_HOME ?? path.join(userHome(env), ".config"), "mimeapps.list");
  try {
    const text = fs.readFileSync(list, "utf8");
    const kept = text.split("\n").filter((l) => !(l.startsWith(`x-scheme-handler/${LINK_SCHEME}=`) && l.includes(LINUX_ENTRY)));
    if (kept.length !== text.split("\n").length) fs.writeFileSync(list, kept.join("\n"));
  } catch {
    // no list
  }
  return true;
}
