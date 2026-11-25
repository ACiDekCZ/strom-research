// Several images of a book saved through the agent's browser with one call (1124): strom media save --image 9-11 with
// one --at each (or one address with {n}) gives ONE script for them all — each image still on a page of its own, opened
// by the agent in turn (the hook paces each), the script there knowing the image by the tab's address — and one strom
// media add --inbox --waiting after the last takes them all. An image whose page was not opened yet is not said held
// back by the browser. The script strom gives is compact: no comment lines, no indentation. No request leaves this
// computer: the tab is a stand-in.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit, readJsonFile } from "../helpers.ts";
import { SETTLE_MS } from "../../src/core/inboxwait.ts";
import { compactJs, saveScript, SAVE_PAGES_MAX, waitFileBase } from "../../src/core/browser.ts";
import { CHROME_TABS } from "../../src/core/chromehook.ts";

const opts = { skip: !hasGit };
const fixtures = path.join(import.meta.dirname, "..", "fixtures", "images");
// an archive strom's list keeps as only a person's browser's (as test/cli/media-save.test.ts), the viewer's page of one scan
const PAGE = (n: number | string) => `https://genbaza.pl/skan/4711?n=${n}`;
const CLAUDE = { CLAUDECODE: "1" };

const named = (w: World, task: string, n: number) => waitFileBase((JSON.parse(fs.readFileSync(path.join(w.cwd, "strom.json"), "utf8")) as { id: string }).id, task, n);

/** The script run as the tab runs it on `href` (a page showing one image), its download written into the folder. */
async function tab(script: string, href: string, downloads: string, from = "s0001.jpg"): Promise<string> {
  const blobs = new Map<string, Blob>();
  const saves: Promise<void>[] = [];
  const img = { complete: true, naturalWidth: 1600, naturalHeight: 1200, src: `${new URL(href).origin}/img/x.jpg`, currentSrc: "" };
  const document = {
    body: { appendChild: () => undefined },
    images: [img],
    createElement: (kind: string) => {
      if (kind === "canvas") return { width: 0, height: 0, getContext: () => ({ drawImage: () => undefined }), toBlob: (cb: (b: Blob) => void) => cb(new Blob([fs.readFileSync(path.join(fixtures, from))], { type: "image/jpeg" })) };
      const a = { href: "", download: "", remove: () => undefined, click: () => saves.push((async () => fs.writeFileSync(path.join(downloads, a.download), Buffer.from(await blobs.get(a.href)!.arrayBuffer())))()) };
      return a;
    },
  };
  const URLs = { createObjectURL: (b: Blob) => (blobs.set(`blob:${blobs.size}`, b), `blob:${blobs.size - 1}`), revokeObjectURL: () => undefined };
  const u = new URL(href);
  const AsyncFunction = Object.getPrototypeOf(async () => undefined).constructor;
  const run = new AsyncFunction("location", "fetch", "document", "URL", "setTimeout", "window", "requestAnimationFrame", `return ${script}`);
  const line = await run({ origin: u.origin, pathname: u.pathname, search: u.search, hash: u.hash, href }, async (x: string) => assert.fail(`the script asked ${x}`), document, URLs, (f: () => void) => f(), {}, (f: () => void) => f());
  await Promise.all(saves);
  // the browser finished writing it a while ago
  const past = new Date(Date.now() - 2 * SETTLE_MS);
  for (const f of fs.readdirSync(downloads)) fs.utimesSync(path.join(downloads, f), past, past);
  return line;
}

async function research(): Promise<{ w: World; downloads: string }> {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["research", "new", "X", "--new-person", "Jan /Lhoták/"]);
  const downloads = path.join(w.dir, "Stažené soubory");
  fs.mkdirSync(downloads);
  await w.ok(["config", "set", "browser.downloads", downloads]);
  await w.ok(["recordset", "add", "Lhota N 1850–1870", "--url", PAGE(1)]); // B1
  await w.ok(["task", "add", "Křest Jana", "--level", "link", "--where", "B1", "--why", "a", "--done-when", "b"]); // T1
  await w.ok(["allow", "archive", "genbaza.pl", "--way", "browser"], { tty: true });
  return { w, downloads };
}

