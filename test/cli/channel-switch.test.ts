// Going from the releases to the beta and back never loses a research (Milan, 2026-10-07: "přechod beta ↔ produkce
// nikdy nepřijde o data"): two real releases built by scripts/build-release.ts (a "stable" 9.0.0 and a "beta"
// 9.1.0-beta.1), installed by the real installer into an isolated installation, switched by strom update --channel
// both ways — the research checked before and after, file by file. And the Strom app's two copies (production, beta)
// against the bridges of a stable and a beta strom: each says truthfully what it is.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { hasGit } from "../helpers.ts";
import { nodeArchive } from "../../src/core/update.ts";
import { BRIDGE_FEATURES } from "../../src/core/live.ts";
import { SCHEMA_VERSION } from "../../src/core/model.ts";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const STABLE = "9.0.0";
const BETA = "9.1.0-beta.1";
const opts = { skip: !hasGit || process.platform === "win32" };

let dir = "";
/** The two releases as files: GitHub's list of releases, its download folders, a Node mirror in nodejs.org's layout. */
let rel: { stable: string; beta: string; list: string; download: string; nodes: string };

const sha = (data: Buffer | string) => crypto.createHash("sha256").update(data).digest("hex");

before(() => {
  if (opts.skip) return;
  dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "strom-channel-")));
  const download = path.join(dir, "releases");
  for (const v of [STABLE, BETA]) {
    const out = path.join(download, `v${v}`);
    const r = spawnSync(process.execPath, [path.join(ROOT, "scripts", "build-release.ts"), "--version", v, "--out", out], { encoding: "utf8", cwd: ROOT });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    // the Node of this test (a mirror of it: no download), the exact version — strom update keeps it
    fs.writeFileSync(path.join(out, "NODE_VERSION"), `${process.versions.node}\n`);
  }
  // a "Node" that is this one: the installer checks its version, strom runs on it
  const name = nodeArchive(process.versions.node);
  const top = name.replace(/\.tar\.gz$/, "");
  const stage = path.join(dir, "node-stage");
  fs.mkdirSync(path.join(stage, top, "bin"), { recursive: true });
  fs.writeFileSync(path.join(stage, top, "bin", "node"), `#!/bin/sh\nexec "${process.execPath}" "$@"\n`, { mode: 0o755 });
  const nodes = path.join(dir, "nodes");
  fs.mkdirSync(path.join(nodes, `v${process.versions.node}`), { recursive: true });
  spawnSync("tar", ["-czf", path.join(nodes, `v${process.versions.node}`, name), top], { cwd: stage });
  fs.writeFileSync(path.join(nodes, `v${process.versions.node}`, "SHASUMS256.txt"), `${sha(fs.readFileSync(path.join(nodes, `v${process.versions.node}`, name)))}  ${name}\n`);
  // GitHub's list: the beta a prerelease, newer by semver; a draft never taken
  const list = path.join(dir, "releases.json");
  fs.writeFileSync(list, JSON.stringify([{ tag_name: "v9.2.0", draft: true }, { tag_name: `v${BETA}`, draft: false, prerelease: true }, { tag_name: `v${STABLE}`, draft: false, prerelease: false }]));
  rel = { stable: path.join(download, `v${STABLE}`), beta: path.join(download, `v${BETA}`), list, download, nodes };
});

after(() => {
  if (dir) fs.rmSync(dir, { recursive: true, force: true });
});

