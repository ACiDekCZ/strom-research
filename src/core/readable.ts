// What a reader can read on this computer, and the JPEG it reads: a photo from a phone in HEIC, the pages of a PDF —
// turned into JPEG for reading by what the system has (macOS sips and PDFKit, Windows' own decoders, poppler and
// libheif on Linux), or by strom itself where a PDF is only scans (image/pdf.ts). The original is never changed: the
// JPEGs are a cache in .strom/converted/<sha>/ (made again from the original whenever needed; strom tidy keeps it
// within limits). Where nothing here converts it, it is said — to a person in the research's language
// (ui.error.read.*), to an agent in English.

import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { StromError } from "./errors.ts";
import type { Env } from "./paths.ts";
import { which } from "./which.ts";
import { decodeJpeg } from "../image/jpeg-decode.ts";
import { encodeJpeg } from "../image/jpeg-encode.ts";
import { rotate } from "../image/image.ts";
import { formatOf, withoutExif } from "../image/index.ts";
import { pdfScans } from "../image/pdf.ts";

/** How a HEIC photo or a PDF becomes JPEG here. */
export type Converter = "sips" | "winrt" | "heif-convert" | "magick" | "pdfkit" | "windows-pdf" | "pdftoppm";

export interface Ways {
  heic?: Converter;
  /** A PDF drawn by the system: any PDF (a PDF of scans is read by strom itself everywhere). */
  pdf?: Converter;
}

/** Pages of a PDF made for one reading at most (a longer one: the pages asked, so many at a time). */
export const PDF_PAGES = 10;
/** The long side of a PDF page drawn for reading: the detail of a scan at about 300 dpi, a crop read at full size. */
export const PDF_LONG = 3000;
/** The longest a conversion may take (a large PDF page by page). */
const CONVERT_MS = 180_000;

export interface Run {
  (cmd: string, args: string[], opts: { env: Env; timeout: number }): { status: number | null; stdout: string; stderr: string };
}

const spawn: Run = (cmd, args, opts) => {
  const r = spawnSync(cmd, args, { env: opts.env as NodeJS.ProcessEnv, timeout: opts.timeout, encoding: "utf8", windowsHide: true, maxBuffer: 8 * 1024 * 1024 });
  return { status: r.error ? null : r.status, stdout: r.stdout ?? "", stderr: r.stderr ?? (r.error ? String(r.error.message) : "") };
};

const memo = new Map<string, Ways>();

/**
 * The ways this computer converts (found once per process: what is on PATH; on Windows whether the HEIF and HEVC
 * extensions are installed — without them Windows decodes no HEIC). STROM_NO_CONVERT=1: none (tests, a check of
 * what is said without them).
 */
export function waysHere(env: Env, platform: NodeJS.Platform = process.platform, run: Run = spawn): Ways {
  if (env.STROM_NO_CONVERT === "1") return {};
  const key = `${platform}\0${env.PATH ?? env.Path ?? ""}`;
  const known = memo.get(key);
  if (known) return known;
  const has = (cmd: string) => !!which(cmd, env, platform);
  const ways: Ways = {};
  if (platform === "darwin") {
    if (has("sips")) ways.heic = "sips";
    if (has("osascript")) ways.pdf = "pdfkit";
  } else if (platform === "win32") {
    if (has("powershell")) {
      if (heifCodecs(env, run)) ways.heic = "winrt";
      ways.pdf = "windows-pdf";
    }
  }
  if (!ways.heic && has("heif-convert")) ways.heic = "heif-convert";
  if (!ways.heic && has("magick")) ways.heic = "magick";
  if (!ways.pdf && has("pdftoppm")) ways.pdf = "pdftoppm";
  memo.set(key, ways);
  return ways;
}

/** Whether Windows has the extensions to decode HEIC (HEIF for the container, HEVC for the picture in it). */
export function heifCodecs(env: Env, run: Run = spawn): boolean {
  const r = run("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", HEIF_CHECK], { env, timeout: 20_000 });
  return r.status === 0 && /HEIFImageExtension/i.test(r.stdout) && /HEVCVideoExtension/i.test(r.stdout);
}

export const HEIF_CHECK = "Get-AppxPackage -Name Microsoft.HEIFImageExtension, 'Microsoft.HEVCVideoExtension*' | ForEach-Object { $_.Name }";

/**
 * What a reader can read on this computer, as types of files: JPEG and PNG always; HEIC where it converts; PDF where
 * the system draws any PDF (a PDF of scans alone is read anywhere, but nobody knows beforehand which a PDF is).
 */
