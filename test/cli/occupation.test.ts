// strom occupation add|list|remove: the research's own forms of occupations (quality/occupations.json) beside the
// built-in list — strom query finds them as one occupation (--exact, --count, --story too); a word in no list is said
// in the text and in the JSON; the person adds and takes out in their terminal, an agent only its own, never the
// person's; a file that cannot be read leaves the built-in list, said, and nothing is written over it. Made-up data
// only (Lhoták, Lhota).

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";

const PERSON = { tty: true };
const AGENT = { env: { STROM_IN_AGENT: "codex" } };

/** Jan (P0001, the main person) a "Ölschläger" and a "Glockengiesser" made up for the list; his son Petr (P0002) an "olejník". */
async function family(): Promise<World> {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["person", "add", "Jan /Lhoták/", "--sex", "M", "--born", "1800"]);
  await w.ok(["person", "add", "Petr /Lhoták/", "--sex", "M", "--born", "1830"]);
  await w.ok(["family", "add", "--partner", "P0001", "--child", "P0002"]);
  await w.ok(["config", "set", "main.person", "P0001"]);
  await w.ok(["source", "add", "Křty Lhota 1830", "--kind", "baptism"]);
  await w.ok(["event", "add", "P0001", "OCCU", "--value", "Ölschläger", "--date", "1830"]);
  await w.ok(["event", "add", "P0002", "OCCU", "--value", "olejníkův syn, olejník", "--date", "1860"]);
  await w.ok(["event", "add", "P0001", "OCCU", "--value", "Glockengiesser", "--date", "1840"]);
  return w;
}

const ids = (rows: { person: { id: string } }[]) => [...new Set(rows.map((r) => r.person.id))].sort();
const ownFile = (w: World) => path.join(w.cwd, "quality", "occupations.json");

test("a word in no list is said, in the text and the JSON; added by the person, query finds its forms as one", { skip: !hasGit }, async () => {
  const w = await family();
  try {
    const before = await w.ok(["query", "--occupation", "olejník"]);
    assert.match(before.out, /^olejník: not in the list of occupations, found only as written; its other forms: strom occupation add olejník <form>/mu);
    const j = (await w.ok(["query", "--occupation", "olejník", "--json"])).json;
    assert.equal(j.known, false);
    assert.deepEqual(j.unknown, ["olejník"]);
    assert.deepEqual(ids(j.rows), ["P0002"]);
    // a person reads it in the research's language
    assert.match((await w.ok(["query", "--occupation", "olejník"], PERSON)).out, /^olejník: povolání není v seznamu, hledá se jen tento tvar; další tvary přidá: strom occupation add olejník <tvar>/mu);
    // a known one: nothing said
    const miller = (await w.ok(["query", "--occupation", "mlynar", "--json"])).json;
    assert.equal(miller.known, true);
    assert.deepEqual(miller.unknown, []);
    assert.doesNotMatch((await w.ok(["query", "--occupation", "mlynar"])).out, /not in the list/u);

    // the person adds the German form, decomposed (NFD) as typed
    const add = await w.ok(["occupation", "add", "olejník", `de:${"Ölschläger".normalize("NFD")}`, "--source", "s0001"], PERSON);
    assert.match(add.out, /^přidáno: olejník, Ölschläger — tvary povolání teď: olejník, Ölschläger$/mu);
    const file = JSON.parse(fs.readFileSync(ownFile(w), "utf8"));
    assert.deepEqual(file.groups, [{ cs: ["olejník"], de: ["Ölschläger"], by: "human", at: file.groups[0].at, sources: ["S0001"] }]);
    assert.match(file.groups[0].at, /^\d{4}-\d{2}-\d{2}$/u);
    assert.equal((await w.ok(["verify"])).code, 0, "a sealed operation: no edit outside strom");

    const after = (await w.ok(["query", "--occupation", "olejník", "--json"])).json;
    assert.equal(after.known, true);
    assert.deepEqual(after.unknown, []);
    assert.deepEqual(ids(after.rows), ["P0001", "P0002"]);
    assert.deepEqual(after.variants, ["olejník", "Ölschläger"]);
    // asked by the German form too; --count; --exact the word alone (known now)
    assert.deepEqual(ids((await w.ok(["query", "--occupation", "oelschlager".replace("oe", "ö"), "--json"])).json.rows), ["P0001", "P0002"]);
    assert.deepEqual((await w.ok(["query", "--occupation", "olejník", "--count", "--json"])).json.total, { people: 2, facts: 2 });
    const exact = (await w.ok(["query", "--occupation", "olejník", "--exact", "--json"])).json;
    assert.equal(exact.known, true);
    assert.deepEqual(ids(exact.rows), ["P0002"]);
    // the stories too
    await w.ok(["story", "set", "P0001", "--text", "Jan byl Ölschläger v Lhotě."]);
    assert.deepEqual(ids((await w.ok(["query", "--story", "olejník", "--json"])).json.rows), ["P0001"]);

    // again: one occupation already, nothing written
    const head = fs.readFileSync(ownFile(w), "utf8");
    assert.match((await w.ok(["occupation", "add", "olejník", "de:Ölschläger"])).out, /^one occupation already: olejník, Ölschläger$/mu);
    assert.equal(fs.readFileSync(ownFile(w), "utf8"), head);

    // the history says it in the research's language
    assert.match((await w.ok(["history"], PERSON)).out, /Přidány tvary povolání: olejník, Ölschläger/u);
    // list: the group with who added it; by a word: its forms, the research's own marked
    assert.match((await w.ok(["occupation", "list"], PERSON)).out, /^ {2}cs olejník · de Ölschläger {2}\(ručně, \d{4}-\d{2}-\d{2}, S0001\)$/mu);
    assert.match((await w.ok(["occupation", "list", "OLEJNIK"])).out, /^OLEJNIK: olejník\*, Ölschläger\*$/mu);
  } finally {
    w.cleanup();
  }
});

