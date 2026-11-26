// Return a waiting task to the agent from What waits (spec 089): images of an archive only the browser goes to, where
// the agent could manage alone once something changed — its browser held the downloads back, the agent's session ended
// mid-way, the person saved nothing by hand yet but the agent's browser reaches the archive, or a viewer strom media save
// does not know (the agent reads it from the screen only). Never a letter, the family, a check of a site, an archive's
// permission, a request sent, nor a proposal of a transcript; never in an archive. The person's alone (strom task wake
// --retry: the menu's What waits, the Strom app through the bridge) — at most RETRY_MAX returns a day, so a cause that
// lasts never loops; what the task waits on now said beside it (K3.1), with its images (K2.1).

import type { Task, RecordSet } from "./model.ts";
import type { Tree } from "./tree.ts";
import { Settings } from "./config.ts";
import { actsAsArchive } from "./state.ts";
import { taskUrlOf, waitKindOf, waitPhaseOf, type WaitGroup } from "./waitkind.ts";
import { agentSaveWait } from "./ownsave.ts";
import { loadSaves, type SaveRecord } from "./browser.ts";
import { heldTasks, type HeldByView } from "./holdsview.ts";
import { bookBrowserArchive, browserState, type BrowserState } from "./browserhelp.ts";
import { browserConnectors } from "./connector.ts";
import { knownScreenOnly, type KnownTerms } from "./knownterms.ts";
import { knownTerms } from "./terms.ts";
import { awaitedMissing, inboxState } from "./inboxwait.ts";
import { parseImageList } from "./media.ts";
import { phrase } from "./phrases.ts";
import { PROFILES } from "../agents/profiles.ts";
import { humanWhen } from "../cli/human.ts";

/** At most this many returns of one task within RETRY_WINDOW_MS — a cause that lasts never loops. */
export const RETRY_MAX = 3;
export const RETRY_WINDOW_MS = 24 * 3600_000;
/** How many times a task keeps (Task.retried.times). */
export const RETRY_KEPT = 5;

/**
 * Why it waits now, as the agent could go on: held (the browser held the downloads back), stopped (the agent's session
 * ended while its browser saved), screen (a viewer media save does not know, its browser ready), or the state of the
 * agent's browser for images saved by hand (ready, no-extension, agent-without-browser).
 */
export type RetryWhy = "held" | "stopped" | "screen" | BrowserState;

export interface RetryView {
  why: RetryWhy;
  /** Only read from the screen: no image is saved (a viewer strom media save does not know). */
  screen?: true;
  /** The archive's host (held: the one that held the downloads back). */
  host?: string;
  /** The images still missing; left out when not known. */
  images?: number;
  /** Why it waits now, in the research language (impersonal). */
  says: string;
  /** Returned before and waits again (the last return). */
  again?: { at: string };
  /** False: RETRY_MAX returns within RETRY_WINDOW_MS — not before `until`. */
  can: boolean;
  until?: string;
}

/** What one look at What waits reads once for all its tasks (filled as needed). */
export interface RetryCache {
  shared?: string | undefined;
  saves?: SaveRecord[];
  holders?: Map<string, HeldByView>;
  agent?: string | undefined;
  now?: number;
  terms?: KnownTerms[];
  /** The hosts of the connectors whose images come through the browser. */
  hosts?: string[];
  state?: ReturnType<typeof browserState>;
}

const site = (h: string) =>
  h
    .toLowerCase()
    .replace(/^\*\./u, "")
    .replace(/^www\./u, "");

/** Whether a host belongs to one of the connectors whose images come through the browser. */
function viaConnector(tree: Tree, c: RetryCache, url: string | undefined): boolean {
  if (!url || !URL.canParse(url)) return false;
  c.hosts ??= browserConnectors(tree.env, c.shared).flatMap((x) => x.manifest.hosts.map(site));
  const host = site(new URL(url).hostname);
  return c.hosts.some((h) => host === h || host.endsWith(`.${h}`));
}

/** The returns of a task within the window, the oldest first. */
function recent(t: Task, now: number): string[] {
  return (t.retried?.times ?? []).filter((x) => Number.isFinite(Date.parse(x)) && now - Date.parse(x) < RETRY_WINDOW_MS).sort();
}

/** Whether it may be returned now; when not, until when. */
export function retryLimit(t: Task, now = Date.now()): { can: boolean; until?: string } {
  const r = recent(t, now);
  if (r.length < RETRY_MAX) return { can: true };
  return { can: false, until: new Date(Date.parse(r[r.length - RETRY_MAX]!) + RETRY_WINDOW_MS).toISOString() };
}

/** A time of today as HH:MM, another day's with its day. */
function when(iso: string, lang: string, now: number): string {
  const d = new Date(iso);
  const n = new Date(now);
  const hm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate() ? hm : humanWhen(iso, lang);
}

