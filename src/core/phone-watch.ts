// What a paired phone's page shows of a tree of the research (strom phone): who works on what now, what waits for the
// person, the last 24 hours and the progress — what the bridge's /status and /log give the Strom app, worked out by the
// same functions and cut to what the page shows: never a path, a record's ID, a spend, a model or a link, nothing the
// phone could answer or start. Each answer is kept per tree longer than the page waits between two asks (a new change
// or an agent coming or going asks it anew), so a phone asking every 10 s never reads the whole research each time
// and a big tree never holds up the photos the phone's server takes.

import type { Env } from "./paths.ts";
import { Settings } from "./config.ts";
import { Tree } from "./tree.ts";
import { actsAsArchive } from "./state.ts";
import { liveWorkers } from "./workers.ts";
import { openSessions } from "./session.ts";
import { directionOf, scopes, type Scope } from "./directions.ts";
import { waitingFor, type Waiting } from "./waiting.ts";
import { recentNow } from "./recent.ts";
import { runGit } from "./git.ts";
import { history, whoAtWork } from "./live.ts";
import { agentsHere } from "./apps.ts";
import { humanTask } from "../cli/human.ts";
import { ui } from "../cli/ui.ts";
import { lifespan } from "./people.ts";
import { ALL_PREFIXES, type Person, type Research, type Session, type Task } from "./model.ts";

/** How long the overview of the tree shown is kept (the page asks every 10 s); the marks of the other trees in the switcher. */
export const OVERVIEW_MS = 15_000;
const MARKS_MS = 60_000;
/** At most so many changes the page shows; so many lines of one change shown, and kept to be unfolded on the phone. */
export const LOG_PHONE = 20;
const LINES_PER_CHANGE = 3;
const LINES_KEPT = 200;
/** So many of what waits the overview gives; more asked by the page, at most so many at once. */
export const WAITING_SHOWN = 20;
export const WAITING_ASKED = 200;

/** The marks of a tree in the switcher: an agent at work on it, how much waits for the person. */
export interface TreeMarks {
  working: boolean;
  waiting: number;
}

/** One line of "Now": a direction worked on (or the agent itself when it has none), its task, since when, paused. */
export interface NowLine {
  /** up: ancestors, down: descendants, other: a person or a question (the page's glyph). */
  way: "up" | "down" | "other";
  name: string;
  task?: string;
  since: string;
  paused?: { until: string };
  /** The research's direction and the years of the life of whom it is about (the widget names it so without the name). */
  direction?: Research["direction"];
  span?: string;
}

export interface Overview {
  now: NowLine[];
  /** When anybody worked on it last (nobody at work now). */
  lastWorked?: string;
  waiting: { n: number; items: WaitingLine[] };
  /** The last 24 hours, once worked out (in the background: none at first). */
  day?: { persons: number; sources: number; saves: number };
  /** The newest change: the page asks for the progress again when it is another. */
  latest?: string;
}

/** One of what waits for the person, its texts whole. */
export interface WaitingLine {
  what: string;
  on?: string;
}

export interface Change {
  id: string;
  at: string;
  lines: string[];
  /** Lines of it not shown. */
  more?: number;
  /** Those lines, to be unfolded on the phone (the first LINES_KEPT of them). */
  rest?: string[];
}

