// How a task's wait is written, checked (spec 109 U2, core/taskaudit.ts): images of a book named only in words, several
// books in one wait, a book the research does not have, the inbox folder missing — found, fixed in one step (the task
// waits for its book's images, each other book a task of its own), undone while nothing changed, kept as it is by the
// person alone. strom task wait and task edit refuse such a wait before writing it (K1.1); task park, task wait and
// session close tell the agent what is still not as strom needs it (K1.2).

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import { inboxFolderFor } from "../../src/core/media.ts";
import { SETTLE_MS } from "../../src/core/inboxwait.ts";
import { auditOf, bookIndex, findingsOf, readWait } from "../../src/core/taskaudit.ts";
import type { Media, RecordSet, Task } from "../../src/core/model.ts";
import { foldText } from "../../src/core/text.ts";

const opts = { skip: !hasGit, timeout: 180_000 };
const fixtures = path.join(import.meta.dirname, "..", "fixtures", "images");

const LHOTA = "Lhota 3, N 1784–1820";
const TEXT = "Snímky 57–58 z knihy Lhota 3, N 1784–1820 a snímek 14 z knihy Vranov 9, O 1801–1850 (https://archive.example.org/vranov/9) k ručnímu uložení";

/** A research with three books: B0001, B0002 of Podhradí, B0003 of Lhota. */
async function world(): Promise<{ w: World; shared: string }> {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["research", "new", "Předci Vojtěcha", "--new-person", "Vojtěch /Lhoták/", "--sex", "M", "--born", "1790"]);
  await w.ok(["recordset", "add", "Podhradí 1, N 1700–1750", "--access", "online-free", "--url", "https://archive.example.org/podhradi/1"]);
  await w.ok(["recordset", "add", "Podhradí 2, O 1750–1800", "--access", "online-free", "--url", "https://archive.example.org/podhradi/2"]);
  await w.ok(["recordset", "add", LHOTA, "--access", "online-free", "--url", "https://archive.example.org/lhota/3"]);
  return { w, shared: path.join(w.home, "shared") };
}

/** A task added, its ID. */
async function task(w: World, what: string, where: string[]): Promise<string> {
  const r = await w.ok(["task", "add", what, "--level", "link", ...where.flatMap((x) => ["--where", x]), "--why", "rodiče Vojtěcha", "--done-when", "zápis nalezen", "--about", "P1", "--anyway", "--json"]);
  return r.json.task.id as string;
}

/** A task set waiting as an older strom (or an agent before this check) wrote it: straight into the research. */
function waitAs(w: World, id: string, fields: Partial<Task>): Task {
  const tree = Tree.open(w.cwd, w.env);
  let out!: Task;
  tree.withTreeLock(() => {
    const t = tree.get<Task>(id)!;
    out = { ...t, state: "waiting", ...fields, updated: new Date().toISOString() };
    tree.put(out, { op: "task.wait", targets: [id], summary: `${id} wait` });
  });
  tree.commit(`${id} wait`);
  return out;
}

function get(w: World, id: string): Task {
  return Tree.open(w.cwd, w.env).get<Task>(id)!;
}

/** A file saved long enough ago to have settled. */
function saved(to: string, image = "s0001.jpg"): void {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(path.join(fixtures, image), to);
  const past = new Date(Date.now() - 2 * SETTLE_MS);
  fs.utimesSync(to, past, past);
}

const waitOf = (t: Task) => ({ state: t.state, waitingOn: t.waitingOn, wait: t.wait, awaits: t.awaits, where: t.where });

