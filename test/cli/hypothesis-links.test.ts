// What each variant of a hypothesis would connect (strom hypothesis link): whose child, the same person, a couple,
// siblings — kept on the variant, never a link of the tree; written for a Strom app that shows it (_VAR / _LINK under
// _STROM_HYPO, the gate APP_SHOWS_HYPOTHESIS_LINKS), and where the tree ends the parents a variant names (_END named).

import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { World, hasGit } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import { exportGedcom } from "../../src/gedcom/export.ts";
import { validateGedcom } from "../../src/gedcom/validate.ts";
import { appShowsHypothesisLinks, APP_SHOWS_HYPOTHESIS_LINKS } from "../../src/core/stromapp.ts";
import { Settings } from "../../src/core/config.ts";
import { hypothesisPeople } from "../../src/core/directions.ts";
import { BRIDGE_FEATURES } from "../../src/core/live.ts";
import type { Hypothesis } from "../../src/core/model.ts";

const opts = { skip: !hasGit };

/**
 * Ondřej (P1), his father Tomáš (P2) where the tree ends; a couple Řehoř + Ludmila (P3, P4, F2) found in the records,
 * nothing links them; Žofie (P5). Two sources; H1: where Tomáš came from — B says the couple's son, citing S1.
 */
async function world(): Promise<World> {
  const w = new World();
  await w.withTree();
  await w.ok(["research", "new", "Předci Ondřeje", "--new-person", "Ondřej /Kubát/", "--sex", "M"]); // P1
  await w.ok(["person", "add", "Tomáš /Kubát/", "--sex", "M", "--born", "1815", "--born-place", "Horní Ves"]); // P2
  await w.ok(["family", "add", "--partner", "P2", "--child", "P1"]); // F1
  await w.ok(["person", "add", "Řehoř /Šimek/", "--sex", "M"]); // P3
  await w.ok(["person", "add", "Ludmila /Šimková/", "--sex", "F"]); // P4
  await w.ok(["family", "add", "--partner", "P3", "--partner", "P4"]); // F2
  await w.ok(["person", "add", "Žofie /Kubátová/", "--sex", "F"]); // P5
  await w.ok(["source", "add", "Sňatek Tomáše 1840", "--kind", "marriage"]); // S1
  await w.ok(["source", "add", "Křest Žofie 1817", "--kind", "baptism"]); // S2
  await w.ok([
    "hypothesis", "add", "Odkud pocházel Tomáš Kubát?", "--about", "P2",
    "--variant", "A: z Horní Vsi, rodiče neznámí",
    "--variant", "B: syn Řehoře Šimka a Ludmily (sňatek S0001); ne žS0002",
  ]); // H1
  return w;
}

const fails = async (w: World, args: string[], said: RegExp) => {
  const r = await w.run(args);
  assert.notEqual(r.code, 0, `${args.join(" ")} should fail`);
  assert.match(r.err + r.out, said, args.join(" "));
};

const block = (ged: string, id: string) => ged.split(/\n(?=0 )/).find((r) => r.startsWith(`0 @${id}@ INDI`))!;

