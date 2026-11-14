// The connector of ACTA PUBLICA (the Moravian Land Archives' parish registers; test/fixtures/connectors/actapublica-mza):
// the archive lets an image be saved only by the standard means of a browser, so every page the connector reads comes
// through the person's browser (browser.pages) and each image is saved from the archive's own viewer in the person's
// tab (browser.viewer "openseadragon") — paged through, never reloaded, never its tiles or image server asked by strom.
// The pages are recorded (made up in the archive's markup); the tab is played here: its fetch serves them, its viewer
// is a stand-in of OpenSeadragon's. No request leaves this computer.

import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import https from "node:https";
import http2 from "node:http2";
import { World, hasGit, pluginDir, readJsonFile } from "../helpers.ts";
import { testHooks } from "../../src/core/net.ts";

const opts = { skip: !hasGit };
const fixture = path.join(import.meta.dirname, "..", "fixtures", "connectors", "actapublica-mza");
const recorded = path.join(fixture, "recorded");
const scans = path.join(import.meta.dirname, "..", "fixtures", "images");
const pages = readJsonFile(path.join(recorded, "index.json")) as Record<string, string>;

// nothing of this test reaches the archive: every way out of the process is watched
const out: string[] = [];
const keep = { request: https.request, get: https.get, connect: http2.connect, fetch: globalThis.fetch };
let ahead = 0;
before(() => {
  (https as { request: unknown }).request = (...a: unknown[]) => (out.push(String(a[0])), keep.request.apply(https, a as never));
  (https as { get: unknown }).get = (...a: unknown[]) => (out.push(String(a[0])), keep.get.apply(https, a as never));
  (http2 as { connect: unknown }).connect = (...a: unknown[]) => (out.push(String(a[0])), keep.connect.apply(http2, a as never));
  globalThis.fetch = (u, i) => (out.push(String(u)), keep.fetch(u, i));
  testHooks.now = () => Date.now() + ahead;
  testHooks.sleep = async (ms) => {
    ahead += ms;
  };
});
after(() => {
  Object.assign(https, { request: keep.request, get: keep.get });
  (http2 as { connect: unknown }).connect = keep.connect;
  globalThis.fetch = keep.fetch;
  testHooks.now = undefined;
  testHooks.sleep = undefined;
});

/** The connector installed as a person installs it: its folder, strom's own SDK beside it. */
function install(w: World): string {
  const dir = pluginDir(w, "actapublica-mza");
  fs.mkdirSync(dir, { recursive: true });
  for (const f of ["connector.json", "connector.ts"]) fs.copyFileSync(path.join(fixture, f), path.join(dir, f));
  fs.copyFileSync(path.join(import.meta.dirname, "..", "..", "assets", "plugins", "connectors", "sdk.ts"), path.join(dir, "sdk.ts"));
  return dir;
}

/** A stand-in of OpenSeadragon's viewer on the book's page: its pages, what it draws, what the script asked of it. */
interface Viewer {
  pages: number;
  /** Its page shows nothing yet (the check whether a person is there not passed). */
  blank?: boolean;
  /** Its page opened long ago: the addresses of its images expired, a page asked for does not open (410). */
  gone?: boolean;
  /** The pages it was asked to show, the sizes it was given, the canvases cut out of it. */
  shown: number[];
  sizes: { w: number; h: number }[];
  cuts: { w: number; h: number }[];
}

/**
 * The script strom gives the agent, run as a tab of the archive runs it: on `href`, its fetch answering the recorded
 * pages (every other address refused, and said), its downloads written into the folder, its waits counted, not slept.
 */
