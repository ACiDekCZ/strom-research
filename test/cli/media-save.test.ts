// One image a waiting task asks for, saved through the agent's browser at an archive only a person's browser goes to
// (no connector of it): strom media save gives the script for the agent's tab on that one page, the browser saves what
// it shows into the downloads folder (strom-T0001-0009.jpg), and strom media add --inbox --waiting moves it into the
// task's folder as image 9 and takes it — only with the person's permission "through the browser", only for an agent
// whose browser strom keeps, never where strom's list or robots.txt keeps automated tools off.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";
import { inboxFolderFor } from "../../src/core/media.ts";
import { SETTLE_MS } from "../../src/core/inboxwait.ts";

const opts = { skip: !hasGit };
const fixtures = path.join(import.meta.dirname, "..", "fixtures", "images");
// an archive strom's list keeps as only a person's browser's (restricted, browserOnly) whose terms let a person save
// single scans for their own research; the page of one scan in its viewer (made up)
const PAGE = "https://genbaza.pl/skan/4711?n=9";
const CLAUDE = { CLAUDECODE: "1" };

/** A file the browser finished saving a while ago. */
function settled(file: string, from = "grey.jpg"): void {
  fs.copyFileSync(path.join(fixtures, from), file);
  const past = new Date(Date.now() - 2 * SETTLE_MS);
  fs.utimesSync(file, past, past);
}

/** The script run as the tab runs it: on `href`, the page showing one image of `size`, its download into the folder. */
async function tab(script: string, href: string, downloads: string, size = { w: 1600, h: 1200 }): Promise<string> {
  const blobs = new Map<string, Blob>();
  const saves: Promise<void>[] = [];
  const img = { complete: true, naturalWidth: size.w, naturalHeight: size.h, src: `${new URL(href).origin}/img/9.jpg`, currentSrc: "" };
  const document = {
    body: { appendChild: () => undefined },
    images: [img],
    createElement: (kind: string) => {
      if (kind === "canvas") return { width: 0, height: 0, getContext: () => ({ drawImage: () => undefined }), toBlob: (cb: (b: Blob) => void) => cb(new Blob([fs.readFileSync(path.join(fixtures, "grey.jpg"))], { type: "image/jpeg" })) };
      const a = {
        href: "",
        download: "",
        remove: () => undefined,
        click: () => saves.push((async () => fs.writeFileSync(path.join(downloads, a.download), Buffer.from(await blobs.get(a.href)!.arrayBuffer())))()),
      };
      return a;
    },
  };
  const URLs = { createObjectURL: (b: Blob) => (blobs.set(`blob:${blobs.size}`, b), `blob:${blobs.size - 1}`), revokeObjectURL: () => undefined };
  const u = new URL(href);
  const AsyncFunction = Object.getPrototypeOf(async () => undefined).constructor;
  const run = new AsyncFunction("location", "fetch", "document", "URL", "setTimeout", "window", "requestAnimationFrame", `return ${script}`);
  const refuse = async (x: string) => assert.fail(`the script asked ${x}`);
  const line = await run({ origin: u.origin, pathname: u.pathname, search: u.search, hash: u.hash, href }, refuse, document, URLs, (f: () => void) => f(), {}, (f: () => void) => f());
  await Promise.all(saves);
  return line;
}

