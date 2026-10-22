// Pictures for reading: places between the shown (upright) picture and its file, the pages of a PDF of scans read
// without programs, HEIC and PDF converted (the system's ways on macOS; Windows' and Linux's with a stand-in for the
// program), the original never changed, a sentence where nothing converts — made-up samples, names in any script.

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { crop, fileToShown, shownToFile, upright, type Box } from "../../src/image/image.ts";
import { decodeImage, encodeImage, exifOrientationOf, imageSize, shownSize, withoutExif } from "../../src/image/index.ts";
import { pdfScans } from "../../src/image/pdf.ts";
import { HEIF_CHECK, readableFile, readableTypes, waysHere, WINDOWS_PDF, WINRT_HEIC, type Run } from "../../src/core/readable.ts";
import { StromError } from "../../src/core/errors.ts";
import { halves, jpegWithOrientation, makePdf } from "../image-samples.ts";

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "strom readable ěš "));
const sha = (f: string) => crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex");
const mean = (img: { data: Uint8Array }) => img.data.reduce((a, b) => a + b, 0) / img.data.length;
const code = (f: () => unknown) => {
  try {
    f();
  } catch (e) {
    assert.ok(e instanceof StromError, String(e));
    return { code: e.code, message: e.message, hint: e.hint };
  }
  assert.fail("no error");
};

test("a place on the picture shown upright and the same place in its file: every orientation, there and back, the same pixels", () => {
  // a picture with every pixel its own: a place cut out of the upright picture is the place cut out of the file, turned
  const w = 8;
  const h = 4;
  const data = new Uint8Array(w * h * 3);
  for (let i = 0; i < w * h; i++) data.set([i * 7, i * 3, 255 - i * 5], i * 3);
  const file = { width: w, height: h, channels: 3 as const, data };
  for (let o = 1; o <= 8; o++) {
    const shown = upright(file, o);
    const r: Box = { x: 0.25, y: 0.25, w: 0.5, h: 0.5 };
    const f = shownToFile(r, o);
    assert.deepEqual(fileToShown(f, o), r, `orientation ${o}: there and back`);
    const px = (b: Box, img: { width: number; height: number }) => [Math.round(b.x * img.width), Math.round(b.y * img.height), Math.round(b.w * img.width), Math.round(b.h * img.height)] as const;
    const fromShown = crop(shown, ...px(r, shown));
    const fromFile = upright(crop(file, ...px(f, file)), o);
    assert.deepEqual([fromFile.width, fromFile.height], [fromShown.width, fromShown.height], `orientation ${o}: size`);
    assert.deepEqual(fromFile.data, fromShown.data, `orientation ${o}: the same pixels`);
  }
  assert.deepEqual(shownToFile({ x: 0.1, y: 0.2, w: 0.3, h: 0.4 }, undefined), { x: 0.1, y: 0.2, w: 0.3, h: 0.4 });
});

test("EXIF orientation: read from the bytes, the size as shown swapped for a quarter turn, the EXIF taken out of a page", () => {
  const jpeg = jpegWithOrientation(halves(40, 20), 6);
  assert.equal(exifOrientationOf(jpeg), 6);
  assert.deepEqual(imageSize(jpeg), { width: 40, height: 20 });
  assert.deepEqual(shownSize(jpeg), { width: 20, height: 40 });
  assert.deepEqual(shownSize(jpegWithOrientation(halves(40, 20), 3)), { width: 40, height: 20 });
  const bare = withoutExif(jpeg);
  assert.equal(exifOrientationOf(bare), undefined);
  assert.deepEqual(decodeImage(bare).data, decodeImage(jpeg).data, "the picture itself the same");
});

const scan = (w: number, h: number, grey: number) => ({ bytes: encodeImage({ width: w, height: h, channels: 3, data: new Uint8Array(w * h * 3).fill(grey) }, "jpeg", 92), width: w, height: h });

