// The forms of a surname (strom surname …, core/surnames.ts): what the research suggests from its records and never
// suggests (a woman's husband's and father's families, a name of another kind), what the person decides in the
// terminal (written, logged, committed, sealed, taken back) and never an agent, the groups used by the search and the
// duplicates, the bridge's GET /surnames, and the Strom app's header notes taken back by strom sync.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { World, hasGit, readJsonFile } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import { likelyDuplicates } from "../../src/core/people.ts";
import { sameFamily, suggestSurnames } from "../../src/core/surnames.ts";
import { history } from "../../src/core/live.ts";
import { get } from "./sync.helpers.ts";

const opts = { skip: !hasGit };
const bridged = { skip: !hasGit || process.platform === "win32" };
const file = (w: World) => path.join(w.cwd, "quality", "surnames.json");

async function suggestions(w: World): Promise<any> {
  return (await w.ok(["surname", "suggest", "--json"])).json;
}

/** One man written so in two records (Lhota, Lhotaa), and once by a "vulgo" of another word (an alias: no form). */
async function documented(w: World): Promise<void> {
  await w.ok(["source", "add", "Křest Jana Lhoty 1850", "--kind", "baptism", "--transcript", "Jan, syn Václava Lhoty."]); // S1
  await w.ok(["source", "add", "Oddání Jana Lhotaa 1875", "--kind", "marriage", "--transcript", "Jan Lhotaa, syn Václava."]); // S2
  await w.ok(["person", "add", "Jan /Lhota/", "--sex", "M"]); // P1
  await w.ok(["name", "add", "P1", "Jan /Lhota/", "--cite", "S1", "--quote", "Jan, syn Václava Lhoty"]);
  // a quote of more than 200 characters, with an emoji, combining marks and CJK
  const long = `Jan Lhotaa 👨‍👩‍👧 é 東京 ${"ženich svobodný ".repeat(20)}`;
  await w.ok(["name", "add", "P1", "Jan /Lhotaa/", "--cite", "S2", "--quote", long]);
  await w.ok(["name", "add", "P1", "Jan /Kos/", "--kind", "alias"]);
}

test("documented: one person written so in two records, with its citations and quotes; a name of another kind no form", opts, async () => {
  const w = new World();
  await w.withTree("Lhotákovi");
  await documented(w);
  const a = await suggestions(w);
  assert.deepEqual(Object.keys(a).sort(), ["groups", "rejected", "rev", "state", "suggestions"]);
  assert.equal(a.suggestions.length, 1, JSON.stringify(a.suggestions));
  const s = a.suggestions[0];
  assert.equal(s.id, "lhota|lhotaa");
  assert.deepEqual([s.level, s.rule, s.persons], ["documented", "same-person", 1]);
  assert.deepEqual(s.keys, ["double"]);
  assert.ok(s.evidence.length >= 2 && s.evidence.length <= 3);
  for (const e of s.evidence) {
    assert.equal(e.person, "P0001");
    assert.ok(Array.from(e.quote).length <= 200, "a quote of 200 code points at most");
  }
  assert.ok(s.evidence.some((e: any) => e.citation.startsWith("Oddání Jana Lhotaa 1875")));
  assert.ok(typeof s.text === "string" && s.text.includes("Lhota | Lhotaa"));
  assert.ok(!JSON.stringify(a).includes("Kos"), "a vulgo of another word is no form of the family");
  assert.deepEqual(a.state, { truncated: false, persons: 1, skipped: 0 });
  assert.match(a.rev, /^[0-9a-f]{7}-[0-9a-f]{4}$/);
  w.cleanup();
});

