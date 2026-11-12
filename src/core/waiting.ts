// What waits for the person, in one ordered list: the tasks that wait for them, the questions about archives, the new
// versions of approved stories — and, for the terminal, the trees the Strom app sent and the questions about the reading
// of scans. The bridge sends it to the Strom app (/status `waiting`, the app's spec ZADANI_VYZKUM_menu-ceka.md); the
// menu's What waits reads the same — the terminal's own marked `terminalOnly` (TERMINAL_ONLY), so the menu says what
// of its count the app does not show (waitingSplit, waitingLine). Computed, nothing written.
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

import { inboxState, type InboxState } from "./inboxwait.ts";
import fs from "node:fs";
import path from "node:path";
import { CHECK_ANSWERS, type Conflict, type Family, type Hypothesis, type Person, type RecordSet, type Repository, type Task } from "./model.ts";
import type { Tree } from "./tree.ts";
import { SENDABLE, firstUrlIn, institutionGroup, repoAtHost, waitGroupOf, waitKindOf, waitPhaseOf, type WaitGroup, type WaitKind, type WaitPhase } from "./waitkind.ts";
import { archiveQuestions, archiveWaitingItems, levelWords } from "./archiveasks.ts";
import type { PendingQuestion } from "./terms.ts";
import { onHost } from "./archivewait.ts";
import { storiesToApprove } from "./stories.ts";
import { receivedPending, type Received } from "./sync.ts";
import { tuneQuestions, type Question } from "./tuneask.ts";
import { Settings } from "./config.ts";
import { aboutPeople, hypothesisPeople, scopes, type Scope } from "./directions.ts";
import { pickableInApp } from "./hypolinks.ts";
import { lineOf, offLineView, type BranchView } from "./offline.ts";
import { conflictTitle, displayName } from "./people.ts";
import { conflictsToDecide } from "./conflicts.ts";
import { phrase } from "./phrases.ts";
import { actsAsArchive } from "./state.ts";
import { placeQuestions, type PlaceAsked } from "./placesview.ts";
import { provenReviewSince, provenToReview, type ProvenLeft } from "./provenfix.ts";
import { proposalJson } from "./proposal.ts";
import { ui } from "../cli/ui.ts";
import { humanDay } from "../cli/human.ts";
import { UsageError } from "./errors.ts";

/** What waits: a task's kind, a question about an archive, a story, and the terminal's own (a send of the app, a question about the reading of scans). */
export type WaitingKind = WaitKind | "takeover" | "milder" | "story" | "send" | "tune" | "conflict" | "place" | "branch" | "hypothesis" | "proven" | "transcript";
export type WaitSection = "decide" | "images" | "letter" | "family" | "web" | "other";
/** What a link of the Strom app does with an item (strom-research://task?…&do=): answer, a file to it, the request's text, the folder, sent, a conversation. */
export type WaitAction = "answer" | "file" | "note" | "folder" | "images" | "sent" | "chat";

/** The actions links do now (each one strom-research://task?…&do= takes). */
export const ACTIONS_OFFERED: readonly WaitAction[] = ["answer", "file", "note", "folder", "images", "sent", "chat"];

