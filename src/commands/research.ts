// research new · list · show — named goals inside a tree.

import { register } from "../cli/registry.ts";
import type { Context } from "../cli/context.ts";
import { lines, table } from "../cli/format.ts";
import { addPerson, addResearch } from "../core/actions.ts";
import { applyFrontier, researchProposals } from "./session.ts";
import { frontier } from "../core/frontier.ts";
import { parkedWhy } from "./tasks.ts";
import { ui, type UIKey } from "../cli/ui.ts";
import { phrase } from "../core/phrases.ts";
import { UsageError } from "../core/errors.ts";
import { REVIEW_SCOPES, type Person, type Research, type Session, type Task } from "../core/model.ts";
import { ancestorGenerations, displayName, label, lifespan, parentsOf, resolvePerson } from "../core/people.ts";
import { foldText } from "../core/text.ts";
import type { Tree } from "../core/tree.ts";
import { update } from "../core/records.ts";
import { isAgent } from "../core/which.ts";

function int(v: unknown, name: string): number | undefined {
  if (v === undefined) return undefined;
  const n = Number(v);
  if (!Number.isInteger(n)) throw new UsageError(`--${name} must be a whole number`);
  return n;
}

export function resolveResearch(tree: Tree, ref: string): Research {
  const all = tree.list<Research>("research");
  const id = ref.toUpperCase();
  const byId = all.find((r) => r.id === id || r.id === "G" + id.replace(/^G/, "").padStart(4, "0"));
  if (byId) return byId;
  const hits = all.filter((r) => foldText(r.name).includes(foldText(ref)));
  if (hits.length === 1) return hits[0]!;
  if (hits.length === 0) throw new UsageError(`no research "${ref}"`, { hint: "strom research list" });
  throw new UsageError(`"${ref}" matches ${hits.length} researches`, { hint: hits.map((r) => `${r.id} ${r.name}`).join(" · ") });
}

function researchLine(tree: Tree, r: Research): string[] {
  const focus = tree.get<Person>(r.focus);
  return [r.id, r.name, `[${r.state}]`, r.direction, focus ? label(focus) : r.focus];
}