test("an alias that is another spelling of the person's own surname is one family's form; birth and married names are not", opts, async () => {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["source", "add", "Křest Jana Lhotáka 1850", "--kind", "baptism"]); // S1
  await w.ok(["person", "add", "Jan /Lhoták/", "--sex", "M"]); // P1
  await w.ok(["name", "add", "P1", "Jan /Lhoták/", "--cite", "S1"]);
  // decomposed input: the same form
  await w.ok(["name", "add", "P1", "Jan /Lhottak/".normalize("NFD"), "--kind", "alias"]);
  await w.ok(["name", "add", "P1", "Jan /Kos/", "--kind", "alias", "--cite", "S1"]);
  // told apart by accents alone: one form to the search, two to the Strom app — suggested, its ID folded
  await w.ok(["person", "add", "Petr /Lhotec/", "--sex", "M"]); // P2
  await w.ok(["name", "add", "P2", "Petr /Lhotéc/", "--kind", "alias", "--cite", "S1"]);
  // a woman: her birth name and her married one never one family's, an alias of her married name is
  await w.ok(["person", "add", "Anna /Lhotáková/", "--sex", "F"]); // P3
  await w.ok(["name", "add", "P3", "Anna /Lhotáková/", "--cite", "S1"]);
  await w.ok(["name", "add", "P3", "Anna /Lhotinková/", "--kind", "birth", "--cite", "S1"]);
  await w.ok(["name", "add", "P3", "Анна /Лготакова/", "--kind", "alias"]);
  const a = await suggestions(w);
  const ids = a.suggestions.filter((s: any) => s.level === "documented").map((s: any) => s.id);
  assert.deepEqual(ids, ["lhotak|lhottak", "lhotec"], JSON.stringify(a.suggestions));
  assert.ok(!JSON.stringify(a).includes("Kos"), "a vulgo of another word: nothing");
  assert.ok(!ids.some((x: string) => x.includes("lhotink")), "a birth name is no spelling of a married one");
  const accents = a.suggestions.find((s: any) => s.id === "lhotec");
  assert.deepEqual([accents.forms, accents.keys], [["Lhotec", "Lhotéc"], ["diacritics"]]);
  w.cleanup();
});

test("forms told apart by accents alone are suggested by rules too: spelling, the code diacritics, the ID folded; accepted, never again", opts, async () => {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["source", "add", "Matrika Lhota", "--kind", "baptism"]); // S1
  const man = async (name: string, year: string) => {
    const id = (await w.ok(["person", "add", name, "--sex", "M", "--json"])).json.person.id;
    await w.ok(["event", "add", id, "BIRT", "--date", year, "--place", "Lhota", "--cite", "S1"]);
  };
  await man("Petr /Lhoták/", "1860");
  await man("Pavel /Lhotak/".normalize("NFD"), "1864");
  await man("Иван /Лготак/", "1862");
  await man("Иван /Лготák/", "1863");
  const a = await suggestions(w);
  const s = a.suggestions.find((x: any) => x.id === "lhotak");
  assert.ok(s, JSON.stringify(a.suggestions));
  assert.deepEqual([s.level, s.rule, s.keys, s.forms], ["rules", "spelling", ["diacritics"], ["Lhotak", "Lhoták"]]);
  await w.ok(["surname", "accept", "lhotak"]);
  assert.ok(!(await suggestions(w)).suggestions.some((x: any) => x.id === "lhotak"), "decided: not suggested again");
  w.cleanup();
});

test("a woman's husband's family and her father's are never one: no suggestion, not even by rules", opts, async () => {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["source", "add", "Oddání Anny Lhotákové 1872", "--kind", "marriage", "--transcript", "Anna, dcera Josefa Lhotáka."]); // S1
  await w.ok(["person", "add", "Anna /Lhotová/", "--sex", "F"]); // P1
  await w.ok(["name", "add", "P1", "Anna /Lhotáková/", "--cite", "S1", "--quote", "Anna Lhotáková"]);
  await w.ok(["name", "add", "P1", "Anna /Lhotová/", "--cite", "S1", "--quote", "Anna Lhotová"]);
  await w.ok(["person", "add", "Jan /Lhota/", "--sex", "M"]); // P2, her husband
  await w.ok(["person", "add", "Josef /Lhoták/", "--sex", "M"]); // P3, her father
  await w.ok(["family", "add", "--partner", "P2", "--partner", "P1"]);
  await w.ok(["family", "add", "--partner", "P3", "--child", "P1"]);
  for (const p of ["P1", "P2", "P3"]) await w.ok(["event", "add", p, "RESI", "--date", "1872", "--place", "Lhota", "--cite", "S1"]);
  const a = await suggestions(w);
  assert.deepEqual(a.suggestions, [], JSON.stringify(a.suggestions));
  w.cleanup();
});

