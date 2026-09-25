// strom read — browse images with readers: batches of at most ten images, each
// read by an agent with a clean context that writes its report to
// notes/readings/ as it goes. The researcher gets a few lines back: where
// something was found. Readers never write to the research.

import fs from "node:fs";
import path from "node:path";
import { register } from "../cli/registry.ts";
import type { Context } from "../cli/context.ts";
import { lines, runs } from "../cli/format.ts";
import { StromError, UsageError } from "../core/errors.ts";
import type { Media, RecordSet } from "../core/model.ts";
import { normId, requireRecord } from "../core/records.ts";
import { pageOf } from "../core/calibration.ts";
import { findImage, imageOfRef } from "../core/media.ts";
import { makeView, parseCrop, tiles, VIEW_MAX } from "../core/views.ts";
import { BATCH, BATCH_MAX, batches, parseReport, readerPrompt, readerSettings, type Finding, type ReaderImage } from "../core/reader.ts";
import { RUNNERS } from "../runners/index.ts";
import { which } from "../core/which.ts";
import { permissionPath } from "../agents/files.ts";
import { verifyFast } from "../core/integrity.ts";
import { truncate } from "../cli/format.ts";

/** "40-69" → [40, 69] */
function range(v: string): [number, number] {
  const m = /^(\d+)(?:-(\d+))?$/.exec(v.trim());
  if (!m) throw new UsageError(`invalid --images "${v}"`, { hint: "e.g. 40-69" });
  return [Number(m[1]), Number(m[2] ?? m[1])];
}

export async function pool<T, R>(items: T[], size: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]!, i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, worker));
  return results;
}

