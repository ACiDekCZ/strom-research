// A bridge ends the same way on every system: strom live stop asks it through its stop file (a signal on Windows ends a
// process unheard), so it says the end to the Strom app on its event stream, closes it and logs why — the app following
// it learns the end at once, not only when it gives up asking. What live stop says is how it really went.

import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
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

/**
 * A stand-in bridge (`script` with `live serve` among its arguments) that has begun to look for its stop file: waited
 * for by the file it writes once it does, not by its process alone — a loaded computer starts Node later than the
 * moment endBridge gives a bridge to take its ask.
 */
async function standIn(root: string, script: string): Promise<ReturnType<typeof spawn>> {
  const ready = path.join(root, `ready-${crypto.randomUUID()}`);
  const c = spawn(process.execPath, ["-e", `${script};require("fs").writeFileSync(${JSON.stringify(ready)},"")`, "live", "serve"], { cwd: root, stdio: "ignore" });
  await until("the stand-in bridge looks for its stop file", () => fs.existsSync(ready), 60_000);
  return c;
}

test("strom live stop asks the bridge through its stop file: the end said on its stream, the stream closed, live.log says why — at once", { skip: !hasGit }, async () => {
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
 * How a stand-in bridge ended: "exit 0" by itself; ended for good by another process "SIGKILL" — on Windows a process
 * ended by another one has no signal, only the code TerminateProcess gave it ("exit 1").
 */
const exited = (c: ReturnType<typeof spawn>) =>
  new Promise<string>((r) => {
    const said = (code: number | null, sig: NodeJS.Signals | null) => r(sig ?? `exit ${code}`);
    if (c.exitCode !== null || c.signalCode) said(c.exitCode, c.signalCode);
    else c.once("exit", said);
  });
const KILLED = process.platform === "win32" ? "exit 1" : "SIGKILL";

/**
 * endBridge in a process of its own (as strom live stop runs it), told it runs on another system — never waited for
 * synchronously here: this process reaps its children (a bridge that ended is otherwise still there, as on Windows it is not)
 */
function endBridgeAs(platform: string, pid: number, root: string, more: { writeMs?: number; askMs?: number } = {}): Promise<string> {
  const code = "const m = await import(process.argv[1]); process.stdout.write(m.endBridge(Number(process.argv[2]), process.argv[3], { platform: process.argv[4], askMs: 600, waitMs: 1500, ...JSON.parse(process.argv[5]) }))";
  const c = spawn(process.execPath, ["--input-type=module", "-e", code, LIVE, String(pid), root, platform, JSON.stringify(more)], { stdio: ["ignore", "pipe", "pipe"] });
  let out = "";
  let err = "";
  c.stdout.on("data", (d) => (out += d));
  c.stderr.on("data", (d) => (err += d));
  return new Promise((resolve, reject) => c.on("exit", (code) => (code === 0 ? resolve(out) : reject(new Error(err)))));
}

test("endBridge on Windows: a bridge that hears its stop file ends as it should; one that does not is ended for good and said so — never always \"stopped\"", {}, async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "strom-live-stop-"));
  fs.mkdirSync(path.join(root, ".strom"));
  const file = path.join(root, ".strom", "live-stop.json");

  try {
    // hears it: takes the ask meant for it and ends by itself — given as long as a busy computer takes to let it look
    // (over as soon as it took it: found under the whole suite, 600 ms were not enough for a process looking every 50 ms)
    const hears = `const f=${JSON.stringify(file)},fs=require("fs");setInterval(()=>{try{if(JSON.parse(fs.readFileSync(f,"utf8")).pid===process.pid){fs.rmSync(f);process.exit(0)}}catch{}},50)`;
    const good = await standIn(root, hears);
    assert.equal(await endBridgeAs("win32", good.pid!, root, { askMs: 60_000 }), "stopped");
    assert.equal(await exited(good), "exit 0", "it ended by itself");
    // does not hear it (a bridge of an older strom): on Windows a signal ends it at once, unheard — "killed", said so
    const deaf = spawn(process.execPath, ["-e", "setInterval(()=>{},1000)", "live", "serve"], { cwd: root, stdio: "ignore" });
    await until("it runs", () => deaf.pid !== undefined && alive(deaf.pid));
    assert.equal(await endBridgeAs("win32", deaf.pid!, root), "killed");
    assert.equal(await exited(deaf), KILLED);
    assert.equal(fs.existsSync(file), false, "an ask nobody took is not left behind");
    // no such process: none was there to end
    assert.equal(await endBridgeAs("win32", deaf.pid!, root), "gone");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("endBridge: a bridge that says it writes what the app sent is waited for until it is written; one that keeps saying so only a while, then ended", {}, async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "strom-live-stop-"));
  fs.mkdirSync(path.join(root, ".strom"));
  fs.writeFileSync(path.join(root, "strom.json"), "{}");
  const file = path.join(root, ".strom", "live-stop.json");
  const busy = path.join(root, ".strom", "live-busy.json");
  const written = path.join(root, "written");

  // asked to end, it writes on for `writes` ms (saying so, its note written whole as the bridge writes it: never read
  // half written — an empty note read is a bridge that no longer says it writes), then ends by itself
  const writer = (writes: number) =>
    `const f=${JSON.stringify(file)},b=${JSON.stringify(busy)},w=${JSON.stringify(written)},fs=require("fs");let at=0;setInterval(()=>{let a;try{a=JSON.parse(fs.readFileSync(f,"utf8"))}catch{}if(a?.pid!==process.pid)return;at||=Date.now();if(Date.now()-at<${writes}){fs.writeFileSync(b+"."+process.pid,JSON.stringify({pid:process.pid,at:Date.now()}));fs.renameSync(b+"."+process.pid,b);return}fs.writeFileSync(w,"whole");fs.rmSync(f);fs.rmSync(b,{force:true});process.exit(0)},50)`;
  try {
    // writing longer than the ask is waited for (600 ms): ended as it should once written, never cut short
    const slow = await standIn(root, writer(2000));
    assert.equal(await endBridgeAs("win32", slow.pid!, root, { writeMs: 20_000 }), "stopped");
    assert.equal(await exited(slow), "exit 0", "it ended by itself");
    assert.equal(fs.readFileSync(written, "utf8"), "whole", "what it wrote was written whole");
    // one that says it writes for ever: waited for only as long as given, then ended for good — and said so
    const stuck = await standIn(root, writer(3_600_000));
    const from = Date.now();
    assert.equal(await endBridgeAs("win32", stuck.pid!, root, { writeMs: 1000 }), "killed");
    assert.equal(await exited(stuck), KILLED);
    assert.ok(Date.now() - from < 15_000, `not waited for longer than given (${Date.now() - from} ms)`);
    assert.match(fs.readFileSync(path.join(root, ".strom", "live.log"), "utf8"), new RegExp(`the bridge ${stuck.pid} still wrote what the app sent after \\d+ s: ended without waiting longer`));
    assert.equal(fs.existsSync(file), false, "an ask nobody took is not left behind");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("strom live stop while the app sends an original: the bridge ends once it is written, the original kept — never cut short", { skip: !hasGit }, async () => {
  const w = new World();
  await w.withTree();
  await w.ok(["person", "add", "Jan /Lhoták/", "--sex", "M"]);
  const log = () => fs.readFileSync(path.join(w.cwd, ".strom", "live.log"), "utf8");
  const cli = path.join(import.meta.dirname, "..", "..", "src", "cli.ts");
  const info = (await w.ok(["live", "start", "--json"])).json as Info;
  let stopper: ReturnType<typeof spawn> | undefined;
  try {
    const jpg = fs.readFileSync(path.join(import.meta.dirname, "..", "fixtures", "images", "s0001.jpg"));
    const sha = crypto.createHash("sha256").update(jpg).digest("hex");
    // the app sends an original: part of it has come when strom live stop asks the bridge to end
    let answer = "";
    let status = 0;
    const req = http.request(`${info.url}/media/${sha}`, { method: "PUT", agent: false, headers: { Origin: "https://beta.stromapp.info", "Content-Type": "application/octet-stream", "Content-Length": String(jpg.length), "X-Strom-Person": "P0001", "X-Strom-Name": "lhota.jpg" } });
    const answered = new Promise<void>((resolve, reject) => {
      req.on("response", (res) => {
        status = res.statusCode ?? 0;
        res.setEncoding("utf8");
        res.on("data", (d: string) => (answer += d));
        res.on("end", resolve);
      });
      req.on("error", reject);
    });
    req.write(jpg.subarray(0, 10_000));
    let out = "";
    stopper = spawn(process.execPath, [cli, "live", "stop", "--json"], { cwd: w.cwd, env: w.env, stdio: ["ignore", "pipe", "pipe"] });
    stopper.stdout!.on("data", (d) => (out += d));
    const stopped = new Promise<number | null>((r) => stopper!.once("exit", (code) => r(code)));
    // the bridge heard the ask and says it ends once the original is written; the one asking waits
    await until("the bridge says it writes", () => fs.existsSync(path.join(w.cwd, ".strom", "live-busy.json")), 20_000);
    await new Promise((r) => setTimeout(r, 1500));
    assert.equal(alive(info.pid), true, "not ended in the middle of it");
    assert.equal(stopper.exitCode, null, "strom live stop waits");
    req.end(jpg.subarray(10_000));
    await answered;
    assert.equal(status, 200, answer);
    const got = JSON.parse(answer) as { input?: string };
    assert.match(String(got.input), /^I\d+/, answer);
    assert.equal(await stopped, 0);
    assert.equal(JSON.parse(out).how, "stopped", "ended as it should, not killed");
    await until("the bridge ended", () => !alive(info.pid), 5000);
    assert.match(log(), /asked to end \(strom live stop\) while something the app sent is written: ends once it is written\n(?:.*\n)*.*ended: strom live stop\n/);
    assert.equal(fs.existsSync(path.join(w.cwd, ".strom", "live-busy.json")), false, "nothing of the wait left");
    assert.equal((await w.ok(["input", "show", got.input!, "--json"])).json.input.persons[0], "P0001", "the original kept");
  } finally {
    if (stopper && stopper.exitCode === null) stopper.kill("SIGKILL");
    await w.run(["live", "stop"]);
    w.cleanup();
  }
});