test("hypothesis link: a variant says what it would connect — checked, kept, shown, taken off; nothing of the tree changes", opts, async () => {
  const w = await world();
  const famBefore = fs.readFileSync(path.join(w.cwd, "data", "families", "F0002.json"), "utf8");

  const r = await w.ok(["hypothesis", "link", "H1", "B", "--child", "P2", "--of", "F2", "--json"]);
  assert.deepEqual(r.json.links, [{ kind: "child", person: "P0002", family: "F0002" }]);
  assert.equal(r.json.variant, "B");
  // the same again, other ways of saying it: refused
  await fails(w, ["hypothesis", "link", "H1", "b", "--child", "P0002", "--of", "F0002"], /has that link already/);
  // the couple is a family: named by it
  await fails(w, ["hypothesis", "link", "H1", "B", "--child", "P2", "--parents", "P3", "P4"], /are a family of the tree: F0002/);
  // what is not there, not a person, twice, not enough, too much at once
  await fails(w, ["hypothesis", "link", "H1", "B", "--child", "P99", "--of", "F2"], /P0099/);
  await fails(w, ["hypothesis", "link", "H1", "B", "--child", "P2", "--of", "F9"], /F0009/);
  await fails(w, ["hypothesis", "link", "H1", "B", "--child", "Žofie", "--of", "F2"], /not a person ID/);
  await fails(w, ["hypothesis", "link", "H1", "B", "--child", "P1", "--of", "F1"], /P0001 is a child of F0001 already/);
  await fails(w, ["hypothesis", "link", "H1", "B", "--child", "P2"], /whose child/);
  await fails(w, ["hypothesis", "link", "H1", "A", "--same", "P3", "P3"], /the same person twice/);
  await fails(w, ["hypothesis", "link", "H1", "A", "--same", "P3"], /takes two people/);
  await fails(w, ["hypothesis", "link", "H1", "A", "--partners", "P3", "P4"], /partners of F0002 already/);
  await fails(w, ["hypothesis", "link", "H1", "A", "--same", "P2", "--siblings", "P5"], /one link at a time/);
  await fails(w, ["hypothesis", "link", "H1", "Z", "--same", "P2", "P5"], /no variant Z in H0001/);
  await fails(w, ["hypothesis", "link", "H1", "A"], /say what the variant would connect/);

  // the second person as an argument, or in one value
  await w.ok(["hypothesis", "link", "H1", "A", "--same", "P2", "P5"]);
  await w.ok(["hypothesis", "link", "H1", "A", "--siblings", "P3,P5"]);
  const shown = await w.ok(["hypothesis", "show", "H1"]);
  assert.match(shown.out, /\nA: z Horní Vsi, rodiče neznámí\n {2}⇢ same P0002 = P0005\n {2}⇢ siblings P0003, P0005\n/);
  assert.match(shown.out, /\n {2}⇢ child P0002 of F0002/);
  const json = (await w.ok(["hypothesis", "show", "H1", "--json"])).json.hypothesis as Hypothesis;
  assert.deepEqual(json.variants.map((v) => v.links), [
    [{ kind: "same", persons: ["P0002", "P0005"] }, { kind: "siblings", persons: ["P0003", "P0005"] }],
    [{ kind: "child", person: "P0002", family: "F0002" }],
  ]);
  // argued further: the links stay
  await w.ok(["hypothesis", "argue", "H1", "B", "--for", "svědek ze Šimkovy rodiny"]);
  assert.equal(Tree.open(w.cwd, w.env).get<Hypothesis>("H0001")!.variants[1]!.links?.length, 1);
  // the tree itself: untouched
  assert.equal(fs.readFileSync(path.join(w.cwd, "data", "families", "F0002.json"), "utf8"), famBefore);
  assert.ok(Tree.open(w.cwd, w.env).readOps().some((o) => o.op === "hypothesis.link" && o.summary === "H0001 B: child P0002 of F0002"));

  // those not said yet
  await w.ok(["hypothesis", "add", "Byla Žofie sestrou Tomáše?", "--about", "P5", "--variant", "A: ano", "--variant", "B: ne"]); // H2
  const unlinked = (await w.ok(["hypothesis", "list", "--unlinked", "--json"])).json.hypotheses as Hypothesis[];
  assert.deepEqual(unlinked.map((h) => h.id), ["H0002"]);
  assert.match((await w.ok(["hypothesis", "list"])).out, /H0001 .* 3 links/);

  // taken off: one (its people in any order), then every one of a variant
  await w.ok(["hypothesis", "link", "H1", "A", "--same", "P5", "P2", "--remove"]);
  await fails(w, ["hypothesis", "link", "H1", "A", "--same", "P5", "P2", "--remove"], /has no link same P0005 = P0002/);
  await w.ok(["hypothesis", "link", "H1", "A", "--remove"]);
  assert.equal("links" in Tree.open(w.cwd, w.env).get<Hypothesis>("H0001")!.variants[0]!, false, "no links: no field");
  await fails(w, ["hypothesis", "link", "H1", "A", "--remove"], /H0001 A has no links/);
  // the letter stays its claim's: the links back as they were, never other people under it
  await fails(w, ["hypothesis", "link", "H1", "A", "--same", "P2", "P4"], /said other people before .*P0004 is a new variant/);
  await w.ok(["hypothesis", "link", "H1", "A", "--same", "P5", "P2"]);
  await fails(w, ["hypothesis", "link", "H1", "B", "--child", "P2", "--parents", "P5"], /H0001 B said other people before .*P0005 is a new variant/);
  await w.ok(["hypothesis", "link", "H1", "B", "--partners", "P2", "P5"], {}); // adding to what it says: fine
  // a new variant: the next letter, never one used before
  assert.equal((await w.ok(["hypothesis", "variant", "H1", "syn Ludmily z prvního manželství", "--json"])).json.variant, "C");
  await fails(w, ["hypothesis", "variant", "H1", "B: znovu"], /has a variant B already/);
  await w.ok(["hypothesis", "link", "H1", "C", "--child", "P2", "--parents", "P4"]);
  // decided: for which variant; links are for an open hypothesis
  await fails(w, ["hypothesis", "decide", "H1", "--decision", "nic", "--abandon", "--variant", "A"], /not with --abandon/);
  await fails(w, ["hypothesis", "decide", "H1", "--decision", "nic", "--variant", "Z"], /no variant Z in H0001/);
  await w.ok(["hypothesis", "decide", "H1", "--variant", "b", "--decision", "zápis sňatku jmenuje rodiče"]);
  assert.equal(Tree.open(w.cwd, w.env).get<Hypothesis>("H0001")!.chosen, "B");
  assert.match((await w.ok(["hypothesis", "show", "H1"])).out, /\ndecision \(for B\) {2}zápis sňatku/);
  await w.ok(["hypothesis", "decide", "H2", "--decision", "B: jiná rodina"]);
  await fails(w, ["hypothesis", "link", "H2", "A", "--siblings", "P2", "P5"], /H0002 is decided/);
  await fails(w, ["hypothesis", "variant", "H2", "jiná"], /H0002 is decided/);
  assert.equal((await w.ok(["check"])).code, 0);
  w.cleanup();
});

