// Identifying places from the Strom app (spec 034 U2; the app's ZADANI_VYZKUM_ztotozneni-mist.md, points 1–9, 13):
// GET /places (the records, the facts' places, the queue and its estimate, the counts), POST /places/identify (the
// person's word: queued or taken out, nothing spent, nothing started — a run only by the link), POST /places/answer (one
// question or many, dry, a question changed since refused with the place as it is now), POST /places/undo (only the
// last step); the question in What waits (kind place); the link strom-research://places; a position from the app is the
// person's hand. Any script, any accent.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { World, hasGit, readJsonFile } from "../helpers.ts";
import { parseLink, LinkError } from "../../src/core/links.ts";
import { Tree } from "../../src/core/tree.ts";
import { waitingFor } from "../../src/core/waiting.ts";
import { rankTasks } from "../../src/core/queue.ts";
import type { Place, Task } from "../../src/core/model.ts";

const opts = { skip: !hasGit, timeout: 180_000 };
const bridgeOpts = { skip: !hasGit || process.platform === "win32", timeout: 180_000 };
const AGENT = { CLAUDECODE: "1" };
const APP = "https://beta.stromapp.info";

function place(w: World, id: string): Place {
  return JSON.parse(fs.readFileSync(path.join(w.cwd, "data", "places", `${id}.json`), "utf8")) as Place;
}

function placeTasks(w: World): Task[] {
  const dir = path.join(w.cwd, "data", "tasks");
  return (fs.existsSync(dir) ? fs.readdirSync(dir) : [])
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) as Task)
    .filter((t) => t.origin === "places:identify");
}

/** Jan Lhoták, born at "H. Lhota" 1850, living at "Horní Lhota" 1870; Anna at "Лгота" 1852 and "Lhotákov" (NFD) 1880. */
async function world(): Promise<World> {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["research", "new", "Předci Jana Lhotáka", "--new-person", "Jan /Lhoták/", "--sex", "M", "--born", "1850", "--born-place", "H. Lhota"]); // P0001
  await w.ok(["event", "add", "P0001", "RESI", "--date", "1870", "--place", "Horní Lhota"]);
  await w.ok(["person", "add", "Anna /Лгота/", "--sex", "F", "--born", "1852", "--born-place", "Лгота"]); // P0002
  await w.ok(["event", "add", "P0002", "RESI", "--date", "1880", "--place", "Lhotákov".normalize("NFD")]);
  return w;
}

