// Going between the beta and the releases never loses a research (Milan, 2026-10-07): before another channel or an
// older version, every research and the settings are backed up — by strom update before it installs, else by the
// first run of the other version; a backup that cannot be made switches nothing. A research a newer strom wrote is
// never opened by an older one: said why, and the way on.

import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { World, hasGit, readJsonFile } from "../helpers.ts";
import { VERSION } from "../../src/core/tree.ts";
import { backupFor, type BackupRecord } from "../../src/core/backup.ts";

const cfgOf = (w: World) => path.join(w.env.STROM_CONFIG_DIR!, "config.json");
const config = (w: World) => readJsonFile(cfgOf(w));
const setConfig = (w: World, values: Record<string, unknown>) => fs.writeFileSync(cfgOf(w), JSON.stringify({ ...config(w), ...values }));
const gitLog = (dir: string) => spawnSync("git", ["log", "--format=%H %s"], { cwd: dir, encoding: "utf8" }).stdout;

/** A research with people, a source, a file of the family and its history; a second one named in another script. */
async function research(w: World): Promise<{ tree: string; other: string }> {
  const tree = await w.withTree("Novákovi");
  await w.ok(["person", "add", "Jan /Novák/", "--born", "1905"]);
  await w.ok(["source", "add", "Křestní zápis", "--kind", "baptism"]);
  const letter = path.join(w.dir, "dopis.txt");
  fs.writeFileSync(letter, "Děda byl mlynář v čp. 12\n");
  await w.ok(["intake", letter]);
  // a link inside the research stays a link (never followed)
  fs.symlinkSync("../data", path.join(tree, "notes", "odkaz"));
  await w.ok(["init", "Иванов"]);
  const other = fs.readdirSync(w.home).find((n) => n !== "Novákovi" && fs.existsSync(path.join(w.home, n, "strom.json")))!;
  return { tree, other: path.join(w.home, other) };
}

/** Every file of a folder with its content's hash (links by their target). */
function snapshot(dir: string, skip: (rel: string) => boolean = () => false): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (p: string) => {
    const rel = path.relative(dir, p);
    if (rel && skip(rel)) return;
    const st = fs.lstatSync(p);
    if (st.isSymbolicLink()) out[rel] = `-> ${fs.readlinkSync(p)}`;
    else if (st.isDirectory()) for (const n of fs.readdirSync(p)) walk(path.join(p, n));
    else out[rel] = crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
  };
  walk(dir);
  return out;
}

test("an older version than the one that ran last: the first run backs every research up (whole, with its history) and the settings, says where, once", { skip: !hasGit || process.platform === "win32" }, async () => {
  const w = new World();
  const { tree, other } = await research(w);
  // the last strom here was a newer one (a beta): this one is older
  setConfig(w, { lastVersion: "99.0.0-beta.3", lastChannel: "beta" });
  w.env.STROM_CHANNEL = "beta";
  const before = gitLog(tree);
  const r = await w.ok(["status"], { cwd: tree });
  const made = config(w).backups;
  assert.equal(made.length, 1);
  const dir: string = made[0].path;
  assert.equal(path.dirname(dir), path.join(w.home, "backups"));
  assert.match(path.basename(dir), new RegExp(`^\\d{4}-\\d\\d-\\d\\d-\\d{6} 99\\.0\\.0-beta\\.3 to ${VERSION.replace(/\./g, "\\.")}$`));
  assert.match(r.err, /Záloha před přechodem z 99\.0\.0-beta\.3 na /);
  assert.ok(r.err.includes(dir), "the path said");
  // the research whole: its history the same, its records, the family's file, the link as a link
  const copy = path.join(dir, "trees", "Novákovi");
  assert.equal(gitLog(copy), before);
  assert.deepEqual(snapshot(copy), snapshot(tree, (rel) => rel === path.join(".strom", "tree.lock")));
  assert.equal(fs.readlinkSync(path.join(copy, "notes", "odkaz")), "../data");
  assert.ok(fs.readdirSync(path.join(copy, "inputs")).some((n) => n !== ".gitkeep"), "the family's file");
  // the other research by its own folder name, byte for byte (never normalized)
  assert.ok(fs.readdirSync(path.join(dir, "trees")).includes(path.basename(other)));
  assert.equal(gitLog(path.join(dir, "trees", path.basename(other))), gitLog(other));
  // the settings with the seal keys; what is inside said in the person's language
  assert.equal(readJsonFile(path.join(dir, "settings", "config.json")).home, w.home);
  assert.deepEqual(fs.readdirSync(path.join(dir, "settings")).sort(), fs.readdirSync(w.env.STROM_CONFIG_DIR!).filter((n) => !n.endsWith(".lock")).sort());
  assert.match(fs.readFileSync(path.join(dir, "README.txt"), "utf8"), /Není uvnitř: sdílené obrázky/);
  assert.equal(config(w).lastVersion, VERSION);
  // the next run: no other backup
  const again = await w.ok(["status"], { cwd: tree });
  assert.doesNotMatch(again.err, /Záloha/);
  assert.equal(config(w).backups.length, 1);
  // strom doctor says where the last one is (a month)
  assert.ok((await w.run(["doctor"])).out.includes(dir));
  w.cleanup();
});

