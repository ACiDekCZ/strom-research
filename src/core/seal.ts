// Tamper evidence.
//
// - Every operation strom writes records the SHA-256 of each file it wrote,
//   links to the previous operation (hash chain) and is signed with an HMAC
//   key that lives OUTSIDE the tree: <config>/keys/<tree id>.key (agents are
//   not permitted to read it).
// - Every commit strom makes carries a trailer `Strom-Seal: <HMAC of the git
//   tree hash>`, so a commit made outside strom is detected by looking at
//   HEAD alone — cheap enough to run before every command.
//
// Agents bypass tools out of convenience, not malice; this catches every
// convenience bypass, and deliberate forgery needs a secret the agent was
// told not to read.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { configDir, type Env } from "./paths.ts";
import { canonicalize } from "./json.ts";
import { oldKeys, oldSettingsDir } from "./oldsettings.ts";

export interface SealedFile {
  path: string;
  sha: string;
}

export function sha256(content: string | Buffer): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}

export function fileSha(file: string): string | undefined {
  try {
    return sha256(fs.readFileSync(file));
  } catch {
    return undefined;
  }
}

export function keyFile(env: Env, treeId: string): string {
  return path.join(configDir(env), "keys", `${treeId}.key`);
}

function readKey(file: string): Buffer | undefined {
  try {
    const key = Buffer.from(fs.readFileSync(file, "utf8").trim(), "hex");
    return key.length ? key : undefined;
  } catch {
    return undefined;
  }
}

/** The tree's key on this computer: the settings' own, else one of the old settings folders (core/oldsettings.ts). */
export function loadKey(env: Env, treeId: string): Buffer | undefined {
  return readKey(keyFile(env, treeId)) ?? oldKeys(env, treeId)[0]?.key;
}

/**
 * The tree's key, the one in an old settings folder taken over into the settings of today where they have none: of two
 * different ones (strom of a packaged app and of a terminal, each its own) the one `prefer` says (the one that sealed the
 * last commit, the side that could still write), else the first.
 */
export function settleKey(env: Env, treeId: string, prefer: (key: Buffer) => boolean): Buffer | undefined {
  const own = readKey(keyFile(env, treeId));
  if (own) {
    mirrorKey(env, treeId, own);
    return own;
  }
  const old = oldKeys(env, treeId);
  if (!old.length) return undefined;
  const key = (old.length > 1 ? old.find((o) => prefer(o.key)) : undefined)?.key ?? old[0]!.key;
  try {
    const file = keyFile(env, treeId);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, key.toString("hex") + "\n", { mode: 0o600, flag: "wx" });
  } catch {
    // taken over next time
  }
  mirrorKey(env, treeId, key);
  return key;
}

/**
 * The key also where an older strom looks (Windows: %APPDATA%\strom\keys), made if need be — back on an older version,
 * the research is still sealed here. Only added: a key of its own there already stays (found 2026-10-30: a key taken
 * from a packaged app's copy, never in the folder the terminal's older strom reads).
 */
function mirrorKey(env: Env, treeId: string, key: Buffer): void {
  const old = oldSettingsDir(env);
  if (!old) return;
  const file = path.join(old, "keys", `${treeId}.key`);
  if (fs.existsSync(file)) return;
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, key.toString("hex") + "\n", { mode: 0o600, flag: "wx" });
  } catch {
    // a key of its own there already: the older strom keeps it
  }
}

/** The tree's other keys on this computer: those of the old settings folders that are not `key` (strom seal adopt unites them). */
export function otherKeys(env: Env, treeId: string, key: Buffer): { file: string; key: Buffer }[] {
  return oldKeys(env, treeId).filter((o) => !o.key.equals(key));
}

/**
 * Create the key for a tree on this computer (0600). Fails if it exists. Also into the old settings folder (Windows),
 * made if need be: an older strom, after a switch back, reads it there.
 */
export function createKey(env: Env, treeId: string): Buffer {
  const file = keyFile(env, treeId);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const key = crypto.randomBytes(32);
  fs.writeFileSync(file, key.toString("hex") + "\n", { mode: 0o600, flag: "wx" });
  mirrorKey(env, treeId, key);
  return key;
}

/** Short public fingerprint of a key, stored on each operation. */
export function fingerprint(key: Buffer): string {
  return sha256(key).slice(0, 12);
}

function hmac(key: Buffer, text: string): string {
  return crypto.createHmac("sha256", key).update(text).digest("hex").slice(0, 32);
}

/** Signature over the operation without its own `sig` field. */
export function signOp(op: Record<string, unknown>, key: Buffer): string {
  const { sig: _omit, ...rest } = op;
  return hmac(key, JSON.stringify(canonicalize(rest)));
}

function safeEqual(a: string, b: string): boolean {
  return a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export function verifyOp(op: Record<string, unknown>, key: Buffer): boolean {
  return typeof op.sig === "string" && safeEqual(op.sig, signOp(op, key));
}

export const SEAL_TRAILER = "Strom-Seal";

export function commitSeal(key: Buffer, treeHash: string): string {
  return `${SEAL_TRAILER}: ${hmac(key, `tree ${treeHash}`)}`;
}

export function readCommitSeal(message: string): string | undefined {
  return new RegExp(`^${SEAL_TRAILER}: ([0-9a-f]{32})\\s*$`, "m").exec(message)?.[1];
}

export function verifyCommitSeal(key: Buffer, treeHash: string, message: string): boolean {
  const seal = readCommitSeal(message);
  return seal !== undefined && safeEqual(seal, hmac(key, `tree ${treeHash}`));
}
