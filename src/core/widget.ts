// The research on the desktop of a Mac (the Strom Widget, a program of its own, strom-mac): each tree's overview written
// into a file the widget reads — who works on what now, the finds of the last 24 hours, what waits for the person in
// the Strom app, the last 24 hours — worked out by the same functions as the phone's page (phone-watch.ts,
// phone-finds.ts) and cleaned as for it (forPhone): never a path, a record's ID, a spend or a model. Beside each text
// that names a person, the same without the names (the widget's "hide names").
//
// Written by the tree's bridge (strom live) while it runs, on macOS alone: ~/Library/Application Support/Strom/widget/
// <tree id>.json and index.json (the trees there), each whole (a file beside it renamed over it). Looked at every
// WIDGET_CHECK_MS, written when what it says changed, else every WIDGET_HEARTBEAT_MS; the bridge ending as it should
// writes `running: false`, its research gone takes the file away. An archive has none. The widget only reads: nothing
// of it comes back. An isolated installation (STROM_ISOLATED: a test's, a second strom) writes into its own settings
// folder — a research of a test never shows in the person's widget.

import fs from "node:fs";
import path from "node:path";
import { configDir, isolated, userHome, type Env } from "./paths.ts";
import { Settings } from "./config.ts";
import { Tree } from "./tree.ts";
import { actsAsArchive } from "./state.ts";
import { foldText } from "./text.ts";
import { writeFileAtomic } from "./json.ts";
import { appUrlSetting } from "./stromapp.ts";
import { forPhone, treeOverview, type NowLine } from "./phone-watch.ts";
import { treeFinds, type FindGroup, type FindLine } from "./phone-finds.ts";
import { waitingFor, inApp, type Waiting } from "./waiting.ts";
import { scopes } from "./directions.ts";
import { agentsHere } from "./apps.ts";
import { humanTask } from "../cli/human.ts";
import { ui } from "../cli/ui.ts";
import type { Person } from "./model.ts";

/** The version of the files' shape the widget reads (a newer one: the widget asks for its own update). */
export const WIDGET_SCHEMA = 1;
/** How often the bridge looks whether what the widget shows changed; written at least this often all the same. */
export const WIDGET_CHECK_MS = 15_000;
export const WIDGET_HEARTBEAT_MS = 60_000;
/** At most so many finds (the newest), so many of what waits with its text. */
export const WIDGET_FINDS = 50;
export const WIDGET_PENDING = 3;
/** What stands for a name taken out of a text. */
const HIDDEN = "…";

export interface WidgetLine {
  /** up: ancestors, down: descendants, other: a person or a question (the widget's ↑ ↓ ⌕). */
  dir: "up" | "down" | "other";
  title: string;
  titleNoNames: string;
  task?: string;
  taskNoNames?: string;
  since: string;
  pausedUntil: string | null;
  openUrl: string;
}

export interface WidgetFind {
  kind: "person_new" | "name" | "fact" | "family_new" | "child" | "source_new" | "resolved";
  fact?: "birth" | "baptism" | "marriage" | "death" | "burial" | "other";
  /** A fact of another kind: its name ("Povolání"); null for the kinds the widget names. */
  label?: string | null;
  resolved?: "conflict" | "hypothesis_confirmed" | "hypothesis_rejected";
  text: string;
  textNoNames?: string;
  at: string;
  openUrl: string;
}

export interface WidgetTree {
  schemaVersion: number;
  treeKey: string;
  treeName: string;
  lang: string;
  generatedAt: string;
  running: boolean;
  lastActiveAt: string;
  openUrl: string;
  now: { lines: WidgetLine[]; lastWorkedAt?: string };
  findings: { windowStart: string; items: WidgetFind[] };
  pending: { count: number; items: { text: string; textNoNames?: string }[]; openUrl: string };
  stats24h?: { persons: number; sources: number; saves: number };
}

export interface WidgetIndex {
  schemaVersion: number;
  generatedAt: string;
  trees: { treeKey: string; treeName: string; lang: string; running: boolean; lastActiveAt: string; generatedAt: string }[];
}

/**
 * Where the widget's files are written: none but on macOS; STROM_WIDGET_DIR when set; an isolated installation into its
 * own settings folder; else ~/Library/Application Support/Strom/widget of the HOME strom runs with.
 */
