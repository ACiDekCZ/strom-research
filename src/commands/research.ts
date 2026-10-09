// research new · list · show — named goals inside a tree.

import { register, type CommandDef } from "../cli/registry.ts";
import type { Context } from "../cli/context.ts";
import { lines, table } from "../cli/format.ts";
import { addPerson, addResearch } from "../core/actions.ts";
import { applyFrontier, researchProposals } from "./session.ts";
import { frontier } from "../core/frontier.ts";
import { DEATH_AFTER_YEARS, livingBorn, unprovenPeople } from "../core/review.ts";
import { parkedWhy } from "./tasks.ts";
import { ui, type UIKey } from "../cli/ui.ts";
import { phrase } from "../core/phrases.ts";
import { UsageError } from "../core/errors.ts";
import { REVIEW_SCOPES, type Person, type Research, type Session, type Task } from "../core/model.ts";
import { ancestorGenerations, displayName, label, lifespan, parentsOf, resolvePerson } from "../core/people.ts";
import { foldText } from "../core/text.ts";
import { now, type Tree } from "../core/tree.ts";
import { directionOf, scopes } from "../core/directions.ts";
import { update } from "../core/records.ts";
import { isAgent } from "../core/which.ts";
import { costPartial, sessionCost } from "../core/session.ts";

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
  ...(["pause", "resume", "done"] as const).map((act): CommandDef => ({
    path: ["research", act],
    summary:
      act === "pause"
        ? "Pause a research direction: its tasks wait out of the queue, nothing new is proposed for it"
        : act === "resume"
          ? "Resume a paused or finished research direction: its tasks back in the queue, what it would propose added"
          : "End a research direction (done): its tasks leave the queue, nothing is deleted",
    group: "research",
    tree: true,
    writes: true,
    description:
      "The user's decision about where the research goes (an agent runs it when the user asks). Nothing is\n" +
      "deleted: the direction's tasks stay as they are, out of the queue while it is paused or done; a session\n" +
      "at work on one of them goes on. strom research resume brings them back.",
    args: [{ name: "research", description: "ID (G0001) or part of the name", required: true }],
    options: act === "resume" ? [] : [{ name: "reason", type: "string" as const, value: "<text>", description: "why (kept as a note of the research)" }],
    examples: act === "pause" ? ['strom research pause G0001 --reason "the family asked to wait"'] : act === "resume" ? ["strom research resume G0001"] : ["strom research done G0001"],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      const r = resolveResearch(tree, args[0]!);
      const state = act === "pause" ? "paused" : act === "resume" ? "active" : "done";
      const reason = typeof opts.reason === "string" && opts.reason.trim() ? opts.reason.trim() : undefined;
      const waiting = (id: string) => {
        const all = scopes(tree);
        return tree.list<Task>("task").filter((t) => ["open", "parked", "waiting"].includes(t.state) && directionOf(tree, t, all) === id).length;
      };
      if (r.state === state) return { text: `${r.id} is ${state} already`, data: { research: r, changed: false, tasks: waiting(r.id) } };
      const next = update<Research>(tree, r.id, "research", (x) => ({ ...x, state, stateSince: now(), notes: reason ? [...x.notes, { text: `${state}: ${reason}`, at: new Date().toISOString(), by: tree.actor }] : x.notes }), {
        op: `research.${act}`,
        summary: `${r.id} ${state}: ${r.name}`,
        ...(reason ? { reason } : {}),
      });
      const created = act === "resume" ? applyFrontier(tree, next) : [];
      const n = waiting(r.id);
      return {
        text: lines(
          ...tree.written.map((o) => o.summary),
          act === "resume" ? `its tasks are back in the queue: ${n}` : `its tasks wait out of the queue: ${n} → strom research resume ${r.id}`,
        ),
        data: { research: next, changed: true, tasks: n, created },
      };
    },
  })),
  {
    path: ["research", "show"],
    summary: "One research: goal, focus person, known ancestors, what is missing",
    group: "research",
    tree: true,
    args: [{ name: "research", description: "ID (G0001) or part of the name (default: the one active research)" }],
    run(ctx, { args }) {
      const tree = ctx.tree();
      // none named: the one active research, as other commands take it (K15)
      const active = tree.list<Research>("research").filter((x) => x.state === "active");
      if (!args[0] && active.length !== 1)
        throw new UsageError(active.length ? `${active.length} researches are active: name one` : "no active research", { hint: active.length ? `strom research show ${active[0]!.id} — all: strom research list` : "strom research list" });
      const r = args[0] ? resolveResearch(tree, args[0]) : active[0]!;
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

/** People without a record in one review at a time. */
export const UNPROVEN_BATCH = 10;

register({
  path: ["review"],
  summary: "Review a person, several, or those no record proves: what the tree says of them elsewhere, entries to read, facts to check — as tasks",
  group: "research",
  tree: true,
  writes: true,
  description:
    "Sends the research straight to one person — or to several named at once (one review for them all), or with\n" +
    "--unproven to the people no record of their own proves (strom person list --unproven), a batch at a time: run\n" +
    "it again for the next batch; who is proved leaves the review. strom looks at what is recorded and proposes\n" +
    "the work, at most one task of each kind for a person: what records, notes and the diary say of them outside\n" +
    "their data; entries whose images are here but were not read whole (transcript, godparents, witnesses,\n" +
    "house); facts resting on one reading; conflicts left open; with --reread, a second reading of what only\n" +
    "another model read — after the agent or the model changed. Birth, parents and the story come as in any\n" +
    "research. Run again later: what a task took up, or a task open elsewhere covers, is not proposed again.\n" +
    "Nothing is deleted; corrections go through strom with their reasons.",
  args: [{ name: "person", description: "whom (ID or name); several: one review for them all; none with --unproven", variadic: true }],
  options: [
    { name: "scope", type: "string", value: "<scope>", description: "one person: person (default), family (with partners and children), line (with the ancestors)" },
    { name: "unproven", type: "boolean", description: "the people no record of their own proves (strom person list --unproven), a batch at a time" },
    { name: "max", type: "string", value: "<n>", description: `with --unproven: at most so many people in the batch (default ${UNPROVEN_BATCH})` },
    { name: "living", type: "boolean", description: "review someone most likely alive (born less than 100 years ago) all the same — the user asked for it" },
    { name: "reread", type: "boolean", description: "also a second reading of what only another model read (the model you read with now: model.vision)" },
    { name: "model", type: "string", value: "<model>", description: "with --reread: this model instead of model.vision" },
  ],
  examples: [
    "strom review P0001",
    'strom review "Josef Novák" --scope family',
    "strom review P0001 P0002",
    "strom review --unproven",
    "strom review P0001 --reread",
    "strom review P0001 --dry-run",
  ],
  async run(ctx: Context, { args, opts }) {
    const tree = ctx.tree();
    const unproven = !!opts.unproven;
    if (unproven && args.length) throw new UsageError("--unproven reviews the people without a record — no person with it", { hint: "strom review --unproven · or strom review <person>" });
    if (!unproven && !args.length) throw new UsageError("whom? a person, several, or --unproven", { hint: "strom review P0001 · strom review P0001 P0002 · strom review --unproven" });
    if (!unproven && opts.max !== undefined) throw new UsageError("--max goes with --unproven");
    if ((unproven || args.length > 1) && opts.scope !== undefined) throw new UsageError("--scope is for one person's review");
    const scope = (opts.scope as string | undefined) ?? "person";
    if (!(REVIEW_SCOPES as readonly string[]).includes(scope)) throw new UsageError(`--scope must be one of ${REVIEW_SCOPES.join(", ")}`);
    const max = int(opts.max, "max") ?? UNPROVEN_BATCH;
    if (max < 1) throw new UsageError("--max must be 1 or more");
    let reread: string | undefined;
    if (opts.reread) {
      reread = (opts.model as string | undefined) ?? ctx.settings.models(ctx.settings.agent(tree.config).value, tree.config).vision;
      if (!reread) throw new UsageError("--reread needs the model to read with", { hint: "strom config set model.vision <model> — or strom review … --reread --model <model>" });
    } else if (opts.model) throw new UsageError("--model goes with --reread");
    const lang = tree.lang;
    const chosen = [...new Map(args.map((a) => resolvePerson(tree, a)).map((x) => [x.id, x])).values()];
    // the living are the family's to tell: reviewed only when the person says so
    const living = chosen.map((x) => ({ x, born: livingBorn(tree, x) })).filter((l) => l.born !== undefined);
    if (living.length && !opts.living && !ctx.yes && !tree.dryRun) {
      const who = living.map((l) => `${label(l.x)}`).join(", ");
      if (ctx.interactive && !isAgent(ctx.env)) {
        if (!(await ctx.confirm(ui(lang, "ui.review.living", { who, years: DEATH_AFTER_YEARS }), false))) return { text: ui(lang, "ui.review.living.no"), data: { research: null, created: [], planned: [], open: [], living: living.map((l) => l.x.id) } };
      } else
        throw new UsageError(`most likely alive (born less than ${DEATH_AFTER_YEARS} years ago, no death recorded): ${who}`, {
          hint: `ask the user whether to review them all the same; if yes: strom review ${args.join(" ")} --living`,
        });
    }
    const p = chosen.length === 1 ? chosen[0] : undefined;
    const several = chosen.length > 1;
    const sameSet = (ids: string[] | undefined) => !!ids && ids.length === chosen.length && chosen.every((x) => ids.includes(x.id));
    // one review research per person, per set of people, one of the people without a record: again later, it goes on where it was
    const existing = tree
      .list<Research>("research")
      .find(
        (r) =>
          r.direction === "person" &&
          r.review &&
          (unproven ? !!r.review.unproven : several ? !r.review.unproven && sameSet(r.review.people) : !r.review.people && r.focus === p!.id),
      );
    let review: NonNullable<Research["review"]> = { scope: scope as (typeof REVIEW_SCOPES)[number], ...(reread ? { reread } : {}) };
    let left = 0;
    if (unproven) {
      const batch = unprovenBatch(tree, existing, max, review);
      if (!batch.people.length) return { text: ui(lang, "ui.review.unproven.none"), data: { research: existing ?? null, created: [], planned: [], open: [] } };
      review = { ...review, people: batch.people, unproven: true };
      left = batch.left;
    } else if (several) review = { ...review, people: chosen.map((x) => x.id) };
    const names = chosen.map((x) => displayName(x));
    const name = unproven ? phrase(lang, "review.unproven.research") : names.length > 3 ? `${names.slice(0, 3).join(", ")} +${names.length - 3}` : names.join(", ");
    const focus = p?.id ?? review.people![0]!;
    // What it would propose, asked before anything is written: with nothing to do, no research is made for it.
    const draft: Research = existing
      ? { ...existing, focus, state: "active", review }
      : ({ id: "G?", type: "research", name: unproven ? name : phrase(lang, "review.research", { name }), focus, direction: "person", state: "active", review, notes: [] } as unknown as Research);
    const planned = researchProposals(tree, draft).map((x) => x.proposal);
    let research: Research = draft;
    let tasks: Task[] = [];
    const what = unproven ? `${review.people!.length} without a record of their own` : several ? review.people!.join(" ") : scope;
    if (planned.length && !tree.dryRun) {
      if (existing)
        research = update<Research>(tree, existing.id, "research", (r) => ({ ...r, focus, state: "active", review }), {
          op: "research.edit",
          summary: `${existing.id} review again: ${what}${reread ? `, second reading with ${reread}` : ""}`,
        });
      else {
        const r = addResearch(tree, { name: draft.name, focus, direction: "person" });
        research = update<Research>(tree, r.id, "research", (x) => ({ ...x, review }), { op: "research.edit", summary: `${r.id} review: ${what}${reread ? `, second reading with ${reread}` : ""}` });
      }
      tasks = applyFrontier(tree, research)
        .map((id) => tree.get<Task>(id))
        .filter((t): t is Task => !!t);
    }
    const open = existing ? tree.list<Task>("task").filter((t) => t.research === existing.id && ["open", "doing"].includes(t.state)) : [];
    // what a session costs here, from those so far: the user decides with the price in view
    const costs = tree
      .list<Session>("session")
      .filter((s) => !costPartial(s.metrics)) // stopped before it said: more than it shows
      .map((s) => sessionCost(s.metrics))
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
      (tree.written.length && !human) || tree.dryRun ? "" : undefined,
      list.length ? ui(lang, "ui.review.new", { name: p ? label(p) : name, n: list.length }) : ui(lang, "ui.review.nothing", { name: p ? label(p) : name }),
      ...list,
      ...why,
      open.length || tasks.length
        ? ui(lang, "ui.review.open", { n: open.length || tasks.length, research: inReview!.id }) + (avg !== undefined ? ui(lang, "ui.review.cost", { cost: avg.toFixed(2) }) : "")
        : undefined,
      (open.length || tasks.length) && inReview ? ui(lang, human ? "ui.review.next.human" : "ui.review.next", { research: inReview.id }) : undefined,
      left ? ui(lang, human ? "ui.review.unproven.left.human" : "ui.review.unproven.left", { n: left }) : undefined,
    );
    return {
      text,
      data: { research: inReview ?? null, created: tasks, planned, open: open.map((t) => t.id), ...(unproven ? { people: review.people, left } : {}), ...(why.length ? { why } : {}), ...(avg !== undefined ? { avgCostUsd: avg } : {}) },
    };
  },
});

const OPEN_TASK = new Set(["open", "doing", "parked", "waiting"]);

/**
 * The next batch of people without a record of their own: those whose tasks of the review are still open stay;
 * then the ones strom has work for — a record naming them first (the quickest to prove), then leads, then
 * nothing — those never in a batch before those tried already. How many more wait besides.
 */
function unprovenBatch(tree: Tree, existing: Research | undefined, max: number, review: NonNullable<Research["review"]>): { people: string[]; left: number } {
  // the living are the family's to tell: no research of the registers for them
  const all = unprovenPeople(tree).filter((u) => !u.living);
  const tasks = existing ? tree.list<Task>("task").filter((t) => t.research === existing.id) : [];
  const busy = (id: string) => tasks.some((t) => t.subject.includes(id) && OPEN_TASK.has(t.state));
  const keep = all.filter((u) => busy(u.person.id)).map((u) => u.person.id);
  const before = new Set(existing?.review?.people ?? []);
  const order: Record<string, number> = { named: 0, leads: 1, none: 2 };
  const rest = all
    .filter((u) => !keep.includes(u.person.id))
    .sort((a, b) => Number(before.has(a.person.id)) - Number(before.has(b.person.id)) || order[a.kind]! - order[b.kind]! || a.person.id.localeCompare(b.person.id));
  // only those strom has work for: what it would propose for all of them, asked once
  const draft = { ...(existing ?? { id: "G?", type: "research", name: "", direction: "person", state: "active", notes: [] }), review: { ...review, people: rest.map((u) => u.person.id), unproven: true } } as Research;
  const planned = researchProposals(tree, { ...draft, focus: rest[0]?.person.id ?? "" }).map((x) => x.proposal);
  const workable = rest.filter((u) => planned.some((x) => x.subject.includes(u.person.id))).map((u) => u.person.id);
  const people = [...keep, ...workable].slice(0, Math.max(max, keep.length));
  return { people, left: all.length - people.length };
}

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
