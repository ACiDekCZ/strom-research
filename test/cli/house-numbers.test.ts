// The house numbers of facts an older strom left so that one house was two (spec 030 K1.5), set right by strom fixes
// house-numbers on a person's word alone: a marker before a number alone taken off ("čp. 16" → "16"), a marker before
// a street ("čp. Dlouhá 12" → "Dlouhá 12"), the one house number of a note the house of a fact with none; a note naming
// more numbers left with why; decomposed input and a non-Latin script the same; free, one operation, undone exactly,
// never over a change since; in an archive too. Made-up names only.

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { World, hasGit } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import { changeLines } from "../../src/core/changelog.ts";
import type { Event, Person } from "../../src/core/model.ts";

const opts = { skip: !hasGit, timeout: 180_000 };
const AGENT = { env: { CLAUDECODE: "1" } };

const commits = (w: World) => Number(execFileSync("git", ["-C", w.cwd, "rev-list", "--count", "HEAD"], { encoding: "utf8" }).trim());
const open = (w: World) => Tree.open(w.cwd, w.env);
const personOf = (w: World, id: string) => open(w).get<Person>(id)!;
const eventOf = (w: World, id: string) => open(w).list<Person>("person").flatMap((p) => p.events).find((e) => e.id === id)!;

/** Facts as an older strom wrote them (inside one commit). */
function asOlder(w: World, id: string, change: (p: Person) => void): void {
  const tree = open(w);
  tree.withTreeLock(() => {
    const p = structuredClone(tree.get<Person>(id)!);
    change(p);
    tree.put(p, { op: "person.update", targets: [id], summary: `${id}: as an older strom wrote it` });
    tree.commit("As an older strom wrote it");
  });
}

/** The Lhoták village as an older strom left it: each fact's house and note as `facts` say. */
async function older(w: World) {
  await w.withTree("Lhotákovi");
  const add = async (name: string, born: string) => (await w.ok(["person", "add", name, "--sex", "M", "--born", born, "--json"])).json.person.id as string;
  const ids = { kapradin: await add("Kapradin /Lhoták/", "1850"), mlhoslav: await add("Mlhoslav /Lhoták/", "1852"), hromoslav: await add("Hromoslav /Prouzal/", "1854") };
  const facts = {
    mark: ["kapradin", "Lhota", { house: "čp. 16" }],
    plain: ["kapradin", "Lhota", { house: "16" }],
    haus: ["mlhoslav", "Bělokamen", { house: "Haus Nr. 3".normalize("NFD") }],
    street: ["mlhoslav", "Bělokamen", { house: "čp. Dlouhá 12".normalize("NFD") }],
    other: ["mlhoslav", "Bělokamen", { house: "Haus am Markt" }],
    note: ["hromoslav", "Lhota", { note: "Adresa: čp. 13".normalize("NFD") }],
    several: ["hromoslav", "Lhota", { note: "bydlel v čp. 13, později čp. 14" }],
    entry: ["hromoslav", "Lhota", { note: "matrika č. 5, fol. 12" }],
    cyrillic: ["hromoslav", "Лхота", { house: "дом 7" }],
  } satisfies Record<string, [keyof typeof ids, string, Partial<Event>]>;
  type Fact = keyof typeof facts;
  const ev = {} as Record<Fact, string>;
  for (const [k, [who, place]] of Object.entries(facts))
    ev[k as Fact] = (await w.ok(["event", "add", ids[who], "RESI", "--date", "1880", "--place", place, "--json"])).json.event.id as string;
  for (const who of Object.keys(ids) as (keyof typeof ids)[])
    asOlder(w, ids[who], (p) => {
      for (const [k, [owner, , keep]] of Object.entries(facts)) if (owner === who) Object.assign(p.events.find((e) => e.id === ev[k as Fact])!, keep);
    });
  // a note of a number on a fact of no place: a house is of a municipality — not offered
  const placeless = (await w.ok(["event", "add", ids.kapradin, "OCCU", "--value", "kovář", "--date", "1880", "--json"])).json.event.id as string;
  asOlder(w, ids.kapradin, (p) => {
    p.events.find((e) => e.id === placeless)!.note = "čp. 21";
  });
  return { ids, ev };
}

