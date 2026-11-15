// Images saved one at a time through the agent's browser (strom media save) at archives only a person's browser goes
// to — two synthetic ones of the same property, no connector: the book taken from what the task waits for or from the
// archive of the page given, never asked when only one fits; strom media add --inbox --waiting says first what this
// session's task waits for (the others in one line beside it), says "nothing came" where nothing did — a folder not
// there, a download gone while looked at — and tidies strom's own files of images registered already from the
// downloads folder, never a file strom did not name. No request leaves this computer.

import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import https from "node:https";
import http from "node:http";
import { World, hasGit, readJsonFile } from "../helpers.ts";
import { SETTLE_MS } from "../../src/core/inboxwait.ts";
import { waitFileBase } from "../../src/core/browser.ts";
import { grantWay } from "../../src/core/terms.ts";

const opts = { skip: !hasGit };
const fixtures = path.join(import.meta.dirname, "..", "fixtures", "images");
const CLAUDE = { CLAUDECODE: "1" };

const out: string[] = [];
const keep = { request: https.request, get: https.get, hrequest: http.request, hget: http.get, fetch: globalThis.fetch };
const refuse = (u: unknown) => {
  out.push(String(u));
  throw new Error("no network in this test");
};
before(() => {
  (https as { request: unknown }).request = refuse;
  (https as { get: unknown }).get = refuse;
  (http as { request: unknown }).request = refuse;
  (http as { get: unknown }).get = refuse;
  globalThis.fetch = (u) => Promise.reject(refuse(u));
});
after(() => {
  Object.assign(https, { request: keep.request, get: keep.get });
  Object.assign(http, { request: keep.hrequest, get: keep.hget });
  globalThis.fetch = keep.fetch;
});

// two archives strom's list (a test's own) keeps as only a person's browser's; the page of one scan in each viewer
const LHOTA = { host: "www.archiv-lhota.example", page: (book: number, n: number) => `https://www.archiv-lhota.example/kniha/${book}?snimek=${n}` };
const PODHRADI = { host: "matriky.podhradi.example", page: (book: number, n: number) => `https://matriky.podhradi.example/detail/${book}#${n}` };

/** The name strom media save gives an image of a task of the world's research (its mark first). */
function named(w: World, task: string, n: number): string {
  return waitFileBase((JSON.parse(fs.readFileSync(path.join(w.cwd, "strom.json"), "utf8")) as { id: string }).id, task, n);
}

/** A file the browser finished saving a while ago. */
function settled(file: string, from = "grey.jpg"): void {
  fs.copyFileSync(path.join(fixtures, from), file);
  const past = new Date(Date.now() - 2 * SETTLE_MS);
  fs.utimesSync(file, past, past);
}

async function setup(w: World): Promise<{ downloads: string; shared: string; records: string }> {
  await w.withTree("Lhotákovi");
  const file = path.join(w.dir, "archives-test.json");
  fs.writeFileSync(file, JSON.stringify({ archives: [LHOTA, PODHRADI].map((a) => ({ host: a.host, name: `Archiv ${a.host}`, level: "restricted", browserOnly: true, checked: "2026-11-01" })) }));
  w.env.STROM_ARCHIVES_FILE = file;
  assert.ok(grantWay(w.env, [LHOTA.host, PODHRADI.host], "browser", { by: "terminal" }));
  await w.ok(["research", "new", "X", "--new-person", "Jan /Lhoták/"]);
  const downloads = path.join(w.dir, "Stažené soubory");
  fs.mkdirSync(downloads);
  await w.ok(["config", "set", "browser.downloads", downloads]);
  await w.ok(["recordset", "add", "Lhota N 1784–1820", "--url", LHOTA.page(11, 1)]); // B1
  await w.ok(["recordset", "add", "Podhradí N 1790–1830", "--url", PODHRADI.page(22, 1)]); // B2
  await w.ok(["recordset", "add", "Lhota O 1784–1850", "--url", LHOTA.page(33, 1)]); // B3
  return { downloads, shared: path.join(w.home, "shared"), records: path.join(w.cwd, ".strom", "browser-saves.json") };
}

