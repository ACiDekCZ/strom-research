// The time of a session of strom run is strom's to say (N0281, N0283: two agents closed after 16 and 18 minutes of 60,
// "the time is getting short", strom having said nothing — the time only guessed from how long the steps took): the time
// left after a step of a minute or more and now and then, neutral; closing early with most of the time left and nothing
// said of it waits for a second call or --reason; the brief and the method keep a filling context apart from the time.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";
import { briefClock, clockTime, earlyClose, timeLine, TIME_EVERY_MS } from "../../src/core/clock.ts";
import { methodFor } from "../../src/core/assets.ts";

const opts = { skip: !hasGit };
const fixtures = path.join(import.meta.dirname, "..", "fixtures", "images");
const runEnv = (leftMin: number, limit = 60) => ({ STROM_DEADLINE: new Date(Date.now() + leftMin * 60_000).toISOString(), STROM_MINUTES: String(limit) });

test("the time left: after a step of a minute or more, else every ten minutes; nothing outside a run or near its end (the countdown says it then)", () => {
  const dir = fs.mkdtempSync(path.join(process.env.TMPDIR ?? "/tmp", "strom čas "));
  const now = Date.now();
  const end = now + 44 * 60_000 + 30_000;
  const env = { STROM_DEADLINE: new Date(end).toISOString(), STROM_MINUTES: "60" };
  assert.equal(timeLine({}, { ranMs: 300_000, now }), undefined, "no limit, nothing said");
  assert.equal(timeLine(env, { ranMs: 5_000, now }), undefined, "a short step with no session: nothing");
  assert.equal(timeLine(env, { ranMs: 61_000, now }), `time: 44 min left (stopped at ${clockTime(end)}) — go on`);
  // in a session: the first time, then not again within ten minutes unless a step took a minute
  assert.match(timeLine(env, { ranMs: 1_000, now, root: dir, session: "N0001" })!, /^time: 44 min left/);
  assert.equal(timeLine(env, { ranMs: 1_000, now: now + 60_000, root: dir, session: "N0001" }), undefined);
  assert.match(timeLine(env, { ranMs: 90_000, now: now + 120_000, root: dir, session: "N0001" })!, /^time: 42 min left/);
  assert.match(timeLine(env, { ranMs: 1_000, now: now + 120_000 + TIME_EVERY_MS, root: dir, session: "N0001" })!, /^time: 32 min left/);
  // near the end: the countdown (clockLine), never two lines
  assert.equal(timeLine(env, { ranMs: 90_000, now: end - 5 * 60_000 }), undefined);
  fs.rmSync(dir, { recursive: true, force: true });
  // an early close: more than half left and no reminder, no finish asked
  assert.match(earlyClose(runEnv(45), "/nonexistent", "N0001")!, /^4[45] min left \(stopped at \d\d:\d\d\): strom has not said the time is short — go on unless the context is full$/);
  assert.equal(earlyClose(runEnv(25), "/nonexistent", "N0001"), undefined, "half the time gone: closing is the agent's");
  assert.equal(earlyClose({}, "/nonexistent", "N0001"), undefined, "a conversation has no limit");
});

