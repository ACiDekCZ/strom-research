// strom conflict list --about: only the conflicts about one person, hypothesis or source — a person's own facts and
// families count, a source where a claim cites it; resolved ones only with --all; --json says what it was about.

import { test } from "node:test";
import assert from "node:assert/strict";
import { World, hasGit } from "../helpers.ts";

const opts = { skip: !hasGit };

test("strom conflict list --about P…|H…|S… lists only the conflicts about it", opts, async () => {
  const w = new World();
  await w.withTree();
  await w.ok(["person", "add", "Jan /Novák/", "--sex", "M"]); // P0001
  await w.ok(["person", "add", "Josef /Dvořák/", "--sex", "M"]); // P0002
  await w.ok(["person", "add", "Анна /Петрова/", "--sex", "F"]); // P0003
  await w.ok(["family", "add", "--partner", "P0002", "--partner", "P0003"]); // F0001
  for (const t of ["Křest Jana 1885", "Sňatek 1910", "Úmrtí 1950"]) await w.ok(["source", "add", t, "--kind", "other"]); // S0001–S0003
  await w.ok(["person", "add", "Karel /Novák/", "--sex", "M"]); // P0004
  await w.ok(["person", "add", "Václav /Svoboda/", "--sex", "M"]); // P0005
  // about Jan; its variant A would make Karel his brother
  await w.ok(["hypothesis", "add", "Čí syn byl Jan?", "--about", "P0001", "--variant", "A: bratr Karla", "--variant", "B: jinde"]); // H0001
  await w.ok(["hypothesis", "link", "H0001", "A", "--siblings", "P0001", "P0004"]);
  await w.ok(["conflict", "add", "Rok narození Jana", "--about", "P0001", "--claim", "S0001: 1885", "--claim", "S0002: 1886"]); // X0001
  await w.ok(["conflict", "add", "Rok úmrtí Josefa", "--about", "P0002", "--claim", "S0002: 1950", "--claim", "S0003: 1951"]); // X0002
  await w.ok(["conflict", "add", "Rok narození Karla", "--about", "P0004", "--claim", "1880", "--claim", "1881"]); // X0003
  await w.ok(["conflict", "add", "Datum sňatku", "--about", "F0001", "--claim", "S0002: 1910", "--claim", "1911"]); // X0004
  await w.ok(["conflict", "add", "Povolání Václava", "--about", "P0005", "--claim", "rolník", "--claim", "mlynář"]); // X0005
  const ids = async (...about: string[]) => ((await w.ok(["conflict", "list", ...about, "--json"])).json.conflicts as { id: string }[]).map((c) => c.id);
  assert.deepEqual(await ids(), ["X0001", "X0002", "X0003", "X0004", "X0005"]);
  assert.deepEqual(await ids("--about", "P0001"), ["X0001"]);
  // a person's family counts: the marriage of Josef and Anna
  assert.deepEqual(await ids("--about", "P0002"), ["X0002", "X0004"]);
  assert.deepEqual(await ids("--about", "P0003"), ["X0004"]);
  // a hypothesis: the conflicts about its people and those its variants would connect
  assert.deepEqual(await ids("--about", "H0001"), ["X0001", "X0003"]);
  assert.deepEqual(await ids("--about", "S0002"), ["X0001", "X0002", "X0004"]);
  assert.deepEqual(await ids("--about", "S0003"), ["X0002"]);
  // a person by name, in any script
  assert.deepEqual(await ids("--about", "Анна Петрова"), ["X0004"]);
  // --json says what it was about
  assert.equal((await w.ok(["conflict", "list", "--about", "p1", "--json"])).json.about, "P0001");
  // resolved: only with --all (a hypothesis too)
  await w.ok(["conflict", "resolve", "X0001", "--resolution", "1885", "--reasoning", "the baptism is primary"]);
  assert.deepEqual(await ids("--about", "P0001"), []);
  assert.deepEqual(await ids("--about", "P0001", "--all"), ["X0001"]);
  assert.deepEqual(await ids("--about", "H0001"), ["X0003"]);
  // the text: the rows about it, nothing else
  const text = await w.ok(["conflict", "list", "--about", "S0003"]);
  assert.match(text.out, /X0002/);
  assert.doesNotMatch(text.out, /X0001|X0003|X0004|X0005/);
  // a record that is not there: said
  const none = await w.run(["conflict", "list", "--about", "P0099"]);
  assert.notEqual(none.code, 0);
  assert.match(none.err, /no record P0099/);
  w.cleanup();
});
