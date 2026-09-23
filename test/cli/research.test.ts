import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { World, hasGit, readJsonFile } from "../helpers.ts";

const opts = { skip: !hasGit };

async function family(w: World) {
  await w.ok(["research", "new", "Předci Jana Nováka", "--new-person", "Jan /Novák/", "--sex", "M", "--born", "ABT 1905", "--born-place", "Týnec nad Labem", "--note", "Babička vzpomíná na mlýn"]);
  await w.ok(["person", "add", "Josef /Novák/", "--sex", "M", "--born", "1870"]);
  await w.ok(["person", "add", "Marie /Svobodová/", "--sex", "F"]);
  await w.ok(["family", "add", "--partner", "Josef Novák", "--partner", "marie", "--child", "jan novak", "--married", "1898"]);
}

test("research new creates the focus person as leads and the research", opts, async () => {
  const w = new World();
  await w.withTree();
  const r = await w.ok(["research", "new", "Předci Jana Nováka", "--new-person", "Jan /Novák/", "--born", "ABT 1905", "--json"]);
  assert.equal(r.json.research.id, "G0001");
  assert.equal(r.json.focus.id, "P0001");
  assert.equal(r.json.focus.events[0].status, "lead");
  const p = readJsonFile(path.join(w.cwd, "data", "persons", "P0001.json"));
  assert.deepEqual(p.names, [{ given: "Jan", surname: "Novák" }]);
  assert.equal(p.events[0].date, "ABT 1905");
  const list = (await w.ok(["research", "list", "--json"])).json.researches;
  assert.equal(list[0].name, "Předci Jana Nováka");
  w.cleanup();
});

test("people, a family and generations in research show", opts, async () => {
  const w = new World();
  await w.withTree();
  await family(w);
  const show = await w.ok(["research", "show", "G1"]);
  assert.match(show.out, /G2\s+P0002\s+Josef Novák/);
  assert.match(show.out, /missing parents \(2\)/);
  const card = await w.ok(["person", "show", "jan"]);
  assert.match(card.out, /parents\s+F0001: P0002 Josef Novák \(\*1870\) & P0003 Marie Svobodová/);
  assert.match(card.out, /in research\s+G0001/);
  const gen2 = (await w.ok(["person", "list", "--research", "G0001", "--generation", "2", "--json"])).json.persons.map((p: any) => p.id);
  assert.deepEqual(gen2, ["P0002", "P0003"]);
  w.cleanup();
});

test("every write is committed automatically with a readable message", opts, async () => {
  const w = new World();
  await w.withTree();
  await family(w);
  const log = spawnSync("git", ["log", "--format=%s"], { cwd: w.cwd, encoding: "utf8" }).stdout.split("\n");
  assert.equal(log[0], "+F0001 Josef Novák & Marie Svobodová (1 child) · E0003 MARR 1898 [lead]");
  assert.ok(log.some((l) => l.startsWith("+P0002 Josef /Novák/ · E0002 BIRT")));
  const status = spawnSync("git", ["status", "--porcelain"], { cwd: w.cwd, encoding: "utf8" }).stdout;
  assert.equal(status, "");
  const hist = (await w.ok(["history", "--json"])).json.commits;
  assert.equal(hist.length, 6); // tree + agent files + research new + 2 persons + family
  w.cleanup();
});

test("method rules: proven needs a citation, notes are short, dates are validated", opts, async () => {
  const w = new World();
  await w.withTree();
  await family(w);
  const proven = await w.run(["event", "add", "P0002", "BIRT", "--date", "1870", "--status", "proven"]);
  assert.equal(proven.code, 2);
  assert.match(proven.err, /needs a citation/);
  assert.match(proven.err, /→ /);
  assert.equal((await w.run(["note", "add", "P0001", "x".repeat(501)])).code, 2);
  const bad = await w.run(["event", "add", "P0001", "DEAT", "--date", "31 FEB 1950"]);
  assert.equal(bad.code, 2);
  assert.match(bad.err, /GEDCOM form/);
  assert.equal((await w.run(["event", "add", "F0001", "BIRT"])).code, 2); // personal event on a family
  const ok = await w.ok(["event", "add", "P0002", "occupation", "--value", "mlynář", "--json"]);
  assert.equal(ok.json.event.kind, "OCCU");
  w.cleanup();
});

