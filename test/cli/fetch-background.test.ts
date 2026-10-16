// strom fetch --background (spec 001, U2): the images the agent will read fetched by a strom of its own while the
// agent works on. It belongs to the session and its task: it stops when asked (strom fetch --stop), when the session is
// asked to finish or closes (in a run: when the run ends); strom fetch --status and the next brief say how far it is.
// A fetch in the foreground from the same archive goes first, images being fetched are not fetched twice, and an
// archive at a person's pace is never fetched in the background. Each test ends every process it started.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { opts, scans } from "./connectors.helpers.ts";
import { World, fakeConnector } from "../helpers.ts";
import { enterWorker } from "../../src/core/workers.ts";
import { readImages } from "../../src/commands/read.ts";

/** The processes the tests started in the background: none may outlive them. */
const started = new Set<number>();
const alive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};
after(() => {
  for (const pid of started) if (alive(pid)) process.kill(pid, "SIGKILL");
});

/**
 * An archive whose book has as many images as asked (each its own file), answered after `delay` ms; each hit timed.
 * It runs in a process of its own: a strom run inside the test's process waits for locks without its event loop, and
 * an archive in the same process would not answer the strom in the background meanwhile — no archive does that.
 */
async function bookArchive(o: { delay?: number } = {}): Promise<{ base: string; hits: { path: string; at: number }[]; close: () => Promise<void> }> {
  const code = `
    const http = require("node:http"), fs = require("node:fs");
    const scan = fs.readFileSync(process.argv[1]), delay = Number(process.argv[2]);
    const s = http.createServer((req, res) => {
      const u = new URL(req.url ?? "/", "http://x");
      process.stdout.write(JSON.stringify({ path: u.pathname, at: Date.now() }) + "\\n");
      const img = /^\\/img\\/5359\\/(\\d+)\\.jpg$/.exec(u.pathname);
      if (!img) return void res.writeHead(404).end();
      setTimeout(() => {
        const note = Buffer.from("image " + img[1]);
        const com = Buffer.from([0xff, 0xfe, 0, note.length + 2]);
        res.writeHead(200, { "content-type": "image/jpeg" }).end(Buffer.concat([scan.subarray(0, 2), com, note, scan.subarray(2)]));
      }, delay);
    });
    s.listen(0, "127.0.0.1", () => process.stdout.write(JSON.stringify({ port: s.address().port }) + "\\n"));
    process.stdin.on("end", () => process.exit(0)).resume();
  `;
  const child = spawn(process.execPath, ["-e", code, path.join(scans, "s0001.jpg"), String(o.delay ?? 0)], { stdio: ["pipe", "pipe", "inherit"] });
  started.add(child.pid!);
  const hits: { path: string; at: number }[] = [];
  let rest = "";
  const port = await new Promise<number>((resolve, reject) => {
    child.once("exit", (c) => reject(new Error(`the archive ended (${c})`)));
    child.stdout!.on("data", (d: Buffer) => {
      rest += d.toString("utf8");
      for (let i = rest.indexOf("\n"); i >= 0; i = rest.indexOf("\n")) {
        const line = JSON.parse(rest.slice(0, i)) as { port?: number; path: string; at: number };
        rest = rest.slice(i + 1);
        if (line.port) resolve(line.port);
        else hits.push(line);
      }
    });
  });
  child.unref();
  (child.stdout as unknown as { unref(): void }).unref();
  return {
    base: `http://127.0.0.1:${port}`,
    hits,
    close: async () => {
      if (child.exitCode !== null) return;
      const gone = new Promise<void>((r) => child.once("exit", () => r()));
      child.stdin!.end();
      await gone;
    },
  };
}

