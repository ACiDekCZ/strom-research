// Originals from the Strom app through the bridge: PUT <token>/media/<sha256> — streamed to disk, its hash checked,
// kept outside git; material of a person an input with an intake task, an image of a source with the part the entry
// is on; the same content only said; what is not a record's or too large refused; an archive's tasks put aside.

import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { World, hasGit } from "../helpers.ts";

const opts = { skip: !hasGit || process.platform === "win32" };
const app = { Origin: "https://beta.stromapp.info" };
const fixtures = path.join(import.meta.dirname, "..", "fixtures", "images");
const sha = (b: Buffer) => crypto.createHash("sha256").update(b).digest("hex");

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
const json = (r: { body: Buffer }) => JSON.parse(r.body.toString("utf8"));

test("originals from the app: material of a person an input outside git with one intake task, the same content only said, the file given back; refused what is not the app's, not the file named, not a record's kind, too large", opts, async () => {
  const w = new World();
  await w.withTree();
  await w.ok(["lang", "cs"]);
  await w.ok(["person", "add", "Josef /Novák/", "--sex", "M"]); // P1
  w.env.STROM_MEDIA_MAX_BYTES = String(2 * 1024 * 1024);
  w.env.CLAUDECODE = "1";
  // the bridge started from an agent's shell: what the app sends through it is still the person's
  const info = (await w.ok(["live", "start", "--json"])).json;
  delete w.env.CLAUDECODE;
  try {
    const status = json(await request("GET", `${info.url}/status`));
    assert.equal(status.accepts.media.max, 2 * 1024 * 1024);
    assert.ok(status.accepts.media.types.some((t: { mime: string }) => t.mime === "image/tiff"));
    assert.ok(status.accepts.media.types.some((t: { mime: string }) => t.mime === "image/heic"));
    assert.equal(status.accepts.media.tasks, "open");
    assert.ok(status.accepts.media.free > 0);
    assert.equal(status.inbox.material, 0);
    const pre = await request("OPTIONS", `${info.url}/media/${"a".repeat(64)}`, undefined, { ...app, "Access-Control-Request-Method": "PUT", "Access-Control-Request-Headers": "x-strom-name,x-strom-person" });
    assert.match(String(pre.headers["access-control-allow-methods"]), /PUT/);

    const jpg = fs.readFileSync(path.join(fixtures, "s0001.jpg"));
    const png = fs.readFileSync(path.join(fixtures, "png-bw.png"));
    const send = (b: Buffer, h: Record<string, string>, s = sha(b)) => request("PUT", `${info.url}/media/${s}`, b, { ...app, "Content-Type": "application/octet-stream", ...h });
    // each refusal: its English sentence as before, and a code with its params the app says in the person's language
    const coded = (r: { body: Buffer }) => [json(r).code, json(r).params];
    const notApp = await request("PUT", `${info.url}/media/${sha(jpg)}`, jpg);
    assert.equal(notApp.status, 403, "not from the app's pages");
    assert.deepEqual(coded(notApp), ["app.only", undefined]);
    const noPerson = await send(jpg, { "X-Strom-Person": "P0099" });
    assert.equal(noPerson.status, 404, "a person the research does not have");
    assert.equal(json(noPerson).error, "no person P0099 in this research");
    assert.deepEqual(coded(noPerson), ["media.no-person", { person: "P0099" }]);
    const noSource = await send(jpg, { "X-Strom-Source": "S0042" });
    assert.equal(noSource.status, 404, "a source the research does not have");
    assert.equal(json(noSource).error, "no source S0042 in this research");
    assert.deepEqual(coded(noSource), ["media.no-source", { source: "S0042" }]);
    const badHeader = await send(jpg, { "X-Strom-Person": "Josef" });
    assert.equal(badHeader.status, 400);
    assert.deepEqual(coded(badHeader), ["media.bad-header", { header: "X-Strom-Person" }]);
    const badRegion = await send(jpg, { "X-Strom-Person": "P0001", "X-Strom-Region": "1,2" });
    assert.equal(badRegion.status, 400);
    assert.deepEqual(coded(badRegion), ["media.bad-region", { region: "1,2" }]);
    const noSha = await request("PUT", `${info.url}/media/abc`, jpg, app);
    assert.deepEqual([noSha.status, json(noSha).code], [400, "media.bad-sha"]);
    const other = await send(jpg, { "X-Strom-Person": "P0001" }, "b".repeat(64));
    assert.equal(other.status, 409, "not the file its address names");
    assert.deepEqual(coded(other), ["media.sha-differs", { sha: "b".repeat(64) }]);
    const exe = Buffer.concat([Buffer.from("MZ"), Buffer.alloc(2000)]);
    const bad = await send(exe, { "X-Strom-Name": "setup.exe", "X-Strom-Person": "P0001" });
    assert.equal(bad.status, 415);
    assert.match(json(bad).error, /not a kind of file the research takes/);
    assert.deepEqual(coded(bad), ["media.type", { name: "setup.exe" }]);
    const short = await send(jpg.subarray(0, jpg.length - 4096), { "X-Strom-Name": "kus.jpg", "X-Strom-Person": "P0001" });
    assert.equal(short.status, 422);
    assert.deepEqual(coded(short), ["media.cut-short", { name: "kus.jpg", kind: "JPEG" }]);
    assert.ok(status.features.includes("media.codes"), "the bridge says its refusals carry codes");
    const big = Buffer.concat([jpg, Buffer.alloc(3 * 1024 * 1024)]);
    const large = await send(big, { "X-Strom-Person": "P0001" });
    assert.equal(large.status, 413);
    assert.match(json(large).error, /větší, než výzkum z aplikace přijme \(2 MB\)/);
    assert.deepEqual([json(large).code, json(large).params], ["media.large", { mb: "2" }]);

    const one = await send(jpg, { "X-Strom-Name": encodeURIComponent("dopis babičky.jpg"), "X-Strom-Person": "P0001", "X-Strom-Note": encodeURIComponent("z krabice od babičky") });
    assert.equal(one.status, 200, one.body.toString());
    const got = json(one);
    assert.match(got.input, /^I\d{4}$/);
    assert.match(got.task, /^T\d{4}$/);
    const two = json(await send(png, { "X-Strom-Name": "foto.png", "X-Strom-Person": "P0001" }));
    assert.equal(two.task, got.task, "what came for the same person a while ago shares its task");
    assert.deepEqual(json(await send(jpg, { "X-Strom-Person": "P0001" })), { known: got.input, kind: "input" }, "the same content: only said");

    const input = (await w.ok(["input", "show", got.input, "--json"])).json;
    assert.equal(input.input.name, "dopis babičky.jpg");
    assert.deepEqual(input.input.persons, ["P0001"]);
    assert.match(input.input.file, /^media:media\/..\/..\/[0-9a-f]{64}\.jpg$/);
    assert.deepEqual(fs.readFileSync(input.path), jpg, "unchanged");
    assert.equal(input.input.notes[0].text, "z krabice od babičky");
    assert.equal(input.input.notes[0].by, "user", "the person's note in the app, not an agent's");
    const ops = execFileSync("git", ["log", "-1", "--format=%B", "--", "."], { cwd: w.cwd, encoding: "utf8" });
    assert.doesNotMatch(ops, /\bagent\b/, ops);
    const task = (await w.ok(["task", "show", got.task, "--json"])).json.task;
    assert.equal(task.level, "intake");
    assert.deepEqual(task.where, [got.input, two.input]);
    assert.ok(task.subject.includes("P0001"));
    assert.match(task.what, /aplikace Strom: 2 – Josef Novák \[P0001\]/);
    // …said of again with more — another person, a new note of the user's: added to the input (its task still at hand)
    await w.ok(["person", "add", "Marie /Nováková/", "--sex", "F"]); // P2
    const again = json(await send(jpg, { "X-Strom-Person": "P0002", "X-Strom-Note": encodeURIComponent("psala ho Marie sestře") }));
    assert.deepEqual({ ...again, head: undefined }, { known: got.input, kind: "input", added: { persons: ["P0002"], note: true }, head: undefined }, JSON.stringify(again));
    const amended = (await w.ok(["input", "show", got.input, "--json"])).json.input;
    assert.deepEqual(amended.persons, ["P0001", "P0002"]);
    assert.deepEqual(amended.notes.map((n: { text: string; by: string }) => [n.text, n.by]), [["z krabice od babičky", "user"], ["psala ho Marie sestře", "user"]]);
    assert.deepEqual(json(await send(jpg, { "X-Strom-Person": "P0002", "X-Strom-Note": encodeURIComponent("psala ho Marie sestře") })), { known: got.input, kind: "input" }, "nothing new: nothing written");
    const tracked = execFileSync("git", ["ls-files"], { cwd: w.cwd, encoding: "utf8" });
    assert.doesNotMatch(tracked, /\.(jpg|png)$|^inputs\/(?!\.gitkeep)/m, "nothing of it in git");
    assert.equal(fs.readdirSync(path.join(path.dirname(path.dirname(input.path)), "..", ".incoming")).length, 0, "nothing left half-way");
    const after = json(await request("GET", `${info.url}/status`));
    assert.equal(after.inbox.material, 2);
    assert.ok(after.queue.some((q: { id: string; person?: string }) => q.id === got.task && q.person === "P0001"));

    // what the research has: said, and given back
    assert.deepEqual(json(await request("GET", `${info.url}/media/${sha(jpg)}`)), { known: got.input, kind: "input", mime: "image/jpeg", bytes: jpg.length, name: "dopis babičky.jpg", here: true });
    const file = await request("GET", `${info.url}/media/${sha(jpg)}?file=1`);
    assert.equal(file.headers["content-type"], "image/jpeg");
    assert.deepEqual(file.body, jpg);
    assert.equal((await request("GET", `${info.url}/media/${"c".repeat(64)}`)).status, 404);
    // …and through a link, in the viewer of the system
    const id = JSON.parse(fs.readFileSync(path.join(w.cwd, "strom.json"), "utf8")).id;
    const link = await w.ok(["link", "open", `strom-research://media?tree=${id}&sha=${sha(jpg)}`, "--json"]);
    assert.equal(link.json.file, input.path);
    assert.equal((await w.ok(["check"])).code, 0);
  } finally {
    await w.ok(["live", "stop"]);
    w.cleanup();
  }
});

