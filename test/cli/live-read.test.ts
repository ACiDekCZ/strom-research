// A document read at once for the Strom app, through the bridge, with a made-up reader (the script runner): its files
// sent as inputs with no intake task (X-Strom-Read: 1), the reading asked (POST /read), followed (/status reads, the
// event read, GET /read/<id>, each page's picture), read again, cancelled; read one at a time, three more queued, the
// rest refused; at most so many an hour (read.app, raised by the person alone); never in an archive; no reader here:
// said why, nothing asked.

import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { World, hasGit, until } from "../helpers.ts";
import { halves, jpegWithOrientation } from "../image-samples.ts";
import { Tree } from "../../src/core/tree.ts";
import { Settings } from "../../src/core/config.ts";
import { appReadLimits, limitReached, noteAsked, readAccepts } from "../../src/core/live-read.ts";

const opts = { skip: !hasGit || process.platform === "win32" };
const app = { Origin: "https://beta.stromapp.info" };
const sha = (b: Uint8Array) => crypto.createHash("sha256").update(b).digest("hex");

// the reader: its report from a file; it waits while DOC_HOLD is there, and notes when it began and ended
const READER = `import fs from "node:fs";
const p = process.env.STROM_PROMPT ?? "";
const report = /Write your report to (.+) AS YOU GO/.exec(p)[1];
const blind = p.includes("This is a BLIND reading");
fs.appendFileSync(process.env.DOC_MARK, "start " + (blind ? "blind" : "first") + "\\n");
while (fs.existsSync(process.env.DOC_HOLD)) await new Promise((r) => setTimeout(r, 50));
// the blind reader's own report where the test wrote one beside the first's
const own = process.env.DOC_FIRST + ".blind";
const body = fs.readFileSync(blind && fs.existsSync(own) ? own : process.env.DOC_FIRST, "utf8");
fs.writeFileSync(report, fs.readFileSync(report, "utf8").replace("<!-- next block -->", body.trim() + "\\n<!-- next block -->"));
fs.appendFileSync(process.env.DOC_MARK, "end\\n");
console.log("cost: 0.25");
`;

const FIRST = `## Document
kind: register.baptism
language: la
legible: yes

## Entry e1 · page 1
region: 0.05,0.30,0.90,0.20
transcript: 3. Aprilis 1846 | Joannes filius | Josephi Novák agricolae | in Lhota
translation: 3. dubna 1846 Jan, syn Josefa Nováka, rolníka
person: p1 | child | dítě | written=Joannes | given=Jan | sex=M | region=0.06,0.34,0.20,0.03
person: p2 | father | otec | written=Josephi Novák | given=Josef | surname=Novák | sex=M
event: BAPM | date=3.4.1846 | place=Lhota | persons=p1:principal,p2:father | region=0.05,0.30,0.40,0.03
relation: parent p2 p1

## Context
context: Zápis křtu.

done: 1 entries`;

