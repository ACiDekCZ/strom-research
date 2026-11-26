// The runs by line as the bridge tells the Strom app (spec 126 U9; features run.lines, run.agents, run.stop, run.limit,
// directions.move): /status runs[] (a run of a line and one of the whole queue, each with its state, session and task),
// runsEnded[] with why each ended, working[].run, researches[].run/canStart/why/agent, limits, agents, queue[].run and
// queueCounts.general; POST /runs/stop (the task at work finished, no next one: why stopped; an unknown run 404);
// POST /settings/runs (lowered at once, raised only in the terminal: 403, outside 1–10: 400); POST /directions/preview,
// moveTasks and gather/undo; the links work&research=…&agent=… and finish&run=…; an archive says none of it. Real
// processes: the script agent waits in each session until the test lets it go. Any script, any accent.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { spawn } from "node:child_process";
import { World, hasGit } from "../helpers.ts";
import { parseLink, LinkError, linkText } from "../../src/core/links.ts";

const CLI = path.join(import.meta.dirname, "..", "..", "src", "cli.ts");
const AGENT = path.join(import.meta.dirname, "..", "fixtures", "agent.ts");
const APP = "https://beta.stromapp.info";
const skip = !hasGit || process.platform === "win32";
const FEATURES = ["run.lines", "run.agents", "run.stop", "run.limit", "directions.move"];

function strom(w: World, args: string[], env: Record<string, string> = {}): Promise<{ code: number; out: string; err: string }> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [CLI, ...args], { cwd: w.cwd, env: { ...w.env, ...env }, stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("close", (code) => resolve({ code: code ?? 1, out, err }));
  });
}

type Answer = { status: number; body: any };
function request(url: string, method = "GET", body?: unknown, headers: Record<string, string> = { Origin: APP }): Promise<Answer> {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? undefined : Buffer.from(JSON.stringify(body), "utf8");
    const req = http.request(url, { agent: false, method, headers: { ...headers, ...(data ? { "Content-Type": "text/plain;charset=UTF-8", "Content-Length": String(data.length) } : {}) } }, (res) => {
      let text = "";
      res.setEncoding("utf8");
      res.on("data", (d) => (text += d));
      res.on("end", () => {
        let parsed: any = text;
        try {
          parsed = JSON.parse(text);
        } catch {
          // not JSON
        }
        resolve({ status: res.statusCode ?? 0, body: parsed });
      });
    });
    req.on("error", reject);
    req.end(data);
  });
}

async function until(what: () => boolean | Promise<boolean>, ms = 60_000): Promise<void> {
  const end = Date.now() + ms;
  while (!(await what())) {
    if (Date.now() > end) throw new Error("waited in vain");
    await new Promise((r) => setTimeout(r, 50));
  }
}

/** Two lines of two people of no kin (G0001 Jan Lhoták, G0002 Мария), a task of each and one about nobody. */
async function twoLines(): Promise<{ w: World; dir: string }> {
  const w = new World();
  await w.withTree("Lhotákovi");
  w.env.STROM_LIVE_POLL_MS = "100";
  await w.ok(["research", "new", "Předci Jana", "--new-person", "Jan /Lhoták/", "--sex", "M", "--born", "ABT 1885", "--born-place", "Lhota"]);
  await w.ok(["research", "new", "Предки Марии", "--new-person", "Мария /Лхотакова/", "--sex", "F", "--born", "ABT 1890", "--born-place", "Лхота"]);
  await w.ok(["task", "add", "Křest Jana", "--level", "locate", "--where", "Lhota", "--why", "rodiče", "--done-when", "zápis", "--about", "P0001"]);
  await w.ok(["task", "add", "Крещение Марии", "--level", "locate", "--where", "Лхота", "--why", "родители", "--done-when", "запись", "--about", "P0002"]);
  await w.ok(["task", "add", "Kronika obce Lhota", "--level", "locate", "--where", "Lhota", "--why", "obec", "--done-when", "zápis"]);
  const dir = path.join(w.home, "agent");
  fs.mkdirSync(dir, { recursive: true });
  Object.assign(w.env, { STROM_RUNNER_SCRIPT: AGENT, AGENT_MODE: "wait", AGENT_DIR: dir });
  return { w, dir };
}

const took = (dir: string) => fs.readdirSync(dir).filter((f) => f.startsWith("took-"));

