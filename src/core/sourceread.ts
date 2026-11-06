// A source read again from its original (spec 059 P3, the app's ZADANI_VYZKUM_cteni-modely.md point 6): what the
// research has of the record itself on this computer — the excerpts of its images (each clip with the margin an excerpt
// keeps), its images whole where nobody cut the entry out, else the scan the person gave — read by readers who are
// never shown its transcript. The new reading is kept beside the source as one more reading of it (Source.readings);
// nothing of the source changes: where it differs from the transcript a task holds the two against each other, and
// the user's confirmation of the transcript (spec 022) stays as it was.

import fs from "node:fs";
import path from "node:path";
import type { Input, Media, Source, Task } from "./model.ts";
import type { Tree } from "./tree.ts";
import { inputPath } from "./media.ts";
import { clipMark, INPUT_MARK, withMargin } from "./excerpt.ts";
import { alive, DOC_PAGES, FINAL_STATES, listReadings, loadState, wordDiff, type ReadResult, type Region, type SourceRead } from "./document.ts";
import { create, update } from "./records.ts";
import { phrase } from "./phrases.ts";

/** The origin of the task a reading again that differs from a source's transcript makes. */
export const SOURCE_READ_ORIGIN = "read:source";

/** The kinds of files a reader reads a page from (a photo, a scan, a PDF). */
const PAGE_EXT = /\.(jpe?g|png|hei[cf]|pdf)$/iu;

/** A page of a source's original: its record (an image M…, an input I…), its file here, and the part of it read. */
export interface OriginalPage {
  id: string;
  file: string;
  name: string;
  sha?: string;
  region?: Region;
}

/** Why a source cannot be read again here: none such, no transcript to hold a reading against, no original here. */
export type NotAgain = "none" | "notext" | "noscan";

/** Whether a source is one a reading again is of: a record of the research with a transcript (no family tree, no memory). */
function sourceOk(s: Source | undefined): s is Source {
  return !!s && s.type === "source" && !s.retracted && !s.mergedInto && s.kind !== "family-tree" && s.kind !== "family-memory";
}

/**
 * The pages of a source's original on this computer (`clip`: one excerpt alone, by its mark): each clip of it on its
 * image (with an excerpt's margin), else its images whole, else the scan the person gave — at most a reading's pages.
 * None here (an image not on this computer, a clip it has not): an empty list.
 */
export function originalPages(tree: Tree, shared: string | undefined, s: Source, clip?: string): OriginalPage[] {
  const out: OriginalPage[] = [];
  const media = (id: string, region?: Region) => {
    const m = shared ? tree.get<Media>(id) : undefined;
    if (!m || m.type !== "media" || m.retracted || !shared) return;
    const file = path.join(shared, m.file);
    if (!PAGE_EXT.test(file) || !fs.existsSync(file)) return;
    out.push({ id: m.id, file, name: m.id, ...(m.sha ? { sha: m.sha } : {}), ...(region ? { region } : {}) });
  };
  const input = () => {
    const i = s.input ? tree.get<Input>(s.input) : undefined;
    const file = i ? inputPath(tree, i) : undefined;
    if (!i || !file || !PAGE_EXT.test(file) || !fs.existsSync(file)) return;
    out.push({ id: i.id, file, name: i.name, ...(i.sha ? { sha: i.sha } : {}) });
  };
  if (clip === INPUT_MARK) input();
  else if (clip) {
    const c = s.clips?.find((x) => clipMark(x) === clip);
    if (c) {
      const r = withMargin(c.region);
      media(c.media, [r.x, r.y, r.w, r.h].map((n) => Math.round(n * 1000) / 1000) as Region);
    }
  } else if (s.clips?.length) {
    for (const c of s.clips) {
      const r = withMargin(c.region);
      media(c.media, [r.x, r.y, r.w, r.h].map((n) => Math.round(n * 1000) / 1000) as Region);
    }
  } else if (s.media?.length) for (const m of s.media) media(m);
  else input();
  return out.slice(0, DOC_PAGES);
}

