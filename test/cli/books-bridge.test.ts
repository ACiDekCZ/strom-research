// The books most tasks need, for the Strom app and the person (spec 105 U3b): the bridge's /status books (feature books,
// no gate of the app's version; none in an archive), the book of each task in What waits and the queue, POST /books
// (the research's books.minTasks and queue.sameBook, each a strom config command); the settings and their checks;
// queue.sameBook (the book the last session read first, at most SAME_BOOK_MAX sessions in a row); the folder of a book
// no task waits on taken by the numbers in its names (K1.4, a portal's .jp2 counted back: MZA × 10); wholeBook of
// strom's list of archives — what may be downloaded of a book by hand, quoted. Synthetic data only; no request leaves
// this computer.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { spawnSync } from "node:child_process";
import { World, hasGit, until } from "../helpers.ts";
import { Tree, now } from "../../src/core/tree.ts";
import { bookRows, downloadOf, offeredBooks } from "../../src/core/books.ts";
import { knownTerms, wholeBookFor } from "../../src/core/terms.ts";
import { imageFileTimesOf, type KnownTerms } from "../../src/core/knownterms.ts";
import { bookFolders, numberBookFiles, SETTLE_MS } from "../../src/core/inboxwait.ts";
import { inboxFolderFor } from "../../src/core/media.ts";
import { rankTasks, SAME_BOOK_MAX } from "../../src/core/queue.ts";
import { parseLink, linkText } from "../../src/core/links.ts";
import type { Media, RecordSet, Session, Task } from "../../src/core/model.ts";

const opts = { skip: !hasGit || process.platform === "win32", timeout: 240_000 };
const APP = "https://beta.stromapp.info";
const fixtures = path.join(import.meta.dirname, "..", "fixtures", "images");

type Answer = { status: number; body: any; headers: http.IncomingHttpHeaders };
function request(url: string, method = "GET", body?: unknown): Promise<Answer> {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? undefined : Buffer.from(typeof body === "string" ? body : JSON.stringify(body), "utf8");
    const req = http.request(url, { agent: false, method, headers: { Origin: APP, ...(data ? { "Content-Type": "text/plain;charset=UTF-8", "Content-Length": String(data.length) } : {}) } }, (res) => {
      let text = "";
      res.setEncoding("utf8");
      res.on("data", (d) => (text += d));
      res.on("end", () => {
        let parsed: any = text;
        try {
          parsed = JSON.parse(text);
        } catch {
          // not JSON
        }
        resolve({ status: res.statusCode ?? 0, body: parsed, headers: res.headers });
      });
    });
    req.on("error", reject);
    req.end(data);
  });
}

/** What an archive of the test's own list says of a whole book (a made-up reply, word for word). */
const LHOTA_SAYS = "Celou knihu lze stáhnout pro vlastní badatelskou potřebu.";

/**
 * B1 Lhota 3 (archiv-lhota.example: its reply lets the whole book be downloaded) — 5 open tasks, nothing waits;
 * B2 a title in Cyrillic typed decomposed, at mza.cz (no whole book: the images its tasks need) — 5 tasks, one waiting
 * for image 3; B3 Lhota 4 at digi.ceskearchivy.cz (selected images only) — 2 tasks; B4 Lhota 5 at mza.cz — 1 task.
 */
