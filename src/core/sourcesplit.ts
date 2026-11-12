// The older sources' locators split into their fields at once (spec 075 P4): the folio and the image each locator
// names (recognizeLocation — code, no agent, free) taken into --folio/--image, the locator left with its rest. A
// preview by default (anybody's, an agent's too); written only on the person's word (strom source split --apply, in
// their terminal), as one operation, undone as one (strom source split --undo <id>): each source as it was where
// nothing changed it since. Nothing of the person's text is lost: the undo keeps it, the history has it.
//
// What is kept: quality/source-split.json, the last steps to undo (UNDO_KEPT), each with the sources' locator, folio
// and image before and the time each was written.

import { createHash, randomBytes } from "node:crypto";
import path from "node:path";
import type { Media, Source } from "./model.ts";
import { locatorOverlap, recognizeLocation, sourceImage } from "./sourcefields.ts";
import { now, type Tree } from "./tree.ts";
import { readJsonIfExists } from "./json.ts";
import { StromError, UsageError } from "./errors.ts";

export const SOURCE_SPLIT_FILE = "quality/source-split.json";
/** How many splits can be undone, each by its own ID (the oldest go first). */
const UNDO_KEPT = 5;
/** How many unrecognised locators the preview shows. */
const EXAMPLES = 3;

/** Where a source's entry stands, as the split sees it: the locator, the folio and the image given. */
export interface SplitPlace {
  locator?: string;
  folio?: string;
  image?: string;
}

/** One source the split changes: what it is now, what it would be. */
export interface SplitOne {
  source: string;
  title: string;
  before: SplitPlace;
  after: SplitPlace;
}

export interface SplitPlan {
  /** The sources the split changes, in their order. */
  split: SplitOne[];
  /**
   * Sources with a locator in which neither a folio nor an image is recognised, and neither is a field of theirs (an
   * older source's location nothing of is understood): they stay as they are.
   */
  unrecognized: number;
  /** Up to three of their locators, as they stand (the location's text alone, each once): what the preview shows of them. */
  unrecognizedExamples: string[];
  /**
   * Sources with a locator whose folio or image is a field already (or its image the registered scans') and nothing of
   * it left to take — a split one's rest ("no. 7") among them.
   */
  nothing: number;
}

/** One split to be undone: each source's place before, and the time it was written (changed since: not undone). */
interface SplitUndo {
  id: string;
  at: string;
  sources: Record<string, { before: SplitPlace; after: string }>;
}

interface SplitFile {
  undo?: SplitUndo;
  undos?: SplitUndo[];
}

const place = (s: SplitPlace): SplitPlace => ({
  ...(s.locator?.trim() ? { locator: s.locator } : {}),
  ...(s.folio?.trim() ? { folio: s.folio } : {}),
  ...(s.image?.trim() ? { image: s.image } : {}),
});

/**
 * What a source's split would be, or undefined: the folio its locator names while no folio is given, the image while
 * it has none (neither its own nor its registered scans'), and the locator without them — and without a part a
 * field says the same already (once is enough); a part a field says otherwise stays in the locator (the person's).
 */
export function splitOf(s: Source, media: (id: string) => Media | undefined): SplitPlace | undefined {
  if (!s.locator?.trim()) return undefined;
  const found = recognizeLocation(s.locator);
  const folio = !s.folio?.trim() && found.folio ? found.folio : undefined;
  const image = !sourceImage(s, media) && found.image ? found.image : undefined;
  const given = locatorOverlap(s);
  const cutFolio = folio ?? (given?.folio?.same ? s.folio : undefined);
  const cutImage = image ?? (given?.image?.same ? s.image : undefined);
  if (!folio && !image && !cutFolio && !cutImage) return undefined;
  const rest = locatorOverlap({ locator: s.locator, folio: cutFolio, image: cutImage })?.rest;
  const after = place({ locator: rest, folio: folio ?? s.folio, image: image ?? s.image });
  const before = place(s);
  return JSON.stringify(after) === JSON.stringify(before) ? undefined : after;
}

/**
 * A short mark of what the split does (each source, its place before and after): the Strom app's preview names it when
 * it asks for the split done — another split by then (a source changed, one added) is refused, source.split.plan.
 */
export function splitMark(plan: SplitPlan): string {
  return createHash("sha256").update(JSON.stringify(plan.split.map((o) => [o.source, o.before, o.after]))).digest("hex").slice(0, 16);
}

/** What the split would do in the research now (nothing written). */
export function splitPlan(tree: Tree): SplitPlan {
  const out: SplitPlan = { split: [], unrecognized: 0, unrecognizedExamples: [], nothing: 0 };
  const media = (id: string) => tree.get<Media>(id);
  for (const s of tree.list<Source>("source")) {
    if (s.retracted || !s.locator?.trim()) continue;
    const after = splitOf(s, media);
    if (after) out.split.push({ source: s.id, title: s.title, before: place(s), after });
    else {
      const found = recognizeLocation(s.locator);
      if (found.folio || found.image || s.folio?.trim() || sourceImage(s, media)) out.nothing++;
      else {
        out.unrecognized++;
        const text = s.locator.trim().normalize("NFC");
        if (out.unrecognizedExamples.length < EXAMPLES && !out.unrecognizedExamples.includes(text)) out.unrecognizedExamples.push(text);
      }
    }
  }
  return out;
}

