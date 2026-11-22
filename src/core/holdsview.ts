// What the holds of tasks and of restricted archives (spec 127, core/holds.ts, core/archiveholds.ts) say to the one who
// looks: the bridge's /status (working[].hold and waits, the queue's heldBy and archiveHeld — features task.holds and
// archive.holds) and the menu's line of who works. Read only: nothing is taken over, let go or written here.

import fs from "node:fs";
import path from "node:path";
import type { Env } from "./paths.ts";
import type { Session, Task } from "./model.ts";
import type { Tree } from "./tree.ts";
import type { Life } from "./holds.ts";
import { heldSessions } from "./holds.ts";
import { lifeOf, openSessions } from "./session.ts";
import { heldSiteOfTask, heldSites, holdsDir, type SiteClaim } from "./archiveholds.ts";
import { PROFILES } from "../agents/profiles.ts";
import { phrase } from "./phrases.ts";
import type { Paused } from "./workers.ts";

/** A session's hold as the app is told it: who started it, since when, its last sign of life, free by when at the latest. */
export interface HoldView {
  by: "run" | "chat" | "agent";
  since: string;
  /** Its last sign of life. */
  beat: string;
  /** Free by then at the latest with no further sign; none: a live process on this computer holds it — free when it ends. */
  until?: string;
}

/** A run waiting for a restricted archive another session uses (spec 127 K2.3): which, since when, until when at most. */
export interface WaitsView {
  archive: string;
  since: string;
  /** When the run stops waiting at the latest (archive.wait, or its own end). */
  until: string;
}

/** A task held by an open session, as the queue says it. */
export interface HeldByView {
  session: string;
  /** The agent's name ("Claude Code"), else what holds it in the research's words. */
  who: string;
  by: HoldView["by"];
  since: string;
  beat: string;
  until?: string;
}

/** A task whose every record set lies on a restricted archive another session uses now (or another waits for first). */
export interface ArchiveHeldView {
  site: string;
  /** Free by then at the latest. */
  until: string;
  /** A session of this research holds it (its ID in session); false: another research, or strom fetch of another. */
  own: boolean;
  by: "run" | "chat" | "agent" | "fetch" | "waiting";
  session?: string;
  since?: string;
  beat?: string;
}

const iso = (ms: number) => new Date(ms).toISOString();

/** A session's life as a hold for the app (undefined: no hold of strom's — an older strom's worker alone). */
export function holdView(s: Session, life: Life): HoldView | undefined {
  if (!life.hold && (s.worker || s.runner)) return undefined;
  const since = life.hold && Number.isFinite(Date.parse(life.hold.since)) ? life.hold.since : s.started;
  return {
    by: life.hold?.by ?? (s.runner ? "run" : s.worker ? "chat" : "agent"),
    since,
    beat: iso(life.lastSign),
    ...(life.here || life.until === undefined ? {} : { until: iso(life.until) }),
  };
}

/** The wait of a run for an archive, from its pause (core/workers.ts). */
export function waitsView(p: Paused | undefined): WaitsView | undefined {
  return p?.archive && p.since ? { archive: p.archive, since: p.since, until: p.until } : undefined;
}

/** An agent's name for people: its profile's ("Claude Code"), else its id, else none. */
function agentName(s: Session): string | undefined {
  return s.agent ? (PROFILES[s.agent]?.name ?? s.agent) : undefined;
}

/** Who works directly (no run, no conversation strom started), in the research's words: "Claude Code – directly". */
export function whoDirect(s: Session, lang: string): string {
  return phrase(lang, "who.agent", { agent: agentName(s) ?? phrase(lang, "who.someone") });
}

/**
 * The sessions of agents working directly (strom started neither a run nor a conversation for them) that live now:
 * those strom keeps a hold of, alive (core/holds.ts). From the holds alone — never every session of the research.
 */
