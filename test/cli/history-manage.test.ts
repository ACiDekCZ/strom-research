// What the ancestors lived through (experiments.history), managed by the person: the regions of the tree's places in
// GET /history (their state, order, weight, events and those hidden; each place's regions, people, record), an event
// hidden in the whole tree or everything of a region (POST /history/hide), no history of a region or at a place
// (POST /history/skip, strom history skip|unskip), a place's regions assigned by hand (POST /history/map, strom history
// assign) — never mapped otherwise by the research; an event deleted (POST /history/delete, strom history delete|restore)
// — never written again by the research.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { World, hasGit, readJsonFile } from "../helpers.ts";
import type { Task } from "../../src/core/model.ts";

const opts = { skip: !hasGit || process.platform === "win32", timeout: 180_000 };
const APP = "https://beta.stromapp.info";
const AGENT = { CLAUDECODE: "1" };
const NAMES = ["--name-cs", "Lhotsko", "--name-en", "Lhota Land", "--name-de", "Lhotaland"];
type Info = { pid: number; port: number; token: string; url: string };

function ask(url: string, opt: { method?: string; body?: string } = {}): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const headers: Record<string, string> = { Origin: APP };
    if (opt.body !== undefined) headers["Content-Type"] = "text/plain; charset=utf-8";
    const req = http.request(url, { agent: false, method: opt.method ?? "GET", headers }, (res) => {
      let text = "";
      res.setEncoding("utf8");
      res.on("data", (d) => (text += d));
      res.on("end", () => {
        let body: any = text;
        try {
          body = JSON.parse(text);
        } catch {
          // not JSON
        }
        resolve({ status: res.statusCode ?? 0, body });
      });
    });
    req.on("error", reject);
    req.end(opt.body);
  });
}

const post = (url: string, body: unknown) => ask(url, { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) });

function writeEvents(w: World, events: [n: number, year: number, kind: string, text: string][]): void {
  const file = path.join(w.home, "shared", "history", "regions", "cz-lhota.json");
  const c = readJsonFile(file);
  const source = { title: "Dějiny Lhoty", url: "https://example.org/lhota", checked: "2026-10-01", quote: "1866", sha: "0".repeat(64) };
  c.events = events.map(([n, from, kind, text]) => ({ id: `cz-lhota-${String(n).padStart(4, "0")}`, from, to: from, kind, text: { cs: text, en: text, de: text }, source, by: "x", at: "2026-10-01T00:00:00Z" }));
  c.next = events.length + 1;
  fs.writeFileSync(file, JSON.stringify(c));
}

/** Jan Lhoták born at Lhota (mapped to cz-lhota), died at Nová Lhota (waiting); a second region with no place yet. */
async function world(): Promise<World> {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["research", "new", "Předci Jana Lhotáka", "--new-person", "Jan /Lhoták/", "--sex", "M", "--born", "1850", "--born-place", "Lhota"]);
  await w.ok(["event", "add", "P0001", "DEAT", "--date", "1925", "--place", "Nová Lhota"]);
  await w.ok(["config", "set", "experiments.history", "on"], { tty: true, answers: ["a"] });
  await w.ok(["history", "region", "cz-lhota", ...NAMES]);
  await w.ok(["history", "region", "cz-horni", "--name-cs", "Horní země", "--name-en", "Upper Land", "--name-de", "Oberland"]);
  await w.ok(["history", "map", "Lhota", "--region", "cz-lhota:1800-"]);
  writeEvents(w, [
    [1, 1866, "epidemic", "Cholera ve Lhotě"],
    [2, 1921, "census", "Sčítání lidu"],
  ]);
  return w;
}

const history = async (w: World) => (await w.ok(["history", "status", "--app", "--json"])).json;

