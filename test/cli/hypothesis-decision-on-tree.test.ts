// A person's decision of a hypothesis on the tree at once (spec 074 K1.5): the chosen variant's links written in the
// same commit as the decision — a couple a new family, a child of named parents a new family, a child of a family added
// to it — citing the variant's first source; without an agent, in an archive too. Changed: what the decision before wrote
// taken off, the new written. Taken back: what it wrote taken off, unless other work stands on it. None holds or left
// open: nothing written. What the tree refuses (a child with birth parents already) is left to the agent, said why.

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { World, hasGit } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import { exportGedcom } from "../../src/gedcom/export.ts";
import type { Family, Hypothesis } from "../../src/core/model.ts";

const opts = { skip: !hasGit };

/**
 * Josef Lhoták (P1) whose parents are unknown; Václav Lhoták and Marie Lhotová (P2, P3), no family of theirs; Anna
 * Lhotová (P4); Jakub Lhoták + Rozálie Lhotová (P5, P6, F1) with their son Tomáš (P7). S1 a baptism, S2 a marriage.
 * H1: whose son Josef is — A of Václav and Marie (S1 for it), B unknown. H2: whom Josef married — A Anna (S2 for it).
 * H3: whose son Tomáš is — A of Václav and Marie (Tomáš has birth parents already).
 */
async function world(): Promise<World> {
  const w = new World();
  await w.withTree();
  await w.ok(["research", "new", "Předci Josefa", "--new-person", "Josef /Lhoták/", "--sex", "M"]); // P1
  await w.ok(["person", "add", "Václav /Lhoták/", "--sex", "M"]); // P2
  await w.ok(["person", "add", "Marie /Lhotová/", "--sex", "F"]); // P3
  await w.ok(["person", "add", "Anna /Lhotová/", "--sex", "F"]); // P4
  await w.ok(["person", "add", "Jakub /Lhoták/", "--sex", "M"]); // P5
  await w.ok(["person", "add", "Rozálie /Lhotová/", "--sex", "F"]); // P6
  await w.ok(["family", "add", "--partner", "P5", "--partner", "P6"]); // F1
  await w.ok(["person", "add", "Tomáš /Lhoták/", "--sex", "M"]); // P7
  await w.ok(["family", "child", "F1", "P7"]);
  await w.ok(["source", "add", "Křest Josefa 1850 v Lhotě", "--kind", "baptism"]); // S1
  await w.ok(["source", "add", "Oddání Josefa a Anny 1875", "--kind", "marriage"]); // S2
  await w.ok(["hypothesis", "add", "Čí syn je Josef?", "--about", "P1", "--variant", "A: syn Václava a Marie", "--variant", "B: neznámých rodičů"]); // H1
  await w.ok(["hypothesis", "link", "H1", "A", "--child", "P1", "--parents", "P2", "P3"]);
  await w.ok(["hypothesis", "argue", "H1", "A", "--for", "křest S0001 jmenuje Václava a Marii"]);
  await w.ok(["hypothesis", "add", "Koho si Josef vzal?", "--about", "P1", "--variant", "A: Annu", "--variant", "B: jinou"]); // H2
  await w.ok(["hypothesis", "link", "H2", "A", "--partners", "P1", "P4"]);
  await w.ok(["hypothesis", "argue", "H2", "A", "--for", "oddání S2"]);
  await w.ok(["hypothesis", "add", "Čí syn je Tomáš?", "--about", "P7", "--variant", "A: syn Václava a Marie", "--variant", "B: Jakuba a Rozálie"]); // H3
  await w.ok(["hypothesis", "link", "H3", "A", "--child", "P7", "--parents", "P2", "P3"]);
  return w;
}

const hyp = (w: World, id: string) => Tree.open(w.cwd, w.env).get<Hypothesis>(id)!;
const families = (w: World) => Tree.open(w.cwd, w.env).list<Family>("family").filter((f) => !f.retracted);
const commits = (w: World) => Number(execFileSync("git", ["rev-list", "--count", "HEAD"], { cwd: w.cwd, encoding: "utf8" }).trim());
const ged = (w: World) => exportGedcom(Tree.open(w.cwd, w.env), { gedcomFor: "strom" } as never).text ?? "";

