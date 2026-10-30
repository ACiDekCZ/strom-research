// The name a person is shown by now (spec 024, GitHub strom #5): a woman born Lhotová, married Pěnkavová, divorced and
// back at her birth surname — the user marks the name (strom name primary), every other name stays, the identity stays
// the birth name. The Strom file says it with 2 _STROM_PRIMARY Y (the marked married name last: the app takes the last
// one as the married surname), the standard file puts the marked name first; a sync takes the user's choice from the
// app, a file without the mark changes nothing (from the app 3.18.0 on: the user chose none).

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";
import { validateGedcom } from "../../src/gedcom/validate.ts";
import { appKnowsPrimaryName, APP_KNOWS_PRIMARY_NAME } from "../../src/core/stromapp.ts";
import { Settings } from "../../src/core/config.ts";
import { BRIDGE_FEATURES } from "../../src/core/live.ts";
import { currentName, primaryName, displayName } from "../../src/core/people.ts";
import { validateRecord } from "../../src/core/validate.ts";
import type { Person } from "../../src/core/model.ts";

const opts = { skip: !hasGit };

type N = { given: string; surname: string; kind?: string; primary?: true };

/** Jana born Lhotová (P1, her baptism S1), married Pěnkavová (F1 with Petr Pěnkavík, P2). */
async function world(): Promise<World> {
  const w = new World();
  await w.withTree("Lhotovi");
  await w.ok(["source", "add", "Křest Jany 1931", "--kind", "baptism"]); // S1
  await w.ok(["person", "add", "Jana /Lhotová/", "--sex", "F", "--cite", "S1"]); // P1
  await w.ok(["name", "add", "P1", "Jana /Pěnkavová/", "--kind", "married"]);
  await w.ok(["person", "add", "Petr /Pěnkavík/", "--sex", "M"]); // P2
  await w.ok(["family", "add", "--partner", "P2", "--partner", "P1"]); // F1
  return w;
}

const names = async (w: World, id = "P0001"): Promise<N[]> => (await w.ok(["person", "show", id, "--json"])).json.person.names;
const shown = (ns: N[]) => ns.map((n) => `${n.surname}${n.primary ? "*" : ""}`);
const indi = (ged: string, id: string) => ged.split(/\n(?=0 )/).find((r) => r.startsWith("0 @") && r.includes(`\n1 REFN ${id}\n`))!;
/** Each 1 NAME of a record with its TYPE and mark. */
const nameLines = (block: string) => {
  const out: string[] = [];
  let inName = false;
  for (const l of block.split("\n")) {
    if (l.startsWith("1 ")) inName = l.startsWith("1 NAME ");
    if (inName && /^1 NAME |^2 TYPE |^2 _STROM_PRIMARY /u.test(l)) out.push(l);
  }
  return out;
};

async function exported(w: World, flavour: "strom" | "standard"): Promise<string> {
  const out = path.join(w.dir, `${flavour}-${Date.now()}.ged`);
  await w.ok(["export", "gedcom", "--for", flavour, ...(flavour === "strom" ? ["--images-for", "none"] : []), "--out", out]);
  return fs.readFileSync(out, "utf8");
}

