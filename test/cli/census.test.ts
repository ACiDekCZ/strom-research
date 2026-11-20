// Census records as a source (spec 106 U5 A): the switch census off|on — off unless set, turned on by the person alone
// (an agent: a window of the system, refused in a run nobody watches with the hint to propose; off is anyone's; the
// Strom app through its bridge: the person's decision, no window); the agent's proposal once ever in a research (M1);
// census tasks held while off, back once on, a doing one finished (M3); the bridge's /status.census, POST /census,
// GET /queue kind=census and known=; the method's census page only for a census task while on (K1.2); the menu's row.
// Synthetic data only; no request leaves this computer.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { World, hasGit } from "../helpers.ts";
import { Tree, now } from "../../src/core/tree.ts";
import type { Session, Task } from "../../src/core/model.ts";

const opts = { skip: !hasGit || process.platform === "win32", timeout: 240_000 };
const APP = "https://beta.stromapp.info";
const AGENT = { AI_AGENT: "1" };
const UNATTENDED = { AI_AGENT: "1", STROM_NONINTERACTIVE: "1" };

type Answer = { status: number; body: any };
function request(url: string, method = "GET", body?: unknown): Promise<Answer> {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? undefined : Buffer.from(typeof body === "string" ? body : JSON.stringify(body), "utf8");
    const req = http.request(url, { agent: false, method, headers: { Origin: APP, ...(data ? { "Content-Type": "text/plain;charset=UTF-8", "Content-Length": String(data.length) } : {}) } }, (res) => {
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

const task = (w: World, id: string) => Tree.open(w.cwd, w.env).get<Task>(id.replace(/^T(\d+)$/u, (_, n: string) => `T${n.padStart(4, "0")}`))!;
const treeJson = (w: World) => JSON.parse(fs.readFileSync(path.join(w.cwd, "strom.json"), "utf8"));
const addTask = (w: World, what: string, more: string[] = []) =>
  w.ok(["task", "add", what, "--level", "locate", "--where", "sčítací operát Lhoty", "--why", "odkud rodina přišla", "--done-when", "domácnost nalezena", "--about", "P1", "--anyway", ...more]);

/** Lhotákovi: P0001 Vojtěch Lhoták; T0001 an ordinary task. */
async function world(): Promise<World> {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["research", "new", "Předci Vojtěcha", "--new-person", "Vojtěch /Lhoták/", "--sex", "M", "--born", "1890"]);
  await addTask(w, "Křest Vojtěcha Lhotáka v Lhotě");
  return w;
}

test("census off by default: no census task, the agent's switch refused (unattended exit 4, the hint to propose), a window in a conversation; off anyone's; the proposal once ever, closed when on", opts, async () => {
  const w = await world();
  try {
    assert.equal((await w.ok(["config", "get", "census", "--json"])).json.value, "off");
    // a census task while off: refused, the person's switch, the way to propose it
    const refused = await w.run(["task", "add", "Domácnost Lhotáků 1890", "--level", "locate", "--where", "Lhota", "--why", "původ", "--done-when", "nalezeno", "--census", "1890:14", "--json"], { env: AGENT });
    assert.notEqual(refused.code, 0);
    assert.match(refused.out + refused.err, /census records are off[\s\S]*strom census propose/u);
    // the agent never turns it on: unattended, refused with the hint to propose
    const agentOn = await w.run(["config", "set", "census", "on", "--for-tree"], { env: UNATTENDED });
    assert.equal(agentOn.code, 4, agentOn.out + agentOn.err);
    assert.match(agentOn.out + agentOn.err, /strom census propose/u);
    assert.equal(treeJson(w).census, undefined);

    // the proposal: once, of kind other, waiting for the person, in the research language (a name typed decomposed)
    const why = "křest v Lhotě nenalezen; domácnost ukáže rodiště".normalize("NFD");
    const p = await w.ok(["census", "propose", "--why", why, "--person", "P1", "--json"], { env: AGENT });
    const t = p.json.task as Task;
    assert.deepEqual([t.state, t.origin, t.wait?.kind, t.subject], ["waiting", "census:propose", "other", ["P0001"]]);
    assert.match(t.what, /^Sčítání lidu by mohlo pomoci u osoby Vojtěch Lhoták \(P0001\): křest v Lhotě nenalezen; domácnost ukáže rodiště\. Zapnout jde v nastavení tohoto výzkumu\.$/u);
    assert.equal(t.what, t.what.normalize("NFC"));
    const listed = (await w.ok(["task", "list", "--kind", "other", "--state", "waiting", "--json"])).json;
    assert.ok(JSON.stringify(listed).includes(t.id), JSON.stringify(listed));
    // never a second one — open, or dropped by the person
    const again = await w.run(["census", "propose", "--why", "jiný důvod"], { env: AGENT });
    assert.notEqual(again.code, 0);
    assert.match(again.out + again.err, /proposed in this research already/u);
    await w.ok(["task", "drop", t.id, "--reason", "nechci"], { tty: true });
    const third = await w.run(["census", "propose", "--why", "ещё раз"], { env: AGENT });
    assert.match(third.out + third.err, /proposed in this research already/u);
    // the agent trying again after its proposal: told never again
    const agentAgain = await w.run(["config", "set", "census", "on", "--for-tree"], { env: UNATTENDED });
    assert.equal(agentAgain.code, 4);
    assert.match(agentAgain.out + agentAgain.err, /proposed already .*never again/u);
  } finally {
    w.cleanup();
  }
});

test("census on in a conversation through a window (the person's yes), the proposal done at once; propose refused while on; off by the agent allowed", opts, async () => {
  const w = await world();
  try {
    const t = (await w.ok(["census", "propose", "--why", "mezera mezi křtem a sňatkem", "--json"], { env: AGENT })).json.task as Task;
    assert.match(t.what, /^Sčítání lidu by mohlo výzkumu pomoci: mezera mezi křtem a sňatkem\./u);
    // a conversation: a window of the system, the person says yes
    await w.ok(["config", "set", "census", "on", "--for-tree"], { env: AGENT, dialog: true });
    assert.equal(treeJson(w).census, "on");
    assert.equal(task(w, t.id).state, "done");
    const onAgain = await w.run(["census", "propose", "--why", "x"], { env: AGENT });
    assert.notEqual(onAgain.code, 0);
    assert.match(onAgain.out + onAgain.err, /on for this research already/u);
    // off is anyone's
    await w.ok(["config", "set", "census", "off", "--for-tree"], { env: UNATTENDED });
    assert.equal(treeJson(w).census, "off");
  } finally {
    w.cleanup();
  }
});

test("census tasks: kind census, the method's page only while on (K1.2); held while off — marked in task list, out of task next — and back once on; a doing one finished, then held (M3); the session's result says the proposal", opts, async () => {
  const w = await world();
  try {
    // off: the brief of an ordinary task names census records only to propose them
    const offBrief = (await w.ok(["brief", "T1"])).out;
    assert.doesNotMatch(offBrief, /# Method: census records/u);
    assert.match(offBrief, /strom census propose/u);
    const guide = await w.run(["guide", "census"], { env: AGENT });
    assert.notEqual(guide.code, 0);

    await w.ok(["config", "set", "census", "on", "--for-tree"], { tty: true });
    await addTask(w, "Domácnost Lhotáků v Lhotě 1890", ["--census", "1890:14", "--priority", "5"]); // T0002
    await addTask(w, "Domácnost Lhotáků v Lhotě 1900", ["--census", "1900:14", "--priority", "5"]); // T0003
    assert.equal(task(w, "T2").origin, "census:1890:14");
    const kinds = (await w.ok(["task", "list", "--kind", "census", "--json"])).json;
    assert.deepEqual(JSON.stringify(kinds).match(/T000[23]/gu)?.sort(), ["T0002", "T0003"]);
    // on: the census page and the census records strom knows of, for a census task alone
    const onBrief = (await w.ok(["brief", "T2"])).out;
    assert.match(onBrief, /# Method: census records/u);
    assert.match(onBrief, /Census records strom knows of/u);
    assert.doesNotMatch(onBrief, /Census records are off/u);
    const plain = (await w.ok(["brief", "T1"])).out;
    assert.doesNotMatch(plain, /# Method: census records|strom census propose/u);

    // a session at work on T0002; census switched off meanwhile (by anyone): T0002 is not held, T0003 is
    await w.ok(["session", "start", "T2"], { env: AGENT });
    await w.ok(["config", "set", "census", "off", "--for-tree"], { tty: true });
    assert.equal(task(w, "T2").state, "doing");
    const list = (await w.ok(["task", "list", "--json"])).json;
    assert.equal(list.censusHeld, 1, JSON.stringify(list));
    const marked = (await w.ok(["task", "list", "--kind", "census"])).out;
    assert.match(marked, /T0003.*held: census off/u);
    assert.doesNotMatch(marked, /T0002.*held/u);
    // left unfinished: back to open, held from then — said to the agent
    const closed = await w.ok(["session", "close", "--continue", "--summary", "domácnost nedohledána", "--next", "jiný arch"], { env: AGENT });
    assert.match(closed.out, /T0002 is a census task and census records are off/u);
    assert.equal(task(w, "T2").state, "open");
    assert.equal((await w.ok(["task", "list", "--json"])).json.censusHeld, 2);
    const next = (await w.ok(["task", "next", "--json"])).json;
    assert.doesNotMatch(JSON.stringify(next), /T000[23]/u);

    // the proposal made in a session: one sentence in the session's result, in the research language
    await w.ok(["session", "start", "T1"], { env: AGENT });
    const prop = (await w.ok(["census", "propose", "--why", "rodiště neznámé", "--json"], { env: AGENT })).json.task as Task;
    await w.ok(["session", "close", "--continue", "--summary", "křest nenalezen", "--next", "sčítání"], { env: AGENT });
    const sessions = Tree.open(w.cwd, w.env).list<Session>("session");
    assert.match(sessions[sessions.length - 1]!.summary ?? "", new RegExp(`křest nenalezen Navrženo zapnout sčítání lidu \\(${prop.id}\\)\\.`, "u"));

    // back once on: both in the queue again, nothing rewritten; the proposal done
    await w.ok(["config", "set", "census", "on", "--for-tree"], { tty: true });
    assert.equal((await w.ok(["task", "list", "--json"])).json.censusHeld, undefined);
    assert.equal(task(w, prop.id).state, "done");
    const back = (await w.ok(["task", "next", "--json"])).json;
    assert.match(JSON.stringify(back), /T000[23]/u);
  } finally {
    w.cleanup();
  }
});

test("bridge: /status census {on, held}; POST /census — 400 census.body, the same value 200 with nothing written, on 200 committed (no window: the person's decision in the app); GET /queue kind=census, known=; an archive: held 0, 409", opts, async () => {
  const w = await world();
  Object.assign(w.env, { STROM_LOCK_WAIT_MS: "1500" });
  try {
    await w.ok(["config", "set", "census", "on", "--for-tree"], { tty: true });
    await addTask(w, "Domácnost Lhotáků 1890", ["--census", "1890:14"]); // T0002
    await w.ok(["config", "set", "census", "off", "--for-tree"], { tty: true });
    const url = ((await w.ok(["live", "start", "--json"])).json as { url: string }).url;
    const status = async () => (await request(`${url}/status?app=3.28.0`)).body;
    let s = await status();
    assert.ok(s.features.includes("census"));
    assert.deepEqual(s.census, { on: false, held: 1 });
    assert.ok(!(s.queue as { id: string }[]).some((x) => x.id === "T0002"), "held: not in the queue");
    assert.equal(s.queueCounts?.kind?.census, undefined);
    // held: not in a page of the queue either, nor as one put aside
    for (const q of ["kind=census", "state=parked", ""]) {
      const page = await request(`${url}/queue?${q}`);
      assert.equal(page.status, 200, JSON.stringify(page.body));
      assert.ok(!(page.body.items as { id: string }[]).some((x) => x.id === "T0002"), q);
    }

    for (const body of [{}, { on: "true" }, { on: 1 }, { on: true, what: 1 }, "ano", { On: true }]) {
      const r = await request(`${url}/census`, "POST", body);
      assert.deepEqual([r.status, r.body.code], [400, "census.body"], JSON.stringify(body));
    }
    // as it is already: nothing written
    const same = await request(`${url}/census`, "POST", { on: false });
    assert.equal(same.status, 200, JSON.stringify(same.body));
    assert.deepEqual([same.body.census, same.body.head], [{ on: false, held: 1 }, same.body.parent]);
    // on: the person's decision in the app — no window (none can be shown here), committed
    const on = await request(`${url}/census`, "POST", { on: true });
    assert.equal(on.status, 200, JSON.stringify(on.body));
    assert.deepEqual(on.body.census, { on: true, held: 0 });
    assert.notEqual(on.body.head, on.body.parent);
    assert.equal(treeJson(w).census, "on");
    s = await status();
    assert.deepEqual(s.census, { on: true, held: 0 });
    assert.equal(s.queueCounts.kind.census, 1);

    // GET /queue: kind=census; kind=other — an older app (no known=) finds the census task there, one that knows it not
    const ids = async (q: string) => {
      const r = await request(`${url}/queue?${q}`);
      assert.equal(r.status, 200, `${q}: ${JSON.stringify(r.body)}`);
      return (r.body.items as { id: string }[]).map((x) => x.id);
    };
    assert.deepEqual(await ids("kind=census"), ["T0002"]);
    assert.ok((await ids("kind=other")).includes("T0002"));
    assert.ok(!(await ids("kind=other&known=census")).includes("T0002"));
    assert.ok(!(await ids("kind=other&known=census,story.new,lhota")).includes("T0002"), "unknown words ignored");
    assert.ok((await ids("kind=records&known=census")).every((x) => x !== "T0002"), "known without kind=other: ignored");
    for (const bad of ["known=Census", "known=a,,b", "known=" + "x".repeat(33), "known=" + Array.from({ length: 21 }, () => "a").join(","), "known=sčítání"]) {
      const r = await request(`${url}/queue?kind=other&${bad}`);
      assert.deepEqual([r.status, r.body.code], [400, "queue.query"], bad);
    }

    // the research held by another strom: busy, nothing written
    const lock = path.join(w.cwd, ".strom", "tree.lock");
    fs.writeFileSync(lock, JSON.stringify({ pid: process.pid, host: os.hostname(), at: now(), owner: "a test" }));
    try {
      const busy = await request(`${url}/census`, "POST", { on: false });
      assert.deepEqual([busy.status, busy.body.code], [503, "research.busy"]);
    } finally {
      fs.rmSync(lock, { force: true });
    }
    assert.equal(treeJson(w).census, "on");

    // an archive: nobody researches — held 0, nothing written
    await w.ok(["live", "stop"]);
    await w.ok(["config", "set", "census", "off", "--for-tree"], { tty: true });
    await w.ok(["mode", "archive"], { tty: true });
    const url2 = ((await w.ok(["live", "start", "--json"])).json as { url: string }).url;
    assert.deepEqual((await request(`${url2}/status?app=3.28.0`)).body.census, { on: false, held: 0 });
    const refused = await request(`${url2}/census`, "POST", { on: true });
    assert.deepEqual([refused.status, refused.body.code, refused.body.reasonCode], [409, "census.archive", "archive"]);
    assert.equal(treeJson(w).census, "off");
    await w.run(["live", "stop"]);
  } finally {
    w.cleanup();
  }
});

test("the menu's settings: census records of this research with the tasks held, switched on and off by the person; none in an archive", opts, async () => {
  const w = await world();
  try {
    await w.ok(["config", "set", "census", "on", "--for-tree"], { tty: true });
    await addTask(w, "Domácnost Lhotáků 1890", ["--census", "1890:14"]);
    // Settings (8) → the setup's parts (1): census records is the last part shown — 0 back each time
    const pick = (text: string) => {
      const lines = text.split("\n");
      const row = lines.find((l) => /Sčítání lidu v tomto výzkumu/u.test(l));
      return row?.match(/^\s*(\d+)/u)?.[1];
    };
    const look = await w.run([], { tty: true, answers: ["8", "1", "0", "0", "0"] });
    assert.match(look.out, /Sčítání lidu v tomto výzkumu: zapnuto/u, look.out);
    const n = pick(look.out);
    assert.ok(n, look.out);
    const off = await w.run([], { tty: true, answers: ["8", "1", n!, "a", "0", "0"] });
    assert.match(off.out, /Odloženo: 1 úkol sčítání\. Po zapnutí se vrátí\./u, off.out);
    assert.equal(treeJson(w).census, "off");
    const again = await w.run([], { tty: true, answers: ["8", "1", "0", "0", "0"] });
    assert.match(again.out, /Sčítání lidu v tomto výzkumu: vypnuto, odložen 1 úkol sčítání/u, again.out);
    // an archive: nothing of it
    await w.ok(["mode", "archive"], { tty: true });
    const archive = await w.run([], { tty: true, answers: ["8", "1", "0", "0", "0"] });
    assert.doesNotMatch(archive.out, /Sčítání lidu/u);
  } finally {
    w.cleanup();
  }
});
