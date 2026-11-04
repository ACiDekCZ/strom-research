// Identifying the places of the facts (spec 034 U2): the queue the person asks for (nothing written of the places,
// nothing spent), the research's three degrees — identified surely (written as the research's, with why and from
// what), a question for the person (1–3 candidates), not located with what would decide it — the person's hand wins,
// the one state "not located" (history's entries taken into the place records once), a place not located queued
// again by itself once something new is known of it, the facts' places written as the record says (a house never
// written over by another), the person's answers one step undone at once. Any script, any accent.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";
import type { Place, Person, Task } from "../../src/core/model.ts";
import { Tree } from "../../src/core/tree.ts";
import { convertHistoryUnlocated } from "../../src/core/placeid.ts";

const opts = { skip: !hasGit, timeout: 120_000 };
const AGENT = { CLAUDECODE: "1" };

function place(w: World, id: string): Place {
  return JSON.parse(fs.readFileSync(path.join(w.cwd, "data", "places", `${id}.json`), "utf8")) as Place;
}

function placeTasks(w: World): Task[] {
  const dir = path.join(w.cwd, "data", "tasks");
  return (fs.existsSync(dir) ? fs.readdirSync(dir) : [])
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) as Task)
    .filter((t) => t.origin === "places:identify");
}

function queueFile(w: World): { queue: Record<string, { form: string; check?: boolean; by: string }>; undo?: { id: string } } {
  const f = path.join(w.cwd, "quality", "places.json");
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : { queue: {} };
}

/** Jan Lhoták, born at "H. Lhota" 1850, living at "Horní Lhota" 1870, died at "Lhota, Dlouhá" 1925; Anna at "Лгота". */
async function world(): Promise<World> {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["research", "new", "Předci Jana Lhotáka", "--new-person", "Jan /Lhoták/", "--sex", "M", "--born", "1850", "--born-place", "H. Lhota"]); // P0001
  await w.ok(["event", "add", "P0001", "RESI", "--date", "1870", "--place", "Horní Lhota"]);
  await w.ok(["event", "add", "P0001", "DEAT", "--date", "1925", "--place", "Lhota, Dlouhá"]);
  await w.ok(["person", "add", "Anna /Лгота/", "--sex", "F", "--born", "1852", "--born-place", "Лгота"]); // P0002
  // decomposed (NFD) on purpose: the same place as "Lhotákov"
  await w.ok(["event", "add", "P0002", "RESI", "--date", "1880", "--place", "Lhotákov".normalize("NFD")]);
  return w;
}

test("queue: nothing written of the places, one place once, the task while anything waits, taken out again", opts, async () => {
  const w = await world();
  try {
    const q = await w.ok(["place", "queue", "H. Lhota", "Лгота", "Nikde", "--json"]);
    assert.deepEqual(q.json.queued.sort(), ["H. Lhota", "Лгота"].sort());
    assert.deepEqual(q.json.skipped, [{ form: "Nikde", why: "unknown" }]);
    assert.equal(fs.existsSync(path.join(w.cwd, "data", "places")) ? fs.readdirSync(path.join(w.cwd, "data", "places")).length : 0, 0, "no place record made by queueing");
    const t = placeTasks(w);
    assert.equal(t.length, 1);
    assert.equal(t[0]!.state, "open");
    // queued twice: said so, once
    const again = await w.ok(["place", "queue", "h. lhota", "--json"]);
    assert.deepEqual(again.json.skipped, [{ form: "H. Lhota", why: "queued" }]);
    // the whole queue: shown with its sessions and estimate (no price before three sessions measured)
    const shown = await w.ok(["place", "queue", "--json"]);
    assert.equal(shown.json.queue.length, 2);
    assert.equal(shown.json.batches, 1);
    assert.deepEqual(shown.json.estimate.session.minutes, [8, 15]);
    assert.equal(shown.json.estimate.session.usd, undefined);
    // all off the map: the rest of the facts' places (decomposed one once, as composed)
    const all = await w.ok(["place", "queue", "--all", "--json"]);
    assert.deepEqual(all.json.queued.sort(), ["Horní Lhota", "Lhota, Dlouhá", "Lhotákov"].sort());
    assert.ok(Object.values(queueFile(w).queue).every((e) => e.form === e.form.normalize("NFC")));
    // taken out, all: the task done
    const out = await w.ok(["place", "unqueue", "--all", "--json"]);
    assert.equal(out.json.cancelled.length, 5);
    const after = placeTasks(w)[0];
    assert.equal(after?.state, "done");
  } finally {
    w.cleanup();
  }
});

