// The lines of the research from the Strom app (spec 038 U2; the app's ZADANI_VYZKUM_sprava-linii.md): /status
// researches[] in the order of work with what the app shows of each (order, limits, question, created, found) and caps;
// POST /directions (a new line, the person's note as material), /directions/<G…> (edited), /directions/<G…>/state,
// /directions/order — each a strom command; GET /directions/people. And the phone's page: the lines in order, one
// moved or paused by its key alone. Any script, any accent.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { World, hasGit, until } from "../helpers.ts";
import { decodeQr, svgModules } from "../qr-decode.ts";

const skip = !hasGit || process.platform === "win32";
const opts = { skip, timeout: 240_000 };
const APP = "https://beta.stromapp.info";

type Answer = { status: number; body: any; headers: http.IncomingHttpHeaders };
function request(url: string, method = "GET", body?: unknown, headers: Record<string, string> = { Origin: APP }): Promise<Answer> {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? undefined : Buffer.from(typeof body === "string" ? body : JSON.stringify(body), "utf8");
    const req = http.request(url, { agent: false, method, headers: { ...headers, ...(data ? { "Content-Type": "text/plain;charset=UTF-8", "Content-Length": String(data.length) } : {}) } }, (res) => {
      let text = "";
      res.setEncoding("utf8");
      res.on("data", (d) => (text += d));
      res.on("end", () => {
        let parsed: any = text;
        try {
          parsed = JSON.parse(text);
        } catch {
          // not JSON
        }
        resolve({ status: res.statusCode ?? 0, body: parsed, headers: res.headers });
      });
    });
    req.on("error", reject);
    req.end(data);
  });
}

/** Žofie Lhotáková (P0001), her father Jan (P0002) with a task of his named on no line, Václav Lhoták (P0003); one line. */
async function world(): Promise<World> {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["lang", "cs"]);
  await w.ok(["person", "add", "Žofie /Lhotáková/", "--sex", "F", "--born", "1890"]);
  await w.ok(["person", "add", "Jan /Lhoták/", "--sex", "M", "--born", "1860"]);
  await w.ok(["family", "add", "--partner", "P0002", "--child", "P0001"]);
  await w.ok(["person", "add", "Václav /Lhoták/", "--sex", "M", "--born", "1870"]);
  await w.ok(["task", "add", "Křest Jana Lhotáka", "--level", "locate", "--where", "Lhota", "--why", "a", "--done-when", "b", "--about", "P0002"]); // T0001
  await w.ok(["research", "new", "Předci Žofie", "--person", "P0001"]); // G0001
  return w;
}

