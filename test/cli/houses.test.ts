// The houses of a family tree (spec 030 part 1): strom house list (the research's records A… and the houses the facts
// name, one row each by the app's key, with their state), house show --json (§4.2: item IDs, manual, no recent),
// house add (a house, each item, --from I… = origin import, --locator), house confirm (the person's alone: no terminal
// exit 4; the core function the bridge calls), house import over a research of the person's own (test/fixtures/houses:
// assigned by its heading, a file of two houses, a file of none, an unclear one refused with the exact command,
// --house/--skip, taken again adds nothing, links gone through vs by hand, its text kept as it came, one takeover task a
// house, images, map data and a web page beside it not taken), the migration to schema 4, decomposed input and a
// non-Latin script. Synthetic data only (made-up names).

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { World, hasGit } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import { confirmHouse, findHouse, forHouse, houseRows, houseWork } from "../../src/core/houses.ts";
import type { House, Input, Task } from "../../src/core/model.ts";
import { SCHEMA_VERSION } from "../../src/core/model.ts";
import { houseRowKey } from "../../src/core/streets.ts";
import { validateRecord } from "../../src/core/validate.ts";

const opts = { skip: !hasGit, timeout: 240_000 };
const AGENT = { env: { CLAUDECODE: "1" } };
const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "fixtures", "houses", "research");

const open = (w: World) => Tree.open(w.cwd, w.env);
/** Every house, material and task as the schema has them. */
function valid(w: World): void {
  const tree = open(w);
  for (const r of [...tree.list("house"), ...tree.list("input"), ...tree.list("task")]) assert.deepEqual(validateRecord(r), [], (r as { id: string }).id);
}
const houses = (w: World) => open(w).list<House>("house").filter((h) => !h.retracted);
const takeovers = (w: World) => open(w).list<Task>("task").filter((t) => forHouse(t) && houseWork(t) === "takeover");

/**
 * The Lhotáks and the Prouzals: Lhota (L0001) with houses no. 9 and 12, Bělokamen (L0002) with no. 16 written "16" and
 * "čp. 16" (one house), a fact at Lhota with no house.
 */
async function village(w: World) {
  await w.withTree("Lhotákovi");
  await w.ok(["place", "add", "Lhota", "--kind", "village"]); // L0001
  await w.ok(["place", "add", "Bělokamen", "--kind", "village"]); // L0002
  const person = async (name: string) => (await w.ok(["person", "add", name, "--json"])).json.person.id as string;
  const kapradin = await person("Kapradin /Lhoták/");
  const mlhoslav = await person("Mlhoslav /Lhoták/");
  const hromoslav = await person("Hromoslav /Prouzal/");
  const ozubec = await person("Ozubec /Prouzal/");
  const fact = async (who: string, kind: string, date: string, place: string, house?: string) =>
    (await w.ok(["event", "add", who, kind, "--date", date, "--place", place, ...(house ? ["--house", house] : []), "--json"])).json.event.id as string;
  await fact(kapradin, "RESI", "1850", "Lhota", "9");
  await fact(mlhoslav, "BIRT", "1872", "Lhota", "12");
  await fact(hromoslav, "BIRT", "1781", "Bělokamen", "16");
  await fact(ozubec, "BIRT", "1820", "Bělokamen", "čp. 16");
  await fact(ozubec, "DEAT", "1858", "Bělokamen", "16");
  await fact(kapradin, "DEAT", "1890", "Lhota");
  return { kapradin, mlhoslav, hromoslav, ozubec };
}

/** The research of the fixtures copied into the world (a folder with diacritics, its subfolders and its web page). */
function research(w: World, name = "Rešerše domů"): string {
  const to = path.join(w.dir, name);
  fs.cpSync(FIXTURES, to, { recursive: true });
  return to;
}