export function widgetDir(env: Env, platform: NodeJS.Platform = process.platform): string | undefined {
  if (platform !== "darwin") return undefined;
  const said = env.STROM_WIDGET_DIR?.trim();
  if (said) return path.resolve(said);
  if (isolated(env)) return path.join(configDir(env, platform), "widget");
  return path.join(userHome(env), "Library", "Application Support", "Strom", "widget");
}

/** A moment as the widget reads it: ISO 8601 to the second, in UTC (Swift's .iso8601 reads no fractions). */
export function isoSecond(at: string | number): string {
  const t = typeof at === "number" ? at : Date.parse(at);
  return Number.isFinite(t) ? new Date(t).toISOString().replace(/\.\d{3}Z$/u, "Z") : "";
}

// The app's slug of a tree's name (strom-beta src/filenames.ts asciiSlug): ?tree=<slug> opens the tree of that name.
const STANDALONE: Record<string, string> = { ß: "ss", æ: "ae", œ: "oe", ø: "o", đ: "d", ð: "d", þ: "th", ł: "l", ħ: "h", ı: "i", ŧ: "t", ŋ: "n", ĸ: "k" };
export function appSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[ßæœøđðþłħıŧŋĸ]/gu, (c) => STANDALONE[c] ?? c)
    .normalize("NFD")
    .replace(/[̀-ͯ]/gu, "")
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "");
}

/** The tree in the Strom app strom uses (the setting strom.app.url, the channel's copy): ?tree=<slug of its name>. */
function treeUrl(env: Env, name: string): string {
  const url = new URL(appUrlSetting(new Settings(env, {})).url);
  const slug = appSlug(name);
  if (slug) url.searchParams.set("tree", slug);
  return url.href;
}

// ── names out of a text ─────────────────────────────────────────────────────────────────────────────────────────────

/** The stems of every name of the tree's people, folded: a word is a name when it is one of them and a few letters more. */
const stemsKept = new Map<string, { at: string; stems: Set<string> }>();
const MIN_STEM = 3;
const MAX_ENDING = 4;

function stemOf(folded: string): string {
  return folded.length > MIN_STEM ? folded.slice(0, Math.max(MIN_STEM, folded.length - 1)) : folded;
}

function nameStems(tree: Tree, key: string): Set<string> {
  const was = stemsKept.get(tree.root);
  if (was && was.at === key) return was.stems;
  const names: string[] = [];
  for (const p of tree.list<Person>("person")) if (!p.retracted) for (const n of p.names) names.push(n.given, n.surname);
  const stems = stemsOfNames(names);
  stemsKept.set(tree.root, { at: key, stems });
  return stems;
}

/** A name that drops its e before the last consonant in the other cases (Karel → Karla, Cvrlek → Cvrlka, Němec → Němcová). */
const MOVABLE_E = /^(.*[bcdfghjklmnpqrstvwxz])e([kclnr])$/u;
/** A stem ending in two consonants, as such a name has it without its e (Cvrlková → Cvrlk-, Němcová → Němc-). */
const WITHOUT_E = /^(.*[bcdfghjklmnpqrstvwxz])([kclnr])$/u;

/** The stems of names (folded): what a word of a text starts with when it is one of the names in any of its forms. */
export function stemsOfNames(names: string[]): Set<string> {
  const stems = new Set<string>();
  for (const name of names)
    for (const part of name.split(/[^\p{L}\p{M}]+/u)) {
      const f = foldText(part);
      if ([...f].length < 2) continue;
      const e = MOVABLE_E.exec(f);
      if (e && e[1]!.length >= 2) {
        // the name as it stands (Cvrlek) and without its e (Cvrlka, Cvrlkovi, Cvrlková) — not "Něme…", which "neměl" is too
        stems.add(f);
        stems.add(e[1]! + e[2]!);
        stems.add(stemOf(`${e[1]}${e[2]}ova`));
        continue;
      }
      stems.add(stemOf(f));
      // a woman's surname said of the man or the family ("Lhotáková" → "Lhoták", "Lhotákovi"), and a man's said of her
      const base = /^(.{3,})ova$/u.exec(f)?.[1];
      const cut = base ? WITHOUT_E.exec(base) : null;
      if (cut && base!.length >= 4) {
        // "Cvrlková" said of the man: Cvrlk- (Cvrlka) and Cvrlek
        stems.add(base!);
        stems.add(`${cut[1]}e${cut[2]}`);
      } else if (base) stems.add(stemOf(base));
      else if (f.length >= 4) stems.add(stemOf(`${f}ova`));
    }
  return stems;
}

