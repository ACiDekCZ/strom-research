// What the ancestors lived through, the history of a place and its surroundings (experiments.history, the app's R6):
// asked for by the person alone — its task before anything at the next session; its catalog shared by every research
// on this computer with the place (by its coordinates); its events written only from a page strom read, never a
// region's again; the app told its state, area and estimate; the bridge never starts it (the link to the terminal);
// experiments.historyPlaces raises the places with coordinates by themselves, a few at a time. In a conversation: an
// event asked for put into its region by the years, said at whom it shows (U17 K2.8). A local server plays the pages.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { World, hasGit, readJsonFile } from "../helpers.ts";
import { testHooks } from "../../src/core/net.ts";
import { parseLink } from "../../src/core/links.ts";
import { placeEstimate, placeKeyOf } from "../../src/core/placehistory.ts";
import type { Tree } from "../../src/core/tree.ts";
import type { Task } from "../../src/core/model.ts";

const opts = { skip: !hasGit, timeout: 180_000 };
const bridgeOpts = { skip: !hasGit || process.platform === "win32", timeout: 180_000 };
const AGENT = { CLAUDECODE: "1" };
const APP = "https://beta.stromapp.info";
const KEY = "p-4962n-1507e";
const agentScript = path.join(import.meta.dirname, "..", "fixtures", "agent.ts");

testHooks.sleep = async () => {};
after(() => {
  delete testHooks.sleep;
});

const PAGE = `<!doctype html><html lang="cs"><head><meta charset="utf-8"><title>Kronika Lhoty</title></head><body>
<p>Roku 1868 vyhořela ve Lhotě škola i fara.</p>
<p>V roce 1866 zasáhla Lhotu epidemie cholery&nbsp;– zemřelo 42 obyvatel.</p>
<p>Roku 1950 byla ve Lhotě založena družstva.</p>
</body></html>`;

async function pages(): Promise<{ base: string; close: () => void }> {
  const s = http.createServer((req, res) => {
    const p = req.url ?? "/";
    if (p === "/robots.txt") return res.writeHead(200, { "content-type": "text/plain" }).end("User-agent: *\n");
    if (p === "/kronika") return res.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(PAGE);
    return res.writeHead(404).end();
  });
  await new Promise<void>((r) => s.listen(0, "127.0.0.1", r));
  s.unref();
  return { base: `http://127.0.0.1:${(s.address() as AddressInfo).port}`, close: () => s.close() };
}

const NAMES = (cs: string, en: string, de: string) => ["--name-cs", cs, "--name-en", en, "--name-de", de];
const TEXTS = (cs: string, en: string, de: string) => ["--text-cs", cs, "--text-en", en, "--text-de", de];

/** Jan Lhoták born 1850 at Lhota (a place record with coordinates, L0001), died 1925 at Nová Lhota (no record). */
async function world(w = new World(), name = "Lhotákovi", on = true): Promise<World> {
  await w.withTree(name);
  await w.ok(["place", "add", "Lhota", "--kind", "village", "--lat", "49.62", "--lon", "15.07"]); // L0001
  await w.ok(["research", "new", "Předci Jana Lhotáka", "--new-person", "Jan /Lhoták/", "--sex", "M", "--born", "1850", "--born-place", "Lhota"]); // P0001
  await w.ok(["event", "add", "P0001", "RESI", "--date", "1868", "--place", "Lhota"]);
  await w.ok(["event", "add", "P0001", "DEAT", "--date", "1925", "--place", "Nová Lhota"]);
  if (on) await w.ok(["config", "set", "experiments.history", "on"], { tty: true, answers: ["a"] });
  return w;
}

function catalogFile(w: World, key = KEY): string {
  return path.join(w.home, "shared", "history", "places", `${key}.json`);
}

async function answer(w: World, cwd?: string): Promise<any> {
  return (await w.ok(["history", "status", "--app", "--json"], cwd ? { cwd } : {})).json;
}

async function tasks(w: World, cwd?: string): Promise<Task[]> {
  return (await w.ok(["task", "list", "--state", "all", "--full", "--json", "--limit", "500"], cwd ? { cwd } : {})).json.tasks;
}

