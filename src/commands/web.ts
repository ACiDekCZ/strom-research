// strom net web: an agent's own web requests, kept like a person on the web (core/web.ts). The tree's agent settings
// run it as a hook before each web fetch and search (--hook); without it, what this session asked of each server.

import { register } from "../cli/registry.ts";
import { counted, lines } from "../cli/format.ts";
import { answerWebEvent, hookOutput, lastWebSession, webEvent, WEB_PER_HOST, WEB_SOFT, WEB_SOFT_GAP_MS, WEB_WAIT_MAX_MS } from "../core/web.ts";
import { webDomain, webRequestsOf } from "../core/metrics.ts";
import { currentSession } from "../core/session.ts";
import { requireRecord } from "../core/records.ts";
import type { Session } from "../core/model.ts";
import { bookOn, browserGate, otherWay, webGate, type WebGate } from "../core/webgate.ts";
import { browserKept, withoutBrowserReason } from "../core/browserhelp.ts";
import { detectAgent } from "../core/which.ts";
import { answerChromeEvent, chromeEvent, isNavigate, navigateUrl } from "../core/chromehook.ts";
import { answerCodexEvent, codexEvent, unwatchedOf } from "../core/codexhook.ts";
import { knownPaceMs, knownSearch } from "../core/knownterms.ts";
import { humanPace, termsFor } from "../core/terms.ts";
import { clock } from "../core/net.ts";
import { UsageError } from "../core/errors.ts";
import type { Context } from "../cli/context.ts";

