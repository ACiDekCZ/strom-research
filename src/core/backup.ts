// A backup before another channel or an older version (Milan's decision, 2026-10-07: "přechod beta ↔ produkce nikdy
// nepřijde o data"). Before a strom of another channel than last time, or an older one than the one that ran last,
// opens any research, every research this computer knows is copied whole — its folder with its history (.git) — and
// so is the folder of the settings (seal keys and logins as they are on disk: the backup stays on this computer, as
// they do), into <home>/backups/<when> <from> to <to>/. The shared folder goes with them (spec 017, Q5: one folder
// backed up holds everything): its plugins and what waits in it copied, its images (media/ — originals of the Strom
// app and the phone, scans: tens of GB) linked where the disk can (a hard link: no room taken twice, and each stays in
// the backup whatever happens to the shared folder — the store never writes a file again, it only adds), else copied;
// with no room for a copy they are left out and the backup says so. Left out only what strom makes again by itself
// (views of scans, excerpts, previews, files converted for reading, work folders of downloads cut short, a lock, the
// shared cache and the pace of hosts) and an upload of the app not yet whole (media/.incoming: taken in or gone).
//
// strom update makes it before it installs (the running strom), the first run of the other version when nothing made
// it for this very change yet (the installers, npm, a strom copied by hand). A backup that cannot be made switches
// nothing: strom update installs nothing; the other version opens no research for writing and migrates none until it
// is made (tried again at each run).

import fs from "node:fs";
import path from "node:path";
import { configDir, type Env } from "./paths.ts";
import { readJsonIfExists } from "./json.ts";
import { acquireLock } from "./lock.ts";

/** One backup made: when, between which versions and channels, where, how large. */
export interface BackupRecord {
  at: string;
  from: string;
  to: string;
  fromChannel?: "beta" | "stable";
  toChannel?: "beta" | "stable";
  path: string;
  /** Bytes the backup took on the disk (linked images not counted: they take no room twice). */
  bytes: number;
  /** The shared images (shared/media): how many, their size, and how they are in the backup. */
  media?: SharedMedia;
}

/** The shared images in a backup: linked (no room taken twice), copied, or left out (no room for a copy: said). */
export interface SharedMedia {
  files: number;
  bytes: number;
  how: "linked" | "copied" | "left";
}

/** The change a backup is made for. */
export interface Transition {
  from: string;
  to: string;
  fromChannel?: "beta" | "stable";
  toChannel?: "beta" | "stable";
}

/** How long the menu and strom doctor say where the last backup is. */
export const BACKUP_SAID_DAYS = 30;
/** So many backups the user config remembers (the folders stay where they are). */
const KEPT = 20;
/** What is left free on the disk after a backup at least (the system needs room too). */
export const BACKUP_RESERVE = 256 * 1024 * 1024;

export function backupsDir(home: string): string {
  return path.join(home, "backups");
}

/** The backups the user config remembers, the newest last (read from the file: whoever asks). */
export function backupsMade(env: Env): BackupRecord[] {
  const cfg = readJsonIfExists<{ backups?: unknown }>(path.join(configDir(env), "config.json"));
  return Array.isArray(cfg?.backups) ? (cfg.backups as BackupRecord[]).filter((b) => b && typeof b.path === "string" && typeof b.at === "string") : [];
}

/** The newest backup made (within `days`, when given). */
export function lastBackup(env: Env, days?: number): BackupRecord | undefined {
  const last = backupsMade(env).at(-1);
  if (!last) return undefined;
  if (days !== undefined && !(Date.now() - Date.parse(last.at) <= days * 24 * 3600_000)) return undefined;
  return last;
}

/**
 * The backup made for this very change, if one was: the newest one only, and of the last day (strom update made it,
 * its first run finds it). An older one of the same change is another trip — there and back again, the research
 * written on in between — and gets its own (found 2026-10-07: the second trip stable → beta → stable made none; and
 * a strom from before the channels, gone back to, leaves the beta's version as the last one, so the next trip finds
 * the newest backup of the same change, made a month before).
 */
export function backupFor(made: BackupRecord[], t: Transition, now = Date.now()): BackupRecord | undefined {
  return made
    .slice(-1)
    .find((b) => b.from === t.from && b.to === t.to && (b.fromChannel ?? "") === (t.fromChannel ?? "") && (b.toChannel ?? "") === (t.toChannel ?? "") && now - Date.parse(b.at) <= SAME_TRIP_MS);
}

