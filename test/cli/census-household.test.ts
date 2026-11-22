// strom census add (spec 106 K3): one household of a census sheet as one event the Strom app shares among its members
// of the tree — a CENS of each with the relation (_ROLE) and age (AGE) of each, the date, place, house, note and the
// citation of the sheet alike on every copy; the people off the tree said in the note only, never made persons; no
// birth written. Refused before anything is written: a member not in the tree, a living one, one given twice, the same
// household again. A common field corrected on one copy goes to every copy; a copy's own (status, age, role) stays its
// own, and the shared note in the file says nothing of one copy (the app's question 9). Round trip with the app.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { World, hasGit } from "../helpers.ts";
import { Tree, now } from "../../src/core/tree.ts";
import { exportGedcom } from "../../src/gedcom/export.ts";
import { applySync, planSync, readGedcom, type Snapshot } from "../../src/core/sync.ts";
import { householdDate, householdRoleOf, newHouseholdId, parseMember } from "../../src/core/household.ts";
import { HOUSEHOLD_LANGS, HOUSEHOLD_ROLES } from "../../src/core/phrases.ts";
import type { Event, Person, Source } from "../../src/core/model.ts";

const opts = { skip: !hasGit };
/** As the Strom app's bridge writes a send: the person's. */
const FROM_APP = { env: { STROM_FOR_APP: "1" } };

const open = (w: World) => Tree.open(w.cwd, w.env);
const gitHead = (w: World) => execFileSync("git", ["rev-parse", "HEAD"], { cwd: w.cwd, encoding: "utf8" }).trim();
const censuses = (w: World, id: string): Event[] => open(w).get<Person>(id)!.events.filter((e) => e.kind === "CENS" && !e.retracted);
const cens = (w: World, id: string): Event => censuses(w, id)[0]!;

/** What the research gives the Strom app (with the state it is of), as the app sends it back. */
const appFile = (w: World, more: { factStatus?: boolean } = {}) => exportGedcom(open(w), { for: "strom", head: gitHead(w), ...more }).text.replace("1 SOUR STROM_RESEARCH", "1 SOUR STROM");
const records = (t: string) => t.split(/(?=^0 )/mu);
const isOf = (r: string, refn: string) => /^0 @[^@]+@ INDI/u.test(r) && new RegExp(`^1 REFN ${refn}\\r?$`, "mu").test(r);
/** The lines of the person's census as a file has them. */
function block(t: string, refn: string): string {
  const r = records(t).find((x) => isOf(x, refn))!;
  return /^1 CENS\r?\n(?:[2-9] .*\r?\n)*/mu.exec(r)![0];
}
/** The block's lines of the common fields (DATE, PLAC, ADDR, NOTE with its CONT, SOUR with what is under it). */
function common(b: string): string {
  const out: string[] = [];
  let keep = false;
  for (const l of b.split(/\r?\n/u)) {
    if (/^2 /u.test(l)) keep = /^2 (DATE|PLAC|ADDR|NOTE|SOUR)\b/u.test(l);
    if (keep) out.push(l);
  }
  return out.join("\n");
}
function noteOf(b: string): string {
  return common(b)
    .split("\n")
    .filter((l, i, all) => /^2 NOTE/u.test(l) || (/^3 CONT/u.test(l) && all.slice(0, i).some((x) => /^2 NOTE/u.test(x)) && !all.slice(0, i).reverse().find((x) => /^2 /u.test(x))?.startsWith("2 SOUR")))
    .join("\n");
}

/**
 * Lhotákovi (Czech): Prokop and Terezie (a couple) with their son Václav, born long ago; Ludmila born lately (living);
 * a census sheet and a register of baptisms as sources.
 */
async function research(): Promise<World> {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["lang", "cs"]);
  await w.ok(["person", "add", "Prokop /Lhoták/", "--sex", "M", "--born", "1850"]); // P0001
  await w.ok(["person", "add", "Terezie /Lhotáková/", "--sex", "F", "--born", "1855"]); // P0002
  await w.ok(["person", "add", "Václav /Lhoták/", "--sex", "M", "--born", "1880"]); // P0003
  await w.ok(["person", "add", "Ludmila /Lhotová/", "--sex", "F", "--born", "1990"]); // P0004
  await w.ok(["person", "add", "Marie /Lhotová/", "--sex", "F", "--born", "1872"]); // P0005
  await w.ok(["source", "add", "Sčítání lidu 1890, Lhota", "--kind", "census"]); // S0001
  await w.ok(["source", "add", "Matrika N Lhota 1870–1890", "--kind", "baptism"]); // S0002
  return w;
}

