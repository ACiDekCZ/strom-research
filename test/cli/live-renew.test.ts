// A newer strom on disk (an update, the installer run again, npm): the bridge the Strom app follows starts again with
// it — at its port, with its token, once the new one starts, never while it writes; a new one that does not start: the
// old one goes on, said in its log. Run from the sources: never (STROM_LIVE_DISK_VERSION stands for the package here).

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { World, hasGit } from "../helpers.ts";
import { bridgeRuns, notedBridges, within } from "../bridges.ts";
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

async function bridge(version: Record<string, unknown>, before?: (w: World) => void) {
  const w = new World();
  await w.withTree("Dvořákovi");
  before?.(w);
  const disk = path.join(w.dir, "package.json");
  fs.writeFileSync(disk, JSON.stringify({ version: "1.0.0" }));
  Object.assign(w.env, { STROM_LIVE_DISK_VERSION: disk, STROM_LIVE_RENEW_MS: "200", STROM_LIVE_POLL_MS: "100", STROM_LIVE_RENEWED: "1.0.0" });
  const info = (await w.ok(["live", "start", "--json"])).json as { pid: number; port: number; token: string; url: string };
  const live = () => JSON.parse(fs.readFileSync(path.join(w.cwd, ".strom", "live.json"), "utf8")) as { pid: number; port: number; token: string };
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
    assert.equal(b.live().token, b.info.token, "its secret kept: the app goes on by itself");
    const s = await b.status();
    assert.equal(s.installed, undefined, "it runs what is on disk");
    assert.match(b.log(), /strom 9\.9\.9 on disk: the bridge starts again with it[\s\S]*handed over to the bridge of strom 9\.9\.9/);
    await until("the old bridge ended", () => !alive(b.info.pid));
  } finally {
    await b.w.ok(["live", "stop"]);
    b.w.cleanup();
  }
});

