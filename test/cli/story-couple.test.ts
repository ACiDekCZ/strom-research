// A couple's story (spec 027 K6): strom proposes it once records tell the life together and one of the two has a
// story of their own — the life together alone, the partners' stories referred to, never told again.

import { test } from "node:test";
import assert from "node:assert/strict";
import { World, hasGit } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import { coupleFacts, storyProposals } from "../../src/core/stories.ts";
import { researchProposals } from "../../src/commands/session.ts";
import { phrase } from "../../src/core/phrases.ts";
import type { Family, Research } from "../../src/core/model.ts";

const opts = { skip: !hasGit, timeout: 180_000 };
const PLACE = "Lhotečka";

/** Jan Lhoták (P1, the research's focus, born and dead on records) and Marie (P2), wed on a record (F1), one child (P3). */
async function world(): Promise<World> {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["config", "set", "stories.sources", "no"]);
  await w.ok(["research", "new", "Předci Jana Lhotáka", "--new-person", "Jan /Lhoták/", "--sex", "M"]); // P1
  await w.ok(["source", "add", "Matrika Lhotečky", "--kind", "baptism", "--information", "primary"]); // S1
  await w.ok(["event", "add", "P1", "BIRT", "--date", "1850", "--place", PLACE, "--cite", "S1", "--status", "proven"]);
  await w.ok(["event", "add", "P1", "OCCU", "--value", "mlynář", "--cite", "S1", "--status", "proven"]);
  await w.ok(["event", "add", "P1", "DEAT", "--date", "1925", "--place", PLACE, "--cite", "S1", "--status", "proven"]);
  await w.ok(["person", "add", "Marie /Lhotáková/", "--sex", "F"]); // P2
  await w.ok(["family", "add", "--partner", "P1", "--partner", "P2", "--married", "1875", "--married-place", PLACE, "--cite", "S1"]); // F1
  await child(w, "Josef /Lhoták/", "1876");
  return w;
}

/** A child of F1 born on a record. */
async function child(w: World, name: string, year: string): Promise<string> {
  const id = (await w.ok(["person", "add", name, "--sex", "M", "--json"])).json.person.id as string;
  await w.ok(["event", "add", id, "BIRT", "--date", year, "--place", PLACE, "--cite", "S1", "--status", "proven"]);
  await w.ok(["family", "child", "F1", id, "--cite", "S1"]);
  return id;
}

function couple(w: World) {
  const tree = Tree.open(w.cwd, w.env);
  const research = tree.list<Research>("research")[0]!;
  return { tree, research, proposals: storyProposals(tree, research).filter((p) => p.subject.includes("F0001")) };
}

/** Jan's story, written and approved. */
async function janTold(w: World): Promise<void> {
  const facts = (await w.ok(["person", "show", "P1", "--json"])).json.person.events.map((e: { id: string }) => e.id) as string[];
  await w.ok(["story", "set", "P1", "--text", "Jan byl mlynář v Lhotečce.", ...facts.flatMap((f) => ["--fact", f]), "--final"]);
}

test("a couple's story: proposed once records tell the life together and one of the two has a story — never before", opts, async () => {
  const w = await world();
  try {
    // the wedding and one child: too little
    await janTold(w);
    assert.deepEqual(couple(w).proposals, []);
    // a second child: the wedding and two more facts — Jan has his own story: the couple's is due
    await child(w, "Václav /Lhoták/", "1878");
    const due = couple(w).proposals;
    assert.equal(due.length, 1);
    const [p] = due;
    assert.equal(p!.level, "narrate");
    assert.equal(p!.priority, 1);
    assert.deepEqual(p!.subject, ["F0001"]);
    const { tree } = couple(w);
    assert.equal(p!.what, phrase(tree.lang, "story.couple.what", { a: "Jan Lhoták", b: "Marie Lhotáková" }));
    // the partner's story is given to it as told already; the one without a story is not named as one
    assert.ok(p!.where.some((x) => x.includes("strom story show P0001")));
    assert.ok(!p!.where.some((x) => x.includes("strom story show P0002")));
    assert.ok(p!.where.some((x) => x.includes("strom family show F0001")));
    assert.match(p!.doneWhen, /strom story set F0001/u);
  } finally {
    w.cleanup();
  }
});