const ofPlaces = (ts: Task[]) => ts.filter((t) => t.origin.startsWith("history:place:"));

test("history place: the person's word alone — the place's task before anything at the next session, whatever the pace; its catalog keyed by its coordinates", opts, async () => {
  const w = await world();
  try {
    const agent = await w.run(["history", "place", "L0001"], { env: AGENT });
    assert.equal(agent.code, 4, agent.err);
    assert.deepEqual(ofPlaces(await tasks(w)), [], "the agent's ask: nothing");
    assert.notEqual((await w.run(["history", "place", "L0099"], { tty: true, answers: ["a"] })).code, 0, "no such record");

    const asked = await w.run(["history", "place", "L0001", "--json"], { tty: true, answers: ["a"] });
    assert.equal(asked.code, 0, asked.err);
    const data = JSON.parse(asked.out.slice(asked.out.indexOf("{")));
    assert.equal(data.key, KEY);
    assert.equal(data.again, false);
    assert.deepEqual(data.estimate.minutes, [15, 30]);
    const task = ofPlaces(await tasks(w))[0]!;
    assert.equal(task.id, data.task);
    assert.equal(task.origin, "history:place:L0001");
    assert.match(task.what, /Lhota/u, "in the research language, its name");
    const c = readJsonFile(catalogFile(w));
    assert.deepEqual(c.place.coords, { lat: 49.62, lon: 15.07 });
    assert.equal(c.place.key, KEY);
    assert.equal(c.place.tree, undefined, "a place with coordinates: any tree's");

    // the app's answer: its own history first, its surroundings by default
    const a = await answer(w);
    assert.equal(a.places.Lhota.id, "L0001");
    assert.equal(a.places.Lhota.history, "first");
    assert.match(a.places.Lhota.area.cs, /10 km/u);
    assert.equal(a.places["Nová Lhota"].history, undefined, "no record: no history of its own");
    assert.equal(a.suggest, undefined, "asked already: not suggested");

    // before the family research and the places to map: the next session's whatever the pace
    for (let i = 1; i <= 3; i++) await w.ok(["task", "add", `Matrika Lhota ${i}`, "--level", "locate", "--where", `Lhota ${i}`, "--why", "a", "--done-when", "b", "--about", "P1", "--priority", "2"]);
    await w.ok(["frontier", "--apply"]);
    assert.ok((await tasks(w)).some((t) => t.origin === "history:places"), "the places to map wait too");
    const status = await w.ok(["history", "status"]);
    assert.match(status.out, new RegExp(`1\\.\\s+${task.id}\\s+history:place:L0001\\s+open\\s+asked for by the person: L0001`, "u"), status.out);
    Object.assign(w.env, { STROM_RUNNER_SCRIPT: agentScript, AGENT_MODE: "idle" });
    const run = await w.ok(["run", "--agent", "script", "--loop", "--max", "1", "--json"]);
    assert.equal(run.json.sessions[0].task, task.id, run.err);
    assert.equal(readJsonFile(catalogFile(w)).holder.tree, readJsonFile(path.join(w.cwd, "strom.json")).id, "held while this tree builds it");
  } finally {
    w.cleanup();
  }
});

