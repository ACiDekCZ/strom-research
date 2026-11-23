// How sure a name is (spec 066 P5, the app's ZADANI_VYZKUM_stav-jmena.md R1–R5): a name has a status as a fact has —
// `strom cite P… S… --status` (checked as a fact's: proven only on the original record with primary information), a
// citation with none makes a name with no status probable on a record of the research's, never a name the person
// confirmed or wrote; name add / person add --name-status; a change of the name's words ends its confirmation; the
// Strom file says it under NAME for an app of the gate APP_READS_NAME_STATUS alone; the fix name-status gives the names
// of an older research probable once (never proven); strom sync reads the person's confirmation of a name from the app.
// Made-up people (Lhoták, Lhota), a name typed in NFD as on a Mac, a name in Cyrillic.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { World, hasGit } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import { Settings } from "../../src/core/config.ts";
import { exportGedcom } from "../../src/gedcom/export.ts";
import { validateGedcom } from "../../src/gedcom/validate.ts";
import { APP_READS_NAME_STATUS, APP_READS_NAME_STATUS_BETA, appReadsNameStatus } from "../../src/core/stromapp.ts";
import { confirmName, nameEid, parseNameEid } from "../../src/core/namestatus.ts";
import { nameMark } from "../../src/core/readers.ts";
import { NAME_STATUS_SETTLED, nameStatusFixes, settleNameStatus } from "../../src/core/namestatusfix.ts";
import { applySync, planSync, readGedcom, type Snapshot, type SyncInput } from "../../src/core/sync.ts";
import { create, update } from "../../src/core/records.ts";
import { validateRecord as checkRecord } from "../../src/core/validate.ts";
import type { Name, Person, Source } from "../../src/core/model.ts";

const opts = { skip: !hasGit };
const AGENT = { env: { CLAUDECODE: "1" } };
const PERSON = { tty: true };

const open = (w: World) => Tree.open(w.cwd, w.env);
const person = (w: World, id: string) => open(w).get<Person>(id)!;
const first = (w: World, id: string): Name => person(w, id).names[0]!;
const gitHead = (w: World) => execFileSync("git", ["rev-parse", "HEAD"], { cwd: w.cwd, encoding: "utf8" }).trim();
const commits = (w: World) => Number(execFileSync("git", ["rev-list", "--count", "HEAD"], { cwd: w.cwd, encoding: "utf8" }).trim());

/** The person's confirmation of the name of someone's identity against the scan (as the bridge and a sync write it). */
function confirm(w: World, id: string, day = "2026-01-15"): void {
  const tree = open(w);
  tree.personWrites = true;
  tree.withTreeLock(() => {
    confirmName(tree, id, true, { day });
    tree.commit(`${id} name confirmed`);
  });
}

/**
 * Lhotákovi: Jan (P0001, his name typed in NFD) and the sources — S0001 the original baptism (primary), S0002 a copy
 * of it (primary: QUAY 2), S0003 an index, S0004 a family tree.
 */
async function lhotaci(): Promise<World> {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["person", "add", "Jan /Lhoták/".normalize("NFD"), "--sex", "M"]); // P0001
  await w.ok(["source", "add", "Křest Jana Lhotáka 1850", "--kind", "baptism", "--information", "primary", "--locator", "fol. 1"]); // S0001
  await w.ok(["source", "add", "Opis křtu Jana Lhotáka", "--kind", "baptism", "--form", "derivative", "--information", "primary"]); // S0002
  await w.ok(["source", "add", "Index křtů Lhota", "--kind", "index", "--information", "primary"]); // S0003
  await w.ok(["source", "add", "Rodokmen Lhotáků", "--kind", "family-tree"]); // S0004
  return w;
}

test("cite P… --status proven: the name of their identity cites the record and is proven; proven of a copy or an index refused; a family takes no status", opts, async () => {
  const w = await lhotaci();
  try {
    await w.ok(["cite", "P0001", "S0001", "--locator", "fol. 1", "--quote", "Joannes Lhoták".normalize("NFD"), "--status", "proven"], AGENT);
    const n = first(w, "P0001");
    assert.equal(n.status, "proven");
    assert.deepEqual(n.citations?.map((c) => c.source), ["S0001"]);
    // a copy of the record (QUAY 2) or an index: never proven
    await w.ok(["person", "add", "Josef /Lhoták/", "--sex", "M"]); // P0002
    const copy = await w.run(["cite", "P0002", "S0002", "--status", "proven", "--json"], AGENT);
    assert.notEqual(copy.code, 0);
    assert.match(copy.err + copy.out, /original/u);
    const index = await w.run(["cite", "P0002", "S0003", "--status", "proven", "--json"], AGENT);
    assert.notEqual(index.code, 0);
    assert.equal(first(w, "P0002").status, undefined, "nothing written");
    assert.equal(first(w, "P0002").citations, undefined);
    // a status no name takes
    assert.notEqual((await w.run(["cite", "P0002", "S0001", "--status", "disproven"], AGENT)).code, 0);
    // a family: no status, as before
    await w.ok(["family", "add", "--partner", "P0002", "--child", "P0001"]);
    const fam = await w.run(["cite", "F0001", "S0001", "--status", "proven"], AGENT);
    assert.notEqual(fam.code, 0);
    assert.match(fam.err, /family has no status/u);
  } finally {
    w.cleanup();
  }
});

