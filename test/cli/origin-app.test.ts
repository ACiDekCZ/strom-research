// Where a value came from, with the Strom app (spec 066 U3): the app's marks of an import read from its own file and
// its sends (one source for each import, made once), never from another program's; the research's file says each
// value's origin and the family tree's value changed since (one _STROM_WAS for each part) for an app that shows them;
// the user puts that value back through the bridge (POST /facts/revert).

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { execFileSync } from "node:child_process";
import { World, hasGit } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import { exportGedcom } from "../../src/gedcom/export.ts";
import { validateGedcom } from "../../src/gedcom/validate.ts";
import { children, parseGedcomText, val } from "../../src/gedcom/parse.ts";
import { planSync, readGedcom } from "../../src/core/sync.ts";
import { BRIDGE_FEATURES, bridgeFeatures, status } from "../../src/core/live.ts";
import { Settings } from "../../src/core/config.ts";
import { APP_SHOWS_ORIGIN, APP_SHOWS_ORIGIN_BETA, appShowsOrigin } from "../../src/core/stromapp.ts";
import type { Event, Family, Person, Source } from "../../src/core/model.ts";

const opts = { skip: !hasGit };
/** As the Strom app's bridge writes a send (strom sync … --apply in its process): the person's. */
const FROM_APP = { env: { STROM_FOR_APP: "1" } };
const bridgeOpts = { skip: !hasGit || process.platform === "win32", timeout: 240_000 };
const AGENT = { env: { CLAUDECODE: "1" } };
const PERSON = { tty: true };
const APP = "https://beta.stromapp.info";

const open = (w: World) => Tree.open(w.cwd, w.env);
const people = (w: World) => open(w).list<Person>("person");
const named = (w: World, given: string) => people(w).find((p) => p.names.some((n) => n.given === given))!;
const fact = (p: Person | Family, kind: string) => p.events.find((e) => e.kind === kind && !e.retracted)!;
const imports = (w: World) => open(w).list<Source>("source").filter((s) => s.imported && !s.retracted);
const gitHead = (w: World) => execFileSync("git", ["rev-parse", "HEAD"], { cwd: w.cwd, encoding: "utf8" }).trim();
const ged = (lines: string[]) => [...lines, "0 TRLR", ""].join("\n");

const PLACE = "Horní Lhota, okres Lhotov, Čechy";
const IMPORT_HEAD = ["1 _STROM_IMPORT I1", "2 SOUR MyHeritage Family Tree Builder", "2 VERS 8.0", "2 DATE 12 MAR 2024", "2 _AT 2026-11-08", "2 FILE lhotakovi.ged", "2 _SHA 3f9a0c", "2 _XREF @I37@", "2 _UID 1234"];
/** The Strom app's tree that came of an import: Václav and Ludmila of it (Václav's birthplace the user's), Ondřej the user's. */
const appPeople = [
  "0 @I1@ INDI", "1 _STROM_IMPORT I1", "1 NAME Václav /Lhoták/", "2 _STROM_IMPORT I1", "1 SEX M", "1 BIRT", "2 DATE 1871", `2 PLAC ${PLACE}`, "2 _STROM_IMPORT I1 DATE", "1 DEAT", "2 DATE 1930", "2 PLAC Lhota", "1 FAMS @F1@",
  "0 @I2@ INDI", "1 _STROM_IMPORT I1", "1 NAME Ludmila /Lhotáková/", "2 _STROM_IMPORT I1", "1 SEX F", "2 _STROM_IMPORT I1", "1 BIRT", "2 DATE 1875", "2 _STROM_IMPORT I1", "1 FAMS @F1@",
  "0 @I3@ INDI", "1 NAME Ondřej /Lhoták/", "1 SEX M", "1 BIRT", "2 DATE 1902", "1 FAMC @F1@",
  "0 @F1@ FAM", "1 HUSB @I1@", "1 WIFE @I2@", "1 CHIL @I3@", "2 _STROM_IMPORT I1", "1 MARR", "2 DATE 1898", "2 PLAC Lhota", "2 _STROM_IMPORT I1",
];
const appHead = ["0 HEAD", "1 SOUR STROM", "2 VERS 3.26.0", "1 GEDC", "2 VERS 5.5.1", "1 CHAR UTF-8"];
const refn = (lines: string[], ids: Record<string, string>) =>
  lines.flatMap((l) => {
    const m = /^0 @(I\d+)@ INDI$/.exec(l);
    return m && ids[m[1]!] ? [l, `1 REFN ${ids[m[1]!]}`, "2 TYPE strom-research"] : [l];
  });