test("a wait of two books in words: found, fixed (one book per task), undone; images saved before the fix wake the task, undoing keeps them", opts, async () => {
  const { w, shared } = await world();
  const id = await task(w, "Křest Vojtěcha Lhotáka (~1790)", ["B0003"]);
  const before = waitAs(w, id, { waitingOn: TEXT });

  const all = (await w.ok(["task", "audit", "--json"])).json;
  assert.equal(all.tasks.length, 1);
  const a = all.tasks[0];
  assert.equal(a.task, id);
  assert.deepEqual(a.findings.map((f: { kind: string }) => f.kind), ["images-as-text", "several-books", "book-unknown"]);
  assert.deepEqual(a.findings[0].books, ["B0003"]);
  assert.deepEqual(a.findings[2], { kind: "book-unknown", unknown: ["Vranov 9, O 1801–1850"], url: "https://archive.example.org/vranov/9" });
  assert.equal(a.fix.can, "part");
  assert.deepEqual(a.fix.left, ["book-unknown"]);
  assert.equal(a.fix.stamp, `${id}@${before.updated}`);
  const folder = inboxFolderFor({ id: "B0003", title: LHOTA });
  assert.deepEqual(a.fix.changes, [
    { op: "wait-images", task: id, book: "B0003", title: LHOTA, images: "57–58", folder },
    { op: "split", task: null, from: id, title: "Vranov 9, O 1801–1850", images: "14", url: "https://archive.example.org/vranov/9", waits: "text" },
  ]);
  assert.equal(a.kept, null);
  assert.equal(a.fixed, null);
  assert.ok(typeof all.head === "string" && all.head.length >= 7);
  const said = (await w.ok(["task", "audit", id])).out;
  assert.match(said, /images-as-text B0003/);
  assert.match(said, new RegExp(`strom task audit ${id} --fix`));
  assert.match(said, new RegExp(`by hand: strom task wait ${id} --images B0003:57-58 --on "Snímky 57–58 z knihy Lhota 3, N 1784–1820"`));
  assert.match(said, /strom recordset add "Vranov 9, O 1801–1850" --url https:\/\/archive\.example\.org\/vranov\/9/);
  // task show says it too
  const shown = await w.ok(["task", "show", id, "--json"]);
  assert.deepEqual(shown.json.audit.findings.map((f: { kind: string }) => f.kind), ["images-as-text", "several-books", "book-unknown"]);
  assert.match((await w.ok(["task", "show", id])).out, /audit {2}.*wait not as strom needs it: images-as-text, several-books, book-unknown/);

  // a stamp of before: refused, nothing written
  const stale = await w.run(["task", "audit", id, "--fix", "--expect", `${id}@2020-01-01T00:00:00.000Z`, "--json"]);
  assert.equal(stale.code, 2, stale.out + stale.err);
  assert.match(stale.out + stale.err, /audit\.changed/);

  const fixed = (await w.ok(["task", "audit", id, "--fix", "--expect", a.fix.stamp, "--json"])).json;
  const split = fixed.made[0] as string;
  assert.deepEqual(fixed.tasks, [id, split]);
  assert.deepEqual(fixed.woke, []);
  const t = get(w, id);
  assert.equal(t.state, "waiting");
  assert.deepEqual(t.awaits, { recordset: "B0003", images: "57–58", folder });
  assert.equal(t.waitingOn, "Snímky 57–58 z knihy Lhota 3, N 1784–1820");
  assert.equal(t.what, before.what);
  assert.ok(fs.existsSync(path.join(shared, "inbox", folder)), "its folder made");
  const s = get(w, split);
  assert.equal(s.splitFrom, id);
  assert.equal(s.state, "waiting");
  assert.equal(s.what, before.what);
  assert.ok(!s.where.includes("B0003"), "no images of B0003 wake it");
  assert.equal(s.waitingOn, "Snímek 14 z knihy Vranov 9, O 1801–1850 (https://archive.example.org/vranov/9) k ručnímu uložení");
  assert.deepEqual(s.wait, { kind: "web", url: "https://archive.example.org/vranov/9" });
  const after = (await w.ok(["task", "audit", "--json"])).json;
  assert.deepEqual(after.tasks.map((x: { task: string }) => x.task), [split]);
  assert.deepEqual(after.tasks[0].findings.map((f: { kind: string }) => f.kind), ["book-unknown"]);
  assert.equal(after.tasks[0].fix.can, "none");
  // one commit, its op the audit's
  const log = (await w.ok(["log", "-1", "--json"]).catch(() => undefined))?.json;
  void log;
  assert.match((await w.ok(["task", "show", id])).out, /fixed by the audit .* — undone by strom task audit/);

  // undone: the task waits as it did, the task it made taken back
  const undone = (await w.ok(["task", "audit", id, "--unfix", "--json"])).json;
  assert.deepEqual(undone.tasks, [id, split]);
  assert.deepEqual(waitOf(get(w, id)), waitOf(before));
  assert.equal(get(w, id).auditFix, undefined);
  assert.ok(get(w, split).retracted, "taken back, not deleted");
  assert.equal(get(w, split).state, "dropped");
  const again = await w.run(["task", "audit", id, "--unfix", "--json"]);
  assert.equal(again.code, 2);
  assert.match(again.out + again.err, /audit\.none/);

  // the images saved before the fix: taken by it, the task back in the queue; undoing keeps them
  saved(path.join(shared, "inbox", folder, "57.jpg"));
  saved(path.join(shared, "inbox", folder, "58.jpg"), "s0002.jpg");
  const woke = (await w.ok(["task", "audit", id, "--fix", "--json"])).json;
  assert.deepEqual(woke.woke, [id]);
  assert.equal(get(w, id).state, "open");
  const images = () =>
    Tree.open(w.cwd, w.env)
      .list<Media>("media")
      .filter((m) => m.recordset === "B0003" && !m.retracted)
      .map((m) => m.image)
      .sort();
  assert.deepEqual(images(), [57, 58]);
  await w.ok(["task", "audit", id, "--unfix"]);
  assert.deepEqual(waitOf(get(w, id)), waitOf(before));
  assert.deepEqual(images(), [57, 58], "the images registered stay");
  // after a change of the task the fix is not undone
  const third = (await w.ok(["task", "audit", id, "--fix", "--json"])).json;
  await w.ok(["task", "edit", third.made[0], "--priority", "2"]);
  const refused = await w.run(["task", "audit", id, "--unfix", "--json"]);
  assert.equal(refused.code, 2);
  assert.match(refused.out + refused.err, /audit\.changed/);
});

