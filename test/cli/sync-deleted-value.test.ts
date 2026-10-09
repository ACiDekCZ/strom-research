// A value of a fact taken off in the Strom app, the fact itself kept (B-1, found with the app's 3.11.0-beta.2): the date,
// the place or the value of a fact a record proves is a conflict of the user's edit — decided by side, the user's side
// the fact as the user left it (empty when nothing is left); taking it withdraws the record's fact and writes the user's
// beside it, taking the research's keeps it. A lead is corrected; a fact gone from the file whole is only said; a file
// that names no state it stands on takes nothing away.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";
import type { Conflict, Person } from "../../src/core/model.ts";
import { post } from "./sync.helpers.ts";

const opts = { skip: !hasGit };
const bridged = { skip: !hasGit || process.platform === "win32" };
const app = { Origin: "https://beta.stromapp.info", "Content-Type": "text/plain; charset=utf-8" };

type Ev = { id: string; kind: string; date?: string; place?: string; value?: string; status: string; retracted?: unknown };
type SyncConflict = { id: string; fact: string; take?: boolean; sides?: { user: string; research: string }; person?: string; family?: string };

/**
 * Tomáš (P1): his death proven by S1, an occupation from S1; his title "Mgr." from no record. Marie (P2): a death
 * nobody proved (a lead). Married (F1), the marriage proven by S2. The Strom file as the app was given it.
 */
async function world(): Promise<{ w: World; given: string }> {
  const w = new World();
  await w.withTree();
  await w.ok(["lang", "cs"]);
  await w.ok(["source", "add", "Úmrtí Tomáše Horáka 1865", "--kind", "death", "--transcript", "Tomáš Horák, tkadlec, zemřel."]); // S1
  await w.ok(["source", "add", "Sňatek Tomáše a Marie 1840", "--kind", "marriage"]); // S2
  await w.ok(["person", "add", "Tomáš /Horák/", "--sex", "M", "--prefix", "Mgr."]); // P1
  await w.ok(["event", "add", "P1", "DEAT", "--date", "23 OCT 1865", "--place", "Žďár nad Sázavou", "--cite", "S1"]);
  await w.ok(["event", "add", "P1", "OCCU", "--value", "tkadlec", "--date", "1865", "--cite", "S1"]);
  await w.ok(["person", "add", "Marie /Horáková/", "--sex", "F"]); // P2
  await w.ok(["event", "add", "P2", "DEAT", "--date", "4 MAY 1870", "--place", "Nové Město na Moravě"]); // a lead
  await w.ok(["person", "add", "Jan /Horák/", "--sex", "M"]); // P3
  await w.ok(["family", "add", "--partner", "P1", "--partner", "P2"]); // F1
  await w.ok(["event", "add", "F1", "MARR", "--date", "12 FEB 1840", "--place", "Žďár nad Sázavou", "--cite", "S2"]);
  const given = path.join(w.dir, "given.ged");
  await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", given]);
  return { w, given };
}

/** One record of the file (INDI or FAM by its REFN) edited as the app would. */
function send(w: World, given: string, edit: (t: string) => string, name = "app.ged"): string {
  const t = fs.readFileSync(given, "utf8");
  const out = edit(t);
  assert.notEqual(out, t, "the edit changed the file");
  const file = path.join(w.dir, name);
  fs.writeFileSync(file, out);
  return file;
}

/** The record of the file that carries the REFN (a person's or a family's). */
function inRecord(t: string, refn: string, edit: (rec: string) => string): string {
  return t
    .split(/\n(?=0 )/)
    .map((r) => (new RegExp(`\\n1 REFN ${refn}\\n`).test(`${r}\n`) ? edit(r) : r))
    .join("\n");
}

const facts = async (w: World, id: string, kind: string): Promise<Ev[]> => ((await w.ok([id.startsWith("F") ? "family" : "person", "show", id, "--json"])).json[id.startsWith("F") ? "family" : "person"].events as Ev[]).filter((e) => e.kind === kind);
const open = async (w: World): Promise<Conflict[]> => ((await w.ok(["conflict", "list", "--json"])).json.conflicts as Conflict[]).filter((c) => c.state === "open");