test("/status of a line's run and the whole queue's: runs[], working[].run, researches[], limits, agents, queue[].run; runs/stop → finishing, then runsEnded why stopped; 404 runs.unknown; /log run", { skip, timeout: 240_000 }, async () => {
  const { w, dir } = await twoLines();
  try {
    const info = (await w.ok(["live", "start", "--json"])).json as { url: string };
    let s = (await request(`${info.url}/status`)).body;
    for (const f of FEATURES) assert.ok(s.features.includes(f), f);
    assert.deepEqual(s.runs, []);
    assert.deepEqual(s.runsEnded, []);
    assert.deepEqual(s.limits, { maxRuns: 3, running: 0, cap: 10 });
    assert.ok(s.agents.some((a: any) => a.id === "claude" && a.name === "Claude Code"), JSON.stringify(s.agents));
    assert.ok(s.agents.every((a: any) => typeof a.id === "string" && typeof a.name === "string"));
    assert.match(s.work.confirm, /^(ask|no)$/u);
    const before = Object.fromEntries(s.researches.map((r: any) => [r.id, r]));
    assert.equal(before.G0001.canStart, true, JSON.stringify(before.G0001));
    assert.equal(before.G0001.run, undefined);
    assert.equal(s.queueCounts.general, s.queue.length, "no line has a run: the whole queue's run takes everything");

    const a = strom(w, ["run", "--agent", "script", "--research", "G0001", "--max", "1", "--json"]);
    await until(() => took(dir).length === 1);
    const g = strom(w, ["run", "--agent", "script", "--max", "1", "--json"]);
    await until(() => took(dir).length === 2);
    const of = (t: string) => took(dir).find((f) => f.endsWith(`-${t}`))?.slice("took-".length, -`-${t}`.length);
    const lineRun = of("T0001")!;
    assert.match(lineRun, /^run-[A-Za-z0-9._-]{1,36}$/u, took(dir).join(" "));
    const generalRun = [of("T0002"), of("T0003")].find((x) => x && x !== lineRun)!;
    assert.ok(generalRun, took(dir).join(" "));

    await until(async () => {
      s = (await request(`${info.url}/status`)).body;
      return s.runs.length === 2 && s.runs.every((r: any) => r.state === "working");
    });
    const runs = Object.fromEntries(s.runs.map((r: any) => [r.id, r]));
    const lr = runs[lineRun];
    assert.equal(lr.research, "G0001");
    assert.equal(lr.agent, "script");
    assert.equal(typeof lr.agentName, "string");
    assert.match(lr.since, /^\d{4}-\d\d-\d\dT/u);
    assert.match(lr.session, /^N\d+$/u);
    assert.equal(lr.task, "T0001");
    assert.equal(lr.sessions, 0);
    assert.equal(runs[generalRun].research, null);
    assert.equal(s.runs.some((r: any) => r.state === "starting"), false);
    // working[]: each session says its run
    assert.deepEqual(s.working.map((x: any) => x.run).sort(), [generalRun, lineRun].sort(), JSON.stringify(s.working));
    // the lines: G0001 held by its run; the limit 3, two at work
    const lines = Object.fromEntries(s.researches.map((r: any) => [r.id, r]));
    assert.equal(lines.G0001.run, lineRun);
    assert.equal(lines.G0001.canStart, false);
    assert.equal(lines.G0001.why, "running");
    assert.equal(lines.G0001.agent, "script", "the agent of its last run");
    assert.equal(lines.G0002.run, undefined);
    assert.deepEqual(s.limits, { maxRuns: 3, running: 2, cap: 10 });
    // the queue: none of G0001's tasks is the whole queue's
    for (const q of s.queue) if (q.run !== undefined) assert.equal(q.run, lineRun, JSON.stringify(q));
    assert.equal(s.queueCounts.general, s.queue.filter((q: any) => !q.run).length);

    // asked to stop from the app: finishing at once, the session goes on to its end
    const stopped = await request(`${info.url}/runs/stop`, "POST", { run: lineRun });
    assert.equal(stopped.status, 200, JSON.stringify(stopped.body));
    assert.equal(stopped.body.ok, true);
    assert.equal(stopped.body.run.id, lineRun);
    assert.equal(stopped.body.run.state, "finishing");
    const unknown = await request(`${info.url}/runs/stop`, "POST", { run: "run-Lhoták" });
    assert.equal(unknown.status, 400, "no run's ID: the body");
    const gone = await request(`${info.url}/runs/stop`, "POST", { run: "run-0-nobody" });
    assert.equal(gone.status, 404);
    assert.equal(gone.body.code, "runs.unknown");
    assert.equal((await request(`${info.url}/runs/stop`, "POST", { run: lineRun }, {})).status, 403, "only the app writes");
    // the CLI's own: an unknown run refused in one sentence
    const cli = await w.run(["run", "stop", "run-0-nobody", "--json"]);
    assert.notEqual(cli.code, 0);
    assert.match(cli.out + cli.err, /runs\.unknown/u);

    fs.writeFileSync(path.join(dir, "go"), "");
    for (const r of await Promise.all([a, g])) assert.equal(r.code, 0, r.err);
    await until(async () => {
      s = (await request(`${info.url}/status`)).body;
      return s.runs.length === 0 && s.runsEnded.length === 2;
    });
    const ended = Object.fromEntries(s.runsEnded.map((r: any) => [r.id, r]));
    assert.equal(ended[lineRun].why, "stopped");
    assert.equal(ended[lineRun].research, "G0001");
    assert.equal(ended[lineRun].agent, "script");
    assert.match(ended[lineRun].ended, /^\d{4}-\d\d-\d\dT/u);
    assert.equal(ended[generalRun].why, "done");
    assert.equal(ended[generalRun].research, null);
    assert.equal(s.researches.find((r: any) => r.id === "G0001").agent, "script", "remembered after its run");
    // the run's state files go with it
    assert.deepEqual(fs.readdirSync(path.join(w.cwd, ".strom", "workers")).filter((f) => /\.(run|stop)$/u.test(f)), []);
    // /log: each session of a run says its run; no entry of a run's start or end
    const { entries } = (await request(`${info.url}/log`)).body as { entries: { run?: string }[] };
    assert.ok(entries.some((e) => e.run === lineRun), JSON.stringify(entries.slice(0, 4)));
    assert.ok(entries.some((e) => e.run === generalRun));
    await w.ok(["live", "stop"]);
  } finally {
    fs.writeFileSync(path.join(dir, "go"), "");
    await w.run(["live", "stop"]);
    w.cleanup();
  }
});

