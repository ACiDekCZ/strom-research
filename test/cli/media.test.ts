// Scans: registered once, tied to a record set and an image number, seen only
// through views (crops, halves, a grid), cited by sources.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit, readJsonFile } from "../helpers.ts";
import { decodeImage, encodeImage } from "../../src/image/index.ts";
import { resize } from "../../src/image/image.ts";

const opts = { skip: !hasGit };
const fixtures = path.join(import.meta.dirname, "..", "fixtures", "images");

async function world(): Promise<{ w: World; scans: string }> {
  const w = new World();
  await w.withTree();
  await w.ok(["recordset", "add", "Sloup 782, N 1847-1868", "--kinds", "baptism", "--places", "Vavřinec", "--years", "1847-1868"]);
  const scans = path.join(w.dir, "sloup782");
  fs.mkdirSync(scans);
  for (const f of ["s0001.jpg", "s0002.jpg", "s0003.jpg"]) fs.copyFileSync(path.join(fixtures, f), path.join(scans, f));
  fs.writeFileSync(path.join(scans, "readme.txt"), "not an image");
  return { w, scans };
}

test("media add: images of a record set, numbered from their names, stored once by content", opts, async () => {
  const { w, scans } = await world();
  const r = await w.ok(["media", "add", scans, "--recordset", "B1", "--url", "https://example.org/detail/3614"]);
  assert.match(r.out, /3 image\(s\) registered: M0001–M0003 of B0001 \(images 1–3\)/);
  const m = readJsonFile(path.join(w.cwd, "data", "images", "M0002.json"));
  assert.equal(m.image, 2);
  assert.equal(m.width, 400);
  assert.match(m.file, /^media\/[0-9a-f]{2}\/[0-9a-f]{2}\/[0-9a-f]{64}\.jpg$/);
  assert.ok(fs.existsSync(path.join(w.home, "shared", m.file)), "stored in the shared media store");
  assert.ok(!fs.existsSync(path.join(w.cwd, "media")), "never in the tree's git");
  assert.match((await w.ok(["media", "add", scans, "--recordset", "B1"])).out, /no new images\n3 already registered/);
  assert.match((await w.ok(["media", "list", "--recordset", "B1"])).out, /M0003\s+B0001:3/);
  w.cleanup();
});

test("media add --half / --crop: a part of an image saved on its own is registered with its image", opts, async () => {
  const { w, scans } = await world();
  await w.ok(["media", "add", path.join(scans, "s0001.jpg"), "--recordset", "B1"]); // M0001, 400×300
  // a half page saved on its own (the old tools cut spreads in two): a part of image 1, whether or not the whole is there
  const half = path.join(w.dir, "s0001L.jpg");
  fs.copyFileSync(path.join(fixtures, "s0002.jpg"), half);
  const r = await w.ok(["media", "add", half, "--recordset", "B1", "--image", "1", "--half", "left"]);
  assert.match(r.out, /1 image\(s\) registered: M0002 of B0001 \(images 1\)/);
  assert.deepEqual(readJsonFile(path.join(w.cwd, "data", "images", "M0002.json")).part, { x: 0, y: 0, w: 0.5, h: 1 });
  assert.deepEqual((await w.ok(["media", "show", "B1:1", "--json"])).json.parts, ["M0002"]);
  const detail = path.join(w.dir, "detail.jpg");
  fs.copyFileSync(path.join(fixtures, "s0003.jpg"), detail);
  await w.ok(["media", "add", detail, "--recordset", "B1", "--image", "2", "--crop", "0.5,0.25,0.5,0.5"]);
  assert.deepEqual(readJsonFile(path.join(w.cwd, "data", "images", "M0003.json")).part, { x: 0.5, y: 0.25, w: 0.5, h: 0.5 });
  assert.equal((await w.run(["media", "add", scans, "--recordset", "B1", "--half", "left"])).code, 2, "one file");
  assert.equal((await w.run(["media", "add", half, "--image", "1", "--half", "left"])).code, 2, "of a record set");
  assert.equal((await w.run(["media", "add", half, "--recordset", "B1", "--image", "1", "--crop", "0,0,1,1"])).code, 2, "the whole image is not a part");
  // image 3 only as its two halves: "B1:3" does not say which one — the parts are named, none is picked
  const img = decodeImage(new Uint8Array(fs.readFileSync(path.join(fixtures, "s0001.jpg"))));
  for (const [f, side, wd] of [["s0003L.jpg", "left", 210], ["s0003P.jpg", "right", 220]] as const) {
    fs.writeFileSync(path.join(w.dir, f), encodeImage(resize(img, wd, 300), "jpeg"));
    await w.ok(["media", "add", path.join(w.dir, f), "--recordset", "B1", "--image", "3", "--half", side]); // M0004, M0005
  }
  const refused = await w.run(["source", "add", "Křest 1850", "--media", "B1:3"]);
  assert.equal(refused.code, 2);
  assert.match(refused.err, /image 3 of B0001 is registered only in parts: M0004 \(part 0,0,0\.5,1\), M0005 \(part 0\.5,0,0\.5,1\)[\s\S]*M0004 or M0005/);
  assert.equal((await w.run(["media", "view", "B1:3"])).code, 2);
  assert.match((await w.ok(["source", "add", "Křest 1850", "--media", "M0005"])).out, /on M0005/);
  assert.match((await w.ok(["source", "add", "Detail 1851", "--media", "B1:2"])).out, /on M0003/, "one part only: that part");
  w.cleanup();
});

