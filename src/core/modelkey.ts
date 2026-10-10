// One key of an agent and its model for everything strom measures and tunes of the reading of scans: the summary's
// units (core/readstats.ts), what strom set by itself (core/tune.ts: the user config's `tuning`, .strom/tune/state.json
// and its log), the answers of a person (core/tuneask.ts), the resets (core/tunereset.ts), the calibrations
// (`viewSizes`) and every lookup of them (strom media view, strom read, the brief, the readers).
//
// The key is the agent and the model it really ran on, as the agent said it ("claude claude-opus-5-5", "codex
// gpt-6-astra", "grok grok-4.7-build"; an agent that names none, Antigravity: "antigravity"; OpenCode's model as strom
// started it, provider and all). One model written otherwise is one key: trimmed, NFC, small letters, without Claude
// Code's mark of its context window ("[1m]") or a snapshot's date ("-20260801"). Another version is another key:
// opus 5 and opus 5.5 never share what was measured or set.
//
// What strom asks for is often an alias ("opus" of Claude Code, a setting "grok-4.7" the agent runs as
// "grok-4.7-build", no model at all for the agent's own): the model each alias was found to run on is kept in
// .strom/metrics/models.json — from the start of each session and reader (the model its agent says), and from the
// history (the summary's units keep what was asked and what was said) — with the time it was first seen, so that what
// was asked by an alias long ago goes with the model of its day. A lookup by the alias takes the model it runs on now;
// an alias nobody saw run yet is its own key. A model said counts for the alias only when it is one of it (its name
// holds the alias: "claude-opus-5-5" of "opus", "grok-4.7-build" of "grok-4.7") — never a model the agent fell back to.

import fs from "node:fs";
import path from "node:path";
import { readJsonIfExists, writeFileAtomic } from "./json.ts";

/** The key of what nothing says the agent and model of (an older view outside a session, a report of no session). */
export const UNKNOWN_KEY = "unknown";

/** Claude Code's names that stand for whatever model the account has (no family in them): any model said is theirs. */
const CLAUDE_ANY = new Set(["default", "best"]);

/**
 * A model as one key names it: trimmed, NFC, small letters; Claude Code's mark of the context window ("[1m]") and, of
 * Claude's models, a snapshot's date left out — the same model. Nothing said (or Claude Code's "<synthetic>"): none.
 */
export function modelId(agent: string, model: string | undefined): string | undefined {
  let m = typeof model === "string" ? model.normalize("NFC").trim() : "";
  if (!m || m.startsWith("<")) return undefined;
  m = m.replace(/\s*\[[^\]]*\]\s*$/u, "").trim().toLowerCase();
  if (agent === "claude") m = m.replace(/-[0-9]{8}$/u, "");
  return m || undefined;
}

/** The key of an agent and its model ("claude opus"; the agent alone: its own default model). */
export function calibrationKey(agent: string, model: string | undefined): string {
  const m = modelId(agent, model);
  return m ? `${agent} ${m}` : agent;
}

/** "claude opus" → its agent and model. */
export function splitKey(key: string): { agent: string; model?: string } {
  const [agent = "", ...rest] = key.split(" ");
  return rest.length ? { agent, model: rest.join(" ") } : { agent };
}

/** A key as one key names it, whoever wrote it (an older strom, "claude claude-opus-5-5[1m]", "Claude Opus"). */
export function normalKey(key: string): string {
  const k = typeof key === "string" ? key.normalize("NFC").trim() : "";
  if (!k || k === UNKNOWN_KEY) return UNKNOWN_KEY;
  const { agent, model } = splitKey(k);
  return calibrationKey(agent, model);
}

/** Whether a model the agent said is the one asked (an alias names it, a setting is a part of its name; none asked: any). */
export function fits(agent: string, asked: string | undefined, said: string): boolean {
  if (!asked || asked === said) return true;
  if (agent === "claude" && CLAUDE_ANY.has(asked)) return true;
  // OpenCode's provider/model: the model's own name
  const own = asked.includes("/") ? asked.slice(asked.lastIndexOf("/") + 1) : asked;
  return !!own && said.includes(own);
}

/** One model an alias was seen to run on, from when. */
export interface AliasEntry {
  key: string;
  at: string;
}

/** Per key asked (an alias, the agent alone), the models it ran on — the first time each was seen, oldest first. */
export type Aliases = Record<string, AliasEntry[]>;

