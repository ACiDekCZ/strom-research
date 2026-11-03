// The order of the task queue. A research spreads out: the nearest ancestors
// first, but no line takes every session — a line that just had sessions waits
// while the others get theirs, a task tried again and again sinks instead of
// being taken forever, and work that needs a download comes after what can be
// done now. The stories of the ancestors come after all the research — also
// after work that waits for a download: they are never what a session is
// spent on instead of the research. Working alone (strom run) they still get
// their turn: after STORY_EVERY sessions without one, a story first. In a
// conversation the user leads, and a story is written when they want it. Work
// about people nothing links to the tree waits until the user asks for it or a
// hypothesis joins them (core/kin.ts offTree). A task to say what the variants of hypotheses would connect comes first
// (core/hypolinks.ts linksFirst): short work, and the Strom app shows the variants "not linked yet" until it is done.
// Work that needs images of an archive whose images wait for the person's decision waits for it (core/archivewait.ts):
// a session spent on it finds nothing and asks again. Work whose archive strom leaves alone for a while (it went
// silent, or asked to slow down: core/leftalone.ts) waits until it takes requests again — a session on it would only be
// told so. The tasks of history (the experiment experiments.history, core/pastevents.ts: the places of the facts mapped
// to regions, a region's events) come after everything — after the stories and the work that waits for a download —
// except at history's turn (experiments.historyPace, core/pastevents.ts historyTurn: now and then by chance between
// the sessions of the family research), when one of them comes first — the one a recent session made needed first —,
// and only where they are asked for (`history`: strom run, strom task next --history): in a conversation the user
// leads, and the agent never takes one by itself. Out of the queue while the experiment is off, in an archive, or
// while another tree builds the region's catalog (core/pastevents.ts historyHeld). Strategies (setting
// queue.strategy): balanced (the default), depth (stay on the line of the last sessions), priority (strict priority).
// Work off the lines of a research with several (core/offline.ts: a side branch no line reaches, helping none) comes as
// the person chose, on three floors, the lower winning — the task (strom task order: next — before everything but the
// work at hand, once; last — after everything), its branch (strom offline set), the tree (queue.offLine) —, whatever
// the strategy: occasional (the default) — after the lines' work, but after OFF_LINE_SHARE − 1 sessions since the last
// one off the lines one comes forward, the nearest to a line, then the cheapest; at once when the lines have nothing to
// do —; last — after all the lines' work, also after their stories and what waits for a download, before the tasks of
// history —; normal — as the lines' work; never — out of the queue (nothing deleted). A task that helps a line goes with
// that line (a branch added to a line too). A session at work on it goes on. Nothing is kept for the turn: it is counted
// from the sessions.

import type { OffLine, Research, Session, Strategy, Task } from "./model.ts";
import { parentsOf } from "./people.ts";
import { taskRecordsets } from "./frontier.ts";
import { now, type Tree } from "./tree.ts";
import { aboutPeople, directionOf, scopes } from "./directions.ts";
import { workOrder } from "./order.ts";
import { offTree } from "./kin.ts";
import { forStory } from "./stories.ts";
import { HYPOTHESIS_LINKS_TRIES, linksFirst } from "./hypolinks.ts";
import { setsWithImages } from "./mediaindex.ts";
import { heldOn, permissionQuestions } from "./archivewait.ts";
import type { PendingQuestion } from "./terms.ts";
import { asleepHosts, asleepOn, type Asleep } from "./leftalone.ts";
import { forHistory, HISTORY_PLACES_ORIGIN, historyHeld, historyOrder, historyTurn, type HistoryTurn } from "./pastevents.ts";
import { Settings } from "./config.ts";
import { personQueued, placesFirst } from "./placeid.ts";
import { branchModeOf, placer, readOffline, type Placed } from "./offline.ts";

export const LEVEL_ORDER: Record<string, number> = { intake: 0, locate: 1, link: 2, verify: 3, enrich: 4, request: 5, narrate: 6 };

/** Levels that read records: without images of their record sets they can only ask the user for them. */
const NEEDS_IMAGES = new Set(["link", "verify"]);

