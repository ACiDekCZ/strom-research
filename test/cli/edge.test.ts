// Where the tree ends: above whom it does not go on, why (what the records say so far) and what comes next —
// computed from the research (core/edge.ts), said by `strom edge`, written for the Strom app (_STROM_EDGE).

import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
import { World, hasGit } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import { exportGedcom } from "../../src/gedcom/export.ts";
import { validateGedcom } from "../../src/gedcom/validate.ts";
import { appShowsEdges, APP_SHOWS_EDGES } from "../../src/core/stromapp.ts";
import { Settings } from "../../src/core/config.ts";

const opts = { skip: !hasGit };

/** Jan (P1), his parents Josef (P2) and Marie (P3), Josef's father Václav (P4) born 1790 in Lhota; the births of Lhota from 1784. */
async function world(): Promise<World> {
  const w = new World();
  await w.withTree();
  await w.ok(["research", "new", "Předci Jana", "--new-person", "Jan /Novák/", "--sex", "M"]);
  await w.ok(["person", "add", "Josef /Novák/", "--sex", "M"]);
  await w.ok(["person", "add", "Marie /Dvořáková/", "--sex", "F", "--born", "1770", "--born-place", "Lhota"]);
  await w.ok(["person", "add", "Václav /Novák/", "--sex", "M", "--born", "1790", "--born-place", "Lhota"]);
  await w.ok(["family", "add", "--partner", "P2", "--partner", "P3", "--child", "P1"]);
  await w.ok(["family", "add", "--partner", "P4", "--child", "P2"]);
  await w.ok(["recordset", "add", "Lhota, narození 1784–1830", "--kinds", "baptism", "--places", "Lhota", "--years", "1784-1830", "--access", "online-free"]);
  return w;
}

const edges = async (w: World, ...args: string[]) => {
  const out = (await w.ok(["edge", ...args, "--json"])).json.edges as any[];
  return Object.fromEntries(out.map((e) => [e.person ?? e.edge?.person, e.edge === undefined ? e : e.edge]));
};

test("edge: why the tree ends above each person, and what comes next", opts, async () => {
  const w = await world();
  let e = await edges(w);
  // Václav: both parents unknown, his baptism not searched yet — strom proposes it
  assert.equal(e.P0004.missing, "parents");
  assert.equal(e.P0004.scope, "in");
  assert.equal(e.P0004.generation, 3);
  assert.deepEqual(e.P0004.window, { from: 1787, to: 1793 });
  assert.deepEqual(e.P0004.books.map((b: any) => b.id), ["B0001"]);
  assert.equal(e.P0004.end, "unsearched");
  assert.equal(e.P0004.next, "proposed");
  // Marie: born before the known births of her place begin
  assert.equal(e.P0003.end, "before-records");
  assert.equal(e.P0003.recordsFrom, 1784);
  assert.deepEqual(e.P0003.noRecords, [{ from: 1767, to: 1773 }]);
  // Josef: his father known, the mother not; nothing to go on
  assert.equal(e.P0002.missing, "mother");
  assert.equal(e.P0002.end, "no-clue");
  // Jan: both parents recorded, no record proves them
  assert.equal(e.P0001.missing, "proof");

  // the work on Václav's parents: in the queue, then the years searched in vain
  await w.ok(["task", "add", "Křest Václava", "--level", "link", "--where", "B0001", "--why", "rodiče", "--done-when", "zápis nalezen", "--about", "P4"]);
  e = await edges(w);
  assert.equal(e.P0004.next, "queued");
  assert.equal(e.P0004.tasks[0].id, "T0001");
  assert.ok(e.P0004.tasks[0].position >= 1);
  await w.ok(["search", "add", "Křest Václava Nováka", "--recordset", "B0001", "--years", "1787-1790", "--method", "page-by-page", "--result", "negative", "--task", "T0001"]);
  e = await edges(w);
  assert.equal(e.P0004.end, "partly");
  assert.deepEqual(e.P0004.covered, [{ from: 1787, to: 1790 }]);
  await w.ok(["search", "add", "Křest Václava Nováka", "--recordset", "B0001", "--years", "1791-1793", "--method", "page-by-page", "--result", "negative", "--task", "T0001"]);
  e = await edges(w);
  assert.equal(e.P0004.end, "not-found");
  assert.equal(e.P0004.searches, 2);
  const text = (await w.ok(["edge", "P4"])).out;
  assert.match(text, /Václav Novák .*— the tree ends above: both parents unknown/);
  assert.match(text, /searched in vain everywhere strom knew to look/);
  assert.match(text, /searched in vain: 1787–1793/);

  // the direction paused: its work waits out of the queue
  await w.ok(["research", "pause", "G0001", "--reason", "jindy"]);
  e = await edges(w);
  assert.equal(e.P0004.scope, "paused");
  assert.equal(e.P0004.next, "held");
  assert.equal(e.P0004.tasks[0].held, "paused");
});

