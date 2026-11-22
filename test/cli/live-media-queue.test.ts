// Originals the app sends with Prefer: respond-async: checked as they come and answered at once (202), queued
// (.strom/media-queue, their bytes in the shared store's .incoming) and written by the bridge's writer — those of no
// batch a moment later, a batch's with its close in one commit (one change, one tree for the app); the queue outlives the
// bridge; POST /media/known says what the research has of many files at once; the warm writer runs the writes in one
// process that lives on between them, a strom of its own for each after it failed; strom media queued takes the queue in
// parts with the lock free between them.

import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { World, hasGit, until } from "../helpers.ts";
import { enqueue, listJobs, queueTag } from "../../src/core/mediaqueue.ts";

const opts = { skip: !hasGit || process.platform === "win32" };
const app = { Origin: "https://beta.stromapp.info" };
const later = { ...app, Prefer: "respond-async" };
const fixtures = path.join(import.meta.dirname, "..", "fixtures", "images");
const sha = (b: Buffer) => crypto.createHash("sha256").update(b).digest("hex");
const jpg = fs.readFileSync(path.join(fixtures, "base420.jpg"));
/** A JPEG of its own content: bytes after its end the decoders leave alone. */
const jpgNo = (n: number) => Buffer.concat([jpg, Buffer.from(`#${n}`)]);

function request(method: string, url: string, body?: Buffer, headers: Record<string, string> = {}): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method, headers: { ...(body ? { "Content-Length": String(body.length) } : {}), ...headers } }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (d: Buffer) => chunks.push(d));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    req.on("error", reject);
    req.end(body);
  });
}
const json = (r: { body: Buffer }) => JSON.parse(r.body.toString("utf8"));
const commits = (root: string) => Number(spawnSync("git", ["rev-list", "--count", "HEAD"], { cwd: root, encoding: "utf8" }).stdout.trim());
const liveLog = (root: string) => {
  try {
    return fs.readFileSync(path.join(root, ".strom", "live.log"), "utf8");
  } catch {
    return "";
  }
};
const writerPids = (root: string) => [...liveLog(root).matchAll(/the writer started \(pid (\d+)\)/g)].map((m) => Number(m[1]));
const alive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};
/** How long this computer takes to start Node (the most of three): the unit of a budget of time (as channel-switch). */
function nodeStartMs(): number {
  let most = 0;
  for (let i = 0; i < 3; i++) {
    const t = Date.now();
    spawnSync(process.execPath, ["-e", ""], { stdio: "ignore" });
    most = Math.max(most, Date.now() - t);
  }
  return most;
}