register(
  {
    path: ["research", "new"],
    summary: "Start a named research, e.g. the ancestors of one person",
    group: "research",
    tree: true,
    writes: true,
    description:
      "The focus person must exist (--person) or is created (--new-person). What the user remembers is\n" +
      "recorded as leads, never as proven facts.",
    args: [{ name: "name", description: 'research name, e.g. "Ancestors of Jan Novák"', required: true }],
    options: [
      { name: "person", type: "string", value: "<who>", description: "focus person (ID or name)" },
      { name: "new-person", type: "string", value: "<name>", description: 'create the focus person: "Jan /Novák/"' },
      { name: "sex", type: "string", value: "M|F|U", description: "sex of the new person" },
      { name: "born", type: "string", value: "<date>", description: "birth date of the new person (lead)" },
      { name: "born-place", type: "string", value: "<place>", description: "birth place of the new person (lead)" },
      { name: "direction", type: "string", value: "<dir>", description: "ancestors (default), descendants, person, question" },
      { name: "generations", type: "string", value: "<n>", description: "stop after n generations" },
      { name: "before", type: "string", value: "<year>", description: "stop at people born before this year" },
      { name: "question", type: "string", value: "<text>", description: "the research question (direction question)" },
      { name: "priority", type: "string", value: "1-5", description: "priority among researches (default 3)" },
      { name: "note", type: "string", value: "<text>", description: "what the user told you (short)" },
    ],
    examples: [
      'strom research new "Předci Jana Nováka" --new-person "Jan /Novák/" --sex M --born "ABT 1905" --born-place "Týnec nad Labem"',
      'strom research new "Linie Svobodová" --person P0003 --generations 5',
      'strom research new "Kdo byl otec Marie?" --person "Marie Nováková" --direction question --question "Who was her father?"',
    ],
    run(ctx: Context, { args, opts }) {
      const tree = ctx.tree();
      if (!opts.person === !opts["new-person"]) throw new UsageError("give exactly one of --person <who> or --new-person <name>");
      let focus: Person;
      if (opts["new-person"]) {
        focus = addPerson(tree, {
          name: opts["new-person"] as string,
          sex: opts.sex as string | undefined,
          born: opts.born as string | undefined,
          bornPlace: opts["born-place"] as string | undefined,
        });
      } else focus = resolvePerson(tree, opts.person as string);
      const r = addResearch(tree, {
        name: args[0]!,
        focus: focus.id,
        direction: opts.direction as string | undefined,
        generations: int(opts.generations, "generations"),
        before: int(opts.before, "before"),
        question: opts.question as string | undefined,
        priority: int(opts.priority, "priority"),
        note: opts.note as string | undefined,
      });
      const text = lines(
        ...tree.written.map((o) => o.summary),
        tree.dryRun ? "(dry run — nothing written)" : undefined,
        "",
        tree.count("input") === 0
          ? `next   strom intake --text "<what the user told you about ${displayName(focus)} and the family>"`
          : `next   strom session start`,
      );
      return { text, data: { research: r, focus } };
    },
  },
  {
    path: ["research", "list"],
    summary: "Researches in this tree",
    group: "research",
    tree: true,
    options: [{ name: "state", type: "string", value: "<state>", description: "active, paused or done" }],
    run(ctx, { opts }) {
      const tree = ctx.tree();
      const all = tree.list<Research>("research").filter((r) => !opts.state || r.state === opts.state);
      if (all.length === 0) return { text: 'no researches yet → strom research new "<name>" --new-person "<Given /Surname/>"', data: { researches: [] } };
      return { text: table(all.map((r) => researchLine(tree, r))), data: { researches: all } };
    },
  },
  {
    path: ["research", "show"],
    summary: "One research: goal, focus person, known ancestors, what is missing",
    group: "research",
    tree: true,
    args: [{ name: "research", description: "ID (G0001) or part of the name", required: true }],
    run(ctx, { args }) {
      const tree = ctx.tree();
      const r = resolveResearch(tree, args[0]!);
      const focus = tree.get<Person>(r.focus);
      const gens = ancestorGenerations(tree, r.focus, r.limits?.generations ?? 50);
      const byGen = new Map<number, Person[]>();
      for (const [id, g] of gens) {
        const p = tree.get<Person>(id);
        if (p) byGen.set(g, [...(byGen.get(g) ?? []), p]);
      }
      const missingParents = [...gens.keys()]
        .map((id) => tree.get<Person>(id)!)
        .filter((p) => p && parentsOf(tree, p.id).length < 2);
      const limits = [r.limits?.generations ? `${r.limits.generations} generations` : "", r.limits?.before ? `born after ${r.limits.before}` : ""].filter(Boolean).join(", ");
      const text = lines(
        `${r.id} ${r.name}  [${r.state}]  priority ${r.priority}`,
        `goal   ${r.direction}${r.question ? `: ${r.question}` : ""} of ${focus ? label(focus) : r.focus}${limits ? ` (${limits})` : ""}`,
        ...r.notes.map((n) => `note   ${n.text}`),
        "",
        "known ancestors by generation",
        table(
          [...byGen.entries()]
            .sort((a, b) => a[0] - b[0])
            .flatMap(([g, ps]) => ps.map((p) => [`  G${g}`, p.id, displayName(p), lifespan(p)])),
        ),
        "",
        missingParents.length
          ? `missing parents (${missingParents.length}): ` + missingParents.slice(0, 10).map((p) => `${p.id} ${displayName(p)}`).join(" · ")
          : "every person in scope has both parents",
      );
      return {
        text,
        data: {
          research: r,
          focus,
          generations: Object.fromEntries([...gens.entries()]),
          missingParents: missingParents.map((p) => p.id),
        },
      };
    },
  },
);

