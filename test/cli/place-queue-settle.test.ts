// The queue of places empties as the places are dealt with (finding of 1.26.0-beta.1): every step on a place — identify,
// verify, not located, a question, a rewrite of the facts' form, a merge — takes out each entry of the queue that leads
// to the place now, also a form the facts no longer write (rewritten before the step), and only those. What an earlier
// version left hanging is taken out when the queue is next kept (nothing else; undone with strom place undo, and then
// kept). A wrong name of a place record taken off with the reason; the agent's brief shows the record's other names
// with their language and years; verify --source-title; a jurisdiction of one year. Any script, any accent.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";
import type { Place, Task } from "../../src/core/model.ts";
import { Tree } from "../../src/core/tree.ts";
import { parseDrop, parseJurisdiction, PLACE_QUEUE_FILE, readPlacesFile, settledBy, settleQueue } from "../../src/core/placeid.ts";
import { stringifyCanonical } from "../../src/core/json.ts";

const opts = { skip: !hasGit, timeout: 180_000 };
const AGENT = { CLAUDECODE: "1" };

function place(w: World, id: string): Place {
  return JSON.parse(fs.readFileSync(path.join(w.cwd, "data", "places", `${id}.json`), "utf8")) as Place;
}

function queue(w: World): Record<string, { form: string; check?: boolean; back?: true }> {
  const f = path.join(w.cwd, "quality", "places.json");
  return fs.existsSync(f) ? (JSON.parse(fs.readFileSync(f, "utf8")).queue ?? {}) : {};
}

/** Every operation of the tree's history, as text. */
function opsText(w: World): string {
  const dir = path.join(w.cwd, "data", "ops");
  return (fs.readdirSync(dir, { recursive: true }) as string[])
    .filter((f) => f.endsWith(".jsonl"))
    .map((f) => fs.readFileSync(path.join(dir, f), "utf8"))
    .join("\n");
}

const forms = (w: World) => Object.values(queue(w)).map((e) => e.form).sort();

function placesTask(w: World): Task | undefined {
  const dir = path.join(w.cwd, "data", "tasks");
  return (fs.existsSync(dir) ? fs.readdirSync(dir) : [])
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) as Task)
    .find((t) => t.origin === "places:identify" && (t.state === "open" || t.state === "doing"));
}

/** Jan Lhoták born at "H. Lhota", living at "Horní Lhota", died at "Lhota, Dlouhá"; Anna at "Лгота" and "Lhotákov" (NFD). */
async function world(): Promise<World> {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["research", "new", "Předci Jana Lhotáka", "--new-person", "Jan /Lhoták/", "--sex", "M", "--born", "1850", "--born-place", "H. Lhota"]); // P0001
  await w.ok(["event", "add", "P0001", "RESI", "--date", "1870", "--place", "Horní Lhota"]);
  await w.ok(["event", "add", "P0001", "DEAT", "--date", "1925", "--place", "Lhota, Dlouhá"]);
  await w.ok(["person", "add", "Anna /Lhotáková/", "--sex", "F", "--born", "1852", "--born-place", "Лгота"]); // P0002
  await w.ok(["event", "add", "P0002", "RESI", "--date", "1880", "--place", "Lhotákov".normalize("NFD")]);
  return w;
}

