// allow archive — and the one gate every way to an archive's images passes (strom fetch, connector test and probe,
// the browser's plans): what the archive's terms let strom do (core/terms.ts), and the person's permission where
// they restrict it. The person decides: in their own terminal, in a window of the system when an agent asks
// (the agent neither sees nor clicks it), and when nobody can be asked the question waits in strom's menu while the
// work goes on with other sources. An agent may make an archive stricter; nothing milder is ever its to decide.

import { browserAdviceFor, browserHelps, browserKept, browserState, treeBrowserArchives } from "../core/browserhelp.ts";
import { floorNotes, floorSource, holdText, type FloorNote } from "../core/floor.ts";
import { detectAgent } from "../core/which.ts";
import path from "node:path";
import { register } from "../cli/registry.ts";
import type { Context } from "../cli/context.ts";
import { ui } from "../cli/ui.ts";
import { counted, lines, secondsIn, shellArg, table } from "../cli/format.ts";
import { EXIT, StromError, UsageError } from "../core/errors.ts";
import { isAgent } from "../core/which.ts";
import { canShowDialog, systemChoice, WAIT_SECONDS, type ChoiceText } from "../core/dialog.ts";
import { bareHost, listConnectors, routeOf, routesOf, type Connector } from "../core/connector.ts";
import { hostAllowed, hostPace, hostState, netTrust, paceText, robotsNow, ROBOTS_MS, type NetVerdict, type Pace } from "../core/net.ts";
import { settingsTrust } from "../core/trust.ts";
import { Tree } from "../core/tree.ts";
import { syncAgentFiles } from "../agents/files.ts";
import { currentSession } from "../core/session.ts";
import type { Session } from "../core/model.ts";
import { noteSessionWait, wakeForArchive, type Woken } from "../core/archivewait.ts";
import { connectorFor, levelWords, replyText, waysOffered, wokenLines } from "../core/archiveasks.ts";
import { claudeHere } from "../cli/menu-parts.ts";
import { shippedTerms, within } from "../core/knownterms.ts";
import {
  acceptConnectors,
  allows,
  archiveLevel,
  keepReadings,
  askLater,
  claimOf,
  connectorLevels,
  grantWay,
  hostOf,
  humanPace,
  keepNetVerdict,
  keyHost,
  latchedPace,
  LEVELS,
  loadArchives,
  pendingQuestions,
  questionHosts,
  rank,
  settlePending,
  revokeWay,
  grantRange,
  revokeRange,
  browserRangeOf,
  knownTerms,
  setFloor,
  strictest,
  takenOverWaiting,
  windowShown,
  WAYS,
  type ArchiveLevel,
  type Level,
  type PendingQuestion,
  type Route,
  type Way,
} from "../core/terms.ts";

/** The images (or pages) of an archive wait for the person's decision: nothing was asked of the archive. */
export class NeedsPermissionError extends StromError {
  readonly hosts: string[];
  readonly connector: string;
  readonly way: "slow" | "browser";
  readonly asked: "window" | "menu";

  /**
   * `person`: a person reads it (their terminal, a script) — in their language; an agent the English it goes by.
   * `unconfirmed`: nobody confirmed the connector's reading yet (a new connector) — not the archive's terms that restrict.
   * `ways`: the ways the person may choose (waysOffered), as the menu and the bridge offer them.
   */
  constructor(o: { hosts: string[]; connector: string; way: "slow" | "browser"; asked: "window" | "menu"; level: string; title: string; hint: string; person?: boolean; unconfirmed?: boolean; ways: Way[] }) {
    super(`needs the person's decision for ${o.hosts.join(", ")} (${o.title}: ${o.unconfirmed ? "nobody has confirmed its connector's reading of the terms yet" : "its terms restrict automated access"} — ${o.level}) — asked in strom's menu${o.asked === "window" ? "; the window got no answer" : ""}; nothing was asked of the archive`, {
      exitCode: EXIT.needsConsent,
      hint: o.hint,
      ...(o.person ? { code: o.unconfirmed ? "archive.permission.new" : "archive.permission", hintCode: "archive.permission" } : {}),
      params: { hosts: o.hosts.join(", "), host: o.hosts[0] ?? "", connector: o.connector, title: o.title, ways: o.ways.join("|") },
    });
    this.name = "NeedsPermissionError";
    this.hosts = o.hosts;
    this.connector = o.connector;
    this.way = o.way;
    this.asked = o.asked;
  }

  override toJSON(): Record<string, unknown> {
    return { status: "needs-permission", needs: "permission", hosts: this.hosts, connector: this.connector, way: this.way, asked: this.asked, message: this.message, hint: this.hint };
  }
}

function shared(ctx: Context): string | undefined {
  return ctx.settings.shared()?.value;
}

/**
 * Before a command goes to an archive: whose settings these are (core/trust.ts — under an agent, its marks or one
 * among strom's parent processes). Soft: nothing stops — from settings or a shared folder not verified as the
 * person's no permission and no person's pace are taken (core/terms.ts, net.ts), and the agent is told once.
 */
export function checkEnvironment(ctx: Context): void {
  const t = settingsTrust(ctx.env, { network: true, shared: shared(ctx), cwd: ctx.cwd });
  netTrust.ownPace = t.verified && t.sharedVerified;
  if (t.why && t.agent)
    ctx.io.stderr(`note: ${t.why} — no permission, pace or milder level of the person's is taken from there (what restricts still counts); run strom with the person's own settings: no STROM_CONFIG_DIR, STROM_SHARED, HOME or --shared of your own\n`);
}

/**
 * An agent runs this command: its marks in the environment, or one among strom's parent processes (core/trust.ts, read
 * once per process) — the same detection the settings' check goes by, so that an agent seen only by its parents gets
 * the agent's English and never a person's terminal question.
 */
function agentRuns(ctx: Context): boolean {
  return isAgent(ctx.env) || settingsTrust(ctx.env, { network: true, shared: shared(ctx), cwd: ctx.cwd }).agent;
}

/** <shared>/net: the limiter's state of the hosts (their robots.txt, refusals). */
function netHere(ctx: Context): string | undefined {
  const dir = shared(ctx);
  return dir ? path.join(dir, "net") : undefined;
}

/** The levels of a connector's hosts here: its reading, the tree's archives, strom's known terms, the floor, the hosts' own word. */
export function levelsOf(ctx: Context, c: Connector, readOnly = false): ArchiveLevel[] {
  const tree = ctx.hasTree() ? ctx.tree() : undefined;
  const net = netHere(ctx);
  return connectorLevels(ctx.env, c, { all: () => listConnectors(shared(ctx), ctx.env), ...(tree ? { tree } : {}), ...(net ? { net } : {}), readOnly: readOnly || !!tree?.dryRun });
}

/**
 * What the limiter tells of a connector's hosts as it reads and decides them — a robots.txt read, a refusal: kept in the
 * person's settings too (core/terms.ts keepNetVerdict), and each robots.txt read written to fetch.jsonl (cmd robots).
 */
export function verdictKeeper(ctx: Context, c: Connector, measured?: (rec: Record<string, unknown>) => void): (v: NetVerdict) => void {
  return (v) => {
    keepNetVerdict(ctx.env, c, v);
    if (v.robots) measured?.({ via: "direct", cmd: "robots", host: v.host, status: v.robots.status, requests: 1, hosts: { [v.host]: { requests: 1 } } });
  };
}

/** The pace of the person's permission "slowly" for each host the run may ask on paths its robots.txt keeps tools off. */
export function robotsPermits(ctx: Context, c: Connector, levels: ArchiveLevel[]): { robotsPermitFor?: (host: string) => Pace | undefined } {
  const slow = new Set(levels.filter((a) => a.permission === "slow" && !a.browserOnly).map((a) => a.host));
  if (!slow.size) return {};
  return { robotsPermitFor: (host) => (slow.has(keyHost(c, host)) ? humanPace(ctx.env) : undefined) };
}

/**
 * An archive the browser only goes to by its robots.txt, read more than a day ago: read again (one request — the day a
 * request would go there; the only one strom sends such a site by itself), so that a site that lets tools in again is
 * known. True: something read.
 */
