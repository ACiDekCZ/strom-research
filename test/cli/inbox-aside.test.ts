// The inbox of images saved by hand, made safe (B0408, B0374): a file's number only when its name says it unambiguously,
// the order only when no file of the batch has a number, a batch still downloading never taken; another scan saved
// under a number taken already never replaces the image unasked — set aside beside it, asked in What waits and the
// bridge's /status (strom media aside), a sharper copy of the same scan taken as before.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { World, hasGit } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import { inboxFolderFor, inboxFolders } from "../../src/core/media.ts";
import { asideFiles, downloadsIn, folderBusy, numberFiles, personNumbers, SETTLE_MS, STALLED_MS } from "../../src/core/inboxwait.ts";
import { sameScan, scanLikeness } from "../../src/core/samescan.ts";
import { waitingFor } from "../../src/core/waiting.ts";
import { encodeJpeg } from "../../src/image/jpeg-encode.ts";
import { decodeImage } from "../../src/image/index.ts";
import { crop, resize } from "../../src/image/image.ts";
import type { RawImage } from "../../src/image/image.ts";
import type { Media, Task } from "../../src/core/model.ts";

const opts = { skip: !hasGit };
const bridgeOpts = { skip: !hasGit || process.platform === "win32", timeout: 120_000 };

/** A request to the bridge as the Strom app makes it. */
function request(url: string, method = "GET", body?: unknown): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? undefined : Buffer.from(JSON.stringify(body), "utf8");
    const req = http.request(url, { agent: false, method, headers: { Origin: "https://beta.stromapp.info", ...(data ? { "Content-Type": "text/plain;charset=UTF-8", "Content-Length": String(data.length) } : {}) } }, (res) => {
      let text = "";
      res.setEncoding("utf8");
      res.on("data", (d) => (text += d));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, body: JSON.parse(text || "null") }));
    });
    req.on("error", reject);
    req.end(data);
  });
}

/**
 * A made-up page of a register: the printed form's lines (and columns), then handwriting (strokes) of its own seed.
 * The generator of the strokes: "float" an LCG in floating point as made up first (its streams run into each other —
 * pages of other seeds share a part of their strokes, drawn the same: the hardest other page), "even" one whose pages
 * are each their own (mulberry32).
 */
function page(seed: number, width = 600, height = 800, o: { strokes?: number; columns?: boolean; rng?: "float" | "even"; form?: false } = {}): RawImage {
  let s = seed;
  const r =
    o.rng === "even"
      ? () => {
          s = (s + 0x6d2b79f5) | 0;
          let t = Math.imul(s ^ (s >>> 15), 1 | s);
          t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
          return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        }
      : () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const d = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) d[y * width + x] = 225 - Math.round((x / width) * 25);
  if (o.form !== false) for (let y = 70; y < height; y += 40) for (let x = 30; x < width - 30; x++) d[y * width + x] = 60;
  if (o.form !== false && o.columns !== false) for (const x of [30, 140, 300, 470, width - 31]) for (let y = 70; y < height - 30; y++) d[y * width + x] = 60;
  for (let k = 0; k < (o.strokes ?? 500); k++) {
    let x = 40 + r() * (width - 80);
    let y = 80 + r() * (height - 120);
    const dx = (r() - 0.5) * 3;
    const dy = (r() - 0.5) * 3;
    for (let i = 0; i < 20; i++) {
      x += dx + (r() - 0.5);
      y += dy + (r() - 0.5);
      const xi = Math.round(x);
      const yi = Math.round(y);
      if (xi > 0 && yi > 0 && xi < width - 1 && yi < height - 1) d[yi * width + xi] = d[yi * width + xi + 1] = 35;
    }
  }
  return { width, height, channels: 1, data: d };
}

/** A page saved as a JPEG, long enough ago to have settled. */
function save(img: RawImage, to: string, quality = 85): void {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.writeFileSync(to, encodeJpeg(img, quality));
  const past = new Date(Date.now() - 2 * SETTLE_MS);
  fs.utimesSync(to, past, past);
}

function scratch(): string {
  return fs.mkdtempSync(path.join(fs.realpathSync(process.env.TMPDIR ?? "/tmp"), "aside-"));
}

