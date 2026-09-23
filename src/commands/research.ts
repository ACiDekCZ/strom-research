// research new · list · show — named goals inside a tree.

import { register } from "../cli/registry.ts";
import type { Context } from "../cli/context.ts";
import { lines, table } from "../cli/format.ts";
import { addPerson, addResearch } from "../core/actions.ts";
import { UsageError } from "../core/errors.ts";
import type { Person, Research } from "../core/model.ts";
import { ancestorGenerations, displayName, label, lifespan, parentsOf, resolvePerson } from "../core/people.ts";
import { foldText } from "../core/text.ts";
import type { Tree } from "../core/tree.ts";

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
