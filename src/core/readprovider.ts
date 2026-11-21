// A provider of reading: who reads a scan for strom. One contract for both kinds:
//
//  - "agent": a run of an AI agent through its runner (src/runners) — it is given a prompt with the paths of its views
//    and writes its report in Markdown (core/document.ts docPrompt, parseDocReport). Every agent of RUNNERS is one;
//    their readers stay what they were (commands/readers.ts readers()).
//  - "service": a reading service (a handwriting recognition service, HTR) — it is given one image and what the
//    research knows of the source (never its transcript, never a name), and gives back a transcript and its lines with
//    where they stand. No prompt, no translation, no people: it reads the transcript alone (can).
//
// A service reads through `read()`; strom writes what it gives as a reader's report of today's form (only the
// transcript: commands/readers.ts serviceReaders), so comparing readers, holding a reading against a source's
// transcript, the grade of a reading and the bridge go on as they are. Its lines are kept beside the report
// (notes/readings/<D>-<n>.lines.json).
//
// The contract is made to run later as a plugin through the connectors as well (JSON lines, its input a file in its
// own work folder): `requestLine` is what such a plugin is given on its stdin, `parseReply` reads what it says on its
// stdout — {"line": {…}} for each line, then {"done": {…}} (or {"error": {…}}). The fake service of the tests
// (STROM_READ_FAKE) already reads through them: its answer file is such a reply.

import fs from "node:fs";
import path from "node:path";
import type { Env } from "./paths.ts";
import { RUNNERS } from "../runners/index.ts";
import { AGENTS, findAgent } from "./which.ts";
import { BUILTIN_MODELS } from "../agents/models.ts";

export type ReadKind = "agent" | "service";
/** What a provider reads: the transcript; its translation and explanations; the people, events and relations. */
export type ReadCan = "transcript" | "translate" | "persons";
/** Fractions (0–1) of an image or a page from its top left: x, y, w, h. */
export type ReadBox = [number, number, number, number];

/** What a service is given to read: one image, and what the research knows of it (never a transcript or a name). */
export interface ReadInput {
  /** The image: a file in the provider's own work folder (a service: at the resolution of its original, never enlarged). */
  image: string;
  /** The page of the reading it is (1, 2, …). */
  page: number;
  /** The part of the page the image shows (fractions of the page); none: the whole page. */
  region?: ReadBox;
  /** What the research knows of the source read again (spec 059 K6.2): no transcript, no title, nothing of a person. */
  context: { kind?: string; language?: string; date?: string; locator?: string };
  /** The model of the service asked (none: its own). */
  model?: string;
}

/** One line a service read: its text, where it stands (fractions of the image it was given), how sure it is (0–1). */
export interface ReadLine {
  text: string;
  box?: ReadBox;
  confidence?: number;
  /** The text region of the image it stands in (a service's layout: 0, 1, …): each region one entry of the reading. None: all the lines one entry. */
  block?: number;
}

export const READ_OUTCOMES = ["ok", "unreadable", "auth", "limit", "timeout", "stopped", "error"] as const;
export type ReadOutcome = (typeof READ_OUTCOMES)[number];

/** What a service gives back for one image. */
export interface ReadOutput {
  outcome: ReadOutcome;
  /** The transcript as strom keeps a reader's: "|" where a line ends, "[?]" after a word it is not sure of, "[...]" for what it cannot read. */
  transcript: string;
  lines: ReadLine[];
  /** The model that read (none: not said). */
  model?: string;
  /** What it cost: dollars, or the credits of the person's account with the service. */
  cost?: { amount: number; unit: "usd" | "credits"; partial?: boolean };
  /** unreadable: why (blur, dark, small, not-text, …); error, auth, limit: what the service said. */
  why?: string;
  /** When its limit resets (outcome limit). */
  resets?: string;
}

/** Whether a provider can read now, and why not: "not-installed", later "account", "credits", "consent", "off". */
export interface ReadReady {
  ready: boolean;
  why?: string;
}

