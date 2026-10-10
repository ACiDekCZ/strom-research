// strom read — browse images with readers: batches of at most ten images, each
// read by an agent with a clean context that writes its report to
// notes/readings/ as it goes. The researcher gets back what they found, compact
// (strom readings shows it again). Readers never write to the research.

import fs from "node:fs";
import path from "node:path";
import { register } from "../cli/registry.ts";
import type { Context } from "../cli/context.ts";
import { lines, runs } from "../cli/format.ts";
import { StromError, UsageError } from "../core/errors.ts";
import type { Media, RecordSet, Task } from "../core/model.ts";
import { normId, requireRecord } from "../core/records.ts";
import { pageOf } from "../core/calibration.ts";
import { coveringPart, findImage, imageOfRef, onlyParts, regionText, wholeSizeOf } from "../core/media.ts";
import { cropOf, halves, makeView, parseCrop, readInHalves, tiles, type ViewMeta } from "../core/views.ts";
import { IMAGE_MAX, IMAGE_MAX_LARGE } from "../agents/images.ts";
import { viewSizesFor } from "../core/viewsizes.ts";
import { currentSession } from "../core/session.ts";
import { BATCH, BATCH_MAX, batches, parseReport, READER_MINUTES_HELP, readerPrompt, readerSettings, viewCount, type Finding, type ReaderImage } from "../core/reader.ts";
import { imageSize } from "../image/index.ts";
import { RUNNERS } from "../runners/index.ts";
import { which, withoutAgentMarks } from "../core/which.ts";
import { permissionPath } from "../agents/files.ts";
import { verifyFast } from "../core/integrity.ts";
import { shellArg, truncate } from "../cli/format.ts";
import { earlierLines, earlierReadings, loadReadings, summary, unclearBefore } from "./readings.ts";
import { addReaders } from "../core/session.ts";
import { refuseReadersWhenFinishing } from "../core/clock.ts";
import { recordReader, tokensOf, usageOpt } from "../core/metrics.ts";
import { readerLimit } from "../core/readstats.ts";
import { bookViewSizes, readingOf, treeTuning, tuningOn } from "../core/tune.ts";
import { claimStem, readerAgent, readerDesk, refuseReadersInSandbox } from "./readers.ts";
import { noReaderHere, refusedBySandbox } from "../core/sandbox.ts";

/**
 * Of an image registered only in parts, the part a crop of the whole image (fractions or pixels of it) is on, and the
 * crop in that part's fractions — none covers it: said, nothing fetched.
 */
