// An agent's own web tools (Claude Code's WebFetch and WebSearch, Grok's web_fetch and web_search), kept like a person
// on the web: searching stays the agent's judgement, fetching much from one server goes through a connector. The tree's
// agent settings run `strom net web --hook` before each of those calls (agents/files.ts); it reads the agent's hook
// event on stdin and answers it:
//
//   - each request is recorded in .strom/metrics/fetch.jsonl (via "web" with its host, via "search"), with the session,
//     the agent and model — the same journal the connectors' runs go to;
//   - a fetch is counted in the host's shared hour (core/net.ts: a cap of the user's or of a connector's service covers
//     it) and waits for the host's pace first, as strom's own requests do;
//   - refused, in a conversation and in a run alike, while the host is left alone (it refused or went silent), while it
//     says its limit is used up, or its hourly cap is full;
//   - over web.perHost requests (WEB_PER_HOST unless the person set it) to one site in one session — its registrable
//     domain (metrics.ts webDomain: a server's mirrors and API hosts count together; the pace stays the exact host's),
//     the same number for every site, no list of archives —
//     refused in a run nobody watches (more pages or items of one server go through strom fetch with a connector), and
//     in a conversation the person is asked (in the research language, impersonal) once per site and session — never
//     a series of questions: their yes stands for the site (counted and paced still; a stopped host or a full cap
//     refused hard), their no too (refused, with the way on), and while the question waits another call is refused.
//     An asked call is recorded as asked and counted only once it went out: the same hook runs after a web fetch ran
//     (PostToolUse, PostToolUseFailure) and counts it then, in the session and the host's hour — that is the yes; one
//     the person refused never ran — never counted, recorded as their no.
//
//   - many calls at once are no way round either: each one reserves its slot of the host's pace in a moment under the
//     host's lock (counted in the session and the hour then), and waits for it with the lock let go — the wait for the
//     lock and for the slot together within WEB_WAIT_MAX_MS. A slot later than that, or the host's lock not had in it
//     (strom's own request to it, a strom fetch, a crowd of the agent's): refused in a run (one request at a time, a
//     person's pace); in a conversation let go at the end of its wait, counted — the person is never asked for the pace
//     or another request under way, only past web.perHost. Past the soft threshold the site's slower pace holds in a
//     conversation too: a call it cannot take in time is refused as one of many at once (nothing asked).
//
// The hook never stands in the way by itself: anything wrong (no tree, no strom, a line it cannot read) lets the call go
// without a word. Waiting for its turn at a host is no error. It fetches nothing itself, robots.txt neither.

import fs from "node:fs";
import path from "node:path";
import { agentRequest, clock, hostAllowed, type AgentSlot, type HostRefusal } from "./net.ts";
import { LockedError } from "./errors.ts";
import { metricsDir, PUBLIC_SECOND_LEVEL, recordWebRequest, webDomain, webHost, webHourOf, webRequestsOf, metricsOn, WEB_PER_HOST, WEB_SAID_NO, WEB_SOFT, type AgentWebRecord, type WebRequests } from "./metrics.ts";
import { listConnectors, suggestName } from "./connector.ts";
import { deadlineOf, finishAsked } from "./clock.ts";
import type { Session, Task } from "./model.ts";
import { currentSession } from "./session.ts";
import { findTreeUpwards, Tree } from "./tree.ts";
import { Settings } from "./config.ts";
import { calibrationKey, viewModel } from "./viewsizes.ts";
import { ui } from "../cli/ui.ts";
import { isAgent } from "./which.ts";
import type { Env } from "./paths.ts";

/**
 * The thresholds of an agent's own web fetch, per site (webDomain) and session (core/metrics.ts): up to WEB_SOFT at the
 * host's pace alone; then never refused for their number, one per WEB_SOFT_GAP_MS to the whole site, the connector
 * advised once; past web.perHost (WEB_PER_HOST unless the person set it) refused in a run, asked once in a conversation.
 */
export { WEB_PER_HOST, WEB_SOFT };
/**
 * The site's pace past the soft threshold: one request per this to all its hosts together. Chosen so that the calls
 * waiting their slot at once fit the hook's bound (WEB_WAIT_MAX_MS / this = 5 of them); one more at that moment is
 * refused as one of many at once (fetch one after another), never let through unpaced and never for its number.
 */
export const WEB_SOFT_GAP_MS = 6_000;
/** The longest the hook waits for its slot of a host's pace (a person waits a moment between pages, not minutes): later, not let through. */
export const WEB_WAIT_MAX_MS = 30_000;
/**
 * The longest it waits for the host's lock (held a moment by each hook, longer by strom's own request — a strom fetch
 * through a connector): the whole wait of the call, its slot's wait after it within what is left.
 */
