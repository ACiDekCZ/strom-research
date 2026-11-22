// A range of a book's images saved through the archive's own viewer in the agent's tab (strom media save --images;
// spec 132): only where strom's list lets the archive have it (none of strom's own list yet), at most RANGE_MAX a call,
// image after image at the times the limiter reserved, stopped at the first image the archive does not give. The tab is
// played here: its clock, its frames, an OpenSeadragon viewer of a book's pages — never a network.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseRangeResult, rangeScript, WAIT_CALL_MS, type RangeItem } from "../../src/core/browser.ts";
import { RANGE_MAX, shippedTerms } from "../../src/core/knownterms.ts";
import { browserRangeOf } from "../../src/core/terms.ts";

const BOOK = "https://archive.example/book/9001";
const START = Date.parse("2026-11-10T09:30:00Z");

interface Tab {
  lines: string[];
  /** The files saved, with when (ms from the start). */
  saved: { name: string; at: number }[];
}

/**
 * The script run in a tab on `url` (default the book's page) whose viewer has `pages` pages. `refuse`: the archive's
 * answer to the browser at that image (n) — its viewer cannot open the page. `check`: the archive shows its check
 * whether a person is there at that image (the viewer shows nothing). The first call, then `await
 * window.__stromResume()` while it answers strom-wait.
 */