test("rules: one sound spelled otherwise at one place in the same years — never at another place, never a century apart", opts, async () => {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["source", "add", "Matrika Lhota", "--kind", "baptism"]); // S1
  const man = async (name: string, year: string, place: string) => {
    const id = (await w.ok(["person", "add", name, "--sex", "M", "--json"])).json.person.id;
    await w.ok(["event", "add", id, "BIRT", "--date", year, "--place", place, "--cite", "S1"]);
  };
  await man("Petr /Lhotha/", "1860", "Lhota");
  await man("Pavel /Lhota/", "1870", "Lhota");
  // another sound at the same place: nothing
  await man("Karel /Lhotinka/", "1865", "Lhota");
  // the same sound at another place, or a century away: nothing
  await man("Josef /Lhottinka/", "1866", "Lhotnice");
  await man("Václav /Lhotec/", "1700", "Lhota");
  await man("Tomáš /Lhottec/", "1860", "Lhota");
  // one documented (one man written so in a record): before every suggestion by rules
  await w.ok(["person", "add", "Ondřej /Lhotecký/", "--sex", "M"]); // P0007
  await w.ok(["name", "add", "P0007", "Ondřej /Lhotecki/", "--cite", "S1"]);
  const a = await suggestions(w);
  assert.equal(a.suggestions[0].level, "documented");
  assert.equal(a.suggestions[0].id, "lhotecki|lhotecky");
  assert.ok(a.suggestions.slice(1).every((x: any) => x.level === "rules"));
  // at most so many: the first ones, said
  const capped = suggestSurnames(Tree.open(w.cwd, w.env), "cs", 1);
  assert.deepEqual([capped.suggestions.map((x) => x.id), capped.state.truncated], [["lhotecki|lhotecky"], true]);
  assert.equal(a.state.truncated, false);
  const ids = a.suggestions.map((s: any) => s.id);
  assert.ok(ids.includes("lhota|lhotha"), ids.join(" "));
  const s = a.suggestions.find((x: any) => x.id === "lhota|lhotha");
  assert.equal(s.level, "rules");
  assert.ok(["phonetic", "spelling"].includes(s.rule));
  assert.ok(s.keys.includes("th-t"), s.keys.join(","));
  assert.equal(s.evidence, undefined, "rules give no evidence");
  assert.deepEqual([s.from, s.to, s.places], [1860, 1870, ["Lhota"]]);
  assert.ok(!ids.some((id: string) => id.includes("lhotinka") || id.includes("lhottinka")), ids.join(" "));
  assert.ok(!ids.some((id: string) => id.includes("lhottec")), "a century apart");
  w.cleanup();
});

test("the person decides in the terminal: accept, reject, group, ungroup, unreject — written, logged, committed; never suggested again", opts, async () => {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["lang", "cs"]);
  await documented(w);
  const accepted = (await w.ok(["surname", "accept", "lhota|lhotaa", "--json"])).json;
  assert.deepEqual([accepted.id, accepted.forms, accepted.by], ["lhota|lhotaa", ["Lhota", "Lhotaa"], "research"]);
  assert.deepEqual(readJsonFile(file(w)).groups.map((g: any) => g.id), ["lhota|lhotaa"]);
  assert.deepEqual((await suggestions(w)).suggestions, [], "a group is not suggested again");
  const list = (await w.ok(["surname", "list", "--json"])).json;
  assert.deepEqual([list.groups.length, list.rejected.length], [1, 0]);
  // committed with its operation, nothing left uncommitted
  const git = (args: string[]) => spawnSync("git", args, { cwd: w.cwd, encoding: "utf8" }).stdout.trim();
  assert.match(git(["log", "-1", "--format=%s"]), /surname/i);
  assert.equal(git(["status", "--porcelain"]), "");
  const said = () => history(w.cwd, Tree.open(w.cwd, w.env))[0]!.text.join("\n");
  assert.match(said(), /Tvary příjmení jedné rodiny: Lhota \| Lhotaa/);
  // the research's suggestion of a group extended by another form
  await w.ok(["source", "add", "Úmrtí Jana Lhotaa 1910", "--kind", "burial"]); // S3
  await w.ok(["name", "add", "P1", "Jan /Lhotha/", "--cite", "S3"]);
  let a = await suggestions(w);
  assert.equal(a.suggestions.length, 1);
  assert.deepEqual([a.suggestions[0].id, a.suggestions[0].extends], ["lhota|lhotaa|lhotha", ["Lhota", "Lhotaa"]]);
  // rejected: never again; taken back: again
  await w.ok(["surname", "reject", "lhota|lhotaa|lhotha"]);
  assert.deepEqual((await suggestions(w)).suggestions, []);
  assert.match(said(), /Tvary příjmení nejsou jedné rodiny: Lhota \| Lhotaa \| Lhotha/);
  await w.ok(["surname", "unreject", "lhota|lhotaa|lhotha"]);
  assert.equal((await suggestions(w)).suggestions.length, 1);
  // grouped by hand, a form taken out
  await w.ok(["surname", "group", "Lhota", "Lhotha"]);
  assert.deepEqual(readJsonFile(file(w)).groups.map((g: any) => g.id), ["lhota|lhotaa|lhotha"], "a group holding a form joins");
  await w.ok(["surname", "ungroup", "Lhotha"]);
  assert.deepEqual(readJsonFile(file(w)).groups.map((g: any) => g.forms), [["Lhota", "Lhotaa"]]);
  assert.match(said(), /Tvary příjmení rozděleny/);
  // two groups a suggestion would join: left to the person
  await w.ok(["surname", "ungroup", "Lhotaa"]);
  await w.ok(["surname", "group", "Lhota", "Lhotha"]);
  await w.ok(["person", "add", "Karel /Lhotaa/", "--sex", "M"]);
  await w.ok(["name", "add", "P2", "Karel /Lhottinka/", "--cite", "S3"]);
  await w.ok(["surname", "group", "Lhotaa", "Lhottinka"]);
  a = await suggestions(w);
  assert.equal(a.state.skipped, 1, JSON.stringify(a));
  assert.equal((await w.run(["surname", "group", "Lhota"])).code, 2, "one form is no group");
  assert.match((await w.run(["surname", "accept", "lhota|nic"])).err, /strom surname suggest/);
  assert.match((await w.ok(["check"])).out, /^ok/);
  w.cleanup();
});