test("the scan of a source from the app: an image of it with the part the entry is on as its clip, a task to read the record the research has not read; tree.ged names its original; an archive's task put aside", opts, async () => {
  const w = new World();
  await w.withTree();
  await w.ok(["lang", "cs"]);
  await w.ok(["person", "add", "Josef /Novák/", "--sex", "M"]); // P1
  // a source the user transcribed in the app (the research has not read it): from a sync
  const ged = path.join(w.dir, "strom.ged");
  await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", ged]);
  const t = fs
    .readFileSync(ged, "utf8")
    .replace(/(1 REFN P0001\r?\n2 TYPE strom-research\r?\n)/, "$11 BIRT\n2 DATE 2 MAR 1885\n2 PLAC Kamenice\n2 SOUR @X9@\n3 PAGE fol. 12\n")
    .replace(/(0 @U1@ SUBM)/, "0 @X9@ SOUR\n1 TITL Narození Josefa Nováka 1885\n1 TEXT Josef, syn Jana Nováka.\n$1");
  fs.writeFileSync(path.join(w.dir, "z-aplikace.ged"), t);
  await w.ok(["sync", path.join(w.dir, "z-aplikace.ged"), "--apply"]);
  const source = "S0002";
  assert.equal((await w.ok(["source", "show", source, "--json"])).json.source.title, "Narození Josefa Nováka 1885");
  const info = (await w.ok(["live", "start", "--json"])).json;
  try {
    // a phone's photo: it lies in its file on its side (EXIF orientation 6)
    const plain = fs.readFileSync(path.join(fixtures, "s0002.jpg"));
    const exif = Buffer.from([0xff, 0xe1, 0x00, 0x22, ...Buffer.from("Exif\0\0", "latin1"), ...Buffer.from("MM\0*", "latin1"), 0, 0, 0, 8, 0, 1, 0x01, 0x12, 0, 3, 0, 0, 0, 1, 0, 6, 0, 0, 0, 0, 0, 0]);
    const jpg = Buffer.concat([plain.subarray(0, 2), exif, plain.subarray(2)]);
    const { exifOrientation } = await import("../../src/image/index.ts");
    const probe = path.join(w.dir, "probe.jpg");
    fs.writeFileSync(probe, jpg);
    assert.equal(exifOrientation(probe), 6);
    assert.equal(exifOrientation(path.join(fixtures, "s0002.jpg")), undefined);
    const r = await request("PUT", `${info.url}/media/${sha(jpg)}`, jpg, { ...app, "X-Strom-Name": "sken.jpg", "X-Strom-Source": source, "X-Strom-Region": "0.1,0.2,0.5,0.3" });
    assert.equal(r.status, 200, r.body.toString());
    const got = json(r);
    assert.match(got.media, /^M\d{4}$/);
    assert.equal(got.source, source);
    assert.equal(got.clip, true);
    const s = (await w.ok(["source", "show", source, "--json"])).json.source;
    assert.deepEqual(s.media, [got.media]);
    assert.deepEqual(s.clips, [{ media: got.media, region: { x: 0.1, y: 0.2, w: 0.5, h: 0.3 } }]);
    // the task to read what the user transcribed is there (the sync made it): it reads the scan, none again
    assert.equal(got.task, undefined);
    const tasks = (await w.ok(["task", "list", "--json"])).json.tasks.filter((x: { level: string }) => x.level === "verify");
    assert.equal(tasks.length, 1);
    // a scan of a source with no such task: one to read it
    const jpg2 = fs.readFileSync(path.join(fixtures, "s0003.jpg"));
    await w.ok(["task", "drop", tasks[0].id, "--reason", "test"]);
    const r2 = json(await request("PUT", `${info.url}/media/${sha(jpg2)}`, jpg2, { ...app, "X-Strom-Name": "sken-2.jpg", "X-Strom-Source": source }));
    assert.equal(r2.clip, undefined, "the source has its clip");
    const task = (await w.ok(["task", "show", r2.task, "--json"])).json.task;
    assert.equal(task.level, "verify");
    assert.ok(task.subject.includes(source) && task.subject.includes("P0001"), JSON.stringify(task.subject));
    assert.deepEqual(task.where, [r2.media, source]);
    // the research names the original of each excerpt it gives the app
    await w.ok(["config", "set", "excerpts.for", "all"]);
    const tree = (await request("GET", `${info.url}/tree.ged?app=3.9.0`)).body.toString("utf8");
    assert.match(tree, new RegExp(`2 _STROM_KIND excerpt[\\s\\S]*?2 _STROM_SHA ${sha(jpg)}\\r?\\n2 _STROM_ORIENT 6`), "cut as it lies: the app turns it");
    // an app that does not turn it (one older than 3.9 says no version): turned already, nothing to say
    const older = (await request("GET", `${info.url}/tree.ged`)).body.toString("utf8");
    assert.doesNotMatch(older, /_STROM_ORIENT/);
    const { imageSize } = await import("../../src/image/index.ts");
    const excerptOf = (ged: string) => {
      const m = ged.match(new RegExp(`2 FILE data:image/jpeg;base64,([^\\n]*)((?:\\n3 CONC [^\\n]*)*)\\n(?:2 _URL [^\\n]*\\n)?2 _STROM_SHA ${sha(jpg)}`))!;
      return imageSize(Buffer.from(m[1]! + m[2]!.replace(/\n3 CONC /g, ""), "base64"))!;
    };
    const [as, shown] = [excerptOf(tree), excerptOf(older)];
    assert.deepEqual([shown.width, shown.height], [as.height, as.width], "turned a quarter");
    assert.equal((await w.ok(["check"])).code, 0);
  } finally {
    await w.ok(["live", "stop"]);
  }

  // an archive: what comes waits put aside, nobody works on it
  await w.ok(["init", "Archiv", "--mode", "archive"]);
  w.cwd = w.treeDir("Archiv");
  await w.ok(["person", "add", "Anna /Dvořáková/", "--sex", "F"]);
  const arch = (await w.ok(["live", "start", "--json"])).json;
  try {
    assert.equal(json(await request("GET", `${arch.url}/status`)).accepts.media.tasks, "parked");
    const png = fs.readFileSync(path.join(fixtures, "png-rgba.png"));
    const got = json(await request("PUT", `${arch.url}/media/${sha(png)}`, png, { ...app, "X-Strom-Name": "foto.png", "X-Strom-Person": "P0001" }));
    const task = (await w.ok(["task", "show", got.task, "--json"])).json.task;
    assert.equal(task.state, "parked");
    assert.deepEqual((await request("GET", `${arch.url}/media/${sha(png)}?file=1`)).body, png, "the original opens from the archive");
  } finally {
    await w.ok(["live", "stop"]);
    w.cleanup();
  }
});

