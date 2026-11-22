// Whether the images searched in a book cover the years around a date estimated from an age (spec 131 U1, K1.1–K1.2):
// the years of the images known only from the searches (--pages with --years, page by page or an index), nothing said
// where they are unknown or disagree, the window an estimate ± the margin.

import "../helpers.ts"; // run alone too: never the person's home and settings
import { test } from "node:test";
import assert from "node:assert/strict";
import { anchorsOf, bookCoverage, coverageLine, estimateWindow, mergeSpans, pageRanges, yearsAt } from "../../src/core/coverage.ts";
import type { Search } from "../../src/core/model.ts";

const BOOK = { id: "B0001", years: "1732-1784", images: 251 };

function search(id: string, pages: string | undefined, years: string | undefined, more: Partial<Search> = {}): Search {
  return {
    id,
    type: "search",
    created: "2026-11-22T00:00:00Z",
    updated: "2026-11-22T00:00:00Z",
    question: "Křty Lhoták",
    recordsets: ["B0001"],
    scope: { ...(pages ? { pages } : {}), ...(years ? { years } : {}) },
    method: "page-by-page",
    result: "found",
    findings: [],
    by: "main",
    notes: [],
    ...more,
  };
}

// the book of the regression (N1003): images 61–65 = 1755–1758, 66–80 = 1758–1764, 81–85 = 1764–1767
const MAP = [search("Q0001", "66-80", "1758-1764"), search("Q0002", "81–85", "1764–1767")];
const ABT_1761 = { ...estimateWindow("ABT 1761", 5)!, person: "P0001", date: "ABT 1761", margin: 5 };

test("pageRanges: ranges with any dash, several; anything else is no range", () => {
  assert.deepEqual(pageRanges("66-85"), [{ from: 66, to: 85 }]);
  assert.deepEqual(pageRanges("61–65, 81—85"), [{ from: 61, to: 65 }, { from: 81, to: 85 }]);
  assert.deepEqual(pageRanges("12"), [{ from: 12, to: 12 }]);
  assert.deepEqual(pageRanges("85-81"), [{ from: 81, to: 85 }]);
  assert.equal(pageRanges("fol. 12"), undefined);
  assert.equal(pageRanges("str. 3–5"), undefined);
  assert.equal(pageRanges(undefined), undefined);
  assert.deepEqual(mergeSpans([{ from: 81, to: 85 }, { from: 66, to: 80 }]), [{ from: 66, to: 85 }]);
});

test("estimateWindow (K1.2): ABT/EST/CAL ± margin, BET a AND b widened by it; nothing for a date as written or an open one", () => {
  assert.deepEqual(estimateWindow("ABT 1761", 5), { from: 1756, to: 1766 });
  assert.deepEqual(estimateWindow("EST 1761", 7), { from: 1754, to: 1768 });
  assert.deepEqual(estimateWindow("CAL MAR 1761", 5), { from: 1756, to: 1766 });
  assert.deepEqual(estimateWindow("BET 1758 AND 1760", 5), { from: 1753, to: 1765 });
  assert.equal(estimateWindow("1761", 5), undefined);
  assert.equal(estimateWindow("12 MAR 1761", 5), undefined);
  assert.equal(estimateWindow("BEF 1761", 5), undefined);
  assert.equal(estimateWindow("AFT 1761", 5), undefined);
  assert.equal(estimateWindow(undefined, 5), undefined);
});

test("the years of an image: within a search by its place in it, between two close ones between them, else unknown", () => {
  const anchors = anchorsOf(MAP, "B0001")!;
  assert.deepEqual(yearsAt(anchors, 66), { from: 1758, to: 1759 });
  assert.deepEqual(yearsAt(anchors, 85), { from: 1766, to: 1767 });
  assert.equal(yearsAt(anchors, 60), undefined, "before the first search: no year guessed");
  const gap = anchorsOf([search("Q0001", "50-55", "1750-1752"), search("Q0002", "60-65", "1754-1756")], "B0001")!;
  assert.deepEqual(yearsAt(gap, 57), { from: 1752, to: 1754 }, "4 images between: between their years");
  const far = anchorsOf([search("Q0001", "10-15", "1740-1742"), search("Q0002", "40-45", "1750-1752")], "B0001")!;
  assert.equal(yearsAt(far, 27), undefined, "more than ~10 images between: no year guessed (K1.1)");
});