async function world(): Promise<World> {
  const w = new World();
  const bin = path.join(w.dir, "bin");
  fs.mkdirSync(bin);
  const git = spawnSync("which", ["git"], { encoding: "utf8" }).stdout.trim();
  if (git) fs.symlinkSync(git, path.join(bin, "git"));
  fs.writeFileSync(path.join(bin, "claude"), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
  w.env.PATH = bin;
  const list = path.join(w.dir, "archives-test.json");
  fs.writeFileSync(
    list,
    JSON.stringify({
      archives: [
        { host: "archiv-lhota.example", name: "Archiv v Lhotě", level: "restricted", checked: "2026-11-01", wholeBook: { how: "allowed", says: LHOTA_SAYS, from: "reply" } },
        // a value strom does not know: as if none were given
        { host: "matriky.lhotka.example", name: "Matriky Lhotka", level: "restricted", checked: "2026-11-01", wholeBook: { how: "everything", says: "vše", from: "terms" } },
      ],
    }),
  );
  w.env.STROM_ARCHIVES_FILE = list;
  await w.withTree("Lhotákovi");
  await w.ok(["research", "new", "Předci Vojtěcha", "--new-person", "Vojtěch /Lhoták/", "--sex", "M", "--born", "1890"]);
  await w.ok(["recordset", "add", "Lhota 3, N 1784–1820", "--access", "online-free", "--url", "https://archiv-lhota.example/kniha/3", "--images", "20"]); // B0001
  await w.ok(["recordset", "add", "Матрика Lhotíčky O 1800–1850".normalize("NFD"), "--access", "online-free", "--url", "https://www.mza.cz/actapublica/matrika/detail/101", "--images", "10"]); // B0002
  await w.ok(["recordset", "add", "Lhota 4, Z 1790–1830", "--access", "online-free", "--url", "https://digi.ceskearchivy.cz/kniha/4"]); // B0003
  await w.ok(["recordset", "add", "Lhota 5, N 1830–1840", "--access", "online-free", "--url", "https://www.mza.cz/actapublica/matrika/detail/105", "--images", "8"]); // B0004
  await w.ok(["recordset", "add", "Lhotka 1, N 1800–1810", "--access", "online-free", "--url", "https://matriky.lhotka.example/kniha/1"]); // B0005
  let n = 0;
  const add = async (where: string) => {
    await w.ok(["task", "add", `Zápis ${++n} Lhoták`, "--level", "link", "--where", where, "--why", "rodiče", "--done-when", "nalezeno", "--about", "P1", "--anyway"]);
    return `T${n}`;
  };
  for (let i = 0; i < 5; i++) await add("B1"); // T1–T5
  for (let i = 0; i < 4; i++) await add("B2"); // T6–T9
  await w.ok(["task", "wait", await add("B2"), "--images", "B0002:3", "--on", "Snímek 3 k uložení ručně."]); // T10
  for (let i = 0; i < 2; i++) await add("B3"); // T11–T12
  await add("B4"); // T13
  await add("B5"); // T14
  return w;
}

/** A file of the person's, written `ago` ms ago (settled). */
function saved(file: string, from = "grey.jpg", ago = 2 * SETTLE_MS): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.copyFileSync(path.join(fixtures, from), file);
  const at = new Date(Date.now() - ago);
  fs.utimesSync(file, at, at);
}

test("wholeBook in strom's list of archives: each quoted, of a known kind; the most specific host, the strictest of one host; the test's own list for its hosts", () => {
  const env = { ...process.env, STROM_ARCHIVES_FILE: "" } as NodeJS.ProcessEnv;
  const shipped = knownTerms(env).filter((k: KnownTerms) => k.wholeBook);
  assert.ok(shipped.length >= 10, `${shipped.length}`);
  for (const k of shipped) {
    const wb = k.wholeBook!;
    assert.ok(["offered", "allowed", "selected", "never"].includes(wb.how), k.host);
    assert.ok(wb.says.trim().length > 20, k.host);
    assert.equal(wb.says, wb.says.normalize("NFC"), k.host);
    assert.ok(["terms", "termsPage", "reply"].includes(wb.from), k.host);
    if (wb.from === "terms") assert.ok(k.terms, `${k.host}: quoted from terms it names`);
    if (wb.from === "termsPage") assert.ok(k.termsPage, `${k.host}: quoted from the terms page it names`);
  }
  assert.equal(wholeBookFor(env, "ebadatelna.soapraha.cz")?.how, "offered");
  assert.equal(wholeBookFor(env, "digi.ceskearchivy.cz")?.how, "selected");
  assert.match(wholeBookFor(env, "digi.ceskearchivy.cz")!.says, /nesmí takto exportovat celou knihu/u);
  // a site below a host of the list: the entry of that host
  assert.deepEqual([wholeBookFor(env, "www.familysearch.org")?.how, wholeBookFor(env, "www.familysearch.org")?.host], ["never", "familysearch.org"]);
  // MZA: no whole book, nothing quoted of it — only the images the tasks need; its .jp2 names the image × 10
  assert.equal(wholeBookFor(env, "www.mza.cz"), undefined);
  assert.deepEqual([imageFileTimesOf("www.mza.cz"), imageFileTimesOf("mza.cz"), imageFileTimesOf("archiv-lhota.example")], [10, 10, undefined]);
  assert.equal(wholeBookFor(env, "archiv-lhota.example"), undefined);
});

