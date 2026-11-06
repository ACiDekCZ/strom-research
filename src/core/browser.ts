// Images through the user's own browser. strom does not drive a browser — the
// agent does, with its browser tools (Claude in Chrome). strom plans what the
// browser fetches: the addresses the connector located, the file names, the
// times its limiter reserved. It gives the agent a script to run in a tab of
// the images' site, which fetches them one by one at that pace and saves each
// into the browser's downloads folder under its name. strom then takes the
// files over from there, checks them like any download and registers them with
// where they came from. What the browser got from the archive (a refusal) goes
// into the limiter's memory, as if strom had got it.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { userHome, type Env } from "./paths.ts";
import { readJsonIfExists, writeJson } from "./json.ts";
import type { Region } from "./model.ts";

/** The longest one script waits between its images: a browser tool call must end in time. */
export const SCRIPT_MS = 40_000;
/** A plan is run within this time, or it is over (its times are long past): fetch again. */
export const PLAN_TTL_MS = 15 * 60_000;
/** A plan whose files never came is forgotten after this. */
export const KEEP_MS = 7 * 24 * 3600_000;

/** Browser tools of Claude in Chrome an agent may use for a connector's site. */
export const CHROME_ALLOW = [
  "tabs_context_mcp",
  "tabs_create_mcp",
  "tabs_close_mcp",
  "navigate",
  "javascript_tool",
  "read_page",
  "get_page_text",
  "find",
  "form_input",
  "computer",
  "read_console_messages",
  "read_network_requests",
  "list_connected_browsers",
  "select_browser",
  "switch_browser",
  "resize_window",
].map((t) => `mcp__claude-in-chrome__${t}`);

/** The tools of Claude in Chrome, by the names Claude Code gives them. */
export const CHROME_TOOL_PREFIX = "mcp__claude-in-chrome__";
export const CHROME_NAVIGATE = `${CHROME_TOOL_PREFIX}navigate`;
/** The tools that act on the page a tab shows (no address of their own): kept off a host strom must leave alone (core/chromehook.ts). */
export const CHROME_PAGE_TOOLS = ["computer", "find", "read_page", "get_page_text", "form_input", "javascript_tool", "read_network_requests", "read_console_messages"] as const;
/** Claude Code's matcher of strom's hook before the browser's navigate and its page tools (agents/files.ts). */
export const CHROME_HOOK_MATCHER = `${CHROME_TOOL_PREFIX}(navigate|${CHROME_PAGE_TOOLS.join("|")})`;

/**
 * The built-in browser of Claude's desktop app (its browser pane), by the names Claude Code gives its tools there: in
 * the app itself, and in a session elsewhere linked to the person's computer (the same names after either prefix).
 * Seen 6 November 2026 (Claude desktop 2.1.317): the app runs the tree's hooks before them too.
 */
export const APP_BROWSER_PREFIXES = ["mcp__Claude_Browser__", "mcp__remote-devices__Claude_Browser__"] as const;
/** Its tools that go to an address (tool_input.url): preview_start opens a new tab at it, tabs_create one too. */
export const APP_BROWSER_NAVIGATE = ["navigate", "preview_start", "tabs_create"] as const;
/** Its tools on the page a tab shows (tool_input.tabId; none: the active tab) — the same as Claude in Chrome's. */
export const APP_BROWSER_PAGE_TOOLS = CHROME_PAGE_TOOLS;
const APP_BROWSER_PREFIX_RE = "mcp__(remote-devices__)?Claude_Browser__";
/** Claude Code's matcher of strom's hook before the built-in browser's tools to an address and on a page. */
export const APP_BROWSER_HOOK_MATCHER = `${APP_BROWSER_PREFIX_RE}(${[...APP_BROWSER_NAVIGATE, ...APP_BROWSER_PAGE_TOOLS].join("|")})`;
/** After those to an address ran or failed: the tab it opened (its tabId) and the person's yes counted. */
export const APP_BROWSER_NAVIGATE_MATCHER = `${APP_BROWSER_PREFIX_RE}(${APP_BROWSER_NAVIGATE.join("|")})`;

/** Never: a file of this computer uploaded to a web site, the user's own browser shortcuts, a batch the rules cannot see into. */
export const CHROME_DENY = ["file_upload", "upload_image", "shortcuts_execute", "gif_creator", "browser_batch"].map((t) => `mcp__claude-in-chrome__${t}`);

