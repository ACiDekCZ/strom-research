// The readers the Strom app may choose and a source read again from its original, through the bridge (spec 059 K2.1,
// K2.2, K3.1–K3.3; the app's ZADANI_VYZKUM_cteni-modely.md): /status accepts.read.choices — the agents installed here,
// their models and efforts, the defaults as the research's settings say; "with" in POST /read and again (400 read.with,
// 409 read.agent); who read in the result, /status reads and /reads; POST /sources/read — the record read again from its
// original, never its transcript, the user's confirmation kept; 1 _STROM_ORIG Y in the Strom file for an app that reads
// a source again; without Claude Code in the terminal nothing starts (agent.cli-missing). A made-up reader alone.

import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { World, hasGit, until } from "../helpers.ts";
import { world } from "./excerpts.helpers.ts";
import { halves, jpegWithOrientation } from "../image-samples.ts";
import { now, Tree } from "../../src/core/tree.ts";
import { Settings } from "../../src/core/config.ts";
import { confirmedOn, transcriptMark } from "../../src/core/readers.ts";
import { BRIDGE_FEATURES } from "../../src/core/live.ts";
import { APP_READS_SOURCES_AGAIN, APP_READS_SOURCES_AGAIN_BETA, appReadsSourcesAgain } from "../../src/core/stromapp.ts";
import type { Media, Source, Task } from "../../src/core/model.ts";

const opts = { skip: !hasGit || process.platform === "win32", timeout: 240_000 };
const app = { Origin: "https://beta.stromapp.info" };
const BETA_APP = { STROM_APP_URL: "https://beta.stromapp.info/run/" };
const sha = (b: Uint8Array) => crypto.createHash("sha256").update(b).digest("hex");

// the reader: its report from a file; it waits while DOC_HOLD is there
const READER = `import fs from "node:fs";
const p = process.env.STROM_PROMPT ?? "";
const report = /Write your report to (.+) AS YOU GO/.exec(p)[1];
while (fs.existsSync(process.env.DOC_HOLD)) await new Promise((r) => setTimeout(r, 50));
const body = fs.readFileSync(process.env.DOC_FIRST, "utf8");
fs.writeFileSync(report, fs.readFileSync(report, "utf8").replace("<!-- next block -->", body.trim() + "\\n<!-- next block -->"));
fs.appendFileSync(process.env.DOC_SAW, p.includes("Ludmily") ? "saw-transcript\\n" : "no-transcript\\n");
console.log("cost: 0.10");
`;

const TEXT = "Křest Vojtěcha Lhotáka, syn Jiřího a Ludmily".normalize("NFD");
const entry = (transcript: string) => `## Document
kind: register.baptism
language: cs
legible: yes

## Entry e1 · page 1
transcript: ${transcript}
person: p1 | child | dítě | written=Vojtěch | given=Vojtěch | sex=M
event: BAPM | date=1850 | place=Lhota | persons=p1:principal

done: 1 entries`;

function request(method: string, url: string, body?: Uint8Array | string, headers: Record<string, string> = {}): Promise<{ status: number; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const data = typeof body === "string" ? Buffer.from(body) : body && Buffer.from(body);
    const req = http.request(url, { agent: false, method, headers: { ...(data ? { "Content-Length": String(data.length) } : {}), ...headers } }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (d: Buffer) => chunks.push(d));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks) }));
    });
    req.on("error", reject);
    req.end(data);
  });
}
const json = (r: { body: Buffer }) => JSON.parse(r.body.toString("utf8"));
const post = (url: string, body: unknown) => request("POST", url, JSON.stringify(body), { ...app, "Content-Type": "application/json" });
const src = (w: World, id: string) => Tree.open(w.cwd, w.env).get<Source>(id)!;
/** Who read, its seconds said as a whole number (read.readerState) and left out to compare. */
const whoOf = (who: { secs?: number }[] | undefined) => who?.map(({ secs, ...r }) => (assert.ok(Number.isInteger(secs), JSON.stringify(who)), r));