test("only searches of the book with images and years, page by page or an index, say the years of its images (K1.1)", () => {
  const others = [
    search("Q0003", "1-5", "1732-1734", { method: "web" }),
    search("Q0004", "1-5", "1732-1734", { recordsets: ["B0001", "B0002"] }),
    search("Q0005", "1-5", undefined),
    search("Q0006", "fol. 3", "1732"),
    search("Q0007", "1-5, 9", "1732-1735"),
    search("Q0008", "1-5", "1732-1734", { retracted: { at: "2026-11-22T00:00:00Z", reason: "x" } }),
    search("Q0009", "1-5", "1732-1734", { recordsets: ["B0002"] }),
  ];
  assert.deepEqual(anchorsOf([...MAP, ...others], "B0001")!.map((a) => a.id), ["Q0001", "Q0002"]);
  assert.deepEqual(anchorsOf([...MAP, search("Q0010", "1-5", "1732-1734", { method: "index" })], "B0001")!.map((a) => a.id), ["Q0010", "Q0001", "Q0002"]);
});

test("the regression of N1003: images 66–85 searched, born ABT 1761 ±5 — 1756–1757 not searched, the book continues before image 66", () => {
  const c = bookCoverage(BOOK, MAP, ABT_1761);
  assert.ok(c);
  assert.deepEqual(c.searched, [{ from: 1758, to: 1767 }]);
  assert.deepEqual(c.images, [{ from: 66, to: 85 }]);
  assert.deepEqual(c.missing, [{ from: 1756, to: 1757, where: "before image 66", continues: true }]);
  assert.deepEqual(c.by, ["Q0001", "Q0002"]);
  const line = coverageLine(c);
  assert.match(line, /P0001 ABT 1761 ±5 → 1756–1766/);
  assert.match(line, /1756–1757 not searched — the book continues before image 66/);
});

test("of searches over the same images, the one over fewer says their years: a wider claim does not cover the window", () => {
  const claim = search("Q0003", "66-85", "1756-1766", { result: "negative" });
  const c = bookCoverage(BOOK, [...MAP, claim], ABT_1761);
  assert.deepEqual(c?.missing.map((m) => [m.from, m.to]), [[1756, 1757]]);
});

test("images 61–85 searched: the window covered, nothing said", () => {
  assert.equal(bookCoverage(BOOK, [search("Q0003", "61-65", "1755-1758"), ...MAP], ABT_1761), undefined);
});

test("a search of another task covering the rest counts: nothing said", () => {
  assert.equal(bookCoverage(BOOK, [...MAP, search("Q0003", "61-65", "1755-1758", { task: "T0009", result: "negative" })], ABT_1761), undefined);
});

test("a book without searches, or with images whose years nobody gave: nothing said", () => {
  assert.equal(bookCoverage(BOOK, [], ABT_1761), undefined);
  assert.equal(bookCoverage(BOOK, [search("Q0001", "66-85", undefined)], ABT_1761), undefined);
  assert.equal(bookCoverage(BOOK, [search("Q0001", undefined, "1758-1767")], ABT_1761), undefined);
});

test("searches disagreeing on the years of the same images, or later images in earlier years: nothing said", () => {
  assert.equal(bookCoverage(BOOK, [...MAP, search("Q0003", "70-75", "1740-1742")], ABT_1761), undefined);
  assert.equal(bookCoverage(BOOK, [...MAP, search("Q0003", "120-125", "1735-1737")], ABT_1761), undefined);
});

