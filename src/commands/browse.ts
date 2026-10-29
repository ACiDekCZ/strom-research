// stats · pedigree · person card · recent · plan — the tree as a person looks through
// it (the guided menu's "Look through the family tree"), in the research
// language. Read only; --json gives the same for a program.

import { changeLines } from "../core/changelog.ts";
import { register } from "../cli/registry.ts";
import type { Context } from "../cli/context.ts";
import { lines, table, truncate } from "../cli/format.ts";
import { ui } from "../cli/ui.ts";
import { eventName, generationName, humanCost, humanDate, humanDay, humanPlace, statusName } from "../cli/human.ts";
import { UsageError } from "../core/errors.ts";
import { mainPerson } from "../core/kin.ts";
import { resolvePerson } from "../core/people.ts";
import { knownGenerations, ownerName, pedigree, personCard, recent, treeStats, type CardFact, type PedigreeNode, type Who } from "../core/overview.ts";
import type { Tree } from "../core/tree.ts";
import type { Family, Person, RecordSet, Session, Source, Task } from "../core/model.ts";
import { displayName } from "../core/people.ts";
import { humanTask } from "../cli/human.ts";
export { humanTask };
import { lacksImages, waitsForArchive } from "../core/queue.ts";
import { clockUp } from "../core/net.ts";
import { forStory } from "../core/stories.ts";
import { forGaps, forHistory, gapsOfTask, gapText, HISTORY_PLACES_ORIGIN, historyOn, historyTurn, readCatalog, regionName, regionOfTask, regionPeriod, searchedSpans, type HistoryTurn } from "../core/pastevents.ts";
import { isArchive } from "../core/mode.ts";
import { actsAsArchive, stateOf } from "../core/state.ts";
import { rankedQueue } from "./tasks.ts";
import { waitingHere } from "../cli/menu-waiting.ts";
import { waitingLine } from "../core/waiting.ts";
import { readTuneLog, type TuneLogEntry } from "../core/tune.ts";
import { calibrationLabel } from "../core/viewsizes.ts";
import type { UIKey } from "../cli/ui.ts";

/** A change strom made by itself in the reading of scans, as a person reads it in strom recent. */
function tuneLine(e: TuneLogEntry, lang: string): string {
  const t = (k: UIKey, v: Record<string, string | number> = {}) => ui(lang, k, v);
  const scope = e.scope === "key" ? calibrationLabel(e.key, t("ui.settings.model.own")) : e.scope.replace(/^(book|host):/, "");
  // a change of several values said by its first (A2: the batch, A3: the stop)
  const one = (v: unknown) => String(v && typeof v === "object" ? Object.values(v)[0] : v);
  const what = t(`ui.tune.what.${e.what}` as UIKey);
  const text =
    e.action === "A6"
      ? t("ui.tune.back", { scope, what })
      : e.action === "restart"
        ? t("ui.tune.restart", { scope, what, model: String(e.basis?.model ?? "") })
        : t(`ui.tune.rec.${e.action}` as UIKey, { scope, from: one(e.from), to: one(e.to) });
  return `  ${humanDay(e.at, lang)} – ${text.trim()}`;
}

/** Most rows a section of `recent` lists; the rest is counted. */
const RECENT_ROWS = 15;

/** A person as the user reads them, with the ID to name them by later ("strom review P0012", the agent). */
function whoText(w: Who): string {
  return `${w.years ? `${w.name} (${w.years})` : w.name} [${w.id}]`;
}

/** The person asked for, else the main person of the tree. */
function personOrMain(tree: Tree, ref: string | undefined): string {
  if (ref) return resolvePerson(tree, ref).id;
  const main = mainPerson(tree);
  if (!main) throw new UsageError("this tree has no research yet, so no main person", { hint: 'name one: strom pedigree "<name>"' });
  return main;
}

function positive(value: unknown, name: string, fallback: number, max: number): number {
  if (value === undefined) return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > max) throw new UsageError(`--${name} must be a whole number from 1 to ${max}`);
  return n;
}

