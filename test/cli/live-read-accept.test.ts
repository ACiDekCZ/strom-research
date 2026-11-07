// A reading the Strom app asks for is accepted at once (202) though its strom takes long to queue it — waiting for the
// tree another process holds, a strom slow to start (the bridge keeping its order, the history packed): the app waits
// 15 s for the answer. Its ID given beforehand (document read --queue --id), said as queued until its strom has queued
// it, the reading then read under the same ID; a strom that does not queue it leaves it failed, said why. POST /read and
// POST /sources/read alike; the same source asked again meanwhile is refused as being read. A made-up reader alone.

import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { World, hasGit, until } from "../helpers.ts";
import { world } from "./excerpts.helpers.ts";
import { halves, jpegWithOrientation } from "../image-samples.ts";
import { now, Tree } from "../../src/core/tree.ts";
import { acquireLock } from "../../src/core/lock.ts";
import { READ_ID } from "../../src/core/document.ts";
import type { Source } from "../../src/core/model.ts";

const opts = { skip: !hasGit || process.platform === "win32", timeout: 180_000 };
const app = { Origin: "https://beta.stromapp.info" };
const sha = (b: Uint8Array) => crypto.createHash("sha256").update(b).digest("hex");

const READER = `import fs from "node:fs";
const p = process.env.STROM_PROMPT ?? "";
const report = /Write your report to (.+) AS YOU GO/.exec(p)[1];
const body = "## Document\\nkind: register.baptism\\nlanguage: cs\\nlegible: yes\\n\\n## Entry e1 · page 1\\ntranscript: Křest Vojtěcha Lhotáka\\nperson: p1 | child | dítě | written=Vojtěch | given=Vojtěch | sex=M\\n\\ndone: 1 entries";
fs.writeFileSync(report, fs.readFileSync(report, "utf8").replace("<!-- next block -->", body + "\\n<!-- next block -->"));
console.log("cost: 0.10");
`;

// a strom that queues a reading slowly while SLOW is there (every strom of the test loads it; only one that queues waits)
const SLOW = `import fs from "node:fs";
if (process.argv.includes("--queue") && fs.existsSync(process.env.SLOW_QUEUE)) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, Number(fs.readFileSync(process.env.SLOW_QUEUE, "utf8")));
`;

/** An answer within `ms`, or the time it took said as never (the app gives up after 15 s). */
function request(method: string, url: string, body?: Uint8Array | string, headers: Record<string, string> = {}, ms = 30_000): Promise<{ status: number; body: Buffer; took: number }> {
  const at = Date.now();
  return new Promise((resolve, reject) => {
    const data = typeof body === "string" ? Buffer.from(body) : body && Buffer.from(body);
    const req = http.request(url, { agent: false, method, headers: { ...(data ? { "Content-Length": String(data.length) } : {}), ...headers } }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (d: Buffer) => chunks.push(d));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks), took: Date.now() - at }));
    });
    req.setTimeout(ms, () => req.destroy(new Error(`no answer within ${ms} ms`)));
    req.on("error", reject);
    req.end(data);
  });
}
const json = (r: { body: Buffer }) => JSON.parse(r.body.toString("utf8"));
const post = (url: string, body: unknown, ms?: number) => request("POST", url, JSON.stringify(body), { ...app, "Content-Type": "application/json" }, ms);
const get = async (url: string) => json(await request("GET", url, undefined, app));

async function setUp(): Promise<{ w: World; dir: string }> {
  const w = await world();
  await w.ok(["lang", "cs"]);
  await w.ok(["source", "add", "Křest Vojtěcha Lhotáka 1850", "--kind", "baptism", "--recordset", "B1", "--clip", "B1:2@0.1,0.2,0.5,0.1"]);
  const tree = Tree.open(w.cwd, w.env);
  tree.actor = "N0001";
  tree.withTreeLock(() => {
    tree.put({ ...tree.get<Source>("S0001")!, transcript: "Křest Vojtěcha Lhotáka", updated: now() }, { op: "source.edit", targets: ["S0001"], summary: "S0001 read by the research" });
    tree.commit("S0001 read by the research");
  });
  const dir = path.join(w.dir, "čtení ž");
  const bin = path.join(dir, "bin");
  fs.mkdirSync(bin, { recursive: true });
  fs.symlinkSync(spawnSync("which", ["git"], { encoding: "utf8" }).stdout.trim(), path.join(bin, "git"));
  fs.symlinkSync(process.execPath, path.join(bin, "node"));
  fs.writeFileSync(path.join(dir, "reader.mjs"), READER);
  fs.writeFileSync(path.join(dir, "slow.mjs"), SLOW);
  Object.assign(w.env, {
    STROM_AGENT: "script",
    STROM_RUNNER_SCRIPT: path.join(dir, "reader.mjs"),
    STROM_NO_CONVERT: "1",
    STROM_LIVE_POLL_MS: "150",
    STROM_READ_ACCEPT_MS: "500",
    STROM_LOCK_WAIT_MS: "4000",
    SLOW_QUEUE: path.join(dir, "slow"),
    NODE_OPTIONS: `--import=${pathToFileURL(path.join(dir, "slow.mjs")).href}`,
    PATH: bin,
  });
  return { w, dir };
}

