// trees remove: a family tree taken off the computer — into the trash, a backup offered first, the name typed to confirm.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { World, hasGit } from "../helpers.ts";
import { moveToTrash } from "../../src/core/trash.ts";

const opts = { skip: !hasGit };
const fixtures = path.join(import.meta.dirname, "..", "fixtures", "images");

function scans(w: World, name: string, files: string[]): string {
  const dir = path.join(w.dir, name);
  fs.mkdirSync(dir, { recursive: true });
  for (const f of files) fs.copyFileSync(path.join(fixtures, f), path.join(dir, f));
  return dir;
}

test("trees remove: a backup first, the name typed, the tree and the images only it used into the trash — and back from the backup", opts, async () => {
  const w = new World();
  await w.ok(["setup", "--yes"]);
  await w.ok(["init", "Svobodovi"]);
  await w.ok(["recordset", "add", "Kniha"], { cwd: w.treeDir("Svobodovi") });
  await w.ok(["media", "add", scans(w, "b", ["s0002.jpg"]), "--recordset", "B1"], { cwd: w.treeDir("Svobodovi") });
  await w.ok(["init", "Novákovi"]);
  const root = w.treeDir("Novákovi");
  await w.ok(["recordset", "add", "Kniha"], { cwd: root });
  await w.ok(["media", "add", scans(w, "a", ["s0001.jpg", "s0002.jpg"]), "--recordset", "B1"], { cwd: root });
  const file = (n: string) => (JSON.parse(fs.readFileSync(path.join(root, "data", "images", `${n}.json`), "utf8")) as { file: string }).file;
  const [only, both] = [file("M0001"), file("M0002")];

  // an agent never takes a tree off
  assert.equal((await w.run(["trees", "remove", "Novákovi"])).code, 4);
  // somebody at work on it: not now
  const lock = path.join(root, ".strom", "tree.lock");
  fs.writeFileSync(lock, JSON.stringify({ pid: process.pid, host: os.hostname(), at: new Date().toISOString(), owner: "a test" }));
  assert.match((await w.run(["trees", "remove", "Novákovi"], { answers: [] })).err, /na rodokmenu „Novákovi“ se právě pracuje/);
  fs.rmSync(lock);
  // the Strom app following it live is no work: its bridge stops when the tree goes
  const bridge = spawn(process.execPath, ["-e", "setTimeout(() => {}, 60_000)", "live", "serve"], { stdio: "ignore" });
  fs.writeFileSync(path.join(root, ".strom", "live.json"), JSON.stringify({ port: 1, token: "t", pid: bridge.pid, url: "http://127.0.0.1:1/t", started: new Date().toISOString(), version: "1.0.0" }));
  const gone = new Promise((done) => bridge.on("exit", done));
  // a name typed wrong takes nothing off
  const wrong = await w.ok(["trees", "remove", "Novákovi"], { answers: ["n", "a", "Svobodovi"] });
  assert.match(wrong.out, /„Novákovi“ \(.*\) · osoby: 0[\s\S]*Nejdřív ho zabalit jako zálohu, se všemi snímky[\s\S]*snímky: 1, [\d.]+ MB[\s\S]*napsat název rodokmenu \(Novákovi\)[\s\S]*Nic se neodebralo/);
  assert.ok(fs.existsSync(root));
  await w.ok(["init", "Dvořákovi"]);
  await w.ok(["trees", "use", "Novákovi"]);
  // typed without its accents and capitals: it goes, with a backup and its own image
  const r = await w.ok(["trees", "remove", "Novákovi"], { answers: ["a", "a", "novakovi"] });
  assert.match(r.out, /záloha: [\s\S]*„Novákovi“ je v koši\.\n  aplikace Strom ho už živě nesleduje\n[\s\S]*jeho snímky v koši: 1[\s\S]*vrátí se ze zálohy: strom unpack „(.+)“[\s\S]*z koše systému/);
  assert.ok(!fs.existsSync(root));
  await gone;
  const trash = w.env.STROM_TRASH!;
  assert.ok(fs.existsSync(path.join(trash, "Novákovi", "strom.json")), "the tree is in the trash, whole");
  assert.ok(fs.existsSync(path.join(trash, "Novákovi – snímky", ...only.split("/"))), "its own image beside it");
  assert.ok(!fs.existsSync(path.join(w.home, "shared", only)));
  assert.ok(fs.existsSync(path.join(w.home, "shared", both)), "an image another tree uses stays");
  assert.deepEqual((await w.ok(["trees", "--json"])).json.trees.map((t: { name: string }) => t.name), ["Dvořákovi", "Svobodovi"]);
  // the tree worked on went: the one left is worked on now — the menu opens it, not a menu with none chosen
  assert.match(r.out, /nebo z koše systému, dokud se koš nevysype\nTeď se pracuje s rodokmenem „Dvořákovi“/);
  assert.match((await w.ok([], { tty: true, answers: ["0"] })).out, /Rodokmen: Dvořákovi/);
  // back from the backup, its image too
  const backup = /vrátí se ze zálohy: strom unpack „(.+)“/.exec(r.out)![1]!.replace(/^~/, w.env.HOME!);
  await w.ok(["unpack", backup], { answers: ["a"] });
  assert.match((await w.ok(["check"], { cwd: root })).out, /^ok/);
  assert.ok(fs.existsSync(path.join(w.home, "shared", only)));
  w.cleanup();
});

test("the trash of a Mac: the user's ~/.Trash, a free name there", { skip: process.platform !== "darwin" }, () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "strom trash "));
  for (let i = 0; i < 2; i++) {
    const dir = path.join(home, "Dvořákovi");
    fs.mkdirSync(dir);
    fs.writeFileSync(path.join(dir, "strom.json"), "{}");
    moveToTrash(dir, { HOME: home }, "Dvořákovi", "darwin");
  }
  assert.deepEqual(fs.readdirSync(path.join(home, ".Trash")).sort(), ["Dvořákovi", "Dvořákovi (2)"]);
  fs.rmSync(home, { recursive: true, force: true });
});