test("a sharper copy of a whole image: it is the image; a view of an older copy uses it; the brief counts each image once", opts, async () => {
  const { w, scans } = await world();
  await w.ok(["media", "add", scans, "--recordset", "B1"]); // M0001–M0003, 400×300
  // the full download of image 2 after a reduced one: twice the pixels
  const full = path.join(w.dir, "full", "s0002.jpg");
  fs.mkdirSync(path.dirname(full));
  const img = decodeImage(new Uint8Array(fs.readFileSync(path.join(scans, "s0002.jpg"))));
  fs.writeFileSync(full, encodeImage(resize(img, 800, 600), "jpeg"));
  const r = await w.ok(["media", "add", full, "--recordset", "B1"]);
  assert.match(r.out, /1 image\(s\) registered: M0004 of B0001 \(images 2\)/);
  assert.match(r.out, /B0001:2 has 2 copies — M0004 800×600 is the sharpest: it is the image now; views of the others use it \(M0002 400×300\)/);
  assert.equal((await w.ok(["media", "show", "B1:2", "--json"])).json.media.id, "M0004", "the image is the sharpest copy");
  const older = await w.ok(["media", "show", "M0002"]);
  assert.match(older.out, /other copies of the image: M0004 800×600 — the image is the sharpest \(M0004\); a view of any copy uses it/);
  // a source that cites the older copy is looked at through the sharper one
  const v = await w.ok(["media", "view", "M0002", "--crop", "0.5,0.5,0.25,0.1", "--json"]);
  assert.equal(v.json.from, "M0004");
  assert.deepEqual(v.json.region, { x: 400, y: 300, w: 200, h: 60 }, "the place, in the sharper copy's pixels");
  assert.match((await w.ok(["media", "view", "M0002", "--crop", "0.5,0.5,0.25,0.1"])).out, /from M0004, a sharper copy of the image \(2\.0× the detail of M0002\)/);
  assert.equal((await w.ok(["media", "view", "M0002", "--max", "2000", "--json"])).json.original.width, 800, "the whole image too");
  // a less sharp copy that comes later stays behind the sharper one
  const small = path.join(w.dir, "small", "s0002.jpg");
  fs.mkdirSync(path.dirname(small));
  fs.writeFileSync(small, encodeImage(resize(img, 200, 150), "jpeg"));
  assert.match((await w.ok(["media", "add", small, "--recordset", "B1"])).out, /B0001:2 has 3 copies — M0004 800×600 is sharper and stays the image/);
  assert.equal((await w.ok(["media", "show", "B1:2", "--json"])).json.media.id, "M0004");
  // the brief counts each image once
  await w.ok(["research", "new", "X", "--new-person", "Jan /Novák/"]);
  await w.ok(["task", "add", "Křest", "--level", "link", "--where", "B1", "--why", "a", "--done-when", "b"]);
  assert.match((await w.ok(["brief"])).out, /images registered \(3\): 1–3 · strom media view B0001:<image>/);
  w.cleanup();
});

