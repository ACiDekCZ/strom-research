// /status of a large research: worked out on the bridge's thread of its own and kept for the state it was made for
// (core/livestatus.ts) — the bridge answers everything else meanwhile (found 2026-11-04: a research of ~470 tasks in
// the queue held the bridge seconds for each /status, and the app said the research does not answer); the parts that
// weigh each with its rev, asked only when it changed (feature status.parts).

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { World, hasGit, until } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import type { Task } from "../../src/core/model.ts";
import { widgetTree } from "../../src/core/widget.ts";

const opts = { skip: !hasGit || process.platform === "win32" };
const APP = "https://beta.stromapp.info";

type Info = { pid: number; port: number; token: string; url: string };

function get(url: string, method = "GET"): Promise<{ code: number; body: string; ms: number }> {
  const t = performance.now();
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method, agent: false, headers: { Origin: APP, ...(method === "OPTIONS" ? { "Access-Control-Request-Method": "GET" } : {}) } }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (c) => (body += c));
      res.on("end", () => resolve({ code: res.statusCode ?? 0, body, ms: performance.now() - t }));
    });
    req.on("error", reject);
    req.end();
  });
}

/** One ask, and a cheap one every few ms while it is answered: how long it took, and the longest a cheap one waited. */
async function meanwhile(info: Info, what: string): Promise<{ code: number; body: string; ms: number; longest: number }> {
  const probes: number[] = [];
  let done = false;
  const asked = get(`${info.url}${what}`).finally(() => (done = true));
  while (!done) {
    probes.push((await get(`${info.url}/status`, "OPTIONS")).ms);
    await new Promise((r) => setTimeout(r, 5));
  }
  return { ...(await asked), longest: Math.max(0, ...probes) };
}

/**
 * A research of thousands of tasks, hundreds waiting for the person: one open task and one waiting made by strom, each
 * copied under new IDs, written at once (as a research grown over months has them).
 */
async function largeResearch(w: World, open: number, waiting: number): Promise<void> {
  await w.ok(["person", "add", "Matěj /Lhoták/", "--sex", "M", "--born", "1850"]);
  await w.ok(["task", "add", "Křest Matěje Lhotáka", "--level", "locate", "--where", "Lhota", "--why", "a", "--done-when", "b", "--about", "P0001"]);
  await w.ok(["task", "add", "Dopis faře v Lhotě", "--level", "request", "--where", "Lhota", "--why", "a", "--done-when", "b", "--about", "P0001"]);
  await w.ok(["task", "wait", "T0002", "--on", "Poslat dopis faře."]);
  const tree = Tree.open(w.cwd, w.env);
  const made: Task[] = [];
  tree.withTreeLock(() => {
    for (const [from, what, count] of [["T0001", "Křest v Lhotě", open], ["T0002", "Dopis do Lhoty", waiting]] as const) {
      const { research: _none, ...plain } = tree.get<Task>(from)!;
      for (let i = 0; i < count; i++) made.push({ ...plain, id: tree.allocate("T"), what: `${what} ${i + 1}` });
    }
    tree.putMany(made, [], { op: "task.add", targets: made.map((t) => t.id), summary: `${made.length} tasks` });
  });
  tree.commit("tasks of months");
}