export function readableTypes(env: Env, platform: NodeJS.Platform = process.platform, run: Run = spawn): string[] {
  const w = waysHere(env, platform, run);
  return ["image/jpeg", "image/png", ...(w.heic ? ["image/heic", "image/heif"] : []), ...(w.pdf ? ["application/pdf"] : [])];
}

export interface Readable {
  /** The JPEG or PNG a reader reads: the file itself, or the page made of it. */
  file: string;
  /** Pages of the document (a PDF's; 1 for a picture). */
  pages: number;
  /** How it was made readable: as it is, or converted (and by what). */
  how: "as-is" | "embedded" | Converter;
}

function sha16(file: string): string {
  const h = crypto.createHash("sha256");
  const fd = fs.openSync(file, "r");
  try {
    const buf = Buffer.alloc(1024 * 1024);
    for (let n = fs.readSync(fd, buf, 0, buf.length, null); n > 0; n = fs.readSync(fd, buf, 0, buf.length, null)) h.update(buf.subarray(0, n));
  } finally {
    fs.closeSync(fd);
  }
  return h.digest("hex").slice(0, 16);
}

function head(file: string): Uint8Array {
  const fd = fs.openSync(file, "r");
  try {
    const b = Buffer.alloc(32);
    return b.subarray(0, fs.readSync(fd, b, 0, 32, 0));
  } finally {
    fs.closeSync(fd);
  }
}

/** The folder of the JPEGs made of one original (by its content: the same file under another name is the same). */
export function convertedDir(root: string, file: string): string {
  return path.join(root, ".strom", "converted", sha16(file));
}

interface Info {
  pages: number;
  how: Readable["how"];
}

function readInfo(dir: string): Info | undefined {
  try {
    const i = JSON.parse(fs.readFileSync(path.join(dir, "info.json"), "utf8")) as Info;
    return Number.isInteger(i.pages) && i.pages > 0 ? i : undefined;
  } catch {
    return undefined;
  }
}

/** Put what was made in a work folder into the cache, file by file (another process making the same is no harm). */
function settle(work: string, dir: string, info: Info): void {
  fs.mkdirSync(dir, { recursive: true });
  for (const f of fs.readdirSync(work)) {
    const to = path.join(dir, f);
    try {
      fs.renameSync(path.join(work, f), to);
    } catch {
      // there already (Windows does not replace): the one there is the same
    }
  }
  fs.writeFileSync(path.join(dir, "info.json"), JSON.stringify(info));
  fs.rmSync(work, { recursive: true, force: true });
}

/**
 * The file a reader reads for page `page` (1 = the first) of an image or a document: a JPEG or PNG as it is; a HEIC
 * photo or a PDF page converted to JPEG in the cache. Throws a StromError with a code when this computer cannot
 * convert it (read.heic, read.pdf-render), when it is no picture (read.type), when the page is not there (read.page) or the
 * conversion failed (read.convert).
 */