test("name primary: the person shown by the name chosen, every name kept, the identity the birth name; --clear back; errors say what to run", opts, async () => {
  const w = await world();
  assert.match((await w.ok(["person", "show", "P1"])).out, /^P0001 Jana Lhotová/);
  const r = await w.ok(["name", "primary", "P1", "Jana /Pěnkavová/"]);
  assert.equal(r.code, 0);
  assert.deepEqual(shown(await names(w)), ["Lhotová", "Pěnkavová*"], "no name moves, none is added");
  const show = (await w.ok(["person", "show", "P1"])).out;
  assert.match(show, /^P0001 Jana Pěnkavová/);
  assert.match(show, /Jana Pěnkavová \(married\) · current/);
  // the issue's case: back at the birth surname
  await w.ok(["name", "primary", "P1", "Jana /Lhotová/", "--reason", "po rozvodu zpět rodné příjmení"]);
  assert.deepEqual(shown(await names(w)), ["Lhotová*", "Pěnkavová"]);
  assert.match((await w.ok(["person", "show", "P1"])).out, /^P0001 Jana Lhotová/);
  // the same again, both, neither, a name she lacks: refused, nothing written
  const again = await w.run(["name", "primary", "P1", "Jana /Lhotová/"]);
  assert.equal(again.code, 2);
  assert.match(again.err, /already/);
  assert.equal((await w.run(["name", "primary", "P1", "Jana /Lhotová/", "--clear"])).code, 2);
  const which = await w.run(["name", "primary", "P1"]);
  assert.equal(which.code, 2);
  assert.match(which.err, /"Jana \/Lhotová\/", "Jana \/Pěnkavová\/"/u, which.err);
  assert.equal((await w.run(["name", "primary", "P1", "Jana /Lhotová-Pěnkavová/"])).code, 2);
  await w.ok(["name", "primary", "P1", "--clear"]);
  assert.deepEqual(shown(await names(w)), ["Lhotová", "Pěnkavová"]);
  assert.equal((await w.run(["name", "primary", "P1", "--clear"])).code, 2, "nothing marked: nothing to clear");
  // the history says each
  const subjects = ((await w.ok(["history", "--json"])).json.commits as { subject: string }[]).map((c) => c.subject);
  assert.equal(subjects[0], "P0001 shown by Jana /Lhotová/ again (the mark of Jana /Lhotová/ taken off)");
  assert.ok(subjects.includes("P0001 shown by Jana /Pěnkavová/"), subjects.join("\n"));
  // a person's history says it in the research's language
  await w.ok(["lang", "cs"]);
  const log = (await w.ok(["history"])).out;
  assert.match(log, /Za hlavní zvoleno jméno: Jana Pěnkavová – Jana Lhotová/u, log);
  assert.match(log, /Za hlavní zase rodné jméno: Jana Lhotová – /u, log);
  assert.match((await w.ok(["check"])).out, /^ok/);
  w.cleanup();
});

test("name primary: decomposed input, a non-Latin script; name add --primary marks the name it adds or completes", opts, async () => {
  const w = await world();
  await w.ok(["name", "primary", "P1", "Jana /Pěnkavová/".normalize("NFD")]);
  assert.deepEqual(shown(await names(w)), ["Lhotová", "Pěnkavová*"]);
  // Cyrillic: added as shown, the mark passes from the other
  await w.ok(["name", "add", "P1", "Яна /Лхотова/".normalize("NFD"), "--kind", "alias", "--primary"]);
  const ns = await names(w);
  assert.deepEqual(shown(ns), ["Lhotová", "Pěnkavová", "Лхотова*"]);
  assert.equal(ns[2]!.surname, "Лхотова".normalize("NFC"), "stored in NFC");
  assert.match((await w.ok(["person", "show", "P1"])).out, /^P0001 Яна Лхотова/u);
  assert.match((await w.ok(["person", "show", "Яна Лхотова"])).out, /^P0001 /u, "found by the name shown");
  // a name without a surname completed by a marked one: the mark stays on the completed name
  await w.ok(["person", "add", "Lhotěnka", "--sex", "F"]); // P3
  await w.ok(["name", "add", "P3", "Lhotěnka /Lhotová/", "--primary"]);
  assert.deepEqual(shown(await names(w, "P0003")), ["Lhotová*"]);
  // the same name the person has: only marked
  await w.ok(["name", "add", "P1", "Jana /Lhotová/", "--primary"]);
  assert.deepEqual(shown(await names(w)), ["Lhotová*", "Pěnkavová", "Лхотова"]);
  assert.match((await w.ok(["check"])).out, /^ok/);
  w.cleanup();
});