test("a PDF of scans: each page's JPEG as it is, its /Rotate, an object stream too; a page of text has none; an encrypted PDF is not read", () => {
  for (const objectStream of [false, true]) {
    const pdf = makePdf([{ jpeg: scan(60, 80, 50) }, { jpeg: scan(80, 60, 150), rotate: 90 }, {}], { objectStream });
    const s = pdfScans(pdf)!;
    assert.ok(s, `object stream ${objectStream}`);
    assert.equal(s.pages, 3);
    assert.deepEqual(imageSize(s.jpegs[0]!), { width: 60, height: 80 });
    assert.deepEqual(imageSize(s.jpegs[1]!), { width: 80, height: 60 });
    assert.equal(s.jpegs[2], undefined, "text: drawn by the system, not taken out");
    assert.deepEqual(s.rotate, [0, 90, 0]);
  }
  const locked = Buffer.from(makePdf([{ jpeg: scan(60, 80, 50) }])).toString("latin1").replace("/Size", "/Encrypt 99 0 R /Size");
  assert.equal(pdfScans(new Uint8Array(Buffer.from(locked, "latin1"))), undefined);
  assert.equal(pdfScans(new Uint8Array(Buffer.from("%PDF-1.4\nnothing\n"))), undefined);
});

test("readableFile: a PDF of scans read anywhere without programs — pages as the PDF shows them, the cache, page past the end; the original kept", () => {
  const root = tmp();
  // a name in any script and accent, decomposed too
  for (const name of ["Dopis z fary – Šťastná.pdf".normalize("NFD"), "Письмо.pdf"]) {
    const file = path.join(root, name);
    fs.writeFileSync(file, makePdf([{ jpeg: scan(60, 80, 50) }, { jpeg: scan(80, 60, 200), rotate: 90 }]));
    const before = sha(file);
    const env = { PATH: "", STROM_NO_CONVERT: "1" };
    const p1 = readableFile(root, file, { env });
    assert.equal(p1.how, "embedded");
    assert.equal(p1.pages, 2);
    assert.match(p1.file, /\.strom[\\/]converted[\\/][0-9a-f]{16}[\\/]1\.jpg$/);
    assert.deepEqual(imageSize(new Uint8Array(fs.readFileSync(p1.file))), { width: 60, height: 80 });
    const p2 = readableFile(root, file, { env, page: 2 });
    assert.deepEqual(imageSize(new Uint8Array(fs.readFileSync(p2.file))), { width: 60, height: 80 }, "turned as /Rotate 90 says");
    assert.ok(mean(decodeImage(new Uint8Array(fs.readFileSync(p2.file)))) > 180);
    // again: from the cache, no conversion
    const run: Run = () => assert.fail("nothing runs for a page in the cache");
    assert.equal(readableFile(root, file, { env: { PATH: "/usr/bin" }, page: 2, run, platform: "linux" }).file, p2.file);
    const past = code(() => readableFile(root, file, { env, page: 3 }));
    assert.equal(past.code, "read.page");
    assert.match(past.message, /has 2 pages, no page 3/);
    assert.equal(sha(file), before, "the original never changed");
  }
  // a JPEG is read as it is; a page 2 of it is not there; a text file is no picture
  const jpeg = path.join(root, "fotka.jpg");
  fs.writeFileSync(jpeg, encodeImage(halves(10, 10), "jpeg"));
  assert.deepEqual(readableFile(root, jpeg, { env: {} }), { file: jpeg, pages: 1, how: "as-is" });
  assert.equal(code(() => readableFile(root, jpeg, { env: {}, page: 2 })).code, "read.page");
  const txt = path.join(root, "zápis.txt");
  fs.writeFileSync(txt, "jen text");
  assert.equal(code(() => readableFile(root, txt, { env: {} })).code, "read.type");
});

