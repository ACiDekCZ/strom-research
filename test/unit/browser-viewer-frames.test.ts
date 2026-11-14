// An image saved from a zoomable viewer (OpenSeadragon) waits until the viewer says every tile is there — and the
// viewer says so only when it draws. A browser draws no frame of a tab behind another tab or in a window covered or
// minimized (a covered window's page may still be told it is "visible"): the tiles come, yet the viewer never says
// so. The waits count only the time the browser draws; no frame for 30 s is said as what it is, and drawing again
// goes on where it stopped. The tab is played here: its clock, its frames, a viewer that counts only when it draws.

import { test } from "node:test";
import assert from "node:assert/strict";
import { TILE_QUIET_MS, TILE_RECENT_MS, VIEWER_HIDDEN_MS, WAIT_CALL_MS, saveScript } from "../../src/core/browser.ts";

const URL0 = "https://archive.example/book/9001?image=lhota-0007.jp2";

interface Run {
  line: string;
  /** Every answer of the calls of the script (browser.tileWait: run again while it answers strom-wait). */
  lines: string[];
  /** When each call ended, on the tab's clock (ms). */
  ends: number[];
  saved: string[];
  /** The viewer's element as the script left it. */
  style: string | null;
  /** How long the script ran on the tab's clock (ms). */
  took: number;
}

/**
 * The script run in a tab whose browser draws a frame at time t (ms from the start) only when `draws(t)` says so;
 * the page is told `visibility(t)`. The tab's clock goes from one event to the next: a frame the page asked for comes
 * at the browser's next frame (every 16 ms) while it draws, a wait of the script at its end. `stuck`: one tile never
 * comes. `pagedAt`: the viewer paged meanwhile. `cached`: the tiles of the image are all there already (one image whole).
 */