test("history R1: GET /history says the regions of the tree's places — state, order, weight, events, hidden — and each place's regions, people, record", opts, async () => {
  const w = await world();
  try {
    const info = (await w.ok(["live", "start", "--json"])).json as Info;
    const s = (await ask(`${info.url}/status`)).body;
    for (const f of ["history.regions", "history.hide.all", "history.skip", "history.map"]) assert.ok(s.features.includes(f), f);
    let h = (await ask(`${info.url}/history`)).body;
    assert.deepEqual(Object.keys(h.regions), ["cz-lhota"], "only the regions of the tree's places");
    const r = h.regions["cz-lhota"];
    assert.deepEqual(r.name, { cs: "Lhotsko", en: "Lhota Land", de: "Lhotaland" });
    assert.equal(r.state, "none", "no task yet");
    assert.equal(r.events, 2);
    assert.equal(r.hidden, 0);
    assert.deepEqual([r.places, r.persons, r.facts], [1, 1, 1]);
    assert.equal(r.order, undefined);
    assert.deepEqual(h.places["Lhota"].regions, [{ id: "cz-lhota", from: 1800 }]);
    assert.equal(h.places["Lhota"].persons, 1);
    assert.equal(h.places["Nová Lhota"].state, "pending");
    assert.equal(h.places["Nová Lhota"].persons, 1);
    assert.equal(h.places["Nová Lhota"].regions, undefined);
    assert.equal(h.places["Lhota"].id, undefined, "no place record yet");
    // the research's place record of it (one alone bears its name): its ID, what a link may carry
    await w.ok(["place", "add", "Lhota", "--kind", "village", "--unlocated", "test"]);
    assert.equal((await history(w)).places["Lhota"].id, "L0001");

    // its task raised: queued, the first of the regions; asked for first
    await w.ok(["frontier", "--apply"]);
    h = (await ask(`${info.url}/history`)).body;
    assert.equal(h.regions["cz-lhota"].state, "queued");
    assert.equal(h.regions["cz-lhota"].order, 1);
    await w.ok(["history", "first", "cz-lhota"]);
    assert.equal((await history(w)).regions["cz-lhota"].first, true);

    // a place not located: why; finished: done with its time, no order
    await w.ok(["history", "map", "Nová Lhota", "--unlocated", "--why", "dvě vsi toho jména"], { env: AGENT });
    await w.ok(["history", "done", "cz-lhota"], { env: AGENT });
    h = await history(w);
    assert.equal(h.places["Nová Lhota"].state, "unlocated");
    assert.equal(h.places["Nová Lhota"].why, "dvě vsi toho jména");
    assert.equal(h.regions["cz-lhota"].state, "done");
    assert.match(h.regions["cz-lhota"].at, /^\d{4}-\d\d-\d\dT/);
    assert.equal(h.regions["cz-lhota"].order, undefined);
  } finally {
    await w.run(["live", "stop"]);
    w.cleanup();
  }
});

test("history R2: an event hidden in the whole tree, everything of a region hidden — and shown again; the bridge's refusals", opts, async () => {
  const w = await world();
  try {
    const info = (await w.ok(["live", "start", "--json"])).json as Info;
    const url = `${info.url}/history/hide`;
    let r = await post(url, { event: "cz-lhota-0001", tree: true });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.hidden.length, 1);
    assert.equal(r.body.hidden[0].event, "cz-lhota-0001");
    assert.equal(r.body.hidden[0].tree, true);
    assert.match(r.body.parent, /^[0-9a-f]{40}$/);
    let h = (await ask(`${info.url}/history`)).body;
    assert.equal(h.hidden[0].tree, true);
    assert.equal(h.regions["cz-lhota"].hidden, 1);
    r = await post(url, { region: "cz-lhota" });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.ok(r.body.hidden.some((x: { region?: string; at: string }) => x.region === "cz-lhota" && x.at));
    h = (await ask(`${info.url}/history`)).body;
    assert.equal(h.regions["cz-lhota"].hidden, 2, "the whole region hidden: all its events");
    r = await post(url, { region: "cz-lhota", do: "show" });
    assert.equal(r.status, 200);
    assert.ok(!r.body.hidden.some((x: { region?: string }) => x.region));
    r = await post(url, { event: "cz-lhota-0001", tree: true, do: "show" });
    assert.deepEqual(r.body.hidden, []);
    // refusals
    assert.equal((await post(url, { event: "cz-lhota-0001", region: "cz-lhota" })).status, 400);
    assert.equal((await post(url, { event: "cz-lhota-0001", tree: false })).status, 400);
    assert.equal((await post(url, { event: "cz-lhota-0001", tree: true, place: "Lhota" })).status, 400);
    r = await post(url, { region: "cz-horni" });
    assert.equal(r.status, 404, "no place of the tree in it");
    assert.equal(r.body.code, "history.region");
    r = await post(url, { event: "cz-lhota-0099", tree: true });
    assert.equal(r.status, 404);
    assert.equal(r.body.code, "history.event");
    // the CLI: the person's alone, in the research language
    assert.equal((await w.run(["history", "hide", "--region", "cz-lhota"], { env: AGENT })).code, 4);
    assert.match((await w.ok(["history", "hide", "--region", "cz-lhota"])).out, /Skryto: vše z regionu Lhotsko/);
    assert.match((await w.ok(["history", "hide", "cz-lhota-0002", "--tree"])).out, /Skryto: cz-lhota-0002 – v celém stromu/);
    assert.equal((await w.run(["history", "hide", "cz-lhota-0002"])).code, 2, "where is missing");
    assert.equal((await w.run(["check"])).code, 0);
  } finally {
    await w.run(["live", "stop"]);
    w.cleanup();
  }
});