const HOUSEHOLD = ["census", "add", "--source", "S0001", "--date", "1890", "--place", "Lhota", "--house", "14", "--member", "P0001:head:40", "--member", 'P0002:"manželka":35', "--member", "P0003:Sohn:10", "--member", "P0005:servant:18", "--others", "čeledín (19), výměnkářka (72)", "--locator", "list 3", "--transcript", "Prokop Lhoták, hospodář, 40 let"];

test("a household of four: one share id, each copy its relation and age, the common fields alike, the others only in the note, no birth", opts, async () => {
  const w = await research();
  try {
    const before = open(w).list<Person>("person").map((p) => p.events.length);
    const r = await w.ok([...HOUSEHOLD, "--json"]);
    const h = r.json.household;
    assert.match(h.id, /^[A-Za-z0-9]{12}$/u);
    assert.deepEqual(
      h.copies.map((c: { person: string; role: string; age?: string }) => [c.person, c.role, c.age]),
      [
        ["P0001", "hlava domácnosti", "40y"],
        ["P0002", "manželka", "35y"],
        ["P0003", "syn", "10y"],
        ["P0005", "služka", "18y"],
      ],
    );
    // nothing but a census written: one fact more for each member, no person made of the others
    const after = open(w).list<Person>("person");
    assert.equal(after.length, 5);
    assert.deepEqual(after.map((p) => p.events.length), before.map((n, i) => n + (i === 3 ? 0 : 1)));
    assert.ok(after.every((p) => p.events.filter((e) => e.kind === "BIRT").length <= 1));
    const copies = ["P0001", "P0002", "P0003", "P0005"].map((id) => cens(w, id));
    for (const e of copies) {
      assert.equal(e.share?.id, h.id);
      assert.equal(e.date, "1890"); // no census day known here: the year alone
      assert.equal(e.place, "Lhota");
      assert.equal(e.house, "14");
      assert.equal(e.note, "V domácnosti dále: čeledín (19), výměnkářka (72)");
      assert.deepEqual(e.citations, [{ source: "S0001", locator: "list 3", quote: "Prokop Lhoták, hospodář, 40 let" }]);
      assert.equal(e.status, "probable");
    }
    // each copy its own operation: the history and what changed say each member
    assert.equal(r.json.household.copies.length, 4);
    // the file: 1 CENS with no value and no TYPE, the common fields alike, AGE and _ROLE of each
    for (const factStatus of [false, true]) {
      const t = appFile(w, { factStatus });
      const blocks = ["P0001", "P0002", "P0003", "P0005"].map((id) => block(t, id));
      for (const b of blocks) {
        assert.match(b, /^1 CENS\r?\n/u);
        assert.doesNotMatch(b, /^2 TYPE/mu);
        assert.match(b, new RegExp(`^2 _STROM_SHARE ${h.id}\\r?\\n3 _ROLE .+$`, "mu"));
        assert.match(b, /^2 SOUR @[^@]+@\r?\n3 PAGE list 3\r?$/mu);
        assert.match(b, /^2 DATE 1890\r?$/mu);
        assert.match(b, /^2 PLAC Lhota\r?$/mu);
        assert.match(b, /^2 ADDR .*14\r?$/mu);
      }
      assert.deepEqual(blocks.map((b) => /^2 AGE (.*)$/mu.exec(b)?.[1]), ["40y", "35y", "10y", "18y"]);
      assert.deepEqual(blocks.map((b) => /^3 _ROLE (.*)$/mu.exec(b)?.[1]), ["hlava domácnosti", "manželka", "syn", "služka"]);
      assert.equal(new Set(blocks.map(common)).size, 1, blocks.map(common).join("\n---\n"));
      assert.match(noteOf(blocks[0]!), /V domácnosti dále: čeledín \(19\), výměnkářka \(72\)/u);
    }
  } finally {
    w.cleanup();
  }
});

