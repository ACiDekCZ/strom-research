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
