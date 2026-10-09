// A conflict of the user's edit decided from the Strom app by side (conflict.decide, the app's
// ZADANI_VYZKUM_rozpory-v-aplikaci.md, phase 1): the Strom file says which conflicts the app may decide and each value's
// side (_STROM_TAKE, _STROM_SIDE, _STROM_RAW — an empty side empty), /sync says them too; the bridge decides one as the
// user's (POST /conflict/<X…>), the same as strom conflict resolve --take; a decided conflict is not decided over, and
// what the user decided stands against an agent that has no new source.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { World, hasGit, readJsonFile } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import { exportGedcom } from "../../src/gedcom/export.ts";
import { validateGedcom } from "../../src/gedcom/validate.ts";
import { appDecidesConflicts, APP_DECIDES_CONFLICTS } from "../../src/core/stromapp.ts";
import { Settings } from "../../src/core/config.ts";
import { BRIDGE_FEATURES } from "../../src/core/live.ts";
import { sidesOf } from "../../src/core/conflicts.ts";
import { reviewProposals } from "../../src/core/review.ts";
import type { Conflict, Person, Research, Task } from "../../src/core/model.ts";
import { get, post } from "./sync.helpers.ts";

const opts = { skip: !hasGit };
const bridged = { skip: !hasGit || process.platform === "win32" };
const app = { Origin: "https://beta.stromapp.info", "Content-Type": "application/json" };

type Ev = { id: string; kind: string; date?: string; status: string; retracted?: unknown };

/**
 * Josef (P1: "Ing.", his name and baptism from S1), Anna (P2, her name from S2), married (F1, S2); a conflict of the
 * sources (X1). The app sends: the baptism a day later (X2), the title taken off (X3), the sex (X4), Anna's surname (X5),
 * the marriage a day later (X6) — each the user's to decide.
 */
async function world(): Promise<{ w: World; sent: string }> {
  const w = new World();
  await w.withTree();
  await w.ok(["lang", "cs"]);
  await w.ok(["source", "add", "Křest Josefa Nováka 1885", "--kind", "baptism", "--transcript", "Josef, syn Jana Nováka."]); // S1
  await w.ok(["source", "add", "Sňatek Josefa a Anny 1910", "--kind", "marriage"]); // S2
  await w.ok(["person", "add", "Josef /Novák/", "--sex", "M", "--prefix", "Ing.", "--cite", "S1"]); // P1
  await w.ok(["event", "add", "P1", "CHR", "--date", "3 MAR 1885", "--place", "Kamenice", "--cite", "S1"]);
  await w.ok(["person", "add", "Anna /Dvořáková/", "--sex", "F", "--cite", "S2"]); // P2
  await w.ok(["family", "add", "--partner", "P1", "--partner", "P2"]); // F1
  await w.ok(["event", "add", "F1", "MARR", "--date", "5 FEB 1910", "--place", "Týnec", "--cite", "S2"]);
  await w.ok(["conflict", "add", "Rok narození Josefa", "--about", "P1", "--fact", "BIRT", "--claim", "S1: 1885", "--claim", "S2: 1884"]); // X1
  const out = path.join(w.dir, "given.ged");
  await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", out]);
  let t = fs.readFileSync(out, "utf8");
  t = t.replace("2 DATE 3 MAR 1885", "2 DATE 4 MAR 1885");
  t = t.replace(/1 NAME Ing\. Josef \/Novák\/\n2 NPFX Ing\.\n/, "1 NAME Josef /Novák/\n");
  t = t.replace(/(1 NAME Josef \/Novák\/\n(?:[2-9].*\n)*1 SEX )M/, "$1F");
  t = t.replace("1 NAME Anna /Dvořáková/", "1 NAME Anna /Dvořáčková/");
  t = t.replace("2 DATE 5 FEB 1910", "2 DATE 6 FEB 1910");
  const sent = path.join(w.dir, "app.ged");
  fs.writeFileSync(sent, t);
  return { w, sent };
}