/** Whether a word is a name of the tree's people: one of their stems and at most MAX_ENDING letters more (Kryštofa, Lhotákovou). */
function isName(word: string, stems: Set<string>): boolean {
  const f = foldText(word);
  const chars = [...f];
  for (let k = Math.max(1, chars.length - MAX_ENDING); k <= chars.length; k++) if (stems.has(chars.slice(0, k).join(""))) return true;
  return false;
}

/**
 * A text with the names of the tree's people taken out: each run of them (with what joins them: "Kryštofa Lhotáka")
 * one "…". Any script; a word that only looks like a name goes too (better one word too many than a name shown).
 * "" when nothing but names is left.
 */
export function withoutNames(text: string, stems: Set<string>): string {
  const parts = text.split(/([\p{L}\p{M}]+)/u);
  const out: string[] = [];
  let hidden = false;
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i]!;
    const word = i % 2 === 1;
    if (word && isName(p, stems)) {
      if (!hidden) out.push(HIDDEN);
      hidden = true;
      continue;
    }
    // what stands between two names of one run (a space, a hyphen) goes with them
    if (!word && hidden && /^[\s-]*$/u.test(p) && i + 1 < parts.length && isName(parts[i + 1]!, stems)) continue;
    hidden = false;
    out.push(p);
  }
  const s = out.join("").replace(/\s+/gu, " ").trim();
  return /[\p{L}\p{N}]/u.test(s.replaceAll(HIDDEN, "")) ? s : "";
}

// ── the overview ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** A fact's name as a heading: its first letter capital ("povolání" → "Povolání"), in the research language's way. */
function heading(name: string, lang: string): string {
  const [first = "", ...rest] = [...name];
  return first.toLocaleUpperCase(lang) + rest.join("");
}

const FACTS: Record<string, WidgetFind["fact"]> = { BIRT: "birth", CHR: "baptism", BAPM: "baptism", MARR: "marriage", DEAT: "death", BURI: "burial" };

/** The finds of the phone as the widget's lines: newest first, each its text and the same without names. */
function findItems(tree: Tree, groups: FindGroup[], stems: Set<string>, openUrl: string): WidgetFind[] {
  const lang = tree.lang;
  const person = ui(lang, "ui.widget.person");
  const anon = (span?: string) => (span ? `${person} (${span})` : person);
  const out: WidgetFind[] = [];
  const at = (l: FindLine) => isoSecond(l.at);
  for (const g of groups)
    for (const l of g.lines) {
      const who = g.kind === "person" ? (g.name ?? g.title ?? "") : (g.title ?? "");
      const whoNoNames = g.kind === "person" ? person : ui(lang, "ui.widget.family");
      const base = { at: at(l), openUrl };
      switch (l.kind) {
        case "person":
          out.push({ kind: "person_new", text: g.title ?? "", textNoNames: anon(g.span), ...base });
          break;
        case "family":
          out.push({ kind: "family_new", text: g.title ?? "", textNoNames: whoNoNames, ...base });
          break;
        case "name":
          out.push({ kind: "name", text: l.text, textNoNames: anon(g.span), ...base });
          break;
        case "child":
          out.push({ kind: "child", text: l.text, textNoNames: anon(l.span), ...base });
          break;
        case "fact":
        case "fixed":
        case "cited": {
          const fact = FACTS[l.fact?.kind ?? ""] ?? "other";
          const what = l.fact?.what ?? "";
          out.push({
            kind: "fact",
            fact,
            label: fact === "other" && l.fact?.name ? heading(l.fact.name, lang) : null,
            text: [who, what].filter(Boolean).join(", "),
            textNoNames: [whoNoNames, withoutNames(what, stems)].filter(Boolean).join(", "),
            ...base,
          });
          break;
        }
        case "source": {
          // places, dates and sources stay (the widget's "hide names"); a name in a source's title goes
          const none = withoutNames(l.text, stems);
          out.push({ kind: "source_new", text: l.text, ...(none ? { textNoNames: none } : {}), ...base });
          break;
        }
        case "conflict":
        case "hypothesis": {
          const none = withoutNames(l.text, stems);
          out.push({ kind: "resolved", resolved: l.kind === "conflict" ? "conflict" : "hypothesis_confirmed", text: l.text, ...(none ? { textNoNames: none } : {}), ...base });
          break;
        }
      }
    }
  return out.filter((f) => f.text).sort((a, b) => b.at.localeCompare(a.at)).slice(0, WIDGET_FINDS);
}

