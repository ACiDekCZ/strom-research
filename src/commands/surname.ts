// strom surname …: the forms of a surname that are one family's (core/surnames.ts). The research suggests them from its
// records; the person decides — a group or a rejection is written only by the person (here in the terminal, or in the
// Strom app through strom sync), never by an agent.

import { register } from "../cli/registry.ts";
import { lines } from "../cli/format.ts";
import { acceptSuggestion, formsSaid, groupSurnames, readSurnames, rejectSuggestion, suggestSurnames, unrejectSurnames, ungroupSurname } from "../core/surnames.ts";
import type { SurnameEntry, SurnameSuggestion } from "../core/surnames.ts";

const PERSON = "Which forms of a surname are one family's is the person's own decision (in the Strom app, or in their terminal): suggest them (strom surname suggest), never write them";

const entryLine = (e: SurnameEntry) => `${e.id}  ${formsSaid(e.forms)}  (${e.by === "app" ? "the Strom app" : "the terminal"}, ${e.at.slice(0, 10)})`;

function suggestionLines(s: SurnameSuggestion): string[] {
  const head = `${s.id}  ${s.level} · ${s.rule}${s.keys.length ? ` (${s.keys.join(", ")})` : ""}  ${formsSaid(s.forms)}  ${s.persons} people${s.from !== undefined ? `, ${s.from === s.to ? s.from : `${s.from}–${s.to}`}` : ""}${s.places.length ? `, ${s.places.slice(0, 3).join(", ")}` : ""}`;
  const out = [head];
  if (s.extends) out.push(`  extends ${formsSaid(s.extends)}`);
  for (const e of s.evidence ?? []) out.push(`  ${e.person} ${e.name}: ${e.citation}${e.quote ? ` — "${e.quote}"` : ""}`);
  if (s.evidenceMore) out.push(`  … ${s.evidenceMore} more`);
  return out;
}

register(
  {
    path: ["surname", "suggest"],
    summary: "Suggest which written forms of a surname are one family's (from the records; the person decides)",
    group: "people",
    tree: true,
    description:
      "Two levels: documented (one person written so in the records, with a citation) and rules (one sound spelled otherwise at one place in the same years). " +
      "Never the surnames of a woman's husband and her father. Groups and rejections the person decided are left out. " +
      "Only the person accepts or rejects a suggestion (strom surname accept|reject, or in the Strom app).",
    examples: ["strom surname suggest", "strom surname suggest --json"],
    run(ctx) {
      const tree = ctx.tree();
      const a = suggestSurnames(tree);
      const shown = a.suggestions.slice(0, ctx.limit);
      return {
        text: lines(
          a.suggestions.length ? `${a.suggestions.length} suggestions${a.state.truncated ? " (the first ones)" : ""}; ${a.groups.length} groups, ${a.rejected.length} rejected` : `no suggestions; ${a.groups.length} groups, ${a.rejected.length} rejected`,
          ...shown.flatMap(suggestionLines),
          a.suggestions.length > shown.length ? `… ${a.suggestions.length - shown.length} more (--limit, --json)` : undefined,
          a.state.skipped ? `${a.state.skipped} would join two groups: left to the person (strom surname group)` : undefined,
          a.suggestions.length ? "the person decides: strom surname accept|reject <id> in their terminal, or the Strom app" : undefined,
        ),
        data: a,
      };
    },
  },
  {
    path: ["surname", "list"],
    summary: "The groups of surname forms the person made one family, and the suggestions rejected",
    group: "people",
    tree: true,
    examples: ["strom surname list", "strom surname list --json"],
    run(ctx) {
      const f = readSurnames(ctx.tree());
      return {
        text: lines(
          f.groups.length ? `${f.groups.length} groups:` : "no groups",
          ...f.groups.map((g) => `  ${entryLine(g)}`),
          f.rejected.length ? `${f.rejected.length} rejected:` : undefined,
          ...f.rejected.map((r) => `  ${entryLine(r)}`),
        ),
        data: f,
      };
    },
  },
  {
    path: ["surname", "accept"],
    summary: "Accept a suggestion: its forms are one family's (the person's own)",
    group: "people",
    tree: true,
    writes: true,
    person: PERSON,
    args: [{ name: "id", description: "the suggestion's ID (strom surname suggest)", required: true }],
    examples: ['strom surname accept "novak|nowak"'],
    run(ctx, { args }) {
      const e = acceptSuggestion(ctx.tree(), args[0]!);
      return { text: `one family: ${formsSaid(e.forms)}`, data: e };
    },
  },
  {
    path: ["surname", "reject"],
    summary: "Reject a suggestion: never suggested again (the person's own)",
    group: "people",
    tree: true,
    writes: true,
    person: PERSON,
    args: [{ name: "id", description: "the suggestion's ID (strom surname suggest)", required: true }],
    examples: ['strom surname reject "novak|nowak"'],
    run(ctx, { args }) {
      const e = rejectSuggestion(ctx.tree(), args[0]!);
      return { text: e ? `not one family: ${formsSaid(e.forms)}` : `${args[0]} was rejected already`, data: e ?? null };
    },
  },
  {
    path: ["surname", "group"],
    summary: "Make written forms of a surname one family's (groups holding any of them join; the person's own)",
    group: "people",
    tree: true,
    writes: true,
    person: PERSON,
    args: [{ name: "form", description: "two forms at least, as written", required: true, variadic: true }],
    examples: ["strom surname group Novák Nowak"],
    run(ctx, { args }) {
      const r = groupSurnames(ctx.tree(), args);
      return { text: r.changed ? `one family: ${formsSaid(r.entry.forms)}` : `one family already: ${formsSaid(r.entry.forms)}`, data: r.entry };
    },
  },
  {
    path: ["surname", "ungroup"],
    summary: "Take a form out of its group (a group of one form left is no group; the person's own)",
    group: "people",
    tree: true,
    writes: true,
    person: PERSON,
    args: [{ name: "form", description: "the form, as the group writes it", required: true }],
    examples: ["strom surname ungroup Lhotaa"],
    run(ctx, { args }) {
      const r = ungroupSurname(ctx.tree(), args[0]!);
      return { text: r.now ? `${args[0]} apart; one family: ${formsSaid(r.now.forms)}` : `${formsSaid(r.was.forms)}: no group any more`, data: { was: r.was, now: r.now ?? null } };
    },
  },
  {
    path: ["surname", "unreject"],
    summary: "Take back a rejection: the suggestion may come again (the person's own)",
    group: "people",
    tree: true,
    writes: true,
    person: PERSON,
    args: [{ name: "id", description: "the rejected suggestion's ID (strom surname list)", required: true }],
    examples: ['strom surname unreject "svobod|swobod"'],
    run(ctx, { args }) {
      const r = unrejectSurnames(ctx.tree(), args[0]!);
      return { text: `may be suggested again: ${formsSaid(r.forms)}`, data: r };
    },
  },
);
