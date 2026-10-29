// A street is no place: a fact's place is the municipality, the street and the house number its house. A place written
// with a street or a house number is refused with what to write (strom event add|edit --place, person add --born-place,
// family add --married-place); the history of the places keys them by the municipality (one row, one mapping, an older
// mapping under the full text still read); facts written so before: strom check warns, strom fixes show|run|undo
// street-places sets them right by rules (one operation, one commit, free, in an archive too) and puts them back — the
// person's decision alone.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { World, hasGit } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import { owners } from "../../src/core/participants.ts";
import { historyAnswer, PLACES_FILE, readPlaces } from "../../src/core/pastevents.ts";
import { Settings } from "../../src/core/config.ts";
import { stringifyCanonical } from "../../src/core/json.ts";
import { changeLines } from "../../src/core/changelog.ts";
import type { Event } from "../../src/core/model.ts";

const opts = { skip: !hasGit, timeout: 180_000 };

const commits = (w: World) => Number(execFileSync("git", ["-C", w.cwd, "rev-list", "--count", "HEAD"], { encoding: "utf8" }).trim());

/** The place and house of each fact, as they are kept. */
function placesOf(w: World): Record<string, { place?: string; house?: string }> {
  const out: Record<string, { place?: string; house?: string }> = {};
  for (const o of owners(Tree.open(w.cwd, w.env))) for (const e of o.events) out[e.id] = { ...(e.place !== undefined ? { place: e.place } : {}), ...(e.house !== undefined ? { house: e.house } : {}) };
  return out;
}

/** Facts written as an older strom took them: the place with the street, the house number (inside one commit). */
function oldPlaces(w: World, facts: Record<string, { place: string; house?: string }>): void {
  const tree = Tree.open(w.cwd, w.env);
  tree.withTreeLock(() => {
    for (const [id, f] of Object.entries(facts)) {
      const owner = structuredClone(owners(tree).find((o) => o.events.some((e) => e.id === id))!);
      const e = owner.events.find((x) => x.id === id) as Event;
      e.place = f.place;
      if (f.house) e.house = f.house;
      else delete e.house;
      tree.put(owner, { op: "event.update", targets: [id], summary: `${id}: place as an older strom took it` });
    }
    tree.commit("Places as an older strom wrote them");
  });
}

/**
 * The Lhotáks: Jan born at Lhota, Dlouhá 88 (place Lhota, house "Dlouhá 88" — the research's own street), a place record
 * of Lhota (L0001); then nine facts an older strom wrote with the street in the place, one beside of a district part.
 */
async function lhotaci(w: World) {
  await w.withTree("Lhotákovi");
  await w.ok(["place", "add", "Lhota", "--kind", "village"]); // L0001
  const jan = (await w.ok(["person", "add", "Jan /Lhoták/", "--sex", "M", "--json"])).json.person.id;
  const add = async (kind: string, date: string, more: string[] = []) => (await w.ok(["event", "add", jan, kind, "--date", date, "--place", "Lhota", ...more, "--json"])).json.event.id as string;
  const ids = {
    birth: await add("BIRT", "1850", ["--house", "Dlouhá 88"]),
    street: await add("RESI", "1871"),
    number: await add("RESI", "1880"),
    square: await add("RESI", "1890", ["--house", "5"]),
    german: await add("RESI", "1895"),
    cyrillic: await add("RESI", "1900"),
    nfd: await add("RESI", "1905"),
    left: await add("RESI", "1910"),
    district: await add("RESI", "1915"),
    death: await add("DEAT", "1925"),
  };
  oldPlaces(w, {
    [ids.street]: { place: "Lhota, Dlouhá" },
    [ids.number]: { place: "Lhota, Dlouhá 12" },
    [ids.square]: { place: "Lhota, nám. Míru", house: "5" },
    [ids.german]: { place: "Lhotau, Hauptstraße 3" },
    [ids.cyrillic]: { place: "Лхота, ул. Ленина 5" },
    [ids.nfd]: { place: "Lhota, Dlouhá ulice 7".normalize("NFD") },
    [ids.left]: { place: "Lhota, nám. Míru 9", house: "Horní 4" },
    [ids.district]: { place: "Lhota, okres Horní" },
  });
  return ids;
}

