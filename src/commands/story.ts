// story set · show — the story of a person or a couple, written from the facts
// for the family. It goes into the GEDCOM as _STORY (Strom sets it in the
// family book after the facts).

import fs from "node:fs";
import { register } from "../cli/registry.ts";
import { lines } from "../cli/format.ts";
import { setStory, findEventOwner } from "../core/actions.ts";
import { UsageError } from "../core/errors.ts";
import { csvOpt, normId, textOpt } from "../core/records.ts";
import { resolvePerson } from "../core/people.ts";
import type { Family, Person } from "../core/model.ts";
import type { Tree } from "../core/tree.ts";

function owner(tree: Tree, ref: string): string {
  return /^F\d+$/i.test(ref.trim()) ? normId(ref, "family") : resolvePerson(tree, ref).id;
}

register(
  {
    path: ["story", "set"],
    summary: "Write the story of a person or a couple from the facts (a draft until the user approves it)",
    group: "people",
    tree: true,
    writes: true,
    description:
      "Every statement rests on a recorded fact: list them with --fact. Paragraphs are separated by a blank line;\n" +
      "**bold** is kept. Writing it again replaces it (the history keeps the old one).",
    args: [{ name: "who", description: "person (ID or name) or family (F…)", required: true }],
    options: [
      { name: "text", type: "string", value: "<text|@file>", description: "the story, in the research language" },
      { name: "title", type: "string", value: "<text>", description: "a heading" },
      { name: "fact", type: "string", multiple: true, value: "<E…>", description: "a fact it leans on (repeatable)" },
      { name: "note", type: "string", value: "<text>", description: "your caveat: what is inferred, what is unknown" },
      { name: "final", type: "boolean", description: "the user approved it" },
    ],
    examples: ['strom story set P0001 --text @notes/story-P0001.md --title "The miller of Týnec" --fact E0001 --fact E0002 --note "The house is inferred from the census."'],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      const text = textOpt(opts.text, (p) => fs.readFileSync(ctx.resolvePath(p), "utf8"));
      if (!text?.trim()) throw new UsageError("--text is required", { hint: "--text @notes/story.md (a file) or the text itself" });
      const rec = setStory(tree, owner(tree, args[0]!), {
        text,
        title: opts.title as string | undefined,
        facts: csvOpt(opts.fact).map((f) => normId(f)),
        note: opts.note as string | undefined,
        final: Boolean(opts.final),
      });
      const missing = rec.story!.facts.length === 0 ? "note: no --fact given — say which facts the story rests on" : undefined;
      return { text: lines(...tree.written.map((o) => o.summary), tree.dryRun ? "(dry run — nothing written)" : undefined, missing), data: { story: rec.story } };
    },
  },
  {
    path: ["story", "show"],
    summary: "The story of a person or a couple, with the facts it rests on",
    group: "people",
    tree: true,
    args: [{ name: "who", description: "person (ID or name) or family (F…)", required: true }],
    run(ctx, { args }) {
      const tree = ctx.tree();
      const id = owner(tree, args[0]!);
      const rec = tree.get<Person | Family>(id);
      if (!rec) throw new UsageError(`no family ${id}`);
      const st = rec.story;
      if (!st) return { text: `${id} has no story yet → strom story set ${id} --text @file --fact E…`, data: { story: null } };
      const facts = st.facts.map((f) => {
        try {
          const { owner: o, event: e } = findEventOwner(tree, f);
          return `  ${e.id} ${o.id} ${e.kind}${e.date ? ` ${e.date}` : ""}${e.place ? ` ${e.place}` : ""} [${e.status}]`;
        } catch {
          return `  ${f} (no longer exists)`;
        }
      });
      return {
        text: lines(`${id} story · ${st.status} · ${st.at.slice(0, 10)}${st.title ? ` · ${st.title}` : ""}`, "", st.text, "", st.facts.length ? "rests on" : "rests on no recorded fact", ...facts, st.note ? `\nnote: ${st.note}` : undefined),
        data: { story: st },
      };
    },
  },
);