export function directAtWork(tree: Tree, now = Date.now()): { session: Session; life: Life }[] {
  const out: { session: Session; life: Life }[] = [];
  for (const id of heldSessions(tree.root)) {
    let s: Session | undefined;
    try {
      s = tree.get<Session>(id);
    } catch {
      continue; // (one being written)
    }
    if (!s || s.state !== "open" || s.worker || s.runner) continue;
    const life = lifeOf(tree, s, now);
    if (life.alive) out.push({ session: s, life });
  }
  return out.sort((a, b) => a.session.started.localeCompare(b.session.started));
}

/** The tasks open sessions hold now (alive), each with who holds it. */
export function heldTasks(tree: Tree, open: Session[] = openSessions(tree), now = Date.now()): Map<string, HeldByView> {
  const out = new Map<string, HeldByView>();
  for (const s of open) {
    if (!s.task) continue;
    const life = lifeOf(tree, s, now);
    if (!life.alive) continue;
    const hold = holdView(s, life) ?? { by: s.runner ? ("run" as const) : ("chat" as const), since: s.started, beat: iso(life.lastSign) };
    const who = agentName(s) ?? (hold.by === "agent" ? phrase(tree.lang, "who.someone") : hold.by === "run" ? phrase(tree.lang, "who.run", { agent: phrase(tree.lang, "who.someone") }) : phrase(tree.lang, "who.chat", { agent: phrase(tree.lang, "who.someone") }));
    out.set(s.task, { session: s.id, who, ...hold });
  }
  return out;
}

/** The restricted archives held now by anybody (or with one waiting first), for the queue to say which tasks wait for them. */
export function heldArchives(tree: Tree, shared: string | undefined, env: Env = tree.env, now = Date.now()): Map<string, Exclude<SiteClaim, { ok: true }>> {
  if (!shared) return new Map();
  try {
    // nobody's hold: the bridge holds nothing and waits for nothing (pid -1: no process of its own)
    return heldSites(shared, { tree: tree.root, by: "run", pid: -1 }, env, now);
  } catch {
    return new Map();
  }
}

/** A task's archive another uses now, as the queue says it (none: it needs no archive held, or can go on elsewhere). */
export function archiveHeldOf(tree: Tree, t: Task, held: Map<string, Exclude<SiteClaim, { ok: true }>>): ArchiveHeldView | undefined {
  if (!held.size) return undefined;
  let site: string | undefined;
  try {
    site = heldSiteOfTask(tree, t, held);
  } catch {
    return undefined;
  }
  const c = site ? held.get(site) : undefined;
  if (!site || !c) return undefined;
  if (!c.hold) return { site, until: iso(c.until), own: path.resolve(c.waiter.tree) === path.resolve(tree.root), by: "waiting" };
  const own = path.resolve(c.hold.tree) === path.resolve(tree.root);
  return {
    site,
    until: iso(Math.max(c.life.until, Date.now())),
    own,
    by: c.hold.by,
    ...(own && c.hold.session ? { session: c.hold.session } : {}),
    since: iso(c.life.since),
    beat: iso(c.life.lastSign),
  };
}

/** The holds of the research and of the shared folder as they are now, for the bridge to tell a change (names and times). */
export function holdsStamp(root: string, shared: string | undefined): string {
  const stamp = (dir: string, keep: (f: string) => boolean) => {
    try {
      return fs
        .readdirSync(dir)
        .filter(keep)
        .sort()
        .map((f) => {
          try {
            return `${f}@${fs.statSync(path.join(dir, f)).mtimeMs}`;
          } catch {
            return f;
          }
        })
        .join(",");
    } catch {
      return "";
    }
  };
  const own = stamp(path.join(root, ".strom", "holds"), (f) => f.endsWith(".json"));
  const sites = shared ? stamp(holdsDir(shared), (f) => f.endsWith(".json") || f.endsWith(".free") || f.endsWith(".wait")) : "";
  return own || sites ? `${own}|${sites}` : "";
}