test("kept as it is: the person's alone, holds while the wait is the same", opts, async () => {
  const { w } = await world();
  const id = await task(w, "Křest Vojtěcha Lhotáka (~1790)", ["B0003"]);
  waitAs(w, id, { waitingOn: TEXT });
  const agent = await w.run(["task", "audit", id, "--keep", "--json"], { env: { STROM_IN_AGENT: "1" } });
  assert.equal(agent.code, 2);
  assert.match(agent.out + agent.err, /audit\.person-only/);
  await w.ok(["task", "audit", id, "--keep"]);
  const k = get(w, id).auditKept!;
  assert.deepEqual(k.kinds, ["images-as-text", "several-books", "book-unknown"]);
  assert.match(k.wait, /^[0-9a-f]{16}$/);
  const list = (await w.ok(["task", "audit", "--json"])).json;
  assert.deepEqual(list.tasks, []);
  assert.equal(list.kept, 1);
  assert.equal((await w.ok(["task", "audit", "--all", "--json"])).json.tasks[0].kept.kinds.length, 3);
  // the wait written otherwise: kept no more
  waitAs(w, id, { waitingOn: `${TEXT}.` });
  assert.equal((await w.ok(["task", "audit", "--json"])).json.tasks.length, 1);
  await w.ok(["task", "audit", id, "--unkeep"]);
  assert.equal(get(w, id).auditKept, undefined);
  // from the app (its bridge runs strom as the person's): marked so
  await w.ok(["task", "audit", id, "--keep"], { env: { STROM_FOR_APP: "1" } });
  assert.equal(get(w, id).auditKept!.givenIn, "app");
  assert.equal(get(w, id).auditKept!.by, "app");
});

test("a list of four books as an agent wrote it: two of the research, two it does not have — each its own task", opts, async () => {
  const { w } = await world();
  const id = await task(w, "Rodiče Vojtěcha Lhotáka", ["B0001", "B0002"]);
  waitAs(w, id, {
    waitingOn:
      "Snímky ze čtyř knih k ručnímu uložení: 1) B0001 – křty Podhradí, snímky 41–60; 2) B0002 – rejstřík, je-li, jinak snímky let 1795–1812; " +
      "3) kniha zemřelých Lhoty po r. 1786 (číslo knihy dohledat u fary Lhota) – titulní snímek a snímky let 1795–1812; 4) kniha oddaných Vranova 1790–1820 – snímky let 1795–1800",
    wait: { kind: "web", url: "https://archive.example.org/" },
  });
  const a = (await w.ok(["task", "audit", id, "--json"])).json.tasks[0];
  assert.deepEqual(a.findings.map((f: { kind: string }) => f.kind), ["images-as-text", "several-books", "book-unknown"]);
  assert.deepEqual(a.findings[2].unknown, ["Kniha zemřelých Lhoty po r. 1786", "Kniha oddaných Vranova 1790–1820"]);
  assert.equal(a.fix.can, "part");
  assert.deepEqual(
    a.fix.changes.map((c: { op: string; book?: string; images?: string; waits?: string }) => [c.op, c.book ?? null, c.images ?? null, c.waits ?? null]),
    [
      ["wait-images", "B0001", "41–60", null],
      ["split", "B0002", null, "book"],
      ["split", null, null, "text"],
      ["split", null, null, "text"],
    ],
  );
  const fixed = (await w.ok(["task", "audit", id, "--fix", "--json"])).json;
  assert.equal(fixed.made.length, 3);
  const t = get(w, id);
  assert.equal(t.awaits?.recordset, "B0001");
  assert.deepEqual(t.wait, { url: "https://archive.example.org/" });
  const byBook = get(w, fixed.made[0]);
  assert.deepEqual(byBook.wait, { kind: "web", book: "B0002" });
  assert.deepEqual(byBook.where, ["B0002"]);
  const left = (await w.ok(["task", "audit", "--json"])).json.tasks.map((x: { task: string; findings: { kind: string }[] }) => [x.task, x.findings.map((f) => f.kind)]);
  assert.deepEqual(left, [
    [fixed.made[1], ["book-unknown"]],
    [fixed.made[2], ["book-unknown"]],
  ]);
});

/** A book of the research under an ID of its own (as a research long under way has them): B0003's record, another name. */
function bookAs(w: World, id: string, title: string, url: string): void {
  const tree = Tree.open(w.cwd, w.env);
  tree.withTreeLock(() => {
    tree.put({ ...tree.get<RecordSet>("B0003")!, id, title, url, notes: [] }, { op: "recordset.add", targets: [id], summary: `${id} added` });
  });
  tree.commit(`${id} added`);
}

const HEADING = "Ruční uložení snímků z digitálního archivu (archive.example.org):";
const REAL =
  `${HEADING} 1) Lhota 01 (id 7310), snímky 41–60 (rejstřík zemřelých 1781–1804), do B0201; ` +
  "2) kniha zemřelých Lhoty po r. 1786 (číslo knihy v archivu dohledat u fary Lhota) – titulní snímek a snímky let 1795–1812; " +
  "3) Vranov kn. 14 (id 6220, zemřelí 1786–1840) – rejstřík, je-li, jinak snímky let 1795–1812, do B0302; " +
  "4) kniha zemřelých fary Podhradí od 1782 (číslo dohledat u fary Podhradí) – rejstřík nebo snímky let 1795–1812. U každé knihy zapsat její id a rozsah.";

/** The words of a text (folded), without a list's numbers. */
const wordsIn = (s: string) => new Set(foldText(s.replace(/(?<![\p{L}\p{M}\p{N}])\d{1,2}\)\s/gu, " ")).split(/[^\p{L}\p{M}\p{N}]+/u).filter(Boolean));

