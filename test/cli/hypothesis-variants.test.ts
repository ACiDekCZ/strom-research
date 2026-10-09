// A hypothesis's variant letters: one letter or a number before a colon, never one twice; a claim that begins with a
// name and a colon ("Jan: …") is a claim.

import { test } from "node:test";
import assert from "node:assert/strict";
import { World, hasGit } from "../helpers.ts";

const opts = { skip: !hasGit };

test("hypothesis add: letters never twice, a name before a colon is no letter", opts, async () => {
  const w = new World();
  await w.withTree();
  await w.ok(["person", "add", "Marie /Nováková/", "--sex", "F"]);
  const twice = await w.run(["hypothesis", "add", "Kdo byl otec?", "--about", "P1", "--variant", "A: Josef", "--variant", "A: Jan"]);
  assert.equal(twice.code, 2);
  assert.match(twice.err, /variant A given twice/);
  const h = (await w.ok(["hypothesis", "add", "Kdo byl otec?", "--about", "P1", "--variant", "Jan: syn sedláka z čp. 3", "--variant", "a: Josef z čp. 12", "--json"])).json.hypothesis;
  assert.deepEqual(h.variants.map((v: { label: string; claim: string }) => [v.label, v.claim]), [["B", "Jan: syn sedláka z čp. 3"], ["A", "Josef z čp. 12"]]);
  assert.equal((await w.ok(["hypothesis", "variant", "H1", "Petr: čeledín", "--json"])).json.variant, "C");
  w.cleanup();
});
