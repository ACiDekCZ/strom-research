// Work that waits for the person's decision about an archive's images (core/terms.ts keeps the question, one per host,
// shared by every tree of this computer). Nobody answers it for days — and every session that tries the archive again
// costs money and finds nothing. So:
//
//   · the queue holds back an open task whose record sets lie only on a host with such a question and that lacks the
//     images it needs (core/queue.ts) — computed, nothing written: it comes back the moment the question is gone;
//   · a fetch that met the question inside a session notes it beside the research (.strom/archive-waits/<N…>.json,
//     never data/: a failed command takes back what it wrote); when that session ends unfinished (--continue,
//     interrupted) its task waits for the decision (Task.awaitsPermission, an optional field an older strom keeps and
//     ignores) instead of going back to the queue; parked by the agent or by a run's idle rule on such a host, it says
//     the host too;
//   · every way the person decides (the menu, strom allow archive --way, the window of a fetch, a fetch that may go
//     now) wakes, in every research here, the tasks that waited for that host — each tree under its own lock, the
//     images saved by hand into a task's folder first (the research registers them, nothing fetched twice).

import fs from "node:fs";
import path from "node:path";
import type { RecordSet, Repository, Task } from "./model.ts";
import type { Env } from "./paths.ts";
import { now, newerTree, Tree } from "./tree.ts";
import { isArchive } from "./mode.ts";
import { webDomain } from "./metrics.ts";
import { collectFiles } from "./media.ts";
import { loadArchives, pendingQuestions, type PendingQuestion } from "./terms.ts";
import { taskRecordsets } from "./frontier.ts";
import { phrase } from "./phrases.ts";

function urlHost(u: string | undefined): string | undefined {
  if (!u) return undefined;
  try {
    return new URL(u).hostname.toLowerCase();
  } catch {
    return undefined;
  }
}

/** Is an address's host the archive's host — the host, a subdomain of it, or the same site (its registrable domain)? */
export function onHost(h: string | undefined, host: string): boolean {
  return !!h && (h === host || h.endsWith(`.${host}`) || webDomain(h) === webDomain(host));
}

/** The hosts a record set's images come from: its own address, its archive's. */
export function setHosts(tree: Tree, b: RecordSet | undefined): string[] {
  if (!b) return [];
  const r = b.repository ? tree.get<Repository>(b.repository) : undefined;
  return [urlHost(b.url), urlHost(r?.url)].filter((h): h is string => !!h);
}

/** The questions about an archive's images that wait for the person now (none in an archive: no agent works there). */
export function permissionQuestions(env: Env): PendingQuestion[] {
  try {
    return pendingQuestions(env).filter((q) => q.kind === "permission" && !!q.host);
  } catch {
    return [];
  }
}

/**
 * The question an open task waits for, when every record set of it with an address lies on a host whose images wait
 * for the person (at least one) — the caller decides whether the task lacks the images it needs.
 */
export function heldOn(tree: Tree, t: Task, qs: PendingQuestion[]): PendingQuestion | undefined {
  if (!qs.length) return undefined;
  let found: PendingQuestion | undefined;
  for (const b of taskRecordsets(tree, t).sets) {
    const hosts = setHosts(tree, b);
    if (!hosts.length) continue;
    const q = qs.find((x) => hosts.some((h) => onHost(h, x.host!)));
    if (!q) return undefined; // a book elsewhere: the task can go on there
    found ??= q;
  }
  return found;
}

/** Has the person decided nothing for the host yet (no way kept: slowly, browser, by hand)? */
export function undecided(env: Env, host: string): boolean {
  try {
    return !loadArchives(env).archives[host]?.way;
  } catch {
    return true;
  }
}

// ── what a session met ───────────────────────────────────────────────────────

export interface SessionWait {
  task: string;
  hosts: { host: string; title?: string; at: string }[];
}

function waitsFile(root: string, session: string): string {
  return path.join(root, ".strom", "archive-waits", `${session}.json`);
}

/** A fetch in a session met a question the person has not answered: kept for the session's task (merged, first time kept). */
export function noteSessionWait(root: string, session: string, task: string, hosts: { host: string; title?: string }[]): void {
  try {
    const had = sessionWait(root, session);
    const kept = had?.task === task ? had.hosts : [];
    const at = new Date().toISOString();
    const all = [...kept, ...hosts.filter((h) => !kept.some((k) => k.host === h.host)).map((h) => ({ host: h.host, ...(h.title ? { title: h.title } : {}), at }))];
    const file = waitsFile(root, session);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify({ task, hosts: all } satisfies SessionWait) + "\n");
    fs.renameSync(tmp, file);
  } catch {
    // nothing kept: the queue still holds the task back while the question waits
  }
}

export function sessionWait(root: string, session: string): SessionWait | undefined {
  try {
    const j = JSON.parse(fs.readFileSync(waitsFile(root, session), "utf8")) as Partial<SessionWait>;
    if (typeof j.task !== "string" || !Array.isArray(j.hosts)) return undefined;
    return { task: j.task, hosts: j.hosts.filter((h) => h && typeof h.host === "string" && typeof h.at === "string") };
  } catch {
    return undefined;
  }
}

export function clearSessionWait(root: string, session: string): void {
  fs.rmSync(waitsFile(root, session), { force: true });
}