const SECTION: Record<string, WaitSection> = {
  permission: "decide",
  takeover: "decide",
  milder: "decide",
  check: "decide",
  story: "decide",
  send: "decide",
  tune: "decide",
  conflict: "decide",
  hypothesis: "decide",
  place: "decide",
  branch: "decide",
  proven: "decide",
  // a new wording proposed for a transcript the person read (core/proposal.ts): theirs to take or keep
  transcript: "decide",
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
const DECIDE_RANK: Record<string, number> = { send: 0, conflict: 0, hypothesis: 0, permission: 1, takeover: 2, milder: 3, check: 4, story: 5, place: 5, branch: 5, proven: 5, tune: 6, transcript: 0 };

/** The actions each kind of task allows (those links do now: ACTIONS_OFFERED). */
function actionsOf(kind: WaitingKind, phase: WaitPhase, note: boolean, inbox: boolean): WaitAction[] {
  // images of a book (asked by their numbers, or a site with one book): sent from the app (images: PUT /media with
  // X-Strom-Task) or saved into its folder (folder) — only where the shared inbox is
  const all: WaitAction[] =
    (kind === "images" || kind === "web") && inbox
      ? ["answer", "images", "folder", "chat"]
      : kind === "images" || kind === "web" || kind === "check"
        ? ["answer", "chat"]
        : kind === "letter" || kind === "family" || kind === "other"
          ? ["answer", "file", ...(note ? (["note"] as const) : []), ...(phase === "todo" ? (["sent"] as const) : []), "chat"]
          : [];
  return all.filter((a) => ACTIONS_OFFERED.includes(a));
}

/**
 * A task the person may answer in the Strom app (POST /waiting/<T…> {"do": "answer"}): one whose item offers an answer —
 * never a check of a site (its answers are the terminal's: works, view, no) nor an archive's decision.
 */
export function answersInApp(t: Task): boolean {
  // a new wording proposed for a transcript is taken or kept (POST /sources/proposal), never answered
  if (t.state !== "waiting" || t.proposal || t.awaitsCheck || (t.awaitsPermission && !t.awaits)) return false;
  const kind = waitKindOf(t);
  return kind !== "check" && actionsOf(kind, "todo", false, false).includes("answer");
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
  /** A question of a place the research asks (core/placeid.ts): which of the candidates, the position, the facts' writing. */
  place?: PlaceAsked;
  /** A branch off the lines that grows: a line proposed for it (core/offline.ts). */
  branch?: BranchView;
  /** The facts a person made proven without the original record, waiting for a look (core/provenfix.ts): one item for all. */
  proven?: ProvenLeft[];
  /** A hypothesis an agent proposes how to decide, or (the person deciding them) an open one with no proposal: the person decides it (the terminal). */
  hypothesis?: Hypothesis;
  /** Shown only in the terminal: the Strom app never gets it (/status `waiting` asks for none of these — TERMINAL_ONLY). */
  terminalOnly?: true;
}

/**
 * The options that add what only the terminal shows (the menu's What waits): the bridge never asks for them, so the
 * Strom app never shows them. Each item they add is marked `terminalOnly`; a new kind of the terminal's own goes here.
 */
export const TERMINAL_ONLY = ["sends", "tune", "conflicts", "milder", "hypotheses", "hypothesesOpen"] as const satisfies readonly (keyof WaitingOptions)[];

/** Whether the Strom app shows a thing that waits too (its /status `waiting`): everything but the terminal's own. */
export function inApp(w: Waiting): boolean {
  return !w.terminalOnly;
}

/**
 * How many things wait, split as the Strom app counts them: all of them (the menu's count), those shown only in the
 * terminal, those in the app that wait for a reply (sent — the app counts only what is to do), and what is to do in
 * the app (its number: all − only here − sent).
 */
export function waitingSplit(items: Waiting[]): { all: number; here: number; sent: number; app: number } {
  const here = items.filter((w) => !inApp(w)).length;
  const sent = items.filter((w) => inApp(w) && w.item.phase === "sent").length;
  return { all: items.length, here, sent, app: items.length - here - sent };
}

/**
 * The line "Waiting: N" for the person (of the things, or of their count as kept: core/waitkept.ts): what of it is only here in the terminal and what waits for a reply, each said
 * on its own — the rest is the app's number; as it was only when neither is there (N is the app's number then).
 */
export function waitingLine(lang: string, items: Waiting[] | ReturnType<typeof waitingSplit>, key: "ui.menu.waiting" | "ui.plan.waiting" = "ui.menu.waiting"): string {
  const s = Array.isArray(items) ? waitingSplit(items) : items;
  const parts = [...(s.here ? [ui(lang, "ui.waiting.split.here", { n: s.here })] : []), ...(s.sent ? [ui(lang, "ui.waiting.split.reply", { n: s.sent })] : [])];
  const count = parts.length ? ui(lang, "ui.waiting.split", { n: s.all, parts: parts.join(", ") }) : String(s.all);
  return ui(lang, key, { count });
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
  /** The hypotheses an agent proposes how to decide: the person decides each (the terminal; strom hypothesis propose). */
  hypotheses?: boolean;
  /**
   * With hypotheses: the open hypotheses with no proposal too, the person did not leave open (strom hypothesis decide
   * --keep-open) — where the person decides them (hypotheses.decide person; the terminal).
   */
  hypothesesOpen?: boolean;
  /**
   * The hypotheses for a Strom app that decides them by a pick (the bridge, APP_DECIDES_HYPOTHESES; spec 074 V13): the
   * same as the menu's — the agent's proposals, and with open the open ones with no proposal the person did not leave
   * open —, shown in the app too, each with its first person, the variant proposed ("none": none holds) and pick (a pick
   * of a variant there decides it; else its whole screen here).
   */
  hypothesesApp?: { open: boolean };
  /** The research's directions, when the caller has them. */
  scopes?: Scope[];
}

/** An address a person may open: http(s) only. */
function webUrl(u: string | undefined): string | undefined {
  return u && /^https?:\/\//iu.test(u) && URL.canParse(u) ? u : undefined;
}

/** A file of the tree's notes/ a task's words name: "notes/" where no path or word goes on before it, up to a space or ),;. */
const NOTES_PATH_RE = /(?<![\p{L}\p{M}\p{N}_.\/\\-])notes[\/\\][^\s),;]+/gu;

