// A run of the Strom app's sort (spec 102 K1.11/K1.16, the research's answer V2a): more than 50 files asked at once
// (at most 1500) are sorted in parts of 50 in the order asked, each a sort of its own signed by the bridge with its
// run, number and parts; one item of the queue; its first part counted against the app's readings as taken, each other
// one as it starts — the run waits (waiting.why read.app) while the app's readings do not allow it and goes on by
// itself; cancelled whole (the parts done kept with their proposals) or a part alone; a part written outside the bridge
// or changed never started; a sort signed before runs still the app's.

import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { World, hasGit, until } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import { noteAsked } from "../../src/core/live-read.ts";
import { signRecord } from "../../src/core/seal.ts";
import { appSort, counted, runForApp, signCounted, signSort, signStart, startable, type SortState } from "../../src/core/sort.ts";

// Every world of a test cleaned up when it ends — its bridge ended, also when the test failed before its live stop
// (found 2026-11-19: three bridges of these tests running on in the temp folder after the run).
const made: World[] = [];
afterEach(() => {
  for (const w of made.splice(0)) w.cleanup();
});

const opts = { skip: !hasGit || process.platform === "win32" };
const app = { Origin: "https://beta.stromapp.info" };

// the reader: its report from a file; it waits while SORT_HOLD/all or SORT_HOLD/<its sort> is there; marks which sort
// it began and ended
const READER = String.raw`import fs from "node:fs";
import path from "node:path";
const p = process.env.STROM_PROMPT ?? "";
const report = /Write your report to (.+) AS YOU GO/.exec(p)[1];
const sort = /sort-\d{14}-[0-9a-f]{4}/.exec(report)[0];
fs.appendFileSync(process.env.SORT_MARK, "start " + sort + "\n");
const held = () => fs.existsSync(path.join(process.env.SORT_HOLD, "all")) || fs.existsSync(path.join(process.env.SORT_HOLD, sort));
while (held()) await new Promise((r) => setTimeout(r, 50));
const body = fs.readFileSync(process.env.SORT_BODY, "utf8");
fs.writeFileSync(report, fs.readFileSync(report, "utf8").replace("<!-- next file block -->", body.trim() + "\n<!-- next file block -->"));
fs.appendFileSync(process.env.SORT_MARK, "end " + sort + "\n");
console.log("cost: 0.25");
`;

function request(method: string, url: string, body?: string, headers: Record<string, string> = {}): Promise<{ status: number; body: Buffer; headers: http.IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? undefined : Buffer.from(body);
    const req = http.request(url, { method, headers: { ...(data ? { "Content-Length": String(data.length) } : {}), ...headers } }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (d: Buffer) => chunks.push(d));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks), headers: res.headers }));
    });
    req.on("error", reject);
    req.end(data);
  });
}
const json = (r: { body: Buffer }) => JSON.parse(r.body.toString("utf8"));
const post = (url: string, body: unknown) => request("POST", url, JSON.stringify(body), { ...app, "Content-Type": "application/json" });
const get = async (url: string) => json(await request("GET", url));
/** Every reader held let go (a test that failed midway leaves none waiting). */
const unhold = (hold: string) => {
  for (const f of fs.readdirSync(hold)) fs.rmSync(path.join(hold, f), { force: true });
};

