// What the research found, for a paired phone's page (strom phone): its Finds since the person last looked. A find is
// what an agent of the research wrote of the family — never the person's own edits (the Strom app, the terminal) and
// never the research's upkeep:
//
//   a new person (person.add, person.import) · a name of a person found (person.name) · a new family, a child found in
//   one (family.add, family.import, family.child) · a fact found, corrected or newly cited (event.add, event.edit,
//   event.cite — not a citation taken off or put back by an undo) · a new source (source.add) · a conflict resolved
//   (conflict.resolve) · a hypothesis decided (hypothesis.decide — not abandoned)
//
// Tasks, sessions, images, readings, notes, places, settings, stories and what waits are none. Read from the logs of
// each day (data/ops/<yyyy-mm>/<dd>/…, never written again once committed), never from git: an agent at work makes a
// thousand commits a day. Each log is read once and only its finds kept; the answer is kept for the head and the
// window asked, so the page asking again and again reads nothing new. Records gone since (taken back, merged into
// another) say nothing; each text by the records as they are now, cleaned for the phone (forPhone).

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { Env } from "./paths.ts";
import { Tree, type Op } from "./tree.ts";
import { actsAsArchive } from "./state.ts";
import { runGit } from "./git.ts";
import { factSaid } from "./changelog.ts";
import { conflictTitle, displayName, lifespan } from "./people.ts";
import { ownerName } from "./overview.ts";
import { forPhone } from "./phone-watch.ts";
import type { Conflict, Family, Hypothesis, Person, Source } from "./model.ts";

/** The window when the page asks for none: the last 24 hours. */
export const FINDS_HOURS = 24;
/** How far back the page may ask, and how far back a find before the window is looked for. */
export const FINDS_BACK_DAYS = 31;
/** At most so many groups in one answer (the newest); the rest counted. */
export const FINDS_GROUPS = 100;

/** What one line of a find says: the page names it in its language, `text` the record's own words. */
export type FindKind = "person" | "name" | "family" | "child" | "fact" | "fixed" | "cited" | "source" | "conflict" | "hypothesis";

export interface FindLine {
  kind: FindKind;
  /** A fact, a name, a source's title, a conflict… as the research says it ("" for a new person or family). */
  text: string;
  at: string;
}

export interface FindGroup {
  /** Stable for the page to keep what it drew (a hash, never a record's ID). */
  key: string;
  /** person, family: its name (title); sources, resolved: titled by the page. */
  kind: "person" | "family" | "sources" | "resolved";
  title?: string;
  /** Its newest line's moment. */
  at: string;
  lines: FindLine[];
}

export interface Finds {
  since: string;
  groups: FindGroup[];
  /** Groups past FINDS_GROUPS, not given. */
  cut?: number;
  /** The newest find before the window (up to FINDS_BACK_DAYS back): the page offers the older ones. */
  earlier?: string;
}

const FIND_OPS = new Set(["person.add", "person.import", "person.name", "family.add", "family.import", "family.child", "event.add", "event.edit", "event.cite", "source.add", "conflict.resolve", "hypothesis.decide"]);

/** The finds of one log as they were read, by its size (a log of a commit is never written again). */
const logsRead = new Map<string, { size: number; ops: Op[] }>();
/** The answers kept, by the tree, its head and the window (a few: two phones may ask for two windows). */
const kept = new Map<string, Finds>();
const KEPT = 16;

/** Is it a find: an agent's (or a session's), of a kind that is one, not an undo. */
function isFind(o: Op): boolean {
  if (!FIND_OPS.has(o.op) || o.by === "user") return false;
  if (/^\S+ cites no more /u.test(o.summary) || (o.op === "event.cite" && /^\S+ cites \S+(?:, \S+)* again: /u.test(o.summary))) return false;
  if (o.op === "hypothesis.decide" && / abandoned/u.test(o.summary)) return false;
  return true;
}

function findsOfLog(file: string): Op[] {
  let size: number;
  try {
    size = fs.statSync(file).size;
  } catch {
    return [];
  }
  const held = logsRead.get(file);
  if (held && held.size === size) return held.ops;
  const ops: Op[] = [];
  let text = "";
  try {
    text = fs.readFileSync(file, "utf8");
  } catch {
    return [];
  }
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    try {
      const o = JSON.parse(line) as Op;
      if (o && typeof o.op === "string" && typeof o.at === "string" && Array.isArray(o.targets) && isFind(o)) ops.push(o);
    } catch {
      // a line being written this moment: read whole the next time (the size differs)
    }
  }
  logsRead.set(file, { size, ops });
  return ops;
}