/** A file there (not a folder), never an error. */
function isFileAt(file: string): boolean {
  try {
    return fs.statSync(file).isFile();
  } catch {
    return false;
  }
}

/**
 * The parts of a path of a file in the research's folder as they are on its disk: as written, else in the other form
 * of its letters (NFC/NFD) — a file system that keeps names as given (NTFS, ext4) has an "ž" typed on a Mac as another
 * name; the path itself is never normalized. None there: undefined.
 */
export function fileAsOnDisk(root: string, parts: string[], isFile: (file: string) => boolean = isFileAt): string[] | undefined {
  for (const form of [parts, parts.map((p) => p.normalize("NFC")), parts.map((p) => p.normalize("NFD"))]) if (isFile(path.join(root, ...form))) return form;
  return undefined;
}

/**
 * The request's text a task waits with (strom task wait --request): a file of the research's notes/ that is there — no
 * absolute path, no way out of notes/ — as it is on the disk (fileAsOnDisk: the path given, else its other form of
 * letters), parts joined with /.
 */
export function requestPath(root: string, given: string, id: string, isFile: (file: string) => boolean = isFileAt): string {
  const raw = given.trim();
  const parts = raw.split(/[\\/]+/u);
  if (!raw || path.isAbsolute(raw) || /^[A-Za-z]:/u.test(raw) || parts[0] !== "notes" || parts.length < 2 || parts.some((p) => p === ".." || p === "."))
    throw new UsageError(`--request takes a file of the tree's notes/, as notes/<file>.md — not "${raw}"`, { hint: `save the request's text first (notes/request-<what>.md), then strom task wait ${id} … --request notes/request-<what>.md` });
  const file = fileAsOnDisk(root, parts, isFile);
  if (!file) throw new UsageError(`--request: no file ${raw} in this tree`, { hint: `save the request's text there first, then name it again`, code: "task.request-missing" });
  return file.join("/");
}

