// A variant that says what the tree records already (the parents as the tree has them) has no link to make: strom
// hypothesis link refuses it ("nothing uncertain to show"). strom says so of it — strom hypothesis show, the brief, the
// hint after the variant is written, the Strom file's 3 _INTREE — gives it to no agent as a link to make (the
// once-per-research backfill, hypothesis list --unlinked), and never decides the hypothesis for anyone.

import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { World, hasGit } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import { exportGedcom } from "../../src/gedcom/export.ts";
import { validateGedcom } from "../../src/gedcom/validate.ts";
import { HYPOTHESIS_LINKS_ORIGIN, recordedLinks, settleHypothesisLinks } from "../../src/core/hypolinks.ts";
import { BRIDGE_FEATURES } from "../../src/core/live.ts";
import type { Hypothesis, Task } from "../../src/core/model.ts";

const opts = { skip: !hasGit };

/** Ondřej (P1), the child of Tomáš and Marie (P2, P3, F1); a couple Řehoř + Ludmila (P4, P5, F2) nothing links. */
async function world(): Promise<World> {
  const w = new World();
  await w.withTree();
  await w.ok(["research", "new", "Předci Ondřeje", "--new-person", "Ondřej /Kubát/", "--sex", "M", "--born", "1840"]); // P1
  await w.ok(["person", "add", "Tomáš /Kubát/", "--sex", "M", "--born", "1810"]); // P2
  await w.ok(["person", "add", "Marie /Kubátová/", "--sex", "F", "--born", "1815"]); // P3
  await w.ok(["family", "add", "--partner", "P2", "--partner", "P3", "--child", "P1"]); // F1
  await w.ok(["person", "add", "Řehoř /Šimek/", "--sex", "M", "--born", "1805"]); // P4
  await w.ok(["person", "add", "Ludmila /Šimková/", "--sex", "F", "--born", "1808"]); // P5
  await w.ok(["family", "add", "--partner", "P4", "--partner", "P5"]); // F2
  await w.ok(["source", "add", "Křest Ondřeje 1840", "--kind", "baptism"]); // S1
  return w;
}

const hypo = (w: World, question: string, ...variants: string[]) => w.ok(["hypothesis", "add", question, "--about", "P1", ...variants.flatMap((v) => ["--variant", v])]);
const tree = (w: World) => Tree.open(w.cwd, w.env);
const get = (w: World, id: string) => tree(w).get<Hypothesis>(id)!;
const recorded = (w: World, id: string, label: string) => {
  const t = tree(w);
  const h = t.get<Hypothesis>(id)!;
  return recordedLinks(t, h, h.variants.find((v) => v.label === label)!);
};
const OURS = [{ kind: "child", person: "P0001", family: "F0001" }];

/** Claims that only look like the tree's link: none of them is said to be recorded. [question, claim of B] */
const NOT_RECORDED: [string, string][] = [
  ["Čí manželka?", "B: manželka některého Tomáše — snad Marie P0003, žena Tomáše P0002"],
  ["Byl Ondřej bratrem Řehoře?", "B: ano, syn P0002 a P0003"],
  ["Rodina?", "B: ne syn P0002 a P0003 z rodiny F0001"],
  ["Jiný otec?", "B: syn P0004 a P0003 (F0001)"],
  ["Otazník", "B: syn P0002 a P0003?"],
  ["Nevlastní", "B: nevlastní syn P0002 a P0003"],
  ["Jen jeden", "B: syn P0002"],
];

