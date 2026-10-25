// The family's material written from the Strom app (spec 017 U4): the people a file is of added and taken off (POST
// /material/assign, strom input assign — all or nothing), files hidden and shown again (POST /material/hide, strom
// input hide | unskip), the list without its files (?files=0) with the people's names, small previews (GET
// /media/<sha>?thumb=), many files at once, and two writes at the same moment.

import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import { create } from "../../src/core/records.ts";
import { material } from "../../src/core/material.ts";
import { decodeImage, encodeImage } from "../../src/image/index.ts";
import { halves, jpegWithOrientation, makePdf } from "../image-samples.ts";
import type { Input, Task } from "../../src/core/model.ts";

const opts = { skip: !hasGit || process.platform === "win32" };
const app = { Origin: "https://beta.stromapp.info" };
const fixtures = path.join(import.meta.dirname, "..", "fixtures", "images");
const sha = (b: Buffer) => crypto.createHash("sha256").update(b).digest("hex");
const read = (f: string) => fs.readFileSync(path.join(fixtures, f));

function request(method: string, url: string, body?: Buffer, headers: Record<string, string> = {}): Promise<{ status: number; body: Buffer; headers: http.IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method, headers: { ...(body ? { "Content-Length": String(body.length) } : {}), ...headers } }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (d: Buffer) => chunks.push(d));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks), headers: res.headers }));
    });
    req.on("error", reject);
    req.end(body);
  });
}
const gitHead = (dir: string) => execFileSync("git", ["-C", dir, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const json = (r: { body: Buffer }) => JSON.parse(r.body.toString("utf8"));
const post = (url: string, body: unknown) => request("POST", url, Buffer.from(typeof body === "string" ? body : JSON.stringify(body)), { ...app, "Content-Type": "application/json" });

test("the material written from the app: people added and taken off all or nothing, a batch's people kept, hidden and shown again, the list without files, previews", opts, async () => {
  const w = new World();
  await w.ok(["setup", "--yes"]);
  await w.ok(["init", "Archiv", "--mode", "archive"]);
  w.cwd = w.treeDir("Archiv");
  await w.ok(["person", "add", "Žofie /Dvořáková/", "--sex", "F", "--born", "1890"]); // P1
  await w.ok(["person", "add", "Иван /Петров/", "--sex", "M"]); // P2
  await w.ok(["person", "add", "Jiří /Šťastný/".normalize("NFD"), "--sex", "M"]); // P3
  w.env.STROM_LIVE_POLL_MS = "100";
  const info = (await w.ok(["live", "start", "--json"])).json;
  try {
    const status = json(await request("GET", `${info.url}/status`));
    assert.ok(status.features.includes("material.assign"));
    assert.ok(status.features.includes("material.thumb"));

    const batch = "9e8d7c6b-5a4f-3e2d";
    const put = (b: Buffer, p: string, more: Record<string, string> = {}) =>
      request("PUT", `${info.url}/media/${sha(b)}`, b, { ...app, "X-Strom-Name": encodeURIComponent(path.basename(p)), ...more });
    const inBatch = (b: Buffer, p: string) => put(b, p, { "X-Strom-Batch": batch, "X-Strom-Path": encodeURIComponent(p) });
    const a = json(await inBatch(read("s0001.jpg"), "Babička/Dopisy/1946.jpg")).input;
    const b = json(await inBatch(read("png-bw.png"), "Babička/foto.png")).input;
    assert.equal((await post(`${info.url}/batch/${batch}/done`, { name: "Krabice", person: "P0001" })).status, 200);
    const c = json(await put(read("png-rgba.png"), "Ivan.png")).input;
    const d = json(await put(read("s0002.jpg"), "Svatba.jpg", { "X-Strom-Person": "P0002" })).input;

    // the list without its files: the batches whole, the people's names
    const lean = json(await request("GET", `${info.url}/material?files=0`));
    assert.deepEqual(lean.files, []);
    assert.equal(lean.batches[0].files, 2);
    assert.deepEqual(Object.keys(lean.people), ["P0001"], "the people of what it gives: its batches");
    assert.match(lean.people.P0001, /^Žofie Dvořáková \(.*1890.*\)$/u);
    assert.equal(json(await request("GET", `${info.url}/material?files=2`)).code, "material.query");
    assert.equal((await request("GET", `${info.url}/material?files=2`)).status, 400);
    const full = json(await request("GET", `${info.url}/material`));
    assert.equal(full.people.P0002, "Иван Петров");
    assert.equal(full.people.P0003, undefined, "only the people the files are of");

    // added to three files at once: written, answered with the files as the list gives them
    const head = gitHead(w.cwd);
    const added = await post(`${info.url}/material/assign`, { files: [a, c, d], add: ["P0002", "p0003"] });
    assert.equal(added.status, 200, added.body.toString());
    const got = json(added);
    assert.deepEqual(got.files.map((f: { id: string }) => f.id), [a, c, d]);
    assert.deepEqual(got.files.find((f: { id: string }) => f.id === c).persons, ["P0002", "P0003"]);
    assert.deepEqual(got.files.find((f: { id: string }) => f.id === d).persons, ["P0002", "P0003"]);
    assert.equal(got.people.P0003, "Jiří Šťastný", "NFC, as the research keeps it");
    assert.deepEqual(got.kept, []);
    assert.match(got.head, /^[0-9a-f]{7,}$/);
    assert.notDeepEqual(gitHead(w.cwd), head);
    // the same again: nothing written
    const twice = gitHead(w.cwd);
    assert.equal((await post(`${info.url}/material/assign`, { files: [a, c, d], add: ["P0002"] })).status, 200);
    assert.deepEqual(gitHead(w.cwd), twice);

    // all or nothing: a person or a file the research has not — refused, nothing written
    const before = json(await request("GET", `${info.url}/material`));
    const nobody = await post(`${info.url}/material/assign`, { files: [a, c], add: ["P0001", "P0099"] });
    assert.equal(nobody.status, 404);
    assert.deepEqual([json(nobody).code, json(nobody).params], ["material.person", { id: "P0099" }]);
    const nofile = await post(`${info.url}/material/assign`, { files: [c, "I0099"], add: ["P0001"] });
    assert.equal(nofile.status, 404);
    assert.deepEqual([json(nofile).code, json(nofile).params], ["material.file", { id: "I0099" }]);
    const nobatch = await post(`${info.url}/material/assign`, { batch: "0000aaaa-bbbb", remove: ["P0001"] });
    assert.deepEqual([nobatch.status, json(nobatch).code], [404, "material.batch"]);
    for (const bad of [{ add: ["P0001"] }, { files: [c], batch, add: ["P0001"] }, { files: [c] }, { files: [c], add: ["Žofie"] }, { files: [], add: ["P0001"] }, { files: [c], add: ["P0001"], remove: ["P0001"] }, "[1]", "{"]) {
      const r = await post(`${info.url}/material/assign`, bad);
      assert.deepEqual([r.status, json(r).code], [400, "material.body"], JSON.stringify(bad));
    }
    assert.deepEqual(json(await request("GET", `${info.url}/material`)), before);
    // only the app writes
    assert.equal((await request("POST", `${info.url}/material/assign`, Buffer.from(JSON.stringify({ files: [c], add: ["P0001"] })))).status, 403);

    // taken off a file of a batch that is hers: she stays, said
    const off = json(await post(`${info.url}/material/assign`, { files: [a, b], remove: ["P0001", "P0002"] }));
    assert.deepEqual(off.kept, [
      { id: a, person: "P0001", batch },
      { id: b, person: "P0001", batch },
    ]);
    assert.deepEqual(off.files.find((f: { id: string }) => f.id === a).persons, ["P0003"]);
    // the batch: hers no more, and its files with it
    const fromBatch = json(await post(`${info.url}/material/assign`, { batch, remove: ["P0001"] }));
    assert.deepEqual(fromBatch.kept, []);
    assert.deepEqual(json(await request("GET", `${info.url}/material?files=0`)).batches[0].persons, []);
    assert.deepEqual(json(await request("GET", `${info.url}/material?person=P0001`)).files, []);
    // back (the app's Undo)
    assert.equal((await post(`${info.url}/material/assign`, { batch, add: ["P0001"] })).status, 200);
    assert.deepEqual(json(await request("GET", `${info.url}/material?files=0`)).batches[0].persons, ["P0001"]);

    // hidden: kept in the list as hidden, the person's; shown again: as it was
    const hid = await post(`${info.url}/material/hide`, { files: [c, d], hidden: true, reason: "duplicate" });
    assert.equal(hid.status, 200, hid.body.toString());
    const hf = json(hid).files.find((f: { id: string }) => f.id === c);
    assert.equal(hf.state, "skipped");
    assert.equal(hf.hidden.by, "app");
    assert.equal(hf.hidden.reason, "duplicate");
    const listed = json(await request("GET", `${info.url}/material`)).files;
    assert.equal(listed.length, 4, "hidden files stay in the list");
    assert.equal(json(await request("GET", `${info.url}/material?person=P0002`)).files.length, 2, "a person's hidden files too");
    assert.ok(listed.find((f: { id: string }) => f.id === d).hidden);
    assert.deepEqual([(await post(`${info.url}/material/hide`, { files: [c], hidden: true, reason: "lost" })).status], [400]);
    assert.deepEqual([(await post(`${info.url}/material/hide`, { files: [c] })).status], [400]);
    const shown = json(await post(`${info.url}/material/hide`, { files: [c, d], hidden: false }));
    for (const f of shown.files) {
      assert.equal(f.state, "new");
      assert.equal(f.hidden, undefined);
    }
    assert.equal(Tree.open(w.cwd, w.env).get<Input>(c)!.hidden, undefined);

    // previews: a JPEG at most the size asked, kept and given again
    const jpg = sha(read("s0002.jpg"));
    const t1 = await request("GET", `${info.url}/media/${jpg}?thumb=128`);
    assert.equal(t1.status, 200, t1.body.toString());
    assert.equal(t1.headers["content-type"], "image/jpeg");
    assert.equal(t1.headers["cache-control"], "private, max-age=86400");
    const small = decodeImage(new Uint8Array(t1.body));
    assert.equal(Math.max(small.width, small.height), 128);
    assert.ok(fs.existsSync(path.join(w.cwd, ".strom", "thumbs", `${jpg}-128.jpg`)));
    const t2 = await request("GET", `${info.url}/media/${jpg}?thumb=128`);
    assert.ok(t2.body.equals(t1.body));
    // the same one asked many times at once: made once, each answered
    const many = await Promise.all([256, 256, 256, 512].map((px) => request("GET", `${info.url}/media/${sha(read("png-rgba.png"))}?thumb=${px}`)));
    assert.deepEqual(many.map((r) => r.status), [200, 200, 200, 200]);
    assert.ok(many[0]!.body.equals(many[2]!.body));
    const png = decodeImage(new Uint8Array(many[3]!.body));
    assert.ok(Math.max(png.width, png.height) <= 512);
    // a photo lying on its side: the preview turned as it is shown; a PDF of scans: its first page
    const lying = Buffer.from(jpegWithOrientation(halves(80, 40), 6));
    assert.equal((await put(lying, "na boku.jpg")).status, 200);
    const turned = decodeImage(new Uint8Array((await request("GET", `${info.url}/media/${sha(lying)}?thumb=128`)).body));
    assert.deepEqual([turned.width, turned.height], [40, 80]);
    const pdf = Buffer.from(makePdf([{ jpeg: { bytes: encodeImage(halves(600, 800), "jpeg", 90), width: 600, height: 800 } }, { jpeg: { bytes: encodeImage(halves(60, 80), "jpeg", 90), width: 60, height: 80 } }]));
    const pp = await put(pdf, "Křestní list.pdf");
    assert.equal(pp.status, 200, pp.body.toString());
    const page = await request("GET", `${info.url}/media/${sha(pdf)}?thumb=256`);
    assert.equal(page.status, 200, page.body.toString());
    const pageImg = decodeImage(new Uint8Array(page.body));
    assert.deepEqual([pageImg.width, pageImg.height], [192, 256]);
    // a size not offered, a content unknown, a file not on this computer
    assert.deepEqual([(await request("GET", `${info.url}/media/${jpg}?thumb=100`)).status, json(await request("GET", `${info.url}/media/${jpg}?thumb=100`)).code], [400, "thumb.size"]);
    assert.equal((await request("GET", `${info.url}/media/${"0".repeat(64)}?thumb=256`)).status, 404);
    // a kind with no preview here: the app shows its icon
    const gif = Buffer.concat([Buffer.from("GIF89a"), Buffer.from([1, 0, 1, 0, 0, 0, 0, 0x2c, 0, 0, 0, 0, 1, 0, 1, 0, 0, 2, 2, 0x44, 1, 0, 0x3b])]);
    const g = await put(gif, "obrázek.gif");
    assert.equal(g.status, 200, g.body.toString());
    const r = await request("GET", `${info.url}/media/${sha(gif)}?thumb=256`);
    assert.deepEqual([r.status, json(r).code], [415, "thumb.type"]);
    const shared = path.join(w.home, "shared");
    const stored = fs.readdirSync(path.join(shared, "media"), { recursive: true }).map(String).find((n) => n.includes(sha(read("png-bw.png"))));
    fs.rmSync(path.join(shared, "media", stored!));
    const gone = await request("GET", `${info.url}/media/${sha(read("png-bw.png"))}?thumb=256`);
    assert.deepEqual([gone.status, json(gone).code], [410, "media.gone"]);

    // two writes at the same moment: one written, the other asked again later (409, Retry-After)
    const [x, y] = await Promise.all([post(`${info.url}/material/assign`, { files: [c], add: ["P0001"] }), post(`${info.url}/material/assign`, { files: [d], add: ["P0001"] })]);
    const statuses = [x.status, y.status].sort();
    assert.deepEqual(statuses, [200, 409]);
    const refusedOne = x.status === 409 ? x : y;
    assert.equal(json(refusedOne).code, "material.busy");
    assert.ok(Number(refusedOne.headers["retry-after"]) > 0);
    assert.equal((await w.ok(["check", "--json"])).json.ok, true);
  } finally {
    await w.ok(["live", "stop"]);
  }
  w.cleanup();
});

test("hidden in a research with an agent: the task at it given up, shown again it gets one; a skip taken back; a title and a date said by sorting", opts, async () => {
  const w = new World();
  await w.withTree();
  await w.ok(["person", "add", "Žofie /Dvořáková/", "--sex", "F"]); // P1
  const dir = path.join(w.cwd, "inputs-in", "Krabice");
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(path.join(fixtures, "s0001.jpg"), path.join(dir, "dopis.jpg"));
  fs.copyFileSync(path.join(fixtures, "s0002.jpg"), path.join(dir, "svatba.jpg"));
  const got = (await w.ok(["intake", dir, "--json"])).json;
  const [a, b] = got.inputs.map((i: { id: string }) => i.id);
  const tasksAt = (id: string) => Tree.open(w.cwd, w.env).list<Task>("task").filter((t) => t.where.includes(id) && t.state !== "done" && t.state !== "dropped");
  assert.equal(tasksAt(a).length, 1);
  const task = tasksAt(a)[0]!.id;

  // one hidden: the task lets it go; both: given up
  await w.ok(["input", "hide", a, "--why", "unrelated"]);
  assert.deepEqual(Tree.open(w.cwd, w.env).get<Task>(task)!.where.filter((x) => x.startsWith("I")), [b]);
  await w.ok(["input", "hide", "--files-from", "-"], { stdin: `${b}\n` });
  assert.equal(Tree.open(w.cwd, w.env).get<Task>(task)!.state, "dropped");
  const hidden = Tree.open(w.cwd, w.env).get<Input>(a)!;
  assert.equal(hidden.state, "skipped");
  assert.deepEqual([hidden.hidden?.reason, hidden.hidden?.was], ["unrelated", "new"]);
  assert.equal((await w.run(["input", "hide", a, "--why", "nic"])).code, 2);

  // shown again: waiting, and a task at it
  const back = (await w.ok(["input", "unskip", a, "--json"])).json;
  assert.deepEqual(back.changed, [a]);
  assert.equal(back.tasks.length, 1);
  assert.equal(Tree.open(w.cwd, w.env).get<Input>(a)!.state, "new");
  assert.equal(tasksAt(a).length, 1);
  assert.deepEqual((await w.ok(["input", "unskip", a, "--json"])).json.changed, [], "not hidden: nothing");

  // a file a source was made of: shown again as processed, no task
  await w.ok(["input", "done", b]);
  await w.ok(["input", "hide", b]);
  const again = (await w.ok(["input", "unskip", b, "--json"])).json;
  assert.deepEqual(again.tasks, []);
  assert.equal(Tree.open(w.cwd, w.env).get<Input>(b)!.state, "processed");

  // an old skip taken back the same way
  await w.ok(["input", "skip", b, "--reason", "rozmazané"]);
  assert.match((await w.ok(["input", "skip", b, "--reason", "znovu"])).out, /strom input unskip/u);
  await w.ok(["input", "unskip", b]);
  assert.equal(Tree.open(w.cwd, w.env).get<Input>(b)!.state, "processed");

  // assigned from the command line: the waiting file's task is hers too
  const assigned = (await w.ok(["input", "assign", a, "--add", "P1", "--json"])).json;
  assert.deepEqual(assigned.changed, [a]);
  assert.ok(Tree.open(w.cwd, w.env).get<Task>(back.tasks[0])!.subject.includes("P0001"));
  assert.equal((await w.run(["input", "assign", a, "--add", "P0099", "--json"])).json.code, "material.person");
  assert.equal((await w.run(["input", "assign", "I0099", "--add", "P1", "--json"])).json.code, "material.file");

  // sorting says what to call it and when (NFD in, NFC kept; a date as GEDCOM has it)
  await w.ok(["input", "sort", a, "--as", "photo", "--person", "P0001", "--title", "Svatba v Třeboni".normalize("NFD"), "--date", "abt 1930"]);
  const sorted = Tree.open(w.cwd, w.env).get<Input>(a)!;
  assert.equal(sorted.title, "Svatba v Třeboni");
  assert.equal(sorted.date, "ABT 1930");
  const m = material(Tree.open(w.cwd, w.env), undefined, { ids: [a] });
  assert.deepEqual([m.files[0]!.title, m.files[0]!.kind, m.files[0]!.date], ["Svatba v Třeboni", "photo", "ABT 1930"]);
  assert.equal((await w.run(["input", "sort", a, b, "--as", "photo", "--title", "Dvě"])).code, 2, "a title: one file");
  assert.equal((await w.run(["input", "sort", a, "--as", "photo", "--date", "loni"])).code, 2);
  assert.equal((await w.ok(["check", "--json"])).json.ok, true);
  w.cleanup();
});

test("many files at once: 3 000 assigned from a list in one write, the list of the material read quickly", opts, async () => {
  const w = new World();
  await w.withTree();
  await w.ok(["person", "add", "Žofie /Dvořáková/", "--sex", "F"]); // P1
  const tree = Tree.open(w.cwd, w.env);
  const ids: string[] = [];
  tree.withTreeLock(() => {
    for (let n = 0; n < 3000; n++) {
      const s = crypto.createHash("sha256").update(String(n)).digest("hex");
      ids.push(create<Input>(tree, "input", { name: `sken-${n}.jpg`, file: `inputs/sken-${n}.jpg`, sha: s, kind: "photo", state: "new", from: "app" }, (id) => `+${id}`).id);
    }
    tree.commit("3000 files");
  });
  const t0 = Date.now();
  const got = (await w.ok(["input", "assign", "--files-from", "-", "--add", "P1", "--json"], { stdin: ids.join("\n") })).json;
  const took = Date.now() - t0;
  assert.equal(got.changed.length, 3000);
  assert.ok(took < 60_000, `${took} ms`);
  const t1 = Date.now();
  const all = material(Tree.open(w.cwd, w.env), undefined, { person: "P0001" });
  assert.equal(all.files.length, 3000);
  assert.ok(Date.now() - t1 < 5_000, `${Date.now() - t1} ms`);
  assert.deepEqual(material(Tree.open(w.cwd, w.env), undefined, { files: false }).files, []);
  // more than the bridge takes at once: said
  assert.equal((await w.run(["input", "assign", "--files-from", "-", "--add", "P1", "--json"], { stdin: [...ids, ...ids.map((i) => i.replace(/^I0*/, "I9"))].join("\n") })).json.code, "material.body");
  w.cleanup();
});

test("every write of the app's answers the head after it and its parent, the head just before it — nothing written: the same; a commit of another between: the app's known head is no parent", opts, async () => {
  const w = new World();
  await w.ok(["setup", "--yes"]);
  await w.ok(["init", "Archiv", "--mode", "archive"]);
  w.cwd = w.treeDir("Archiv");
  await w.ok(["person", "add", "Žofie /Dvořáková/", "--sex", "F", "--born", "1890"]); // P1
  await w.ok(["person", "add", "Иван /Петров/", "--sex", "M"]); // P2
  const info = (await w.ok(["live", "start", "--json"])).json;
  try {
    const parentOf = (h: string) => execFileSync("git", ["-C", w.cwd, "rev-parse", `${h}^`], { encoding: "utf8" }).trim();
    /** One write: its head is the research's now, its parent the head before it (and the head's parent, when it wrote). */
    const wrote = (r: { status: number; body: Buffer }, before: string, written: boolean) => {
      assert.equal(r.status, 200, r.body.toString());
      const j = json(r);
      assert.equal(j.head, gitHead(w.cwd), r.body.toString());
      assert.equal(j.parent, before, r.body.toString());
      if (written) assert.equal(parentOf(j.head), j.parent);
      else assert.equal(j.head, j.parent, "nothing written: parent is head");
      assert.equal(j.commit, undefined, "the command's own commit field never passed on");
      return j;
    };
    const batch = "1a2b3c4d-5e6f";
    const put = (b: Buffer, p: string, more: Record<string, string> = {}) => request("PUT", `${info.url}/media/${sha(b)}`, b, { ...app, "X-Strom-Name": encodeURIComponent(p), ...more });
    let known = gitHead(w.cwd);
    const c = wrote(await put(read("png-rgba.png"), "Ivan.png", { "X-Strom-Person": "P0002" }), known, true).input as string;
    known = gitHead(w.cwd);
    wrote(await put(read("s0001.jpg"), "Dopis.jpg", { "X-Strom-Batch": batch, "X-Strom-Path": encodeURIComponent("Krabice/Dopis.jpg") }), known, true);
    known = gitHead(w.cwd);
    wrote(await post(`${info.url}/batch/${batch}/done`, { name: "Krabice", person: "P0001" }), known, true);
    known = gitHead(w.cwd);
    wrote(await post(`${info.url}/material/assign`, { files: [c], add: ["P0001"] }), known, true);
    // the same again: nothing written, parent = head
    known = gitHead(w.cwd);
    wrote(await post(`${info.url}/material/assign`, { files: [c], add: ["P0001"] }), known, false);
    known = gitHead(w.cwd);
    wrote(await post(`${info.url}/material/hide`, { files: [c], hidden: true, reason: "duplicate" }), known, true);
    // the research changed in the terminal after the app last looked: the parent is that change, not the app's head
    const appKnew = gitHead(w.cwd);
    await w.ok(["person", "add", "Jiří /Šťastný/", "--sex", "M"]);
    const terminal = gitHead(w.cwd);
    const shown = wrote(await post(`${info.url}/material/hide`, { files: [c], hidden: false }), terminal, true);
    assert.notEqual(shown.parent, appKnew);
    // a file the research has, sent again with nothing to add (its person, none, in a batch): parent = head
    known = gitHead(w.cwd);
    const again = wrote(await put(read("png-rgba.png"), "Ivan.png", { "X-Strom-Person": "P0002" }), known, false);
    assert.equal(again.known, c);
    assert.equal(wrote(await put(read("png-rgba.png"), "Ivan.png"), known, false).known, c);
    const inBatch = wrote(await put(read("png-rgba.png"), "Ivan.png", { "X-Strom-Batch": "7f8e9d0c-1b2a", "X-Strom-Path": encodeURIComponent("Další/Ivan.png") }), known, false);
    assert.equal(inBatch.known, c);
    assert.equal(inBatch.batch, "7f8e9d0c-1b2a");
    // a person it lacks: added, written on the head before it
    wrote(await put(read("png-rgba.png"), "Ivan.png", { "X-Strom-Person": "P0003" }), known, true);
    // sent again after a commit in the terminal: the parent is that commit, never the head the app knew
    const before = gitHead(w.cwd);
    await w.ok(["person", "add", "Олена /Петрова/", "--sex", "F"]);
    const late = wrote(await put(read("png-rgba.png"), "Ivan.png"), gitHead(w.cwd), false);
    assert.notEqual(late.parent, before);
  } finally {
    await w.ok(["live", "stop"]);
    w.cleanup();
  }
});