/** What waits for the person as the Strom app counts it: its /status `waiting`, only what is to do (not sent, waiting for a reply). */
function pendingOf(tree: Tree, env: Env): Waiting[] {
  const settings = new Settings(env, {});
  return waitingFor(tree, {
    shared: settings.shared()?.value,
    claude: () => settings.agent(tree.config).value === "claude" && agentsHere(env).some((a) => a.id === "claude" && a.cli),
    stories: true,
    scopes: scopes(tree),
  }).filter((w) => inApp(w) && w.item.phase === "todo");
}

/**
 * A line of "Now" without names: its direction and the years of whom it is about ("Předci osoby (1784)"); a question,
 * by its words without the names; the agent itself (no research), as it is said (no name in it).
 */
function lineNoNames(lang: string, l: NowLine, stems: Set<string>): string {
  const of = l.span ? ` (${l.span})` : "";
  if (l.direction === "ancestors") return ui(lang, "ui.widget.up", { span: of });
  if (l.direction === "descendants") return ui(lang, "ui.widget.down", { span: of });
  if (l.direction === "person") return ui(lang, "ui.widget.one", { span: of });
  return withoutNames(l.name, stems) || ui(lang, "ui.widget.question");
}

/**
 * The overview of a tree as the widget reads it (`running`: its bridge runs); undefined for an archive (nobody works
 * on it: nothing to show of an agent) and a research that cannot be read.
 */
export function widgetTree(root: string, env: Env, opts: { running: boolean; now?: number }): WidgetTree | undefined {
  const now = opts.now ?? Date.now();
  const tree = Tree.open(root, env);
  if (actsAsArchive(tree)) return undefined;
  const lang = tree.lang;
  const openUrl = treeUrl(env, tree.config.name);
  const o = treeOverview(root, env);
  const stems = nameStems(tree, o.latest ?? "");
  const lines = o.now.map((l): WidgetLine => {
    const task = l.task;
    const taskNoNames = task ? withoutNames(task, stems) : "";
    return {
      dir: l.way,
      title: l.name,
      titleNoNames: lineNoNames(lang, l, stems),
      ...(task ? { task } : {}),
      ...(taskNoNames ? { taskNoNames } : {}),
      since: isoSecond(l.since),
      pausedUntil: l.paused ? isoSecond(l.paused.until) : null,
      openUrl,
    };
  });
  const windowStart = now - 24 * 3_600_000;
  const finds = treeFinds(root, env, new Date(windowStart).toISOString(), now);
  const waits = pendingOf(tree, env);
  const pendingItems = waits.slice(0, WIDGET_PENDING).map(({ item }) => {
    const text = forPhone(humanTask(tree, item.what, lang)) || ui(lang, "ui.phone.waiting.item");
    const none = withoutNames(text, stems);
    return { text, ...(none ? { textNoNames: none } : {}) };
  });
  const at = isoSecond(now);
  return {
    schemaVersion: WIDGET_SCHEMA,
    treeKey: tree.config.id,
    treeName: tree.config.name,
    lang,
    generatedAt: at,
    running: opts.running,
    lastActiveAt: at,
    openUrl,
    now: { lines, ...(o.lastWorked ? { lastWorkedAt: isoSecond(o.lastWorked) } : {}) },
    findings: { windowStart: isoSecond(finds.since), items: findItems(tree, finds.groups, stems, openUrl) },
    pending: { count: waits.length, items: pendingItems, openUrl },
    ...(o.day ? { stats24h: o.day } : {}),
  };
}

// ── the files ────────────────────────────────────────────────────────────────────────────────────────────────────────

const treeFile = (dir: string, key: string) => path.join(dir, `${key}.json`);
/** A tree's key as a file's name: the tree's ID (a UUID) — never a path. */
const KEY = /^[0-9A-Za-z-]{1,64}$/u;

