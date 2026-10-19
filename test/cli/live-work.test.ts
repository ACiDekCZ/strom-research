// The bridge while somebody works in the tree: its idle time does not run (the Strom app watching the tree without
// following it, /status?poll=1, still finds it), and new work brings back a bridge that ended idle at its address —
// never one ended for good (strom live stop), never in an archive.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";
import { enterWorker } from "../../src/core/workers.ts";
import { reviveLive } from "../../src/core/live.ts";

const opts = { skip: !hasGit || process.platform === "win32" };
const APP = "https://beta.stromapp.info";

type Info = { pid: number; port: number; token: string; url: string };

function ask(url: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { agent: false, headers: { Origin: APP } }, (res) => {
      res.resume();
      res.on("end", () => resolve(res.statusCode ?? 0));
    });
    req.on("error", reject);
    req.end();
  });
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const until = async (what: string, ok: () => boolean, ms = 20_000) => {
  for (const end = Date.now() + ms; Date.now() < end; await wait(100)) if (ok()) return;
  assert.fail(`waited in vain: ${what}`);
};

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function bridge(env: Record<string, string>) {
  const w = new World();
  await w.withTree();
  Object.assign(w.env, env);
  const info = (await w.ok(["live", "start", "--json"])).json as Info;
  const log = () => fs.readFileSync(path.join(w.cwd, ".strom", "live.log"), "utf8");
  const running = () => {
    try {
      return JSON.parse(fs.readFileSync(path.join(w.cwd, ".strom", "live.json"), "utf8")) as Info;
    } catch {
      return undefined;
    }
  };
  return { w, info, log, running };
}

test("the bridge does not end idle while somebody works in the tree; once nobody does, it ends after its idle time", opts, async () => {
  const b = await bridge({ STROM_LIVE_IDLE_MS: "600", STROM_LIVE_POLL_MS: "100" });
  const leave = enterWorker(b.w.cwd, "run-1", "strom run");
  try {
    await wait(2500);
    assert.ok(alive(b.info.pid), "still running: an agent is at work");
    assert.equal(await ask(`${b.info.url}/status?poll=1`), 200);
    assert.doesNotMatch(b.log(), /ended: idle/);
    leave();
    await until("the bridge ended idle once nobody works", () => !alive(b.info.pid) && /ended: idle/.test(b.log()), 10_000);
  } finally {
    leave();
    await b.w.run(["live", "stop"]);
    b.w.cleanup();
  }
});

test("/status?poll=1 keeps no bridge running", opts, async () => {
  const b = await bridge({ STROM_LIVE_IDLE_MS: "800", STROM_LIVE_POLL_MS: "100" });
  try {
    const end = Date.now() + 10_000;
    while (Date.now() < end && alive(b.info.pid)) {
      await ask(`${b.info.url}/status?poll=1`).catch(() => 0);
      await wait(200);
    }
    assert.ok(!alive(b.info.pid), "the bridge ended though the app kept polling");
    assert.match(b.log(), /ended: idle/);
  } finally {
    await b.w.run(["live", "stop"]);
    b.w.cleanup();
  }
});

test("a bridge that ended idle comes back at its address (port and secret) when a session starts", opts, async () => {
  const b = await bridge({ STROM_LIVE_IDLE_MS: "400", STROM_LIVE_POLL_MS: "100" });
  try {
    await until("the bridge ended idle", () => !alive(b.info.pid) && /ended: idle/.test(b.log()));
    assert.equal(b.running(), undefined);
    // the bridge it brings back lives long enough to be asked
    b.w.env.STROM_LIVE_IDLE_MS = "60000";
    await b.w.ok(["session", "start"]);
    const back = b.running();
    assert.ok(back, "a bridge runs again");
    assert.notEqual(back.pid, b.info.pid);
    assert.equal(back.port, b.info.port);
    assert.equal(back.token, b.info.token);
    assert.equal(await ask(`${b.info.url}/status?poll=1`), 200, "the address the app kept works");
    assert.match(b.log(), /work in the tree again: the bridge \d+ that ended idle started again at its address/);
  } finally {
    await b.w.run(["live", "stop"]);
    b.w.cleanup();
  }
});

test("a bridge ended with strom live stop does not come back when a session starts; nor one that ended idle in an archive", opts, async () => {
  const b = await bridge({ STROM_LIVE_IDLE_MS: "60000", STROM_LIVE_POLL_MS: "100" });
  try {
    await b.w.ok(["live", "stop"]);
    await b.w.ok(["session", "start"]);
    await wait(500);
    assert.equal(b.running(), undefined, "no bridge after strom live stop");
    assert.doesNotMatch(b.log(), /work in the tree again/);
  } finally {
    await b.w.run(["live", "stop"]);
    b.w.cleanup();
  }
  const a = await bridge({ STROM_LIVE_IDLE_MS: "400", STROM_LIVE_POLL_MS: "100" });
  try {
    await until("the bridge ended idle", () => !alive(a.info.pid) && /ended: idle/.test(a.log()));
    const file = path.join(a.w.cwd, "strom.json");
    fs.writeFileSync(file, JSON.stringify({ ...JSON.parse(fs.readFileSync(file, "utf8")), mode: "archive" }, null, 2));
    assert.equal(reviveLive(a.w.cwd, { ...process.env, ...a.w.env }, { work: true }), undefined);
    assert.equal(a.running(), undefined, "no bridge in an archive");
    assert.doesNotMatch(a.log(), /work in the tree again/);
  } finally {
    await a.w.run(["live", "stop"]);
    a.w.cleanup();
  }
});

test("a bridge that ended idle and does not come up again is tried once, not at every session", opts, async () => {
  const b = await bridge({ STROM_LIVE_IDLE_MS: "400", STROM_LIVE_POLL_MS: "100" });
  try {
    await until("the bridge ended idle", () => !alive(b.info.pid) && /ended: idle/.test(b.log()));
    // a bridge that cannot start: node refuses to run it
    const broken = { ...process.env, ...b.w.env, NODE_OPTIONS: `--require=${path.join(b.w.cwd, "no-such-module.cjs")}` };
    assert.equal(reviveLive(b.w.cwd, broken, { work: true }), undefined);
    assert.equal(b.running(), undefined);
    const last = JSON.parse(fs.readFileSync(path.join(b.w.cwd, ".strom", "live-last.json"), "utf8")) as { token?: string; ended?: { reason?: string } };
    assert.equal(last.ended?.reason, "did not start again");
    assert.equal(last.token, b.info.token, "its address is kept for a bridge started by hand");
    const t0 = Date.now();
    assert.equal(reviveLive(b.w.cwd, broken, { work: true }), undefined);
    assert.ok(Date.now() - t0 < 1000, "the next session does not wait for it again");
    await b.w.ok(["session", "start"]);
    assert.equal(b.running(), undefined, "nor does a session start bring it back");
    assert.equal(b.log().match(/work in the tree again/g)?.length, 1);
  } finally {
    await b.w.run(["live", "stop"]);
    b.w.cleanup();
  }
});
