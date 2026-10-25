// What waits for the person, in one ordered list: the tasks that wait for them, the questions about archives, the new
// versions of approved stories — and, for the terminal, the trees the Strom app sent and the questions about the reading
// of scans. The bridge sends it to the Strom app (/status `waiting`, the app's spec ZADANI_VYZKUM_menu-ceka.md); the
// menu's What waits reads the same. Computed, nothing written.
//
// Each item: its kind (core/waitkind.ts for a task), the section the app shows it in, the place where it is dealt with
// (its group), todo or sent, its order; for a task its priority, the site, the request's text, whom, the folder for
// images saved by hand (how many are there, how many it wants) and what a link of the app may do with it (`actions`).
//
// The order: what is to be done first, what waits for a reply after it (the oldest sent first). To be done: the
// decisions (they hold the agent up), then images and sites (the person does them at once), then letters and the
// family, then the rest; the items of one place together, where its first stands; within, the priority, then the age.
// A task that waits for an archive's permission while its question waits is no item of its own: it is one of the
// question's `tasks` — nothing counted twice. A task that waits for images saved by hand from that archive stays an item
// of its own (the person can save them by hand, or talk about them, whatever the question): in the question's `tasks`
// too, as what the decision touches, yet each task one item at most.

import fs from "node:fs";
import path from "node:path";
import { CHECK_ANSWERS, type Conflict, type Family, type Person, type RecordSet, type Repository, type Task } from "./model.ts";
import type { Tree } from "./tree.ts";
import { SENDABLE, firstUrlIn, waitGroupOf, waitKindOf, waitPhaseOf, type WaitGroup, type WaitKind, type WaitPhase } from "./waitkind.ts";
import { archiveQuestions, archiveWaitingItems, levelWords } from "./archiveasks.ts";
import type { PendingQuestion } from "./terms.ts";
import { onHost } from "./archivewait.ts";
import { storiesToApprove } from "./stories.ts";
import { receivedPending, type Received } from "./sync.ts";
import { tuneQuestions, type Question } from "./tuneask.ts";
import type { Settings } from "./config.ts";
import { directionOf, scopes, type Scope } from "./directions.ts";
import { collectFiles, IMAGE_FILE_EXT, parseImageList } from "./media.ts";
import { conflictTitle, displayName } from "./people.ts";
import { conflictsToDecide } from "./conflicts.ts";
import { phrase } from "./phrases.ts";
import { actsAsArchive } from "./state.ts";
import { ui } from "../cli/ui.ts";
import { humanDay } from "../cli/human.ts";

/** What waits: a task's kind, a question about an archive, a story, and the terminal's own (a send of the app, a question about the reading of scans). */
export type WaitingKind = WaitKind | "takeover" | "milder" | "story" | "send" | "tune" | "conflict";
export type WaitSection = "decide" | "images" | "letter" | "family" | "web" | "other";
/** What a link of the Strom app does with an item (strom-research://task?…&do=): answer, a file to it, the request's text, the folder, sent, a conversation. */
export type WaitAction = "answer" | "file" | "note" | "folder" | "sent" | "chat";

/** The actions links do now (each one strom-research://task?…&do= takes). */
export const ACTIONS_OFFERED: readonly WaitAction[] = ["answer", "file", "note", "folder", "sent", "chat"];

const SECTION: Record<string, WaitSection> = {
  permission: "decide",
  takeover: "decide",
  milder: "decide",
  check: "decide",
  story: "decide",
  send: "decide",
  tune: "decide",
  conflict: "decide",
  images: "images",
  letter: "letter",
  family: "family",
  web: "web",
};

/** The section of a kind (the app's chip): an unknown one is "other". */
export function sectionOf(kind: string): WaitSection {
  return SECTION[kind] ?? "other";
}

/** To be done: the decisions, then images and sites, then letters and the family, then the rest. */
const SECTION_RANK: Record<WaitSection, number> = { decide: 0, images: 1, web: 1, letter: 2, family: 2, other: 3 };
/** Among the decisions: the person's own edits first, the archives (they hold work up), then the rest. */
const DECIDE_RANK: Record<string, number> = { send: 0, conflict: 0, permission: 1, takeover: 2, milder: 3, check: 4, story: 5, tune: 6 };

