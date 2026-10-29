// strom history list: the events of history the research shows at the tree's places, readable in the terminal — a
// region's by the years each place belonged to it, a place's own catalog, the local ones read in the research's sources;
// grouped by region and place, by year, in the research's language; hidden and deleted ones marked; --place and
// --region; an unknown one refused with the way on; read only, in an archive too, with the history off too.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { World, hasGit, readJsonFile } from "../helpers.ts";
import { encodeJpeg } from "../../src/image/jpeg-encode.ts";
import { blank } from "../../src/image/image.ts";

const opts = { skip: !hasGit, timeout: 180_000 };
const AGENT = { CLAUDECODE: "1" };
const KEY = "p-4962n-1507e";
const SOURCE = { title: "Dějiny Lhotska", url: "https://example.org/lhotsko", checked: "2026-10-01", quote: "1866", sha: "0".repeat(64) };

function regionFile(w: World, id: string): string {
  return path.join(w.home, "shared", "history", "regions", `${id}.json`);
}

function writeEvents(w: World, region: string, events: [n: number, from: number, to: number, kind: string, cs: string, en: string][]): void {
  const c = readJsonFile(regionFile(w, region));
  c.events = events.map(([n, from, to, kind, cs, en]) => ({ id: `${region}-${String(n).padStart(4, "0")}`, from, to, kind, text: { cs, en, de: en }, source: SOURCE, by: "x", at: "2026-10-01T00:00:00Z" }));
  c.next = events.length + 1;
  fs.writeFileSync(regionFile(w, region), JSON.stringify(c));
}

/**
 * Jan Lhoták born 1850 at Lhota (a record with coordinates, L0001; region cz-lhota from 1800; its own catalog), died 1925
 * at Nová Lhota (region cz-horni from 1900); a local event read in the tree's own register of Lhota.
 */
async function world(): Promise<World> {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["lang", "cs"]);
  await w.ok(["place", "add", "Lhota", "--kind", "village", "--lat", "49.62", "--lon", "15.07"]); // L0001
  await w.ok(["research", "new", "Předci Jana Lhotáka", "--new-person", "Jan /Lhoták/", "--sex", "M", "--born", "1850", "--born-place", "Lhota"]); // P0001
  await w.ok(["event", "add", "P0001", "DEAT", "--date", "1925", "--place", "Nová Lhota"]);
  await w.ok(["config", "set", "experiments.history", "on"], { tty: true, answers: ["a"] });
  await w.ok(["history", "region", "cz-lhota", "--name-cs", "Lhotsko", "--name-en", "Lhota Land", "--name-de", "Lhotaland"]);
  await w.ok(["history", "region", "cz-horni", "--name-cs", "Horní země", "--name-en", "Upper Land", "--name-de", "Oberland"]);
  await w.ok(["history", "map", "Lhota", "--region", "cz-lhota:1800-"]);
  await w.ok(["history", "map", "Nová Lhota", "--region", "cz-horni:1900-"]);
  writeEvents(w, "cz-lhota", [
    [1, 1866, 1866, "epidemic", "Cholera ve Lhotě", "Cholera at Lhota"],
    [2, 1914, 1918, "war", "Velká válka", "The Great War"],
    [3, 1700, 1700, "war", "Válka dávno před nimi", "A war long before"],
  ]);
  writeEvents(w, "cz-horni", [
    [1, 1930, 1930, "economy", "Krize v Horní zemi", "A crisis in the Upper Land"],
    [2, 1921, 1921, "census", "Sčítání lidu", "A census"],
  ]);
  // the place's own catalog (core/placehistory.ts), by its coordinates
  const own = { place: { key: KEY, name: { cs: "Lhota", en: "Lhota", de: "Lhota" } }, next: 2, tried: [], events: [{ id: `${KEY}-0001`, from: 1868, to: 1868, kind: "disaster", text: { cs: "Požár školy", en: "The school burnt", de: "Die Schule brannte" }, source: { ...SOURCE, title: "Kronika Lhoty" }, by: "x", at: "2026-10-01T00:00:00Z" }] };
  fs.mkdirSync(path.join(w.home, "shared", "history", "places"), { recursive: true });
  fs.writeFileSync(path.join(w.home, "shared", "history", "places", `${KEY}.json`), JSON.stringify(own));
  // a local event read in the tree's own record of the place (a non-Latin text)
  await w.ok(["recordset", "add", "Matrika Lhota Z 1840–1870", "--kinds", "burial", "--places", "Lhota", "--years", "1840-1870", "--images", "1"]); // B0001
  const dir = fs.mkdtempSync(path.join(w.dir, "snímky-"));
  fs.writeFileSync(path.join(dir, "obr-001.jpg"), encodeJpeg(blank(60, 40, 1, 120), 85));
  await w.ok(["media", "add", dir, "--recordset", "B1"]);
  await w.ok(["source", "add", "Pohřby Lhota 1855", "--kind", "burial", "--recordset", "B1", "--locator", "fol. 1", "--media", "B1:1", "--transcript", "Anno 1855 ignis …"]); // S0001
  await w.ok(["history", "local", "--source", "S0001", "--from", "1855", "--kind", "disaster", "--text", "Пожар села"], { env: AGENT }); // L0001
  return w;
}

