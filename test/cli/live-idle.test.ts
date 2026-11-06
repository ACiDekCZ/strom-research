// How long the bridge (strom live) runs on with nobody asking it: live.idleMinutes (whole minutes, 0: never by itself),
// STROM_LIVE_IDLE_MS of the tests before it, never by itself else (the default since 1.29.0; a value stored stays). A value that is no whole number of minutes is refused with
// what to give.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";
import { checkValue, DEFAULT_LIVE_IDLE_MINUTES, Settings, SETTINGS } from "../../src/core/config.ts";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function ask(url: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { agent: false, headers: { Origin: "https://beta.stromapp.info" } }, (res) => {
      res.resume();
      res.on("end", () => resolve(res.statusCode ?? 0));
    });
    req.on("error", reject);
    req.end();
  });
}

test("live.idleMinutes: 0 never, 5 five minutes, 120 two hours, nothing never; STROM_LIVE_IDLE_MS before it", () => {
  const env = { HOME: "/nonexistent-home", STROM_CONFIG_DIR: "/nonexistent-config" };
  assert.equal(DEFAULT_LIVE_IDLE_MINUTES, 0, "never by itself unless the person chose so");
  assert.equal(new Settings(env, {}, {}).liveIdleMs(), 0);
  assert.equal(new Settings(env, {}, {}).liveIdleMinutes(), 0);
  assert.equal(new Settings(env, {}, { liveIdleMinutes: 120 }).liveIdleMs(), 120 * 60_000, "a value stored before stays");
  assert.equal(new Settings(env, {}, { liveIdleMinutes: 0 }).liveIdleMs(), 0);
  assert.equal(new Settings(env, {}, { liveIdleMinutes: 5 }).liveIdleMs(), 5 * 60_000);
  assert.equal(new Settings({ ...env, STROM_LIVE_IDLE_MS: "600" }, {}, { liveIdleMinutes: 0 }).liveIdleMs(), 600, "the tests' variable first");
  // a value stored by hand that is no whole number of minutes: the default
  for (const bad of [-3, 1.5, "abc"] as unknown[]) assert.equal(new Settings(env, {}, { liveIdleMinutes: bad as number }).liveIdleMs(), 0, String(bad));
});

test("live.idleMinutes takes whole minutes, 0 or more — anything else refused with what to give", () => {
  const def = SETTINGS.find((s) => s.key === "live.idleMinutes");
  assert.ok(def, "a setting of the registry");
  assert.equal(def.tree, false, "this computer's, not the tree's");
  assert.equal(checkValue(def, "0", (p) => p), 0);
  assert.equal(checkValue(def, "5", (p) => p), 5);
  assert.equal(checkValue(def, "720", (p) => p), 720);
  for (const bad of ["-1", "1.5", "abc", "", "five"]) {
    assert.throws(
      () => checkValue(def, bad, (p) => p),
      (e: unknown) => e instanceof Error && /whole number of minutes/.test(e.message) && /strom config set live\.idleMinutes 120/.test(String((e as { hint?: string }).hint)),
      JSON.stringify(bad),
    );
  }
});

test("strom config set live.idleMinutes: kept, shown, a wrong value refused with the hint", async () => {
  const w = new World();
  try {
    assert.equal((await w.ok(["config", "get", "live.idleMinutes", "--json"])).json.value, 0, "the default");
    await w.ok(["config", "set", "live.idleMinutes", "120"]);
    assert.equal((await w.ok(["config", "get", "live.idleMinutes", "--json"])).json.value, 120);
    await w.ok(["config", "set", "live.idleMinutes", "0"]);
    assert.equal((await w.ok(["config", "get", "live.idleMinutes", "--json"])).json.value, 0);
    await w.ok(["config", "set", "live.idleMinutes", "5"]);
    assert.equal((await w.ok(["config", "get", "live.idleMinutes", "--json"])).json.value, 5);
    assert.equal(new Settings(w.env, {}).liveIdleMs(), 5 * 60_000, "the bridge takes it");
    const refused = await w.run(["config", "set", "live.idleMinutes", "1.5"]);
    assert.notEqual(refused.code, 0);
    assert.match(refused.out + refused.err, /whole number of minutes/);
    assert.match(refused.out + refused.err, /strom config set live\.idleMinutes 120/);
    assert.equal((await w.ok(["config", "get", "live.idleMinutes", "--json"])).json.value, 5, "nothing changed");
  } finally {
    w.cleanup();
  }
});

test("idle time 0: the bridge never ends by itself, only strom live stop ends it", { skip: !hasGit || process.platform === "win32" }, async () => {
  const w = new World();
  await w.withTree();
  // 0 by the tests' variable (the same reading as the key's): before, 0 ended it at the first look
  Object.assign(w.env, { STROM_LIVE_IDLE_MS: "0", STROM_LIVE_POLL_MS: "100" });
  try {
    const info = (await w.ok(["live", "start", "--json"])).json as { pid: number; url: string };
    await wait(2500);
    assert.ok(alive(info.pid), "still running with nobody asking");
    assert.equal(await ask(`${info.url}/status`), 200);
    assert.doesNotMatch(fs.readFileSync(path.join(w.cwd, ".strom", "live.log"), "utf8"), /ended: idle/);
  } finally {
    await w.run(["live", "stop"]);
    w.cleanup();
  }
});