/**
 * Codex's browser and computer use: the MCP servers its desktop app (ChatGPT, Codex) adds — node_repl runs its in-app
 * browser and its Chrome extension, cua_repl (the plugin unified-computer-use) and computer-use its computer use. They
 * run JavaScript: strom's hook reads only the addresses node_repl's code names, and only once the person confirmed the
 * tree's hooks in Codex (core/codexhook.ts, core/browserhelp.ts); computer use it neither watches nor recommends.
 * Nothing of them is switched off in a research (the person's choice, Milan 5 November 2026) — only a run
 * without the person's add-ons (agent.addons off) goes without them, as without the rest (runners/codex.ts).
 */
export const CODEX_BROWSER_SERVERS = ["node_repl", "cua_repl", "computer-use", "computer_use"];

/** The permission rule of Claude in Chrome for one site. */
export const chromeDomain = (host: string) => `ClaudeInChromeDomain(${host.replace(/^\*\./, "").toLowerCase()})`;

/** Claude in Chrome in the Chrome Web Store: the extension Claude Code's browser tools work through. */
export const CLAUDE_IN_CHROME_ID = "fcoeoabgfenejglbffodgkkbkcdhcgfn";
export const CLAUDE_IN_CHROME_URL = `https://chromewebstore.google.com/detail/${CLAUDE_IN_CHROME_ID}`;

/** The folders of the browsers' profiles (Chrome, Edge, Brave take extensions from the Chrome Web Store). */
function browserDataDirs(env: Env, platform: NodeJS.Platform): { browser: string; dir: string }[] {
  const home = userHome(env);
  if (platform === "darwin") {
    const base = path.join(home, "Library", "Application Support");
    return [
      { browser: "Chrome", dir: path.join(base, "Google", "Chrome") },
      { browser: "Edge", dir: path.join(base, "Microsoft Edge") },
      { browser: "Brave", dir: path.join(base, "BraveSoftware", "Brave-Browser") },
    ];
  }
  if (platform === "win32") {
    const base = env.LOCALAPPDATA ?? path.join(home, "AppData", "Local");
    return [
      { browser: "Chrome", dir: path.join(base, "Google", "Chrome", "User Data") },
      { browser: "Edge", dir: path.join(base, "Microsoft", "Edge", "User Data") },
      { browser: "Brave", dir: path.join(base, "BraveSoftware", "Brave-Browser", "User Data") },
    ];
  }
  const base = env.XDG_CONFIG_HOME ?? path.join(home, ".config");
  return [
    { browser: "Chrome", dir: path.join(base, "google-chrome") },
    { browser: "Edge", dir: path.join(base, "microsoft-edge") },
    { browser: "Brave", dir: path.join(base, "BraveSoftware", "Brave-Browser") },
  ];
}

/**
 * Is Claude in Chrome installed — in which browsers? Only the extension's folder in the profiles is looked for (its
 * name), nothing else of the browser is read. Whether it is signed in and connected strom cannot see.
 */
export function claudeInChrome(env: Env, platform: NodeJS.Platform = process.platform): { browsers: string[]; extension: string[] } {
  const browsers: string[] = [];
  const extension: string[] = [];
  for (const { browser, dir } of browserDataDirs(env, platform)) {
    let profiles: string[];
    try {
      profiles = fs.readdirSync(dir).filter((n) => n === "Default" || /^Profile \d+$/u.test(n));
    } catch {
      continue;
    }
    browsers.push(browser);
    if (profiles.some((p) => fs.existsSync(path.join(dir, p, "Extensions", CLAUDE_IN_CHROME_ID)))) extension.push(browser);
  }
  return { browsers, extension };
}

export interface PlanItem {
  n: number;
  /** The image's own address. */
  src: string;
  /** The page a person opens (provenance). */
  url?: string;
  page?: string;
  region?: Region;
  /** The name the browser saves it under, without the extension. */
  file: string;
  /** Not before this time (ms): the slot the limiter reserved. */
  at: number;
}

/** A request of a connector whose portal gives its pages to a real browser only (browser.pages): the browser asks it. */
export interface PageRequest {
  method: "GET" | "POST" | "HEAD";
  url: string;
  headers: Record<string, string>;
  body?: string;
}

/** A page the browser got, kept for the connector's next run. */
export interface PageAnswer {
  status: number;
  contentType: string;
  headers: Record<string, string>;
  url: string;
  body: Buffer;
}