test("identified surely: the record made with the form as a name, who, why, source; out of the queue", opts, async () => {
  const w = await world();
  try {
    await w.ok(["place", "queue", "H. Lhota"]);
    const r = await w.ok(
      ["place", "identify", "H. Lhota", "--lat", "49.61", "--lon", "15.23", "--name", "Horní Lhota", "--form", "Horní Lhota", "--jurisdiction", "parish:Lhotov:1784-", "--why", "fara Lhotov v matrikách; druhá Horní Lhota 200 km", "--source-title", "Místopis", "--source-url", "https://example.org/mistopis", "--json"],
      { env: AGENT },
    );
    const p = r.json.place as Place;
    assert.equal(p.names[0]!.name, "Horní Lhota");
    assert.ok(p.names.some((n) => n.name === "H. Lhota"), "the facts' form kept as a name (K4.5)");
    assert.deepEqual(p.coords, { lat: 49.61, lon: 15.23 });
    assert.equal(p.locating?.by, "research");
    assert.equal(p.locating?.source?.title, "Místopis");
    assert.deepEqual(p.jurisdictions, [{ kind: "parish", name: "Lhotov", recordsets: [], from: 1784 }]);
    assert.deepEqual(queueFile(w).queue, {});
    // "Horní Lhota" of the facts belongs to the record now: off the map no more
    const off = await w.ok(["place", "list", "--off-map", "--json"]);
    assert.ok(!off.json.offMap.some((m: { name: string }) => m.name === "Horní Lhota" || m.name === "H. Lhota"));
    // without why: refused
    const no = await w.run(["place", "identify", "Лгота", "--lat", "50", "--lon", "15", "--why", " ", "--json"], { env: AGENT });
    assert.notEqual(no.code, 0);
  } finally {
    w.cleanup();
  }
});

test("the person's hand wins: coordinates the person gave are never moved by the research — only a conflict asked", opts, async () => {
  const w = await world();
  try {
    await w.ok(["place", "add", "Лгота", "--lat", "50.1", "--lon", "14.9"]); // the person, by hand: L0001
    assert.equal(place(w, "L0001").locating?.by, "person");
    const r = await w.run(["place", "identify", "L0001", "--lat", "49", "--lon", "15", "--why", "jiná fara", "--json"], { env: AGENT });
    assert.notEqual(r.code, 0);
    assert.match(r.out + r.err, /place\.manual|given by the person/);
    const e = await w.run(["place", "edit", "L0001", "--lat", "49", "--lon", "15", "--json"], { env: AGENT });
    assert.notEqual(e.code, 0);
    assert.deepEqual(place(w, "L0001").coords, { lat: 50.1, lon: 14.9 });
    // a conflict: asked; the person keeps theirs — not asked again while they stay
    await w.ok(["place", "propose", "L0001", "--conflict", "--candidate", "Лгота|49.6|15.2|fara Lhotov v záznamech|Lhotov|CZ"], { env: AGENT });
    assert.equal(place(w, "L0001").locating?.question?.kind, "conflict");
    const a = await w.ok(["place", "answer", "L0001", "--take", "keep", "--json"]);
    assert.deepEqual(a.json.done, ["L0001"]);
    assert.deepEqual(place(w, "L0001").locating?.kept, { lat: 50.1, lon: 14.9 });
    const again = await w.run(["place", "propose", "L0001", "--conflict", "--candidate", "Лгота|49.6|15.2|znovu"], { env: AGENT });
    assert.notEqual(again.code, 0);
    // an agent never answers for the person
    const agentAnswer = await w.run(["place", "answer", "L0001", "--take", "c1"], { env: AGENT });
    assert.notEqual(agentAnswer.code, 0);
  } finally {
    w.cleanup();
  }
});