/** Lhotákovi adopted from the Strom app's file with its marks of an import; a send of the app made of the same lines. */
async function adopted(): Promise<{ w: World; send: (lines: string[]) => string; ids: Record<string, string> }> {
  const w = new World();
  await w.withTree("Lhotákovi");
  const file = path.join(w.dir, "adopt.ged");
  fs.writeFileSync(file, ged([...appHead, ...IMPORT_HEAD, ...appPeople]));
  await w.ok(["sync", file, "--apply", "--force"], FROM_APP);
  const tree = JSON.parse(fs.readFileSync(path.join(w.cwd, "strom.json"), "utf8")).id as string;
  const ids = { I1: named(w, "Václav").id, I2: named(w, "Ludmila").id, I3: named(w, "Ondřej").id };
  let n = 0;
  const send = (lines: string[]) => {
    const out = path.join(w.dir, `send-${++n}.ged`);
    fs.writeFileSync(out, ged([...appHead, `1 _STROM_TREE ${tree}`, `1 _STROM_HEAD ${gitHead(w)}`, ...IMPORT_HEAD, ...refn(lines, ids)]));
    return out;
  };
  return { w, send, ids };
}

test("/status features: origin.ids only where /tree.ged carries the IDs — the gate not set: never; set: from its version, the beta from its own", opts, async () => {
  const prod = new Settings({ STROM_APP_URL: "https://stromapp.info/run/" }, {});
  const beta = new Settings({ STROM_APP_URL: "https://beta.stromapp.info/run/" }, {});
  // the gates not set (""; undefined would take the defaults): no version of either app is told the IDs come
  for (const v of [undefined, "3.25.0", "3.26.0-beta.1", "3.26.0", "9.0.0"]) {
    assert.ok(!bridgeFeatures(prod, v, "", "").includes("origin.ids"), String(v));
    assert.ok(!bridgeFeatures(beta, v, "", "").includes("origin.ids"), `beta ${v}`);
    assert.ok(bridgeFeatures(prod, v, "", "").includes("origin"), "the origins' revert says itself always");
  }
  // the gates as they are: told exactly where the file carries the IDs; the production app never before its release
  for (const v of [undefined, "3.25.0", "3.26.0-beta.1", "3.26.0", "9.0.0"]) {
    assert.equal(bridgeFeatures(prod, v).includes("origin.ids"), appShowsOrigin(prod, v), String(v));
    assert.equal(bridgeFeatures(beta, v).includes("origin.ids"), appShowsOrigin(beta, v), `beta ${v}`);
    if (APP_SHOWS_ORIGIN === undefined) assert.ok(!bridgeFeatures(prod, v).includes("origin.ids"), `production ${v}`);
  }
  if (APP_SHOWS_ORIGIN_BETA) assert.ok(bridgeFeatures(beta, APP_SHOWS_ORIGIN_BETA).includes("origin.ids"), "the beta app of the beta gate");
  // the gate set: told exactly where appShowsOrigin sends the IDs (the same version of the app as the file goes by)
  for (const [s, v, gate, b] of [[prod, "3.26.0", "3.26.0", undefined], [prod, "3.25.9", "3.26.0", undefined], [prod, undefined, "3.26.0", undefined], [beta, "3.26.0-beta.2", undefined, "3.26.0-beta.2"], [beta, "3.26.0-beta.1", undefined, "3.26.0-beta.2"], [prod, "3.26.0-beta.2", undefined, "3.26.0-beta.2"]] as const) {
    assert.equal(bridgeFeatures(s, v, gate, b).includes("origin.ids"), appShowsOrigin(s, v, gate, b), `${v} ${gate} ${b}`);
  }
  assert.ok(bridgeFeatures(prod, "3.26.0", "3.26.0").includes("origin.ids"));
  assert.ok(!bridgeFeatures(prod, "3.25.9", "3.26.0").includes("origin.ids"));
  assert.ok(bridgeFeatures(beta, "3.26.0-beta.2", undefined, "3.26.0-beta.2").includes("origin.ids"));
  // the bridge's /status itself (the production app): with it exactly where the gate says
  if (!hasGit) return;
  const w = new World();
  try {
    await w.withTree("Lhotákovi");
    for (const v of [undefined, "3.26.0-beta.1", "3.26.0"]) assert.equal((status(w.cwd, w.env, v) as { features: string[] }).features.includes("origin.ids"), appShowsOrigin(new Settings(w.env, {}), v), String(v));
    if (APP_SHOWS_ORIGIN === undefined) for (const v of [undefined, "3.26.0-beta.1", "3.26.0"]) assert.ok(!(status(w.cwd, w.env, v) as { features: string[] }).features.includes("origin.ids"), String(v));
  } finally {
    w.cleanup();
  }
});

