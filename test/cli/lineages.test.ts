// The bounds of a lineage the person set in the Strom app (core/lineages.ts, quality/lineages.json): the gate of the
// Strom file (APP_READS_LINES), its marks taken by strom sync (1 _STROM_LINE on a person, 1 _STROM_LINES Y in the
// header), given back, kept across a merge, taken back with the sync; the bridge's feature; the research's date with
// its time (_STROM_ASOF).

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit, readJsonFile } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import { Settings } from "../../src/core/config.ts";
import { history } from "../../src/core/live.ts";
import { APP_READS_LINES, APP_READS_LINES_BETA, appReadsLines } from "../../src/core/stromapp.ts";
import { asOfNow, exportGedcom } from "../../src/gedcom/export.ts";
import { validateGedcom } from "../../src/gedcom/validate.ts";
import { get } from "./sync.helpers.ts";

const opts = { skip: !hasGit };
const bridged = { skip: !hasGit || process.platform === "win32" };
const BETA = { STROM_APP_URL: "https://beta.stromapp.info/run/", STROM_APP_VERSION: "3.19.0-beta.4" };
const file = (w: World) => path.join(w.cwd, "quality", "lineages.json");

test("the gate: production off until the app that keeps the marks is out, an unknown version always off; its beta and development from 3.19.0-beta.4", () => {
  const prod = new Settings({ STROM_APP_URL: "https://stromapp.info/run/" }, {});
  const beta = new Settings({ STROM_APP_URL: "https://beta.stromapp.info/run/" }, {});
  assert.equal(APP_READS_LINES, undefined, "set only from a production app's version (strom:je-venku-brany)");
  assert.equal(APP_READS_LINES_BETA, "3.19.0-beta.4");
  for (const v of [undefined, "3.18.0", "3.19.0-beta.4", "3.19.0", "9.0.0"]) assert.equal(appReadsLines(prod, v), false, String(v));
  assert.equal(appReadsLines(beta), false, "an unknown version: off, also the beta");
  for (const v of ["3.18.0", "3.19.0-beta.3"]) assert.equal(appReadsLines(beta, v), false, v);
  for (const v of ["3.19.0-beta.4", "3.19.0", "3.20.0-beta.1"]) assert.equal(appReadsLines(beta, v), true, v);
  // the gate set (as its own parameter): from that version, never an unknown one
  assert.equal(appReadsLines(prod, "3.18.9", "3.19.0"), false);
  assert.equal(appReadsLines(prod, "3.19.0", "3.19.0"), true);
  assert.equal(appReadsLines(prod, undefined, "3.19.0"), false);
});

test("the research's date: ISO 8601 with its time in UTC, no milliseconds; the header's DATE as it was", opts, async () => {
  assert.equal(asOfNow(new Date("2026-10-31T06:12:05.789Z")), "2026-10-31T06:12:05Z");
  assert.match(asOfNow(), /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u);
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["person", "add", "Jan /Lhoták/", "--sex", "M"]);
  const t = exportGedcom(Tree.open(w.cwd, w.env), { for: "strom", research: true } as any).text;
  assert.match(t, /^1 _STROM_ASOF \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/m);
  assert.match(t, /^1 DATE \d{1,2} [A-Z]{3} \d{4}$/m);
  w.cleanup();
});

test("the Strom file: the header's mark and each person's (after SEX); the header's mark with nobody marked; the standard file never; valid", opts, async () => {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["person", "add", "Jan /Lhoták/", "--sex", "M"]); // P1
  await w.ok(["person", "add", "Петр /Лготак/", "--sex", "M"]); // P2
  const tree = Tree.open(w.cwd, w.env);
  const none = exportGedcom(tree, { for: "strom", lines: new Map() }).text;
  assert.match(none, /^1 _STROM_LINES Y$/m, "the header's mark: the list is the truth, an empty one too");
  assert.doesNotMatch(none, /_STROM_LINE /);
  const lines = new Map([["P0001", "FOUNDER" as const], ["P0002", "NOCARRY" as const]]);
  const t = exportGedcom(tree, { for: "strom", lines }).text;
  assert.match(t, /1 SEX M\r?\n1 _STROM_LINE FOUNDER\r?\n1 REFN P0001/);
  assert.match(t, /1 SEX M\r?\n1 _STROM_LINE NOCARRY\r?\n1 REFN P0002/);
  assert.deepEqual(validateGedcom(t).filter((f) => f.level === "error" || /_STROM_LINE/u.test(f.message)), [], "valid, the tags known");
  assert.doesNotMatch(exportGedcom(tree, { lines }).text, /_STROM_LINE/, "the standard file never");
  assert.doesNotMatch(exportGedcom(tree, { for: "strom" }).text, /_STROM_LINE/, "nothing without the gate");
  w.cleanup();
});