test("probable: a question with candidates; the person's choice written as theirs; several at once undone as one step", opts, async () => {
  const w = await world();
  try {
    await w.ok(["place", "propose", "H. Lhota", "--candidate", "Horní Lhota|49.61|15.23|fara Lhotov|Lhotov|CZ|Místopis", "--candidate", "Horní Lhota|50.2|16.1|stejné jméno dál|Jinov|CZ"], { env: AGENT }); // L0001
    await w.ok(["place", "propose", "Лгота", "--candidate", "Лгота|55.7|37.6|по записи прихода"], { env: AGENT }); // L0002
    const shown = await w.ok(["place", "queue", "--json"]);
    assert.equal(shown.json.queue.length, 0, "a question takes the place out of the queue");
    const dry = await w.ok(["place", "answer", "L0001", "L0002", "--take", "first", "--dry", "--json"]);
    assert.deepEqual(dry.json.done.sort(), ["L0001", "L0002"]);
    assert.equal(place(w, "L0001").coords, undefined, "a dry answer writes nothing");
    const done = await w.ok(["place", "answer", "L0001", "L0002", "--take", "first", "--json"]);
    assert.equal(place(w, "L0001").locating?.by, "person");
    assert.deepEqual(place(w, "L0001").coords, { lat: 49.61, lon: 15.23 });
    assert.deepEqual(place(w, "L0002").coords, { lat: 55.7, lon: 37.6 });
    await w.ok(["place", "undo", done.json.undo]);
    assert.equal(place(w, "L0001").coords, undefined);
    assert.equal(place(w, "L0001").locating?.question?.kind, "propose", "the question back");
    assert.equal(place(w, "L0002").coords, undefined);
    // once
    assert.notEqual((await w.run(["place", "undo", done.json.undo])).code, 0);
  } finally {
    w.cleanup();
  }
});

test("not located: why and what would decide it; back in the queue by itself once something new is known", opts, async () => {
  const w = await world();
  try {
    await w.ok(["place", "unlocated", "Лгота", "--why", "tři vsi toho jména", "--needs", "fara nebo okres"], { env: AGENT }); // L0001
    const p = place(w, "L0001");
    assert.equal(p.unlocated, "tři vsi toho jména");
    assert.equal(p.locating?.needs, "fara nebo okres");
    // nothing new: stays out of the queue
    await w.ok(["place", "queue", "--json"]);
    assert.deepEqual(queueFile(w).queue, {});
    await w.ok(["frontier", "--apply"]);
    assert.deepEqual(queueFile(w).queue, {});
    // a jurisdiction of it: something new — queued again by the research itself where tasks are raised
    await w.ok(["place", "jurisdiction", "L0001", "--kind", "parish", "--name", "Lhotov"]);
    await w.ok(["frontier", "--apply"]);
    assert.deepEqual(Object.values(queueFile(w).queue).map((e) => [e.form, e.by]), [["Лгота", "research"]]);
  } finally {
    w.cleanup();
  }
});

test("the facts' place written as the record says: the street into the house, a house never written over, the form a name", opts, async () => {
  const w = await world();
  try {
    await w.ok(["place", "identify", "Horní Lhota", "--lat", "49.61", "--lon", "15.23", "--why", "fara Lhotov"], { env: AGENT }); // L0001
    await w.ok(["event", "add", "P0001", "RESI", "--date", "1900", "--place", "Lhota, Dlouhá", "--house", "Krátká 3"]);
    const r = await w.ok(["place", "rewrite", "Lhota, Dlouhá", "--to", "L0001", "--house", "Dlouhá", "--reason", "ulice obce", "--json"], { env: AGENT });
    assert.equal(r.json.changed, 1);
    assert.equal(r.json.left, 1, "the fact with another house left");
    const jan = JSON.parse(fs.readFileSync(path.join(w.cwd, "data", "persons", "P0001.json"), "utf8")) as Person;
    const deat = jan.events.find((e) => e.kind === "DEAT")!;
    assert.equal(deat.place, "Horní Lhota");
    assert.equal(deat.house, "Dlouhá");
    assert.ok(jan.events.some((e) => e.place === "Lhota, Dlouhá" && e.house === "Krátká 3"));
    assert.ok(place(w, "L0001").names.some((n) => n.name === "Lhota, Dlouhá"));
    // a part of a municipality or another of the name: a question, nothing changed — yes then sets it right
    await w.ok(["place", "rewrite", "H. Lhota", "--to", "L0001", "--propose", "--why", "zkratka?"], { env: AGENT });
    assert.equal(place(w, "L0001").locating?.question?.kind, "form");
    const a = await w.ok(["place", "answer", "L0001", "--take", "yes", "--json"]);
    assert.equal(a.json.facts, 1);
    const jan2 = JSON.parse(fs.readFileSync(path.join(w.cwd, "data", "persons", "P0001.json"), "utf8")) as Person;
    assert.equal(jan2.events.find((e) => e.kind === "BIRT")!.place, "Horní Lhota");
    await w.ok(["place", "undo", a.json.undo]);
    const jan3 = JSON.parse(fs.readFileSync(path.join(w.cwd, "data", "persons", "P0001.json"), "utf8")) as Person;
    assert.equal(jan3.events.find((e) => e.kind === "BIRT")!.place, "H. Lhota");
  } finally {
    w.cleanup();
  }
});

