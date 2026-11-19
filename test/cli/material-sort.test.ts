// Files of the family's material sorted by readers of the research for the Strom app (V13, POST /material/sort), with
// a made-up reader (the script runner): a title, a date, a kind and links proposed for each, nothing written to the
// research; never a title the person gave, a link there is already, an ID the research does not have; at most 50 files
// and 2000 characters, one at work and three queued, counted against the app's readings (read.app: one for each ten
// files begun); cancelled at once or stopped at work; never in an archive nor where the research waits for its agent;
// a PDF's first ten pages opened, a HEIC converted (macOS), a file no reader opens judged by its name.

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { World, hasGit, until } from "../helpers.ts";
import { makePdf } from "../image-samples.ts";
import { encodeImage } from "../../src/image/index.ts";
import { Tree } from "../../src/core/tree.ts";
import type { Family, Input } from "../../src/core/model.ts";
import { limitReached, noteAsked } from "../../src/core/live-read.ts";
import { appSort, keptProposals, loadSort, parseSortReport, saveSort, signSort, signStart, sortCost, startable, unsignedAppSort, unstartableAppSort, type SortState } from "../../src/core/sort.ts";

const opts = { skip: !hasGit || process.platform === "win32" };
const app = { Origin: "https://beta.stromapp.info" };
const fixtures = path.join(import.meta.dirname, "..", "fixtures", "images");
const mac = process.platform === "darwin" && fs.existsSync("/usr/bin/sips");

// the reader: its report from a file; it waits while SORT_HOLD is there; what it was told kept beside
const READER = `import fs from "node:fs";
const p = process.env.STROM_PROMPT ?? "";
const report = /Write your report to (.+) AS YOU GO/.exec(p)[1];
fs.appendFileSync(process.env.SORT_MARK, "start\\n");
fs.appendFileSync(process.env.SORT_TOLD, p + "\\n=====\\n");
while (fs.existsSync(process.env.SORT_HOLD)) await new Promise((r) => setTimeout(r, 50));
const body = fs.readFileSync(process.env.SORT_BODY, "utf8");
fs.writeFileSync(report, fs.readFileSync(report, "utf8").replace("<!-- next file block -->", body.trim() + "\\n<!-- next file block -->"));
fs.appendFileSync(process.env.SORT_MARK, "end\\n");
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
const git = (w: World, ...args: string[]) => spawnSync("git", ["-C", w.cwd, ...args], { encoding: "utf8" }).stdout.trim();
const scan = (w: number, h: number, grey: number) => ({ bytes: encodeImage({ width: w, height: h, channels: 3, data: new Uint8Array(w * h * 3).fill(grey) }, "jpeg", 92), width: w, height: h });

/** Václav Lhoták (P1, died 1960 citing S1), Eva Lhotáková (P2), married in Lhota (F1), their daughter Anna (P3). */
async function setUp(o: { state?: "research" | "archive" | "waiting"; env?: Record<string, string> } = {}) {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["lang", "cs"]);
  await w.ok(["person", "add", "Václav /Lhoták/", "--sex", "M", "--born", "1890"]);
  await w.ok(["person", "add", "Eva /Lhotáková/", "--sex", "F", "--born", "1893"]);
  await w.ok(["family", "add", "--partner", "P1", "--partner", "P2"]);
  await w.ok(["event", "add", "F1", "MARR", "--date", "1915", "--place", "Lhota"]);
  await w.ok(["source", "add", "Matrika zemřelých Lhota", "--kind", "burial"]);
  await w.ok(["event", "add", "P1", "DEAT", "--date", "1960", "--place", "Lhota", "--cite", "S0001"]);
  await w.ok(["person", "add", "Anna /Lhotáková/", "--sex", "F", "--born", "1920"]);
  const dir = path.join(w.dir, "třídění");
  fs.mkdirSync(dir);
  fs.writeFileSync(path.join(dir, "reader.mjs"), READER);
  Object.assign(w.env, {
    STROM_AGENT: "script",
    STROM_RUNNER_SCRIPT: path.join(dir, "reader.mjs"),
    SORT_BODY: path.join(dir, "body.md"),
    SORT_MARK: path.join(dir, "readers.log"),
    SORT_TOLD: path.join(dir, "told.txt"),
    SORT_HOLD: path.join(dir, "hold"),
    STROM_NO_CONVERT: "1",
    STROM_LIVE_POLL_MS: "150",
    ...o.env,
  });
  if (o.state === "archive") await w.ok(["mode", "archive"], { tty: true, answers: ["a"] });
  // no agent on this computer: the research waits for it
  if (o.state === "waiting") {
    delete w.env.STROM_AGENT;
    w.env.PATH = [path.dirname(process.execPath), "/usr/bin", "/bin"].join(path.delimiter);
  }
  return { w, dir };
}

/** The files of the material, taken in: the inputs I… in the order given. */
async function intake(w: World, files: Record<string, Uint8Array | string>): Promise<string[]> {
  const box = path.join(w.dir, "krabice-materiál");
  fs.rmSync(box, { recursive: true, force: true });
  fs.mkdirSync(box);
  for (const [name, data] of Object.entries(files)) fs.writeFileSync(path.join(box, name), data);
  const got = (await w.ok(["intake", ...Object.keys(files).map((n) => path.join(box, n)), "--json"])).json as { inputs: { id: string }[] };
  return got.inputs.map((i) => i.id);
}

async function bridge(w: World): Promise<string> {
  await w.ok(["live", "start", "--json"]);
  return (JSON.parse(fs.readFileSync(path.join(w.cwd, ".strom", "live.json"), "utf8")) as { url: string }).url;
}

const marks = (dir: string) => (fs.existsSync(path.join(dir, "readers.log")) ? fs.readFileSync(path.join(dir, "readers.log"), "utf8").trim().split("\n") : []);

test("files sorted for the Strom app: a title, date, kind and links with why and how sure; nothing written; the person's title, a link there is already and an unknown ID left out", opts, async () => {
  const { w, dir } = await setUp();
  const files = await intake(w, {
    "svatba Lhotákových.jpg": fs.readFileSync(path.join(fixtures, "base420.jpg")),
    "parte.png": fs.readFileSync(path.join(fixtures, "png-rgb.png")),
    "dopis Лгота.txt": "Milá Evo, posílám fotky ze svatby.\n",
    "listy.pdf": makePdf([{ jpeg: scan(60, 80, 50) }, { jpeg: scan(80, 60, 150) }]),
  });
  assert.equal(files.length, 4, JSON.stringify(files));
  const [photo, parte, letter, pdf] = files as [string, string, string, string];
  const marr = Tree.open(w.cwd, w.env).get<Family>("F0001")!.events[0]!.id;
  fs.writeFileSync(
    path.join(dir, "body.md"),
    `## File ${photo}