/** The transcript of a source as the research read it (a session's edit: a reader of a model nobody recorded). */
function readByResearch(w: World, id: string, transcript: string): void {
  const tree = Tree.open(w.cwd, w.env);
  tree.actor = "N0001";
  tree.withTreeLock(() => {
    tree.put({ ...tree.get<Source>(id)!, transcript: transcript.normalize("NFC"), updated: now() }, { op: "source.edit", targets: [id], summary: `${id} read by the research` });
    tree.commit(`${id} read by the research`);
  });
}

/**
 * A book of scans with four sources: S0001 a clip read by the research (its transcript confirmed by the user, spec 022),
 * S0002 a clip with a Cyrillic transcript, S0003 a clip without a transcript, S0004 a transcript without an image.
 */
async function sources(): Promise<World> {
  const w = await world();
  await w.ok(["lang", "cs"]);
  await w.ok(["person", "add", "Vojtěch /Lhoták/", "--sex", "M"]);
  await w.ok(["source", "add", "Křest Vojtěcha Lhotáka 1850", "--kind", "baptism", "--recordset", "B1", "--clip", "B1:2@0.1,0.2,0.5,0.1"]);
  readByResearch(w, "S0001", TEXT);
  await w.ok(["source", "add", "Křest Jiřího Lhotáka 1822", "--kind", "baptism", "--recordset", "B1", "--clip", "B1:3@0.1,0.3,0.6,0.1", "--transcript", "Войтех Лхотак, сын Иржи"]);
  await w.ok(["source", "add", "Oddací kniha Lhota", "--kind", "marriage", "--recordset", "B1", "--clip", "B1:1@0.1,0.1,0.5,0.2"]);
  await w.ok(["source", "add", "Vzpomínka tety Lhotákové", "--kind", "baptism", "--transcript", "Vojtěch se narodil v Lhotě."]);
  await w.ok(["source", "confirm", "S0001", "--txt", transcriptMark(TEXT.normalize("NFC"))], { env: { STROM_FOR_APP: "1" } });
  return w;
}

/** The SOUR block of a source in a GEDCOM text (from its 0 line to the next one). */
function block(ged: string, id: string): string {
  const at = ged.search(new RegExp(`^1 REFN ${id}\\r?$`, "mu"));
  assert.ok(at >= 0, id);
  const start = ged.lastIndexOf("\n0 ", at);
  const end = ged.indexOf("\n0 ", at);
  return ged.slice(start, end < 0 ? undefined : end);
}

test("the gate: 1 _STROM_ORIG Y only for an app that reads a source again — not released yet; its beta and development copies at once; an unknown version once released", () => {
  const prod = new Settings({}, {});
  const beta = new Settings(BETA_APP, {});
  assert.equal(APP_READS_SOURCES_AGAIN, undefined, "set from the app's release that reads a source again, never a beta's");
  assert.equal(APP_READS_SOURCES_AGAIN_BETA, undefined);
  assert.equal(appReadsSourcesAgain(prod, "3.25.0"), false);
  assert.equal(appReadsSourcesAgain(prod), false, "unknown version: off until released");
  assert.equal(appReadsSourcesAgain(beta, "3.25.0"), true, "another copy of the app at once");
  assert.equal(appReadsSourcesAgain(beta), true);
  assert.equal(appReadsSourcesAgain(prod, "3.26.0", "3.26.0"), true);
  assert.equal(appReadsSourcesAgain(prod, "3.25.9", "3.26.0"), false);
  assert.equal(appReadsSourcesAgain(prod, "3.26.0-beta.3", "3.26.0"), false, "a pre-release before the release");
  assert.equal(appReadsSourcesAgain(prod, undefined, "3.26.0"), true, "an unknown version once released: an older app skips the tag, loses nothing");
  assert.equal(appReadsSourcesAgain(beta, "3.26.0-beta.1", undefined, "3.26.0-beta.2"), false);
  assert.equal(appReadsSourcesAgain(beta, "3.26.0-beta.2", undefined, "3.26.0-beta.2"), true);
});