// ── strom sync: the app's marks ────────────────────────────────────────────

/** The research's Strom file as the Strom app of `version` gives it back: its marks those of `marks` (a header mark with `said`). */
function asApp(text: string, marks: Record<string, string | string[]>, said = true, version = "3.19.0-beta.4"): string {
  let t = text.replace(/^1 SOUR STROM_RESEARCH\r?\n2 VERS .*\r?\n2 NAME .*\r?\n/m, `1 SOUR STROM\n2 VERS ${version}\n2 NAME Strom\n`);
  t = t.replace(/^1 _STROM_LINES? .*\r?\n/gm, "");
  if (said) t = t.replace(/^(1 _STROM_TREE .*\r?\n)/m, "$11 _STROM_LINES Y\n");
  for (const [id, m] of Object.entries(marks)) {
    const at = new RegExp(`^(1 REFN ${id}\\r?\\n)`, "m");
    assert.match(t, at, id);
    t = t.replace(at, `${(Array.isArray(m) ? m : [m]).map((x) => `1 _STROM_LINE ${x}\n`).join("")}$1`);
  }
  return t;
}

async function synced(w: World, text: string, name: string): Promise<any> {
  const f = path.join(w.dir, name);
  fs.writeFileSync(f, text);
  return (await w.ok(["sync", f, "--apply", "--json"])).json;
}

const lineChanges = (r: any) => (r.changes ?? []).filter((c: any) => c.kind === "lineage.mark").map((c: any) => [c.person, c.text]);
const stored = (w: World) => (fs.existsSync(file(w)) ? readJsonFile(file(w)) : { lineFounders: [], lineNotCarriers: [] });

async function family(w: World): Promise<string> {
  await w.ok(["person", "add", "Jan /Lhoták/", "--sex", "M"]); // P1
  await w.ok(["person", "add", "Radoslav /Lhoták/", "--sex", "M"]); // P2
  await w.ok(["person", "add", "Иван /Лготак/", "--sex", "M"]); // P3
  await w.ok(["family", "add", "--partner", "P1", "--child", "P2"]);
  const given = path.join(w.dir, "given.ged");
  await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", given]);
  return fs.readFileSync(given, "utf8");
}

test("sync from an app that does not keep the marks: nothing without the header's mark; with it the file's list is the truth — both a founder, a value of a later app none, an empty list takes them back", opts, async () => {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["lang", "cs"]);
  const text = await family(w);
  assert.doesNotMatch(text, /_STROM_LINE/, "an app of unknown version gets no marks");
  // no header mark: the file says nothing of them
  let r = await synced(w, asApp(text, { P0002: "FOUNDER" }, false, "3.18.0"), "unsaid.ged");
  assert.deepEqual(lineChanges(r), []);
  assert.equal(fs.existsSync(file(w)), false);
  // marked: taken; one in both a founder; a value of a later app none
  r = await synced(w, asApp(text, { P0002: ["NOCARRY", "FOUNDER"], P0003: "NOCARRY", P0001: "LATER" }, true, "3.18.0"), "marked.ged");
  assert.deepEqual(lineChanges(r), [["P0002", "FOUNDER"], ["P0003", "NOCARRY"]], JSON.stringify(r.changes));
  assert.deepEqual(stored(w), { lineFounders: ["P0002"], lineNotCarriers: ["P0003"] });
  const said = history(w.cwd, Tree.open(w.cwd, w.env)).map((h) => h.text.join("\n")).join("\n");
  assert.match(said, /Zakládá vlastní rod: Radoslav Lhoták/);
  assert.match(said, /Rod nenese: Иван Лготак/);
  assert.match((await w.ok(["check"])).out, /^ok/, "sealed, logged");
  // the same again: nothing
  r = await synced(w, asApp(text, { P0002: "FOUNDER", P0003: "NOCARRY" }, true, "3.18.0"), "same.ged");
  assert.deepEqual(lineChanges(r), []);
  // the header's mark, nobody marked: all taken back; the plan says it
  const f = path.join(w.dir, "empty.ged");
  fs.writeFileSync(f, asApp(text, {}, true, "3.18.0"));
  assert.match((await w.ok(["sync", f])).out, /Rod: Radoslav Lhoták \[P0002\] zase podle výpočtu → zapíše se/);
  r = await synced(w, asApp(text, {}, true, "3.18.0"), "empty.ged");
  assert.deepEqual(lineChanges(r), [["P0002", ""], ["P0003", ""]]);
  assert.deepEqual(stored(w), { lineFounders: [], lineNotCarriers: [] });
  // taken back with the sync: the marks before it
  await w.ok(["sync", "undo", r.input]);
  assert.deepEqual(stored(w), { lineFounders: ["P0002"], lineNotCarriers: ["P0003"] });
  assert.match((await w.ok(["check"])).out, /^ok/);
  w.cleanup();
});