test("the brief and the method: a filling context is no sign of the time, the time strom's to say", () => {
  const brief = briefClock(Date.now() + 3600_000);
  assert.match(brief, /strom's output says the time left after long steps and when it is getting short/);
  assert.match(brief, /^A filling context is no sign of the time: write down what you have, then go on/m);
  const method = methodFor("link");
  assert.match(method, /A filling\s+context is no sign of the time: write down, then go on/);
  assert.match(method, /\*\*The time is strom's to say\*\* \(a session working alone/);
  assert.doesNotMatch(method, /can be cut or summarised at any moment, and a session working alone/, "context and time not in one sentence");
});

test("strom output in a run says the time left; session close --continue with most of the time left waits for a second call or --reason", opts, async () => {
  const w = new World();
  try {
    await w.withTree("Dvořákovi");
    await w.ok(["research", "new", "Předci", "--new-person", "Kryštof /Žďárský/", "--sex", "M", "--born", "1850"]);
    await w.ok(["recordset", "add", "Lhota N 1840–1860", "--kinds", "baptism", "--years", "1840-1860"]);
    await w.ok(["task", "add", "Křest Kryštofa", "--level", "link", "--where", "B1", "--why", "rodiče", "--done-when", "zápis", "--about", "P1"]);
    const started = (await w.ok(["session", "start", "T1", "--json"])).json;
    // as strom run starts its agent: the session, its stop and its limit
    const env = { ...runEnv(50), STROM_SESSION: started.session.id };
    const first = await w.ok(["task", "list"], { env });
    assert.match(first.err, /^time: 49 min left \(stopped at \d\d:\d\d\) — go on$/m);
    assert.doesNotMatch((await w.ok(["task", "list"], { env })).err, /time:/, "not again within ten minutes");
    // closing with the task back to the queue: said, not closed
    const close = ["session", "close", "--continue", "--summary", "mapa knihy", "--next", "B0001 od snímku 30"];
    const early = await w.run(close, { env });
    assert.equal(early.code, 2, early.err);
    assert.match(early.err, /not closed — 49 min left \(stopped at \d\d:\d\d\): strom has not said the time is short — go on unless the context is full/);
    assert.match(early.err, /the same command again closes it \(or with --reason "…"\)/);
    assert.equal((await w.ok(["session", "show", "--json"])).json.session.state, "open");
    // the second call closes it
    await w.ok(close, { env });
    assert.equal((await w.ok(["session", "list", "--json"])).json.sessions[0].state, "closed");
    assert.deepEqual(fs.existsSync(path.join(w.cwd, ".strom", "clock")) ? fs.readdirSync(path.join(w.cwd, ".strom", "clock")) : [], [], "its marks gone with it");
    // --reason: at once; near the end, or without a limit: at once
    const again = async (left: number) => ({ ...runEnv(left), STROM_SESSION: (await w.ok(["session", "start", "T1", "--json"])).json.session.id as string });
    await w.ok([...close, "--reason", "kontext je plný"], { env: await again(50) });
    await w.ok(close, { env: await again(20) });
    await w.ok(["session", "start", "T1"]);
    await w.ok(close);
  } finally {
    w.cleanup();
  }
});

test("session close --done over places a reader found unclear, with most of the time left: said first; done without them: closed", opts, async () => {
  const w = new World();
  try {
    await w.withTree("Dvořákovi");
    await w.ok(["research", "new", "Předci", "--new-person", "Kryštof /Žďárský/", "--sex", "M", "--born", "1850"]);
    await w.ok(["recordset", "add", "Lhota N 1840–1860", "--kinds", "baptism", "--years", "1840-1860"]);
    const scans = path.join(w.dir, "scans");
    fs.mkdirSync(scans);
    for (const f of ["s0001.jpg", "s0002.jpg"]) fs.copyFileSync(path.join(fixtures, f), path.join(scans, f));
    await w.ok(["media", "add", scans, "--recordset", "B1"]);
    await w.ok(["task", "add", "Křest Kryštofa", "--level", "link", "--where", "B1", "--why", "rodiče", "--done-when", "zápis", "--about", "P1"]);
    await w.ok(["session", "start", "T1"]);
    const env = runEnv(50);
    const done = ["session", "close", "--done", "nenalezen", "--next", "jiná fara"];
    // no reader found anything unclear: done is done
    const dir = path.join(w.cwd, "notes", "readings");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, `${new Date().toISOString().slice(0, 10)}-B0001-1-2-1.md`),
      ["# Reading B0001-1-2 · batch 1 of 1", "Question: Křest Žďárský", "", "## Image 1 · M0001", "result: nothing", "", "## Image 2 · M0002", "result: unclear", "entries: okraj — „…ský“, nečitelné", ""].join("\n"),
    );
    const said = await w.run(done, { env });
    assert.equal(said.code, 2, said.err);
    assert.match(said.err, /not closed — 49 min left/);
    assert.match(said.err, /readers found B0001:2 unclear and nobody looked closer since: strom media view B0001:2 --half both/);
    await w.ok(["media", "view", "B1:2", "--half", "both"], { env });
    await w.ok(done, { env });
    assert.equal((await w.ok(["task", "show", "T1", "--json"])).json.task.state, "done");
  } finally {
    w.cleanup();
  }
});