test("house list: the houses of the facts by the app's key, one row for '16' and 'čp. 16', the records beside them, --town", opts, async () => {
  const w = new World();
  const p = await village(w);
  const list = await w.ok(["house", "list", "--json"]);
  const rows = list.json.houses as any[];
  assert.deepEqual(
    rows.map((r) => [r.key, r.place.name, r.place.id, r.persons, r.state]),
    [
      ["belokamen|16", "Bělokamen", "L0002", 2, "none"],
      ["lhota|9", "Lhota", "L0001", 1, "none"],
      ["lhota|12", "Lhota", "L0001", 1, "none"],
    ],
  );
  assert.deepEqual(rows[0].years, { from: 1781, to: 1858 });
  assert.equal(rows[0].id, undefined, "a house of the facts has no record until something is written of it");
  assert.equal(houses(w).length, 0);
  // the person's house: listed although nobody of the tree lived there
  const add = await w.ok(["house", "add", "L0001", "30", "--name", "U Lhotáků", "--json"], { tty: true });
  assert.equal(add.json.house.id, "A0001");
  assert.equal(add.json.house.name, "U Lhotáků");
  assert.equal(add.json.house.nameBy, "user");
  const again = await w.run(["house", "add", "Lhota", "30"]);
  assert.notEqual(again.code, 0);
  assert.match(again.out + again.err, /A0001 already/u);
  const lhota = (await w.ok(["house", "list", "--town", "L0001", "--json"])).json.houses as any[];
  assert.deepEqual(lhota.map((r) => [r.id ?? null, r.house, r.persons]), [[null, "9", 1], [null, "12", 1], ["A0001", "30", 0]]);
  // in the research language, never addressing the person
  const text = (await w.ok(["house", "list"])).out;
  assert.match(text, /Bělokamen/u);
  assert.match(text, /1781–1858/u);
  // an unknown municipality: said what to run
  const none = await w.run(["house", "add", "Mlhov", "3", "--json"]);
  assert.notEqual(none.code, 0);
  assert.match(none.out + none.err, /place add/u);
  // two places of one name: never guessed
  await w.ok(["place", "add", "Lhota", "--kind", "hamlet"]); // L0003
  const two = await w.run(["house", "add", "Lhota", "31", "--json"]);
  assert.notEqual(two.code, 0);
  assert.match(two.out + two.err, /L0001/u);
  assert.match(two.out + two.err, /L0003/u);
  void p;
});