test("sync with an app that keeps them: given back in the Strom file, the round trip changes nothing, only what the user changed since counts; the bridge says lineage.read", opts, async () => {
  const w = new World();
  await w.withTree("Lhotákovi");
  Object.assign(w.env, BETA);
  let text = await family(w);
  assert.match(text, /^1 _STROM_LINES Y$/m);
  // the user's marks
  let r = await synced(w, asApp(text, { P0002: "FOUNDER" }), "first.ged");
  assert.deepEqual(lineChanges(r), [["P0002", "FOUNDER"]]);
  const given = path.join(w.dir, "again.ged");
  await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", given]);
  text = fs.readFileSync(given, "utf8");
  assert.match(text, /1 _STROM_LINE FOUNDER\r?\n1 REFN P0002/, "given back");
  // the round trip: nothing
  const keep = text.replace(/^1 SOUR STROM_RESEARCH\r?\n2 VERS .*\r?\n2 NAME .*\r?\n/m, "1 SOUR STROM\n2 VERS 3.19.0-beta.4\n2 NAME Strom\n");
  r = await synced(w, keep, "same.ged");
  assert.deepEqual(lineChanges(r), []);
  // the user took the founder back and marked another: both
  r = await synced(w, asApp(text, { P0003: "NOCARRY" }), "changed.ged");
  assert.deepEqual(lineChanges(r), [["P0002", ""], ["P0003", "NOCARRY"]]);
  assert.deepEqual(stored(w), { lineFounders: [], lineNotCarriers: ["P0003"] });
  w.cleanup();
});

test("a merge: the mark goes to the one merged into, a founder before one who carries none; a person taken back has none", opts, async () => {
  const w = new World();
  await w.withTree("Lhotákovi");
  Object.assign(w.env, BETA);
  const text = await family(w);
  await synced(w, asApp(text, { P0001: "NOCARRY", P0002: "NOCARRY", P0003: "FOUNDER" }), "marked.ged");
  await w.ok(["person", "merge", "P0001", "P0003", "--reason", "the same man"]);
  await w.ok(["person", "retract", "P0002", "--reason", "misread"]);
  const out = path.join(w.dir, "after.ged");
  await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", out]);
  const t = fs.readFileSync(out, "utf8");
  assert.match(t, /1 _STROM_LINE FOUNDER\r?\n1 REFN P0001/);
  assert.equal((t.match(/_STROM_LINE /g) ?? []).length, 1, t.match(/.*_STROM_LINE .*/g)?.join("\n"));
  assert.match((await w.ok(["check"])).out, /^ok/);
  w.cleanup();
});

test("the bridge: /status lists lineage.read; /tree.ged gives the marks to an app that keeps them", bridged, async () => {
  const w = new World();
  await w.withTree("Lhotákovi");
  Object.assign(w.env, BETA);
  const text = await family(w);
  await synced(w, asApp(text, { P0002: "FOUNDER" }), "marked.ged");
  const info = (await w.ok(["live", "start", "--json"])).json;
  try {
    const status = JSON.parse((await get(`${info.url}/status`)).body);
    assert.ok(status.features.includes("lineage.read"), JSON.stringify(status.features));
    const ged = (await get(`${info.url}/tree.ged?app=3.19.0-beta.4`)).body;
    assert.match(ged, /^1 _STROM_LINES Y$/m);
    assert.match(ged, /1 _STROM_LINE FOUNDER\r?\n1 REFN P0002/);
    const older = (await get(`${info.url}/tree.ged?app=3.18.0`)).body;
    assert.doesNotMatch(older, /_STROM_LINE/);
  } finally {
    await w.ok(["live", "stop"]);
    w.cleanup();
  }
});
