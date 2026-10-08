// A sex left unknown in the Strom app (U01): from its 3.10.0-beta.11 (data version 12) the app keeps "unknown" as a
// sex of its own — SEX U in its GEDCOM, `gender: "unknown"` in its JSON — and guesses none (before it: a husband male,
// anyone else female). Its GEDCOM says so by the header's 1 _STROM_SEX_U Y (a tree linked to a research) or by its
// version (the HEAD's 2 VERS, which the bridge stamps from what the app says); its JSON by its data version. A sex the
// user set there is their edit, also where it equals the old guess; a file that says neither is read as before.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { World, hasGit } from "../helpers.ts";
import { readGedcom, stampAppVersion } from "../../src/core/sync.ts";
import { compareVersions } from "../../src/core/update.ts";
import { coupleSides } from "../../src/core/people.ts";
import { Tree } from "../../src/core/tree.ts";
import { stringifyCanonical, writeFileAtomic } from "../../src/core/json.ts";
import { sha256 } from "../../src/core/seal.ts";
import type { Family } from "../../src/core/model.ts";

const opts = { skip: !hasGit };

type Sexes = Record<"P0001" | "P0002" | "P0003", string>;

/**
 * A research of a couple and their child, every sex unknown: Petr Novák (P0001, the husband's side), Marie Nováková
 * (P0002), their daughter Eva (P0003). send() = the app's GEDCOM of it as it sends it back, with the sexes given.
 */
async function research(): Promise<{ w: World; send: (sexes: Sexes, head: { vers?: string; mark?: boolean; sour?: string }) => string; sexChanges: (file: string) => Promise<[string, string, string][]> }> {
  const w = new World();
  await w.withTree("Novákovi");
  await w.ok(["lang", "cs"]);
  await w.ok(["person", "add", "Petr /Novák/", "--born", "1870"]);
  await w.ok(["person", "add", "Marie /Nováková/", "--born", "1872"]);
  await w.ok(["person", "add", "Eva /Nováková/", "--born", "1901"]);
  await w.ok(["family", "add", "--partner", "P0001", "--partner", "P0002", "--child", "P0003"]);
  const tree = JSON.parse(fs.readFileSync(path.join(w.cwd, "strom.json"), "utf8")).id as string;
  let n = 0;
  const send = (sexes: Sexes, head: { vers?: string; mark?: boolean; sour?: string }) => {
    const at = execFileSync("git", ["rev-parse", "HEAD"], { cwd: w.cwd, encoding: "utf8" }).trim();
    const person = (x: number, name: string, born: string, sex: string, link: string) => [`0 @I${x}@ INDI`, `1 NAME ${name}`, `1 SEX ${sex}`, "1 BIRT", `2 DATE ${born}`, `1 REFN P000${x}`, "2 TYPE strom-research", link];
    const lines = [
      "0 HEAD", `1 SOUR ${head.sour ?? "STROM"}`, ...(head.vers ? [`2 VERS ${head.vers}`] : []), "1 GEDC", "2 VERS 5.5.1", "1 CHAR UTF-8",
      `1 _STROM_TREE ${tree}`, `1 _STROM_HEAD ${at}`, ...(head.mark ? ["1 _STROM_SEX_U Y"] : []),
      ...person(1, "Petr /Novák/", "1870", sexes.P0001, "1 FAMS @F1@"),
      ...person(2, "Marie /Nováková/", "1872", sexes.P0002, "1 FAMS @F1@"),
      ...person(3, "Eva /Nováková/", "1901", sexes.P0003, "1 FAMC @F1@"),
      "0 @F1@ FAM", "1 HUSB @I1@", "1 WIFE @I2@", "1 CHIL @I3@", "0 TRLR", "",
    ];
    const out = path.join(w.dir, `send-${++n}.ged`);
    fs.writeFileSync(out, lines.join("\n"));
    return out;
  };
  const sexChanges = async (file: string) =>
    ((await w.ok(["sync", file, "--json"])).json.changes as { kind: string; action: string; person: string; text: string }[]).filter((c) => c.kind === "sex.changed").map((c) => [c.person, c.action, c.text] as [string, string, string]);
  return { w, send, sexChanges };
}

const UNKNOWN: Sexes = { P0001: "U", P0002: "U", P0003: "U" };
/** What an app before 3.10.0-beta.11 made of the unknown (a husband male, anyone else female) — here set by the user. */
const AS_GUESSED: Sexes = { P0001: "M", P0002: "F", P0003: "F" };

test("U01 (GEDCOM): the Strom app from 3.10.0-beta.11 (its HEAD's 2 VERS, no header mark) guesses no sex — U → M of the husband, U → F of the wife and of the child are the user's edits, each caught; the unknown as it stands: nothing", opts, async () => {
  const { w, send, sexChanges } = await research();
  for (const vers of ["3.10.0-beta.11", "3.10.0-beta.12", "3.10.0-rc.1", "3.10.0", "3.11.2"]) {
    assert.deepEqual(await sexChanges(send(AS_GUESSED, { vers })), [["P0001", "correct", "M"], ["P0002", "correct", "F"], ["P0003", "correct", "F"]], vers);
    assert.deepEqual(await sexChanges(send(UNKNOWN, { vers })), [], `${vers}: unedited`);
  }
  // the header's mark says the same whatever the version (an app's tree linked to a research)
  assert.deepEqual(await sexChanges(send(AS_GUESSED, { mark: true })), [["P0001", "correct", "M"], ["P0002", "correct", "F"], ["P0003", "correct", "F"]]);
  // written: no record gives their facts, so each sex is corrected (U01-d) — and undone, unknown again
  const r = (await w.ok(["sync", send(AS_GUESSED, { vers: "3.10.0-beta.11" }), "--apply", "--json"])).json;
  assert.equal(r.conflicts.length, 0, JSON.stringify(r));
  const sexes = async () => Promise.all(["P0001", "P0002", "P0003"].map(async (id) => (await w.ok(["person", "show", id, "--json"])).json.person.sex as string));
  assert.deepEqual(await sexes(), ["M", "F", "F"]);
  await w.ok(["sync", "undo", "I1"]);
  assert.deepEqual(await sexes(), ["U", "U", "U"]);
  w.cleanup();
});

test("U01 (GEDCOM): a file that says neither the header's mark nor an app from 3.10.0-beta.11 — an older app (3.10.0-beta.10, 3.9.0, its fixed 1.0), no VERS at all, another program's file — is read as before: the old guess no edit", opts, async () => {
  const { w, send, sexChanges } = await research();
  for (const head of [{ vers: "3.10.0-beta.10" }, { vers: "3.9.0" }, { vers: "1.0" }, {}, { sour: "OTHER_PROGRAM", vers: "3.10.0-beta.11" }])
    assert.deepEqual(await sexChanges(send(AS_GUESSED, head)), [], JSON.stringify(head));
  // against the old guess, another sex is still the user's edit (the child set male)
  assert.deepEqual(await sexChanges(send({ ...AS_GUESSED, P0003: "M" }, {})), [["P0003", "conflict", "M"]]);
  w.cleanup();
});