async function tab(script: string, href: string, downloads: string, viewer?: Viewer): Promise<{ line: string; asked: string[] }> {
  const asked: string[] = [];
  const blobs = new Map<string, Blob>();
  const saves: Promise<void>[] = [];
  let clock = Date.now() + ahead;
  // a wait passes at once, counted on the tab's clock (the minute after which a saved file's address is let go: not counted)
  const later = (f: () => void, ms: number) => (ms < 60000 && (clock += ms), f());
  const fetch = async (u: string) => {
    asked.push(u);
    const file = pages[u];
    if (!file) return { ok: false, status: 404, url: u, headers: new Headers(), arrayBuffer: async () => new ArrayBuffer(0), blob: async () => new Blob([]) };
    const body = fs.readFileSync(path.join(recorded, file));
    return { ok: true, status: 200, url: u, headers: new Headers({ "content-type": "text/html; charset=utf-8" }), arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.length), blob: async () => new Blob([body]) };
  };
  // the viewer's element and canvas: as large as the script makes the element
  let css = { w: 900, h: 600 };
  let style: string | null = "width:100%";
  const dpr = 2;
  const element = {
    getAttribute: () => style,
    setAttribute: (_: string, v: string) => (style = v),
    removeAttribute: () => (style = null),
    style: {
      get cssText() {
        return style ?? "";
      },
      set cssText(v: string) {
        style = v;
        const w = /;width:(\d+)px/.exec(v);
        const h = /;height:(\d+)px/.exec(v);
        if (w && h) {
          css = { w: Number(w[1]), h: Number(h[1]) };
          viewer?.sizes.push(css);
        }
      },
    },
  };
  let page = 0;
  let item: object | undefined = viewer && !viewer.blank ? { page: 0 } : undefined;
  let bounds = { x: 0, y: 0, w: 1, h: 1 };
  const scan = () => fs.readFileSync(path.join(scans, `s000${(page % 3) + 1}.jpg`));
  const rect = (x: number, y: number, w: number, h: number) => ({ x, y, w, h, getTopLeft: () => ({ x, y }), getBottomRight: () => ({ x: x + w, y: y + h }) });
  class OSDViewer {
    tileSources = Array.from({ length: viewer?.pages ?? 0 }, (_, i) => `/iip-srv/iipsrv.fcgi/1/x?Deepzoom=/srv/${i + 1}.jp2.dzi`);
    element = element;
    drawer = {
      canvas: {
        get width() {
          return css.w * dpr;
        },
        get height() {
          return css.h * dpr;
        },
        get clientWidth() {
          return css.w;
        },
        getContext: () => ({}),
      },
    };
    imageLoader = { jobsInProgress: 0 };
    world = {
      getItemAt: () => item && { ...item, source: { dimensions: { x: 3000, y: 2000 } }, getFullyLoaded: () => true, imageToViewportRectangle: (x: number, y: number, w: number, h: number) => rect(x / 3000, y / 3000, w / 3000, h / 3000) },
      getItemCount: () => (item ? 1 : 0),
    };
    viewport = {
      getContainerSize: () => ({ x: css.w, y: css.h }),
      fitBounds: (r: { x: number; y: number; w: number; h: number }) => (bounds = r),
      pixelFromPoint: (p: { x: number; y: number }) => ({ x: ((p.x - bounds.x) / bounds.w) * css.w, y: ((p.y - bounds.y) / bounds.h) * css.h }),
      goHome: () => undefined,
    };
    currentPage = () => page;
    handlers = new Map<string, () => void>();
    goToPage = (i: number) => {
      page = i;
      viewer!.shown.push(i + 1);
      item = viewer!.blank || viewer!.gone ? undefined : { page: i };
      if (viewer!.gone) this.handlers.get("open-failed")?.();
    };
    addHandler = (name: string, f: () => void) => this.handlers.set(name, f);
    removeHandler = (name: string) => this.handlers.delete(name);
  }
  const v = viewer ? new OSDViewer() : undefined;
  const window = { OpenSeadragon: viewer ? { Viewer: OSDViewer } : undefined, viewer: v, devicePixelRatio: dpr };
  const document = {
    body: { appendChild: () => undefined },
    images: [],
    createElement: (kind: string) => {
      if (kind === "canvas") {
        const c = {
          width: 0,
          height: 0,
          getContext: () => ({ drawImage: () => undefined }),
          toBlob: (cb: (b: Blob) => void) => (viewer?.cuts.push({ w: c.width, h: c.height }), cb(new Blob([scan()], { type: "image/jpeg" }))),
        };
        return c;
      }
      const a = {
        href: "",
        download: "",
        remove: () => undefined,
        click: () => {
          const blob = blobs.get(a.href)!;
          saves.push((async () => fs.writeFileSync(path.join(downloads, a.download), Buffer.from(await blob.arrayBuffer())))());
        },
      };
      return a;
    },
  };
  const URLs = { createObjectURL: (b: Blob) => (blobs.set(`blob:${blobs.size}`, b), `blob:${blobs.size - 1}`), revokeObjectURL: () => undefined };
  const u = new URL(href);
  const AsyncFunction = Object.getPrototypeOf(async () => undefined).constructor;
  const run = new AsyncFunction("location", "fetch", "document", "URL", "setTimeout", "window", "requestAnimationFrame", "Date", `return ${script}`);
  const line = await run({ origin: u.origin, pathname: u.pathname, href }, fetch, document, URLs, later, window, (f: () => void) => f(), { now: () => clock });
  await Promise.all(saves);
  return { line, asked };
}

