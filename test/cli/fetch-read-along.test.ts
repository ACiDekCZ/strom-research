// strom read of a book strom fetch is fetching (spec 001, U1): the fetch registers its images in batches as they come
// (FETCH_BATCH, one commit each) where it registered them all at its end, and leaves a mark beside the research that
// says what is coming; the read begins on the first batch and waits for the rest, and says exactly what it did not
// read when the fetch ended before. The archive is asked the same: as many requests, at the same pace.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { spawn, spawnSync } from "node:child_process";
import type { AddressInfo } from "node:net";
import { opts, pauses, scans } from "./connectors.helpers.ts";
import { World, fakeConnector, until } from "../helpers.ts";

const CLI = path.join(import.meta.dirname, "..", "..", "src", "cli.ts");

/**
 * An archive whose book has as many images as asked, each its own file — answered after `delay` ms; from image
 * `refuseFrom` on 403, image `sameAs[0]` the very file of image `sameAs[1]` (a placeholder). `hold(n, until)`: the
 * answers to image n and on wait until that file is there (a reader began, the test let them go) — where a test needs
 * the fetch still at work, never a guess that it is still slow enough; a hold not let go in two minutes answers all
 * the same (a test that waits in vain fails on what it checks, it never hangs).
 */
async function bookArchive(o: { delay?: number; refuseFrom?: number; sameAs?: [number, number] } = {}): Promise<{ base: string; hits: string[]; hold: (image: number, until: string) => void; close: () => Promise<void> }> {
  const scan = fs.readFileSync(path.join(scans, "s0001.jpg"));
  const hits: string[] = [];
  const holds: { image: number; until: string; open?: boolean }[] = [];
  const s = http.createServer((req, res) => {
    const u = new URL(req.url ?? "/", "http://x");
    hits.push(u.pathname);
    const img = /^\/img\/5359\/(\d+)\.jpg$/.exec(u.pathname);
    if (!img) return void res.writeHead(404).end();
    const since = Date.now();
    const answer = () => {
      const n = Number(img[1]);
      const h = holds.find((x) => !x.open && n >= x.image);
      if (h && !fs.existsSync(h.until) && Date.now() - since < 120_000) return void setTimeout(answer, 20);
      if (h) return void ((h.open = true), answer());
      if (o.refuseFrom !== undefined && n >= o.refuseFrom) return void res.writeHead(403).end("forbidden");
      const note = Buffer.from(`image ${o.sameAs && n === o.sameAs[0] ? o.sameAs[1] : n}`);
      const com = Buffer.from([0xff, 0xfe, 0, note.length + 2]);
      res.writeHead(200, { "content-type": "image/jpeg" }).end(Buffer.concat([scan.subarray(0, 2), com, note, scan.subarray(2)]));
    };
    setTimeout(answer, o.delay ?? 0);
  });
  await new Promise<void>((r) => s.listen(0, "127.0.0.1", r));
  s.unref();
  return { base: `http://127.0.0.1:${(s.address() as AddressInfo).port}`, hits, hold: (image, until) => void holds.push({ image, until }), close: () => new Promise<void>((r) => s.close(() => r())) };
}