test("the model: currentName shows, primaryName stays the identity; at most one mark", () => {
  const p = { id: "P0001", sex: "F", names: [{ given: "Jana", surname: "Lhotová", kind: "birth" }, { given: "Jana", surname: "Pěnkavová", kind: "married", primary: true }], events: [], notes: [] } as unknown as Person;
  assert.equal(primaryName(p).surname, "Lhotová");
  assert.equal(currentName(p).surname, "Pěnkavová");
  assert.match(displayName(p), /Pěnkavová/);
  const plain = { ...p, names: p.names.map(({ primary: _, ...n }) => n) } as Person;
  assert.equal(currentName(plain), primaryName(plain), "no mark: as before");
});

test("validate: a mark is true or left out, one per person", () => {
  const rec = (names: unknown[]) => ({ id: "P0001", type: "person", sex: "F", names, events: [], notes: [], created: "2026-10-29T00:00:00Z", updated: "2026-10-29T00:00:00Z" });
  const ok = rec([{ given: "Jana", surname: "Lhotová", kind: "birth" }, { given: "Jana", surname: "Pěnkavová", kind: "married", primary: true }]);
  assert.deepEqual(validateRecord(ok).filter((x) => x.path.startsWith("names")), []);
  const two = rec([{ given: "Jana", surname: "Lhotová", primary: true }, { given: "Jana", surname: "Pěnkavová", kind: "married", primary: true }]);
  assert.deepEqual(validateRecord(two).filter((x) => x.path.startsWith("names")).map((x) => x.path), ["names"]);
  const odd = rec([{ given: "Jana", surname: "Lhotová", primary: "yes" }]);
  assert.deepEqual(validateRecord(odd).filter((x) => x.path.startsWith("names")).map((x) => x.path), ["names[0].primary"]);
});

