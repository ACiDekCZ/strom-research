// A long listing an agent's tool keeps in a file, showing only its first 2 kB (N0280, N0281: recordset list of 35 kB,
// its filters at the end never seen, then the saved file searched with grep and read whole): a page at most, under
// ~20 kB; the filters on top of a long one; grep of a file outside the research says to filter the listing itself.

import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";
import { LIST_PAGE_MAX } from "../../src/cli/format.ts";

const opts = { skip: !hasGit };

test("recordset list: the filters first when long, a page of at most 100 rows under 20 kB whatever --limit says, the rest a --page away with the filters", opts, async () => {
  const w = new World();
  try {
    await w.withTree();
    const title = (i: number) => `Matrika Dolní Ves a Horní Ves, narození, oddaní a zemřelí, svazek ${i} — Метрическая книга`;
    await w.ok(["batch", ...Array.from({ length: 130 }, (_, i) => `recordset add "${title(i + 1)}" --places "Dolní Ves" --years ${1700 + i}-${1710 + i} --kinds baptism`)]);
    const all = await w.ok(["recordset", "list", "--limit", "500"]);
    const out = all.out.trim().split("\n");
    assert.equal(out[0], "130 record sets — narrow: strom recordset list <text> --place <name> --kind <kind> --years <from-to> --repo <R…>");
    assert.equal(LIST_PAGE_MAX, 100);
    assert.equal(out.length, 1 + 100 + 1);
    assert.equal(out.at(-1), "… 30 more: strom recordset list --page 2");
    assert.ok(Buffer.byteLength(all.out) < 20_000, `${Buffer.byteLength(all.out)} B`);
    // by default a page of 50, the filters used carried to the next page
    const ves = (await w.ok(["recordset", "list", "Dolní", "--place", "dolni ves"])).out.trim().split("\n");
    assert.equal(ves[0], "130 record sets — narrow: strom recordset list --kind <kind> --years <from-to> --repo <R…>");
    assert.equal(ves.at(-1), "… 80 more: strom recordset list Dolní --place \"dolni ves\" --page 2");
    assert.equal((await w.ok(["recordset", "list", "--page", "3", "--json"])).json.recordsets.length, 30);
    // short: no line of filters
    assert.doesNotMatch((await w.ok(["recordset", "list", "--years", "1700"])).out, /narrow:/);
  } finally {
    w.cleanup();
  }
});

test("task list: a page of at most 100 rows whatever --limit says", opts, async () => {
  const w = new World();
  try {
    await w.withTree();
    await w.ok(["research", "new", "Předci", "--new-person", "Jan /Novák/", "--sex", "M"]);
    await w.ok(["batch", ...Array.from({ length: 120 }, (_, i) => `task add "Křest č. ${i + 1} — hledat v matrice Dolní Ves" --level locate --where \"katalog archivu Dolní Ves ${i + 1}\" --why x --done-when y --about P1 --anyway`)]);
    const r = await w.ok(["task", "list", "--state", "all", "--limit", "1000", "--json"]);
    assert.equal(r.json.tasks.length, 100);
    assert.equal(r.json.total, 120);
  } finally {
    w.cleanup();
  }
});

test("grep --in a file outside the research — a listing an agent's tool saved: strom's own filters, never a search through it", opts, async () => {
  const w = new World();
  try {
    await w.withTree();
    const saved = path.join(w.dir, "tool-results", "b4n6jnyf4.txt");
    const r = await w.run(["grep", "Křešín", "--in", saved]);
    assert.equal(r.code, 2);
    assert.match(r.err, /--in .*b4n6jnyf4\.txt: a file outside the research — a saved listing of strom: run it again with its own filter/);
    assert.match(r.err, /→ strom recordset list Křešín \| --place <name> \| --years <from-to> \| --repo <R…> · strom task list --about <who> · strom find Křešín/);
    // a path inside the research's folders: as before
    assert.equal((await w.run(["grep", "x", "--in", "notes"])).code, 0);
  } finally {
    w.cleanup();
  }
});
