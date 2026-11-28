// The tree check (spec 091): strom health's built-in part (read only, nothing written; --save a report), the AI checks
// asked as a task first in the queue (--ai, --dry, --scope, --changed), the agent's findings in its session alone
// (strom audit add|checked|summary|order: stable ids, the limit, a dismissed one refused), the person's decisions
// (accept → a task of the queue, dismiss without a person of the finding, undo) — never an agent's — and the brief.

import { test } from "node:test";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import { AUDIT_MAX, findingId, readAudit } from "../../src/core/audit.ts";
import { aiOf } from "../../src/core/health.ts";
import type { Task } from "../../src/core/model.ts";

const opts = { skip: !hasGit, timeout: 240_000 };
const bridged = { skip: !hasGit || process.platform === "win32", timeout: 240_000 };
const APP = "https://beta.stromapp.info";
const AGENT = { env: { CLAUDECODE: "1" } };
const open = (w: World) => Tree.open(w.cwd, w.env);
const commits = (w: World) => Number(execFileSync("git", ["rev-list", "--count", "HEAD"], { cwd: w.cwd, encoding: "utf8" }).trim());

async function person(w: World, name: string, sex: string): Promise<string> {
  return (await w.ok(["person", "add", name, "--sex", sex, "--json"])).json.person.id;
}

test("health: the catalog's choice — default without the heavy ones (L only with houses on), all, none, a list in the order the agent goes; an unknown refused", () => {
  assert.deepEqual(aiOf("default", false), ["G", "A", "B", "C", "D", "H", "I"]);
  assert.deepEqual(aiOf("default", true), ["G", "A", "B", "C", "D", "H", "I", "L"]);
  assert.equal(aiOf("all", false).length, 12);
  assert.deepEqual(aiOf("none", true), []);
  assert.deepEqual(aiOf("a, g", false), ["G", "A"]);
  assert.throws(() => aiOf("Z", false));
  // the same id whatever the order of the records and however many times one is named; another code, another id
  assert.equal(findingId("A", ["P0002", "P0001", "P0001"], "story-no-facts"), findingId("A", ["P0001", "P0002"], "story-no-facts"));
  assert.notEqual(findingId("A", ["P0001"], "story-no-facts"), findingId("A", ["P0001"], "story-wrong-year"));
  assert.match(findingId("G", ["P0001"], "next-source"), /^G-[0-9a-f]{8}$/);
});

