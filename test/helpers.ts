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
      // No windows, no browser, no installers from a test.
      STROM_NO_DIALOG: "1",
      STROM_NO_OPEN: "1",
      STROM_NO_INSTALL: "1",
      // No look for new versions over the network (a test gives a release folder of its own).
      STROM_UPDATES: "off",
      // No desktop apps of this computer: a test puts the ones it wants into a folder of its own.
      STROM_APP_DIRS: "",
    };
    this.cwd = this.dir;
  }

  get home(): string {
    return path.join(this.env.HOME!, "Documents", "Strom");
  }

  treeDir(name: string): string {
    return path.join(this.home, name);
  }

  async run(args: string[], opts: { answers?: string[]; cwd?: string; tty?: boolean; stdin?: string; dialog?: boolean } = {}): Promise<RunResult> {
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
    const code = await main(args, io, this.env, opts.cwd ?? this.cwd);
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
  async ok(args: string[], opts: { answers?: string[]; cwd?: string; tty?: boolean; stdin?: string; dialog?: boolean } = {}): Promise<RunResult> {
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
    fs.rmSync(this.dir, { recursive: true, force: true });
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
