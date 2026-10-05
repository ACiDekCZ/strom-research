// A batch of material from the Strom app: many files through the bridge (X-Strom-Batch, -Path; a ZIP unpacked by
// the bridge), closed by the app or a day after its last file into sorting tasks of about 25 files by their folders;
// sorted file by file (strom input sort), the scans of a book registered as its images; nothing sorted in an archive.

import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";
import { ZipWriter, zipName } from "../../src/core/zip.ts";

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
const json = (r: { body: Buffer }) => JSON.parse(r.body.toString("utf8"));

test("the names in a ZIP from Windows: UTF-8 when they read so, else the DOS code page of Central Europe or the old one", () => {
  // "Babička" in CP852 (č = 0x9F)
  assert.equal(zipName(Buffer.from([0x42, 0x61, 0x62, 0x69, 0x9f, 0x6b, 0x61])), "Babička");
  assert.equal(zipName(Buffer.from("Dvořák/řeč.jpg", "utf8")), "Dvořák/řeč.jpg");
  // "Müller" in CP437 (ü = 0x81) — the same in CP852
  assert.equal(zipName(Buffer.from([0x4d, 0x81, 0x6c, 0x6c, 0x65, 0x72])), "Müller");
});

test("a batch from the app: its files kept without tasks, a ZIP unpacked by the bridge (a ZIP in it only said), closed into sorting tasks by folder; sorted file by file; the scans of a book become its images", opts, async () => {
  const w = new World();
  await w.withTree();
  await w.ok(["lang", "cs"]);
  await w.ok(["person", "add", "Josef /Novák/", "--sex", "M"]); // P1
  w.env.STROM_LIVE_POLL_MS = "100";
  w.env.STROM_BATCH_CHECK_MS = "200";
  const info = (await w.ok(["live", "start", "--json"])).json;
  try {
    const status = json(await request("GET", `${info.url}/status`));
    assert.deepEqual(status.accepts.media.batch, { files: 5000, bytes: 20 * 1024 ** 3, zip: true });
    assert.deepEqual(status.accepts.media.estimate, { filesPerTask: 25, perTask: 1, currency: "USD", basis: "typical" });
    assert.deepEqual(status.batches, []);

    const batch = "4f1c2a9e-0b7d-4c55-9a7e-3d2c1b0a9f88";
    const put = (b: Buffer, p: string, more: Record<string, string> = {}, s = sha(b)) =>
      request("PUT", `${info.url}/media/${s}`, b, { ...app, "X-Strom-Batch": batch, "X-Strom-Path": encodeURIComponent(p), "X-Strom-Name": encodeURIComponent(path.basename(p)), ...more });
    const a = json(await put(read("s0001.jpg"), "Babička/Dopisy/1946.jpg", { "X-Strom-Person": "P0001" }));
    assert.match(a.input, /^I\d{4}$/);
    assert.equal(a.task, undefined, "no task of its own: the batch's come when it is closed");
    const b = json(await put(read("png-bw.png"), "Babička/foto.png"));
    assert.deepEqual(json(await put(read("s0001.jpg"), "Babička/znovu.jpg")), { known: a.input, kind: "input", batch }, "the same content: only said");
    assert.equal((await put(Buffer.concat([Buffer.from("MZ"), Buffer.alloc(500)]), "Babička/setup.exe")).status, 415);
    // a ZIP: unpacked here, each file its own, its folders kept in the path; a ZIP in it and the system's litter left
    const zipFile = path.join(w.dir, "krabice.zip");
    const z = new ZipWriter(zipFile);
    z.add("Fotky/svatba.png", read("png-rgba.png"));
    z.add("Fotky/vnořený.zip", Buffer.from("PK\x05\x06" + "\0".repeat(18), "latin1"));
    z.add("Fotky/.DS_Store", Buffer.from("x"));
    z.add("dopis.txt", Buffer.from("Milá Marie …\n"));
    z.close();
    const zip = fs.readFileSync(zipFile);
    const unpacked = await put(zip, "krabice.zip", { "X-Strom-Zip": "1" });
    assert.equal(unpacked.status, 200, unpacked.body.toString());
    const got = json(unpacked).zip;
    assert.equal(got.inputs.length, 2);
    assert.deepEqual(got.nested, ["krabice.zip/Fotky/vnořený.zip"]);
    assert.ok(!fs.existsSync(path.join(w.home, "shared", "media", ".incoming", `${sha(zip)}.part`)), "the ZIP not kept");
    const svatba = (await w.ok(["input", "show", got.inputs[0], "--json"])).json.input;
    assert.equal(svatba.path, "krabice.zip/Fotky/svatba.png");
    assert.equal(svatba.batch, batch);

    let now = json(await request("GET", `${info.url}/status`)).batches;
    assert.equal(now.length, 1);
    assert.deepEqual({ ...now[0], at: undefined }, { id: batch, state: "open", at: undefined, files: 4, known: 1, refused: 1, nested: 1, sorted: 0, persons: ["P0001"], tasks: [] });

    // the app says it is whole: sorting tasks, by the folders the files came in
    assert.equal((await request("POST", `${info.url}/batch/${batch}/done`, Buffer.from("{}"))).status, 403, "only the app's pages");
    const done = await request("POST", `${info.url}/batch/${batch}/done`, Buffer.from(JSON.stringify({ name: "Krabice od babičky", files: 7, person: "P0001", note: "Dopisy z\u0007 války, hledat razítka pošty" })), { ...app, "Content-Type": "application/json" });
    assert.equal(done.status, 200, done.body.toString());
    const closed = json(done);
    assert.equal(closed.inputs, 4);
    assert.equal(closed.known, 1);
    assert.equal(closed.refused, 1);
    assert.equal(closed.tasks.length, 3, "Babička, the ZIP's photos, the ZIP's top level");
    const first = (await w.ok(["task", "show", closed.tasks[0], "--json"])).json.task;
    assert.equal(first.level, "intake");
    assert.deepEqual(first.where, [a.input, b.input]);
    assert.ok(first.subject.includes("P0001"));
    assert.match(first.what, /Roztřídit dávku „Krabice od babičky“ \(1\/3\) – Babička, souborů: 2/);
    // the user's note to the batch: kept with it, told in each of its tasks
    assert.match(first.why, /Poznámka uživatele k dávce: „Dopisy z války, hledat razítka pošty“\./);
    assert.equal(JSON.parse(fs.readFileSync(path.join(w.cwd, ".strom", "batches", `${batch}.json`), "utf8")).note, "Dopisy z války, hledat razítka pošty");
    // …and on each of its files, as the user's
    const noted = (await w.ok(["input", "show", a.input, "--json"])).json.input;
    assert.deepEqual(noted.notes.map((n: { text: string; by: string }) => [n.text, n.by]), [["Dopisy z války, hledat razítka pošty", "user"]]);
    assert.equal((await put(read("s0003.jpg"), "Babička/pozdě.jpg")).status, 409, "a closed batch takes nothing more");

    // sorted: a photo of Josef, a text of nobody here
    await w.ok(["input", "sort", b.input, "--as", "photo", "--person", "P0001"]);
    assert.equal((await w.run(["input", "sort", got.inputs[1], "--as", "unrelated"])).code, 2, "unrelated needs its reason");
    await w.ok(["input", "sort", got.inputs[1], "--as", "unrelated", "--reason", "a shopping list"]);
    assert.equal((await w.ok(["input", "show", got.inputs[1], "--json"])).json.input.state, "skipped");
    now = json(await request("GET", `${info.url}/status`)).batches;
    assert.equal(now[0].sorted, 2);
    assert.equal(now[0].state, "closed");

    // a batch nobody closes: closed a day after its last file
    const late = "9e8d7c6b-5a49-4382-a1b0-c9d8e7f6a5b4";
    const scans = [read("s0002.jpg"), read("s0003.jpg")];
    for (const [k, s] of scans.entries())
      assert.equal((await request("PUT", `${info.url}/media/${sha(s)}`, s, { ...app, "X-Strom-Batch": late, "X-Strom-Path": `Matrika/00${12 + k}.jpg` })).status, 200);
    const meta = path.join(w.cwd, ".strom", "batches", `${late}.json`);
    fs.writeFileSync(meta, JSON.stringify({ ...JSON.parse(fs.readFileSync(meta, "utf8")), updated: new Date(Date.now() - 25 * 3600_000).toISOString() }));
    let idle: { closed?: string; tasks?: string[] } = {};
    for (let i = 0; i < 100 && !idle.closed; i++) {
      await new Promise((r) => setTimeout(r, 100));
      idle = JSON.parse(fs.readFileSync(meta, "utf8"));
    }
    assert.equal(idle.closed, "idle");
    assert.equal(idle.tasks?.length, 1);
    // …its files are the scans of a book: its images, numbered by their names
    const inputs = (JSON.parse(fs.readFileSync(meta, "utf8")) as { inputs: string[] }).inputs;
    await w.ok(["recordset", "add", "Matrika Týnec 1"]); // B1
    const added = await w.ok(["media", "add", "--from-input", inputs.join(","), "--recordset", "B0001"]);
    assert.match(added.out, /2 image\(s\) registered: M\d{4}–M\d{4} of B0001 \(images 12–13\)/);
    const one = (await w.ok(["input", "show", inputs[0]!, "--json"])).json.input;
    assert.equal(one.state, "processed");
    assert.equal(one.sorted.as, "source");
    assert.equal((await w.ok(["check"])).code, 0);
  } finally {
    await w.ok(["live", "stop"]);
    w.cleanup();
  }
});

test("a batch in an archive: kept, its sorting tasks put aside — nothing is sorted", opts, async () => {
  const w = new World();
  await w.ok(["setup", "--yes"]);
  await w.ok(["init", "Archiv", "--mode", "archive"]);
  w.cwd = w.treeDir("Archiv");
  const f = path.join(w.dir, "foto.png");
  fs.copyFileSync(path.join(fixtures, "png-bw.png"), f);
  const got = (await w.ok(["media", "original", f, "--batch", "a1b2c3d4-e5f6", "--path", "Fotky/foto.png", "--json"])).json;
  assert.match(got.input, /^I\d{4}$/);
  const done = (await w.ok(["input", "batch", "done", "a1b2c3d4-e5f6", "--name", "Fotky", "--json"])).json;
  assert.equal((await w.ok(["task", "show", done.tasks[0], "--json"])).json.task.state, "parked");
  const listed = (await w.ok(["input", "batch", "--json"])).json.batches;
  assert.equal(listed[0].state, "closed");
  w.cleanup();
});
