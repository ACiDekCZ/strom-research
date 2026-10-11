// What an archive's terms let strom do, decided in one place. Every way strom reaches an archive — a connector's
// catalogue and images, the browser's plan, a probe, the agent's browser tools — asks archiveLevel() and keeps to the
// strictest of what is known:
//
//   · the connector's own reading of the terms (policy.automation; a bot check, browser.pages, at least restricted)
//     — a connector the person has not confirmed counts its "allowed" as unknown, and a connector that says now it
//     may do more than it said before keeps what it said before (the latch `seen`) until the person accepts it;
//   · the archives of the family tree, matched by the site's registrable domain (an archive recorded as manual or
//     forbidden; one recorded unknown says nothing);
//   · the terms shipped with strom (assets/archives.json, core/knownterms.ts), a host and its subdomains — a confirmed
//     level: a connector's "allowed" there needs no person's word, a connector taken over there no confirmation;
//   · the strictest level strom ever saw for the host (`floor`), which only the person lowers;
//   · the host's robots.txt as strom read it (core/net.ts): one that keeps automated tools off the whole site makes the
//     archive restricted with the person's browser as its only way (`browserOnly`: no direct request at all, the
//     permission "through the browser" or by hand) — a path it keeps them off is refused request by request;
//   · a refusal of strom's client by the host (core/net.ts): forbidden until the person lifts it.
//
// Levels, from the most to the least strom does by itself:
//   allowed     catalogue and images, at the service's pace
//   restricted  catalogue by itself; images only with the person's permission for the archive: slowly (a person's
//               pace, HUMAN_PACE, unless the person set their own) or through their browser — else by hand
//   manual      catalogue by itself; images by hand only
//   forbidden   no automated request at all
//   unknown     (the terms not found, or the connector not confirmed) as restricted
//
// The person's permissions, the latch and the floor are kept in the user's settings folder (archives.json, beside
// consents.json — a file of its own: an older strom rewrites consents.json with what it knows and would lose them),
// keyed by the connector's own hosts, never wider. An agent may make an archive stricter; making it milder, giving
// a permission and accepting a connector's milder reading are the person's (cli requireHuman, a window).

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import net from "node:net";
import { spawnSync } from "node:child_process";
import { configDir, type Env } from "./paths.ts";
import { readJsonIfExists, writeJson } from "./json.ts";
import { acquireLock } from "./lock.ts";
import { bare, loopbackGuard, readPack, shippedTerms, strictestEntry, within, type KnownTerms } from "./knownterms.ts";
import { webDomain } from "./metrics.ts";
import { HUMAN_PACE, MIN_INTERVAL_MS, readHostState, REFUSED_FOREVER, robotsAll, type NetVerdict, type Pace, type RefusedKind, type ServicePace } from "./net.ts";
import { loadUserConfig, Settings } from "./config.ts";
import { installation, type Installation } from "./self.ts";
import { settingsTrust } from "./trust.ts";
import type { ConnectorManifest } from "./connector.ts";
import type { RecordSet, Repository } from "./model.ts";
import type { Tree } from "./tree.ts";

/** The levels, from the most strom does by itself to the least. */
export const LEVELS = ["allowed", "restricted", "manual", "forbidden"] as const;
export type Level = (typeof LEVELS)[number];
/** A level as read somewhere: unknown is restricted wherever strom decides. */
export type Claim = Level | "unknown";
export const CLAIMS: readonly Claim[] = ["allowed", "restricted", "manual", "forbidden", "unknown"];
/** The person's permission for an archive's images: slowly through strom, through their browser, or by hand. */
export const WAYS = ["slow", "browser", "manual"] as const;
export type Way = (typeof WAYS)[number];
/** The way a fetch takes its images: straight through strom, or through the user's browser. */
export type Route = "direct" | "browser";

const RANK: Record<Claim, number> = { allowed: 0, unknown: 1, restricted: 1, manual: 2, forbidden: 3 };

export function rank(l: Claim): number {
  return RANK[l];
}

/** The strictest of levels (undefined ones left out); restricted before unknown at the same rank (it is known). */
export function strictest(...ls: (Claim | undefined)[]): Claim {
  let out: Claim = "allowed";
  for (const l of ls) if (l && (RANK[l] > RANK[out] || (RANK[l] === RANK[out] && l === "restricted"))) out = l;
  return out;
}

/** A level as a floor keeps it: unknown is restricted. */
function asLevel(l: Claim): Level {
  return l === "unknown" ? "restricted" : l;
}

export { bare } from "./knownterms.ts";
export type { KnownTerms } from "./knownterms.ts";