export const WEB_LOCK_WAIT_MS = WEB_WAIT_MAX_MS;
/** What one call of the hook takes besides its wait, at most: Node's start, the tree and the journal read, the answer. */
export const WEB_CALL_OVERHEAD_MS = 5_000;
/**
 * The longest one call of the hook takes: its whole wait (for the host's turn, then for its slot) within WEB_WAIT_MAX_MS
 * — a call that would wait longer is answered at once (refused in a run, the person's one answer in a conversation) —
 * and its overhead. Well below WEB_HOOK_TIMEOUT_S: the agent never kills the hook, nor waits on it as on an error.
 */
export const WEB_CALL_MAX_MS = WEB_WAIT_MAX_MS + WEB_CALL_OVERHEAD_MS;
/** The hook's own time limit in the agent's settings (seconds; Claude Code's and Grok's files alike): above the longest call. */
export const WEB_HOOK_TIMEOUT_S = 60;

/** The tools the hook is for, by the names Claude Code and Grok give them. */
export const WEB_FETCH_TOOLS = ["WebFetch", "web_fetch"] as const;
export const WEB_SEARCH_TOOLS = ["WebSearch", "web_search"] as const;

/** One hook event as the agent sends it (Claude Code: snake_case; Grok: camelCase, Claude's keys accepted too). */
export interface WebEvent {
  agent: "claude" | "grok";
  tool: string;
  via: "web" | "search";
  url?: string;
  /** As fetch.jsonl names it (webHost: lowercase, punycode, a port only when not the scheme's own). */
  host?: string;
  /** The host's name as the limiter keeps its state (core/net.ts: no port). */
  netHost?: string;
  agentSession?: string;
  toolUse?: string;
  cwd?: string;
  /** After the call ran (PostToolUse) or failed (PostToolUseFailure); none: before it (PreToolUse). */
  phase?: "post" | "failed";
  /** What a failed call's agent said of it. */
  error?: string;
}

const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v.trim() : undefined);

/** The agent's hook event on stdin: a web fetch or search of Claude Code or Grok, else undefined (nothing to do). */
export function webEvent(text: string): WebEvent | undefined {
  let j: Record<string, unknown>;
  try {
    const v = JSON.parse(text) as unknown;
    if (!v || typeof v !== "object" || Array.isArray(v)) return undefined;
    j = v as Record<string, unknown>;
  } catch {
    return undefined;
  }
  const tool = str(j.tool_name) ?? str(j.toolName);
  if (!tool) return undefined;
  const fetch = (WEB_FETCH_TOOLS as readonly string[]).includes(tool);
  const search = (WEB_SEARCH_TOOLS as readonly string[]).includes(tool);
  if (!fetch && !search) return undefined;
  // Grok's event carries its own camelCase keys (hookEventName, toolName) beside Claude's hook_event_name
  const agent = "toolName" in j || "hookEventName" in j || tool === "web_fetch" || tool === "web_search" ? "grok" : "claude";
  const input = (j.tool_input ?? j.toolInput ?? {}) as Record<string, unknown>;
  const ev: WebEvent = { agent, tool, via: fetch ? "web" : "search" };
  // the event's name (an identifier of the agent's, never a person's text): Claude's PostToolUse, Grok's post_tool_use
  const event = (str(j.hook_event_name) ?? str(j.hookEventName) ?? "").toLowerCase().replace(/_/g, "");
  if (event === "posttooluse") ev.phase = "post";
  else if (event === "posttoolusefailure") {
    ev.phase = "failed";
    const error = str(j.error);
    if (error) ev.error = error;
  }
  const sid = str(j.session_id) ?? str(j.sessionId);
  if (sid) ev.agentSession = sid;
  const use = str(j.tool_use_id) ?? str(j.toolUseId);
  if (use) ev.toolUse = use;
  const cwd = str(j.cwd) ?? str(j.workspaceRoot);
  if (cwd) ev.cwd = cwd;
  if (fetch) {
    const url = str(input.url) ?? str(input.uri);
    if (!url) return undefined;
    let u: URL;
    try {
      u = new URL(url);
    } catch {
      return undefined;
    }
    if (!/^https?:$/.test(u.protocol) || !u.hostname) return undefined;
    ev.url = url;
    ev.host = webHost(url);
    if (!ev.host) return undefined;
    ev.netHost = u.hostname.toLowerCase().replace(/\.$/, "");
  }
  return ev;
}

/** What the hook answers: nothing (the call goes on as the agent's own rules say), or a decision with its reason. */
export interface WebAnswer {
  decision?: "deny" | "ask";
  reason?: string;
  /** What was recorded (none when nothing was). */
  record?: AgentWebRecord;
  /** After a call (PostToolUse, PostToolUseFailure): a note for the agent beside the call's result — near the threshold. */
  context?: string;
  /** The event the note answers. */
  event?: "PostToolUse" | "PostToolUseFailure";
}

