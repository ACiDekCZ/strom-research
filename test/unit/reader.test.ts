// What a reader writes, read back: each image's result, its entries, what was illegible, the pages and gaps of
// the book — also from reports written before those fields existed.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { batches, parseReport, readerPrompt, saysNothing, viewCount, type ReaderImage } from "../../src/core/reader.ts";
import { summary, parseRanges, type Block } from "../../src/commands/readings.ts";

const dir = path.join(import.meta.dirname, "..", "fixtures", "readings");
const report = (n: number) => fs.readFileSync(path.join(dir, `2026-01-15-B0001-31-60-${n}.md`), "utf8");
const blocks = (text: string): Block[] => parseReport(text).map((f) => ({ ...f, report: "r", num: f.number, recordset: "B0001" }));

test("a reader's report: entries, certainty, what was illegible, pages and gaps of each image", () => {
  const one = parseReport(report(1));
  assert.equal(one.length, 10);
  const found = one.find((f) => f.number === 33)!;
  assert.equal(found.result, "found");
  assert.equal(found.image, "M0033", "the id stays what it was");
  assert.match(found.entries![0]!, /^levá strana, 3\. zápis shora: 14\. März 1849 · Horní Ves N° 12 · Joannes Dworzak/);
  assert.deepEqual(found.certainty, ["Joannes 95 %, Dworzak 90 %, Kolarz 75 %"]);
  assert.equal(found.pages, "65–66");
  // a possible match a reader left in a block with nothing found (an unreadable surname, the rest fits)
  const hidden = one.find((f) => f.number === 37)!;
  assert.equal(hidden.result, "nothing");
  assert.match(hidden.illegible![0]!, /příjmení nečitelné .* není to rodina jen asi na 60 %$/);
  assert.equal(hidden.certainty, undefined, "— says nothing");
  // "žádné", "nic", "vše čitelné", "—": nothing illegible
  for (const f of one.filter((x) => x.result === "nothing" && x.number !== 37)) assert.ok(!f.illegible || /vybledlý/.test(f.illegible[0]!), `${f.number}: ${f.illegible}`);
  const two = parseReport(report(2));
  assert.deepEqual(two.find((f) => f.number === 44)!.gaps, ["strany 87–94 chybí: po straně 86 (snímek 43) následuje 95, vazba bez stop vytržení"]);
  assert.deepEqual(two.find((f) => f.number === 48)!.section, ["od levé strany nová část: Dolní Ves, rok 1853"]);
  assert.equal(two.find((f) => f.number === 46)!.result, "unclear");
});

test("reports written before pages and gaps existed read as before", () => {
  const old = parseReport(report(3));
  assert.equal(old.length, 10);
  assert.ok(old.every((f) => f.pages === undefined && f.gaps === undefined));
  // entries as a list below their key
  assert.equal(old.find((f) => f.number === 55)!.entries!.length, 2);
  assert.match(old.find((f) => f.number === 55)!.entries![1]!, /^levá strana, 2\. zápis: 9\. Junii 1854/);
  // the oldest shape: a head and a result
  assert.deepEqual(
    parseReport("# Reading B0001-1-2 · batch 1 of 1\nQuestion: x\n\n## Image 1 · M0001\nresult: found\nentries: Franz · Haus 13\n\n## Image 2\nresult: nothing\n").map((f) => [f.image, f.result, f.number, f.entries]),
    [["M0001", "found", 1, ["Franz · Haus 13"]], ["2", "nothing", 2, undefined]],
  );
  // a result strom does not know is unclear, as before
  assert.equal(parseReport("## Image 3 · M0003\nresult: maybe\n")[0]!.result, "unclear");
});

test("what says nothing: dashes, none, all legible — in any language strom speaks; a mention is never dropped", () => {
  for (const v of ["—", "-", "none", "None — all legible", "nic", "žádné", "vše čitelné", "alles lesbar", "Нет", "n/a"]) assert.ok(saysNothing(v), v);
  for (const v of ["nothing of the family, but a man aged 58 whose surname is torn off", "pravá strana: muž, 67 let", "Шевчук?"]) assert.ok(!saysNothing(v), v);
});