/**
 * A fact as a person reads it: "25. 6. 1905, Týnec nad Labem č. 12 · doloženo — Křest Jana Nováka 1905". In an archive
 * what the person entered is their word, never "only a lead" (found on Mac: every fact from the app so); what a record
 * proves still says so.
 */
function factText(f: CardFact, lang: string, archive = false): string {
  const core = [f.value, humanDate(f.date, lang), humanPlace(f.place, f.house, lang), f.cause].filter(Boolean).join(", ");
  const sure = archive && f.status === "lead" ? "" : statusName(f.status, lang);
  return `${[core, sure].filter(Boolean).join(" · ")}${f.source ? ` — ${truncate(f.source, 70)}` : ""}`;
}

function factRows(facts: CardFact[], lang: string, indent: string, archive = false): string {
  return table(facts.map((f) => [`${indent}${eventName(f.kind, lang, f.label)}`, factText(f, lang, archive)]));
}

function drawPedigree(root: PedigreeNode, lang: string): string[] {
  const label = (n: PedigreeNode) =>
    `${whoText(n.person!)}${n.person!.proven ? " ✓" : ""}${n.seen ? ` ${ui(lang, "ui.ped.seen")}` : ""}`;
  const out = [label(root)];
  const walk = (n: PedigreeNode, prefix: string) => {
    if (!n.father || !n.mother) return;
    if (!n.father.person && !n.mother.person) {
      out.push(`${prefix}└─ ? ${ui(lang, "ui.ped.noparents")}`);
      return;
    }
    const parents: [PedigreeNode, "ui.ped.nofather" | "ui.ped.nomother"][] = [[n.father, "ui.ped.nofather"], [n.mother, "ui.ped.nomother"]];
    parents.forEach(([p, missing], i) => {
      const last = i === parents.length - 1;
      out.push(`${prefix}${last ? "└─ " : "├─ "}${p.person ? label(p) : `? ${ui(lang, missing)}`}`);
      if (p.person) walk(p, prefix + (last ? "   " : "│  "));
    });
  };
  walk(root, "");
  return out;
}

function more(n: number, lang: string): string | undefined {
  return n > 0 ? `  ${ui(lang, "ui.recent.more", { n })}` : undefined;
}