function partCovering(parts: Media[], crop: string): { part: Media; crop: string } {
  const size = wholeSizeOf(parts.find((p) => wholeSizeOf(p)) ?? parts[0]!);
  const m = parts[0]!;
  const r = size ? parseCrop(crop, size.width, size.height) : undefined;
  const found = r && size ? coveringPart(parts, { x: r.x / size.width, y: r.y / size.height, w: r.w / size.width, h: r.h / size.height }) : undefined;
  if (!found)
    throw new UsageError(`image ${m.image} of ${m.recordset} is registered only in parts, and none of them covers --crop ${crop}: ${parts.map((p) => `${p.id} (part ${regionText(p.part!)})`).join(", ")}`, {
      hint: `a crop within one of those parts (fractions of the whole image), or name the part: ${parts.map((p) => p.id).join(" or ")}`,
    });
  return { part: found.part, crop: regionText(found.crop) };
}

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
  summary: "Browse images with readers: batches of ≤10, each a clean context writing its report — you get the finds, compact",
  group: "sources",
  tree: true,
  description:
    "For agents without their own subagents (and to keep batches small for any agent). Readers see only their views\n" +
    "and write only their report (notes/readings/); they never change the research. Record the result yourself:\n" +
    "a found entry after looking at it with your own eyes, and the search — also a negative one — with --by reader.\n" +
    "You get the found and unclear entries, what was illegible where nothing was found, and the gaps in the book;\n" +
    "the same later with strom readings (one image's whole block: strom readings B… --image N).\n" +
    `Views are as big as the readers' model takes them in whole (${IMAGE_MAX_LARGE} px for the newer models, else ${IMAGE_MAX}),\n` +
    "or as the person calibrated them for this agent and model (strom media calibrate).\n" +
    "A blind reading, a reading in a verify task and an image a reader found unclear before get a double page as its\n" +
    "two halves, overlapping at the gutter — each page sharper (two views: a reader takes fewer images). Otherwise a\n" +
    "spread is read whole. --half both for halves anyway, --whole for one view.\n" +
    "It waits for its readers (often ten minutes or more): run it in the foreground and let it finish.",
  args: [{ name: "images", description: "a record set (with --images), or images: M… or B…:<image>", variadic: true, required: true }],
  options: [
    { name: "images", type: "string", value: "<from-to>", description: "image numbers of the record set, e.g. 40-69" },
    { name: "question", type: "string", value: "<text>", description: "what to look for, what counts as a find and what to write down (page numbers only, one surname's entries, one entry whole) — the whole question: readers know nothing else" },
    { name: "context", type: "string", value: "<text>", description: "what is known that helps recognise the family (names, house, years)" },
    { name: "blind", type: "boolean", description: "blind reading: transcribe exactly, no expectations (for verification)" },
    { name: "half", type: "string", value: "<side>", description: "left or right: only that page of each spread; both: each spread as its two halves" },
    { name: "whole", type: "boolean", description: "each image in one view, also a double page (cheaper; small script may be illegible)" },
    { name: "crop", type: "string", value: "<x,y,w,h>", description: "only this part of each image, at full resolution (an entry to verify: find it with strom media view --grid)" },
    { name: "contrast", type: "boolean", description: "more contrast (faded ink)" },
    { name: "max", type: "string", value: "<px>", description: `size of the views (default: what the readers' model takes, ${IMAGE_MAX} or ${IMAGE_MAX_LARGE}); smaller = cheaper browsing` },
    { name: "batch", type: "string", value: "<n>", description: `views per reader — a double page in halves is two (default ${BATCH}, fewer where strom tuned the reading of this agent and model: strom config get reading.batch; at most ${BATCH_MAX})` },
    { name: "parallel", type: "string", value: "<n>", description: "readers at the same time (default 3)" },
    { name: "model", type: "string", value: "<model>", description: "model of the readers (default: model.vision — never weaker for handwriting)" },
    { name: "minutes", type: "string", value: "<n>", description: READER_MINUTES_HELP },
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
    // an image registered only in parts, named as an image of its book: the crop asked, in the part that covers it
    const partCrops = new Map<string, string>();
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
        // registered only in parts: a crop of the whole image is read from the part that covers it
        const parts = onlyParts(all, b.id, Number(at[2]));
        if (parts.length && typeof opts.crop === "string") {
          const picked = partCovering(parts, opts.crop);
          partCrops.set(picked.part.id, picked.crop);
          return picked.part;
        }
        const m = imageOfRef(all, b.id, Number(at[2]));
        if (!m) throw new UsageError(`image ${at[2]} of ${b.id} is not registered`, { hint: `strom media list --recordset ${b.id}` });
        return m;
      });
      label = images.map((m) => m.id).join("-").slice(0, 40);
    }
    // inside a sandbox that lets no agent start (Codex's): said at once, nothing prepared
    refuseReadersInSandbox(ctx, "strom read");
    const agentId = readerAgent(ctx, tree);
    const runner = RUNNERS[agentId];
    if (!runner) throw new UsageError(`no reader for agent "${agentId}" yet`, { hint: "strom read works with Claude Code: strom read … --agent claude" });
    if (agentId !== "script" && !which(runner.command, ctx.env)) throw new StromError(`${runner.command} is not installed`);
    const model = typeof opts.model === "string" ? opts.model : ctx.settings.models(agentId, tree.config).vision;
    const effort = ctx.settings.effort(agentId, tree.config)?.value;
    // as at the start of the session at work: what strom tuned for the readers' agent and model holds for all of it
    const since = currentSession(tree, ctx.env)?.started;
    const sizes = viewSizesFor(ctx.settings, agentId, tree.config, model, tree.root);
    const tuned = treeTuning(tree, ctx.settings);
    // a reader's batch: smaller where the readers of this agent and model lost their context (core/tune.ts, A2)
    const size = opts.batch === undefined ? readingOf(ctx.settings.config, sizes.key, { since, on: tuningOn(ctx.settings), root: tree.root }).readerBatch : Number(opts.batch);
    if (!Number.isInteger(size) || size < 1) throw new UsageError("--batch must be a positive number");
    const parallel = opts.parallel === undefined ? 3 : Math.max(1, Number(opts.parallel) || 1);
    // a reader's time limit: by hand, else by what it is given and what the readers before it needed (readerLimit)
    const minutesSaid = opts.minutes === undefined ? undefined : Number(opts.minutes);
    if (minutesSaid !== undefined && !(minutesSaid > 0)) throw new UsageError(`invalid --minutes "${String(opts.minutes)}"`, { hint: "the minutes one reader may take, e.g. 10" });
    const sides = opts.half as "left" | "right" | "both" | undefined;
    if (sides && !["left", "right", "both"].includes(sides)) throw new UsageError("--half is left, right or both");
    if (sides && opts.whole) throw new UsageError("--half or --whole, not both");
    const half = sides === "both" ? undefined : sides;
    // as big as the readers' model takes an image in whole (bigger: the agent shrinks it itself) — or as a person
    // calibrated it for this agent and model (strom media calibrate)
    const cap = sizes.read;
    const maxAll = opts.max === undefined ? cap : Number(opts.max);
    if (!(maxAll >= 100)) throw new UsageError(`invalid --max "${String(opts.max)}"`, { hint: `the long side of a view in px, e.g. ${cap}` });
    // A double page in halves where reading closely matters: a blind reading, a verify task, an image found unclear before.
    const task = currentSession(tree, ctx.env)?.task;
    const why = opts.blind ? "blind reading" : task && tree.get<Task>(task)?.level === "verify" ? "verification" : undefined;
    const unclearAgo = why || sides || opts.whole || typeof opts.crop === "string" ? new Set<string>() : unclearBefore(tree, images);
    // a book read worse than the others (core/tune.ts, A1): its views as big as the model takes them, a spread in halves
    const bookSizes = (m: Media) => bookViewSizes(sizes, tuned, m.recordset, since);
    const sharp = (m: Media) => sides === "both" || (!opts.whole && (Boolean(why) || unclearAgo.has(m.id) || !!bookSizes(m).halves));

    // Views at browsing size; the readers may open exactly these. Each recorded as a reader's, its size kept for the
    // record of the reader (core/metrics.ts).
    // The size of an image's views and where it came from: --max, else its book's where strom tuned it, else the
    // calibration's or the default — the same for its views and for the record of its reader.
    const capOf = (m: Media): { cap: number; capFrom: NonNullable<ViewMeta["capFrom"]> } => {
      if (opts.max !== undefined) return { cap: maxAll, capFrom: "option" };
      const book = bookSizes(m);
      return { cap: book.read, capFrom: book.tuned ? `tuned:${book.tuned}` : sizes.calibrated ? "calibrated" : "default" };
    };
    const byMedia = new Map(images.map((m) => [m.id, m]));
    const pixels = new Map<string, number>();
    const view =(file: string, m: Media, spec: Parameters<typeof makeView>[3], kind?: "whole" | "half" | "crop" | "split") => {
      const v = makeView(tree, file, m.id, spec, { reader: true, capFrom: capOf(m).capFrom, ...(kind ? { kind } : {}) });
      pixels.set(v.file, v.width * v.height);
      return v;
    };
    const prepared: ReaderImage[] = images.map((m) => {
      // this image's book: bigger where strom tuned it
      const max = capOf(m).cap;
      const b = m.recordset ? tree.get<RecordSet>(m.recordset) : undefined;
      const file = path.join(ctx.settings.shared()!.value, m.file);
      const page = m.page ?? (b && m.image !== undefined ? pageOf(b, m.image) : undefined);
      const contrast = Boolean(opts.contrast);
      if (typeof opts.crop === "string" && m.width && m.height) {
        // a crop is read at full resolution — in overlapping parts when it is bigger than one look
        const all = tiles(parseCrop(partCrops.get(m.id) ?? opts.crop, m.width, m.height), max);
        const parts = all.map((t) => ({ label: t.label, view: view(file, m, { crop: t.crop, max, contrast }, all.length > 1 ? "split" : "crop").file }));
        return { id: m.id, image: m.image, page, view: parts[0]!.view, ...(parts.length > 1 ? { parts } : {}) };
      }
      const size = !opts.whole && fs.existsSync(file) ? (m.width && m.height ? { width: m.width, height: m.height } : imageSize(new Uint8Array(fs.readFileSync(file)))) : undefined;
      if (size && half) {
        // one page of a spread, with the strip past the gutter (a scan is seldom centred on it)
        const v = view(file, m, { crop: cropOf(halves(size.width, size.height)[half]), max, contrast }, "half");
        return { id: m.id, image: m.image, page, view: v.file };
      }
      if (size && sharp(m) && (sides === "both" || readInHalves(size.width, size.height, max) || (!!bookSizes(m).halves && size.width > size.height))) {
        // a double page read closely: each half sharper than the whole in one view
        const { left, right } = halves(size.width, size.height);
        const parts = [
          { label: "left half", view: view(file, m, { crop: cropOf(left), max, contrast }, "half").file },
          { label: "right half", view: view(file, m, { crop: cropOf(right), max, contrast }, "half").file },
        ];
        return { id: m.id, image: m.image, page, view: parts[0]!.view, parts, halves: true };
      }
      const v = view(file, m, { half, max, contrast });
      return { id: m.id, image: m.image, page, view: v.file };
    });
    const progress = (s: string) => (ctx.json ? ctx.io.stderr : ctx.io.stdout)(s + "\n");
    // The same images read before: said, never refused (another question, a blind check).
    const earlier = earlierReadings(tree, images);
    for (const l of earlierLines(earlier)) progress(l);
    const groups = batches(prepared, size, viewCount);
    const day = new Date().toISOString().slice(0, 10);
    const reportsDir = path.join(tree.root, "notes", "readings");
    fs.mkdirSync(reportsDir, { recursive: true });
    const work = path.join(ctx.settings.shared()!.value, "cache", "readers");

    refuseReadersWhenFinishing(tree.root, ctx.env);
    // Another reading of the same images on the same day keeps the earlier reports — also one started at the same
    // moment in another process: each its own stem, so its own readers, usage, logs, reports and records (claimStem)
    const stem = claimStem(tree.root, "read", `${day}-${label}`, (s) => fs.existsSync(path.join(reportsDir, `${s}-1.md`)));
    // a reader refused by a sandbox that does not say so (core/sandbox.ts): no more are started
    let refused = false;
    const results = await pool(groups, parallel, async (group, k) => {
      const report = path.join(reportsDir, `${stem}-${k + 1}.md`);
      const views = group.reduce((n, g) => n + viewCount(g), 0);
      // its time limit: by hand, else by its views and what the readers of this agent and model before it needed
      // (readerLimit: also those of this reading that ended before it began)
      const limit = minutesSaid !== undefined ? { minutes: minutesSaid, from: "option" as const } : readerLimit(tree.root, sizes.key, views);
      const minutes = limit.minutes;
      if (refused) return { group, report, outcome: "error" as const, cost: undefined, findings: [] as Finding[], minutes };
      // Its own files beside the one folder all readers work in (outside the tree: readerDesk).
      const own = path.join(work, `${stem}-${k + 1}`);
      fs.mkdirSync(own, { recursive: true });
      const settingsFile = path.join(own, "reader-settings.json");
      fs.writeFileSync(settingsFile, JSON.stringify(readerSettings(group.flatMap((g) => [g.view, ...(g.parts ?? []).map((p) => p.view)]), report, permissionPath), null, 2));
      const context = typeof opts.context === "string" && opts.context.trim() ? `Context: ${opts.context.trim().replace(/\s*\n\s*/g, " ")}\n` : "";
      const head = `# Reading ${label} · batch ${k + 1} of ${groups.length}\nQuestion: ${question.replace(/\s*\n\s*/g, " ")}\n${context}\n`;
      fs.writeFileSync(report, head);
      const prompt = readerPrompt({ question, images: group, report, lang: tree.lang, context: opts.context as string | undefined, blind: Boolean(opts.blind) });
      progress(`▶ reader ${k + 1}/${groups.length}: ${group.length} images (${runs(group.map((g) => g.image ?? 0))})${views > group.length ? ` · ${views} views` : ""} · at most ${minutes} min${limit.from === "learned" ? " (earlier readers of this agent and model needed more)" : ""}`);
      const startedAt = Date.now();
      const { STROM_SESSION: _s, ...env } = ctx.env;
      const r = await runner.run({
        cwd: readerDesk(ctx.settings.shared()!.value),
        prompt,
        kickoff: prompt,
        // (not the marks of the agent that ran strom read: the reader is an agent of its own)
        env: { ...withoutAgentMarks(env), STROM_NONINTERACTIVE: "1", STROM_READER: "1" },
        settingsFile,
        reader: true,
        // without the user's own add-ons (skills, plugins, MCP servers) unless they said otherwise
        ...(ctx.settings.agentAddons(tree.config) ? {} : { clean: true }),
        timeoutMs: minutes * 60_000,
        logFile: path.join(tree.root, ".strom", "runs", `read-${stem}-${k + 1}.log`),
        ...(model ? { model } : {}),
        // the reasoning effort the person chose for the agent (model.effort): readers read with it too
        ...(effort ? { effort } : {}),
        ...usageOpt(tree, `read-${stem}-${k + 1}`, { agent: agentId, key: sizes.asked ?? sizes.key, ...(model ? { model } : {}), ...(effort ? { effort } : {}), reader: "read" }),
      });
      const ranMs = Date.now() - startedAt;
      // A reader that wrote its report whole, without strom's head (in the research language, found live): the head
      // back on top — strom readings finds a reading by it.
      let text = fs.readFileSync(report, "utf8");
      if (!text.startsWith("# Reading")) fs.writeFileSync(report, (text = `${head}${text}`));
      // A reader that answered but did not write: keep its answer as the report.
      if (r.outcome === "error" && !/^##\s/m.test(text) && refusedBySandbox(r.text)) {
        refused = true;
        fs.rmSync(report, { force: true });
        return { group, report, outcome: r.outcome, cost: r.metrics.costUsd, findings: [] as Finding[], minutes };
      }
      if (!/^##\s/m.test(text) && r.text.trim()) fs.appendFileSync(report, r.text.trim() + "\n");
      const findings = parseReport(fs.readFileSync(report, "utf8"));
      // the reader as it went, for the measure of the reading of scans (core/metrics.ts)
      const groupViews = group.flatMap((g) => (g.parts?.length ? g.parts.map((p) => p.view) : [g.view]));
      // the size its views were made for and where it came from, as the views' own record says (images of books of
      // different sizes in one reader: the largest, "mixed")
      const caps = [...new Map(group.map((g) => capOf(byMedia.get(g.id)!)).map((c) => [`${c.cap} ${c.capFrom}`, c])).values()];
      recordReader(tree, ctx.env, {
        reader: `read-${stem}-${k + 1}`,
        kind: "read",
        agent: agentId,
        key: sizes.asked ?? sizes.key,
        model,
        reported: r.metrics.model,
        images: group.length,
        imageIds: group.map((g) => g.id),
        views: groupViews.length,
        px: groupViews.reduce((n, v) => n + (pixels.get(v) ?? 0), 0),
        cap: Math.max(...caps.map((c) => c.cap)),
        capFrom: caps.length === 1 ? caps[0]!.capFrom : "mixed",
        outcome: r.outcome,
        found: findings.filter((f) => f.result === "found").length,
        nothing: findings.filter((f) => f.result === "nothing").length,
        unclear: findings.filter((f) => f.result === "unclear").length,
        illegible: findings.filter((f) => f.illegible?.length).length,
        missing: group.filter((g) => !findings.some((f) => f.image === g.id || f.media === g.id || (g.image !== undefined && (f.number === g.image || Number(f.image) === g.image)))).length,
        usd: r.metrics.costUsd,
        ...(r.metrics.costPartial ? { usdPartial: true } : {}),
        tokens: tokensOf(r.metrics),
        turns: r.metrics.turns,
        ms: r.metrics.durationMs,
        // how long strom waited for it, its limit and where that came from (the next reader's limit learns from them)
        wallMs: ranMs,
        minutes,
        minutesFrom: limit.from,
        report: tree.relative(report),
      });
      progress(`■ reader ${k + 1}: ${r.outcome === "timeout" ? `stopped at its time limit (${minutes} min)` : r.outcome}${r.metrics.costUsd !== undefined ? ` · $${r.metrics.costUsd.toFixed(2)}` : ""} · ${findings.filter((f) => f.result === "found").length} with finds`);
      return { group, report, outcome: r.outcome, cost: r.metrics.costUsd, findings, minutes };
    });

    // refused by the sandbox: the reports never begun go, the agent hears what it does instead
    if (refused) {
      for (const r of results) if (!r.findings.length && fs.existsSync(r.report) && !/^##\s/m.test(fs.readFileSync(r.report, "utf8"))) fs.rmSync(r.report, { force: true });
      throw noReaderHere({ agent: agentId, name: "the sandbox this agent works in" }, "strom read");
    }

    // The reports are working notes of the research: committed with it — and what the readers cost, with the session
    // that started them (apart from the agent's own)
    if (verifyFast(tree).findings.every((f) => f.level !== "error") && !tree.dryRun)
      tree.withTreeLock(() => {
        const spent = results.reduce((s, r) => s + (r.cost ?? 0), 0);
        const session = addReaders(tree, ctx.env, ctx.refs, { usd: spent, runs: results.length, partial: results.some((r) => r.cost === undefined) });
        tree.commit(`Reading ${label}: ${prepared.length} images by readers`, [tree.relative(reportsDir), ...(session ? ["data"] : [])]);
      });

    const byId = new Map(prepared.map((p) => [p.id, p]));
    const numberOf = (f: Finding) => byId.get(f.image)?.image ?? Number(f.image);
    const findings = results.flatMap((r) => r.findings);
    const found = findings.filter((f) => f.result === "found");
    const unclear = findings.filter((f) => f.result === "unclear");
    const seen = new Set(findings.map((f) => byId.has(f.image) ? f.image : prepared.find((p) => p.image === Number(f.image))?.id));
    const missing = prepared.filter((p) => !seen.has(p.id));
    const failed = results.filter((r) => r.outcome !== "ok");
    const late = failed.filter((r) => r.outcome === "timeout");
    const cost = results.reduce((s, r) => s + (r.cost ?? 0), 0);
    const b = images[0]?.recordset;
    const spreads = prepared.filter((p) => p.halves).length;
    // what the readers wrote, compact: the finds and the unclear entries whole, what was illegible where nothing was found, the gaps
    const mine = loadReadings(tree).find((r) => r.stem === stem);
    const told = summary(mine?.blocks ?? [], { maxLines: 60, question });
    const text = lines(
      `read ${prepared.length} images${spreads ? ` (${spreads} double pages as their halves${why ? `: ${why}` : sides ? "" : ": unclear before"})` : ""} in ${results.length} batch(es)${model ? ` · ${model}` : ""}${cost ? ` · $${cost.toFixed(2)}` : ""}`,
      `found on: ${found.length ? runs(found.map(numberOf)) : "none"}`,
      unclear.length
        ? `unclear on: ${runs(unclear.map(numberOf))} — look at that place closer yourself (strom media view ${b ?? "B…"}:${numberOf(unclear[0]!)} --half both, --crop) or read again (a double page then comes in halves): no negative of the range before`
        : undefined,
      missing.length ? `NOT reported: ${runs(missing.map((m) => m.image ?? 0))} — read these again` : undefined,
      failed.length ? `readers that failed: ${failed.map((r) => `${runs(r.group.map((g) => g.image ?? 0))} (${r.outcome === "timeout" ? `stopped at its time limit, ${r.minutes} min` : r.outcome})`).join(", ")}` : undefined,
      late.length
        ? `a reader stopped at its time limit gave no answer for ${late.length === 1 && late[0]!.group.length === 1 ? "its image" : "its images"}: look at ${late.flatMap((r) => r.group).length === 1 ? "it" : "them"} yourself — ${late
            .flatMap((r) => r.group)
            .slice(0, 3)
            .map((g) => `strom media view ${g.id}${typeof opts.crop === "string" ? ` --crop ${partCrops.get(g.id) ?? opts.crop}` : ""}`)
            .join(" · ")}${late.flatMap((r) => r.group).length > 3 ? " …" : ""} (or read again, with more time: --minutes <n>)`
        : undefined,
      ...told.lines,
      told.more ? `  … ${told.more} more block(s): strom readings ${stem}` : undefined,
      `reports: ${results.length > 3 ? `${ctx.display(path.join(reportsDir, stem))}-1…${results.length}.md` : results.map((r) => ctx.display(r.report)).join(" · ")} — no need to open them: strom readings ${stem} (this again), strom readings ${b ?? stem} --image <n> (one image whole)`,
      "",
      "next: look at each find yourself (strom media view <M…> --crop …) before it becomes a source;",
      `record the search: strom search add "${truncate(question, 50)}"${b ? ` --recordset ${b}` : ""} --pages ${runs(prepared.map((p) => p.image ?? 0)).replace(/–/g, "-")} --method page-by-page --by reader --result ${found.length ? "found" : unclear.length ? "inconclusive" : "negative"}${told.gaps.length ? ` --note ${shellArg(told.gaps.join("; "))}` : ""}`,
      told.gaps.length ? "(the readers saw pages missing from the book: the note says so — what is not in the book was not searched)" : undefined,
    );
    return {
      text,
      data: {
        images: prepared.length,
        halves: spreads || undefined,
        found: found.map((f) => ({ image: numberOf(f), media: byId.has(f.image) ? f.image : undefined })),
        unclear: unclear.map(numberOf),
        missing: missing.map((m) => m.id),
        failed: failed.map((r) => ({ images: r.group.map((g) => g.id), outcome: r.outcome, ...(r.outcome === "timeout" ? { minutes: r.minutes } : {}) })),
        reports: results.map((r) => r.report),
        reading: stem,
        blocks: (mine?.blocks ?? []).filter((x) => x.result !== "nothing" || x.illegible?.length || x.gaps?.length || x.section?.length).map((x) => ({ image: x.num, media: x.media, result: x.result, pages: x.pages, entries: x.entries, certainty: x.certainty, illegible: x.illegible, gaps: x.gaps, section: x.section })),
        earlier: earlier.readings.length || earlier.searches.length ? earlier : undefined,
        costUsd: cost || undefined,
      },
      exitCode: failed.length ? 1 : 0,
    };
  },
});