test("B0408: a number from a file's name only when it says one — a copy's, a counter among numbers; the order only when no file has a number", () => {
  assert.deepEqual(personNumbers(["/x/33 2.jpg", "/x/33 - Copy (2).jpg", "/x/IMG_0057.jpg", "/x/snímek 8.jpg".normalize("NFD")]), [33, 33, 57, 8]);
  // a portal's counter among other numbers; two numbers and no counter; a screenshot's date and time; another script's digits
  assert.deepEqual(personNumbers(["/x/Lhota_1850-1870_00141_sign-4411.jpg", "/x/1784 33.jpg", "/x/Snímek obrazovky 2026-11-04 v 10.07.12.png".normalize("NFD"), "/x/снимок ٣٣.jpg"]), [141, undefined, undefined, undefined]);
  // one file of the batch with a number, one without: never numbered by the order (1.jpg of a task waiting for 33 → 33)
  const mixed = numberFiles(["/x/1.jpg", "/x/obrázek.jpg"], [33, 34], new Set(), "B0001");
  assert.ok("problem" in mixed && mixed.code === "inbox.count", JSON.stringify(mixed));
  // no number in any: by the order
  assert.deepEqual(numberFiles(["/x/a.jpg", "/x/Снимок.jpg".normalize("NFD")], [33, 34], new Set(), "B0001"), { numbers: [33, 34], by: "order" });
});

