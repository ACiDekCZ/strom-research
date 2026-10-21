// The entries nobody cites in the export for the Strom app: by default not in the file (the app asks the research for
// them later); with excerpts.for all after the cited ones, where they still fit.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { Tree } from "../../src/core/tree.ts";
import { planExcerpts } from "../../src/core/excerpt.ts";
import type { Source } from "../../src/core/model.ts";
import { opts, world } from "./excerpts.helpers.ts";

test("export with images: an entry nobody cites is not in the file by default; with all it gets its image where it fits, never at the cost of the cited ones; what did not fit is said", opts, async () => {
  const w = await world();
  await w.ok(["research", "new", "Předci Jana", "--new-person", "Jan /Novák/", "--sex", "M"]); // P0001
  await w.ok(["person", "add", "Josef /Novák/", "--sex", "M"]); // P0002 father: ancestor
  await w.ok(["person", "add", "Cizí /Člověk/", "--sex", "M"]); // P0003 linked to nobody
  await w.ok(["family", "add", "--partner", "P0002", "--child", "P0001"]);
  await w.ok(["source", "add", "Křest Josefa", "--clip", "B1:1@0.1,0.1,0.5,0.1"]); // S0001 cited by the father
  await w.ok(["event", "add", "P0002", "CHR", "--cite", "S0001"]);
  await w.ok(["source", "add", "Zápis převzatý", "--clip", "B1:2@0.1,0.1,0.8,0.3"]); // S0002 cited by nobody
  await w.ok(["source", "add", "Zápis cizího", "--clip", "B1:3@0.1,0.1,0.5,0.1"]); // S0003 cited by one linked to nobody
  await w.ok(["event", "add", "P0003", "BIRT", "--cite", "S0003"]);
  const file = path.join(w.cwd, "output", "tree-strom.ged");

  // by default (excerpts.for family): the father's entry alone, though there is room; the stranger's is out of scope,
  // the one nobody cites is not in the file either — said, with the way to all of them
  let r = (await w.ok(["export", "gedcom", "--json"])).json.images;
  assert.deepEqual([r.sources, r.outOfScope, r.uncited, r.uncitedLeft, r.dropped, r.level], [1, 1, 1, [], [], "normal"]);
  let ged = fs.readFileSync(file, "utf8");
  const objeOf = (id: string) => ged.split(`0 @${id}@ SOUR`)[1]!.split("\n0 ")[0]!;
  assert.match(objeOf("S0001"), /1 OBJE\n2 FORM jpg\n2 _STROM_KIND excerpt/, "the cited entry has its image");
  assert.doesNotMatch(objeOf("S0002"), /OBJE/, "nobody cites it: not in the file by default");
  assert.doesNotMatch(objeOf("S0003"), /OBJE/, "out of scope: none");
  assert.match((await w.ok(["export", "gedcom"], { env: { CLAUDECODE: "1" } })).out, /1 source nobody in the research cites, not in the file — all of them: --images-for all/);
  assert.match((await w.ok(["export", "gedcom"])).out, /prameny, které ve výzkumu nikdo necituje, v souboru nejsou: 1 — všechny: --images-for all/);
  // with --images-for all: the one nobody cites as there is room
  r = (await w.ok(["export", "gedcom", "--images-for", "all", "--json"])).json.images;
  assert.deepEqual([r.sources, r.outOfScope, r.uncited, r.uncitedLeft, r.dropped, r.level], [3, 0, 1, [], [], "normal"]);
  ged = fs.readFileSync(file, "utf8");
  assert.match(objeOf("S0002"), /1 OBJE\n2 FORM jpg\n2 _STROM_KIND excerpt/, "with all, the entry nobody cites has its image");
  assert.doesNotMatch((await w.ok(["export", "gedcom", "--images-for", "all"])).out, /v souboru nejsou/);

  const tree = Tree.open(w.cwd, w.env);
  const shared = path.join(w.home, "shared");
  const src = (id: string) => tree.get<Source>(id)!;
  const b64 = (id: string, plan: ReturnType<typeof planExcerpts>) => plan.of(src(id)).reduce((n, e) => n + Math.ceil(e.jpeg.length / 3) * 4, 0);
  const roomy = planExcerpts(tree, shared, { quality: "normal", for: "all", maxBytes: 1e9 });
  const [cited, stranger, nobodys] = [b64("S0001", roomy), b64("S0003", roomy), b64("S0002", roomy)];
  assert.ok(cited > 0 && stranger > 0 && nobodys > 0);
  assert.deepEqual(["S0001", "S0002", "S0003"].map((id) => roomy.left(src(id))), [undefined, undefined, undefined]);

  // by default the entry nobody cites is out of scope, however much room there is: not even made
  let plan = planExcerpts(tree, shared, { quality: "normal", for: "family", maxBytes: 1e9 });
  assert.deepEqual([plan.report.sources, plan.report.uncited, plan.report.uncitedLeft], [1, 1, []]);
  assert.deepEqual(["S0001", "S0002", "S0003"].map((id) => plan.left(src(id))), [undefined, "scope", "scope"]);
  // all, room for the cited ones alone: they keep their quality, the entry nobody cites goes (and says why)
  plan = planExcerpts(tree, shared, { quality: "normal", for: "all", maxBytes: cited + stranger + nobodys - 1 });
  assert.equal(b64("S0001", plan), cited, "the cited one never made smaller for it");
  assert.deepEqual([plan.report.level, plan.report.dropped, plan.report.uncitedLeft, plan.report.outOfScope], ["normal", [], ["S0002"], 0]);
  assert.deepEqual(["S0001", "S0002", "S0003"].map((id) => plan.left(src(id))), [undefined, "limit", undefined]);
  // the cited ones over the limit: smaller as before, and the one nobody cites only in what room is left at that quality
  plan = planExcerpts(tree, shared, { quality: "normal", for: "all", maxBytes: Math.floor(cited / 2) });
  assert.equal(plan.report.level === "normal", false);
  assert.ok(plan.report.bytes <= Math.floor(cited / 2));
  // line, connected: the entry nobody cites the same way as family (no person of the research measures it)
  for (const scope of ["line", "connected"] as const) assert.equal(planExcerpts(tree, shared, { quality: "normal", for: scope, maxBytes: 1e9 }).left(src("S0002")), "scope", scope);
  // no time now: the next export makes it
  fs.rmSync(path.join(w.cwd, ".strom", "excerpts"), { recursive: true });
  plan = planExcerpts(tree, shared, { quality: "normal", for: "all", maxBytes: 1e9, budgetMs: -1 });
  assert.deepEqual([plan.report.later, plan.left(src("S0002"))], [["S0001", "S0003", "S0002"], "later"]);

  // said in the terminal: to an agent in English, to a person in the research's language
  const mb = String((cited + stranger + nobodys - 1) / 1024 / 1024);
  const all = ["export", "gedcom", "--images-for", "all", "--images-max-mb", mb];
  r = (await w.ok([...all, "--json"])).json.images;
  assert.deepEqual([r.level, r.dropped, r.uncitedLeft], ["normal", [], ["S0002"]]);
  assert.match((await w.ok(all, { env: { CLAUDECODE: "1" } })).out, /WARNING no room left under the limit of [\d.]+ MB beside the cited sources: 1 source nobody in the research cites without an image \(S0002\)/);
  assert.match((await w.ok(all)).out, /POZOR: vedle citovaných pramenů už pod limitem [\d,]+ MB nezbylo místo: 1 pramen, který ve výzkumu nikdo necituje, je bez obrázku \(S0002\)/);
  assert.doesNotMatch((await w.ok(all)).out, /POZOR: zmenšeno/, "the cited ones keep the quality asked for");

  // a setting saved before keeps its meaning: none without images, all with every source
  await w.ok(["config", "set", "excerpts.for", "none", "--for-tree"]);
  await w.ok(["export", "gedcom"]);
  assert.doesNotMatch(fs.readFileSync(file, "utf8"), /OBJE/);
  await w.ok(["config", "set", "excerpts.for", "all", "--for-tree"]);
  r = (await w.ok(["export", "gedcom", "--json"])).json.images;
  assert.deepEqual([r.sources, r.outOfScope, r.uncitedLeft], [3, 0, []]);
  w.cleanup();
});