test("POST /settings/runs: lowered at once (strom config set run.parallel), raised only in the terminal (403 runs.raise + command), 1–10 (400 runs.max)", { skip, timeout: 120_000 }, async () => {
  const { w } = await twoLines();
  try {
    const info = (await w.ok(["live", "start", "--json"])).json as { url: string };
    const lower = await request(`${info.url}/settings/runs`, "POST", { max: 2 });
    assert.equal(lower.status, 200, JSON.stringify(lower.body));
    assert.deepEqual(lower.body, { ok: true, limits: { maxRuns: 2, running: 0, cap: 10 } });
    assert.equal((await w.ok(["config", "get", "run.parallel", "--json"])).json.value, 2);
    const same = await request(`${info.url}/settings/runs`, "POST", { max: 2 });
    assert.equal(same.status, 200);
    const raise = await request(`${info.url}/settings/runs`, "POST", { max: 4 });
    assert.equal(raise.status, 403);
    assert.equal(raise.body.code, "runs.raise");
    assert.equal(raise.body.command, "strom config set run.parallel 4");
    for (const bad of [{ max: 11 }, { max: 0 }, { max: 2.5 }, { max: "2" }, {}, { max: 2, more: 1 }]) {
      const r = await request(`${info.url}/settings/runs`, "POST", bad);
      assert.equal(r.status, 400, JSON.stringify(bad));
      assert.equal(r.body.code, "runs.max");
    }
    assert.equal((await w.ok(["config", "get", "run.parallel", "--json"])).json.value, 2, "nothing raised");
    assert.equal((await request(`${info.url}/status`)).body.limits.maxRuns, 2);
    await w.ok(["live", "stop"]);
  } finally {
    await w.run(["live", "stop"]);
    w.cleanup();
  }
});