title: Svatba Václava a Evy, 1915
date: 1915
kind: photo
link: family F1
link: event F1 ${marr}
link: person P99
why: Nevěsta v závoji;
  podle textu svatba Lhotákových.
sure: high

## File ${parte}
title: Nový titulek
kind: document
link: person P1
link: source S1
why: Úmrtní oznámení Václava.
sure: medium

## File ${letter}
title: Dopis z Лготы
kind: dokument
why: Podle názvu dopis.
sure: snad

## File ${pdf}
unrelated: Ano.
title: Účtenka
link: person P1
why: Účtenka ze supermarketu, žádná osoba rodiny.
sure: high

## File I0042
title: Cizí

done: 4 files`,
  );
  const url = await bridge(w);
  try {
    const status = json(await request("GET", `${url}/status`));
    assert.ok(status.features.includes("material.sort"), JSON.stringify(status.features));
    // what the person did in the app before: a title of theirs, the file given to Václav
    assert.equal((await post(`${url}/material/edit`, { ids: [parte], title: "Parte Václava" })).status, 200);
    assert.equal((await post(`${url}/material/assign`, { files: [parte], add: ["P1"] })).status, 200);
    const head = git(w, "rev-parse", "HEAD");

    // refused before anything: no Origin, too many files, too long a text, half a character, a file not there
    assert.equal((await request("POST", `${url}/material/sort`, JSON.stringify({ ids: [photo] }))).status, 403);
    const many = Array.from({ length: 51 }, (_, k) => `I${String(k + 1).padStart(4, "0")}`);
    for (const [body, code, status] of [
      [{ ids: many, text: "" }, "material.body", 400],
      [{ ids: [photo], text: "ž".repeat(2001) }, "material.body", 400],
      [{ ids: [photo], text: "a\ud800b" }, "material.body", 400],
      [{ ids: [] }, "material.body", 400],
      [{ ids: [photo, "I0099"] }, "material.file", 404],
    ] as const) {
      const r = await post(`${url}/material/sort`, body);
      assert.deepEqual([r.status, json(r).code], [status, code], JSON.stringify(body).slice(0, 80));
    }
    assert.deepEqual(marks(dir), [], "nothing started");

    // what the person knows, in NFD and another script: kept and told in NFC
    const text = "Svatba Václava a Evy v Lhotě (Лгота), asi 1915.".normalize("NFD");
    const asked = await post(`${url}/material/sort`, { ids: [photo, parte, letter, pdf], text });
    assert.equal(asked.status, 202);
    const { id, state } = json(asked);
    assert.match(id, /^sort-\d{14}-[0-9a-f]{4}$/u);
    assert.equal(state, "queued");
    let got: any;
    await until("the sort done", async () => (got = json(await request("GET", `${url}/material/sort/${id}`))).state === "done", { ms: 60_000, state: () => got });
    assert.deepEqual(got.files, [photo, parte, letter, pdf]);
    assert.ok(got.at && !got.reason);
    assert.deepEqual(got.proposals, [
      { id: photo, title: "Svatba Václava a Evy, 1915", date: "1915", kind: "photo", links: [{ type: "family", ref: "F0001" }, { type: "event", ref: "F0001", event: marr }], why: "Nevěsta v závoji; podle textu svatba Lhotákových.", sure: "high" },
      // the person's title kept, Václav there already: the kind and the source alone
      { id: parte, kind: "document", links: [{ type: "source", ref: "S0001" }], why: "Úmrtní oznámení Václava.", sure: "medium" },
      // a kind strom does not know left out, how sure unsaid: low
      { id: letter, title: "Dopis z Лготы", why: "Podle názvu dopis.", sure: "low" },
      // plainly not the family's: why and how sure alone, nothing else of it offered
      { id: pdf, unrelated: true, why: "Účtenka ze supermarketu, žádná osoba rodiny.", sure: "high" },
    ]);
    assert.deepEqual(marks(dir), ["start", "end"], "one reader for four files");

    // what the reader was told: the person's words in NFC, the title of theirs done, the PDF's pages, the letter as text
    const told = fs.readFileSync(path.join(dir, "told.txt"), "utf8");
    assert.ok(told.includes(text.normalize("NFC")), "the person's text in NFC");
    assert.ok(!told.includes(text), "never in NFD");
    assert.ok(told.includes(`title: Parte Václava (the person's — DONE: propose no title)`), told.slice(0, 2000));
    assert.ok(/links now \(DONE — never propose them again\): person P0001/u.test(told));
    assert.ok(told.includes("(page 1 of 2)") && told.includes("(page 2 of 2)"), "a PDF of scans: its pages, no converter needed");
    assert.ok(new RegExp(`${letter} · "dopis Лгота.txt"[^\\n]*\\n(?:  [^\\n]*\\n)*  read as text: `, "u").test(told), "the letter read as text (no longer judged by its name)");
    assert.ok(told.includes("Václav Lhoták (1890–1960)") || told.includes("Václav Lhoták"), "the tree's people");
    assert.ok(told.includes(`F0001 · Václav Lhoták [P0001] & Eva Lhotáková [P0002]`), "its couples");
    assert.ok(told.includes("S0001 · Matrika zemřelých Lhota (burial)"), "its sources");

    // kept beside the research, nothing of it written: the history and the data as they were
    assert.equal(git(w, "rev-parse", "HEAD"), head);
    assert.equal(git(w, "status", "--porcelain"), "");
    const kept = JSON.parse(fs.readFileSync(path.join(w.cwd, ".strom", "sorts", `${id}.json`), "utf8"));
    assert.deepEqual(kept.dropped.map((d: { id: string; what: string; why: string }) => `${d.id} ${d.what}: ${d.why}`).sort(), [`${photo} link person P0099: not in the research`, `${letter} kind: not a kind of the material`, `${parte} title: the person's`, `${pdf} title: unrelated`, `${pdf} link person P0001: unrelated`, "I0042 file: not one of the sort's files"].sort());
    assert.equal(Tree.open(w.cwd, w.env).get<Input>(parte)!.title, "Parte Václava");
    // the readers' cost in the month's spend of the app
    assert.deepEqual(json(await request("GET", `${url}/status`)).spend.sorts, { count: 1, amount: 0.25 });

    // shown as the research is now: what the person gave meanwhile left out of it
    assert.equal((await post(`${url}/material/edit`, { ids: [photo], title: "Svatba" })).status, 200);
    const now = json(await request("GET", `${url}/material/sort/${id}`));
    assert.equal(now.proposals[0].title, undefined);
    assert.equal(now.proposals[0].date, "1915");
    // an agent sees it too
    const shown = (await w.ok(["material", "show", id, "--json"])).json;
    assert.equal(shown.state, "done");
    assert.equal(shown.proposals.length, 4);
    // nothing else of the app's: no sort, no cancel of one there is not
    assert.deepEqual([(await request("GET", `${url}/material/sort/sort-20260101120000-abcd`)).status, json(await post(`${url}/material/sort/sort-20260101120000-abcd/cancel`, {})).code], [404, "sort.none"]);
    // cancelled when done: done it stays
    assert.deepEqual(json(await post(`${url}/material/sort/${id}/cancel`, {})), { id, state: "done", cancelled: false });
  } finally {
    await w.run(["live", "stop"]);
  }
});