test("B-1: the date of a death a record proves taken off in the app — a conflict of the user's edit; take user: the death without its date, the record's withdrawn", opts, async () => {
  const { w, given } = await world();
  const file = send(w, given, (t) => inRecord(t, "P0001", (r) => r.replace(/\n2 DATE 23 OCT 1865/, "")));
  const r = (await w.ok(["sync", file, "--apply", "--json"])).json;
  assert.deepEqual(
    (r.conflicts as SyncConflict[]).map((c) => [c.fact, c.take, c.sides, c.person, c.family]),
    [["DEAT", true, { user: "Žďár nad Sázavou", research: "23. 10. 1865, Žďár nad Sázavou" }, "P0001", undefined]],
  );
  assert.deepEqual(r.skipped ?? [], [], "nothing left unwritten");
  // the Strom file the app gets back: decided by side
  const back = path.join(w.dir, "back.ged");
  await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", back], { env: { STROM_APP_URL: "https://beta.stromapp.info/run/" } });
  assert.match(fs.readFileSync(back, "utf8"), /\n1 _STROM_CONFLICT X0001\n2 TYPE DEAT\n2 TITL .*\n2 STAT open\n2 _STROM_TAKE Y\n2 VAL 23\. 10\. 1865, Žďár nad Sázavou\n3 SOUR @S0001@\n3 _STROM_SIDE research\n2 VAL Žďár nad Sázavou\n3 _STROM_SIDE user\n/);
  // the death as it was until the user decides
  assert.deepEqual((await facts(w, "P1", "DEAT")).map((e) => [e.date, e.place, e.status, !!e.retracted]), [["23 OCT 1865", "Žďár nad Sázavou", "probable", false]]);
  // sent again: the same conflict, never a second
  await w.run(["sync", file, "--apply", "--again", "--json"]);
  assert.equal((await open(w)).length, 1);

  await w.ok(["conflict", "resolve", "X1", "--take", "user", "--reasoning", "datum neplatí"]);
  const deaths = await facts(w, "P1", "DEAT");
  assert.deepEqual(deaths.filter((e) => !e.retracted).map((e) => [e.date, e.place, e.status]), [[undefined, "Žďár nad Sázavou", "possible"]], "the user's: no date, the place kept");
  assert.deepEqual(deaths.filter((e) => e.retracted).map((e) => [e.date, e.place]), [["23 OCT 1865", "Žďár nad Sázavou"]], "the record's withdrawn, never deleted");
  assert.match((await w.ok(["check"])).out, /^ok/);
  w.cleanup();
});

test("B-1: take research keeps the date", opts, async () => {
  const { w, given } = await world();
  const file = send(w, given, (t) => inRecord(t, "P0001", (r) => r.replace(/\n2 DATE 23 OCT 1865/, "")));
  await w.ok(["sync", file, "--apply"]);
  await w.ok(["conflict", "resolve", "X1", "--take", "research", "--reasoning", "matrika"]);
  assert.deepEqual((await facts(w, "P1", "DEAT")).map((e) => [e.date, e.place, !!e.retracted]), [["23 OCT 1865", "Žďár nad Sázavou", false]]);
  w.cleanup();
});