export interface ReadProvider {
  id: string;
  kind: ReadKind;
  /** Its name as a person reads it (never translated). */
  title: string;
  can: readonly ReadCan[];
  ready(env: Env): ReadReady;
  /** The models it offers (id "": its own). */
  models(env: Env): { id: string; name: string }[];
  /**
   * A service: reads one image (an agent reads through its runner, never here). `work` is its own empty folder
   * (cleared when it ends); the image is in it.
   */
  read?(input: ReadInput, o: { env: Env; work: string; signal?: AbortSignal }): Promise<ReadOutput>;
  /** A service: the longest side of an image it takes (none: the original's). */
  maxSide?: number;
}

// ── the agents ────────────────────────────────────────────────────────────────────────────────────────────────────

/** An agent of RUNNERS as a provider of reading: it reads all a document says, through its runner. */
function agentProvider(id: string): ReadProvider {
  const known = AGENTS.find((a) => a.id === id);
  return {
    id,
    kind: "agent",
    title: known?.name ?? id,
    can: ["transcript", "translate", "persons"],
    // the script runner of the tests is always here; an agent when its CLI is on PATH
    ready: (env) => (!known || findAgent(known.command, env) ? { ready: true } : { ready: false, why: "not-installed" }),
    models: () => (BUILTIN_MODELS[id] ?? []).map((m) => ({ id: m.id, name: m.label ?? m.id })),
  };
}

// ── the protocol of a service (a plugin later: JSON lines) ───────────────────────────────────────────────────────

/** Version of the request and reply a service is given and gives (grows only: a field it does not know it leaves). */
export const READ_PROTOCOL = 1;

/** The request a service is given, as one JSON line: its image by its name in its own work folder. */
export function requestLine(input: ReadInput, work: string): string {
  const rel = path.relative(work, input.image);
  const image = rel && !rel.startsWith("..") && !path.isAbsolute(rel) ? rel.split(path.sep).join("/") : input.image;
  return JSON.stringify({ read: { protocol: READ_PROTOCOL, ...input, image } });
}

const isBox = (v: unknown): v is ReadBox => Array.isArray(v) && v.length === 4 && v.every((n) => typeof n === "number" && Number.isFinite(n) && n >= -0.001 && n <= 1.001);
const clamp = (b: ReadBox): ReadBox => b.map((n) => Math.round(Math.min(1, Math.max(0, n)) * 10000) / 10000) as ReadBox;

/** Text of a service as strom keeps it: NFC, no control characters (tabs and line ends spaces), trimmed. */
function cleanText(v: unknown, max = 4000): string {
  return typeof v === "string" ? v.normalize("NFC").replace(/[\p{Cc}]/gu, " ").replace(/ {2,}/gu, " ").trim().slice(0, max) : "";
}

/**
 * What a service said (its reply: JSON lines {"line": {text, box?, confidence?}}, then {"done": {transcript?, model?,
 * cost?, unreadable?}} or {"error": {outcome?, why?, resets?}}) as a ReadOutput. A line that is no JSON, of no kind
 * known, or a box out of the page is left out — never a reason to fail; no "done" and no "error": an error.
 */
