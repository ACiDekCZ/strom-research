// The surname after a marriage between the research and the Strom app (spec 010): the research gives each name of the
// married kind as its own NAME with TYPE married; the app keeps one (the last) as its marriedSurname, with its own first
// name, and sends it back so (TYPE married; marriedSurname in its JSON). It comes back as a name of the married kind —
// never a rename, never another name of no kind; the same by its surname; changed in the app, the new one added and the
// old one off where only the user's edits gave it (a record's stays, said); taken off in the app, the same.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";

const opts = { skip: !hasGit };

type Name = { given: string; surname: string; kind?: string; citations?: { source: string }[] };
type Change = { kind: string; action: string; text?: string; married?: boolean };

const names = async (w: World, id = "P0001"): Promise<Name[]> => (await w.ok(["person", "show", id, "--json"])).json.person.names;
const plan = async (w: World, file: string) => ((await w.ok(["sync", file, "--json"])).json.changes as Change[]).map((c) => [c.kind, c.action, c.text ?? "", c.married ? "married" : ""]);

/** A research of one woman of her birth name (a lead); given() = the file the app is given now. */
async function woman(): Promise<{ w: World; given: () => Promise<string> }> {
  const w = new World();
  await w.withTree();
  await w.ok(["lang", "cs"]);
  await w.ok(["person", "add", "Marie /Dvořáková/", "--sex", "F", "--born", "1901"]); // P1
  let n = 0;
  const given = async () => {
    const out = path.join(w.dir, `given-${++n}.ged`);
    await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", out]);
    return fs.readFileSync(out, "utf8");
  };
  return { w, given };
}

/** The first person's names in a file as the app writes them: every NAME with what stands below it replaced. */
const named = (text: string, lines: string[]) => text.replace(/(?:1 NAME .*\r?\n(?:[2-9] .*\r?\n)*)+/, `${lines.join("\n")}\n`);

const send = (w: World, text: string, name: string) => {
  const file = path.join(w.dir, name);
  fs.writeFileSync(file, text);
  return file;
};

test("a married name goes to the app as its own NAME + TYPE married, and comes back as it went: no change (the older app's other form too)", opts, async () => {
  const { w, given } = await woman();
  await w.ok(["name", "add", "P0001", "Marie /Nováková/", "--kind", "married"]);
  const text = await given();
  assert.match(text, /\n1 NAME Marie \/Dvořáková\/\r?\n1 NAME Marie \/Nováková\/\r?\n2 TYPE married\r?\n/);
  // the app of spec 010 sends it back so; an older app as another form of the name (no slashes, no TYPE)
  assert.deepEqual(await plan(w, send(w, text, "same.ged")), []);
  assert.deepEqual(await plan(w, send(w, named(text, ["1 NAME Marie /Dvořáková/", "1 NAME Marie Nováková"]), "older.ged")), [], "an older app's copy: nothing changed, nothing taken away");
  w.cleanup();
});

test("a married name added in the app: a name of the married kind, citing the sync — sent again nothing, undone as it was", opts, async () => {
  const { w, given } = await woman();
  // decomposed (NFD) as some systems send it: the same name in NFC
  const file = send(w, named(await given(), ["1 NAME Marie /Dvořáková/", `1 NAME Marie /${"Nováková".normalize("NFD")}/`, "2 TYPE married"]), "married.ged");
  assert.deepEqual(await plan(w, file), [["name.new", "add", "Marie /Nováková/", "married"]]);
  assert.match((await w.ok(["sync", file], { tty: true })).out, /1\. Marie Dvořáková \[P0001\]: jméno po sňatku — Marie \/Nováková\/ → přidá se jako vodítko/);
  const input = (await w.ok(["sync", file, "--apply", "--json"])).json.input as string;
  let now = await names(w);
  assert.deepEqual(now.map((n) => [n.given, n.surname, n.kind ?? ""]), [["Marie", "Dvořáková", ""], ["Marie", "Nováková", "married"]], "never a rename: shown by the birth name");
  assert.equal(now[1]!.surname, "Nováková".normalize("NFC"));
  assert.equal(now[1]!.citations?.length, 1, "it cites the tree sent");
  assert.deepEqual(await plan(w, send(w, await given(), "again.ged")), [], "sent back: nothing new");
  await w.ok(["sync", "undo", input]);
  now = await names(w);
  assert.deepEqual(now.map((n) => n.surname), ["Dvořáková"]);
  w.cleanup();
});

test("the same married name by its surname: the app's first name in it is no other name", opts, async () => {
  const { w, given } = await woman();
  await w.ok(["name", "add", "P0001", "Maria /Nováková/", "--kind", "married"]);
  const file = send(w, named(await given(), ["1 NAME Marie /Dvořáková/", "1 NAME Marie /Nováková/", "2 TYPE married"]), "same.ged");
  assert.deepEqual(await plan(w, file), []);
  w.cleanup();
});