async function freshRobots(ctx: Context, c: Connector, levels: ArchiveLevel[], measured?: (rec: Record<string, unknown>) => void): Promise<boolean> {
  const net = netHere(ctx);
  if (!net) return false;
  let read = false;
  for (const a of levels) {
    if (a.browserOnly?.by !== "robots" || a.level === "forbidden") continue;
    const s = hostState(net, a.host);
    if (s.robots && Date.now() - s.robots.at < ROBOTS_MS) continue;
    const open = c.manifest.browser?.open && URL.canParse(c.manifest.browser.open) ? new URL(c.manifest.browser.open) : undefined;
    const origin = s.robots?.origin ?? (open?.hostname === a.host ? open.origin : `https://${a.host}`);
    try {
      await robotsNow(origin, { stateDir: net, hosts: c.manifest.hosts, pace: c.manifest.policy.pace ?? {}, onVerdict: verdictKeeper(ctx, c, measured) });
      read = true;
    } catch {
      // refused, left alone, silent: it stays as it was
    }
  }
  return read;
}

/** What decided a level, in words for the agent. */
export function levelText(a: ArchiveLevel): string {
  const why = a.from
    .map((f) =>
      f === "refused"
        ? a.refused?.unreadable
          ? "strom cannot read what it kept of the host's refusals — taken as refused"
          : `${a.refused?.host ?? a.host} refused strom's client — left alone until the person lifts it (strom allow host ${a.refused?.host ?? a.host} --unblock)`
        : f === "robots"
          ? `its robots.txt keeps automated tools off the whole site ("${a.browserOnly?.line ?? "Disallow: /"}"): only through a person's browser`
          : f === "terms" && a.browserOnly?.by === "terms"
            ? "strom's known terms of the archive: only through a person's browser"
            : f === "terms" ? `strom's known terms of the archive${a.scope ? ` — ${a.scope}` : ""}` : f === "tree" ? `the tree's archive ${a.repository ?? ""}`.trim() : f === "pages" ? "a bot check (browser.pages)" : f === "new connector" ? "a connector the user has not confirmed yet" : f === "kept" ? "the connector's earlier reading (it says now it may do more: the user decides)" : f === "floor" ? "the strictest level strom saw for it" : "the connector's reading",
    )
    .join(", ");
  return `${a.level}${why ? ` (${why})` : ""}`;
}

/** Why an archive goes only through a person's browser, in words for the agent: its robots.txt, or strom's known terms. */
function browserWhy(a: ArchiveLevel): string {
  return a.browserOnly?.by === "robots" ? `its robots.txt keeps automated tools off the whole site ("${a.browserOnly.line ?? "Disallow: /"}")` : "strom's known terms of the archive";
}

/** A level the family tree's own archive gives, said as the tree records it ("R0001 … is marked automation manual in this tree"). */
function treeSaid(a: ArchiveLevel): string | undefined {
  return a.from.includes("tree") && a.repository ? `${a.repository} ${a.title ?? a.host} is marked automation ${a.level} in this tree` : undefined;
}

/** The sessions' task here, for the command an agent is given. */
export function taskHere(ctx: Context): string | undefined {
  return sessionHere(ctx)?.task;
}

/** The session this command works in, if any. */
function sessionHere(ctx: Context): Session | undefined {
  try {
    return ctx.hasTree() ? currentSession(ctx.tree(), ctx.env, ctx.refs) : undefined;
  } catch {
    return undefined;
  }
}

/** The research this command works in, if any. */
function rootHere(ctx: Context): string | undefined {
  try {
    return ctx.locateTree();
  } catch {
    return undefined;
  }
}

/**
 * The person decided an archive's images (the menu, strom allow archive --way, a window, their terminal at a fetch) —
 * or they may come now: the tasks that waited for these hosts wake in every research here, each tree under its own
 * lock (core/archivewait.ts). By hand: those that wait for images saved by hand keep waiting.
 */
export function wakeAfterDecision(ctx: Context, hosts: string[], way: Way): Woken[] {
  if (ctx.dryRun) return [];
  const root = rootHere(ctx);
  const roots = [...new Set([...(root ? [root] : []), ...ctx.knownTrees().map((k) => k.root)])];
  const dir = shared(ctx);
  const merged = new Map<string, Woken>();
  for (const h of hosts)
    for (const r of wakeForArchive(ctx.env, roots, h, { ...(dir ? { shared: dir } : {}), way })) {
      const m = merged.get(r.root);
      if (!m) merged.set(r.root, r);
      else for (const k of ["woken", "kept"] as const) m[k] = [...new Set([...m[k], ...r[k]])];
    }
  return [...merged.values()];
}

/**
 * The person made an archive milder (strom allow archive --level, the question of a floor in What waits): the tasks
 * that waited for it come back only in a research where the level now opens them — the archive allows images by its
 * terms, or the person's permission "slowly" (an archive not only a person's browser's), or "through the browser" where
 * the research's agent has a browser strom keeps, ready. Anything still by hand (a downloader's reading, the research's
 * record, the host's refusal) wakes nothing; a check of a site waits for the person's answer still.
 */
export function wakeOpened(ctx: Context, hosts: string[]): Woken[] {
  if (ctx.dryRun) return [];
  const root = rootHere(ctx);
  const roots = [...new Set([...(root ? [root] : []), ...ctx.knownTrees().map((k) => k.root)])];
  const dir = shared(ctx);
  const net = netHere(ctx);
  const all = listConnectors(dir, ctx.env);
  const merged = new Map<string, Woken>();
  for (const r of roots) {
    let tree: Tree;
    try {
      tree = Tree.open(r, ctx.env);
    } catch {
      continue;
    }
    for (const h of hosts) {
      let way: Way | undefined;
      try {
        const input = { tree, readOnly: true, ...(net ? { net } : {}) };
        const levels = [archiveLevel(ctx.env, { ...input, url: `https://${h}/` }), ...all.filter((c) => c.manifest.hosts.map(bareHost).includes(h)).map((c) => archiveLevel(ctx.env, { ...input, connector: c, url: h }))];
        const a = levels.reduce((x, y) => (rank(y.level) > rank(x.level) ? y : x));
        if (a.refused || rank(a.level) >= rank("manual")) continue;
        const browserOnly = levels.some((x) => x.browserOnly);
        if (a.level === "allowed" && !browserOnly) way = undefined;
        else if (a.permission === "slow" && !browserOnly) way = "slow";
        else if (a.permission === "browser" && browserState(ctx.env, ctx.settings.agent(tree.config).value, r).state === "ready") way = "browser";
        else continue;
      } catch {
        continue;
      }
      for (const w of wakeForArchive(ctx.env, [r], h, { ...(dir ? { shared: dir } : {}), ...(way ? { way } : {}) })) {
        const m = merged.get(w.root);
        if (!m) merged.set(w.root, w);
        else for (const k of ["woken", "kept"] as const) m[k] = [...new Set([...m[k], ...w[k]])];
      }
    }
  }
  return [...merged.values()];
}

/** The command for the user to save images by hand, as an agent records it. */
function byHand(ctx: Context, images?: string): string {
  return `strom task wait ${taskHere(ctx) ?? "T…"} --images B…:${images ?? "<from-to>"} --on "<the book, its link, which images — for the user, impersonal, in the research language>"`;
}

/** The pace of a person for each host the images go to at it (an archive that restricts automation, allowed slowly). */
export function humanPaces(ctx: Context, levels: ArchiveLevel[], activity: "images" | "pages", route: Route): Map<string, Pace> {
  const out = new Map<string, Pace>();
  for (const a of levels) {
    const r = allows(a, activity, route);
    if (r.ok && r.human) out.set(a.host, humanPace(ctx.env));
  }
  return out;
}