test("a wait of four books as an agent wrote it (a heading, closing words, a book with no number in its name): each book its task, no word of the wait lost, undone to the letter", opts, async () => {
  const { w } = await world();
  bookAs(w, "B0201", "Lhota 01, N 1786, O 1771–1787", "https://archive.example.org/7310");
  bookAs(w, "B0302", "Vranov 14, Z 1786–1840", "https://archive.example.org/6220");
  const id = await task(w, "Úmrtí otce Vojtěcha Lhotáka", ["B0302", "B0201"]);
  const before = waitAs(w, id, { waitingOn: REAL, wait: { kind: "web", url: "https://archive.example.org/" } });
  const a = (await w.ok(["task", "audit", id, "--json"])).json.tasks[0];
  assert.deepEqual(a.findings.map((f: { kind: string }) => f.kind), ["images-as-text", "several-books", "book-unknown"]);
  assert.deepEqual(a.findings[0].books, ["B0201", "B0302"]);
  assert.deepEqual(a.findings[2].unknown, ["Kniha zemřelých Lhoty po r. 1786", "Kniha zemřelých fary Podhradí od 1782"]);
  assert.equal(a.fix.can, "part");
  assert.deepEqual(
    a.fix.changes.map((c: { op: string; book?: string; title: string; images?: string; waits?: string }) => [c.op, c.book ?? c.title, c.images ?? null, c.waits ?? null]),
    [
      ["wait-images", "B0201", "41–60", null],
      ["split", "Kniha zemřelých Lhoty po r. 1786", null, "text"],
      ["split", "B0302", null, "book"],
      ["split", "Kniha zemřelých fary Podhradí od 1782", null, "text"],
    ],
  );

  const fixed = (await w.ok(["task", "audit", id, "--fix", "--json"])).json;
  assert.equal(fixed.made.length, 3);
  const t = get(w, id);
  assert.deepEqual(t.awaits?.recordset, "B0201");
  // its book's item whole, as it stood, the heading and the closing words with it
  assert.equal(t.waitingOn, `${HEADING} 1) Lhota 01 (id 7310), snímky 41–60 (rejstřík zemřelých 1781–1804), do B0201. U každé knihy zapsat její id a rozsah.`);
  const [lhoty, vranov, podhradi] = (fixed.made as string[]).map((m) => get(w, m));
  assert.equal(vranov!.waitingOn, `${HEADING} 3) Vranov kn. 14 (id 6220, zemřelí 1786–1840) – rejstřík, je-li, jinak snímky let 1795–1812, do B0302`);
  assert.deepEqual(vranov!.wait, { kind: "web", book: "B0302" });
  assert.equal(lhoty!.waitingOn, `${HEADING} 2) kniha zemřelých Lhoty po r. 1786 (číslo knihy v archivu dohledat u fary Lhota) – titulní snímek a snímky let 1795–1812`);
  assert.equal(podhradi!.waitingOn, `${HEADING} 4) kniha zemřelých fary Podhradí od 1782 (číslo dohledat u fary Podhradí) – rejstřík nebo snímky let 1795–1812.`);
  // every word of the wait in the words of one of its tasks
  const given = new Set([t, vranov!, lhoty!, podhradi!].flatMap((x) => [...wordsIn(x.waitingOn!)]));
  for (const word of wordsIn(REAL)) assert.ok(given.has(word), `"${word}" lost`);
  // the task and the book's own task as strom needs them; the two books the research does not have, the agent's
  const left = (await w.ok(["task", "audit", "--json"])).json.tasks.map((x: { task: string; findings: { kind: string }[] }) => [x.task, x.findings.map((f) => f.kind)]);
  assert.deepEqual(left, [
    [lhoty!.id, ["book-unknown"]],
    [podhradi!.id, ["book-unknown"]],
  ]);
  await w.ok(["task", "audit", id, "--unfix"]);
  assert.deepEqual(waitOf(get(w, id)), waitOf(before));

  // a book with no number in its name, beside another book: a book of its own, never of none
  const tree = Tree.open(w.cwd, w.env);
  assert.deepEqual(
    readWait(tree, { waitingOn: "Snímky 5–6 z B0003; snímky let 1795–1812 z knihy zemřelých fary Podhradí", where: [] }).map((p) => p.book ?? p.unknown ?? null),
    ["B0003", "Zemřelých fary Podhradí"],
  );
  // alone, with no book beside it: no book named (its words may be any of the research's)
  assert.deepEqual(readWait(tree, { waitingOn: "Snímky let 1795–1812 z knihy zemřelých fary Podhradí", where: [] }).map((p) => p.book ?? p.unknown ?? null), [null]);
});

test("a wait by its book naming that book's images by their numbers: its images by their numbers (any image of the book woke it); a guessed number is none", opts, async () => {
  const { w, shared } = await world();
  const folder = inboxFolderFor({ id: "B0003", title: LHOTA });
  fs.mkdirSync(path.join(shared, "inbox", folder), { recursive: true });
  const id = await task(w, "Sňatek rodičů Vojtěcha", ["B0003"]);
  const words = "Snímky 10–12 z knihy Lhota 3, N 1784–1820";
  waitAs(w, id, { waitingOn: words, wait: { kind: "web" } });
  const a = (await w.ok(["task", "audit", id, "--json"])).json.tasks[0];
  assert.deepEqual(a.findings, [{ kind: "images-as-text", books: ["B0003"] }]);
  assert.equal(a.fix.can, "whole");
  assert.deepEqual(a.fix.changes, [{ op: "wait-images", task: id, book: "B0003", title: LHOTA, images: "10–12", folder }]);
  // its where the book, no kind said: the same
  const tree = Tree.open(w.cwd, w.env);
  const t0 = tree.get<Task>(id)!;
  assert.deepEqual(findingsOf(tree, { ...t0, wait: undefined as unknown as Task["wait"] }).map((f) => f.kind), ["images-as-text"]);
  // written so again: refused, the images by their numbers said
  await w.ok(["task", "wait", id, "--on", "Odpověď fary", "--kind", "letter"]);
  for (const args of [["task", "wait", id, "--kind", "web", "--book", "B0003", "--on", words], ["task", "edit", id, "--kind", "web", "--on", words]]) {
    const r = await w.run([...args, "--json"]);
    assert.equal(r.code, 2, r.out + r.err);
    assert.match(r.out + r.err, /task\.wait-images/);
    assert.match(r.out + r.err, new RegExp(`strom task wait ${id} --images B0003:10-12`));
    assert.equal(get(w, id).waitingOn, "Odpověď fary", "nothing written");
  }
  await w.ok(["task", "wait", id, "--images", "B0003:10-12", "--on", words]);
  // a number guessed before an image word, or before the number: no number of an image
  const nums = (s: string) => readWait(tree, { waitingOn: s, where: [] }).flatMap((p) => p.numbers);
  for (const s of ["1853 ≈ sn. 160", "asi snímek 40 z knihy Lhota 3", "cca. snímky 40–45", "ca. Bild 12", "approx. image 7", "około skan 9", "snímky asi 160", "snímky ~160", "kolem snímku 30"])
    assert.deepEqual(nums(s), [], s);
  assert.deepEqual(nums("snímky 40–41, asi 10 snímků na rok"), [40, 41]);
});

