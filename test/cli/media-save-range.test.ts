// A range of a book's images through the agent's browser in one script (strom media save --images; spec 132): only at
// an archive strom's list lets have it (a test's own list here: none of strom's own has it), only with the person's
// own consent for that archive (strom allow archive <host> --range — never the agent's), at times the limiter
// reserves at a person's pace, at most the list's cap a call, only the images the task needs; what stopped the script
// kept as the archive's refusal, the rest the person's. One image at a time (--image n) as before. No request leaves
// this computer.

import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import https from "node:https";
import http from "node:http";
import { World, hasGit, readJsonFile } from "../helpers.ts";
import { SETTLE_MS } from "../../src/core/inboxwait.ts";
import { waitFileBase } from "../../src/core/browser.ts";

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

// made-up archives only a person's browser goes to (the test's own list): one that may have a range (5 a call), one
// that may not, one by hand only; the book's page with its viewer
const RANGE = "archive.example";
const PLAIN = "podhradi.example";
const HAND = "lhotka.example";
const BOOK = (host: string, book: number) => `https://${host}/kniha/${book}`;

function named(w: World, task: string, n: number): string {
  return waitFileBase((JSON.parse(fs.readFileSync(path.join(w.cwd, "strom.json"), "utf8")) as { id: string }).id, task, n);
}

// scans of their own, one per image (the same scan twice is set aside as a wrong number)
const SCANS: Record<number, string> = { 3: "s0001.jpg", 4: "s0002.jpg", 5: "s0003.jpg", 6: "grey.jpg", 7: "cmyk.jpg", 8: "restart.jpg", 9: "base420.jpg", 20: "base444.jpg", 21: "prog420.jpg" };

function settled(file: string, n: number): void {
  fs.copyFileSync(path.join(fixtures, SCANS[n]!), file);
  const past = new Date(Date.now() - 2 * SETTLE_MS);
  fs.utimesSync(file, past, past);
}

async function setup(w: World): Promise<{ downloads: string; records: string }> {
  await w.withTree("Lhotákovi");
  const file = path.join(w.dir, "archives-test.json");
  fs.writeFileSync(
    file,
    JSON.stringify({
      archives: [
        { host: RANGE, name: "Archiv Lhota", level: "restricted", browserOnly: true, browserRange: { max: 5 }, checked: "2026-11-01" },
        { host: PLAIN, name: "Archiv Podhradí", level: "restricted", browserOnly: true, checked: "2026-11-01" },
        { host: HAND, name: "Archiv Lhotka", level: "manual", checked: "2026-11-01" },
      ],
    }),
  );
  w.env.STROM_ARCHIVES_FILE = file;
  await w.ok(["research", "new", "X", "--new-person", "Jan /Lhoták/"]);
  const downloads = path.join(w.dir, "Stažené soubory");
  fs.mkdirSync(downloads);
  await w.ok(["config", "set", "browser.downloads", downloads]);
  await w.ok(["recordset", "add", "Lhota N 1784–1820", "--url", BOOK(RANGE, 11)]); // B1
  await w.ok(["recordset", "add", "Podhradí N 1790–1830", "--url", BOOK(PLAIN, 22)]); // B2
  await w.ok(["recordset", "add", "Lhotka N 1790–1830", "--url", BOOK(HAND, 33)]); // B3
  await w.ok(["task", "add", "Křest Jana", "--level", "link", "--where", "B1", "--why", "a", "--done-when", "b"]); // T1
  await w.ok(["task", "add", "Křest Anny", "--level", "link", "--where", "B2", "--why", "a", "--done-when", "b"]); // T2
  await w.ok(["task", "add", "Křest Marie", "--level", "link", "--where", "B3", "--why", "a", "--done-when", "b"]); // T3
  return { downloads, records: path.join(w.cwd, ".strom", "browser-saves.json") };
}

const state = async (w: World, id: string) => (await w.ok(["task", "show", id, "--json"])).json.task;

