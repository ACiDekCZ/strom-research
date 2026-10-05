// A person updates one of the two: this strom with the Strom app of an older version (test/fixtures/app/<version>.ged:
// the research as that app sends it back, made by test/fixtures/app/make.ts). What the older app does not know it
// drops (a story's new version, conflicts, hypotheses, where the tree ends, an original's hash) and what it folds
// (the notes "Lead — not proven") — none of it is an edit, nothing is taken away, not even by an archive.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { World, hasGit } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import type { Person } from "../../src/core/model.ts";
import { appCompatTree, fixtures } from "./app-compat.helpers.ts";

const opts = { skip: !hasGit || process.platform === "win32" };
const APPS = fs.readdirSync(path.join(fixtures, "app")).filter((f) => f.endsWith(".ged")).map((f) => f.replace(/\.ged$/, ""));
const prod = { Origin: "https://stromapp.info" };

/** The research of the helpers, and the app's file of it linked to this one (its ID, its head). */
async function sentBack(version: string): Promise<{ w: World; file: string; text: string }> {
  const w = new World();
  await appCompatTree(w);
  const tree = JSON.parse(fs.readFileSync(path.join(w.cwd, "strom.json"), "utf8")).id as string;
  const head = (await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", path.join(w.dir, "now.ged")])) && fs.readFileSync(path.join(w.dir, "now.ged"), "utf8").match(/^1 _STROM_HEAD (.+)$/m)![1]!;
  const text = fs.readFileSync(path.join(fixtures, "app", `${version}.ged`), "utf8").replaceAll("@TREE@", tree).replaceAll("@HEAD@", head);
  const file = path.join(w.dir, `z-aplikace-${version}.ged`);
  fs.writeFileSync(file, text);
  return { w, file, text };
}

function post(url: string, body: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method: "POST", headers: { ...prod, "Content-Type": "text/plain; charset=utf-8" } }, (res) => {
      let b = "";
      res.on("data", (d) => (b += d));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, body: b }));
    });
    req.on("error", reject);
    req.end(body);
  });
}

for (const version of APPS) {
  test(`the Strom app ${version}: the research it sends back unedited brings nothing — what it does not know is no edit`, opts, async () => {
    const { w, file } = await sentBack(version);
    const plan = (await w.ok(["sync", file, "--json"])).json;
    assert.deepEqual(plan.changes, [], JSON.stringify(plan.changes, null, 1));
    w.cleanup();
  });

  test(`the Strom app ${version} and an archive: the research sent back through the bridge as that app sends it takes nothing away`, opts, async () => {
    const { w, text } = await sentBack(version);
    await w.ok(["mode", "archive"], { tty: true });
    const before = Tree.open(w.cwd, w.env);
    const count = { persons: before.count("person"), facts: before.list<Person>("person").flatMap((p) => p.events).length };
    const info = (await w.ok(["live", "start", "--json"])).json;
    try {
      // as that app sends: POST /sync, no ?app=, no _STROM_APP_TREE
      const r = await post(`${info.url}/sync`, text);
      assert.equal(r.status, 200, r.body);
      const got = JSON.parse(r.body);
      assert.equal(got.changes, 0, r.body);
      const after = Tree.open(w.cwd, w.env);
      assert.deepEqual({ persons: after.count("person"), facts: after.list<Person>("person").flatMap((p) => p.events).length }, count);
      assert.ok(after.list<Person>("person").every((p) => !p.retracted && p.events.every((e) => !e.retracted)), "nothing withdrawn");
      // the story's new version, the conflict, the hypothesis are still there
      assert.ok(after.get<Person>("P0001")!.story?.draft, "the story's new version waits");
      assert.equal((await w.ok(["conflict", "list", "--json"])).json.conflicts.length, 1);
      // what the bridge says of the send, as that app reads it (fields it does not know it leaves)
      const status = JSON.parse(await (await fetch(`${info.url}/status`)).text());
      assert.equal(status.sends[0].state, "nothing");
    } finally {
      await w.ok(["live", "stop"]);
    }
    w.cleanup();
  });

  test(`the Strom app ${version}: edits made in it come in, and only those`, opts, async () => {
    const { w, file, text } = await sentBack(version);
    // in the app: Anna's birth added, a line to Josef's note, Karel's birth day "corrected", Josef's occupation
    // rewritten (a fact there may be more of: an edit of the one given, not one more)
    const edited = text
      .replace(/^1 OCCU mlynář$/m, "1 OCCU pekař")
      .replace(/(0 @I3@ INDI\r?\n1 NAME Anna \/Dvořáková\/\r?\n1 SEX F\r?\n)/, "$11 BIRT\n2 DATE 1863\n2 PLAC Týnec\n")
      // (an app before 3.9 folds the leads' notes into the person's; 3.9 says _STROM_STATUS and Josef has none)
      .replace(/(2 CONT Povolání — mlynář: Vodítko — nedoloženo záznamem\.\r?\n)/, "$12 CONT Mlýn stál pod hrází.\n")
      .replace(/(1 OCCU pekař\r?\n2 _STROM_STATUS lead\r?\n)/, "$11 NOTE Mlýn stál pod hrází.\n")
      .replace("2 DATE 12 MAR 1890\n2 PLAC Kamenice", "2 DATE 13 MAR 1890\n2 PLAC Kamenice");
    assert.notEqual(edited, text);
    fs.writeFileSync(file, edited);
    const plan = (await w.ok(["sync", file, "--json"])).json.changes as { kind: string; action: string; person?: string; text?: string }[];
    assert.deepEqual(
      plan.map((c) => [c.kind, c.action, c.person, c.text]),
      [
        ["fact.changed", "conflict", "P0001", undefined],
        ["fact.changed", "correct", "P0002", undefined],
        ["note.new", "add", "P0002", "Mlýn stál pod hrází."],
        ["fact.new", "add", "P0003", undefined],
      ],
      JSON.stringify(plan, null, 1),
    );
    await w.ok(["sync", file, "--apply"]);
    const josef = Tree.open(w.cwd, w.env).get<Person>("P0002")!;
    assert.deepEqual(josef.events.filter((e) => e.kind === "OCCU" && !e.retracted).map((e) => e.value), ["pekař"], "one occupation, the user's");
    w.cleanup();
  });
}

test("the bridge gives an app that says no version (one older than 3.9) only what it reads: no _STROM_STATUS, _STROM_READ, _STROM_MODE", opts, async () => {
  const w = new World();
  await appCompatTree(w);
  await w.ok(["mode", "archive"], { tty: true });
  const info = (await w.ok(["live", "start", "--json"])).json;
  try {
    const ged = await (await fetch(`${info.url}/tree.ged`, { headers: prod })).text();
    assert.doesNotMatch(ged, /_STROM_STATUS|_STROM_READ|_STROM_VERIFIED|_STROM_MODE/);
    assert.match(ged, /2 NOTE Vodítko — nedoloženo záznamem\./, "a lead said as the older app shows it");
  } finally {
    await w.ok(["live", "stop"]);
  }
  w.cleanup();
});
