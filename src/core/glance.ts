// What the Strom app shows on a phone before it has the tree (spec 094 K3.13, the screen Research): who works on which
// line now and since when, the runs, the last 24 hours, the lines in the order of work, what waits for the person with
// what a device may do about each, the tree's size before it is downloaded — and the name of each person these name by
// ID (people), so that nothing of it needs the tree. The bridge answers it (GET <token>/glance, feature glance) from the
// /status it made for the research's state (core/livestatus.ts: never worked out again here), the runs read at each ask.
// Its texts as the phone's page has them (forPhone: no path, no link but its site, a record's ID out of the words); the
// IDs a device acts by in fields of their own (the line, the task, the person, the run). Nothing only the computer
// has: no agent, model or step of a run, no folder, no link strom-research://, no spend. An archive and a research
// waiting for its agent: the tree and the last 24 hours alone (nobody works there, nothing waits).

import { Tree } from "./tree.ts";
import { actsAsArchive } from "./state.ts";
import { forPhone } from "./phone-watch.ts";
import { displayName, lifespan } from "./people.ts";
import { humanTask } from "../cli/human.ts";
import type { RunView } from "./liveruns.ts";
import type { Asking } from "./deviceagent.ts";
import type { Hypothesis, Person, Research, Session, Task } from "./model.ts";

/** So many of what waits are given (n says how many in all; the rest: GET status/waiting). */
export const GLANCE_WAITING = 50;

/** What a device may do about one of what waits, each through the bridge (the route in docs: POST waiting/<id> {do}, …). */
export type GlanceDo = "answer" | "sent" | "unsent" | "retry" | "line" | "keep" | "never" | "decide";

export type Way = "up" | "down" | "other";

export interface GlanceNow {
  /** Since when the agent works there (its session, or its run between two). */
  since: string;
  paused?: { until: string; reason?: string };
  /** The line it works on (G…) and the way of it; none: off the lines. */
  line?: string;
  way: Way;
  /** The task at work: its ID (T…) and its text as the person reads it. */
  task?: { id: string; text: string };
  /** Whom the work is about (P…), the family (F…). */
  person?: string;
  family?: string;
  /** The run it belongs to (run-…): POST runs/stop {run}. */
  run?: string;
}

export interface GlanceRun {
  id: string;
  /** The line it holds (G…); null: the whole queue. */
  line: string | null;
  way: Way;
  since: string;
  state: RunView["state"];
  paused?: { until: string; reason?: string };
  /** The task at work (T…), while a session works. */
  task?: string;
  /** It waits for the person at the computer (a window of a consent, a question in its terminal; spec 094 K3.15). */
  onComputer?: { kind: Asking["kind"]; since: string };
  /** The device of the home network whose terminal started it (who started it). */
  device?: { id: string; name?: string };
}

export interface GlanceLine {
  id: string;
  /** Its place in the order of work (1 = first). */
  n: number;
  name: string;
  direction: Research["direction"];
  way: Way;
  state: Research["state"];
  /** Its tasks in the queue, those waiting for the person, whether an agent works on it now. */
  tasks: number;
  waiting: number;
  working: boolean;
  since: string;
  /** Whom it is about (P…). */
  focus?: string;
  /** Why it is paused or done, as written. */
  reason?: string;
}

export interface GlanceWaiting {
  id: string;
  kind: string;
  section: string;
  phase: "todo" | "sent";
  what: string;
  on?: string;
  at: string;
  sentAt?: string;
  group: { key: string; name: string; kind: string; url?: string };
  /** Whom it is about (P…), its line (G…), its branch (B-P…). */
  person?: string;
  line?: string;
  branch?: string;
  /**
   * A task returned to the agent again: whether it may be now, why it waits, and how many images it still waits for
   * where /status knows (n — "Try again through the agent · n images"; spec 094 D17).
   */
  retry?: { can: boolean; until?: string; says: string; n?: number };
  /** A hypothesis: its variants and what an agent proposes (the device decides it: device/hypothesis/<H…>). */
  hypothesis?: { variants: { label: string; claim: string }[]; proposal?: { variant?: string; abandon?: true; decision: string }; pick?: true };
  do: GlanceDo[];
}

export interface Glance {
  head: string;
  headAt?: string;
  tree: { id: string; name: string; lang: string; state: string; kind?: string; persons: number; families: number; ged?: { bytes: number; head: string } };
  /** A research a newer strom wrote: refused here (nothing else said). */
  locked?: { code: string };
  /** The last 24 hours: people and sources added, saves (none until worked out). */
  day?: { persons: number; sources: number; saves: number; since: string };
  now: GlanceNow[];
  runs: GlanceRun[];
  /**
   * What waits for the person at the computer now (spec 094 K3.15): a window of a consent, a question in a terminal a
   * device opened — the run asking, the device whose terminal asks. None: nothing waits there.
   */
  onComputer?: Asking[];
  /** When anybody worked on it last (nobody at work now). */
  lastWorked?: string;
  lines: GlanceLine[];
  waiting: { n: number; items: GlanceWaiting[] };
  /** Each person named above by ID: the name and the years of the life. */
  people: Record<string, { name: string; span?: string }>;
}