export interface AliasPair {
  asked: string;
  key: string;
  at: string;
}

/** The file of the models the aliases ran on. */
export function aliasesFile(root: string): string {
  return path.join(root, ".strom", "metrics", "models.json");
}

/** The files the aliases of a research are found in: its own, and what was kept with the model said beside an alias. */
function aliasSources(root: string): string[] {
  return [aliasesFile(root), path.join(root, ".strom", "metrics", "rollup.json"), path.join(root, ".strom", "tune", "state.json"), path.join(root, ".strom", "tune", "answers.json")];
}

const cache = new Map<string, { stamp: string; aliases: Aliases }>();

/**
 * The aliases of a research as found so far (none: {}; never fails): its models.json, and what an older strom kept with
 * the model said beside an alias — the summary's units (what each asked, the model its agent said), the tuning set for
 * a book or an archive (with the model it was set for), the answers (the model of their basis). Read again only when one
 * of those files changed.
 */
export function loadAliases(root: string | undefined): Aliases {
  if (!root) return {};
  const files = aliasSources(root);
  let stamp = "";
  for (const f of files) {
    try {
      const st = fs.statSync(f);
      stamp += `${st.size}:${st.mtimeMs};`;
    } catch {
      stamp += "-;";
    }
  }
  const hit = cache.get(root);
  if (hit && hit.stamp === stamp) return structuredClone(hit.aliases);
  const out = readAliasesFile(files[0]!);
  mergeAliases(out, keptPairs(files[1]!, files[2]!, files[3]!));
  cache.set(root, { stamp, aliases: out });
  return structuredClone(out);
}

function readAliasesFile(file: string): Aliases {
  try {
    const raw = readJsonIfExists<{ aliases?: unknown }>(file);
    const a = raw && typeof raw === "object" ? raw.aliases : undefined;
    if (!a || typeof a !== "object" || Array.isArray(a)) return {};
    const out: Aliases = {};
    for (const [k, list] of Object.entries(a as Record<string, unknown>)) {
      if (!Array.isArray(list)) continue;
      const ok = list.filter((e): e is AliasEntry => !!e && typeof e === "object" && typeof (e as AliasEntry).key === "string" && typeof (e as AliasEntry).at === "string");
      if (ok.length) out[normalKey(k)] = ok.map((e) => ({ key: normalKey(e.key), at: e.at })).sort((x, y) => x.at.localeCompare(y.at));
    }
    return out;
  } catch {
    return {};
  }
}

/** The newest `at` anywhere in a value ("" none). */
function newestAt(v: unknown): string {
  let m = "";
  const walk = (o: unknown) => {
    if (!o || typeof o !== "object") return;
    const at = (o as { at?: unknown }).at;
    if (typeof at === "string" && at > m) m = at;
    for (const x of Object.values(o)) walk(x);
  };
  walk(v);
  return m;
}

/** The pairs the summary, the tuning and the answers of a research keep (each a key asked with the model said). */
function keptPairs(rollup: string, state: string, answers: string): AliasPair[] {
  const out: AliasPair[] = [];
  const read = (f: string): unknown => {
    try {
      return readJsonIfExists<unknown>(f);
    } catch {
      return undefined;
    }
  };
  const r = read(rollup) as { units?: { key?: unknown; asked?: unknown; reported?: unknown; at?: unknown }[] } | undefined;
  for (const u of Array.isArray(r?.units) ? r!.units : []) {
    const asked = typeof u?.asked === "string" ? u.asked : typeof u?.key === "string" ? u.key : undefined;
    const p = asked && typeof u.reported === "string" ? aliasPair(asked, u.reported, typeof u.at === "string" ? u.at : "") : undefined;
    if (p && p.at) out.push(p);
  }
  const s = read(state);
  if (s && typeof s === "object")
    for (const [k, tt] of Object.entries(s as Record<string, { reported?: unknown }>)) {
      const p = typeof tt?.reported === "string" ? aliasPair(k, tt.reported, newestAt(tt)) : undefined;
      if (p && p.at) out.push(p);
    }
  const a = read(answers);
  if (a && typeof a === "object")
    for (const [k, slots] of Object.entries(a as Record<string, Record<string, { basis?: { reported?: unknown }; at?: unknown }>>))
      for (const x of Object.values(slots ?? {})) {
        const p = typeof x?.basis?.reported === "string" ? aliasPair(k, x.basis.reported, typeof x.at === "string" ? x.at : "") : undefined;
        if (p && p.at) out.push(p);
      }
  return out;
}