test("Prefer: respond-async — 202 at once, the kind and the end checked at once, GET and POST /media/known say it is queued, written a moment later; without it as before; a batch of 17 written with its close in one commit, no change before, files saying what became of each (the same file twice one input, one the research had known), names in any script as they came (NFC)", opts, async () => {
  const w = new World();
  await w.withTree();
  await w.ok(["person", "add", "Josef /Lhoták/", "--sex", "M"]); // P1
  w.env.STROM_LIVE_POLL_MS = "100";
  // the files of no batch written 1.5 s after they came (time to ask in between), a batch's only at its close
  w.env.STROM_MEDIA_QUEUE_MS = "1500";
  w.env.STROM_MEDIA_BATCH_QUIET_MS = "600000";
  const root = w.cwd;
  const info = (await w.ok(["live", "start", "--json"])).json;
  try {
    // without Prefer: written before the answer, as before
    const first = jpgNo(1);
    const now = await request("PUT", `${info.url}/media/${sha(first)}`, first, { ...app, "X-Strom-Person": "P0001", "X-Strom-Name": encodeURIComponent("dopis.jpg") });
    assert.equal(now.status, 200, now.body.toString());
    assert.match(json(now).input, /^I\d{4}$/);
    assert.equal(now.headers["preference-applied"], undefined);

    // with it: 202 at once, nothing written yet
    const before = commits(root);
    const second = jpgNo(2);
    const q = await request("PUT", `${info.url}/media/${sha(second)}`, second, { ...later, "X-Strom-Person": "P0001", "X-Strom-Name": encodeURIComponent("Žádost.jpg") });
    assert.equal(q.status, 202, q.body.toString());
    assert.equal(q.headers["preference-applied"], "respond-async");
    assert.deepEqual(json(q), { sha: sha(second), bytes: second.length, queued: true });
    assert.equal(listJobs(root).length, 1);
    const g = await request("GET", `${info.url}/media/${sha(second)}`);
    assert.equal(g.status, 404);
    assert.deepEqual(json(g), { known: null, queued: true });
    const unknown = "ab".repeat(32);
    const k = await request("POST", `${info.url}/media/known`, Buffer.from(JSON.stringify({ shas: [sha(first), sha(second).toUpperCase(), unknown] })), { ...app, "Content-Type": "application/json" });
    assert.equal(k.status, 200, k.body.toString());
    const known = json(k).known;
    assert.equal(known[sha(first)].id, json(now).input);
    assert.deepEqual(Object.keys(known[sha(first)]).sort(), ["bytes", "here", "id", "kind", "mime"]);
    assert.equal(known[sha(first)].here, true);
    assert.deepEqual(known[sha(second)], { queued: true });
    assert.equal(known[unknown], null);
    // too many, not a list of hashes
    const many = await request("POST", `${info.url}/media/known`, Buffer.from(JSON.stringify({ shas: Array.from({ length: 5001 }, (_, i) => sha(Buffer.from(String(i)))) })), app);
    assert.equal(many.status, 413);
    assert.equal(json(many).code, "media.known-many");
    assert.equal(json(await request("POST", `${info.url}/media/known`, Buffer.from(JSON.stringify({ shas: ["x"] })), app)).code, "media.known-body");
    // a kind it does not take and a JPEG cut short: said at once, nothing queued
    const exe = Buffer.concat([Buffer.from("MZ"), Buffer.alloc(500)]);
    const bad = await request("PUT", `${info.url}/media/${sha(exe)}`, exe, { ...later, "X-Strom-Person": "P0001", "X-Strom-Name": "setup.exe" });
    assert.equal(bad.status, 415, bad.body.toString());
    assert.equal(json(bad).code, "media.type");
    const cut = jpg.subarray(0, jpg.length - 600);
    const short = await request("PUT", `${info.url}/media/${sha(cut)}`, cut, { ...later, "X-Strom-Person": "P0001", "X-Strom-Name": "cut.jpg" });
    assert.equal(short.status, 422);
    assert.equal(json(short).code, "media.cut-short");
    assert.equal(listJobs(root).length, 1, "only the file taken waits");
    assert.equal(commits(root), before, "nothing written while it waits");
    // written a moment later (its commit made once its strom said so)
    await until("the queued file written", () => /1 queued file\(s\) written/.test(liveLog(root)), { ms: 60_000 });
    assert.equal(commits(root), before + 1);
    assert.equal(listJobs(root).length, 0);
    const taken = json(await request("GET", `${info.url}/media/${sha(second)}`));
    const input = (await w.ok(["input", "show", taken.known, "--json"])).json.input;
    assert.equal(input.name, "Žádost.jpg");
    assert.deepEqual(input.persons, ["P0001"]);

    // a batch of 17: one commit with its close, nothing before it
    const batch = "7c1d2e3f-4a5b-4c6d-8e9f-a0b1c2d3e4f5";
    const at = commits(root);
    const put = (b: Buffer, p: string) => request("PUT", `${info.url}/media/${sha(b)}`, b, { ...later, "X-Strom-Batch": batch, "X-Strom-Path": encodeURIComponent(p), "X-Strom-Name": encodeURIComponent(path.basename(p)) });
    const sent: { sha: string; path: string }[] = [];
    // a path in decomposed form (NFD) and in Cyrillic: as it came, in NFC
    const paths = Array.from({ length: 14 }, (_, i) => (i === 0 ? "Babička/Dopisy/1946.jpg" : i === 1 ? "Фото/Иван.jpg" : `Krabice/${String(i).padStart(2, "0")}.jpg`));
    for (const [i, p] of paths.entries()) {
      const b = jpgNo(100 + i);
      const r = await put(b, p);
      assert.equal(r.status, 202, r.body.toString());
      sent.push({ sha: sha(b), path: p.normalize("NFC") });
    }
    // the same file at the same path again: one job
    assert.equal((await put(jpgNo(105), paths[5]!)).status, 202);
    // the same content at another path: known as the batch is written
    assert.equal((await put(jpgNo(106), "Jinde/06.jpg")).status, 202);
    // a file the research has: said at once
    const had = await put(first, "Krabice/dopis.jpg");
    assert.equal(had.status, 200);
    assert.equal(json(had).known, json(now).input);
    assert.equal(listJobs(root).filter((j) => j.job.batch === batch).length, 15);
    await new Promise((r) => setTimeout(r, 500));
    assert.equal(commits(root), at, "nothing of the batch written before its close: no change");
    const done = await request("POST", `${info.url}/batch/${batch}/done`, Buffer.from(JSON.stringify({ name: "Krabice", files: 17 })), app);
    assert.equal(done.status, 200, done.body.toString());
    const d = json(done);
    assert.equal(commits(root), at + 1, "its files and its close: one commit");
    assert.equal(d.inputs, 14);
    assert.equal(d.files.length, 16, JSON.stringify(d.files));
    for (const s of sent) {
      const f = d.files.find((x: { sha: string; path?: string }) => x.sha === s.sha && x.path === s.path);
      assert.ok(f?.input, `${s.path}: ${JSON.stringify(d.files)}`);
    }
    const again = d.files.find((x: { path?: string }) => x.path === "Jinde/06.jpg");
    assert.equal(again.known, d.files.find((x: { sha: string; input?: string }) => x.sha === sha(jpgNo(106)) && x.input).input);
    assert.equal(d.files.find((x: { path?: string }) => x.path === "Krabice/dopis.jpg").known, json(now).input);
    assert.equal(typeof d.head, "string");
    const babicka = d.files.find((x: { path?: string }) => x.path === "Babička/Dopisy/1946.jpg");
    assert.equal((await w.ok(["input", "show", babicka.input, "--json"])).json.input.path, "Babička/Dopisy/1946.jpg");
    const ivan = d.files.find((x: { path?: string }) => x.path === "Фото/Иван.jpg");
    assert.equal((await w.ok(["input", "show", ivan.input, "--json"])).json.input.name, "Иван.jpg");
    assert.equal(listJobs(root).length, 0);
    assert.deepEqual(fs.readdirSync(path.join(w.home, "shared", "media", ".incoming")).filter((n) => n.endsWith(".queued")), [], "no bytes left behind");
  } finally {
    await w.ok(["live", "stop"]);
  }
  w.cleanup();
});

