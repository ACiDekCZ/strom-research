// An archive left alone for a while (it went silent, or asked twice to slow down: core/net.ts) is said once to a
// session's fetch — exit 7, until when, what to do meanwhile. Found in a live run: an agent ran the same fetch again
// 78 times in 38 minutes, each answered "left alone until …" with nothing sent. So a session is told once: the hosts a
// fetch of the session was told are left alone are kept beside the research (.strom/left-alone/<N…>.json — what strom
// keeps for itself, never data/), and a fetch of the same session asking such a host again while that same time off
// lasts ends at once (strom fetch: exit 8), before anything else. A time off strom set since (a new silence) is a new
// answer, told once again. Forgotten by itself: a host that takes requests again (its time over, the person lifted
// it) counts no more, and the file goes with its session (core/session.ts) or once nothing in it lasts.
//
// The queue too: an open task whose books lie only on hosts left alone now waits out of it until the first of them
// takes requests again (core/queue.ts) — computed from the limiter's state, nothing written: a session on it would
// only be told so, and the next one again. strom run --loop waits for that time when nothing else is to do.

import fs from "node:fs";
import path from "node:path";
import type { Task } from "./model.ts";
import type { Tree } from "./tree.ts";
import { Settings } from "./config.ts";
import { hostState, knownHosts, leftAloneFor } from "./net.ts";
import { onHost, setHosts } from "./archivewait.ts";
import { taskRecordsets } from "./frontier.ts";

/** A host a fetch of the session was told is left alone: until when (ms, rounded up to the minute as it was said), when told. */
export interface Told {
  until: number;
  at: number;
}

function toldFile(root: string, session: string): string {
  return path.join(root, ".strom", "left-alone", `${session}.json`);
}

/** The hosts this session was told are left alone (a file broken or of another shape: none). */
export function toldLeftAlone(root: string, session: string): Map<string, Told> {
  const out = new Map<string, Told>();
  try {
    const j = JSON.parse(fs.readFileSync(toldFile(root, session), "utf8")) as { hosts?: Record<string, { until?: unknown; at?: unknown }> };
    for (const [host, t] of Object.entries(j.hosts ?? {}))
      if (t && typeof t.until === "number" && Number.isFinite(t.until) && typeof t.at === "number" && Number.isFinite(t.at)) out.set(host, { until: t.until, at: t.at });
  } catch {
    // none told yet
  }
  return out;
}

/** A fetch of the session was told the host is left alone until then: kept (what is over by now goes). */
export function noteLeftAlone(root: string, session: string, host: string, until: number, now = Date.now()): void {
  try {
    const all = toldLeftAlone(root, session);
    all.set(host, { until, at: now });
    const kept = Object.fromEntries([...all].filter(([, t]) => t.until > now));
    const file = toldFile(root, session);
    if (!Object.keys(kept).length) return void fs.rmSync(file, { force: true });
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify({ hosts: kept }) + "\n");
    fs.renameSync(tmp, file);
  } catch {
    // nothing kept: the next fetch is told again (exit 7), as before
  }
}

/** The session ended: what it was told goes with it. */
export function forgetLeftAlone(root: string, session: string): void {
  fs.rmSync(toldFile(root, session), { force: true });
}

/**
 * Of the hosts a fetch would ask (`now` of each: until when it is left alone now, undefined: it takes requests), the
 * one this session was told already is left alone, with the same time off still lasting — the host and until when.
 */
export function askedAgain(root: string, session: string, hosts: { host: string; until: number }[]): { host: string; until: number } | undefined {
  if (!hosts.length) return undefined;
  const told = toldLeftAlone(root, session);
  // the time off as it was said (rounded up to its minute): a longer one strom set since is not the one told
  return hosts.find((h) => {
    const t = told.get(h.host);
    return !!t && h.until <= t.until;
  });
}

// ── the queue ────────────────────────────────────────────────────────────────

/** A host left alone now, and until when (ms). */
export interface Asleep {
  host: string;
  until: number;
}

/**
 * The hosts the limiter leaves alone now because they went silent or asked to slow down (core/net.ts leftAloneFor) —
 * never one that refused strom: only the person lifts that. Read from the shared folder's net/ (the tree's settings
 * say where); nothing readable: none.
 */
export function asleepHosts(tree: Tree, now = Date.now()): Asleep[] {
  let dir: string | undefined;
  try {
    const shared = new Settings(tree.env, {}).shared()?.value;
    dir = shared ? path.join(shared, "net") : undefined;
  } catch {
    return [];
  }
  if (!dir) return [];
  const out: Asleep[] = [];
  try {
    for (const host of knownHosts(dir)) {
      try {
        const until = leftAloneFor(hostState(dir, host, now), now);
        if (until) out.push({ host, until });
      } catch {
        // a host's state unreadable: it holds nothing back
      }
    }
  } catch {
    // no state to read
  }
  return out;
}

/**
 * The host an open task waits for: every record set of it with an address lies on a host left alone now (at least
 * one) — the one that takes requests again first (any of its books back, the task can go on), else undefined.
 */
export function asleepOn(tree: Tree, t: Task, asleep: Asleep[]): Asleep | undefined {
  if (!asleep.length) return undefined;
  let first: Asleep | undefined;
  for (const b of taskRecordsets(tree, t).sets) {
    const hosts = setHosts(tree, b);
    if (!hosts.length) continue;
    const on = asleep.filter((a) => hosts.some((h) => onHost(h, a.host))).sort((x, y) => x.until - y.until)[0];
    if (!on) return undefined; // a book elsewhere: the task can go on there
    if (!first || on.until < first.until) first = on;
  }
  return first;
}
