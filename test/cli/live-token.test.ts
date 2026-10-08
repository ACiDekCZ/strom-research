// The bridge's secret: kept while the bridge is started again by itself (the Strom app goes on), dropped when it is
// ended for good (strom live stop), replaced at once when a page that is no Strom app comes with it (the address got
// out) — the app then gets the new address from strom app, as after a stop.

import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { World, hasGit } from "../helpers.ts";
import { enterWorker } from "../../src/core/workers.ts";

const opts = { skip: !hasGit || process.platform === "win32" };
const APP = "https://beta.stromapp.info";
const EVIL = "https://evil.example";

type Info = { pid: number; port: number; token: string; url: string; moved?: boolean };

function ask(url: string, method = "GET", headers: Record<string, string> = {}, body?: Buffer): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method, agent: false, headers: { ...(body ? { "Content-Length": String(body.length) } : {}), ...headers } }, (res) => {
      let text = "";
      res.on("data", (d) => (text += d));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: text }));
    });
    req.on("error", reject);
    req.end(body);
  });
}

const until = async (what: string, ok: () => boolean, ms = 20_000) => {
  for (const end = Date.now() + ms; Date.now() < end; await new Promise((r) => setTimeout(r, 100))) if (ok()) return;
  assert.fail(`waited in vain: ${what}`);
};

async function bridge(env: Record<string, string> = {}) {
  const w = new World();
  await w.withTree();
  Object.assign(w.env, env);
  const info = (await w.ok(["live", "start", "--json"])).json as Info;
  const read = (name: string) => JSON.parse(fs.readFileSync(path.join(w.cwd, ".strom", name), "utf8")) as Info;
  const log = () => fs.readFileSync(path.join(w.cwd, ".strom", "live.log"), "utf8");
  return { w, info, live: () => read("live.json"), last: () => read("live-last.json"), log };
}

test("strom live stop ends the bridge for good: the next one gets a new secret at its port, the old address is dead, live.log says why", opts, async () => {
  const b = await bridge();
  try {
    assert.equal((await ask(`${b.info.url}/status`, "GET", { Origin: APP })).status, 200);
    const stopped = await b.w.ok(["live", "stop"]);
    assert.match(stopped.out, /další most dostane novou tajnou adresu/);
    assert.equal(b.last().token, undefined, "the secret no longer kept");
    assert.equal(b.last().port, b.info.port, "its port kept");
    const again = (await b.w.ok(["live", "start", "--json"])).json as Info;
    assert.notEqual(again.token, b.info.token);
    assert.equal(again.port, b.info.port);
    assert.equal(again.moved, true, "the app needs the new address");
    assert.equal((await ask(`${b.info.url}/status`, "GET", { Origin: APP })).status, 404, "the old address: nothing");
    assert.equal((await ask(`${again.url}/status`, "GET", { Origin: APP })).status, 200);
    assert.match(b.log(), /its secret dropped \(strom live stop\): the next bridge gets a new one/);
    assert.match(b.log(), /the port of the last bridge, a new secret/);
  } finally {
    await b.w.run(["live", "stop"]);
    b.w.cleanup();
  }
});

test("strom live stop after the bridge ended by itself (idle) drops its secret too; an idle end alone keeps it", opts, async () => {
  const b = await bridge({ STROM_LIVE_IDLE_MS: "300", STROM_LIVE_POLL_MS: "100" });
  const alive = (pid: number) => {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  };
  try {
    await until("the bridge ended when idle", () => !alive(b.info.pid) && /ended: idle/.test(b.log()));
    // started again after an idle end: the same address (the app goes on by itself)
    const back = (await b.w.ok(["live", "start", "--json"])).json as Info;
    assert.equal(back.url, b.info.url);
    await until("the bridge ended when idle again", () => !alive(back.pid) && b.log().match(/ended: idle/g)!.length === 2);
    const stopped = (await b.w.ok(["live", "stop", "--json"])).json as { how: string; newSecret?: boolean };
    assert.equal(stopped.how, "none");
    assert.equal(stopped.newSecret, true);
    const fresh = (await b.w.ok(["live", "start", "--json"])).json as Info;
    assert.notEqual(fresh.token, b.info.token);
  } finally {
    await b.w.run(["live", "stop"]);
    b.w.cleanup();
  }
});