test("another channel than last time (a beta, now the releases): the same backup, for an agent as JSON on stderr", { skip: !hasGit }, async () => {
  const w = new World();
  await w.withTree();
  await w.ok(["person", "add", "Jan /Novák/"]);
  setConfig(w, { lastVersion: VERSION, lastChannel: "beta" });
  w.env.STROM_CHANNEL = "stable";
  const r = await w.ok(["person", "list", "--json"]);
  assert.ok(Array.isArray(r.json) || typeof r.json === "object", "stdout stays the command's JSON");
  const said = JSON.parse(r.err.trim().split("\n").find((l) => l.startsWith("{\"backup\""))!);
  assert.equal(said.backup.path, config(w).backups[0].path);
  assert.match(path.basename(said.backup.path), new RegExp(`${VERSION.replace(/\./g, "\\.")} beta to ${VERSION.replace(/\./g, "\\.")} stable$`));
  assert.deepEqual([config(w).backups[0].fromChannel, config(w).backups[0].toChannel], ["beta", "stable"]);
  assert.equal(config(w).lastChannel, "stable");
  assert.ok(fs.existsSync(path.join(said.backup.path, "trees", "Novákovi", ".git")));
  assert.doesNotMatch((await w.ok(["person", "list"])).err, /Záloha/, "made once");
  w.cleanup();
});

test("a config of a strom from before the channels (a version, no channel) was the releases': the beta's first run backs up, says where; a newer release makes none", { skip: !hasGit }, async () => {
  const w = new World();
  const tree = await w.withTree();
  await w.ok(["person", "add", "Jan /Novák/"]);
  const { lastChannel: _c, ...old } = config(w);
  fs.writeFileSync(cfgOf(w), JSON.stringify({ ...old, lastVersion: "1.12.1" }));
  // the release after it: an upgrade on the same channel, nothing to back up
  w.env.STROM_CHANNEL = "stable";
  const stable = await w.ok(["status"], { cwd: tree });
  assert.doesNotMatch(stable.err, /Záloha/);
  assert.equal(config(w).backups, undefined);
  assert.equal(config(w).lastChannel, "stable");
  // the same config, the beta installed over it: backed up before anything
  fs.writeFileSync(cfgOf(w), JSON.stringify({ ...old, lastVersion: "1.12.1" }));
  w.env.STROM_CHANNEL = "beta";
  const r = await w.ok(["person", "add", "Marie /Nováková/"], { cwd: tree });
  const made = config(w).backups;
  assert.equal(made.length, 1);
  assert.deepEqual([made[0].from, made[0].to, made[0].fromChannel, made[0].toChannel], ["1.12.1", VERSION, "stable", "beta"]);
  assert.match(r.err, /Záloha před přechodem z 1\.12\.1/);
  assert.ok(r.err.includes(made[0].path), "the path said");
  // made before the write: the copy has no Marie
  assert.doesNotMatch(gitLog(path.join(made[0].path, "trees", "Novákovi")), /Nováková/);
  assert.equal(config(w).lastChannel, "beta");
  w.cleanup();
});