function readSplitFile(tree: Tree): SplitFile {
  try {
    const f = readJsonIfExists<Partial<SplitFile>>(path.join(tree.root, ...SOURCE_SPLIT_FILE.split("/")));
    const ok = (u: unknown): u is SplitUndo => !!u && typeof (u as SplitUndo).id === "string" && !!(u as SplitUndo).sources && typeof (u as SplitUndo).sources === "object";
    const undos = Array.isArray(f?.undos) ? f.undos.filter(ok) : [];
    return { ...(ok(f?.undo) ? { undo: f.undo } : {}), ...(undos.length ? { undos } : {}) };
  } catch {
    return {};
  }
}

const fileContent = (f: SplitFile) => `${JSON.stringify(f, null, 2)}\n`;

/** The IDs of the splits that can be undone, newest first. */
export function splitUndos(tree: Tree): { id: string; at: string; sources: number }[] {
  const f = readSplitFile(tree);
  return [f.undo, ...[...(f.undos ?? [])].reverse()].filter((u): u is SplitUndo => !!u).map((u) => ({ id: u.id, at: u.at, sources: Object.keys(u.sources).length }));
}

/** A step's ID: its time and a few random letters ("20261111T101500-a1b2c3" without the T). */
function undoId(f: SplitFile): string {
  const taken = new Set([f.undo?.id, ...(f.undos ?? []).map((u) => u.id)]);
  for (;;) {
    const id = `${now().replace(/\D/gu, "").slice(0, 14)}-${randomBytes(3).toString("hex")}`;
    if (!taken.has(id)) return id;
  }
}

/**
 * The split written (the person's): one operation, its undo kept. Inside the tree's lock. `mark`: the preview's
 * (splitMark) — another split by now is refused whole, source.split.plan, nothing written.
 */
export function applySplit(tree: Tree, mark?: string): { split: SplitOne[]; undo?: string; unrecognized: number; nothing: number } {
  return tree.withTreeLock(() => {
    const plan = splitPlan(tree);
    if (mark !== undefined && mark !== splitMark(plan))
      throw new StromError("the split would now do otherwise than the preview said (a source changed since): see it again", { code: "source.split.plan", hint: "strom source split --json says what it would do now; its plan is the mark to go on with" });
    if (!plan.split.length) return { split: [], unrecognized: plan.unrecognized, nothing: plan.nothing };
    const at = now();
    const records: Source[] = [];
    const sources: SplitUndo["sources"] = {};
    for (const one of plan.split) {
      const cur = tree.get<Source>(one.source)!;
      const next: Source = { ...cur, updated: at };
      delete next.locator;
      delete next.folio;
      delete next.image;
      Object.assign(next, one.after);
      records.push(next);
      sources[one.source] = { before: one.before, after: at };
    }
    const file = readSplitFile(tree);
    const undo: SplitUndo = { id: undoId(file), at, sources };
    if (file.undo) file.undos = [...(file.undos ?? []), file.undo].slice(-(UNDO_KEPT - 1));
    file.undo = undo;
    tree.putMany(records, [{ rel: SOURCE_SPLIT_FILE, content: fileContent(file) }], {
      op: "source.split",
      targets: records.map((r) => r.id).sort(),
      summary: `the person's split of ${records.length === 1 ? `${records[0]!.id}'s locator` : `${records.length} sources' locators`} into folio and image — undo: strom source split --undo ${undo.id}`,
    });
    return { split: plan.split, undo: undo.id, unrecognized: plan.unrecognized, nothing: plan.nothing };
  });
}

/** A split undone by its ID: every source as it was — refused whole when one changed since. Inside the tree's lock. */
export function undoSplit(tree: Tree, id: string): { restored: string[] } {
  return tree.withTreeLock(() => {
    const file = readSplitFile(tree);
    const u = file.undo?.id === id ? file.undo : file.undos?.find((x) => x.id === id);
    if (!u) throw new UsageError(`no split ${id} to undo (each split once, the last ${UNDO_KEPT})`, { code: "source.split.undo", hint: "strom source split" });
    const left: string[] = [];
    const records: Source[] = [];
    const at = now();
    for (const [sid, { before, after }] of Object.entries(u.sources)) {
      const cur = tree.get<Source>(sid);
      if (!cur || cur.updated !== after) {
        left.push(sid);
        continue;
      }
      const next: Source = { ...cur, updated: at };
      delete next.locator;
      delete next.folio;
      delete next.image;
      Object.assign(next, place(before));
      records.push(next);
    }
    if (left.length)
      throw new UsageError(`changed since: ${left.join(", ")} — the split is not undone (put them back by strom source edit, then undo)`, { code: "source.split.changed", params: { sources: left.join(", ") }, hint: "strom source show <id> says each as it is now" });
    if (file.undo === u) {
      const prev = file.undos?.pop();
      if (prev) file.undo = prev;
      else delete file.undo;
    } else file.undos = file.undos!.filter((x) => x !== u);
    if (!file.undos?.length) delete file.undos;
    tree.putMany(records, [{ rel: SOURCE_SPLIT_FILE, content: fileContent(file) }], {
      op: "source.split.undo",
      targets: records.map((r) => r.id).sort(),
      summary: `a split of locators undone (${u.id}): ${records.length} sources as they were`,
    });
    return { restored: records.map((r) => r.id) };
  });
}
