// The Strom app's switch "research on" (spec 064): /status live says how long the bridge runs on with nobody asking
// (live.idleMinutes, 0 by default: never by itself) and the two choices the app offers; POST <token>/live writes the
// choice (strom config set, this computer's) or ends the bridge as strom live stop does — its address kept, never
// brought back by new work in the tree; the link live&do=start starts it again at that address without a window. A
// bridge that ended idle is told apart from one stopped (live-last.json ended.kind), so only the idle one comes back.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { World, hasGit, readJsonFile } from "../helpers.ts";
import { parseLink, LinkError } from "../../src/core/links.ts";
import { reviveLive } from "../../src/core/live.ts";

const opts = { skip: !hasGit || process.platform === "win32" };
const APP = "https://beta.stromapp.info";
const ID = "0f8c2d4e-1b2a-4c3d-9e8f-7a6b5c4d3e2f";

type Info = { pid: number; port: number; token: string; url: string };

function ask(url: string, opt: { method?: string; body?: string; origin?: string | null } = {}): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const headers: Record<string, string> = {};
    if (opt.origin !== null) headers.Origin = opt.origin ?? APP;
    if (opt.body !== undefined) headers["Content-Type"] = "text/plain; charset=utf-8";
    const req = http.request(url, { agent: false, method: opt.method ?? "GET", headers }, (res) => {
      let text = "";
      res.setEncoding("utf8");
      res.on("data", (d) => (text += d));
      res.on("end", () => {
        let body: any = text;
        try {
          body = JSON.parse(text);
        } catch {
          // not JSON
        }
        resolve({ status: res.statusCode ?? 0, body });
      });
    });
    req.on("error", reject);
    req.end(opt.body);
  });
}