/** The hook's answer as the agent reads it on stdout (Claude Code's and Grok's shape alike); none: nothing at all. */
export function hookOutput(a: WebAnswer): string {
  // after a call: a note the agent reads with its result (Claude Code's and Grok's additionalContext)
  if (a.context) return JSON.stringify({ hookSpecificOutput: { hookEventName: a.event ?? "PostToolUse", additionalContext: a.context } });
  if (!a.decision) return "";
  return JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: a.decision, permissionDecisionReason: a.reason ?? "" } });
}

/** A session nobody watches: strom run (not --interactive) and the readers set it for their agents. */
export function unattended(env: Env): boolean {
  return env.STROM_NONINTERACTIVE === "1";
}

/** Why the host takes nothing now, for the agent. */
function refusedText(host: string, r: HostRefusal): string {
  const at = clock(r.until);
  // the way out is the person's (a refusal, a limit kept as the host gave it, a year too): named for them
  const lift = `the person can lift it: strom allow host ${host} --unblock`;
  if (r.why === "blocked") return `strom: ${host} is left alone until ${at}${r.reason ? ` — ${r.reason}` : ""}; nothing goes to it before then, through the web fetch tool either (${lift}). Go on with other work.`;
  if (r.why === "limit") return `strom: ${host} says its limit is used up until ${at}; nothing goes to it before then, through the web fetch tool either (${lift}). Go on with other work.`;
  return `strom: ${r.perHour ?? ""} requests to ${host} in the last hour — its hourly cap; nothing more before ${at}, through the web fetch tool either. Go on with other work.`;
}

/**
 * A failed call that never ran: the person said no to it, the permissions or a hook refused it (Claude Code: "The
 * user doesn't want to proceed with this tool use…", "Permission to use … has been denied"; Grok: "User cancelled
 * the execution", "Denied by permission policy", "Hook denied: …"). Anything else failed on its way: it went out.
 */
const NEVER_RAN = /doesn['’]t want to proceed|tool use was rejected|permission to use .* denied|denied by permission|permission policy|user cancel+ed|hook denied/i;

/** The note after a call begins this many requests before the threshold (web.perHost) of a site. */
export const WEB_NOTE_BEFORE = 2;

/**
 * Less time than this left in a run's session: no connector is begun in it — named still as the way, and its task added
 * now. With more time the connector is built in the same session: the one good outcome past the threshold.
 */
export const CONNECTOR_MIN_MS = 8 * 60_000;

/** The way on past the threshold for one host: its connector here, or one to build now — a task for one only the fallback. */
export interface ConnectorWay {
  /** A connector of the plugins folder that may contact this host. */
  have?: string;
  /** The name a new one for this host would take (strom connector new). */
  name: string;
  /** The host's start page. */
  url: string;
  /** The deadline really near (CONNECTOR_MIN_MS) or the session asked to finish: the connector named, its task added now. */
  later: boolean;
  /** The command that adds that task. */
  task: string;
}

/**
 * The connector of the plugins folder for a host: one that may contact it, else one for another host of the same site
 * (webDomain: a mirror, an API's host) — the agent goes straight to strom fetch with it.
 */
export function siteConnector(shared: string, netHost: string): string | undefined {
  const all = listConnectors(shared);
  const site = webDomain(netHost);
  return (
    all.find((c) => c.manifest.hosts.some((h) => hostAllowed(netHost, [h])))?.name ??
    all.find((c) => c.manifest.hosts.some((h) => webDomain(h.replace(/^\*\./, "")) === site))?.name
  );
}

/**
 * The web's rule for AGENTS.md and the guide (the brief's is one sentence: brief.ts webRule), wrapped at 80 under a
 * list item's indent of three; `q`: the quote around a command (AGENTS.md's backtick, the guide's none).
 */
export function webRuleLines(perHost: number, q: string): string {
  const soft = Math.min(WEB_SOFT, perHost);
  const text =
    `Search the web freely. More than ${soft} pages or items of one site (its domain: its mirrors and other hosts count with it): ` +
    `build its connector — ${q}strom connector new <site> --url https://<host>/${q} (<site>: the domain's name, api.example.org → example; one connector a site), its DISCOVERY.md (terms, robots.txt, an official API or export) — ` +
    `and read the rest through ${q}strom fetch${q} at the server's pace; ${soft < perHost ? `past ${soft} the web tool goes slower, past ${perHost} it is refused` : `past ${perHost} the web tool is refused`}. ` +
    `A task "Connector for <domain>" only if no time is left or the server's terms forbid it, saying why — never a task to read the rest later through the web tool.`;
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    if (line && line.length + 1 + word.length > 77) {
      lines.push(line);
      line = word;
    } else line = line ? `${line} ${word}` : word;
  }
  if (line) lines.push(line);
  return lines.join("\n   ");
}