test("the queue outlives its bridge: a file queued and the bridge ended before it was written is written by the next one", opts, async () => {
  const w = new World();
  await w.withTree();
  await w.ok(["person", "add", "Josef /Lhoták/", "--sex", "M"]);
  w.env.STROM_LIVE_POLL_MS = "100";
  w.env.STROM_MEDIA_QUEUE_MS = "600000";
  const root = w.cwd;
  const file = jpgNo(7);
  let info = (await w.ok(["live", "start", "--json"])).json;
  try {
    const q = await request("PUT", `${info.url}/media/${sha(file)}`, file, { ...later, "X-Strom-Person": "P0001", "X-Strom-Name": "x.jpg" });
    assert.equal(q.status, 202);
  } finally {
    await w.ok(["live", "stop"]);
  }
  assert.equal(listJobs(root).length, 1, "the job kept");
  w.env.STROM_MEDIA_QUEUE_MS = "100";
  info = (await w.ok(["live", "start", "--json"])).json;
  try {
    try {
      await until("written by the next bridge", async () => {
        try {
          return (await request("GET", `${info.url}/media/${sha(file)}`)).status === 200;
        } catch {
          // (a connection reset as the bridge comes up again at the same port: asked again)
          return false;
        }
      }, { ms: 20_000 });
    } catch (e) {
      throw new Error(`${(e as Error).message}\n${liveLog(root)}`);
    }
    assert.match(liveLog(root), /1 queued file\(s\) taken over/);
  } finally {
    await w.ok(["live", "stop"]);
  }
  w.cleanup();
});

