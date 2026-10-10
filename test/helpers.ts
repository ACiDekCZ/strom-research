// Test helpers: every test builds its own throw-away world (home, config,
// trees) in a temp folder whose path contains a space and diacritics.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { main } from "../src/cli/main.ts";

// Isolate git from the developer's global configuration.
const gitGlobal = path.join(os.tmpdir(), `strom-test-gitconfig-${process.pid}`);
fs.writeFileSync(gitGlobal, "");
process.env.GIT_CONFIG_GLOBAL = gitGlobal;
process.env.GIT_CONFIG_NOSYSTEM = "1";
// The test process itself from the person's home and settings: anything a test starts without a world's
// environment (a process spawned with the inherited one, code reading process.env) never reaches the real
// ~/.config/strom (found 2026-10-04: a first run of a new version claimed in the developer's own config).
const isolatedHome = fs.mkdtempSync(path.join(os.tmpdir(), "strom-test-home-"));
process.env.HOME = isolatedHome;
process.env.USERPROFILE = isolatedHome;
process.env.STROM_CONFIG_DIR = path.join(isolatedHome, "config");

export const hasGit = spawnSync("git", ["--version"]).status === 0;

export interface RunResult {
  code: number;
  out: string;
  err: string;
  json: any;
}

export class World {
  readonly dir: string;
  readonly env: Record<string, string>;
  cwd: string;

  constructor() {
    this.dir = fs.mkdtempSync(path.join(os.tmpdir(), "strom test ěš "));
    const home = path.join(this.dir, "user home");
    fs.mkdirSync(home, { recursive: true });
    this.env = {
      HOME: home,
      USERPROFILE: home,
      STROM_CONFIG_DIR: path.join(this.dir, "config"),
      LANG: "cs_CZ.UTF-8",
      PATH: process.env.PATH ?? "",
      // what Node compiled stays compiled for the strom processes a test starts (test/setup.ts)
      ...(process.env.NODE_COMPILE_CACHE ? { NODE_COMPILE_CACHE: process.env.NODE_COMPILE_CACHE } : {}),
      // No windows, no browser, no installers from a test.
      STROM_NO_DIALOG: "1",
      STROM_NO_OPEN: "1",
      STROM_NO_INSTALL: "1",
      // No look for new versions over the network (a test gives a release folder of its own).
      STROM_UPDATES: "off",
      // No desktop apps of this computer: a test puts the ones it wants into a folder of its own.
      STROM_APP_DIRS: "",
      // Nothing into the computer's trash.
      STROM_TRASH: path.join(this.dir, "trash"),
    };
    this.cwd = this.dir;
  }

  get home(): string {
    return path.join(this.env.HOME!, "Documents", "Strom");
  }

  treeDir(name: string): string {
    return path.join(this.home, name);
  }

  async run(args: string[], opts: { answers?: string[]; cwd?: string; tty?: boolean; stdin?: string; dialog?: boolean; env?: Record<string, string> } = {}): Promise<RunResult> {
    let out = "";
    let err = "";
    const io = {
      stdout: (s: string) => void (out += s),
      stderr: (s: string) => void (err += s),
      tty: opts.tty ?? false,
      ...(opts.answers ? { answers: [...opts.answers] } : {}),
      ...(opts.stdin !== undefined ? { stdinText: () => opts.stdin! } : {}),
      // The window of a consent, answered by the person at the screen.
      ...(opts.dialog !== undefined ? { dialog: () => opts.dialog } : {}),
    };
    const code = await main(args, io, opts.env ? { ...this.env, ...opts.env } : this.env, opts.cwd ?? this.cwd);
    let json: any;
    if (args.includes("--json")) {
      try {
        json = JSON.parse(out);
      } catch {
        json = undefined;
      }
    }
    return { code, out, err, json };
  }

  /** Run and fail loudly on a non-zero exit. */
  async ok(args: string[], opts: { answers?: string[]; cwd?: string; tty?: boolean; stdin?: string; dialog?: boolean; env?: Record<string, string> } = {}): Promise<RunResult> {
    const r = await this.run(args, opts);
    if (r.code !== 0) throw new Error(`strom ${args.join(" ")} → exit ${r.code}\n${r.out}\n${r.err}`);
    return r;
  }

  /** Home set up and one tree created; cwd inside the tree. */
  async withTree(name = "Novákovi"): Promise<string> {
    await this.ok(["setup", "--yes"]);
    await this.ok(["init", name]);
    this.cwd = this.treeDir(name);
    return this.cwd;
  }