/** How many of the last sessions count as "recent" when spreading the work over the lines. */
const RECENT = 4;

/** Sessions without a story after which a story waiting to be written comes first, once. */
export const STORY_EVERY = 5;

/** A generation for work about no ancestor (a sibling, a side line, a book): after the close ancestors. */
const OFF_LINE_GENERATION = 4;

/** Why a task stands where it does, for the app: the person's own choice, its line, the line it helps, off the lines, its line paused. */
export type Reason =
  | { kind: "own"; do: "next" | "last" }
  | { kind: "line"; research: string }
  | { kind: "helps"; research?: string; by: NonNullable<Placed["helps"]> }
  | { kind: "off"; mode: "occasional" | "last" | "normal"; branch?: string }
  | { kind: "paused"; research: string };

export interface Ranked {
  task: Task;
  /** Why it stands where it does, in a few words. */
  why: string;
  /** The same for a program; none for a task about nobody. */
  reason?: Reason;
  /** Off the lines, helping none: how it is taken (occasional, last; nothing while taken as the lines' work). */
  offLine?: OffLine;
  /** It belongs to no line but helps this one (or the tree, when the line is not known): how. */
  helps?: { by: NonNullable<Placed["helps"]>; research?: string };
  /** Its branch off the lines (B-P…), also when added to a line. */
  branch?: string;
  /** The person's own choice for it (strom task order). */
  own?: "next" | "last";
  /** Off the lines, taken now and then: this one's turn has come (it stands before the lines' work). */
  turn?: true;
}

/**
 * The person's own choice of a task's turn as it holds now: "next" only until a session on it ends after it was chosen
 * (strom closes it then; a session ended by an older strom counts too).
 */
export function ownTurn(t: Task, ended: Pick<Session, "task" | "ended" | "updated">[]): "next" | "last" | undefined {
  const q = t.queueAt;
  if (!q) return undefined;
  if (q.do === "last") return "last";
  return ended.some((s) => s.task === t.id && (s.ended ?? s.updated) > q.at) ? undefined : "next";
}

/**
 * An open task whose images wait for the person's decision about an archive: it needs images none of its record sets
 * has, and every record set of it with an address lies on a host with a question that waits (core/archivewait.ts) —
 * the question, else undefined. Out of the queue until the person decides.
 */
export function waitsForDecision(tree: Tree, qs: PendingQuestion[] = permissionQuestions(tree.env), withImages?: Set<string | undefined>): (t: Task) => PendingQuestion | undefined {
  if (!qs.length) return () => undefined;
  let sets = withImages;
  return (t) => {
    if (!NEEDS_IMAGES.has(t.level)) return undefined;
    sets ??= setsWithImages(tree);
    return lacksImages(tree, t, sets) ? heldOn(tree, t, qs) : undefined;
  };
}

/** Levels whose work asks an archive for its images or its indexes (the user's material, a request, a story: none). */
const ASKS_ARCHIVE = new Set(["locate", "link", "verify", "enrich"]);

/**
 * An open task whose archive strom leaves alone now (core/leftalone.ts): its level asks an archive, every record set of
 * it with an address lies on a host left alone, and — reading records (link, verify) — none of them has images here
 * yet: the host and until when (the task back in the queue then), else undefined. Nothing written: computed afresh.
 */
export function waitsForArchive(tree: Tree, asleep: Asleep[] = asleepHosts(tree), withImages?: Set<string | undefined>): (t: Task) => Asleep | undefined {
  if (!asleep.length) return () => undefined;
  let sets = withImages;
  return (t) => {
    if (!ASKS_ARCHIVE.has(t.level)) return undefined;
    if (NEEDS_IMAGES.has(t.level)) {
      sets ??= setsWithImages(tree);
      if (!lacksImages(tree, t, sets)) return undefined; // its images here: it reads them
    }
    return asleepOn(tree, t, asleep);
  };
}

/** A task that needs images none of its record sets has yet. */
export function lacksImages(tree: Tree, t: Task, withImages: Set<string | undefined> = setsWithImages(tree)): boolean {
  return NEEDS_IMAGES.has(t.level) && !taskRecordsets(tree, t).sets.some((b) => withImages.has(b.id));
}