/** A host given as an address, a host name or a wildcard: its bare name. */
export function hostOf(s: string): string {
  const t = s.trim().toLowerCase();
  if (/^https?:\/\//.test(t))
    try {
      return new URL(t).hostname;
    } catch {
      // as it is
    }
  return bare(t.replace(/\/.*$/, ""));
}

// ── the terms shipped with strom ─────────────────────────────────────────────

/** For tests in this process: the addresses a host name resolves to (else the system's resolver, once per name). */
export const termsHooks: { lookup?: (host: string) => string[] } = loopbackGuard;

const resolved = new Map<string, string[]>();

/** The addresses strom connects to for a host: an address as it is, a name as the system resolves it now. */
function addressesOf(host: string): string[] {
  const h = host.replace(/^\[|\]$/g, "");
  if (net.isIP(h)) return [h];
  if (termsHooks.lookup) return termsHooks.lookup(h);
  const kept = resolved.get(h);
  if (kept) return kept;
  let out: string[] = [];
  try {
    const r = spawnSync(process.execPath, ["-e", "require('node:dns').lookup(process.argv[1], { all: true }, (e, a) => process.stdout.write(JSON.stringify(e ? [] : a.map((x) => x.address))))", h], { encoding: "utf8", timeout: 10_000 });
    const v = JSON.parse(r.stdout || "[]") as unknown;
    out = Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    out = [];
  }
  resolved.set(h, out);
  return out;
}

/** This computer itself: 127.0.0.0/8, ::1 (an IPv4 one mapped into IPv6 too). */
function loopback(a: string): boolean {
  const v4 = a.replace(/^::ffff:/i, "");
  return (net.isIPv4(v4) && v4.startsWith("127.")) || a === "::1";
}

/**
 * The known terms: strom's own (assets/archives.json), and for a test those of STROM_ARCHIVES_FILE — taken only with
 * settings of its own (STROM_CONFIG_DIR) and only besides strom's own: a level there can make an archive stricter,
 * never take strom's away. An "allowed" of that file (it confirms a connector, as strom's list does) only for this
 * computer itself — the addresses strom connects to all loopback (127.0.0.1, ::1, localhost: a name resolved, never
 * taken by its name) — and only in an isolated environment (STROM_ISOLATED, or strom run from its sources): a public
 * host given as allowed there is left out.
 */
export function knownTerms(env: Env): KnownTerms[] {
  const own = shippedTerms();
  if (!env.STROM_ARCHIVES_FILE || !env.STROM_CONFIG_DIR) return own;
  const isolated = env.STROM_ISOLATED === "1" || installation().kind === "source";
  const extra = readPack(path.resolve(env.STROM_ARCHIVES_FILE)).filter((k) => k.level !== "allowed" || (isolated && addressesOf(k.host).length > 0 && addressesOf(k.host).every(loopback)));
  // asked only while they still lead here: resolved again before each request (core/net.ts)
  for (const k of extra) if (k.level === "allowed") loopbackGuard.hosts.add(k.host.replace(/^\[|\]$/g, ""));
  return [...own, ...extra.map((k) => ({ ...k, extra: true }))];
}

/** What strom's known terms say of a host: the strictest entry for it or a site above it. */
export function termsFor(env: Env, host: string): KnownTerms | undefined {
  return strictestEntry(knownTerms(env).filter((k) => within(host, k.host)));
}

/** Every host of a connector is in strom's known terms: its level is a confirmed one (no takeover to confirm). */
export function coveredByTerms(env: Env, hosts: string[]): boolean {
  return hosts.length > 0 && hosts.every((h) => !!termsFor(env, bare(h)));
}

// ── what the person decided, kept in their settings folder ───────────────────

/** What strom keeps of a connector's reading, as it was when the person saw it (or strom took it over). */
export interface Seen {
  level: Claim;
  /** A hash of its terms and their summary then: a reading that changed is a new one. */
  termsHash?: string;
  /** The address of the terms then (the one page a forbidden archive is asked for besides robots.txt). */
  terms?: string;
  /** The service's pace it gave then: a faster one later counts only once the person accepts it. */
  pace?: { minIntervalMs?: number; perHour?: number };
  at: string;
  /** takeover: there when this strom first ran (it runs as before); person: accepted by the person; strom: made stricter. */
  by: "takeover" | "person" | "strom";
  /** The person kept this reading when the connector said it may do more: that milder reading is not asked again. */
  declined?: { to: Claim; termsHash: string; at: string };
}

export interface ArchiveRecord {
  /** The person's permission for the images. */
  way?: Way;
  at?: string;
  /** Where the person gave it: in their terminal, in a window of the system, in strom's menu. */
  by?: "terminal" | "window" | "menu";
  connector?: string;
  terms?: string;
  /** The strictest level strom ever saw for the host: an agent makes it stricter, only the person milder. */
  floor?: Level;
  floorBy?: "strom" | "agent" | "person";
  floorAt?: string;
  /** The connector whose own reading made strom keep the floor (floorBy strom); none when the archive's terms or the tree did. */
  floorConnector?: string;
  /** Per connector of the host: its reading as strom keeps it (the latch). */
  seen?: Record<string, Seen>;
  /** Per connector: the service's pace when the person gave the permission (a connector not confirmed yet). */
  seenPace?: Record<string, { minIntervalMs?: number; perHour?: number }>;
  /** What the person's first decision changed (the record new, its connector and terms, the paces it kept, its question): put back by "ask again". */
  prior?: { none?: boolean; connector?: string; terms?: string; seenPace?: string[]; /** Kept by an older strom: no longer brought back. */ pending?: PendingQuestion };
  /**
   * The host refused strom's client (core/net.ts RefusedKind client): left alone until the person lifts it (strom allow
   * host --unblock) — kept here too, where an agent cannot write: a shared folder's net/ wiped lifts nothing.
   */
  refused?: { host: string; at: string; status?: number; connector?: string };
  /** The host's robots.txt keeps automated tools off the whole site (its line): browser only — kept here as refused is. */
  robots?: { host: string; at: string; line: string };
}

/** A question for the person that waits (the menu's What waits for you shows them; core/terms.ts only keeps them). */
export interface PendingQuestion {
  /**
   * permission: the images of a restricted archive need the person's decision; takeover: the connectors there when
   * this strom first ran are to be confirmed once (they run as before meanwhile); milder: a connector says now that
   * an archive allows more than it said before.
   */
  kind: "permission" | "takeover" | "milder";
  key: string;
  at: string;
  host?: string;
  connector?: string;
  /** The archive as a person names it. */
  title?: string;
  level?: Claim;
  /** permission: the way asked for (that of the connector's route). */
  way?: "slow" | "browser";
  /** permission: the ways the person may choose. */
  choices?: Way[];
  /** permission: the archive lets automated tools in only through a person's browser — never "slowly". */
  browserOnly?: boolean;
  /** permission: when a window of the system asked it last (no other window for it within a day). */
  window?: string;
  terms?: string;
  quote?: string;
  /** The quote is strom's known terms of the archive, the site's robots.txt as strom's list quotes it, or the connector's own reading (its termsSummary, D5). */
  quoteBy?: "strom" | "connector" | "robots";
  /** permission: the research and the task that needed it last. */
  tree?: string;
  task?: string;
  /** permission: every research's task that needed it (`at` is when it was first asked, `last` the latest try). */
  tasks?: { tree: string; task: string }[];
  /** permission: how many times a command needed it. */
  tries?: number;
  last?: string;
  /** takeover: the connectors taken over (those strom's known terms do not know). */
  connectors?: string[];
  /** takeover: each one's hosts (a list grown later covers more of them). */
  hosts?: Record<string, string[]>;
  /** milder: what was kept, and what the connector says now. */
  from?: Claim;
  to?: Claim;
}

export interface ArchivesStore {
  archives: Record<string, ArchiveRecord>;
  pending: PendingQuestion[];
  /** When this strom first looked at the connectors here, and which it took over as they were. */
  takeover?: { at: string; connectors: string[]; fresh?: boolean };
  /** The file is there but cannot be read (never written: a store written whole leaves it out). */
  broken?: boolean;
}

export function archivesFile(env: Env): string {
  return path.join(configDir(env), "archives.json");
}

export function loadArchives(env: Env): ArchivesStore {
  let v: Partial<ArchivesStore> | undefined;
  let broken = false;
  try {
    v = readJsonIfExists<Partial<ArchivesStore>>(archivesFile(env));
    if (v !== undefined && (!v || typeof v !== "object" || Array.isArray(v))) broken = true;
  } catch {
    v = undefined; // a file cut short: what it held is asked again — never more allowed than before
    broken = true;
  }
  const archives = v?.archives && typeof v.archives === "object" && !Array.isArray(v.archives) ? v.archives : {};
  const pending = Array.isArray(v?.pending) ? v.pending.filter((p) => p && typeof p.key === "string") : [];
  return { archives, pending, ...(v?.takeover && typeof v.takeover === "object" ? { takeover: v.takeover } : {}), ...(broken ? { broken: true } : {}) };
}

/**
 * Change the store: read afresh under its lock, changed, written whole — several strom processes run side by side,
 * none wipes out what another saved meanwhile. False when it cannot be written here (an agent's sandbox: the
 * settings folder is not its to write) — what was decided holds for this command only.
 */
export function updateArchives(env: Env, change: (s: ArchivesStore) => void): boolean {
  const file = archivesFile(env);
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const release = acquireLock(`${file}.lock`, { owner: "strom archives", waitMs: 10_000, staleMs: 60_000 });
    try {
      const s = loadArchives(env);
      change(s);
      delete s.broken;
      writeJson(file, s);
      return true;
    } finally {
      release();
    }
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code ?? "";
    if (["EACCES", "EPERM", "EROFS"].includes(code)) return false;
    throw err;
  }
}