/** The app's JSON of the research (its data version, the research it is of), the sexes as its genders. */
function appJson(w: World, sexes: Sexes, version: number, research: Record<string, unknown> | false = {}): string {
  const tree = JSON.parse(fs.readFileSync(path.join(w.cwd, "strom.json"), "utf8")).id as string;
  const at = execFileSync("git", ["rev-parse", "HEAD"], { cwd: w.cwd, encoding: "utf8" }).trim();
  const gender = (s: string) => (s === "M" ? "male" : s === "F" ? "female" : "unknown");
  const out = path.join(w.dir, `send-${version}-${Math.random().toString(36).slice(2)}.json`);
  fs.writeFileSync(out, JSON.stringify({
    version,
    ...(research ? { research: { id: tree, head: at, ...research } } : {}),
    persons: {
      a: { id: "a", firstName: "Petr", lastName: "Novák", gender: gender(sexes.P0001), birthDate: "1870", refn: "P0001", parentIds: [], childIds: ["c"], partnerships: ["u"] },
      b: { id: "b", firstName: "Marie", lastName: "Nováková", gender: gender(sexes.P0002), birthDate: "1872", refn: "P0002", parentIds: [], childIds: ["c"], partnerships: ["u"] },
      c: { id: "c", firstName: "Eva", lastName: "Nováková", gender: gender(sexes.P0003), birthDate: "1901", refn: "P0003", parentIds: ["a", "b"], childIds: [], partnerships: [] },
    },
    partnerships: { u: { id: "u", person1Id: "a", person2Id: "b", childIds: ["c"], status: "married" } },
  }));
  return out;
}

test("U01 (JSON): the Strom app's data version 12 keeps the gender unknown, guesses none — U → M of the husband, U → F of the wife and of the child, the research link with no research.sexU: each caught; unknown as it stands: nothing", opts, async () => {
  const { w, sexChanges } = await research();
  assert.deepEqual(await sexChanges(appJson(w, AS_GUESSED, 12)), [["P0001", "correct", "M"], ["P0002", "correct", "F"], ["P0003", "correct", "F"]]);
  assert.deepEqual(await sexChanges(appJson(w, AS_GUESSED, 13)), [["P0001", "correct", "M"], ["P0002", "correct", "F"], ["P0003", "correct", "F"]], "a later data version the same");
  assert.deepEqual(await sexChanges(appJson(w, UNKNOWN, 12)), [], "unedited");
  // an older data version guessed (its genders were male and female only): the guess no edit, as before
  assert.deepEqual(await sexChanges(appJson(w, AS_GUESSED, 11)), []);
  assert.deepEqual(await sexChanges(appJson(w, { ...AS_GUESSED, P0003: "M" }, 11)), [["P0003", "conflict", "M"]]);
  w.cleanup();
});

test("U01: the bridge stamps the version the app says (X-Strom-App-Version, ?app=) into a file that names none — read as that app's: 3.10.0-beta.11 guesses no sex, 3.10.0-beta.10 did", () => {
  const text = ["0 HEAD", "1 SOUR STROM", "2 VERS 1.0", "1 CHAR UTF-8", "0 @I1@ INDI", "1 NAME Petr /Novák/", "1 SEX U", "0 TRLR", ""].join("\n");
  assert.equal(readGedcom(text).sexU, undefined, "no version said: the old app's guess");
  assert.equal(readGedcom(stampAppVersion(text, "3.10.0-beta.11")).sexU, true);
  assert.equal(readGedcom(stampAppVersion(text, "3.10.0-beta.10")).sexU, undefined);
  assert.equal(readGedcom(stampAppVersion(text.replace("1 SOUR STROM", "1 SOUR OTHER"), "3.10.0-beta.11")).sexU, undefined, "another program's file: as it came");
});

// ── a sex the user sets unknown in the app (U01-c): the unknown a value like the others ──

type Five = Partial<Record<"P0001" | "P0002" | "P0003" | "P0004" | "P0005", string>>;

/**
 * A research of a family: Jan Novák (P0001, male, his baptism a record), Anna Dvořáková (P0002, female, a lead), their
 * children Karel (P0003, male, a lead), Eva (P0004, a lead) and Vojtěch (P0005, his baptism a record), whose sex the
 * research does not know.
 * given() = the research's Strom file; asApp() = that file as the Strom app sends it back, the sexes changed.
 */
async function family(): Promise<{ w: World; given: () => Promise<string>; asApp: (file: string, sexes: Five, head?: { vers?: string; mark?: boolean }) => string; json: (sexes: Five, version?: number) => string; sexChanges: (file: string) => Promise<[string, string, string][]>; sex: (id: string) => Promise<string> }> {
  const w = new World();
  await w.withTree("Novákovi");
  await w.ok(["lang", "cs"]);
  const s = (await w.ok(["source", "add", "Křest Jana Nováka 1880", "--kind", "baptism", "--locator", "fol. 3", "--json"])).json;
  await w.ok(["person", "add", "Jan /Novák/", "--sex", "M"]);
  await w.ok(["event", "add", "P0001", "CHR", "--date", "1880", "--cite", (s.id ?? s.source?.id) as string, "--status", "probable"]);
  await w.ok(["person", "add", "Anna /Dvořáková/", "--sex", "F", "--born", "1888"]);
  await w.ok(["person", "add", "Karel /Novák/", "--sex", "M", "--born", "1910"]);
  await w.ok(["person", "add", "Eva /Nováková/", "--born", "1912"]);
  await w.ok(["person", "add", "Vojtěch /Novák/", "--born", "1914"]);
  const v = (await w.ok(["source", "add", "Křest Vojtěcha Nováka 1914", "--kind", "baptism", "--locator", "fol. 9", "--json"])).json;
  await w.ok(["event", "add", "P0005", "CHR", "--date", "1914", "--cite", (v.id ?? v.source?.id) as string, "--status", "probable"]);
  await w.ok(["family", "add", "--partner", "P0001", "--partner", "P0002", "--child", "P0003", "--child", "P0004", "--child", "P0005"]);
  let n = 0;
  const given = async () => {
    const out = path.join(w.dir, `given-${++n}.ged`);
    await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", out], { env: { STROM_APP_VERSION: "3.10.0-beta.11" } });
    return out;
  };
  const asApp = (file: string, sexes: Five, head: { vers?: string; mark?: boolean } = { vers: "3.10.0-beta.11", mark: true }) => {
    const text = fs.readFileSync(file, "utf8")
      .replace(/^1 SOUR STROM_RESEARCH\r?\n2 VERS .*\r?\n2 NAME .*$/m, ["1 SOUR STROM", ...(head.vers ? [`2 VERS ${head.vers}`] : []), "2 NAME Strom Family Tree"].join("\n"))
      .replace(/^(1 _STROM_HEAD .*)$/m, head.mark ? "$1\n1 _STROM_SEX_U Y" : "$1");
    const records = text.split(/\n(?=0 )/).map((r) => {
      const id = /\n1 REFN (P\d{4})\r?\n/.exec(r)?.[1] as keyof Five | undefined;
      return id && sexes[id] ? r.replace(/^1 SEX .*$/m, `1 SEX ${sexes[id]}`) : r;
    });
    const out = path.join(w.dir, `app-${++n}.ged`);
    fs.writeFileSync(out, records.join("\n"));
    return out;
  };
  const json = (sexes: Five, version = 12) => {
    const tree = JSON.parse(fs.readFileSync(path.join(w.cwd, "strom.json"), "utf8")).id as string;
    const at = execFileSync("git", ["rev-parse", "HEAD"], { cwd: w.cwd, encoding: "utf8" }).trim();
    const was: Five = { P0001: "M", P0002: "F", P0003: "M", P0004: "U", P0005: "U" };
    const gender = (id: keyof Five) => ({ M: "male", F: "female", U: "unknown" })[(sexes[id] ?? was[id])! as "M" | "F" | "U"];
    const person = (id: keyof Five, firstName: string, lastName: string, more: Record<string, unknown>) => ({ id, firstName, lastName, gender: gender(id), refn: id, refnType: "strom-research", ...more });
    const out = path.join(w.dir, `app-${++n}.json`);
    fs.writeFileSync(out, JSON.stringify({
      version,
      research: { id: tree, head: at },
      persons: {
        P0001: person("P0001", "Jan", "Novák", { parentIds: [], childIds: ["P0003", "P0004", "P0005"], partnerships: ["u"], events: [{ type: "baptism", date: "1880" }] }),
        P0002: person("P0002", "Anna", "Dvořáková", { birthDate: "1888", parentIds: [], childIds: ["P0003", "P0004", "P0005"], partnerships: ["u"] }),
        P0003: person("P0003", "Karel", "Novák", { birthDate: "1910", parentIds: ["P0001", "P0002"], childIds: [], partnerships: [] }),
        P0004: person("P0004", "Eva", "Nováková", { birthDate: "1912", parentIds: ["P0001", "P0002"], childIds: [], partnerships: [] }),
        P0005: person("P0005", "Vojtěch", "Novák", { birthDate: "1914", parentIds: ["P0001", "P0002"], childIds: [], partnerships: [], events: [{ type: "baptism", date: "1914" }] }),
      },
      partnerships: { u: { id: "u", person1Id: "P0001", person2Id: "P0002", childIds: ["P0003", "P0004", "P0005"], status: "married" } },
    }));
    return out;
  };
  const sexChanges = async (file: string) =>
    ((await w.ok(["sync", file, "--json"])).json.changes as { kind: string; action: string; person: string; text: string }[]).filter((c) => c.kind === "sex.changed").map((c) => [c.person, c.action, c.text] as [string, string, string]);
  const sex = async (id: string) => (await w.ok(["person", "show", id, "--json"])).json.person.sex as string;
  return { w, given, asApp, json, sexChanges, sex };
}