test("a batch's close that failed (a queued file another program holds, or not readable now): 503 with retry and a sentence for a person, no inner path, nothing written; the queue written again by the bridge itself, no restart, the next close closes it", { skip: opts.skip || process.getuid?.() === 0 }, async () => {
  const w = new World();
  await w.withTree();
  await w.ok(["person", "add", "Josef /Lhoták/", "--sex", "M"]);
  w.env.STROM_LIVE_POLL_MS = "100";
  w.env.STROM_MEDIA_BATCH_QUIET_MS = "600000";
  const root = w.cwd;
  const info = (await w.ok(["live", "start", "--json"])).json;
  const batch = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";
  let held = "";
  try {
    for (const [i, p] of ["Krabice/01.jpg", "Krabice/Žofie.jpg", "Фото/02.jpg"].entries()) {
      const b = jpgNo(300 + i);
      const r = await request("PUT", `${info.url}/media/${sha(b)}`, b, { ...later, "X-Strom-Batch": batch, "X-Strom-Path": encodeURIComponent(p), "X-Strom-Name": encodeURIComponent(path.basename(p)) });
      assert.equal(r.status, 202, r.body.toString());
    }
    const jobs = listJobs(root).filter((q) => q.job.batch === batch);
    assert.equal(jobs.length, 3);
    // another program holding one of them (Windows: an antivirus, EBUSY; here: not readable)
    held = jobs[1]!.job.file;
    fs.chmodSync(held, 0o000);
    const at = commits(root);
    const done = await request("POST", `${info.url}/batch/${batch}/done`, Buffer.from(JSON.stringify({ name: "Krabice", files: 3 })), app);
    assert.equal(done.status, 503, done.body.toString());
    const d = json(done);
    assert.equal(d.code, "media.held");
    assert.equal(typeof d.retry, "number");
    assert.ok(d.retry > 0 && d.retry <= 60, String(d.retry));
    assert.equal(done.headers["retry-after"], String(d.retry));
    assert.equal(d.batch, batch);
    assert.ok(typeof d.error === "string" && d.error.length > 20 && typeof d.text === "string", JSON.stringify(d));
    assert.doesNotMatch(`${d.error} ${d.text}`, /\.queued|incoming|EACCES|EBUSY|[\\/]/, "a sentence for a person, never the inner path or the system's error");
    assert.equal(commits(root), at, "nothing written");
    assert.equal(listJobs(root).filter((q) => q.job.batch === batch).length, 3, "every job kept");
    // the other program lets go: the bridge writes the queue again by itself (no restart, no new request)
    fs.chmodSync(held, 0o644);
    held = "";
    try {
      // (its line in live.log once its strom ended: after the jobs went)
      await until("the batch's files written again by the bridge", () => listJobs(root).filter((q) => q.job.batch === batch).length === 0 && /3 queued file\(s\) of the batch \S+ written/.test(liveLog(root)), { ms: 30_000 });
    } catch (e) {
      throw new Error(`${(e as Error).message}\n${liveLog(root)}`);
    }
    assert.match(liveLog(root), /the batch \S+ not closed now: its queued files written again in \d+ s/);
    // the app closes it again as `retry` said: closed, its three files in it
    const again = await request("POST", `${info.url}/batch/${batch}/done`, Buffer.from(JSON.stringify({ name: "Krabice", files: 3 })), app);
    assert.equal(again.status, 200, again.body.toString());
    assert.equal(json(again).inputs, 3, again.body.toString());
    assert.deepEqual(fs.readdirSync(path.join(w.home, "shared", "media", ".incoming")).filter((n) => n.endsWith(".queued")), [], "no bytes left behind");
  } finally {
    if (held) fs.chmodSync(held, 0o644);
    await w.ok(["live", "stop"]);
  }
  w.cleanup();
});