function list(dir: string): string[] {
  try {
    return fs.readdirSync(dir).sort();
  } catch {
    return [];
  }
}

/** The logs of each day from `from` (a day, yyyy-mm-dd) on, oldest first; the older logs of a month or a session aside. */
function logsFrom(dataDir: string, from: string): string[] {
  const dir = path.join(dataDir, "ops");
  const out: string[] = [];
  for (const month of list(dir).filter((n) => /^\d{4}-\d{2}$/u.test(n) && n >= from.slice(0, 7)))
    for (const day of list(path.join(dir, month)).filter((n) => /^\d{2}$/u.test(n) && `${month}-${n}` >= from))
      for (const f of list(path.join(dir, month, day))) if (f.endsWith(".jsonl")) out.push(path.join(dir, month, day, f));
  return out;
}

const hashed = (s: string) => crypto.createHash("sha256").update(s).digest("hex").slice(0, 12);

/**
 * The finds of operations, grouped, newest group first; each line once (a fact found and cited: found). A fact is said
 * in `lang` (the page's: its name and its date as the rest of its line; the research language when none).
 */
export function findGroups(tree: Tree, ops: Op[], lang = tree.lang): FindGroup[] {
  const groups = new Map<string, FindGroup>();
  // a fact said once, by what happened to it first in the window; a person or family new in it: no line for its names
  const facts = new Map<string, FindLine>();
  const fresh = new Set<string>();
  const live = (id: string | undefined): Person | Family | undefined => {
    const r = id ? tree.get<Person | Family>(id) : undefined;
    if (!r || (r.type !== "person" && r.type !== "family")) return undefined;
    return r.retracted || (r as Person).mergedInto ? undefined : r;
  };
  const group = (key: string, make: () => Omit<FindGroup, "key" | "at" | "lines"> | undefined): FindGroup | undefined => {
    let g = groups.get(key);
    if (!g) {
      const made = make();
      if (!made) return undefined;
      g = { key: hashed(`${tree.config.id}:${key}`), ...made, at: "", lines: [] };
      groups.set(key, g);
    }
    return g;
  };
  const ofRecord = (r: Person | Family) =>
    group(r.id, () => {
      if (r.type === "person") {
        const span = lifespan(r);
        const title = forPhone(`${displayName(r)}${span ? ` (${span})` : ""}`);
        return title ? { kind: "person", title } : undefined;
      }
      const title = forPhone(ownerName(tree, r.id));
      return title ? { kind: "family", title } : undefined;
    });
  const add = (g: FindGroup | undefined, line: FindLine) => {
    if (!g || g.lines.some((l) => l.kind === line.kind && l.text === line.text)) return;
    g.lines.push(line);
    if (line.at > g.at) g.at = line.at;
  };

  for (const o of [...ops].sort((a, b) => a.at.localeCompare(b.at))) {
    const [first, second] = o.targets;
    const at = o.at;
    switch (o.op) {
      case "person.add":
      case "person.import":
      case "family.add":
      case "family.import": {
        const r = live(first);
        if (!r) break;
        fresh.add(r.id);
        add(ofRecord(r), { kind: r.type === "person" ? "person" : "family", text: "", at });
        break;
      }
      case "person.name": {
        const r = live(first);
        const m = /^\S+ name (.+?)(?: \([\w-]+\))?(?: ← \S+)?$/u.exec(o.summary);
        const name = m ? forPhone(m[1]!.replace(/\//gu, " ").replace(/\s+/gu, " ").trim()) : "";
        if (r && name && !fresh.has(r.id)) add(ofRecord(r), { kind: "name", text: name, at });
        break;
      }
      case "family.child": {
        const r = live(first);
        const child = live(second ?? /\+child (P\d+)/u.exec(o.summary)?.[1]);
        if (!r || !child || child.type !== "person") break;
        const span = lifespan(child);
        const text = forPhone(`${displayName(child)}${span ? ` (${span})` : ""}`);
        if (text) add(ofRecord(r), { kind: "child", text, at });
        break;
      }
      case "event.add":
      case "event.edit":
      case "event.cite": {
        const r = live(first);
        const id = second ?? /^\+?(E\d+) /u.exec(o.summary)?.[1];
        const e = r?.events.find((x) => x.id === id);
        if (!r || !e || e.retracted) break;
        const said = forPhone(factSaid(tree, r.id, e.id, lang) ?? "");
        if (!said) break;
        // a line of its own on the phone: its first letter as a sentence's
        const text = said.charAt(0).toLocaleUpperCase(lang) + said.slice(1);
        const kind: FindKind = o.op === "event.add" ? "fact" : o.op === "event.edit" ? "fixed" : "cited";
        const was = facts.get(`${r.id}:${e.id}`);
        if (was) {
          // said already: as it is now, at its newest moment
          was.text = text;
          was.at = at;
          const g = ofRecord(r);
          if (g && at > g.at) g.at = at;
          break;
        }
        const line = { kind, text, at };
        facts.set(`${r.id}:${e.id}`, line);
        add(ofRecord(r), line);
        break;
      }
      case "source.add": {
        const s = first ? tree.get<Source>(first) : undefined;
        const text = s && s.type === "source" && !s.retracted ? forPhone(s.title) : "";
        if (text) add(group("sources", () => ({ kind: "sources" })), { kind: "source", text, at });
        break;
      }
      case "conflict.resolve": {
        const c = first ? tree.get<Conflict>(first) : undefined;
        const text = c && c.type === "conflict" && c.state === "resolved" ? forPhone(conflictTitle(tree, c)) : "";
        if (text) add(group("resolved", () => ({ kind: "resolved" })), { kind: "conflict", text, at });
        break;
      }
      case "hypothesis.decide": {
        const h = first ? tree.get<Hypothesis>(first) : undefined;
        const text = h && h.type === "hypothesis" && h.state === "decided" ? forPhone(h.question) : "";
        if (text) add(group("resolved", () => ({ kind: "resolved" })), { kind: "hypothesis", text, at });
        break;
      }
    }
  }
  return [...groups.values()].filter((g) => g.lines.length).sort((a, b) => b.at.localeCompare(a.at));
}

function head(root: string): string {
  const r = runGit(root, ["rev-parse", "HEAD"]);
  return r.status === 0 ? r.stdout.trim() : "";
}

/**
 * The finds of a tree since `since` (an ISO moment; none or not one: the last FINDS_HOURS; at most FINDS_BACK_DAYS
 * back), newest first, and the newest find before them; a fact said in `lang`, the page's (a language code; none or not
 * one: the research language). Kept for the head, the window and the language: asked again with none of them changed,
 * nothing is read. An archive: none.
 */
export function treeFinds(root: string, env: Env, since?: string, now = Date.now(), lang?: string): Finds {
  const said = lang && /^[a-z]{2,3}$/u.test(lang) ? lang : undefined;
  const floor = now - FINDS_BACK_DAYS * 86_400_000;
  const asked = since ? Date.parse(since) : NaN;
  const from = new Date(Number.isFinite(asked) ? Math.min(now, Math.max(floor, asked)) : now - FINDS_HOURS * 3_600_000).toISOString();
  const h = head(root);
  // the day moves the floor of what is looked for before the window
  const key = `${root}|${h}|${from}|${new Date(floor).toISOString().slice(0, 10)}|${said ?? ""}`;
  const was = kept.get(key);
  if (was) return was;
  const tree = Tree.open(root, env);
  let value: Finds = { since: from, groups: [] };
  if (!actsAsArchive(tree)) {
    const dataDir = path.join(root, "data");
    const ops = logsFrom(dataDir, new Date(floor).toISOString().slice(0, 10)).flatMap(findsOfLog);
    const inWindow = ops.filter((o) => o.at >= from);
    const groups = findGroups(tree, inWindow, said ?? tree.lang);
    // the newest find before the window that still says something (a record gone since says nothing)
    let earlier: string | undefined;
    const before = ops.filter((o) => o.at < from && o.at >= new Date(floor).toISOString()).sort((a, b) => b.at.localeCompare(a.at));
    for (let i = 0; i < before.length && !earlier; i += 50) earlier = findGroups(tree, before.slice(i, i + 50))[0]?.at;
    value = { since: from, groups: groups.slice(0, FINDS_GROUPS), ...(groups.length > FINDS_GROUPS ? { cut: groups.length - FINDS_GROUPS } : {}), ...(earlier ? { earlier } : {}) };
  }
  kept.set(key, value);
  for (const old of kept.keys()) {
    if (kept.size <= KEPT) break;
    kept.delete(old);
  }
  return value;
}