test("an agent never decides the forms of a surname: refused (exit 4); it may suggest", opts, async () => {
  const w = new World();
  await w.withTree("Lhotákovi");
  await documented(w);
  const agent = { env: { CLAUDECODE: "1" } };
  for (const args of [["surname", "accept", "lhota|lhotaa"], ["surname", "reject", "lhota|lhotaa"], ["surname", "group", "Lhota", "Lhotaa"], ["surname", "ungroup", "Lhota"], ["surname", "unreject", "lhota|lhotaa"]]) {
    const r = await w.run(args, agent);
    assert.equal(r.code, 4, `${args.join(" ")}: ${r.err}`);
  }
  assert.equal(fs.existsSync(file(w)), false);
  assert.equal((await w.run(["surname", "suggest", "--json"], agent)).code, 0);
  assert.match((await w.ok(["guide"])).out, /strom surname suggest/);
  w.cleanup();
});

test("the file is sealed: a hand edit is found, it goes with a pack", opts, async () => {
  const w = new World();
  await w.withTree("Lhotákovi");
  await documented(w);
  await w.ok(["surname", "accept", "lhota|lhotaa"]);
  const zip = path.join(w.dir, "lhota.zip");
  await w.ok(["pack", "--out", zip]);
  const b = new World();
  await b.ok(["setup", "--yes"]);
  await b.ok(["unpack", zip], { answers: ["a"] });
  assert.deepEqual(readJsonFile(path.join(b.treeDir("Lhotákovi"), "quality", "surnames.json")).groups.map((g: any) => g.id), ["lhota|lhotaa"]);
  b.cleanup();
  const f = file(w);
  fs.writeFileSync(f, fs.readFileSync(f, "utf8").replace("Lhotaa", "Lhotinka"));
  const v = await w.run(["verify", "--json"]);
  assert.equal(v.code, 1);
  assert.ok(v.json.findings.some((x: any) => x.code === "quality-edited"), JSON.stringify(v.json.findings));
  await w.ok(["repair"]);
  assert.ok(fs.readFileSync(f, "utf8").includes("Lhotaa"));
  w.cleanup();
});

test("a group is one family for the search and the duplicates: Lhoták and Lhotinka of one group match, the brief searches under each", opts, async () => {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["person", "add", "Jan /Lhoták/", "--sex", "M", "--born", "1850", "--born-place", "Lhota"]); // P1
  await w.ok(["person", "add", "Jan /Lhotinka/", "--sex", "M", "--born", "1850", "--born-place", "Lhota"]); // P2
  const before = Tree.open(w.cwd, w.env);
  assert.equal(likelyDuplicates(before, ["P0001"], sameFamily(before)).length, 0, "two families without a group");
  await w.ok(["surname", "group", "Lhoták", "Lhotinka"]);
  const tree = Tree.open(w.cwd, w.env);
  assert.equal(likelyDuplicates(tree, ["P0001"], sameFamily(tree)).length, 1, "one family by the person's group");
  await w.ok(["task", "add", "Najít křest Jana Lhotáka", "--level", "link", "--where", "matrika Lhota", "--why", "rodiče", "--done-when", "zápis křtu", "--about", "P1"]);
  const brief = (await w.ok(["brief", "T1"])).out;
  assert.match(brief, /forms: Lhoták is also written Lhotinka/);
  w.cleanup();
});