test("a form joins a built-in occupation; another language and another script by a prefix", { skip: !hasGit }, async () => {
  const w = await family();
  try {
    assert.equal((await w.ok(["query", "--occupation", "Glockengiesser", "--json"])).json.known, true, "built in: zvonař, Glockengießer");
    await w.ok(["occupation", "add", "mlynář", "de:Ölschläger"], PERSON);
    const j = (await w.ok(["query", "--occupation", "molitor", "--json"])).json;
    assert.deepEqual(ids(j.rows), ["P0001"], "a miller's form now");
    assert.ok(j.variants.includes("Müller") && j.variants.includes("Ölschläger"));
    await w.ok(["occupation", "add", "ru:мельник", "ru:Мельничий"], PERSON);
    assert.deepEqual(JSON.parse(fs.readFileSync(ownFile(w), "utf8")).groups.find((g: { ru?: string[] }) => g.ru).ru, ["мельник", "Мельничий"]);
    assert.equal((await w.ok(["query", "--occupation", "МЕЛЬНИЧИЙ", "--json"])).json.known, true);
    // refused: one form only, no word, a source not in the tree
    for (const args of [["olejník"], ["olejník", "olejníka"], ["olejník", "de:—"], ["olejník", "de:Ölmüller", "--source", "S0099"]]) {
      const r = await w.run(["occupation", "add", ...args]);
      assert.notEqual(r.code, 0, args.join(" "));
    }
  } finally {
    w.cleanup();
  }
});