test("a married name changed in the app: the new one added last, the old one off — a record's stays, said; undone as it was", opts, async () => {
  const { w, given } = await woman();
  await w.ok(["name", "add", "P0001", "Marie /Nováková/", "--kind", "married"]);
  const text = await given();
  const file = send(w, named(text, ["1 NAME Marie /Dvořáková/", "1 NAME Marie /Novotná/", "2 TYPE married"]), "changed.ged");
  assert.deepEqual(await plan(w, file), [
    ["name.new", "add", "Marie /Novotná/", "married"],
    ["name.gone", "remove", "Marie /Nováková/", ""],
  ]);
  const input = (await w.ok(["sync", file, "--apply", "--json"])).json.input as string;
  assert.deepEqual((await names(w)).map((n) => [n.surname, n.kind ?? ""]), [["Dvořáková", ""], ["Novotná", "married"]]);
  assert.deepEqual(await plan(w, send(w, await given(), "again.ged")), [], "sent back: nothing new");
  await w.ok(["sync", "undo", input]);
  assert.deepEqual((await names(w)).map((n) => [n.surname, n.kind ?? ""]), [["Dvořáková", ""], ["Nováková", "married"]]);

  // a record gives the old one: it stays (said), the user's new one after it — the one the app takes as now
  const s = (await w.ok(["source", "add", "Oddání Marie Dvořákové 1922", "--kind", "marriage", "--locator", "fol. 3", "--json"])).json;
  await w.ok(["name", "add", "P0001", "Marie /Nováková/", "--kind", "married", "--cite", (s.id ?? s.source?.id) as string]);
  const backed = send(w, named(await given(), ["1 NAME Marie /Dvořáková/", "1 NAME Marie /Novotná/", "2 TYPE married"]), "backed.ged");
  assert.deepEqual(await plan(w, backed), [
    ["name.new", "add", "Marie /Novotná/", "married"],
    ["name.gone", "report", "Marie /Nováková/", ""],
  ]);
  assert.match((await w.ok(["sync", backed], { tty: true })).out, /2\. Marie Dvořáková \[P0001\]: jméno po sňatku už v něm není — Marie \/Nováková\/ → zůstává: dokládá ho záznam/);
  await w.ok(["sync", backed, "--apply"]);
  assert.deepEqual((await names(w)).map((n) => [n.surname, n.kind ?? ""]), [["Dvořáková", ""], ["Nováková", "married"], ["Novotná", "married"]]);
  const out = await given();
  assert.match(out, /1 NAME Marie \/Nováková\/\r?\n2 TYPE married\r?\n(?:[2-9] .*\r?\n)*1 NAME Marie \/Novotná\/\r?\n2 TYPE married\r?\n/, "the app's last married name is the user's");
  w.cleanup();
});

test("a married name taken off in the app: off where only the user's edits gave it, never a record's; an older app keeps it as another form", opts, async () => {
  const { w, given } = await woman();
  await w.ok(["name", "add", "P0001", "Marie /Nováková/", "--kind", "married"]);
  const off = send(w, named(await given(), ["1 NAME Marie /Dvořáková/"]), "off.ged");
  assert.deepEqual(await plan(w, off), [["name.gone", "remove", "Marie /Nováková/", ""]]);
  await w.ok(["sync", off, "--apply"]);
  assert.deepEqual((await names(w)).map((n) => n.surname), ["Dvořáková"]);
  // a record's: it stays, said (it goes to the app again)
  const s = (await w.ok(["source", "add", "Oddání Marie Dvořákové 1922", "--kind", "marriage", "--locator", "fol. 3", "--json"])).json;
  await w.ok(["name", "add", "P0001", "Marie /Nováková/", "--kind", "married", "--cite", (s.id ?? s.source?.id) as string]);
  const backed = send(w, named(await given(), ["1 NAME Marie /Dvořáková/"]), "backed.ged");
  assert.deepEqual(await plan(w, backed), [["name.gone", "report", "Marie /Nováková/", ""]]);
  await w.ok(["sync", backed, "--apply"]);
  assert.deepEqual((await names(w)).map((n) => n.surname), ["Dvořáková", "Nováková"]);
  w.cleanup();
});