test("don't know: an answer to a conflict and to a form too; first moves a conflict to its candidate A, never the person's own", opts, async () => {
  const w = await world();
  try {
    await w.ok(["place", "identify", "Horní Lhota", "--lat", "49.61", "--lon", "15.23", "--why", "fara Lhotov"], { env: AGENT }); // L0001, the research's
    await w.ok(["place", "add", "Лгота", "--lat", "50.1", "--lon", "14.9"]); // L0002, the person's own
    await w.ok(["place", "propose", "L0001", "--conflict", "--candidate", "Horní Lhota|49.7|15.3|fara Lhotov v záznamech|Lhotov|CZ"], { env: AGENT });
    await w.ok(["place", "propose", "L0002", "--conflict", "--candidate", "Лгота|49.6|15.2|по записи прихода"], { env: AGENT });
    // "Always the first candidate (A)": the research's coordinates moved to it as the person's choice; the person's own
    // left to be answered one by one
    const first = await w.ok(["place", "answer", "L0001", "L0002", "--take", "first", "--json"]);
    assert.deepEqual(first.json.done, ["L0001"]);
    assert.deepEqual(first.json.skipped, [{ place: "L0002", why: "take" }]);
    assert.deepEqual(place(w, "L0001").coords, { lat: 49.7, lon: 15.3 });
    assert.equal(place(w, "L0001").locating?.by, "person");
    assert.equal(place(w, "L0001").locating?.kept, undefined);
    assert.equal(place(w, "L0002").locating?.question?.kind, "conflict");
    // don't know of a conflict: the coordinates stay, the question off, never kept as the person's — asked again later
    const dunno = await w.ok(["place", "answer", "L0002", "--take", "unknown", "--json"]);
    assert.deepEqual(dunno.json.done, ["L0002"]);
    const l2 = place(w, "L0002");
    assert.deepEqual(l2.coords, { lat: 50.1, lon: 14.9 });
    assert.equal(l2.locating?.question, undefined);
    assert.equal(l2.locating?.kept, undefined);
    assert.equal(l2.locating?.by, "person");
    assert.ok(l2.locating?.checkWhy);
    await w.ok(["place", "propose", "L0002", "--conflict", "--candidate", "Лгота|49.6|15.2|новая запись"], { env: AGENT });
    // none of them is no answer to a conflict (the app offers it only to which of the candidates)
    const none = await w.run(["place", "answer", "L0002", "--take", "none", "--json"]);
    assert.notEqual(none.code, 0);
    // don't know of a form: the facts left as they write it, the question off
    await w.ok(["place", "rewrite", "H. Lhota", "--to", "L0001", "--propose", "--why", "zkratka?"], { env: AGENT });
    const form = await w.ok(["place", "answer", "L0001", "--take", "unknown", "--json"]);
    assert.equal(form.json.facts, 0);
    assert.equal(place(w, "L0001").locating?.question, undefined);
    const jan = JSON.parse(fs.readFileSync(path.join(w.cwd, "data", "persons", "P0001.json"), "utf8")) as Person;
    assert.equal(jan.events.find((e) => e.kind === "BIRT")!.place, "H. Lhota");
  } finally {
    w.cleanup();
  }
});

test("checked by the research: right with the day, or why it cannot be decided; queued --check only for places on the map", opts, async () => {
  const w = await world();
  try {
    await w.ok(["place", "add", "Horní Lhota", "--lat", "49.61", "--lon", "15.23"]); // the person's: L0001
    const q = await w.ok(["place", "queue", "Horní Lhota", "--json"]);
    assert.deepEqual(q.json.skipped, [{ form: "Horní Lhota", why: "manual" }]);
    const c = await w.ok(["place", "queue", "--all", "--check", "--json"]);
    assert.deepEqual(c.json.queued, ["Horní Lhota"]);
    assert.equal(Object.values(queueFile(w).queue)[0]!.check, true);
    await w.ok(["place", "verify", "L0001", "--ok"], { env: AGENT });
    assert.match(place(w, "L0001").locating?.verified ?? "", /^\d{4}-\d{2}-\d{2}$/u);
    assert.equal(place(w, "L0001").locating?.by, "person", "checked, still the person's");
    assert.deepEqual(queueFile(w).queue, {});
  } finally {
    w.cleanup();
  }
});

