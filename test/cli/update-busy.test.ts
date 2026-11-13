// Work under way in a research (spec 037): what the bridge says of it to the Strom app (/status busy), and a newer
// schema never brought to a research while a strom of another version works in it — that one would go on with data
// it does not know.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { World, hasGit, readJsonFile } from "../helpers.ts";
import { enterWorker, otherVersionsAtWork } from "../../src/core/workers.ts";
import { busyIn, isBusy } from "../../src/core/busy.ts";
import { Tree, VERSION } from "../../src/core/tree.ts";
import { SCHEMA_VERSION } from "../../src/core/model.ts";

const opts = { skip: !hasGit || process.platform === "win32" };

function getJson(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { agent: false, headers: { Origin: "https://beta.stromapp.info" } }, (res) => {
      const parts: Buffer[] = [];
      res.on("data", (c: Buffer) => parts.push(c));
      res.on("end", () => resolve(JSON.parse(Buffer.concat(parts).toString("utf8"))));
    });
    req.on("error", reject);
    req.end();
  });
}

test("the bridge's /status says what works in the research: the sessions open and the runs (busy), feature status.busy", opts, async () => {
  const w = new World();
  await w.withTree("Lhotákovi");
  try {
    const info = (await w.ok(["live", "start", "--json"])).json as { url: string };
    const idle = await getJson(`${info.url}/status`);
    assert.ok(idle.features.includes("status.busy"));
    assert.deepEqual(idle.busy, { sessions: 0, runs: 0 });
    // before the link work: no gate set (null: the loop not started, n tasks are), a session's minutes as set
    assert.ok(idle.features.includes("work.link") && idle.features.includes("run.tasks"));
    assert.deepEqual(idle.work, { gate: null, minutes: 60 });
    await w.ok(["config", "set", "run.minutes", "25"]);
    assert.deepEqual((await getJson(`${info.url}/status`)).work, { gate: null, minutes: 25 });
    await w.ok(["session", "start"]);
    const leave = enterWorker(w.cwd, "run-1", "strom run", VERSION);
    try {
      assert.deepEqual((await getJson(`${info.url}/status`)).busy, { sessions: 1, runs: 1 });
      const b = busyIn(Tree.open(w.cwd, w.env));
      assert.equal(b.sessions.length, 1);
      assert.ok(isBusy(b));
    } finally {
      leave();
    }
    await w.ok(["session", "end", "--note", "Nic nenalezeno v Lhotě."]).catch(() => undefined);
  } finally {
    await w.run(["live", "stop"]);
    w.cleanup();
  }
});

test("a research of an older schema is not brought to this one while a strom of another version works in it (tree.migrate.busy, nothing written); once it ended, nothing of the kind stops it", opts, async () => {
  const w = new World();
  await w.withTree("Lhotákovi");
  try {
    const file = path.join(w.cwd, "strom.json");
    const cfg = readJsonFile(file) as { schema: number };
    assert.equal(cfg.schema, SCHEMA_VERSION);
    const older = { ...cfg, schema: SCHEMA_VERSION - 1 };
    fs.writeFileSync(file, JSON.stringify(older, null, 2) + "\n");
    const before = fs.readFileSync(file, "utf8");
    const leave = enterWorker(w.cwd, "chat-1", "strom chat", "0.9.0");
    try {
      assert.deepEqual(otherVersionsAtWork(w.cwd, VERSION), ["0.9.0"]);
      const r = await w.run(["person", "list", "--json"]);
      assert.notEqual(r.code, 0);
      assert.equal(r.json?.code, "tree.migrate.busy", r.out + r.err);
      assert.equal(fs.readFileSync(file, "utf8"), before, "nothing written");
      // a worker of this version is no reason to wait
      const own = enterWorker(w.cwd, "chat-2", "strom chat", VERSION);
      assert.deepEqual(otherVersionsAtWork(w.cwd, VERSION), ["0.9.0"]);
      own();
    } finally {
      leave();
    }
    assert.deepEqual(otherVersionsAtWork(w.cwd, VERSION), []);
    // (the file edited by hand here: the seal stops it next — no longer the work of another version)
    const after = await w.run(["person", "list", "--json"]);
    assert.notEqual(after.json?.code, "tree.migrate.busy", after.out);
  } finally {
    w.cleanup();
  }
});