test("bridge: the lines written by the app — new (a note as material), edited (the effect on tasks), paused, put in order; 400, 404, 409 exists, 503 busy; /status caps and order; who is in which line; what a line found", opts, async () => {
  const w = await world();
  Object.assign(w.env, { STROM_LOCK_WAIT_MS: "1500" });
  try {
    // a session of the line: what it added is the line's find
    await w.ok(["session", "start", "--research", "G0001", "--json"]);
    await w.ok(["person", "add", "Anna /Lhotová/", "--sex", "F", "--born", "1862"]); // P0004
    await w.ok(["session", "close", "--continue", "--summary", "Křest Žofie hledán.", "--next", "Dál."]);

    const info = (await w.ok(["live", "start", "--json"])).json as { url: string };
    const url = info.url;
    const status = async () => (await request(`${url}/status?app=3.22.0`)).body;
    let s = await status();
    for (const f of ["directions.edit", "directions.order", "directions.found", "directions.people"]) assert.ok(s.features.includes(f), f);
    assert.deepEqual(s.caps, { directionsWrite: true, directionsOrder: true, orderMode: "weight", directionKinds: ["ancestors", "descendants", "question"], duplicateDirections: false, offLineBranches: true });
    const g1 = s.researches[0];
    assert.deepEqual([g1.id, g1.order, g1.limits, g1.parent, typeof g1.created], ["G0001", 1, {}, undefined, "string"]);
    assert.deepEqual(g1.found && { ...g1.found, people: undefined }, { days: 7, sessions: 1, persons: 1, sources: 0, people: undefined }, JSON.stringify(g1.found));
    assert.deepEqual(g1.found.people, ["P0004"]);

    // a new line: its name made in the research's language, the note as material for the agent; last in the order
    const made = await request(`${url}/directions`, "POST", { person: "p0003", direction: "ancestors", note: "Babička říkala: Лгота u Lhoty".normalize("NFD") });
    assert.equal(made.status, 200, JSON.stringify(made.body));
    assert.equal(made.body.direction.id, "G0002");
    assert.equal(made.body.direction.order, 2);
    assert.match(made.body.direction.name, /Václav/);
    assert.match(made.body.head, /^[0-9a-f]{40}$/);
    assert.match(made.body.parent, /^[0-9a-f]{40}$/);
    assert.notEqual(made.body.head, made.body.parent);
    const inputs = (await w.ok(["input", "list", "--json"])).json.inputs as { id: string }[];
    assert.equal(inputs.length, 1, "the note kept as material");
    const input = (await w.ok(["input", "show", inputs[0]!.id, "--json"])).json;
    assert.match(JSON.stringify(input), /Babička říkala: Лгота u Lhoty/, "composed");
    assert.equal((await w.ok(["task", "show", input.tasks[0], "--json"])).json.task.research, "G0002", "its sorting task the new line's");
    // a question, its name decomposed and in another script
    const q = await request(`${url}/directions`, "POST", { person: "P0001", direction: "question", question: "Кто была Žofie?", name: "Otázka Žofie".normalize("NFD"), limits: { generations: 3 } });
    assert.equal(q.status, 200, JSON.stringify(q.body));
    assert.deepEqual([q.body.direction.id, q.body.direction.name, q.body.direction.question, q.body.direction.order], ["G0003", "Otázka Žofie", "Кто была Žofie?", 3]);

    // refused bodies
    for (const body of ["no json", {}, { person: "P0001", direction: "person" }, { person: "P0001", direction: "ancestors", question: "Kdo?" }, { person: "P0001", direction: "question" }, { person: "P0001", direction: "ancestors", limits: { generations: 0 } }, { person: "P0001", direction: "ancestors", what: 1 }, { person: "Žofie", direction: "ancestors" }]) {
      const r = await request(`${url}/directions`, "POST", body);
      assert.deepEqual([r.status, r.body.code], [400, "directions.body"], JSON.stringify(body));
    }
    const nobody = await request(`${url}/directions`, "POST", { person: "P0999", direction: "ancestors" });
    assert.deepEqual([nobody.status, nobody.body.code], [404, "directions.person"]);
    const twice = await request(`${url}/directions`, "POST", { person: "P0001", direction: "question", question: "  кто была žofie?  ".normalize("NFD") });
    assert.deepEqual([twice.status, twice.body.code, twice.body.existing], [409, "directions.exists", { id: "G0003", name: "Otázka Žofie", state: "active" }]);

    // edited: narrowed to Žofie alone — Jan's task waits outside, said in the research's language
    const narrow = await request(`${url}/directions/G0001`, "POST", { limits: { generations: 1 }, name: "Předci Žofie Lhotákové" });
    assert.equal(narrow.status, 200, JSON.stringify(narrow.body));
    assert.deepEqual([narrow.body.direction.name, narrow.body.direction.limits], ["Předci Žofie Lhotákové", { generations: 1 }]);
    assert.equal(narrow.body.effect.outside, 1);
    assert.match(narrow.body.effect.said, /^1 úkol je teď za limitem linie/);
    const wide = await request(`${url}/directions/g0001`, "POST", { limits: { generations: null } });
    assert.deepEqual([wide.status, wide.body.direction.limits, wide.body.effect?.back], [200, {}, 1]);
    for (const [id, body, code] of [["G0001", {}, "directions.body"], ["G0001", { question: "Kdo?" }, "directions.body"], ["G0001", { reason: "čeká" }, "directions.body"], ["G0001", { limits: { generations: -1 } }, "directions.body"], ["G0099", { name: "Nikdo" }, "directions.none"], ["X1", { name: "Nikdo" }, "directions.none"]] as const) {
      const r = await request(`${url}/directions/${id}`, "POST", body);
      assert.deepEqual([r.status, r.body.code], [code === "directions.none" ? 404 : 400, code], `${id} ${JSON.stringify(body)}`);
    }

    // paused with a reason, resumed
    const paused = await request(`${url}/directions/G0002/state`, "POST", { do: "pause", reason: "Matriky Лготы nejsou online" });
    assert.equal(paused.status, 200, JSON.stringify(paused.body));
    assert.deepEqual([paused.body.direction.state, paused.body.direction.reason], ["paused", "Matriky Лготы nejsou online"]);
    const reasoned = await request(`${url}/directions/G0002`, "POST", { reason: "Rodina chce počkat" });
    assert.equal(reasoned.status, 200, JSON.stringify(reasoned.body));
    for (const body of [{ do: "stop" }, { do: "resume", reason: "x" }, {}]) assert.equal((await request(`${url}/directions/G0002/state`, "POST", body)).status, 400, JSON.stringify(body));
    assert.equal((await request(`${url}/directions/G0099/state`, "POST", { do: "pause" })).status, 404);
    assert.equal((await request(`${url}/directions/G0002/state`, "POST", { do: "resume" })).body.direction.state, "active");

    // the order: those named first, unknown ignored; /status in it
    const ordered = await request(`${url}/directions/order`, "POST", { order: ["G0003", "G9999", "g0002"] });
    assert.equal(ordered.status, 200, JSON.stringify(ordered.body));
    assert.deepEqual([ordered.body.order, ordered.body.ignored], [["G0003", "G0002", "G0001"], ["G9999"]]);
    s = await status();
    assert.deepEqual(s.researches.map((r: { id: string; order: number }) => [r.id, r.order]), [["G0003", 1], ["G0002", 2], ["G0001", 3]]);
    const none = await request(`${url}/directions/order`, "POST", { order: ["G9999"] });
    assert.deepEqual([none.status, none.body.order, none.body.ignored], [200, ["G0003", "G0002", "G0001"], ["G9999"]]);
    for (const body of [{ order: "G0001" }, { order: [1] }, { order: [], more: 1 }]) assert.deepEqual((await request(`${url}/directions/order`, "POST", body)).body.code, "directions.body");
    assert.equal((await request(`${url}/directions/nothing/more`, "POST", {})).status, 404);

    // who is in which line: the narrowest first
    const people = await request(`${url}/directions/people`);
    assert.equal(people.status, 200);
    assert.deepEqual(people.body.people.P0003, ["G0002"]);
    assert.ok(people.body.people.P0001.includes("G0001"));
    assert.deepEqual(people.body.people.P0002, ["G0001"]);
    assert.equal(typeof people.body.head, "string");
    // a line of descendants: its person and their descendants (Jan, his daughter Žofie)
    const down = await request(`${url}/directions`, "POST", { person: "P0002", direction: "descendants" });
    assert.equal(down.status, 200, JSON.stringify(down.body));
    assert.equal(down.body.direction.id, "G0004");
    const withDown = (await request(`${url}/directions/people`)).body.people;
    assert.deepEqual(withDown.P0002, ["G0001", "G0004"]);
    assert.ok(withDown.P0001.includes("G0004"), JSON.stringify(withDown));
    assert.ok(!(withDown.P0003 ?? []).includes("G0004"), "Václav is no descendant of Jan");
    // a line of the kind question: its person is in it (nobody else), and the queue of tasks stays as it was
    const queue = async () => ((await w.ok(["task", "list", "--json"])).json.tasks as { id: string; subject: string[]; reason?: unknown }[]).map((t) => [t.id, t.subject, t.reason]);
    const tasksBefore = await queue();
    const asked = await request(`${url}/directions`, "POST", { person: "P0003", direction: "question", question: "Kde se Václav oženil?" });
    assert.equal(asked.status, 200, JSON.stringify(asked.body));
    assert.equal(asked.body.direction.id, "G0005");
    const withQuestion = (await request(`${url}/directions/people`)).body.people;
    assert.deepEqual(withQuestion.P0003, ["G0002", "G0005"], JSON.stringify(withQuestion));
    assert.deepEqual(Object.entries(withQuestion).filter(([, ids]) => (ids as string[]).includes("G0005")).map(([p]) => p), ["P0003"]);
    assert.deepEqual(await queue(), tasksBefore);
    // a session of a line that added nothing: no found for it
    await w.ok(["session", "start", "--research", "G0002", "--json"]);
    await w.ok(["session", "close", "--continue", "--summary", "Nic nenalezeno.", "--next", "Dál."]);
    s = await status();
    const g2 = s.researches.find((r: { id: string }) => r.id === "G0002");
    assert.equal(g2.found, undefined, JSON.stringify(g2.found));
    assert.equal(s.researches.find((r: { id: string }) => r.id === "G0001").found.persons, 1, "the line that found someone keeps it");

    // the research held by another strom: busy, nothing written
    const lock = path.join(w.cwd, ".strom", "tree.lock");
    fs.writeFileSync(lock, JSON.stringify({ pid: process.pid, host: os.hostname(), at: new Date().toISOString(), owner: "a test" }));
    const busy = await request(`${url}/directions/G0001`, "POST", { name: "Zaneprázdněno" });
    fs.rmSync(lock);
    assert.deepEqual([busy.status, busy.body.code, busy.headers["retry-after"] !== undefined], [503, "research.busy", true]);
    assert.equal((await w.ok(["research", "show", "G0001", "--json"])).json.research.name, "Předci Žofie Lhotákové");
    assert.match((await w.ok(["check"])).out, /^ok/);

    // an archive: nobody researches — nothing written, no caps, nobody in a line
    await w.ok(["live", "stop"]);
    await w.ok(["mode", "archive"], { tty: true });
    const again = (await w.ok(["live", "start", "--json"])).json as { url: string };
    const a = (await request(`${again.url}/status?app=3.22.0`)).body;
    assert.equal(a.caps, undefined);
    assert.deepEqual(a.researches, []);
    const refused = await request(`${again.url}/directions`, "POST", { person: "P0003", direction: "descendants" });
    assert.deepEqual([refused.status, refused.body.code], [409, "directions.archive"]);
    assert.deepEqual([(await request(`${again.url}/directions/order`, "POST", { order: ["G0001"] })).body.code, (await request(`${again.url}/directions/G0001/state`, "POST", { do: "pause" })).body.code], ["directions.archive", "directions.archive"]);
    assert.deepEqual((await request(`${again.url}/directions/people`)).body.people, {});
  } finally {
    await w.run(["live", "stop"]);
    w.cleanup();
  }
});