test("history place: its events from a page strom read, never a region's again; the catalog shared by another research with the place; done, looked for again on the word", opts, async () => {
  const srv = await pages();
  const w = await world();
  try {
    await w.ok(["history", "place", "L0001"], { tty: true, answers: ["a"] });
    await w.ok(["history", "region", "cz-bohemia", ...NAMES("Čechy", "Bohemia", "Böhmen")]);
    await w.ok(["history", "map", "Lhota", "--region", "cz-bohemia:1800-"]);
    await w.ok(["history", "map", "Nová Lhota", "--region", "cz-bohemia:1800-"]);
    const add = (where: string[], from: string, kind: string, quote: string, more: string[] = []) =>
      w.run(["history", "add", ...where, "--from", from, "--kind", kind, ...TEXTS("Požár školy a fary", "The school and the parsonage burnt", "Schule und Pfarrhaus brannten ab"), "--url", `${srv.base}/kronika`, "--quote", quote, ...more], { env: AGENT });
    // the region's cholera first: the place's own of the same kind and years is refused
    assert.equal((await add(["--region", "cz-bohemia"], "1866", "epidemic", "V roce 1866 zasáhla Lhotu epidemie cholery – zemřelo 42 obyvatel.")).code, 0);
    const same = await add(["--place", "L0001"], "1866", "epidemic", "V roce 1866 zasáhla Lhotu epidemie cholery – zemřelo 42 obyvatel.");
    assert.notEqual(same.code, 0);
    assert.match(same.err, /an event of the region of L0001 of the same kind and years is there already: cz-bohemia-0001/);
    assert.notEqual((await add(["--place", "L0001", "--region", "cz-bohemia"], "1868", "disaster", "Roku 1868 vyhořela ve Lhotě škola i fara.")).code, 0, "one of --region and --place");
    const fire = await add(["--place", "L0001"], "1868", "disaster", "Roku 1868 vyhořela ve Lhotě škola i fara.");
    assert.equal(fire.code, 0, fire.err);
    assert.match(fire.out, new RegExp(`${KEY}-0001`));
    assert.match(fire.out, /shows at 1 person of the tree: P0001/);
    await w.ok(["history", "area", "L0001", ...TEXTS("Farnost Lhota a okolí do 10 km", "The parish of Lhota, within 10 km", "Die Pfarrei Lhota, bis 10 km")], { env: AGENT });

    const a = await answer(w);
    const ev = a.events.find((e: any) => e.id === `${KEY}-0001`);
    assert.equal(ev.scope, "place");
    assert.deepEqual(ev.place, { key: "Lhota", id: "L0001", name: ev.place.name }, "the key of places[x]");
    assert.equal(ev.place.name.cs, "Lhota");
    assert.equal(ev.source.title, "Kronika Lhoty");
    assert.deepEqual(a.places.Lhota.events.sort(), ["cz-bohemia-0001", `${KEY}-0001`]);
    assert.equal(a.places.Lhota.area.cs, "Farnost Lhota a okolí do 10 km");
    assert.ok(!a.places["Nová Lhota"].events.includes(`${KEY}-0001`), "the place's own only at the place");

    // finished: done, with when
    await w.ok(["history", "done", "L0001"], { env: AGENT });
    const done = await answer(w);
    assert.equal(done.places.Lhota.history, "done");
    assert.match(done.places.Lhota.at, /^\d{4}-\d{2}-\d{2}T/);
    assert.ok((await tasks(w)).filter((t) => t.origin === "history:place:L0001").every((t) => t.state === "done"));

    // another research on this computer with the same place (the coordinates): the same catalog, nothing looked for again
    const other = w.cwd;
    await w.ok(["init", "Lhotákovi z Lhoty"]);
    const second = w.treeDir("Lhotákovi z Lhoty");
    w.cwd = second;
    await w.ok(["place", "add", "Lhota u Brodu", "--kind", "village", "--lat", "49.621", "--lon", "15.069"]);
    await w.ok(["person", "add", "Josef /Lhoták/", "--sex", "M"]);
    await w.ok(["event", "add", "P0001", "RESI", "--date", "1868", "--place", "Lhota u Brodu"]);
    const there = await answer(w, second);
    assert.ok(there.places["Lhota u Brodu"].events.includes(`${KEY}-0001`), JSON.stringify(there.places));
    assert.equal(there.places["Lhota u Brodu"].history, "done");
    assert.equal(there.suggest, undefined, "done in the shared catalog: not suggested");
    // asked again: looked for again, its events stay
    const again = await w.run(["history", "place", "L0001", "--json"], { tty: true, answers: ["a"] });
    assert.equal(JSON.parse(again.out.slice(again.out.indexOf("{"))).again, true, again.err);
    assert.equal(readJsonFile(catalogFile(w)).done, undefined);
    assert.equal(readJsonFile(catalogFile(w)).events.length, 1);
    w.cwd = other;
    assert.equal((await answer(w)).places.Lhota.history, "none", "asked again by the other research: not finished here either, nothing of its own waiting");
    assert.equal((await w.run(["check"])).code, 0);
  } finally {
    srv.close();
    w.cleanup();
  }
});