/** A reader that notes when it starts and which images it got, then answers each with nothing found. */
function reader(w: World): { file: string; log: string; starts: () => { at: number; images: number[] }[] } {
  const file = path.join(w.dir, "reader.mjs");
  const log = path.join(w.dir, "readers.jsonl");
  fs.writeFileSync(
    file,
    `import fs from "node:fs";\n` +
      `const p = process.env.STROM_PROMPT ?? "";\nconst got = [...p.matchAll(/^- (M\\d{4}) · image (\\d+)/gm)];\n` +
      `fs.appendFileSync(${JSON.stringify(log)}, JSON.stringify({ at: Date.now(), images: got.map((m) => Number(m[2])) }) + "\\n");\n` +
      `await new Promise((r) => setTimeout(r, 200));\n` +
      `for (const m of got) console.log("## Image " + m[2] + " · " + m[1] + "\\nresult: nothing\\n");\n`,
  );
  return { file, log, starts: () => (fs.existsSync(log) ? fs.readFileSync(log, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []) };
}

async function setUp(archive: Awaited<ReturnType<typeof bookArchive>>): Promise<World> {
  const w = new World();
  await w.withTree();
  w.env.STROM_LANG = "en";
  await fakeConnector(w, "zkusebni", archive.base);
  await w.ok(["recordset", "add", "Týnec N 1784–1820", "--kinds", "baptism"]);
  return w;
}

const commits = (w: World) => Number(spawnSync("git", ["rev-list", "--count", "HEAD"], { cwd: w.cwd, encoding: "utf8" }).stdout.trim());
const marks = (w: World) => (fs.existsSync(path.join(w.cwd, ".strom", "fetch")) ? fs.readdirSync(path.join(w.cwd, ".strom", "fetch")).filter((f) => f.startsWith("active-")) : []);

/** Wait until the fetch left its mark (it began). */
async function begun(w: World): Promise<void> {
  await until("the fetch leaves its mark", () => marks(w).length > 0, { every: 25 });
}

test("fetch registers in batches of 10, one commit each: the same requests at the same pace; the mark gone at its end", opts, async () => {
  const a = await bookArchive();
  const w = await setUp(a);
  // a few images: one commit, as before
  let before = commits(w);
  pauses.length = 0;
  const few = await w.ok(["fetch", "zkusebni", "5359", "--images", "1-5", "--recordset", "B1"]);
  const fewHits = a.hits.splice(0);
  const fewPauses = pauses.splice(0);
  assert.equal(commits(w) - before, 1);
  assert.match(few.out, /^5 images of B0001 \(images 1–5\) fetched and registered/m);

  // 25 images: three batches (10, 10, the last 5 with the command's own commit)
  before = commits(w);
  const many = await w.ok(["fetch", "zkusebni", "5359", "--images", "6-30", "--recordset", "B1", "--json"]);
  assert.equal(commits(w) - before, 3, "a commit for each batch of 10 and one for the rest");
  assert.equal(many.json.added.length, 25);
  // the archive asked the same: each image once, nothing more than for a short fetch, a pause before each request as there
  const img = a.hits.filter((h) => h.startsWith("/img/"));
  assert.deepEqual(img, Array.from({ length: 25 }, (_, i) => `/img/5359/${i + 6}.jpg`));
  // (robots.txt is read once a day: by the first fetch)
  const other = (h: string[]) => h.filter((x) => !x.startsWith("/img/") && x !== "/robots.txt");
  assert.deepEqual(other(a.hits), other(fewHits), "the book's page asked as for a short fetch");
  assert.equal(fewPauses.length, 5);
  // a pause before each image, as before — but the pauses are not slept here, only the time a batch takes to register
  // is real: when registering and committing a batch outlasts the pace (a busy computer), the next request is due
  // already and rightly waits for nothing; so at most one pause fewer at each of the two batch boundaries
  assert.ok(pauses.length >= 23 && pauses.length <= 25, `a pause before each image: ${pauses.length}`);
  // the limiter counts from the last request: the time a batch took to register is part of the next pause, never
  // a request sooner than the archive's pace allows
  const pace = Math.max(...fewPauses);
  assert.ok(pace >= 1900 && pauses.every((ms) => ms >= 0 && ms <= pace + 50), `pauses ${pauses.join(", ")} (pace ${pace})`);
  assert.deepEqual(marks(w), [], "no mark left");
  // the history says it: each batch its own commit, the data whole
  const log = spawnSync("git", ["log", "--format=%s", "-4"], { cwd: w.cwd, encoding: "utf8" }).stdout;
  assert.deepEqual(log.trim().split("\n"), ["strom fetch: 5 changes", "strom fetch: 10 changes", "strom fetch: 10 changes", "strom fetch: 5 changes"]);
  await w.ok(["check"]);
  // all 30 registered, each once
  const list = (await w.ok(["media", "list", "--recordset", "B1", "--json"])).json;
  assert.equal(new Set(list.media.map((m: { image: number }) => m.image)).size, 30);
  w.cleanup();
  await a.close();
});

test("read of a book at fetch: begins on the first batch, waits for the rest, reads every image once", opts, async () => {
  const a = await bookArchive({ delay: 120 });
  const w = await setUp(a);
  const r = reader(w);
  w.env.STROM_RUNNER_SCRIPT = r.file;
  // the second batch answered once the first reader began: the fetch is at work then, however slow the read starts
  a.hold(11, r.log);
  const fetch = w.ok(["fetch", "zkusebni", "5359", "--images", "1-30", "--recordset", "B1"]).then((x) => ({ ...x, at: Date.now() }));
  await begun(w);
  // nothing registered yet: no error, the read waits for the images as they come
  const read = await w.ok(["read", "B1", "--images", "1-30", "--question", "Křty Nováků", "--agent", "script", "--batch", "10", "--no-index", "--json"]);
  const f = await fetch;
  const starts = r.starts();
  assert.ok(starts.length >= 3, JSON.stringify(starts));
  assert.ok(Math.min(...starts.map((s) => s.at)) < f.at, "the first reader began before the fetch ended");
  assert.deepEqual(starts.flatMap((s) => s.images).sort((x, y) => x - y), Array.from({ length: 30 }, (_, i) => i + 1), "every image read once");
  assert.equal(read.json.images, 30);
  assert.equal(read.json.notRead, undefined);
  assert.match(read.err, /images 1–30 of B0001 are being fetched now \(strom fetch at work\): read as they are registered/);
  // the archive asked as without the reading: each image once
  assert.equal(a.hits.filter((h) => h.startsWith("/img/")).length, 30);
  await w.ok(["check"]);
  w.cleanup();
  await a.close();
});

test("the fetch ends before the read's images came: what is not read said exactly, with the commands", opts, async () => {
  const a = await bookArchive({ delay: 120, refuseFrom: 16 });
  const w = await setUp(a);
  const r = reader(w);
  w.env.STROM_RUNNER_SCRIPT = r.file;
  // the second batch answered once the first reader began: the read meets the fetch at work, never one ended before
  a.hold(11, r.log);
  const fetch = w.run(["fetch", "zkusebni", "5359", "--images", "1-30", "--recordset", "B1"]);
  await begun(w);
  const read = await w.ok(["read", "B1", "--images", "1-30", "--question", "Křty Nováků", "--agent", "script", "--batch", "10", "--no-index"]);
  await fetch;
  assert.deepEqual(r.starts().flatMap((s) => s.images).sort((x, y) => x - y), Array.from({ length: 15 }, (_, i) => i + 1));
  assert.match(read.out, /^read 15 images/m);
  assert.match(read.out, /^NOT read: images 16–30 — the fetch ended before they came \(strom fetch zkusebni 5359 --images 16-30 --recordset B0001\); read them later: strom read B0001 --images 16-30 …; no negative of them$/m);
  // the search recorded covers only what was read
  assert.match(read.out, /--pages 1-15 /);
  // the fifteen fetched are registered and committed
  assert.equal((await w.ok(["media", "list", "--recordset", "B1", "--json"])).json.total, 15);
  await w.ok(["check"]);
  assert.equal(spawnSync("git", ["status", "--porcelain", "data"], { cwd: w.cwd, encoding: "utf8" }).stdout, "");
  w.cleanup();
  await a.close();
});

test("--until-found while the book is fetched: no reader after the find, the images not read said, the fetch goes on", opts, async () => {
  const a = await bookArchive({ delay: 120 });
  const w = await setUp(a);
  // a reader that finds image 3 (and notes which images it got)
  const file = path.join(w.dir, "reader-found.mjs");
  const log = path.join(w.dir, "found-readers.jsonl");
  fs.writeFileSync(
    file,
    `import fs from "node:fs";\nconst p = process.env.STROM_PROMPT ?? "";\nconst got = [...p.matchAll(/^- (M\\d{4}) · image (\\d+)/gm)];\n` +
      `fs.appendFileSync(${JSON.stringify(log)}, JSON.stringify(got.map((m) => Number(m[2]))) + "\\n");\n` +
      `const report = /Write your report to (.+?) AS YOU GO/.exec(p)[1];\n` +
      `for (const m of got) fs.appendFileSync(report, "## Image " + m[2] + " · " + m[1] + "\\nresult: " + (m[2] === "3" ? "found\\nentries: Jan Novák" : "nothing") + "\\n\\n");\n`,
  );
  w.env.STROM_RUNNER_SCRIPT = file;
  const fetch = w.ok(["fetch", "zkusebni", "5359", "--images", "1-30", "--recordset", "B1"]);
  await begun(w);
  const read = await w.ok(["read", "B1", "--images", "1-30", "--question", "The baptism of Jan Novák", "--agent", "script", "--batch", "10", "--parallel", "1", "--no-index", "--until-found", "--json"]);
  await fetch;
  const got = fs.readFileSync(log, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as number[]);
  assert.deepEqual(got, [Array.from({ length: 10 }, (_, i) => i + 1)], "one reader: the first batch, the find in it");
  assert.equal(read.json.images, 10);
  assert.deepEqual(read.json.stoppedAtFind, { batch: 1, notRead: Array.from({ length: 20 }, (_, i) => i + 11) });
  assert.deepEqual(read.json.notRead, Array.from({ length: 20 }, (_, i) => i + 11));
  // the fetch the agent started is its own: it brought all thirty, each asked once
  assert.equal((await w.ok(["media", "list", "--recordset", "B1", "--json"])).json.total, 30);
  assert.equal(a.hits.filter((h) => h.startsWith("/img/")).length, 30);
  const text = await w.ok(["readings", "--list"]);
  assert.match(text.out, /images 1–10/);
  await w.ok(["check"]);
  w.cleanup();
  await a.close();
});

/**
 * A reader that finds image 3 and reports only once the fetch of the book is where `after` says: ended (no mark),
 * or at least `registered` of its images registered — so the fetch registers more while it reads. It waits as long
 * as that takes (at most two minutes: a test that waits in vain fails on what it checks, it never hangs).
 */
function findingReader(w: World, after: { ended: true } | { registered: number }, began?: string): string {
  const file = path.join(w.dir, "reader-found-late.mjs");
  const marks = path.join(w.cwd, ".strom", "fetch");
  fs.writeFileSync(
    file,
    `import fs from "node:fs";\nimport path from "node:path";\nconst p = process.env.STROM_PROMPT ?? "";\nconst got = [...p.matchAll(/^- (M\\d{4}) · image (\\d+)/gm)];\n` +
      `const report = /Write your report to (.+?) AS YOU GO/.exec(p)[1];\n` +
      `const active = () => { try { return fs.readdirSync(${JSON.stringify(marks)}).filter((f) => f.startsWith("active-")).map((f) => { try { return JSON.parse(fs.readFileSync(path.join(${JSON.stringify(marks)}, f), "utf8")); } catch { return { registered: 0 }; } }); } catch { return []; } };\n` +
      (began ? `fs.writeFileSync(${JSON.stringify(began)}, "");\n` : "") +
      `const after = ${JSON.stringify(after)};\n` +
      `for (const by = Date.now() + 120000; Date.now() < by; ) { const a = active(); if (after.ended ? !a.length : a.some((m) => m.registered >= after.registered)) break; await new Promise((r) => setTimeout(r, 25)); }\n` +
      `for (const m of got) fs.appendFileSync(report, "## Image " + m[2] + " · " + m[1] + "\\nresult: " + (m[2] === "3" ? "found\\nentries: Jan Novák" : "nothing") + "\\n\\n");\n`,
  );
  return file;
}

test("--until-found behind a fetch that ended early: the images it registered meanwhile said as not read, never to fetch again", opts, async () => {
  const began = path.join(os.tmpdir(), `strom-reader-began-${process.pid}-${Date.now()}`);
  const a = await bookArchive({ delay: 50, refuseFrom: 16 });
  // images 11 and on wait until a reader began: no race with the reader's start
  a.hold(11, began);
  const w = await setUp(a);
  w.env.STROM_RUNNER_SCRIPT = findingReader(w, { ended: true }, began);
  const fetch = w.run(["fetch", "zkusebni", "5359", "--images", "1-30", "--recordset", "B1"]);
  await begun(w);
  const read = await w.ok(["read", "B1", "--images", "1-30", "--question", "The baptism of Jan Novák", "--agent", "script", "--batch", "10", "--parallel", "1", "--no-index", "--until-found"]);
  await fetch;
  // 11–15 came while the first reader read: here, not read — only 16–30 are for the fetch again
  assert.match(read.out, /^NOT read: images 11–30 — a reader found it, no more began \(--until-found\); 11–15 registered, not read; the fetch ended before 16–30 came \(strom fetch zkusebni 5359 --images 16-30 --recordset B0001\); read them if the find proves not to be the one: strom read B0001 --images 11-30 …; no negative of them$/m);
  assert.match(read.out, /--pages 1-10 --method page-by-page --by reader --result partial/);
  assert.equal((await w.ok(["media", "list", "--recordset", "B1", "--json"])).json.total, 15);
  fs.rmSync(began, { force: true });
  w.cleanup();
  await a.close();
});

test("--until-found behind a fetch still at work: the images registered meanwhile not said as still being fetched", opts, async () => {
  const a = await bookArchive({ delay: 300 });
  const w = await setUp(a);
  w.env.STROM_RUNNER_SCRIPT = findingReader(w, { registered: 20 });
  // images 21 and on wait until the read ended: the fetch is still at work then, however slow the read
  const go = path.join(w.dir, "go");
  a.hold(21, go);
  const fetch = w.run(["fetch", "zkusebni", "5359", "--images", "1-30", "--recordset", "B1"]);
  await begun(w);
  const read = await w.ok(["read", "B1", "--images", "1-30", "--question", "The baptism of Jan Novák", "--agent", "script", "--batch", "10", "--parallel", "1", "--no-index", "--until-found"]);
  fs.writeFileSync(go, "");
  await fetch;
  // 11–20 registered when the read ended: not among those still coming
  assert.match(read.out, /^NOT read: images 11–30 — a reader found it, no more began \(--until-found\); 11–20 registered, not read; 21–30 still being fetched \(strom fetch --status\); read them if the find/m);
  assert.doesNotMatch(read.out, /the fetch ended before/);
  w.cleanup();
  await a.close();
});

test("read of an image at fetch, by its number: said it comes, the way to wait for it", opts, async () => {
  const a = await bookArchive({ delay: 150 });
  const w = await setUp(a);
  // image 12 waits until the read asked for it: still being fetched then, however slow the read
  const go = path.join(w.dir, "go");
  a.hold(12, go);
  const fetch = w.run(["fetch", "zkusebni", "5359", "--images", "1-12", "--recordset", "B1"]);
  await begun(w);
  const one = await w.run(["read", "B1:12", "--question", "Křty", "--agent", "script"]);
  fs.writeFileSync(go, "");
  assert.equal(one.code, 2);
  assert.match(one.err, /image 12 of B0001 is being fetched now \(strom fetch at work\), not registered yet/);
  assert.match(one.err, /strom read B0001 --images 12-12 … waits for it/);
  await fetch;
  w.cleanup();
  await a.close();
});

test("a placeholder found past a batch: the image an earlier batch registered withdrawn again", opts, async () => {
  // image 11 is the very file of image 10: neither is a scan — 10 came in the first batch
  const a = await bookArchive({ sameAs: [11, 10] });
  const w = await setUp(a);
  const r = await w.run(["fetch", "zkusebni", "5359", "--images", "1-14", "--recordset", "B1"]);
  const dir = path.join(w.cwd, "data", "images");
  const list = fs.readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) as { image: number; retracted?: unknown });
  const live = list.filter((m) => !m.retracted).map((m) => m.image).sort((x, y) => x - y);
  assert.deepEqual(live, [1, 2, 3, 4, 5, 6, 7, 8, 9], `${r.out}${r.err}`);
  assert.match(r.out, /^withdrawn again \(the portal gave the same file for a later image — a placeholder, not a scan\): M\d{4}$/m, r.out);
  // what it says it fetched leaves out the image withdrawn: nine images, not ten
  assert.match(r.out, /^9 images of B0001 \(images 1–9\) fetched and registered/m, r.out);
  await w.ok(["check"]);
  w.cleanup();
  await a.close();
});

