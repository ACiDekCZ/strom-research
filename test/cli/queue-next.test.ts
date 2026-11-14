// "Do it next" (spec 052 U9; the app's ZADANI_VYZKUM_hledani-ve-fronte.md, section 4): among the tasks the person put
// next, the last chosen goes first (the one at work stays first); the answer to POST /queue/<T…> says the turn before
// (was), and {do: "restore", was} puts it back exactly — strom task order --restore <next|last>@<time>; strom run takes
// the task put next right after the one at work. Made-up names only (Lhoták, Lhota).

import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import http from "node:http";
import { World, hasGit } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import type { Task } from "../../src/core/model.ts";

const skip = !hasGit || process.platform === "win32";
const opts = { skip, timeout: 240_000 };
const APP = "https://beta.stromapp.info";

type Answer = { status: number; body: any };
function request(url: string, method = "GET", body?: unknown): Promise<Answer> {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? undefined : Buffer.from(JSON.stringify(body), "utf8");
    const req = http.request(url, { agent: false, method, headers: { Origin: APP, ...(data ? { "Content-Type": "text/plain;charset=UTF-8", "Content-Length": String(data.length) } : {}) } }, (res) => {
      let text = "";
      res.setEncoding("utf8");
      res.on("data", (d) => (text += d));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, body: JSON.parse(text) }));
    });
    req.on("error", reject);
    req.end(data);
  });
}

/** Jan Lhoták (P1) and four tasks of his line, T1 the highest priority. */
async function world(): Promise<World> {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["lang", "cs"]);
  await w.ok(["research", "new", "Předci Jana", "--new-person", "Jan /Lhoták/", "--sex", "M"]);
  for (const [what, priority] of [["Křest Jana", "5"], ["Oddavky rodičů", "4"], ["Křest otce", "3"], ["Úmrtí děda", "2"]] as const)
    await w.ok(["task", "add", what, "--level", "locate", "--where", "katalog archivu Lhota", "--why", "rodiče", "--done-when", "zápis", "--about", "P1", "--priority", priority]);
  return w;
}

const order = async (w: World) => ((await w.ok(["task", "list", "--json"])).json.tasks as { id: string }[]).map((t) => t.id);
const queueAt = async (w: World, id: string) => (await w.ok(["task", "show", id, "--json"])).json.task.queueAt as { do: string; at: string } | undefined;
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

test("task order: the last put next goes first; --restore puts a turn back exactly as it was; the answer says was; refused times", { skip: !hasGit }, async () => {
  const w = await world();
  try {
    assert.deepEqual(await order(w), ["T0001", "T0002", "T0003", "T0004"]);
    const first = (await w.ok(["task", "order", "T3", "--next", "--json"])).json;
    assert.deepEqual(first.was, {}, "no turn of its own before");
    await w.ok(["task", "order", "T4", "--next"]);
    assert.deepEqual(await order(w), ["T0004", "T0003", "T0001", "T0002"], "the last chosen first");
    assert.match((await w.ok(["task", "order", "T4", "--next"])).out, /nothing to change/u, "already the last chosen");
    // T3 again: on top, its turn before said exactly
    const t3 = await queueAt(w, "T3");
    const again = (await w.ok(["task", "order", "T3", "--default", "--json"])).json;
    assert.deepEqual(again.was, { own: "next", at: t3!.at });
    await w.ok(["task", "order", "T3", "--next"]);
    assert.deepEqual((await order(w)).slice(0, 2), ["T0003", "T0004"]);
    // put back as it was: an older time goes back among the others exactly — behind T4
    await w.ok(["task", "order", "T3", "--restore", `next@${t3!.at}`]);
    assert.deepEqual(await queueAt(w, "T3"), { do: "next", at: t3!.at });
    assert.deepEqual(await order(w), ["T0004", "T0003", "T0001", "T0002"]);
    // the same once more: nothing to change, nothing written
    const head = (await w.ok(["history", "--json"])).out;
    assert.match((await w.ok(["task", "order", "T3", "--restore", `next@${t3!.at}`])).out, /nothing to change/u);
    assert.equal((await w.ok(["history", "--json"])).out, head);
    // last, as it was
    const lastAt = ago(3_600_000);
    await w.ok(["task", "order", "T1", "--restore", `last@${lastAt}`]);
    assert.deepEqual(await queueAt(w, "T1"), { do: "last", at: lastAt });
    assert.equal((await order(w)).pop(), "T0001");
    // refused: a time to come, older than 30 days, no time, another turn, not an ISO time, with another choice
    for (const bad of [`next@${new Date(Date.now() + 3_600_000).toISOString()}`, `next@${ago(31 * 86_400_000)}`, "next", `first@${ago(1000)}`, "next@včera", `next@${ago(1000).slice(0, 10)}`]) {
      const r = await w.run(["task", "order", "T2", "--restore", bad, "--json"]);
      assert.equal(JSON.parse(r.out).code, "queue.body", bad);
    }
    assert.equal(JSON.parse((await w.run(["task", "order", "T2", "--restore", `next@${ago(1000)}`, "--next", "--json"])).out).code, "queue.body");
    assert.equal(await queueAt(w, "T2"), undefined, "nothing written by a refusal");
    // a time with an offset: kept as strom writes times (UTC)
    await w.ok(["task", "order", "T2", "--restore", "next@" + new Date(Date.now() - 7_200_000).toISOString().replace(/\.\d{3}Z$/u, "+00:00")]);
    assert.match((await queueAt(w, "T2"))!.at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.000Z$/u);
  } finally {
    w.cleanup();
  }
});