test("K3.3: 1 _STROM_ORIG Y on a source with its original here and a transcript — the Strom file and the bridge's; none for an older app, none in an archive", opts, async () => {
  const w = await sources();
  let started = false;
  try {
    const file = path.join(w.dir, "strom.ged");
    const ged = async (env: Record<string, string>) => {
      await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", file], { env });
      return fs.readFileSync(file, "utf8");
    };
    const beta = await ged(BETA_APP);
    assert.match(block(beta, "S0001"), /^1 _STROM_ORIG Y\r?$/mu, "a clip on its image here, a transcript (NFD as typed)");
    assert.match(block(beta, "S0002"), /^1 _STROM_ORIG Y\r?$/mu, "a Cyrillic transcript");
    assert.doesNotMatch(block(beta, "S0003"), /_STROM_ORIG/u, "no transcript to hold a reading against");
    assert.doesNotMatch(block(beta, "S0004"), /_STROM_ORIG/u, "no original here");
    assert.doesNotMatch(await ged({ STROM_APP_VERSION: "3.25.0" }), /_STROM_ORIG/u, "an app that does not read a source again");
    assert.doesNotMatch(await ged({ STROM_APP_VERSION: "" }), /_STROM_ORIG/u, "an unknown version: not released yet");
    // the standard file never
    await w.ok(["export", "gedcom", "--for", "standard", "--out", file]);
    assert.doesNotMatch(fs.readFileSync(file, "utf8"), /_STROM_ORIG/u);
    // the image gone from this computer: nothing to read again
    const m2 = Tree.open(w.cwd, w.env).get<Media>("M0002")!;
    const shared = new Settings(w.env, {}).shared()!.value;
    fs.renameSync(path.join(shared, m2.file), path.join(w.dir, "away.jpg"));
    assert.doesNotMatch(block(await ged(BETA_APP), "S0001"), /_STROM_ORIG/u);
    fs.renameSync(path.join(w.dir, "away.jpg"), path.join(shared, m2.file));

    // the bridge's file for the app's beta copy
    Object.assign(w.env, BETA_APP);
    const info = (await w.ok(["live", "start", "--json"])).json as { url: string };
    started = true;
    const tree = async () => (await request("GET", `${info.url}/tree.ged`, undefined, app)).body.toString("utf8");
    assert.match(block(await tree(), "S0001"), /^1 _STROM_ORIG Y\r?$/mu);
    // an archive: nothing to read again
    await w.ok(["mode", "archive"], { tty: true });
    await until("archive file", async () => !(await tree()).includes("_STROM_ORIG"), { ms: 20_000 });
    assert.doesNotMatch(await ged(BETA_APP), /_STROM_ORIG/u);
  } finally {
    if (started) await w.run(["live", "stop"]);
    w.cleanup();
  }
});