test("the summary: finds and unclear whole, what was illegible where nothing was found, gaps; --match in any script and NFD", () => {
  const all = [1, 2, 3].flatMap((n) => blocks(report(n)));
  const s = summary(all);
  const text = s.lines.join("\n");
  assert.match(text, /^ {2}33 \[found\] M0033 · p\. 65–66$/m);
  assert.match(text, /^ {2}46 \[unclear\] M0046 · p\. 99–100$/m);
  assert.match(text, /^ {2}37 \[nothing\] illegible: pravá strana, 2\. zápis: muž, 67 let/m);
  assert.doesNotMatch(text, /^ {2}31 /m, "nothing found, nothing illegible: left out");
  assert.match(text, /^gaps in the book \(by image\): 44: strany 87–94 chybí/m);
  assert.match(text, /^parts of the book \(by image\): 48: od levé strany nová část/m);
  // the words of the question repeated in a "nothing" block do not count; what the reader could not read does
  const question = "Každé úmrtí s příjmením Dvořák";
  const nfd = summary(all, { match: ["DVOŘÁK".normalize("NFD")], question }).lines.join("\n");
  assert.match(nfd, /^ {2}55 \[found\]/m);
  assert.doesNotMatch(nfd, /^ {2}40 \[nothing\]/m, nfd);
  const other = summary(all, { match: ["kolar"], question }).lines.join("\n");
  assert.match(other, /^ {2}32 \[nothing\] entries: .*Kolář/m, "another name: the entries of a nothing block count");
  // another script
  const cyr = blocks("## Image 7 · M0007\nresult: nothing\nentries: —\nillegible: 2-я запись: Шевчук? Иван, 61 год — фамилия неразборчива\n\n## Image 8 · M0008\nresult: nothing\nillegible: —\n");
  assert.match(summary(cyr, { match: ["шевчук".normalize("NFD")] }).lines.join("\n"), /^ {2}7 \[nothing\] illegible: 2-я запись: Шевчук\? Иван/m);
  assert.match(summary(cyr, { match: ["ИВАН"] }).lines.join("\n"), /^ {2}7 /m);
  assert.deepEqual(summary(cyr, { match: ["Novák"] }).lines, []);
  // cut short: how many more
  const capped = summary(all, { maxLines: 5 });
  assert.ok(capped.lines.length <= 7 && capped.more > 0, String(capped.more));
});

test("a double page in halves: the prompt says so, one block per image, and a reader counts its views", () => {
  const spread = { id: "M0057", image: 57, page: "≈113", view: "/l.jpg", parts: [{ label: "left half", view: "/l.jpg" }, { label: "right half", view: "/r.jpg" }], halves: true };
  const p = readerPrompt({ question: "q", report: "/r.md", lang: "cs", images: [spread] });
  assert.match(p, /^A double page comes as its two halves.*overlap at the gutter\. An entry may\nrun across both pages: read the two halves of an image together, line by line, and write one block for the image\.\n- M0057/m);
  assert.match(p, /^- M0057 · image 57 · page ≈113 — a double page in two halves:\n {4}left half: \/l\.jpg\n {4}right half: \/r\.jpg$/m);
  assert.doesNotMatch(readerPrompt({ question: "q", report: "/r.md", lang: "cs", images: [{ id: "M0001", view: "/v.jpg" }] }), /double page/, "said only when there is one");
  // what the reader writes back is read as before: the image's number and id
  assert.deepEqual(parseReport("## Image 57 · M0057\nresult: found\nentries: levá strana, 2. zápis: …\npages: 113–114\n").map((f) => [f.number, f.image, f.pages]), [[57, "M0057", "113–114"]]);
  const one = (n: number): ReaderImage => ({ id: `M${n}`, view: "/v.jpg" });
  const items: ReaderImage[] = [one(1), spread, one(2), spread, spread, one(3)];
  assert.deepEqual(batches(items, 4, viewCount).map((b) => b.reduce((n, i) => n + viewCount(i), 0)), [4, 4, 1]);
  assert.deepEqual(batches(items, 1, viewCount).length, 6, "an image of more views than a batch takes is one batch");
  assert.deepEqual(batches([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]], "one view each: as before");
});

test("the reader's prompt asks for possible matches as unclear and for the gaps of the book", () => {
  const p = readerPrompt({ question: "q", report: "/r.md", lang: "cs", images: [{ id: "M0001", image: 1, view: "/v.jpg" }] });
  assert.match(p, /^pages: /m);
  assert.match(p, /^gaps: only when pages are missing/m);
  assert.match(p, /^section: /m);
  assert.match(p, /"unclear" is for a possible match you cannot confirm/);
  assert.match(p, /never hide it inside a "nothing" block/);
  assert.deepEqual(parseRanges("5-113,130–228"), [[5, 113], [130, 228]]);
  assert.equal(parseRanges("pages"), undefined);
});