test("history place: hidden and deleted like a region's; a place without coordinates is this tree's alone", opts, async () => {
  const srv = await pages();
  const w = await world();
  try {
    await w.ok(["place", "add", "Lhota pod Horou", "--kind", "hamlet"]); // L0002, no coordinates
    await w.ok(["event", "add", "P0001", "RESI", "--date", "1880", "--place", "Lhota pod Horou"]);
    await w.ok(["history", "place", "L0002"], { tty: true, answers: ["a"] });
    const key = placeKeyOf({ config: { id: readJsonFile(path.join(w.cwd, "strom.json")).id } } as unknown as Tree, { id: "L0002" });
    assert.match(key, /^t-[0-9a-f]{8}-l0002$/);
    assert.equal(readJsonFile(catalogFile(w, key)).place.tree, readJsonFile(path.join(w.cwd, "strom.json")).id);
    const r = await w.run(["history", "add", "--place", "L0002", "--from", "1868", "--kind", "disaster", ...TEXTS("Požár", "A fire", "Ein Brand"), "--url", `${srv.base}/kronika`, "--quote", "Roku 1868 vyhořela ve Lhotě škola i fara."], { env: AGENT });
    assert.equal(r.code, 0, r.err);
    const id = `${key}-0001`;
    assert.ok((await answer(w)).places["Lhota pod Horou"].events.includes(id));
    await w.ok(["history", "hide", id, "--place", "Lhota pod Horou"]);
    assert.ok((await answer(w)).hidden.some((h: any) => h.event === id));
    await w.ok(["history", "delete", id], { tty: true, answers: ["a"] });
    const after = await answer(w);
    assert.ok(!after.places["Lhota pod Horou"].events.includes(id));
    assert.ok(after.deleted.some((e: any) => e.event === id));
    const again = await w.run(["history", "add", "--place", "L0002", "--from", "1868", "--kind", "disaster", ...TEXTS("Požár", "A fire", "Ein Brand"), "--url", `${srv.base}/kronika`, "--quote", "Roku 1868 vyhořela ve Lhotě škola i fara."], { env: AGENT });
    assert.notEqual(again.code, 0, "deleted by the person: never written again");
  } finally {
    srv.close();
    w.cleanup();
  }
});

test("history places by themselves (experiments.historyPlaces): off — none; on — only places with coordinates and people, the most people first, three at a time", opts, async () => {
  const w = await world();
  try {
    for (const [name, lat] of [["Podlesí", "49.70"], ["Lhotečky", "49.80"], ["Horní Lhota", "49.90"]] as const) await w.ok(["place", "add", name, "--kind", "village", "--lat", lat, "--lon", "15.10"]);
    await w.ok(["place", "add", "Lhota pod Horou", "--kind", "hamlet"]); // no coordinates
    await w.ok(["place", "add", "Lhota u Brna", "--kind", "village", "--lat", "50.00", "--lon", "15.10"]); // nobody there
    await w.ok(["person", "add", "Anna /Lhotáková/", "--sex", "F"]); // P0002
    for (const p of ["P0001", "P0002"]) await w.ok(["event", "add", p, "RESI", "--date", "1880", "--place", "Podlesí"]);
    await w.ok(["event", "add", "P0002", "RESI", "--date", "1885", "--place", "Lhotečky"]);
    await w.ok(["event", "add", "P0002", "RESI", "--date", "1890", "--place", "Horní Lhota"]);
    await w.ok(["event", "add", "P0002", "RESI", "--date", "1895", "--place", "Lhota pod Horou"]);
    await w.ok(["frontier", "--apply"]);
    assert.deepEqual(ofPlaces(await tasks(w)), [], "off: none");
    assert.equal((await answer(w)).suggest?.[0], "L0002", "suggested: the place of the most people");

    // the person's alone: an agent refused, a tree may only turn it off
    assert.equal((await w.run(["config", "set", "experiments.historyPlaces", "on"], { env: AGENT })).code, 4);
    await w.ok(["config", "set", "experiments.historyPlaces", "on"], { tty: true, answers: ["a"] });
    await w.ok(["frontier", "--apply"]);
    await w.ok(["frontier", "--apply"]);
    let raised = ofPlaces(await tasks(w));
    assert.equal(raised.length, 3, raised.map((t) => t.origin).join(", "));
    assert.equal(raised[0]!.origin, "history:place:L0002", "the most people first");
    assert.ok(!raised.some((t) => /L0005|L0006/.test(t.origin)), "no coordinates or nobody there: never by itself");
    // one finished: the next
    const first = raised.find((t) => t.origin === "history:place:L0002")!;
    await w.ok(["task", "done", first.id, "--result", "hotovo"]);
    await w.ok(["frontier", "--apply"]);
    raised = ofPlaces(await tasks(w));
    assert.equal(raised.length, 4);
    assert.ok(raised.every((t) => /L000[1-4]$/.test(t.origin)), raised.map((t) => t.origin).join(", "));
    assert.equal(readJsonFile(catalogFile(w, "p-4970n-1510e")).done?.tree, readJsonFile(path.join(w.cwd, "strom.json")).id, "its task done: its catalog finished");
    // the tree turns it off: none more, those open stay for the person
    await w.ok(["config", "set", "experiments.historyPlaces", "off", "--for-tree"]);
    for (const t of ofPlaces(await tasks(w)).filter((x) => x.state === "open")) await w.ok(["task", "done", t.id, "--result", "hotovo"]);
    await w.ok(["frontier", "--apply"]);
    assert.equal(ofPlaces(await tasks(w)).filter((t) => t.state === "open").length, 0);
  } finally {
    w.cleanup();
  }
});