test("house add <item>: each item its ID and origin, the first item makes the record of a house of the facts, --from I… import, --locator", opts, async () => {
  const w = new World();
  const p = await village(w);
  const s = (await w.ok(["source", "add", "Matrika Lhota 1840–1870", "--kind", "baptism", "--json"])).json.source.id as string;
  const item = async (args: string[], env = AGENT.env) => (await w.ok(["house", "add", ...args, "--json"], { env })).json;
  // a house of the facts by its municipality and number: its record made by the first item
  const e1 = await item(["event", "Lhota", "9", "--kind", "transfer", "--date", "1850", "--text", "Kapradin přebírá grunt", "--source", s, "--locator", "fol. 12", "--certainty", "high"]);
  assert.equal(e1.house, "A0001");
  assert.equal(e1.item, "e1");
  const h = houses(w)[0]!;
  assert.equal(h.place, "L0001");
  assert.equal(h.house, "9");
  assert.deepEqual(h.timeline[0]!.sources, [{ source: s, page: "fol. 12" }]);
  assert.equal(h.timeline[0]!.origin, "research");
  // by its key and by its record the same house
  assert.equal((await item(["event", "lhota|9", "--kind", "fire", "--date", "1868-05", "--text", "Požár", "--url", "https://kronika.example.org/lhota", "--sensitive"])).item, "e2");
  assert.equal((await item(["holder", "A1", "--name", "Kapradin Lhoták", "--person", p.kapradin, "--since", "1850", "--until", "1890", "--how", "inheritance", "--certainty", "high"])).item, "h1");
  assert.equal((await item(["resident", "A0001", "--name", "Mlhoslav Lhoták", "--role", "lodger", "--since", "1880"])).item, "r1");
  assert.equal((await item(["number", "A0001", "--number", "4", "--until", "1843", "--proposed", "--text", "Táž rodina pod čp. 4"])).item, "n1");
  await item(["location", "A0001", "--lat", "49.61", "--lon", "15.12", "--how", "today-number", "--certainty", "high"]);
  assert.equal((await item(["passed", "A0001", "--what", "Matrika Lhota 1840–1870", "--source", s, "--found", "yes"])).item, "p1");
  assert.equal((await item(["manual", "A0001", "--what", "Katastrální mapa", "--url", "https://archivnimapy.example.org/lhota/1", "--why", "jen ručně"])).item, "o1");
  assert.equal((await item(["unknown", "A0001", "--text", "Kdo držel dům 1843–1850?"])).item, "u1");
  assert.equal((await item(["archive-only", "A0001", "--archive", "Okresní archiv Mlhov", "--fond", "Okresní soud", "--signature", "kn. 12", "--what", "Pozemková kniha"])).item, "a1");
  assert.equal((await item(["map", "A0001", "--kind", "cadastre", "--url", "https://archivnimapy.example.org/lhota/1", "--manual", "--sheet", "list 3"])).item, "m1");
  await item(["look", "A0001", "--text", "Přízemní stavení", "--certainty", "guess", "--image", "https://foto.example.org/lhota-9", "--license", "CC BY 4.0"]);
  await item(["name", "A0001", "--name", "U Lhotáků"]);
  // the material a research of the person's own: what is read from it is the import's
  const file = path.join(w.dir, "poznámky.txt");
  fs.writeFileSync(file, "Lhota čp. 9: drželi Lhotákové.\n");
  const input = (await w.ok(["intake", file, "--json"])).json;
  const iid = (input.inputs?.[0]?.id ?? input.input?.id ?? input.id) as string;
  assert.match(iid, /^I\d{4}$/u, JSON.stringify(input));
  const imported = await item(["holder", "A0001", "--name", "Hromoslav Lhoták", "--since", "1820", "--until", "1850", "--how", "purchase", "--from", iid]);
  assert.equal(imported.item, "h2");
  await item(["material", "A0001", "--input", iid]);
  const x = houses(w)[0]!;
  assert.equal(x.holders[1]!.origin, "import");
  assert.equal(x.holders[0]!.person, p.kapradin);
  assert.deepEqual(x.sensitive, ["e2"]);
  assert.equal(x.nameBy, "research");
  assert.ok(open(w).get<Input>(iid)!.houses!.includes("A0001"));
  // the person at a terminal: their own
  await w.ok(["house", "add", "unknown", "A0001", "--text", "Kde stála stodola?"], { tty: true });
  assert.equal(houses(w)[0]!.unknown[1]!.origin, "user");
  // wrong codes and missing values are refused with what is allowed
  const bad = await w.run(["house", "add", "event", "A0001", "--kind", "earthquake", "--text", "x"], AGENT);
  assert.notEqual(bad.code, 0);
  assert.match(bad.out + bad.err, /fire/u);
  assert.notEqual((await w.run(["house", "add", "location", "A0001", "--lat", "91", "--lon", "15"], AGENT)).code, 0);
  assert.notEqual((await w.run(["house", "add", "passed", "A0001", "--what", "x", "--url", "ftp://example.org"], AGENT)).code, 0);
  // the name the person gave stays
  await w.ok(["house", "add", "name", "A0001", "--name", "Na Lhotě"], { tty: true });
  assert.notEqual((await w.run(["house", "add", "name", "A0001", "--name", "U Prouzalů"], AGENT)).code, 0);
  // every write an operation of the history, the data valid
  valid(w);
});