test("the shared note says nothing of one copy: a copy verified, another a lead, the ages of an older app — the same note on every copy", opts, async () => {
  const w = await research();
  try {
    await w.ok(HOUSEHOLD);
    // one copy left a lead, another proven by hand (each its own status), straight in the records
    const tree = open(w);
    tree.withTreeLock(() => {
      for (const [id, status] of [["P0002", "lead"], ["P0003", "proven"]] as const) {
        const p = tree.get<Person>(id)!;
        tree.put({ ...p, events: p.events.map((e) => (e.kind === "CENS" ? { ...e, status, ...(status === "proven" ? { verified: { at: now(), by: "agent", result: "proven", cites: ["S0001"] } } : {}) } : e)), updated: now() } as Person, { op: "test", targets: [id], summary: `${id} status` });
      }
    });
    for (const more of [{}, { factStatus: true }, { stromVersion: "3.0.0" }] as const) {
      const t = exportGedcom(open(w), { for: "strom", ...more }).text;
      const notes = ["P0001", "P0002", "P0003", "P0005"].map((id) => noteOf(block(t, id)));
      assert.equal(new Set(notes).size, 1, `${JSON.stringify(more)}\n${notes.join("\n---\n")}`);
      assert.doesNotMatch(notes[0]!, /vodítko|možn|věk|35y|40y/iu, notes[0]);
    }
  } finally {
    w.cleanup();
  }
});

test("a household of one member of the tree: a plain census, no share", opts, async () => {
  const w = await research();
  try {
    const r = await w.ok(["census", "add", "--source", "S0001", "--date", "1890", "--place", "Lhota", "--house", "7", "--member", "P0001:head:40", "--json"]);
    assert.equal(r.json.household.id, undefined);
    const e = cens(w, "P0001");
    assert.equal(e.share, undefined);
    assert.equal(e.age, "40y");
    const b = block(appFile(w), "P0001");
    assert.doesNotMatch(b, /_STROM_SHARE|_ROLE/u);
    assert.match(b, /^2 AGE 40y\r?$/mu);
  } finally {
    w.cleanup();
  }
});

test("refused before anything is written: a member not in the tree, a living one, one twice, two heads, the same household again", opts, async () => {
  const w = await research();
  try {
    const count = () => open(w).list<Person>("person").reduce((n, p) => n + p.events.filter((e) => e.kind === "CENS").length, 0);
    const refuse = async (members: string[], code: string, re?: RegExp) => {
      const r = await w.run(["census", "add", "--source", "S0001", "--date", "1890", "--place", "Lhota", "--house", "14", ...members.flatMap((m) => ["--member", m]), "--json"]);
      assert.equal(r.code, 2, r.out);
      assert.equal(r.json.code, code, r.out);
      assert.ok(r.json.hint, r.out);
      if (re) assert.match(r.json.message, re);
      assert.equal(count(), before);
    };
    const before = count();
    await refuse(["P0001:head:40", "P0099:son:3"], "census.member.unknown", /P0099 is not a person of the tree/u);
    await refuse(["P0001:head:40", "Josef Lhoták:son:3"], "census.member.unknown");
    await refuse(["P0001:head:40", "P0004:daughter:3"], "census.living");
    await refuse(["P0001:head:40", "P0001:son:3"], "census.member.twice");
    await refuse(["P0001:head:40", "P0003:hlava domácnosti:10"], "census.head.twice");
    await refuse(["P0001:head:40", "P0003"], "census.member.form");
    await refuse(["P0001:head:40", "P0003::10"], "census.role");
    // the same household again (one of its members at the same house in the same census)
    await w.ok(HOUSEHOLD);
    const once = count();
    const again = await w.run(["census", "add", "--source", "S0001", "--date", "31 DEC 1890", "--place", "Lhota", "--house", "14", "--member", "P0003:son:10", "--json"]);
    assert.equal(again.json.code, "census.duplicate", again.out);
    assert.match(again.json.hint, /strom show E\d+/u);
    assert.equal(count(), once);
    // another house of that census is another household
    await w.ok(["census", "add", "--source", "S0001", "--date", "1890", "--place", "Lhota", "--house", "15", "--member", "P0003:farmhand:10"]);
    assert.equal(count(), once + 1);
  } finally {
    w.cleanup();
  }
});