export function readableFile(root: string, file: string, opts: { env: Env; page?: number; platform?: NodeJS.Platform; run?: Run }): Readable {
  const page = opts.page ?? 1;
  const f = formatOf(head(file));
  const name = path.basename(file);
  if (f === "jpeg" || f === "png") {
    if (page !== 1) throw pageError(name, page, 1);
    return { file, pages: 1, how: "as-is" };
  }
  if (f !== "heic" && f !== "pdf")
    throw new StromError(`${name} is no picture a reader reads (JPEG, PNG, HEIC or PDF${f !== "unknown" ? `; this is ${f.toUpperCase()}` : ""}) — the original stays as it is`, {
      code: "read.type",
      params: { file: name },
      hint: "save it as JPEG (any image viewer can) and give that",
    });
  if (f === "heic" && page !== 1) throw pageError(name, page, 1);
  const dir = convertedDir(root, file);
  const target = path.join(dir, `${page}.jpg`);
  const info = readInfo(dir);
  if (info && page > info.pages) throw pageError(name, page, info.pages);
  if (info && fs.existsSync(target)) {
    // used now: strom tidy keeps what is used
    try {
      const now = new Date();
      fs.utimesSync(dir, now, now);
    } catch {
      // read only, or gone meanwhile: nothing lost
    }
    return { file: target, pages: info.pages, how: info.how };
  }
  const platform = opts.platform ?? process.platform;
  const run = opts.run ?? spawn;
  const work = path.join(path.dirname(dir), `.${path.basename(dir)}-${process.pid}-${crypto.randomBytes(3).toString("hex")}`);
  fs.mkdirSync(work, { recursive: true });
  try {
    const made = f === "heic" ? heicToJpeg(file, work, opts.env, platform, run) : pdfToJpeg(file, work, page, opts.env, platform, run);
    if (page > made.pages) throw pageError(name, page, made.pages);
    settle(work, dir, made);
    if (!fs.existsSync(target)) throw convertError(name, "no page came of it");
    return { file: target, pages: made.pages, how: made.how };
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

function pageError(name: string, page: number, pages: number): StromError {
  return new StromError(`${name} has ${pages === 1 ? "one page" : `${pages} pages`}, no page ${page}`, { code: "read.page", params: { file: name, page: String(page), pages: String(pages) }, hint: `a page from 1 to ${pages}` });
}

function convertError(name: string, why: string): StromError {
  return new StromError(`${name} could not be converted for reading: ${why} — the original stays as it is`, { code: "read.convert", params: { file: name }, hint: "save it as JPEG (any image viewer can) and give that" });
}

/** Said where this computer converts no HEIC. */
export function noHeicError(name: string, platform: NodeJS.Platform = process.platform): StromError {
  return new StromError(`${name}: a HEIC photo cannot be converted for reading on this computer — the original stays as it is`, {
    code: "read.heic",
    params: { file: name },
    hintCode: platform === "win32" ? "read.heic.windows" : platform === "darwin" ? "read.heic.mac" : "read.heic.linux",
    hint:
      platform === "win32"
        ? "the person installs the HEIF and HEVC extensions (Microsoft Store), or saves the photo as JPEG"
        : platform === "darwin"
          ? "save the photo as JPEG (Preview: File → Export)"
          : "install heif-convert (libheif) or ImageMagick, or save the photo as JPEG",
  });
}

/** Said where this computer draws no PDF (one of scans alone is read anyway). */
export function noPdfError(name: string, platform: NodeJS.Platform = process.platform): StromError {
  return new StromError(`${name}: this PDF cannot be turned into pictures for reading on this computer — the original stays as it is`, {
    code: "read.pdf-render",
    params: { file: name },
    hintCode: platform === "linux" ? "read.pdf-render.linux" : "read.pdf-render",
    hint: platform === "linux" ? "install pdftoppm (poppler-utils), or save the pages as JPEG" : "save the pages as JPEG and give those",
  });
}

function heicToJpeg(file: string, work: string, env: Env, platform: NodeJS.Platform, run: Run): Info {
  const name = path.basename(file);
  const how = waysHere(env, platform, run).heic;
  if (!how) throw noHeicError(name, platform);
  const out = path.join(work, "1.jpg");
  const r = convertCommand(how, file, out, env, run);
  if (r.status !== 0 || !fs.existsSync(out) || formatOf(head(out)) !== "jpeg") throw convertError(name, firstLine(r.stderr || r.stdout) || `${how} gave no JPEG`);
  return { pages: 1, how };
}

function convertCommand(how: Converter, file: string, out: string, env: Env, run: Run): ReturnType<Run> {
  const o = { env, timeout: CONVERT_MS };
  // the photo stays as it lies, its EXIF orientation with it (sips), or is turned upright with none left (the others)
  if (how === "sips") return run("sips", ["-s", "format", "jpeg", "-s", "formatOptions", "92", file, "--out", out], o);
  if (how === "heif-convert") return run("heif-convert", ["-q", "92", file, out], o);
  if (how === "magick") return run("magick", [file, "-auto-orient", "-quality", "92", out], o);
  // paths through the environment: any script, any accent, nothing to quote
  return run("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", WINRT_HEIC], { env: { ...env, STROM_IN: file, STROM_OUT: out }, timeout: CONVERT_MS });
}

function firstLine(s: string): string {
  return (s.split(/\r?\n/).find((l) => l.trim()) ?? "").trim().slice(0, 200);
}

function pdfToJpeg(file: string, work: string, page: number, env: Env, platform: NodeJS.Platform, run: Run): Info {
  const name = path.basename(file);
  // the pages asked, so many at a time: page 12 brings 11–20
  const from = Math.floor((page - 1) / PDF_PAGES) * PDF_PAGES + 1;
  const to = from + PDF_PAGES - 1;
  const bytes = fs.statSync(file).size <= 200 * 1024 * 1024 ? new Uint8Array(fs.readFileSync(file)) : undefined;
  const scans = bytes ? pdfScans(bytes) : undefined;
  // a page past the last: its count is the PDF's own, nothing to draw
  if (scans && scans.pages > 0 && from > scans.pages) return { pages: scans.pages, how: "embedded" };
  if (scans && scans.jpegs.slice(from - 1, Math.min(to, scans.pages)).every(Boolean)) {
    for (let n = from; n <= Math.min(to, scans.pages); n++) {
      const turn = scans.rotate[n - 1]!;
      // the page as the PDF shows it: its EXIF is not the PDF's (a viewer of the PDF ignores it), its /Rotate is
      let jpeg = withoutExif(scans.jpegs[n - 1]!);
      if (turn) jpeg = encodeJpeg(rotate(decodeJpeg(jpeg), turn as 90 | 180 | 270), 92);
      fs.writeFileSync(path.join(work, `${n}.jpg`), jpeg);
    }
    return { pages: scans.pages, how: "embedded" };
  }
  const how = waysHere(env, platform, run).pdf;
  if (!how) throw noPdfError(name, platform);
  const o = { timeout: CONVERT_MS };
  let r: ReturnType<Run>;
  if (how === "pdftoppm") {
    r = run("pdftoppm", ["-jpeg", "-jpegopt", "quality=92", "-scale-to", String(PDF_LONG), "-f", String(from), "-l", String(to), file, path.join(work, "p")], { env, ...o });
    // p-1.jpg, p-01.jpg, p-001.jpg: as many digits as the last page has
    for (const f of fs.readdirSync(work)) {
      const m = /^p-0*(\d+)\.jpg$/.exec(f);
      if (m) fs.renameSync(path.join(work, f), path.join(work, `${Number(m[1])}.jpg`));
    }
  } else {
    const vars = { ...env, STROM_IN: file, STROM_OUT: work, STROM_FROM: String(from), STROM_TO: String(to), STROM_LONG: String(PDF_LONG) };
    r = how === "pdfkit" ? run("osascript", ["-l", "JavaScript", "-e", PDFKIT_PAGES], { env: vars, ...o }) : run("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", WINDOWS_PDF], { env: vars, ...o });
  }
  const said = /^pages (\d+)$/m.exec(r.stdout);
  const pages = said ? Number(said[1]) : scans?.pages;
  const made = fs.readdirSync(work).filter((f) => /^\d+\.jpg$/.test(f));
  if (r.status !== 0 || !made.length) {
    if (pages !== undefined && from > pages) return { pages, how };
    throw convertError(name, firstLine(r.stderr || r.stdout) || `${how} gave no page`);
  }
  // pdftoppm says no count: the pages it made, and more when it made all it was asked
  return { pages: pages ?? (made.length < PDF_PAGES ? from - 1 + made.length : to), how };
}