test("a range only where strom's list lets the archive have it and the person consented to it for that archive — the agent never gives it; elsewhere one image at a time, by hand only as before", opts, async () => {
  const w = new World();
  try {
    await setup(w);
    // no permission "through the browser" yet: refused as one image is
    const unasked = await w.run(["media", "save", "T1", "--images", "3-7", "--at", BOOK(RANGE, 11)], { env: CLAUDE });
    assert.notEqual(unasked.code, 0);
    assert.match(unasked.err, /strom allow archive archive\.example --way browser — the person's, never yours/);
    await w.ok(["allow", "archive", RANGE, "--way", "browser"], { tty: true });
    // the permission through the browser, no consent to a range: refused, one image at a time
    const noRange = await w.run(["media", "save", "T1", "--images", "3-7", "--at", BOOK(RANGE, 11)], { env: CLAUDE });
    assert.notEqual(noRange.code, 0);
    assert.match(noRange.err, /the person has not consented to a range of Archiv Lhota's images through the browser \(strom allow archive archive\.example --range — the person's, never yours\): one image at a time/);
    assert.match(noRange.err, /strom media save T0001 --image <n>/);
    assert.equal((await state(w, "T1")).state, "open", "nothing written");
    // the consent is the person's: an agent asking with no terminal gets no yes
    const agent = await w.run(["allow", "archive", RANGE, "--range"], { env: CLAUDE });
    assert.equal(agent.code, 4, agent.out + agent.err);
    assert.equal(readJsonFile(path.join(w.env.STROM_CONFIG_DIR!, "archives.json")).archives[RANGE].range, undefined);

    // an archive strom's list gives no range: no consent to give, no range — one image at a time
    await w.ok(["allow", "archive", PLAIN, "--way", "browser"], { tty: true });
    const none = await w.run(["allow", "archive", PLAIN, "--range"], { tty: true });
    assert.notEqual(none.code, 0);
    assert.match(none.err, /Archiv Podhradí: strom's list gives it no range — its images through the browser one at a time/);
    const plain = await w.run(["media", "save", "T2", "--images", "3-7", "--at", BOOK(PLAIN, 22)], { env: CLAUDE });
    assert.notEqual(plain.code, 0);
    assert.match(plain.err, /Archiv Podhradí — one image at a time through your browser, no range: strom's list gives it none/);
    assert.match(plain.err, /strom media save T0002 --image <n> --at/);
    // by hand only: refused as one image is, word for word
    const one = await w.run(["media", "save", "T3", "--image", "3", "--at", BOOK(HAND, 33)], { env: CLAUDE });
    const range = await w.run(["media", "save", "T3", "--images", "3-4", "--at", BOOK(HAND, 33)], { env: CLAUDE });
    assert.notEqual(range.code, 0);
    assert.equal(range.err, one.err);
    assert.equal(range.code, one.code);

    // the person's consent, for this archive alone, besides "through the browser" — first that one, else refused
    const first = await w.run(["allow", "archive", RANGE, "--way", "manual"], { tty: true });
    assert.equal(first.code, 0, first.err);
    const notYet = await w.run(["allow", "archive", RANGE, "--range"], { tty: true });
    assert.match(notYet.err, /a range only besides the permission "through the browser"/);
    await w.ok(["allow", "archive", RANGE, "--way", "browser"], { tty: true });
    const yes = await w.ok(["allow", "archive", RANGE, "--range"], { tty: true });
    assert.match(yes.out, /✓ Archiv Lhota: rozsah snímků přes prohlížeč, nejvýš 5 najednou\. Vzít zpět: strom allow archive archive\.example --range --revoke\./);
    const kept = readJsonFile(path.join(w.env.STROM_CONFIG_DIR!, "archives.json")).archives as Record<string, { range?: { by: string } }>;
    assert.equal(kept[RANGE]!.range!.by, "terminal");
    assert.equal(kept[PLAIN]!.range, undefined, "for that archive alone");
    // another way, and it is gone; through the browser again — asked anew
    await w.ok(["allow", "archive", RANGE, "--way", "manual"], { tty: true });
    await w.ok(["allow", "archive", RANGE, "--way", "browser"], { tty: true });
    assert.match((await w.run(["media", "save", "T1", "--images", "3-7", "--at", BOOK(RANGE, 11)], { env: CLAUDE })).err, /has not consented to a range/);
    await w.ok(["allow", "archive", RANGE, "--range"], { tty: true });
    assert.equal((await w.ok(["media", "save", "T1", "--images", "3-7", "--at", BOOK(RANGE, 11), "--json"], { env: CLAUDE })).json.images.length, 5);
    // taken back: one at a time again, the way kept
    await w.ok(["allow", "archive", RANGE, "--range", "--revoke"], { tty: true });
    assert.match((await w.run(["media", "save", "T1", "--images", "8-9", "--at", BOOK(RANGE, 11)], { env: CLAUDE })).err, /has not consented to a range/);
    assert.equal(readJsonFile(path.join(w.env.STROM_CONFIG_DIR!, "archives.json")).archives[RANGE].way, "browser");
    assert.deepEqual(out, [], "nothing left this computer");
  } finally {
    w.cleanup();
  }
});

test("a range saved: the images the task needs at the limiter's slots (a person's pace, a second range after the first), at most the list's cap, registered ones left out; the files taken and the task back; what stopped the script kept as the archive's refusal, the rest the person's", opts, async () => {
  const w = new World();
  try {
    const { downloads, records } = await setup(w);
    await w.ok(["allow", "archive", RANGE, "--way", "browser"], { tty: true });
    await w.ok(["allow", "archive", RANGE, "--range"], { tty: true });

    // seven asked, five a call: 3–7 now, the rest by the same command again
    const r = await w.ok(["media", "save", "T1", "--images", "3-9", "--at", BOOK(RANGE, 11), "--json"], { env: CLAUDE });
    assert.deepEqual(r.json.images.map((i: { n: number }) => i.n), [3, 4, 5, 6, 7]);
    assert.deepEqual(r.json.images.map((i: { file: string }) => i.file), [3, 4, 5, 6, 7].map((n) => named(w, "T0001", n)));
    const at = r.json.images.map((i: { at: string }) => Date.parse(i.at));
    for (let i = 1; i < at.length; i++) assert.ok(at[i] - at[i - 1] >= 10_000, `${at[i] - at[i - 1]} ms apart`);
    assert.equal(r.json.rest, "8-9");
    assert.equal(r.json.then, "strom media add --inbox --waiting");
    assert.match(r.json.script, /window\.__stromResume/);
    assert.doesNotMatch(r.json.script, /Math\.random/, "no jitter");
    const text = await w.ok(["media", "save", "T1", "--images", "3-9", "--at", BOOK(RANGE, 11)], { env: CLAUDE });
    assert.match(text.out, /the rest, images 8–9: the same command again once these came \(at most 5 a call\)/);
    assert.match(text.out, /3\. strom media save T0001 --result "<its last answer, strom-result …>"/);
    assert.match(text.out, /never pass it, never try another way/);
    // the task waits for them all — the rest too, which the same command gives once these came
    const waiting = await state(w, "T1");
    assert.equal(waiting.state, "waiting");
    assert.equal(waiting.awaits.images, "3–9");
    // given again right after: the limiter's slots after those of the first
    const again = await w.ok(["media", "save", "T1", "--images", "3-7", "--at", BOOK(RANGE, 11), "--json"], { env: CLAUDE });
    assert.ok(Date.parse(again.json.images[0].at) >= at.at(-1) + 10_000, "after the first range's slots");

    // the five files come: taken — the task waits for the rest, the same command gives it
    for (const n of [3, 4, 5, 6, 7]) settled(path.join(downloads, `${named(w, "T0001", n)}.jpg`), n);
    const came = await w.ok(["media", "add", "--inbox", "--waiting"]);
    assert.match(came.out, /images 3–7 of B0001 registered/, came.out);
    assert.equal((await state(w, "T1")).awaits.images, "3–9");
    const rest = await w.ok(["media", "save", "T1", "--images", "3-9", "--at", BOOK(RANGE, 11), "--json"], { env: CLAUDE });
    assert.deepEqual(rest.json.images.map((i: { n: number }) => i.n), [8, 9]);
    assert.deepEqual(rest.json.registered, [3, 4, 5, 6, 7]);
    for (const n of [8, 9]) settled(path.join(downloads, `${named(w, "T0001", n)}.jpg`), n);
    const all = await w.ok(["media", "add", "--inbox", "--waiting"]);
    assert.match(all.out, /images 8–9 of B0001 registered — back in the queue: T0001/, all.out);
    assert.equal((await state(w, "T1")).state, "open");

    // only what the task needs: registered left out, and of a task that waits, only the images it waits for
    await w.ok(["task", "wait", "T1", "--images", "B1:10-11", "--on", "snímky 10–11 knihy Lhota"]);
    const next = await w.ok(["media", "save", "T1", "--images", "7-14", "--at", BOOK(RANGE, 11), "--json"], { env: CLAUDE });
    assert.deepEqual(next.json.images.map((i: { n: number }) => i.n), [10, 11]);
    assert.deepEqual(next.json.registered, [7, 8, 9]);
    assert.deepEqual(next.json.notWaited, [7, 8, 9, 12, 13, 14]);

    // the script stopped at image 11 by the archive's check whether a person is there: kept as its refusal — nothing
    // goes there meanwhile, through the agent's browser either; image 11 the person's, never said held back
    const stop = await w.ok(["media", "save", "T1", "--result", "strom-result 10:200:4096 11:check — image 11: the archive's check whether a person is there; …", "--json"]);
    assert.deepEqual(stop.json.saved, [10]);
    assert.deepEqual(stop.json.stopped, { n: 11, by: "check" });
    assert.deepEqual(stop.json.forPerson, [11]);
    assert.ok(stop.json.until);
    const said = await state(w, "T1");
    assert.equal(said.state, "waiting");
    assert.match(said.waitingOn, /^snímky 10–11 knihy B0001 Lhota N 1784–1820: archiv zastavil prohlížeč agenta u snímku 11 \(jeho kontrola, zda jde o člověka\) — uložit ručně z https:\/\/archive\.example\/kniha\/11 do složky úkolu; přes prohlížeč agenta na archive\.example nic nejde před /);
    const saves = readJsonFile(records) as unknown as { task: string; n: number }[];
    assert.deepEqual(saves.filter((s) => s.task === "T0001" && s.n >= 10).map((s) => s.n), [10]);
    const blocked = await w.run(["media", "save", "T1", "--image", "11", "--at", BOOK(RANGE, 11)], { env: CLAUDE });
    assert.notEqual(blocked.code, 0);
    assert.match(blocked.err, /archive\.example is left alone now — it showed the browser its check whether a person is there/);
    assert.deepEqual(out, [], "nothing left this computer");
  } finally {
    w.cleanup();
  }
});

test("a range stopped by the archive: every image left to the person said, those over the call's cap too; while the task waits for them, no other range of that archive for any task — its limiter's pause over or not", opts, async () => {
  const w = new World();
  try {
    const { downloads } = await setup(w);
    await w.ok(["allow", "archive", RANGE, "--way", "browser"], { tty: true });
    await w.ok(["allow", "archive", RANGE, "--range"], { tty: true });
    await w.ok(["task", "add", "Křest Josefa", "--level", "link", "--where", "B1", "--why", "a", "--done-when", "b"]); // T4

    // seven asked, five given (3–7), 8–9 the same command's later; stopped at image 5 by the archive's check
    const r = await w.ok(["media", "save", "T1", "--images", "3-9", "--at", BOOK(RANGE, 11), "--json"], { env: CLAUDE });
    assert.equal(r.json.rest, "8-9");
    const stop = await w.ok(["media", "save", "T1", "--result", "strom-result 3:200:4000 4:200:5000 5:check", "--json"], { env: CLAUDE });
    assert.deepEqual(stop.json.saved, [3, 4]);
    assert.deepEqual(stop.json.forPerson, [5, 6, 7, 8, 9], "those never given to the browser too");
    const waits = await state(w, "T1");
    assert.equal(waits.awaits.images, "3–9");
    assert.match(waits.waitingOn, /^snímky 3–9 knihy B0001/u);
    // said in words as well (a second answer of the same script: the same)
    const text = await w.ok(["media", "save", "T1", "--result", "strom-result 3:200:4000 4:200:5000 5:check"], { env: CLAUDE });
    assert.match(text.out, /Images 5–9 are the person's to save by hand — the task waits for them/u);

    // the limiter's pause over: still no other range of that archive while T1 waits for the person — of T1 or another
    const net = path.join(w.home, "shared", "net", `${RANGE}.json`);
    fs.writeFileSync(net, JSON.stringify({ ...readJsonFile(net), blockedUntil: Date.now() - 1000 }));
    for (const [task, images] of [["T1", "5-9"], ["T4", "20-21"]] as const) {
      const again = await w.run(["media", "save", task, "--images", images, "--at", BOOK(RANGE, 11)], { env: CLAUDE });
      assert.notEqual(again.code, 0, again.out);
      assert.match(again.err, /archive\.example stopped a range of your browser at image 5 for T0001 — T0001 waits for the person to save images 3–9 of B0001 by hand: no other range of archive\.example until then, for no task/u);
      assert.match(again.err, /tell the user which images wait for them \(strom task show T0001\)/u);
    }
    assert.equal((await state(w, "T4")).state, "open", "nothing written");

    // the person saved them (the browser's two came, the rest by hand into the task's folder): T1 back, a range again
    for (const n of [3, 4]) settled(path.join(downloads, `${named(w, "T0001", n)}.jpg`), n);
    const folder = path.join(w.home, "shared", "inbox", waits.awaits.folder);
    for (const n of [5, 6, 7, 8, 9]) settled(path.join(folder, `${n}.jpg`), n);
    const came = await w.ok(["media", "add", "--inbox", "--waiting"]);
    assert.match(came.out, /back in the queue: T0001/u, came.out);
    const next = await w.ok(["media", "save", "T4", "--images", "20-21", "--at", BOOK(RANGE, 11), "--json"], { env: CLAUDE });
    assert.deepEqual(next.json.images.map((i: { n: number }) => i.n), [20, 21]);
    assert.ok(!fs.existsSync(path.join(w.cwd, ".strom", "browser-stops.json")), "the stop forgotten once its task waits no more");
    assert.deepEqual(out, [], "nothing left this computer");
  } finally {
    w.cleanup();
  }
});

test("the file of the ranges stopped damaged: no range at any archive until the person looks at it, one image at a time as ever; a stop then leaves the file as it is", opts, async () => {
  const w = new World();
  try {
    await setup(w);
    await w.ok(["allow", "archive", RANGE, "--way", "browser"], { tty: true });
    await w.ok(["allow", "archive", RANGE, "--range"], { tty: true });
    const file = path.join(w.cwd, ".strom", "browser-stops.json");
    // not JSON, not a list, a stop without its host: each taken as every archive stopped
    for (const broken of ["{ not json", JSON.stringify({ task: "T0001" }), JSON.stringify([{ task: "T0001", recordset: "B0001", n: 5, at: 1 }])]) {
      fs.writeFileSync(file, broken);
      const r = await w.run(["media", "save", "T1", "--images", "3-5", "--at", BOOK(RANGE, 11)], { env: CLAUDE });
      assert.notEqual(r.code, 0, r.out);
      assert.match(r.err, /\.strom[\\/]browser-stops\.json, where strom keeps the ranges an archive stopped, cannot be read — which archive stopped one is not known, so no range through your browser at any archive until the person looks at it/u);
      assert.match(r.err, /tell the user: .*the person removes that file and ranges go on — meanwhile one image at a time: strom media save <task> --image <n>/u);
      assert.equal(fs.readFileSync(file, "utf8"), broken, "the file left as it was, for the person");
    }
    assert.equal((await state(w, "T1")).state, "open", "nothing written");
    // one image at a time is not held back by it
    const one = await w.ok(["media", "save", "T1", "--image", "4", "--at", `${BOOK(RANGE, 11)}?n=4`, "--json"], { env: CLAUDE });
    assert.equal(one.code, 0, one.err);
    // the person removed it: ranges go on
    fs.rmSync(file);
    const range = await w.ok(["media", "save", "T1", "--images", "3-5", "--at", BOOK(RANGE, 11), "--json"], { env: CLAUDE });
    assert.ok(range.json.images.length > 0, range.out);
    assert.deepEqual(out, [], "nothing left this computer");
  } finally {
    w.cleanup();
  }
});

test("one image at a time (--image n) as before, beside the consent to a range: the same script, the same data", opts, async () => {
  const w = new World();
  try {
    await setup(w);
    await w.ok(["allow", "archive", RANGE, "--way", "browser"], { tty: true });
    const before = await w.ok(["media", "save", "T1", "--image", "4", "--at", `${BOOK(RANGE, 11)}?n=4`, "--json"], { env: CLAUDE });
    await w.ok(["allow", "archive", RANGE, "--range"], { tty: true });
    const after = await w.ok(["media", "save", "T1", "--image", "4", "--at", `${BOOK(RANGE, 11)}?n=4`, "--json"], { env: CLAUDE });
    assert.deepEqual(Object.keys(after.json).sort(), ["file", "image", "recordset", "script", "task", "then", "url", "waits"]);
    const strip = (s: string) => s.replace(/"until":\d+/gu, "");
    assert.deepEqual({ ...after.json, script: strip(after.json.script) }, { ...before.json, script: strip(before.json.script) });
    assert.doesNotMatch(after.json.script, /__stromRange/);
    // a range and one image at once: one of them
    const both = await w.run(["media", "save", "T1", "--image", "4", "--images", "4-6", "--at", BOOK(RANGE, 11)], { env: CLAUDE });
    assert.match(both.err, /--images or --image: a range, or one image/);
  } finally {
    w.cleanup();
  }
});

test("the menu (a link of the app to an archive's question): the range offered only through the browser at an archive strom's list gives one, chosen there; with the consent valid, taken back there — the person's terminal, never the agent's", opts, async () => {
  const w = new World();
  try {
    await setup(w);
    // Claude Code does the research here (a stand-in on PATH): the browser is one of the ways
    const bin = path.join(w.dir, "bin");
    fs.mkdirSync(bin);
    fs.writeFileSync(path.join(bin, "claude"), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
    const env = { PATH: `${bin}${path.delimiter}${w.env.PATH}`, STROM_AGENT: "claude" };
    const id = (JSON.parse(fs.readFileSync(path.join(w.cwd, "strom.json"), "utf8")) as { id: string }).id;
    const open = (host: string, answers: string[], o: { tty?: boolean; env?: Record<string, string> } = {}) =>
      w.run(["link", "open", `strom-research://archive?tree=${id}&host=${host}`], { tty: o.tty ?? true, answers, env: { ...env, ...o.env } });
    const kept = () => readJsonFile(path.join(w.env.STROM_CONFIG_DIR!, "archives.json")).archives as Record<string, { way?: string; range?: { by: string } }>;
    const question = (out: string) => /[Jj]ak získávat snímky\?\n\n?((?: {2}\[\w+\] {2}[^\n]*\n|\n(?= {2}\[0\]))+)/u.exec(out)?.[1] ?? "";
    const RANGE_ON = /Navíc rozsah snímků přes prohlížeč \(nejvýš 5 najednou, jen tento archiv\)/u;
    const RANGE_OFF = /Rozsah snímků přes prohlížeč: vzít zpět – zase po jednom/u;

    // no way chosen yet: no range offered; through the browser chosen
    const first = await open(RANGE, ["1", ""]);
    assert.equal(first.code, 0, first.out + first.err);
    assert.match(question(first.out), / \[1\] {2}Přes prohlížeč na tomto počítači[^\n]*\n {2}\[2\] {2}Jen ručně[^\n]*\n\n {2}\[0\] {2}Zpět/u);
    assert.doesNotMatch(first.out, RANGE_ON);
    assert.equal(kept()[RANGE]!.way, "browser");
    assert.equal(kept()[RANGE]!.range, undefined, "the way alone gives no range");

    // through the browser at an archive strom's list gives a range: offered after the ways, chosen
    const on = await open(RANGE, ["4", ""]);
    assert.equal(on.code, 0, on.out + on.err);
    assert.match(question(on.out), / \[3\] {2}Zapomenout rozhodnutí[^\n]*\n {2}\[4\] {2}Navíc rozsah snímků přes prohlížeč \(nejvýš 5 najednou, jen tento archiv\)\n\n {2}\[0\] {2}Zpět/u);
    assert.match(on.out, /✓ Archiv Lhota: rozsah snímků přes prohlížeč, nejvýš 5 najednou\. Vzít zpět: strom allow archive archive\.example --range --revoke\./u);
    assert.equal(kept()[RANGE]!.range!.by, "terminal", "the person's, in the terminal");

    // the consent valid: taken back offered in its place, and taken back — the way kept
    const look = await open(RANGE, ["0", ""]);
    assert.match(question(look.out), / \[4\] {2}Rozsah snímků přes prohlížeč: vzít zpět – zase po jednom\n/u);
    assert.doesNotMatch(look.out, RANGE_ON);
    assert.equal(kept()[RANGE]!.range!.by, "terminal", "0: nothing changed");
    const off = await open(RANGE, ["4", ""]);
    assert.match(off.out, /✓ Archiv Lhota: snímky přes prohlížeč zase po jednom\./u);
    assert.equal(kept()[RANGE]!.range, undefined);
    assert.equal(kept()[RANGE]!.way, "browser");
    assert.match((await w.run(["media", "save", "T1", "--images", "3-7", "--at", BOOK(RANGE, 11)], { env: CLAUDE })).err, /has not consented to a range/u);

    // by hand at that archive: no range offered
    await open(RANGE, ["2", ""]);
    assert.equal(kept()[RANGE]!.way, "manual");
    const hand = await open(RANGE, ["0", ""]);
    assert.ok(question(hand.out), hand.out);
    assert.doesNotMatch(hand.out, RANGE_ON);
    assert.doesNotMatch(hand.out, RANGE_OFF);

    // through the browser at an archive strom's list gives no range: none offered
    await open(PLAIN, ["1", ""]);
    assert.equal(kept()[PLAIN]!.way, "browser");
    const plain = await open(PLAIN, ["0", ""]);
    assert.match(question(plain.out), / \[1\] {2}Přes prohlížeč[^\n]*\n {2}\[2\] {2}Jen ručně[^\n]*\n {2}\[3\] {2}Zapomenout rozhodnutí[^\n]*\n\n {2}\[0\] {2}Zpět/u);
    assert.doesNotMatch(plain.out, /rozsah snímků/iu);

    // the link opened with no terminal (an agent's shell): no question asked there, no consent
    await open(RANGE, ["1", ""]);
    const agent = await open(RANGE, ["4", ""], { tty: false, env: CLAUDE });
    assert.doesNotMatch(agent.out + agent.err, /[Jj]ak získávat snímky/u);
    assert.equal(kept()[RANGE]!.range, undefined, "no consent from the agent");
    assert.deepEqual(out, [], "nothing left this computer");
  } finally {
    w.cleanup();
  }
});
