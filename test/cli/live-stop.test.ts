// A bridge ends the same way on every system: strom live stop asks it through its stop file (a signal on Windows ends a
// process unheard), so it says the end to the Strom app on its event stream, closes it and logs why — the app following
// it learns the end at once, not only when it gives up asking. What live stop says is how it really went.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { World, hasGit } from "../helpers.ts";

const LIVE = fileURLToPath(new URL("../../src/core/live.ts", import.meta.url));

type Info = { pid: number; port: number; token: string; url: string; version?: string };

/** The bridge's event stream: what came on it, and when it ended. */
function follow(url: string) {
  let text = "";
  let ended = false;
  const hello = new Promise<void>((resolve, reject) => {
    const req = http.get(`${url}/events`, { agent: false }, (res) => {
      res.setEncoding("utf8");
      res.on("data", (d: string) => {
        text += d;
        if (/event: hello\n/.test(text)) resolve();
      });
      res.on("end", () => (ended = true));
      res.on("error", () => (ended = true));
    });
    req.on("error", reject);
  });
  const end = () => {
    const m = /event: end\ndata: (.*)\n\n/.exec(text);
    return m?.[1] ? (JSON.parse(m[1]) as { reason: string; back?: boolean; at: string }) : undefined;
  };
  return { hello, end, ended: () => ended };
}

const until = async (what: string, ok: () => boolean, ms = 10_000) => {
  for (const end = Date.now() + ms; Date.now() < end; await new Promise((r) => setTimeout(r, 50))) if (ok()) return;
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

test("strom live stop asks the bridge through its stop file: the end said on its stream, the stream closed, live.log says why — at once", { skip: !hasGit || process.platform === "win32" }, async () => {
  const w = new World();
  await w.withTree();
  const log = () => fs.readFileSync(path.join(w.cwd, ".strom", "live.log"), "utf8");
  try {
    const info = (await w.ok(["live", "start", "--json"])).json as Info;
    const status = await fetch(`${info.url}/status`);
    assert.ok(((await status.json()) as { features: string[] }).features.includes("live.end"), "the app knows the bridge says its end");
    const stream = follow(info.url);
    await stream.hello;
    const from = Date.now();
    const stopped = await w.ok(["live", "stop", "--json"]);
    assert.equal(stopped.json.how, "stopped", "it ended as it should, not killed");
    await until("the stream closed", () => stream.ended(), 3000);
    assert.ok(Date.now() - from < 3000, `ended within moments (${Date.now() - from} ms)`);
    const end = stream.end();
    assert.ok(end, "the end said on the stream");
    assert.equal(end.reason, "stopped");
    assert.equal(end.back, false, "no bridge comes at this address: following ends");
    assert.match(log(), /stop asked: strom live stop\n.*ended: strom live stop\n.*its secret dropped \(strom live stop\)/);
    assert.doesNotMatch(log(), /ended: SIGTERM/, "not by a signal");
    assert.equal(fs.existsSync(path.join(w.cwd, ".strom", "live-stop.json")), false, "the ask taken");
    assert.equal(alive(info.pid), false);
    // none running: said so, not "stopped"
    assert.equal((await w.ok(["live", "stop", "--json"])).json.how, "none");

    // A bridge started again for a newer strom: the end says another one comes at its address (the app goes on)
    const first = (await w.ok(["live", "start", "--json"])).json as Info;
    const liveJson = path.join(w.cwd, ".strom", "live.json");
    fs.writeFileSync(liveJson, JSON.stringify({ ...JSON.parse(fs.readFileSync(liveJson, "utf8")), version: "1.0.0" }));
    const again = follow(first.url);
    await again.hello;
    const current = (await w.ok(["live", "start", "--current", "--json"])).json as Info;
    assert.equal(current.url, first.url, "its address kept");
    await until("the stream closed", () => again.ended(), 3000);
    assert.equal(again.end()?.reason, "restart");
    assert.equal(again.end()?.back, true);
  } finally {
    await w.run(["live", "stop"]);
    w.cleanup();
  }
});

/**
 * endBridge in a process of its own (as strom live stop runs it), told it runs on another system — never waited for
 * synchronously here: this process reaps its children (a bridge that ended is otherwise still there, as on Windows it is not)
 */
function endBridgeAs(platform: string, pid: number, root: string): Promise<string> {
  const code = "const m = await import(process.argv[1]); process.stdout.write(m.endBridge(Number(process.argv[2]), process.argv[3], { platform: process.argv[4], askMs: 600, waitMs: 1500 }))";
  const c = spawn(process.execPath, ["--input-type=module", "-e", code, LIVE, String(pid), root, platform], { stdio: ["ignore", "pipe", "pipe"] });
  let out = "";
  let err = "";
  c.stdout.on("data", (d) => (out += d));
  c.stderr.on("data", (d) => (err += d));
  return new Promise((resolve, reject) => c.on("exit", (code) => (code === 0 ? resolve(out) : reject(new Error(err)))));
}

test("endBridge on Windows: a bridge that hears its stop file ends as it should; one that does not is ended for good and said so — never always \"stopped\"", { skip: process.platform === "win32" }, async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "strom-live-stop-"));
  fs.mkdirSync(path.join(root, ".strom"));
  const file = path.join(root, ".strom", "live-stop.json");
  const exited = (c: ReturnType<typeof spawn>) => new Promise<string | null>((r) => (c.exitCode !== null || c.signalCode ? r(c.signalCode) : c.once("exit", (_code, sig) => r(sig))));
  try {
    // hears it: takes the ask meant for it and ends by itself
    const hears = `const f=${JSON.stringify(file)},fs=require("fs");setInterval(()=>{try{if(JSON.parse(fs.readFileSync(f,"utf8")).pid===process.pid){fs.rmSync(f);process.exit(0)}}catch{}},50)`;
    const good = spawn(process.execPath, ["-e", hears, "live", "serve"], { cwd: root, stdio: "ignore" });
    await until("it runs", () => good.pid !== undefined && alive(good.pid));
    assert.equal(await endBridgeAs("win32", good.pid!, root), "stopped");
    assert.equal(await exited(good), null, "it ended by itself");
    // does not hear it (a bridge of an older strom): on Windows a signal ends it at once, unheard — "killed", said so
    const deaf = spawn(process.execPath, ["-e", "setInterval(()=>{},1000)", "live", "serve"], { cwd: root, stdio: "ignore" });
    await until("it runs", () => deaf.pid !== undefined && alive(deaf.pid));
    assert.equal(await endBridgeAs("win32", deaf.pid!, root), "killed");
    assert.equal(await exited(deaf), "SIGKILL");
    assert.equal(fs.existsSync(file), false, "an ask nobody took is not left behind");
    // no such process: none was there to end
    assert.equal(await endBridgeAs("win32", deaf.pid!, root), "gone");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
