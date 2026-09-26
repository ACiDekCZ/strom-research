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

/** Never: a file of this computer uploaded to a web site, the user's own browser shortcuts, a batch the rules cannot see into. */
export const CHROME_DENY = ["file_upload", "upload_image", "shortcuts_execute", "gif_creator", "browser_batch"].map((t) => `mcp__claude-in-chrome__${t}`);

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
 * A page that is a check whether a person is there (Imperva/Incapsula, Cloudflare, a captcha), not
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