async function tab(items: RangeItem[], o: { pages?: number; url?: string; refuse?: { n: number; status: number }; check?: number; gap?: number } = {}): Promise<Tab> {
  let clock = START;
  let timers: { at: number; f: () => void }[] = [];
  let kicked = false;
  const step = () => {
    kicked = false;
    if (!timers.length) return;
    const next = timers.reduce((x, y) => (y.at < x.at ? y : x));
    timers = timers.filter((x) => x !== next);
    clock = Math.max(clock, next.at);
    next.f();
    kick();
  };
  const kick = () => {
    if (kicked) return;
    kicked = true;
    setImmediate(step);
  };
  const setTimeout = (f: () => void, ms: number) => {
    if (ms >= 60_000) return; // a saved file's address let go later: not waited for
    timers.push({ at: clock + ms, f });
    kick();
  };
  const requestAnimationFrame = (f: () => void) => setTimeout(f, 16);
  // the archive's answers to the browser, as performance keeps them
  const entries: { startTime: number; responseStatus: number }[] = [];
  const performance = { now: () => clock - START, getEntriesByType: () => entries };
  let checkShown = false;

  // the viewer: a book of `pages` pages, each whole at once (its tiles there), paged by goToPage
  let size = { x: 900, y: 560 };
  const canvas = { width: 900, height: 560, clientWidth: 900, getContext: () => ({}) };
  const rect = (x: number, y: number, w: number, h: number) => ({ x, y, w, h, getTopLeft: () => ({ x, y }), getBottomRight: () => ({ x: x + w, y: y + h }) });
  const newItem = () => ({ source: { dimensions: { x: 6000, y: 4000 } }, getFullyLoaded: () => true, imageToViewportRectangle: (x: number, y: number, w: number, h: number) => rect(x / 6000, y / 6000, w / 6000, h / 6000) });
  let item: ReturnType<typeof newItem> | undefined = newItem();
  let style: string | null = "width:100%;height:560px";
  const handlers = new Map<string, Set<() => void>>();
  const element = {
    getAttribute: () => style,
    setAttribute: (_: string, v: string) => ((style = v), (size = { x: 900, y: 560 })),
    removeAttribute: () => (style = null),
    style: {
      get cssText() {
        return style ?? "";
      },
      set cssText(v: string) {
        style = v;
        const w = [...v.matchAll(/;width:(\d+)px/g)].at(-1);
        const h = [...v.matchAll(/;height:(\d+)px/g)].at(-1);
        if (w && h) {
          size = { x: Number(w[1]), y: Number(h[1]) };
          canvas.width = canvas.clientWidth = size.x;
          canvas.height = size.y;
        }
      },
    },
  };
  let page = 0;
  class Viewer {
    element = element;
    drawer = { canvas };
    imageLoader = { jobsInProgress: 0 };
    tileSources = Array.from({ length: o.pages ?? 10 }, (_, i) => `/tiles/${i + 1}.dzi`);
    world = { getItemCount: () => (item ? 1 : 0), getItemAt: () => item };
    viewport = { getContainerSize: () => size, fitBounds: () => undefined, pixelFromPoint: (p: { x: number; y: number }) => ({ x: p.x * size.x, y: p.y * size.x }), goHome: () => undefined };
    currentPage = () => page;
    goToPage = (i: number) => {
      page = i;
      if (o.refuse?.n === i + 1) {
        entries.push({ startTime: clock - START, responseStatus: o.refuse.status });
        item = undefined;
        for (const h of handlers.get("open-failed") ?? []) h();
      } else if (o.check === i + 1) {
        item = undefined;
        checkShown = true;
      } else item = newItem();
    };
    addHandler = (name: string, h: () => void) => void (handlers.get(name) ?? handlers.set(name, new Set()).get(name)!).add(h);
    removeHandler = (name: string, h: () => void) => void handlers.get(name)?.delete(h);
  }
  const viewer = new Viewer();
  const saved: Tab["saved"] = [];
  const blobs = new Map<string, Blob>();
  const document = {
    visibilityState: "visible",
    body: { appendChild: () => undefined },
    images: [],
    querySelectorAll: () => [],
    querySelector: (sel: string) => (checkShown && sel.includes("altcha-widget") ? { tagName: "ALTCHA-WIDGET", getBoundingClientRect: () => ({ width: 0 }) } : null),
    createElement: (kind: string) => {
      if (kind === "canvas") {
        const c = { width: 0, height: 0, getContext: () => ({ drawImage: () => undefined }), toBlob: (cb: (b: Blob) => void) => cb(new Blob([new Uint8Array(c.width * 3)], { type: "image/jpeg" })) };
        return c;
      }
      const a = { href: "", download: "", remove: () => undefined, click: () => blobs.has(a.href) && saved.push({ name: a.download, at: clock - START }) };
      return a;
    },
  };
  const URLs = { createObjectURL: (b: Blob) => (blobs.set(`blob:${blobs.size}`, b), `blob:${blobs.size - 1}`), revokeObjectURL: () => undefined };
  const href = o.url ?? BOOK;
  const u = new URL(href);
  const window = { OpenSeadragon: { Viewer }, viewer, devicePixelRatio: 1 };
  const AsyncFunction = Object.getPrototypeOf(async () => undefined).constructor;
  const call = (text: string) =>
    new AsyncFunction("location", "document", "URL", "setTimeout", "window", "requestAnimationFrame", "Date", "performance", `return ${text}`)(
      { origin: u.origin, pathname: u.pathname, search: u.search, hash: u.hash, href },
      document,
      URLs,
      setTimeout,
      window,
      requestAnimationFrame,
      { now: () => clock },
      performance,
    ) as Promise<string>;
  const script = rangeScript({ url: BOOK, task: "T0007", until: START + 3_600_000, gap: o.gap ?? 10_000, items });
  const lines: string[] = [];
  let next = script;
  for (let i = 0; i < 40; i++) {
    lines.push(await call(next));
    if (!lines.at(-1)!.startsWith("strom-wait")) break;
    next = "await window.__stromResume()";
  }
  return { lines, saved };
}

/** Images a–z at the limiter's slots: the first 10 s from the start, one every 10 s. */
function plan(a: number, z: number, gap = 10_000): RangeItem[] {
  return Array.from({ length: z - a + 1 }, (_, i) => ({ n: a + i, file: `strom-3f2a9c1b-T0007-${String(a + i).padStart(4, "0")}`, at: START + (i + 1) * gap }));
}

