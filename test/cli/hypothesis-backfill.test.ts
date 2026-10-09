// Older hypotheses get the links of their variants: once per research (the first run of a newer strom, the bridge's
// start) strom fills in what a variant's claim says beyond doubt — the subject the child of the two people it names as
// the parents — each link written as strom hypothesis link writes it, with the reason; anything doubtful is left to the
// agent as a task (origin hypothesis:links), never twice. A variant somebody linked by hand stays as it is.

import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { World, hasGit, readJsonFile } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import { claimLink, HYPOTHESIS_LINKS_ORIGIN, settleHypothesisLinks } from "../../src/core/hypolinks.ts";
import type { Hypothesis, HypothesisVariant, Task } from "../../src/core/model.ts";

const opts = { skip: !hasGit };

/**
 * Ondřej (P1), his father Tomáš (P2, *1815) where the tree ends; a couple Řehoř + Ludmila (P3, P4, F2) nothing links;
 * Žofie (P5); Kašpar (P6) and Dorota (P7), no family of theirs; Václav (P8, *1830), too young to be anyone's father here.
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
  await w.ok(["person", "add", "Kašpar /Lang/", "--sex", "M"]); // P6
  await w.ok(["person", "add", "Dorota /Langová/", "--sex", "F"]); // P7
  await w.ok(["person", "add", "Václav /Kubát/", "--sex", "M", "--born", "1830"]); // P8
  await w.ok(["source", "add", "Sňatek Tomáše 1840", "--kind", "marriage"]); // S1
  return w;
}

const hypo = (w: World, question: string, about: string[], ...variants: string[]) =>
  w.ok(["hypothesis", "add", question, ...about.flatMap((a) => ["--about", a]), ...variants.flatMap((v) => ["--variant", v]), "--json"]);

const head = (w: World) => spawnSync("git", ["-C", w.cwd, "rev-parse", "HEAD"], { encoding: "utf8" }).stdout.trim();
const subjects = (w: World) => spawnSync("git", ["-C", w.cwd, "log", "--format=%s"], { encoding: "utf8" }).stdout;
const get = (w: World, id: string) => Tree.open(w.cwd, w.env).get<Hypothesis>(id)!;
const ourTasks = (w: World) => Tree.open(w.cwd, w.env).list<Task>("task").filter((t) => t.origin === HYPOTHESIS_LINKS_ORIGIN);

/** Every way a claim leaves doubt, each its own hypothesis: [question, about, claim of B]. */
const DOUBTFUL: [string, string[], string][] = [
  ["otazník", ["P2"], "B: syn P0003 a P0004?"],
  ["nebo", ["P2"], "B: syn P0003 nebo P0004"],
  ["manželka", ["P2"], "B: syn P0003 a jeho manželky P0004"],
  ["sourozenec", ["P2"], "B: bratr P0003 a P0004"],
  ["totožný", ["P2"], "B: týž člověk jako P0006"],
  ["jeden", ["P2"], "B: syn P0003"],
  ["tři", ["P2"], "B: syn P0003, P0004 a P0006"],
  ["parents of", ["P2"], "B: the parents of P0003 and P0004"],
  ["svědek", ["P2"], "B: syn P0006 a P0007, svědek u sňatku"],
  ["jiná rodina", ["P2"], "B: syn P0003 a P0004 (F0001)"],
  ["ne", ["P2"], "B: ne syn P0003 a P0004"],
  ["moc mladý", ["P2"], "B: syn P0008 a P0007"],
  ["dva o téže", ["P2", "P5"], "B: syn P0003 a P0004"],
  ["kmotr", ["P2"], "B: Kmotr P0006 a P0007"],
  ["nevlastní", ["P2"], "B: nevlastní syn P0006 a P0007"],
  // the question about another relation: whose son, then?
  ["Byl Kašpar P0006 bratrem Tomáše?", ["P2"], "B: ano, syn P0003 a P0004"],
  ["Is P0002 the same man as P0008?", ["P2"], "B: yes, son of P0003 and P0004"],
];

