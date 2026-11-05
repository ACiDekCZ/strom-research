// An index proves nothing: a later copy by another hand that only leads to the entry. A fact it alone cites stays a
// lead and cannot be made probable or proven; the entry itself, cited beside it, makes it what it is.

import { test } from "node:test";
import assert from "node:assert/strict";
import { World, hasGit } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import type { Person } from "../../src/core/model.ts";

const opts = { skip: !hasGit };

test("an index as a fact's only evidence: a lead, never probable or proven; the entry beside it makes it probable", opts, async () => {
  const w = new World();
  try {
    await w.withTree();
    await w.ok(["person", "add", "Josef /Lhoták/", "--sex", "M"]); // P0001
    await w.ok(["source", "add", "Index narozených Lhota 1840–1870", "--kind", "index"]); // S0001
    await w.ok(["source", "add", "Křest Josefa Lhotáka 1850", "--kind", "baptism", "--information", "primary"]); // S0002
    await w.ok(["event", "add", "P1", "BIRT", "--date", "1850", "--place", "Lhota", "--cite", "S1"]); // E0001
    const facts = () => Tree.open(w.cwd, w.env).get<Person>("P0001")!.events;
    const fact = (id: string) => facts().find((e) => e.id === id)!;
    assert.equal(fact("E0001").status, "lead");
    for (const status of ["probable", "proven"]) {
      const r = await w.run(["event", "add", "P1", "DEAT", "--date", "1910", "--cite", "S1", "--status", status]);
      assert.equal(r.code, 2, r.err);
      assert.match(r.err, /a family tree, a memory, a compiled work or an index cannot make a fact/u);
      assert.match(r.err, /an index leads to the entry — read the entry itself/u);
    }
    assert.equal(facts().length, 1, "nothing written");
    // the entry itself: probable as before; cited beside the index, the fact is the entry's
    await w.ok(["event", "add", "P1", "CHR", "--date", "1850", "--place", "Lhota", "--cite", "S2"]); // E0002
    assert.equal(fact("E0002").status, "probable");
    await w.ok(["event", "add", "P1", "RESI", "--place", "Lhota", "--cite", "S1", "--cite", "S2", "--status", "proven"]); // E0003
    assert.equal(fact("E0003").status, "proven");
  } finally {
    w.cleanup();
  }
});
