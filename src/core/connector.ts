// Connectors: plugins that know one archive portal — how to find its books,
// list their images and fetch them. strom does not ship any; the user copies
// one into the plugins folder (<shared>/plugins/connectors/<name>/ — the
// folder's name is the connector's name) or builds one there with their agent
// (strom connector new). The core keeps them honest: a connector is a program
// speaking JSON lines on stdin/stdout, every request it makes goes through
// strom's polite limiter (core/net.ts) to the hosts it names, strom writes the
// files and checks the images. The user may ask to be asked first (setting
// connectors.consent on): then nothing runs without their consent — for the
// program, and for automated access to each host. Code that goes round strom's
// limiter needs their yes either way.
//
// The contract — interface 1, meant never to change — is
// assets/plugins/connectors/README.md, which strom also puts next to the
// plugins. This file implements it.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import readline from "node:readline";
import { spawn, spawnSync } from "node:child_process";
import { StromError, UsageError } from "./errors.ts";
import { which } from "./which.ts";
import { configDir, type Env } from "./paths.ts";
import { loadUserConfig, Settings, type RouteChoice } from "./config.ts";
import { readJsonIfExists, writeJson } from "./json.ts";
import { readAsset } from "./assets.ts";
import { foldText } from "./text.ts";
import { CookieJar, hostAllowed, NetError, paceOf, paceText, politeRequest, type Pace, type ServicePace } from "./net.ts";
import { loginOf, redactor } from "./logins.ts";
import type { Media, RecordSet, Region, Repository, Source } from "./model.ts";
import type { Tree } from "./tree.ts";
import { decodeImage, encodeImage, imageSize, imageSizeOfFile } from "../image/index.ts";
import { blank, paste, toRgb, type RawImage } from "../image/image.ts";
import { botCheck, type PageAnswer, type PageRequest } from "./browser.ts";

/** The newest version of the contract. */
export const INTERFACE = 1;
/**
 * Every version of the contract this strom runs — each one it ever had: a connector someone built stays
 * working. Within a version the contract only grows (optional fields, capabilities, routes); what a newer
 * strom added, an older one leaves out and runs the rest (ConnectorManifest.newer).
 */
export const INTERFACES: readonly number[] = [1];
export const MANIFEST = "connector.json";
export const CAPABILITIES = ["find", "list", "fetch", "part", "locate"] as const;
export type Capability = (typeof CAPABILITIES)[number];
/** How its images come: through strom's limiter (direct), or through the user's own browser. */
export const ROUTES = ["direct", "browser"] as const;
export type Route = (typeof ROUTES)[number];
/** A connector's name: its folder's name — lowercase letters, digits and dashes. */
export const NAME_RE = /^[a-z0-9][a-z0-9-]*$/;

export interface ConnectorManifest {
  interface: number;
  title: string;
  version?: string;
  /** The program: ["node", "connector.ts"], ["python3", "main.py"] — run in the connector's folder. */
  run: string[];
  /** The only hosts it may contact ("example.org" includes its subdomains). */
  hosts: string[];
  can: Capability[];
  /** The ways its images may come, the usual one first (default: direct). ["browser"]: only through the browser. */
  routes?: Route[];
  /**
   * Through the browser: the page a tab opens first (where the user's login lives; default: a light page of
   * the image's site). pages: the portal answers a real browser only (a bot check) — every request goes
   * through the user's browser, planned by strom.
   */
  browser?: { open?: string; pages?: boolean };
  /** What the portal allows — found out before the connector was written. */
  policy: {
    /** allowed · manual (the terms forbid automation: assisted download only) · unknown */
    automation: "allowed" | "manual" | "unknown";
    terms?: string;
    termsSummary?: string;
    robots?: string;
    officialExport?: string;
    pace?: ServicePace;
  };
  /** An account on the portal the user may have: what it gives, where to get one, what they type in. */
  login?: {
    about: string;
    url?: string;
    /** Each field and what the user is asked: {"user": "User name or e-mail", "password": "Password"}. */
    fields: Record<string, string>;
    /** It cannot work without one. */
    required?: boolean;
  };
  /** Not in the file: what it declares that this strom does not know (from a newer contract) — left out. */
  newer?: string[];
}

export interface Connector {
  /** The folder's name. */
  name: string;
  dir: string;
  manifest: ConnectorManifest;
}

/** A folder in the plugins folder that is not a working connector, and why. */
export interface BrokenConnector {
  name: string;
  dir: string;
  problem: string;
  /** What to do about it, when it is not a fix in the connector (a newer contract: update strom). */
  hint?: string;
}

// ── the plugins folder ───────────────────────────────────────────────────────

export function pluginsDir(shared: string): string {
  return path.join(shared, "plugins");
}

export function connectorsDir(shared: string): string {
  return path.join(pluginsDir(shared), "connectors");
}

/** The plugins folder, with strom's own files: what goes where, the interface, the .gitignore. */
export function ensurePluginsDir(shared: string): string {
  const dir = connectorsDir(shared);
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (err) {
    if (!readOnly(err)) throw err;
    return dir; // a folder strom may not write here (an agent's sandbox): reading still works
  }
  const own: [string, string | undefined][] = [
    [path.join(pluginsDir(shared), ".gitignore"), readAsset("plugins", "gitignore")],
    [path.join(pluginsDir(shared), "README.md"), readAsset("plugins", "README.md")],
    [path.join(dir, "README.md"), readAsset("plugins", "connectors", "README.md")],
    // the newest SDK, for a connector written with an older one to copy over its own
    [path.join(dir, "sdk.ts"), readAsset("plugins", "connectors", "sdk.ts")],
  ];
  for (const [file, text] of own) {
    if (text === undefined) continue;
    let old: string | undefined;
    try {
      old = fs.readFileSync(file, "utf8");
    } catch {
      old = undefined;
    }
    if (old === text) continue;
    try {
      fs.writeFileSync(file, text);
    } catch (err) {
      // strom's own copies are refreshed when it may write here; a read-only sandbox keeps the old ones
      if (!readOnly(err)) throw err;
    }
  }
  return dir;
}

/** A write refused by the system (permissions, a read-only sandbox or disk). */
function readOnly(err: unknown): boolean {
  return ["EACCES", "EPERM", "EROFS"].includes((err as NodeJS.ErrnoException)?.code ?? "");
}