test("a variant saying the tree's own link: marked as recorded in show, the brief and the hint; refused as a link with no advice to decide; no agent task for it", opts, async () => {
  const w = await world();
  // the tree's state in its words (decomposed input), naming the family — and B, nobody of the tree
  const add = await hypo(w, "Byl otcem Ondřeje Tomáš (P0002), nebo jeho stejnojmenný syn?", "A: Tomáš P0002 a Marie P0003, jak vede strom (rodina F0001, S0001)".normalize("NFD"), "B: nezjištěný syn téhož jména"); // H1
  assert.match(add.out, /A: the tree records this already: child P0001 of F0001/);
  // a non-Latin script: the family by its ID; B a couple of the tree the agent may link
  await hypo(w, "Чей сын Ондржей?", "A: как в дереве, семья F0001", "B: сын Řehoře P0004 и Ludmily P0005"); // H2
  let n = 3;
  for (const [q, claim] of NOT_RECORDED) {
    await hypo(w, q, "A: nic", claim);
    n++;
  }

  assert.deepEqual(recorded(w, "H0001", "A"), OURS);
  assert.deepEqual(recorded(w, "H0001", "B"), []);
  assert.deepEqual(recorded(w, "H0002", "A"), OURS);
  assert.deepEqual(recorded(w, "H0002", "B"), []);
  for (let i = 3; i < n; i++) assert.deepEqual(recorded(w, `H${String(i).padStart(4, "0")}`, "B"), [], get(w, `H${String(i).padStart(4, "0")}`).question);

  // strom hypothesis show: the variant marked, in --json too
  const show = await w.ok(["hypothesis", "show", "H1"]);
  assert.match(show.out, /\nA: Tomáš P0002 a Marie P0003, jak vede strom \(rodina F0001, S0001\)\n {2}= the tree records this already: child P0001 of F0001 — no link to make; open until the records decide it/);
  assert.deepEqual((await w.ok(["hypothesis", "show", "H1", "--json"])).json.recorded, { A: OURS });
  assert.equal((await w.ok(["hypothesis", "show", "H3", "--json"])).json.recorded, undefined);

  // the link refused, said what it is — never "decide the hypothesis" as if the tree's state decided it
  for (const args of [["--child", "P1", "--of", "F1"], ["--child", "P1", "--parents", "P2", "P3"]]) {
    const r = await w.run(["hypothesis", "link", "H1", "A", ...args]);
    assert.notEqual(r.code, 0);
    assert.match(r.err, /P0001 is a child of F0001 already: nothing uncertain to show/);
    assert.match(r.err, /the tree records this already: the variant gets no link/);
    assert.doesNotMatch(r.err, /hypothesis decide/);
  }
  assert.equal(get(w, "H0001").state, "open");

  // the backfill: H1 is no work for the agent (A recorded, B names nobody); H2 is (its B), so are the look-alikes
  const done = settleHypothesisLinks(tree(w))!;
  assert.ok(done);
  const tasks = tree(w).list<Task>("task").filter((t) => t.origin === HYPOTHESIS_LINKS_ORIGIN);
  const subjects = tasks.flatMap((t) => t.subject);
  assert.ok(!subjects.includes("H0001"), "the variant the tree records is no link to make");
  assert.ok(subjects.includes("H0002"));
  for (let i = 3; i < n; i++) assert.ok(subjects.includes(`H${String(i).padStart(4, "0")}`), `H${i} ${JSON.stringify(subjects)} ${JSON.stringify(done.linked)}`);
  assert.equal(get(w, "H0001").state, "open", "never decided by strom");
  assert.equal(get(w, "H0001").variants[0]!.links, undefined);

  // the brief of that task says it of H2's A, so the agent links only B
  const brief = (await w.ok(["brief", tasks.find((t) => t.subject.includes("H0002"))!.id])).out;
  assert.match(brief, /A\) как в дереве, семья F0001 \[the tree records this already: child P0001 of F0001 — no link to make; open until the records decide it\]; B\) сын Řehoře/);
  assert.match(brief, /says what the tree records\s+already \(marked so\) has no link to make/);

  // hypothesis list --unlinked: H1 has nothing to link, H2 has
  const unlinked = (await w.ok(["hypothesis", "list", "--unlinked", "--json"])).json.hypotheses.map((h: Hypothesis) => h.id);
  assert.ok(!unlinked.includes("H0001"));
  assert.ok(unlinked.includes("H0002"));
  w.cleanup();
});

test("the Strom file: a variant the tree records already comes as 3 _INTREE (never as a link not made yet); valid, and back through strom sync as no change", opts, async () => {
  const w = await world();
  await hypo(w, "Byl otcem Ondřeje Tomáš (P0002), nebo jeho stejnojmenný syn?", "A: Tomáš P0002 a Marie P0003, jak vede strom (rodina F0001)", "B: syn Řehoře P0004 a Ludmily P0005"); // H1
  await w.ok(["hypothesis", "link", "H1", "B", "--child", "P1", "--of", "F2"]);
  const ged = exportGedcom(tree(w), { for: "strom", research: true, edges: true, hypothesisLinks: true }).text;
  const p1 = ged.split(/\n(?=0 )/).find((r) => r.startsWith("0 @P0001@ INDI"))!;
  assert.match(p1, /\n2 _VAR A\n3 TITL [^\n]*\n3 _INTREE child\n4 _PERS @P0001@\n4 _FAM @F0001@\n2 _VAR B\n3 TITL [^\n]*\n3 _LINK child\n4 _PERS @P0001@\n4 _FAM @F0002@\n/);
  assert.deepEqual(validateGedcom(ged), []);
  assert.ok((BRIDGE_FEATURES as readonly string[]).includes("hypothesis.intree"), "the bridge says it");
  // the standard file and an app that shows no links: nothing of it
  assert.doesNotMatch(exportGedcom(tree(w), { for: "strom", research: true }).text, /_INTREE/);
  assert.doesNotMatch(exportGedcom(tree(w)).text, /_INTREE/);
  const file = path.join(w.dir, "back.ged");
  fs.writeFileSync(file, ged);
  assert.deepEqual((await w.ok(["sync", file, "--json"])).json.changes, []);
  // a couple a variant named, made a family of the tree since: the tree's own, never also a link to show
  await w.ok(["hypothesis", "add", "Byli Řehoř a Marie pár?", "--about", "P4", "--variant", "A: ano", "--variant", "B: ne"]); // H2
  await w.ok(["hypothesis", "link", "H2", "A", "--partners", "P4", "P3"]);
  await w.ok(["family", "add", "--partner", "P4", "--partner", "P3"]); // F3
  const couple = exportGedcom(tree(w), { for: "strom", research: true, hypothesisLinks: true }).text.split(/\n(?=0 )/).find((r) => r.startsWith("0 @P0004@ INDI"))!;
  assert.match(couple, /\n2 _VAR A\n3 TITL ano\n3 _INTREE partners\n4 _PERS @P0004@\n4 _PERS @P0003@\n4 _FAM @F0003@\n2 _VAR B\n/);
  assert.doesNotMatch(couple, /_LINK partners/);
  // decided: what it chose is the tree's now — no _INTREE, as before
  await w.ok(["hypothesis", "decide", "H1", "--variant", "A", "--decision", "křest jmenuje Tomáše a Marii"]);
  const decided = exportGedcom(tree(w), { for: "strom", research: true, hypothesisLinks: true }).text.split(/\n(?=0 )/).find((r) => r.startsWith("0 @P0001@ INDI"))!;
  assert.match(decided, /\n2 STAT decided\n2 _CHOSEN A\n/);
  assert.doesNotMatch(decided, /_INTREE/);
  w.cleanup();
});