register({
  path: ["net", "web"],
  summary: "Your own web requests in this session, by server (the tree's hook runs it with --hook before each web fetch and search)",
  group: "setup",
  description:
    `Searching the web is your judgement. Fetching much from one server is not: past ${WEB_SOFT} pages or items of one site (its\n` +
    "registrable domain: a server's mirrors count with it) in a session, build its connector (strom connector new <site>\n" +
    "--url https://<host>/; <site>: the domain's name, api.example.org → example, one connector a site), which keeps the\n" +
    "server's pace, robots.txt and terms, and read the rest through strom fetch; a task \"Connector for <domain>\" only if\n" +
    `no time is left or the terms forbid it. Past ${WEB_SOFT} the web fetch goes slower (one\n` +
    `request per ${WEB_SOFT_GAP_MS / 1000} s to the site), past web.perHost (${WEB_PER_HOST} unless the user set it) it is refused. The tree's agent\n` +
    "settings run strom net web --hook before each web fetch: it is recorded (.strom/metrics/fetch.jsonl), counted in\n" +
    "the server's hour and paced like strom's own requests, one request at a time — many at once wait their turn\n" +
    `(one whose turn does not come within ${WEB_WAIT_MAX_MS / 1000} s: refused in a run, let go in a conversation below the soft threshold —\n` +
    "the user is never asked for the pace); refused while the server is left alone or its limit is used up; past\n" +
    "web.perHost refused in a run nobody watches, and in a conversation the user asked once per site and session\n" +
    "(their yes or no to that question stands for it) — counted once it went out (the same hook after the fetch ran).\n" +
    "Without --hook: this session's requests by server (no session open: the last one with web requests, said which).\n" +
    "--check <url>: whether strom would let your web tools fetch that address now, and why — the archive's level, the\n" +
    "person's permission, the robots.txt line, a refusal of strom's client, the host left alone — read only, nothing sent;\n" +
    "a digital library strom knows: its own search addresses too, to fetch as given (the words URL-encoded).\n" +
    "--check <url> --browser: the same for your browser (Claude in Chrome, another agent's browser): an archive only a\n" +
    "person's browser goes to opens to Claude in Chrome within its level and the person's permission \"through the\n" +
    "browser\", at a person's pace (about 10 s between pages unless the person set another, or its own slower one) —\n" +
    "never of its own accord to another agent's browser or computer use (strom keeps no hook before them, recommends\n" +
    "none; only the person's explicit request makes it the person's choice): the person saves its images.\n" +
    "An agent without strom's hook (Codex, OpenCode, Antigravity) runs it before its own web fetch of an archive's site\n" +
    "and keeps to its answer.\n" +
    "Claude in Chrome: the same hook runs before its navigate — counted, paced and refused with the web fetches of the\n" +
    "same site — and before each tool on a page (refused while the tab's host is closed or left alone; not counted).\n" +
    "It knows a tab's site from navigate alone: a click or a typed address that leads elsewhere it does not see. Go from\n" +
    "page to page of an archive by navigate to the address, one page at a time — never click through a series of pages.\n" +
    "The built-in browser of Claude's desktop app (navigate, preview_start, tabs_create, the tools on a page): kept by the\n" +
    "same hook with the same answers, its tabs apart from Chrome's — still not recommended, never of your own accord.\n" +
    "Codex's browser (its node_repl js, once the person confirmed the tree's hooks in Codex): the same hook reads the\n" +
    "addresses written out in the code — tab.goto(\"https://…\") — and answers them as navigate (two archives' pages in one\n" +
    "call refused: one at a time); code with no address it can see is never refused, only recorded as unwatched (counted\n" +
    "here). Codex's computer use strom neither watches nor records (strom doc R12.5).",
  options: [
    { name: "hook", type: "boolean", description: "read the agent's hook event (JSON) on stdin and answer it (the tree's settings run it)" },
    { name: "session", type: "string", value: "<N…>", description: "this session's requests (a strom session, or the agent's own id of one); default: the open one, else the last with web requests" },
    { name: "check", type: "string", value: "<url>", description: "may your web tools fetch this address now, and why (read only: no request sent)" },
    { name: "browser", type: "boolean", description: "with --check: may your browser open it (a person's browser's route: an archive only a browser goes to, a person's pace)" },
  ],
  examples: ["strom net web", "strom net web --session N0001", "strom net web --check https://archive.example.org/book/5359", "strom net web --check https://archive.example.org/book/5359 --browser"],
  run: async (ctx, { opts }) => {
    if (opts.check !== undefined) return checkUrl(ctx, String(opts.check), opts.browser === true);
    if (opts.browser === true) throw new UsageError("--browser goes with --check <url>", { hint: "strom net web --check https://archive.example.org/book/5359 --browser" });
    if (opts.hook) {
      let ev: ReturnType<typeof webEvent>;
      let chrome: ReturnType<typeof chromeEvent>;
      // never in the way by itself: whatever goes wrong, the call goes on as the agent's own rules say
      try {
        const stdin = ctx.io.stdinText?.() ?? "";
        ev = webEvent(stdin);
        // Codex's browser (its node_repl's code): core/codexhook.ts
        const codex = ev ? undefined : codexEvent(stdin);
        if (codex) return { text: hookOutput(await answerCodexEvent(codex, { env: ctx.env, cwd: ctx.cwd })) };
        // the browser's navigate and its page tools (Claude in Chrome, the desktop app's built-in browser): core/chromehook.ts
        chrome = ev ? undefined : chromeEvent(stdin);
        if (chrome) return { text: hookOutput(await answerChromeEvent(chrome, { env: ctx.env, cwd: ctx.cwd })) };
        if (!ev) return { text: "" };
        const answer = await answerWebEvent(ev, { env: ctx.env, cwd: ctx.cwd });
        return { text: hookOutput(answer) };
      } catch {
        // D8: what strom keeps could not be read — an archive strom's list says forbids automated access stays closed
        try {
          if (ev?.via === "web" && ev.netHost && !ev.phase && termsFor(ctx.env, ev.netHost)?.level === "forbidden")
            return { text: hookOutput({ decision: "deny", reason: `strom: the terms of ${ev.netHost} allow no automated access — not through your web tools either.` }) };
          const at = chrome && isNavigate(chrome) && !chrome.phase && chrome.url ? new URL(navigateUrl(chrome.url)).hostname.toLowerCase() : undefined;
          if (at && termsFor(ctx.env, at)?.level === "forbidden")
            return { text: hookOutput({ decision: "deny", reason: `strom: the terms of ${at} allow no automated access — not through the browser either.` }) };
        } catch {
          // nothing more to say
        }
        return { text: "" };
      }
    }
    const tree = ctx.tree();
    const perHost = ctx.settings.webPerHost(tree.config);
    // which session: the one named (a strom session N…, else the agent's own id of one), the open one, else the last
    // one with web requests — the hook counts a conversation without a strom session by the agent's id
    const named = typeof opts.session === "string" && opts.session.trim() ? opts.session.trim() : undefined;
    let who: { session?: string; agentSession?: string } | undefined;
    let open = false;
    if (named && /^N\d+$/i.test(named)) {
      const s = requireRecord<Session>(tree, named.toUpperCase(), "session");
      who = { session: s.id };
      open = s.state === "open";
    } else if (named) who = { agentSession: named };
    else {
      const s = currentSession(tree, ctx.env, ctx.refs);
      if (s) [who, open] = [{ session: s.id }, true];
      else who = lastWebSession(tree.root);
    }
    const soft = Math.min(WEB_SOFT, perHost);
    if (!who) return { text: "no session open and no web requests recorded yet — strom session start", data: { session: null, open: false, hosts: {}, domains: {}, searches: 0, soft, perHost } };
    const seen = webRequestsOf(tree.root, who);
    // Codex's browser code that named no address strom could see (core/codexhook.ts)
    const unwatched = unwatchedOf(tree.root, who).total;
    const hosts = [...seen.hosts].sort((a, b) => b[1] - a[1]);
    const domains = [...seen.domains].sort((a, b) => b[1] - a[1]);
    const state = who.session ? tree.get<Session>(who.session)?.state : undefined;
    const name = who.session
      ? `${who.session}${open ? "" : ` (${state ?? "unknown"}${named ? "" : "; no session open — the last one with web requests"})`}`
      : `the agent's session ${who.agentSession} (no strom session${named ? "" : "; the last one with web requests"})`;
    return {
      text: lines(
        `${name}: ${counted(hosts.reduce((n, [, c]) => n + c, 0), "web request")} to ${counted(hosts.length, "server")}, ${counted(seen.search, "search", "searches")}`,
        // by site, as the thresholds count (its hosts after it when it has more than one, or another name)
        ...domains.map(([d, c]) => {
          const its = hosts.filter(([h]) => webDomain(h) === d);
          const of = its.length === 1 && its[0]![0].replace(/:\d+$/, "") === d ? "" : `  (${its.map(([h, n]) => `${h} ${n}`).join(", ")})`;
          const zone = c >= perHost ? `  — past ${perHost}: the next one refused, through strom fetch with a connector` : c >= soft ? `  — past ${soft}: slower; the rest through a connector` : "";
          return `  ${d}  ${c}${of}${zone}`;
        }),
        unwatched ? `  ${counted(unwatched, "browser call")} with no address strom could see (unwatched): name each page's address in the call — tab.goto("https://…")` : undefined,
      ),
      data: { session: who.session ?? null, ...(who.agentSession ? { agentSession: who.agentSession } : {}), open, hosts: Object.fromEntries(hosts), domains: Object.fromEntries(domains), searches: seen.search, ...(unwatched ? { unwatched } : {}), soft, perHost },
    };
  },
});