test("K1.4 numbers of a book's folder by the names alone: a portal's .jp2 counted back, any other file as named; a file without a number left lying, never holding back the rest", () => {
  assert.deepEqual(numberBookFiles(["/x/0000000040.jp2", "/x/50.jp2", "/x/7.jpg"], "B0004", 10), { files: ["/x/0000000040.jp2", "/x/50.jp2", "/x/7.jpg"], numbers: [4, 5, 7], by: "names", left: 0 });
  // no multiple of 10: its number is not known — that one left, the other taken
  assert.deepEqual(numberBookFiles(["/x/45.jp2", "/x/50.jp2"], "B0004", 10), { files: ["/x/50.jp2"], numbers: [5], by: "names", left: 1 });
  // none with a number known: nothing taken, it lies there
  assert.deepEqual(numberBookFiles(["/x/45.jp2"], "B0004", 10), { files: [], numbers: [], by: "names", left: 1 });
  // a portal that names images as they are
  assert.deepEqual(numberBookFiles(["/x/40.jp2", "/x/snímek 8.jpg".normalize("NFD")], "B0001"), { files: ["/x/40.jp2", "/x/snímek 8.jpg".normalize("NFD")], numbers: [40, 8], by: "names", left: 0 });
  // a file without a number beside numbered ones: the numbered taken, it alone left
  assert.deepEqual(numberBookFiles(["/x/sken.jpg", "/x/3.jpg", "/x/обложка.jpg"], "B0001"), { files: ["/x/3.jpg"], numbers: [3], by: "names", left: 2 });
  // none with a number: nothing taken, they lie there — never advice to rename them (spec 141 K2.2)
  assert.deepEqual(numberBookFiles(["/x/sken.jpg", "/x/obal.jpg"], "B0001"), { files: [], numbers: [], by: "names", left: 2 });
});

