// The research in the table of the Strom app (its §16.10; core/tablemarks.ts): each person's places among the lines by
// the rule the queue places tasks by (core/offline.ts personPlaces), what waits outside for them and the people the
// research added — in the Strom file of an app that shows it (APP_SHOWS_RESEARCH_TABLE) and live through the bridge's
// GET /directions/people (places, rev; /status directions.rev).

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { World, hasGit } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import { Settings } from "../../src/core/config.ts";
import { exportGedcom } from "../../src/gedcom/export.ts";
import { validateGedcom } from "../../src/gedcom/validate.ts";
import { APP_SHOWS_RESEARCH_TABLE, APP_SHOWS_RESEARCH_TABLE_BETA, appShowsResearchTable } from "../../src/core/stromapp.ts";
import { personPlaces } from "../../src/core/offline.ts";
import { placesJson, tableMarks } from "../../src/core/tablemarks.ts";

const opts = { skip: !hasGit, timeout: 240_000 };
const BETA_APP = { STROM_APP_URL: "https://beta.stromapp.info/run/", STROM_APP_VERSION: "3.27.0-beta.4" };
const APP = "https://beta.stromapp.info";
const open = (w: World) => Tree.open(w.cwd, w.env);

/**
 * As test/cli/offline-lines.test.ts: the ancestors of Jan Lhoták (G0001: Jan P1, his parents Josef P2 and Marie P3,
 * Josef's father Václav P5) and the ancestors of Marie (G0002). Josef's sister Anna (P4) and her husband Karel (P6): a
 * side branch. Tomáš (P7) linked to nobody: an island; Ludmila (P8), Václav's second wife: the partner of a person of G0001.
 */
async function world(lines = 2): Promise<World> {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["lang", "cs"]);
  await w.ok(["research", "new", "Předci Jana", "--new-person", "Jan /Lhoták/", "--sex", "M"]);
  await w.ok(["person", "add", "Josef /Lhoták/", "--sex", "M"]); // P2
  await w.ok(["person", "add", "Marie /Lhotová/", "--sex", "F"]); // P3
  await w.ok(["person", "add", "Anna /Lhotáková/", "--sex", "F"]); // P4
  await w.ok(["person", "add", "Václav /Lhoták/", "--sex", "M"]); // P5
  await w.ok(["person", "add", "Karel /Lhotský/", "--sex", "M"]); // P6
  await w.ok(["family", "add", "--partner", "P2", "--partner", "P3", "--child", "P1"]);
  await w.ok(["family", "add", "--partner", "P5", "--child", "P2", "--child", "P4"]);
  await w.ok(["family", "add", "--partner", "P4", "--partner", "P6"]);
  await w.ok(["person", "add", "Tomáš /Lhoták/", "--sex", "M"]); // P7
  await w.ok(["person", "add", "Ludmila /Lhotská/", "--sex", "F"]); // P8
  await w.ok(["family", "add", "--partner", "P5", "--partner", "P8"]);
  if (lines > 1) await w.ok(["research", "new", "Předci Marie", "--person", "P3"]);
  return w;
}

const task = (w: World, what: string, about: string[]) =>
  w.ok(["task", "add", what, "--level", "locate", "--where", "katalog archivu Lhota", "--why", "rodiče", "--done-when", "kniha nalezena", ...about.flatMap((a) => ["--about", a]), "--json"]);

/** The Strom file of an app of `env`. */
async function stromFile(w: World, env: Record<string, string>): Promise<string> {
  const file = path.join(w.cwd, "output", "tree-strom.ged");
  fs.rmSync(file, { force: true });
  await w.ok(["export", "gedcom", "--for", "strom"], { env });
  return fs.readFileSync(file, "utf8");
}

/** A person's record of the file, from its 0 line to the next. */
function indi(text: string, id: string): string {
  const at = text.indexOf(`0 @${id}@ INDI\n`);
  assert.ok(at >= 0, id);
  const end = text.indexOf("\n0 ", at + 1);
  return text.slice(at, end);
}