test("history place: the estimate — minutes always, the price only from three measured sessions of history", () => {
  const tree = (sessions: { task: string; cost: number }[], tasks: { id: string; origin: string }[]) =>
    ({
      list: (type: string) =>
        type === "task" ? tasks : type === "session" ? sessions.map((s, i) => ({ id: `S${i + 1}`, state: "closed", task: s.task, metrics: { costUsd: s.cost } })) : [],
    }) as unknown as Tree;
  const regionTask = { id: "T1", origin: "history:region:cz-bohemia" };
  const placeTask = { id: "T2", origin: "history:place:L0001" };
  const family = { id: "T3", origin: "frontier" };
  assert.deepEqual(placeEstimate(tree([], [])), { minutes: [15, 30] });
  assert.deepEqual(placeEstimate(tree([{ task: "T1", cost: 1 }, { task: "T1", cost: 2 }, { task: "T3", cost: 9 }], [regionTask, family])), { minutes: [15, 30] }, "two of history: no price");
  assert.deepEqual(placeEstimate(tree([{ task: "T1", cost: 1 }, { task: "T1", cost: 2 }, { task: "T1", cost: 3 }, { task: "T3", cost: 9 }], [regionTask, family])), { minutes: [15, 30], usd: [2, 3] });
  const own = placeEstimate(tree([{ task: "T1", cost: 9 }, { task: "T2", cost: 0.4 }, { task: "T2", cost: 0.6 }, { task: "T2", cost: 0.8 }], [regionTask, placeTask]));
  assert.deepEqual(own.usd, [0.6, 0.8], "the places' own first when there are three");
});