test("edge: the hypothesis that would join a family nothing links to the tree — seen from both sides", opts, async () => {
  const w = await world();
  await w.ok(["person", "add", "Matouš /Novák/", "--sex", "M"]); // P5: found in the records, maybe Václav's father
  await w.ok(["person", "add", "Pavel /Novák/", "--sex", "M"]); // P6: Matouš's father
  await w.ok(["family", "add", "--partner", "P6", "--child", "P5"]);
  await w.ok(["task", "add", "Rodiče Pavla", "--level", "locate", "--where", "katalog", "--why", "rodiče", "--done-when", "kniha", "--about", "P6"]); // T1: held
  await w.ok(["hypothesis", "add", "Byl Matouš otcem Václava?", "--about", "P4", "--about", "P5", "--variant", "A: ano", "--variant", "B: ne"]);
  await w.ok(["task", "add", "Křest Václava: otec Matouš?", "--level", "link", "--where", "B0001", "--why", "H0001", "--done-when", "zápis", "--about", "H0001"]); // T2: tests it
  const e = await edges(w, "P4", "P5");
  const h = e.P0004.hypotheses[0];
  assert.equal(h.id, "H0001");
  assert.deepEqual(h.joins, ["P0005"]);
  assert.deepEqual(h.island, { people: 2, held: 1 });
  assert.deepEqual(h.tests, ["T0002"]);
  // from the family off the tree: joined through Václav
  assert.equal(e.P0005.scope, "off-tree");
  assert.deepEqual(e.P0005.hypotheses[0].joins, ["P0004"]);
  assert.equal(e.P0005.hypotheses[0].island, undefined);
  const island = (await w.ok(["edge", "P6", "--json"])).json.edges[0].island;
  assert.deepEqual(island, { people: 2, hypotheses: [{ id: "H0001", joins: ["P0004"] }], held: 1 });
  assert.match((await w.ok(["edge", "P6"])).out, /of a family nothing links to the tree: 2 people, 1 tasks wait for it; would join it: H0001 \(to P0004 Václav Novák/);

  // for the Strom app: the edges and the islands in its GEDCOM, valid
  const tree = Tree.open(w.cwd, w.env);
  const ged = exportGedcom(tree, { for: "strom", research: true, edges: true }).text;
  assert.deepEqual(validateGedcom(ged), []);
  const block = (id: string) => ged.split(/\n(?=0 )/).find((r) => r.startsWith(`0 @${id}@ INDI`))!;
  assert.match(block("P0004"), /\n1 _STROM_EDGE parents\n2 _SCOPE in\n2 _RESEARCH G0001\n2 _GEN 3\n2 _END unsearched\n2 _NEXT queued\n2 _EST 1790\n3 PLAC Lhota\n2 DATE FROM 1787 TO 1793\n2 _BOOK B0001\n3 TITL Lhota, narození 1784–1830\n3 DATE FROM 1784 TO 1830\n3 _ACCESS online-free\n2 _TASK T0002\n3 _LEVEL link\n3 STAT open\n3 TITL Křest Václava: otec Matouš\?\n3 _POS 1\n2 _HYPO H0001\n3 _JOIN P0005\n3 _ISLAND 2\n3 _HELD 1\n3 _TEST T0002\n/);
  assert.match(block("P0004"), /\n1 _STROM_HYPO H0001\n2 TITL Byl Matouš otcem Václava\?/);
  assert.match(block("P0006"), /\n1 _STROM_ISLAND 2\n2 _HYPO H0001\n3 _JOIN P0004\n2 _HELD 1\n/);
  // not for a file of any program, nor for an app that does not show them
  assert.doesNotMatch(exportGedcom(tree, { for: "strom", research: true }).text, /_STROM_EDGE|_STROM_ISLAND/);
  assert.doesNotMatch(exportGedcom(tree, { for: "standard", edges: true }).text, /_STROM_EDGE|_STROM_ISLAND/);
});

test("edge: the Strom app gets them from the version that shows them — its beta and development copies at once", () => {
  const w = new World();
  const at = (url?: string) => new Settings(url ? { ...w.env, STROM_APP_URL: url } : w.env, {});
  assert.equal(appShowsEdges(at("http://127.0.0.1:5173/")), true);
  assert.equal(appShowsEdges(at()), APP_SHOWS_EDGES !== undefined);
  assert.equal(APP_SHOWS_EDGES, "3.6.0");
  assert.equal(appShowsEdges(at(), "3.5.0"), false);
  assert.equal(appShowsEdges(at(), "3.6.0"), true);
  assert.equal(appShowsEdges(at()), true, "an unknown version: today's");
  w.cleanup();
});

const stromRepo = path.resolve(import.meta.dirname, "..", "..", "..", "strom");
const tsx = path.join(stromRepo, "node_modules", ".bin", process.platform === "win32" ? "tsx.cmd" : "tsx");

test("edge: the Strom app's own parser reads the edges and the islands, and drops nothing", { skip: !hasGit || !fs.existsSync(tsx) }, async () => {
  const w = await world();
  await w.ok(["person", "add", "Matouš /Novák/", "--sex", "M"]);
  await w.ok(["person", "add", "Pavel /Novák/", "--sex", "M"]);
  await w.ok(["family", "add", "--partner", "P6", "--child", "P5"]);
  await w.ok(["hypothesis", "add", "Byl Matouš otcem Václava?", "--about", "P4", "--about", "P5", "--variant", "A: ano", "--variant", "B: ne"]);
  await w.ok(["task", "add", "Křest Václava: otec Matouš?", "--level", "link", "--where", "B0001", "--why", "H0001", "--done-when", "zápis", "--about", "H0001"]);
  await w.ok(["search", "add", "Křest Václava", "--recordset", "B0001", "--years", "1787-1790", "--method", "page-by-page", "--result", "negative", "--task", "T0001"]);
  const ged = path.join(w.dir, "edges.ged");
  fs.writeFileSync(ged, exportGedcom(Tree.open(w.cwd, w.env), { for: "strom", research: true, edges: true }).text);
  const script = path.join(w.dir, "read.ts");
  fs.writeFileSync(
    script,
    `import fs from "node:fs";
import { parseGedcom, convertToStrom } from ${JSON.stringify(path.join(stromRepo, "src", "ged-parser.ts"))};
const parsed = parseGedcom(fs.readFileSync(process.argv[2], "utf8"));
const persons = Object.values(convertToStrom(parsed).data.persons) as any[];
const of = (refn: string) => persons.find((p) => p.refn === refn)?.research;
console.log(JSON.stringify({ dropped: [...parsed.droppedTags.entries()], vaclav: of("P0004"), pavel: of("P0006") }));
`,
  );
  const r = spawnSync(tsx, [script, ged], { cwd: stromRepo, encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  const out = JSON.parse(r.stdout.trim().split("\n").pop()!);
  assert.deepEqual(out.dropped, []);
  const e = out.vaclav.edge;
  assert.equal(e.missing, "parents");
  assert.equal(e.scope, "in");
  assert.equal(e.end, "partly");
  assert.equal(e.next, "queued");
  assert.deepEqual(e.window, { from: 1787, to: 1793 });
  assert.deepEqual(e.covered, [{ from: 1787, to: 1790 }]);
  assert.equal(e.books[0].id, "B0001");
  assert.equal(e.tasks[0].id, "T0001");
  assert.equal(e.hypos[0].id, "H0001");
  assert.equal(e.hypos[0].join, "P0005");
  assert.equal(e.hypos[0].island, 2);
  assert.equal(out.pavel.island.size, 2);
  assert.deepEqual(out.pavel.island.hypos, [{ id: "H0001", join: "P0004" }]);
  w.cleanup();
});
