// A research goes on with every newer strom: the trees that published releases
// wrote (test/fixtures/releases, made by make-tree.ts with each release's own
// code) are opened, checked, exported and written to by the strom of today —
// and data of an older schema are brought forward, step by step, logged.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { World, fakeConnector, hasGit, readJsonFile } from "../helpers.ts";
import { Tree, VERSION } from "../../src/core/tree.ts";
import { migrate } from "../../src/core/migrate.ts";
import { verifyFast } from "../../src/core/integrity.ts";
import { validateGedcom } from "../../src/gedcom/validate.ts";
import { SCHEMA_VERSION, type Person } from "../../src/core/model.ts";

const releases = path.join(import.meta.dirname, "..", "fixtures", "releases");
const hasTar = spawnSync("tar", ["--version"]).status === 0;

/** The world a release left: its user's home and config, where they are now. */
function unpack(archive: string): World {
  const w = new World();
  const r = spawnSync("tar", ["-xzf", archive, "-C", w.dir]);
  assert.equal(r.status, 0, String(r.stderr));
  const home = path.join(w.dir, "home");
  Object.assign(w.env, { HOME: home, USERPROFILE: home, STROM_CONFIG_DIR: path.join(w.dir, "config") });
  const file = path.join(w.dir, "config", "config.json");
  fs.writeFileSync(file, JSON.stringify({ ...readJsonFile(file), home: w.home }, null, 2));
  w.cwd = w.treeDir("Novákovi");
  return w;
}

for (const archive of fs.existsSync(releases) ? fs.readdirSync(releases).filter((f) => f.endsWith(".tar.gz")).sort() : []) {
  const version = archive.replace(/\.tar\.gz$/, "");
  test(`a research of strom ${version} goes on with this one`, { skip: !hasGit || !hasTar }, async () => {
    const w = unpack(path.join(releases, archive));
    // What it recorded reads as it was written.
    assert.match((await w.ok(["check"])).out, /^ok|\n0 error\(s\)/);
    const jan = (await w.ok(["person", "show", "P1", "--json"])).json;
    assert.match(JSON.stringify(jan), /25 JUN 1905/);
    assert.match((await w.ok(["source", "show", "S1"])).out, /Joannes filius Josephi Novák/);
    assert.match((await w.ok(["story", "show", "P1"])).out, /pokřtěn roku 1905/);
    assert.match((await w.ok(["task", "list", "--state", "all"])).out, /Oddavky Josefa a Marie/);
    assert.match((await w.ok(["session", "list"])).out, /rejstřík prohledán/);
    // The orientation, the brief, the files for the Strom app and any program.
    await w.ok([]);
    await w.ok(["export", "gedcom"]);
    for (const f of ["tree.ged", "tree-strom.ged"]) {
      const ged = fs.readFileSync(path.join(w.cwd, "output", f), "utf8");
      assert.deepEqual(validateGedcom(ged).filter((x) => x.level === "error"), [], f);
    }
    // It goes on: new records, a session on the task it left.
    await w.ok(["person", "add", "Anna /Nováková/", "--sex", "F"]);
    await w.ok(["event", "add", "P1", "OCCU", "--value", "mlynář", "--cite", "S1"]);
    await w.ok(["session", "start", "T1"]);
    await w.ok(["session", "close", "--continue", "--summary", "kniha prošla", "--next", "oddavky v jiné farnosti"]);
    assert.match((await w.ok(["check"])).out, /^ok|\n0 error\(s\)/);
    const tree = Tree.open(w.cwd, w.env);
    assert.equal(tree.config.schema, SCHEMA_VERSION);
    assert.equal(tree.list<Person>("person").length, 4);
    w.cleanup();
  });
}