test("a form rewritten before the step: verify, not located and identify take its entry out — and only the place's", opts, async () => {
  const w = await world();
  try {
    await w.ok(["place", "queue", "--all"]);
    assert.equal(forms(w).length, 5);
    // a record of the person on the map, the facts' abbreviation rewritten to it first, checked after
    await w.ok(["place", "add", "Horní Lhota", "--lat", "49.61", "--lon", "15.23"]); // L0001
    await w.ok(["place", "queue", "L0001", "--check"]);
    // the old version kept the entry of "H. Lhota" here: the facts write "Horní Lhota" now
    await w.ok(["place", "rewrite", "H. Lhota", "--to", "L0001", "--reason", "zkratka v matrice"], { env: AGENT });
    assert.ok(!forms(w).includes("H. Lhota"), "on the map: the rewritten form's entry out");
    await w.ok(["place", "verify", "L0001", "--ok", "--why", "fara Lhotov", "--source-title", "Místopis", "--source-url", "https://example.org/m"], { env: AGENT });
    assert.deepEqual(place(w, "L0001").locating?.verifiedSource, { title: "Místopis", url: "https://example.org/m" });
    assert.ok(!forms(w).some((f) => f === "Horní Lhota" || f === "H. Lhota"));
    // a record not yet dealt with: the rewrite keeps the entry (still to be done), not located then takes both out
    await w.ok(["place", "add", "Lhotákov"]); // L0002, no coordinates
    await w.ok(["place", "rewrite", "Лгота", "--to", "L0002", "--reason", "azbukou v soupisu"], { env: AGENT });
    assert.ok(forms(w).includes("Лгота"), "the place is still to be done: its entry stays");
    await w.ok(["place", "unlocated", "L0002", "--why", "dvě vsi toho jména", "--needs", "fara záznamu"], { env: AGENT });
    assert.deepEqual(forms(w), ["Lhota, Dlouhá"], "only the place's entries went");
    assert.equal(placesTask(w)?.what.match(/\d+/u)?.[0], "1", "the task says what waits");
    // identify by ID of a form the facts no longer write: the same
    await w.ok(["place", "add", "Dolní Lhota"]); // L0003
    await w.ok(["place", "rewrite", "Lhota, Dlouhá", "--to", "L0003", "--house", "Dlouhá", "--reason", "ulice obce"], { env: AGENT });
    assert.deepEqual(forms(w), ["Lhota, Dlouhá"]);
    await w.ok(["place", "identify", "L0003", "--lat", "49.70", "--lon", "15.40", "--why", "fara Lhotov"], { env: AGENT });
    assert.deepEqual(queue(w), {});
    assert.equal(placesTask(w), undefined, "the queue empty: the task done");
  } finally {
    w.cleanup();
  }
});

test("a merge and identify --form take out the forms that lead to the place now; another place's stay", opts, async () => {
  const w = await world();
  try {
    await w.ok(["place", "identify", "Horní Lhota", "--lat", "49.61", "--lon", "15.23", "--why", "fara Lhotov"], { env: AGENT }); // L0001
    await w.ok(["place", "add", "H. Lhota"]); // L0002, a second record of the same place
    await w.ok(["place", "queue", "H. Lhota", "Лгота"]);
    await w.ok(["place", "merge", "L0002", "--into", "L0001", "--reason", "zkratka téže obce"], { env: AGENT });
    assert.deepEqual(forms(w), ["Лгота"]);
    await w.ok(["place", "queue", "Lhotákov"]);
    await w.ok(["place", "identify", "Лгота", "--lat", "50.1", "--lon", "14.9", "--form", "Lhotákov".normalize("NFD"), "--separate", "L0001", "--why", "fara Lhotov"], { env: AGENT });
    assert.deepEqual(queue(w), {});
  } finally {
    w.cleanup();
  }
});

