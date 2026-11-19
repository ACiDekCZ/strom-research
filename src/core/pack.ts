// A research handed to someone else: one ZIP file with the tree as it was last
// saved (its history too), the archive scans its records stand on, the images
// nobody can fetch again (saved by hand), the family's photos and originals, the
// batches the Strom app sent them in (their name, people, note) and the
// connectors that fetched the rest. The other scans are left out: the archive
// gives the same scan again when it is needed (strom fetch puts it back, checked).
// No ZIP64: a package over 4 GB is refused before anything is written (ZipTooLarge),
// the whole folder copied takes such a research along.
// The one who gets it unpacks it with strom: into their trees, the images into
// their shared folder, the connectors into their plugins, and takes it over.

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import * as git from "./git.ts";
import { connectorsDir } from "./connector.ts";
import { mergeCatalog, regionFile, regionIdOk, regionsOfTree, type Catalog } from "./pastevents.ts";
import { mergePlaceCatalog, placeFile, placeKeyOf, placeKeyOk, type PlaceCatalog } from "./placehistory.ts";
import { StromError, UsageError } from "./errors.ts";
import { createKey } from "./seal.ts";
import { safeFolderName } from "./text.ts";
import { Tree, VERSION } from "./tree.ts";
import { verifyFull } from "./integrity.ts";
import { readZip, unzipTo, ZipTooLarge, ZipWriter, ZIP_MAX_BYTES, ZIP_MAX_FILES } from "./zip.ts";
import { BATCH_ID, listBatches } from "./batches.ts";
import type { Input, Media, Place, Source } from "./model.ts";
import type { Env } from "./paths.ts";
import { workingRel } from "./treemedia.ts";

export const PACK_MANIFEST = "strom-pack.json";
export const INSTALL_WINDOWS = "irm https://raw.githubusercontent.com/ACiDekCZ/strom-research/main/install/install.ps1 | iex";
export const INSTALL_UNIX = "curl -fsSL https://raw.githubusercontent.com/ACiDekCZ/strom-research/main/install/install.sh | sh";

export interface PackManifest {
  kind: "strom-research-pack";
  format: 1;
  tree: { id: string; name: string; lang: string };
  /** The tree's folder in the package. */
  folder: string;
  created: string;
  strom: string;
  commit: string;
  images: "records" | "all";
  /** Files of the shared folder in the package (media/…). */
  media: string[];
  connectors: string[];
  /** The catalogs of the regions of history the tree's places belong to (shared/history/regions/<id>.json); merged on unpack, never written over. */
  history?: string[];
  /** The catalogs of the history of the tree's places (shared/history/places/<key>.json); merged on unpack, never written over. */
  places?: string[];
  /** Images left out (the archive gives them again). */
  left: { count: number; bytes: number };
  /** The batches of the Strom app the family's material came in (<folder>/.strom/batches/<id>.json); none before 1.35. */
  batches?: string[];
}

export interface PackPlan {
  /** Shared-relative files to take, with their size; `family`: the family's photos and originals, not an archive scan. */
  media: { file: string; size: number; family: boolean }[];
  /** The batches of the Strom app that go along (.strom/batches/<id>.json). */
  batches: string[];
  connectors: string[];
  left: { count: number; bytes: number; connectors: number };
  /** Shared-relative files the tree names that are not on this computer. */
  missing: string[];
}

/** An archive's scan: an image of a book (its record set), or one a connector fetched — not the family's photo or original. */
export function isScan(m: { recordset?: string; fetched?: unknown }): boolean {
  return !!m.recordset || !!m.fetched;
}