/**
 * The questions that wait for the person. The connectors taken over: only those whose hosts strom's known terms do not
 * know (a list grown since covers more) — none left, no question.
 */
export function pendingQuestions(env: Env): PendingQuestion[] {
  return loadArchives(env).pending.flatMap((q) => {
    if (q.kind !== "takeover" || !q.hosts) return [q];
    const left = (q.connectors ?? []).filter((n) => !q.hosts?.[n] || !coveredByTerms(env, q.hosts[n]!));
    return left.length ? [{ ...q, connectors: left }] : [];
  });
}

export function dropPending(s: ArchivesStore, key: string): void {
  s.pending = s.pending.filter((p) => p.key !== key);
}

function putPending(s: ArchivesStore, q: PendingQuestion): void {
  const old = s.pending.find((p) => p.key === q.key);
  dropPending(s, q.key);
  // a window shown stays said: none again for it within a day of it
  const next = old?.window && !q.window ? { ...q, window: old.window } : q;
  if (q.kind === "permission" && old) {
    // asked again: since when it waits stays the first time, the tasks gather (every research's), the tries count
    const tasks = [...(old.tasks ?? (old.tree && old.task ? [{ tree: old.tree, task: old.task }] : []))];
    for (const t of q.tasks ?? []) if (!tasks.some((x) => x.tree === t.tree && x.task === t.task)) tasks.push(t);
    Object.assign(next, { at: old.at, last: q.at, tries: (old.tries ?? 1) + 1, ...(tasks.length ? { tasks } : {}) });
  }
  s.pending.push(next);
}

// ── connectors as strom reads them ───────────────────────────────────────────

export interface ConnectorLike {
  name: string;
  manifest: Pick<ConnectorManifest, "hosts" | "policy" | "browser" | "title">;
}

/** A connector's own reading: policy.automation, at least restricted behind a bot check (browser.pages). */
export function claimOf(c: ConnectorLike): Claim {
  const a = c.manifest.policy.automation as Claim;
  return c.manifest.browser?.pages ? strictest(CLAIMS.includes(a) ? a : "unknown", "restricted") : CLAIMS.includes(a) ? a : "unknown";
}

export function termsHash(c: ConnectorLike): string {
  return crypto.createHash("sha256").update(`${c.manifest.policy.terms ?? ""}\n${c.manifest.policy.termsSummary ?? ""}`).digest("hex").slice(0, 16);
}

function seenOf(c: ConnectorLike, by: Seen["by"]): Seen {
  const p = c.manifest.policy.pace;
  const pace = p && (p.minIntervalMs !== undefined || p.perHour !== undefined) ? { ...(p.minIntervalMs !== undefined ? { minIntervalMs: p.minIntervalMs } : {}), ...(p.perHour !== undefined ? { perHour: p.perHour } : {}) } : undefined;
  return { level: claimOf(c), termsHash: termsHash(c), ...(c.manifest.policy.terms ? { terms: c.manifest.policy.terms } : {}), ...(pace ? { pace } : {}), at: new Date().toISOString(), by };
}

/**
 * The connectors there when this strom first looks (R2, the review's way): taken over with their reading as it is —
 * they run as before — and one question for the person to confirm them all. A new strom on this computer (no strom
 * ran here before) takes over nothing: every connector it meets is new, its "allowed" waits for the person's word at
 * its first image. Done once; whatever is changed later is the latch's.
 */
export function takeOverConnectors(env: Env, connectors: ConnectorLike[], fresh: boolean): void {
  if (loadArchives(env).takeover) return;
  updateArchives(env, (s) => takeOverInto(env, s, connectors, fresh));
}

function takeOverInto(env: Env, s: ArchivesStore, connectors: ConnectorLike[], fresh: boolean): void {
  if (s.takeover) return;
  const at = new Date().toISOString();
  if (fresh) {
    s.takeover = { at, connectors: [], fresh: true };
    return;
  }
  for (const c of connectors)
    for (const h of c.manifest.hosts.map(bare)) {
      const rec = (s.archives[h] ??= {});
      (rec.seen ??= {})[c.name] ??= seenOf(c, "takeover");
    }
  const names = connectors.map((c) => c.name).sort();
  s.takeover = { at, connectors: names };
  // the person confirms only what strom's known terms do not know: a connector of hosts the list has needs no word
  const asked = connectors.filter((c) => !coveredByTerms(env, c.manifest.hosts));
  if (asked.length)
    putPending(s, {
      kind: "takeover",
      key: "takeover",
      at,
      connectors: asked.map((c) => c.name).sort(),
      hosts: Object.fromEntries(asked.map((c) => [c.name, [...new Set(c.manifest.hosts.map(bare))]])),
    });
}