/** A name for a folder that has none usable: "Archiv Čížkov" → "archiv-cizkov". */
export function suggestName(folder: string): string | undefined {
  const s = foldText(folder)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s && NAME_RE.test(s) ? s : undefined;
}

// ── reading and checking ─────────────────────────────────────────────────────

export function readManifest(dir: string): ConnectorManifest {
  const file = path.join(dir, MANIFEST);
  if (!fs.existsSync(file)) throw new UsageError(`no ${MANIFEST} in ${dir}`, { hint: "a connector is a folder with connector.json — strom connector new <name> --url <portal> makes one" });
  let m: ConnectorManifest;
  try {
    m = JSON.parse(fs.readFileSync(file, "utf8")) as ConnectorManifest;
  } catch (err) {
    throw new UsageError(`${MANIFEST} is not valid JSON: ${(err as Error).message}`);
  }
  const problems: string[] = [];
  if (typeof m.interface === "number" && m.interface > Math.max(...INTERFACES))
    throw new UsageError(`${MANIFEST}: written for version ${m.interface} of the contract — this strom runs ${INTERFACES.join(", ")}`, { hint: "a newer strom runs it: strom update" });
  if (!INTERFACES.includes(m.interface)) problems.push(`interface: ${INTERFACE} — the version of the contract it is written for`);
  // Capabilities and routes of a newer contract: left out, the rest runs (an older strom, a connector built for a newer one).
  const newer: string[] = [];
  const known = <T extends string>(list: unknown, all: readonly T[], what: string): T[] | unknown => {
    if (!Array.isArray(list) || list.some((x) => typeof x !== "string")) return list;
    const unknown = list.filter((x) => !all.includes(x as T) && /^[a-z][a-z-]*$/.test(x));
    newer.push(...unknown.map((x) => `${what} ${x}`));
    return list.filter((x) => !unknown.includes(x));
  };
  m.can = known(m.can, CAPABILITIES, "can") as Capability[];
  if (m.routes !== undefined) m.routes = known(m.routes, ROUTES, "route") as Route[];
  if (newer.length) m.newer = newer;
  if (!m.title || typeof m.title !== "string") problems.push("title: the archive or portal");
  if (!Array.isArray(m.run) || !m.run.length || m.run.some((x) => typeof x !== "string")) problems.push('run: the program, e.g. ["node", "connector.ts"]');
  if (!Array.isArray(m.hosts) || !m.hosts.length || m.hosts.some((h) => typeof h !== "string" || !/^(\*\.)?[a-z0-9.-]+$/i.test(h))) problems.push('hosts: the host names it contacts, e.g. ["digi.example.org"]');
  if (!Array.isArray(m.can) || !m.can.length || m.can.some((c) => !CAPABILITIES.includes(c))) problems.push(`can: some of ${CAPABILITIES.join(", ")}`);
  if (!m.policy || !["allowed", "manual", "unknown"].includes(m.policy.automation)) problems.push("policy.automation: allowed, manual or unknown — what the portal's terms say");
  if (m.routes !== undefined) {
    if (!Array.isArray(m.routes) || !m.routes.length || m.routes.some((r) => !ROUTES.includes(r)) || new Set(m.routes).size !== m.routes.length)
      problems.push(`routes: some of ${ROUTES.join(", ")}, the usual one first`);
    else if (m.routes.includes("browser") && Array.isArray(m.can) && !m.can.includes("locate"))
      problems.push('routes "browser": the connector says where the images are — add "locate" to can (see the contract)');
  }
  if (m.browser !== undefined) {
    const open = m.browser && typeof m.browser === "object" ? m.browser.open : undefined;
    const u = typeof open === "string" && URL.canParse(open) ? new URL(open) : undefined;
    if (!m.browser || typeof m.browser !== "object" || (open !== undefined && (!u || !/^https?:$/.test(u.protocol) || !Array.isArray(m.hosts) || !hostAllowed(u.hostname, m.hosts))))
      problems.push("browser.open: a page on one of its hosts, e.g. the portal's start page");
    if (m.browser && typeof m.browser === "object" && m.browser.pages !== undefined) {
      if (typeof m.browser.pages !== "boolean") problems.push("browser.pages: true or false");
      else if (m.browser.pages && JSON.stringify(m.routes) !== JSON.stringify(["browser"]))
        problems.push('browser.pages: every request goes through the browser — routes must be ["browser"] alone');
      else if (m.browser.pages && m.login !== undefined) problems.push("browser.pages: the user logs in in their own browser — no login in connector.json");
    }
  }
  if (m.login !== undefined) {
    const l = m.login;
    const fields = l && typeof l.fields === "object" && !Array.isArray(l.fields) ? Object.entries(l.fields) : [];
    if (!l || typeof l.about !== "string" || !l.about.trim()) problems.push("login.about: what an account of the portal gives");
    if (!fields.length || fields.length > 5 || fields.some(([k, v]) => !/^[a-z][a-z0-9_]*$/.test(k) || typeof v !== "string" || !v.trim()))
      problems.push('login.fields: what the user types in, e.g. {"user": "User name", "password": "Password"}');
    if (l && l.url !== undefined && typeof l.url !== "string") problems.push("login.url: where to get an account");
    if (l && l.required !== undefined && typeof l.required !== "boolean") problems.push("login.required: true or false");
  }
  if (problems.length) throw new UsageError(`${MANIFEST}: ${problems.join("; ")}`);
  return m;
}