const block = (ged: string, id: string) => ged.split(/\n(?=0 )/).find((r) => r.startsWith(`0 @${id}@ INDI`))!;
const conflictOf = (ged: string, person: string, id: string) => new RegExp(`\\n1 _STROM_CONFLICT ${id}\\n((?:[2-9] .*\\n|[2-9] [A-Z_]+\\n)*)`).exec(block(ged, person) + "\n")?.[1] ?? "";
const facts = async (w: World, id: string, kind: string): Promise<Ev[]> => ((await w.ok(["person", "show", id, "--json"])).json.person.events as Ev[]).filter((e) => e.kind === kind && !e.retracted);
const conflict = async (w: World, id: string): Promise<Conflict> => (await w.ok(["conflict", "show", id, "--json"])).json.conflict;

test("the Strom file: the conflicts the app decides by side — _STROM_TAKE, each value's _STROM_SIDE (an empty one empty), a sex's _STROM_RAW; never a conflict of sources, never the standard file", opts, async () => {
  const { w, sent } = await world();
  const r = (await w.ok(["sync", sent, "--apply", "--json"])).json;
  // /sync: each conflict with its sides (the title taken off: "" for the user's)
  assert.deepEqual(
    r.conflicts.map((c: { id: string; fact: string; take?: boolean; sides?: unknown; raw?: unknown; person?: string; family?: string }) => [c.id, c.fact, c.take, c.sides, c.raw, c.person, c.family]),
    [
      ["X0002", "CHR", true, { user: "4. 3. 1885, Kamenice", research: "3. 3. 1885, Kamenice" }, undefined, "P0001", undefined],
      ["X0003", "NPFX", true, { user: "", research: "Ing." }, undefined, "P0001", undefined],
      ["X0004", "SEX", true, { user: "žena", research: "muž" }, { user: "F", research: "M" }, "P0001", undefined],
      ["X0005", "NAME", true, { user: "Anna Dvořáčková", research: "Anna Dvořáková" }, undefined, "P0002", undefined],
      ["X0006", "MARR", true, { user: "6. 2. 1910, Týnec", research: "5. 2. 1910, Týnec" }, undefined, "P0001", "F0001"],
    ],
  );
  // the same in /status.sends is the same function (syncConflicts); the research is whole with an empty value
  assert.match((await w.ok(["check"])).out, /^ok/);

  const tree = Tree.open(w.cwd, w.env);
  const ged = exportGedcom(tree, { for: "strom", research: true, conflictSides: true }).text;
  assert.deepEqual(validateGedcom(ged), []);
  assert.equal(conflictOf(ged, "P0001", "X0001"), "2 TYPE BIRT\n2 TITL Rok narození Josefa\n2 STAT open\n2 VAL 1885\n3 SOUR @S0001@\n2 VAL 1884\n3 SOUR @S0002@\n", "a conflict of sources: as before");
  assert.match(conflictOf(ged, "P0001", "X0002"), /^2 TYPE CHR\n2 TITL .*\n2 STAT open\n2 _STROM_TAKE Y\n2 VAL 3\. 3\. 1885, Kamenice\n3 SOUR @S0001@\n3 _STROM_SIDE research\n2 VAL 4\. 3\. 1885, Kamenice\n3 _STROM_SIDE user\n$/);
  assert.match(conflictOf(ged, "P0001", "X0003"), /^2 TYPE NPFX\n2 TITL .*\n2 STAT open\n2 _STROM_TAKE Y\n2 VAL Ing\.\n3 SOUR @S0001@\n3 _STROM_SIDE research\n2 VAL\n3 _STROM_SIDE user\n$/, "the title taken off: VAL alone, with its side");
  assert.match(conflictOf(ged, "P0001", "X0004"), /^2 TYPE SEX\n2 TITL .*\n2 STAT open\n2 _STROM_TAKE Y\n2 VAL muž\n3 _STROM_SIDE research\n3 _STROM_RAW M\n2 VAL žena\n3 _STROM_SIDE user\n3 _STROM_RAW F\n$/);
  assert.match(conflictOf(ged, "P0002", "X0005"), /^2 TYPE NAME\n2 TITL .*\n2 STAT open\n2 _STROM_TAKE Y\n2 VAL Anna Dvořáková\n3 SOUR @S0002@\n3 _STROM_SIDE research\n2 VAL Anna Dvořáčková\n3 _STROM_SIDE user\n$/);
  // a couple's: under both partners, the same
  for (const p of ["P0001", "P0002"]) assert.match(conflictOf(ged, p, "X0006"), /^2 TYPE MARR\n2 TITL .*\n2 STAT open\n2 _STROM_TAKE Y\n2 VAL 5\. 2\. 1910, Týnec\n3 SOUR @S0002@\n3 _STROM_SIDE research\n/);
  // an app that does not decide: as before (the empty side a dash, as a person reads it)
  const before = exportGedcom(tree, { for: "strom", research: true }).text;
  assert.doesNotMatch(before, /_STROM_TAKE|_STROM_SIDE|_STROM_RAW|\n2 VAL\n/);
  assert.match(conflictOf(before, "P0001", "X0003"), /\n2 VAL —\n/);
  assert.doesNotMatch(exportGedcom(tree, { for: "standard", research: true, conflictSides: true }).text, /_STROM_CONFLICT|_STROM_TAKE|_STROM_SIDE/);

  // decided: no _STROM_TAKE (nothing to decide), its sides still said
  await w.ok(["conflict", "resolve", "X2", "--take", "research", "--reasoning", "zápis je jasný"]);
  const decided = exportGedcom(Tree.open(w.cwd, w.env), { for: "strom", research: true, conflictSides: true }).text;
  assert.match(conflictOf(decided, "P0001", "X0002"), /^2 TYPE CHR\n2 TITL .*\n2 STAT decided\n2 VAL 3\. 3\. 1885, Kamenice\n3 SOUR @S0001@\n3 _STROM_SIDE research\n2 VAL 4\. 3\. 1885, Kamenice\n3 _STROM_SIDE user\n2 DECI 3\. 3\. 1885, Kamenice\n$/);

  // a child's parents (FAMC) and a fact's detail or people: --take may, the app does not (phase 1)
  const famc = { type: "conflict", fact: "FAMC", subject: ["P0001"], claims: [{ value: "a", note: "the research: F0001" }, { value: "b", note: "the user's edit" }], parents: { child: "P0001", from: "F0001", partners: [] }, state: "open" } as unknown as Conflict;
  assert.equal(sidesOf(famc), undefined);
  const detail = { ...famc, fact: "CHR", parents: undefined } as unknown as Conflict;
  assert.equal(sidesOf(detail), undefined, "a detail's conflict has no edit");
  w.cleanup();
});