test("sorts one at a time, three queued, the rest refused; counted against the app's readings by ten files; cancelled queued at once, at work its reader stopped", opts, async () => {
  const { w, dir } = await setUp();
  const names: Record<string, string> = {};
  for (let k = 1; k <= 11; k++) names[`dopis ${k}.txt`] = `Dopis číslo ${k} — Лгота\n`;
  const files = await intake(w, names);
  assert.equal(files.length, 11);
  fs.writeFileSync(path.join(dir, "body.md"), `## File ${files[0]}\ntitle: Dopis\nwhy: Název.\nsure: low\n`);
  fs.writeFileSync(path.join(dir, "hold"), "");
  const url = await bridge(w);
  const sorts: string[] = [];
  const stateOf = async (id: string) => json(await request("GET", `${url}/material/sort/${id}`)).state as string;
  try {
    const a = await post(`${url}/material/sort`, { ids: files.slice(0, 10), text: "Dopisy z Lhoty" });
    assert.equal(a.status, 202);
    sorts.push(json(a).id);
    await until("the first at work", async () => (await stateOf(sorts[0]!)) === "working" && marks(dir).includes("start"), { ms: 30_000 });
    for (let k = 0; k < 3; k++) {
      const r = await post(`${url}/material/sort`, { ids: [files[k]!] });
      assert.equal(r.status, 202);
      sorts.push(json(r).id);
    }
    const full = await post(`${url}/material/sort`, { ids: [files[3]!] });
    assert.deepEqual([full.status, json(full).code, full.headers["retry-after"]], [429, "sort.queue", "60"]);
    assert.deepEqual(await Promise.all(sorts.slice(1).map(stateOf)), ["queued", "queued", "queued"], "one at a time");
    // /status says the app's sorts queued and at work
    const said = (json(await request("GET", `${url}/status`)).sorts as { id: string; state: string; files: string[] }[]).map((x) => [x.id, x.state, x.files.length]);
    assert.deepEqual(said, sorts.map((id, k) => [id, k ? "queued" : "working", k ? 1 : 10]));

    // a queued one cancelled at once; the one at work: its reader stopped, nothing proposed
    assert.deepEqual(json(await post(`${url}/material/sort/${sorts[3]}/cancel`, {})), { id: sorts[3], state: "cancelled", cancelled: true });
    assert.deepEqual(json(await post(`${url}/material/sort/${sorts[0]}/cancel`, {})), { id: sorts[0], state: "working", cancelled: true });
    await until("the first cancelled", async () => (await stateOf(sorts[0]!)) === "cancelled", { ms: 30_000 });
    assert.ok(!marks(dir).includes("end"), "its reader never wrote its report");
    assert.equal(json(await request("GET", `${url}/material/sort/${sorts[0]}`)).proposals, undefined);
    // the next started; the rest cancelled the same
    await until("the second at work", async () => (await stateOf(sorts[1]!)) === "working", { ms: 30_000 });
    await post(`${url}/material/sort/${sorts[2]}/cancel`, {});
    await post(`${url}/material/sort/${sorts[1]}/cancel`, {});
    await until("all cancelled", async () => (await Promise.all(sorts.map(stateOf))).every((s) => s === "cancelled"), { ms: 30_000 });

    // read.app: 20 an hour by default; four sorts asked (each of at most ten files: one reading), fifteen readings more
    assert.deepEqual([sortCost(1), sortCost(10), sortCost(11), sortCost(50)], [1, 1, 2, 5]);
    noteAsked(w.cwd, "D20261117120000-aaaa", "read", Date.now() - 60_000, 15);
    const over = await post(`${url}/material/sort`, { ids: files });
    assert.deepEqual([over.status, json(over).code, json(over).params], [429, "sort.limit", { per: "hour", most: "20", cost: "2" }]);
    assert.ok(Number(over.headers["retry-after"]) > 0);
    // ten files: one reading, the last of the hour
    const last = await post(`${url}/material/sort`, { ids: files.slice(1) });
    assert.equal(last.status, 202, last.body.toString());
    sorts.push(json(last).id);
    assert.equal(limitReached(w.cwd, { hour: 20, day: 60 }, 0)?.per, "hour", "the app's readings full: a reading refused too");
    await post(`${url}/material/sort/${json(last).id}/cancel`, {});
    await until("the last cancelled", async () => (await stateOf(sorts[4]!)) === "cancelled", { ms: 30_000 });
    assert.deepEqual(json(await request("GET", `${url}/status`)).sorts, [], "none at work: none said");
  } finally {
    fs.rmSync(path.join(dir, "hold"), { force: true });
    await w.run(["live", "stop"]);
  }
});

