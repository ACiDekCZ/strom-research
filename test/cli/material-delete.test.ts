// A file of the family's material deleted for good (spec 102 K1.17, V3): what it takes said first and the same as what
// is done (strom input delete --dry-run, POST /material/delete {dryRun}), a source made of it keeps its text without the
// file, the images of its content and their excerpts go only with the bytes, the same content in another file or another
// research keeps the bytes, the person's alone (no person to ask: exit 4, nothing deleted), the app's two steps (a
// confirmation the bridge signed, 15 minutes; the research changed in between: 409), a name in NFD.

import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import { Settings } from "../../src/core/config.ts";
import { create, update } from "../../src/core/records.ts";
import { material } from "../../src/core/material.ts";
import { deleteConfirm, deleteImpacts } from "../../src/core/materialdelete.ts";
import { thumbPath } from "../../src/core/thumbs.ts";
import { materialWaiting } from "../../src/core/originals.ts";
import type { Input, Media, Person, Source, Task } from "../../src/core/model.ts";

const opts = { skip: !hasGit || process.platform === "win32" };
const app = { Origin: "https://beta.stromapp.info" };
const fixtures = path.join(import.meta.dirname, "..", "fixtures", "images");
const sha = (b: Buffer) => crypto.createHash("sha256").update(b).digest("hex");
const read = (f: string) => fs.readFileSync(path.join(fixtures, f));
const gitHead = (dir: string) => execFileSync("git", ["-C", dir, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();

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
const post = (url: string, body: unknown, headers: Record<string, string> = app) => request("POST", url, Buffer.from(typeof body === "string" ? body : JSON.stringify(body)), { ...headers, "Content-Type": "application/json" });

/** A content into the shared store as an image record keeps it: its path there. */
function store(shared: string, bytes: Buffer, ext: string): string {
  const s = sha(bytes);
  const rel = `media/${s.slice(0, 2)}/${s.slice(2, 4)}/${s}${ext}`;
  fs.mkdirSync(path.dirname(path.join(shared, rel)), { recursive: true });
  fs.writeFileSync(path.join(shared, rel), bytes);
  return rel;
}

test("deleted for good: the impacts said are the impacts done, a source keeps its text, images and excerpts only with the bytes, the same content kept, the person's alone", opts, async () => {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["init", "Lhota"], { cwd: w.dir });
  await w.ok(["person", "add", "Jan /Lhoták/", "--sex", "M", "--born", "1890"]); // P1
  await w.ok(["person", "add", "Anna /Quellmayer/", "--sex", "F"]); // P2
  const shared = new Settings(w.env, {}).shared()!.value;

  // three files given by hand, one of them named in NFD (as a Mac's file manager may give it)
  const given = path.join(w.dir, "dodáno");
  fs.mkdirSync(given);
  const nfd = "Lhoták křest.jpg".normalize("NFD");
  const [a, b, d] = [read("s0001.jpg"), read("png-bw.png"), read("png-rgba.png")];
  fs.writeFileSync(path.join(given, nfd), a);
  fs.writeFileSync(path.join(given, "Lhota dopis.png"), b);
  fs.writeFileSync(path.join(given, "Lhota statek.png"), d);
  await w.ok(["intake", given, "--sort"]);
  const tree = Tree.open(w.cwd, w.env);
  const inputs = tree.list<Input>("input");
  const byName = (n: string) => inputs.find((i) => i.name.normalize("NFC") === n)!.id;
  const [ia, ib, id] = [byName("Lhoták křest.jpg"), byName("Lhota dopis.png"), byName("Lhota statek.png")];
  const fileA = path.join(w.cwd, tree.get<Input>(ia)!.file!);
  assert.ok(fs.existsSync(fileA));
  const holding = tree.list<Task>("task").find((t) => t.where.includes(ia))!;
  assert.ok(holding.where.includes(ib), "one intake task holds the files");

  // the research's own records of these contents: an image of a's content cited with an excerpt, a source made of a,
  // the same content as b in another file, an image of b's content with an excerpt
  const relA = store(shared, a, ".jpg");
  const relB = store(shared, b, ".png");
  let ic = "";
  let [ma, mb, s1, s2, s3] = ["", "", "", "", ""];
  tree.withTreeLock(() => {
    ic = create<Input>(tree, "input", { name: "Lhota dopis kopie.png", file: `media:${relB}`, sha: sha(b), kind: "document", state: "new", from: "a test", notes: [] } as never, (x) => `+${x}`).id;
    ma = create<Media>(tree, "media", { sha: sha(a), file: relA, mime: "image/jpeg", size: a.length, notes: [] } as never, (x) => `+${x}`).id;
    mb = create<Media>(tree, "media", { sha: sha(b), file: relB, mime: "image/png", size: b.length, notes: [] } as never, (x) => `+${x}`).id;
    const region = { x: 0.1, y: 0.1, w: 0.5, h: 0.2 };
    s1 = create<Source>(tree, "source", { kind: "baptism", title: "Matrika Lhota 1890", information: "primary", form: "original", media: [ma], clips: [{ media: ma, region }] } as never, (x) => `+${x}`).id;
    s2 = create<Source>(tree, "source", { kind: "baptism", title: "Křest Jana Lhotáka", information: "primary", form: "original", input: ia, transcript: "Jan Lhoták, syn…" } as never, (x) => `+${x}`).id;
    s3 = create<Source>(tree, "source", { kind: "letter", title: "Dopis z Lhoty", information: "primary", form: "original", clips: [{ media: mb, region }] } as never, (x) => `+${x}`).id;
    update<Person>(tree, "P0001", "person", (p) => ({ ...p, events: p.events.map((e, n) => (n === 0 ? { ...e, citations: [...e.citations, { source: s1 }, { source: s2 }] } : e)) }), { op: "person.edit", summary: "P0001 cites" });
    tree.commit("the records of the test");
  });
  // the same content as d in the other research of this computer
  const other = Tree.open(w.treeDir("Lhota"), w.env);
  other.withTreeLock(() => {
    create<Input>(other, "input", { name: "statek.png", file: `media:${store(shared, d, ".png")}`, sha: sha(d), kind: "document", state: "new", from: "a test", notes: [] } as never, (x) => `+${x}`);
    other.commit("the same file");
  });
  // a preview of a kept: it goes with it
  fs.mkdirSync(path.dirname(thumbPath(w.cwd, sha(a), 256)), { recursive: true });
  fs.writeFileSync(thumbPath(w.cwd, sha(a), 256), "x");
  await w.ok(["input", "assign", ia, "--add", "P2"]);

  // what it would take: said, nothing written
  const head = gitHead(w.cwd);
  const dry = (await w.ok(["input", "delete", ia, ib, id, "--dry-run", "--json"])).json;
  assert.equal(dry.dryRun, true);
  const [xa, xb, xd] = dry.impacts;
  assert.deepEqual(xa, {
    id: ia,
    name: "Lhoták křest.jpg",
    sha: sha(a),
    sources: [
      { id: s1, title: "Matrika Lhota 1890", via: "excerpt", citedCount: 1 },
      { id: s2, title: "Křest Jana Lhotáka", via: "input", citedCount: 1 },
    ],
    excerpts: 1,
    people: ["P0002"],
    links: 0,
    tasks: [holding.id],
    bytes: "deleted",
  });
  assert.deepEqual([xb.bytes, xb.keptWhy, xb.sameAs, xb.sources, xb.excerpts], ["kept", "sameAs", [ic], [{ id: s3, title: "Dopis z Lhoty", via: "excerpt", citedCount: 0 }], 1]);
  assert.deepEqual([xd.bytes, xd.keptWhy, xd.sameAs], ["kept", "otherResearch", undefined]);
  assert.equal(gitHead(w.cwd), head);
  assert.ok(fs.existsSync(fileA));
  // the same as the core says, said in the research language for the person
  assert.deepEqual(deleteImpacts(Tree.open(w.cwd, w.env), shared, [ia, ib, id]), dry.impacts);
  const said = (await w.ok(["input", "delete", ia, "--dry-run"])).out;
  assert.match(said, /Lhoták křest\.jpg: 2 prameny, 1 výřez, 1 úkol, 0 míst v rodokmenu – soubor zmizí z disku/u);

  // nobody to say yes (no terminal, no window): exit 4, nothing deleted — an agent's session the same
  for (const env of [{}, { STROM_WORKER: "agent-1", CLAUDECODE: "1" }] as Record<string, string>[]) {
    const r = await w.run(["input", "delete", ia, "--json"], { env });
    assert.equal(r.code, 4, r.out + r.err);
    assert.equal(gitHead(w.cwd), head);
    assert.ok(fs.existsSync(fileA));
    assert.equal(Tree.open(w.cwd, w.env).get<Input>(ia)!.retracted, undefined);
  }
  // said no in the window: nothing deleted
  assert.notEqual((await w.run(["input", "delete", ia], { dialog: false })).code, 0);
  assert.equal(gitHead(w.cwd), head);
  // a file the research does not have: refused before anything
  const none = await w.run(["input", "delete", ia, "I0999", "--json"], { dialog: true });
  assert.equal(none.json.code, "material.file");
  assert.equal(gitHead(w.cwd), head);
  // a confirmation of the app given by hand is none
  const forged = await w.run(["input", "delete", ia, "--confirm", `${Date.now()}.${"0".repeat(32)}.${"0".repeat(64)}`, "--json"]);
  assert.equal(forged.json.code, "material.body");

  // the person's yes (the window of the system)
  const done = (await w.ok(["input", "delete", ia, ib, id, "--json"], { dialog: true })).json;
  assert.deepEqual(done.deleted, [ia, ib, id]);
  assert.deepEqual(done.impacts, dry.impacts, "what was said is what was done");
  const now = Tree.open(w.cwd, w.env);
  for (const x of [ia, ib, id]) assert.equal(now.get<Input>(x)!.retracted?.reason, "deleted");
  // a source made of it: without the file, its text and citations stay
  const src2 = now.get<Source>(s2)!;
  assert.equal(src2.input, undefined);
  assert.equal(src2.transcript, "Jan Lhoták, syn…");
  assert.deepEqual(now.get<Person>("P0001")!.events[0]!.citations.map((c) => c.source), [s1, s2]);
  // the bytes of a gone: its image and excerpt with them, the source itself stays
  assert.equal(now.get<Media>(ma)!.retracted?.reason, "deleted");
  const src1 = now.get<Source>(s1)!;
  assert.deepEqual([src1.retracted, src1.media, src1.clips], [undefined, undefined, undefined]);
  assert.ok(!fs.existsSync(fileA), "the file in inputs/");
  assert.ok(!fs.existsSync(path.join(shared, relA)), "the image's file in the shared store");
  assert.ok(!fs.existsSync(thumbPath(w.cwd, sha(a), 256)), "its preview");
  // b's content kept by another file of the research: bytes, image and excerpt stay
  assert.equal(now.get<Media>(mb)!.retracted, undefined);
  assert.equal(now.get<Source>(s3)!.clips!.length, 1);
  assert.ok(fs.existsSync(path.join(w.cwd, now.get<Input>(ib)!.file!)));
  assert.ok(fs.existsSync(path.join(shared, relB)));
  // d's content kept by the other research
  assert.ok(fs.existsSync(path.join(w.cwd, now.get<Input>(id)!.file!)));
  // the task of the three let them go: given up
  assert.equal(now.get<Task>(holding.id)!.state, "dropped");
  assert.deepEqual(done.tasks, [holding.id]);
  // gone from the material, the research whole, the history says it
  assert.deepEqual(material(now, shared).files.map((f) => f.id), [ic]);
  assert.equal((await w.ok(["check", "--json"])).json.ok, true);
  assert.equal(execFileSync("git", ["-C", w.cwd, "status", "--porcelain"], { encoding: "utf8" }).trim(), "", "the file's removal from inputs/ committed");
  assert.match(execFileSync("git", ["-C", w.cwd, "log", "-1", "--format=%B"], { encoding: "utf8" }), /deleted for good/u);
  // deleted already: no file of the material
  assert.equal((await w.run(["input", "delete", ia, "--dry-run", "--json"])).json.code, "material.file");
  w.cleanup();
});

test("deleted for good: never by an agent even with the app's confirmation, gone from input list, input show says so, the same file brought again is new", opts, async () => {
  const w = new World();
  await w.withTree("Lhotákovi");
  const given = path.join(w.dir, "dodáno");
  fs.mkdirSync(given);
  const nfd = "Lhoták křest.jpg".normalize("NFD");
  fs.writeFileSync(path.join(given, nfd), read("s0001.jpg"));
  fs.writeFileSync(path.join(given, "Lhota dopis.png"), read("png-bw.png"));
  await w.ok(["intake", given]);
  const inputs = Tree.open(w.cwd, w.env).list<Input>("input");
  const ia = inputs.find((i) => i.name.normalize("NFC") === "Lhoták křest.jpg")!.id;
  const ib = inputs.find((i) => i.name === "Lhota dopis.png")!.id;
  const shared = new Settings(w.env, {}).shared()!.value;
  const signed = () => {
    const t = Tree.open(w.cwd, w.env);
    return deleteConfirm(t.key!, [ia], deleteImpacts(t, shared, [ia]));
  };

  // an agent's marks outweigh STROM_FOR_APP: a confirmation the bridge signed, still nothing deleted
  const head = gitHead(w.cwd);
  for (const marks of [{ CLAUDECODE: "1" }, { STROM_IN_AGENT: "codex" }, { STROM_SESSION: "S0001" }] as Record<string, string>[]) {
    const r = await w.run(["input", "delete", ia, "--confirm", signed(), "--json"], { env: { STROM_FOR_APP: "1", ...marks } });
    assert.notEqual(r.code, 0, JSON.stringify(marks));
    assert.equal(r.json.code, "material.agent", r.out);
    assert.equal(Tree.open(w.cwd, w.env).get<Input>(ia)!.retracted, undefined);
  }
  assert.equal(gitHead(w.cwd), head);
  // the bridge's own run (the person's, without an agent's marks): deleted
  assert.deepEqual((await w.ok(["input", "delete", ia, "--confirm", signed(), "--json"], { env: { STROM_FOR_APP: "1" } })).json.deleted, [ia]);

  // gone from the inputs, as from the app's material; strom input show says it was deleted, never to bring it back
  const listed = (await w.ok(["input", "list", "--json"])).json;
  assert.deepEqual([listed.total, listed.inputs.map((i: { id: string }) => i.id)], [1, [ib]]);
  assert.doesNotMatch((await w.ok(["input", "list"])).out, new RegExp(ia, "u"));
  const shown = await w.ok(["input", "show", ia]);
  assert.match(shown.out, /deleted for good \d{4}-\d{2}-\d{2}/u);
  assert.doesNotMatch(shown.out, /backup|missing/u);
  const sj = (await w.ok(["input", "show", ia, "--json"])).json;
  assert.equal(typeof sj.deleted, "string");
  assert.equal(sj.missing, undefined);

  // the same file brought again: new material, never "the research has it already"
  const again = (await w.ok(["intake", path.join(given, nfd), "--json"])).json;
  assert.equal(again.inputs.length, 1, JSON.stringify(again));
  assert.notEqual(again.inputs[0].id, ia);
  assert.equal(again.inputs[0].name.normalize("NFC"), "Lhoták křest.jpg");
  assert.ok(fs.existsSync(path.join(w.cwd, again.inputs[0].file)));
  assert.deepEqual((await w.ok(["input", "list", "--json"])).json.inputs.map((i: { id: string }) => i.id).sort(), [ib, again.inputs[0].id].sort());
  w.cleanup();
});

test("deleted from the Strom app: a dry run and its signed confirmation, 15 minutes, a change between them refused, sent again later it is new", opts, async () => {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["person", "add", "Jan /Lhoták/", "--sex", "M"]); // P1
  w.env.STROM_LIVE_POLL_MS = "100";
  const info = (await w.ok(["live", "start", "--json"])).json;
  try {
    const bytes = read("s0002.jpg");
    const put = () => request("PUT", `${info.url}/media/${sha(bytes)}`, bytes, { ...app, "X-Strom-Name": encodeURIComponent("Lhoták – svatba.jpg".normalize("NFD")) });
    const i = json(await put()).input as string;
    const shared = new Settings(w.env, {}).shared()!.value;
    const kept = path.join(shared, Tree.open(w.cwd, w.env).get<Input>(i)!.file!.slice("media:".length));
    assert.ok(fs.existsSync(kept));
    const url = `${info.url}/material/delete`;

    // only the app's pages; a file the research has not; a body it cannot read
    assert.equal((await post(url, { files: [i], dryRun: true }, {})).status, 403);
    const nofile = await post(url, { files: [i, "I0999"], dryRun: true });
    assert.deepEqual([nofile.status, json(nofile).code], [404, "material.file"]);
    for (const bad of [{ dryRun: true }, { files: [], dryRun: true }, { files: [i], dryRun: "yes" }, { files: Array(501).fill(i), dryRun: true }, "[1]"]) {
      const r = await post(url, bad);
      assert.deepEqual([r.status, json(r).code], [400, "material.body"], JSON.stringify(bad).slice(0, 80));
    }

    // the dry run: what it takes and the bridge's confirmation, nothing written
    const head = gitHead(w.cwd);
    const dry = await post(url, { files: [i], dryRun: true });
    assert.equal(dry.status, 200, dry.body.toString());
    const d = json(dry);
    assert.deepEqual([d.files, d.dryRun, d.impacts[0].id, d.impacts[0].name, d.impacts[0].bytes], [[i], true, i, "Lhoták – svatba.jpg", "deleted"]);
    assert.match(d.confirm, /^\d+\.[0-9a-f]{32}\.[0-9a-f]{64}$/u);
    assert.equal(gitHead(w.cwd), head);

    // no confirmation, one made up, one older than 15 minutes: 400, nothing deleted
    const key = Tree.open(w.cwd, w.env).key!;
    const old = deleteConfirm(key, [i], d.impacts, Date.now() - 16 * 60_000);
    for (const confirm of [undefined, "abc", d.confirm.replace(/.$/u, (c: string) => (c === "0" ? "1" : "0")), old]) {
      const r = await post(url, { files: [i], ...(confirm !== undefined ? { confirm } : {}) });
      assert.deepEqual([r.status, json(r).code], [400, "material.body"], String(confirm));
    }
    assert.equal(gitHead(w.cwd), head);
    assert.ok(fs.existsSync(kept));

    // the research changed since the person saw the list (a person added to the file): 409 with the list now
    assert.equal((await post(`${info.url}/material/assign`, { files: [i], add: ["P0001"] })).status, 200);
    const changed = await post(url, { files: [i], confirm: d.confirm });
    assert.deepEqual([changed.status, json(changed).code], [409, "material.delete-changed"]);
    assert.deepEqual(json(changed).impacts[0].people, ["P0001"]);
    assert.ok(fs.existsSync(kept));

    // seen again and confirmed: deleted
    const again = json(await post(url, { files: [i], dryRun: true }));
    const del = await post(url, { files: [i], confirm: again.confirm });
    assert.equal(del.status, 200, del.body.toString());
    const got = json(del);
    assert.deepEqual([got.files, got.deleted, got.impacts], [[i], [i], again.impacts]);
    assert.match(got.head, /^[0-9a-f]{7,}$/u);
    assert.ok(!fs.existsSync(kept), "the original in the shared store");
    assert.deepEqual(json(await request("GET", `${info.url}/material`)).files, []);
    // waits for nobody: not among what came from the app and waits
    assert.equal(materialWaiting(Tree.open(w.cwd, w.env)), 0);
    // the same confirmation again: the file is none any more
    assert.equal((await post(url, { files: [i], confirm: again.confirm })).status, 404);

    // the same file sent again: new material, never the deleted record
    const back = json(await put());
    assert.ok(back.input && back.input !== i, JSON.stringify(back));
    assert.ok(fs.existsSync(kept));
  } finally {
    await w.ok(["live", "stop"]);
  }
  w.cleanup();
});