test("the Strom file: each variant of an open hypothesis with its claim, links and sources — for an app that shows it; never the standard file", opts, async () => {
  const w = await world();
  await w.ok(["hypothesis", "link", "H1", "B", "--child", "P2", "--of", "F2"]);
  await w.ok(["hypothesis", "link", "H1", "A", "--same", "P2", "P5"]);
  await w.ok(["hypothesis", "argue", "H1", "A", "--for", "křest S0002 v Horní Vsi"]);

  // the people a link names are the hypothesis's: the couple too, though no text names them by ID
  const tree = Tree.open(w.cwd, w.env);
  assert.deepEqual(hypothesisPeople(tree, tree.get<Hypothesis>("H0001")!).sort(), ["P0002", "P0003", "P0004", "P0005"]);

  const ged = exportGedcom(tree, { for: "strom", research: true, edges: true, hypothesisLinks: true }).text;
  assert.deepEqual(validateGedcom(ged), []);
  assert.match(
    block(ged, "P0002"),
    /\n1 _STROM_HYPO H0001\n2 TITL Odkud pocházel Tomáš Kubát\?\n2 STAT open\n2 NOTE A: z Horní Vsi, rodiče neznámí\n3 CONT B: syn Řehoře Šimka a Ludmily \(sňatek S0001\); ne žS0002\n2 _VAR A\n3 TITL z Horní Vsi, rodiče neznámí\n3 _LINK same\n4 _PERS @P0002@\n4 _PERS @P0005@\n3 SOUR @S0002@\n2 _VAR B\n3 TITL syn Řehoře Šimka a Ludmily \(sňatek S0001\); ne žS0002\n3 _LINK child\n4 _PERS @P0002@\n4 _FAM @F0002@\n3 SOUR @S0001@\n1 /,
  );
  assert.doesNotMatch(block(ged, "P0002"), /_VAR B[^]*SOUR @S0002@/, "an ID stuck to a letter names no source");
  for (const id of ["P0003", "P0004", "P0005"]) assert.match(block(ged, id), /\n1 _STROM_HYPO H0001\n/);
  // where the tree ends above Tomáš: the parents a variant names, nobody tests it — the user decides
  assert.match(block(ged, "P0002"), /\n1 _STROM_EDGE parents\n(?:[2-9].*\n)*?2 _END named\n2 _NEXT decide\n/);
  // the joins at the edge and on the families off the tree name the variant that would make them
  assert.match(block(ged, "P0002"), /\n2 _HYPO H0001\n3 _JOIN P0005\n3 _JOIN P0003\n3 _JOIN P0004\n3 _VAR A\n3 _VAR B\n/);
  assert.match(block(ged, "P0003"), /\n1 _STROM_ISLAND 2\n2 _HYPO H0001\n3 _JOIN P0002\n3 _VAR B\n/);
  assert.match(block(ged, "P0005"), /\n1 _STROM_ISLAND 1\n2 _HYPO H0001\n3 _JOIN P0002\n3 _VAR A(\n|$)/);

  // decided for a variant: sent with what it chose while a variant has links; one with none, not at all
  await w.ok(["hypothesis", "add", "Byla Žofie sestrou Tomáše?", "--about", "P5", "--variant", "A: ano", "--variant", "B: ne"]); // H2
  await w.ok(["hypothesis", "decide", "H1", "--variant", "B", "--decision", "zápis sňatku"]);
  await w.ok(["hypothesis", "decide", "H2", "--decision", "nelze rozhodnout", "--abandon"]);
  const decided = exportGedcom(Tree.open(w.cwd, w.env), { for: "strom", research: true, edges: true, hypothesisLinks: true }).text;
  assert.deepEqual(validateGedcom(decided), []);
  assert.match(block(decided, "P0002"), /\n1 _STROM_HYPO H0001\n2 TITL .*\n2 STAT decided\n2 _CHOSEN B\n2 NOTE .*\n3 CONT .*\n2 _VAR A\n(?:[3-9].*\n)*2 _VAR B\n3 TITL .*\n3 _LINK child\n/);
  assert.doesNotMatch(decided, /_STROM_HYPO H0002/);
  assert.doesNotMatch(exportGedcom(Tree.open(w.cwd, w.env), { for: "strom", research: true, edges: true }).text, /_STROM_HYPO/, "an app that does not show it: open ones only, as before");

  // an app that does not show it yet: the hypothesis as before, the edge as before
  const before = exportGedcom(tree, { for: "strom", research: true, edges: true }).text;
  assert.doesNotMatch(before, /_VAR|_LINK|_PERS|_END named/);
  assert.match(block(before, "P0002"), /\n1 _STROM_HYPO H0001\n2 TITL .*\n2 NOTE .*\n3 CONT .*\n1 /);
  // never in the standard file
  assert.doesNotMatch(exportGedcom(tree, { for: "standard", research: true, edges: true, hypothesisLinks: true }).text, /_STROM_HYPO|_VAR|_LINK/);

  // a link to a record not in the file is left out — the variant stays
  const some = exportGedcom(tree, { for: "strom", research: true, hypothesisLinks: true, persons: new Set(["P0001", "P0002", "P0003", "P0004"]) }).text;
  assert.deepEqual(validateGedcom(some), []);
  assert.match(block(some, "P0002"), /\n2 _VAR A\n3 TITL z Horní Vsi, rodiče neznámí\n3 SOUR @S0002@\n2 _VAR B\n3 TITL .*\n3 _LINK child\n/);
  const alone = exportGedcom(tree, { for: "strom", research: true, hypothesisLinks: true, persons: new Set(["P0001", "P0002", "P0005"]) }).text;
  assert.deepEqual(validateGedcom(alone), []);
  assert.match(block(alone, "P0002"), /\n2 _VAR B\n3 TITL .*\n3 SOUR @S0001@\n1 /, "the family not in the file: no link");
  // decided for B and the link recorded: the link it chose stays beside _CHOSEN (the app's ghost becomes the real link)
  await w.ok(["family", "child", "F2", "P2"]);
  const linked = exportGedcom(Tree.open(w.cwd, w.env), { for: "strom", research: true, hypothesisLinks: true }).text;
  assert.match(block(linked, "P0002"), /\n2 _CHOSEN B\n[^]*\n2 _VAR B\n3 TITL .*\n3 _LINK child\n4 _PERS @P0002@\n4 _FAM @F0002@\n/);
  w.cleanup();
});