test("the bridge: GET /surnames answers the suggestions (features surnames.suggest, surnames.read); busy while another strom writes; an archive too", bridged, async () => {
  const w = new World();
  await w.withTree("Lhotákovi");
  await documented(w);
  const info = (await w.ok(["live", "start", "--json"])).json;
  const lock = path.join(w.cwd, ".strom", "tree.lock");
  try {
    const status = JSON.parse((await get(`${info.url}/status`)).body);
    assert.ok(status.features.includes("surnames.suggest") && status.features.includes("surnames.read"));
    assert.ok(!status.features.includes("surnames.write"));
    const r = await get(`${info.url}/surnames`);
    assert.equal(r.status, 200, r.body);
    const a = JSON.parse(r.body);
    assert.deepEqual(a.suggestions.map((s: any) => s.id), ["lhota|lhotaa"]);
    assert.deepEqual([a.groups, a.rejected], [[], []]);
    fs.writeFileSync(lock, JSON.stringify({ pid: process.pid, host: os.hostname(), at: new Date().toISOString(), owner: "a test" }));
    const busy = await get(`${info.url}/surnames`);
    assert.deepEqual([busy.status, JSON.parse(busy.body).code], [503, "research.busy"]);
    fs.rmSync(lock);
    await w.ok(["live", "stop"]);
    await w.ok(["mode", "archive"], { tty: true });
    const again = (await w.ok(["live", "start", "--json"])).json;
    // fetch: a new connection (the old bridge's port is the new one's, a kept socket of it closed)
    const archived = await fetch(`${again.url}/surnames`);
    assert.equal(archived.status, 200);
    assert.equal(((await archived.json()) as any).suggestions.length, 1);
  } finally {
    fs.rmSync(lock, { force: true });
    await w.ok(["live", "stop"]);
    w.cleanup();
  }
});

// ── strom sync: the app's header notes ─────────────────────────────────────

const GROUPS = "1 NOTE Strom surname-variant groups";
const REJECTED = "1 NOTE Strom surname-variant rejections";

/** The research's Strom file as the Strom app of `version` gives it back, its header notes replaced by `notes`. */
function asApp(text: string, notes: string[], version = "3.17.0-beta.7"): string {
  let t = text.replace(/^1 SOUR STROM_RESEARCH\r?\n2 VERS .*\r?\n2 NAME .*\r?\n/m, `1 SOUR STROM\n2 VERS ${version}\n2 NAME Strom\n`);
  t = t.replace(/^1 NOTE Strom surname-variant (?:groups|rejections)\r?\n(?:[23] CON[CT].*\r?\n)*/gm, "");
  return t.replace(/^(1 _STROM_TREE .*\r?\n)/m, `$1${notes.map((n) => `${n}\n`).join("")}`);
}

async function synced(w: World, text: string, name: string): Promise<any> {
  const f = path.join(w.dir, name);
  fs.writeFileSync(f, text);
  return (await w.ok(["sync", f, "--apply", "--json"])).json;
}

const surnameChanges = (r: any) => (r.changes ?? []).filter((c: any) => String(c.kind).startsWith("surname."));