/** An isolated installation in a scratch folder: its HOME, settings, program — nothing of this computer's. */
class Install {
  readonly root: string;
  readonly home: string;
  readonly cfg: string;
  readonly env: Record<string, string>;
  constructor(name: string, extra: Record<string, string> = {}) {
    const base = path.join(dir, name);
    this.home = path.join(base, "home");
    this.root = path.join(base, "inst");
    this.cfg = path.join(base, "cfg");
    fs.mkdirSync(this.home, { recursive: true });
    this.env = {
      HOME: this.home,
      PATH: "/usr/bin:/bin:/usr/sbin:/sbin",
      LANG: "en_US.UTF-8",
      SHELL: "/bin/sh",
      STROM_ISOLATED: "1",
      STROM_INSTALL_DIR: this.root,
      STROM_CONFIG_DIR: this.cfg,
      STROM_NODE_BASE: `file://${rel.nodes}`,
      STROM_NO_DIALOG: "1",
      STROM_NO_OPEN: "1",
      STROM_UPDATES: "off",
      STROM_APP_DIRS: "",
      STROM_TRASH: path.join(base, "trash"),
      ...extra,
    };
  }
  /** The real installer from a release, the stable one (or the beta's, from GitHub's list, with STROM_CHANNEL=beta). */
  install(channel: "stable" | "beta"): void {
    const from: Record<string, string> = channel === "beta" ? { STROM_CHANNEL: "beta", STROM_RELEASES_API: rel.list, STROM_RELEASE_DOWNLOAD: `file://${rel.download}` } : { STROM_DOWNLOAD_BASE: `file://${rel.stable}` };
    const r = spawnSync("sh", [path.join(rel.stable, "install.sh")], { env: { ...this.env, ...from, STROM_INSTALL_ONLY: "1" }, encoding: "utf8" });
    assert.equal(r.status, 0, r.stdout + r.stderr);
  }
  run(args: string[], o: { cwd?: string; env?: Record<string, string> } = {}): { code: number; out: string; err: string; json?: any } {
    const r = spawnSync(path.join(this.root, "strom"), args, { env: { ...this.env, ...o.env }, cwd: o.cwd ?? this.home, encoding: "utf8", timeout: 120_000 });
    let json: any;
    if (args.includes("--json")) {
      try {
        json = JSON.parse(r.stdout);
      } catch {
        // not JSON
      }
    }
    return { code: r.status ?? -1, out: r.stdout, err: r.stderr, json };
  }
  ok(args: string[], o: { cwd?: string; env?: Record<string, string> } = {}) {
    const r = this.run(args, o);
    assert.equal(r.code, 0, `strom ${args.join(" ")} → ${r.code}\n${r.out}\n${r.err}`);
    return r;
  }
  /** strom update --channel: the beta from GitHub's list, the stable from its folder (as the releases' latest). */
  switchTo(channel: "stable" | "beta") {
    const from: Record<string, string> = channel === "beta" ? { STROM_RELEASES_API: rel.list, STROM_RELEASE_DOWNLOAD: `file://${rel.download}` } : { STROM_DOWNLOAD_BASE: `file://${rel.stable}` };
    return this.ok(["update", "--channel", channel, "--yes", "--json"], { env: from });
  }
  version(): string {
    return this.ok(["--version"]).out.trim().replace(/^.*?(\d+\.\d+\.\d+\S*).*$/s, "$1");
  }
  config(): any {
    return JSON.parse(fs.readFileSync(path.join(this.cfg, "config.json"), "utf8"));
  }
  info(): any {
    return JSON.parse(fs.readFileSync(path.join(this.root, "install.json"), "utf8"));
  }
}

/** Every file under a folder with its content's hash (a folder that is not there: nothing). */
function files(top: string, skip: (rel: string) => boolean = () => false): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (p: string) => {
    const rel = path.relative(top, p);
    if (rel && skip(rel)) return;
    if (!fs.existsSync(p)) return;
    const st = fs.lstatSync(p);
    if (st.isSymbolicLink()) out[rel] = `-> ${fs.readlinkSync(p)}`;
    else if (st.isDirectory()) for (const n of fs.readdirSync(p)) walk(path.join(p, n));
    else out[rel] = sha(fs.readFileSync(p));
  };
  walk(top);
  return out;
}

interface Snapshot {
  persons: unknown;
  sources: unknown;
  inputs: unknown;
  git: string[];
  data: Record<string, string>;
  shared: Record<string, string>;
  settings: Record<string, string>;
  config: Record<string, unknown>;
}

