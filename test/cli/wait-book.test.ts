// The book a waiting task waits under (spec 105, the Strom app's groups by book): the book it is to be searched in, not
// the book where the trail was found. A — images by their numbers: their book; B — the book the agent gave it (strom task
// wait|edit --book: wait.book); C — the one book its words name beyond its where (read, nothing written); D — a site the
// person looks at or checks whose where names one book beside a place in words: no book, and no folder of the inbox;
// E — the one book its where names; F — the queue (not waiting): its where, whatever a wait said. bookOfTask (the app)
// and inboxWaitOf (the folder the person saves into) follow the same rule. Synthetic data only.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { World, hasGit } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import { bookOfTask, booksOfTask, waitTarget } from "../../src/core/books.ts";
import { inboxWaitOf } from "../../src/core/inboxwait.ts";
import { inboxFolderFor } from "../../src/core/media.ts";
import type { RecordSet, Task } from "../../src/core/model.ts";

const opts = { skip: !hasGit, timeout: 120_000 };

/** B0001 the book of the trail, B0002 the book to be searched (added later), B0003 another; tasks T0001–T0004. */
async function world(): Promise<World> {
  const w = new World();
  const bin = path.join(w.dir, "bin");
  fs.mkdirSync(bin);
  const git = spawnSync(process.platform === "win32" ? "where" : "which", ["git"], { encoding: "utf8" }).stdout.split(/\r?\n/u)[0]!.trim();
  if (git && process.platform !== "win32") {
    fs.symlinkSync(git, path.join(bin, "git"));
    fs.writeFileSync(path.join(bin, "claude"), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
    w.env.PATH = bin;
  }
  await w.withTree("Lhotákovi");
  await w.ok(["research", "new", "Předci Vojtěcha", "--new-person", "Vojtěch /Lhoták/", "--sex", "M", "--born", "1890"]);
  await w.ok(["recordset", "add", "Lhota 3, N 1784–1820", "--access", "online-free", "--url", "https://archiv-lhota.example/kniha/3"]); // B0001
  await w.ok(["recordset", "add", "Lhotka 1, O 1800–1830", "--access", "online-free", "--url", "https://archiv-lhota.example/kniha/11"]); // B0002
  await w.ok(["recordset", "add", "Матрика Lhotíčky Z 1800–1850".normalize("NFD"), "--access", "online-free", "--url", "https://archiv-lhota.example/kniha/12"]); // B0003
  for (const n of [1, 2, 3, 4])
    await w.ok(["task", "add", `Sňatek ${n} Lhoták`, "--level", "link", "--where", "B1", "--where", "fara, pod kterou Lhotka patřila (zjistit)", "--why", "rodiče", "--done-when", "nalezeno", "--about", "P1", "--anyway"]);
  return w;
}

test("the book of a waiting task: the book to be searched (--book, the one its words name), none when still to be found, else its where's; the folder of the inbox the same; the queue by its where", opts, async () => {
  const w = await world();
  try {
    const tree = () => Tree.open(w.cwd, w.env);
    const task = (id: string) => tree().get<Task>(id)!;
    const t1 = task("T0001");
    // a task as it might stand: the same where (B0001 and a place in words), waiting
    const as = (x: Partial<Task>): Task => ({ ...t1, state: "waiting", waitingOn: "Záznam k dohledání.", ...x });
    const folder = (id: string) => inboxFolderFor(tree().get<RecordSet>(id)!);

    // A: images by their numbers — their book, whatever else
    const a = as({ awaits: { recordset: "B0003", images: "4", folder: folder("B0003") }, waitingOn: "Snímek 4 knihy B0002.", wait: { book: "B0002" } });
    assert.equal(bookOfTask(tree(), a), "B0003");
    assert.equal(inboxWaitOf(tree(), a)?.recordset, "B0003");

    // B: the book given with --book (a site the person looks at): the task waits under it, its folder brings it back
    const b = await w.ok(["task", "wait", "T1", "--kind", "web", "--book", "B2", "--on", "Matrika oddaných fary, pod kterou Lhotka patřila, k vyhledání na webu archivu; snímky uložit do složky knihy."]);
    assert.match(b.out, new RegExp(`images of B0002 the user saves into .*${folder("B0002").normalize("NFC").replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}`, "u"));
    assert.deepEqual(task("T0001").wait, { kind: "web", book: "B0002" });
    assert.deepEqual(task("T0001").where, t1.where, "where as it was: nothing written there");
    assert.equal(bookOfTask(tree(), task("T0001")), "B0002");
    assert.deepEqual([inboxWaitOf(tree(), task("T0001"))?.recordset, inboxWaitOf(tree(), task("T0001"))?.folder], ["B0002", folder("B0002")]);
    assert.deepEqual(booksOfTask(tree(), task("T0001")).map((x) => x.id).sort(), ["B0001", "B0002"], "the task needs the book it is to be searched in too");
    assert.match((await w.ok(["task", "show", "T1"])).out, /book {3}B0002 — the book to be searched/u);
    // given later to a task set waiting before (task edit), and a check of a site by the words alone
    await w.ok(["task", "wait", "T2", "--on", "Kontrola na webu archivu, zda je kniha oddaných Lhotky dostupná."]);
    await w.ok(["task", "edit", "T2", "--book", "B0002"]);
    assert.equal(bookOfTask(tree(), task("T0002")), "B0002");
    // refused: with images of another book; a task that does not wait; a book that is not there
    await w.ok(["task", "wait", "T3", "--images", "B3:4", "--book", "B3", "--on", "Snímek 4 k uložení ručně."]);
    assert.equal(task("T0003").wait?.book, undefined, "--book repeating the images' book: --images says it");
    const bad = await w.run(["task", "wait", "T3", "--images", "B3:4", "--book", "B2", "--on", "Snímek 4 k uložení ručně."]);
    assert.notEqual(bad.code, 0);
    assert.match(bad.err + bad.out, /--book with --images: the images are of B0003/u);
    const open = await w.run(["task", "edit", "T4", "--book", "B2"]);
    assert.notEqual(open.code, 0);
    assert.match(open.err + open.out, /T0004 does not wait/u);
    const none = await w.run(["task", "wait", "T4", "--kind", "web", "--book", "B9", "--on", "Kniha k vyhledání."]);
    assert.notEqual(none.code, 0);
    assert.equal(task("T0004").state, "open");
    // set waiting again: what was said of the earlier wait goes, the book with it
    await w.ok(["task", "wait", "T2", "--kind", "letter", "--on", "Odpověď fary na dotaz."]);
    assert.equal(task("T0002").wait?.book, undefined);

    // C: no book given, its words name one book beyond its where — that one (any script, decomposed; nothing written)
    const c = as({ wait: { kind: "web" }, waitingOn: "Matriku oddaných fary (B0002) najít na webu archivu a snímky uložit do složky knihy." });
    assert.equal(bookOfTask(tree(), c), "B0002");
    assert.equal(inboxWaitOf(tree(), c)?.folder, folder("B0002"));
    assert.equal(bookOfTask(tree(), as({ wait: { kind: "letter" }, waitingOn: "Ответ архива: книга B0003 — снимки.".normalize("NFD") })), "B0003");
    // the book of its where named again, or an ID inside a word: not another book
    assert.equal(bookOfTask(tree(), as({ wait: { kind: "letter" }, waitingOn: "Odpověď k přípisku v B0001.", where: ["B0001"] })), "B0001");
    assert.equal(bookOfTask(tree(), as({ wait: { kind: "letter" }, waitingOn: "Odpověď ke spisu XB0002 a č. B00021.", where: ["B0001"] })), "B0001");
    // two books named: not C — D for a site, E for a letter
    assert.equal(waitTarget(tree(), as({ wait: { kind: "web" }, waitingOn: "Najít v B0002 nebo B0003." })), null);
    assert.equal(bookOfTask(tree(), as({ wait: { kind: "letter" }, waitingOn: "Najít v B0002 nebo B0003.", where: ["B0001"] })), "B0001");

    // D: a site looked at or checked, its where one book beside a place in words, nothing of B or C — no book, no folder
    const d = as({ wait: { kind: "web" } });
    assert.equal(bookOfTask(tree(), d), undefined);
    assert.equal(inboxWaitOf(tree(), d), undefined);
    assert.equal(bookOfTask(tree(), as({ awaitsCheck: { url: "https://archiv-lhota.example/hledani", ask: "Zda je tam kniha oddaných." } })), undefined);
    // an ID beside the book is no place in words (an archive R…): its book
    assert.equal(bookOfTask(tree(), as({ wait: { kind: "web" }, where: ["B0001", "R0001"] })), "B0001");

    // E: its where's one book — a letter beside a place in words, a site with the book alone
    assert.equal(bookOfTask(tree(), as({ wait: { kind: "letter" } })), "B0001");
    const e = as({ wait: { kind: "web" }, where: ["B0001"] });
    assert.equal(bookOfTask(tree(), e), "B0001");
    assert.equal(inboxWaitOf(tree(), e)?.folder, folder("B0001"));

    // F: the queue and what is put aside — the book its where names, whatever a wait said
    for (const state of ["open", "parked", "doing"] as const) {
      const f = { ...t1, state, waitingOn: "Najít v B0002.", wait: { kind: "web" as const, book: "B0002" } };
      assert.equal(bookOfTask(tree(), f), "B0001", state);
      assert.equal(waitTarget(tree(), f), undefined, state);
    }

    // set waiting so (D): what strom says the agent can do once the book is a record set
    const said = await w.ok(["task", "wait", "T4", "--kind", "web", "--on", "Matrika oddaných fary, pod kterou Lhotka patřila, k vyhledání na webu archivu."]);
    assert.match(said.out, /strom task edit T0004 --book B… — the task then waits under it/u);
    assert.doesNotMatch(said.out, /images of B0001 the user saves into/u);

    // the data as written: nothing of C or D written into a task
    assert.deepEqual(task("T0004").wait, { kind: "web" });
    assert.deepEqual(task("T0004").where, t1.where);
  } finally {
    w.cleanup();
  }
});