/**
 * What a task waits for when its session ends unfinished, or it is put aside, on archives whose question is still not
 * decided: the hosts its session met (undecided still, their question still waiting for the person — one gone since, a
 * connector taken away with it, leaves nothing to wait for), else — `queue` — those the queue holds it back for.
 * Undefined: none.
 */
export function permissionWait(tree: Tree, t: Task, session: string | undefined, o: { queue?: boolean } = {}): NonNullable<Task["awaitsPermission"]> | undefined {
  const met = session ? sessionWait(tree.root, session) : undefined;
  const asked = met?.task === t.id ? permissionQuestions(tree.env) : [];
  const hosts = met?.task === t.id ? met.hosts.filter((h) => undecided(tree.env, h.host) && asked.some((q) => onHost(h.host, q.host!))) : [];
  if (hosts.length) return { hosts: hosts.map((h) => h.host), since: hosts[0]!.at, ...(hosts[0]!.title ? { title: hosts[0]!.title } : {}) };
  if (!o.queue) return undefined;
  const q = heldOn(tree, t, permissionQuestions(tree.env));
  return q ? { hosts: [q.host!], since: q.at, ...(q.title ? { title: q.title } : {}) } : undefined;
}

/** The task as it waits for the person's decision (the text the person reads, in the research language). */
export function waitingForDecision(tree: Tree, t: Task, w: NonNullable<Task["awaitsPermission"]>): Task {
  // a new wait: what the agent said of an earlier one (its kind, whom, sent) is not this one's
  const { wait: _w, sent: _s, ...rest } = t;
  return { ...rest, state: "waiting", awaitsPermission: w, waitingOn: phrase(tree.lang, "archive.wait", { title: w.title ?? w.hosts[0]! }) };
}

// ── waking ───────────────────────────────────────────────────────────────────

/** A task that waits for (or was put aside over) an archive's host: its images by hand, or the person's decision. */
export function waitsOnHost(tree: Tree, t: Task, host: string): "images" | "decision" | undefined {
  if (t.state !== "waiting" && t.state !== "parked") return undefined;
  if (t.awaitsPermission?.hosts.some((h) => onHost(h, host))) return t.awaits ? "images" : "decision";
  if (t.state !== "waiting" || !t.awaits) return undefined;
  const b = tree.get<RecordSet>(t.awaits.recordset);
  return setHosts(tree, b).some((h) => onHost(h, host)) ? "images" : undefined;
}

/** The images already saved into a task's inbox folder (the person did it by hand meanwhile). */
export function savedInInbox(shared: string | undefined, t: Task): string[] {
  if (!shared || !t.awaits) return [];
  const dir = path.join(shared, "inbox", t.awaits.folder);
  try {
    return fs.existsSync(dir) ? collectFiles([dir]) : [];
  } catch {
    return [];
  }
}

export interface Woken {
  root: string;
  name: string;
  /** Back in the queue. */
  woken: string[];
  /** Their images are in their folder already: left for the research to register (they come back by themselves). */
  inbox: { id: string; n: number }[];
  /** By hand only: they keep waiting for the images saved by hand. */
  kept: string[];
}

/**
 * The person decided an archive's images: in every research here (`roots`; an archive, a research a newer strom wrote,
 * one strom cannot open now left as they are), the tasks that waited for the host come back — each tree under its own
 * lock, read afresh, committed. `way` manual: the tasks that wait for images saved by hand keep waiting; those that
 * waited only for the decision come back (their session says which images, by hand). `dry`: only said.
 */
export function wakeForArchive(env: Env, roots: string[], host: string, o: { shared?: string; way?: "slow" | "browser" | "manual"; dry?: boolean } = {}): Woken[] {
  const out: Woken[] = [];
  for (const root of [...new Set(roots)]) {
    let tree: Tree;
    try {
      if (newerTree(root, env)) continue;
      tree = Tree.open(root, env);
    } catch {
      continue;
    }
    if (isArchive(tree)) continue;
    const look = (): Woken => {
      const r: Woken = { root, name: tree.config.name, woken: [], inbox: [], kept: [] };
      for (const t of tree.list<Task>("task")) {
        const why = waitsOnHost(tree, t, host);
        if (!why) continue;
        // a check of a site waits for the person's own answer, never woken round it
        if (t.state === "waiting" && t.awaitsCheck) continue;
        const saved = o.way === "manual" && why === "images" ? [] : savedInInbox(o.shared, t);
        if (o.way === "manual" && why === "images") r.kept.push(t.id);
        else if (saved.length) r.inbox.push({ id: t.id, n: saved.length });
        else r.woken.push(t.id);
      }
      return r;
    };
    try {
      const r = o.dry
        ? look()
        : tree.withTreeLock(() => {
            const r = look();
            if (!r.woken.length) return r;
            for (const id of r.woken) {
              const t = tree.get<Task>(id)!;
              const { waitingOn: _w, awaits: _a, awaitsPermission: _p, parkedUntil: _u, parkedReason: _r, wait: _k, sent: _s, ...rest } = t;
              tree.put({ ...rest, state: "open", updated: now() } as Task, { op: "task.wake", targets: [id], summary: `${id} wake: the person decided the images of ${host}` });
            }
            tree.commit(`Tasks back in the queue: the person decided the images of ${host} (${r.woken.join(", ")})`);
            return r;
          });
      if (r.woken.length || r.inbox.length || r.kept.length) out.push(r);
    } catch {
      // a tree busy or broken now: its tasks wait for the next decision or the person's wake
    }
  }
  return out;
}
