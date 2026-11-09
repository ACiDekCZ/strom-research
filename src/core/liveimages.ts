// The images of the tree's file for the Strom app kept by their content (spec 071): the bridge's file with the images
// by reference (GET /tree.ged?images=ref, feature ged.imagesByHash) names each excerpt by the SHA-256 of its JPEG's bytes
// (2 FILE strom-image:<sha256>), and the app loads only those it does not have yet (GET /image/<sha256>, POST /images).
//
// An image is kept here only as a file is made with it (core/liveged.ts buildGed): the bridge never makes an image
// because it is asked for one — an image it does not have is 404, and the app takes the whole file instead. Each file
// is written whole (beside it, then put in its place) under its own hash, and read back only when its bytes still give
// that hash (one that does not is removed and counts as not here): a file changed or cut short is never given as
// another's. What is kept is bounded: the images the files kept on disk name (core/liveged.ts storeGed), and those made
// within the last hour (a file being made, or given a moment ago); everything else goes as a file is kept.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/** The reference to an image in the tree's file for the app (2 FILE strom-image:<sha256>). */
export const IMAGE_REF = "strom-image:";
/** What an image kept here is (every excerpt is a JPEG). */
export const IMAGE_MIME = "image/jpeg";
/** An image's hash as the bridge takes it: SHA-256, 64 lowercase hex. */
export const IMAGE_SHA = /^[0-9a-f]{64}$/u;
/** How long an image no kept file names stays (a file being made, or given a moment ago the app loads its images of). */
export const IMAGE_GRACE_MS = 3600_000;

/** Where the images are kept (.strom/cache/live-images/<the hash's first two>/<hash>.jpg): a cache strom makes again. */
export function imageStoreDir(root: string): string {
  return path.join(root, ".strom", "cache", "live-images");
}

/** The file of an image by its hash. */
export function imageFile(root: string, sha: string): string {
  return path.join(imageStoreDir(root), sha.slice(0, 2), `${sha}.jpg`);
}

/** The SHA-256 of an image's bytes (64 lowercase hex). */
export function imageSha(bytes: Uint8Array): string {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

/**
 * An image kept by its hash (on the thread making the file): written whole when it is not here yet (or here but of
 * another size: cut short), else only its time renewed (it is named again: not removed within the hour). Its hash.
 */
export function putImage(root: string, bytes: Uint8Array): string {
  const sha = imageSha(bytes);
  const file = imageFile(root, sha);
  const size = fs.statSync(file, { throwIfNoEntry: false })?.size;
  if (size === bytes.length) {
    const now = new Date();
    try {
      fs.utimesSync(file, now, now);
    } catch {
      // removed meanwhile: written again below
    }
    if (fs.existsSync(file)) return sha;
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const part = `${file}.${process.pid}.${crypto.randomBytes(4).toString("hex")}.part`;
  fs.writeFileSync(part, bytes);
  fs.renameSync(part, file);
  return sha;
}

/**
 * An image's bytes by its hash, only when they still give it (one that does not is removed: changed or cut short on
 * disk). Undefined: not here.
 */
export async function readImage(root: string, sha: string): Promise<Buffer | undefined> {
  if (!IMAGE_SHA.test(sha)) return undefined;
  const file = imageFile(root, sha);
  let bytes: Buffer;
  try {
    bytes = await fs.promises.readFile(file);
  } catch {
    return undefined;
  }
  if (imageSha(bytes) === sha) return bytes;
  await fs.promises.rm(file, { force: true }).catch(() => undefined);
  return undefined;
}

/**
 * The images no kept file names and not named within `graceMs` removed (and parts left by a thread that ended under
 * them); how many went.
 */
export async function sweepImages(root: string, keep: ReadonlySet<string>, graceMs = IMAGE_GRACE_MS, now = Date.now()): Promise<number> {
  const dir = imageStoreDir(root);
  let gone = 0;
  let subs: string[];
  try {
    subs = await fs.promises.readdir(dir);
  } catch {
    return 0;
  }
  for (const sub of subs) {
    if (!/^[0-9a-f]{2}$/u.test(sub)) continue;
    const at = path.join(dir, sub);
    let files: string[];
    try {
      files = await fs.promises.readdir(at);
    } catch {
      continue;
    }
    let left = files.length;
    for (const f of files) {
      const sha = /^([0-9a-f]{64})\.jpg$/u.exec(f)?.[1];
      if (sha && keep.has(sha)) continue;
      const time = (await fs.promises.stat(path.join(at, f)).catch(() => undefined))?.mtimeMs;
      if (time === undefined || now - time < graceMs) continue;
      await fs.promises.rm(path.join(at, f), { force: true }).catch(() => undefined);
      left--;
      if (sha) gone++;
    }
    if (!left) await fs.promises.rmdir(at).catch(() => undefined);
  }
  return gone;
}