test("a place with a street or a house number is refused with what to write; a part of the village or a district passes", opts, async () => {
  const w = new World();
  try {
    await w.withTree("Lhotákovi");
    const jan = (await w.ok(["person", "add", "Jan /Lhoták/", "--sex", "M", "--json"])).json.person.id;
    const r = await w.run(["event", "add", jan, "RESI", "--date", "1871", "--place", "Lhota, nám. Míru 3", "--json"]);
    assert.notEqual(r.code, 0);
    assert.equal(r.json.code, "place.street");
    assert.match(r.json.hint, /--place "Lhota" --house "nám\. Míru 3"/);
    // decomposed, another script, a German street, a house number's marker
    for (const [place, town, house] of [
      ["Lhota, Dlouhá ulice 12".normalize("NFD"), "Lhota", "Dlouhá ulice 12"],
      ["Лхота, ул. Ленина 5", "Лхота", "ул. Ленина 5"],
      ["Lhotau, Hauptstraße 3", "Lhotau", "Hauptstraße 3"],
      ["Lhota č. p. 12", "Lhota", "12"],
      // the municipality, then a street's name and its number: no word of a street needed
      ["Lhota, Polní 5", "Lhota", "Polní 5"],
      ["Lhotín, Horní 3a", "Lhotín", "Horní 3a"],
      ["Lhota, Dlouhá 12/3", "Lhota", "Dlouhá 12/3"],
    ]) {
      const x = await w.run(["event", "add", jan, "RESI", "--date", "1871", "--place", place!, "--json"]);
      assert.equal(x.json.code, "place.street", place);
      assert.equal(x.json.hint.includes(`--place "${town}" --house "${house}"`), true, `${place}: ${x.json.hint}`);
    }
    // the street and a number alone as the house: one house
    const both = await w.run(["event", "add", jan, "RESI", "--date", "1871", "--place", "Lhota, nám. Míru", "--house", "3", "--json"]);
    assert.match(both.json.hint, /--place "Lhota" --house "nám\. Míru 3"/);
    // the other commands that take a place
    const born = await w.run(["person", "add", "Petr /Lhoták/", "--born", "1850", "--born-place", "Lhota, nám. Míru", "--json"]);
    assert.equal(born.json.code, "place.street");
    assert.match(born.json.hint, /--born-place "Lhota", then .*--house "nám\. Míru"/);
    const fam = await w.run(["family", "add", "--partner", jan, "--married", "1875", "--married-place", "Lhota, Dlouhá ulice", "--json"]);
    assert.equal(fam.json.code, "place.street");
    const e = (await w.ok(["event", "add", jan, "RESI", "--date", "1871", "--place", "Lhota", "--house", "Dlouhá 88", "--json"])).json.event.id;
    // a street of the research's own houses: "Dlouhá 88" at Lhota makes "Lhota, Dlouhá" a street
    const edit = await w.run(["event", "edit", e, "--place", "Lhota, Dlouhá", "--json"]);
    assert.equal(edit.json.code, "place.street");
    assert.match(edit.json.hint, /--place "Lhota" --house "Dlouhá 88"/);
    // what is no street passes
    for (const place of ["Lhota, okres Horní", "Lhota, Horní Lhota", "Lhota, St. Martin", "Лхота, Московская область", "Praha 2", "Lhota u Lhotína", "Lhotín, Lhotín 5", "Lhota, 3. díl"])
      await w.ok(["event", "add", jan, "RESI", "--date", "1880", "--place", place]);
    assert.equal(Object.values(placesOf(w)).filter((p) => p.place === "Lhota, Dlouhá").length, 0, "nothing written of the refused");
  } finally {
    w.cleanup();
  }
});

