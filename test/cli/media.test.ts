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

test("an image registered only in parts: a crop or a half of the whole image is shown from the part that covers it, nothing fetched; none covers it — said", opts, async () => {
  const { w } = await world();
  const img = decodeImage(new Uint8Array(fs.readFileSync(path.join(fixtures, "s0001.jpg"))));
  // image 3 only as its two halves (each 200×300 of a 400×300 image), image 2 only as one part of it
  const other = decodeImage(new Uint8Array(fs.readFileSync(path.join(fixtures, "s0002.jpg"))));
  for (const [f, side, from] of [["s0003L.jpg", "left", img], ["s0003P.jpg", "right", other]] as const) {
    fs.writeFileSync(path.join(w.dir, f), encodeImage(resize(from, 200, 300), "jpeg"));
    await w.ok(["media", "add", path.join(w.dir, f), "--recordset", "B1", "--image", "3", "--half", side]); // M0001, M0002
  }
  fs.writeFileSync(path.join(w.dir, "detail.jpg"), encodeImage(resize(img, 400, 300), "jpeg"));
  await w.ok(["media", "add", path.join(w.dir, "detail.jpg"), "--recordset", "B1", "--image", "2", "--crop", "0.5,0.25,0.5,0.5"]); // M0003
  // a crop on the right page: the right half, the place in its own pixels
  const right = (await w.ok(["media", "view", "B1:3", "--crop", "0.6,0.2,0.3,0.5", "--json"])).json;
  assert.equal(right.image, "M0002");
  assert.equal(right.from, "M0002");
  assert.deepEqual(right.region, { x: 40, y: 60, w: 120, h: 150 }, "0.6–0.9 of the whole is 0.2–0.8 of the right half");
  assert.match(right.clip, /^M0002@0\.2,0\.2,0\.6,0\.5$/);
  const said = (await w.ok(["media", "view", "B1:3", "--crop", "0.1,0.1,0.3,0.3"])).out;
  assert.match(said, /from M0001, the part of the image that covers it \(part 0,0,0\.5,1; the image is registered only in parts\)/);
  // a half: the part that is that half (a half with its strip past the gutter too)
  assert.equal((await w.ok(["media", "view", "B1:3", "--half", "right", "--json"])).json.image, "M0002");
  const both = (await w.ok(["media", "view", "B1:3", "--half", "both", "--json"])).json;
  assert.deepEqual(both.views.map((v: { image: string }) => v.image), ["M0001", "M0002"]);
  // one part only: a crop of the whole image, not of the part
  const two = (await w.ok(["media", "view", "B1:2", "--crop", "0.6,0.3,0.2,0.2", "--json"])).json;
  assert.equal(two.image, "M0003");
  assert.deepEqual(two.region, { x: 80, y: 30, w: 160, h: 120 }, "0.6,0.3 of the whole is 0.2,0.1 of the part 0.5,0.25,0.5,0.5");
  // no part covers it: said with the parts there are — nothing fetched, no request to an archive
  const across = await w.run(["media", "view", "B1:3", "--crop", "0.3,0.2,0.4,0.3"]);
  assert.equal(across.code, 2);
  assert.match(across.err, /image 3 of B0001 is registered only in parts, and none of them covers 0\.3,0\.2,0\.4,0\.3: M0001 \(part 0,0,0\.5,1\), M0002 \(part 0\.5,0,0\.5,1\)/);
  assert.ok(!fs.existsSync(path.join(w.home, "shared", "net")), "no archive asked");
  // the whole image named without a place still asks which part
  assert.equal((await w.run(["media", "view", "B1:3"])).code, 2);
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
  assert.match((await w.ok(["brief", "T1"])).out, /no images here yet — the user saves them by hand \(never scrape an archive\): strom task wait <T…> --images B0001:<numbers> --on "<for the user, impersonal, in the research language/);
  await w.ok(["task", "wait", "T1", "--on", "images 1–3 of B0001 in the inbox"]);
  assert.equal((await w.ok(["task", "next", "--json"])).json.task, null, "a waiting task is not offered");
  // the user sees what the research waits for
  for (const cmd of [["status"], []]) assert.match((await w.ok(cmd)).out, /čeká \(1\)\n  T0001  images 1–3 of B0001 in the inbox\n  snímky patří do schránky \(inbox\), pro každou knihu vlastní složka, každý pojmenovaný číslem snímku/);
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
    /čeká \(1\)\n  T0001  snímky 9–10 knihy Žďár \(https:\/\/archive\.example\.org\/book\/5359\)\n {9}snímky 9–10 z B0002 Žďár N 1784–1820 · https:\/\/archive\.example\.org\/book\/5359\n {9}uložit je do .*B0002 Žďár N 1784–1820[\/\\]\n/,
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
  // a reader that wrote its report whole, its own head in the research language: strom's head back on top, and the
  // reading found again by the command strom read names
  w.env.AGENT_MODE = "reader-own-head";
  const own = await w.run(["read", "B1:5", "--question", "celý přepis", "--agent", "script", "--json"]);
  const ownText = fs.readFileSync(own.json.reports[0], "utf8");
  assert.match(ownText, /^# Reading M0005 · batch 1 of 1\nQuestion: celý přepis\n/);
  assert.match(ownText, /# Čtení M0005[\s\S]*## Image 5 · M0005\nresult: found/);
  const stem = path.basename(own.json.reports[0], ".md").replace(/-1$/, "");
  assert.match((await w.ok(["readings", stem])).out, new RegExp(`^${stem} · 1 report\\(s\\) · B0001 · images 5 · found 5`));
  delete w.env.AGENT_MODE;
  assert.equal((await w.run(["read", "B1", "--images", "1-3", "--agent", "script"])).code, 2, "the question is required");
  w.cleanup();
});

test("strom read: a double page in halves only where reading closely matters (blind, verify, unclear before), each page sharper; otherwise whole", opts, async () => {
  const { w } = await world();
  // synthetic scans: lines of "script" on paper (no real scan in the repository)
  const scan = (width: number, height: number) => {
    const data = new Uint8Array(width * height * 3);
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) data.fill(y % 23 < 3 && x % 41 < 30 ? 40 : 235, (y * width + x) * 3, (y * width + x) * 3 + 3);
    return encodeImage({ width, height, channels: 3, data }, "jpeg");
  };
  const dir = path.join(w.dir, "spreads");
  fs.mkdirSync(dir);
  fs.writeFileSync(path.join(dir, "s0001.jpg"), scan(1200, 800)); // a double page (3:2: each page 1.5× sharper in its half)
  fs.writeFileSync(path.join(dir, "s0002.jpg"), scan(600, 900)); // a single page: taller than wide
  fs.writeFileSync(path.join(dir, "s0003.jpg"), scan(500, 350)); // a double page small enough to be seen whole at its own pixels
  fs.writeFileSync(path.join(dir, "s0004.jpg"), scan(1100, 900)); // a near-square spread: its halves 1.2× sharper — not worth two views
  await w.ok(["media", "add", dir, "--recordset", "B1"]);
  w.env.STROM_RUNNER_SCRIPT = path.join(import.meta.dirname, "..", "fixtures", "agent.ts");
  const prompts = path.join(w.dir, "prompts.txt");
  w.env.READER_PROMPT_OUT = prompts;
  const read = async (...more: string[]) => {
    fs.writeFileSync(prompts, "");
    // --max 600 stands in for the model's limit: the spread in one view would be 600×400, 300 px a page
    const r = await w.run(["read", "B1", "--images", "1-4", "--question", "Křty Nováků", "--max", "600", "--batch", "4", "--agent", "script", "--json", ...more]);
    assert.equal(r.code, 0, r.out + r.err);
    return { r, prompt: fs.readFileSync(prompts, "utf8") };
  };
  // the first reading of a range: every image whole, one view each
  const first = await read();
  assert.doesNotMatch(first.prompt, /double page/);
  for (const n of [1, 2, 3, 4]) assert.match(first.prompt, new RegExp(`^- M000${n} · image ${n}: .+\\.jpg$`, "m"));
  assert.equal(first.r.json.reports.length, 1);
  assert.equal(first.r.json.halves, undefined);

  // a blind reading (verification): the spread in halves, the others whole
  const blind = await read("--blind");
  assert.match(blind.prompt, /^A double page comes as its two halves.*\nrun across both pages: read the two halves of an image together/m);
  const halves = /^- M0001 · image 1 — a double page in two halves:\n {4}left half: (.+)\n {4}right half: (.+)$/m.exec(blind.prompt);
  assert.ok(halves, blind.prompt);
  assert.match(blind.prompt, /^- M0002 · image 2: .+\.jpg$/m, "a single page whole");
  assert.match(blind.prompt, /^- M0003 · image 3: .+\.jpg$/m, "a small scan whole: halves would be no sharper");
  assert.match(blind.prompt, /^- M0004 · image 4: .+\.jpg$/m, "a near-square spread whole: its halves gain less than 1.25×");
  assert.match(blind.prompt, /^## Image <image number> · <M… id>$/m, "one block per image, as before");
  // each half within the limit, and the pages sharper: more pixels of the scan in each view
  const size = (f: string) => decodeImage(new Uint8Array(fs.readFileSync(f)));
  const [left, right] = [size(halves[1]!), size(halves[2]!)];
  assert.deepEqual([left.width, left.height], [486, 600]);
  assert.deepEqual([right.width, right.height], [486, 600]);
  const whole = (await w.ok(["media", "view", "B1:1", "--max", "600", "--json"])).json;
  assert.deepEqual([whole.width, whole.height], [600, 400]);
  const page = (v: { width: number; height: number }, share: number) => v.width * share * v.height;
  assert.ok(page(left, 0.5 / 0.54) > 2 * page(whole, 0.5), "a page in its half has more than twice the pixels it has in the whole spread");
  // the halves overlap at the gutter: 4 % of the width past the middle on each side
  const views = fs.readFileSync(path.join(w.cwd, ".strom", "views", "views.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l)).filter((v) => v.key === "M0001" && v.region.x + v.region.w <= 1200 && v.region.w < 1200);
  assert.deepEqual(views.slice(0, 2).map((v) => v.region), [{ x: 0, y: 0, w: 648, h: 800 }, { x: 552, y: 0, w: 648, h: 800 }]);
  // a reader takes views, not images: the halves are two of its four
  assert.equal(blind.r.json.reports.length, 2, "spread + two images, then the last one");
  assert.equal(blind.r.json.halves, 1);
  assert.deepEqual(blind.r.json.found.map((f: { image: number }) => f.image), [1, 4], "image numbers as before");
  assert.match((await w.run(["read", "B1", "--images", "1-3", "--question", "x", "--max", "600", "--blind", "--agent", "script"])).out, /^read 3 images \(1 double pages as their halves: blind reading\) in 1 batch\(es\)/m);
  // --whole: one view of each image, also blind
  assert.match((await read("--blind", "--whole")).prompt, /^- M0001 · image 1: .+\.jpg$/m);

  // an image a reader found unclear before comes in halves when it is read again; the others stay whole
  fs.writeFileSync(path.join(w.cwd, "notes", "readings", "2000-01-01-B1-1-4-1.md"), "# Reading B1-1-4 · batch 1 of 1\nQuestion: x\n\n## Image 1 · M0001\nresult: unclear\nentries: snad Novák\n\n## Image 4 · M0004\nresult: unclear\n\n");
  const again = await read();
  assert.match(again.prompt, /^- M0001 · image 1 — a double page in two halves:/m);
  assert.match(again.prompt, /^- M0004 · image 4: .+\.jpg$/m, "unclear, but a near-square spread: whole");
  assert.match((await w.run(["read", "B1", "--images", "1-2", "--question", "x", "--max", "600", "--agent", "script"])).out, /^read 2 images \(1 double pages as their halves: unclear before\)/m);
  fs.rmSync(path.join(w.cwd, "notes", "readings", "2000-01-01-B1-1-4-1.md"));

  // --half both: halves anyway; --half left|right: that page, with the strip past the gutter
  assert.match((await read("--half", "both")).prompt, /^- M0001 · image 1 — a double page in two halves:/m);
  fs.writeFileSync(prompts, "");
  await w.ok(["read", "B1:1", "--question", "x", "--half", "right", "--max", "600", "--agent", "script"]);
  const rightOnly = /^- M0001 · image 1: (.+\.jpg)$/m.exec(fs.readFileSync(prompts, "utf8"))!;
  assert.deepEqual([size(rightOnly[1]!).width, size(rightOnly[1]!).height], [486, 600]);
  assert.equal((await w.run(["read", "B1:1", "--question", "x", "--half", "left", "--whole", "--agent", "script"])).code, 2);
  assert.equal((await w.run(["read", "B1:1", "--question", "x", "--half", "middle", "--agent", "script"])).code, 2);

  // a reading in a verify task: the spread in halves
  await w.ok(["task", "add", "Ověřit křest", "--level", "verify", "--where", "B1", "--why", "jedno čtení", "--done-when", "přečteno znovu"]);
  await w.ok(["session", "start", "T0001"]);
  const verify = await read();
  assert.match(verify.prompt, /^- M0001 · image 1 — a double page in two halves:/m);
  assert.equal(verify.r.json.halves, 1);
  w.cleanup();
});

test("media view: a whole image at 1400 px to find the entry; a half, a crop, a grid's part as big as the model of the agent that opens it takes — 2000 px for the newer ones, else 1568", opts, async () => {
  const { w } = await world();
  const dir = path.join(w.dir, "big");
  fs.mkdirSync(dir);
  const data = new Uint8Array(3000 * 2000 * 3).fill(220);
  fs.writeFileSync(path.join(dir, "s0001.jpg"), encodeImage({ width: 3000, height: 2000, channels: 3, data }, "jpeg"));
  await w.ok(["media", "add", dir, "--recordset", "B1"]);
  const width = async (env: Record<string, string> = {}, ...more: string[]) => {
    Object.assign(w.env, env);
    try {
      const j = (await w.ok(["media", "view", "B1:1", "--json", ...more])).json;
      return Math.max(...(j.views ?? [j]).map((v: { width: number; height: number }) => Math.max(v.width, v.height))) as number;
    } finally {
      for (const k of Object.keys(env)) delete w.env[k];
    }
  };
  // a whole image: 1400 px for every agent and model (it is for finding the entry), --grid too
  assert.equal(await width(), 1400);
  assert.equal(await width({ CLAUDECODE: "1", STROM_MODEL: "claude-opus-5-5" }), 1400);
  assert.equal(await width({}, "--grid"), 1400);
  assert.equal(await width({ CLAUDECODE: "1", STROM_MODEL: "claude-sonnet-4-6" }), 1400);
  assert.equal(await width({ STROM_AGENT: "grok" }), 1400);
  assert.match((await w.ok(["media", "view", "B1:1"])).out, /1400×933 px · whole image of 3000×2000 · 47 % — reduced: crop the part you need .*; a whole view is for finding the entry; unclear, or the entry not where expected: --half both before calling it not found$/m);
  // a part of it: what the model takes in whole — Claude Code with its own model (the current line), or a model of it named
  assert.equal(await width({}, "--half", "left"), 2000, "a page of 1500×2000 px at full size");
  assert.equal(await width({ STROM_AGENT: "grok" }, "--half", "left"), 1568);
  assert.equal(await width({}, "--crop", "0,0,0.9,0.9"), 2000);
  assert.equal(await width({ CLAUDECODE: "1", STROM_MODEL: "claude-opus-5-5" }, "--crop", "0,0,0.9,0.9"), 2000);
  assert.equal(await width({ CLAUDECODE: "1", STROM_MODEL: "claude-sonnet-4-6" }, "--crop", "0,0,0.9,0.9"), 1568, "an older model: what it takes");
  assert.equal(await width({}, "--split", "1x2"), 2000, "the parts of --split");
  assert.doesNotMatch((await w.ok(["media", "view", "B1:1", "--crop", "0,0,0.9,0.9"])).out, /a whole view is for finding/);
  // the agent in whose shell strom runs, else the research's
  assert.equal(await width({ GROK_AGENT: "1" }, "--crop", "0,0,0.9,0.9"), 1568);
  assert.equal(await width({ STROM_AGENT: "antigravity" }, "--crop", "0,0,0.9,0.9"), 1568);
  assert.equal(await width({ STROM_AGENT: "codex" }, "--crop", "0,0,0.9,0.9"), 2000);
  assert.equal(await width({ OPENCODE: "1", STROM_AGENT: "grok" }, "--crop", "0,0,0.9,0.9"), 2000, "OpenCode's shell, though the research's agent is another");
  // --max and --scale as before, for a whole image too
  assert.equal(await width({}, "--max", "800"), 800);
  assert.equal(await width({}, "--max", "2000"), 2000);
  assert.equal(await width({ STROM_AGENT: "grok" }, "--scale", "1"), 3000);
  w.cleanup();
});

test("strom read --crop: the parts of a crop as big as the readers' model takes them, not smaller", opts, async () => {
  const { w } = await world();
  const dir = path.join(w.dir, "big");
  fs.mkdirSync(dir);
  fs.writeFileSync(path.join(dir, "s0001.jpg"), encodeImage({ width: 3000, height: 2000, channels: 3, data: new Uint8Array(3000 * 2000 * 3).fill(210) }, "jpeg"));
  await w.ok(["media", "add", dir, "--recordset", "B1"]);
  w.env.STROM_RUNNER_SCRIPT = path.join(import.meta.dirname, "..", "fixtures", "agent.ts");
  // --max 2000 stands in for a model that takes 2000 px: a crop of 2700×1800 px read in two overlapping parts of 2000
  const r = await w.run(["read", "B1:1", "--crop", "0,0,0.9,0.9", "--max", "2000", "--question", "x", "--agent", "script"]);
  assert.equal(r.code, 0, r.out + r.err);
  const views = fs.readFileSync(path.join(w.cwd, ".strom", "views", "views.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
  const parts = views.filter((v) => v.region.w === 2000 && v.region.h === 1800);
  assert.equal(parts.length, 2, JSON.stringify(views.map((v) => v.region)));
  for (const v of parts) assert.equal(v.scale, 1, "at full resolution, within what the model takes");
  w.cleanup();
});

test("strom read: what the readers wrote comes back compact, and images read before are said before they are read again", opts, async () => {
  const { w, scans } = await world();
  await w.ok(["media", "add", scans, "--recordset", "B1"]);
  w.env.STROM_RUNNER_SCRIPT = path.join(import.meta.dirname, "..", "fixtures", "agent.ts");
  w.env.AGENT_MODE = "reader-rich";
  const r = await w.run(["read", "B1", "--images", "1-3", "--question", "Úmrtí Dvořák 1850–1855", "--context", "dům č. 12", "--agent", "script"]);
  assert.equal(r.code, 0, r.out + r.err);
  assert.doesNotMatch(r.out, /already read/, "nothing read before");
  assert.match(r.out, /found on: 1\n {2}1 \[found\] M0001\n {4}Franz · 18\. Oktober · Haus 13\n/);
  // a possible match the reader hid in a block with nothing found, and the gap of the book
  assert.match(r.out, /^ {2}2 \[nothing\] illegible: 3\. zápis: muž, 58 let, příjmení nečitelné, dům sedí — rodina snad na 50 %$/m);
  assert.doesNotMatch(r.out, /^ {2}3 \[nothing\]/m, "a block with nothing found and nothing illegible is left out");
  assert.match(r.out, /gaps in the book \(by image\): 2: strany 11–20 chybí: po 10 následuje 21/);
  assert.match(r.out, /--by reader --result found --note "strany 11–20 chybí: po 10 následuje 21"\n/);
  assert.match(r.out, /strom readings \d{4}-\d\d-\d\d-B0001-1-3 \(this again\), strom readings B0001 --image <n>/);
  const [report] = fs.readdirSync(path.join(w.cwd, "notes", "readings"));
  assert.match(fs.readFileSync(path.join(w.cwd, "notes", "readings", report!), "utf8"), /^# Reading B0001-1-3 · batch 1 of 1\nQuestion: Úmrtí Dvořák 1850–1855\nContext: dům č\. 12\n\n## Image 1/);
  // the same images again: said first (never refused), with the reading to look at
  const again = await w.run(["read", "B1", "--images", "2-3", "--question", "Křty Dvořák", "--agent", "script", "--json"]);
  assert.equal(again.code, 0, again.out + again.err);
  assert.match(again.err, /^already read: images 2–3 on \d{4}-\d\d-\d\d \("Úmrtí Dvořák 1850–1855"\) — see it: strom readings \d{4}-\d\d-\d\d-B0001-1-3$/m);
  assert.deepEqual(again.json.earlier.readings[0].images, [2, 3]);
  assert.equal(again.json.blocks.find((b: { image: number }) => b.image === 3).illegible[0], "3. zápis: muž, 58 let, příjmení nečitelné, dům sedí — rodina snad na 50 %");
  // a search recorded by readers over the same pages is said too; other images are not
  await w.ok(["search", "add", "Úmrtí Dvořák", "--recordset", "B1", "--pages", "1-2", "--method", "page-by-page", "--by", "reader", "--result", "negative"]);
  const third = await w.run(["read", "B1:3", "--question", "x", "--agent", "script"]);
  assert.match(third.out, /^already read: images 3 on /m);
  assert.doesNotMatch(third.out, /already recorded/, "the search covered images 1–2 only");
  const first = await w.run(["read", "B1:1", "--question", "x", "--agent", "script"]);
  assert.match(first.out, /^already recorded: Q0001 \[negative\] "Úmrtí Dvořák" pages 1-2 by reader$/m);
  w.cleanup();
});