/** Václav Lhoták and Eva Lhotáková of Lhota, and `n` letters of theirs taken in as the material (I… in order). */
async function setUp(n: number) {
  const w = new World();
  made.push(w);
  await w.withTree("Lhotákovi");
  await w.ok(["lang", "cs"]);
  await w.ok(["person", "add", "Václav /Lhoták/", "--sex", "M", "--born", "1890"]);
  await w.ok(["person", "add", "Eva /Lhotáková/", "--sex", "F", "--born", "1893"]);
  const dir = path.join(w.dir, "třídění");
  const hold = path.join(dir, "hold");
  fs.mkdirSync(hold, { recursive: true });
  fs.writeFileSync(path.join(dir, "reader.mjs"), READER);
  Object.assign(w.env, {
    STROM_AGENT: "script",
    STROM_RUNNER_SCRIPT: path.join(dir, "reader.mjs"),
    SORT_BODY: path.join(dir, "body.md"),
    SORT_MARK: path.join(dir, "readers.log"),
    SORT_HOLD: hold,
    STROM_NO_CONVERT: "1",
    STROM_LIVE_POLL_MS: "150",
  });
  const box = path.join(w.dir, "krabice Лгота");
  fs.mkdirSync(box);
  const names: string[] = [];
  for (let k = 1; k <= n; k++) {
    const name = `dopis ${String(k).padStart(4, "0")}.txt`;
    fs.writeFileSync(path.join(box, name), `Milá Evo, dopis číslo ${k} z Lhoty (Лгота).\n`);
    names.push(path.join(box, name));
  }
  const files = ((await w.ok(["intake", ...names, "--json"])).json as { inputs: { id: string }[] }).inputs.map((i) => i.id);
  assert.equal(files.length, n);
  // a proposal for every letter: each part keeps those of its own files
  fs.writeFileSync(path.join(dir, "body.md"), files.map((id, k) => `## File ${id}\ntitle: Dopis číslo ${k + 1} z Lhoty\nwhy: Název a text.\nsure: low\n`).join("\n"));
  await w.ok(["live", "start", "--json"]);
  const url = (JSON.parse(fs.readFileSync(path.join(w.cwd, ".strom", "live.json"), "utf8")) as { url: string }).url;
  const kept = (id: string): SortState => JSON.parse(fs.readFileSync(path.join(w.cwd, ".strom", "sorts", `${id}.json`), "utf8"));
  const marks = () => (fs.existsSync(path.join(dir, "readers.log")) ? fs.readFileSync(path.join(dir, "readers.log"), "utf8").trim().split("\n") : []);
  const log = () => fs.readFileSync(path.join(w.cwd, ".strom", "live.log"), "utf8");
  return { w, url, files, hold, kept, marks, log };
}

