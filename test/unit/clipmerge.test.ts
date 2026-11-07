// Clips of one image that overlap are one entry cut twice: joined into one rectangle covering both (core/clipmerge.ts).

import { test } from "node:test";
import assert from "node:assert/strict";
import { agentClipped, CLIP_NESTED, CLIP_OVERLAP, cutTwice, handClipped, mergeOverlappingClips, overlapShare } from "../../src/core/clipmerge.ts";
import type { Clip } from "../../src/core/model.ts";
import type { Op } from "../../src/core/tree.ts";

const clip = (media: string, x: number, y: number, w: number, h: number): Clip => ({ media, region: { x, y, w, h } });

test("two clips of one image that overlap become one covering both, in the place of the first", () => {
  // one entry cut twice: the first cuts off its bottom lines, the second its right part
  const a = clip("M0001", 0.04, 0.74, 0.42, 0.12);
  const b = clip("M0001", 0.06, 0.78, 0.3, 0.15);
  assert.ok(overlapShare(a.region, b.region) >= CLIP_OVERLAP);
  const r = mergeOverlappingClips([a, b]);
  assert.deepEqual(r.clips, [clip("M0001", 0.04, 0.74, 0.42, 0.19)]);
  assert.deepEqual(r.joined, [{ from: [a, b], into: clip("M0001", 0.04, 0.74, 0.42, 0.19) }]);
  // the other way round: the same rectangle
  assert.deepEqual(mergeOverlappingClips([b, a]).clips, [clip("M0001", 0.04, 0.74, 0.42, 0.19)]);
});

test("clips side by side, touching a little, or of other images stay apart", () => {
  const apart = [clip("M0001", 0.1, 0.1, 0.3, 0.2), clip("M0001", 0.5, 0.1, 0.3, 0.2)];
  assert.deepEqual(mergeOverlappingClips(apart), { clips: apart, joined: [] });
  // an entry going on in the next column: they meet at an edge
  const edge = [clip("M0001", 0.1, 0.1, 0.4, 0.2), clip("M0001", 0.5, 0.1, 0.4, 0.2)];
  assert.deepEqual(mergeOverlappingClips(edge).clips, edge);
  // overlapping by an eighth of the smaller one: below the share, apart
  const touch = [clip("M0001", 0.1, 0.1, 0.4, 0.2), clip("M0001", 0.45, 0.1, 0.4, 0.2)];
  assert.ok(overlapShare(touch[0]!.region, touch[1]!.region) < CLIP_OVERLAP);
  assert.deepEqual(mergeOverlappingClips(touch).clips, touch);
  // the same place on two images (an entry over a page break)
  const pages = [clip("M0001", 0.04, 0.74, 0.42, 0.12), clip("M0002", 0.06, 0.78, 0.3, 0.15)];
  assert.deepEqual(mergeOverlappingClips(pages).clips, pages);
});

test("three in a chain are one; the others keep their places; a clip that takes no part stays as it is", () => {
  const a = clip("M0001", 0.1, 0.1, 0.3, 0.1);
  const b = clip("M0001", 0.2, 0.15, 0.3, 0.1);
  const c = clip("M0001", 0.3, 0.2, 0.3, 0.1);
  // a and c do not overlap at all: only through b
  assert.equal(overlapShare(a.region, c.region), 0);
  const other = clip("M0002", 0.1, 0.1, 0.5, 0.5);
  const away = clip("M0001", 0.1, 0.6, 0.5, 0.2);
  const r = mergeOverlappingClips([other, a, away, c, b]);
  assert.deepEqual(r.clips, [other, clip("M0001", 0.1, 0.1, 0.5, 0.2), away]);
  assert.equal(r.joined.length, 1);
  assert.deepEqual(r.joined[0]!.from, [a, b, c]);
  // a clip of a person's: never joined, nor joined into
  const kept = mergeOverlappingClips([a, b, c], (_, i) => i === 0);
  assert.deepEqual(kept.clips, [a, clip("M0001", 0.2, 0.15, 0.4, 0.15)]);
  // the same clip twice: one
  assert.deepEqual(mergeOverlappingClips([a, { ...a, region: { ...a.region } }]).clips, [a]);
});