/**
 * M → U of the man with a record (the user's to decide), F → U and M → U of leads (corrected), U → F of the child the
 * research does not know and no record gives (corrected, U01-d), U → M of the one a record gives (the user's to decide).
 */
const EDITED: Five = { P0001: "U", P0002: "U", P0003: "U", P0004: "F", P0005: "M" };
const CAUGHT = [["P0001", "conflict", "U"], ["P0002", "correct", "U"], ["P0003", "correct", "U"], ["P0004", "correct", "F"], ["P0005", "conflict", "M"]];

test("U01 (GEDCOM): a sex set unknown in the Strom app (its header's mark, or its 3.10.0-beta.11 by VERS) is the user's edit — M → U, F → U of a lead corrected, of a record's person the user's to decide; U → F, U → M caught too; unedited: nothing; written, decided and undone", opts, async () => {
  const { w, given, asApp, sexChanges, sex } = await family();
  assert.deepEqual(await sexChanges(asApp(await given(), {})), [], "unedited");
  assert.deepEqual(await sexChanges(asApp(await given(), EDITED)), CAUGHT, "the header's mark");
  assert.deepEqual(await sexChanges(asApp(await given(), EDITED, { vers: "3.10.0-beta.11" })), CAUGHT, "its version alone");
  // written: the leads' sex as set (unknown, and Eva female), the records' people kept until the user decides
  const r = (await w.ok(["sync", asApp(await given(), EDITED), "--apply", "--json"])).json;
  assert.deepEqual([await sex("P0001"), await sex("P0002"), await sex("P0003"), await sex("P0004"), await sex("P0005")], ["M", "U", "U", "F", "U"]);
  const conflict = (id: string) => (r.conflicts as { id: string; person?: string }[]).find((c) => c.person === id)!.id;
  assert.match((await w.ok(["conflict", "show", conflict("P0001")])).out, /Jan Novák: Pohlaví — muž × neznámé/);
  assert.match((await w.ok(["conflict", "show", conflict("P0005")])).out, /Vojtěch Novák: Pohlaví — neznámé × muž/);
  await w.ok(["conflict", "resolve", conflict("P0001"), "--take", "user", "--reasoning", "the family does not know"]);
  await w.ok(["conflict", "resolve", conflict("P0005"), "--take", "user", "--reasoning", "the family knows"]);
  assert.deepEqual([await sex("P0001"), await sex("P0005")], ["U", "M"]);
  assert.match((await w.ok(["check"])).out, /^ok/);
  // undone: the sexes as they were — Eva unknown again
  const undo = await w.ok(["sync", "undo", "I1"]);
  assert.match(undo.out, /I0001/);
  assert.deepEqual([await sex("P0002"), await sex("P0003"), await sex("P0004")], ["F", "M", "U"]);
  w.cleanup();
});

test("U01 (JSON): a gender set unknown in the Strom app's data version 12 is the user's edit as in its GEDCOM — M → U, F → U, U → F, U → M each caught; unedited: nothing; data version 11 (male and female only) as before", opts, async () => {
  const { w, json, sexChanges, sex } = await family();
  assert.deepEqual(await sexChanges(json({})), [], "unedited");
  assert.deepEqual(await sexChanges(json(EDITED)), CAUGHT);
  await w.ok(["sync", json(EDITED), "--apply"]);
  assert.deepEqual([await sex("P0002"), await sex("P0003")], ["U", "U"]);
  w.cleanup();
});

test("U01: sync.edits user — a sex set unknown in the app wins over the record's, as any edit of the user's; undone back", opts, async () => {
  const { w, given, asApp, sexChanges, sex } = await family();
  await w.ok(["config", "set", "sync.edits", "user"], { tty: true });
  assert.deepEqual(await sexChanges(asApp(await given(), { P0001: "U" })), [["P0001", "user", "U"]]);
  await w.ok(["sync", asApp(await given(), { P0001: "U" }), "--apply"]);
  assert.equal(await sex("P0001"), "U");
  await w.ok(["sync", "undo", "I1"]);
  assert.equal(await sex("P0001"), "M");
  w.cleanup();
});