/**
 * A connector's name from the site a host is of (webDomain, as the thresholds count it): its registrable domain without
 * the public suffix, lowercase, dashes — one name for all the hosts of a site ("api.kramerius.mzk.cz" → "mzk",
 * "a.matriky-example.cz" → "matriky-example", "ia801408.us.archive.org" → "archive", "www.bbc.co.uk" → "bbc").
 */
export function connectorName(host: string): string {
  const site = webDomain(host);
  // an address of numbers — IPv6 in its brackets, IPv4 — has no site's name: this computer's is localhost, another the
  // address in dashes ("192.168.1.5" → "192-168-1-5", "[2001:db8::1]:8080" → "2001-db8-1")
  const bare = site.replace(/^\[|\](:\d+)?$/g, "").replace(/%.*$/, "");
  const ip = /^\d{1,3}(\.\d{1,3}){3}$/.test(bare) || bare.includes(":");
  if (ip && (bare === "::1" || /^(::ffff:)?127\./.test(bare) || /^(0{1,4}:){7}0{0,3}1$/.test(bare))) return "localhost";
  if (ip) return suggestName(bare) ?? "web-archive";
  const labels = site.split(".").filter(Boolean);
  // a name of one label (localhost) has no suffix to leave out
  const suffix = labels.length < 2 ? 0 : PUBLIC_SECOND_LEVEL.has(labels.slice(-2).join(".")) && labels.length > 2 ? 2 : 1;
  const base = labels.slice(0, labels.length - suffix).join("-");
  return suggestName(base) ?? "web-archive";
}

/** A text in a shell's double quotes (a task's words: no quote of its own breaks the line). */
const dq = (s: string) => `"${s.replace(/["\\$`]/g, "")}"`;

/**
 * Where the agent goes past the threshold for one host: through the connector that is here for it; else one built now,
 * in the same session, named for its site (strom connector new <site's name> --url <the host's start page>) and the rest read
 * through strom fetch — a task for it only where no time is left (STROM_DEADLINE within CONNECTOR_MIN_MS, or the
 * session asked to finish) or the server does not allow automated access, said why.
 */
export function connectorWay(o: { host: string; netHost: string; shared: string | undefined; tree: Tree; session?: Session | undefined; env: Env; now?: number }): ConnectorWay {
  const have = o.shared ? siteConnector(o.shared, o.netHost) : undefined;
  const name = connectorName(o.netHost);
  const url = `https://${o.host}/`;
  const site = webDomain(o.netHost);
  const end = deadlineOf(o.env);
  const later = (end !== undefined && end - (o.now ?? Date.now()) < CONNECTOR_MIN_MS) || (!!o.session && finishAsked(o.tree.root, o.session.id));
  const task = o.session?.task ? o.tree.get<Task>(o.session.task) : undefined;
  const person = task?.subject.find((x) => /^P\d+$/.test(x));
  const research = o.session?.research ?? task?.research;
  const add = [
    // the task the site's (one for all its mirrors), its start page the host's the agent asked
    `strom task add ${dq(`Connector for ${site}`)} --level locate --where ${dq(url)}`,
    `--why ${dq(`more pages of ${site} than the web fetch tool takes in one session${task ? ` (${task.id}: ${task.what})` : ""}`)}`,
    `--done-when ${dq(`a connector for ${site} fetches what the research needs (strom connector test)`)}`,
    person ? `--about ${person}` : "",
    research ? `--research ${research}` : "",
  ].filter(Boolean).join(" ");
  return { ...(have ? { have } : {}), name, url, later, task: add };
}

const NEVER = "Never go round it (curl, another tool, another address of the same server). Single searches stay free.";

/** The limit is no reason to give up: past it the task goes on, its data read the gentle way. */
const GO_ON = "Never end the task or do without these pages because of this limit.";

/** The connector's steps for exactly this host: its brief first, then a probe, a test and strom fetch for the rest. */
const steps = (host: string, way: ConnectorWay) =>
  `strom connector new ${way.name} --url ${way.url}, then its DISCOVERY.md (what the site allows: terms, robots.txt, an official API or export, before any code), ` +
  `strom connector probe ${way.name} <a page of ${host}>, strom connector test ${way.name} …, then strom fetch ${way.name} … for the rest, at the server's pace`;

/**
 * The way on for more pages of exactly this host: its connector here; else the connector built now, in this session (the
 * way to take), and its task only as the fallback, its reason said; the deadline near or the session finishing: the
 * connector still named first, and its task what to do now.
 */