test("a viewer of 10 pages: images 3–7 saved in order, each at its slot (10 s apart or more), the call answering strom-wait in time and the resume going on where it is", async () => {
  const r = await tab(plan(3, 7));
  const last = r.lines.at(-1)!;
  assert.match(last, /^strom-result 3:200:\d+ 4:200:\d+ 5:200:\d+ 6:200:\d+ 7:200:\d+$/u, last);
  assert.deepEqual(r.saved.map((s) => s.name), [3, 4, 5, 6, 7].map((n) => `strom-3f2a9c1b-T0007-${String(n).padStart(4, "0")}.jpg`));
  for (let i = 0; i < r.saved.length; i++) assert.ok(r.saved[i]!.at >= (i + 1) * 10_000, `image ${i + 3} at ${r.saved[i]!.at} ms`);
  for (let i = 1; i < r.saved.length; i++) assert.ok(r.saved[i]!.at - r.saved[i - 1]!.at >= 10_000, `${r.saved[i]!.at - r.saved[i - 1]!.at} ms apart`);
  // a call ends in time while it works: strom-wait, then the resume — each image once
  assert.ok(r.lines.length >= 2, "one call cannot hold 50 s");
  assert.match(r.lines[0]!, /^strom-wait — \d+ of 5 images saved so far.*await window\.__stromResume\(\)/u);
  assert.ok(WAIT_CALL_MS < 50_000);
  assert.deepEqual(parseRangeResult(last).map((x) => [x.n, x.status]), [[3, 200], [4, 200], [5, 200], [6, 200], [7, 200]]);
});

test("a viewer of one image a page: nothing saved, said as one image per page", async () => {
  const r = await tab(plan(3, 7), { pages: 1 });
  assert.match(r.lines.at(-1)!, /^strom: one image per page here — .*nothing saved.*strom media save T0007 --image <n>/u);
  assert.deepEqual(r.saved, []);
});

test("the archive refuses an image (HTTP 429, its viewer's page not opened): the script stops there — those before it saved, none after", async () => {
  const r = await tab(plan(3, 7), { refuse: { n: 5, status: 429 } });
  const last = r.lines.at(-1)!;
  assert.match(last, /^strom-result 3:200:\d+ 4:200:\d+ 5:429 — image 5: the archive answered HTTP 429/u, last);
  assert.deepEqual(r.saved.map((s) => s.name), ["strom-3f2a9c1b-T0007-0003.jpg", "strom-3f2a9c1b-T0007-0004.jpg"]);
  const got = parseRangeResult(last);
  assert.deepEqual(got.at(-1), { n: 5, status: 429 });
  // an expired page (410): stopped the same
  const gone = await tab(plan(3, 4), { refuse: { n: 3, status: 410 } });
  assert.match(gone.lines.at(-1)!, /^strom-result 3:410 — image 3/u);
  assert.deepEqual(gone.saved, []);
});