test("a couple's story: nobody with a story of their own — not proposed; the task of a partner's done counts as one", opts, async () => {
  const w = await world();
  try {
    await child(w, "Václav /Lhoták/", "1878");
    assert.deepEqual(couple(w).proposals, [], "nobody of the two has a story");
    // the research proposes Jan's story: done (somebody decided there is none to write) — that is his own told
    await w.ok(["frontier", "--research", "G0001", "--apply"]);
    const jan = (await w.ok(["task", "list", "--json"])).json.tasks.find((t: { level: string; subject: string[] }) => t.level === "narrate" && t.subject.includes("P0001"));
    assert.ok(jan, "Jan's story proposed");
    await w.ok(["task", "done", jan.id, "--result", "napsáno jinde"]);
    assert.equal(couple(w).proposals.length, 1);
  } finally {
    w.cleanup();
  }
});

test("a couple's story: the setting stories off proposes none; open or dropped — not again; written, new facts propose adding to it", opts, async () => {
  const w = await world();
  try {
    await child(w, "Václav /Lhoták/", "1878");
    await janTold(w);
    // stories off: no story at all, the couple's neither
    await w.ok(["config", "set", "stories", "no"]);
    {
      const { tree, research } = couple(w);
      assert.deepEqual(researchProposals(tree, research).filter((x) => x.kind === "story"), []);
    }
    await w.ok(["config", "set", "stories", "yes"]);
    // proposed and taken: open — not again
    await w.ok(["frontier", "--research", "G0001", "--apply"]);
    const task = (await w.ok(["task", "list", "--json"])).json.tasks.find((t: { subject: string[] }) => t.subject.includes("F0001"));
    assert.ok(task, "the couple's story is a task");
    assert.match((await w.ok(["task", "list"])).out, new RegExp(task.id));
    assert.deepEqual(couple(w).proposals, []);
    // dropped: that was the answer — not again, a new child neither
    await w.ok(["task", "drop", task.id, "--reason", "ne teď"]);
    await child(w, "Antonín /Lhoták/", "1880");
    assert.deepEqual(couple(w).proposals, []);
    // written after all (the user asked for it): one fact new since is too few, two propose adding to it
    const { tree } = couple(w);
    const facts = coupleFacts(tree, tree.get<Family>("F0001")!).facts.map((e) => e.id);
    await w.ok(["story", "set", "F1", "--text", "Jan a Marie se vzali roku 1875.", ...facts.slice(0, -1).flatMap((f) => ["--fact", f]), "--final"]);
    assert.deepEqual(couple(w).proposals, [], "one new fact");
    await child(w, "Karel /Lhoták/", "1882");
    const more = couple(w).proposals;
    assert.equal(more.length, 1, "two new facts");
    assert.equal(more[0]!.what, phrase(tree.lang, "story.couple.more.what", { a: "Jan Lhoták", b: "Marie Lhotáková", count: 2 }));
  } finally {
    w.cleanup();
  }
});

test("a couple's story in the brief: the partners' stories as told already, never told again; a person's story after it: the marriage in a sentence, nothing shortened", opts, async () => {
  const w = await world();
  try {
    await child(w, "Václav /Lhoták/", "1878");
    await janTold(w);
    await w.ok(["frontier", "--research", "G0001", "--apply"]);
    const task = (await w.ok(["task", "list", "--json"])).json.tasks.find((t: { subject: string[] }) => t.subject.includes("F0001"));
    const brief = (await w.ok(["brief", task.id])).out;
    assert.match(brief, /## The couple's story \(F0001\): their life together alone/u);
    assert.match(brief, /referred to in a sentence, never told again/u);
    // Jan's story itself, as the context; Marie has none
    assert.match(brief, /### The story of [^\n]*P0001[^\n]*\(final\)\nJan byl mlynář v Lhotečce\./u);
    assert.match(brief, /P0002[^\n]*: no story of their own yet/u);
    // Marie's line stands before the stories, never under Jan's heading where it would read as part of his story
    assert.ok(brief.indexOf("no story of their own yet") < brief.indexOf("### The story of"), "the partner without a story before the stories");
    // the couple's story written: a new version of Jan's says the marriage in a sentence and shortens nothing
    await w.ok(["story", "set", "F1", "--text", "Jan a Marie se vzali roku 1875.", "--fact", "E0004"]);
    await w.ok(["task", "done", task.id, "--result", "napsáno"]);
    const jan = (await w.ok(["task", "add", "Doplnit vyprávění: Jan Lhoták", "--level", "narrate", "--priority", "1", "--where", "zapsané údaje", "--why", "rodinná kniha", "--done-when", "strom story set P1", "--about", "P1", "--json"])).json.task.id;
    const own = (await w.ok(["brief", jan])).out;
    assert.match(own, /F0001 with [^\n]*Marie Lhotáková[^\n]* has a story of its own \(strom story show F0001\): the marriage in one sentence pointing to it/u);
    assert.match(own, /never shortened because of a couple's story/u);
  } finally {
    w.cleanup();
  }
});
