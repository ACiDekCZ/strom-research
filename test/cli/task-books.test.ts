// The books the tasks need (spec 105 K1.1–K1.3, core/books.ts): counted from what the tasks name — open, at work,
// parked and waiting; a book merged into another counts for that one, a book taken back for none, a task naming two
// books for both; never a book guessed for a task that names none. strom task books offers those worth downloading by
// hand (enough tasks, online, not whole on disk), strom task list --book lists one book's tasks, and the agent is told
// at a task's book which other tasks need it (strom task show, the brief). The menu's What waits shows the books in
// the research language. Synthetic data only.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { World, hasGit } from "../helpers.ts";
import { Tree, now } from "../../src/core/tree.ts";
import { bookRows, offeredBooks, sameBookLine } from "../../src/core/books.ts";
import { inboxFolderFor } from "../../src/core/media.ts";
import { waitKeys } from "../../src/cli/menu-waiting.ts";
import type { Media, RecordSet, Task } from "../../src/core/model.ts";

const opts = { skip: !hasGit || process.platform === "win32" };

/**
 * B1 Lhota 3 (online-free, 20 images, 5 of them on disk and one past the catalog's count) — 7 tasks: open, one through
 * B4 merged into it, one waiting for its images 5–6, one parked, one of two books; a done one not counted.
 * B2 (a title in Cyrillic, typed decomposed; online-login) — 5 tasks; B3 (onsite) — 6 tasks; B5 taken back — 1 task;
 * B6 (online-free, 3 images, all on disk) — 5 tasks.
 */