test("strom fixes street-places: strom check warns; show, run (the person's: one operation and one commit), show empty, undo back exactly", opts, async () => {
  const w = new World();
  try {
    const ids = await lhotaci(w);
    const before = placesOf(w);
    // strom check warns, with the fix's name
    const found = (await w.run(["check", "--json"])).json.findings.filter((f: { code: string }) => f.code === "street-place");
    assert.equal(found.length, 1);
    assert.equal(found[0].level, "warn");
    assert.equal(found[0].count, 7);
    assert.equal(found[0].hint, "strom fixes show street-places");
    const show = await w.ok(["fixes", "show", "street-places", "--lang", "en"]);
    assert.match(show.out, /Found: 7 facts with a street or a house number in the place — 6 to be set right by rules, 1 to stay as they are/);
    assert.match(show.out, new RegExp(`${ids.street} · Lhota, Dlouhá → Lhota \\(L0001\\) · house: Dlouhá`));
    assert.match(show.out, new RegExp(`${ids.left} · Lhota, nám\\. Míru 9 · house Horní 4, the place says nám\\. Míru 9: stays as it is`));
    assert.doesNotMatch(show.out, new RegExp(`${ids.district} ·`), "a district stays");
    const j = await w.ok(["fixes", "show", "street-places", "--json"]);
    assert.deepEqual(j.json.found, { count: 7, split: 6, unsplit: 1 });
    assert.equal(j.json.paid, false);
    assert.equal(j.json.remedy, "rewrite");
    const after = Object.fromEntries(j.json.items.map((i: { event: string; after: unknown }) => [i.event, i.after]));
    assert.deepEqual(after, {
      [ids.street]: { place: "Lhota", house: "Dlouhá" },
      [ids.number]: { place: "Lhota", house: "Dlouhá 12" },
      [ids.square]: { place: "Lhota", house: "nám. Míru 5" },
      [ids.german]: { place: "Lhotau", house: "Hauptstraße 3" },
      [ids.cyrillic]: { place: "Лхота", house: "ул. Ленина 5" },
      [ids.nfd]: { place: "Lhota", house: "Dlouhá ulice 7" },
    });
    assert.deepEqual(j.json.left, [{ owner: "P0001", event: ids.left, place: "Lhota, nám. Míru 9", house: "Horní 4", street: "nám. Míru 9", why: "house" }]);
    assert.equal((await w.ok(["fixes", "--json"])).json.checks.find((c: { id: string }) => c.id === "street-places").state, "pending");
    // said in the research's language too (impersonal)
    assert.match((await w.ok(["fixes", "show", "street-places", "--lang", "cs"])).out, /Nalezeno: 7 údajů s ulicí nebo číslem domu v místě/);
    // an agent, a run nobody watches, --yes: never
    for (const env of [{ CLAUDECODE: "1" }, { STROM_NONINTERACTIVE: "1" }] as Record<string, string>[])
      assert.equal((await w.run(["fixes", "run", "street-places"], { env })).code, 4, JSON.stringify(env));
    assert.notEqual((await w.run(["fixes", "run", "street-places", "--yes"], { tty: true, answers: ["1"] })).code, 0);
    assert.deepEqual(placesOf(w), before, "nothing changed");
    const n0 = commits(w);
    const r = await w.ok(["fixes", "run", "street-places", "--lang", "en"], { tty: true, answers: ["1"] });
    assert.match(r.out, /Set right: 6 facts in 1 record\./);
    assert.equal(commits(w), n0 + 1, "one commit");
    const tree = Tree.open(w.cwd, w.env);
    const ops = tree.readOps().filter((o) => o.op === "streetplace.fix");
    assert.equal(ops.length, 1, "one operation");
    assert.ok(ops[0]!.files.some((f) => f.path.endsWith("street-places.json")), "what the undo needs kept with the operation");
    assert.ok(ops[0]!.files.some((f) => f.path === "strom.json"), "the decision in the same operation");
    // what the history says, in the research's language
    assert.deepEqual(changeLines(tree, ops, "", "cs").map((l) => l.text), ["Ulice a čísla domů přesunuty z míst údajů do jejich domů: 6"]);
    const now = placesOf(w);
    assert.deepEqual(now[ids.nfd], { place: "Lhota", house: "Dlouhá ulice 7" });
    assert.equal(now[ids.nfd]!.house, "Dlouhá ulice 7".normalize("NFC"), "written composed");
    assert.deepEqual(now[ids.left], before[ids.left], "the house says another thing: left");
    assert.deepEqual(now[ids.district], before[ids.district]);
    // show: nothing to set right (the one left, still said)
    const empty = await w.ok(["fixes", "show", "street-places", "--json"]);
    assert.deepEqual(empty.json.items, []);
    assert.equal(empty.json.found.split, 0);
    assert.equal(empty.json.state, "fixed");
    assert.equal((await w.run(["check", "--json"])).json.findings.find((f: { code: string }) => f.code === "street-place").count, 1);
    assert.equal((await w.run(["verify", "--json"])).code, 0, "sealed");
    // undo: the person's, back exactly
    for (const env of [{ CLAUDECODE: "1" }, { STROM_NONINTERACTIVE: "1" }] as Record<string, string>[])
      assert.equal((await w.run(["fixes", "undo", "street-places"], { env })).code, 4, JSON.stringify(env));
    assert.notEqual((await w.run(["fixes", "undo", "street-places", "--yes"], { tty: true })).code, 0);
    const n1 = commits(w);
    const u = await w.ok(["fixes", "undo", "street-places", "--lang", "en"], { tty: true });
    assert.match(u.out, /Put back as they were: 6 facts/);
    assert.equal(commits(w), n1 + 1);
    assert.equal(Tree.open(w.cwd, w.env).readOps().filter((o) => o.op === "streetplace.unfix").length, 1);
    assert.deepEqual(placesOf(w), before, "back exactly");
    assert.match((await w.ok(["fixes", "undo", "street-places", "--lang", "en"], { tty: true })).out, /Nothing to put back/);
  } finally {
    w.cleanup();
  }
});