test("the secret from a page that is no Strom app: replaced at once — that answer without data or CORS, the old secret dead, the new one written, the app's event stream ended, said in live.log", opts, async () => {
  const b = await bridge();
  try {
    // the app follows the bridge (its EventSource: no Origin)
    let opened: () => void = () => {};
    const open = new Promise<void>((r) => (opened = r));
    const ended = new Promise<string>((resolve, reject) => {
      const req = http.get(`${b.info.url}/events?app=3.10.0`, (res) => {
        let text = "";
        res.on("data", (d) => {
          text += d;
          if (text.includes("event: hello")) opened();
        });
        res.on("end", () => resolve(text));
      });
      req.on("error", reject);
      setTimeout(() => (req.destroy(), reject(new Error("the event stream was not ended"))), 10_000);
    });
    await open;
    const evil = await ask(`${b.info.url}/status`, "GET", { Origin: EVIL });
    assert.equal(evil.status, 404);
    assert.equal(evil.body, "", "no data");
    assert.equal(evil.headers["access-control-allow-origin"], undefined, "no CORS");
    assert.match(await ended, /event: hello/, "the stream on the old secret ended");
    const now = b.live();
    assert.notEqual(now.token, b.info.token);
    assert.equal(now.port, b.info.port);
    assert.equal(now.pid, b.info.pid, "the same bridge");
    assert.equal(now.url, `http://127.0.0.1:${b.info.port}/${now.token}`);
    assert.equal(b.last().token, now.token, "a bridge started again by itself takes the new one");
    for (const origin of [APP, undefined]) {
      const h: Record<string, string> = origin ? { Origin: origin } : {};
      assert.equal((await ask(`${b.info.url}/status`, "GET", h)).status, 404, `the old secret is dead (${origin ?? "no Origin"})`);
      assert.equal((await ask(`${now.url}/status`, "GET", h)).status, 200, `the new one works (${origin ?? "no Origin"})`);
    }
    assert.equal((await ask(`${b.info.url}/events`)).status, 404, "an EventSource on the old one: nothing");
    assert.match(b.log(), /GET \/…\/status came with the secret from https:\/\/evil\.example, a page that is no Strom app: the address got out — a new secret, the old one no longer works/);
    assert.doesNotMatch(b.log(), new RegExp(b.info.token), "neither secret written");
    assert.doesNotMatch(b.log(), new RegExp(now.token));
    // what strom says of the bridge: the new address
    assert.equal(((await b.w.ok(["live", "--json"])).json as Info).url, now.url);
    // a send from that page with the new secret it does not know: nothing
    const sent = await ask(`${now.url}/sync`, "POST", { Origin: EVIL, "Content-Type": "text/plain" }, Buffer.from("0 HEAD\n0 TRLR\n"));
    assert.equal(sent.status, 404);
  } finally {
    await b.w.run(["live", "stop"]);
    b.w.cleanup();
  }
});

test("a POST or a preflight with the secret from a foreign page replaces it as well, writing nothing", opts, async () => {
  const b = await bridge();
  try {
    const head = () => spawnSync("git", ["rev-parse", "HEAD"], { cwd: b.w.cwd, encoding: "utf8" }).stdout;
    const before = head();
    const post = await ask(`${b.info.url}/sync`, "POST", { Origin: EVIL, "Content-Type": "text/plain" }, Buffer.from("0 HEAD\n0 TRLR\n"));
    assert.equal(post.status, 404);
    assert.equal(post.headers["access-control-allow-origin"], undefined);
    const second = b.live().token;
    assert.notEqual(second, b.info.token);
    await new Promise((r) => setTimeout(r, 500));
    assert.equal(head(), before, "nothing written");
    assert.deepEqual(fs.readdirSync(path.join(b.w.cwd, ".strom")).filter((f) => f === "sync"), [], "nothing kept to be written");
    const pre = await ask(`${b.live().url}/status`, "OPTIONS", { Origin: EVIL, "Access-Control-Request-Method": "GET" });
    assert.equal(pre.status, 404);
    assert.equal(pre.headers["access-control-allow-origin"], undefined);
    assert.notEqual(b.live().token, second);
    assert.equal(b.log().match(/came with the secret from https:\/\/evil\.example/g)!.length, 2);
  } finally {
    await b.w.run(["live", "stop"]);
    b.w.cleanup();
  }
});

test("never replaced for the Strom app's pages, a copy of it on this computer, the copy set in strom.app.url, an app opened as a file, no Origin at all — nor for a foreign page without the secret", opts, async () => {
  const b = await bridge({ STROM_APP_URL: "http://127.0.0.1:8080/" });
  try {
    const origins = ["https://beta.stromapp.info", "https://stromapp.info", "http://127.0.0.1:8080", "http://127.0.0.1:5173", "http://localhost:3000", "http://localhost", "null", undefined];
    for (const origin of origins) {
      const r = await ask(`${b.info.url}/status`, "GET", origin ? { Origin: origin } : {});
      assert.equal(r.status, 200, `${origin ?? "no Origin"}: answered`);
    }
    const events = await new Promise<number>((resolve, reject) => {
      const req = http.get(`${b.info.url}/events?app=3.10.0`, (res) => (resolve(res.statusCode ?? 0), req.destroy()));
      req.on("error", reject);
    });
    assert.equal(events, 200, "the app's EventSource (no Origin)");
    // a foreign page with a wrong secret: no leak, nothing replaced
    assert.equal((await ask(`http://127.0.0.1:${b.info.port}/${"0".repeat(32)}/status`, "GET", { Origin: EVIL })).status, 404);
    assert.equal((await ask(`http://127.0.0.1:${b.info.port}/${crypto.randomBytes(16).toString("hex")}/sync`, "POST", { Origin: EVIL }, Buffer.from("x"))).status, 404);
    assert.equal(b.live().token, b.info.token);
    assert.equal(b.last().token, b.info.token);
    assert.doesNotMatch(b.log(), /came with the secret/);
    // the copy of the app set in the settings (not the variable)
    await b.w.ok(["config", "set", "strom.app.url", "https://beta.stromapp.info/run/"]);
    assert.equal((await ask(`${b.info.url}/status`, "GET", { Origin: "https://beta.stromapp.info" })).status, 200);
    assert.equal(b.live().token, b.info.token);
  } finally {
    await b.w.run(["live", "stop"]);
    b.w.cleanup();
  }
});