test("Ctrl-C of a fetch: what came registered and committed, the rest said, nothing half written", { ...opts, skip: opts.skip || process.platform === "win32" }, async () => {
  const a = await bookArchive();
  const w = await setUp(a);
  // the person's pace for the test's archive: a request every half second (a human's decision, in the test's settings)
  await w.ok(["allow", "host", "127.0.0.1", "--pace", "0.5"], { tty: true, answers: ["y"] });
  const child = spawn(process.execPath, [CLI, "fetch", "zkusebni", "5359", "--images", "1-30", "--recordset", "B1"], { cwd: w.cwd, env: w.env, stdio: ["ignore", "pipe", "pipe"] });
  let out = "";
  let err = "";
  child.stdout.on("data", (d) => (out += d));
  child.stderr.on("data", (d) => (err += d));
  const exited = new Promise<number>((r) => child.on("close", (code) => r(code ?? -1)));
  // the 14th image asked: the 13th taken in (the connector asks for the next one after it said the last)
  await until("the 14th image asked", () => a.hits.filter((h) => h.startsWith("/img/")).length >= 14, { every: 25, state: () => out + err });
  child.kill("SIGINT");
  const code = await exited;
  assert.equal(code, 130, `${out}${err}`);
  const asked = a.hits.filter((h) => h.startsWith("/img/")).length;
  assert.ok(asked < 30, "the connector stopped");
  const list = (await w.ok(["media", "list", "--recordset", "B1", "--json"])).json.media as { image: number }[];
  assert.ok(list.length >= 12 && list.length <= asked, `registered ${list.length} of ${asked} asked`);
  assert.match(out, new RegExp(`interrupted: images ${list.length + 1}–30 not fetched — the same command fetches them`), out);
  assert.equal(spawnSync("git", ["status", "--porcelain", "data"], { cwd: w.cwd, encoding: "utf8" }).stdout, "", "all committed");
  assert.deepEqual(marks(w), []);
  await w.ok(["check"]);
  // the same command again: only what is not here asked for
  a.hits.length = 0;
  await w.ok(["fetch", "zkusebni", "5359", "--images", "1-30", "--recordset", "B1"]);
  assert.equal(a.hits.filter((h) => h.startsWith("/img/")).length, 30 - list.length);
  w.cleanup();
  await a.close();
});