function request(method: string, url: string, body?: Uint8Array | string, headers: Record<string, string> = {}): Promise<{ status: number; body: Buffer; headers: http.IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    const data = typeof body === "string" ? Buffer.from(body) : body && Buffer.from(body);
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

/** The events of the bridge as they come. */
function listen(url: string): { events: { event: string; data: any }[]; close: () => void } {
  const events: { event: string; data: any }[] = [];
  let buf = "";
  const req = http.get(`${url}/events`, { headers: app }, (res) => {
    res.on("data", (d: Buffer) => {
      buf += d.toString("utf8");
      for (let i = buf.indexOf("\n\n"); i >= 0; i = buf.indexOf("\n\n")) {
        const block = buf.slice(0, i);
        buf = buf.slice(i + 2);
        const event = /^event: (.+)$/m.exec(block)?.[1];
        const data = /^data: (.+)$/m.exec(block)?.[1];
        if (event && data) events.push({ event, data: JSON.parse(data) });
      }
    });
  });
  req.on("error", () => {});
  return { events, close: () => req.destroy() };
}

async function setUp(env: Record<string, string> = {}) {
  const w = new World();
  await w.withTree();
  await w.ok(["lang", "cs"]);
  await w.ok(["person", "add", "Josef /Novák/", "--sex", "M", "--born", "1815"]); // P0001
  const dir = path.join(w.dir, "čtení");
  fs.mkdirSync(dir);
  fs.writeFileSync(path.join(dir, "reader.mjs"), READER);
  fs.writeFileSync(path.join(dir, "first.md"), FIRST);
  Object.assign(w.env, {
    STROM_AGENT: "script",
    STROM_RUNNER_SCRIPT: path.join(dir, "reader.mjs"),
    DOC_FIRST: path.join(dir, "first.md"),
    DOC_MARK: path.join(dir, "readers.log"),
    DOC_HOLD: path.join(dir, "hold"),
    STROM_NO_CONVERT: "1",
    STROM_LIVE_POLL_MS: "150",
    ...env,
  });
  const info = (await w.ok(["live", "start", "--json"])).json;
  return { w, dir, url: info.url as string };
}

const marks = (dir: string) => (fs.existsSync(path.join(dir, "readers.log")) ? fs.readFileSync(path.join(dir, "readers.log"), "utf8").trim().split("\n") : []);

test("a document read for the Strom app: sent with no intake task, asked, followed (status, the event read, its result and page), read again by a blind second reader, its cost in the month", opts, async () => {
  const { w, dir, url } = await setUp();
  const events = listen(url);
  try {
    const status = json(await request("GET", `${url}/status`));
    assert.ok(status.features.includes("read.now"));
    const read = status.accepts.read;
    assert.equal(read.ready, true, JSON.stringify(read));
    assert.equal(read.why, null);
    assert.equal(read.readers, 2);
    assert.deepEqual(read.types, ["image/jpeg", "image/png"], "nothing converted here (STROM_NO_CONVERT)");
    assert.deepEqual([read.max, read.pages], [50 * 1024 * 1024, 10]);
    assert.deepEqual(read.langs, ["cs", "de", "en"]);
    assert.deepEqual(status.reads, []);

    // the file: an input of the person, no intake task
    const photo = jpegWithOrientation(halves(1600, 1200), 6);
    const put = (h: Record<string, string>) => request("PUT", `${url}/media/${sha(photo)}`, photo, { ...app, "Content-Type": "application/octet-stream", ...h });
    assert.deepEqual([(await put({ "X-Strom-Read": "yes" })).status, json(await put({ "X-Strom-Read": "yes" })).code], [400, "media.bad-header"]);
    assert.equal(json(await put({ "X-Strom-Read": "1", "X-Strom-Task": "T0001" })).code, "media.bad-header", "a file to read comes for no task");
    const sent = await put({ "X-Strom-Read": "1", "X-Strom-Name": encodeURIComponent("křest Jana.jpg"), "X-Strom-Person": "P0001" });
    assert.equal(sent.status, 200, sent.body.toString());
    const got = json(sent);
    assert.match(got.input, /^I\d{4}$/);
    assert.equal(got.task, undefined, "no intake task: the reading is what it is for");
    assert.deepEqual((await w.ok(["task", "list", "--json"])).json.tasks.filter((t: { level: string }) => t.level === "intake"), []);

    // refused: not the app's, not a body, not a file of the research, a language strom has not, a person it has not
    const r403 = await request("POST", `${url}/read`, JSON.stringify({ files: [sha(photo)] }));
    assert.deepEqual([r403.status, json(r403).code], [403, "app.only"]);
    const refused = async (body: unknown) => {
      const r = await post(`${url}/read`, body);
      return [r.status, json(r).code, json(r).params];
    };
    assert.deepEqual(await refused({ files: "x" }), [400, "read.bad-body", undefined]);
    assert.deepEqual(await refused({ files: [sha(photo)], readers: 3 }), [400, "read.bad-body", undefined]);
    assert.deepEqual(await refused({ files: ["c".repeat(64)] }), [404, "read.no-file", { sha: "c".repeat(64) }]);
    assert.deepEqual(await refused({ files: [sha(photo)], lang: "xx" }), [400, "read.lang", { lang: "xx" }]);
    assert.deepEqual(await refused({ files: [sha(photo)], person: "P0099" }), [404, "read.no-person", { person: "P0099" }]);
    assert.deepEqual(await refused({ files: [sha(photo), sha(photo)], region: [0, 0, 1, 1] }), [400, "read.region", undefined]);
    assert.deepEqual(await refused({ files: Array(11).fill(sha(photo)) }), [413, "read.pages", { pages: "10" }]);

    const asked = await post(`${url}/read`, { files: [sha(photo)], lang: "cs", person: "p1", note: "rub fotky od tety" });
    assert.equal(asked.status, 202, asked.body.toString());
    const id = json(asked).read;
    assert.match(id, /^D\d{14}-[0-9a-f]{4}$/);
    assert.equal(json(asked).state, "queued");
    await until("read", async () => json(await request("GET", `${url}/read/${id}`)).state === "done", { ms: 60_000 });
    const result = json(await request("GET", `${url}/read/${id}`));
    assert.equal(result.entries.length, 1);
    assert.equal(result.entries[0].persons[1].match[0].person, "P0001");
    // where each person's name and the event stand: the app's picture of each (K2.1); none said, none given
    assert.deepEqual(result.entries[0].persons.map((p: { region?: number[] }) => p.region), [[0.06, 0.34, 0.2, 0.03], undefined]);
    assert.deepEqual(result.entries[0].events[0].region, [0.05, 0.3, 0.4, 0.03]);
    assert.deepEqual(result.persons, ["P0001"]);
    assert.equal(result.note, "rub fotky od tety");
    assert.equal(result.pages[0].image, `read/${id}/page/1.jpg`);
    assert.deepEqual([result.pages[0].w, result.pages[0].h], [1200, 1600], "upright");
    const page = await request("GET", `${url}/${result.pages[0].image}`);
    assert.equal(page.status, 200);
    assert.equal(page.headers["content-type"], "image/jpeg");
    assert.deepEqual([...page.body.subarray(0, 2)], [0xff, 0xd8]);
    assert.equal((await request("GET", `${url}/read/${id}/page/2.jpg`)).status, 404);
    assert.equal(json(await request("GET", `${url}/read/D20200101000000-abcd`)).code, "read.none");

    const after = json(await request("GET", `${url}/status`));
    const shown = after.reads.find((r: { id: string }) => r.id === id);
    assert.deepEqual({ ...shown, at: undefined, since: undefined }, { id, state: "done", version: 1, at: undefined, since: undefined, files: 1, pages: 1, readers: 1, done: 1, entries: 1, name: "křest Jana.jpg", person: "P0001", from: "app" });
    assert.deepEqual(after.spend.reads, { count: 1, amount: 0.25 });
    assert.equal(after.spend.amount, 0.25);
    const listed = json(await request("GET", `${url}/reads`)).reads;
    assert.deepEqual(listed.map((r: { id: string; inSource: boolean }) => [r.id, r.inSource]), [[id, false]]);
    // the input says it was read
    assert.deepEqual((await w.ok(["input", "show", got.input, "--json"])).json.input.read, [id]);

    // the event read: as it was queued, read, done — in that order; a phase shorter than the bridge's tick may go
    // unsent (queued straight to done), the last state always comes
    await until("the events", () => events.events.some((e) => e.event === "read" && e.data.id === id && e.data.state === "done"), { ms: 10_000 });
    const states = events.events.filter((e) => e.event === "read" && e.data.id === id).map((e) => e.data.state);
    const order = ["queued", "reading", "done"];
    assert.ok(states.every((s) => order.includes(s)), states.join(","));
    assert.ok(states.every((s, i) => i === 0 || order.indexOf(states[i - 1]) <= order.indexOf(s)), states.join(","));
    assert.equal(states.at(-1), "done", states.join(","));

    // again: the blind second reader alone — it gives the father another role (other), the rest alike
    fs.writeFileSync(path.join(dir, "first.md.blind"), FIRST.replace("person: p2 | father | otec |", "person: p2 | other |"));
    const again = await post(`${url}/read/${id}/again`, { readers: 2 });
    assert.equal(again.status, 202, again.body.toString());
    assert.deepEqual([json(again).read, json(again).version], [id, 2]);
    await until("read again", async () => json(await request("GET", `${url}/read/${id}`)).state === "done", { ms: 60_000 });
    const twice = json(await request("GET", `${url}/read/${id}`));
    assert.deepEqual([twice.version, twice.readers.asked, twice.readers.ran], [2, 2, 2]);
    assert.deepEqual(marks(dir), ["start first", "end", "start blind", "end"]);
    // the role the blind reader gave is no words of the transcript: the app is given it at the person, never as a
    // variant (it would mark "other" inside a word of the transcript); the research's result and show keep it
    assert.equal(twice.readers.agree, "differ");
    assert.deepEqual(twice.entries[0].variants, undefined);
    assert.deepEqual(twice.entries[0].persons.map((p: { ref: string; role: string; blindRole?: string }) => [p.ref, p.role, p.blindRole]), [["p1", "child", undefined], ["p2", "father", "other"]]);
    const kept = (await w.ok(["document", "show", id, "--json"])).json;
    assert.deepEqual(kept.entries[0].variants, [{ field: "p2.role", at: "father", other: "other" }]);
    assert.equal(kept.entries[0].persons[1].blindRole, undefined);
    assert.match((await w.ok(["document", "show", id])).out, /differs \(p2\.role\): "father" \/ blind reader "other"/u);
    // cancelled when it is read no more: nothing to stop
    assert.deepEqual(json(await post(`${url}/read/${id}/cancel`, {})), { read: id, state: "done", cancelled: false });
    // a reading of the research itself: shown, never read again or cancelled through the bridge
    const own = (await w.ok(["document", "read", got.input, "--json"])).json;
    assert.equal(json(await post(`${url}/read/${own.id}/again`, {})).code, "read.none");
    const all = json(await request("GET", `${url}/status`)).reads;
    assert.equal(all.find((r: { id: string }) => r.id === own.id).from, "research");
    // an archive (the person's choice): none of its readings any more, however read — the app shows its sources' words
    await w.ok(["mode", "archive"], { tty: true });
    for (const u of [`read/${id}`, `read/${id}/page/1.jpg`, `read/${own.id}`, "reads"]) {
      const r = await request("GET", `${url}/${u}`);
      assert.deepEqual([r.status, json(r).code], [404, "read.none"], u);
    }
  } finally {
    events.close();
    await w.run(["live", "stop"]);
    w.cleanup();
  }
});

test("readings of the app one at a time: three more queued, the next refused; one queued cancelled is never read; at most so many an hour", opts, async () => {
  const { w, dir, url } = await setUp();
  try {
    const photo = jpegWithOrientation(halves(1600, 1200), 1);
    assert.equal((await request("PUT", `${url}/media/${sha(photo)}`, photo, { ...app, "X-Strom-Read": "1" })).status, 200);
    fs.writeFileSync(path.join(dir, "hold"), "");
    // five at once: four taken (one read, three queued), the fifth refused
    const asked = await Promise.all(Array.from({ length: 5 }, () => post(`${url}/read`, { files: [sha(photo)] })));
    const codes = asked.map((r) => r.status).sort();
    assert.deepEqual(codes, [202, 202, 202, 202, 429], asked.map((r) => r.body.toString()).join("\n"));
    const full = asked.find((r) => r.status === 429)!;
    assert.deepEqual([json(full).code, json(full).params.per, full.headers["retry-after"]], ["read.limit", "queue", "60"]);
    const ids = asked.filter((r) => r.status === 202).map((r) => json(r).read as string);
    assert.equal(new Set(ids).size, 4);
    await until("one being read", () => marks(dir).length === 1, { ms: 30_000 });
    const reads = () => request("GET", `${url}/status`).then((r) => json(r).reads as { id: string; state: string }[]);
    const now = await reads();
    assert.equal(now.filter((r) => r.state === "reading").length, 1, JSON.stringify(now));
    assert.equal(now.filter((r) => r.state === "queued").length, 3, JSON.stringify(now));
    // one waiting cancelled: never read
    const waiting = now.find((r) => r.state === "queued")!.id;
    const cancelled = await post(`${url}/read/${waiting}/cancel`, {});
    assert.deepEqual([cancelled.status, json(cancelled)], [200, { read: waiting, state: "cancelled", cancelled: true }]);
    fs.rmSync(path.join(dir, "hold"));
    await until("all read", async () => (await reads()).every((r) => ["done", "cancelled"].includes(r.state)), { ms: 90_000 });
    const end = await reads();
    assert.equal(end.find((r) => r.id === waiting)!.state, "cancelled");
    assert.equal(end.filter((r) => r.state === "done").length, 3);
    // the month's readings: the three read, never the one cancelled while queued
    assert.deepEqual(json(await request("GET", `${url}/status`)).spend.reads, { count: 3, amount: 0.75 });
    // one at a time: each reader ended before the next began
    assert.deepEqual(marks(dir), ["start first", "end", "start first", "end", "start first", "end"]);
    assert.match(fs.readFileSync(path.join(w.cwd, ".strom", "live.log"), "utf8"), /POST \/…\/read → 202 · read D\d{14}-[0-9a-f]{4}, state queued/u);

    // at most so many an hour: lowered by anyone (no question), the next past it refused, with when to ask again
    await w.ok(["config", "set", "read.app", "5 60"], { tty: true, answers: [] });
    assert.equal((await post(`${url}/read`, { files: [sha(photo)] })).status, 202);
    await until("read", async () => (await reads()).every((r) => ["done", "cancelled"].includes(r.state)), { ms: 60_000 });
    const over = await post(`${url}/read`, { files: [sha(photo)] });
    assert.equal(over.status, 429);
    assert.deepEqual([json(over).code, json(over).params], ["read.limit", { per: "hour", most: "5" }]);
    assert.ok(Number(over.headers["retry-after"]) > 3000 && Number(over.headers["retry-after"]) <= 3600, String(over.headers["retry-after"]));
  } finally {
    await w.run(["live", "stop"]);
    w.cleanup();
  }
});

test("a file the research has already, sent to be read: its reading shown under the name it came with last, else its record's own — never its hash", opts, async () => {
  const { w, url } = await setUp();
  try {
    await w.ok(["source", "add", "Křest", "--kind", "baptism"]); // S0001
    const readName = async (photo: Uint8Array, h: Record<string, string>) => {
      const sent = await request("PUT", `${url}/media/${sha(photo)}`, photo, { ...app, "X-Strom-Read": "1", ...h });
      assert.equal(sent.status, 200, sent.body.toString());
      const asked = await post(`${url}/read`, { files: [sha(photo)] });
      assert.equal(asked.status, 202, asked.body.toString());
      const id = json(asked).read as string;
      await until("read", async () => json(await request("GET", `${url}/read/${id}`)).state === "done", { ms: 60_000 });
      const status = json(await request("GET", `${url}/status`)).reads.find((r: { id: string }) => r.id === id).name;
      const listed = json(await request("GET", `${url}/reads`)).reads.find((r: { id: string }) => r.id === id).name;
      const page = json(await request("GET", `${url}/read/${id}`)).pages[0].name;
      assert.deepEqual([listed, page], [status, status]);
      return status as string;
    };

    // an image of a source the app sent before: known as that image (M…)
    const scan = jpegWithOrientation(halves(1600, 1200), 1);
    const first = await request("PUT", `${url}/media/${sha(scan)}`, scan, { ...app, "X-Strom-Name": encodeURIComponent("matrika strana 3.jpg"), "X-Strom-Source": "S0001" });
    assert.match(json(first).media, /^M\d{4}$/, first.body.toString());
    assert.equal(await readName(scan, { "X-Strom-Name": encodeURIComponent("Крещение Яна.jpg") }), "Крещение Яна.jpg");
    assert.equal(await readName(scan, {}), "matrika strana 3.jpg", "no name now: the image's own, as it came first");

    // an input sent to be read before (its name decomposed): read again under another name, then under none
    const photo = jpegWithOrientation(halves(1200, 1600), 1);
    assert.equal(await readName(photo, { "X-Strom-Name": encodeURIComponent("zápis křtu.jpg".normalize("NFD")) }), "zápis křtu.jpg");
    assert.equal(await readName(photo, { "X-Strom-Name": encodeURIComponent("rub fotky.jpg") }), "rub fotky.jpg");
    assert.equal(await readName(photo, {}), "zápis křtu.jpg", "no name now: the input's own");
    // a name of nothing but slashes, control characters or spaces: no name (it read before as invalid --name, nothing read)
    for (const odd of ["%2F", "%2F%2F", "%01", "%01%1F", "%20%20"]) assert.equal(await readName(photo, { "X-Strom-Name": odd }), "zápis křtu.jpg", odd);
    assert.equal(await readName(photo, { "X-Strom-Name": encodeURIComponent("../a\u0001b/Крещение.jpg") }), "Крещение.jpg");
  } finally {
    await w.run(["live", "stop"]);
    w.cleanup();
  }
});

test("no reader here: accepts.read says why and nothing is asked; an archive reads nothing and says nothing of it", opts, async () => {
  const { w, url } = await setUp({ CODEX_SANDBOX: "seatbelt" });
  try {
    const read = json(await request("GET", `${url}/status`)).accepts.read;
    assert.deepEqual([read.ready, read.why], [false, "agent.sandbox"]);
    const photo = jpegWithOrientation(halves(1600, 1200), 1);
    assert.equal((await request("PUT", `${url}/media/${sha(photo)}`, photo, { ...app, "X-Strom-Read": "1" })).status, 200);
    const r = await post(`${url}/read`, { files: [sha(photo)] });
    assert.deepEqual([r.status, json(r).code, json(r).params], [503, "read.not-ready", { why: "agent.sandbox" }]);
    assert.equal(fs.existsSync(path.join(w.cwd, ".strom", "reads")), false, "nothing queued");

    delete w.env.CODEX_SANDBOX; // the person, in their own terminal
    await w.ok(["mode", "archive"], { tty: true });
    const status = json(await request("GET", `${url}/status`));
    assert.equal(status.accepts.read, undefined, "an archive: no reading at all");
    assert.equal(status.reads, undefined);
    const refused = await post(`${url}/read`, { files: [sha(photo)] });
    assert.deepEqual([refused.status, json(refused).code], [404, "read.none"]);
    assert.equal((await request("GET", `${url}/reads`)).status, 404);
    assert.doesNotMatch(JSON.stringify(status), /"read"|agent\.sandbox/);
  } finally {
    await w.run(["live", "stop"]);
    w.cleanup();
  }
});

test("a bridge the system started (a link from the app: the bare PATH) finds the agent of the person's terminal, or in its installer's folder", opts, async () => {
  const w = new World();
  try {
    await w.withTree();
    // the person's terminal: the agent in a folder of its own (as npm's or Homebrew's), remembered at a strom run there
    const own = path.join(w.dir, "own bin");
    fs.mkdirSync(own);
    fs.writeFileSync(path.join(own, "claude"), "#!/bin/sh\n", { mode: 0o755 });
    // (not the stand-in agent every test has on its PATH)
    const terminal = [own, "/usr/bin", "/bin"].join(path.delimiter);
    await w.ok(["check"], { tty: true, env: { PATH: terminal } });
    const config = () => JSON.parse(fs.readFileSync(path.join(w.env.STROM_CONFIG_DIR!, "config.json"), "utf8"));
    assert.equal(config().terminalPath, terminal);
    // never an agent's PATH, nor one without a terminal
    await w.ok(["check"], { tty: true, env: { PATH: "/usr/bin:/bin", CLAUDECODE: "1" } });
    await w.ok(["check"], { env: { PATH: "/usr/bin:/bin" } });
    assert.equal(config().terminalPath, terminal);

    // the applet's do shell script: /usr/bin:/bin:/usr/sbin:/sbin
    Object.assign(w.env, { PATH: "/usr/bin:/bin:/usr/sbin:/sbin", STROM_AGENT: "claude", STROM_LIVE_POLL_MS: "150" });
    const url = (await w.ok(["live", "start", "--json"])).json.url as string;
    const read = async () => json(await request("GET", `${url}/status`)).accepts.read;
    const first = await read();
    assert.deepEqual([first.ready, first.why], [true, null]);
    // gone from there: in the folder its installer puts it, still found; nowhere: no agent
    fs.rmSync(path.join(own, "claude"));
    const local = path.join(w.env.HOME!, ".local", "bin");
    fs.mkdirSync(local, { recursive: true });
    fs.writeFileSync(path.join(local, "claude"), "#!/bin/sh\n", { mode: 0o755 });
    assert.equal((await read()).ready, true);
    fs.rmSync(path.join(local, "claude"));
    // nowhere (nor its desktop app): the research waits for its agent and says nothing of reading (no agent's program
    // beside its desktop app: agent.none, the test below)
    assert.equal(await read(), undefined);
  } finally {
    await w.run(["live", "stop"]);
    w.cleanup();
  }
});

test("why no reader starts: no agent's program, the limit or a login a reader ended on — every agent the research starts reads", opts, async () => {
  const w = new World();
  try {
    await w.withTree();
    const tree = () => Tree.open(w.cwd, w.env);
    const why = (env: Record<string, string>) => readAccepts(tree(), new Settings({ ...w.env, ...env }, {}), { ...w.env, ...env })?.why;
    assert.equal(why({ STROM_AGENT: "script" }), null);
    assert.equal(why({ STROM_AGENT: "codex", PATH: path.join(w.dir, "nothing") }), "agent.none");
    const bin = path.join(w.dir, "bin");
    fs.mkdirSync(bin);
    // every agent the research can start reads (each one's reader tried live 2026-10-20)
    for (const agent of ["codex", "grok", "agy", "opencode"]) fs.writeFileSync(path.join(bin, agent), "#!/bin/sh\n", { mode: 0o755 });
    for (const agent of ["codex", "grok", "antigravity", "opencode"]) assert.equal(why({ STROM_AGENT: agent, PATH: bin }), null, agent);
    // a reader that ended on its limit: until it resets; on a login: a quarter of an hour
    const reads = path.join(w.cwd, ".strom", "reads");
    fs.mkdirSync(reads, { recursive: true });
    const ended = (id: string, outcome: string, more: Record<string, unknown> = {}) =>
      fs.writeFileSync(path.join(reads, `${id}.json`), JSON.stringify({ id, state: "failed", version: 1, readers: 1, lang: "cs", pages: [], groups: [], reports: [{ n: 1, group: 0, blind: false, version: 1, outcome, ...more }], at: new Date().toISOString(), since: new Date().toISOString() }));
    const resets = new Date(Date.now() + 3600_000).toISOString();
    ended("D20261019120000-aaaa", "limit", { resets });
    const limit = readAccepts(tree(), new Settings({ ...w.env, STROM_AGENT: "script" }, {}), { ...w.env, STROM_AGENT: "script" });
    assert.deepEqual([limit?.ready, limit?.why, limit?.resets], [false, "limit", resets]);
    ended("D20261019120001-bbbb", "auth");
    assert.equal(why({ STROM_AGENT: "script" }), "auth");
    assert.equal(readAccepts(tree(), new Settings({ ...w.env, STROM_AGENT: "script" }, {}), { ...w.env, STROM_AGENT: "script" }, undefined, Date.now() + 16 * 60_000)?.why, null);

    // the limits: the default, the person's own; the hour full until its oldest is an hour old
    assert.deepEqual(appReadLimits(undefined), { hour: 20, day: 60 });
    assert.deepEqual(appReadLimits("5 9"), { hour: 5, day: 9 });
    const t0 = Date.now();
    noteAsked(w.cwd, "D20261019120002-cccc", "read", t0 - 30 * 60_000);
    noteAsked(w.cwd, "D20261019120003-dddd", "read", t0 - 10 * 60_000);
    assert.equal(limitReached(w.cwd, { hour: 3, day: 9 }, 0, t0), undefined);
    assert.deepEqual(limitReached(w.cwd, { hour: 3, day: 9 }, 1, t0), { per: "hour", retry: 30 * 60 });
    assert.deepEqual(limitReached(w.cwd, { hour: 9, day: 2 }, 0, t0), { per: "day", retry: 24 * 3600 - 30 * 60 });
  } finally {
    w.cleanup();
  }
});

test("strom document read --queue keeps a reading to be read later; read by its id as it was asked; cancelled queued, nothing read", opts, async () => {
  const w = new World();
  try {
    await w.withTree();
    const dir = path.join(w.dir, "r");
    fs.mkdirSync(dir);
    fs.writeFileSync(path.join(dir, "reader.mjs"), READER);
    fs.writeFileSync(path.join(dir, "first.md"), FIRST);
    Object.assign(w.env, { STROM_AGENT: "script", STROM_RUNNER_SCRIPT: path.join(dir, "reader.mjs"), DOC_FIRST: path.join(dir, "first.md"), DOC_MARK: path.join(dir, "readers.log"), DOC_HOLD: path.join(dir, "hold"), STROM_NO_CONVERT: "1" });
    const photo = path.join(dir, "křest.jpg");
    fs.writeFileSync(photo, jpegWithOrientation(halves(1600, 1200), 1));
    const q = (await w.ok(["document", "read", photo, "--readers", "2", "--queue", "--json"])).json;
    assert.equal(q.state, "queued");
    assert.deepEqual(marks(dir), [], "nothing read");
    assert.equal((await w.ok(["document", "list", "--json"])).json[0].state, "queued", "a queued one is not taken for gone");
    assert.match((await w.run(["document", "read", q.id, "--readers", "1"])).err, /is read as it was asked: --readers is not given again/);
    const done = (await w.ok(["document", "read", q.id, "--json"])).json;
    assert.deepEqual([done.state, done.readers.asked, done.readers.ran], ["done", 2, 2]);
    assert.match((await w.run(["document", "read", q.id])).err, /is not queued \(done\)/);
    const later = (await w.ok(["document", "again", q.id, "--queue", "--json"])).json;
    assert.deepEqual([later.state, later.version], ["queued", 2]);
    // read again, cancelled while queued: nothing read, the reading before stands as it was
    assert.deepEqual((await w.ok(["document", "cancel", q.id, "--json"])).json, { id: q.id, state: "done", cancelled: true });
    assert.deepEqual(marks(dir).filter((m) => m.startsWith("start")).length, 2, "the cancelled one never read");
    const kept = (await w.ok(["document", "show", q.id, "--json"])).json;
    assert.deepEqual([kept.state, kept.version, kept.readers.ran, kept.entries.length], ["done", 1, 2, 1]);

    // read again, cancelled while its readers read: the reading before stands, what they wrote stays (and its cost)
    fs.writeFileSync(path.join(dir, "hold"), "");
    const reading = w.run(["document", "again", q.id, "--json"]);
    await until("reading again", () => marks(dir).filter((m) => m.startsWith("start")).length === 4, { ms: 30_000 });
    assert.equal((await w.ok(["document", "cancel", q.id, "--json"])).json.cancelled, true);
    fs.rmSync(path.join(dir, "hold"));
    await reading;
    const back = (await w.ok(["document", "show", q.id, "--json"])).json;
    assert.deepEqual([back.state, back.version, back.readers.ran, back.entries.length], ["done", 1, 2, 1]);
    const anew = (await w.ok(["document", "again", q.id, "--queue", "--json"])).json;
    assert.deepEqual([anew.state, anew.version], ["queued", 3], "past the version cancelled");
  } finally {
    w.cleanup();
  }
});
