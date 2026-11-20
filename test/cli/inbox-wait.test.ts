// A task waiting for images the person saves by hand comes back by itself (core/inboxwait.ts, core/inboxwatch.ts):
// the bridge takes them as they are saved, a session's start where no bridge ran; named otherwise, by their order when
// as many as missing; a part of them, it waits on and says which are missing. An archive only a person's browser
// reaches is said so wherever the agent reads its book (brief, recordset add/show, net web), whatever the book's access
// says — a research of strom 1.26 reads right with nothing rewritten.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import { inboxFolderFor } from "../../src/core/media.ts";
import { numberFiles, unsettled, SETTLE_MS } from "../../src/core/inboxwait.ts";
import { watchInbox } from "../../src/core/inboxwatch.ts";
import type { Media, Task } from "../../src/core/model.ts";

const opts = { skip: !hasGit };
const fixtures = path.join(import.meta.dirname, "..", "fixtures", "images");
// an archive strom's list of archives' terms says only a person's browser reaches (assets/archives.json)
const BROWSER_ONLY = "https://ebadatelna.soapraha.cz/pages/SearchMatrikaPage";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** A file saved long enough ago to have settled. */
function saved(from: string, to: string): void {
  fs.copyFileSync(path.join(fixtures, from), to);
  const past = new Date(Date.now() - 2 * SETTLE_MS);
  fs.utimesSync(to, past, past);
}

async function world(): Promise<{ w: World; shared: string }> {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["research", "new", "X", "--new-person", "Jan /Lhoták/"]);
  return { w, shared: path.join(w.home, "shared") };
}

test("the files of a folder: numbered by their names, else by their order when as many as missing, else why not", () => {
  const have = new Set<number>();
  assert.deepEqual(numberFiles(["/x/9.jpg", "/x/10.jpg"], [9, 10], have, "B0002"), { numbers: [9, 10], by: "names" });
  // the portal's own names (×10): a number in a name is never put aside for the order (B0408) — said what to do; a .jp2
  // of an archive strom's list says counts them so, counted back
  assert.equal((numberFiles(["/x/kniha-00090.jpg", "/x/kniha-00100.jpg"], [9, 10], have, "B0002") as { code: string }).code, "inbox.count");
  assert.deepEqual(numberFiles(["/x/kniha-00090.jp2", "/x/kniha-00100.jp2"], [9, 10], have, "B0002", 10), { numbers: [9, 10], by: "names" });
  // a file named by a number alone is never numbered by the order (B0408: "1.jpg" of a task waiting for 33 taken for 33)
  const one = numberFiles(["/x/1.jpg"], [33], new Set(), "B0408");
  assert.ok("problem" in one && one.code === "inbox.count", JSON.stringify(one));
  assert.match((one as { problem: string }).problem, /images 33 of B0408 were asked for, but the file names give 1 .*name each by the number its viewer counts \(33\.jpg\)/u);
  // a copy a file manager made (Finder's "33 2.jpg", Explorer's "33 - Copy (2).jpg"): the image's number, not the copy's
  assert.deepEqual(numberFiles(["/x/33 2.jpg"], [33], have, "B0408"), { numbers: [33], by: "names" });
  assert.equal((numberFiles(["/x/1a.jpg", "/x/kniha-00100.jpg"], [9, 10], have, "B0002") as { code: string }).code, "inbox.count");
  // a screenshot's date and time is no image's number: by their order
  assert.deepEqual(numberFiles(["/x/Snímek obrazovky 2026-11-17 v 10.21.47.png".normalize("NFD")], [33], have, "B0408"), { numbers: [33], by: "order" });
  // a screenshot's name in any script, decomposed (NFD): no number, by order
  assert.deepEqual(numberFiles(["/x/Снимок экрана.png".normalize("NFD")], [10], new Set([9]), "B0002"), { numbers: [10], by: "order" });
  const count = numberFiles(["/x/a.jpg", "/x/b.jpg", "/x/c.jpg"], [9, 10], have, "B0002");
  assert.ok("problem" in count && count.code === "inbox.count");
  assert.match((count as { problem: string }).problem, /3 files for 2 images/);
  // which images not known (a site the person looks at): only numbered files
  assert.deepEqual(numberFiles(["/x/12.jpg"], undefined, have, "B0002"), { numbers: [12], by: "names" });
  assert.equal((numberFiles(["/x/obrázek.jpg"], undefined, have, "B0002") as { code: string }).code, "inbox.unnamed");
});

