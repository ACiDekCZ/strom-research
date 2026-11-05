// Where an agent works now, for the Strom app's map (working[].place, feature working.place): the place record of the
// book the agent examines — from what its session wrote, before that from its task — in /status and the event working;
// none when the research does not know it, never an older book's place.

import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { World, hasGit } from "../helpers.ts";
import { enterWorker } from "../../src/core/workers.ts";
import { Tree } from "../../src/core/tree.ts";
import { placeOfWork } from "../../src/core/workplace.ts";
import type { Op } from "../../src/core/tree.ts";
import type { Task } from "../../src/core/model.ts";

/** The event working, once it says what `until` waits for. */
function listen(url: string, until: (text: string) => boolean, ms = 10_000): { done: Promise<string>; started: Promise<void> } {
  let started!: () => void;
  const ready = new Promise<void>((r) => (started = r));
  const done = new Promise<string>((resolve, reject) => {
    let text = "";
    const req = http.get(`${url}/events`, (res) => {
      res.on("data", (d) => {
        text += d;
        if (text.includes("event: hello")) started();
        if (until(text)) {
          req.destroy();
          resolve(text);
        }
      });
    });
    req.on("error", () => {});
    setTimeout(() => (req.destroy(), reject(new Error(`not heard: ${text}`))), ms);
  });
  return { done, started: ready };
}