/** What the person reads of an archive's terms: strom's quote with its address, else the connector's reading (said so). */
function termsLine(lang: string, a: ArchiveLevel): string {
  if (a.quote && a.quoteBy === "reply") return replyText(lang, a.quote, a.replied);
  if (a.quoteBy === "robots") {
    const text = ui(lang, a.quote ? "ui.archive.terms.robots" : "ui.archive.terms.robots.none", { quote: a.quote ?? "", terms: a.terms ?? "" });
    return a.terms ? text : text.replace(/\s*\(\)/u, "");
  }
  if (a.quote && a.quoteBy === "strom") return ui(lang, "ui.archive.terms.known", { quote: a.quote, terms: a.terms ?? "" });
  if (a.quote) return ui(lang, "ui.archive.terms.connector", { quote: a.quote, terms: a.terms ?? "" });
  return ui(lang, "ui.archive.terms.none");
}

/**
 * An hourly cap in the person's words: "at most 120 requests to the archive an hour, its catalogue counted too" (`short`:
 * "at most 120 requests an hour, the catalogue too"), or "no hourly cap".
 */
export function capWords(lang: string, perHour: number | null | undefined, short = false): string {
  return typeof perHour === "number" && Number.isFinite(perHour) && perHour > 0 ? ui(lang, short ? "ui.archive.cap.short" : "ui.archive.cap", { n: perHour }) : ui(lang, "ui.pace.nocap");
}

/** The question of a permission, in the person's language: the archive, its terms, the pace, how to change it. */
export function permissionText(ctx: Context, a: ArchiveLevel, way: "slow" | "browser", c?: Connector): string {
  const lang = ctx.uiLang();
  const p = paceFor(ctx, a.host, c);
  return [
    ui(lang, "ui.archive.name", { title: a.title ?? a.host, host: a.host }),
    termsLine(lang, a),
    ui(lang, way === "browser" ? "ui.archive.ask.browser" : "ui.archive.ask.slow", { seconds: secondsIn(lang, p.minIntervalMs), cap: capWords(lang, p.perHour) }),
    ui(lang, "ui.archive.ask.change", { host: a.host }),
  ].join("\n\n");
}

/**
 * The window's question, two or three sentences in the person's language: what the archive's terms do (with their
 * address), the way and the pace in force for the host (the person's own if set), where to change it.
 */
export function windowText(ctx: Context, a: ArchiveLevel, way: "slow" | "browser", c?: Connector): string {
  const lang = ctx.uiLang();
  const pages = !!c?.manifest.browser?.pages;
  const dir = shared(ctx);
  // a bot check's pages and images go at the service's pace strom plans; the rest at a person's pace
  const p = pages ? hostPace(dir ? hostState(path.join(dir, "net"), a.host) : { recent: [] }, latchedPace(ctx.env, c!, a.host), undefined, a.host) : paceFor(ctx, a.host, c);
  // what the site's robots.txt says is said as robots.txt, never as its terms
  const robots = a.quoteBy === "robots" || a.browserOnly?.by === "robots";
  const why = robots ? "robots" : a.browserOnly ? "browserOnly" : pages ? "pages" : a.level === "unknown" ? "unknown" : "restricted";
  const terms = robots ? ` (${a.quoteBy === "robots" && a.terms ? a.terms : `https://${a.host}/robots.txt`})` : a.terms ? ` (${a.terms})` : "";
  return `${ui(lang, `ui.archive.window.${why}`, { title: a.title ?? a.host, terms })}\n\n${ui(lang, way === "browser" ? "ui.archive.window.browser" : "ui.archive.window.slow", { seconds: secondsIn(lang, p.minIntervalMs) })} ${ui(lang, "ui.archive.window.change")}`;
}

/** The pace a person's permission gives a host: the person's own for it first, else archive.pace / HUMAN_PACE. */
export function paceFor(ctx: Context, host: string, c?: Connector): Pace {
  const dir = shared(ctx);
  return hostPace(dir ? hostState(path.join(dir, "net"), host) : { recent: [] }, c ? latchedPace(ctx.env, c, host) : undefined, humanPace(ctx.env), host);
}

/**
 * The ways offered for an archive's images where a command needs them — the terminal's question, the window, the
 * question kept for the menu, the hint: the same as the menu's and the bridge's (waysOffered), the way this command
 * needs first when it is one of them.
 */
function waysHere(ctx: Context, c: Connector, a: ArchiveLevel, way: "slow" | "browser"): Way[] {
  const tree = ctx.hasTree() ? ctx.tree() : undefined;
  return waysOffered(c, claudeHere(ctx, tree?.config), way, !!a.browserOnly);
}

/**
 * The connector's route follows a way the person chose (through the browser, or slowly straight through strom), as the
 * menu does it (strom connector use): the agents' permissions of every tree follow. True: switched.
 */
function routeFollows(ctx: Context, c: Connector, chosen: Way): boolean {
  const via: Route | undefined = chosen === "browser" ? "browser" : chosen === "slow" ? "direct" : undefined;
  if (!via || !routesOf(c).includes(via) || routeOf(ctx.env, c).via === via) return false;
  const s = ctx.settings;
  s.config.connectorRoutes = { ...(s.config.connectorRoutes ?? {}), [c.name]: { via, at: new Date().toISOString(), by: ctx.io.tty ? "in a terminal" : "by a command without a terminal (an agent or the app)" } };
  s.save();
  syncTrees(ctx);
  return true;
}

/** The person's choice for an archive, in their terminal or in a window: the way chosen, or nothing. */
async function askPerson(ctx: Context, c: Connector, missing: ArchiveLevel[], way: "slow" | "browser"): Promise<{ way?: Way; window: boolean }> {
  const lang = ctx.uiLang();
  const a = missing[0]!;
  const hosts = missing.map((m) => m.host);
  const ways = waysHere(ctx, c, a, way);
  // the window's main choice: the way this command needs, else the other way offered (only two choices fit a window)
  const main: "slow" | "browser" = ways.includes(way) ? way : ((ways.find((w) => w !== "manual") as "slow" | "browser" | undefined) ?? way);
  const question = permissionText(ctx, a, main, c);
  const p = paceFor(ctx, a.host, c);
  const allowLabel = ui(lang, main === "browser" ? "ui.archive.btn.browser" : "ui.archive.btn.slow");
  const decided = (chosen: Way) => {
    grantWay(ctx.env, hosts, chosen, { by: "terminal", connector: c });
    routeFollows(ctx, c, chosen);
  };
  // the person in their own terminal: the choice right here, the ways the menu offers (Enter: later, nothing changes)
  if (ctx.interactive && !agentRuns(ctx)) {
    ctx.io.stdout(`\n${question}\n`);
    const labels = ways.map((w) => ({ label: ui(lang, w === "slow" ? "ui.archive.way.slow" : w === "browser" ? "ui.archive.way.browser" : "ui.archive.way.manual", { seconds: secondsIn(lang, p.minIntervalMs), cap: capWords(lang, p.perHour) }) }));
    const i = await ctx.choose(ui(lang, "ui.archive.choose", { title: a.title ?? a.host }), labels, labels.length, { back: ui(lang, "ui.archive.way.later") });
    if (i !== undefined && ways[i]) {
      const chosen = ways[i]!;
      decided(chosen);
      for (const line of wokenLines(lang, wakeAfterDecision(ctx, hosts, chosen), rootHere(ctx))) ctx.io.stdout(`${line}\n`);
      return { way: chosen, window: false };
    }
    return { window: false };
  }
  // anyone else (an agent's session, a script) — the person at the screen, in a window the agent cannot see or click;
  // a window not answered ("later", Esc, no answer in time) is not shown again for the archive within a day — its
  // question waits in the menu all the while; a run nobody watches shows none (STROM_NONINTERACTIVE)
  const window = ctx.env.STROM_NONINTERACTIVE !== "1" && (!!ctx.io.choice || canShowDialog(ctx.env)) && !hosts.some((h) => windowShown(ctx.env, h));
  if (window) {
    const text: ChoiceText = {
      title: ui(lang, "ui.dialog.title"),
      // short: what the terms do, the way and its pace, where to change it — Enter takes the recommended way
      question: windowText(ctx, a, main, c),
      choices: [
        { key: main, label: allowLabel },
        { key: "manual", label: ui(lang, "ui.archive.btn.manual") },
      ],
      later: ui(lang, "ui.archive.btn.later"),
      keys: ui(lang, "ui.archive.btn.keys", { allow: allowLabel, manual: ui(lang, "ui.archive.btn.manual"), later: ui(lang, "ui.archive.btn.later") }),
    };
    ctx.io.stderr(`${ui(lang, "ui.dialog.waiting", { minutes: String(WAIT_SECONDS / 60), question: ui(lang, "ui.archive.name", { title: a.title ?? a.host, host: a.host }) })}\n`);
    const answer = ctx.io.choice ? ctx.io.choice(text) : systemChoice(text, ctx.env);
    if (answer === main || answer === "manual") {
      grantWay(ctx.env, hosts, answer, { by: "window", connector: c });
      routeFollows(ctx, c, answer);
      // the tasks that waited for it elsewhere come back (an agent reads the IDs: they are its work)
      const woken = wakeAfterDecision(ctx, hosts, answer).flatMap((r) => r.woken.map((id) => `${r.name} ${id}`));
      if (woken.length) ctx.io.stderr(`note: the person decided ${hosts.join(", ")} — tasks back in the queue: ${woken.join(", ")}\n`);
      return { way: answer, window: true };
    }
    if (answer === null) return { window: true };
  }
  return { window: false };
}

