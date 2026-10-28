// Where the research lies, as strom doctor says it: on a network drive, or in a folder a cloud keeps (OneDrive,
// iCloud, Dropbox…) — and on Windows how many of its files are kept only online. Found on Windows, a research on
// OneDrive (Z:): five minutes before the menu showed — each file strom looks at is a call over the network, and one
// kept only online is downloaded whole when it is opened. Only looked at, never opened: the attributes of a few files
// say it (no file is downloaded for it), and nothing is changed — what to do is the person's.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { Env } from "./paths.ts";

/** Windows' attributes of a file kept only online: opening (or reading) it downloads it first. */
export const ONLINE_ONLY = {
  OFFLINE: 0x1000,
  RECALL_ON_OPEN: 0x40000,
  RECALL_ON_DATA_ACCESS: 0x400000,
} as const;

const ONLINE_MASK = ONLINE_ONLY.OFFLINE | ONLINE_ONLY.RECALL_ON_OPEN | ONLINE_ONLY.RECALL_ON_DATA_ACCESS;

/** How many files are looked at: enough to tell, few enough for a slow drive. */
export const SAMPLE = 120;

/** What Windows says of a folder's drive and of some of its files (or undefined: nothing could be asked). */
export interface DriveFacts {
  /** The drive's kind as .NET names it: Fixed, Network, Removable… */
  driveType?: string;
  /** The folder a drive made by subst stands for. */
  subst?: string;
  /** The attributes of each file looked at (those that could be read). */
  attrs: number[];
}

export type FactsReader = (dir: string, files: string[], env: Env) => DriveFacts | undefined;

export interface CloudPlace {
  /** On a network drive (a mapped letter, \\server\share), or in a folder a cloud keeps. */
  kind: "network" | "cloud";
  /** The cloud's name (OneDrive, iCloud…), or the drive (Z:, \\server\share). */
  what: string;
  /** Of the files looked at (Windows): how many, and how many kept only online. */
  looked: number;
  online: number;
}

/** A folder's part that names the cloud keeping it: OneDrive, OneDrive - Company, ~/Library/CloudStorage/…, iCloud. */
const CLOUDS: { name: string; seg: RegExp }[] = [
  { name: "OneDrive", seg: /^onedrive(?:[\s-].*)?$/iu },
  { name: "iCloud", seg: /^(?:mobile documents|iclouddrive|icloud drive)$/iu },
  { name: "Dropbox", seg: /^dropbox(?:[\s-].*)?$/iu },
  { name: "Google Drive", seg: /^(?:google ?drive|googledrive-.*)$/iu },
];

/** The cloud a path lies in, by the folders it names (the system's own OneDrive folders too), else undefined. */
export function cloudOf(p: string, env: Env = {}): string | undefined {
  const norm = (x: string) => x.replace(/[\\/]+$/u, "").toLowerCase();
  const full = norm(p);
  for (const v of [env.OneDrive, env.OneDriveConsumer, env.OneDriveCommercial])
    if (v && (full === norm(v) || full.startsWith(norm(v) + "\\") || full.startsWith(norm(v) + "/"))) return "OneDrive";
  const segs = p.split(/[\\/]+/u);
  // ~/Library/CloudStorage/<Provider>-<account>: the provider's name
  const cs = segs.findIndex((s) => s.toLowerCase() === "cloudstorage");
  if (cs >= 0 && segs[cs + 1]) {
    const provider = segs[cs + 1]!.split("-")[0]!;
    return CLOUDS.find((c) => c.seg.test(provider))?.name ?? provider;
  }
  for (const s of segs) for (const c of CLOUDS) if (c.seg.test(s)) return c.name;
  return undefined;
}

/** A network path: \\server\share (or //server/share). */
function uncOf(p: string): string | undefined {
  const m = /^(?:\\\\|\/\/)([^\\/]+)[\\/]+([^\\/]+)/u.exec(p);
  return m ? `\\\\${m[1]}\\${m[2]}` : undefined;
}