export function effectiveState(t: Task, today: string): Task["state"] {
  if (t.state === "parked" && t.parkedUntil && t.parkedUntil <= today) return "open";
  return t.state;
}

/**
 * Every ancestor of the focus with its generation and its line: the focus, each
 * parent and each grandparent are lines of their own; everyone further back
 * belongs to the line of the grandparent they descend through.
 */
export function ancestorLines(tree: Tree, focus: string, max = 50): Map<string, { gen: number; line: string }> {
  const out = new Map([[focus, { gen: 1, line: focus }]]);
  let current = [focus];
  for (let g = 2; g <= max && current.length; g++) {
    const next: string[] = [];
    for (const id of current)
      for (const p of parentsOf(tree, id))
        if (!out.has(p.id)) {
          out.set(p.id, { gen: g, line: g <= 3 ? p.id : out.get(id)!.line });
          next.push(p.id);
        }
    current = next;
  }
  return out;
}

/**
 * The open tasks in the order to work on them, each with the reason. `awake`: as if every archive left alone took
 * requests again (strom run asks what would come then). `history`: the tasks of history too (strom run, or asked for by
 * name: strom task next --history) — never otherwise.
 */
export function rankTasks(tree: Tree, tasks: Task[], strategy: Strategy = "balanced", opts: { storyTurn?: boolean; awake?: boolean; history?: boolean | "only"; turn?: HistoryTurn; offLine?: OffLine } = {}): Ranked[] {
  const today = now().slice(0, 10);
  const researches = tree.list<Research>("research");
  // a direction the user paused or ended: its tasks wait (one at work goes on)
  const stopped = new Set(researches.filter((r) => r.state !== "active").map((r) => r.id));
  const all = scopes(tree);
  // where each task stands among the lines: its own, the one it helps, or off them (core/offline.ts)
  const placeOf = placer(tree, all);
  const placed = new Map<string, Placed>();
  const placing = (t: Task) => placed.get(t.id) ?? (placed.set(t.id, placeOf(t)), placed.get(t.id)!);
  // work about people nothing links to the tree waits for the user or for the hypothesis that joins them (core/kin.ts)
  const off = offTree(tree);
  const withImages = setsWithImages(tree);
  // work whose images wait for the person's decision about an archive: a session on it would only ask again
  const decision = waitsForDecision(tree, permissionQuestions(tree.env), withImages);
  // work whose archive is left alone for a while (silent, slow down): a session on it would only be told so
  const asleep = opts.awake ? () => undefined : waitsForArchive(tree, asleepHosts(tree), withImages);
  // work off the lines: as the person chose for the task, its branch, the tree (one at work goes on)
  const settings = new Settings(tree.env, {});
  const offLine = opts.offLine ?? settings.offLine(tree.config);
  const share = settings.offLineShare(tree.config);
  const choices = readOffline(tree);
  const ended = tree
    .list<Session>("session")
    .filter((s) => s.state !== "open" && s.task)
    .sort((a, b) => (b.ended ?? b.updated).localeCompare(a.ended ?? a.updated));
  const own = (t: Task) => (t.state === "doing" ? undefined : ownTurn(t, ended));
  /** How a task off the lines is taken (undefined: it is not off them). */
  const modeOf = (t: Task) => {
    const p = placing(t);
    return p.off ? branchModeOf(choices, offLine, p.branch).mode : undefined;
  };
  // a task that helps a line waits with it while it is paused or ended; the person's own turn takes one off the lines
  const waits = (t: Task) =>
    t.state !== "doing" &&
    ((stopped.size > 0 && stopped.has(directionOf(tree, t, all) ?? placing(t).research ?? "")) || off(t) || !!decision(t) || !!asleep(t) || (modeOf(t) === "never" && !own(t)));
  // the tasks of history: only where asked for, and not while the experiment is off, in an archive, or held by another tree
  let held: ((t: Task) => string | undefined) | undefined;
  const history = (t: Task) => {
    if (!opts.history) return false;
    held ??= historyHeld(tree, settings.shared()?.value, settings);
    return !held(t);
  };
  // "only": the tasks of history alone, in their order whatever the pace (strom run --history, the person's word)
  const open = tasks.filter((t) => ["open", "doing"].includes(effectiveState(t, today)) && (forHistory(t) ? history(t) : opts.history !== "only" && !waits(t)));
  const lines = new Map<string, Map<string, { gen: number; line: string }>>();
  const linesOf = (researchId: string | undefined) => {
    const r = researches.find((x) => x.id === researchId) ?? (researches.length === 1 ? researches[0] : undefined);
    if (!r || r.direction !== "ancestors") return undefined;
    if (!lines.has(r.id)) lines.set(r.id, ancestorLines(tree, r.focus));
    return lines.get(r.id);
  };
  /** The nearest ancestor a task is about: its generation and line. */
  const place = (t: Task) => {
    // a task of no research of its own: the direction its people are in (directions.ts), as the menu and the app say
    const map = linesOf(t.research ?? directionOf(tree, t, all));
    // a family's task: its partners' (a couple's story)
    const found = [...t.subject, ...aboutPeople(tree, t.subject)].map((s) => map?.get(s)).filter((x): x is { gen: number; line: string } => !!x);
    return found.sort((a, b) => a.gen - b.gen)[0];
  };
  // the order of work of the lines (core/order.ts): a weight for balanced and depth (the first active line +2, the
  // last 0), strictly one line after another for priority; a task goes with the line it belongs to or helps
  const working = workOrder(researches.filter((r) => r.state === "active" && !r.retracted));
  const linePlace = new Map(working.map((r, i) => [r.id, i]));
  const lineBonus = (i: number | undefined) => (i === undefined || working.length < 2 ? 0 : (2 * (working.length - 1 - i)) / (working.length - 1));
  const tasksById = new Map(tree.list<Task>("task").map((t) => [t.id, t]));
  const recentLines = ended.slice(0, RECENT).map((s) => {
    const t = tasksById.get(s.task!);
    return t ? (place(t)?.line ?? `task:${t.id}`) : undefined;
  });
  // A story's turn: STORY_EVERY sessions since the last one on a story (or ever), and one waits.
  const sinceStory = ended.findIndex((s) => {
    const t = tasksById.get(s.task!);
    return !!t && forStory(t);
  });
  const storyDue = !!opts.storyTurn && strategy !== "priority" && (sinceStory === -1 ? ended.length : sinceStory) >= STORY_EVERY;
  // the places to map: before the research whenever one is open (a small step the regions need); a region's turn
  // (experiments.historyPace): its first task before the research, once in a while
  let turn = opts.turn;
  const histOrder = () => historyOrder((turn ??= historyTurn(tree, settings.shared()?.value, settings)));
  const histTasks = opts.history ? open.filter(forHistory) : [];
  const order = histTasks.length ? histOrder() : () => 0;
  const firstOfHistory = [...histTasks].sort((a, b) => order(a) - order(b) || a.created.localeCompare(b.created))[0];
  // the places to map and a place whose history the person asked for: the next session's, whatever the pace
  const turnTask =
    firstOfHistory && (firstOfHistory.origin === HISTORY_PLACES_ORIGIN || turn?.placeAsked?.task === firstOfHistory.id || turn?.now || opts.history === "only") ? firstOfHistory.id : undefined;
  let asked: boolean | undefined;
  const tries = new Map<string, number>();
  for (const s of ended) tries.set(s.task!, (tries.get(s.task!) ?? 0) + 1);
  // occasional: the sessions since the last one off the lines; at OFF_LINE_SHARE − 1 one of them comes forward — the
  // nearest to a line, then the cheapest (its level, fewer tries)
  const lastOff = ended.findIndex((s) => {
    const t = tasksById.get(s.task!);
    return !!t && !forHistory(t) && !!placing(t).off;
  });
  const sinceOff = lastOff === -1 ? ended.length : lastOff;
  const forward =
    sinceOff >= share - 1
      ? open
          .filter((t) => t.state !== "doing" && !forHistory(t) && modeOf(t) === "occasional" && !own(t))
          .sort(
            (a, b) =>
              (placing(a).dist ?? 99) - (placing(b).dist ?? 99) ||
              (LEVEL_ORDER[a.level] ?? 9) - (LEVEL_ORDER[b.level] ?? 9) ||
              (tries.get(a.id) ?? 0) - (tries.get(b.id) ?? 0) ||
              a.created.localeCompare(b.created),
          )[0]?.id
      : undefined;

  const rows = open.map((t) => {
    const hist = forHistory(t);
    const p = hist ? {} : placing(t);
    const lineAt = p.research !== undefined ? linePlace.get(p.research) : undefined;
    const at = place(t);
    const gen = at?.gen ?? OFF_LINE_GENERATION;
    const line = at?.line ?? `task:${t.id}`;
    const recent = recentLines.filter((l) => l === line).length;
    const tried = tries.get(t.id) ?? 0;
    const intake = t.level === "intake" ? 3 : 0;
    const score =
      strategy === "depth"
        ? 2 * t.priority + intake + 2 * recent - 0.5 * (gen - 1) - 1.5 * tried + lineBonus(lineAt)
        : strategy === "priority"
          ? 0
          : 2 * t.priority + intake - (gen - 1) - 2 * recent - 1.5 * tried + lineBonus(lineAt);
    const blocked = lacksImages(tree, t, withImages);
    const storyTurn = storyDue && forStory(t);
    // what the variants of hypotheses would connect: short work the Strom app waits for — before all else (core/hypolinks.ts)
    const first = linksFirst(t, tried);
    // the places the person asked to be identified (the app, a link, the terminal): on top of the research's queue
    const placesAsked = !first && placesFirst(t, () => (asked ??= personQueued(tree)));
    const mine = hist ? undefined : own(t);
    const mode = hist ? undefined : modeOf(t);
    const ahead = t.id === forward;
    // off the lines: forward at its turn (occasional), after the lines' work (occasional, last), in its place (normal)
    const offRank = t.state === "doing" || !mode || mode === "normal" ? 0 : ahead ? -1 : 1;
    const branch = p.branch ? ` (branch ${p.branch})` : "";
    const why = [
      t.state === "doing" ? "in progress" : undefined,
      mine === "next" ? "the person's choice: next, once" : mine === "last" ? "the person's choice: at the end" : undefined,
      mode === "occasional"
        ? ahead
          ? `off the lines${branch}: its turn, ${sinceOff} sessions since the last one off them (queue.offLineShare ${share}; nearest to a line first)`
          : `off the lines${branch}, helping none: after the lines' work, one in ${share} sessions (queue.offLine occasional; how it helps a line: strom task edit --helps)`
        : mode === "last"
          ? `off the lines${branch}, helping none: after the lines' work (offLine last; how it helps a line: strom task edit --helps)`
          : mode === "never"
            ? `off the lines${branch}: not researched, but the person's choice takes it`
            : mode === "normal"
              ? `off the lines${branch}: as the lines' work (offLine normal)`
              : undefined,
      p.helps
        ? `helps ${p.research ?? "the tree"}: ${
            p.helps === "question"
              ? "a hypothesis or conflict of the line"
              : p.helps === "joins"
                ? "it would join people to the tree"
                : p.helps === "partner"
                  ? "the partner of a person of the line"
                  : p.helps === "branch"
                    ? `its branch ${p.branch} was added to the line`
                    : "the agent's reason (--helps)"
          }`
        : undefined,
      hist ? historyWhy(turn!, t, t.id === turnTask, t.id === firstOfHistory?.id) : undefined,
      first ? `the hypotheses' links first: short, the Strom app waits for them (until tried ${HYPOTHESIS_LINKS_TRIES}×)` : undefined,
      placesAsked ? "places the person asked to be identified: on top of the queue" : undefined,
      storyTurn ? `a story's turn: none in the last ${STORY_EVERY} sessions` : undefined,
      blocked ? "needs images the user has to download" : undefined,
      `p${t.priority}`,
      t.level === "intake" ? "the user's material" : at ? `generation ${gen}` : "not about an ancestor",
      lineAt !== undefined && working.length > 1 ? `line ${lineAt + 1} of ${working.length}` : undefined,
      recent ? `its line had ${recent} of the last ${RECENT} sessions` : undefined,
      tried ? `tried ${tried}×` : undefined,
    ]
      .filter(Boolean)
      .join(" · ");
    const lineOwn = hist ? undefined : (directionOf(tree, t, all) ?? p.research);
    const reason: Reason | undefined = mine
      ? { kind: "own", do: mine }
      : lineOwn && stopped.has(lineOwn)
        ? { kind: "paused", research: lineOwn }
        : p.helps
          ? { kind: "helps", ...(p.research ? { research: p.research } : {}), by: p.helps }
          : p.off
            ? { kind: "off", mode: mode === "never" || !mode ? offLine === "never" ? "last" : offLine : mode, ...(p.branch ? { branch: p.branch } : {}) }
            : p.research
              ? { kind: "line", research: p.research }
              : undefined;
    const extra = {
      ...(reason ? { reason } : {}),
      ...(mode && mode !== "normal" ? { offLine: mode } : {}),
      ...(p.helps ? { helps: { by: p.helps, ...(p.research ? { research: p.research } : {}) } } : {}),
      ...(p.branch ? { branch: p.branch } : {}),
      ...(mine ? { own: mine } : {}),
      ...(ahead ? { turn: true as const } : {}),
    };
    return { task: t, why, extra, own: mine === "next" ? -1 : mine === "last" ? 1 : 0, nextAt: mine === "next" ? t.queueAt!.at : "", offLine: offRank, doing: t.state === "doing" ? 0 : 1, hist: !hist ? 0 : t.id === turnTask ? -1 : 1, horder: hist ? order(t) : 0, first: first || placesAsked ? 0 : 1, blocked: blocked ? 1 : 0, story: storyTurn ? 0 : forStory(t) ? 2 : 1, score, gen, lineRank: lineAt ?? working.length };
  });
  return rows
    .sort(
      (a, b) =>
        a.doing - b.doing ||
        // the person's own turn: next before everything but the work at hand (the first chosen first), last after everything
        a.own - b.own ||
        a.nextAt.localeCompare(b.nextAt) ||
        // the tasks of history after everything — but at history's turn its first one before all — the needed one first
        a.hist - b.hist ||
        a.horder - b.horder ||
        // work off the lines: one at its turn forward, the rest after all the lines' work, whatever the strategy
        a.offLine - b.offLine ||
        // the links of hypothesis variants before the research and a story's turn
        a.first - b.first ||
        // a story's turn first (working alone); otherwise the stories after all the research
        a.story - b.story ||
        // work that can be done now comes before work that waits for the user's download
        a.blocked - b.blocked ||
        // priority: strictly the lines' order of work, the tasks of no line after them
        (strategy === "priority" ? a.lineRank - b.lineRank || b.task.priority - a.task.priority || a.gen - b.gen : b.score - a.score) ||
        (LEVEL_ORDER[a.task.level] ?? 9) - (LEVEL_ORDER[b.task.level] ?? 9) ||
        a.task.created.localeCompare(b.task.created),
    )
    .map(({ task, why, extra }) => ({ task, why, ...extra }));
}

/** Why a task of history stands where it does: history's turn now, when it comes, the place that put it first. */
function historyWhy(turn: HistoryTurn, t: Task, now: boolean, first: boolean): string {
  if (t.origin === HISTORY_PLACES_ORIGIN) return "the places of the facts to map: before the research whatever the pace — a small step the regions need";
  if (turn.placeAsked?.task === t.id) return `the history of ${turn.placeAsked.place} and its surroundings, asked for by the person: before the research whatever the pace`;
  const pace = `pace ${turn.pace}`;
  const prefer = first && turn.prefer ? ` · first of history: a recent session worked at ${turn.prefer.place}` : "";
  if (now) return `history's turn: ${turn.since} sessions since its last (${pace})${prefer}`;
  if (turn.pace === "idle" || turn.in === undefined) return `the history of the places: after all the research (${pace})${prefer}`;
  return `the history of the places: after the research, its turn in ~${turn.in} sessions (${pace})${prefer}`;
}
