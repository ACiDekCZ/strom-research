// stats · pedigree · person card · recent · plan — the tree as a person looks through
// it (the guided menu's "Look through the family tree"), in the research
// language. Read only; --json gives the same for a program.

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
import { lacksImages } from "../core/queue.ts";
import { rankedQueue, waitingForUser } from "./tasks.ts";

/** Most rows a section of `recent` lists; the rest is counted. */
const RECENT_ROWS = 15;

function whoText(w: Who): string {
  return w.years ? `${w.name} (${w.years})` : w.name;
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

/** A fact as a person reads it: "25. 6. 1905, Týnec nad Labem č. 12 · doloženo — Křest Jana Nováka 1905". */
function factText(f: CardFact, lang: string): string {
  const core = [f.value, humanDate(f.date, lang), humanPlace(f.place, f.house, lang), f.cause].filter(Boolean).join(", ");
  return `${core ? `${core} · ` : ""}${statusName(f.status, lang)}${f.source ? ` — ${truncate(f.source, 70)}` : ""}`;
}

function factRows(facts: CardFact[], lang: string, indent: string): string {
  return table(facts.map((f) => [`${indent}${eventName(f.kind, lang, f.label)}`, factText(f, lang)]));
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

/** What the agent wrote into a task, for the user: the records it names by ID by their names ("S0001" → its title). */
export function humanTask(tree: Tree, text: string, lang: string): string {
  const name = (id: string): string => {
    const r = tree.get<Person | Family | Source | RecordSet | Session>(id);
    if (!r) return id;
    if (r.type === "session") return ui(lang, "ui.plan.session", { day: humanDay(r.started, lang) });
    if (r.type === "person") return displayName(r);
    if (r.type === "family") return r.partners.map((x) => tree.get<Person>(x)).filter((x): x is Person => !!x).map(displayName).join(" & ") || id;
    return r.title;
  };
  // A list of IDs as a list of names, each once (two sessions of one day read as one).
  return text.replace(/\b[PFSBN]\d{4,}\b(?:, [PFSBN]\d{4,}\b)*/g, (ids) => [...new Set(ids.split(", ").map(name))].join(", "));
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
      out.push("", ui(lang, "ui.stats.tasks", s.tasks));
      if (s.sessions.count)
        out.push(
          ui(lang, "ui.stats.sessions", { n: s.sessions.count, last: humanDay(s.sessions.last!, lang) }) +
            (s.sessions.costUsd ? ui(lang, "ui.stats.cost", { cost: humanCost(s.sessions.costUsd, lang) }) : ""),
        );
      if (s.stories.written) out.push(ui(lang, "ui.stats.stories", { n: s.stories.written, final: s.stories.final }));
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
      const out: (string | undefined)[] = [whoText(c.person)];
      if (c.otherNames.length) out.push(`  ${ui(lang, "ui.card.also", { names: c.otherNames.join(", ") })}`);
      out.push(c.facts.length ? factRows(c.facts, lang, "  ") : `  ${ui(lang, "ui.card.nofacts")}`, "");
      out.push(c.parents.length ? ui(lang, "ui.card.parents", { names: c.parents.map(whoText).join(", ") }) : ui(lang, "ui.card.noparents"));
      for (const f of c.families) {
        const key = f.partner?.sex === "F" ? "ui.card.wife" : f.partner?.sex === "M" ? "ui.card.husband" : c.sex === "M" ? "ui.card.wife" : c.sex === "F" ? "ui.card.husband" : "ui.card.partner";
        out.push(ui(lang, key, { name: f.partner ? whoText(f.partner) : ui(lang, "ui.card.unknown") }));
        if (f.facts.length) out.push(factRows(f.facts, lang, "  "));
        if (f.children.length) out.push(`  ${ui(lang, "ui.card.children", { names: f.children.map(whoText).join(", ") })}`);
      }
      if (c.story) {
        const text = c.story.text.replace(/\*\*/g, "").trim();
        out.push("", ui(lang, "ui.card.story", { status: ui(lang, c.story.status === "final" ? "ui.card.story.final" : "ui.card.story.draft") }));
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
      const count = positive(opts.count, "count", 10, 200);
      // The order of a conversation (the story's turn is only for working alone).
      const queue = rankedQueue(tree, { strategy: ctx.settings.strategy(tree.config) }).map((r) => r.task);
      const work = queue.filter((t) => t.level !== "narrate");
      const stories = queue.filter((t) => t.level === "narrate");
      const waiting = waitingForUser(tree).length;
      const shown = work.slice(0, count);
      let n = 0;
      const rows = shown.map((t) => [
        `  ${t.state === "doing" ? ui(lang, "ui.plan.now") : `${++n}.`}`,
        `${truncate(humanTask(tree, t.what, lang), 110)}${lacksImages(tree, t) ? ui(lang, "ui.plan.images") : ""}`,
      ]);
      const storyNames = [...new Set(stories.map((t) => tree.get<Person>(t.subject[0] ?? "")).filter((p): p is Person => !!p).map(displayName))];
      const out: (string | undefined)[] = [ui(lang, "ui.plan.title", { name: tree.config.name })];
      if (!queue.length) out.push(`  ${ui(lang, "ui.plan.none")}`);
      else {
        if (rows.length) out.push(table(rows));
        if (work.length > count) out.push(`  ${ui(lang, "ui.plan.more", { n: work.length - count })}`);
        if (stories.length) out.push(ui(lang, "ui.plan.stories", { n: stories.length, names: storyNames.join(", ") }));
      }
      if (waiting) out.push(ui(lang, "ui.plan.waiting", { n: waiting }));
      if (queue.length) out.push("", ui(lang, "ui.plan.steer"));
      const item = (t: Task) => ({ id: t.id, what: humanTask(tree, t.what, lang), level: t.level, state: t.state, needsImages: lacksImages(tree, t) });
      return { text: lines(...out), data: { tasks: work.map(item), stories: stories.map(item), waiting } };
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
      const r = recent(tree, new Date(Date.now() - days * 86_400_000).toISOString());
      const since = humanDay(r.since, lang);
      const refined = r.facts.filter((f) => f.refined).length;
      if (!r.persons.length && !r.facts.length && !r.sources.length && !r.stories.length && !r.sessions.length && !r.tasksDone)
        return { text: ui(lang, "ui.recent.nothing", { since }), data: { days, ...r } };
      const out: (string | undefined)[] = [
        ui(lang, "ui.recent.title", { since }),
        ui(lang, "ui.recent.counts", { persons: r.persons.length, facts: r.facts.length - refined, refined, sources: r.sources.length, stories: r.stories.length, done: r.tasksDone }),
      ];
      if (r.persons.length) out.push("", ui(lang, "ui.recent.persons"), ...r.persons.slice(0, RECENT_ROWS).map((p) => `  ${whoText(p)}`), more(r.persons.length - RECENT_ROWS, lang));
      if (r.facts.length)
        out.push(
          "",
          ui(lang, "ui.recent.facts"),
          ...r.facts.slice(0, RECENT_ROWS).map((f) => `  ${ownerName(tree, f.owner)} – ${eventName(f.fact.kind, lang, f.fact.label)}: ${factText(f.fact, lang)}${f.refined ? ` (${ui(lang, "ui.recent.refined")})` : ""}`),
          more(r.facts.length - RECENT_ROWS, lang),
        );
      if (r.stories.length) out.push("", ui(lang, "ui.recent.stories"), ...r.stories.map((p) => `  ${whoText(p)}`));
      if (r.sessions.length)
        out.push(
          "",
          ui(lang, "ui.recent.sessions"),
          ...r.sessions.slice(0, RECENT_ROWS).map((s) => `  ${humanDay(s.at, lang)} – ${[s.task, s.summary ? truncate(s.summary, 220) : undefined].filter(Boolean).join(": ")}`),
          more(r.sessions.length - RECENT_ROWS, lang),
        );
      return { text: lines(...out), data: { days, ...r } };
    },
  },
);