test("bridge: POST /history/place never starts it — the link to the terminal with the estimate; /status says the estimate and the auto setting; POST /experiments turns the places off, never on", bridgeOpts, async () => {
  const w = await world();
  const id = readJsonFile(path.join(w.cwd, "strom.json")).id;
  const ask = (url: string, method = "GET", body?: unknown): Promise<{ status: number; body: any }> =>
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
          resolve({ status: res.statusCode ?? 0, body: parsed });
        });
      });
      req.on("error", reject);
      req.end(body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body));
    });
  try {
    const info = (await w.ok(["live", "start", "--json"])).json as { url: string };
    const status = (await ask(`${info.url}/status?app=3.16.0`)).body;
    assert.ok(status.features.includes("history.place"));
    assert.deepEqual(status.history.placeEstimate, { minutes: [15, 30] });
    assert.equal(status.history.placesAuto, false);
    const url = `${info.url}/history/place`;
    const r = await ask(url, "POST", { place: "L0001" });
    assert.equal(r.status, 403, JSON.stringify(r.body));
    assert.equal(r.body.code, "history.link");
    assert.equal(r.body.link, `strom-research://history?tree=${id}&place=L0001&do=search`);
    assert.deepEqual(r.body.estimate, { minutes: [15, 30] });
    assert.equal(typeof r.body.error, "string");
    assert.equal(r.body.text, "The history of a place is looked for only on the word given in the terminal the link opens.");
    assert.deepEqual(ofPlaces(await tasks(w)), [], "nothing started");
    for (const body of ["{}", JSON.stringify({ place: "Lhota" }), JSON.stringify({ place: "L0001", do: "now" })]) assert.equal((await ask(url, "POST", body)).status, 400, body);
    assert.equal((await ask(url, "POST", { place: "L0099" })).status, 404);
    // the link parses as the terminal reads it
    assert.deepEqual(parseLink(r.body.link), { action: "history", tree: id, place: "L0001", do: "search" });
    assert.deepEqual(parseLink(`strom-research://experiment?tree=${id}&name=places&do=on`), { action: "experiment", tree: id, name: "places", do: "on" });
    // the places by themselves: on only in the terminal, off from the app
    await w.ok(["config", "set", "experiments.historyPlaces", "on"], { tty: true, answers: ["a"] });
    assert.equal((await ask(`${info.url}/status?app=3.16.0`)).body.history.placesAuto, true);
    const on = await ask(`${info.url}/experiments`, "POST", { historyPlaces: true });
    assert.equal(on.status, 403);
    assert.match(on.body.link, /name=places&do=on/);
    assert.equal((await ask(`${info.url}/experiments`, "POST", { historyPlaces: false })).status, 200);
    assert.equal((await ask(`${info.url}/status?app=3.16.0`)).body.history.placesAuto, false);
    assert.equal(readJsonFile(path.join(w.cwd, "strom.json")).experimentsHistoryPlaces, "off");
    // the history off: 409 with the experiment's link
    await w.ok(["config", "set", "experiments.history", "off", "--for-tree"]);
    const off = await ask(url, "POST", { place: "L0001" });
    assert.equal(off.status, 409);
    assert.equal(off.body.code, "history.off");
    assert.equal((await ask(`${info.url}/status?app=3.16.0`)).body.history?.placeEstimate, undefined);
  } finally {
    await w.run(["live", "stop"]);
    w.cleanup();
  }
});

test("history in a conversation (K2.8): an event asked for goes into the region of its place by the years, said at whom it shows; outside their years at nobody yet; strom history where; the guide only while on", opts, async () => {
  const srv = await pages();
  const w = await world(new World(), "Lhotákovi", false);
  try {
    const guideOff = (await w.ok(["guide"], { env: AGENT })).out;
    assert.doesNotMatch(guideOff, /THE HISTORY OF THE PLACES/);
    await w.ok(["config", "set", "experiments.history", "on"], { tty: true, answers: ["a"] });
    const guide = (await w.ok(["guide"], { env: AGENT })).out;
    assert.match(guide, /THE HISTORY OF THE PLACES/);
    for (const step of [/strom history where/, /--same-as/, /--replaces/, /history page <url>\s+--find/, /--quote/, /nothing added/, /history done L/]) assert.match(guide, step);

    await w.ok(["history", "region", "cz-bohemia", ...NAMES("Čechy", "Bohemia", "Böhmen")]);
    await w.ok(["history", "map", "Lhota", "--region", "cz-bohemia:1800-"]);
    const where = await w.ok(["history", "where", "1866", "--json"], { env: AGENT });
    const later = await w.ok(["history", "where", "1925", "--place", "Nová Lhota", "--json"], { env: AGENT });
    assert.ok(JSON.stringify(where.json).includes("cz-bohemia"), where.out);
    assert.ok(JSON.stringify(later.json).includes("Nová Lhota"), "a place not mapped yet: said");
    const add = (from: string, kind: string, quote: string) =>
      w.run(["history", "add", "--region", "cz-bohemia", "--from", from, "--kind", kind, ...TEXTS("Událost", "An event", "Ein Ereignis"), "--url", `${srv.base}/kronika`, "--quote", quote, "--json"], { env: AGENT });
    const near = await add("1866", "epidemic", "V roce 1866 zasáhla Lhotu epidemie cholery – zemřelo 42 obyvatel.");
    assert.equal(near.code, 0, near.err);
    assert.deepEqual(JSON.parse(near.out).persons, ["P0001"]);
    const far = await add("1950", "economy", "Roku 1950 byla ve Lhotě založena družstva.");
    assert.equal(far.code, 0, far.err);
    assert.deepEqual(JSON.parse(far.out).persons, []);
    const text = await w.run(["history", "add", "--region", "cz-bohemia", "--from", "1868", "--kind", "disaster", ...TEXTS("Požár", "A fire", "Ein Brand"), "--url", `${srv.base}/kronika`, "--quote", "Roku 1868 vyhořela ve Lhotě škola i fara."], { env: AGENT });
    assert.match(text.out, /shows at 1 person of the tree: P0001/);
    // no readable page: nothing added, the page kept as tried
    const none = await w.run(["history", "add", "--region", "cz-bohemia", "--from", "1870", "--kind", "disaster", ...TEXTS("Požár", "A fire", "Ein Brand"), "--url", `${srv.base}/nic`, "--quote", "1870"], { env: AGENT });
    assert.notEqual(none.code, 0);
    assert.equal(readJsonFile(path.join(w.home, "shared", "history", "regions", "cz-bohemia.json")).events.length, 3);
  } finally {
    srv.close();
    w.cleanup();
  }
});