test("a large research's /status and its order kept are made off the bridge's thread: a cheap ask is answered meanwhile", opts, async () => {
  const w = new World();
  try {
    await w.withTree("Lhotákovi");
    await largeResearch(w, 3000, 300);
    const info = (await w.ok(["live", "start", "--json"], { env: { STROM_TIDY_FIRST_MS: "2000", STROM_WIDGET_CHECK_MS: "300" } })).json as Info;
    // the first /status of the bridge is made now (nothing kept yet): a cheap ask every few ms meanwhile
    const probes: number[] = [];
    let done = false;
    const asked = get(`${info.url}/status?poll=1`).finally(() => (done = true));
    while (!done) {
      probes.push((await get(`${info.url}/status`, "OPTIONS")).ms);
      await new Promise((r) => setTimeout(r, 5));
    }
    const status = await asked;
    assert.equal(status.code, 200);
    const said = JSON.parse(status.body) as { waiting: unknown[]; queueCounts: { next: number } };
    assert.ok(said.waiting.length >= 300, `what waits: ${said.waiting.length}`);
    assert.ok(said.queueCounts.next >= 3000, `the queue: ${said.queueCounts.next}`);
    // a budget, not fixed time: the cheap asks wait for no part of the making (held, the longest would be about all of it;
    // a computer busy with other work may stop a moment either way)
    const longest = Math.max(...probes);
    assert.ok(longest < status.ms * 0.75 || longest < 50, `a cheap ask waited ${Math.round(longest)} ms of /status's ${Math.round(status.ms)} ms`);
    // asked again with nothing changed: what was made, at once and the same
    const again = await get(`${info.url}/status?poll=1`);
    assert.equal(again.body, status.body);
    assert.ok(again.ms < status.ms / 2 || again.ms < 50, `kept: ${Math.round(again.ms)} ms, made: ${Math.round(status.ms)} ms`);
    // strom's fixes, asked by the app at each new head: found on a thread of their own too (they read every task, reading
    // and session: seconds on a large research, after each of its commits)
    const fixes = await meanwhile(info, "/fixes");
    assert.equal(fixes.code, 200);
    assert.ok(Array.isArray(JSON.parse(fixes.body).fixes), fixes.body.slice(0, 200));
    assert.ok(fixes.longest < fixes.ms * 0.75 || fixes.longest < 50, `a cheap ask waited ${Math.round(fixes.longest)} ms of /fixes's ${Math.round(fixes.ms)} ms`);
    // the history the app reads at each change (/log): its entries worked out on the thread of /status
    const history = await meanwhile(info, "/log");
    assert.equal(history.code, 200);
    assert.ok((JSON.parse(history.body) as { entries: unknown[] }).entries.length >= 1);
    assert.ok(history.longest < history.ms * 0.75 || history.longest < 50, `a cheap ask waited ${Math.round(history.longest)} ms of /log's ${Math.round(history.ms)} ms`);
    // the widget's overview of the research (macOS, Windows), looked at every 300 ms here: on a thread of its own too
    if (process.platform === "darwin") {
      const t = performance.now();
      assert.ok(widgetTree(w.cwd, w.env, { running: true }));
      const costs = performance.now() - t;
      const probes: number[] = [];
      for (const end = Date.now() + 3000; Date.now() < end; await new Promise((r) => setTimeout(r, 5))) probes.push((await get(`${info.url}/status`, "OPTIONS")).ms);
      const most = Math.max(...probes);
      assert.ok(most < costs * 0.75 || most < 50, `a cheap ask waited ${Math.round(most)} ms, the widget's overview takes ${Math.round(costs)} ms`);
    }
    // the order kept once a day (its summary of the reading of scans reads every task and session: ~11 s on a research
    // of 5 000 tasks, the bridge answering nothing meanwhile) on a thread of its own too
    const log = () => fs.readFileSync(path.join(w.cwd, ".strom", "live.log"), "utf8");
    await until("kept in order", () => /kept in order on its thread \(\d+ ms\)/u.test(log()), { ms: 30_000 });
  } finally {
    await w.run(["live", "stop"]);
    w.cleanup();
  }
});

test("/status?parts=1 leaves out the parts that weigh, says their revs; GET /status/<part> gives each; a commit changes only what it changed", opts, async () => {
  const w = new World();
  try {
    await w.withTree("Lhotákovi");
    await largeResearch(w, 50, 20);
    const info = (await w.ok(["live", "start", "--json"])).json as Info;
    const json = async (url: string) => {
      const r = await get(url);
      assert.equal(r.code, 200, `${url}: ${r.body}`);
      return JSON.parse(r.body) as Record<string, any>;
    };
    const full = await json(`${info.url}/status`);
    assert.ok(full.features.includes("status.parts"));
    const lite = await json(`${info.url}/status?poll=1&parts=1`);
    for (const f of ["waiting", "queue", "queueMore", "queueCounts", "offLine", "researches"]) assert.equal(lite[f], undefined, f);
    assert.equal(lite.head, full.head);
    assert.deepEqual(Object.keys(lite.parts).sort(), ["offLine", "queue", "researches", "waiting"]);
    for (const rev of Object.values(lite.parts)) assert.match(rev as string, /^[0-9a-f]{16}$/u);
    // each part as the whole /status carries it, with the rev the light one said
    const waiting = await json(`${info.url}/status/waiting`);
    assert.equal(waiting.rev, lite.parts.waiting);
    assert.deepEqual(waiting.waiting, full.waiting);
    const queue = await json(`${info.url}/status/queue`);
    assert.equal(queue.rev, lite.parts.queue);
    assert.deepEqual([queue.queue, queue.queueMore, queue.queueCounts], [full.queue, full.queueMore, full.queueCounts]);
    const none = await get(`${info.url}/status/nothing`);
    assert.equal(none.code, 404);
    assert.equal(JSON.parse(none.body).code, "status.part");
    // a new task in the queue: a new head, the queue's rev another, what waits the same
    await w.ok(["task", "add", "Oddavky v Lhotě", "--level", "locate", "--where", "Lhota", "--why", "a", "--done-when", "b", "--about", "P0001", "--priority", "5"]);
    // (an ask while the new state is made may be answered the one before, at most a moment: asked until it comes)
    let after: Record<string, any> = lite;
    await until("the new commit in /status", async () => (after = await json(`${info.url}/status?poll=1&parts=1`)).head !== lite.head);
    assert.notEqual(after.parts.queue, lite.parts.queue);
    assert.equal(after.parts.waiting, lite.parts.waiting);
  } finally {
    await w.run(["live", "stop"]);
    w.cleanup();
  }
});