test("the session's brief: the batch with what the tree knows, the cheap steps first, only the place's name to the web", opts, async () => {
  const w = await world();
  try {
    await w.ok(["place", "add", "Лгота", "--lat", "50.1", "--lon", "14.9"]); // the person's: L0001
    await w.ok(["place", "queue", "H. Lhota", "Horní Lhota"]);
    await w.ok(["place", "queue", "Лгота", "--check"]);
    const id = placeTasks(w)[0]!.id;
    const out = (await w.ok(["brief", id])).out;
    assert.match(out, /## The places to identify in this session \(3; the whole queue 3\)/u);
    assert.match(out, /"H\. Lhota" — 1 fact 1850 · people P0001 · no record yet/u);
    assert.match(out, /"Лгота" — .*record L0001.*\(the person's — never moved\).*CHECK the coordinates/u);
    assert.match(out, /never a person's name, a date or anything else of the tree/u);
    assert.match(out, /strom place identify/u);
    assert.match(out, /strom place unlocated "<form>" --why "…" --needs/u);
    assert.doesNotMatch(out, /strom history map/u, "history off: no regions asked for");
    assert.doesNotMatch(out, /## Method|## The queue/u);
  } finally {
    w.cleanup();
  }
});

test("one state of not located: history's map writes it into the record, history reads it there, a place identified since waits for its regions again", opts, async () => {
  const w = await world();
  try {
    await w.ok(["config", "set", "experiments.history", "on"], { tty: true, answers: ["a"] });
    const pending = async () => (await w.ok(["history", "status", "--json"])).json.places.pending as string[];
    assert.ok((await pending()).includes("Лгота"));
    await w.ok(["history", "map", "Лгота", "--unlocated", "--why", "tři vsi toho jména"], { env: AGENT });
    const rec = place(w, "L0001");
    assert.equal(rec.names[0]!.name, "Лгота");
    assert.equal(rec.unlocated, "tři vsi toho jména");
    assert.ok(!(await pending()).includes("Лгота"));
    // not located by the identification: history maps it no more either
    await w.ok(["place", "unlocated", "H. Lhota", "--why", "zkratka bez fary"], { env: AGENT });
    assert.ok(!(await pending()).includes("H. Lhota"));
    // identified since: back to history for its regions
    await w.ok(["place", "queue", "Лгота"]);
    await w.ok(["place", "identify", "L0001", "--lat", "55.7", "--lon", "37.6", "--why", "по записи прихода"], { env: AGENT });
    assert.equal(place(w, "L0001").unlocated, undefined);
    assert.ok((await pending()).includes("Лгота"));
  } finally {
    w.cleanup();
  }
});

test("history's places not located before taken into the place records once (decomposed, Cyrillic), a record on the map left alone", opts, async () => {
  const w = await world();
  try {
    await w.ok(["place", "add", "Horní Lhota", "--lat", "49.61", "--lon", "15.23"]); // L0001, the person's
    const tree = Tree.open(w.cwd, w.env);
    const entries = {
      ["Lhotákov".normalize("NFD")]: { state: "unlocated", why: "dvě vsi", at: "2026-10-01T10:00:00.000Z" },
      "Лгота": { state: "unlocated" },
      "Horní Lhota": { state: "unlocated", why: "?" },
      "Lhota, Dlouhá": { state: undefined },
    };
    assert.equal(tree.withTreeLock(() => convertHistoryUnlocated(tree, entries)), 2);
    assert.equal(tree.withTreeLock(() => convertHistoryUnlocated(tree, entries)), 0, "once");
    const made = fs.readdirSync(path.join(w.cwd, "data", "places")).map((f) => JSON.parse(fs.readFileSync(path.join(w.cwd, "data", "places", f), "utf8")) as Place);
    const lhotakov = made.find((p) => p.names[0]!.name === "Lhotákov")!;
    assert.equal(lhotakov.unlocated, "dvě vsi");
    assert.equal(lhotakov.locating?.at, "2026-10-01T10:00:00.000Z");
    assert.match(made.find((p) => p.names[0]!.name === "Лгота")!.unlocated!, /not identified/);
    assert.equal(place(w, "L0001").unlocated, undefined);
    assert.deepEqual(place(w, "L0001").coords, { lat: 49.61, lon: 15.23 });
  } finally {
    w.cleanup();
  }
});
