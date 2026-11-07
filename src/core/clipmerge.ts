// Excerpts of one image that overlap are one entry cut twice: a reader's first clip cuts off the bottom lines, a second
// one the right part, and the Strom app shows two nearly identical excerpts of the same entry. Two clips of the same
// image whose overlap is at least CLIP_OVERLAP of the smaller one become one rectangle covering both (again and again,
// so three in a chain are one), in the place of the first; clips apart (the entry going on in another column, on
// another page) stay as they are, and so does a clip lying (nearly) whole inside a larger one — CLIP_NESTED of the
// smaller one or more within it: a detail cut on purpose (a name, a date), or an entry beside the whole page, never the
// same entry cut twice (two nearly the same rectangle are, and are one). Only what the research wrote: a clip a person gave (at their terminal, in the Strom
// app) is never changed — a clip there already is the research's only when the history says so (agentClipped: the
// writes that can carry it are an agent's or a session's, none a person's); not told for sure, it stays. Nothing else of
// the source changes: its transcript, who read it (read.user, the user's confirmation) stay as they are. On write (strom source add/edit --clip by an agent, strom clips) and once in a research an
// older strom wrote (settleClips: at the first start of this strom and at a bridge's start, one commit, the marker
// CLIPS_SETTLED in strom.json — an older strom reads the clips as any others and keeps the marker).
// Nothing keys on a clip's place in the list: an excerpt is known by its mark (core/excerpt.ts clipMark, of the image
// and the region), so a joined clip is a new excerpt and the old marks are simply not there any more.

import type { Clip, Region, Source } from "./model.ts";
import { now, VERSION, type Op, type Tree } from "./tree.ts";
import { clipText } from "./media.ts";
import { freshConfig, quiet } from "./hypolinks.ts";
import { writableUnasked } from "./integrity.ts";
import { typedByHand } from "./readers.ts";
import type { Env } from "./paths.ts";

/** Two clips of one image that overlap by at least this share of the smaller one are one (unless nested: CLIP_NESTED). */
export const CLIP_OVERLAP = 0.3;

/**
 * A clip with this share of it or more inside another, which is larger (it holds less than this share of the larger
 * one), is nested in it: a detail or an entry beside a whole page — both stay. Two nearly the same rectangle (each this
 * share or more of the other) are the same clip twice: one.
 */
export const CLIP_NESTED = 0.9;

/** Two clips of one image that are one entry cut twice: overlapping by CLIP_OVERLAP of the smaller or more, not nested. */
export function cutTwice(a: Region, b: Region): boolean {
  const share = overlapShare(a, b);
  if (share < CLIP_OVERLAP) return false;
  return share < CLIP_NESTED || largerShare(a, b) >= CLIP_NESTED;
}

/** The share of the larger region the two have in common (0 when either has no area). */
function largerShare(a: Region, b: Region): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  const larger = Math.max(a.w * a.h, b.w * b.h);
  if (w <= 0 || h <= 0 || !(larger > 0)) return 0;
  return (w * h) / larger;
}

/** The marker in strom.json: the overlapping clips of this research joined once. */
export const CLIPS_SETTLED = "clips-joined-1";

/** The share of the smaller region the two have in common (0 when either has no area). */
export function overlapShare(a: Region, b: Region): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  const smaller = Math.min(a.w * a.h, b.w * b.h);
  if (w <= 0 || h <= 0 || !(smaller > 0)) return 0;
  return (w * h) / smaller;
}

const round = (n: number) => Math.round(n * 10_000) / 10_000;

/** The rectangle covering both, its fractions to four places and within the image. */
function cover(a: Region, b: Region): Region {
  const x = round(Math.max(0, Math.min(a.x, b.x)));
  const y = round(Math.max(0, Math.min(a.y, b.y)));
  const w = round(Math.min(1, Math.max(a.x + a.w, b.x + b.w)) - x);
  const h = round(Math.min(1, Math.max(a.y + a.h, b.y + b.h)) - y);
  return { x, y, w: Math.min(w, round(1 - x)), h: Math.min(h, round(1 - y)) };
}

