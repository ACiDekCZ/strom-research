// strom media save --again: an image registered already, weak, saved once more through the agent's browser — a new copy
// beside it, nothing removed; the sharpest copy is the image (the same scan again: nothing sharper, the task back all
// the same). "registered already" offers it as the next step, and the brief offers it for weak scans of an archive the
// agent's browser saves images of, never a wait for the person. Two synthetic archives of the same property (only a
// person's browser goes to them). No request leaves this computer.

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
import { encodeImage } from "../../src/image/index.ts";
import { resize } from "../../src/image/image.ts";

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

/** A file the browser wrote `ago` ms ago. */
/**
 * A scan of a made-up page of a register (400 × 300: the form's lines, handwriting of its own seed) and a weak one of
 * it: the same picture at half its size, saved poorly (B0374: a sharper copy is of the same scan — strom tells it by the
 * handwriting).
 */
const scanDirs: string[] = [];
function scanOf(seed: number): { sharp: string; weak: string } {
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
  const img = { width, height, channels: 1 as const, data: d };
  const sharp = path.join(dir, `scan-${seed}.jpg`);
  const weak = path.join(dir, `weak-${seed}.jpg`);
  fs.writeFileSync(sharp, encodeImage(img, "jpeg", 90));
  fs.writeFileSync(weak, encodeImage(resize(img, width / 2, height / 2), "jpeg", 50));
  return { sharp, weak };
}

function written(file: string, ago: number, from = "grey.jpg"): void {
  fs.copyFileSync(path.resolve(fixtures, from), file);
  const at = new Date(Date.now() - ago);
  fs.utimesSync(file, at, at);
}

/** The agent's browser strom keeps: the Claude in Chrome extension in a profile of this computer's Chrome. */
function extension(w: World): void {
  const home = w.env.HOME!;
  const dir =
    process.platform === "darwin"
      ? path.join(home, "Library", "Application Support", "Google", "Chrome")
      : process.platform === "win32"
        ? path.join(w.env.LOCALAPPDATA ?? path.join(home, "AppData", "Local"), "Google", "Chrome", "User Data")
        : path.join(home, ".config", "google-chrome");
  fs.mkdirSync(path.join(dir, "Default", "Extensions", "fcoeoabgfenejglbffodgkkbkcdhcgfn"), { recursive: true });
}

const CASES = [
  { task: "T0001", book: "B0001", n: 5, at: LHOTA.page(11, 5), ...scanOf(1) },
  { task: "T0002", book: "B0002", n: 6, at: PODHRADI.page(22, 6), ...scanOf(2) },
] as const;