test("a file still being written is not taken; the folder of a book stays within 80 characters (Windows)", () => {
  const dir = fs.mkdtempSync(path.join(fs.realpathSync(process.env.TMPDIR ?? "/tmp"), "inbox-"));
  try {
    const f = path.join(dir, "9.jpg");
    fs.copyFileSync(path.join(fixtures, "grey.jpg"), f);
    assert.deepEqual(unsettled([f]), [f]);
    assert.deepEqual(unsettled([f], Date.now() + SETTLE_MS + 10), []);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  const long = inboxFolderFor({ id: "B0012", title: "Řím.-kat. farnost Lhota pod Horou, Матрика рождений, N 1784–1820, Z 1784–1830, O 1790–1830" });
  assert.ok([...long].length <= 80);
  assert.ok(!/[ .]$/u.test(long));
});

test("K1.1: a book of an archive only a person's browser reaches: by hand with its numbers — brief, recordset add/show, net web", opts, async () => {
  const { w } = await world();
  // as strom 1.26 wrote it: access online-free
  const add = await w.ok(["recordset", "add", "Lhota N 1850–1870", "--kinds", "baptism", "--places", "Lhota", "--years", "1850-1870", "--access", "online-free", "--url", BROWSER_ONLY]); // B1
  assert.match(add.out, /B0001: .* lets automated tools in only through a person's browser \(strom's list of archives\) — no connector, no web fetch; its images by the person's hand: strom task wait T… --images B0001:<numbers>/);
  assert.equal((await w.ok(["recordset", "show", "B1", "--json"])).json.recordset.access, "online-free", "nothing rewritten");
  assert.match((await w.ok(["recordset", "show", "B1"])).out, /access {6}online, free to view — only through a person's browser .*--images B0001:<numbers>/);
  await w.ok(["task", "add", "Křest Jana", "--level", "link", "--where", "B1", "--why", "a", "--done-when", "b"]); // T1
  const brief = (await w.ok(["brief", "T1"])).out;
  assert.match(brief, /access by hand \(online, free to view — only through a person's browser\)/);
  assert.match(brief, /no images here yet — the user saves them by hand \(never scrape an archive; only a person's browser reaches this archive\): strom task wait <T…> --images B0001:<numbers>/);
  assert.doesNotMatch(brief, /build one now/);
  // the agent's web tool: refused, the book named
  const check = await w.ok(["net", "web", "--check", BROWSER_ONLY, "--json"]);
  assert.equal(check.json.allow, false);
  assert.match(check.json.reason, /strom task wait T… --images B0001:<numbers> --on/);
  w.cleanup();
});

test("K1.2 + K1.4: images saved for a waiting task are taken at the next session's start; what task wait and session close say is what strom does", opts, async () => {
  const { w, shared } = await world();
  await w.ok(["recordset", "add", "Lhota N 1850–1870", "--url", "https://archive.example.org/book/77"]); // B1
  await w.ok(["task", "add", "Křest Jana", "--level", "link", "--where", "B1", "--why", "a", "--done-when", "b"]); // T1
  await w.ok(["session", "start", "T1"]);
  const asked = await w.ok(["task", "wait", "T1", "--images", "B1:9-10", "--on", "snímky 9–10 knihy Lhota"]);
  assert.match(asked.out, /once all of them are saved the task comes back by itself — as they are saved while the bridge runs, else at the next session's start/);
  const closed = await w.ok(["session", "close", "--summary", "snímky 9–10 chybí", "--next", "přečíst snímky 9–10"]);
  assert.match(closed.out, /T0001 waits for images 9–10 of B0001 saved by the user into .*: strom takes them by itself \(as they are saved while the bridge runs, else at the next session's start\) and the task comes back once all of them are there/);
  const dir = path.join(shared, "inbox", inboxFolderFor({ id: "B0001", title: "Lhota N 1850–1870" }));
  assert.ok(fs.statSync(dir).isDirectory());
  // a part of them: the overview says how many of how many and what is missing (K1.3)
  saved("grey.jpg", path.join(dir, "9.jpg"));
  const one = await w.ok(["session", "start"]);
  assert.match(one.out, /images 9 of B0001 registered — T0001 still waits for images 10/);
  assert.equal((await w.ok(["task", "show", "T1", "--json"])).json.task.state, "waiting");
  await w.ok(["session", "close", "--summary", "nic", "--next", "dál"]).catch(() => undefined);
  const status = (await w.ok(["status"])).out;
  assert.match(status, /snímky 9–10 z B0001 Lhota N 1850–1870/);
  assert.match(status, /uloženo 1 z 2 · chybí: 10/);
  // the rest, named otherwise: by its order
  saved("cmyk.jpg", path.join(dir, "Snímek obrazovky 2026-11-04.jpg".normalize("NFD")));
  const all = await w.ok(["media", "add", "--inbox", "--waiting"]);
  assert.match(all.out, /images 10 of B0001 registered \(numbered by their order/);
  assert.match(all.out, /back in the queue: T0001/);
  assert.equal((await w.ok(["task", "show", "T1", "--json"])).json.task.state, "open");
  assert.ok(!fs.existsSync(dir), "the emptied folder goes");
  w.cleanup();
});

test("a site the person looks at (task wait --kind web) for the one book of its task: images of that book saved into its folder bring it back — a 1.26 research's wait too", opts, async () => {
  const { w, shared } = await world();
  await w.ok(["recordset", "add", "Lhota N 1850–1870", "--access", "online-free", "--url", BROWSER_ONLY]); // B1
  await w.ok(["task", "add", "Křest Jana", "--level", "link", "--where", "B1", "--why", "a", "--done-when", "b"]); // T1
  // as strom 1.26 set it waiting: a site, no images named
  const r = await w.ok(["task", "wait", "T1", "--kind", "web", "--url", BROWSER_ONLY, "--on", "projít knihu Lhota v badatelně"]);
  const dir = path.join(shared, "inbox", inboxFolderFor({ id: "B0001", title: "Lhota N 1850–1870" }));
  assert.match(r.out, /images of B0001 the user saves into .* bring it back by themselves/);
  assert.match((await w.ok(["status"])).out, /snímky knihy B0001 Lhota N 1850–1870 uložené do .* vrátí úkol samy/);
  // the task wait of strom 1.26 had no folder: made when strom first looks
  fs.rmSync(dir, { recursive: true, force: true });
  await w.ok(["media", "add", "--inbox", "--waiting"]);
  assert.ok(fs.statSync(dir).isDirectory());
  saved("grey.jpg", path.join(dir, "41.jpg"));
  const taken = await w.ok(["media", "add", "--inbox", "--waiting"]);
  assert.match(taken.out, /images 41 of B0001 registered — back in the queue: T0001/);
  assert.equal((await w.ok(["task", "show", "T1", "--json"])).json.task.state, "open");
  w.cleanup();
});

test("K1.2: the bridge's watch takes what is saved once it has settled, only the folders tasks wait on", opts, async () => {
  const { w, shared } = await world();
  await w.ok(["recordset", "add", "Lhota N 1850–1870", "--url", "https://archive.example.org/book/77"]); // B1
  await w.ok(["task", "add", "Křest Jana", "--level", "link", "--where", "B1", "--why", "a", "--done-when", "b"]); // T1
  await w.ok(["task", "wait", "T1", "--images", "B1:9", "--on", "snímek 9 knihy Lhota"]);
  const dir = path.join(shared, "inbox", inboxFolderFor({ id: "B0001", title: "Lhota N 1850–1870" }));
  // a folder nobody waits on: never watched
  const other = path.join(shared, "inbox", "B0099 cizí");
  fs.mkdirSync(other, { recursive: true });
  let takes = 0;
  const notes: string[] = [];
  const watch = watchInbox({
    root: w.cwd,
    env: { ...w.env, STROM_INBOX_SETTLE_MS: "300", STROM_INBOX_POLL_MS: "60000" },
    shared: () => shared,
    busy: () => false,
    note: (l) => notes.push(l),
    take: (done) => {
      takes++;
      void w.ok(["media", "add", "--inbox", "--waiting"]).then(
        () => done(true),
        () => done(false),
      );
    },
  });
  try {
    assert.deepEqual(watch.folders(), [dir]);
    assert.match(notes.join("\n"), /watching 1 inbox folder tasks wait on/);
    // being copied: not taken yet
    fs.copyFileSync(path.join(fixtures, "grey.jpg"), path.join(dir, "9.jpg"));
    watch.look();
    assert.equal(takes, 0, "a file still being written is not taken");
    // settled: taken by itself (the system's notice of the change, else the look)
    for (let i = 0; i < 40 && Tree.open(w.cwd, w.env).get<Task>("T0001")!.state === "waiting"; i++) {
      await wait(150);
      if (i === 10) watch.look();
    }
    assert.equal(Tree.open(w.cwd, w.env).get<Task>("T0001")!.state, "open");
    assert.ok(takes >= 1);
    // what cannot be taken is tried once, not again and again while nothing changes
    fs.mkdirSync(path.join(shared, "inbox"), { recursive: true });
    const n = takes;
    watch.look();
    await wait(400);
    watch.look();
    assert.equal(takes, n, "nobody waits: nothing taken again");
  } finally {
    watch.end();
  }
  w.cleanup();
});

test("B0408: a file that is the same scan as another image is never deleted unsaid — set aside beside it, said by strom media add --inbox and in the bridge's log", opts, async () => {
  const { w, shared } = await world();
  await w.ok(["recordset", "add", "Lhota N 1850–1870", "--url", "https://archive.example.org/book/77"]); // B1
  await w.ok(["task", "add", "Křest Jana", "--level", "link", "--where", "B1", "--why", "a", "--done-when", "b"]); // T1
  await w.ok(["task", "wait", "T1", "--images", "B1:9-10", "--on", "snímky 9–10 knihy Lhota"]);
  const folder = inboxFolderFor({ id: "B0001", title: "Lhota N 1850–1870" });
  const dir = path.join(shared, "inbox", folder);
  fs.mkdirSync(dir, { recursive: true });
  // a copy Finder made of the first image: image 9, never image 2
  saved("grey.jpg", path.join(dir, "9 2.jpg"));
  const first = await w.ok(["media", "add", "--inbox", "--waiting", "--json"]);
  const m9 = Tree.open(w.cwd, w.env).list<Media>("media").find((m) => m.recordset === "B0001");
  assert.equal(m9?.image, 9, JSON.stringify(first.json));
  // the same scan saved again as image 10: not taken, kept beside it under a name that says which image it is
  saved("grey.jpg", path.join(dir, "10.jpg"));
  const r = await w.ok(["media", "add", "--inbox", "--waiting"]);
  const aside = `10.jpg.same-as-${m9!.id}`;
  assert.ok(r.out.includes(`⚠ the file for image 10 of B0001 is the same scan as ${m9!.id} (B0001:9), registered already — not taken, set aside as ${aside}`), r.out);
  assert.ok(fs.existsSync(path.join(dir, aside)), "set aside, never deleted");
  assert.ok(!fs.existsSync(path.join(dir, "10.jpg")));
  assert.equal(Tree.open(w.cwd, w.env).get<Task>("T0001")!.state, "waiting", "image 10 still missing");
  // set aside once: the next look takes nothing again
  const again = await w.ok(["media", "add", "--inbox", "--waiting", "--json"]);
  assert.ok(!((again.json.taken ?? []) as { aside?: string[] }[]).some((t) => t.aside?.length), JSON.stringify(again.json));
  // the bridge: what it set aside said in its log
  fs.rmSync(path.join(dir, aside));
  Object.assign(w.env, { STROM_INBOX_POLL_MS: "200", STROM_INBOX_SETTLE_MS: "100" });
  await w.ok(["live", "start"]);
  try {
    saved("grey.jpg", path.join(dir, "10.jpg"));
    const log = path.join(w.cwd, ".strom", "live.log");
    const said = () => (fs.existsSync(log) ? fs.readFileSync(log, "utf8") : "");
    for (let i = 0; i < 200 && !said().includes("same scan as"); i++) await wait(100);
    assert.ok(said().includes(`inbox ${folder}: the file for image 10 of B0001 is the same scan as ${m9!.id} (B0001:9)`), said());
    assert.ok(fs.existsSync(path.join(dir, aside)), "the bridge sets it aside too");
  } finally {
    await w.ok(["live", "stop"]);
    w.cleanup();
  }
});
