// A newer strom on disk (an update, the installer run again, npm): the bridge the Strom app follows starts again with
// it — at its port, with its token, once the new one starts, never while it writes; a new one that does not start: the
// old one goes on, said in its log. Run from the sources: never (STROM_LIVE_DISK_VERSION stands for the package here).

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";
import { acquireLock } from "../../src/core/lock.ts";
import { diskVersion } from "../../src/core/self.ts";

const opts = { skip: !hasGit };

const until = async (what: string, ok: () => boolean, ms = 20_000) => {
  for (const end = Date.now() + ms; Date.now() < end; await new Promise((r) => setTimeout(r, 100))) if (ok()) return;
  assert.fail(`waited in vain: ${what}`);
};
const alive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

async function bridge(version: Record<string, unknown>) {
  const w = new World();
  await w.withTree("Dvořákovi");
  const disk = path.join(w.dir, "package.json");
  fs.writeFileSync(disk, JSON.stringify({ version: "1.0.0" }));
  Object.assign(w.env, { STROM_LIVE_DISK_VERSION: disk, STROM_LIVE_RENEW_MS: "200", STROM_LIVE_POLL_MS: "100", STROM_LIVE_RENEWED: "1.0.0" });
  const info = (await w.ok(["live", "start", "--json"])).json as { pid: number; port: number; url: string };
  const live = () => JSON.parse(fs.readFileSync(path.join(w.cwd, ".strom", "live.json"), "utf8")) as { pid: number; port: number };
  const log = () => fs.readFileSync(path.join(w.cwd, ".strom", "live.log"), "utf8");
  const status = () => fetch(`${info.url}/status`, { headers: { Origin: "https://beta.stromapp.info" } }).then((r) => r.json() as Promise<Record<string, unknown>>);
  const update = () => fs.writeFileSync(disk, JSON.stringify(version));
  return { w, info, live, log, status, update };
}

test("a newer strom on disk: the bridge starts again with it at its port and token, the old one gone", opts, async () => {
  const b = await bridge({ version: "9.9.9" });
  try {
    b.update();
    await until("the new bridge", () => b.live().pid !== b.info.pid && /handed over/.test(b.log()));
    assert.equal(b.live().port, b.info.port);
    const s = await b.status();
    assert.equal(s.installed, undefined, "it runs what is on disk");
    assert.match(b.log(), /strom 9\.9\.9 on disk: the bridge starts again with it[\s\S]*handed over to the bridge of strom 9\.9\.9/);
    await until("the old bridge ended", () => !alive(b.info.pid));
  } finally {
    await b.w.ok(["live", "stop"]);
    b.w.cleanup();
  }
});

test("a newer strom that does not start: the old bridge goes on, said once in its log", opts, async () => {
  const b = await bridge({ version: "9.9.8", probe: "fail" });
  try {
    b.update();
    await until("said in the log", () => /strom 9\.9\.8 is on disk but does not start \(exit 7\): this bridge \(1\.0\.0\) goes on/.test(b.log()));
    await new Promise((r) => setTimeout(r, 800));
    assert.equal(b.live().pid, b.info.pid);
    assert.equal((await b.status()).installed, "9.9.8", "the app may say the bridge runs an older strom");
    assert.equal(b.log().match(/does not start/g)!.length, 1, "not tried at every tick");
  } finally {
    await b.w.ok(["live", "stop"]);
    b.w.cleanup();
  }
});

