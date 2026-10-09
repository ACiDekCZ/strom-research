// A research copied with its .strom (by hand, Finder) carries the notes of the original's bridge (live.json,
// live-last.json): the copy's strom never takes that bridge for its own, never ends it, never takes its address over —
// its own bridge gets a port the system picks and a new secret, so the Strom app following the original never comes
// to the copy (found on Mac: a copy's strom of another version ended the original's bridge and served the app at its
// address with its secret).

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { World, hasGit } from "../helpers.ts";
import { reviveLive } from "../../src/core/live.ts";

const opts = { skip: !hasGit || process.platform === "win32" };
// a bridge's working folder is asked of the system (lsof on a Mac, /proc on Linux)
const cwdKnown = process.platform === "linux" || (process.platform === "darwin" && spawnSync("lsof", ["-v"]).error === undefined);
const APP = "https://beta.stromapp.info";

type Info = { pid: number; port: number; token: string; url: string; moved?: boolean; running?: boolean };

function ask(url: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { agent: false, headers: { Origin: APP } }, (res) => {
      let text = "";
      res.on("data", (d) => (text += d));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, body: text }));
    });
    req.on("error", reject);
    req.end();
  });
}

/** A process that runs (one that ended and only waits for this test process to hear it is no longer alive). */
function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
  } catch {
    return false;
  }
  return !spawnSync("ps", ["-o", "stat=", "-p", String(pid)], { encoding: "utf8" }).stdout.trim().startsWith("Z");
}

const until = async (what: string, ok: () => boolean, ms = 20_000) => {
  for (const end = Date.now() + ms; Date.now() < end; await new Promise((r) => setTimeout(r, 100))) if (ok()) return;
  assert.fail(`waited in vain: ${what}`);
};

/** A research with its bridge running, and a copy of its whole folder (.strom too) beside it. */
async function copied() {
  const w = new World();
  await w.withTree();
  const a = w.cwd;
  const info = (await w.ok(["live", "start", "--json"])).json as Info;
  const b = path.join(path.dirname(a), `${path.basename(a)} kopie`);
  fs.cpSync(a, b, { recursive: true });
  const file = (root: string, name: string) => path.join(root, ".strom", name);
  const read = (root: string, name: string) => JSON.parse(fs.readFileSync(file(root, name), "utf8")) as Record<string, unknown>;
  const write = (root: string, name: string, data: Record<string, unknown>) => fs.writeFileSync(file(root, name), JSON.stringify(data, null, 2));
  const log = (root: string) => (fs.existsSync(file(root, "live.log")) ? fs.readFileSync(file(root, "live.log"), "utf8") : "");
  // the bridges this test started, ended by their own numbers
  const started = new Set<number>([info.pid]);
  const end = () => {
    for (const pid of started) if (alive(pid)) process.kill(pid, "SIGTERM");
    w.cleanup();
  };
  return { w, a, b, info, read, write, log, started, end, liveA: () => fs.readFileSync(file(a, "live.json"), "utf8") };
}

test("a copy of a research with its .strom: its strom never takes the original's bridge for its own nor ends it — its own bridge gets a new port and secret", opts, async () => {
  const c = await copied();
  try {
    // as in the incident: the copy's notes name a bridge of an older strom (another version is wanted)
    c.write(c.b, "live.json", { ...c.read(c.b, "live.json"), version: "0.0.1" });
    const liveA = c.liveA();
    const here = (await c.w.ok(["live", "--json"], { cwd: c.b })).json as Info;
    assert.equal(here.running, false, "the original's bridge is not the copy's");
    const mine = (await c.w.ok(["live", "start", "--current", "--json"], { cwd: c.b })).json as Info;
    c.started.add(mine.pid);
    assert.ok(alive(c.info.pid), "the original's bridge still runs");
    assert.notEqual(mine.pid, c.info.pid);
    assert.notEqual(mine.token, c.info.token, "a new secret");
    assert.notEqual(mine.port, c.info.port, "a port of its own");
    const status = await ask(`${c.info.url}/status`);
    assert.equal(status.status, 200, "the original's bridge answers at its address");
    assert.equal(fs.realpathSync(String((JSON.parse(status.body) as { path?: string }).path)), fs.realpathSync(c.a), "…of the original");
    assert.equal(c.liveA(), liveA, "the original's live.json untouched");
    assert.equal((await ask(`${mine.url}/status`)).status, 200);
    assert.match(c.log(c.b), /the bridge's notes came from another folder \(.+\): a new address/);
    // the copy's notes are its own from now on
    assert.equal(fs.realpathSync(String(c.read(c.b, "live.json").root)), fs.realpathSync(c.b));
    assert.equal(fs.realpathSync(String(c.read(c.b, "live-last.json").root)), fs.realpathSync(c.b));
    // started again (a plain start, the copy's own bridge running): its own, as it was
    const again = (await c.w.ok(["live", "start", "--json"], { cwd: c.b })).json as Info;
    assert.equal(again.pid, mine.pid);
  } finally {
    c.end();
  }
});

test("a copy whose original's bridge ended without a word: the copy's revive takes nothing of it, and the original gets its address back", opts, async () => {
  const c = await copied();
  try {
    process.kill(c.info.pid, "SIGKILL");
    // …and no longer a process at all (heard by this test process, its parent): as after a crash
    await until("the original's bridge ended", () => {
      try {
        process.kill(c.info.pid, 0);
        return false;
      } catch {
        return true;
      }
    });
    assert.equal(reviveLive(c.b, c.w.env), undefined, "nothing of the copy to start again");
    const mine = (await c.w.ok(["live", "start", "--json"], { cwd: c.b })).json as Info;
    c.started.add(mine.pid);
    assert.notEqual(mine.token, c.info.token, "a new secret");
    assert.notEqual(mine.port, c.info.port, "a port of its own");
    // the original's own revive: its address, its secret (the app goes on by itself)
    const back = reviveLive(c.a, c.w.env);
    assert.ok(back);
    c.started.add(back.pid);
    assert.equal(back.port, c.info.port);
    assert.equal(back.token, c.info.token);
    assert.ok(alive(mine.pid), "the copy's bridge left alone");
  } finally {
    c.end();
  }
});

test("an older strom's notes (no folder named) of a bridge running in another folder: not this tree's — never stopped, never its address", { skip: opts.skip || !cwdKnown }, async () => {
  const c = await copied();
  try {
    for (const name of ["live.json", "live-last.json"]) {
      const { root: _root, ...older } = c.read(c.b, name);
      c.write(c.b, name, name === "live.json" ? { ...older, version: "0.0.1" } : older);
    }
    const liveA = c.liveA();
    const stopped = (await c.w.ok(["live", "stop", "--json"], { cwd: c.b })).json as { how: string };
    assert.equal(stopped.how, "none", "no bridge of the copy to stop");
    assert.ok(alive(c.info.pid), "the original's bridge still runs");
    const mine = (await c.w.ok(["live", "start", "--current", "--json"], { cwd: c.b })).json as Info;
    c.started.add(mine.pid);
    assert.ok(alive(c.info.pid), "the original's bridge still runs");
    assert.notEqual(mine.pid, c.info.pid);
    assert.notEqual(mine.token, c.info.token, "a new secret");
    assert.notEqual(mine.port, c.info.port, "a port of its own");
    assert.equal((await ask(`${c.info.url}/status`)).status, 200);
    assert.equal(c.liveA(), liveA);
    assert.match(c.log(c.b), /the bridge's notes came from another folder \(.+\): a new address/);
  } finally {
    c.end();
  }
});
