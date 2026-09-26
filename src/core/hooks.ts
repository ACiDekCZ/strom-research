// Hooks: the user's programs told of what was saved into a research. After
// every commit of a research, strom starts each hook the user turned on
// (`strom hook on <name>`) in the background — never waiting for it, never
// failing because of it — with the operations that commit saved: a person
// added, a fact, a task done, a session closed… A hook filters them
// (`events` in hook.json, or itself), may read more through strom (`strom
// person card P0002`) and does with it what the user wants: a message to
// their phone, a log, a backup.
//
// A hook is a folder in the plugins folder, <shared>/plugins/hooks/<name>/,
// with hook.json ({"interface": 1, "command": [...], "events": [...]}) and its
// program (interface: assets/plugins/hooks/README.md, copied next to the
// hooks). The event comes as one JSON document on the program's stdin; what it
// prints goes to hook.log in its folder. A hook runs only when the user turned
// it on — a folder an agent put there does nothing by itself.

import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { StromError, UsageError } from "./errors.ts";
import type { Env } from "./paths.ts";
import { NAME_RE, pluginsDir } from "./connector.ts";
import { readAsset } from "./assets.ts";

export const HOOK_INTERFACE = 1;
const MANIFEST = "hook.json";
/** How long `strom hook test` waits for a hook. */
const DEFAULT_TIMEOUT_S = 60;
/** Event files older than this are cleared away (a hook reads its own at once). */
const KEEP_MS = 24 * 3600_000;
/** The hook's output, appended; cut to its last part when it grows past this. */
const LOG_MAX = 1024 * 1024;

export interface HookManifest {
  interface: number;
  /** What the user sees, e.g. "Telegram". */
  title?: string;
  /** The program and its arguments, run in the hook's folder; "node" is strom's own Node. */
  command: string[];
  /** Which operations it wants: "person.add", "person.*", "*" (default: all). */
  events?: string[];
  /** Seconds `strom hook test` waits for it (default 60). */
  timeout?: number;
}

export interface Hook {
  name: string;
  dir: string;
  manifest: HookManifest;
}

/** One saved operation, as a hook gets it. */
export interface HookEvent {
  /** What was done: person.add, event.add (a fact), family.child, task.done, session.close… */
  op: string;
  /** The records it concerns: P0002, E0014, T0005… */
  targets: string[];
  /** One line, as the history shows it: "+P0002 Frank /Johnson/ …". */
  summary: string;
  at: string;
  /** Who: a session (N0004) or the user. */
  by: string;
  reason?: string;
}

/** What a hook gets on stdin: one commit of one research. */
export interface HookPayload {
  interface: number;
  hook: string;
  tree: { name: string; id: string; root: string; lang: string };
  /** The commit that saved it. */
  commit: string;
  at: string;
  events: HookEvent[];
}

export function hooksDir(shared: string): string {
  return path.join(pluginsDir(shared), "hooks");
}

/** The hooks folder with its interface (refreshed). */
export function ensureHooksDir(shared: string): string {
  const dir = hooksDir(shared);
  try {
    fs.mkdirSync(dir, { recursive: true });
    const text = readAsset("plugins", "hooks", "README.md");
    const file = path.join(dir, "README.md");
    let old: string | undefined;
    try {
      old = fs.readFileSync(file, "utf8");
    } catch {
      old = undefined;
    }
    if (text !== undefined && old !== text) fs.writeFileSync(file, text);
  } catch (err) {
    if (!["EACCES", "EPERM", "EROFS"].includes((err as NodeJS.ErrnoException)?.code ?? "")) throw err;
  }
  return dir;
}

export function listHooks(shared: string): Hook[] {
  let names: string[] = [];
  try {
    names = fs
      .readdirSync(hooksDir(shared), { withFileTypes: true })
      .filter((d) => d.isDirectory() && NAME_RE.test(d.name))
      .map((d) => d.name);
  } catch {
    return [];
  }
  const out: Hook[] = [];
  for (const name of names.sort()) {
    try {
      out.push(loadHook(shared, name));
    } catch {
      // not a hook (yet): `strom hook test <name>` says why
    }
  }
  return out;
}

export function loadHook(shared: string, name: string): Hook {
  if (!NAME_RE.test(name)) throw new UsageError(`invalid hook name "${name}"`, { hint: "lowercase letters, digits and dashes, e.g. telegram" });
  const dir = path.join(hooksDir(shared), name);
  const file = path.join(dir, MANIFEST);
  if (!fs.existsSync(file)) throw new StromError(`no hook "${name}" (no ${file})`, { hint: `the hooks here: strom hook list — a hook is a folder in ${hooksDir(shared)} with ${MANIFEST}` });
  let m: HookManifest;
  try {
    m = JSON.parse(fs.readFileSync(file, "utf8")) as HookManifest;
  } catch (err) {
    throw new StromError(`hook "${name}": ${MANIFEST} is not valid JSON (${(err as Error).message})`);
  }
  if (m.interface !== HOOK_INTERFACE)
    throw new StromError(`hook "${name}" is for interface ${m.interface}, this strom knows ${HOOK_INTERFACE}`, {
      hint: m.interface > HOOK_INTERFACE ? "update strom: strom update" : `see ${path.join(hooksDir(shared), "README.md")}`,
    });
  if (!Array.isArray(m.command) || !m.command.length || !m.command.every((c) => typeof c === "string" && c))
    throw new StromError(`hook "${name}": "command" must be a list of strings, e.g. ["node", "hook.ts"]`);
  if (m.events !== undefined && (!Array.isArray(m.events) || !m.events.every((e) => typeof e === "string" && e)))
    throw new StromError(`hook "${name}": "events" must be a list like ["person.add", "session.*"]`);
  return { name, dir, manifest: m };
}

