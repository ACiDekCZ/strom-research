// The batches the Strom app (or a phone) sends sorted by the agent only once the person turns it on (spec 130):
// intake.auto off by default — in a research of an older strom too — so a batch closed (the app's done, a phone, a day
// or an hour without a file) makes no sorting task and its files wait in the material; on: sorting tasks as before. The
// batch's own choice (the app's, --sort / --no-sort) wins for it alone, and a batch closed unsorted is sorted when
// asked; sorting tasks made already stay when it is turned off. Only the person turns it on (an agent: exit 4); the
// bridge: /status intake {auto}, feature intake.auto, POST /intake {auto}, POST /batch/<id>/done {sort}.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import type { Input, Task } from "../../src/core/model.ts";

const opts = { skip: !hasGit || process.platform === "win32", timeout: 240_000 };
const APP = "https://beta.stromapp.info";
const UNATTENDED = { AI_AGENT: "1", STROM_NONINTERACTIVE: "1" };
const fixtures = path.join(import.meta.dirname, "..", "fixtures", "images");
const read = (f: string) => fs.readFileSync(path.join(fixtures, f));
const sha = async (b: Buffer) => (await import("node:crypto")).createHash("sha256").update(b).digest("hex");

type Answer = { status: number; body: any };
function request(url: string, method = "GET", body?: unknown, headers: Record<string, string> = {}): Promise<Answer> {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? undefined : Buffer.isBuffer(body) ? body : Buffer.from(typeof body === "string" ? body : JSON.stringify(body), "utf8");
    const req = http.request(url, { agent: false, method, headers: { Origin: APP, ...(data ? { "Content-Type": "text/plain;charset=UTF-8", "Content-Length": String(data.length) } : {}), ...headers } }, (res) => {
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

const treeJson = (w: World) => JSON.parse(fs.readFileSync(path.join(w.cwd, "strom.json"), "utf8"));
const sortingTasks = (w: World) => Tree.open(w.cwd, w.env).list<Task>("task").filter((t) => t.level === "intake" && t.origin === "app:batch");
const batchFile = (w: World, id: string) => path.join(w.cwd, ".strom", "batches", `${id}.json`);

/** A file of a batch sent as the bridge would take it (strom media original --batch). */
async function send(w: World, batch: string, fixture: string, where: string): Promise<string> {
  const f = path.join(w.dir, path.basename(where));
  fs.copyFileSync(path.join(fixtures, fixture), f);
  return (await w.ok(["media", "original", f, "--batch", batch, "--path", where, "--json"])).json.input as string;
}

test("intake.auto off by default: a closed batch (the app, a phone, idle) makes no task, its files wait; --sort sorts it once, --no-sort keeps it; on as before; off again keeps the tasks made; only the person turns it on", opts, async () => {
  const w = new World();
  try {
    await w.withTree("Lhotákovi");
    await w.ok(["lang", "cs"]);
    await w.ok(["person", "add", "Vojtěch /Lhoták/", "--sex", "M"]); // P0001
    assert.equal((await w.ok(["config", "get", "intake.auto", "--json"])).json.value, "off");
    assert.equal(treeJson(w)["intake.auto"], undefined, "nothing written for it: a research of an older strom reads the same");

    // the app said it is whole: no task, the files wait in the material unsorted
    const A = "a0b1c2d3-e4f5-4a6b";
    const a1 = await send(w, A, "s0001.jpg", "Půda/Dopis 1946.jpg");
    await send(w, A, "png-bw.png", "Půda/Фото.png".normalize("NFD"));
    const closed = (await w.ok(["input", "batch", "done", A, "--name", "Krabice z půdy", "--person", "P0001", "--json"])).json;
    assert.deepEqual([closed.tasks, closed.auto, closed.sort, closed.inputs], [[], false, false, 2]);
    assert.equal(sortingTasks(w).length, 0);
    assert.equal(Tree.open(w.cwd, w.env).get<Input>(a1)!.state, "new");
    assert.equal(JSON.parse(fs.readFileSync(batchFile(w, A), "utf8")).sort, false);
    const text = await w.ok(["input", "batch", "done", A]);
    assert.match(text.out, /not sorted: the files wait in the material/u);
    const listed = (await w.ok(["input", "batch", "--json"])).json.batches;
    assert.deepEqual([listed[0].state, listed[0].tasks, listed[0].sorted], ["closed", [], 0]);

    // a phone's batch closed an hour after its last photo: the same setting
    const P = "b1c2d3e4-f5a6-4b7c";
    await send(w, P, "png-rgba.png", "IMG_0001.png");
    fs.writeFileSync(batchFile(w, P), JSON.stringify({ ...JSON.parse(fs.readFileSync(batchFile(w, P), "utf8")), from: "phone" }));
    assert.deepEqual((await w.ok(["input", "batch", "done", P, "--idle", "--json"])).json.tasks, []);

    // this batch sorted when asked (the app's choice): its tasks made now, once
    const sorted = (await w.ok(["input", "batch", "done", A, "--sort", "--json"])).json;
    assert.equal(sorted.tasks.length, 1);
    assert.equal(sorted.sort, true);
    const t = Tree.open(w.cwd, w.env).get<Task>(sorted.tasks[0])!;
    assert.deepEqual([t.state, t.where.length], ["open", 2]);
    assert.match(t.what, /Krabice z půdy/u);
    assert.ok(t.subject.includes("P0001"), "the batch's person in its task");
    assert.deepEqual((await w.ok(["input", "batch", "done", A, "--sort", "--json"])).json.tasks, sorted.tasks, "asked again: the same tasks, none more");
    assert.equal(sortingTasks(w).length, 1);
    assert.equal(JSON.parse(fs.readFileSync(batchFile(w, A), "utf8")).sort, undefined);
    const both = await w.run(["input", "batch", "done", A, "--sort", "--no-sort"]);
    assert.notEqual(both.code, 0);

    // an agent never turns it on (it spends the plan and changes the tree unasked)
    const agentOn = await w.run(["config", "set", "intake.auto", "on", "--for-tree"], { env: UNATTENDED });
    assert.equal(agentOn.code, 4, agentOn.out + agentOn.err);
    assert.equal(treeJson(w)["intake.auto"], undefined);
    // the person does: a batch closed is sorted as before
    await w.ok(["config", "set", "intake.auto", "on", "--for-tree"], { tty: true });
    assert.equal(treeJson(w)["intake.auto"], "on");
    const C = "c2d3e4f5-a6b7-4c8d";
    await send(w, C, "grey.jpg", "Fotky/grey.jpg");
    const on = (await w.ok(["input", "batch", "done", C, "--json"])).json;
    assert.deepEqual([on.tasks.length, on.auto, on.sort], [1, true, true]);
    // …unless this batch says no
    const D = "d3e4f5a6-b7c8-4d9e";
    await send(w, D, "s0002.jpg", "Matrika/0012.jpg");
    const no = (await w.ok(["input", "batch", "done", D, "--no-sort", "--json"])).json;
    assert.deepEqual([no.tasks, no.auto, no.sort], [[], true, false]);

    // off again (anyone's, an agent's too): the sorting tasks made already stay as they are
    await w.ok(["config", "set", "intake.auto", "off", "--for-tree"], { env: UNATTENDED });
    assert.equal(treeJson(w)["intake.auto"], "off");
    assert.deepEqual(sortingTasks(w).map((x) => x.state), ["open", "open"]);
    const E = "e4f5a6b7-c8d9-4e0f";
    await send(w, E, "s0003.jpg", "Matrika/0013.jpg");
    assert.deepEqual((await w.ok(["input", "batch", "done", E, "--json"])).json.tasks, []);
    assert.equal((await w.ok(["check"])).code, 0);
  } finally {
    w.cleanup();
  }
});

test("the bridge: /status intake and its feature, POST /intake the person's switch from the app, batch/done of an older app by the setting, {sort} for this batch alone; an archive has none of it", opts, async () => {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["lang", "cs"]);
  await w.ok(["person", "add", "Vojtěch /Lhoták/", "--sex", "M"]); // P0001
  w.env.STROM_LIVE_POLL_MS = "100";
  const info = (await w.ok(["live", "start", "--json"])).json;
  const put = async (batch: string, fixture: string, where: string) => {
    const b = read(fixture);
    const r = await request(`${info.url}/media/${await sha(b)}`, "PUT", b, { "X-Strom-Batch": batch, "X-Strom-Path": encodeURIComponent(where), "Content-Type": "application/octet-stream" });
    assert.equal(r.status, 200, JSON.stringify(r.body));
  };
  try {
    let status = (await request(`${info.url}/status`)).body;
    assert.ok(status.features.includes("intake.auto"));
    assert.deepEqual(status.intake, { auto: false });

    // an older app (no sort): by the setting — off, no task
    const A = "1a2b3c4d-5e6f-4a7b";
    await put(A, "s0001.jpg", "Krabice/Dopis.jpg");
    const done = await request(`${info.url}/batch/${A}/done`, "POST", { name: "Krabice", person: "P0001" });
    assert.equal(done.status, 200, JSON.stringify(done.body));
    assert.deepEqual([done.body.tasks, done.body.auto, done.body.sort], [[], false, false]);
    assert.equal(done.body.head, done.body.parent, "nothing of the research written");
    // sort is a boolean
    const bad = await request(`${info.url}/batch/${A}/done`, "POST", { sort: "yes" });
    assert.deepEqual([bad.status, bad.body.code], [400, "batch.bad-body"]);
    // this batch sorted when the app asks for it
    const sorted = await request(`${info.url}/batch/${A}/done`, "POST", { sort: true });
    assert.equal(sorted.status, 200, JSON.stringify(sorted.body));
    assert.equal(sorted.body.tasks.length, 1);
    assert.notEqual(sorted.body.head, sorted.body.parent);

    // the person's switch in the app's research settings
    for (const body of [{}, { auto: "on" }, { auto: true, more: 1 }]) {
      const r = await request(`${info.url}/intake`, "POST", body);
      assert.deepEqual([r.status, r.body.code], [400, "intake.body"], JSON.stringify(body));
    }
    const turned = await request(`${info.url}/intake`, "POST", { auto: true });
    assert.equal(turned.status, 200, JSON.stringify(turned.body));
    assert.deepEqual(turned.body.intake, { auto: true });
    assert.notEqual(turned.body.head, turned.body.parent);
    assert.equal(treeJson(w)["intake.auto"], "on");
    const again = await request(`${info.url}/intake`, "POST", { auto: true });
    assert.equal(again.body.head, again.body.parent, "as it is already: nothing written");
    status = (await request(`${info.url}/status`)).body;
    assert.deepEqual(status.intake, { auto: true });

    // on: an older app's batch sorted as before; {sort: false} keeps this one unsorted
    const B = "2b3c4d5e-6f7a-4b8c";
    await put(B, "png-bw.png", "Fotky/foto.png");
    const onDone = (await request(`${info.url}/batch/${B}/done`, "POST", {})).body;
    assert.deepEqual([onDone.tasks.length, onDone.auto, onDone.sort], [1, true, true]);
    const C = "3c4d5e6f-7a8b-4c9d";
    await put(C, "png-rgba.png", "Fotky/druhé.png");
    const kept = (await request(`${info.url}/batch/${C}/done`, "POST", { sort: false })).body;
    assert.deepEqual([kept.tasks, kept.sort], [[], false]);

    const off = await request(`${info.url}/intake`, "POST", { auto: false });
    assert.deepEqual([off.status, off.body.intake], [200, { auto: false }]);
    assert.equal(sortingTasks(w).filter((t) => t.state === "open").length, 2, "the tasks made already stay");
  } finally {
    await w.ok(["live", "stop"]);
    w.cleanup();
  }

  // an archive: nothing is sorted there — no intake in /status, the switch refused
  const a = new World();
  try {
    await a.ok(["setup", "--yes"]);
    await a.ok(["init", "Archiv", "--mode", "archive"]);
    a.cwd = a.treeDir("Archiv");
    a.env.STROM_LIVE_POLL_MS = "100";
    const arch = (await a.ok(["live", "start", "--json"])).json;
    try {
      assert.equal((await request(`${arch.url}/status`)).body.intake, undefined);
      const r = await request(`${arch.url}/intake`, "POST", { auto: true });
      assert.deepEqual([r.status, r.body.code], [409, "intake.archive"]);
    } finally {
      await a.ok(["live", "stop"]);
    }
  } finally {
    a.cleanup();
  }
});
