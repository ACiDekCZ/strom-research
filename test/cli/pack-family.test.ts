// strom pack and trees remove tell the archive scans apart from the family's photos and originals; a package carries
// the batches of the Strom app (name, people, note) and unpack puts them back; over 4 GB is said in one sentence
// before anything is written (no ZIP64): the whole folder copied takes the research along.

import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import { material } from "../../src/core/material.ts";
import type { Input, Media } from "../../src/core/model.ts";

const opts = { skip: !hasGit || process.platform === "win32" };
const app = { Origin: "https://beta.stromapp.info" };
const fixtures = path.join(import.meta.dirname, "..", "fixtures", "images");
const sha = (b: Buffer) => crypto.createHash("sha256").update(b).digest("hex");
const read = (f: string) => fs.readFileSync(path.join(fixtures, f));

function request(method: string, url: string, body?: Buffer, headers: Record<string, string> = {}): Promise<{ status: number; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method, headers: { ...(body ? { "Content-Length": String(body.length) } : {}), ...headers } }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (d: Buffer) => chunks.push(d));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks) }));
    });
    req.on("error", reject);
    req.end(body);
  });
}

test("pack and trees remove: archive scans apart from the family's photos and originals; the batches go along and come back; over 4 GB one sentence, nothing written", opts, async () => {
  const w = new World();
  await w.ok(["setup", "--yes"]);
  await w.ok(["init", "Lhotákovi", "--lang", "cs"]);
  const root = w.treeDir("Lhotákovi");
  const cwd = { cwd: root };
  await w.ok(["person", "add", "Vojtěch /Lhoták/", "--sex", "M"], cwd); // P0001
  await w.ok(["recordset", "add", "Kniha"], cwd);
  const scansDir = path.join(w.dir, "skeny");
  fs.mkdirSync(scansDir);
  fs.copyFileSync(path.join(fixtures, "s0002.jpg"), path.join(scansDir, "s0002.jpg"));
  await w.ok(["media", "add", scansDir, "--recordset", "B1"], cwd);

  // the family's material from the app: one photo of a person, two files in a batch with its name, person and note
  const batch = "7d1e0c3a-5b2f-4e88-a1c9-0f6b2d4e8a71";
  const info = (await w.ok(["live", "start", "--json"], cwd)).json;
  try {
    const put = (b: Buffer, name: string, more: Record<string, string> = {}) =>
      request("PUT", `${info.url}/media/${sha(b)}`, b, { ...app, "X-Strom-Name": encodeURIComponent(name), ...more });
    assert.equal((await put(read("png-rgba.png"), "Vojtěch na vojně.png", { "X-Strom-Person": "P0001" })).status, 200);
    const inBatch = (b: Buffer, p: string) => put(b, path.basename(p), { "X-Strom-Batch": batch, "X-Strom-Path": encodeURIComponent(p) });
    assert.equal((await inBatch(read("s0001.jpg"), "Půda/Dopisy/1946.jpg")).status, 200);
    assert.equal((await inBatch(read("png-bw.png"), "Půda/svatba.png")).status, 200);
    const done = await request("POST", `${info.url}/batch/${batch}/done`, Buffer.from(JSON.stringify({ name: "Krabice z půdy", person: "P0001", note: "Dopisy, Фото 1946" })), {
      ...app,
      "Content-Type": "application/json",
    });
    assert.equal(done.status, 200, done.body.toString());
  } finally {
    await w.ok(["live", "stop"], cwd);
  }

  // over 4 GB (here a limit made small): one sentence in the research language, no file left behind
  const big = path.join(w.dir, "velký.zip");
  const refused = await w.run(["pack", "--out", big], { ...cwd, env: { STROM_PACK_MAX_BYTES: "1000" } });
  assert.notEqual(refused.code, 0);
  assert.match(refused.err, /balík by měl přes 4 GB – na jeden soubor ZIP je to moc: výzkum přenese zkopírovaná celá složka .+ \(na disk USB, do složky v cloudu\)/);
  assert.ok(!fs.existsSync(big), "nothing written");
  const agent = await w.run(["pack", "--out", big, "--json"], { ...cwd, env: { STROM_PACK_MAX_BYTES: "1000" } });
  assert.equal(JSON.parse(agent.out || agent.err).error?.code ?? JSON.parse(agent.out || agent.err).code, "pack.too-large");
  // a program reads the person's English hint, the same as the terminal says it
  const said = JSON.parse(agent.out || agent.err);
  assert.equal(said.error?.hint ?? said.hint, "the whole folder copied instead of a package");
  // the shared folder outside the trees' folder: both folders, each named (never "the whole folder A, B")
  const apart = path.join(w.dir, "jinde", "sdílené");
  const two = await w.run(["pack", "--out", big], { ...cwd, env: { STROM_PACK_MAX_BYTES: "1000", STROM_SHARED: apart } });
  assert.notEqual(two.code, 0);
  assert.match(two.err, /výzkum přenesou zkopírované obě složky, .+Lhotákovi a .+sdílené \(na disk USB, do složky v cloudu\)/u, two.err);
  assert.doesNotMatch(two.err, /celá složka/u);
  const twoJson = JSON.parse((await w.run(["pack", "--out", big, "--json"], { ...cwd, env: { STROM_PACK_MAX_BYTES: "1000", STROM_SHARED: apart } })).out || "{}");
  const twoErr = twoJson.error ?? twoJson;
  assert.equal(twoErr.code, "pack.too-large");
  assert.match(twoErr.message, /both folders, .+ and .+, copied/u);
  assert.equal(twoErr.hint, "both folders copied instead of a package");
  assert.ok(!fs.existsSync(big), "nothing written");

  // the package: the scans apart from the family's photos and originals, the batch said
  const out = path.join(w.dir, "balík.zip");
  const packed = await w.ok(["pack", "--out", out], cwd);
  assert.match(packed.out, /\n  skeny z archivů: 1 \(/);
  assert.match(packed.out, /\n  rodinné fotky a originály: 3 \(/);
  assert.match(packed.out, /\n  dávky z aplikace Strom: 1 \(název, lidé, poznámka\)/);
  const manifest = (await w.ok(["pack", "--out", path.join(w.dir, "b2.zip"), "--json"], cwd)).json.manifest;
  assert.deepEqual(manifest.batches, [batch]);

  // taken off: the scans asked apart from the family's files (those no by default — Enter keeps them)
  const shared = path.join(w.home, "shared");
  const tree = Tree.open(root, w.env);
  const scanFile = tree.list<Media>("media").find((m) => m.recordset)!.file;
  const family = tree.list<Input>("input").map((i) => i.file!.slice(6));
  assert.equal(family.length, 3);
  const r = await w.ok(["trees", "remove", "Lhotákovi"], { answers: ["n", "a", "", "lhotakovi"] });
  assert.match(r.out, /Poslat do koše i skeny z archivů, které žádný jiný rodokmen nepoužívá \(skeny: 1, [^)]+\)\?/);
  assert.match(r.out, /Poslat do koše i rodinné fotky a originály, které žádný jiný rodokmen nepoužívá \(3, [^)]+\)\? Nikdo je znovu nestáhne\./);
  assert.match(r.out, /jeho skeny z archivů v koši: 1/);
  assert.doesNotMatch(r.out, /rodinné fotky a originály v koši/);
  const trash = w.env.STROM_TRASH!;
  assert.ok(fs.existsSync(path.join(trash, "Lhotákovi – soubory", ...scanFile.split("/"))), "the scan in the trash");
  for (const f of family) assert.ok(fs.existsSync(path.join(shared, ...f.split("/"))), `the family's ${f} stays`);
  assert.equal((await w.ok(["trees", "remove", "--help"])).out.includes("family's photos and originals"), true);

  // back from the package: the batch with its name, person and note, as the Strom app's material shows it
  await w.ok(["unpack", out], { answers: ["a"] });
  const back = Tree.open(root, w.env);
  assert.match((await w.ok(["check"], cwd)).out, /^ok/);
  const m = material(back, shared, { files: false });
  assert.deepEqual(
    m.batches.map((b) => ({ id: b.id, name: b.name, persons: b.persons, note: b.note })),
    [{ id: batch, name: "Krabice z půdy", persons: ["P0001"], note: "Dopisy, Фото 1946" }],
  );
  assert.ok(fs.existsSync(path.join(shared, ...scanFile.split("/"))), "the scan back from the package");
  // nothing else of strom's working folder came with it
  assert.deepEqual(fs.readdirSync(path.join(root, ".strom", "batches")), [`${batch}.json`]);
  w.cleanup();
});

test("trees remove: a backup over 4 GB is said and none is made — the questions go on, nothing taken off unasked", opts, async () => {
  const w = new World();
  await w.ok(["setup", "--yes"]);
  await w.ok(["init", "Lhotovi", "--lang", "cs"]);
  const root = w.treeDir("Lhotovi");
  const r = await w.ok(["trees", "remove", "Lhotovi"], { answers: ["a", "jiný název"], env: { STROM_PACK_MAX_BYTES: "1000" } });
  assert.match(r.out, /balík by měl přes 4 GB – na jeden soubor ZIP je to moc: výzkum přenese zkopírovaná celá složka/);
  assert.doesNotMatch(r.out, /záloha: /);
  assert.match(r.out, /Nic se neodebralo/);
  assert.ok(fs.existsSync(root));
  w.cleanup();
});
