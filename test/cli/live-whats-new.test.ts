// The bridge says what is new in this strom (GET <token>/whats-new): for the Strom app's window "What's new" — read
// only, behind the same secret and CORS as /status, the language asked for (else English), and asking keeps no bridge
// running (the app asks by itself, not the person).

import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { World, hasGit } from "../helpers.ts";
import { VERSION } from "../../src/core/tree.ts";
import { whatsNew } from "../../src/core/whatsnew.ts";
import { whatsNewUrl } from "../../src/core/update.ts";

const opts = { skip: !hasGit || process.platform === "win32" };
const APP = "https://beta.stromapp.info";

type Info = { pid: number; port: number; token: string; url: string };

function ask(url: string, headers: Record<string, string> = {}): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { agent: false, headers }, (res) => {
      let text = "";
      res.setEncoding("utf8");
      res.on("data", (d) => (text += d));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: text }));
    });
    req.on("error", reject);
    req.end();
  });
}

test("GET /whats-new: this version's points in the language asked for, else English; the address on the channel's branch; the feature said in /status", opts, async () => {
  const w = new World();
  await w.withTree();
  w.env.STROM_CHANNEL = "beta";
  try {
    const info = (await w.ok(["live", "start", "--json"])).json as Info;
    const status = JSON.parse((await ask(`${info.url}/status?app=3.12.0`, { Origin: APP })).body) as { features: string[]; strom: string };
    assert.ok(status.features.includes("whats.new"), "the app asks only a bridge that says it");
    for (const [asked, lang] of [["cs", "cs"], ["de", "de"], ["en", "en"], ["pl", "en"], ["", "en"]] as const) {
      const r = await ask(`${info.url}/whats-new?lang=${asked}&app=3.12.0`, { Origin: APP });
      assert.equal(r.status, 200, asked);
      assert.equal(r.headers["access-control-allow-origin"], APP, "the app's pages may read it");
      assert.equal(r.headers["cache-control"], "no-store");
      const got = JSON.parse(r.body) as { version: string; lang: string; url: string; points: string[] };
      assert.equal(got.version, status.strom, "the version /status says");
      assert.equal(got.version, VERSION);
      assert.equal(got.lang, lang, asked);
      assert.equal(got.url, whatsNewUrl(VERSION, "beta", lang), "beta: the branch beta");
      assert.ok(got.points.length >= 3, `${asked}: ${got.points.length} points`);
      assert.deepEqual(got.points, whatsNew(VERSION, lang, "beta").points);
    }
    // no ?lang: English
    assert.equal(JSON.parse((await ask(`${info.url}/whats-new`, { Origin: APP })).body).lang, "en");
    // the secret as /status: another one or none — nothing
    assert.equal((await ask(`http://127.0.0.1:${info.port}/${"0".repeat(32)}/whats-new?lang=cs`, { Origin: APP })).status, 404);
    assert.equal((await ask(`http://127.0.0.1:${info.port}/whats-new?lang=cs`, { Origin: APP })).status, 404);
    // a page that is no Strom app: no CORS for it
    const foreign = await ask(`http://127.0.0.1:${info.port}/${"0".repeat(32)}/whats-new`, { Origin: "https://evil.example" });
    assert.equal(foreign.headers["access-control-allow-origin"], undefined);
  } finally {
    await w.run(["live", "stop"]);
    w.cleanup();
  }
});

test("the stable channel: the address on main; asking what is new keeps no bridge running", opts, async () => {
  const w = new World();
  await w.withTree();
  w.env.STROM_CHANNEL = "stable";
  w.env.STROM_LIVE_IDLE_MS = "1500";
  w.env.STROM_LIVE_POLL_MS = "200";
  try {
    const info = (await w.ok(["live", "start", "--json"])).json as Info;
    const first = JSON.parse((await ask(`${info.url}/whats-new?lang=cs`, { Origin: APP })).body) as { url: string };
    assert.equal(first.url, whatsNewUrl(VERSION, "stable", "cs"));
    assert.match(first.url, /\/blob\/main\/CHANGELOG\.cs\.md#/);
    const until = Date.now() + 5000;
    let ended = false;
    while (Date.now() < until && !ended) {
      ended = await ask(`${info.url}/whats-new?lang=cs`, { Origin: APP }).then(() => false, () => true);
      await new Promise((r) => setTimeout(r, 300));
    }
    assert.ok(ended, "the bridge ended though the app kept asking what is new");
  } finally {
    await w.run(["live", "stop"]);
    w.cleanup();
  }
});
