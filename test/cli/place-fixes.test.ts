// What a check of the places found set right (the research's places after a live run): a check writes what it found of
// a place into its record — old names, the forms of the facts, a wrong parish taken off — also where the coordinates
// are the person's; no second record of one place (near one: refused, said how to take the form or merge); today's
// name first; a question never makes the person's coordinates the research's; names written with their syntax as text
// parsed; a session on the places says what it did, verified apart from identified. Any script, any accent.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";
import type { Place, Session } from "../../src/core/model.ts";
import { Tree } from "../../src/core/tree.ts";
import { parseAltName, placesSessionCounts, repairPlaces, todayName } from "../../src/core/placeid.ts";
import { splitStreet, streetsOf, STREET_PLACES_FILE } from "../../src/core/streets.ts";
import { streetPlaceFixes } from "../../src/core/streetfix.ts";

const opts = { skip: !hasGit, timeout: 120_000 };
const AGENT = { CLAUDECODE: "1" };

function place(w: World, id: string): Place {
  return JSON.parse(fs.readFileSync(path.join(w.cwd, "data", "places", `${id}.json`), "utf8")) as Place;
}

/** Every operation the research logged, one per line. */
function opsText(w: World): string {
  const all: string[] = [];
  const walk = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.isDirectory()) walk(path.join(d, e.name));
      else if (e.name.endsWith(".jsonl")) all.push(fs.readFileSync(path.join(d, e.name), "utf8"));
    }
  };
  walk(path.join(w.cwd, "data", "ops"));
  return all.join("\n");
}

function queued(w: World): string[] {
  const f = path.join(w.cwd, "quality", "places.json");
  return fs.existsSync(f) ? Object.values((JSON.parse(fs.readFileSync(f, "utf8")) as { queue: Record<string, { form: string }> }).queue).map((e) => e.form) : [];
}

/** Jan Lhoták born at "Lhoty" 1850, living at "Nové Lhoty" 1875, his son at "Lhotsberg am Lhotbach" and "Lhotsberg n.Lhotkou, Lhotsko". */
async function world(lang?: string): Promise<World> {
  const w = new World();
  if (lang) w.env.STROM_LANG = lang;
  await w.withTree("Lhotákovi");
  await w.ok(["person", "add", "Jan /Lhoták/", "--sex", "M", "--born", "1850", "--born-place", "Lhoty"]); // P0001
  await w.ok(["event", "add", "P0001", "RESI", "--date", "1875", "--place", "Nové Lhoty"]);
  await w.ok(["person", "add", "Josef /Lhoták/", "--sex", "M", "--born", "1880", "--born-place", "Lhotsberg am Lhotbach"]); // P0002
  await w.ok(["event", "add", "P0002", "RESI", "--date", "1900", "--place", "Lhotsberg n.Lhotkou, Lhotsko"]);
  await w.ok(["event", "add", "P0002", "DEAT", "--date", "1910", "--place", "Лготовo"]);
  return w;
}