test("an original being written when the secret is replaced is finished whole; only new requests need the new secret", opts, async () => {
  const b = await bridge();
  try {
    await b.w.ok(["person", "add", "Josef /Novák/", "--sex", "M"]);
    const jpg = fs.readFileSync(path.join(import.meta.dirname, "..", "fixtures", "images", "s0001.jpg"));
    const sha = crypto.createHash("sha256").update(jpg).digest("hex");
    const done = new Promise<{ status: number; body: string }>((resolve, reject) => {
      const req = http.request(`${b.info.url}/media/${sha}`, { method: "PUT", headers: { Origin: APP, "Content-Type": "application/octet-stream", "Content-Length": String(jpg.length), "X-Strom-Name": "list.jpg", "X-Strom-Person": "P0001" } }, (res) => {
        let text = "";
        res.on("data", (d) => (text += d));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body: text }));
      });
      req.on("error", reject);
      // half of it now, the rest once the secret is replaced
      req.write(jpg.subarray(0, jpg.length >> 1));
      setTimeout(() => {
        void ask(`${b.info.url}/status`, "GET", { Origin: EVIL }).then(() => req.end(jpg.subarray(jpg.length >> 1)), reject);
      }, 300);
    });
    const r = await done;
    assert.equal(r.status, 200, r.body);
    assert.match(JSON.parse(r.body).input, /^I\d{4}$/);
    assert.notEqual(b.live().token, b.info.token, "replaced meanwhile");
    assert.match((await b.w.ok(["check"])).out, /^ok/);
    const again = await ask(`${b.info.url}/media/${sha}`, "GET", { Origin: APP });
    assert.equal(again.status, 404, "a new request with the old secret: nothing");
    assert.equal((await ask(`${b.live().url}/media/${sha}`, "GET", { Origin: APP })).status, 200);
  } finally {
    await b.w.run(["live", "stop"]);
    b.w.cleanup();
  }
});

test("after the secret was replaced, strom app opens the Strom app at the bridge's new address", opts, async () => {
  const b = await bridge({ STROM_APP_URL: "http://127.0.0.1:8080/" });
  const apps = path.join(b.w.dir, "Applications");
  fs.mkdirSync(path.join(apps, "Google Chrome.app"), { recursive: true });
  fs.writeFileSync(path.join(apps, "google-chrome"), "#!/bin/sh\n", { mode: 0o755 });
  b.w.env.STROM_APP_DIRS = apps;
  const leave = enterWorker(b.w.cwd, "codex-1", "Codex");
  try {
    await ask(`${b.info.url}/status`, "GET", { Origin: EVIL });
    const token = b.live().token;
    assert.notEqual(token, b.info.token);
    const f = (await b.w.ok(["app", "--json"])).json as { url: string; bridge: string; follow: boolean };
    assert.equal(f.follow, true);
    assert.equal(f.bridge, `http://127.0.0.1:${b.info.port}/${token}`);
    assert.equal(f.url, `http://127.0.0.1:8080/?live=${encodeURIComponent(f.bridge)}`);
    const l = (await b.w.ok(["app", "--live", "--json"])).json as { url: string; bridge: string };
    assert.equal(l.bridge, f.bridge);
    // …and after strom live stop: a new secret again, the app opened at it
    await b.w.ok(["live", "stop"]);
    const g = (await b.w.ok(["app", "--json"])).json as { bridge: string; url: string };
    assert.notEqual(g.bridge, f.bridge);
    assert.match(g.bridge, new RegExp(`^http://127\\.0\\.0\\.1:${b.info.port}/[0-9a-f]{32}$`));
    assert.equal(g.url, `http://127.0.0.1:8080/?live=${encodeURIComponent(g.bridge)}`);
  } finally {
    leave();
    await b.w.run(["live", "stop"]);
    b.w.cleanup();
  }
});