test("no sort in an archive nor where the research waits for its agent: not offered, refused sort.none", opts, async () => {
  for (const state of ["archive", "waiting"] as const) {
    const { w, dir } = await setUp({ state });
    const [file] = await intake(w, { "fotka.jpg": fs.readFileSync(path.join(fixtures, "grey.jpg")) });
    const url = await bridge(w);
    try {
      const status = json(await request("GET", `${url}/status`));
      assert.ok(!status.features.includes("material.sort"), `${state}: ${JSON.stringify(status.features)}`);
      assert.ok(status.features.includes("material.edit"));
      assert.deepEqual(["reads" in status, "sorts" in status], [false, false], `${state}: says no readings nor sorts`);
      const r = await post(`${url}/material/sort`, { ids: [file] });
      assert.deepEqual([r.status, json(r).code], [404, "sort.none"], state);
      assert.deepEqual(marks(dir), []);
      assert.ok(!fs.existsSync(path.join(w.cwd, ".strom", "sorts")), "nothing kept");
    } finally {
      await w.run(["live", "stop"]);
    }
  }
});

test("an agent sorts in the foreground: a PDF's first ten pages opened, a HEIC converted (macOS), cancelled when queued", opts, async (t) => {
  const { w, dir } = await setUp({ env: { STROM_NO_CONVERT: "" } });
  const pages = Array.from({ length: 12 }, (_, k) => ({ jpeg: scan(60, 80, 20 * k) }));
  const heic = path.join(w.dir, "Fotka – Žofie.heic".normalize("NFD"));
  const made = mac && spawnSync("/usr/bin/sips", ["-s", "format", "heic", path.join(fixtures, "grey.jpg"), "--out", heic], { encoding: "utf8" }).status === 0 && fs.existsSync(heic);
  const files = await intake(w, { "kniha.pdf": makePdf(pages), ...(made ? { "fotka.heic": fs.readFileSync(heic) } : {}) });
  fs.writeFileSync(path.join(dir, "body.md"), `## File ${files[0]}\nkind: record\nlink: source S1\nwhy: Zápisy.\nsure: medium\n`);
  // paid readings: the person's yes first — nobody to ask (no window, no terminal): exit 4 and nothing sorted;
  // a window's no: refused; in their terminal Enter says no; an agent never answers for them
  const none = await w.run(["material", "sort", ...files, "--json"]);
  assert.equal(none.code, 4, none.out + none.err);
  assert.match(none.out + none.err, /material sort/u);
  const refused = await w.run(["material", "sort", ...files, "--json"], { dialog: false });
  assert.notEqual(refused.code, 0);
  assert.match(refused.out + refused.err, /consent\.refused/u);
  const enter = await w.run(["material", "sort", ...files], { tty: true, answers: [""] });
  assert.equal(enter.code, 0, enter.out + enter.err);
  assert.match(enter.out, /Nic se netřídilo\./u);
  const agent = await w.run(["material", "sort", ...files, "--json"], { tty: true, answers: ["y"], env: { CLAUDECODE: "1", STROM_NO_DIALOG: "1" } });
  assert.equal(agent.code, 4, "an agent's terminal is no person's yes");
  assert.equal(marks(dir).length, 0, "no reader started before the person's yes");
  assert.deepEqual((await w.ok(["material", "show", "--json"])).json.sorts, [], "nothing queued without the yes");
  const got = (await w.ok(["material", "sort", ...files, "--text", "Kniha a fotka", "--json"], { dialog: true })).json;
  assert.equal(got.state, "done");
  assert.deepEqual(got.proposals, [{ id: files[0], kind: "record", links: [{ type: "source", ref: "S0001" }], why: "Zápisy.", sure: "medium" }]);
  assert.equal(got.from, undefined, "an agent's own sort: not the app's");
  const told = fs.readFileSync(path.join(dir, "told.txt"), "utf8");
  assert.ok(told.includes("(page 10 of 12)") && !told.includes("(page 11 of 12)"), "the first ten pages alone");
  if (made) assert.match(told, new RegExp(`- ${files[1]} · "fotka\\.heic"[^\\n]*\\n(?:  note[^\\n]*\\n)*  open: [^\\n]+\\.jpg`, "u"), "the HEIC converted to a JPEG");
  else t.diagnostic("no HEIC made on this system: its conversion not tried");

  // queued, then cancelled before it began: nothing sorted
  const queued = (await w.ok(["material", "sort", files[0]!, "--queue", "--json"])).json;
  assert.equal(queued.state, "queued");
  assert.equal((await w.ok(["material", "cancel", queued.id, "--json"])).json.state, "cancelled");
  const again = await w.run(["material", "sort", queued.id, "--json"]);
  assert.notEqual(again.code, 0);
  // the PDF's ten pages one reader's, the photo another's
  assert.equal(marks(dir).filter((m) => m === "start").length, made ? 2 : 1);
  assert.equal(marks(dir).filter((m) => m === "end").length, made ? 2 : 1);
  const list = (await w.ok(["material", "show", "--json"])).json.sorts.map((s: { state: string }) => s.state);
  assert.deepEqual(list, ["done", "cancelled"]);
});