test("strom research show of a line of descendants: its descendants by generation, within its generations", { skip: !hasGit }, async () => {
  const w = await world();
  try {
    await w.ok(["person", "add", "Жофия /Лгота/", "--sex", "F", "--born", "1915"]); // P0004, Žofie's daughter
    await w.ok(["family", "add", "--partner", "P0001", "--child", "P0004"]);
    await w.ok(["research", "new", "Potomci Jana", "--person", "P0002", "--direction", "descendants"]); // G0002
    const shown = await w.ok(["research", "show", "G0002"]);
    assert.match(shown.out, /known descendants by generation\n +G1 +P0002 +Jan Lhoták[^\n]*\n +G2 +P0001 +Žofie Lhotáková[^\n]*\n +G3 +P0004 +Жофия Лгота/);
    assert.doesNotMatch(shown.out, /known ancestors|missing parents/);
    const json = (await w.ok(["research", "show", "G0002", "--json"])).json;
    assert.deepEqual(json.generations, { P0002: 1, P0001: 2, P0004: 3 });
    assert.equal(json.missingParents, undefined);
    await w.ok(["research", "edit", "G0002", "--generations", "2"]);
    assert.deepEqual((await w.ok(["research", "show", "G0002", "--json"])).json.generations, { P0002: 1, P0001: 2 });
    // a line of ancestors as before
    assert.match((await w.ok(["research", "show", "G0001"])).out, /known ancestors by generation[\s\S]*missing parents/);
  } finally {
    w.cleanup();
  }
});

