// The bridge never holds its tree's folder (found on Windows: a research's folder could not be deleted after the menu
// closed — the bridge ran in it with its log open, for hours): on Windows it runs in the settings' folder, elsewhere in
// its tree's (an older strom tells its tree's bridge by it), with no file of the tree open, ends by itself once its
// research is gone (the folder or its .strom deleted or moved) without making either again, and the menu's goodbye says
// it goes on while it runs.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { World, hasGit } from "../helpers.ts";
import { bridgeCwd } from "../../src/core/live.ts";

const opts = { skip: !hasGit || process.platform === "win32" };
// what a process holds is asked of the system (lsof on a Mac, /proc on Linux)
const heldKnown = process.platform === "linux" || (process.platform === "darwin" && spawnSync("lsof", ["-v"]).error === undefined);

type Info = { pid: number; port: number; token: string; url: string };

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

/** The folders and files a process holds: its working folder and its open files. */
function held(pid: number): { cwd: string; files: string[] } {
  if (process.platform === "linux") {
    const fds = path.join("/proc", String(pid), "fd");
    const files = fs.readdirSync(fds).flatMap((fd) => {
      try {
        return [fs.readlinkSync(path.join(fds, fd))];
      } catch {
        return [];
      }
    });
    return { cwd: fs.readlinkSync(`/proc/${pid}/cwd`), files };
  }
  const r = spawnSync("lsof", ["-p", String(pid), "-Ffn"], { encoding: "utf8" });
  let fd = "";
  let cwd = "";
  const files: string[] = [];
  for (const line of r.stdout.split("\n")) {
    if (line.startsWith("f")) fd = line.slice(1);
    else if (line.startsWith("n")) {
      if (fd === "cwd") cwd = line.slice(1);
      else files.push(line.slice(1));
    }
  }
  return { cwd, files };
}

test("the bridge runs in its tree's folder, as an older strom tells its tree's bridge, and holds no file of the tree open — its log written line by line all the same", { skip: opts.skip || !heldKnown }, async () => {
  const w = new World();
  await w.withTree();
  const root = fs.realpathSync(w.cwd);
  const info = (await w.ok(["live", "start", "--json"])).json as Info;
  try {
    const h = held(info.pid);
    // an older strom (1.17) going on with this tree ends a bridge running in its folder, never one elsewhere (found in
    // the switch from the beta back to the release: it ran in the settings' folder and was left running)
    assert.equal(fs.realpathSync(h.cwd), root, "it runs in its tree's folder");
    const inTree = h.files.filter((f) => f === root || f.startsWith(root + path.sep));
    assert.deepEqual(inTree, [], "no file of the tree held open");
    assert.match(fs.readFileSync(path.join(root, ".strom", "live.log"), "utf8"), /started: strom /);
    // it is the tree's bridge all the same: stopped by its tree's strom
    assert.equal(((await w.ok(["live", "stop", "--json"])).json as { how: string }).how, "stopped");
    await until("the bridge gone", () => !alive(info.pid));
  } finally {
    if (alive(info.pid)) process.kill(info.pid, "SIGTERM");
    w.cleanup();
  }
});

test("a bridge whose research is gone ends by itself — its .strom deleted, or its whole folder — and makes neither again", opts, async () => {
  const w = new World();
  await w.withTree();
  const root = w.cwd;
  const env = { STROM_LIVE_POLL_MS: "100" };
  const pids: number[] = [];
  try {
    // .strom deleted by hand (the folder of the research stays)
    const a = (await w.ok(["live", "start", "--json"], { env })).json as Info;
    pids.push(a.pid);
    fs.rmSync(path.join(root, ".strom"), { recursive: true, force: true });
    await until("the bridge ends once its .strom is gone", () => !alive(a.pid), 10_000);
    await new Promise((r) => setTimeout(r, 500));
    assert.ok(!fs.existsSync(path.join(root, ".strom")), ".strom never made again");
    // the whole folder deleted
    const b = (await w.ok(["live", "start", "--json"], { env })).json as Info;
    pids.push(b.pid);
    assert.notEqual(b.pid, a.pid);
    fs.rmSync(root, { recursive: true, force: true });
    await until("the bridge ends once its research is gone", () => !alive(b.pid), 10_000);
    await new Promise((r) => setTimeout(r, 500));
    assert.ok(!fs.existsSync(root), "the folder never made again");
  } finally {
    for (const pid of pids) if (alive(pid)) process.kill(pid, "SIGTERM");
    w.cleanup();
  }
});

test("the menu's goodbye says the Strom app's bridge goes on and how to stop it — only while it runs", opts, async () => {
  const w = new World();
  await w.withTree();
  const none = await w.ok([], { tty: true, answers: ["0"] });
  assert.match(none.out, /Na shledanou\./);
  assert.doesNotMatch(none.out, /Most pro aplikaci/);
  const info = (await w.ok(["live", "start", "--json"])).json as Info;
  try {
    const bye = await w.ok([], { tty: true, answers: ["0"] });
    assert.match(bye.out, /Na shledanou\.[^\n]*\nMost pro aplikaci Strom běží dál na pozadí; zastavit: strom live stop\n/);
    assert.match((await w.ok([], { tty: true, answers: ["0"], env: { STROM_LANG: "de" } })).out, /\nDie Brücke für die Strom-App läuft im Hintergrund weiter; beenden: strom live stop\n/);
    // the help says how a tree is deleted, the person's and the agent's
    assert.match((await w.ok(["help", "trees", "remove", "--human"])).out, /takto se rodokmen maže/);
    assert.match((await w.ok(["help", "live", "stop", "--human"])).out, /most pro aplikaci Strom běží na pozadí i po zavření nabídky/);
    assert.match((await w.ok(["help", "live", "stop"])).out, /a whole family tree is deleted with\s+strom trees remove/);
    assert.match((await w.ok(["help", "trees", "remove"])).out, /The way to delete a family tree/);
    await w.ok(["live", "stop"]);
    await new Promise((r) => setTimeout(r, 300));
    assert.doesNotMatch((await w.ok([], { tty: true, answers: ["0"] })).out, /Most pro aplikaci/);
  } finally {
    if (alive(info.pid)) process.kill(info.pid, "SIGTERM");
    w.cleanup();
  }
});

test("on Windows a bridge runs in the settings' folder, never its tree's: a folder a process runs in cannot be deleted there", () => {
  const w = new World();
  try {
    const root = w.cwd;
    assert.equal(bridgeCwd(root, w.env, "win32"), w.env.STROM_CONFIG_DIR);
    assert.equal(bridgeCwd(root, w.env, "darwin"), root);
    assert.equal(bridgeCwd(root, w.env, "linux"), root);
    // a tree no longer there: the settings' folder
    assert.equal(bridgeCwd(path.join(root, "gone"), w.env, "darwin"), w.env.STROM_CONFIG_DIR);
  } finally {
    w.cleanup();
  }
});