async function tab(o: {
  draws: (t: number) => boolean;
  visibility?: (t: number) => string;
  stuck?: boolean;
  pagedAt?: number;
  cached?: boolean;
  /** The tiles the view needs (default 30); the viewer asks one more at each frame, as OpenSeadragon does. */
  need?: number;
  /** browser.tileWait (ms): the script of that setting, run again while it answers strom-wait. */
  tileWaitMs?: number;
  /** After the first strom-wait: another script of strom in the same tab (image 8), not this one again. */
  other?: boolean;
  /** The page's address (default URL0). */
  url?: string;
  /**
   * The viewer bundled with the page's own code (no global OpenSeadragon): held by the page's React — 16 in a
   * useState, 18 in a useRef — reached from its container's element; "none": its container there, the viewer held
   * nowhere strom looks. With `global`: the page's global viewer beside another held by React.
   */
  held?: "react16" | "react18" | "none";
  global?: boolean;
}): Promise<Run & { used: string[] }> {
  const start = Date.parse("2026-11-10T09:30:00Z");
  let clock = start;
  const now = () => clock - start;
  let frames: (() => void)[] = [];
  const saved: string[] = [];
  const blobs = new Map<string, Blob>();

  // the viewer: what its element is given shows only once it draws; its tiles come by themselves (an image's load)
  let style: string | null = "width:100%;height:560px";
  let css = { w: 900, h: 560 };
  let size = { x: 900, y: 560 };
  let need = 0;
  let loaded = 0;
  let full = true;
  let page = 6;
  const jobs: number[] = [];
  const canvas = {
    width: 900,
    height: 560,
    clientWidth: 900,
    getContext: () => ({}),
  };
  let bounds = { x: 0, y: 0, w: 1, h: 1 };
  const rect = (x: number, y: number, w: number, h: number) => ({ x, y, w, h, getTopLeft: () => ({ x, y }), getBottomRight: () => ({ x: x + w, y: y + h }) });
  const item = {
    source: { dimensions: { x: 6000, y: 4000 } },
    getFullyLoaded: () => full,
    get _tilesLoading() {
      return jobs.length;
    },
    imageToViewportRectangle: (x: number, y: number, w: number, h: number) => rect(x / 6000, y / 6000, w / 6000, h / 6000),
  };
  const imageLoader = { jobsInProgress: 0 };
  // a frame: the size its element has now, one more tile asked for, and whether all are there — counted only here
  const draw = () => {
    size = { x: css.w, y: css.h };
    canvas.width = css.w;
    canvas.height = css.h;
    canvas.clientWidth = css.w;
    if (loaded + jobs.length < need) {
      jobs.push(o.stuck && loaded + jobs.length === need - 1 ? Infinity : clock + 40);
      imageLoader.jobsInProgress = jobs.length;
    }
    full = loaded >= need && jobs.length === 0;
  };
  // the viewer's events: a tile that came is said at once (the image's load, not a frame)
  const handlers = new Map<string, Set<() => void>>();
  const arrive = () => {
    for (let i = jobs.length - 1; i >= 0; i--)
      if (jobs[i]! <= clock) {
        jobs.splice(i, 1);
        loaded++;
        for (const h of handlers.get("tile-loaded") ?? []) h();
      }
    imageLoader.jobsInProgress = jobs.length;
  };
  const element = {
    getAttribute: () => style,
    setAttribute: (_: string, v: string) => {
      style = v;
      css = { w: 900, h: 560 };
    },
    removeAttribute: () => (style = null),
    style: {
      get cssText() {
        return style ?? "";
      },
      set cssText(v: string) {
        style = v;
        // the last of each counts, as in a browser
        const w = [...v.matchAll(/;width:(\d+)px/g)].at(-1);
        const h = [...v.matchAll(/;height:(\d+)px/g)].at(-1);
        if (w && h) css = { w: Number(w[1]), h: Number(h[1]) };
      },
    },
  };
  const used: string[] = [];
  class OSDViewer {
    name = "global";
    container: unknown = undefined;
    element = element;
    drawer = { canvas };
    imageLoader = imageLoader;
    tileSources = Array.from({ length: 20 }, (_, i) => `/tiles/${i + 1}.dzi`);
    world = { getItemAt: () => item, getItemCount: () => 1 };
    viewport = {
      getContainerSize: () => size,
      // the view changes at once; the viewer counts its tiles at its next frame
      fitBounds: (r: { x: number; y: number; w: number; h: number }) => {
        bounds = r;
        need = o.cached ? 0 : (o.need ?? 30);
        loaded = 0;
      },
      pixelFromPoint: (p: { x: number; y: number }) => ({ x: ((p.x - bounds.x) / bounds.w) * size.x, y: ((p.y - bounds.y) / bounds.h) * size.y }),
      goHome: () => undefined,
    };
    currentPage = () => page;
    addHandler = (name: string, h: () => void) => {
      if (!used.includes(this.name)) used.push(this.name);
      (handlers.get(name) ?? handlers.set(name, new Set()).get(name)!).add(h);
    };
    removeHandler = (name: string, h: () => void) => void handlers.get(name)?.delete(h);
  }
  const viewer = new OSDViewer();
  // the page's framework holding the viewer: OpenSeadragon's container inside the viewer's element, React's fiber of
  // that element (its key on it), up through the components to the one whose hooks hold the viewer
  const box = { className: "openseadragon-container", parentNode: element as unknown };
  const body = { parentNode: undefined };
  const held = o.held ? (o.global ? Object.assign(new OSDViewer(), { name: "held" }) : viewer) : undefined;
  if (o.held && held) {
    held.container = box;
    Object.assign(element, { parentNode: body });
    const hooks =
      o.held === "react16"
        ? { memoizedState: "lhota-0007", next: { memoizedState: false, next: { memoizedState: held, next: null } } }
        : o.held === "react18"
          ? { memoizedState: ["Lhota", []], next: { memoizedState: { current: held }, next: { memoizedState: 7, next: null } } }
          : { memoizedState: { current: null }, next: { memoizedState: "lhota-0007", next: null } };
    const root = { memoizedState: { element: {} }, stateNode: {}, memoizedProps: null, return: null };
    const component = { memoizedState: hooks, stateNode: null, memoizedProps: { pages: ["/tiles/1.dzi"] }, return: root };
    // React 18: a forwardRef between the element and the component holding it
    const wrapper = { memoizedState: null, stateNode: null, memoizedProps: { children: {} }, return: component };
    const host = { memoizedState: null, stateNode: element, memoizedProps: { className: "viewer" }, return: o.held === "react18" ? wrapper : component };
    Object.assign(element, { [o.held === "react16" ? "__reactInternalInstance$x1lhota" : "__reactFiber$y2lhota"]: host });
  }

  const FRAME = 16;
  // a frame, if the browser draws now: the viewer draws (its own loop draws at every frame), then what the page asked of it
  // (once a frame: a wait of the script ending within the same frame draws nothing more)
  let drawnAt = -Infinity;
  const frame = () => {
    if (!o.draws(now())) return;
    const due = frames;
    frames = [];
    if (clock - drawnAt >= FRAME) {
      drawnAt = clock;
      draw();
    }
    for (const f of due) f();
  };
  // the tab's events: the waits of the script, and the browser's frames (every 16 ms, while it draws) — the clock goes
  // to the first of them once the script waits for something; meanwhile the tiles that came are there
  let timers: { at: number; f: () => void }[] = [];
  let kicked = false;
  const step = () => {
    kicked = false;
    const next = timers.length ? timers.reduce((x, y) => (y.at < x.at ? y : x)) : undefined;
    // the browser's next frame before the next wait ends, if it draws then (none while it does not: only the wait);
    // nothing waited for (the script is over): a frame still asked for comes only if the browser draws within a minute
    let at: number | undefined;
    if (frames.length)
      for (let t = (Math.floor(clock / FRAME) + 1) * FRAME; t <= (next ? next.at : clock + 60_000); t += FRAME)
        if (o.draws(t - start)) {
          at = t;
          break;
        }
    let due: (() => void) | undefined;
    if (at !== undefined) clock = at;
    else if (next) {
      clock = next.at;
      timers = timers.filter((x) => x !== next);
      due = next.f;
    } else return;
    arrive();
    if (o.pagedAt !== undefined && now() >= o.pagedAt) page = 7;
    frame();
    due?.();
    kick();
  };
  const kick = () => {
    if (kicked) return;
    kicked = true;
    setImmediate(step);
  };
  const setTimeout = (f: () => void, ms: number) => {
    if (ms >= 60000) return; // a saved file's address let go later: not waited for
    timers.push({ at: clock + ms, f });
    kick();
  };
  // a frame asked comes at the browser's next frame, while it draws
  const requestAnimationFrame = (f: () => void) => {
    frames.push(f);
    kick();
  };
  const document = {
    get visibilityState() {
      return o.visibility ? o.visibility(now()) : o.draws(now()) ? "visible" : "hidden";
    },
    body: { appendChild: () => undefined },
    images: [],
    querySelectorAll: (sel: string) => (o.held && sel === ".openseadragon-container" ? [box] : []),
    createElement: (kind: string) => {
      if (kind === "canvas") {
        const c = { width: 0, height: 0, getContext: () => ({ drawImage: () => undefined }), toBlob: (cb: (b: Blob) => void) => cb(new Blob([new Uint8Array(c.width * 3)], { type: "image/jpeg" })) };
        return c;
      }
      const a = { href: "", download: "", remove: () => undefined, click: () => blobs.has(a.href) && saved.push(a.download) };
      return a;
    },
  };
  const URLs = { createObjectURL: (b: Blob) => (blobs.set(`blob:${blobs.size}`, b), `blob:${blobs.size - 1}`), revokeObjectURL: () => undefined };
  const href = o.url ?? URL0;
  const u = new URL(href);
  const opts = o.tileWaitMs !== undefined ? { tileWaitMs: o.tileWaitMs } : {};
  const script = saveScript({ url: href, file: "strom-T0007-0007", n: 7, task: "T0007", until: start + 3_600_000 }, opts);
  const AsyncFunction = Object.getPrototypeOf(async () => undefined).constructor;
  const window = o.held && !o.global ? { devicePixelRatio: 1 } : { OpenSeadragon: { Viewer: OSDViewer, version: { versionStr: "2.4.2" } }, viewer, devicePixelRatio: 1 };
  const call = (text: string) =>
    new AsyncFunction("location", "document", "URL", "setTimeout", "window", "requestAnimationFrame", "Date", `return ${text}`)(
      { origin: u.origin, pathname: u.pathname, search: u.search, hash: u.hash, href },
      document,
      URLs,
      setTimeout,
      window,
      requestAnimationFrame,
      { now: () => clock },
    ) as Promise<string>;
  // a call of the browser's tool at a time; the same script again while it answers strom-wait (or, once, another one)
  const lines: string[] = [];
  const ends: number[] = [];
  let next = script;
  for (let i = 0; i < 20; i++) {
    lines.push(await call(next));
    ends.push(now());
    if (!lines.at(-1)!.startsWith("strom-wait")) break;
    if (o.other && i === 0) next = saveScript({ url: href, file: "strom-T0007-0008", n: 8, until: start + 3_600_000 }, opts);
  }
  return { line: lines.at(-1)!, lines, ends, saved, style, took: now(), used };
}