test("media save without --recordset: the book of the archive the page is on among the task's books; several there — named, never guessed (two archives)", opts, async () => {
  const w = new World();
  try {
    await setup(w);
    // a task in books of both archives: the page says which
    await w.ok(["task", "add", "Křest Jana", "--level", "link", "--where", "B1", "--where", "B2", "--why", "a", "--done-when", "b"]); // T1
    const two = await w.ok(["media", "save", "T1", "--image", "3", "--at", PODHRADI.page(22, 3), "--json"], { env: CLAUDE });
    assert.equal(two.json.recordset, "B0002");
    // it waits for B2 now: the next image of it needs no book named either
    assert.equal((await w.ok(["media", "save", "T1", "--image", "4", "--at", PODHRADI.page(22, 4), "--json"], { env: CLAUDE })).json.recordset, "B0002");
    // the task woke meanwhile (its wait gone): its books and the archive of the page still say which
    await w.ok(["task", "wake", "T1"]);
    assert.equal((await w.ok(["media", "save", "T1", "--image", "5", "--at", LHOTA.page(11, 5), "--json"], { env: CLAUDE })).json.recordset, "B0001");

    // a task in two books of one archive: which one is the agent's to say — both named
    await w.ok(["task", "add", "Sňatek Jana", "--level", "link", "--where", "B1", "--where", "B3", "--why", "a", "--done-when", "b"]); // T2
    const which = await w.run(["media", "save", "T2", "--image", "7", "--at", LHOTA.page(33, 7)], { env: CLAUDE });
    assert.equal(which.code, 2, which.out + which.err);
    assert.match(which.err, /which book image 7 is of: T0002 works in B0001 Lhota N 1784–1820, B0003 Lhota O 1784–1850 — --recordset names it/);
    assert.match(which.err, /strom media save T0002 --image 7 --recordset B0001\|B0003 --at/);
    assert.equal((await w.ok(["task", "show", "T2", "--json"])).json.task.state, "open", "nothing written");
    assert.equal((await w.ok(["media", "save", "T2", "--image", "7", "--recordset", "B3", "--at", LHOTA.page(33, 7), "--json"], { env: CLAUDE })).json.recordset, "B0003");
    assert.deepEqual(out, [], "nothing left this computer");
  } finally {
    w.cleanup();
  }
});