/**
 * The pair a key asked and a model said make: the alias and the model it ran on — none when the model said is not one
 * of what was asked, nothing was said, or it is the key itself.
 */
export function aliasPair(asked: string, said: string | undefined, at: string): AliasPair | undefined {
  const a = normalKey(asked);
  if (a === UNKNOWN_KEY) return undefined;
  const { agent, model } = splitKey(a);
  const id = modelId(agent, said);
  if (!id || !fits(agent, model, id)) return undefined;
  const key = `${agent} ${id}`;
  return key === a ? undefined : { asked: a, key, at };
}

/** The pairs added to the aliases (each model with the first time it was seen); whether anything changed. */
export function mergeAliases(into: Aliases, pairs: AliasPair[]): boolean {
  let changed = false;
  for (const p of pairs) {
    if (!p.at || p.key === p.asked) continue;
    const list = (into[p.asked] ??= []);
    const same = list.find((e) => e.key === p.key);
    if (same) {
      if (p.at < same.at) {
        same.at = p.at;
        changed = true;
      }
      continue;
    }
    list.push({ key: p.key, at: p.at });
    changed = true;
  }
  if (changed) for (const list of Object.values(into)) list.sort((x, y) => x.at.localeCompare(y.at));
  return changed;
}

/**
 * The pairs kept beside the research (read again just before: another strom may have written meanwhile; written whole
 * or not at all, only when something is new). Never fails: what cannot be kept is found again from the history.
 */
export function noteAliases(root: string, pairs: AliasPair[]): Aliases {
  // what the file says, and what the research kept beside an alias besides (written into it too: it outlives them)
  const now = loadAliases(root);
  const merged = mergeAliases(now, pairs);
  try {
    if (merged || JSON.stringify(now) !== JSON.stringify(readAliasesFile(aliasesFile(root)))) {
      fs.mkdirSync(path.dirname(aliasesFile(root)), { recursive: true });
      writeFileAtomic(aliasesFile(root), JSON.stringify({ version: 1, aliases: now }, null, 1) + "\n");
    }
  } catch {
    // found again from the history next time
  }
  return now;
}

/**
 * The key a key stands for: itself written as one key, an alias the model it ran on (at a time: the model of that
 * time — the first one seen before it, else the first ever; no time: the one it runs on now).
 */
export function resolveKey(key: string, aliases: Aliases | undefined, at?: string): string {
  const k = normalKey(key);
  const list = aliases?.[k];
  if (!list?.length) return k;
  if (!at) return list.at(-1)!.key;
  let pick = list[0]!;
  for (const e of list) if (e.at <= at) pick = e;
  return pick.key;
}

/**
 * The key of what was measured or set under a key asked, with the model the agent said: that model where it is one of
 * what was asked, else the key asked resolved (an alias: the model of its day).
 */
export function keyOf(asked: string, said: string | undefined, aliases: Aliases | undefined, at?: string): string {
  const a = normalKey(asked);
  if (a === UNKNOWN_KEY) return a;
  const p = aliasPair(a, said, at ?? "");
  return p ? p.key : resolveKey(a, aliases, at);
}

/**
 * The names a record kept by key has for one key: itself, and those an older strom kept it under (an alias, a model
 * written otherwise) — the key itself first. `said` gives the model a value was set for, where it keeps one.
 */
export function keysFor<T>(rec: Record<string, T> | undefined, key: string, aliases: Aliases | undefined, said?: (v: T) => string | undefined): string[] {
  if (!rec) return [];
  const out: string[] = [];
  if (Object.prototype.hasOwnProperty.call(rec, key)) out.push(key);
  for (const [k, v] of Object.entries(rec)) if (k !== key && keyOf(k, said?.(v), aliases) === key) out.push(k);
  return out;
}

/** The value a record kept by key has for one key: its own, else the first an older strom kept it under. */
export function keyed<T>(rec: Record<string, T> | undefined, key: string, aliases: Aliases | undefined, said?: (v: T) => string | undefined): T | undefined {
  const k = keysFor(rec, key, aliases, said)[0];
  return k === undefined ? undefined : rec![k];
}