test("a reading asked while its strom waits for the tree: accepted at once with its ID, said as queued, read under that ID; one whose strom gives up is failed, said why", opts, async () => {
  const { w } = await setUp();
  let started = false;
  let release: (() => void) | undefined;
  try {
    const url = ((await w.ok(["live", "start", "--json"])).json as { url: string }).url;
    started = true;
    const photo = jpegWithOrientation(halves(1600, 1200), 1);
    assert.equal((await request("PUT", `${url}/media/${sha(photo)}`, photo, { ...app, "Content-Type": "application/octet-stream", "X-Strom-Read": "1" })).status, 200);
    const lock = path.join(w.cwd, ".strom", "tree.lock");

    // another process holds the tree: the bridge answers long before its strom could queue the reading
    release = acquireLock(lock, { owner: "test ř" });
    const asked = await post(`${url}/read`, { files: [sha(photo)], lang: "cs" }, 3_000);
    assert.equal(asked.status, 202, asked.body.toString());
    const a = json(asked);
    assert.match(a.read, READ_ID);
    assert.deepEqual([a.state, a.version], ["queued", 1]);
    assert.ok(asked.took < 3_000, `answered in ${asked.took} ms`);
    // said as queued before its strom has written it
    assert.equal(fs.existsSync(path.join(w.cwd, ".strom", "reads", `${a.read}.json`)), false, "not queued yet by its strom");
    assert.equal((await get(`${url}/read/${a.read}`)).state, "queued");
    release();
    release = undefined;
    // its strom queues it under that ID, and it is read
    await until("read", async () => (await get(`${url}/read/${a.read}`)).state === "done", { ms: 60_000 });
    const done = await get(`${url}/read/${a.read}`);
    assert.equal(done.id, a.read);
    assert.ok((await get(`${url}/reads`)).reads.some((r: { id: string }) => r.id === a.read));

    // the tree held longer than its strom waits: the reading accepted is left failed, said why
    release = acquireLock(lock, { owner: "test ř" });
    const late = await post(`${url}/read`, { files: [sha(photo)], lang: "cs" }, 3_000);
    assert.equal(late.status, 202, late.body.toString());
    const b = json(late).read;
    await until("failed", async () => (await get(`${url}/read/${b}`)).state === "failed", { ms: 30_000 });
    release();
    release = undefined;
    const failed = JSON.parse(fs.readFileSync(path.join(w.cwd, ".strom", "reads", `${b}.json`), "utf8"));
    assert.equal(failed.state, "failed");
    assert.match(failed.error, /lock|busy|another/iu, failed.error);
  } finally {
    release?.();
    if (started) await w.run(["live", "stop"]);
    w.cleanup();
  }
});

test("a source read again whose strom is slow to queue it: accepted at once, the same source refused as being read meanwhile, read under its ID", opts, async () => {
  const { w, dir } = await setUp();
  let started = false;
  try {
    const url = ((await w.ok(["live", "start", "--json"])).json as { url: string }).url;
    started = true;
    fs.writeFileSync(path.join(dir, "slow"), "6000");
    const asked = await post(`${url}/sources/read`, { source: "S0001" }, 3_000);
    assert.equal(asked.status, 202, asked.body.toString());
    const a = json(asked);
    assert.match(a.read, READ_ID);
    assert.deepEqual([a.state, a.version, a.source], ["queued", 1, "S0001"]);
    assert.equal((await get(`${url}/read/${a.read}`)).state, "queued");
    const again = await post(`${url}/sources/read`, { source: "S0001" }, 3_000);
    assert.deepEqual([again.status, json(again).code, json(again).read], [409, "read.source.running", a.read]);
    fs.rmSync(path.join(dir, "slow"));
    await until("read again", async () => (await get(`${url}/read/${a.read}`)).state === "done", { ms: 60_000 });
    assert.deepEqual(Tree.open(w.cwd, w.env).get<Source>("S0001")!.readings, [a.read]);
  } finally {
    if (started) await w.run(["live", "stop"]);
    w.cleanup();
  }
});

test("document read --id: only with --queue, a reading's ID, never one there is", opts, async () => {
  const w = await world();
  try {
    const no = await w.run(["document", "read", "M0001", "--id", "D20261107120000-ab12", "--json"]);
    assert.notEqual(no.code, 0);
    assert.match(no.out, /--id is given only with --queue/);
    const bad = await w.run(["document", "read", "M0001", "--queue", "--id", "D2026-ž", "--json"]);
    assert.notEqual(bad.code, 0);
    assert.match(bad.out, /invalid --id/);
    const ok = await w.ok(["document", "read", "M0001", "--queue", "--id", "D20261107120000-ab12", "--json"]);
    assert.equal(ok.json.id, "D20261107120000-ab12");
    const twice = await w.run(["document", "read", "M0001", "--queue", "--id", "D20261107120000-ab12", "--json"]);
    assert.notEqual(twice.code, 0);
    assert.match(twice.out, /D20261107120000-ab12 is a reading there is already/);
  } finally {
    w.cleanup();
  }
});
