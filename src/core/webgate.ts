// What an archive's terms let an agent's own web tools do on its site (the tree's hook before each web fetch, core/web.ts;
// strom net web --check for the agents without a hook): the same level as strom's own requests (core/terms.ts
// archiveLevel), with what strom read of the host — its robots.txt, a refusal of strom's client — and never a request
// of its own. Read only: it fetches nothing (robots.txt neither), writes nothing.
//
//   · a host that refused strom's client, an archive whose terms forbid automated access: nothing — only the terms page
//     the person saw (strom's list of terms, the address kept when the person decided), HTML, at most TERMS_PER_DAY a
//     day, and /robots.txt of an archive whose terms forbid it (a host that refused strom is asked nothing again);
//   · an archive only a person's browser goes to (its robots.txt keeps automated tools off the whole site, or strom's
//     list says so): no web fetch at all — the person's browser with their permission, else by hand;
//   · a path its robots.txt keeps automated tools off — strom's groups, those of the agent's own tool (Claude Code's
//     WebFetch is Claude-User), else those for every robot, and the paths strom's list keeps off: refused, the line said;
//   · images of an archive that restricts automation, allows them by hand only or whose terms are not known: never
//     through a web tool — strom fetch (the person's permission, a person's pace), else by hand; its pages stay open;
//   · a failure reading what strom keeps of the host: refused where strom's list says the archive forbids automation
//     or a refusal is kept (D8), else as if nothing were known.

import path from "node:path";
import type { Env } from "./paths.ts";
import { archiveLevel, keyHost, loadArchives, termsFor, type ArchiveLevel, type ConnectorLike } from "./terms.ts";
import { AGENT_TOOL_TOKENS, clock, hostAllowed, hostState, REFUSED_FOREVER, toolRobotsVerdict, type RobotsState } from "./net.ts";
import { knownDisallow } from "./knownterms.ts";
import { listConnectors } from "./connector.ts";
import { metricsDir, termsPagesToday } from "./metrics.ts";
import { settingsTrust } from "./trust.ts";
import type { Tree } from "./tree.ts";

/** The terms page of a forbidden or refusing archive: at most this many times a day through an agent's web tools. */
export const TERMS_PER_DAY = 3;

export type GateWhy = "refused" | "forbidden" | "browser" | "robots" | "images" | "terms-limit" | "terms-kind";

export interface WebGate {
  /** The web fetch may go (the hook's pace, count and thresholds still hold). */
  allow: boolean;
  /** Why not; or "terms": the one page of a closed archive let through. */
  why?: GateWhy | "terms" | "robots.txt";
  /** For the agent: why, and the way on. */
  reason?: string;
  host: string;
  url: string;
  level?: ArchiveLevel;
  /** The robots.txt line that keeps the agent's tool off the path. */
  robots?: { line: string; path: string };
  /** The host is left alone now (a refusal, its limit): until when. */
  blocked?: { until: number; reason?: string };
  /** The terms pages of the host read today through the web tools (a closed archive). */
  termsToday?: number;
}

/** An address of an image (or a scan's file): what an archive's images are, never a page. */
export function imageUrl(url: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  const p = decodeURIComponent(u.pathname).toLowerCase();
  if (/\.(jpe?g|png|gif|tiff?|webp|jp2|j2k|bmp|heic|heif|avif|djvu?)$/u.test(p)) return true;
  // the IIIF Image API: …/<region>/<size>/<rotation>/<quality>.<format>
  return /\/(full|square|\d+,\d+,\d+,\d+|pct:[^/]+)\/[^/]+\/!?\d+\/(default|color|gray|bitonal|native)\.[\p{L}\p{N}]+$/u.test(p);
}

/** Not a page of HTML by its address: a file of another kind (an image, a PDF, an archive of files). */
function fileUrl(url: string): boolean {
  try {
    return imageUrl(url) || /\.(pdf|zip|tar|gz|7z|rar|xml|json|csv|txt|mp3|mp4|wav)$/u.test(decodeURIComponent(new URL(url).pathname).toLowerCase());
  } catch {
    return true;
  }
}

/** Two addresses of the same page: scheme aside, the same host, path (a trailing slash aside) and query. */
function samePage(a: string, b: string): boolean {
  try {
    const x = new URL(a);
    const y = new URL(b);
    const p = (u: URL) => u.pathname.replace(/\/+$/u, "") || "/";
    return x.hostname.toLowerCase() === y.hostname.toLowerCase() && p(x) === p(y) && x.search === y.search;
  } catch {
    return false;
  }
}