/** Why a source (one excerpt of it) cannot be read again here, or none: it can. */
export function notAgain(tree: Tree, shared: string | undefined, id: string, clip?: string): NotAgain | undefined {
  const s = tree.get<Source>(id);
  if (!sourceOk(s)) return "none";
  if (!s.transcript?.trim()) return "notext";
  return originalPages(tree, shared, s, clip).length ? undefined : "noscan";
}

/** The reading of a source again not ended yet (queued, being read), if one is: one at a time. */
export function readingOfSource(root: string, id: string): string | undefined {
  for (const r of listReadings(root)) {
    if (FINAL_STATES.includes(r.state)) continue;
    const s = loadState(root, r.id);
    if (s?.source?.id === id && !FINAL_STATES.includes(s.state) && (s.state === "queued" || alive(s.pid))) return s.id;
  }
  return undefined;
}

/** Whether a source can be read again from its original here (1 _STROM_ORIG Y for an app that offers it). */
export function readsAgain(tree: Tree, shared: string | undefined, s: Source): boolean {
  return sourceOk(s) && !!s.transcript?.trim() && originalPages(tree, shared, s).length > 0;
}

/** The new reading against the source's transcript (at: the transcript, other: the new reading): its words alike, or where they differ. */
export function compareWithSource(s: Pick<Source, "transcript">, r: Pick<ReadResult, "entries">): { agree: "same" | "differ"; variants: { at: string; other: string }[] } {
  const read = r.entries.map((e) => e.transcript).join("\n");
  const variants = wordDiff((s.transcript ?? "").normalize("NFC"), read.normalize("NFC"));
  return { agree: variants.length ? "differ" : "same", variants };
}

/**
 * A reading of a source again that ended with a result: kept beside the source as one more reading of it (nothing of
 * the source changes — its transcript, who read it, the user's confirmation), compared with its transcript; where they
 * differ, a task to hold the two against each other. What it came to, for the reading's state.
 */
export function keepSourceReading(tree: Tree, at: SourceRead, r: ReadResult): SourceRead {
  const s = tree.get<Source>(at.id);
  if (!sourceOk(s)) return at;
  const c = compareWithSource(s, r);
  // (a source.reading, never a source.edit: the history's edits of a source say who read it — this one changes none)
  update<Source>(tree, s.id, "source", (x) => ({ ...x, readings: [...new Set([...(x.readings ?? []), r.id])] }), { op: "source.reading", summary: `${s.id} read again from its original: ${r.id} (${c.agree === "same" ? "alike its transcript" : "differs from its transcript"})` });
  if (c.agree === "same") return { ...at, agree: "same", variants: [] };
  // read again (strom document again) while its task is still open: that task holds this reading too
  const open = at.task ? tree.get<Task>(at.task) : undefined;
  if (open && open.type === "task" && open.state === "open") return { ...at, agree: "differ", variants: c.variants };
  const lang = tree.lang;
  const where = [...new Set([...(s.clips ?? []).map((x) => x.media), ...(s.media ?? []), ...(s.input ? [s.input] : [])])];
  const list = (ws: string[]) => ws.slice(0, 6).join(" · ") + (ws.length > 6 ? " · …" : "");
  const task = create<Task>(
    tree,
    "task",
    {
      level: "verify",
      priority: 2,
      what: phrase(lang, "read.source.what", { source: s.id, now: r.id }),
      where: [s.id, ...where],
      why: phrase(lang, "read.source.why", { source: s.id, now: r.id, before: list(c.variants.map((v) => v.at || "—")), after: list(c.variants.map((v) => v.other || "—")) }),
      doneWhen: phrase(lang, "read.source.done", { source: s.id, now: r.id }),
      subject: [s.id],
      state: "open",
      origin: SOURCE_READ_ORIGIN,
    } as never,
    (id) => `+${id} task "hold the reading ${r.id} against the transcript of ${s.id}"`,
  );
  return { ...at, agree: "differ", variants: c.variants, task: task.id };
}