test("any script, any accent: a relation given decomposed, in Cyrillic or in another language, the others decomposed — stored composed", opts, async () => {
  const w = await research();
  try {
    const r = await w.ok([
      "census", "add", "--source", "S0001", "--date", "1890", "--place", "Lhota", "--house", "14",
      "--member", "P0001:hlava domácnosti".normalize("NFD") + ":40",
      "--member", "P0005:" + "služka".normalize("NFD") + ":18",
      "--member", "P0003:" + "подна́ймач".normalize("NFD") + ":10",
      "--others", "Výměnkářka Žofie (72)".normalize("NFD"),
      "--json",
    ]);
    assert.deepEqual(r.json.household.copies.map((c: { role: string }) => c.role), ["hlava domácnosti", "služka", "подна́ймач".normalize("NFC")]);
    assert.equal(cens(w, "P0003").share?.role, "подна́ймач".normalize("NFC"));
    assert.equal(cens(w, "P0005").share?.role, "služka");
    assert.equal(cens(w, "P0001").note, "V domácnosti dále: Výměnkářka Žofie (72)");
    const raw = fs.readFileSync(path.join(w.cwd, "data", "persons", "P0003.json"), "utf8");
    assert.ok(raw.includes("подна́ймач".normalize("NFC")) && !raw.includes("подна́ймач".normalize("NFD")));
  } finally {
    w.cleanup();
  }
});

test("a common field corrected on one copy goes to every copy; the age and the relation stay each copy's", opts, async () => {
  const w = await research();
  try {
    await w.ok(HOUSEHOLD);
    const [a, b, c] = ["P0001", "P0002", "P0003"].map((id) => cens(w, id).id);
    const all = () => ["P0001", "P0002", "P0003", "P0005"].map((id) => cens(w, id));
    // the note
    await w.ok(["note", "edit", a!, "1", "V domácnosti dále: čeledín (19)", "--reason", "výměnkářka patří do č. 15"]);
    assert.deepEqual(all().map((e) => e.note), Array(4).fill("V domácnosti dále: čeledín (19)"));
    // the house
    await w.ok(["event", "edit", b!, "--house", "14a", "--reason", "list 3 says 14a"]);
    assert.deepEqual(all().map((e) => e.house), Array(4).fill("14a"));
    // a citation more
    await w.ok(["cite", c!, "S0002", "--locator", "fol. 3"]);
    assert.deepEqual(all().map((e) => e.citations.map((x) => x.source)), Array(4).fill(["S0001", "S0002"]));
    // what is each copy's own stays
    assert.deepEqual(all().map((e) => e.age), ["40y", "35y", "10y", "18y"]);
    assert.deepEqual(all().map((e) => e.share?.role), ["hlava domácnosti", "manželka", "syn", "služka"]);
    // an age corrected on one copy: the others keep theirs, nothing common split
    await w.ok(["event", "edit", c!, "--age", "11", "--reason", "list 3 says 11"]);
    assert.deepEqual(all().map((e) => e.age), ["40y", "35y", "11y", "18y"]);
    const t = appFile(w);
    const blocks = ["P0001", "P0002", "P0003", "P0005"].map((id) => block(t, id));
    assert.equal(new Set(blocks.map(common)).size, 1, blocks.map(common).join("\n---\n"));
    // a status given with a citation goes to every copy (the same record says it of all)
    await w.ok(["cite", a!, "S0002", "--locator", "fol. 4", "--status", "possible", "--reason", "the entry may be another Prokop"]);
    assert.deepEqual(all().map((e) => e.status), Array(4).fill("possible"));
  } finally {
    w.cleanup();
  }
});