test("house show --json: §4.2 — item IDs, manual, materials, unknown with its question, no recent; the text in the research language", opts, async () => {
  const w = new World();
  await village(w);
  await w.ok(["house", "add", "number", "Bělokamen", "16", "--number", "9", "--until", "1843", "--proposed", "--text", "Prouzalové pod čp. 9"], AGENT);
  await w.ok(["house", "add", "manual", "A0001", "--what", "Císařské otisky", "--url", "https://archivnimapy.example.org/belokamen/3"], AGENT);
  await w.ok(["house", "add", "unknown", "A0001", "--text", "Kdy dům vyhořel?"], AGENT);
  for (const ref of ["A0001", "belokamen|16", "L0002 16", "Bělokamen čp. 16", "Bělokamen 16".normalize("NFD")]) {
    const v = (await w.ok(["house", "show", ...ref.split(" "), "--json"])).json.house;
    assert.equal(v.id, "A0001", ref);
  }
  const v = (await w.ok(["house", "show", "A0001", "--json"])).json.house;
  assert.equal(v.key, "belokamen|16");
  assert.deepEqual(v.place, { key: "belokamen", id: "L0002", name: "Bělokamen" });
  assert.equal(v.house, "16");
  assert.equal(v.state, "none");
  assert.equal(v.persons.length, 2);
  assert.deepEqual(v.years, { from: 1781, to: 1858 });
  assert.equal(v.numbers[0].id, "n1");
  assert.equal(v.numbers[0].proposed, true);
  assert.equal(v.numbers[0].certainty, "probable");
  assert.equal(v.manual[0].id, "o1");
  assert.equal(v.unknown[0].id, "u1");
  assert.equal(v.unknown[0].question, null);
  for (const k of ["timeline", "holders", "residents", "passed", "archiveOnly", "materials"]) assert.ok(Array.isArray(v[k]), k);
  assert.equal(v.recent, undefined, "no recent (§4.2)");
  // a house of the facts with no record: shown all the same, empty
  const bare = (await w.ok(["house", "show", "Lhota", "12", "--json"])).json.house;
  assert.equal(bare.id, undefined);
  assert.equal(bare.key, "lhota|12");
  assert.deepEqual(bare.numbers, []);
  const text = (await w.ok(["house", "show", "A0001", "--lang", "cs"])).out;
  assert.match(text, /Bělokamen 16/u);
  assert.match(text, /n1 9/u);
  // no such house: what to run
  const none = await w.run(["house", "show", "A0099"]);
  assert.notEqual(none.code, 0);
  assert.match(none.out + none.err, /house list/u);
});

test("house confirm: the person's alone — an agent or no terminal exit 4, nothing written; the person at a terminal; the core the bridge calls", opts, async () => {
  const w = new World();
  await village(w);
  await w.ok(["house", "add", "number", "Bělokamen", "16", "--number", "9", "--until", "1843", "--proposed"], AGENT);
  await w.ok(["house", "add", "number", "A0001", "--number", "21", "--proposed"], AGENT);
  const before = JSON.stringify(houses(w));
  assert.equal((await w.run(["house", "confirm", "A0001", "renumber", "n1"], AGENT)).code, 4);
  assert.equal((await w.run(["house", "confirm", "A0001", "renumber", "n1"])).code, 4);
  assert.equal(JSON.stringify(houses(w)), before, "nothing written");
  await w.ok(["house", "confirm", "A0001", "renumber", "n1"], { tty: true });
  assert.match(houses(w)[0]!.numbers[0]!.confirmed ?? "", /^\d{4}-\d{2}-\d{2}$/u);
  // the bridge: the person's decision in the app, through the core
  const tree = open(w);
  confirmHouse(tree, "A0001", "notSame", { id: "n2" });
  const h = houses(w)[0]!;
  assert.ok(h.numbers[1]!.notSame);
  assert.deepEqual((await w.ok(["house", "show", "A0001", "--json"])).json.house.numbers.map((n: any) => n.id), ["n1"], "another house is never shown again");
  assert.throws(() => confirmHouse(open(w), "A0001", "renumber", { id: "n2" }), /another house/u);
  assert.throws(() => confirmHouse(open(w), "A0001", "location"), /no point/u);
  confirmHouse(open(w), "A0001", "location", { lat: 49.5, lon: 15.1 });
  assert.equal(houses(w)[0]!.location!.origin, "user");
  // the research never moves a point the person confirmed
  assert.notEqual((await w.run(["house", "add", "location", "A0001", "--lat", "49.6", "--lon", "15.2"], AGENT)).code, 0);
});