  cleanup(): void {
    // a bridge a test left running (one that failed before strom live stop): ended with its folder
    const trees = path.join(this.env.HOME!, "Documents", "Strom");
    for (const t of fs.existsSync(trees) ? fs.readdirSync(trees) : []) {
      try {
        process.kill((JSON.parse(fs.readFileSync(path.join(trees, t, ".strom", "live.json"), "utf8")) as { pid: number }).pid, "SIGTERM");
      } catch {
        // none running
      }
    }
    // a bridge just stopped may still write its last line into the tree: tried again (ENOTEMPTY)
    fs.rmSync(this.dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}

export function readJsonFile(file: string): any {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

/**
 * A connector for tests, in the plugins folder (<shared>/plugins/connectors/<name>), with the real SDK.
 * With `base` it talks to a local server (/catalog, /book/<id>, /img/<book>/<n>.jpg);
 * without it, it answers from memory and never asks for a URL.
 */
export async function fakeConnector(w: World, name: string, base = "", policy: Record<string, unknown> = { automation: "allowed" }): Promise<string> {
  const host = base ? new URL(base).hostname : "archive.example.org";
  await w.ok(["connector", "new", name, "--url", base || `https://${host}`, "--title", "Testovací archiv"]);
  const dir = pluginDir(w, name);
  const manifest = readJsonFile(path.join(dir, "connector.json"));
  fs.writeFileSync(path.join(dir, "connector.json"), JSON.stringify({ ...manifest, hosts: [host], policy }, null, 2));
  fs.writeFileSync(
    path.join(dir, "connector.ts"),
    `import { book, done, fail, get, image, located, log, request, Refused } from "./sdk.ts";
const BASE = ${JSON.stringify(base)};
const req = await request();
if (req.cmd === "find") {
  if (!BASE) book({ id: "5359", title: req.place + " N 1784-1820", years: "1784-1820", kinds: ["baptism"], places: [req.place], images: 3 });
  else for (const b of JSON.parse((await get(BASE + "/catalog?place=" + encodeURIComponent(req.place))).text!)) book(b);
} else if (req.cmd === "list") {
  if (!BASE) book({ id: req.book, title: "Kniha " + req.book, images: 3 });
  else book(JSON.parse((await get(BASE + "/book/" + req.book)).text!));
} else if (req.cmd === "locate") {
  if (BASE) await get(BASE + "/book/" + req.book); // the book's page: where its images are
  for (const n of req.images) located(n, (BASE || "https://archive.example.org") + "/img/" + req.book + "/" + n + ".jpg", (BASE || "https://archive.example.org") + "/book/" + req.book + "?image=" + n);
} else if (BASE) {
  for (const n of req.images) {
    const name = "s" + String(n).padStart(4, "0") + ".jpg";
    try {
      const got = await get(BASE + "/img/" + req.book + "/" + n + ".jpg", { save: name });
      if (got.status !== 200) fail("image " + n + ": HTTP " + got.status);
      image(n, name, got.url!);
    } catch (e) {
      if (!(e instanceof Refused)) throw e;
      log("stopped: " + e.message);
      break;
    }
  }
} else log("offline: no images");
done();
`,
  );
  return dir;
}

/** Where a connector of this name lives: the plugins folder of the shared library. */
export function pluginDir(w: World, name: string): string {
  return path.join(w.home, "shared", "plugins", "connectors", name);
}

/**
 * The agents' own files in the person's home (relative to HOME): what strom agents install teaches a regular
 * installation, and what an agent records of a folder it works in (Claude Code's projects, Codex's and Grok's trust of
 * a folder). An isolated installation never writes any of them; a folder is a directory taken whole.
 */
export const AGENT_GLOBAL_FILES = [
  path.join(".claude", "settings.json"),
  path.join(".claude", "skills"),
  ".claude.json",
  path.join(".codex", "AGENTS.md"),
  path.join(".codex", "config.toml"),
  path.join(".gemini", "GEMINI.md"),
  path.join(".gemini", "antigravity-cli", "settings.json"),
  path.join(".grok", "config.toml"),
  path.join(".grok", "skills"),
  path.join(".grok", "trusted_folders.toml"),
  path.join(".config", "opencode"),
] as const;

/** The agents' files put in a home as a person's agents have them (their own settings, nothing of strom's). */
export function plantAgentGlobals(home: string): void {
  for (const f of AGENT_GLOBAL_FILES) {
    const file = path.join(home, f);
    const dir = !path.extname(f) || f.endsWith("skills");
    const own = dir ? path.join(file, f.endsWith("opencode") ? "opencode.json" : path.join("mine", "SKILL.md")) : file;
    fs.mkdirSync(path.dirname(own), { recursive: true });
    fs.writeFileSync(own, own.endsWith(".json") ? '{\n  "mine": true\n}\n' : own.endsWith(".toml") ? 'mine = "yes"\n' : "# mine\n");
  }
  // (a while back: a write now changes the time)
  const then = new Date(Date.now() - 3600_000);
  for (const [file] of agentGlobals(home)) fs.utimesSync(file, then, then);
}

/** Each of the agents' files in a home with its time and content (a folder's files each), to compare before and after. */
export function agentGlobals(home: string): Map<string, string> {
  const out = new Map<string, string>();
  const walk = (p: string) => {
    let st: fs.Stats;
    try {
      st = fs.statSync(p);
    } catch {
      return; // not there: one made later shows
    }
    if (st.isDirectory()) for (const e of fs.readdirSync(p).sort()) walk(path.join(p, e));
    else out.set(p, `${st.mtimeMs} ${fs.readFileSync(p, "utf8")}`);
  };
  for (const f of AGENT_GLOBAL_FILES) walk(path.join(home, f));
  return out;
}