test("the gate: the origins only for an app that shows them — from the app's 3.26.0, an unknown version never; its beta from its own gate", () => {
  const prod = new Settings({ STROM_APP_URL: "https://stromapp.info/run/" }, {});
  const beta = new Settings({ STROM_APP_URL: "https://beta.stromapp.info/run/" }, {});
  assert.equal(APP_SHOWS_ORIGIN, "3.26.0", "the app's 3.26.0 shows them (out 2026-11-09)");
  for (const v of [undefined, "3.25.0", "3.25.9", "3.26.0-beta.1", "3.26.0-beta.3"]) assert.equal(appShowsOrigin(prod, v), false, String(v));
  for (const v of ["3.26.0", "3.26.1", "9.0.0"]) assert.equal(appShowsOrigin(prod, v), true, String(v));
  for (const v of [undefined, "3.25.0", "3.26.0", "9.0.0"]) {
    assert.equal(appShowsOrigin(prod, v, "", ""), false, `${v}, no gate`);
    assert.equal(appShowsOrigin(beta, v, "", ""), false, `beta ${v}, no beta gate`);
  }
  // the beta app from its own gate (3.26.0-beta.1, the app's 3.26.0-beta.1 out 2026-11-08): never an unknown version
  assert.equal(appShowsOrigin(beta, undefined), false, "an unknown version stays off");
  assert.equal(appShowsOrigin(beta, "3.25.0"), false);
  if (APP_SHOWS_ORIGIN_BETA) for (const v of [APP_SHOWS_ORIGIN_BETA, "3.26.0", "9.0.0"]) assert.equal(appShowsOrigin(beta, v), true, `beta ${v}`);
  assert.equal(appShowsOrigin(prod, "3.26.0-beta.1"), false, "the production app: its own gate");
  assert.equal(appShowsOrigin(prod, "3.27.0", "3.27.0"), true);
  assert.equal(appShowsOrigin(prod, "3.26.9", "3.27.0"), false);
  assert.equal(appShowsOrigin(prod, "3.27.0-beta.3", "3.27.0"), false, "a pre-release before the release");
  assert.equal(appShowsOrigin(prod, undefined, "3.27.0"), false, "an unknown version stays off");
  assert.equal(appShowsOrigin(beta, "3.26.0-beta.1", undefined, "3.26.0-beta.2"), false);
  assert.equal(appShowsOrigin(beta, "3.26.0-beta.2", undefined, "3.26.0-beta.2"), true);
  assert.equal(appShowsOrigin(prod, "3.26.0-beta.2", undefined, "3.26.0-beta.2"), false, "the production app: its own gate");
});