/** How long after strom update made a backup its first run still takes it for the same change. */
const SAME_TRIP_MS = 24 * 3600_000;

/** A version as a folder's name takes it (ASCII only). */
function safe(v: string): string {
  return v.replace(/[^0-9A-Za-z.+-]/g, "-");
}

/** The folder's name: when (local time), from which version to which (their channels too when the version stays). */
export function backupName(t: Transition, at = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  const stamp = `${at.getFullYear()}-${p(at.getMonth() + 1)}-${p(at.getDate())}-${p(at.getHours())}${p(at.getMinutes())}${p(at.getSeconds())}`;
  const same = t.from === t.to;
  return `${stamp} ${safe(t.from)}${same && t.fromChannel ? ` ${t.fromChannel}` : ""} to ${safe(t.to)}${same && t.toChannel ? ` ${t.toChannel}` : ""}`;
}

/** What of a research is not copied: what strom makes again by itself (relative to the tree, its parts). */
function rebuildable(parts: string[]): boolean {
  if (parts[0] !== ".strom") return false;
  if (parts.length === 2 && parts[1] === "tree.lock") return true;
  // a download cut short: its work folder (the scans fetched are in the shared store)
  if (parts[1] === "fetch") return true;
  // previews of the family's files (the Strom app's thumbnails) and files converted for reading (PDF, HEIC): made again
  // when asked (found in the test of the material: up to 200 MB and 500 MB of a research in every backup)
  if (parts[1] === "thumbs" || parts[1] === "converted") return true;
  // views of scans and excerpts: made again from the scans whenever needed
  return (parts[1] === "views" || parts[1] === "excerpts") && parts.length > 2 && /\.(jpe?g|png)$/i.test(parts.at(-1)!);
}

/** What of the shared folder is not copied: what strom makes again (its cache, the pace of hosts), a lock — the images apart. */
function sharedSkipped(parts: string[]): boolean {
  if (parts[0] === "cache" || parts[0] === "net" || parts[0] === "media") return true;
  return /\.lock$/.test(parts.at(-1)!);
}

/** A folder as compared: as named and as the disk has it (/tmp and /private/tmp). */
function forms(p: string): string[] {
  const out = [path.resolve(p)];
  try {
    out.push(fs.realpathSync.native(p));
  } catch {
    // not there: as named
  }
  return out;
}

/**
 * The copy's filter: never what strom makes again, never the backups themselves, never a lock of the settings — and
 * for the settings, never a folder of the research that lies in them (an isolated installation keeps its research in
 * its settings folder: the home, the trees, the shared images, the backups would be copied twice, the backups into
 * themselves).
 */
function filterFor(base: string, kind: "tree" | "settings", skip: string[]): (src: string) => boolean {
  const skipped = new Set(skip.flatMap(forms));
  const baseForms = new Set(forms(base));
  return (src) => {
    const here = forms(src);
    if (here.some((f) => skipped.has(f) && !baseForms.has(f))) return false;
    const rel = path.relative(base, src);
    if (!rel) return true;
    const parts = rel.split(path.sep);
    if (kind === "settings") return !/\.lock$/.test(parts.at(-1)!);
    return !rebuildable(parts);
  };
}

/** Bytes of what the copy takes (links as links: never followed). */
function sizeOf(dir: string, keep: (src: string) => boolean): number {
  let total = 0;
  const walk = (p: string) => {
    if (!keep(p)) return;
    let st: fs.Stats;
    try {
      st = fs.lstatSync(p);
    } catch {
      return;
    }
    if (st.isSymbolicLink()) return;
    if (st.isDirectory()) for (const name of fs.readdirSync(p)) walk(path.join(p, name));
    else total += st.size;
  };
  walk(dir);
  return total;
}

/**
 * The shared images (media/), each with its size (links never followed) — never an upload of the app still coming
 * (media/.incoming/*.part: taken into the store when whole, else gone within a day; linked into a backup it would
 * grow on there, or stay half for good, and be counted as an image).
 */
function imagesOf(media: string): { file: string; size: number }[] {
  const out: { file: string; size: number }[] = [];
  const incoming = path.join(media, ".incoming");
  const walk = (p: string) => {
    if (p === incoming) return;
    let st: fs.Stats;
    try {
      st = fs.lstatSync(p);
    } catch {
      return;
    }
    if (st.isSymbolicLink()) return;
    if (st.isDirectory()) for (const name of fs.readdirSync(p)) walk(path.join(p, name));
    else if (st.isFile()) out.push({ file: p, size: st.size });
  };
  walk(media);
  return out;
}