test("cite P… without --status: a name with none becomes probable on a record of the research's (QUAY 2 or 3), none on a family tree or an index; a status given stays", opts, async () => {
  const w = await lhotaci();
  try {
    await w.ok(["person", "add", "Ян /Лхотак/", "--sex", "M"]); // P0002, a name in Cyrillic
    await w.ok(["person", "add", "Anna /Lhotová/", "--sex", "F"]); // P0003
    await w.ok(["cite", "P0001", "S0001", "--locator", "fol. 1"], AGENT);
    assert.equal(first(w, "P0001").status, "probable", "the original (QUAY 3)");
    await w.ok(["cite", "P0002", "S0002"], AGENT);
    assert.equal(first(w, "P0002").status, "probable", "a copy of primary information (QUAY 2)");
    await w.ok(["cite", "P0003", "S0004"], AGENT);
    assert.equal(first(w, "P0003").status, undefined, "a family tree: no status");
    await w.ok(["cite", "P0003", "S0003"], AGENT);
    assert.equal(first(w, "P0003").status, undefined, "an index: no status");
    // a status said stays as said: another citation without --status changes nothing
    await w.ok(["cite", "P0002", "S0003", "--status", "possible"], AGENT);
    await w.ok(["cite", "P0002", "S0001"], AGENT);
    assert.equal(first(w, "P0002").status, "possible");
  } finally {
    w.cleanup();
  }
});

test("a name the person confirmed against the scan: an agent's other --status refused (event.confirmed), a citation without it taken, the person may", opts, async () => {
  const w = await lhotaci();
  try {
    await w.ok(["cite", "P0001", "S0002", "--status", "probable"], AGENT);
    confirm(w, "P0001");
    const r = await w.run(["cite", "P0001", "S0001", "--status", "proven", "--json"], AGENT);
    assert.notEqual(r.code, 0);
    assert.match(r.out + r.err, /event\.confirmed/u);
    assert.match(r.out + r.err, /without --status/u);
    assert.equal(first(w, "P0001").status, "probable");
    // the same status again, or none: the citation taken, the status and the confirmation as they are
    await w.ok(["cite", "P0001", "S0001", "--status", "probable"], AGENT);
    await w.ok(["cite", "P0001", "S0003"], AGENT);
    assert.equal(first(w, "P0001").status, "probable");
    assert.ok(first(w, "P0001").confirmed);
    assert.deepEqual(first(w, "P0001").citations?.map((c) => c.source).sort(), ["S0001", "S0002", "S0003"]);
    // the person at their own terminal
    await w.ok(["cite", "P0001", "S0001", "--locator", "fol. 2", "--status", "proven"], PERSON);
    assert.equal(first(w, "P0001").status, "proven");
  } finally {
    w.cleanup();
  }
});