test("only a sort its bridge signed is the Strom app's: a record written outside the bridge, or a worker named app:sort, never sorted — failed, said in live.log and to the agent", opts, async () => {
  const { w, dir } = await setUp();
  const [file] = await intake(w, { "dopis Лгота.txt": "Milá Evo, posílám fotky.\n" });
  fs.writeFileSync(path.join(dir, "body.md"), `## File ${file}\ntitle: Dopis\nwhy: Název.\nsure: low\n`);
  const sorts = path.join(w.cwd, ".strom", "sorts");
  // what an agent (or a hand) could write: a record that says it is the app's, without the bridge's signature
  const forge = (id: string) => {
    const at = new Date().toISOString();
    fs.mkdirSync(sorts, { recursive: true });
    fs.writeFileSync(path.join(sorts, `${id}.json`), JSON.stringify({ id, state: "queued", files: [file], text: "Dopis z Lhoty (Лгота)", lang: "cs", at, since: at, from: "app:sort" }));
  };
  const kept = (id: string) => JSON.parse(fs.readFileSync(path.join(sorts, `${id}.json`), "utf8"));
  const log = () => fs.readFileSync(path.join(w.cwd, ".strom", "live.log"), "utf8");

  // started by hand (or by an agent): never sorted, not even asked for — failed, said
  const a = "sort-20261117120000-aaaa";
  forge(a);
  const run = await w.run(["material", "sort", a, "--json"], { dialog: true });
  assert.notEqual(run.code, 0, run.out + run.err);
  assert.match(run.out + run.err, /material\.sort-unsigned/u);
  assert.match(run.out + run.err, /asked for again in the Strom app/u);
  assert.deepEqual([kept(a).state, kept(a).reason], ["failed", "unsigned"]);
  assert.ok(log().includes(`${a}: said to be the Strom app's but not signed by its bridge`), log());
  assert.deepEqual(marks(dir), [], "no reader started");

  const url = await bridge(w);
  try {
    // a worker named as the app: an agent's own sort, never the app's — the bridge leaves it alone
    const queued = (await w.ok(["material", "sort", file!, "--queue", "--json"], { env: { STROM_WORKER: "app:sort" } })).json;
    assert.equal(queued.state, "queued");
    assert.equal(queued.from, undefined, "app:sort is the bridge's alone");
    assert.equal(kept(queued.id).sign, undefined);
    // a forged record found by the bridge: failed at its next look, never started
    const b = "sort-20261117120001-bbbb";
    forge(b);
    await until("the forged sort failed", () => kept(b).state === "failed", { ms: 30_000, state: () => kept(b) });
    assert.equal(kept(b).reason, "unsigned");
    assert.ok(log().includes(`${b}: said to be the Strom app's but not signed by its bridge`), log());
    assert.equal(kept(queued.id).state, "queued", "the agent's own sort waits for the person");
    assert.deepEqual(marks(dir), [], "no reader started");
    // neither is the app's: not said in /status, not shown to the app
    assert.deepEqual(json(await request("GET", `${url}/status`)).sorts, []);
    assert.equal((await request("GET", `${url}/material/sort/${b}`)).status, 404);
    assert.equal((await request("GET", `${url}/material/sort/${queued.id}`)).status, 404);
    // the agent's own queued sort: paid readings only after the person's yes (nobody to ask: exit 4)
    assert.equal((await w.run(["material", "sort", queued.id, "--json"])).code, 4);
    assert.deepEqual(marks(dir), []);

    // one the app asked: signed by the bridge as it took it, sorted without asking again
    const asked = await post(`${url}/material/sort`, { ids: [file], text: "Dopis z Lhoty" });
    assert.equal(asked.status, 202);
    const { id } = json(asked);
    await until("the app's sort done", async () => json(await request("GET", `${url}/material/sort/${id}`)).state === "done", { ms: 60_000, state: () => kept(id) });
    assert.match(kept(id).sign, /^[0-9a-f]{64}$/u);
    assert.equal(kept(id).start, undefined, "its leave to start it spent as it began");
    assert.deepEqual(marks(dir), ["start", "end"]);

    // put back into the queue by hand (its signature over what was asked still good): never started again — failed
    const back = (sid: string) => {
      const k = kept(sid);
      for (const f of ["proposals", "dropped", "readers", "agent", "model", "pid", "reason", "error"]) delete k[f];
      fs.writeFileSync(path.join(sorts, `${sid}.json`), JSON.stringify({ ...k, state: "queued", since: k.at }));
    };
    back(id);
    await until("the sort put back failed", () => kept(id).state === "failed", { ms: 30_000, state: () => kept(id) });
    assert.deepEqual([kept(id).reason, /begun once already/u.test(kept(id).error)], ["unsigned", true]);
    assert.ok(log().includes(`${id}: the Strom app's sort begun once already, put back into the queue outside its bridge`), log());
    assert.deepEqual(marks(dir), ["start", "end"], "no reader started again");
    // …nor by hand (or by an agent): refused, never asked for
    back(id);
    const again = await w.run(["material", "sort", id, "--json"], { dialog: true });
    assert.notEqual(again.code, 0, again.out + again.err);
    assert.match(again.out + again.err, /material\.sort-unsigned/u);
    assert.match(again.out + again.err, /begun once already/u);
    assert.equal(kept(id).state, "failed");
    assert.deepEqual(marks(dir), ["start", "end"], "no reader started again");
  } finally {
    await w.run(["live", "stop"]);
  }
});