/** The places of each person as the file says them. */
function placesInFile(text: string): Record<string, { line?: string; role: string; branch?: string }[]> {
  const out: Record<string, { line?: string; role: string; branch?: string }[]> = {};
  let who: string | undefined;
  let at: { line?: string; role: string; branch?: string } | undefined;
  for (const row of text.split("\n")) {
    const rec = /^0 @(P\d+)@ INDI$/u.exec(row);
    if (rec) [who, at] = [rec[1]!, undefined];
    else if (row.startsWith("0 ")) [who, at] = [undefined, undefined];
    else if (who && /^1 _STROM_DIRECTION(?: (G\d+))?$/u.test(row)) {
      const line = /^1 _STROM_DIRECTION(?: (G\d+))?$/u.exec(row)![1];
      at = { ...(line ? { line } : {}), role: "" };
      (out[who] ??= []).push(at);
    } else if (row.startsWith("1 ")) at = undefined;
    else if (at && row.startsWith("2 TYPE ")) at.role = row.slice(7);
    else if (at && row.startsWith("2 _BRANCH ")) at.branch = row.slice(10);
  }
  return out;
}

type Answer = { status: number; body: any };
function request(url: string): Promise<Answer> {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { agent: false, headers: { Origin: APP } }, (res) => {
      let text = "";
      res.setEncoding("utf8");
      res.on("data", (d) => (text += d));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, body: JSON.parse(text) }));
    });
    req.on("error", reject);
    req.end();
  });
}

test("the places among the lines: a line, both lines, the partner, an ancestor's sister a branch, an island — as the queue places their tasks", opts, async () => {
  const w = await world();
  try {
    const places = placesJson(personPlaces(open(w)).people);
    assert.deepEqual(places, {
      P0001: [{ line: "G0001", role: "line" }],
      P0002: [{ line: "G0001", role: "line" }],
      // the narrowest line first
      P0003: [{ line: "G0002", role: "line" }, { line: "G0001", role: "line" }],
      P0005: [{ line: "G0001", role: "line" }],
      P0008: [{ line: "G0001", role: "partner" }],
      P0004: [{ role: "branch", branch: "B-P0004" }],
      P0006: [{ role: "branch", branch: "B-P0004" }],
      P0007: [{ role: "island" }],
    });
    // the queue places the tasks of the same people so
    const josef = (await task(w, "Křest Josefa", ["P2"])).json;
    assert.equal(josef.task.research, "G0001");
    const ludmila = (await task(w, "Oddavky Ludmily", ["P8"])).json;
    assert.equal(ludmila.task.research, undefined);
    const tasks = (await w.ok(["task", "list", "--json"])).json.tasks as { id: string; helps?: { by: string; research?: string }; branch?: string; offLine?: string }[];
    assert.deepEqual(tasks.find((t) => t.id === ludmila.task.id)!.helps, { by: "partner", research: "G0001" });
    const anna = (await task(w, "Oddavky Anny", ["P4"])).json;
    assert.equal(anna.branch, "B-P0004");
    const karel = (await task(w, "Křest Karla", ["P6"])).json;
    assert.equal(karel.branch, "B-P0004");

    // the person adds the branch to Marie's line: its people are that line's
    await w.ok(["offline", "set", "B-P0004", "--line", "G0002"]);
    const added = placesJson(personPlaces(open(w)).people);
    assert.deepEqual([added.P0004, added.P0006], [[{ line: "G0002", role: "branch", branch: "B-P0004" }], [{ line: "G0002", role: "branch", branch: "B-P0004" }]]);
    const marks = tableMarks(open(w));
    assert.deepEqual(marks.branches, [{ id: "B-P0004", person: "P0004", via: { person: "P0002", rel: "sibling" }, nearest: "G0001", line: "G0002" }]);
    assert.deepEqual(marks.lines.map((l) => [l.id, l.name, l.direction, l.focus, l.state]), [["G0001", "Předci Jana", "ancestors", "P0001", "active"], ["G0002", "Předci Marie", "ancestors", "P0003", "active"]]);
  } finally {
    w.cleanup();
  }
});

