// strom fixes book-counts (1126): a book downloaded whole with no count of its images, its images 1…N on disk, its
// tasks still needing it — offered to download by hand for ever. Found only with no gap (1, 2, 4: not); set right on a
// person's word alone (its count N written, recordset.edit, no longer offered), undone exactly (the count taken off
// where still as written); another count written by hand first: no longer found; in an archive too. Made-up names only.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { World, hasGit } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";

const opts = { skip: !hasGit, timeout: 180_000 };
const AGENT = { env: { CLAUDECODE: "1" } };
const scans = path.join(import.meta.dirname, "..", "fixtures", "images");

type Row = { id: string; images?: number; offer: boolean; countUnknown?: { from1to: number } };

const commits = (w: World) => Number(execFileSync("git", ["-C", w.cwd, "rev-list", "--count", "HEAD"], { encoding: "utf8" }).trim());

/** Books of an archive that lets them be downloaded whole, their tasks, their images saved by hand as today's strom registers them. */
async function books(w: World) {
  await w.withTree("Lhotákovi");
  const list = path.join(w.dir, "archives-test.json");
  fs.writeFileSync(list, JSON.stringify({ archives: [{ host: "archiv-lhota.example", name: "Archiv v Lhotě", level: "restricted", checked: "2026-11-01", wholeBook: { how: "allowed", says: "Celé knihy lze stáhnout.", from: "reply" } }] }));
  w.env.STROM_ARCHIVES_FILE = list;
  await w.ok(["recordset", "add", "Lhota Z 1790–1830", "--kinds", "burial", "--access", "online-free", "--url", "https://archiv-lhota.example/kniha/7"]); // B0001
  await w.ok(["recordset", "add", "Prouzalov Z 1790–1830", "--kinds", "burial", "--access", "online-free", "--url", "https://archiv-lhota.example/kniha/8"]); // B0002
  await w.ok(["task", "add", "Úmrtí Prouzala", "--level", "locate", "--where", "B1", "--why", "a", "--done-when", "b"]);
  await w.ok(["task", "add", "Úmrtí Lhotáka", "--level", "locate", "--where", "B2", "--why", "a", "--done-when", "b"]);
  const inbox = async (folder: string, book: string, files: Record<number, string>) => {
    const dir = path.join(w.home, "shared", "inbox", folder);
    fs.mkdirSync(dir, { recursive: true });
    for (const [n, f] of Object.entries(files)) fs.copyFileSync(path.join(scans, f), path.join(dir, `${n}.jpg`));
    await w.ok(["media", "add", "--inbox", folder, "--recordset", book]);
  };
  await inbox("lhota-z", "B1", { 1: "s0001.jpg", 2: "s0002.jpg", 3: "s0003.jpg", 4: "cmyk.jpg", 5: "restart.jpg" });
  await inbox("prouzalov-z", "B2", { 1: "base420.jpg", 2: "base444.jpg", 4: "prog420.jpg" });
  const row = async (id: string) => ((await w.ok(["task", "books", "--min", "1", "--all", "--json"])).json.books as Row[]).find((r) => r.id === id)!;
  return { row };
}