/** Every folder in the plugins folder: the connectors that work, and those that do not (and why). */
export function scanConnectors(shared: string | undefined): { connectors: Connector[]; broken: BrokenConnector[] } {
  const connectors: Connector[] = [];
  const broken: BrokenConnector[] = [];
  if (!shared) return { connectors, broken };
  const base = ensurePluginsDir(shared);
  for (const e of fs.readdirSync(base, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (!e.isDirectory() || e.name.startsWith(".") || e.name.startsWith("_")) continue;
    const dir = path.join(base, e.name);
    if (!NAME_RE.test(e.name)) {
      const s = suggestName(e.name);
      broken.push({ name: e.name, dir, problem: `the folder's name is the connector's name: lowercase letters a–z, digits and dashes — rename it${s ? ` (e.g. ${s})` : ""}` });
      continue;
    }
    try {
      connectors.push({ name: e.name, dir, manifest: readManifest(dir) });
    } catch (err) {
      broken.push({ name: e.name, dir, problem: (err as Error).message, ...(err instanceof UsageError && err.hint ? { hint: err.hint } : {}) });
    }
  }
  return { connectors, broken };
}

export function listConnectors(shared: string | undefined): Connector[] {
  return scanConnectors(shared).connectors;
}

/** The ways a connector's images may come, the usual one first. */
export function routesOf(c: Connector): Route[] {
  return c.manifest.routes?.length ? c.manifest.routes : ["direct"];
}

/** The route the user chose for a connector (strom connector use), or its usual one. */
export function routeOf(env: Env, c: Connector): { via: Route; chosen?: RouteChoice } {
  const chosen = loadUserConfig(env).connectorRoutes?.[c.name];
  const routes = routesOf(c);
  return chosen && routes.includes(chosen.via) ? { via: chosen.via, chosen } : { via: routes[0]! };
}

/** Connectors whose images come through the user's own browser on this computer. */
export function browserConnectors(env: Env, shared: string | undefined): Connector[] {
  return listConnectors(shared).filter((c) => c.manifest.policy.automation !== "manual" && routeOf(env, c).via === "browser");
}

/** A site as written anywhere: lower case, without "*." or "www.". */
function siteOf(host: string): string {
  return bareHost(host).replace(/^www\./, "");
}

/**
 * The browser connectors a tree works with — the agent gets browser tools for their hosts, and only there: images
 * fetched through one, or an archive, book or record of the tree on its site. The plugins folder is shared by every
 * tree; a tree whose research never goes to that archive gets no browser.
 */
export function treeBrowserConnectors(tree: Tree, shared: string | undefined): Connector[] {
  const all = browserConnectors(tree.env, shared);
  if (!all.length) return [];
  const fetchedBy = new Set(tree.list<Media>("media").flatMap((m) => (m.fetched ? [m.fetched.connector] : [])));
  const hosts = new Set<string>();
  for (const r of [...tree.list<Repository>("repository"), ...tree.list<RecordSet>("recordset"), ...tree.list<Source>("source")])
    if (r.url && !r.retracted)
      try {
        hosts.add(siteOf(new URL(r.url).hostname));
      } catch {
        // not an address
      }
  return all.filter((c) => fetchedBy.has(c.name) || c.manifest.hosts.some((h) => hosts.has(siteOf(h))));
}

export function findConnector(shared: string | undefined, name: string): Connector {
  if (!shared) throw new StromError("Strom is not set up yet", { hint: "strom setup" });
  const { connectors, broken } = scanConnectors(shared);
  const hit = connectors.find((c) => c.name === name);
  if (hit) return hit;
  const bad = broken.find((b) => b.name === name);
  if (bad) throw new UsageError(`connector ${name} cannot run: ${bad.problem}`, { hint: bad.hint ?? `fix it in ${bad.dir} — the contract is ${path.join(connectorsDir(shared), "README.md")}` });
  const base = connectorsDir(shared);
  if (/[\\/]/.test(name) || fs.existsSync(path.join(name, MANIFEST)))
    throw new UsageError(`a connector runs from the plugins folder, by its name — not from ${name}`, { hint: `copy the folder into ${base} (or: strom connector add ${name}), then use its folder's name` });
  throw new UsageError(`no connector "${name}"`, {
    hint: connectors.length ? `known: ${connectors.map((c) => c.name).join(", ")}` : `none yet: copy a connector's folder into ${base}, or build one: strom connector new <name> --url <portal>`,
  });
}

/** Not part of the code: git, libraries (reported by directNetwork), the output of tests. */
const SKIP = new Set([".git", "node_modules", "__pycache__", ".venv", "venv", ".DS_Store", ".test"]);

function codeFiles(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (SKIP.has(e.name)) continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile()) out.push(p);
    }
  };
  walk(dir);
  return out;
}

/** The connector as it is now: the manifest and every file of it. */
export function connectorHash(dir: string): string {
  const h = crypto.createHash("sha256");
  for (const f of codeFiles(dir)) {
    h.update(path.relative(dir, f).split(path.sep).join("/") + "\0");
    h.update(fs.readFileSync(f));
    h.update("\0");
  }
  return h.digest("hex");
}

/** The language of a code file: each check below looks only where its words mean what it looks for. */
type Lang = "js" | "py" | "sh" | "other";
const LANG: Record<string, Lang> = {
  ".ts": "js", ".mts": "js", ".cts": "js", ".js": "js", ".mjs": "js", ".cjs": "js",
  ".py": "py", ".sh": "sh", ".bash": "sh",
  ".rb": "other", ".pl": "other", ".ps1": "other", ".bat": "other", ".cmd": "other",
};
/** Code that reaches the network or other programs directly — past strom's limiter — or that strom cannot read.
 *  `in`: the languages a check applies to; the manifest's `run` gets them all. */
