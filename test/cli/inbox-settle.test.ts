// Scans saved by hand named otherwise than the viewer counts them (spec 141): a file whose name gives 0 lies there and
// never holds back the rest (K1.1); a name that is a range of the entries on a scan is never one image's number (K1.2);
// files named not by the images' numbers are taken in the folder's order once it settled, the task back to tell each by
// its content (K1.3); a task a part of whose images came goes back once nothing more is saved for a long while — never
// at once, never one nothing came for (K1.5); another sheet under one number (7a.jpg) is told by its content — a copy,
// a zoomed-in part, or a scan of its own, never hidden and nothing asked (K1.4).

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import { inboxFolderFor } from "../../src/core/media.ts";
import { SETTLE_MS } from "../../src/core/inboxwait.ts";
import { dueAfterQuiet } from "../../src/core/inboxsettle.ts";
import type { Media, Task } from "../../src/core/model.ts";
import { encodeJpeg } from "../../src/image/jpeg-encode.ts";
import { page, zoomed } from "../scanpages.ts";

const opts = { skip: !hasGit };
const fixtures = path.join(import.meta.dirname, "..", "fixtures", "images");
const SCANS = ["base420.jpg", "base444.jpg", "cmyk.jpg", "grey.jpg", "prog420.jpg", "proggrey.jpg", "restart.jpg"];
/** The folder counts as settled at once. */
const QUIET = { STROM_INBOX_QUIET_MS: "0" };

/** A file saved long enough ago to have been written whole. */
function saved(from: string, to: string): void {
  fs.copyFileSync(path.join(fixtures, from), to);
  const past = new Date(Date.now() - 2 * SETTLE_MS);
  fs.utimesSync(to, past, past);
}

async function waiting(images: string): Promise<{ w: World; shared: string; dir: string }> {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["research", "new", "X", "--new-person", "Jan /Lhoták/"]);
  await w.ok(["recordset", "add", "Lhota N 1798–1799", "--url", "https://archive.example.org/book/77"]); // B1
  await w.ok(["task", "add", "Křest Jana", "--level", "link", "--where", "B1", "--why", "a", "--done-when", "b"]); // T1
  await w.ok(["task", "wait", "T1", "--images", `B1:${images}`, "--on", "skeny ročníků 1798–1799 v prohlížeči, první sken = 1"]);
  const shared = path.join(w.home, "shared");
  const dir = path.join(shared, "inbox", inboxFolderFor({ id: "B0001", title: "Lhota N 1798–1799" }));
  fs.mkdirSync(dir, { recursive: true });
  return { w, shared, dir };
}

const task = (w: World) => Tree.open(w.cwd, w.env).get<Task>("T0001")!;
const media = (w: World) => Tree.open(w.cwd, w.env).list<Media>("media").filter((m) => m.recordset === "B0001");

