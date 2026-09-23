// Logins of the user to archive portals: an account they have, perhaps one they
// paid for. The user types them in on a terminal (strom login <connector>),
// never an agent. They stay on this computer, in the user's config folder (which
// agents may not read) — never in a tree, the shared folder or git. strom puts a
// value into a request of the connector itself, only to the hosts it was saved
// for and only over https: the connector's code never sees it, nor does the
// agent that runs it, and it is taken out of every answer the connector reads.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { configDir, type Env } from "./paths.ts";
import { readJsonIfExists, stringifyCanonical } from "./json.ts";

export interface SavedLogin {
  /** The connector's folder it was saved for. */
  dir: string;
  /** The hosts it may go to: the connector's, when it was saved. */
  hosts: string[];
  values: Record<string, string>;
  at: string;
}

/** Fields typed in the open; every other one (a password, a key, a token) is hidden, and kept out of answers. */
export const VISIBLE_FIELDS = new Set(["user", "email"]);

export function loginsFile(env: Env): string {
  return path.join(configDir(env), "logins.json");
}

export function loadLogins(env: Env): Record<string, SavedLogin> {
  return readJsonIfExists<Record<string, SavedLogin>>(loginsFile(env)) ?? {};
}

/** Written readable by the user alone, and never half. */
function write(env: Env, all: Record<string, SavedLogin>): void {
  const file = loginsFile(env);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = path.join(path.dirname(file), `.logins.${process.pid}.${crypto.randomBytes(4).toString("hex")}.tmp`);
  fs.writeFileSync(tmp, stringifyCanonical(all), { encoding: "utf8", mode: 0o600 });
  try {
    fs.renameSync(tmp, file);
  } catch (err) {
    fs.rmSync(tmp, { force: true });
    throw err;
  }
}

export function saveLogin(env: Env, name: string, login: SavedLogin): void {
  write(env, { ...loadLogins(env), [name]: login });
}

export function removeLogin(env: Env, name: string): boolean {
  const all = loadLogins(env);
  if (!all[name]) return false;
  delete all[name];
  write(env, all);
  return true;
}

/** The login saved for this connector — for its folder, not for another one of the same name. */
export function loginOf(env: Env, c: { name: string; dir: string }): SavedLogin | undefined {
  const l = loadLogins(env)[c.name];
  return l && path.resolve(l.dir) === path.resolve(c.dir) ? l : undefined;
}

/** The forms a value takes in a page, a URL, a form or JSON: each one comes out of an answer. */
function spellings(v: string): string[] {
  const html = v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  const form = new URLSearchParams({ v }).toString().slice(2);
  return [...new Set([v, encodeURIComponent(v), form, html, JSON.stringify(v).slice(1, -1)])].sort((a, b) => b.length - a.length);
}

/** Takes the hidden values of a login out of a text: "[login]" stands in their place. */
export function redactor(login: SavedLogin | undefined): (s: string) => string {
  const secrets = login
    ? Object.entries(login.values)
        .filter(([k, v]) => !VISIBLE_FIELDS.has(k) && v.length >= 4)
        .flatMap(([, v]) => spellings(v))
    : [];
  if (!secrets.length) return (s) => s;
  return (s) => secrets.reduce((t, v) => t.split(v).join("[login]"), s);
}