/** The actions each kind of task allows (those links do now: ACTIONS_OFFERED). */
function actionsOf(kind: WaitingKind, phase: WaitPhase, note: boolean): WaitAction[] {
  const all: WaitAction[] =
    kind === "images"
      ? ["answer", "folder", "chat"]
      : kind === "letter" || kind === "family" || kind === "other"
        ? ["answer", "file", ...(note ? (["note"] as const) : []), ...(phase === "todo" ? (["sent"] as const) : []), "chat"]
        : kind === "web" || kind === "check"
          ? ["answer", "chat"]
          : [];
  return all.filter((a) => ACTIONS_OFFERED.includes(a));
}

/** An item as the Strom app reads it (/status `waiting[]`): what the bridge sent before, and the fields of the groups. */
interface WaitingFields {
  id: string;
  what: string;
  on: string;
  at: string;
  kind: WaitingKind;
  section: WaitSection;
  group: WaitGroup;
  phase: WaitPhase;
  actions: WaitAction[];
}
export type WaitingJson = WaitingFields & { order: number } & Record<string, unknown>;
/** An item before its place in the order is known. */
type Unordered = Omit<Waiting, "item"> & { item: WaitingFields & Record<string, unknown> };

/** One thing that waits: the app's item, and what it is (for the terminal). */
export interface Waiting {
  item: WaitingJson;
  task?: Task;
  question?: PendingQuestion;
  /** The person or couple whose story has a new version. */
  story?: string;
  send?: Received;
  tune?: Question;
  /** An open conflict the person decides (the terminal). */
  conflict?: Conflict;
}

export interface WaitingOptions {
  /** The shared folder (the inbox of images saved by hand). */
  shared?: string | undefined;
  /** Whether Claude Code does the research and is here (an archive's ways through the browser); asked only when needed. */
  claude?: () => boolean;
  /** The new versions of approved stories (the bridge: only for an app that shows them). Default: yes. */
  stories?: boolean;
  /** The trees the Strom app sent, waiting in the inbox (the terminal). */
  sends?: boolean;
  /** The questions about the reading of scans that are due (the terminal): the settings to ask them with. */
  tune?: Settings;
  /** The open conflicts the person decides (the terminal; core/conflicts.ts conflictsToDecide). */
  conflicts?: boolean;
  /** A connector's word that an archive allows more (the terminal). */
  milder?: boolean;
  /** The research's directions, when the caller has them. */
  scopes?: Scope[];
}

/** An address a person may open: http(s) only. */
function webUrl(u: string | undefined): string | undefined {
  return u && /^https?:\/\//iu.test(u) && URL.canParse(u) ? u : undefined;
}

/** A file of the tree's notes/ a task's words name: "notes/" where no path or word goes on before it, up to a space or ),;. */
const NOTES_PATH_RE = /(?<![\p{L}\p{M}\p{N}_.\/\\-])notes[\/\\][^\s),;]+/gu;

/** A file of the research's notes/ as written (a/b or a\b), when it is one: no absolute path, no way out of notes/. */
function notesFile(tree: Tree, written: string): string | undefined {
  const parts = written.split(/[\\/]+/u);
  if (parts[0] !== "notes" || parts.length < 2 || parts.some((p) => !p || p === "." || p === "..")) return undefined;
  // the name as written; a file system that keeps names as given in another form (NFC/NFD) by that form
  for (const form of [parts, parts.map((p) => p.normalize("NFC")), parts.map((p) => p.normalize("NFD"))]) {
    try {
      if (fs.statSync(path.join(tree.root, ...form)).isFile()) return form.join("/");
    } catch {
      // not there in this form
    }
  }
  return undefined;
}

/**
 * The request's text of a task: the file `strom task wait --request` gave it, else — a task that waited before it could
 * say so — the first file of the research's notes/ its waitingOn, then its what names, when it is there. The path as
 * written (relative to the research's folder); nothing written.
 */