test("a viewer's image in a tab the browser draws: saved once the viewer says every tile is there", async () => {
  const r = await tab({ draws: () => true });
  assert.match(r.line, /^strom-result 7:200:\d+$/);
  assert.deepEqual(r.saved, ["strom-T0007-0007.jpg"]);
  assert.equal(r.style, "width:100%;height:560px", "the viewer's element as it was");
  assert.ok(r.took < 10_000, `${r.took} ms`);
});

test("an image whole in the viewer already, in a tab the browser draws: saved as fast as before the waits counted frames — two frames are a few ms, not a look every 200 ms", async () => {
  const r = await tab({ draws: () => true, cached: true });
  assert.match(r.line, /^strom-result 7:200:\d+$/, r.line);
  assert.deepEqual(r.saved, ["strom-T0007-0007.jpg"]);
  // its own waits: the viewer's element resized (a look), 300 ms for the viewer to settle, two frames twice
  assert.ok(r.took < 700, `${r.took} ms`);
});

test("the browser stops drawing the tab mid-way (its window covered: the page is still told \"visible\") and draws it again 27 s later: the wait goes on, the image saved", async () => {
  // the tiles asked come meanwhile — the viewer would never say so without a frame: a wait of 30 s by the clock gave up here
  const r = await tab({ draws: (t) => t < 1000 || t > 28_000, visibility: () => "visible" });
  assert.match(r.line, /^strom-result 7:200:\d+$/, r.line);
  assert.deepEqual(r.saved, ["strom-T0007-0007.jpg"]);
  assert.ok(r.took > 28_000, `${r.took} ms: saved once the browser draws again`);
});