// ── the level ────────────────────────────────────────────────────────────────

/** What decides an archive's level, for the person and the agent to read. */
export type LevelSource = "connector" | "new connector" | "kept" | "pages" | "terms" | "tree" | "floor" | "robots" | "refused";

export interface ArchiveLevel {
  /** The host the level is kept for: the connector's own host (bare), else the address's. */
  host: string;
  level: Claim;
  /** Each source that gives the level (several may). */
  from: LevelSource[];
  /** The person's permission for the images, if any. */
  permission?: Way;
  /** The archive as a person names it: strom's known terms, the tree's archive, the connector's title. */
  title?: string;
  /** Where its terms are, and the sentence quoted (strom's known terms first, else the connector's reading). */
  terms?: string;
  quote?: string;
  /** The quote is the connector's own reading (its termsSummary), not strom's known terms (D5); robots: the site's robots.txt, not its terms. */
  quoteBy?: "strom" | "connector" | "robots";
  /** A connector that says now the archive allows more than before: kept as before until the person accepts it. */
  milder?: { connector: string; from: Claim; to: Claim };
  /** The tree's archive that gave a stricter level. */
  repository?: string;
  /** What strom's known terms say the level covers ("catalogue only"), for the agent. */
  scope?: string;
  /**
   * Automated tools only through a person's browser: no direct request at all (catalogue, test, probe, images); the
   * permission is "through the browser" or by hand, never "slowly". By its robots.txt (the line), or strom's known terms.
   */
  browserOnly?: { by: "robots" | "terms"; line?: string };
  /** What the host's robots.txt says, as strom last read it (the paths it keeps automated tools off). */
  robots?: { at: number; status: number; disallow: string[] };
  /** The host refused strom's client: forbidden until the person lifts it (strom allow host <host> --unblock). */
  refused?: { host: string; kind: RefusedKind; until?: number; unreadable?: boolean; at?: string };
  /** An agent's command with settings not verified as the person's (core/trust.ts): why — no permission taken from them. */
  unverified?: string;
}

export interface LevelInput {
  connector?: ConnectorLike;
  /** The host or an address on it. */
  url: string;
  /** Connectors of the plugins folder, for the first look of this strom (takeover): they run as before. */
  all?: () => ConnectorLike[];
  /** Repositories and record sets of the family tree the work is for. */
  tree?: Pick<Tree, "list">;
  /** Don't write what strom saw (floor, takeover): a dry run, a reading command. */
  readOnly?: boolean;
  /** <shared>/net — the limiter's state of the hosts: their robots.txt and refusals. */
  net?: string;
}

function urlHost(u: string | undefined): string | undefined {
  if (!u) return undefined;
  try {
    return new URL(u).hostname.toLowerCase();
  } catch {
    return undefined;
  }
}

/** The tree's archive for a host's site (its registrable domain, its address or a record set's): only to be stricter. */
function treeLevel(tree: LevelInput["tree"], host: string): { level: Level; repo: Repository } | undefined {
  if (!tree) return undefined;
  const site = webDomain(host);
  const repos = tree.list<Repository>("repository").filter((r) => !r.retracted && r.automation !== "unknown");
  if (!repos.length) return undefined;
  const sets = tree.list<RecordSet>("recordset").filter((b) => !b.retracted && b.repository);
  let best: { level: Level; repo: Repository } | undefined;
  for (const r of repos) {
    const sites = [urlHost(r.url), ...sets.filter((b) => b.repository === r.id).map((b) => urlHost(b.url))].filter((x): x is string => !!x).map(webDomain);
    if (!sites.includes(site)) continue;
    const l = r.automation as Level;
    if (!best || rank(l) > rank(best.level)) best = { level: l, repo: r };
  }
  return best;
}

/** The host a connector keeps its level and permission for: the one of its hosts the address is on. */
export function keyHost(c: ConnectorLike | undefined, url: string): string {
  const h = hostOf(url);
  if (!c) return h;
  const own = c.manifest.hosts.map(bare).filter((x) => within(h, x)).sort((a, b) => b.length - a.length)[0];
  return own ?? h;
}

/**
 * The level of an archive's host for a connector (or for an address with none): the strictest of the connector's
 * reading (latched), its bot check, the tree's archive, strom's known terms and the floor — with the person's
 * permission and what the person reads of its terms. Writes what it saw — the first look (takeover), a floor made
 * stricter — unless readOnly; a store it cannot write changes nothing of the answer.
 */
