// A text an agent's tool keeps in a file outside the research — Claude Code past ~30 kB — the agent may not read
// (21 November 2026: strom readings --match at 115 kB, strom searched at 33 kB, each read again in 2–4 turns): the text
// within ~20 kB, its last line how many lines were left out, how to narrow it and --full for all; --json never cut.
// Made-up names only (Lhoták, Lhota); any script, any accent.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";
import { TEXT_BUDGET, narrowLine, withinBudget } from "../../src/cli/format.ts";

const opts = { skip: !hasGit };

test("within the budget: whole lines, the first always, how many left out; the narrowing line with its filters and all", () => {
  const rows = Array.from({ length: 10 }, (_, i) => `${i} ${"ž".repeat(40)}`); // 83 bytes each with its newline
  assert.deepEqual(withinBudget(rows, 250), { kept: rows.slice(0, 3), left: 7 });
  assert.deepEqual(withinBudget(rows, Infinity), { kept: rows, left: 0 });
  assert.deepEqual(withinBudget(["x".repeat(500)], 10), { kept: ["x".repeat(500)], left: 0 }, "the first line always");
  assert.equal(TEXT_BUDGET, 20_000);
  assert.equal(narrowLine("40 searches", "strom searched Lhoták", ["--years <from-to>", false, undefined], "--full"), "40 searches — narrow: strom searched Lhoták --years <from-to>, or all: strom searched Lhoták --full");
  assert.equal(narrowLine("3 record sets", "strom recordset list", []), undefined);
});

/** A reader's report of `n` images of B0001, each found, about 300 bytes a block. */
function bigReport(w: World, n: number): void {
  const dir = path.join(w.cwd, "notes", "readings");
  fs.mkdirSync(dir, { recursive: true });
  const blocks = Array.from({ length: n }, (_, i) =>
    [
      `## Image ${i + 1}`,
      "result: found",
      `entries: levá strana, ${(i % 9) + 1}. zápis shora: ${(i % 28) + 1}. März 1849 · Lhota N° ${i + 1} · Joannes Lhoták, Inwohner · Иван Лхотак · hinterl. Wittwe Maria geb. Lhotková, Häusler in Lhota`,
      "certainty: Lhoták 90 %",
      `pages: ${2 * i + 1}–${2 * i + 2}`,
      "",
    ].join("\n"),
  );
  fs.writeFileSync(path.join(dir, `2026-02-01-B0001-1-${n}-1.md`), `# Reading B0001-1-${n}\nQuestion: Každý zápis Lhoták v letech 1840–1860\n\n${blocks.join("\n")}`);
}

test("strom readings: a long text cut at ~20 kB, its last lines say how much was left out, how to narrow it, --full for all; --json whole", opts, async () => {
  const w = new World();
  try {
    await w.withTree();
    await w.ok(["recordset", "add", "Matrika Lhota 1840–1860"]); // B0001
    bigReport(w, 300);
    const r = await w.ok(["readings", "B0001"]);
    assert.ok(Buffer.byteLength(r.out) < TEXT_BUDGET + 1000, `${Buffer.byteLength(r.out)} B`);
    assert.match(r.out, /^\+\d+ more lines — narrow: strom readings B0001 --images <from-to> --image <n> --match <words>, or all: strom readings B0001 --full$/m);
    assert.match(r.out, /^one image's whole block: strom readings B0001 --image <n>$/m, "its own last line stays");
    assert.doesNotMatch(r.out, /Lhota N° 300 /);
    const full = await w.ok(["readings", "B0001", "--full"]);
    assert.match(full.out, /Lhota N° 300 /);
    assert.doesNotMatch(full.out, /more lines — narrow/);
    const j = await w.ok(["readings", "B0001", "--json"]);
    assert.equal(j.json.readings[0].found.length, 300, "--json never cut");
    // the words looked for go along into the line (N1009: --match of a surname)
    const m = await w.ok(["readings", "--match", "Lhoták"]);
    assert.match(m.out, /^\+\d+ more lines — narrow: strom readings --match Lhoták <B…> --images <from-to> --image <n> --match <words>, or all: strom readings --match Lhoták --full$/m);
    // a few images word for word: the same budget
    const some = await w.ok(["readings", "B0001", "--image", "1-200"]);
    assert.ok(Buffer.byteLength(some.out) < TEXT_BUDGET + 1000, `${Buffer.byteLength(some.out)} B`);
    assert.match(some.out, /more lines — narrow: strom readings B0001 --image 1-200 --match <words>, or all: strom readings B0001 --image 1-200 --full$/m);
    // short: as before
    const short = await w.ok(["readings", "B0001", "--images", "1-5"]);
    assert.doesNotMatch(short.out, /more lines/);
  } finally {
    w.cleanup();
  }
});

test("strom searched: a page (--limit, --page), the filters said first, --full for all; --json all of them", opts, async () => {
  const w = new World();
  try {
    await w.withTree();
    await w.ok(["recordset", "add", "Matrika Lhota 1700–1900"]); // B0001
    await w.ok(["batch", ...Array.from({ length: 130 }, (_, i) => `search add "Křty Lhoták ${1700 + i}" --recordset B0001 --years ${1700 + i}-${1701 + i} --surname Lhoták --method index --result inconclusive`)]);
    const r = await w.ok(["searched", "Lhoták"]);
    const out = r.out.trim().split("\n");
    assert.match(out[0]!, /^130 searches for Lhoták/);
    assert.equal(out[1], "130 searches — narrow: strom searched Lhoták --years <from-to> --surname <name> --task <T…>, or all: strom searched Lhoták --full");
    assert.equal(out.at(-1), "… 80 more: strom searched Lhoták --page 2");
    assert.equal(out.length, 2 + 50 + 1);
    assert.match((await w.ok(["searched", "Lhoták", "--page", "3"])).out, /Lhoták 18\d\d/);
    const full = (await w.ok(["searched", "Lhoták", "--full"])).out.trim().split("\n");
    assert.equal(full.length, 1 + 130);
    assert.equal((await w.ok(["searched", "Lhoták", "--json"])).json.searches.length, 130);
    // a filter given goes along and is not offered again
    const y = (await w.ok(["searched", "Lhoták", "--years", "1700-1780"])).out.trim().split("\n");
    assert.equal(y[1], "81 searches — narrow: strom searched Lhoták --years 1700-1780 --surname <name> --task <T…>, or all: strom searched Lhoták --years 1700-1780 --full");
    // short: no line of filters
    assert.doesNotMatch((await w.ok(["searched", "Lhoták", "--years", "1700-1710"])).out, /narrow:/);
  } finally {
    w.cleanup();
  }
});