function asker() {
  return (url: string, method = "GET", body?: unknown): Promise<{ status: number; body: any; headers: http.IncomingHttpHeaders }> =>
    new Promise((resolve, reject) => {
      const req = http.request(url, { agent: false, method, headers: { Origin: APP, ...(body !== undefined ? { "Content-Type": "text/plain; charset=utf-8" } : {}) } }, (res) => {
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
      req.end(body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body));
    });
}

test("bridge: GET /places, the person's queue (any script, decomposed too), refused bodies, never a run (403 places.link), an archive refused", bridgeOpts, async () => {
  const w = await world();
  const id = readJsonFile(path.join(w.cwd, "strom.json")).id;
  const ask = asker();
  try {
    const info = (await w.ok(["live", "start", "--json"])).json as { url: string };
    const status = (await ask(`${info.url}/status?app=3.19.0`)).body;
    for (const f of ["places.identify", "places.answer", "places.undo"]) assert.ok(status.features.includes(f), f);
    const g = await ask(`${info.url}/places`);
    assert.equal(g.status, 200, JSON.stringify(g.body));
    assert.deepEqual(g.body.places, {}, "no records before identification");
    assert.deepEqual(Object.keys(g.body.forms).sort(), ["H. Lhota", "Horní Lhota", "Lhotákov", "Лгота"].sort(), "the forms in NFC");
    for (const v of Object.values(g.body.forms)) assert.deepEqual(v, {});
    assert.equal(g.body.counts.offMap, 4);
    assert.deepEqual([g.body.queue.queued, g.body.queue.running, g.body.queue.batches], [0, 0, 0]);
    assert.deepEqual(g.body.queue.estimate.usd, undefined, "no price before three sessions measured");
    assert.equal(typeof g.body.rev, "string");

    const url = `${info.url}/places/identify`;
    const q = await ask(url, "POST", { do: "queue", forms: ["H. Lhota", "Лгота", "Nikde"] });
    assert.equal(q.status, 200, JSON.stringify(q.body));
    assert.equal(q.body.ok, true);
    assert.equal(q.body.queued, 2);
    assert.deepEqual(q.body.skipped, [{ form: "Nikde", why: "unknown" }]);
    assert.equal(q.body.queue.queued, 2);
    assert.equal(typeof q.body.head, "string");
    // decomposed and folded: the same place
    const nfd = await ask(url, "POST", { do: "queue", forms: ["LHOTÁKOV".normalize("NFD"), "h. lhota"] });
    assert.equal(nfd.body.queued, 1, JSON.stringify(nfd.body));
    assert.deepEqual(nfd.body.skipped, [{ form: "H. Lhota", why: "queued" }], "said as the facts write it");
    assert.equal(fs.existsSync(path.join(w.cwd, "data", "places")) ? fs.readdirSync(path.join(w.cwd, "data", "places")).length : 0, 0, "no record made by queueing");
    assert.equal(placeTasks(w).length, 1, "the task while anything waits");
    const after = (await ask(`${info.url}/places`)).body;
    assert.deepEqual(after.forms["Лгота"], { state: "queued" });
    assert.notEqual(after.rev, g.body.rev);

    // refused bodies, before anything is written
    for (const body of ["{}", JSON.stringify({ do: "queue" }), JSON.stringify({ do: "queue", forms: "H. Lhota" }), JSON.stringify({ do: "queue", all: "queued" }), JSON.stringify({ do: "cancel", all: "offmap" }), JSON.stringify({ do: "queue", forms: ["Lhota"], flags: { Lhota: "near" } }), JSON.stringify({ do: "queue", places: ["Lhota"] }), JSON.stringify({ do: "queue", forms: ["Lhota"], extra: 1 })]) {
      const r = await ask(url, "POST", body);
      assert.equal(r.status, 400, body);
      assert.equal(r.body.code, "places.body", body);
    }
    // a run never through the bridge: the link the terminal asks with
    const run = await ask(url, "POST", { do: "run", place: "L0003" });
    assert.equal(run.status, 403, JSON.stringify(run.body));
    assert.equal(run.body.code, "places.link");
    assert.equal(run.body.link, `strom-research://places?tree=${id}&do=run&place=L0003`);
    assert.deepEqual(parseLink(run.body.link), { action: "places", tree: id, do: "run", place: "L0003" });
    const run2 = await ask(`${info.url}/places/run`, "POST", {});
    assert.equal(run2.status, 403);
    assert.equal(run2.body.link, `strom-research://places?tree=${id}&do=run`);

    // taken out again
    const c = await ask(url, "POST", { do: "cancel", all: "queued" });
    assert.equal(c.status, 200, JSON.stringify(c.body));
    assert.equal(c.body.cancelled, 3);
    assert.equal(c.body.queue.queued, 0);

    // an archive: nobody researches — refused
    await w.run(["live", "stop"]);
    await w.ok(["mode", "archive"], { tty: true });
    const info2 = (await w.ok(["live", "start", "--json"])).json as { url: string };
    const a = await ask(`${info2.url}/places/identify`, "POST", { do: "queue", all: "offmap" });
    assert.equal(a.status, 409, JSON.stringify(a.body));
    assert.equal(a.body.code, "places.archive");
  } finally {
    await w.run(["live", "stop"]);
    w.cleanup();
  }
});

test("bridge: answers — the person's pick written as theirs, a question changed since refused (409 places.changed), many at once (dry first), one step undone, the next later (409)", bridgeOpts, async () => {
  const w = await world();
  const ask = asker();
  try {
    await w.ok(["place", "propose", "H. Lhota", "--candidate", "Horní Lhota|49.61|15.23|fara Lhotov v záznamech|Lhotov|CZ", "--candidate", "Horní Lhota|50.2|16.1|stejné jméno dál|Jinov|CZ"], { env: AGENT }); // L0001
    await w.ok(["place", "propose", "Лгота", "--candidate", "Лгота|55.7|37.6|по записи прихода"], { env: AGENT }); // L0002
    const at1 = place(w, "L0001").locating!.question!.at;
    const info = (await w.ok(["live", "start", "--json"])).json as { url: string };
    const g = (await ask(`${info.url}/places`)).body;
    assert.equal(g.places.L0001.state, "proposed");
    assert.equal(g.places.L0001.waiting, "L0001");
    assert.deepEqual(g.places.L0001.forms, ["H. Lhota"]);
    assert.deepEqual(g.forms["H. Lhota"], { place: "L0001" });
    assert.equal(g.counts.proposed, 2);
    // the questions in What waits
    const status = (await ask(`${info.url}/status?app=3.19.0`)).body;
    const items = status.waiting.filter((x: { kind: string }) => x.kind === "place");
    assert.deepEqual(items.map((x: { id: string }) => x.id), ["L0001", "L0002"]);
    assert.equal(items[0].section, "decide");
    assert.equal(items[0].question, "propose");
    assert.deepEqual(items[0].actions, ["answer"]);
    assert.deepEqual(items[0].candidates.map((c: { id: string }) => c.id), ["c1", "c2"]);
    assert.equal(items[0].at, at1);

    const url = `${info.url}/places/answer`;
    for (const body of [{ place: "L0001" }, { place: "L0001", take: "c9" }, { place: "Lhota", take: "c1" }, { place: "L0001", take: "first" }, { places: ["L0001"], take: "c1" }, { place: "L0099", take: "c1" }]) {
      const r = await ask(url, "POST", body);
      assert.equal(r.status, 400, JSON.stringify(body));
      assert.equal(r.body.code, "places.body");
    }
    const stale = await ask(url, "POST", { place: "L0001", take: "c1", expect: "2001-01-01T00:00:00.000Z" });
    assert.equal(stale.status, 409, JSON.stringify(stale.body));
    assert.equal(stale.body.code, "places.changed");
    assert.equal(stale.body.place.state, "proposed", "the place as it is now");
    assert.equal(place(w, "L0001").coords, undefined, "nothing written");

    const one = await ask(url, "POST", { place: "L0001", take: "c1", expect: at1 });
    assert.equal(one.status, 200, JSON.stringify(one.body));
    assert.equal(one.body.ok, true);
    assert.equal(one.body.place.by, "person");
    assert.deepEqual(one.body.place.coords, { lat: 49.61, lon: 15.23 });
    assert.equal(one.body.place.waiting, undefined);
    assert.match(one.body.undo, /^u[0-9a-z]+$/);
    assert.equal(typeof one.body.head, "string");
    assert.equal(typeof one.body.parent, "string");
    assert.equal(place(w, "L0001").locating?.by, "person");
    // answered again: the question is gone
    const again = await ask(url, "POST", { place: "L0001", take: "c2" });
    assert.equal(again.status, 409, JSON.stringify(again.body));
    assert.equal(again.body.code, "places.changed");

    // undone: the question back; the same step once only
    const u = await ask(`${info.url}/places/undo`, "POST", { undo: one.body.undo });
    assert.equal(u.status, 200, JSON.stringify(u.body));
    assert.deepEqual(u.body.restored, ["L0001"]);
    assert.equal(u.body.places.L0001.state, "proposed");
    assert.equal((await ask(`${info.url}/places/undo`, "POST", { undo: "nope" })).status, 400);
    const later = await ask(`${info.url}/places/undo`, "POST", { undo: one.body.undo });
    assert.equal(later.status, 409, JSON.stringify(later.body));
    assert.equal(later.body.code, "places.undo.later");

    // many at once: a look first, nothing written
    const dry = await ask(url, "POST", { places: ["L0001", "L0002"], take: "first", dry: true });
    assert.equal(dry.status, 200, JSON.stringify(dry.body));
    assert.deepEqual(dry.body.places, 2);
    assert.equal(dry.body.facts, 2);
    assert.equal(place(w, "L0002").coords, undefined);
    const many = await ask(url, "POST", { places: ["L0001", "L0002"], take: "first" });
    assert.equal(many.status, 200, JSON.stringify(many.body));
    assert.deepEqual(many.body.done, ["L0001", "L0002"]);
    assert.deepEqual(many.body.skipped, []);
    assert.deepEqual(place(w, "L0002").coords && [place(w, "L0002").coords!.lat, place(w, "L0002").locating?.by], [55.7, "person"]);
    assert.deepEqual((await ask(`${info.url}/status?app=3.19.0`)).body.waiting.filter((x: { kind: string }) => x.kind === "place"), []);
    const back = await ask(`${info.url}/places/undo`, "POST", { undo: many.body.undo });
    assert.deepEqual(back.body.restored.sort(), ["L0001", "L0002"]);
  } finally {
    await w.run(["live", "stop"]);
    w.cleanup();
  }
});

test("the link places: parsed with fixed values only; the terminal shows the queue, queues one place and asks to run now; refused in an archive", opts, async () => {
  const w = await world();
  try {
    const id = readJsonFile(path.join(w.cwd, "strom.json")).id;
    assert.deepEqual(parseLink(`strom-research://places?tree=${id}&do=run`), { action: "places", tree: id, do: "run" });
    for (const bad of [`strom-research://places?tree=${id}`, `strom-research://places?tree=${id}&do=now`, `strom-research://places?tree=${id}&do=run&place=Lhota`]) {
      assert.throws(() => parseLink(bad), LinkError, bad);
    }
    // nothing queued: said so, nothing started
    await w.ok(["lang", "cs"]);
    const empty = await w.run(["link", "open", `strom-research://places?tree=${id}&do=run`], { tty: true, answers: ["n"] });
    assert.match(empty.out, /Ve frontě nečeká žádné místo/u, empty.out);
    assert.equal(placeTasks(w).length, 0, "nothing queued, nothing started");
    // one place with a record (a question waits on it): queued by the link, the task first, "run now" declined
    await w.ok(["place", "propose", "Лгота", "--candidate", "Лгота|55.7|37.6|по записи прихода"], { env: AGENT }); // L0001
    const one = await w.run(["link", "open", `strom-research://places?tree=${id}&do=run&place=L0001`], { tty: true, answers: ["a", "n"] });
    assert.doesNotMatch(one.out, /\b(vy|váš|vaše|ty|tvůj)\b/iu);
    const t = placeTasks(w);
    assert.equal(t.length, 1, one.out);
    assert.equal(t[0]!.state, "open", "not run: the person said no");
    const tree = Tree.open(w.cwd, w.env);
    assert.equal(rankTasks(tree, tree.list<Task>("task").filter((x) => x.state === "open"))[0]?.task.id, t[0]!.id, "the places the person asked for first");
    // an archive: refused in one sentence
    await w.ok(["mode", "archive"], { tty: true });
    const arch = await w.run(["link", "open", `strom-research://places?tree=${id}&do=run`], { tty: true, answers: ["a", "n"] });
    assert.match(arch.out, /Archiv Stromu/u, "refused in one sentence");
    assert.equal(placeTasks(w).filter((x) => x.state === "open").length, 0, "its task put aside: nothing run");
  } finally {
    w.cleanup();
  }
});

test("What waits: a question of a place — propose, conflict with what is now — answered in the terminal as the person's", opts, async () => {
  const w = await world();
  try {
    await w.ok(["place", "propose", "H. Lhota", "--candidate", "Horní Lhota|49.61|15.23|fara Lhotov|Lhotov|CZ"], { env: AGENT }); // L0001
    const items = waitingFor(Tree.open(w.cwd, w.env), {}).map((x) => x.item).filter((x) => x.kind === "place");
    assert.equal(items.length, 1);
    const it = items[0] as any;
    assert.deepEqual([it.id, it.place, it.section, it.question, it.forms], ["L0001", "L0001", "decide", "propose", ["H. Lhota"]]);
    assert.equal(it.group.key, "places");
    assert.deepEqual(it.candidates[0], { id: "c1", name: "Horní Lhota", district: "Lhotov", country: "CZ", lat: 49.61, lon: 15.23, why: "fara Lhotov" });
    // answered as the person (the terminal's own word)
    await w.ok(["place", "answer", "L0001", "--take", "c1"]);
    assert.equal(place(w, "L0001").locating?.by, "person");
    assert.deepEqual(waitingFor(Tree.open(w.cwd, w.env), {}).filter((x) => x.item.kind === "place"), []);
    // an agent never answers
    await w.ok(["place", "propose", "Лгота", "--candidate", "Лгота|55.7|37.6|по записи"], { env: AGENT }); // L0002
    assert.notEqual((await w.run(["place", "answer", "L0002", "--take", "c1"], { env: AGENT })).code, 0);
  } finally {
    w.cleanup();
  }
});

test("sync: a position from the app is the person's hand (by person, its time; the question answered by it); the app's place records and marks are no edits; undone back", opts, async () => {
  const w = await world();
  try {
    await w.ok(["place", "propose", "H. Lhota", "--candidate", "Horní Lhota|49.61|15.23|fara Lhotov|Lhotov|CZ"], { env: AGENT }); // L0001
    const ged = path.join(w.dir, "strom.ged");
    await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", ged]);
    const given = fs.readFileSync(ged, "utf8");
    assert.match(given, /2 PLAC H\. Lhota\n/);
    // what a newer app keeps of the research's place records: no edit, nothing changed
    const marked = given
      .replace("2 PLAC H. Lhota\n", "2 PLAC H. Lhota\n3 _STROM_PLACE @L0001@\n")
      .replace(/0 TRLR/, "0 @L0001@ _STROM_PLACE\n1 NAME H. Lhota\n1 _STROM_BY research\n1 _STROM_UNLOCATED Y\n0 TRLR");
    assert.notEqual(marked, given);
    const same = path.join(w.dir, "same.ged");
    fs.writeFileSync(same, marked);
    assert.deepEqual((await w.ok(["sync", same, "--json"])).json.changes, [], "the place records are no edits");
    // in the app: H. Lhota put on the map, Лгота too (no record of it yet)
    const moved = given
      .replace("2 PLAC H. Lhota\n", "2 PLAC H. Lhota\n3 MAP\n4 LATI N49.61\n4 LONG E15.23\n")
      .replace("2 PLAC Лгота\n", "2 PLAC Лгота\n3 MAP\n4 LATI N55.7\n4 LONG E37.6\n");
    const file = path.join(w.dir, "mapa.ged");
    fs.writeFileSync(file, moved);
    await w.ok(["sync", file, "--apply"]);
    const l1 = place(w, "L0001");
    assert.deepEqual(l1.coords && [l1.coords.lat, l1.coords.lon], [49.61, 15.23]);
    assert.equal(l1.locating?.by, "person");
    assert.equal(typeof l1.locating?.at, "string");
    assert.equal(l1.locating?.question, undefined, "the question answered by the person's position");
    const made = (await w.ok(["place", "list", "--json"])).json.places.find((p: { names: { name: string }[] }) => p.names[0]!.name === "Лгота");
    assert.ok(made, "Лгота's record made");
    assert.equal(place(w, made.id).locating?.by, "person");
    // the agent never moves the person's position
    const agent = await w.run(["place", "identify", "L0001", "--lat", "50", "--lon", "16", "--why", "jiná fara", "--json"], { env: AGENT });
    assert.notEqual(agent.code, 0);
    assert.match(agent.out + agent.err, /place\.manual/u, agent.out + agent.err);
    // undone: the question back as it was
    await w.ok(["sync", "undo", "I1"]);
    const back = place(w, "L0001");
    assert.equal(back.coords, undefined);
    assert.equal(back.locating?.question?.kind, "propose");
  } finally {
    w.cleanup();
  }
});