type Rec = { n: number; at: number; paged?: boolean; order?: number; held?: boolean; taken?: number };
const recordsFile = (w: World) => path.join(w.cwd, ".strom", "browser-saves.json");
const records = (w: World) => readJsonFile(recordsFile(w)) as unknown as Rec[];
/** The records of the saves made `ms` earlier (the time strom waits before it says an image held back). */
function older(w: World, ms: number): void {
  fs.writeFileSync(recordsFile(w), JSON.stringify(records(w).map((r) => ({ ...r, at: r.at - ms }))));
}

test("several images with one call: one script for their pages, each image by its tab's address, another page refused; one media add --inbox --waiting takes them all", opts, async () => {
  const { w, downloads } = await research();
  try {
    const r = await w.ok(["media", "save", "T1", "--image", "9-11", "--at", PAGE("{n}"), "--json"], { env: CLAUDE });
    assert.deepEqual(r.json.images.map((i: { n: number; url: string; file: string }) => [i.n, i.url, i.file]), [9, 10, 11].map((n) => [n, PAGE(n), named(w, "T0001", n)]));
    assert.equal(r.json.then, "strom media add --inbox --waiting");
    assert.equal(r.json.waits, "9–11");
    const task = (await w.ok(["task", "show", "T1", "--json"])).json.task;
    assert.equal(task.state, "waiting");
    assert.equal(task.awaits.images, "9–11");
    // the text: the pages in their order, the same script on each, one media add after the last
    const text = (await w.ok(["media", "save", "T1", "--image", "9,10,11", "--at", PAGE(9), "--at", PAGE(10), "--at", PAGE(11)], { env: CLAUDE })).out;
    assert.match(text, new RegExp(`^   9  ${PAGE(9).replace(/[?.]/g, "\\$&")}\\n   10  .*\\n   11  `, "m"));
    assert.match(text, /the same script for every image of the list/);
    assert.match(text, /After the last: strom media add --inbox --waiting — once/);
    // the page of none of them: nothing saved
    assert.match(await tab(r.json.script, PAGE(12), downloads), /^strom: this tab shows .* the page of none of images 9, 10, 11 given to save; nothing saved/u);
    assert.match(await tab(r.json.script, "https://genbaza.pl/skan/4712?n=10", downloads), /the page of none of images 9, 10, 11 given to save; nothing saved/u);
    assert.deepEqual(fs.readdirSync(downloads), []);
    // each page in turn, the same script
    for (const n of [10, 9, 11]) assert.match(await tab(r.json.script, PAGE(n), downloads, `s000${n - 8}.jpg`), new RegExp(`^strom-result ${n}:200:\\d+$`));
    assert.deepEqual(fs.readdirSync(downloads).sort(), [9, 10, 11].map((n) => `${named(w, "T0001", n)}.jpg`).sort());
    const taken = await w.ok(["media", "add", "--inbox", "--waiting"]);
    assert.match(taken.out, /images 9–11 of B0001 registered — back in the queue: T0001/);
    assert.equal((await w.ok(["task", "show", "T1", "--json"])).json.task.state, "open");
    assert.deepEqual(fs.readdirSync(downloads), []);
    // registered: once more only with --again
    const again = await w.run(["media", "save", "T1", "--image", "9,10", "--at", PAGE("{n}")], { env: CLAUDE });
    assert.notEqual(again.code, 0);
    assert.match(again.out + again.err, /image 9–10 of B0001 registered already/);
    const r2 = await w.ok(["media", "save", "T1", "--image", "9,10", "--at", PAGE("{n}"), "--again", "--json"], { env: CLAUDE });
    assert.deepEqual(r2.json.images.map((i: { again?: boolean }) => i.again), [true, true]);
  } finally {
    w.cleanup();
  }
});

