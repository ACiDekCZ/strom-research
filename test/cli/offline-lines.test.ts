// Work off the lines (spec 036, 038 K7): in a research of several lines, a task about a side branch none of them reaches
// comes now and then, else after the lines' work — unless it helps a line (a hypothesis of the line, joining people to
// a person of a line or their partner, the agent's --helps); queue.offLine occasional (default) / last / normal (as before) / never. Judged afresh,
// nothing written.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { World, hasGit } from "../helpers.ts";

const opts = { skip: !hasGit };

/**
 * Two lines: the ancestors of Jan Lhoták (G0001: Jan P1, his parents Josef P2 and Marie P3, Josef's father Václav P5)
 * and the ancestors of Marie (G0002). Josef's sister Anna (P4) and her husband Karel (P6): a side branch, of no line.
 */
async function world(lines = 2): Promise<World> {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["lang", "cs"]);
  await w.ok(["research", "new", "Předci Jana", "--new-person", "Jan /Lhoták/", "--sex", "M"]);
  await w.ok(["person", "add", "Josef /Lhoták/", "--sex", "M"]); // P2
  await w.ok(["person", "add", "Marie /Lhotová/", "--sex", "F"]); // P3
  await w.ok(["person", "add", "Anna /Lhotáková/", "--sex", "F"]); // P4
  await w.ok(["person", "add", "Václav /Lhoták/", "--sex", "M"]); // P5
  await w.ok(["person", "add", "Karel /Lhotský/", "--sex", "M"]); // P6
  await w.ok(["family", "add", "--partner", "P2", "--partner", "P3", "--child", "P1"]);
  await w.ok(["family", "add", "--partner", "P5", "--child", "P2", "--child", "P4"]);
  await w.ok(["family", "add", "--partner", "P4", "--partner", "P6"]);
  if (lines > 1) await w.ok(["research", "new", "Předci Marie", "--person", "P3"]);
  return w;
}

const task = (w: World, what: string, about: string[], ...more: string[]) =>
  w.ok(["task", "add", what, "--level", "locate", "--where", "katalog archivu Lhota", "--why", "rodiče", "--done-when", "kniha nalezena", ...about.flatMap((a) => ["--about", a]), "--json", ...more]);
const queue = async (w: World, ...more: string[]) => ((await w.ok(["task", "list", "--json", ...more])).json.tasks as { id: string; why: string; offLine?: string; helps?: { by: string; research?: string } }[]);
const order = async (w: World, ...more: string[]) => (await queue(w, ...more)).map((t) => t.id);