/** Does the hook want this operation? "*" all, "person.*" a kind, "person.add" one. */
export function wants(m: HookManifest, op: string): boolean {
  return (m.events ?? ["*"]).some((p) => p === "*" || p === op || (p.endsWith(".*") && op.startsWith(p.slice(0, -1))));
}

/** The operations of a commit the hook wants, or none. */
export function forHook(hook: Hook, events: HookEvent[]): HookEvent[] {
  return events.filter((e) => wants(hook.manifest, e.op));
}

function program(hook: Hook): { cmd: string; args: string[] } {
  const [cmd, ...args] = hook.manifest.command;
  return { cmd: cmd === "node" ? process.execPath : cmd!, args };
}

function hookEnv(env: Env, hook: Hook, payload: HookPayload, file: string): NodeJS.ProcessEnv {
  return {
    ...(env as NodeJS.ProcessEnv),
    STROM_HOOK: hook.name,
    STROM_TREE: payload.tree.root,
    STROM_LANG: payload.tree.lang,
    STROM_EVENT_FILE: file,
    // what it runs of strom reads the research the event came from, as the user would
    STROM_NONINTERACTIVE: "1",
  };
}

/** The event as a file (the hook's stdin, and STROM_EVENT_FILE); old ones are cleared away. */
function eventFile(hook: Hook, payload: HookPayload): string {
  const dir = path.join(hook.dir, ".events");
  fs.mkdirSync(dir, { recursive: true });
  try {
    for (const f of fs.readdirSync(dir)) {
      const p = path.join(dir, f);
      if (Date.now() - fs.statSync(p).mtimeMs > KEEP_MS) fs.rmSync(p, { force: true });
    }
  } catch {
    // another process cleared it
  }
  const file = path.join(dir, `${payload.at.replace(/[:.]/g, "-")}-${process.pid}-${Math.random().toString(36).slice(2, 8)}.json`);
  fs.writeFileSync(file, JSON.stringify(payload, null, 2) + "\n");
  return file;
}

/** Its log, cut to its last part when it has grown too big. */
function logFd(hook: Hook): number {
  const file = path.join(hook.dir, "hook.log");
  try {
    if (fs.statSync(file).size > LOG_MAX) {
      const tail = fs.readFileSync(file).subarray(-LOG_MAX / 2);
      fs.writeFileSync(file, tail);
    }
  } catch {
    // no log yet
  }
  return fs.openSync(file, "a");
}

/**
 * Tell the hooks the user turned on what a commit saved — in the background: strom neither waits for them nor
 * fails because of them. A hook's own writes (it may run strom) tell no hook again.
 */
export function fireHooks(shared: string | undefined, names: string[] | undefined, env: Env, payload: Omit<HookPayload, "hook">): void {
  if (!shared || !names?.length || !payload.events.length || env.STROM_HOOK) return;
  for (const name of names) {
    try {
      const hook = loadHook(shared, name);
      const events = forHook(hook, payload.events);
      if (!events.length) continue;
      const full: HookPayload = { ...payload, hook: name, events };
      const file = eventFile(hook, full);
      let input: number | undefined;
      let log: number | undefined;
      try {
        input = fs.openSync(file, "r");
        log = logFd(hook);
        const { cmd, args } = program(hook);
        const child = spawn(cmd, args, { cwd: hook.dir, env: hookEnv(env, hook, full, file), stdio: [input, log, log], detached: true, windowsHide: true });
        child.on("error", () => undefined);
        child.unref();
      } finally {
        // the child has its own copies; ours are closed whatever happened
        for (const fd of [input, log]) if (fd !== undefined) fs.closeSync(fd);
      }
    } catch {
      // a hook that is gone or broken never stops the research: strom hook test <name> says why
    }
  }
}

/** Run a hook now and wait for it (strom hook test): what it printed and how it ended. */
export function runHookNow(hook: Hook, env: Env, payload: HookPayload): { status: number | null; output: string; error?: string } {
  const file = eventFile(hook, payload);
  const { cmd, args } = program(hook);
  const r = spawnSync(cmd, args, {
    cwd: hook.dir,
    env: hookEnv(env, hook, payload, file),
    input: fs.readFileSync(file),
    encoding: "utf8",
    timeout: (hook.manifest.timeout ?? DEFAULT_TIMEOUT_S) * 1000,
    windowsHide: true,
  });
  const output = `${r.stdout ?? ""}${r.stderr ?? ""}`.trim();
  if (r.error) return { status: null, output, error: (r.error as NodeJS.ErrnoException).code === "ETIMEDOUT" ? `no end within ${hook.manifest.timeout ?? DEFAULT_TIMEOUT_S} s` : r.error.message };
  return { status: r.status, output };
}
