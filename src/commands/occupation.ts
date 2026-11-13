// strom occupation …: the research's own forms of occupations beside strom's built-in list (core/occupations.ts,
// quality/occupations.json) — what strom query --occupation finds as one occupation. The person adds and takes out
// forms in their terminal, without an agent; the agent adds the forms the records name that the list lacks, and takes
// out only its own, never the person's.

import { register } from "../cli/registry.ts";
import { lines, shellArg } from "../cli/format.ts";
import { UsageError } from "../core/errors.ts";
import {
  addOccupation,
  builtinOccupationCount,
  occupationGroup,
  occupationsOf,
  OCCUPATIONS_FILE,
  readOwnOccupations,
  removeOccupation,
  type OccupationBy,
  type OwnOccupation,
} from "../core/occupations.ts";
import type { Source } from "../core/model.ts";
import { wordsFor } from "./people.ts";

/** The day as the person's computer has it (YYYY-MM-DD). */
function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** The forms of a group by language: "cs bednář, bečvář · de Fassbinder". */
const formsByLang = (g: OwnOccupation) =>
  Object.entries(g.forms)
    .map(([l, fs]) => `${l} ${fs.join(", ")}`)
    .join(" · ");

register(
  {
    path: ["occupation", "add"],
    summary: "Add forms of an occupation to the research's own list (strom query --occupation finds them as one)",
    group: "analysis",
    tree: true,
    writes: true,
    description:
      "The research's own forms of occupations beside strom's built-in list (Czech, German, Latin, Polish), kept in\n" +
      `${OCCUPATIONS_FILE}. Two forms at least, one occupation: a form the list knows joins the others to it (another\n` +
      "form of a miller), forms it knows none of make an occupation of their own. A form is in the research's language;\n" +
      "another language before it (any language code): de:Ölschläger. The person adds forms in their terminal; the\n" +
      "agent adds a form the records name that the list lacks (strom query says when a word is in no list) — with\n" +
      "--source, the source it was met in — and tells the user it did. Each group keeps who added it (the person, an\n" +
      "agent), the day and the sources; an agent never changes or takes out what the person added.",
    args: [{ name: "form", description: "the forms of one occupation (two at least): olejník de:Ölschläger", required: true, variadic: true }],
    options: [{ name: "source", type: "string", value: "<S…>", description: "the source the forms were met in" }],
    examples: ["strom occupation add olejník de:Ölschläger", "strom occupation add mlynář de:Mühlenmeister --source S0001"],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      const w = wordsFor(ctx, tree);
      let source: string | undefined;
      if (typeof opts.source === "string" && opts.source.trim()) {
        source = opts.source.trim().toUpperCase();
        const s = tree.get<Source>(source);
        if (!s || s.type !== "source") throw new UsageError(`no source ${source} in the tree`, { hint: "strom source list" });
      }
      const by: OccupationBy = tree.personWrites ? "human" : "agent";
      const r = addOccupation(tree, args, { by, today: today(), ...(source ? { source } : {}) });
      return {
        text: r.added.length
          ? w.say("ui.occupation.added", `added: ${r.added.join(", ")} — the occupation's forms now: ${r.forms.join(", ")}`, { added: r.added.join(", "), forms: r.forms.join(", ") })
          : w.say("ui.occupation.same", `one occupation already: ${r.forms.join(", ")}`, { forms: r.forms.join(", ") }),
        data: { ...r, file: OCCUPATIONS_FILE },
      };
    },
  },
  {
    path: ["occupation", "list"],
    summary: "The research's own forms of occupations (who added them, when), or one occupation's forms by a word",
    group: "analysis",
    tree: true,
    description:
      "Without a word: the groups of the research's own list, each with who added it (the person by hand, an agent),\n" +
      "the day and the sources. With a word: the forms of its occupation, built in and the research's own (marked *).\n" +
      "--all: every occupation of both lists.",
    args: [{ name: "word", description: "a form of an occupation: its forms", required: false }],
    options: [{ name: "all", type: "boolean", description: "every occupation, built in and the research's own" }],
    examples: ["strom occupation list", "strom occupation list mlynar", "strom occupation list --all --json"],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      const w = wordsFor(ctx, tree);
      const own = readOwnOccupations(tree);
      const list = occupationsOf(tree);
      // the technical detail only in --json (error); the line says the file once, in the research language
      const errorLine = own.error
        ? w.say("ui.occupation.unreadable", `the research's own list of occupations (${OCCUPATIONS_FILE}) cannot be read: the built-in list only — strom repair`, { file: OCCUPATIONS_FILE })
        : undefined;
      const byWord = (b: OccupationBy) => (w.lang ? w.say(`ui.occupation.by.${b}`, b) : b === "human" ? "the person" : "an agent");
      const word = args[0]?.trim();
      if (word) {
        const g = occupationGroup(word, list);
        const ownSet = new Set(g?.own ?? []);
        return {
          text: lines(
            g
              ? `${word}: ${g.forms.map((f) => (ownSet.has(f) ? `${f}*` : f)).join(", ")}`
              : w.say("ui.occupation.none", `${word}: in no list of occupations — strom occupation add ${shellArg(word)} <form> adds its forms`, { word, command: `strom occupation add ${shellArg(word)}` }),
            errorLine,
          ),
          data: { word, known: !!g, forms: g?.forms ?? [], own: g?.own ?? [], ...(own.error ? { error: own.error } : {}) },
        };
      }
      if (opts.all) {
        return {
          text: lines(...list.entries.map((e) => e.forms.map((f) => (e.own?.includes(f) ? `${f}*` : f)).join(", ")), errorLine),
          data: { groups: list.entries.map((e) => ({ forms: e.forms, own: e.own ?? [] })), ...(own.error ? { error: own.error } : {}) },
        };
      }
      const builtin = builtinOccupationCount();
      return {
        text: lines(
          w.say("ui.occupation.list", `${own.groups.length} of the research's own (${OCCUPATIONS_FILE}), ${builtin} built in`, { n: own.groups.length, builtin }),
          ...own.groups.map((g) => `  ${formsByLang(g)}  (${byWord(g.by)}${g.at ? `, ${g.at}` : ""}${g.sources?.length ? `, ${g.sources.join(", ")}` : ""})`),
          errorLine,
        ),
        data: { file: OCCUPATIONS_FILE, groups: own.groups, builtin, ...(own.error ? { error: own.error } : {}) },
      };
    },
  },
  {
    path: ["occupation", "remove"],
    summary: "Take forms out of the research's own list of occupations (an agent only what an agent added)",
    group: "analysis",
    tree: true,
    writes: true,
    description:
      "Takes each form out of the research's own groups (a group left with one form goes too). The built-in list stays\n" +
      "as it is. The person takes out any form of the research's own list; an agent only one an agent added — what the\n" +
      "person added is theirs.",
    args: [{ name: "form", description: "the forms to take out (de:Ölschläger in another language)", required: true, variadic: true }],
    examples: ["strom occupation remove de:Ölschläger"],
    run(ctx, { args }) {
      const tree = ctx.tree();
      const w = wordsFor(ctx, tree);
      const by: OccupationBy = tree.personWrites ? "human" : "agent";
      const r = removeOccupation(tree, args, { by });
      return {
        text: lines(
          r.removed.length ? w.say("ui.occupation.removed", `taken out: ${r.removed.join(", ")}`, { forms: r.removed.join(", ") }) : undefined,
          r.persons.length ? `${r.persons.join(", ")}: added by the person — only the person takes them out, in their terminal` : undefined,
          r.builtin.length ? w.say("ui.occupation.builtin", `${r.builtin.join(", ")}: built in, stays`, { forms: r.builtin.join(", ") }) : undefined,
          r.unknown.length ? w.say("ui.occupation.notown", `${r.unknown.join(", ")}: not in the research's own list`, { forms: r.unknown.join(", ") }) : undefined,
        ),
        data: r,
      };
    },
  },
);