test("the phone's page: the lines in the order of work by a key of their own (never an ID); one moved and paused from the phone, the person's; another page or no pairing refused", opts, async () => {
  const w = await world();
  try {
    await w.ok(["research", "new", "Předci Václava", "--person", "P0003"]); // G0002
    await w.ok(["research", "new", "Кто была Žofie?", "--person", "P0001", "--direction", "question", "--question", "Кто была Žofie Lhotáková?"]); // G0003
    const env = { STROM_ISOLATED: "1", STROM_PHONE_TEST_ANSWER: "yes", STROM_PHONE_TEST_ANSWER_MS: "200", STROM_LIVE_POLL_MS: "100" };
    const bridge = (await w.ok(["live", "start", "--json"], { env })).json as { url: string };
    assert.equal((await request(`${bridge.url}/phone/on`, "POST", { lang: "cs" }, { Origin: "https://stromapp.info" })).status, 200);
    let address = "";
    await until("the phone's server", async () => {
      address = (await request(`${bridge.url}/phone`)).body.addresses?.[0]?.url ?? "";
      return !!address;
    }, { ms: 20_000 });
    const code = decodeQr(svgModules(await (await fetch(`${bridge.url}/phone/qr.svg`)).text())).text.split("#")[1]!;
    const paired = await fetch(`${address}/pair`, { method: "POST", headers: { "Content-Type": "text/plain;charset=UTF-8", Origin: address }, body: JSON.stringify({ code }) });
    assert.equal(paired.status, 200);
    const me = { Cookie: paired.headers.get("set-cookie")!.split(";")[0]! };
    const tree = (await request(`${address}/phone/state`, "GET", undefined, me)).body.trees[0].id as string;
    const lines = async () => (await request(`${address}/phone/state?tree=${encodeURIComponent(tree)}`, "GET", undefined, me)).body.shown.lines as { key: string; n: number; name: string; state: string; tasks: number; way: string }[];

    let l = await lines();
    assert.deepEqual(l.map((x) => [x.n, x.name, x.state, x.way]), [[1, "Předci Žofie", "active", "up"], [2, "Předci Václava", "active", "up"], [3, "Кто была Žofie?", "active", "other"]]);
    assert.equal(l[0]!.tasks, 1, "Jan's task in Žofie's line");
    for (const x of l) assert.match(x.key, /^[0-9a-f]{12}$/);
    assert.doesNotMatch(JSON.stringify(l), /G000\d|P000\d/, "no record's ID on the phone");

    const line = (key: string, body: unknown, headers: Record<string, string> = me) => request(`${address}/phone/line/${key}?tree=${encodeURIComponent(tree)}`, "POST", body, headers);
    const down = await line(l[0]!.key, { do: "down" });
    assert.equal(down.status, 200, JSON.stringify(down.body));
    assert.equal(down.body.ok, true);
    assert.match(down.body.head, /^[0-9a-f]{40}$/);
    l = await lines();
    assert.deepEqual(l.map((x) => x.name), ["Předci Václava", "Předci Žofie", "Кто была Žofie?"]);
    assert.equal((await line(l[2]!.key, { do: "up" })).status, 200);
    assert.equal((await line(l[0]!.key, { do: "pause" })).status, 200);
    l = await lines();
    assert.deepEqual(l.map((x) => [x.name, x.state]), [["Předci Václava", "paused"], ["Кто была Žofie?", "active"], ["Předci Žofie", "active"]]);
    assert.equal((await w.ok(["research", "show", "G0002", "--json"])).json.research.state, "paused");
    assert.equal((await line(l[0]!.key, { do: "resume" })).status, 200);
    assert.equal((await lines())[0]!.state, "active");

    // refused: a body of another kind, a key no line has, another page of the network, a phone not paired
    for (const body of [{ do: "first" }, { do: "done" }, "no json"]) assert.deepEqual((await line(l[0]!.key, body)).body.code, "phone.line.body", JSON.stringify(body));
    assert.deepEqual([(await line("0123456789ab", { do: "up" })).status, (await line("0123456789ab", { do: "up" })).body.code], [404, "phone.line"]);
    assert.equal((await line(l[0]!.key, { do: "pause" }, { ...me, Origin: "http://evil.example" })).status, 403);
    assert.equal((await line(l[0]!.key, { do: "pause" }, {})).status, 401);
    assert.equal((await lines())[0]!.state, "active", "nothing changed by them");
    assert.match((await w.ok(["check"])).out, /^ok/);
  } finally {
    await w.run(["live", "stop"]);
    w.cleanup();
  }
});

test("the phone's page carries the lines' card and its texts in every catalog", () => {
  const root = path.join(import.meta.dirname, "..", "..");
  const html = fs.readFileSync(path.join(root, "assets", "phone", "index.html"), "utf8");
  const js = fs.readFileSync(path.join(root, "assets", "phone", "phone.js"), "utf8");
  for (const id of ["linesCard", "linesTitle", "linesList", "linesNote", "linesError"]) assert.match(html, new RegExp(`id="${id}"`), id);
  const keys = [...new Set([...js.matchAll(/"(lines\.[a-z]+)"/g)].map((m) => m[1]!))];
  assert.ok(keys.length >= 8, keys.join(" "));
  assert.match(js, /\/phone\/line\//);
  for (const lang of ["cs", "de", "pl"]) {
    const cat = JSON.parse(fs.readFileSync(path.join(root, "assets", "lang", `${lang}.json`), "utf8")) as Record<string, string>;
    for (const k of keys) assert.ok(cat[`ui.phone.page.${k}`], `${lang}: ${k}`);
  }
});