/** Can a file of `from` be linked into `dir` (one disk, a file system with hard links)? Tried with one file, nothing left. */
function linksInto(from: string, dir: string): boolean {
  const probe = path.join(dir, `.link-probe-${process.pid}`);
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.linkSync(from, probe);
    return true;
  } catch {
    return false;
  } finally {
    try {
      fs.rmSync(probe, { force: true });
    } catch {
      // what is left says itself
    }
  }
}

/**
 * How the shared images go into a backup: linked where the disk can (they take no room); else copied — and with no
 * room for the copy (only for it: the rest fits) left out, which the backup says. Never a reason to refuse a backup.
 */
export function mediaHow(o: { linked: boolean; images: number; rest: number; free: number | undefined }): SharedMedia["how"] {
  if (o.linked) return "linked";
  if (o.images && o.free !== undefined && o.free < o.rest + o.images + BACKUP_RESERVE && o.free >= o.rest + BACKUP_RESERVE) return "left";
  return "copied";
}

/** Bytes free on the disk of `dir`; undefined when the system does not say. */
function freeBytes(dir: string): number | undefined {
  try {
    let d = dir;
    while (!fs.existsSync(d) && path.dirname(d) !== d) d = path.dirname(d);
    const s = fs.statfsSync(d);
    return Number(s.bavail) * Number(s.bsize);
  } catch {
    return undefined;
  }
}

/** Why a backup could not be made: no room (how much it needs, how much is free), or what the system said. */
export class BackupFailed extends Error {
  readonly room: { need: number; free: number } | undefined;
  /** What the system said (ENOSPC, EPERM, …), where it said something. */
  readonly code: string | undefined;
  constructor(message: string, room?: { need: number; free: number }, code?: string) {
    super(message);
    this.name = "BackupFailed";
    this.room = room;
    this.code = code;
  }
}

/**
 * Copy every research (whole, with .git), the shared folder and the settings into a new folder of the backups. The
 * trees go into trees/<the folder's own name> (never normalized: a name of any script stays as it is), the shared
 * folder into shared/ (its images linked where the disk can), the settings into settings/, a README.txt beside them
 * (`readme` gets how the shared images are in it). Throws BackupFailed and leaves nothing of itself when it cannot.
 */