test("media add --inbox: one folder, one record set; the image number is the part of the name that changes", opts, async () => {
  const { w } = await world();
  await w.ok(["recordset", "add", "Týnec N 1871–1899", "--kinds", "birth"]);
  const inbox = path.join(w.home, "shared", "inbox");
  // an archive's names carry a call number too (…_00141_sign-4411.jpg); a folder name with accents and spaces
  const book = path.join(inbox, "Týnec N 1871–1899");
  const other = path.join(inbox, "sloup782");
  fs.mkdirSync(book, { recursive: true });
  fs.mkdirSync(other, { recursive: true });
  [140, 141, 142].forEach((n, i) => fs.copyFileSync(path.join(fixtures, `s000${i + 1}.jpg`), path.join(book, `CZ_000000001_00007_QX8R2MNP_00${n}_sign-4411.jpg`)));
  fs.writeFileSync(path.join(other, "s0114.jpg"), Buffer.concat([fs.readFileSync(path.join(fixtures, "s0001.jpg")), Buffer.from([7])]));
  const brief = (await w.ok(["brief"])).out;
  assert.match(brief, /## Waiting in the inbox \(4 files from the user\)\n  Týnec N 1871–1899\/ \(3 files\): CZ_000000001_00007_QX8R2MNP_00140_sign-4411\.jpg, .*00142_sign-4411\.jpg\n  sloup782\/ \(1 file\): s0114\.jpg\n  one folder = one download = one record set/);
  assert.match(brief, /  (archives: R0001 |the archive first: strom repo add)/);
  assert.match(brief, /  strom recordset add "<title>" --repo R… .*\n  strom media add --inbox "<folder>" --recordset B…/);
  // two downloads are never mixed into one record set
  const mixed = await w.run(["media", "add", "--inbox", "--recordset", "B2"]);
  assert.equal(mixed.code, 2);
  assert.match(mixed.err, /the inbox holds 2 downloads — one record set each/);
  assert.match(mixed.err, /strom media add --inbox "Týnec N 1871–1899" --recordset B…   \(3 files\)/);
  const r = await w.ok(["media", "add", "--inbox", "Týnec N 1871–1899".normalize("NFD"), "--recordset", "B2", "--from", "Archiv online"]);
  assert.match(r.out, /3 image\(s\) registered: M0001–M0003 of B0002 \(images 140–142\)/);
  assert.equal(readJsonFile(path.join(w.cwd, "data", "images", "M0002.json")).from, "Archiv online · CZ_000000001_00007_QX8R2MNP_00141_sign-4411.jpg", "the original name stays");
  assert.ok(!fs.existsSync(book), "the emptied folder is gone");
  assert.equal((await w.run(["media", "add", "--inbox", "../outside", "--recordset", "B1"])).code, 2);
  // "." takes the files lying in the inbox itself, never a folder beside them
  fs.copyFileSync(path.join(fixtures, "base420.jpg"), path.join(inbox, "s0009.jpg"));
  assert.match((await w.run(["media", "add", "--inbox", "--recordset", "B1"])).err, /strom media add --inbox \. --recordset B…   \(1 file\)/);
  assert.match((await w.ok(["media", "add", "--inbox", ".", "--recordset", "B1"])).out, /1 image\(s\) registered: M0004 of B0001 \(images 9\)/);
  assert.ok(fs.existsSync(path.join(other, "s0114.jpg")));
  // the one download left needs no folder name
  assert.match((await w.ok(["media", "add", "--inbox", "--recordset", "B1"])).out, /1 image\(s\) registered: M0005 of B0001 \(images 114\)/);
  assert.deepEqual(fs.readdirSync(inbox), []);
  w.cleanup();
});

test("media view: a reduced whole image, a grid, a half, a crop at full size; cached; logged", opts, async () => {
  const { w, scans } = await world();
  await w.ok(["media", "add", scans, "--recordset", "B1"]);
  const whole = (await w.ok(["media", "view", "B1:2", "--max", "200", "--json"])).json;
  assert.equal(whole.width, 200);
  assert.equal(whole.scale, 0.5);
  assert.ok(whole.view.startsWith(path.join(w.cwd, ".strom", "views")));
  assert.match((await w.ok(["media", "view", "B1:2", "--max", "200"])).out, /50 % — reduced: crop the part you need/);
  const img = decodeImage(new Uint8Array(fs.readFileSync(whole.view)));
  assert.equal(img.width, 200);
  const half = (await w.ok(["media", "view", "M0002", "--half", "left", "--json"])).json;
  assert.deepEqual(half.region, { x: 0, y: 0, w: 200, h: 300 });
  const c = (await w.ok(["media", "view", "M0002", "--crop", "0.5,0.5,0.25,0.1", "--contrast", "--json"])).json;
  assert.deepEqual(c.region, { x: 200, y: 150, w: 100, h: 30 });
  assert.ok(c.scale > 1, "a small crop is enlarged");
  const says = (await w.ok(["media", "view", "M0002", "--crop", "0.5,0.5,0.25,0.1"])).out;
  assert.match(says, /enlarged from 100×30 px of the scan: it has no more detail than that\. What you cannot read for sure is marked \[\?\]/);
  const g = (await w.ok(["media", "view", "M0002", "--grid", "--json"])).json;
  assert.ok(fs.existsSync(g.view));
  const again = (await w.ok(["media", "view", "M0002", "--grid", "--json"])).json;
  assert.equal(again.view, g.view, "the same view is reused");
  const log = fs.readFileSync(path.join(w.cwd, ".strom", "views", "views.jsonl"), "utf8").trim().split("\n");
  assert.equal(log.length, 7);
  assert.equal(JSON.parse(log[0]!).key, "M0002");
  assert.equal((await w.run(["media", "view", "B1:9"])).code, 2, "not registered");
  assert.match((await w.run(["media", "view", "M0002", "--crop", "a,b"])).err, /invalid --crop/);
  w.cleanup();
});

test("the queue: work that can be done now before work that waits for a download; a similar task is pointed out", opts, async () => {
  const { w, scans } = await world();
  await w.ok(["research", "new", "X", "--new-person", "Jan /Novák/"]);
  await w.ok(["recordset", "add", "Oddaní 1880–1890", "--kinds", "marriage"]); // B2, no images
  await w.ok(["media", "add", scans, "--recordset", "B1"]);
  const noImages = await w.ok(["task", "add", "Sňatek", "--level", "link", "--where", "B2", "--why", "a", "--done-when", "b", "--priority", "5", "--about", "P1"]); // T1
  assert.match(noImages.out, /no images for it here yet — if the user has to download them, say which now: strom task wait T0001 --images B…:<numbers> --on/);
  await w.ok(["task", "add", "Sňatek v knize, kterou nikdo nezná", "--level", "link", "--where", "oddací kniha fary (signatura neznámá)", "--why", "a", "--done-when", "b", "--priority", "4"]); // T2
  assert.doesNotMatch((await w.ok(["task", "add", "Křest", "--level", "link", "--where", "B1", "--why", "a", "--done-when", "b", "--priority", "3", "--about", "P1"])).out, /no images/); // T3
  await w.ok(["task", "add", "Kde jsou oddaní", "--level", "locate", "--where", "katalog archivu", "--why", "a", "--done-when", "b", "--priority", "2"]); // T4
  assert.deepEqual((await w.ok(["task", "list", "--json"])).json.tasks.map((t: any) => t.id), ["T0003", "T0004", "T0001", "T0002"]);
  assert.match((await w.ok(["task", "next"])).out, /^T0003 Křest/);
  // the same person, the same work, the same book
  const again = await w.ok(["task", "add", "Křest Jana, syna Josefa", "--level", "link", "--where", "B1", "--why", "a", "--done-when", "b", "--about", "P1"]);
  assert.match(again.out, /⚠ similar open task T0003 "Křest" — if it is the same, keep one: strom task drop T0005 --reason "duplicate of T0003" and strom task edit T0003/);
  await w.ok(["recordset", "add", "Zemřelí 1880–1920", "--kinds", "burial"]); // B3
  assert.doesNotMatch((await w.ok(["task", "add", "Úmrtí", "--level", "link", "--where", "B3", "--why", "a", "--done-when", "b", "--about", "P1"])).out, /similar/, "another book"); // T6
  // The same work in other words: not added — what is new goes into the one there is.
  await w.ok(["task", "add", "Úmrtí první manželky Jana Nováka (18.2.1885, Týnec)", "--level", "link", "--where", "B3", "--why", "a", "--done-when", "b", "--about", "P1"]); // T7
  const twice = await w.run(["task", "add", "Úmrtí první manželky Jana Nováka, Týnec 18.2.1885", "--level", "link", "--where", "B3", "--why", "jméno 1. ženy", "--done-when", "b", "--about", "P1"]);
  assert.equal(twice.code, 2);
  assert.match(twice.err, /a task like this is open already: T0007 p3 link "Úmrtí první manželky Jana Nováka \(18\.2\.1885, Týnec\)"\n→ add to it: strom task edit T0007 --priority … --where … --note "…" — or, if it is really other work: --anyway/);
  // Other work on the same person in the same book goes in; so does anything with --anyway.
  await w.ok(["task", "add", "Úmrtí druhé manželky Jana Nováka (1890, Týnec)", "--level", "link", "--where", "B3", "--why", "a", "--done-when", "b", "--about", "P1"]);
  await w.ok(["task", "add", "Úmrtí první manželky Jana Nováka, Týnec 18.2.1885", "--level", "link", "--where", "B3", "--why", "a", "--done-when", "b", "--about", "P1", "--anyway"]);
  w.cleanup();
});

test("a task waiting for the images of its book comes back when they are registered", opts, async () => {
  const { w, scans } = await world();
  await w.ok(["research", "new", "X", "--new-person", "Jan /Novák/"]);
  await w.ok(["task", "add", "Křest", "--level", "link", "--where", "B1", "--why", "a", "--done-when", "b"]); // T1
  assert.match((await w.ok(["brief", "T1"])).out, /no images here yet — the user saves them by hand \(never scrape an archive\): strom task wait <T…> --images B0001:<numbers> --on "<for the user, in their language/);
  await w.ok(["task", "wait", "T1", "--on", "images 1–3 of B0001 in the inbox"]);
  assert.equal((await w.ok(["task", "next", "--json"])).json.task, null, "a waiting task is not offered");
  // the user sees what the research waits for
  for (const cmd of [["status"], []]) assert.match((await w.ok(cmd)).out, /čeká na vás \(1\)\n  T0001  images 1–3 of B0001 in the inbox\n  snímky patří do schránky \(inbox\), pro každou knihu vlastní složka, každý pojmenovaný číslem snímku/);
  assert.match((await w.ok([])).out, /dál\s+strom task list --state waiting/);
  const r = await w.ok(["media", "add", scans, "--recordset", "B1"]);
  assert.match(r.out, /back in the queue \(they waited for these images\): T0001/);
  assert.equal((await w.ok(["task", "show", "T1", "--json"])).json.task.state, "open");
  w.cleanup();
});

test("images the user saves by hand: the folder is made and shown with the link, the numbers of what arrives are checked", opts, async () => {
  const { w } = await world();
  await w.ok(["research", "new", "X", "--new-person", "Jan /Novák/"]);
  await w.ok(["task", "add", "Křest", "--level", "link", "--where", "B1", "--why", "a", "--done-when", "b"]); // T1
  await w.ok(["recordset", "add", "Žďár N 1784–1820", "--url", "https://archive.example.org/book/5359"]); // B2
  const folder = "B0002 Žďár N 1784–1820";
  const dir = path.join(w.home, "shared", "inbox", folder);
  const asked = await w.ok(["task", "wait", "T1", "--images", "B2:9-10", "--on", "snímky 9–10 knihy Žďár (https://archive.example.org/book/5359)"]);
  assert.match(asked.out, /the user saves images 9–10 of B0002 into .*B0002 Žďár N 1784–1820, each named by its number \(9\.jpg\)/);
  assert.ok(fs.statSync(dir).isDirectory(), "the folder is there before the user looks for it");
  const t = (await w.ok(["task", "show", "T1", "--json"])).json.task;
  assert.deepEqual(t.awaits, { recordset: "B0002", images: "9–10", folder });
  assert.ok(t.where.includes("B0002"));
  assert.match(
    (await w.ok(["status"])).out,
    /čeká na vás \(1\)\n  T0001  snímky 9–10 knihy Žďár \(https:\/\/archive\.example\.org\/book\/5359\)\n {9}snímky 9–10 z B0002 Žďár N 1784–1820 · https:\/\/archive\.example\.org\/book\/5359\n {9}uložte je do .*B0002 Žďár N 1784–1820[\/\\]\n/,
  );
  assert.equal((await w.run(["task", "wait", "T1", "--images", "B2:x", "--on", "?"])).code, 2);
  // saved under the portal's own names, whose numbers are something else (×10): nothing is taken
  fs.copyFileSync(path.join(fixtures, "s0001.jpg"), path.join(dir, "kniha-00090.jpg"));
  fs.copyFileSync(path.join(fixtures, "s0002.jpg"), path.join(dir, "kniha-00100.jpg"));
  const wrong = await w.run(["media", "add", "--inbox", folder.normalize("NFD")]);
  assert.equal(wrong.code, 2);
  assert.match(wrong.err, /images 9–10 of B0002 were asked for, but the file names give 90, 100/);
  assert.equal(fs.readdirSync(dir).length, 2, "nothing moved");
  // a file without a number cannot be an image of the book
  fs.renameSync(path.join(dir, "kniha-00090.jpg"), path.join(dir, "9.jpg"));
  fs.renameSync(path.join(dir, "kniha-00100.jpg"), path.join(dir, "obrázek.jpg"));
  assert.match((await w.run(["media", "add", "--inbox", folder])).err, /1 file\(s\) without an image number in the name: obrázek\.jpg/);
  // named by the number, a zoomed-in part too: the book comes from the folder
  fs.renameSync(path.join(dir, "obrázek.jpg"), path.join(dir, "9a.jpg"));
  const r = await w.ok(["media", "add", "--inbox", folder]);
  assert.match(r.out, /2 image\(s\) registered: M0001–M0002 of B0002 \(images 9\)/);
  assert.match(r.out, /back in the queue \(they waited for these images\): T0001/);
  const back = (await w.ok(["task", "show", "T1", "--json"])).json.task;
  assert.equal(back.state, "open");
  assert.equal(back.awaits, undefined);
  assert.match(back.notes.at(-1).text, /2 image\(s\) of B0002 registered \(it waited for images 9–10; still missing: 10\)/);
  assert.ok(!fs.existsSync(dir), "the emptied folder goes");
  w.cleanup();
});

test("calibration: the page of an image, the image of a page", opts, async () => {
  const { w, scans } = await world();
  await w.ok(["media", "add", scans, "--recordset", "B1"]);
  await w.ok(["recordset", "calibrate", "B1", "--point", "1=226", "--point", "3=230"]);
  assert.match((await w.ok(["media", "list", "--recordset", "B1"])).out, /M0002\s+B0001:2\s+≈228/);
  const v = (await w.ok(["media", "view", "B1", "--page", "228", "--json"])).json;
  assert.equal(v.image, "M0002");
  w.cleanup();
});

test("a source cites the image it is on; only registered images", opts, async () => {
  const { w, scans } = await world();
  await w.ok(["media", "add", scans, "--recordset", "B1"]);
  const s = await w.ok(["source", "add", "Křest Františka 1862", "--kind", "baptism", "--recordset", "B1", "--media", "B1:2", "--locator", "pag. 228, 2. zápis"]);
  assert.match(s.out, /\+S0001 source "Křest Františka 1862" on M0002/);
  assert.match((await w.ok(["media", "show", "M0002"])).out, /sources on it: S0001 Křest Františka 1862/);
  assert.match((await w.ok(["source", "show", "S1"])).out, /images M0002 \(B0001:2\)/);
  assert.equal(readJsonFile(path.join(w.cwd, "data", "sources", "S0001.json")).form, "original");
  // a line of an index is a copy by another hand; an entry of a book that has its own index is not
  await w.ok(["recordset", "add", "Rejstřík narozených 1787–1881", "--kinds", "index"]); // B2
  await w.ok(["source", "add", "Rejstřík: Josefa 1833", "--kind", "baptism", "--recordset", "B2"]);
  assert.equal(readJsonFile(path.join(w.cwd, "data", "sources", "S0002.json")).form, "derivative");
  await w.ok(["recordset", "add", "Sloup 779, N 1784–1828 + rejstřík", "--kinds", "baptism,index"]); // B3
  await w.ok(["source", "add", "Křest Josefa 1790", "--kind", "baptism", "--recordset", "B3"]);
  await w.ok(["source", "add", "Rejstřík: Josef 1790", "--kind", "index", "--recordset", "B3"]);
  assert.deepEqual(["S0003", "S0004"].map((s) => readJsonFile(path.join(w.cwd, "data", "sources", `${s}.json`)).form), ["original", "derivative"]);
  assert.equal((await w.run(["source", "add", "X", "--media", "B1:77"])).code, 2);
  w.cleanup();
});

test("agents see images only through views; the brief says which images a record set has", opts, async () => {
  const { w, scans } = await world();
  await w.ok(["media", "add", scans, "--recordset", "B1"]);
  const settings = readJsonFile(path.join(w.cwd, ".claude", "settings.json"));
  assert.ok(settings.permissions.deny.some((d: string) => d.includes("/shared/media/**")));
  assert.ok(settings.permissions.allow.includes("Read(.strom/views/**)"));
  await w.ok(["research", "new", "X", "--new-person", "Jan /Novák/"]);
  await w.ok(["task", "add", "Křest", "--level", "link", "--where", "B1", "--why", "a", "--done-when", "b"]);
  assert.match((await w.ok(["brief"])).out, /images registered \(3\): 1–3 · strom media view B0001:<image>/);
  assert.match((await w.ok(["brief"])).out, /# Method: reading scans/);
  // what the user put in the shared inbox is mentioned, so it is not forgotten
  assert.doesNotMatch((await w.ok(["brief"])).out, /Waiting in the inbox/);
  fs.mkdirSync(path.join(w.home, "shared", "inbox", "sloup782"), { recursive: true });
  fs.copyFileSync(path.join(fixtures, "s0001.jpg"), path.join(w.home, "shared", "inbox", "sloup782", "s0114.jpg"));
  assert.match((await w.ok(["brief"])).out, /## Waiting in the inbox \(1 file from the user\)\n  sloup782\/ \(1 file\): s0114.jpg\n  one folder = one download = one record set/);
  w.cleanup();
});

test("strom read: batches of at most ten, reports in notes/readings, the finds and a search to record", opts, async () => {
  const { w } = await world();
  // 23 images of one book → three readers (10 + 10 + 3)
  const many = path.join(w.dir, "many");
  fs.mkdirSync(many);
  for (let i = 1; i <= 23; i++) {
    const src = fs.readFileSync(path.join(fixtures, `s000${(i % 3) + 1}.jpg`));
    fs.writeFileSync(path.join(many, `s${String(i).padStart(4, "0")}.jpg`), Buffer.concat([src, Buffer.from([i])])); // distinct content
  }
  await w.ok(["media", "add", many, "--recordset", "B1"]);
  w.env.STROM_RUNNER_SCRIPT = path.join(import.meta.dirname, "..", "fixtures", "agent.ts");
  const r = await w.run(["read", "B1", "--images", "1-23", "--question", "Křty Víšek 1860–1864", "--agent", "script", "--json"]);
  assert.equal(r.code, 0, r.out + r.err);
  assert.equal(r.json.reports.length, 3);
  assert.deepEqual(r.json.found.map((f: any) => f.image), [1, 11, 21]);
  assert.deepEqual(r.json.missing, []);
  const report = fs.readFileSync(r.json.reports[0], "utf8");
  assert.match(report, /^# Reading B0001-1-23 · batch 1 of 3\nQuestion: Křty Víšek 1860–1864/);
  assert.match(report, /## Image 1 · M0001\nresult: found/);
  assert.ok(r.json.reports[0].startsWith(path.join(w.cwd, "notes", "readings")));
  const text = (await w.run(["read", "B1", "--images", "1-3", "--question", "x", "--agent", "script"])).out;
  assert.match(text, /found on: 1\n/);
  assert.match(text, /record the search: strom search add "x" --recordset B0001 --pages 1-3 --method page-by-page --by reader --result found/);
  // a second reading of the same images the same day keeps the first report
  const again = await w.run(["read", "B1", "--images", "1-3", "--question", "y", "--agent", "script", "--json"]);
  const [first] = fs.readdirSync(path.join(w.cwd, "notes", "readings")).filter((f) => /-B0001-1-3-1\.md$/.test(f));
  assert.match(fs.readFileSync(path.join(w.cwd, "notes", "readings", first!), "utf8"), /Question: x\n/);
  assert.match(again.json.reports[0], /-B0001-1-3-run2-1\.md$/);
  assert.match(fs.readFileSync(again.json.reports[0], "utf8"), /Question: y\n/);
  // one image by its record set and number
  assert.match((await w.run(["read", "B1:2", "--question", "z", "--agent", "script", "--json"])).json.reports[0], /-M0002-1\.md$/);
  assert.equal((await w.run(["read", "B1:99", "--question", "z", "--agent", "script"])).code, 2);
  // a reader that only answered: its answer becomes the report; unreported images are named
  w.env.AGENT_MODE = "reader-silent";
  const silent = (await w.run(["read", "B1", "--images", "1-2", "--question", "x", "--agent", "script"])).out;
  assert.match(silent, /NOT reported: 2 — read these again/);
  assert.equal((await w.run(["read", "B1", "--images", "1-3", "--agent", "script"])).code, 2, "the question is required");
  w.cleanup();
});