test("B-1: the place taken off, both taken off (the user's side empty), an occupation's value taken off — each a conflict; take user writes what is left", opts, async () => {
  const { w, given } = await world();
  const file = send(w, given, (t) => inRecord(t, "P0001", (r) => r.replace(/(\n1 DEAT[^\n]*\n2 DATE 23 OCT 1865)\n2 PLAC Žďár nad Sázavou/, "$1").replace(/\n1 OCCU tkadlec/, "\n1 OCCU")));
  const r = (await w.ok(["sync", file, "--apply", "--json"])).json;
  assert.deepEqual(
    (r.conflicts as SyncConflict[]).map((c) => [c.fact, c.sides]),
    [
      ["DEAT", { user: "23. 10. 1865", research: "23. 10. 1865, Žďár nad Sázavou" }],
      ["OCCU", { user: "1865", research: "tkadlec, 1865" }],
    ],
  );
  await w.ok(["conflict", "resolve", "X1", "--take", "user", "--reasoning", "místo neplatí"]);
  await w.ok(["conflict", "resolve", "X2", "--take", "user", "--reasoning", "nebyl tkadlec"]);
  assert.deepEqual((await facts(w, "P1", "DEAT")).filter((e) => !e.retracted).map((e) => [e.date, e.place]), [["23 OCT 1865", undefined]]);
  // an occupation without its text is no fact: the record's withdrawn, nothing in its place
  assert.deepEqual((await facts(w, "P1", "OCCU")).map((e) => [e.value, !!e.retracted]), [["tkadlec", true]]);

  // the date and the place taken off: the death kept, nothing known of it — the user's side empty
  const both = await world();
  const f2 = send(both.w, both.given, (t) => inRecord(t, "P0001", (x) => x.replace(/\n2 DATE 23 OCT 1865\n2 PLAC Žďár nad Sázavou/, "")));
  const r2 = (await both.w.ok(["sync", f2, "--apply", "--json"])).json;
  assert.deepEqual((r2.conflicts as SyncConflict[]).map((c) => [c.fact, c.sides]), [["DEAT", { user: "", research: "23. 10. 1865, Žďár nad Sázavou" }]]);
  const back = path.join(both.w.dir, "back.ged");
  await both.w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", back], { env: { STROM_APP_URL: "https://beta.stromapp.info/run/" } });
  assert.match(fs.readFileSync(back, "utf8"), /\n2 VAL\n3 _STROM_SIDE user\n/);
  await both.w.ok(["conflict", "resolve", "X1", "--take", "user", "--reasoning", "nevíme"]);
  assert.deepEqual((await facts(both.w, "P1", "DEAT")).filter((e) => !e.retracted).map((e) => [e.date, e.place, e.status]), [[undefined, undefined, "possible"]]);
  assert.match((await both.w.ok(["check"])).out, /^ok/);
  w.cleanup();
  both.w.cleanup();
});

test("B-1: a couple's marriage date taken off — a conflict of the family", opts, async () => {
  const { w, given } = await world();
  const file = send(w, given, (t) => t.replace(/(\n0 @[^@]+@ FAM\n(?:[1-9].*\n)*?1 MARR[^\n]*)\n2 DATE 12 FEB 1840/, "$1"));
  const r = (await w.ok(["sync", file, "--apply", "--json"])).json;
  assert.deepEqual(
    (r.conflicts as SyncConflict[]).map((c) => [c.fact, c.take, c.sides, c.person, c.family]),
    [["MARR", true, { user: "Žďár nad Sázavou", research: "12. 2. 1840, Žďár nad Sázavou" }, "P0001", "F0001"]],
  );
  await w.ok(["conflict", "resolve", "X1", "--take", "user", "--reasoning", "jiný sňatek"]);
  const marr = await facts(w, "F1", "MARR");
  assert.deepEqual(marr.filter((e) => !e.retracted).map((e) => [e.date, e.place]), [[undefined, "Žďár nad Sázavou"]]);
  assert.equal(marr.filter((e) => e.retracted).length, 1);
  w.cleanup();
});

test("B-1 stays: a lead's date taken off is corrected; a fact gone whole only said; a title from no record taken off or added directly", opts, async () => {
  const { w, given } = await world();
  const file = send(w, given, (t) => {
    let x = inRecord(t, "P0002", (r) => r.replace(/\n2 DATE 4 MAY 1870/, "")); // the lead's date
    x = x.replace(/1 NAME Mgr\. Tomáš \/Horák\/\n2 NPFX Mgr\.\n/, "1 NAME Tomáš /Horák/\n"); // a title from no record
    x = x.replace(/1 NAME Jan \/Horák\/\n/, "1 NAME Ing. Jan /Horák/\n2 NPFX Ing.\n"); // a title added
    return x;
  });
  const r = (await w.ok(["sync", file, "--apply", "--json"])).json;
  assert.deepEqual(r.conflicts ?? [], [], "no conflict");
  assert.deepEqual((r.changes as { kind: string; action: string }[]).map((c) => `${c.kind}:${c.action}`).sort(), ["fact.changed:correct", "name.title:add", "name.title:correct"]);
  assert.deepEqual((await facts(w, "P2", "DEAT")).filter((e) => !e.retracted).map((e) => [e.date, e.place]), [[undefined, "Nové Město na Moravě"]], "the lead corrected");
  const name = async (id: string) => ((await w.ok(["person", "show", id, "--json"])).json.person as Person).names[0]!.prefix;
  assert.equal(await name("P1"), undefined);
  assert.equal(await name("P3"), "Ing.");

  // a proven death gone from the file whole (Marie's still carried): only said, kept
  const whole = await world();
  const f2 = send(whole.w, whole.given, (t) => inRecord(t, "P0001", (x) => x.replace(/\n1 DEAT[^\n]*(?:\n[2-9][^\n]*)*/, "")));
  const r2 = (await whole.w.ok(["sync", f2, "--apply", "--json"])).json;
  assert.deepEqual(r2.conflicts ?? [], []);
  assert.deepEqual((r2.changes as { kind: string; action: string }[]).map((c) => `${c.kind}:${c.action}`), ["fact.gone:report"]);
  assert.deepEqual((await facts(whole.w, "P1", "DEAT")).map((e) => [e.date, !!e.retracted]), [["23 OCT 1865", false]]);
  w.cleanup();
  whole.w.cleanup();
});

