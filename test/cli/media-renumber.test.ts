// The number of a registered image set right (spec 148): only its number changes — its ID, its file, the sources'
// citations and clips of it stay; a set of them at once, checked as it ends up (9 and 10 swapped); another scan at the
// new number refused; the parts and copies left at the old number said; its history in media show. An image put to a
// source wrongly taken off it (source edit --media-remove), then withdrawn. Synthetic scans of made-up pages; no request
// leaves this computer.

import { after, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";
import type { Media, Source } from "../../src/core/model.ts";
import { Tree } from "../../src/core/tree.ts";
import { encodeImage } from "../../src/image/index.ts";
import { crop, resize } from "../../src/image/image.ts";
import { imagesIndex, STABLE_MS } from "../../src/core/mediaindex.ts";
import { changeLines } from "../../src/core/changelog.ts";

const opts = { skip: !hasGit };
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

test("media renumber: two images saved under each other's numbers swapped in one command — IDs, files, citations and clips stay, the history kept, B…:9 the other image now", opts, async () => {
  const w = new World();
  try {
    await w.withTree("Lhotákovi");
    await w.ok(["recordset", "add", "Lhota N 1784–1820"]); // B0001
    const dir = folder();
    const nine = page(300, 240, 9);
    fs.writeFileSync(path.join(dir, "9.jpg"), encodeImage(nine, "jpeg", 90));
    fs.writeFileSync(path.join(dir, "10.jpg"), encodeImage(page(300, 240, 10), "jpeg", 90));
    // a part of image 9 saved sharper on its own (the upper left quarter, twice the pixels)
    fs.writeFileSync(path.join(dir, "9-part.jpg"), encodeImage(resize(crop(nine, 0, 0, 150, 120), 300, 240), "jpeg", 90));
    await w.ok(["media", "add", path.join(dir, "9.jpg"), "--recordset", "B1", "--image", "9"]); // M0001
    await w.ok(["media", "add", path.join(dir, "10.jpg"), "--recordset", "B1", "--image", "10"]); // M0002
    await w.ok(["media", "add", path.join(dir, "9-part.jpg"), "--recordset", "B1", "--image", "9", "--crop", "0,0,0.5,0.5"]); // M0003
    const s1 = (await w.ok(["source", "add", "Křest Vojtěcha Lhotáka", "--kind", "baptism", "--recordset", "B1", "--clip", "M0001@0.3,0.2,0.4,0.3", "--media", "M0002", "--json"])).json.source.id;
    const s2 = (await w.ok(["source", "add", "Křest Anny Lhotákové", "--kind", "baptism", "--recordset", "B1", "--media", "M0001", "--json"])).json.source.id;
    const s3 = (await w.ok(["source", "add", "Pohřeb Josefa Lhotáka", "--kind", "burial", "--recordset", "B1", "--media", "M0001", "--image", "9", "--json"])).json.source.id;
    const before = Tree.open(w.cwd, w.env);
    const m1 = before.get<Media>("M0001")!;

    // without a reason: refused, nothing written
    const bare = await w.run(["media", "renumber", "M0001=10", "M0002=9", "--json"]);
    assert.notEqual(bare.code, 0);
    assert.equal(bare.json.code, "reason.missing", bare.out + bare.err);

    // a dry run says it all — the part of image 9 not named stays there (a part of M0002 then) — and writes nothing
    const dry = await w.ok(["media", "renumber", "M0001=10", "M0002=9", "--reason", "čísla podle lišty prohlížeče archivu", "--dry-run", "--json"]);
    assert.deepEqual(dry.json.left.map((l: { id: string; with?: string }) => [l.id, l.with]), [["M0003", "M0002"]]);
    const dryText = await w.ok(["media", "renumber", "M0001=10", "M0002=9", "--reason", "x", "--dry-run"]);
    assert.match(dryText.out, /part M0003 \(.*\) of image 9 stays image 9 — a part of M0002 now, not of M0001: cut from M0001's scan\? name it too: M0003=10/u, dryText.out);
    assert.equal(Tree.open(w.cwd, w.env).get<Media>("M0001")!.image, 9, "a dry run writes nothing");

    // the swap, with the part along
    const done = await w.ok(["media", "renumber", "M0001=10", "M0002=9", "M0003=10", "--reason", "čísla podle lišty prohlížeče archivu", "--json"]);
    assert.deepEqual(done.json.renumbered.map((r: { media: string; from: number; to: number }) => [r.media, r.from, r.to]), [["M0001", 9, 10], ["M0002", 10, 9], ["M0003", 9, 10]]);
    assert.deepEqual(done.json.left, []);
    const t = Tree.open(w.cwd, w.env);
    const a = t.get<Media>("M0001")!;
    assert.equal(a.image, 10);
    assert.equal(t.get<Media>("M0002")!.image, 9);
    assert.equal(t.get<Media>("M0003")!.image, 10);
    // the ID, the file, the content's hash stay
    assert.equal(a.sha, m1.sha);
    assert.equal(a.file, m1.file);
    assert.ok(fs.existsSync(path.join(w.home, "shared", a.file)));
    // its history, with the reason
    assert.equal(a.renumbered?.length, 1);
    assert.deepEqual({ ...a.renumbered![0]!, at: undefined }, { at: undefined, from: 9, to: 10, reason: "čísla podle lišty prohlížeče archivu" });
    assert.ok(!Number.isNaN(Date.parse(a.renumbered![0]!.at)));
    // the sources' citations and clips on the same IDs
    assert.deepEqual(t.get<Source>(s1)!.clips, [{ media: "M0001", region: { x: 0.3, y: 0.2, w: 0.4, h: 0.3 } }]);
    assert.deepEqual(t.get<Source>(s1)!.media, before.get<Source>(s1)!.media);
    assert.deepEqual([...t.get<Source>(s1)!.media!].sort(), ["M0001", "M0002"]);
    assert.deepEqual(t.get<Source>(s2)!.media, ["M0001"]);
    // the image numbers of the sources from their images follow; one with its own keeps it, said
    const sources = new Map(done.json.sources.map((x: { id: string }) => [x.id, x]));
    assert.deepEqual(sources.get(s2), { id: s2, image: "10", before: "9", own: false });
    assert.deepEqual(sources.get(s1), { id: s1, image: "9–10", own: false }, "9 and 10 both, before and after");
    assert.deepEqual(sources.get(s3), { id: s3, image: "9", own: true });
    const text = await w.ok(["media", "renumber", "M0001=9", "M0002=10", "M0003=9", "--reason", "x", "--dry-run"]);
    assert.match(text.out, new RegExp(`${s2} Křest Anny Lhotákové: image 10 → 9 \\(from its images; the Strom app gets it with the next sync\\)`), text.out);
    assert.match(text.out, new RegExp(`${s3} Pohřeb Josefa Lhotáka keeps its own image number 9: wrong too\\? strom source edit ${s3} --image <n>`), text.out);
    // media show: the number now and its history; B…:9 is the other image now
    const shown = await w.ok(["media", "show", "M0001"]);
    assert.match(shown.out, /M0001 image 10 of B0001/u, shown.out);
    assert.match(shown.out, /renumbered: 9 → 10 \(\d{4}-\d{2}-\d{2}: čísla podle lišty prohlížeče archivu\)/u, shown.out);
    assert.equal((await w.ok(["media", "show", "B1:9", "--json"])).json.media.id, "M0002");
    assert.equal((await w.ok(["media", "show", "B1:10", "--json"])).json.media.id, "M0001");
    // a reference B…:9 written now goes to the image of that number now
    await w.ok(["source", "edit", s3, "--media", "B1:9"]);
    assert.deepEqual(Tree.open(w.cwd, w.env).get<Source>(s3)!.media, ["M0001", "M0002"]);
    // one operation in the history, with its reason, its images and the sources citing them; said in the research's language
    const op = t.readOps().find((o) => o.op === "media.renumber")!;
    assert.equal(op.reason, "čísla podle lišty prohlížeče archivu");
    assert.deepEqual(op.targets, ["M0001", "M0002", "M0003", s1, s2, s3, "B0001"]);
    assert.match(op.summary, /^M0001 image 9 → 10 in B0001, M0002 image 10 → 9 in B0001, M0003 part of image 9 → 10 in B0001$/u);
    const said = changeLines(t, [op], "", "cs").map((l) => l.text);
    assert.deepEqual(said, ["Opravené číslo snímku: Lhota N 1784–1820, obr. 10", "Opravené číslo snímku: Lhota N 1784–1820, obr. 9"]);
    // back the other way round: the same command
    await w.ok(["media", "renumber", "M0001=9", "M0002=10", "M0003=9", "--reason", "zpět"]);
    const back = Tree.open(w.cwd, w.env).get<Media>("M0001")!;
    assert.equal(back.image, 9);
    assert.deepEqual(back.renumbered!.map((r) => [r.from, r.to, r.reason]), [[9, 10, "čísla podle lišty prohlížeče archivu"], [10, 9, "zpět"]]);
  } finally {
    w.cleanup();
  }
});

test("media renumber: another scan at the new number refused; the same scan there is a copy; one image's --url and --page; the images' index made again", opts, async () => {
  const w = new World();
  try {
    await w.withTree("Lhotákovi");
    await w.ok(["recordset", "add", "Lhota N 1784–1820"]); // B0001
    const dir = folder();
    const seven = page(300, 240, 7);
    fs.writeFileSync(path.join(dir, "7.jpg"), encodeImage(seven, "jpeg", 90));
    fs.writeFileSync(path.join(dir, "8.jpg"), encodeImage(page(300, 240, 8), "jpeg", 90));
    // the same scan as 8.jpg, saved smaller, registered as image 12 by mistake
    fs.writeFileSync(path.join(dir, "12.jpg"), encodeImage(resize(page(300, 240, 8), 200, 160), "jpeg", 60));
    await w.ok(["media", "add", path.join(dir, "7.jpg"), "--recordset", "B1", "--image", "7"]); // M0001
    await w.ok(["media", "add", path.join(dir, "8.jpg"), "--recordset", "B1", "--image", "8"]); // M0002
    await w.ok(["media", "add", path.join(dir, "12.jpg"), "--recordset", "B1", "--image", "12"]); // M0003
    // the images' index kept on disk, its folder settled (as a long research has it)
    const imagesDir = path.join(w.cwd, "data", "images");
    const old = new Date(Date.now() - 10 * STABLE_MS);
    fs.utimesSync(imagesDir, old, old);
    assert.deepEqual(imagesIndex(Tree.open(w.cwd, w.env)).sets.get("B0001")?.images, [7, 8, 12]);
    assert.ok(fs.existsSync(path.join(w.cwd, ".strom", "cache", "images.json")));

    // image 7 onto 8: another scan there — refused, nothing written
    const refused = await w.run(["media", "renumber", "M0001=8", "--reason", "x", "--json"]);
    assert.notEqual(refused.code, 0);
    assert.equal(refused.json.code, "media.renumber.other-scan", refused.out + refused.err);
    const plain = await w.run(["media", "renumber", "M0001=8", "--reason", "x"]);
    assert.match(plain.out + plain.err, /image 8 of B0001 would be two scans: M0001 and M0002 \(image 8 now\) — strom tells them apart: not the same scan/u);
    assert.match(plain.out + plain.err, /strom media renumber M0001=8 M0002=<its number>/u);
    // two named to one number, different scans: refused as well
    const both = await w.run(["media", "renumber", "M0001=20", "M0002=20", "--reason", "x", "--json"]);
    assert.equal(both.json.code, "media.renumber.other-scan");
    assert.equal(Tree.open(w.cwd, w.env).get<Media>("M0001")!.image, 7);

    // 12 onto 8, the same scan: a copy of image 8 — with its page and where it is now
    const copy = await w.ok(["media", "renumber", "M0003=8", "--page", "4v", "--url", "https://archive.example.org/register/17/8", "--reason", "uloženo pod špatným číslem"]);
    assert.match(copy.out, /M0003 image 12 → 8 in B0001/u, copy.out);
    const m3 = Tree.open(w.cwd, w.env).get<Media>("M0003")!;
    assert.deepEqual([m3.image, m3.page, m3.url], [8, "4v", "https://archive.example.org/register/17/8"]);
    assert.equal((await w.ok(["media", "show", "B1:8", "--json"])).json.media.id, "M0002", "the sharper copy is the image");
    // the index is the new numbers'
    assert.deepEqual(imagesIndex(Tree.open(w.cwd, w.env)).sets.get("B0001")?.images, [7, 8]);
    // --url and --page with one image only; a folio is no listing's page
    const many = await w.run(["media", "renumber", "M0001=30", "M0002=31", "--page", "5r", "--reason", "x"]);
    assert.notEqual(many.code, 0);
    assert.match(many.out + many.err, /--url and --page go with one image/u);
    // the same number again: nothing to change
    const same = await w.run(["media", "renumber", "M0001=7", "--reason", "x"]);
    assert.match(same.out + same.err, /M0001 is image 7 already/u);
    // a withdrawn image has no number to set right
    await w.ok(["media", "retract", "M0003", "--reason", "jen menší kopie"]);
    const gone = await w.run(["media", "renumber", "M0003=12", "--reason", "x"]);
    assert.match(gone.out + gone.err, /M0003 is retracted/u);
  } finally {
    w.cleanup();
  }
});

test("source edit --media-remove: an image put to a source wrongly taken off it with its clips, a reason always — then media retract withdraws it; retract of a cited image says renumber and --media-remove", opts, async () => {
  const w = new World();
  try {
    await w.withTree("Lhotákovi");
    await w.ok(["recordset", "add", "Lhota N 1784–1820"]); // B0001
    const dir = folder();
    fs.writeFileSync(path.join(dir, "3.jpg"), encodeImage(page(300, 240, 3), "jpeg", 90));
    fs.writeFileSync(path.join(dir, "4.jpg"), encodeImage(page(300, 240, 4), "jpeg", 90));
    await w.ok(["media", "add", path.join(dir, "3.jpg"), "--recordset", "B1", "--image", "3"]); // M0001
    await w.ok(["media", "add", path.join(dir, "4.jpg"), "--recordset", "B1", "--image", "4"]); // M0002
    const s = (await w.ok(["source", "add", "Oddavky Jana Lhotáka", "--kind", "marriage", "--recordset", "B1", "--media", "M0001", "--clip", "M0002@0.1,0.1,0.5,0.2", "--json"])).json.source.id;
    // a cited image is not withdrawn: what to do instead
    const cited = await w.run(["media", "retract", "M0002", "--reason", "jiná stránka"]);
    assert.notEqual(cited.code, 0);
    assert.match(cited.out + cited.err, /M0002 is cited by /u);
    assert.match(cited.out + cited.err, new RegExp(`strom media renumber M0002=<n> .*strom source edit ${s} --media-remove M0002`, "u"));
    const help = await w.ok(["help", "media", "retract"]);
    assert.match(help.out, /strom media renumber M…=n/u);
    assert.match(help.out, /--media-remove M…/u);
    assert.doesNotMatch(help.out, /--clip-remove/u);
    // without a reason: refused
    const bare = await w.run(["source", "edit", s, "--media-remove", "M0002", "--json"]);
    assert.equal(bare.json.code, "reason.missing", bare.out + bare.err);
    // an image the source does not cite
    fs.writeFileSync(path.join(dir, "5.jpg"), encodeImage(page(300, 240, 5), "jpeg", 90));
    await w.ok(["media", "add", path.join(dir, "5.jpg"), "--recordset", "B1", "--image", "5"]); // M0003
    const none = await w.run(["source", "edit", s, "--media-remove", "B1:5", "--reason", "x"]);
    assert.notEqual(none.code, 0);
    assert.match(none.out + none.err, new RegExp(`M0003 is not among the images of ${s}`, "u"));
    // taken off, with its clip on it; the history says it
    const off = await w.ok(["source", "edit", s, "--media-remove", "M0002", "--reason", "další stránka, ne tento zápis", "--json"]);
    assert.deepEqual(off.json.removed, ["M0002"]);
    const t = Tree.open(w.cwd, w.env);
    assert.deepEqual(t.get<Source>(s)!.media, ["M0001"]);
    assert.equal(t.get<Source>(s)!.clips, undefined);
    const op = t.readOps().filter((o) => o.op === "source.edit").at(-1)!;
    assert.match(op.summary, /media-remove M0002 \(and its clips\)/u);
    assert.equal(op.reason, "další stránka, ne tento zápis");
    assert.ok(op.targets.includes("M0002"));
    // nothing cites it now: withdrawn
    await w.ok(["media", "retract", "M0002", "--reason", "jiná stránka"]);
    assert.ok(Tree.open(w.cwd, w.env).get<Media>("M0002")!.retracted);
    // the last image taken off: said
    const last = await w.ok(["source", "edit", s, "--media-remove", "M0001", "--reason", "x"]);
    assert.match(last.out, new RegExp(`${s} cites no image now`, "u"));
    assert.equal(Tree.open(w.cwd, w.env).get<Source>(s)!.media, undefined);
  } finally {
    w.cleanup();
  }
});
