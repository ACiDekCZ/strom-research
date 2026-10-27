// A task whose archive strom leaves alone for a while (it went silent, or asked to slow down) waits out of the queue
// until it takes requests again — computed from the limiter's state, nothing written to data/. Found in a live run:
// after a session was told an archive was left alone, the next sessions were given the same task, each told the same
// thing. strom run --loop waits for that time when nothing else is to do; any other run ends saying when. The plan
// shows the task put off until then.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { netFile, opts, robotsReadToday, world } from "./connectors.helpers.ts";
import { clockUp } from "../../src/core/net.ts";

const agent = path.join(import.meta.dirname, "..", "fixtures", "agent.ts");

/** The host left alone after a silence, until `ms` from now — as the limiter writes it. */
function silentUntil(w: Parameters<typeof netFile>[0], ms: number): number {
  robotsReadToday(w);
  const file = netFile(w);
  const s = JSON.parse(fs.readFileSync(file, "utf8"));
  const until = Date.now() + ms;
  fs.writeFileSync(file, JSON.stringify({ ...s, blockedUntil: until, reason: "no answer at 2026-03-02 10:03 — the server is down, or it blocks this IP", silentRun: { n: 1, at: Date.now() } }));
  return until;
}

/** The time off over: the host takes requests again. */
function awake(w: Parameters<typeof netFile>[0]): void {
  const file = netFile(w);
  const { blockedUntil: _b, reason: _r, silentRun: _s, ...s } = JSON.parse(fs.readFileSync(file, "utf8"));
  fs.writeFileSync(file, JSON.stringify(s));
}

/** A research with a task on the test archive (T0001) and, unless `alone`, one on another archive (T0002). */
async function research(alone = false) {
  const { w, a } = await world();
  await w.ok(["research", "new", "Předci Jana Lhotáka", "--new-person", "Jan /Lhoták/", "--sex", "M", "--born", "ABT 1790", "--born-place", "Lhota"]);
  await w.ok(["recordset", "add", "Lhota N 1784–1820", "--kinds", "baptism", "--url", `${a.base}/book/5359`]); // B0001
  await w.ok(["task", "add", "Křest Jana Lhotáka", "--level", "locate", "--where", "B1", "--why", "rodiče", "--done-when", "zápis", "--about", "P1", "--priority", "5"]);
  if (!alone) {
    await w.ok(["recordset", "add", "Lhota O 1784–1820", "--kinds", "marriage", "--url", "https://archive.lhota.example/book/77"]); // B0002
    await w.ok(["task", "add", "Sňatek rodičů Jana Lhotáka", "--level", "locate", "--where", "B2", "--why", "rodiče", "--done-when", "zápis", "--about", "P1", "--priority", "1"]);
  }
  return { w, a };
}

test("queue: a task whose archive is left alone waits out of it until then — said to the agent, put off in the plan; back by itself", opts, async () => {
  const { w } = await research();
  try {
    assert.equal((await w.ok(["task", "next", "--json"])).json.task.id, "T0001", "awake: first by its priority");
    const before = fs.readdirSync(path.join(w.cwd, "data"), { recursive: true }).length;
    const at = silentUntil(w, 50 * 60_000);
    // out of the queue: the other task now
    assert.equal((await w.ok(["task", "next", "--json"])).json.task.id, "T0002");
    const list = await w.ok(["task", "list"]);
    assert.doesNotMatch(list.out, /T0001 {2}p1/);
    assert.ok(list.out.includes(`1 more wait out of the queue until ${clockUp(at)} (T0001): their books are at 127.0.0.1, left alone after it went silent or asked to slow down — back in the queue by themselves then; no strom fetch there before`), list.out);
    assert.ok(!(await w.ok(["task", "list", "--json"])).json.tasks.some((t: { id: string }) => t.id === "T0001"));
    // the plan: put off until then, in the research's language
    const plan = await w.ok(["plan"]);
    assert.match(plan.out, new RegExp(`později +Křest Jana Lhotáka \\(odloženo do ${clockUp(at)}: 127\\.0\\.0\\.1 teď neodpovídá\\)`));
    const later = (await w.ok(["plan", "--json"])).json.later as { id: string; until: string; host: string }[];
    assert.deepEqual(later.map((l) => [l.id, l.host]), [["T0001", "127.0.0.1"]]);
    assert.equal(Date.parse(later[0]!.until), at);
    // nothing written for it: the task stays open
    assert.equal((await w.ok(["task", "show", "T1", "--json"])).json.task.state, "open");
    assert.equal(fs.readdirSync(path.join(w.cwd, "data"), { recursive: true }).length, before);
    // the time off over: back in the queue, first again
    awake(w);
    assert.equal((await w.ok(["task", "next", "--json"])).json.task.id, "T0001");
    assert.doesNotMatch((await w.ok(["plan"])).out, /odloženo do/);
    // a host that refused strom is not this: only the person lifts that (said elsewhere)
    robotsReadToday(w);
    const s = JSON.parse(fs.readFileSync(netFile(w), "utf8"));
    fs.writeFileSync(netFile(w), JSON.stringify({ ...s, blockedUntil: Date.now() + 3600_000, reason: "refused us (HTTP 403)", refusedKind: "load" }));
    assert.equal((await w.ok(["task", "next", "--json"])).json.task.id, "T0001");
  } finally {
    w.cleanup();
  }
});