/** What goes into a package of this tree: every image (all), or the ones its records stand on and the ones nobody can fetch again. */
export function packPlan(tree: Tree, shared: string, all: boolean): PackPlan {
  const media = tree.list<Media>("media");
  const cited = new Set<string>();
  for (const s of tree.list<Source>("source")) {
    if (s.retracted) continue;
    for (const id of s.media ?? []) cited.add(id);
    for (const c of s.clips ?? []) cited.add(c.media);
  }
  // an image's other copies and parts go along: a view uses the sharpest
  const citedImages = new Set(media.filter((m) => cited.has(m.id) && m.recordset && m.image !== undefined).map((m) => `${m.recordset}:${m.image}`));
  const take = new Map<string, { size: number; family: boolean }>();
  const missing = new Set<string>();
  // a file both a scan and the family's (the same content) is the family's: said so where it goes
  const add = (file: string, size: number, family: boolean) => {
    if (fs.existsSync(path.join(shared, file))) take.set(file, { size, family: family || !!take.get(file)?.family });
    else missing.add(file);
  };
  let leftCount = 0;
  let leftBytes = 0;
  const connectors = new Set<string>();
  for (const m of media) {
    if (m.fetched) connectors.add(m.fetched.connector);
    const needed = all || cited.has(m.id) || !m.fetched || citedImages.has(`${m.recordset}:${m.image}`);
    if (needed) add(m.file, m.size, !isScan(m));
    else {
      leftCount++;
      leftBytes += m.size;
    }
  }
  // the family's material kept in the shared store
  // …and the working copy the Strom app shows of a record of its tree (spec 108): the original and it go together
  for (const i of tree.list<Input>("input")) {
    if (i.file?.startsWith("media:")) add(i.file.slice(6), i.size ?? 0, true);
    if (i.working) add(workingRel(shared, i.working), i.working.bytes, true);
  }
  const have = [...connectors].filter((c) => fs.existsSync(path.join(connectorsDir(shared), c, "connector.json")));
  return {
    media: [...take].map(([file, t]) => ({ file, size: t.size, family: t.family })).sort((a, b) => a.file.localeCompare(b.file)),
    batches: listBatches(tree.root)
      .map((b) => b.id)
      .filter((id) => BATCH_ID.test(id)),
    connectors: have.sort(),
    left: { count: leftCount, bytes: leftBytes, connectors: connectors.size - have.length },
    missing: [...missing],
  };
}

/** The files under a folder, and its empty folders ending in "/" (git needs them). */
function walk(dir: string, rel = ""): string[] {
  const out: string[] = [];
  const entries = fs.readdirSync(path.join(dir, rel), { withFileTypes: true });
  for (const e of entries) {
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) {
      if (e.name === "node_modules") continue;
      out.push(...walk(dir, r));
    } else if (e.isFile() && e.name !== ".DS_Store") out.push(r);
  }
  if (rel && !entries.length) out.push(`${rel}/`);
  return out;
}

/** The size and number of the files under a folder, as walk() takes them. */
function measure(dir: string): { bytes: number; files: number } {
  let bytes = 0;
  const all = walk(dir);
  for (const f of all) if (!f.endsWith("/")) bytes += fs.statSync(path.join(dir, ...f.split("/"))).size;
  return { bytes, files: all.length };
}

/** The most a package may hold: a ZIP without ZIP64, lower where STROM_PACK_MAX_BYTES says (never higher). */
function packMax(env: Env): number {
  const n = Number(env.STROM_PACK_MAX_BYTES);
  return Number.isFinite(n) && n > 0 ? Math.min(n, ZIP_MAX_BYTES) : ZIP_MAX_BYTES;
}

function addTree(zip: ZipWriter, prefix: string, dir: string): void {
  for (const f of walk(dir)) {
    if (f.endsWith("/")) zip.addDir(`${prefix}/${f}`);
    else zip.addFile(`${prefix}/${f}`, path.join(dir, ...f.split("/")));
  }
}

/**
 * What the one who gets the package starts with a double click once it is unpacked: strom installed where it is
 * not (the official installer, nothing else), the research put in place from the folder the launcher lies in,
 * then strom. `say`: the two sentences it may need, in the research language.
 */