test("K2.1, K2.2, K3.1, K3.2: the readers to choose, with in POST /read and again, who read; POST /sources/read from the original — alike kept beside it, the user's confirmation stays; every refusal", opts, async () => {
  const w = await sources();
  const dir = path.join(w.dir, "čtení ž");
  fs.mkdirSync(dir);
  // another agent installed here (a stand-in: never started by the bridge)
  const bin = path.join(dir, "bin");
  fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, "codex"), `#!/bin/sh\necho "$@" >> "${path.join(dir, "codex.calls")}"\nexit 0\n`, { mode: 0o755 });
  // a PATH of its own: no agent of the computer the tests run on, git and node alone beside it
  fs.symlinkSync(spawnSync("which", ["git"], { encoding: "utf8" }).stdout.trim(), path.join(bin, "git"));
  fs.symlinkSync(process.execPath, path.join(bin, "node"));
  fs.writeFileSync(path.join(dir, "reader.mjs"), READER);
  fs.writeFileSync(path.join(dir, "first.md"), entry(TEXT.normalize("NFC")));
  Object.assign(w.env, {
    STROM_AGENT: "script",
    STROM_RUNNER_SCRIPT: path.join(dir, "reader.mjs"),
    DOC_FIRST: path.join(dir, "first.md"),
    DOC_HOLD: path.join(dir, "hold"),
    DOC_SAW: path.join(dir, "saw.log"),
    STROM_NO_CONVERT: "1",
    STROM_LIVE_POLL_MS: "150",
    PATH: bin,
  });
  // Codex's readers ended on its limit here a while ago: not ready until it resets
  const resets = new Date(Date.now() + 3600_000).toISOString();
  const reads = path.join(w.cwd, ".strom", "reads");
  fs.mkdirSync(reads, { recursive: true });
  const since = new Date(Date.now() - 60_000).toISOString();
  fs.writeFileSync(path.join(reads, "D20261019120000-aaaa.json"), JSON.stringify({ id: "D20261019120000-aaaa", state: "failed", version: 1, readers: 1, lang: "cs", agent: "codex", pages: [], groups: [], reports: [{ n: 1, group: 0, blind: false, version: 1, agent: "codex", outcome: "limit", resets }], at: since, since }));
  let started = false;
  try {
    const info = (await w.ok(["live", "start", "--json"])).json as { url: string };
    const url = info.url;
    started = true;
    const status = json(await request("GET", `${url}/status`, undefined, app));
    for (const f of ["read.choose", "read.source"]) {
      assert.ok(BRIDGE_FEATURES.includes(f as never), f);
      assert.ok(status.features.includes(f), f);
    }
    const choices = status.accepts.read.choices;
    assert.ok(choices, JSON.stringify(status.accepts.read));
    // the research's agent first, as its settings say (the agent's own model and effort); then the others installed here
    assert.equal(choices.agents[0].id, "script");
    assert.deepEqual(choices.default, [{ agent: "script", model: "", effort: "" }, { agent: "script", model: "", effort: "" }]);
    const codex = choices.agents.find((a: { id: string }) => a.id === "codex");
    assert.ok(codex, "an agent installed here may read");
    assert.deepEqual([codex.name, codex.ready, codex.why, codex.resets], ["OpenAI Codex CLI", false, "limit", resets]);
    assert.ok(codex.models.length > 1 && codex.models.some((m: { id: string }) => m.id === ""), "its models, and its own (\"\")");
    assert.ok(codex.efforts.includes("high"));
    assert.ok(codex.default.model, "another agent: never its own default (it may be a fast one)");
    assert.ok(!choices.agents.some((a: { id: string }) => a.id === "grok"), "an agent not installed: none");
    assert.equal(fs.existsSync(path.join(dir, "codex.calls")), false, "no agent started to list its models");

    // the file to read
    const photo = jpegWithOrientation(halves(1600, 1200), 1);
    assert.equal((await request("PUT", `${url}/media/${sha(photo)}`, photo, { ...app, "Content-Type": "application/octet-stream", "X-Strom-Read": "1" })).status, 200);
    const refused = async (at: string, body: unknown) => {
      const r = await post(`${url}/${at}`, body);
      return [r.status, json(r).code, json(r).at, json(r).field ?? json(r).why];
    };
    const files = [sha(photo)];
    assert.deepEqual(await refused("read", { files, with: [{ agent: "nikdo-ž" }] }), [400, "read.with", "0", "agent"]);
    assert.deepEqual(await refused("read", { files, readers: 2, with: [{}, { agent: "codex", model: "model-б" }] }), [400, "read.with", "1", "model"]);
    assert.deepEqual(await refused("read", { files, with: [{ agent: "script", effort: "nejvíc" }] }), [400, "read.with", "0", "effort"]);
    assert.deepEqual(await refused("read", { files, with: [{ agent: "codex" }] }), [409, "read.agent", "0", "limit"]);
    assert.deepEqual((await refused("read", { files, with: "codex" })).slice(0, 2), [400, "read.bad-body"]);
    assert.deepEqual((await refused("read", { files, with: [{}, {}] })).slice(0, 2), [400, "read.bad-body"], "one reader asked, two said");
    assert.ok(!fs.readdirSync(reads).some((f) => f !== "D20261019120000-aaaa.json" && f.endsWith(".json")), "nothing queued");

    // read with the reader chosen: who read in the result, /status reads and /reads
    const asked = await post(`${url}/read`, { files, lang: "cs", with: [{ agent: "script" }] });
    assert.equal(asked.status, 202, asked.body.toString());
    const id = json(asked).read;
    await until("read", async () => json(await request("GET", `${url}/read/${id}`, undefined, app)).state === "done", { ms: 60_000 });
    const result = json(await request("GET", `${url}/read/${id}`, undefined, app));
    assert.deepEqual(whoOf(result.readers.who), [{ agent: "script", name: "script", state: "done" }]);
    const listed = json(await request("GET", `${url}/reads`, undefined, app)).reads.find((r: { id: string }) => r.id === id);
    assert.deepEqual(whoOf(listed.who), [{ agent: "script", name: "script", state: "done" }]);
    const inStatus = json(await request("GET", `${url}/status`, undefined, app)).reads.find((r: { id: string }) => r.id === id);
    assert.deepEqual(whoOf(inStatus?.who), [{ agent: "script", name: "script", state: "done" }]);
    // again: the same refusals
    assert.deepEqual(await refused(`read/${id}/again`, { with: [{ agent: "codex" }] }), [409, "read.agent", "0", "limit"]);
    assert.deepEqual(await refused(`read/${id}/again`, { with: [{ model: "model-á" }] }), [400, "read.with", "0", "model"]);

    // a source read again from its original
    const s1 = src(w, "S0001");
    assert.ok(confirmedOn(s1));
    const ask = (body: unknown) => post(`${url}/sources/read`, body);
    for (const bad of [{}, { source: "P0001" }, { source: "S0001", clip: "x" }, { source: "S0001", readers: 3 }]) {
      const r = await ask(bad);
      assert.deepEqual([r.status, json(r).code], [400, "read.bad-body"], JSON.stringify(bad));
    }
    assert.deepEqual(await refused("sources/read", { source: "S0099" }).then((r) => r.slice(0, 2)), [404, "read.source.none"]);
    assert.deepEqual(await refused("sources/read", { source: "S0003" }).then((r) => r.slice(0, 2)), [409, "read.source.notext"]);
    assert.deepEqual(await refused("sources/read", { source: "S0004" }).then((r) => r.slice(0, 2)), [409, "read.source.noscan"]);
    assert.deepEqual(await refused("sources/read", { source: "S0001", clip: "c0000000000" }).then((r) => r.slice(0, 2)), [409, "read.source.noscan"]);
    assert.deepEqual(await refused("sources/read", { source: "S0001", with: [{ agent: "codex" }] }), [409, "read.agent", "0", "limit"]);
    assert.deepEqual(await refused("sources/read", { source: "S0001", with: [{ agent: "nikdo" }] }), [400, "read.with", "0", "agent"]);

    fs.writeFileSync(path.join(dir, "hold"), "");
    const again = await ask({ source: "s0001", with: [{ agent: "script" }] });
    assert.equal(again.status, 202, again.body.toString());
    const a = json(again);
    assert.deepEqual([a.state, a.version, a.source], ["queued", 1, "S0001"]);
    // read again now: once at a time
    await until("reading", async () => (json(await request("GET", `${url}/status`, undefined, app)).reads ?? []).some((r: { id: string; state: string }) => r.id === a.read && r.state === "reading"), { ms: 30_000 });
    const busy = await ask({ source: "S0001" });
    assert.deepEqual([busy.status, json(busy).code, json(busy).read], [409, "read.source.running", a.read]);
    const reading = json(await request("GET", `${url}/status`, undefined, app)).reads.find((r: { id: string }) => r.id === a.read);
    assert.equal(reading.source, "S0001");
    fs.rmSync(path.join(dir, "hold"));
    await until("read again", async () => json(await request("GET", `${url}/read/${a.read}`, undefined, app)).state === "done", { ms: 60_000 });
    const done = json(await request("GET", `${url}/read/${a.read}`, undefined, app));
    assert.deepEqual(done.source, { id: "S0001", entries: ["e1"], agree: "same", variants: [], taskSetting: "ask", taskOffer: false }, "alike: nothing to decide (read.sourceTask as the research says)");
    assert.deepEqual(whoOf(done.readers.who), [{ agent: "script", name: "script", state: "done" }]);
    assert.ok(fs.readFileSync(path.join(dir, "saw.log"), "utf8").trim().split("\n").every((l) => l === "no-transcript"), "never shown the transcript");
    const after = src(w, "S0001");
    assert.deepEqual(after.readings, [a.read], "kept beside the source");
    assert.equal(after.transcript, s1.transcript);
    assert.deepEqual(after.read, s1.read, "the user's confirmation of spec 022 stays");
    assert.equal(fs.existsSync(path.join(dir, "codex.calls")), false, "Codex never started");

    // read.sourceTask: an app that offers the person the choice (taskChoice) — a matter of fact both readers are sure of
    // makes no task (read.sourceTask ask, the default); the result says it is offered, POST /sources/<S>/read/<D>/task
    // takes the person's word (the app's ZADANI_DEV_ukol-z-cteni.md)
    assert.ok(status.features.includes("read.sourceTask"));
    assert.ok(!status.features.includes("read.taskChoice"), "the old name: none");
    assert.equal(status.accepts.read.sourceTask, "ask");
    assert.equal(status.readAgain?.S0001, undefined, "read again alike: nothing to say");
    const readAgain = async () => json(await request("GET", `${url}/status`, undefined, app)).readAgain;
    const sourceOf = async (read: string) => json(await request("GET", `${url}/read/${read}`, undefined, app)).source;
    const readAgainOf = async (source: string, text: string, taskChoice = true) => {
      fs.writeFileSync(path.join(dir, "first.md"), entry(text));
      const r = json(await ask({ source, ...(taskChoice ? { taskChoice: true } : {}), with: [{ agent: "script" }] }));
      await until(`read again ${source}`, async () => json(await request("GET", `${url}/read/${r.read}`, undefined, app)).state === "done", { ms: 60_000 });
      return r.read as string;
    };
    const decide = (source: string, read: string, body: unknown) => post(`${url}/sources/${source}/read/${read}/task`, body);
    const said = async (r: Promise<{ status: number; body: Buffer }>) => {
      const got = await r;
      return [got.status, json(got).code, json(got).task];
    };

    // S0001: a transcript the person confirmed — never an agent's task: review proposes the wording, the person decides
    const offered = await readAgainOf("S0001", TEXT.replace("Ludmily".normalize("NFD"), "Anny"));
    const waits = await sourceOf(offered);
    assert.deepEqual([waits.agree, waits.taskSetting, waits.taskOffer, waits.task, waits.openTask, waits.decided], ["differ", "ask", true, undefined, undefined, undefined], JSON.stringify(waits));
    for (const old of ["taskWith", "offer", "waits"]) assert.equal(old in waits, false, old);
    assert.deepEqual(waits.state, { read: offered, state: "unchecked" });
    assert.deepEqual((await readAgain()).S0001, { read: offered, state: "unchecked" });
    assert.equal((await post(`${url}/sources/reading`, { source: "S0001", take: "now" })).status, 404, "the old address: none");
    for (const bad of [{}, { how: "later" }, { how: "keep" }, { how: "now", reading: offered }, "now"]) {
      assert.deepEqual((await said(decide("S0001", offered, bad))).slice(0, 2), [400, "read.decide.invalid"], JSON.stringify(bad));
    }
    assert.deepEqual((await said(decide("S0001", "D1", { how: "now" }))).slice(0, 2), [400, "read.decide.invalid"]);
    assert.deepEqual((await said(decide("S0099", offered, { how: "now" }))).slice(0, 2), [404, "read.decide.none"]);
    assert.deepEqual((await said(decide("S0001", "D20261019120000-aaaa", { how: "now" }))).slice(0, 2), [404, "read.decide.noreading"]);
    assert.deepEqual((await said(decide("S0001", offered, { how: "now" }))).slice(0, 2), [409, "read.decide.confirmed"]);
    assert.deepEqual((await said(decide("S0001", offered, { how: "queue" }))).slice(0, 2), [409, "read.decide.confirmed"]);
    const reviewed = await decide("S0001", offered, { how: "review" });
    assert.equal(reviewed.status, 200, reviewed.body.toString());
    const rv = json(reviewed);
    assert.deepEqual([rv.ok, rv.source, rv.reading, rv.how, rv.taskFor, rv.chat, rv.take, rv.places], [true, "S0001", offered, "review", "person", undefined, undefined, undefined], JSON.stringify(rv));
    assert.ok(rv.head && rv.parent && rv.head !== rv.parent);
    const proposal = Tree.open(w.cwd, w.env).get<Task>(rv.task)!;
    assert.deepEqual([proposal.origin, proposal.state, proposal.proposal?.reading], ["transcript:proposal", "waiting", offered]);
    assert.equal(proposal.proposal?.text, TEXT.replace("Ludmily".normalize("NFD"), "Anny").normalize("NFC"));
    assert.equal(src(w, "S0001").transcript, s1.transcript, "the confirmed transcript stays");
    assert.deepEqual(src(w, "S0001").read, s1.read);
    const inReview = (await readAgain()).S0001;
    assert.deepEqual({ ...inReview, proposal: undefined }, { read: offered, state: "task", task: rv.task, taskFor: "person", taskOpen: true, taskQueued: false, proposal: undefined });
    assert.deepEqual([inReview.proposal.text, inReview.proposal.task, inReview.proposal.by, typeof inReview.proposal.at], [proposal.proposal!.text, rv.task, "script", "string"]);
    const reviewedResult = await sourceOf(offered);
    assert.deepEqual([reviewedResult.taskOffer, reviewedResult.task, reviewedResult.taskFor], [false, rv.task, "person"]);
    assert.deepEqual(reviewedResult.state, inReview);
    assert.deepEqual(await said(decide("S0001", offered, { how: "save" })), [409, "read.decide.task", rv.task], "decided: asked no more");

    // S0002, nobody confirmed it: just kept, then now (a conversation), then queue into the task not ended
    const kept = await readAgainOf("S0002", "Войтех Лготак, сын Иржи");
    assert.deepEqual((await said(decide("S0002", kept, { how: "review" }))).slice(0, 2), [409, "read.decide.unconfirmed"]);
    const save = json(await decide("S0002", kept, { how: "save" }));
    assert.deepEqual([save.ok, save.how, save.task, save.chat], [true, "save", undefined, undefined], JSON.stringify(save));
    const saved = await sourceOf(kept);
    assert.deepEqual([saved.decided, saved.taskOffer, saved.task], ["saved", false, undefined]);
    assert.deepEqual((await readAgain()).S0002, { read: kept, state: "saved" });
    const later = await readAgainOf("S0002", "Войтех Лготак, сын Ирже");
    const now = await decide("S0002", later, { how: "now" });
    assert.equal(now.status, 200, now.body.toString());
    const took = json(now);
    assert.deepEqual([took.source, took.reading, took.how, took.taskFor, took.appended], ["S0002", later, "now", "agent", undefined]);
    assert.match(took.chat, new RegExp(`^strom-research://task\\?tree=[^&]+&task=${took.task}&do=chat$`, "u"));
    assert.deepEqual((await readAgain()).S0002, { read: later, state: "task", task: took.task, taskFor: "agent", taskOpen: true, taskQueued: false });
    const open = await readAgainOf("S0002", "Войтех Лготак, сын Ирже, Лхота Лготак");
    const pending = await sourceOf(open);
    assert.deepEqual([pending.taskOffer, pending.openTask, pending.task], [true, took.task, undefined], JSON.stringify(pending));
    const why = Tree.open(w.cwd, w.env).get<Task>(took.task)!.why;
    const queued = json(await decide("S0002", open, { how: "queue" }));
    assert.deepEqual([queued.how, queued.task, queued.appended, queued.taskFor], ["queue", took.task, true, "agent"], JSON.stringify(queued));
    assert.notEqual(Tree.open(w.cwd, w.env).get<Task>(took.task)!.why, why, "the new places said in it");
    assert.equal(Tree.open(w.cwd, w.env).list<Task>("task").filter((t) => t.origin === "read:source").length, 1, "one task of the source");

    // an older app (no taskChoice): read.sourceTask always for it — on the confirmed S0001 the new wording goes into the
    // person's proposal waiting, never an agent's task
    const old = await readAgainOf("S0001", TEXT.replace("Ludmily".normalize("NFD"), "Anny").replace("Jiřího".normalize("NFD"), "Josefa"), false);
    const held = await sourceOf(old);
    assert.deepEqual([held.taskSetting, held.task, held.taskFor, held.appended, held.taskOffer], ["always", rv.task, "person", true, false], JSON.stringify(held));
    assert.match((await readAgain()).S0001.proposal.text, /Josefa/u);
    assert.match((await readAgain()).S0001.proposal.text, /Anny/u);

    // what a reading again becomes, as the app sets it
    const set = async (body: unknown) => {
      const r = await post(`${url}/sourceTask`, body);
      return [r.status, json(r)] as const;
    };
    const [st, never] = await set({ sourceTask: "never" });
    assert.deepEqual([st, never.ok, never.sourceTask], [200, true, "never"]);
    assert.notEqual(never.head, never.parent);
    assert.equal(json(await request("GET", `${url}/status`, undefined, app)).accepts.read.sourceTask, "never");
    const [, same] = await set({ sourceTask: "never" });
    assert.equal(same.head, same.parent, "the same again: nothing written");
    for (const bad of [{}, { sourceTask: "sometimes" }, { sourceTask: "ask", also: 1 }]) {
      const [code, body] = await set(bad);
      assert.deepEqual([code, body.code], [400, "sourceTask.invalid"], JSON.stringify(bad));
    }
    await w.ok(["mode", "archive"], { tty: true });
    const [archived, refusal] = await set({ sourceTask: "ask" });
    assert.deepEqual([archived, refusal.code], [409, "sourceTask.archive"]);
    const inArchive = json(await request("GET", `${url}/status`, undefined, app));
    assert.equal(inArchive.readAgain, undefined, "an archive: no readings again said");
    assert.equal(inArchive.accepts?.read?.sourceTask, undefined);
  } finally {
    if (started) await w.run(["live", "stop"]);
    w.cleanup();
  }
});

