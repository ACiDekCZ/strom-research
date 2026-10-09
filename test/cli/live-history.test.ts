// The bridge after every commit: what git said of the commits before is kept (only the new ones are asked about),
// the operation logs are read again only when they grew, who is at work is worked out only when something changed,
// and the tree for the app is made once a run of commits stops — and all of it says exactly what it said before.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { World, hasGit } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import { history, HistoryCache } from "../../src/core/live.ts";

const opts = { skip: !hasGit };
const git = (cwd: string, args: string[]) => spawnSync("git", args, { cwd, encoding: "utf8" }).stdout.trim();

test("bridge history: the kept commits give exactly the history, git asked only about the new ones — a history written anew too", opts, async () => {
  const w = new World();
  await w.withTree();
  await w.ok(["research", "new", "Předci", "--new-person", "Jan /Novák/", "--sex", "M"]);
  await w.ok(["person", "add", "Žofie /Dvořáková/", "--sex", "F"]);
  const cache = new HistoryCache(w.cwd);
  const h1 = git(w.cwd, ["rev-parse", "HEAD"]);
  assert.deepEqual(cache.log(Tree.open(w.cwd, w.env), h1), history(w.cwd, Tree.open(w.cwd, w.env)));
  const all = cache.read;
  assert.ok(all >= 3);

  // new commits — a session among them — heard as a change, then /log
  await w.ok(["task", "add", "Křest Jana", "--level", "locate", "--where", "katalog", "--why", "a", "--done-when", "b", "--about", "P1"]);
  const h2 = git(w.cwd, ["rev-parse", "HEAD"]);
  const heard = cache.since(Tree.open(w.cwd, w.env), ["-n500", `${h1}..${h2}`]);
  assert.deepEqual(heard, history(w.cwd, Tree.open(w.cwd, w.env), ["-n500", `${h1}..${h2}`]));
  await w.ok(["session", "start", "T1"]);
  await w.ok(["note", "add", "P1", "Ткач, 東京 — poznámka"]);
  await w.ok(["session", "close", "--continue", "--summary", "nic", "--next", "dál"]);
  const h3 = git(w.cwd, ["rev-parse", "HEAD"]);
  const tree = Tree.open(w.cwd, w.env);
  const log = cache.log(tree, h3);
  assert.deepEqual(log, history(w.cwd, Tree.open(w.cwd, w.env)));
  assert.equal(cache.read, Number(git(w.cwd, ["rev-list", "--count", `${h2}..${h3}`])), "only the commits after the change heard");
  assert.ok(log.some((e) => e.task?.startsWith("T0001")), "a commit of the session names its task");
  assert.equal(cache.log(Tree.open(w.cwd, w.env), h3).length, log.length);
  assert.equal(cache.read, 0, "nothing new: git is asked about no commit");

  // the history written anew (a commit taken off, another made): all of it again, the same as history()
  spawnSync("git", ["reset", "--hard", "-q", "HEAD~2"], { cwd: w.cwd });
  await w.ok(["person", "add", "Václav /Novák/", "--sex", "M"]);
  const h4 = git(w.cwd, ["rev-parse", "HEAD"]);
  assert.deepEqual(cache.log(Tree.open(w.cwd, w.env), h4), history(w.cwd, Tree.open(w.cwd, w.env)));
  w.cleanup();
});

test("operation logs: read again in the same process once one grew", opts, async () => {
  const w = new World();
  await w.withTree();
  await w.ok(["person", "add", "Jan /Novák/", "--sex", "M"]);
  const before = Tree.open(w.cwd, w.env).readOps();
  assert.equal(Tree.open(w.cwd, w.env).readOps().length, before.length);
  await w.ok(["person", "add", "Žofie /Dvořáková/", "--sex", "F"]);
  const after = Tree.open(w.cwd, w.env).readOps();
  assert.ok(after.length > before.length);
  assert.ok(after.some((o) => /Dvořáková/.test(o.summary)));
  w.cleanup();
});

/** The events of the bridge until `until` says it has what it waits for. */
function listen(url: string, until: (text: string) => boolean, ms = 10_000): { done: Promise<string>; started: Promise<void> } {
  let started!: () => void;
  const ready = new Promise<void>((r) => (started = r));
  const done = new Promise<string>((resolve, reject) => {
    let text = "";
    const req = http.get(`${url}/events`, (res) => {
      res.on("data", (d) => {
        text += d;
        if (text.includes("event: hello")) started();
        if (until(text)) {
          req.destroy();
          resolve(text);
        }
      });
    });
    req.on("error", () => {});
    setTimeout(() => (req.destroy(), reject(new Error(`not heard: ${text}`))), ms);
  });
  return { done, started: ready };
}

test("the bridge: /log as history gives it, the tree from the newest commit once they stop, who is at work as they come and go", { skip: !hasGit || process.platform === "win32" }, async () => {
  const w = new World();
  await w.withTree();
  w.env.STROM_LIVE_POLL_MS = "100";
  await w.ok(["person", "add", "Jan /Novák/", "--sex", "M"]);
  const info = (await w.ok(["live", "start", "--json"])).json as { url: string };
  try {
    const first = (await (await fetch(`${info.url}/log`)).json()) as { entries: unknown[] };
    assert.deepEqual(first.entries, JSON.parse(JSON.stringify(history(w.cwd, Tree.open(w.cwd, w.env)))));
    // commits one after another: the tree asked for after the first comes from the last
    await w.ok(["person", "add", "Žofie /Dvořáková/", "--sex", "F"]);
    let sent!: () => void;
    const out = new Promise<void>((r) => (sent = r));
    const asked = new Promise<{ head: string; text: string }>((resolve, reject) => {
      const req = http.get(`${info.url}/tree.ged`, (res) => {
        let text = "";
        res.on("data", (d) => (text += d));
        res.on("end", () => resolve({ head: String(res.headers["x-strom-head"]), text }));
      });
      req.on("finish", sent);
      req.on("error", reject);
    });
    await out;
    await new Promise((r) => setTimeout(r, 300)); // the bridge has the request
    await w.ok(["person", "add", "Ткач /Петро/", "--sex", "M"]);
    const ged = await asked;
    assert.equal(ged.head, git(w.cwd, ["rev-parse", "HEAD"]));
    assert.match(ged.text, /Ткач/);
    const second = (await (await fetch(`${info.url}/log`)).json()) as { entries: { what: string[] }[] };
    assert.deepEqual(second.entries, JSON.parse(JSON.stringify(history(w.cwd, Tree.open(w.cwd, w.env)))));
    assert.match(second.entries[0]!.what.join(" "), /Ткач/);

    // somebody comes to work and goes: heard each time
    const workers = path.join(w.cwd, ".strom", "workers");
    const came = listen(info.url, (t) => /event: working\ndata: \[\{"who"/.test(t));
    await came.started;
    fs.mkdirSync(workers, { recursive: true });
    fs.writeFileSync(path.join(workers, "chat-1.json"), JSON.stringify({ pid: process.pid, host: os.hostname(), at: new Date().toISOString(), owner: "Codex conversation" }));
    assert.match(await came.done, /event: working\ndata: \[\{"who":"[^"]*Codex[^"]*","since"/);
    const went = listen(info.url, (t) => /event: working\ndata: \[\]/.test(t));
    await went.started;
    fs.rmSync(path.join(workers, "chat-1.json"));
    assert.match(await went.done, /event: working\ndata: \[\]/);
  } finally {
    await w.ok(["live", "stop"]);
  }
  w.cleanup();
});