export function launchers(say: { extract: string; failed: string }): { name: string; text: string; mode: number }[] {
  const cmd = [
    "@echo off",
    "chcp 65001 >nul",
    'cd /d "%~dp0"',
    'if exist "%~dp0' + PACK_MANIFEST + '" goto found',
    `echo ${say.extract}`,
    "pause",
    "exit /b 1",
    ":found",
    'set "STROM="',
    'for /f "delims=" %%i in (\'where strom.cmd 2^>nul\') do if not defined STROM set "STROM=%%i"',
    'if not defined STROM if exist "%LOCALAPPDATA%\\Programs\\Strom\\strom.cmd" set "STROM=%LOCALAPPDATA%\\Programs\\Strom\\strom.cmd"',
    "if defined STROM goto run",
    `powershell -NoProfile -ExecutionPolicy Bypass -Command "$env:STROM_INSTALL_ONLY='1'; ${INSTALL_WINDOWS}"`,
    'if exist "%LOCALAPPDATA%\\Programs\\Strom\\strom.cmd" set "STROM=%LOCALAPPDATA%\\Programs\\Strom\\strom.cmd"',
    "if defined STROM goto run",
    `echo ${say.failed}`,
    "pause",
    "exit /b 1",
    ":run",
    'call "%STROM%" unpack "%~dp0."',
    'call "%STROM%"',
    "",
  ].join("\r\n");
  const sh = [
    "#!/bin/bash",
    'cd "$(dirname "$0")" || exit 1',
    'if [ ! -f "' + PACK_MANIFEST + '" ]; then echo "' + say.extract.replace(/"/g, "'") + '"; read -r _; exit 1; fi',
    'STROM="$(command -v strom || true)"',
    '[ -z "$STROM" ] && [ -x "$HOME/.local/bin/strom" ] && STROM="$HOME/.local/bin/strom"',
    'if [ -z "$STROM" ]; then',
    `  ${INSTALL_UNIX.replace(/\| sh$/, "| STROM_INSTALL_ONLY=1 sh")}`,
    '  [ -x "$HOME/.local/bin/strom" ] && STROM="$HOME/.local/bin/strom"',
    "fi",
    'if [ -z "$STROM" ]; then echo "' + say.failed.replace(/"/g, "'") + '"; read -r _; exit 1; fi',
    '"$STROM" unpack "$(pwd)"',
    '"$STROM"',
    "",
  ].join("\n");
  return [
    { name: "Windows.cmd", text: cmd, mode: 0o755 },
    { name: "macOS.command", text: sh, mode: 0o755 },
    { name: "Linux.sh", text: sh, mode: 0o755 },
  ];
}

/** Write the package. `readme`: the file name and text for the person who gets it; `say`: what its launchers may need to say. */
export function writePack(
  tree: Tree,
  shared: string,
  out: string,
  opts: { all: boolean; readme: { name: string; text: string }; say: { extract: string; failed: string } },
): { file: string; bytes: number; manifest: PackManifest; plan: PackPlan } {
  const plan = packPlan(tree, shared, opts.all);
  const folder = safeFolderName(tree.config.name) || "tree";
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "strom-pack-"));
  const zip = new ZipWriter(out);
  try {
    // the tree as it was last saved, its history too — never what is half written
    const clone = path.join(tmp, folder);
    const r = git.runGit(tmp, ["clone", "--quiet", "--no-hardlinks", tree.root, clone]);
    if (r.status !== 0) throw new StromError(`could not copy the tree: ${r.stderr.trim()}`);
    git.runGit(clone, ["remote", "remove", "origin"]);
    git.runGit(clone, ["gc", "--quiet", "--prune=now"]);
    const commit = git.head(clone) ?? "";
    // over 4 GB (or 65 535 files) is no ZIP strom writes: said before a byte of it is written
    const sizes = [measure(clone), ...plan.connectors.map((c) => measure(path.join(connectorsDir(shared), c)))];
    const bytes = sizes.reduce((s, x) => s + x.bytes, 0) + plan.media.reduce((s, m) => s + m.size, 0);
    const files = sizes.reduce((s, x) => s + x.files, 0) + plan.media.length + plan.batches.length + 8;
    if (bytes > packMax(tree.env) || files >= ZIP_MAX_FILES) throw new ZipTooLarge("the package would be over 4 GB or 65 535 files");
    const manifest: PackManifest = {
      kind: "strom-research-pack",
      format: 1,
      tree: { id: tree.config.id, name: tree.config.name, lang: tree.config.lang },
      folder,
      created: new Date().toISOString(),
      strom: VERSION,
      commit,
      images: opts.all ? "all" : "records",
      media: plan.media.map((m) => m.file),
      connectors: plan.connectors,
      left: { count: plan.left.count, bytes: plan.left.bytes },
      ...(plan.batches.length ? { batches: plan.batches } : {}),
    };
    const regions = regionsOfTree(tree).filter((id) => fs.existsSync(regionFile(shared, id)));
    if (regions.length) manifest.history = regions;
    const places = [...new Set(tree.list<Place>("place").filter((p) => !p.retracted).map((p) => placeKeyOf(tree, p)))].filter((k) => fs.existsSync(placeFile(shared, k)));
    if (places.length) manifest.places = places;
    // CRLF: Notepad of an older Windows shows it right too
    zip.add(opts.readme.name, Buffer.from(opts.readme.text.replace(/\n/g, "\r\n"), "utf8"));
    for (const l of launchers(opts.say)) zip.add(l.name, Buffer.from(l.text, "utf8"), { mode: l.mode });
    zip.add(PACK_MANIFEST, Buffer.from(JSON.stringify(manifest, null, 2) + "\n", "utf8"));
    addTree(zip, folder, clone);
    // the batches beside the tree, where strom keeps them (.strom, not its data): unpacking puts them in place
    for (const id of plan.batches) zip.addFile(`${folder}/.strom/batches/${id}.json`, path.join(tree.root, ".strom", "batches", `${id}.json`));
    for (const m of plan.media) zip.addFile(`shared/${m.file}`, path.join(shared, ...m.file.split("/")));
    for (const c of plan.connectors) {
      addTree(zip, `shared/plugins/connectors/${c}`, path.join(connectorsDir(shared), c));
    }
    for (const id of regions) zip.addFile(`shared/history/regions/${id}.json`, regionFile(shared, id));
    for (const key of places) zip.addFile(`shared/history/places/${key}.json`, placeFile(shared, key));
    zip.close();
    return { file: out, bytes: fs.statSync(out).size, manifest, plan };
  } catch (e) {
    zip.abort();
    throw e;
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

/** A package given as the ZIP file or the folder a system unpacked it into: its manifest and where it lies. */
export function findPack(src: string): { manifest: PackManifest; dir: string; zip?: string; tmp?: string } {
  if (!fs.existsSync(src)) throw new UsageError(`there is no ${src}`, { hint: "the ZIP file that came (dragged into the terminal)", code: "pack.missing", params: { path: src } });
  const read = (text: string): PackManifest => {
    const m = JSON.parse(text) as PackManifest;
    if (m.kind !== "strom-research-pack" || !m.tree?.id || !m.folder) throw new UsageError("this is not a research packed by strom");
    if (m.format > 1) throw new UsageError("this package is of a newer strom", { hint: "strom update" });
    return m;
  };
  if (fs.statSync(src).isDirectory()) {
    // the folder itself, or the one folder a system's unpacking put around it
    const candidates = [src, ...fs.readdirSync(src, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => path.join(src, e.name))];
    const dir = candidates.find((d) => fs.existsSync(path.join(d, PACK_MANIFEST)));
    if (!dir) throw new UsageError(`no ${PACK_MANIFEST} in ${src}: not a research packed by strom`, { hint: "the ZIP file that came", code: "pack.no-manifest", params: { manifest: PACK_MANIFEST, path: src } });
    return { manifest: read(fs.readFileSync(path.join(dir, PACK_MANIFEST), "utf8")), dir };
  }
  const entries = readZip(src);
  const m = entries.find((e) => e.name === PACK_MANIFEST || e.name.endsWith(`/${PACK_MANIFEST}`));
  if (!m) throw new UsageError("this ZIP file holds no research packed by strom", { hint: "the sender makes one with strom pack" });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strom-unpack-"));
  try {
    unzipTo(src, dir, entries);
    const root = path.join(dir, ...m.name.split("/").slice(0, -1));
    return { manifest: read(fs.readFileSync(path.join(root, PACK_MANIFEST), "utf8")), zip: src, dir: root, tmp: dir };
  } catch (e) {
    fs.rmSync(dir, { recursive: true, force: true });
    throw e;
  }
}

export interface Unpacked {
  root: string;
  name: string;
  images: number;
  imagesHad: number;
  connectors: string[];
  connectorsKept: string[];
  adopted: boolean;
  /** The events of history taken into this computer's catalogs (those it had stay as they are). */
  historyEvents: number;
  /** The batches of the Strom app put back beside the tree. */
  batches: number;
}

/**
 * Put a package in place: the tree into the trees folder (a free name), its images into the shared store (each
 * checked against its name, the SHA-256 of its content), its connectors into the plugins where there is none of
 * that name; then check the tree whole and take it over on this computer. Nothing is left half done.
 */
/** The tree's folder among the trees: its name, or with (2), (3)… when that is taken. */
export function freeRoot(treesDir: string, name: string): string {
  const base = safeFolderName(name) || "tree";
  let root = path.join(treesDir, base);
  for (let n = 2; fs.existsSync(root); n++) root = path.join(treesDir, `${base} (${n})`);
  return root;
}

export function unpack(pack: { manifest: PackManifest; dir: string }, treesDir: string, shared: string, env: Env): Unpacked {
  const src = pack.dir;
  const m = pack.manifest;
  // a system that unpacked the names in another code page: the one folder with a tree in it
  let from = path.join(src, m.folder);
  if (!fs.existsSync(path.join(from, "strom.json"))) {
    const trees = fs.readdirSync(src, { withFileTypes: true }).filter((e) => e.isDirectory() && fs.existsSync(path.join(src, e.name, "strom.json")));
    if (trees.length !== 1) throw new UsageError(`the package has no tree ${m.folder}`);
    from = path.join(src, trees[0]!.name);
  }
  const root = freeRoot(treesDir, m.tree.name);
  fs.mkdirSync(treesDir, { recursive: true });
  const media: { from: string; to: string }[] = [];
  for (const f of m.media) {
    const file = path.join(src, "shared", ...f.split("/"));
    if (!fs.existsSync(file)) throw new StromError(`the package is missing ${f}`);
    const sha = path.basename(f).replace(/\.[^.]+$/, "");
    if (/^[0-9a-f]{64}$/.test(sha) && crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex") !== sha)
      throw new StromError(`${f} in the package is not the image its name says — damaged on the way?`, { hint: "ask for the package again" });
    media.push({ from: file, to: path.join(shared, ...f.split("/")) });
  }
  fs.cpSync(from, root, { recursive: true, errorOnExist: true });
  try {
    const batches = keepBatchesOnly(root, m.batches ?? []);
    const tree = Tree.open(root, env);
    const bad = verifyFull(tree).findings.filter((f) => f.level === "error");
    if (bad.length) throw new StromError(`the tree in the package does not check out: ${bad[0]!.message}${bad.length > 1 ? ` (+${bad.length - 1})` : ""}`, { hint: "ask for the package again" });
    let adopted = false;
    if (!tree.key) {
      tree.withTreeLock(() => {
        createKey(env, tree.config.id);
        tree.reloadKey();
        tree.appendOp({ op: "seal.adopt", targets: [], files: [], summary: "Tree adopted on this computer (unpacked)" });
        tree.commit("Seal: tree adopted on this computer");
      });
      adopted = true;
    }
    let imagesHad = 0;
    for (const x of media) {
      if (fs.existsSync(x.to)) {
        imagesHad++;
        continue;
      }
      fs.mkdirSync(path.dirname(x.to), { recursive: true });
      fs.copyFileSync(x.from, x.to);
    }
    const connectors: string[] = [];
    const kept: string[] = [];
    for (const c of m.connectors) {
      const to = path.join(connectorsDir(shared), c);
      if (fs.existsSync(to)) {
        kept.push(c);
        continue;
      }
      fs.cpSync(path.join(src, "shared", "plugins", "connectors", c), to, { recursive: true });
      connectors.push(c);
    }
    let historyEvents = 0;
    for (const id of m.history ?? []) {
      if (!regionIdOk(id)) continue;
      const file = path.join(src, "shared", "history", "regions", `${id}.json`);
      let given: Catalog | undefined;
      try {
        given = JSON.parse(fs.readFileSync(file, "utf8")) as Catalog;
      } catch {
        continue; // a catalog missing or damaged: the research is whole without it (its events are found again)
      }
      if (given?.region?.id !== id) continue;
      historyEvents += mergeCatalog(shared, given).added;
    }
    for (const key of m.places ?? []) {
      if (!placeKeyOk(key)) continue;
      let given: PlaceCatalog | undefined;
      try {
        given = JSON.parse(fs.readFileSync(path.join(src, "shared", "history", "places", `${key}.json`), "utf8")) as PlaceCatalog;
      } catch {
        continue; // as a region's: the research is whole without it
      }
      if (given?.place?.key !== key) continue;
      historyEvents += mergePlaceCatalog(shared, given).added;
    }
    return { root, name: tree.config.name, images: media.length - imagesHad, imagesHad, connectors, connectorsKept: kept, adopted, historyEvents, batches };
  } catch (e) {
    fs.rmSync(root, { recursive: true, force: true });
    throw e;
  }
}

/**
 * Of strom's working folder a package brings only the batches its manifest names, each a batch of this name (a file
 * damaged on the way or anything else there is not kept: this computer makes its own). How many are kept.
 */
function keepBatchesOnly(root: string, named: string[]): number {
  const work = path.join(root, ".strom");
  if (!fs.existsSync(work)) return 0;
  const want = new Set(named.filter((id) => BATCH_ID.test(id)));
  const kept: { id: string; text: string }[] = [];
  for (const id of want) {
    try {
      const text = fs.readFileSync(path.join(work, "batches", `${id}.json`), "utf8");
      const b = JSON.parse(text) as { id?: unknown; inputs?: unknown };
      if (b.id === id && Array.isArray(b.inputs)) kept.push({ id, text });
    } catch {
      // not in the package, or damaged: its inputs keep their batch's mark, the rest is gone
    }
  }
  fs.rmSync(work, { recursive: true, force: true });
  if (!kept.length) return 0;
  fs.mkdirSync(path.join(work, "batches"), { recursive: true });
  for (const b of kept) fs.writeFileSync(path.join(work, "batches", `${b.id}.json`), b.text);
  return kept.length;
}

/**
 * The files of the shared store a tree names (its images, the family's material kept there), by its folder alone, each
 * with its size and whether it is the family's photo or original (not an archive scan; a file both is the family's).
 */
export function sharedFilesOf(root: string): Map<string, { size: number; family: boolean }> {
  const out = new Map<string, { size: number; family: boolean }>();
  const put = (file: string, size: number, family: boolean) => out.set(file, { size, family: family || !!out.get(file)?.family });
  const read = (dir: string, f: (r: { file?: string; size?: number; recordset?: string; fetched?: unknown }) => void) => {
    let names: string[] = [];
    try {
      names = fs.readdirSync(path.join(root, "data", dir)).filter((n) => n.endsWith(".json"));
    } catch {
      return;
    }
    for (const n of names)
      try {
        f(JSON.parse(fs.readFileSync(path.join(root, "data", dir, n), "utf8")) as { file?: string; size?: number; recordset?: string; fetched?: unknown });
      } catch {
        // an unreadable record names nothing
      }
  };
  read("images", (m) => m.file && put(m.file, m.size ?? 0, !isScan(m)));
  read("inputs", (i) => {
    if (i.file?.startsWith("media:")) put(i.file.slice(6), i.size ?? 0, true);
    const w = (i as { working?: { sha?: unknown; mime?: unknown; bytes?: unknown } }).working;
    if (w && typeof w.sha === "string" && /^[0-9a-f]{64}$/u.test(w.sha) && typeof w.mime === "string") put(workingRel(undefined, { sha: w.sha, mime: w.mime }), typeof w.bytes === "number" ? w.bytes : 0, true);
  });
  return out;
}

/** The files of the shared store only this tree names — none of the other trees (their folders) does. */
export function onlyItsFiles(root: string, others: string[], shared: string): { file: string; size: number; family: boolean }[] {
  const theirs = new Set<string>();
  for (const o of others) for (const f of sharedFilesOf(o).keys()) theirs.add(f);
  return [...sharedFilesOf(root)].filter(([f]) => !theirs.has(f) && fs.existsSync(path.join(shared, f))).map(([file, x]) => ({ file, size: x.size, family: x.family }));
}