export function wayText(host: string, way: ConnectorWay): string {
  if (way.have) return `Its connector is here: go on through it — strom connector show ${way.have}, then strom fetch ${way.have} … (it keeps the server's pace, robots.txt and terms).`;
  if (way.later)
    return (
      `The way for this server is its connector (${steps(host, way)}), but this session is ending (too little time left, or asked to finish) — too soon to build it: ` +
      `add its task now — ${way.task} — say so in your note, and close with what was found. ${GO_ON}`
    );
  return (
    `Build its connector now, in this session — the gentle way, and the one to take, within the task's budget; tell the user in a sentence (working alone: in your note): ${steps(host, way)}. ` +
    `Only if no time is left for it, or the server's terms or robots.txt forbid automated access: add its task — ${way.task} — and say why in your note. ${GO_ON}`
  );
}

/** More than the threshold to one host in a run: the way on for exactly this host — never round the limit. */
function manyText(host: string, site: string, n: number, way: ConnectorWay): string {
  return `strom: ${n} requests to ${siteText(host, site)} through the web fetch tool in this session — the limit for one site (web.perHost). ${wayText(host, way)} ${NEVER}`;
}

/** The site the threshold counts, as the agent hears it: the host itself, or its domain with its other hosts. */
function siteText(host: string, site: string): string {
  return site === host.replace(/:\d+$/, "") ? site : `${site} (${host} and its other hosts and mirrors counted together)`;
}

/**
 * Many calls to one host at once in a run: its pace keeps one request at a time — a slot too far ahead (waitMs), or the
 * host's turn not had (none) — and the way on for more pages of it.
 */
function paceText(host: string, waitMs: number | undefined, way: ConnectorWay, slow?: { site: string; soft: number }): string {
  const why =
    waitMs === undefined
      ? `another request to it is under way (strom's own, a strom fetch, or another call of yours) and its turn did not come within ${WEB_LOCK_WAIT_MS / 1000} s`
      : `its next free moment is ${Math.ceil(waitMs / 1000)} s away, longer than the web fetch tool waits`;
  const pace = slow ? `past ${slow.soft} pages of ${siteText(host, slow.site)} in this session, one request per ${WEB_SOFT_GAP_MS / 1000} s to it` : "a person's pace";
  return `strom: one request at a time to ${host}, ${pace} — ${why}. Fetch its pages one after another, never many at once (this one again in a moment); more pages of this server: ${wayText(host, way)} ${NEVER}`;
}

/** The advice once a session past the soft threshold of a site: slower from now, refused past the hard one — and the way on. */
function softText(host: string, site: string, soft: number, perHost: number): string {
  return `strom: ${soft} pages of ${siteText(host, site)} through the web fetch tool in this session — from now one request per ${WEB_SOFT_GAP_MS / 1000} s to it, and past ${perHost} the web fetch tool is refused (web.perHost). For the rest of its pages:`;
}

/**
 * The hook's work for one event in a tree: recorded, counted and paced, and its answer. Throws on anything unexpected
 * (the command lets the call go then).
 */