test("the gate: the beta and the development copy of the app at once; stromapp.info from the version that shows it; the bridge says hypothesis.links", opts, async () => {
  const w = await world();
  await w.ok(["hypothesis", "link", "H1", "B", "--child", "P2", "--of", "F2"]);
  const prod = new Settings({ ...w.env, STROM_APP_URL: "https://stromapp.info/run/" }, {});
  const beta = new Settings({ ...w.env, STROM_APP_URL: "https://beta.stromapp.info/run/" }, {});
  assert.equal(appShowsHypothesisLinks(beta), true, "the beta: at once");
  assert.equal(appShowsHypothesisLinks(beta, "3.10.0"), true);
  assert.equal(appShowsHypothesisLinks(prod, "3.8.2"), false, "an older app: nothing");
  assert.equal(appShowsHypothesisLinks(prod), APP_SHOWS_HYPOTHESIS_LINKS !== undefined, "an app of unknown version: today's, once released");
  assert.equal(appShowsHypothesisLinks(prod, "99.0.0"), APP_SHOWS_HYPOTHESIS_LINKS !== undefined, "none before it is released");
  // through strom export: the beta's file has it, production's not before the release
  const out = path.join(w.dir, "beta.ged");
  await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", out], { env: { STROM_APP_URL: "https://beta.stromapp.info/run/" } });
  assert.match(fs.readFileSync(out, "utf8"), /\n2 _VAR B\n3 TITL .*\n3 _LINK child\n4 _PERS @P0002@\n4 _FAM @F0002@\n/);
  if (APP_SHOWS_HYPOTHESIS_LINKS === undefined) {
    await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", out], { env: { STROM_APP_URL: "https://stromapp.info/run/" } });
    assert.doesNotMatch(fs.readFileSync(out, "utf8"), /_VAR|_END named/);
  }
  assert.ok((BRIDGE_FEATURES as readonly string[]).includes("hypothesis.links"));
  w.cleanup();
});