test("a name of the research the app now says is one after a marriage: that kind, citing the sync; undone, as it was", opts, async () => {
  const { w, given } = await woman();
  await w.ok(["name", "add", "P0001", "Marie /Nováková/"]);
  const file = send(w, named(await given(), ["1 NAME Marie /Dvořáková/", "1 NAME Marie /Nováková/", "2 TYPE married"]), "kind.ged");
  assert.deepEqual(await plan(w, file), [["name.new", "add", "Marie /Nováková/", "married"]]);
  const input = (await w.ok(["sync", file, "--apply", "--json"])).json.input as string;
  assert.deepEqual((await names(w)).map((n) => [n.surname, n.kind ?? "", n.citations?.length ?? 0]), [["Dvořáková", "", 0], ["Nováková", "married", 1]]);
  await w.ok(["sync", "undo", input]);
  assert.deepEqual((await names(w)).map((n) => [n.surname, n.kind ?? "", n.citations?.length ?? 0]), [["Dvořáková", "", 0], ["Nováková", "", 0]]);
  w.cleanup();
});

test("the app's JSON (marriedSurname) and another program's _MARNM: a name of the married kind, in any script", opts, async () => {
  const w = new World();
  await w.withTree();
  const json = path.join(w.dir, "app.json");
  fs.writeFileSync(json, JSON.stringify({ version: 12, persons: { a: { id: "a", firstName: "Анна", lastName: "Петрова", marriedSurname: "Иванова", gender: "female" } }, partnerships: {} }));
  await w.ok(["sync", json, "--apply", "--force"]);
  assert.deepEqual((await names(w)).map((n) => [n.given, n.surname, n.kind ?? ""]), [["Анна", "Петрова", ""], ["Анна", "Иванова", "married"]]);
  // another program's file: _MARNM under the NAME (a surname) and under the person (a whole name)
  const ged = path.join(w.dir, "other.ged");
  fs.writeFileSync(
    ged,
    ["0 HEAD", "1 GEDC", "2 VERS 5.5.1", "1 CHAR UTF-8", "0 @I1@ INDI", "1 NAME Marie /Dvořáková/", "2 _MARNM Nováková", "1 SEX F", "0 @I2@ INDI", "1 NAME Eva /Černá/", "1 _MARNM Eva /Bílá/", "1 SEX F", "0 TRLR", ""].join("\n"),
  );
  await w.ok(["intake", ged]);
  const people = (await w.ok(["person", "list", "--json", "--full"])).json.persons as { names: Name[] }[];
  const marie = people.find((p) => p.names[0]!.surname === "Dvořáková")!;
  assert.deepEqual(marie.names.map((n) => [n.given, n.surname, n.kind ?? ""]), [["Marie", "Dvořáková", ""], ["Marie", "Nováková", "married"]]);
  const eva = people.find((p) => p.names[0]!.surname === "Černá")!;
  assert.deepEqual(eva.names.map((n) => [n.given, n.surname, n.kind ?? ""]), [["Eva", "Černá", ""], ["Eva", "Bílá", "married"]]);
  w.cleanup();
});

test("a person of a married name alone: the app's first surname; the birth surname filled in the app with it as married — shown by the birth one", opts, async () => {
  const w = new World();
  await w.withTree();
  await w.ok(["person", "add", "Marie /Nováková/", "--sex", "F"]);
  await w.ok(["name", "add", "P0001", "Marie /Nováková/", "--kind", "married"]);
  const out = path.join(w.dir, "given.ged");
  await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", out]);
  const text = fs.readFileSync(out, "utf8");
  assert.match(text, /\n1 NAME Marie \/Nováková\/\r?\n2 TYPE married\r?\n/, "the one name, first");
  // the app took it as its surname and sends it back so (no TYPE): nothing
  assert.deepEqual(await plan(w, send(w, named(text, ["1 NAME Marie /Nováková/"]), "same.ged")), []);
  // the birth surname filled in, the married one in its field: the birth name added, shown by it
  const file = send(w, named(text, ["1 NAME Marie /Dvořáková/", "1 NAME Marie /Nováková/", "2 TYPE married"]), "born.ged");
  assert.deepEqual(await plan(w, file), [["name.new", "add", "Marie /Dvořáková/", ""]]);
  await w.ok(["sync", file, "--apply"]);
  const shown = (await w.ok(["person", "show", "P0001", "--json"])).json.person as { names: Name[] };
  assert.deepEqual(shown.names.map((n) => [n.surname, n.kind ?? ""]), [["Nováková", "married"], ["Dvořáková", ""]]);
  const again = path.join(w.dir, "again.ged");
  await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", again]);
  assert.match(fs.readFileSync(again, "utf8"), /\n1 NAME Marie \/Dvořáková\/\r?\n(?:[2-9] .*\r?\n)*1 NAME Marie \/Nováková\/\r?\n2 TYPE married\r?\n/, "the birth name first, the married one after it");
  assert.deepEqual(await plan(w, again), [], "sent back: nothing new");
  w.cleanup();
});

test("the bridge says it takes the married surname (person.marriedSurname)", async () => {
  const { BRIDGE_FEATURES } = await import("../../src/core/live.ts");
  assert.ok((BRIDGE_FEATURES as readonly string[]).includes("person.marriedSurname"));
});
