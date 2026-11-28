// strom export gedcom --living (spec 151 K2.1): a file going out with the living protected — each mode, written as
// output/tree-<mode>.ged out of the history or with --out outside the research folder, never into it; without the
// option output/tree.ged as it always was (and untouched by a protected export); the setting gedcom.living for a file
// going out and beside the full ones; the header's mark, and strom sync refusing such a file as a source of changes,
// strom intake keeping it as material only; the sentence of a full file (K3.1) at the export and at strom pack.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { World, hasGit } from "../helpers.ts";

const opts = { skip: !hasGit };

async function family(): Promise<World> {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["person", "add", "Čeněk /Lhoták/", "--sex", "M", "--born", "1890", "--died", "1960"]); // P0001
  await w.ok(["person", "add", "Ľubomír /Lhoták/", "--sex", "M", "--born", "14 FEB 1950", "--born-place", "Lhota"]); // P0002
  await w.ok(["person", "add", "Věra /Lhotová/", "--sex", "F", "--born", "1952"]); // P0003
  await w.ok(["person", "add", "Hedvika /Lhotová/", "--sex", "F", "--born", "1978"]); // P0004
  await w.ok(["person", "add", "Tereza /Lhotová/", "--sex", "F", "--born", "1950", "--died", "2001"]); // P0005
  await w.ok(["family", "add", "--partner", "P0001", "--child", "P0002"]);
  await w.ok(["family", "add", "--partner", "P0002", "--partner", "P0003", "--child", "P0004"]);
  await w.ok(["event", "add", "F0002", "MARR", "--date", "12 JUL 1975", "--place", "Lhota"]);
  return w;
}

const git = (cwd: string, ...args: string[]) => execFileSync("git", args, { cwd, encoding: "utf8" });