test("older hypotheses: what a claim says beyond doubt is linked once, through strom hypothesis link's own path; the rest a task, never twice", opts, async () => {
  const w = await world();
  // the clear ones: a family of the tree (Czech), two parents with none (German), English with a citation, "rodiče:"
  await hypo(w, "Odkud pocházel Tomáš?", ["P2"], "A: z Horní Vsi, rodiče neznámí", "B: syn Řehoře P0003 a Ludmily P0004 (sňatek S0001)"); // H1
  await hypo(w, "Woher kam Tomáš?", ["P2"], "A: aus Horní Ves", "B: Sohn von Kaspar P0006 und Dorothea P0007"); // H2
  await hypo(w, "Whose daughter was Žofie?", ["P5"], "A: unknown", "B: daughter of P0003 and P0004 ([K-12] S0001)"); // H3
  await hypo(w, "Rodiče Tomáše?", ["P2"], "A: rodiče: P0006 a P0007", "B: z jiné vsi"); // H4
  // linked by hand (the user just ran strom hypothesis link): stays exactly as it is
  await hypo(w, "Ručně", ["P2"], "A: nic", "B: syn P0006 a P0007"); // H5
  await w.ok(["hypothesis", "link", "H5", "B", "--child", "P2", "--parents", "P6"]);
  // links taken off by hand: somebody decided — nothing again
  await hypo(w, "Sundáno", ["P2"], "A: nic", "B: syn P0003 a P0004"); // H6
  await w.ok(["hypothesis", "link", "H6", "B", "--child", "P2", "--of", "F2"]);
  await w.ok(["hypothesis", "link", "H6", "B", "--remove"]);
  // decided: not touched
  await hypo(w, "Rozhodnuto", ["P2"], "A: nic", "B: syn P0003 a P0004"); // H7
  await w.ok(["hypothesis", "decide", "H7", "--decision", "nelze", "--abandon"]);
  // naming nobody by ID: no task either
  await hypo(w, "Beze jmen", ["P2"], "A: z Horní Vsi", "B: z Dolní Vsi"); // H8
  let n = 9;
  for (const [q, about, claim] of DOUBTFUL) {
    await hypo(w, q, about, "A: nic", claim);
    n++;
  }
  const h5 = JSON.stringify(get(w, "H0005"));
  const h6 = JSON.stringify(get(w, "H0006"));
  const before = head(w);

  const tree = Tree.open(w.cwd, w.env);
  const done = settleHypothesisLinks(tree)!;
  assert.ok(done, "something done");
  assert.deepEqual(
    done.linked.map((l) => [l.hypothesis, l.variant, l.link]),
    [
      ["H0001", "B", { kind: "child", person: "P0002", family: "F0002" }],
      ["H0002", "B", { kind: "child", person: "P0002", parents: ["P0006", "P0007"] }],
      ["H0003", "B", { kind: "child", person: "P0005", family: "F0002" }],
      ["H0004", "A", { kind: "child", person: "P0002", parents: ["P0006", "P0007"] }],
    ],
  );
  // the variant of no IDs, and those somebody worked on: untouched
  assert.equal(get(w, "H0001").variants[0]!.links, undefined);
  assert.equal(JSON.stringify(get(w, "H0005")), h5);
  assert.equal(JSON.stringify(get(w, "H0006")), h6);
  assert.equal(get(w, "H0007").variants[1]!.links, undefined);
  // every doubtful claim: nothing written
  for (let i = 9; i < n; i++) {
    const id = `H${String(i).padStart(4, "0")}`;
    assert.ok(get(w, id).variants.every((v) => !v.links && !v.linked), `${id} ${get(w, id).question}: nothing linked`);
  }
  // the links as strom hypothesis link writes them: the people it named kept, the op with the reason
  assert.deepEqual(get(w, "H0001").variants[1]!.linked, ["P0002", "F0002"]);
  const ops = tree.readOps().filter((o) => o.op === "hypothesis.link" && /read from the claim/.test(o.reason ?? ""));
  assert.deepEqual(ops.map((o) => o.summary), ["H0001 B: child P0002 of F0002", "H0002 B: child P0002 of P0006 + P0007", "H0003 B: child P0005 of F0002", "H0004 A: child P0002 of P0006 + P0007"]);
  assert.match(ops[0]!.reason!, /strom hypothesis link H0001 B --remove/);

  // the rest for the agent: the doubtful ones naming people, ten to a task, in the research's language
  const tasks = ourTasks(w);
  const doubtful = Array.from({ length: n - 9 }, (_, i) => `H${String(i + 9).padStart(4, "0")}`);
  assert.deepEqual(tasks.flatMap((t) => t.subject), doubtful);
  assert.deepEqual(tasks.map((t) => t.subject.length), [10, doubtful.length - 10]);
  assert.deepEqual(done.tasks.map((t) => t.id), tasks.map((t) => t.id));
  assert.equal(tasks[0]!.state, "open");
  assert.equal(tasks[0]!.level, "enrich");
  assert.match(tasks[0]!.what, /^Doplnit, co by spojovaly verze hypotéz H0009, H0010/);
  assert.match(tasks[0]!.doneWhen, /strom hypothesis link H… <písmeno> --child P… --of F…/);

  // one commit: what it linked, the tasks, the marker in strom.json
  const log = subjects(w).split("\n");
  assert.notEqual(head(w), before);
  assert.match(log[0]!, /^Links of hypothesis variants filled in from their claims \(H0001 B: child P0002 of F0002, H0002 B: child P0002 of P0006 \+ P0007, .*\); the rest for the agent: T\d+ \(H0009, /);
  assert.equal(spawnSync("git", ["-C", w.cwd, "status", "--porcelain"], { encoding: "utf8" }).stdout, "");
  assert.deepEqual(readJsonFile(path.join(w.cwd, "strom.json")).settled, ["hypothesis-links"]);
  // the person's history says it in the research's language, never the marker
  const history = JSON.stringify((await w.ok(["history", "--json"])).json);
  assert.doesNotMatch(history, /links of the hypotheses' variants filled in once/);

  // again: nothing (the marker) — no commit, no task
  const after = head(w);
  assert.equal(settleHypothesisLinks(Tree.open(w.cwd, w.env)), undefined);
  assert.equal(head(w), after);
  // the marker gone (an older strom's copy, say), a task dropped: never a task twice, nothing linked twice
  await w.ok(["task", "drop", tasks[0]!.id, "--reason", "později"]);
  const t2 = Tree.open(w.cwd, w.env);
  t2.withTreeLock(() => {
    t2.updateConfig((c) => void delete (c as { settled?: string[] }).settled, { op: "config.set", summary: "test" });
    t2.commit("test: the marker taken off");
  });
  const unmarked = head(w);
  assert.equal(settleHypothesisLinks(Tree.open(w.cwd, w.env)), undefined);
  assert.equal(head(w), unmarked);
  assert.equal(ourTasks(w).length, tasks.length);
  // a link taken off by hand stays off
  await w.ok(["hypothesis", "link", "H1", "B", "--remove"]);
  assert.equal(settleHypothesisLinks(Tree.open(w.cwd, w.env)), undefined);
  assert.equal(get(w, "H0001").variants[1]!.links, undefined);
  assert.equal((await w.ok(["check"])).code, 0);
  w.cleanup();
});

test("reading a claim: Czech with diacritics, decomposed, German, English; another script or any doubt — nothing", opts, async () => {
  const w = await world();
  await hypo(w, "Odkud?", ["P2"], "A: nic", "B: nic"); // H1
  const tree = Tree.open(w.cwd, w.env);
  const h = tree.get<Hypothesis>("H0001")!;
  const read = (claim: string) => claimLink(tree, h, { label: "B", claim, support: [], against: [] } satisfies HypothesisVariant);
  const fam = { kind: "child", person: "P0002", family: "F0002" };
  const two = { kind: "child", person: "P0002", parents: ["P0006", "P0007"] };
  assert.deepEqual(read("syn Řehoře Šimka P0003 a Ludmily P0004 (S0001)"), fam);
  assert.deepEqual(read("syn Řehoře Šimka P0003 a Ludmily P0004 (S0001)".normalize("NFD")), fam);
  assert.deepEqual(read("P0002 je synem P0003 a P0004"), fam);
  assert.deepEqual(read("Rodiče P0002 jsou P0006 a P0007"), two);
  assert.deepEqual(read("RODIČE: P0006, P0007".normalize("NFD")), two);
  assert.deepEqual(read("Sohn des P0006 und der P0007"), two);
  assert.deepEqual(read("Kind von P0006 & P0007"), two);
  assert.deepEqual(read("Eltern: P0006 und P0007"), two);
  assert.deepEqual(read("the son of a miller, P0003, and P0004 ([K-12] S0001)"), fam);
  for (const claim of [
    "сын P0003 и P0004", // another script: no words known — nothing, no failure
    "syn P0003 a P0004 nebo P0006",
    "syn P0003 či P0004",
    "Eltern von P0006 und P0007",
    "parents of P0006 and P0007",
    "son of P0003 or P0004",
    "son of P0003 and maybe P0004",
    "syn P0003 a snad P0004",
    "son of P0003; P0004 his wife",
    "syn P0003 / P0004",
    "Stiefsohn von P0006 und P0007",
    "stepson of P0006 and P0007",
    "Sohn von P0006 und P0007, Enkel von P0003",
    "syn P0006 a P0007, vnuk P0003",
    "son of P0003 and P0003",
    "son of P0006 and P0007's sister",
  ])
    assert.equal(read(claim), undefined, claim);
  // two of one sex: never parents
  assert.equal(read("syn P0004 a P0005"), undefined);
  // a man and a woman with no family: the two
  assert.deepEqual(read("syn P0003 a P0005"), { kind: "child", person: "P0002", parents: ["P0003", "P0005"] });
  // the subject with parents, or two subjects: nothing
  await hypo(w, "Ondřej", ["P1"], "A: nic", "B: syn P0003 a P0004"); // H2
  const t = Tree.open(w.cwd, w.env);
  assert.equal(claimLink(t, t.get<Hypothesis>("H0002")!, t.get<Hypothesis>("H0002")!.variants[1]!), undefined);
  w.cleanup();
});

test("strom hypothesis add and variant: a variant naming people by ID and no links says the exact command", opts, async () => {
  const w = await world();
  const r = await hypo(w, "Odkud?", ["P2"], "A: z Horní Vsi", "B: syn Řehoře P0003 a Ludmily P0004");
  assert.deepEqual(r.json.linkHints, ["B names its people only in words — if it says child P0002 of F0002: strom hypothesis link H0001 B --child P0002 --of F0002"]);
  const v = await w.ok(["hypothesis", "variant", "H1", "bratr P0006"]);
  assert.match(v.out, /\nC names its people only in words — say what it would connect: strom hypothesis link H0001 C --child P… --of F… \| /);
  // nothing to say: no hint
  assert.doesNotMatch((await w.ok(["hypothesis", "variant", "H1", "z Dolní Vsi"])).out, /names its people/);
  // the hint links nothing
  assert.equal(get(w, "H0001").variants[1]!.links, undefined);
  w.cleanup();
});

test("the first run of a newer strom fills them in; an archive: links written, its tasks put aside; the bridge's start too, once", opts, async () => {
  const w = await world();
  await hypo(w, "Odkud?", ["P2"], "A: nic", "B: syn P0003 a P0004"); // H1
  await hypo(w, "Nejisté", ["P2"], "A: nic", "B: syn P0003 nebo P0006"); // H2
  // the first run of a newer strom
  const cfg = path.join(w.env.STROM_CONFIG_DIR!, "config.json");
  fs.writeFileSync(cfg, JSON.stringify({ ...readJsonFile(cfg), lastVersion: "1.0.0" }));
  await w.ok(["stats"]);
  assert.deepEqual(get(w, "H0001").variants[1]!.links, [{ kind: "child", person: "P0002", family: "F0002" }]);
  assert.deepEqual(ourTasks(w).map((t) => t.subject), [["H0002"]]);

  // an archive the same way, through its bridge's start
  const a = await world();
  await a.ok(["mode", "archive"], { tty: true });
  await hypo(a, "Odkud?", ["P2"], "A: nic", "B: Sohn von P0006 und P0007"); // H1
  await hypo(a, "Nejisté", ["P2"], "A: nic", "B: syn P0003 a jeho ženy P0004"); // H2
  await a.ok(["live", "start", "--json"]);
  try {
    assert.deepEqual(get(a, "H0001").variants[1]!.links, [{ kind: "child", person: "P0002", parents: ["P0006", "P0007"] }]);
    const held = ourTasks(a);
    assert.deepEqual(held.map((t) => [t.subject, t.state, t.heldBy]), [[["H0002"], "parked", "archive"]]);
    assert.match(fs.readFileSync(path.join(a.cwd, ".strom", "live.log"), "utf8"), /hypotheses: 1 variant link\(s\) filled in from their claims, 1 task\(s\) for the rest/);
  } finally {
    await a.ok(["live", "stop"]);
  }
  // started again: nothing more
  const at = head(a);
  await a.ok(["live", "start", "--json"]);
  await a.ok(["live", "stop"]);
  assert.equal(head(a), at);
  assert.equal(ourTasks(a).length, 1);
  w.cleanup();
  a.cleanup();
});
