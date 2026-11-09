// strom error --with-data (spec 070 K1.7): the data of the persons, families and books named go into the report only
// on the person's yes — at a terminal asked, an agent or a script only with --yes-data; without it nothing of people.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";
import { PLANTED, nowhere, plantedWorld, zipTexts } from "./error.helpers.ts";

const opts = { skip: !hasGit };
const agent = { CLAUDECODE: "1", CLAUDE_CODE_SESSION_ID: "s-data" };

/** A research of two made-up people, a source cited by the first, a family of both and a book. */
async function dataWorld(): Promise<{ w: World; downloads: string }> {
  const w = new World();
  const downloads = path.join(w.env.HOME!, "Downloads");
  fs.mkdirSync(downloads);
  await w.withTree("Lhotákovi");
  await w.ok(["recordset", "add", "Lhota N 1840–1860", "--kinds", "baptism"]);
  await w.ok(["source", "add", "Matrika Lhota 1850", "--kind", "baptism"]);
  await w.ok(["person", "add", "Vojtěch /Lhoták/", "--sex", "M", "--born", "1850", "--born-place", "Lhota", "--cite", "S0001"]);
  await w.ok(["person", "add", "Anežka /Lhotáková/".normalize("NFD"), "--sex", "F"]);
  await w.ok(["person", "add", "Анна /Лотакова/", "--sex", "F"]);
  await w.ok(["family", "add", "--partner", "P0001", "--partner", "P0002"]);
  await w.ok(["note", "add", "P1", "Babička vyprávěla o mlýně."]);
  return { w, downloads };
}

test("without --with-data the report holds no data of people: no data.json, no name (K1.7)", opts, async () => {
  const { w } = await plantedWorld();
  const r = await w.ok(["error", "--yes", "--json"]);
  const texts = zipTexts(r.json.file);
  assert.deepEqual(Object.keys(texts).sort(), ["README.txt", "report.json"]);
  assert.deepEqual(nowhere(texts, PLANTED), []);
  assert.equal(JSON.parse(texts["report.json"]!).withData, undefined);
  w.cleanup();
});

test("--person, --family, --book only with --with-data; --with-data names what it adds; an ID not there refused (K1.7)", opts, async () => {
  const { w, downloads } = await dataWorld();
  const alone = await w.run(["error", "--yes", "--person", "P1"]);
  assert.equal(alone.code, 2, alone.err);
  assert.match(alone.err, /--with-data/);
  const none = await w.run(["error", "--yes", "--with-data"]);
  assert.equal(none.code, 2, none.err);
  assert.match(none.err, /--person P/);
  const missing = await w.run(["error", "--yes", "--with-data", "--yes-data", "--person", "P0099"]);
  assert.equal(missing.code, 2, missing.err);
  assert.match(missing.err, /strom person list/);
  assert.deepEqual(fs.readdirSync(downloads), [], "nothing made");
  w.cleanup();
});

test("an agent without --yes-data is refused with the command for the user; nothing made (K1.7)", opts, async () => {
  const { w, downloads } = await dataWorld();
  const r = await w.run(["error", "--with-data", "--person", "P1", "--about", "fetch", "--where", "chat", "--json"], { env: agent });
  assert.equal(r.code, 4, r.out + r.err);
  assert.match(r.out + r.err, /--yes-data/);
  assert.match(r.out + r.err, /strom error --with-data --person P0001 --about fetch/);
  assert.deepEqual(fs.readdirSync(downloads), []);
  // a script without a terminal: the same
  const script = await w.run(["error", "--with-data", "--person", "P1"]);
  assert.equal(script.code, 4, script.out + script.err);
  assert.deepEqual(fs.readdirSync(downloads), []);
  w.cleanup();
});

test("with --yes-data only what was named goes in, as it is: data.json, the README lists it, report.json keeps IDs only (K1.7)", opts, async () => {
  const { w } = await dataWorld();
  const r = await w.ok(["error", "--with-data", "--person", "p1", "--family", "F1", "--book", "B1", "--yes-data", "--where", "chat", "--json"], { env: agent });
  assert.deepEqual(r.json.withData.map((d: { id: string }) => d.id), ["P0001", "F0001", "B0001"]);
  const texts = zipTexts(r.json.file);
  const data = JSON.parse(texts["data.json"]!);
  assert.equal(data.people.length, 1);
  assert.equal(data.people[0].names[0].given, "Vojtěch");
  assert.equal(data.people[0].names[0].surname, "Lhoták");
  const birth = data.people[0].facts.find((f: { kind: string }) => f.kind === "BIRT");
  assert.equal(birth.place, "Lhota");
  assert.equal(birth.citations[0].source, "S0001");
  assert.ok(birth.status, "how sure the fact is");
  assert.deepEqual(data.families[0].partners, ["P0001", "P0002"]);
  assert.equal(data.books[0].title, "Lhota N 1840–1860");
  assert.equal(data.sources[0].title, "Matrika Lhota 1850");
  // never a note, nor a person not named (a partner only by ID)
  assert.deepEqual(nowhere({ "data.json": texts["data.json"]! }, ["Babička", "mlýně", "Anežka", "Анна", "Лотакова"]), []);
  // the README says what was added; report.json the IDs, never a name
  assert.match(texts["README.txt"]!, /data\.json/);
  assert.match(texts["README.txt"]!.normalize("NFC"), /P0001 Vojtěch Lhoták/);
  assert.match(texts["README.txt"]!, /B0001 Lhota N 1840–1860/);
  const report = JSON.parse(texts["report.json"]!);
  assert.deepEqual(report.withData, ["P0001", "F0001", "B0001"]);
  assert.deepEqual(nowhere({ "report.json": texts["report.json"]! }, ["Vojtěch", "Lhoták", "Babička"]), []);
  w.cleanup();
});

test("a person at a terminal is asked: no, the report without data; yes, data.json (K1.7)", opts, async () => {
  const { w, downloads } = await dataWorld();
  // where: the terminal (2), the data: no, create: yes
  const no = await w.run(["error", "--with-data", "--person", "P1"], { tty: true, answers: ["2", "ne", "ano"] });
  assert.equal(no.code, 0, no.err);
  assert.match(no.out, /Zpráva by obsahovala i údaje těchto záznamů/);
  assert.match(no.out.normalize("NFC"), /· P0001 Vojtěch Lhoták/);
  assert.match(no.out, /Přidat je do zprávy\?/);
  const [first] = fs.readdirSync(downloads);
  assert.deepEqual(Object.keys(zipTexts(path.join(downloads, first!))).sort(), ["README.txt", "report.json"]);
  const yes = await w.run(["error", "--with-data", "--person", "P1"], { tty: true, answers: ["2", "ano", "ano"] });
  assert.equal(yes.code, 0, yes.err);
  assert.match(yes.out, /údaje záznamů P0001 se souhlasem \(data\.json\)/);
  const second = fs.readdirSync(downloads).find((f) => f !== first)!;
  const texts = zipTexts(path.join(downloads, second));
  assert.equal(JSON.parse(texts["data.json"]!).people[0].id, "P0001");
  w.cleanup();
});