test("where the tree ends: the parents a variant names — named; the user decides until a task tests it", opts, async () => {
  const w = await world();
  const edge = async () => (await w.ok(["edge", "P2", "--json"])).json.edges[0].edge;
  const was = await edge();
  assert.notEqual(was.end, "named");
  await w.ok(["hypothesis", "link", "H1", "B", "--child", "P2", "--parents", "P5"]);
  let e = await edge();
  assert.equal(e.end, "named");
  assert.equal(e.next, "decide");
  assert.deepEqual(e.hypotheses.map((h: { id: string }) => h.id), ["H0001"]);
  assert.match((await w.ok(["edge", "P2"])).out, /the records: a variant of an open hypothesis names the parents/);
  // a task tests it: what comes next is the task's
  await w.ok(["task", "add", "Křest Tomáše v Horní Vsi", "--level", "locate", "--where", "katalog", "--why", "původ", "--done-when", "zápis", "--about", "H1"]);
  e = await edge();
  assert.equal(e.end, "named");
  assert.equal(e.next, "queued");
  // the link taken off: the edge as it was
  await w.ok(["hypothesis", "link", "H1", "B", "--remove"]);
  assert.notEqual((await edge()).end, "named");
  // back, and the tree links the child to that parent since: nothing uncertain left to show of an open hypothesis
  await w.ok(["hypothesis", "link", "H1", "B", "--child", "P2", "--parents", "P5"]);
  await w.ok(["family", "add", "--partner", "P5", "--child", "P2"]);
  const ged = exportGedcom(Tree.open(w.cwd, w.env), { for: "strom", research: true, edges: true, hypothesisLinks: true }).text;
  assert.match(ged, /\n2 _VAR B\n/);
  assert.doesNotMatch(ged, /_LINK child|_END named/);
  // said as the tree's own now: never as a link not made yet
  assert.match(ged, /\n2 _VAR B\n3 TITL [^\n]*\n3 _INTREE child\n4 _PERS @P0002@\n4 _FAM @F\d+@\n/);
  w.cleanup();
});

