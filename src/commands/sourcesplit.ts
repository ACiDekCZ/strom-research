// strom source split: the older sources' locators split into folio and image at once (spec 075 P4, core/sourcesplit.ts)
// — a preview by default (anybody's), written or undone only by the person in their terminal (an agent offers it).

import { register } from "../cli/registry.ts";
import { counted, lines, shellArg } from "../cli/format.ts";
import { UsageError } from "../core/errors.ts";
import { applySplit, splitMark, splitPlan, splitUndos, undoSplit, type SplitOne, type SplitPlace } from "../core/sourcesplit.ts";

/** Examples of a preview, unless --all. */
const SHOWN = 10;

const PERSON = "Splitting the locators of the research's sources is the person's own, in their terminal: an agent shows the preview and offers it, never runs it";

const placeText = (p: SplitPlace) =>
  [p.folio ? `--folio ${shellArg(p.folio)}` : "", p.image ? `--image ${shellArg(p.image)}` : "", p.locator ? `--locator ${shellArg(p.locator)}` : "--locator (none)"].filter(Boolean).join(" ");

const oneLine = (o: SplitOne) => `  ${o.source}  ${shellArg(o.before.locator ?? "")} → ${placeText(o.after)}`;

register({
  path: ["source", "split"],
  summary: "Split the older sources' locators into folio and image at once: a preview; --apply writes it (the person's)",
  group: "sources",
  tree: true,
  writes: true,
  person: PERSON,
  agentMay: { when: "without --apply and --undo (the preview)", check: (_ctx, { opts }) => !opts.apply && opts.undo === undefined },
  description:
    "The folio or page and the image each source's locator names (fol. 12v, pag. 112, S. 15, snímek 34, Bild 7, …) taken into\n" +
    "its --folio and --image, the locator left with the rest (the entry's number) — recognised by strom's code, no agent,\n" +
    "free. A folio or image given already stays; an image the registered scans give is not taken; a locator in which\n" +
    "nothing is recognised stays as it is. Without --apply only the preview: nothing is written. --apply writes it as one\n" +
    "step, --undo <id> puts every source back as it was (the person's, in their terminal).",
  options: [
    { name: "apply", type: "boolean", description: "write the split as previewed: one step, undone as one (the person's)" },
    { name: "undo", type: "string", value: "<id>", description: "put a split back: every source as it was (the person's; the preview lists the ids)" },
    { name: "all", type: "boolean", description: "the preview with every source, not the first ten" },
    { name: "plan", type: "string", value: "<mark>", description: "with --apply: the mark its preview gave (--json plan) — refused, source.split.plan, when the split would now do otherwise" },
  ],
  examples: ["strom source split", "strom source split --all --json", "strom source split --apply"],
  run(ctx, { opts }) {
    const tree = ctx.tree();
    if (opts.apply && opts.undo !== undefined) throw new UsageError("--apply or --undo, not both");
    if (opts.plan !== undefined && (!opts.apply || typeof opts.plan !== "string" || !/^[0-9a-f]{16}$/u.test(opts.plan))) throw new UsageError("--plan <mark> goes with --apply: the 16 letters of the preview's plan (strom source split --json)");
    if (typeof opts.undo === "string") {
      const r = undoSplit(tree, opts.undo.trim());
      return { text: lines(`put back: ${counted(r.restored.length, "source")} as they were (${opts.undo.trim()})`), data: { undone: opts.undo.trim(), restored: r.restored } };
    }
    if (opts.apply) {
      const r = applySplit(tree, typeof opts.plan === "string" ? opts.plan : undefined);
      return {
        text: lines(
          r.split.length ? `split: the locator of ${counted(r.split.length, "source")} into folio and image` : "nothing to split",
          r.unrecognized ? `unrecognised, as they are: ${counted(r.unrecognized, "source")}` : undefined,
          r.undo ? `undo: strom source split --undo ${r.undo}` : undefined,
        ),
        data: { split: r.split, count: r.split.length, unrecognized: r.unrecognized, nothing: r.nothing, ...(r.undo ? { undo: r.undo } : {}) },
      };
    }
    const plan = splitPlan(tree);
    const undos = splitUndos(tree);
    const shown = opts.all ? plan.split : plan.split.slice(0, SHOWN);
    return {
      text: lines(
        plan.split.length ? `would split the locator of ${counted(plan.split.length, "source")} into folio and image (nothing written):` : "nothing to split: no locator names a folio or image a field does not give",
        ...shown.map(oneLine),
        plan.split.length > shown.length ? `  … ${plan.split.length - shown.length} more (--all, or --json)` : undefined,
        plan.unrecognized ? `unrecognised, stay as they are: ${counted(plan.unrecognized, "source")}${plan.unrecognizedExamples.length ? ` — ${plan.unrecognizedExamples.map((t) => JSON.stringify(t)).join(", ")}${plan.unrecognized > plan.unrecognizedExamples.length ? ", …" : ""}` : ""}` : undefined,
        plan.split.length ? "to write it: strom source split --apply — the person's, in their terminal (an agent offers it, never runs it)" : undefined,
        ...undos.map((u) => `to undo: strom source split --undo ${u.id} (${counted(u.sources, "source")}, ${u.at.slice(0, 10)})`),
      ),
      data: { split: plan.split, count: plan.split.length, unrecognized: plan.unrecognized, unrecognizedExamples: plan.unrecognizedExamples, nothing: plan.nothing, undos, plan: splitMark(plan) },
    };
  },
});