/**
 * Where a folder lies, when it is a network drive or a cloud's folder (else undefined): by its path, and on Windows by
 * what the system says of its drive and of the files given (their attributes only: nothing opened, nothing downloaded).
 */
export function placeOf(dir: string, files: string[], env: Env, o: { platform?: NodeJS.Platform; read?: FactsReader } = {}): CloudPlace | undefined {
  const platform = o.platform ?? process.platform;
  const facts = platform === "win32" ? (o.read ?? windowsFacts)(dir, files, env) : undefined;
  const looked = facts?.attrs.length ?? 0;
  const online = facts?.attrs.filter((a) => a >= 0 && (a & ONLINE_MASK) !== 0).length ?? 0;
  const cloud = cloudOf(dir, env) ?? (facts?.subst ? cloudOf(facts.subst, env) : undefined);
  if (cloud) return { kind: "cloud", what: cloud, looked, online };
  const unc = platform === "win32" ? uncOf(dir) : undefined;
  if (unc) return { kind: "network", what: unc, looked, online };
  const drive = /^[a-z]:/iu.exec(dir)?.[0]?.toUpperCase();
  if (facts?.driveType?.toLowerCase() === "network") return { kind: "network", what: drive ?? dir, looked, online };
  // files kept only online in a folder no name told: a cloud all the same
  if (online) return { kind: "cloud", what: drive ?? dir, looked, online };
  return undefined;
}

/**
 * Some files of the folders, for their attributes: the first ones found, at most `most`, never more than a few
 * folders deep (on a slow drive each folder is a call over the network).
 */
export function sampleFiles(dirs: string[], most = SAMPLE): string[] {
  const out: string[] = [];
  const walk = (dir: string, depth: number) => {
    if (out.length >= most || depth > 3) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (out.length >= most) return;
      if (e.isFile() && !e.name.startsWith(".")) out.push(path.join(dir, e.name));
    }
    for (const e of entries) if (e.isDirectory() && !e.name.startsWith(".")) walk(path.join(dir, e.name), depth + 1);
  };
  for (const d of dirs) walk(d, 0);
  return out;
}

/** Asked of Windows in one call: the drive's kind, the folder of a drive made by subst, each file's attributes. */
const FACTS_PS = [
  "[Console]::OutputEncoding = [Text.Encoding]::UTF8",
  "$dir = $env:STROM_IN_DIR",
  "try { 'type ' + ([IO.DriveInfo]::new($dir)).DriveType } catch { }",
  "if ($dir -match '^[A-Za-z]:') { $d = $dir.Substring(0, 2); foreach ($l in (subst)) { if ($l.StartsWith($d + '\\: => ', 'OrdinalIgnoreCase')) { 'subst ' + $l.Substring($d.Length + 6) } } }",
  "foreach ($p in ($env:STROM_IN_FILES -split \"`n\")) { if ($p) { try { 'attr ' + [int][IO.File]::GetAttributes($p) } catch { } } }",
].join("\n");

/** What Windows says (PowerShell, paths through the environment: any script, any accent, nothing to quote). */
export function windowsFacts(dir: string, files: string[], env: Env): DriveFacts | undefined {
  const r = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", FACTS_PS], {
    env: { ...(env as NodeJS.ProcessEnv), STROM_IN_DIR: dir, STROM_IN_FILES: files.join("\n") },
    encoding: "utf8",
    timeout: 20_000,
    windowsHide: true,
  });
  if (r.error || r.status !== 0) return undefined;
  return factsOf(r.stdout ?? "");
}

/** The answer of FACTS_PS read. */
export function factsOf(out: string): DriveFacts {
  const facts: DriveFacts = { attrs: [] };
  for (const line of out.split(/\r?\n/u)) {
    const m = /^(type|subst|attr) (.+)$/u.exec(line.trim());
    if (!m) continue;
    if (m[1] === "type") facts.driveType = m[2]!.trim();
    else if (m[1] === "subst") facts.subst = m[2]!.trim();
    else if (/^-?\d+$/u.test(m[2]!)) facts.attrs.push(Number(m[2]));
  }
  return facts;
}