test("the app's marks: one source for each import (made once, reused), its values cite it with their parts; unmarked ones the user's; a child's mark passed; the same send again changes nothing", opts, async () => {
  const { w, send } = await adopted();
  try {
    // the adoption: one source of the import, the values it marks cite it
    let imp = imports(w);
    assert.equal(imp.length, 1);
    const s = imp[0]!;
    assert.deepEqual(s.imported, { key: "I1", program: "MyHeritage Family Tree Builder", version: "8.0", date: "12 MAR 2024", at: "2026-11-08", file: "lhotakovi.ged", sha: "3f9a0c" });
    assert.equal(s.kind, "family-tree");
    assert.equal(s.form, "authored");
    assert.equal(s.information, "secondary");
    assert.match(s.title, /MyHeritage Family Tree Builder 12 MAR 2024, lhotakovi\.ged/u);
    const vaclav = named(w, "Václav");
    assert.deepEqual(vaclav.names[0]!.origin, { by: "import", source: s.id });
    assert.ok(vaclav.names[0]!.citations?.some((c) => c.source === s.id));
    assert.deepEqual(vaclav.sexOrigin, { by: "import", source: s.id }, "the person's mark: their sex too");
    const birt = fact(vaclav, "BIRT");
    assert.deepEqual(birt.origin, { by: "import", source: s.id, parts: ["date"] }, "the import's date, the user's place");
    assert.equal(birt.place, PLACE);
    assert.ok(birt.citations.some((c) => c.source === s.id));
    assert.ok(birt.citations.some((c) => c.source !== s.id), "the user's part cites the day's source");
    const deat = fact(vaclav, "DEAT");
    assert.deepEqual(deat.origin, { by: "user" });
    assert.ok(!deat.citations.some((c) => c.source === s.id));
    const ondrej = named(w, "Ondřej");
    assert.deepEqual(ondrej.names[0]!.origin, { by: "user" });
    assert.deepEqual(ondrej.sexOrigin, { by: "user" });
    assert.deepEqual(named(w, "Ludmila").sexOrigin, { by: "import", source: s.id });
    // a child's link of the import (2 _STROM_IMPORT under CHIL): passed, the child where it was
    const f = open(w).list<Family>("family")[0]!;
    assert.ok(f.children.some((c) => c.person === ondrej.id), "Ondřej their child");
    assert.deepEqual(fact(f, "MARR").origin, { by: "import", source: s.id });

    // the same tree sent again: nothing to take, nothing written
    const n = gitHead(w);
    const again = (await w.ok(["sync", send(appPeople), "--apply", "--json"], FROM_APP)).json;
    assert.deepEqual(again.changes ?? [], [], JSON.stringify(again.changes));
    assert.equal(gitHead(w), n, "nothing written");
    assert.equal(imports(w).length, 1);

    // a send with a new person of the import and the user's own fact: the same source cited, never a second one
    const more = [...appPeople, "0 @I4@ INDI", "1 _STROM_IMPORT I1", "1 NAME Jiří /Lhoták/", "2 _STROM_IMPORT I1", "1 SEX M", "1 BIRT", "2 DATE 1904", "2 _STROM_IMPORT I1", "1 FAMC @F1@"];
    more.splice(more.indexOf("1 CHIL @I3@") + 2, 0, "1 CHIL @I4@", "2 _STROM_IMPORT I1");
    const r = (await w.ok(["sync", send(more), "--apply", "--json"], FROM_APP)).json;
    assert.ok((r.changes ?? []).length > 0);
    imp = imports(w);
    assert.equal(imp.length, 1, "the import's source reused");
    const jiri = named(w, "Jiří");
    assert.deepEqual(jiri.names[0]!.origin, { by: "import", source: s.id });
    assert.deepEqual(jiri.sexOrigin, { by: "import", source: s.id });
    assert.deepEqual(fact(jiri, "BIRT").origin, { by: "import", source: s.id });
    assert.ok(fact(jiri, "BIRT").citations.some((c) => c.source === s.id));
    // what was there keeps its origin and its citations (nothing churns)
    assert.deepEqual(fact(named(w, "Václav"), "BIRT"), birt);
    assert.deepEqual(fact(named(w, "Václav"), "DEAT"), deat);
    // and once more: nothing
    const third = (await w.ok(["sync", send(more), "--apply", "--json"], FROM_APP)).json;
    assert.deepEqual(third.changes ?? [], []);
    assert.equal(imports(w).length, 1);
    assert.match((await w.ok(["check"])).out, /^ok/);
  } finally {
    w.cleanup();
  }
});

test("undoing a send puts back where a fact and a sex came from; the import's source a later value still cites stays", opts, async () => {
  const { w, send } = await adopted();
  try {
    const s = imports(w)[0]!;
    // the user changes the import's date and Ludmila's sex in the app (no mark: theirs now)
    const lines = appPeople.map((l) => (l === "2 DATE 1875" ? "2 DATE 1876" : l)).filter((l, i, all) => !(l === "2 _STROM_IMPORT I1" && all[i - 1] === "2 DATE 1876"));
    const sexAt = lines.indexOf("1 SEX F");
    lines.splice(sexAt, 2, "1 SEX M");
    const r = (await w.ok(["sync", send(lines), "--apply", "--json", "--edits", "user"], FROM_APP)).json;
    const ludmila = named(w, "Ludmila");
    assert.equal(fact(ludmila, "BIRT").date, "1876");
    assert.deepEqual(fact(ludmila, "BIRT").origin, { by: "user" });
    assert.equal(fact(ludmila, "BIRT").was?.date, "1875", "the family tree's value kept to put back");
    assert.equal(ludmila.sex, "M");
    assert.deepEqual(ludmila.sexOrigin, { by: "user" });
    assert.equal(ludmila.sexWas?.sex, "F");
    await w.ok(["sync", "undo", r.input as string]);
    const back = named(w, "Ludmila");
    assert.equal(fact(back, "BIRT").date, "1875");
    assert.deepEqual(fact(back, "BIRT").origin, { by: "import", source: s.id });
    assert.equal(fact(back, "BIRT").was, undefined);
    assert.equal(back.sex, "F");
    assert.deepEqual(back.sexOrigin, { by: "import", source: s.id }, "the sex the import's again");
    assert.equal(back.sexWas, undefined);
    assert.equal(imports(w).length, 1, "the import's source stays: the adoption cites it");
    assert.match((await w.ok(["check"])).out, /^ok/);
  } finally {
    w.cleanup();
  }
});