test("a tree of an older schema is brought forward — step by step, logged, sealed; an older strom refuses a newer one", { skip: !hasGit }, async () => {
  const w = new World();
  await w.withTree();
  await w.ok(["person", "add", "Jan /Novák/", "--sex", "M"]);
  const root = w.cwd;
  const tree = Tree.open(root, w.env);
  const target = SCHEMA_VERSION + 1;
  // A step that rewrites a record, as a real one would (a renamed field, a value of a list that changed).
  const steps = [{ to: target, what: "names in upper case", run: (t: Tree) => t.withTreeLock(() => {
    const p = t.get<Person>("P0001")!;
    t.put({ ...p, names: p.names.map((n) => ({ ...n, surname: n.surname?.toUpperCase() })) }, { op: "person.edit", targets: [p.id], summary: "P0001 surname in upper case" });
  }) }];
  assert.throws(() => migrate(tree, [], target), /a migration is missing/);
  assert.deepEqual(migrate(tree, steps, target), [`schema ${target}: names in upper case`]);
  assert.equal(readJsonFile(path.join(root, "strom.json")).schema, target);
  assert.equal(verifyFast(tree).findings.filter((f) => f.level === "error").length, 0, "logged and sealed: nothing unexplained");
  const log = spawnSync("git", ["log", "-1", "--format=%s"], { cwd: root, encoding: "utf8" }).stdout;
  assert.match(log, new RegExp(`Data brought to schema ${target}: names in upper case`));
  assert.deepEqual(migrate(tree, steps, target), [], "once");
  // This strom is the older one for that tree now: it refuses, and says what to do.
  const r = await w.run(["person", "list"]);
  assert.equal(r.code, 1);
  assert.match(r.err, /tree was written by a newer Strom \(schema \d+\)\n→ update strom/);
  w.cleanup();
});

test("a connector built for a newer contract: what this strom does not know is left out, the rest runs; a newer version of the contract asks for an update", { skip: !hasGit }, async () => {
  const w = new World();
  await w.withTree();
  const dir = await fakeConnector(w, "novejsi");
  const file = path.join(dir, "connector.json");
  const m = readJsonFile(file);
  fs.writeFileSync(file, JSON.stringify({ ...m, can: [...m.can, "transcribe"], routes: ["direct", "courier"] }, null, 2));
  const show = await w.ok(["connector", "show", "novejsi"]);
  assert.match(show.out, /newer\s+can transcribe, route courier — from a newer contract, left out here \(strom update runs them\)/);
  assert.match((await w.ok(["fetch", "novejsi", "--find", "Týnec"])).out, /Týnec N 1784-1820/, "the rest runs");
  fs.writeFileSync(file, JSON.stringify({ ...m, interface: 2 }, null, 2));
  const newer = await w.run(["connector", "show", "novejsi"]);
  assert.notEqual(newer.code, 0);
  assert.match(newer.err, /written for version 2 of the contract — this strom runs 1\n→ a newer strom runs it: strom update/);
  w.cleanup();
});

test("the first run of a newer strom: what it taught the agents outside the trees gets this version's text", { skip: !hasGit }, async () => {
  const w = new World();
  await w.ok(["setup", "--yes"]);
  await w.ok(["agents", "install", "--all"]);
  const skill = path.join(w.env.HOME!, ".claude", "skills", "strom", "SKILL.md");
  const now = fs.readFileSync(skill, "utf8");
  // What an older strom wrote, and the version it ran as.
  fs.writeFileSync(skill, "---\nname: strom\ndescription: old\n---\nold text\n");
  const cfg = path.join(w.env.STROM_CONFIG_DIR!, "config.json");
  fs.writeFileSync(cfg, JSON.stringify({ ...readJsonFile(cfg), lastVersion: "0.9.0" }));
  await w.ok(["config", "where"]);
  assert.equal(fs.readFileSync(skill, "utf8"), now);
  assert.equal(readJsonFile(cfg).lastVersion, VERSION);
  // Not the same version again, not an older one: the text stays as the user may have it.
  fs.writeFileSync(skill, "mine\n");
  await w.ok(["config", "where"]);
  assert.equal(fs.readFileSync(skill, "utf8"), "mine\n");
  w.cleanup();
});