test("POST /directions/preview, /directions with moveTasks (moved), /directions/<G>/gather/undo (back, then 409 gather.none)", { skip, timeout: 180_000 }, async () => {
  const w = new World();
  try {
    await w.withTree("Lhotákovi");
    await w.ok(["person", "add", "Žofie /Lhotáková/", "--sex", "F", "--born", "1890"]); // P0001
    await w.ok(["person", "add", "Jan /Lhoták/", "--sex", "M", "--born", "1860"]); // P0002
    await w.ok(["family", "add", "--partner", "P0002", "--child", "P0001"]);
    await w.ok(["person", "add", "Мирослав /Лхота/", "--sex", "M", "--born", "1870"]); // P0003
    await w.ok(["research", "new", "Předci Žofie", "--person", "P0001"]); // G0001
    await w.ok(["task", "add", "Křest Jana Lhotáka", "--level", "locate", "--where", "Lhota", "--why", "rodiče", "--done-when", "zápis", "--about", "P0002", "--research", "G0001"]);
    await w.ok(["task", "add", "Sňatek Jana Lhotáka", "--level", "locate", "--where", "Lhota", "--why", "manželka", "--done-when", "zápis", "--about", "P0002", "--research", "G0001"]);
    const info = (await w.ok(["live", "start", "--json"])).json as { url: string };
    const preview = await request(`${info.url}/directions/preview`, "POST", { person: "P0002", direction: "ancestors", name: "Předci Jana" });
    assert.equal(preview.status, 200, JSON.stringify(preview.body));
    assert.deepEqual(preview.body, { ok: true, inside: ["G0001"], move: 2 });
    const apart = await request(`${info.url}/directions/preview`, "POST", { person: "P0003", direction: "ancestors" });
    assert.deepEqual(apart.body, { ok: true, inside: [], move: 0 }, "outside every line: nothing to ask");
    assert.equal((await request(`${info.url}/directions/preview`, "POST", { person: "P0002", direction: "sideways" })).status, 400);
    assert.equal((await request(`${info.url}/directions/preview`, "POST", { person: "P0002", direction: "ancestors", moveTasks: "yes" })).status, 400);
    assert.equal((await w.ok(["research", "list", "--json"])).json.researches.length, 1, "a preview makes nothing");

    const made = await request(`${info.url}/directions`, "POST", { person: "P0002", direction: "ancestors", name: "Předci Jana", moveTasks: true });
    assert.equal(made.status, 200, JSON.stringify(made.body));
    assert.equal(made.body.direction.id, "G0002");
    assert.equal(made.body.moved, 2);
    const lineOf = async (t: string) => (await w.ok(["task", "show", t, "--json"])).json.task.research as string;
    assert.deepEqual([await lineOf("T0001"), await lineOf("T0002")], ["G0002", "G0002"]);
    // a new line without moveTasks: no moved said
    const kept = await request(`${info.url}/directions`, "POST", { person: "P0003", direction: "ancestors", name: "Предки Мирослава" });
    assert.equal(kept.status, 200, JSON.stringify(kept.body));
    assert.equal(kept.body.moved, undefined);

    const undo = await request(`${info.url}/directions/G0002/gather/undo`, "POST", {});
    assert.equal(undo.status, 200, JSON.stringify(undo.body));
    assert.equal(undo.body.ok, true);
    assert.equal(undo.body.back, 2);
    assert.deepEqual([await lineOf("T0001"), await lineOf("T0002")], ["G0001", "G0001"]);
    const again = await request(`${info.url}/directions/G0002/gather/undo`, "POST", {});
    assert.equal(again.status, 409);
    assert.equal(again.body.code, "gather.none");
    assert.equal((await request(`${info.url}/directions/G0099/gather/undo`, "POST", {})).status, 404);
    await w.ok(["live", "stop"]);
  } finally {
    await w.run(["live", "stop"]);
    w.cleanup();
  }
});

