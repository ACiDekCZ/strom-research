// A site whose pages for the agents' web tools are used up on this computer (core/machine.ts: web.perHost within
// run.minutes, every session here) holds back the tasks whose work goes there, in strom run: a session started on one
// would be refused its first page and wait for nothing (found in a live run: a session of an archive only a browser goes
// to, started right after another had its pages, tried the same page 116 times). So strom run leaves such a task for
// now and takes another; none left, it waits for the site itself — no agent, nothing asked of any archive — or ends
// saying when. Computed from the limiter's folder, nothing written; a limit is never raised.
//
// A task's work goes to a site through the agent's web tools when
//   - a save of an image of it through the agent's browser waits (strom media save: its record not taken yet) on that
//     site; or
//   - its level asks an archive (a reading one lacking its images here), every record set of it with an address lies on
//     such a site, and no connector here reaches that site the direct way (a connector's strom fetch keeps its own
//     limiter, core/net.ts; one whose route is the browser opens its pages in the agent's browser — counted with them).

import path from "node:path";
import type { Task } from "./model.ts";
import type { Tree } from "./tree.ts";
import { DEFAULT_RUN_MINUTES, Settings } from "./config.ts";
import { siteFreeAt, sitePagesHere, webSites } from "./machine.ts";
import { metricsDir, webDomain } from "./metrics.ts";
import { hostAllowed } from "./net.ts";
import { listConnectors, routeOf, type Connector } from "./connector.ts";
import { loadSaves, type SaveRecord } from "./browser.ts";
import { ASKS_ARCHIVE, lacksImages } from "./queue.ts";
import { setHosts } from "./archivewait.ts";
import { taskRecordsets } from "./frontier.ts";

/** A site whose pages are used up here, and when enough are free again for a session (ms). */
export interface WebFull {
  site: string;
  until: number;
}

/**
 * How many of web.perHost pages of a site must be free for strom run to start a session on it: a third (10 of the
 * default 30) — never a session started for one page and refused at the next.
 */
export function runWebFree(perHost: number): number {
  return Math.max(1, Math.ceil(perHost / 3));
}

/** The limiter's folder the pages of the agents' web tools are counted in (core/web.ts: the shared one, else the tree's). */
export function webStateDir(root: string, shared: string | undefined): string {
  return shared ? path.join(shared, "net") : path.join(metricsDir(root), "net");
}

/** The sites with fewer than runWebFree pages free on this computer now, each with when that many are free. */
export function fullWebSites(tree: Tree, shared: string | undefined, now = Date.now()): Map<string, number> {
  const out = new Map<string, number>();
  try {
    const settings = new Settings(tree.env, {});
    const perHost = settings.webPerHost(tree.config);
    const windowMs = Math.max(1, Math.round(settings.number("run.minutes", tree.config, DEFAULT_RUN_MINUTES))) * 60_000;
    const free = runWebFree(perHost);
    const dir = webStateDir(tree.root, shared);
    for (const site of webSites(dir)) {
      if (sitePagesHere(dir, site, windowMs, now) <= perHost - free) continue;
      out.set(site, siteFreeAt(dir, site, windowMs, perHost, now, free));
    }
  } catch {
    // nothing readable: nothing held back
  }
  return out;
}

/**
 * The site used up here a task's work goes to through the agent's web tools (see above) — the one free first — else
 * undefined. `full`: fullWebSites; `connectors` and `saves` read once by the caller for a whole queue.
 */
export function webFullOfTask(tree: Tree, t: Task, full: Map<string, number>, o: { connectors: Connector[]; saves: SaveRecord[] }): WebFull | undefined {
  if (!full.size) return undefined;
  const at = (site: string): WebFull | undefined => (full.has(site) ? { site, until: full.get(site)! } : undefined);
  // an image of it waits for the agent's browser on that site
  for (const r of o.saves) {
    if (r.task !== t.id || r.taken !== undefined) continue;
    const f = at(webDomain(r.host));
    if (f) return f;
  }
  // a reading task whose images are here reads them: no page needed
  if (!ASKS_ARCHIVE.has(t.level) || ((t.level === "link" || t.level === "verify") && !lacksImages(tree, t))) return undefined;
  let first: WebFull | undefined;
  for (const b of taskRecordsets(tree, t).sets) {
    const hosts = setHosts(tree, b);
    if (!hosts.length) continue;
    const on = [...new Set(hosts.map((h) => webDomain(h)))]
      .map(at)
      .filter((f): f is WebFull => !!f && !direct(tree, f.site, hosts, o.connectors))
      .sort((x, y) => x.until - y.until)[0];
    if (!on) return undefined; // a book elsewhere (or one a connector reaches): the task can go on there
    if (!first || on.until < first.until) first = on;
  }
  return first;
}

/** A connector here reaches a host of the site the direct way: its work goes through strom fetch, not the web tools. */
function direct(tree: Tree, site: string, hosts: string[], connectors: Connector[]): boolean {
  const of = hosts.filter((h) => webDomain(h) === site);
  return connectors.some((c) => of.some((h) => hostAllowed(h, c.manifest.hosts)) && routeOf(tree.env, c).via === "direct");
}

/** What webFullOfTask reads once for a queue: the connectors here and the saves of the agent's browser. */
export function webFullInputs(tree: Tree, shared: string | undefined): { connectors: Connector[]; saves: SaveRecord[] } {
  let connectors: Connector[] = [];
  try {
    connectors = shared ? listConnectors(shared, tree.env) : [];
  } catch {
    connectors = [];
  }
  return { connectors, saves: loadSaves(tree.root) };
}