/**
 * macOS: the pages of a PDF drawn by PDFKit (osascript, JavaScript for Automation), each its long side STROM_LONG px,
 * as the PDF shows it (its rotation too); prints "pages <n>".
 */
export const PDFKIT_PAGES = `ObjC.import('Foundation'); ObjC.import('PDFKit'); ObjC.import('AppKit');
const env = $.NSProcessInfo.processInfo.environment;
const get = (k) => ObjC.unwrap(env.objectForKey(k));
const doc = $.PDFDocument.alloc.initWithURL($.NSURL.fileURLWithPath(get('STROM_IN')));
if (!doc || doc.isNil() || doc.isLocked) { throw new Error('the PDF cannot be opened'); }
const n = doc.pageCount; const from = Number(get('STROM_FROM')); const to = Math.min(n, Number(get('STROM_TO'))); const long = Number(get('STROM_LONG'));
for (let i = from; i <= to; i++) {
  const page = doc.pageAtIndex(i - 1);
  const b = page.boundsForBox($.kPDFDisplayBoxMediaBox);
  let w = b.size.width, h = b.size.height; if (page.rotation % 180) { const t = w; w = h; h = t; }
  const k = long / Math.max(w, h);
  const img = page.thumbnailOfSizeForBox($.NSMakeSize(Math.round(w * k), Math.round(h * k)), $.kPDFDisplayBoxMediaBox);
  const rep = $.NSBitmapImageRep.imageRepWithData(img.TIFFRepresentation);
  const jpeg = rep.representationUsingTypeProperties($.NSBitmapImageFileTypeJPEG, $({ NSImageCompressionFactor: 0.92 }));
  jpeg.writeToFileAtomically(get('STROM_OUT') + '/' + i + '.jpg', true);
}
'pages ' + n;`;