test("a tab the browser stops drawing for good (another tab in front): said as that after 30 s with no frame — not as tiles that did not come; nothing saved, the viewer as it was", async () => {
  assert.equal(VIEWER_HIDDEN_MS, 30_000);
  for (const visibility of [undefined, () => "visible"]) {
    const r = await tab({ draws: (t) => t < 1000, visibility });
    assert.match(r.line, /^strom-result 7:failed — the browser did not draw the tab with the viewer for 30 s — it draws nothing in a tab behind another tab or in a window covered or minimized/, r.line);
    assert.doesNotMatch(r.line, /tiles did not all come/);
    assert.deepEqual(r.saved, []);
    assert.equal(r.style, "width:100%;height:560px");
    assert.ok(r.took < 40_000, `${r.took} ms: no frame for 30 s in all, then given up`);
  }
  // no frame from the start (the tab behind another one already): given up as well, never waiting for ever
  const never = await tab({ draws: () => false });
  assert.match(never.line, /^strom-result 7:failed — the browser did not draw the tab/, never.line);
});

test("a tile that never comes while the browser draws: the 30 s wait says what the viewer said then — and no token a result could be taken for", async () => {
  const r = await tab({ draws: () => true, stuck: true });
  assert.match(r.line, /^strom-result 7:failed — the viewer's tiles did not all come in 30 s \(all there no, requests open 1, tiles loading 1, tab visible, last frame 0(\.\d)? s ago, drawn 2000x1333 px, OpenSeadragon 2\.4\.2\) — if they were still coming \(a browser that draws the tab slowly[^)]*\): strom config set browser\.tileWait 180, then the same strom command again for a new script, which waits while they come$/, r.line);
  // the line is read for its images: only image 7, failed
  assert.deepEqual(
    r.line
      .split(/\s+/)
      .filter((t) => /^\d+:(\d{3}|failed)/.test(t)),
    ["7:failed"],
  );
  assert.deepEqual(r.saved, []);
});

test("the viewer paged to another image while this one was waited for: nothing saved under this image's name", async () => {
  const r = await tab({ draws: (t) => t < 1000 || t > 5000, visibility: () => "visible", pagedAt: 3000 });
  assert.match(r.line, /^strom-result 7:failed — the viewer was paged to another image while this one was being saved — nothing saved/, r.line);
  assert.deepEqual(r.saved, []);
});

// A browser that draws the tab slowly — about a frame a second (seen with the browser an agent drives) — while the
// viewer asks one tile a frame: a page's tiles take longer than 30 s, though they keep coming. browser.tileWait (a
// setting strom suggests then) waits on while they come, over calls of the browser's tool; unset, all is as before.

const SLOW = (t: number) => t % 1000 < 16; // a frame a second

test("a browser drawing a frame a second, unset browser.tileWait: as before — after 30 s the tiles did not all come, with the setting suggested; nothing saved", async () => {
  const r = await tab({ draws: SLOW, visibility: () => "visible", need: 60 });
  assert.equal(r.lines.length, 1);
  assert.match(r.line, /^strom-result 7:failed — the viewer's tiles did not all come in 30 s \(all there no, .*\) — if they were still coming .*strom config set browser\.tileWait 180/, r.line);
  assert.deepEqual(r.saved, []);
  assert.ok(r.took < 40_000, `${r.took} ms`);
});

test("a browser drawing a frame a second, browser.tileWait 180: each call answers strom-wait in time, the same script again goes on, the image saved once", async () => {
  assert.equal(WAIT_CALL_MS, 35_000);
  const r = await tab({ draws: SLOW, visibility: () => "visible", need: 60, tileWaitMs: 180_000 });
  assert.ok(r.lines.length >= 2, r.lines.join("\n"));
  for (const l of r.lines.slice(0, -1)) {
    assert.match(l, /^strom-wait — the viewer's tiles still come in \(\d+ so far, \d+ s waited\): run this same script again in this tab/, l);
    // no token a result could be taken for
    assert.deepEqual(l.split(/\s+/).filter((t) => /^\d+:(\d{3}|failed)/.test(t)), []);
  }
  // each call ended before a browser tool's call is over (about 45 s)
  r.ends.forEach((end, i) => assert.ok(end - (i ? r.ends[i - 1]! : 0) < 41_000, `call ${i + 1}: ${end - (i ? r.ends[i - 1]! : 0)} ms`));
  assert.match(r.line, /^strom-result 7:200:\d+$/, r.line);
  assert.deepEqual(r.saved, ["strom-T0007-0007.jpg"]);
  assert.equal(r.style, "width:100%;height:560px", "the viewer's element as it was");
  assert.ok(r.took > 60_000, `${r.took} ms`);
});

test("browser.tileWait 180 where the browser draws at its pace: the same as unset — as fast, one call, no strom-wait", async () => {
  for (const cached of [false, true]) {
    const before = await tab({ draws: () => true, cached });
    const r = await tab({ draws: () => true, cached, tileWaitMs: 180_000 });
    assert.deepEqual(r.lines, [r.line]);
    assert.match(r.line, /^strom-result 7:200:\d+$/, r.line);
    assert.deepEqual(r.saved, ["strom-T0007-0007.jpg"]);
    assert.equal(r.took, before.took, `${r.took} ms against ${before.took} ms`);
  }
});

test("browser.tileWait 180, a tab the browser stops drawing for good: still said as not drawn — no strom-wait, nothing saved", async () => {
  const r = await tab({ draws: (t) => t < 1000, visibility: () => "visible", tileWaitMs: 180_000 });
  assert.deepEqual(r.lines, [r.line]);
  assert.match(r.line, /^strom-result 7:failed — the browser did not draw the tab with the viewer for 30 s/, r.line);
  assert.deepEqual(r.saved, []);
  assert.equal(r.style, "width:100%;height:560px");
});

test("browser.tileWait 180, a tile that never comes: no tile within the last 10 s when 30 s are over — over as unset, no strom-wait", async () => {
  assert.equal(TILE_RECENT_MS, 10_000);
  assert.equal(TILE_QUIET_MS, 30_000);
  const r = await tab({ draws: () => true, stuck: true, tileWaitMs: 180_000 });
  assert.deepEqual(r.lines, [r.line]);
  assert.match(r.line, /^strom-result 7:failed — the viewer's tiles did not all come in 30 s \(all there no, requests open 1, tiles loading 1, .*\)$/, r.line);
  assert.doesNotMatch(r.line, /browser\.tileWait/);
  assert.deepEqual(r.saved, []);
});

test("browser.tileWait 180, a frame a second and the viewer paged meanwhile: nothing saved under this image's name", async () => {
  const r = await tab({ draws: SLOW, visibility: () => "visible", need: 60, tileWaitMs: 180_000, pagedAt: 45_000 });
  assert.match(r.lines[0]!, /^strom-wait/);
  assert.match(r.line, /^strom-result 7:failed — the viewer was paged to another image while this one was being saved — nothing saved/, r.line);
  assert.deepEqual(r.saved, []);
});

test("browser.tileWait 180, another script of strom run in the tab while one waits: the one at work stops first (the viewer as it was), only the new one saves", async () => {
  const r = await tab({ draws: SLOW, visibility: () => "visible", need: 60, tileWaitMs: 180_000, other: true });
  assert.match(r.lines[0]!, /^strom-wait/);
  assert.match(r.line, /^strom-result 8:200:\d+$/, r.lines.join("\n"));
  assert.deepEqual(r.saved, ["strom-T0007-0008.jpg"]);
  assert.equal(r.style, "width:100%;height:560px");
});

test("a browser drawing a frame every 4 s while the tiles come: unset, said as not drawn after 30 s without frames, as before; browser.tileWait 180, waited on and saved", async () => {
  const draws = (t: number) => t % 4000 < 16;
  const before = await tab({ draws, visibility: () => "visible" });
  assert.match(before.line, /^strom-result 7:failed — the browser did not draw the tab with the viewer for 30 s/, before.line);
  assert.deepEqual(before.saved, []);
  const r = await tab({ draws, visibility: () => "visible", tileWaitMs: 180_000 });
  assert.match(r.lines[0]!, /^strom-wait/, r.lines[0]);
  assert.match(r.line, /^strom-result 7:200:\d+$/, r.lines.join("\n"));
  assert.deepEqual(r.saved, ["strom-T0007-0007.jpg"]);
});

// A viewer bundled with the page's own code (OpenSeadragon as a module of it): no global of it on the page's window, the
// instance held only by the page's framework (React). Found from its container's element, by its shape — the same
// mechanism saves from it; nothing asked of the archive. Two made-up archives of that kind.

const HELD_A = "https://archive.example/lhota/apu/4f1c/dao/9a2e/file/7b3d";
const HELD_B = "https://records.example/viewer/lhota-0007";

test("a viewer held by the page's React (16, in a component's state): found from its container and saved as from a global one", async () => {
  const r = await tab({ draws: () => true, held: "react16", url: HELD_A });
  assert.match(r.line, /^strom-result 7:200:\d+$/, r.line);
  assert.deepEqual(r.saved, ["strom-T0007-0007.jpg"]);
  assert.equal(r.style, "width:100%;height:560px", "the viewer's element as it was");
});

test("a viewer held by the page's React (18, in a ref of a component behind a forwardRef): found and saved, tiles waited for as ever", async () => {
  const r = await tab({ draws: () => true, held: "react18", url: HELD_B });
  assert.match(r.line, /^strom-result 7:200:\d+$/, r.line);
  assert.deepEqual(r.saved, ["strom-T0007-0007.jpg"]);
  const stuck = await tab({ draws: () => true, held: "react18", url: HELD_B, stuck: true });
  assert.match(stuck.line, /^strom-result 7:failed — the viewer's tiles did not all come in 30 s/, stuck.line);
});

test("an OpenSeadragon viewer on the page that strom cannot reach: said so, with what the person does instead — nothing saved", async () => {
  for (const url of [HELD_A, HELD_B]) {
    const r = await tab({ draws: () => true, held: "none", url });
    assert.equal(
      r.line,
      `strom: an OpenSeadragon viewer is on this page, but strom cannot reach it (not on the page's window, not held where strom looks) — nothing saved. T0007 waits for image 7 already: tell the user, in one sentence in the research language, which image of which book is needed and its link (${url}); the person saves it in their own browser — the viewer's own download button if it has one, else a screenshot of the image — into the task's folder of the inbox (strom task show T0007 names it). Never fetch the image's file yourself, never another image of the book; go on with other work — strom media add --inbox --waiting takes it once it is there`,
    );
    assert.deepEqual(r.saved, []);
    assert.deepEqual(r.used, []);
  }
});

test("a global viewer beside one the page's React holds: the global one, as before", async () => {
  const r = await tab({ draws: () => true, held: "react16", global: true, url: HELD_A });
  assert.match(r.line, /^strom-result 7:200:\d+$/, r.line);
  assert.deepEqual(r.used, ["global"]);
  const plain = await tab({ draws: () => true });
  assert.deepEqual(plain.used, ["global"]);
  assert.deepEqual(plain.saved, ["strom-T0007-0007.jpg"]);
});