test("several images: at most ten a call, the pages one each (or {n}), one site, never two images on one page — refused before anything is written", opts, async () => {
  const { w } = await research();
  try {
    const refused = async (args: string[], re: RegExp) => {
      const r = await w.run(["media", "save", "T1", ...args], { env: CLAUDE });
      assert.notEqual(r.code, 0, args.join(" "));
      assert.match(r.out + r.err, re);
    };
    assert.equal(SAVE_PAGES_MAX, 10);
    await refused(["--image", "1-11", "--at", PAGE("{n}")], /at most 10 images a call: 11 given/);
    await refused(["--image", "9-11", "--at", PAGE(9), "--at", PAGE(10)], /one --at each in their order, or one address with \{n\} .* 2 given/);
    await refused(["--image", "9,10", "--at", PAGE(9), "--at", "https://matriky.podhradi.example/kniha/1?n=10"], /one archive a call/);
    await refused(["--image", "9,10", "--at", PAGE(9), "--at", PAGE(9)], /one page each/);
    await refused(["--image", "9", "--at", PAGE(9), "--at", PAGE(10)], /one --at for one image/);
    assert.equal((await w.ok(["task", "show", "T1", "--json"])).json.task.state, "open", "nothing written");
    assert.equal(fs.existsSync(recordsFile(w)), false);
  } finally {
    w.cleanup();
  }
});

test("an image of the list whose page was not opened yet is not held back by the browser; once its tab shows it, or an image after it came, it is", opts, async () => {
  const { w, downloads } = await research();
  try {
    const r = await w.ok(["media", "save", "T1", "--image", "9-12", "--at", PAGE("{n}"), "--json"], { env: CLAUDE });
    assert.deepEqual(records(w).map((x) => [x.n, x.paged, x.order]), [[9, true, 0], [10, true, 1], [11, true, 2], [12, true, 3]]);
    // a minute on, nothing opened yet: nothing held back
    older(w, 60_000);
    await w.ok(["media", "add", "--inbox", "--waiting"], { env: { STROM_DOWNLOAD_WAIT_MS: "0" } });
    assert.deepEqual(records(w).filter((x) => x.held).map((x) => x.n), []);
    // the agent's tab on image 9's page (the hook let it go there) a minute ago: 9 held, the rest not opened
    const at = Math.max(...records(w).map((x) => x.at));
    fs.mkdirSync(path.join(w.cwd, ".strom", "metrics"), { recursive: true });
    fs.writeFileSync(path.join(w.cwd, ".strom", "metrics", CHROME_TABS), JSON.stringify({ "agent-1#7": { url: PAGE(9), host: "genbaza.pl", at: at + 1000 } }));
    await w.ok(["media", "add", "--inbox", "--waiting"], { env: { STROM_DOWNLOAD_WAIT_MS: "0" } });
    assert.deepEqual(records(w).filter((x) => x.held).map((x) => x.n), [9]);
    // image 11 came: 10 before it was opened too — held; 12 not yet
    assert.match(await tab(r.json.script, PAGE(11), downloads), /^strom-result 11:200:/);
    await w.ok(["media", "add", "--inbox", "--waiting"], { env: { STROM_DOWNLOAD_WAIT_MS: "0" } });
    assert.deepEqual(records(w).filter((x) => x.held && x.taken === undefined).map((x) => x.n).sort((a, b) => a - b), [9, 10]);
  } finally {
    w.cleanup();
  }
});

test("the script strom gives is compact: no comment lines, no indentation — and still saves (test/cli/media-save.test.ts runs it whole)", () => {
  const s = saveScript({ url: PAGE(9), n: 9, file: "strom-0000000a-T0001-0009", until: Date.now() + 60_000 });
  assert.equal(compactJs(s), s);
  assert.ok(!s.split("\n").some((l) => l.startsWith(" ") || l.startsWith("//")), "no indentation, no comment line");
  assert.ok(s.length < 14_000, `${s.length} characters`);
  assert.equal(compactJs("a\n  // note\n  b(); // kept: not a whole line\n\n"), "a\nb(); // kept: not a whole line");
});