test("strom fixes street-places, strom check: a street's name and its number after the municipality, without a street of the research's houses", opts, async () => {
  const w = new World();
  try {
    await w.withTree("Lhotákovi");
    const jan = (await w.ok(["person", "add", "Jan /Lhoták/", "--sex", "M", "--json"])).json.person.id;
    const a = (await w.ok(["event", "add", jan, "RESI", "--date", "1871", "--place", "Lhota", "--json"])).json.event.id as string;
    const b = (await w.ok(["event", "add", jan, "RESI", "--date", "1880", "--place", "Lhota", "--json"])).json.event.id as string;
    const c = (await w.ok(["event", "add", jan, "RESI", "--date", "1890", "--place", "Lhotín", "--json"])).json.event.id as string;
    oldPlaces(w, { [a]: { place: "Lhota, Dlouhá 12" }, [b]: { place: "Lhota, Polní 5".normalize("NFD") }, [c]: { place: "Lhotín, Lhotín 5" } });
    const found = (await w.run(["check", "--json"])).json.findings.find((f: { code: string }) => f.code === "street-place");
    assert.equal(found?.count, 2);
    const j = await w.ok(["fixes", "show", "street-places", "--json"]);
    assert.deepEqual(Object.fromEntries(j.json.items.map((i: { event: string; after: unknown }) => [i.event, i.after])), {
      [a]: { place: "Lhota", house: "Dlouhá 12" },
      [b]: { place: "Lhota", house: "Polní 5" },
    });
  } finally {
    w.cleanup();
  }
});