/**
 * The refusal of a connector's direct request to an archive only a person's browser goes to (strom fetch, connector
 * test, connector probe) — a connector made before strom knew it so, a permission "slowly" given before included: the
 * permission stays as given, the direct way is never taken. Its ways for the agent, in words and in --json (details):
 * the person's permission "through the browser" where the agent's browser could help (one strom keeps), else by hand.
 */
export function browserOnlyRefusal(ctx: Context, c: Connector, a: ArchiveLevel, images?: string, pages = false, catalogue = false): UsageError {
  const agent = detectAgent(ctx.env);
  // what the agent's own browser may do there (none for an agent whose browser strom does not keep)
  const root = ctx.hasTree() ? ctx.tree().root : undefined;
  const advice = browserAdviceFor(ctx.env, agent, a, undefined, undefined, root);
  // the person's "through the browser" opens it to an agent's browser strom keeps — said to the person running it too
  const browser = browserHelps(a) && (!agent || browserKept(agent, root, ctx.env));
  const allow = `strom allow archive ${a.host} --way browser`;
  const manual = byHand(ctx, images);
  const kept = a.permission === "slow" ? ` — the person's permission "slowly" from before is kept as given, and takes no direct request there` : "";
  // finding a book (--find, --list): never through strom there — its catalogue on the archive's own site, page by page
  // through the agent's browser strom keeps (the person allowed it "through the browser"), else the person's
  const site = `https://${a.host}/`;
  const find = !catalogue
    ? ""
    : agent && browserHelps(a) && a.permission === "browser" && browserKept(agent, root, ctx.env)
      ? `find the book on the archive's own site through your browser instead (${site} — its catalogue page by page, at a person's pace), then record it: strom recordset add "<title>" --url <the book's page there> --places <place> --years <from-to> --kinds <kinds>; its images then one at a time: strom media save. `
      : `the book is found on the archive's own site (${site}) by a person: strom task wait ${taskHere(ctx) ?? "T…"} --check ${site} --on "<which book: the place, the years, the kind — impersonal, in the research language>". `;
  return new UsageError(`${a.title ?? a.host} lets automated tools in only through a person's browser (${browserWhy(a)}) — no direct request through ${c.name}, a probe or your web tools${catalogue ? ", finding its books neither" : ""}${kept}`, {
    hint:
      find +
      `go on with another way to the same records (another archive, the parish, an index, a catalogue), or the user saves what the research needs by hand: ${manual}` +
      `${pages ? "" : " — only a connector whose pages come from the person's browser (browser.pages) goes there, with the person's permission"}` +
      `${advice ? `; ${advice}` : browser && a.permission !== "browser" ? `; its images through the agent's browser, one at a time, only with the person's permission "through the browser" (${allow} — the person's)` : ""}`,
    code: "archive.browser",
    details: {
      host: a.host,
      ...(a.title ? { title: a.title } : {}),
      connector: c.name,
      by: a.browserOnly?.by ?? "terms",
      ways: browser ? ["browser", "manual"] : ["manual"],
      ...(a.permission ? { permission: a.permission } : {}),
      ...(browser && a.permission !== "browser" ? { browser: allow } : {}),
      manual,
      ...(find ? { find: find.trim() } : {}),
    },
  });
}

/**
 * The gate: may this activity go to a connector's archive now? Refused where the terms forbid it (forbidden: no
 * request; manual: no images — by hand), and where they restrict it without the person's permission the person is
 * asked (their terminal, a window) — nobody to ask, or no answer: the question waits in strom's menu and the command
 * ends with needs-permission (exit 4), nothing asked of the archive. What may go: the hosts at a person's pace.
 * `ask: false` (taking over what a browser fetched): nobody asked, the question kept. `closedOnly`: only what the
 * terms forbid is refused (before anything else is looked at).
 */
export async function gateArchive(
  ctx: Context,
  c: Connector,
  o: { activity: "catalogue" | "images"; route?: Route; images?: string; book?: string; ask?: boolean; readOnly?: boolean; closedOnly?: boolean; reroute?: boolean },
): Promise<{ levels: ArchiveLevel[]; human: Map<string, Pace>; rerouted?: Way }> {
  const pages = !!c.manifest.browser?.pages;
  const activity = pages && o.activity === "catalogue" ? "pages" : o.activity;
  const route: Route = pages ? "browser" : (o.route ?? "direct");
  let levels = levelsOf(ctx, c, o.readOnly);
  // a site only a browser goes to by its robots.txt, read more than a day ago: read again first (it may let tools in now)
  if (!o.readOnly && !ctx.current()?.dryRun && (await freshRobots(ctx, c, levels))) levels = levelsOf(ctx, c, o.readOnly);
  const refused = levels.find((a) => a.level === "forbidden" && a.refused);
  if (refused)
    throw new UsageError(`${refused.title ?? refused.host} (${refused.refused!.host}): ${levelText({ ...refused, from: ["refused"] })} — no requests through a connector, a probe, your web tools or a browser`, {
      hint: `go on with another way to the same records (another archive, the parish, an index, a catalogue), or the user saves what the research needs by hand: ${byHand(ctx, o.images)}`,
      code: "archive.refused",
    });
  const forbidden = levels.find((a) => a.level === "forbidden");
  if (forbidden)
    throw new UsageError(`${treeSaid(forbidden) ?? `${forbidden.title ?? forbidden.host} (${forbidden.host}) allows no automated access at all — ${levelText(forbidden)}`} — no requests through a connector, a probe, your web tools or a browser`, {
      hint: `the user saves what the research needs by hand: ${byHand(ctx, o.images)}`,
      code: "archive.forbidden",
    });
  const manual = (ls: ArchiveLevel[]) => ls.find((a) => !allows(a, activity, route).ok && (allows(a, activity, route) as { why: string }).why === "manual");
  const refuseManual = (a: ArchiveLevel) =>
    new UsageError(`${a.permission !== "manual" && treeSaid(a) ? `${treeSaid(a)} — no images downloaded through a connector` : `${a.title ?? a.host} does not allow automated download (${a.permission === "manual" && a.level !== "manual" ? "the user chose: images by hand" : levelText(a)}) — no images through a connector`}${activity === "pages" || route === "browser" || a.browserOnly ? ", through the browser neither" : ""}`, {
      hint: `the user saves them by hand: ${byHand(ctx, o.images)}${a.browserOnly ? " (only a person's browser goes there: no request through strom, finding books neither — the person finds the book on its site)" : ` (finding books and their links still works — the link: strom fetch ${c.name} ${o.book ? shellArg(o.book) : "<book>"} --list)`}`,
      code: "archive.manual",
    });
  const m = manual(levels);
  if (m) throw refuseManual(m);
  // only a person's browser goes there: nothing straight through strom — a connector without the browser's pages has no way
  const browserOnly = levels.find((a) => a.browserOnly && (!pages || !allows(a, activity, route).ok && (allows(a, activity, route) as { why: string }).why === "browser"));
  if (browserOnly) throw browserOnlyRefusal(ctx, c, browserOnly, o.images, pages, activity === "catalogue");
  if (o.closedOnly) return { levels, human: new Map() };
  const missing = levels.filter((a) => {
    const r = allows(a, activity, route);
    return !r.ok && r.why === "permission";
  });
  if (missing.length) {
    const way = (allows(missing[0]!, activity, route) as { needs?: "slow" | "browser" }).needs ?? "slow";
    const got = o.ask === false ? { window: false } : await askPerson(ctx, c, missing, way);
    if (got.way === "manual") throw refuseManual({ ...missing[0]!, permission: "manual" });
    if (!got.way) {
      const tree = ctx.hasTree() ? ctx.tree() : undefined;
      const session = sessionHere(ctx);
      const task = session?.task;
      // the ways the question offers: the same as the menu's and the bridge's (whoever does the research when it is answered)
      for (const a of missing) askLater(ctx.env, a, { connector: c.name, way, choices: waysOffered(c, true, way, !!a.browserOnly), window: got.window, ...(tree ? { tree: tree.config.id } : {}), ...(task ? { task } : {}) });
      // the session's task waits for the decision when the session ends unfinished — beside the research, not in its
      // data (a failed command takes back what it wrote)
      if (tree && session?.task && !tree.dryRun) noteSessionWait(tree.root, session.id, session.task, missing.map((a) => ({ host: a.host, ...(a.title ? { title: a.title } : {}) })));
      const a = missing[0]!;
      throw new NeedsPermissionError({
        hosts: missing.map((x) => x.host),
        connector: c.name,
        way,
        asked: got.window ? "window" : "menu",
        level: levelText(a),
        title: a.title ?? a.host,
        person: !agentRuns(ctx),
        unconfirmed: a.from.includes("new connector"),
        ways: waysHere(ctx, c, a, way),
        hint: `go on with another source now (another archive, a copy, an index), or the user saves the images by hand: ${byHand(ctx, o.images)} — never round it (another connector, your web tools, the browser)`,
      });
    }
    // the person chose the other way (through the browser, or slowly straight through strom): the connector's route
    // follows it — the command goes again that way (strom fetch), or says to run it again
    if (got.way !== way) {
      const a = missing[0]!;
      if (o.reroute) return { levels, human: new Map(), rerouted: got.way };
      throw new UsageError(`the person chose ${WAY_TEXT[got.way]} for ${a.title ?? a.host} (${missing.map((x) => x.host).join(", ")}) — ${c.name} goes ${got.way === "browser" ? "through the browser" : "straight through strom"} from now on; this command did not go`, {
        hint: "run the same command again",
        ...(agentRuns(ctx) ? {} : { code: "archive.rerouted" }),
        params: { title: a.title ?? a.host, way: ui(ctx.uiLang(), got.way === "browser" ? "ui.archive.is.browser" : "ui.archive.is.slow") },
      });
    }
    // decided: as it is now (the agents' browser tools follow at the next conversation or run, which refresh them) —
    // the person's answer holds for this command even where it cannot be kept as theirs (settings not verified)
    levels = levelsOf(ctx, c, true).map((a) => (!a.permission && missing.some((m) => m.host === a.host) ? { ...a, permission: got.way } : a));
  }
  // a question that waited for these hosts is answered by now (the person accepted the connector, lifted its level)
  if (activity !== "catalogue" && !o.readOnly && !ctx.current()?.dryRun) {
    const settled = settlePending(ctx.env, levels.map((a) => a.host));
    // the images may come now: the tasks that waited for the question come back too
    if (settled.length) wakeAfterDecision(ctx, settled, "slow");
  }
  return { levels, human: activity === "catalogue" ? new Map() : humanPaces(ctx, levels, activity, route) };
}

/**
 * The agents' permissions of every tree follow a change of the browser's way (browser tools for these sites, or none):
 * the tree the command runs in first — also one outside the folder of the trees, which strom does not list (N-U4-1 of
 * 062: only the trees listed followed, the one here kept its old permissions) — then every tree known.
 */
export function syncTrees(ctx: Context): string[] {
  const synced: string[] = [];
  const here = rootHere(ctx);
  const roots = [...new Set([...(here ? [path.resolve(here)] : []), ...ctx.knownTrees().map((k) => path.resolve(k.root))])];
  for (const root of roots) {
    try {
      const tree = Tree.open(root, ctx.env);
      const files = syncAgentFiles(tree);
      if (files.length) {
        tree.withTreeLock(() => tree.commit(`Agent instructions: ${files.join(", ")}`, files));
        synced.push(tree.config.name);
      }
    } catch {
      // a tree strom cannot open now gets them at its next strom run
    }
  }
  return synced;
}

/**
 * The hosts a name stands for: a connector's (its name), else the connector hosts on that host or site — never wider,
 * but for the other hosts of one archive whose question waits with it (one archive, one decision).
 */
function targetHosts(ctx: Context, target: string, floorToo = false): { hosts: string[]; connectors: Connector[]; bare?: ArchiveLevel } {
  const all = listConnectors(shared(ctx), ctx.env);
  const byName = all.find((c) => c.name === target);
  if (byName) return { hosts: [...new Set(byName.manifest.hosts.map(bareHost))], connectors: [byName] };
  const given = hostOf(target);
  const connectors = all.filter((c) => c.manifest.hosts.some((h) => hostAllowed(bareHost(h), [given]) || hostAllowed(given, [bareHost(h)])));
  const hosts = [...new Set(connectors.flatMap((c) => c.manifest.hosts.map(bareHost).filter((h) => hostAllowed(h, [given]) || hostAllowed(given, [h]))))];
  // no connector: an archive of strom's list only a person's browser goes to — its images through the agent's
  // browser, one at a time (strom media save), as the person allows
  if (!hosts.length) {
    const bare = bareArchive(ctx, given);
    // a site given (example.org): the hosts of it the research here names (www.example.org) with it — one archive,
    // one decision, else the permission would miss the books' own host
    if (bare) {
      const tree = ctx.hasTree() ? ctx.tree() : undefined;
      const named = tree ? treeBrowserArchives(tree, shared(ctx)).map((a) => a.host).filter((h) => within(h, given)) : [];
      return { hosts: [...new Set([bare.host, ...named])], connectors: [], bare };
    }
    // a level of an archive of strom's list no downloader here reaches (its floor stricter than the list: by hand
    // only, the agent's browser shut): the hosts strom keeps a level for on it — the person's to make milder or keep
    if (floorToo && shippedTerms().some((k) => within(given, k.host) || within(k.host, given))) {
      const kept = Object.entries(loadArchives(ctx.env).archives).filter(([h, r]) => r.floor && (h === given || within(h, given))).map(([h]) => h);
      const hs = kept.length ? kept : [given];
      const tree = ctx.hasTree() ? ctx.tree() : undefined;
      const net = netHere(ctx);
      const levels = hs.map((h) => archiveLevel(ctx.env, { url: `https://${h}/`, ...(tree ? { tree } : {}), ...(net ? { net } : {}), readOnly: true }));
      return { hosts: hs, connectors: [], bare: levels.reduce((x, y) => (rank(y.level) > rank(x.level) ? y : x)) };
    }
  }
  if (!hosts.length)
    throw new UsageError(`no connector reaches ${given}`, { hint: all.length ? `connectors: ${all.map((c) => `${c.name} (${c.manifest.hosts.join(", ")})`).join(", ")}` : "none yet: strom connector list" });
  const reached = new Set(connectors.flatMap((c) => c.manifest.hosts.map(bareHost)));
  for (const q of pendingQuestions(ctx.env)) {
    const its = questionHosts(q);
    if (q.kind === "permission" && its.some((h) => hosts.includes(h))) for (const h of its) if (reached.has(h) && !hosts.includes(h)) hosts.push(h);
  }
  return { hosts, connectors };
}

const WAY_TEXT: Record<Way, string> = { slow: "images slowly, at a person's pace", browser: "images through the browser on this computer", manual: "images by hand only" };

register({
  path: ["allow", "archive"],
  summary: "The person's permission for an archive whose terms restrict automation: its images slowly, through the browser, or by hand — or its level made stricter",
  group: "setup",
  description:
    "An archive's terms decide what strom does by itself (allowed · restricted · manual · forbidden; unknown counts as\n" +
    "restricted): the strictest of its connector's reading, the tree's archive, strom's known terms and what strom saw\n" +
    "before. A restricted archive's catalogue is read by itself; its images only with the person's permission —\n" +
    "slowly (one image at least 10 s apart, at most 120 an hour, or the person's own pace: strom allow host <host>\n" +
    "--pace/--per-hour, strom config set archive.pace), through their browser, or by hand. The permission is for the\n" +
    "connector's own hosts on this computer, every tree; the person gives and takes it back (their terminal, a window\n" +
    "when an agent asks, exit 4 with none). --level makes an archive stricter — anybody, an agent too; milder only the\n" +
    "person. --accept takes connectors' readings as they are now (those taken over when this strom first ran, one that\n" +
    "says it may do more than before) — the person's; --keep keeps what strom kept instead (the person's too), and so a\n" +
    "level strom keeps stricter than its list of the archive's terms (a downloader or a research's record read it so once:\n" +
    "asked in What waits — kept, or --level as the list says). After a milder level the tasks that waited come back where\n" +
    "it opens them. --range: the person's own consent, for this archive alone, to a range of its images saved through the\n" +
    "agent's browser in one call (strom media save --images) — besides \"through the browser\", only where strom's list\n" +
    "lets the archive have it (none yet); --range --revoke takes it back, one image at a time again. Without a target: the\n" +
    "archives, such levels with what holds them, and what waits.",
  args: [{ name: "archive", description: "a connector's name, or a host (www.example.org) or site (example.org) of its connectors" }],
  options: [
    { name: "way", type: "string", value: "<slow|browser|manual>", description: "the person's permission for its images" },
    { name: "revoke", type: "boolean", description: "forget the permission: asked again at the next need" },
    { name: "level", type: "string", value: "<allowed|restricted|manual|forbidden>", description: "the archive's level: stricter by anyone, milder by the person" },
    { name: "accept", type: "boolean", description: "accept the connectors' readings as they are now (without a target: those taken over)" },
    { name: "keep", type: "boolean", description: "keep what strom kept of a connector that says now the archive allows more, or a level strom keeps stricter than its list: not asked again" },
    { name: "range", type: "boolean", description: "the person's consent to a range of its images through the browser in one call (strom media save --images), for this archive alone — where strom's list lets it have one; with --revoke: taken back" },
  ],
  examples: ["strom allow archive www.example.org --way slow", "strom allow archive example-archive --way browser", "strom allow archive example.org --level restricted", "strom allow archive example.org --revoke", "strom allow archive --accept"],
  run: async (ctx, { args, opts }) => {
    const lang = ctx.uiLang();
    const target = args[0];
    const way = opts.way === undefined ? undefined : (String(opts.way).toLowerCase() as Way);
    const level = opts.level === undefined ? undefined : (String(opts.level).toLowerCase() as Level);
    if (way !== undefined && !WAYS.includes(way)) throw new UsageError(`--way slow, browser or manual — not "${opts.way}"`);
    if (level !== undefined && !LEVELS.includes(level)) throw new UsageError(`--level ${LEVELS.join(", ")} — not "${opts.level}"`);
    if (!target && !opts.accept) {
      const s = { ...loadArchives(ctx.env), pending: pendingQuestions(ctx.env) };
      const rows = Object.entries(s.archives).sort(([a], [b]) => a.localeCompare(b));
      // every way the question offers, as a fetch's hint, the menu and the bridge offer them (waysOffered)
      const tree = ctx.hasTree() ? ctx.tree() : undefined;
      const all = listConnectors(shared(ctx), ctx.env);
      const claude = claudeHere(ctx, tree?.config);
      const ways = (p: PendingQuestion) => waysOffered(connectorFor(all, p.host!, p.connector), claude, p.way, !!p.browserOnly).join("|");
      // a level strom keeps stricter than strom's list of the archive's terms: whose, since when, what holds it, what to do
      const floors = floorNotes(ctx.env, { ...(tree ? { tree } : {}), ...(shared(ctx) ? { shared: shared(ctx)! } : {}), all: true });
      return {
        text: lines(
          rows.length ? table(rows.map(([h, r]) => [h, r.way ? WAY_TEXT[r.way] : "no permission", r.floor ? `level ≥ ${r.floor}${r.floorBy ? ` (${r.floorBy}${r.floorAt ? ` ${r.floorAt.slice(0, 10)}` : ""})` : ""}` : "", Object.keys(r.seen ?? {}).join(", ")])) : "no archive decided yet",
          ...floors.map((n) => `${n.host}: strom keeps ${n.floor} since ${n.at?.slice(0, 10) ?? "?"} (${floorSource(n)}) — strom's list of its terms (checked ${n.checked ?? "?"}): ${n.list}${n.browserOnly ? ", only through a person's browser" : ""}; ${n.holds.length ? `still held by ${n.holds.map(holdText).join(", ")}` : n.ask ? `the person decides (What waits): strom allow archive ${n.host} --level ${n.list} (as its terms) or --keep` : `milder only by the person: strom allow archive ${n.host} --level ${n.list}`}`),
          s.pending.length ? `waiting for the person: ${s.pending.map((p) => p.kind === "takeover" ? `confirm the connectors taken over (${p.connectors?.join(", ")}): strom allow archive --accept` : p.kind === "milder" ? `${p.connector} says ${p.host} allows ${p.to} (kept ${p.from}): strom allow archive ${p.connector} --accept` : `${p.title ?? p.host}: strom allow archive ${p.host} --way ${ways(p)}`).join(" · ")}` : undefined,
        ),
        data: { archives: s.archives, pending: s.pending, ...(floors.length ? { floors } : {}) },
      };
    }
    if (opts.accept && !target) {
      const names = takenOverWaiting(ctx.env);
      if (!names.length) return { text: "no connectors taken over wait for a word — nothing to accept", data: { accepted: [] } };
      const all = listConnectors(shared(ctx), ctx.env).filter((c) => names.includes(c.name));
      ctx.requireHuman(`Accept the archives' levels of the connectors taken over (${names.join(", ")}) as their connector.json say them?`, "strom allow archive --accept", "archive:accept", ui(lang, "ui.archive.accept", { names: all.map((c) => `${c.manifest.title} (${levelWords(lang, claimOf(c))})`).join(", ") }));
      acceptConnectors(ctx.env, all);
      return { text: `accepted as they say: ${all.map((c) => `${c.name} ${claimOf(c)}`).join(", ")}`, data: { accepted: all.map((c) => c.name) } };
    }
    const { hosts, connectors, bare } = targetHosts(ctx, target!, !!(opts.keep || level));
    const named = connectors.length === 1 ? connectors[0] : connectors.find((c) => c.name === target);
    const title = (named ?? connectors[0])?.manifest.title ?? bare?.title ?? hosts[0]!;
    if (bare && opts.accept)
      throw new UsageError(`${title} has no connector here: only its way and its level are the person's to decide (--way browser|manual, --revoke, --level)`, { hint: `strom allow archive ${hosts[0]} --way browser` });
    // the floors strom keeps stricter than strom's list of the archive's terms, whose question waits for the person
    const floors = (): FloorNote[] => floorNotes(ctx.env, { ...(ctx.hasTree() ? { tree: ctx.tree() } : {}), ...(shared(ctx) ? { shared: shared(ctx)! } : {}) }).filter((n) => n.ask && hosts.includes(n.host));
    if (opts.keep) {
      // nothing is known of what strom keeps while its settings cannot be read: never written whole over them
      if (loadArchives(ctx.env).broken) throw new UsageError("the settings of archives (archives.json) cannot be read — nothing changed", { hint: "strom doctor" });
      const milder = loadArchives(ctx.env).pending.filter((p) => p.kind === "milder" && connectors.some((c) => c.name === p.connector) && hosts.includes(p.host ?? ""));
      const asked = floors();
      if (!milder.length && asked.length) {
        // the floor kept as the person's: the question goes (a person's floor is never asked about), the level stays
        const level0 = asked[0]!.floor;
        ctx.requireHuman(`Keep ${title} (${asked.map((n) => n.host).join(", ")}) ${level0} as strom keeps it — not ${asked[0]!.list} as strom's list of its terms says?`, `strom allow archive ${target} --keep`, `archive:keep:${hosts.join(",")}`, ui(lang, "ui.archive.floor.confirm.keep", { title: asked[0]!.title, level: levelWords(lang, level0, false, ["floor"]) }));
        for (const n of asked) setFloor(ctx.env, [n.host], n.floor, "person");
        return { text: `${asked.map((n) => `${n.host}: ${n.floor}`).join(", ")} kept — the person's now, not asked again (milder only by the person: strom allow archive ${target} --level ${asked[0]!.list})`, data: { hosts, kept: [], floors: asked.map((n) => ({ host: n.host, level: n.floor })) } };
      }
      if (!milder.length) return { text: `${hosts.join(", ")}: no connector says it may do more than strom keeps, no level of strom's waits for the person — nothing to keep`, data: { hosts, kept: [] } };
      const kept = connectors.filter((c) => milder.some((p) => p.connector === c.name));
      ctx.requireHuman(`Keep ${hosts.join(", ")} as strom keeps it (${milder.map((p) => `${p.connector}: ${p.from}, not ${p.to}`).join(", ")})?`, `strom allow archive ${target} --keep`, `archive:keep:${hosts.join(",")}`, ui(lang, "ui.archive.keep", { names: kept.map((c) => c.manifest.title).join(", ") }));
      keepReadings(ctx.env, kept);
      return { text: `${hosts.join(", ")}: kept as before — ${milder.map((p) => `${p.connector} ${p.from}`).join(", ")}`, data: { hosts, kept: kept.map((c) => c.name) } };
    }
    if (opts.accept) {
      ctx.requireHuman(`Accept what ${connectors.map((c) => c.name).join(", ")} ${connectors.length === 1 ? "says" : "say"} of ${hosts.join(", ")} now (${connectors.map((c) => claimOf(c)).join(", ")}), its pace too?`, `strom allow archive ${target} --accept`, `archive:accept:${hosts.join(",")}`, ui(lang, "ui.archive.accept", { names: connectors.map((c) => `${c.manifest.title} (${levelWords(lang, claimOf(c))})`).join(", ") }));
      acceptConnectors(ctx.env, connectors);
      return { text: `${hosts.join(", ")}: the connectors' readings accepted — ${connectors.map((c) => `${c.name} ${claimOf(c)}`).join(", ")}`, data: { hosts, accepted: connectors.map((c) => c.name) } };
    }
    if (level) {
      // the levels as they are now (the strictest of all that is known, the person's permission aside): each
      // downloader's of the hosts, and the archive's without one (what strom run and the agent's browser take)
      const tree = ctx.hasTree() ? ctx.tree() : undefined;
      const net = netHere(ctx);
      const levelsNow = (): { a: ArchiveLevel; c?: Connector }[] => [
        ...connectors.flatMap((c) => levelsOf(ctx, c, true).filter((a) => hosts.includes(a.host)).map((a) => ({ a, c }))),
        ...hosts.map((h) => ({ a: archiveLevel(ctx.env, { url: `https://${h}/`, ...(tree ? { tree } : {}), ...(net ? { net } : {}), readOnly: true }) })),
      ];
      const now = strictest(...levelsNow().map((x) => x.a.level));
      // as strict as now or stricter lowers nothing that is known: anybody's (an agent's too)
      const stricter = rank(level) >= rank(now);
      // a store that cannot be read is never written whole over what it held (permissions, refusals, floors) — stricter
      // neither: what it held is not known, so neither is what stricter means
      if (loadArchives(ctx.env).broken) throw new UsageError("the settings of archives (archives.json) cannot be read — nothing changed", { hint: "strom doctor" });
      if (!stricter)
        ctx.requireHuman(`Make ${title} (${hosts.join(", ")}) ${level} — milder than ${now} now?`, `strom allow archive ${target} --level ${level}`, `archive:level:${hosts.join(",")}`, ui(lang, "ui.archive.level.milder", { title, level: levelWords(lang, level), now: levelWords(lang, now) }));
      // milder by the person: the connectors' readings as they are taken with it (else the latch keeps the old one)
      if (!stricter) acceptConnectors(ctx.env, connectors);
      setFloor(ctx.env, hosts, level, stricter && isAgent(ctx.env) ? "agent" : "person");
      const levels = levelsNow();
      const after = strictest(...levels.map((x) => x.a.level));
      // what still holds it stricter: its real sources, each with what to look at (the downloader, the research's archive)
      const holding = levels.filter((x) => rank(x.a.level) > rank(level));
      const look = [...new Set(holding.flatMap((x) => [...(x.c && x.a.from.some((f) => f === "connector" || f === "kept" || f === "pages" || f === "new connector") ? [`strom connector show ${x.c.name}`] : []), ...(x.a.from.includes("tree") && x.a.repository ? [`strom repo show ${x.a.repository}`] : [])]))];
      const said = [...new Set(holding.map((x) => `${x.c ? `${x.c.name}: ` : ""}${levelText(x.a)}`))];
      // strom run and the agent's browser take the archive's level without a downloader: said where it differs
      const plain = levels.filter((x) => !x.c);
      const plainLevel = strictest(...plain.map((x) => x.a.level));
      const woken = stricter ? [] : wakeOpened(ctx, hosts);
      return {
        text: lines(
          `${hosts.join(", ")}: level ${level}${stricter ? " (stricter — anybody may)" : " (the person's)"}`,
          holding.length ? `  it stays ${after}: ${said.join("; ")}${look.length ? ` — ${look.join(" · ")}` : ""}` : undefined,
          connectors.length && rank(plainLevel) !== rank(after) ? `  strom run and the agent's browser take the archive's level without a downloader: ${plainLevel}` : undefined,
          ...wokenLines(lang, woken, rootHere(ctx)),
        ),
        data: { hosts, level, effective: after, ...(holding.length ? { stricter: holding.map((x) => ({ ...(x.c ? { connector: x.c.name } : {}), level: x.a.level, from: x.a.from })) } : {}), woken: woken.map((r) => ({ tree: r.name, path: r.root, woken: r.woken, inbox: r.inbox, kept: r.kept })) },
      };
    }
    if (opts.range) return rangeConsent(ctx, target!, hosts, bare, title, !!opts.revoke, lang);
    if (opts.revoke) {
      ctx.requireHuman(`Forget the permission for ${title} (${hosts.join(", ")})?`, `strom allow archive ${target} --revoke`, `archive:${hosts.join(",")}`, ui(lang, "ui.archive.revoke", { title }));
      revokeWay(ctx.env, hosts);
      // no question waits for the archive now: a task that waited only for the decision comes back to the queue (its
      // fetch asks at the real need); one that waits for images saved by hand keeps waiting
      const woken = wakeAfterDecision(ctx, hosts, "manual");
      return {
        text: lines(`${hosts.join(", ")}: permission forgotten — the person is asked again at the next need`, ...wokenLines(lang, woken, rootHere(ctx))),
        data: { hosts, way: null, woken: woken.map((r) => ({ tree: r.name, path: r.root, woken: r.woken, inbox: r.inbox, kept: r.kept })) },
      };
    }
    if (!way) throw new UsageError("what to decide: --way slow|browser|manual, --revoke, --level <level> or --accept", { hint: `strom allow archive ${target} --way slow` });
    // the levels: a permission does nothing where the terms give no images (manual, forbidden) — that is a level to lift
    const levels = bare ? [bare] : connectors.flatMap((c) => levelsOf(ctx, c, true).filter((a) => hosts.includes(a.host)));
    const closed = levels.find((a) => a.level === "manual" || a.level === "forbidden");
    if (closed && way !== "manual")
      throw new UsageError(`${closed.title ?? closed.host} is ${levelText(closed)} — a permission does not open it`, { hint: closed.refused ? `only the person lifts the refusal: strom allow host ${closed.refused.host} --unblock` : `only the person lifts its level: strom allow archive ${target} --level restricted` });
    const viaBrowser = levels.find((a) => a.browserOnly);
    if (viaBrowser && way === "slow")
      throw new UsageError(`${viaBrowser.title ?? viaBrowser.host} lets automated tools in only through a person's browser (${browserWhy(viaBrowser)}) — never slowly through strom`, { hint: `strom allow archive ${target} --way browser · or by hand: strom allow archive ${target} --way manual` });
    const a = levels[0] ?? { host: hosts[0]!, level: "restricted" as const, from: [], title };
    const says =
      way === "manual" ? ui(lang, "ui.archive.consent.manual", { title: a.title ?? title }) : permissionText(ctx, a, way, named);
    const how = ctx.requireHuman(`${way === "manual" ? "" : "Allow "}${title} (${hosts.join(", ")}): ${WAY_TEXT[way]}?`, `strom allow archive ${target} --way ${way}`, `archive:${hosts.join(",")}`, says);
    grantWay(ctx.env, hosts, way, { by: how === "window" ? "window" : "terminal", ...(named ? { connector: named } : {}) });
    // the tasks that waited for the archive, in every research here (by hand: those for images by hand keep waiting)
    const woken = wakeAfterDecision(ctx, hosts, way);
    const synced = way === "browser" || levels.some((x) => x.permission === "browser") ? syncTrees(ctx) : [];
    const switchable = connectors.filter((c) => routesOf(c).includes("browser") && routeOf(ctx.env, c).via !== "browser");
    const p = paceFor(ctx, hosts[0]!, named);
    const needed = way === "manual" || levels.some((x) => x.level === "restricted" || x.level === "unknown");
    return {
      text: lines(
        ui(lang, "ui.archive.granted", { title: a.title ?? title, way: ui(lang, way === "slow" ? "ui.archive.is.slow" : way === "browser" ? "ui.archive.is.browser" : "ui.archive.is.manual"), host: hosts[0]! }),
        way === "slow" ? `  images ${paceText(p)} (the service's pace stays the slowest; the person's own for the host: strom allow host ${hosts[0]} --pace <s> --per-hour <n>)` : undefined,
        // a connector that can go through the browser follows it; one that goes only directly never goes to an archive
        // only a person's browser reaches — the agent's browser saves its images there, one at a time
        way === "browser" && switchable.length ? `  through the browser: strom connector use ${(switchable.find((c) => c === named) ?? switchable[0]!).name} --via browser` : undefined,
        way === "browser" && viaBrowser && !switchable.length && connectors.length ? `  ${connectors.map((c) => c.name).join(", ")} ${connectors.length === 1 ? "goes" : "go"} only directly: never there — the agent's browser saves its images one at a time (strom media save)` : undefined,
        !needed ? "  (its terms need no permission now — kept for when they do)" : undefined,
        synced.length ? `  the agents' permissions updated in ${synced.join(", ")} — the permission is this computer's, for every research here` : undefined,
        ...wokenLines(lang, woken, rootHere(ctx)),
      ),
      data: { hosts, way, by: how, woken: woken.map((r) => ({ tree: r.name, path: r.root, woken: r.woken, inbox: r.inbox, kept: r.kept })), pace: { minIntervalMs: p.minIntervalMs, perHour: Number.isFinite(p.perHour) ? p.perHour : null } },
    };
  },
});

/**
 * strom allow archive <host> --range (spec 132 K1.2): the person's own consent, for this one archive, to a range of its
 * images saved by the agent's browser in one call (strom media save --images) — only where strom's list lets the
 * archive have it (browserRange) and its images go through the browser as the person allowed. Asked of the person as
 * every permission is (their terminal, a window when an agent asks, exit 4 with none); --revoke takes it back.
 */
function rangeConsent(ctx: Context, target: string, hosts: string[], bare: ArchiveLevel | undefined, title: string, revoke: boolean, lang: string) {
  if (revoke) {
    ctx.requireHuman(`Take back the consent to a range of ${title}'s images through the browser (${hosts.join(", ")})?`, `strom allow archive ${target} --range --revoke`, `archive:range:${hosts.join(",")}`, ui(lang, "ui.archive.range.revoke", { title }));
    revokeRange(ctx.env, hosts);
    return { text: `${hosts.join(", ")}: the consent to a range taken back — its images through the browser one at a time again`, data: { hosts, range: false } };
  }
  const max = Math.max(0, ...hosts.map((h) => browserRangeOf(ctx.env, h) ?? 0));
  if (!max) throw new UsageError(`${title}: strom's list gives it no range — its images through the browser one at a time`, { hint: `strom media save <task> --image <n> --at <the archive's page of that one image>`, code: "archive.range.none" });
  const a = bare ?? archiveLevel(ctx.env, { url: `https://${hosts[0]}/`, ...(ctx.hasTree() ? { tree: ctx.tree() } : {}), readOnly: true });
  if (a.permission !== "browser")
    throw new UsageError(`${title}: a range only besides the permission "through the browser" — ${a.permission ? `it is "${WAY_TEXT[a.permission]}" now` : "none given yet"}`, { hint: `strom allow archive ${target} --way browser, then --range`, code: "archive.range.way" });
  const how = ctx.requireHuman(`Allow ${title} (${hosts.join(", ")}): a range of its images through the browser, up to ${max} in one call, at a person's pace?`, `strom allow archive ${target} --range`, `archive:range:${hosts.join(",")}`, ui(lang, "ui.archive.range.consent", { title, max: String(max) }));
  grantRange(ctx.env, hosts, how === "window" ? "window" : "terminal");
  return { text: ui(lang, "ui.archive.range.granted", { title, max: String(max), host: hosts[0]! }), data: { hosts, range: true, max, by: how } };
}

/**
 * An archive with no connector here that strom's list keeps as only a person's browser's (the host itself, or its
 * site's entry) and where the agent's browser could help: its level as strom reads it now. Others without a connector:
 * none (nothing to allow there).
 */
export function bareArchive(ctx: Context, host: string): ArchiveLevel | undefined {
  // strom's list, and a test's own (STROM_ARCHIVES_FILE, settings of its own)
  const entry = knownTerms(ctx.env).filter((k) => k.browserOnly && within(host, k.host));
  if (!entry.length) return undefined;
  const tree = ctx.hasTree() ? ctx.tree() : undefined;
  const net = netHere(ctx);
  const a = archiveLevel(ctx.env, { url: `https://${host}/`, ...(tree ? { tree } : {}), ...(net ? { net } : {}), readOnly: true });
  // where no permission could help (by hand only, robots.txt keeping automated tools off it all): nothing to allow
  return a.browserOnly && browserHelps(a) ? a : undefined;
}

/** The archives for strom consents: each connector host with its level, the person's permission and its pace. */
export function archivesOverview(ctx: Context): { host: string; connector: string; level: string; from: string[]; robots?: boolean; browserOnly?: boolean; refused?: string; way?: Way; pace: { minIntervalMs: number; perHour: number | null } }[] {
  const out: ReturnType<typeof archivesOverview> = [];
  for (const c of listConnectors(shared(ctx), ctx.env))
    for (const a of levelsOf(ctx, c, true)) {
      const human = humanPaces(ctx, [a], c.manifest.browser?.pages ? "pages" : "images", routeOf(ctx.env, c).via).get(a.host);
      const dir = shared(ctx);
      const p = hostPace(dir ? hostState(path.join(dir, "net"), a.host) : { recent: [] }, human ? latchedPace(ctx.env, c, a.host) : c.manifest.policy.pace, human, a.host);
      out.push({ host: a.host, connector: c.name, level: a.level, from: a.from, ...(a.quoteBy === "robots" || a.browserOnly?.by === "robots" ? { robots: true } : {}), ...(a.browserOnly ? { browserOnly: true } : {}), ...(a.refused && !a.refused.unreadable ? { refused: a.refused.host } : {}), ...(a.permission ? { way: a.permission } : {}), pace: { minIntervalMs: p.minIntervalMs, perHour: Number.isFinite(p.perHour) ? p.perHour : null } });
    }
  return out;
}