test("U01-d: U → M and U → F from a file whose unknown is exact (the header's mark, the app's VERS from 3.10.0-beta.11, its JSON from data version 12) are edits like M → U — a correction where no record gives the person's facts, a conflict where one does, the user's word with sync.edits user; undone, unknown again; a file whose unknown is the app's guess as before", opts, async () => {
  const { w, given, asApp, json, sexChanges, sex } = await family();
  const files = async (sexes: Five) => [asApp(await given(), sexes), asApp(await given(), sexes, { vers: "3.10.0-beta.11" }), json(sexes)];
  for (const sexes of [{ P0004: "F", P0005: "M" }, { P0004: "M", P0005: "F" }])
    for (const file of await files(sexes))
      assert.deepEqual(await sexChanges(file), [["P0004", "correct", sexes.P0004], ["P0005", "conflict", sexes.P0005]], `${JSON.stringify(sexes)} ${path.basename(file)}`);
  // the app's guess (an app before 3.10.0-beta.11, no mark): set otherwise, the user's to decide, record or none — as before
  assert.deepEqual(await sexChanges(asApp(await given(), { P0004: "M", P0005: "M" }, {})), [["P0004", "conflict", "M"], ["P0005", "conflict", "M"]]);
  assert.deepEqual(await sexChanges(asApp(await given(), { P0004: "F", P0005: "F" }, { vers: "3.10.0-beta.10" })), [], "as the old app guessed: no edit");
  // written: Eva's corrected with the sync as the reason, Vojtěch's for the user; undone, Eva unknown again
  const r = (await w.ok(["sync", asApp(await given(), { P0004: "F", P0005: "M" }), "--apply", "--json"])).json;
  assert.deepEqual([await sex("P0004"), await sex("P0005")], ["F", "U"]);
  assert.deepEqual((r.conflicts as { person?: string }[]).map((c) => c.person), ["P0005"]);
  const ops = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? ops(path.join(dir, e.name)) : e.name.endsWith(".jsonl") ? fs.readFileSync(path.join(dir, e.name), "utf8").split("\n") : []));
  assert.ok(ops(path.join(w.cwd, "data", "ops")).some((l) => l.includes("P0004") && l.includes("the user's edit")), "the reason: the user's edit, sent from the app");
  await w.ok(["sync", "undo", "I1"]);
  assert.deepEqual([await sex("P0004"), await sex("P0005")], ["U", "U"]);
  // sync.edits user: the user's word over the record's unknown too
  await w.ok(["config", "set", "sync.edits", "user"], { tty: true });
  assert.deepEqual(await sexChanges(json({ P0004: "F", P0005: "M" })), [["P0004", "user", "F"], ["P0005", "user", "M"]]);
  w.cleanup();
});

test("U01: a file with neither the header's mark nor an app from 3.10.0-beta.11 (no VERS at all, an older app, another program) — SEX U is nothing it says, as before: a known sex stays, no change", opts, async () => {
  const { w, given, asApp, sexChanges } = await family();
  for (const vers of [undefined, "3.10.0-beta.10", "1.0"]) assert.deepEqual(await sexChanges(asApp(await given(), { P0001: "U", P0002: "U" }, vers ? { vers } : {})), [], String(vers));
  const other = fs.readFileSync(asApp(await given(), { P0001: "U", P0002: "U" }, {}), "utf8").replace("1 SOUR STROM\n", "1 SOUR OTHER_PROGRAM\n");
  fs.writeFileSync(path.join(w.dir, "other.ged"), other);
  assert.deepEqual(await sexChanges(path.join(w.dir, "other.ged")), []);
  // a file of another program that writes no SEX at all: nothing either
  fs.writeFileSync(path.join(w.dir, "nosex.ged"), other.replace(/^1 SEX .*\r?\n/gm, ""));
  assert.deepEqual(await sexChanges(path.join(w.dir, "nosex.ged")), []);
  w.cleanup();
});

/** The Strom app's repository beside this one (a worktree of it too: looked for above), at least of the version given. */
function appRepo(min: string, name = "strom-beta"): { repo: string; tsx: string; version: string } | undefined {
  let dir = path.resolve(import.meta.dirname, "..", "..");
  for (let i = 0; i < 5; i++, dir = path.dirname(dir)) {
    const repo = path.join(path.dirname(dir), name);
    const tsx = path.join(repo, "node_modules", ".bin", process.platform === "win32" ? "tsx.cmd" : "tsx");
    if (!fs.existsSync(path.join(repo, "src", "ged-parser.ts")) || !fs.existsSync(tsx)) continue;
    const version = JSON.parse(fs.readFileSync(path.join(repo, "package.json"), "utf8")).version as string;
    return compareVersions(version, min) >= 0 ? { repo, tsx, version } : undefined;
  }
  return undefined;
}

/**
 * The research's file through the app's own parser and exporter: its genders set by REFN ("P0002=unknown"), back as
 * its GEDCOM linked to the research and as its JSON export ({ version, …data, research }).
 */