test("a sort of the app is the bridge's signature over what was asked, by whom and when: any of it changed, another key or none — not the app's", () => {
  const key = crypto.randomBytes(32);
  const s: SortState = { id: "sort-20261117120000-abcd", state: "queued", files: ["I0001", "I0002"], text: "Svatba v Лготě", lang: "cs", at: "2026-11-17T12:00:00.000Z", since: "2026-11-17T12:00:00.000Z", from: "app:sort" };
  const signed: SortState = { ...s, sign: signSort(key, s) };
  assert.ok(appSort(key, signed));
  // how it goes is not signed: it changes as it is sorted
  assert.ok(appSort(key, { ...signed, state: "done", since: "2026-11-17T12:05:00.000Z", readers: [{ n: 1, files: ["I0001"], began: "x", usd: 0.25 }], proposals: [] }));
  for (const changed of [{ id: "sort-20261117120000-abce" }, { files: ["I0001", "I0003"] }, { files: ["I0002", "I0001"] }, { text: s.text.normalize("NFD") }, { text: "" }, { lang: "en" }, { at: "2026-12-17T12:00:00.000Z" }, { from: "worker-1" }, { sign: signed.sign!.slice(0, 32) }, { sign: undefined }])
    assert.ok(!appSort(key, { ...signed, ...changed } as SortState), JSON.stringify(changed));
  assert.ok(!appSort(crypto.randomBytes(32), signed), "another tree's key");
  assert.ok(!appSort(undefined, signed), "no key here");
  assert.ok(unsignedAppSort(key, s));
  assert.ok(!unsignedAppSort(key, signed));
  assert.ok(!unsignedAppSort(key, { ...s, from: "worker-1" }), "an agent's own sort is no app's");
});