test("media add --inbox --waiting: this session's task first, the others in one line; nothing came — said so, its folder not there or a download gone while looked at (two archives)", opts, async () => {
  const w = new World();
  try {
    const { downloads, shared, records } = await setup(w);
    await w.ok(["task", "add", "Křest Jana", "--level", "link", "--where", "B2", "--why", "a", "--done-when", "b"]); // T1
    await w.ok(["task", "add", "Sňatek Jana", "--level", "link", "--where", "B3", "--why", "a", "--done-when", "b"]); // T2
    // T2's image given long ago and never come: held back by the browser — another task's, beside it
    await w.ok(["media", "save", "T2", "--image", "4", "--at", LHOTA.page(33, 4)], { env: CLAUDE });
    const aged = readJsonFile(records) as unknown as { at: number }[];
    fs.writeFileSync(records, JSON.stringify(aged.map((r) => ({ ...r, at: r.at - 60_000 }))));
    // this session's task: one image of the other archive, its script given just now
    await w.ok(["session", "start", "T1"]);
    await w.ok(["media", "save", "T1", "--image", "9", "--at", PODHRADI.page(22, 9)], { env: CLAUDE });
    // its folder gone meanwhile (taken by another look, removed by hand): nothing came, never an error of a path
    const folder = fs.readdirSync(path.join(shared, "inbox")).find((f) => f.startsWith("B0002"))!;
    fs.rmSync(path.join(shared, "inbox", folder), { recursive: true, force: true });
    const r = await w.ok(["media", "add", "--inbox", "--waiting"]);
    const said = r.out.split("\n").filter(Boolean);
    assert.match(said[0]!, /^T0001 \(this session's task\) still waits for image 9 of B0002: nothing of it came yet — not in the downloads folder, not in its folder .*B0002[^\n]* \(the script of 9 given at \d\d:\d\d:\d\d: the browser saves it within seconds — this command once more in a moment says whether it came\)\. Never look into the downloads folder yourself\.$/, r.out);
    assert.match(r.out, /\nother tasks wait as well \(not this session's\): T0002 images 4 of B0003 \(the browser held back 4\)$/m, r.out);
    assert.doesNotMatch(r.out, /⚠ image 4/, "another task's held image: beside, never first");
    assert.doesNotMatch(r.out, /no task waits/);
    const j = await w.ok(["media", "add", "--inbox", "--waiting", "--json"]);
    assert.deepEqual(j.json.waits, [{ task: "T0001", recordset: "B0002", missing: [9], current: true }, { task: "T0002", recordset: "B0003", missing: [4] }]);

    // a download gone between the folder read and its look (the browser renaming it): nothing came, no error
    if (process.platform !== "win32") {
      fs.symlinkSync(path.join(w.dir, "nowhere.jpg"), path.join(downloads, `${named(w, "T0001", 9)}.jpg`));
      const gone = await w.run(["media", "add", "--inbox", "--waiting"]);
      assert.equal(gone.code, 0, gone.out + gone.err);
      assert.doesNotMatch(gone.out + gone.err, /ENOENT/);
      assert.match(gone.out, /T0001 \(this session's task\) still waits for image 9 of B0002: nothing of it came yet/);
      fs.rmSync(path.join(downloads, `${named(w, "T0001", 9)}.jpg`));
    }

    // it came: said where it is now, the wait over
    settled(path.join(downloads, `${named(w, "T0001", 9)}.jpg`));
    const came = await w.ok(["media", "add", "--inbox", "--waiting"]);
    assert.match(came.out, /^B0002[^\n]*\/: images 9 of B0002 registered — back in the queue: T0001$/m, came.out);
    assert.doesNotMatch(came.out, /T0001 \(this session's task\) still waits/);
    assert.match(came.out, /other tasks wait as well \(not this session's\): T0002/);
    assert.deepEqual(fs.readdirSync(downloads), []);

    // no task waits any more: said so
    await w.ok(["task", "park", "T2", "--reason", "jinde"]);
    assert.match((await w.ok(["media", "add", "--inbox", "--waiting"])).out, /^no task waits for images saved into the inbox$/m);
    assert.deepEqual(out, [], "nothing left this computer");
  } finally {
    w.cleanup();
  }
});

test("strom's own files of images registered already never stay in the downloads folder — a copy saved late or twice tidied; a file strom did not name, or of an image not registered, left alone (two archives)", opts, async () => {
  const w = new World();
  try {
    const { downloads } = await setup(w);
    await w.ok(["task", "add", "Křest Jana", "--level", "link", "--where", "B1", "--why", "a", "--done-when", "b"]); // T1
    await w.ok(["task", "add", "Sňatek Jana", "--level", "link", "--where", "B2", "--why", "a", "--done-when", "b"]); // T2
    for (const [t, page] of [["T1", LHOTA.page(11, 5)], ["T2", PODHRADI.page(22, 6)]] as const) {
      await w.ok(["media", "save", t, "--image", t === "T1" ? "5" : "6", "--at", page], { env: CLAUDE });
    }
    settled(path.join(downloads, `${named(w, "T0001", 5)}.jpg`));
    settled(path.join(downloads, `${named(w, "T0002", 6)}.jpg`), "base420.jpg");
    const took = await w.ok(["media", "add", "--inbox", "--waiting", "--json"]);
    assert.deepEqual(took.json.woken.sort(), ["T0001", "T0002"], JSON.stringify(took.json));
    // the browser saved them once more after (the script run again): strom's own names, images registered already
    settled(path.join(downloads, `${named(w, "T0001", 5)}.jpg`));
    settled(path.join(downloads, `${named(w, "T0001", 5)} (1).jpg`), "base444.jpg");
    settled(path.join(downloads, `${named(w, "T0002", 6)} (2).jpg`), "base420.jpg");
    // what strom did not name, or named for an image not registered, or another research's task: never touched
    // (a name with no research's mark that no record of this research gives: another research's, from before the mark)
    const theirs = [`${named(w, "T0001", 5)}-kopie.jpg`, "Lhota-5.jpg", `${named(w, "T0001", 99)}.jpg`, `${named(w, "T0003", 5)}.jpg`, "strom-T0001-0005.jpg", "strom-T0002-0006 (1).jpg"];
    for (const f of theirs) settled(path.join(downloads, f));
    const r = await w.ok(["media", "add", "--inbox", "--waiting", "--json"]);
    assert.deepEqual(r.json.tidied.sort(), [`${named(w, "T0001", 5)} (1).jpg`, `${named(w, "T0001", 5)}.jpg`, `${named(w, "T0002", 6)} (2).jpg`]);
    assert.deepEqual(fs.readdirSync(downloads).sort(), [...theirs].sort());
    assert.match((await w.ok(["media", "add", "--inbox", "--waiting"])).out, /^no task waits for images saved into the inbox$/m);
    // a copy still being written: the next look
    fs.copyFileSync(path.join(fixtures, "grey.jpg"), path.join(downloads, `${named(w, "T0002", 6)}.jpg`));
    assert.deepEqual((await w.ok(["media", "add", "--inbox", "--waiting", "--json"])).json.tidied, []);
    assert.ok(fs.existsSync(path.join(downloads, `${named(w, "T0002", 6)}.jpg`)));
    // the images as they were: one each, nothing registered of the copies
    const media = (await w.ok(["media", "list", "--json"])).json.media as { recordset: string; image: number }[];
    assert.deepEqual(media.map((m) => `${m.recordset}:${m.image}`).sort(), ["B0001:5", "B0002:6"]);
    assert.deepEqual(out, [], "nothing left this computer");
  } finally {
    w.cleanup();
  }
});

// The downloads folder is every research's of this computer: two researches, each with a task T0001 waiting for image
// 5 of a book, each takes only the file its own script saved (the research's mark in its name). A save given before
// the mark (its record names strom-T0001-0005) is still taken by the research whose record it is, never by another.
test("two researches, the same task and image: each takes only its own file from the downloads folder; a name from before the research's mark taken by its record alone (two archives)", opts, async () => {
  const w = new World();
  try {
    const { downloads, records } = await setup(w);
    const first = w.cwd;
    await w.ok(["task", "add", "Křest Jana", "--level", "link", "--where", "B1", "--why", "a", "--done-when", "b"]); // T1 of the first
    // the second research of this computer: the same task number, the same image, a book of the other archive
    await w.ok(["init", "Lhotovi"]);
    const second = w.treeDir("Lhotovi");
    const at2 = { cwd: second };
    await w.ok(["research", "new", "Y", "--new-person", "Anna /Lhotová/"], at2);
    await w.ok(["recordset", "add", "Podhradí O 1790–1830", "--url", PODHRADI.page(44, 1)], at2); // B1 of the second
    await w.ok(["task", "add", "Sňatek Anny", "--level", "link", "--where", "B1", "--why", "a", "--done-when", "b"], at2); // T1 of the second
    const one = await w.ok(["media", "save", "T1", "--image", "5", "--at", LHOTA.page(11, 5), "--json"], { env: CLAUDE });
    const two = await w.ok(["media", "save", "T1", "--image", "5", "--at", PODHRADI.page(44, 5), "--json"], { env: CLAUDE, cwd: second });
    assert.notEqual(one.json.file, two.json.file);
    assert.equal(one.json.file, named(w, "T0001", 5));
    // only the second's file came: the first takes nothing of it, the second takes it
    settled(path.join(downloads, `${two.json.file}.jpg`), "base420.jpg");
    const none = await w.ok(["media", "add", "--inbox", "--waiting", "--json"]);
    assert.deepEqual(none.json.woken, []);
    assert.ok(fs.existsSync(path.join(downloads, `${two.json.file}.jpg`)), "another research's file left where it is");
    assert.deepEqual((await w.ok(["media", "add", "--inbox", "--waiting", "--json"], { cwd: second })).json.woken, ["T0001"]);
    // the first's own comes: the first takes it
    settled(path.join(downloads, `${one.json.file}.jpg`));
    assert.deepEqual((await w.ok(["media", "add", "--inbox", "--waiting", "--json"])).json.woken, ["T0001"]);
    for (const [cwd, book] of [[first, "B0001:5"], [second, "B0001:5"]] as const) {
      const media = (await w.ok(["media", "list", "--json"], { cwd })).json.media as { recordset: string; image: number; sha256?: string }[];
      assert.deepEqual(media.map((m) => `${m.recordset}:${m.image}`), [book]);
    }
    assert.deepEqual(fs.readdirSync(downloads), []);

    // a save given before the research's mark: its record names strom-T0001-0006 — taken by its own research only
    await w.ok(["media", "save", "T1", "--image", "6", "--at", LHOTA.page(11, 6)], { env: CLAUDE });
    const was = readJsonFile(records) as unknown as { task: string; n: number; file: string }[];
    fs.writeFileSync(records, JSON.stringify(was.map((r) => (r.n === 6 ? { ...r, file: "strom-T0001-0006" } : r))));
    await w.ok(["media", "save", "T1", "--image", "6", "--at", PODHRADI.page(44, 6)], { env: CLAUDE, cwd: second });
    settled(path.join(downloads, "strom-T0001-0006.jpg"), "base444.jpg");
    // the second's record names its marked file: the old name is not its own
    assert.deepEqual((await w.ok(["media", "add", "--inbox", "--waiting", "--json"], { cwd: second })).json.woken, []);
    assert.ok(fs.existsSync(path.join(downloads, "strom-T0001-0006.jpg")));
    assert.deepEqual((await w.ok(["media", "add", "--inbox", "--waiting", "--json"])).json.woken, ["T0001"]);
    assert.deepEqual(fs.readdirSync(downloads), []);
    // a copy of it the browser saved late: strom's own by the record, tidied
    settled(path.join(downloads, "strom-T0001-0006 (1).jpg"));
    assert.deepEqual((await w.ok(["media", "add", "--inbox", "--waiting", "--json"])).json.tidied, ["strom-T0001-0006 (1).jpg"]);
    // the second's still waits for its image 6: nothing of the first's taken for it
    assert.equal((await w.ok(["task", "show", "T1", "--json"], { cwd: second })).json.task.state, "waiting");
    assert.deepEqual(out, [], "nothing left this computer");
  } finally {
    w.cleanup();
  }
});