/** strom net web --check <url>: what the tree's hook would answer the agent's web fetch of it now, read only. */
function checkUrl(ctx: Context, url: string, browser = false) {
  let u: URL;
  try {
    u = new URL(url.trim());
  } catch {
    throw new UsageError(`--check takes an address: not "${url}"`, { hint: "strom net web --check https://archive.example.org/book/5359" });
  }
  if (!/^https?:$/.test(u.protocol)) throw new UsageError(`--check takes an http(s) address: not "${url}"`);
  const tree = ctx.hasTree() ? ctx.tree() : undefined;
  const shared = ctx.settings.shared()?.value;
  const session = tree ? currentSession(tree, ctx.env, ctx.refs) : undefined;
  const gateOf = browser ? browserGate : webGate;
  let g: WebGate = gateOf({ env: ctx.env, ...(tree ? { tree } : {}), url: u.href, shared, ...(session?.task ? { task: session.task } : {}) });
  // an agent whose browser strom does not keep (no hook of strom's before a page): an archive only a person's browser
  // goes to not through its browser or computer use on strom's word, whatever the person allowed — the person's hand
  // (Milan's decision, 4 November 2026); nothing is switched off: the person's explicit request is the person's choice
  // (5 November 2026, ON_REQUEST)
  const runner = detectAgent(ctx.env);
  if (runner && !browserKept(runner) && g.level?.browserOnly && (g.allow || g.why === "browser")) {
    const book = bookOn(tree, session?.task, g.host, u.href);
    const rest: WebGate = { ...g };
    delete rest.human;
    delete rest.blocked;
    g = { ...rest, allow: false, why: "browser", reason: withoutBrowserReason(g.level, g.level.title ?? g.host, session?.task, book, otherWay(g.host, u.href, session?.task)) };
  }
  const ok = g.allow && !g.blocked;
  const search = knownSearch(u.hostname);
  const a = g.level;
  const answer = !g.allow ? "refused" : g.blocked ? "refused now" : g.why === "terms" ? "only this page (its terms)" : "allowed";
  const why = !g.allow
    ? g.reason ?? ""
    : g.blocked
      ? `strom: ${g.host} is left alone until ${clock(g.blocked.until)}${g.blocked.reason ? ` — ${g.blocked.reason}` : ""}; nothing goes to it before then, through your web tools either. Go on with other work.`
      : g.why === "terms"
        ? `its archive is closed to automated tools; its terms page only, at most a few times a day`
        : browser
          ? `pages of it through your browser within the web rule (strom guide), counted with your web fetches of the site${g.human ? `; at a person's pace — one page at a time, at least ${Math.max(humanPace(ctx.env).minIntervalMs, knownPaceMs(g.host)) / 1000} s apart` : ""}`
          : "pages of it through your web tools within the web rule (strom guide); images of an archive through strom fetch";
  return {
    text: lines(
      `${u.href}: ${answer}`,
      a ? `  archive ${a.host}: ${a.level}${a.from.length ? ` (${a.from.join(", ")})` : ""}${a.permission ? ` · the person's permission: ${a.permission}` : ""}${a.refused ? " · refused strom's client" : ""}${a.browserOnly ? " · only through a person's browser" : ""}` : undefined,
      g.robots ? `  robots.txt: ${g.robots.line} (${g.robots.path})` : undefined,
      `  ${why}`,
      // its own search, as strom's list gives it: fetched as given, never guessed
      ...(g.allow && search.length ? ["  its search (fetch as given; {q} the words, a space %20, ( %28, ) %29, [ %5B, ] %5D, : %3A, \" %22):", ...search.map((x) => `    ${x.what}: ${x.url}`)] : []),
    ),
    data: {
      url: u.href,
      host: g.host,
      ...(browser ? { route: "browser" } : {}),
      allow: ok,
      ...(g.human ? { human: true } : {}),
      answer: !g.allow ? "refused" : g.blocked ? "wait" : "ok",
      ...(g.why ? { why: g.why } : {}),
      ...(a ? { level: a.level, from: a.from, ...(a.permission ? { permission: a.permission } : {}), ...(a.refused ? { refused: a.refused } : {}), ...(a.browserOnly ? { browserOnly: a.browserOnly } : {}) } : {}),
      ...(g.robots ? { robots: g.robots } : {}),
      ...(g.blocked ? { blocked: { until: new Date(g.blocked.until).toISOString(), ...(g.blocked.reason ? { reason: g.blocked.reason } : {}) } } : {}),
      ...(g.termsToday !== undefined ? { termsToday: g.termsToday } : {}),
      reason: why,
      ...(g.allow && search.length ? { search } : {}),
    },
  };
}
