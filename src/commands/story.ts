// story set · show — the story of a person or a couple, written from the facts
// for the family. It goes into the GEDCOM as _STORY (Strom sets it in the
// family book after the facts).

import fs from "node:fs";
import { register } from "../cli/registry.ts";
import { lines } from "../cli/format.ts";
import { approveStory, setStory, findEventOwner } from "../core/actions.ts";
import { UsageError } from "../core/errors.ts";
import { csvOpt, normId, textOpt } from "../core/records.ts";
import { resolvePerson } from "../core/people.ts";
import type { Family, Person } from "../core/model.ts";
import type { Tree } from "../core/tree.ts";
import { foldText } from "../core/text.ts";

/**
 * The one heading a story has is its title (--title). A first line "# …" is taken as the title when none is given,
 * and dropped when it only repeats it; any other "# …" line stays (the Strom app shows it as a subheading).
 */
function titleOf(text: string, title: string | undefined): { text: string; title?: string } {
  const [first = "", ...rest] = text.replace(/\r\n?/g, "\n").trimStart().split("\n");
  const heading = /^#[ \t]+(.+?)[ \t#]*$/.exec(first)?.[1]?.trim();
  if (!heading) return { text, ...(title ? { title } : {}) };
  if (!title?.trim()) return { text: rest.join("\n"), title: heading };
  return foldText(heading) === foldText(title) ? { text: rest.join("\n"), title } : { text, title };
}

/**
 * What the Strom app shows as plain text (its set: paragraphs, "## " subheadings, "- " bullets, **bold**,
 * *italic*): said, never refused. Numbered lists count only as two such lines in a row — a date may start a line.
 */
function outsideSet(text: string): string[] {
  const found: string[] = [];
  const lns = text.split("\n");
  if (/\[[^\]\n]+\]\([^)\n]+\)/.test(text)) found.push("links");
  if (lns.filter((l) => /^\s*\|.*\|\s*$/.test(l)).length >= 2) found.push("tables");
  if (lns.some((l) => /^\s*>/.test(l))) found.push("quotes (> )");
  if (/`[^`\n]+`/.test(text)) found.push("code");
  if (lns.some((l, i) => /^\s*\d+[.)]\s/.test(l) && /^\s*\d+[.)]\s/.test(lns[i + 1] ?? ""))) found.push("numbered lists");
  // "* 1831" is the sign of a birth, no bullet
  if (lns.some((l) => /^\s*[*+]\s+(?!\d)/.test(l))) found.push('bullets other than "- "');
  return found;
}

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
      "Every statement rests on a recorded fact: list them with --fact. Paragraphs are separated by a blank line.\n" +
      "Kept: \"## subheading\" lines, \"- \" bullet lines, **bold**, *italic*; anything else shows as plain text in the\n" +
      "Strom app. The title goes in --title (a first line \"# …\" is taken as it). Writing it again replaces it (the\n" +
      "history keeps the old one).",
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
      const given = textOpt(opts.text, (p) => fs.readFileSync(ctx.resolvePath(p), "utf8"));
      if (!given?.trim()) throw new UsageError("--text is required", { hint: "--text @notes/story.md (a file) or the text itself" });
      const { text, title } = titleOf(given, opts.title as string | undefined);
      const rec = setStory(tree, owner(tree, args[0]!), {
        text,
        title,
        facts: csvOpt(opts.fact).map((f) => normId(f)),
        note: opts.note as string | undefined,
        final: Boolean(opts.final),
      });
      const missing = rec.story!.facts.length === 0 ? "note: no --fact given — say which facts the story rests on" : undefined;
      const outside = outsideSet(rec.story!.text);
      const plain = outside.length ? `note: the Strom app shows ${outside.join(", ")} as plain text — keep to paragraphs, "## " subheadings, "- " bullets, **bold**, *italic*` : undefined;
      return { text: lines(...tree.written.map((o) => o.summary), tree.dryRun ? "(dry run — nothing written)" : undefined, missing, plain), data: { story: rec.story } };
    },
  },
  {
    path: ["story", "approve"],
    summary: "The user approved the story as it is: no longer a draft",
    group: "people",
    tree: true,
    writes: true,
    description: "Only on the user's word (they read it and said it is right): the text stays, the draft becomes the story of the family book.",
    args: [{ name: "who", description: "person (ID or name) or family (F…)", required: true }],
    examples: ["strom story approve P0001"],
    run(ctx, { args }) {
      const tree = ctx.tree();
      const id = owner(tree, args[0]!);
      const was = tree.get<Person | Family>(id)?.story?.status;
      const rec = approveStory(tree, id);
      return { text: was === "final" ? `${id} story was approved already` : lines(...tree.written.map((o) => o.summary)), data: { story: rec.story } };
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