test("health: the built-in part reads only (nothing committed), --save keeps a report; --ai --dry estimates, --ai a task first in the queue; the agent's findings in its session alone; the person's decisions", opts, async () => {
  const w = new World();
  try {
    await w.withTree("Lhotákovi");
    const a = await person(w, "Jan /Lhoták/", "M");
    const b = await person(w, "Anna /Lhotáková/", "F");
    await w.ok(["research", "new", "Lhoták", "--person", a]);
    const before = commits(w);
    const h = await w.ok(["health", "--json"]);
    assert.equal(h.json.builtin.check.ok, true);
    assert.equal(h.json.builtin.growth.days, 30);
    assert.ok(h.json.builtin.growth.persons >= 2);
    assert.ok(Array.isArray(h.json.builtin.steps));
    assert.equal(commits(w), before, "read only: no commit");
    assert.ok(!fs.existsSync(path.join(w.cwd, "quality", "health")), "nothing written");
    // an agent may read it as often as it likes
    await w.ok(["health"], AGENT);
    const saved = await w.ok(["health", "--save", "--json"]);
    assert.equal(saved.json.id, "C0001");
    assert.equal(commits(w), before + 1);
    // --dry: what it would take, nothing written
    const dry = await w.ok(["health", "--ai", "default", "--dry", "--json"]);
    assert.deepEqual(Object.keys(dry.json.estimate.byType), ["G", "A", "B", "C", "D", "H", "I"]);
    assert.ok(dry.json.estimate.total.minutes[0] <= dry.json.estimate.total.minutes[1]);
    assert.equal(dry.json.estimate.total.sessions, 1);
    assert.equal(commits(w), before + 1);
    // unknown, none with --changed, an unknown scope: refused
    assert.equal((await w.run(["health", "--ai", "Z"])).code !== 0, true);
    assert.equal((await w.run(["health", "--scope", "line:G9999"])).code !== 0, true);
    // asked: a task first in the queue, its report; the same scope again while it is not done: refused
    const run = await w.ok(["health", "--ai", "G,A", "--scope", `person:${a}`, "--json"]);
    assert.equal(run.json.id, "C0002");
    const task = open(w).get<Task>(run.json.task)!;
    assert.equal(task.origin, "health:C0002");
    assert.equal(task.level, "enrich");
    assert.equal(task.queueAt?.do, "next");
    assert.deepEqual(task.subject, [a]);
    const twice = await w.run(["health", "--ai", "G", "--scope", `person:${a}`, "--json"]);
    assert.notEqual(twice.code, 0);
    assert.match(twice.out + twice.err, /health\.running/);
    // outside its session: no finding
    const outside = await w.run(["audit", "add", "--type", "A", "--code", "story-no-facts", "--record", a, "--what", "Příběh nemá fakta.", "--fix", "Připojit fakta.", "--proof", a, "--json"], AGENT);
    assert.notEqual(outside.code, 0);
    assert.match(outside.out + outside.err, /audit\.no-run/);
    // in its session: written, the same id again replaced; a check not asked for refused
    await w.ok(["session", "start", task.id], AGENT);
    const brief = await w.ok(["brief"], AGENT);
    assert.match(brief.out, /tree check/i);
    assert.match(brief.out, /strom audit add/);
    const add = (code: string, records: string[], type = "A") =>
      w.run(["audit", "add", "--type", type, "--code", code, ...records.flatMap((r) => ["--record", r]), "--what", "Příběh „Jana“ nemá žádná fakta.", "--fix", "Připojit fakta, o která se opírá.", "--proof", `${a}:"narozen 1850 v Lhotě"`, "--json"], AGENT);
    const f1 = await add("story-no-facts", [a, b]);
    assert.equal(f1.code, 0, f1.err);
    const id1 = f1.json.id;
    assert.equal(id1, findingId("A", [a, b], "story-no-facts"));
    const again = (await add("story-no-facts", [b, a])).json;
    assert.equal(again.replaced, true);
    assert.notEqual((await add("x", [a], "E")).code, 0, "E was not asked for");
    const f2 = (await add("wrong-name", [b])).json.id;
    await w.ok(["audit", "checked", "A", "G"], AGENT);
    await w.ok(["audit", "summary", "Dva příběhy bez faktů."], AGENT);
    await w.ok(["audit", "order", "line-stuck:G0001", "--why", "Linie čeká na odpověď archivu."], AGENT);
    // an agent never decides
    const agentAccepts = await w.run(["audit", "accept", id1], AGENT);
    assert.notEqual(agentAccepts.code, 0);
    await w.ok(["session", "close", "--done", "kontrola hotová", "--next", "nic"], AGENT);
    const shown = await w.ok(["health", "show", "C0002", "--json"]);
    assert.equal(shown.json.report.state, "done");
    assert.deepEqual(shown.json.report.counts, { new: 2, accepted: 0, dismissed: 0 });
    assert.equal(shown.json.report.summary[open(w).lang], "Dva příběhy bez faktů.");
    assert.equal(shown.json.findings[0].what[shown.json.findings[0].lang], "Příběh „Jana“ nemá žádná fakta.");
    // the person accepts: a task of the queue with the finding's records; dismisses: kept with no person of it named
    const acc = await w.ok(["audit", "accept", id1, "--json"]);
    const fixTask = open(w).get<Task>(acc.json.findings[0].task)!;
    assert.equal(fixTask.origin, `audit:${id1}`);
    assert.equal(fixTask.level, "narrate");
    assert.deepEqual([...fixTask.subject].sort(), [a, b].sort());
    assert.equal(fixTask.doneWhen, "Připojit fakta, o která se opírá.");
    await w.ok(["audit", "dismiss", f2]);
    const decided = readAudit(open(w)).decisions;
    assert.equal(decided.find((d) => d.id === f2)?.state, "dismissed");
    assert.equal(decided.find((d) => d.id === f2)?.by, "research");
    // undo of the accepted one before its task started: the task dropped, new again
    await w.ok(["audit", "undo", id1]);
    assert.equal(open(w).get<Task>(fixTask.id)!.state, "dropped");
    assert.equal((await w.ok(["audit", "list", "--state", "new", "--json"])).json.findings.length, 1);
    // a dismissed finding is never written again in the next run
    const run2 = await w.ok(["health", "--ai", "A", "--scope", `person:${a}`, "--json"]);
    await w.ok(["session", "start", run2.json.task], AGENT);
    const refused = await add("wrong-name", [b]);
    assert.notEqual(refused.code, 0);
    assert.match(refused.out + refused.err, /audit\.dismissed/);
    // the limit of a run
    for (let i = 0; i < AUDIT_MAX; i++) assert.equal((await add(`code-${i}`, [a])).code, 0);
    const over = await add("one-too-many", [a]);
    assert.match(over.out + over.err, /audit\.limit/);
    await w.ok(["session", "close", "--done", "hotovo", "--next", "nic"], AGENT);
  } finally {
    w.cleanup();
  }
});

