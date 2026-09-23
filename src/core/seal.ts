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

export function loadKey(env: Env, treeId: string): Buffer | undefined {
  try {
    return Buffer.from(fs.readFileSync(keyFile(env, treeId), "utf8").trim(), "hex");
  } catch {
    return undefined;
  }
}

/** Create the key for a tree on this computer (0600). Fails if it exists. */
export function createKey(env: Env, treeId: string): Buffer {
  const file = keyFile(env, treeId);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const key = crypto.randomBytes(32);
  fs.writeFileSync(file, key.toString("hex") + "\n", { mode: 0o600, flag: "wx" });
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