test("strom export gedcom --living: each mode out of the history; output/tree.ged as it was", opts, async () => {
  const w = await family();
  // a death withdrawn is no death (it is never in the file): Tereza is living
  const death = (await w.ok(["person", "show", "P0005", "--json"])).json.person.events.find((e: { kind: string }) => e.kind === "DEAT").id as string;
  await w.ok(["event", "retract", death, "--reason", "zapsána omylem"]);

  const full = await w.ok(["export", "gedcom"]);
  // the person's language (the research's: Czech here)
  assert.match(full.out, /Obsahuje všechny údaje žijících osob – pro vlastní zálohu nebo přenos, ne ke sdílení\./u);
  assert.match(full.out, /strom export gedcom --living/);
  const out = path.join(w.cwd, "output");
  const tree = fs.readFileSync(path.join(out, "tree.ged"), "utf8");
  const strom = fs.readFileSync(path.join(out, "tree-strom.ged"), "utf8");
  assert.doesNotMatch(tree + strom, /_STROM_PRIVACY/u);
  assert.match(tree, /1 NAME Hedvika \/Lhotová\//u);
  const head = git(w.cwd, "rev-parse", "HEAD");

  for (const mode of ["initials", "surname", "hidden"]) {
    const r = await w.ok(["export", "gedcom", "--living", mode, "--json"]);
    const files = (r.json as { files: { file: string; living: { mode: string; count: number } }[] }).files;
    assert.deepEqual(files.map((f) => path.relative(w.cwd, f.file)).sort(), [path.join("output", `tree-${mode}.ged`), path.join("output", `tree-strom-${mode}.ged`)].sort());
    for (const f of files) {
      assert.deepEqual(f.living, { mode, count: 4 }, mode);
      const text = fs.readFileSync(f.file, "utf8");
      assert.match(text, new RegExp(`^1 _STROM_PRIVACY ${mode}\\n2 _LIVING 4$`, "mu"));
      assert.doesNotMatch(text, /_STROM_TREE|_STROM_HEAD|_STROM_LINKS/u, mode);
      // the dead as he was; the living never named but by the mode
      assert.match(text, /1 NAME Čeněk \/Lhoták\//u, mode);
      assert.doesNotMatch(text, /Hedvika|Věra|Ľubomír|Tereza|14 FEB|JUL 1975|Lhota\n/u, mode);
      assert.equal((text.match(/^0 @[^@]+@ INDI$/gmu) ?? []).length, 5, mode);
      assert.equal((text.match(/^0 @[^@]+@ FAM$/gmu) ?? []).length, 2, mode);
    }
    const std = fs.readFileSync(path.join(out, `tree-${mode}.ged`), "utf8");
    if (mode === "initials") {
      assert.match(std, /1 NAME H\. \/L\.\/\n1 SEX F\n1 BIRT\n2 DATE 1978/u);
      assert.match(std, /1 MARR\n2 DATE 1975/u);
    }
    if (mode === "surname") assert.match(std, /1 NAME Žijící osoba \/Lhotová\//u);
    if (mode === "hidden") assert.match(std, /1 NAME Žijící osoba \/\//u);
  }
  // never in the history (once .gitignore keeps them out, nothing else committed); the full files untouched
  assert.deepEqual(git(w.cwd, "log", "--format=%s", `${head.trim()}..HEAD`).trim().split("\n"), ["The files with the living protected stay out of the history"]);
  assert.doesNotMatch(git(w.cwd, "log", "--name-only", "--format="), /tree-(?:strom-)?(?:initials|surname|hidden)\.ged/u);
  assert.equal(git(w.cwd, "ls-files", "output/*.ged").trim(), "output/tree.ged");
  assert.equal(git(w.cwd, "status", "--porcelain").trim(), "");
  assert.equal(fs.readFileSync(path.join(out, "tree.ged"), "utf8"), tree);
  assert.equal(fs.readFileSync(path.join(out, "tree-strom.ged"), "utf8"), strom);
  // the history's tree.ged is the full one
  assert.match(git(w.cwd, "show", "HEAD:output/tree.ged"), /Hedvika/u);

  // a bare --living: initials; an agent reads English
  const bare = await w.ok(["export", "gedcom", "--for", "standard", "--living"], { env: { CLAUDECODE: "1" } });
  assert.match(bare.out, /tree-initials\.ged/u);
  assert.match(bare.out, /4 living people protected \(initials \+ birth year\)/u);
  assert.doesNotMatch(bare.out, /Contains all details/u);
  assert.match((await w.ok(["export", "gedcom", "--for", "standard", "--living"])).out, /chráněno: 4 žijící osoby \(iniciály \+ rok narození\)/u);
  // the app's names of the modes
  assert.match((await w.ok(["export", "gedcom", "--for", "standard", "--living", "minimal"])).out, /tree-surname\.ged/u);
  w.cleanup();
});

test("strom export gedcom --living: --out outside the research folder, never into it; a mode it does not know refused", opts, async () => {
  const w = await family();
  const away = path.join(w.dir, "na plochu", "lhotakovi.ged");
  fs.mkdirSync(path.dirname(away));
  await w.ok(["export", "gedcom", "--living", "--for", "standard", "--out", away]);
  assert.match(fs.readFileSync(away, "utf8"), /1 _STROM_PRIVACY initials/u);
  for (const inside of [path.join(w.cwd, "lhotakovi.ged"), path.join(w.cwd, "output", "tree.ged"), path.join(w.cwd, "notes", "x.ged")]) {
    const r = await w.run(["export", "gedcom", "--living", "surname", "--for", "standard", "--out", inside, "--json"]);
    assert.equal(r.code, 2, inside);
    assert.equal(JSON.parse(r.out).code, "export.living.in-tree");
    assert.ok(!fs.existsSync(inside) || inside.endsWith("tree.ged"), inside);
  }
  // its own file in output/ by --out too
  await w.ok(["export", "gedcom", "--living", "hidden", "--for", "standard", "--out", path.join(w.cwd, "output", "tree-hidden.ged")]);
  const bad = await w.run(["export", "gedcom", "--living", "omit", "--json"]);
  assert.equal(bad.code, 2);
  assert.equal(JSON.parse(bad.out).code, "export.living.mode");
  assert.equal(git(w.cwd, "status", "--porcelain").trim(), "");
  w.cleanup();
});

test("the setting gedcom.living: a file going out by it, a protected one beside the full ones; full as before", opts, async () => {
  const w = await family();
  await w.ok(["export", "gedcom"]);
  const tree = fs.readFileSync(path.join(w.cwd, "output", "tree.ged"), "utf8");
  await w.ok(["config", "set", "gedcom.living", "surname", "--for-tree"]);
  const both = await w.ok(["export", "gedcom", "--for", "standard"]);
  assert.match(both.out, /tree\.ged/u);
  assert.match(both.out, /tree-surname\.ged/u);
  assert.match(both.out, /Obsahuje všechny údaje žijících osob/u);
  // the full file as without the setting (but its date)
  const same = (t: string) => t.replace(/^1 DATE .*$/mu, "");
  assert.equal(same(fs.readFileSync(path.join(w.cwd, "output", "tree.ged"), "utf8")), same(tree));
  assert.match(fs.readFileSync(path.join(w.cwd, "output", "tree-surname.ged"), "utf8"), /1 _STROM_PRIVACY surname/u);
  // --out by the setting; --living full: all details
  const away = path.join(w.dir, "ven.ged");
  await w.ok(["export", "gedcom", "--for", "standard", "--out", away]);
  assert.match(fs.readFileSync(away, "utf8"), /1 _STROM_PRIVACY surname/u);
  await w.ok(["export", "gedcom", "--for", "standard", "--out", away, "--living", "full"]);
  assert.doesNotMatch(fs.readFileSync(away, "utf8"), /_STROM_PRIVACY/u);
  // a bare --living by the setting
  assert.match((await w.ok(["export", "gedcom", "--for", "standard", "--living"])).out, /tree-surname\.ged/u);
  assert.equal(git(w.cwd, "ls-files", "output/*.ged").trim(), "output/tree.ged");
  w.cleanup();
});

test("a protected file is never a source of changes: strom sync refuses it, strom intake keeps it as material only", opts, async () => {
  const w = await family();
  await w.ok(["export", "gedcom", "--living", "--for", "strom"]);
  const file = path.join(w.cwd, "output", "tree-strom-initials.ged");
  const away = path.join(w.dir, "chraneny.ged");
  fs.copyFileSync(file, away);
  const before = git(w.cwd, "rev-parse", "HEAD");
  const r = await w.run(["sync", away, "--json"]);
  assert.equal(r.code, 2, r.out + r.err);
  const said = JSON.parse(r.out) as { code: string; message: string };
  assert.equal(said.code, "tree.protected");
  assert.match(said.message, /initials \+ birth year/u);
  assert.match((await w.run(["sync", away])).err, /chraneny\.ged je soubor s ochranou žijících \(iniciály \+ rok narození\): údaje 3 žijících osob v něm chybí — nikdy zdroj změn/u);
  // the Strom app's JSON marked so: the same
  const json = path.join(w.dir, "chraneny.json");
  fs.writeFileSync(json, JSON.stringify({ version: 1, privacy: "initials", persons: [{ id: "a", firstName: "H.", lastName: "L." }] }));
  assert.equal(JSON.parse((await w.run(["sync", json, "--json"])).out).code, "tree.protected");
  assert.equal(git(w.cwd, "rev-parse", "HEAD"), before);
  // as material: kept, not taken into the tree
  const people = ((await w.ok(["person", "list", "--json"])).json as unknown[]).length;
  const intake = await w.ok(["intake", away]);
  assert.match(intake.out, /soubor s ochranou žijících \(iniciály \+ rok narození\) — uložen jako materiál, do stromu nepřevzat/u);
  assert.equal(((await w.ok(["person", "list", "--json"])).json as unknown[]).length, people);
  w.cleanup();
});

test("strom pack says a full file carries the living", opts, async () => {
  const w = await family();
  const r = await w.ok(["pack", "--out", path.join(w.dir, "lhotakovi.zip")]);
  assert.match(r.out, /Obsahuje všechny údaje žijících osob – pro vlastní zálohu nebo přenos, ne ke sdílení\./u);
  w.cleanup();
});
