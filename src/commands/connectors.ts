// connector list · show · new · add · remove · discard · test — fetch — allow connector · allow host · consents · login
//
// Archive downloads through plugins (connectors) in the plugins folder,
// <shared>/plugins/connectors/<name>/: copied in by the user, or built there
// with their agent. strom paces every request, keeps to the hosts a connector
// names, writes the files itself, checks the images and registers them with
// their provenance. When the user asks to be asked (connectors.consent on), a
// connector runs only with their consent, given on a terminal after a plain
// warning — never by an agent; code that goes round strom needs it either way.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { UI, ui, type UIKey } from "../cli/ui.ts";
import { humanDay, humanWhen } from "../cli/human.ts";
import { register, type Result } from "../cli/registry.ts";
import type { Context } from "../cli/context.ts";
import { counted, lines, moreLine, numberIn, paginate, runs, secondsIn, shellArg, table } from "../cli/format.ts";
import { EXIT, StromError, UsageError } from "../core/errors.ts";
import { deadlineOf, REMIND_MS } from "../core/clock.ts";
import { isAgent } from "../core/which.ts";
import { RECORD_TYPES, type Media, type RecordSet, type Region, type Repository, type Search, type Session, type Source, type Task } from "../core/model.ts";
import { normId, requireRecord, update } from "../core/records.ts";
import { bookRoute, sameBooks, sameBookText } from "../core/samebook.ts";
import { guardIndexFirst } from "../core/indexfirst.ts";
import { readable } from "../core/text.ts";
import { findImage, isWhole, partHere, regionText, SHARPER, type PartHere } from "../core/media.ts";
import { partRegion } from "../core/views.ts";
import { loadLogins, loginOf, loginsFile, removeLogin, saveLogin, VISIBLE_FIELDS } from "../core/logins.ts";
import { readAsset } from "../core/assets.ts";
import { runGit } from "../core/git.ts";
import { imageSizeOfFile } from "../image/index.ts";
import { Tree } from "../core/tree.ts";
import { syncAgentFiles } from "../agents/files.ts";
import { CAP_WARN, capNear, clearBlock, clock, clockUp, CookieJar, DEFAULT_PACE, hostAllowed, hostPace, hostState, knownHosts, leftAloneFor, leftUntil, MIN_INTERVAL_MS, NetError, paceText, politeRequest, REFUSED_FOREVER, refusedBy, reserveSlots, setOwnPace, testHooks, type Pace, type RefusedKind, type ServicePace, type WaitWhy } from "../core/net.ts";
import { match, optionsOf } from "../cli/registry.ts";
import {
  botCheck,
  fileBase,
  findDownload,
  loadPage,
  loadPlans,
  pageKey,
  pageScript,
  parseResult,
  PLAN_TTL_MS,
  planScript,
  readSavedPage,
  removePlan,
  savePage,
  savePlan,
  SCRIPT_MS,
  type BrowserPlan,
  type PageAnswer,
  type PageRequest,
  type PlanItem,
  type PlanPage,
  type Resume,
  claudeInChrome,
  CLAUDE_IN_CHROME_URL,
} from "../core/browser.ts";
import { PROFILES } from "../agents/profiles.ts";
import {
  bareHost,
  byHandOnly,
  changedSinceConsent,
  codeWarning,
  consentRequired,
  connectorHash,
  connectorsDir,
  directNetwork,
  ensurePluginsDir,
  findConnector,
  hostWarning,
  imageProblem,
  INTERFACE,
  listConnectors,
  loadConsents,
  lockedCode,
  MANIFEST,
  missingConsents,
  NAME_RE,
  readManifest,
  routeOf,
  sandboxedRun,
  treeBrowserConnectors,
  routesOf,
  ROUTES,
  runConnector,
  saveConsents,
  scanConnectors,
  suggestName,
  type Connector,
  type ConnectorRequest,
  type FoundBook,
  type Route,
  type RunReport,
} from "../core/connector.ts";
import { registerImages, wakeWaiting } from "./media.ts";
import { autoCommit } from "../cli/commit.ts";
import type { CommandDef } from "../cli/registry.ts";
import { activeFetches, askStop, BACKGROUND_ENV, backgroundLog, backgroundOf, endedFetches, FETCH_BATCH, FETCH_SILENT_MS, isRunWorker, markEnded, markFetch, processAlive, watchBackground, withRegistered, type ActiveFetch, type BackgroundOf, type EndedFetch } from "../core/fetching.ts";
import { finishAsked } from "../core/clock.ts";
import { isLiveWorker } from "../core/workers.ts";
import { stromLauncher } from "../core/self.ts";
import { spawn } from "node:child_process";
import type { FetchedImage } from "../core/connector.ts";
import { now } from "../core/tree.ts";
import { FetchMeter, metricsDir, recordFetch, requestsPerImage, webDomain } from "../core/metrics.ts";
import { siteConnector } from "../core/web.ts";
import { allows, forgetConnector, grantWay, keyHost, latchedPace, liftRefusal, loadArchives, pendingQuestions, termsFor, type ArchiveLevel } from "../core/terms.ts";
import { waitsOnHost } from "../core/archivewait.ts";
import { waysOffered } from "../core/archiveasks.ts";
import { archivesOverview, checkEnvironment, gateArchive, levelsOf, levelText, NeedsPermissionError, permissionText, robotsPermits, syncTrees, taskHere, verdictKeeper } from "./archives.ts";
import { currentSession, othersAtWork } from "../core/session.ts";
import { askedAgain, noteLeftAlone } from "../core/leftalone.ts";
import { opsLogsOf } from "../core/opslog.ts";

/** Which session of the research started a connector (strom connector new): its agent may discard it in that session. */
function madeMarker(root: string, name: string): string {
  return path.join(root, ".strom", "connectors-made", `${name}.json`);
}

/** What a marker of strom connector new says: the session, its research and tree, when, and which folder it made. */
interface MadeConnector {
  session: string;
  /** The tree's id (strom.json): a marker copied into another research names none of its sessions. */
  tree: string;
  /** The direction (G…) of the session, when it has one. */
  research?: string;
  at: string;
  /** The folder made, as the file system knows it: a folder of that name put there since is another one. */
  folder: FolderId;
}

/** A folder's identity: its inode and its birth time (ns; 0 where the file system keeps none). */
interface FolderId {
  ino: string;
  birth: string;
}

/** The identity of a folder itself (a symbolic link is none), or nothing. */
function folderId(dir: string): FolderId | undefined {
  try {
    const s = fs.lstatSync(dir, { bigint: true });
    return s.isDirectory() ? { ino: String(s.ino), birth: String(s.birthtimeNs) } : undefined;
  } catch {
    return undefined;
  }
}

/**
 * An entry of the plugins folder a new connector's name would meet: the same name, or one a file system that ignores
 * case or the form of an accented letter (macOS, Windows) takes for it — a folder with no connector in it, a file and a
 * symbolic link too.
 */
function nameTaken(dir: string, name: string): string | undefined {
  const key = (s: string) => s.normalize("NFC").toLowerCase();
  let entries: string[] = [];
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return undefined;
  }
  return entries.find((e) => key(e) === key(name));
}

/** The folder of a connector a session made, when it is that one still: a real folder right in the plugins folder. */
function ownFolder(connectors: string, name: string, made: MadeConnector): string | undefined {
  const dir = path.join(connectors, name);
  try {
    if (path.basename(dir) !== name || path.dirname(dir) !== connectors) return undefined;
    if (fs.realpathSync.native(dir) !== path.join(fs.realpathSync.native(connectors), name)) return undefined;
  } catch {
    return undefined;
  }
  const now = folderId(dir);
  return now && now.ino === made.folder.ino && now.birth === made.folder.birth ? dir : undefined;
}

/**
 * Who else used a connector one session made: another session (or the user) of this research — images it fetched, the
 * record sets, sources and searches resting on them, its runs measured in fetch.jsonl — or another research on this
 * computer (images it fetched, its runs). Each said in a few words; none: the session alone used it.
 */
function usedElsewhere(ctx: Context, tree: Tree, name: string, made: MadeConnector): string[] {
  const out: string[] = [];
  const said = new Set<string>();
  const say = (s: string) => {
    if (!said.has(s)) said.add(s), out.push(s);
  };
  // this research: the records of what it fetched, and every operation on them by anyone but the session
  const media = tree.list<Media>("media").filter((m) => m.fetched?.connector === name);
  const mediaIds = new Set(media.map((m) => m.id));
  const sets = new Set(media.map((m) => m.recordset).filter((b): b is string => !!b));
  const resting = new Set<string>();
  for (const s of tree.list<Source>("source")) if ((s.media ?? []).some((m) => mediaIds.has(m)) || (s.clips ?? []).some((c) => mediaIds.has(c.media))) resting.add(s.id);
  for (const q of tree.list<Search>("search")) if (q.recordsets.some((b) => sets.has(b))) resting.add(q.id);
  for (const b of sets) resting.add(b);
  if (mediaIds.size || resting.size)
    for (const op of tree.readOps()) {
      if (op.by === made.session) continue;
      // its images are its own whenever they came; what rests on them, from the time it was made (a record set may be older)
      const hit = op.targets.find((t) => mediaIds.has(t) || (resting.has(t) && op.at >= made.at));
      if (hit) say(`${actorText(op.by)} of this research (${op.op} ${hit})`);
    }
  for (const r of fetchRuns(tree.root, name)) if (r.session !== made.session) say(`${actorText(r.session ?? r.by)} of this research (a run of it measured${r.at ? ` ${r.at}` : ""})`);
  // the other researches on this computer: anything of it at all
  let here = tree.root;
  try {
    here = fs.realpathSync.native(tree.root);
  } catch {}
  for (const k of ctx.knownTrees()) {
    let root = k.root;
    try {
      root = fs.realpathSync.native(k.root);
    } catch {}
    if (root === here) continue;
    const images = fetchedImages(root, name);
    if (images) say(`the research "${k.name}" (${images} image${images === 1 ? "" : "s"} fetched)`);
    const runs = fetchRuns(root, name).length;
    if (runs) say(`the research "${k.name}" (${runs} run${runs === 1 ? "" : "s"} of it measured)`);
  }
  return out;
}

/** Who an operation or a run names: a session, the user, an agent outside a session. */
function actorText(by: string | undefined): string {
  return by && /^N\d+$/.test(by) ? `session ${by}` : by === "agent" ? "an agent outside a session" : "the user";
}

/** The runs of a connector a research measured (.strom/metrics/fetch.jsonl): who and when. */
function fetchRuns(root: string, name: string): { session?: string; by?: string; at?: string }[] {
  let text = "";
  try {
    text = fs.readFileSync(path.join(metricsDir(root), "fetch.jsonl"), "utf8");
  } catch {
    return [];
  }
  const out: { session?: string; by?: string; at?: string }[] = [];
  for (const line of text.split("\n"))
    try {
      const r = JSON.parse(line) as { connector?: unknown; session?: unknown; by?: unknown; at?: unknown };
      if (r.connector === name) out.push({ ...(typeof r.session === "string" ? { session: r.session } : {}), ...(typeof r.by === "string" ? { by: r.by } : {}), ...(typeof r.at === "string" ? { at: r.at } : {}) });
    } catch {
      // a line cut short names nothing
    }
  return out;
}

/** How many images of a research (its data, read without opening it) a connector fetched. */
function fetchedImages(root: string, name: string): number {
  const dir = path.join(root, "data", RECORD_TYPES.media.dir);
  let names: string[] = [];
  try {
    names = fs.readdirSync(dir).filter((n) => n.endsWith(".json"));
  } catch {
    return 0;
  }
  let n = 0;
  for (const f of names)
    try {
      if ((JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) as Partial<Media>).fetched?.connector === name) n++;
    } catch {
      // an unreadable record names nothing
    }
  return n;
}

function shared(ctx: Context): string {
  const s = ctx.settings.shared();
  if (!s) throw new StromError("Strom is not set up yet", { hint: "strom setup" });
  return s.value;
}

const netDir = (ctx: Context) => path.join(shared(ctx), "net");

/**
 * The pace for a host now: the user's own for it, else its connector's service's, else strom's — at a person's pace
 * (`human`) for the images of an archive that restricts automation, the service's as the person last saw it.
 */
function paceAt(ctx: Context, host: string, c?: Connector, human?: Map<string, Pace>): Pace {
  const by = c ?? listConnectors(ctx.settings.shared()?.value).find((x) => x.manifest.hosts.some((h) => hostAllowed(host, [h])));
  const hp = by ? human?.get(keyHost(by, host)) : undefined;
  return hostPace(hostState(netDir(ctx), host), hp && by ? latchedPace(ctx.env, by, keyHost(by, host)) : by?.manifest.policy.pace, hp, host);
}

/** A connector's pace: that of its first host. */
function connectorPace(ctx: Context, c: Connector, human?: Map<string, Pace>): Pace {
  return paceAt(ctx, bareHost(c.manifest.hosts[0] ?? ""), c, human);
}

/** The pace of each request's host for a run of a connector: a person's where the gate said so (core/terms.ts). */
function pacing(ctx: Context, c: Connector, human: Map<string, Pace>): { paceFor?: (host: string) => { pace: ServicePace; human: Pace } | undefined } {
  if (!human.size) return {};
  return {
    paceFor: (host: string) => {
      const k = keyHost(c, host);
      const hp = human.get(k);
      return hp ? { pace: latchedPace(ctx.env, c, k), human: hp } : undefined;
    },
  };
}

/** A day of a consent in the person's words: English as it always read (2026-10-11), the others as their menu says it. */
function consentDay(lang: string, iso: string): string {
  return lang === "en" ? iso.slice(0, 10) : humanDay(iso, lang);
}

/** A moment (a refusal's end, a used-up limit) in the person's words: English on strom's clock, the others as their menu says it. */
function consentMoment(lang: string, ms: number): string {
  return lang === "en" ? clock(ms) : humanWhen(new Date(ms).toISOString(), lang);
}

/** A pace as strom consents says it: "at least 2 s apart, at most 120 an hour" — in the person's language. */
function consentPace(lang: string, pace: Pace | { minIntervalMs: number; perHour: number | null }): string {
  const n = pace.perHour;
  return ui(lang, "ui.consents.pace", { seconds: secondsIn(lang, pace.minIntervalMs), cap: n !== null && Number.isFinite(n) ? ui(lang, "ui.pace.cap", { n }) : ui(lang, "ui.pace.nocap") });
}

/**
 * Why a host is left alone, as the limiter wrote it (core/net.ts, in English, its moment on strom's stamp) — said once,
 * in the person's language, its details (the HTTP status, when) in one parenthesis; without "us" (a refusal of
 * automated access, as Settings → Archives says it). A reason that is none of the limiter's own: as it is; none at
 * all: what the refusal's kind says.
 */
function refusalReason(lang: string, reason: string | undefined, kind: RefusedKind | undefined): string {
  const at = (s: string | undefined) => {
    if (!s || lang === "en") return s;
    const m = /^(\d{4})-(\d\d)-(\d\d) (\d\d):(\d\d)$/.exec(s);
    return m ? humanWhen(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5])).toISOString(), lang) : s;
  };
  const said = (key: UIKey, status?: string, when?: string) => {
    const details = [status ? `HTTP ${status}` : "", at(when) ?? ""].filter(Boolean).join(", ");
    return ui(lang, key, { details }).replace(/ \(\)/, "");
  };
  const refused: UIKey = kind === "client" ? "ui.consents.reason.client" : kind === "login" ? "ui.consents.reason.login" : "ui.consents.reason.refused";
  if (!reason) return said(refused);
  const known: [RegExp, UIKey][] = [
    [/^it refused strom's client \(HTTP (\d+)(?: at (.+))?\)$/, "ui.consents.reason.client"],
    [/^it refused us \(HTTP (\d+)(?: at (.+))?\)$/, refused],
    [/^it refused the browser \(HTTP (\d+)(?: at (.+))?\)$/, "ui.consents.reason.browser"],
    [/^it asked us to slow down twice \(HTTP (429)(?: at (.+))?\)$/, "ui.consents.reason.slow"],
    [/^it asked the browser to slow down \(HTTP (429)(?: at (.+))?\)$/, "ui.consents.reason.browser.slow"],
    [/^no answer at ()(.+) — the server is down, or it blocks this IP$/, "ui.consents.reason.silent"],
  ];
  for (const [re, key] of known) {
    const m = re.exec(reason);
    if (m) return said(key, m[1], m[2]);
  }
  return reason;
}