register({
  path: ["review"],
  summary: "Review one person: what the tree already says of them elsewhere, entries to read whole, facts to check — as tasks",
  group: "research",
  tree: true,
  writes: true,
  description:
    "Sends the research straight to one person. strom looks at what is recorded and proposes the work, at\n" +
    "most one task of each kind: what records, notes and the diary say of them outside their data; entries whose\n" +
    "images are here but were not read whole (transcript, godparents, witnesses, house); facts resting on one\n" +
    "reading; conflicts left open; with --reread, a second reading of what only another model read — after the\n" +
    "agent or the model changed. Birth, parents and the story come as in any research. Run again later: what a\n" +
    "task took up is not proposed again. Nothing is deleted; corrections go through strom with their reasons.",
  args: [{ name: "person", description: "whom (ID or name)", required: true }],
  options: [
    { name: "scope", type: "string", value: "<scope>", description: "person (default), family (with partners and children), line (with the ancestors)" },
    { name: "reread", type: "boolean", description: "also a second reading of what only another model read (the model you read with now: model.vision)" },
    { name: "model", type: "string", value: "<model>", description: "with --reread: this model instead of model.vision" },
  ],
  examples: ["strom review P0001", 'strom review "Josef Novák" --scope family', "strom review P0001 --reread", "strom review P0001 --dry-run"],
  run(ctx: Context, { args, opts }) {
    const tree = ctx.tree();
    const p = resolvePerson(tree, args[0]!);
    const scope = (opts.scope as string | undefined) ?? "person";
    if (!(REVIEW_SCOPES as readonly string[]).includes(scope)) throw new UsageError(`--scope must be one of ${REVIEW_SCOPES.join(", ")}`);
    let reread: string | undefined;
    if (opts.reread) {
      reread = (opts.model as string | undefined) ?? ctx.settings.models(ctx.settings.agent(tree.config).value, tree.config).vision;
      if (!reread) throw new UsageError("--reread needs the model to read with", { hint: "strom config set model.vision <model> — or strom review … --reread --model <model>" });
    } else if (opts.model) throw new UsageError("--model goes with --reread");
    const review = { scope: scope as (typeof REVIEW_SCOPES)[number], ...(reread ? { reread } : {}) };
    const lang = tree.lang;
    // one review research per person: again later, it goes on where it was
    const existing = tree.list<Research>("research").find((r) => r.direction === "person" && r.focus === p.id && r.review);
    // What it would propose, asked before anything is written: with nothing to do, no research is made for it.
    const draft: Research = existing
      ? { ...existing, state: "active", review }
      : ({ id: "G?", type: "research", name: phrase(lang, "review.research", { name: displayName(p) }), focus: p.id, direction: "person", state: "active", review, notes: [] } as unknown as Research);
    const planned = researchProposals(tree, draft).map((x) => x.proposal);
    let research: Research = draft;
    let tasks: Task[] = [];
    if (planned.length && !tree.dryRun) {
      if (existing)
        research = update<Research>(tree, existing.id, "research", (r) => ({ ...r, state: "active", review }), {
          op: "research.edit",
          summary: `${existing.id} review again: ${scope}${reread ? `, second reading with ${reread}` : ""}`,
        });
      else {
        const r = addResearch(tree, { name: draft.name, focus: p.id, direction: "person" });
        research = update<Research>(tree, r.id, "research", (x) => ({ ...x, review }), { op: "research.edit", summary: `${r.id} review: ${scope}${reread ? `, second reading with ${reread}` : ""}` });
      }
      tasks = applyFrontier(tree, research)
        .map((id) => tree.get<Task>(id))
        .filter((t): t is Task => !!t);
    }
    const open = existing ? tree.list<Task>("task").filter((t) => t.research === existing.id && ["open", "doing"].includes(t.state)) : [];
    // what a session costs here, from those so far: the user decides with the price in view
    const costs = tree
      .list<Session>("session")
      .filter((s) => !s.metrics?.costPartial) // stopped before it said: more than it shows
      .map((s) => s.metrics?.costUsd)
      .filter((c): c is number => typeof c === "number");
    const avg = costs.length ? costs.reduce((a, b) => a + b, 0) / costs.length : undefined;
    // A person at a terminal (the menu) reads the tasks and what comes next, not the operations and commands.
    const human = ctx.io.tty && !isAgent(ctx.env);
    const list = tree.dryRun
      ? planned.map((t) => ui(lang, "ui.review.would", { level: t.level, what: t.what }))
      : tasks.map((t) => (human ? `  • ${t.what}` : `  ${t.id} ${t.level} · ${t.what}`));
    // Nothing new: why — the work that covers them already (a parked task says how to go on), a search done in vain.
    const why = list.length ? [] : coveredLines(tree, draft, lang, human);
    const inReview = existing ?? (planned.length && !tree.dryRun ? research : undefined);
    const text = lines(
      ...(human ? [] : tree.written.map((o) => o.summary)),
      tree.dryRun ? ui(lang, "ui.review.dry") : undefined,
      (tree.written.length && !human) || tree.dryRun ? "" : undefined,
      list.length ? ui(lang, "ui.review.new", { name: label(p), n: list.length }) : ui(lang, "ui.review.nothing", { name: label(p) }),
      ...list,
      ...why,
      open.length || tasks.length
        ? ui(lang, "ui.review.open", { n: open.length || tasks.length, research: inReview!.id }) + (avg !== undefined ? ui(lang, "ui.review.cost", { cost: avg.toFixed(2) }) : "")
        : undefined,
      (open.length || tasks.length) && inReview ? ui(lang, human ? "ui.review.next.human" : "ui.review.next", { research: inReview.id }) : undefined,
    );
    return { text, data: { research: inReview ?? null, created: tasks, planned, open: open.map((t) => t.id), ...(why.length ? { why } : {}), ...(avg !== undefined ? { avgCostUsd: avg } : {}) } };
  },
});

/** Why a review found nothing new, person by person: the work that covers them already, or a search done in vain. */
function coveredLines(tree: Tree, research: Research, lang: string, human = false): string[] {
  const out: string[] = [];
  for (const item of frontier(tree, research)) {
    const name = label(item.person);
    const t = item.coveredBy ? tree.get<Task>(item.coveredBy) : undefined;
    if (t) {
      const why = parkedWhy(tree, t);
      out.push(ui(lang, "ui.review.covered", { name, task: t.id, state: ui(lang, `ui.review.state.${t.state}` as UIKey) + (why ? `: ${why}` : ""), what: t.what }));
      if (t.state === "parked") out.push(ui(lang, human ? "ui.review.wake.human" : "ui.review.wake", { task: t.id }));
    } else if (item.exhausted?.length) out.push(ui(lang, "ui.review.exhausted", { name, tasks: item.exhausted.join(", ") }));
  }
  return out;
}
