// strom run --lang (Windows test K036 P2): the run's progress and its end in the language asked for this run, not the
// tree's own; the tree keeps its language. A scripted agent only. Made-up names only (Lhoták, Lhota).

import { test } from "node:test";
import assert from "node:assert/strict";
import { World, hasGit } from "../helpers.ts";

test("strom run --lang en in a research in Czech: its progress and its end said in English; without it in Czech", { skip: !hasGit, timeout: 120_000 }, async () => {
  const w = new World();
  try {
    await w.withTree("Lhotákovi");
    await w.ok(["lang", "cs"]);
    await w.ok(["research", "new", "Předci Jana", "--new-person", "Jan /Lhoták/", "--sex", "M"]);
    const en = await w.run(["run", "--agent", "script", "--lang", "en"]);
    assert.match(en.out + en.err, /no open tasks/, en.out + en.err);
    assert.doesNotMatch(en.out + en.err, /žádné otevřené úkoly/u);
    const cs = await w.run(["run", "--agent", "script"]);
    assert.match(cs.out + cs.err, /žádné otevřené úkoly/u, cs.out + cs.err);
  } finally {
    w.cleanup();
  }
});