test("P1: a check writes what it found into the record of the person's place — old names, a form of the facts, a wrong parish taken off, said why", opts, async () => {
  const w = await world();
  try {
    await w.ok(["place", "add", "Lhoty", "--lat", "50.1", "--lon", "14.9"]); // the person's: L0001
    await w.ok(["place", "jurisdiction", "L0001", "--kind", "parish", "--name", "Lhotov"]);
    await w.ok(["place", "queue", "Lhoty", "Nové Lhoty"]);
    // taking a jurisdiction off needs the reason
    const no = await w.run(["place", "verify", "L0001", "--ok", "--drop-jurisdiction", "parish:Lhotov"], { env: AGENT });
    assert.notEqual(no.code, 0);
    assert.match(no.out + no.err, /--why/);
    const r = await w.ok(
      [
        "place", "verify", "L0001", "--ok",
        "--why", "fara Lhotice podle matrik; Lhotov je fara pramene",
        "--alt", "Lhotten@de:1850-1918", "--alt", "Lhoty Nowe@pl:1844",
        "--form", "Nové Lhoty",
        "--drop-jurisdiction", "parish:Lhotov",
        "--jurisdiction", "parish:Lhotice:1784-",
        "--json",
      ],
      { env: AGENT },
    );
    assert.deepEqual(r.json.dropped.map((j: { name: string }) => j.name), ["Lhotov"]);
    const p = place(w, "L0001");
    assert.deepEqual(p.coords, { lat: 50.1, lon: 14.9 }, "the person's coordinates never moved");
    assert.equal(p.locating?.by, "person");
    assert.ok(p.locating?.verified);
    assert.match(p.locating?.verifiedWhy ?? "", /fara Lhotice/u);
    const names = Object.fromEntries(p.names.map((n) => [n.name, n]));
    assert.equal(p.names[0]!.name, "Lhoty", "the first name stays the person's");
    assert.deepEqual([names["Lhotten"]?.lang, names["Lhotten"]?.from, names["Lhotten"]?.to], ["de", 1850, 1918]);
    assert.deepEqual([names["Lhoty Nowe"]?.from, names["Lhoty Nowe"]?.to], [1844, 1844], "one year: known from it, no more");
    assert.equal(names["Nové Lhoty"]?.kind, "form");
    assert.deepEqual(p.jurisdictions.map((j) => `${j.kind}:${j.name}`), ["parish:Lhotice"]);
    assert.deepEqual(queued(w), [], "the form taken out of the queue with its record");
    // the history of the record says why the parish went
    assert.match(opsText(w), /"op":"place\.verify"[^\n]*"reason":"fara Lhotice/u);
  } finally {
    w.cleanup();
  }
});

test("P1: no second record of one place — near one refused with how to take the form or merge; --separate; merge keeps everything (Lhotsberg twice)", opts, async () => {
  const w = await world();
  try {
    await w.ok(["place", "queue", "--all"]);
    await w.ok(
      ["place", "identify", "Lhotsberg am Lhotbach", "--lat", "50.73", "--lon", "16.24", "--name", "Lhotów Dolny", "--alt", "Lhotsberg am Lhotbach@de:1257-1945", "--jurisdiction", "district:Lhotów", "--why", "město na Lhotce, dnes za hranicí"],
      { env: AGENT },
    ); // L0001
    const twice = await w.run(["place", "identify", "Lhotsberg n.Lhotkou, Lhotsko", "--lat", "50.7312", "--lon", "16.2405", "--why", "totéž město", "--json"], { env: AGENT });
    assert.notEqual(twice.code, 0);
    assert.match(twice.out + twice.err, /place\.near|written twice/);
    const hint = String(JSON.parse(twice.out || twice.err).hint);
    assert.match(hint, /strom place verify L0001 --ok --form "Lhotsberg n\.Lhotkou, Lhotsko"/);
    assert.match(hint, /--separate L0001/);
    assert.equal(fs.readdirSync(path.join(w.cwd, "data", "places")).length, 1, "nothing written");
    // the way the error said: the form into the record
    await w.ok(["place", "verify", "L0001", "--ok", "--form", "Lhotsberg n.Lhotkou, Lhotsko", "--why", "totéž město"], { env: AGENT });
    assert.ok(place(w, "L0001").names.some((n) => n.name === "Lhotsberg n.Lhotkou, Lhotsko" && n.kind === "form"));
    assert.ok(!queued(w).includes("Lhotsberg n.Lhotkou, Lhotsko"));

    // a place close by that is another (a neighbour): --separate
    const nb = await w.ok(["place", "identify", "Лготовo", "--lat", "50.735", "--lon", "16.25", "--name", "Lhotówek", "--why", "sousední ves", "--separate", "L0001", "--json"], { env: AGENT });
    assert.equal(nb.json.place.id, "L0002");

    // two records of one place made one: the person's coordinates win, names and jurisdictions kept, the other retracted
    await w.ok(["place", "add", "Lhotsberg", "--lat", "50.7301", "--lon", "16.2399"]); // the person's: L0003
    const far = await w.ok(["place", "add", "Lhotsberg am Meer", "--lat", "54.1", "--lon", "12.1"]); // L0004
    assert.ok(far);
    const refused = await w.run(["place", "merge", "L0004", "--into", "L0001", "--reason", "totéž"], { env: AGENT });
    assert.notEqual(refused.code, 0);
    assert.match(refused.out + refused.err, /place\.far|km/);
    await w.ok(["place", "merge", "L0003", "--into", "L0001", "--reason", "totéž město, zapsané osobou"], { env: AGENT });
    const into = place(w, "L0001");
    const dup = place(w, "L0003");
    assert.ok(dup.retracted, "the duplicate retracted, never deleted");
    assert.equal(dup.mergedInto, "L0001");
    assert.deepEqual(into.coords, { lat: 50.7301, lon: 16.2399 }, "the person's coordinates win");
    assert.equal(into.locating?.by, "person");
    assert.ok(into.names.some((n) => n.name === "Lhotsberg"));
    assert.ok(into.jurisdictions.some((j) => j.name === "Lhotów"));
  } finally {
    w.cleanup();
  }
});

test("P2: today's name first — given or the one other name in use since a year with no end; an older record set right once, undone", opts, async () => {
  const w = await world();
  try {
    await w.ok(["place", "queue", "--all"]);
    const r = await w.ok(
      ["place", "identify", "Lhotsberg am Lhotbach", "--lat", "50.73", "--lon", "16.24", "--alt", "Lhotów Dolny@pl:1945-", "--why", "město na Lhotce", "--json"],
      { env: AGENT },
    );
    assert.equal(r.json.today, "Lhotów Dolny");
    const p = place(w, "L0001");
    assert.equal(p.names[0]!.name, "Lhotów Dolny");
    const old = p.names.find((n) => n.name === "Lhotsberg am Lhotbach");
    assert.equal(old?.kind, "form", "the German name kept, the facts' form of it");
    // the same rule alone (pure): no today's name where the facts are after the other name begins and the first still runs
    assert.equal(todayName({ names: [{ name: "Lhoty" }, { name: "Lhotten", lang: "de", from: 1939 }] } as Place, [1850]), undefined);
  } finally {
    w.cleanup();
  }
});

test("P2: places identified before set right once — syntax parsed, today's name first, the person's origin back, the history's names in the record; undone", opts, async () => {
  const w = await world();
  try {
    await w.ok(["place", "add", "Lhotau@cs:1844"]); // L0001: an older strom kept the syntax whole — now parsed at once
    assert.deepEqual(place(w, "L0001").names[0], { name: "Lhotau", lang: "cs", from: 1844, to: 1844 });
    // written as an older strom left them
    const tree = Tree.open(w.cwd, w.env);
    const at = new Date().toISOString();
    const raw = (id: string, names: Place["names"], extra: Partial<Place> = {}) =>
      ({ id, type: "place", names, jurisdictions: [], notes: [], created: at, updated: at, ...extra }) as Place;
    const syntax = raw("L0101", [{ name: "Lhotow@cs:1844" }], { coords: { lat: 50, lon: 15 }, locating: { by: "research", at, why: "x" } });
    const german = raw("L0102", [{ name: "Lhotsdorf", lang: "de" }, { name: "Lhotowo", lang: "pl", from: 1945, kind: "alt" }], {
      coords: { lat: 50.9, lon: 16.6 },
      locating: { by: "research", at, why: "ves u Lhotky" },
    });
    const asked = raw("L0103", [{ name: "Lhoty Dolní" }], {
      coords: { lat: 49.5, lon: 15.5 },
      // P3 of an older strom: a question on coordinates nobody kept the origin of made them the research's
      locating: { by: "research", at, question: { kind: "conflict", at, candidates: [] } } as unknown as Place["locating"],
    });
    tree.withTreeLock(() => {
      tree.putMany([syntax, german, asked], [], { op: "place.add", targets: ["L0101", "L0102", "L0103"], summary: "older records" });
      tree.commit("older records");
    });
    const said = repairPlaces(Tree.open(w.cwd, w.env));
    assert.ok(said.length, "something set right");
    assert.deepEqual(place(w, "L0101").names[0], { name: "Lhotow", lang: "cs", from: 1844, to: 1844 });
    assert.equal(place(w, "L0102").names[0]!.name, "Lhotowo");
    assert.ok(place(w, "L0102").names.some((n) => n.name === "Lhotsdorf"), "no name lost");
    assert.equal(place(w, "L0103").locating?.by, "person", "the person's hand back");
    assert.deepEqual(place(w, "L0103").coords, { lat: 49.5, lon: 15.5 });
    // the data check takes the repair: a name read from its syntax is no name removed (1.26.0-beta.1 left it uncommitted)
    await w.ok(["check"]);
    // once: a second time nothing
    assert.deepEqual(repairPlaces(Tree.open(w.cwd, w.env)), []);
    // undone: as they were
    const pf = JSON.parse(fs.readFileSync(path.join(w.cwd, "quality", "places.json"), "utf8")) as { undo?: { id: string } };
    assert.ok(pf.undo?.id);
    await w.ok(["place", "undo", pf.undo!.id]);
    assert.equal(place(w, "L0102").names[0]!.name, "Lhotsdorf");
    assert.equal(place(w, "L0101").names[0]!.name, "Lhotow@cs:1844");
    await w.ok(["check"]);
  } finally {
    w.cleanup();
  }
});

test("P3: a question on a place nobody kept the origin of never makes its coordinates the research's (Praha XI)", opts, async () => {
  const w = await world();
  try {
    // coordinates an older strom wrote without who put them there: the person's
    const tree = Tree.open(w.cwd, w.env);
    const at = new Date().toISOString();
    tree.withTreeLock(() =>
      tree.putMany([{ id: "L0001", type: "place", names: [{ name: "Lhota XI" }], jurisdictions: [], notes: [], coords: { lat: 50.092, lon: 14.388 }, created: at, updated: at } as unknown as Place], [], {
        op: "place.add",
        targets: ["L0001"],
        summary: "an older record",
      }),
    );
    tree.commit("an older record");
    // the research may not move them …
    const moved = await w.run(["place", "identify", "L0001", "--lat", "50.08", "--lon", "14.45", "--why", "Lhota XI byla jinde"], { env: AGENT });
    assert.notEqual(moved.code, 0);
    // … only ask; asked, they stay the person's
    await w.ok(["place", "propose", "L0001", "--conflict", "--candidate", "Lhota XI|50.08|14.45|čtvrť podle záznamu|Lhota|CZ"], { env: AGENT });
    const p = place(w, "L0001");
    assert.equal(p.locating?.question?.kind, "conflict");
    assert.equal(p.locating?.by, "person");
    assert.deepEqual(p.coords, { lat: 50.092, lon: 14.388 });
    const again = await w.run(["place", "identify", "L0001", "--lat", "50.08", "--lon", "14.45", "--why", "znovu"], { env: AGENT });
    assert.notEqual(again.code, 0, "still the person's after the question");
  } finally {
    w.cleanup();
  }
});

test("P4: a session on the places says what it did — verified apart from identified — in the research's language", opts, async () => {
  const w = await world("cs");
  try {
    await w.ok(["place", "add", "Lhoty", "--lat", "50.1", "--lon", "14.9"]); // the person's: L0001
    await w.ok(["place", "queue", "Lhoty", "Nové Lhoty", "Лготовo"]);
    const task = JSON.parse((await w.ok(["task", "list", "--json"])).out).tasks?.find?.((t: { origin?: string }) => t.origin === "places:identify") ?? undefined;
    const tid = task?.id ?? fs.readdirSync(path.join(w.cwd, "data", "tasks")).map((f) => f.replace(/\.json$/, "")).find((id) => JSON.parse(fs.readFileSync(path.join(w.cwd, "data", "tasks", `${id}.json`), "utf8")).origin === "places:identify")!;
    await w.ok(["session", "start", tid], { env: AGENT });
    await w.ok(["place", "verify", "L0001", "--ok", "--why", "fara podle matrik"], { env: AGENT });
    await w.ok(["place", "identify", "Nové Lhoty", "--lat", "50.3", "--lon", "15.1", "--why", "fara Lhotice", "--separate", "L0001"], { env: AGENT });
    await w.ok(["place", "unlocated", "Лготовo", "--why", "tři vsi toho jména", "--needs", "fara"], { env: AGENT });
    await w.ok(["session", "close", "--done", "fara Lhotice potvrzena", "--next", "nic"], { env: AGENT });
    const dir = path.join(w.cwd, "data", "sessions");
    const s = fs.readdirSync(dir).map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) as Session).find((x) => x.task === tid)!;
    assert.equal(s.summary, "ztotožněno 1, ověřeno 1 (už ztotožněná, zkontrolováno), nedohledáno 1 — fara Lhotice potvrzena");
    assert.equal(placesSessionCounts(Tree.open(w.cwd, w.env), "N9999"), "", "a session that did nothing: nothing said");
  } finally {
    w.cleanup();
  }
});