test("a run of 120 files: three parts of 50, 50 and 20 in the order asked, each signed by the bridge; one item of the queue; done part by part, each part's proposals its own; 1501 refused, 51 a run of two", opts, async () => {
  const { w, url, files, hold, kept, marks } = await setUp(120);
  try {
    // one sort of the bridge's alone: refused before anything
    const over = Array.from({ length: 1501 }, (_, k) => `I${String(k + 1).padStart(4, "0")}`);
    const big = await post(`${url}/material/sort`, { ids: over, text: "Dopisy z Lhoty" });
    assert.deepEqual([big.status, json(big).code, json(big).params?.most], [400, "material.body", "1500"]);
    assert.deepEqual(marks(), [], "nothing started");

    fs.writeFileSync(path.join(hold, "all"), "");
    const asked = await post(`${url}/material/sort`, { ids: files, text: "Dopisy Václava a Evy z Lhoty (Лгота)".normalize("NFD") });
    assert.equal(asked.status, 202, asked.body.toString());
    const got = json(asked);
    assert.match(got.run, /^run-\d{14}-[0-9a-f]{4}$/u);
    assert.equal(got.state, "queued");
    assert.equal(got.parts.length, 3);
    assert.equal(got.id, got.parts[0]);
    const [p1, p2, p3] = got.parts as [string, string, string];
    const key = Tree.open(w.cwd, w.env).key!;
    // the parts: the files in the order asked, the person's words in NFC, each signed with its run, number and parts
    const parts = got.parts.map(kept) as SortState[];
    assert.deepEqual(parts.map((s) => s.files), [files.slice(0, 50), files.slice(50, 100), files.slice(100)]);
    assert.deepEqual(parts.map((s) => [s.run, s.part, s.parts, s.from, s.text]), [1, 2, 3].map((k) => [got.run, k, 3, "app:sort", "Dopisy Václava a Evy z Lhoty (Лгота)".normalize("NFC")]));
    for (const s of parts) assert.ok(appSort(key, s), s.id);
    assert.ok(counted(key, parts[0]!), "the first part counted as the run was taken");

    // part 1 at work, the rest queued; a run is one item of the queue: three sorts more wait beside it, a fourth refused
    await until("part 1 at work", async () => (await get(`${url}/material/sort/${got.run}`)).parts[0].state === "working", { ms: 30_000 });
    const run = await get(`${url}/material/sort/${got.run}`);
    assert.deepEqual([run.id, run.run, run.state, run.files, run.filesDone], [got.run, true, "working", 120, 0]);
    assert.deepEqual(run.parts.map((p: { id: string; part: number; state: string; files: number }) => [p.id, p.part, p.state, p.files]), [[p1, 1, "working"], [p2, 2, "queued"], [p3, 3, "queued"]].map(([id, k, state]) => [id, k, state, k === 3 ? 20 : 50]));
    const status = (await get(`${url}/status`)).sorts as { id: string; run?: string; part?: number; parts?: number; files: string[] }[];
    assert.deepEqual(status.map((s) => [s.id, s.run, s.part, s.parts, s.files.length]), [[p1, got.run, 1, 3, 50], [p2, got.run, 2, 3, 50], [p3, got.run, 3, 3, 20]]);
    const singles: string[] = [];
    for (let k = 0; k < 3; k++) {
      const r = await post(`${url}/material/sort`, { ids: [files[k]!] });
      assert.equal(r.status, 202, r.body.toString());
      assert.equal(json(r).run, undefined, "a sort of its own");
      singles.push(json(r).id);
    }
    const full = await post(`${url}/material/sort`, { ids: [files[3]!] });
    assert.deepEqual([full.status, json(full).code], [429, "sort.queue"]);
    for (const id of singles) assert.equal(json(await post(`${url}/material/sort/${id}/cancel`, {})).state, "cancelled");

    // its parts one after another, in their order
    fs.rmSync(path.join(hold, "all"));
    let now: ReturnType<typeof runForApp> | undefined;
    await until("the run done", async () => (now = await get(`${url}/material/sort/${got.run}`)).state === "done", { ms: 120_000, state: () => now });
    assert.deepEqual([now!.files, now!.filesDone, now!.waiting], [120, 120, undefined]);
    assert.deepEqual(now!.parts.map((p) => p.state), ["done", "done", "done"]);
    const began = marks().filter((m) => m.startsWith("start ")).map((m) => m.slice(6));
    const firstOf = (id: string) => began.indexOf(id);
    assert.ok(firstOf(p1) >= 0 && firstOf(p1) < firstOf(p2) && firstOf(p2) < firstOf(p3), began.join(","));
    assert.ok(began.lastIndexOf(p1) < firstOf(p2) && began.lastIndexOf(p2) < firstOf(p3), "one part at a time");
    // each part's proposals of its own files, by its own ID
    const second = await get(`${url}/material/sort/${p2}`);
    assert.deepEqual([second.state, second.run, second.part, second.parts], ["done", got.run, 2, 3]);
    const ids = (r: { proposals: { id: string }[] }) => r.proposals.map((p) => p.id).sort();
    assert.deepEqual(ids(second), files.slice(50, 100));
    assert.equal(second.proposals.find((p: { id: string }) => p.id === files[50])?.title, "Dopis číslo 51 z Lhoty");
    assert.deepEqual(ids(await get(`${url}/material/sort/${p3}`)), files.slice(100));
    assert.deepEqual((await get(`${url}/status`)).sorts, [], "none queued nor at work");
    // an agent sees the run too
    const shown = (await w.ok(["material", "show", got.run, "--json"])).json;
    assert.deepEqual([shown.state, shown.filesDone, shown.parts.length], ["done", 120, 3]);
    assert.match((await w.ok(["material", "show", got.run])).out, /3\. sort-\d{14}-[0-9a-f]{4} · done · 20 files/u);
    // no run of that name: 404
    assert.deepEqual([(await request("GET", `${url}/material/sort/run-20260101120000-abcd`)).status, json(await post(`${url}/material/sort/run-20260101120000-abcd/cancel`, {})).code], [404, "sort.none"]);

    // 51 files: a run of two parts (50 and 1); cancelled by an agent's strom before it began: each part cancelled
    fs.writeFileSync(path.join(hold, "all"), "");
    const two = json(await post(`${url}/material/sort`, { ids: files.slice(0, 51) }));
    assert.equal(two.parts.length, 2);
    assert.deepEqual(two.parts.map((id: string) => kept(id).files.length), [50, 1]);
    const cancelled = (await w.ok(["material", "cancel", two.run, "--json"])).json;
    assert.equal(cancelled.id, two.run);
    await until("the run of two cancelled", async () => (await get(`${url}/material/sort/${two.run}`)).state === "cancelled", { ms: 30_000 });
    assert.deepEqual((await get(`${url}/material/sort/${two.run}`)).parts.map((p: { state: string }) => p.state), ["cancelled", "cancelled"]);
  } finally {
    unhold(hold);
    await w.run(["live", "stop"]);
  }
});