const post = (url: string, body: unknown, origin?: string | null) => ask(url, { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body), ...(origin !== undefined ? { origin } : {}) });
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const until = async (what: string, ok: () => boolean | Promise<boolean>, ms = 20_000) => {
  for (const end = Date.now() + ms; Date.now() < end; await wait(100)) if (await ok()) return;
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

/** The bridge's event stream: what came on it. */
function follow(url: string) {
  let text = "";
  const hello = new Promise<void>((resolve, reject) => {
    const req = http.get(`${url}/events`, { agent: false, headers: { Origin: APP } }, (res) => {
      res.setEncoding("utf8");
      res.on("data", (d: string) => {
        text += d;
        if (/event: hello\n/.test(text)) resolve();
      });
      res.on("error", () => {});
    });
    req.on("error", reject);
  });
  const end = () => {
    const m = /event: end\ndata: (.*)\n\n/.exec(text);
    return m?.[1] ? (JSON.parse(m[1]) as { reason: string; back?: boolean; by?: string }) : undefined;
  };
  return { hello, end };
}

const lastOf = (w: World) => readJsonFile(path.join(w.cwd, ".strom", "live-last.json")) as { token?: string; port: number; ended?: { reason: string; kind?: string } };

test("/status live and POST /live {idleMinutes}: the choice written as strom config set, checked, the app only", opts, async () => {
  const w = new World();
  await w.withTree();
  Object.assign(w.env, { STROM_LIVE_POLL_MS: "100", STROM_LIVE_IDLE_READ_MS: "200" });
  const info = (await w.ok(["live", "start", "--json"])).json as Info;
  try {
    const status = (await ask(`${info.url}/status`)).body;
    assert.deepEqual(status.live, { idleMinutes: 0, idleChoices: [0, 120] }, "never by itself by default");
    for (const f of ["live.idle", "live.stop", "live.start"]) assert.ok(status.features.includes(f), f);
    const set = await post(`${info.url}/live`, { idleMinutes: 120 });
    assert.equal(set.status, 200, JSON.stringify(set.body));
    assert.deepEqual(set.body, { live: { idleMinutes: 120, idleChoices: [0, 120] } });
    assert.equal((await w.ok(["config", "get", "live.idleMinutes", "--json"])).json.value, 120, "this computer's setting");
    assert.equal((await ask(`${info.url}/status`)).body.live.idleMinutes, 120);
    // as it is already: nothing written again
    const before = fs.statSync(path.join(w.env.STROM_CONFIG_DIR!, "config.json")).mtimeMs;
    assert.equal((await post(`${info.url}/live`, { idleMinutes: 120 })).status, 200);
    assert.equal(fs.statSync(path.join(w.env.STROM_CONFIG_DIR!, "config.json")).mtimeMs, before);
    assert.equal((await post(`${info.url}/live`, { idleMinutes: 0 })).body.live.idleMinutes, 0);
    for (const bad of [{ idleMinutes: -1 }, { idleMinutes: 1.5 }, { idleMinutes: "120" }, { idleMinutes: 10081 }, {}, { do: "start" }, { idleMinutes: 0, do: "stop" }, "[1]"]) {
      const r = await post(`${info.url}/live`, bad);
      assert.equal(r.status, 400, JSON.stringify(bad));
      assert.equal(r.body.code, "live.body", JSON.stringify(bad));
    }
    assert.equal((await post(`${info.url}/live`, { idleMinutes: 120 }, null)).status, 403, "only the Strom app writes");
    assert.equal((await w.ok(["config", "get", "live.idleMinutes", "--json"])).json.value, 0, "nothing of the refused ones written");
    // a bridge running takes a value set in the terminal (what /status says of it, at once after it read it again)
    await w.ok(["config", "set", "live.idleMinutes", "5"]);
    await until("/status says 5", async () => (await ask(`${info.url}/status`)).body.live?.idleMinutes === 5);
    assert.ok(alive(info.pid), "five minutes: still running");
  } finally {
    await w.run(["live", "stop"]);
    w.cleanup();
  }
});

test("POST /live {do: stop}: ended as strom live stop, by the app, its address kept, new work never brings it back; the link live&do=start does", opts, async () => {
  const w = new World();
  await w.withTree();
  Object.assign(w.env, { STROM_LIVE_POLL_MS: "100" });
  const info = (await w.ok(["live", "start", "--json"])).json as Info;
  try {
    const events = follow(info.url);
    await events.hello;
    const r = await post(`${info.url}/live`, { do: "stop" });
    assert.equal(r.status, 202);
    assert.deepEqual(r.body, { stopping: true });
    await until("the bridge ended", () => !alive(info.pid));
    assert.deepEqual({ ...events.end(), at: undefined }, { reason: "stopped", back: false, by: "app", at: undefined });
    const last = lastOf(w);
    assert.equal(last.ended?.kind, "stopped");
    assert.equal(last.token, info.token, "the address kept: the app finds it again when it is turned on");
    assert.equal(fs.existsSync(path.join(w.cwd, ".strom", "live.json")), false);
    assert.match(fs.readFileSync(path.join(w.cwd, ".strom", "live.log"), "utf8"), /stop asked: in the Strom app/);
    // new work in the tree: not back (only an end when idle is)
    assert.equal(reviveLive(w.cwd, w.env, { work: true }), undefined);
    assert.equal((await w.ok(["live", "--json"])).json.running, false);
    // turned on from the app: the link, no window — at the address it had
    const id = readJsonFile(path.join(w.cwd, "strom.json")).id as string;
    const opened = (await w.ok(["link", "open", `strom-research://live?tree=${id}&do=start`, "--json"])).json;
    assert.equal(opened.done, true, JSON.stringify(opened));
    assert.equal(opened.do, "start");
    const again = (await w.ok(["live", "--json"])).json as Info & { running: boolean };
    assert.equal(again.running, true);
    assert.equal(again.url, info.url, "the same address");
    assert.equal((await ask(`${again.url}/status?poll=1`)).status, 200);
  } finally {
    await w.run(["live", "stop"]);
    w.cleanup();
  }
});

test("an end when idle and strom live stop are told apart in live-last.json (ended.kind): only the idle one comes back with work", opts, async () => {
  const w = new World();
  await w.withTree();
  Object.assign(w.env, { STROM_LIVE_POLL_MS: "100", STROM_LIVE_IDLE_MS: "400" });
  try {
    const a = (await w.ok(["live", "start", "--json"])).json as Info;
    await until("ended idle", () => !alive(a.pid));
    assert.equal(lastOf(w).ended?.kind, "idle");
    w.env.STROM_LIVE_IDLE_MS = "60000";
    const back = reviveLive(w.cwd, w.env, { work: true });
    assert.ok(back, "an idle end comes back with work");
    assert.equal(back.url, a.url);
    await w.ok(["live", "stop"]);
    assert.equal(lastOf(w).ended?.kind, "stopped");
    assert.equal(reviveLive(w.cwd, w.env, { work: true }), undefined, "stopped stays stopped");
  } finally {
    await w.run(["live", "stop"]);
    w.cleanup();
  }
});

test("the link live: do=start only, anything else refused", () => {
  assert.deepEqual(parseLink(`strom-research://live?tree=${ID}&do=start`), { action: "live", tree: ID, do: "start" });
  assert.deepEqual(parseLink(`strom-research://live?tree=${ID}`), { action: "live", tree: ID });
  assert.throws(() => parseLink(`strom-research://live?tree=${ID}&do=stop`), LinkError);
});