test("another program's file carrying the app's marks: never read — all of it the import's, of strom's own key", opts, async () => {
  const w = new World();
  try {
    await w.withTree("Lhotákovi");
    const file = path.join(w.dir, "cizi.ged");
    fs.writeFileSync(
      file,
      ged([
        "0 HEAD", "1 SOUR MyHeritage", "2 NAME MyHeritage Family Tree Builder", "1 DATE 3 MAR 2020", "1 CHAR UTF-8", ...IMPORT_HEAD,
        "0 @I1@ INDI", "1 _STROM_IMPORT I1", "1 NAME Jan /Lhoták/", "2 _STROM_ORIGIN user", "1 SEX M", "1 _STROM_SEX_ORIGIN user",
        "1 BIRT", "2 DATE 1841", "2 PLAC Lhota", "2 _STROM_IMPORT I1 DATE", "2 _STROM_ORIGIN user",
        "1 DEAT", "2 DATE 1900", "2 _STROM_ORIGIN user",
      ]),
    );
    await w.ok(["intake", file], AGENT);
    const s = imports(w);
    assert.deepEqual(s.map((x) => x.imported?.key), ["R1"], "no source of the app's I1");
    const jan = named(w, "Jan");
    for (const e of jan.events) assert.deepEqual(e.origin, { by: "import", source: s[0]!.id }, e.kind);
    assert.deepEqual(jan.names[0]!.origin, { by: "import", source: s[0]!.id });
    assert.deepEqual(jan.sexOrigin, { by: "import", source: s[0]!.id });
  } finally {
    w.cleanup();
  }
});

const GED = [
  "0 HEAD", "1 SOUR MyHeritage", "2 NAME MyHeritage Family Tree Builder", "2 VERS 8.0", "1 DATE 3 MAR 2020", "1 CHAR UTF-8",
  "0 @I1@ INDI", "1 NAME Jan /Lhoták/", "1 SEX M", "1 BIRT", "2 DATE 12 MAR 1841", `2 PLAC ${PLACE}`, "1 OCCU rolník",
  "0 @I2@ INDI", "1 NAME Anna /Lhotáková/", "1 SEX F", "1 BIRT", "2 DATE 1845", "2 PLAC Lhota",
  "0 @F1@ FAM", "1 HUSB @I1@", "1 WIFE @I2@", "1 MARR", "2 DATE 1865", "2 PLAC Lhota",
];

/** Lhotákovi of another program's family tree (S0001, R1; P0001 Jan, P0002 Anna), a register (S0002), Jan's birth changed by an agent on it. */
async function corrected(): Promise<{ w: World; birt: string }> {
  const w = new World();
  await w.withTree("Lhotákovi");
  const file = path.join(w.dir, "lhotakovi.ged");
  fs.writeFileSync(file, ged(GED));
  await w.ok(["intake", file], AGENT);
  await w.ok(["source", "add", "Křest Jana Lhotáka 1841", "--kind", "baptism"], AGENT); // S0002
  const birt = fact(open(w).get<Person>("P0001")!, "BIRT").id;
  await w.ok(["event", "edit", birt, "--date", "14 MAR 1841", "--place", "Lhota", "--cite", "S0002", "--locator", "fol. 3", "--reason", "matrika"], AGENT);
  // the user's own: Anna's death typed at the terminal; Anna's name the person corrected
  await w.ok(["event", "add", "P0002", "DEAT", "--date", "1910", "--place", "Lhota"], PERSON);
  await w.ok(["person", "edit", "P0002", "--name", "Anna /Lhotakova/", "--reason", "pravopis"], PERSON);
  return { w, birt };
}