/** Pages planned for the connector, taken one after the other until it got what it needed: the last answer. */
async function throughPages(w: World, args: string[], downloads: string): Promise<{ json: any; asked: string[] }> {
  let r = (await w.ok([...args, "--json"])).json;
  const asked: string[] = [];
  for (let i = 0; r.plan?.pages?.length && i < 10; i++) {
    const t = await tab(r.script, "https://www.mza.cz/robots.txt", downloads);
    asked.push(...t.asked);
    const taken = (await w.ok(["fetch", "actapublica-mza", "--take", "--result", t.line, "--json"])).json;
    r = taken.then ?? taken;
  }
  return { json: r, asked };
}

test("ACTA PUBLICA: the catalogue through the person's browser, each image saved from the archive's viewer in the tab — paged through, at least 4 s apart, nothing asked by strom", opts, async () => {
  const w = new World();
  await w.withTree("Lhotákovi");
  try {
    const dir = install(w);
    const downloads = path.join(w.dir, "Stažené");
    fs.mkdirSync(downloads);
    await w.ok(["config", "set", "browser.downloads", downloads]);
    // a connector of its archive as strom's list knows it: the browser alone, its viewer
    const show = (await w.ok(["connector", "show", "actapublica-mza"])).out;
    assert.doesNotMatch(show, /problem|⚠ connector\.json/i, show);
    assert.match(show, /browser/);
    const m = readJsonFile(path.join(dir, "connector.json"));
    assert.deepEqual(m.routes, ["browser"]);
    assert.equal(m.browser.viewer, "openseadragon");
    assert.ok(!m.can.includes("fetch") && !m.can.includes("part"), "never an image straight through strom");

    // without the person's permission "through the browser": nothing planned, nothing asked
    const asked = await w.run(["fetch", "actapublica-mza", "--find", "Lhota", "--json"]);
    assert.equal(asked.code, 4, asked.out + asked.err);
    assert.equal(asked.json.way, "browser");
    await w.ok(["allow", "archive", "mza.cz", "--way", "browser"], { tty: true });

    // find: the search, its next page, the parish's own list — each a page of the person's browser
    const found = await throughPages(w, ["fetch", "actapublica-mza", "--find", "Lhota"], downloads);
    assert.deepEqual(
      found.asked.map((u) => u.replace("https://www.mza.cz/actapublica/matrika/", "")),
      ["hledani_obec?typ=obec&search_by_obec=Lhota", "hledani_obec?typ=obec&search_by_obec=Lhota&page=2", "detail/9001", "hledani_puvodce?puvodce_id=77"],
    );
    const books = found.json.books as { id: string; title: string; years?: string; kinds: string[]; places: string[]; images?: number }[];
    assert.deepEqual(books.map((b) => b.id).sort(), ["9001", "9002", "9003", "9004"]);
    const b1 = books.find((b) => b.id === "9001")!;
    assert.equal(b1.title, "Lhota 4711 NOZ 1784–1830");
    assert.deepEqual(b1.kinds, ["baptism", "marriage", "burial"]);
    assert.deepEqual(b1.places, ["Lhota", "Dolní Lhota"]);
    assert.equal(b1.images, 3);
    assert.equal(books.find((b) => b.id === "9002")!.years, "1831-1870");

    // list: from the book's page the browser got already
    const listed = (await w.ok(["fetch", "actapublica-mza", "9001", "--list", "--json"])).json;
    assert.equal(listed.books[0].images, 3);
    assert.match(JSON.stringify(listed.logs ?? listed), /1 images of this book are not public/);

    // the images: a plan for the archive's viewer on the book's page — no address of its tiles or image server
    await w.ok(["recordset", "add", "Lhota N 1784–1820", "--kinds", "baptism", "--places", "Lhota", "--years", "1784-1820", "--url", "https://www.mza.cz/actapublica/matrika/detail/9001"]); // B1
    const plan = await w.ok(["fetch", "actapublica-mza", "9001", "--images", "1-2", "--recordset", "B1", "--json"]);
    const p = plan.json;
    assert.equal(p.plan.open, "https://www.mza.cz/actapublica/matrika/detail/9001?image=4711-00001.jp2");
    assert.deepEqual(p.plan.items.map((i: { n: number }) => i.n), [1, 2]);
    assert.doesNotMatch(p.script, /iipsrv|Deepzoom|fetch\(/, "the script asks the archive nothing: the viewer shows, the browser saves");
    const at = p.plan.items.map((i: { at: string }) => Date.parse(i.at));
    assert.ok(at[1] - at[0] >= 4000, "at least 4 s apart");
    const text = (await w.ok(["fetch", "actapublica-mza", "9001", "--images", "1-2", "--recordset", "B1"])).out;
    assert.match(text, /Open the book's page in a new tab of your own: https:\/\/www\.mza\.cz\/actapublica\/matrika\/detail\/9001\?image=4711-00001\.jp2 — once[\s\S]*never reload the tab/);
    const again = (await w.ok(["fetch", "actapublica-mza", "9001", "--images", "1-2", "--recordset", "B1", "--json"])).json;

    // another page of the site in the tab: refused, nothing saved
    const elsewhere = await tab(again.script, "https://www.mza.cz/actapublica/matrika/detail/9002", downloads, { pages: 3, shown: [], sizes: [], cuts: [] });
    assert.match(elsewhere.line, /^strom: this tab is not on the book's page — open https:\/\/www\.mza\.cz\/actapublica\/matrika\/detail\/9001/);
    // the check whether a person is there not passed: the viewer shows nothing — said, the person's to pass
    const blank = await tab(again.script, p.plan.open, downloads, { pages: 3, blank: true, shown: [], sizes: [], cuts: [] });
    assert.match(blank.line, /^strom-result 1:failed — image 1: .*a check whether a person is there is the user's to pass/);
    const no = await w.run(["fetch", "actapublica-mza", "--take", "--result", blank.line]);
    assert.match(no.out, /image 1: not saved from the archive's viewer — image 1: the viewer shows no image after 30 s/);

    // the book's page opened long ago: the archive's addresses of its images expired — said at once, open it again
    const gone = await tab(again.script, p.plan.open, downloads, { pages: 3, gone: true, shown: [], sizes: [], cuts: [] });
    assert.match(gone.line, /^strom-result 1:200:\d+ 2:failed — image 2: the viewer could not open its page 2: the book's page in this tab is out of date .* open the book's page again, once/);
    for (const f of fs.readdirSync(downloads)) fs.rmSync(path.join(downloads, f));

    // the viewer pages through the book in the tab and the browser saves what it shows
    const fresh = (await w.ok(["fetch", "actapublica-mza", "9001", "--images", "1-2", "--recordset", "B1", "--json"])).json;
    const viewer: Viewer = { pages: 3, shown: [], sizes: [], cuts: [] };
    const ran = await tab(fresh.script, fresh.plan.open, downloads, viewer);
    assert.deepEqual(ran.asked, [], "no fetch of the script's own");
    assert.match(ran.line, /^strom-result 1:200:\d+ 2:200:\d+$/);
    assert.deepEqual(viewer.shown, [2], "page 1 shown already, then page 2 — the page never reloaded");
    // the whole image at what a viewer shows of a page: 2000 px on its longer side (3000 × 2000 → 2000 × 1333)
    assert.deepEqual(viewer.cuts, [{ w: 2000, h: 1334 }, { w: 2000, h: 1334 }]);
    const taken = await w.ok(["fetch", "actapublica-mza", "--take", "--result", ran.line]);
    assert.match(taken.out, /2 images taken over from .*: registered M0001 M0002/);
    const m1 = (await w.ok(["media", "show", "M1", "--json"])).json;
    assert.match(JSON.stringify(m1), /detail\/9001\?image=4711-00001\.jp2/, "where it is: the archive's page of the image");
    assert.deepEqual(fs.readdirSync(downloads), []);

    // a part of an image: at most as sharp as the image itself
    const part = (await w.ok(["fetch", "actapublica-mza", "9001", "--images", "2", "--crop", "0.5,0.25,0.3,0.1", "--recordset", "B1", "--json"])).json;
    const pv: Viewer = { pages: 3, shown: [], sizes: [], cuts: [] };
    const pr = await tab(part.script, part.plan.open, downloads, pv);
    assert.match(pr.line, /^strom-result 2:200:\d+$/);
    assert.deepEqual(pv.cuts, [{ w: 900, h: 200 }], "the part at the image's own size (0.3 × 3000, 0.1 × 2000)");

    // an image the archive does not show: refused before any plan
    const hidden = await w.run(["fetch", "actapublica-mza", "9001", "--images", "3", "--recordset", "B1"]);
    assert.notEqual(hidden.code, 0);
    assert.match(hidden.out + hidden.err, /image 3 of book 9001 is not public/);
    assert.deepEqual(out.filter((u) => !/127\.0\.0\.1|localhost/.test(u)), [], "nothing left this computer");
  } finally {
    w.cleanup();
  }
});

test("ACTA PUBLICA, browser.tileWait: hidden until set, the script then answers strom-wait while the tiles come — such an answer takes nothing", opts, async () => {
  const w = new World();
  await w.withTree("Lhotákovi");
  try {
    install(w);
    const downloads = path.join(w.dir, "Stažené");
    fs.mkdirSync(downloads);
    await w.ok(["config", "set", "browser.downloads", downloads]);
    await w.ok(["allow", "archive", "mza.cz", "--way", "browser"], { tty: true });
    await w.ok(["recordset", "add", "Lhota N 1784–1820", "--kinds", "baptism", "--places", "Lhota", "--years", "1784-1820", "--url", "https://www.mza.cz/actapublica/matrika/detail/9001"]); // B1
    const args = ["fetch", "actapublica-mza", "9001", "--images", "1-2", "--recordset", "B1"];

    // unset: nothing of it anywhere — not listed, not in the plan, the script as it was
    assert.doesNotMatch((await w.ok(["config", "where"])).out, /tileWait/);
    assert.doesNotMatch((await w.ok(["help", "config"])).out, /tileWait/);
    const plain = (await throughPages(w, args, downloads)).json; // the book's page first, through the browser
    assert.equal(plain.plan.items.length, 2);
    assert.doesNotMatch(plain.script, /strom-wait|__stromCapture/);
    assert.doesNotMatch((await w.ok(args)).out, /strom-wait/);

    // a value out of its range refused, saying what it takes
    const low = await w.run(["config", "set", "browser.tileWait", "20"]);
    assert.notEqual(low.code, 0);
    assert.match(low.out + low.err, /strom config set browser\.tileWait 180/);
    await w.ok(["config", "set", "browser.tileWait", "180"]);
    assert.match((await w.ok(["config", "where"])).out, /browser\.tileWait/);
    const slow = (await w.ok([...args, "--json"])).json;
    assert.match(slow.script, /strom-wait/);
    assert.match((await w.ok(args)).out, /It answers "strom-wait …" while the viewer's tiles still come \(browser\.tileWait\): run the same script again in the same tab/);

    // drawn at once: the same answer as without it, in one call
    const viewer: Viewer = { pages: 3, shown: [], sizes: [], cuts: [] };
    const ran = await tab(slow.script, slow.plan.open, downloads, viewer);
    assert.match(ran.line, /^strom-result 1:200:\d+ 2:200:\d+$/);
    for (const f of fs.readdirSync(downloads)) fs.rmSync(path.join(downloads, f));

    // the agent hands over a strom-wait answer: nothing taken, told to run the script again
    const wait = await w.ok(["fetch", "actapublica-mza", "--take", "--result", "strom-wait — the viewer's tiles still come in (35 so far, 32 s waited)", "--json"]);
    assert.equal(wait.json.waiting, true);
    assert.deepEqual(wait.json.taken, []);
    assert.equal((await w.ok(["media", "list", "--json"])).out.includes("M0001"), false);

    await w.ok(["config", "unset", "browser.tileWait"]);
    assert.doesNotMatch((await w.ok([...args, "--json"])).json.script, /strom-wait/);
  } finally {
    w.cleanup();
  }
});

test("ACTA PUBLICA's connector: the census records are never its; no image straight through strom", opts, async () => {
  const src = fs.readFileSync(path.join(fixture, "connector.ts"), "utf8");
  assert.doesNotMatch(src, /scitacioperaty/);
  assert.doesNotMatch(src, /\bfetch\(|node:https?|iipsrv/);
  const m = readJsonFile(path.join(fixture, "connector.json"));
  assert.equal(m.policy.pace.minIntervalMs, 4000);
  assert.equal(m.policy.automation, "restricted");
});