test("the archive's check whether a person is there at an image: stopped there, said as its check — never passed", async () => {
  const r = await tab(plan(3, 6), { check: 4 });
  const last = r.lines.at(-1)!;
  assert.match(last, /^strom-result 3:200:\d+ 4:check — image 4: the archive's check whether a person is there/u, last);
  assert.deepEqual(r.saved.map((s) => s.name), ["strom-3f2a9c1b-T0007-0003.jpg"]);
  assert.deepEqual(parseRangeResult(last).at(-1), { n: 4, stop: "check" });
});

test("a tab on another page than the book's: nothing done", async () => {
  const r = await tab(plan(3, 4), { url: "https://archive.example/book/9002" });
  assert.match(r.lines.at(-1)!, /^strom: this tab is not on the book's page — open https:\/\/archive\.example\/book\/9001/u);
  assert.deepEqual(r.saved, []);
});

test("the results a range's script returns, as strom media save --result reads them", () => {
  assert.deepEqual(parseRangeResult('"strom-result 40:200:412918 41:200:398112 42:login — image 42: …"'), [
    { n: 40, status: 200, bytes: 412918 },
    { n: 41, status: 200, bytes: 398112 },
    { n: 42, stop: "login" },
  ]);
  assert.deepEqual(parseRangeResult("strom-result 7:failed — image 7: the viewer did not show page 7 in 30 s"), [{ n: 7, failed: true }]);
  assert.deepEqual(parseRangeResult("strom: one image per page here"), []);
});

test("no archive of strom's own list has a range of images through the browser; a test's own list gives one only to hosts strom's own says nothing of, never above the cap", () => {
  assert.equal(shippedTerms().filter((k) => k.browserRange !== undefined).map((k) => k.host).join(", "), "", "strom's own list: no browserRange");
  assert.equal(browserRangeOf({}, "www.mza.cz"), undefined);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strom-range-"));
  try {
    const file = path.join(dir, "archives.json");
    fs.writeFileSync(
      file,
      JSON.stringify({
        archives: [
          { host: "archive.example", level: "restricted", browserOnly: true, browserRange: { max: 50 } },
          { host: "small.example", level: "restricted", browserOnly: true, browserRange: { max: 5 } },
          { host: "one.example", level: "restricted", browserOnly: true, browserRange: { max: 1 } },
          { host: "plain.example", level: "restricted", browserOnly: true },
          { host: "genbaza.pl", level: "restricted", browserOnly: true, browserRange: {} },
          { host: "mza.cz", level: "restricted", browserRange: {} },
        ],
      }),
    );
    const env = { STROM_ARCHIVES_FILE: file, STROM_CONFIG_DIR: dir, STROM_ISOLATED: "1" };
    assert.equal(browserRangeOf(env, "archive.example"), RANGE_MAX, "never above the cap");
    assert.equal(RANGE_MAX, 20);
    assert.equal(browserRangeOf(env, "small.example"), 5);
    assert.equal(browserRangeOf(env, "one.example"), undefined, "one at a time is no range");
    assert.equal(browserRangeOf(env, "plain.example"), undefined);
    assert.equal(browserRangeOf(env, "genbaza.pl"), undefined, "strom's own list says what holds there");
    assert.equal(browserRangeOf(env, "www.mza.cz"), undefined, "strom's own list says what holds there");
    assert.equal(browserRangeOf({ STROM_ARCHIVES_FILE: file }, "archive.example"), undefined, "never without settings of its own");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("the limiter: a range's slots never faster than a person's pace (10 s, 120 an hour), a host's own faster pace notwithstanding; what stopped a range leaves the host alone", async () => {
  const { browserStopped, HUMAN_PACE, reserveSlots } = await import("../../src/core/net.ts");
  const { hostBlocked } = await import("../../src/core/webgate.ts");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strom-range-net-"));
  try {
    // the person's own pace for the host, faster than a person's: the range keeps to 10 s all the same
    fs.writeFileSync(path.join(dir, "archive.example.json"), JSON.stringify({ recent: [], own: { minIntervalMs: 2000, perHour: 1000 } }));
    const asked = { ...HUMAN_PACE, source: "a person's pace (strom media save --images)" };
    const first = reserveSlots(dir, "archive.example", asked, 5, { human: HUMAN_PACE, now: () => START });
    assert.equal(first.length, 5);
    for (let i = 1; i < first.length; i++) assert.ok(first[i]! - first[i - 1]! >= 10_000, `${first[i]! - first[i - 1]!} ms`);
    const second = reserveSlots(dir, "archive.example", asked, 5, { human: HUMAN_PACE, now: () => START + 1000 });
    assert.ok(second[0]! >= first.at(-1)! + 10_000, "a second range after the first");

    // a check whether a person is there, a login, busy, slow down: an hour; a refusal: a day
    for (const [host, what, hours] of [["a.example", "check", 1], ["b.example", "login", 1], ["c.example", 503, 1], ["d.example", 429, 1], ["e.example", 403, 24]] as const) {
      const said = browserStopped(dir, host, what, () => START);
      assert.match(said, /— strom leaves it alone until /u);
      assert.equal(hostBlocked(dir, host, START)!.until, START + hours * 3600_000, `${host} ${what}`);
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