test("K1.1 + K1.5: 000.jpg lies there, 001–007 are taken; the task asked for 1–8 comes back once the folder settled, never before", opts, async () => {
  const { w, shared, dir } = await waiting("1-8");
  saved("s0001.jpg", path.join(dir, "000.jpg"));
  SCANS.forEach((f, i) => saved(f, path.join(dir, `00${i + 1}.jpg`)));
  // nothing was taken before: "the names give 0, 1–7"
  const took = await w.ok(["media", "add", "--inbox", "--waiting"]);
  assert.match(took.out, /images 1–7 of B0001 registered — T0001 still waits for images 8/u);
  assert.match(took.out, /left lying: 000\.jpg \(its name gives 0, no image's number\)/u);
  assert.deepEqual(media(w).map((m) => m.image).sort((a, b) => a! - b!), [1, 2, 3, 4, 5, 6, 7]);
  assert.ok(fs.existsSync(path.join(dir, "000.jpg")), "000.jpg stays lying");
  // the status says what lies there
  assert.match((await w.ok(["status"])).out, /000\.jpg/u);
  // the person may still be saving: the task waits (20 minutes by default)
  await w.ok(["media", "add", "--inbox", "--waiting"]);
  assert.equal(task(w).state, "waiting", "never back at once");
  assert.deepEqual([...dueAfterQuiet(Tree.open(w.cwd, w.env), shared)], [], "not due for the bridge either");
  // settled: due for the bridge though nothing in the folder changed, back with what came and what is missing
  assert.deepEqual([...dueAfterQuiet(Tree.open(w.cwd, { ...w.env, ...QUIET }), shared)], [dir]);
  const back = await w.ok(["media", "add", "--inbox", "--waiting"], { env: QUIET });
  assert.match(back.out, /settled — back in the queue with a part of the images: T0001/u);
  const t = task(w);
  assert.equal(t.state, "open");
  assert.equal(t.awaits, undefined);
  assert.match(t.notes.map((n) => n.text).join(" "), /of images 1–8 of B0001 1–7 came, 8 missing; left lying there: 000\.jpg .*a scan on the boundary of two years is one scan, counted once.*strom task wait T0001 --images B0001:8/u);
  // done: never due again
  assert.deepEqual([...dueAfterQuiet(Tree.open(w.cwd, { ...w.env, ...QUIET }), shared)], []);
  // 000.jpg lies there on purpose, said once in the task's note: never again at the next look of the bridge or a
  // session, never advice to rename it, never the task that waits no more (n1)
  for (let i = 0; i < 2; i++) {
    const again = await w.ok(["media", "add", "--inbox", "--waiting", "--json"], { env: QUIET });
    assert.deepEqual(again.json.taken, [], again.out);
    assert.doesNotMatch(again.out, /000\.jpg|name each|rename|T0001/u);
  }
  assert.ok(fs.existsSync(path.join(dir, "000.jpg")), "000.jpg still lying, as the person left it");
  w.cleanup();
});

test("K1.5: a task nothing came for waits on, settled or not", opts, async () => {
  const { w, shared } = await waiting("1-3");
  await w.ok(["media", "add", "--inbox", "--waiting"], { env: QUIET });
  assert.equal(task(w).state, "waiting");
  assert.deepEqual([...dueAfterQuiet(Tree.open(w.cwd, { ...w.env, ...QUIET }), shared)], []);
  w.cleanup();
});

test("K1.2 + K1.3: files named by the entries on them (000, 001-004, 005–007) are taken in the folder's order once it settled, the entries kept, the task back", opts, async () => {
  const { w, shared, dir } = await waiting("1-8");
  saved("s0001.jpg", path.join(dir, "000.jpg"));
  saved("base420.jpg", path.join(dir, "001-004.jpg"));
  saved("cmyk.jpg", path.join(dir, "005–007.jpg"));
  // never 4 and 7 of the viewer's count, never "rename to 4.jpg"
  const first = await w.ok(["media", "add", "--inbox", "--waiting"]);
  assert.match(first.out, /named not by the images' numbers .* taken in the folder's order once nothing more is saved for 20 minutes/u);
  assert.doesNotMatch(first.out, /rename|4\.jpg/u);
  assert.equal(media(w).length, 0);
  assert.equal(task(w).state, "waiting");
  assert.deepEqual([...dueAfterQuiet(Tree.open(w.cwd, { ...w.env, ...QUIET }), shared)], [dir]);
  const took = await w.ok(["media", "add", "--inbox", "--waiting"], { env: QUIET });
  assert.match(took.out, /in the folder's order: 001-004\.jpg → image 10 \(entries 1–4\)/u);
  // above every image asked for: never one of the viewer's numbers
  const ms = media(w).sort((a, b) => a.image! - b.image!);
  assert.deepEqual(ms.map((m) => [m.image, m.from, m.entries]), [
    [9, "000.jpg", undefined],
    [10, "001-004.jpg", { from: 1, to: 4 }],
    [11, "005–007.jpg", { from: 5, to: 7 }],
  ]);
  const t = task(w);
  assert.equal(t.state, "open");
  assert.match(t.notes.map((n) => n.text).join(" "), /3 files saved into .* were named not by the images' numbers \(by the entries on them\) — taken in the folder's order as images 9–11 of B0001/u);
  assert.deepEqual([...dueAfterQuiet(Tree.open(w.cwd, { ...w.env, ...QUIET }), shared)], []);
  w.cleanup();
});

test("K1.2: strom media add of a folder named by the entries: no image's number read off a range — --first numbers them, the entries kept", opts, async () => {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["research", "new", "X", "--new-person", "Jan /Lhoták/"]);
  await w.ok(["recordset", "add", "Lhota N 1798–1799"]); // B1
  const dir = path.join(w.home, "skeny");
  fs.mkdirSync(dir);
  saved("base420.jpg", path.join(dir, "001-004.jpg"));
  saved("cmyk.jpg", path.join(dir, "005-007.jpg"));
  const bare = await w.run(["media", "add", dir, "--recordset", "B1"]);
  assert.notEqual(bare.code, 0);
  assert.match(bare.err, /2 files without an image number in the name: 001-004\.jpg, 005-007\.jpg/u);
  assert.match(bare.err, /a name by the entries on a scan \(001-004\.jpg\) gives no image's number: --first <n>/u);
  const ok = await w.ok(["media", "add", dir, "--recordset", "B1", "--first", "1"]);
  assert.match(ok.out, /M0001 image 1: entries 1–4 by its name/u);
  assert.deepEqual(media(w).sort((a, b) => a.image! - b.image!).map((m) => [m.image, m.entries]), [
    [1, { from: 1, to: 4 }],
    [2, { from: 5, to: 7 }],
  ]);
  w.cleanup();
});

test("K1.3: a task waiting for a book the person looks through (--kind web --book): files named by the entries taken in the folder's order once it settled, the task back", opts, async () => {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["research", "new", "X", "--new-person", "Jan /Lhoták/"]);
  await w.ok(["recordset", "add", "Lhota N 1798–1799", "--url", "https://archive.example.org/book/77"]); // B1
  await w.ok(["task", "add", "Křest Jana", "--level", "link", "--where", "B1", "--why", "a", "--done-when", "b"]); // T1
  await w.ok(["task", "wait", "T1", "--kind", "web", "--book", "B1", "--on", "akty ročníků 1798–1799 v prohlížeči knihy Lhota"]);
  const shared = path.join(w.home, "shared");
  const dir = path.join(shared, "inbox", inboxFolderFor({ id: "B0001", title: "Lhota N 1798–1799" }));
  fs.mkdirSync(dir, { recursive: true });
  saved("s0001.jpg", path.join(dir, "000.jpg"));
  saved("base420.jpg", path.join(dir, "001-004.jpg"));
  saved("cmyk.jpg", path.join(dir, "005-007.jpg"));
  const first = await w.ok(["media", "add", "--inbox", "--waiting"]);
  assert.doesNotMatch(first.out, /rename|40\.jpg|not taken/u);
  assert.equal(media(w).length, 0);
  assert.deepEqual([...dueAfterQuiet(Tree.open(w.cwd, { ...w.env, ...QUIET }), shared)], [dir]);
  await w.ok(["media", "add", "--inbox", "--waiting"], { env: QUIET });
  assert.deepEqual(media(w).sort((a, b) => a.image! - b.image!).map((m) => [m.image, m.entries]), [
    [1, undefined],
    [2, { from: 1, to: 4 }],
    [3, { from: 5, to: 7 }],
  ]);
  assert.equal(task(w).state, "open");
  w.cleanup();
});

/** A made-up scan written as a JPEG, saved long enough ago. */
function scan(img: Parameters<typeof encodeJpeg>[0], to: string): void {
  fs.writeFileSync(to, encodeJpeg(img, 85));
  const past = new Date(Date.now() - 2 * SETTLE_MS);
  fs.utimesSync(to, past, past);
}

test("K1.4: 7.jpg and 7a.jpg in one take — another scan is a scan of its own with no number, a zoomed-in part a part of image 7; nothing hidden, nothing asked", opts, async () => {
  const { w, dir } = await waiting("7");
  scan(page(1), path.join(dir, "007.jpg"));
  scan(page(2), path.join(dir, "007a.jpg"));
  scan(zoomed(page(1), { x: 0.2, y: 0.3, w: 0.5, h: 0.3 }, 2, false), path.join(dir, "007b.jpg"));
  const took = await w.ok(["media", "add", "--inbox", "--waiting"]);
  assert.match(took.out, /images 7 of B0001 registered — back in the queue: T0001/u);
  assert.match(took.out, /007a\.jpg is another scan than image 7 of B0001 — M\d+, a scan of its own with no image number/u);
  assert.match(took.out, /007b\.jpg is a zoomed-in part of image 7 of B0001 — M\d+, part /u);
  assert.doesNotMatch(took.out, /set aside|⚠/u);
  const ms = media(w);
  const whole = ms.find((m) => m.image === 7 && !m.part)!;
  assert.equal(whole.from, "007.jpg", "the image is the scan named by its number alone — never the one with more pixels");
  const own = ms.find((m) => m.from === "007a.jpg")!;
  assert.equal(own.image, undefined);
  assert.equal(own.part, undefined);
  const part = ms.find((m) => m.from === "007b.jpg")!;
  assert.equal(part.image, 7);
  assert.ok(part.part && Math.abs(part.part.x - 0.2) < 0.04 && Math.abs(part.part.w - 0.5) < 0.04, JSON.stringify(part.part));
  // the task hears it, though the bridge took them
  assert.match(task(w).notes.map((n) => n.text).join(" "), /007a\.jpg is another scan than image 7/u);
  assert.deepEqual(fs.existsSync(dir) ? fs.readdirSync(dir) : [], [], "nothing left lying");
  w.cleanup();
});

test("K1.4: 7a.jpg in a later take — another scan registered as its own (no question, never set aside); a reduced copy stays a copy of image 7", opts, async () => {
  const { w, dir } = await waiting("7");
  scan(page(1), path.join(dir, "7.jpg"));
  await w.ok(["media", "add", "--inbox", "--waiting"]);
  await w.ok(["task", "wait", "T1", "--images", "B1:8", "--on", "sken 8 knihy Lhota"]);
  fs.mkdirSync(dir, { recursive: true });
  scan(page(3), path.join(dir, "7a.jpg"));
  const later = await w.ok(["media", "add", "--inbox", "--waiting"]);
  assert.match(later.out, /7a\.jpg is another scan than image 7 of B0001 — M\d+, a scan of its own/u);
  assert.doesNotMatch(later.out, /set aside|other-than|⚠/u);
  assert.equal(media(w).find((m) => m.from === "7a.jpg")!.image, undefined);
  assert.equal(media(w).find((m) => m.image === 7 && !m.part)!.from, "7.jpg");
  // the same scan saved smaller: a copy, as before
  scan(zoomed(page(1), { x: 0, y: 0, w: 1, h: 1 }, 0.5, false), path.join(dir, "7b.jpg"));
  const copy = await w.ok(["media", "add", "--inbox", "--waiting"]);
  assert.doesNotMatch(copy.out, /another scan|zoomed-in part/u);
  assert.equal(media(w).find((m) => m.from === "7b.jpg")!.image, 7);
  w.cleanup();
});

/** A book with its folder of the shared inbox and no task waiting on it. */
async function bookOnly(): Promise<{ w: World; dir: string; folder: string }> {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["research", "new", "X", "--new-person", "Jan /Lhoták/"]);
  await w.ok(["recordset", "add", "Lhota N 1798–1799", "--url", "https://archive.example.org/book/77"]); // B1
  const folder = inboxFolderFor({ id: "B0001", title: "Lhota N 1798–1799" });
  const dir = path.join(w.home, "shared", "inbox", folder);
  fs.mkdirSync(dir, { recursive: true });
  return { w, dir, folder };
}

test("K1.4 (n1): strom media add --inbox <folder>, no task waiting — 7a.jpg a zoomed-in part of image 7, 7c.jpg a scan of its own; never hidden as copies of 7", opts, async () => {
  const { w, dir, folder } = await bookOnly();
  for (let n = 1; n <= 7; n++) scan(page(10 + n), path.join(dir, `${n}.jpg`));
  scan(zoomed(page(17), { x: 0.2, y: 0.3, w: 0.4, h: 0.3 }, 2, false), path.join(dir, "7a.jpg"));
  scan(page(30), path.join(dir, "7c.jpg"));
  const took = await w.ok(["media", "add", "--inbox", folder.normalize("NFD")]);
  assert.match(took.out, /7a\.jpg is a zoomed-in part of image 7 of B0001 — M\d+, part /u);
  assert.match(took.out, /7c\.jpg is another scan than image 7 of B0001 — M\d+, a scan of its own with no image number/u);
  assert.doesNotMatch(took.out, /copies|sharper/u);
  const ms = media(w);
  assert.equal(ms.find((m) => m.image === 7 && !m.part)!.from, "7.jpg");
  const part = ms.find((m) => m.from === "7a.jpg")!;
  assert.equal(part.image, 7);
  assert.ok(part.part && Math.abs(part.part.x - 0.2) < 0.04 && Math.abs(part.part.w - 0.4) < 0.04, JSON.stringify(part.part));
  const own = ms.find((m) => m.from === "7c.jpg")!;
  assert.equal(own.image, undefined);
  assert.equal(own.part, undefined);
  // nothing set aside or left lying: each is in the store
  assert.deepEqual(fs.existsSync(dir) ? fs.readdirSync(dir) : [], []);
  w.cleanup();
});

test("K1.4 (n1): 2a.jpg and 2c.jpg saved after the task came back — told by the content, by strom media add --inbox <folder> and by the bridge's take alike", opts, async () => {
  const { w, dir } = await waiting("1-2");
  scan(page(41), path.join(dir, "1.jpg"));
  scan(page(42), path.join(dir, "2.jpg"));
  const first = await w.ok(["media", "add", "--inbox", "--waiting"]);
  assert.match(first.out, /back in the queue: T0001/u);
  assert.equal(task(w).state, "open");
  // the person saves a zoomed-in part of image 2 afterwards: strom media add naming the folder (the bridge's hint)
  fs.mkdirSync(dir, { recursive: true });
  scan(zoomed(page(42), { x: 0.5, y: 0.4, w: 0.3, h: 0.3 }, 2, false), path.join(dir, "2a.jpg"));
  const named = await w.ok(["media", "add", "--inbox", path.basename(dir)]);
  assert.match(named.out, /2a\.jpg is a zoomed-in part of image 2 of B0001 — M\d+, part /u);
  assert.doesNotMatch(named.out, /copies|sharper/u);
  assert.equal(media(w).find((m) => m.from === "2a.jpg")!.image, 2);
  // another page under 2 taken by the bridge (the folder of a book its task still needs): a scan of its own, never set aside
  fs.mkdirSync(dir, { recursive: true });
  scan(page(50), path.join(dir, "2c.jpg"));
  const bridge = await w.ok(["media", "add", "--inbox", "--waiting"]);
  assert.match(bridge.out, /2c\.jpg is another scan than image 2 of B0001 — M\d+, a scan of its own with no image number/u);
  assert.doesNotMatch(bridge.out, /set aside|other-than|⚠|still waits/u);
  const own = media(w).find((m) => m.from === "2c.jpg")!;
  assert.equal(own.image, undefined);
  assert.equal(media(w).find((m) => m.image === 2 && !m.part)!.from, "2.jpg");
  w.cleanup();
});