test("a Strom file carrying the sides comes back through strom sync as no change", opts, async () => {
  const { w, sent } = await world();
  await w.ok(["sync", sent, "--apply"]);
  await w.ok(["conflict", "resolve", "X4", "--take", "research", "--reasoning", "matrika"]);
  const out = path.join(w.dir, "back.ged");
  await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", out], { env: { STROM_APP_URL: "https://beta.stromapp.info/run/" } });
  const text = fs.readFileSync(out, "utf8");
  assert.match(text, /\n2 _STROM_TAKE Y\n/);
  assert.match(text, /\n2 VAL\n3 _STROM_SIDE user\n/);
  assert.match(text, /\n3 _STROM_RAW M\n/);
  assert.deepEqual((await w.ok(["sync", out, "--json"])).json.changes, []);
  w.cleanup();
});

test("the gate: the beta and the development copy of the app at once; stromapp.info from the version that decides; the bridge says conflict.decide", opts, async () => {
  const w = new World();
  await w.withTree();
  const prod = new Settings({ ...w.env, STROM_APP_URL: "https://stromapp.info/run/" }, {});
  const beta = new Settings({ ...w.env, STROM_APP_URL: "https://beta.stromapp.info/run/" }, {});
  assert.equal(appDecidesConflicts(beta), true);
  assert.equal(appDecidesConflicts(beta, "3.10.1"), true);
  assert.equal(appDecidesConflicts(prod, "3.10.1"), APP_DECIDES_CONFLICTS !== undefined && APP_DECIDES_CONFLICTS <= "3.10.1");
  assert.equal(appDecidesConflicts(prod), APP_DECIDES_CONFLICTS !== undefined, "an app of unknown version: today's, once released");
  assert.ok((BRIDGE_FEATURES as readonly string[]).includes("conflict.decide"));
  w.cleanup();
});