export function archiveLevel(env: Env, input: LevelInput): ArchiveLevel {
  let store = loadArchives(env);
  if (!store.takeover && !input.readOnly && input.all) {
    const all = input.all();
    // written for the next one; the first look holds for this command whatever happens to the file
    updateArchives(env, (s) => takeOverInto(env, s, all, false));
    takeOverInto(env, store, all, false);
    store = loadArchives(env).takeover ? loadArchives(env) : store;
  }
  const host = keyHost(input.connector, input.url);
  const rec = store.archives[host] ?? {};
  // whose settings these are (core/trust.ts): from a folder not verified as the person's nothing that gives — no
  // permission, no acceptance, no milder level —, from every place what restricts, the person's default folder too
  const trust = settingsTrust(env);
  const other: ArchiveRecord = trust.restrictionsFrom ? (loadArchives({ STROM_CONFIG_DIR: trust.restrictionsFrom }).archives[host] ?? {}) : {};
  const c = input.connector;
  const from: { level: Claim; by: LevelSource }[] = [];
  let milder: ArchiveLevel["milder"];
  // strom's known terms of the host: a confirmed level — a connector's allowed there needs no person's word
  const known = termsFor(env, host);
  if (c) {
    const claim = claimOf(c);
    const seen = trust.verified ? rec.seen?.[c.name] : undefined;
    // a reading strom kept stricter, where it cannot be taken as the person's word: a restriction still
    for (const kept of [trust.verified ? undefined : rec.seen?.[c.name], other.seen?.[c.name]]) if (kept && rank(kept.level) > rank(claim)) from.push({ level: kept.level, by: "kept" });
    // a connector that found no terms says nothing where strom knows them
    if (claim === "unknown" && known && !seen) {
      // (its bot check below still counts)
    } else if (!seen) from.push({ level: claim === "allowed" && !known ? "unknown" : claim, by: claim === "allowed" && !known ? "new connector" : "connector" });
    else if (rank(claim) >= rank(seen.level)) from.push({ level: claim === "unknown" && known ? known.level : claim, by: "connector" });
    else {
      from.push({ level: seen.level, by: "kept" });
      milder = { connector: c.name, from: seen.level, to: claim };
    }
    if (c.manifest.browser?.pages) from.push({ level: "restricted", by: "pages" });
  }
  if (known) from.push({ level: known.level, by: "terms" });
  const t = treeLevel(input.tree, host);
  if (t) from.push({ level: t.level, by: "tree" });
  const live = strictest(...from.map((f) => f.level));
  const floor = rec.floor || other.floor ? asLevel(strictest(rec.floor, other.floor)) : undefined;
  if (floor) from.push({ level: floor, by: "floor" });
  // what the host itself said (core/net.ts): its robots.txt, a refusal of strom's client — kept beside the person's
  // settings too (an agent wiping net/ lifts nothing); each its own, never the floor (the site may say otherwise later,
  // the person lifts a refusal). The shared folder the settings name says it too, when this command uses another.
  const nets = [input.net, trust.sharedNamed ? path.join(trust.sharedNamed, "net") : undefined].filter((d): d is string => !!d);
  const net = nets.length ? mergeNet(nets.map((d) => netOf(d, [host, hostOf(input.url)]))) : undefined;
  let browserOnly: ArchiveLevel["browserOnly"];
  const robotsLine = net?.robotsAll ?? rec.robots?.line ?? other.robots?.line;
  if (robotsLine) browserOnly = { by: "robots", line: robotsLine };
  else if (known?.browserOnly) browserOnly = known.quoteFrom === "robots" ? { by: "robots", ...(known.quote ? { line: known.quote } : {}) } : { by: "terms" };
  if (browserOnly) from.push({ level: "restricted", by: browserOnly.by === "robots" ? "robots" : "terms" });
  let refused: ArchiveLevel["refused"];
  const keptRefusal = rec.refused ?? other.refused;
  // since when (kept beside the person's settings), for the person to read
  const since = keptRefusal?.at ? { at: keptRefusal.at } : {};
  if (net?.client) refused = { host: net.client.host, kind: "client", until: net.client.until, ...(keptRefusal?.host === net.client.host ? since : {}) };
  else if (keptRefusal) refused = { host: keptRefusal.host, kind: "client", ...since };
  // D8: neither the person's settings nor the host's state can be read — a refusal there may be lost: denied
  else if (store.broken && net?.unreadable) refused = { host, kind: "client", unreadable: true };
  if (refused) from.push({ level: "forbidden", by: "refused" });
  const level = strictest(live, floor, browserOnly ? "restricted" : undefined, refused ? "forbidden" : undefined);
  // the person's permission: from settings verified as theirs; their "by hand" from every place (stricter is anybody's)
  const permission: Way | undefined = rec.way === "manual" || other.way === "manual" ? "manual" : trust.verified ? rec.way : undefined;
  const by = [...new Set(from.filter((f) => rank(f.level) === rank(level) && (rank(level) > 0 || f.level === "allowed")).map((f) => f.by))];
  if (!input.readOnly) {
    // what strom saw is kept: the floor made stricter, a stricter reading of the connector, a milder one asked about
    const stricter = rank(live) > rank(rec.floor ?? "allowed") && rank(live) > 0;
    const seen = c ? rec.seen?.[c.name] : undefined;
    const seenStricter = c && seen && rank(claimOf(c)) > rank(seen.level);
    if (stricter || seenStricter || milder) {
      updateArchives(env, (s) => {
        const r = (s.archives[host] ??= {});
        if (stricter && rank(live) > rank(r.floor ?? "allowed")) {
          // whose reading it was: the connector's own (its claim, its latch, its bot check), else the terms or the tree
          const its = from.filter((f) => f.by === "connector" || f.by === "new connector" || f.by === "kept" || f.by === "pages");
          const byIt = c && its.length && rank(strictest(...its.map((f) => f.level))) >= rank(live);
          Object.assign(r, { floor: asLevel(live), floorBy: "strom", floorAt: new Date().toISOString() });
          if (byIt) r.floorConnector = c.name;
          else delete r.floorConnector;
        }
        if (c && seenStricter && r.seen?.[c.name]) r.seen[c.name] = { ...seenOf(c, "strom"), ...(r.seen[c.name]!.pace ? { pace: r.seen[c.name]!.pace } : {}) };
        const declined = c ? r.seen?.[c.name]?.declined : undefined;
        const kept = c && milder && declined?.to === milder.to && declined.termsHash === termsHash(c);
        if (c && milder && !kept && !s.pending.some((p) => p.key === `milder:${c.name}:${host}` && p.to === milder.to))
          putPending(s, { kind: "milder", key: `milder:${c.name}:${host}`, at: new Date().toISOString(), host, connector: c.name, title: c.manifest.title, from: milder.from, to: milder.to, ...(c.manifest.policy.terms ? { terms: c.manifest.policy.terms } : {}) });
      });
    }
  }
  const summary = c?.manifest.policy.termsSummary?.trim();
  const robotsSaid = known?.quoteFrom === "robots" || (!known?.quote && browserOnly?.by === "robots");
  return {
    host,
    level,
    from: by,
    ...(permission ? { permission } : {}),
    ...(!trust.verified ? { unverified: trust.why ?? "the settings are not verified as the person's" } : {}),
    title: known?.name ?? t?.repo.name ?? c?.manifest.title ?? host,
    // robots.txt said so (strom's list quotes it, or strom read it): said as robots.txt, never as the terms (with its address)
    ...(known?.terms ? { terms: known.terms } : robotsSaid ? { terms: `https://${rec.robots?.host ?? other.robots?.host ?? host}/robots.txt` } : c?.manifest.policy.terms ? { terms: c.manifest.policy.terms } : t?.repo.terms ? { terms: t.repo.terms } : {}),
    ...(known?.quote ? { quote: known.quote, quoteBy: known.quoteFrom === "robots" ? ("robots" as const) : ("strom" as const) } : robotsSaid ? { ...(browserOnly?.line ? { quote: browserOnly.line } : {}), quoteBy: "robots" as const } : summary ? { quote: summary, quoteBy: "connector" as const } : {}),
    ...(known?.scope ? { scope: known.scope } : {}),
    ...(milder ? { milder } : {}),
    ...(t ? { repository: t.repo.id } : {}),
    ...(browserOnly ? { browserOnly } : {}),
    ...(net?.robots ? { robots: net.robots } : {}),
    ...(refused ? { refused } : {}),
  };
}