test("name add --cite --status and person add --name-status set the name's status; person add --status without a birth or death stays refused", opts, async () => {
  const w = await lhotaci();
  try {
    await w.ok(["name", "add", "P0001", "Johann /Lhoták/", "--cite", "S0002", "--quote", "Johann Lhoták", "--status", "probable"], AGENT);
    const johann = person(w, "P0001").names.find((n) => n.given === "Johann")!;
    assert.equal(johann.status, "probable");
    assert.notEqual((await w.run(["name", "add", "P0001", "Hans /Lhoták/", "--status", "probable"], AGENT)).code, 0, "a status needs the record");
    assert.notEqual((await w.run(["name", "add", "P0001", "Hans /Lhoták/", "--cite", "S0003", "--status", "proven"], AGENT)).code, 0, "proven of an index");
    assert.ok(!person(w, "P0001").names.some((n) => n.given === "Hans"));

    const anna = (await w.ok(["person", "add", "Anna /Lhotová/".normalize("NFD"), "--sex", "F", "--cite", "S0001", "--name-status", "proven", "--json"], AGENT)).json.person.id as string;
    assert.equal(first(w, anna).status, "proven");
    // --status is the birth's or the death's: without them refused, as before (how sure the name is: --name-status)
    const bare = await w.run(["person", "add", "Marie /Lhotová/", "--sex", "F", "--cite", "S0001", "--status", "proven"], AGENT);
    assert.notEqual(bare.code, 0);
    assert.match(bare.err, /--name-status/u);
    // with a birth: --status the birth's, the name cites the record only with --name-status
    const josef = (await w.ok(["person", "add", "Josef /Lhoták/", "--sex", "M", "--born", "1850", "--cite", "S0001", "--status", "proven", "--json"], AGENT)).json.person.id as string;
    assert.equal(person(w, josef).events[0]!.status, "proven");
    assert.equal(first(w, josef).status, undefined);
    const karel = (await w.ok(["person", "add", "Karel /Lhoták/", "--sex", "M", "--born", "1852", "--cite", "S0001", "--status", "proven", "--name-status", "probable", "--json"], AGENT)).json.person.id as string;
    assert.equal(first(w, karel).status, "probable");
    assert.deepEqual(first(w, karel).citations?.map((c) => c.source), ["S0001"]);
    // a new person cited without one: probable on the research's record
    const eva = (await w.ok(["person", "add", "Eva /Lhotová/", "--sex", "F", "--cite", "S0002", "--json"], AGENT)).json.person.id as string;
    assert.equal(first(w, eva).status, "probable");
  } finally {
    w.cleanup();
  }
});

test("a change of the name's words ends the person's confirmation and its status (an agent only proposes on a confirmed name); retracted, the name keeps its status", opts, async () => {
  const w = await lhotaci();
  try {
    await w.ok(["cite", "P0001", "S0001", "--status", "proven"], AGENT);
    confirm(w, "P0001");
    // an agent: a proposal, the name as it is
    const p = await w.ok(["person", "edit", "P0001", "--name", "Johann /Lhoták/", "--reason", "jinak v zápisu", "--json"], AGENT);
    assert.ok(p.json.proposed, JSON.stringify(p.json));
    assert.equal(first(w, "P0001").given.normalize("NFC"), "Jan");
    assert.ok(first(w, "P0001").confirmed);
    // the person: the words changed, the confirmation and the status gone with them
    await w.ok(["person", "edit", "P0001", "--name", "Johann /Lhoták/", "--reason", "jinak v zápisu"], PERSON);
    const n = first(w, "P0001");
    assert.equal(n.given, "Johann");
    assert.equal(n.confirmed, undefined);
    assert.equal(n.status, undefined);
    // the same words again (only the record's marks): nothing ends
    confirm(w, "P0001");
    await w.ok(["cite", "P0001", "S0002"], PERSON);
    assert.ok(first(w, "P0001").confirmed);
    // a name taken back keeps what it said of itself
    await w.ok(["name", "add", "P0001", "Hans /Lhoták/", "--cite", "S0002", "--status", "possible"], AGENT);
    await w.ok(["name", "retract", "P0001", "Hans /Lhoták/", "--reason", "misread"], AGENT);
    const gone = person(w, "P0001").retractedNames?.find((x) => x.given === "Hans");
    assert.equal(gone?.status, "possible");
  } finally {
    w.cleanup();
  }
});

test("a name's status and confirmation are a record's: valid ones pass, any other status refused", () => {
  const at = "2026-01-15T12:00:00.000Z";
  const p = (n: Partial<Name>) => ({ id: "P0001", type: "person", names: [{ given: "Jan", surname: "Lhoták", ...n }], sex: "M", events: [], notes: [], created: at, updated: at });
  assert.deepEqual(checkRecord(p({ status: "probable", confirmed: { at, by: "user" }, verified: { at, by: "agent", result: "proven", cites: ["S0001"] } })).filter((x) => x.path.startsWith("names")), []);
  assert.ok(checkRecord(p({ status: "disproven" as never })).some((x) => x.path === "names[0].status"));
  assert.ok(checkRecord(p({ confirmed: { at: "yesterday", by: "user" } })).some((x) => x.path === "names[0].confirmed"));
});

test("person show: how sure each name is and the person's confirmation, in --json too", opts, async () => {
  const w = await lhotaci();
  try {
    await w.ok(["cite", "P0001", "S0001", "--status", "proven"], AGENT);
    confirm(w, "P0001", "2026-01-15");
    const shown = await w.ok(["person", "show", "P0001"], AGENT);
    assert.match(shown.out, /Jan Lhoták \[proven\] · confirmed against the scan 2026-01-15 {2}← S0001/u);
    const json = (await w.ok(["person", "show", "P0001", "--json"], AGENT)).json;
    assert.equal(json.person.names[0].status, "proven");
    assert.equal(json.person.names[0].confirmed.at.slice(0, 10), "2026-01-15");
    // the person's own language
    await w.ok(["lang", "cs"]);
    const cs = await w.ok(["person", "show", "P0001"], PERSON);
    assert.match(cs.out, /potvrzeno podle skenu/u);
  } finally {
    w.cleanup();
  }
});

