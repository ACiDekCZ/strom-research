// Only the person decides a hypothesis: an agent proposes it (strom hypothesis propose — kept on the hypothesis,
// shown by show, list and the brief, waiting in the menu's What waits), the person decides it there or with strom
// hypothesis decide (as proposed, otherwise, or left as it is). A hypothesis whose variants say what they would connect
// is decided for one of them (--variant). What the person decided goes on the tree in the agent's next work (the brief).
// Nothing of it reaches the Strom app: the bridge and the GED say a hypothesis as before.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import { exportGedcom } from "../../src/gedcom/export.ts";
import { waitingFor } from "../../src/core/waiting.ts";
import type { Hypothesis } from "../../src/core/model.ts";

const opts = { skip: !hasGit };
const AGENT = { env: { AI_AGENT: "1" } };

/**
 * Josef Horák (P1) whose parents are unknown; a couple Václav Lhoták + Marie Vlková (P2, P3, F1) found in the records.
 * H1: whose son Josef is — A the couple's (linked), B another family's. H2: where he was born — no links. S1 a baptism.
 */
async function world(): Promise<World> {
  const w = new World();
  await w.withTree();
  await w.ok(["research", "new", "Předci Josefa", "--new-person", "Josef /Horák/", "--sex", "M"]); // P1
  await w.ok(["person", "add", "Václav /Lhoták/", "--sex", "M"]); // P2
  await w.ok(["person", "add", "Marie /Vlková/", "--sex", "F"]); // P3
  await w.ok(["family", "add", "--partner", "P2", "--partner", "P3"]); // F1
  await w.ok(["source", "add", "Křest Josefa 1850 v Lhotě", "--kind", "baptism"]); // S1
  await w.ok(["hypothesis", "add", "Čí syn je Josef?", "--about", "P1", "--variant", "A: syn Václava a Marie", "--variant", "B: z jiné rodiny"]); // H1
  await w.ok(["hypothesis", "link", "H1", "A", "--child", "P1", "--of", "F1"]);
  await w.ok(["hypothesis", "add", "Kde se Josef narodil?", "--about", "P1", "--variant", "A: v Lhotě", "--variant", "B: jinde"]); // H2
  return w;
}

const ops = (w: World): string =>
  (fs.readdirSync(path.join(w.cwd, "data", "ops"), { recursive: true }) as string[])
    .filter((f) => f.endsWith(".jsonl"))
    .map((f) => fs.readFileSync(path.join(w.cwd, "data", "ops", f), "utf8"))
    .join("");
const hyp = (w: World, id: string) => Tree.open(w.cwd, w.env).get<Hypothesis>(id)!;

test("a hypothesis whose variants have links is decided for one of them: without --variant refused, nothing written; one without links needs none", opts, async () => {
  const w = await world();
  try {
    const before = hyp(w, "H0001").updated;
    const r = await w.run(["hypothesis", "decide", "H1", "--decision", "křest jmenuje rodiče"]);
    assert.equal(r.code, 2, r.err);
    assert.match(r.err, /H0001: its variants say what they would connect — name the variant it is decided for \(--variant A\|B\)/u);
    assert.deepEqual([hyp(w, "H0001").state, hyp(w, "H0001").updated], ["open", before], "nothing written");
    // proposing: the same
    assert.equal((await w.run(["hypothesis", "propose", "H1", "--decision", "křest"], AGENT)).code, 2);
    assert.equal(hyp(w, "H0001").proposal, undefined);
    await w.ok(["hypothesis", "decide", "H1", "--variant", "A", "--decision", "křest S0001 jmenuje rodiče"]);
    assert.deepEqual([hyp(w, "H0001").state, hyp(w, "H0001").chosen, hyp(w, "H0001").decidedBy], ["decided", "A", "user"]);
    // no links: no variant needed; abandoned the same
    await w.ok(["hypothesis", "decide", "H2", "--decision", "nelze rozhodnout", "--abandon"]);
    assert.deepEqual([hyp(w, "H0002").state, hyp(w, "H0002").decidedBy], ["abandoned", "user"]);
  } finally {
    w.cleanup();
  }
});

test("where the person decides them, only the person decides a hypothesis: an agent is refused with what to run instead — on its own, abandoning, again, in a batch", opts, async () => {
  const w = await world();
  try {
    // the person chosen (where nothing is set the AI decides them — hypothesis-agent-decides.test.ts)
    await w.ok(["config", "set", "hypotheses.decide", "person"]);
    for (const argv of [
      ["hypothesis", "decide", "H1", "--variant", "A", "--decision", "křest"],
      ["hypothesis", "decide", "H2", "--abandon", "--decision", "nelze"],
      ["hypothesis", "decide", "H2", "--decision", "v Lhotě", "--reason", "nový zápis"],
    ]) {
      const r = await w.run([...argv, "--json"], AGENT);
      assert.equal(r.code, 4, r.out + r.err);
      assert.match(r.out + r.err, /strom hypothesis propose H… --variant <label> --decision/u);
    }
    const b = await w.run(["batch", 'hypothesis decide H1 --variant A --decision "křest"'], AGENT);
    assert.notEqual(b.code, 0);
    assert.match(b.out + b.err, /strom hypothesis propose/u);
    assert.deepEqual([hyp(w, "H0001").state, hyp(w, "H0002").state], ["open", "open"]);
  } finally {
    w.cleanup();
  }
});