register(
  {
    path: ["stats"],
    summary: "The research at a glance: people, facts and how sure they are, the ancestors known in each generation, tasks, sessions and their cost",
    group: "analysis",
    tree: true,
    args: [{ name: "person", description: "whose ancestors to count (default: the main person of the tree)" }],
    examples: ["strom stats", 'strom stats "Jan Novák"'],
    run(ctx: Context, { args }) {
      const tree = ctx.tree();
      const lang = ctx.uiLang();
      const from = args[0] ? resolvePerson(tree, args[0]).id : mainPerson(tree);
      const s = treeStats(tree, from);
      const out: (string | undefined)[] = [
        ui(lang, "ui.stats.title", { name: tree.config.name }),
        ui(lang, "ui.stats.counts", { persons: s.persons, families: s.families, sources: s.sources, images: s.images, places: s.places }),
        ui(lang, "ui.stats.facts", s.facts),
      ];
      if (s.from) {
        out.push("", ui(lang, "ui.stats.from", { name: whoText(s.from) }));
        if (!s.generations.length) out.push(`  ${ui(lang, "ui.stats.noancestors")}`);
        else out.push(table(s.generations.map((g) => [`  ${generationName(g.generation, lang)}`, ui(lang, "ui.stats.gen", { known: g.known, expected: g.expected, proven: g.proven })])));
        if (s.oldest) out.push(ui(lang, "ui.stats.oldest", { name: whoText(s.oldest) }));
      }
      // an archive: nobody works on it — no tasks, no sessions said
      if (!actsAsArchive(tree)) out.push("", ui(lang, "ui.stats.tasks", s.tasks));
      if (s.sessions.count && !actsAsArchive(tree))
        out.push(
          ui(lang, "ui.stats.sessions", { n: s.sessions.count, last: humanDay(s.sessions.last!, lang) }) +
            (s.sessions.costUsd ? ui(lang, "ui.stats.cost", { cost: humanCost(s.sessions.costUsd, lang) }) : "") +
            (s.sessions.readersUsd ? ui(lang, "ui.stats.cost.readers", { cost: humanCost(s.sessions.readersUsd, lang) }) : "") +
            (s.sessions.costUsd && s.sessions.costPartial ? ui(lang, "ui.stats.cost.partial", { n: s.sessions.costPartial }) : ""),
        );
      if (s.stories.written) out.push(ui(lang, "ui.stats.stories", { n: s.stories.written }));
      return { text: lines(...out), data: s };
    },
  },
  {
    path: ["pedigree"],
    summary: "The ancestors of a person as a tree, father and mother at each step — who is known, whose birth a record proves, where it ends",
    group: "analysis",
    tree: true,
    args: [{ name: "person", description: "ID (P0001) or name (default: the main person of the tree)" }],
    options: [{ name: "generations", type: "string", value: "<n>", description: "how many generations, the person included (default 5, at most 12)" }],
    examples: ["strom pedigree", 'strom pedigree "Jan Novák" --generations 7'],
    run(ctx: Context, { args, opts }) {
      const tree = ctx.tree();
      const lang = ctx.uiLang();
      const id = personOrMain(tree, args[0]);
      const generations = positive(opts.generations, "generations", 5, 12);
      const root = pedigree(tree, id, generations);
      const known = knownGenerations(tree, id);
      return {
        text: lines(...drawPedigree(root, lang), "", ui(lang, "ui.ped.legend"), known > generations ? ui(lang, "ui.ped.more", { n: known, id }) : undefined),
        data: { generations, known, pedigree: root },
      };
    },
  },
  {
    path: ["person", "card"],
    summary: "One person for the family to read: their life, parents, marriages and children, each fact with how sure it is and its record — and their story",
    group: "people",
    tree: true,
    args: [{ name: "person", description: "ID (P0001) or name", required: true }],
    examples: ['strom person card "Jan Novák"', "strom person card P0001"],
    run(ctx: Context, { args }) {
      const tree = ctx.tree();
      const lang = ctx.uiLang();
      const c = personCard(tree, resolvePerson(tree, args[0]!));
      const out: (string | undefined)[] = [whoText(c.titled ? { ...c.person, name: c.titled } : c.person)];
      if (c.otherNames.length) out.push(`  ${ui(lang, "ui.card.also", { names: c.otherNames.join(", ") })}`);
      out.push(c.facts.length ? factRows(c.facts, lang, "  ", ctx.archiveHere()) : `  ${ui(lang, "ui.card.nofacts")}`, "");
      out.push(c.parents.length ? ui(lang, "ui.card.parents", { names: c.parents.map(whoText).join(", ") }) : ui(lang, "ui.card.noparents"));
      for (const f of c.families) {
        const key = f.partner?.sex === "F" ? "ui.card.wife" : f.partner?.sex === "M" ? "ui.card.husband" : c.sex === "M" ? "ui.card.wife" : c.sex === "F" ? "ui.card.husband" : "ui.card.partner";
        out.push(ui(lang, key, { name: f.partner ? whoText(f.partner) : ui(lang, "ui.card.unknown") }));
        if (f.facts.length) out.push(factRows(f.facts, lang, "  ", ctx.archiveHere()));
        if (f.children.length) out.push(`  ${ui(lang, "ui.card.children", { names: f.children.map(whoText).join(", ") })}`);
      }
      if (c.story) {
        const text = c.story.text.replace(/\*\*/g, "").trim();
        out.push("", ui(lang, "ui.card.story"));
        // markdown headings as plain lines
        out.push(text.split("\n").map((l) => (l.trim() ? `  ${l.trim().replace(/^#+\s*/, "")}` : "")).join("\n"));
      }
      return { text: lines(...out), data: c };
    },
  },
  {
    path: ["plan"],
    summary: "What the agent will do next, for the user: the first tasks of the queue in its order, what waits for scans, the stories after them",
    group: "tasks",
    tree: true,
    options: [{ name: "count", type: "string", value: "<n>", description: "how many tasks (default 10)" }],
    examples: ["strom plan", "strom plan --count 20"],
    run(ctx: Context, { opts }) {
      const tree = ctx.tree();
      const lang = ctx.uiLang();
      if (isArchive(tree)) return { text: ui(lang, "ui.plan.archive", { name: tree.config.name }), data: { archive: true, tasks: [] } };
      // its agent not on this computer: nothing planned until it is (the tasks stay where they are)
      if (stateOf(tree) === "waiting") return { text: ui(lang, "ui.plan.waitagent", { name: tree.config.name }), data: { waiting: true, tasks: [] } };
      const count = positive(opts.count, "count", 10, 200);
      // The order of a conversation (the story's turn is only for working alone).
      const queue = rankedQueue(tree, { strategy: ctx.settings.strategy(tree.config) }).map((r) => r.task);
      // the stories, with the searches beyond the registers before them
      const work = queue.filter((t) => !forStory(t));
      const stories = queue.filter(forStory);
      // what waits for the person: the menu's What waits, what of it is only here in the terminal said (core/waiting.ts)
      const waits = waitingHere(ctx, tree);
      const waiting = waits.length;
      const shown = work.slice(0, count);
      let n = 0;
      // put off for a while: their archive is not answering now (core/leftalone.ts) — back in the queue by themselves then
      const held = waitsForArchive(tree);
      const inQueue = new Set(queue.map((t) => t.id));
      const later = rankedQueue(tree, { strategy: ctx.settings.strategy(tree.config), awake: true })
        .map((r) => r.task)
        .filter((t) => !inQueue.has(t.id) && !forStory(t))
        .flatMap((t) => ((a) => (a ? [{ t, a }] : []))(held(t)));
      const rows = [
        ...shown.map((t) => [`  ${t.state === "doing" ? ui(lang, "ui.plan.now") : `${++n}.`}`, `${truncate(humanTask(tree, t.what, lang), 110)}${lacksImages(tree, t) ? ui(lang, "ui.plan.images") : ""}`]),
        ...later.slice(0, 5).map(({ t, a }) => [`  ${ui(lang, "ui.plan.later")}`, `${truncate(humanTask(tree, t.what, lang), 110)}${ui(lang, "ui.plan.asleep", { at: clockUp(a.until), host: a.host })}`]),
      ];
      const storyNames = [...new Set(stories.map((t) => tree.get<Person>(t.subject[0] ?? "")).filter((p): p is Person => !!p).map((p) => `${displayName(p)} [${p.id}]`))];
      const out: (string | undefined)[] = [ui(lang, "ui.plan.title", { name: tree.config.name })];
      if (!queue.length && !later.length) out.push(`  ${ui(lang, "ui.plan.none")}`);
      else {
        if (rows.length) out.push(table(rows));
        if (work.length > count) out.push(`  ${ui(lang, "ui.plan.more", { n: work.length - count })}`);
        if (stories.length) out.push(ui(lang, "ui.plan.stories", { n: stories.length, names: storyNames.join(", ") }));
      }
      // the history of the places (strom run's alone): when its next task comes, and why it goes first
      const history = historyPlan(ctx, tree);
      if (history) out.push(ui(lang, "ui.plan.history", { what: truncate(humanTask(tree, history.task.what, lang), 110), when: history.when }), ui(lang, "ui.plan.history.left", { n: history.left }));
      if (history?.regions.length)
        out.push(
          ui(lang, "ui.plan.history.order", {
            list: [
              ...history.regions
                .slice(0, HISTORY_REGIONS)
                .map((r) =>
                  r.gaps
                    ? ui(lang, r.added?.length ? "ui.plan.history.extend" : "ui.plan.history.gaps", { region: r.name, years: r.gaps.join(", "), n: r.persons })
                    : ui(lang, "ui.plan.history.weight", { region: r.name, period: r.period ?? "", n: r.persons }),
                ),
              ...(history.regions.length > HISTORY_REGIONS ? [`… (+${history.regions.length - HISTORY_REGIONS})`] : []),
            ].join(" · "),
          }),
        );
      if (waiting) out.push(waitingLine(lang, waits, "ui.plan.waiting"));
      if (queue.length) out.push("", ui(lang, "ui.plan.steer"));
      const item = (t: Task) => ({ id: t.id, what: humanTask(tree, t.what, lang), level: t.level, state: t.state, needsImages: lacksImages(tree, t) });
      return {
        text: lines(...out),
        data: { tasks: work.map(item), stories: stories.map(item), waiting, ...(history ? { history: { ...item(history.task), pace: history.turn.pace, now: history.turn.now, ...(history.turn.in !== undefined ? { in: history.turn.in } : {}), ...(history.prefer ? { prefer: history.prefer } : {}), ...(history.asked ? { asked: history.asked } : {}), regions: history.regions, left: history.left } } : {}), ...(later.length ? { later: later.map(({ t, a }) => ({ ...item(t), until: new Date(a.until).toISOString(), host: a.host })) } : {}) },
      };
    },
  },
  {
    path: ["recent"],
    summary: "What came in lately: new people, facts added or refined, records, stories, and what the agent did in its sessions",
    group: "analysis",
    tree: true,
    options: [{ name: "days", type: "string", value: "<n>", description: "how many days back (default 7)" }],
    examples: ["strom recent", "strom recent --days 30"],
    run(ctx: Context, { opts }) {
      const tree = ctx.tree();
      const lang = ctx.uiLang();
      const days = positive(opts.days, "days", 7, 3660);
      // never since before the tree began (found on Windows: "since 27. 9." in a tree made on 3. 10.)
      const back = new Date(Date.now() - days * 86_400_000).toISOString();
      const r = recent(tree, tree.config.created && tree.config.created > back ? tree.config.created : back);
      const since = humanDay(r.since, lang);
      const refined = r.facts.filter((f) => f.refined).length;
      // what strom set by itself in the reading of scans (core/tune.ts) — a line of the settings, never in an archive
      const tuning = ctx.archiveHere() ? [] : readTuneLog(tree.root).filter((e) => e.by === "selftune" && e.at >= r.since);
      // archives that refused strom's requests: the person hears it (op net.refused), in the research's language
      const refusals = changeLines(tree, tree.readOps().filter((o) => o.op === "net.refused" && o.at >= r.since), "", lang).map((l) => l.text).filter(Boolean);
      if (!r.persons.length && !r.facts.length && !r.sources.length && !r.stories.length && !r.sessions.length && !r.tasksDone && !tuning.length && !refusals.length)
        return { text: ui(lang, "ui.recent.nothing", { since }), data: { days, ...r } };
      const out: (string | undefined)[] = [
        ui(lang, "ui.recent.title", { since }),
        ui(lang, ctx.actsAsArchive() ? "ui.recent.counts.archive" : "ui.recent.counts", { persons: r.persons.length, facts: r.facts.length - refined, refined, sources: r.sources.length, stories: r.stories.length, done: r.tasksDone }),
      ];
      if (r.persons.length) out.push("", ui(lang, "ui.recent.persons"), ...r.persons.slice(0, RECENT_ROWS).map((p) => `  ${whoText(p)}`), more(r.persons.length - RECENT_ROWS, lang));
      if (r.facts.length)
        out.push(
          "",
          ui(lang, "ui.recent.facts"),
          ...r.facts.slice(0, RECENT_ROWS).map((f) => `  ${ownerName(tree, f.owner)} – ${eventName(f.fact.kind, lang, f.fact.label)}: ${factText(f.fact, lang, ctx.archiveHere())}${f.refined ? ` (${ui(lang, "ui.recent.refined")})` : ""}`),
          more(r.facts.length - RECENT_ROWS, lang),
        );
      if (r.stories.length) out.push("", ui(lang, "ui.recent.stories"), ...r.stories.map((p) => `  ${whoText(p)}`));
      if (r.sessions.length)
        out.push(
          "",
          ui(lang, "ui.recent.sessions"),
          ...r.sessions.slice(0, RECENT_ROWS).map((s) => `  ${humanDay(s.at, lang)} – ${[s.task, s.summary ? truncate(s.summary, 220) : undefined].filter(Boolean).join(": ")}${s.costUsd !== undefined ? ` · ${humanCost(s.costUsd, lang)}${s.costPartial ? "+" : ""}${s.readersUsd ? ui(lang, "ui.stats.cost.readers", { cost: humanCost(s.readersUsd, lang) }) : ""}` : ""}`),
          more(r.sessions.length - RECENT_ROWS, lang),
        );
      if (tuning.length) out.push("", ui(lang, "ui.recent.tune"), ...tuning.slice(-RECENT_ROWS).map((e) => tuneLine(e, lang)), more(tuning.length - RECENT_ROWS, lang));
      if (refusals.length) out.push("", ui(lang, "ui.recent.archives"), ...refusals.slice(-RECENT_ROWS).map((x) => `  ${x}`), more(refusals.length - RECENT_ROWS, lang));
      return { text: lines(...out), data: { days, ...r, ...(tuning.length ? { tuning } : {}), ...(refusals.length ? { refusals } : {}) } };
    },
  },
);

