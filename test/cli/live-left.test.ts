// No bridge outlives what it serves (found 2026-11-09: tens of bridges of tests running on for an hour, their research
// still there, after a live start that gave up on a busy computer and the test failed before its cleanup): a world ends
// its bridges — also one no live.json names — and a test file that ends without its cleanup leaves none; a bridge whose
// research is gone ends by itself, but not when it is away for a moment; a bridge started while the tree's bridge runs
// already ends at once and takes nothing over.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { spawn, spawnSync } from "node:child_process";
import { World, hasGit, readJsonFile } from "../helpers.ts";
import { bridgeRuns } from "../bridges.ts";

const opts = { skip: !hasGit || process.platform === "win32" };
const cli = path.join(import.meta.dirname, "..", "..", "src", "cli.ts");

const until = async (what: string, ok: () => boolean, ms = 20_000) => {
  for (const end = Date.now() + ms; Date.now() < end; await new Promise((r) => setTimeout(r, 100))) if (ok()) return;
  assert.fail(`waited in vain: ${what}`);
};

test("a world's cleanup ends its bridges and waits for them — also one no live.json names (it came up after a live start gave up)", opts, async () => {
  const w = new World();
  try {
    await w.withTree("Lhotákovi");
    const { pid } = (await w.ok(["live", "start", "--json"])).json as { pid: number };
    assert.ok(bridgeRuns(pid));
    // the note a bridge that came up late never had (or another one's in its place)
    fs.rmSync(path.join(w.cwd, ".strom", "live.json"));
    w.cleanup();
    assert.equal(bridgeRuns(pid), false, "ended before cleanup returns");
    assert.equal(fs.existsSync(w.dir), false);
  } finally {
    w.cleanup();
  }
});

test("a test file that ends without its cleanup (a test failed) leaves no bridge running and no folder", opts, async () => {
  const helpers = pathToFileURL(path.join(import.meta.dirname, "..", "helpers.ts")).href;
  const script = `import { World } from ${JSON.stringify(helpers)};
const w = new World();
await w.withTree("Kroutilovi");
const { pid } = (await w.ok(["live", "start", "--json"])).json;
console.log(JSON.stringify({ pid, dir: w.dir }));
process.exit(1);`;
  const r = spawnSync(process.execPath, ["--input-type=module", "-e", script], { encoding: "utf8", env: process.env, timeout: 120_000 });
  const line = r.stdout.trim().split("\n").pop() ?? "";
  const { pid, dir } = JSON.parse(line) as { pid: number; dir: string };
  try {
    assert.equal(r.status, 1, r.stderr);
    assert.equal(bridgeRuns(pid), false, "its bridge ended with the process");
    assert.equal(fs.existsSync(dir), false, "its folder gone");
  } finally {
    if (bridgeRuns(pid)) process.kill(pid, "SIGKILL");
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("a bridge whose research is gone ends by itself — not when it is away for a moment", opts, async () => {
  const w = new World();
  try {
    await w.withTree("Lhotákovi");
    Object.assign(w.env, { STROM_LIVE_POLL_MS: "100", STROM_LIVE_GONE_MS: "1500" });
    const { pid } = (await w.ok(["live", "start", "--json"])).json as { pid: number };
    const file = path.join(w.cwd, "strom.json");
    // away for a moment (a network folder reconnecting): several looks, shorter than the while it waits
    fs.renameSync(file, `${file}.away`);
    await new Promise((r) => setTimeout(r, 700));
    fs.renameSync(`${file}.away`, file);
    await new Promise((r) => setTimeout(r, 1500));
    assert.ok(bridgeRuns(pid), "still running");
    assert.doesNotMatch(fs.readFileSync(path.join(w.cwd, ".strom", "live.log"), "utf8"), /ended:/u);
    // gone for good (taken off, moved): ended by itself, its end kept beside the notes the research leaves
    fs.rmSync(file);
    await until("the bridge ends", () => !bridgeRuns(pid));
    const last = readJsonFile(path.join(w.cwd, ".strom", "live-last.json"));
    assert.equal(last.pid, pid);
    assert.deepEqual([last.ended?.kind, last.ended?.reason], ["gone", "the research is no longer there"]);
  } finally {
    w.cleanup();
  }
});

test("a bridge started while the tree's bridge runs ends at once: nothing taken over, the running one goes on", opts, async () => {
  const w = new World();
  try {
    await w.withTree("Lhotákovi");
    const a = (await w.ok(["live", "start", "--json"])).json as { pid: number; port: number };
    // one started late (strom gave up waiting for it, and started another meanwhile)
    const b = spawn(process.execPath, [cli, "live", "serve"], { cwd: w.cwd, env: { ...w.env, STROM_TREE: w.cwd, STROM_SPAWNED: "1" }, stdio: "ignore" });
    const code = await new Promise<number | null | "running">((r) => {
      const late = setTimeout(() => r("running"), 30_000);
      b.once("exit", (c) => (clearTimeout(late), r(c)));
    });
    if (code === "running") b.kill("SIGKILL");
    assert.equal(code, 0, "the second bridge ended at once");
    assert.ok(bridgeRuns(a.pid), "the tree's bridge runs on");
    const live = readJsonFile(path.join(w.cwd, ".strom", "live.json"));
    assert.deepEqual([live.pid, live.port], [a.pid, a.port]);
    assert.equal(readJsonFile(path.join(w.cwd, ".strom", "live-last.json")).pid, a.pid);
    assert.match(fs.readFileSync(path.join(w.cwd, ".strom", "live.log"), "utf8"), new RegExp(`another bridge of this tree runs already \\(${a.pid}\\): this one \\(${b.pid}\\) ends`, "u"));
    await w.ok(["live", "stop"]);
  } finally {
    w.cleanup();
  }
});