test("an agent adds its own and takes out only its own; the person's are never changed by it, the person takes out any", { skip: !hasGit }, async () => {
  const w = await family();
  try {
    await w.ok(["occupation", "add", "olejník", "de:Ölschläger"], PERSON);
    // the agent adds a form to the same occupation: a group of its own, the person's left as it was
    const a = (await w.ok(["occupation", "add", "olejník", "la:olearius", "--json"], AGENT)).json;
    assert.equal(a.by, "agent");
    assert.deepEqual(a.added, ["olejník", "olearius"]);
    assert.ok(a.forms.includes("Ölschläger") && a.forms.includes("olearius"), "one occupation with the person's forms");
    const groups = JSON.parse(fs.readFileSync(ownFile(w), "utf8")).groups;
    assert.deepEqual(
      groups.map((g: { by: string }) => g.by).sort(),
      ["agent", "human"],
    );
    assert.deepEqual(groups.find((g: { by: string }) => g.by === "human").de, ["Ölschläger"]);
    // the agent cannot take out the person's form; its own it can
    const r = (await w.ok(["occupation", "remove", "de:Ölschläger", "la:olearius", "pl:nic", "--json"], AGENT)).json;
    assert.deepEqual(r, { removed: ["olearius"], persons: ["Ölschläger"], builtin: [], unknown: ["nic"] });
    const left = JSON.parse(fs.readFileSync(ownFile(w), "utf8")).groups;
    assert.deepEqual(left, [{ cs: ["olejník"], de: ["Ölschläger"], by: "human", at: left[0].at }], "the agent's group of one form gone");
    // a built-in form stays; the person takes out their own
    const p = await w.ok(["occupation", "remove", "Ölschläger", "mlynář"], PERSON);
    assert.match(p.out, /^odebráno: Ölschläger$/mu);
    assert.match(p.out, /^mlynář: vestavěné, zůstává$/mu);
    assert.deepEqual(JSON.parse(fs.readFileSync(ownFile(w), "utf8")).groups, []);
    // the person takes out an agent's form too
    await w.ok(["occupation", "add", "olejník", "la:olearius"], AGENT);
    assert.deepEqual((await w.ok(["occupation", "remove", "la:olearius", "--json"], PERSON)).json.removed, ["olearius"]);
    assert.equal((await w.ok(["verify"])).code, 0);
  } finally {
    w.cleanup();
  }
});

test("a file that cannot be read: query uses the built-in list and says so; nothing is written over it", { skip: !hasGit }, async () => {
  const w = await family();
  try {
    await w.ok(["occupation", "add", "olejník", "de:Ölschläger"], PERSON);
    fs.writeFileSync(ownFile(w), "{ broken");
    const r = await w.ok(["query", "--occupation", "mlynar"]);
    // one short line, the file once, no nested error or absolute path; the detail only in --json (N2)
    assert.match(r.out, /^the research's own list of occupations \(quality\/occupations\.json\) cannot be read: the built-in list only — strom repair$/mu);
    const cs = (await w.ok(["query", "--occupation", "mlynar"], PERSON)).out;
    assert.match(cs, /^vlastní seznam povolání výzkumu \(quality\/occupations\.json\) nejde přečíst: jen vestavěný seznam — strom repair$/mu);
    for (const out of [r.out, cs]) {
      assert.equal(out.split("occupations.json").length, 2, "the file said once");
      assert.doesNotMatch(out, /invalid JSON|position|json cannot be read/u);
      assert.ok(!out.includes(w.cwd), "no absolute path");
    }
    const j = (await w.ok(["query", "--occupation", "olejník", "--json"])).json;
    assert.equal(j.known, false);
    assert.match(j.listError, /quality\/occupations\.json cannot be read/u);
    assert.deepEqual(ids(j.rows), ["P0002"], "the word itself still found");
    assert.match((await w.ok(["occupation", "list"])).out, /^the research's own list of occupations \(quality\/occupations\.json\) cannot be read: the built-in list only — strom repair$/mu);
    const list = await w.ok(["occupation", "list"], PERSON);
    assert.match(list.out, /^vlastní seznam povolání výzkumu \(quality\/occupations\.json\) nejde přečíst: jen vestavěný seznam — strom repair$/mu);
    assert.ok(!list.out.includes(w.cwd) && !/invalid JSON/u.test(list.out), "no detail in the line");
    assert.match((await w.ok(["occupation", "list", "--json"])).json.error, /quality\/occupations\.json cannot be read/u);
    // a write is refused (the research changed outside strom: strom repair puts the file back)
    const add = await w.run(["occupation", "add", "olejník", "la:olearius"]);
    assert.notEqual(add.code, 0);
    assert.match(add.out + add.err, /strom repair/u);
    assert.equal(fs.readFileSync(ownFile(w), "utf8"), "{ broken");
  } finally {
    w.cleanup();
  }
});
