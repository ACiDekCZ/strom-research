// strom transcripts — the words of entries already on their scans, for sources
// that have a clip but no transcript (read before strom asked for the words, or
// brought in from an older research): a reader writes them from the entry cut
// out of its scan, a second reader holds them against the same cut-out; what
// passes becomes the source's transcript, with a note of how it was made. Run
// again, it takes up only what is still missing.

import fs from "node:fs";
import path from "node:path";
import { register } from "../cli/registry.ts";
import type { Context } from "../cli/context.ts";
import { lines, truncate } from "../cli/format.ts";
import { UsageError } from "../core/errors.ts";
import { EXCERPT_SCOPES, type ExcerptScope, type Input, type Media, type Source } from "../core/model.ts";
import { normId, requireRecord, update } from "../core/records.ts";
import { makeView } from "../core/views.ts";
import { inputPath, regionText, sharperPart } from "../core/media.ts";
import { SCOPE_MAX, sourceNearness, withMargin } from "../core/excerpt.ts";
import { batches } from "../core/reader.ts";
import { checkTranscriptPrompt, parseTranscriptChecks, parseTranscribed, transcribePrompt, type TranscribeJob } from "../core/transcriber.ts";
import { makeNote } from "../core/actions.ts";
import { phrase } from "../core/phrases.ts";
import { verifyFast } from "../core/integrity.ts";
import { pool } from "./read.ts";
import { readers } from "./readers.ts";
import { namesIn } from "./clips.ts";

/** Entries per reader. */
const PER_READER = 8;
/** A cut-out as the reader sees it: sharp enough to read a hand, small enough to open. */
const CUT_MAX = 2000;

