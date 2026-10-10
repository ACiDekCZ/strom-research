// What strom measures of the reading of scans and the load on the archives, for itself: in .strom/metrics beside a
// research (never data/, never git, never a pack — another computer measures again). Only recorded here; nothing is
// decided from it yet (a summary and the tuning come later).
//
//   fetch.jsonl        each run of strom fetch (and a connector's test, a probe, the browser's plan and take-over):
//                      who, which connector, book and record set, how many requests to each host, the waits for the
//                      host's pace and hourly cap, a limit used up (later), a part's gain or "no sharper"; and each
//                      page or search of an agent's own web tools (via web|search, its host — below)
//   usage/<name>.jsonl the agent's use per request (or turn, or step) as the agent says it, and its own id of the
//                      session — one file per session of strom run and per reader; nothing when the agent says nothing
//   readers.jsonl      each reader strom started (strom read, clips, transcripts, a calibration): its agent and model,
//                      views, outcome, what it found, its tokens and cost
//
// Each record one JSON line, appended (several processes at once write whole lines). Recording never fails a command
// nor holds it up: what cannot be written is left out. An archive records nothing (nobody reads there).

import fs from "node:fs";
import path from "node:path";
import { isArchive } from "./mode.ts";
import { isWorkerId } from "./workers.ts";
import type { UsageSample } from "../runners/runner.ts";
import type { Env } from "./paths.ts";
import { aliasPair, noteAliases } from "./modelkey.ts";

/** The folder of the measurements of a research. */
export function metricsDir(root: string): string {
  return path.join(root, ".strom", "metrics");
}

/** Whether this research records: not an archive, not a dry run. */
export function metricsOn(tree: { config: { mode?: string }; dryRun?: boolean }): boolean {
  return !isArchive(tree) && !tree.dryRun;
}