test("the gate APP_READS_NAME_STATUS: the app's 3.31.0 — from its version on, an unknown version never; its beta from its own (3.31.0-beta.5)", () => {
  const prod = new Settings({ STROM_APP_URL: "https://stromapp.info/run/" }, {});
  const beta = new Settings({ STROM_APP_URL: "https://beta.stromapp.info/run/" }, {});
  assert.equal(APP_READS_NAME_STATUS, "3.31.0", "the app's 3.31.0 reads them");
  assert.equal(APP_READS_NAME_STATUS_BETA, "3.31.0-beta.5");
  for (const v of [undefined, "3.30.0", "3.30.9", "3.31.0-beta.9", "nonsense"]) assert.equal(appReadsNameStatus(prod, v), false, String(v));
  for (const v of ["3.31.0", "3.31.1", "3.32.0", "9.0.0"]) assert.equal(appReadsNameStatus(prod, v), true, v);
  for (const v of [undefined, "3.31.0", "3.32.0", "9.0.0"]) assert.equal(appReadsNameStatus(prod, v, ""), false, `no gate ${v}`);
  for (const v of [undefined, "3.30.0", "3.31.0-beta.4"]) assert.equal(appReadsNameStatus(beta, v), false, `beta ${v}`);
  for (const v of ["3.31.0-beta.5", "3.31.0", "9.0.0"]) assert.equal(appReadsNameStatus(beta, v), true, `beta ${v}`);
  for (const v of [undefined, "3.31.0", "3.32.0-beta.3"]) assert.equal(appReadsNameStatus(prod, v, "3.32.0"), false, String(v));
  for (const v of ["3.32.0", "3.32.1", "9.0.0"]) assert.equal(appReadsNameStatus(prod, v, "3.32.0"), true, v);
  assert.equal(appReadsNameStatus(beta, "3.32.0-beta.1", "3.32.0", "3.32.0-beta.2"), false);
  assert.equal(appReadsNameStatus(beta, "3.32.0-beta.2", "3.32.0", "3.32.0-beta.2"), true);
  assert.equal(appReadsNameStatus(beta, undefined, "3.32.0", "3.32.0-beta.2"), false);
  // the name's id: one place for it
  assert.equal(nameEid({ id: "P0012" }), "P0012.N");
  assert.equal(parseNameEid(" p0012.n "), "P0012");
  assert.equal(parseNameEid("P12.N"), "P0012");
  for (const x of ["P0012", "E0012", "P0012.NN", "P٠٠١٢.N", undefined]) assert.equal(parseNameEid(x), undefined, String(x));
});