test("an input the research worked through, said of again with more: added, back in an intake task; nothing new, nothing written", opts, async () => {
  const w = new World();
  await w.withTree();
  await w.ok(["person", "add", "Josef /Novák/", "--sex", "M"]); // P1
  await w.ok(["person", "add", "Marie /Nováková/", "--sex", "F"]); // P2
  const file = path.join(w.dir, "dopis.jpg");
  fs.copyFileSync(path.join(fixtures, "s0001.jpg"), file);
  const first = (await w.ok(["media", "original", file, "--person", "P0001", "--json"])).json;
  await w.ok(["task", "drop", first.task, "--reason", "přečteno"]);
  await w.ok(["input", "done", first.input]);
  const again = (await w.ok(["input", "amend", first.input, "--person", "P0002", "--note", "Мария писала сестре", "--json"])).json;
  assert.deepEqual(again.added, { persons: ["P0002"], note: true });
  assert.match(again.task, /^T\d{4}$/);
  assert.notEqual(again.task, first.task);
  const input = (await w.ok(["input", "show", first.input, "--json"])).json.input;
  assert.equal(input.state, "new");
  assert.deepEqual(input.persons, ["P0001", "P0002"]);
  const before = execFileSync("git", ["rev-parse", "HEAD"], { cwd: w.cwd, encoding: "utf8" });
  assert.deepEqual((await w.ok(["input", "amend", first.input, "--person", "P0002", "--note", "Мария писала сестре", "--json"])).json.added, { persons: [], note: false });
  assert.equal(execFileSync("git", ["rev-parse", "HEAD"], { cwd: w.cwd, encoding: "utf8" }), before, "nothing new: no commit");
  w.cleanup();
});