/** Clips joined into one: those it was made of (in their order), and the one in their place. */
export interface JoinedClip {
  from: Clip[];
  into: Clip;
}

/**
 * The clips with every two of one image that overlap enough joined into one (again, until no two do), the joined one
 * in the place of the first of them. A clip `fixed` says (a person's) takes no part: it stays as it is, where it is.
 */
export function mergeOverlappingClips(clips: readonly Clip[], fixed: (c: Clip, i: number) => boolean = () => false): { clips: Clip[]; joined: JoinedClip[] } {
  const items = clips.map((c, i) => ({ clip: c, fixed: fixed(c, i), from: [c] }));
  for (let again = true; again; ) {
    again = false;
    outer: for (let i = 0; i < items.length; i++) {
      const a = items[i]!;
      if (a.fixed) continue;
      for (let j = i + 1; j < items.length; j++) {
        const b = items[j]!;
        if (b.fixed || b.clip.media !== a.clip.media || !cutTwice(a.clip.region, b.clip.region)) continue;
        items[i] = { clip: { ...a.clip, region: cover(a.clip.region, b.clip.region) }, fixed: false, from: [...a.from, ...b.from] };
        items.splice(j, 1);
        again = true;
        break outer;
      }
    }
  }
  return { clips: items.map((x) => x.clip), joined: items.filter((x) => x.from.length > 1).map((x) => ({ from: x.from, into: x.clip })) };
}

/** "M0001@0.04,0.74,0.42,0.12 + M0001@0.06,0.78,0.3,0.15 → M0001@0.04,0.74,0.42,0.19" */
export function joinedText(j: JoinedClip): string {
  return `${j.from.map(clipText).join(" + ")} → ${clipText(j.into)}`;
}

/**
 * Does the research write the clips now — an agent, a session of strom's, or anything not typed at a person's own
 * terminal (an agent strom does not know runs it without one) — never the Strom app (its bridge writes the user's)?
 */
export function researchWritesNow(tree: Tree, env: Env, tty: boolean): boolean {
  if (env.STROM_FOR_APP === "1") return false;
  return tree.actor !== "user" || !typedByHand(env, { tty });
}

/** strom clips and strom transcripts: what their readers found, checked, written by whoever ran them. */
const BY_READERS = /by a reader, checked\)$/u;

/**
 * The sources (of `ids`) whose clips a person may have written: a write of "user" that can carry clips — strom source
 * add with images (" on M…": the clips' images are among them), strom source edit (its summary does not say clips),
 * the part of a scan the Strom app gave ("with the part the entry is on") — never a write of strom's readers. A write
 * of "user" an older strom did not know was an agent's counts as a person's too: their clips are left as they are.
 */