test("names with their syntax: one year known from it, the syntax left in a name refused; a sentence before a house number (v Lhotici v čp. 46)", () => {
  assert.deepEqual(parseAltName("Lhotau@DE:1850-1918"), { name: "Lhotau", lang: "de", from: 1850, to: 1918 });
  assert.deepEqual(parseAltName("Lhotowo@pl:1945-"), { name: "Lhotowo", lang: "pl", from: 1945 });
  assert.deepEqual(parseAltName("Лгота@ru:1844"), { name: "Лгота", lang: "ru", from: 1844, to: 1844 });
  assert.deepEqual(parseAltName("Lhotice".normalize("NFD")), { name: "Lhotice" });
  assert.throws(() => parseAltName("Lhotau@de@cs:1850"), /invalid name/);
  assert.throws(() => parseAltName("Lhotau:1918-1850"), /backwards/);
  assert.deepEqual(splitStreet("v Lhotici v čp.46"), { town: "Lhotici", house: "46", by: "word", sentence: true });
  assert.deepEqual(splitStreet("ve Lhotě č. p. 7".normalize("NFD")), { town: "Lhotě", house: "7", by: "word", sentence: true });
  assert.deepEqual(splitStreet("in Lhotau Nr. 3"), { town: "Lhotau", house: "3", by: "word", sentence: true });
  assert.deepEqual(splitStreet("U Lípy č. p. 3"), { town: "U Lípy", house: "3", by: "word" }, "a name in capitals stays whole");
  assert.deepEqual(splitStreet("Lhota č. p. 12"), { town: "Lhota", house: "12", by: "word" });
});