test("the Strom file: under NAME nothing for an app below the gate; for one of it the status (a name cited), and under the name of their identity its id, mark, confirmation and last verification — valid GEDCOM", opts, async () => {
  const w = await lhotaci();
  try {
    await w.ok(["cite", "P0001", "S0001", "--locator", "fol. 1", "--status", "proven"], AGENT);
    confirm(w, "P0001", "2026-01-15");
    await w.ok(["name", "add", "P0001", "Johann /Lhoták/", "--cite", "S0002", "--status", "probable"], AGENT);
    await w.ok(["person", "add", "Anna /Lhotová/", "--sex", "F"]); // P0002: no citation
    // a status without a citation (its citation gone since): said nowhere
    const tree = open(w);
    tree.withTreeLock(() => {
      const anna = tree.get<Person>("P0002")!;
      tree.put({ ...anna, names: [{ ...anna.names[0]!, status: "probable" }] }, { op: "person.edit", targets: ["P0002"], summary: "test" });
      tree.commit("test");
    });
    // an app below the gate (3.30.0): nothing under NAME, as before
    const out = path.join(w.dir, "app.ged");
    await w.ok(["export", "gedcom", "--for", "strom", "--out", out], { env: { STROM_APP_VERSION: "3.30.0" } });
    const closed = fs.readFileSync(out, "utf8");
    assert.doesNotMatch(closed, /_STROM_EID P0001\.N|_STROM_STATUS/u);
    const indi = (text: string, id: string) => text.split(/(?=^0 )/mu).find((r) => r.startsWith(`0 @${id}@ INDI`) || r.includes(`\n1 _UID ${id}`) || r.startsWith(`0 @I${Number(id.slice(1))}@ INDI`)) ?? "";
    for (const id of ["P0001", "P0002"]) assert.doesNotMatch(indi(closed, id).split("\n1 SEX")[0]!, /_STROM_(STATUS|EID|CONFIRMED|CHECKED|VERIFY)/u, id);
    // the app's 3.31.0 (the gate set): the export the CLI makes for it says them
    await w.ok(["export", "gedcom", "--for", "strom", "--out", out], { env: { STROM_APP_VERSION: "3.31.0" } });
    const open31 = fs.readFileSync(out, "utf8");
    assert.match(indi(open31, "P0001").split("\n1 SEX")[0]!, /2 _STROM_STATUS proven\n2 _STROM_EID P0001\.N\n3 _TXT [0-9a-f]{16}\n2 _STROM_CONFIRMED 2026-01-15\n/u);

    // the app of the gate
    const text = exportGedcom(open(w), { for: "strom", factStatus: true, verify: new Map(), nameStatus: true }).text;
    const jan = indi(text, "P0001");
    const names = jan.split("\n1 SEX")[0]!;
    const mark = nameMark(first(w, "P0001"));
    assert.match(names, new RegExp(`^1 NAME Jan /Lhoták/\\n(?:2 (?!_STROM_).*\\n|3 .*\\n)*2 _STROM_STATUS proven\\n2 _STROM_EID P0001\\.N\\n3 _TXT ${mark}\\n2 _STROM_CONFIRMED 2026-01-15\\n`, "mu"));
    assert.match(names, /^1 NAME Johann \/Lhoták\/\n(?:.*\n)*?2 _STROM_STATUS probable$/mu);
    assert.equal(names.match(/_STROM_EID/gu)?.length, 1, "the id: the name of their identity alone");
    assert.doesNotMatch(indi(text, "P0002").split("\n1 SEX")[0]!, /_STROM_STATUS/u, "a name with no citation: no status");
    assert.match(mark, /^[0-9a-f]{16}$/u);
    assert.equal(nameMark({ given: "Jan".normalize("NFD"), surname: "Lhoták".normalize("NFD") }), nameMark({ given: "Jan", surname: "Lhoták" }), "NFC");
    const problems = validateGedcom(text).filter((f) => /NAME/u.test(`${f.message} ${(f as { path?: string }).path ?? ""}`));
    assert.deepEqual(problems, []);
    // a verification of the name that agrees with its status is said too
    tree.withTreeLock(() => {
      const p = tree.get<Person>("P0001")!;
      const n = p.names[0]!;
      tree.put({ ...p, names: [{ ...n, verified: { at: "2026-01-20T10:00:00.000Z", by: "agent", result: "proven", cites: ["S0001"], readers: 2 } }, ...p.names.slice(1)] }, { op: "person.edit", targets: ["P0001"], summary: "test" });
      tree.commit("test");
    });
    const checked = exportGedcom(open(w), { for: "strom", factStatus: true, verify: new Map(), nameStatus: true }).text;
    assert.match(indi(checked, "P0001"), /2 _STROM_CONFIRMED 2026-01-15\n2 _STROM_CHECKED proven\n3 DATE 20 JAN 2026\n3 _READERS 2\n/u);
    assert.deepEqual(validateGedcom(checked).filter((f) => /_STROM_(CHECKED|EID|STATUS|CONFIRMED|VERIFY)/u.test(f.message)), []);
  } finally {
    w.cleanup();
  }
});

test("the validator takes the status, the id, the confirmation, how it waits and the last verification under a NAME", () => {
  const ged = [
    "0 HEAD", "1 SOUR STROM_RESEARCH", "2 VERS 1.36.0", "1 GEDC", "2 VERS 5.5.1", "2 FORM LINEAGE-LINKED", "1 CHAR UTF-8",
    "0 @S1@ SOUR", "1 TITL Křest",
    "0 @I1@ INDI", "1 NAME Jan /Lhoták/", "2 SOUR @S1@", "3 PAGE fol. 1", "2 _STROM_STATUS proven", "2 _STROM_EID P0001.N", "3 _TXT 0123456789abcdef",
    "2 _STROM_CONFIRMED 2026-01-15", "2 _STROM_VERIFY wait", "3 _POS 2", "2 _STROM_CHECKED proven", "3 DATE 20 JAN 2026", "3 _READERS 2", "1 SEX M",
    "0 TRLR", "",
  ].join("\n");
  const found = validateGedcom(ged).filter((f) => /_STROM_(STATUS|EID|CONFIRMED|VERIFY|CHECKED)/u.test(f.message));
  assert.deepEqual(found, []);
});