export async function answerWebEvent(ev: WebEvent, o: { env: Env; cwd: string; now?: () => number; sleep?: (ms: number) => Promise<void> }): Promise<WebAnswer> {
  const root = findTreeUpwards(ev.cwd && path.isAbsolute(ev.cwd) ? ev.cwd : o.cwd);
  if (!root) return {};
  const tree = Tree.open(root, o.env);
  if (!metricsOn(tree)) return {};
  const session = currentSession(tree, o.env);
  // as a command of the agent's is logged: its session, else "agent" (never the user)
  if (session) tree.actor = session.id;
  else if (isAgent(o.env)) tree.actor = "agent";
  const settings = new Settings(o.env, {});
  // the threshold the person set (web.perHost: the tree's over the user's, else WEB_PER_HOST)
  const perHost = settings.webPerHost(tree.config);
  const model = str(o.env.STROM_MODEL) ?? viewModel(settings, ev.agent, tree.config);
  // the same line as the agent's stream gives (core/metrics.ts: never the address, only its host), from the hook
  const base: AgentWebRecord = {
    via: ev.via,
    ...(ev.host ? { host: ev.host, domain: webDomain(ev.netHost ?? ev.host) } : {}),
    ...(session ? { session: session.id } : {}),
    key: calibrationKey(ev.agent, model),
    agent: ev.agent,
    tool: ev.tool,
    ...(ev.toolUse ? { toolUse: ev.toolUse } : {}),
    ...(ev.agentSession ? { agentSession: ev.agentSession } : {}),
  };
  const who = { ...(session ? { session: session.id } : {}), ...(ev.agentSession ? { agentSession: ev.agentSession } : {}) };
  // one call of the agent's is answered once (Grok may run the same hook from two files)
  const seen = () => !!ev.toolUse && webRequestsOf(root, who).toolUses.has(ev.toolUse);
  // after the call: only a fetch the person was asked about is left — counted once it went out, or their no kept
  if (ev.phase && (ev.via !== "web" || !ev.toolUse)) return {};
  if (ev.phase === "failed" && NEVER_RAN.test(ev.error ?? "")) {
    // it never ran: one the person was asked about is their no for the host in this session (never counted)
    const had = webRequestsOf(root, who);
    if (ev.host && had.asked.has(ev.toolUse!)) recordWebRequest(tree, o.env, { ...base, decision: "deny", why: WEB_SAID_NO, n: had.domains.get(webDomain(ev.netHost ?? ev.host)) ?? 0 });
    return {};
  }
  if (ev.via === "search") {
    if (seen()) return {};
    const record = { ...base, decision: "allow" as const };
    recordWebRequest(tree, o.env, record);
    return { record };
  }
  const host = ev.host!;
  // the thresholds count the site (its mirrors and other hosts with it), the pace stays the exact host's
  const site = webDomain(ev.netHost ?? host);
  const shared = settings.shared()?.value;
  const lang = tree.lang;
  // the soft threshold: never above the hard one the person set
  const soft = Math.min(WEB_SOFT, perHost);
  const way = () => connectorWay({ host, netHost: ev.netHost ?? host, shared, tree, session, env: o.env, ...(o.now ? { now: o.now() } : {}) });
  /**
   * A call the hard threshold (many) or the host's pace (a slot too far: pace; its turn not had: busy) holds back. The
   * pace: refused in a run (one request at a time) and past the soft threshold (the site's slower pace, in a
   * conversation too); else, in a conversation, let go at the end of its wait, counted — never a question for it. The
   * threshold: refused in a run; in a conversation the person is asked once per site and session — their yes (to that
   * question alone) stands for the site (the threshold no more; still counted, and paced — a call its pace cannot take in
   * time is refused, one request at a time), their no too (refused, with the way on), and while the question waits a
   * second call is refused, never asked again.
   */
  const beyond = (why: "many" | "pace" | "busy", had: WebRequests, waitMs?: number): { take: boolean; value: WebAnswer } => {
    const before = had.domains.get(site) ?? 0;
    const said = had.answered.get(site);
    const w = way();
    const deny = (reason: string, as: string = why): { take: boolean; value: WebAnswer } => ({ take: false, value: { decision: "deny", reason, record: { ...base, decision: "deny", why: as, n: before } } });
    const paced = () => paceText(host, why === "pace" ? waitMs : undefined, w, before >= soft ? { site, soft } : undefined);
    if (why !== "many" && before >= soft) return deny(paced());
    if (unattended(o.env)) return deny(why === "many" ? manyText(host, site, before, w) : paced());
    // below the soft threshold, in a conversation: the person is never disturbed for the pace — let go once the hook's
    // wait is over, counted (in the session; in the host's hour where its lock was had)
    if (why !== "many") return { take: true, value: { record: { ...base, decision: "allow", why, n: before + 1 } } };
    if (said === "yes") return { take: true, value: { record: { ...base, decision: "allow", why: "answered", n: before + 1 } } };
    if (said === "no") return deny(`strom: the user said no to more requests to ${siteText(host, site)} through the web fetch tool in this session — none goes to it again in this session. ${wayText(host, w)} ${NEVER}`, "answered");
    if (said === "pending") return deny(`strom: the user is being asked about requests to ${siteText(host, site)} already — no second question: wait for that answer, then one page at a time. ${wayText(host, w)} ${NEVER}`, "pending");
    // asked: counted (in the session and the host's hour) only once it goes out — the hook after the call (confirm);
    // past the threshold the person hears the way for this site: its connector here, or the one to build
    const reason = w.have ? ui(lang, "ui.web.ask.have", { n: before, host: site, connector: w.have }) : ui(lang, "ui.web.ask", { n: before, host: site, name: w.name, url: w.url });
    return { take: false, value: { decision: "ask", reason, record: { ...base, decision: "ask", why, n: before + 1 } } };
  };
  // the session's requests as read under the host's and the site's locks (the site's pace asks them first)
  let locked: WebRequests | undefined;
  const decide = ({ refused, waitMs, late }: AgentSlot): { take: boolean; value: WebAnswer | undefined } => {
    const had = locked ?? webRequestsOf(root, who);
    if (ev.toolUse && had.toolUses.has(ev.toolUse)) return { take: false, value: undefined };
    const before = had.domains.get(site) ?? 0;
    // the host stopped (it refused, its limit, its cap): refused, whatever the person said
    if (refused) return { take: false, value: { decision: "deny", reason: refusedText(host, refused), record: { ...base, decision: "deny", why: refused.why, n: before } } };
    if (late) return beyond("pace", had, waitMs);
    if (before >= perHost) return beyond("many", had);
    // past the soft threshold: let through at the site's slower pace — the first of them carries the advice (once)
    if (before >= soft) return { take: true, value: { record: { ...base, decision: "allow", why: "soft", ...(before === soft ? { advice: true } : {}), n: before + 1 } } };
    return { take: true, value: { record: { ...base, decision: "allow", n: before + 1 } } };
  };
  const write = (a: WebAnswer | undefined, waitedMs: number) => {
    if (!a?.record) return;
    if (waitedMs > 0) a.record.paceMs = waitedMs;
    recordWebRequest(tree, o.env, a.record);
  };
  // after the call ran: one the person was asked about (the hook's last line of it: ask) went out — counted now, no pause
  // (it is gone already); anything else was counted before it or never goes
  const confirm = (): { take: boolean; value: WebAnswer | undefined } => {
    const had = webRequestsOf(root, who);
    if (!had.asked.has(ev.toolUse!)) return { take: false, value: undefined };
    return { take: true, value: { record: { ...base, decision: "allow", why: "asked", n: (had.domains.get(site) ?? 0) + 1 } } };
  };
  /**
   * After a call that went out: the first past the soft threshold, once a session per site, the advice — the rest of the
   * site's pages through its connector, its exact line; from the hard threshold − WEB_NOTE_BEFORE-th request on, how many
   * of it are used and the way on (the refusal's own lines) — told before the refusal comes.
   */
  const near = (): WebAnswer => {
    if (!ev.toolUse) return {};
    const had = webRequestsOf(root, who);
    if (!had.toolUses.has(ev.toolUse)) return {};
    const n = had.domains.get(site) ?? 0;
    const event = ev.phase === "failed" ? "PostToolUseFailure" : "PostToolUse";
    if (n < Math.max(1, perHost - WEB_NOTE_BEFORE)) {
      if (!had.advised.has(ev.toolUse)) return {};
      return { context: `${softText(host, site, soft, perHost)} ${wayText(host, way())} ${NEVER}`, event };
    }
    const head =
      n <= perHost
        ? `strom: ${n} of the ${perHost} requests to ${siteText(host, site)} the web fetch tool takes in this session (web.perHost) used${n === perHost ? " — the next one is refused working alone, and asked of the user once in a conversation" : ""}.`
        : `strom: ${n} requests to ${siteText(host, site)} through the web fetch tool in this session, past web.perHost (${perHost}) on the user's yes.`;
    return { context: `${head} The rest of this server's pages: ${wayText(host, way())} ${NEVER}`, event };
  };
  // (nothing asked of this call — most of them: no host's lock taken for nothing)
  if (ev.phase && !confirm().take) return near();
  // the limiter keeps a host by its name (no port), as strom's own requests do; no shared folder (strom not set up):
  // the host's state beside the tree's metrics, so the count and the pace hold as well
  const netHost = ev.netHost ?? host;
  const pace = shared ? listConnectors(shared).find((c) => c.manifest.hosts.some((h) => hostAllowed(netHost, [h])))?.manifest.policy.pace : undefined;
  let value: WebAnswer | undefined;
  try {
    ({ value } = await agentRequest(shared ? path.join(shared, "net") : path.join(metricsDir(root), "net"), netHost, pace, {
      // (a call that went out while the host's hour filled or it was left alone: written, its hour as it is)
      inside: ev.phase ? confirm : decide,
      after: write,
      // the whole wait of the call — for the host's turn and for its slot — within WEB_WAIT_MAX_MS (WEB_CALL_MAX_MS)
      maxWaitMs: WEB_WAIT_MAX_MS,
      wait: !ev.phase,
      lockWaitMs: WEB_LOCK_WAIT_MS,
      // the site's requests kept together: past the soft threshold one per WEB_SOFT_GAP_MS to all its hosts
      site: {
        key: site,
        gapMs: () => {
          locked = webRequestsOf(root, who);
          return (locked.domains.get(site) ?? 0) >= soft ? WEB_SOFT_GAP_MS : 0;
        },
      },
      // the host's state broken: made again from this tree's journal of it
      recover: (now) => webHourOf(root, netHost, now),
      ...(o.now ? { now: o.now } : {}),
      ...(o.sleep ? { sleep: o.sleep } : {}),
    }));
  } catch (err) {
    if (!(err instanceof LockedError)) throw err;
    // the host's (or the site's) turn not had: waiting for it is no error, and no call goes through uncounted and unpaced
    if (ev.phase) {
      // it went out already: counted in the session (the host's hour as it is)
      write(confirm().value, 0);
      return near();
    }
    if (seen()) return {};
    // (refused in a run and past the soft threshold; below it in a conversation let go, counted in the session — the
    // host's hour not had; a yes for the site lets nothing through unpaced: busy past it is refused)
    value = beyond("busy", webRequestsOf(root, who)).value;
    write(value, 0);
  }
  // after a call: only the notes, the advice and the count near the threshold
  return ev.phase ? near() : (value ?? {});
}