test("off the lines: a side branch comes after the lines' work — whatever its priority; normal as before; never not taken", opts, async () => {
  const w = await world();
  const line = (await task(w, "Křest Josefa", ["P2"])).json; // T1, p3, line G0001
  assert.equal(line.task.research, "G0001");
  assert.equal(line.offLine, undefined);
  const side = await task(w, "Oddavky Anny", ["P4"], "--priority", "5"); // T2, p5, no line
  assert.equal(side.json.task.research, undefined);
  assert.equal(side.json.offLine, "occasional");
  assert.equal(side.json.branch, "B-P0004");
  assert.match((await w.ok(["task", "edit", "T2", "--priority", "5", "--helps", ""])).out, /T0002 is off the lines \(branch B-P0004\): .* it comes now and then, one in 10 sessions, else after the lines' work \(queue\.offLine occasional\)\. If it helps a line .* strom task edit T0002 --helps "<how it helps G…>"/);
  assert.deepEqual(await order(w), ["T0001", "T0002"], "after the lines' work, though p5");
  const off = (await queue(w))[1]!;
  assert.equal(off.offLine, "occasional");
  assert.match(off.why, /^off the lines \(branch B-P0004\), helping none: after the lines' work, one in 10 sessions/);
  // last: the same order, said so
  await w.ok(["config", "set", "queue.offLine", "last", "--for-tree"]);
  assert.deepEqual(await order(w), ["T0001", "T0002"]);
  assert.equal((await queue(w))[1]!.offLine, "last");
  await w.ok(["config", "unset", "queue.offLine", "--for-tree"]);
  // the lines' work done: the side branch is next
  await w.ok(["task", "drop", "T1", "--reason", "nalezeno jinde"]);
  const next = await w.ok(["task", "next", "--json"]);
  assert.equal(next.json.task.id, "T0002");
  assert.equal(next.json.offLine, "occasional");
  assert.deepEqual(next.json.reason, { kind: "off", mode: "occasional", branch: "B-P0004" });
  await w.ok(["task", "add", "Křest Marie", "--level", "locate", "--where", "Lhota", "--why", "a", "--done-when", "b", "--about", "P3"]); // T3, p3
  // normal: by priority, as before
  await w.ok(["config", "set", "queue.offLine", "normal", "--for-tree"]);
  assert.deepEqual(await order(w), ["T0002", "T0003"]);
  assert.equal((await queue(w))[0]!.offLine, undefined);
  assert.equal((await w.ok(["config", "get", "queue.offLine", "--json"])).json.value, "normal");
  // never: not taken; the strategy does not matter
  await w.ok(["config", "set", "queue.offLine", "never", "--for-tree"]);
  for (const strategy of ["balanced", "depth", "priority"]) {
    await w.ok(["config", "set", "queue.strategy", strategy, "--for-tree"]);
    assert.deepEqual(await order(w), ["T0003"], strategy);
  }
  assert.match((await w.ok(["task", "list"])).out, /1 more off the lines are not taken \(queue\.offLine never or their branch's/);
  // a session at work on it goes on
  await w.ok(["session", "start", "T2"]);
  assert.deepEqual(await order(w), ["T0002", "T0003"]);
  await w.ok(["session", "close", "--continue", "--summary", "nic", "--next", "dál"]);
  assert.deepEqual(await order(w), ["T0003"]);
  // occasional again (the default): its session just ended, so every strategy puts it after the lines' work
  await w.ok(["config", "unset", "queue.offLine", "--for-tree"]);
  for (const strategy of ["balanced", "depth", "priority"]) {
    await w.ok(["config", "set", "queue.strategy", strategy, "--for-tree"]);
    assert.deepEqual(await order(w), ["T0003", "T0002"], strategy);
  }
  w.cleanup();
});

test("off the lines: a research with one line defers nothing", opts, async () => {
  const w = await world(1);
  await task(w, "Křest Josefa", ["P2"]);
  const side = await task(w, "Oddavky Anny", ["P4"], "--priority", "5");
  assert.equal(side.json.offLine, undefined);
  assert.doesNotMatch((await w.ok(["task", "edit", "T2", "--helps", ""])).out, /off the lines/);
  assert.deepEqual(await order(w), ["T0002", "T0001"]);
  assert.ok((await queue(w)).every((t) => !t.offLine && !t.helps));
  // its brief says nothing of the lines
  assert.doesNotMatch((await w.ok(["brief", "T1"])).out, /a task none of whose people is in a line \(a side branch\): only with --helps/);
  w.cleanup();
});

test("helps a line: a hypothesis of the line, joining people to the tree, the agent's word — with that line in the queue and --research", opts, async () => {
  const w = await world();
  await w.ok(["config", "set", "queue.strategy", "priority", "--for-tree"]);
  await task(w, "Křest Josefa", ["P2"], "--priority", "2"); // T1, line G0001, p2
  // a) a hypothesis of the line named in the task's words
  await w.ok(["hypothesis", "add", "Byla Anna kmotrou Josefových dětí?", "--about", "P2", "--variant", "A: ano", "--variant", "B: ne"]);
  const a = (await w.ok(["task", "add", "Křty dětí Anny", "--level", "locate", "--where", "Lhota", "--why", "rozhodne H0001", "--done-when", "b", "--about", "P4", "--priority", "5", "--json"])).json;
  assert.deepEqual(a.helps, { by: "question", research: "G0001" });
  assert.equal(a.task.helps, undefined, "nothing written: judged from the tree");
  // b) people nothing links to the tree joined to a line — to the partner of its person (Václav's second wife)
  await w.ok(["person", "add", "Tomáš /Lhoták/", "--sex", "M"]); // P7, linked to nobody
  await w.ok(["person", "add", "Ludmila /Lhotská/", "--sex", "F"]); // P8
  await w.ok(["family", "add", "--partner", "P5", "--partner", "P8"]);
  const b = (await task(w, "Je Tomáš synem Ludmily?", ["P7", "P8"], "--priority", "4")).json;
  assert.deepEqual(b.helps, { by: "joins", research: "G0001" });
  // c) the agent's word, the line named by its ID (any script around it)
  const c = await task(w, "Karel jako svědek", ["P6"], "--helps", "Karel svědkem na oddavkách předků linie G0002", "--priority", "3");
  assert.equal(c.json.task.helps, "Karel svědkem na oddavkách předků linie G0002", "kept on the task");
  assert.deepEqual(c.json.helps, { by: "agent", research: "G0002" });
  assert.doesNotMatch(c.out, /off the lines/);
  // the agent's word without a line named: the nearest line by family links (Anna's father is Václav of G0001)
  const d = await task(w, "Anna jako kmotra", ["P4"], "--helps", "Ａnna kmotrou dětí předka, NFD: Ánna", "--priority", "1");
  assert.deepEqual(d.json.helps, { by: "agent", research: "G0001" });
  // none of them waits: the queue by the lines' order of work, then priority, each with its line
  const q = await queue(w);
  assert.deepEqual(q.map((t) => t.id), ["T0002", "T0003", "T0001", "T0005", "T0004"]);
  assert.ok(q.every((t) => !t.offLine));
  assert.match(q[4]!.why, /helps G0002: the agent's reason \(--helps\)/);
  // one line's work: its own and what helps it — never another line's, never work off the lines
  assert.deepEqual((await order(w, "--research", "G0002")).sort(), ["T0004"]);
  assert.deepEqual((await order(w, "--research", "G0001")).sort(), ["T0001", "T0002", "T0003", "T0005"]);
  // the word taken back: off the lines again, to the end
  const e = await w.ok(["task", "edit", "T5", "--helps", "", "--json"]);
  assert.equal(e.json.task.helps, undefined);
  assert.equal(e.json.offLine, "occasional");
  assert.deepEqual((await order(w)).at(-1), "T0005");
  assert.ok(!(await order(w, "--research", "G0001")).includes("T0005"));
  await w.ok(["task", "edit", "T5", "--helps", "kmotra předka G0001"]);
  assert.equal((await w.ok(["task", "show", "T5", "--json"])).json.task.helps, "kmotra předka G0001");
  // the menu's directions count what helps them
  const menu = await w.ok([], { tty: true, answers: ["4", "5", "", "0"] });
  assert.match(menu.out, /Předci Jana – běží · úkoly: 4\n +2 {2}Předci Marie – běží · úkoly: 1/);
  assert.match((await w.ok(["check"])).out, /^ok/);
  w.cleanup();
});

test("joining people off the tree to a side branch helps no line: the task is that branch's (spec 036 K1.7)", opts, async () => {
  const w = await world();
  await w.ok(["config", "set", "queue.offLine", "last", "--for-tree"]);
  await task(w, "Křest Josefa", ["P2"]); // T1, line G0001
  await w.ok(["person", "add", "Tomáš /Lhoták/", "--sex", "M"]); // P7, linked to nobody
  await w.ok(["person", "add", "Ludmila /Lhotská/", "--sex", "F"]); // P8
  await w.ok(["family", "add", "--partner", "P5", "--partner", "P8"]); // Václav's second wife: the partner of a person of G0001
  // joined to Anna, an ancestor's sister: off the lines, in her branch, after the lines' work
  const toSister = await task(w, "Je Tomáš synem Anny?", ["P7", "P4"], "--priority", "5"); // T2
  assert.equal(toSister.json.helps, undefined);
  assert.equal(toSister.json.offLine, "last");
  assert.equal(toSister.json.branch, "B-P0004");
  // the same through a hypothesis named on the task: the person off the tree and the hypothesis that would join them
  await w.ok(["hypothesis", "add", "Je P0007 synem P0004?", "--about", "P7", "--about", "P4", "--variant", "A: syn P0004", "--variant", "B: jiná rodina"]); // H1
  const viaHypothesis = await task(w, "Svatba Tomáše, přečíst vlastním okem", ["P7", "H0001"], "--priority", "5"); // T3
  assert.equal(viaHypothesis.json.helps, undefined);
  assert.equal(viaHypothesis.json.branch, "B-P0004");
  // joined to Karel, married to the sister: her branch too
  const toHusband = await task(w, "Je Tomáš synem Karla?", ["P7", "P6"], "--priority", "5"); // T4
  assert.equal(toHusband.json.branch, "B-P0004");
  assert.equal(toHusband.json.helps, undefined);
  // joined to the partner of a person of the line: helps that line, goes with it
  const toPartner = (await task(w, "Je Tomáš synem Ludmily?", ["P7", "P8"], "--priority", "1")).json; // T5
  assert.deepEqual(toPartner.helps, { by: "joins", research: "G0001" });
  // joined to a person of the line through a hypothesis of the line: the line's own work, as before
  await w.ok(["hypothesis", "add", "Je P0007 synem P0002?", "--about", "P7", "--about", "P2", "--variant", "A: syn P0002", "--variant", "B: jiná rodina"]); // H2
  const toLine = (await task(w, "Křest Tomáše", ["P7", "H0002"], "--priority", "1")).json; // T6
  assert.equal(toLine.task.research, "G0001");
  assert.equal(toLine.offLine, undefined);
  // the sister's own task: off the lines, unchanged
  const sister = (await task(w, "Oddavky Anny", ["P4"], "--priority", "5")).json; // T7
  assert.equal(sister.branch, "B-P0004");
  // joined to the sister, but the agent says how it helps the line (a godparent of the ancestor): its word holds (c)
  const said = (await task(w, "Je Tomáš synem Anny? Kmotr Josefových dětí", ["P7", "P4"], "--helps", "Tomáš kmotrem dětí předka P2", "--priority", "5")).json; // T8
  assert.deepEqual(said.helps, { by: "agent", research: "G0001" });
  assert.equal(said.offLine, undefined);
  assert.equal(sister.branch, "B-P0004");
  assert.equal(sister.offLine, "last");
  // the queue: the lines' work and what helps them, then the branch, as queue.offLine last says
  const q = await queue(w);
  assert.deepEqual(q.slice(0, 4).map((t) => t.id).sort(), ["T0001", "T0005", "T0006", "T0008"]);
  assert.deepEqual(q.slice(4).map((t) => t.id), ["T0002", "T0003", "T0004", "T0007"]);
  assert.match(q.find((t) => t.id === "T0002")!.why, /^off the lines \(branch B-P0004\), helping none: after the lines' work \(offLine last/);
  assert.deepEqual((await order(w, "--research", "G0001")).sort(), ["T0001", "T0005", "T0006", "T0008"]);
  // the branch added to a line by the person: its joining tasks help that line
  await w.ok(["offline", "set", "B-P0004", "--line", "G0002"]);
  const added = await queue(w);
  for (const id of ["T0002", "T0003", "T0004", "T0007"]) assert.deepEqual(added.find((t) => t.id === id)!.helps, { by: "branch", research: "G0002" }, id);
  await w.ok(["offline", "set", "B-P0004", "--default"]);
  // a session already at work on one goes on (K1.3): never taken, but in progress first
  await w.ok(["config", "set", "queue.offLine", "never", "--for-tree"]);
  await w.ok(["session", "start", "T2"]);
  assert.equal((await order(w))[0], "T0002");
  await w.ok(["session", "close", "--continue", "--summary", "nic", "--next", "dál"]);
  assert.ok(!(await order(w)).includes("T0002"), "not taken once its session ended");
  assert.match((await w.ok(["check"])).out, /^ok/);
  w.cleanup();
});

test("off the lines in the overviews: strom plan says it waits at the end, the brief and the guide give the rule, the menu sets it", opts, async () => {
  const w = await world();
  await task(w, "Křest Josefa", ["P2"]);
  await task(w, "Oddavky Anny", ["P4"], "--priority", "5");
  const plan = await w.ok(["plan", "--json"]);
  assert.deepEqual(plan.json.tasks.map((t: { id: string; offLine?: string }) => [t.id, t.offLine]), [["T0001", undefined], ["T0002", "occasional"]]);
  assert.match((await w.ok(["plan"])).out, /2\. +Oddavky Anny \(mimo linie: až po práci na liniích\)/);
  // the brief of a research of several lines: a task off them only with --helps
  assert.match((await w.ok(["brief", "T1"])).out, /a task none of whose people is in a line \(a side branch\): only with --helps "<how it helps G…>"/);
  assert.match((await w.ok(["guide"])).out, /--helps "<how it helps G…>"/);
  // joining people to a side branch helps no line; what work there finds about an ancestor goes to that person of the line (K1.4, K1.7)
  assert.match((await w.ok(["brief", "T1"])).out, /joining people to a side branch helps no line; what work on a side branch finds about an ancestor goes to that person of the line: an argument or a task about them \(--about P…\)/);
  assert.match((await w.ok(["guide"])).out, /joining them to a side branch does not\. What work on a side branch\s+finds about an ancestor goes to that person of the line/);
  // the menu: settings → the agent working alone → work off the lines: never
  const set = await w.ok([], { tty: true, answers: ["8", "2", "6", "1", "4", "0", "0", "0", "0"] });
  assert.match(set.out, /Práce mimo linie: občas, jednou za čas/);
  assert.match(set.out, /Mimo linie: práce na vedlejší větvi/);
  assert.match(set.out, /1 {2}občas, jednou za čas – [^\n]*\n +2 {2}na konci, až po liniích – [^\n]*\n +3 {2}normálně, jako práce linií – [^\n]*\n +4 {2}nikdy – /);
  assert.equal((await w.ok(["config", "get", "queue.offLine", "--json"])).json.value, "never");
  assert.match((await w.ok(["plan"])).out, /Mimo linie, nebere se: 1 \(nastavení queue\.offLine\)/);
  assert.deepEqual((await w.ok(["plan", "--json"])).json.tasks.map((t: { id: string }) => t.id), ["T0001"]);
  w.cleanup();
});

test("the Strom app: a queue item off the lines says when it comes, one that helps a line goes with it; feature tasks.offLine", { skip: !hasGit || process.platform === "win32" }, async () => {
  const w = await world();
  await task(w, "Křest Josefa", ["P2"]);
  await task(w, "Oddavky Anny", ["P4"], "--priority", "5");
  await task(w, "Karel jako svědek", ["P6"], "--helps", "svědek na oddavkách G0002");
  const info = (await w.ok(["live", "start", "--json"])).json;
  try {
    const get = async () => (await (await fetch(`${info.url}/status`)).json()) as { features: string[]; researches: { id: string; tasks: number }[]; queue: { id: string; research?: string; offLine?: string; helps?: string }[] };
    const status = await get();
    assert.ok(status.features.includes("tasks.offLine"));
    assert.deepEqual(
      status.queue.map((q) => [q.id, q.research, q.offLine, q.helps]),
      [
        ["T0001", "G0001", undefined, undefined],
        ["T0003", "G0002", undefined, "agent"],
        ["T0002", undefined, "occasional", undefined],
      ],
    );
    assert.deepEqual(status.researches.map((r) => [r.id, r.tasks]), [["G0001", 1], ["G0002", 1]]);
    await w.ok(["config", "set", "queue.offLine", "normal", "--for-tree"]);
    assert.ok((await get()).queue.every((q) => !q.offLine), "normal: nothing said");
    // the task at work says why it stands with a line, as the queue does (spec 036 K1.8; feature working.helps)
    assert.ok(status.features.includes("working.helps"));
    await w.ok(["person", "add", "Tomáš /Lhoták/", "--sex", "M"]); // P7, linked to nobody
    await w.ok(["person", "add", "Ludmila /Lhotská/", "--sex", "F"]); // P8
    await w.ok(["family", "add", "--partner", "P5", "--partner", "P8"]);
    await task(w, "Je Tomáš synem Ludmily?", ["P7", "P8"]); // T4: joins him to the partner of a person of G0001
    const { enterWorker } = await import("../../src/core/workers.ts");
    const leave = enterWorker(w.cwd, "run-t", "Claude Code on its own");
    w.env.STROM_WORKER = "run-t";
    type At = { research?: string; helps?: string; branch?: string };
    const at = async () => ((await (await fetch(`${info.url}/status`)).json()) as { working: At[] }).working.map((x) => [x.research, x.helps, x.branch]);
    try {
      for (const [id, want] of [
        ["T4", [["G0001", "joins", undefined]]],
        ["T3", [["G0002", "agent", undefined]]],
        ["T2", [[undefined, undefined, "B-P0004"]]],
        ["T1", [["G0001", undefined, undefined]]],
      ] as const) {
        await w.ok(["session", "start", id]);
        assert.deepEqual(await at(), want, id);
        await w.ok(["session", "close", "--summary", "nic", "--next", "dál", "--continue"]);
      }
    } finally {
      delete w.env.STROM_WORKER;
      leave();
    }
  } finally {
    await w.ok(["live", "stop"]);
  }
  w.cleanup();
});

test("after an update: tasks written before are ordered by the default at once — nothing written, line and helping work in their order", opts, async () => {
  const w = await world();
  await w.ok(["config", "set", "queue.strategy", "priority", "--for-tree"]);
  // the tasks as an older strom wrote them (no --helps then): a line's, a side branch's, one of a hypothesis of the line
  await w.ok(["hypothesis", "add", "Byla Anna kmotrou?", "--about", "P2", "--variant", "A: ano", "--variant", "B: ne"]);
  await task(w, "Oddavky Anny", ["P4"], "--priority", "5"); // T1 off the lines
  await task(w, "Křest Josefa", ["P2"], "--priority", "2"); // T2 line
  await w.ok(["task", "add", "Křty dětí Anny", "--level", "locate", "--where", "Lhota", "--why", "rozhodne H0001", "--done-when", "b", "--about", "P4", "--priority", "4"]); // T3 helps
  await task(w, "Rodina Karla", ["P6"], "--priority", "1"); // T4 off the lines
  await w.ok(["task", "add", "Křest Marie", "--level", "locate", "--where", "Lhota", "--why", "a", "--done-when", "b", "--about", "P3", "--priority", "3"]); // T5 line
  // the order before (as an older strom ranked them)
  await w.ok(["config", "set", "queue.offLine", "normal"]);
  const before = await order(w);
  assert.deepEqual(before, ["T0003", "T0002", "T0005", "T0001", "T0004"]);
  await w.ok(["config", "unset", "queue.offLine"]);
  const git = (...args: string[]) => spawnSync("git", args, { cwd: w.cwd, encoding: "utf8" }).stdout;
  const head = git("rev-parse", "HEAD");
  const ops = fs.readdirSync(path.join(w.cwd, "data"), { recursive: true }).length;
  // after: the side branches at the end, the line's and the helping work in the order they had
  const after = await order(w);
  assert.deepEqual(after, ["T0003", "T0002", "T0005", "T0001", "T0004"]);
  assert.deepEqual(after.filter((id) => !["T0001", "T0004"].includes(id)), before.filter((id) => !["T0001", "T0004"].includes(id)));
  await w.ok(["task", "next"]);
  await w.ok(["plan"]);
  // nothing in the data written by reading
  assert.equal(git("rev-parse", "HEAD"), head);
  assert.equal(git("status", "--porcelain", "data"), "");
  assert.equal(fs.readdirSync(path.join(w.cwd, "data"), { recursive: true }).length, ops);
  assert.match((await w.ok(["check"])).out, /^ok/);
  w.cleanup();
});