test("history R3: a region or a place skipped — out of the queue and of the events, found ones stay — and looked for again", opts, async () => {
  const w = await world();
  try {
    await w.ok(["frontier", "--apply"]);
    const regionTask = ((await w.ok(["task", "list", "--state", "all", "--full", "--json", "--limit", "500"])).json.tasks as Task[]).find((t) => t.origin === "history:region:cz-lhota")!;
    assert.ok(regionTask);
    const info = (await w.ok(["live", "start", "--json"])).json as Info;
    const url = `${info.url}/history/skip`;
    let r = await post(url, { region: "cz-lhota" });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.deepEqual(r.body.skip, { regions: ["cz-lhota"], places: [] });
    let h = (await ask(`${info.url}/history`)).body;
    assert.equal(h.regions["cz-lhota"].state, "skipped");
    assert.equal(h.regions["cz-lhota"].order, undefined);
    assert.deepEqual(h.places["Lhota"].events, ["cz-lhota-0001", "cz-lhota-0002"], "what was found stays");
    // strom run never takes it
    for (let i = 0; i < 3; i++) assert.notEqual((await w.ok(["task", "next", "--history", "--json"])).json.task?.id, regionTask.id);
    r = await post(url, { region: "cz-lhota", do: "undo" });
    assert.deepEqual(r.body.skip, { regions: [], places: [] });
    assert.equal((await ask(`${info.url}/history`)).body.regions["cz-lhota"].state, "queued");

    // a place: no event of a region through it, still listed with its regions
    r = await post(url, { place: "lhota" });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.deepEqual(r.body.skip.places, ["Lhota"], "as the facts write it");
    h = (await ask(`${info.url}/history`)).body;
    assert.equal(h.places["Lhota"].skip, true);
    assert.deepEqual(h.places["Lhota"].events, []);
    assert.deepEqual(h.places["Lhota"].regions, [{ id: "cz-lhota", from: 1800 }]);
    assert.equal(h.regions["cz-lhota"].places, 0, "no weight");
    assert.equal((await post(url, { place: "Lhota", do: "undo" })).status, 200);
    // the place's own events once more
    assert.deepEqual((await ask(`${info.url}/history`)).body.places["Lhota"].events, ["cz-lhota-0001", "cz-lhota-0002"]);

    // refusals
    assert.equal((await post(url, {})).status, 400);
    assert.equal((await post(url, { region: "cz-lhota", place: "Lhota" })).status, 400);
    assert.equal((await post(url, { region: "Lhota Land" })).status, 400);
    r = await post(url, { region: "cz-horni" });
    assert.equal(r.status, 404);
    assert.equal(r.body.code, "history.region");
    r = await post(url, { place: "Horní Lhota" });
    assert.equal(r.status, 404);
    assert.equal(r.body.code, "history.place");

    // the CLI: the person's alone
    assert.equal((await w.run(["history", "skip", "--region", "cz-lhota"], { env: AGENT })).code, 4);
    assert.match((await w.ok(["history", "skip", "--region", "cz-lhota"])).out, /Dějiny regionu Lhotsko se v tomto výzkumu nehledají/);
    assert.match((await w.ok(["history", "skip", "--region", "cz-lhota"])).out, /Beze změny/);
    assert.match((await w.ok(["history", "status"])).out, /skipped by the person/);
    assert.match((await w.ok(["history", "unskip", "--region", "cz-lhota"])).out, /znovu hledají/);
    assert.equal((await w.run(["check"])).code, 0);
  } finally {
    await w.run(["live", "stop"]);
    w.cleanup();
  }
});