test("one image through the agent's browser: the script for the one page, the download moved into the task's folder as its number and taken", opts, async () => {
  const w = new World();
  await w.withTree("Lhotákovi");
  try {
    await w.ok(["research", "new", "X", "--new-person", "Jan /Lhoták/"]);
    const shared = path.join(w.home, "shared");
    const downloads = path.join(w.dir, "Stažené soubory");
    fs.mkdirSync(downloads);
    await w.ok(["config", "set", "browser.downloads", downloads]);
    await w.ok(["recordset", "add", "Lhota N 1850–1870", "--url", PAGE]); // B1
    await w.ok(["task", "add", "Křest Jana", "--level", "link", "--where", "B1", "--why", "a", "--done-when", "b"]); // T1
    await w.ok(["task", "add", "Sňatek Jana", "--level", "link", "--where", "B1", "--why", "a", "--done-when", "b"]); // T2

    // the person saves images 9–10 by hand: the agent's browser not allowed there yet — refused, the person's to allow
    await w.ok(["task", "wait", "T1", "--images", "B1:9-10", "--on", "snímky 9–10 knihy Lhota"]);
    const unasked = await w.run(["media", "save", "T1", "--image", "9", "--at", PAGE], { env: CLAUDE });
    assert.notEqual(unasked.code, 0);
    assert.match(unasked.out + unasked.err, /strom allow archive genbaza\.pl --way browser — the person's, never yours/);
    // the person allows it for an archive of strom's list with no connector: the task comes back for the agent
    const allowed = await w.ok(["allow", "archive", "genbaza.pl", "--way", "browser"], { tty: true });
    assert.match(allowed.out, /T0001/);
    assert.equal((await w.ok(["task", "show", "T1", "--json"])).json.task.state, "open");
    // a host strom's list does not keep as only a person's browser's, with no connector: nothing to allow
    assert.match((await w.run(["allow", "archive", "archive.example.org", "--way", "browser"], { tty: true })).err, /no connector reaches archive\.example\.org/);

    // an agent whose browser strom does not keep: never there
    const codex = await w.run(["media", "save", "T1", "--image", "9", "--at", PAGE], { env: { CODEX_SANDBOX: "seatbelt" } });
    assert.notEqual(codex.code, 0);
    assert.match(codex.out + codex.err, /strom does not keep your browser or computer use/);
    assert.equal((await w.ok(["task", "show", "T1", "--json"])).json.task.state, "open", "nothing written");

    // the script for the one page: only there, and it asks the archive nothing
    const r = await w.ok(["media", "save", "T1", "--image", "9", "--at", PAGE, "--json"], { env: CLAUDE });
    assert.equal(r.json.file, "strom-T0001-0009");
    assert.equal(r.json.then, "strom media add --inbox --waiting");
    // Chrome saves one file of a page by itself: the second waits for the user's yes in Chrome — said, never the agent's
    const told = await w.ok(["media", "save", "T1", "--image", "9", "--at", PAGE], { env: CLAUDE });
    assert.match(told.out, /one more from the same page waits until the user allows genbaza\.pl to download several files .* never change Chrome's settings yourself/);
    // the task waits for the image now (what the person reads in the research language), then for the next one too
    const waiting = (await w.ok(["task", "show", "T1", "--json"])).json.task;
    assert.equal(waiting.state, "waiting");
    assert.equal(waiting.awaits.images, "9");
    assert.equal(waiting.waitingOn, `snímky 9 knihy B0001 Lhota N 1850–1870, ukládá je prohlížeč agenta z ${PAGE}`);
    const r10 = await w.ok(["media", "save", "T1", "--image", "10", "--at", PAGE.replace("n=9", "n=10"), "--json"], { env: CLAUDE });
    assert.equal(r10.json.waits, "9–10");
    const elsewhere = await tab(r.json.script, "https://genbaza.pl/skan/4712?n=9", downloads);
    assert.match(elsewhere, /^strom: this tab is not on https:\/\/genbaza\.pl\/skan\/4711\?n=9/);
    // the viewer paged to another image of the book (its address says so): refused, nothing saved, said for the person too
    const paged = await tab(r.json.script, PAGE.replace("n=9", "n=10"), downloads);
    assert.match(paged, /^strom: this tab shows https:\/\/genbaza\.pl\/skan\/4711\?n=10, not https:\/\/genbaza\.pl\/skan\/4711\?n=9 — another image than 9 .*nothing saved/);
    assert.ok(paged.endsWith(`karta prohlížeče ukazuje jiný snímek než 9 (${PAGE}), nic se neuložilo`), paged);
    assert.match(await tab(r.json.script, `${PAGE}#strana-10`, downloads), /another image than 9/);
    assert.match(await tab(r.json.script, `${PAGE}&n=10`, downloads), /another image than 9/);
    assert.deepEqual(fs.readdirSync(downloads), [], "nothing saved");
    const line = await tab(r.json.script, PAGE, downloads);
    assert.match(line, /^strom-result 9:200:\d+$/);
    assert.deepEqual(fs.readdirSync(downloads), ["strom-T0001-0009.jpg"]);

    // image 10 saved twice by the browser (… (1).jpg), one still downloading, another task's, another file of the person
    settled(path.join(downloads, "strom-T0001-0010.jpg"));
    settled(path.join(downloads, "strom-T0001-0010 (1).jpg"), "base444.jpg");
    settled(path.join(downloads, "strom-T0002-0009.jpg"));
    settled(path.join(downloads, "Snímek obrazovky.png".normalize("NFD")), "png-bw.png");
    fs.writeFileSync(path.join(downloads, "strom-T0001-0009.jpg.crdownload"), "…");
    // the file the script saved just now: still settling — the next look takes it
    const first = await w.ok(["media", "add", "--inbox", "--waiting"]);
    assert.match(first.out, /images 10 of B0001 registered — T0001 still waits for images 9/);
    const dir = path.join(shared, "inbox", inboxFolderFor({ id: "B0001", title: "Lhota N 1850–1870" }));
    assert.deepEqual(fs.readdirSync(dir), [], "taken into the store");
    const past = new Date(Date.now() - 2 * SETTLE_MS);
    fs.utimesSync(path.join(downloads, "strom-T0001-0009.jpg"), past, past);
    const taken = await w.ok(["media", "add", "--inbox", "--waiting"]);
    assert.match(taken.out, /images 9 of B0001 registered — back in the queue: T0001/);
    const media = (await w.ok(["media", "list", "--json"])).json;
    assert.deepEqual(JSON.stringify(media).match(/"image":\d+/gu)?.sort(), ['"image":10', '"image":9']);
    assert.equal((await w.ok(["task", "show", "T1", "--json"])).json.task.state, "open");
    // what is not the task's stays where it is
    assert.deepEqual(fs.readdirSync(downloads).map((f) => f.normalize("NFC")).sort(), ["Snímek obrazovky.png", "strom-T0001-0009.jpg.crdownload", "strom-T0002-0009.jpg"]);
  } finally {
    w.cleanup();
  }
});

test("never where strom's list keeps automated tools off: an archive whose robots.txt says so stays the person's by hand", opts, async () => {
  const w = new World();
  await w.withTree("Lhotákovi");
  try {
    await w.ok(["research", "new", "X", "--new-person", "Jan /Lhoták/"]);
    const at = "https://images.archives.cz/mrimage/matriky/proxy/cz/archives/cza/matriky/data/1/0001.jpg";
    await w.ok(["recordset", "add", "Lhota Z 1850–1870", "--url", "https://digi.archives.cz/da/permalink?xid=x"]); // B1
    await w.ok(["task", "add", "Úmrtí Jana", "--level", "link", "--where", "B1", "--why", "a", "--done-when", "b"]); // T1
    await w.ok(["task", "wait", "T1", "--images", "B1:3", "--on", "snímek 3 knihy Lhota"]);
    // no permission could open it: none to give
    assert.match((await w.run(["allow", "archive", "images.archives.cz", "--way", "browser"], { tty: true })).err, /no connector reaches images\.archives\.cz/);
    const r = await w.run(["media", "save", "T1", "--image", "3", "--at", at], { env: CLAUDE });
    assert.notEqual(r.code, 0);
    assert.match(r.out + r.err, /keeps automated tools off/);
    assert.doesNotMatch(r.out, /strom-result|await \(async/);
    assert.equal((await w.ok(["task", "show", "T1", "--json"])).json.task.awaits.images, "3", "nothing written");
  } finally {
    w.cleanup();
  }
});

test("an archive whose viewer shows its images from a server closed to every robot (ZA Opava's digi.archives.cz): no permission \"through the browser\" to give, no script — the person saves the image by hand", opts, async () => {
  const w = new World();
  await w.withTree("Lhotákovi");
  try {
    await w.ok(["research", "new", "X", "--new-person", "Jan /Lhoták/"]);
    const at = "https://digi.archives.cz/da/permalink?xid=x&scan=3";
    await w.ok(["recordset", "add", "Lhota Z 1850–1870", "--url", "https://digi.archives.cz/da/permalink?xid=x"]); // B1
    await w.ok(["task", "add", "Úmrtí Jana", "--level", "link", "--where", "B1", "--why", "a", "--done-when", "b"]); // T1
    await w.ok(["task", "wait", "T1", "--images", "B1:3", "--on", "snímek 3 knihy Lhota"]);
    // the person's permission could not help: not taken, not asked
    const allow = await w.run(["allow", "archive", "digi.archives.cz", "--way", "browser"], { tty: true });
    assert.notEqual(allow.code, 0, allow.out + allow.err);
    const r = await w.run(["media", "save", "T1", "--image", "3", "--at", at], { env: CLAUDE });
    assert.notEqual(r.code, 0);
    assert.match(r.out + r.err, /by hand/);
    assert.doesNotMatch(r.out + r.err, /strom-result|await \(async|--way browser/);
    assert.equal((await w.ok(["task", "show", "T1", "--json"])).json.task.awaits.images, "3", "nothing written");
    // the agent's browser neither, at its pages
    const check = await w.run(["net", "web", "--check", at, "--browser", "--json"], { env: CLAUDE });
    assert.equal(JSON.parse(check.out).allow, false);
    assert.doesNotMatch(JSON.parse(check.out).reason, /--way browser/);
  } finally {
    w.cleanup();
  }
});