/**
 * The session of the last web request or search fetch.jsonl holds (its end read only): its strom session, else the
 * agent's own id of it (a conversation without a strom session, counted by it) — what `strom net web` shows when no
 * session is open.
 */
export function lastWebSession(root: string): { session?: string; agentSession?: string } | undefined {
  let text: string;
  try {
    const file = path.join(metricsDir(root), "fetch.jsonl");
    const size = fs.statSync(file).size;
    const n = Math.min(size, 1024 * 1024);
    const buf = Buffer.alloc(n);
    const fd = fs.openSync(file, "r");
    try {
      fs.readSync(fd, buf, 0, n, size - n);
    } finally {
      fs.closeSync(fd);
    }
    text = buf.toString("utf8");
  } catch {
    return undefined;
  }
  const lines = text.split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i]!;
    if (!line.includes('"via":"web"') && !line.includes('"via":"search"')) continue;
    try {
      const r = JSON.parse(line) as AgentWebRecord;
      if (typeof r.session === "string" && r.session) return { session: r.session };
      if (typeof r.agentSession === "string" && r.agentSession) return { agentSession: r.agentSession };
    } catch {
      // a line cut at the start of the tail, or broken: the one before
    }
  }
  return undefined;
}

/** A path in a POSIX shell's single quotes. */
const shQuote = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;
/** A path in PowerShell's single quotes. */
const psQuote = (s: string) => `'${s.replace(/'/g, "''")}'`;