test("the links work&research=G…[&agent=…] and finish&run=…: IDs and fixed values only; agent only with research", () => {
  const id = "0b3f7c2e-5a41-4c8e-9d21-7e6f5a4b3c2d";
  assert.deepEqual(parseLink(`strom-research://work?tree=${id}&do=loop&research=G0002`), { action: "work", tree: id, do: "loop", research: "G0002" });
  assert.deepEqual(parseLink(`strom-research://work?tree=${id}&do=tasks&n=3&research=G0002&agent=codex`), { action: "work", tree: id, do: "tasks", n: "3", research: "G0002", agent: "codex" });
  const link = parseLink(`strom-research://work?tree=${id}&do=tasks&research=G7&agent=claude`);
  assert.deepEqual(parseLink(linkText(link as Exclude<typeof link, { action: "menu" }>)), link, "said again as a link: the same");
  assert.deepEqual(parseLink(`strom-research://finish?tree=${id}&run=run-4242-k3x9`), { action: "finish", tree: id, run: "run-4242-k3x9" });
  assert.deepEqual(parseLink(`strom-research://finish?tree=${id}&session=N0004`), { action: "finish", tree: id, session: "N0004" });
  for (const bad of [
    `strom-research://work?tree=${id}&do=loop&agent=codex`,
    `strom-research://work?tree=${id}&do=loop&research=`,
    `strom-research://work?tree=${id}&do=loop&research=g0002`,
    `strom-research://work?tree=${id}&do=loop&research=G12345678`,
    `strom-research://work?tree=${id}&do=loop&research=Г0002`,
    `strom-research://work?tree=${id}&do=loop&research=Předci`,
    `strom-research://work?tree=${id}&do=loop&research=G0002&agent=Codex`,
    `strom-research://work?tree=${id}&do=loop&research=G0002&agent=`,
    `strom-research://work?tree=${id}&do=loop&research=G0002&agent=codex;rm`,
    `strom-research://work?tree=${id}&do=loop&research=G0002&agent=лхота`,
    `strom-research://work?tree=${id}&do=loop&research=G0002&agent=${"a".repeat(33)}`,
    `strom-research://work?tree=${id}&do=tasks&task=T0003&research=G0002`,
    `strom-research://finish?tree=${id}&run=`,
    `strom-research://finish?tree=${id}&run=run-Lhoták`,
    `strom-research://finish?tree=${id}&run=N0004`,
    `strom-research://finish?tree=${id}&run=run-1&session=N0004`,
  ])
    assert.throws(() => parseLink(bad), LinkError, bad);
});

test("the link finish&run=…: a run no longer at work said, nothing asked; the link work of a line already held refused in one sentence", { skip, timeout: 120_000 }, async () => {
  const { w } = await twoLines();
  try {
    await w.ok(["lang", "cs"]);
    const id = (JSON.parse(fs.readFileSync(path.join(w.cwd, "strom.json"), "utf8")) as { id: string }).id;
    const none = await w.run(["link", "open", `strom-research://finish?tree=${id}&run=run-0-nobody`], { tty: true, answers: ["a"] });
    assert.match(none.out, /Tento běh už nepracuje \(mezitím skončil\)\. Nic se neudělalo\./u, none.out);
    assert.doesNotMatch(none.out, /\(a\/n,/u);
    // the line held by a run (its hold as a run of a line takes it): refused at once, nothing asked
    const { lineFile } = await import("../../src/core/linerun.ts");
    const { acquireLock } = await import("../../src/core/lock.ts");
    const { enterWorker } = await import("../../src/core/workers.ts");
    fs.mkdirSync(path.dirname(lineFile(w.cwd, "G0001")), { recursive: true });
    const leaveLine = acquireLock(lineFile(w.cwd, "G0001"), { owner: "run-1-lhota", waitMs: 0, machine: true });
    const leaveWorker = enterWorker(w.cwd, "run-1-lhota", "strom run", "1.40.0", { research: "G0001", agent: "claude" });
    try {
      const held = await w.run(["link", "open", `strom-research://work?tree=${id}&do=tasks&n=1&research=G0001`], { tty: true, answers: ["a"] });
      assert.match(held.out, /Linie Předci Jana už má běh \(od [^)]+\) – jedna linie, jeden běh\./u, held.out);
      assert.doesNotMatch(held.out, /\(a\/n,/u);
      // an agent not here: said, nothing asked
      const agent = await w.run(["link", "open", `strom-research://work?tree=${id}&do=tasks&n=1&research=G0002&agent=nobody-here`], { tty: true, answers: ["a"] });
      assert.match(agent.out, /Agenta nobody-here na tomto počítači spustit nejde/u, agent.out);
    } finally {
      leaveWorker();
      leaveLine();
    }
  } finally {
    w.cleanup();
  }
});

test("an archive: none of the runs in /status (no features, no runs, limits, agents, queue run)", { skip, timeout: 120_000 }, async () => {
  const { w } = await twoLines();
  try {
    await w.ok(["mode", "archive"], { tty: true });
    const info = (await w.ok(["live", "start", "--json"])).json as { url: string };
    const s = (await request(`${info.url}/status`)).body;
    for (const f of FEATURES) assert.equal(s.features.includes(f), false, f);
    for (const k of ["runs", "runsEnded", "limits", "agents"]) assert.equal(k in s, false, k);
    assert.equal(s.queueCounts.general, undefined);
    assert.equal(JSON.stringify(s.researches ?? []).includes("canStart"), false);
    assert.equal(s.work?.confirm, undefined);
    await w.ok(["live", "stop"]);
  } finally {
    await w.run(["live", "stop"]);
    w.cleanup();
  }
});
