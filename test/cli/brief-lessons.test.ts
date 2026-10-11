// A lesson learned about a place reaches the brief of a task in that place's books; the method lessons are pointed to.

import { test } from "node:test";
import assert from "node:assert/strict";
import { World, hasGit } from "../helpers.ts";

const opts = { skip: !hasGit };

test("brief: a lesson on a place goes with its books; method lessons are pointed to", opts, async () => {
  const w = new World();
  await w.withTree();
  await w.ok(["research", "new", "Předci", "--new-person", "Jan /Novák/", "--sex", "M", "--born", "1905"]);
  await w.ok(["place", "add", "Lhota", "--kind", "village", "--unlocated", "test"]); // L1
  await w.ok(["place", "add", "Ves", "--kind", "village", "--unlocated", "test"]); // L2
  await w.ok(["recordset", "add", "Lhota N 1900-1910", "--places", "Lhota", "--years", "1900-1910", "--access", "online-free"]); // B1
  await w.ok(["lesson", "add", "V Lhotě se křtilo v neděli po narození", "--on", "L1"]);
  await w.ok(["lesson", "add", "Ve Vsi psal farář jména česky", "--on", "L2"]);
  await w.ok(["lesson", "add", "Rejstřík napřed, pak strany", "--scope", "method"]);
  await w.ok(["task", "add", "Křest Jana", "--level", "link", "--where", "B1", "--why", "a", "--done-when", "b", "--about", "P1", "--priority", "5"]);
  const brief = (await w.ok(["brief", "T1"])).out;
  assert.match(brief, /\(L0001\): V Lhotě se křtilo/);
  assert.doesNotMatch(brief, /Ve Vsi psal/);
  assert.match(brief, /method lessons of this research: 1 — strom lesson list --scope method/);
  assert.match((await w.ok(["lesson", "list", "--scope", "method"])).out, /Rejstřík napřed/);
  w.cleanup();
});

// Found live: the brief of a verify task carried up to 24 000 characters of "Already known", a median of 54 lessons.
test("brief of a verify task: the lessons of its book, archive, places and people whole, other books' and archives' out, the general ones within a budget — the rest counted", opts, async () => {
  const w = new World();
  await w.withTree();
  await w.ok(["research", "new", "Předci", "--new-person", "Jan /Novák/", "--sex", "M", "--born", "1850"]);
  await w.ok(["place", "add", "Lhota", "--kind", "village", "--unlocated", "test"]); // L1
  await w.ok(["repo", "add", "Archiv Alfa", "--url", "https://alfa.example.org"]); // R1
  await w.ok(["repo", "add", "Archiv Gama", "--url", "https://gama.example.org"]); // R2
  await w.ok(["recordset", "add", "Lhota 03, N 1840-1860", "--repo", "R1", "--places", "Lhota", "--years", "1840-1860", "--access", "online-free"]); // B1
  await w.ok(["recordset", "add", "Hora 07, N 1780-1820", "--repo", "R2", "--places", "Hora", "--years", "1780-1820", "--access", "online-free"]); // B2
  await w.ok(["lesson", "add", "Folio = 2 × snímek + 1", "--on", "B1"]); // K1
  await w.ok(["lesson", "add", "Portál dává plný sken až po náhledu", "--on", "R1"]); // K2
  await w.ok(["lesson", "add", "V Lhotě se křtilo v neděli", "--on", "L1"]); // K3
  await w.ok(["lesson", "add", "In B0001 the index lists the godparents"]); // K4: the task's book, by its ID
  await w.ok(["lesson", "add", "The portal of Archiv Alfa needs the old parish name"]); // K5: the task's archive, by its name
  await w.ok(["lesson", "add", "Novákovi psali jméno i Nowak"]); // K6: the task's family
  await w.ok(["lesson", "add", "In B0002 the index lists the godparents"]); // K7: another book
  await w.ok(["lesson", "add", "The search of Archiv Gama wants the old name of the parish"]); // K8: another archive
  await w.ok(["lesson", "add", "Hora 07 has its pages bound out of order"]); // K9: another book, by its title
  const general = Array.from({ length: 30 }, (_, i) => `Pravidlo ${i + 1}: poznámka na okraji jinou rukou je zápis sám pro sebe, s vlastním datem`);
  for (const g of general) await w.ok(["lesson", "add", g]); // K10–K39
  await w.ok(["task", "add", "Ověřit křest Jana", "--level", "verify", "--where", "B1", "--why", "a", "--done-when", "b", "--about", "P1"]); // T1
  await w.ok(["task", "add", "Křest Jana", "--level", "link", "--where", "B1", "--why", "a", "--done-when", "b", "--about", "P1"]); // T2
  const known = async (t: string) => {
    const out = (await w.ok(["brief", t])).out;
    return out.slice(out.indexOf("## Already known"), out.indexOf("\n\n", out.indexOf("## Already known")));
  };
  const verify = await known("T1");
  // never a lesson of the very book, archive, place or family it reads
  for (const k of ["K0001 (B0001)", "K0002 (R0001)", "K0003 (L0001)", "K0004:", "K0005:", "K0006:"]) assert.ok(verify.includes(k), k);
  // other books and archives: out, counted
  for (const k of ["K0007", "K0008", "K0009"]) assert.ok(!verify.includes(k), k);
  assert.match(verify, /lessons about other families, places, books and archives: 3 — strom lesson list --scope project/);
  // the general ones: the newest within the budget, the rest one line
  assert.ok(verify.includes("K0039:"), "the newest general one");
  assert.ok(!verify.includes("K0010:"), "the oldest general one counted");
  const shown = (verify.match(/^ {2}K00(1\d|2\d|3\d):/gmu) ?? []).length;
  assert.ok(shown > 3 && shown < 30, `${shown} general lessons`);
  assert.match(verify, new RegExp(`\\n${30 - shown} more general lessons: strom lesson list --scope project\\n`));
  assert.ok(verify.length < 3500, `${verify.length} characters`);
  // a link task: every general lesson, other books' and archives' out all the same
  const link = await known("T2");
  assert.ok(link.includes("K0010:") && link.includes("K0039:"));
  assert.ok(!link.includes("K0007") && !link.includes("K0008"));
  assert.doesNotMatch(link, /more general lessons/);
  w.cleanup();
});
