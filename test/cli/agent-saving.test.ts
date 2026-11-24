// Images the agent's own browser saves (strom media save) are the agent's work, not the person's: while an open session
// holds the task it is no item of What waits (nor counted there) and the Strom app is told it as work going on
// (working[].saving, saved k of n); an image the browser held back waits for the person — allowing the downloads of its
// site, said first; a session gone (nobody holds the task any more) waits for the person too — saving stopped at its
// image, how it goes on. All computed: a wait an older strom wrote shows so with no change. A scan saved once more with
// --again is taken as the image at once (the one there withdrawn and kept), never set aside to be decided with
// strom media aside --take; another file at that number is set aside as before. Two synthetic archives of the same
// property, no request leaves this computer.

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
import { Tree } from "../../src/core/tree.ts";
import { savedByAgentNow, waitingFor } from "../../src/core/waiting.ts";
import { savingView } from "../../src/core/ownsave.ts";
import { waitingForUser, waitingLines } from "../../src/commands/tasks.ts";
import { openSessions } from "../../src/core/session.ts";
import { holdFile } from "../../src/core/holds.ts";
import { encodeImage } from "../../src/image/index.ts";
import type { Media, Task } from "../../src/core/model.ts";

const opts = { skip: !hasGit };
const fixtures = path.join(import.meta.dirname, "..", "fixtures", "images");
const AGENT = { CLAUDECODE: "1", CLAUDE_CODE_SESSION_ID: "lhotak-ukládá" };

const out: string[] = [];
const keep = { request: https.request, get: https.get, hrequest: http.request, hget: http.get, fetch: globalThis.fetch };
const refuse = (u: unknown) => {
  out.push(String(u));
  throw new Error("no network in this test");
};
const scanDirs: string[] = [];
before(() => {
  (https as { request: unknown }).request = refuse;
  (https as { get: unknown }).get = refuse;
  (http as { request: unknown }).request = refuse;
  (http as { get: unknown }).get = refuse;
  globalThis.fetch = (u) => Promise.reject(refuse(u));
});
after(() => {
  for (const d of scanDirs) fs.rmSync(d, { recursive: true, force: true });
  Object.assign(https, { request: keep.request, get: keep.get });
  Object.assign(http, { request: keep.hrequest, get: keep.hget });
  globalThis.fetch = keep.fetch;
});

const LHOTA = { host: "www.archiv-lhota.example", page: (book: number, n: number) => `https://www.archiv-lhota.example/kniha/${book}?snimek=${n}` };
const PODHRADI = { host: "matriky.podhradi.example", page: (book: number, n: number) => `https://matriky.podhradi.example/detail/${book}#${n}` };

function named(w: World, task: string, n: number): string {
  return waitFileBase((JSON.parse(fs.readFileSync(path.join(w.cwd, "strom.json"), "utf8")) as { id: string }).id, task, n);
}

/** A file the browser finished saving a while ago. */
function settled(file: string, from: string): void {
  fs.copyFileSync(from, file);
  const past = new Date(Date.now() - 2 * SETTLE_MS);
  fs.utimesSync(file, past, past);
}

/** A scan of a made-up page of a register (the form's lines, handwriting of its own seed): two seeds, two scans. */
function scanOf(seed: number): string {
  const dir = fs.mkdtempSync(path.join(fs.realpathSync(process.env.TMPDIR ?? "/tmp"), "scan-"));
  scanDirs.push(dir);
  const width = 400;
  const height = 300;
  let s = seed;
  const r = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const d = new Uint8Array(width * height).fill(222);
  for (let y = 40; y < height; y += 30) for (let x = 20; x < width - 20; x++) d[y * width + x] = 70;
  for (let k = 0; k < 150; k++) {
    let x = 30 + r() * (width - 60);
    let y = 45 + r() * (height - 70);
    const dx = (r() - 0.5) * 3;
    const dy = (r() - 0.5) * 3;
    for (let i = 0; i < 15; i++) {
      x += dx + (r() - 0.5);
      y += dy + (r() - 0.5);
      const xi = Math.round(x);
      const yi = Math.round(y);
      if (xi > 0 && yi > 0 && xi < width - 1 && yi < height - 1) d[yi * width + xi] = d[yi * width + xi + 1] = 40;
    }
  }
  const file = path.join(dir, `scan-${seed}.jpg`);
  fs.writeFileSync(file, encodeImage({ width, height, channels: 1, data: d }, "jpeg", 90));
  return file;
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
  return { downloads, shared: path.join(w.home, "shared"), records: path.join(w.cwd, ".strom", "browser-saves.json") };
}

