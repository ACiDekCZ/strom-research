// The menu's count of what waits (core/waitkept.ts, cli/menu-waiting.ts waitingCount): kept beside the research with a
// stamp of all it is counted from, so the menu of a long research shows at once (found on a Mac, 781 people and 29 000
// scans: six seconds before the menu, two at each return to it) — read again with no record while nothing changed,
// however long the research grows; counted again once something it stands on changes; What waits counts exactly and
// keeps what it counted.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import { create } from "../../src/core/records.ts";
import { Context } from "../../src/cli/context.ts";
import { waitingCount } from "../../src/cli/menu-waiting.ts";
import { startTiming, stopTiming, timed, timingReport } from "../../src/core/timing.ts";
import type { Person, Task } from "../../src/core/model.ts";

const opts = { skip: !hasGit };

/** The count the menu shows, and the reads of the disk it took (in this process: the research as a strom reads it). */
function counted(w: World): { all: number; reads: number } {
  const ctx = Context.fromOptions({ env: w.env, cwd: w.cwd, io: { stdout: () => {}, stderr: () => {}, tty: false }, json: false, values: {} });
  const tree = Tree.open(w.cwd, w.env);
  startTiming();
  try {
    const count = timed("count", () => waitingCount(ctx, tree));
    const calls = timingReport().steps.find((s) => s.label === "count")?.calls ?? {};
    return { all: count.all, reads: (calls.openSync ?? 0) + (calls.readFileSync ?? 0) };
  } finally {
    stopTiming();
  }
}

const menuCount = async (w: World, answers = ["0"]) => (await w.ok([], { tty: true, answers })).out.match(/Čeká: (\d+)/)?.[1];

test("the menu's count of what waits: kept beside the research, read with no record while nothing changed — however long the research; a change counted again; What waits keeps what it counted", opts, async () => {
  const w = new World();
  try {
    await w.withTree("Lhotákovi");
    w.historyAsked();
    await w.ok(["research", "new", "Předci Lhotáka", "--new-person", "Jan /Lhoták/", "--sex", "M", "--born", "1890"]);
    const waiting = async (what: string) => {
      const id = (await w.ok(["task", "add", what, "--level", "request", "--where", "farnost Lhota", "--why", "rodiče", "--done-when", "odpověď", "--about", "P1", "--anyway", "--json"])).json.task.id;
      await w.ok(["task", "wait", id, "--kind", "family", "--on", "Vzpomínky rodiny."]);
    };
    await waiting("Vzpomínky Lhotákových");
    await waiting("Fotografie Lhotákových");
    assert.equal(await menuCount(w), "2");
    const file = path.join(w.cwd, ".strom", "cache", "waiting.json");
    assert.ok(fs.existsSync(file), "the count kept beside the research");
    const small = counted(w);
    assert.equal(small.all, 2);

    // the research grows long: hundreds of people and tasks — the count is made again once (its commit changed), then
    // read as before, with as few reads of the disk
    const tree = Tree.open(w.cwd, w.env);
    for (let i = 0; i < 300; i++) {
      const p = create<Person>(tree, "person", { names: [{ given: `Václav ${i}`, surname: "Lhoták" }], sex: "M", events: [], notes: [] } as never, (id) => `${id} added`);
      create<Task>(tree, "task", { level: "locate", priority: 3, what: `Křest ${p.id}`, where: ["farnost Lhota"], why: "rodiče", doneWhen: "zápis", subject: [p.id], state: "open", origin: "agent", notes: [] } as never, (id) => `${id} added`);
    }
    tree.commit("a long research");
    assert.equal(await menuCount(w), "2");
    const big = counted(w);
    assert.equal(big.all, 2);
    assert.ok(big.reads <= small.reads + 2 && big.reads < 40, `the kept count reads no record: ${small.reads} reads then, ${big.reads} now`);

    // what it stands on changes — a task more waits: counted again
    await waiting("Dopisy Lhotákových");
    assert.equal(await menuCount(w), "3");
    // the menu takes the kept count as it is (a count put wrong into it is shown) …
    const wrong = () => {
      const kept = JSON.parse(fs.readFileSync(file, "utf8"));
      fs.writeFileSync(file, JSON.stringify({ ...kept, count: { ...kept.count, all: 99 } }) + "\n");
    };
    wrong();
    assert.equal(await menuCount(w), "99");
    // … and What waits counts exactly and keeps it: the menu after it shows what What waits counted
    const out = (await w.ok([], { tty: true, answers: ["3", "0", "0"] })).out;
    assert.deepEqual([...out.matchAll(/Čeká: (\d+)/g)].map((m) => m[1]), ["99", "3"]);
    assert.equal(JSON.parse(fs.readFileSync(file, "utf8")).count.all, 3);

    // an answer the person gave to strom's questions, a send of the Strom app: the stamp changes with them
    for (const dir of [path.join(w.cwd, ".strom", "tune"), path.join(w.cwd, ".strom", "sync")]) {
      assert.equal(await menuCount(w), "3");
      wrong();
      assert.equal(await menuCount(w), "99");
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, "zkouška.json"), "{}\n");
      assert.equal(await menuCount(w), "3", `${path.basename(dir)}: counted again`);
      fs.rmSync(path.join(dir, "zkouška.json"));
    }
  } finally {
    w.cleanup();
  }
});