test("queue: a task with a book on an archive that answers goes on there; a story asks no archive", opts, async () => {
  const { w, a } = await research(true);
  try {
    await w.ok(["recordset", "add", "Lhota Z 1784–1820", "--kinds", "burial", "--url", "https://archive.lhota.example/book/78"]); // B0002
    await w.ok(["task", "add", "Pohřeb otce", "--level", "locate", "--where", "B1", "--where", "B2", "--why", "otec", "--done-when", "zápis", "--about", "P1"]); // T0002
    await w.ok(["task", "add", "Úmrtí matky", "--level", "narrate", "--where", "B1", "--why", "příběh", "--done-when", "text", "--about", "P1"]); // T0003: asks no archive
    void a;
    silentUntil(w, 50 * 60_000);
    const ids = (await w.ok(["task", "list", "--json"])).json.tasks.map((t: { id: string }) => t.id);
    assert.ok(!ids.includes("T0001"), "every book on the archive left alone");
    assert.ok(ids.includes("T0002"), "a book elsewhere: it goes on there");
    assert.ok(ids.includes("T0003"), "a story asks no archive");
  } finally {
    w.cleanup();
  }
});

test("strom run: only work for an archive left alone — one run ends saying when; --loop waits for that time, then the session", opts, async () => {
  const { w } = await research(true);
  try {
    Object.assign(w.env, { STROM_RUNNER_SCRIPT: agent, AGENT_MODE: "echo" });
    const at = silentUntil(w, 50 * 60_000);
    const one = await w.ok(["run", "--agent", "script", "--json"]);
    assert.equal(one.json.sessions.length, 0, "no session spent on being told so");
    assert.equal(one.json.stop, "asleep");
    assert.equal(one.json.stopped, `do ${clockUp(at)} není co dělat – zbylé úkoly potřebují 127.0.0.1, který teď neodpovídá`);
    // --until before the time: nothing to wait for within it
    const near = new Date(Date.now() + 10 * 60_000);
    const until = `${String(near.getHours()).padStart(2, "0")}:${String(near.getMinutes()).padStart(2, "0")}`;
    if (near.getDate() === new Date().getDate() && Date.now() + 10 * 60_000 < at) {
      const short = await w.ok(["run", "--agent", "script", "--loop", "--until", until, "--json"]);
      assert.equal(short.json.sessions.length, 0);
      assert.equal(short.json.stop, "asleep");
    }
    // --loop: waits for the time off to end (a few seconds here), then the session on it
    const soon = silentUntil(w, 2500);
    const t0 = Date.now();
    const loop = await w.ok(["run", "--agent", "script", "--loop", "--max", "1", "--json"]);
    assert.ok(Date.now() >= soon, "not before the time");
    assert.ok(Date.now() - t0 < 60_000);
    assert.equal(loop.json.sessions.length, 1, loop.out);
    assert.equal(loop.json.sessions[0].task, "T0001");
    assert.ok(!fs.existsSync(path.join(w.cwd, ".strom", "workers")) || !fs.readdirSync(path.join(w.cwd, ".strom", "workers")).some((f) => f.endsWith(".paused")), "no pause left behind");
    const text = await w.ok(["run", "--agent", "script", "--json"]);
    assert.equal(text.json.sessions.length, 1, "awake: as before");
  } finally {
    w.cleanup();
  }
});