/** What several states of the limiter say together: the first refusal, the first robots.txt, unreadable if one is. */
function mergeNet(all: ReturnType<typeof netOf>[]): ReturnType<typeof netOf> {
  const out: ReturnType<typeof netOf> = { unreadable: all.some((n) => n.unreadable) };
  for (const n of all) {
    if (!out.client && n.client) out.client = n.client;
    if (!out.robotsAll && n.robotsAll) out.robotsAll = n.robotsAll;
    if (!out.robots && n.robots) out.robots = n.robots;
  }
  return out;
}

/** What the limiter's state says of hosts (the first that says it): a refusal of the client, robots.txt, one unreadable. */
function netOf(dir: string, hosts: string[]): { client?: { host: string; until: number }; robotsAll?: string; robots?: ArchiveLevel["robots"]; unreadable: boolean } {
  const out: ReturnType<typeof netOf> = { unreadable: false };
  for (const h of [...new Set(hosts.filter(Boolean))]) {
    let read: ReturnType<typeof readHostState>;
    try {
      read = readHostState(dir, h);
    } catch {
      out.unreadable = true;
      continue;
    }
    const s = read.state;
    if (read.broken && !s.recent.length && s.last === undefined && Object.keys(s).length <= 1) out.unreadable = true;
    if (!out.client && s.refusedKind === "client" && s.blockedUntil && s.blockedUntil > Date.now()) out.client = { host: h, until: s.blockedUntil };
    if (s.robots && !out.robots) {
      out.robots = { at: s.robots.at, status: s.robots.status, disallow: [...new Set(s.robots.groups.flatMap((g) => g.disallow))] };
      out.robotsAll = robotsAll(s.robots);
    }
  }
  return out;
}

/**
 * What the limiter read or decided of a host, kept in the person's settings too (S5: an agent may write the shared
 * folder, not these): a refusal of strom's client, and a robots.txt that keeps automated tools off the whole site —
 * gone again when the site's robots.txt says otherwise (read with an answer: 2xx, 404, 410; unknown changes nothing).
 */
export function keepNetVerdict(env: Env, c: ConnectorLike | undefined, v: NetVerdict): void {
  const key = keyHost(c, v.host);
  const rec = loadArchives(env).archives[key];
  const at = new Date().toISOString();
  if (v.refused?.kind === "client") {
    if (rec?.refused?.host === v.host) return;
    updateArchives(env, (s) => {
      (s.archives[key] ??= {}).refused = { host: v.host, at, status: v.refused!.status, ...(c ? { connector: c.name } : {}) };
    });
    return;
  }
  if (!v.robots) return;
  const known = (v.robots.status >= 200 && v.robots.status < 300) || v.robots.status === 404 || v.robots.status === 410;
  const all = robotsAll(v.robots);
  if (all && rec?.robots?.line === all && rec.robots.host === v.host) return;
  if (!all && (!known || rec?.robots?.host !== v.host)) return;
  updateArchives(env, (s) => {
    const r = (s.archives[key] ??= {});
    if (all) r.robots = { host: v.host, at, line: all };
    else delete r.robots;
  });
}

/** A refusal of strom's client lifted by the person (strom allow host --unblock): gone from the settings too. */
export function liftRefusal(env: Env, host: string): boolean {
  const h = host.toLowerCase();
  if (!Object.entries(loadArchives(env).archives).some(([k, r]) => r.refused && (r.refused.host === h || k === h))) return true;
  return updateArchives(env, (s) => {
    for (const [k, r] of Object.entries(s.archives)) if (r.refused && (r.refused.host === h || k === h)) delete r.refused;
  });
}

/**
 * The hosts that refused strom's client and are left alone until the person lifts it: in the limiter's state, and kept
 * in the person's settings. For strom status and doctor.
 */
export function refusedHosts(env: Env, net: string | undefined): string[] {
  const out = new Set<string>();
  for (const r of Object.values(loadArchives(env).archives)) if (r.refused?.host) out.add(r.refused.host);
  if (net && fs.existsSync(net))
    for (const f of fs.readdirSync(net).filter((x) => x.endsWith(".json") && !x.startsWith("site~"))) {
      try {
        const s = readHostState(net, f.slice(0, -5)).state;
        if (s.refusedKind === "client" && s.blockedUntil && s.blockedUntil >= REFUSED_FOREVER) out.add(f.slice(0, -5));
      } catch {
        // a state strom cannot read says nothing here
      }
    }
  return [...out].sort();
}

/** The level of each host of a connector. */
export function connectorLevels(env: Env, c: ConnectorLike, input: Omit<LevelInput, "connector" | "url"> = {}): ArchiveLevel[] {
  return [...new Set(c.manifest.hosts.map(bare))].map((h) => archiveLevel(env, { ...input, connector: c, url: h }));
}

/** What an activity may do on an archive: by itself, at a person's pace (with the permission), or not — and why. */
export type Allowed = { ok: true; human: boolean } | { ok: false; why: "forbidden" | "manual" | "permission" | "browser"; needs?: "slow" | "browser" };

/**
 * One archive, one activity:
 *   catalogue  find and list (every request of a connector behind a bot check goes through the user's browser:
 *              `pages`, which needs the permission "through the browser" on a restricted archive)
 *   images     fetch, part, locate — by the route the connector takes
 */
export function allows(a: Pick<ArchiveLevel, "level" | "permission" | "browserOnly">, activity: "catalogue" | "images" | "pages", route: Route = "direct"): Allowed {
  if (a.level === "forbidden") return { ok: false, why: "forbidden" };
  // only a person's browser goes there: nothing straight through strom, the catalogue neither
  if (a.browserOnly && (activity === "catalogue" || (activity === "images" && route !== "browser"))) return { ok: false, why: "browser", needs: "browser" };
  if (activity === "catalogue") return { ok: true, human: false };
  if (a.level === "manual") return { ok: false, why: "manual" };
  // the person's "by hand only" holds wherever it was said — an archive that allows more too (stricter is anybody's)
  if (a.permission === "manual") return { ok: false, why: "manual" };
  if (a.level === "allowed") return { ok: true, human: false };
  const needs = activity === "pages" || route === "browser" ? "browser" : "slow";
  return a.permission === needs ? { ok: true, human: activity !== "pages" } : { ok: false, why: "permission", needs };
}