/** One line appended to a journal of .strom/metrics; a failure is left out. */
export function appendMetric(root: string, rel: string, record: Record<string, unknown>): void {
  try {
    const file = path.join(metricsDir(root), rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.appendFileSync(file, JSON.stringify({ at: new Date().toISOString(), ...record }) + "\n");
  } catch {
    // a measurement is no reason to fail
  }
}

/** Who did it: the session (N…) at work, the agent's name beside others (STROM_WORKER), a reader. */
export function whoOf(tree: { actor: string }, env: Env): { session?: string; by: string; worker?: string; reader?: 1 } {
  return {
    ...(/^N\d+$/.test(tree.actor) ? { session: tree.actor } : {}),
    by: tree.actor,
    ...(isWorkerId(env.STROM_WORKER) ? { worker: env.STROM_WORKER } : {}),
    ...(env.STROM_READER === "1" ? { reader: 1 as const } : {}),
  };
}

/** A file name of the usage of a session or a reader: its letters and digits, nothing that leads elsewhere. */
export function usageFileName(name: string): string {
  const safe = name.normalize("NFC").replace(/[^\p{L}\p{M}\p{N}._-]+/gu, "_").replace(/^\.+/, "").slice(0, 120);
  return `${safe || "run"}.jsonl`;
}

/**
 * What a runner says of its agent's use, written to .strom/metrics/usage/<name>.jsonl: the head (agent, the key of the
 * agent and model, the session) with the first thing the agent says, its own id of the session once (and a subagent's),
 * then each sample as it comes. Nothing at all when the agent says nothing.
 */
export function usageRecorder(tree: { root: string; config: { mode?: string }; dryRun?: boolean }, name: string, head: Record<string, unknown>): ((u: UsageSample) => void) | undefined {
  if (!metricsOn(tree)) return undefined;
  const rel = path.join("usage", usageFileName(name));
  let started = false;
  const ids = new Set<string>();
  return (u: UsageSample) => {
    try {
      if (!started) {
        started = true;
        appendMetric(tree.root, rel, { start: true, ...head });
      }
      const { agentSession, sub, ...rest } = u;
      if (agentSession && !ids.has(`${sub ?? ""} ${agentSession}`)) {
        ids.add(`${sub ?? ""} ${agentSession}`);
        appendMetric(tree.root, rel, { agentSession, ...(sub ? { sub } : {}), ...(rest.model ? { model: rest.model } : {}) });
        // the model the key asked (an alias) runs on, as its agent says it at the start (core/modelkey.ts)
        const pair = !sub && typeof head.key === "string" ? aliasPair(head.key, rest.model, new Date().toISOString()) : undefined;
        if (pair) noteAliases(tree.root, [pair]);
      }
      const said = Object.entries(rest).filter(([k, v]) => k !== "model" && v !== undefined);
      if (said.length) appendMetric(tree.root, rel, { ...rest, ...(sub ? { sub } : {}) });
    } catch {
      // a measurement is no reason to fail
    }
  };
}

/** The runner's option that writes the use of a session or a reader (nothing in an archive). */
export function usageOpt(tree: { root: string; config: { mode?: string }; dryRun?: boolean }, name: string, head: Record<string, unknown>): { onUsage?: (u: UsageSample) => void } {
  const on = usageRecorder(tree, name, head);
  return on ? { onUsage: on } : {};
}

/** The tokens of a run as a reader's record carries them (only what the agent said). */
export function tokensOf(m: { inputTokens?: number; outputTokens?: number; cacheReadTokens?: number; cacheWriteTokens?: number }): Record<string, number> | undefined {
  const t: Record<string, number> = {};
  if (m.inputTokens !== undefined) t.in = m.inputTokens;
  if (m.outputTokens !== undefined) t.out = m.outputTokens;
  if (m.cacheReadTokens !== undefined) t.cr = m.cacheReadTokens;
  if (m.cacheWriteTokens !== undefined) t.cw = m.cacheWriteTokens;
  return Object.keys(t).length ? t : undefined;
}

/** What one host was asked in a run of a connector: requests, the pauses for its pace, the waits for its limits. */
export interface HostLoad {
  requests: number;
  /** All pauses for the host's pace together (ms). */
  paceMs?: number;
  /** Each wait for its hourly cap or a limit it said was used up. */
  waits?: { ms: number; why: "cap" | "limit" }[];
}

/** Counts what a run asks of each host (fed by the connector's run and the limiter). */
export class FetchMeter {
  readonly hosts = new Map<string, HostLoad>();
  readonly started = Date.now();
  private of(host: string): HostLoad {
    let h = this.hosts.get(host);
    if (!h) this.hosts.set(host, (h = { requests: 0 }));
    return h;
  }
  request = (host: string): void => {
    this.of(host).requests++;
  };
  pause = (p: { host: string; ms: number; why: "pace" | "cap" | "limit" }): void => {
    if (!(p.ms > 0)) return;
    const h = this.of(p.host);
    if (p.why === "pace") h.paceMs = (h.paceMs ?? 0) + Math.round(p.ms);
    else (h.waits ??= []).push({ ms: Math.round(p.ms), why: p.why });
  };
  json(): Record<string, HostLoad> {
    return Object.fromEntries(this.hosts);
  }
  requests(): number {
    let n = 0;
    for (const h of this.hosts.values()) n += h.requests;
    return n;
  }
}

/** A run of a connector (strom fetch and its kin), written to fetch.jsonl. */
export function recordFetch(tree: { root: string; actor: string; config: { mode?: string }; dryRun?: boolean }, env: Env, rec: Record<string, unknown>, meter?: FetchMeter): void {
  if (!metricsOn(tree)) return;
  try {
    const clean = Object.fromEntries(Object.entries(rec).filter(([, v]) => v !== undefined && !(Array.isArray(v) && v.length === 0)));
    appendMetric(tree.root, "fetch.jsonl", {
      ...whoOf(tree, env),
      ...clean,
      ...(meter ? { hosts: meter.json(), ms: Date.now() - meter.started } : {}),
    });
  } catch {
    // a measurement is no reason to fail
  }
}

/** The runs of fetch.jsonl a connector's requests per image are learned from: the last ones that got images. */
const PER_IMAGE_RUNS = 20;
/** At most this much of the end of fetch.jsonl is read for it. */
const PER_IMAGE_TAIL = 512 * 1024;

/**
 * How many requests a connector's run took for each image it got (`fetch`) or each part (`part`), as the hosts' counter
 * took them — redirects, retries and pages of the book included — over this research's last runs that got any. None
 * measured yet: undefined.
 */
export function requestsPerImage(root: string, connector: string, cmd: "fetch" | "part"): number | undefined {
  let text: string;
  try {
    const file = path.join(metricsDir(root), "fetch.jsonl");
    const size = fs.statSync(file).size;
    const fd = fs.openSync(file, "r");
    try {
      const n = Math.min(size, PER_IMAGE_TAIL);
      const buf = Buffer.alloc(n);
      fs.readSync(fd, buf, 0, n, size - n);
      text = buf.toString("utf8");
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return undefined;
  }
  let requests = 0;
  let images = 0;
  let runs = 0;
  for (const line of text.split("\n").reverse()) {
    if (runs >= PER_IMAGE_RUNS) break;
    let r: { connector?: unknown; cmd?: unknown; via?: unknown; got?: unknown; hosts?: Record<string, { requests?: unknown }> };
    try {
      r = JSON.parse(line);
    } catch {
      continue;
    }
    if (r.connector !== connector || r.cmd !== cmd || r.via === "browser" || !Array.isArray(r.got) || !r.got.length || !r.hosts) continue;
    const sent = Object.values(r.hosts).reduce((n, h) => n + (typeof h?.requests === "number" ? h.requests : 0), 0);
    if (!sent) continue;
    requests += sent;
    images += r.got.length;
    runs++;
  }
  return images ? requests / images : undefined;
}

/** One reader strom started, written to readers.jsonl. */
export function recordReader(tree: { root: string; actor: string; config: { mode?: string }; dryRun?: boolean }, env: Env, rec: Record<string, unknown>): void {
  if (!metricsOn(tree)) return;
  try {
    const clean = Object.fromEntries(Object.entries(rec).filter(([, v]) => v !== undefined));
    appendMetric(tree.root, "readers.jsonl", { ...whoOf(tree, env), ...clean });
  } catch {
    // a measurement is no reason to fail
  }
}

// ── the agents' own web tools ──────────────────────────────────────────────────────────────────────────────────────
//
// What an agent fetched or searched with its own web tools (Claude Code's WebFetch and WebSearch, Grok's web_fetch,
// Antigravity's read_url_content, OpenCode's webfetch, Codex's web search…) goes into fetch.jsonl beside strom's own
// fetches — a line of its own, `via` "web" (a page, its host) or "search", never an image nor a run of a connector:
// counted apart (core/readstats.ts). Two writers, one shape: the tree's hook before the call (`from: "hook"`,
// core/web.ts — with strom's answer: decision, why, n, paceMs) and the agent's stream after the fact (`from: "stream"`).
// Never the page's address, only its host. One request counted once (countedWeb): a refused one never, a tool call
// recorded twice once, and a session's stream lines of an agent whose hook recorded that session left out.

/**
 * Page requests to one site (its registrable domain, webDomain: a server's mirrors count with it) in one session through
 * an agent's own web fetch that go at the host's pace alone; past them the site's requests go slower (WEB_SOFT_GAP_MS),
 * never refused for their number, and the agent hears once that a connector is the gentle way (core/web.ts).
 */
export const WEB_SOFT = 12;

/**
 * More page requests than this to one site in one session through an agent's own web fetch (the default of web.perHost,
 * raised by the person alone): refused in a run, the person asked once in a conversation (core/web.ts).
 */
export const WEB_PER_HOST = 30;

/** One use of an agent's own web tool, as its stream says it. */
export interface AgentWeb {
  via: "web" | "search";
  /** The address of a page (via web): only its host is written. */
  url?: string;
  /** The agent's own name of the tool. */
  tool?: string;
  /** The agent's id of the tool call (Grok's toolCallId): one call is counted once, whoever recorded it. */
  toolUse?: string;
}

/** A line of fetch.jsonl of an agent's own web tool, as both writers write it. */
export interface AgentWebRecord extends AgentWeb {
  /** The host of the page (webHost); else taken from `url`. */
  host?: string;
  /** The site it is counted under (webDomain of the host): the threshold is the site's, the pace the host's. */
  domain?: string;
  /** The strom session (N…). */
  session?: string;
  /** The agent and model as asked (calibrationKey: "claude opus"; core/modelkey.ts names the model it ran on). */
  key?: string;
  /** The agent (claude, grok, codex…). */
  agent?: string;
  /** Who wrote it: the tree's hook before the call, or the agent's stream after it. */
  from?: "hook" | "stream";
  /** The agent's own id of its session (Claude Code's session_id): what the hook counts by without a strom session. */
  agentSession?: string;
  /**
   * The hook's answer: allowed, the person asked, refused (a refused one is never counted). An asked one is counted only
   * once it went out: the hook's later line of the same call (core/web.ts, after the tool ran) says it, `why: "asked"`.
   */
  decision?: "allow" | "ask" | "deny";
  /**
   * Why it asked or refused: many (more than web.perHost to one site — webDomain — in a session); soft (past WEB_SOFT: allowed, the site's slower pace), pace (its slot of the host's pace
   * too far), busy (the host's turn not had), blocked, limit, cap; no (the person said no to an asked one), pending
   * (asked once already, no answer yet), answered (the person's no for the host stands); asked (an asked one went out).
   */
  why?: string;
  /** The first request past the soft threshold of its site in the session (core/web.ts): the connector advised after it, once. */
  advice?: boolean;
  /** The requests to this site (domain) in this session with this one (those not refused). */
  n?: number;
  /** The pause it made for the host's pace (ms). */
  paceMs?: number;
  /** Who, as whoOf says it (the hook: the session's id, else "agent"). */
  by?: string;
  worker?: string;
}

/** Whether a line of fetch.jsonl is an agent's own web request or search (not a run of strom's connectors). */
export function isAgentWeb(f: { via?: unknown }): boolean {
  return f.via === "web" || f.via === "search";
}

/** The host of an address as fetch.jsonl names it: lowercase, its port only when it is not the scheme's own; none: undefined. */
export function webHost(url: string | undefined): string | undefined {
  if (typeof url !== "string" || !url.trim()) return undefined;
  const raw = url.trim();
  try {
    const u = new URL(/^[\p{L}\p{N}+.-]+:\/\//u.test(raw) ? raw : `https://${raw}`);
    if (u.protocol !== "http:" && u.protocol !== "https:") return undefined;
    return u.host.toLowerCase() || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Second-level labels under which a country's names are registered, so the site is the three last labels
 * ("archives.example.co.uk" → "example.co.uk"); a short list built in, no public suffix list.
 */
export const PUBLIC_SECOND_LEVEL: ReadonlySet<string> = new Set([
  "co.uk", "org.uk", "ac.uk", "gov.uk", "me.uk", "ltd.uk", "plc.uk", "net.uk", "sch.uk", "nhs.uk",
  "com.au", "net.au", "org.au", "edu.au", "gov.au", "asn.au", "id.au",
  "co.nz", "org.nz", "net.nz", "ac.nz", "govt.nz", "school.nz",
  "co.jp", "ne.jp", "or.jp", "ac.jp", "go.jp", "ed.jp", "lg.jp",
  "com.br", "net.br", "org.br", "gov.br", "edu.br",
  "com.ar", "org.ar", "gob.ar", "gov.ar", "edu.ar", "com.mx", "org.mx", "gob.mx", "edu.mx",
  "co.za", "org.za", "gov.za", "ac.za", "co.in", "org.in", "gov.in", "ac.in", "nic.in",
  "co.il", "org.il", "gov.il", "ac.il", "co.kr", "or.kr", "go.kr", "ac.kr",
  "com.cn", "net.cn", "org.cn", "gov.cn", "edu.cn", "ac.cn", "com.tw", "org.tw", "gov.tw", "edu.tw",
  "com.hk", "org.hk", "gov.hk", "edu.hk", "com.sg", "org.sg", "gov.sg", "edu.sg",
  "com.tr", "org.tr", "gov.tr", "edu.tr", "com.ua", "org.ua", "gov.ua", "edu.ua", "in.ua",
  "com.pl", "org.pl", "gov.pl", "edu.pl", "net.pl", "com.ru", "org.ru", "gov.ru", "edu.ru",
  "co.at", "or.at", "gv.at", "ac.at", "com.es", "org.es", "gob.es", "com.pt", "org.pt", "gov.pt",
  "com.gr", "org.gr", "gov.gr", "edu.gr", "co.hu", "org.hu", "gov.hu",
]);

/**
 * The site a host belongs to, as the threshold of an agent's web fetch counts it: its registrable domain — the two last
 * labels, three under a PUBLIC_SECOND_LEVEL ("ia801408.us.archive.org" → "archive.org", "api.kramerius.mzk.cz" →
 * "mzk.cz"); no port; an IP address, localhost or a name of one label as it is; punycode as webHost gives it.
 */
export function webDomain(host: string): string {
  let h = host.toLowerCase().trim();
  if (h.startsWith("[")) return h.replace(/\]:\d+$/, "]");
  h = h.replace(/:\d+$/, "").replace(/\.$/, "");
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h) || h.includes(":")) return h;
  const labels = h.split(".").filter(Boolean);
  if (labels.length <= 2) return labels.join(".");
  const two = labels.slice(-2).join(".");
  return PUBLIC_SECOND_LEVEL.has(two) ? labels.slice(-3).join(".") : two;
}

/** The order the fields of a line of an agent's web tool are written in. */
const WEB_FIELDS = ["by", "worker", "via", "host", "domain", "session", "key", "agent", "tool", "from", "toolUse", "agentSession", "decision", "why", "advice", "n", "paceMs"] as const;

/** An agent's own web request or search, written to fetch.jsonl: the host of a page, never its address. */
export function recordAgentWeb(root: string, rec: AgentWebRecord): void {
  try {
    const host = rec.via === "web" ? (rec.host ? rec.host.toLowerCase() : webHost(rec.url)) : undefined;
    // a page whose host cannot be told is no load said of a site
    if (rec.via === "web" && !host) return;
    const line: Record<string, unknown> = {};
    const all = { ...rec, host, ...(host ? { domain: rec.domain ?? webDomain(host) } : {}), from: rec.from ?? "stream" } as Record<string, unknown>;
    for (const k of WEB_FIELDS) if (all[k] !== undefined && all[k] !== "") line[k] = all[k];
    appendMetric(root, "fetch.jsonl", line);
  } catch {
    // a measurement is no reason to fail
  }
}

/** The tree's hook's record of a request (core/web.ts): who as whoOf says it, `from: "hook"` (nothing in an archive or a dry run). */
export function recordWebRequest(tree: { root: string; actor: string; config: { mode?: string }; dryRun?: boolean }, env: Env, rec: AgentWebRecord): void {
  if (!metricsOn(tree)) return;
  const who = whoOf(tree, env);
  recordAgentWeb(tree.root, { by: who.by, ...(who.worker ? { worker: who.worker } : {}), ...(who.session ? { session: who.session } : {}), ...rec, from: "hook" });
}

/** The runner's option that writes what a session's agent fetched and searched with its own web tools (nothing in an archive). */
export function webOpt(tree: { root: string; config: { mode?: string }; dryRun?: boolean }, head: { session?: string; key?: string; agent?: string }): { onWeb?: (w: AgentWeb) => void } {
  if (!metricsOn(tree)) return {};
  return { onWeb: (w) => recordAgentWeb(tree.root, { ...head, ...w, from: "stream" }) };
}

/**
 * The lines of an agent's own web tools that count, each request once, in the journal's order: none the hook refused;
 * a tool call recorded twice (the hook and the stream, or two hook files of Grok) once; and none of the stream's lines
 * of a session and agent after the hook's first line of them — from there the hook saw every call before the stream
 * told it (Grok has both); what the stream told before the hook ran stays counted.
 */
export function countedWeb<T extends { via?: unknown; from?: unknown; session?: unknown; agent?: unknown; toolUse?: unknown; decision?: unknown }>(lines: T[]): T[] {
  const hooked = new Set<string>();
  const calls = new Set<string>();
  const out: T[] = [];
  for (const f of lines) {
    if (!isAgentWeb(f)) continue;
    const of = typeof f.session === "string" ? `${f.session} ${String(f.agent ?? "")}` : undefined;
    if (f.from === "hook" && of) hooked.add(of);
    // (an asked one waits for the person: counted by the hook's line once it went out)
    if (f.decision === "deny" || f.decision === "ask") continue;
    if (f.from === "stream" && of && hooked.has(of)) continue;
    if (typeof f.toolUse === "string" && f.toolUse) {
      if (calls.has(f.toolUse)) continue;
      calls.add(f.toolUse);
    }
    out.push(f);
  }
  return out;
}

/** The person's answer for a host the hook asked about in a session: not yet, yes (the call went out), no. */
export type WebAnswerOfPerson = "pending" | "yes" | "no";

/** The `why` of the hook's line of a call the person said no to (it never ran). */
export const WEB_SAID_NO = "no";

/** What one session asked of the web (webRequestsOf). */
export interface WebRequests {
  /** The requests by exact host (what is said of each server). */
  hosts: Map<string, number>;
  /** The requests by site (webDomain): what the threshold counts. */
  domains: Map<string, number>;
  toolUses: Set<string>;
  asked: Set<string>;
  /** The calls past a site's soft threshold that carry the advice (the first of them in the session). */
  advised: Set<string>;
  /** Per site (webDomain) the hook asked the person about: their one answer — asked once per site and session, never again. */
  answered: Map<string, WebAnswerOfPerson>;
  search: number;
}

/** At most this much of the end of fetch.jsonl is read for the web requests of a session. */
const WEB_TAIL = 1024 * 1024;

/** The end of fetch.jsonl (WEB_TAIL at most; its first line may be cut), undefined when there is none. */
function journalTail(root: string): string | undefined {
  try {
    const file = path.join(metricsDir(root), "fetch.jsonl");
    const size = fs.statSync(file).size;
    const fd = fs.openSync(file, "r");
    try {
      const n = Math.min(size, WEB_TAIL);
      const buf = Buffer.alloc(n);
      fs.readSync(fd, buf, 0, n, size - n);
      return buf.toString("utf8");
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return undefined;
  }
}

/**
 * The times (ms) the agent's web fetches to one host went out in the last hour as this tree's journal tells them (each
 * counted one: its line's time and the pause it made for the pace) — what a host's state that cannot be read is made
 * again from (core/net.ts agentRequest's recover). `host` as the limiter names it: no port.
 */
export function webHourOf(root: string, host: string, now: number): number[] {
  const text = journalTail(root);
  if (text === undefined) return [];
  const bare = (h: string) => h.replace(/:\d+$/, "");
  const lines: AgentWebRecord[] = [];
  for (const line of text.split("\n")) {
    if (!line.includes('"via":"web"')) continue;
    try {
      const r = JSON.parse(line) as AgentWebRecord & { at?: string };
      if (typeof r.host === "string" && bare(r.host) === host) lines.push(r);
    } catch {
      // a line cut or broken: read past
    }
  }
  return countedWeb(lines)
    .map((r) => Date.parse(String((r as { at?: unknown }).at ?? "")) + (typeof r.paceMs === "number" ? r.paceMs : 0))
    .filter((t) => Number.isFinite(t) && t > now - 3600_000 && t <= now + 3600_000);
}

/**
 * The web requests of fetch.jsonl one session made (its strom session, else the agent's own id of it), from the end of
 * the journal: the hosts' counts (via web, as countedWeb counts them — the hook's and the stream's), the searches, and
 * the tool calls recorded already (refused ones too), and what the person answered for each host the hook asked about.
 */
export function webRequestsOf(root: string, who: { session?: string; agentSession?: string }): WebRequests {
  const hosts = new Map<string, number>();
  const domains = new Map<string, number>();
  const toolUses = new Set<string>();
  // the calls the hook asked the person about that have not gone out yet (its last line of them: ask)
  const asked = new Set<string>();
  // those of them the threshold asked about (web.perHost passed): the only question whose answer stands for the site
  const askedMany = new Set<string>();
  const answered = new Map<string, WebAnswerOfPerson>();
  const advised = new Set<string>();
  let search = 0;
  if (!who.session && !who.agentSession) return { hosts, domains, toolUses, asked, advised, answered, search };
  const text = journalTail(root);
  if (text === undefined) return { hosts, domains, toolUses, asked, advised, answered, search };
  const mine: AgentWebRecord[] = [];
  for (const line of text.split("\n")) {
    if (!line.includes('"via":"web"') && !line.includes('"via":"search"')) continue;
    let r: AgentWebRecord;
    try {
      r = JSON.parse(line) as AgentWebRecord;
    } catch {
      continue;
    }
    if (who.session ? r.session !== who.session : r.agentSession !== who.agentSession || !!r.session) continue;
    if (r.toolUse) toolUses.add(r.toolUse);
    if (r.toolUse && r.from === "hook") {
      if (r.advice && r.decision === "allow") advised.add(r.toolUse);
      // the person's one answer for the site — to the threshold's question alone (why "many"; an older strom asked for
      // the pace too: such a yes never passes the threshold): asked (none yet), then yes (it went out) or no
      const threshold = asked.has(r.toolUse) && askedMany.has(r.toolUse);
      if (r.decision === "ask") {
        asked.add(r.toolUse);
        if (r.why === "many") askedMany.add(r.toolUse);
      } else asked.delete(r.toolUse);
      if (r.host) {
        const site = r.domain ?? webDomain(r.host);
        if (r.decision === "ask" && r.why === "many" && !answered.has(site)) answered.set(site, "pending");
        else if (r.decision === "allow" && r.why === "asked" && threshold) answered.set(site, "yes");
        else if (r.decision === "deny" && r.why === WEB_SAID_NO && threshold) answered.set(site, "no");
      }
    }
    mine.push(r);
  }
  for (const r of countedWeb(mine)) {
    if (r.via === "search") search++;
    else if (r.host) {
      hosts.set(r.host, (hosts.get(r.host) ?? 0) + 1);
      const site = r.domain ?? webDomain(r.host);
      domains.set(site, (domains.get(site) ?? 0) + 1);
    }
  }
  return { hosts, domains, toolUses, asked, advised, answered, search };
}