export function parseReply(text: string): ReadOutput {
  const lines: ReadLine[] = [];
  let done: Record<string, unknown> | undefined;
  let error: Record<string, unknown> | undefined;
  for (const raw of text.split("\n")) {
    if (!raw.trim()) continue;
    let msg: unknown;
    try {
      msg = JSON.parse(raw);
    } catch {
      continue;
    }
    if (!msg || typeof msg !== "object" || Array.isArray(msg)) continue;
    const m = msg as Record<string, unknown>;
    const line = m.line as Record<string, unknown> | undefined;
    if (line && typeof line === "object") {
      const t = cleanText(line.text);
      if (!t) continue;
      const c = typeof line.confidence === "number" && line.confidence >= 0 && line.confidence <= 1 ? Math.round(line.confidence * 1000) / 1000 : undefined;
      const block = typeof line.block === "number" && Number.isInteger(line.block) && line.block >= 0 && line.block < 1000 ? line.block : undefined;
      lines.push({ text: t, ...(isBox(line.box) ? { box: clamp(line.box) } : {}), ...(c !== undefined ? { confidence: c } : {}), ...(block !== undefined ? { block } : {}) });
    } else if (m.done && typeof m.done === "object") done = m.done as Record<string, unknown>;
    else if (m.error && typeof m.error === "object") error = m.error as Record<string, unknown>;
  }
  if (error || !done) {
    const o = cleanText(error?.outcome, 20);
    const outcome = (READ_OUTCOMES as readonly string[]).includes(o) && o !== "ok" ? (o as ReadOutcome) : "error";
    const why = cleanText(error?.why, 300) || (done ? "" : "the service said nothing of an end");
    const resets = cleanText(error?.resets, 40);
    return { outcome, transcript: "", lines: [], ...(why ? { why } : {}), ...(resets ? { resets } : {}) };
  }
  const unreadable = cleanText(done.unreadable, 40);
  const transcript = cleanText(done.transcript, 40_000) || lines.map((l) => l.text).join(" | ");
  const model = cleanText(done.model, 80);
  const c = done.cost as Record<string, unknown> | undefined;
  const cost = c && typeof c.amount === "number" && Number.isFinite(c.amount) && c.amount >= 0 && (c.unit === "usd" || c.unit === "credits") ? { amount: c.amount, unit: c.unit as "usd" | "credits", ...(c.partial === true ? { partial: true } : {}) } : undefined;
  return {
    outcome: unreadable ? "unreadable" : "ok",
    transcript: unreadable ? "" : transcript,
    lines: unreadable ? [] : lines,
    ...(model ? { model } : {}),
    ...(cost ? { cost } : {}),
    ...(unreadable ? { why: unreadable } : {}),
  };
}

// ── the fake service of the tests ─────────────────────────────────────────────────────────────────────────────────

/**
 * A service for tests without a network (as the script runner is an agent for them): STROM_READ_FAKE names its reply
 * (a file of JSON lines, parseReply), given back for every image; STROM_READ_FAKE_LOG, when set, gets each request
 * line it was given (and the image's size), for a test to look at. There only while STROM_READ_FAKE is set — never
 * offered to the Strom app (core/readchoice.ts offers the agents installed here).
 */
const fakeService: ReadProvider = {
  id: "fake",
  kind: "service",
  title: "Fake reading service",
  can: ["transcript"],
  ready: (env) => (env.STROM_READ_FAKE && fs.existsSync(env.STROM_READ_FAKE) ? { ready: true } : { ready: false, why: "not-set" }),
  models: () => [{ id: "", name: "" }],
  async read(input, o) {
    const request = requestLine(input, o.work);
    if (o.env.STROM_READ_FAKE_LOG) fs.appendFileSync(o.env.STROM_READ_FAKE_LOG, JSON.stringify({ ...(JSON.parse(request) as object), bytes: fs.statSync(input.image).size, inWork: path.dirname(input.image) === o.work }) + "\n");
    if (o.signal?.aborted) return { outcome: "stopped", transcript: "", lines: [] };
    return parseReply(fs.readFileSync(o.env.STROM_READ_FAKE!, "utf8"));
  },
};

// ── the registry ──────────────────────────────────────────────────────────────────────────────────────────────────

/** The services strom reads with (a reading service of its own comes here: one module each). */
const SERVICES: ReadProvider[] = [];

/** Every provider of reading here: the agents of RUNNERS, the services, the fake one while a test sets it. */
export function readProviders(env: Env): ReadProvider[] {
  return [...Object.keys(RUNNERS).map(agentProvider), ...SERVICES, ...(env.STROM_READ_FAKE ? [fakeService] : [])];
}

/** The provider of reading of an id, none when there is no such. */
export function readProvider(id: string, env: Env): ReadProvider | undefined {
  return readProviders(env).find((p) => p.id === id);
}

/** Whether a reader of this id is a service (reads the transcript alone). */
export function isService(id: string | undefined, env: Env): boolean {
  return !!id && readProvider(id, env)?.kind === "service";
}
