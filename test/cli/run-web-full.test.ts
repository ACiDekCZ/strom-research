// strom run never starts a session on a task whose work goes to a site through the agent's web tools while that site's
// pages for this computer are used up (web.perHost within run.minutes, every session here): found in a live run — the
// next session on the same archive was refused its first page and tried it 116 times. Another task is taken; none left,
// a run that goes on by itself waits for the site (no agent, nothing sent), any other ends saying when. A connector
// the direct way keeps the task in the queue (strom fetch has its own limiter); a save through the agent's browser waiting
// on the site holds it as well.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";
import { clockUp } from "../../src/core/net.ts";
import { Tree } from "../../src/core/tree.ts";
import { fullWebSites, runWebFree, webFullOfTask } from "../../src/core/webfull.ts";
import type { Connector } from "../../src/core/connector.ts";
import type { Task } from "../../src/core/model.ts";

const opts = { skip: !hasGit };
const agent = path.join(import.meta.dirname, "..", "fixtures", "agent.ts");
const SITE = "matriky-lhota.org";
const PER_HOST = 6;

/** A research with a task on SITE (T0001, first by its priority) and, unless `alone`, one on another site (T0002). */
async function research(alone = false) {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["config", "set", "web.perHost", String(PER_HOST)]);
  await w.ok(["research", "new", "Předci Jana Lhotáka", "--new-person", "Jan /Lhoták/", "--sex", "M", "--born", "ABT 1790", "--born-place", "Lhota"]);
  await w.ok(["recordset", "add", "Lhota N 1784–1820", "--kinds", "baptism", "--url", `https://www.${SITE}/kniha/5359`]); // B0001
  await w.ok(["task", "add", "Křest Jana Lhotáka", "--level", "locate", "--where", "B1", "--why", "rodiče", "--done-when", "zápis", "--about", "P1", "--priority", "5"]);
  if (!alone) {
    await w.ok(["recordset", "add", "Lhota O 1784–1820", "--kinds", "marriage", "--url", "https://archiv-lhota.example/book/77"]); // B0002
    await w.ok(["task", "add", "Sňatek rodičů Jana Lhotáka", "--level", "locate", "--where", "B2", "--why", "rodiče", "--done-when", "zápis", "--about", "P1", "--priority", "1"]);
  }
  Object.assign(w.env, { STROM_RUNNER_SCRIPT: agent, AGENT_MODE: "echo" });
  return w;
}

/**
 * The time a run says, rounded up to the minute: strom run reads its own clock between `before` and `after`, so a date
 * before it (the time on another day than now) is said as by either — never a real midnight making the test fail.
 */
function saidAt(ms: number, before: number, after: number): string[] {
  return [...new Set([clockUp(ms, before), clockUp(ms, after)])];
}