/** May a connector's images come through the user's browser here, as the archive's level and the person's word go? */
export function browserPermitted(env: Env, c: ConnectorLike & { dir?: string }, net?: string): boolean {
  // what the hosts said (a refusal of strom's client, robots.txt) counts too: the limiter's state beside the plugins
  const dir = net ?? (typeof c.dir === "string" ? path.join(path.dirname(path.dirname(path.dirname(c.dir))), "net") : undefined);
  return connectorLevels(env, c, { readOnly: true, ...(dir ? { net: dir } : {}) }).every((a) => allows(a, c.manifest.browser?.pages ? "pages" : "images", "browser").ok);
}

/** Keep the person's question for an archive: the menu shows it (one per host, shared by every tree). */
export function askLater(env: Env, a: ArchiveLevel, q: { connector?: string; way: "slow" | "browser"; choices: Way[]; window?: boolean; tree?: string; task?: string }): void {
  const choices = a.browserOnly ? q.choices.filter((w) => w !== "slow") : q.choices;
  updateArchives(env, (s) =>
    putPending(s, {
      kind: "permission",
      key: `permission:${a.host}`,
      at: new Date().toISOString(),
      host: a.host,
      ...(q.connector ? { connector: q.connector } : {}),
      ...(a.title ? { title: a.title } : {}),
      level: a.level,
      way: a.browserOnly ? "browser" : q.way,
      choices,
      ...(a.browserOnly ? { browserOnly: true } : {}),
      ...(q.window ? { window: new Date().toISOString() } : {}),
      ...(a.terms ? { terms: a.terms } : {}),
      ...(a.quote ? { quote: a.quote } : {}),
      ...(a.quoteBy ? { quoteBy: a.quoteBy } : {}),
      ...(q.tree ? { tree: q.tree } : {}),
      ...(q.task ? { task: q.task } : {}),
      ...(q.tree && q.task ? { tasks: [{ tree: q.tree, task: q.task }] } : {}),
      tries: 1,
    }),
  );
}

/** Questions of hosts that need none now (their images may come): gone. */
export function settlePending(env: Env, hosts: string[]): string[] {
  const keys = new Set(hosts.map((h) => `permission:${h}`));
  const gone = loadArchives(env).pending.filter((p) => keys.has(p.key)).map((p) => p.host!).filter(Boolean);
  if (!gone.length) return [];
  updateArchives(env, (s) => {
    s.pending = s.pending.filter((p) => !keys.has(p.key));
  });
  return gone;
}

/** A window not answered ("later", Esc, no answer in time) is shown again for the same archive at the earliest after this. */
export const WINDOW_AGAIN_MS = 24 * 3600_000;

/** Was a window shown for the question of this host within a day (none again until then — the menu has it meanwhile)? */
export function windowShown(env: Env, host: string, now: number = Date.now()): boolean {
  const at = loadArchives(env).pending.find((p) => p.key === `permission:${host}`)?.window;
  if (!at) return false;
  const t = Date.parse(at);
  return !Number.isFinite(t) || (now - t < WINDOW_AGAIN_MS && t <= now + 60_000);
}

/** The person's permission for hosts: kept, its question gone — and what it changed, for "ask again" to put back. */
export function grantWay(env: Env, hosts: string[], way: Way, o: { by: NonNullable<ArchiveRecord["by"]>; connector?: ConnectorLike }): boolean {
  return updateArchives(env, (s) => {
    for (const h of hosts) {
      const fresh = !s.archives[h];
      const r = (s.archives[h] ??= {});
      // the first decision keeps what was there before it (a later one, another way, keeps that)
      if (!r.way && !r.prior) {
        r.prior = { ...(fresh ? { none: true } : {}), ...(r.connector !== undefined ? { connector: r.connector } : {}), ...(r.terms !== undefined ? { terms: r.terms } : {}) };
      }
      Object.assign(r, { way, at: new Date().toISOString(), by: o.by, ...(o.connector ? { connector: o.connector.name } : {}), ...(o.connector?.manifest.policy.terms ? { terms: o.connector.manifest.policy.terms } : {}) });
      // the pace the person agreed to goes with it: the connector's own, as it is now (a faster one later: asked)
      const p = o.connector?.manifest.policy.pace;
      if (o.connector && p && !r.seen?.[o.connector.name]?.pace && !r.seenPace?.[o.connector.name]) {
        (r.seenPace ??= {})[o.connector.name] = { ...(p.minIntervalMs !== undefined ? { minIntervalMs: p.minIntervalMs } : {}), ...(p.perHour !== undefined ? { perHour: p.perHour } : {}) };
        if (r.prior) r.prior.seenPace = [...new Set([...(r.prior.seenPace ?? []), o.connector.name])];
      }
      dropPending(s, `permission:${h}`);
    }
  });
}

/**
 * The person's permission taken back ("ask again"): the archive as it was before the decision — what the decision
 * wrote gone — asked again only at the next real need: no question of it waits meanwhile (one that waited before the
 * decision, or since, goes too — the person is bothered as little as possible).
 */
export function revokeWay(env: Env, hosts: string[]): boolean {
  return updateArchives(env, (s) => {
    for (const h of hosts) {
      dropPending(s, `permission:${h}`);
      const r = s.archives[h];
      if (!r) continue;
      const prior = r.prior;
      delete r.way;
      delete r.at;
      delete r.by;
      delete r.prior;
      if (prior) {
        for (const k of ["connector", "terms"] as const) {
          if (prior[k] !== undefined) r[k] = prior[k];
          else delete r[k];
        }
        for (const n of prior.seenPace ?? []) delete r.seenPace?.[n];
        if (r.seenPace && !Object.keys(r.seenPace).length) delete r.seenPace;
        if (prior.none && !Object.keys(r).length) delete s.archives[h];
      }
    }
  });
}

/**
 * A connector taken away (strom connector discard, remove): what only it brought into the person's archives goes —
 * strom's latch of its reading and the level strom kept from it, its question nobody waits on, a milder reading of it.
 * Never a person's decision (a way, a level an agent or the person set), a refusal, robots.txt, another connector's
 * reading, nor a host `keep` says stays (another connector reaches it, strom's known terms name it, tasks wait on its
 * question). A level strom kept goes only when this very connector brought it — its reading made it, after the
 * connector was made (`since`) —, never one strom saw before (another connector of the host, gone since): only the
 * person makes a level milder. When the connector was made is not known: the level stays. The hosts whose entry went.
 */