test("sync: the app's groups taken (no base: additions only); a note missing changes nothing; damaged text only said; undone with the sync", opts, async () => {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["lang", "cs"]);
  await documented(w);
  await w.ok(["surname", "reject", "lhota|lhotaa"]);
  const given = path.join(w.dir, "given.ged");
  await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", given]);
  const text = fs.readFileSync(given, "utf8");
  assert.doesNotMatch(text, /surname-variant/, "an app of unknown version gets no notes");
  // no note: nothing, not even the rejection taken back
  let r = await synced(w, asApp(text, []), "none.ged");
  assert.deepEqual(surnameChanges(r), []);
  assert.equal(readJsonFile(file(w)).rejected.length, 1);
  // a group added in the app; an empty rejections' note without a base takes nothing away
  r = await synced(w, asApp(text, [GROUPS, "2 CONT Lhoták | Lhotinka", REJECTED]), "added.ged");
  assert.deepEqual(surnameChanges(r).map((c: any) => [c.kind, c.action]), [["surname.group", "add"]], JSON.stringify(r.changes));
  const now = readJsonFile(file(w));
  assert.deepEqual(now.groups.map((g: any) => [g.id, g.by]), [["lhotak|lhotinka", "app"]]);
  assert.equal(now.rejected.length, 1);
  assert.match(history(w.cwd, Tree.open(w.cwd, w.env))[0]!.text.join("\n"), /Tvary příjmení jedné rodiny: Lhoták \| Lhotinka/);
  // undone with the sync: the group gone again
  await w.ok(["sync", "undo", r.input]);
  assert.deepEqual(readJsonFile(file(w)).groups, []);
  // damaged text: the list as it is, said
  const f = path.join(w.dir, "damaged.ged");
  fs.writeFileSync(f, asApp(text, [GROUPS, "2 CONT Lhoták | Lho�ka"]));
  const said = (await w.ok(["sync", f, "--json"])).json;
  assert.deepEqual(surnameChanges(said).map((c: any) => [c.kind, c.action]), [["surname.warning", "report"]]);
  assert.match((await w.ok(["sync", f])).out, /poškozené znaky/);
  assert.match((await w.ok(["check"])).out, /^ok/);
  w.cleanup();
});

test("sync with what the research gave (an app that reads the notes): a group the app removed goes, a rejection taken back; the round trip changes nothing", opts, async () => {
  const w = new World();
  await w.withTree("Lhotákovi");
  Object.assign(w.env, { STROM_APP_URL: "https://beta.stromapp.info/run/", STROM_APP_VERSION: "3.17.0-beta.7" });
  await documented(w);
  await w.ok(["surname", "group", "Lhoták", "Lhotinka"]);
  await w.ok(["surname", "reject", "lhota|lhotaa"]);
  const given = path.join(w.dir, "given.ged");
  await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", given]);
  const text = fs.readFileSync(given, "utf8");
  assert.match(text, /1 NOTE Strom surname-variant groups\r?\n2 CONT Lhoták \| Lhotinka\r?\n1 NOTE Strom surname-variant rejections\r?\n2 CONT Lhota \| Lhotaa\r?\n/);
  // the round trip: the file as the app gives it back unchanged — no change of the groups or the rejections
  const keep = (t: string) => t.replace(/^1 SOUR STROM_RESEARCH\r?\n2 VERS .*\r?\n2 NAME .*\r?\n/m, "1 SOUR STROM\n2 VERS 3.17.0-beta.7\n2 NAME Strom\n");
  let r = await synced(w, keep(text), "same.ged");
  assert.deepEqual(surnameChanges(r), []);
  // the app removed the group and the rejection: both go (the research changed neither since)
  r = await synced(w, asApp(text, [GROUPS, REJECTED]), "removed.ged");
  assert.deepEqual(surnameChanges(r).map((c: any) => [c.kind, c.action]).sort(), [["surname.group", "remove"], ["surname.reject", "remove"]]);
  assert.deepEqual(readJsonFile(file(w)), { groups: [], rejected: [] });
  await w.ok(["sync", "undo", r.input]);
  const back = readJsonFile(file(w));
  assert.deepEqual([back.groups.map((g: any) => g.id), back.rejected.map((g: any) => g.id)], [["lhotak|lhotinka"], ["lhota|lhotaa"]]);
  w.cleanup();
});

test("a man's forms are no woman's two families: his wife bears his name, his two forms still one family's", opts, async () => {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["source", "add", "Oddání Jana Lhotaa 1875", "--kind", "marriage"]); // S1
  await w.ok(["person", "add", "Jan /Lhota/", "--sex", "M"]); // P1
  await w.ok(["name", "add", "P1", "Jan /Lhotaa/", "--cite", "S1"]);
  await w.ok(["person", "add", "Anna /Lhotaa/", "--sex", "F"]); // P2, his wife
  await w.ok(["person", "add", "Václav /Lhota/", "--sex", "M"]); // P3, his father
  await w.ok(["family", "add", "--partner", "P1", "--partner", "P2"]);
  await w.ok(["family", "add", "--partner", "P3", "--child", "P1"]);
  const a = await suggestions(w);
  assert.deepEqual(a.suggestions.map((s: any) => [s.id, s.level]), [["lhota|lhotaa", "documented"]]);
  w.cleanup();
});