/** How many regions strom plan names in the order they come. */
const HISTORY_REGIONS = 6;

/**
 * The next task of history strom run takes (the experiment on): when — the next session, in about n sessions, or once
 * the family research has nothing to do (experiments.historyPace) — the place of a recent session or the person's word
 * that put it first, and the regions in the order they come, one a turn (core/pastevents.ts regionOrder).
 */
function historyPlan(
  ctx: Context,
  tree: Tree,
): { task: Task; turn: HistoryTurn; when: string; prefer?: string; asked?: string; regions: { id: string; name: string; persons: number; period?: string; gaps?: string[]; added?: string[] }[]; left: number } | undefined {
  const lang = ctx.uiLang();
  if (!historyOn(tree, ctx.settings)) return undefined;
  const shared = ctx.settings.shared()?.value;
  const turn = historyTurn(tree, shared, ctx.settings);
  const ranked = rankedQueue(tree, { strategy: ctx.settings.strategy(tree.config), history: "only" });
  const task = ranked[0]?.task;
  if (!task) return undefined;
  const name = (id: string) => regionName(shared ? readCatalog(shared, id) : undefined, lang, id);
  const asked = turn.asked?.task === task.id ? turn.asked.region : undefined;
  const prefer = !asked && turn.prefer?.task === task.id ? turn.prefer.place : undefined;
  const when = task.origin === HISTORY_PLACES_ORIGIN ? ui(lang, "ui.plan.history.places") : turn.now ? ui(lang, "ui.plan.history.now") : turn.in === undefined ? ui(lang, "ui.plan.history.idle") : ui(lang, "ui.plan.history.in", { n: Math.max(1, turn.in) });
  const weight = new Map((turn.order ?? []).map((w) => [w.id, w]));
  // the regions as the queue ranks their tasks: asked for, a recent session's place, then by weight — a region with its
  // period (K2.7), a finished one with the years its task looks for (gaps; `added`: those never looked through)
  const regions = ranked.flatMap((r): { id: string; name: string; persons: number; period?: string; gaps?: string[]; added?: string[] }[] => {
    const id = regionOfTask(r.task);
    if (!id) return [];
    const base = { id, name: name(id), persons: weight.get(id)?.persons ?? 0 };
    if (!forGaps(r.task)) return [{ ...base, period: regionPeriod(tree, id).spans.map(gapText).join(", ") }];
    const years = gapsOfTask(r.task);
    const searched = searchedSpans(tree, shared ? readCatalog(shared, id) : undefined);
    const added = years.filter((g) => !searched.some((s) => s.from <= g.from && g.to <= s.to));
    return [{ ...base, gaps: years.map(gapText), ...(added.length ? { added: added.map(gapText) } : {}) }];
  });
  return {
    task,
    turn,
    when: `${when}${asked ? ui(lang, "ui.plan.history.asked", { region: name(asked) }) : prefer ? ui(lang, "ui.plan.history.prefer", { place: prefer }) : ""}`,
    ...(prefer ? { prefer } : {}),
    ...(asked ? { asked } : {}),
    regions,
    // what strom run --history would take, one a session
    left: ranked.length,
  };
}