test("what an older fix of streets left of a sentence (\"v Lhotici v\" + house 46) offered again, the house kept", opts, async () => {
  const w = new World();
  try {
    await w.withTree("Lhotákovi");
    await w.ok(["person", "add", "Jan /Lhoták/", "--sex", "M", "--born", "1850", "--born-place", "v Lhotici v"]); // P0001
    const tree = Tree.open(w.cwd, w.env);
    const ev = tree.get<{ events: { id: string; place?: string }[] } & Place>("P0001")!.events[0]!;
    // the house as the older fix wrote it, and its run kept
    await w.ok(["event", "edit", ev.id, "--house", "46"]);
    const run = { v: 1, runs: [{ at: "2026-10-29T05:20:39.259Z", version: "1.22.0", items: [{ owner: "P0001", event: ev.id, before: { place: "v Lhotici v čp.46" }, after: { place: "v Lhotici v", house: "46" } }] }] };
    const t2 = Tree.open(w.cwd, w.env);
    t2.withTreeLock(() => t2.putMany([], [{ rel: STREET_PLACES_FILE, content: JSON.stringify(run, null, 2) + "\n" }], { op: "streetplace.fix", targets: [], summary: "an older fix" }));
    t2.commit("an older fix");
    const f = streetPlaceFixes(Tree.open(w.cwd, w.env));
    assert.deepEqual(f.fixes.map((x) => [x.event, x.before, x.after]), [[ev.id, { place: "v Lhotici v", house: "46" }, { place: "Lhotici", house: "46" }]]);
  } finally {
    w.cleanup();
  }
});

