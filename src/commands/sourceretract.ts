// strom source retract | restore: a source the person deletes — retracted in the research with its citations kept in it,
// put back as it was (spec 117, core/sourceretract.ts). The person's alone: their terminal (their yes), a window of the
// system, or the Strom app's bridge with the confirmation it signed of what the person saw; an agent only previews it
// (--dry-run) to propose it to the person with the counts.

import fs from "node:fs";
import { register } from "../cli/registry.ts";
import type { Context } from "../cli/context.ts";
import { lines, shellArg } from "../cli/format.ts";
import { ui } from "../cli/ui.ts";
import { notFound, UsageError } from "../core/errors.ts";
import { phrase } from "../core/phrases.ts";
import { checkRetractConfirm, restoreSources, retractImpacts, retractSources, RETRACT_MOST, type SourceImpacts } from "../core/sourceretract.ts";
import type { Source } from "../core/model.ts";
import { isAgent } from "../core/which.ts";

const PERSON_RETRACT =
  "Deleting a source is the person's own (the Strom app, or their terminal): an agent shows what it would take (strom source retract <S…> --dry-run) and proposes it, never runs it";
const PERSON_RESTORE = "Putting back a source the person deleted is the person's own (the Strom app, or their terminal): an agent tells them it can be, never runs it";

/** The sources given: the arguments and --sources-from (a file, - stdin: the bridge's list). */
function sourcesGiven(ctx: Context, args: string[], opts: Record<string, unknown>): string[] {
  const from = opts["sources-from"];
  let more: string[] = [];
  if (typeof from === "string") {
    const text = from === "-" ? (ctx.io.stdinText?.() ?? "") : fs.existsSync(ctx.resolvePath(from)) ? fs.readFileSync(ctx.resolvePath(from), "utf8") : undefined;
    if (text === undefined) throw notFound(from);
    more = text.split(/[\s,]+/u).filter(Boolean);
  }
  const ids = [...args, ...more];
  if (!ids.length) throw new UsageError("give the sources (S…)", { code: "source.body", hint: "strom source list" });
  return ids;
}

const citesOf = (i: SourceImpacts) => i.counts.names + i.counts.events + i.counts.families;
/** A list of what it takes for a person: its first IDs, how many more. */
const some = (ids: string[], more = 0) => (ids.length ? `${ids.slice(0, 5).join(", ")}${ids.length + more > 5 ? ` (+${ids.length + more - Math.min(ids.length, 5)})` : ""}` : "0");
const factIds = (list: { owner: string; event?: string; fact: string }[]) => list.map((f) => `${f.owner} ${f.fact}`);

/** What deleting a source would take, for a person (strom source retract --dry-run, strom input delete --retract-sources). */
export function wouldLine(lang: string, i: SourceImpacts): string {
  return ui(lang, "ui.source.retract.would", {
    name: i.title,
    id: i.id,
    cites: citesOf(i),
    stories: i.counts.stories,
    bare: some(factIds(i.bare), i.more.bare),
    lowered: some(factIds(i.lowered), i.more.lowered),
    tasks: some(i.tasks.map((t) => `${t.id} ${t.becomes}`), i.more.tasks),
    conflicts: some(i.conflicts.filter((c) => c.becomes === "review").map((c) => c.id)),
  });
}

const sourcesOption = { name: "sources-from", type: "string" as const, value: "<file|->", description: "the source IDs from a file, one a line (- = stdin)" };