/** The WinRT helpers of Windows PowerShell: an asynchronous call of Windows waited for. */
const WINRT_AWAIT = `$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation\`1' })[0]
$asTaskAction = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncAction' })[0]
function Await($op, [Type]$type) { $t = $asTask.MakeGenericMethod($type).Invoke($null, @($op)); $t.Wait(-1) | Out-Null; $t.Result }
function AwaitAction($op) { $t = $asTaskAction.Invoke($null, @($op)); $t.Wait(-1) | Out-Null }
[Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime] | Out-Null
[Windows.Storage.StorageFolder, Windows.Storage, ContentType = WindowsRuntime] | Out-Null
[Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics, ContentType = WindowsRuntime] | Out-Null
[Windows.Storage.Streams.IRandomAccessStream, Windows.Storage.Streams, ContentType = WindowsRuntime] | Out-Null
function OpenOut($path) {
  $folder = Await ([Windows.Storage.StorageFolder]::GetFolderFromPathAsync([System.IO.Path]::GetDirectoryName($path))) ([Windows.Storage.StorageFolder])
  $file = Await ($folder.CreateFileAsync([System.IO.Path]::GetFileName($path), [Windows.Storage.CreationCollisionOption]::ReplaceExisting)) ([Windows.Storage.StorageFile])
  Await ($file.OpenAsync([Windows.Storage.FileAccessMode]::ReadWrite)) ([Windows.Storage.Streams.IRandomAccessStream])
}
`;

/**
 * Windows: a HEIC photo decoded by Windows (the HEIF and HEVC extensions) turned upright by its orientation, written
 * as JPEG (STROM_IN → STROM_OUT).
 */
export const WINRT_HEIC = `${WINRT_AWAIT}$in = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($env:STROM_IN)) ([Windows.Storage.StorageFile])
$stream = Await ($in.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
$decoder = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
$bitmap = Await ($decoder.GetSoftwareBitmapAsync([Windows.Graphics.Imaging.BitmapPixelFormat]::Bgra8, [Windows.Graphics.Imaging.BitmapAlphaMode]::Ignore, (New-Object Windows.Graphics.Imaging.BitmapTransform), [Windows.Graphics.Imaging.ExifOrientationMode]::RespectExifOrientation, [Windows.Graphics.Imaging.ColorManagementMode]::ColorManageToSRgb)) ([Windows.Graphics.Imaging.SoftwareBitmap])
$out = OpenOut $env:STROM_OUT
$encoder = Await ([Windows.Graphics.Imaging.BitmapEncoder]::CreateAsync([Windows.Graphics.Imaging.BitmapEncoder]::JpegEncoderId, $out)) ([Windows.Graphics.Imaging.BitmapEncoder])
$encoder.SetSoftwareBitmap($bitmap)
AwaitAction ($encoder.FlushAsync())
$out.Dispose(); $stream.Dispose()
`;

/**
 * Windows: the pages STROM_FROM–STROM_TO of a PDF drawn by Windows (Windows.Data.Pdf, part of Windows 10 and 11),
 * each its long side STROM_LONG px, as JPEG into STROM_OUT; prints "pages <n>".
 */
export const WINDOWS_PDF = `${WINRT_AWAIT}[Windows.Data.Pdf.PdfDocument, Windows.Data.Pdf, ContentType = WindowsRuntime] | Out-Null
$in = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($env:STROM_IN)) ([Windows.Storage.StorageFile])
$doc = Await ([Windows.Data.Pdf.PdfDocument]::LoadFromFileAsync($in)) ([Windows.Data.Pdf.PdfDocument])
$n = [int]$doc.PageCount
$to = [Math]::Min($n, [int]$env:STROM_TO)
for ($i = [int]$env:STROM_FROM; $i -le $to; $i++) {
  $page = $doc.GetPage([uint32]($i - 1))
  $k = [double]$env:STROM_LONG / [Math]::Max($page.Size.Width, $page.Size.Height)
  $options = New-Object Windows.Data.Pdf.PdfPageRenderOptions
  $options.DestinationWidth = [uint32][Math]::Round($page.Size.Width * $k)
  $options.DestinationHeight = [uint32][Math]::Round($page.Size.Height * $k)
  $options.BitmapEncoderId = [Windows.Graphics.Imaging.BitmapEncoder]::JpegEncoderId
  $out = OpenOut ([System.IO.Path]::Combine($env:STROM_OUT, "$i.jpg"))
  AwaitAction ($page.RenderToStreamAsync($out, $options))
  $out.Dispose(); $page.Dispose()
}
"pages $n"
`;
