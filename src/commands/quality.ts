// strom person compare: two people the Strom app would show as a possible duplicate, judged by the research (read only,
// an agent's too). strom quality …: the person's "not an error" on a finding of the app's validation
// (core/quality.ts) — marked or taken back only by the person (here in the terminal, or in the Strom app through the
// bridge), never by an agent.

import fs from "node:fs";
import { register } from "../cli/registry.ts";
import { lines } from "../cli/format.ts";
import { UsageError } from "../core/errors.ts";
import { judgePairs, pairsOf, PAIRS_MAX } from "../core/duplicates.ts";
import type { Verdict } from "../core/duplicates.ts";
import { askOf, dismiss, markSaid, qualityRev, readDismissed, undoDismiss } from "../core/quality.ts";
import type { Dismissal } from "../core/quality.ts";
import { settleAfterDeath } from "../core/afterdeath.ts";

const PERSON = "Marking a finding no error is the person's own decision (in the Strom app, or in their terminal): never written by an agent";

const verdictLine = (v: Verdict) =>
  `${v.pair.map(String).join(" × ")}  ${v.verdict ?? "-"} · ${v.reason}${v.years ? ` (${v.years[0]}, ${v.years[1]})` : ""}${v.into ? ` → ${v.into}` : ""}${v.at ? ` (${v.by === "app" ? "the Strom app" : "the terminal"}, ${v.at.slice(0, 10)})` : ""}`;

const markLine = (d: Dismissal) => `${markSaid(d)}  (${d.by === "app" ? "the Strom app" : "the terminal"}, ${d.at.slice(0, 10)})`;

register(
  {
    path: ["person", "compare"],
    summary: "Judge whether two people are one: same, different or unsure, and why (read only)",
    group: "people",
    tree: true,
    description:
      "The first rule that holds decides: unknown-person, merged, decided (the person said they are two), different-sex, parent-child, " +
      "years-apart (birth or baptism more than 3 years apart), life-no-overlap, siblings, different-parents, names-differ (unsure), " +
      `same-parents, same-events, close-years (unsure), no-date (unsure). Many pairs: --pairs-from <file|-> (lines of two IDs, or {"pairs": [[…], …]}; at most ${PAIRS_MAX}).`,
    args: [{ name: "person", description: "two people (P…)", variadic: true }],
    options: [{ name: "pairs-from", type: "string", value: "<file|->", description: 'pairs from a file ("-" = stdin): two IDs a line, or JSON {"pairs": [["P…", "P…"], …]}' }],
    examples: ["strom person compare P0001 P0002", "strom person compare P0001 P0002 --json", "strom person compare --pairs-from pairs.txt"],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      const from = opts["pairs-from"];
      let pairs: unknown[][];
      if (typeof from === "string") {
        if (args.length) throw new UsageError("either two people or --pairs-from, not both");
        const text = from === "-" ? (ctx.io.stdinText?.() ?? "") : fs.existsSync(ctx.resolvePath(from)) ? fs.readFileSync(ctx.resolvePath(from), "utf8") : undefined;
        if (text === undefined) throw new UsageError(`no file ${from}`);
        const got = pairsOf(text);
        if (!got) throw new UsageError(`the pairs: two IDs (P…) a line, or {"pairs": [["P…", "P…"], …]}, at most ${PAIRS_MAX}`, { code: "duplicates.body" });
        pairs = got;
      } else {
        if (args.length !== 2) throw new UsageError("give two people (P…), or --pairs-from <file|->", { hint: "strom person compare P0001 P0002" });
        pairs = [args.map((a) => a.trim().toUpperCase())];
      }
      const verdicts = judgePairs(tree, pairs);
      return { text: lines(...verdicts.map(verdictLine)), data: { rev: qualityRev(tree), verdicts } };
    },
  },
  {
    path: ["quality", "list"],
    summary: "The findings of the Strom app's validation the person marked no error",
    group: "people",
    tree: true,
    examples: ["strom quality list", "strom quality list --json"],
    run(ctx) {
      const tree = ctx.tree();
      const f = readDismissed(tree);
      return {
        text: lines(f.dismissed.length ? `${f.dismissed.length} marked no error:` : "nothing marked no error", ...f.dismissed.map((d) => `  ${markLine(d)}`)),
        data: { rev: qualityRev(tree), dismissed: f.dismissed },
      };
    },
  },
  {
    path: ["quality", "dismiss"],
    summary: "Mark a finding no error (the person's own): never reported again, a possible duplicate is two people",
    group: "people",
    tree: true,
    writes: true,
    person: PERSON,
    description:
      "The kind is the Strom app's (possibleDuplicate, eventAfterDeath, weddingAfterDeath, …; any is kept). " +
      "possibleDuplicate: the two are two people (strom person compare says decided; never suggested as one). " +
      "eventAfterDeath / weddingAfterDeath with --subject <the event's year>: strom check no longer warns of it and no task looks into it. Marked again: nothing changes.",
    args: [
      { name: "kind", description: "the kind of the finding", required: true },
      { name: "person", description: "its people (P…), 1–20", required: true, variadic: true },
    ],
    options: [{ name: "subject", type: "string", value: "<text>", description: "what the finding is of beyond its people: the event's year, a name" }],
    examples: ["strom quality dismiss possibleDuplicate P0001 P0002", "strom quality dismiss eventAfterDeath P0001 --subject 1861"],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      const ask = askOf(tree, args[0], args.slice(1), opts.subject);
      const r = dismiss(tree, ask, ctx.env.STROM_FOR_APP === "1" ? "app" : "research");
      const settled = r.changed ? settleAfterDeath(tree) : [];
      return {
        text: lines(r.changed ? `no error: ${markSaid(r.entry)}` : `marked no error already: ${markSaid(r.entry)}`, settled.length ? `done: ${settled.join(", ")} (nothing to look into)` : undefined),
        data: { changed: r.changed, entry: r.entry, dismissed: readDismissed(tree).dismissed, ...(settled.length ? { tasksDone: settled } : {}) },
      };
    },
  },
  {
    path: ["quality", "undo"],
    summary: "Take back a mark: the finding may be reported again (the person's own)",
    group: "people",
    tree: true,
    writes: true,
    person: PERSON,
    args: [
      { name: "kind", description: "the kind of the finding", required: true },
      { name: "person", description: "its people (P…), as marked", required: true, variadic: true },
    ],
    options: [{ name: "subject", type: "string", value: "<text>", description: "its subject, as marked" }],
    examples: ["strom quality undo possibleDuplicate P0001 P0002"],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      const ask = askOf(tree, args[0], args.slice(1), opts.subject);
      const r = undoDismiss(tree, ask);
      return {
        text: r.entry ? `may be reported again: ${markSaid(r.entry)}` : `not marked: ${markSaid(ask)}`,
        data: { changed: r.changed, ...(r.entry ? { entry: r.entry } : {}), dismissed: readDismissed(tree).dismissed },
      };
    },
  },
);
