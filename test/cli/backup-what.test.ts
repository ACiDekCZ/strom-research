// What to back up (spec 017, M3): strom backup says the one folder that holds every research and the shared images —
// where it is and its size, the shared folder in it, what lies outside — or one research packed (strom pack). Read
// only; in a person's language, nothing of an agent; in the archive's help and in the menu's maintenance.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit, readJsonFile } from "../helpers.ts";

const opts = { skip: !hasGit || process.platform === "win32" };

const cfgOf = (w: World) => path.join(w.env.STROM_CONFIG_DIR!, "config.json");

test("M3 strom backup: the whole folder of the research with its size, the shared folder in it, strom pack — read only, the backups' linked images not counted twice", opts, async () => {
  const w = new World();
  const tree = await w.withTree("Novákovi");
  await w.ok(["person", "add", "Jan /Novák/", "--born", "1905"]);
  const shared = (readJsonFile(cfgOf(w)).shared as string | undefined) ?? path.join(w.home, "shared");
  const image = path.join(shared, "media", "cd", "cd".padEnd(64, "3"));
  fs.mkdirSync(path.dirname(image), { recursive: true });
  fs.writeFileSync(image, Buffer.alloc(3 * 1024 * 1024, 7));
  // a backup before another version: its image linked, taking no room twice
  fs.writeFileSync(cfgOf(w), JSON.stringify({ ...readJsonFile(cfgOf(w)), lastVersion: "99.0.0-beta.1", lastChannel: "beta" }));
  w.env.STROM_CHANNEL = "beta";
  await w.ok(["status"], { cwd: tree });
  const before = fs.readFileSync(cfgOf(w), "utf8");
  const j = (await w.ok(["backup", "--json"])).json;
  assert.equal(j.home, w.home);
  assert.equal(j.shared.path, shared);
  assert.equal(j.shared.inside, true);
  assert.ok(j.shared.bytes >= 3 * 1024 * 1024, JSON.stringify(j));
  assert.ok(j.bytes >= j.shared.bytes, "the whole folder holds the shared one");
  assert.ok(j.backups.bytes < 1024 * 1024, `the backup's image is the same file: ${j.backups.bytes}`);
  assert.equal(j.pack, "strom pack");
  assert.ok(j.last?.path, "the last backup");
  // a person reads it in the research's language: the folder, its size, shared, pack; nothing of an agent or a cost
  const r = await w.ok(["backup"]);
  assert.match(r.out, /^Co zálohovat$/m);
  assert.match(r.out, /^Celá složka \S[^\n]* \(3,\d MB\): všechny rodokmeny i s historií\.$/m);
  assert.match(r.out, /V ní i shared \(3,\d MB\): skeny, originály z aplikace Strom a z telefonu, konektory\./);
  assert.match(r.out, /Zkopírovaná celá na jiný disk nebo do složky v cloudu je zálohou/);
  assert.match(r.out, /podsložka backups \(na disku navíc [^)]+\)/);
  assert.match(r.out, /strom pack \(v menu: Jiný rodokmen · poslat nebo přijmout\)/);
  assert.doesNotMatch(r.out, /agent|\bAI\b|Claude|\$|cena/i);
  // read only: nothing written
  assert.equal(fs.readFileSync(cfgOf(w), "utf8"), before);
  w.cleanup();
});

test("M3 a shared folder outside the folder of the research is named to back up as well", opts, async () => {
  const w = new World();
  await w.withTree("Novákovi");
  const elsewhere = path.join(w.dir, "jinde", "sdílené");
  fs.mkdirSync(path.join(elsewhere, "media"), { recursive: true });
  fs.writeFileSync(cfgOf(w), JSON.stringify({ ...readJsonFile(cfgOf(w)), shared: elsewhere }));
  const r = await w.ok(["backup"]);
  assert.match(r.out, /^Mimo ni, zálohovat také: \S[^\n]*sdílené \(\d+ kB\)\.$/m);
  assert.equal((await w.ok(["backup", "--json"])).json.outside[0].path, elsewhere);
  assert.doesNotMatch(r.out, /V ní i shared/);
  w.cleanup();
});

test("M3 an archive's help names strom backup, in its language", opts, async () => {
  const w = new World();
  await w.ok(["setup", "--yes"]);
  await w.ok(["init", "Archiv", "--mode", "archive"]);
  w.cwd = w.treeDir("Archiv");
  const r = await w.ok(["help", "--human"]);
  assert.match(r.out, /backup\s+Co zálohovat: složka se všemi výzkumy a sdílenými obrázky, kde je a jak je velká/);
  w.cleanup();
});