test("entries an earlier version left hanging: taken out when the queue is kept, nothing else; undone, they stay", opts, async () => {
  const w = await world();
  try {
    await w.ok(["place", "add", "Horní Lhota", "--lat", "49.61", "--lon", "15.23"]); // L0001 on the map
    await w.ok(["place", "unlocated", "Лгота", "--why", "dvě vsi"], { env: AGENT }); // L0002, not located
    await w.ok(["place", "add", "Lhotákov", "--lat", "50.2", "--lon", "15.9"]); // L0003 on the map, to be checked
    const tree = Tree.open(w.cwd, w.env);
    const unlocatedAt = place(w, "L0002").locating!.at;
    const before = (ms: number) => new Date(Date.parse(unlocatedAt) - ms).toISOString();
    const after = (ms: number) => new Date(Date.parse(unlocatedAt) + ms).toISOString();
    // as 1.26.0-beta.1 left it: entries of places dealt with, beside those still to be done
    const hanging = {
      "horni lhota": { form: "Horní Lhota", at: before(60_000), by: "person" }, // on the map since: out
      "лгота": { form: "Лгота", at: before(60_000), by: "person" }, // not located after it was queued: out
      "lhotakov": { form: "Lhotákov", at: before(60_000), by: "person", check: true }, // a check not done: stays
      "lhota, dlouha": { form: "Lhota, Dlouhá", at: before(60_000), by: "person" }, // its record: Lhota? none — stays
      "h. lhota": { form: "H. Lhota", at: before(60_000), by: "person" }, // no record: stays
    };
    tree.withTreeLock(() => tree.putMany([], [{ rel: PLACE_QUEUE_FILE, content: stringifyCanonical({ queue: hanging }) }], { op: "place.queue", targets: [], summary: "queue as an older version left it" }));
    const gone = tree.withTreeLock(() => settleQueue(tree));
    assert.deepEqual(gone.sort(), ["Horní Lhota", "Лгота"].sort());
    assert.deepEqual(forms(w), ["H. Lhota", "Lhota, Dlouhá", "Lhotákov"].sort());
    assert.deepEqual(tree.withTreeLock(() => settleQueue(tree)), [], "once");
    // a place not located queued again after (something new): stays
    const again = { ...readPlacesFile(tree).queue, "лгота": { form: "Лгота", at: after(60_000), by: "research" as const } };
    const undo = readPlacesFile(tree).undo!;
    assert.deepEqual(Object.keys(undo.queue ?? {}).sort(), ["horni lhota", "лгота"].sort());
    tree.withTreeLock(() => tree.putMany([], [{ rel: PLACE_QUEUE_FILE, content: stringifyCanonical({ ...readPlacesFile(tree), queue: again }) }], { op: "place.queue", targets: [], summary: "queued again" }));
    assert.deepEqual(tree.withTreeLock(() => settleQueue(tree)), []);
    // undone by the person: back, and kept there (the queue kept again takes nothing out)
    const u = await w.ok(["place", "undo", undo.id]);
    assert.match(u.out, /1 back in the queue/u, "the one queued again since is not doubled");
    assert.ok(forms(w).includes("Horní Lhota"));
    assert.equal(queue(w)["horni lhota"]!.back, true);
    await w.ok(["place", "queue"]); // keeps the task with the queue
    assert.ok(forms(w).includes("Horní Lhota"), "put back by the person: never taken out by the tidying");
    // the history says it
    assert.match(opsText(w), /"op":"place\.settle"/u);
  } finally {
    w.cleanup();
  }
});

test("a wrong name taken off with its reason: never today's, never one a fact still writes; undone", opts, async () => {
  const w = await world();
  try {
    await w.ok(["place", "identify", "Horní Lhota", "--lat", "49.61", "--lon", "15.23", "--why", "fara Lhotov", "--alt", "Ober Lhota@de:-1945", "--alt", "Лгота Верхняя"], { env: AGENT }); // L0001
    await w.ok(["place", "rewrite", "H. Lhota", "--to", "L0001", "--reason", "zkratka"], { env: AGENT });
    assert.ok(place(w, "L0001").names.some((n) => n.name === "H. Lhota" && n.kind === "form"));
    // today's name and a name the facts write: refused, said how
    const first = await w.run(["place", "names", "L0001", "--drop", "Horní Lhota", "--why", "x"], { env: AGENT });
    assert.notEqual(first.code, 0);
    await w.ok(["event", "add", "P0002", "DEAT", "--date", "1930", "--place", "Лгота Верхняя"]);
    const used = await w.run(["place", "names", "L0001", "--drop", "Лгота Верхняя", "--why", "x"], { env: AGENT });
    assert.notEqual(used.code, 0);
    assert.match(used.out + used.err, /place rewrite/u);
    const noWhy = await w.run(["place", "names", "L0001", "--drop", "H. Lhota"], { env: AGENT });
    assert.notEqual(noWhy.code, 0);
    // a slip no fact writes any more (decomposed input, any accent), and another place's name: off, the reason kept
    const r = await w.ok(["place", "names", "L0001", "--drop", "h. lhota".normalize("NFD"), "--drop", "Ober Lhota", "--why", "překlep v záznamu; německé jméno jiné vsi", "--json"], { env: AGENT });
    assert.deepEqual(r.json.dropped.map((n: { name: string }) => n.name), ["H. Lhota", "Ober Lhota"]);
    assert.ok(!place(w, "L0001").names.some((n) => n.name === "H. Lhota" || n.name === "Ober Lhota"));
    assert.ok(place(w, "L0001").names.some((n) => n.name === "Лгота Верхняя"));
    assert.match(opsText(w), /překlep v záznamu/u);
    // the data check takes the step as reasoned
    await w.ok(["check"]);
    // undone (the person's): the names back
    await w.ok(["place", "undo", r.json.undo]);
    assert.ok(place(w, "L0001").names.some((n) => n.name === "H. Lhota"));
    assert.ok(place(w, "L0001").names.some((n) => n.name === "Ober Lhota" && n.lang === "de"));
  } finally {
    w.cleanup();
  }
});

