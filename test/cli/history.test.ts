// The research's history packed (git gc) once it has grown, nobody at work: nothing of the research removed, git fsck
// before and after, what it finds wrong only said (strom doctor); a packing cut short leaves the history readable.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { World, hasGit } from "../helpers.ts";

const opts = { skip: !hasGit };
const CLI = path.join(import.meta.dirname, "..", "..", "src", "cli.ts");

const loose = (cwd: string) => Number(/^count: (\d+)$/m.exec(execFileSync("git", ["count-objects", "-v"], { cwd, encoding: "utf8" }))![1]);
const fsckOk = (cwd: string) => spawnSync("git", ["fsck", "--no-progress", "--no-dangling"], { cwd }).status === 0;

async function grown(): Promise<World> {
  const w = new World();
  await w.withTree("Novákovi");
  for (const n of ["Jan", "Josef", "Marie"]) await w.ok(["person", "add", `${n} /Novák/`]);
  return w;
}

test("strom compact: below the threshold nothing; past it the history packed, logged with .git before and after, the research whole", opts, async () => {
  const w = await grown();
  assert.match((await w.ok(["compact"])).out, /Historie rodokmenu je malá/);
  assert.ok(loose(w.cwd) > 0);
  w.env.STROM_COMPACT_MB = "0";
  const r = await w.ok(["compact", "--json"]);
  assert.equal(r.json.done, true, JSON.stringify(r.json));
  assert.equal(loose(w.cwd), 0, "packed");
  assert.match(fs.readFileSync(path.join(w.cwd, ".strom", "tidy.log"), "utf8"), /history packed: \.git [\d.]+ [kM]B → [\d.]+ [kM]B \(loose [\d.]+ [kM]B\), git fsck ok before and after/);
  assert.match((await w.ok(["check"])).out, /^ok/);
  assert.equal((await w.ok(["person", "list", "--json"])).json.total, 3);
  // doctor: how much the history takes
  const doc = (await w.run(["doctor", "--json"])).json.checks.find((c: { name: string }) => c.name === "history");
  assert.equal(doc.status, "ok");
  w.cleanup();
});

test("a history git fsck finds wrong is not packed, nothing put right: said by strom doctor", opts, async () => {
  const w = await grown();
  // one object of the history damaged
  const objects = path.join(w.cwd, ".git", "objects");
  const dir = fs.readdirSync(objects).find((d) => /^[0-9a-f]{2}$/.test(d))!;
  const file = path.join(objects, dir, fs.readdirSync(path.join(objects, dir))[0]!);
  fs.chmodSync(file, 0o644);
  fs.writeFileSync(file, "broken");
  w.env.STROM_COMPACT_MB = "0";
  const r = await w.run(["compact", "--json"]);
  assert.equal(r.json.why, "fsck", JSON.stringify(r.json));
  assert.equal(fs.readFileSync(file, "utf8"), "broken", "nothing put right");
  const doc = (await w.run(["doctor", "--json"])).json.checks.find((c: { name: string }) => c.name === "history");
  assert.equal(doc.status, "warn");
  assert.match(doc.detail, /Novákovi: kontrola historie našla chybu/);
  w.cleanup();
});

test("a packing cut short (killed) leaves the history readable and the research writable", opts, async () => {
  const w = await grown();
  // many loose objects: a packing that takes a while
  const input = Array.from({ length: 4000 }, (_, i) => `blob ${i} ${"x".repeat(200)}`);
  const dir = path.join(w.dir, "blobs");
  fs.mkdirSync(dir);
  input.forEach((t, i) => fs.writeFileSync(path.join(dir, `${i}.txt`), t));
  execFileSync("git", ["hash-object", "-w", "--stdin-paths"], { cwd: w.cwd, input: input.map((_, i) => path.join(dir, `${i}.txt`)).join("\n") });
  for (const ms of [30, 150, 400]) {
    const child = spawn(process.execPath, [CLI, "compact", "--now"], { cwd: w.cwd, env: { ...w.env }, stdio: "ignore" });
    await new Promise((ok) => setTimeout(ok, ms));
    child.kill("SIGKILL");
    await new Promise((ok) => child.on("exit", ok));
    assert.ok(fsckOk(w.cwd), `readable after a kill at ${ms} ms`);
  }
  assert.match((await w.ok(["check"])).out, /^ok/);
  await w.ok(["person", "add", "Anna /Nováková/"]);
  assert.equal((await w.ok(["person", "list", "--json"])).json.total, 4);
  w.cleanup();
});

test("packed in the background once the history has grown: after a family tree written", opts, async () => {
  const w = await grown();
  w.env.STROM_COMPACT_MB = "0";
  const ged = path.join(w.dir, "tree.ged");
  fs.writeFileSync(ged, ["0 HEAD", "1 GEDC", "2 VERS 5.5.1", "1 CHAR UTF-8", "0 @I1@ INDI", "1 NAME Karel /Dvořák/", "0 TRLR", ""].join("\n"));
  await w.ok(["sync", ged, "--apply", "--force"]);
  const log = path.join(w.cwd, ".strom", "tidy.log");
  for (let i = 0; i < 100 && !(fs.existsSync(log) && /history packed/.test(fs.readFileSync(log, "utf8"))); i++) await new Promise((ok) => setTimeout(ok, 100));
  assert.match(fs.readFileSync(log, "utf8"), /history packed/);
  w.cleanup();
});
