// strom net web: an agent's own web requests, kept like a person on the web (core/web.ts). The tree's agent settings
// run it as a hook before each web fetch and search (--hook); without it, what this session asked of each server.

import { register } from "../cli/registry.ts";
import { lines } from "../cli/format.ts";
import { answerWebEvent, hookOutput, lastWebSession, webEvent, WEB_PER_HOST, WEB_SOFT, WEB_SOFT_GAP_MS, WEB_WAIT_MAX_MS } from "../core/web.ts";
import { webDomain, webRequestsOf } from "../core/metrics.ts";
import { currentSession } from "../core/session.ts";
import { requireRecord } from "../core/records.ts";
import type { Session } from "../core/model.ts";

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
    "Without --hook: this session's requests by server (no session open: the last one with web requests, said which).",
  options: [
    { name: "hook", type: "boolean", description: "read the agent's hook event (JSON) on stdin and answer it (the tree's settings run it)" },
    { name: "session", type: "string", value: "<N…>", description: "this session's requests (a strom session, or the agent's own id of one); default: the open one, else the last with web requests" },
  ],
  examples: ["strom net web", "strom net web --session N0001"],
  run: async (ctx, { opts }) => {
    if (opts.hook) {
      // never in the way by itself: whatever goes wrong, the call goes on as the agent's own rules say
      try {
        const ev = webEvent(ctx.io.stdinText?.() ?? "");
        if (!ev) return { text: "" };
        const answer = await answerWebEvent(ev, { env: ctx.env, cwd: ctx.cwd });
        return { text: hookOutput(answer) };
      } catch {
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
        `${name}: ${hosts.reduce((n, [, c]) => n + c, 0)} web request(s) to ${hosts.length} server(s), ${seen.search} search(es)`,
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