/**
 * The terms pages of a host an agent may read on a closed archive (S2): strom's list of terms (its terms and its terms
 * page), the address kept when the person decided (their permission's record, a connector's reading the person
 * accepted or strom took over) — never an address a connector names now, which an agent may write.
 */
export function termsPages(env: Env, host: string, keyed: string): string[] {
  const out = new Set<string>();
  for (const h of [host, keyed]) {
    const k = termsFor(env, h);
    if (k?.terms && k.quoteFrom !== "robots") out.add(k.terms);
    if (k?.termsPage) out.add(k.termsPage);
  }
  if (settingsTrust(env).verified) {
    const rec = loadArchives(env).archives[keyed];
    if (rec?.terms) out.add(rec.terms);
    for (const s of Object.values(rec?.seen ?? {})) if (s.terms && (s.by === "person" || s.by === "takeover")) out.add(s.terms);
  }
  return [...out];
}

/** The connector of the plugins folder for a host (one whose hosts take it): its reading counts in the level. */
function connectorOf(shared: string | undefined, env: Env, host: string): ConnectorLike | undefined {
  if (!shared) return undefined;
  return listConnectors(shared, env).find((c) => hostAllowed(host, c.manifest.hosts));
}

/** "the terms of X (address)", or the host, for the agent. */
const archiveText = (a: ArchiveLevel | undefined, host: string) => `${a?.title && a.title !== host ? `${a.title} (${host})` : host}`;

/**
 * The way on when a site gives the agent's web tools nothing: another way to the same records first, the search
 * recorded, and only when the source stays necessary a task for the person to check the site.
 */
export function otherWay(host: string, url: string, task?: string): string {
  return (
    `First another way to the same records: another archive or fonds of the jurisdiction, the parish, an index, secondary sources (strom recordset list --place <place>, strom place show <place>, strom repo list); ` +
    `record the search: strom search add "<what was looked for>" --method web --result inconclusive --note "${host}: <why it gave nothing>"; ` +
    `only if this source stays necessary for the task: strom task wait ${task ?? "T…"} --check ${url} --on "<what the person checks there — impersonal, in the research language>". ` +
    "Never round it (curl, a script, another tool, the browser, another address of the same server)."
  );
}

/**
 * What strom would let an agent's own web tool fetch now at an address, and why: read only. `agent`: whose tool (its
 * robots.txt token); none: every tool strom knows (the strictest).
 */