test("one line: no branches — the people off it are outside (nothing written), a person linked to nobody an island", opts, async () => {
  const w = await world(1);
  try {
    const marks = tableMarks(open(w));
    assert.deepEqual(marks.branches, []);
    const places = placesJson(marks.places);
    assert.deepEqual([places.P0004, places.P0006, places.P0008, places.P0007], [undefined, undefined, [{ line: "G0001", role: "partner" }], [{ role: "island" }]]);
  } finally {
    w.cleanup();
  }
});

test("the gate: a beta copy of the app from 3.27.0-beta.4, the production app only from its version (none yet), an unknown version never; the standard file never", () => {
  const prod = new Settings({ STROM_APP_URL: "https://stromapp.info/run/" }, {});
  const beta = new Settings({ STROM_APP_URL: "https://beta.stromapp.info/run/" }, {});
  assert.equal(APP_SHOWS_RESEARCH_TABLE_BETA, "3.27.0-beta.4");
  assert.equal(appShowsResearchTable(beta, "3.27.0-beta.3"), false, "the beta before the one that reads the tags");
  assert.equal(appShowsResearchTable(beta, "3.27.0-beta.4"), true);
  assert.equal(appShowsResearchTable(beta, "3.27.0"), true);
  assert.equal(appShowsResearchTable(beta, undefined), false, "a beta copy of unknown version: nothing, as production");
  assert.equal(appShowsResearchTable(beta, "nonsense"), false);
  assert.equal(appShowsResearchTable(prod, "3.26.0"), false, "the production app today");
  assert.equal(appShowsResearchTable(prod, "9.0.0"), false, "no production gate yet");
  assert.equal(appShowsResearchTable(prod, undefined), false);
  // a production gate, once set
  assert.equal(appShowsResearchTable(prod, "3.27.0", "3.27.0"), true);
  assert.equal(appShowsResearchTable(prod, "3.26.9", "3.27.0"), false);
  assert.equal(appShowsResearchTable(prod, undefined, "3.27.0"), false);
  assert.equal(APP_SHOWS_RESEARCH_TABLE, undefined, "the production app shows no research table yet");
});