function ask(url: string, opt: { method?: string; body?: unknown; origin?: string | null } = {}): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const headers: Record<string, string> = {};
    if (opt.origin !== null) headers.Origin = opt.origin ?? APP;
    const text = opt.body === undefined ? undefined : typeof opt.body === "string" ? opt.body : JSON.stringify(opt.body);
    if (text !== undefined) headers["Content-Type"] = "text/plain; charset=utf-8";
    const req = http.request(url, { agent: false, method: opt.method ?? (text !== undefined ? "POST" : "GET"), headers }, (res) => {
      let got = "";
      res.setEncoding("utf8");
      res.on("data", (d) => (got += d));
      res.on("end", () => {
        let body: any = got;
        try {
          body = JSON.parse(got);
        } catch {
          // not JSON
        }
        resolve({ status: res.statusCode ?? 0, body });
      });
    });
    req.on("error", reject);
    req.end(text);
  });
}

test("health: the bridge — features, /status.health, GET /health, /health/<C…>, /health/builtin; POST /health (dry, asked, twice refused), /health/stop; POST /audit/<id> and /audit (expect, accept → a task, dismiss by the app); refusals; an archive: the built-in part alone, no AI feature", bridged, async () => {
  const w = new World();
  await w.withTree("Lhotákovi");
  const a = await person(w, "Jan /Lhoták/", "M");
  const b = await person(w, "Anna /Lhotáková/", "F");
  await w.ok(["research", "new", "Lhoták", "--person", a]);
  let info = (await w.ok(["live", "start", "--json"])).json;
  try {
    const status = (await ask(`${info.url}/status`)).body;
    for (const f of ["health", "health.ai", "audit.decide"]) assert.ok(status.features.includes(f), f);
    assert.match(status.health.rev, /^[0-9a-f]{7}-[0-9a-f]{6}$/);
    assert.equal(status.health.last, undefined);
    assert.deepEqual((await ask(`${info.url}/health`)).body.reports, []);
    const built = await ask(`${info.url}/health/builtin?scope=line:G0001`);
    assert.equal(built.status, 200, JSON.stringify(built.body));
    assert.equal(built.body.builtin.check.ok, true);
    assert.ok(Array.isArray(built.body.builtin.steps));
    assert.deepEqual([(await ask(`${info.url}/health/builtin?scope=line:G0999`)).body.code], ["health.scope"]);
    // asked: refusals, dry, a task first in the queue, the same scope again refused
    for (const body of [{ ai: [] }, { ai: ["Z"] }, { ai: "G" }, { ai: ["G"], what: 1 }, "no json"]) {
      const r = await ask(`${info.url}/health`, { body });
      assert.deepEqual([r.status, r.body.code], [400, "health.body"], JSON.stringify(body));
    }
    assert.deepEqual([(await ask(`${info.url}/health`, { body: { ai: ["G"], scope: { kind: "person", id: "P0999" } } })).body.code], ["health.scope"]);
    assert.equal((await ask(`${info.url}/health`, { body: { ai: ["G"] }, origin: null })).status, 403, "only the Strom app");
    const dry = await ask(`${info.url}/health`, { body: { ai: ["G", "A"], scope: { kind: "line", id: "G0001" }, dry: true } });
    assert.equal(dry.status, 200, JSON.stringify(dry.body));
    assert.deepEqual(Object.keys(dry.body.estimate.byType), ["G", "A"]);
    assert.equal(dry.body.head, dry.body.parent);
    assert.ok(!fs.existsSync(path.join(w.cwd, "quality", "health")), "dry: nothing written");
    const run = await ask(`${info.url}/health`, { body: { ai: ["G", "A"], scope: { kind: "person", id: a } } });
    assert.equal(run.status, 200, JSON.stringify(run.body));
    assert.equal(run.body.id, "C0001");
    assert.match(run.body.task, /^T\d{4,}$/);
    assert.notEqual(run.body.head, run.body.parent);
    const twice = await ask(`${info.url}/health`, { body: { ai: ["A"], scope: { kind: "person", id: a } } });
    assert.deepEqual([twice.status, twice.body.code, twice.body.id, twice.body.task], [409, "health.running", "C0001", run.body.task]);
    const queued = (await ask(`${info.url}/status`)).body.health;
    assert.equal(queued.last.state, "queued");
    assert.equal(typeof queued.before, "number");
    assert.ok(queued.left > 0);
    assert.equal(queued.last.builtin, undefined, "/status: no built-in part");
    assert.notEqual(queued.rev, status.health.rev);
    // stopped while queued: its task put aside; nothing to stop then
    const stop = await ask(`${info.url}/health/stop`, { body: {} });
    assert.deepEqual([stop.status, stop.body.state], [200, "stopped"], JSON.stringify(stop.body));
    assert.equal((await ask(`${info.url}/status`)).body.health.last.state, "stopped");
    assert.deepEqual([(await ask(`${info.url}/health/stop`, { body: {} })).status], [404]);

    // a run the agent does: its findings, then the person's decisions in the app
    const again = (await ask(`${info.url}/health`, { body: { ai: ["A"], scope: { kind: "person", id: a } } })).body;
    await w.ok(["session", "start", again.task], AGENT);
    const add = async (code: string, records: string[]) =>
      (await w.ok(["audit", "add", "--type", "A", "--code", code, ...records.flatMap((r) => ["--record", r]), "--what", "Příběh nemá fakta.", "--fix", "Připojit fakta.", "--proof", `${a}:"narozen v Lhotě"`, "--json"], AGENT)).json.id;
    const f1 = await add("story-no-facts", [a]);
    const f2 = await add("name-uneven", [b]);
    await w.ok(["audit", "checked", "A"], AGENT);
    await w.ok(["session", "close", "--done", "hotovo", "--next", "nic"], AGENT);
    const reports = (await ask(`${info.url}/health`)).body.reports;
    assert.deepEqual(reports.map((r: any) => [r.id, r.state]), [["C0002", "done"], ["C0001", "stopped"]]);
    assert.deepEqual(reports[0].counts, { new: 2, accepted: 0, dismissed: 0 });
    const shown = (await ask(`${info.url}/health/C0002`)).body;
    assert.deepEqual(shown.findings.map((f: any) => f.id).sort(), [f1, f2].sort());
    assert.equal(shown.findings[0].lang, open(w).lang);
    assert.equal((await ask(`${info.url}/health/C0999`)).body.code, "health.unknown");
    // decided: expect refused when stale, accept → a task, many at once, dismissed by the app
    const rev = (await ask(`${info.url}/status`)).body.health.rev;
    const stale = await ask(`${info.url}/audit/${f1}`, { body: { do: "accept", expect: "0000000-000000" } });
    assert.deepEqual([stale.status, stale.body.code, stale.body.rev], [409, "health.rev", rev]);
    const acc = await ask(`${info.url}/audit/${f1}`, { body: { do: "accept", expect: rev } });
    assert.equal(acc.status, 200, JSON.stringify(acc.body));
    assert.equal(acc.body.finding.state, "accepted");
    assert.equal(acc.body.finding.taskStarted, false);
    const fixTask = open(w).get<Task>(acc.body.finding.task)!;
    assert.equal(fixTask.origin, `audit:${f1}`);
    assert.deepEqual(fixTask.subject, [a]);
    assert.notEqual(acc.body.rev, rev);
    const many = await ask(`${info.url}/audit`, { body: { ids: [f2], do: "dismiss" } });
    assert.equal(many.status, 200, JSON.stringify(many.body));
    assert.deepEqual(many.body.findings.map((f: any) => f.state), ["dismissed"]);
    assert.equal(readAudit(open(w)).decisions.find((d) => d.id === f2)?.by, "app");
    for (const [url, body] of [[`/audit/${f1}`, { do: "maybe" }], ["/audit", { ids: ["nope"], do: "accept" }], ["/audit", { do: "accept" }], [`/audit/${f1}`, { do: "accept", ids: [f1] }]] as const) {
      const r = await ask(`${info.url}${url}`, { body });
      assert.deepEqual([r.status, r.body.code], [400, "audit.body"], JSON.stringify(body));
    }
    assert.deepEqual([(await ask(`${info.url}/audit/A-00000000`, { body: { do: "accept" } })).body.code], ["audit.unknown"]);
    assert.equal((await ask(`${info.url}/audit/${f2}`, { body: { do: "undo" }, origin: null })).status, 403);
    const undo = await ask(`${info.url}/audit/${f1}`, { body: { do: "undo" } });
    assert.deepEqual([undo.status, undo.body.finding.state], [200, "new"]);
    assert.equal(open(w).get<Task>(fixTask.id)!.state, "dropped");

    // an archive: the built-in reports alone, the AI's features gone, asking refused
    await w.ok(["health", "--save"]);
    await w.ok(["live", "stop"]);
    await w.ok(["mode", "archive"], { tty: true });
    info = (await w.ok(["live", "start", "--json"])).json;
    const st = (await ask(`${info.url}/status`)).body;
    assert.ok(st.features.includes("health"));
    for (const f of ["health.ai", "audit.decide"]) assert.ok(!st.features.includes(f), f);
    assert.equal(st.health.last.id, "C0003");
    assert.deepEqual((await ask(`${info.url}/health`)).body.reports.map((r: any) => r.id), ["C0003"]);
    assert.equal((await ask(`${info.url}/health/C0002`)).status, 404);
    assert.equal((await ask(`${info.url}/health/builtin`)).status, 200);
    assert.deepEqual([(await ask(`${info.url}/health`, { body: { ai: ["G"] } })).body.code], ["health.archive"]);
  } finally {
    await w.run(["live", "stop"]);
    w.cleanup();
  }
});