test("the brief shows the record's other names with language and years; one year of a jurisdiction", opts, async () => {
  const w = await world();
  try {
    await w.ok(["place", "add", "Lhotákov"]); // L0001
    await w.ok(["place", "unlocated", "L0001", "--why", "dvě vsi"], { env: AGENT });
    // something new of it, then queued: the brief names its other names as they are
    const tree = Tree.open(w.cwd, w.env);
    const p = place(w, "L0001");
    tree.withTreeLock(() => tree.putMany([{ ...p, names: [...p.names, { name: "Lhotów", lang: "pl", from: 1945, kind: "alt" }], updated: new Date().toISOString() }], [], { op: "place.names", targets: ["L0001"], summary: "a name" }));
    await w.ok(["place", "queue", "Lhotákov"]);
    const t = placesTask(w)!;
    const b = (await w.ok(["brief", t.id])).out;
    assert.match(b, /Lhotów@pl:1945-/u);
    assert.match(b, /strom place names/u);
    // one year: known so then
    assert.deepEqual(parseJurisdiction("district:Lhotov:1899"), { kind: "district", name: "Lhotov", recordsets: [], from: 1899, to: 1899 });
    assert.deepEqual(parseJurisdiction("parish:Лгота:1784-"), { kind: "parish", name: "Лгота", recordsets: [], from: 1784 });
    assert.throws(() => parseJurisdiction("parish:Lhotov:1900-1800"));
    assert.deepEqual(parseDrop("parish:Lhotov:1899"), { kind: "parish", name: "Lhotov" });
  } finally {
    w.cleanup();
  }
});

test("a check asked of a place queued to be looked for and on the map since: the entry becomes the check, never lost", opts, async () => {
  const w = await world();
  try {
    await w.ok(["place", "queue", "--all"]);
    await w.ok(["place", "add", "Horní Lhota", "--lat", "49.61", "--lon", "15.23"]); // L0001: on the map, its entry still "to be identified"
    const r = await w.ok(["place", "queue", "L0001", "--check", "--json"]);
    assert.deepEqual(r.json.queued, ["Horní Lhota"]);
    assert.equal(queue(w)["horni lhota"]!.check, true);
    await w.ok(["place", "queue"]); // the queue kept (the tidying): the check stays
    assert.equal(queue(w)["horni lhota"]?.check, true, "the person's check kept");
    await w.ok(["place", "verify", "L0001", "--ok", "--why", "fara Lhotov"], { env: AGENT });
    assert.equal(queue(w)["horni lhota"], undefined);
  } finally {
    w.cleanup();
  }
});