test("a run waits for the app's readings (read.app) and goes on by itself; a part changed outside the bridge never started; cancelled whole in the middle: the part done kept with its proposals", opts, async () => {
  const { w, url, files, hold, kept, marks, log } = await setUp(101);
  try {
    // fifteen of the hour's twenty readings asked: the first part (five) fits, the second must wait
    noteAsked(w.cwd, "D20261119120000-aaaa", "read", Date.now() - 60_000, 15);
    const got = json(await post(`${url}/material/sort`, { ids: files, text: "Dopisy z Lhoty" }));
    assert.equal(got.parts.length, 3);
    const [p1, p2, p3] = got.parts as [string, string, string];
    // the second held as it starts, once the app's readings allow it
    fs.writeFileSync(path.join(hold, p2), "");
    let run: any;
    await until("part 1 done, the run waiting", async () => (run = await get(`${url}/material/sort/${got.run}`)).parts[0].state === "done" && !!run.waiting, { ms: 60_000, state: () => run });
    assert.equal(run.state, "working", "a run with a part done and parts queued is under way");
    assert.deepEqual([run.waiting.why, run.waiting.retry > 0, run.filesDone], ["read.app", true, 50]);
    assert.deepEqual(run.parts.map((p: { state: string }) => p.state), ["done", "queued", "queued"]);
    await until("its wait said in live.log", () => log().includes(`${got.run}: its part 2 of 3 waits (read.app`), { ms: 10_000, state: log });
    // its next part never started by hand, nor by an agent: its bridge alone, when the app's readings allow
    const byHand = await w.run(["material", "sort", p2, "--json"], { dialog: true });
    assert.notEqual(byHand.code, 0, byHand.out + byHand.err);
    assert.match(byHand.out + byHand.err, /material\.sort-waiting/u);
    assert.equal(kept(p2).state, "queued");
    assert.ok(!marks().some((m) => m.endsWith(p2)), "no reader of part 2");

    // a part changed outside the bridge (its number): not the app's — failed, never started, no part of the run
    const changed = kept(p3);
    fs.writeFileSync(path.join(w.cwd, ".strom", "sorts", `${p3}.json`), JSON.stringify({ ...changed, part: 2 }));
    await until("the changed part failed", () => kept(p3).state === "failed", { ms: 30_000, state: () => kept(p3) });
    assert.equal(kept(p3).reason, "unsigned");
    // …and one written outside the bridge, said to be of the run
    const forged = "sort-20261119120000-ffff";
    fs.writeFileSync(path.join(w.cwd, ".strom", "sorts", `${forged}.json`), JSON.stringify({ id: forged, state: "queued", files: [files[0]], text: "", lang: "cs", at: changed.at, since: changed.at, from: "app:sort", run: got.run, part: 4, parts: 4 }));
    await until("the forged part failed", () => kept(forged).state === "failed", { ms: 30_000, state: () => kept(forged) });
    assert.equal(kept(forged).reason, "unsigned");
    assert.deepEqual((await get(`${url}/material/sort/${got.run}`)).parts.map((p: { id: string }) => p.id), [p1, p2], "the run is its signed parts alone");

    // the hour gone by: the run goes on by itself (the second part counted as it starts)
    fs.rmSync(path.join(w.cwd, ".strom", "reads", "app-asked.jsonl"));
    await until("part 2 at work", async () => (run = await get(`${url}/material/sort/${got.run}`)).parts[1].state === "working" && marks().includes(`start ${p2}`), { ms: 30_000, state: () => run });
    assert.equal(run.waiting, undefined);
    assert.ok(counted(Tree.open(w.cwd, w.env).key, kept(p2)), "counted by the bridge as it started");
    assert.ok(fs.readFileSync(path.join(w.cwd, ".strom", "reads", "app-asked.jsonl"), "utf8").includes(p2));

    // cancelled whole in the middle: its part at work stopped, the part done kept with its proposals
    const stop = json(await post(`${url}/material/sort/${got.run}/cancel`, {}));
    assert.deepEqual([stop.id, stop.cancelled], [got.run, true]);
    await until("part 2 cancelled", () => kept(p2).state === "cancelled", { ms: 30_000, state: () => kept(p2) });
    const ended = await get(`${url}/material/sort/${got.run}`);
    assert.deepEqual(ended.parts.map((p: { state: string }) => p.state), ["done", "cancelled"]);
    assert.deepEqual([ended.state, ended.filesDone, ended.files], ["cancelled", 50, 100], "stopped by the person; the changed part no longer counted");
    assert.ok(!marks().includes(`end ${p2}`), "its reader never wrote its report");
    assert.ok(!marks().some((m) => m.endsWith(p3)), "the changed part never read");
    const first = await get(`${url}/material/sort/${p1}`);
    assert.deepEqual(first.proposals.map((p: { id: string }) => p.id).sort(), files.slice(0, 50));
    // cancelled again: nothing more to stop
    assert.deepEqual(json(await post(`${url}/material/sort/${got.run}/cancel`, {})), { id: got.run, state: "cancelled", cancelled: false });
  } finally {
    unhold(hold);
    await w.run(["live", "stop"]);
  }
});