/** A sync written straight, with its input and the day's source as `strom sync` makes them, committed (the person's). */
function syncApply(w: World, incoming: Snapshot, personWrites = true) {
  const tree = open(w);
  tree.personWrites = personWrites;
  return tree.withTreeLock(() => {
    const plan = planSync(tree, incoming, "conflict", { readsNameStatus: true });
    const made = create<SyncInput>(tree, "input", { name: "app.ged", sha: "0", size: 1, mime: "text/plain", from: "app.ged", kind: "tree", state: "processed" } as never, (i) => `+${i} input tree "app.ged" (sync)`);
    const source = create<Source>(tree, "source", { kind: "family-tree", title: "Strom", input: made.id, information: "secondary", form: "authored" } as never, (s) => `+${s} source "app.ged" (sync)`);
    const r = applySync(tree, plan, incoming, source, undefined, { decidePerson: false, input: made.id });
    update<SyncInput>(tree, made.id, "input", (i) => ({ ...i, source: source.id, sync: { ...(incoming.head ? { head: incoming.head } : {}), edits: "conflict", applied: r.applied } }), { op: "input.sync", summary: `${made.id} synced` });
    tree.commit(`sync ${made.id}`);
    return { plan, input: made.id, ...r };
  });
}

/** The research's Strom file for an app of the gate, as that app sends it back (its header). */
const appText = (w: World) =>
  exportGedcom(open(w), { for: "strom", head: gitHead(w), factStatus: true, verify: new Map(), nameStatus: true, origins: true }).text.replace(/^1 SOUR STROM_RESEARCH\n2 VERS .*\n/mu, "1 SOUR STROM\n2 VERS 3.32.0\n");

/** The lines under one person's first NAME changed. */
function underName(text: string, eid: string, fn: (lines: string[]) => string[]): string {
  const lines = text.split("\n");
  const at = lines.indexOf(`2 _STROM_EID ${eid}`);
  assert.ok(at > 0, eid);
  let start = at;
  while (!lines[start]!.startsWith("1 NAME ")) start--;
  let end = at;
  while (end + 1 < lines.length && !/^[01] /u.test(lines[end + 1]!)) end++;
  return [...lines.slice(0, start + 1), ...fn(lines.slice(start + 1, end + 1)), ...lines.slice(end + 1)].join("\n");
}

const nameChanges = (plan: { changes: { kind: string; action: string; person?: string; confirm?: { on: boolean; day: string } }[] }) =>
  plan.changes.map((c) => `${c.kind} ${c.person ?? ""} ${c.action}${c.confirm ? ` ${c.confirm.on ? "on" : "off"}${c.confirm.day ? ` ${c.confirm.day}` : ""}` : ""}`);