/** What /status gives that the glance is made of (its light answer, the parts researches and waiting). */
export interface GlanceFrom {
  status: Record<string, unknown>;
  researches: unknown[];
  waiting: unknown[];
}

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj | undefined => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : undefined);
const str = (v: unknown): string | undefined => (typeof v === "string" && v ? v : undefined);
const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const PERSON_ID = /^P\d{1,9}$/u;
const wayOf = (direction: unknown): Way => (direction === "ancestors" ? "up" : direction === "descendants" ? "down" : "other");

/** A text of the research as a device shows it: its records by their names, cleaned as for the phone's page. */
function said(tree: Tree, text: unknown): string {
  return typeof text === "string" && text ? forPhone(humanTask(tree, text, tree.lang, { asWritten: true })) : "";
}

/** A paused agent or run as the device reads it: until when, why (limit, archive…). */
function pausedOf(v: unknown): { paused?: { until: string; reason?: string } } {
  const p = obj(v);
  const until = str(p?.until);
  return until ? { paused: { until, ...(str(p?.reason) ? { reason: str(p?.reason)! } : {}) } } : {};
}

/** What a device may do about one of what waits (each passes the gateway's allowlist, core/device-allow.ts). */
export function glanceDo(item: Obj): GlanceDo[] {
  const kind = item.kind;
  if (kind === "branch") return ["line", "keep", "never"];
  if (kind === "hypothesis") return ["decide"];
  if (typeof item.id !== "string" || !/^T\d{1,9}$/u.test(item.id)) return [];
  const actions = Array.isArray(item.actions) ? item.actions : [];
  const out: GlanceDo[] = [];
  if (actions.includes("answer")) out.push("answer");
  if (item.phase === "todo" && actions.includes("sent")) out.push("sent");
  if (item.phase === "sent") out.push("unsent");
  if (obj(item.retry)?.can === true) out.push("retry");
  return out;
}

/**
 * The glance of a tree from what /status made for its state (`from`), no run yet (withRuns) nor the size of the tree's
 * file (both read at each ask). `tree`: the research as it is (its names, its tasks' texts).
 */
