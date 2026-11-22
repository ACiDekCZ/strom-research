// A restricted archive's hold (spec 127 K2), with real processes: two researches of one person share their archives
// (one shared folder). On an archive whose connector has an hourly cap one session at a time works: the other research's
// session starts on other work, a run with only such tasks left waits for the archive (paused: archive) and stops with
// "archive" when it stays held, a run waiting gets it once its holder ends; two strom fetch of images from such an archive
// go one after the other (the second queued behind the first). Only a local test server, no real archive.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { spawn, type ChildProcess } from "node:child_process";
import type { AddressInfo } from "node:net";
import { World, fakeConnector, hasGit, readJsonFile, until } from "../helpers.ts";
import { scans } from "./connectors.helpers.ts";

const CLI = path.join(import.meta.dirname, "..", "..", "src", "cli.ts");
const AGENT = path.join(import.meta.dirname, "..", "fixtures", "agent.ts");
const A = { CLAUDECODE: "1", CLAUDE_CODE_SESSION_ID: "lhotak-a" };
const B = { CLAUDECODE: "1", CLAUDE_CODE_SESSION_ID: "lhotka-b" };
/** An hourly cap of the archive's service: its site is restricted whatever its terms. */
const CAPPED = { automation: "allowed", pace: { minIntervalMs: 2000, perHour: 120, source: "test" } };
const SITE = "127.0.0.1";

interface Proc {
  child: ChildProcess;
  out: () => string;
  done: Promise<{ code: number; out: string; err: string }>;
}

function start(w: World, args: string[], env: Record<string, string> = {}, cwd = w.cwd): Proc {
  const child = spawn(process.execPath, [CLI, ...args], { cwd, env: { ...w.env, ...env }, stdio: ["ignore", "pipe", "pipe"] });
  let out = "";
  let err = "";
  child.stdout!.on("data", (d) => (out += d));
  child.stderr!.on("data", (d) => (err += d));
  const done = new Promise<{ code: number; out: string; err: string }>((resolve) => child.on("close", (code) => resolve({ code: code ?? 1, out, err })));
  return { child, out: () => out + err, done };
}

function endAll(procs: Proc[]): void {
  for (const p of procs) if (p.child.exitCode === null) p.child.kill("SIGKILL");
}

const holdsDir = (w: World) => path.join(w.home, "shared", "net", "holds");
const siteHold = (w: World) => (fs.existsSync(path.join(holdsDir(w), `${SITE}.json`)) ? readJsonFile(path.join(holdsDir(w), `${SITE}.json`)) : undefined);

/**
 * Two researches of one person, Lhoták and Lhotka, each with a record set on the test's archive (a connector with an
 * hourly cap) and a task on it; Lhotka with a task of no archive too.
 */
async function twoResearches(w: World, base: string, other = true): Promise<{ a: string; b: string }> {
  const a = await w.withTree("Lhoták");
  await w.ok(["init", "Lhotka"]);
  const b = w.treeDir("Lhotka");
  await fakeConnector(w, "lhota", base, CAPPED);
  for (const cwd of [a, b]) {
    for (const t of (await w.ok(["task", "list", "--state", "all", "--json"], { cwd })).json.tasks as { id: string }[]) await w.ok(["task", "drop", t.id, "--reason", "test"], { cwd });
    await w.ok(["recordset", "add", "Lhota N 1784–1820", "--kinds", "baptism", "--url", `${base}/kniha/5359`], { cwd });
    await w.ok(["task", "add", "Křest Jana Lhotáka (~1790)", "--level", "locate", "--where", "B0001", "--why", "rodiče", "--done-when", "zápis", "--priority", "5"], { cwd });
  }
  if (other) await w.ok(["task", "add", "Pohřeb Marie Lhotkové", "--level", "locate", "--where", "matrika Lhotka", "--why", "úmrtí", "--done-when", "zápis", "--priority", "1"], { cwd: b });
  w.cwd = a;
  return { a, b };
}

/** The first task of a research, by its what. */
async function taskOf(w: World, cwd: string, what: RegExp): Promise<string> {
  const tasks = (await w.ok(["task", "list", "--json"], { cwd })).json.tasks as { id: string; what: string }[];
  return tasks.find((t) => what.test(t.what))!.id;
}