export function requestNote(tree: Tree, t: Task): string | undefined {
  const own = t.wait?.note;
  if (own) {
    const file = path.resolve(tree.root, own);
    const rel = path.relative(tree.root, file);
    if (rel && !rel.startsWith("..") && !path.isAbsolute(rel)) {
      try {
        if (fs.statSync(file).isFile()) return own;
      } catch {
        // not there: what its words name
      }
    }
  }
  for (const text of [t.waitingOn ?? "", t.what]) {
    for (const m of text.matchAll(NOTES_PATH_RE)) {
      const raw = m[0];
      // a sentence's end or quotes after the path are no part of it — unless a file is named so
      const bare = raw.replace(/[.:!?"'\u201C\u201D\u2019\u00BB\]]+$/u, "");
      const found = notesFile(tree, raw) ?? (bare !== raw ? notesFile(tree, bare) : undefined);
      if (found) return found;
    }
  }
  return undefined;
}

/** The file of the request's text of a task (requestNote), only when it is there, in the research's folder. */
export function requestFile(tree: Tree, t: Task): string | undefined {
  const note = requestNote(tree, t);
  return note ? path.resolve(tree.root, note) : undefined;
}

/**
 * The request texts of tasks joined for one e-mail — each file once (the same file named by several tasks, by another
 * spelling of its path too): the text, the files, the tasks asked about. The bridge's GET /group/<key>/note and the
 * menu's "the text of all requests at once" say the same.
 */
export function requestTexts(tree: Tree, tasks: Task[]): { text: string; notes: string[]; tasks: string[] } {
  const notes: string[] = [];
  const texts: string[] = [];
  const seen = new Set<string>();
  for (const t of tasks) {
    const note = requestNote(tree, t);
    if (!note) continue;
    const file = path.resolve(tree.root, note);
    let real = file;
    try {
      real = fs.realpathSync(file);
    } catch {
      // read as named
    }
    if (seen.has(real)) continue;
    seen.add(real);
    notes.push(note);
    texts.push(fs.readFileSync(file, "utf8").replace(/^﻿/, "").trim());
  }
  return { text: texts.join("\n\n-----\n\n"), notes, tasks: tasks.map((t) => t.id) };
}

/** The folder of a task's images saved by hand: where, how many images are there, how many it wants. */
export function inboxOf(shared: string | undefined, t: Task): { dir: string; have: number; want: number } | undefined {
  if (!shared || !t.awaits) return undefined;
  const dir = path.join(shared, "inbox", t.awaits.folder);
  let have = 0;
  try {
    if (fs.existsSync(dir)) have = collectFiles([dir]).filter((f) => IMAGE_FILE_EXT.has(path.extname(f).toLowerCase())).length;
  } catch {
    // a folder strom cannot read: none counted
  }
  return { dir, have, want: parseImageList(t.awaits.images)?.length ?? 0 };
}

/** The site of a task: what it names, the check's, its book's or archive's, the first address in its words. */
function urlOf(tree: Tree, t: Task, group: WaitGroup): string | undefined {
  const book = t.awaits?.recordset ?? t.where.find((w) => /^B\d{4,}$/u.test(w));
  const b = book ? tree.get<RecordSet>(book) : undefined;
  const repo = group.kind === "archive" ? tree.get<Repository>(group.key.slice("repo:".length)) : undefined;
  return webUrl(t.awaitsCheck?.url) ?? webUrl(t.wait?.url) ?? (t.awaits ? webUrl(b?.url) : undefined) ?? webUrl(firstUrlIn(`${t.waitingOn ?? ""}\n${t.what}`)) ?? webUrl(b?.url) ?? webUrl(repo?.url);
}

/** The one person a task is about (its subject names exactly one), for the app's badge on that person. */
function personOf(t: Task): { person?: string } {
  const people = t.subject.filter((id) => /^P\d{1,7}$/u.test(id));
  return people.length === 1 ? { person: people[0]! } : {};
}

/** The archive of a host: the research's own (its address, or a book's there), else the host itself. */
function archiveGroup(tree: Tree, host: string, title: string | undefined): WaitGroup {
  const hostOf = (u: string | undefined) => (u && URL.canParse(u) ? new URL(u).hostname.toLowerCase() : undefined);
  const repos = tree.list<Repository>("repository").filter((r) => !r.retracted && !r.mergedInto);
  const r =
    repos.find((x) => onHost(hostOf(x.url), host)) ??
    (() => {
      const b = tree.list<RecordSet>("recordset").find((x) => !x.retracted && !x.mergedInto && x.repository && onHost(hostOf(x.url), host));
      return b ? repos.find((x) => x.id === b.repository) : undefined;
    })();
  const bare = host.toLowerCase().replace(/^www\./u, "");
  return r ? { key: `repo:${r.id}`, name: r.name, kind: "archive" } : { key: `host:${bare}`, name: title ?? bare, kind: "web" };
}

/** Everything that waits for the person, ordered (see the top of this file). */
export function waitingFor(tree: Tree, o: WaitingOptions = {}): Waiting[] {
  const lang = tree.lang;
  const out: Unordered[] = [];
  // an archive's images that wait for the person's decision, the connectors taken over to confirm: the app shows them,
  // the person decides in the terminal its link opens (archive&host=)
  const questions = archiveQuestions(tree);
  const standing = new Set<string>();
  for (const x of archiveWaitingItems(tree, o.shared, o.claude ?? (() => false))) {
    const q = questions.find((p) => p.key === x.id);
    const kind = x.kind as "permission" | "takeover";
    const group: WaitGroup =
      kind === "permission" ? archiveGroup(tree, String(x.host), typeof x.title === "string" ? x.title : undefined) : { key: "connectors", name: phrase(lang, "wait.group.connectors"), kind: "other" };
    if (kind === "permission" && Array.isArray(x.tasks)) for (const id of x.tasks) standing.add(String(id));
    out.push({ ...(q ? { question: q } : {}), item: { ...(x as { id: string; what: string; on: string; at: string }), kind, section: "decide", group, phase: "todo", actions: [] } });
  }
  // an archive (a research waiting for its agent too) asks the person nothing: none waits (put aside at its next write, settleArchive); a task that waits for
  // an archive's permission whose question waits is one of the question's tasks, never an item of its own — one that
  // waits for images saved by hand stays an item
  const tasks = actsAsArchive(tree) ? [] : tree.list<Task>("task").filter((t) => t.state === "waiting" && !(t.awaitsPermission && !t.awaits && standing.has(t.id)));
  let all = o.scopes;
  for (const t of tasks) {
    const kind = waitKindOf(t);
    const group = waitGroupOf(tree, t, lang);
    const phase = SENDABLE.includes(kind) ? waitPhaseOf(t) : "todo";
    const note = requestNote(tree, t);
    const url = urlOf(tree, t, group);
    const to = t.wait?.to?.trim() || (group.kind === "office" ? group.name : undefined);
    const inbox = kind === "images" ? inboxOf(o.shared, t) : undefined;
    all ??= scopes(tree);
    const research = directionOf(tree, t, all);
    out.push({
      task: t,
      item: {
        id: t.id,
        what: t.what,
        on: t.waitingOn ?? "",
        // since when it waits: its last change is the one that made it wait
        at: t.updated,
        kind,
        section: sectionOf(kind),
        group,
        phase,
        ...(phase === "sent" && t.sent ? { sentAt: t.sent.at } : {}),
        priority: t.priority,
        ...(url ? { url } : {}),
        // a check of a site only the person sees: the answers (given in the terminal its link opens: task&do=check)
        ...(kind === "check" ? { choices: [...CHECK_ANSWERS] } : {}),
        ...(note ? { note } : {}),
        ...(to ? { to } : {}),
        ...(inbox ? { inbox } : {}),
        actions: actionsOf(kind, phase, !!note),
        ...personOf(t),
        ...(research ? { research } : {}),
      },
    });
  }
  if (o.milder)
    for (const q of questions.filter((p) => p.kind === "milder" && p.host && p.connector)) {
      const title = q.title ?? q.connector!;
      const what = ui(lang, "ui.archive.milder.item", { title, host: q.host!, to: levelWords(lang, q.to ?? "allowed"), from: levelWords(lang, q.from ?? "restricted") });
      out.push({ question: q, item: { id: q.key, what, on: "", at: q.at, kind: "milder", section: "decide", group: archiveGroup(tree, q.host!, title), phase: "todo", actions: [], host: q.host!, connector: q.connector! } });
    }
  // a new version of an approved story: whose (a couple's: person and partner), since when
  if (o.stories !== false)
    for (const s of storiesToApprove(tree)) {
      const rec = tree.get<Person | Family>(s.id);
      if (!rec) continue;
      const people = rec.type === "family" ? rec.partners : [rec.id];
      const name = (id: string) => {
        const p = tree.get<Person>(id);
        return p ? displayName(p) : id;
      };
      out.push({
        story: rec.id,
        item: {
          id: rec.id,
          what: ui(lang, "ui.waiting.story", { who: people.map(name).join(" & ") }),
          on: "",
          at: s.at,
          kind: "story",
          section: "decide",
          group: { key: "stories", name: phrase(lang, "wait.group.stories"), kind: "other" },
          phase: "todo",
          actions: [],
          ...(people[0] ? { person: people[0] } : {}),
          ...(people[1] ? { partner: people[1] } : {}),
        },
      });
    }
  // what the Strom app sent on its own, waiting to be written or thrown away: the person's own edits
  if (o.sends)
    for (const r of receivedPending(tree.root))
      out.push({
        send: r,
        item: {
          id: r.intake,
          what: ui(lang, "ui.waiting.sent", { day: humanDay(r.at, lang), time: r.at.slice(11, 16), n: r.changes }),
          on: "",
          at: r.at,
          kind: "send",
          section: "decide",
          group: { key: "app", name: phrase(lang, "wait.group.app"), kind: "other" },
          phase: "todo",
          actions: [],
        },
      });
  // the open conflicts the person decides: their own edits against the research, every one where no agent works
  if (o.conflicts)
    for (const c of conflictsToDecide(tree))
      out.push({
        conflict: c,
        item: { id: c.id, what: conflictTitle(tree, c), on: "", at: c.created, kind: "conflict", section: "decide", group: { key: "conflicts", name: phrase(lang, "wait.group.conflicts"), kind: "other" }, phase: "todo", actions: [] },
      });
  // the questions about the reading of scans only a person answers
  if (o.tune)
    for (const q of tuneQuestions(tree, o.tune).due)
      out.push({
        tune: q,
        item: { id: q.id, what: q.text, on: q.why, at: q.asked, kind: "tune", section: "decide", group: { key: "tune", name: phrase(lang, "wait.group.tune"), kind: "other" }, phase: "todo", actions: [] },
      });
  // one place, one name: the first said of it (an archive's question names it as the research knows the archive; its
  // tasks by their book's site would name it by the host)
  const names = new Map<string, string>();
  for (const x of out) if (!names.has(x.item.group.key)) names.set(x.item.group.key, x.item.group.name);
  for (const x of out) x.item.group = { ...x.item.group, name: names.get(x.item.group.key)! };
  return ordered(out);
}

/** The items of one place together, where its first stands. */
function together<T extends { item: { group: WaitGroup } }>(xs: T[]): T[] {
  const by = new Map<string, T[]>();
  for (const x of xs) {
    const k = x.item.group.key;
    if (!by.has(k)) by.set(k, []);
    by.get(k)!.push(x);
  }
  return [...by.values()].flat();
}

function ordered(xs: Unordered[]): Waiting[] {
  const prio = (x: { item: Record<string, unknown> }) => (typeof x.item.priority === "number" ? x.item.priority : 0);
  const todo = xs
    .filter((x) => x.item.phase === "todo")
    .sort(
      (a, b) =>
        SECTION_RANK[a.item.section] - SECTION_RANK[b.item.section] ||
        (a.item.section === "decide" ? (DECIDE_RANK[a.item.kind] ?? 4) - (DECIDE_RANK[b.item.kind] ?? 4) : 0) ||
        prio(b) - prio(a) ||
        a.item.at.localeCompare(b.item.at),
    );
  const sentAt = (x: { item: Record<string, unknown> }) => String(x.item.sentAt ?? x.item.at);
  const sent = xs.filter((x) => x.item.phase === "sent").sort((a, b) => sentAt(a).localeCompare(sentAt(b)));
  return [...together(todo), ...together(sent)].map((x, order) => ({ ...x, item: { ...x.item, order } }));
}

/** The other tasks that wait at the same place as this one, in the order of What waits (a conversation takes them up together). */
export function sameGroup(tree: Tree, task: Task, shared?: string): Task[] {
  const key = waitGroupOf(tree, task).key;
  return waitingFor(tree, { shared, stories: false })
    .filter((w) => w.task && w.task.id !== task.id && w.item.group.key === key)
    .map((w) => w.task!);
}