for (const a of [
  { name: "Lhota", archive: LHOTA, book: "B0001", page: (n: number) => LHOTA.page(11, n) },
  { name: "Podhradí", archive: PODHRADI, book: "B0002", page: (n: number) => PODHRADI.page(22, n) },
]) {
  test(`the agent's browser saving images (${a.name}): held by a live session — not in What waits, work going on (k of n); held back by the browser — waits for the person to allow the downloads; the session gone — saving stopped at its image`, opts, async () => {
    const w = new World();
    try {
      const { downloads, records } = await setup(w);
      await w.ok(["task", "add", "Křest Jana", "--level", "link", "--where", a.book, "--why", "a", "--done-when", "b"]); // T1
      const session = ((await w.ok(["session", "start", "T1", "--json"], { env: AGENT })).json.session as { id: string }).id;
      const state = async () => (await w.ok(["task", "show", "T1", "--json"])).json.task.state as string;
      const look = () => {
        const tree = Tree.open(w.cwd, w.env);
        const task = tree.get<Task>("T0001");
        const s = openSessions(tree).find((x) => x.id === session);
        const user = waitingForUser(tree).find((x) => x.id === "T0001");
        // the terminal's What waits (strom, strom trees, after a run) says the same
        const said = waitingLines(tree) ?? "";
        assert.equal(user !== undefined, said.includes("T0001"), said);
        return { item: waitingFor(tree).find((x) => x.task?.id === "T0001")?.item, now: savedByAgentNow(tree).has("T0001"), saving: s ? savingView(tree, s, task) : undefined, user };
      };

      // one image given to the agent's browser: the task waits for it — the agent's work, nothing for the person
      await w.ok(["media", "save", "T1", "--image", "5", "--at", a.page(5)], { env: AGENT });
      assert.equal(await state(), "waiting");
      let l = look();
      assert.equal(l.item, undefined, "not in What waits while its session holds it");
      assert.ok(l.now, "nor in a count of what waits");
      assert.equal(l.user, undefined, "nor in the terminal's What waits");
      assert.deepEqual(l.saving, { recordset: a.book, saved: 0, of: 1 });

      // it came: back at work, 1 of 1; the next one given: 1 of 2, still nothing for the person
      settled(path.join(downloads, `${named(w, "T0001", 5)}.jpg`), path.join(fixtures, "grey.jpg"));
      await w.ok(["media", "add", "--inbox", "--waiting"], { env: AGENT });
      assert.notEqual(await state(), "waiting");
      assert.deepEqual(look().saving, { recordset: a.book, saved: 1, of: 1 });
      await w.ok(["media", "save", "T1", "--image", "6", "--at", a.page(6)], { env: AGENT });
      l = look();
      assert.equal(l.item, undefined);
      assert.deepEqual(l.saving, { recordset: a.book, saved: 1, of: 2 });

      // the browser held image 6 back: the person's — to allow downloading several files from its site, said first
      const saves = readJsonFile(records) as unknown as { n: number; held?: boolean }[];
      fs.writeFileSync(records, JSON.stringify(saves.map((r) => (r.n === 6 ? { ...r, held: true } : r))));
      l = look();
      assert.ok(l.item, "waits for the person");
      assert.equal(l.user?.on, l.item.on, "the terminal says the same");
      assert.equal(l.now, false);
      assert.equal(l.saving, undefined, "no work going on: it waits for the person");
      // (the research's language: Czech)
      assert.match(String(l.item.on), new RegExp(`^v prohlížeči povolit stahování více souborů z webu ${a.archive.host.replace(/\./g, "\\.")} – .*: prohlížeč zadržel snímek 6 knihy ${a.book} `), String(l.item.on));

      // not held back after all, but the session gone (its agent's conversation ended mid-way, no sign of life since):
      // only now for the person — saving stopped at image 6, how it goes on
      fs.writeFileSync(records, JSON.stringify(saves));
      const hold = holdFile(w.cwd, session);
      const old = new Date(Date.now() - 3 * 24 * 3600_000);
      const h = readJsonFile(hold) as unknown as Record<string, unknown>;
      fs.writeFileSync(hold, JSON.stringify({ ...h, since: old.toISOString(), beat: old.toISOString() }));
      fs.utimesSync(hold, old, old);
      l = look();
      assert.ok(l.item, "nobody holds it: waits for the person");
      assert.equal(l.now, false);
      assert.match(String(l.item.on), new RegExp(`^ukládání přes prohlížeč agenta zastaveno na snímku 6 knihy ${a.book} .*: sezení agenta skončilo – pokračuje v něm příští sezení; nebo snímky 6 uložit ručně z `), String(l.item.on));
      assert.deepEqual(out, [], "nothing left this computer");
    } finally {
      w.cleanup();
    }
  });
}