test("another research's session on the archive: a session start leaves its task for now and takes other work; asked for by its ID, refused with who holds it and until when", { skip: !hasGit, timeout: 240_000 }, async () => {
  const w = new World();
  try {
    const { a, b } = await twoResearches(w, "http://127.0.0.1:9");
    const onSite = await taskOf(w, a, /^Křest/u);
    const s = (await w.ok(["session", "start", onSite, "--json"], { env: A, cwd: a })).json.session;
    const hold = siteHold(w);
    assert.deepEqual([hold.site, hold.tree, hold.session, hold.task, hold.by], [SITE, fs.realpathSync(a) === a ? a : hold.tree, s.id, onSite, "agent"]);

    // Lhotka: its task on the archive left for now, the other one taken
    const theirs = await taskOf(w, b, /^Křest/u);
    const other = await taskOf(w, b, /^Pohřeb/u);
    const r = await w.ok(["session", "start", "--json"], { env: B, cwd: b });
    assert.equal(r.json.session.task, other);
    assert.deepEqual(r.json.archiveHeld.map((k: { task: string; site: string }) => [k.task, k.site]), [[theirs, SITE]]);
    const said = await w.ok(["session", "start"], { env: { ...B, CLAUDE_CODE_SESSION_ID: "lhotka-c" }, cwd: b });
    assert.match(said.out, new RegExp(`${theirs} left for now: 127\\.0\\.0\\.1 restricts automated access and an agent of another research \\(Lhoták\\) uses it \\(since (?:\\d{4}-\\d\\d-\\d\\d )?\\d\\d:\\d\\d, last request (?:\\d{4}-\\d\\d-\\d\\d )?\\d\\d:\\d\\d, free by (?:\\d{4}-\\d\\d-\\d\\d )?\\d\\d:\\d\\d at the latest\\)`, "u"), said.out);

    // asked for by its ID: refused (K2.5), for an agent in English with another task offered
    const asked = await w.run(["session", "start", theirs], { env: { ...B, CLAUDE_CODE_SESSION_ID: "lhotka-d" }, cwd: b });
    assert.notEqual(asked.code, 0);
    assert.match(asked.err, new RegExp(`${theirs} needs 127\\.0\\.0\\.1, an archive that restricts automated access, and an agent of another research \\(Lhoták\\) uses it now \\(since (?:\\d{4}-\\d\\d-\\d\\d )?\\d\\d:\\d\\d, last request (?:\\d{4}-\\d\\d-\\d\\d )?\\d\\d:\\d\\d, free by (?:\\d{4}-\\d\\d-\\d\\d )?\\d\\d:\\d\\d at the latest\\) — one session at a time on it\\n→ take another task: strom task next`, "u"), asked.err);
    const json = await w.run(["session", "start", theirs, "--json"], { env: { ...B, CLAUDE_CODE_SESSION_ID: "lhotka-d" }, cwd: b });
    { const e = JSON.parse(json.out || json.err); assert.equal(e.code ?? e.error?.code, "archive.held", json.out + json.err); }

    // its holder's session closed: the archive let go, the other research takes it with its task
    await w.ok(["session", "close", "--summary", "hotovo", "--next", "nic", "--continue"], { env: A, cwd: a });
    assert.equal(siteHold(w), undefined);
    const took = await w.ok(["session", "start", theirs, "--json"], { env: { ...B, CLAUDE_CODE_SESSION_ID: "lhotka-d" }, cwd: b });
    assert.equal(siteHold(w).session, took.json.session.id);
    assert.equal(siteHold(w).tree, fs.realpathSync(b) === b ? b : siteHold(w).tree);
  } finally {
    w.cleanup();
  }
});

test("a run with only the archive's tasks left waits for it (paused: archive) and stops with archive when it stays held; once its holder ends, the run waiting gets it", { skip: !hasGit, timeout: 240_000 }, async () => {
  const w = new World();
  const procs: Proc[] = [];
  try {
    const { a, b } = await twoResearches(w, "http://127.0.0.1:9", false);
    const onSite = await taskOf(w, a, /^Křest/u);
    await w.ok(["session", "start", onSite], { env: A, cwd: a });
    const theirs = await taskOf(w, b, /^Křest/u);

    // 1. it stays held: the run waits, then stops (its wait made older than archive.wait — the setting is never shortened)
    const run = start(w, ["run", "--agent", "script", "--max", "1", "--json"], { STROM_RUNNER_SCRIPT: AGENT, AGENT_MODE: "done" }, b);
    procs.push(run);
    const workers = path.join(b, ".strom", "workers");
    const paused = () => (fs.existsSync(workers) ? fs.readdirSync(workers).filter((f) => f.endsWith(".paused")).map((f) => readJsonFile(path.join(workers, f))) : []);
    await until("the run waits for the archive", () => paused().length > 0, { state: run.out });
    assert.equal(paused()[0].archive, SITE);
    assert.match(paused()[0].reason, /čeká na archiv 127\.0\.0\.1/u);
    const queue = path.join(holdsDir(w), `${SITE}.wait`);
    const entries = fs.readdirSync(queue);
    assert.equal(entries.length, 1, "in the archive's queue");
    const entry = path.join(queue, entries[0]!);
    fs.writeFileSync(entry, JSON.stringify({ ...readJsonFile(entry), since: new Date(Date.now() - 31 * 60_000).toISOString() }));
    const stopped = await run.done;
    assert.equal(stopped.code, 0, stopped.err + stopped.out);
    const data = JSON.parse(stopped.out);
    assert.equal(data.stop, "archive");
    assert.deepEqual(data.sessions, []);
    assert.match(data.stopped, /zbylé úkoly potřebují archiv 127\.0\.0\.1/u);
    assert.deepEqual(fs.readdirSync(queue), [], "out of the queue");
    assert.deepEqual(paused(), []);

    // 2. a run waits again; the holder ends its session: the run waiting gets the archive and works the task
    const again = start(w, ["run", "--agent", "script", "--max", "1", "--json"], { STROM_RUNNER_SCRIPT: AGENT, AGENT_MODE: "done" }, b);
    procs.push(again);
    await until("the run waits for the archive", () => paused().length > 0, { state: again.out });
    await w.ok(["session", "close", "--summary", "hotovo", "--next", "nic", "--continue"], { env: A, cwd: a });
    const worked = await again.done;
    assert.equal(worked.code, 0, worked.err + worked.out);
    const sessions = JSON.parse(worked.out).sessions as { task: string }[];
    assert.deepEqual(sessions.map((s) => s.task), [theirs]);
    // the holder that ended cannot take it back while the run waited (it went to the one waiting); now let go again
    assert.equal(siteHold(w), undefined, "let go with the run's session");
    assert.deepEqual(fs.readdirSync(queue), []);
  } finally {
    endAll(procs);
    w.cleanup();
  }
});