/** The images of the task still missing; undefined when not known. */
function missingImages(tree: Tree, c: RetryCache, t: Task): number | undefined {
  if (!t.awaits) return undefined;
  const inbox = inboxState(tree, c.shared, t);
  if (inbox && inbox.want > 0) return inbox.missing.length;
  const asked = parseImageList(t.awaits.images);
  if (!asked?.length) return undefined;
  return awaitedMissing(tree, t, asked).length;
}

/**
 * Whether a waiting task may be returned to the agent from What waits, and why it waits now — undefined where it is no
 * work the agent could manage alone (see the file's head). `group` and `url` as What waits has them, else found here.
 */
export function retryOf(tree: Tree, t: Task, c: RetryCache = {}, at?: { group?: WaitGroup; url?: string | undefined }): RetryView | undefined {
  if (t.state !== "waiting" || t.proposal || t.awaitsCheck || (t.awaitsPermission && !t.awaits)) return undefined;
  if (waitPhaseOf(t) !== "todo") return undefined;
  const kind = waitKindOf(t);
  if (kind === "letter" || kind === "family" || kind === "check" || kind === "permission") return undefined;
  if (actsAsArchive(tree)) return undefined;
  const now = c.now ?? Date.now();
  const lang = tree.lang;
  const agentName = () => {
    c.agent ??= new Settings(tree.env, {}).agent(tree.config).value;
    return c.agent;
  };
  const browser = () => (c.state ??= browserState(tree.env, agentName(), tree.root));
  const stateSays = (s: BrowserState, archive: string) =>
    s === "ready"
      ? phrase(lang, "retry.ready", { archive })
      : s === "no-extension"
        ? phrase(lang, "retry.noext")
        : phrase(lang, "retry.agent", { agent: PROFILES[agentName() as keyof typeof PROFILES]?.name ?? agentName() ?? "?" });

  let view: Omit<RetryView, "says" | "can" | "until" | "again"> & { says: string } | undefined;
  // the agent's browser saved them: held back by the browser, or its session ended mid-way
  c.saves ??= loadSaves(tree.root);
  const own = agentSaveWait(tree, t, c.saves);
  if (own) {
    if (own.held.length) view = { why: "held", host: own.held[0]!.host, images: own.missing.length, says: phrase(lang, "retry.held", { host: own.held[0]!.host }) };
    else {
      c.holders ??= heldTasks(tree);
      if (c.holders.has(t.id)) return undefined; // its session goes on with it
      view = { why: "stopped", host: own.saves[0]?.host ?? "", images: own.missing.length, says: phrase(lang, "retry.stopped") };
      if (!view.host) delete view.host;
    }
  }
  const url = at && "url" in at ? at.url : taskUrlOf(tree, t, at?.group);
  if (!view && url && knownScreenOnly(url, (c.terms ??= knownTerms(tree.env)))) {
    // a viewer strom media save does not know: its images only read from the screen
    const a = bookBrowserArchive(tree, url, c.shared);
    if (!a?.permitted) return undefined;
    const s = browser().state;
    const archive = a.title ?? a.host;
    const images = missingImages(tree, c, t);
    view = {
      why: s === "ready" ? "screen" : s,
      screen: true,
      host: a.host,
      ...(images !== undefined ? { images } : {}),
      says: s === "ready" ? phrase(lang, "retry.screen", { archive }) : `${stateSays(s, archive)}; ${phrase(lang, "retry.screen.note")}`,
    };
  }
  if (!view && t.awaits) {
    // images to be saved by hand of a book the agent's browser may go to
    const book = webUrlOf(tree.get<RecordSet>(t.awaits.recordset)?.url) ?? url;
    const a = bookBrowserArchive(tree, book, c.shared);
    const host = book && URL.canParse(book) ? new URL(book).hostname.toLowerCase() : undefined;
    if (!a?.permitted && !viaConnector(tree, c, book)) return undefined;
    const s = browser().state;
    const images = missingImages(tree, c, t);
    view = { why: s, ...(a?.host ?? host ? { host: (a?.host ?? host)! } : {}), ...(images !== undefined ? { images } : {}), says: stateSays(s, a?.title ?? a?.host ?? host ?? "") };
  }
  if (!view) return undefined;
  const again = t.retried ? { at: t.retried.at } : undefined;
  const says = again ? `${view.says}; ${phrase(lang, view.why === "held" ? "retry.again.held" : "retry.again", { time: when(again.at, lang, now) })}` : view.says;
  return { ...view, says, ...(again ? { again } : {}), ...retryLimit(t, now) };
}

const webUrlOf = (u: string | undefined) => (u && /^https?:\/\//iu.test(u) && URL.canParse(u) ? u : undefined);