export interface PlanPage {
  key: string;
  method: PageRequest["method"];
  url: string;
  headers: Record<string, string>;
  body?: string;
  /** The name the browser saves it under, without the extension (.json). */
  file: string;
  at: number;
}

/** What strom does again once the pages are there: the command the plan was made for. */
export type Resume =
  | { cmd: "fetch"; request: Record<string, unknown>; recordset?: string }
  | { cmd: "test"; request: Record<string, unknown>; max: number }
  | { cmd: "probe"; save?: string };

export interface BrowserPlan {
  id: string;
  connector: string;
  book: string;
  recordset?: string;
  /** Pages for the connector (browser.pages), instead of images. */
  pages?: PlanPage[];
  resume?: Resume;
  /** The page the tab opens first: on the images' site, so that the script may fetch them. */
  open: string;
  origin: string;
  host: string;
  /** The pause between two images (ms). */
  gap: number;
  /**
   * The images are saved from the portal's own viewer in the tab (browser.viewer): its page n shown, what the
   * browser drew of it kept — the viewer's own requests, none of strom's.
   */
  viewer?: Viewer;
  created: number;
  /** The script refuses to run after this. */
  until: number;
  items: PlanItem[];
}

/** The folder a browser saves downloads into by default: ~/Downloads, or what the desktop names it (Linux). */
export function downloadsDir(env: Env, platform: NodeJS.Platform = process.platform): string {
  const home = userHome(env);
  if (platform === "linux") {
    const cfg = env.XDG_CONFIG_HOME || path.join(home, ".config");
    try {
      const m = /^XDG_DOWNLOAD_DIR="([^"]*)"/m.exec(fs.readFileSync(path.join(cfg, "user-dirs.dirs"), "utf8"));
      if (m?.[1]) return m[1].replace(/^\$HOME/, home);
    } catch {
      // no desktop settings: the usual name
    }
  }
  return path.join(home, "Downloads");
}

/** The image viewers strom saves an image from (browser.viewer): OpenSeadragon (2.x–4.x, its canvas). */
export const VIEWERS = ["openseadragon"] as const;
export type Viewer = (typeof VIEWERS)[number];

/** How many images one script of the viewer saves: each waits its turn and for the viewer's tiles. */
export function viewerBatch(paceMs: number): number {
  return Math.max(1, Math.floor(SCRIPT_MS / (paceMs + VIEWER_LOAD_MS)));
}
/** About how long the viewer takes to show a page whole. */
const VIEWER_LOAD_MS = 6000;
/** The longer side of a whole image saved from a viewer (device pixels; never above the image's own): what a viewer shows of a page. */
export const VIEWER_WHOLE_PX = 2000;
/** The longer side of a part saved from a viewer: as sharp as the image, never more than this. */
export const VIEWER_PART_PX = 2400;

const safe = (s: string) => s.normalize("NFC").replace(/[^\p{L}\p{M}\p{N}._-]+/gu, "_").replace(/^[._]+/, "") || "x";

/** The name a planned image is saved under: strom-<connector>-<book>-0009 (a part: …-0009-part). */
export function fileBase(connector: string, book: string, n: number, part: boolean): string {
  return `strom-${connector}-${safe(book)}-${String(n).padStart(4, "0")}${part ? "-part" : ""}`;
}

function plansDir(root: string): string {
  return path.join(root, ".strom", "browser");
}

export function savePlan(root: string, plan: BrowserPlan): void {
  writeJson(path.join(plansDir(root), `${plan.id}.json`), plan);
}

/** The plans of a tree still waiting for their files (of one connector), oldest first; forgotten ones removed. */
export function loadPlans(root: string, connector?: string, now = Date.now()): BrowserPlan[] {
  const dir = plansDir(root);
  if (!fs.existsSync(dir)) return [];
  const out: BrowserPlan[] = [];
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".json")).sort()) {
    const p = readJsonIfExists<BrowserPlan>(path.join(dir, f));
    if (!p || !Array.isArray(p.items)) continue;
    if ((!p.items.length && !p.pages?.length) || now - p.created > KEEP_MS) {
      fs.rmSync(path.join(dir, f), { force: true });
      continue;
    }
    if (!connector || p.connector === connector) out.push(p);
  }
  return out;
}

export function removePlan(root: string, id: string): void {
  fs.rmSync(path.join(plansDir(root), `${id}.json`), { force: true });
}