test("readableFile: nothing to convert with — a sentence with a code, the hint for this system; types say what is read", () => {
  const root = tmp();
  const heic = path.join(root, "Fotka matriky.heic".normalize("NFD"));
  // an ISO-BMFF header of a HEIC photo: enough to be known
  fs.writeFileSync(heic, Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from("ftypheic\0\0\0\0mif1heic", "latin1"), Buffer.alloc(64)]));
  const env = { STROM_NO_CONVERT: "1" };
  for (const [platform, hint] of [["darwin", /Preview/], ["win32", /HEIF and HEVC/], ["linux", /heif-convert/]] as const) {
    const e = code(() => readableFile(root, heic, { env, platform }));
    assert.equal(e.code, "read.heic");
    assert.match(e.message, /original stays as it is/);
    assert.match(e.hint!, hint);
  }
  const text = path.join(root, "Text.pdf");
  fs.writeFileSync(text, makePdf([{}]));
  const e = code(() => readableFile(root, text, { env, platform: "linux" }));
  assert.equal(e.code, "read.pdf-render");
  assert.match(e.hint!, /pdftoppm/);
  assert.equal(fs.readdirSync(path.join(root, ".strom", "converted")).length, 0, "no work folder left");
  assert.deepEqual(readableTypes(env), ["image/jpeg", "image/png"]);
});

test("Windows: HEIC through WinRT only with the HEIF and HEVC extensions, PDF through Windows.Data.Pdf; paths through the environment", () => {
  const root = tmp();
  const bin = path.join(root, "bin");
  fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, "powershell.exe"), "");
  const calls: { args: string[]; env: Record<string, string | undefined> }[] = [];
  let codecs = "";
  const run: Run = (cmd, args, opts) => {
    assert.equal(cmd, "powershell.exe");
    calls.push({ args, env: opts.env });
    const script = args.at(-1)!;
    if (script === HEIF_CHECK) return { status: 0, stdout: codecs, stderr: "" };
    if (script === WINRT_HEIC) {
      fs.writeFileSync(opts.env.STROM_OUT!, encodeImage(halves(30, 20), "jpeg"));
      return { status: 0, stdout: "", stderr: "" };
    }
    if (script === WINDOWS_PDF) {
      for (let i = Number(opts.env.STROM_FROM); i <= Math.min(3, Number(opts.env.STROM_TO)); i++) fs.writeFileSync(path.join(opts.env.STROM_OUT!, `${i}.jpg`), encodeImage(halves(20, 30), "jpeg"));
      return { status: 0, stdout: "pages 3\r\n", stderr: "" };
    }
    return { status: 1, stdout: "", stderr: "unknown" };
  };
  // the extensions not installed (Windows has none of its own): no HEIC, PDF yes
  const env = { PATH: bin, PATHEXT: ".EXE" };
  assert.deepEqual(waysHere(env, "win32", run), { pdf: "windows-pdf" });
  codecs = "Microsoft.HEIFImageExtension\r\nMicrosoft.HEVCVideoExtension\r\n";
  const env2 = { PATH: bin + path.delimiter, PATHEXT: ".EXE" };
  assert.deepEqual(waysHere(env2, "win32", run), { heic: "winrt", pdf: "windows-pdf" });
  assert.deepEqual(readableTypes(env2, "win32", run), ["image/jpeg", "image/png", "image/heic", "image/heif", "application/pdf"]);

  const heic = path.join(root, "Křest – Jiří.heic".normalize("NFD"));
  fs.writeFileSync(heic, Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from("ftypheic\0\0\0\0mif1heic", "latin1"), Buffer.alloc(64)]));
  const h = readableFile(root, heic, { env: env2, platform: "win32", run });
  assert.equal(h.how, "winrt");
  assert.equal(calls.at(-1)!.env.STROM_IN, heic, "the path as it is, through the environment (nothing quoted)");
  assert.ok(!calls.at(-1)!.args.join(" ").includes(heic));
  assert.ok(calls.at(-1)!.args.includes("-NonInteractive"));
  const text = path.join(root, "Матрика.pdf");
  fs.writeFileSync(text, makePdf([{}, {}, {}]));
  const p = readableFile(root, text, { env: env2, platform: "win32", run, page: 3 });
  assert.equal(p.how, "windows-pdf");
  assert.equal(p.pages, 3);
  assert.equal(calls.at(-1)!.env.STROM_IN, text);
  assert.equal(calls.at(-1)!.env.STROM_FROM, "1");
  assert.equal(code(() => readableFile(root, text, { env: env2, platform: "win32", run, page: 4 })).code, "read.page");
  // the scripts take their paths from the environment alone
  for (const s of [WINRT_HEIC, WINDOWS_PDF]) assert.match(s, /\$env:STROM_IN/);
});