test("a municipality in a sentence in another case: the one the research writes of the same word (v Lhotici v → Lhotice), none where two could be or none is", opts, async () => {
  const w = new World();
  try {
    await w.withTree("Lhotákovi");
    await w.ok(["person", "add", "Jan /Lhoták/", "--sex", "M", "--born", "1850", "--born-place", "v Lhotici v"]); // P0001
    await w.ok(["person", "add", "Anna /Lhoták/", "--sex", "F", "--born", "1852", "--born-place", "Lhotice"]); // P0002
    await w.ok(["person", "add", "Petr /Lhoták/", "--sex", "M", "--born", "1855", "--born-place", "Lhotka"]); // P0003
    await w.ok(["place", "add", "Лготово"]); // L0001: a record of another script
    const tree = Tree.open(w.cwd, w.env);
    const ev = tree.get<{ events: { id: string }[] } & Place>("P0001")!.events[0]!;
    await w.ok(["event", "edit", ev.id, "--house", "46"]);
    const run = { v: 1, runs: [{ at: "2026-10-29T05:20:39.259Z", version: "1.22.0", items: [{ owner: "P0001", event: ev.id, before: { place: "v Lhotici v čp.46" }, after: { place: "v Lhotici v", house: "46" } }] }] };
    const t2 = Tree.open(w.cwd, w.env);
    t2.withTreeLock(() => t2.putMany([], [{ rel: STREET_PLACES_FILE, content: JSON.stringify(run, null, 2) + "\n" }], { op: "streetplace.fix", targets: [], summary: "an older fix" }));
    t2.commit("an older fix");
    const f = streetPlaceFixes(Tree.open(w.cwd, w.env));
    assert.deepEqual(f.fixes.map((x) => [x.event, x.after]), [[ev.id, { place: "Lhotice", house: "46" }]], "Lhotici is Lhotice, which the research writes");
    const streets = streetsOf(Tree.open(w.cwd, w.env));
    assert.equal(streets.placeOf("ve Lhotici č. p. 3".normalize("NFD")), "Lhotice", "any accent, decomposed");
    assert.equal(streets.placeOf("v Лготове д. 5"), "Лготово", "another script alike");
    assert.equal(streets.townOf("Lhotě", true), "Lhotě", "Lhotka is another municipality, not Lhota");
    assert.equal(streets.townOf("Lhotici", false), "Lhotici", "not in a sentence: as written");
  } finally {
    w.cleanup();
  }
});

