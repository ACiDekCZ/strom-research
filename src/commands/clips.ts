// strom clips — mark where the entries already read are on their scans, for
// sources that have none (read before clips existed, or brought in from an
// older research): readers find each entry on its image, strom cuts it out, a
// second look checks the cut-out; what passes becomes the source's clip. Run
// again, it takes up only what is still missing.

import fs from "node:fs";
import path from "node:path";
import { register } from "../cli/registry.ts";
import type { Context } from "../cli/context.ts";
import { lines, truncate } from "../cli/format.ts";
import { UsageError } from "../core/errors.ts";
import type { Clip, Family, Media, Person, Source } from "../core/model.ts";
import { normId, requireRecord, update } from "../core/records.ts";
import { makeView, VIEW_MAX } from "../core/views.ts";
import { clipText, MAX_CLIPS, regionText } from "../core/media.ts";
import { withMargin } from "../core/excerpt.ts";
import { batches } from "../core/reader.ts";
import { checkPrompt, locatePrompt, parseChecked, parseLocated, widen, type CheckJob, type Checked, type ClipJob, type Located } from "../core/clipfinder.ts";
import { displayName } from "../core/people.ts";
import { readers } from "./readers.ts";
import { verifyFast } from "../core/integrity.ts";
import { pool } from "./read.ts";
import type { Tree } from "../core/tree.ts";

/** Entries per reader: each is one image (sometimes two) the reader looks at. */
const PER_READER = 10;
/** How many times a cut-out found cut off is cut out wider and checked again. */
const WIDER = 2;

/** Who a source names: the people whose facts cite it. */
export function namesIn(tree: Tree, id: string): string[] {
  const out = new Set<string>();
  for (const p of tree.list<Person>("person"))
    if (p.events.some((e) => e.citations.some((c) => c.source === id)) || p.names.some((n) => n.citations?.some((c) => c.source === id))) out.add(displayName(p));
  for (const f of tree.list<Family>("family"))
    if (f.events.some((e) => e.citations.some((c) => c.source === id)) || f.citations?.some((c) => c.source === id))
      for (const id2 of f.partners) {
        const p = tree.get<Person>(id2);
        if (p) out.add(displayName(p));
      }
  return [...out].slice(0, 8);
}