test("a Strom file carrying the variants and the edge comes back through strom sync as no change", opts, async () => {
  const w = await world();
  await w.ok(["hypothesis", "link", "H1", "B", "--child", "P2", "--of", "F2"]);
  await w.ok(["hypothesis", "link", "H1", "A", "--siblings", "P2", "P5"]);
  // and one decided for a variant (STAT, _CHOSEN)
  await w.ok(["hypothesis", "add", "Byla Žofie sestrou Tomáše?", "--about", "P5", "--variant", "A: ano", "--variant", "B: ne"]);
  await w.ok(["hypothesis", "link", "H2", "A", "--siblings", "P2", "P5"]);
  await w.ok(["hypothesis", "decide", "H2", "--variant", "A", "--decision", "křty jmenují tytéž rodiče"]);
  const file = path.join(w.dir, "back.ged");
  const text = exportGedcom(Tree.open(w.cwd, w.env), { for: "strom", research: true, edges: true, hypothesisLinks: true }).text;
  assert.match(text, /_LINK siblings/);
  assert.match(text, /\n2 STAT decided\n2 _CHOSEN A\n/);
  fs.writeFileSync(file, text);
  assert.deepEqual((await w.ok(["sync", file, "--json"])).json.changes, []);
  w.cleanup();
});

test("two records of one person merged: the link that said they might be is kept as history, never shown as uncertain", opts, async () => {
  const w = await world();
  await w.ok(["person", "add", "Tomáš /Kubát/", "--sex", "M"]); // P6
  await w.ok(["hypothesis", "link", "H1", "A", "--same", "P2", "P6"]);
  await w.ok(["person", "merge", "P2", "P6", "--reason", "týž křest"]);
  const tree = Tree.open(w.cwd, w.env);
  assert.deepEqual(tree.get<Hypothesis>("H0001")!.variants[0]!.links, [{ kind: "same", persons: ["P0002"] }]);
  const ged = exportGedcom(tree, { for: "strom", research: true, hypothesisLinks: true }).text;
  assert.deepEqual(validateGedcom(ged), []);
  assert.doesNotMatch(ged, /_LINK same/);
  assert.equal((await w.ok(["check"])).code, 0);
  w.cleanup();
});

test("once links say what a hypothesis would connect, a person its claim names only for context is not its person: no _STROM_HYPO, no join", opts, async () => {
  const w = await world();
  // Žofie (P5) named for context only: whom the son married
  await w.ok(["hypothesis", "add", "Byl Tomáš synem Řehoře?", "--about", "P2", "--variant", "A: ne, z Horní Vsi", "--variant", "B: syn Řehoře P0003 a Ludmily P0004, ženatý se Žofií P0005"]); // H2
  let tree = Tree.open(w.cwd, w.env);
  assert.ok(hypothesisPeople(tree, tree.get<Hypothesis>("H0002")!).includes("P0005"), "no links yet: the IDs of the claims count, as before");
  await w.ok(["hypothesis", "link", "H2", "B", "--child", "P2", "--of", "F2"]);
  tree = Tree.open(w.cwd, w.env);
  assert.deepEqual(hypothesisPeople(tree, tree.get<Hypothesis>("H0002")!).sort(), ["P0002", "P0003", "P0004"]);
  const ged = exportGedcom(tree, { for: "strom", research: true, edges: true, hypothesisLinks: true }).text;
  assert.doesNotMatch(block(ged, "P0005"), /_STROM_HYPO H0002|_HYPO H0002/);
  assert.match(block(ged, "P0002"), /\n2 _HYPO H0002\n3 _JOIN P0003\n3 _JOIN P0004\n3 _VAR B\n/);
  const e = (await w.ok(["edge", "P2", "P5", "--json"])).json.edges as { person: string; edge: { hypotheses: { id: string; joins: string[] }[] } | null; island: { hypotheses: { id: string }[] } | null }[];
  assert.deepEqual(e[0]!.edge!.hypotheses.find((h) => h.id === "H0002")!.joins, ["P0003", "P0004"]);
  assert.ok(!e[1]!.island?.hypotheses.some((h) => h.id === "H0002"), "no join through the person of the context");
  w.cleanup();
});