test("an agent proposes, the work goes on: kept on the hypothesis, shown by show and list, in What waits — and the person decides it as proposed", opts, async () => {
  const w = await world();
  try {
    const p = await w.ok(["hypothesis", "propose", "H1", "--variant", "a", "--decision", "křest S0001 jmenuje Václava a Marii"], AGENT);
    assert.match(p.out, /the user decides it: tell them in a sentence what you propose and why/u);
    const h = hyp(w, "H0001");
    assert.equal(h.state, "open");
    assert.deepEqual([h.proposal?.variant, h.proposal?.decision, h.proposal?.abandon], ["A", "křest S0001 jmenuje Václava a Marii", undefined]);
    // the history says it
    assert.ok(ops(w).includes("H0001 proposed to decide for A"), ops(w).slice(-600));
    assert.match((await w.ok(["hypothesis", "show", "H1"])).out, /\nproposed \(for A\) {2}křest S0001 jmenuje Václava a Marii {2}— by .+; the user decides it/u);
    assert.match((await w.ok(["hypothesis", "list"])).out, /H0001 .*proposed: A/u);
    // the brief marks it
    assert.match((await w.ok(["brief"])).out, /Čí syn je Josef\?.* — proposed for A, the user decides it/u);
    // What waits: the terminal's own, never the bridge's
    const tree = Tree.open(w.cwd, w.env);
    const here = waitingFor(tree, { hypotheses: true }).filter((x) => x.item.kind === "hypothesis");
    assert.deepEqual(here.map((x) => [x.item.id, x.item.what, x.terminalOnly, x.item.section]), [["H0001", "Čí syn je Josef?", true, "decide"]]);
    assert.deepEqual(waitingFor(tree).filter((x) => x.item.kind === "hypothesis"), [], "the bridge asks for none");
    // the person: as proposed
    const d = await w.ok(["hypothesis", "decide", "H1", "--proposed"]);
    assert.match(d.out, /zapíše agent do stromu při své příští práci/u, "the research's language (cs)");
    const after = hyp(w, "H0001");
    assert.deepEqual([after.state, after.chosen, after.decision, after.decidedBy, after.proposal], ["decided", "A", "křest S0001 jmenuje Václava a Marii", "user", undefined]);
    assert.ok(ops(w).includes("H0001 decided for A as proposed"));
    // the agent's next session: the link of the variant decided is to be recorded
    assert.match((await w.ok(["brief"])).out, /## Decided by the user — record it on the tree first\n {2}H0001 Čí syn je Josef\? — decided for A: .*\n {4}⇢ child P0001 of F0001: strom family child F0001 P0001 --cite S…/u);
    await w.ok(["family", "child", "F1", "P1", "--cite", "S1"]);
    assert.doesNotMatch((await w.ok(["brief"])).out, /Decided by the user/u, "recorded: nothing more to say");
    assert.equal(waitingFor(Tree.open(w.cwd, w.env), { hypotheses: true }).filter((x) => x.item.kind === "hypothesis").length, 0);
  } finally {
    w.cleanup();
  }
});

test("the person decides otherwise, abandons as proposed or leaves the proposal; a decided one proposed again needs a reason", opts, async () => {
  const w = await world();
  try {
    // otherwise: another variant, the person's words
    await w.ok(["hypothesis", "propose", "H1", "--variant", "A", "--decision", "křest"], AGENT);
    await w.ok(["hypothesis", "decide", "H1", "--variant", "B", "--decision", "jiný zápis"]);
    assert.deepEqual([hyp(w, "H0001").chosen, hyp(w, "H0001").decision, hyp(w, "H0001").proposal], ["B", "jiný zápis", undefined]);
    assert.ok(ops(w).includes("H0001 decided for B") && !ops(w).includes("H0001 decided for B as proposed"));
    // abandoned as proposed
    await w.ok(["hypothesis", "propose", "H2", "--abandon", "--decision", "žádný záznam je nerozliší"], AGENT);
    await w.ok(["hypothesis", "decide", "H2", "--proposed"]);
    assert.deepEqual([hyp(w, "H0002").state, hyp(w, "H0002").decision], ["abandoned", "žádný záznam je nerozliší"]);
    // a decided one proposed again: only with a reason; left as it is — the proposal into a note
    assert.match((await w.run(["hypothesis", "propose", "H1", "--variant", "A", "--decision", "křest"], AGENT)).err, /H0001 is already decided: "jiný zápis"\n→ proposing again needs --reason/u);
    await w.ok(["hypothesis", "propose", "H1", "--variant", "A", "--decision", "křest", "--reason", "nový zápis 1851"], AGENT);
    assert.match((await w.run(["hypothesis", "decide", "H1", "--keep-open", "--variant", "A"])).err, /--keep-open decides nothing: it goes alone/u);
    await w.ok(["hypothesis", "decide", "H1", "--keep-open"]);
    const h = hyp(w, "H0001");
    assert.deepEqual([h.state, h.chosen, h.proposal], ["decided", "B", undefined]);
    assert.match(h.notes.at(-1)!.text, /^proposal not taken \(decide for A: křest\)/u);
    assert.match((await w.run(["hypothesis", "decide", "H1", "--keep-open"])).err, /H0001 has no proposal to leave/u);
    assert.match((await w.run(["hypothesis", "decide", "H1", "--proposed"])).err, /H0001 has no proposal/u);
    assert.equal((await w.ok(["check"])).code, 0);
  } finally {
    w.cleanup();
  }
});

test("What waits: a hypothesis proposed — its question, variants, the proposal; decided as proposed, otherwise or left — in the research language, never addressing the person", opts, async () => {
  const w = await world();
  try {
    await w.ok(["lang", "cs"]);
    await w.ok(["hypothesis", "propose", "H1", "--variant", "A", "--decision", "křest S0001 jmenuje rodiče"], AGENT);
    await w.ok(["hypothesis", "propose", "H2", "--decision", "v Lhotě podle křtu", "--variant", "A"], AGENT);
    // the menu's What waits: its place, the hypothesis, 1 as proposed
    const menu = await w.ok([], { tty: true, answers: ["0"] });
    const item = /^ +(\d) {2}Co čeká/mu.exec(menu.out)?.[1];
    assert.ok(item, menu.out);
    const r = await w.ok([], { tty: true, answers: [item, "1", "1", "1", "0", "0", "0"] });
    assert.match(r.out, /Hypotézy k rozhodnutí/u, r.out);
    assert.match(r.out, /^ H0001 · hypotéza · od /mu, r.out);
    assert.match(r.out, /^ {4}A\) syn Václava a Marie$/mu, r.out);
    assert.match(r.out, /^ {4}Návrh: varianta A – křest S0001 jmenuje rodiče$/mu, r.out);
    assert.match(r.out, /^ {3}1 {2}Rozhodnout podle návrhu$/mu, r.out);
    assert.match(r.out, /^ {3}2 {2}Rozhodnout jinak$/mu, r.out);
    assert.match(r.out, /^ {3}3 {2}Nechat, jak je \(návrh nepřijat\)$/mu, r.out);
    assert.match(r.out, /✓ Hypotéza je rozhodnutá\./u, r.out);
    assert.doesNotMatch(r.out, /(?<![\p{L}\p{M}])(vy|vás|váš|vaše|ty|tvůj)(?![\p{L}\p{M}])/iu);
    assert.deepEqual([hyp(w, "H0001").state, hyp(w, "H0001").decidedBy], ["decided", "user"]);
    // the other one, alone in its group (opened at once): otherwise — none holds, and why
    const o = await w.ok([], { tty: true, answers: [item, "1", "2", "3", "Žádný zápis to neříká", "0"] });
    assert.match(o.out, /Nic nečeká\./u, o.out);
    assert.match(o.out, /Která varianta platí\?/u, o.out);
    assert.match(o.out, /✓ Hypotéza je odložená/u, o.out);
    assert.deepEqual([hyp(w, "H0002").state, hyp(w, "H0002").decision, hyp(w, "H0002").proposal], ["abandoned", "Žádný zápis to neříká", undefined]);
  } finally {
    w.cleanup();
  }
});

test("an archive says nothing of an agent's proposal; the GED and the bridge's hypothesis as before without one", opts, async () => {
  const w = await world();
  try {
    const ged = (t: Tree) => exportGedcom(t, { for: "strom", appVersion: "3.24.0" } as never).text ?? "";
    const before = ged(Tree.open(w.cwd, w.env));
    await w.ok(["hypothesis", "propose", "H1", "--variant", "A", "--decision", "křest"], AGENT);
    // a proposal is no field of the GED: the same file
    const strip = (s: string) => s.replace(/^\d _?(DATE|TIME|CHAN|_STROM_HEAD|_STROM_ASOF).*$/gmu, "");
    assert.equal(strip(ged(Tree.open(w.cwd, w.env))), strip(before));
    await w.ok(["mode", "archive"], { tty: true, answers: ["", "", ""] });
    assert.doesNotMatch((await w.ok(["hypothesis", "show", "H1"])).out, /proposed/u);
    assert.doesNotMatch((await w.ok(["hypothesis", "list"])).out, /proposed/u);
    assert.deepEqual(waitingFor(Tree.open(w.cwd, w.env), { hypotheses: true }).filter((x) => x.item.kind === "hypothesis"), []);
  } finally {
    w.cleanup();
  }
});