const DIRECT: { re: RegExp; what: string; in: Lang[] }[] = [
  { re: /\bfetch\s*\(/, what: "fetch()", in: ["js", "other"] },
  { re: /(from|require\(|import\()\s*["'](node:)?(https?|http2|net|tls|dgram|dns|undici)["']/, what: "a network module", in: ["js", "other"] },
  { re: /(from|require\(|import\()\s*["'](node:)?(child_process|vm|worker_threads)["']/, what: "child_process, vm or workers (other programs, code strom cannot check)", in: ["js", "other"] },
  { re: /\bnew\s+(XMLHttpRequest|WebSocket|EventSource)\b/, what: "XMLHttpRequest/WebSocket", in: ["js", "other"] },
  { re: /(?<![.\w$])eval\s*\(|\bnew\s+Function\s*\(|\bprocess\.(binding|dlopen)\b/, what: "code built at run time", in: ["js", "other"] },
  { re: /\b(import|require)\s*\(\s*[^"'`\s)]/, what: "a module named at run time (strom cannot check it)", in: ["js", "other"] },
  { re: /^\s*(import|from)\s+(requests|urllib3?|http|socket|httpx|aiohttp|subprocess|ctypes|ftplib|pycurl|importlib)\b/, what: "a Python module for the network or other programs", in: ["py", "other"] },
  { re: /\bos\.(system|popen|exec\w*|spawn\w*|fork)\s*\(|\b__import__\s*\(|(?<![.\w])(exec|eval)\s*\(/, what: "Python: other programs or code built at run time", in: ["py", "other"] },
  { re: /\b(curl|wget|ncat|socat|telnet|Invoke-WebRequest|Invoke-RestMethod)\b/, what: "a downloader program", in: ["sh", "other"] },
];
/** Libraries inside the folder: strom cannot check what they do. */
const LIBRARIES = ["node_modules", ".venv", "venv", "site-packages"];

export function directNetwork(c: Pick<Connector, "dir"> & { manifest?: Pick<ConnectorManifest, "run"> }): string[] {
  const found: string[] = [];
  for (const lib of LIBRARIES) if (fs.existsSync(path.join(c.dir, lib))) found.push(`${lib}/ — libraries strom cannot check`);
  const run = c.manifest?.run?.join(" ") ?? "";
  for (const d of DIRECT) if (d.re.test(run)) found.push(`${MANIFEST} run: ${d.what}`);
  for (const f of codeFiles(c.dir)) {
    const lang = LANG[path.extname(f).toLowerCase()];
    if (!lang) continue;
    fs.readFileSync(f, "utf8")
      .split("\n")
      .forEach((line, i) => {
        if (/^\s*(\/\/|#|\*|\/\*)/.test(line)) return;
        for (const d of DIRECT) if (d.in.includes(lang) && d.re.test(line)) found.push(`${path.relative(c.dir, f)}:${i + 1} ${d.what}`);
      });
  }
  return found;
}

// ── consents (the user's, on a terminal — never an agent's) ──────────────────

export interface ConnectorConsent {
  /** The folder the user allowed. */
  dir: string;
  /** The code as it was then — binding only for code that reaches the network itself. */
  hash: string;
  hosts: string[];
  at: string;
  source?: string;
}

export interface Consents {
  connectors: Record<string, ConnectorConsent>;
  hosts: Record<string, { at: string; connector?: string; terms?: string }>;
}

export function consentsFile(env: Env): string {
  return path.join(configDir(env), "consents.json");
}

export function loadConsents(env: Env): Consents {
  const c = readJsonIfExists<Partial<Consents>>(consentsFile(env)) ?? {};
  return { connectors: c.connectors ?? {}, hosts: c.hosts ?? {} };
}

export function saveConsents(env: Env, c: Consents): void {
  writeJson(consentsFile(env), c);
}

export const bareHost = (h: string) => h.replace(/^\*\./, "").toLowerCase();

/** Did the user ask to be asked before a connector runs? (strom config set connectors.consent on) */
export function consentRequired(env: Env): boolean {
  return new Settings(env, {}).connectorsConsent();
}

/**
 * What is still missing before this connector may run. With consents on: the
 * user's yes to its folder, and to each of its hosts. The folder is allowed as
 * a whole — the user's agent may go on improving it — as long as its code
 * reaches the network only through strom. Code that goes round strom needs a
 * yes exactly as it is, consents on or off, so every change of it needs a new one.
 */
export function missingConsents(env: Env, c: Connector): { code?: "new" | "changed"; hosts: string[] } {
  const all = loadConsents(env);
  const given = all.connectors[c.name];
  const known = !!given && path.resolve(given.dir) === path.resolve(c.dir);
  const direct = directNetwork(c).length > 0;
  if (!consentRequired(env)) {
    const code = !direct ? undefined : !known ? "new" : given.hash !== connectorHash(c.dir) ? "changed" : undefined;
    return { ...(code ? { code } : {}), hosts: [] };
  }
  const code = !known ? "new" : direct && given.hash !== connectorHash(c.dir) ? "changed" : undefined;
  return { ...(code ? { code } : {}), hosts: c.manifest.hosts.map(bareHost).filter((h) => !all.hosts[h]) };
}

/** Has the code changed since the user allowed it? (Only a note while it keeps to strom's network.) */
export function changedSinceConsent(env: Env, c: Connector): boolean {
  const given = loadConsents(env).connectors[c.name];
  return !!given && given.hash !== connectorHash(c.dir);
}

/** Connectors that may fetch now — nothing left to allow, not manual — for the host of a URL. */
export function readyConnectors(env: Env, shared: string | undefined, url: string): Connector[] {
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    return [];
  }
  return listConnectors(shared).filter((c) => {
    if (!c.manifest.can.includes("fetch") || c.manifest.policy.automation === "manual" || !hostAllowed(host, c.manifest.hosts)) return false;
    const miss = missingConsents(env, c);
    return !miss.code && !miss.hosts.length;
  });
}

/** The warning the user reads before allowing automated access to an archive. */
export function hostWarning(host: string, c?: Connector, pace: Pace = paceOf(c?.manifest.policy.pace)): string {
  const p = c?.manifest.policy;
  return [
    `Automated access to ${host}${c ? ` (${c.manifest.title}, connector ${c.name})` : ""}`,
    "  · Archives run small servers: going too fast slows the archive for everyone and gets your IP blocked.",
    `  · Terms of use: ${p?.terms || "not found yet — read them on the portal before you allow this"}${p?.termsSummary ? `\n    ${p.termsSummary}` : ""}`,
    p ? `  · The connector's reading of them: automation ${p.automation}${p.officialExport ? `; official export: ${p.officialExport}` : ""}` : undefined,
    `  · strom sends one request at a time, ${paceText(pace)}; it stops at the first`,
    "    refusal (401/403) and leaves the archive alone for a day, and for an hour when it asks twice to",
    "    slow down or stops answering.",
    "  · You are responsible for how you use the archive. Prefer its official export where there is one;",
    "    when in doubt, ask the archive.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function codeWarning(c: Connector, source: string, direct: string[]): string {
  const m = c.manifest;
  return [
    `Connector ${c.name}${m.version ? ` ${m.version}` : ""} — ${m.title}`,
    `  from:      ${source}`,
    `  runs:      ${m.run.join(" ")}  (a program on this computer, in ${c.dir})`,
    `  contacts:  ${m.hosts.join(", ")} — only through strom's limiter`,
    `  can:       ${m.can.join(", ")}`,
    direct.length
      ? `  ⚠ its code reaches the network or other programs directly — strom cannot pace or stop that:\n${direct.slice(0, 8).map((d) => `      ${d}`).join("\n")}\n    you will be asked again after every change of it`
      : "  its code uses no network of its own (checked); your agent may go on improving it without asking you again",
    m.policy.automation === "manual" ? "  ⚠ its own reading of the portal's terms: automation is not allowed — it only helps you download by hand" : undefined,
  ]
    .filter(Boolean)
    .join("\n");
}

// ── images: an error page or a broken download is not a scan ─────────────────

const MAGIC: { kind: string; at: number; bytes: number[] }[] = [
  { kind: "jpeg", at: 0, bytes: [0xff, 0xd8, 0xff] },
  { kind: "png", at: 0, bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { kind: "gif", at: 0, bytes: [0x47, 0x49, 0x46, 0x38] },
  { kind: "tiff", at: 0, bytes: [0x49, 0x49, 0x2a, 0x00] },
  { kind: "tiff", at: 0, bytes: [0x4d, 0x4d, 0x00, 0x2a] },
  { kind: "jp2", at: 0, bytes: [0x00, 0x00, 0x00, 0x0c, 0x6a, 0x50, 0x20, 0x20] },
  { kind: "jp2", at: 0, bytes: [0xff, 0x4f, 0xff, 0x51] },
  { kind: "webp", at: 8, bytes: [0x57, 0x45, 0x42, 0x50] },
  { kind: "bmp", at: 0, bytes: [0x42, 0x4d] },
  { kind: "heic", at: 4, bytes: [0x66, 0x74, 0x79, 0x70] },
];

/** Width and height from the file's header, when strom can read them (JPEG, PNG). */
export function sizeOf(bytes: Uint8Array): { width: number; height: number } | undefined {
  try {
    const s = imageSize(bytes);
    return s && s.width > 0 && s.height > 0 ? s : undefined;
  } catch {
    return undefined; // too short to hold a size
  }
}

/** The longer side a whole image has at least — anything smaller is a placeholder or a thumbnail (a part: a sliver). */
export const MIN_SIDE = { whole: 400, part: 64 } as const;

/**
 * Why a downloaded file is not a whole image, or undefined when it is one. A
 * portal may answer 200 with a stand-in: an error page, a file cut short, a
 * picture of 1×1 or 120×97 px in place of an image it will not give.
 * A tile is only checked for being a whole file (the last of a row may be a few pixels).
 */
export function imageProblem(file: string, want: "whole" | "part" | "tile" = "whole"): string | undefined {
  const size = fs.statSync(file).size;
  if (size < 64) return `${size} bytes — too small for an image`;
  const fd = fs.openSync(file, "r");
  try {
    const head = Buffer.alloc(16);
    fs.readSync(fd, head, 0, 16, 0);
    const tail = Buffer.alloc(Math.min(1024, size));
    fs.readSync(fd, tail, 0, tail.length, size - tail.length);
    const kind = MAGIC.find((m) => m.bytes.every((b, i) => head[m.at + i] === b))?.kind;
    if (!kind) {
      const start = head.toString("latin1").replace(/[^\x20-\x7e]+/g, " ").trim().slice(0, 16);
      return `not an image (it begins "${start}") — an error page?`;
    }
    // FF D9 ends a JPEG; inside the compressed data an FF is never followed by D9
    if (kind === "jpeg" && !tail.includes(Buffer.from([0xff, 0xd9]))) return "a JPEG cut short (no end marker) — the download broke off";
    if (kind === "png" && !tail.includes(Buffer.from("IEND"))) return "a PNG cut short (no end) — the download broke off";
    if (want === "tile") return undefined;
    const dims = imageSizeOfFile(file);
    if (dims && Math.max(dims.width, dims.height) < MIN_SIDE[want])
      return `${dims.width}×${dims.height} px — a placeholder or a thumbnail, not ${want === "part" ? "a part of" : ""} a scan`.replace("  ", " ");
    return undefined;
  } finally {
    fs.closeSync(fd);
  }
}

const TILES_MAX = 4096;
const PIXELS_MAX = 40_000_000; // about 600 MB of memory to put together; a whole page at full size is rarely wanted (a part is)

/**
 * An image a portal gives only in tiles (Zoomify, DeepZoom …), put together
 * into one: each tile at its x, y (top left corner, in pixels of the image) of
 * a width × height picture, written to `out` (JPEG, or PNG for a .png name);
 * the tiles are removed. Overlaps are fine; a gap — a tile left out — is not.
 * Why it could not, or undefined.
 */
export function assembleTiles(workDir: string, tiles: unknown, width: unknown, height: unknown, out: string): string | undefined {
  const W = Number(width);
  const H = Number(height);
  if (!Number.isInteger(W) || !Number.isInteger(H) || W < 1 || H < 1 || W > 65_535 || H > 65_535 || W * H > PIXELS_MAX)
    return `tiles need the image's width and height: whole pixels, at most ${PIXELS_MAX / 1e6} million together (got ${String(width)} × ${String(height)})`;
  if (!Array.isArray(tiles) || !tiles.length || tiles.length > TILES_MAX) return `tiles: a list of 1–${TILES_MAX} tiles, each {file, x, y}`;
  const CELL = 8; // a grid of 8 px cells: each must be covered by a tile
  const cols = Math.ceil(W / CELL);
  const covered = new Uint8Array(cols * Math.ceil(H / CELL));
  let canvas: RawImage | undefined;
  const files: string[] = [];
  for (const t of tiles) {
    const { file, x, y } = (t && typeof t === "object" ? t : {}) as Record<string, unknown>;
    if (typeof file !== "string" || !file || !Number.isInteger(x) || !Number.isInteger(y)) return `a tile needs file, x and y (whole pixels): ${JSON.stringify(t)?.slice(0, 120)}`;
    const f = path.join(workDir, safeName(file));
    if (!fs.existsSync(f)) return `tile ${file}: no such file was saved`;
    const problem = imageProblem(f, "tile");
    if (problem) return `tile ${file}: ${problem}`;
    let img: RawImage;
    try {
      img = decodeImage(fs.readFileSync(f));
    } catch (err) {
      return `tile ${file}: ${(err as Error).message}`;
    }
    files.push(f);
    const [tx, ty] = [x as number, y as number];
    canvas ??= blank(W, H, img.channels);
    if (img.channels > canvas.channels) canvas = toRgb(canvas);
    paste(canvas, img.channels < canvas.channels ? toRgb(img) : img, tx, ty);
    for (let cy = Math.max(0, Math.floor(ty / CELL)); cy < Math.min(Math.ceil(H / CELL), Math.ceil((ty + img.height) / CELL)); cy++) {
      const my = Math.min(cy * CELL + CELL / 2, H - 1);
      if (my < ty || my >= ty + img.height) continue;
      for (let cx = Math.max(0, Math.floor(tx / CELL)); cx < Math.min(cols, Math.ceil((tx + img.width) / CELL)); cx++) {
        const mx = Math.min(cx * CELL + CELL / 2, W - 1);
        if (mx >= tx && mx < tx + img.width) covered[cy * cols + cx] = 1;
      }
    }
  }
  const gap = covered.indexOf(0);
  if (gap >= 0)
    return `the tiles leave a gap near ${Math.min((gap % cols) * CELL + CELL / 2, W - 1)},${Math.min(Math.floor(gap / cols) * CELL + CELL / 2, H - 1)} px of ${W}×${H} — a tile is missing, or its x, y is wrong`;
  fs.writeFileSync(out, encodeImage(canvas!, /\.png$/i.test(out) ? "png" : "jpeg", 90));
  for (const f of files) if (f !== out) fs.rmSync(f, { force: true });
  return undefined;
}

// ── running ──────────────────────────────────────────────────────────────────

export type ConnectorRequest =
  | { cmd: "find"; place: string; years?: string }
  | { cmd: "list"; book: string }
  | { cmd: "fetch"; book: string; images: number[] }
  | { cmd: "part"; book: string; image: number; region: Region }
  | { cmd: "locate"; book: string; images: number[]; region?: Region };

export interface FoundBook {
  id?: string;
  title: string;
  callNumber?: string;
  years?: string;
  kinds?: string[];
  places?: string[];
  url?: string;
  images?: number;
}

export interface FetchedImage {
  n?: number;
  file: string;
  url?: string;
  page?: string;
  /** A part of the image (cmd part): where it is in the whole image. */
  region?: Region;
}

/** Where an image is (cmd locate): its own address — one request gives it — and the page a person opens. */
export interface LocatedImage {
  n: number;
  src: string;
  url?: string;
  page?: string;
  /** A part of the image: where it is in the whole image. */
  region?: Region;
}

export interface RunReport {
  books: FoundBook[];
  images: FetchedImage[];
  located: LocatedImage[];
  requests: number;
  /** Pages answered from what the browser got (browser.pages). */
  pages?: number;
  /** browser.pages: the request the browser has to make before the connector can go on. */
  needs?: PageRequest;
  logs: string[];
  /** Why the run ended early, if it did. */
  stopped?: string;
}

export interface RunOptions {
  env: Env;
  /** Where strom writes what the connector saves. */
  workDir: string;
  /** <shared>/net — the limiter's state. */
  netDir: string;
  /** At most this many requests (a test run). */
  maxRequests?: number;
  onLog?: (line: string) => void;
  /** browser.pages: the pages the browser got; a request without one stops the run (report.needs). */
  pages?: (r: PageRequest) => PageAnswer | undefined;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

/** A minimal environment: the connector gets no secrets of the shell that runs strom. */
function connectorEnv(env: Env, workDir: string): NodeJS.ProcessEnv {
  const keep = ["PATH", "HOME", "USERPROFILE", "SYSTEMROOT", "TEMP", "TMP", "TMPDIR", "LANG", "LC_ALL", "APPDATA", "LOCALAPPDATA"];
  const out: NodeJS.ProcessEnv = {};
  for (const k of keep) if (env[k]) out[k] = env[k];
  out.STROM_CONNECTOR_WORKDIR = workDir;
  return out;
}

/**
 * The command line. A Node connector runs in the Node that runs strom (new
 * enough for TypeScript), under Node's permission model: it reads its own
 * folder and the work folder, writes only into the work folder, starts no
 * other programs — and from Node 25 on, reaches no network at all. It runs on
 * the Node strom runs on.
 */
function commandLine(c: Connector, dir: string, workDir: string, env: Env): [string, string[]] {
  const [cmd, ...args] = c.manifest.run;
  if (cmd !== "node") return [cmd!, args];
  return [nodeForPlugins(env), ["--permission", `--allow-fs-read=${dir}`, `--allow-fs-read=${workDir}`, `--allow-fs-write=${workDir}`, ...args]];
}

/** The Node a connector written in TypeScript runs in: strom's own (22.18 and newer run TypeScript as it is). */
function nodeForPlugins(_env: Env): string {
  return process.execPath;
}

const safeName = (s: string) => path.basename(s).replace(/[^\p{L}\p{M}\p{N}._-]+/gu, "_").replace(/^\.+/, "_");

/** A part of an image as fractions of it (0–1), or undefined when it is not one. */
export function regionOf(v: unknown): Region | undefined {
  if (!v || typeof v !== "object") return undefined;
  const r = v as Record<string, unknown>;
  const [x, y, w, h] = [r.x, r.y, r.w, r.h].map(Number);
  if (![x, y, w, h].every((n) => Number.isFinite(n) && n! >= 0 && n! <= 1) || !(w! > 0) || !(h! > 0) || x! + w! > 1.0001 || y! + h! > 1.0001) return undefined;
  return { x: x!, y: y!, w: w!, h: h! };
}

/** Hosts of this computer: a login may go there over plain http (a portal the user runs, a test). */
const LOCAL = new Set(["127.0.0.1", "localhost", "[::1]"]);
const TEXT_MAX = 5 * 1024 * 1024;
const METHODS = new Set(["GET", "POST", "HEAD"]);

export async function runConnector(c: Connector, request: ConnectorRequest, opts: RunOptions): Promise<RunReport> {
  if (!c.manifest.can.includes(request.cmd)) throw new UsageError(`connector ${c.name} cannot ${request.cmd}`, { hint: `it can: ${c.manifest.can.join(", ")}` });
  fs.mkdirSync(opts.workDir, { recursive: true });
  // real paths: the permission model compares the paths the program uses with these
  const dir = fs.realpathSync(c.dir);
  const workDir = fs.realpathSync(opts.workDir);
  const report: RunReport = { books: [], images: [], located: [], requests: 0, logs: [] };
  const cookies = new CookieJar(); // the cookies of this run, and of no other
  const seen = new Map<string, number | undefined>(); // the images of this run by their content
  // the user's login, put into requests by strom and taken out of every answer
  const login = c.manifest.login ? loginOf(opts.env, c) : undefined;
  const clean = redactor(login);
  const [cmd, args] = commandLine(c, dir, workDir, opts.env);
  const child = spawn(cmd, args, { cwd: dir, env: connectorEnv(opts.env, workDir), stdio: ["pipe", "pipe", "pipe"] });
  const send = (o: unknown) => {
    if (!child.stdin.destroyed && child.stdin.writable) child.stdin.write(JSON.stringify(o) + "\n");
  };
  const log = (s: string) => {
    report.logs.push(s);
    opts.onLog?.(s);
  };
  child.stdin.on("error", () => undefined); // a connector that ended does not read its answers
  let stderr = "";
  child.stderr.on("data", (d) => (stderr = (stderr + d).slice(-4000)));
  const exited = new Promise<number | null>((resolve) => {
    child.on("error", (err) => {
      report.stopped ??= `the connector could not start: ${err.message}`;
      resolve(null);
    });
    child.on("close", (code) => resolve(code));
  });
  const stop = (why: string) => {
    report.stopped ??= why;
    child.kill();
  };
  send({ interface: c.manifest.interface, ...request, ...(login ? { login: true } : {}) });
  const lines = readline.createInterface({ input: child.stdout });
  let queue = Promise.resolve();
  lines.on("line", (line) => {
    // one message at a time, in order: the limiter paces the requests anyway
    queue = queue.then(() => (report.stopped ? undefined : handle(line))).catch((err) => stop(`strom failed: ${(err as Error).message}`));
  });
  const handle = async (line: string) => {
    if (!line.trim()) return;
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(line) as Record<string, unknown>;
    } catch {
      log(line.slice(0, 300)); // plain output is a log line
      return;
    }
    if (typeof msg.log === "string") return log(msg.log);
    if (typeof msg.error === "string") return stop(`the connector: ${msg.error}`);
    if (msg.done) {
      child.stdin.end(); // nothing more to answer: its input closes, it can exit
      return;
    }
    if (msg.book && typeof msg.book === "object") {
      const b = msg.book as FoundBook;
      if (typeof b.title === "string" && b.title.trim()) report.books.push({ ...b, title: b.title.normalize("NFC") });
      else log(`a book without a title: ${line.slice(0, 200)}`);
      return;
    }
    if (msg.located && typeof msg.located === "object") {
      const l = msg.located as Record<string, unknown>;
      if (request.cmd !== "locate") return log(`"located" answers locate only: ${line.slice(0, 200)}`);
      const n = Number(l.n);
      const src = typeof l.src === "string" && URL.canParse(l.src) ? new URL(l.src) : undefined;
      if (!Number.isInteger(n) || !request.images.includes(n)) return stop(`located image ${String(l.n ?? "?")}: not one of the images asked for (${request.images.join(", ")})`);
      if (!src || !/^https?:$/.test(src.protocol)) return stop(`located image ${n}: src must be the image's own http(s) address`);
      if (!hostAllowed(src.hostname, c.manifest.hosts)) return stop(`located image ${n}: ${src.hostname} is not one of its hosts (${c.manifest.hosts.join(", ")})`);
      report.located.push({
        n,
        src: src.toString(),
        ...(typeof l.url === "string" && l.url ? { url: l.url } : {}),
        ...(typeof l.page === "string" && l.page ? { page: l.page } : {}),
        ...(request.region ? { region: regionOf(l.region) ?? request.region } : {}),
      });
      return;
    }
    if (msg.image && typeof msg.image === "object") {
      const { region: got, tiles, width, height, ...im } = msg.image as FetchedImage & { tiles?: unknown; width?: unknown; height?: unknown };
      const file = path.join(workDir, safeName(String(im.file ?? "")));
      if (tiles !== undefined) {
        // a portal that gives the image in tiles only: strom puts them together into the file
        if (!im.file) return stop(`image ${im.n ?? "?"}: tiles are put together into its file — give the file a name`);
        const why = assembleTiles(workDir, tiles, width, height, file);
        if (why) return stop(`image ${im.n ?? "?"}: ${why}`);
      }
      if (!im.file || !fs.existsSync(file)) return stop(`image ${im.n ?? "?"}: no file ${im.file ?? ""} was saved`);
      const problem = imageProblem(file, request.cmd === "part" ? "part" : "whole");
      if (problem) return stop(`image ${im.n ?? "?"} (${path.basename(file)}): ${problem}`);
      if (request.cmd !== "part") {
        // the same file as another image: what a portal gives in place of the images it will not give
        const hash = crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
        if (seen.has(hash) && seen.get(hash) !== im.n) {
          // two scans are never the same to the byte: neither is the image asked for
          const same = seen.get(hash);
          report.images = report.images.filter((i) => i.n !== same);
          return stop(`image ${im.n ?? "?"} (${path.basename(file)}): the same file as image ${same ?? "?"} — a placeholder in place of both, neither is kept`);
        }
        seen.set(hash, im.n);
      }
      if (request.cmd === "part") {
        if (im.n !== request.image) return stop(`asked for a part of image ${request.image}, it gave image ${im.n ?? "?"}`);
        // the part it got, when the portal cut it a little differently; else the part asked for
        report.images.push({ ...im, file, region: regionOf(got) ?? request.region });
      } else report.images.push({ ...im, file });
      return;
    }
    if (msg.http && typeof msg.http === "object") {
      const id = msg.id;
      const h = msg.http as { url?: unknown; method?: unknown; headers?: unknown; body?: unknown; form?: unknown; save?: unknown };
      const refuse = (error: string, message: string) => {
        send({ id, error, message });
        stop(message);
      };
      const method = String(h.method ?? (h.form !== undefined ? "POST" : "GET")).toUpperCase();
      if (typeof h.url !== "string") return refuse("http", "a request without a url");
      if (!METHODS.has(method)) return refuse("http", `method ${method}: GET, POST or HEAD`);
      if (h.body !== undefined && typeof h.body !== "string") return refuse("http", "body: a string");
      // a value of a form or a header may be the user's login: {"login":"password"} — strom puts it in
      const missing: string[] = [];
      const secret: string[] = [];
      const value = (v: unknown, where: string): string => {
        if (v === null || typeof v !== "object" || typeof (v as { login?: unknown }).login !== "string") return String(v);
        const field = (v as { login: string }).login;
        secret.push(where);
        if (login?.values[field] === undefined) missing.push(field);
        return login?.values[field] ?? "";
      };
      const headers: Record<string, string> = {};
      if (h.headers && typeof h.headers === "object") for (const [k, v] of Object.entries(h.headers)) headers[k] = value(v, k);
      const privateHeaders = [...secret];
      let body = typeof h.body === "string" ? h.body : undefined;
      if (h.form !== undefined) {
        if (!h.form || typeof h.form !== "object" || Array.isArray(h.form)) return refuse("http", "form: an object of fields");
        if (body !== undefined) return refuse("http", "a request has a body or a form, not both");
        if (method !== "POST") return refuse("http", "a form is sent with POST");
        body = new URLSearchParams(Object.entries(h.form).map(([k, v]): [string, string] => [k, value(v, "form")])).toString();
        if (!Object.keys(headers).some((k) => k.toLowerCase() === "content-type")) headers["Content-Type"] = "application/x-www-form-urlencoded";
      }
      if (secret.length) {
        const u = URL.canParse(h.url) ? new URL(h.url) : undefined;
        if (!login) return refuse("login", `no login of the user for ${c.name} — the user saves one in their terminal: strom login ${c.name}`);
        if (missing.length) return refuse("login", `the login saved for ${c.name} has no ${[...new Set(missing)].join(", ")} — the user saves it again: strom login ${c.name}`);
        if (!u || (u.protocol !== "https:" && !LOCAL.has(u.hostname))) return refuse("login", `a login goes only over https, not to ${u?.origin ?? h.url}`);
        if (!hostAllowed(u.hostname, login.hosts)) return refuse("login", `the login was saved for ${login.hosts.join(", ")}, not for ${u.hostname} — the user saves it again for the connector as it is now: strom login ${c.name}`);
        const unfit = privateHeaders.find((k) => !/^[\t\x20-\x7e\x80-\xff]*$/.test(headers[k] ?? ""));
        if (unfit) return refuse("login", `the login cannot go in the header ${unfit}: it has letters a header cannot carry — send it in a form`);
      }
      if (opts.pages) {
        // a portal that answers a real browser only: the page comes from the user's browser, or the run waits for it
        if (secret.length) return refuse("login", `through the browser the user logs in in their own tab — ${c.name} sends no login there`);
        const u = URL.canParse(h.url) ? new URL(h.url) : undefined;
        if (!u || !/^https?:$/.test(u.protocol) || !hostAllowed(u.hostname, c.manifest.hosts)) return refuse("host", `${u?.hostname ?? h.url} is not one of its hosts (${c.manifest.hosts.join(", ")})`);
        const want: PageRequest = { method: method as PageRequest["method"], url: u.toString(), headers, ...(body !== undefined ? { body } : {}) };
        const got = opts.pages(want);
        if (!got) {
          report.needs = want;
          send({ id, error: "browser", message: "this page comes from the user's browser: strom plans it" });
          return stop(`it needs a page from your browser: ${method} ${u.toString()}`);
        }
        report.pages = (report.pages ?? 0) + 1;
        if (got.status === 401 || got.status === 403) return refuse("refused", `${u.hostname} answered ${got.status} in your browser — strom stops and leaves it alone for a day`);
        const answer = { id, status: got.status, type: got.contentType, headers: got.headers, url: got.url };
        if (typeof h.save === "string" && h.save) {
          const file = path.join(workDir, safeName(h.save));
          fs.writeFileSync(file, got.body);
          send({ ...answer, file, bytes: got.body.length, ...sizeOf(got.body) });
        } else if (got.body.length > TEXT_MAX) refuse("too-big", `an answer of ${got.body.length} bytes is too big as text — ask with "save"`);
        else send({ ...answer, text: got.body.toString("utf8") });
        return;
      }
      if (opts.maxRequests !== undefined && report.requests >= opts.maxRequests) return refuse("cap", `the run's limit of ${opts.maxRequests} requests (a test: --max <n>, at most 50)`);
      report.requests++;
      try {
        const res = await politeRequest(h.url, {
          stateDir: opts.netDir,
          hosts: c.manifest.hosts,
          pace: c.manifest.policy.pace ?? {},
          method: method as "GET" | "POST" | "HEAD",
          headers,
          ...(body !== undefined ? { body } : {}),
          ...(secret.length ? { private: { headers: privateHeaders, body: secret.includes("form") } } : {}),
          cookies,
          ...(opts.fetchImpl ? { fetchImpl: opts.fetchImpl } : {}),
          ...(opts.sleep ? { sleep: opts.sleep } : {}),
        });
        const check = botCheck(res.body, res.headers);
        if (check)
          log(`${new URL(h.url).hostname} answered with ${check}'s check whether a person is there, not the page — it gives its pages to a real browser only: "browser": {"pages": true} (the contract, section 5)`);
        const answer = { id, status: res.status, type: res.contentType, headers: Object.fromEntries(Object.entries(res.headers).map(([k, v]) => [k, clean(v)])), url: clean(res.url) };
        if (typeof h.save === "string" && h.save) {
          const file = path.join(workDir, safeName(h.save));
          fs.writeFileSync(file, res.body);
          // an image's size from its header: a connector sees a thumbnail or a placeholder before it gives it as the image
          send({ ...answer, file, bytes: res.body.length, ...sizeOf(res.body) });
        } else if (res.body.length > TEXT_MAX) {
          refuse("too-big", `an answer of ${res.body.length} bytes is too big as text — ask with "save"`);
        } else send({ ...answer, text: clean(res.body.toString("utf8")) });
      } catch (err) {
        if (!(err instanceof NetError)) throw err;
        // every refusal ends the run: nothing more goes to an archive that said no, or went silent
        refuse(err.failure, clean(err.message));
      }
      return;
    }
    log(`unknown message: ${line.slice(0, 200)}`);
  };
  const code = await exited;
  await queue;
  lines.close();
  if (code && !report.stopped) report.stopped = `the connector ended with code ${code}${stderr.trim() ? `: ${stderr.trim().split("\n").slice(-3).join(" | ")}` : ""}`;
  return report;
}