test("B0408: a batch still downloading is never taken — a browser's .crdownload, .part, a file of nothing yet; one stalled long since holds nothing", () => {
  const dir = scratch();
  try {
    const now = Date.now();
    const ago = (f: string, ms: number) => fs.utimesSync(f, new Date(now - ms), new Date(now - ms));
    const done = path.join(dir, "9.jpg");
    save(page(1, 60, 80), done);
    assert.equal(folderBusy(dir, [done], now), 0);
    // Chrome's download running beside it: the folder waits
    const running = path.join(dir, "Nestažený 10.jpg.crdownload".normalize("NFD"));
    fs.writeFileSync(running, "x");
    assert.deepEqual(downloadsIn(dir, now), [path.basename(running)]);
    assert.equal(folderBusy(dir, [done], now), 1);
    // stalled long since (a download given up): it holds nothing back
    ago(running, STALLED_MS + 1000);
    assert.equal(folderBusy(dir, [done], now), 0);
    // Firefox's .part, Safari's bundle (what is written is inside it)
    const part = path.join(dir, "11.jpg.part");
    fs.writeFileSync(part, "");
    assert.equal(folderBusy(dir, [done], now), 1);
    fs.rmSync(part);
    const bundle = path.join(dir, "12.jpg.download");
    fs.mkdirSync(bundle);
    fs.writeFileSync(path.join(bundle, "12.jpg"), "x");
    ago(bundle, STALLED_MS + 1000);
    assert.equal(folderBusy(dir, [done], now), 1, "the bundle's own file is still written");
    fs.rmSync(bundle, { recursive: true });
    // a file of nothing yet (created, its bytes to come): not taken for a while
    const empty = path.join(dir, "13.jpg");
    fs.writeFileSync(empty, "");
    ago(empty, SETTLE_MS * 2);
    assert.equal(folderBusy(dir, [done, empty], now), 1);
    ago(empty, STALLED_MS + 1000);
    assert.equal(folderBusy(dir, [done, empty], now), 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("B0374: the same scan made smaller or saved again is the same; another page of the same form, another shape is another scan", () => {
  const dir = scratch();
  try {
    const f = (n: string) => path.join(dir, n);
    save(page(1), f("a.jpg"), 90);
    save(resize(page(1), 300, 400), f("a-small.jpg"), 60);
    save(page(2), f("b.jpg"), 90);
    save(page(1, 800, 600), f("wide.jpg"), 90);
    save(crop(page(1), 0, 24, 600, 776), f("a-cut.jpg"), 85);
    save(crop(page(1), 24, 0, 576, 800), f("a-cut-left.jpg"), 90);
    save(resize(crop(page(1), 30, 0, 570, 800), 285, 400), f("a-cut-left-small.jpg"), 60);
    assert.equal(scanLikeness(f("a-small.jpg"), f("a.jpg")), "same");
    assert.equal(scanLikeness(f("a.jpg"), f("a-small.jpg")), "same");
    assert.equal(scanLikeness(f("a-cut.jpg"), f("a-small.jpg")), "same", "cut a little at the top");
    // cut at one side only (4 %, 5 % and reduced): its shape a little other, its writing compared (SHAPE_TOLERANCE)
    assert.equal(scanLikeness(f("a-cut-left.jpg"), f("a-small.jpg")), "same", "cut 4 % at the left");
    assert.equal(scanLikeness(f("a.jpg"), f("a-cut-left-small.jpg")), "same", "cut 5 % at the left and reduced");
    assert.equal(scanLikeness(f("b.jpg"), f("a.jpg")), "other");
    assert.equal(scanLikeness(f("wide.jpg"), f("a.jpg")), "other");
    // nothing written on a blank page of the form: never "same" (asked); nothing at all on it: it cannot be told
    save(page(1, 600, 800, { strokes: 0 }), f("form.jpg"), 90);
    save(resize(page(1, 600, 800, { strokes: 0 }), 300, 400), f("form-small.jpg"), 60);
    assert.notEqual(scanLikeness(f("form.jpg"), f("form-small.jpg")), "same");
    save(page(1, 600, 800, { strokes: 0, form: false }), f("blank.jpg"), 90);
    save(resize(page(1, 600, 800, { strokes: 0, form: false }), 300, 400), f("blank-small.jpg"), 60);
    assert.equal(scanLikeness(f("blank.jpg"), f("blank-small.jpg")), undefined);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("B0374: a large scan (thousands of pixels) is compared without being decoded whole — the comparison of two takes less than half the decoding of one (a budget of this computer now); same and other as at a small size", () => {
  const dir = scratch();
  try {
    const f = (n: string) => path.join(dir, n);
    // a page of 4000 × 3000 in colour (as a scan of an archive), its strokes made as thick as at that size
    const big = (seed: number): RawImage => {
      const small = page(seed, 800, 600, { rng: "even", strokes: 300 });
      const img = resize(small, 4000, 3000);
      return { ...img, channels: 3, data: img.data.reduce((out, v, i) => ((out[i * 3] = out[i * 3 + 1] = out[i * 3 + 2] = v), out), new Uint8Array(img.data.length * 3)) };
    };
    const a = big(1);
    save(a, f("a.jpg"), 85);
    save(resize(a, 1000, 750), f("a-small.jpg"), 60);
    save(big(2), f("b.jpg"), 85);
    const bytes = new Uint8Array(fs.readFileSync(f("a.jpg")));
    let t = performance.now();
    decodeImage(bytes);
    const whole = performance.now() - t;
    const timed = (x: string, y: string) => {
      const t0 = performance.now();
      const v = scanLikeness(x, y);
      return { v, ms: performance.now() - t0 };
    };
    const ab = timed(f("b.jpg"), f("a.jpg"));
    const again = timed(f("b.jpg"), f("a.jpg"));
    assert.equal(ab.v, "other");
    assert.ok(Math.min(ab.ms, again.ms) < whole / 2, `two scans compared in ${Math.min(ab.ms, again.ms).toFixed(0)} ms, one decoded whole ${whole.toFixed(0)} ms`);
    t = performance.now();
    assert.equal(scanLikeness(f("a.jpg"), f("a-small.jpg")), "same");
    assert.equal(scanLikeness(f("a-small.jpg"), f("a.jpg")), "same");
    assert.ok(performance.now() - t < whole, "a reduced copy against the scan");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("B0374: the bridge never compares scans in its own process — the inbox is taken by a strom of its own (media add --inbox), an answer to a file set aside too (media aside)", () => {
  // what the bridge's process loads: core/live.ts and all it imports (not a type alone); the comparison is not among them
  const src = path.join(import.meta.dirname, "..", "..", "src");
  const seen = new Set<string>();
  const todo = [path.join(src, "core", "live.ts")];
  while (todo.length) {
    const file = todo.pop()!;
    if (seen.has(file) || !fs.existsSync(file)) continue;
    seen.add(file);
    const text = fs.readFileSync(file, "utf8");
    for (const m of text.matchAll(/^\s*import\s+(?!type\b)[^;]*?from\s+"(\.[^"]+\.ts)"/gmsu)) todo.push(path.resolve(path.dirname(file), m[1]!));
    for (const m of text.matchAll(/import\("(\.[^"]+\.ts)"\)/gu)) todo.push(path.resolve(path.dirname(file), m[1]!));
  }
  assert.ok(seen.size > 50, `the bridge's modules found: ${seen.size}`);
  const rel = [...seen].map((x) => path.relative(src, x).split(path.sep).join("/"));
  assert.ok(!rel.includes("core/samescan.ts"), "core/samescan.ts loaded by the bridge");
  assert.ok(!rel.includes("commands/media.ts"), "commands/media.ts (takeFiles) loaded by the bridge");
  const live = fs.readFileSync(path.join(src, "core", "live.ts"), "utf8");
  assert.match(live, /"media", "add", "--inbox", "--waiting", "--json"/u);
  assert.match(live, /args: \["media", "aside", file as string/u);
});

/** A picture as it comes back from a JPEG of this quality. */
const jpeg = (img: RawImage, quality: number): RawImage => decodeImage(encodeJpeg(img, quality));

test("B0374: other pages of one printed form are never the same scan — dense writing seed against seed (200), sparse (100); copies of it are", () => {
  // the verifier's measure: a reduced page against 200 other pages of the form at full size (once 4.5 % "same")
  const dense = { strokes: 600, columns: false } as const;
  const reduced = jpeg(resize(page(1, 600, 800, dense), 300, 400), 60);
  const same: number[] = [];
  for (let s = 2; s < 202; s++) if (sameScan(jpeg(page(s * 7919 + 13, 600, 800, dense), 90), reduced) === "same") same.push(s);
  assert.deepEqual(same, [], "other pages taken for the same scan");
  // a page of the form with few entries: the printed rules are most of what is on it (the old comparison: all "same")
  const sparse = { strokes: 60, rng: "even" } as const;
  const few = jpeg(resize(page(1, 600, 800, sparse), 300, 400), 60);
  const sparseSame: number[] = [];
  for (let s = 2; s < 102; s++) if (sameScan(page(s, 600, 800, sparse), few) === "same") sparseSame.push(s);
  assert.deepEqual(sparseSame, [], "other sparse pages taken for the same scan");
  // the same scan: smaller, saved worse, odd sizes, much larger, cut a little (each side, one side) — the same
  for (const [kind, o] of [["dense", dense], ["sparse", sparse], ["a few lines", { strokes: 12, rng: "even" }]] as const) {
    const full = page(1, 600, 800, o);
    const small = jpeg(resize(full, 300, 400), 60);
    const copies: [string, RawImage][] = [
      ["full", jpeg(full, 90)],
      ["worse", jpeg(full, 40)],
      ["odd size", jpeg(resize(full, 451, 601), 75)],
      ["smaller still", jpeg(resize(full, 240, 320), 50)],
      ["much larger", jpeg(resize(full, 1800, 2400), 85)],
      ["cut 2 % each side", jpeg(resize(crop(full, 12, 16, 576, 768), 600, 800), 85)],
      ["cut 4 % each side", jpeg(resize(crop(full, 24, 32, 552, 736), 600, 800), 85)],
      ["cut at the left", jpeg(crop(full, 18, 0, 582, 776), 80)],
      ["cut at the top", jpeg(crop(full, 0, 24, 600, 776), 85)],
      ["cut and reduced", jpeg(resize(crop(full, 6, 8, 588, 784), 300, 400), 60)],
    ];
    for (const [what, img] of copies) assert.equal(sameScan(img, small), "same", `${kind}: ${what}`);
  }
});

test("B0374: another scan under a number taken already is set aside and asked (What waits, /status), never the image unasked; a sharper copy is taken; strom media aside answers", bridgeOpts, async () => {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["research", "new", "X", "--new-person", "Jan /Lhoták/"]);
  const shared = path.join(w.home, "shared");
  Object.assign(w.env, { STROM_TRASH: path.join(w.home, "trash") });
  try {
    await w.ok(["recordset", "add", "Lhota N 1850–1870", "--url", "https://archive.example.org/book/77"]); // B1
    await w.ok(["task", "add", "Křest Jana", "--level", "link", "--where", "B1", "--why", "a", "--done-when", "b"]); // T1
    await w.ok(["task", "wait", "T1", "--images", "B1:3-5", "--on", "snímky 3–5 knihy Lhota"]);
    const folder = inboxFolderFor({ id: "B0001", title: "Lhota N 1850–1870" });
    const dir = path.join(shared, "inbox", folder);
    const images = () => Tree.open(w.cwd, w.env).list<Media>("media").filter((m) => !m.retracted && m.recordset === "B0001" && m.image === 3);
    // image 3, a reduced download first
    save(resize(page(1), 300, 400), path.join(dir, "3.jpg"), 60);
    await w.ok(["media", "add", "--inbox", "--waiting"]);
    assert.equal(images().length, 1);
    // the full one of the same scan: a sharper copy, taken as before
    save(page(1), path.join(dir, "3.jpg"), 90);
    const sharper = await w.ok(["media", "add", "--inbox", "--waiting"]);
    assert.equal(images().length, 2, sharper.out);
    assert.ok(!fs.existsSync(path.join(dir, "3.jpg")));
    const kept = images().sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0]!;
    // page 203 saved as 3.jpg: another scan — set aside, the image stays as it is
    save(page(2), path.join(dir, "3.jpg"), 90);
    const other = await w.ok(["media", "add", "--inbox", "--waiting"]);
    const aside = `3.jpg.other-than-${kept.id}`;
    assert.ok(other.out.includes(`the file for image 3 of B0001 is another scan than ${kept.id}, image 3 registered already — not taken as a sharper copy of it, set aside as ${aside}`), other.out);
    assert.match(other.out, /: nothing taken: 1 file set aside/, other.out);
    assert.ok(!other.out.includes("the same scans are registered"), other.out);
    assert.ok(fs.existsSync(path.join(dir, aside)));
    assert.equal(images().length, 2, "nothing registered for it");
    assert.equal(Tree.open(w.cwd, w.env).get<Task>("T0001")!.state, "waiting");
    // asked: the list, What waits (the terminal), the bridge's /status books.aside
    const list = await w.ok(["media", "aside", "--json"]);
    assert.deepEqual(list.json.aside.map((a: { file: string; kind: string; image: number; media: string }) => [a.file, a.kind, a.image, a.media]), [[aside, "other", 3, kept.id]]);
    assert.deepEqual(asideFiles(Tree.open(w.cwd, w.env), shared).map((a) => a.file), [aside]);
    const asked = waitingFor(Tree.open(w.cwd, w.env), { shared, aside: true }).filter((x) => x.aside);
    assert.deepEqual(asked.map((x) => [x.item.kind, x.item.section, x.terminalOnly]), [["aside", "decide", true]]);
    assert.match(asked[0]!.item.what, new RegExp(`^3\\.jpg: jiný sken než snímek 3 knihy B0001 \\(${kept.id}\\)`, "u"));
    assert.equal(waitingFor(Tree.open(w.cwd, w.env), { shared }).filter((x) => x.aside).length, 0, "the app asks for none: /status books.aside");
    // a number taken already by another scan: refused, nothing done
    const taken = await w.run(["media", "aside", aside, "--image", "3", "--json"]);
    assert.notEqual(taken.code, 0);
    // the Strom app: /status books.aside, the answer POST /books/aside — it is image 7: registered as that, the file
    // goes from the inbox
    const url = ((await w.ok(["live", "start", "--json"])).json as { url: string }).url;
    try {
      const status = (await request(`${url}/status?app=3.31.0`)).body;
      assert.ok(status.features.includes("inbox.aside"));
      assert.deepEqual(status.books.aside.map((a: { file: string; kind: string; image: number; media: string; recordset: string }) => [a.file, a.kind, a.image, a.media, a.recordset]), [[aside, "other", 3, kept.id, "B0001"]]);
      // what a person reads: the file's own name, without what strom added to it (as strom media aside --json)
      assert.equal(status.books.aside[0].name, "3.jpg");
      assert.equal((await request(`${url}/books/aside`, "POST", { file: aside, do: "image" })).status, 400);
      assert.equal((await request(`${url}/books/aside`, "POST", { file: "nic.jpg.other-than-M0001", do: "discard" })).status, 404);
      const as7 = await request(`${url}/books/aside`, "POST", { file: aside, do: "image", image: 7 });
      assert.equal(as7.status, 200, JSON.stringify(as7.body));
      assert.deepEqual([as7.body.done, as7.body.aside], ["image", []]);
      assert.equal(Tree.open(w.cwd, w.env).get<Media>(as7.body.added[0])!.image, 7);
    } finally {
      await w.ok(["live", "stop"]);
    }
    assert.ok(!fs.existsSync(path.join(dir, aside)));
    assert.equal(images().length, 2, "image 3 as it was");
    // again another scan: it is image 3 — the ones there withdrawn (no source cites them), kept
    save(page(3), path.join(dir, "3.jpg"), 90);
    await w.ok(["media", "add", "--inbox", "--waiting"]);
    const second = (await w.ok(["media", "aside", "--json"])).json.aside[0];
    assert.equal(second.kind, "other");
    const took = await w.ok(["media", "aside", second.file, "--take", "--json"]);
    assert.equal(took.json.replaced.length, 2, JSON.stringify(took.json));
    const now3 = images();
    assert.deepEqual(now3.map((m) => m.id), took.json.added);
    for (const id of took.json.replaced) assert.ok(Tree.open(w.cwd, w.env).get<Media>(id)!.retracted, "withdrawn, kept");
    // once more: the image stays — the file into the trash, never deleted for good
    save(page(4), path.join(dir, "3.jpg"), 90);
    await w.ok(["media", "add", "--inbox", "--waiting"]);
    const third = (await w.ok(["media", "aside", "--json"])).json.aside[0];
    await w.ok(["media", "aside", third.file, "--discard"]);
    assert.ok(fs.existsSync(path.join(w.home, "trash", third.file)));
    assert.deepEqual(images().map((m) => m.id), took.json.added);
    assert.deepEqual((await w.ok(["media", "aside", "--json"])).json.aside, []);
    // a format strom does not read itself under 3 (nothing to tell by): not surely the same scan — set aside and asked,
    // never taken
    const webp = path.join(dir, "3.webp");
    fs.writeFileSync(webp, Buffer.concat([Buffer.from("RIFF\x00\x01\x00\x00WEBPVP8 ", "latin1"), Buffer.alloc(256, 7)]));
    const past = new Date(Date.now() - 2 * SETTLE_MS);
    fs.utimesSync(webp, past, past);
    const unsure = await w.ok(["media", "add", "--inbox", "--waiting"]);
    assert.ok(unsure.out.includes(`the file for image 3 of B0001 is not surely the same scan as ${took.json.added[0]}, image 3 registered already — not taken as a sharper copy of it`), unsure.out);
    assert.deepEqual((await w.ok(["media", "aside", "--json"])).json.aside.map((a: { kind: string }) => a.kind), ["other"]);
    assert.deepEqual(images().map((m) => m.id), took.json.added);
  } finally {
    w.cleanup();
  }
});

test("B0408: strom media add --inbox never deletes a file that is the same scan as another image — set aside, said", opts, async () => {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["research", "new", "X", "--new-person", "Jan /Lhoták/"]);
  const shared = path.join(w.home, "shared");
  try {
    await w.ok(["recordset", "add", "Lhota N 1850–1870"]); // B1
    const dir = path.join(shared, "inbox", inboxFolderFor({ id: "B0001", title: "Lhota N 1850–1870" }));
    save(page(1), path.join(dir, "4.jpg"));
    await w.ok(["media", "add", "--inbox", "--recordset", "B1"]);
    const m4 = Tree.open(w.cwd, w.env).list<Media>("media").find((m) => m.image === 4)!;
    save(page(1), path.join(dir, "5.jpg"));
    const r = await w.ok(["media", "add", "--inbox", "--recordset", "B1"]);
    assert.ok(r.out.includes(`5.jpg set aside as 5.jpg.same-as-${m4.id} (the same scan as ${m4.id}) — kept`), r.out);
    assert.ok(fs.existsSync(path.join(dir, `5.jpg.same-as-${m4.id}`)));
    // a file set aside is a question, never a download the inbox holds
    assert.deepEqual(inboxFolders(path.join(shared, "inbox")), []);
    // asked: the same file under another number — only the trash, nothing to take
    const same = (await w.ok(["media", "aside", "--json"])).json.aside[0];
    assert.equal(same.kind, "same");
    assert.notEqual((await w.run(["media", "aside", same.file, "--take"])).code, 0);
  } finally {
    w.cleanup();
  }
});