test("the Strom file with the gate: each value's origin, one _STROM_WAS for each part changed (a place with commas whole), the imports in the header; read back, nothing changes; without the gate none of it", opts, async () => {
  const { w, birt } = await corrected();
  try {
    const tree = open(w);
    const t = exportGedcom(tree, { for: "strom", origins: true, head: gitHead(w) }).text;
    assert.deepEqual(validateGedcom(t).filter((f) => f.level === "error"), []);
    assert.deepEqual(validateGedcom(t).filter((f) => /_STROM_(ORIGIN|SEX_ORIGIN|WAS|IMPORT|KIND)|_PART|_REF|_SHA|_AT/.test(f.message)), [], "no warning of the new tags");
    // the header: the import its values name, as the research keeps it
    assert.match(t, /\n1 _STROM_IMPORT R1\n2 SOUR MyHeritage Family Tree Builder\n2 VERS 8\.0\n2 DATE 3 MAR 2020\n(?:2 _AT .*\n)?2 FILE lhotakovi\.ged\n/u);
    const root = parseGedcomText(t).records;
    const indi = (id: string) => root.find((r) => r.tag === "INDI" && val(r, "REFN") === id)!;
    const jan = indi("P0001");
    const janBirt = children(jan, "BIRT")[0]!;
    assert.equal(val(janBirt, "_STROM_ORIGIN"), "research", "changed on a record: the research's");
    const was = children(janBirt, "_STROM_WAS");
    assert.equal(was.length, 2, "one for each part, never joined");
    assert.deepEqual(was.map((x) => [x.value, val(x, "_STROM_IMPORT"), children(x, "_PART").map((p) => p.value), val(x, "_REF")]), [
      ["12 MAR 1841", "R1", ["DATE"], birt],
      [PLACE, "R1", ["PLAC"], birt],
    ]);
    assert.ok(children(janBirt, "SOUR").some((c) => c.value === "@S0002@"), "the record it changed by stays cited");
    assert.equal(val(children(jan, "OCCU")[0]!, "_STROM_ORIGIN"), "import R1");
    assert.equal(val(children(jan, "NAME")[0]!, "_STROM_ORIGIN"), "import R1");
    assert.equal(val(jan, "_STROM_SEX_ORIGIN"), "import R1");
    const anna = indi("P0002");
    assert.equal(val(children(anna, "DEAT")[0]!, "_STROM_ORIGIN"), "user");
    const annaName = children(anna, "NAME")[0]!;
    assert.equal(val(annaName, "_STROM_ORIGIN"), "user");
    assert.deepEqual(children(annaName, "_STROM_WAS").map((x) => [x.value, val(x, "_PART"), val(x, "_REF")]), [["Lhotáková", "SURN", "N:P0002:1"]]);
    // read back as it is, and as the app would send it (its own SOUR, the research's origins as its marks): nothing
    for (const text of [t, t.replace("1 SOUR STROM_RESEARCH", "1 SOUR STROM").replace(/^(\d) _STROM_ORIGIN import (.*)$/gmu, "$1 _STROM_IMPORT $2")]) {
      const plan = planSync(open(w), readGedcom(text), "conflict");
      assert.deepEqual(plan.changes.map((c) => `${c.kind} ${c.person ?? ""}`), []);
    }
    const back = path.join(w.dir, "back.ged");
    fs.writeFileSync(back, t.replace("1 SOUR STROM_RESEARCH", "1 SOUR STROM").replace(/^(\d) _STROM_ORIGIN import (.*)$/gmu, "$1 _STROM_IMPORT $2"));
    const n = gitHead(w);
    const r = (await w.ok(["sync", back, "--apply", "--json"], FROM_APP)).json;
    assert.deepEqual(r.changes ?? [], []);
    assert.equal(gitHead(w), n);
    assert.equal(imports(w).length, 1, "the research's import known by its key and file: no second");
    // without the gate (an app of unknown version, the CLI's export): none of it
    const plain = exportGedcom(open(w), { for: "strom" }).text;
    assert.doesNotMatch(plain, /_STROM_(ORIGIN|SEX_ORIGIN|WAS|IMPORT|KIND)/u);
    await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", path.join(w.dir, "cli.ged")]);
    assert.doesNotMatch(fs.readFileSync(path.join(w.dir, "cli.ged"), "utf8"), /_STROM_(ORIGIN|WAS)/u);
    assert.doesNotMatch(exportGedcom(open(w), { for: "standard", origins: true }).text, /_STROM_/u, "never the standard file");
  } finally {
    w.cleanup();
  }
});