/**
 * The hook's command for the agent: the tree's own strom (its shim in .strom/bin, this installation), whose failure never
 * blocks the call — exit 2 would (an older strom that knows no `net web`): POSIX `|| true`; Windows PowerShell, `exit 0`
 * after it (Claude Code runs a hook in PowerShell when the entry says so: no Git Bash needed).
 */
export function webHookCommand(root: string, platform: NodeJS.Platform = process.platform): { command: string; shell?: "powershell" } {
  return treeHookCommand(root, "net web --hook", platform);
}

/** A hook's command of the tree's own strom (`args`: its fixed words), whose failure never blocks the call (as webHookCommand). */
export function treeHookCommand(root: string, args: string, platform: NodeJS.Platform = process.platform): { command: string; shell?: "powershell" } {
  const bin = path.join(root, ".strom", "bin");
  if (platform === "win32") return { command: `& ${psQuote(path.win32.join(bin, "strom.cmd"))} ${args}; exit 0`, shell: "powershell" };
  return { command: `${shQuote(path.posix.join(bin.split(path.sep).join("/"), "strom"))} ${args} || true` };
}

/**
 * Claude Code's hooks of the tree (its .claude/settings.json): strom's before each web fetch and search, and after each
 * web fetch ran or failed — where a call the person was asked about went out and is counted.
 */
export function claudeWebHooks(root: string, platform: NodeJS.Platform = process.platform): Record<string, unknown> {
  const { command, shell } = webHookCommand(root, platform);
  const hooks = [{ type: "command", command, timeout: WEB_HOOK_TIMEOUT_S, ...(shell ? { shell } : {}) }];
  return {
    PreToolUse: [{ matcher: "WebFetch|WebSearch", hooks }],
    PostToolUse: [{ matcher: "WebFetch", hooks }],
    PostToolUseFailure: [{ matcher: "WebFetch", hooks }],
  };
}

/**
 * Grok Build's own hook file of the tree (.grok/hooks/strom.json): Grok runs a project's Claude Code hooks too, but strom
 * switches those off for a run without the person's add-ons (GROK_CLAUDE_HOOKS_ENABLED=0, runners/grok.ts) — its own
 * project hooks stay on. The same command: Grok runs one handler once where both files name it.
 */
export function grokWebHooks(root: string, platform: NodeJS.Platform = process.platform): Record<string, unknown> {
  const bin = path.join(root, ".strom", "bin");
  // Grok's shell on Windows is its own: nothing PowerShell's — the shim whose exit is always 0 (strom-hook.cmd), so an
  // older strom that knows not `net web` (exit 2) never blocks a web tool; strom's answer is its JSON on stdout
  const command = platform === "win32" ? `"${path.win32.join(bin, "strom-hook.cmd")}" net web --hook` : webHookCommand(root, platform).command;
  const hooks = [{ type: "command", command, timeout: WEB_HOOK_TIMEOUT_S }];
  return { hooks: { PreToolUse: [{ matcher: "web_fetch|web_search", hooks }], PostToolUse: [{ matcher: "web_fetch", hooks }], PostToolUseFailure: [{ matcher: "web_fetch", hooks }] } };
}
