// A copy of an image saved properly (an archive's file, the agent's browser, a connector) is the image ahead of a
// screenshot of the screen around the scan, even one of more pixels (1124): previews, readers and excerpts take it. Copies
// of one kind go by their pixels as ever; one copy stays as it is. The citations of the screenshot move to the new copy
// only by strom media cites --move-to: said what moves first, the old copy kept, a clip whose place is not surely the
// same place of the new copy left to be marked again. Synthetic scans of made-up pages; no request leaves this computer.

import { after, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";
import { findImage, framedApart, mediaMime, mimeOfFile, otherCopies, rankCopies, savedProperly, screenOfOther, screenshotNamed, sharperPart, storeExtOf } from "../../src/core/media.ts";
import type { Media, Source } from "../../src/core/model.ts";
import { Tree } from "../../src/core/tree.ts";
import { encodeImage } from "../../src/image/index.ts";
import { resize } from "../../src/image/image.ts";

const opts = { skip: !hasGit };

/** A copy of image 5 of B0001 as the records keep it. */
function copy(id: string, width: number, height: number, more: Partial<Media> = {}): Media {
  return { id, type: "media", sha: id.toLowerCase(), file: `media/${id}.jpg`, mime: "image/jpeg", size: 1, width, height, recordset: "B0001", image: 5, notes: [], created: "2026-11-20T10:00:00.000Z", updated: "2026-11-20T10:00:00.000Z", ...more } as Media;
}

const SCREEN = "Snímek obrazovky 2026-11-20 v 10.12.33.png";

test("a copy saved properly is the image ahead of a wider screenshot of more pixels — findImage, otherCopies, the excerpt's sharper copy", () => {
  const screen = copy("M0001", 3552, 1040, { from: SCREEN });
  const saved = copy("M0002", 2000, 1620, { from: "5.jpg" });
  const all = [screen, saved];
  assert.equal(findImage(all, "B0001", 5)?.id, "M0002", "the saved copy, not the screenshot of more pixels");
  assert.deepEqual(otherCopies(all, screen).map((m) => m.id), ["M0002"]);
  assert.deepEqual(otherCopies(all, saved).map((m) => m.id), ["M0001"]);
  assert.deepEqual(rankCopies([screen, saved]).map((m) => m.id), ["M0002", "M0001"]);
  // an excerpt of a clip on the saved copy is never cut from the screenshot (another frame) as a sharper copy
  assert.equal(sharperPart(all, saved, { x: 0.3, y: 0.2, w: 0.4, h: 0.3 }), undefined);
  // a sharper copy of the same frame still is
  const sharp = copy("M0003", 4000, 3240, { from: "5 (1).jpg" });
  assert.equal(sharperPart([...all, sharp], saved, { x: 0.3, y: 0.2, w: 0.4, h: 0.3 })?.part.id, "M0003");
  // fetched by a connector: saved properly whatever its name; the screenshot in any language, decomposed too
  const fetched = copy("M0004", 2000, 1620, { from: "connector lhota · 5.jpg", fetched: { connector: "lhota", book: "11" } });
  for (const name of [SCREEN.normalize("NFD"), "Screenshot 2026-11-20 101233.png", "Bildschirmfoto 2026-11-20 um 10.12.33.png", "Zrzut ekranu 2026-11-20 101233.png", "Снимок экрана 2026-11-20 в 10.12.33.png"]) {
    const s = copy("M0001", 3552, 1040, { from: name });
    assert.ok(screenshotNamed(s), name);
    assert.equal(findImage([s, fetched], "B0001", 5)?.id, "M0004", name);
  }
  assert.equal(screenshotNamed(copy("M0005", 3552, 1040, { from: "Screenshot.png", fetched: { connector: "lhota", book: "11" } })), false, "a connector's file is no screenshot");
});

test("a JPEG registered with no type (application/octet-stream: a file set aside, \"5.jpg.other-than-M0001\") is a JPEG by the name it was saved under — beside a PNG of the screen it is the image; a type not told stays as it was", () => {
  const png = copy("M0001", 3598, 1052, { mime: "image/png", file: "media/M0001.png", from: "5.png" });
  // as a research keeps it: from the name it was saved under, the store's name and the record's type of a name that said none
  const scan = copy("M0002", 2000, 1502, { mime: "application/octet-stream", file: "media/m0002.other-than-m0001", from: "5.jpg" });
  assert.equal(mediaMime(scan), "image/jpeg");
  assert.equal(findImage([png, scan], "B0001", 5)?.id, "M0002", "the JPEG, not the PNG of more pixels");
  assert.equal(findImage([scan, png], "B0001", 5)?.id, "M0002", "whatever their order");
  assert.ok(framedApart(png, scan) && screenOfOther(png, [png, scan]));
  assert.equal(sharperPart([png, scan], scan, { x: 0.3, y: 0.2, w: 0.4, h: 0.3 }), undefined, "never an excerpt's sharper copy");
  // a type in capitals, decomposed name: told all the same
  assert.equal(findImage([png, { ...scan, from: "5.JPEG".normalize("NFD") }], "B0001", 5)?.id, "M0002");
  // a record whose type is told keeps it, whatever its name says
  assert.equal(mediaMime({ ...scan, mime: "image/png" }), "image/png");
  // no type and a name that says none (or no name): nothing told — by the pixels, as before
  for (const from of ["5.bin", "5", undefined]) {
    const odd = copy("M0002", 2000, 1502, { mime: "application/octet-stream", file: "media/m0002.other-than-m0001", ...(from ? { from } : { from: undefined }) });
    assert.equal(mediaMime(odd), "application/octet-stream", String(from));
    assert.equal(findImage([png, odd], "B0001", 5)?.id, "M0001", String(from));
  }
});

test("the type of a copy that says none, by its file's content in the shared store; a file that is no picture stays without one", () => {
  const shared = fs.mkdtempSync(path.join(fs.realpathSync(process.env.TMPDIR ?? "/tmp"), "mime-"));
  try {
    const jpeg = encodeImage({ width: 8, height: 8, channels: 1, data: new Uint8Array(64).fill(200) }, "jpeg");
    fs.mkdirSync(path.join(shared, "media"), { recursive: true });
    fs.writeFileSync(path.join(shared, "media", "aa.other-than-m0001"), jpeg);
    fs.writeFileSync(path.join(shared, "media", "bb.other-than-m0001"), "no picture, Lhota žluťoučký\n");
    const some = (sha: string, from?: string) => copy("M0009", 8, 8, { sha, mime: "application/octet-stream", file: `media/${sha}.other-than-m0001`, ...(from ? { from } : { from: undefined }) });
    assert.equal(mediaMime(some("aa"), shared), "image/jpeg", "by its content");
    assert.equal(mediaMime(some("aa", "5.png"), shared), "image/jpeg", "its content before its name");
    assert.equal(mediaMime(some("bb"), shared), "application/octet-stream", "no picture: as it was");
    assert.equal(mediaMime(some("bb", "5.jpg"), shared), "image/jpeg", "else by the name it was saved under");
    assert.equal(mediaMime(some("cc"), shared), "application/octet-stream", "no file here: as it was");
    // a file registered: its type by its name, a name that says none by its content, else by the name it was saved under
    const aside = path.join(shared, "5.jpg.other-than-M0001");
    fs.writeFileSync(aside, jpeg);
    assert.equal(mimeOfFile(aside), "image/jpeg");
    assert.equal(storeExtOf(aside, mimeOfFile(aside)), ".jpg");
    const text = path.join(shared, "5.jpg.other-than-M0002");
    fs.writeFileSync(text, "no picture");
    assert.equal(mimeOfFile(text, "5.jpg"), "image/jpeg");
    assert.equal(mimeOfFile(text), "application/octet-stream");
    assert.equal(storeExtOf(text, "application/octet-stream"), ".other-than-M0002", "a type not told: its name as before");
    // a name that says its type: as before, whatever the content
    const named = path.join(shared, "6.png");
    fs.writeFileSync(named, jpeg);
    assert.equal(mimeOfFile(named), "image/png");
    assert.equal(storeExtOf(named, "image/png"), ".png");
  } finally {
    fs.rmSync(shared, { recursive: true, force: true });
  }
});

test("copies of one kind by their pixels as before; a screenshot of the same frame, one copy alone: as before", () => {
  // two saved copies: the sharper
  assert.equal(findImage([copy("M0001", 2000, 1620, { from: "5.jpg" }), copy("M0002", 3000, 2430, { from: "5 (1).jpg" })], "B0001", 5)?.id, "M0002");
  // two screenshots: the one of more pixels
  assert.equal(findImage([copy("M0001", 1800, 900, { from: "Screenshot 1.png" }), copy("M0002", 3552, 1040, { from: SCREEN })], "B0001", 5)?.id, "M0002");
  // a screenshot cut to the page (its proportions those of the scan): the sharper, as before
  const cut = copy("M0001", 2400, 1950, { from: SCREEN });
  const saved = copy("M0002", 2000, 1620, { from: "5.jpg" });
  assert.equal(framedApart(cut, saved), false);
  assert.equal(findImage([cut, saved], "B0001", 5)?.id, "M0001");
  // without a size nothing is told
  assert.equal(findImage([copy("M0001", 0, 0, { from: SCREEN, width: undefined, height: undefined }), copy("M0002", 2000, 1620, { from: "5.jpg" })], "B0001", 5)?.id, "M0002");
  assert.equal(findImage([copy("M0001", 3552, 1040, { from: SCREEN }), copy("M0002", 2000, 1620, { from: "5.jpg", width: undefined, height: undefined })], "B0001", 5)?.id, "M0001");
  // one copy: itself, the screenshot too
  assert.equal(findImage([copy("M0001", 3552, 1040, { from: SCREEN })], "B0001", 5)?.id, "M0001");
  assert.deepEqual(otherCopies([copy("M0001", 3552, 1040, { from: SCREEN })], copy("M0001", 3552, 1040, { from: SCREEN })), []);
});

test("a screenshot its name does not tell: a PNG of the screen beside a JPEG of the scan, proportions far apart — the JPEG is the image", () => {
  // the screen saved by hand under the image's number, as a research keeps it: no screenshot's name, no fetched
  const png = (id: string, w: number, h: number, more: Partial<Media> = {}) => copy(id, w, h, { mime: "image/png", file: `media/${id}.png`, from: "5.png", ...more });
  const screen = png("M0001", 3598, 1052);
  const scan = copy("M0002", 2000, 1430, { from: "5.jpg" });
  assert.equal(screenshotNamed(screen), false, "its name says nothing");
  assert.equal(findImage([screen, scan], "B0001", 5)?.id, "M0002", "the JPEG, not the PNG of more pixels");
  assert.equal(findImage([scan, screen], "B0001", 5)?.id, "M0002", "whatever their order");
  assert.ok(framedApart(screen, scan) && framedApart(scan, screen));
  assert.ok(screenOfOther(screen, [screen, scan]));
  assert.equal(screenOfOther(scan, [screen, scan]), false);
  assert.deepEqual(otherCopies([screen, scan], scan).map((m) => m.id), ["M0001"]);
  assert.equal(sharperPart([screen, scan], scan, { x: 0.3, y: 0.2, w: 0.4, h: 0.3 }), undefined, "never an excerpt's sharper copy");
  // a type kept in upper case, a JPEG from a connector: the same
  assert.equal(findImage([png("M0001", 3598, 1052, { mime: "IMAGE/PNG" }), copy("M0002", 2000, 1622, { from: "connector lhota · 5.jpg", fetched: { connector: "lhota", book: "11" } })], "B0001", 5)?.id, "M0002");

  // anything else as before, by the pixels
  // the proportions alike (a screen cut to the page): the sharper
  assert.equal(findImage([png("M0001", 2400, 1716), scan], "B0001", 5)?.id, "M0001");
  assert.equal(framedApart(png("M0001", 2400, 1716), scan), false);
  // two PNGs, two JPEGs: the sharper
  assert.equal(findImage([png("M0001", 3598, 1052), png("M0002", 2000, 1430)], "B0001", 5)?.id, "M0001");
  assert.equal(findImage([copy("M0001", 3598, 1052, { from: "5 (1).jpg" }), scan], "B0001", 5)?.id, "M0001");
  // the PNG alone: itself
  assert.equal(findImage([png("M0001", 3598, 1052)], "B0001", 5)?.id, "M0001");
  // no size of the PNG, of the JPEG: not told
  assert.equal(findImage([png("M0001", 0, 0, { width: undefined, height: undefined }), scan], "B0001", 5)?.id, "M0002");
  assert.equal(findImage([png("M0001", 3598, 1052), copy("M0002", 2000, 1430, { from: "5.jpg", width: undefined, height: undefined })], "B0001", 5)?.id, "M0001");
  // a type not known, its name saying none either: not told
  assert.equal(findImage([png("M0001", 3598, 1052, { mime: "application/octet-stream", from: "5" }), scan], "B0001", 5)?.id, "M0001");
  // a JPEG named a screenshot: both taken for screens, not told
  assert.equal(findImage([png("M0001", 3598, 1052), copy("M0002", 2000, 1430, { from: "Screenshot 5.jpg" })], "B0001", 5)?.id, "M0001");

  // saved properly, as its record says, goes before the guess: a PNG the agent's browser saved (strom's own name) or a
  // connector fetched is never a screen, whatever its proportions
  for (const from of ["strom-3f2a9c1b-T0007-0005.png", "strom-T0007-0005 (1).png", "strom-lhota-11-0005.png"]) {
    const saved = png("M0001", 3598, 1052, { from });
    assert.ok(savedProperly(saved), from);
    assert.equal(findImage([saved, scan], "B0001", 5)?.id, "M0001", from);
    assert.equal(framedApart(saved, scan), false, from);
  }
  assert.equal(findImage([png("M0001", 3598, 1052, { fetched: { connector: "lhota", book: "11" } }), scan], "B0001", 5)?.id, "M0001");
  assert.equal(savedProperly(png("M0001", 1, 1, { from: "strom pokus 5.png" })), false, "a name merely beginning so");
  // a screenshot by its name stays one beside a copy the agent's browser saved
  assert.equal(findImage([copy("M0001", 3552, 1040, { from: SCREEN }), copy("M0002", 2000, 1620, { from: "strom-3f2a9c1b-T0007-0005.jpg" })], "B0001", 5)?.id, "M0002");
});

const dirs: string[] = [];
after(() => {
  for (const d of dirs) fs.rmSync(d, { recursive: true, force: true });
});

/** A made-up page of a register (its lines, handwriting of its own seed), width × height. */
function page(width: number, height: number, seed: number) {
  let s = seed;
  const r = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const d = new Uint8Array(width * height).fill(222);
  for (let y = 40; y < height; y += 30) for (let x = 20; x < width - 20; x++) d[y * width + x] = 70;
  for (let k = 0; k < 150; k++) {
    let x = 30 + r() * (width - 60);
    let y = 45 + r() * (height - 70);
    const dx = (r() - 0.5) * 3;
    const dy = (r() - 0.5) * 3;
    for (let i = 0; i < 15; i++) {
      x += dx + (r() - 0.5);
      y += dy + (r() - 0.5);
      const xi = Math.round(x);
      const yi = Math.round(y);
      if (xi > 0 && yi > 0 && xi < width - 1 && yi < height - 1) d[yi * width + xi] = d[yi * width + xi + 1] = 40;
    }
  }
  return { width, height, channels: 1 as const, data: d };
}

function folder(): string {
  const dir = fs.mkdtempSync(path.join(fs.realpathSync(process.env.TMPDIR ?? "/tmp"), "lhota-"));
  dirs.push(dir);
  return dir;
}

test("the citations of a screenshot move to the copy saved properly only when asked: said first, the screenshot kept, a clip of a place left to be marked again", opts, async () => {
  const w = new World();
  try {
    await w.withTree("Lhotákovi");
    await w.ok(["recordset", "add", "Lhota N 1784–1820"]); // B0001
    const dir = folder();
    // the screen around the scan, wide, of more pixels (M0001); the scan saved properly, of fewer (M0002)
    const screen = path.join(dir, SCREEN);
    fs.writeFileSync(screen, encodeImage(page(710, 208, 7), "png"));
    const saved = path.join(dir, "5.jpg");
    fs.writeFileSync(saved, encodeImage(page(300, 243, 5), "jpeg", 90));
    await w.ok(["media", "add", screen, "--recordset", "B1", "--image", "5"]); // M0001
    const s1 = (await w.ok(["source", "add", "Křest Vojtěcha Lhotáka", "--kind", "baptism", "--recordset", "B1", "--clip", "M0001@0.3,0.2,0.4,0.3", "--json"])).json.source.id;
    const s2 = (await w.ok(["source", "add", "Křest Anny Lhotákové", "--kind", "baptism", "--recordset", "B1", "--media", "M0001", "--json"])).json.source.id;
    const came = await w.ok(["media", "add", saved, "--recordset", "B1", "--image", "5"]); // M0002
    assert.match(came.out, /B0001:5 has 2 copies — M0002 300×243 is the image now \(M0001: a screenshot of another frame, not a sharper scan\)/, came.out);
    assert.match(came.out, new RegExp(`M0001 is cited by ${s1} \\(clip M0001@0\\.3,0\\.2,0\\.4,0\\.3\\), ${s2} — to cite M0002, the image, instead: strom media cites M0001 --move-to M0002`), came.out);
    // the image is the saved copy; nothing moved unasked
    assert.equal((await w.ok(["media", "show", "B1:5", "--json"])).json.media.id, "M0002");
    const before = Tree.open(w.cwd, w.env);
    assert.deepEqual(before.get<Source>(s1)!.clips, [{ media: "M0001", region: { x: 0.3, y: 0.2, w: 0.4, h: 0.3 } }]);
    assert.deepEqual(before.get<Source>(s2)!.media, ["M0001"]);
    // a withdrawal of the cited screenshot names the move
    const refused = await w.run(["media", "retract", "M0001", "--reason", "a screenshot", "--json"]);
    assert.notEqual(refused.code, 0);
    assert.match(refused.out + refused.err, /strom media cites M0001 --move-to M0002/);
    // the list, then a dry run: nothing written
    const listed = await w.ok(["media", "cites", "M0001"]);
    assert.match(listed.out, new RegExp(`${s1} Křest Vojtěcha Lhotáka · clip M0001@0\\.3,0\\.2,0\\.4,0\\.3`), listed.out);
    assert.match(listed.out, /the image is M0002/);
    const dry = await w.ok(["media", "cites", "M0001", "--move-to", "M0002", "--dry-run"]);
    assert.match(dry.out, new RegExp(`clip 1 M0001@0\\.3,0\\.2,0\\.4,0\\.3 stays: its place on M0002 is not told for sure — mark it again`), dry.out);
    assert.deepEqual(Tree.open(w.cwd, w.env).get<Source>(s2)!.media, ["M0001"], "a dry run writes nothing");
    // the move
    const moved = await w.ok(["media", "cites", "M0001", "--move-to", "M0002", "--json"]);
    assert.deepEqual(moved.json.moved.map((m: { source: string }) => m.source), [s1, s2]);
    const t = Tree.open(w.cwd, w.env);
    // the clip of the screenshot's place stays, said; the source cites the new copy beside it
    assert.deepEqual(t.get<Source>(s1)!.clips, [{ media: "M0001", region: { x: 0.3, y: 0.2, w: 0.4, h: 0.3 } }]);
    assert.deepEqual(t.get<Source>(s1)!.media, ["M0001", "M0002"]);
    // the image alone: the new copy for the old
    assert.deepEqual(t.get<Source>(s2)!.media, ["M0002"]);
    // the screenshot stays, not withdrawn, its file here
    const old = t.get<Media>("M0001")!;
    assert.equal(old.retracted, undefined);
    assert.ok(fs.existsSync(path.join(w.home, "shared", old.file)));
    // in the history
    const ops = t.readOps().filter((o) => o.op === "source.edit" && o.summary.includes("cites M0002"));
    assert.deepEqual(ops.map((o) => o.targets[0]).sort(), [s1, s2].sort());
    assert.ok(ops.every((o) => o.targets.includes("M0001") && o.targets.includes("M0002")));
  } finally {
    w.cleanup();
  }
});

test("a clip on a weaker copy of the same scan goes along to the sharper copy, its place the same", opts, async () => {
  const w = new World();
  try {
    await w.withTree("Lhotákovi");
    await w.ok(["recordset", "add", "Lhota N 1784–1820"]); // B0001
    const dir = folder();
    const img = page(400, 300, 11);
    const weak = path.join(dir, "weak-5.jpg");
    fs.writeFileSync(weak, encodeImage(resize(img, 200, 150), "jpeg", 50));
    const sharp = path.join(dir, "5.jpg");
    fs.writeFileSync(sharp, encodeImage(img, "jpeg", 90));
    await w.ok(["media", "add", weak, "--recordset", "B1", "--image", "5"]); // M0001
    const s = (await w.ok(["source", "add", "Křest Vojtěcha Lhotáka", "--kind", "baptism", "--recordset", "B1", "--clip", "M0001@0.3,0.2,0.4,0.3", "--json"])).json.source.id;
    await w.ok(["media", "add", sharp, "--recordset", "B1", "--image", "5"]); // M0002
    const moved = await w.ok(["media", "cites", "M0001", "--move-to", "M0002"]);
    assert.match(moved.out, /clip M0001@0\.3,0\.2,0\.4,0\.3 → M0002@0\.3,0\.2,0\.4,0\.3/, moved.out);
    const t = Tree.open(w.cwd, w.env);
    assert.deepEqual(t.get<Source>(s)!.clips, [{ media: "M0002", region: { x: 0.3, y: 0.2, w: 0.4, h: 0.3 } }]);
    assert.deepEqual(t.get<Source>(s)!.media, ["M0002"]);
    assert.equal(t.get<Media>("M0001")!.retracted, undefined, "the weaker copy stays");
    // nothing cites it now: it can be withdrawn
    await w.ok(["media", "retract", "M0001", "--reason", "a weaker copy"]);
  } finally {
    w.cleanup();
  }
});