test("history R5: a place's regions by hand — the research never maps it otherwise; determined again with a note; back to the research", opts, async () => {
  const w = await world();
  try {
    const info = (await w.ok(["live", "start", "--json"])).json as Info;
    const url = `${info.url}/history/map`;
    let r = await post(url, { place: "Nová Lhota", regions: [{ id: "cz-lhota", from: 1900 }] });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.place, "Nová Lhota");
    assert.equal(r.body.map.manual, true);
    assert.equal(r.body.map.auto, undefined, "what the research determined stays inside");
    let h = (await ask(`${info.url}/history`)).body;
    assert.equal(h.places["Nová Lhota"].manual, true);
    assert.deepEqual(h.places["Nová Lhota"].regions, [{ id: "cz-lhota", from: 1900 }]);
    assert.deepEqual(h.places["Nová Lhota"].events, ["cz-lhota-0002"], "1921 in its years");
    // the agent never maps it otherwise
    const refused = await w.run(["history", "map", "Nová Lhota", "--region", "cz-lhota", "--json"], { env: AGENT });
    assert.notEqual(refused.code, 0);
    assert.equal(refused.json.code, "history.map.manual");

    // the place determined again, the person's note (decomposed input, kept NFC) in the brief of the places' session
    const note = "ta u řeky, ne u lesa".normalize("NFD");
    r = await post(url, { place: "Nová Lhota", redo: true, note });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    h = (await ask(`${info.url}/history`)).body;
    assert.equal(h.places["Nová Lhota"].state, "pending");
    assert.equal(h.places["Nová Lhota"].redo, true);
    assert.equal(h.places["Nová Lhota"].note, "ta u řeky, ne u lesa");
    assert.equal(h.places["Nová Lhota"].manual, undefined);
    await w.ok(["history", "map", "Nová Lhota", "--region", "cz-lhota:1910-"], { env: AGENT });
    assert.deepEqual((await history(w)).places["Nová Lhota"].regions, [{ id: "cz-lhota", from: 1910 }], "the research maps it again");

    // by hand, then back to what the research determined
    await w.ok(["history", "assign", "Nová Lhota", "--region", "cz-lhota:1800-"]);
    assert.equal((await history(w)).places["Nová Lhota"].manual, true);
    r = await post(url, { place: "Nová Lhota", do: "auto" });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    h = await history(w);
    assert.equal(h.places["Nová Lhota"].manual, undefined);
    assert.deepEqual(h.places["Nová Lhota"].regions, [{ id: "cz-lhota", from: 1910 }]);

    // refusals: the note (length in characters after NFC, broken characters), the region, the place, the body
    assert.equal((await post(url, { place: "Nová Lhota", redo: true, note: "ř".normalize("NFD").repeat(200) })).status, 200, "200 characters after NFC");
    r = await post(url, { place: "Nová Lhota", redo: true, note: "x".repeat(201) });
    assert.equal(r.status, 400);
    assert.equal(r.body.code, "history.body");
    assert.equal((await post(url, { place: "Nová Lhota", redo: true, note: "Lho�ta" })).status, 400);
    assert.equal((await post(url, { place: "Nová Lhota", note: "bez redo" })).status, 400);
    assert.equal((await post(url, { place: "Nová Lhota", regions: [{ id: "cz-lhota", from: 1920, to: 1900 }] })).status, 400);
    assert.equal((await post(url, { place: "Nová Lhota", regions: [] })).status, 400);
    r = await post(url, { place: "Nová Lhota", regions: [{ id: "cz-nikde" }] });
    assert.equal(r.status, 404);
    assert.equal(r.body.code, "history.region");
    r = await post(url, { place: "Horní Lhota", regions: [{ id: "cz-lhota" }] });
    assert.equal(r.status, 404);
    assert.equal(r.body.code, "history.place");

    // the CLI: the person's alone, in the research language
    assert.equal((await w.run(["history", "assign", "Lhota", "--region", "cz-lhota"], { env: AGENT })).code, 4);
    assert.match((await w.ok(["history", "assign", "Lhota", "--region", "cz-lhota:1850-1918"])).out, /Lhota: Lhotsko 1850–1918 \(přiřazeno ručně\)/);
    assert.match((await w.ok(["history", "assign", "Lhota", "--auto"])).out, /zpět k tomu, co určil výzkum/);
    assert.equal((await w.run(["history", "assign", "Lhota", "--auto", "--redo"])).code, 2);
    assert.equal((await w.run(["check"])).code, 0);
  } finally {
    await w.run(["live", "stop"]);
    w.cleanup();
  }
});