test("strom sync: the marks under NAME are no edit — an unedited tree goes there and back unchanged; a confirmation added in the app is the person's, one taken off only where its NAME carries its id; undo puts it back", opts, async () => {
  const w = await lhotaci();
  try {
    await w.ok(["cite", "P0001", "S0001", "--locator", "fol. 1", "--status", "proven"], AGENT);
    await w.ok(["person", "add", "Ян /Лхотак/", "--sex", "M", "--cite", "S0002"], AGENT); // P0002, probable
    await w.ok(["person", "add", "Anna /Lhotová/".normalize("NFD"), "--sex", "F", "--cite", "S0001", "--name-status", "proven"], AGENT); // P0003
    confirm(w, "P0002", "2026-01-10");
    confirm(w, "P0003", "2026-01-11");
    // an app below the gate (3.30.0): the research's file round-trips with no change
    const out = path.join(w.dir, "export.ged");
    await w.ok(["export", "gedcom", "--for", "strom", "--out", out], { env: { STROM_APP_VERSION: "3.30.0" } });
    const today = fs.readFileSync(out, "utf8").replace(/^1 SOUR STROM_RESEARCH\n2 VERS .*\n/mu, "1 SOUR STROM\n2 VERS 3.30.0\n");
    fs.writeFileSync(out, today);
    assert.deepEqual((await w.ok(["sync", out, "--json"], { env: { STROM_FOR_APP: "1" } })).json.changes, []);

    // the app of the gate: unedited, no change either
    const text = appText(w);
    assert.match(text, /2 _STROM_STATUS proven\n2 _STROM_EID P0001\.N\n/u);
    assert.deepEqual(nameChanges(planSync(open(w), readGedcom(text), "conflict", { readsNameStatus: true })), []);
    // a file below the gate with the marks: nothing either way
    const confirmed = underName(text, "P0001.N", (l) => [...l, "2 _STROM_CONFIRMED 2026-01-15"]);
    assert.deepEqual(nameChanges(planSync(open(w), readGedcom(confirmed), "conflict", { readsNameStatus: false })), []);

    // Jan's name confirmed in the app, Ян's confirmation taken off there, Anna's NAME without its id (an older copy)
    let edited = underName(confirmed, "P0002.N", (l) => l.filter((x) => !x.startsWith("2 _STROM_CONFIRMED")));
    edited = underName(edited, "P0003.N", (l) => l.filter((x) => !x.startsWith("2 _STROM_CONFIRMED") && !x.startsWith("2 _STROM_EID") && !x.startsWith("3 _TXT")));
    assert.doesNotMatch(edited, /_STROM_EID P0003\.N/u);
    const plan = planSync(open(w), readGedcom(edited), "conflict", { readsNameStatus: true });
    assert.deepEqual(nameChanges(plan).sort(), ["name.confirm P0001 user on 2026-01-15", "name.confirm P0002 user off"]);
    // an agent's sync never confirms: said, not written
    const tree = open(w);
    tree.personWrites = false;
    const kept = tree.withTreeLock(() => {
      const made = create<SyncInput>(tree, "input", { name: "app.ged", sha: "0", size: 1, mime: "text/plain", from: "app.ged", kind: "tree", state: "processed" } as never, (i) => `+${i} input`);
      const source = create<Source>(tree, "source", { kind: "family-tree", title: "Strom", input: made.id, information: "secondary", form: "authored" } as never, (s) => `+${s} source`);
      const r = applySync(tree, planSync(tree, readGedcom(edited), "conflict", { readsNameStatus: true }), readGedcom(edited), source, undefined, { decidePerson: false, input: made.id });
      tree.commit("agent's sync");
      return r;
    });
    assert.ok(!kept.applied.some((a) => a.do === "name.confirm"));
    assert.equal(first(w, "P0001").confirmed, undefined);

    const r = syncApply(w, readGedcom(edited));
    assert.deepEqual([first(w, "P0001").confirmed?.at.slice(0, 10), first(w, "P0001").confirmed?.by], ["2026-01-15", "user"]);
    assert.equal(first(w, "P0001").status, "proven", "the status as it is");
    assert.equal(first(w, "P0002").confirmed, undefined, "taken back");
    assert.equal(first(w, "P0003").confirmed?.at.slice(0, 10), "2026-01-11", "no id: never taken back");
    assert.deepEqual(nameChanges(planSync(open(w), readGedcom(edited), "conflict", { readsNameStatus: true })), [], "the same file again: nothing more");

    await w.ok(["sync", "undo", r.input], PERSON);
    assert.equal(first(w, "P0001").confirmed, undefined, "undone: not confirmed");
    assert.equal(first(w, "P0002").confirmed?.at.slice(0, 10), "2026-01-10", "undone: confirmed as it was");
  } finally {
    w.cleanup();
  }
});

test("strom intake of another program's file: a status under its NAME is not taken — an import's citation gives no status", opts, async () => {
  const w = new World();
  try {
    await w.withTree("Lhotákovi");
    const file = path.join(w.dir, "lhotakovi.ged");
    fs.writeFileSync(file, ["0 HEAD", "1 SOUR MyHeritage", "2 VERS 8.0", "1 CHAR UTF-8", "0 @I1@ INDI", "1 NAME Jan /Lhoták/", "2 _STROM_STATUS proven", "2 _STROM_CONFIRMED 2026-01-15", "1 SEX M", "1 BIRT", "2 DATE 1850", "0 TRLR", ""].join("\n"));
    await w.ok(["intake", file], AGENT);
    const n = first(w, "P0001");
    assert.equal(n.status, undefined);
    assert.equal(n.confirmed, undefined);
  } finally {
    w.cleanup();
  }
});

/** The tree as an older strom left it: no name has a status, the fix not settled. */
function older(w: World): void {
  const tree = open(w);
  tree.withTreeLock(() => {
    const all = tree.list<Person>("person").map((p) => ({ ...p, names: p.names.map(({ status: _s, ...n }) => n) }));
    tree.putMany(all, [], { op: "tree.settle", targets: all.map((p) => p.id), summary: "as an older strom left it" }, (c) => {
      c.settled = (c.settled ?? []).filter((x) => x !== NAME_STATUS_SETTLED);
    });
    tree.commit("As an older strom left it");
  });
}

/**
 * The names of an older research: Jan (the original), Ян (a copy, Cyrillic), Anna (a family tree), Marie (the original,
 * confirmed), Eva (the original, the user's own), Josef (the original, the source the import that gave the name), and a
 * person of another program's family tree.
 */