async function world(): Promise<World> {
  const w = new World();
  const bin = path.join(w.dir, "bin");
  fs.mkdirSync(bin);
  const git = spawnSync("which", ["git"], { encoding: "utf8" }).stdout.trim();
  if (git) fs.symlinkSync(git, path.join(bin, "git"));
  fs.writeFileSync(path.join(bin, "claude"), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
  w.env.PATH = bin;
  await w.withTree("Lhotákovi");
  await w.ok(["research", "new", "Předci Vojtěcha", "--new-person", "Vojtěch /Lhoták/", "--sex", "M", "--born", "1890"]);
  await w.ok(["repo", "add", "Státní oblastní archiv v Lhotě", "--url", "https://archiv-lhota.example/"]); // R0001
  await w.ok(["recordset", "add", "Lhota 3, N 1784–1820", "--repo", "R0001", "--years", "1784-1820", "--access", "online-free", "--url", "https://archiv-lhota.example/kniha/3", "--images", "20"]); // B0001
  await w.ok(["recordset", "add", "Матрика Lhotíčky O 1800–1850".normalize("NFD"), "--access", "online-login", "--images", "10"]); // B0002
  await w.ok(["recordset", "add", "Lhota 4, Z 1790–1830", "--repo", "R0001", "--access", "onsite"]); // B0003
  await w.ok(["recordset", "add", "Lhota 3, kopie", "--access", "online-free", "--url", "https://archiv-lhota.example/kniha/3a", "--again", "druhý film"]); // B0004
  await w.ok(["recordset", "add", "Lhota omylem", "--access", "online-free", "--url", "https://archiv-lhota.example/kniha/9"]); // B0005
  await w.ok(["recordset", "add", "Lhota 5, N 1830–1840", "--access", "online-free", "--url", "https://archiv-lhota.example/kniha/5", "--images", "3"]); // B0006
  let n = 0;
  const add = async (where: string[]) => {
    await w.ok(["task", "add", `Zápis ${++n} Lhoták`, "--level", "link", ...where.flatMap((b) => ["--where", b]), "--why", "rodiče", "--done-when", "nalezeno", "--about", "P1", "--anyway"]);
    return `T${n}`;
  };
  for (let i = 0; i < 3; i++) await add(["B1"]); // T1–T3
  await add(["B4"]); // T4: the book merged into B1
  await w.ok(["task", "wait", await add(["B1"]), "--images", "B0001:4-6", "--on", "Snímky 4–6 k uložení ručně."]); // T5: 4 is on disk already
  await w.ok(["task", "park", await add(["B1"]), "--reason", "později"]); // T6
  await w.ok(["task", "done", await add(["B1"]), "--result", "nalezeno"]); // T7: done, not counted
  await add(["B1", "B2", "Lhota, fara"]); // T8: two books and a description
  for (let i = 0; i < 3; i++) await add(["B2"]); // T9–T11
  await w.ok(["task", "wait", await add(["B2"]), "--images", "B0002:3", "--on", "Snímek 3 k uložení ručně."]); // T12
  for (let i = 0; i < 6; i++) await add(["B3"]); // T13–T18
  await add(["B5"]); // T19: its book taken back
  for (let i = 0; i < 5; i++) await add(["B6"]); // T20–T24
  await add(["fara Lhota, nějaká kniha"]); // T25: no book named — never guessed
  // B4 merged into B1, B5 taken back; images registered: B1 1–4 and 25 (past its 20), B4's 7 (counts for B1), B6 all
  const tree = Tree.open(w.cwd, w.env);
  tree.withTreeLock(() => {
    const at = now();
    const b4 = tree.get<RecordSet>("B0004")!;
    tree.put({ ...b4, mergedInto: "B0001", retracted: { at, reason: "merged into B0001" }, updated: at }, { op: "recordset.merge", targets: ["B0004", "B0001"], summary: "B0004 merged into B0001" });
    const b5 = tree.get<RecordSet>("B0005")!;
    tree.put({ ...b5, retracted: { at, reason: "omyl" }, updated: at }, { op: "recordset.retract", targets: ["B0005"], summary: "B0005 taken back" });
    const image = (recordset: string, n: number) => {
      const id = tree.allocate("M");
      const m: Media = { id, type: "media", created: at, updated: at, sha: id.padEnd(64, "0"), file: `media/${id}.jpg`, mime: "image/jpeg", size: 1, recordset, image: n, notes: [] };
      tree.put(m, { op: "media.add", targets: [id], summary: `image ${id}` });
    };
    for (const n of [1, 2, 3, 4, 25]) image("B0001", n);
    image("B0004", 7);
    for (const n of [1, 2, 3]) image("B0006", n);
  });
  tree.commit("merged, taken back, images");
  return w;
}

test("K1.1–K1.3: the books the tasks need — counted, offered, listed, said to the agent", opts, async () => {
  const w = await world();
  try {
    // the count (core/books.ts)
    const tree = Tree.open(w.cwd, w.env);
    const rows = bookRows(tree);
    assert.deepEqual(
      rows.map((r) => [r.id, r.tasks, r.offer]),
      [
        ["B0001", 7, true],
        ["B0003", 6, false],
        ["B0002", 5, true],
        ["B0006", 5, false],
      ],
    );
    const b1 = rows[0]!;
    assert.deepEqual(b1.ids, { open: ["T1", "T2", "T3", "T4", "T8"].map((t) => t.replace(/\d+/u, (d) => d.padStart(4, "0"))), parked: ["T0006"], waiting: ["T0005"] });
    assert.equal(b1.open, 5);
    assert.equal(b1.waiting, 1);
    assert.equal(b1.parked, 1);
    assert.deepEqual(b1.archive, { id: "R0001", name: "Státní oblastní archiv v Lhotě", url: "https://archiv-lhota.example/" });
    assert.equal(b1.years, "1784-1820");
    // on disk: each number once, B0004's image counted for B0001; missing only of the catalog's 20
    assert.equal(b1.onDisk, 6);
    assert.equal(b1.images, 20);
    assert.equal(b1.missing, 15);
    // needed: what the waiting tasks wait for and is not on disk yet (4 is)
    assert.equal(b1.need, "5–6");
    assert.equal(b1.needCount, 2);
    assert.equal(b1.download, "range");
    assert.equal(b1.folder, "B0001 Lhota 3, N 1784–1820");
    // a title typed decomposed is kept composed; its folder as the inbox names it
    const b2 = rows.find((r) => r.id === "B0002")!;
    assert.equal(b2.title, "Матрика Lhotíčky O 1800–1850".normalize("NFC"));
    assert.equal(b2.folder, inboxFolderFor({ id: "B0002", title: b2.title }));
    assert.equal(b2.onDisk, 0);
    assert.equal(b2.missing, 10);
    assert.equal(b2.need, "3");
    assert.equal(b2.needCount, 1);
    assert.equal(b2.archive, undefined);
    assert.equal(rows.find((r) => r.id === "B0006")!.missing, 0, "whole on disk");
    assert.deepEqual(offeredBooks(tree).map((r) => r.id), ["B0001", "B0002"]);
    assert.deepEqual(offeredBooks(tree, 6).map((r) => r.id), ["B0001"]);

    // strom task books
    const books = await w.ok(["task", "books", "--json"]);
    assert.equal(books.json.min, 5);
    assert.deepEqual(books.json.books.map((b: { id: string }) => b.id), ["B0001", "B0002"]);
    assert.equal(books.json.books[0].dir, path.join(w.home, "shared", "inbox", "B0001 Lhota 3, N 1784–1820"));
    const text = (await w.ok(["task", "books"])).out;
    assert.match(text, /^B0001 Lhota 3, N 1784–1820\n {2}Státní oblastní archiv v Lhotě · 1784-1820 · online-free\n {2}7 tasks \(1 waiting, 1 parked\) · images 20, on disk 6, missing 15 · needed, not on disk 5–6\n {2}folder .*B0001 Lhota 3, N 1784–1820\n {2}https:\/\/archiv-lhota\.example\/kniha\/3\n {2}strom task list --book B0001\n/u);
    assert.match(text, /\nB0002 Матрика Lhotíčky O 1800–1850\n {2}online-login\n {2}5 tasks \(1 waiting\) · images 10, on disk 0, missing 10 · needed, not on disk 3\n/u);
    assert.deepEqual((await w.ok(["task", "books", "--min", "6", "--json"])).json.books.map((b: { id: string }) => b.id), ["B0001"]);
    assert.deepEqual((await w.ok(["task", "books", "--all", "--json"])).json.books.map((b: { id: string; offer: boolean }) => `${b.id} ${b.offer}`), ["B0001 true", "B0003 false", "B0002 true", "B0006 false"]);
    assert.match((await w.ok(["task", "books", "--min", "9"])).out, /^no book worth downloading by hand: at least 9 tasks, online, not whole on disk, the whole book or the images its tasks need to offer \(every book the tasks name: strom task books --all\)$/mu);
    const bad = await w.run(["task", "books", "--min", "0"]);
    assert.notEqual(bad.code, 0);
    assert.match(bad.err, /--min 0: a whole number from 1 to 999/u);

    // strom task list --book: open first, then parked, then waiting; a merged book is the one it went into
    const list = await w.ok(["task", "list", "--book", "B1", "--json"]);
    assert.deepEqual(list.json.tasks.map((t: { id: string }) => t.id), ["T0001", "T0002", "T0003", "T0004", "T0008", "T0006", "T0005"]);
    assert.deepEqual((await w.ok(["task", "list", "--book", "B4", "--json"])).json.tasks.map((t: { id: string }) => t.id), list.json.tasks.map((t: { id: string }) => t.id));
    assert.deepEqual((await w.ok(["task", "list", "--book", "B0001", "--state", "waiting", "--json"])).json.tasks.map((t: { id: string }) => t.id), ["T0005"]);
    assert.match((await w.ok(["task", "list", "--book", "B2"])).out, /^B0002 Матрика Lhotíčky O 1800–1850\nT0008 /u);
    const gone = await w.run(["task", "list", "--book", "B5"]);
    assert.notEqual(gone.code, 0);
    assert.match(gone.err, /B0005 was taken back: no task needs it/u);
    assert.match((await w.run(["task", "list", "--book", "B99"])).err, /no record set B0099/u);
    assert.match((await w.run(["task", "list", "--book", "P1"])).err, /P1 is not a recordset ID/u);

    // the sentence to the agent: strom task show, the brief
    assert.match((await w.ok(["task", "show", "T1"])).out, /\nbook {3}the same book is needed by 6 more tasks: T0002 T0003 T0004 T0008 · waiting T0005 · parked T0006 — strom task list --book B0001\n/u);
    const two = (await w.ok(["task", "show", "T8"])).out;
    assert.match(two, /\nbook {3}B0001: the same book is needed by 6 more tasks: T0001 T0002 T0003 T0004 · waiting T0005 · parked T0006 — strom task list --book B0001\n/u);
    assert.match(two, /\nbook {3}B0002: the same book is needed by 4 more tasks: T0009 T0010 T0011 · waiting T0012 — strom task list --book B0002\n/u);
    assert.match((await w.ok(["task", "show", "T4"])).out, /the same book is needed by 6 more tasks: T0001 T0002 T0003 T0008 · waiting T0005 · parked T0006 — strom task list --book B0001/u);
    assert.doesNotMatch((await w.ok(["task", "show", "T7"])).out, /the same book/u, "a done task is told nothing");
    assert.doesNotMatch((await w.ok(["task", "show", "T19"])).out, /the same book/u, "a book taken back");
    assert.doesNotMatch((await w.ok(["task", "show", "T25"])).out, /the same book/u, "no book named");
    const brief = (await w.ok(["brief", "T1"])).out;
    assert.match(brief, /\n {2}B0001 Lhota 3, N 1784–1820\n[^]*?\n {4}the same book is needed by 6 more tasks: T0002 T0003 T0004 T0008 · waiting T0005 · parked T0006 — strom task list --book B0001\n/u);
    // at most so many IDs named, the rest counted
    const t1 = Tree.open(w.cwd, w.env).get<Task>("T0001")!;
    assert.equal(sameBookLine(Tree.open(w.cwd, w.env), t1, "B0001", 3), "the same book is needed by 6 more tasks: T0002 T0003 T0004 (+3) — strom task list --book B0001");

    // a range is offered only with the images its tasks need (spec 105, 16 Nov): nothing waits on B0002 now
    await w.ok(["task", "wake", "T12"]);
    const woke = bookRows(Tree.open(w.cwd, w.env)).find((r) => r.id === "B0002")!;
    assert.deepEqual([woke.tasks, woke.need, woke.needCount, woke.offer], [5, undefined, undefined, false]);
    assert.deepEqual((await w.ok(["task", "books", "--json"])).json.books.map((b: { id: string }) => b.id), ["B0001"]);
  } finally {
    w.cleanup();
  }
});

test("What waits shows the books most tasks need in the research language", opts, async () => {
  for (const lang of ["cs", "de", "en", "pl"]) {
    const k = waitKeys(lang);
    const all = [k.next, k.prev, k.all, k.books, ...Object.values(k.section)];
    assert.equal(new Set(all).size, all.length, `${lang}: ${all.join(" ")}`);
  }
  const w = await world();
  try {
    // 3 What waits · k the books · Enter · 0 back · 0 the end
    const r = await w.ok([], { tty: true, answers: ["3", "k", "", "0", "0"] });
    assert.match(r.out, / \[k\] knihy s nejvíc úkoly 2\n\n {2}\[0\] {2}Zpět\n/u);
    assert.match(r.out, /\nStrom › Co čeká › Knihy s nejvíc úkoly\n {2}2 knihy · Jedno ruční stažení poslouží všem úkolům knihy; bez něj agent čte dál online\.\n\n 1 {2}Lhota 3, N 1784–1820 · 7 úkolů · 1 čeká\n {4}Státní oblastní archiv v Lhotě · 1784-1820 · snímků 20, na disku 6, chybí 15\n {4}potřebné snímky, které nejsou na disku: 5–6\n {4}https:\/\/archiv-lhota\.example\/kniha\/3\n {4}složka pro snímky: .*B0001 Lhota 3, N 1784–1820.\n 2 {2}Матрика Lhotíčky O 1800–1850 · 5 úkolů · 1 čeká\n {4}snímků 10, na disku 0, chybí 10\n {4}potřebné snímky, které nejsou na disku: 3\n/u);
    const en = await w.ok([], { tty: true, answers: ["3", "b", "", "0", "0"], env: { STROM_LANG: "en" } });
    assert.match(en.out, /\nStrom › What waits › Books with the most tasks\n {2}2 books · One download by hand serves every task of a book; without it the agent reads on online\.\n\n 1 {2}Lhota 3, N 1784–1820 · 7 tasks · 1 waiting\n[^]*?\n {4}images needed, not on disk: 5–6\n/u);
    // nothing waits: no range to offer either (the whole book comes with the archives' terms) — what waits says so alone
    await w.ok(["task", "wake", "T5"]);
    await w.ok(["task", "wake", "T12"]);
    const none = await w.ok([], { tty: true, answers: ["3", "", "0"] });
    assert.match(none.out, /Nic nečeká\./u);
    assert.doesNotMatch(none.out, /Knihy s nejvíc úkoly/u);
  } finally {
    w.cleanup();
  }
});