test("history R4: an event deleted by the person — from every tree sharing the region, a local one from this tree alone — said under deleted, restored; the bridge's refusals", opts, async () => {
  const w = await world();
  try {
    // one the research took back itself: no person's to delete or restore
    const file = path.join(w.home, "shared", "history", "regions", "cz-lhota.json");
    const c = readJsonFile(file);
    c.events.push({ ...c.events[0], id: "cz-lhota-0003", from: 1880, to: 1880, text: { cs: "Požár Lhoty", en: "Fire", de: "Brand" }, retracted: { at: "2026-10-02T00:00:00Z", why: "wrong year" } });
    c.next = 4;
    fs.writeFileSync(file, JSON.stringify(c));
    await w.ok(["history", "hide", "cz-lhota-0001", "--tree"]);
    const info = (await w.ok(["live", "start", "--json"])).json as Info;
    const s = (await ask(`${info.url}/status`)).body;
    for (const f of ["history.delete", "history.delete.restore"]) assert.ok(s.features.includes(f), f);
    const url = `${info.url}/history/delete`;
    let r = await post(url, { event: "cz-lhota-0001" });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.event, "cz-lhota-0001");
    assert.equal(r.body.scope, "region");
    assert.equal(r.body.parent, r.body.head, "the shared catalog alone: no commit of the tree");
    assert.equal(r.body.deleted.length, 1);
    const d = r.body.deleted[0];
    assert.equal(d.event, "cz-lhota-0001");
    assert.deepEqual(d.region, { id: "cz-lhota", name: { cs: "Lhotsko", en: "Lhota Land", de: "Lhotaland" } });
    assert.equal(d.scope, "region");
    assert.deepEqual([d.from, d.to, d.kind], [1866, 1866, "epidemic"]);
    assert.deepEqual(d.text, { cs: "Cholera ve Lhotě", en: "Cholera ve Lhotě", de: "Cholera ve Lhotě" });
    assert.match(d.at, /^\d{4}-\d\d-\d\dT/);
    assert.equal(d.id, undefined);
    let h = (await ask(`${info.url}/history`)).body;
    assert.ok(!h.events.some((e: { id: string }) => e.id === "cz-lhota-0001"), "out of the events");
    assert.deepEqual(h.places["Lhota"].events, ["cz-lhota-0002"]);
    assert.equal(h.regions["cz-lhota"].events, 1);
    assert.deepEqual(h.deleted.map((x: { event: string }) => x.event), ["cz-lhota-0001"]);
    assert.equal(h.regions["cz-lhota"].hidden, 0, "what was hidden on it went with it");
    // again: nothing changes
    r = await post(url, { event: "cz-lhota-0001" });
    assert.equal(r.status, 200);
    assert.equal(r.body.deleted.length, 1);

    // a second tree of the same shared folder with a place in the region: gone there too, said under deleted
    await w.ok(["init", "Lhotští"]);
    const b = w.treeDir("Lhotští");
    await w.ok(["person", "add", "Anna /Lhotská/", "--sex", "F"], { cwd: b });
    await w.ok(["event", "add", "P0001", "BIRT", "--date", "1870", "--place", "Lhota"], { cwd: b });
    await w.ok(["history", "map", "Lhota", "--region", "cz-lhota:1800-"], { cwd: b });
    const other = (await w.ok(["history", "status", "--app", "--json"], { cwd: b })).json;
    assert.deepEqual(other.deleted.map((x: { event: string }) => x.event), ["cz-lhota-0001"]);
    assert.ok(!other.events.some((e: { id: string }) => e.id === "cz-lhota-0001"));

    // restored: back with what was hidden on it; again nothing
    r = await post(url, { event: "cz-lhota-0001", do: "restore" });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.deepEqual(r.body.deleted, []);
    h = (await ask(`${info.url}/history`)).body;
    assert.deepEqual(h.places["Lhota"].events, ["cz-lhota-0001", "cz-lhota-0002"]);
    assert.equal(h.regions["cz-lhota"].hidden, 1);
    assert.deepEqual(h.deleted, []);
    assert.equal((await post(url, { event: "cz-lhota-0001", do: "restore" })).status, 200);

    // refusals
    for (const body of [{}, { event: "" }, { event: "cz-lhota-0001", do: "hide" }, { event: "cz-lhota-0001", tree: true }, { event: "cz lhota" }, "{"]) {
      r = await post(url, body);
      assert.equal(r.status, 400, JSON.stringify(body));
      assert.equal(r.body.code, "history.body");
    }
    r = await post(url, { event: "cz-lhota-0099" });
    assert.equal(r.status, 404);
    assert.equal(r.body.code, "history.event");
    assert.equal((await post(url, { event: "L0009" })).status, 404);
    for (const body of [{ event: "cz-lhota-0003" }, { event: "cz-lhota-0003", do: "restore" }]) {
      r = await post(url, body);
      assert.equal(r.status, 409, JSON.stringify(body));
      assert.equal(r.body.code, "history.retracted");
    }

    // the CLI: the person's alone, in the research language; a local event in this tree only, its place said
    assert.equal((await w.run(["history", "delete", "cz-lhota-0002"], { env: AGENT })).code, 4);
    assert.match((await w.ok(["history", "delete", "cz-lhota-0002", "--dry-run"])).out, /would/);
    assert.equal((await history(w)).deleted.length, 0, "a dry run writes nothing");
    assert.match((await w.ok(["history", "delete", "cz-lhota-0002"])).out, /Smazáno: cz-lhota-0002 – ze všech stromů na tomto počítači/);
    assert.match((await w.ok(["history", "status"])).out, /1 deleted by the person/);
    assert.match((await w.ok(["history", "restore", "cz-lhota-0002"])).out, /Obnoveno: cz-lhota-0002/);
    assert.equal((await w.run(["check"])).code, 0);
  } finally {
    await w.run(["live", "stop"]);
    w.cleanup();
  }
});

test("history tickets: the first of a skipped region refused (409), strom history status says its task apart, strom history redo closes the gaps' task", opts, async () => {
  const w = await world();
  try {
    await w.ok(["frontier", "--apply"]);
    await w.ok(["history", "skip", "--region", "cz-lhota"]);
    const info = (await w.ok(["live", "start", "--json"])).json as Info;
    const r = await post(`${info.url}/history/first`, { region: "cz-lhota" });
    assert.equal(r.status, 409, JSON.stringify(r.body));
    assert.equal(r.body.code, "history.skipped");
    assert.equal((await history(w)).regions["cz-lhota"].state, "skipped", "the skip stays");
    const out = (await w.ok(["history", "status"])).out;
    const [taken, apart] = out.split("not taken now:");
    assert.ok(apart, out);
    assert.doesNotMatch(taken!, /history:region:cz-lhota/);
    assert.match(apart!, /history:region:cz-lhota.*skipped by the person/);
    const json = (await w.ok(["history", "status", "--json"])).json;
    assert.equal(json.tasks.find((t: { origin: string }) => t.origin === "history:region:cz-lhota").held, "skipped");
  } finally {
    await w.run(["live", "stop"]);
    w.cleanup();
  }
});