test("media save --again: a weak image saved once more — a new copy beside it, nothing removed, the sharpest the image; offered by \"registered already\" and the brief (two archives)", opts, async () => {
  const w = new World();
  try {
    await w.withTree("Lhotákovi");
    const file = path.join(w.dir, "archives-test.json");
    fs.writeFileSync(file, JSON.stringify({ archives: [LHOTA, PODHRADI].map((a) => ({ host: a.host, name: `Archiv ${a.host}`, level: "restricted", browserOnly: true, checked: "2026-11-01" })) }));
    w.env.STROM_ARCHIVES_FILE = file;
    assert.ok(grantWay(w.env, [LHOTA.host, PODHRADI.host], "browser", { by: "terminal" }));
    extension(w);
    await w.ok(["research", "new", "X", "--new-person", "Jan /Lhoták/"]);
    const downloads = path.join(w.dir, "Stažené soubory");
    fs.mkdirSync(downloads);
    await w.ok(["config", "set", "browser.downloads", downloads]);
    await w.ok(["recordset", "add", "Lhota N 1784–1820", "--url", LHOTA.page(11, 1)]); // B1
    await w.ok(["recordset", "add", "Podhradí N 1790–1830", "--url", PODHRADI.page(22, 1)]); // B2
    await w.ok(["task", "add", "Křest Jana", "--level", "link", "--where", "B1", "--why", "a", "--done-when", "b"]); // T1
    await w.ok(["task", "add", "Sňatek Jana", "--level", "link", "--where", "B2", "--why", "a", "--done-when", "b"]); // T2
    const state = async (t: string) => (await w.ok(["task", "show", t, "--json"])).json.task.state as string;
    const copies = async (book: string, n: number) =>
      ((await w.ok(["media", "list", "--recordset", book, "--json"])).json.media as { id: string; image: number; retracted?: boolean }[]).filter((m) => m.image === n);

    for (const c of CASES) {
      // the first, weak scan: saved, taken, the task back
      await w.ok(["media", "save", c.task, "--image", String(c.n), "--at", c.at], { env: CLAUDE });
      written(path.join(downloads, `${named(w, c.task, c.n)}.jpg`), 2 * SETTLE_MS, c.weak);
      const first = await w.ok(["media", "add", "--inbox", "--waiting"]);
      assert.notEqual(await state(c.task), "waiting", first.out);
      // once more without --again: refused, with the exact next step
      const r = await w.run(["media", "save", c.task, "--image", String(c.n), "--at", c.at, "--json"], { env: CLAUDE });
      assert.equal(r.code, 2, r.out + r.err);
      assert.equal(r.json.message, `image ${c.n} of ${c.book} is registered already`);
      assert.ok(String(r.json.hint).includes(`strom media save ${c.task} --image ${c.n} --recordset ${c.book} --at ${c.at} --again — a new copy beside it, nothing removed`), r.json.hint);
      // the brief: a weak scan of an archive the agent's browser saves images of — the image once more, never a wait
      const brief = (await w.ok(["brief", c.task], { env: CLAUDE })).out;
      assert.match(brief, new RegExp(String.raw`weak scans \(long side \d+ px\): a negative on them is weak — a sharper scan through your browser: strom media save ${c.task} --image <n> --recordset ${c.book} --at <the archive's page of that image> --again`), brief);
      assert.doesNotMatch(brief, /a sharper scan: ask the user/);
    }

    for (const c of CASES) {
      // a late copy of the first save lying there: tidied by the save once more, never taken for the new one
      written(path.join(downloads, `${named(w, c.task, c.n)} (1).jpg`), 2 * SETTLE_MS, c.weak);
      const again = await w.ok(["media", "save", c.task, "--image", String(c.n), "--recordset", c.book, "--at", c.at, "--json"].concat("--again"), { env: CLAUDE });
      assert.equal(again.json.again, true);
      assert.deepEqual(fs.readdirSync(downloads), []);
      assert.equal(await state(c.task), "waiting");
      // nothing came yet: what the task waits for is the new copy, though the image is registered
      const look = await w.ok(["media", "add", "--inbox", "--waiting", "--json"], { env: { STROM_DOWNLOAD_WAIT_MS: "0" } });
      assert.ok((look.json.waits as { task: string; missing: number[] }[]).some((x) => x.task === c.task && x.missing.includes(c.n)), JSON.stringify(look.json));
      assert.equal(await state(c.task), "waiting");
      // the sharper scan came: beside the first, the sharpest is the image, the task back
      written(path.join(downloads, `${named(w, c.task, c.n)}.jpg`), 2 * SETTLE_MS, c.sharp);
      const came = await w.ok(["media", "add", "--inbox", "--waiting"]);
      assert.match(came.out, new RegExp(`images ${c.n} of ${c.book} registered — back in the queue: ${c.task}`), came.out);
      assert.match(came.out, new RegExp(String.raw`${c.book}:${c.n} has 2 copies — M\d{4} 400×300 is the sharpest: it is the image now`), came.out);
      assert.notEqual(await state(c.task), "waiting");
      const both = await copies(c.book, c.n);
      assert.equal(both.length, 2, "nothing removed");
      assert.ok(both.every((m) => !m.retracted));
      assert.deepEqual(fs.readdirSync(downloads), []);
    }

    // once more, and the same scan comes: nothing sharper to have — the task back all the same, nothing registered twice
    for (const c of CASES) {
      await w.ok(["media", "save", c.task, "--image", String(c.n), "--recordset", c.book, "--at", c.at, "--again"], { env: CLAUDE });
      written(path.join(downloads, `${named(w, c.task, c.n)}.jpg`), 2 * SETTLE_MS, c.sharp);
      const same = await w.ok(["media", "add", "--inbox", "--waiting"]);
      assert.match(same.out, new RegExp(`nothing new \\(the same scans are registered\\) — back in the queue: ${c.task}`), same.out);
      assert.notEqual(await state(c.task), "waiting");
      assert.equal((await copies(c.book, c.n)).length, 2);
    }
    assert.deepEqual(out, [], "nothing left this computer");
  } finally {
    w.cleanup();
  }
});