test("the Strom file: 2 _STROM_PRIMARY Y on the marked name, the identity first, a marked married name last; the standard file: the marked name first, no tag", opts, async () => {
  const w = await world();
  await w.ok(["name", "add", "P1", "Zdislava /Lhotová/", "--kind", "alias"]);
  // nothing marked: as before, no tag
  let ged = await exported(w, "strom");
  assert.doesNotMatch(ged, /_STROM_PRIMARY/);
  assert.deepEqual(nameLines(indi(ged, "P0001")), ["1 NAME Jana /Lhotová/", "2 TYPE birth", "1 NAME Jana /Pěnkavová/", "2 TYPE married", "1 NAME Zdislava /Lhotová/", "2 TYPE aka"].filter((l) => ged.includes(l)));
  // the birth name marked: the mark on the first NAME
  await w.ok(["name", "primary", "P1", "Jana /Lhotová/"]);
  ged = await exported(w, "strom");
  let lines = nameLines(indi(ged, "P0001"));
  assert.equal(lines[0], "1 NAME Jana /Lhotová/");
  assert.ok(lines.indexOf("2 _STROM_PRIMARY Y") > 0 && lines.indexOf("2 _STROM_PRIMARY Y") < lines.indexOf("1 NAME Jana /Pěnkavová/"), lines.join("|"));
  assert.equal(lines.filter((l) => l.includes("_STROM_PRIMARY")).length, 1);
  assert.deepEqual(validateGedcom(ged), []);
  // the married name marked: last, with the mark; the identity still first
  await w.ok(["name", "primary", "P1", "Jana /Pěnkavová/"]);
  ged = await exported(w, "strom");
  lines = nameLines(indi(ged, "P0001"));
  assert.equal(lines[0], "1 NAME Jana /Lhotová/");
  assert.deepEqual(lines.slice(-3), ["1 NAME Jana /Pěnkavová/", "2 TYPE married", "2 _STROM_PRIMARY Y"]);
  assert.deepEqual(validateGedcom(ged), []);
  // the export says the file is valid, with no warning of the mark
  const out = path.join(w.dir, "said.ged");
  const said = (await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", out])).out;
  assert.match(said, /^ {2}\p{L}+ GEDCOM 5\.5\.1$/mu, said); // the research language's "valid", no count of warnings
  assert.doesNotMatch(said, /_STROM_PRIMARY/u, said);
  // the standard file: the name shown first, no tag of ours
  const std = await exported(w, "standard");
  assert.doesNotMatch(std, /_STROM_PRIMARY/);
  const first = /\n1 NAME (.+)/.exec(std.split(/\n(?=0 )/).find((r) => r.includes("Lhotová") && r.includes("INDI"))!)![1];
  assert.equal(first, "Jana /Pěnkavová/");
  w.cleanup();
});

/** What the research gives the app: its Strom file; asApp: as the app sends it back (SOUR STROM, its version). */
const given = (w: World) => exported(w, "strom");
const asApp = (t: string, version?: string) => t.replace("1 SOUR STROM_RESEARCH", version ? `1 SOUR STROM\n2 VERS ${version}` : "1 SOUR STROM");
const send = (w: World, t: string) => {
  const f = path.join(w.dir, `app-${Date.now()}-${Math.random().toString(36).slice(2)}.ged`);
  fs.writeFileSync(f, t);
  return f;
};
const unmark = (t: string) => t.replace(/\n2 _STROM_PRIMARY Y/g, "");
const markOn = (t: string, name: string) => unmark(t).replace(new RegExp(`(\\n1 NAME ${name.replace(/[/]/g, "\\/")}\\n(?:2 (?!_STROM_PRIMARY).*\\n)*)`, "u"), "$12 _STROM_PRIMARY Y\n");

test("sync: the name the user chose in the app taken (corrected, said), undone as it was; sent back unchanged nothing", opts, async () => {
  const w = await world();
  const t = asApp(await given(w), "3.17.0");
  // the app marks her married name
  const file = send(w, markOn(t, "Jana /Pěnkavová/"));
  const plan = (await w.ok(["sync", file, "--json"])).json.changes as { kind: string; action: string; person?: string; shown?: unknown }[];
  assert.deepEqual(plan.map((c) => [c.kind, c.action, c.person]), [["name.shown", "correct", "P0001"]], JSON.stringify(plan));
  const human = (await w.ok(["sync", file], { tty: true })).out;
  assert.match(human, /hlavní jméno — nezvoleno → Jana Pěnkavová → osoba se ukazuje tímto jménem/u, human);
  const input = (await w.ok(["sync", file, "--apply", "--json"])).json.input as string;
  assert.deepEqual(shown(await names(w)), ["Lhotová", "Pěnkavová*"]);
  // the research's file now says it; given back unchanged: nothing
  const again = asApp(await given(w), "3.17.0");
  assert.match(again, /_STROM_PRIMARY Y/);
  assert.deepEqual((await w.ok(["sync", send(w, again), "--json"])).json.changes, []);
  // then back at the birth surname in the app (the issue's case, there and back)
  const back = send(w, markOn(again, "Jana /Lhotová/"));
  await w.ok(["sync", back, "--apply"]);
  assert.deepEqual(shown(await names(w)), ["Lhotová*", "Pěnkavová"]);
  const exp = nameLines(indi(await given(w), "P0001"));
  assert.equal(exp[0], "1 NAME Jana /Lhotová/");
  assert.ok(exp.indexOf("2 _STROM_PRIMARY Y") < exp.indexOf("1 NAME Jana /Pěnkavová/"), exp.join("|"));
  // undone: as it was before the first sync
  await w.ok(["sync", "undo", input]);
  assert.ok(!(await names(w)).some((n) => n.primary && n.surname === "Pěnkavová"), "the first send undone");
  assert.match((await w.ok(["check"])).out, /^ok/);
  w.cleanup();
});

test("sync: an older app's file without the mark changes nothing — the research's mark stays; a file from before any mark the same", opts, async () => {
  const w = await world();
  await w.ok(["name", "primary", "P1", "Jana /Lhotová/"]);
  const t = await given(w);
  // the app of today (3.17) keeps no tag it does not know: the mark is gone from what it sends
  for (const v of ["3.17.0", undefined]) {
    const file = send(w, unmark(asApp(t, v)));
    assert.deepEqual((await w.ok(["sync", file, "--json"])).json.changes, [], `app ${v ?? "unknown"}`);
    await w.ok(["sync", file, "--apply"]);
    assert.deepEqual(shown(await names(w)), ["Lhotová*", "Pěnkavová"]);
  }
  // the gate: from the app 3.18.0 on a missing mark is the user's "none"; an older app, or one that says no version, not
  const prod = new Settings({ STROM_APP_URL: "https://stromapp.info/run/" }, {});
  const beta = new Settings({ STROM_APP_URL: "https://beta.stromapp.info/run/" }, {});
  assert.equal(APP_KNOWS_PRIMARY_NAME, "3.18.0");
  for (const v of [undefined, "", "3.17.1", "3.18.0-beta.6", "neznámá"]) assert.equal(appKnowsPrimaryName(prod, v), false, String(v));
  for (const v of ["3.18.0", "3.18.1", "4.0.0"]) assert.equal(appKnowsPrimaryName(prod, v), true, v);
  // another copy of the app (its beta) from the first beta that writes the mark
  for (const v of [undefined, "3.17.1", "3.18.0-beta.1"]) assert.equal(appKnowsPrimaryName(beta, v), false, String(v));
  for (const v of ["3.18.0-beta.2", "3.18.0-beta.6", "3.18.0"]) assert.equal(appKnowsPrimaryName(beta, v), true, v);
  assert.ok((BRIDGE_FEATURES as readonly string[]).includes("person.primary"));
  w.cleanup();
});

test("sync: the app 3.18.0's file without the mark is the user's 'none' — the research's mark taken off, undone as it was", opts, async () => {
  const w = await world();
  await w.ok(["name", "primary", "P1", "Jana /Pěnkavová/"]);
  const t = await given(w);
  // sent back unchanged (the mark kept): nothing
  assert.deepEqual((await w.ok(["sync", send(w, asApp(t, "3.18.0")), "--json"])).json.changes, []);
  // the user chose no name in the app: the mark missing
  const file = send(w, unmark(asApp(t, "3.18.0")));
  const plan = (await w.ok(["sync", file, "--json"])).json.changes as { kind: string; action: string; person?: string; shown?: { theirs: string } }[];
  assert.deepEqual(plan.map((c) => [c.kind, c.action, c.person, c.shown?.theirs]), [["name.shown", "correct", "P0001", "none"]], JSON.stringify(plan));
  const input = (await w.ok(["sync", file, "--apply", "--json"])).json.input as string;
  assert.deepEqual(shown(await names(w)), ["Lhotová", "Pěnkavová"]);
  await w.ok(["sync", "undo", input]);
  assert.deepEqual(shown(await names(w)), ["Lhotová", "Pěnkavová*"]);
  assert.match((await w.ok(["check"])).out, /^ok/);
  w.cleanup();
});

test("sync: the research's file without a mark is 'none chosen' — a mark the research took off since is not put back; without a head only a mark where none is", opts, async () => {
  const w = await world();
  await w.ok(["name", "primary", "P1", "Jana /Pěnkavová/"]);
  const t = await given(w);
  await w.ok(["name", "primary", "P1", "--clear"]);
  // the app sends the copy it was given with the mark unchanged: the research's clearing stands
  assert.deepEqual((await w.ok(["sync", send(w, asApp(t, "3.17.0")), "--json"])).json.changes, []);
  // without a head (another tree adopted): the mark where none is, an addition
  const headless = asApp(t, "3.17.0").replace(/\n1 _STROM_HEAD .*/u, "");
  const plan = (await w.ok(["sync", send(w, headless), "--json"])).json.changes as { kind: string; action: string }[];
  assert.deepEqual(plan.filter((c) => c.kind === "name.shown").map((c) => c.action), ["add"], JSON.stringify(plan));
  w.cleanup();
});

test("sync: changed in the app and by the research since the copy was given — a conflict of the name shown, decided by --take; sync.edits user takes the user's", opts, async () => {
  const w = await world();
  const t = asApp(await given(w), "3.17.0");
  await w.ok(["name", "primary", "P1", "Jana /Lhotová/"]); // the research
  const file = send(w, markOn(t, "Jana /Pěnkavová/")); // the user
  const r = (await w.ok(["sync", file, "--apply", "--json"])).json;
  assert.equal(r.conflicts?.length, 1, JSON.stringify(r));
  const x = r.conflicts[0] as { id: string; fact: string };
  assert.equal(x.fact, "NAME");
  assert.deepEqual(shown(await names(w)), ["Lhotová*", "Pěnkavová"], "nothing changed before it is decided");
  const c = (await w.ok(["conflict", "show", x.id, "--json"])).json.conflict as { primary?: true; claims: { value: string }[] };
  assert.equal(c.primary, true);
  assert.deepEqual(c.claims.map((k) => k.value).sort(), ["Jana /Lhotová/", "Jana /Pěnkavová/"]);
  // the app is told it as a conflict of the name it may decide by side
  const x1 = /\n1 _STROM_CONFLICT X0001\n(?:[2-9] .*\n)*/u.exec(indi(await given(w), "P0001") + "\n")![0];
  assert.match(x1, /\n2 TYPE NAME\n/);
  assert.match(x1, /\n2 _STROM_TAKE Y\n/);
  assert.match(x1, /\n2 VAL Jana Pěnkavová\n3 [\s\S]*_STROM_SIDE user/u, x1);
  await w.ok(["conflict", "resolve", x.id, "--take", "user", "--reasoning", "rozvedená, zase Pěnkavová"]);
  assert.deepEqual(shown(await names(w)), ["Lhotová", "Pěnkavová*"]);
  assert.match((await w.ok(["check"])).out, /^ok/);
  w.cleanup();
  // the user's word wins: written at once
  const w2 = await world();
  await w2.ok(["config", "set", "sync.edits", "user"], { tty: true });
  const t2 = asApp(await given(w2), "3.17.0");
  await w2.ok(["name", "primary", "P1", "Jana /Lhotová/"]);
  await w2.ok(["sync", send(w2, markOn(t2, "Jana /Pěnkavová/")), "--apply"]);
  assert.deepEqual(shown(await names(w2)), ["Lhotová", "Pěnkavová*"]);
  w2.cleanup();
});

test("retract and restore: a marked name taken back leaves none marked; restored beside another mark it comes back unmarked", opts, async () => {
  const w = await world();
  await w.ok(["name", "primary", "P1", "Jana /Pěnkavová/"]);
  await w.ok(["name", "retract", "P1", "Jana /Pěnkavová/", "--reason", "a misread"]);
  assert.deepEqual(shown(await names(w)), ["Lhotová"]);
  assert.match((await w.ok(["person", "show", "P1"])).out, /^P0001 Jana Lhotová/);
  await w.ok(["name", "add", "P1", "Zdislava /Lhotová/", "--kind", "alias", "--primary"]);
  await w.ok(["name", "restore", "P1", "Jana /Pěnkavová/", "--reason", "the record has it after all"]);
  assert.deepEqual(shown(await names(w)), ["Lhotová", "Lhotová*", "Pěnkavová"]);
  assert.match((await w.ok(["check"])).out, /^ok/);
  w.cleanup();
});

test("merge: the kept person's mark wins; the duplicate's carries over only where the kept one has none", opts, async () => {
  const w = await world();
  await w.ok(["person", "add", "Jana /Pěnkavová/", "--sex", "F"]); // P3, the duplicate
  await w.ok(["name", "add", "P3", "Jana /Lhotová/", "--kind", "birth"]);
  await w.ok(["name", "primary", "P3", "Jana /Pěnkavová/"]);
  await w.ok(["person", "merge", "P1", "P3", "--reason", "the same woman"]);
  let ns = await names(w);
  assert.equal(ns.filter((n) => n.primary).length, 1);
  assert.equal(ns.find((n) => n.primary)!.surname, "Pěnkavová");
  // a kept person with her own mark keeps it
  await w.ok(["name", "primary", "P1", "Jana /Lhotová/"]);
  await w.ok(["person", "add", "Jana /Lhotová/", "--sex", "F"]); // P4
  await w.ok(["name", "add", "P4", "Jana /Pěnkavová/", "--kind", "married", "--primary"]);
  await w.ok(["person", "merge", "P1", "P4", "--reason", "the same woman again"]);
  ns = await names(w);
  assert.deepEqual(ns.filter((n) => n.primary).map((n) => n.surname), ["Lhotová"]);
  assert.match((await w.ok(["check"])).out, /^ok/);
  w.cleanup();
});

test("sync from the app's JSON: primaryName birth or married, as in its GEDCOM; missing says nothing", opts, async () => {
  const w = await world();
  const id = JSON.parse(fs.readFileSync(path.join(w.cwd, "strom.json"), "utf8")).id;
  const person = (extra: Record<string, unknown>) => ({ id: "a", firstName: "Jana", lastName: "Lhotová", marriedSurname: "Pěnkavová", gender: "female", refn: "P0001", ...extra });
  const json = (extra: Record<string, unknown>) => {
    const f = path.join(w.dir, `strom-${Math.random().toString(36).slice(2)}.json`);
    fs.writeFileSync(f, JSON.stringify({ version: 12, research: { id }, persons: { a: person(extra) }, partnerships: {} }));
    return f;
  };
  const kinds = async (f: string) => ((await w.ok(["sync", f, "--json"])).json.changes as { kind: string; action: string }[]).filter((c) => c.kind === "name.shown").map((c) => c.action);
  assert.deepEqual(await kinds(json({})), []);
  assert.deepEqual(await kinds(json({ primaryName: "nonsense" })), []);
  assert.deepEqual(await kinds(json({ primaryName: "married" })), ["add"]);
  await w.ok(["sync", json({ primaryName: "married" }), "--apply"]);
  assert.deepEqual(shown(await names(w)), ["Lhotová", "Pěnkavová*"]);
  w.cleanup();
});

test("sync: the married surname changed in the app while shown by it — the new name added and shown, the old one gone where no record gives it", opts, async () => {
  const w = await world();
  await w.ok(["name", "primary", "P1", "Jana /Pěnkavová/"]);
  const t = asApp(await given(w), "3.17.0").replace("1 NAME Jana /Pěnkavová/", "1 NAME Jana /Brkoslavová/");
  const plan = (await w.ok(["sync", send(w, t), "--json"])).json.changes as { kind: string; action: string }[];
  assert.deepEqual(plan.map((c) => [c.kind, c.action]), [["name.new", "add"], ["name.gone", "remove"], ["name.shown", "correct"]]);
  await w.ok(["sync", send(w, t), "--apply"]);
  assert.deepEqual(shown(await names(w)), ["Lhotová", "Brkoslavová*"]);
  assert.match((await w.ok(["check"])).out, /^ok/);
  w.cleanup();
});

test("a tree taken in (intake): the mark of the Strom file kept on the name it marks, one per person", opts, async () => {
  const w = new World();
  await w.withTree("Lhotovi");
  const f = path.join(w.dir, "lhotovi.ged");
  fs.writeFileSync(f, ["0 HEAD", "1 SOUR STROM", "1 GEDC", "2 VERS 5.5.1", "1 CHAR UTF-8",
    "0 @I1@ INDI", "1 NAME Jana /Lhotová/", "1 NAME Jana /Pěnkavová/", "2 TYPE married", "2 _STROM_PRIMARY Y", "1 SEX F",
    "0 @I2@ INDI", "1 NAME Lhotěnka /Lhotová/", "2 _STROM_PRIMARY Y", "1 NAME Lhotěnka /Brkoslavová/", "2 TYPE married", "2 _STROM_PRIMARY Y", "1 SEX F",
    "0 TRLR", ""].join("\n"));
  await w.ok(["intake", f]);
  const people = (await w.ok(["person", "list", "--json", "--full"])).json.persons as { names: N[] }[];
  assert.deepEqual(people.map((p) => shown(p.names)), [["Lhotová", "Pěnkavová*"], ["Lhotová*", "Brkoslavová"]]);
  assert.match((await w.ok(["check"])).out, /^ok/);
  w.cleanup();
});