test("a proposal taken on one copy of a household goes to every copy: the person's household, an agent's date and place proposed on one copy, taken", opts, async () => {
  const w = await research();
  try {
    const AGENT = { env: { CLAUDECODE: "1" } };
    const PERSON = { tty: true };
    // the household is the person's (the values the user's): an agent's change of it is only proposed
    await w.ok(HOUSEHOLD, PERSON);
    const ids = ["P0001", "P0002", "P0003", "P0005"];
    const all = () => ids.map((id) => cens(w, id));
    const b = cens(w, "P0002").id;
    const was = all().map((e) => [e.date, e.place]);
    const r = await w.ok(["event", "edit", b, "--date", "2 JAN 1891", "--place", "Horní Lhota", "--reason", "list 3 má jiný den", "--json"], AGENT);
    const x: string = r.json.proposed;
    assert.ok(x, JSON.stringify(r.json));
    // proposed, nothing changed on any copy yet
    assert.deepEqual(all().map((e) => [e.date, e.place]), was);
    await w.ok(["conflict", "resolve", x, "--take", "research", "--reasoning", "souhlasím"], PERSON);
    // taken: the date and place on every copy, never one copy apart from the others
    const now = all();
    assert.deepEqual(now.map((e) => e.date), Array(4).fill("2 JAN 1891"), JSON.stringify(now.map((e) => [e.id, e.date])));
    assert.equal(new Set(now.map((e) => e.place)).size, 1, JSON.stringify(now.map((e) => [e.id, e.place])));
    assert.notDeepEqual(now[0]!.place, was[0]![1]);
    // what is each copy's own stays
    assert.deepEqual(now.map((e) => e.age), ["40y", "35y", "10y", "18y"]);
    assert.equal(new Set(now.map((e) => e.share?.id)).size, 1);
    const blocks = ids.map((id) => block(appFile(w), id));
    assert.equal(new Set(blocks.map(common)).size, 1, blocks.map(common).join("\n---\n"));
  } finally {
    w.cleanup();
  }
});

/** A sync written as the person's, straight (the gate open as the test needs it). */
function apply(w: World, incoming: Snapshot, decidesShares: boolean): { changes: number } {
  const tree = open(w);
  tree.personWrites = true;
  return tree.withTreeLock(() => {
    const plan = planSync(tree, incoming, "conflict", { decidesShares });
    const source = tree.get<Source>("S0001") as Source;
    const r = applySync(tree, plan, incoming, source, undefined, { decidePerson: false });
    return { changes: r.changes };
  });
}
const kinds = (plan: { changes: { kind: string; action: string; person?: string }[] }) => plan.changes.map((c) => `${c.kind} ${c.action} ${c.person ?? ""}`.trim());
/** The person's census block in the file changed as `edit` says. */
const inBlock = (t: string, refn: string, edit: (b: string) => string) => records(t).map((r) => (isOf(r, refn) ? r.replace(/^1 CENS\r?\n(?:[2-9] .*\r?\n)*/mu, (b) => edit(b)) : r)).join("");

test("round trip with the app: unchanged is no change; the note edited once is each copy's; a relation through the share; an added age taken, a changed one of a cited copy a conflict", opts, async () => {
  const w = await research();
  try {
    await w.ok(HOUSEHOLD);
    const t = appFile(w);
    for (const decidesShares of [false, true]) assert.deepEqual(kinds(planSync(open(w), readGedcom(t), "conflict", { decidesShares })), []);
    // the user's note of the household, edited in the app (every copy has the one note there)
    const edited = t.replace(/V domácnosti dále: čeledín \(19\), výměnkářka \(72\)/gu, "V domácnosti dále: čeledín (19)");
    const plan = planSync(open(w), readGedcom(edited), "conflict", { decidesShares: true });
    assert.deepEqual(kinds(plan).filter((k) => k.startsWith("fact.note")).length, 4, JSON.stringify(plan.changes));
    apply(w, readGedcom(edited), true);
    assert.deepEqual(["P0001", "P0002", "P0003", "P0005"].map((id) => cens(w, id).note), Array(4).fill("V domácnosti dále: čeledín (19)"));
    execFileSync("git", ["add", "-A"], { cwd: w.cwd });
    execFileSync("git", ["commit", "-qm", "sync"], { cwd: w.cwd });
    // the relation changed in the app: the share's own (APP_DECIDES_SHARES)
    const t2 = appFile(w);
    const role = inBlock(t2, "P0005", (b) => b.replace(/^3 _ROLE služka$/mu, "3 _ROLE děvečka"));
    assert.notEqual(role, t2);
    assert.deepEqual(kinds(planSync(open(w), readGedcom(role), "conflict", { decidesShares: true })), ["fact.share user P0005"]);
    // an age added in the app where none was: taken
    const noAge = open(w);
    noAge.withTreeLock(() => {
      const p = noAge.get<Person>("P0002")!;
      noAge.put({ ...p, events: p.events.map((e) => (e.kind === "CENS" ? (({ age: _a, ...rest }) => rest as Event)(e) : e)), updated: now() } as Person, { op: "test", targets: ["P0002"], summary: "P0002 no age" });
    });
    execFileSync("git", ["add", "-A"], { cwd: w.cwd });
    execFileSync("git", ["commit", "-qm", "no age"], { cwd: w.cwd });
    const t3 = appFile(w);
    const added = inBlock(t3, "P0002", (b) => b.replace(/^(2 PLAC .*\r?\n)/mu, "$12 AGE 35y\n"));
    assert.deepEqual(kinds(planSync(open(w), readGedcom(added), "conflict", { decidesShares: true })), ["fact.detail add P0002"]);
    // a changed age of a copy that cites the sheet: a conflict, never written over
    const changed = inBlock(t3, "P0003", (b) => b.replace(/^2 AGE 10y$/mu, "2 AGE 12y"));
    assert.deepEqual(kinds(planSync(open(w), readGedcom(changed), "conflict", { decidesShares: true })), ["fact.detail conflict P0003"]);
  } finally {
    w.cleanup();
  }
});