/** The site's pages of other sessions here: `n` of them, the oldest leaving the window (run.minutes, 60) in `leaveMs`. */
function pagesHere(w: World, n: number, leaveMs: number): number[] {
  const file = path.join(w.home, "shared", "net", `site~${SITE}.web.json`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const first = Date.now() - 60 * 60_000 + leaveMs;
  const ats = Array.from({ length: n }, (_, i) => first + i * 1000);
  fs.writeFileSync(file, JSON.stringify({ requests: ats.map((at) => ({ at, who: "N0999" })) }));
  return ats;
}

test("strom run: the task on a site whose pages are used up here is left for now, another taken", opts, async () => {
  const w = await research();
  try {
    assert.equal((await w.ok(["task", "next", "--json"])).json.task.id, "T0001", "first by its priority");
    const ats = pagesHere(w, PER_HOST, 40 * 60_000);
    const before = Date.now();
    const r = await w.ok(["run", "--agent", "script", "--json"]);
    const after = Date.now();
    assert.equal(r.json.sessions.length, 1, r.out);
    assert.equal(r.json.sessions[0].task, "T0002");
    // enough free once a third of web.perHost leaves the window
    const ats2 = saidAt(ats[runWebFree(PER_HOST) - 1]! + 60 * 60_000, before, after);
    assert.ok(ats2.some((at) => (r.out + r.err).includes(`T0001 zatím vynechán: stránky ${SITE} jsou pro tento počítač vyčerpané do ${at}`)), r.out + r.err);
  } finally {
    w.cleanup();
  }
});

test("strom run: only work on a used-up site — one run ends saying when, no session; --loop waits for it, then the session", opts, async () => {
  const w = await research(true);
  try {
    const ats = pagesHere(w, PER_HOST, 40 * 60_000);
    const before = Date.now();
    const one = await w.ok(["run", "--agent", "script", "--json"]);
    const after = Date.now();
    assert.equal(one.json.sessions.length, 0, "no session spent on being refused");
    assert.equal(one.json.stop, "web");
    const said = saidAt(ats[runWebFree(PER_HOST) - 1]! + 60 * 60_000, before, after)
      .map((at) => `do ${at} není co dělat – zbylé úkoly potřebují stránky ${SITE}, jejichž limit pro tento počítač je vyčerpaný`);
    assert.ok(said.includes(one.json.stopped), one.json.stopped);
    // not an error to the app: nothing to do until then, as a run asleep (.end.json and the bridge's runsEnded[])
    const ends = fs.readdirSync(path.join(w.cwd, ".strom", "runs")).filter((f) => f.endsWith(".end.json"));
    assert.equal(ends.length, 1, ends.join(", "));
    const end = JSON.parse(fs.readFileSync(path.join(w.cwd, ".strom", "runs", ends[0]!), "utf8"));
    assert.equal(end.stopCode, "web");
    assert.equal(end.why, "done");
    // --loop: waits until enough of the site's pages leave the window (a few seconds here), then the session on it
    const soon = pagesHere(w, PER_HOST, 2500);
    const t0 = Date.now();
    const loop = await w.ok(["run", "--agent", "script", "--loop", "--max", "1", "--json"]);
    assert.ok(Date.now() >= soon[runWebFree(PER_HOST) - 1]! + 60 * 60_000, "not before the time");
    assert.ok(Date.now() - t0 < 60_000);
    assert.equal(loop.json.sessions.length, 1, loop.out);
    assert.equal(loop.json.sessions[0].task, "T0001");
    assert.ok(!fs.existsSync(path.join(w.cwd, ".strom", "workers")) || !fs.readdirSync(path.join(w.cwd, ".strom", "workers")).some((f) => f.endsWith(".paused")), "no pause left behind");
  } finally {
    w.cleanup();
  }
});

test("a used-up site holds a task only where its work goes through the web tools: a direct connector frees it; a browser save waiting holds one", opts, async () => {
  const w = await research();
  try {
    pagesHere(w, PER_HOST, 40 * 60_000);
    const tree = Tree.open(w.cwd, w.env);
    const shared = path.join(w.home, "shared");
    const full = fullWebSites(tree, shared);
    assert.deepEqual([...full.keys()], [SITE]);
    const t1 = tree.get<Task>("T0001")!;
    const t2 = tree.get<Task>("T0002")!;
    assert.equal(webFullOfTask(tree, t1, full, { connectors: [], saves: [] })?.site, SITE);
    assert.equal(webFullOfTask(tree, t2, full, { connectors: [], saves: [] }), undefined, "its book elsewhere");
    const connector = (routes: string[]) => ({ name: "lhota", manifest: { hosts: [SITE, `www.${SITE}`], routes } }) as unknown as Connector;
    assert.equal(webFullOfTask(tree, t1, full, { connectors: [connector(["direct"])], saves: [] }), undefined, "strom fetch: its own limiter");
    assert.equal(webFullOfTask(tree, t1, full, { connectors: [connector(["browser"])], saves: [] })?.site, SITE, "its pages in the agent's browser");
    const save = { task: "T0002", n: 3, recordset: "B0002", host: `www.${SITE}`, url: `https://www.${SITE}/kniha/1?image=3`, file: "strom-x-T0002-0003", at: Date.now() };
    assert.equal(webFullOfTask(tree, t2, full, { connectors: [], saves: [save] })?.site, SITE);
    assert.equal(webFullOfTask(tree, t2, full, { connectors: [], saves: [{ ...save, taken: Date.now() }] }), undefined, "taken already");
  } finally {
    w.cleanup();
  }
});