test("a backup that cannot be made switches nothing: no research opened for writing, none migrated; reading, doctor and help go on; made at the next run", { skip: !hasGit || process.platform === "win32" || process.getuid?.() === 0 }, async () => {
  const w = new World();
  const tree = await w.withTree();
  await w.ok(["person", "add", "Jan /Novák/"]);
  setConfig(w, { lastVersion: "99.0.0", lastChannel: "stable" });
  const before = snapshot(tree);
  // the home cannot take a backup folder
  fs.chmodSync(w.home, 0o555);
  try {
    const add = await w.run(["person", "add", "Marie /Nováková/"]);
    assert.equal(add.code, 6);
    assert.match(add.err, /Zálohu před přechodem z 99\.0\.0 na .* se nepodařilo vytvořit/);
    assert.match(add.err, /strom update --channel stable/);
    const json = await w.run(["person", "add", "Marie /Nováková/", "--json"]);
    assert.equal(json.code, 6);
    assert.equal(json.json.code, "backup.failed");
    assert.equal((await w.run(["chat"])).code, 6, "no work started");
    // reading goes on
    assert.match((await w.ok(["person", "list"])).out, /Jan Novák/);
    assert.equal((await w.run(["doctor"])).code === 6, false);
    assert.match((await w.run(["doctor"])).out, /se nepodařilo vytvořit/);
    await w.ok(["help"]);
    assert.deepEqual(snapshot(tree), before, "nothing of the research written");
    assert.equal(config(w).lastVersion, "99.0.0", "the change is still to come");
    assert.equal(config(w).backups, undefined);
    assert.deepEqual(fs.readdirSync(w.home).filter((n) => n === "backups"), []);
  } finally {
    fs.chmodSync(w.home, 0o755);
  }
  // room again: the next run makes it, and writes
  const ok = await w.ok(["person", "add", "Marie /Nováková/"]);
  assert.match(ok.err, /Záloha před přechodem z 99\.0\.0/);
  assert.equal(config(w).backups.length, 1);
  w.cleanup();
});