const git = (w: World, args: string[]) => spawnSync("git", args, { cwd: w.cwd, encoding: "utf8" }).stdout.trim();
const list = async (w: World, more: string[] = []) => (await w.ok(["history", "list", ...more, "--json"])).json;
const ids = (j: any) => j.events.map((e: any) => e.id);

test("history list: every event the research shows, grouped by region and place, by year, in the research's language — none of years no place belonged", opts, async () => {
  const w = await world();
  try {
    const j = await list(w);
    assert.equal(j.on, true);
    assert.deepEqual(ids(j), ["cz-horni-0002", "cz-horni-0001", "cz-lhota-0001", "cz-lhota-0002", `${KEY}-0001`, "L0001"], "regions by name, then the place's own, then the research's sources; each by year");
    assert.ok(!ids(j).includes("cz-lhota-0003"), "a region's event of years no place of the tree belonged to it: not shown");
    const war = j.events.find((e: any) => e.id === "cz-lhota-0002");
    assert.deepEqual(
      [war.from, war.to, war.kind, war.scope, war.text, war.region, war.source, war.at],
      [1914, 1918, "war", "region", "Velká válka", { id: "cz-lhota", name: "Lhotsko" }, { title: "Dějiny Lhotska", url: "https://example.org/lhotsko" }, ["Lhota"]],
    );
    const own = j.events.find((e: any) => e.id === `${KEY}-0001`);
    assert.deepEqual([own.scope, own.place, own.source.title], ["place", { key: "Lhota", id: "L0001", name: "Lhota" }, "Kronika Lhoty"]);
    const local = j.events.find((e: any) => e.id === "L0001");
    assert.deepEqual([local.scope, local.text, local.local], ["local", "Пожар села", { source: "S0001", title: "Pohřby Lhota 1855", place: "Lhota" }]);
    assert.deepEqual([j.total, j.page, j.pages, j.lang], [6, 1, 1, "cs"]);

    const out = (await w.ok(["history", "list"])).out;
    const at = (s: string) => out.indexOf(s);
    for (const s of ["Region Horní země (cz-horni)", "Region Lhotsko (cz-lhota)", "Místo Lhota (L0001)", "Z pramenů výzkumu"]) assert.ok(at(s) >= 0, `${s}\n${out}`);
    assert.ok(at("Region Horní země") < at("Region Lhotsko") && at("Region Lhotsko") < at("Místo Lhota") && at("Místo Lhota") < at("Z pramenů výzkumu"), out);
    assert.match(out, /^ {2}1914–1918 +válka +Velká válka — Dějiny Lhotska <https:\/\/example\.org\/lhotsko> · cz-lhota-0002$/mu);
    assert.match(out, /^ {2}1855 +pohroma +Пожар села — Pohřby Lhota 1855 \(S0001\) · Lhota · L0001$/mu);
    assert.ok(at("Cholera ve Lhotě") < at("Velká válka"), "by year within a region");
    assert.doesNotMatch(out, /Dějiny míst jsou vypnuté/);
    // another language of the research: its texts and words
    await w.ok(["lang", "en"]);
    assert.match((await w.ok(["history", "list"])).out, /^ {2}1866 +epidemic +Cholera at Lhota — /mu);
  } finally {
    w.cleanup();
  }
});