register({
  path: ["read"],
  summary: "Browse images with readers: batches of ≤10, each a clean context writing its report — you get the finds",
  group: "sources",
  tree: true,
  description:
    "For agents without their own subagents (and to keep batches small for any agent). Readers see only their views\n" +
    "and write only their report (notes/readings/); they never change the research. Record the result yourself:\n" +
    "a found entry after looking at it with your own eyes, and the search — also a negative one — with --by reader.\n" +
    "It waits for its readers (often ten minutes or more): run it in the foreground and let it finish.",
  args: [{ name: "images", description: "a record set (with --images), or images: M… or B…:<image>", variadic: true, required: true }],
  options: [
    { name: "images", type: "string", value: "<from-to>", description: "image numbers of the record set, e.g. 40-69" },
    { name: "question", type: "string", value: "<text>", description: "what to look for and what counts as a find (the whole question — readers know nothing else)" },
    { name: "context", type: "string", value: "<text>", description: "what is known that helps recognise the family (names, house, years)" },
    { name: "blind", type: "boolean", description: "blind reading: transcribe exactly, no expectations (for verification)" },
    { name: "half", type: "string", value: "<side>", description: "only the left or right page of each spread" },
    { name: "crop", type: "string", value: "<x,y,w,h>", description: "only this part of each image, at full resolution (an entry to verify: find it with strom media view --grid)" },
    { name: "contrast", type: "boolean", description: "more contrast (faded ink)" },
    { name: "max", type: "string", value: "<px>", description: `size of the views (default ${VIEW_MAX}); smaller = cheaper browsing` },
    { name: "batch", type: "string", value: "<n>", description: `images per reader (default ${BATCH}, at most ${BATCH_MAX})` },
    { name: "parallel", type: "string", value: "<n>", description: "readers at the same time (default 3)" },
    { name: "model", type: "string", value: "<model>", description: "model of the readers (default: model.vision — never weaker for handwriting)" },
    { name: "minutes", type: "string", value: "<n>", description: "time limit of one reader (default 15)" },
  ],
  examples: [
    'strom read B0001 --images 40-69 --question "Every baptism of the surname Novák (Nowak, Nowack) in 1820–1824: the child, date, house, both parents and their parents"',
    'strom read B0001:2 --blind --crop 0.05,0.40,0.45,0.18 --question "Transcribe this entry completely; mark what is uncertain with [?]"',
  ],
  run: async (ctx: Context, { args, opts }) => {
    const tree = ctx.tree();
    const question = typeof opts.question === "string" ? opts.question.trim() : "";
    if (!question) throw new UsageError("--question is required", { hint: "the whole question: what to look for, what counts as a find, which years and names" });
    const all = tree.list<Media>("media");
    let images: Media[];
    let label: string;
    if (args.length === 1 && /^[Bb]\d+$/.test(args[0]!)) {
      const b = requireRecord<RecordSet>(tree, args[0]!, "recordset");
      if (typeof opts.images !== "string") throw new UsageError("which images?", { hint: `--images 40-69 (strom media list --recordset ${b.id})` });
      const [lo, hi] = range(opts.images);
      // each image once, as the sharpest copy of it
      const nums = [...new Set(all.filter((m) => m.recordset === b.id && !m.part && m.image !== undefined && m.image >= lo && m.image <= hi).map((m) => m.image!))];
      images = nums.sort((x, y) => x - y).map((n) => findImage(all, b.id, n)!);
      if (images.length === 0) throw new UsageError(`no registered images ${lo}–${hi} of ${b.id}`, { hint: `strom media add <folder> --recordset ${b.id}` });
      label = `${b.id}-${lo}-${hi}`;
    } else {
      images = args.map((a) => {
        const at = /^([Bb]\d+):(\d+)$/.exec(a.trim());
        if (!at) {
          // a copy of an image: the sharpest copy of it is read
          const m = requireRecord<Media>(tree, normId(a), "media");
          return (!m.part && m.recordset !== undefined && m.image !== undefined ? findImage(all, m.recordset, m.image) : undefined) ?? m;
        }
        const b = requireRecord<RecordSet>(tree, at[1]!, "recordset");
        const m = imageOfRef(all, b.id, Number(at[2]));
        if (!m) throw new UsageError(`image ${at[2]} of ${b.id} is not registered`, { hint: `strom media list --recordset ${b.id}` });
        return m;
      });
      label = images.map((m) => m.id).join("-").slice(0, 40);
    }
    const agentId = ctx.settings.agent(tree.config).value;
    const runner = RUNNERS[agentId];
    if (!runner) throw new UsageError(`no reader for agent "${agentId}" yet`, { hint: "strom read works with Claude Code: strom read … --agent claude" });
    if (agentId !== "script" && !which(runner.command, ctx.env)) throw new StromError(`${runner.command} is not installed`);
    const model = typeof opts.model === "string" ? opts.model : ctx.settings.models(agentId, tree.config).vision;
    const size = opts.batch === undefined ? BATCH : Number(opts.batch);
    if (!Number.isInteger(size) || size < 1) throw new UsageError("--batch must be a positive number");
    const parallel = opts.parallel === undefined ? 3 : Math.max(1, Number(opts.parallel) || 1);
    const minutes = opts.minutes === undefined ? 15 : Number(opts.minutes);
    const half = opts.half as "left" | "right" | undefined;
    if (half && !["left", "right"].includes(half)) throw new UsageError("--half is left or right");

    // Views at browsing size; the readers may open exactly these.
    const prepared: ReaderImage[] = images.map((m) => {
      const b = m.recordset ? tree.get<RecordSet>(m.recordset) : undefined;
      const file = path.join(ctx.settings.shared()!.value, m.file);
      const page = m.page ?? (b && m.image !== undefined ? pageOf(b, m.image) : undefined);
      const contrast = Boolean(opts.contrast);
      if (typeof opts.crop === "string" && m.width && m.height) {
        // a crop is read at full resolution — in overlapping parts when it is bigger than one look
        const parts = tiles(parseCrop(opts.crop, m.width, m.height)).map((t) => ({ label: t.label, view: makeView(tree, file, m.id, { crop: t.crop, contrast }).file }));
        return { id: m.id, image: m.image, page, view: parts[0]!.view, ...(parts.length > 1 ? { parts } : {}) };
      }
      const v = makeView(tree, file, m.id, { half, max: opts.max === undefined ? VIEW_MAX : Number(opts.max), contrast });
      return { id: m.id, image: m.image, page, view: v.file };
    });
    const groups = batches(prepared, size);
    const day = new Date().toISOString().slice(0, 10);
    const reportsDir = path.join(tree.root, "notes", "readings");
    fs.mkdirSync(reportsDir, { recursive: true });
    // Another reading of the same images on the same day keeps the earlier reports.
    let stem = `${day}-${label}`;
    for (let n = 2; fs.existsSync(path.join(reportsDir, `${stem}-1.md`)); n++) stem = `${day}-${label}-run${n}`;
    const work = path.join(ctx.settings.shared()!.value, "cache", "readers");
    const progress = (s: string) => (ctx.json ? ctx.io.stderr : ctx.io.stdout)(s + "\n");

    const results = await pool(groups, parallel, async (group, k) => {
      const report = path.join(reportsDir, `${stem}-${k + 1}.md`);
      // Outside the tree: a reader must not pick up the researcher's instructions (CLAUDE.md).
      const cwd = path.join(work, `${stem}-${k + 1}`);
      fs.mkdirSync(cwd, { recursive: true });
      const settingsFile = path.join(cwd, "reader-settings.json");
      fs.writeFileSync(settingsFile, JSON.stringify(readerSettings(group.flatMap((g) => [g.view, ...(g.parts ?? []).map((p) => p.view)]), report, permissionPath), null, 2));
      fs.writeFileSync(report, `# Reading ${label} · batch ${k + 1} of ${groups.length}\nQuestion: ${question}\n\n`);
      const prompt = readerPrompt({ question, images: group, report, lang: tree.lang, context: opts.context as string | undefined, blind: Boolean(opts.blind) });
      progress(`▶ reader ${k + 1}/${groups.length}: ${group.length} images (${runs(group.map((g) => g.image ?? 0))})`);
      const { STROM_SESSION: _s, ...env } = ctx.env;
      const r = await runner.run({
        cwd,
        prompt,
        kickoff: prompt,
        env: { ...env, STROM_NONINTERACTIVE: "1", STROM_READER: "1" },
        settingsFile,
        timeoutMs: minutes * 60_000,
        logFile: path.join(tree.root, ".strom", "runs", `read-${stem}-${k + 1}.log`),
        ...(model ? { model } : {}),
      });
      // A reader that answered but did not write: keep its answer as the report.
      const text = fs.readFileSync(report, "utf8");
      if (!/^##\s/m.test(text) && r.text.trim()) fs.appendFileSync(report, r.text.trim() + "\n");
      const findings = parseReport(fs.readFileSync(report, "utf8"));
      progress(`■ reader ${k + 1}: ${r.outcome}${r.metrics.costUsd !== undefined ? ` · $${r.metrics.costUsd.toFixed(2)}` : ""} · ${findings.filter((f) => f.result === "found").length} with finds`);
      return { group, report, outcome: r.outcome, cost: r.metrics.costUsd, findings };
    });

    // The reports are working notes of the research: committed with it.
    if (verifyFast(tree).findings.every((f) => f.level !== "error") && !tree.dryRun)
      tree.withTreeLock(() => tree.commit(`Reading ${label}: ${prepared.length} images by readers`, [tree.relative(reportsDir)]));

    const byId = new Map(prepared.map((p) => [p.id, p]));
    const numberOf = (f: Finding) => byId.get(f.image)?.image ?? Number(f.image);
    const findings = results.flatMap((r) => r.findings);
    const found = findings.filter((f) => f.result === "found");
    const unclear = findings.filter((f) => f.result === "unclear");
    const seen = new Set(findings.map((f) => byId.has(f.image) ? f.image : prepared.find((p) => p.image === Number(f.image))?.id));
    const missing = prepared.filter((p) => !seen.has(p.id));
    const failed = results.filter((r) => r.outcome !== "ok");
    const cost = results.reduce((s, r) => s + (r.cost ?? 0), 0);
    const b = images[0]?.recordset;
    const text = lines(
      `read ${prepared.length} images in ${results.length} batch(es)${model ? ` · ${model}` : ""}${cost ? ` · $${cost.toFixed(2)}` : ""}`,
      `found on: ${found.length ? runs(found.map(numberOf)) : "none"}`,
      unclear.length ? `unclear on: ${runs(unclear.map(numberOf))} — look yourself or read again` : undefined,
      missing.length ? `NOT reported: ${runs(missing.map((m) => m.image ?? 0))} — read these again` : undefined,
      failed.length ? `readers that failed: ${failed.map((r) => `${runs(r.group.map((g) => g.image ?? 0))} (${r.outcome})`).join(", ")}` : undefined,
      `reports: ${results.map((r) => ctx.display(r.report)).join(" · ")}`,
      "",
      "next: look at each find yourself (strom media view <M…> --crop …) before it becomes a source;",
      `record the search: strom search add "${truncate(question, 50)}"${b ? ` --recordset ${b}` : ""} --pages ${runs(prepared.map((p) => p.image ?? 0)).replace(/–/g, "-")} --method page-by-page --by reader --result ${found.length ? "found" : "negative"}`,
    );
    return {
      text,
      data: {
        images: prepared.length,
        found: found.map((f) => ({ image: numberOf(f), media: byId.has(f.image) ? f.image : undefined })),
        unclear: unclear.map(numberOf),
        missing: missing.map((m) => m.id),
        failed: failed.map((r) => ({ images: r.group.map((g) => g.id), outcome: r.outcome })),
        reports: results.map((r) => r.report),
        costUsd: cost || undefined,
      },
      exitCode: failed.length ? 1 : 0,
    };
  },
});
