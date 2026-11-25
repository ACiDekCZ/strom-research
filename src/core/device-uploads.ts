// What a device of the home network has sent of a large file so far (PUT /device/media/<sha256>, devices.mode on):
// <shared>/device-uploads/<device's id>/<sha256>.part — the blocks opened so far, one after another — and <sha256>.json
// {size, blocks, tree, at} beside it, both strom's user's alone (0600). The path is made of the device's id as
// devices.json has it and the hash's hex alone, never of anything else a device says. Never in git: strom's own cache
// beside the shared store (the config folder's where no shared folder is set). Gone once the file reached the research
// (or was refused for good), with its device unpaired, and after UPLOAD_KEEP_MS untouched.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { configDir, type Env } from "./paths.ts";
import { Settings } from "./config.ts";
import { renameRetrying } from "./json.ts";

/** A file sent in part is kept this long after its last block came (then sent again from its beginning). */
export const UPLOAD_KEEP_MS = 24 * 3600_000;

const DEVICE_ID = /^dv_[a-z2-7]{16}$/;
const SHA = /^[0-9a-f]{64}$/;

/** What is kept of a file sent in part. */
export interface UploadNote {
  /** The file's open length (its X-Strom-Size). */
  size: number;
  /** The blocks of it the .part holds (1 MiB each, the last what is left). */
  blocks: number;
  /** The tree it was sent to last. */
  tree: string;
  /** When its last block came. */
  at: string;
}

/** The folder of the files sent in part: <shared>/device-uploads, the config folder's where no shared folder is set. */
export function deviceUploadsRoot(env: Env): string {
  let shared: string | undefined;
  try {
    shared = new Settings(env, {}).shared()?.value;
  } catch {
    shared = undefined;
  }
  return path.join(shared ?? configDir(env), "device-uploads");
}

/** The files of one upload: its folder (the device's), its .part and its .json. Never of an id or a hash of another shape. */
export function uploadFiles(env: Env, deviceId: string, sha: string): { dir: string; part: string; note: string } {
  if (!DEVICE_ID.test(deviceId) || !SHA.test(sha)) throw new Error("not a device's id or a SHA-256");
  const dir = path.join(deviceUploadsRoot(env), deviceId);
  return { dir, part: path.join(dir, `${sha}.part`), note: path.join(dir, `${sha}.json`) };
}

/** What is kept of a device's upload of this file; none: nothing (or not read). */
export function readUpload(env: Env, deviceId: string, sha: string): UploadNote | undefined {
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(uploadFiles(env, deviceId, sha).note, "utf8"));
  } catch {
    return undefined;
  }
  const r = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : undefined;
  if (!r || !Number.isSafeInteger(r.size) || (r.size as number) < 1 || !Number.isSafeInteger(r.blocks) || (r.blocks as number) < 0 || typeof r.tree !== "string" || typeof r.at !== "string" || !Number.isFinite(Date.parse(r.at))) return undefined;
  return { size: r.size as number, blocks: r.blocks as number, tree: r.tree, at: r.at };
}

/** Written whole (a temp file and a rename), the user's alone from its first byte (0600; Windows: their folder). */
export function writeUpload(env: Env, deviceId: string, sha: string, note: UploadNote): void {
  const f = uploadFiles(env, deviceId, sha);
  fs.mkdirSync(f.dir, { recursive: true, mode: 0o700 });
  const tmp = path.join(f.dir, `.${sha}.${process.pid}.${crypto.randomBytes(4).toString("hex")}.tmp`);
  try {
    fs.writeFileSync(tmp, `${JSON.stringify(note)}\n`, { encoding: "utf8", mode: 0o600 });
    try {
      fs.chmodSync(tmp, 0o600);
    } catch {
      // Windows: the user's folder is theirs
    }
    renameRetrying(tmp, f.note);
  } catch (err) {
    fs.rmSync(tmp, { force: true });
    throw err;
  }
}

/** One upload gone (its .part and its .json); its device's folder too once empty. */
export function dropUpload(env: Env, deviceId: string, sha: string): void {
  const f = uploadFiles(env, deviceId, sha);
  fs.rmSync(f.part, { force: true });
  fs.rmSync(f.note, { force: true });
  try {
    fs.rmdirSync(f.dir);
  } catch {
    // another file of the device is there still
  }
}

/** Every upload of a device gone (unpaired). */
export function dropDeviceUploads(env: Env, deviceId: string): void {
  if (!DEVICE_ID.test(deviceId)) return;
  fs.rmSync(path.join(deviceUploadsRoot(env), deviceId), { recursive: true, force: true });
}

/**
 * The uploads left over: of a device not paired any more (`paired`: the ids paired now), older than UPLOAD_KEEP_MS
 * (by their .json, else by their file's time), a .part without its .json or one without its .part — never one being
 * sent now (`busy`: "<device>/<sha>"), never anything not of the shape the gateway writes (left as it is). How many
 * were taken away.
 */
export function sweepUploads(env: Env, opts: { paired: ReadonlySet<string>; busy?: ReadonlySet<string>; now?: number; keepMs?: number }): number {
  const root = deviceUploadsRoot(env);
  const now = opts.now ?? Date.now();
  const keep = opts.keepMs ?? UPLOAD_KEEP_MS;
  let dirs: fs.Dirent[];
  try {
    dirs = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return 0;
  }
  let gone = 0;
  for (const d of dirs) {
    if (!d.isDirectory() || !DEVICE_ID.test(d.name)) continue;
    const busy = [...(opts.busy ?? [])].some((b) => b.startsWith(`${d.name}/`));
    if (!opts.paired.has(d.name) && !busy) {
      fs.rmSync(path.join(root, d.name), { recursive: true, force: true });
      gone++;
      continue;
    }
    let files: string[];
    try {
      files = fs.readdirSync(path.join(root, d.name));
    } catch {
      continue;
    }
    const shas = new Set(files.flatMap((f) => (/^[0-9a-f]{64}\.(part|json)$/.test(f) ? [f.slice(0, 64)] : [])));
    for (const sha of shas) {
      if (opts.busy?.has(`${d.name}/${sha}`)) continue;
      const f = uploadFiles(env, d.name, sha);
      const note = readUpload(env, d.name, sha);
      let at = note ? Date.parse(note.at) : NaN;
      if (!Number.isFinite(at)) {
        try {
          at = fs.statSync(fs.existsSync(f.part) ? f.part : f.note).mtimeMs;
        } catch {
          at = 0;
        }
      }
      if (!note || !fs.existsSync(f.part) || now - at > keep) {
        dropUpload(env, d.name, sha);
        gone++;
      }
    }
  }
  return gone;
}
