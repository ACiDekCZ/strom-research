// Which name after a marriage is the one now (spec 010 K4.1, K4.2, K4.4): the research's Strom file gives the names
// after a marriage with the one now last — the latest marriage's (by date, else the last in order), or the user's
// choice — and says so in its HEAD (1 _STROM_MARRIED_LAST Y); an app that reads no mark takes the last, the one now.
// The user's choice in the app (its one name after a marriage, not the one now of the state it was given) is taken as
// the one now and holds against the rule; nothing is taken off; the one chosen before comes back as another form of
// the name and stays a name after a marriage; a copy of an older state chooses nothing.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";

const opts = { skip: !hasGit };

type Name = { given: string; surname: string; kind?: string; marriedNow?: boolean };
type Change = { kind: string; action: string; text?: string; married?: boolean };

const names = async (w: World, id = "P0001"): Promise<Name[]> => (await w.ok(["person", "show", id, "--json"])).json.person.names;
const plan = async (w: World, file: string) => ((await w.ok(["sync", file, "--json"])).json.changes as Change[]).map((c) => [c.kind, c.action, c.text ?? "", c.married ? "married" : ""]);

/** The first person's NAME lines in a file, with what stands below each. */
const nameLines = (text: string) => /(?:1 NAME .*\r?\n(?:[2-9] .*\r?\n)*)+/.exec(text)![0];
/** The surnames of the first person's names of the married kind, in the file's order. */
const marriedInFile = (text: string) => [...nameLines(text).matchAll(/1 NAME [^/\n]*\/([^/\n]*)\/\r?\n(?:[2-9] .*\r?\n)*?2 TYPE married/gu)].map((x) => x[1]);
/** The first person's names in a file as the app writes them. */
const named = (text: string, lines: string[]) => text.replace(/(?:1 NAME .*\r?\n(?:[2-9] .*\r?\n)*)+/, `${lines.join("\n")}\n`);

const send = (w: World, text: string, name: string) => {
  const file = path.join(w.dir, name);
  fs.writeFileSync(file, text);
  return file;
};

/**
 * A woman married twice (P1 Anna Pěnkavová; P2 Jan Lhoták, F1; P3 Petr Lhotecký, F2), her names after the marriages
 * written the later first (from a death record), the earlier after it (from the wedding); given() = the file the app
 * is given now.
 */
async function twice(dates: { first?: string; second?: string } = { first: "1905", second: "1920" }) {
  const w = new World();
  await w.withTree();
  await w.ok(["lang", "cs"]);
  await w.ok(["person", "add", "Anna /Pěnkavová/", "--sex", "F", "--born", "1884"]); // P1
  await w.ok(["person", "add", "Jan /Lhoták/", "--sex", "M"]); // P2
  await w.ok(["person", "add", "Petr /Lhotecký/", "--sex", "M"]); // P3
  await w.ok(["family", "add", "--partner", "P2", "--partner", "P1", ...(dates.first ? ["--married", dates.first] : [])]); // F1
  await w.ok(["family", "add", "--partner", "P3", "--partner", "P1", ...(dates.second ? ["--married", dates.second] : [])]); // F2
  // decomposed (NFD) as some systems type it: the same name
  await w.ok(["name", "add", "P0001", `Anna /${"Lhotecká".normalize("NFD")}/`, "--kind", "married"]);
  await w.ok(["name", "add", "P0001", "Anna /Lhotáková/", "--kind", "married"]);
  let n = 0;
  const given = async () => {
    const out = path.join(w.dir, `given-${++n}.ged`);
    await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", out]);
    return fs.readFileSync(out, "utf8");
  };
  return { w, given };
}

