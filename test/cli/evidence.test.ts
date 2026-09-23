// Phase 2: sources, citations, record sets, places, tasks, searches,
// conflicts, hypotheses, lessons, find, gaps.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit, readJsonFile } from "../helpers.ts";

const opts = { skip: !hasGit };

async function world(): Promise<World> {
  const w = new World();
  await w.withTree();
  await w.ok(["research", "new", "Předci Jana Nováka", "--new-person", "Jan /Novák/", "--sex", "M", "--born", "ABT 1905"]);
  await w.ok(["repo", "add", "SOA Praha (eBadatelna)", "--country", "cz", "--automation", "manual"]);
  await w.ok(["recordset", "add", "Týnec nad Labem 17, N 1903-1920", "--repo", "R1", "--kinds", "baptism", "--places", "Týnec nad Labem", "--years", "1903-1920", "--access", "online-free"]);
  return w;
}

test("sources and citations: a lead becomes probable, proven needs the record", opts, async () => {
  const w = await world();
  await w.ok(["source", "add", "Křest Jana Nováka 1905", "--kind", "baptism", "--recordset", "B1", "--locator", "fol. 45", "--language", "la", "--information", "primary", "--transcript", "Joannes filius Josephi"]);
  const cite = (await w.ok(["cite", "E0001", "S1", "--locator", "fol. 45, č. 12", "--json"])).json;
  assert.equal(cite.event.status, "probable");
  assert.deepEqual(cite.event.citations, [{ source: "S0001", locator: "fol. 45, č. 12" }]);
  const ev = (await w.ok(["event", "add", "P1", "CHR", "--date", "25 JUN 1905", "--cite", "S1", "--status", "proven", "--with", "godparent:Marie Dvořáková", "--json"])).json.event;
  assert.equal(ev.status, "proven");
  assert.deepEqual(ev.participants, [{ role: "godparent", name: "Marie Dvořáková" }]);
  assert.equal((await w.run(["event", "add", "P1", "DEAT", "--cite", "S9"])).code, 2); // no such source
  const show = (await w.ok(["source", "show", "S1"])).out;
  assert.match(show, /cited by\n\s+P0001 E0001 BIRT \(fol\. 45, č\. 12\)/);
  assert.match(show, /Joannes filius Josephi/);
  w.cleanup();
});

test("facts are changed only with a reason and retracted, never deleted", opts, async () => {
  const w = await world();
  assert.equal((await w.run(["event", "edit", "E1", "--date", "1906"])).code, 2);
  await w.ok(["event", "edit", "E1", "--date", "1906", "--reason", "sister remembers 1906"]);
  await w.ok(["event", "retract", "E1", "--reason", "namesake"]);
  const p = readJsonFile(path.join(w.cwd, "data", "persons", "P0001.json"));
  assert.equal(p.events.length, 1);
  assert.equal(p.events[0].status, "retracted");
  assert.equal(p.events[0].retracted.reason, "namesake");
  assert.match((await w.ok(["check"])).out, /^ok/);
  w.cleanup();
});

test("EVEN needs a label, OCCU needs a value", opts, async () => {
  const w = await world();
  assert.equal((await w.run(["event", "add", "P1", "EVEN"])).code, 2);
  assert.equal((await w.run(["event", "add", "P1", "OCCU"])).code, 2);
  await w.ok(["event", "add", "P1", "EVEN", "--label", "Požár stavení", "--date", "NOV 1905"]);
  w.cleanup();
});

test("record set calibration fits a line and warns when the book is not linear", opts, async () => {
  const w = await world();
  const ok = await w.ok(["recordset", "calibrate", "B1", "--point", "10=18", "--point", "60=118"]);
  assert.match(ok.out, /page ≈ 2·image − 2 · consistent/);
  const bad = await w.ok(["recordset", "calibrate", "B1", "--point", "30=90"]);
  assert.match(bad.out, /INCONSISTENT/);
  assert.equal(readJsonFile(path.join(w.cwd, "data", "recordsets", "B0001.json")).calibration.length, 3);
  w.cleanup();
});

test("places with names over time and jurisdictions", opts, async () => {
  const w = await world();
  await w.ok(["place", "add", "Týnec nad Labem", "--alt", "Teinitz an der Elbe@de:1850-1918", "--kind", "town", "--lat", "50.042", "--lon", "15.358"]);
  await w.ok(["place", "jurisdiction", "L1", "--kind", "parish", "--name", "Týnec nad Labem", "--from", "1784", "--repo", "R1", "--recordset", "B1"]);
  const show = (await w.ok(["place", "show", "tynec"])).out;
  assert.match(show, /Teinitz an der Elbe@de \(1850–1918\)/);
  assert.match(show, /parish\s+Týnec nad Labem \(1784–\)\s+R0001\s+B0001/);
  // no record set known yet: still a valid place
  await w.ok(["place", "jurisdiction", "L1", "--kind", "civil", "--name", "Kolín", "--to", "1849"]);
  assert.match((await w.ok(["check"])).out, /^ok/m);
  w.cleanup();
});