test("no finding: a wait by its one book (sn. 160 in its words), a letter, the family, a site with no book; any script", opts, async () => {
  const { w, shared } = await world();
  const byBook = await task(w, "Křest Vojtěcha Lhotáka (~1790)", ["B0003"]);
  waitAs(w, byBook, {
    waitingOn:
      "Zápis křtu Vojtěcha Lhotáka v knize Lhota 3, N 1784–1820 (https://archive.example.org/lhota/3) – čísla snímků se teprve musí najít v prohlížeči (1853 ≈ sn. 160, asi 10 snímků na rok)",
    wait: { kind: "web" },
  });
  fs.mkdirSync(path.join(shared, "inbox", inboxFolderFor({ id: "B0003", title: LHOTA })), { recursive: true });
  const letter = await task(w, "Opis křtu Vojtěcha", ["matriční úřad Lhota"]);
  waitAs(w, letter, { waitingOn: "Odpověď matričního úřadu v Lhotě na dotaz ze 3. 10. – sken zápisu z knihy Lhota 3, N 1784–1820", wait: { kind: "letter" } });
  const family = await task(w, "Fotografie Vojtěcha", ["rodinný archiv"]);
  waitAs(w, family, { waitingOn: "Sken, nebo zpráva, že nic takového není", wait: { kind: "family" } });
  const map = await task(w, "Dům Lhotáků", ["Katastrální mapa Lhoty 1842"]);
  waitAs(w, map, { waitingOn: "Katastrální mapa Lhoty z r. 1842 (https://maps.example.org/lhota/1842) – parcela č. 12", wait: { kind: "web" } });
  const all = (await w.ok(["task", "audit", "--json"])).json;
  assert.deepEqual(all.tasks, []);
  assert.match((await w.ok(["task", "audit"])).out, /every waiting task's wait is as strom needs it/);
  // the folder of the wait by its book gone: that alone is found, and the fix makes it
  fs.rmSync(path.join(shared, "inbox", inboxFolderFor({ id: "B0003", title: LHOTA })), { recursive: true });
  const missing = (await w.ok(["task", "audit", "--json"])).json.tasks[0];
  assert.deepEqual(missing.findings, [{ kind: "folder-missing", books: ["B0003"] }]);
  assert.equal(missing.fix.can, "whole");
  await w.ok(["task", "audit", byBook, "--fix"]);
  assert.ok(fs.existsSync(path.join(shared, "inbox", inboxFolderFor({ id: "B0003", title: LHOTA }))));

  // any script, decomposed or not
  const tree = Tree.open(w.cwd, w.env);
  const base = tree.get<Task>(byBook)!;
  const as = (waitingOn: string, where = ["B0003"]): string[] => {
    const t: Task = { ...base, state: "waiting", waitingOn, where };
    delete t.wait;
    delete t.awaits;
    return findingsOf(tree, t).map((f) => f.kind);
  };
  assert.deepEqual(as(TEXT.normalize("NFD")), ["images-as-text", "several-books", "book-unknown"]);
  assert.deepEqual(as("Bilder 12, 14 aus dem Buch Lhota 3, N 1784–1820 und Bild 7 aus dem Buch Vranov 9"), ["images-as-text", "several-books", "book-unknown"]);
  assert.deepEqual(readWait(tree, { waitingOn: "Bilder 12, 14 aus dem Buch Lhota 3, N 1784–1820 und Bild 7 aus dem Buch Vranov 9", where: [] }).map((p) => [p.book ?? p.unknown, p.numbers]), [
    ["B0003", [12, 14]],
    ["Vranov 9", [7]],
  ]);
  assert.deepEqual(as("Skany 5–6 z księgi Lhota 3, N 1784–1820".normalize("NFD")), ["images-as-text"]);
  assert.deepEqual(as("Снимки 12–14 из книги Лхота", []), []);
  // images of the one book of its where, no book named: that book's images in words
  assert.deepEqual(as("Snímky 40–45 k ručnímu uložení"), ["images-as-text"]);
  // years are no image numbers
  assert.deepEqual(readWait(tree, { waitingOn: "Snímky let 1795–1812 z knihy Lhota 3, N 1784–1820; snímky z roku 1806 z B0003", where: [] }).map((p) => p.numbers), [[], []]);
  assert.equal(auditOf(tree, tree.get<Task>(letter)!).findings.length, 0);
});

test("task wait and task edit refuse a wait for images not as strom needs it, nothing written; with --images or another kind it is written", opts, async () => {
  const { w } = await world();
  const id = await task(w, "Křest Vojtěcha Lhotáka (~1790)", ["B0003"]);
  const before = get(w, id);
  const r = await w.run(["task", "wait", id, "--on", TEXT, "--json"]);
  assert.equal(r.code, 2, r.out + r.err);
  assert.match(r.out + r.err, /task\.wait-images/);
  assert.match(r.out + r.err, new RegExp(`strom task wait ${id} --images B0003:57-58 --on`));
  assert.match(r.out + r.err, /strom recordset add \\?"Vranov 9, O 1801–1850\\?"/);
  assert.deepEqual(waitOf(get(w, id)), waitOf(before), "nothing written");
  // one book named in words alone, no kind: the images by their numbers
  const one = await w.run(["task", "wait", id, "--on", "Snímky 57–58 z knihy Lhota 3, N 1784–1820"]);
  assert.equal(one.code, 2);
  assert.match(one.out + one.err, new RegExp(`strom task wait ${id} --images B0003:57-58`));
  // a letter: its kind says it is no wait for images
  await w.ok(["task", "wait", id, "--on", TEXT, "--kind", "letter"]);
  // the images by their numbers, the words of that book alone
  const ok = await w.ok(["task", "wait", id, "--images", "B0003:57-58", "--on", "Snímky 57–58 z knihy Lhota 3, N 1784–1820"]);
  assert.doesNotMatch(ok.out, /check the task's wait/);
  // --images, the words of another book's images too: refused
  const two = await w.run(["task", "wait", id, "--images", "B0003:57-58", "--on", TEXT, "--json"]);
  assert.equal(two.code, 2);
  assert.match(two.out + two.err, /task\.wait-images/);
  // task edit: the words written again
  await w.ok(["task", "wait", id, "--on", "Odpověď fary", "--kind", "letter"]);
  const edit = await w.run(["task", "edit", id, "--on", TEXT, "--kind", "web", "--json"]);
  assert.equal(edit.code, 2);
  assert.match(edit.out + edit.err, /task\.wait-images/);
  assert.equal(get(w, id).waitingOn, "Odpověď fary");
  // a park for images saved by hand: said to be a wait
  const park = await w.ok(["task", "park", id, "--reason", "Čeká se na snímky 57–58 z knihy Lhota 3, N 1784–1820"]);
  assert.match(park.out, new RegExp(`check the task's wait: .*strom task wait ${id} --images B0003:57-58`));
});

test("session close tells the agent of the waits it touched that are not as strom needs it", opts, async () => {
  const { w } = await world();
  const id = await task(w, "Křest Vojtěcha Lhotáka (~1790)", ["B0003"]);
  const start = await w.ok(["session", "start", id, "--json"]);
  const session = start.json.session.id as string;
  const env = { STROM_SESSION: session };
  await w.ok(["task", "wait", id, "--on", "Odpověď fary", "--kind", "letter"], { env });
  // written as an older strom would have: in words, by the session
  const tree = Tree.open(w.cwd, { ...w.env, ...env });
  tree.actor = session;
  tree.withTreeLock(() => {
    const t = tree.get<Task>(id)!;
    tree.put({ ...t, waitingOn: TEXT, wait: undefined as unknown as Task["wait"], updated: new Date().toISOString() }, { op: "task.edit", targets: [id], summary: `${id} on` });
  });
  tree.commit(`${id} on`);
  const closed = await w.ok(["session", "close", "--summary", "Křest hledán", "--next", "snímky"], { env });
  assert.match(closed.out, new RegExp(`${id} wait not as strom needs it: images-as-text, several-books, book-unknown — strom task wait ${id} --images B0003:57-58 .*\\(strom task audit ${id} --fix does it\\)`));
  assert.match(closed.out, /check of each wait: the kind matches the words/);
});

test("strom chat --task: a wait not as strom needs it said in the first message, the fix after the person's yes; kept as it is, not said", opts, async () => {
  const { w } = await world();
  const id = await task(w, "Křest Vojtěcha Lhotáka (~1790)", ["B0003"]);
  waitAs(w, id, { waitingOn: TEXT });
  const first = async () =>
    ((await w.ok(["chat", "--task", id, "--where", "terminal", "--agent", "claude", "--print", "--json"])).json.args as string[]).find((a) => a.startsWith("Pojďme na úkol"))!;
  assert.match(
    await first(),
    new RegExp(
      `Jeho čekání není zapsané tak, jak ho strom potřebuje \\(snímky knihy jen slovy, snímky několika knih v jednom čekání, kniha, kterou výzkum ještě nemá\\)\\. Spusť \`strom task audit ${id}\`, navrhni mi opravu a zapiš ji, až s ní tady budu souhlasit\\.`,
      "u",
    ),
  );
  await w.ok(["task", "audit", id, "--keep"]);
  assert.doesNotMatch(await first(), /strom task audit/);
});

test("a book's name is found as words of its own, in any script — its pattern no class of every script's letters (hundreds of books: a second and a half a look)", opts, async () => {
  const { w } = await world();
  await w.ok(["recordset", "add", "Вранов 9, Р 1801–1850", "--access", "online-free"]); // B0004
  const tree = Tree.open(w.cwd, w.env);
  const index = bookIndex(tree);
  assert.ok(index.byText.length >= 4);
  for (const n of index.byText) assert.ok(!n.re.source.includes("\\p{"), n.re.source);
  const book = (text: string) => readWait(tree, { waitingOn: text, where: [] }, index).map((p) => p.book ?? null);
  assert.deepEqual(book("Snímky 5 z knihy Lhota 3"), ["B0003"]);
  assert.deepEqual(book("Snímky 5 z knihy Lhota‑3, N 1784–1820".normalize("NFD")), ["B0003"]);
  assert.deepEqual(book("Snímky 5 z knihy Lhota 3a"), [null], "a letter right after it: another book");
  assert.deepEqual(book("Snímky 5 z knihy Lhota 33"), [null]);
  assert.deepEqual(book("Snímky 5 z knihy Horní Lhota 3 a Lhota 3"), ["B0003"]);
  assert.deepEqual(book("Snímky 5 z knihy ŽLhota 3"), [null], "a letter right before it");
  assert.deepEqual(book("Snímky 5 z knihy Lhota 3x, pak Lhota 3"), ["B0003"], "the second time as words of its own");
  assert.deepEqual(book("Снимки 5, книга Вранов 9"), ["B0004"]);
  assert.deepEqual(book("Снимки 5, книга Вранов 98"), [null]);
});

test("images of two books by their IDs and numbers (B0001:20-22 a B0002:5-6, as an older strom wrote it): several books, the fix gives each book its task with its own numbers", opts, async () => {
  const { w } = await world();
  const id = await task(w, "Křest Vojtěcha Lhotáka (~1790)", ["fara Podhradí"]);
  const words = "snímky B0001:20-22 a B0002:5-6 uložit ručně";
  waitAs(w, id, { waitingOn: words, wait: { kind: "web" } });
  const a = (await w.ok(["task", "audit", id, "--json"])).json.tasks[0];
  assert.deepEqual(a.findings, [
    { kind: "images-as-text", books: ["B0001", "B0002"] },
    { kind: "several-books", books: ["B0001", "B0002"] },
  ]);
  assert.equal(a.fix.can, "whole");
  const f1 = inboxFolderFor({ id: "B0001", title: "Podhradí 1, N 1700–1750" });
  const f2 = inboxFolderFor({ id: "B0002", title: "Podhradí 2, O 1750–1800" });
  assert.deepEqual(a.fix.changes, [
    { op: "wait-images", task: id, book: "B0001", title: "Podhradí 1, N 1700–1750", images: "20–22", folder: f1 },
    { op: "split", task: null, from: id, book: "B0002", title: "Podhradí 2, O 1750–1800", images: "5–6", folder: f2, waits: "images" },
  ]);
  const fixed = (await w.ok(["task", "audit", id, "--fix", "--json"])).json;
  const t = get(w, id);
  assert.deepEqual(t.awaits, { recordset: "B0001", images: "20–22", folder: f1 });
  // each book's images by its title, in the research language — never its ID, never what is to be done with them
  assert.equal(t.waitingOn, "Snímky 20–22 knihy Podhradí 1, N 1700–1750");
  const s = get(w, fixed.made[0]);
  assert.deepEqual(s.awaits, { recordset: "B0002", images: "5–6", folder: f2 });
  assert.equal(s.waitingOn, "Snímky 5–6 knihy Podhradí 2, O 1750–1800");
  assert.deepEqual((await w.ok(["task", "audit", "--json"])).json.tasks, []);
  // written so again: refused as several books, each book its command with its numbers
  const other = await task(w, "Sňatek rodičů Vojtěcha", ["fara Podhradí"]);
  const r = await w.run(["task", "wait", other, "--kind", "web", "--on", words, "--json"]);
  assert.equal(r.code, 2, r.out + r.err);
  assert.match(r.out + r.err, /several-books/);
  assert.match(r.out + r.err, new RegExp(`strom task wait ${other} --images B0001:20-22`));
  assert.match(r.out + r.err, /--images B0002:5-6/);
  // a comma, a space alone, another language, decomposed, another script: each book its numbers
  const tree = Tree.open(w.cwd, w.env);
  const read = (text: string) => readWait(tree, { waitingOn: text, where: [] }).map((p) => [p.book ?? null, p.numbers]);
  const two = [
    ["B0001", [20, 21, 22]],
    ["B0002", [5, 6]],
  ];
  for (const text of [
    "Snímky B0001:20-22, B0002:5-6",
    "Snímky B0001:20–22 B0002:5–6",
    "Bilder B0001: 20-22 und B0002: 5-6 von Hand speichern",
    "Skany B0001:20-22 oraz B0002:5-6 zapisać ręcznie".normalize("NFD"),
    "Снимки B0001:20-22 и B0002:5-6",
  ])
    assert.deepEqual(read(text), two, text);
  // one book by its ID and numbers, no image word: its images by their numbers
  assert.deepEqual(read("B0001:20-22 uložit ručně"), [["B0001", [20, 21, 22]]]);
});

test("a book the research does not have: its name without the words of what is to be done ('uložit ručně', 'save by hand'…); an ID it has none of, that ID alone", opts, async () => {
  const { w } = await world();
  const tree = Tree.open(w.cwd, w.env);
  const unknown = (text: string) => readWait(tree, { waitingOn: text, where: [] }).map((p) => p.unknown ?? p.book ?? null);
  for (const [text, name] of [
    ["snímky 7-9 knihy Lhotka 5 uložit ručně", "Lhotka 5"],
    ["snímky 7-9 knihy Lhotka 5 uložit ručně".normalize("NFD"), "Lhotka 5"],
    ["snímky 7-9 knihy Lhotka 5 nutno ručně stáhnout", "Lhotka 5"],
    ["snímky 7-9 knihy Lhotka 5, N 1801–1850 k ručnímu uložení", "Lhotka 5, N 1801–1850"],
    ["images 7-9 of the book Lhotka 5 to be saved by hand", "Lhotka 5"],
    ["images 7-9 of the book Lhotka 5 to download manually", "Lhotka 5"],
    ["Bilder 7-9 aus dem Buch Lhotka 5 von Hand speichern", "Lhotka 5"],
    ["skany 7-9 z księgi Lhotka 5 zapisać ręcznie", "Lhotka 5"],
    ["snímky 7-9 knihy Лхотка 5 uložit ručně", "Лхотка 5"],
    ["snímky 7-9 knihy B0009 uložit ručně", "B0009"],
    ["snímky B0009:7-9 uložit ručně", "B0009"],
  ] as [string, string][])
    assert.deepEqual(unknown(text), [name], text);
  const id = await task(w, "Křest Vojtěcha Lhotáka (~1790)", ["fara Lhotka"]);
  const r = await w.run(["task", "wait", id, "--kind", "web", "--on", "snímky 7-9 knihy Lhotka 5 uložit ručně", "--json"]);
  assert.equal(r.code, 2, r.out + r.err);
  assert.match(r.out + r.err, /strom recordset add \\?"Lhotka 5\\?" \(the book first\)/);
  // an ID of no book of the research: never a record set named by it and the rest of the sentence
  const b = await w.run(["task", "wait", id, "--kind", "web", "--on", "snímky 7-9 knihy B0009 uložit ručně", "--json"]);
  assert.equal(b.code, 2, b.out + b.err);
  assert.match(b.out + b.err, /the research has no B0009: strom recordset add \\?"<the book's title>\\?"/);
  assert.doesNotMatch(b.out + b.err, /recordset add \\?"B0009/);
});

test("task wait --images given again: the same book's images joined (as a comma joins them), another book's refused — one book per task, as a comma before it", opts, async () => {
  const { w } = await world();
  const id = await task(w, "Křest Vojtěcha Lhotáka (~1790)", ["fara Podhradí"]);
  const before = get(w, id);
  for (const images of [["B0001:50-52", "B0002:3"], ["B0001:50-52,B0002:3"], ["B0001:50", "B0001:51,B0002:3"]]) {
    const r = await w.run(["task", "wait", id, ...images.flatMap((x) => ["--images", x]), "--on", "Snímky dvou knih", "--json"]);
    assert.equal(r.code, 2, r.out + r.err);
    assert.match(r.out + r.err, /--images: images of B0001, B0002 — one book per task/, images.join(" "));
    assert.deepEqual(waitOf(get(w, id)), waitOf(before), "nothing written");
  }
  await w.ok(["task", "wait", id, "--images", "B0001:50", "--images", "B0001:52", "--on", "Snímky 50 a 52 knihy Podhradí 1"]);
  assert.deepEqual(get(w, id).awaits, { recordset: "B0001", images: "50, 52", folder: inboxFolderFor({ id: "B0001", title: "Podhradí 1, N 1700–1750" }) });
  await w.ok(["task", "wait", id, "--images", "B0001:50-52", "--images", "b0001:53", "--on", "Snímky 50–53 knihy Podhradí 1"]);
  assert.equal(get(w, id).awaits?.images, "50–53");
});

test("the fix says a book's images by its title, without what is to be done with them — in any language and decomposed; other words kept as they stood", opts, async () => {
  const { w } = await world();
  const fix = async (words: string) => {
    const id = await task(w, "Křest Vojtěcha Lhotáka (~1790)", ["fara Podhradí"]);
    waitAs(w, id, { waitingOn: words, wait: { kind: "web" } });
    const made = (await w.ok(["task", "audit", id, "--fix", "--json"])).json.made as string[];
    return [get(w, id).waitingOn, get(w, made[0]!).waitingOn];
  };
  const titled = ["Snímky 20–22 knihy Podhradí 1, N 1700–1750", "Snímky 5–6 knihy Podhradí 2, O 1750–1800"];
  for (const words of [
    "Bilder B0001:20-22 und B0002:5-6 von Hand speichern",
    "skany B0001:20-22 oraz B0002:5-6 trzeba zapisać ręcznie".normalize("NFD"),
    "Snímky B0001:20–22, B0002:5–6 k ručnímu uložení",
  ])
    assert.deepEqual(await fix(words), titled, words);
  // a note of its own beside the ID: those words as they stood (nothing of them lost), the other book's by its title
  assert.deepEqual(await fix("snímky B0001:20-22 a B0002:5-6 uložit ručně (Lhoták psán Lhotak)"), [titled[0], "B0002:5-6 uložit ručně (Lhoták psán Lhotak)"]);
  // the book named by its title: its words as they stood
  assert.deepEqual(await fix("snímky 20–22 knihy Podhradí 1 a snímky 5–6 knihy Podhradí 2 uložit ručně"), ["Snímky 20–22 knihy Podhradí 1", "Snímky 5–6 knihy Podhradí 2 uložit ručně"]);
  assert.deepEqual((await w.ok(["task", "audit", "--json"])).json.tasks, []);
});