export function webGate(o: { env: Env; tree?: Tree; url: string; shared: string | undefined; agent?: string; task?: string; now?: number }): WebGate {
  let u: URL;
  try {
    u = new URL(o.url);
  } catch {
    return { allow: true, host: "", url: o.url };
  }
  const host = u.hostname.toLowerCase().replace(/\.$/u, "");
  const now = o.now ?? Date.now();
  const dir = o.shared ? path.join(o.shared, "net") : o.tree ? path.join(metricsDir(o.tree.root), "net") : undefined;
  const target = `${u.pathname}${u.search}`;
  const robotsTxt = u.pathname === "/robots.txt" && !u.search;
  const base = { host, url: o.url };
  let a: ArchiveLevel;
  let keyed = host;
  try {
    const c = connectorOf(o.shared, o.env, host);
    keyed = keyHost(c, o.url);
    a = archiveLevel(o.env, { ...(c ? { connector: c } : {}), url: o.url, ...(o.tree ? { tree: o.tree } : {}), readOnly: true, ...(dir ? { net: dir } : {}) });
  } catch {
    // D8: what strom keeps cannot be read — a closed archive stays closed
    let closed = termsFor(o.env, host)?.level === "forbidden";
    try {
      closed ||= Object.values(loadArchives(o.env).archives).some((r) => r.refused?.host === host);
    } catch {
      closed = true;
    }
    if (!closed || robotsTxt) return { allow: true, ...base };
    return { allow: false, why: "refused", ...base, reason: `strom: what strom keeps of ${host} cannot be read, and its archive does not let automated tools in — nothing goes to it through your web tools either. ${otherWay(host, o.url, o.task)}` };
  }
  const out = (g: Omit<WebGate, "host" | "url" | "level">): WebGate => ({ ...g, ...base, level: a });
  const name = archiveText(a, host);
  // closed: refused strom's client, or its terms forbid automated access — its terms page and robots.txt only
  if (a.refused || a.level === "forbidden") {
    // (a host that refused strom's client gets nothing at all, its robots.txt neither: never asked again after a refusal)
    if (robotsTxt && !a.refused) return out({ allow: true, why: "robots.txt" });
    const why = a.refused ? "refused" : "forbidden";
    const head = a.refused
      ? `strom: ${host} refused strom's client — the site does not let automated tools in (${a.refused.until && a.refused.until < REFUSED_FOREVER ? `until ${clock(a.refused.until)}` : "until the person lifts it: strom allow host " + a.refused.host + " --unblock — the person's, never yours"}); nothing goes to it through your web tools or a browser either.`
      : `strom: the terms of ${name} allow no automated access${a.terms ? ` (${a.terms})` : ""} — nothing goes to it through your web tools or a browser either.`;
    if (termsPages(o.env, host, keyed).some((p) => samePage(p, o.url))) {
      if (fileUrl(o.url)) return out({ allow: false, why: "terms-kind", reason: `${head} Only its terms page as a page of text — not this file. ${otherWay(host, o.url, o.task)}` });
      const n = o.tree ? termsPagesToday(o.tree.root, host, now) : 0;
      if (n >= TERMS_PER_DAY) return out({ allow: false, why: "terms-limit", termsToday: n, reason: `${head} Its terms page was read ${n} times today already (at most ${TERMS_PER_DAY}). ${otherWay(host, o.url, o.task)}` });
      return out({ allow: true, why: "terms", termsToday: n });
    }
    return out({ allow: false, why, reason: `${head} ${otherWay(host, o.url, o.task)}` });
  }
  // only a person's browser goes there: no web fetch at all (its robots.txt itself aside)
  if (a.browserOnly) {
    if (robotsTxt) return out({ allow: true, why: "robots.txt" });
    const by = a.browserOnly.by === "robots" ? `its robots.txt keeps automated tools off the whole site ("${a.browserOnly.line ?? "Disallow: /"}")` : "strom's list of archives' terms says only a person's browser goes there";
    return out({
      allow: false,
      why: "browser",
      reason:
        `strom: ${name} lets automated tools in only through a person's browser — ${by}: no web fetch. ` +
        `Its images through the person's browser only with their permission "through the browser" (strom allow archive ${a.host} --way browser — the person's, never yours), else the person saves what is needed by hand: strom task wait ${o.task ?? "T…"} --images B…:<numbers> --on "…". ${otherWay(host, o.url, o.task)}`,
    });
  }
  // the path its robots.txt keeps the agent's tool off (what strom read of it — never read here), and strom's list's paths
  let read: RobotsState | undefined;
  try {
    read = dir ? hostState(dir, host).robots : undefined;
  } catch {
    read = undefined;
  }
  const known = knownDisallow(host);
  const robots: RobotsState | undefined = known.length ? { at: read?.at ?? 0, status: read?.status ?? 200, groups: [...(read?.groups ?? []), { agents: ["*"], allow: [], disallow: known }], ...(read?.tools ? { tools: read.tools } : {}) } : read;
  const tokens = o.agent ? (AGENT_TOOL_TOKENS[o.agent] ?? []) : Object.values(AGENT_TOOL_TOKENS).flat();
  const v = toolRobotsVerdict(robots, target, tokens);
  if (!v.allowed)
    return out({
      allow: false,
      why: "robots",
      robots: { line: v.line!, path: target },
      reason: `strom: ${host}/robots.txt keeps automated tools off ${target} ("${v.line}") — not through your web tools either. ${otherWay(host, o.url, o.task)}`,
    });
  // images of an archive that restricts automation, keeps them by hand, or whose terms are not known: never a web tool's
  if (a.level !== "allowed" && imageUrl(o.url)) {
    const way =
      a.level === "manual" || a.permission === "manual"
        ? `its images by hand only: strom task wait ${o.task ?? "T…"} --images B…:<numbers> --on "<the book, its link, which images — impersonal, in the research language>"`
        : `its images through strom fetch with its connector, at a person's pace once the person allowed it (strom fetch asks them), else by hand: strom task wait ${o.task ?? "T…"} --images B…:<numbers> --on "…"`;
    return out({ allow: false, why: "images", reason: `strom: ${name} — ${a.level === "unknown" ? "its terms are not known" : a.level === "manual" ? "its terms allow its images by hand only" : "its terms restrict automated downloading"}: no image of it through your web tools; ${way}. Its pages stay open to the web fetch tool.` });
  }
  let blocked: WebGate["blocked"];
  try {
    const s = dir ? hostState(dir, host) : undefined;
    if (s?.blockedUntil && s.blockedUntil > now) blocked = { until: s.blockedUntil, ...(s.reason ? { reason: s.reason } : {}) };
    else if (s?.waitUntil && s.waitUntil > now) blocked = { until: s.waitUntil, reason: "its limit is used up" };
  } catch {
    blocked = undefined;
  }
  return out({ allow: true, ...(blocked ? { blocked } : {}) });
}