test("the bridge's leave to start a sort of the app is good once: while it is queued, spent with its first step out of the queue", () => {
  const key = crypto.randomBytes(32);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "strom-sort-"));
  try {
    const at = "2026-11-17T12:00:00.000Z";
    const s: SortState = { id: "sort-20261117120000-abcd", state: "queued", files: ["I0001"], text: "Svatba v Лготě", lang: "cs", at, since: at, from: "app:sort" };
    const queued: SortState = { ...s, sign: signSort(key, s), start: signStart(key, s) };
    assert.ok(startable(key, queued));
    assert.ok(!unstartableAppSort(key, queued));
    assert.ok(!startable(key, { ...queued, start: undefined }), "no leave: not started");
    assert.ok(!startable(key, { ...queued, start: queued.sign }), "the signature of what was asked is no leave to start");
    assert.ok(!startable(crypto.randomBytes(32), queued), "another tree's key");
    for (const state of ["working", "done", "failed", "cancelled"] as const) {
      assert.ok(!startable(key, { ...queued, state }), state);
      // kept: its leave gone, the signature of what was asked kept (still the app's, shown to it)
      saveSort(root, { ...queued, state, since: "2026-11-17T12:05:00.000Z" });
      const kept = loadSort(root, s.id)!;
      assert.deepEqual([kept.start, kept.sign, appSort(key, kept)], [undefined, queued.sign, true], state);
      // put back into the queue: the app's, but never started again
      const back: SortState = { ...kept, state: "queued", since: at };
      assert.deepEqual([appSort(key, back), startable(key, back), unstartableAppSort(key, back)], [true, false, true], state);
    }
    saveSort(root, queued);
    assert.equal(loadSort(root, s.id)!.start, queued.start, "kept while queued");
    assert.ok(!unstartableAppSort(key, { ...s, from: "worker-1" }), "an agent's own sort is no app's");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("a reader's report as strom reads it: keys in English, IDs short or long, a block of a file once; links the person took off or merged away", () => {
  const raw = parseSortReport(`# Sort x\n\n## File I4\n**title:** Rodina Lhotákových\ndate: ABT 1930\nkind: Photo\nlink: person p1\nlink: P2\nlink: event F1 E3\nlink: family S1\nwhy: Tři lidé\npřed domem.\nsure: High\n\n### I4\ntitle: znovu\n\n## Context\ntitle: nic\n`);
  assert.deepEqual(raw, [{ id: "I0004", title: "Rodina Lhotákových", date: "ABT 1930", kind: "Photo", links: [{ type: "person", ref: "P0001" }, { type: "person", ref: "P0002" }, { type: "event", ref: "F0001", event: "E0003" }], why: "Tři lidé před domem.", sure: "High" }]);
  const records: Record<string, unknown> = {
    I0004: { id: "I0004", type: "input", name: "a.jpg", links: [{ type: "person", ref: "P0002", order: 0, at: "x", retracted: { at: "x", reason: "app" } }] },
    P0001: { id: "P0001", type: "person", mergedInto: "P0005", events: [] },
    P0002: { id: "P0002", type: "person", events: [] },
    P0005: { id: "P0005", type: "person", events: [] },
    F0001: { id: "F0001", type: "family", partners: [], children: [], events: [{ id: "E0003", kind: "MARR" }] },
  };
  const tree = { get: (id: string) => records[id] } as never;
  const kept = keptProposals(tree, ["I0004"], raw);
  assert.deepEqual(kept.proposals, [{ id: "I0004", title: "Rodina Lhotákových", date: "ABT 1930", kind: "photo", links: [{ type: "person", ref: "P0005" }, { type: "event", ref: "F0001", event: "E0003" }], why: "Tři lidé před domem.", sure: "high" }]);
  assert.deepEqual(kept.dropped, [{ id: "I0004", what: "link person P0002", why: "taken off by the person" }]);
});

test("a file plainly not of the family: unrelated with why and how sure alone, never for one a reader says no to", () => {
  const raw = parseSortReport(["## File I1", "unrelated: yes", "why: Snímek obrazovky.", "sure: medium", "", "## File I2", "**unrelated:** да", "sure: low", "", "## File I3", "unrelated: no", "title: Dopis", "kind: document", "why: Dopis.", "", "## File I4", "unrelated: nevím", "why: nic"].join("\n").normalize("NFD"));
  assert.deepEqual(raw.map((p) => [p.id, p.unrelated ?? false]), [["I0001", true], ["I0002", true], ["I0003", false], ["I0004", false]]);
  const records: Record<string, unknown> = Object.fromEntries(["I0001", "I0002", "I0003", "I0004"].map((id) => [id, { id, type: "input", name: `${id}.png`, links: [] }]));
  const kept = keptProposals({ get: (id: string) => records[id] } as never, ["I0001", "I0002", "I0003", "I0004"], raw);
  assert.deepEqual(kept.proposals, [
    { id: "I0001", unrelated: true, why: "Snímek obrazovky.", sure: "medium" },
    { id: "I0002", unrelated: true, why: "", sure: "low" },
    // no unrelated: as before — a proposal of its values, and none where nothing is left
    { id: "I0003", title: "Dopis", kind: "document", why: "Dopis.", sure: "low" },
  ]);
  assert.deepEqual(kept.dropped, []);
});

test("a real reader's report (test/fixtures/sort): four made-up files of a box, each with its title, date, kind and places in the tree", () => {
  const report = fs.readFileSync(path.join(import.meta.dirname, "..", "fixtures", "sort", "lhotakovi-four-files.md"), "utf8");
  const raw = parseSortReport(report);
  assert.deepEqual(raw.map((p) => [p.id, p.kind, p.date, p.sure]), [
    ["I0001", "document", "MAR 1960", "high"],
    ["I0002", "photo", "6 JUN 1942", "high"],
    ["I0003", "photo", "6 JUN 1942", "high"],
    ["I0004", "document", "2 NOV 1946", "high"],
  ]);
  assert.ok(raw.every((p) => p.title && p.why && !/<!--|done:/u.test(p.why)), "the marker and the last line are no part of a block");
  // the tree the reader was told of: Václav (P1, his death E5), Eva (P2), their couple F1, Anna (P3), Josef (P4), their
  // couple F2 with no wedding yet; the person took the couple off the wedding photo before
  const records: Record<string, unknown> = {
    ...Object.fromEntries(["I0001", "I0003", "I0004"].map((id) => [id, { id, type: "input", name: `${id}.png`, links: [] }])),
    I0002: { id: "I0002", type: "input", name: "foto.png", links: [{ type: "family", ref: "F0002", order: 0, at: "x", retracted: { at: "x", reason: "app" } }] },
    P0001: { id: "P0001", type: "person", events: [{ id: "E0001", kind: "BIRT" }, { id: "E0005", kind: "DEAT" }] },
    P0002: { id: "P0002", type: "person", events: [{ id: "E0002", kind: "BIRT" }] },
    P0003: { id: "P0003", type: "person", events: [{ id: "E0004", kind: "BIRT" }] },
    P0004: { id: "P0004", type: "person", events: [{ id: "E0006", kind: "BIRT" }] },
    F0001: { id: "F0001", type: "family", partners: ["P0001", "P0002"], children: ["P0003"], events: [{ id: "E0003", kind: "MARR" }] },
    F0002: { id: "F0002", type: "family", partners: ["P0004", "P0003"], children: [], events: [] },
  };
  const kept = keptProposals({ get: (id: string) => records[id] } as never, ["I0001", "I0002", "I0003", "I0004"], raw);
  assert.deepEqual(
    kept.proposals.map((p) => [p.id, p.title, (p.links ?? []).map((l) => [l.type, l.ref, ...(l.event ? [l.event] : [])].join(" "))]),
    [
      ["I0001", "Parte Václava Lhotáka, 1960", ["person P0001", "event P0001 E0005"]],
      ["I0002", "Svatba Anny a Josefa Lhotových, 1942", ["person P0003", "person P0004"]],
      ["I0003", "Rub svatební fotky Anny a Josefa Lhotových, 1942", ["family F0002"]],
      ["I0004", "Dopis Evy Lhotákové sestře Marii, 1946", ["person P0002", "family F0002"]],
    ],
  );
  assert.deepEqual(kept.dropped, [{ id: "I0002", what: "link family F0002", why: "taken off by the person" }]);
});