test("never while the bridge writes a send: after it", opts, async () => {
  const b = await bridge({ version: "9.9.9" });
  try {
    const id = JSON.parse(fs.readFileSync(path.join(b.w.cwd, "strom.json"), "utf8")).id as string;
    // the research held by another strom: the send the app makes waits to be written
    const release = acquireLock(path.join(b.w.cwd, ".strom", "tree.lock"), { owner: "a test", waitMs: 1000 });
    const ged = ["0 HEAD", "1 GEDC", "2 VERS 5.5.1", "1 CHAR UTF-8", `1 _STROM_TREE ${id}`, "0 @I1@ INDI", "1 NAME Karel /Dvořák/", "1 SEX M", "0 TRLR", ""].join("\n");
    const sent = fetch(`${b.info.url}/sync`, { method: "POST", body: ged, headers: { Origin: "https://beta.stromapp.info", "Content-Type": "text/plain; charset=utf-8" } });
    await new Promise((r) => setTimeout(r, 300));
    b.update();
    await new Promise((r) => setTimeout(r, 1500));
    assert.equal(b.live().pid, b.info.pid, "not while a send is written");
    release();
    await sent;
    await until("the new bridge after the send", () => b.live().pid !== b.info.pid);
  } finally {
    await b.w.ok(["live", "stop"]);
    b.w.cleanup();
  }
});

test("run from the sources: no strom on disk to start again with", () => {
  assert.equal(diskVersion({}), undefined);
});

test("a menu open while strom is updated: said once that the new version runs when strom starts again — never ended", opts, async () => {
  const w = new World();
  await w.withTree("Dvořákovi");
  const disk = path.join(w.dir, "package.json");
  fs.writeFileSync(disk, JSON.stringify({ version: "9.9.9" }));
  w.env.STROM_LIVE_DISK_VERSION = disk;
  const r = await w.run(["menu"], { tty: true, answers: ["3", "", "0"] });
  assert.equal(r.out.match(/strom je aktualizovaný — tahle nabídka ale ještě běží ve staré verzi/g)?.length, 1, r.out);
  w.cleanup();
});

test("the first run of a newer strom brings back a bridge that was killed once — never a bridge that starts bridges (found on Mac: hundreds of them at an update)", opts, async () => {
  const w = new World();
  await w.withTree("Dvořákovi");
  const info = (await w.ok(["live", "start", "--json"])).json as { pid: number };
  // killed without a word (a crash, the computer restarted): its last address still names it
  process.kill(info.pid, "SIGKILL");
  await until("the bridge gone", () => !alive(info.pid));
  const config = path.join(w.env.STROM_CONFIG_DIR!, "config.json");
  fs.writeFileSync(config, JSON.stringify({ ...JSON.parse(fs.readFileSync(config, "utf8")), lastVersion: "1.0.0" }));
  try {
    await w.ok(["status"]);
    await new Promise((r) => setTimeout(r, 4000));
    const log = fs.readFileSync(path.join(w.cwd, ".strom", "live.log"), "utf8");
    const started = log.split("\n").filter((l) => /\] started: /.test(l)).length;
    assert.equal(started, 2, `the first bridge and the one brought back, no more:\n${log}`);
    const now = JSON.parse(fs.readFileSync(path.join(w.cwd, ".strom", "live.json"), "utf8")) as { pid: number };
    assert.ok(alive(now.pid));
    // claimed once: the next strom brings back nothing more
    await w.ok(["status"]);
    await new Promise((r) => setTimeout(r, 1000));
    assert.equal(fs.readFileSync(path.join(w.cwd, ".strom", "live.log"), "utf8").split("\n").filter((l) => /\] started: /.test(l)).length, 2);
  } finally {
    await w.ok(["live", "stop"]);
    w.cleanup();
  }
});

test("a bridge killed without a word comes back when the person opens the menu — an archive has no sessions to bring it back (found on Mac: the app 'not running' until strom live start)", opts, async () => {
  const w = new World();
  await w.withTree("Dvořákovi");
  const info = (await w.ok(["live", "start", "--json"])).json as { pid: number };
  process.kill(info.pid, "SIGKILL");
  await until("the bridge gone", () => !alive(info.pid));
  try {
    await w.run(["menu"], { tty: true, answers: ["0"] });
    await until("the bridge back", () => {
      try {
        const now = JSON.parse(fs.readFileSync(path.join(w.cwd, ".strom", "live.json"), "utf8")) as { pid: number };
        return now.pid !== info.pid && alive(now.pid);
      } catch {
        return false;
      }
    });
  } finally {
    await w.ok(["live", "stop"]);
    w.cleanup();
  }
});