test("a check queued after an earlier check: out only by a check after it — never by another step on the place", opts, async () => {
  const w = await world();
  try {
    await w.ok(["place", "identify", "Horní Lhota", "--lat", "49.61", "--lon", "15.23", "--why", "fara Lhotov"], { env: AGENT }); // L0001
    await w.ok(["place", "verify", "L0001", "--ok", "--why", "fara Lhotov"], { env: AGENT });
    assert.ok(place(w, "L0001").locating?.checked, "the time of the check kept");
    await w.ok(["place", "queue", "L0001", "--check"]);
    // another form of the facts written as the record, a wrong name taken off: no check of the coordinates
    await w.ok(["place", "rewrite", "H. Lhota", "--to", "L0001", "--reason", "zkratka v matrice"], { env: AGENT });
    await w.ok(["place", "names", "L0001", "--drop", "H. Lhota", "--why", "zkratka, fakta ji už nepíší"], { env: AGENT });
    assert.equal(queue(w)["horni lhota"]?.check, true, "the check asked stays");
    // undecided earlier: the same
    await w.ok(["place", "verify", "L0001", "--undecided", "dvě vsi toho jména"], { env: AGENT });
    assert.equal(queue(w)["horni lhota"], undefined, "the check done: out");
    await w.ok(["place", "queue", "L0001", "--check"]);
    await w.ok(["place", "rewrite", "Lhota, Dlouhá", "--to", "L0001", "--house", "Dlouhá", "--reason", "ulice obce"], { env: AGENT });
    assert.equal(queue(w)["horni lhota"]?.check, true);
  } finally {
    w.cleanup();
  }
  // what an earlier strom wrote: only the day of a check found right — a later day settles it, the same day does not
  const p = { id: "L0001", type: "place", names: [{ name: "Lhota" }], coords: { lat: 49.6, lon: 15.2 }, updated: "2026-11-03T12:00:00.000Z" } as unknown as Place;
  const e = { form: "Lhota", at: "2026-11-02T10:00:00.000Z", by: "person" as const, check: true as const };
  assert.equal(settledBy({ ...p, locating: { by: "research", at: "2026-11-01T00:00:00.000Z", verified: "2026-11-03" } } as Place, e), true);
  assert.equal(settledBy({ ...p, locating: { by: "research", at: "2026-11-01T00:00:00.000Z", verified: "2026-11-02" } } as Place, e), false);
  assert.equal(settledBy({ ...p, locating: { by: "research", at: "2026-11-01T00:00:00.000Z", checkWhy: "dvě vsi" } } as Place, e), false);
  assert.equal(settledBy({ ...p, locating: { by: "research", at: "2026-11-01T00:00:00.000Z", checkWhy: "dvě vsi", checked: "2026-11-02T10:00:01.000Z" } } as Place, e), true);
  assert.equal(settledBy({ ...p, locating: { by: "research", at: "2026-11-01T00:00:00.000Z", verified: "2026-11-02", checked: "2026-11-02T09:59:59.000Z" } } as Place, e), false);
});