test("a name of no language the record has already, with its language or without, is not written again; one written twice by an older strom kept once, undone", opts, async () => {
  const w = await world();
  try {
    await w.ok(["place", "add", "Lhoty", "--lat", "50.1", "--lon", "14.9"]); // L0001
    // another name with its language, then the same of none (history's map, a check): once
    await w.ok(["place", "verify", "L0001", "--ok", "--alt", "Lhotau@de:-1945", "--why", "staré mapy"]);
    await w.ok(["place", "verify", "L0001", "--ok", "--alt", "Lhotau", "--alt", "Lhoty", "--why", "staré mapy"]);
    assert.deepEqual(place(w, "L0001").names.filter((n) => n.name === "Lhotau"), [{ name: "Lhotau", lang: "de", to: 1945, kind: "alt" }]);
    assert.equal(place(w, "L0001").names.filter((n) => n.name === "Lhoty").length, 1, "today's name not again");
    // the other way round: one of none first, then with its language — the one that says more takes its place
    await w.ok(["place", "verify", "L0001", "--ok", "--alt", "Lhotowo", "--why", "staré mapy"]);
    await w.ok(["place", "verify", "L0001", "--ok", "--alt", "Lhotowo@pl:1900-1940", "--why", "staré mapy"]);
    assert.deepEqual(place(w, "L0001").names.filter((n) => n.name === "Lhotowo"), [{ name: "Lhotowo", lang: "pl", from: 1900, to: 1940, kind: "alt" }]);
    // as an older strom left them: a name twice (Лгота@ru and Лгота, Lhotsdorf of today and again), a name of none and its own years kept
    const tree = Tree.open(w.cwd, w.env);
    const at = new Date().toISOString();
    const twice = {
      id: "L0101",
      type: "place",
      names: [
        { name: "Lhotsdorf" },
        { name: "Лгота", lang: "ru", from: 1844, to: 1844, kind: "alt" },
        { name: "Lhotow", lang: "de", kind: "alt" },
        { name: "Лгота".normalize("NFD"), kind: "alt" },
        { name: "lhotow", kind: "alt" },
        { name: "Lhotsdorf", kind: "alt" },
        { name: "Lhotow", from: 1700, to: 1800, kind: "alt" },
        { name: "Lhotsdorfu", kind: "form" },
      ],
      jurisdictions: [],
      notes: [],
      created: at,
      updated: at,
      coords: { lat: 50, lon: 15 },
      locating: { by: "person", at },
    } as unknown as Place;
    tree.withTreeLock(() => tree.putMany([twice], [], { op: "place.add", targets: ["L0101"], summary: "older records" }));
    const said = repairPlaces(Tree.open(w.cwd, w.env));
    assert.ok(said.some((x) => x.startsWith("L0101 written twice")), said.join("\n"));
    assert.deepEqual(
      place(w, "L0101").names.map((n) => [n.name, n.lang ?? "", n.from ?? "", n.to ?? ""]),
      [
        ["Lhotsdorf", "", "", ""],
        ["Лгота", "ru", 1844, 1844],
        ["Lhotow", "de", "", ""],
        ["Lhotow", "", 1700, 1800],
        ["Lhotsdorfu", "", "", ""],
      ],
    );
    const pf = JSON.parse(fs.readFileSync(path.join(w.cwd, "quality", "places.json"), "utf8")) as { undo?: { id: string } };
    await w.ok(["place", "undo", pf.undo!.id]);
    assert.equal(place(w, "L0101").names.length, 8, "undone: as it was");
  } finally {
    w.cleanup();
  }
});