test("Ctrl-C while git commits a batch: stopped as interrupted, the batch committed all the same", { ...opts, skip: opts.skip || process.platform === "win32" }, async () => {
  const a = await bookArchive();
  const w = await setUp(a);
  // a git that, adding the first batch, says so and takes its time: the person's Ctrl-C reaches it (one group)
  const real = spawnSync("sh", ["-c", "command -v git"], { encoding: "utf8" }).stdout.trim();
  await w.ok(["allow", "host", "127.0.0.1", "--pace", "0.5"], { tty: true, answers: ["y"] });
  const flag = path.join(w.dir, "in-add");
  const wrapper = path.join(w.dir, "git-slow.sh");
  // its add of the first batch waits until the test pressed Ctrl-C (at most a minute): it lands while it commits,
  // however slow the computer
  fs.writeFileSync(wrapper, `#!/bin/sh\nif [ "$1" = "add" ] && [ ! -e "${flag}.done" ]; then touch "${flag}" "${flag}.done"; i=0; while [ ! -e "${flag}.go" ] && [ $i -lt 600 ]; do sleep 0.1; i=$((i+1)); done; fi\nexec "${real}" "$@"\n`, { mode: 0o755 });
  const child = spawn(process.execPath, [CLI, "fetch", "zkusebni", "5359", "--images", "1-14", "--recordset", "B1"], { cwd: w.cwd, env: { ...w.env, STROM_GIT: wrapper }, stdio: ["ignore", "pipe", "pipe"], detached: true });
  let out = "";
  let err = "";
  child.stdout.on("data", (d) => (out += d));
  child.stderr.on("data", (d) => (err += d));
  const exited = new Promise<number>((r) => child.on("close", (code) => r(code ?? -1)));
  await until("git add of the first batch began", () => fs.existsSync(flag), { every: 25, state: () => out + err });
  process.kill(-child.pid!, "SIGINT");
  fs.writeFileSync(`${flag}.go`, "");
  const code = await exited;
  assert.equal(code, 130, `${out}${err}`);
  assert.doesNotMatch(out + err, /failed/, out + err);
  assert.match(out, /stopped: interrupted/, out);
  assert.equal(spawnSync("git", ["status", "--porcelain", "data"], { cwd: w.cwd, encoding: "utf8" }).stdout, "", "all committed");
  const list = (await w.ok(["media", "list", "--recordset", "B1", "--json"])).json.media as { image: number }[];
  assert.ok(list.length >= 10, `the first batch registered: ${list.length}`);
  await w.ok(["check"]);
  w.cleanup();
  await a.close();
});