test("every step on places undone by its own id: the tidying and names taken off, each once, a place's later step first", opts, async () => {
  const w = await world();
  try {
    await w.ok(["place", "identify", "Horní Lhota", "--lat", "49.61", "--lon", "15.23", "--why", "fara Lhotov", "--alt", "Ober Lhota@de:-1945", "--alt", "Лгота Верхняя"], { env: AGENT }); // L0001
    const tree = Tree.open(w.cwd, w.env);
    const at = new Date(Date.parse(place(w, "L0001").updated) - 60_000).toISOString();
    tree.withTreeLock(() => tree.putMany([], [{ rel: PLACE_QUEUE_FILE, content: stringifyCanonical({ queue: { "horni lhota": { form: "Horní Lhota", at, by: "person" } } }) }], { op: "place.queue", targets: [], summary: "queue as an older version left it" }));
    tree.withTreeLock(() => tree.commit("queue as an older version left it", ["quality", "data"]));
    tree.markCommitted();
    await w.ok(["place", "queue"]); // the tidying: a step to be undone
    const tidied = readPlacesFile(tree).undo!.id;
    assert.deepEqual(forms(w), []);
    // a step waits already: names taken off are still undone (the old single slot lost it)
    const a = await w.ok(["place", "names", "L0001", "--drop", "Ober Lhota", "--why", "jméno jiné vsi", "--json"], { env: AGENT });
    const b = await w.ok(["place", "names", "L0001", "--drop", "Лгота Верхняя", "--why", "jméno jiné vsi"], { env: AGENT });
    assert.ok(a.json.undo && a.json.undo !== tidied);
    const second = /strom place undo (u[0-9a-z]+)/u.exec(b.out)?.[1];
    assert.ok(second && second !== a.json.undo, "the step's undo said");
    assert.deepEqual([readPlacesFile(tree).undo?.id, ...(readPlacesFile(tree).undos ?? []).map((u) => u.id)].sort(), [tidied, a.json.undo, second].sort());
    // the oldest first (it changed no place); of one place the later step first — the earlier refused till then
    await w.ok(["place", "undo", tidied]);
    assert.deepEqual(forms(w), ["Horní Lhota"]);
    const early = await w.run(["place", "undo", a.json.undo]);
    assert.notEqual(early.code, 0);
    assert.match(early.err + early.out, /later step on the same place/u);
    await w.ok(["place", "undo", second]);
    assert.ok(place(w, "L0001").names.some((n) => n.name === "Лгота Верхняя"));
    await w.ok(["place", "undo", a.json.undo]);
    assert.ok(place(w, "L0001").names.some((n) => n.name === "Ober Lhota" && n.lang === "de"));
    const twice = await w.run(["place", "undo", a.json.undo]);
    assert.notEqual(twice.code, 0, "each once");
    assert.equal(readPlacesFile(tree).undo, undefined);
    assert.equal(readPlacesFile(tree).undos, undefined);
  } finally {
    w.cleanup();
  }
});

test("a form with a check waiting rewritten to another place: the check goes with the facts, never left of no place", opts, async () => {
  const w = await world();
  try {
    await w.ok(["place", "add", "Horní Lhota", "--lat", "49.61", "--lon", "15.23"]); // L0001 on the map
    await w.ok(["place", "queue", "L0001", "--check"]);
    assert.equal(queue(w)["horni lhota"]?.check, true);
    await w.ok(["place", "add", "Dolní Lhota", "--lat", "49.58", "--lon", "15.20"]); // L0002 on the map
    // the facts' "Horní Lhota" was the other village: its name is borne by both records now
    await w.ok(["place", "rewrite", "Horní Lhota", "--to", "L0002", "--reason", "jiná ves v matrice"], { env: AGENT });
    assert.equal(queue(w)["horni lhota"], undefined, "no entry of a form two records bear");
    assert.equal(queue(w)["dolni lhota"]?.check, true, "the check asked goes with the facts to their place");
    const listed = (await w.ok(["place", "queue", "--json"])).json;
    assert.ok(JSON.stringify(listed).includes("L0002"), "the entry leads to a place");
    await w.ok(["place", "verify", "L0001", "--ok", "--why", "fara Lhotov"], { env: AGENT });
    assert.equal(queue(w)["dolni lhota"]?.check, true, "the other place's check settles nothing of it");
    await w.ok(["place", "verify", "L0002", "--ok", "--why", "fara Lhotov"], { env: AGENT });
    assert.deepEqual(Object.values(queue(w)).filter((e) => e.check), [], "checked: out");
    // NFD and another case of the form: the same entry
    await w.ok(["place", "add", "Lhotákov", "--lat", "50.2", "--lon", "15.9"]); // L0003
    await w.ok(["place", "queue", "L0003", "--check"]);
    await w.ok(["place", "add", "Лгота", "--lat", "50.1", "--lon", "15.8"]); // L0004
    await w.ok(["place", "rewrite", "LHOTÁKOV".normalize("NFD"), "--to", "L0004", "--reason", "azbukou v soupisu"], { env: AGENT });
    assert.equal(queue(w)["lhotakov"], undefined);
    assert.equal(Object.values(queue(w)).find((e) => e.form === "Лгота")?.check, true);
  } finally {
    w.cleanup();
  }
});