test("house import: assigned by the heading, two houses in one file, a file of none, links gone through or by hand, the text kept, one takeover a house, again nothing doubled", opts, async () => {
  const w = new World();
  await village(w);
  const dir = research(w);
  const r = await w.ok(["house", "import", dir, "--json"], AGENT);
  const taken = r.json.taken as { file: string; input: string; houses: { id: string; passed: number; manual: number; task?: string }[] }[];
  assert.equal(taken.length, 2, JSON.stringify(r.json));
  const tree = open(w);
  const byKey = new Map(houseRows(tree).map((x) => [x.key, x]));
  const belokamen = byKey.get("belokamen|16")!;
  const lhota9 = byKey.get("lhota|9")!;
  const lhota12 = byKey.get("lhota|12")!;
  assert.ok(belokamen.id && lhota9.id && lhota12.id, "a record made of each house of the facts");
  const one = taken.find((t) => t.file.endsWith("Bělokamen čp. 16.md"))!;
  const two = taken.find((t) => t.file.endsWith("Lhota čp. 9 a 12.md"))!;
  assert.deepEqual(one.houses.map((h) => h.id), [belokamen.id]);
  assert.deepEqual(two.houses.map((h) => h.id).sort(), [lhota9.id, lhota12.id].sort(), "a file of two numbers: both houses");
  // a file of no house, a web page, the images and the map data of subfolders: not taken, said
  const skipped = r.json.skipped as { name: string; why: string }[];
  assert.deepEqual(skipped.map((s) => [s.name, s.why]).sort(), [["Zápisky.md", "no-house"], ["mapa.html", "page"]]);
  assert.ok((r.json.left as string[]).includes("podklady/lhota-16/stavení.png"), JSON.stringify(r.json.left));
  assert.ok((r.json.left as string[]).includes("mapa.html"));
  assert.equal(tree.list<Input>("input").length, 2, "only the researches are material");
  // the material: the text as it came, of its houses, the person's own research titled by its heading
  const input = tree.get<Input>(one.input)!;
  assert.equal(input.kind, "text");
  assert.equal(input.ownResearch, true);
  assert.deepEqual(input.houses, [belokamen.id]);
  assert.equal(input.title, "Bělokamen čp. 16 (U Prouzalů) – rešerše");
  assert.ok(fs.readFileSync(path.join(tree.root, input.file!)).equals(fs.readFileSync(path.join(FIXTURES, "Bělokamen čp. 16.md"))), "the text unchanged");
  // its links: gone through, those of a section by hand or only in a reading room as manual; each address once
  const h = tree.get<House>(belokamen.id!)!;
  assert.deepEqual(h.passed.map((x) => x.url).sort(), [
    "https://foto.example.org/belokamen-16",
    "https://kronika.example.org/belokamen",
    "https://kronika.example.org/belokamen#1868",
    "https://mapy.example.org/skica/belokamen",
    "https://matriky.example.org/mlhov/1770",
  ]);
  assert.deepEqual(h.manual.map((x) => x.url).sort(), [
    "https://archivnimapy.example.org/belokamen/3",
    "https://katalog.example.org/fond/okresni-soud/12",
    "https://oldmaps.example.org/2vm/belokamen",
  ]);
  assert.ok(h.passed.every((x) => x.origin === "import" && x.at === "2026-03-14"));
  assert.equal(h.passed.find((x) => x.url.startsWith("https://matriky"))!.what, "Matrika Mlhov 1770–1800");
  assert.match(h.passed.find((x) => x.url.endsWith("#1868"))!.what, /1868/u, "a bare address in a table: its row says what it was for");
  // one takeover task a house, of the intake level, in the research language; the files left listed in it
  const tasks = takeovers(w);
  assert.equal(tasks.length, 3);
  for (const t of tasks) {
    assert.equal(t.level, "intake");
    assert.equal(t.state, "open");
    assert.match(t.origin, /^house:import:A\d{4}$/u);
  }
  const tb = tasks.find((t) => t.origin === `house:import:${belokamen.id}`)!;
  assert.deepEqual(tb.where, [one.input]);
  assert.match(tb.why ?? "", /podklady\/lhota-16\/stavení\.png/u);
  assert.equal((await w.ok(["house", "list", "--json"])).json.houses.find((x: any) => x.id === belokamen.id).state, "queued");
  assert.equal((await w.ok(["house", "show", belokamen.id!, "--json"])).json.house.materials[0].kind, "own-research");
  // taken again: nothing new
  const ops = tree.list<Input>("input").length;
  const again = await w.ok(["house", "import", dir, "--json"], AGENT);
  assert.deepEqual(again.json.taken, []);
  assert.deepEqual((again.json.skipped as any[]).filter((s) => s.why === "known").map((s) => s.name).sort(), ["Bělokamen čp. 16.md", "Lhota čp. 9 a 12.md"]);
  assert.equal(open(w).list<Input>("input").length, ops);
  assert.equal(takeovers(w).length, 3);
  assert.equal(open(w).get<House>(belokamen.id!)!.passed.length, 5);
  // the same text named another way and given its house: its links not doubled, the task not doubled
  const copy = path.join(w.dir, "kopie.md");
  fs.copyFileSync(path.join(FIXTURES, "Bělokamen čp. 16.md"), copy);
  await w.ok(["house", "import", copy, "--house", `kopie.md=${belokamen.id}`, "--json"], AGENT);
  assert.equal(open(w).list<Input>("input").length, ops);
  assert.equal(open(w).get<House>(belokamen.id!)!.passed.length, 5);
  assert.equal(takeovers(w).length, 3);
  valid(w);
});