test("a proposal's conflict says whose value it would change (_STROM_KIND) and its sides", opts, async () => {
  const { w } = await corrected();
  try {
    const anna = fact(open(w).get<Person>("P0002")!, "BIRT").id;
    const p = (await w.ok(["event", "edit", anna, "--date", "1846", "--reason", "věk při sňatku", "--json"], AGENT)).json;
    assert.match(p.proposed, /^X\d+$/);
    const t = exportGedcom(open(w), { for: "strom", origins: true, conflictSides: true, research: true }).text;
    const x = parseGedcomText(t).records.find((r) => r.tag === "INDI" && val(r, "REFN") === "P0002")!;
    const c = children(x, "_STROM_CONFLICT").find((n) => n.value === p.proposed)!;
    assert.ok(c, t.split("\n").filter((l) => /CONFLICT|^2 /.test(l)).join("\n"));
    assert.equal(val(c, "_STROM_KIND"), "import");
    assert.equal(val(c, "_STROM_TAKE"), "Y");
    assert.deepEqual(children(c, "VAL").map((v) => val(v, "_STROM_SIDE")).sort(), ["research", "user"]);
    assert.doesNotMatch(exportGedcom(open(w), { for: "strom", conflictSides: true, research: true }).text, /_STROM_KIND import/u, "without the gate: none");
  } finally {
    w.cleanup();
  }
});

type Answer = { status: number; body: any; headers: http.IncomingHttpHeaders };
function request(url: string, method = "GET", body?: unknown, headers: Record<string, string> = { Origin: APP }): Promise<Answer> {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? undefined : Buffer.from(typeof body === "string" ? body : JSON.stringify(body), "utf8");
    const req = http.request(url, { agent: false, method, headers: { ...headers, ...(data ? { "Content-Type": "text/plain;charset=UTF-8", "Content-Length": String(data.length) } : {}) } }, (res) => {
      let text = "";
      res.setEncoding("utf8");
      res.on("data", (d) => (text += d));
      res.on("end", () => {
        let parsed: any = text;
        try {
          parsed = JSON.parse(text);
        } catch {
          // not JSON
        }
        resolve({ status: res.statusCode ?? 0, body: parsed, headers: res.headers });
      });
    });
    req.on("error", reject);
    req.end(data);
  });
}