test("a newer strom on disk: the address answers through the hand-over — the old bridge until the new one runs, never the new one's start without an answer", opts, async () => {
  // the new strom's start made slow (a slow computer, a cold disk) — asked whether it starts (--version), then its
  // bridge: the old one answers meanwhile. A budget, not a time just above the usual one: an old bridge that closed
  // before the new one ran, or waited for the new strom's --version without answering (it did until 1.30.1: the test
  // failed at load 100), would leave the address without an answer for a whole start (5 s here); a hand-over takes a
  // fraction of a second, the budget leaves room for a computer under load
  const START_MS = 5000;
  const BUDGET_MS = 3500;
  const b = await bridge({ version: "9.9.9" }, (w) => {
    fs.writeFileSync(path.join(w.dir, "slow.cjs"), `if ((process.argv.includes('serve') && process.env.STROM_LIVE_STATUS_FOR !== undefined) || process.argv.includes('--version')) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ${START_MS});\n`);
    w.env.NODE_OPTIONS = `${w.env.NODE_OPTIONS ?? ""} --require=${JSON.stringify(path.join(w.dir, "slow.cjs"))}`.trim();
  });
  try {
    // measured from the first answer on: the bridge's first /status (made cold) is no hand-over
    let last = 0;
    let gap = 0;
    let done = false;
    const watch = (async () => {
      while (!done) {
        const ok = await fetch(`${b.info.url}/status`, { headers: { Origin: "https://beta.stromapp.info" }, signal: AbortSignal.timeout(1000) }).then((r) => r.ok, () => false);
        const now = Date.now();
        if (ok) {
          if (last) gap = Math.max(gap, now - last);
          last = now;
        }
        await new Promise((r) => setTimeout(r, 50));
      }
    })();
    await until("the first answer", () => last > 0);
    b.update();
    await until("the new bridge", () => /handed over/.test(b.log()) && fs.existsSync(path.join(b.w.cwd, ".strom", "live.json")) && b.live().pid !== b.info.pid);
    await new Promise((r) => setTimeout(r, 500));
    done = true;
    await watch;
    assert.ok(gap < BUDGET_MS, `the longest time without an answer: ${gap} ms`);
    assert.equal(b.live().token, b.info.token);
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
    // the send in the inbox: the bridge took it and holds it as being written (one synchronous step)
    const inbox = path.join(b.w.cwd, ".strom", "sync");
    await until("the send taken in", () => fs.existsSync(inbox) && fs.readdirSync(inbox).some((f) => /^strom-app-.*\.ged$/.test(f)));
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
    const liveLog = () => fs.readFileSync(path.join(w.cwd, ".strom", "live.log"), "utf8");
    const starts = () => liveLog().split("\n").filter((l) => /\] started: /.test(l)).length;
    const live = () => JSON.parse(fs.readFileSync(path.join(w.cwd, ".strom", "live.json"), "utf8")) as { pid: number };
    // waits for the bridge brought back (a fixed wait failed on a busy machine), then a while for any more to show
    await until("the bridge brought back", () => {
      try {
        return starts() >= 2 && live().pid !== info.pid && alive(live().pid);
      } catch {
        return false; // live.json or live.log not written yet
      }
    });
    await new Promise((r) => setTimeout(r, 1500));
    assert.equal(starts(), 2, `the first bridge and the one brought back, no more:\n${liveLog()}`);
    assert.ok(alive(live().pid));
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

test("a newer strom on disk and a strom starting the bridge at once: one bridge of the tree, at its kept address — the other ends (found: two after an update, both watching the inbox)", opts, async () => {
  const w = new World();
  try {
    await w.withTree("Lhotákovi");
    const disk = path.join(w.dir, "package.json");
    fs.writeFileSync(disk, JSON.stringify({ version: "1.0.0" }));
    // the new bridge the old one starts is slow to take its port (a large research: /status made first, seconds)
    const slow = path.join(w.dir, "slow-listen.cjs");
    fs.writeFileSync(
      slow,
      "if (process.argv.includes('serve') && process.env.STROM_LIVE_STATUS_FOR !== undefined) {\n" +
        "  const http = require('node:http');\n" +
        "  const listen = http.Server.prototype.listen;\n" +
        "  let first = true;\n" +
        "  http.Server.prototype.listen = function (...a) { if (!first) return listen.apply(this, a); first = false; setTimeout(() => listen.apply(this, a), 4000); return this; };\n" +
        "}\n",
    );
    Object.assign(w.env, {
      STROM_LIVE_DISK_VERSION: disk,
      STROM_LIVE_RENEW_MS: "200",
      STROM_LIVE_POLL_MS: "100",
      STROM_LIVE_RENEWED: "1.0.0",
      NODE_OPTIONS: `${w.env.NODE_OPTIONS ?? ""} --require=${JSON.stringify(slow)}`.trim(),
    });
    const a = (await w.ok(["live", "start", "--json"])).json as { pid: number; port: number; token: string };
    const liveFile = path.join(w.cwd, ".strom", "live.json");
    const live = () => JSON.parse(fs.readFileSync(liveFile, "utf8")) as { pid: number; port: number; token: string };
    const log = () => fs.readFileSync(path.join(w.cwd, ".strom", "live.log"), "utf8");
    // the bridge of an older strom, as its note says: a newer strom's first run starts it again with its own version
    fs.writeFileSync(liveFile, JSON.stringify({ ...live(), version: "1.0.0" }));
    fs.writeFileSync(disk, JSON.stringify({ version: "9.9.9" }));
    await until("the old bridge starts the new one", () => /strom 9\.9\.9 on disk: the bridge starts again with it/.test(log()));
    // meanwhile a strom of the new version (its first run, a link from the app) wants a bridge of its own: a process of its own
    const cli = path.join(import.meta.dirname, "..", "..", "src", "cli.ts");
    const other = spawn(process.execPath, [cli, "live", "start", "--current", "--json"], { cwd: w.cwd, env: { ...w.env, STROM_LIVE_RENEWED: "9.9.9" }, stdio: "ignore" });
    await new Promise((r) => other.once("exit", r));
    const ours = () => notedBridges().filter((b) => within(b.root, w.dirs()) && bridgeRuns(b.pid)).map((b) => b.pid);
    // settled: the old one gone, the bridges started meanwhile up or ended
    await until("the old bridge ended", () => !bridgeRuns(a.pid));
    await until("a bridge at work", () => {
      try {
        return live().pid !== a.pid && bridgeRuns(live().pid);
      } catch {
        return false;
      }
    });
    await new Promise((r) => setTimeout(r, 6000));
    assert.deepEqual(ours(), [live().pid], `one bridge of the tree:\n${log()}`);
    assert.equal(live().port, a.port, "at the address the app follows");
    assert.equal(live().token, a.token);
    assert.doesNotMatch(log(), /needs the new address/u);
  } finally {
    w.cleanup();
  }
});

const cliOf = (root: string) => path.join(root, "src", "cli.ts");
const repo = path.join(import.meta.dirname, "..", "..");
const exited = (child: ReturnType<typeof spawn>, ms: number) =>
  new Promise<boolean>((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) return resolve(true);
    const t = setTimeout(() => resolve(false), ms);
    child.once("exit", () => {
      clearTimeout(t);
      resolve(true);
    });
  });

test("a bridge of an older strom left beside the tree's starts the newer strom's to take over: that one ends for the tree's bridge, and the older one with it — never goes on (found 2026-11-09: one ran on for hours from a removed version)", opts, async () => {
  const w = new World();
  let stray: ReturnType<typeof spawn> | undefined;
  try {
    await w.withTree("Lhotákovi");
    const owner = (await w.ok(["live", "start", "--json"])).json as { pid: number };
    // a bridge of an older strom beside it (it claims nothing; live.json names the tree's bridge): a newer strom on disk,
    // it starts that strom's bridge to take over (naming itself only as its parent) and goes on when that one ends at
    // once — as the older strom did; asked through its stop file, it ends. Started detached, as strom starts a bridge
    // (spawnBridge): on Windows a child started otherwise is ended with the process that started it (Node puts it in a
    // job that closes with its parent), before it can say it ended that one (found on Windows: the line never written)
    const older = path.join(w.dir, "older-bridge.cjs");
    fs.writeFileSync(
      older,
      [
        "const { spawn } = require('node:child_process');",
        "const fs = require('node:fs');",
        "const path = require('node:path');",
        "const dot = path.join(process.env.STROM_TREE, '.strom');",
        "const next = spawn(process.execPath, [process.env.OLDER_CLI, 'live', 'serve'], { cwd: process.env.STROM_TREE, env: { ...process.env, STROM_LIVE_RENEWED: '9.9.9' }, stdio: 'ignore', detached: true });",
        "next.on('exit', (code) => fs.writeFileSync(path.join(dot, 'older-next.json'), JSON.stringify({ pid: next.pid, code })));",
        "setInterval(() => {",
        "  try {",
        "    const ask = JSON.parse(fs.readFileSync(path.join(dot, 'live-stop.json'), 'utf8'));",
        "    if (ask.pid === process.pid) { fs.rmSync(path.join(dot, 'live-stop.json'), { force: true }); process.exit(0); }",
        "  } catch {}",
        "}, 100);",
        "setTimeout(() => process.exit(0), 60000);",
        "",
      ].join("\n"),
    );
    stray = spawn(process.execPath, [older, "live", "serve"], { cwd: w.cwd, env: { ...w.env, STROM_TREE: w.cwd, OLDER_CLI: cliOf(repo) }, stdio: "ignore" });
    const ended = await exited(stray, 15_000);
    const log = () => fs.readFileSync(path.join(w.cwd, ".strom", "live.log"), "utf8");
    assert.ok(ended, `the older bridge ended too:\n${log()}`);
    const next = Number(new RegExp(`\\[(\\d+)\\] another bridge of this tree runs already \\(${owner.pid}\\)`).exec(log())?.[1]);
    assert.ok(next > 0, log());
    await until("said in the log", () => new RegExp(`\\[${next}\\] the bridge ${stray!.pid} that started this one \\(${next}\\) ended too`).test(log()));
    // the tree's bridge goes on, alone
    assert.ok(bridgeRuns(owner.pid));
    // a bridge that ends for another of the tree says so by its exit (EXIT.locked), never as a start that failed
    const again = spawn(process.execPath, [cliOf(repo), "live", "serve"], { cwd: w.cwd, env: { ...w.env, STROM_TREE: w.cwd }, stdio: "ignore" });
    assert.ok(await exited(again, 30_000));
    assert.equal(again.exitCode, 5);
    assert.equal((JSON.parse(fs.readFileSync(path.join(w.cwd, ".strom", "live.json"), "utf8")) as { pid: number }).pid, owner.pid);
  } finally {
    stray?.kill("SIGKILL");
    w.cleanup();
  }
});

test("a bridge none of the tree's any more (another one claims it, live.json names that one) ends itself at its next look — strom live start --current leaves one bridge", opts, async () => {
  const w = new World();
  try {
    await w.withTree("Lhotákovi");
    Object.assign(w.env, { STROM_LIVE_OWNER_MS: "200", STROM_LIVE_POLL_MS: "100" });
    const first = (await w.ok(["live", "start", "--json"])).json as { pid: number };
    // strom lost track of it (a bridge started late, one of an older strom whose notes another one wrote over): a strom
    // starting the tree's bridge now starts another
    for (const f of ["live.json", "live-owner.json", "live-last.json"]) fs.rmSync(path.join(w.cwd, ".strom", f), { force: true });
    const second = (await w.ok(["live", "start", "--current", "--json"])).json as { pid: number };
    assert.notEqual(second.pid, first.pid);
    await until("the bridge left beside it ended", () => !bridgeRuns(first.pid), 10_000);
    const log = fs.readFileSync(path.join(w.cwd, ".strom", "live.log"), "utf8");
    assert.match(log, new RegExp(`\\[${first.pid}\\] ended: another bridge of this tree holds it \\(${second.pid}\\)`));
    assert.ok(bridgeRuns(second.pid), "the tree's bridge goes on");
    assert.deepEqual(notedBridges().filter((b) => within(b.root, w.dirs()) && bridgeRuns(b.pid)).map((b) => b.pid), [second.pid]);
  } finally {
    w.cleanup();
  }
});

test("a bridge whose strom is no longer on the disk (an update removed its version's folder) ends, said in its log — never a failure every while for hours", opts, async () => {
  const w = new World();
  try {
    await w.withTree("Lhotákovi");
    // a version of strom in a folder of its own, as an installation keeps it
    const version = path.join(w.dir, "app-1.0.0");
    for (const part of ["src", "assets", "package.json"]) fs.cpSync(path.join(repo, part), path.join(version, part), { recursive: true });
    const started = spawn(process.execPath, [cliOf(version), "live", "start", "--json"], { cwd: w.cwd, env: { ...w.env, STROM_LIVE_GONE_MS: "300", STROM_LIVE_POLL_MS: "100" }, stdio: ["ignore", "pipe", "ignore"] });
    let out = "";
    started.stdout!.on("data", (d: Buffer) => (out += d.toString("utf8")));
    assert.ok(await exited(started, 30_000));
    const info = JSON.parse(out) as { pid: number };
    assert.ok(bridgeRuns(info.pid));
    fs.rmSync(version, { recursive: true, force: true });
    await until("the bridge ended", () => !bridgeRuns(info.pid), 10_000);
    assert.match(fs.readFileSync(path.join(w.cwd, ".strom", "live.log"), "utf8"), new RegExp(`\\[${info.pid}\\] ended: the strom it runs is no longer on the disk \\(.*app-1\\.0\\.0\\)`));
  } finally {
    w.cleanup();
  }
});
