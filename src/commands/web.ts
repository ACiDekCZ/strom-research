// strom net web: an agent's own web requests, kept like a person on the web (core/web.ts). The tree's agent settings
// run it as a hook before each web fetch and search (--hook); without it, what this session asked of each server.

import { register } from "../cli/registry.ts";
import { counted, lines } from "../cli/format.ts";
import { answerWebEvent, hookOutput, lastWebSession, webEvent, WEB_PER_HOST, WEB_SOFT, WEB_SOFT_GAP_MS, WEB_WAIT_MAX_MS } from "../core/web.ts";
import { webDomain, webRequestsOf } from "../core/metrics.ts";
import { currentSession } from "../core/session.ts";
import { requireRecord } from "../core/records.ts";
import type { Session } from "../core/model.ts";
import { webGate } from "../core/webgate.ts";
import { termsFor } from "../core/terms.ts";
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
    "person's permission, the robots.txt line, a refusal of strom's client, the host left alone — read only, nothing sent.\n" +
    "An agent without strom's hook (Codex, OpenCode, Antigravity) runs it before its own web fetch of an archive's site\n" +
    "and keeps to its answer.",
  options: [
    { name: "hook", type: "boolean", description: "read the agent's hook event (JSON) on stdin and answer it (the tree's settings run it)" },
    { name: "session", type: "string", value: "<N…>", description: "this session's requests (a strom session, or the agent's own id of one); default: the open one, else the last with web requests" },
    { name: "check", type: "string", value: "<url>", description: "may your web tools fetch this address now, and why (read only: no request sent)" },
  ],
  examples: ["strom net web", "strom net web --session N0001", "strom net web --check https://archive.example.org/book/5359"],
  run: async (ctx, { opts }) => {
    if (opts.check !== undefined) return checkUrl(ctx, String(opts.check));
    if (opts.hook) {
      let ev: ReturnType<typeof webEvent>;
      // never in the way by itself: whatever goes wrong, the call goes on as the agent's own rules say
      try {
        ev = webEvent(ctx.io.stdinText?.() ?? "");
        if (!ev) return { text: "" };
        const answer = await answerWebEvent(ev, { env: ctx.env, cwd: ctx.cwd });
        return { text: hookOutput(answer) };
      } catch {
        // D8: what strom keeps could not be read — an archive strom's list says forbids automated access stays closed
        try {
          if (ev?.via === "web" && ev.netHost && !ev.phase && termsFor(ctx.env, ev.netHost)?.level === "forbidden")
            return { text: hookOutput({ decision: "deny", reason: `strom: the terms of ${ev.netHost} allow no automated access — not through your web tools either.` }) };
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
      ),
      data: { session: who.session ?? null, ...(who.agentSession ? { agentSession: who.agentSession } : {}), open, hosts: Object.fromEntries(hosts), domains: Object.fromEntries(domains), searches: seen.search, soft, perHost },
    };
  },
});


/** strom net web --check <url>: what the tree's hook would answer the agent's web fetch of it now, read only. */
function checkUrl(ctx: Context, url: string) {
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
  const g = webGate({ env: ctx.env, ...(tree ? { tree } : {}), url: u.href, shared, ...(session?.task ? { task: session.task } : {}) });
  const ok = g.allow && !g.blocked;
  const a = g.level;
  const answer = !g.allow ? "refused" : g.blocked ? "refused now" : g.why === "terms" ? "only this page (its terms)" : "allowed";
  const why = !g.allow
    ? g.reason ?? ""
    : g.blocked
      ? `strom: ${g.host} is left alone until ${clock(g.blocked.until)}${g.blocked.reason ? ` — ${g.blocked.reason}` : ""}; nothing goes to it before then, through your web tools either. Go on with other work.`
      : g.why === "terms"
        ? `its archive is closed to automated tools; its terms page only, at most a few times a day`
        : "pages of it through your web tools within the web rule (strom guide); images of an archive through strom fetch";
  return {
    text: lines(
      `${u.href}: ${answer}`,
      a ? `  archive ${a.host}: ${a.level}${a.from.length ? ` (${a.from.join(", ")})` : ""}${a.permission ? ` · the person's permission: ${a.permission}` : ""}${a.refused ? " · refused strom's client" : ""}${a.browserOnly ? " · only through a person's browser" : ""}` : undefined,
      g.robots ? `  robots.txt: ${g.robots.line} (${g.robots.path})` : undefined,
      `  ${why}`,
    ),
    data: {
      url: u.href,
      host: g.host,
      allow: ok,
      answer: !g.allow ? "refused" : g.blocked ? "wait" : "ok",
      ...(g.why ? { why: g.why } : {}),
      ...(a ? { level: a.level, from: a.from, ...(a.permission ? { permission: a.permission } : {}), ...(a.refused ? { refused: a.refused } : {}), ...(a.browserOnly ? { browserOnly: a.browserOnly } : {}) } : {}),
      ...(g.robots ? { robots: g.robots } : {}),
      ...(g.blocked ? { blocked: { until: new Date(g.blocked.until).toISOString(), ...(g.blocked.reason ? { reason: g.blocked.reason } : {}) } } : {}),
      ...(g.termsToday !== undefined ? { termsToday: g.termsToday } : {}),
      reason: why,
    },
  };
}