/** What a research is: as strom lists it, its history, every file of its data and of the family's, the shared store, the settings. */
function snapshot(inst: Install, tree: string): Snapshot {
  const cfg = inst.config();
  const shared = cfg.shared ?? path.join(cfg.home, "shared");
  const { lastVersion: _v, lastChannel: _c, backups: _b, updateCheck: _u, ...config } = cfg;
  return {
    persons: inst.ok(["person", "list", "--json"], { cwd: tree }).json,
    sources: inst.ok(["source", "list", "--json"], { cwd: tree }).json,
    inputs: inst.ok(["input", "list", "--json"], { cwd: tree }).json,
    git: spawnSync("git", ["log", "--format=%H"], { cwd: tree, encoding: "utf8" }).stdout.trim().split("\n"),
    data: { ...files(path.join(tree, "data"), () => false), ...Object.fromEntries(Object.entries(files(path.join(tree, "inputs"))).map(([k, v]) => [path.join("..", "inputs", k), v])) },
    shared: files(shared, (rel) => rel.split(path.sep).includes(".incoming")),
    settings: files(inst.cfg, (rel) => rel.endsWith(".lock") || rel === "config.json" || rel.split(path.sep)[0] === "Strom research"),
    config,
  };
}

/** Nothing of `a` missing in `b`: every file the same (the counters of IDs move on), every commit there. */
function nothingMissing(a: Snapshot, b: Snapshot): void {
  for (const [file, hash] of Object.entries(a.data)) {
    assert.ok(file in b.data, `${file} missing`);
    if (file !== "_counters.json") assert.equal(b.data[file], hash, `${file} changed`);
  }
  for (const [file, hash] of Object.entries(a.shared)) assert.equal(b.shared[file], hash, `shared ${file}`);
  for (const [file, hash] of Object.entries(a.settings)) assert.equal(b.settings[file], hash, `settings ${file}`);
  for (const head of a.git) assert.ok(b.git.includes(head), `commit ${head} missing`);
  const ids = (s: Snapshot) => (s.persons as { persons: { id: string; name: string }[] }).persons.map((p) => `${p.id} ${p.name}`);
  for (const p of ids(a)) assert.ok(ids(b).includes(p), `${p} missing`);
}

const treeHashes = (tree: string) => files(tree, (rel) => rel === ".strom" || rel.startsWith(`.strom${path.sep}`));