test("house import: never guessed — a municipality of two places, a number the tree has not: refused with the exact command, nothing written; --house, --skip; a terminal asks", opts, async () => {
  const w = new World();
  await village(w);
  await w.ok(["place", "add", "Bělokamen", "--kind", "hamlet"]); // L0003: two of the name
  const dir = path.join(w.dir, "nová rešerše");
  fs.mkdirSync(dir);
  fs.copyFileSync(path.join(FIXTURES, "Bělokamen čp. 16.md"), path.join(dir, "Bělokamen čp. 16.md"));
  fs.writeFileSync(path.join(dir, "Lhota čp. 40.md"), "# Lhota čp. 40 – rešerše\n\nDatum: 2026-04-01\n\n[Kronika Lhoty](https://kronika.example.org/lhota/40)\n");
  const r = await w.run(["house", "import", dir, "--json"], AGENT);
  assert.equal(r.code, 3, r.out + r.err);
  const j = JSON.parse(r.out);
  assert.equal(j.status, "needs-input");
  const q = j.questions as { name: string; why: string; set: string; candidates: { house: string }[] }[];
  assert.deepEqual(q.map((x) => [x.name, x.why]).sort(), [["Bělokamen čp. 16.md", "town-ambiguous"], ["Lhota čp. 40.md", "house-unknown"]]);
  const b = q.find((x) => x.why === "town-ambiguous")!;
  // the facts' "Bělokamen" is no one place record now either: each place a house to make, never one picked
  assert.deepEqual(b.candidates.map((c) => c.house), ["L0002 16", "L0003 16"], JSON.stringify(b));
  assert.match(b.set, /strom house import .* --house /u);
  assert.match(q.find((x) => x.why === "house-unknown")!.set, /--house "Lhota čp\. 40\.md=L0001 40"/u);
  assert.equal(open(w).list<Input>("input").length, 0, "nothing taken");
  assert.equal(houses(w).length, 0);
  // the agent with no terminal: the same, its hint the commands
  const plain = await w.run(["house", "import", dir], AGENT);
  assert.equal(plain.code, 3);
  assert.match(plain.out + plain.err, /--house/u);
  // the person said: one to a house of the facts, one skipped
  const ok = await w.ok(["house", "import", dir, "--house", "Bělokamen čp. 16.md=L0002 16", "--skip", "Lhota čp. 40.md", "--json"], AGENT);
  assert.equal(ok.json.taken.length, 1);
  assert.deepEqual(ok.json.skipped.map((s: any) => [s.name, s.why]), [["Lhota čp. 40.md", "skip"]]);
  // a house to make, said as the municipality and number
  const made = await w.ok(["house", "import", path.join(dir, "Lhota čp. 40.md"), "--house", "Lhota čp. 40.md=L0001 40", "--json"], AGENT);
  const id = made.json.taken[0].houses[0].id as string;
  const h = open(w).get<House>(id)!;
  assert.equal(h.place, "L0001");
  assert.equal(h.house, "40");
  assert.deepEqual(h.passed.map((x) => x.url), ["https://kronika.example.org/lhota/40"]);
  // a terminal asks: the person's choice (the first candidate) is taken
  const w2 = new World();
  await village(w2);
  await w2.ok(["place", "add", "Bělokamen", "--kind", "hamlet"]);
  const one = path.join(w2.dir, "Bělokamen čp. 16.md");
  fs.copyFileSync(path.join(FIXTURES, "Bělokamen čp. 16.md"), one);
  await w2.ok(["house", "import", one], { tty: true, answers: ["1"] });
  assert.deepEqual(open(w2).list<House>("house").map((x) => [x.place, x.house]), [["L0002", "16"]]);
  assert.equal(open(w2).list<Input>("input").length, 1);
});