test("a research a newer strom wrote (a beta's schema) is never opened: who wrote it, kept untouched, back to the beta, the backup — strom, status, a write and the bridge leave it byte for byte", { skip: !hasGit || process.platform === "win32" }, async () => {
  const w = new World();
  const tree = await w.withTree();
  await w.ok(["person", "add", "Jan /Novák/"]);
  // the bridge the app follows, running before the beta's data came
  const info = (await w.ok(["live", "start", "--json"])).json;
  try {
    // a backup made before (the beta's first run), and the beta's data
    setConfig(w, { backups: [{ at: new Date().toISOString(), from: VERSION, to: "9.9.0-beta.1", fromChannel: "stable", toChannel: "beta", path: path.join(w.home, "backups", "x"), bytes: 1 }] });
    const file = path.join(tree, "strom.json");
    fs.writeFileSync(file, JSON.stringify({ ...readJsonFile(file), schema: 99, migratedWith: "9.9.0-beta.1" }, null, 2) + "\n");
    spawnSync("git", ["commit", "-qam", "Data brought to schema 99"], { cwd: tree });
    const skip = (rel: string) => rel.startsWith(path.join(".strom", "live"));
    const before = snapshot(tree, skip);
    for (const args of [[], ["status"], ["person", "add", "Marie /Nováková/"], ["person", "add", "Marie /Nováková/", "--json"]]) {
      const r = await w.run(args, { cwd: tree });
      assert.notEqual(r.code, 0, args.join(" "));
      if (args.includes("--json")) {
        assert.equal(r.json.code, "tree.newer.beta.backup");
        assert.match(r.json.message, /written by strom 9\.9\.0-beta\.1 .* this strom keeps it untouched/);
        assert.match(r.json.hint, /^go back to the beta: strom update --channel beta — or wait for the release of 9\.9\.0\nthe backup made before the switch: /);
      } else {
        assert.match(r.err, /Tento rodokmen zapsal strom 9\.9\.0-beta\.1, novější než tento strom .*nechává beze změny/, args.join(" "));
        assert.match(r.err, /→ Vrátit se k betě: strom update --channel beta – nebo počkat na vydání 9\.9\.0\n→ Záloha z doby před přechodem: .*backups/);
      }
      assert.deepEqual(snapshot(tree, skip), before, `${args.join(" ")}: nothing written`);
    }
    // the menu: said above it, the tree listed as locked, nothing opened
    const menu = await w.run(["menu"], { cwd: tree, tty: true, answers: ["1", "0", "0"] });
    assert.match(menu.out, /Tento rodokmen zapsal strom 9\.9\.0-beta\.1/);
    assert.match(menu.out, /Novákovi .* – zamčeno: zapsal strom 9\.9\.0-beta\.1/);
    assert.deepEqual(snapshot(tree, skip), before, "the menu: nothing written");
    // the bridge says it, and opens nothing
    const status = (await (await fetch(`${info.url}/status`)).json()) as { locked: { code: string; by: string; reason: string; way: string }; tree: { name: string } };
    assert.equal(status.locked.code, "tree.newer.beta.backup");
    assert.equal(status.locked.by, "9.9.0-beta.1");
    assert.match(status.locked.way, /strom update --channel beta/);
    assert.equal(status.tree.name, "Novákovi");
    assert.deepEqual(snapshot(tree, skip), before, "the bridge: nothing written");
    // a release that wrote it: strom update
    fs.writeFileSync(file, JSON.stringify({ ...readJsonFile(file), migratedWith: "9.9.0" }, null, 2) + "\n");
    const plain = await w.run(["status", "--json"], { cwd: tree });
    assert.equal(plain.json.code, "tree.newer.backup");
    assert.match(plain.json.hint, /^strom update\n/);
  } finally {
    w.cleanup();
  }
});