/** How a host is doing (refused, requests of the last hour, slowed, its limit used up, its pace) — in `lang` (strom consents: the research language). */
function hostLine(ctx: Context, host: string, lang = "en"): string {
  const s = hostState(netDir(ctx), host);
  const hour = s.recent.filter((t) => t > Date.now() - 3600_000).length;
  const pace = consentPace(lang, paceAt(ctx, host));
  const reason = refusalReason(lang, s.reason, s.refusedKind);
  return [
    host,
    s.blockedUntil && s.blockedUntil > Date.now() ? (s.blockedUntil >= REFUSED_FOREVER ? ui(lang, "ui.consents.host.refused.lifted", { reason, host }) : ui(lang, "ui.consents.host.refused", { reason, when: consentMoment(lang, s.blockedUntil) })) : "",
    hour ? ui(lang, "ui.consents.host.recent", { n: hour }) : "",
    (s.slowdown ?? 1) > 1 ? ui(lang, "ui.consents.host.slowed", { factor: numberIn(lang, s.slowdown ?? 1, { minimumFractionDigits: 1, maximumFractionDigits: 1, useGrouping: false }) }) : "",
    s.waitUntil && s.waitUntil > Date.now() ? ui(lang, "ui.consents.host.limit", { when: consentMoment(lang, s.waitUntil) }) : "",
    s.own ? ui(lang, "ui.consents.pace.own", { pace }) : pace,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Ask the user, on a terminal, to allow automated access to a host. */
async function askHost(ctx: Context, host: string, c?: Connector, byWindow = false): Promise<boolean> {
  if (!byWindow) {
    ctx.io.stdout("\n" + hostWarning(host, c, paceAt(ctx, host, c)) + "\n");
    if (!(await ctx.humanYes(ui(ctx.uiLang(), "ui.consent.host", { host: bareHost(host) })))) return false;
  }
  const all = loadConsents(ctx.env);
  all.hosts[bareHost(host)] = { at: new Date().toISOString(), ...(c ? { connector: c.name } : {}), ...(c?.manifest.policy.terms ? { terms: c.manifest.policy.terms } : {}) };
  saveConsents(ctx.env, all);
  return true;
}

/** Everything a window asks the person about a connector at once: what it does, where it goes, any warning. */
function consentWindow(ctx: Context, c: Connector): string {
  const lang = ctx.uiLang();
  const miss = missingConsents(ctx.env, c);
  return [
    ui(lang, "ui.consent.connector", { name: c.manifest.title }),
    sandboxedRun(c)
      ? ui(lang, "ui.consent.connector.hosts", { hosts: c.manifest.hosts.map(bareHost).join(", ") })
      : ui(lang, "ui.consent.connector.unfenced", { run: c.manifest.run.join(" ") }),
    ...(miss.code === "changed" ? [ui(lang, "ui.consent.connector.changed")] : []),
    ...(directNetwork(c).length ? [ui(lang, "ui.consent.connector.direct")] : []),
    ...(c.manifest.policy.terms ? [ui(lang, "ui.consent.connector.terms", { terms: c.manifest.policy.terms })] : []),
  ].join("\n\n");
}

/** The user's yes to a connector's folder (and its code as it is now). */
function grant(ctx: Context, c: Connector, source: string): void {
  const all = loadConsents(ctx.env);
  all.connectors[c.name] = { dir: c.dir, hash: connectorHash(c.dir), hosts: c.manifest.hosts, at: new Date().toISOString(), source };
  saveConsents(ctx.env, all);
}

/**
 * What is left to allow: on the terminal the connector (after its warning), then each host.
 * By a window the person said yes to all of it at once (the window showed it all: consentWindow).
 */
async function askConnector(ctx: Context, c: Connector, source: string, byWindow = false): Promise<{ allowed: boolean; hosts: string[]; missing: string[] }> {
  const miss = missingConsents(ctx.env, c);
  if (miss.code) {
    if (!byWindow) {
      ctx.io.stdout("\n" + codeWarning(c, source, directNetwork(c)) + "\n");
      if (!(await ctx.humanYes(consentWindow(ctx, c)))) return { allowed: false, hosts: [], missing: c.manifest.hosts.map(bareHost) };
    }
    grant(ctx, c, source);
  }
  const hosts: string[] = [];
  const ask = consentRequired(ctx.env);
  for (const h of c.manifest.hosts.map(bareHost)) if (!ask || loadConsents(ctx.env).hosts[h] || (await askHost(ctx, h, c, byWindow))) hosts.push(h);
  return { allowed: true, hosts, missing: c.manifest.hosts.map(bareHost).filter((h) => !hosts.includes(h)) };
}

/**
 * Before a connector runs: everything allowed? The user, on a terminal, is asked
 * right here; anyone else (an agent, a script) gets exit 4 and the command for the user.
 */
async function ensureAllowed(ctx: Context, c: Connector): Promise<boolean> {
  ctx.confirmElsewhere(
    `Run connector ${c.name} (${c.manifest.title}) — asked by an agent outside the research's folder?`,
    `strom connector test ${c.name}`,
    `elsewhere:connector:${c.name}`,
    ui(ctx.uiLang(), "ui.consent.elsewhere.connector", { name: c.manifest.title, cwd: ctx.display(ctx.cwd) }),
  );
  const miss = missingConsents(ctx.env, c);
  if (!miss.code && !miss.hosts.length) return true;
  const changed = miss.code === "changed";
  const how = ctx.requireHuman(
    consentRequired(ctx.env)
      ? `${changed ? "The code of" : "Run"} connector ${c.name} (${c.manifest.title})${changed ? " changed since it was allowed — allow it again" : ""}${miss.hosts.length ? `, with automated access to ${miss.hosts.join(", ")}` : ""}?`
      : `Connector ${c.name} (${c.manifest.title}) ${sandboxedRun(c) ? "reaches the network itself, past strom's limiter" : `runs a program strom does not fence in (${c.manifest.run.join(" ")})`}${changed ? ", and its code changed since it was allowed" : ""} — run it?`,
    `strom allow connector ${c.name}`,
    `connector:${c.name}`,
    consentWindow(ctx, c),
  );
  const r = await askConnector(ctx, c, ctx.display(c.dir), how === "window");
  return r.allowed && !r.missing.length;
}

function consentState(ctx: Context, c: Connector): string {
  const miss = missingConsents(ctx.env, c);
  if (!miss.code && !miss.hosts.length) return !consentRequired(ctx.env) ? "ready" : changedSinceConsent(ctx.env, c) ? "allowed (changed since)" : "allowed";
  return [miss.code === "new" ? "needs a consent" : miss.code === "changed" ? "code changed — needs a consent again" : "", miss.hosts.length ? `hosts not allowed: ${miss.hosts.join(", ")}` : ""].filter(Boolean).join("; ");
}

/** " · 4317×3233 px" of an image file, when strom can read its size. */
function pixels(file: string): string {
  const s = imageSizeOfFile(file);
  return s ? ` ${s.width}×${s.height} px` : "";
}

/**
 * What a run asked of the archive: the requests that went to its hosts, as the hourly counter takes them (a redirect
 * and a retry are requests too) — the connector's own count said beside where it is less.
 */
function describeRun(r: RunReport, what: string): string {
  const more = r.sent - r.requests;
  return lines(
    `${what}: ${counted(r.sent, "request")}${more > 0 ? ` (the connector asked ${r.requests}; ${more} more: redirects or retries)` : ""}${r.pages ? ` + ${counted(r.pages, "page")} your browser got` : ""}${r.stopped ? ` · stopped: ${r.stopped}` : ""}`,
    ...r.logs.slice(-10).map((l) => `  · ${l}`),
  );
}

/**
 * How long strom fetch waits by itself for an archive's limit used up (its hourly cap, a limit it says is used up),
 * instead of the agent sleeping and asking again: up to FETCH_WAIT_MS, never into the last minutes of a session of
 * strom run (what was found is written then) — said before it waits. Longer: it ends, saying when to try again.
 */
export const FETCH_WAIT_MS = 30 * 60_000;

function limitWait(ctx: Context): { waitMs: number; onWait: (w: { host: string; until: number; ms: number; why: WaitWhy }) => void } {
  const deadline = deadlineOf(ctx.env);
  const left = deadline !== undefined ? deadline - Date.now() - REMIND_MS : Infinity;
  const waitMs = Math.max(0, Math.min(FETCH_WAIT_MS, left));
  return {
    waitMs,
    onWait: (w) =>
      ctx.io.stderr(
        `  · ${w.host}: ${w.why === "cap" ? "its hourly cap is used up" : w.why === "down" ? "left alone for a while (it went silent, or asked to slow down)" : "it says its limit is used up"} — strom waits until ${clockUp(w.until)} (${Math.max(1, Math.ceil(w.ms / 60_000))} min), then goes on by itself (it waits at most ${Math.round(waitMs / 60_000)} min); do not stop it\n`,
      ),
  };
}

/** The limiter's pauses and requests counted for the measure of a run (core/metrics.ts). */
function metered(m: FetchMeter): { onPause: FetchMeter["pause"]; onRequest: FetchMeter["request"] } {
  return { onPause: m.pause, onRequest: m.request };
}

/**
 * A run of a connector written to .strom/metrics/fetch.jsonl: who asked what of which archive — its requests to each
 * host, the pauses for its pace and the waits for its limits, what it got. Outside a research nothing is written.
 */
function measure(ctx: Context, c: Connector, meter: FetchMeter | undefined, rec: Record<string, unknown>, r?: RunReport): void {
  try {
    if (!ctx.hasTree()) return;
    const tree = ctx.tree();
    const got = r ? r.images.map((i) => i.n).filter((n): n is number => n !== undefined) : [];
    recordFetch(
      tree,
      ctx.env,
      {
        connector: c.name,
        ...rec,
        ...(r
          ? {
              requests: r.requests,
              pages: r.pages,
              got,
              located: r.located.length || undefined,
              books: r.books.length || undefined,
              later: r.later !== undefined ? new Date(r.later).toISOString() : undefined,
              stopped: r.stopped?.slice(0, 200),
              status: r.refused?.status,
              refused: r.refused ? (r.refused.robots ? "robots" : r.refused.kind) : undefined,
              result: rec.result ?? (r.needs ? "page" : r.later !== undefined ? "later" : r.stopped ? "stopped" : "ok"),
            }
          : {}),
      },
      meter,
    );
  } catch {
    // a measurement is no reason to fail
  }
}

/**
 * A run that ended at a limit used up, or at a host left alone for a while (it went silent, asked to slow down): when
 * to try again (rounded up — never a minute too early), what to do meanwhile, and the exit code that says "later".
 * `background`: the command of a fetch in the background (it waits for a host that frees within FETCH_WAIT_MS).
 * A host left alone, in a session: the next step said exactly (`next`, the text and --json) — the session is told
 * once, a fetch of it asking the host again before then ends at once (exit 8, core/leftalone.ts).
 */
function later(r: RunReport, again: string, background?: string, o: { session?: boolean; run?: boolean } = {}): { line?: string; exitCode?: (typeof EXIT)["later"]; data?: { retryAt: string; leftAlone?: string; next?: string } } {
  if (r.later === undefined) return {};
  const at = clockUp(r.later);
  const retryAt = new Date(Math.ceil(r.later / 60_000) * 60_000).toISOString();
  const soon = background && r.later - Date.now() <= FETCH_WAIT_MS ? `; or let it wait by itself: ${background} --background` : "";
  if (!r.laterDown)
    return {
      line: `→ the archive's limit is used up: try again at ${at}, not sooner (${again})${soon}; meanwhile other work, or close the session for later (strom session close --continue) — no sleeping, no asking again sooner`,
      exitCode: EXIT.later,
      data: { retryAt },
    };
  const h = r.laterDown;
  const next = o.session
    ? `work on what needs nothing from ${h} (images here already, another book); the task needs it: back to the queue for later — strom session close --continue --summary "…" --next "…"${o.run ? ' --reason "…"' : ""} — no sleeping, no fetch of ${h} before ${at}: asked again in this session, strom refuses at once (exit 8)`
    : `other work until ${at} — no sleeping, no asking again sooner`;
  return {
    line: lines(`→ ${h} is left alone until ${at} (it went silent, or asked to slow down — strom sends it nothing before then): try again at ${at}, not sooner (${again})${soon}`, `next: ${next}`),
    exitCode: EXIT.later,
    data: { retryAt, leftAlone: h, next },
  };
}

/**
 * A fetch of a session asking again a host it was told is left alone, the same time off still lasting: refused before
 * anything (no estimate, no request, no image touched) — exit 8, until when and what to do. A fetch in the background
 * that waits for it by itself (it frees within its wait) is not refused. Outside a session, and for a fetch in the
 * background strom started, nothing is kept or refused.
 */
function refuseAskedAgain(ctx: Context, c: Connector, session: Session | undefined, background: boolean): void {
  if (!session) return;
  const alone = leftAloneHosts(ctx, c);
  const by = Date.now() + limitWait(ctx).waitMs;
  const hit = askedAgain(ctx.tree().root, session.id, background ? alone.filter((a) => a.until > by) : alone);
  if (!hit) return;
  const at = clockUp(hit.until);
  throw new StromError(`${hit.host} is left alone until ${at} (it went silent, or asked to slow down) — this session was told so already: nothing done, nothing sent`, {
    exitCode: EXIT.askedAgain,
    code: "fetch.left-alone",
    params: { host: hit.host, until: new Date(Math.ceil(hit.until / 60_000) * 60_000).toISOString() },
    hint: `no fetch of ${hit.host} before ${at}: work on what needs nothing from it, or back to the queue for later — strom session close --continue --summary "…" --next "…"${deadlineOf(ctx.env) !== undefined ? ' --reason "…"' : ""}`,
  });
}

/** A fetch of a session was told a host is left alone (exit 7): kept, so that the session is told once. */
function noteAskedOnce(ctx: Context, session: Session | undefined, res: Result): void {
  const d = res.data as { leftAlone?: unknown; retryAt?: unknown } | undefined;
  if (!session || res.exitCode !== EXIT.later || typeof d?.leftAlone !== "string" || typeof d.retryAt !== "string") return;
  const until = Date.parse(d.retryAt);
  if (Number.isFinite(until)) noteLeftAlone(ctx.tree().root, session.id, d.leftAlone, until);
}

/** Does this strom's task wait take --check <URL> (a check of a site by the person)? Said in the advice only then. */
function waitChecks(): boolean {
  const def = match(["task", "wait"])?.def;
  return !!def && optionsOf(def).some((o) => o.name === "check");
}

/**
 * What the agent is told after a host refused, was left alone after a refusal, or its robots.txt keeps automated tools
 * off the path: why (a refusal of strom's client, too many requests, the login, robots.txt), what strom does, and then
 * what to do next — another way to the same records first, and only when this source stays necessary for the task the
 * ready command of a task that waits for the person's check of the site. strom founds no task itself.
 */
export function refusalAdvice(ctx: Context, c: Connector, f: NonNullable<RunReport["refused"]>, place?: string): string {
  const h = f.host;
  const st = hostState(netDir(ctx), h);
  const around = "Never round it (another connector, your web tools, the browser).";
  const head = f.robots
    ? f.robots.all
      ? `→ ${h}'s robots.txt keeps automated tools off the whole site ("${f.robots.line}"): strom sends it no direct request — only the person's own browser goes there (a connector whose pages come from the browser, with the person's permission), else by hand. ${around}`
      : `→ ${h}'s robots.txt keeps automated tools off ${f.robots.path} ("${f.robots.line}"): strom did not ask it — by hand, or the person's decision (strom allow archive ${keyHost(c, h)} --way slow — the person's, never yours). ${around}`
    : f.kind === "client"
      ? `→ ${h} does not let automated tools in: it refused strom's client on the first request${st.refusedFirst ? ", a second day too" : ", and never let it in before"} — no load from strom, not a block for too many requests. strom leaves it alone until the person lifts it (strom allow host ${h} --unblock — the person's). Do not try it through your web tools or the browser either.`
      : f.kind === "login"
        ? `→ ${h} answered 401: the login of ${c.name} has most likely run out — the person saves it again in their own terminal (strom login ${c.name}) and lifts the pause (strom allow host ${h} --unblock); meanwhile other work.`
        : !f.now
          ? `→ ${h} refused strom before: left alone ${leftUntil(h, f.until ?? st.blockedUntil ?? Date.now())} — leave it alone, never sooner. ${around}`
          : f.kind === "first"
            ? `→ ${h} refused strom's first request: leave it alone for a day — strom does; refused so again on another day, it is left alone until the person lifts it. ${around}`
            : `→ ${h} refused after strom's requests (too many, or too fast for it): leave it alone for a day — stop, never sooner. ${around}`;
  if (f.kind === "login") return head;
  const task = taskHere(ctx) ?? "T…";
  // the site as it was asked: its scheme and port kept (an archive on http, a port of its own)
  const open = c.manifest.browser?.open && URL.canParse(c.manifest.browser.open) ? c.manifest.browser.open : `${f.origin ?? st.robots?.origin ?? `https://${h}`}/`;
  const p = place ? shellArg(place) : "<place>";
  const wait = waitChecks()
    ? `strom task wait ${task} --check ${open} --on "<what the person should check there — impersonal, in the research language>"`
    : `strom task wait ${task} --on "<what the person should check at ${open} — impersonal, in the research language>"`;
  return lines(
    head,
    `next: (1) another way to the same records — another archive or fonds of the jurisdiction, the parish, an index, a catalogue: strom recordset list --place ${p} · strom place show ${p} · strom repo list; record the search: strom search add "…" --result inconclusive --note "${h} refused automated access"`,
    `(2) only if this source stays necessary for the task (the only book for the place and years, a check without which the conclusion cannot close): ${wait}`,
  );
}

/**
 * A host that refused just now: the person hears it in the research's history (op net.refused, said in the research
 * language: strom recent, the bridge's /log) — the host, why, until when, the connector.
 */
function refusalSaid(ctx: Context, c: Connector, f: RunReport["refused"]): void {
  if (!f?.now || !f.kind || !ctx.hasTree()) return;
  const tree = ctx.tree();
  if (tree.dryRun) return;
  const until = f.until ?? hostState(netDir(ctx), f.host).blockedUntil;
  try {
    tree.withTreeLock(() =>
      tree.appendOp({ op: "net.refused", targets: [], files: [], summary: `${f.host}: refused (${f.kind}, HTTP ${f.status ?? "?"}); left alone until ${f.kind === "client" ? "the person lifts it" : new Date(until ?? Date.now()).toISOString()}; connector ${c.name}` }),
    );
  } catch {
    // the research busy: the agent was told; the person sees the host refused in strom status and doctor
  }
}

/** The options of a run that tell the limiter the person's word for paths robots.txt keeps off, and keep its verdicts. */
function netWords(ctx: Context, c: Connector, levels: ArchiveLevel[]): { robotsPermitFor?: (host: string) => Pace | undefined; onVerdict: ReturnType<typeof verdictKeeper> } {
  return { ...robotsPermits(ctx, c, levels), onVerdict: verdictKeeper(ctx, c, (rec) => measure(ctx, c, undefined, rec)) };
}

/** Up to this many books, each comes with the command to register it; more, one line each. */
const BOOKS_IN_FULL = 3;
const BOOKS_SHOWN = 30;

function bookLines(r: RunReport, c: Connector, listOne: string, tree?: Tree): string[] {
  // a connector that fetches nothing (the terms forbid it, or it only finds): the images come by hand
  const fetches = !byHandOnly(c) && c.manifest.can.some((x) => x === "fetch" || x === "locate");
  // a book the research has already (its link, or images fetched from it): read there, never registered again
  const known = (b: FoundBook) => (tree ? sameBooks(tree, { ...(b.url ? { url: b.url } : {}), connector: c.name, ...(b.id !== undefined ? { book: String(b.id) } : {}) }) : []);
  const line = (b: FoundBook) => `${b.title}${b.callNumber ? ` (${b.callNumber})` : ""}${b.years ? ` · ${b.years}` : ""}${b.kinds?.length ? ` · ${b.kinds.join(",")}` : ""}${b.images ? ` · ${counted(b.images, "image")}` : ""}`;
  const here = (b: FoundBook) => {
    const same = known(b);
    return same.length ? ` · already in the research as ${same.map(sameBookText).join(", ")}` : "";
  };
  if (r.books.length > BOOKS_IN_FULL)
    return [
      ...r.books.slice(0, BOOKS_SHOWN).map((b) => `  ${b.id ? `${b.id}  ` : ""}${line(b)}${here(b)}`),
      r.books.length > BOOKS_SHOWN ? `  … ${r.books.length - BOOKS_SHOWN} more — narrow it with --years, or read them all with --json` : undefined,
      `  one of them, with the command to register it: ${listOne}`,
    ].filter((l): l is string => l !== undefined);
  return r.books.map((b) => {
    const same = known(b);
    if (same.length) {
      const first = same[0]!;
      return [
        `  ${line(b)}`,
        b.url ? `    ${b.url}` : undefined,
        `    already in the research as ${same.map(sameBookText).join(", ")} — never registered again`,
        `    read it: strom read ${first.book.id} --images <from-to>`,
        fetches && b.id ? `    its images not here yet: strom fetch ${c.name} ${shellArg(b.id)} --images <from-to> --recordset ${first.book.id}` : undefined,
      ]
        .filter(Boolean)
        .join("\n");
    }
    return [
      `  ${line(b)}`,
      b.url ? `    ${b.url}` : undefined,
      `    strom recordset add ${shellArg(b.title)}${b.callNumber ? ` --call-number ${shellArg(b.callNumber)}` : ""}${b.kinds?.length ? ` --kinds ${b.kinds.join(",")}` : ""}${b.places?.length ? ` --places ${shellArg(b.places.join(","))}` : ""}${b.years ? ` --years ${b.years}` : ""}${b.url ? ` --url ${shellArg(b.url)}` : ""} --access online-free`,
      !fetches
        ? `    then: the user saves the images by hand — strom task wait T… --images B…:<from-to> --on "<the book, its link, which images>"`
        : b.id
          ? `    then: strom fetch ${c.name} ${shellArg(b.id)} --images <from-to> --recordset B…`
          : undefined,
    ]
      .filter(Boolean)
      .join("\n");
  });
}

function parseImages(v: unknown, max = 1000): number[] | undefined {
  if (v === undefined) return undefined;
  // n, from-to, or a list of them (20,50,80 — a book sampled; 40-69,75): what strom says back is taken too (40–69, 75)
  const parts = String(v).split(/[,;\s]+/u).filter(Boolean);
  if (!parts.length) throw new UsageError(`--images must be n, from-to or a list (20,50,80), not "${v}"`);
  const out = new Set<number>();
  for (const part of parts) {
    const m = /^(\d+)(?:[-–](\d+))?$/u.exec(part);
    if (!m) throw new UsageError(`--images must be n, from-to or a list (20,50,80), not "${v}"`);
    const a = Number(m[1]);
    const z = Number(m[2] ?? m[1]);
    if (a < 1) throw new UsageError("--images: images are counted from 1");
    if (z < a) throw new UsageError("--images: from before to");
    if (z - a >= max) throw new UsageError(`--images: at most ${max} at a time`, { hint: "the rest in the next run (an archive's hourly cap: in the next hour)" });
    for (let n = a; n <= z; n++) out.add(n);
  }
  if (out.size > max) throw new UsageError(`--images: at most ${max} at a time`, { hint: "the rest in the next run (an archive's hourly cap: in the next hour)" });
  return [...out].sort((x, y) => x - y);
}

/** Image numbers as --images takes them again: 20,40-69 (no spaces, no en dash). */
function imagesArg(ns: number[]): string {
  return runs(ns).replace(/–/g, "-").replace(/,\s*/g, ",");
}

/**
 * When the last of n requests can go to a host at its pace: one at a time, ≥ its pause apart, and under its hourly cap
 * with the requests of the last hour counted (ms from now). A connector may make more requests than images (a page of
 * the book first): this is the least.
 */
export function requestsSpan(n: number, pace: Pace, recent: number[], now = Date.now()): number {
  const window = recent.filter((t) => t > now - 3600_000).sort((a, b) => a - b);
  let t = now;
  for (let i = 0; i < n; i++) {
    if (i) t += pace.minIntervalMs;
    if (Number.isFinite(pace.perHour) && pace.perHour > 0)
      for (;;) {
        const inHour = window.filter((x) => x > t - 3600_000);
        if (inHour.length < pace.perHour) break;
        t = inHour[inHour.length - pace.perHour]! + 3600_000;
      }
    window.push(t);
  }
  return Math.max(0, t - now);
}

/**
 * What a fetch asks of the archive, said before it starts: the requests, how long at the host's pace, its hourly cap
 * and what is left of it. The requests as the host's counter took them in this research's last runs of the connector
 * (a page of the book first, a redirect, a request for its size): an image, or a part, at least one.
 */
function estimate(ctx: Context, c: Connector, images: number, part?: number, human?: Map<string, Pace>): string {
  const host = bareHost(c.manifest.hosts[0] ?? "");
  const per = ctx.hasTree() ? requestsPerImage(ctx.tree().root, c.name, part !== undefined ? "part" : "fetch") : undefined;
  const asks = Math.max(images, Math.ceil(images * (per ?? 1) - 1e-9));
  const pace = connectorPace(ctx, c, human);
  const recent = hostState(netDir(ctx), host).recent;
  const now = (testHooks.now ?? Date.now)();
  const span = (n: number) => {
    const secs = Math.round(requestsSpan(n, pace, recent, now) / 1000);
    return secs < 90 ? `${secs} s` : `${Math.round(secs / 60)} min`;
  };
  const capped = Number.isFinite(pace.perHour) && pace.perHour > 0;
  const left = capped ? Math.max(0, pace.perHour - recent.filter((t) => t > now - 3600_000).length) : Infinity;
  const pacing = `≥${pace.minIntervalMs / 1000} s apart${capped ? `, at most ${pace.perHour} an hour — ${left} left this hour` : ""}`;
  const waits = asks > left;
  const learned = per !== undefined && asks > images ? ` (${nf(per)} requests ${part !== undefined ? "a part" : "an image"}, as its last runs here went)` : "";
  return lines(
    `${part !== undefined ? `a part of image ${part}` : counted(images, "image")} through ${c.name}: ${learned ? "about" : "at least"} ${counted(asks, "request")} to ${host}${learned}, about ${span(asks)} at its pace (${pacing})`,
    waits
      ? `  the hourly cap holds the rest back: fetch the whole images first (a request each) and a part only of an image whose entry needs it`
      : undefined,
  );
}

/** 1.5, 2, 2.33 — a number of requests as said. */
function nf(n: number): string {
  return String(Math.round(n * 100) / 100);
}

/** How a connector's images come here, and what else it can do. */
function routeText(ctx: Context, c: Connector): string {
  const r = routeOf(ctx.env, c);
  const other = routesOf(c).filter((x) => x !== r.via);
  return [
    r.via === "browser" ? "through your browser" : "directly, through strom",
    r.chosen ? `(chosen ${r.chosen.at.slice(0, 10)} ${r.chosen.by})` : undefined,
    other.length ? `· can also: ${other.join(", ")} (strom connector use ${c.name} --via ${other[0]})` : undefined,
  ]
    .filter(Boolean)
    .join(" ");
}

register(
  {
    path: ["connector", "list"],
    summary: "Connectors: plugins that download from an archive portal — which there are, whether they can run",
    group: "sources",
    run(ctx) {
      const s = ctx.settings.shared()?.value;
      const { connectors, broken } = scanConnectors(s);
      const folder = s ? `folder: ${ctx.display(connectorsDir(s))} — copy a connector's folder in to install it (the contract: README.md there)` : "not set up yet: strom setup";
      const data = {
        folder: s ? connectorsDir(s) : undefined,
        connectors: connectors.map((c) => ({ name: c.name, dir: c.dir, title: c.manifest.title, can: c.manifest.can, hosts: c.manifest.hosts, policy: c.manifest.policy, consent: consentState(ctx, c), routes: routesOf(c), via: routeOf(ctx.env, c).via })),
        broken,
      };
      if (!connectors.length && !broken.length)
        return {
          text: lines("no connectors yet", `  ${folder}`, "  an archive the research needs has none: build its connector — strom connector new <name> --url <portal>"),
          data,
        };
      return {
        text: lines(
          connectors.length ? table(connectors.map((c) => [c.name, c.manifest.title, c.manifest.can.join(","), `automation ${c.manifest.policy.automation}`, consentState(ctx, c), routeOf(ctx.env, c).via === "browser" ? "via your browser" : ""])) : undefined,
          ...broken.map((b) => `${b.name}  ⚠ cannot run: ${b.problem}`),
          folder,
        ),
        data,
      };
    },
  },
  {
    path: ["connector", "show"],
    summary: "One connector: what it can do, what the portal allows, your consent, how its hosts are doing",
    group: "sources",
    args: [{ name: "connector", description: "its name (its folder's name)", required: true }],
    examples: ["strom connector show example-archive"],
    run(ctx, { args }) {
      const c = findConnector(ctx.settings.shared()?.value, args[0]!);
      const m = c.manifest;
      const direct = directNetwork(c);
      const pace = connectorPace(ctx, c);
      const own = hostState(netDir(ctx), bareHost(m.hosts[0] ?? "")).own;
      return {
        text: lines(
          `${c.name}${m.version ? ` ${m.version}` : ""} — ${m.title}  (${ctx.display(c.dir)})`,
          `can        ${m.can.join(", ")}`,
          m.newer ? `newer      ${m.newer.join(", ")} — from a newer contract, left out here (strom update runs them)` : undefined,
          `runs       ${m.run.join(" ")}`,
          `automation ${m.policy.automation}${m.policy.terms ? ` · terms ${m.policy.terms}` : " · terms not recorded"}`,
          m.policy.termsSummary ? `           ${m.policy.termsSummary}` : undefined,
          ...levelsOf(ctx, c, true).map((a) => `archive    ${a.host}: ${levelText(a)}${a.permission ? ` · the user's permission: images ${a.permission === "slow" ? "slowly" : a.permission === "browser" ? "through the browser" : "by hand"}` : a.level === "restricted" || a.level === "unknown" ? " · images only with the user's permission (asked at the first one; strom allow archive)" : ""}`),
          m.withheld?.length ? `withheld   ${m.withheld.join(", ")} — its terms are "${m.policy.automation}": no images through tools (take them out of connector.json)` : undefined,
          m.policy.officialExport ? `official   ${m.policy.officialExport}` : undefined,
          `pace       ${paceText(pace)}${own ? " — yours for the host (strom allow host … --pace auto: the service's again)" : m.policy.pace?.source ? ` — the service's: ${m.policy.pace.source}` : ""}`,
          m.can.includes("fetch") || m.can.includes("locate") ? `images     ${routeText(ctx, c)}` : undefined,
          `consent    ${consentState(ctx, c)}`,
          m.login ? `login      ${loginState(ctx, c)} — ${m.login.about}${m.login.url ? ` (${m.login.url})` : ""}` : undefined,
          direct.length ? `⚠ reaches the network directly (strom cannot pace that):\n${direct.map((d) => `  ${d}`).join("\n")}` : "network    only through strom (checked)",
          "hosts",
          ...m.hosts.map((h) => `  ${hostLine(ctx, bareHost(h))}`),
        ),
        data: { name: c.name, connector: m, dir: c.dir, consent: consentState(ctx, c), ...(m.login ? { login: !!loginOf(ctx.env, c) } : {}), direct, pace, routes: routesOf(c), via: routeOf(ctx.env, c).via, archives: levelsOf(ctx, c, true) },
      };
    },
  },
  {
    path: ["connector", "use"],
    summary: "Choose how a connector's images come: directly through strom, or through your own browser — switch any time",
    group: "sources",
    description:
      "Through the browser, the agent fetches them in your own browser (Claude in Chrome), where your login to the\n" +
      "portal lives: strom still plans every request, paces it, and takes the files over from your downloads\n" +
      "folder, checked and registered. The agent gets browser tools for the connector's sites only, in the trees that\n" +
      "work with the archive (images fetched through it, or an archive, book or record on its site), from its next\n" +
      "session on. Your agent may switch it when you ask it to.",
    args: [{ name: "connector", description: "its name", required: true }],
    options: [{ name: "via", type: "string", value: "<direct|browser>", description: "direct: strom fetches them · browser: your browser does" }],
    examples: ["strom connector use example-archive --via browser", "strom connector use example-archive --via direct"],
    run(ctx, { args, opts }) {
      const c = findConnector(ctx.settings.shared()?.value, args[0]!);
      const via = String(opts.via ?? "").toLowerCase() as Route;
      if (!ROUTES.includes(via)) throw new UsageError("--via direct or --via browser", { hint: `connector ${c.name} can: ${routesOf(c).join(", ")}` });
      if (!routesOf(c).includes(via))
        throw new UsageError(`connector ${c.name} cannot fetch ${via === "browser" ? "through the browser" : "directly — only through the browser"}`, {
          hint: via === "browser" ? `its connector.json has no route "browser" (with "locate" in can) — whoever keeps it can add them: the contract, ${path.join(path.dirname(c.dir), "README.md")}` : `it needs the browser (a login the browser holds): strom connector use ${c.name} --via browser`,
        });
      const levels = via === "browser" ? levelsOf(ctx, c, true) : [];
      if (via === "browser" && (byHandOnly(c) || levels.some((a) => a.level === "manual" || a.level === "forbidden" || a.permission === "manual")))
        throw new UsageError(`${c.manifest.title} does not allow automated download (${byHandOnly(c) ? "its terms, as the connector read them" : levels.filter((a) => a.level === "manual" || a.level === "forbidden" || a.permission === "manual").map((a) => (a.permission === "manual" && a.level !== "manual" ? "the user chose: images by hand" : levelText(a))).join("; ")}) — through the browser neither`, {
          hint: 'the user saves the images by hand: strom task wait T… --images B…:<from-to> --on "<the book, its link, which images>"',
        });
      // an archive whose terms restrict automation, or one behind a bot check: through the browser is the person's to allow
      const need = levels.filter((a) => !allows(a, c.manifest.browser?.pages ? "pages" : "images", "browser").ok);
      if (need.length) {
        const how = ctx.requireHuman(
          `Fetch the images of ${c.manifest.title} (${need.map((a) => a.host).join(", ")}) through the browser on this computer — its terms restrict automated access (${levelText(need[0]!)})?`,
          `strom connector use ${c.name} --via browser`,
          `archive:${need.map((a) => a.host).join(",")}`,
          permissionText(ctx, need[0]!, "browser", c),
        );
        grantWay(ctx.env, need.map((a) => a.host), "browser", { by: how === "window" ? "window" : "terminal", connector: c });
      }
      const s = ctx.settings;
      s.config.connectorRoutes = { ...(s.config.connectorRoutes ?? {}), [c.name]: { via, at: new Date().toISOString(), by: ctx.io.tty ? "in a terminal" : "by a command without a terminal (an agent or the app)" } };
      s.save();
      // the agents' permissions of every tree follow at once: browser tools for these sites, or none
      const synced = syncTrees(ctx);
      const hosts = c.manifest.hosts.map(bareHost);
      return {
        text:
          via === "browser"
            ? lines(
                `${c.name}: images through your browser from now on (${hosts.join(", ")})`,
                `  · the agent gets browser tools (Claude in Chrome) for these sites only, in the family trees that work with this`,
                `    archive (images fetched through it, or an archive, book or record of theirs on its site), from its next session${synced.length ? ` (permissions of ${synced.join(", ")} updated)` : ""}. Chrome with the`,
                "    Claude extension must be running then, signed in to the account Claude Code uses; browser tools need a model",
                "    that can review its actions (Sonnet or Opus, not Haiku)",
                `  · strom plans and paces every request, and takes the files over from ${ctx.display(s.downloads())}`,
                "    (another folder: strom config set browser.downloads <folder>)",
                `  · the first time, Chrome asks whether ${hosts[0]} may download several files: allow it once`,
                `  · back: strom connector use ${c.name} --via direct`,
                ...browserWarnings(ctx),
              )
            : lines(`${c.name}: images directly through strom from now on, paced (${hosts.join(", ")})`, routesOf(c).includes("browser") ? `  · through your browser again: strom connector use ${c.name} --via browser` : undefined),
        data: { connector: c.name, via, hosts, synced },
      };
    },
  },
  {
    path: ["connector", "new"],
    summary: "Start a connector for an archive portal in the plugins folder: the manifest, the SDK and the brief for your agent",
    group: "sources",
    description:
      "The brief (DISCOVERY.md) has the agent find out first what the portal allows — its terms of use,\n" +
      "robots.txt, official exports — and only then write the connector against the contract (README.md\n" +
      "of the plugins folder).",
    args: [{ name: "name", description: "short name, lowercase — also its folder's name: state-archive", required: true }],
    options: [
      { name: "url", type: "string", value: "<url>", description: "the portal (its start page) — required" },
      { name: "title", type: "string", value: "<text>", description: "the archive or portal, as people call it" },
    ],
    examples: ['strom connector new state-archive --url https://archive.example.org --title "Example State Archive"'],
    run(ctx, { args, opts }) {
      const name = args[0]!;
      if (!NAME_RE.test(name)) throw new UsageError("a connector's name is lowercase letters, digits and dashes", { hint: `e.g. ${suggestName(name) ?? "example-archive"}` });
      if (!opts.url) throw new UsageError("give the portal: --url https://…");
      let url: URL;
      try {
        url = new URL(String(opts.url));
      } catch {
        throw new UsageError(`not a URL: ${opts.url}`);
      }
      const connectors = ensurePluginsDir(shared(ctx));
      const dir = path.join(connectors, name);
      // never somebody else's or an older folder taken over (a folder with no connector in it, a file, a symbolic link,
      // the same name in other capitals or another form of its letters): a connector of its own, under another name
      const taken = (other: string) =>
        new UsageError(`${ctx.display(path.join(connectors, other))} is there already — a new connector never takes over what is in the plugins folder`, {
          hint: `another name: strom connector new ${name}-2 --url ${shellArg(url.href)}${opts.title ? ` --title ${shellArg(String(opts.title))}` : ""}`,
        });
      const other = nameTaken(connectors, name);
      if (other !== undefined) throw taken(other);
      // a connector of the same site (its domain: a mirror's, an API host's) under another name: said — the web's pages
      // of the site go through that one (the hook names it too); this one only for another portal of the site
      const ofSite = siteConnector(shared(ctx), url.hostname);
      const title = String(opts.title ?? url.hostname);
      const fill = (s: string) => s.replaceAll("__TITLE__", title).replaceAll("__URL__", url.origin).replaceAll("__NAME__", name);
      try {
        fs.mkdirSync(dir); // its own, or none: another process making the same name meanwhile gets EEXIST
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "EEXIST") throw taken(name);
        throw err;
      }
      const manifest = {
        interface: INTERFACE,
        title,
        version: "0.1.0",
        run: ["node", "connector.ts"],
        hosts: [url.hostname],
        can: ["find", "list", "fetch"],
        policy: { automation: "unknown", terms: "", termsSummary: "", robots: "", officialExport: "" },
      };
      fs.writeFileSync(path.join(dir, MANIFEST), JSON.stringify(manifest, null, 2) + "\n");
      fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify({ type: "module", private: true }, null, 2) + "\n");
      fs.writeFileSync(path.join(dir, "sdk.ts"), readAsset("plugins", "connectors", "sdk.ts")!);
      fs.writeFileSync(path.join(dir, "connector.ts"), fill(readAsset("plugins", "connectors", "template.ts")!));
      fs.writeFileSync(path.join(dir, "DISCOVERY.md"), fill(readAsset("plugins", "connectors", "DISCOVERY.md")!));
      fs.writeFileSync(path.join(dir, "README.md"), `# ${title} — strom connector\n\nPortal: ${url.origin}\n\nHow the portal is mapped (catalogue search, book IDs, image URLs, requests per image) — written by whoever builds it.\n`);
      // started in a session at work: its agent may take it away again in that session when it serves nothing
      // (strom connector discard) — in the research's own .strom, never in the plugin's folder
      const tree = ctx.hasTree() ? ctx.tree() : undefined;
      const session = tree ? currentSession(tree, ctx.env) : undefined;
      // whether its agent may take it away again (strom connector discard), else it is the user's to remove
      let discardable = false;
      if (tree) {
        const marker = madeMarker(tree.root, name);
        const folder = folderId(dir);
        if (session && folder) {
          discardable = true;
          const made: MadeConnector = { session: session.id, tree: tree.config.id, ...(session.research ? { research: session.research } : {}), at: new Date().toISOString(), folder };
          fs.mkdirSync(path.dirname(marker), { recursive: true });
          fs.writeFileSync(marker, JSON.stringify(made) + "\n");
        } else fs.rmSync(marker, { force: true }); // one of an older connector of that name names nothing now
      }
      const rel = ctx.display(dir);
      return {
        text: lines(
          `connector ${name} started in ${rel}`,
          "",
          "next:",
          `  1. your agent reads ${path.join(rel, "DISCOVERY.md")} and the contract (README.md one folder up),`,
          "     and finds out what the portal allows — before any code",
          "  2. it writes connector.json (policy) and connector.ts, and tests with a few requests:",
          `     strom connector test ${name} --find "<place>"`,
          consentRequired(ctx.env) ? `  3. the first test needs your consent, in your terminal: strom allow connector ${name}` : undefined,
          ofSite
            ? `\nnote: the connector ${ofSite} is here already for ${webDomain(url.hostname)} (its hosts: ${listConnectors(shared(ctx)).find((c) => c.name === ofSite)?.manifest.hosts.join(", ") ?? "?"}) — more pages of that site go through it (strom connector show ${ofSite}); keep this one only for another portal of the site, else take it away: ${discardable ? `strom connector discard ${name}` : `the user, in their terminal: strom connector remove ${name}`}`
            : undefined,
        ),
        data: { name, dir, ...(ofSite ? { site: { domain: webDomain(url.hostname), connector: ofSite } } : {}) },
      };
    },
  },
  {
    path: ["connector", "add"],
    summary: "Install a connector from a folder or a git URL (you, in a terminal): copied into the plugins folder, then allowed",
    group: "sources",
    description:
      "The same as copying its folder into the plugins folder and allowing it: you read what it is and\n" +
      "what it may contact first. Its name is the folder's name (or --name). An agent cannot run this.",
    args: [{ name: "source", description: "folder or git URL", required: true }],
    options: [{ name: "name", type: "string", value: "<name>", description: "its name here, when the folder's is not one (lowercase, digits, dashes)" }],
    examples: ["strom connector add ~/Downloads/example-archive", "strom connector add https://github.com/someone/strom-connector-example.git --name example-archive"],
    person: "Installing a plugin is the user's own, in their terminal",
    run: async (ctx, { args, opts }) => {
      const source = args[0]!;
      ctx.requireHuman(`Install and allow the connector from ${source}?`, `strom connector add ${shellArg(source)}`, "connector", undefined, { window: false });
      let dir = path.resolve(ctx.cwd, source);
      let tmp: string | undefined;
      try {
        if (!fs.existsSync(dir)) {
          if (!/^(https?:\/\/|git@|ssh:\/\/)/.test(source)) throw new UsageError(`no folder ${source}`, { hint: "a folder with connector.json, or a git URL" });
          tmp = fs.mkdtempSync(path.join(os.tmpdir(), "strom-connector-"));
          const r = runGit(tmp, ["clone", "--depth", "1", source, "c"]);
          if (r.status !== 0) throw new StromError(`git clone failed: ${r.stderr.trim().split("\n").at(-1)}`);
          dir = path.join(tmp, "c");
        }
        const m = readManifest(dir);
        const base = path.basename(tmp ? source.replace(/\/+$/, "").replace(/\.git$/, "") : dir).replace(/^strom-connector-/, "");
        const name = String(opts.name ?? (NAME_RE.test(base) ? base : (suggestName(base) ?? "")));
        if (!NAME_RE.test(name)) throw new UsageError(`"${opts.name ?? base}" is not a connector's name: lowercase letters, digits and dashes`, { hint: `strom connector add ${shellArg(source)} --name <name>` });
        const target = path.join(ensurePluginsDir(shared(ctx)), name);
        const same = path.resolve(dir) === path.resolve(target);
        ctx.io.stdout(codeWarning({ name, dir: target, manifest: m }, source, directNetwork({ dir, manifest: m })) + "\n");
        if (!same && fs.existsSync(target)) ctx.io.stdout(`  ⚠ it replaces the connector ${name} that is there now\n`);
        if (!(await ctx.confirm(`Install and allow connector ${name}?`, false))) return { text: "not allowed — nothing changed", data: { allowed: false } };
        if (!same) {
          fs.rmSync(target, { recursive: true, force: true });
          fs.cpSync(dir, target, { recursive: true, filter: (f) => ![".git", ".test"].includes(path.basename(f)) });
        }
        const c: Connector = { name, dir: target, manifest: m };
        grant(ctx, c, source);
        const r = await askConnector(ctx, c, source);
        return {
          text: lines(
            `connector ${name} allowed${same ? "" : `, installed in ${ctx.display(target)}`}`,
            r.missing.length ? `hosts not allowed: ${r.missing.join(", ")} — it cannot reach them (strom allow connector ${name})` : `hosts allowed: ${r.hosts.join(", ")}`,
            m.can.includes("find") ? `find books: strom fetch ${name} --find "<place>" --years <from-to>` : undefined,
          ),
          data: { allowed: true, name, dir: target, hosts: r.hosts, missing: r.missing },
        };
      } finally {
        if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
      }
    },
  },
  {
    path: ["connector", "remove"],
    summary: "Remove a connector (you, in a terminal): its folder is deleted and its consent goes",
    group: "sources",
    args: [{ name: "connector", description: "its name", required: true }],
    examples: ["strom connector remove example-archive"],
    person: "Removing a plugin is the user's own, in their terminal",
    run: async (ctx, { args }) => {
      const name = args[0]!;
      ctx.requireHuman(`Remove connector ${name}?`, `strom connector remove ${name}`, "connector", undefined, { window: false });
      const dir = path.join(connectorsDir(shared(ctx)), name);
      if (!NAME_RE.test(name) || !fs.existsSync(dir)) throw new UsageError(`no connector "${name}"`, { hint: "strom connector list" });
      if (!(await ctx.confirm(`Remove connector ${name} (deletes ${ctx.display(dir)})?`, false))) return { text: "nothing changed" };
      const all = loadConsents(ctx.env);
      delete all.connectors[name];
      saveConsents(ctx.env, all);
      const forgot = removeLogin(ctx.env, name);
      const hosts = (() => {
        try {
          return readManifest(dir, ctx.env).hosts;
        } catch {
          return [];
        }
      })();
      const since = madeAt(dir);
      fs.rmSync(dir, { recursive: true, force: true });
      forgetItsArchives(ctx, name, hosts, since);
      return { text: `connector ${name} removed${forgot ? ", and your login for it forgotten" : ""} — hosts you allowed stay allowed (strom consents)`, data: { removed: name } };
    },
  },
  {
    path: ["connector", "discard"],
    summary: "Take away a connector started in this session that can neither fetch nor find anything (what it learned: a lesson first)",
    group: "sources",
    tree: true,
    description:
      "Only one strom connector new started in the session at work, in this research: a connector that can neither\n" +
      "fetch nor find anything does not stay in the plugins folder. What the portal does (a token on its files, a\n" +
      "login, a viewer that gives nothing) goes into a lesson on its archive first: strom lesson add \"…\" --on R….\n" +
      "One that finds books stays, said as what it is (\"can\": [\"find\", \"list\"]). Any other connector is the user's\n" +
      "to remove, in their terminal: strom connector remove — so is one another session or another research used\n" +
      "meanwhile, and a folder of that name that is not the one the session made.",
    args: [{ name: "connector", description: "its name", required: true }],
    examples: ["strom connector discard example-archive"],
    run(ctx, { args }) {
      const name = args[0]!;
      const tree = ctx.tree();
      const users = { hint: `the user, in their terminal: strom connector remove ${name}` };
      // a name is a folder's name and nothing more: no path (/, \, ..), nothing empty or hidden
      if (!NAME_RE.test(name)) throw new UsageError(`"${name}" is not a connector's name: lowercase letters, digits and dashes`, { hint: "strom connector list" });
      const connectors = connectorsDir(shared(ctx));
      if (!fs.existsSync(path.join(connectors, name)) && !folderId(path.join(connectors, name))) throw new UsageError(`no connector "${name}"`, { hint: "strom connector list" });
      const marker = madeMarker(tree.root, name);
      let made: Partial<MadeConnector> | undefined;
      try {
        made = JSON.parse(fs.readFileSync(marker, "utf8"));
      } catch {}
      // the session open now, of this research, made it — not one before, not a session of another research
      const session = currentSession(tree, ctx.env);
      if (!session || made?.session !== session.id || made.tree !== tree.config.id || (made.research ?? undefined) !== (session.research ?? undefined) || !made.folder || !made.at)
        throw new UsageError(`${name} was not started in the session at work — taking it away is the user's`, users);
      // the very folder it made: in the plugins folder itself (no symbolic link out of it), not one put there since
      const dir = ownFolder(connectors, name, made as MadeConnector);
      if (!dir) throw new UsageError(`the folder of ${name} is not the one this session made — taking it away is the user's`, users);
      // used meanwhile by anyone else, here or in another research: no longer the session's to take away
      const used = usedElsewhere(ctx, tree, name, made as MadeConnector);
      if (used.length) throw new UsageError(`${name} was used meanwhile by ${used.slice(0, 3).join("; ")}${used.length > 3 ? ` and ${used.length - 3} more` : ""} — taking it away is the user's`, users);
      // a login is the user's own: they take it away with the connector
      if (loadLogins(ctx.env)[name]) throw new UsageError(`the user saved a login for ${name} — taking it away is theirs`, { hint: `the user, in their terminal: strom connector remove ${name}` });
      const all = loadConsents(ctx.env);
      if (all.connectors[name]) {
        delete all.connectors[name];
        saveConsents(ctx.env, all);
      }
      const hosts = (() => {
        try {
          return readManifest(dir, ctx.env).hosts;
        } catch {
          return [];
        }
      })();
      fs.rmSync(dir, { recursive: true, force: true });
      fs.rmSync(marker, { force: true });
      // what only it brought into the person's archives goes with it (a person's decision stays)
      forgetItsArchives(ctx, name, hosts, made.at);
      return {
        text: lines(
          `connector ${name} taken away (${ctx.display(dir)})`,
          `what its portal does belongs in a lesson on its archive, for the next session: strom lesson add "…" --on R…`,
        ),
        data: { discarded: name },
      };
    },
  },
  {
    path: ["connector", "test"],
    summary: "Try a connector with a few requests (at most 10): what it finds, lists or fetches — files into its .test folder",
    group: "sources",
    args: [{ name: "connector", description: "its name", required: true }],
    options: [
      { name: "find", type: "string", value: "<place>", description: "find the books of a place" },
      { name: "years", type: "string", value: "<from-to>", description: "with --find" },
      { name: "list", type: "string", value: "<book>", description: "describe one book" },
      { name: "fetch", type: "string", value: "<book>", description: "fetch images of a book (with --images)" },
      { name: "locate", type: "string", value: "<book>", description: "where images of a book are, for the browser (with --images)" },
      { name: "images", type: "string", value: "<from-to>", description: "which images (default 1)" },
      { name: "crop", type: "string", value: "<x,y,w,h>", description: "with --fetch: a part of one image, in fractions of it" },
      { name: "half", type: "string", value: "<side>", description: "with --fetch: a half of one image (left, right, top, bottom)" },
      { name: "max", type: "string", value: "<n>", description: "requests at most (default 10)" },
    ],
    examples: [
      'strom connector test example-archive --find "Týnec" --years 1780-1850',
      "strom connector test example-archive --fetch 5359 --images 1-2",
      "strom connector test example-archive --fetch 5359 --images 2 --crop 0.5,0,0.5,0.5",
    ],
    run: async (ctx, { args, opts }) => {
      checkEnvironment(ctx);
      const c = findConnector(ctx.settings.shared()?.value, args[0]!);
      const request = requestOf(opts, true);
      const max = opts.max === undefined ? 10 : Number(opts.max);
      if (!Number.isInteger(max) || max < 1 || max > 50) throw new UsageError("--max: 1 to 50");
      return testWith(ctx, c, request, max);
    },
  },
  {
    path: ["connector", "probe"],
    summary: "One request through strom while you build a connector: the answer saved in its .test/probe folder, to read",
    group: "sources",
    description:
      "For mapping a portal whose pages are built by JavaScript: fetch its page, then the script it loads, and\n" +
      "look in them for the addresses its search and viewer use. Paced by strom and only to the connector's hosts,\n" +
      "like the connector itself. Each probe is one request: keep them few. Probes keep the cookies servers set,\n" +
      "like one visit in a browser (a session, the result of a form); --fresh starts without them.",
    args: [
      { name: "connector", description: "its name", required: true },
      { name: "url", description: "on one of its hosts", required: true },
    ],
    options: [
      { name: "save", type: "string", value: "<file>", description: "file name in .test/probe (default: from the URL)" },
      { name: "method", type: "string", value: "<GET|POST|HEAD>", description: "default GET" },
      { name: "body", type: "string", value: "<text>", description: "the body of a POST" },
      { name: "header", type: "string", multiple: true, value: "<Name: value>", description: "a request header (repeatable)" },
      { name: "fresh", type: "boolean", description: "start without the cookies of earlier probes (a new session)" },
    ],
    examples: [
      "strom connector probe example-archive https://archive.example.org/",
      'strom connector probe example-archive https://archive.example.org/api/search --method POST --body "{\\"q\\":\\"Týnec\\"}" --header "Content-Type: application/json"',
    ],
    run: async (ctx, { args, opts }) => {
      const c = findConnector(ctx.settings.shared()?.value, args[0]!);
      const url = args[1]!;
      const method = String(opts.method ?? "GET").toUpperCase();
      if (!["GET", "POST", "HEAD"].includes(method)) throw new UsageError("--method: GET, POST or HEAD");
      const headers: Record<string, string> = {};
      for (const h of (opts.header as string[] | undefined) ?? []) {
        const i = h.indexOf(":");
        if (i <= 0) throw new UsageError(`--header "Name: value", not "${h}"`);
        headers[h.slice(0, i).trim()] = h.slice(i + 1).trim();
      }
      checkEnvironment(ctx);
      // what the archive's terms let a probe ask: nothing where they forbid automation — but its robots.txt and the
      // terms' page the person saw (S2); an image an answer may be is not kept where the images are not tools'
      const target = URL.canParse(url) ? new URL(url) : undefined;
      const level = target ? levelsOf(ctx, c).find((a) => a.host === keyHost(c, target.hostname)) : undefined;
      const termsPage = level?.level === "forbidden" && target && (target.pathname === "/robots.txt" && !target.search ? "robots" : seenTerms(ctx, c, level.host) === target.toString() ? "terms" : undefined);
      if (level?.level === "forbidden" && !termsPage)
        throw new UsageError(`${level.title ?? level.host} allows no automated access at all — ${levelText(level)}: a probe asks only its /robots.txt and the page of its terms the user saw`, {
          hint: "the user saves what the research needs by hand: strom task wait T… --on \"<what to save, impersonal, in the research language>\"",
          code: "archive.forbidden",
        });
      const keepImages = !level || allows(level, "images", routeOf(ctx.env, c).via).ok;
      if (!(await ensureAllowed(ctx, c))) return { text: "not allowed — nothing was sent", exitCode: 1 };
      const dir = path.join(c.dir, ".test", "probe");
      if (c.manifest.browser?.pages) {
        await gateArchive(ctx, c, { activity: "catalogue" });
        // the portal answers a real browser only: the probe is a page of the user's browser too
        const want: PageRequest = { method: method as PageRequest["method"], url, headers, ...(opts.body !== undefined ? { body: String(opts.body) } : {}) };
        const u = URL.canParse(url) ? new URL(url) : undefined;
        if (!u || !hostAllowed(u.hostname, c.manifest.hosts)) throw new UsageError(`${u?.hostname ?? url} is not one of its hosts (${c.manifest.hosts.join(", ")})`);
        const save = opts.save === undefined ? undefined : String(opts.save);
        const got = loadPage(ctx.tree().root, c.name, pageKey(want));
        if (got) return probeResult(ctx, c, method, url, got, save);
        return planPages(ctx, c, want, { cmd: "probe", ...(save ? { save } : {}) }, `probe ${url}`);
      }
      const jarFile = path.join(dir, ".cookies.json");
      let kept: unknown = [];
      try {
        if (!opts.fresh) kept = JSON.parse(fs.readFileSync(jarFile, "utf8"));
      } catch {}
      const cookies = CookieJar.from(kept);
      const meter = new FetchMeter();
      let res: Awaited<ReturnType<typeof politeRequest>>;
      try {
        res = await politeRequest(url, {
          stateDir: netDir(ctx),
          hosts: c.manifest.hosts,
          pace: c.manifest.policy.pace ?? {},
          method: method as "GET" | "POST" | "HEAD",
          headers,
          ...(opts.body !== undefined ? { body: String(opts.body) } : {}),
          cookies,
          robots: true,
          login: !!c.manifest.login,
          ...metered(meter),
          ...netWords(ctx, c, level ? [level] : []),
        });
      } catch (err) {
        // a refusal: what happened, and what to do next — as after strom fetch
        const refusal = err instanceof NetError && ((err.failure === "refused" && (err.status === 401 || err.status === 403)) || (err.failure === "blocked" && !!err.refusedKind) || err.failure === "robots");
        if (!(err instanceof NetError) || !refusal) {
          measure(ctx, c, meter, { via: "direct", cmd: "probe", requests: meter.requests() });
          throw err;
        }
        const f: NonNullable<RunReport["refused"]> = { host: err.host, ...(URL.canParse(url) && new URL(url).hostname === err.host ? { origin: new URL(url).origin } : {}), ...(err.refusedKind ? { kind: err.refusedKind } : {}), ...(err.status !== undefined ? { status: err.status } : {}), ...(err.until !== undefined ? { until: err.until } : {}), ...(err.robots ? { robots: err.robots } : {}), now: err.failure === "refused" };
        refusalSaid(ctx, c, f);
        measure(ctx, c, meter, { via: "direct", cmd: "probe", requests: meter.requests(), ...(f.status !== undefined ? { status: f.status } : {}), refused: f.robots ? "robots" : f.kind, result: "stopped" });
        return { text: lines(`${method} ${url} · stopped: ${err.message}`, refusalAdvice(ctx, c, f)), data: { refused: f }, exitCode: 1 };
      }
      measure(ctx, c, meter, { via: "direct", cmd: "probe", requests: meter.requests() });
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(jarFile, JSON.stringify(cookies.entries(), null, 2) + "\n");
      // an image where the archive gives none to tools (its terms, or no permission yet): not kept; a terms page: as a page only
      const image = /^image\//i.test(res.contentType) || (res.body.length >= 64 && imageMagic(res.body));
      if ((image && !keepImages) || (termsPage === "terms" && !/^text\/html/i.test(res.contentType)))
        return {
          text: lines(`${method} ${url} → ${res.status} · ${res.contentType || "no type"} · ${res.body.length} B`, `not kept: ${image ? `an image, and ${level?.title ?? level?.host} gives no images to tools now (${level ? levelText(level) : ""}${level?.permission ? `, permission ${level.permission}` : ""})` : "the terms' page is read as a page only"}`),
          data: { status: res.status, type: res.contentType, url: res.url, bytes: res.body.length, kept: false },
        };
      return probeResult(ctx, c, method, url, res, opts.save === undefined ? undefined : String(opts.save), [...new Set(cookies.entries().map((k) => k.name))]);
    },
  },
  {
    path: ["connector", "grep"],
    summary: "Search what its probes and tests saved (addresses, form fields, scripts): each hit with the text round it",
    group: "sources",
    description:
      "The pages and scripts of a portal are often too big to read whole, and many are one long line. This finds\n" +
      "a text (in any case), or a regular expression with --regex, in the files of the connector's .test folder\n" +
      "and shows each hit with a little text round it and where it is (file:line:column). Nothing is requested.\n" +
      "It finds a text as it reads: &aacute; or &#225; of a page and \\u00e1 of a script are á, &nbsp; is a space.\n" +
      "The text round a hit is shown as the file has it, which is what a connector reads.",
    args: [
      { name: "connector", description: "its name", required: true },
      { name: "pattern", description: "the text to find: in any case, as it reads (&aacute; is á), a space for any white space", required: true },
    ],
    options: [
      { name: "regex", type: "boolean", description: "the pattern is a regular expression (JavaScript, in any case) — a backtick in it written as . (any character): a command with one is refused" },
      { name: "in", type: "string", value: "<file>", description: "only this file (its name in .test/probe, or its path in .test)" },
      { name: "around", type: "string", value: "<n>", description: "characters shown before and after a hit (default 80)" },
    ],
    examples: [
      'strom connector grep example-archive "/api/"',
      'strom connector grep example-archive "\\.jpe?g" --regex --in viewer.html',
    ],
    run: (ctx, { args, opts }) => {
      const c = findConnector(ctx.settings.shared()?.value, args[0]!);
      const pattern = args[1]!;
      const around = opts.around === undefined ? 80 : Number(opts.around);
      if (!Number.isInteger(around) || around < 0 || around > 2000) throw new UsageError("--around: a number of characters, 0–2000");
      const re = grepPattern(pattern, !!opts.regex);
      const base = path.join(c.dir, ".test");
      let files = textFiles(base);
      if (opts.in !== undefined) {
        const want = String(opts.in);
        files = files.filter((f) => [path.relative(base, f), path.relative(path.join(base, "probe"), f)].some((r) => r.split(path.sep).join("/") === want.split(path.sep).join("/")));
        if (!files.length) throw new UsageError(`no saved file ${want} in ${ctx.display(base)}`, { hint: `strom connector grep ${c.name} ${shellArg(pattern)}${opts.regex ? " --regex" : ""} — to search them all` });
      }
      if (!files.length) return { text: `nothing saved yet — strom connector probe ${c.name} <url> saves an answer to search`, data: { total: 0, hits: [] } };
      // hits close together (a long list of names) are shown once, in one stretch of text
      const hits: { file: string; line: number; column: number; hits: number; text: string }[] = [];
      let total = 0;
      for (const f of files) {
        const text = fs.readFileSync(f, "utf8");
        // found as the file has it, and as it reads (&aacute; or \u00e1 written out): each hit once
        const found = new Map<number, number>();
        for (const m of text.matchAll(re)) {
          if (found.size >= 5000) break;
          if (m[0]) found.set(m.index, m.index + m[0].length);
        }
        const read = readable(text);
        for (const m of read ? read.text.matchAll(re) : []) {
          if (found.size >= 5000) break;
          const at = read!.at[m.index]!;
          if (m[0] && !found.has(at)) found.set(at, read!.at[m.index + m[0].length]!);
        }
        let open: { from: number; to: number; at: number; n: number } | undefined;
        const close = () => {
          if (!open) return;
          const lineStart = text.lastIndexOf("\n", open.at - 1) + 1;
          hits.push({
            file: path.relative(base, f).split(path.sep).join("/"),
            line: text.slice(0, open.at).split("\n").length,
            column: open.at - lineStart + 1,
            hits: open.n,
            text: (open.from > 0 ? "…" : "") + text.slice(open.from, open.to).replace(/\s+/g, " ") + (open.to < text.length ? "…" : ""),
          });
          open = undefined;
        };
        for (const [at, end] of [...found].sort((x, y) => x[0] - y[0])) {
          total++;
          const from = Math.max(0, at - around);
          const to = Math.min(text.length, end + around);
          if (open && from <= open.to && to - open.from <= Math.max(600, 4 * around)) {
            open.to = to;
            open.n++;
          } else {
            close();
            open = { from, to, at, n: 1 };
          }
          if (total >= 5000) break;
        }
        close();
        if (total >= 5000) break;
      }
      const page = paginate(hits, ctx.limit, ctx.page);
      const inFiles = new Set(hits.map((h) => h.file)).size;
      return {
        text: hits.length
          ? lines(
              `${total}${total >= 5000 ? "+" : ""} ${total === 1 ? "hit" : "hits"} in ${counted(inFiles, "file")} of ${ctx.display(base)}:`,
              ...page.items.map((h) => `${h.file}:${h.line}:${h.column}  ${h.hits > 1 ? `(${h.hits} hits) ` : ""}${h.text}`),
              moreLine(page, `strom connector grep ${c.name} ${shellArg(pattern)}${opts.regex ? " --regex" : ""}${opts.in !== undefined ? ` --in ${shellArg(String(opts.in))}` : ""}`) || undefined,
            )
          : `not found in ${counted(files.length, "saved file")} of ${ctx.display(base)}`,
        data: { total, hits: page.items },
      };
    },
  },
  {
    path: ["fetch"],
    summary: "Download through a connector: images of a book (registered with their provenance), or find books of a place",
    group: "sources",
    tree: true,
    writes: true,
    lock: "sections",
    description:
      "Every request goes through strom's limiter: one at a time, paced, capped per hour; a refusal (401/403)\n" +
      "stops the run and leaves the archive alone for a day. An archive's hourly cap used up: strom waits for it by\n" +
      "itself (up to 30 min, never into a session's last 10) and says until when — no need to sleep and ask again;\n" +
      "longer, it ends with exit 7 and the time to try again. An archive that went silent (or asked twice to slow\n" +
      "down) is left alone for an hour (longer when it goes silent again): a fetch then ends at once with exit 7\n" +
      "and the time — other work meanwhile, or close the session with --continue; a fetch with --background waits\n" +
      "for it by itself when it frees within 30 min. A session is told so once: a fetch of it asking that archive\n" +
      "again before then ends at once with exit 8 (nothing estimated, nothing sent).\n" +
      "With --recordset the images are registered as they come, 10 at a time (strom read of the book may begin\n" +
      "meanwhile); Ctrl-C keeps what came, the same command fetches the rest;\n" +
      "without it they go into the inbox, a folder for the book.\n" +
      "It says first how many requests it asks of the archive and how long they take at the host's pace and hourly\n" +
      "cap: fetch whole images first (a request each) and a part only of an image whose entry needs it. From 80 %\n" +
      "of a host's hourly cap used it says after each fetch what is left of the hour and when the next frees.\n" +
      "--crop or --half fetches a part of one image, as sharp as the portal gives it (a connector that can: part),\n" +
      "registered with the image; a view of the image then shows that place from it by itself. Without the book,\n" +
      "--recordset tells it: the book the connector fetched its images from before, or what its link says (a link\n" +
      "alike another book's of the research); not known, strom says the command with the book to fill in.\n" +
      "A part held here already — the same part, or a part or the whole image it lies in, as sharp as a new part\n" +
      "could come — asks nothing: strom names it and the view to read the place in.\n" +
      "A connector set to fetch through your browser (strom connector use <c> --via browser) gives a plan instead:\n" +
      "the page to open, a script to run there that fetches the images at the archive's pace into the browser's\n" +
      "downloads folder, and --take, which takes them over from there, checked and registered.\n" +
      "A connector whose portal answers a real browser only (browser.pages: a bot check) has every page read\n" +
      "there too: each run plans the page it needs next, --take gives it to the connector and goes on.\n" +
      "--background (with --recordset, in a session) fetches by a strom of its own while you work on — the images\n" +
      "this session reads (never for a later one): strom read of the book reads them as they come. It belongs to\n" +
      "your session and the task it is for (--task T…; without it the one task this session worked on that names\n" +
      "the book, else the session's): it stops when the session is asked to finish or closes (in strom run: when\n" +
      "the run ends), at strom fetch --stop, and never waits into a session's last minutes. A fetch in the\n" +
      "foreground from the same archive goes first. Images another strom is fetching already are not fetched\n" +
      "twice: a fetch in the foreground waits for them.\n" +
      "An archive whose terms restrict automated access (images at a person's pace) is never fetched in the\n" +
      "background. strom fetch --status says what is being fetched and what ended lately.",
    args: [
      { name: "connector", description: "its name (with --status or --stop: the record sets, none = all)", required: true, unless: ["status", "stop"] },
      { name: "book", description: "the book, as the connector knows it (its ID on the portal); with --recordset it may be left out: the book its images came from through this connector, or its link tells" },
    ],
    options: [
      { name: "images", type: "string", value: "<n|from-to|list>", description: "which images of the book: n, from-to or a list (20,50,80)" },
      { name: "recordset", type: "string", value: "<B…>", description: "register them as images of this record set" },
      { name: "crop", type: "string", value: "<x,y,w,h>", description: "a part of one image: fractions of it (0.5,0.2,0.5,0.3), or pixels of the registered image" },
      { name: "half", type: "string", value: "<side>", description: "a half of one image: left, right, top or bottom (with --crop: within it)" },
      { name: "find", type: "string", value: "<place>", description: "find the books that cover a place" },
      { name: "years", type: "string", value: "<from-to>", description: "with --find" },
      { name: "list", type: "boolean", description: "describe the book (title, images)" },
      { name: "take", type: "boolean", description: "through the browser: take over what it downloaded (checked, registered)" },
      { name: "result", type: "string", value: "<line>", description: "with --take: the line the browser script returned (strom-result …)" },
      { name: "again", type: "string", value: "<reason>", description: "fetch although a book of the research is this book (the same link, or its images came from it): why — into --recordset, another book (kept on it); without it, into the inbox" },
      { name: "no-index", type: "boolean", description: "fetch the images although an index of the book's parish and years is known (read already, or of no use here) — a session of strom run needs it from as many images on as strom read --no-index says" },
      { name: "background", type: "boolean", description: "fetch by a strom of its own while you work on (with --recordset, in a session): strom read of the book reads the images as they come" },
      { name: "task", type: "string", value: "<T…>", description: "the task the images are for (its fetches and their measure say it; default: the one task this session worked on that names the record set, else the session's task)" },
      { name: "status", type: "boolean", description: "what is being fetched now (each book: images registered of those asked, whose, since when) and what ended lately" },
      { name: "stop", type: "boolean", description: "stop the fetches in the background (of these record sets; none named: all of this research) — what came stays registered" },
    ],
    examples: [
      'strom fetch example-archive --find "Týnec" --years 1780-1850',
      "strom fetch example-archive 5359 --images 40-69 --recordset B0001",
      "strom fetch example-archive 5359 --images 70-140 --recordset B0001 --background",
      "strom fetch example-archive 5359 --images 141-180 --recordset B0001 --background --task T0002",
      "strom fetch --status",
      "strom fetch example-archive 5359 --recordset B0001 --images 2 --crop 0.5,0.4,0.5,0.3",
      'strom fetch example-archive --take --result "strom-result 40:200:1843221 41:200:1790234"',
    ],
    run: async (ctx, { args, opts }) => {
      if (opts.status) return fetchStatus(ctx, args);
      if (opts.stop) return fetchStop(ctx, args);
      checkEnvironment(ctx);
      const tree = ctx.tree();
      const c = findConnector(ctx.settings.shared()?.value, need(args[0], "the connector"));
      if (opts.take) return takeOver(ctx, c, opts.result === undefined ? undefined : String(opts.result));
      // Through the browser, an agent needs browser tools — only a tree that works with this archive gives them.
      if (isAgent(ctx.env) && routeOf(ctx.env, c).via === "browser" && !treeBrowserConnectors(tree, ctx.settings.shared()?.value).some((x) => x.name === c.name)) {
        const site = c.manifest.hosts[0]!;
        throw new StromError(`this family tree does not work with ${c.manifest.title} yet, so you have no browser tools for ${site}`, {
          hint: `record the archive: strom repo add "${c.manifest.title}" --url https://${site} — the browser tools come with the next conversation or run (tell the user)`,
        });
      }
      const perHour = Math.min(1000, connectorPace(ctx, c).perHour);
      const wantsPart = opts.crop !== undefined || opts.half !== undefined;
      if (wantsPart && !c.manifest.can.includes("part"))
        throw new UsageError(`connector ${c.name} fetches whole images only (it cannot: part)`, {
          hint: 'the user saves the part by hand: zoomed in on it in the portal\'s viewer — strom task wait T… --images B…:<n> --on "<the book, its link, the image, the entry to zoom in on; saved as 40a.jpg>"',
        });
      const request: ConnectorRequest = opts.find
        ? requestOf(opts, false)
        : opts.list
          ? { cmd: "list", book: bookOfFetch(ctx, c, args[1], opts) }
          : wantsPart
            ? partRequest(ctx, c, args[1], opts)
            : { cmd: "fetch", book: bookOfFetch(ctx, c, args[1], opts), images: parseImages(opts.images, perHour) ?? needImages() };
      const recordset = opts.recordset ? requireRecord<RecordSet>(tree, String(opts.recordset), "recordset").id : undefined;
      const again = typeof opts.again === "string" ? opts.again.trim() || undefined : undefined;
      const task = opts.task === undefined ? undefined : requireRecord<Task>(tree, String(opts.task), "task").id;
      if (task && (request.cmd === "find" || request.cmd === "list")) throw new UsageError("--task names whose images are fetched: with --images (and --recordset)");
      if (request.cmd === "fetch") sameBookFirst(ctx, c, request, recordset, again);
      if (opts.background) {
        if (request.cmd !== "fetch" || !recordset)
          throw new UsageError("--background fetches images of a book into a record set: --images and --recordset", { hint: `strom fetch ${c.name} <book> --images <from-to> --recordset B… --background` });
        if (routeOf(ctx.env, c).via === "browser") throw new UsageError(`connector ${c.name} fetches through your browser: no fetch in the background — the plan of strom fetch without --background`);
      }
      // a session told already that a host of the archive is left alone: refused at once (no estimate, nothing sent)
      const session = backgroundOf(ctx.env) ? undefined : currentSession(tree, ctx.env);
      const direct = !((request.cmd === "fetch" || request.cmd === "part") && routeOf(ctx.env, c).via === "browser");
      if (direct && !tree.dryRun) refuseAskedAgain(ctx, c, session, !!opts.background);
      const res = await fetchWith(ctx, c, request, recordset, Boolean(opts["no-index"]), false, opts.background ? { again } : undefined, task);
      if (!tree.dryRun) noteAskedOnce(ctx, session, res);
      return res;
    },
  },
  {
    path: ["allow", "connector"],
    summary: "Allow a connector to run (you, in a terminal, after reading what it is and what it contacts) — or take it back",
    group: "setup",
    description:
      "Allows its folder and automated access to each of its hosts. While its code reaches the network only\n" +
      "through strom, your agent may go on improving it; code that goes round strom needs a yes after every change.",
    args: [{ name: "connector", description: "its name", required: true }],
    options: [{ name: "revoke", type: "boolean", description: "take the consent back (its hosts stay allowed: strom allow host <host> --revoke)" }],
    examples: ["strom allow connector example-archive", "strom allow connector example-archive --revoke"],
    run: async (ctx, { args, opts }) => {
      const name = args[0]!;
      if (!opts.revoke && !consentRequired(ctx.env)) {
        const c = findConnector(shared(ctx), name);
        if (!lockedCode(c))
          return {
            text: `consents are off: connector ${name} runs without asking — paced by strom, only to ${c.manifest.hosts.join(", ")}\nto be asked first: strom config set connectors.consent on`,
            data: { name, allowed: true, consents: "off" },
          };
      }
      const how = ctx.requireHuman(
        `${opts.revoke ? "Take back" : "Allow"} connector ${name}?`,
        `strom allow connector ${name}${opts.revoke ? " --revoke" : ""}`,
        `connector:${name}`,
        opts.revoke ? ui(ctx.uiLang(), "ui.consent.connector.revoke", { name }) : consentWindow(ctx, findConnector(shared(ctx), name)),
      );
      if (opts.revoke) {
        const all = loadConsents(ctx.env);
        const had = !!all.connectors[name];
        delete all.connectors[name];
        saveConsents(ctx.env, all);
        return { text: had ? `connector ${name}: consent taken back — it does not run now` : `connector ${name} was not allowed — nothing changed`, data: { name, allowed: false } };
      }
      const c = findConnector(shared(ctx), name);
      const before = missingConsents(ctx.env, c);
      if (!before.code && !before.hosts.length) return { text: `connector ${name} is allowed already, with its hosts ${c.manifest.hosts.map(bareHost).join(", ")}`, data: { name, allowed: true } };
      const r = await askConnector(ctx, c, ctx.display(c.dir), how === "window");
      if (!r.allowed) return { text: "not allowed — nothing changed", data: { name, allowed: false } };
      return {
        text: lines(`connector ${name} allowed`, r.missing.length ? `hosts not allowed: ${r.missing.join(", ")} — it cannot reach them` : `hosts allowed: ${r.hosts.join(", ")}`),
        data: { name, allowed: true, hosts: r.hosts, missing: r.missing },
      };
    },
  },
  {
    path: ["allow", "host"],
    summary: "Allow automated access to an archive's host (you, in a terminal, after the warning) — or take it back",
    group: "setup",
    args: [{ name: "host", description: "e.g. digi.example.org", required: true }],
    options: [
      { name: "revoke", type: "boolean", description: "take the consent back" },
      { name: "unblock", type: "boolean", description: "lift a refusal (401/403), or a limit the host said is used up, early — only after the archive said it is fine" },
      { name: "pace", type: "string", value: "<seconds|auto>", description: `your own pause between two requests to the host (at least ${MIN_INTERVAL_MS / 1000} s); auto: the service's again` },
      { name: "per-hour", type: "string", value: "<n|none|auto>", description: "your own hourly cap for the host; none: no cap; auto: the service's again (strom sets none by itself)" },
    ],
    examples: ["strom allow host archive.example.org", "strom allow host archive.example.org --pace 1 --per-hour none", "strom allow host archive.example.org --pace auto --per-hour auto", "strom allow host archive.example.org --revoke"],
    run: async (ctx, { args, opts }) => {
      const host = args[0]!.toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
      const lang = ctx.uiLang();
      // The user's own pace for the host: theirs to set — asked in a window when an agent runs it.
      if (opts.pace !== undefined || opts["per-hour"] !== undefined) {
        const was = hostState(netDir(ctx), host).own;
        const own = { ...(was?.minIntervalMs !== undefined ? { minIntervalMs: was.minIntervalMs } : {}), ...(was?.perHour !== undefined ? { perHour: was.perHour } : {}) } as { minIntervalMs?: number; perHour?: number };
        if (opts.pace !== undefined) {
          const v = String(opts.pace).trim();
          if (v === "auto") delete own.minIntervalMs;
          else if (Number(v) * 1000 >= MIN_INTERVAL_MS) own.minIntervalMs = Math.round(Number(v) * 1000);
          else throw new UsageError(`--pace must be seconds, at least ${MIN_INTERVAL_MS / 1000}, or auto — not "${v}"`);
        }
        if (opts["per-hour"] !== undefined) {
          const v = String(opts["per-hour"]).trim();
          if (v === "auto") delete own.perHour;
          else if (v === "none") own.perHour = 0;
          else if (Number.isInteger(Number(v)) && Number(v) > 0) own.perHour = Number(v);
          else throw new UsageError(`--per-hour must be a number, none or auto — not "${v}"`);
        }
        const c = listConnectors(ctx.settings.shared()?.value).find((x) => x.manifest.hosts.some((h) => hostAllowed(host, [h])));
        const next = hostPace({ recent: [], own: { ...own, at: "" } }, c?.manifest.policy.pace);
        const yes = await ctx.requireHumanYes(`Set the pace of ${host}: ${paceText(next)}?`, `strom allow host ${host}${opts.pace !== undefined ? ` --pace ${opts.pace}` : ""}${opts["per-hour"] !== undefined ? ` --per-hour ${opts["per-hour"]}` : ""}`, `pace:${host}`, ui(lang, "ui.consent.host.pace", { host, seconds: secondsIn(lang, next.minIntervalMs), cap: Number.isFinite(next.perHour) ? ui(lang, "ui.pace.cap", { n: next.perHour }) : ui(lang, "ui.pace.nocap") }));
        if (!yes) return { text: ui(lang, "ui.host.pace.kept", { host }), data: { host, changed: false }, exitCode: 1 };
        const s = setOwnPace(netDir(ctx), host, own);
        const now = paceAt(ctx, host, c);
        // what the person reads, in the research language (as strom allow archive says its decision)
        const words = ui(lang, "ui.pace.text", { seconds: secondsIn(lang, now.minIntervalMs), cap: Number.isFinite(now.perHour) ? ui(lang, "ui.pace.cap", { n: now.perHour }) : ui(lang, "ui.pace.nocap") });
        return { text: ui(lang, s.own ? "ui.host.pace.own" : "ui.host.pace.service", { host, pace: words }), data: { host, pace: { minIntervalMs: now.minIntervalMs, perHour: Number.isFinite(now.perHour) ? now.perHour : null }, own: s.own ?? null } };
      }
      const how = ctx.requireHuman(
        `${opts.revoke ? "Take back" : opts.unblock ? "Lift the refusal or the used-up limit of" : "Allow"} automated access to ${host}?`,
        `strom allow host ${host}${opts.revoke ? " --revoke" : opts.unblock ? " --unblock" : ""}`,
        `host:${host}`,
        ui(lang, opts.revoke ? "ui.consent.host.revoke" : opts.unblock ? "ui.consent.host.unblock" : "ui.consent.host", { host }),
      );
      const all = loadConsents(ctx.env);
      if (opts.revoke) {
        delete all.hosts[host];
        saveConsents(ctx.env, all);
        return { text: ui(lang, "ui.host.revoked", { host }), data: { host, allowed: false } };
      }
      if (opts.unblock) {
        // the person's question and answer, in their language (a refusal, or a limit the host said is used up)
        if (how === "terminal" && !(await ctx.humanYes(ui(lang, "ui.consent.host.unblock", { host })))) return { text: ui(lang, "ui.host.unblock.kept", { host }) };
        clearBlock(netDir(ctx), host);
        // a refusal of strom's client kept in the person's settings too: lifted with it
        liftRefusal(ctx.env, host);
        return { text: ui(lang, "ui.host.unblocked", { host }), data: { host, unblocked: true } };
      }
      const c = listConnectors(ctx.settings.shared()?.value).find((x) => x.manifest.hosts.some((h) => hostAllowed(host, [h])));
      const ok = await askHost(ctx, host, c, how === "window");
      return { text: ui(lang, ok ? "ui.host.allowed" : "ui.host.notallowed", { host }), data: { host, allowed: ok } };
    },
  },
  {
    path: ["consents"],
    summary: "Consents (on or off, what you allowed) and archive hosts: how each is doing (paced, capped, refused)",
    group: "setup",
    run(ctx) {
      const all = loadConsents(ctx.env);
      const hosts = [...new Set([...Object.keys(all.hosts), ...knownHosts(netDir(ctx))])].sort();
      const names = Object.keys(all.connectors).sort();
      const archives = archivesOverview(ctx);
      const pending = pendingQuestions(ctx.env);
      // what the person reads, in the research language (as Settings → Archives says it); --json stays as it was
      const lang = ctx.uiLang();
      const t = (key: UIKey, values: Record<string, string | number> = {}) => ui(lang, key, values);
      const level = (l: string | undefined) => (l && `ui.consents.level.${l}` in UI ? t(`ui.consents.level.${l}` as UIKey) : (l ?? ""));
      const none = `  ${t("ui.consents.none")}`;
      return {
        text: lines(
          t(consentRequired(ctx.env) ? "ui.consents.on" : "ui.consents.off"),
          t("ui.consents.connectors"),
          ...names.map((n) => `  ${t("ui.consents.connector", { name: n, dir: ctx.display(all.connectors[n]!.dir), date: consentDay(lang, all.connectors[n]!.at), hosts: all.connectors[n]!.hosts.join(", ") })}`),
          names.length ? undefined : none,
          t("ui.consents.hosts"),
          ...hosts.map((h) => `  ${hostLine(ctx, h, lang)}${all.hosts[h] ? ` · ${t("ui.consents.host.since", { date: consentDay(lang, all.hosts[h].at) })}` : ""}`),
          hosts.length ? undefined : none,
          t("ui.consents.archives"),
          ...archives.map((a) =>
            [
              `  ${a.host}  ${a.connector}  ${level(a.level)}`,
              a.refused ? t("ui.consents.archive.refused", { host: a.refused }) : undefined,
              a.browserOnly ? t(a.robots ? "ui.consents.archive.browser.robots" : "ui.consents.archive.browser") : undefined,
              a.way ? t("ui.consents.archive.way", { way: t(`ui.consents.way.${a.way}`) }) : a.level === "restricted" || a.level === "unknown" ? t("ui.consents.archive.ask") : undefined,
              t(a.level === "allowed" || !a.way || a.way === "manual" ? "ui.consents.archive.pace.service" : "ui.consents.archive.pace.images", { pace: consentPace(lang, a.pace) }),
            ]
              .filter(Boolean)
              .join(" · "),
          ),
          archives.length ? undefined : none,
          pending.length ? t("ui.consents.pending", { items: pending.map((p) => (p.kind === "permission" ? t("ui.consents.pending.permission", { title: p.title ?? p.host ?? "" }) : p.kind === "takeover" ? t("ui.consents.pending.takeover", { names: p.connectors?.join(", ") ?? "" }) : t("ui.consents.pending.milder", { connector: p.connector ?? "", host: p.host ?? "", to: level(p.to) }))).join(" · ") }) : undefined,
          t("ui.consents.pace.about", { seconds: secondsIn(lang, DEFAULT_PACE.minIntervalMs) }),
          Object.keys(loadLogins(ctx.env)).length ? t("ui.consents.logins", { names: Object.keys(loadLogins(ctx.env)).sort().join(", ") }) : undefined,
          t("ui.consents.revoke"),
        ),
        data: { consents: consentRequired(ctx.env) ? "on" : "off", ...all, archives, pending, logins: Object.keys(loadLogins(ctx.env)).sort(), hostState: Object.fromEntries(hosts.map((h) => [h, hostState(netDir(ctx), h)])) },
      };
    },
  },
  {
    path: ["login"],
    summary: "Your login to an archive portal, for a connector that can use one (you, in a terminal) — kept on this computer only",
    group: "setup",
    description:
      "An account you have on a portal — perhaps one you paid for — lets its connector fetch what the account\n" +
      "gives. You type it in here; an agent cannot. It is kept in your config folder, readable by you alone,\n" +
      "never in a tree, the shared folder or git. strom puts it into the connector's requests itself, only to\n" +
      "the connector's hosts and only over https, and takes it out of every answer: the connector's code never\n" +
      "sees it, nor does your agent. Without a connector: the logins saved.",
    args: [{ name: "connector", description: "its name" }],
    options: [{ name: "remove", type: "boolean", description: "forget the login" }],
    examples: ["strom login example-archive", "strom login example-archive --remove", "strom login"],
    person: "A login to an archive is the user's own, in their terminal",
    run: async (ctx, { args, opts }) => {
      const saved = loadLogins(ctx.env);
      if (!args[0]) {
        const usable = listConnectors(ctx.settings.shared()?.value).filter((c) => c.manifest.login);
        const names = [...new Set([...Object.keys(saved), ...usable.map((c) => c.name)])].sort();
        return {
          text: names.length
            ? lines(
                ...names.map((n) => {
                  const c = usable.find((x) => x.name === n);
                  return `${n}  ${saved[n] ? `saved ${saved[n]!.at.slice(0, 10)} (${fieldsOf(saved[n]!.values, c).join(", ")})` : "none"}${c ? ` — ${c.manifest.login!.about}` : " — no such connector now"}`;
                }),
                "save one: strom login <connector> · forget it: strom login <connector> --remove",
              )
            : "no connector here uses a login",
          data: { logins: names.map((n) => ({ connector: n, saved: !!saved[n], at: saved[n]?.at, fields: saved[n] ? fieldsOf(saved[n]!.values, usable.find((x) => x.name === n)) : [] })) },
        };
      }
      const name = args[0];
      if (opts.remove) {
        ctx.requireHuman(`Forget your login for connector ${name}?`, `strom login ${name} --remove`, `login:${name}`, undefined, { window: false });
        return removeLogin(ctx.env, name)
          ? { text: `the login for ${name} is forgotten — deleted from this computer`, data: { connector: name, saved: false } }
          : { text: `no login saved for ${name} — nothing changed`, data: { connector: name, saved: false } };
      }
      const c = findConnector(shared(ctx), name);
      if (!c.manifest.login)
        throw new UsageError(`connector ${name} uses no login`, { hint: `a connector that can use one says so in its connector.json ("login"): ${path.join(connectorsDir(shared(ctx)), "README.md")}` });
      ctx.requireHuman(`Save your login to ${c.manifest.title} for connector ${name}?`, `strom login ${name}`, `login:${name}`, undefined, { window: false });
      if (loginOf(ctx.env, c) && !(await ctx.confirm(`A login for ${name} is saved already. Replace it?`, false))) return { text: "nothing changed", data: { connector: name, saved: true } };
      if (!(await askLogin(ctx, c))) return { text: "no login saved", data: { connector: name, saved: false }, exitCode: 1 };
      return {
        text: lines(`login for ${name} saved — strom puts it into its requests to ${c.manifest.hosts.map(bareHost).join(", ")}`, `forget it: strom login ${name} --remove`),
        data: { connector: name, saved: true },
      };
    },
  },
);

/**
 * A connector taken away: what only it brought into the person's archives goes with it (core/terms.ts forgetConnector) —
 * a host another connector here reaches, one strom's known terms name, or one whose question tasks wait on stays; so
 * does a level strom kept before the connector was made (`since`) or from another one's reading.
 */
function forgetItsArchives(ctx: Context, name: string, hosts: string[], since: string | undefined): string[] {
  const others = listConnectors(shared(ctx), ctx.env).filter((x) => x.name !== name);
  const trees: Tree[] = [];
  for (const k of ctx.knownTrees()) {
    try {
      trees.push(Tree.open(k.root, ctx.env));
    } catch {
      // a tree strom cannot open now: its tasks are not looked at
    }
  }
  if (ctx.hasTree() && !trees.some((t) => t.root === ctx.tree().root)) trees.push(ctx.tree());
  const waits = (h: string) => trees.some((t) => t.list<Task>("task").some((x) => waitsOnHost(t, x, h) === "decision"));
  return forgetConnector(ctx.env, name, [...new Set(hosts.map(bareHost))], (h) => others.some((x) => x.manifest.hosts.some((o) => hostAllowed(h, [o]))) || !!termsFor(ctx.env, h) || waits(h), since);
}

/** When a connector's folder was made (its birth, where the file system keeps one): a level strom kept before it is not its own. */
function madeAt(dir: string): string | undefined {
  try {
    const ms = fs.lstatSync(dir).birthtimeMs;
    return ms > 0 ? new Date(Math.floor(ms)).toISOString() : undefined;
  } catch {
    return undefined;
  }
}

function need(v: string | undefined, what: string): string {
  if (!v) throw new UsageError(`give ${what}`, { hint: "strom fetch <connector> <book> --images 40-69 --recordset B… · or --find <place>" });
  return v;
}

function needImages(): never {
  throw new UsageError("which images? --images 40-69", { hint: "strom fetch <connector> <book> --list tells how many there are" });
}

/**
 * The book a fetch is of: the one given, else — with --recordset — the book of that record set (core/samebook.ts
 * bookRoute: the book its images came from through this connector, or what its link tells). Not known: why, and the
 * whole command as it was given with the book in it.
 */
function bookOfFetch(ctx: Context, c: Connector, given: string | undefined, opts: Record<string, unknown>): string {
  if (given) return given;
  if (!opts.recordset) return need(given, "the book");
  const tree = ctx.tree();
  const b = requireRecord<RecordSet>(tree, String(opts.recordset), "recordset");
  const route = bookRoute(tree, b.id, c.name);
  if (route) {
    ctx.io.stderr(`  · book ${route.book} of ${c.name}: the book of ${b.id} (${route.by === "images" ? "its images came from it" : `its link ${b.url}`})\n`);
    return route.book;
  }
  // its images came through another connector: that one, with its book
  const other = bookRoute(tree, b.id);
  if (other && other.connector !== c.name)
    throw new UsageError(`the images of ${b.id} came through connector ${other.connector} (its book ${other.book}), not ${c.name}`, {
      hint: `${fetchCommand(other.connector, shellArg(other.book), b.id, opts)} · ${b.id} is another copy on ${c.name}'s portal: ${fetchCommand(c.name, "<book>", b.id, opts)}`,
    });
  const host = b.url && URL.canParse(b.url) ? new URL(b.url).hostname : undefined;
  const elsewhere = host && !hostAllowed(host, c.manifest.hosts) ? listConnectors(shared(ctx), ctx.env).find((x) => x.name !== c.name && x.manifest.hosts.some((h) => hostAllowed(host, [h]))) : undefined;
  const link = !b.url ? "it has no link" : host && !hostAllowed(host, c.manifest.hosts) ? `its link ${b.url} is not on ${c.name}'s portal (${c.manifest.hosts.join(", ")})${elsewhere ? ` — it is connector ${elsewhere.name}'s` : ""}` : `its link ${b.url} does not tell`;
  throw new UsageError(`give the book: which book of ${c.name} ${b.id} is, strom does not know — no image of ${b.id} came through ${c.name}, and ${link}`, {
    hint: `${fetchCommand(elsewhere?.name ?? c.name, "<book>", b.id, opts)} — <book> is its ID on the portal${b.url ? ` (in its link: ${b.url})` : ""}; strom fetch ${elsewhere?.name ?? c.name} --find <place> lists the books with their IDs`,
  });
}

/** strom fetch as it was given, with the connector and the book (said as it is: "<book>" stays a placeholder). */
function fetchCommand(connector: string, book: string, recordset: string, opts: Record<string, unknown>): string {
  // a list (20,50,80) or a region (0.5,0.2,0.5,0.3) is one word to a shell as it is
  const value = (name: string) => (typeof opts[name] === "string" ? ` --${name} ${/^[\p{N}.,-]+$/u.test(String(opts[name])) ? String(opts[name]) : shellArg(String(opts[name]))}` : "");
  const flag = (name: string) => (opts[name] ? ` --${name}` : "");
  return `strom fetch ${connector} ${book}${flag("list")}${value("images")} --recordset ${recordset}${value("crop")}${value("half")}${flag("background")}${value("task")}${flag("no-index")}${value("again")}`;
}

/** A part of one image, of the book the connector fetched this record set from before (or the one named). */
function partRequest(ctx: Context, c: Connector, book: string | undefined, opts: Record<string, unknown>): ConnectorRequest {
  const tree = ctx.tree();
  if (!opts.recordset) throw new UsageError("a part is registered with its image: give --recordset B…", { hint: `strom fetch ${c.name} --recordset B… --images <n> --crop x,y,w,h` });
  const recordset = requireRecord<RecordSet>(tree, String(opts.recordset), "recordset").id;
  const images = parseImages(opts.images, 1);
  if (!images) throw new UsageError("which image? --images <n> (one)", { hint: `strom fetch ${c.name} --recordset ${recordset} --images <n> --crop x,y,w,h` });
  const all = tree.list<Media>("media");
  const whole = findImage(all, recordset, images[0]!);
  return { cmd: "part", book: bookOfFetch(ctx, c, book, opts), image: images[0]!, region: partRegion(opts, whole?.part ? undefined : whole) };
}

/**
 * Images through the user's browser. The connector says where they are (locate,
 * its pages through strom as usual); the limiter reserves a time for each
 * request of the browser — opening the page, then one per image — in the state
 * every strom process shares; the agent runs a script in a tab of the images'
 * site that keeps to those times and saves each image into the downloads folder.
 */
/** The address of an archive's terms the person saw (taken over or accepted): the one page a forbidden archive is asked for. */
function seenTerms(ctx: Context, c: Connector, host: string): string | undefined {
  const seen = loadArchives(ctx.env).archives[host]?.seen?.[c.name];
  return seen && seen.by !== "strom" && seen.terms && URL.canParse(seen.terms) ? new URL(seen.terms).toString() : undefined;
}

/** An answer that is an image by its first bytes (JPEG, PNG, GIF, TIFF, WebP, JPEG 2000). */
function imageMagic(b: Buffer): boolean {
  const at = (i: number, ...xs: number[]) => xs.every((x, j) => b[i + j] === x);
  return at(0, 0xff, 0xd8, 0xff) || at(0, 0x89, 0x50, 0x4e, 0x47) || at(0, 0x47, 0x49, 0x46, 0x38) || at(0, 0x49, 0x49, 0x2a, 0x00) || at(0, 0x4d, 0x4d, 0x00, 0x2a) || at(8, 0x57, 0x45, 0x42, 0x50) || at(0, 0xff, 0x4f, 0xff, 0x51) || at(4, 0x6a, 0x50, 0x20, 0x20);
}

/** strom connector test, once the request is known (again after a page from the browser). */
async function testWith(ctx: Context, c: Connector, request: ConnectorRequest, max: number): Promise<Result> {
  if (!(await ensureAllowed(ctx, c))) return { text: "not allowed — nothing was sent", exitCode: 1 };
  if (!(await ensureLogin(ctx, c))) return { text: "no login — nothing was sent", exitCode: 1 };
  // what the archive's terms let a test ask (core/terms.ts): images only where they may come, at their pace
  const images = request.cmd === "fetch" || request.cmd === "part";
  const gate = await gateArchive(ctx, c, { activity: images ? "images" : "catalogue", ...(images ? { images: request.cmd === "part" ? String(request.image) : imagesArg(request.images) } : {}) });
  const workDir = path.join(c.dir, ".test");
  fs.mkdirSync(workDir, { recursive: true });
  for (const e of fs.readdirSync(workDir)) if (e !== "probe") fs.rmSync(path.join(workDir, e), { recursive: true, force: true }); // what probes saved stays
  const pages = pagesOf(ctx, c);
  const meter = new FetchMeter();
  const r = await runConnector(c, request, { env: ctx.env, workDir, netDir: netDir(ctx), maxRequests: max, onLog: (l) => ctx.io.stderr(`  · ${l}\n`), ...limitWait(ctx), ...metered(meter), ...(pages ? { pages } : {}), ...pacing(ctx, c, gate.human), ...netWords(ctx, c, gate.levels) });
  measure(ctx, c, meter, { via: "direct", cmd: "test", test: request.cmd, ...("book" in request ? { book: request.book } : {}) }, r);
  refusalSaid(ctx, c, r.refused);
  if (r.needs) return planPages(ctx, c, r.needs, { cmd: "test", request: { ...request }, max }, `strom connector test ${c.name} (${request.cmd})`, describeRun(r, `test ${request.cmd}`));
  const direct = directNetwork(c);
  return {
    text: lines(
      describeRun(r, `test ${request.cmd}`),
      r.refused ? refusalAdvice(ctx, c, r.refused, request.cmd === "find" ? request.place : undefined) : undefined,
      r.books.length ? `books (${r.books.length}):\n${bookLines(r, c, `strom connector test ${c.name} --list <id>`).join("\n")}` : undefined,
      r.images.length ? `images (${r.images.length}): ${r.images.map((i) => `${i.n ?? "?"}${i.region ? ` part ${regionText(i.region)}` : ""}=${path.basename(i.file)} ${fs.statSync(i.file).size} B${pixels(i.file)}`).join(", ")} in ${ctx.display(workDir)}` : undefined,
      r.located.length ? `located (${r.located.length}):\n${r.located.map((l) => `  ${l.n}${l.region ? ` part ${regionText(l.region)}` : ""}  ${l.src}${l.url && l.url !== l.src ? `\n       page ${l.url}` : ""}`).join("\n")}` : undefined,
      c.manifest.login ? (loginOf(ctx.env, c) ? "with the user's login" : `without a login${c.manifest.login.required ? "" : " (the user may save one: strom login " + c.name + ")"}`) : undefined,
      direct.length ? `⚠ the code reaches the network directly — strom cannot pace that:\n${direct.map((d) => `  ${d}`).join("\n")}` : undefined,
      c.manifest.policy.automation === "unknown" ? "⚠ policy.automation is unknown — find out what the portal's terms say (DISCOVERY.md, step 1)" : undefined,
      c.manifest.withheld?.length ? `⚠ can lists ${c.manifest.withheld.join(", ")}, but its terms are "${c.manifest.policy.automation}" — left out: take them out of connector.json` : undefined,
    ),
    data: { ...r, direct },
    ...(later(r, "the same command").exitCode ? { exitCode: EXIT.later } : r.stopped && !r.books.length && !r.images.length && !r.located.length ? { exitCode: 1 } : {}),
  };
}

/** A probe's answer an agent reads whole at most (bytes), and its longest line (characters): past either, it searches it. */
const PROBE_READ_MAX = 64 * 1024;
const PROBE_LINE_MAX = 5000;

/** The longest line of a saved answer, in characters (bytes, near enough). */
function longestLine(body: Buffer): number {
  let max = 0;
  let from = 0;
  for (let i = body.indexOf(10); i !== -1; i = body.indexOf(10, from)) {
    max = Math.max(max, i - from);
    from = i + 1;
  }
  return Math.max(max, body.length - from);
}

/** What a probe got, saved in .test/probe to read — from strom's request or from the user's browser. */
function probeResult(ctx: Context, c: Connector, method: string, url: string, res: { status: number; contentType: string; headers: Record<string, string>; url: string; body: Buffer }, save: string | undefined, cookies?: string[]): Result {
  const dir = path.join(c.dir, ".test", "probe");
  fs.mkdirSync(dir, { recursive: true });
  const fromUrl = decodeURIComponent((URL.canParse(res.url) ? new URL(res.url) : new URL(url)).pathname.split("/").filter(Boolean).at(-1) ?? "") || "index.html";
  const name = String(save ?? fromUrl).replace(/[^\p{L}\p{M}\p{N}._-]+/gu, "_").replace(/^\.+/, "_");
  const file = path.join(dir, name);
  fs.writeFileSync(file, res.body);
  const textual = /^(text\/|application\/(json|xml|javascript|x-javascript)|image\/svg)/.test(res.contentType);
  const check = botCheck(res.body, res.headers);
  // a big page or script, or a minified one (one long line), is past what an agent can read whole (a live run: a
  // script of one line went past its read limit): it is searched
  const longest = textual ? longestLine(res.body) : 0;
  const big = textual && (res.body.length > PROBE_READ_MAX || longest > PROBE_LINE_MAX);
  const search = `strom connector grep ${c.name} <text>${big ? ` --in ${shellArg(name)}` : ""} (an address such as /api/, .json, .jpg; a form field)`;
  return {
    text: lines(
      `${method} ${url} → ${res.status} · ${res.contentType || "no type"} · ${res.body.length} B${res.url && res.url !== url ? ` · after redirects ${res.url}` : ""}${cookies ? "" : " · from your browser"}`,
      ...Object.entries(res.headers)
        .filter(([k]) => !["date", "connection", "keep-alive", "transfer-encoding", "vary"].includes(k))
        .map(([k, v]) => `  ${k}: ${v}`),
      `saved: ${ctx.display(file)}${big ? ` — too big to read whole (${Math.round(res.body.length / 1024)} KB${longest > PROBE_LINE_MAX ? `, a line of ${longest} characters` : ""}): never read the file, search it: ${search}` : textual ? ` — search it: ${search}` : ""}`,
      check
        ? c.manifest.browser?.pages
          ? `⚠ this is ${check}'s check whether a person is there, not the page: the user passes it in that tab of their browser (never you), then probe again`
          : `⚠ this is ${check}'s check whether a person is there, not the page: the portal gives its pages to a real browser only. Build the connector through the user's browser: in connector.json "routes": ["browser"] and "browser": {"pages": true} (the contract, section 5), then strom connector use ${c.name} --via browser — browser tools come with your next session, and the user passes the check in their own browser, never you`
        : undefined,
      cookies?.length ? `cookies kept for the next probe: ${cookies.join(", ")} (--fresh starts without them)` : undefined,
      textual && res.body.length <= 1500 ? res.body.toString("utf8") : undefined,
    ),
    data: { status: res.status, type: res.contentType, headers: res.headers, url: res.url, bytes: res.body.length, file, ...(big ? { big: true } : {}), ...(cookies ? { cookies } : { via: "browser" }), ...(check ? { botCheck: check } : {}) },
  };
}

/** browser.pages: what the browser got, for the connector's run (undefined: the connector reaches the portal through strom). */
function pagesOf(ctx: Context, c: Connector): ((r: PageRequest) => PageAnswer | undefined) | undefined {
  if (!c.manifest.browser?.pages) return undefined;
  const root = ctx.tree().root;
  return (r) => loadPage(root, c.name, pageKey(r));
}

/**
 * A page for a connector whose portal answers a real browser only: planned in
 * strom's limiter, asked by a script in the user's tab, saved into the
 * downloads folder — then --take gives it to the connector and goes on.
 */
function planPages(ctx: Context, c: Connector, want: PageRequest, resume: Resume, what: string, before?: string): Result {
  const tree = ctx.tree();
  // every page of a portal behind a bot check goes through the user's browser: only with the person's permission (S3)
  const blocked = levelsOf(ctx, c, true).find((a) => !allows(a, "pages", "browser").ok);
  if (blocked)
    throw new NeedsPermissionError({
      hosts: [blocked.host],
      connector: c.name,
      way: "browser",
      asked: "menu",
      level: levelText(blocked),
      title: blocked.title ?? blocked.host,
      ways: waysOffered(c, true, "browser", !!blocked.browserOnly),
      hint: `every page of ${blocked.host} goes through the user's browser — the user allows it: strom allow archive ${blocked.host} --way browser; meanwhile another source`,
    });
  const u = new URL(want.url);
  const pace = paceAt(ctx, u.hostname, c);
  let times: number[];
  try {
    // one pause ahead: time to open the tab
    times = reserveSlots(netDir(ctx), u.hostname, c.manifest.policy.pace, 1, { leadMs: pace.minIntervalMs });
  } catch (err) {
    if (!(err instanceof NetError)) throw err;
    return { text: lines(before, `nothing planned: ${err.message}`), exitCode: 1 };
  }
  const key = pageKey(want);
  const open = c.manifest.browser?.open && new URL(c.manifest.browser.open).origin === u.origin ? c.manifest.browser.open : `${u.origin}/robots.txt`;
  const page: PlanPage = { key, method: want.method, url: want.url, headers: want.headers, ...(want.body !== undefined ? { body: want.body } : {}), file: `strom-${c.name}-page-${key}`, at: times[0]! };
  // a page planned again replaces its older plan
  for (const old of loadPlans(tree.root, c.name)) if (old.pages?.some((p) => p.key === key)) removePlan(tree.root, old.id);
  const now = Date.now();
  const book = "request" in resume && typeof resume.request.book === "string" ? resume.request.book : "";
  const plan: BrowserPlan = { id: `${c.name}-${now}-p`, connector: c.name, book, pages: [page], resume, open, origin: u.origin, host: u.hostname, gap: pace.minIntervalMs, created: now, until: now + PLAN_TTL_MS, items: [] };
  savePlan(tree.root, plan);
  const script = pageScript(plan);
  const take = `strom fetch ${c.name} --take --result "<the line it returned>"`;
  return {
    text: lines(
      before,
      `browser plan: 1 page of ${u.hostname} for ${what} — the portal answers a real browser only; about ${Math.max(1, Math.round((page.at - now) / 1000))} s at its pace`,
      `1. A tab of your own on ${u.origin} — open ${open} if you have none there.`,
      "   The site shows its check whether a person is there (a box to tick, a puzzle), a login, or the browser is not connected: stop and ask the user — that is theirs to do, never yours (strom task wait T… --on \"…\"). Then go on.",
      "2. Run this in that tab with the JavaScript tool, exactly as it is:",
      "",
      script,
      "",
      `3. Then: ${take} — strom gives the page to the connector and goes on with ${what}; it may plan the next page: do the same again.`,
      `The browser saves it into ${ctx.display(ctx.settings.downloads())} as ${page.file}.json — strom takes it over; do not open, move or read it yourself.`,
    ),
    data: { plan: { id: plan.id, open, host: plan.host, pages: [{ key, method: page.method, url: page.url, file: page.file, at: new Date(page.at).toISOString() }] }, script, take, resume },
  };
}

/** A page the browser got, also as a file of the connector's .test/probe: strom connector grep reads it while the connector is built. */
function keepForGrep(c: Connector, pg: PlanPage, page: PageAnswer): void {
  const ext = /json/.test(page.contentType) ? ".json" : /javascript/.test(page.contentType) ? ".js" : /^image\/(\w+)/.exec(page.contentType)?.[1] ? `.${/^image\/(\w+)/.exec(page.contentType)![1]!.replace("jpeg", "jpg")}` : /text\/plain/.test(page.contentType) ? ".txt" : ".html";
  const tail = (URL.canParse(pg.url) ? new URL(pg.url).pathname.split("/").filter(Boolean).at(-1) : undefined)?.replace(/[^\p{L}\p{N}._-]+/gu, "_").slice(0, 60) ?? "page";
  try {
    const dir = path.join(c.dir, ".test", "probe", "browser");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${tail}-${pg.key}${ext}`), page.body);
  } catch {
    // a copy to read: the page itself is kept in the tree
  }
}

/** Pages the browser saved: kept for the connector, and the command they were planned for goes on. */
async function takePages(ctx: Context, c: Connector, plans: BrowserPlan[], result: string | undefined): Promise<Result> {
  const tree = ctx.tree();
  const dir = ctx.settings.downloads();
  const got = result === undefined ? [] : parseResult(result);
  const notes: string[] = [];
  const taken: string[] = [];
  let next: Resume | undefined;
  for (const plan of plans) {
    const left: PlanPage[] = [];
    let stop = false;
    for (const pg of plan.pages ?? []) {
      const f = findDownload(dir, pg.file);
      const said = got.find((g) => g.page === pg.key);
      if (!f.file) {
        left.push(pg);
        if (said?.failed) notes.push(`${pg.url}: the browser could not ask for it (no network, or the site closed the connection) — run the script again`);
        else if (said?.status === 200) notes.push(`${pg.url}: the browser got it but saved nothing into ${ctx.display(dir)} — Chrome lets a site download one file until the user allows automatic downloads for it (at the right end of the address bar)`);
        else if (said?.status && [401, 403, 429].includes(said.status)) {
          const why = refusedBy(netDir(ctx), plan.host, said.status);
          if (why) notes.push(why);
          stop = true;
        }
        continue;
      }
      const page = readSavedPage(f.file);
      for (const x of [f.file, ...f.others]) fs.rmSync(x, { force: true });
      if (typeof page === "string") {
        notes.push(`${pg.url}: ${page} — removed; run the script again`);
        left.push(pg);
        continue;
      }
      const check = botCheck(page.body, page.headers);
      if (check) {
        notes.push(`${plan.host} gave its check whether a person is there (${check}) instead of the page: the user passes it in that tab — never you — then run the same script again`);
        left.push(pg);
        continue;
      }
      if ([401, 403, 429].includes(page.status)) {
        const why = refusedBy(netDir(ctx), plan.host, page.status);
        notes.push(why ?? `${plan.host} answered ${page.status}`);
        stop = true;
        continue;
      }
      savePage(tree.root, c.name, pg, page);
      keepForGrep(c, pg, page);
      taken.push(`${pg.method} ${pg.url} → ${page.status} · ${page.body.length} B`);
    }
    if (stop || !left.length) removePlan(tree.root, plan.id);
    else savePlan(tree.root, { ...plan, pages: left });
    if (!stop && !left.length && plan.resume) next ??= plan.resume;
  }
  const head = lines(taken.length ? `${taken.length === 1 ? "page" : "pages"} taken over from your browser: ${taken.join("; ")}` : `no page taken over from ${ctx.display(dir)}`, ...notes.map((n) => `  ⚠ ${n}`));
  if (!next) return { text: head, data: { taken, notes }, ...(taken.length ? {} : { exitCode: 1 }) };
  // go on with what the pages were planned for: the connector asks again, the pages it has come from what the browser got
  let then: Result;
  if (next.cmd === "probe") {
    const pg = plans.flatMap((p) => p.pages ?? []).find((p) => loadPage(tree.root, c.name, p.key));
    const page = pg ? loadPage(tree.root, c.name, pg.key)! : undefined;
    then = page && pg ? probeResult(ctx, c, pg.method, pg.url, page, next.save) : { text: "the probe's page is not there" };
  } else if (next.cmd === "test") then = await testWith(ctx, c, next.request as ConnectorRequest, next.max);
  else then = await fetchWith(ctx, c, next.request as ConnectorRequest, next.recordset);
  return { text: lines(head, then.text), data: { taken, notes, then: then.data }, ...(then.exitCode ? { exitCode: then.exitCode } : {}) };
}

/**
 * A host this fetch brought near its hourly cap (CAP_WARN of it used in the last hour): said to the agent after each
 * fetch — what is left of the hour, when the next request frees, to write down and work on what is here meanwhile — and
 * to the person once at each share reached, in the research's history (op net.cap, said in the research language).
 * Only said: the pace and the cap stay as they are, never raised, never gone round.
 */
function capSaid(ctx: Context, c: Connector, asked: Map<string, number>, human?: Map<string, Pace>): string | undefined {
  const now = (testHooks.now ?? Date.now)();
  const said: string[] = [];
  for (const [host, n] of asked) {
    if (!(n > 0)) continue;
    const near = capNear(hostState(netDir(ctx), host), paceAt(ctx, host, c, human), now);
    if (!near) continue;
    said.push(
      `⚠ ${host}: ${near.used} of its ${near.cap} requests an hour used (${Math.round(near.share * 100)} % of its cap) — ${near.left} left this hour; the next frees at ${clock(near.free)}, as each request is an hour old. Write down what was found now and work on what is here meanwhile (the images fetched, reading, other tasks); never go round the cap (another connector, the browser, another way to the same archive).`,
    );
    // the person hears it once at each share: the one this fetch reached
    const before = near.used - n;
    const reached = CAP_WARN.filter((x) => before < x * near.cap && near.used >= x * near.cap);
    if (!reached.length || !ctx.hasTree()) continue;
    const tree = ctx.tree();
    if (tree.dryRun) continue;
    try {
      tree.withTreeLock(() => tree.appendOp({ op: "net.cap", targets: [], files: [], summary: `${host}: ${near.used} of its ${near.cap} requests an hour used; the next frees at ${new Date(near.free).toISOString()}` }));
    } catch {
      // the research busy: the agent was told; the person hears it at the next share
    }
  }
  return said.length ? said.join("\n") : undefined;
}

/**
 * A part of an image strom holds already (partHere): answered from what is here, nothing asked of the archive. It is
 * recorded with no request — as the portal's "no sharper" when the whole image here holds as much as a part brings
 * (what tells the tuning a portal gives nothing sharper), else as held (the same part, or a part it lies in).
 */
function fromStore(ctx: Context, c: Connector, request: Extract<ConnectorRequest, { cmd: "part" }>, recordset: string, h: PartHere, via: string): Result {
  const tree = ctx.tree();
  const what = `part ${regionText(request.region)} of image ${request.image} of ${recordset}`;
  const px = (n: number) => `${Math.round(n)} px across the image`;
  const whole = findImage(tree.list<Media>("media").filter((m) => !m.part), recordset, request.image);
  const gainOverWhole = h.held.part && whole?.width && h.detail ? h.detail / whole.width : undefined;
  const heldText =
    h.how === "same"
      ? `${h.held.id}, the same part`
      : h.how === "whole"
        ? `${h.held.id} (the whole image, ${Math.round(h.detail)} px across)`
        : `${h.held.id} (part ${regionText(h.held.part!)}, ${px(h.detail)}${gainOverWhole && gainOverWhole >= SHARPER ? ` · ${gainOverWhole.toFixed(1)}× the detail of the whole image` : ""})`;
  const gain = h.most !== undefined && h.detail ? h.most / h.detail : undefined;
  const view = h.how === "whole" ? `strom media view ${recordset}:${request.image} --crop ${regionText(request.region)}` : `strom media view ${h.held.id}${h.how === "same" ? "" : ` --crop ${regionText(h.crop)}`}`;
  const noSharper = h.how === "whole" && gain !== undefined;
  if (!tree.dryRun)
    measure(ctx, c, undefined, {
      via,
      cmd: "part",
      book: request.book,
      rs: recordset,
      img: request.image,
      part: request.region,
      requests: 0,
      held: h.held.id,
      ...(noSharper ? { noSharper: { gain: Math.round(gain! * 100) / 100, detail: h.most, width: Math.round(h.detail) } } : {}),
      result: noSharper ? "no-sharper" : "held",
    });
  return {
    text: lines(
      `${what}: already here — ${heldText} · no request`,
      gain !== undefined
        ? h.native
          ? `  the sharpest ${c.name} gives of this book is ${px(h.most!)} (${gain.toFixed(1)}× — no sharper)`
          : `  a part this size comes from ${c.name} at most ${px(h.most!)} (${gain.toFixed(1)}× — no sharper)`
        : undefined,
      `look at it: ${view}${gain !== undefined && !h.native ? " · a smaller part (one entry) may come sharper" : ""}`,
    ),
    data: {
      added: [],
      again: [h.held.id],
      held: { id: h.held.id, how: h.how, crop: h.crop, detail: Math.round(h.detail), ...(h.most !== undefined ? { most: h.most } : {}), ...(h.native ? { native: true } : {}) },
      ...(noSharper ? { skipped: { image: request.image, region: request.region, detail: h.most, width: Math.round(h.detail), gain: gain! } } : {}),
    },
  };
}

/**
 * A book the research has under another ID is never fetched again (B0389 = B0169: every image asked of the archive
 * twice, found by its hash only after): before any request, the book of the same link, or whose images came from this
 * book of the connector, is named — fetch into it, read it. --again with a reason fetches into --recordset all the
 * same and keeps why on it (the same book never asked again).
 */
function sameBookFirst(ctx: Context, c: Connector, request: Extract<ConnectorRequest, { cmd: "fetch" }>, recordset: string | undefined, again: string | undefined): void {
  const tree = ctx.tree();
  const target = recordset ? tree.get<RecordSet>(recordset) : undefined;
  // the book registered first is fetched into as before: only one registered before the target makes it a copy
  const before = (b: RecordSet) => !target || b.created.localeCompare(target.created) < 0 || (b.created === target.created && b.id < target.id);
  const same = sameBooks(tree, { ...(target?.url ? { url: target.url } : {}), connector: c.name, book: String(request.book) }, recordset).filter((x) => before(x.book));
  if (!same.length) return;
  const first = same[0]!.book.id;
  const imgs = imagesArg(request.images);
  if (!recordset) {
    if (again) return;
    throw new UsageError(`book ${request.book} of ${c.name} is ${same.map(sameBookText).join(", ")} in the research — nothing fetched`, {
      hint: `its images: strom fetch ${c.name} ${shellArg(String(request.book))} --images ${imgs} --recordset ${first} (only those not here are asked for) · read it: strom read ${first} --images ${imgs} · into the inbox all the same: --again "<why>"`,
    });
  }
  if (!again)
    throw new UsageError(`${recordset} is the same book as ${same.map(sameBookText).join(", ")} (${same[0]!.by === "url" ? "the same link" : `its images came from book ${request.book} of ${c.name}`}) — nothing fetched`, {
      hint: `fetch into it: strom fetch ${c.name} ${shellArg(String(request.book))} --images ${imgs} --recordset ${first} (only the images not here are asked for) · read it: strom read ${first} --images ${imgs} · ${recordset} is another book (another film): --again "<why>"`,
    });
  if (tree.dryRun) return;
  update<RecordSet>(
    tree,
    recordset,
    "recordset",
    (cur) => ({ ...cur, duplicates: { of: [...new Set([...(cur.duplicates?.of ?? []), ...same.map((x) => x.book.id)])], reason: again } }),
    { op: "recordset.edit", summary: `${recordset} duplicates (beside ${same.map((x) => x.book.id).join(", ")})`, reason: again },
  );
}

/** What registering a fetch's images gave, batch after batch. */
interface Registered {
  added: Media[];
  again: string[];
  restored: string[];
  woken: string[];
  clashes: string[];
  /** Registered in an earlier batch, then found to be the same file as a later image: a placeholder, withdrawn. */
  withdrawn: string[];
}

/**
 * The images of a book registered in batches as they come (FETCH_BATCH, one commit each), where they waited for the
 * whole fetch: strom read of the same book begins on the first ones (core/fetching.ts, its mark says what is coming).
 * Each batch is written whole under the tree's lock, and only then committed; the person's Ctrl-C (or a stop of the
 * process) waits for the batch at work — signals are heard between JavaScript's turns, a batch is written in one —
 * then registers what came and stops the connector: nothing half registered, nothing that came lost. A second Ctrl-C
 * ends it at once (what is registered stays). The archive is asked nothing more or sooner: it only registers.
 */
function fetchBatches(ctx: Context, c: Connector, request: Extract<ConnectorRequest, { cmd: "fetch" }>, recordset: string, from: (file: string) => string, child?: BackgroundOf, task?: string, workDir?: string) {
  const tree = ctx.tree();
  const fetched = { connector: c.name, book: request.book };
  const session = child?.session ?? ctx.env.STROM_SESSION;
  const mark = markFetch(tree.root, {
    recordset,
    connector: c.name,
    book: String(request.book),
    images: [...request.images],
    ...(session ? { session } : {}),
    ...(task ? { task } : {}),
    ...(child ? { background: true, ...(child.worker ? { worker: child.worker } : {}) } : {}),
    // a process that is gone (killed) leaves its work folder: the strom that finds its mark stale takes it away
    ...(workDir ? { work: path.basename(workDir) } : {}),
  });
  const acc: Registered = { added: [], again: [], restored: [], woken: [], clashes: [], withdrawn: [] };
  const done = new Map<string, string | undefined>(); // the file of each image registered → its media (none: here already)
  let pending: FetchedImage[] = [];
  // the data would not commit (strom check): no more batches — the rest at the end, which says why, as before
  let blocked = false;
  const abort = new AbortController();
  const register = (items: FetchedImage[]) => {
    const res = registerImages(tree, shared(ctx), items.map((i) => ({ file: i.file, image: i.n, url: i.url, from: from(i.file), fetched })), recordset, { wake: false });
    acc.added.push(...res.added);
    acc.again.push(...res.again);
    acc.restored.push(...res.restored);
    acc.clashes.push(...res.clashes);
    for (const i of items) done.set(i.file, res.added.find((m) => m.image === i.n)?.id);
  };
  const flush = () => {
    if (blocked || !pending.length) return;
    const items = pending;
    pending = [];
    try {
      // a batch written and committed under one hold of the tree: another strom never sees it half written
      tree.withTreeLock(() => {
        register(items);
        if (autoCommit(ctx, { path: ["fetch"] } as unknown as CommandDef)) blocked = true;
      });
    } catch (err) {
      // the person's Ctrl-C reached git too (one group of processes): the batch is written, the command's own commit
      // at its end takes it — the fetch stops as interrupted, never as strom failing
      if ((err as StromError).code !== "git.interrupted") throw err;
      blocked = true;
      abort.abort();
    }
    mark.beat({ registered: done.size });
  };
  let heard = 0;
  // why a fetch in the background stopped before its end (its watch: asked to stop, its session, its run)
  let stopped: string | undefined;
  const onSignal = () => {
    if (++heard > 1) process.exit(EXIT.cancelled);
    flush();
    abort.abort();
  };
  const signals: NodeJS.Signals[] = process.platform === "win32" ? ["SIGINT"] : ["SIGINT", "SIGTERM", "SIGHUP"];
  for (const sig of signals) process.on(sig, onSignal);
  // a look every few seconds, never a signal: the same on Windows, and heard between batches as a signal is
  const unwatch = child
    ? watchBackground(
        tree.root,
        () => backgroundWhy(tree, ctx.env, child),
        (why) => {
          stopped = why;
          flush();
          abort.abort();
        },
      )
    : undefined;
  return {
    signal: abort.signal,
    interrupted: () => abort.signal.aborted,
    /** Why a fetch in the background stopped (undefined: it did not, or the person's Ctrl-C). */
    stopped: () => stopped,
    /** Waits while a fetch in the foreground asks the archive (true), goes on (false). */
    yielding(w: boolean) {
      mark.beat({ yielding: w });
    },
    /** Some batch is registered already. */
    registered: () => done.size > 0,
    took(im: FetchedImage) {
      pending.push(im);
      if (pending.length >= FETCH_BATCH && !blocked) flush();
      else mark.beat();
    },
    waiting(until: number) {
      mark.beat({ waitUntil: until });
    },
    /** The run is over: what it gave and no batch holds is registered; a placeholder an earlier batch took withdrawn. */
    finish(images: FetchedImage[]): Registered {
      const kept = new Set(images.map((i) => i.file));
      const rest = images.filter((i) => !done.has(i.file));
      pending = [];
      if (rest.length) register(rest);
      for (const [file, id] of done)
        if (!kept.has(file) && id) {
          update<Media>(tree, id, "media", (x) => ({ ...x, retracted: { at: now(), reason: "the portal gave the same file for another image of the book: a placeholder, not this scan" } }), {
            op: "media.retract",
            summary: `${id} retracted: the same file as another image of ${recordset} (a placeholder)`,
          });
          acc.withdrawn.push(id);
        }
      acc.woken = wakeWaiting(tree, recordset, acc.added.length);
      mark.beat({ registered: done.size });
      return acc;
    },
    end() {
      unwatch?.();
      for (const sig of signals) process.off(sig, onSignal);
      mark.end();
    },
  };
}

/**
 * Why a fetch in the background stops now (undefined: it goes on): its session asked to finish, closed (outside a
 * run — in a run it goes on while the run works: the images were the agent's choice), the run or the conversation it
 * was started in ended, or the session's last minutes reached outside a run.
 */
function backgroundWhy(tree: Tree, env: Context["env"], of: BackgroundOf): string | undefined {
  if (finishAsked(tree.root, of.session)) return `its session ${of.session} is asked to finish`;
  let open = true;
  try {
    open = (JSON.parse(fs.readFileSync(tree.recordPath("session", of.session), "utf8")) as { state?: string }).state === "open";
  } catch {
    open = false;
  }
  const run = isRunWorker(of.worker);
  if (of.worker && !isLiveWorker(tree.root, of.worker)) return run ? "the run it was started in ended" : "the conversation it was started in ended";
  if (!open && !run) return `its session ${of.session} closed`;
  const deadline = deadlineOf(env);
  if (open && !run && deadline !== undefined && Date.now() > deadline - REMIND_MS) return `its session's last ${Math.round(REMIND_MS / 60_000)} minutes`;
  return undefined;
}

/** Whose a fetch at work is, for people and agents: in the background for a task, or in the foreground. */
function fetchWhose(m: ActiveFetch): string {
  const whose = [m.task ? `for ${m.task}` : undefined, m.session ? `session ${m.session}` : undefined].filter(Boolean).join(", ");
  return `${m.background ? "in the background" : "in the foreground"}${whose ? ` ${whose}` : ""}, ${m.registered}/${m.images.length} registered`;
}

/**
 * The task a fetch is for: --task, else the session's task when it names the record set — else the one task this
 * session worked on (its operations name it: a task it added or edited, a search it recorded for it) that names the
 * record set and nobody else holds; two or none: the session's task, as before (never a guess between them).
 */
function fetchTask(tree: Tree, s: Session | undefined, recordset: string | undefined, given?: string): { task?: string; guessed?: true } {
  if (given) return { task: given };
  if (!s) return {};
  const own = s.task ? tree.get<Task>(s.task) : undefined;
  const asBefore = s.task ? { task: s.task } : {};
  if (!recordset || (own && taskNamesBook(tree, own, recordset))) return asBefore;
  const busy = othersAtWork(tree, tree.env).tasks;
  const worked = workedOn(tree, s.id);
  const named = tree.list<Task>("task").filter((t) => !t.retracted && t.id !== s.task && (t.state === "open" || t.state === "doing") && !busy.has(t.id) && worked.has(t.id) && taskNamesBook(tree, t, recordset));
  return named.length === 1 ? { task: named[0]!.id, guessed: true } : asBefore;
}

/** The records of the research an ID in a text names (B0001, S12, M0003 — a whole ID, never a part of a word). */
const ID_IN_TEXT = /(?<![\p{L}\p{M}\p{N}])([BMS]\d+)(?![\p{L}\p{M}\p{N}])/gu;

/** Does a task's place of search name the record set: the book itself, a source of it, an image of it. */
function taskNamesBook(tree: Tree, t: Task, recordset: string): boolean {
  for (const w of t.where)
    for (const m of w.normalize("NFC").matchAll(ID_IN_TEXT)) {
      const id = normId(m[1]!);
      if (id === recordset) return true;
      const r = id.startsWith("S") ? tree.get<Source>(id) : id.startsWith("M") ? tree.get<Media>(id) : undefined;
      if (r && "recordset" in r && r.recordset === recordset) return true;
    }
  return false;
}

/** The tasks a session's operations name: those it added or edited, and those its searches were recorded for. */
function workedOn(tree: Tree, session: string): Set<string> {
  const out = new Set<string>();
  for (const file of opsLogsOf(tree.dataDir, session)) {
    let text = "";
    try {
      text = fs.readFileSync(file, "utf8");
    } catch {
      continue;
    }
    for (const line of text.split("\n")) {
      if (!line.trim()) continue;
      let targets: unknown;
      try {
        targets = (JSON.parse(line) as { targets?: unknown }).targets;
      } catch {
        continue;
      }
      if (!Array.isArray(targets)) continue;
      for (const id of targets) {
        if (typeof id !== "string") continue;
        if (id.startsWith("T")) out.add(id);
        else if (id.startsWith("Q")) {
          const task = tree.get<Search>(id)?.task;
          if (task) out.add(task);
        }
      }
    }
  }
  return out;
}

/** The session (and its task, its worker) a fetch in the background belongs to; none: refused with what to do. */
function backgroundOwner(ctx: Context, recordset: string | undefined, given: string | undefined): BackgroundOf & { guessed?: true } {
  const tree = ctx.tree();
  const s = currentSession(tree, ctx.env);
  if (!s)
    throw new UsageError("--background belongs to a session: no session is open", {
      hint: "strom session start T… first — or fetch in the foreground (without --background)",
    });
  if (finishAsked(tree.root, s.id)) throw new UsageError(`session ${s.id} is asked to finish: nothing new starts in it`, { hint: "write down what was found and close the session" });
  const worker = ctx.env.STROM_WORKER;
  // its last minutes outside a run: a fetch in the background would stop at once (backgroundWhy) — never begun
  const deadline = deadlineOf(ctx.env);
  if (!isRunWorker(worker) && deadline !== undefined && Date.now() > deadline - REMIND_MS)
    throw new UsageError(`session ${s.id} is in its last ${Math.round(REMIND_MS / 60_000)} minutes: nothing new starts in the background`, { hint: "write down what was found and close the session" });
  const { task, guessed } = fetchTask(tree, s, recordset, given);
  return { session: s.id, ...(task ? { task } : {}), ...(guessed ? { guessed } : {}), ...(worker && isLiveWorker(tree.root, worker) ? { worker } : {}) };
}

/** How long the command that starts a fetch in the background waits for it to begin (its mark), or to end soon. */
const BACKGROUND_START_MS = 15_000;

/**
 * strom fetch --background: everything checked here (the terms, the images registered and being fetched, the
 * consents, the login, what it asks of the archive), then a strom of its own fetches — a process apart, so the end of
 * the agent's turn does not stop it — and this command ends once it began, saying how to follow it.
 */
async function startBackground(ctx: Context, c: Connector, request: Extract<ConnectorRequest, { cmd: "fetch" }>, recordset: string, owner: BackgroundOf & { guessed?: true }, noIndex: boolean, again: string | undefined): Promise<Result> {
  const tree = ctx.tree();
  // a host of the archive left alone for a while (it went silent, asked to slow down): waited for when it frees in
  // time, else said when to try again — no strom started only to end at once
  const alone = leftAloneHosts(ctx, c);
  const by = Date.now() + limitWait(ctx).waitMs;
  const tooLong = alone.filter((a) => a.until > by);
  if (tooLong.length) {
    const last = tooLong.reduce((a, b) => (b.until > a.until ? b : a));
    const wait = later({ later: last.until, laterDown: last.host } as RunReport, `strom fetch ${c.name} ${shellArg(String(request.book))} --images ${imagesArg(request.images)} --recordset ${recordset} --background`, undefined, { session: true, run: deadlineOf(ctx.env) !== undefined });
    return { text: lines(`nothing started in the background: ${last.host} is left alone longer than a fetch in the background waits (${Math.round(limitWait(ctx).waitMs / 60_000)} min)`, wait.line), data: { started: false, ...wait.data }, exitCode: EXIT.later };
  }
  const waits = alone.length ? alone.reduce((a, b) => (b.until > a.until ? b : a)) : undefined;
  const log = backgroundLog(tree.root, recordset);
  fs.mkdirSync(path.dirname(log), { recursive: true });
  const out = fs.openSync(log, "a");
  const { command, args } = stromLauncher();
  const argv = [
    ...args,
    "fetch",
    c.name,
    String(request.book),
    "--images",
    imagesArg(request.images),
    "--recordset",
    recordset,
    ...(noIndex ? ["--no-index"] : []),
    ...(again ? ["--again", again] : []),
  ];
  const env: NodeJS.ProcessEnv = {
    ...(ctx.env as NodeJS.ProcessEnv),
    [BACKGROUND_ENV]: JSON.stringify(owner),
    STROM_SESSION: owner.session,
    STROM_TREE: tree.root,
    STROM_NONINTERACTIVE: "1",
    STROM_NO_DIALOG: "1",
    STROM_SPAWNED: "1",
  };
  const child = spawn(command, argv, { cwd: tree.root, env, detached: true, stdio: ["ignore", out, out], windowsHide: true });
  fs.closeSync(out);
  let exit: number | null | undefined;
  child.on("exit", (code) => (exit = code ?? 1));
  child.on("error", () => (exit = 1));
  child.unref();
  const pid = child.pid ?? 0;
  const startBy = Date.now() + BACKGROUND_START_MS;
  let began = false;
  while (Date.now() < startBy && exit === undefined) {
    if (activeFetches(tree.root, recordset).some((m) => m.pid === pid)) {
      began = true;
      break;
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  const tail = () => {
    try {
      return fs.readFileSync(log, "utf8").trim().split("\n").slice(-6).join("\n");
    } catch {
      return "";
    }
  };
  if (!began) {
    // ended before it began (nothing to fetch, refused): what it said is the answer
    if (exit === undefined) exit = await new Promise<number>((r) => (child.exitCode !== null ? r(child.exitCode) : child.once("exit", (code) => r(code ?? 1))));
    const said = tail();
    return { text: lines(`the fetch in the background ended at once (exit ${exit})${said ? ":" : ""}`, said ? said.split("\n").map((l) => `  ${l}`).join("\n") : undefined, `its log: ${ctx.display(log)}`), data: { pid, exitCode: exit, log }, exitCode: exit === 0 ? 0 : exit ?? 1 };
  }
  const n = request.images.length;
  return {
    text: lines(
      `fetching ${counted(n, "image")} of ${recordset} (images ${runs(request.images)}) in the background — pid ${pid}, for ${owner.task ?? `session ${owner.session}`}`,
      waits ? `  ${waits.host} is left alone until ${clockUp(waits.until)} (it went silent, or asked to slow down): the fetch waits for it, then goes on by itself — other work meanwhile, no asking again` : undefined,
      `  read them as they come: strom read ${recordset} --images ${imagesArg(request.images)} · what came: strom fetch --status · stop it: strom fetch --stop ${recordset}`,
      `  it stops when the session is asked to finish or closes${isRunWorker(owner.worker) ? " (in this run: when the run ends)" : ""}; what came stays registered`,
      owner.guessed ? `  for ${owner.task}: the one task this session worked on that names ${recordset}${currentSession(tree, ctx.env)?.task ? ` (the session's own: ${currentSession(tree, ctx.env)!.task})` : ""} — for another one: --task T…` : undefined,
    ),
    data: { pid, recordset, images: request.images, session: owner.session, ...(owner.task ? { task: owner.task } : {}), log, ...(waits ? { waitsUntil: new Date(waits.until).toISOString() } : {}) },
  };
}

/** The hosts of a connector left alone now for a while without a refusal (silence, "slow down"), and until when. */
function leftAloneHosts(ctx: Context, c: Connector): { host: string; until: number }[] {
  const dir = netDir(ctx);
  const now = Date.now();
  return knownHosts(dir)
    .filter((h) => hostAllowed(h, c.manifest.hosts))
    .flatMap((host) => {
      const until = leftAloneFor(hostState(dir, host), now);
      return until !== undefined ? [{ host, until }] : [];
    });
}

/** A fetch in the foreground whose images another strom is fetching already: waits for them (Ctrl-C stops waiting). */
async function joinFetch(ctx: Context, recordset: string, joined: { images: number[]; by: ActiveFetch[] }, said: string): Promise<Result> {
  const tree = ctx.tree();
  ctx.io.stderr(`  · ${said}: strom waits for them\n`);
  const want = new Set(joined.images);
  const here = () => {
    tree.reread();
    return new Set(tree.list<Media>("media").filter((m) => m.recordset === recordset && !m.part && !m.retracted && m.image !== undefined && want.has(m.image)).map((m) => m.image!));
  };
  for (;;) {
    const got = here();
    const coming = new Set(activeFetches(tree.root, recordset).filter((m) => m.pid !== process.pid).flatMap((m) => m.images));
    const left = joined.images.filter((n) => !got.has(n));
    if (!left.length || !left.some((n) => coming.has(n))) {
      const nums = joined.images.filter((n) => got.has(n));
      return {
        text: lines(
          nums.length ? `${counted(nums.length, "image")} of ${recordset} (images ${runs(nums)}) came by the other fetch — nothing asked twice` : undefined,
          left.length ? `images ${runs(left)} did not come (the other fetch ended before): strom fetch … --images ${imagesArg(left)} --recordset ${recordset} fetches them` : undefined,
        ),
        data: { added: [], joined: nums, ...(left.length ? { missed: left } : {}) },
        ...(left.length ? { exitCode: 1 } : {}),
      };
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
}

/** One line of a fetch at work, for strom fetch --status. */
function activeLine(m: ActiveFetch): string {
  const since = m.since ? ` · since ${clock(Date.parse(m.since))}` : "";
  const state = m.waitUntil && m.waitUntil > Date.now() ? ` · waits for the archive until ${clockUp(m.waitUntil)}, then goes on by itself` : m.yielding ? " · waits while a fetch in the foreground asks the archive" : "";
  return `${m.recordset} (${m.connector} ${m.book}): ${m.registered}/${m.images.length} images registered · ${m.background ? `in the background${m.task ? ` for ${m.task}` : ""}${m.session ? ` (session ${m.session})` : ""}` : "in the foreground"}${since}${state} · pid ${m.pid}`;
}

function endedLine(e: EndedFetch): string {
  // ended without a word (its process killed, the computer stopped): found so by a later strom, its last sign of life
  const how = e.interrupted
    ? ` · ${e.background ? "in the background" : "in the foreground"}, last heard ${clock(Date.parse(e.at))} — interrupted: ${e.interrupted === "gone" ? `its process (pid ${e.pid}) ended without a word (killed, or the computer stopped)` : `nothing heard of it for ${FETCH_SILENT_MS / 60_000} min (pid ${e.pid})`}`
    : ` · ended ${clock(Date.parse(e.at))}${e.stopped ? ` — stopped: ${e.stopped}` : e.exitCode ? ` — exit ${e.exitCode}` : ""}`;
  const again = `strom fetch ${e.connector} ${shellArg(e.book)} --images ${imagesArg(e.missed)} --recordset ${e.recordset}${e.interrupted && e.background ? " --background" : ""}`;
  return `${e.recordset} (${e.connector} ${e.book}): ${e.registered.length}/${e.images.length} images registered${e.registered.length ? ` (images ${runs(e.registered)})` : ""}${how}${e.missed.length ? ` · not fetched: images ${runs(e.missed)} (${again}${e.interrupted ? " — what is registered is not fetched again" : ""})` : ""}`;
}

/** strom fetch --status: what is being fetched for this research now, and the fetches in the background that ended lately. */
function fetchStatus(ctx: Context, names: string[]): Result {
  const tree = ctx.tree();
  const ids = names.map((n) => requireRecord<RecordSet>(tree, n, "recordset").id);
  const pick = <T extends { recordset: string }>(xs: T[]) => (ids.length ? xs.filter((x) => ids.includes(x.recordset)) : xs);
  const active = pick(activeFetches(tree.root));
  // an interrupted one: what it registered as the research has it
  const has = (rs: string) => new Set(tree.list<Media>("media").filter((m) => m.recordset === rs && !m.part && !m.retracted && m.image !== undefined).map((m) => m.image!));
  const ended = pick(endedFetches(tree.root))
    .filter((e) => !active.some((m) => m.pid === e.pid))
    .map((e) => withRegistered(e, has(e.recordset)));
  return {
    text: lines(
      active.length ? ["being fetched:", ...active.map((m) => `  ${activeLine(m)}`)].join("\n") : "nothing is being fetched now",
      ended.length ? [`ended lately${ended.some((e) => !e.background) ? "" : " (in the background)"}:`, ...ended.slice(0, 10).map((e) => `  ${endedLine(e)}`)].join("\n") : undefined,
      active.some((m) => m.background) ? "read what came: strom read B… --images … (it waits for the rest) · stop: strom fetch --stop B…" : undefined,
    ),
    data: { active, ended },
  };
}

/** strom fetch --stop: the fetches in the background of these record sets (none: all) asked to stop; waits until they did. */
async function fetchStop(ctx: Context, names: string[]): Promise<Result> {
  const tree = ctx.tree();
  const ids = names.map((n) => requireRecord<RecordSet>(tree, n, "recordset").id);
  const mine = activeFetches(tree.root).filter((m) => m.background && (!ids.length || ids.includes(m.recordset)));
  if (!mine.length) return { text: `no fetch in the background${ids.length ? ` of ${ids.join(" ")}` : ""} — nothing to stop`, data: { stopped: [] } };
  for (const m of mine) askStop(tree.root, m.pid, "strom fetch --stop");
  const by = Date.now() + BACKGROUND_START_MS * 2;
  let left = mine;
  while (left.length && Date.now() < by) {
    await new Promise((r) => setTimeout(r, 200));
    // its mark goes before its process ends (found on Windows: a process ends slowly after it): stopped once both are
    const live = new Set(activeFetches(tree.root).map((m) => m.pid));
    left = left.filter((m) => live.has(m.pid) || processAlive(m.pid));
  }
  const ended = endedFetches(tree.root);
  const said = mine.filter((m) => !left.includes(m)).map((m) => ended.find((e) => e.pid === m.pid)).filter((e): e is EndedFetch => !!e);
  return {
    text: lines(
      ...said.map((e) => `stopped ${endedLine(e)}`),
      ...left.map((m) => `still stopping (it registers what came first): ${activeLine(m)} — strom fetch --status`),
    ),
    data: { stopped: said, stopping: left.map((m) => m.pid) },
  };
}

/** strom fetch, once the request is known: checked against the archive's terms, then through strom or the user's browser. */
async function fetchWith(ctx: Context, c: Connector, request: ConnectorRequest, recordset: string | undefined, noIndex = false, again = false, background?: { again?: string | undefined }, task?: string): Promise<Result> {
  const tree = ctx.tree();
  // strom fetch --background: the agent's command starts a strom of its own (the child), which fetches
  const child = request.cmd === "fetch" && recordset ? backgroundOf(ctx.env) : undefined;
  const owner = background && !child ? backgroundOwner(ctx, recordset, task) : undefined;
  // whose a fetch in the foreground is: the task it is for (its mark and its measure say it)
  const forTask = child ? child.task : owner ? owner.task : fetchTask(tree, currentSession(tree, ctx.env), recordset, task).task;
  const via = routeOf(ctx.env, c).via;
  const images = request.cmd === "fetch" || request.cmd === "part";
  const route = images && via === "browser" ? "browser" : "direct";
  const wanted = request.cmd === "part" ? String(request.image) : request.cmd === "fetch" ? imagesArg(request.images) : undefined;
  // what the archive's terms forbid is refused first (core/terms.ts): nothing at all, or no images — by hand
  const book = "book" in request ? String(request.book) : undefined;
  await gateArchive(ctx, c, { activity: images ? "images" : "catalogue", route, ...(wanted ? { images: wanted } : {}), ...(book ? { book } : {}), closedOnly: true });
  if (recordset && request.cmd === "fetch") {
    // what is registered already is not asked for again (a part of an image is not the image)
    // …unless its file is not here (a research handed over without its images): fetched again, put back
    const here = (m: Media) => fs.existsSync(path.join(shared(ctx), m.file));
    const have = new Set(tree.list<Media>("media").filter((m) => m.recordset === recordset && !m.part && m.image !== undefined && here(m)).map((m) => m.image));
    const asked = request.images;
    request.images = asked.filter((n) => !have.has(n));
    if (!request.images.length) return { text: `images ${runs(asked)} of ${recordset} are registered already — nothing fetched`, data: { added: [], again: asked } };
    // many images of a book to browse where an index of its parish is known and not searched for this: the index first
    guardIndexFirst(tree, {
      settings: ctx.settings,
      env: ctx.env,
      book: requireRecord<RecordSet>(tree, recordset, "recordset"),
      n: request.images.length,
      noIndex: noIndex,
      command: `strom fetch ${c.name} ${request.book} --images ${imagesArg(request.images)} --recordset ${recordset}`,
      say: (l) => ctx.io.stderr(l + "\n"),
    });
  }
  // an archive at a person's pace is never fetched in the background (its permission is for a person's pace, watched)
  if (background || child) {
    const slow = levelsOf(ctx, c, true).filter((a) => a.level !== "allowed");
    if (slow.length)
      // said as strom knows them: terms not known yet (a connector nobody confirmed) are not terms that restrict
      throw new StromError(`${slow.map((a) => `${a.title ?? a.host} (${levelText(a)}): ${a.termsUnknown ? "its terms are not known yet, taken as restricting automated access" : "its terms restrict automated access"}`).join("; ")} — images only at a person's pace, never in the background`, {
        hint: `fetch them in the foreground: strom fetch ${c.name} ${"book" in request ? shellArg(String(request.book)) : "<book>"}${wanted ? ` --images ${wanted}` : ""}${recordset ? ` --recordset ${recordset}` : ""} (without --background)`,
        code: "fetch.background.restricted",
      });
  }
  // images another strom is fetching for the book now are not asked for twice: a fetch in the foreground waits for them
  let joined: { images: number[]; by: ActiveFetch[] } | undefined;
  if (recordset && request.cmd === "fetch") {
    const others = activeFetches(tree.root, recordset).filter((m) => m.pid !== process.pid);
    const coming = new Set(others.flatMap((m) => m.images));
    const theirs = request.images.filter((n) => coming.has(n));
    if (theirs.length) {
      joined = { images: theirs, by: others.filter((m) => m.images.some((n) => theirs.includes(n))) };
      request.images = request.images.filter((n) => !coming.has(n));
      const said = `images ${runs(theirs)} of ${recordset} are being fetched already (${joined.by.map(fetchWhose).join("; ")})`;
      if (background || child) {
        if (!request.images.length) return { text: lines(said, `nothing fetched — strom read ${recordset} --images ${imagesArg(theirs)} reads them as they come; strom fetch --status`), data: { added: [], coming: theirs } };
        ctx.io.stderr(`  · ${said}: not fetched twice\n`);
      } else if (!request.images.length) return joinFetch(ctx, recordset, joined, said);
      else ctx.io.stderr(`  · ${said}: strom fetches the rest, then waits for them\n`);
    }
  }
  if (recordset && request.cmd === "part") {
    // what is here already of that place, as sharp as a new part could be: answered from it, no request
    const here = (m: Media) => fs.existsSync(path.join(shared(ctx), m.file));
    const all = tree.list<Media>("media");
    const held = partHere(all, c.name, recordset, request.image, request.region, here);
    if (held) return fromStore(ctx, c, request, recordset, held, via);
  }
  // the person's permission where the terms restrict automation (asked once; else the question waits in the menu)
  const gate = tree.dryRun ? { human: new Map<string, Pace>() } : await gateArchive(ctx, c, { activity: images ? "images" : "catalogue", route, ...(wanted ? { images: wanted } : {}), ...(book ? { book } : {}), reroute: !again });
  // the person chose the other way at its question (through the browser, or slowly straight through strom): the
  // connector's route follows it, and the fetch goes that way
  if ("rerouted" in gate && gate.rerouted) return fetchWith(ctx, c, request, recordset, noIndex, true, background, task);
  if (tree.dryRun) {
    // a dry run never contacts the archive, nor asks for consent
    const what =
      request.cmd === "find"
        ? `find the books of ${request.place}${request.years ? ` ${request.years}` : ""}`
        : request.cmd === "list"
          ? `describe book ${request.book}`
          : request.cmd === "part"
            ? `fetch part ${regionText(request.region)} of image ${request.image} of book ${request.book} as a part of ${recordset}:${request.image}`
            : `fetch images ${runs(request.images)} of book ${request.book}${recordset ? ` as images of ${recordset}` : " into the inbox"}`;
    const browser = via === "browser" && (request.cmd === "fetch" || request.cmd === "part");
    return { text: `dry run: would ${what} through ${c.name}${browser ? ", in your browser" : ""} — nothing was fetched`, data: { dryRun: true, request, recordset, via } };
  }
  if (via === "browser" && (request.cmd === "fetch" || request.cmd === "part")) return planBrowser(ctx, c, request, recordset, gate.human, "levels" in gate ? gate.levels : []);
  if (!(await ensureAllowed(ctx, c))) return { text: "not allowed — nothing was fetched", exitCode: 1 };
  if (!(await ensureLogin(ctx, c))) return { text: "no login — nothing was fetched", exitCode: 1 };
  if (request.cmd === "fetch") ctx.io.stderr(estimate(ctx, c, request.images.length, undefined, gate.human) + "\n");
  if (request.cmd === "part") ctx.io.stderr(estimate(ctx, c, 1, request.image, gate.human) + "\n");
  if (gate.human.size) ctx.io.stderr(`  · ${[...gate.human.keys()].join(", ")}: its terms restrict automated access — images at a person's pace, as the user allowed (strom allow archive)\n`);
  if (owner && request.cmd === "fetch" && recordset) return startBackground(ctx, c, request, recordset, owner, noIndex, background?.again);
  const workDir = path.join(tree.root, ".strom", "fetch", `${c.name}-${Date.now()}`);
  const t0 = Date.now();
  const pages = pagesOf(ctx, c);
  const meter = new FetchMeter();
  const count = imageCount(ctx, request.cmd === "fetch" ? request.images.length : 0);
  const waits = limitWait(ctx);
  const from = (f: string) => `connector ${c.name} · ${path.basename(f)}`;
  // the images of a book registered as they come, in batches: a reader of the book begins on the first ones
  const batches = request.cmd === "fetch" && recordset ? fetchBatches(ctx, c, request, recordset, from, child, forTask, workDir) : undefined;
  let endCode: number | undefined;
  try {
    const r = await runConnector(c, request, {
      env: ctx.env,
      workDir,
      netDir: netDir(ctx),
      onLog: (l) => count.say(`  · ${l}\n`),
      onImage: (n, im) => (count.got(n), batches?.took(im)),
      waitMs: waits.waitMs,
      onWait: (w) => (count.clear(), batches?.waiting(w.until), waits.onWait(w)),
      ...metered(meter),
      ...(pages ? { pages } : {}),
      ...pacing(ctx, c, gate.human),
      ...netWords(ctx, c, "levels" in gate ? gate.levels : []),
      ...(batches ? { signal: batches.signal } : {}),
      ...(child ? { background: true, onYield: (w: boolean) => batches?.yielding(w) } : {}),
    });
    count.clear();
    refusalSaid(ctx, c, r.refused);
    // what the agent does after a refusal: another way first, the person's check only when the source stays necessary
    const advice = r.refused ? refusalAdvice(ctx, c, r.refused, request.cmd === "find" ? request.place : undefined) : undefined;
    // a host near its hourly cap: said to the agent, and to the person once at each share reached
    const near = capSaid(ctx, c, new Map([...meter.hosts].map(([h, l]) => [h, l.requests])), gate.human);
    // what it asked of the archive (a part's gain once it is registered, below)
    const asked = request.cmd === "fetch" ? { asked: request.images } : request.cmd === "part" ? { img: request.image, part: request.region } : {};
    const run = { via, cmd: request.cmd, ...("book" in request ? { book: request.book } : {}), ...(recordset ? { rs: recordset } : {}), ...asked, ...(child ? { bg: true } : {}), ...(forTask ? { task: forTask } : {}) };
    if (request.cmd !== "part") measure(ctx, c, meter, run, r);
    if (r.needs) {
      fs.rmSync(workDir, { recursive: true, force: true });
      if (request.cmd === "part") measure(ctx, c, meter, run, r);
      return planPages(ctx, c, r.needs, { cmd: "fetch", request: { ...request }, ...(recordset ? { recordset } : {}) }, `strom fetch ${c.name} (${request.cmd})`, lines(describeRun(r, request.cmd), near));
    }
    const took = `${Math.round((Date.now() - t0) / 1000)} s`;
    if (request.cmd === "find" || request.cmd === "list") {
      fs.rmSync(workDir, { recursive: true, force: true });
      const wait = later(r, "the same command", undefined, { session: !child && !!currentSession(tree, ctx.env), run: deadlineOf(ctx.env) !== undefined });
      return {
        text: lines(describeRun(r, `${request.cmd} (${took})`), r.books.length ? [`books (${r.books.length}):`, ...bookLines(r, c, `strom fetch ${c.name} <id> --list`, tree)].join("\n") : advice ?? (r.stopped ? "no books — the run stopped before any came" : "no books found"), r.books.length ? advice : undefined, wait.line, near),
        data: { ...r, ...wait.data },
        ...(wait.exitCode ? { exitCode: wait.exitCode } : r.stopped && !r.books.length ? { exitCode: 1 } : {}),
      };
    }
    const fetched = { connector: c.name, book: request.book };
    let text: string;
    let data: Record<string, unknown> = { ...r };
    if (request.cmd === "part") {
      const res = registerImages(tree, shared(ctx), r.images.map((i) => ({ file: i.file, image: i.n, url: i.url, from: from(i.file), part: i.region, fetched })), recordset);
      fs.rmSync(workDir, { recursive: true, force: true });
      const m = res.added[0];
      const whole = recordset ? findImage(tree.list<Media>("media").filter((x) => !x.part), recordset, request.image) : undefined;
      const gain = m?.width && m.part && whole?.width ? m.width / m.part.w / whole.width : undefined;
      measure(ctx, c, meter, { ...run, ...(gain !== undefined ? { gain: Math.round(gain * 100) / 100, ...(gain < SHARPER ? { noSharper: true } : {}) } : {}), ...(m ? { media: [m.id] } : {}) }, r);
      text = m
        ? lines(
            `part ${regionText(m.part!)} of image ${request.image} of ${recordset} fetched and registered: ${m.id}${m.width ? ` · ${m.width}×${m.height} px` : ""}${gain ? ` · ${gain.toFixed(1)}× the detail of the whole image` : ""} · ${took}`,
            gain !== undefined && gain < SHARPER ? "  no sharper than the whole image: the portal gives no more detail than that" : undefined,
            `look at it: strom media view ${recordset}:${request.image} --crop ${regionText(m.part!)} (a view of the image uses the part by itself)`,
          )
        : res.again.length && whole && res.again.includes(whole.id) && r.images.every((i) => isWhole(i.region))
          ? lines(
              `the portal's sharpest of image ${request.image} is the whole scan, registered already: ${whole.id}${whole.width ? ` · ${whole.width}×${whole.height} px` : ""} — no part needed`,
              `look at it: strom media view ${recordset}:${request.image} --crop ${regionText(request.region)}`,
            )
          : res.restored.length
          ? `part ${regionText(request.region)} of image ${request.image} of ${recordset} fetched again and put back (its file was not here; the same scan): ${res.restored.join(" ")} · ${took}`
          : res.again.length
          ? lines(`that part is registered already: ${res.again.join(" ")}`, ...res.clashes.map((x) => `⚠ ${x}`))
          : "no part fetched";
      data = { ...data, added: res.added.map((x) => ({ id: x.id, image: x.image, part: x.part })), again: res.again };
    } else if (recordset && batches && (r.images.length || batches.registered() || batches.interrupted())) {
      const res = batches.finish(r.images);
      // an image an earlier batch registered and a later one found to be a placeholder is no image fetched
      const added = res.added.filter((m) => !res.withdrawn.includes(m.id));
      const nums = added.map((m) => m.image).filter((n): n is number => n !== undefined);
      // what it asked for and did not get (the person's Ctrl-C): said exactly, the same command fetches it
      const got = new Set([...r.images.map((i) => i.n), ...tree.list<Media>("media").filter((m) => m.recordset === recordset && !m.part && !m.retracted).map((m) => m.image)]);
      const missed = request.cmd === "fetch" && (batches.interrupted() || child) ? request.images.filter((n) => !got.has(n)) : [];
      const stopped = batches.stopped();
      text = lines(
        added.length || !res.restored.length ? `${counted(added.length, "image")} of ${recordset}${nums.length ? ` (images ${runs(nums)})` : ""} fetched and registered · ${took}` : undefined,
        res.restored.length ? `${counted(res.restored.length, "image")} of ${recordset} fetched again and put back (their file was not here; the same scan): ${res.restored.slice(0, 5).join(" ")}${res.restored.length > 5 ? " …" : ""} · ${took}` : undefined,
        res.again.length ? `${res.again.length} already registered` : undefined,
        ...res.clashes.slice(0, 10).map((x) => `⚠ ${x}`),
        res.withdrawn.length ? `withdrawn again (the portal gave the same file for a later image — a placeholder, not a scan): ${res.withdrawn.join(" ")}` : undefined,
        missed.length ? `${stopped ? `stopped (${stopped})` : batches.interrupted() ? "interrupted" : "not fetched"}: images ${runs(missed)} not fetched — the same command fetches them (what is here is not asked for again)` : undefined,
        res.woken.length ? `back in the queue (they waited for these images): ${res.woken.join(" ")}` : undefined,
      );
      data = { ...data, added: added.map((m) => ({ id: m.id, image: m.image })), again: res.again, restored: res.restored, woken: res.woken, clashes: res.clashes, ...(res.withdrawn.length ? { withdrawn: res.withdrawn } : {}), ...(missed.length ? { interrupted: batches.interrupted(), missed } : {}), ...(stopped ? { stopped } : {}) };
      fs.rmSync(workDir, { recursive: true, force: true });
    } else if (r.images.length) {
      // into the inbox, one folder for the book: the usual way from there
      const folder = `${c.name} ${String(request.book).replace(/[^\p{L}\p{M}\p{N}._-]+/gu, "_")}`;
      const inbox = path.join(shared(ctx), "inbox", folder);
      fs.mkdirSync(inbox, { recursive: true });
      for (const i of r.images) fs.renameSync(i.file, path.join(inbox, path.basename(i.file)));
      fs.rmSync(workDir, { recursive: true, force: true });
      text = lines(`${counted(r.images.length, "image")} fetched into the inbox: ${folder}/ · ${took}`, `register them: strom media add --inbox ${shellArg(folder)} --recordset B…`);
      data = { ...data, inbox: folder };
    } else {
      fs.rmSync(workDir, { recursive: true, force: true });
      text = "no images fetched";
    }
    // the images it got are registered; the rest when the archive takes requests again
    const again = request.cmd === "fetch" ? `strom fetch ${c.name} ${shellArg(String(request.book))} --images ${imagesArg(request.images)}${recordset ? ` --recordset ${recordset}` : ""}` : undefined;
    const inSession = !child && !!currentSession(tree, ctx.env);
    const wait = later(r, again ? `${again} — what is here already is not fetched again` : "the same command", again && recordset && inSession ? again : undefined, { session: inSession, run: deadlineOf(ctx.env) !== undefined });
    // images another strom was fetching: waited for once this one's are here (the foreground)
    const after = joined && !batches?.interrupted() && recordset ? await joinFetch(ctx, recordset, joined, `images ${runs(joined.images)} of ${recordset}: the other fetch`) : undefined;
    const code = wait.exitCode ? wait.exitCode : batches?.stopped() ? 0 : batches?.interrupted() ? EXIT.cancelled : r.stopped && !r.images.length ? 1 : after?.exitCode;
    endCode = code ?? 0;
    return { text: lines(describeRun(r, request.cmd), text, advice, wait.line, near, after?.text), data: { ...data, ...wait.data, ...(after ? { joined: after.data } : {}) }, ...(code ? { exitCode: code } : {}) };
  } finally {
    // a fetch in the background says how it ended (strom fetch --status, the next brief) before its mark goes
    if (child && recordset && request.cmd === "fetch") {
      const asked = request.images;
      tree.reread();
      const have = new Set(tree.list<Media>("media").filter((m) => m.recordset === recordset && !m.part && !m.retracted).map((m) => m.image));
      const stopped = batches?.stopped();
      markEnded(tree.root, {
        pid: process.pid,
        recordset,
        connector: c.name,
        book: String(request.book),
        images: asked,
        registered: asked.filter((n) => have.has(n)),
        missed: asked.filter((n) => !have.has(n)),
        ...(stopped ? { stopped } : {}),
        background: true,
        at: new Date().toISOString(),
        since: new Date(t0).toISOString(),
        session: child.session,
        ...(child.task ? { task: child.task } : {}),
        exitCode: endCode ?? 1,
      });
    }
    batches?.end();
  }
}

/** A fetch of fewer images says nothing as they come: at the archive's pace it is over soon, its end says it all. */
const COUNT_FROM_TTY = 10;
/** Where nobody watches, a line at each tenth: from this many images on a tenth is more than one image. */
const COUNT_FROM = 20;

/**
 * The images of a long fetch counted as they come ("40/109 images", in the research language), where its output said
 * nothing until the end. At a terminal one line written over after each image and cleared before anything else is
 * said, so nothing of it stays. Where nobody watches it — an agent reads the output, often only when the command ends,
 * or a log keeps it — a line at each tenth of the images: at most 9 whatever the count (an agent pays for each line it
 * reads, a line per image of a book of hundreds would bury the rest), counted, not timed, so the same fetch always
 * says the same; the archive's pace makes each tenth a while anyway. The last image says nothing: the summary follows.
 * On stderr — stdout carries the result, with --json nothing but it. An agent's (its fetch, its log in the background) in English.
 * Counted from what strom took in: it asks the archive nothing and changes no pace.
 */
function imageCount(ctx: Context, total: number): { got: (n: number) => void; say: (s: string) => void; clear: () => void } {
  const tty = ctx.io.tty;
  const on = total >= (tty ? COUNT_FROM_TTY : COUNT_FROM);
  // what an agent reads is English, as the rest of the output: a fetch it runs, and one in the background writing
  // into its log (strom fetch --status, its tail); a fetch a person runs in the research language, for them to follow
  const lang = backgroundOf(ctx.env) || isAgent(ctx.env) ? "en" : ctx.uiLang();
  const text = (n: number) => ui(lang, "ui.fetch.progress", { n, total });
  let shown = 0; // the length of the line written over (a terminal)
  let tenth = 0; // the last tenth said (no terminal)
  const clear = () => {
    if (!shown) return;
    ctx.io.stderr(`\r${" ".repeat(shown)}\r`);
    shown = 0;
  };
  return {
    got: (n) => {
      if (!on || n >= total) return;
      if (tty) {
        const t = text(n);
        ctx.io.stderr(`\r${t}${" ".repeat(Math.max(0, shown - t.length))}`);
        shown = Math.max(shown, t.length);
        return;
      }
      const now = Math.floor((n * 10) / total);
      if (now <= tenth) return;
      tenth = now;
      ctx.io.stderr(`  · ${text(n)}\n`);
    },
    say: (s) => (clear(), ctx.io.stderr(s)),
    clear,
  };
}

async function planBrowser(ctx: Context, c: Connector, request: Extract<ConnectorRequest, { cmd: "fetch" | "part" }>, recordset: string | undefined, human: Map<string, Pace> = new Map(), levels: ArchiveLevel[] = []): Promise<Result> {
  const tree = ctx.tree();
  if (!c.manifest.can.includes("locate")) throw new UsageError(`connector ${c.name} cannot say where its images are (can: locate) — the browser has no addresses to fetch`, { hint: `strom connector use ${c.name} --via direct` });
  if (!(await ensureAllowed(ctx, c))) return { text: "not allowed — nothing was planned", exitCode: 1 };
  const pace = connectorPace(ctx, c, human);
  const part = request.cmd === "part";
  const asked = part ? [request.image] : request.images;
  // one script waits at most SCRIPT_MS: as many images as fit in it, the rest next time
  const batch = asked.slice(0, Math.max(1, Math.floor(SCRIPT_MS / pace.minIntervalMs)));
  const workDir = path.join(tree.root, ".strom", "fetch", `${c.name}-${Date.now()}`);
  const pages = pagesOf(ctx, c);
  const meter = new FetchMeter();
  const r = await runConnector(c, { cmd: "locate", book: request.book, images: batch, ...(part ? { region: request.region } : {}) }, { env: ctx.env, workDir, netDir: netDir(ctx), onLog: (l) => ctx.io.stderr(`  · ${l}\n`), ...limitWait(ctx), ...metered(meter), ...(pages ? { pages } : {}), ...pacing(ctx, c, human), ...netWords(ctx, c, levels) });
  refusalSaid(ctx, c, r.refused);
  measure(ctx, c, meter, { via: "browser", cmd: "locate", book: request.book, ...(recordset ? { rs: recordset } : {}), ...(part ? { img: request.image, part: request.region } : { asked: batch }) }, r);
  fs.rmSync(workDir, { recursive: true, force: true });
  if (r.needs) return planPages(ctx, c, r.needs, { cmd: "fetch", request: { ...request }, ...(recordset ? { recordset } : {}) }, `strom fetch ${c.name} (${request.cmd} of book ${request.book})`, describeRun(r, "locate"));
  if (!r.located.length) return { text: lines(describeRun(r, "locate"), r.refused ? refusalAdvice(ctx, c, r.refused) : "no image located — nothing planned"), data: r, exitCode: 1 };
  // one site at a time: the script fetches from the page it runs on
  const first = new URL(r.located[0]!.src);
  const here = batch.map((n) => r.located.find((l) => l.n === n && new URL(l.src).origin === first.origin)).filter((l) => l !== undefined);
  const open = c.manifest.browser?.open && new URL(c.manifest.browser.open).origin === first.origin ? c.manifest.browser.open : `${first.origin}/robots.txt`;
  let times: number[];
  try {
    const hp = human.get(keyHost(c, first.hostname));
    times = reserveSlots(netDir(ctx), first.hostname, hp ? latchedPace(ctx.env, c, keyHost(c, first.hostname)) : c.manifest.policy.pace, here.length + 1, hp ? { human: hp } : {});
  } catch (err) {
    if (!(err instanceof NetError)) throw err;
    return { text: lines(describeRun(r, "locate"), `nothing planned: ${err.message}`), data: r, exitCode: err.failure === "cap" && err.until !== undefined ? EXIT.later : 1 };
  }
  // the times kept for the browser count in the host's hour as strom's own requests: near its cap, said
  const byHost = new Map([...meter.hosts].map(([h, l]) => [h, l.requests]));
  byHost.set(first.hostname, (byHost.get(first.hostname) ?? 0) + times.length);
  const near = capSaid(ctx, c, byHost, human);
  const items: PlanItem[] = here
    .slice(0, times.length - 1)
    .map((l, i) => ({ n: l.n, src: l.src, url: l.url ?? l.src, ...(l.page ? { page: l.page } : {}), ...(l.region ? { region: l.region } : {}), file: fileBase(c.name, request.book, l.n, part), at: times[i + 1]! }))
    .filter((it, i) => i === 0 || it.at - times[1]! <= SCRIPT_MS);
  const now = Date.now();
  const plan: BrowserPlan = { id: `${c.name}-${now}`, connector: c.name, book: request.book, ...(recordset ? { recordset } : {}), open, origin: first.origin, host: first.hostname, gap: times.length > 1 ? times[1]! - times[0]! : pace.minIntervalMs, created: now, until: now + PLAN_TTL_MS, items };
  // an image planned again replaces its older plan
  for (const old of loadPlans(tree.root, c.name)) {
    const left = old.items.filter((i) => !(old.book === plan.book && items.some((x) => x.file === i.file)));
    if (left.length === old.items.length) continue;
    if (left.length) savePlan(tree.root, { ...old, items: left });
    else removePlan(tree.root, old.id);
  }
  savePlan(tree.root, plan);
  const script = planScript(plan);
  const rest = asked.filter((n) => !items.some((i) => i.n === n));
  const secs = Math.max(1, Math.round((items.at(-1)!.at - now) / 1000));
  const take = `strom fetch ${c.name} --take --result "<the line it returned>"`;
  const shown = `${items[0]!.file}.jpg${items.length > 1 ? " …" : ""}`;
  return {
    text: lines(
      describeRun(r, "locate"),
      `browser plan: ${part ? `part ${regionText(request.region)} of image ${request.image}` : `${counted(items.length, "image")} (${runs(items.map((i) => i.n))})`} of book ${request.book} through your browser — about ${secs} s at the pace of ${first.hostname}`,
      `1. Open a new tab of your own at ${open}${open.endsWith("/robots.txt") ? " — a light page of the site: the script fetches the images from there" : ""}.`,
      '   The browser not connected, a login or a captcha on the way: stop and ask the user (strom task wait T… --on "…") — that is theirs to do.',
      "   (Not connected: Chrome must be running with the Claude extension; after a change of network the extension may need a click on its icon, or Chrome a restart.)",
      "2. Run this in that tab with the JavaScript tool, exactly as it is — it waits between the images by itself:",
      "",
      script,
      "",
      `3. Then: ${take}`,
      `The browser saves them into ${ctx.display(ctx.settings.downloads())} as ${shown} — strom takes them over; do not open, move or read them yourself.`,
      `The first time, Chrome asks whether ${first.hostname} may download several files: the user allows it once (at the right end of the address bar).`,
      rest.length ? `The rest (images ${runs(rest)}): the same strom fetch again, after the take.` : undefined,
      near,
    ),
    data: { ...r, plan: { id: plan.id, open, host: plan.host, items: items.map((i) => ({ n: i.n, src: i.src, file: i.file, at: new Date(i.at).toISOString() })) }, script, take, rest },
  };
}

/** What the browser downloaded: taken over from the downloads folder, checked, registered (or put into the inbox). */
async function takeOver(ctx: Context, c: Connector, result: string | undefined): Promise<Result> {
  const tree = ctx.tree();
  const all = loadPlans(tree.root, c.name);
  const dir = ctx.settings.downloads();
  const got = parseResult(result ?? "");
  // pages for the connector first: what they were planned for goes on — unless the browser saved images
  // and none of those pages (a page planned in a run given up must not hold back what did arrive)
  const pagePlans = all.filter((p) => p.pages?.length);
  const pagesHere = got.some((g) => g.page) || pagePlans.some((p) => p.pages!.some((pg) => findDownload(dir, pg.file).file));
  const imagesHere = all.some((p) => p.items.some((i) => findDownload(dir, i.file).file));
  // a plan made before (another strom, the terms since known): taken over only as the archive's terms let it now (D12)
  if (all.length && !tree.dryRun) await gateArchive(ctx, c, { activity: pagePlans.length && (pagesHere || !imagesHere) ? "catalogue" : "images", route: "browser", ask: false });
  if (pagePlans.length && !tree.dryRun && (pagesHere || !imagesHere)) return takePages(ctx, c, pagePlans, result);
  const plans = all.filter((p) => p.items.length);
  if (!plans.length) return { text: `nothing of ${c.name} waits to be taken over — plan it first: strom fetch ${c.name} <book> --images <from-to> --recordset B…`, data: { taken: [] } };
  if (tree.dryRun) {
    const found = plans.flatMap((p) => p.items.filter((i) => findDownload(dir, i.file).file));
    return { text: `dry run: would take over ${found.length} of ${counted(plans.reduce((n, p) => n + p.items.length, 0), "planned image")} from ${ctx.display(dir)} — nothing was changed`, data: { dryRun: true, found: found.map((i) => i.n) } };
  }
  const notes: string[] = [];
  // what the archive said to the browser counts as if it had said it to strom
  for (const g of got) {
    const plan = plans.find((p) => p.items.some((i) => i.n === g.n)) ?? plans.at(-1)!;
    if (g.failed) notes.push(`image ${g.n}: the browser could not fetch it — no answer, or the site does not let this page fetch it`);
    else if (g.status && g.status >= 400) notes.push(refusedBy(netDir(ctx), plan.host, g.status) ?? `image ${g.n}: HTTP ${g.status}`);
  }
  const taken: { plan: BrowserPlan; item: PlanItem; file: string; others: string[] }[] = [];
  const missing: { plan: BrowserPlan; item: PlanItem; unfinished: boolean }[] = [];
  for (const plan of plans)
    for (const item of plan.items) {
      const f = findDownload(dir, item.file);
      if (!f.file) {
        missing.push({ plan, item, unfinished: !!f.unfinished });
        continue;
      }
      const problem = imageProblem(f.file, item.region ? "part" : "whole");
      if (problem) {
        // a broken download of strom's own name: gone, so that the next one gets the name
        for (const x of [f.file, ...f.others]) fs.rmSync(x, { force: true });
        notes.push(`image ${item.n} (${path.basename(f.file)}): ${problem} — removed; plan it again`);
        missing.push({ plan, item, unfinished: false });
        continue;
      }
      taken.push({ plan, item, file: f.file, others: f.others });
    }
  const added: { id: string; image?: number }[] = [];
  const again: string[] = [];
  const woken: string[] = [];
  const inboxed: string[] = [];
  for (const plan of plans) {
    const mine = taken.filter((t) => t.plan === plan);
    if (!mine.length) continue;
    const fetched = { connector: c.name, book: plan.book, via: "browser" as const };
    if (plan.recordset) {
      const res = registerImages(tree, shared(ctx), mine.map((t) => ({ file: t.file, image: t.item.n, url: t.item.url, from: `connector ${c.name} · your browser · ${path.basename(t.file)}`, part: t.item.region, fetched })), plan.recordset);
      added.push(...res.added.map((m) => ({ id: m.id, ...(m.image !== undefined ? { image: m.image } : {}) })));
      again.push(...res.again, ...res.restored);
      notes.push(...res.clashes);
      woken.push(...res.woken);
      for (const t of mine) for (const x of [t.file, ...t.others]) fs.rmSync(x, { force: true });
    } else {
      // into the inbox, one folder for the book, as a direct fetch does
      const folder = `${c.name} ${String(plan.book).replace(/[^\p{L}\p{M}\p{N}._-]+/gu, "_")}`;
      const inbox = path.join(shared(ctx), "inbox", folder);
      fs.mkdirSync(inbox, { recursive: true });
      for (const t of mine) {
        const to = path.join(inbox, `s${String(t.item.n).padStart(4, "0")}${path.extname(t.file).toLowerCase()}`);
        fs.copyFileSync(t.file, to);
        for (const x of [t.file, ...t.others]) fs.rmSync(x, { force: true });
      }
      inboxed.push(folder);
    }
    const left = plan.items.filter((i) => !mine.some((t) => t.item === i));
    if (left.length) savePlan(tree.root, { ...plan, items: left });
    else removePlan(tree.root, plan.id);
  }
  // what the user's browser asked of the archive for each plan (one request an image), for the measure of the load
  for (const plan of plans) {
    const mine = taken.filter((t) => t.plan === plan).map((t) => t.item.n);
    const told = got.filter((g) => plan.items.some((i) => i.n === g.n)).length;
    const n = Math.max(told, mine.length);
    if (!n) continue;
    const meter = new FetchMeter();
    for (let i = 0; i < n; i++) meter.request(plan.host);
    measure(ctx, c, meter, { via: "browser", cmd: "take", book: plan.book, ...(plan.recordset ? { rs: plan.recordset } : {}), requests: n, got: mine, result: "ok" });
  }
  const fetchedOk = new Set(got.filter((g) => g.status === 200).map((g) => g.n));
  const lost = missing.filter((m) => fetchedOk.has(m.item.n) && !m.unfinished);
  const notYet = missing.filter((m) => !fetchedOk.has(m.item.n) || m.unfinished);
  const nums = (xs: { item: PlanItem }[]) => runs(xs.map((x) => x.item.n));
  return {
    text: lines(
      taken.length
        ? `${counted(taken.length, "image")} taken over from ${ctx.display(dir)}${added.length ? `: registered ${added.map((a) => a.id).join(" ")}` : ""}${inboxed.length ? ` into the inbox: ${[...new Set(inboxed)].join(", ")}/ — register them: strom media add --inbox ${shellArg(inboxed[0]!)} --recordset B…` : ""}`
        : `nothing taken over from ${ctx.display(dir)}`,
      again.length ? `  already registered: ${again.join(" ")}` : undefined,
      woken.length ? `  back in the queue (they waited for these images): ${woken.join(" ")}` : undefined,
      ...notes.map((n) => `  ⚠ ${n}`),
      lost.length
        ? `  images ${nums(lost)}: the browser fetched them but saved nothing here — Chrome lets a site download one file until the user allows automatic downloads for it (at the right end of the address bar), or it asks where to save each file (Settings → Downloads). Then plan them again: strom fetch ${c.name} ${lost[0]!.plan.book} --images ${nums(lost)}${lost[0]!.plan.recordset ? ` --recordset ${lost[0]!.plan.recordset}` : ""}`
        : undefined,
      notYet.length ? `  still waiting for images ${nums(notYet)}${notYet.some((m) => m.unfinished) ? " (a download is still running)" : ""} — run the script of their plan, or they went elsewhere: strom config set browser.downloads <folder>` : undefined,
    ),
    data: { taken: taken.map((t) => ({ n: t.item.n, file: t.file })), added, again, woken, inbox: [...new Set(inboxed)], missing: missing.map((m) => m.item.n), notes },
    ...(!taken.length && missing.length ? { exitCode: 1 } : {}),
  };
}

/** The fields of a saved login, in the order the connector asks for them. */
function fieldsOf(values: Record<string, string>, c?: Connector): string[] {
  const order = Object.keys(c?.manifest.login?.fields ?? {});
  return Object.keys(values).sort((a, b) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99));
}

function loginState(ctx: Context, c: Connector): string {
  const l = loginOf(ctx.env, c);
  if (l) return `saved ${l.at.slice(0, 10)} (${fieldsOf(l.values, c).join(", ")})`;
  return c.manifest.login?.required ? `needed, none saved — the user saves it: strom login ${c.name}` : `none — the user may save one: strom login ${c.name}`;
}

/** A connector that cannot work without the user's login: the user, on a terminal, types it in right here. */
async function ensureLogin(ctx: Context, c: Connector): Promise<boolean> {
  if (!c.manifest.login?.required || loginOf(ctx.env, c)) return true;
  ctx.requireHuman(`Connector ${c.name} needs your login to ${c.manifest.title} (${c.manifest.login.about}) — save it?`, `strom login ${c.name}`, `login:${c.name}`, undefined, { window: false });
  return askLogin(ctx, c);
}

/** The user types in their login: shown what it is for and where it goes first; hidden fields are not shown as typed. */
async function askLogin(ctx: Context, c: Connector): Promise<boolean> {
  const l = c.manifest.login!;
  ctx.io.stdout(
    lines(
      "",
      `Your login to ${c.manifest.title}, for connector ${c.name}`,
      `  · what it gives: ${l.about}${l.url ? `\n  · an account: ${l.url}` : ""}`,
      `  · kept on this computer only, readable by you alone (${ctx.display(loginsFile(ctx.env))}) — never in a tree, the shared folder or git`,
      `  · strom puts it into the connector's requests itself, only to ${c.manifest.hosts.map(bareHost).join(", ")} and only over https;`,
      "    the connector's code never sees it, nor does your agent",
      "",
    ) + "\n",
  );
  const values: Record<string, string> = {};
  for (const [field, label] of Object.entries(l.fields)) {
    const v = VISIBLE_FIELDS.has(field) ? await ctx.ask(`${label}:`) : await ctx.askSecret(`${label} (not shown):`);
    if (!v) {
      ctx.io.stdout("nothing typed — nothing saved\n");
      return false;
    }
    values[field] = v; // as typed: a password is compared byte for byte
  }
  saveLogin(ctx.env, c.name, { dir: c.dir, hosts: c.manifest.hosts.map(bareHost), values, at: new Date().toISOString() });
  return true;
}

function requestOf(opts: Record<string, unknown>, test: boolean): ConnectorRequest {
  if (opts.find) return { cmd: "find", place: String(opts.find).normalize("NFC"), ...(opts.years ? { years: String(opts.years) } : {}) };
  if (test && opts.list) return { cmd: "list", book: String(opts.list) };
  if (test && opts.fetch && (opts.crop !== undefined || opts.half !== undefined)) {
    const images = parseImages(opts.images, 1) ?? [1];
    return { cmd: "part", book: String(opts.fetch), image: images[0]!, region: partRegion(opts) };
  }
  if (test && opts.fetch) return { cmd: "fetch", book: String(opts.fetch), images: parseImages(opts.images, 10) ?? [1] };
  if (test && opts.locate) {
    const part = opts.crop !== undefined || opts.half !== undefined;
    return { cmd: "locate", book: String(opts.locate), images: parseImages(opts.images, part ? 1 : 10) ?? [1], ...(part ? { region: partRegion(opts) } : {}) };
  }
  throw new UsageError(test ? "what to try: --find <place>, --list <book>, --fetch <book> --images 1-2 or --locate <book> --images 1-2" : "give a book, or --find <place>");
}

/** A search pattern, found in any case: the text as it is, or a regular expression. */
function grepPattern(p: string, regex: boolean): RegExp {
  // as typed, composed or not; a space is any white space (a page's "Kniha&nbsp;26" reads with one)
  const text = (t: string) =>
    t.trim().split(/\s+/u).map((w) => w.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")).join("\\s+");
  if (!regex) return new RegExp([...new Set([p.normalize("NFC"), p.normalize("NFD")])].map(text).join("|"), "giu");
  try {
    return new RegExp(p, "gi");
  } catch (e) {
    throw new UsageError(`not a regular expression: ${p} — ${(e as Error).message}`);
  }
}

/** The saved files of a connector's .test folder that hold text (not images, not strom's own dotfiles). */
function textFiles(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (e.name.startsWith(".")) continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile() && fs.statSync(p).size <= 50 * 1024 * 1024) {
        const fd = fs.openSync(p, "r");
        const head = Buffer.alloc(4096);
        const n = fs.readSync(fd, head, 0, head.length, 0);
        fs.closeSync(fd);
        if (!head.subarray(0, n).includes(0)) out.push(p);
      }
    }
  };
  walk(dir);
  return out;
}

/**
 * What the person is told of the archives this tree reaches through their browser, for the agent that works: only
 * Claude Code has browser tools (Claude in Chrome), and the extension must be in a browser here. Nothing to say: undefined.
 */
export function browserNote(ctx: Context, tree: Tree, agent: string): string | undefined {
  const via = treeBrowserConnectors(tree, ctx.settings.shared()?.value);
  if (!via.length) return undefined;
  const lang = ctx.uiLang();
  const names = via.map((c) => c.manifest.title ?? c.name).join(", ");
  if (agent !== "claude") return ui(lang, "ui.browser.agent", { names, agent: PROFILES[agent]?.name ?? agent });
  const found = claudeInChrome(ctx.env).extension;
  return found.length ? undefined : ui(lang, "ui.browser.noext", { names, url: CLAUDE_IN_CHROME_URL });
}

/** Through the browser: what stands in the way here (English, for the agent — which tells the user). */
function browserWarnings(ctx: Context): string[] {
  const agent = ctx.settings.agent(ctx.hasTree() ? ctx.tree().config : undefined).value;
  if (agent !== "claude")
    return [`  ⚠ only Claude Code has browser tools (Claude in Chrome); this research's agent is ${PROFILES[agent]?.name ?? agent} — tell the user: they save these images by hand, or choose Claude Code (strom agents use claude)`];
  return claudeInChrome(ctx.env).extension.length ? [] : [`  ⚠ the Claude in Chrome extension is in no browser here — tell the user to install it and sign in: ${CLAUDE_IN_CHROME_URL}`];
}