register({
  path: ["transcripts"],
  summary: "Write the words of entries already cut out of their scans (sources with a clip, no transcript): readers read them, a second look checks",
  group: "sources",
  tree: true,
  writes: true,
  lock: "sections",
  description:
    "For sources with a clip (or a document the user gave as a scan) and no transcript — read before strom asked for the\n" +
    "words, or brought in from an older research. A reader writes the entry's words from its cut-out, as they stand (its\n" +
    "own language and spelling, unread letters [?]); a second reader holds them against the same cut-out and corrects\n" +
    "them: only then they become the source's transcript, with a note of how they were made. The Strom app shows them next\n" +
    "to the entry's image. Paid model work, two looks per entry: --dry-run says how many first. Nearest the research first.",
  args: [{ name: "sources", description: "only these sources (S…)", variadic: true }],
  options: [
    { name: "for", type: "string", value: "<whose>", description: "line, family, connected or all (default: all — the nearest to the research first)" },
    { name: "limit", type: "string", value: "<n>", description: "at most this many sources this time" },
    { name: "batch", type: "string", value: "<n>", description: `entries per reader (default ${PER_READER})` },
    { name: "parallel", type: "string", value: "<n>", description: "readers at the same time (default 3)" },
    { name: "model", type: "string", value: "<model>", description: "model of the readers (default: model.vision — it reads the handwriting)" },
    { name: "minutes", type: "string", value: "<n>", description: "time limit of one reader (default 15)" },
  ],
  examples: ["strom transcripts --dry-run", "strom transcripts --for family --limit 20", "strom transcripts S0001 S0002"],
  run: async (ctx: Context, { args, opts }) => {
    const tree = ctx.tree();
    const shared = ctx.settings.shared()?.value;
    if (!shared) throw new UsageError("no shared folder with the images is set", { hint: "strom setup" });
    const scope = (typeof opts.for === "string" ? opts.for : "all") as ExcerptScope;
    if (!EXCERPT_SCOPES.includes(scope) || scope === "none") throw new UsageError(`invalid --for "${opts.for}"`, { hint: "line, family, connected or all" });
    const all = tree.list<Media>("media");
    const byId = new Map(all.map((m) => [m.id, m]));
    const only = new Set(args.map((a) => requireRecord<Source>(tree, normId(a), "source").id));
    const near = sourceNearness(tree);
    const rank = (s: Source) => near.get(s.id) ?? 4;

    /** The cut-outs of a source, from the sharpest image of the place there is; none when its image is not here. */
    const cutsOf = (s: Source): { media: string; file: string; crop?: string }[] => {
      if (s.clips?.length)
        return s.clips.flatMap((c) => {
          const m = byId.get(c.media);
          if (!m) return [];
          const wanted = withMargin(c.region);
          const sharper = sharperPart(all, m, wanted);
          const src = sharper?.part ?? m;
          const file = path.join(shared, src.file);
          return /^image\/(jpeg|png)$/.test(src.mime) && fs.existsSync(file) ? [{ media: m.id, file, crop: regionText(sharper?.crop ?? wanted) }] : [];
        });
      const input = s.input ? tree.get<Input>(s.input) : undefined;
      const file = input ? inputPath(tree, input) : undefined;
      return input && file && /\.(jpe?g|png)$/i.test(file) && fs.existsSync(file) ? [{ media: input.id, file }] : [];
    };
    let todo = tree
      .list<Source>("source")
      .filter((s) => !s.retracted && !s.transcript?.trim() && (s.clips?.length || s.input))
      .filter((s) => (only.size ? only.has(s.id) : rank(s) <= SCOPE_MAX[scope]))
      .sort((a, b) => rank(a) - rank(b) || a.id.localeCompare(b.id));
    const away = todo.filter((s) => !cutsOf(s).length);
    todo = todo.filter((s) => cutsOf(s).length);
    const limit = opts.limit === undefined ? undefined : Number(opts.limit);
    if (limit !== undefined && !(Number.isInteger(limit) && limit > 0)) throw new UsageError("--limit must be a positive number");
    if (limit) todo = todo.slice(0, limit);
    const size = opts.batch === undefined ? PER_READER : Number(opts.batch);
    if (!Number.isInteger(size) || size < 1) throw new UsageError("--batch must be a positive number");
    const groups = batches(todo, size);
    if (!todo.length)
      return { text: lines("nothing to do: every entry cut out of its scan has its words", away.length ? `${away.length} source(s) on images not on this computer` : undefined), data: { sources: 0 } };
    if (tree.dryRun)
      return {
        text: lines(
          `${todo.length} source(s) to transcribe from their cut-outs — ${groups.length} reader(s) to read them, as many to check`,
          away.length ? `${away.length} more on images not on this computer` : undefined,
          "(dry run — no reader started)",
        ),
        data: { sources: todo.length, readers: groups.length, away: away.map((s) => s.id) },
      };

    const r0 = readers(ctx, tree, shared, "transcripts", "read", opts);
    const { parallel, reportsDir, failed, progress } = r0;
    const facts = (s: Source) =>
      [
        s.locator || s.date ? `where: ${[s.locator, s.date ? `recorded ${s.date}` : ""].filter(Boolean).join("; ")}` : "",
        namesIn(tree, s.id).length ? `people in it: ${namesIn(tree, s.id).join(", ")}` : "",
        s.language ? `language: ${s.language}` : "",
      ].filter(Boolean);
    const job = (s: Source): TranscribeJob => ({
      source: s.id,
      title: s.title,
      facts: facts(s),
      views: cutsOf(s).map((c) => ({ media: c.media, view: makeView(tree, c.file, c.media, { ...(c.crop ? { crop: c.crop } : {}), max: CUT_MAX }).file })),
    });

    // 1. Read: the words from the cut-out.
    const jobs = new Map(todo.map((s) => [s.id, job(s)]));
    const read = (
      await pool(groups, parallel, async (group, k) => {
        const js = group.map((s) => jobs.get(s.id)!);
        progress(`▶ reading ${k + 1}/${groups.length}: ${group.map((s) => s.id).join(" ")}`);
        const r = await r0.read(`read-${k + 1}`, js.flatMap((j) => j.views.map((v) => v.view)), `The words of the entries · batch ${k + 1} of ${groups.length}`, (report) => transcribePrompt(js, report));
        const got = parseTranscribed(r.text).filter((x) => jobs.has(x.source));
        progress(`■ reading ${k + 1}: ${r.outcome} · ${got.filter((x) => x.result === "read").length} read`);
        return got;
      })
    ).flat();
    const words = read.filter((x) => x.result === "read");

    // 2. Check: the same cut-out, word by word.
    const checks = words.map((x) => ({ ...jobs.get(x.source)!, transcript: x.transcript! }));
    const checkGroups = batches(checks, size);
    const verdicts = (
      await pool(checkGroups, parallel, async (group, k) => {
        progress(`▶ checking ${k + 1}/${checkGroups.length}: ${group.length} transcripts`);
        const r = await r0.read(`check-${k + 1}`, group.flatMap((j) => j.views.map((v) => v.view)), `Checking the words · batch ${k + 1} of ${checkGroups.length}`, (report) => checkTranscriptPrompt(group, report));
        const v = parseTranscriptChecks(r.text);
        progress(`■ checking ${k + 1}: ${r.outcome} · ${v.filter((x) => x.verdict !== "wrong").length} passed`);
        return v;
      })
    ).flat();

    // 3. What passed becomes the source's transcript, with how it was made.
    const passed = new Map<string, string>();
    for (const v of verdicts) {
      const first = words.find((x) => x.source === v.source);
      if (!first || passed.has(v.source)) continue;
      if (v.verdict === "ok") passed.set(v.source, first.transcript!);
      else if (v.verdict === "fixed") passed.set(v.source, v.transcript!);
    }
    const day = new Date().toISOString().slice(0, 10);
    const how = phrase(tree.lang, "transcript.read", { model: r0.model ?? "?", date: day });
    for (const [id, transcript] of passed)
      update<Source>(tree, id, "source", (s) => ({ ...s, transcript, notes: [...s.notes, makeNote(tree, how)] }), {
        op: "source.edit",
        summary: `${id} transcript (${transcript.split("\n").length} line(s), read by a reader, checked)`,
      });
    if (verifyFast(tree).findings.every((f) => f.level !== "error"))
      tree.withTreeLock(() => tree.commit(`Transcripts: ${passed.size} of ${todo.length} entries written from their cut-outs`, [tree.relative(reportsDir)]));

    const rejected = verdicts.filter((v) => v.verdict === "wrong");
    const unread = read.filter((x) => x.result !== "read");
    const missed = todo.filter((s) => !passed.has(s.id));
    return {
      text: lines(
        `${passed.size} of ${todo.length} source(s) got their words${r0.model ? ` · ${r0.model}` : ""}${r0.cost() ? ` · $${r0.cost().toFixed(2)}` : ""}`,
        verdicts.some((v) => v.verdict === "fixed") ? `the check corrected ${verdicts.filter((v) => v.verdict === "fixed").length} of them` : undefined,
        rejected.length ? `the check turned down: ${rejected.map((v) => `${v.source}${v.why ? ` (${truncate(v.why, 40)})` : ""}`).join(", ")}` : undefined,
        unread.length ? `not read (unreadable, or not this entry in the cut-out): ${unread.map((x) => `${x.source} ${x.result}`).slice(0, 20).join(", ")}` : undefined,
        missed.length ? `without words: ${missed.map((s) => s.id).slice(0, 20).join(", ")}${missed.length > 20 ? ` … (${missed.length})` : ""} — strom transcripts again, or strom source edit S… --transcript @<file>` : undefined,
        away.length ? `on images not on this computer: ${away.length}` : undefined,
        failed.length ? `readers that failed: ${failed.join(", ")}` : undefined,
        "the words go into the Strom app with the entry's image: strom app (output/tree-strom.ged)",
      ),
      data: {
        sources: todo.length,
        transcribed: [...passed.keys()],
        corrected: verdicts.filter((v) => v.verdict === "fixed").map((v) => v.source),
        rejected,
        unread: unread.map((x) => ({ source: x.source, result: x.result })),
        missed: missed.map((s) => s.id),
        away: away.map((s) => s.id),
        failed,
        costUsd: r0.cost() || undefined,
      },
      exitCode: failed.length ? 1 : 0,
    };
  },
});