test("media save --again: another scan saved once more is taken as the image at once — the one there withdrawn and kept, no media aside --take; another file at that number laid in the folder by hand is still set aside", opts, async () => {
  const w = new World();
  try {
    const { downloads, shared } = await setup(w);
    await w.ok(["task", "add", "Křest Jana", "--level", "link", "--where", "B1", "--why", "a", "--done-when", "b"]); // T1
    await w.ok(["session", "start", "T1"], { env: AGENT });
    const state = async () => (await w.ok(["task", "show", "T1", "--json"])).json.task.state as string;
    const copies = async () => Tree.open(w.cwd, w.env).list<Media>("media").filter((m) => m.recordset === "B0001" && m.image === 5);
    const first = scanOf(11);
    const other = scanOf(12);
    const third = scanOf(13);

    await w.ok(["media", "save", "T1", "--image", "5", "--at", LHOTA.page(11, 5)], { env: AGENT });
    settled(path.join(downloads, `${named(w, "T0001", 5)}.jpg`), first);
    await w.ok(["media", "add", "--inbox", "--waiting"], { env: AGENT });
    const was = (await copies())[0]!;

    // once more: another scan comes (the viewer's full resolution, another crop) — the image at once, nothing aside
    await w.ok(["media", "save", "T1", "--image", "5", "--recordset", "B1", "--at", LHOTA.page(11, 5), "--again"], { env: AGENT });
    settled(path.join(downloads, `${named(w, "T0001", 5)}.jpg`), other);
    const came = await w.ok(["media", "add", "--inbox", "--waiting"], { env: AGENT });
    assert.match(came.out, new RegExp(`saved once more, the new scan is the image: ${was.id} withdrawn \\(kept\\)`), came.out);
    assert.doesNotMatch(came.out, /media aside|other-than|not taken as a sharper copy/, came.out);
    assert.notEqual(await state(), "waiting");
    const both = await copies();
    assert.equal(both.length, 2, "the old one kept");
    const old = both.find((m) => m.id === was.id)!;
    assert.ok(old.retracted, "withdrawn");
    assert.match(JSON.stringify(old.retracted), /saved once more through the agent's browser for T0001 is the image/);
    assert.ok(both.some((m) => m.id !== was.id && !m.retracted), "the new scan is the image");
    const folder = fs.readdirSync(path.join(shared, "inbox")).find((f) => f.startsWith("B0001"));
    if (folder) assert.deepEqual(fs.readdirSync(path.join(shared, "inbox", folder)).filter((f) => f.includes("other-than")), []);

    // once more, but a file laid into the task's folder by hand (not the one the browser saved): set aside, as before
    await w.ok(["media", "save", "T1", "--image", "5", "--recordset", "B1", "--at", LHOTA.page(11, 5), "--again"], { env: AGENT });
    const dir = path.join(shared, "inbox", fs.readdirSync(path.join(shared, "inbox")).find((f) => f.startsWith("B0001"))!);
    settled(path.join(dir, "5.jpg"), third);
    const laid = await w.ok(["media", "add", "--inbox", "--waiting"], { env: AGENT });
    assert.match(laid.out, /media aside/, laid.out);
    assert.ok(fs.readdirSync(dir).some((f) => f.startsWith("5.jpg.other-than-")), "set aside, never taken");
    assert.equal((await copies()).filter((m) => !m.retracted).length, 1, "nothing else withdrawn");
    assert.deepEqual(out, [], "nothing left this computer");
  } finally {
    w.cleanup();
  }
});

test("the agent's own wait for an image its browser was to save (strom task wait --images, its words): the person's at once — in What waits with the agent's text while the session holds the task, no saving going on (R4)", opts, async () => {
  const w = new World();
  try {
    const { records } = await setup(w);
    await w.ok(["task", "add", "Křest Jana", "--level", "link", "--where", "B0001", "--why", "a", "--done-when", "b"]); // T1
    const session = ((await w.ok(["session", "start", "T1", "--json"], { env: AGENT })).json.session as { id: string }).id;
    await w.ok(["media", "save", "T1", "--image", "5", "--at", LHOTA.page(11, 5)], { env: AGENT });
    assert.ok(savedByAgentNow(Tree.open(w.cwd, w.env)).has("T0001"), "the agent's work while its browser saves it");
    // the page does not open in the agent's browser: the agent asks the person to save it by hand
    const words = "stránka archivu se v prohlížeči agenta neotevře: snímek 5 uložit ručně";
    await w.ok(["task", "wait", "T1", "--images", "B1:5", "--on", words], { env: AGENT });
    const tree = Tree.open(w.cwd, w.env);
    assert.equal(savedByAgentNow(tree).has("T0001"), false);
    const item = waitingFor(tree).find((x) => x.task?.id === "T0001");
    assert.ok(item, "in What waits while the session still holds the task");
    assert.equal(tree.get<Task>("T0001")!.waitingOn, words);
    assert.ok((waitingLines(tree) ?? "").includes("T0001"));
    const s = openSessions(tree).find((x) => x.id === session)!;
    assert.equal(savingView(tree, s, tree.get<Task>("T0001")), undefined, "no saving going on for the Strom app");
    const left = fs.existsSync(records) ? (readJsonFile(records) as unknown as { taken?: number }[]) : [];
    assert.deepEqual(left.filter((r) => r.taken === undefined), [], "the save given up, nothing waited for from the browser");
  } finally {
    w.cleanup();
  }
});