test("take user with the user's empty value: the title goes; take research keeps it", opts, async () => {
  const { w, sent } = await world();
  await w.ok(["sync", sent, "--apply"]);
  await w.ok(["conflict", "resolve", "X3", "--take", "user", "--reasoning", "titul neměl"]);
  const p = (await w.ok(["person", "show", "P1", "--json"])).json.person as Person;
  assert.equal(p.names[0]!.prefix, undefined, "the title taken off");
  assert.equal((await conflict(w, "X3")).taken, "user");
  // the research's: the name keeps it
  const again = await world();
  await again.w.ok(["sync", again.sent, "--apply"]);
  await again.w.ok(["conflict", "resolve", "X3", "--take", "research", "--reasoning", "matrika"]);
  assert.equal(((await again.w.ok(["person", "show", "P1", "--json"])).json.person as Person).names[0]!.prefix, "Ing.");
  w.cleanup();
  again.w.cleanup();
});

test("conflict resolve: a decided conflict is not decided over — again only with --reason; the user's decision stands against an agent without a new source; nor does an agent open it again", opts, async () => {
  const { w, sent } = await world();
  await w.ok(["sync", sent, "--apply"]);
  await w.ok(["source", "add", "Úmrtí Josefa 1950", "--kind", "death"]); // S3 (S0003 is the app's edits)
  const s3 = ((await w.ok(["source", "list", "--json"])).json.sources as { id: string; title: string }[]).find((s) => s.title.startsWith("Úmrtí"))!.id;
  // the user decides at a terminal: the user's value written, who and when kept
  await w.ok(["conflict", "resolve", "X2", "--take", "user", "--reasoning", "rodinná bible"]);
  const x = await conflict(w, "X2");
  assert.deepEqual([x.state, x.taken, x.decidedBy, x.decidedIn], ["resolved", "user", "user", undefined]);
  assert.ok(x.decidedAt);
  assert.deepEqual((await facts(w, "P1", "CHR")).map((e) => [e.date, e.status]), [["4 MAR 1885", "possible"]]);
  // decided over: refused, the decision named
  const over = await w.run(["conflict", "resolve", "X2", "--resolution", "3 MAR 1885", "--reasoning", "matrika", "--json"]);
  assert.notEqual(over.code, 0);
  assert.equal(JSON.parse(over.out).code, "conflict.decided");
  assert.match(JSON.parse(over.out).message, /X0002 is decided already: "4\. 3\. 1885, Kamenice" — the user's decision/);
  // a side once taken is not taken again
  const retake = await w.run(["conflict", "resolve", "X2", "--take", "research", "--reasoning", "matrika", "--reason", "omyl", "--json"]);
  assert.equal(JSON.parse(retake.out).code, "conflict.taken");
  // an agent: a reason is not enough, nor a source the decision weighed; a new one is
  const agent = { env: { AI_AGENT: "1" } };
  const old = await w.run(["conflict", "resolve", "X2", "--resolution", "3 MAR 1885", "--reasoning", "matrika", "--reason", "znovu", "--source", "S1", "--json"], agent);
  assert.equal(JSON.parse(old.out).code, "conflict.user-decided");
  const none = await w.run(["conflict", "resolve", "X2", "--resolution", "3 MAR 1885", "--reasoning", "matrika", "--reason", "znovu", "--json"], agent);
  assert.equal(JSON.parse(none.out).code, "conflict.user-decided");
  // …nor open it again with the record it weighed
  const reopened = await w.run(["conflict", "add", "Datum křtu Josefa", "--about", "P1", "--fact", "CHR", "--claim", "S1: 3 MAR 1885", "--claim", "4 MAR 1885", "--reason", "matrika", "--json"], agent);
  assert.equal(JSON.parse(reopened.out).code, "conflict.user-decided");
  // the user decides again with a reason; an agent with a new source and a reason: the earlier decision kept in a note
  await w.ok(["conflict", "resolve", "X2", "--resolution", "4 MAR 1885", "--reasoning", "potvrzeno", "--reason", "rodinná bible znovu"]);
  await w.ok(["conflict", "resolve", "X2", "--resolution", "3 MAR 1885", "--reasoning", "úmrtní zápis uvádí den křtu", "--reason", "nový zápis", "--source", s3], agent);
  const y = await conflict(w, "X2");
  assert.equal(y.decidedBy, "agent");
  assert.match(y.notes.map((n) => n.text).join("\n"), /earlier decided by the user: 4 MAR 1885 — potvrzeno\n.*decided again on S0004: nový zápis/);
  // a new conflict of the fact on a new source: with a reason, an agent may
  await w.ok(["conflict", "add", "Datum křtu Josefa", "--about", "P1", "--fact", "CHR", "--claim", `${s3}: 2 MAR 1885`, "--claim", "4 MAR 1885", "--reason", "úmrtní zápis"], agent);
  w.cleanup();
});

test("review: a record the user decided against is no mention to read again", opts, async () => {
  const w = new World();
  await w.withTree();
  await w.ok(["lang", "cs"]);
  await w.ok(["source", "add", "Křest Josefa Nováka 1885", "--kind", "baptism", "--transcript", "Josef Novák, syn Jana Nováka."]); // S1
  await w.ok(["person", "add", "Josef /Novák/", "--sex", "M"]); // P1, his name from no record
  await w.ok(["event", "add", "P1", "CHR", "--date", "3 MAR 1885", "--cite", "S1"]);
  const out = path.join(w.dir, "given.ged");
  await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", out]);
  // the day moved, the record no longer cited by it (the user's own knowledge)
  fs.writeFileSync(out, fs.readFileSync(out, "utf8").replace(/(1 (?:CHR|BAPM)\n2 DATE )3 MAR 1885\n((?:[2-9] .*\n)*)/, (_m, a: string, rest: string) => `${a}4 MAR 1885\n${rest.replace(/^2 SOUR @S0001@\n(?:[3-9] .*\n)*/m, "")}`));
  await w.ok(["sync", out, "--apply"]);
  await w.ok(["conflict", "resolve", "X1", "--take", "user", "--reasoning", "rodinná bible"]);
  await w.ok(["review", "P1"]);
  const tree = Tree.open(w.cwd, w.env);
  const research = tree.list<Research>("research").find((r) => r.direction === "person")!;
  assert.deepEqual(tree.get<Person>("P0001")!.events.filter((e) => !e.retracted).map((e) => e.citations.map((c) => c.source)), [["S0002"]], "the user's fact cites the app's edits only");
  const kinds = reviewProposals(tree, research).map((p) => p.origin);
  const tasks = tree.list<Task>("task").map((t) => t.origin);
  assert.ok(![...kinds, ...tasks].includes("review:mentions"), `${[...kinds, ...tasks].join(", ")}: S1 was weighed by the user's decision`);
  w.cleanup();
});

test("the bridge decides a conflict as the user's: take user written, take research a commit of the decision; refused: decided, none, not by side, not the app's pages, a bad body", bridged, async () => {
  const { w, sent } = await world();
  await w.ok(["sync", sent, "--apply"]);
  await w.ok(["config", "set", "strom.app.url", "https://beta.stromapp.info/run/"]);
  const info = (await w.ok(["live", "start", "--json"])).json;
  try {
    const decide = (id: string, body: unknown, headers: Record<string, string> = app) => post(`${info.url}/conflict/${id}`, JSON.stringify(body), headers);
    const status = JSON.parse((await get(`${info.url}/status?poll=1`)).body);
    assert.ok(status.features.includes("conflict.decide"));
    const head0 = status.headAt;

    // the user's value, with a note: written as the user's, through the app
    const u = await decide("X0002", { do: "decide", take: "user", note: "Podle rodinné bible." });
    assert.equal(u.status, 200, u.body);
    const ub = JSON.parse(u.body);
    assert.deepEqual({ ...ub, head: undefined, written: undefined }, { decided: "X0002", take: "user", head: undefined, written: undefined, person: "P0001" });
    assert.match(ub.head, /^[0-9a-f]{40}$/);
    assert.match(ub.written, /^E\d{4} withdrawn, E\d{4} the user's: /);
    assert.deepEqual((await facts(w, "P1", "CHR")).map((e) => [e.date, e.status]), [["4 MAR 1885", "possible"]]);
    const x2 = await conflict(w, "X2");
    assert.deepEqual([x2.decidedBy, x2.decidedIn, x2.taken, x2.reasoning], ["user", "app", "user", "rozhodnutí uživatele v aplikaci Strom: Podle rodinné bible."]);
    // the log says it as the user's, not an agent's
    assert.ok(fs.readdirSync(path.join(w.cwd, "data", "ops"), { recursive: true }).some((f) => /user-|\/user/.test(String(f)) || String(f).startsWith("user")));

    // again: decided already — what, which side, when, by whom
    const again = await decide("X2", { do: "decide", take: "research" });
    assert.equal(again.status, 409);
    const ab = JSON.parse(again.body);
    assert.deepEqual([ab.code, ab.resolution, ab.take, ab.by, ab.in, typeof ab.at], ["conflict.decided", "4. 3. 1885, Kamenice", "user", "user", "app", "string"]);

    // the research's value: nothing of the fact written — the decision is (data/conflicts): a new head
    const before = JSON.parse((await get(`${info.url}/status?poll=1`)).body);
    const r = await decide("X0006", { do: "decide", take: "research" });
    assert.equal(r.status, 200, r.body);
    const rb = JSON.parse(r.body);
    assert.deepEqual([rb.decided, rb.take, rb.person, rb.family], ["X0006", "research", "P0001", "F0001"]);
    assert.notEqual(rb.head, ub.head, "a commit of the decision");
    assert.ok(before.headAt >= head0);
    // the next Strom file: decided, the fact the research's
    const ged = (await get(`${info.url}/tree.ged`)).body;
    assert.match(conflictOf(ged, "P0001", "X0006"), /^2 TYPE MARR\n2 TITL .*\n2 STAT decided\n2 VAL 5\. 2\. 1910, Týnec\n/);
    assert.match(ged, /\n1 MARR\n2 DATE 5 FEB 1910\n/);
    assert.match(conflictOf(ged, "P0001", "X0002"), /^2 TYPE CHR\n2 TITL .*\n2 STAT decided\n/);
    assert.match(block(ged, "P0001"), /\n1 BAPM\n2 DATE 4 MAR 1885\n|\n1 CHR\n2 DATE 4 MAR 1885\n/);

    // the empty side and the sex through the bridge
    assert.equal((await decide("X3", { do: "decide", take: "user" })).status, 200);
    assert.equal(((await w.ok(["person", "show", "P1", "--json"])).json.person as Person).names[0]!.prefix, undefined);
    assert.equal((await decide("X4", { do: "decide", take: "research" })).status, 200);
    assert.equal(((await w.ok(["person", "show", "P1", "--json"])).json.person as Person).sex, "M");

    // refused
    assert.equal(JSON.parse((await decide("X0099", { do: "decide", take: "user" })).body).code, "conflict.none");
    assert.equal((await decide("X0099", { do: "decide", take: "user" })).status, 404);
    assert.equal((await decide("P0001", { do: "decide", take: "user" })).status, 404);
    const sources = await decide("X1", { do: "decide", take: "user" });
    assert.deepEqual([sources.status, JSON.parse(sources.body).code], [422, "conflict.no-edit"]);
    const take = await decide("X5", { do: "decide", take: "both" });
    assert.deepEqual([take.status, JSON.parse(take.body).code], [400, "conflict.bad-take"]);
    const bad = await post(`${info.url}/conflict/X5`, "hello", app);
    assert.deepEqual([bad.status, JSON.parse(bad.body).code], [400, "decide.bad-body"]);
    assert.equal((await decide("X5", { do: "reopen" })).status, 400);
    const foreign = await decide("X5", { do: "decide", take: "user" }, { "Content-Type": "application/json" });
    assert.deepEqual([foreign.status, JSON.parse(foreign.body).code], [403, "app.only"]);
    assert.equal((await conflict(w, "X5")).state, "open", "nothing decided by a refusal");
    // a long note: 200 characters at most
    assert.equal((await decide("X5", { do: "decide", take: "user", note: "á".repeat(300) })).status, 200);
    assert.equal([...(await conflict(w, "X5")).reasoning!].length, "rozhodnutí uživatele v aplikaci Strom: ".length + 200);
    assert.equal(((await w.ok(["person", "show", "P2", "--json"])).json.person as Person).names[0]!.surname, "Dvořáčková");
    assert.match((await w.ok(["check"])).out, /^ok/);
  } finally {
    await w.ok(["live", "stop"]);
    w.cleanup();
  }
});

test("the bridge: busy while a send is being written or another strom holds the research (503, Retry-After); a newer strom's research locked (423)", bridged, async () => {
  const { w, sent } = await world();
  await w.ok(["sync", sent, "--apply"]);
  Object.assign(w.env, { STROM_SYNC_ANSWER_MS: "300", STROM_LOCK_WAIT_MS: "3000", STROM_SYNC_RETRY_MS: "300" });
  const info = (await w.ok(["live", "start", "--json"])).json;
  const lock = path.join(w.cwd, ".strom", "tree.lock");
  try {
    const decide = (id: string, take: string) => post(`${info.url}/conflict/${id}`, JSON.stringify({ do: "decide", take }), app);
    fs.writeFileSync(lock, JSON.stringify({ pid: process.pid, host: os.hostname(), at: new Date().toISOString(), owner: "a test" }));
    // the research held by another strom: the decision waits as a writer does, then busy — nothing decided
    const held = await decide("X2", "user");
    assert.equal(held.status, 503, held.body);
    assert.equal(JSON.parse(held.body).code, "research.busy");
    assert.equal(JSON.parse(held.body).retry, 5);
    assert.equal((await conflict(w, "X2")).state, "open");
    // a send the bridge writes (waiting for the research): a decision meanwhile is busy at once
    const given = path.join(w.dir, "given2.ged");
    await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", given]);
    const send = await post(`${info.url}/sync`, fs.readFileSync(given, "utf8").replace(/(1 NAME Anna \/[^\n]*\n(?:[2-9].*\n)*)/, "$11 OCCU švadlena\n"), app);
    assert.equal(send.status, 202, send.body);
    const busy = await decide("X2", "user");
    assert.equal(busy.status, 503, busy.body);
    assert.equal(JSON.parse(busy.body).code, "research.busy");
    // free again: the send written in its turn, then the decision
    fs.rmSync(lock);
    let free = await decide("X2", "user");
    for (let i = 0; i < 100 && free.status === 503; i++) {
      await new Promise((r) => setTimeout(r, 200));
      free = await decide("X2", "user");
    }
    assert.equal(free.status, 200, free.body);
    // a research a newer strom wrote: locked, nothing written
    const cfg = readJsonFile(path.join(w.cwd, "strom.json"));
    fs.writeFileSync(path.join(w.cwd, "strom.json"), JSON.stringify({ ...cfg, schema: cfg.schema + 1, migratedWith: "9.0.0" }, null, 2));
    const locked = await decide("X3", "user");
    assert.equal(locked.status, 423, locked.body);
    assert.equal(JSON.parse(locked.body).code, "locked");
    fs.writeFileSync(path.join(w.cwd, "strom.json"), JSON.stringify(cfg, null, 2));
  } finally {
    fs.rmSync(lock, { force: true });
    await w.ok(["live", "stop"]);
    w.cleanup();
  }
});

test("an archive: the bridge decides its old conflicts too — take user and take research, written as in a research", bridged, async () => {
  const { w, sent } = await world();
  await w.ok(["sync", sent, "--apply"]);
  await w.ok(["mode", "archive"], { tty: true });
  const info = (await w.ok(["live", "start", "--json"])).json;
  try {
    const decide = (id: string, take: string) => post(`${info.url}/conflict/${id}`, JSON.stringify({ do: "decide", take }), app);
    const u = await decide("X2", "user");
    assert.equal(u.status, 200, u.body);
    assert.deepEqual((await facts(w, "P1", "CHR")).map((e) => [e.date, e.status]), [["4 MAR 1885", "possible"]]);
    const r = await decide("X6", "research");
    assert.equal(r.status, 200, r.body);
    assert.equal((await conflict(w, "X6")).state, "resolved");
    assert.equal((await conflict(w, "X6")).taken, "research");
    assert.match((await w.ok(["check"])).out, /^ok/);
  } finally {
    await w.ok(["live", "stop"]);
    w.cleanup();
  }
});

test("the link with the side picked in the app: only confirmed and why — that side taken; an unknown side refused", opts, async () => {
  const { w, sent } = await world();
  await w.ok(["sync", sent, "--apply"]);
  const id = readJsonFile(path.join(w.cwd, "strom.json")).id as string;
  const open = (query: string, answers: string[]) => w.run(["link", "open", `strom-research://conflict?tree=${id}${query}`], { tty: true, answers });
  const r = await open("&id=X0003&do=decide&take=user", ["a", "Titul nezískal", ""]);
  assert.equal(r.code, 0, r.err + r.out);
  assert.match(r.out, /rozhodnout rozpor: Josef Novák: Titul před jménem — Ing\. × — — ponechat hodnotu z aplikace: \(prázdné\)/);
  assert.equal(((await w.ok(["person", "show", "P1", "--json"])).json.person as Person).names[0]!.prefix, undefined);
  const x = await conflict(w, "X3");
  assert.deepEqual([x.taken, x.decidedBy, x.reasoning], ["user", "user", "Titul nezískal (rozhodnutí uživatele)"]);
  const res = await open("&id=X0002&take=research", ["a", "Matrika je jasná", ""]);
  assert.match(res.out, /převzít hodnotu výzkumu: 3\. 3\. 1885, Kamenice/);
  assert.equal((await conflict(w, "X2")).taken, "research");
  const wrong = await open("&id=X0004&take=both", [""]);
  assert.match(wrong.out + wrong.err, /unknown take "both"/);
  assert.equal((await conflict(w, "X4")).state, "open");
  w.cleanup();
});