test("K4.1: the latest wedding's name last, written in any order; the mark in the HEAD — an app of no mark takes the last, the one now (K4.4)", opts, async () => {
  const { w, given } = await twice();
  const text = await given();
  assert.deepEqual(marriedInFile(text), ["Lhotáková", "Lhotecká"]);
  assert.match(text, /^0 HEAD\r?\n(?:[1-9] .*\r?\n)*1 _STROM_MARRIED_LAST Y\r?\n/);
  assert.match(nameLines(text), /^1 NAME Anna \/Pěnkavová\/\r?\n/, "the name of her identity first");
  // nothing written over: the research's names as they were added
  assert.deepEqual((await names(w)).map((n) => n.surname), ["Pěnkavová", "Lhotecká", "Lhotáková"]);
  // the app sends it back as it took it: its one name after a marriage the one now, the other one another form
  assert.deepEqual(await plan(w, send(w, named(text, ["1 NAME Anna /Pěnkavová/", "1 NAME Anna /Lhotáková/", "1 NAME Anna /Lhotecká/", "2 TYPE married"]), "back.ged")), []);
  // the standard file (other programs) is not the Strom file: no mark
  const std = path.join(w.dir, "std.ged");
  await w.ok(["export", "gedcom", "--for", "standard", "--out", std]);
  assert.doesNotMatch(fs.readFileSync(std, "utf8"), /_STROM_MARRIED_LAST/);
  w.cleanup();
});

test("K4.1: no dates — the last marriage in order; one of them dated — that one; a name of no husband before them", opts, async () => {
  const { w, given } = await twice({});
  // written last, but no husband carries it
  await w.ok(["name", "add", "P0001", "Anna /Brkoslavová/", "--kind", "married"]);
  assert.deepEqual(marriedInFile(await given()), ["Brkoslavová", "Lhotáková", "Lhotecká"]);
  await w.ok(["event", "add", "F0001", "MARR", "--date", "1905"]);
  assert.deepEqual(marriedInFile(await given()), ["Brkoslavová", "Lhotecká", "Lhotáková"]);
  w.cleanup();
});

test("K4.2: the user's choice in the app is the one now — nothing taken off, the one before stays a name after a marriage; it holds against the rule and the research's new records; undone as it was", opts, async () => {
  const { w, given } = await twice();
  const text = await given();
  // the user chose Lhotáková: the app sends it as its name after a marriage, Lhotecká as another form of the name
  const file = send(w, named(text, ["1 NAME Anna /Pěnkavová/", "1 NAME Anna /Lhotecká/", "1 NAME Anna /Lhotáková/", "2 TYPE married"]), "chosen.ged");
  assert.deepEqual(await plan(w, file), [["name.now", "correct", "Anna /Lhotáková/", ""]]);
  assert.match((await w.ok(["sync", file], { tty: true })).out, /1\. Anna Pěnkavová \[P0001\]: aktuální jméno po sňatku — Anna Lhotáková → převzato jako volba: aktuální, ostatní zůstávají/);
  const input = (await w.ok(["sync", file, "--apply", "--json"])).json.input as string;
  const now = await names(w);
  assert.deepEqual(now.map((n) => [n.surname, n.kind ?? "", !!n.marriedNow]), [["Pěnkavová", "", false], ["Lhotecká", "married", false], ["Lhotáková", "married", true]]);
  assert.deepEqual(marriedInFile(await given()), ["Lhotecká", "Lhotáková"]);
  assert.deepEqual(await plan(w, send(w, await given(), "again.ged")), [], "sent back: nothing new");
  // the research goes on: a record cites the other name, a later wedding date — the choice holds
  const s = (await w.ok(["source", "add", "Úmrtí Anny 1950", "--kind", "death", "--locator", "fol. 9", "--json"])).json;
  await w.ok(["name", "add", "P0001", "Anna /Lhotecká/", "--kind", "married", "--cite", (s.id ?? s.source?.id) as string]);
  await w.ok(["event", "add", "F0002", "MARR", "--date", "1930"]);
  assert.deepEqual(marriedInFile(await given()), ["Lhotecká", "Lhotáková"]);
  await w.ok(["sync", "undo", input]);
  assert.deepEqual((await names(w)).map((n) => [n.surname, !!n.marriedNow]), [["Pěnkavová", false], ["Lhotecká", false], ["Lhotáková", false]]);
  assert.deepEqual(marriedInFile(await given()), ["Lhotáková", "Lhotecká"]);
  w.cleanup();
});