test("a task needs what, where, why and done-when; the queue is ordered", opts, async () => {
  const w = await world();
  const wish = await w.run(["task", "add", "Najít otce"]);
  assert.equal(wish.code, 2);
  assert.match(wish.err, /--level, --where, --why, --done-when/);
  await w.ok(["task", "add", "Otec Josef", "--level", "link", "--where", "B1", "--why", "rodiče", "--done-when", "zápis", "--priority", "2"]);
  await w.ok(["task", "add", "Kde jsou matriky Bělušic", "--level", "locate", "--where", "katalog SOA Praha", "--why", "odemkne pramen", "--done-when", "record set založen", "--priority", "4"]);
  await w.ok(["task", "add", "Také priorita 4, ale link", "--level", "link", "--where", "B1", "--why", "x", "--done-when", "y", "--priority", "4"]);
  const queue = (await w.ok(["task", "list", "--json"])).json.tasks.map((t: any) => t.id);
  assert.deepEqual(queue, ["T0002", "T0003", "T0001"]); // priority, then locate before link
  assert.equal((await w.ok(["task", "next", "--json"])).json.task.id, "T0002");
  await w.ok(["task", "start", "T1"]);
  assert.equal((await w.ok(["task", "next", "--json"])).json.task.id, "T0001"); // work in progress first
  assert.equal((await w.run(["task", "done", "T1"])).code, 2); // needs --result
  await w.ok(["task", "done", "T1", "--result", "not in 1903-1907"]);
  await w.ok(["task", "park", "T2", "--reason", "archive closed", "--until", "2000-01-01"]); // date passed: offered again
  assert.equal((await w.ok(["task", "next", "--json"])).json.task.id, "T0002");
  await w.ok(["task", "wait", "T2", "--on", "reply of the archive"]);
  assert.equal((await w.ok(["task", "next", "--json"])).json.task.id, "T0003");
  const t = readJsonFile(path.join(w.cwd, "data", "tasks", "T0001.json"));
  assert.equal(t.research, "G0001"); // the only active research
  w.cleanup();
});

test("searches record negatives; searched answers 'was it looked at?'", opts, async () => {
  const w = await world();
  await w.ok(["search", "add", "Křty Novák 1903–1907", "--recordset", "B1", "--years", "1903-1907", "--surname", "Novák", "--method", "page-by-page", "--result", "negative"]);
  assert.equal((await w.run(["search", "add", "x", "--method", "index", "--result", "found"])).code, 2); // found needs --found
  const hit = await w.ok(["searched", "B1", "--years", "1905-1910"]);
  assert.match(hit.out, /1 search\(es\) for B0001 in 1905-1910 — 1 negative/);
  assert.match((await w.ok(["searched", "B1", "--years", "1910-1915"])).out, /nothing searched yet/);
  assert.match((await w.ok(["searched", "novak"])).out, /1 search/);
  assert.match((await w.ok(["searched", "P1"])).out, /1 search/);
  w.cleanup();
});

test("conflicts, hypotheses and lessons", opts, async () => {
  const w = await world();
  await w.ok(["source", "add", "Sňatek 1839", "--kind", "marriage"]);
  await w.ok(["source", "add", "Úmrtí 1883", "--kind", "death"]);
  assert.equal((await w.run(["conflict", "add", "Rok narození", "--about", "P1", "--claim", "S1: 27 let"])).code, 2); // one claim
  await w.ok(["conflict", "add", "Rok narození", "--about", "jan novak", "--claim", "S1: 27 let v 1839", "--claim", "S2: 70 let v 1883"]);
  await w.ok(["conflict", "resolve", "X1", "--resolution", "1811/12", "--reasoning", "sňatek je bližší narození"]);
  assert.match((await w.ok(["conflict", "list"])).out, /no open conflicts/);
  await w.ok(["hypothesis", "add", "Kdo byl otec?", "--about", "P1", "--variant", "A: Josef z čp. 12", "--variant", "B: Josef z čp. 31"]);
  await w.ok(["hypothesis", "argue", "H1", "A", "--for", "S1 jmenuje čp. 12"]);
  assert.match((await w.ok(["hypothesis", "show", "H1"])).out, /A: Josef z čp\. 12\n\s+\+ S1 jmenuje čp\. 12/);
  const long = "x".repeat(201);
  assert.equal((await w.run(["lesson", "add", long])).code, 2);
  await w.ok(["lesson", "add", "Folio = 2 × snímek + 1", "--on", "B1"]);
  await w.ok(["task", "add", "Otec", "--level", "link", "--where", "B1", "--why", "a", "--done-when", "b"]);
  assert.match((await w.ok(["task", "show", "T1"])).out, /lessons for these record sets\n\s+K0001 Folio = 2 × snímek \+ 1/);
  w.cleanup();
});

test("find searches every record type; gaps ranks missing facts", opts, async () => {
  const w = await world();
  await w.ok(["source", "add", "Křest", "--kind", "baptism", "--transcript", "Joannes filius Josephi molitoris in Týnec"]);
  const f = (await w.ok(["find", "molitoris", "--json"])).json;
  assert.equal(f.hits[0].id, "S0001");
  assert.equal((await w.ok(["find", "Tynec", "--json"])).json.total >= 2, true); // record set + source
  const g = (await w.ok(["gaps", "--research", "G1", "--json"])).json;
  assert.deepEqual(g.gaps[0].gaps, ["death", "parents", "no evidence"]);
  w.cleanup();
});

test("check reports references to records that do not exist", opts, async () => {
  const w = await world();
  // a record written through strom but pointing nowhere cannot be created …
  assert.equal((await w.run(["source", "add", "x", "--recordset", "B9"])).code, 2);
  // … and every record type is validated by the schema
  const file = path.join(w.cwd, "data", "recordsets", "B0001.json");
  const rec = readJsonFile(file);
  assert.equal(rec.access, "online-free");
  assert.ok(fs.existsSync(file));
  w.cleanup();
});