async function olderTree(): Promise<World> {
  const w = await lhotaci();
  await w.ok(["cite", "P0001", "S0001", "--status", "proven"], AGENT);
  await w.ok(["person", "add", "Ян /Лхотак/", "--sex", "M", "--cite", "S0002"], AGENT); // P0002
  await w.ok(["person", "add", "Anna /Lhotová/", "--sex", "F", "--cite", "S0004"], AGENT); // P0003
  await w.ok(["person", "add", "Marie /Lhotová/".normalize("NFD"), "--sex", "F", "--cite", "S0001"], AGENT); // P0004
  await w.ok(["person", "add", "Eva /Lhotová/", "--sex", "F", "--cite", "S0001"], AGENT); // P0005
  await w.ok(["person", "add", "Josef /Lhoták/", "--sex", "M", "--cite", "S0001"], AGENT); // P0006
  confirm(w, "P0004");
  const tree = open(w);
  tree.withTreeLock(() => {
    for (const [id, origin] of [["P0005", { by: "user" }], ["P0006", { by: "import", source: "S0001" }]] as const) {
      const p = tree.get<Person>(id)!;
      tree.put({ ...p, names: [{ ...p.names[0]!, origin: origin as Name["origin"] }] }, { op: "person.edit", targets: [id], summary: "test" });
    }
    tree.commit("origins");
  });
  const file = path.join(w.dir, "lhotakovi.ged");
  fs.writeFileSync(file, ["0 HEAD", "1 SOUR MyHeritage", "2 VERS 8.0", "1 CHAR UTF-8", "0 @I1@ INDI", "1 NAME Karel /Lhoták/", "1 SEX M", "0 TRLR", ""].join("\n"));
  await w.ok(["intake", file], AGENT); // P0007
  older(w);
  return w;
}

test("the fix name-status: a name a record of the research's names becomes probable (never proven); a family tree's, an import's, a confirmed and the user's own stay; once, by itself; undo takes it off where nothing changed since", opts, async () => {
  const w = await olderTree();
  try {
    const tree = open(w);
    const karel = tree.list<Person>("person").find((p) => p.names[0]!.given === "Karel")!.id;
    assert.deepEqual(nameStatusFixes(tree).fixes.map((f) => `${f.person} ${f.to} ${f.sources.join(",")}`), ["P0001 probable S0001", "P0002 probable S0002"]);
    const shown = await w.ok(["fixes", "show", "name-status", "--json"], AGENT);
    assert.equal(shown.json.state, "pending");
    const n = commits(w);
    const done = settleNameStatus(open(w));
    assert.deepEqual(done, { changed: 2, records: 2 });
    assert.equal(commits(w), n + 1, "one commit");
    assert.equal(first(w, "P0001").status, "probable", "never proven, though it cites its original");
    assert.equal(first(w, "P0002").status, "probable");
    for (const id of ["P0003", "P0004", "P0005", "P0006", karel]) assert.equal(first(w, id).status, undefined, id);
    assert.ok(open(w).config.settled?.includes(NAME_STATUS_SETTLED));
    assert.equal(open(w).config.fixes?.["name-status"]?.decision, "fixed");
    // once
    assert.equal(settleNameStatus(open(w)), undefined);
    assert.equal(commits(w), n + 1);
    // one changed since stays as it is changed
    await w.ok(["cite", "P0002", "S0003", "--status", "possible"], AGENT);
    assert.equal((await w.run(["fixes", "undo", "name-status"], AGENT)).code, 4, "the person's own");
    const undone = await w.ok(["fixes", "undo", "name-status", "--lang", "en"], PERSON);
    assert.match(undone.out, /Status taken off: 1 name · 1 changed since, left as it is/u);
    assert.equal(first(w, "P0001").status, undefined);
    assert.equal(first(w, "P0002").status, "possible");
  } finally {
    w.cleanup();
  }
});

test("the fix name-status in an archive: set right by itself there too, said nothing of; a new research is settled from the start", opts, async () => {
  const w = await olderTree();
  try {
    await w.ok(["mode", "archive"], PERSON);
    const done = settleNameStatus(open(w));
    assert.equal(done?.changed, 2);
    assert.equal(first(w, "P0001").status, "probable");
    const list = await w.ok(["fixes", "--json"], PERSON);
    assert.ok(!list.json.checks.some((c: { id: string }) => c.id === "name-status"), "an archive says nothing of it");
    const fresh = new World();
    try {
      await fresh.withTree("Lhota");
      assert.ok(open(fresh).config.settled?.includes(NAME_STATUS_SETTLED));
      assert.equal(settleNameStatus(open(fresh)), undefined);
    } finally {
      fresh.cleanup();
    }
  } finally {
    w.cleanup();
  }
});