async function setUp(archive: { base: string }, policy?: Record<string, unknown>, connector: { confirm?: boolean } = {}): Promise<World> {
  const w = new World();
  await w.withTree();
  w.env.STROM_LANG = "en";
  await fakeConnector(w, "zkusebni", archive.base, policy, connector);
  await w.ok(["recordset", "add", "Týnec N 1784–1820", "--kinds", "baptism"]);
  // the child fetches at a real pace: the person's own, short, for the test
  await w.ok(["allow", "host", "127.0.0.1", "--pace", "0.5"], { tty: true });
  await w.ok(["task", "add", "Křest Jana", "--level", "locate", "--where", "B1", "--why", "zkouška", "--done-when", "hotovo"]);
  return w;
}

async function until(what: string, ok: () => boolean | Promise<boolean>, ms = 30_000): Promise<void> {
  const by = Date.now() + ms;
  while (Date.now() < by) {
    if (await ok()) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  assert.fail(`waited ${ms} ms in vain: ${what}`);
}

/** Start a fetch in the background: its pid kept for the end of the tests. */
async function background(w: World, images: string, env: Record<string, string> = {}): Promise<number> {
  const r = await w.ok(["fetch", "zkusebni", "5359", "--images", images, "--recordset", "B1", "--background", "--json"], { env });
  const pid = r.json.pid as number;
  assert.ok(pid > 0, r.out);
  started.add(pid);
  return pid;
}

const registered = async (w: World) => ((await w.ok(["media", "list", "--recordset", "B1", "--json"])).json.media as { image: number }[]).map((m) => m.image).sort((a, b) => a - b);
const clean = (w: World) => spawnSync("git", ["status", "--porcelain", "data"], { cwd: w.cwd, encoding: "utf8" }).stdout === "";
const status = async (w: World) => (await w.ok(["fetch", "--status", "--json"])).json as { active: { pid: number; registered: number; images: number[]; background?: boolean; task?: string; yielding?: boolean }[]; ended: { pid: number; registered: number[]; missed: number[]; stopped?: string; exitCode: number }[] };
const endedOf = async (w: World, pid: number) => (await status(w)).ended.find((e) => e.pid === pid);
const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

test("--background: a strom of its own fetches while the command ends; --status says how far, the brief too; all registered and committed", opts, async () => {
  const a = await bookArchive();
  const w = await setUp(a);
  try {
    await w.ok(["session", "start", "T1"]);
    const t0 = Date.now();
    const start = await w.ok(["fetch", "zkusebni", "5359", "--images", "1-12", "--recordset", "B1", "--background"]);
    const pid = Number(/pid (\d+)/.exec(start.out)?.[1]);
    started.add(pid);
    assert.ok(Date.now() - t0 < 15_000, "the command ends once the fetch began");
    assert.match(start.out, /fetching 12 image\(s\) of B0001 \(images 1–12\) in the background — pid \d+, for T0001/);
    assert.match(start.out, /strom read B0001 --images 1-12 /);
    assert.ok(alive(pid), "the fetch goes on after the command ended");
    // how far it is: the book, its images, whose
    const now = await w.ok(["fetch", "--status"]);
    assert.match(now.out, /B0001 \(zkusebni 5359\): \d+\/12 images registered · in the background for T0001 \(session N0001\)/);
    const brief = await w.ok(["brief", "T1"]);
    assert.match(brief.out, /## Images being fetched now \(strom fetch --status\)\n- B0001: \d+\/12 images registered \(in the background, for T0001\)/);
    await until("the fetch ended", async () => !alive(pid) && !!(await endedOf(w, pid)));
    assert.deepEqual(await registered(w), range(1, 12));
    assert.ok(clean(w), "all committed");
    const ended = (await endedOf(w, pid))!;
    assert.deepEqual(ended.registered, range(1, 12));
    assert.deepEqual(ended.missed, []);
    assert.equal(ended.exitCode, 0);
    assert.match((await w.ok(["fetch", "--status"])).out, /nothing is being fetched now\nended lately \(in the background\):\n {2}B0001 \(zkusebni 5359\): 12\/12 images registered/);
    // the measure keeps it apart (M11): a run in the background
    const journal = fs.readFileSync(path.join(w.cwd, ".strom", "metrics", "fetch.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
    assert.ok(journal.some((f) => f.bg === true && f.rs === "B0001" && f.got.length === 12), JSON.stringify(journal));
    await w.ok(["check"]);
  } finally {
    w.cleanup();
    await a.close();
  }
});

test("--background in a Czech research: its log, which the agent reads, is English throughout — the count too", opts, async () => {
  const a = await bookArchive();
  const w = await setUp(a);
  w.env.STROM_LANG = "cs";
  try {
    await w.ok(["session", "start", "T1"]);
    const start = await w.ok(["fetch", "zkusebni", "5359", "--images", "1-20", "--recordset", "B1", "--background", "--json"]);
    const pid = start.json.pid as number;
    started.add(pid);
    await until("the fetch ended", async () => !alive(pid) && !!(await endedOf(w, pid)));
    const log = fs.readFileSync(start.json.log as string, "utf8");
    assert.match(log, /^20 image\(s\) through zkusebni: /m, log);
    const count = log.split("\n").filter((l) => /^ {2}· \d+\/20 /.test(l));
    assert.deepEqual(count, [2, 4, 6, 8, 10, 12, 14, 16, 18].map((n) => `  · ${n}/20 images`), log);
    assert.doesNotMatch(log, /snímk|chyba/, log);
    // a fetch in the foreground stays in the research language: the person follows it
    const fg = await w.ok(["fetch", "zkusebni", "5359", "--images", "21-40", "--recordset", "B1"]);
    assert.match(fg.err, /^ {2}· 2\/20 snímků$/m, fg.err);
  } finally {
    w.cleanup();
    await a.close();
  }
});

test("--background of a list with gaps: every command it says with the images is one word of the shell that strom read takes back", opts, async () => {
  const a = await bookArchive({ delay: 800 });
  const w = await setUp(a);
  const asked = [1, 2, 3, 5, 7, 8, 9];
  // the images a hint names after --images, as strom read reads them (its own parser)
  const named = (text: string, before: RegExp): number[] => {
    const m = new RegExp(`${before.source} --images (\\S+)( |$)`, "mu").exec(text);
    assert.ok(m, `${before.source} --images … in:\n${text}`);
    return readImages(m[1]!);
  };
  try {
    await w.ok(["session", "start", "T1"]);
    const start = await w.ok(["fetch", "zkusebni", "5359", "--images", "1-3,5,7-9", "--recordset", "B1", "--background"]);
    started.add(Number(/pid (\d+)/.exec(start.out)?.[1]));
    assert.deepEqual(named(start.out, /read them as they come: strom read B0001/), asked, start.out);
    // the same images again: nothing fetched, the reading said
    const twice = await w.ok(["fetch", "zkusebni", "5359", "--images", "1-3,5,7-9", "--recordset", "B1", "--background"]);
    assert.deepEqual(named(twice.out, /nothing fetched — strom read B0001/), asked, twice.out);
    // the brief while it works
    const brief = await w.ok(["brief", "T1"]);
    if (/B0001: \d+\/7 images registered/.test(brief.out)) assert.deepEqual(named(brief.out, /strom read B0001/), asked, brief.out);
    // stopped: what was not fetched, said as a command of one word
    const stop = await w.ok(["fetch", "--stop", "B1"]);
    if (/not fetched: images/.test(stop.out)) {
      const missed = named(stop.out, /\(strom fetch zkusebni 5359/);
      assert.ok(missed.length && missed.every((n) => asked.includes(n)), stop.out);
      assert.deepEqual(named((await w.ok(["brief", "T1"])).out, /strom fetch zkusebni 5359/), missed);
    }
  } finally {
    w.cleanup();
    await a.close();
  }
});

test("--background needs a session, a record set, and an archive that allows automation: refused with what to do", opts, async () => {
  const a = await bookArchive();
  const w = await setUp(a);
  try {
    const none = await w.run(["fetch", "zkusebni", "5359", "--images", "1-3", "--recordset", "B1", "--background"]);
    assert.equal(none.code, 2, none.err);
    assert.match(none.err, /--background belongs to a session/);
    assert.match(none.err, /strom session start T…/);
    await w.ok(["session", "start", "T1"]);
    const inbox = await w.run(["fetch", "zkusebni", "5359", "--images", "1-3", "--background"]);
    assert.equal(inbox.code, 2);
    assert.match(inbox.err, /--images and --recordset/);
    assert.equal(a.hits.filter((h) => h.path.startsWith("/img/")).length, 0, "nothing asked of the archive");
  } finally {
    w.cleanup();
    await a.close();
  }
  // an archive whose terms restrict automated access: images at a person's pace, never in the background
  const b = await bookArchive();
  const v = await setUp(b, { automation: "restricted" });
  try {
    await v.ok(["session", "start", "T1"]);
    const r = await v.run(["fetch", "zkusebni", "5359", "--images", "1-3", "--recordset", "B1", "--background"]);
    assert.notEqual(r.code, 0);
    assert.match(r.err, /its terms restrict automated access — images only at a person's pace, never in the background/);
    assert.match(r.err, /strom fetch zkusebni 5359 --images 1-3 --recordset B0001 \(without --background\)/);
    assert.equal(b.hits.filter((h) => h.path.startsWith("/img/")).length, 0);
  } finally {
    v.cleanup();
    await b.close();
  }
  // an archive whose terms are not known yet (its connector's reading not confirmed): taken as restricted, and said
  // so — never "its terms restrict"
  const c = await bookArchive();
  const u = await setUp(c, { automation: "allowed" }, { confirm: false });
  try {
    await u.ok(["session", "start", "T1"]);
    const r = await u.run(["fetch", "zkusebni", "5359", "--images", "1-3", "--recordset", "B1", "--background"]);
    assert.notEqual(r.code, 0, r.out + r.err);
    assert.match(r.err, /Testovací archiv \(restricted \(a connector the user has not confirmed yet[^)]*\)\): its terms are not known yet, taken as restricting automated access — images only at a person's pace, never in the background/);
    assert.doesNotMatch(r.err, /its terms restrict automated access/);
    assert.equal(c.hits.filter((h) => h.path.startsWith("/img/")).length, 0);
  } finally {
    u.cleanup();
    await c.close();
  }
  // a confirmed connector that found no terms (automation unknown): the floor strom kept of it is restricted, the
  // terms still not known — said so
  const d = await bookArchive();
  const x = await setUp(d, { automation: "unknown" });
  try {
    await x.ok(["session", "start", "T1"]);
    const r = await x.run(["fetch", "zkusebni", "5359", "--images", "1-3", "--recordset", "B1", "--background"]);
    assert.notEqual(r.code, 0, r.out + r.err);
    assert.match(r.err, /Testovací archiv \(restricted \([^)]*\)\): its terms are not known yet, taken as restricting automated access — images only at a person's pace, never in the background/);
    assert.doesNotMatch(r.err, /its terms restrict automated access/);
    assert.equal(d.hits.filter((h) => h.path.startsWith("/img/")).length, 0);
  } finally {
    x.cleanup();
    await d.close();
  }
});

test("--background in the last 10 minutes of a session outside a run: refused at once, nothing asked of the archive", opts, async () => {
  const a = await bookArchive();
  const w = await setUp(a);
  try {
    await w.ok(["session", "start", "T1"]);
    const late = await w.run(["fetch", "zkusebni", "5359", "--images", "1-10", "--recordset", "B1", "--background"], { env: { STROM_DEADLINE: new Date(Date.now() + 9 * 60_000).toISOString() } });
    assert.equal(late.code, 2, late.out + late.err);
    assert.match(late.err, /session N0001 is in its last 10 minutes: nothing new starts in the background/);
    assert.match(late.err, /write down what was found and close the session/);
    assert.doesNotMatch(late.out, /in the background/);
    assert.equal(a.hits.filter((h) => h.path.startsWith("/img/")).length, 0, "nothing asked of the archive");
    assert.equal((await status(w)).active.length, 0, "no fetch began");
    // with more time left it starts as before
    const pid = await background(w, "1-3", { STROM_DEADLINE: new Date(Date.now() + 60 * 60_000).toISOString() });
    await until("it ended", () => !alive(pid), 20_000);
    assert.equal((await registered(w)).length, 3);
    await w.ok(["check"]);
  } finally {
    w.cleanup();
    await a.close();
  }
});

test("--stop: what came registered and committed, the rest said exactly; --status tells it", opts, async () => {
  const a = await bookArchive({ delay: 150 });
  const w = await setUp(a);
  try {
    await w.ok(["session", "start", "T1"]);
    const pid = await background(w, "1-40");
    await until("the first batch registered", async () => (await registered(w)).length >= 10);
    const stop = await w.ok(["fetch", "--stop", "B1"]);
    assert.match(stop.out, /stopped B0001 \(zkusebni 5359\): \d+\/40 images registered .* — stopped: asked to stop \(strom fetch --stop\) · not fetched: images /);
    assert.ok(!alive(pid), "it ended");
    const ended = (await endedOf(w, pid))!;
    assert.ok(ended.missed.length > 0 && ended.registered.length >= 10, JSON.stringify(ended));
    assert.deepEqual(await registered(w), ended.registered);
    assert.deepEqual([...ended.registered, ...ended.missed].sort((x, y) => x - y), range(1, 40));
    assert.ok(clean(w), "all committed");
    // the next brief says what was left
    assert.match((await w.ok(["brief", "T1"])).out, /- B0001: a fetch in the background ended with images .+ not fetched \(stopped: asked to stop/);
    assert.match((await w.ok(["fetch", "--stop"])).out, /no fetch in the background — nothing to stop/);
    await w.ok(["check"]);
  } finally {
    w.cleanup();
    await a.close();
  }
});

test("the session asked to finish stops it; a session closed outside a run stops it", opts, async () => {
  const a = await bookArchive({ delay: 150 });
  const w = await setUp(a);
  try {
    await w.ok(["session", "start", "T1"]);
    const pid = await background(w, "1-40");
    await until("a batch registered", async () => (await registered(w)).length >= 10);
    await w.ok(["session", "finish", "N1"]);
    await until("it stopped", () => !alive(pid), 20_000);
    assert.match((await endedOf(w, pid))!.stopped ?? "", /its session N0001 is asked to finish/);
    assert.ok(clean(w));
    // a new fetch in a session asked to finish: refused, nothing new starts in it
    const late = await w.run(["fetch", "zkusebni", "5359", "--images", "30-40", "--recordset", "B1", "--background"]);
    assert.equal(late.code, 2);
    assert.match(late.err, /asked to finish: nothing new starts in it/);
    await w.ok(["session", "close", "--continue", "--summary", "hotovo", "--next", "dál"]);

    await w.ok(["task", "add", "Křest Marie", "--level", "locate", "--where", "B1", "--why", "zkouška", "--done-when", "hotovo"]);
    await w.ok(["session", "start", "T2"]);
    const second = await background(w, "41-80");
    await until("it began", async () => (await status(w)).active.some((m) => m.pid === second));
    await w.ok(["session", "close", "--continue", "--summary", "hotovo", "--next", "dál"]);
    await until("it stopped", () => !alive(second), 20_000);
    assert.match((await endedOf(w, second))!.stopped ?? "", /its session N0002 closed/);
    assert.ok(clean(w));
    await w.ok(["check"]);
  } finally {
    w.cleanup();
    await a.close();
  }
});

test("in a run: it goes on after its session closed, and stops when the run ends", opts, async () => {
  const a = await bookArchive({ delay: 150 });
  const w = await setUp(a);
  // the run is present in the tree as strom run is (its worker), here held by the test's own process
  const worker = `run-${process.pid}-test`;
  const leave = enterWorker(w.cwd, worker, "a run of the test");
  try {
    const env = { STROM_WORKER: worker };
    await w.ok(["session", "start", "T1"], { env });
    const pid = await background(w, "1-40", env);
    assert.match((await w.ok(["fetch", "--status"])).out, /in the background for T0001/);
    await until("a batch registered", async () => (await registered(w)).length >= 10);
    await w.ok(["session", "close", "--continue", "--summary", "hotovo", "--next", "dál"], { env });
    // the images were the agent's choice: they come while the run works
    await new Promise((r) => setTimeout(r, 4500));
    assert.ok(alive(pid), "it goes on after the session closed, the run at work");
    leave();
    await until("it stopped with the run", () => !alive(pid), 20_000);
    assert.match((await endedOf(w, pid))!.stopped ?? "", /the run it was started in ended/);
    assert.ok(clean(w));
    await w.ok(["check"]);
  } finally {
    leave();
    w.cleanup();
    await a.close();
  }
});

test("a fetch in the foreground from the same archive goes first; images being fetched are not fetched twice", opts, async () => {
  const a = await bookArchive({ delay: 100 });
  const w = await setUp(a);
  try {
    await w.ok(["session", "start", "T1"]);
    const pid = await background(w, "1-25");
    await until("a batch registered", async () => (await registered(w)).length >= 10);
    // a second fetch in the background of the same images: nothing asked
    const twice = await w.ok(["fetch", "zkusebni", "5359", "--images", "1-25", "--recordset", "B1", "--background"]);
    assert.match(twice.out, /images .+ of B0001 are being fetched already \(in the background for T0001, session N0001/);
    assert.match(twice.out, /nothing fetched — strom read B0001 --images/);
    // in the foreground: other images of the book first, before the background asks again …
    const fg = await w.ok(["fetch", "zkusebni", "5359", "--images", "20-30", "--recordset", "B1"]);
    // … and the background's images it asked too: waited for, never asked twice
    assert.match(fg.err, /images .+ of B0001 are being fetched already .*: strom fetches the rest, then waits for them/);
    assert.match(fg.out, /image\(s\) of B0001 \(images .+\) came by the other fetch — nothing asked twice/);
    await until("the background ended", () => !alive(pid));
    const img = a.hits.filter((h) => h.path.startsWith("/img/"));
    const asked = img.map((h) => Number(/(\d+)\.jpg$/.exec(h.path)![1]));
    assert.equal(new Set(asked).size, asked.length, `each image asked once: ${asked.join(",")}`);
    assert.deepEqual(await registered(w), range(1, 30));
    // the foreground's images in one stretch: the background asked at most the one request it held already
    const ours = img.map((h, i) => ({ n: asked[i]!, i })).filter((x) => x.n >= 26);
    const between = img.slice(ours[0]!.i, ours.at(-1)!.i + 1).filter((h) => Number(/(\d+)\.jpg$/.exec(h.path)![1]) < 26);
    assert.ok(between.length <= 1, `the background waited: ${asked.join(",")}`);
    assert.ok(clean(w));
    await w.ok(["check"]);
  } finally {
    w.cleanup();
    await a.close();
  }
});

test("a stop of the process while git commits a batch: the batch committed, the fetch said as interrupted", { ...opts, skip: opts.skip || process.platform === "win32" ? "signals of POSIX (Windows: the same code, its stop is the look every few seconds — tested above)" : false }, async () => {
  const a = await bookArchive();
  const w = await setUp(a);
  try {
    await w.ok(["session", "start", "T1"]);
    const real = spawnSync("sh", ["-c", "command -v git"], { encoding: "utf8" }).stdout.trim();
    const flag = path.join(w.dir, "in-add");
    const wrapper = path.join(w.dir, "git-slow.sh");
    fs.writeFileSync(wrapper, `#!/bin/sh\nif [ "$1" = "add" ] && [ ! -e "${flag}.done" ] && [ -n "$STROM_FETCH_BG" ]; then touch "${flag}" "${flag}.done"; sleep 4; fi\nexec "${real}" "$@"\n`, { mode: 0o755 });
    const pid = await background(w, "1-14", { STROM_GIT: wrapper });
    await until("git add of the first batch began", () => fs.existsSync(flag));
    process.kill(pid, "SIGTERM");
    await until("it ended", () => !alive(pid), 20_000);
    const ended = (await endedOf(w, pid))!;
    assert.equal(ended.exitCode, 130, JSON.stringify(ended));
    assert.ok(ended.registered.length >= 10, JSON.stringify(ended));
    assert.ok(clean(w), "all committed");
    const log = fs.readdirSync(path.join(w.cwd, ".strom", "fetch")).find((f) => f.startsWith("background-B0001-"))!;
    const said = fs.readFileSync(path.join(w.cwd, ".strom", "fetch", log), "utf8");
    assert.doesNotMatch(said, /failed/, said);
    assert.match(said, /interrupted: images .+ not fetched — the same command fetches them/, said);
    await w.ok(["check"]);
  } finally {
    w.cleanup();
    await a.close();
  }
});

test("--background is for the task the agent works on: --task, else the one task this session worked on that names the book — its marks, its output, its measure", opts, async () => {
  const a = await bookArchive();
  const w = await setUp(a);
  try {
    // the session's task names no book; the task the agent works on, added in the session, names this one
    await w.ok(["task", "add", "Křest Marie", "--level", "locate", "--where", "Týnec", "--why", "zkouška", "--done-when", "hotovo"]); // T0002
    await w.ok(["session", "start", "T2"]);
    await w.ok(["task", "add", "Křest Josefa", "--level", "locate", "--where", "Křty B0001 (Týnec)", "--why", "zkouška", "--done-when", "hotovo"]); // T0003
    // no book given: the book of B0001 from its images fetched before
    await w.ok(["fetch", "zkusebni", "5359", "--images", "1", "--recordset", "B1"]);
    const start = await w.ok(["fetch", "zkusebni", "--images", "2-4", "--recordset", "B1", "--background"]);
    const pid = Number(/pid (\d+)/.exec(start.out)?.[1]);
    started.add(pid);
    assert.match(start.out, /fetching 3 image\(s\) of B0001 \(images 2–4\) in the background — pid \d+, for T0003/);
    assert.match(start.out, /for T0003: the one task this session worked on that names B0001 \(the session's own: T0002\) — for another one: --task T…/);
    await until("the fetch ended", async () => !alive(pid) && !!(await endedOf(w, pid)));
    assert.equal(((await endedOf(w, pid)) as { task?: string }).task, "T0003");
    const ended = JSON.parse(fs.readFileSync(path.join(w.cwd, ".strom", "fetch", `ended-B0001.${pid}.json`), "utf8")) as { task?: string; session?: string };
    assert.equal(ended.task, "T0003");
    assert.equal(ended.session, "N0001");
    const journal = fs.readFileSync(path.join(w.cwd, ".strom", "metrics", "fetch.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
    assert.ok(journal.some((f) => f.bg === true && f.task === "T0003"), JSON.stringify(journal));
    // --task: that one, said plainly (no guess said); while it fetches, its mark says it
    const given = await w.ok(["fetch", "zkusebni", "5359", "--images", "5-12", "--recordset", "B1", "--background", "--task", "T1"]);
    const second = Number(/pid (\d+)/.exec(given.out)?.[1]);
    started.add(second);
    assert.match(given.out, /in the background — pid \d+, for T0001/);
    assert.doesNotMatch(given.out, /the one task this session worked on/);
    const active = (await status(w)).active.find((m) => m.pid === second);
    if (active) assert.equal(active.task, "T0001");
    await until("the second fetch ended", async () => !alive(second) && !!(await endedOf(w, second)));
    assert.equal(((await endedOf(w, second)) as { task?: string }).task, "T0001");
  } finally {
    w.cleanup();
    await a.close();
  }
});