test("the books: offered by the research's books.minTasks, the whole book where the archive lets it, the folder of a book taken (K1.4), queue.sameBook at most 5 in a row, the book of each task", opts, async () => {
  const w = await world();
  try {
    const tree = () => Tree.open(w.cwd, w.env);
    // what may be downloaded: the whole book with the archive's own words, the images needed, selected images
    const rows = bookRows(tree());
    const row = (id: string) => rows.find((r) => r.id === id)!;
    assert.deepEqual([row("B0001").download, row("B0001").downloadTerms], ["whole", { how: "allowed", says: LHOTA_SAYS, from: "reply", host: "archiv-lhota.example" }]);
    assert.deepEqual([row("B0002").download, row("B0002").downloadTerms, row("B0002").need], ["range", undefined, "3"]);
    assert.equal(row("B0003").download, "selected");
    assert.equal(row("B0005").download, "range", "a value strom does not know: as none");
    // a whole book is offered with nothing waiting; the images needed only when a task waits for them
    assert.deepEqual(offeredBooks(tree()).map((r) => r.id), ["B0002", "B0001"], "as many tasks: the one more wait for first");
    assert.deepEqual(downloadOf(tree(), tree().get<RecordSet>("B0003")!).download, "selected");

    // books.minTasks: the research's own, checked
    for (const bad of ["0", "1000", "2.5", "pět"]) {
      const r = await w.run(["config", "set", "books.minTasks", bad, "--for-tree"]);
      assert.notEqual(r.code, 0, bad);
    }
    assert.notEqual((await w.run(["config", "set", "queue.sameBook", "možná", "--for-tree"])).code, 0);
    await w.ok(["config", "set", "books.minTasks", "6", "--for-tree"]);
    assert.deepEqual(offeredBooks(tree()).map((r) => r.id), [], "five tasks each: none at 6");
    assert.equal((await w.ok(["task", "books", "--json"])).json.min, 6);
    await w.ok(["config", "set", "books.minTasks", "2", "--for-tree"]);
    assert.deepEqual(offeredBooks(tree()).map((r) => r.id), ["B0002", "B0001"], "B0003 selected, nothing waits on it: nothing to offer");
    await w.ok(["config", "unset", "books.minTasks", "--for-tree"]);

    // K1.4: the folder of a book no task waits on, taken by the numbers in the names; the folder of a wait is the wait's
    const shared = path.join(w.home, "shared");
    assert.deepEqual(bookFolders(tree()).map((f) => [f.recordset, f.times]), [["B0001", undefined], ["B0003", undefined], ["B0004", 10], ["B0005", undefined]]);
    const b1 = path.join(shared, "inbox", inboxFolderFor(tree().get<RecordSet>("B0001")!));
    saved(path.join(b1, "0007.jpg"));
    saved(path.join(b1, "snímek 8.jpg".normalize("NFD")), "base420.jpg");
    const b3 = path.join(shared, "inbox", inboxFolderFor(tree().get<RecordSet>("B0003")!));
    saved(path.join(b3, "sken.jpg"));
    saved(path.join(b3, "3.jpg"), "base444.jpg");
    const took = await w.ok(["media", "add", "--inbox", "--waiting"]);
    assert.match(took.out, /the book's own folder: its tasks read them from disk/u);
    assert.match(took.out, /images 3 of B0003 registered.* — 1 file left lying: no image's number in the name \(strom media add <file> --recordset B0003 --image <n>, once its content says which\)/u, took.out);
    const images = tree().list<Media>("media").filter((m) => m.recordset === "B0001" && !m.retracted).map((m) => m.image).sort();
    assert.deepEqual(images, [7, 8]);
    assert.deepEqual(tree().list<Media>("media").filter((m) => m.recordset === "B0003" && !m.retracted).map((m) => m.image), [3], "the numbered file beside it taken");
    assert.deepEqual(fs.existsSync(b1) ? fs.readdirSync(b1) : [], [], "taken out of the folder");
    assert.deepEqual(fs.readdirSync(b3), ["sken.jpg"], "no number in its name: left where it is");
    assert.equal(tree().list<Task>("task").find((t) => t.id === "T0011")!.state, "open", "nothing woken, nothing waited");

    // queue.sameBook: the book the last session read (its images on disk) first, at most 5 sessions in a row
    const order = (sameBook?: boolean) => rankTasks(tree(), tree().list<Task>("task"), "balanced", sameBook === undefined ? {} : { sameBook });
    const ended = (task: string, minutes: number) => {
      const t = tree();
      t.withTreeLock(() => {
        const at = new Date(Date.now() - (60 - minutes) * 60_000).toISOString();
        const id = t.allocate("N");
        t.put({ id, type: "session", task, state: "closed", started: at, ended: at, created: at, updated: at, notes: [] } as unknown as Session, { op: "session.end", targets: [id], summary: `session ${id}` });
      });
      t.commit("a session");
    };
    ended("T0006", 1); // B0002, nothing of it on disk
    ended("T0001", 2); // B0001, the last
    assert.equal(order().find((r) => r.sameBook), undefined, "off by default");
    const on = order(true);
    const firstOther = on.findIndex((r) => !["T0002", "T0003", "T0004", "T0005", "T0001"].includes(r.task.id));
    assert.ok(on.slice(0, firstOther).every((r) => r.sameBook === "B0001"), on.map((r) => `${r.task.id} ${r.sameBook ?? ""}`).join(", "));
    assert.ok(firstOther >= 4, "the book's other tasks first");
    assert.match(on[0]!.why, /the same book as the last session \(B0001, its images on disk: queue\.sameBook; 1 in a row so far, at most 5\)/u);
    for (let i = 3; i <= SAME_BOOK_MAX + 1; i++) ended(`T000${i - 1}`, i);
    assert.equal(order(true).find((r) => r.sameBook), undefined, "five in a row in one book: the rest of the queue again");
  } finally {
    w.cleanup();
  }
});

test("bridge: /status books (feature books, any app version), the book of each task waiting and in the queue, POST /books; 400, 503 busy; nothing in an archive", opts, async () => {
  const w = await world();
  Object.assign(w.env, { STROM_LOCK_WAIT_MS: "1500", STROM_INBOX_POLL_MS: "200", STROM_INBOX_SETTLE_MS: "100" });
  try {
    const url = ((await w.ok(["live", "start", "--json"])).json as { url: string }).url;
    const status = async (app = "3.0.0") => (await request(`${url}/status?app=${app}`)).body;
    let s = await status();
    assert.ok(s.features.includes("books"));
    assert.deepEqual(s.books.settings, { minTasks: 5, minTasksOwn: false, minTasksDefault: 5, sameBook: "no", sameBookOwn: false, sameBookDefault: "no" });
    assert.deepEqual(s.books.list.map((b: { id: string }) => b.id), ["B0002", "B0001"]);
    assert.equal(s.books.more, 0);
    const [b2, b1] = s.books.list;
    assert.deepEqual(
      { id: b1.id, title: b1.title, tasks: b1.tasks, waiting: b1.waiting, offer: b1.offer, download: b1.download, downloadTerms: b1.downloadTerms, url: b1.url, ids: b1.ids, dir: b1.dir },
      { id: "B0001", title: "Lhota 3, N 1784–1820", tasks: 5, waiting: 0, offer: true, download: "whole", downloadTerms: { how: "allowed", says: LHOTA_SAYS, from: "reply", host: "archiv-lhota.example" }, url: "https://archiv-lhota.example/kniha/3", ids: undefined, dir: undefined },
    );
    assert.deepEqual([b2.title, b2.folder, b2.need, b2.download, b2.waiting], ["Матрика Lhotíčky O 1800–1850".normalize("NFC"), "B0002 Матрика Lhotíčky O 1800–1850".normalize("NFC"), "3", "range", 1]);
    // the book of a task: waiting for it, in the queue
    assert.equal((s.waiting as { id: string; book?: string }[]).find((x) => x.id === "T0010")?.book, "B0002");
    const q = (st: any, id: string) => (st.queue as { id: string; book?: string; sameBook?: string }[]).find((x) => x.id === id);
    assert.deepEqual([q(s, "T0001")?.book, q(s, "T0011")?.book, q(s, "T0001")?.sameBook], ["B0001", "B0003", undefined]);
    // one part alone
    const part = await request(`${url}/status/books`);
    assert.equal(part.status, 200, JSON.stringify(part.body));
    assert.deepEqual([part.body.part, part.body.books.list], ["books", s.books.list]);

    // files lying in a book's folder, not taken yet
    const shared = path.join(w.home, "shared");
    const book = (st: any, id: string) => (st.books.list as { id: string; onDisk: number; pending?: number }[]).find((x) => x.id === id)!;
    const onDisk = book(s, "B0001").onDisk;
    saved(path.join(shared, "inbox", b1.folder, "snímek 12.jpg"));
    saved(path.join(shared, "inbox", b1.folder, "obal.jpg"), "base420.jpg");
    // the bridge's look at the folders: the numbered one taken, the one with no number in its name left there, said as
    // lying in the book's folder
    await until("the numbered file taken, the other lying", async () => {
      s = await status();
      return book(s, "B0001").onDisk === onDisk + 1 && book(s, "B0001").pending === 1;
    }, { state: () => s.books.list });
    assert.deepEqual(fs.readdirSync(path.join(shared, "inbox", b1.folder)), ["obal.jpg"]);
    assert.equal(book(s, "B0002").pending, undefined);

    // POST /books: the research's own settings, each a strom config command
    const before = s.head;
    const set = await request(`${url}/books`, "POST", { minTasks: 6, sameBook: "yes" });
    assert.equal(set.status, 200, JSON.stringify(set.body));
    assert.deepEqual(set.body.books.settings, { minTasks: 6, minTasksOwn: true, minTasksDefault: 5, sameBook: "yes", sameBookOwn: true, sameBookDefault: "no" });
    assert.notEqual(set.body.head, before);
    assert.equal((await w.ok(["config", "get", "books.minTasks", "--json"])).json.value, 6);
    assert.equal((await w.ok(["config", "get", "queue.sameBook", "--json"])).json.value, "yes");
    assert.deepEqual((await status()).books.list.map((b: { id: string }) => b.id), ["B0002"], "the whole book still offered by its 5 tasks? no: 6 needed — only what waits");
    const again = await request(`${url}/books`, "POST", { minTasks: 6 });
    assert.deepEqual([again.status, again.body.head], [200, again.body.parent]);
    const back = await request(`${url}/books`, "POST", { minTasks: "default", sameBook: "default" });
    assert.equal(back.status, 200, JSON.stringify(back.body));
    assert.deepEqual([back.body.books.settings.minTasks, back.body.books.settings.minTasksOwn, back.body.books.settings.sameBook, back.body.books.settings.sameBookOwn], [5, false, "no", false]);
    for (const body of [{}, { minTasks: 0 }, { minTasks: 1000 }, { minTasks: "5" }, { minTasks: 2.5 }, { sameBook: true }, { sameBook: "ano" }, { minTasks: 5, what: 1 }]) {
      const r = await request(`${url}/books`, "POST", body);
      assert.deepEqual([r.status, r.body.code], [400, "books.body"], JSON.stringify(body));
    }

    // the research held by another strom: busy, nothing written
    const lock = path.join(w.cwd, ".strom", "tree.lock");
    fs.mkdirSync(path.dirname(lock), { recursive: true });
    fs.writeFileSync(lock, JSON.stringify({ pid: process.pid, host: os.hostname(), at: now(), owner: "a test" }));
    try {
      const busy = await request(`${url}/books`, "POST", { minTasks: 7 });
      assert.deepEqual([busy.status, busy.body.code], [503, "research.busy"]);
    } finally {
      fs.rmSync(lock, { force: true });
    }
    assert.equal(readTree(w).booksMinTasks, undefined);

    // an archive: nobody researches — no books, nothing written
    await w.ok(["live", "stop"]);
    await w.ok(["mode", "archive"], { tty: true });
    const url2 = ((await w.ok(["live", "start", "--json"])).json as { url: string }).url;
    assert.equal((await request(`${url2}/status?app=3.0.0`)).body.books, undefined);
    const refused = await request(`${url2}/books`, "POST", { minTasks: 7 });
    assert.deepEqual([refused.status, refused.body.code], [409, "directions.archive"]);
  } finally {
    await w.run(["live", "stop"]);
    w.cleanup();
  }
});

/** The research's own settings as its strom.json keeps them. */
function readTree(w: World): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(path.join(w.cwd, "strom.json"), "utf8")) as Record<string, unknown>;
}