test("strom fixes book-counts: a book 1…5 with no count found (one with a gap not), nothing without the person; its count written, no longer offered; undone exactly", opts, async () => {
  const w = new World();
  try {
    const { row } = await books(w);
    assert.equal((await row("B0001")).offer, true, "offered for ever before the fix");
    const j = await w.ok(["fixes", "show", "book-counts", "--json"]);
    assert.equal(j.json.remedy, "rewrite");
    assert.equal(j.json.paid, false);
    assert.equal(j.json.state, "pending");
    assert.deepEqual(j.json.items, [{ recordset: "B0001", title: "Lhota Z 1790–1830", archive: "Archiv v Lhotě", images: 5 }], "a book with a gap (1, 2, 4) not found");
    const show = await w.ok(["fixes", "show", "book-counts", "--lang", "en"]);
    assert.match(show.out, /B0001 · Lhota Z 1790–1830 · Archiv v Lhotě: images 1–5 on disk; the archive's count not known — is the book whole\? Another count: strom recordset edit B0001 --images <n>/u);
    assert.match((await w.ok(["fixes", "show", "book-counts", "--lang", "cs"])).out, /na disku snímky 1–5; počet podle archivu neznámý – je kniha celá\? Jiný počet: strom recordset edit B0001 --images <n>/u);
    // never without the person
    for (const env of [{ CLAUDECODE: "1" }, { STROM_NONINTERACTIVE: "1" }] as Record<string, string>[])
      assert.equal((await w.run(["fixes", "run", "book-counts"], { env })).code, 4, JSON.stringify(env));
    assert.equal((await row("B0001")).images, undefined);

    const n0 = commits(w);
    const r = await w.ok(["fixes", "run", "book-counts", "--lang", "en"], { tty: true, answers: ["1"] });
    assert.match(r.out, /Written: the count of 1 book in 1 record\./u);
    assert.equal(commits(w), n0 + 1, "one commit");
    const after = await row("B0001");
    assert.equal(after.images, 5);
    assert.equal(after.offer, false, "no longer offered");
    assert.equal(after.countUnknown, undefined);
    assert.equal((await row("B0002")).images, undefined, "the book with a gap untouched");
    const tree = Tree.open(w.cwd, w.env);
    const ops = tree.readOps().filter((o) => o.op === "recordset.edit" && o.targets.includes("B0001"));
    assert.equal(ops.length, 1);
    assert.equal(ops[0]!.reason, "fix book-counts");
    assert.ok(ops[0]!.files.some((f) => f.path === "quality/book-counts.json"));
    assert.equal((await w.run(["verify", "--json"])).code, 0, "sealed");
    const again = await w.ok(["fixes", "show", "book-counts", "--json"]);
    assert.deepEqual(again.json.items, [], "idempotent");
    assert.equal(again.json.state, "fixed");

    assert.equal((await w.run(["fixes", "undo", "book-counts"], AGENT)).code, 4);
    const n1 = commits(w);
    const u = await w.ok(["fixes", "undo", "book-counts", "--lang", "en"], { tty: true });
    assert.match(u.out, /Taken off: the count of 1 book/u);
    assert.equal(commits(w), n1 + 1);
    assert.equal((await w.ok(["recordset", "show", "B1", "--json"])).json.recordset.images, undefined, "no count again");
    assert.equal((await row("B0001")).offer, true);
    assert.match((await w.ok(["fixes", "undo", "book-counts", "--lang", "en"], { tty: true })).out, /Nothing to take off/u);
  } finally {
    w.cleanup();
  }
});

test("strom fixes book-counts: in an archive shown and set right; another count written by hand — an undo leaves it, never found again", opts, async () => {
  const w = new World();
  try {
    await books(w);
    // in an archive: shown and set right, nothing of an agent
    await w.ok(["mode", "archive"], { tty: true, answers: ["y"] });
    const list = await w.ok(["fixes", "--json"]);
    assert.equal(list.json.checks.find((c: { id: string }) => c.id === "book-counts")?.state, "pending");
    const show = await w.ok(["fixes", "show", "book-counts", "--lang", "en"]);
    assert.doesNotMatch(show.out, /agent|\bAI\b|Claude|Codex|\bmodel/i);
    const r = await w.ok(["fixes", "run", "book-counts", "--lang", "en"], { tty: true, answers: ["1"] });
    assert.doesNotMatch(r.out, /agent|\bAI\b|Claude|Codex|\bmodel/i);
    assert.equal((await w.ok(["recordset", "show", "B1", "--json"])).json.recordset.images, 5);
    // another count from the archive's page, written by hand: the undo leaves it, and it is never found again
    await w.ok(["recordset", "edit", "B1", "--images", "6"]);
    const u = await w.ok(["fixes", "undo", "book-counts", "--lang", "en"], { tty: true });
    assert.match(u.out, /1 changed since, left as it is/u);
    assert.equal((await w.ok(["recordset", "show", "B1", "--json"])).json.recordset.images, 6);
    assert.deepEqual((await w.ok(["fixes", "show", "book-counts", "--json"])).json.items, []);
  } finally {
    w.cleanup();
  }
});