test("families: no second set of birth parents, no duplicates", opts, async () => {
  const w = new World();
  await w.withTree();
  await family(w);
  await w.ok(["person", "add", "Karel /Dvořák/", "--sex", "M"]);
  const twice = await w.run(["family", "add", "--partner", "Karel Dvořák", "--child", "P0001"]);
  assert.equal(twice.code, 2);
  assert.match(twice.err, /already has birth parents in F0001/);
  await w.ok(["family", "add", "--partner", "Karel Dvořák", "--child", "P0001", "--relation", "adopted"]);
  assert.equal((await w.run(["family", "add", "--partner", "P0002", "--partner", "P0002"])).code, 2);
  w.cleanup();
});

test("ambiguous names list candidates (exit 2); IDs always work", opts, async () => {
  const w = new World();
  await w.withTree();
  await w.ok(["person", "add", "Jan /Novák/", "--born", "1905"]);
  await w.ok(["person", "add", "Jan /Novák/", "--born", "1931"]);
  const r = await w.run(["person", "show", "jan novak"]);
  assert.equal(r.code, 2);
  assert.match(r.err, /P0001 Jan Novák \(\*1905\)/);
  assert.match(r.err, /P0002 Jan Novák \(\*1931\)/);
  const j = (await w.run(["person", "show", "jan novak", "--json"])).json;
  assert.equal(j.status, "ambiguous");
  assert.equal(j.candidates.length, 2);
  assert.equal((await w.ok(["person", "show", "P2", "--json"])).json.person.id, "P0002");
  w.cleanup();
});

test("--dry-run changes nothing", opts, async () => {
  const w = new World();
  await w.withTree();
  const r = await w.ok(["person", "add", "Jan /Novák/", "--dry-run"]);
  assert.match(r.out, /dry run/);
  assert.ok(!fs.existsSync(path.join(w.cwd, "data", "persons")));
  assert.deepEqual(readJsonFile(path.join(w.cwd, "data", "_counters.json")), {});
  w.cleanup();
});

test("listings are paged with a follow-up command", opts, async () => {
  const w = new World();
  await w.withTree();
  for (let i = 1; i <= 5; i++) await w.ok(["person", "add", `Syn${i} /Novák/`]);
  const r = await w.ok(["person", "list", "--limit", "2"]);
  assert.match(r.out, /… 3 more: strom person list --page 2/);
  const last = (await w.ok(["person", "list", "--limit", "2", "--page", "3", "--json"])).json;
  assert.equal(last.persons.length, 1);
  w.cleanup();
});

test("IDs are never reused", opts, async () => {
  const w = new World();
  await w.withTree();
  await w.ok(["person", "add", "A /B/"]);
  await w.ok(["person", "add", "C /D/", "--dry-run"]);
  const r = await w.ok(["person", "add", "E /F/", "--json"]);
  assert.equal(r.json.person.id, "P0002");
  w.cleanup();
});

test("a failing writing command leaves nothing behind (transaction)", opts, async () => {
  const w = new World();
  await w.withTree();
  const r = await w.run(["research", "new", "X", "--new-person", "Jan /Novák/", "--direction", "sideways"]);
  assert.equal(r.code, 2);
  assert.ok(!fs.existsSync(path.join(w.cwd, "data", "persons", "P0001.json")), "the person created before the failure must be rolled back");
  const status = spawnSync("git", ["status", "--porcelain"], { cwd: w.cwd, encoding: "utf8" }).stdout;
  assert.equal(status, "");
  // IDs of the rolled-back write are free again only because nothing was ever committed.
  const ok = (await w.ok(["person", "add", "Jan /Novák/", "--json"])).json;
  assert.equal(ok.person.id, "P0001");
  w.cleanup();
});
