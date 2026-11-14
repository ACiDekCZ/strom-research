// strom media add --inbox --waiting and the images the agent's browser saved for waiting tasks (strom media save): two
// stroms taking them at the same moment (the bridge and the agent's own command) never meet a file gone under them —
// the one that comes second finds them taken; a download the browser is still writing (Chrome's .crdownload, Firefox's
// .part, a file written a moment ago) is waited for a moment and taken, or said as still being written, never "nothing
// came". Two synthetic archives of the same property (only a person's browser goes to them). No request leaves this
// computer.

import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import https from "node:https";
import http from "node:http";
import { World, hasGit } from "../helpers.ts";
import { SETTLE_MS } from "../../src/core/inboxwait.ts";
import { waitFileBase } from "../../src/core/browser.ts";
import { grantWay } from "../../src/core/terms.ts";
import { Tree } from "../../src/core/tree.ts";
import { takeWaiting } from "../../src/commands/media.ts";
import { takeError } from "../../src/core/live.ts";

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

const LHOTA = { host: "www.archiv-lhota.example", page: (book: number, n: number) => `https://www.archiv-lhota.example/kniha/${book}?snimek=${n}` };
const PODHRADI = { host: "matriky.podhradi.example", page: (book: number, n: number) => `https://matriky.podhradi.example/detail/${book}#${n}` };

function named(w: World, task: string, n: number): string {
  return waitFileBase((JSON.parse(fs.readFileSync(path.join(w.cwd, "strom.json"), "utf8")) as { id: string }).id, task, n);
}

/** A file the browser wrote `ago` ms ago. */
function written(file: string, ago: number, from = "grey.jpg"): void {
  fs.copyFileSync(path.join(fixtures, from), file);
  const at = new Date(Date.now() - ago);
  fs.utimesSync(file, at, at);
}

async function setup(w: World): Promise<{ downloads: string; shared: string }> {
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
  await w.ok(["task", "add", "Křest Jana", "--level", "link", "--where", "B1", "--why", "a", "--done-when", "b"]); // T1
  await w.ok(["task", "add", "Sňatek Jana", "--level", "link", "--where", "B2", "--why", "a", "--done-when", "b"]); // T2
  // this session's task is T1
  await w.ok(["session", "start", "T1"]);
  await w.ok(["media", "save", "T1", "--image", "5", "--at", LHOTA.page(11, 5)], { env: CLAUDE });
  await w.ok(["media", "save", "T2", "--image", "6", "--at", PODHRADI.page(22, 6)], { env: CLAUDE });
  return { downloads, shared: path.join(w.home, "shared") };
}

test("two stroms take the images of waiting tasks at once: the second finds them taken — nothing to take, never a file gone under it (two archives)", opts, async () => {
  const w = new World();
  try {
    const { downloads, shared } = await setup(w);
    written(path.join(downloads, `${named(w, "T0001", 5)}.jpg`), 2 * SETTLE_MS);
    written(path.join(downloads, `${named(w, "T0002", 6)}.jpg`), 2 * SETTLE_MS, "base420.jpg");
    // this strom looks at the folders; the other one (the bridge, the agent's own command) takes them just before this
    // one gets the research's lock
    const mine = Tree.open(w.cwd, w.env);
    const lock = mine.withTreeLock.bind(mine);
    let other: ReturnType<typeof takeWaiting> | undefined;
    mine.withTreeLock = <T>(fn: () => T): T => {
      other ??= takeWaiting(Tree.open(w.cwd, w.env), shared, { downloads });
      return lock(fn);
    };
    const got = takeWaiting(mine, shared, { downloads });
    assert.deepEqual(other!.map((t) => [t.recordset, t.added]).sort(), [["B0001", [5]], ["B0002", [6]]]);
    assert.deepEqual(got.flatMap((t) => t.added), [], "taken already: nothing more");
    assert.deepEqual(fs.readdirSync(downloads), []);
    // what the bridge logs of a strom of its: the error's own words (--json on stdout), never a bare exit code
    assert.equal(takeError('{"status":"error","message":"no such file or folder: /x/5.jpg"}', ""), "no such file or folder: /x/5.jpg");
    assert.equal(takeError("", "error: the research is busy\n→ again"), "the research is busy");
    assert.equal(takeError("", ""), undefined);
    assert.deepEqual(out, [], "nothing left this computer");
  } finally {
    w.cleanup();
  }
});

test("a download still being written is waited for a moment and taken; one not finished by then is said so, never \"nothing came\" (Chrome's .crdownload, Firefox's .part; two archives)", opts, async () => {
  const w = new World();
  try {
    const { downloads } = await setup(w);
    // written a moment ago (not settled yet): waited for, then taken — the first look after the script
    written(path.join(downloads, `${named(w, "T0001", 5)}.jpg`), SETTLE_MS - 800);
    const came = await w.ok(["media", "add", "--inbox", "--waiting"]);
    assert.match(came.out, /^B0001[^\n]*\/: images 5 of B0001 registered — back in the queue: T0001$/m, came.out);
    assert.doesNotMatch(came.out, /nothing of it came yet/);
    // the browsers still writing them (Chrome, Firefox): said as such after a short wait, nothing taken half
    await w.ok(["media", "save", "T2", "--image", "7", "--at", PODHRADI.page(22, 7)], { env: CLAUDE });
    written(path.join(downloads, `${named(w, "T0002", 6)}.jpg.crdownload`), 0);
    written(path.join(downloads, `${named(w, "T0002", 7)}.jpg.part`), 0);
    const r = await w.run(["media", "add", "--inbox", "--waiting", "--json"], { env: { STROM_DOWNLOAD_WAIT_MS: "300" } });
    assert.equal(r.code, 0, r.out + r.err);
    assert.deepEqual(
      (r.json.writing as { image: number }[]).sort((a, b) => a.image - b.image),
      [{ task: "T0002", image: 6, file: `${named(w, "T0002", 6)}.jpg.crdownload` }, { task: "T0002", image: 7, file: `${named(w, "T0002", 7)}.jpg.part` }],
    );
    const text = await w.ok(["media", "add", "--inbox", "--waiting"], { env: { STROM_DOWNLOAD_WAIT_MS: "300" } });
    assert.match(text.out, new RegExp(`^image 6 \\(T0002\\): its download is still being written in the downloads folder \\(${named(w, "T0002", 6)}\\.jpg\\.crdownload\\) — this command again in a few seconds takes it$`, "m"), text.out);
    assert.match(text.out, /^image 7 \(T0002\): its download is still being written .*\.jpg\.part\)/m);
    assert.doesNotMatch(text.out, /nothing of (it|them) came yet|⚠ image/, "neither nothing came nor held back");
    assert.equal((await w.ok(["task", "show", "T2", "--json"])).json.task.state, "waiting");
    assert.deepEqual(out, [], "nothing left this computer");
  } finally {
    w.cleanup();
  }
});