export function handClipped(ops: readonly Op[], ids: ReadonlySet<string>): Set<string> {
  const out = new Set<string>();
  for (const o of ops) {
    if (o.by !== "user") continue;
    const clips =
      (o.op === "source.add" && /" on M\d/u.test(o.summary)) ||
      (o.op === "source.edit" && !BY_READERS.test(o.summary)) ||
      (o.op === "source.media" && o.summary.includes("with the part the entry is on"));
    if (!clips) continue;
    for (const id of o.targets) if (ids.has(id)) out.add(id);
  }
  return out;
}

/** A write of the research's (an agent, a session) that can carry clips, or strom's readers' clips whoever ran them. */
function researchClipped(o: Op): boolean {
  if (o.op === "source.edit" && BY_READERS.test(o.summary)) return true;
  if (o.by === "user") return false;
  return (o.op === "source.add" && /" on M\d/u.test(o.summary)) || o.op === "source.edit";
}

/**
 * The sources (of `ids`) whose clips the history shows the research wrote: one of its writes that can carry clips,
 * none of a person's (handClipped). Not told for sure (no such write in the history, or a person's beside it): not the
 * research's — left as they are.
 */
export function agentClipped(ops: readonly Op[], ids: ReadonlySet<string>): Set<string> {
  const hand = handClipped(ops, ids);
  const out = new Set<string>();
  for (const o of ops) if (researchClipped(o)) for (const id of o.targets) if (ids.has(id) && !hand.has(id)) out.add(id);
  return out;
}

/** The sources with clips that would be joined: each with what it would be. */
function toJoin(tree: Tree): { source: Source; clips: Clip[]; joined: JoinedClip[] }[] {
  const out: { source: Source; clips: Clip[]; joined: JoinedClip[] }[] = [];
  for (const s of tree.list<Source>("source")) {
    if (s.retracted || (s.clips?.length ?? 0) < 2) continue;
    const m = mergeOverlappingClips(s.clips!);
    if (m.joined.length) out.push({ source: s, ...m });
  }
  return out;
}

export interface SettledClips {
  /** The sources whose clips were joined, with what became of them. */
  joined: { source: string; joined: JoinedClip[] }[];
  /** The sources left as they are: their clips a person may have written, or the history does not say who. */
  left: string[];
}

/**
 * Once per research, at the first start of this strom and at a bridge's start: the overlapping clips of one image the
 * research wrote joined into one — each source one logged operation (what was joined into what; its version before
 * stays in the history), the marker in strom.json, in one commit. Only clips the history shows the research wrote
 * (agentClipped); a person's, or ones it cannot tell, are left. Nothing but the clips changes (the transcript, who read it).
 * Nothing to join: nothing written (looked at again next time, cheaply). Skipped while somebody is at work on the tree
 * or holds its lock, while strom may not write it unasked (another computer's seal, data changed outside strom), in a
 * dry run. A failure on the way leaves nothing written. What it did, else undefined.
 */
export function settleClips(tree: Tree): SettledClips | undefined {
  if (tree.dryRun || tree.config.settled?.includes(CLIPS_SETTLED)) return undefined;
  if (!toJoin(tree).length || !quiet(tree)) return undefined;
  let out: SettledClips | undefined;
  tree.atomically(() => {
    // read afresh under the lock: another strom may have settled it meanwhile
    if (!freshConfig(tree) || tree.config.settled?.includes(CLIPS_SETTLED) || !writableUnasked(tree)) return;
    const found = toJoin(tree);
    if (!found.length) return;
    const research = agentClipped(tree.readOps(), new Set(found.map((f) => f.source.id)));
    const result: SettledClips = { joined: [], left: [] };
    const at = now();
    for (const f of found) {
      // only clips the history shows the research wrote: the transcript, its readers and all else as they are
      if (!research.has(f.source.id)) {
        result.left.push(f.source.id);
        continue;
      }
      tree.put(
        { ...structuredClone(f.source), clips: f.clips, updated: at },
        {
          op: "source.clips",
          targets: [f.source.id],
          summary: `${f.source.id} overlapping clips of one image joined: ${f.joined.map(joinedText).join("; ")}`,
          reason: `strom ${VERSION}: clips of one image that overlap by ${Math.round(CLIP_OVERLAP * 100)} % or more of the smaller one, not ${Math.round(CLIP_NESTED * 100)} % or more inside the other, are one entry`,
        },
      );
      result.joined.push({ source: f.source.id, joined: f.joined });
    }
    tree.updateConfig(
      (c) => {
        c.settled = [...new Set([...(c.settled ?? []), CLIPS_SETTLED])];
      },
      { op: "tree.settle", summary: result.joined.length ? "the overlapping clips of one image joined once" : "the overlapping clips of one image: none to join (a person's, or not told whose, left as they are)" },
    );
    tree.commit(
      result.joined.length
        ? `Overlapping clips of one image joined into one: ${result.joined.map((j) => j.source).join(", ")}${result.left.length ? `; left as they are: ${result.left.join(", ")}` : ""}`
        : `Overlapping clips of one image left as they are: ${result.left.join(", ")}`,
    );
    out = result;
  });
  return out;
}
