// Spans of years and dates as agents write them: an en dash (as in the help), a span written backwards, a value
// that is no span at all — never a silent "no filter" and never a span nothing falls into.

import { test } from "node:test";
import assert from "node:assert/strict";
import { World, hasGit } from "../helpers.ts";
import { parseYears, yearsOverlap } from "../../src/core/years.ts";
import { normalizeAge } from "../../src/core/age.ts";
import { reversedRange, yearLabel } from "../../src/core/gdate.ts";

const opts = { skip: !hasGit };

test("years: any dash, single years, a span backwards read in order", () => {
  assert.deepEqual(parseYears("1903–1907"), { from: 1903, to: 1907 });
  assert.deepEqual(parseYears(" 1903 — 1907 "), { from: 1903, to: 1907 });
  assert.deepEqual(parseYears("1903-1907"), { from: 1903, to: 1907 });
  assert.deepEqual(parseYears("1904"), { from: 1904, to: 1904 });
  assert.deepEqual(parseYears("1907-1903"), { from: 1903, to: 1907, reversed: true });
  for (const bad of ["", "1903..1907", "abc", "1903-", "19o3"]) assert.equal(parseYears(bad), undefined, bad);
  assert.equal(yearsOverlap("1880-1885", "1903–1907"), false);
  assert.equal(yearsOverlap("1907-1903", "1904"), true);
});

test("searched --years: an en dash filters, a value that is no span is an error, a span backwards is swapped and said", opts, async () => {
  const w = new World();
  await w.withTree();
  await w.ok(["recordset", "add", "Kniha N 1870-1910", "--places", "Lhota", "--years", "1870–1910", "--access", "online-free"]);
  await w.ok(["search", "add", "Křty Novák 1880–1885", "--recordset", "B1", "--years", "1880-1885", "--surname", "Novák", "--method", "page-by-page", "--result", "negative"]);
  const back = await w.ok(["search", "add", "Křty Novák 1903–1907", "--recordset", "B1", "--years", "1907-1903", "--surname", "Novák", "--method", "page-by-page", "--result", "negative"]);
  assert.match(back.out, /--years 1907-1903 read as 1903-1907/);
  assert.equal((await w.ok(["search", "show", "Q2", "--json"])).json.search.scope.years, "1903-1907");

  const dash = await w.ok(["searched", "B1", "--years", "1903–1907", "--json"]);
  assert.deepEqual(dash.json.searches.map((s: { id: string }) => s.id), ["Q0002"]);
  assert.deepEqual((await w.ok(["searched", "B1", "--years", "1904", "--json"])).json.searches.map((s: { id: string }) => s.id), ["Q0002"]);
  const bad = await w.run(["searched", "B1", "--years", "1903..1907"]);
  assert.equal(bad.code, 2);
  assert.match(bad.err, /invalid --years "1903\.\.1907"\n→ one year or a span, earlier year first: --years 1903 or --years 1903-1907/);
  assert.equal((await w.run(["search", "add", "x", "--years", "abc", "--method", "page-by-page", "--result", "negative"])).code, 2);

  const rs = await w.ok(["recordset", "edit", "B1", "--years", "1910-1870"]);
  assert.match(rs.out, /read as 1870-1910/);
  assert.equal((await w.ok(["recordset", "show", "B1", "--json"])).json.recordset.years, "1870-1910");
  w.cleanup();
});

test("dates: a range written backwards is refused with the order; ages and labels", opts, async () => {
  assert.equal(reversedRange("BET 1820 AND 1784"), "BET 1784 AND 1820");
  assert.equal(reversedRange("FROM MAR 1845 TO JAN 1845"), "FROM JAN 1845 TO MAR 1845");
  assert.equal(reversedRange("BET 1784 AND 1820"), undefined);
  assert.equal(reversedRange("BET MAR 1850 AND 1850"), undefined);
  assert.equal(normalizeAge("27.99"), "28y");
  assert.equal(normalizeAge("27.5"), "27y 6m");
  assert.equal(yearLabel("TO 1845"), "–1845");
  assert.equal(yearLabel("FROM 1839"), "1839–");
  assert.equal(yearLabel("FROM 1839 TO 1845"), "1839/1845");

  const w = new World();
  await w.withTree();
  await w.ok(["person", "add", "Jan /Novák/", "--sex", "M"]);
  const r = await w.run(["person", "add", "Josef /Novák/", "--born", "BET 1820 AND 1784"]);
  assert.equal(r.code, 2);
  assert.match(r.err, /ends before it begins\n→ the earlier date first: "BET 1784 AND 1820"/);
  const dual = await w.run(["person", "add", "Josef /Novák/", "--born", "11 FEB 1731/32"]);
  assert.match(dual.err, /double dates \(1731\/32\)/);
  w.cleanup();
});