test("history list: hidden by the person (a place, a person, the whole tree, everything of a region) and deleted marked", opts, async () => {
  const w = await world();
  try {
    await w.ok(["history", "hide", "cz-lhota-0001", "--place", "Lhota"]);
    await w.ok(["history", "hide", "cz-lhota-0002", "--tree"]);
    await w.ok(["history", "hide", `${KEY}-0001`, "--person", "P0001"]);
    await w.ok(["history", "hide", "--region", "cz-horni"]);
    await w.ok(["history", "delete", "cz-horni-0001"]);
    const j = await list(w);
    const of = (id: string) => j.events.find((e: any) => e.id === id);
    assert.deepEqual(of("cz-lhota-0001").hidden, [{ place: "Lhota" }]);
    assert.deepEqual(of("cz-lhota-0002").hidden, [{ tree: true }]);
    assert.deepEqual(of(`${KEY}-0001`).hidden, [{ person: "Jan Lhoták (P0001)" }]);
    assert.deepEqual(of("cz-horni-0002").hidden, [{ region: "cz-horni" }]);
    assert.match(of("cz-horni-0001").deleted, /^\d{4}-\d\d-\d\dT/);
    assert.equal(of("L0001").hidden, undefined);
    const out = (await w.ok(["history", "list"])).out;
    assert.match(out, /Cholera ve Lhotě .* · cz-lhota-0001 · \[skryto u místa Lhota\]$/mu);
    assert.match(out, /Velká válka .* · cz-lhota-0002 · \[skryto v celém stromu\]$/mu);
    assert.match(out, /Požár školy .* · \[skryto u osoby Jan Lhoták \(P0001\)\]$/mu);
    assert.match(out, /^Region Horní země \(cz-horni\) · vše z regionu skryto$/mu);
    assert.match(out, /Krize v Horní zemi .* · cz-horni-0001 · \[smazáno\]$/mu);
    // restored: no longer deleted
    await w.ok(["history", "restore", "cz-horni-0001"]);
    assert.equal((await list(w)).events.find((e: any) => e.id === "cz-horni-0001").deleted, undefined);
  } finally {
    w.cleanup();
  }
});

test("history list --place / --region: the events at one place (its record or its words, any accent) or of one region; an unknown one refused with the way on", opts, async () => {
  const w = await world();
  try {
    await w.ok(["history", "delete", "cz-lhota-0001"]);
    // the record: its regions' events by the years it belonged to them, its own catalog, its local events; deleted there too
    assert.deepEqual(ids(await list(w, ["--place", "L0001"])), ["cz-lhota-0001", "cz-lhota-0002", `${KEY}-0001`, "L0001"]);
    assert.deepEqual(ids(await list(w, ["--place", "l1"])), ["cz-lhota-0001", "cz-lhota-0002", `${KEY}-0001`, "L0001"]);
    // the place as the facts write it, decomposed
    const nova = await list(w, ["--place", "Nová Lhota".normalize("NFD")]);
    assert.deepEqual(ids(nova), ["cz-horni-0002", "cz-horni-0001"]);
    assert.deepEqual(nova.place, { keys: ["Nová Lhota"] });
    assert.deepEqual(ids(await list(w, ["--region", "cz-lhota"])), ["cz-lhota-0001", "cz-lhota-0002"]);
    assert.deepEqual(ids(await list(w, ["--place", "L0001", "--region", "cz-horni"])), []);
    assert.match((await w.ok(["history", "list", "--place", "L0001", "--region", "cz-horni"])).out, /zatím nejsou žádné události/);
    // unknown: refused, a code and what to run
    for (const [args, code, hint] of [
      [["--place", "L0099"], "history.place", /strom place list/],
      [["--place", "Lhotec"], "history.place", /strom history status/],
      [["--region", "cz-nikde"], "history.region.unknown", /strom history status/],
      [["--region", "Лхота"], "history.region.unknown", /strom history status/],
    ] as const) {
      const r = await w.run(["history", "list", ...args, "--json"]);
      assert.notEqual(r.code, 0);
      const e = JSON.parse(r.out || r.err);
      assert.equal(e.code ?? e.error?.code, code, r.out + r.err);
      assert.match(r.out + r.err, hint);
    }
  } finally {
    w.cleanup();
  }
});

test("history list: read only — the history off (what was found stays, said in one line), in an archive too; nothing written", opts, async () => {
  const w = await world();
  try {
    await w.ok(["config", "set", "experiments.history", "off", "--for-tree"]);
    const state = () => [git(w, ["rev-parse", "HEAD"]), git(w, ["status", "--porcelain"]), fs.readdirSync(path.join(w.home, "shared", "history", "regions")).join(",")].join("\n");
    const before = state();
    const j = await list(w);
    assert.equal(j.on, false);
    assert.equal(j.total, 6);
    const out = (await w.ok(["history", "list"])).out;
    assert.match(out.split("\n")[0]!, /^Dějiny míst jsou vypnuté – co se našlo, zůstává\.$/u);
    assert.match(out, /Cholera ve Lhotě/);
    await w.ok(["history", "list", "--place", "L0001"]);
    assert.equal(state(), before, "nothing written");
    await w.ok(["mode", "archive"], { tty: true });
    assert.equal((await list(w)).total, 6);
    assert.match((await w.ok(["history", "list"])).out, /Velká válka/);
    assert.match((await w.ok(["check"])).out, /^ok/);
  } finally {
    w.cleanup();
  }
});