function throughApp(app: { repo: string; tsx: string }, w: World, given: string, edits: Record<string, string> = {}): { ged: string; json: string } {
  const script = path.join(w.dir, "app-sex.ts");
  fs.writeFileSync(
    script,
    `import fs from "node:fs";
import { parseGedcom, convertToStrom } from ${JSON.stringify(path.join(app.repo, "src", "ged-parser.ts"))};
import { exportToGedcom } from ${JSON.stringify(path.join(app.repo, "src", "ged-exporter.ts"))};
import { STROM_DATA_VERSION } from ${JSON.stringify(path.join(app.repo, "src", "types.ts"))};
const [input, ged, json, edits] = process.argv.slice(2);
const text = fs.readFileSync(input!, "utf8");
const research = { id: /^1 _STROM_TREE (.+)$/m.exec(text)![1]!, head: /^1 _STROM_HEAD (.+)$/m.exec(text)![1]! };
const data: any = convertToStrom(parseGedcom(text)).data;
for (const [refn, gender] of Object.entries(JSON.parse(edits!) as Record<string, string>)) {
  const p: any = Object.values(data.persons).find((x: any) => x.refn === refn);
  if (!p) throw new Error("no " + refn);
  p.gender = gender;
}
fs.writeFileSync(ged!, exportToGedcom(data, "Novákovi", { research }).content);
fs.writeFileSync(json!, JSON.stringify({ ...data, version: STROM_DATA_VERSION, research }, null, 1));
`,
  );
  const tag = Math.random().toString(36).slice(2);
  const [ged, json] = [path.join(w.dir, `back-${tag}.ged`), path.join(w.dir, `back-${tag}.json`)];
  const r = spawnSync(app.tsx, [script, given, ged, json, JSON.stringify(edits)], { cwd: app.repo, encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  return { ged, json };
}

const APP = appRepo("3.10.0-beta.11");

test(`U01: the Strom app ${APP?.version ?? "3.10.0-beta.11"} itself (its parser and exporter) — research → app → research: unedited nothing, through its GEDCOM and its JSON; M → U, F → U, U → F, U → M set there each caught through both`, { skip: !hasGit || !APP }, async () => {
  const { w, given, sexChanges } = await family();
  const plain = throughApp(APP!, w, await given());
  for (const file of [plain.ged, plain.json]) assert.deepEqual((await w.ok(["sync", file, "--json"])).json.changes, [], `unedited: ${path.extname(file)}`);
  const edited = throughApp(APP!, w, await given(), { P0001: "unknown", P0002: "unknown", P0003: "unknown", P0004: "female", P0005: "male" });
  for (const file of [edited.ged, edited.json]) assert.deepEqual(await sexChanges(file), CAUGHT, path.extname(file));
  w.cleanup();
});

// ── a couple of one sex, or of a sex unknown: both partners in the family, sided as the Strom app sides them ──

test("Export: coupleSides — a man HUSB, a woman WIFE, an unknown sex the side left free; two of one sex or two unknown in their order; one alone HUSB unless a woman", () => {
  const p = (id: string, sex: string) => ({ id, sex });
  const sides = (a?: { id: string; sex: string }, b?: { id: string; sex: string }) => coupleSides(a, b).map((x) => x?.id ?? "-").join(" ");
  const [m, f, u, m2, f2, u2] = [p("m", "M"), p("f", "F"), p("u", "U"), p("m2", "M"), p("f2", "F"), p("u2", "U")];
  assert.equal(sides(m, f), "m f");
  assert.equal(sides(f, m), "m f");
  assert.equal(sides(f, f2), "f f2");
  assert.equal(sides(m, m2), "m m2");
  assert.equal(sides(f, u), "u f");
  assert.equal(sides(u, f), "u f");
  assert.equal(sides(u, m), "m u");
  assert.equal(sides(m, u), "m u");
  assert.equal(sides(u, u2), "u u2");
  assert.equal(sides(f), "- f");
  assert.equal(sides(u), "u -");
  assert.equal(sides(m), "m -");
});

/** Each FAM of a file: its HUSB and WIFE, then its children, by their REFN. */
function famSides(file: string): string[] {
  const records = fs.readFileSync(file, "utf8").split(/\r?\n(?=0 )/);
  const refn = new Map(records.map((r) => [/^0 (@[^@]+@) INDI/.exec(r)?.[1], /\n1 REFN (P\d{4})/.exec(r)?.[1]] as const).filter(([x, k]) => x && k));
  return records
    .filter((r) => /^0 @[^@]+@ FAM/.test(r))
    .map((r) => {
      const who = (tag: string) => [...r.matchAll(new RegExp(`\\n1 ${tag} (@[^@]+@)`, "g"))].map((m) => refn.get(m[1]!) ?? m[1]!);
      return `${who("HUSB").join(",") || "-"} + ${who("WIFE").join(",") || "-"}: ${who("CHIL").join(",")}`;
    })
    .sort();
}

/**
 * Couples of every kind with a child each: Anna + Marie (two women), Petr + Pavel (two men), Eva + one of unknown sex,
 * one of unknown sex + Zdena, two of unknown sex, Jan + Jana.
 */
async function couples(): Promise<{ w: World; given: (standard?: boolean) => Promise<string> }> {
  const w = new World();
  await w.withTree("Novákovi");
  await w.ok(["lang", "cs"]);
  const pairs: [string, string | undefined, string, string | undefined][] = [
    ["Anna /Dvořáková/", "F", "Marie /Nováková/", "F"],
    ["Petr /Novák/", "M", "Pavel /Svoboda/", "M"],
    ["Eva /Malá/", "F", "Alex /Malý/", undefined],
    ["Robin /Veselý/", undefined, "Zdena /Veselá/", "F"],
    ["Kim /Černý/", undefined, "Saša /Černá/", undefined],
    ["Jan /Horák/", "M", "Jana /Horáková/", "F"],
  ];
  for (const [i, [a, sa, b, sb]] of pairs.entries()) {
    for (const [name, sex, born] of [[a, sa, 1850 + i], [b, sb, 1852 + i], [`Dítě${i + 1} /Novák/`, undefined, 1880 + i]] as const)
      await w.ok(["person", "add", name, ...(sex ? ["--sex", sex] : []), "--born", String(born)]);
    const [x, y, c] = [3 * i + 1, 3 * i + 2, 3 * i + 3].map((n) => `P${String(n).padStart(4, "0")}`);
    await w.ok(["family", "add", "--partner", x!, "--partner", y!, "--child", c!]);
  }
  let n = 0;
  const given = async (standard = false) => {
    const out = path.join(w.dir, `couples-${++n}.ged`);
    await w.ok(["export", "gedcom", ...(standard ? ["--for", "standard"] : ["--for", "strom", "--images-for", "none"]), "--out", out], { env: { STROM_APP_VERSION: "3.10.0-beta.11" } });
    return out;
  };
  return { w, given };
}

/** The families of couples(), each as famSides writes it. */
const SIDES = [
  "P0001 + P0002: P0003", // two women: in their order
  "P0004 + P0005: P0006", // two men: in their order
  "P0008 + P0007: P0009", // a woman and one of unknown sex: the unknown HUSB
  "P0010 + P0011: P0012", // one of unknown sex and a woman
  "P0013 + P0014: P0015", // two of unknown sex: in their order
  "P0016 + P0017: P0018", // a man and a woman
];

test("Export: a couple of two women, two men, a woman and one of unknown sex (either order), two of unknown sex — both partners in the family (HUSB and WIFE) in the standard GEDCOM and the Strom file; the Strom file back: no change, the same families", opts, async () => {
  const { w, given } = await couples();
  for (const standard of [true, false]) assert.deepEqual(famSides(await given(standard)), SIDES, `standard: ${standard}`);
  assert.deepEqual((await w.ok(["sync", await given(), "--json"])).json.changes, [], "unedited");
  // a child the user added to the family of the two women: that family's, never another one
  const text = fs.readFileSync(await given(), "utf8");
  const anna = /0 (@[^@]+@) INDI\r?\n(?:[1-9].*\r?\n)*?1 REFN P0001\r?\n/.exec(text)![1]!;
  const fam = new RegExp(`0 (@[^@]+@) FAM\\r?\\n1 HUSB ${anna}\\r?\\n`).exec(text)![1]!;
  const out = path.join(w.dir, "child.ged");
  const withChild = text
    .replace(new RegExp(`(0 ${fam} FAM\\r?\\n(?:[1-9].*\\r?\\n)*)`), "$11 CHIL @X1@\n")
    .replace(new RegExp(`(0 ${fam} FAM\\r?\\n)`), `0 @X1@ INDI\n1 NAME Ema /Nováková/\n1 SEX F\n1 BIRT\n2 DATE 1890\n1 FAMC ${fam}\n$1`);
  fs.writeFileSync(out, withChild);
  const changes = (await w.ok(["sync", out, "--json"])).json.changes as { kind: string }[];
  assert.equal(changes.some((c) => c.kind === "family.new"), false, JSON.stringify(changes));
  assert.ok(changes.some((c) => c.kind === "person.new"), JSON.stringify(changes));
  await w.ok(["sync", out, "--apply"]);
  assert.deepEqual(famSides(await given()), ["P0001 + P0002: P0003,P0019", ...SIDES.slice(1)], "Ema the child of Anna and Marie");
  w.cleanup();
});

test(`Export: couples of one sex and of sex unknown with their children through the Strom app ${APP?.version ?? "3.10.0-beta.11"} itself — both partners kept, research → app → research unedited no change (GEDCOM and JSON); a sex set there caught, the families the same`, { skip: !hasGit || !APP }, async () => {
  const { w, given } = await couples();
  const plain = throughApp(APP!, w, await given());
  assert.deepEqual(famSides(plain.ged), SIDES, "the app's own GEDCOM: both partners of each couple");
  for (const file of [plain.ged, plain.json]) assert.deepEqual((await w.ok(["sync", file, "--json"])).json.changes, [], `unedited: ${path.extname(file)}`);
  // Marie (of the two women) set unknown, Kim (of the two unknown) set male: each the user's edit, nothing else
  const edited = throughApp(APP!, w, await given(), { P0002: "unknown", P0013: "male" });
  for (const file of [edited.ged, edited.json]) {
    const changes = (await w.ok(["sync", file, "--json"])).json.changes as { kind: string; action: string; person: string; text: string }[];
    assert.deepEqual(changes.map((c) => [c.kind, c.person, c.action, c.text]), [["sex.changed", "P0002", "correct", "U"], ["sex.changed", "P0013", "correct", "M"]], path.extname(file));
  }
  await w.ok(["sync", edited.ged, "--apply"]);
  assert.deepEqual(famSides(await given()), SIDES, "Marie of unknown sex now: her couple's sides kept, the families the same");
  w.cleanup();
});

// ── the sides kept when a sex changes (U01-e): the Strom app before 3.10.0-beta.11 guesses an unknown sex by the side ──

/** The sexes changed as the sides would swap by coupleSides alone: Marie unknown (two women), Petr unknown (two men), Kim female (two unknown); Jana unknown (a man and a woman: no swap). */
async function changeSexes(w: World): Promise<void> {
  for (const [id, sex] of [["P0002", "U"], ["P0004", "U"], ["P0013", "F"], ["P0017", "U"]]) await w.ok(["person", "edit", id!, "--sex", sex!, "--reason", "the record says nothing of it"]);
}

test("Export (U01-e): a sex changed in a couple of one sex or of sex unknown keeps the couple's sides — HUSB and WIFE as before in the Strom file, the Strom file back no change; the standard GEDCOM by sex alone (B5-c: a man HUSB, a woman WIFE beside one of unknown sex); the sexes back, the sides by sex again and nothing kept; a woman never HUSB beside a man", opts, async () => {
  const { w, given } = await couples();
  const before = famSides(await given());
  await changeSexes(w);
  assert.deepEqual(famSides(await given()), before, "the Strom file: the sides kept");
  // the standard file as the Strom app's coupleSides sides them: Marie of unknown sex HUSB beside Anna, Pavel (a man)
  // HUSB beside Petr of unknown sex, Saša of unknown sex HUSB beside Kim (a woman)
  assert.deepEqual(famSides(await given(true)), ["P0002 + P0001: P0003", "P0005 + P0004: P0006", "P0008 + P0007: P0009", "P0010 + P0011: P0012", "P0014 + P0013: P0015", "P0016 + P0017: P0018"], "the standard file: by sex");
  assert.deepEqual((await w.ok(["sync", await given(), "--json"])).json.changes, [], "the Strom file back: no change");
  assert.match((await w.ok(["check"])).out, /^ok/);
  const kept = async () => Promise.all(["F0001", "F0002", "F0005", "F0006"].map(async (f) => ((await w.ok(["family", "show", f, "--json"])).json.family.husb as string | undefined) ?? "-"));
  assert.deepEqual(await kept(), ["P0001", "P0004", "P0013", "-"], "kept where coupleSides would swap them, nothing where it would not");
  // the sexes as they were: the sides by sex again, nothing kept
  for (const [id, sex] of [["P0002", "F"], ["P0004", "M"], ["P0013", "U"], ["P0017", "F"]]) await w.ok(["person", "edit", id!, "--sex", sex!, "--reason", "back"]);
  assert.deepEqual(famSides(await given()), before);
  assert.deepEqual(await kept(), ["-", "-", "-", "-"]);
  // Kim a woman again (her side kept), then Saša set male: a man beside a woman — the sides by sex, nothing kept
  await w.ok(["person", "edit", "P0013", "--sex", "F", "--reason", "the record says so"]);
  await w.ok(["person", "edit", "P0014", "--sex", "M", "--reason", "the record says so"]);
  assert.ok(famSides(await given()).includes("P0014 + P0013: P0015"), "a woman never HUSB beside a man");
  assert.deepEqual(await kept(), ["-", "-", "-", "-"]);
  assert.match((await w.ok(["check"])).out, /^ok/);
  w.cleanup();
});

test("Export (U01-e): a sex the user set in the Strom app and synced back keeps the couple's sides; strom sync undo takes it back with them", opts, async () => {
  const { w, given } = await couples();
  const before = famSides(await given());
  // Marie (of the two women) set unknown in the app 3.10.0-beta.11: its file, the header's mark
  const text = fs.readFileSync(await given(), "utf8").replace(/^1 SOUR STROM_RESEARCH\r?\n2 VERS .*\r?\n2 NAME .*$/m, "1 SOUR STROM\n2 VERS 3.10.0-beta.11\n2 NAME Strom Family Tree").replace(/^(1 _STROM_HEAD .*)$/m, "$1\n1 _STROM_SEX_U Y");
  const marie = text.split(/\n(?=0 )/).map((r) => (/\n1 REFN P0002\r?\n/.test(r) ? r.replace(/^1 SEX F$/m, "1 SEX U") : r)).join("\n");
  fs.writeFileSync(path.join(w.dir, "marie.ged"), marie);
  await w.ok(["sync", path.join(w.dir, "marie.ged"), "--apply"]);
  assert.equal((await w.ok(["person", "show", "P0002", "--json"])).json.person.sex, "U");
  assert.deepEqual(famSides(await given()), before);
  await w.ok(["sync", "undo", "I1"]);
  assert.equal((await w.ok(["person", "show", "P0002", "--json"])).json.person.sex, "F");
  assert.equal((await w.ok(["family", "show", "F0001", "--json"])).json.family.husb, undefined);
  assert.deepEqual(famSides(await given()), before);
  w.cleanup();
});

/**
 * The research's Strom file before and after the sexes change, through the app's own parser (and, where it has them,
 * its load of a new version over the tree: keepKnownSex, stabilizeIds) — per person by REFN their gender, per couple
 * its partners and children in order, and the app's own export of each.
 */
function appView(app: { repo: string; tsx: string }, w: World, before: string, after: string): { genders: Record<string, string>[]; couples: string[][]; exports: string[][] } {
  const script = path.join(w.dir, "app-view.mts");
  fs.writeFileSync(
    script,
    `import fs from "node:fs";
const parser: any = await import(${JSON.stringify(path.join(app.repo, "src", "ged-parser.ts"))});
const exporter: any = await import(${JSON.stringify(path.join(app.repo, "src", "ged-exporter.ts"))});
const link: any = await import(${JSON.stringify(path.join(app.repo, "src", "research-link.ts"))});
const parse = (f: string) => parser.convertToStrom(parser.parseGedcom(fs.readFileSync(f, "utf8"))).data;
const previous = parse(process.argv[2]!);
let next = parse(process.argv[3]!);
if (link.keepKnownSex && parser.sexGuessedIn) next = link.keepKnownSex(next, previous, parser.sexGuessedIn(next));
if (link.stabilizeIds) next = link.stabilizeIds(next, previous);
const refn = (d: any, id: string) => d.persons[id]?.refn ?? id;
const genders = (d: any) => Object.fromEntries(Object.values(d.persons).filter((p: any) => p.refn).map((p: any) => [p.refn, p.gender]));
const couples = (d: any) => Object.values(d.partnerships).map((u: any) => [u.id, refn(d, u.person1Id), refn(d, u.person2Id), ...(u.childIds ?? []).map((c: string) => refn(d, c))].join(" ")).sort();
const fams = (d: any) => exporter.exportToGedcom(d, "T", {}).content.split(/\\n(?=0 )/).filter((r: string) => / FAM/.test(r.split("\\n")[0])).map((r: string) => r.split("\\n").filter((l: string) => /^1 (HUSB|WIFE|CHIL)/.test(l)).join(" "));
console.log(JSON.stringify({ genders: [genders(previous), genders(next)], couples: [couples(previous), couples(next)], exports: [fams(previous), fams(next)] }));
`,
  );
  const r = spawnSync(app.tsx, [script, before, after], { cwd: app.repo, encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout.trim().split("\n").pop()!);
}

for (const [name, min] of [["strom", "3.9.0"], ["strom-beta", "3.10.0-beta.11"]] as const) {
  const app = appRepo(min, name);
  test(`Export (U01-e): the Strom app ${app?.version ?? `${min} (${name})`} itself loads the research after the sexes changed — every couple the same (its partners, its children in order), its own export the same, no gender but those the research changed (an app that guesses: its guesses as before)`, { skip: !hasGit || !app }, async () => {
    const { w, given } = await couples();
    const before = await given();
    await changeSexes(w);
    const v = appView(app!, w, before, await given());
    assert.deepEqual(v.couples[1], v.couples[0], "the couples");
    const knows = compareVersions(app!.version, "3.10.0-beta.11") >= 0;
    // the app that guesses writes its couples as before (its genders the same); the one that knows the unknown sides
    // them by the genders it now has, whichever side the research wrote (its coupleSides)
    if (!knows) assert.deepEqual(v.exports[1], v.exports[0], "the app's own export of them");
    const changed = Object.keys(v.genders[1]!).filter((k) => v.genders[1]![k] !== v.genders[0]![k]).sort();
    // the app that knows the unknown: the four the research changed; the one that guesses: only Kim, unknown → female
    // (Marie, Petr and Jana keep the guess their side gave — what they were — and Saša hers)
    assert.deepEqual(changed, knows ? ["P0002", "P0004", "P0013", "P0017"] : ["P0013"], JSON.stringify(v.genders));
    w.cleanup();
  });
}

// ── a family's kept side once a partner is gone (B5-a): dropped, never an error ──

/** A couple of unknown sex with a son: Cyril (P0001, the HUSB) set a woman, so the couple keeps him… her as HUSB (husb P0001). */
async function keptCouple(): Promise<{ w: World; strom: () => Promise<string>; husb: (f?: string) => Promise<string | undefined> }> {
  const w = new World();
  await w.withTree("Velcí");
  await w.ok(["lang", "cs"]);
  await w.ok(["person", "add", "Cyril /Velký/", "--born", "1890"]);
  await w.ok(["person", "add", "Dana /Velká/", "--born", "1892"]);
  await w.ok(["person", "add", "Ivo /Velký/", "--born", "1920", "--sex", "M"]);
  await w.ok(["family", "add", "--partner", "P0001", "--partner", "P0002", "--child", "P0003"]);
  await w.ok(["person", "edit", "P0001", "--sex", "F", "--reason", "the record says so"]);
  const husb = async (f = "F0001") => (await w.ok(["family", "show", f, "--json"])).json.family.husb as string | undefined;
  assert.equal(await husb(), "P0001");
  let n = 0;
  const strom = async () => {
    const out = path.join(w.dir, `velci-${++n}.ged`);
    await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", out], { env: { STROM_APP_VERSION: "3.10.0-beta.11" } });
    return out;
  };
  return { w, strom, husb };
}

/** The research's Strom file as the Strom app 3.10.0-beta.11 sends it back, with the partner of that REFN taken out of their family. */
function sentWithout(file: string, refn: string): string {
  const records = fs
    .readFileSync(file, "utf8")
    .replace(/^1 SOUR STROM_RESEARCH\r?\n2 VERS .*\r?\n2 NAME .*$/m, "1 SOUR STROM\n2 VERS 3.10.0-beta.11\n2 NAME Strom Family Tree")
    .replace(/^(1 _STROM_HEAD .*)$/m, "$1\n1 _STROM_SEX_U Y")
    .split(/\n(?=0 )/);
  const person = records.find((r) => new RegExp(`\\n1 REFN ${refn}\\r?\\n`).test(r))!;
  const xref = /^0 (@[^@]+@) INDI/.exec(person)![1]!;
  const out = records
    .map((r) => (r === person ? r.replace(/^1 FAMS .*\r?\n/m, "") : /^0 @[^@]+@ FAM/.test(r) ? r.replace(new RegExp(`^1 (HUSB|WIFE) ${xref}\\r?\\n`, "m"), "") : r))
    .join("\n");
  const sent = file.replace(/\.ged$/, `-without-${refn}.ged`);
  fs.writeFileSync(sent, out);
  return sent;
}

test("B5-a: an archive mirrors a partner the Strom app took out of a couple whose side was kept (husb) — written, the kept side dropped, check ok, the family written to again", opts, async () => {
  for (const gone of ["P0002", "P0001"]) {
    const { w, strom, husb } = await keptCouple();
    await w.ok(["mode", "archive"], { tty: true });
    const r = await w.ok(["sync", sentWithout(await strom(), gone), "--apply", "--json"]);
    assert.equal((r.json.skipped ?? []).length, 0, JSON.stringify(r.json.skipped));
    const family = (await w.ok(["family", "show", "F0001", "--json"])).json.family;
    assert.deepEqual(family.partners, ["P0001", "P0002"].filter((p) => p !== gone), `${gone} gone`);
    assert.equal(await husb(), undefined, "no side kept in a family of one partner");
    assert.match((await w.ok(["check"])).out, /^ok/);
    await w.ok(["event", "add", "F0001", "MARR", "--date", "1915"]);
    w.cleanup();
  }
});

test("B5-a: a family an older strom left with a kept side (husb) that names no partner of it — one partner taken away, or a person not in it — reads, checks and writes as without it: check ok, the family written to, the field gone", opts, async () => {
  const { w, husb } = await keptCouple();
  await w.ok(["person", "add", "Olga /Nová/", "--born", "1900", "--sex", "F"]);
  await w.ok(["person", "add", "Pavel /Nový/", "--born", "1898", "--sex", "M"]);
  await w.ok(["family", "add", "--partner", "P0004", "--partner", "P0005"]);
  // what an older strom writes: it knows no husb and keeps it as it is (1.12.1, 1.13.0-beta.4: family edit --remove)
  const tree = Tree.open(w.cwd, w.env);
  tree.withTreeLock(() => {
    for (const [id, edit] of [["F0001", (f: Family) => ({ ...f, partners: ["P0001"] })], ["F0002", (f: Family) => ({ ...f, husb: "P0003" })]] as const) {
      const file = tree.recordPath("family", id);
      const content = stringifyCanonical(edit(JSON.parse(fs.readFileSync(file, "utf8")) as Family));
      tree.appendOp({ op: "family.edit", targets: [id], summary: `${id} as an older strom wrote it`, files: [{ path: tree.relative(file), sha: sha256(content) }] });
      writeFileAtomic(file, content);
    }
    tree.commit("An older strom", ["data"]);
  });
  const stored = (id: string) => JSON.parse(fs.readFileSync(path.join(w.cwd, "data", "families", `${id}.json`), "utf8")) as Family;
  assert.equal(stored("F0001").husb, "P0001");
  assert.equal(stored("F0002").husb, "P0003");
  const check = await w.run(["check"]);
  assert.equal(check.code, 0, check.out + check.err);
  assert.match(check.out, /^ok/);
  assert.equal(await husb("F0001"), undefined);
  assert.equal(await husb("F0002"), undefined);
  await w.ok(["event", "add", "F0001", "MARR", "--date", "1915"]);
  await w.ok(["event", "add", "F0002", "MARR", "--date", "1925"]);
  assert.equal("husb" in stored("F0001"), false, "dropped when written");
  assert.equal("husb" in stored("F0002"), false, "dropped when written");
  assert.match((await w.ok(["check"])).out, /^ok/);
  w.cleanup();
});

// ── strom sync undo puts back the sides a sync moved (B5-b) ──

/** The families of the research's Strom file and of its standard GEDCOM, each as famSides writes them. */
async function bothSides(w: World): Promise<string[][]> {
  const out: string[][] = [];
  for (const as of ["strom", "standard"]) {
    const file = path.join(w.dir, `sides-${as}-${Date.now()}.ged`);
    await w.ok(["export", "gedcom", "--for", as, ...(as === "strom" ? ["--images-for", "none"] : []), "--out", file], { env: { STROM_APP_VERSION: "3.9.0" } });
    out.push(famSides(file));
  }
  return out;
}

test("B5-b: strom sync undo after the Strom app swapped the sexes of a couple of unknown sex (she a man, he a woman) — the sexes back and the couple's sides as before the sync, nothing kept; with sync.edits user too", opts, async () => {
  for (const edits of ["conflict", "user"]) {
    const { w, send } = await research();
    const before = await bothSides(w);
    assert.deepEqual(before[0], ["P0001 + P0002: P0003"]);
    await w.ok(["sync", send({ P0001: "F", P0002: "M", P0003: "U" }, { vers: "3.10.0-beta.11", mark: true }), "--apply", "--edits", edits]);
    const show = async () => Promise.all(["P0001", "P0002"].map(async (p) => (await w.ok(["person", "show", p, "--json"])).json.person.sex as string));
    assert.deepEqual(await show(), ["F", "M"], edits);
    assert.deepEqual((await bothSides(w))[1], ["P0002 + P0001: P0003"], "the standard file: the man HUSB");
    await w.ok(["sync", "undo", "I1"]);
    assert.deepEqual(await show(), ["U", "U"], edits);
    assert.equal((await w.ok(["family", "show", "F0001", "--json"])).json.family.husb, undefined, edits);
    assert.deepEqual(await bothSides(w), before, `${edits}: the files as before the sync`);
    assert.match((await w.ok(["check"])).out, /^ok/);
    w.cleanup();
  }
});

test("B5-b: strom sync undo of an archive's send that took a partner out of a couple whose side was kept — the partner back with the side kept, the files as before", opts, async () => {
  const { w, strom, husb } = await keptCouple();
  await w.ok(["mode", "archive"], { tty: true });
  const before = await bothSides(w);
  await w.ok(["sync", sentWithout(await strom(), "P0002"), "--apply"]);
  assert.equal(await husb(), undefined);
  await w.ok(["sync", "undo", "I1"]);
  assert.deepEqual((await w.ok(["family", "show", "F0001", "--json"])).json.family.partners, ["P0001", "P0002"]);
  assert.equal(await husb(), "P0001");
  assert.deepEqual(await bothSides(w), before);
  assert.match((await w.ok(["check"])).out, /^ok/);
  w.cleanup();
});

// ── the standard GEDCOM by sex alone (B5-c) ──

test("B5-c: a couple of unknown sex, one of them then a man (his partner kept as HUSB) — the standard GEDCOM writes the man HUSB beside the one of unknown sex, as the Strom app's coupleSides does; the Strom file keeps the sides (the app keeps the partners in that order); the other way round (a woman) the same", opts, async () => {
  for (const [sex, strom, standard] of [["M", "P0001 + P0002: P0003", "P0002 + P0001: P0003"], ["F", "P0001 + P0002: P0003", "P0002 + P0001: P0003"]] as const) {
    const w = new World();
    await w.withTree("Velcí");
    await w.ok(["person", "add", "Cyril /Velký/", "--born", "1890"]);
    await w.ok(["person", "add", "Dana /Velká/", "--born", "1892"]);
    await w.ok(["person", "add", "Ivo /Velký/", "--born", "1920", "--sex", "M"]);
    await w.ok(["family", "add", "--partner", "P0001", "--partner", "P0002", "--child", "P0003"]);
    // Dana a man: Cyril kept as HUSB (U HUSB + M WIFE); Cyril a woman: Cyril kept as HUSB (F HUSB + U WIFE)
    await w.ok(["person", "edit", sex === "M" ? "P0002" : "P0001", "--sex", sex, "--reason", "the record says so"]);
    assert.equal((await w.ok(["family", "show", "F0001", "--json"])).json.family.husb, "P0001");
    const files: Record<string, string> = {};
    for (const as of ["strom", "standard"]) {
      files[as] = path.join(w.dir, `${as}.ged`);
      await w.ok(["export", "gedcom", "--for", as, ...(as === "strom" ? ["--images-for", "none"] : []), "--out", files[as]!]);
    }
    assert.deepEqual(famSides(files.strom!), [strom], `${sex}: the Strom file keeps the sides`);
    assert.deepEqual(famSides(files.standard!), [standard], `${sex}: the standard file by sex`);
    // in the standard file a man is never WIFE, a woman never HUSB beside one of another sex
    const text = fs.readFileSync(files.standard!, "utf8");
    const sexOf = (x: string) => new RegExp(`0 ${x} INDI\\r?\\n(?:[1-9].*\\r?\\n)*?1 SEX (\\w)`).exec(text)?.[1];
    const [h, wf] = ["HUSB", "WIFE"].map((tag) => sexOf(new RegExp(`\\n1 ${tag} (@[^@]+@)`).exec(text)![1]!));
    assert.notEqual(wf, "M", `${sex}: no man WIFE`);
    assert.notEqual(h, "F", `${sex}: no woman HUSB`);
    w.cleanup();
  }
});

// ── a sex the file does not write (B5-d) ──

test("B5-d: a file whose unknown is exact (the header's mark, the app's VERS from 3.10.0-beta.11, its JSON from data version 12) but with no SEX line, no gender, says nothing of the sex — no change; only SEX U, gender unknown is the sex set unknown", opts, async () => {
  const { w, send, sexChanges } = await research();
  for (const [p, sex] of [["P0001", "M"], ["P0002", "F"], ["P0003", "F"]]) await w.ok(["person", "edit", p!, "--sex", sex!]);
  for (const head of [{ vers: "3.10.0-beta.11" }, { mark: true }, { vers: "3.10.0-beta.12", mark: true }]) {
    const file = send(AS_GUESSED, head);
    fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace(/^1 SEX .*\r?\n/gm, ""));
    assert.deepEqual(await sexChanges(file), [], `no SEX: ${JSON.stringify(head)}`);
    assert.deepEqual(await sexChanges(send({ ...AS_GUESSED, P0002: "U" }, head)), [["P0002", "correct", "U"]], `SEX U: ${JSON.stringify(head)}`);
  }
  for (const version of [12, 13]) {
    const file = appJson(w, AS_GUESSED, version);
    const data = JSON.parse(fs.readFileSync(file, "utf8")) as { persons: Record<string, { gender?: string }> };
    for (const p of Object.values(data.persons)) delete p.gender;
    fs.writeFileSync(file, JSON.stringify(data));
    assert.deepEqual(await sexChanges(file), [], `no gender: data version ${version}`);
    assert.deepEqual(await sexChanges(appJson(w, { ...AS_GUESSED, P0002: "U" }, version)), [["P0002", "correct", "U"]], `gender unknown: data version ${version}`);
  }
  w.cleanup();
});