test("the two switches (spec 020 K8): the places off — no place asked, its task held, the regions go on; the regions off — the place's task offered, the regions' held; both off: nothing; back when on", opts, async () => {
  const w = await world();
  try {
    await w.ok(["history", "place", "L0001"], { tty: true, answers: ["a"] });
    const task = ofPlaces(await tasks(w))[0]!;
    const next = async () => (await w.ok(["task", "next", "--history", "--json"])).json.task?.origin as string | undefined;
    assert.equal(await next(), "history:place:L0001");
    // the places off for this research: held, not even asked for (K8.3); the history of the regions still on
    await w.ok(["config", "set", "experiments.placeHistory", "off", "--for-tree"]);
    assert.equal((await tasks(w)).find((t) => t.id === task.id)!.state, "open", "kept as it is");
    await w.ok(["frontier", "--apply"]);
    assert.equal(await next(), "history:places", "the mapping of the places goes on, the place's task not offered");
    const asked = await w.run(["history", "place", "L0001"], { tty: true, answers: ["a"] });
    assert.notEqual(asked.code, 0);
    assert.match(asked.out + asked.err, /Dějiny míst jsou pro tento výzkum vypnuté|history of the places is off/u);
    // refused before the person is asked: never a question whose yes is refused after it (an agent, a run nobody watches)
    for (const env of [AGENT, { STROM_NONINTERACTIVE: "1" }] as Record<string, string>[]) {
      const x = await w.run(["history", "place", "L0001", "--json"], { env });
      assert.equal(x.json?.code, "history.off", `${JSON.stringify(env)}: ${x.out}${x.err}`);
      assert.doesNotMatch(x.out + x.err, /consent/u);
    }
    const area = await w.run(["history", "area", "L0001", ...TEXTS("Farnost Lhota", "The parish of Lhota", "Die Pfarrei Lhota")], { env: AGENT });
    assert.equal(area.json?.code ?? (area.err.match(/history of the places is off/) ? "history.off" : area.err), "history.off");
    // the regions off as well: nothing of history at all
    await w.ok(["config", "set", "experiments.history", "off", "--for-tree"]);
    assert.ok(!(await next())?.startsWith("history:"), "none of history offered");
    // the places on again, the regions off: the place's task back
    await w.ok(["config", "set", "experiments.placeHistory", "on", "--for-tree"], { tty: true, answers: ["a"] });
    assert.equal(await next(), "history:place:L0001", "back, nothing lost");
    const own = readJsonFile(path.join(w.cwd, "strom.json"));
    assert.equal(own.experimentsHistory, "off");
    assert.equal(own.experimentsPlaceHistory, "on");
    // an agent turns neither on
    const agent = await w.run(["config", "set", "experiments.history", "on", "--for-tree"], { env: AGENT });
    assert.equal(agent.code, 4, agent.err);
  } finally {
    w.cleanup();
  }
});