test("POST /facts/revert: the family tree's value put back as the user's — a part, a name; every refusal; feature origin", bridgeOpts, async () => {
  const { w, birt } = await corrected();
  Object.assign(w.env, { STROM_LOCK_WAIT_MS: "1500", STROM_APP_URL: "https://beta.stromapp.info/run/" });
  let started = false;
  try {
    const ev = (id: string): Event => [...open(w).list<Person>("person"), ...open(w).list<Family>("family")].flatMap((o) => o.events).find((e) => e.id === id)!;
    const info = (await w.ok(["live", "start", "--json"])).json as { url: string };
    started = true;
    assert.ok(BRIDGE_FEATURES.includes("origin"));
    assert.ok((await request(`${info.url}/status`)).body.features.includes("origin"));
    // origin.ids only with the IDs in /tree.ged, both by the gate of the origins (an app told so drops its own IDs);
    // the beta app here: from APP_SHOWS_ORIGIN_BETA, an unknown version never
    const betaApp = new Settings(w.env, {});
    for (const app of ["", "?app=3.25.0", "?app=3.26.0-beta.1", "?app=3.26.0", "?app=9.0.0"]) {
      const v = app.slice("?app=".length) || undefined;
      const shows = appShowsOrigin(betaApp, v);
      assert.equal((await request(`${info.url}/status${app}`)).body.features.includes("origin.ids"), shows, app);
      const tree = await new Promise<string>((resolve, reject) => http.get(`${info.url}/tree.ged${app}`, (r) => { let t = ""; r.setEncoding("utf8"); r.on("data", (c) => (t += c)); r.on("end", () => resolve(t)); }).on("error", reject));
      if (shows) assert.match(tree, /^\d _STROM_IMPORT /m, app);
      else assert.doesNotMatch(tree, /^\d _STROM_IMPORT /m, app);
    }
    if (APP_SHOWS_ORIGIN_BETA) assert.ok(appShowsOrigin(betaApp, APP_SHOWS_ORIGIN_BETA), "the beta app of the beta gate gets the marks");
    const url = `${info.url}/facts/revert`;
    const post = (body: unknown) => request(url, "POST", body);

    // only the app's page writes
    const foreign = await request(url, "POST", { person: "P0001", ref: birt }, {});
    assert.deepEqual([foreign.status, foreign.body.code], [403, "app.only"]);
    for (const bad of [{}, { person: "P0001" }, { ref: birt }, { person: "S0001", ref: birt }, { person: "P0001", ref: birt, part: "BIRT" }, { person: "P0001", ref: birt, at: "x" }, { person: "P0001", ref: 12 }, "x"]) {
      const r = await post(bad);
      assert.deepEqual([r.status, r.body.code], [400, "revert.invalid"], JSON.stringify(bad));
    }
    for (const unknown of [{ person: "P0001", ref: "E0999" }, { person: "P0002", ref: birt }, { person: "P0001", ref: "N:P0002:1" }, { person: "P0001", ref: "N:P0001:7" }, { person: "P0001", ref: "něco" }]) {
      const r = await post(unknown);
      assert.deepEqual([r.status, r.body.code], [404, "revert.unknown"], JSON.stringify(unknown));
    }
    const occu = fact(open(w).get<Person>("P0001")!, "OCCU").id;
    for (const nothing of [{ person: "P0001", ref: occu }, { person: "P0001", ref: "SEX:P0001" }, { person: "P0001", ref: birt, part: "SURN" }]) {
      const r = await post(nothing);
      assert.deepEqual([r.status, r.body.code], [409, "revert.nothing"], JSON.stringify(nothing));
    }

    // the place alone: back as the family tree gave it, the date stays the record's
    const ok = await post({ person: "P0001", ref: birt, part: "PLAC" });
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    assert.deepEqual([ok.body.ok, ok.body.reverted?.ref, ok.body.reverted?.parts], [true, birt, ["place"]]);
    assert.notEqual(ok.body.head, ok.body.parent, "written");
    let e = ev(birt);
    assert.equal(e.place, PLACE);
    assert.equal(e.date, "14 MAR 1841");
    assert.deepEqual(e.origin, { by: "user" }, "the user's from then on");
    assert.deepEqual(e.was?.parts, ["date"]);
    assert.ok(e.citations.some((c) => c.source === "S0001"), "the family tree cited again");
    const again = await post({ person: "P0001", ref: birt, part: "PLAC" });
    assert.deepEqual([again.status, again.body.code], [409, "revert.nothing"]);
    // the rest (the ref as the file says it, any case)
    assert.equal((await post({ person: "p1", ref: birt.toLowerCase() })).status, 200);
    e = ev(birt);
    assert.equal(e.date, "12 MAR 1841");
    assert.equal(e.was, undefined);

    // a name's part the person changed
    const name = await post({ person: "P0002", ref: "N:P0002:1", part: "SURN" });
    assert.equal(name.status, 200, JSON.stringify(name.body));
    assert.equal(open(w).get<Person>("P0002")!.names[0]!.surname, "Lhotáková");

    // the research held by another strom: busy, nothing written
    await w.ok(["person", "edit", "P0002", "--sex", "M", "--reason", "omyl"], PERSON);
    const lock = path.join(w.cwd, ".strom", "tree.lock");
    fs.writeFileSync(lock, JSON.stringify({ pid: process.pid, host: os.hostname(), at: new Date().toISOString(), owner: "a test" }));
    const busy = await post({ person: "P0002", ref: "SEX:P0002" });
    fs.rmSync(lock);
    assert.deepEqual([busy.status, busy.body.code, busy.headers["retry-after"] !== undefined], [503, "research.busy", true]);
    assert.equal(open(w).get<Person>("P0002")!.sex, "M");
    const sex = await post({ person: "P0002", ref: "SEX:P0002", part: "SEX" });
    assert.equal(sex.status, 200, JSON.stringify(sex.body));
    assert.equal(open(w).get<Person>("P0002")!.sex, "F");
    assert.deepEqual(open(w).get<Person>("P0002")!.sexOrigin, { by: "user" });
    assert.match((await w.ok(["check"])).out, /^ok/);
  } finally {
    if (started) await w.run(["live", "stop"]);
    w.cleanup();
  }
});
