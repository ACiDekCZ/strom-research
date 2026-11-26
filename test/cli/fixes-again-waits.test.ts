// strom fixes again-waits (1126): a task saving images once more whose wait holds fewer images than its own text names
// (written before awaits held them all) — found by rules from its text: the numbers and ranges of it, never one of the
// book's title, only images registered for the book; set right (its wait the union, those whose new copy did not come
// counted missing), undone exactly; never in an archive (an agent's work). Synthetic data only; no request leaves this
// computer. Made-up names only.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { World, hasGit } from "../helpers.ts";
import { textNumbers } from "../../src/core/againwaitfix.ts";
import type { Task } from "../../src/core/model.ts";

const opts = { skip: !hasGit, timeout: 180_000 };
const fixtures = path.join(import.meta.dirname, "..", "fixtures", "images");
// an archive strom's list keeps as only a person's browser's (as test/cli/media-save-again-wait.test.ts)
const PAGE = (n: number | string) => `https://genbaza.pl/skan/4711?n=${n}`;
const CLAUDE = { CLAUDECODE: "1" };
const SCANS: Record<number, string> = { 23: "s0001.jpg", 24: "s0002.jpg", 25: "s0003.jpg", 40: "cmyk.jpg", 49: "restart.jpg" };

const commits = (w: World) => Number(execFileSync("git", ["-C", w.cwd, "rev-list", "--count", "HEAD"], { encoding: "utf8" }).trim());

test("the numbers of a task's text: runs and ranges in any script, never the digits of an ID nor a number of the book", () => {
  assert.deepEqual(textNumbers("Save images 23–25 and 40 of book Lhota 49 once more", new Set([49])), [23, 24, 25, 40]);
  assert.deepEqual(textNumbers("Uložit znovu snímky 23 - 25 a 40 (T0012, B0003)".normalize("NFD")), [23, 24, 25, 40]);
  assert.deepEqual(textNumbers("Снимки ٢٣–٢٥ и 40"), [23, 24, 25, 40]);
  assert.deepEqual(textNumbers("Lhota 1850–1870, snímek 7", new Set([1850, 1870])), [7], "a range touching a number of the book left out");
  assert.deepEqual(textNumbers("Skan 3a, s. 12"), [12], "a number with a letter beside it is no image");
});

test("strom fixes again-waits: a task waiting for 23 whose text names 23–25 and 40 — found (24, 25, 40; never 49 of the title), set right, undone exactly; never in an archive", { ...opts }, async () => {
  const w = new World();
  try {
    await w.withTree("Lhotákovi");
    await w.ok(["research", "new", "X", "--new-person", "Jan /Lhoták/"]);
    const downloads = path.join(w.dir, "Stažené soubory");
    fs.mkdirSync(downloads);
    await w.ok(["config", "set", "browser.downloads", downloads]);
    await w.ok(["recordset", "add", "Lhota 49", "--url", PAGE(1)]); // B1
    await w.ok(["task", "add", "Save images 23–25 and 40 of book Lhota 49 once more", "--level", "link", "--where", "B1", "--why", "a", "--done-when", "b"]); // T1
    await w.ok(["allow", "archive", "genbaza.pl", "--way", "browser"], { tty: true });
    // images 23–25, 40 and 49 registered already
    const dir = path.join(w.home, "shared", "inbox", "lhota-49");
    fs.mkdirSync(dir, { recursive: true });
    for (const [n, f] of Object.entries(SCANS)) fs.copyFileSync(path.join(fixtures, f), path.join(dir, `${n}.jpg`));
    await w.ok(["media", "add", "--inbox", "lhota-49", "--recordset", "B1"]);
    // the first of them saved once more: as today's strom writes it (awaits "23", a save once more of 23 pending)
    await w.ok(["media", "save", "T1", "--image", "23", "--at", PAGE(23), "--again"], { env: CLAUDE });
    const task = async () => (await w.ok(["task", "show", "T1", "--json"])).json.task as Task;
    const before = await task();
    assert.equal(before.state, "waiting");
    assert.deepEqual([before.awaits?.images, before.awaits?.again], ["23", "23"]);

    const j = await w.ok(["fixes", "show", "again-waits", "--json"]);
    assert.equal(j.json.remedy, "rewrite");
    assert.equal(j.json.paid, false);
    assert.equal(j.json.state, "pending");
    assert.equal(j.json.items.length, 1);
    const it = j.json.items[0];
    assert.deepEqual([it.task, it.recordset, it.added], ["T0001", "B0001", "24–25, 40"], "never 49, of the book's title");
    assert.deepEqual(it.after, { images: "23–25, 40", again: "23–25, 40" });
    const show = await w.ok(["fixes", "show", "again-waits", "--lang", "en"]);
    assert.match(show.out, /T0001 · Save images 23–25 and 40 of book Lhota 49 once more · B0001: images 24–25, 40 added — waits for 23–25, 40/u);
    assert.match((await w.ok(["fixes", "show", "again-waits", "--lang", "cs"])).out, /B0001: přidány snímky 24–25, 40 – čeká na 23–25, 40/u);
    // never without the person
    for (const env of [{ CLAUDECODE: "1" }, { STROM_NONINTERACTIVE: "1" }] as Record<string, string>[])
      assert.equal((await w.run(["fixes", "run", "again-waits"], { env })).code, 4, JSON.stringify(env));
    assert.deepEqual(await task(), before);

    const n0 = commits(w);
    const r = await w.ok(["fixes", "run", "again-waits", "--lang", "en"], { tty: true, answers: ["1"] });
    assert.match(r.out, /Set right: 1 task in 1 record\./u);
    assert.equal(commits(w), n0 + 1, "one commit");
    const fixed = await task();
    assert.equal(fixed.state, "waiting");
    assert.deepEqual([fixed.awaits?.images, fixed.awaits?.again], ["23–25, 40", "23–25, 40"]);
    assert.equal((await w.run(["verify", "--json"])).code, 0, "sealed");
    const again = await w.ok(["fixes", "show", "again-waits", "--json"]);
    assert.deepEqual(again.json.items, [], "idempotent");
    assert.equal(again.json.state, "fixed");

    const n1 = commits(w);
    const u = await w.ok(["fixes", "undo", "again-waits", "--lang", "en"], { tty: true });
    assert.match(u.out, /Put back as they were: the waits of 1 task/u);
    assert.equal(commits(w), n1 + 1);
    assert.deepEqual(await task(), before, "back exactly");

    // an archive: never offered (an agent's work)
    await w.ok(["mode", "archive"], { tty: true, answers: ["y"] });
    const list = await w.ok(["fixes", "--json"]);
    assert.equal(list.json.checks.find((c: { id: string }) => c.id === "again-waits"), undefined);
  } finally {
    w.cleanup();
  }
});