test("a clip (nearly) whole inside a larger one is nested — a detail, an entry beside the whole page: both stay; partly overlapping ones join; nearly the same rectangle twice is one", () => {
  // an entry beside the whole page
  const page = clip("M0001", 0, 0, 1, 1);
  const entry = clip("M0001", 0.05, 0.4, 0.9, 0.2);
  assert.ok(overlapShare(page.region, entry.region) > 0.999);
  assert.equal(cutTwice(page.region, entry.region), false);
  assert.deepEqual(mergeOverlappingClips([page, entry]), { clips: [page, entry], joined: [] });
  assert.deepEqual(mergeOverlappingClips([entry, page]).clips, [entry, page]);
  // a detail cut on purpose (a name in its entry), 95 % of it inside: both stay
  const whole = clip("M0001", 0.1, 0.5, 0.6, 0.15);
  const name = clip("M0001", 0.3, 0.555, 0.1, 0.1);
  const share = overlapShare(whole.region, name.region);
  assert.ok(share >= CLIP_NESTED && share < 0.99, String(share));
  assert.deepEqual(mergeOverlappingClips([whole, name]).clips, [whole, name]);
  // the same detail sticking out more (60 % inside): partly overlapping, joined
  const out = clip("M0001", 0.3, 0.59, 0.1, 0.1);
  const part = overlapShare(whole.region, out.region);
  assert.ok(part >= CLIP_OVERLAP && part < CLIP_NESTED, String(part));
  assert.deepEqual(mergeOverlappingClips([whole, out]).clips, [clip("M0001", 0.1, 0.5, 0.6, 0.19)]);
  // nearly the same rectangle twice (each 95 % of the other): the same clip, one
  const again = clip("M0001", 0.105, 0.5, 0.6, 0.15);
  assert.deepEqual(mergeOverlappingClips([whole, again]).clips, [clip("M0001", 0.1, 0.5, 0.605, 0.15)]);
  // a chain through a nested one: the whole page keeps every entry beside it; two entries cut twice still join
  const e1 = clip("M0001", 0.1, 0.1, 0.4, 0.12);
  const e2 = clip("M0001", 0.12, 0.14, 0.3, 0.14);
  const r = mergeOverlappingClips([page, e1, e2]);
  assert.deepEqual(r.clips, [page, clip("M0001", 0.1, 0.1, 0.4, 0.18)]);
  assert.deepEqual(r.joined[0]!.from, [e1, e2]);
});

test("the clips a person may have written: a write of the user's that carries clips, never one of strom's readers", () => {
  const op = (o: Partial<Op>): Op => ({ at: "2026-01-01T00:00:00Z", op: "source.add", targets: [], summary: "", by: "user", files: [], prev: "", k: "", sig: "", ...o });
  const ids = new Set(["S0001", "S0002", "S0003", "S0004", "S0005", "S0006", "S0007"]);
  const hand = handClipped(
    [
      op({ targets: ["S0001"], summary: '+S0001 source "Křest Vojtěcha Lhotáka" on M0001' }),
      op({ targets: ["S0002"], summary: '+S0002 source "Křest Jiřího Lhotáka"' }),
      op({ targets: ["S0003"], summary: '+S0003 source "Крещение Лхотака" on M0003', by: "N0001" }),
      op({ op: "source.edit", targets: ["S0004"], summary: "S0004 edited" }),
      op({ op: "source.edit", targets: ["S0005"], summary: "S0005 clips M0001@0.1,0.1,0.3,0.1 (found by a reader, checked)" }),
      op({ op: "source.media", targets: ["S0006"], summary: "S0006 image M0002 with the part the entry is on (the Strom app)" }),
      op({ op: "source.media", targets: ["S0007"], summary: "S0007 image M0002 (the Strom app)" }),
      op({ targets: ["S0099"], summary: '+S0099 source "Lhota" on M0001' }),
    ],
    ids,
  );
  assert.deepEqual([...hand].sort(), ["S0001", "S0004", "S0006"]);
});

test("the clips the research wrote: only where the history says so — a write of an agent's or a session's, none of a person's", () => {
  const op = (o: Partial<Op>): Op => ({ at: "2026-01-01T00:00:00Z", op: "source.add", targets: [], summary: "", by: "N0001", files: [], prev: "", k: "", sig: "", ...o });
  const ids = new Set(["S0001", "S0002", "S0003", "S0004", "S0005", "S0006"]);
  const research = agentClipped(
    [
      op({ targets: ["S0001"], summary: '+S0001 source "Křest Vojtěcha Lhotáka" on M0001' }),
      op({ op: "source.edit", targets: ["S0002"], summary: "S0002 edited", by: "agent" }),
      // a session's, then a person's edit that may have given clips: not told for sure
      op({ targets: ["S0003"], summary: '+S0003 source "Křest Jiřího Lhotáka" on M0002' }),
      op({ op: "source.edit", targets: ["S0003"], summary: "S0003 edited", by: "user" }),
      // strom clips run by the person: its readers' clips
      op({ op: "source.edit", targets: ["S0004"], summary: "S0004 clips M0001@0.1,0.1,0.3,0.1 (found by a reader, checked)", by: "user" }),
      // a session's write that carries no clips (no images), and S0006 with no write at all
      op({ targets: ["S0005"], summary: '+S0005 source "Крещение Лхотака"' }),
      op({ op: "source.changed", targets: ["S0005"], summary: "S0005 changed" }),
    ],
    ids,
  );
  assert.deepEqual([...research].sort(), ["S0001", "S0002", "S0004"]);
});