test("K4.2: a name the research lacks chosen in the app — added of the married kind as the one now; another choice moves the mark", opts, async () => {
  const { w, given } = await twice();
  let file = send(w, named(await given(), ["1 NAME Anna /Pěnkavová/", "1 NAME Anna /Lhotecká/", "1 NAME Anna /Lhotáková/", "1 NAME Anna /Jaworska/", "2 TYPE married"]), "new.ged");
  assert.deepEqual(await plan(w, file), [["name.now", "correct", "Anna /Jaworska/", ""]]);
  await w.ok(["sync", file, "--apply"]);
  assert.deepEqual((await names(w)).map((n) => [n.surname, n.kind ?? "", !!n.marriedNow]), [["Pěnkavová", "", false], ["Lhotecká", "married", false], ["Lhotáková", "married", false], ["Jaworska", "married", true]]);
  assert.deepEqual(marriedInFile(await given()), ["Lhotáková", "Lhotecká", "Jaworska"]);
  // chosen again: the mark moves, one at a time
  file = send(w, named(await given(), ["1 NAME Anna /Pěnkavová/", "1 NAME Anna /Jaworska/", "1 NAME Anna /Lhotáková/", "1 NAME Anna /Lhotecká/", "2 TYPE married"]), "again.ged");
  assert.deepEqual(await plan(w, file), [["name.now", "correct", "Anna /Lhotecká/", ""]]);
  await w.ok(["sync", file, "--apply"]);
  assert.deepEqual((await names(w)).filter((n) => n.marriedNow).map((n) => n.surname), ["Lhotecká"]);
  // the name no husband carries before the others, the one chosen last
  assert.deepEqual(marriedInFile(await given()), ["Jaworska", "Lhotáková", "Lhotecká"]);
  w.cleanup();
});

test("K4.2: a copy of an older state chooses nothing — the research put another one last since, the app's one is the one it was given", opts, async () => {
  const { w, given } = await twice({});
  const old = await given();
  assert.deepEqual(marriedInFile(old), ["Lhotáková", "Lhotecká"]);
  // the research since: the first wedding's date found — that one now
  await w.ok(["event", "add", "F0001", "MARR", "--date", "1905"]);
  assert.deepEqual(marriedInFile(await given()), ["Lhotecká", "Lhotáková"]);
  // the app never took the newer state: it sends the one it was given as its name after a marriage, the other as a form
  const file = send(w, named(old, ["1 NAME Anna /Pěnkavová/", "1 NAME Anna /Lhotáková/", "1 NAME Anna /Lhotecká/", "2 TYPE married"]), "old.ged");
  assert.deepEqual(await plan(w, file), []);
  assert.ok(!(await names(w)).some((n) => n.marriedNow));
  w.cleanup();
});

test("K4.2: the one chosen before as another form of the name, with the app's own first name — no name taken off, none of another kind", opts, async () => {
  const { w, given } = await twice();
  const text = await given();
  const file = send(w, named(text, ["1 NAME Anna /Pěnkavová/", "1 NAME Zdislava /Lhotecká/", "1 NAME Anna /Lhotáková/", "2 TYPE married"]), "form.ged");
  const changes = await plan(w, file);
  assert.ok(!changes.some(([kind]) => kind === "name.gone"), JSON.stringify(changes));
  await w.ok(["sync", file, "--apply"]);
  const now = await names(w);
  assert.deepEqual(now.filter((n) => n.surname === "Lhotecká").map((n) => [n.given, n.kind ?? ""])[0], ["Anna", "married"]);
  assert.deepEqual(now.filter((n) => n.marriedNow).map((n) => n.surname), ["Lhotáková"]);
  w.cleanup();
});