test("bridge: POST /queue/<T…> says was; {do: restore} puts the turn back exactly ({} = default, next, last); 400 for a time to come, too old, a key not known; 409 at work, 404 closed; feature queue.next", opts, async () => {
  const w = await world();
  try {
    const url = ((await w.ok(["live", "start", "--json"])).json as { url: string }).url;
    const s = (await request(`${url}/status?app=3.24.0`)).body;
    assert.ok(s.features.includes("queue.next"));
    const ids = async () => ((await request(`${url}/queue`)).body.items as { id: string }[]).map((x) => x.id);

    const a = await request(`${url}/queue/T3`, "POST", { do: "next" });
    assert.equal(a.status, 200, JSON.stringify(a.body));
    assert.deepEqual(a.body.was, {});
    const b = await request(`${url}/queue/T4`, "POST", { do: "next" });
    assert.deepEqual(b.body.was, {});
    assert.deepEqual(await ids(), ["T0004", "T0003", "T0001", "T0002"], "the last chosen first");
    const t3at = (await queueAt(w, "T3"))!.at;
    // T3 next again: on top; was says its turn before, to put back exactly
    const c = await request(`${url}/queue/T3`, "POST", { do: "next" });
    assert.deepEqual(c.body.was, { own: "next", at: t3at });
    assert.deepEqual((await ids()).slice(0, 2), ["T0003", "T0004"]);
    const back = await request(`${url}/queue/T3`, "POST", { do: "restore", was: c.body.was });
    assert.equal(back.status, 200, JSON.stringify(back.body));
    assert.equal(back.body.task.own, "next");
    assert.match(back.body.head, /^[0-9a-f]{40}$/u);
    assert.notEqual(back.body.head, back.body.parent);
    assert.deepEqual(await queueAt(w, "T3"), { do: "next", at: t3at });
    assert.deepEqual(await ids(), ["T0004", "T0003", "T0001", "T0002"], "back exactly among the others");
    // from none: {} = default
    const d = await request(`${url}/queue/T1`, "POST", { do: "last" });
    assert.deepEqual(d.body.was, {});
    assert.equal((await ids()).pop(), "T0001");
    const none = await request(`${url}/queue/T1`, "POST", { do: "restore", was: d.body.was });
    assert.deepEqual([none.status, none.body.task.own], [200, undefined]);
    assert.equal(await queueAt(w, "T1"), undefined);
    // from last
    const lastAt = ago(86_400_000);
    const e = await request(`${url}/queue/T2`, "POST", { do: "restore", was: { own: "last", at: lastAt } });
    assert.deepEqual([e.status, e.body.task.own, e.body.was], [200, "last", {}]);
    assert.deepEqual(await queueAt(w, "T2"), { do: "last", at: lastAt });
    const f = await request(`${url}/queue/T2`, "POST", { do: "next" });
    assert.deepEqual(f.body.was, { own: "last", at: lastAt });

    // refused: a time to come, older than 30 days, a key not known, a turn not known, was missing or not an object
    const before = await queueAt(w, "T2");
    for (const body of [
      { do: "restore", was: { own: "next", at: new Date(Date.now() + 3_600_000).toISOString() } },
      { do: "restore", was: { own: "next", at: ago(31 * 86_400_000) } },
      { do: "restore", was: { own: "next", at: ago(1000), why: "x" } },
      { do: "restore", was: { own: "first", at: ago(1000) } },
      { do: "restore", was: { own: "next" } },
      { do: "restore", was: { at: ago(1000) } },
      { do: "restore", was: { own: "next", at: "včera" } },
      { do: "restore" },
      { do: "restore", was: [] },
      { do: "restore", was: "next" },
      { do: "next", was: {} },
    ]) {
      const r = await request(`${url}/queue/T2`, "POST", body);
      assert.deepEqual([r.status, r.body.code], [400, "queue.body"], JSON.stringify(body));
    }
    assert.deepEqual(await queueAt(w, "T2"), before, "nothing written by a refusal");
    // at work: 409; closed: 404
    await w.ok(["session", "start", "T1"]);
    const doing = await request(`${url}/queue/T1`, "POST", { do: "restore", was: {} });
    assert.deepEqual([doing.status, doing.body.code], [409, "queue.doing"]);
    await w.ok(["task", "done", "T1", "--result", "nalezeno"]);
    await w.ok(["session", "close", "--summary", "hotovo", "--next", "dál"]);
    const closed = await request(`${url}/queue/T1`, "POST", { do: "restore", was: { own: "next", at: ago(1000) } });
    assert.deepEqual([closed.status, closed.body.code], [404, "queue.none"]);
  } finally {
    await w.run(["live", "stop"]);
    w.cleanup();
  }
});

test("strom run: the task put next is taken right after the one at work", { skip: !hasGit }, async () => {
  const w = await world();
  try {
    // T2 at work (a session on it ended without a word): taken first; T4 and T3 put next — T3 the last
    const tree = Tree.open(w.cwd, w.env);
    tree.withTreeLock(() => {
      const t = tree.get<Task>("T0002")!;
      tree.putMany([{ ...t, state: "doing" }], [], { op: "task.edit", targets: [t.id], summary: `${t.id} at work` });
    });
    tree.commit("T0002 at work");
    await w.ok(["task", "order", "T4", "--next"]);
    await w.ok(["task", "order", "T3", "--next"]);
    Object.assign(w.env, { STROM_RUNNER_SCRIPT: path.join(import.meta.dirname, "..", "fixtures", "agent.ts"), AGENT_MODE: "echo" });
    const run = await w.ok(["run", "--agent", "script", "--max", "3", "--json"]);
    assert.deepEqual(run.json.sessions.map((s: { task: string }) => s.task), ["T0002", "T0003", "T0004"], run.out);
  } finally {
    w.cleanup();
  }
});