test("BET 1758 AND 1760 ± 5: 1753–1757 not searched", () => {
  const c = bookCoverage(BOOK, MAP, { ...estimateWindow("BET 1758 AND 1760", 5)!, person: "P0001", date: "BET 1758 AND 1760", margin: 5 });
  assert.deepEqual(c?.missing, [{ from: 1753, to: 1757, where: "before image 66", continues: true }]);
});

test("missing years outside the book's own years are another book's: only the part within the book is said", () => {
  assert.equal(bookCoverage({ ...BOOK, years: "1758-1784" }, MAP, ABT_1761), undefined, "the book begins 1758");
  const late = bookCoverage(BOOK, MAP, { ...estimateWindow("ABT 1766", 5)!, person: "P0001", date: "ABT 1766", margin: 5 });
  assert.deepEqual(late?.missing, [{ from: 1768, to: 1771, where: "after image 85", continues: true }]);
  assert.equal(bookCoverage({ ...BOOK, years: "1700-1720" }, MAP, ABT_1761), undefined, "the window outside the book");
});

test("a stretch of images left out between two searched: those images named", () => {
  const map = [search("Q0001", "61-65", "1755-1758"), search("Q0002", "66-70", "1758-1760"), search("Q0003", "71-80", "1760-1764"), search("Q0004", "81-85", "1764-1767")];
  // searched 61–65 and 81–85 only (the map from all four, the images from the searches named here)
  const only = bookCoverage(BOOK, [map[0]!, map[3]!], ABT_1761, {});
  assert.ok(only);
  assert.deepEqual(only.missing.map((m) => [m.from, m.to, m.where]), [[1759, 1763, "images 66–80"]]);
  // years searched without their images (an index of the years, a catalogue) count as searched
  const index = bookCoverage(BOOK, [map[0]!, map[3]!, search("Q0005", undefined, "1758-1760", { method: "index" })], ABT_1761);
  assert.deepEqual(index?.missing.map((m) => [m.from, m.to, m.where]), [[1761, 1763, "images 66–80"]]);
});

test("images left out between two searched stretches whose years touch theirs: named always, with the years about them", () => {
  // the verifier's case: 1–5 = 1734–1736, 6–9 = 1736–1738, 20–30 = 1739–1743; 10–19 (about 1738–1739) never looked at
  const map = [search("Q0001", "1-5", "1734-1736"), search("Q0002", "6-9", "1736-1738"), search("Q0003", "20-30", "1739-1743")];
  const bet = { ...estimateWindow("BET 1740 AND 1742", 5)!, person: "P0001", date: "BET 1740 AND 1742", margin: 5 };
  const c = bookCoverage(BOOK, map, bet);
  assert.ok(c);
  assert.deepEqual(c.images, [{ from: 1, to: 9 }, { from: 20, to: 30 }]);
  assert.deepEqual(c.missing, [
    { from: 1738, to: 1739, where: "images 10–19", continues: true, images: { from: 10, to: 19 } },
    { from: 1744, to: 1747, where: "after image 30", continues: true },
  ]);
  const line = coverageLine(c);
  assert.match(line, /images 10–19 \(about 1738–1739\) not searched; 1744–1747 not searched — the book continues after image 30/);
  // all searched there: nothing left out between, nothing said of images 10–19
  const whole = bookCoverage(BOOK, [...map, search("Q0004", "10-19", "1738-1739")], bet);
  assert.deepEqual(whole?.missing.map((m) => m.where), ["after image 30"]);
  // the images left out outside the window: not said, nothing missing at all
  const early = bookCoverage(BOOK, map, { from: 1741, to: 1743 });
  assert.equal(early, undefined);
});

test("the search under check is left out of the measure, its images counted (search add/edit)", () => {
  const claim = search("Q0003", "66-85", "1756-1766", { result: "negative" });
  const c = bookCoverage(BOOK, [...MAP, claim], { from: 1756, to: 1766, years: "1756-1766" }, { except: "Q0003" });
  assert.deepEqual(c?.missing, [{ from: 1756, to: 1757, where: "before image 66", continues: true }]);
  assert.match(coverageLine(c!), /--years 1756–1766/);
});