// A record's ID standing alone (every prefix of the model, a document read's D + its time + 4 hex); a list of them
// (", ", a dash, a short word between two: "H0005, H0010, …", "T0400 und T0401") goes as one.
const ALONE = String.raw`(?<![\p{L}\p{M}\p{N}])`;
const ENDS = String.raw`(?![\p{L}\p{M}\p{N}])`;
const ONE_ID = String.raw`${ALONE}(?:D\d{14}-[0-9a-f]{4}|[${[...new Set(Object.values(ALL_PREFIXES))].join("")}]\d{4,})${ENDS}`;
const IDS = new RegExp(String.raw`${ONE_ID}(?:(?:\s*[,;/&+–—-]\s*|\s+(?:\p{L}\p{M}*){1,4}\s+)${ONE_ID})*(?:\s*,?\s*(?:…|\.{3}))?`, "gu");
// an ID written short in square brackets ("[I103]", "[P12, F3]"): a capital or two of any script and a number — never a
// year ("[1842]"), a word ("[sic]") or what has a space or a small letter in it ("[fol. 3]", "[č. 12]")
const SHORT_ID = String.raw`\p{Lu}\p{M}*(?:\p{Lu}\p{M}*)?\p{Nd}+`;
const BRACKET_IDS = new RegExp(String.raw`\[\s*${SHORT_ID}(?:\s*[,;/&+–—-]\s*${SHORT_ID})*\s*\]`, "gu");
// a link, with its scheme or www.: its site alone
const LINK = /(?<![\p{L}\p{M}\p{N}.@])(?:(?:https?|ftp):\/\/|www\.)[^\s<>"„“”«»]+/giu;
// a path: of Windows (C:\…, C:/…, \\server\…), the home's (~/…), absolute (/Users/…), in the research (notes/…, data/…),
// any relative one to a file (a/b.md); a slash between words or numbers ("1842/43", "km/h") is none
const CHAR = String.raw`[^\s<>"„“”«»()\[\]{}|,;]`;
const SEGMENT = String.raw`[^\s<>"„“”«»()\[\]{}|,;/\\]`;
const PATHS = new RegExp(
  [
    String.raw`${ALONE}[A-Za-z]:[\\/]${CHAR}*`,
    String.raw`(?<!\S)\\\\${CHAR}+`,
    String.raw`${ALONE}~[\\/]${CHAR}*`,
    String.raw`(?<![\p{L}\p{M}\p{N}/.:\\])/(?:${SEGMENT}+/)+${CHAR}*`,
    String.raw`(?<![\p{L}\p{M}\p{N}/.:\\])/${SEGMENT}+\.\p{L}{1,5}${ENDS}`,
    String.raw`(?<![\p{L}\p{M}\p{N}/.\\])(?:notes|data|inputs|output|images|media|plugins|\.strom|\.git)[\\/]${CHAR}*`,
    String.raw`(?<![\p{L}\p{M}\p{N}/.\\])[\p{L}\p{M}\p{N}._-]+(?:[\\/][\p{L}\p{M}\p{N}._-]+)+\.\p{L}{1,5}${ENDS}`,
  ].join("|"),
  "gu",
);

/** What closes the sentence or a bracket after a link or a path stays the text's ("(see https://a.org/b)." → "(see a.org)."). */
function peeled(match: string): { core: string; tail: string } {
  let core = match;
  let tail = "";
  const count = (c: string) => core.split(c).length - 1;
  for (let before = ""; before !== core; ) {
    before = core;
    const end = /[.,:;!?…]+$/u.exec(core)?.[0] ?? "";
    core = core.slice(0, core.length - end.length);
    tail = end + tail;
    for (const [open, close] of [["(", ")"], ["[", "]"]] as const)
      if (core.endsWith(close) && count(open) < count(close)) {
        core = core.slice(0, -1);
        tail = close + tail;
      }
  }
  return { core, tail };
}

/** A link's site: its host without www. (its letters as written, never punycode). */
function siteOf(link: string): string {
  const host = link.replace(/^(?:https?|ftp):\/\//iu, "").split(/[/?#\\]/u)[0]!.replace(/^[^@]*@/u, "").replace(/:\d*$/u, "");
  return host.replace(/^www\./iu, "").toLowerCase();
}

/**
 * A text of the research as the phone shows it to the person: without a record's ID (standing alone, in brackets, a
 * list of them), a path (the research's, this computer's, of Windows or POSIX) or a whole link (its site alone: "at
 * https://www.archiv.example.org/book/12" → "at archiv.example.org"), and without what they leave behind: doubled
 * spaces, brackets with nothing in them, commas with nothing between them. Any script, NFD kept as it came; "" when
 * nothing of it is left. Each text the phone's page shows of the research goes through it.
 */
export function forPhone(text: string): string {
  let s = text
    .replace(LINK, (m) => {
      const { core, tail } = peeled(m);
      return `${siteOf(core)}${tail}`;
    })
    .replace(PATHS, (m) => peeled(m).tail)
    .replace(BRACKET_IDS, "")
    .replace(IDS, "")
    .replace(/\s+/gu, " ");
  for (let before = ""; before !== s; ) {
    before = s;
    s = s
      // brackets and quotes with nothing (or a separator alone) in them
      .replace(/\(\s*[,;:·–—-]*\s*\)|\[\s*[,;:·–—-]*\s*\]|\{\s*\}|„\s*“|“\s*”|"\s*"|«\s*»|»\s*«/gu, "")
      // a separator left beside a bracket: "(1842, )" → "(1842)"
      .replace(/([(\[])\s*[,;:–—-]+\s*/gu, "$1")
      .replace(/\s*[,;:–—-]+\s*([)\]])/gu, "$1")
      .replace(/([(\[„«])\s+/gu, "$1")
      .replace(/\s+([)\]“”»])/gu, "$1")
      // commas with nothing between them, a separator before the sentence's end
      .replace(/\s*([,;])(?:\s*[,;])+/gu, "$1")
      .replace(/\s*[,;:–—-]+\s*([.!?])(?=\s|$)/gu, "$1")
      .replace(/\s+([,.;:!?])(?=\s|$)/gu, "$1")
      // dashes one after another
      .replace(/(\s[–—-])(?:\s+[–—-])+(?=\s|$)/gu, "$1")
      // what is left at either end
      .replace(/^[\s,;:.!?…·–—-]+/u, "")
      .replace(/[\s,;:·–—-]+$/u, "")
      .replace(/ {2,}/gu, " ")
      .trim();
  }
  return /[\p{L}\p{N}]/u.test(s) ? s : "";
}

const taskText = (tree: Tree, t: Task) => forPhone(humanTask(tree, t.what, tree.lang));

function head(root: string): string {
  const r = runGit(root, ["rev-parse", "HEAD"]);
  return r.status === 0 ? r.stdout.trim() : "";
}

/** What waits for the person, as the bridge's /status waiting gives it. */
function waitingOf(tree: Tree, env: Env, all: Scope[]) {
  const settings = new Settings(env, {});
  return waitingFor(tree, {
    shared: settings.shared()?.value,
    claude: () => settings.agent(tree.config).value === "claude" && agentsHere(env).some((a) => a.id === "claude" && a.cli),
    stories: true,
    scopes: all,
  });
}

const marksKept = new Map<string, { at: number; value: TreeMarks }>();
// what waits is kept whole beside the overview: the page asks for more of the same list the overview began
const overviewKept = new Map<string, { at: number; key: string; value: Pick<Overview, "now" | "lastWorked" | "waiting">; tree?: Tree; waits: Waiting[] }>();
const logKept = new Map<string, { head: string; limit: number; value: { changes: Change[]; more: boolean } }>();

/** An agent at work on a tree, and how much waits for the person (none of either in an archive). */
export function treeMarks(root: string, env: Env, tree?: Tree): TreeMarks {
  const kept = marksKept.get(root);
  if (kept && Date.now() - kept.at < MARKS_MS) return kept.value;
  const t = tree ?? Tree.open(root, env);
  const value = actsAsArchive(t) ? { working: false, waiting: 0 } : { working: liveWorkers(root).some((w) => !w.paused), waiting: waitingOf(t, env, scopes(t)).length };
  marksKept.set(root, { at: Date.now(), value });
  return value;
}

/**
 * The overview of the tree shown: now, what waits, the last 24 hours, the newest change. Now and what waits are kept
 * OVERVIEW_MS, or till a new change or an agent coming, going or pausing (both cheap to see); the last 24 hours and
 * the newest change are asked each time (kept by recent.ts, the head alone).
 */
export function treeOverview(root: string, env: Env): Overview {
  const h = head(root);
  const recent = h ? recentNow(root, env, h) : undefined;
  const day = recent ? { day: { persons: recent.persons.added, sources: recent.sources.added, saves: recent.commits } } : {};
  const latest = h ? { latest: h.slice(0, 12) } : {};
  const workers = liveWorkers(root);
  const key = [h, ...workers.map((w) => `${w.id}:${w.since}:${w.paused?.until ?? ""}`)].join("|");
  const kept = overviewKept.get(root);
  if (kept && kept.key === key && Date.now() - kept.at < OVERVIEW_MS) return { ...kept.value, ...day, ...latest };
  const tree = Tree.open(root, env);
  let value: Pick<Overview, "now" | "lastWorked" | "waiting">;
  let waits: Waiting[] = [];
  if (actsAsArchive(tree)) value = { now: [], waiting: { n: 0, items: [] } };
  else {
    const all = scopes(tree);
    const open = openSessions(tree);
    const now = workers.map((w): NowLine => {
      const s = open.find((x) => x.worker === w.id);
      const task = s?.task ? tree.get<Task>(s.task) : undefined;
      const rid = s?.research ?? (task ? directionOf(tree, task, all) : undefined);
      const r = rid ? tree.get<Research>(rid) : undefined;
      const way = r?.direction === "ancestors" ? "up" : r?.direction === "descendants" ? "down" : "other";
      const what = task ? taskText(tree, task) : undefined;
      const name = (r ? forPhone(r.name) : "") || whoAtWork(w.label, tree.lang);
      const focus = r?.focus ? tree.get<Person>(r.focus) : undefined;
      const span = focus?.type === "person" ? lifespan(focus) : "";
      return {
        way,
        name,
        ...(what ? { task: what } : {}),
        since: w.since,
        ...(w.paused ? { paused: { until: w.paused.until } } : {}),
        ...(r ? { direction: r.direction } : {}),
        ...(span ? { span } : {}),
      };
    });
    const sessions = tree.list<Session>("session");
    const last = sessions.map((s) => s.ended ?? s.started).sort().at(-1);
    waits = waitingOf(tree, env, all);
    const items = waits.slice(0, WAITING_SHOWN).map((w) => waitingLine(tree, w));
    value = { now, ...(!now.length && last ? { lastWorked: last } : {}), waiting: { n: waits.length, items } };
    marksKept.set(root, { at: Date.now(), value: { working: now.some((l) => !l.paused), waiting: waits.length } });
  }
  overviewKept.set(root, { at: Date.now(), key, value, tree, waits });
  return { ...value, ...day, ...latest };
}

/** One of what waits as the phone shows it, whole; a text of nothing but IDs, paths and links: said in general. */
function waitingLine(tree: Tree, { item }: Waiting): WaitingLine {
  const on = item.on ? forPhone(humanTask(tree, item.on, tree.lang)) : "";
  return { what: forPhone(humanTask(tree, item.what, tree.lang)) || ui(tree.lang, "ui.phone.waiting.item"), ...(on ? { on } : {}) };
}

/**
 * More of what waits than the overview gives: `limit` of them (at most WAITING_ASKED) from `from`, of the same list the
 * overview of the tree began (kept as long as it is), each text as cleaned for the phone; n: how many wait in all.
 */
export function treeWaiting(root: string, env: Env, from: number, limit: number): { n: number; items: WaitingLine[] } {
  treeOverview(root, env);
  const kept = overviewKept.get(root);
  if (!kept?.tree) return { n: 0, items: [] };
  const start = Math.max(0, Math.floor(from));
  const tree = kept.tree;
  return { n: kept.waits.length, items: kept.waits.slice(start, start + Math.min(WAITING_ASKED, Math.max(0, Math.floor(limit)))).map((w) => waitingLine(tree, w)) };
}

/** The last changes the research saved, newest first, as the bridge's /log gives them (each commit, its lines). */
export function treeLog(root: string, env: Env, limit = LOG_PHONE): { changes: Change[]; more: boolean } {
  const h = head(root);
  if (!h) return { changes: [], more: false };
  const kept = logKept.get(root);
  if (kept && kept.head === h && kept.limit === limit) return kept.value;
  // a change with no line for a person (strom's own housekeeping) is left out; one more than shown: whether there are older ones
  const all = history(root, Tree.open(root, env), [`-n${2 * limit + 1}`, h])
    .map((e) => ({ e, lines: e.text.map(forPhone).filter(Boolean) }))
    .filter((x) => x.lines.length);
  const changes = all.slice(0, limit).map(({ e, lines }): Change => ({
    id: e.head.slice(0, 12),
    at: e.at,
    lines: lines.slice(0, LINES_PER_CHANGE),
    ...(lines.length > LINES_PER_CHANGE ? { more: lines.length - LINES_PER_CHANGE, rest: lines.slice(LINES_PER_CHANGE, LINES_PER_CHANGE + LINES_KEPT) } : {}),
  }));
  const value = { changes, more: all.length > limit };
  logKept.set(root, { head: h, limit, value });
  return value;
}
