// A tree of the app handed over with the numbers of another research (a copy of a tree that had one): the answer's
// ids name the people and sources by the file's own xrefs, so the app learns the new research's numbers (spec 139 K5.4).

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";

test("handed over with another research's numbers (REFN P… of strom-research, S…): ids keyed by the file's xrefs, the new numbers", { skip: !hasGit || process.platform === "win32" }, async () => {
  const w = new World();
  await w.ok(["setup", "--yes"]);
  await w.ok(["init", "Lhotákovi", "--mode", "archive"]);
  w.cwd = w.treeDir("Lhotákovi");
  const { awaitAdoption } = await import("../../src/core/sync.ts");
  const ged = [
    "0 HEAD", "1 SOUR STROM", "1 GEDC", "2 VERS 5.5.1", "1 CHAR UTF-8",
    "0 @I1@ INDI", "1 NAME Vojtěch /Lhoták/", "1 SEX M", "1 REFN P0042", "2 TYPE strom-research", "1 BIRT", "2 DATE 1871", "2 SOUR @S1@",
    "0 @I2@ INDI", "1 NAME Žofie /Lhotáková/", "1 SEX F", "1 REFN P0043",
    "0 @I3@ INDI", "1 NAME Анна /Лгота/", "1 SEX F",
    "0 @F1@ FAM", "1 HUSB @I1@", "1 WIFE @I2@", "1 CHIL @I3@",
    "0 @S1@ SOUR", "1 TITL Křest – Vojtěch Lhoták", "1 REFN S0007",
    "0 @S2@ SOUR", "1 TITL Sčítání lidu 1880",
    "0 TRLR", "",
  ].join("\n");
  awaitAdoption(w.cwd, "D".repeat(43));
  const info = (await w.ok(["live", "start", "--json"])).json;
  try {
    const r = await fetch(`${info.url}/adopt`, { method: "POST", body: ged, headers: { Origin: "https://beta.stromapp.info", "Content-Type": "text/plain; charset=utf-8" } });
    assert.equal(r.status, 200);
    const ids = ((await r.json()) as { ids: { persons: Record<string, string>; sources: Record<string, string> } }).ids;
    assert.deepEqual(Object.keys(ids.persons).sort(), ["@I1@", "@I2@", "@I3@"], "the file's xrefs, never the other research's numbers");
    const people = (await w.ok(["person", "list", "--json"])).json as { people?: { id: string; name: string }[]; persons?: { id: string; name: string }[] };
    const list = people.people ?? people.persons ?? [];
    const byName = (s: string) => list.find((p) => JSON.stringify(p).includes(s))?.id;
    assert.equal(ids.persons["@I1@"], byName("Vojtěch"));
    assert.equal(ids.persons["@I2@"], byName("Žofie"));
    assert.equal(ids.persons["@I3@"], byName("Анна"));
    assert.deepEqual(Object.keys(ids.sources).sort(), ["@S1@", "@S2@"], "a source of another research's number too");
    for (const id of [...Object.values(ids.persons), ...Object.values(ids.sources)]) assert.match(id, /^[PS]\d{4}$/);
    assert.notEqual(ids.persons["@I1@"], "P0042");
    // the birth cites the source it came with, under its new number
    const vojtech = JSON.parse(fs.readFileSync(path.join(w.cwd, "data", "persons", `${ids.persons["@I1@"]}.json`), "utf8")) as { events: { type: string; citations?: { source: string }[] }[] };
    assert.ok(vojtech.events.some((e) => e.citations?.some((c) => c.source === ids.sources["@S1@"])), JSON.stringify(vojtech.events));
  } finally {
    await w.ok(["live", "stop"]);
  }
  w.cleanup();
});