test("a part of a run is signed with its run, number and parts: any of them changed or taken off, not the app's; a sort signed before runs is still the app's; a part counted by the bridge alone", () => {
  const key = crypto.randomBytes(32);
  const at = "2026-11-19T12:00:00.000Z";
  const part: SortState = { id: "sort-20261119120000-abcd", state: "queued", files: ["I0051"], text: "Dopisy z Lhoty (Лгота)", lang: "cs", at, since: at, from: "app:sort", run: "run-20261119120000-ef01", part: 2, parts: 3 };
  const signed: SortState = { ...part, sign: signSort(key, part), start: signStart(key, part) };
  assert.ok(appSort(key, signed));
  assert.ok(startable(key, signed));
  for (const changed of [{ part: 3 }, { parts: 2 }, { run: "run-20261119120000-ef02" }, { part: undefined }, { run: undefined, part: undefined, parts: undefined }])
    assert.ok(!appSort(key, { ...signed, ...changed } as SortState), JSON.stringify(changed));
  // counted against the app's readings: a sort of its own always (as it was taken), a part only with the bridge's word
  assert.ok(!counted(key, signed));
  assert.ok(counted(key, { ...signed, counted: signCounted(key, signed) }));
  assert.ok(!counted(key, { ...signed, counted: signed.sign }), "the signature of what was asked is no word it was counted");
  assert.ok(!counted(crypto.randomBytes(32), { ...signed, counted: signCounted(key, signed) }), "another tree's key");
  assert.ok(!counted(key, { ...signed, part: 3, counted: signCounted(key, signed) }));

  // a sort of its own signed by a strom before runs (what was signed then, as it was): still the app's, still startable
  const old: SortState = { id: "sort-20261117120000-abcd", state: "queued", files: ["I0001", "I0002"], text: "Svatba v Лготě", lang: "cs", at, since: at, from: "app:sort" };
  const was = { id: old.id, files: old.files, text: old.text, lang: old.lang, from: old.from, at: old.at };
  const before: SortState = { ...old, sign: signRecord(key, "strom material sort", was), start: signRecord(key, "strom material sort start", was) };
  assert.equal(before.sign, signSort(key, old), "the same signature as before");
  assert.ok(appSort(key, before));
  assert.ok(startable(key, before));
  assert.ok(counted(key, before));
  assert.ok(!appSort(key, { ...before, run: "run-20261117120000-abcd", part: 1, parts: 1 }), "made a part of a run afterwards: not the app's");

  // a run as the app is told it
  const p = (id: string, n: number, state: SortState["state"], files: number): SortState => ({ ...part, id, part: n, state, files: Array.from({ length: files }, (_, k) => `I${k}`) });
  const states = (...s: SortState["state"][]) => runForApp("run-20261119120000-ef01", s.map((x, k) => p(`sort-2026111912000${k}-abcd`, k + 1, x, 50)));
  assert.equal(states("queued", "queued").state, "queued");
  assert.equal(states("done", "queued").state, "working");
  assert.equal(states("cancelled", "queued").state, "queued", "none ran yet");
  assert.deepEqual([states("done", "cancelled").state, states("done", "cancelled").filesDone], ["cancelled", 50], "stopped by the person, the part done kept");
  assert.deepEqual([states("done", "failed").state, states("done", "failed").filesDone], ["done", 50]);
  assert.equal(states("failed", "failed").state, "failed");
  assert.equal(states("failed", "cancelled").state, "cancelled");
  assert.equal(states("cancelled", "cancelled").state, "cancelled");
  assert.equal(runForApp("run-20261119120000-ef01", [p("sort-20261119120000-abcd", 1, "done", 50)], { why: "read.app", retry: 5 }).waiting, undefined, "an ended run waits for nothing");
});
