// An image saved from a zoomable viewer (OpenSeadragon) waits until the viewer says every tile is there — and the
// viewer says so only when it draws. A browser draws no frame of a tab behind another tab or in a window covered or
// minimized (a covered window's page may still be told it is "visible"): the tiles come, yet the viewer never says
// so. The waits count only the time the browser draws; no frame for 30 s is said as what it is, and drawing again
// goes on where it stopped. The tab is played here: its clock, its frames, a viewer that counts only when it draws.

import { test } from "node:test";
import assert from "node:assert/strict";
import { VIEWER_HIDDEN_MS, saveScript } from "../../src/core/browser.ts";

const URL0 = "https://archive.example/book/9001?image=lhota-0007.jp2";

interface Run {
  line: string;
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
async function tab(o: { draws: (t: number) => boolean; visibility?: (t: number) => string; stuck?: boolean; pagedAt?: number; cached?: boolean }): Promise<Run> {
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
  const arrive = () => {
    for (let i = jobs.length - 1; i >= 0; i--)
      if (jobs[i]! <= clock) {
        jobs.splice(i, 1);
        loaded++;
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
  class OSDViewer {
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
        need = o.cached ? 0 : 30;
        loaded = 0;
      },
      pixelFromPoint: (p: { x: number; y: number }) => ({ x: ((p.x - bounds.x) / bounds.w) * size.x, y: ((p.y - bounds.y) / bounds.h) * size.y }),
      goHome: () => undefined,
    };
    currentPage = () => page;
    addHandler = () => undefined;
    removeHandler = () => undefined;
  }
  const viewer = new OSDViewer();

  // a frame, if the browser draws now: the viewer draws (its own loop draws at every frame), then what the page asked of it
  const frame = () => {
    if (!o.draws(now())) return;
    const due = frames;
    frames = [];
    draw();
    for (const f of due) f();
  };
  // the tab's events: the waits of the script, and the browser's frames (every 16 ms, while it draws) — the clock goes
  // to the first of them once the script waits for something; meanwhile the tiles that came are there
  const FRAME = 16;
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
  const u = new URL(URL0);
  const script = saveScript({ url: URL0, file: "strom-T0007-0007", n: 7, until: start + 3_600_000 });
  const AsyncFunction = Object.getPrototypeOf(async () => undefined).constructor;
  const run = new AsyncFunction("location", "document", "URL", "setTimeout", "window", "requestAnimationFrame", "Date", `return ${script}`);
  const window = { OpenSeadragon: { Viewer: OSDViewer, version: { versionStr: "2.4.2" } }, viewer, devicePixelRatio: 1 };
  const line = await run({ origin: u.origin, pathname: u.pathname, search: u.search, hash: u.hash, href: URL0 }, document, URLs, setTimeout, window, requestAnimationFrame, { now: () => clock });
  return { line, saved, style, took: now() };
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
  assert.match(r.line, /^strom-result 7:failed — the viewer's tiles did not all come in 30 s \(all there no, requests open 1, tiles loading 1, tab visible, last frame 0(\.\d)? s ago, drawn 2000x1333 px, OpenSeadragon 2\.4\.2\)$/, r.line);
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