/** A file of the research's notes/ as written (a/b or a\b), when it is one: no absolute path, no way out of notes/. */
function notesFile(tree: Tree, written: string): string | undefined {
  const parts = written.split(/[\\/]+/u);
  if (parts[0] !== "notes" || parts.length < 2 || parts.some((p) => !p || p === "." || p === "..")) return undefined;
  return fileAsOnDisk(tree.root, parts)?.join("/");
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

/**
 * The folder of a task's images saved by hand (core/inboxwait.ts): where, how many of the images it asked for are
 * there (registered, or lying in the folder), how many it wants, which are missing, why the files there cannot be taken.
 * A site the person looks at for the one book of its task has the book's folder too (`want` 0: which images not known).
 */
export function inboxOf(tree: Tree, shared: string | undefined, t: Task): InboxState | undefined {
  return inboxState(tree, shared, t);
}

/**
 * A task's inbox as the app reads it: of the images asked for how many are there (have) of how many (want — none when
 * which ones is not known), those missing (at most 50, in order), the book (its title, for the eye) and the images asked
 * for as said (57–58); the folder (dir) and what lies there for the terminal's menu.
 */
function inboxJson(tree: Tree, t: Task, st: InboxState): Record<string, unknown> {
  const { want, missing, ...rest } = st;
  const book = tree.get<RecordSet>(st.recordset);
  const title = book?.title ? [...book.title] : [];
  return {
    ...rest,
    ...(want ? { want } : {}),
    missing: missing.slice(0, 50),
    ...(title.length ? { book: title.length > 120 ? `${title.slice(0, 119).join("")}…` : title.join("") } : {}),
    ...(t.awaits?.images ? { images: t.awaits.images } : {}),
  };
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
  const sets = tree.list<RecordSet>("recordset").filter((x) => !x.retracted && !x.mergedInto);
  // the research's archive at that site or another site of the same archive, else the archive strom knows of it
  const r = repoAtHost(repos, sets, host, hostOf, onHost);
  const bare = host.toLowerCase().replace(/^www\./u, "");
  if (r) return { key: `repo:${r.id}`, name: r.name, kind: "archive", ...(r.url && /^https?:\/\//iu.test(r.url) ? { url: r.url } : {}) };
  return institutionGroup(bare) ?? { key: `host:${bare}`, name: title ?? bare, kind: "web" };
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
  let line: ((t: Task) => string | undefined) | undefined;
  for (const t of tasks) {
    // a new wording proposed for a transcript the person read: the proposal and the transcript now, taken or kept in
    // the app (POST <token>/sources/proposal) or at the terminal its link opens
    if (t.proposal) {
      const proposal = proposalJson(tree, t);
      out.push({
        task: t,
        item: {
          id: t.id,
          what: t.what,
          on: t.waitingOn ?? "",
          at: t.updated,
          kind: "transcript",
          section: "decide",
          group: { key: "transcripts", name: phrase(lang, "wait.group.transcripts"), kind: "other" },
          phase: "todo",
          priority: t.priority,
          choices: ["proposal", "keep"],
          ...(proposal ? { proposal } : {}),
          actions: [],
        },
      });
      continue;
    }
    const kind = waitKindOf(t);
    const group = waitGroupOf(tree, t, lang);
    const phase = SENDABLE.includes(kind) ? waitPhaseOf(t) : "todo";
    const note = requestNote(tree, t);
    const url = urlOf(tree, t, group);
    const to = t.wait?.to?.trim() || (group.kind === "office" ? group.name : undefined);
    const inbox = inboxOf(tree, o.shared, t);
    all ??= scopes(tree);
    // its direction, else the one it helps (core/offline.ts)
    line ??= lineOf(tree, all);
    const research = line(t);
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
        ...(inbox ? { inbox: inboxJson(tree, t, inbox) } : {}),
        actions: actionsOf(kind, phase, !!note, !!inbox),
        ...personOf(t),
        ...(research ? { research } : {}),
      },
    });
  }
  if (o.milder)
    for (const q of questions.filter((p) => p.kind === "milder" && p.host && p.connector)) {
      const title = q.title ?? q.connector!;
      const what = ui(lang, "ui.archive.milder.item", { title, host: q.host!, to: levelWords(lang, q.to ?? "allowed"), from: levelWords(lang, q.from ?? "restricted") });
      out.push({ question: q, terminalOnly: true, item: { id: q.key, what, on: "", at: q.at, kind: "milder", section: "decide", group: archiveGroup(tree, q.host!, title), phase: "todo", actions: [], host: q.host!, connector: q.connector! } });
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
  // the research's questions of places (which of the villages, the position against the records, the facts' writing):
  // answered by the person at once, nothing spent — the app (POST /places/answer) and the terminal; an archive asks none
  if (!actsAsArchive(tree))
    for (const a of placeQuestions(tree)) {
      const q = a.question;
      const name = a.place.names[0]?.name ?? a.place.id;
      const years = a.years ? `, ${a.years[0] === a.years[1] ? a.years[0] : `${a.years[0]}–${a.years[1]}`}` : "";
      const by = a.place.locating?.by ?? (a.place.coords ? "person" : undefined);
      out.push({
        place: a,
        item: {
          id: a.place.id,
          what: ui(lang, q.kind === "conflict" ? "ui.waiting.place.conflict" : q.kind === "form" ? "ui.waiting.place.form" : "ui.waiting.place.propose", { place: name }),
          on: a.persons ? ui(lang, "ui.waiting.place.on", { n: a.persons, years }) : "",
          at: q.at,
          kind: "place",
          section: "decide",
          group: { key: "places", name: phrase(lang, "wait.group.places"), kind: "other" },
          phase: "todo",
          actions: ["answer"],
          place: a.place.id,
          forms: a.forms,
          question: q.kind,
          ...(q.candidates?.length ? { candidates: q.candidates } : {}),
          ...(q.kind === "conflict" ? { current: q.current ?? (a.place.coords ? { lat: a.place.coords.lat, lon: a.place.coords.lon } : undefined), ...(by ? { by } : {}) } : {}),
          ...(q.kind === "form" && q.change ? { change: q.change } : {}),
          ...(q.why ? { why: q.why } : {}),
        },
      });
    }
  // a branch off the lines that grows: a line proposed for it (K7.0 d) — computed now, nothing written until answered
  if (!actsAsArchive(tree))
    for (const b of offLineView(tree, o.tune ?? new Settings(tree.env, {}), o.scopes)?.branches.filter((x) => x.grows) ?? []) {
      const p = tree.get<Person>(b.person);
      const at = b.tasks.map((t) => t.created).sort().pop() ?? "";
      out.push({
        branch: b,
        item: {
          id: `W-${b.id}`,
          what: ui(lang, "ui.waiting.branch", { who: p ? displayName(p) : b.person, tasks: b.tasks.length, persons: b.persons.length }),
          on: "",
          at,
          kind: "branch",
          section: "decide",
          group: { key: "branches", name: phrase(lang, "wait.group.branches"), kind: "other" },
          phase: "todo",
          actions: ["answer"],
          branch: b.id,
          person: b.person,
          ...(b.nearest ? { research: b.nearest } : {}),
          tasks: b.tasks.length,
          persons: b.persons.length,
        },
      });
    }
  // the facts a person made proven without the original record (strom's fix left them as they are): one item with their
  // count — kept proven, or made probable, the person's answer alone; an archive asks none
  if (!actsAsArchive(tree)) {
    const proven = provenToReview(tree);
    if (proven.length)
      out.push({
        proven,
        item: {
          id: "W-proven",
          what: ui(lang, "ui.waiting.proven", { n: proven.length }),
          on: "",
          at: provenReviewSince(tree),
          kind: "proven",
          section: "decide",
          group: { key: "proven", name: phrase(lang, "wait.group.proven"), kind: "other" },
          phase: "todo",
          actions: [],
          count: proven.length,
          facts: proven.map((p) => p.event),
        },
      });
  }
  // what the Strom app sent on its own, waiting to be written or thrown away: the person's own edits
  if (o.sends)
    for (const r of receivedPending(tree.root))
      out.push({
        send: r,
        terminalOnly: true,
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
        terminalOnly: true,
        item: { id: c.id, what: conflictTitle(tree, c), on: "", at: c.created, kind: "conflict", section: "decide", group: { key: "conflicts", name: phrase(lang, "wait.group.conflicts"), kind: "other" }, phase: "todo", actions: [] },
      });
  // the hypotheses an agent proposes how to decide: only the person decides one (an archive says nothing of an agent) —
  // then, where the person decides them (hypotheses.decide person), the open ones with no proposal they did not leave
  // open: after the proposals (priority below theirs), until an agent proposes how to decide one
  // (the same for a Strom app that decides them by a pick: shown there too, with what it needs of each)
  const hyp = o.hypotheses ? { open: !!o.hypothesesOpen, app: false } : o.hypothesesApp ? { open: o.hypothesesApp.open, app: true } : undefined;
  if (hyp && !actsAsArchive(tree)) {
    const all = tree.list<Hypothesis>("hypothesis").filter((x) => !x.retracted && !x.mergedInto);
    const group = { key: "hypotheses", name: phrase(lang, "wait.group.hypotheses"), kind: "other" as const };
    const forApp = (h: Hypothesis) => {
      if (!hyp.app) return {};
      const person = aboutPeople(tree, h.subject)[0] ?? hypothesisPeople(tree, h)[0];
      const p = h.proposal;
      return { ...(person ? { person } : {}), ...(p ? { proposal: p.abandon || !p.variant ? "none" : p.variant } : {}), ...(pickableInApp(h) ? { pick: true } : {}) };
    };
    const only = hyp.app ? {} : { terminalOnly: true as const };
    for (const h of all.filter((x) => x.proposal).sort((a, b) => a.proposal!.at.localeCompare(b.proposal!.at) || a.id.localeCompare(b.id)))
      out.push({
        hypothesis: h,
        ...only,
        item: { id: h.id, what: h.question, on: "", at: h.proposal!.at, kind: "hypothesis", section: "decide", group, phase: "todo", actions: [], ...forApp(h) },
      });
    if (hyp.open)
      for (const h of all.filter((x) => x.state === "open" && !x.proposal && !x.leftOpen).sort((a, b) => a.created.localeCompare(b.created) || a.id.localeCompare(b.id)))
        out.push({
          hypothesis: h,
          ...only,
          item: { id: h.id, what: h.question, on: "", at: h.created, kind: "hypothesis", section: "decide", group, phase: "todo", actions: [], priority: -1, ...forApp(h) },
        });
  }
  // the questions about the reading of scans only a person answers
  if (o.tune)
    for (const q of tuneQuestions(tree, o.tune).due)
      out.push({
        tune: q,
        terminalOnly: true,
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