test("strom fixes house-numbers: found by rules (NFD, Cyrillic), a note of more numbers left; nothing without the person; set right in one operation, idempotent, undone exactly", opts, async () => {
  const w = new World();
  try {
    const { ids, ev } = await older(w);
    const before = Object.fromEntries(Object.entries(ids).map(([k, id]) => [k, personOf(w, id)]));
    const j = await w.ok(["fixes", "show", "house-numbers", "--json"]);
    assert.equal(j.json.remedy, "rewrite");
    assert.equal(j.json.paid, false);
    const items = Object.fromEntries(j.json.items.map((i: { event: string }) => [i.event, i]));
    assert.deepEqual(Object.keys(items).sort(), [ev.mark, ev.haus, ev.street, ev.note, ev.cyrillic].sort());
    assert.deepEqual(items[ev.mark], { owner: ids.kapradin, event: ev.mark, how: "mark", before: "čp. 16", after: "16" });
    assert.deepEqual([items[ev.haus].how, items[ev.haus].after], ["mark", "3"]);
    assert.deepEqual([items[ev.street].how, items[ev.street].after], ["street", "Dlouhá 12"], "NFC");
    assert.deepEqual(items[ev.note], { owner: ids.hromoslav, event: ev.note, how: "note", after: "13" });
    assert.deepEqual([items[ev.cyrillic].how, items[ev.cyrillic].after], ["mark", "7"]);
    assert.deepEqual(j.json.left, [{ owner: ids.hromoslav, event: ev.several, why: "several", numbers: ["13", "14"] }]);
    assert.equal((await w.ok(["fixes", "--json"])).json.checks.find((c: { id: string }) => c.id === "house-numbers").state, "pending");
    const show = await w.ok(["fixes", "show", "house-numbers", "--lang", "en"]);
    assert.match(show.out, /Found: 6 facts with a house number written another way — 5 to be set right by rules, 1 to stay as they are/u);
    assert.match(show.out, new RegExp(`${ids.kapradin} · ${ev.mark.replace(/\./gu, "\\.")}: "čp\\. 16" → "16"`, "u"));
    assert.match(show.out, new RegExp(`${ev.note.replace(/\./gu, "\\.")}: the house "13" from its note`, "u"));
    assert.match(show.out, new RegExp(`${ev.several.replace(/\./gu, "\\.")}: its note names more numbers \\(13, 14\\) — stays as it is`, "u"));
    assert.match((await w.ok(["fixes", "show", "house-numbers", "--lang", "cs"])).out, /Nalezeno: 6 údajů s číslem domu zapsaným jinak/u);
    // never without the person
    for (const env of [{ CLAUDECODE: "1" }, { STROM_NONINTERACTIVE: "1" }] as Record<string, string>[])
      assert.equal((await w.run(["fixes", "run", "house-numbers"], { env })).code, 4, JSON.stringify(env));
    for (const [k, id] of Object.entries(ids)) assert.deepEqual(personOf(w, id), before[k], `${k}: nothing changed`);

    const n0 = commits(w);
    const r = await w.ok(["fixes", "run", "house-numbers", "--lang", "en"], { tty: true, answers: ["1"] });
    assert.match(r.out, /Set right: 5 facts in 3 records\./u);
    assert.equal(commits(w), n0 + 1, "one commit");
    const tree = open(w);
    const ops = tree.readOps().filter((o) => o.op === "housenumber.fix");
    assert.equal(ops.length, 1, "one operation");
    assert.ok(ops[0]!.files.some((f) => f.path === "quality/house-numbers.json"));
    assert.deepEqual(changeLines(tree, ops, "", "cs").map((l) => l.text), ["Čísla domů u údajů opravena: 5"]);
    const house = (k: keyof typeof ev) => eventOf(w, ev[k]).house;
    assert.deepEqual([house("mark"), house("plain"), house("haus"), house("street"), house("other"), house("note"), house("several"), house("entry"), house("cyrillic")], ["16", "16", "3", "Dlouhá 12", "Haus am Markt", "13", undefined, undefined, "7"]);
    assert.equal(eventOf(w, ev.note).note?.normalize("NFC"), "Adresa: čp. 13", "the note kept");
    assert.equal((await w.run(["verify", "--json"])).code, 0, "sealed");
    const again = await w.ok(["fixes", "show", "house-numbers", "--json"]);
    assert.deepEqual(again.json.items, [], "idempotent");
    assert.equal(again.json.state, "fixed");

    assert.equal((await w.run(["fixes", "undo", "house-numbers"], AGENT)).code, 4);
    const n1 = commits(w);
    const u = await w.ok(["fixes", "undo", "house-numbers", "--lang", "en"], { tty: true });
    assert.match(u.out, /Put back as they were: 5 facts/u);
    assert.equal(commits(w), n1 + 1);
    assert.equal(open(w).readOps().filter((o) => o.op === "housenumber.unfix").length, 1);
    for (const [k, id] of Object.entries(ids)) assert.deepEqual(personOf(w, id), before[k], `${k}: back exactly`);
    assert.match((await w.ok(["fixes", "undo", "house-numbers", "--lang", "en"], { tty: true })).out, /Nothing to put back/u);
  } finally {
    w.cleanup();
  }
});

test("strom fixes house-numbers: in an archive shown and set right, nothing of an agent; an undo never over a change since", opts, async () => {
  const w = new World();
  try {
    const { ids, ev } = await older(w);
    await w.ok(["mode", "archive"], { tty: true, answers: ["y"] });
    const show = await w.ok(["fixes", "show", "house-numbers"]);
    assert.doesNotMatch(show.out, /agent|\bAI\b|umělá inteligence|Claude|Codex|\bmodel/iu);
    await w.ok(["fixes", "run", "house-numbers"], { tty: true, answers: ["1"] });
    assert.equal(eventOf(w, ev.mark).house, "16");
    // the person writes the house again since: the undo leaves it and says so
    asOlder(w, ids.kapradin, (p) => {
      p.events.find((e) => e.id === ev.mark)!.house = "16a";
    });
    const u = await w.ok(["fixes", "undo", "house-numbers", "--lang", "en"], { tty: true });
    assert.match(u.out, /Put back as they were: 4 facts · 1 changed since, left as it is/u);
    assert.equal(eventOf(w, ev.mark).house, "16a");
    assert.equal(eventOf(w, ev.street).house?.normalize("NFC"), "čp. Dlouhá 12");
    assert.equal(eventOf(w, ev.note).house, undefined);
  } finally {
    w.cleanup();
  }
});