test("B-1: a file that names no state it stands on (no _STROM_HEAD) takes nothing away — a date it lacks is no deletion", opts, async () => {
  const { w, given } = await world();
  const file = send(w, given, (t) => inRecord(t.replace(/\n1 _STROM_HEAD [^\n]*/, ""), "P0001", (r) => r.replace(/\n2 DATE 23 OCT 1865/, "")));
  const r = (await w.ok(["sync", file, "--apply", "--json"])).json;
  assert.deepEqual(r.conflicts ?? [], []);
  assert.deepEqual((await facts(w, "P1", "DEAT")).map((e) => [e.date, !!e.retracted]), [["23 OCT 1865", false]]);
  w.cleanup();
});

test("B-1 through the bridge: the send answers the conflict with its sides; the app takes the user's side", bridged, async () => {
  const { w, given } = await world();
  await w.ok(["config", "set", "strom.app.url", "https://beta.stromapp.info/run/"]);
  const info = (await w.ok(["live", "start", "--json"])).json;
  try {
    const text = inRecord(fs.readFileSync(given, "utf8"), "P0001", (r) => r.replace(/\n2 DATE 23 OCT 1865/, ""));
    const s = await post(`${info.url}/sync`, text, app);
    assert.equal(s.status, 200, s.body);
    const sb = JSON.parse(s.body);
    assert.deepEqual(
      (sb.conflicts as SyncConflict[]).map((c) => [c.fact, c.take, c.sides]),
      [["DEAT", true, { user: "Žďár nad Sázavou", research: "23. 10. 1865, Žďár nad Sázavou" }]],
    );
    const d = await post(`${info.url}/conflict/${sb.conflicts[0].id}`, JSON.stringify({ do: "decide", take: "user" }), { ...app, "Content-Type": "application/json" });
    assert.equal(d.status, 200, d.body);
    assert.deepEqual((await facts(w, "P1", "DEAT")).filter((e) => !e.retracted).map((e) => [e.date, e.place]), [[undefined, "Žďár nad Sázavou"]]);
  } finally {
    await w.ok(["live", "stop"]);
    w.cleanup();
  }
});

test("B-1 in an archive: the user's word — the death without its date written, the record's withdrawn, never the whole death taken off", opts, async () => {
  const { w, given } = await world();
  await w.ok(["mode", "archive"], { tty: true });
  const file = send(w, given, (t) => inRecord(t, "P0001", (r) => r.replace(/\n2 DATE 23 OCT 1865/, "")));
  const r = (await w.ok(["sync", file, "--apply", "--json"])).json;
  assert.deepEqual(r.conflicts ?? [], []);
  const deaths = await facts(w, "P1", "DEAT");
  assert.deepEqual(deaths.filter((e) => !e.retracted).map((e) => [e.date, e.place, e.status]), [[undefined, "Žďár nad Sázavou", "possible"]]);
  assert.deepEqual(deaths.filter((e) => e.retracted).map((e) => e.date), ["23 OCT 1865"]);
  // taken back: the record's death as it was
  await w.ok(["sync", "undo", r.input]);
  assert.deepEqual((await facts(w, "P1", "DEAT")).filter((e) => !e.retracted).map((e) => [e.date, e.status]), [["23 OCT 1865", "probable"]]);
  w.cleanup();
});