test("the Strom file: the lines and branches in the header, each person's places as the queue's, a letter waiting, who the research added; validated; sent back unedited it brings nothing", opts, async () => {
  const w = await world();
  try {
    // a letter to an office named in decomposed letters (NFD): written in NFC, sent
    await task(w, "Opis křtu Josefa", ["P2"]); // T1
    await w.ok(["task", "wait", "T1", "--kind", "letter", "--to", "matriční úřad Lhota".normalize("NFD"), "--on", "odpověď matričního úřadu Lhota na žádost o opis"]);
    await w.ok(["task", "sent", "T1"]);
    await task(w, "Je Tomáš synem Ludmily?", ["P7", "P8"]); // T2
    await w.ok(["task", "wait", "T2", "--kind", "family", "--to", "teta Lhotská", "--on", "odpověď tety na dotaz"]);

    // before the gate (the production app, an unknown one): none of it
    for (const env of [{ STROM_APP_VERSION: "9.0.0" }, {}] as Record<string, string>[])
      assert.doesNotMatch(await stromFile(w, env), /_STROM_DIRECTION|_STROM_BRANCH|_STROM_WAIT|_STROM_ADDED/u, JSON.stringify(env));

    const text = await stromFile(w, BETA_APP);
    assert.deepEqual(validateGedcom(text), []);
    assert.match(text, /\n1 _STROM_DIRECTIONS Y\n1 _STROM_DIRECTION G0001\n2 NAME Předci Jana\n2 TYPE ancestors\n2 _FOCUS P0001\n2 STAT active\n1 _STROM_DIRECTION G0002\n2 NAME Předci Marie\n2 TYPE ancestors\n2 _FOCUS P0003\n2 STAT active\n1 _STROM_BRANCH B-P0004\n2 _VIA P0002\n3 TYPE sibling\n2 _NEAREST G0001\n/u);
    // each person's places: what the bridge and the queue say
    assert.deepEqual(placesInFile(text), placesJson(personPlaces(open(w)).people));
    assert.match(indi(text, "P0003"), /\n1 _STROM_DIRECTION G0002\n2 TYPE line\n1 _STROM_DIRECTION G0001\n2 TYPE line\n/u);
    assert.match(indi(text, "P0004"), /\n1 _STROM_DIRECTION\n2 TYPE branch\n2 _BRANCH B-P0004\n/u);
    assert.match(indi(text, "P0007"), /\n1 _STROM_DIRECTION\n2 TYPE island\n/u);
    // the letter about Josef: where it is handled, sent when
    const josef = indi(text, "P0002");
    assert.match(josef, /\n1 _STROM_WAIT T0001\n2 TYPE letter\n2 TITL Opis křtu Josefa\n2 _ON odpověď matričního úřadu Lhota na žádost o opis\n2 _GROUP matriční úřad Lhota\n3 TYPE office\n3 _KEY to:matricni urad lhota\n2 STAT sent\n2 _SENT \d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ\n2 _PRIO \d+\n/u);
    assert.ok(josef.includes("matriční úřad Lhota".normalize("NFC")) && !josef.includes("matriční úřad Lhota".normalize("NFD")));
    // the question to the family: under both its people, not sent yet
    for (const p of ["P0007", "P0008"]) assert.match(indi(text, p), /\n1 _STROM_WAIT T0002\n2 TYPE family\n2 TITL Je Tomáš synem Ludmily\?\n2 _ON odpověď tety na dotaz\n2 _GROUP teta Lhotská\n3 TYPE office\n3 _KEY to:teta lhotska\n2 STAT todo\n2 _PRIO \d+\n/u);
    // the research added them all (none came from a family tree or the user)
    assert.match(indi(text, "P0001"), /\n1 _STROM_ADDED \d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ\n/u);
    // the standard file: never
    const standard = exportGedcom(open(w), { for: "standard", table: tableMarks(open(w)) }).text;
    assert.doesNotMatch(standard, /_STROM_DIRECTION|_STROM_WAIT|_STROM_ADDED/u);
    // the file sent back unedited: no edit
    const file = path.join(w.cwd, "output", "tree-strom.ged");
    const plan = (await w.ok(["sync", file, "--json"])).json;
    assert.deepEqual(plan.changes, [], JSON.stringify(plan.changes, null, 1));

    // an archive: the places stay (data of the tree), nothing waits
    await w.ok(["mode", "archive"], { tty: true });
    const archived = await stromFile(w, BETA_APP);
    assert.match(indi(archived, "P0004"), /\n1 _STROM_DIRECTION\n2 TYPE branch\n/u);
    assert.doesNotMatch(archived, /_STROM_WAIT/u);
  } finally {
    w.cleanup();
  }
});

test("the bridge: GET /directions/people places as the file says them, rev in /status changes when a branch is added to a line", { ...opts, skip: opts.skip || process.platform === "win32" }, async () => {
  const w = await world();
  try {
    const info = (await w.ok(["live", "start", "--json"])).json as { url: string };
    try {
      const s = (await request(`${info.url}/status?app=3.27.0-beta.4`)).body;
      assert.ok(s.features.includes("directions.places"));
      const d = (await request(`${info.url}/directions/people`)).body;
      assert.deepEqual(d.places, placesJson(personPlaces(open(w)).people));
      assert.deepEqual(d.people.P0003, ["G0002", "G0001"], "people as before");
      assert.deepEqual(d.branches.map((b: { id: string }) => b.id), ["B-P0004"]);
      assert.equal(s.directions.rev, d.rev);
      await w.ok(["offline", "set", "B-P0004", "--line", "G0002"]);
      const after = (await request(`${info.url}/directions/people`)).body;
      assert.notEqual(after.rev, d.rev);
      assert.deepEqual(after.places.P0006, [{ line: "G0002", role: "branch", branch: "B-P0004" }]);
      assert.equal((await request(`${info.url}/status?app=3.27.0-beta.4`)).body.directions.rev, after.rev);
    } finally {
      await w.run(["live", "stop"]);
    }
  } finally {
    w.cleanup();
  }
});