export function glanceOf(tree: Tree, from: GlanceFrom): Glance {
  const s = from.status;
  const t = obj(s.tree) ?? {};
  const people: Glance["people"] = {};
  const named = (id: unknown): string | undefined => {
    if (typeof id !== "string" || !PERSON_ID.test(id)) return undefined;
    if (!people[id]) {
      const p = tree.get<Person>(id);
      if (!p || p.type !== "person" || p.retracted) return undefined;
      const span = lifespan(p);
      people[id] = { name: forPhone(displayName(p)) || id, ...(span ? { span } : {}) };
    }
    return id;
  };
  const recent = obj(s.recent);
  const base = {
    head: str(s.head) ?? "",
    ...(str(s.headAt) ? { headAt: str(s.headAt)! } : {}),
    tree: {
      id: str(t.id) ?? tree.config.id,
      name: str(t.name) ?? tree.config.name,
      lang: str(t.lang) ?? tree.lang,
      state: str(t.state) ?? "research",
      ...(str(t.kind) ? { kind: str(t.kind)! } : {}),
      persons: num(s.persons),
      families: num(s.families),
    },
    ...(recent ? { day: { persons: num(obj(recent.persons)?.added), sources: num(obj(recent.sources)?.added), saves: num(recent.commits), since: str(recent.since) ?? "" } } : {}),
  };
  if (actsAsArchive(tree)) return { ...base, now: [], runs: [], lines: [], waiting: { n: 0, items: [] }, people };

  const lines: GlanceLine[] = from.researches.flatMap((x): GlanceLine[] => {
    const r = obj(x);
    const id = str(r?.id);
    if (!r || !id) return [];
    const n = num(r.order);
    const focus = named(r.focus);
    const reason = forPhone(str(r.reason) ?? "");
    return [
      {
        id,
        n,
        name: forPhone(str(r.name) ?? "") || String(n),
        direction: r.direction as Research["direction"],
        way: wayOf(r.direction),
        state: r.state as Research["state"],
        tasks: num(r.tasks),
        waiting: num(r.waiting),
        working: r.working === true,
        since: str(r.since) ?? "",
        ...(focus ? { focus } : {}),
        ...(reason ? { reason } : {}),
      },
    ];
  });
  const lineWay = new Map(lines.map((l) => [l.id, l.way]));

  const working = Array.isArray(s.working) ? s.working.map(obj).filter((w): w is Obj => !!w) : [];
  const now = working.map((w): GlanceNow => {
    // the task by its session (working[] says its title alone)
    const sid = str(w.session);
    const session = sid ? tree.get<Session>(sid) : undefined;
    const taskId = session?.type === "session" ? session.task : undefined;
    const task = taskId ? tree.get<Task>(taskId) : undefined;
    const text = said(tree, task?.type === "task" ? task.what : w.task);
    const line = str(w.research);
    const person = named(w.person);
    const family = str(w.family);
    return {
      since: str(w.since) ?? "",
      ...pausedOf(w.paused),
      ...(line ? { line } : {}),
      way: line ? (lineWay.get(line) ?? "other") : "other",
      ...(taskId && text ? { task: { id: taskId, text } } : {}),
      ...(person ? { person } : {}),
      ...(family ? { family } : {}),
      ...(str(w.run) ? { run: str(w.run)! } : {}),
    };
  });
  const lastWorked = now.length ? undefined : tree.list<Session>("session").map((x) => x.ended ?? x.started).sort().at(-1);

  const items = from.waiting.map(obj).filter((w): w is Obj => !!w);
  const waiting = items.slice(0, GLANCE_WAITING).map((w): GlanceWaiting => {
    const group = obj(w.group) ?? {};
    const person = named(w.person);
    const line = str(w.research);
    const retry = obj(w.retry);
    const on = said(tree, w.on);
    const hyp = w.kind === "hypothesis" && typeof w.id === "string" ? tree.get<Hypothesis>(w.id) : undefined;
    const proposal = hyp?.type === "hypothesis" ? hyp.proposal : undefined;
    return {
      id: String(w.id ?? ""),
      kind: String(w.kind ?? "other"),
      section: String(w.section ?? "other"),
      phase: w.phase === "sent" ? "sent" : "todo",
      what: said(tree, w.what) || forPhone(String(w.what ?? "")),
      ...(on ? { on } : {}),
      at: str(w.at) ?? "",
      ...(str(w.sentAt) ? { sentAt: str(w.sentAt)! } : {}),
      group: { key: str(group.key) ?? "other", name: forPhone(str(group.name) ?? ""), kind: str(group.kind) ?? "other", ...(str(group.url) && /^https?:\/\//iu.test(str(group.url)!) ? { url: str(group.url)! } : {}) },
      ...(person ? { person } : {}),
      ...(line ? { line } : {}),
      ...(str(w.branch) ? { branch: str(w.branch)! } : {}),
      ...(retry && typeof retry.can === "boolean" ? { retry: { can: retry.can, ...(str(retry.until) ? { until: str(retry.until)! } : {}), says: forPhone(str(retry.says) ?? ""), ...(Number.isInteger(retry.images) && (retry.images as number) > 0 ? { n: retry.images as number } : {}) } } : {}),
      ...(hyp?.type === "hypothesis"
        ? {
            hypothesis: {
              variants: hyp.variants.map((v) => ({ label: v.label, claim: said(tree, v.claim) })),
              ...(proposal ? { proposal: { ...(proposal.variant ? { variant: proposal.variant } : {}), ...(proposal.abandon ? { abandon: true as const } : {}), decision: said(tree, proposal.decision) } } : {}),
              ...(w.pick === true ? { pick: true as const } : {}),
            },
          }
        : {}),
      do: glanceDo(w),
    };
  });
  return {
    ...base,
    now,
    runs: [],
    ...(lastWorked ? { lastWorked } : {}),
    lines,
    waiting: { n: items.length, items: waiting },
    people,
  };
}

/** The glance with the runs at work now (spec 126: read at each ask, never kept); a run at work: nobody worked "last". */
export function withRuns(g: Glance, runs: readonly RunView[]): Glance {
  if (!runs.length || g.locked) return g;
  const way = new Map(g.lines.map((l) => [l.id, l.way]));
  const { lastWorked: _, ...rest } = g;
  return {
    ...rest,
    runs: runs.map((r): GlanceRun => ({
      id: r.id,
      line: r.research,
      way: r.research ? (way.get(r.research) ?? "other") : "other",
      since: r.since,
      state: r.state,
      ...pausedOf(r.paused),
      ...(r.task ? { task: r.task } : {}),
      ...(r.device ? { device: { id: r.device.id, ...(r.device.name ? { name: r.device.name } : {}) } } : {}),
    })),
  };
}

/**
 * The glance with what waits for the person at the computer now (spec 094 K3.15: read at each ask, as the runs, never
 * kept) — each run asking marked too. Only where the agent researches (an archive, a research waiting for its agent:
 * nothing of it), never of a research a newer strom wrote.
 */
export function withAsking(g: Glance, asking: readonly Asking[]): Glance {
  if (!asking.length || g.locked || g.tree.state !== "research") return g;
  return {
    ...g,
    onComputer: asking.map((a) => ({ ...a })),
    runs: g.runs.map((r) => {
      const a = asking.find((x) => x.run === r.id);
      return a ? { ...r, onComputer: { kind: a.kind, since: a.since } } : r;
    }),
  };
}

/** A research a newer strom wrote (/status locked): its name and why, nothing of it opened. */
export function glanceLocked(status: Record<string, unknown>): Glance {
  const t = obj(status.tree) ?? {};
  return {
    head: "",
    tree: { id: str(t.id) ?? "", name: str(t.name) ?? "", lang: str(t.lang) ?? "en", state: "research", persons: 0, families: 0 },
    locked: { code: str(obj(status.locked)?.code) ?? "tree.newer" },
    now: [],
    runs: [],
    lines: [],
    waiting: { n: 0, items: [] },
    people: {},
  };
}