test("strom update --channel stable: the running strom backs every research up before it installs anything", { skip: !hasGit || process.platform === "win32" }, async () => {
  const w = new World();
  const tree = await w.withTree();
  await w.ok(["person", "add", "Jan /Novák/"]);
  // an installation of this strom, built from the sources, installed for the beta versions
  const root = path.join(w.dir, "inst");
  const app = path.join(root, "app");
  const repo = path.resolve(import.meta.dirname, "..", "..");
  const built = spawnSync(process.execPath, [path.join(repo, "node_modules", "typescript", "bin", "tsc"), "-p", path.join(repo, "tsconfig.build.json"), "--outDir", path.join(app, "dist")], { encoding: "utf8" });
  assert.equal(built.status, 0, built.stdout + built.stderr);
  fs.symlinkSync(path.join(repo, "assets"), path.join(app, "assets"));
  fs.writeFileSync(path.join(app, "package.json"), JSON.stringify({ name: "strom-research", version: VERSION, type: "module" }));
  fs.writeFileSync(path.join(root, "install.json"), JSON.stringify({ launchers: [], node: "26.9.0", version: VERSION, channel: "beta" }));
  // the release to go back to: an older one
  const release = path.join(w.dir, "release");
  const stage = path.join(w.dir, "stage", "app", "dist");
  fs.mkdirSync(stage, { recursive: true });
  fs.mkdirSync(release);
  fs.writeFileSync(path.join(stage, "cli.js"), "// 1.0.0\n");
  spawnSync("tar", ["-czf", path.join(release, "strom-app.tar.gz"), "app"], { cwd: path.join(w.dir, "stage") });
  const sha = crypto.createHash("sha256").update(fs.readFileSync(path.join(release, "strom-app.tar.gz"))).digest("hex");
  fs.writeFileSync(path.join(release, "SHASUMS256.txt"), `${sha}  strom-app.tar.gz\n`);
  fs.writeFileSync(path.join(release, "VERSION"), "1.0.0\n");
  fs.writeFileSync(path.join(release, "NODE_VERSION"), "26.9.0\n");
  setConfig(w, { lastVersion: VERSION, lastChannel: "beta" });
  const env = { ...w.env, STROM_DOWNLOAD_BASE: `file://${release}`, STROM_NODE_BASE: `file://${path.join(w.dir, "no-node")}`, STROM_UPDATES: "check" };
  const run = (args: string[], extra: Record<string, string> = {}) => spawnSync(process.execPath, [path.join(app, "dist", "cli.js"), ...args], { cwd: tree, env: { ...env, ...extra } as NodeJS.ProcessEnv, encoding: "utf8" });
  // no room for it: nothing installed
  fs.chmodSync(w.home, 0o555);
  try {
    const refused = run(["update", "--channel", "stable", "--yes", "--json"]);
    assert.equal(refused.status, 6, refused.stdout + refused.stderr);
    assert.equal(JSON.parse(refused.stdout).code, "backup.failed.update");
    assert.match(fs.readFileSync(path.join(app, "dist", "cli.js"), "utf8"), /main/, "the program as it was");
    assert.equal(readJsonFile(path.join(root, "install.json")).channel, "beta");
  } finally {
    fs.chmodSync(w.home, 0o755);
  }
  const r = run(["update", "--channel", "stable", "--yes", "--json"]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const out = JSON.parse(r.stdout);
  assert.equal(out.version, "1.0.0");
  const made = config(w).backups;
  assert.equal(made.length, 1);
  assert.deepEqual([made[0].from, made[0].to, made[0].fromChannel, made[0].toChannel], [VERSION, "1.0.0", "beta", "stable"]);
  assert.equal(out.backup.path, made[0].path);
  assert.equal(gitLog(path.join(made[0].path, "trees", "Novákovi")), gitLog(tree));
  // installed after it: the old program gone, the channel the releases'
  assert.equal(fs.readFileSync(path.join(app, "dist", "cli.js"), "utf8"), "// 1.0.0\n");
  assert.equal("channel" in readJsonFile(path.join(root, "install.json")), false);
  w.cleanup();
});

test("the backup's own pieces: what strom makes again stays out, a lock of the settings too", { skip: !hasGit || process.platform === "win32" }, async () => {
  const { makeBackup } = await import("../../src/core/backup.ts");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strom-backup-"));
  const home = path.join(dir, "home");
  const tree = path.join(home, "Kovářoví"); // a combining mark kept as it is
  for (const d of [".strom/views", ".strom/excerpts", ".strom/fetch/x", ".strom/runs", "data"]) fs.mkdirSync(path.join(tree, d), { recursive: true });
  fs.writeFileSync(path.join(tree, ".strom", "views", "a.jpg"), "x");
  fs.writeFileSync(path.join(tree, ".strom", "views", "views.jsonl"), "{}\n");
  fs.writeFileSync(path.join(tree, ".strom", "excerpts", "b.png"), "x");
  fs.writeFileSync(path.join(tree, ".strom", "fetch", "x", "c"), "x");
  fs.writeFileSync(path.join(tree, ".strom", "runs", "N0001.log"), "log");
  fs.writeFileSync(path.join(tree, ".strom", "tree.lock"), "{}");
  fs.writeFileSync(path.join(tree, "data", "person.jsonl"), "{}\n");
  const cfg = path.join(dir, "cfg");
  fs.mkdirSync(cfg);
  fs.writeFileSync(path.join(cfg, "config.json"), "{}");
  fs.writeFileSync(path.join(cfg, "config.json.lock"), "{}");
  const b = makeBackup({ home, env: { HOME: dir, STROM_CONFIG_DIR: cfg }, trees: [tree], transition: { from: "2.0.0", to: "1.0.0" }, readme: "README" });
  const copy = path.join(b.path, "trees", path.basename(tree));
  assert.ok(fs.existsSync(copy), "the name as it is");
  assert.deepEqual(Object.keys(snapshot(copy)).sort(), [".strom/runs/N0001.log", ".strom/views/views.jsonl", "data/person.jsonl"].map((p) => p.split("/").join(path.sep)));
  assert.deepEqual(fs.readdirSync(path.join(b.path, "settings")), ["config.json"]);
  assert.equal(b.bytes, "log".length + "{}\n".length * 2 + "{}".length);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("the research in the settings folder (an isolated installation's default) is backed up once, as a tree — never again as part of the settings, its backups never into themselves, the shared images and another folder of trees left out too", { skip: process.platform === "win32" }, async () => {
  const { makeBackup } = await import("../../src/core/backup.ts");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strom-backup-"));
  const cfg = path.join(dir, "cfg");
  const home = path.join(cfg, "Strom research");
  const tree = path.join(home, "Дворжáкови".normalize("NFD"));
  const trees = path.join(cfg, "jinde", "stromy");
  const other = path.join(trees, "Novákovi");
  const shared = path.join(cfg, "sdílené");
  for (const d of [path.join(tree, "data"), path.join(other, "data"), path.join(home, "backups", "older"), path.join(home, "shared"), shared]) fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(tree, "data", "person.jsonl"), "{}\n");
  fs.writeFileSync(path.join(other, "data", "person.jsonl"), "{}\n");
  fs.writeFileSync(path.join(home, "backups", "older", "x"), "old");
  fs.writeFileSync(path.join(home, "shared", "scan.jpg"), "img");
  fs.writeFileSync(path.join(shared, "scan2.jpg"), "img");
  fs.writeFileSync(path.join(cfg, "config.json"), "{}");
  fs.mkdirSync(path.join(cfg, "keys"));
  fs.writeFileSync(path.join(cfg, "keys", "seal.key"), "k");
  const b = makeBackup({ home, env: { HOME: dir, STROM_CONFIG_DIR: cfg }, trees: [tree, other], research: [trees, shared], transition: { from: "2.0.0", to: "1.0.0" }, readme: "README" });
  assert.ok(b.path.startsWith(path.join(home, "backups")));
  assert.deepEqual(Object.keys(snapshot(path.join(b.path, "settings"))).sort(), ["config.json", path.join("keys", "seal.key")]);
  assert.ok(fs.existsSync(path.join(b.path, "trees", path.basename(tree), "data", "person.jsonl")));
  assert.ok(fs.existsSync(path.join(b.path, "trees", "Novákovi", "data", "person.jsonl")));
  assert.equal(b.bytes, "{}\n".length * 2 + "{}".length + "k".length);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("the same change backed up again when its last backup is older than a day — a trip back to a strom from before the channels leaves the beta's version as the last one, and the next trip must not find the month-old backup", () => {
  const t = { from: "1.13.0-beta.1", to: "1.12.1", fromChannel: "beta" as const, toChannel: "stable" as const };
  const now = Date.parse("2026-11-07T12:00:00Z");
  const b = (at: string): BackupRecord => ({ at, ...t, path: "/b", bytes: 1 });
  assert.ok(backupFor([b("2026-11-07T11:00:00Z")], t, now), "made by strom update an hour ago: its first run makes none");
  assert.equal(backupFor([b("2026-10-07T12:00:00Z")], t, now), undefined, "a month ago: another trip, its own backup");
  assert.equal(backupFor([b("2026-11-07T11:00:00Z"), { ...b("2026-11-07T11:30:00Z"), to: "1.13.0-beta.1", from: "1.12.1" }], t, now), undefined, "only the newest counts");
});