test("strom fixes street-places: an undo never over a change since; in an archive shown and set right, nothing of an agent", opts, async () => {
  const w = new World();
  try {
    const ids = await lhotaci(w);
    await w.ok(["mode", "archive"], { tty: true, answers: ["y"] });
    const list = await w.ok(["fixes", "--json"]);
    assert.deepEqual(list.json.checks.map((c: { id: string }) => c.id), ["participant-names", "app-shapes", "street-places"]);
    const show = await w.ok(["fixes", "show", "street-places"]);
    assert.doesNotMatch(show.out, /agent|\bAI\b|umělá inteligence|Claude|Codex|\bmodel/i);
    const r = await w.ok(["fixes", "run", "street-places"], { tty: true, answers: ["1"] });
    assert.doesNotMatch(r.out, /agent|\bAI\b|umělá inteligence|Claude|Codex|\bmodel/i);
    await w.ok(["mode", "research"], { tty: true, answers: ["y"] });
    // a change since: kept by the undo
    await w.ok(["event", "edit", ids.german, "--house", "Hauptstraße 4", "--reason", "read again"]);
    const u = await w.ok(["fixes", "undo", "street-places", "--lang", "en"], { tty: true });
    assert.match(u.out, /Put back as they were: 5 facts · 1 changed since, left as it is/);
    assert.deepEqual(placesOf(w)[ids.german], { place: "Lhotau", house: "Hauptstraße 4" });
    assert.deepEqual(placesOf(w)[ids.street], { place: "Lhota, Dlouhá" });
  } finally {
    w.cleanup();
  }
});

test("the history of the places by the municipality: one row for Lhota and its streets, an older mapping under the full text read", opts, async () => {
  const w = new World();
  try {
    await lhotaci(w);
    await w.ok(["config", "set", "experiments.history", "on"], { tty: true, answers: ["a"] });
    await w.ok(["history", "region", "cz-lhota", "--name-cs", "Lhotsko", "--name-en", "Lhota Land", "--name-de", "Lhotaland"]);
    // an older strom mapped the place as the facts wrote it, with the street
    const tree = Tree.open(w.cwd, w.env);
    tree.withTreeLock(() => {
      const places = { "Lhota, Dlouhá": { regions: [{ id: "cz-lhota", from: 1600 }], at: "2026-10-01T00:00:00.000Z" } };
      tree.putFile(PLACES_FILE, stringifyCanonical({ places }), { op: "history.map", targets: [], summary: "Place Lhota, Dlouhá: cz-lhota:1600-" });
      tree.commit("Mapped as an older strom did");
    });
    const t = Tree.open(w.cwd, w.env);
    assert.deepEqual(Object.keys(readPlaces(t)), ["Lhota"], "read as the municipality's");
    const h = historyAnswer(t, path.join(w.home, "shared"), new Settings(w.env, {}));
    const keys = Object.keys(h.places);
    assert.equal(keys.filter((k) => k.startsWith("Lhota,") && k !== "Lhota, okres Horní").length, 0, `one row for Lhota: ${keys.join(" | ")}`);
    assert.ok(keys.includes("Lhota"));
    assert.deepEqual(h.places["Lhota"]!.regions, [{ id: "cz-lhota", from: 1600 }], "the older mapping");
    // the app pairs the tree's places still written with the street by them
    for (const v of ["Lhota, Dlouhá", "Lhota, Dlouhá 12", "Lhota, nám. Míru"]) assert.ok(h.places["Lhota"]!.also?.includes(v), v);
    // the status says the place once, the street one is no place of its own
    const status = await w.ok(["history", "status", "--json"]);
    assert.doesNotMatch(JSON.stringify(status.json), /Lhota, Dlouhá"/u);
    // a map of the municipality now: one key, the older one gone from the file
    await w.ok(["history", "map", "Lhota, nám. Míru", "--region", "cz-lhota:1650-"]);
    const file = JSON.parse(fs.readFileSync(path.join(w.cwd, ...PLACES_FILE.split("/")), "utf8")).places;
    assert.deepEqual(Object.keys(file).filter((k) => k.startsWith("Lhota") && k !== "Lhota, okres Horní"), ["Lhota"]);
    assert.deepEqual(file["Lhota"].regions, [{ id: "cz-lhota", from: 1650 }]);
  } finally {
    w.cleanup();
  }
});