test("stable → beta → stable on an isolated installation: each switch backed up first, the research unchanged by it, the beta's person kept; a schema the beta raised: the stable refuses, changes nothing", opts, async () => {
  const inst = new Install("switch");
  inst.install("stable");
  assert.equal(inst.version(), STABLE);
  assert.equal(inst.info().channel, undefined);
  inst.ok(["setup", "--yes"]);
  // its research folder inside its own settings folder — never the program's, which strom uninstall takes away
  assert.equal(inst.config().home, path.join(inst.cfg, "Strom research"));
  inst.ok(["init", "Novákovi"]);
  const tree = path.join(inst.config().home, "Novákovi");
  const at = { cwd: tree };
  inst.ok(["person", "add", "Jiří /Dvořák/", "--sex", "M", "--born", "1890"], at);
  // Cyrillic, decomposed (NFD) as a keyboard of another system may send it
  inst.ok(["person", "add", "Анна /Иванова/".normalize("NFD"), "--sex", "F"], at);
  inst.ok(["family", "add", "--partner", "P0001", "--partner", "P0002", "--married", "1912"], at);
  inst.ok(["source", "add", "Oddací zápis 1912", "--kind", "marriage", "--locator", "fol. 3"], at);
  inst.ok(["cite", "F0001", "S0001", "--locator", "fol. 3, č. 7"], at);
  inst.ok(["note", "add", "P0001", "Mlynář v Kamenici (rodinná paměť)"], at);
  const photo = path.join(dir, "fotka.png");
  fs.writeFileSync(photo, Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"));
  inst.ok(["intake", photo, "--person", "P0001"], at);
  const a = snapshot(inst, tree);
  assert.deepEqual((a.persons as any).persons.map((p: any) => p.name), ["Jiří Dvořák", "Анна Иванова"]);
  assert.ok(Object.keys(a.data).some((f) => f.endsWith("I0001-fotka.png")), "the family's image");
  assert.ok(Object.keys(a.settings).length > 0, "the seal keys");

  // b) to the beta: backed up first, its path said; the research as it was
  const b1 = inst.switchTo("beta");
  assert.equal(b1.json.version, BETA);
  assert.equal(inst.version(), BETA);
  assert.equal(inst.info().channel, "beta");
  const first = inst.config().backups.at(-1);
  assert.equal(b1.json.backup.path, first.path);
  assert.ok(b1.err.includes(first.path) || b1.out.includes(first.path), "its path said");
  assert.deepEqual([first.from, first.to, first.toChannel], [STABLE, BETA, "beta"]);
  assert.deepEqual(files(path.join(first.path, "trees", "Novákovi", "data")), files(path.join(tree, "data")));
  // the research in the settings folder is copied once, as a tree — never again as part of the settings
  assert.ok(fs.existsSync(path.join(first.path, "settings")) && !fs.existsSync(path.join(first.path, "settings", "Strom research")), "the settings without the research in them");
  inst.ok(["check"], at);
  assert.equal(inst.config().lastVersion, BETA);
  assert.deepEqual(snapshot(inst, tree), a, "the beta changed nothing of the research");
  inst.ok(["person", "add", "Marie /Nováková/", "--sex", "F"], at);
  const b = snapshot(inst, tree);

  // c) back to the stable: a second backup, holding the beta's person; nothing missing
  const c1 = inst.switchTo("stable");
  assert.equal(c1.json.version, STABLE);
  assert.equal(inst.version(), STABLE);
  assert.equal(inst.info().channel, undefined, "install.json: no channel");
  const second = inst.config().backups.at(-1);
  assert.notEqual(second.path, first.path);
  assert.deepEqual([second.from, second.to, second.fromChannel, second.toChannel], [BETA, STABLE, "beta", "stable"]);
  assert.match(fs.readdirSync(path.join(second.path, "trees", "Novákovi", "data", "persons")).join(" "), /P0003/);
  inst.ok(["check"], at);
  assert.equal(inst.config().lastVersion, STABLE, "the first run of the lower version ran");
  assert.equal(inst.config().lastChannel, "stable");
  const c = snapshot(inst, tree);
  assert.deepEqual(c, b, "the stable sees the research as the beta left it");
  nothingMissing(a, c);
  assert.ok((c.persons as any).persons.some((p: any) => p.name === "Marie Nováková"));

  // there and back again: each trip its own backup (the research written on in between)
  inst.switchTo("beta");
  assert.equal(inst.config().backups.length, 3);
  inst.ok(["person", "add", "Karel /Novák/"], at);
  // the beta's bridge, followed by the app, says its channel
  const live = inst.ok(["live", "start", "--json"], at).json as { url: string };
  const said = async (origin: string) => (await fetch(`${live.url}/status`, { headers: { Origin: origin } })).json() as Promise<Record<string, any>>;
  try {
    assert.equal((await said("https://beta.stromapp.info")).channel, "beta");
    // d) the beta raised the schema (as a migration would)
    const file = path.join(tree, "strom.json");
    fs.writeFileSync(file, JSON.stringify({ ...JSON.parse(fs.readFileSync(file, "utf8")), schema: SCHEMA_VERSION + 1, migratedWith: BETA }, null, 2) + "\n");
    spawnSync("git", ["commit", "-qam", "Data brought to the next schema"], { cwd: tree });
    const before = treeHashes(tree);
    const d1 = inst.switchTo("stable");
    assert.equal(d1.json.bridges, 1, "the bridge started again with the stable");
    const fourth = inst.config().backups.at(-1);
    assert.equal(inst.config().backups.length, 4);
    assert.ok(fs.existsSync(path.join(fourth.path, "trees", "Novákovi", "data", "persons", "P0004.json")), "the beta's last person in the backup");
    for (const args of [[], ["status"], ["person", "add", "Eva /Nováková/"]]) {
      const r = inst.run(args, at);
      if (args.length) assert.notEqual(r.code, 0, args.join(" "));
      assert.match(r.out + r.err, new RegExp(`written by strom ${BETA.replace(/\./g, "\\.")}`), args.join(" ") || "strom");
      if (args.length) assert.ok((r.out + r.err).includes(fourth.path), `${args.join(" ")}: the backup said`);
      assert.match(r.out + r.err, /strom update --channel beta/);
    }
    // the bridge at the same address, now the stable's: locked, said why; no channel
    const s = await said("https://stromapp.info");
    assert.equal(s.strom, STABLE);
    assert.equal(s.channel, undefined);
    assert.equal(s.locked.code, "tree.newer.beta.backup");
    assert.equal(s.locked.by, BETA);
    assert.deepEqual(treeHashes(tree), before, "byte for byte: files and git");
    inst.ok(["live", "stop"], at);
    assert.deepEqual(treeHashes(tree), before, "after the bridge: the same");
  } finally {
    inst.run(["live", "stop"], at);
  }
});

test("strom uninstall of an isolated installation never takes its research or backups: only what the installer and strom update put into its folder goes — the folder stays with what else is in it (found 2026-10-07: the research and the backups in it went whole)", opts, () => {
  // the layout set up before: the research inside the program's folder, a backup made by a switch, a file of the person's
  const old = new Install("uninstall-old");
  old.install("stable");
  const home = path.join(old.root, "Strom research");
  // (set up so before: strom setup refuses that folder now — the settings naming it go on, doctor says to move it)
  old.ok(["setup", "--yes"]);
  fs.writeFileSync(path.join(old.cfg, "config.json"), JSON.stringify({ ...old.config(), home }, null, 2));
  fs.mkdirSync(path.join(home, "shared"), { recursive: true });
  const doc = old.run(["doctor", "--json"]).json.checks.find((c: { name: string }) => c.name === "home");
  assert.equal(doc.status, "warn");
  assert.match(doc.detail, /inside strom's program folder/);
  old.ok(["init", "Novákovi"]);
  const tree = path.join(home, "Novákovi");
  old.ok(["person", "add", "Jiří /Dvořák/", "--sex", "M"], { cwd: tree });
  old.switchTo("beta");
  const backup = old.config().backups.at(-1).path as string;
  assert.ok(backup.startsWith(home) && fs.existsSync(backup), "a backup in the home");
  const note = path.join(old.root, "poznámka.txt");
  fs.writeFileSync(note, "moje\n");
  const r = old.ok(["uninstall", "--yes"]);
  assert.ok(fs.existsSync(path.join(tree, "strom.json")) && fs.existsSync(path.join(tree, ".git")), "the research stays");
  assert.ok(fs.existsSync(path.join(backup, "trees", "Novákovi", "strom.json")), "the backup stays");
  assert.equal(fs.readFileSync(note, "utf8"), "moje\n", "the person's file stays");
  assert.deepEqual(fs.readdirSync(old.root).sort(), ["Strom research", "poznámka.txt"], "node, app, install.json and the launcher gone, nothing else");
  assert.ok(fs.existsSync(path.join(old.cfg, "config.json")), "the settings stay");
  assert.match(r.out, /The folder .* stays: it holds what strom did not put there \(.*Strom research.*poznámka\.txt|poznámka\.txt.*Strom research/);
  // the new default: the research in the settings folder; the program's folder holds strom's only and goes whole
  const now = new Install("uninstall-new");
  now.install("stable");
  now.ok(["setup", "--yes"]);
  assert.equal(now.config().home, path.join(now.cfg, "Strom research"));
  now.ok(["init", "Novákovi"]);
  // install.json naming a file of the research as a launcher (it is a file anyone can edit): it stays, said
  const treeFile = path.join(now.cfg, "Strom research", "Novákovi", "strom.json");
  fs.writeFileSync(path.join(now.root, "install.json"), JSON.stringify({ ...now.info(), launchers: [...now.info().launchers, treeFile] }, null, 2));
  const r2 = now.ok(["uninstall", "--yes", "--json"]);
  assert.ok(!fs.existsSync(now.root), "the program's folder gone");
  assert.ok(fs.existsSync(treeFile), "the tree's file listed as a launcher stays");
  assert.deepEqual(r2.json.skipped, [{ kind: "launcher", path: treeFile }]);
  assert.equal(r2.json.kept, undefined);
  assert.ok(fs.existsSync(path.join(now.cfg, "Strom research", "Novákovi", "strom.json")), "the research stays");
});

test("a research's folder never inside strom's program folder: strom setup --home and config set into the installation's folder (app/ or beside it) refused, nothing written, in the person's language; strom update with the research set inside app/ before refuses — nothing asked, backed up or installed, the research and its backup byte for byte (found 2026-10-07: they went with the update)", opts, () => {
  const inst = new Install("program-folder");
  inst.install("stable");
  inst.ok(["setup", "--yes"]);
  inst.ok(["config", "get", "home"]); // (the first run of the version noted)
  const cfgFile = path.join(inst.cfg, "config.json");
  const settings = fs.readFileSync(cfgFile, "utf8");
  for (const args of [
    ["setup", "--yes", "--home", path.join(inst.root, "app", "Strom")],
    ["setup", "--yes", "--home", path.join(inst.root, "Strom research")],
    ["setup", "--yes", "--shared", path.join(inst.root, "node", "shared")],
    ["config", "set", "home", path.join(inst.root, "app", "Výzkum")],
    ["config", "set", "trees", path.join(inst.root, "Stromy")],
  ]) {
    const r = inst.run(args);
    assert.equal(r.code, 2, `${args.join(" ")}\n${r.out}${r.err}`);
    assert.match(r.err, /inside strom's program folder/, args.join(" "));
    assert.equal(fs.readFileSync(cfgFile, "utf8"), settings, `${args.join(" ")}: the settings unchanged`);
    assert.ok(!fs.existsSync(args.at(-1)!), `${args.join(" ")}: nothing made`);
  }
  const cs = inst.run(["setup", "--yes", "--home", path.join(inst.root, "app", "Strom")], { env: { STROM_LANG: "cs" } });
  assert.match(cs.err, /leží ve složce programu strom/);
  assert.equal(inst.run(["config", "set", "home", path.join(inst.root, "app", "x"), "--json"]).json.code, "folder.in-program");
  // the research inside app/, set before (by hand here): strom update takes nothing of it
  const home = path.join(inst.root, "app", "Strom");
  fs.writeFileSync(cfgFile, JSON.stringify({ ...inst.config(), home }, null, 2));
  inst.ok(["init", "Novákovi"]);
  const tree = path.join(home, "Novákovi");
  inst.ok(["person", "add", "Jiří /Dvořák/", "--sex", "M"], { cwd: tree });
  fs.mkdirSync(path.join(home, "backups", "2026-10-01 před"), { recursive: true });
  fs.writeFileSync(path.join(home, "backups", "2026-10-01 před", "poznámka.txt"), "záloha\n");
  const before = files(home);
  const backups = inst.config().backups;
  for (const channel of ["beta", "stable"] as const) {
    const from: Record<string, string> = channel === "beta" ? { STROM_RELEASES_API: rel.list, STROM_RELEASE_DOWNLOAD: `file://${rel.download}` } : { STROM_DOWNLOAD_BASE: `file://${rel.beta}` };
    // stable: a "newer" version on the same channel (the beta's folder as the releases' latest)
    const r = inst.run(["update", ...(channel === "beta" ? ["--channel", "beta"] : []), "--yes", "--json"], { env: from });
    assert.equal(r.code, 1, r.out + r.err);
    assert.equal(r.json.code, "update.in-program", r.out);
    assert.equal(r.json.details.entry, path.join(inst.root, "app"));
    assert.deepEqual(files(home), before, `${channel}: the research and its backup byte for byte`);
    assert.equal(inst.version(), STABLE, "nothing installed");
    assert.deepEqual(inst.config().backups, backups, "no backup made into app/");
    assert.equal(inst.info().channel, undefined);
  }
  const human = inst.run(["update", "--channel", "beta", "--yes"], { env: { STROM_RELEASES_API: rel.list, STROM_RELEASE_DOWNLOAD: `file://${rel.download}`, STROM_LANG: "cs" } });
  assert.match(human.err, /Nic se nenainstalovalo/);
  assert.match(human.err, /strom setup/);
});

test("strom init --dir never puts a tree inside strom's program folder (node/, app/, app.old/, the folder itself): refused with folder.in-program, nothing made or written, in the person's language; a folder outside it goes on (found 2026-10-07: init --dir made a tree there, and every update after it stopped)", opts, () => {
  const inst = new Install("init-dir");
  inst.install("stable");
  inst.ok(["setup", "--yes"]);
  inst.ok(["config", "get", "home"]); // (the first run of the version noted)
  const cfgFile = path.join(inst.cfg, "config.json");
  const settings = fs.readFileSync(cfgFile, "utf8");
  const program = files(inst.root);
  for (const at of [path.join(inst.root, "node", "Třetí"), path.join(inst.root, "app", "Čtvrtí"), path.join(inst.root, "app.old", "Šestí"), path.join(inst.root, "Páté")]) {
    const r = inst.run(["init", "Dvořákovi", "--dir", at, "--json"]);
    assert.equal(r.code, 2, `${at}\n${r.out}${r.err}`);
    assert.equal(r.json.code, "folder.in-program", r.out);
    assert.equal(r.json.params.program, inst.root);
    assert.ok(!fs.existsSync(at), `${at}: nothing made`);
    assert.equal(fs.readFileSync(cfgFile, "utf8"), settings, `${at}: the settings unchanged (no extraTrees)`);
  }
  assert.deepEqual(files(inst.root), program, "nothing in the program's folder");
  const cs = inst.run(["init", "Dvořákovi", "--dir", path.join(inst.root, "node", "Třetí")], { env: { STROM_LANG: "cs" } });
  assert.equal(cs.code, 2);
  assert.match(cs.err, /leží ve složce programu strom/);
  assert.match(cs.err, /Dvořákovi/, "a folder outside it suggested: among the trees");
  const outside = path.join(inst.home, "Rodokmeny", "Dvořákovi");
  inst.ok(["init", "Dvořákovi", "--dir", outside]);
  assert.ok(fs.existsSync(path.join(outside, "strom.json")));
});

test("the folder strom suggests for the research never inside its program folder: settings lying in node/ — strom setup --yes and init --yes without --home refuse the default there (folder.in-program, the way on: --home with a folder beside the installation), nothing written; the question's default is that folder beside it; --home outside goes on (found on a Mac: setup --yes took <settings>/Strom research inside node/)", opts, () => {
  const cfg = path.join(dir, "default-home", "inst", "node", "cfg");
  const inst = new Install("default-home", { STROM_CONFIG_DIR: cfg });
  inst.install("stable");
  const beside = path.join(dir, "default-home", "Strom research");
  const program = files(inst.root, (r) => r.startsWith(path.join("node", "cfg")));
  for (const args of [["setup", "--yes", "--json"], ["init", "Novákovi", "--yes", "--json"]]) {
    const r = inst.run(args);
    assert.equal(r.code, 2, `${args.join(" ")}\n${r.out}${r.err}`);
    assert.equal(r.json.code, "folder.in-program", r.out);
    assert.equal(r.json.params.folder, path.join(cfg, "Strom research"));
    assert.equal(r.json.params.suggested, beside);
    assert.match(r.json.hint, /--home/);
    assert.equal(inst.run(["config", "get", "home", "--json"]).json?.value ?? undefined, undefined, `${args.join(" ")}: no home set`);
    assert.ok(!fs.existsSync(path.join(cfg, "Strom research")), `${args.join(" ")}: nothing made`);
  }
  assert.deepEqual(files(inst.root, (r) => r.startsWith(path.join("node", "cfg"))), program, "nothing in the program's folder");
  const cs = inst.run(["setup", "--yes"], { env: { STROM_LANG: "cs" } });
  assert.match(cs.err, /leží ve složce programu strom/);
  assert.match(cs.err, /Zadat složku mimo ni: strom setup --home/);
  // asked (no --yes, no terminal): the default offered is the folder beside the installation
  const asked = inst.run(["setup", "--json"]);
  assert.equal(asked.code, 3, asked.out);
  assert.equal(JSON.stringify(asked.json).includes(path.join(cfg, "Strom research")), false, asked.out);
  assert.ok(JSON.stringify(asked.json).includes(beside), asked.out);
  inst.ok(["setup", "--yes", "--home", beside]);
  assert.equal(JSON.parse(fs.readFileSync(path.join(cfg, "config.json"), "utf8")).home, beside);
});

test("strom doctor says of the folder that lies in strom's program folder, on its own line with its own path: the trees' folder or the shared folder there, the home outside — the home's line stays as it is (found on a Mac: the home's path said to lie there)", opts, () => {
  const inst = new Install("doctor-program");
  inst.install("stable");
  inst.ok(["setup", "--yes"]);
  const trees = path.join(inst.root, "node", "Stromy");
  const shared = path.join(inst.root, "app.old", "sdílené");
  // set so before (strom setup refuses them now; settings naming them go on)
  fs.writeFileSync(path.join(inst.cfg, "config.json"), JSON.stringify({ ...inst.config(), trees, shared }, null, 2));
  const check = (name: string) => inst.run(["doctor", "--json"]).json.checks.find((c: { name: string }) => c.name === name);
  assert.notEqual(check("home").status, "warn", JSON.stringify(check("home")));
  assert.doesNotMatch(check("home").detail, /program folder/);
  for (const [name, folder] of [["trees", trees], ["shared", shared]] as const) {
    const c = check(name);
    assert.equal(c.status, "warn", JSON.stringify(c));
    assert.ok(c.detail.startsWith(`${folder} · `), c.detail);
    assert.match(c.detail, /inside strom's program folder/);
  }
  // the home there: said on its line; the trees inside it not said again
  fs.writeFileSync(path.join(inst.cfg, "config.json"), JSON.stringify({ ...inst.config(), home: path.join(inst.root, "Strom research"), trees: undefined, shared: undefined }, null, 2));
  assert.equal(check("home").status, "warn");
  assert.ok(check("home").detail.startsWith(`${path.join(inst.root, "Strom research")} · `));
  assert.equal(check("shared").status, "warn", "its shared folder in it too");
  assert.notEqual(check("trees").status, "warn", "the trees' folder is the home: said once");
});

test("the Strom app's two copies against a stable and a beta strom (the beta a second installation with its own command): CORS lets each in, /status says features and — the beta only — its channel, tree.ged served; two bridges at once on two ports", opts, async () => {
  const stable = new Install("app-stable");
  stable.install("stable");
  const beta = new Install("app-beta", { STROM_COMMAND: "strom-beta" });
  beta.install("beta");
  assert.equal(beta.info().channel, "beta");
  assert.equal(beta.version(), BETA);
  assert.equal(stable.version(), STABLE);
  const bridges: { inst: Install; tree: string; url: string; port: number }[] = [];
  try {
    for (const inst of [stable, beta]) {
      inst.ok(["setup", "--yes"]);
      inst.ok(["init", "Иванов"]);
      const tree = path.join(inst.config().home, "Иванов");
      inst.ok(["person", "add", "Pavel /Šťastný/"], { cwd: tree });
      const info = inst.ok(["live", "start", "--json"], { cwd: tree }).json as { url: string; port: number };
      bridges.push({ inst, tree, url: info.url, port: info.port });
    }
    assert.notEqual(bridges[0]!.port, bridges[1]!.port, "two ports");
    assert.notEqual(bridges[0]!.tree, bridges[1]!.tree, "two research folders");
    const apps = [
      { origin: "https://stromapp.info", version: "3.9.0" },
      { origin: "https://beta.stromapp.info", version: "3.10.0-beta.3" },
    ];
    for (const { inst, url } of bridges) {
      const isBeta = inst === beta;
      for (const app of apps) {
        const headers = { Origin: app.origin, "X-Strom-App-Version": app.version };
        const pre = await fetch(`${url}/status`, { method: "OPTIONS", headers: { Origin: app.origin, "Access-Control-Request-Method": "GET", "Access-Control-Request-Headers": "x-strom-app-version" } });
        assert.equal(pre.status, 204);
        const res = await fetch(`${url}/status`, { headers });
        assert.equal(res.headers.get("access-control-allow-origin"), app.origin, `${app.origin} let in`);
        const s = (await res.json()) as Record<string, any>;
        assert.equal(s.strom, isBeta ? BETA : STABLE);
        // only what this strom does, never more: the features of its code
        assert.deepEqual(s.features, [...BRIDGE_FEATURES]);
        if (isBeta) assert.equal(s.channel, "beta");
        else assert.ok(!("channel" in s), "the releases: no channel said");
        assert.equal(s.linkScheme, isBeta ? "strom-research-beta" : undefined, "the second installation's own links");
        assert.equal(s.tree.name, "Иванов");
        const ged = await fetch(`${url}/tree.ged`, { headers });
        assert.equal(ged.status, 200);
        assert.equal(ged.headers.get("access-control-allow-origin"), app.origin);
        const text = await ged.text();
        assert.match(text, /^(﻿)?0 HEAD/);
        assert.match(text, /1 NAME Pavel \/Šťastný\//);
      }
      // a page of another site: not let in
      const other = await fetch(`${url}/status`, { headers: { Origin: "https://example.org" } });
      assert.equal(other.headers.get("access-control-allow-origin"), null);
    }
  } finally {
    for (const b of bridges) b.inst.run(["live", "stop"], { cwd: b.tree });
  }
});