test("the warm writer: started by the first write, the writes in one process that lives on; killed, the next write by a strom of its own; the bridge's end ends it", opts, async () => {
  const w = new World();
  await w.withTree();
  await w.ok(["person", "add", "Josef /Lhoták/", "--sex", "M"]);
  w.env.STROM_LIVE_POLL_MS = "100";
  const root = w.cwd;
  const info = (await w.ok(["live", "start", "--json"])).json;
  const put = (b: Buffer) => request("PUT", `${info.url}/media/${sha(b)}`, b, { ...app, "X-Strom-Person": "P0001", "X-Strom-Name": "x.jpg" });
  let pids: number[] = [];
  try {
    // a bridge that only answers reads starts no writer of its own: the first original starts it
    assert.equal((await request("GET", `${info.url}/status`, undefined, app)).status, 200);
    await new Promise((r) => setTimeout(r, 500));
    assert.equal(writerPids(root).length, 0, "no writer before the first write");
    for (const n of [11, 12]) assert.equal((await put(jpgNo(n))).status, 200);
    pids = writerPids(root);
    assert.equal(pids.length, 1, "one writer for both");
    assert.ok(alive(pids[0]!));
    process.kill(pids[0]!, "SIGKILL");
    await until("its end noted", () => /the writer ended \(exit/.test(liveLog(root)), { ms: 30_000 });
    const r = await put(jpgNo(13));
    assert.equal(r.status, 200, r.body.toString());
    assert.match(json(r).input, /^I\d{4}$/);
    assert.equal(writerPids(root).length, 1, "the write after its failure by a strom of its own");
  } finally {
    await w.ok(["live", "stop"]);
  }
  for (const pid of writerPids(root)) await until("no writer left", () => !alive(pid), { ms: 30_000 });
  w.cleanup();
});

test("strom media queued takes the queue in parts, the tree's lock free between them: another process taking the lock waits no longer than one part; a file refused said with its code", opts, async () => {
  const w = new World();
  await w.withTree();
  await w.ok(["person", "add", "Josef /Lhoták/", "--sex", "M"]);
  const root = w.cwd;
  const config = JSON.parse(fs.readFileSync(path.join(root, "strom.json"), "utf8")) as { id: string };
  const incoming = path.join(w.home, "shared", "media", ".incoming");
  fs.mkdirSync(incoming, { recursive: true });
  const queue = (b: Buffer, name: string) => {
    const part = path.join(incoming, `${sha(b)}-t.part`);
    fs.writeFileSync(part, b);
    return enqueue(root, part, { sha: sha(b), name, persons: ["P0001"], client: {}, bytes: b.length }, queueTag(config.id));
  };
  for (let i = 0; i < 12; i++) queue(jpgNo(200 + i), `${i}.jpg`);
  // the same file said of the same again: one job
  assert.equal(queue(jpgNo(200), "0.jpg").again, true);
  // bytes that are no image: refused as it is written, the rest go on
  queue(Buffer.concat([Buffer.from("MZ"), Buffer.alloc(100)]), "setup.exe");
  assert.equal(listJobs(root).length, 13);

  // another process takes the tree's lock again and again meanwhile: its longest wait
  const stop = path.join(w.dir, "stop");
  const out = path.join(w.dir, "waits.jsonl");
  const script = path.join(w.dir, "probe.mjs");
  fs.writeFileSync(script, `
import fs from "node:fs";
const { acquireLock } = await import(${JSON.stringify(new URL("../../src/core/lock.ts", import.meta.url).href)});
const [file, out, stop] = process.argv.slice(2);
while (!fs.existsSync(stop)) {
  const t = performance.now();
  acquireLock(file, { owner: "strom probe", waitMs: 600000, staleMs: 60000 })();
  fs.appendFileSync(out, JSON.stringify({ waitMs: Math.round(performance.now() - t) }) + "\\n");
  await new Promise((r) => setTimeout(r, 20));
}
`);
  const probe = spawn(process.execPath, [script, path.join(root, ".strom", "tree.lock"), out, stop], { stdio: "ignore" });
  try {
    await until("the probe at work", () => fs.existsSync(out), { ms: 30_000 });
    let left = 13;
    let parts = 0;
    const files: { input?: string; refused?: { code: string } }[] = [];
    const before = commits(root);
    while (left > 0) {
      const r = (await w.ok(["media", "queued", "--max-files", "5", "--json"], { env: { STROM_FOR_APP: "1" } })).json;
      parts++;
      files.push(...r.files);
      assert.ok(r.files.length <= 5);
      assert.ok(r.left < left);
      left = r.left;
      assert.equal(typeof r.commit?.head, "string", "its commit said");
    }
    assert.equal(parts, 3);
    assert.equal(commits(root), before + 3, "one commit for each part");
    assert.equal(files.filter((f) => f.input).length, 12);
    assert.equal(files.find((f) => f.refused)?.refused?.code, "media.type");
    assert.equal(listJobs(root).length, 0);
  } finally {
    fs.writeFileSync(stop, "");
    await new Promise<void>((r) => (probe.exitCode !== null ? r() : probe.once("exit", () => r())));
  }
  const waits = fs.readFileSync(out, "utf8").trim().split("\n").map((l) => (JSON.parse(l) as { waitMs: number }).waitMs);
  // a part of five files and its commit: some twenty strom starts of this computer at the most (a loaded one too)
  const budget = 40 * nodeStartMs();
  assert.ok(Math.max(...waits) < budget, `the longest wait ${Math.max(...waits)} ms, budget ${budget} ms`);
  w.cleanup();
});