/** The script the agent runs in a tab of the plan's site (top-level await). It returns one line: "strom-result 9:200:412918 10:403". */
export function planScript(plan: BrowserPlan): string {
  // the page of the image as the referrer, as the portal's own viewer sends it (a browser allows it on the same site)
  const ref = (u: string | undefined) => (u && URL.canParse(u) && new URL(u).origin === plan.origin ? { ref: u } : {});
  const data = { origin: plan.origin, open: plan.open, until: plan.until, gap: plan.gap, items: plan.items.map((i) => ({ n: i.n, src: i.src, file: i.file, at: i.at, ...ref(i.url) })) };
  return `await (async () => {
  const plan = ${JSON.stringify(data)};
  if (location.origin !== plan.origin) return "strom: this tab is on " + location.origin + " — open " + plan.open + " first";
  if (Date.now() > plan.until) return "strom: this plan is over — run strom fetch again for a new one";
  const ext = { "image/jpeg": ".jpg", "image/png": ".png", "image/tiff": ".tif", "image/webp": ".webp", "image/gif": ".gif", "image/jp2": ".jp2" };
  const out = [];
  let last = 0;
  for (const it of plan.items) {
    const wait = Math.max(it.at, last + plan.gap) - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    last = Date.now();
    let res;
    try {
      res = await fetch(it.src, it.ref ? { credentials: "include", referrer: it.ref } : { credentials: "include" });
    } catch (e) {
      out.push(it.n + ":failed");
      break;
    }
    if (!res.ok) {
      out.push(it.n + ":" + res.status);
      break;
    }
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = it.file + (ext[blob.type.split(";")[0].trim()] || ".jpg");
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 60000);
    out.push(it.n + ":" + res.status + ":" + blob.size);
  }
  return "strom-result " + out.join(" ");
})()`;
}

export interface ScriptResult {
  n: number;
  /** A page (its key), not an image. */
  page?: string;
  status?: number;
  bytes?: number;
  failed?: boolean;
}