register(
  {
    path: ["source", "retract"],
    summary: "Delete a source: retracted with its citations kept in it, to be put back (the person's alone); --dry-run says what it takes",
    group: "sources",
    tree: true,
    writes: true,
    // the preview reads only: anybody's, an agent's too, also on a research sealed on another computer
    writesWith: ({ opts }) => !opts["dry-run"],
    person: PERSON_RETRACT,
    agentMay: { when: "--dry-run (what it would take, to propose it to the person with the counts)", check: (_ctx, { opts }) => !!opts["dry-run"] },
    description:
      `Of each source given (at most ${RETRACT_MOST}): retracted (the reason "deleted"), gone from the family tree the Strom app gets.\n` +
      "Its citations are taken off the facts, names and families and kept in the source; the values stay, a fact the\n" +
      "citations left cannot carry as sure is lowered; a main citation goes (none other is chosen). A task working on it\n" +
      "alone is given up, one with other places goes on without it; a conflict standing on it is marked for review, its\n" +
      "state kept (strom conflict keep, or deciding it, takes the mark off). The text of a story never changes. One\n" +
      "operation of the history; strom source restore puts back what it took. All or nothing: a source the research does\n" +
      "not have or retracted already, and nothing is written. --dry-run says all of it (--json: impacts), anybody's. Without\n" +
      "it the person says yes in their own terminal (Enter says no), else in a window of the system; nobody to ask: exit\n" +
      "4. An agent never runs it: it may propose it to the person with the counts of --dry-run. Many sources:\n" +
      "--sources-from <file> (one ID a line; - = stdin).",
    args: [{ name: "sources", description: "source IDs (S0001 …)", variadic: true, unless: ["sources-from"] }],
    options: [
      sourcesOption,
      // the Strom app's yes: what its bridge signed of the impacts the person saw there (POST /source/retract)
      { name: "confirm", type: "string", value: "<token>", hidden: true, description: "the Strom app's confirmation, signed by its bridge" },
    ],
    examples: ["strom source retract S0002 --dry-run", 'strom source retract S0002 --reason "<why>"'],
    async run(ctx, { args, opts }) {
      const tree = ctx.tree();
      const impacts = retractImpacts(tree, sourcesGiven(ctx, args, opts));
      const sources = impacts.map((i) => i.id);
      const lang = tree.lang;
      if (ctx.dryRun) return { text: lines(...impacts.map((i) => wouldLine(lang, i))), data: { sources, impacts } };
      const reason = typeof opts.reason === "string" ? opts.reason : undefined;
      if (typeof opts.confirm === "string") {
        // the Strom app's: its bridge signed the impacts the person saw and said yes to there — only those, only a while.
        // An agent's marks outweigh STROM_FOR_APP (the bridge runs this without them)
        if (isAgent(ctx.env)) throw new UsageError("an agent never deletes a source, not even with the Strom app's confirmation: nothing written", { code: "source.agent", hint: "the person deletes it in the Strom app, or says yes to strom source retract in their own terminal" });
        const said = ctx.env.STROM_FOR_APP === "1" ? checkRetractConfirm(tree.key, sources, impacts, opts.confirm) : "invalid";
        if (said === "changed")
          throw new UsageError("deleting the sources would take other things with them than the person saw: nothing written", { code: "source.retract-changed", params: { sources: sources.join(",").slice(0, 200) }, hint: "the person looks at the list again in the Strom app" });
        if (said !== "ok") throw new UsageError("no confirmation of the Strom app that holds (signed by its bridge, at most 15 minutes old): nothing written", { code: "source.body", hint: "strom help source retract" });
      } else {
        const set = `strom source retract ${sources.length > 10 ? `${sources.slice(0, 10).join(" ")} …` : sources.join(" ")}${reason ? ` --reason ${shellArg(reason)}` : ""}`;
        const says = ui(ctx.uiLang(), "ui.consent.retract", {
          list: impacts.map((i) => `${i.title} [${i.id}]`).join(", "),
          cites: impacts.reduce((n, i) => n + citesOf(i), 0),
          stories: impacts.reduce((n, i) => n + i.counts.stories, 0),
          lowered: impacts.reduce((n, i) => n + i.lowered.length + i.more.lowered, 0),
        });
        const how = await ctx.requireHumanYes(`Delete ${sources.length} source(s) (${sources.slice(0, 10).join(", ")}${sources.length > 10 ? " …" : ""})? Only the user decides this; an agent never deletes one, it may propose it.`, set, "source.retract", says);
        if (!how) return { text: ui(ctx.uiLang(), "ui.consent.delete.no"), data: { sources, retracted: [], impacts } };
      }
      const got = retractSources(tree, sources, { via: ctx.env.STROM_FOR_APP === "1" ? "bridge" : "terminal", ...(reason ? { reason } : {}) });
      return {
        text: lines(
          ...got.impacts.map((i) => phrase(lang, "log.source.deleted", { name: i.title, id: i.id, cites: citesOf(i), stories: i.counts.stories })),
          `strom source restore ${got.retracted.join(" ")}`,
        ),
        data: got,
      };
    },
  },
  {
    path: ["source", "restore"],
    summary: "Put back a source the person deleted (strom source retract): the same ID, its citations where they were (the person's alone)",
    group: "sources",
    tree: true,
    writes: true,
    person: PERSON_RESTORE,
    description:
      "Of each source given (deleted by strom source retract): the same record back, each citation kept in it on the fact\n" +
      "it was on — found by its ID where it is now (a person merged since: under the one it went into) — unless the fact\n" +
      "is gone or cites it again already (--json: skipped, why gone | already | main); a main citation only where no other\n" +
      "became main meanwhile; a status lowered only where nobody changed it since and the citations carry it; the tasks it\n" +
      "changed where unchanged since (never with a place of a source still deleted); the marks of review gone. One\n" +
      "operation of the history. Refused: a source not retracted (source.notRetracted), one retracted otherwise — merged,\n" +
      "taken back by a sync (source.notRestorable).",
    args: [{ name: "sources", description: "source IDs (S0001 …)", variadic: true, unless: ["sources-from"] }],
    options: [sourcesOption],
    examples: ["strom source restore S0007"],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      const got = restoreSources(tree, sourcesGiven(ctx, args, opts));
      const lang = tree.lang;
      const skipped = got.skipped.filter((s) => s.why !== "main").length;
      return {
        text: lines(
          phrase(lang, "log.source.restored", { name: got.restored.map((id) => tree.get<Source>(id)?.title ?? id).join(", "), id: got.restored.join(", "), cites: got.citations }),
          skipped ? ui(lang, "ui.source.restore.skipped", { n: skipped }) : undefined,
        ),
        data: got,
      };
    },
  },
);