export function forgetConnector(env: Env, name: string, hosts: string[], keep: (host: string) => boolean, since?: string): string[] {
  const gone: string[] = [];
  updateArchives(env, (s) => {
    s.pending = s.pending.filter((p) => !(p.kind === "milder" && p.connector === name));
    for (const h of hosts) {
      if (keep(h)) continue;
      const r = s.archives[h];
      const q = s.pending.find((p) => p.key === `permission:${h}`);
      if (q && q.connector !== undefined && q.connector !== name) continue;
      if (r) {
        const others = (o?: Record<string, unknown>) => Object.keys(o ?? {}).some((k) => k !== name);
        const theirs = r.way || r.refused || r.robots || r.prior || (r.floor && r.floorBy !== "strom") || others(r.seen) || others(r.seenPace) || (r.connector !== undefined && r.connector !== name);
        if (theirs) continue;
        // a level strom kept from before this connector, or from another one's reading: it stays (its question goes)
        const before = r.floor && (!since || !r.floorAt || r.floorAt < since || (r.floorConnector !== undefined && r.floorConnector !== name));
        if (!before) {
          delete s.archives[h];
          gone.push(h);
        }
      }
      if (q) dropPending(s, q.key);
    }
  });
  return gone;
}

/** A level set for hosts: stricter by anyone (an agent too), milder by the person alone (the caller asks them). */
export function setFloor(env: Env, hosts: string[], level: Level, by: "agent" | "person"): boolean {
  return updateArchives(env, (s) => {
    for (const h of hosts) {
      const r = Object.assign((s.archives[h] ??= {}), { floor: level, floorBy: by, floorAt: new Date().toISOString() });
      delete r.floorConnector;
    }
  });
}

/**
 * The person accepts connectors' readings as they are now (their level and pace): the latch takes them, the floor
 * goes back to what the other sources give, their questions go.
 */
export function acceptConnectors(env: Env, connectors: ConnectorLike[]): boolean {
  return updateArchives(env, (s) => {
    for (const c of connectors) {
      for (const h of c.manifest.hosts.map(bare)) {
        const r = (s.archives[h] ??= {});
        (r.seen ??= {})[c.name] = seenOf(c, "person");
        if (r.seenPace) delete r.seenPace[c.name];
        delete r.floor;
        delete r.floorBy;
        delete r.floorAt;
        delete r.floorConnector;
        dropPending(s, `milder:${c.name}:${h}`);
      }
      const t = s.pending.find((p) => p.kind === "takeover");
      if (t?.connectors) {
        t.connectors = t.connectors.filter((n) => n !== c.name);
        if (!t.connectors.length) dropPending(s, "takeover");
      }
    }
  });
}

/**
 * The person keeps what strom kept of connectors' readings when they say now that an archive allows more: the latch
 * stays, their questions go, and that milder reading is not asked about again (a reading changed once more is).
 */
export function keepReadings(env: Env, connectors: ConnectorLike[]): boolean {
  return updateArchives(env, (s) => {
    for (const c of connectors)
      for (const h of c.manifest.hosts.map(bare)) {
        const seen = s.archives[h]?.seen?.[c.name];
        if (seen && rank(claimOf(c)) < rank(seen.level)) seen.declined = { to: claimOf(c), termsHash: termsHash(c), at: new Date().toISOString() };
        dropPending(s, `milder:${c.name}:${h}`);
      }
  });
}

/** The connectors taken over that wait for the person's word (the one question of the takeover). */
export function takenOverWaiting(env: Env): string[] {
  return pendingQuestions(env).find((p) => p.kind === "takeover")?.connectors ?? [];
}

// ── the pace of a person ─────────────────────────────────────────────────────

/** archive.pace as the person set it ("10 120": seconds between two images, requests to the archive an hour — its catalogue counted too), or nothing. */
export function parseArchivePace(v: string): Pace | undefined {
  const m = /^\s*(\d+(?:\.\d+)?)\s+(\d+)\s*$/u.exec(v);
  if (!m) return undefined;
  const ms = Math.round(Number(m[1]) * 1000);
  const n = Number(m[2]);
  return ms >= MIN_INTERVAL_MS && Number.isInteger(n) && n > 0 ? { minIntervalMs: ms, perHour: n } : undefined;
}

/**
 * The pace of a person for the images of a restricted archive with the permission "slowly": the person's own default
 * (archive.pace), else HUMAN_PACE. STROM_TEST_HUMAN_PACE_MS (only from the sources: the tests) a shorter pause.
 */
export function humanPace(env: Env, inst: Installation = installation()): Pace {
  const test = Number(env.STROM_TEST_HUMAN_PACE_MS);
  if (inst.kind === "source" && env.STROM_TEST_HUMAN_PACE_MS && Number.isFinite(test) && test >= 0) return { minIntervalMs: test, perHour: HUMAN_PACE.perHour };
  const set = loadUserConfig(env).archivePace;
  const own = set && set !== "auto" ? parseArchivePace(set) : undefined;
  if (!own) return HUMAN_PACE;
  // settings not verified as the person's (core/trust.ts): their pace only where it is slower
  if (!settingsTrust(env, { inst }).verified) return { minIntervalMs: Math.max(own.minIntervalMs, HUMAN_PACE.minIntervalMs), perHour: Math.min(own.perHour, HUMAN_PACE.perHour) };
  return own;
}

/**
 * The service's pace a connector gives, as strom keeps to it on a host at a person's pace: never faster than it gave
 * when the person decided (seen) — slower at once.
 */
export function latchedPace(env: Env, c: ConnectorLike, host: string): ServicePace {
  const p = c.manifest.policy.pace ?? {};
  const rec = loadArchives(env).archives[host];
  const seen = rec?.seen?.[c.name]?.pace ?? rec?.seenPace?.[c.name];
  if (!seen) return p;
  const out: ServicePace = { ...p };
  if (seen.minIntervalMs !== undefined && (p.minIntervalMs === undefined || p.minIntervalMs < seen.minIntervalMs)) out.minIntervalMs = seen.minIntervalMs;
  if (seen.perHour !== undefined && seen.perHour > 0 && (p.perHour === undefined || !(p.perHour > 0) || p.perHour > seen.perHour)) out.perHour = seen.perHour;
  return out;
}