register({
  path: ["clips"],
  summary: "Mark where entries already read are on their scans (sources without clips): readers find them, a second look checks",
  group: "sources",
  tree: true,
  writes: true,
  lock: "sections",
  description:
    "For sources on images that have no clip yet — read before clips existed, or brought in from an older research.\n" +
    "A reader finds each entry on its image (its words and the people it names are given), strom cuts it out, and a\n" +
    "second reader checks the cut-out shows that entry whole: only then it becomes the source's clip (for the Strom app's\n" +
    "excerpts: output/tree-strom.ged, strom app). Paid model work, about two looks per entry: --dry-run says how many first.\n" +
    "Run again, it takes up only what is still missing. It waits for its readers: run it in the foreground.",
  args: [{ name: "sources", description: "only these sources (S…); default every source on images without a clip", variadic: true }],
  options: [
    { name: "recordset", type: "string", value: "<B…>", description: "only the sources of this book" },
    { name: "limit", type: "string", value: "<n>", description: "at most this many sources this time" },
    { name: "again", type: "boolean", description: "also the sources that have clips (found again, replaced when the check passes)" },
    { name: "batch", type: "string", value: "<n>", description: `entries per reader (default ${PER_READER})` },
    { name: "parallel", type: "string", value: "<n>", description: "readers at the same time (default 3)" },
    { name: "model", type: "string", value: "<model>", description: "model of the readers (default: model.vision — it reads the handwriting to find the entry)" },
    { name: "minutes", type: "string", value: "<n>", description: "time limit of one reader (default 15)" },
  ],
  examples: ["strom clips --dry-run", "strom clips --recordset B0001 --limit 20", "strom clips S0001 S0002"],
  run: async (ctx: Context, { args, opts }) => {
    const tree = ctx.tree();
    const shared = ctx.settings.shared()?.value;
    if (!shared) throw new UsageError("no shared folder with the images is set", { hint: "strom setup" });
    const all = new Map(tree.list<Media>("media").map((m) => [m.id, m]));
    const only = new Set(args.map((a) => requireRecord<Source>(tree, normId(a), "source").id));
    const book = typeof opts.recordset === "string" ? normId(opts.recordset) : undefined;
    const imageOf = (id: string) => {
      const m = all.get(id);
      return m && /^image\/(jpeg|png)$/.test(m.mime) && fs.existsSync(path.join(shared, m.file)) ? m : undefined;
    };
    let todo = tree
      .list<Source>("source")
      .filter((s) => !s.retracted && s.media?.length && (only.size ? only.has(s.id) : true))
      .filter((s) => (book ? s.recordset === book || s.media!.some((m) => all.get(m)?.recordset === book) : true))
      .filter((s) => opts.again || !s.clips?.length);
    const away = todo.filter((s) => !s.media!.some((m) => imageOf(m)));
    todo = todo.filter((s) => s.media!.some((m) => imageOf(m)));
    const limit = opts.limit === undefined ? undefined : Number(opts.limit);
    if (limit !== undefined && !(Number.isInteger(limit) && limit > 0)) throw new UsageError("--limit must be a positive number");
    if (limit) todo = todo.slice(0, limit);
    const size = opts.batch === undefined ? PER_READER : Number(opts.batch);
    if (!Number.isInteger(size) || size < 1) throw new UsageError("--batch must be a positive number");
    const groups = batches(todo, size);
    if (!todo.length)
      return { text: lines("nothing to do: every source on images has its clip", away.length ? `${away.length} source(s) on images not on this computer (or not JPEG/PNG)` : undefined), data: { sources: 0 } };
    if (tree.dryRun)
      return {
        text: lines(
          `${todo.length} source(s) to find on their images — ${groups.length} reader(s) to find them, as many to check`,
          away.length ? `${away.length} more on images not on this computer (or not JPEG/PNG)` : undefined,
          "(dry run — no reader started)",
        ),
        data: { sources: todo.length, readers: groups.length, away: away.map((s) => s.id) },
      };

    const r0 = readers(ctx, tree, shared, "clips", "find", opts);
    const { model, parallel, reportsDir, failed, progress } = r0;
    const reader = r0.read;

    // 1. Find: each image whole, with a grid, and what the entry says.
    const byId = new Map(todo.map((s) => [s.id, s]));
    const found = await pool(groups, parallel, async (group, k) => {
      const jobs: ClipJob[] = group.map((s) => ({
        source: s.id,
        title: s.title,
        facts: [
          s.locator || s.date ? `where: ${[s.locator, s.date ? `recorded ${s.date}` : ""].filter(Boolean).join("; ")}` : "",
          namesIn(tree, s.id).length ? `people in it: ${namesIn(tree, s.id).join(", ")}` : "",
        ].filter(Boolean),
        words: s.transcript ? truncate(s.transcript.replace(/\s+/g, " "), 400) : undefined,
        images: s.media!.flatMap((id) => {
          const m = imageOf(id);
          return m ? [{ media: m.id, view: makeView(tree, path.join(shared, m.file), m.id, { grid: true, max: VIEW_MAX }).file }] : [];
        }),
      }));
      progress(`▶ finding ${k + 1}/${groups.length}: ${group.map((s) => s.id).join(" ")}`);
      const r = await reader(`find-${k + 1}`, jobs.flatMap((j) => j.images.map((i) => i.view)), `Where the entries are · batch ${k + 1} of ${groups.length}`, (report) => locatePrompt(jobs, report));
      const located = parseLocated(r.text).filter((l) => byId.get(l.source)?.media?.includes(l.media));
      progress(`■ finding ${k + 1}: ${r.outcome} · ${located.filter((l) => l.result === "found").length} found`);
      return located;
    });
    const locs = found.flat();
    const hits = locs.filter((l): l is Located & { region: NonNullable<Located["region"]> } => l.result === "found" && !!l.region);

    // 2. Check: the cut-out as the Strom app will show it. Cut off: wider on those sides, and checked again.
    const check = async (list: typeof hits, round: number): Promise<Checked[]> => {
      const checks: CheckJob[] = list.map((l) => {
        const m = all.get(l.media)!;
        const s = byId.get(l.source)!;
        return {
          source: l.source,
          media: l.media,
          title: s.title,
          words: s.transcript ? truncate(s.transcript.replace(/\s+/g, " "), 400) : undefined,
          view: makeView(tree, path.join(shared, m.file), m.id, { crop: regionText(withMargin(l.region)) }).file,
        };
      });
      const checkGroups = batches(checks, size);
      const name = (k: number) => (round ? `check${round + 1}-${k + 1}` : `check-${k + 1}`);
      return (
        await pool(checkGroups, parallel, async (group, k) => {
          progress(`▶ checking${round ? ` again (${round + 1})` : ""} ${k + 1}/${checkGroups.length}: ${group.length} cut-outs`);
          const r = await reader(name(k), group.map((g) => g.view), `Checking the cut-outs${round ? `, cut out wider` : ""} · batch ${k + 1} of ${checkGroups.length}`, (report) => checkPrompt(group, report));
          const v = parseChecked(r.text);
          progress(`■ checking ${k + 1}: ${r.outcome} · ${v.filter((x) => x.verdict === "ok").length} ok`);
          return v;
        })
      ).flat();
    };
    const verdicts: Checked[] = [];
    let open = hits;
    for (let round = 0; open.length && round <= WIDER; round++) {
      const got = await check(open, round);
      const key = (x: { source: string; media: string }) => `${x.source} ${x.media}`;
      const cut = new Map(got.filter((v) => v.verdict === "cut").map((v) => [key(v), v]));
      const last = round === WIDER;
      verdicts.push(...got.filter((v) => v.verdict !== "cut" || last));
      open = last ? [] : open.filter((l) => cut.has(key(l))).map((l) => ({ ...l, region: widen(l.region, cut.get(key(l))!.missing) }));
      hits.splice(0, hits.length, ...hits.filter((h) => !open.some((o) => key(o) === key(h))), ...open);
    }
    const passed = new Set(verdicts.filter((v) => v.verdict === "ok").map((v) => `${v.source} ${v.media}`));

    // 3. What passed becomes the source's clips.
    const clipsOf = new Map<string, Clip[]>();
    for (const l of hits) if (passed.has(`${l.source} ${l.media}`)) clipsOf.set(l.source, [...(clipsOf.get(l.source) ?? []), { media: l.media, region: l.region }].slice(0, MAX_CLIPS));
    for (const [id, clips] of clipsOf)
      update<Source>(tree, id, "source", (s) => ({ ...s, clips }), { op: "source.edit", summary: `${id} clips ${clips.map(clipText).join(" ")} (found by a reader, checked)` });
    // The reports are working notes of the research: committed with it.
    if (verifyFast(tree).findings.every((f) => f.level !== "error"))
      tree.withTreeLock(() => tree.commit(`Clips: ${clipsOf.size} of ${todo.length} entries marked on their scans`, [tree.relative(reportsDir)]));

    const rejected = verdicts.filter((v) => v.verdict !== "ok");
    // a search over many entries, not one entry: no clip, and said so
    const many = [...new Set(locs.filter((l) => l.result === "many").map((l) => l.source))];
    const missed = todo.filter((s) => !clipsOf.has(s.id));
    const text = lines(
      `${clipsOf.size} of ${todo.length} source(s) got their clip${model ? ` · ${model}` : ""}${r0.cost() ? ` · $${r0.cost().toFixed(2)}` : ""}`,
      many.length ? `not one entry but a search over many (no clip — a page of it would show nothing): ${many.join(", ")}` : undefined,
      rejected.length ? `the check turned down: ${rejected.map((v) => `${v.source} (${v.verdict}${v.why ? `: ${truncate(v.why, 40)}` : ""})`).join(", ")}` : undefined,
      missed.length ? `without a clip: ${missed.map((s) => s.id).slice(0, 20).join(", ")}${missed.length > 20 ? ` … (${missed.length})` : ""} — strom source edit S… --clip M…@x,y,w,h, or strom clips again` : undefined,
      away.length ? `on images not on this computer (or not JPEG/PNG): ${away.length}` : undefined,
      failed.length ? `readers that failed: ${failed.join(", ")}` : undefined,
      "the entries cut out for the Strom app: strom app (output/tree-strom.ged)",
    );
    return {
      text,
      data: {
        sources: todo.length,
        clipped: [...clipsOf.keys()],
        rejected,
        many,
        missed: missed.map((s) => s.id),
        away: away.map((s) => s.id),
        failed,
        costUsd: r0.cost() || undefined,
      },
      exitCode: failed.length ? 1 : 0,
    };
  },
});