test("working[].place: the book of the task, then of the last record written; a book of no known place: none; features working.place", { skip: !hasGit || process.platform === "win32" }, async () => {
  const w = new World();
  await w.withTree();
  w.env.STROM_LIVE_POLL_MS = "100";
  // two villages of one name: the book of the parish listed by one of them (jurisdiction) tells which
  await w.ok(["place", "add", "Lhota", "--unlocated", "which Lhota"]);
  await w.ok(["place", "add", "Lhota", "--unlocated", "which Lhota"]);
  // a place written composed, the book's place decomposed (NFD): the same name
  await w.ok(["place", "add", "Hořice"]);
  await w.ok(["recordset", "add", "Lhota N 1850-1870", "--kinds", "baptism", "--places", "Lhota,Lhotka", "--years", "1850-1870"]);
  await w.ok(["recordset", "add", "Hořice N 1850-1870", "--kinds", "baptism", "--places", "Hořice", "--years", "1850-1870"]);
  await w.ok(["recordset", "add", "Zálesí O 1850-1870", "--kinds", "marriage", "--places", "Zálesí", "--years", "1850-1870"]);
  await w.ok(["recordset", "add", "Lhota Z 1850-1870", "--kinds", "death", "--places", "Lhota", "--years", "1850-1870"]);
  await w.ok(["place", "jurisdiction", "L0002", "--kind", "parish", "--name", "Lhota", "--recordset", "B0001"]);
  await w.ok(["person", "add", "Václav /Lhoták/", "--sex", "M"]);
  await w.ok(["task", "add", "Křest Václava", "--level", "locate", "--where", "B0001", "--why", "rodiče", "--done-when", "zápis", "--about", "P0001"]);
  await w.ok(["task", "add", "Katalog", "--level", "locate", "--where", "katalog farností", "--why", "přehled", "--done-when", "seznam"]);
  await w.ok(["task", "add", "Úmrtí", "--level", "locate", "--where", "B0004", "--why", "konec", "--done-when", "zápis", "--about", "P0001"]);
  const info = (await w.ok(["live", "start", "--json"])).json as { url: string };
  const leave = enterWorker(w.cwd, "run-p", "Claude Code on its own");
  w.env.STROM_WORKER = "run-p";
  const status = async () => (await (await fetch(`${info.url}/status`)).json()) as { features: string[]; working: { task?: string; person?: string; place?: string }[] };
  try {
    assert.ok((await status()).features.includes("working.place"));
    // the book its task names (L0002 lists it among its records), before anything written
    await w.ok(["session", "start", "T0001"]);
    assert.equal((await status()).working[0]!.place, "L0002");
    // a source from another book: its place (the name alone, NFD against NFC) — in /status and the event working
    const heard = listen(info.url, (t) => /event: working\ndata: \[\{[^\n]*"place":"L0003"/.test(t));
    await heard.started;
    await w.ok(["source", "add", "Křest Václava", "--kind", "baptism", "--recordset", "B0002"]);
    assert.match(await heard.done, /"person":"P0001"[^\n]*"place":"L0003"/);
    assert.equal((await status()).working[0]!.place, "L0003");
    // a search in a book of no place record: none — never the place of the book before
    await w.ok(["search", "add", "Sňatek Lhoták", "--recordset", "B0003", "--method", "page-by-page", "--result", "negative", "--task", "T0001"]);
    const now = (await status()).working[0]!;
    assert.equal(now.person, "P0001");
    assert.ok(!("place" in now), JSON.stringify(now));
    await w.ok(["session", "close", "--summary", "nic", "--next", "dál", "--continue"]);
    // a task naming no book: none
    await w.ok(["session", "start", "T0002"]);
    assert.ok(!("place" in (await status()).working[0]!));
    await w.ok(["session", "close", "--summary", "nic", "--next", "dál", "--continue"]);
    // a book of a name two places bear, listed by neither: none (five villages of one name — the wrong one misleads)
    await w.ok(["session", "start", "T0003"]);
    assert.ok(!("place" in (await status()).working[0]!));
    await w.ok(["session", "close", "--summary", "nic", "--next", "dál", "--continue"]);
  } finally {
    delete w.env.STROM_WORKER;
    leave();
    await w.ok(["live", "stop"]);
  }
  // searches through several books (two places / one place), a book more of Hořice, a source of no book (the web)
  await w.ok(["recordset", "add", "Hořice Z 1850-1870", "--kinds", "death", "--places", "Hořice", "--years", "1850-1870"]);
  await w.ok(["search", "add", "Křest Lhoták", "--recordset", "B0001", "--recordset", "B0002", "--method", "page-by-page", "--result", "negative"]);
  await w.ok(["search", "add", "Úmrtí Lhoták", "--recordset", "B0002", "--recordset", "B0005", "--method", "page-by-page", "--result", "negative"]);
  await w.ok(["source", "add", "Webová stránka", "--kind", "other", "--url", "https://example.org/lhota"]);
  // the task's books in two places: none; in one: that one; an image of a book: its book's place
  const tree = Tree.open(w.cwd, w.env);
  const task = (where: string[]) => ({ ...tree.get<Task>("T0001")!, where });
  assert.equal(placeOfWork(tree, [], task(["B0001", "B0002"])), undefined);
  assert.equal(placeOfWork(tree, [], task(["B0002", " B0002 "])), "L0003");
  const op = (targets: string[]) => ({ targets }) as unknown as Op;
  assert.equal(placeOfWork(tree, [op(["B0002"]), op(["P0001"])], task(["B0001"])), "L0003", "the last book written, not the task's");
  assert.equal(placeOfWork(tree, [op(["B0002"]), op(["Q0001"])], undefined), undefined, "the newest book decides, its place unknown");
  // the newest record of work decides alone: a search through books of two places — none, though it names a book of a
  // known place; through books of one place — that place
  assert.equal(placeOfWork(tree, [op(["B0002"]), op(["Q0002", "B0001", "B0002"])], task(["B0002"])), undefined, "a search in books of two places");
  assert.equal(placeOfWork(tree, [op(["B0001"]), op(["Q0003", "B0002", "B0005"])], undefined), "L0003", "a search in books of one place");
  // a source of no book after a record of a book: none, never the older book's place
  assert.equal(placeOfWork(tree, [op(["S0001", "P0001"]), op(["S0002"])], task(["B0002"])), undefined, "a source of no book");
  assert.equal(placeOfWork(tree, [op(["S0002"]), op(["S0001"]), op(["P0001"])], undefined), "L0003", "a fact written from the record keeps its place");
  w.cleanup();
});