test("the parts of a member, the relations of every language, the census day of the data however laid out, a year alone else", () => {
  assert.deepEqual(parseMember('P0003:"hlava domácnosti":41y'), { ref: "P0003", role: "hlava domácnosti", age: "41y" });
  assert.deepEqual(parseMember("P0008:wife"), { ref: "P0008", role: "wife" });
  assert.deepEqual(parseMember("P0009:syn: nevlastní:3"), { ref: "P0009", role: "syn: nevlastní", age: "3" });
  assert.deepEqual(parseMember("P0010:Mieter:"), { ref: "P0010", role: "Mieter" });
  assert.equal(householdRoleOf("cs", "Sohn", "M").role, "syn");
  assert.equal(householdRoleOf("cs", "servant", "F").role, "služka");
  assert.equal(householdRoleOf("cs", "servant", "M").role, "sluha");
  assert.equal(householdRoleOf("de", "služka".normalize("NFD"), "F").role, "Dienstmagd");
  assert.equal(householdRoleOf("pl", "head", "M").role, "głowa gospodarstwa domowego");
  assert.equal(householdRoleOf("fr", "head", "M").role, "head of household"); // another language: English
  assert.equal(householdRoleOf("cs", "relative", "U").role, "relative"); // a pair the sex does not tell: as written
  assert.equal(householdRoleOf("cs", "schovanec Lhotákových", "M").role, "schovanec Lhotákových"); // the agent's own words
  assert.equal(householdRoleOf("cs", "подна́ймач".normalize("NFD"), "M").role, "подна́ймач".normalize("NFC"));
  // every relation in every language
  for (const [key, words] of Object.entries(HOUSEHOLD_ROLES)) for (const l of HOUSEHOLD_LANGS) assert.ok(words[l]?.trim(), `${key} ${l}`);
  // the census days of the data (censusDay), a day given wins, a year the data do not know stays a year
  const dayOf = (c: string, y: number) => ({ CZ: { 1890: "1890-12-31", 1921: "1921-02-15", 1900: "1901-01-01" } } as Record<string, Record<number, string>>)[c.toUpperCase()]?.[y];
  assert.deepEqual(householdDate("1890", "CZ", dayOf), { date: "31 DEC 1890", day: "census" });
  assert.deepEqual(householdDate("1921", "cz", dayOf), { date: "15 FEB 1921", day: "census" });
  assert.deepEqual(householdDate("1900", "CZ", dayOf), { date: "1900" }); // a day of another year is none
  assert.deepEqual(householdDate("1880", "CZ", dayOf), { date: "1880" });
  assert.deepEqual(householdDate("1890", "AT", dayOf), { date: "1890" });
  assert.deepEqual(householdDate("1890", undefined, dayOf), { date: "1890" });
  assert.deepEqual(householdDate("2 JAN 1891", "CZ", dayOf), { date: "2 JAN 1891", day: "given" });
  assert.deepEqual(householdDate("ABT 1890", "CZ", dayOf), { date: "ABT 1890" });
  // the shipped data: the reference days of strom's list of archives
  assert.deepEqual(householdDate("1857", "CZ"), { date: "31 OCT 1857", day: "census" });
});

test("a household's share id is opaque: 12 letters and digits, none the tree has", opts, async () => {
  const w = await research();
  try {
    const tree = open(w);
    const ids = new Set(Array.from({ length: 50 }, () => newHouseholdId(tree)));
    assert.equal(ids.size, 50);
    for (const id of ids) assert.match(id, /^[A-Za-z0-9]{12}$/u);
  } finally {
    w.cleanup();
  }
});