test("decided: a child of named parents a new family, a couple a new family, each citing the variant's source, in the decision's one commit; the GEDCOM has them", opts, async () => {
  const w = await world();
  try {
    const n = commits(w);
    const d = await w.ok(["hypothesis", "decide", "H1", "--variant", "A", "--decision", "křest S0001"]);
    assert.equal(commits(w), n + 1, "the decision and its links one commit");
    assert.match(d.out, /on the tree now: child P0001 of P0002 \+ P0003 \(F0002\)/u, d.out);
    const f2 = Tree.open(w.cwd, w.env).get<Family>("F0002")!;
    assert.deepEqual([[...f2.partners].sort(), f2.children.map((c) => c.person)], [["P0002", "P0003"], ["P0001"]]);
    assert.ok(JSON.stringify(f2).includes("S0001"), "cited as an agent would");
    assert.deepEqual(hyp(w, "H0001").wrote?.map((x) => [x.family, x.made, x.link.kind]), [["F0002", true, "child"]]);
    await w.ok(["hypothesis", "decide", "H2", "--variant", "A", "--decision", "oddání S0002"]);
    const couple = families(w).find((f) => f.partners.includes("P0004"))!;
    assert.deepEqual([...couple.partners].sort(), ["P0001", "P0004"]);
    const file = ged(w);
    assert.match(file, /\n0 @P0001@ INDI\n(?:[1-9].*\n)*1 FAMC @F0002@\n/u, "Josef a child of F2");
    assert.match(file, new RegExp(`\\n0 @P0001@ INDI\\n(?:[1-9].*\\n)*1 FAMS @${couple.id}@\\n`, "u"), "Josef a partner of the couple");
    // the agent's next work: nothing of it to record again
    const brief = (await w.ok(["brief"])).out;
    assert.doesNotMatch(brief, /⇢ (child|partners) P0001/u, brief);
    assert.equal((await w.ok(["check"])).code, 0);
  } finally {
    w.cleanup();
  }
});

test("what the tree refuses is not written: said why, left to the agent; the decision stands", opts, async () => {
  const w = await world();
  try {
    const before = families(w).length;
    const d = await w.ok(["hypothesis", "decide", "H3", "--variant", "A", "--decision", "jiný zápis"]);
    assert.match(d.out, /not written: child P0007 of P0002 \+ P0003 — /u, d.out);
    assert.deepEqual([hyp(w, "H0003").state, hyp(w, "H0003").wrote, families(w).length], ["decided", undefined, before]);
    const j = JSON.parse((await w.ok(["hypothesis", "decide", "H3", "--variant", "B", "--decision", "matrika", "--reason", "nový zápis", "--json"])).out);
    assert.equal(hyp(w, "H0003").chosen, "B", JSON.stringify(j));
  } finally {
    w.cleanup();
  }
});

test("taken back: the family the decision made taken off (retracted, kept in the history), the GEDCOM without it; decided again; none holds: what it wrote taken off, nothing new", opts, async () => {
  const w = await world();
  try {
    await w.ok(["hypothesis", "decide", "H1", "--variant", "A", "--decision", "křest S0001"]);
    const r = await w.ok(["hypothesis", "decide", "H1", "--reopen", "--reason", "jiný Josef"]);
    assert.match(r.out, /taken off the tree: child P0001 of P0002 \+ P0003 \(F0002\)/u, r.out);
    const t = Tree.open(w.cwd, w.env);
    assert.ok(t.get<Family>("F0002")!.retracted, "retracted, not deleted");
    assert.doesNotMatch(ged(w), /1 FAMC @F0002@/u);
    assert.deepEqual([hyp(w, "H0001").state, hyp(w, "H0001").wrote], ["open", undefined]);
    // decided again: written again (a new family), then none holds: taken off
    await w.ok(["hypothesis", "decide", "H1", "--variant", "A", "--decision", "křest S0001"]);
    const again = hyp(w, "H0001").wrote![0]!.family;
    assert.notEqual(again, "F0002");
    const a = await w.ok(["hypothesis", "decide", "H1", "--abandon", "--decision", "nelze", "--reason", "zápis nečitelný"]);
    assert.match(a.out, /taken off the tree: child P0001/u, a.out);
    assert.ok(Tree.open(w.cwd, w.env).get<Family>(again)!.retracted);
    assert.deepEqual([hyp(w, "H0001").state, hyp(w, "H0001").wrote], ["abandoned", undefined]);
    // abandoned or left open from the start: nothing written
    const n = families(w).length;
    await w.ok(["hypothesis", "decide", "H2", "--abandon", "--decision", "nelze"]);
    assert.equal(families(w).length, n);
    assert.equal((await w.ok(["check"])).code, 0);
  } finally {
    w.cleanup();
  }
});

test("an archive: the person's decision written at once all the same", opts, async () => {
  const w = await world();
  try {
    await w.ok(["mode", "archive"], { tty: true, answers: ["", "", ""] });
    await w.ok(["hypothesis", "decide", "H2", "--variant", "A", "--decision", "oddání S0002"]);
    assert.ok(families(w).some((f) => f.partners.includes("P0004")));
    assert.match(ged(w), /\n0 @P0004@ INDI\n(?:[1-9].*\n)*1 FAMS @F\d+@\n/u);
  } finally {
    w.cleanup();
  }
});