/** The line the script returned: "strom-result 9:200:412918 10:403 11:failed". */
export function parseResult(s: string): ScriptResult[] {
  const out: ScriptResult[] = [];
  for (const tok of s.replace(/^\s*["']?\s*strom-result\s*/i, "").split(/[\s,"']+/)) {
    const m = /^(\d+|p[0-9a-f]{16}):(\d{3}|failed)(?::(\d+))?$/.exec(tok);
    if (!m) continue;
    const page = m[1]!.startsWith("p") ? m[1]!.slice(1) : undefined;
    out.push({ n: page ? 0 : Number(m[1]), ...(page ? { page } : {}), ...(m[2] === "failed" ? { failed: true } : { status: Number(m[2]) }), ...(m[3] ? { bytes: Number(m[3]) } : {}) });
  }
  return out;
}

const UNFINISHED = /\.(crdownload|part|download|tmp)$/i;

/**
 * The downloaded file of a planned name: "<base>.jpg", or "<base> (1).jpg" when the
 * browser had one of that name already — the newest. Names are compared composed
 * (a folder may give them back decomposed); the path is the folder's own.
 */
export function findDownload(dir: string, base: string): { file?: string; others: string[]; unfinished?: boolean } {
  let names: string[];
  try {
    names = fs.readdirSync(dir);
  } catch {
    return { others: [] };
  }
  const want = base.normalize("NFC");
  const esc = want.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`^${esc}(?: \\(\\d+\\))?\\.[\\p{L}\\p{N}]{2,5}$`, "u");
  const found: { file: string; at: number }[] = [];
  let unfinished = false;
  for (const name of names) {
    const nfc = name.normalize("NFC");
    if (!nfc.startsWith(want)) continue;
    if (UNFINISHED.test(nfc)) {
      unfinished = true;
      continue;
    }
    if (!re.test(nfc)) continue;
    const file = path.join(dir, name);
    found.push({ file, at: fs.statSync(file).mtimeMs });
  }
  found.sort((a, b) => b.at - a.at);
  const [best, ...rest] = found;
  return { ...(best ? { file: best.file } : {}), others: rest.map((f) => f.file), ...(!best && unfinished ? { unfinished: true } : {}) };
}

// ── pages through the browser (a portal behind a bot check) ─────────────────

/** A request's key: the same request is the same page (and the connector asks the same, run after run). */
export function pageKey(r: Pick<PageRequest, "method" | "url" | "body">): string {
  return crypto.createHash("sha256").update(`${r.method} ${r.url}\n${r.body ?? ""}`).digest("hex").slice(0, 16);
}

/** A page kept this long answers the connector again; then the browser asks for it anew. */
export const PAGE_TTL_MS = 24 * 3600_000;

const pagesDir = (root: string, connector: string) => path.join(root, ".strom", "browser", "pages", connector);

interface KeptPage {
  key: string;
  method: string;
  url: string;
  at: number;
  status: number;
  type: string;
  headers: Record<string, string>;
  finalUrl: string;
  body: string; // base64
}

export function loadPage(root: string, connector: string, key: string, now = Date.now()): PageAnswer | undefined {
  const p = readJsonIfExists<KeptPage>(path.join(pagesDir(root, connector), `${key}.json`));
  if (!p || now - p.at > PAGE_TTL_MS) return undefined;
  return { status: p.status, contentType: p.type, headers: p.headers, url: p.finalUrl, body: Buffer.from(p.body, "base64") };
}

export function savePage(root: string, connector: string, req: PlanPage, got: PageAnswer, now = Date.now()): void {
  const kept: KeptPage = { key: req.key, method: req.method, url: req.url, at: now, status: got.status, type: got.contentType, headers: got.headers, finalUrl: got.url, body: got.body.toString("base64") };
  writeJson(path.join(pagesDir(root, connector), `${req.key}.json`), kept);
}

/** What a browser saved for a page: the file the page script wrote, or why it is not one. */
export function readSavedPage(file: string): PageAnswer | string {
  let o: Record<string, unknown>;
  try {
    o = JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown>;
  } catch {
    return "not a page saved by strom's script (not JSON)";
  }
  if (o.strom !== "page" || typeof o.status !== "number" || typeof o.body !== "string") return "not a page saved by strom's script";
  const headers = o.headers && typeof o.headers === "object" ? Object.fromEntries(Object.entries(o.headers as Record<string, unknown>).map(([k, v]) => [k.toLowerCase(), String(v)])) : {};
  return { status: o.status, contentType: String(o.type ?? ""), headers, url: String(o.url ?? ""), body: Buffer.from(o.body, "base64") };
}

/**
 * A page that is a check whether a person is there (Imperva/Incapsula, Cloudflare, DDoS-Guard, Anubis, a captcha), not
 * the page asked for: its name, or undefined. The services put their scripts into every page they
 * guard, so a script alone is no check: a check is a small page with little else (found live).
 */
export function botCheck(body: Buffer | string, headers: Record<string, string> = {}): string | undefined {
  const buf = typeof body === "string" ? Buffer.from(body) : body;
  const text = buf.subarray(0, 64 * 1024).toString("latin1").toLowerCase();
  const small = buf.length < 16 * 1024;
  // what a reader sees of it: the text without tags and scripts
  const words = text.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<[^>]+>/g, " ").replace(/\s+/g, " ").trim().length;
  const bare = small && words < 400;
  const header = (name: string) => Object.entries(headers).find(([k]) => k.toLowerCase() === name)?.[1];
  if (/incapsula incident id|request unsuccessful\. incapsula/.test(text) || (bare && /_incapsula_resource/.test(text))) return "Imperva (Incapsula)";
  if (/^challenge/i.test(header("cf-mitigated") ?? "") || /<title>(just a moment\.\.\.|attention required! \| cloudflare)<\/title>/.test(text) || (bare && /cf-challenge|cf_chl_|challenge-platform/.test(text))) return "Cloudflare";
  if (bare && /ddos-guard/.test(text)) return "DDoS-Guard";
  // Anubis (a proof of work in the browser, set up against AI companies' crawlers): its challenge page in any language
  if (/id="anubis_challenge"/.test(text) || (bare && /\/\.within\.website\/x\/cmd\/anubis\//.test(text))) return "Anubis";
  if (bare && /g-recaptcha|h-captcha|hcaptcha\.com|recaptcha\/api\.js/.test(text)) return "a captcha";
  return undefined;
}

/** Headers a page's own script may send (a browser sets the rest itself: cookies, the user agent). */
const PAGE_HEADERS = new Set(["accept", "accept-language", "content-type", "x-requested-with"]);

/** The script that asks the plan's pages in the tab (top-level await): each saved as <file>.json; it returns "strom-result p<key>:200:5120". */
export function pageScript(plan: BrowserPlan): string {
  const pages = (plan.pages ?? []).map((p) => {
    const h = Object.fromEntries(Object.entries(p.headers).filter(([k]) => PAGE_HEADERS.has(k.toLowerCase())));
    const ref = Object.entries(p.headers).find(([k]) => k.toLowerCase() === "referer")?.[1];
    return { key: p.key, method: p.method, url: p.url, file: p.file, at: p.at, headers: h, ...(p.body !== undefined ? { body: p.body } : {}), ...(ref && URL.canParse(ref) && new URL(ref).origin === plan.origin ? { ref } : {}) };
  });
  const data = { origin: plan.origin, open: plan.open, until: plan.until, gap: plan.gap, pages };
  return `await (async () => {
  const plan = ${JSON.stringify(data)};
  if (location.origin !== plan.origin) return "strom: this tab is on " + location.origin + " — open " + plan.open + " first";
  if (Date.now() > plan.until) return "strom: this plan is over — run the strom command again for a new one";
  const out = [];
  let last = 0;
  for (const p of plan.pages) {
    const wait = Math.max(p.at, last + plan.gap) - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    last = Date.now();
    let res;
    try {
      res = await fetch(p.url, { method: p.method, headers: p.headers, credentials: "include", ...(p.body !== undefined ? { body: p.body } : {}), ...(p.ref ? { referrer: p.ref } : {}) });
    } catch (e) {
      out.push("p" + p.key + ":failed");
      break;
    }
    const bytes = new Uint8Array(await res.arrayBuffer());
    let bin = "";
    for (let i = 0; i < bytes.length; i += 32768) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 32768));
    const headers = {};
    res.headers.forEach((v, k) => (headers[k] = v));
    const saved = { strom: "page", status: res.status, type: res.headers.get("content-type") || "", url: res.url, headers, body: btoa(bin) };
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(saved)], { type: "application/json" }));
    a.download = p.file + ".json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 60000);
    out.push("p" + p.key + ":" + res.status + ":" + bytes.length);
    if (res.status === 401 || res.status === 403 || res.status === 429) break;
  }
  return "strom-result " + out.join(" ");
})()`;
}

// ── images saved from what the tab shows (a viewer, an image) ───────────────

/**
 * The functions both scripts share (plain JavaScript of the tab): the viewer found on the page; one of its pages shown
 * whole or in part, at most as sharp as the image, waited for until every tile is there; what the browser drew of it
 * cut out and saved as a JPEG under a name. No request of its own: the tiles are the ones the viewer asks for.
 */
const CAPTURE_JS = `const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const frames = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const until = async (ok, ms) => {
    const end = Date.now() + ms;
    for (;;) {
      try {
        if (ok()) return true;
      } catch (e) {}
      if (Date.now() > end) return false;
      await sleep(200);
    }
  };
  const findViewer = () => {
    const OSD = window.OpenSeadragon;
    if (!OSD || !OSD.Viewer) return undefined;
    for (const k of Object.keys(window)) {
      try {
        if (window[k] instanceof OSD.Viewer) return window[k];
      } catch (e) {}
    }
    if (OSD._viewers && OSD._viewers.values) for (const v of OSD._viewers.values()) return v;
    return undefined;
  };
  const save = (blob, name) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 60000);
  };
  const jpeg = (canvas) => new Promise((r) => { try { canvas.toBlob((b) => r(b), "image/jpeg", 0.92); } catch (e) { r(undefined); } });
  // the viewer's page idx (0: the first; -1: the one it shows), whole or the region, cut out of what it drew
  const capture = async (v, idx, region, target) => {
    const pages = Array.isArray(v.tileSources) ? v.tileSources.length : 1;
    if (idx >= 0 && idx >= pages) return { why: "the viewer has " + pages + " page" + (pages === 1 ? "" : "s") + ", not " + (idx + 1) };
    // the addresses a viewer's page holds of its images may expire (the archive answers 410): the viewer opens nothing then
    let gone = false;
    const onGone = () => (gone = true);
    const stale = { why: "the viewer could not open its page " + (idx + 1) + ": the book's page in this tab is out of date (the archive's addresses of its images expire) — open the book's page again, once, then run strom fetch again", stale: true };
    v.addHandler("open-failed", onGone);
    try {
      if (idx >= 0 && pages > 1 && v.currentPage() !== idx) {
        const before = v.world.getItemAt(0);
        v.goToPage(idx);
        if (!(await until(() => gone || (v.currentPage() === idx && v.world.getItemCount() > 0 && v.world.getItemAt(0) !== before), 30000))) return { why: "the viewer did not show page " + (idx + 1) + " in 30 s" };
        if (gone) return stale;
      }
      if (!(await until(() => gone || v.world.getItemCount() > 0, 30000))) return { why: "the viewer shows no image after 30 s — a check whether a person is there is the user's to pass", check: true };
      if (gone) return stale;
    } finally {
      v.removeHandler("open-failed", onGone);
    }
    const item = v.world.getItemAt(0);
    const canvas = v.drawer && v.drawer.canvas;
    if (!canvas || !canvas.getContext || (v.drawer.getType && v.drawer.getType() === "webgl")) return { why: "this viewer does not draw on a canvas strom can save" };
    const dim = item.source && item.source.dimensions ? item.source.dimensions : item.getContentSize();
    const r = region || { x: 0, y: 0, w: 1, h: 1 };
    const rw = dim.x * r.w, rh = dim.y * r.h;
    const dpr = window.devicePixelRatio || 1;
    const scale = Math.min(1, target / Math.max(rw, rh));
    const cw = Math.max(64, Math.round((rw * scale) / dpr)), ch = Math.max(64, Math.round((rh * scale) / dpr));
    const el = v.element;
    const style = el.getAttribute("style");
    let failed = 0;
    const onFail = () => failed++;
    v.addHandler("tile-load-failed", onFail);
    try {
      el.style.cssText = (style || "") + ";position:fixed;left:0;top:0;width:" + cw + "px;height:" + ch + "px;max-width:none;max-height:none;z-index:2147483646";
      await until(() => { const s = v.viewport.getContainerSize(); return Math.abs(s.x - cw) < 2 && Math.abs(s.y - ch) < 2; }, 5000);
      const rect = item.imageToViewportRectangle(r.x * dim.x, r.y * dim.y, rw, rh);
      v.viewport.fitBounds(rect, true);
      await frames();
      await sleep(300);
      const done = () => (typeof item.getFullyLoaded === "function" ? item.getFullyLoaded() : true) && (!v.imageLoader || v.imageLoader.jobsInProgress === 0);
      if (!(await until(done, 30000))) return { why: "the viewer's tiles did not all come in 30 s" };
      await frames();
      if (failed) return { why: failed + " tile" + (failed === 1 ? "" : "s") + " of the image did not come — the archive may be busy", stop: true };
      const ratio = canvas.width / (canvas.clientWidth || cw) || dpr;
      const a = v.viewport.pixelFromPoint(rect.getTopLeft(), true), b = v.viewport.pixelFromPoint(rect.getBottomRight(), true);
      const sx = Math.max(0, Math.round(a.x * ratio)), sy = Math.max(0, Math.round(a.y * ratio));
      const ex = Math.min(canvas.width, Math.round(b.x * ratio)), ey = Math.min(canvas.height, Math.round(b.y * ratio));
      if (ex - sx < 64 || ey - sy < 64) return { why: "the viewer drew too little of the image" };
      const out = document.createElement("canvas");
      out.width = ex - sx;
      out.height = ey - sy;
      out.getContext("2d").drawImage(canvas, sx, sy, out.width, out.height, 0, 0, out.width, out.height);
      const blob = await jpeg(out);
      if (!blob) return { why: "the browser does not let this page save what its viewer drew (images of another site)" };
      return { blob };
    } finally {
      v.removeHandler("tile-load-failed", onFail);
      if (style === null) el.removeAttribute("style");
      else el.setAttribute("style", style);
      try { v.viewport.goHome(true); } catch (e) {}
    }
  };`;

/**
 * The script that saves the plan's images from the portal's own viewer in the tab (browser.viewer; top-level await):
 * the tab on the book's page, each image its page n of the viewer, shown and saved at its time, one after the other.
 * Never a reload, never a request of its own. It returns "strom-result 9:200:412918 10:failed".
 */
export function viewerScript(plan: BrowserPlan): string {
  const open = new URL(plan.open);
  const data = { origin: plan.origin, path: open.pathname, open: plan.open, until: plan.until, gap: plan.gap, items: plan.items.map((i) => ({ n: i.n, file: i.file, at: i.at, ...(i.region ? { region: i.region } : {}) })) };
  return `await (async () => {
  const plan = ${JSON.stringify(data)};
  if (location.origin !== plan.origin || location.pathname !== plan.path) return "strom: this tab is not on the book's page — open " + plan.open + " (once; then page through it, never reload it)";
  if (Date.now() > plan.until) return "strom: this plan is over — run strom fetch again for a new one";
  ${CAPTURE_JS}
  const v = findViewer();
  if (!v) return "strom: no image viewer on this page yet — wait until it shows an image; a check whether a person is there is the user's to pass";
  const out = [];
  let last = 0;
  for (const it of plan.items) {
    const wait = Math.max(it.at, last + plan.gap) - Date.now();
    if (wait > 0) await sleep(wait);
    last = Date.now();
    const got = await capture(v, it.n - 1, it.region, it.region ? ${VIEWER_PART_PX} : ${VIEWER_WHOLE_PX});
    if (!got.blob) {
      out.push(it.n + ":failed");
      return "strom-result " + out.join(" ") + " — image " + it.n + ": " + got.why;
    }
    save(got.blob, it.file + ".jpg");
    out.push(it.n + ":200:" + got.blob.size);
  }
  return "strom-result " + out.join(" ");
})()`;
}

/** The name an image saved from the tab for a waiting task is saved under: strom-T0007-0040 (taken by strom media add --inbox --waiting). */
export function waitFileBase(task: string, n: number): string {
  return `strom-${safe(task)}-${String(n).padStart(4, "0")}`;
}

/**
 * The script that saves the one image the tab shows (top-level await), for a task waiting for it: a viewer's page as
 * it shows it, else the largest image of the page as the browser has it. Only on the page strom was told of — its
 * site, path, parameters and anchor, so a viewer paged to another image is refused, nothing saved (`other`: that
 * said for the person, in the research language). It returns "strom-result 40:200:412918", or why not.
 */
export function saveScript(o: { url: string; file: string; n: number; until: number; other?: string }): string {
  const u = new URL(o.url);
  const data = { origin: u.origin, path: u.pathname, search: u.search, hash: u.hash, url: o.url, until: o.until, n: o.n, file: o.file, ...(o.other ? { other: o.other } : {}) };
  return `await (async () => {
  const plan = ${JSON.stringify(data)};
  if (location.origin !== plan.origin || location.pathname !== plan.path) return "strom: this tab is not on " + plan.url + " — that page was allowed, no other";
  // the page of image n, as the viewer keeps it in the address: the same parameters and anchor, or another image shown
  const params = (q) => [...new URLSearchParams(q)].map((kv) => kv.join("=")).sort().join("&");
  const anchor = (h) => (h === "#" ? "" : h);
  if (params(location.search || "") !== params(plan.search) || anchor(location.hash || "") !== anchor(plan.hash))
    return "strom: this tab shows " + location.href + ", not " + plan.url + " — another image than " + plan.n + " (the viewer was paged); nothing saved. Page the viewer back to image " + plan.n + " or open " + plan.url + " (once), then run the script again; else tell the user" + (plan.other ? ": " + plan.other : "");
  if (Date.now() > plan.until) return "strom: this script is over — run strom media save again";
  ${CAPTURE_JS}
  const v = findViewer();
  if (v) {
    const got = await capture(v, -1, undefined, ${VIEWER_WHOLE_PX});
    if (!got.blob) return "strom-result " + plan.n + ":failed — " + got.why;
    save(got.blob, plan.file + ".jpg");
    return "strom-result " + plan.n + ":200:" + got.blob.size;
  }
  // the largest image of the page, as the browser has it (an image opened on its own is one too)
  let best;
  for (const img of document.images) if (img.complete && img.naturalWidth && (!best || img.naturalWidth * img.naturalHeight > best.naturalWidth * best.naturalHeight)) best = img;
  if (!best || Math.max(best.naturalWidth, best.naturalHeight) < 400) return "strom: no image of a page shown here (a viewer strom does not know, or it is still loading) — the person saves it by hand";
  let blob;
  try {
    const c = document.createElement("canvas");
    c.width = best.naturalWidth;
    c.height = best.naturalHeight;
    c.getContext("2d").drawImage(best, 0, 0);
    blob = await jpeg(c);
  } catch (e) {}
  if (!blob) {
    // another site's image: as the browser keeps it, as "save image as" would
    try {
      const res = await fetch(best.currentSrc || best.src, { cache: "force-cache", credentials: "include" });
      if (!res.ok) return "strom-result " + plan.n + ":" + res.status;
      blob = await res.blob();
    } catch (e) {
      return "strom-result " + plan.n + ":failed — the browser does not let this page save the image";
    }
  }
  const ext = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif", "image/tiff": ".tif" }[(blob.type || "").split(";")[0].trim()] || ".jpg";
  save(blob, plan.file + ext);
  return "strom-result " + plan.n + ":200:" + blob.size;
})()`;
}