test("house import and the houses: decomposed names and text, a municipality in a non-Latin script", opts, async () => {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["place", "add", "Лхота", "--kind", "village"]); // L0001
  await w.ok(["place", "add", "Bělokamen", "--kind", "village"]); // L0002
  const who = (await w.ok(["person", "add", "Kapradin /Lhoták/", "--json"])).json.person.id as string;
  await w.ok(["event", "add", who, "RESI", "--date", "1900", "--place", "Лхота", "--house", "№ 5"]);
  await w.ok(["event", "add", who, "BIRT", "--date", "1870", "--place", "Bělokamen".normalize("NFD"), "--house", "čp. 16".normalize("NFD")]);
  const rows = (await w.ok(["house", "list", "--json"])).json.houses as any[];
  assert.deepEqual(rows.map((r) => r.key).sort(), ["belokamen|16", "лхота|5"]);
  const dir = path.join(w.dir, "rešerše");
  fs.mkdirSync(dir);
  fs.writeFileSync(path.join(dir, "Лхота 5.md"), "# Лхота № 5 – исследование\n\n[Летопись](https://letopis.example.org/5)\n");
  fs.writeFileSync(path.join(dir, "Bělokamen čp. 16.md".normalize("NFD")), "# Bělokamen čp. 16 – rešerše\n\n[Matrika](https://matriky.example.org/b)\n".normalize("NFD"));
  const r = await w.ok(["house", "import", dir, "--json"], AGENT);
  assert.equal(r.json.taken.length, 2, JSON.stringify(r.json));
  const tree = open(w);
  const cyr = findHouse(tree, "Лхота 5");
  assert.ok(cyr.id);
  assert.deepEqual(tree.get<House>(cyr.id!)!.passed.map((p) => p.url), ["https://letopis.example.org/5"]);
  const b = findHouse(tree, "Bělokamen 16");
  // what is stored is NFC
  const input = tree.list<Input>("input").find((i) => i.houses?.includes(b.id!))!;
  assert.equal(input.title, "Bělokamen čp. 16 – rešerše");
  assert.equal(input.title, input.title!.normalize("NFC"));
  assert.equal(tree.get<House>(b.id!)!.house, tree.get<House>(b.id!)!.house.normalize("NFC"));
  // a house made by the person, typed decomposed
  const add = await w.ok(["house", "add", "Bělokamen".normalize("NFD"), "Kopřivná 12".normalize("NFD"), "--json"], { tty: true });
  assert.equal(add.json.house.house, "Kopřivná 12");
  assert.equal(add.json.house.key, houseRowKey("Bělokamen", "Kopřivná 12"));
});

test("the migration to schema 4: an older tree brought up by itself, its houses written after", opts, async () => {
  const w = new World();
  await village(w);
  assert.equal(SCHEMA_VERSION, 4);
  const file = path.join(w.cwd, "strom.json");
  const config = JSON.parse(fs.readFileSync(file, "utf8"));
  assert.equal(config.schema, 4);
  fs.writeFileSync(file, JSON.stringify({ ...config, schema: 3 }, null, 2) + "\n");
  const tree = open(w);
  tree.withTreeLock(() => tree.commit("As strom 1.38 left it"));
  const r = await w.ok(["house", "add", "L0001", "30"], { tty: true });
  assert.match(r.out + r.err, /domy rodokmenu se ukládají jako vlastní záznamy/u);
  assert.equal(JSON.parse(fs.readFileSync(file, "utf8")).schema, 4);
  assert.equal(houses(w).length, 1);
});