/** index.json as the files of the trees there say it, written whole when it says something else. */
export function writeWidgetIndex(dir: string, now = Date.now()): void {
  const trees: WidgetIndex["trees"] = [];
  let names: string[] = [];
  try {
    names = fs.readdirSync(dir).filter((n) => n.endsWith(".json") && n !== "index.json" && !n.startsWith("."));
  } catch {
    return;
  }
  for (const n of names.sort()) {
    try {
      const t = JSON.parse(fs.readFileSync(path.join(dir, n), "utf8")) as Partial<WidgetTree>;
      if (typeof t.treeKey !== "string" || `${t.treeKey}.json` !== n) continue;
      trees.push({ treeKey: t.treeKey, treeName: String(t.treeName ?? ""), lang: String(t.lang ?? ""), running: t.running === true, lastActiveAt: String(t.lastActiveAt ?? ""), generatedAt: String(t.generatedAt ?? "") });
    } catch {
      // being written by another bridge this moment: said the next time
    }
  }
  const file = path.join(dir, "index.json");
  try {
    const was = JSON.parse(fs.readFileSync(file, "utf8")) as WidgetIndex;
    if (JSON.stringify(was.trees) === JSON.stringify(trees) && was.schemaVersion === WIDGET_SCHEMA) return;
  } catch {
    // none yet
  }
  writeFileAtomic(file, `${JSON.stringify({ schemaVersion: WIDGET_SCHEMA, generatedAt: isoSecond(now), trees } satisfies WidgetIndex, null, 2)}\n`);
}

/** A tree's file written whole (a file beside it renamed over it), then index.json. */
export function writeWidgetTree(dir: string, data: WidgetTree): void {
  if (!KEY.test(data.treeKey)) return;
  writeFileAtomic(treeFile(dir, data.treeKey), `${JSON.stringify(data, null, 2)}\n`);
  writeWidgetIndex(dir, Date.parse(data.generatedAt) || Date.now());
}

/** A tree's file taken away (its research gone, an archive now), and index.json without it. */
export function dropWidgetTree(dir: string, key: string): void {
  if (!KEY.test(key)) return;
  try {
    fs.rmSync(treeFile(dir, key), { force: true });
  } catch {
    return;
  }
  writeWidgetIndex(dir);
}

export interface WidgetWriter {
  /** Looked at (every WIDGET_CHECK_MS; `force`: now), written when it says something new or WIDGET_HEARTBEAT_MS went by. */
  tick(force?: boolean): void;
  /** The bridge ends: `running: false` (as it was last); its research gone: the file away. */
  end(gone: boolean): void;
}

/** The writer of a tree's bridge; none off macOS. */
export function widgetWriter(root: string, env: Env, platform: NodeJS.Platform = process.platform, clock: () => number = Date.now): WidgetWriter | undefined {
  const dir = widgetDir(env, platform);
  if (!dir) return undefined;
  const checkMs = Number(env.STROM_WIDGET_CHECK_MS ?? WIDGET_CHECK_MS);
  const beatMs = Number(env.STROM_WIDGET_HEARTBEAT_MS ?? WIDGET_HEARTBEAT_MS);
  let checked = -Infinity;
  let written = -Infinity;
  let said = "";
  let last: WidgetTree | undefined;
  let key: string | undefined;
  // what moves with the clock alone says nothing new
  const content = (t: WidgetTree) => JSON.stringify({ ...t, generatedAt: "", lastActiveAt: "", findings: { ...t.findings, windowStart: "" } });
  return {
    tick(force = false) {
      const now = clock();
      if (!force && now - checked < checkMs) return;
      checked = now;
      const t = widgetTree(root, env, { running: true, now });
      if (!t) {
        // an archive now: nothing of it on the desktop
        if (key) dropWidgetTree(dir, key);
        key = undefined;
        last = undefined;
        said = "";
        return;
      }
      key = t.treeKey;
      last = t;
      const c = content(t);
      if (c === said && now - written < beatMs) return;
      writeWidgetTree(dir, t);
      said = c;
      written = now;
    },
    end(gone) {
      if (!key) return;
      // what the file says now is no longer what was written: the next look writes it again
      said = "";
      if (gone) return dropWidgetTree(dir, key);
      if (!last) return;
      const at = isoSecond(clock());
      writeWidgetTree(dir, { ...last, running: false, generatedAt: at, lastActiveAt: at });
    },
  };
}