test("without Claude Code in the terminal (Claude's app alone): no choices, POST /read and /sources/read refused with agent.cli-missing, nothing started", opts, async () => {
  const w = new World();
  let started = false;
  try {
    const apps = path.join(w.dir, "Applications");
    fs.mkdirSync(path.join(apps, "Claude.app"), { recursive: true });
    const bin = path.join(w.dir, "bin");
    fs.mkdirSync(bin);
    const git = spawnSync("which", ["git"], { encoding: "utf8" }).stdout.trim();
    fs.symlinkSync(git, path.join(bin, "git"));
    Object.assign(w.env, { STROM_APP_DIRS: apps, PATH: bin });
    await w.ok(["setup", "--yes", "--lang", "cs"]);
    await w.ok(["init", "Lhotákovi"]);
    w.cwd = w.treeDir("Lhotákovi");
    await w.ok(["source", "add", "Vzpomínka tety Lhotákové", "--kind", "baptism", "--transcript", "Vojtěch se narodil v Lhotě."]);
    const url = ((await w.ok(["live", "start", "--json"])).json as { url: string }).url;
    started = true;
    const read = json(await request("GET", `${url}/status`, undefined, app)).accepts.read;
    assert.deepEqual([read.ready, read.why, read.choices], [false, "agent.cli-missing", undefined]);
    for (const [at, body] of [["sources/read", { source: "S0001" }], ["read", { files: ["c".repeat(64)] }]] as const) {
      const r = await post(`${url}/${at}`, body);
      assert.deepEqual([r.status, json(r).code, json(r).params], [503, "read.not-ready", { why: "agent.cli-missing" }], at);
    }
    assert.equal(fs.existsSync(path.join(w.cwd, ".strom", "reads")), false, "nothing queued");
  } finally {
    if (started) await w.run(["live", "stop"]);
    w.cleanup();
  }
});