// stand-in programs found by their execute bit: none on Windows (found 2026-10-22 on Windows: {} there)
test("Linux: pdftoppm's pages named as strom names them, heif-convert for HEIC", { skip: process.platform === "win32" }, () => {
  const root = tmp();
  const bin = path.join(root, "bin");
  fs.mkdirSync(bin);
  for (const c of ["pdftoppm", "heif-convert"]) fs.writeFileSync(path.join(bin, c), "", { mode: 0o755 });
  const run: Run = (cmd, args) => {
    if (cmd === "pdftoppm") {
      const out = args.at(-1)!;
      for (let i = Number(args[args.indexOf("-f") + 1]); i <= 12; i++) fs.writeFileSync(`${out}-${String(i).padStart(2, "0")}.jpg`, encodeImage(halves(20, 30), "jpeg"));
      return { status: 0, stdout: "", stderr: "" };
    }
    fs.writeFileSync(args.at(-1)!, encodeImage(halves(30, 20), "jpeg"));
    return { status: 0, stdout: "", stderr: "" };
  };
  const env = { PATH: bin };
  assert.deepEqual(waysHere(env, "linux", run), { heic: "heif-convert", pdf: "pdftoppm" });
  const text = path.join(root, "Zápis.pdf");
  fs.writeFileSync(text, makePdf(Array.from({ length: 12 }, () => ({}))));
  const p = readableFile(root, text, { env, platform: "linux", run, page: 12 });
  assert.equal(p.how, "pdftoppm");
  assert.equal(p.pages, 12, "the PDF's own count");
  assert.match(p.file, /[\\/]12\.jpg$/);
});

const mac = process.platform === "darwin" && fs.existsSync("/usr/bin/sips") && fs.existsSync("/usr/bin/osascript");

test("macOS: a HEIC photo through sips, a PDF of text through PDFKit — the original kept, the photo's EXIF orientation kept", { skip: !mac }, () => {
  const root = tmp();
  // the system's own programs, never a stand-in of a test's PATH
  const env = { PATH: "/usr/bin:/bin" };
  const jpeg = path.join(root, "o6.jpg");
  fs.writeFileSync(jpeg, jpegWithOrientation(halves(60, 40), 6));
  const heic = path.join(root, "Fotka – Žofie.heic".normalize("NFD"));
  const made = spawnSync("/usr/bin/sips", ["-s", "format", "heic", jpeg, "--out", heic], { encoding: "utf8" });
  if (made.status !== 0 || !fs.existsSync(heic)) return; // a macOS writing no HEIC: nothing to try
  const before = sha(heic);
  const h = readableFile(root, heic, { env });
  assert.equal(h.how, "sips");
  const out = new Uint8Array(fs.readFileSync(h.file));
  assert.equal(exifOrientationOf(out), 6, "turned upright by the view, as any JPEG of a phone");
  assert.deepEqual(shownSize(out), { width: 40, height: 60 });
  assert.equal(sha(heic), before);

  const text = path.join(root, "Dopis.pdf");
  fs.writeFileSync(text, makePdf([{}, { rotate: 90 }]));
  const before2 = sha(text);
  const p1 = readableFile(root, text, { env });
  assert.equal(p1.how, "pdfkit");
  assert.equal(p1.pages, 2);
  const s1 = imageSize(new Uint8Array(fs.readFileSync(p1.file)))!;
  assert.equal(Math.max(s1.width, s1.height), 3000);
  assert.ok(s1.height > s1.width, "A4 upright");
  const s2 = imageSize(new Uint8Array(fs.readFileSync(readableFile(root, text, { env, page: 2 }).file)))!;
  assert.ok(s2.width > s2.height, "turned by /Rotate 90");
  assert.equal(sha(text), before2);
});