/** The test's archive: a book whose images are answered once the file `release` is there (the first fetch still at work). */
async function archive(release: string): Promise<{ base: string; hits: { path: string; at: number }[]; close: () => Promise<void> }> {
  const scan = fs.readFileSync(path.join(scans, "s0001.jpg"));
  const hits: { path: string; at: number }[] = [];
  const s = http.createServer((req, res) => {
    const u = new URL(req.url ?? "/", "http://x");
    hits.push({ path: u.pathname, at: Date.now() });
    const img = /^\/img\/5359\/(\d+)\.jpg$/.exec(u.pathname);
    if (!img) return void res.writeHead(404).end();
    const since = Date.now();
    const answer = () => {
      if (!fs.existsSync(release) && Date.now() - since < 120_000) return void setTimeout(answer, 20);
      const note = Buffer.from(`image ${img[1]}`);
      const com = Buffer.from([0xff, 0xfe, 0, note.length + 2]);
      res.writeHead(200, { "content-type": "image/jpeg" }).end(Buffer.concat([scan.subarray(0, 2), com, note, scan.subarray(2)]));
    };
    answer();
  });
  await new Promise<void>((r) => s.listen(0, "127.0.0.1", r));
  s.unref();
  return { base: `http://127.0.0.1:${(s.address() as AddressInfo).port}`, hits, close: () => new Promise<void>((r) => s.close(() => r())) };
}

test("two strom fetch of images from a restricted archive, of two researches: the second queued behind the first, then on", { skip: !hasGit || process.platform === "win32", timeout: 240_000 }, async () => {
  const w = new World();
  const procs: Proc[] = [];
  const release = path.join(os.tmpdir(), `strom-archive-holds-${process.pid}-${Date.now()}`);
  const arch = await archive(release);
  try {
    w.env.STROM_LANG = "en";
    const { a, b } = await twoResearches(w, arch.base, false);
    const first = start(w, ["fetch", "lhota", "5359", "--images", "1-2", "--recordset", "B1"], {}, a);
    procs.push(first);
    await until("the first fetch asks the archive", () => arch.hits.some((h) => h.path.startsWith("/img/")), { state: first.out });
    const bulk = readJsonFile(path.join(holdsDir(w), "bulk.json"));
    assert.deepEqual([bulk.by, bulk.pid], ["fetch", first.child.pid]);
    assert.equal(siteHold(w).pid, first.child.pid);

    const second = start(w, ["fetch", "lhota", "5359", "--images", "1-2", "--recordset", "B1"], {}, b);
    procs.push(second);
    await until("the second queued", () => /queued behind strom fetch of another research \(Lhoták\)/u.test(second.out()), { state: second.out });
    assert.equal(fs.readdirSync(path.join(holdsDir(w), "bulk.wait")).length, 1);
    const asked = arch.hits.filter((h) => h.path.startsWith("/img/")).length;

    fs.writeFileSync(release, "");
    const one = await first.done;
    assert.equal(one.code, 0, one.out + one.err);
    const ended = Date.now();
    const two = await second.done;
    assert.equal(two.code, 0, two.out + two.err);
    // the second asked nothing while it waited, its images after the first had all of its own
    const late = arch.hits.filter((h) => h.path.startsWith("/img/")).slice(asked);
    assert.equal(late.length, 3, JSON.stringify(arch.hits));
    assert.ok(late.slice(1).every((h) => h.at <= ended + 60_000));
    for (const cwd of [a, b]) assert.equal(((await w.ok(["media", "list", "--recordset", "B1", "--json"], { cwd })).json.media as unknown[]).length, 2);
    // all let go
    assert.equal(siteHold(w), undefined);
    assert.equal(fs.existsSync(path.join(holdsDir(w), "bulk.json")), false);
    assert.deepEqual(fs.readdirSync(path.join(holdsDir(w), "bulk.wait")), []);
  } finally {
    endAll(procs);
    fs.rmSync(release, { force: true });
    w.cleanup();
    await arch.close();
  }
});