test("the link book?…&do=folder: a book by its ID alone, do one of fixed values", () => {
  const tree = "0f8e2c1a-1b2c-4d3e-8f90-123456789abc";
  assert.deepEqual(parseLink(`strom-research://book?tree=${tree}&id=b3&do=folder`), { action: "book", tree, id: "B3", do: "folder" });
  assert.deepEqual(parseLink(`strom-research://book?tree=${tree}&id=B0003`), { action: "book", tree, id: "B0003", do: "folder" });
  for (const bad of [`id=P1&do=folder`, `id=B1&do=delete`, `id=${encodeURIComponent("B1/../x")}`, ""]) assert.throws(() => parseLink(`strom-research://book?tree=${tree}&${bad}`), bad);
  assert.equal(linkText({ action: "book", tree, id: "B0003", do: "folder" }), `strom-research://book?tree=${tree}&id=B0003&do=folder`);
});

test("the menu: Settings → Archives → the books — from how many tasks, the same book in a row; the research's own", opts, async () => {
  const w = await world();
  try {
    // 8 settings · 4 archives · 3 the books (last, after the consent and the agent's browser) · 1 from how many · 3 ·
    // 2 the same book · yes · 0 · 0 · 0 · 0
    const r = await w.ok([], { tty: true, answers: ["8", "4", "3", "1", "3", "2", "a", "0", "0", "0", "0"] });
    assert.match(r.out, /\[3\] {2}Knihy s nejvíc úkoly {2,}nabízet od 5 úkolů, tatáž kniha po sobě vypnuto\n/u);
    assert.match(r.out, /\[2\] {2}Další sezení v téže knize {2,}zapnuto {2}→ vypnout/u);
    const own = readTree(w);
    assert.deepEqual([own.booksMinTasks, own.queueSameBook], [3, "yes"]);
  } finally {
    w.cleanup();
  }
});