export function makeBackup(opts: { home: string; env: Env; trees: string[]; transition: Transition; readme: string | ((media: SharedMedia | undefined) => string); at?: Date; /** Folders of the research besides the home and the trees (the folder of the trees, the shared one): never copied as part of the settings. */ research?: string[]; /** The shared folder: its images and plugins go with the backup. */ shared?: string }): BackupRecord {
  const at = opts.at ?? new Date();
  const top = backupsDir(opts.home);
  const settings = configDir(opts.env);
  const skip = path.resolve(top);
  const sources: { from: string; to: string; keep: (src: string) => boolean }[] = [];
  const taken = new Set<string>();
  for (const root of opts.trees) {
    // two trees of one name (one from another folder): the second gets a number
    let name = path.basename(root);
    for (let n = 2; taken.has(name); n++) name = `${path.basename(root)} ${n}`;
    taken.add(name);
    sources.push({ from: root, to: path.join("trees", name), keep: filterFor(root, "tree", [skip]) });
  }
  if (fs.existsSync(settings)) sources.push({ from: settings, to: "settings", keep: filterFor(settings, "settings", [skip, opts.home, ...opts.trees, ...(opts.research ?? [])]) });
  // the shared folder: what is not its images copied (plugins, what waits for the person), its images apart
  const shared = opts.shared && fs.existsSync(opts.shared) ? opts.shared : undefined;
  if (shared) {
    const inner = filterFor(shared, "tree", [skip, ...opts.trees]);
    sources.push({ from: shared, to: "shared", keep: (src) => {
      const rel = path.relative(shared, src);
      return inner(src) && !(rel && sharedSkipped(rel.split(path.sep)));
    } });
  }
  const images = shared ? imagesOf(path.join(shared, "media")) : [];
  const imageBytes = images.reduce((n, f) => n + f.size, 0);
  const rest = sources.reduce((s, x) => s + sizeOf(x.from, x.keep), 0);
  const free = freeBytes(top);
  const linked = images.length > 0 && linksInto(images[0]!.file, top);
  const how = mediaHow({ linked, images: imageBytes, rest, free });
  const need = rest + (how === "copied" ? imageBytes : 0);
  if (free !== undefined && free < need + BACKUP_RESERVE) throw new BackupFailed(`not enough room on the disk: the backup needs ${mb(need)}, ${mb(free)} is free (${mb(BACKUP_RESERVE)} kept for the system)`, { need, free });
  const media: SharedMedia | undefined = shared ? { files: images.length, bytes: imageBytes, how } : undefined;
  let dir = path.join(top, backupName(opts.transition, at));
  for (let n = 2; fs.existsSync(dir); n++) dir = path.join(top, `${backupName(opts.transition, at)} ${n}`);
  try {
    fs.mkdirSync(dir, { recursive: true });
    for (const s of sources) copyInto(s.from, path.join(dir, s.to), s.keep);
    if (shared && how !== "left")
      for (const f of images) {
        const to = path.join(dir, "shared", "media", path.relative(path.join(shared, "media"), f.file));
        fs.mkdirSync(path.dirname(to), { recursive: true });
        // one that cannot be linked (too many links of it, another disk under the folder): copied
        try {
          if (how !== "linked") throw new Error("copied");
          fs.linkSync(f.file, to);
        } catch {
          fs.copyFileSync(f.file, to, fs.constants.COPYFILE_EXCL);
        }
      }
    const readme = typeof opts.readme === "function" ? opts.readme(media) : opts.readme;
    fs.writeFileSync(path.join(dir, "README.txt"), readme.endsWith("\n") ? readme : `${readme}\n`);
  } catch (e) {
    // nothing half made stays: a backup is whole or none
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      // what is left says itself
    }
    const code = (e as NodeJS.ErrnoException).code;
    throw new BackupFailed(code === "ENOSPC" ? `the disk is full: the backup needs ${mb(need)}` : (e as Error).message, undefined, code);
  }
  return { at: at.toISOString(), from: opts.transition.from, to: opts.transition.to, ...(opts.transition.fromChannel ? { fromChannel: opts.transition.fromChannel } : {}), ...(opts.transition.toChannel ? { toChannel: opts.transition.toChannel } : {}), path: dir, bytes: need, ...(media ? { media } : {}) };
}

/**
 * Copy a folder as the filter keeps it. A folder that holds the copy's own destination (the settings of an isolated
 * installation hold its research, and so its backups) is gone through entry by entry — a copy into itself the system
 * refuses — the rest copied whole.
 */
function copyInto(from: string, to: string, keep: (src: string) => boolean): void {
  if (!keep(from)) return;
  const holds = path.relative(from, to);
  const inside = holds && !holds.startsWith("..") && !path.isAbsolute(holds);
  if (inside && fs.lstatSync(from).isDirectory()) {
    fs.mkdirSync(to, { recursive: true });
    for (const name of fs.readdirSync(from)) copyInto(path.join(from, name), path.join(to, name), keep);
    return;
  }
  fs.cpSync(from, to, { recursive: true, verbatimSymlinks: true, preserveTimestamps: true, errorOnExist: true, force: false, filter: keep });
}

/** Megabytes, for a sentence. */
export function mb(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

/**
 * The backup of this change, made once: under the lock of the settings (two stroms of the new version starting at
 * once make one), nothing made when one for this change is recorded already. `record` keeps it in the user config.
 * Returns the backup made now, or undefined when one was made before.
 */
export function backupOnce(opts: { home: string; env: Env; trees: () => string[]; research?: string[]; shared?: string; transition: Transition; readme: string | ((media: SharedMedia | undefined) => string); record: (b: BackupRecord, before: BackupRecord[]) => void }): BackupRecord | undefined {
  const release = acquireLock(path.join(configDir(opts.env), "backup.lock"), { owner: "strom backup", waitMs: 30 * 60_000, staleMs: 6 * 3600_000 });
  try {
    const before = backupsMade(opts.env);
    if (backupFor(before, opts.transition)) return undefined;
    const made = makeBackup({ home: opts.home, env: opts.env, trees: opts.trees(), transition: opts.transition, readme: opts.readme, ...(opts.research ? { research: opts.research } : {}), ...(opts.shared ? { shared: opts.shared } : {}) });
    opts.record(made, before.slice(-(KEPT - 1)));
    return made;
  } finally {
    release();
  }
}
