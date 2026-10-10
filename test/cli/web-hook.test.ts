// An agent's own web tools kept like a person on the web (core/web.ts): the tree's Claude Code settings and Grok's own
// hooks run `strom net web --hook` before each web fetch and search; it records the request in fetch.jsonl, counts it
// in the host's shared hour and waits for its pace; refuses while the host is left alone or its cap is full. Counted
// per site (its registrable domain: mirrors together) and session: up to WEB_SOFT at the host's pace; past it never
// refused for the number, one request per WEB_SOFT_GAP_MS to the site, the connector advised once; past web.perHost
// refused in a run nobody watches and the person asked once in a conversation. Anything wrong lets the call go. No list
// of archives: the same numbers for every site.

import { after, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { World, hasGit, readJsonFile } from "../helpers.ts";
import { refusedBy, setOwnPace, testHooks } from "../../src/core/net.ts";
import { WEB_PER_HOST, WEB_SOFT, WEB_SOFT_GAP_MS, WEB_WAIT_MAX_MS, claudeWebHooks, connectorName, grokWebHooks, webEvent, webHookCommand } from "../../src/core/web.ts";
import { buildBrief, STROM_ONLY, webRule } from "../../src/brief/brief.ts";
import { syncAgentFiles } from "../../src/agents/files.ts";
import { Tree } from "../../src/core/tree.ts";
import { countedWeb, recordAgentWeb, webDomain } from "../../src/core/metrics.ts";
import { askFinish, finishFile } from "../../src/core/clock.ts";

const opts = { skip: !hasGit };
/** The threshold of the tests of the single threshold: the soft one, the hard one set to it (web.perHost). */
const HARD = 12;
const pauses: number[] = [];
// a pause is not waited out: the clock the limiter reads moves on by it
let ahead = 0;
testHooks.now = () => Date.now() + ahead;
testHooks.sleep = async (ms) => {
  pauses.push(ms);
  ahead += ms;
};
after(() => {
  testHooks.sleep = undefined;
  testHooks.now = undefined;
});

const journal = (w: World) => {
  const f = path.join(w.cwd, ".strom", "metrics", "fetch.jsonl");
  return fs.existsSync(f) ? fs.readFileSync(f, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l) as Record<string, any>) : [];
};
const net = (w: World) => path.join(w.home, "shared", "net");

/** Claude Code's PreToolUse event of a web fetch. */
const fetchEvent = (w: World, url: string, o: { sid?: string; use?: string } = {}) =>
  JSON.stringify({ session_id: o.sid ?? "agent-1", cwd: w.cwd, hook_event_name: "PreToolUse", tool_name: "WebFetch", tool_input: { url, prompt: "the text" }, ...(o.use ? { tool_use_id: o.use } : {}) });

/** Claude Code's event after a web fetch ran (PostToolUse) or failed (PostToolUseFailure, with its error). */
const afterEvent = (w: World, url: string, use: string, failed?: string) =>
  JSON.stringify({
    session_id: "agent-1", cwd: w.cwd, hook_event_name: failed ? "PostToolUseFailure" : "PostToolUse", tool_name: "WebFetch", tool_input: { url, prompt: "the text" }, tool_use_id: use,
    ...(failed ? { error: failed } : { tool_response: { code: 200, result: "the text" } }),
  });

async function hook(w: World, stdin: string, env: Record<string, string> = {}) {
  const r = await w.run(["net", "web", "--hook"], { stdin, env: { CLAUDECODE: "1", ...env } });
  assert.equal(r.code, 0, `the hook never fails: ${r.err}`);
  return { out: r.out.trim(), json: r.out.trim() ? (JSON.parse(r.out) as { hookSpecificOutput: { permissionDecision: string; permissionDecisionReason: string } }).hookSpecificOutput : undefined };
}

test("the tree's Claude Code settings run strom's hook before each web fetch and search; Grok's own hooks file too; an archive has neither", opts, async () => {
  const w = new World();
  await w.withTree();
  const settings = readJsonFile(path.join(w.cwd, ".claude", "settings.json")) as { hooks: { PreToolUse: { matcher: string; hooks: { type: string; command: string; timeout: number }[] }[] } };
  const [group] = settings.hooks.PreToolUse;
  assert.equal(group!.matcher, "WebFetch|WebSearch");
  const h = group!.hooks[0]!;
  assert.equal(h.type, "command");
  assert.ok(h.timeout >= 30, "a time limit of its own, above the pace it waits for");
  if (process.platform !== "win32") {
    assert.equal(h.command, `'${path.join(w.cwd, ".strom", "bin", "strom")}' net web --hook || true`, "the tree's own strom; its failure never blocks (exit 2 would)");
    assert.ok(fs.existsSync(path.join(w.cwd, ".strom", "bin", "strom")), "the strom it names is there");
    assert.equal(fs.readFileSync(path.join(w.cwd, ".strom", "bin", "strom-hook.cmd"), "utf8"), '@echo off\r\ncall "%~dp0strom.cmd" %*\r\nexit /b 0\r\n', "Grok's on Windows: its exit always 0");
  }
  const grok = readJsonFile(path.join(w.cwd, ".grok", "hooks", "strom.json")) as { hooks: { PreToolUse: { matcher: string; hooks: { command: string }[] }[] } };
  assert.equal(grok.hooks.PreToolUse[0]!.matcher, "web_fetch|web_search", "Grok's own tool names");
  assert.equal(grok.hooks.PreToolUse[0]!.hooks[0]!.command, h.command, "one handler: Grok runs it once where both files name it");
  // and after each web fetch ran or failed (an asked one is counted once it went out)
  const after = settings.hooks as unknown as Record<string, { matcher: string; hooks: { command: string }[] }[]>;
  for (const ev of ["PostToolUse", "PostToolUseFailure"]) {
    assert.equal(after[ev]![0]!.matcher, "WebFetch", ev);
    assert.equal(after[ev]![0]!.hooks[0]!.command, h.command, ev);
    const g = (grok.hooks as unknown as Record<string, { matcher: string; hooks: { command: string }[] }[]>)[ev]!;
    assert.equal(g[0]!.matcher, "web_fetch", ev);
    assert.equal(g[0]!.hooks[0]!.command, h.command, ev);
  }

  // an archive: no agent files, the hooks with them
  await w.ok(["init", "Archiv", "--mode", "archive"]);
  const archive = w.treeDir("Archiv");
  assert.ok(!fs.existsSync(path.join(archive, ".claude", "settings.json")));
  assert.ok(!fs.existsSync(path.join(archive, ".grok", "hooks", "strom.json")));
  w.cleanup();
});

test("Windows: the hook in PowerShell (no Git Bash needed), never exit 2", () => {
  const root = "C:\\Users\\Jan Novák\\Documents\\Strom\\Novákovi";
  const c = webHookCommand(root, "win32");
  assert.equal(c.shell, "powershell");
  assert.equal(c.command, "& 'C:\\Users\\Jan Novák\\Documents\\Strom\\Novákovi\\.strom\\bin\\strom.cmd' net web --hook; exit 0");
  const claude = claudeWebHooks(root, "win32") as { PreToolUse: { hooks: { shell?: string }[] }[] };
  assert.equal(claude.PreToolUse[0]!.hooks[0]!.shell, "powershell");
  const grok = grokWebHooks(root, "win32") as { hooks: { PreToolUse: { hooks: { command: string; shell?: string }[] }[] } };
  assert.equal(grok.hooks.PreToolUse[0]!.hooks[0]!.shell, undefined);
  // Grok's own shell: the shim whose exit is always 0 — an older strom without `net web` (exit 2) never blocks a web tool
  assert.equal(grok.hooks.PreToolUse[0]!.hooks[0]!.command, `"C:\\Users\\Jan Novák\\Documents\\Strom\\Novákovi\\.strom\\bin\\strom-hook.cmd" net web --hook`);
  for (const ev of ["PostToolUse", "PostToolUseFailure"])
    assert.match((grok.hooks as unknown as Record<string, { hooks: { command: string }[] }[]>)[ev]![0]!.hooks[0]!.command, /strom-hook\.cmd" net web --hook$/, ev);
  // every command of every agent's file passes strom's answer on and never fails by itself
  for (const platform of ["win32", "linux", "darwin"] as const) {
    const c = claudeWebHooks(root.replace(/\\/g, platform === "win32" ? "\\" : "/"), platform) as Record<string, { hooks: { command: string }[] }[]>;
    for (const ev of ["PreToolUse", "PostToolUse", "PostToolUseFailure"]) assert.match(c[ev]![0]!.hooks[0]!.command, platform === "win32" ? /; exit 0$/ : / \|\| true$/, `${platform} ${ev}`);
  }
  // a quote in a path stays inside its quotes
  assert.equal(webHookCommand("/home/o'brien/Strom/T", "linux").command, `'/home/o'\\''brien/Strom/T/.strom/bin/strom' net web --hook || true`);
});

test("the connector suggested is named from the site, one name for all its hosts; its --url stays the host asked", () => {
  assert.equal(connectorName("api.kramerius.mzk.cz"), "mzk");
  assert.equal(connectorName("mzk.cz"), "mzk");
  assert.equal(connectorName("a.example-sim.cz"), "example-sim");
  assert.equal(connectorName("b.example-sim.cz"), "example-sim");
  assert.equal(connectorName("ia801408.us.archive.org"), "archive");
  assert.equal(connectorName("www.bbc.co.uk"), "bbc");
  assert.equal(connectorName("matriky.příklad.cz:8080"), "priklad");
  assert.equal(connectorName("localhost"), "localhost");
  assert.equal(connectorName("192.168.1.10"), "192-168-1-10");
  // an address of numbers: this computer's is localhost, another the address in dashes — never a part of it
  assert.equal(connectorName("[::1]:8080"), "localhost");
  assert.equal(connectorName("[::1]"), "localhost");
  assert.equal(connectorName("127.0.0.1:8080"), "localhost");
  assert.equal(connectorName("localhost:3000"), "localhost");
  assert.equal(connectorName("192.168.1.5:8080"), "192-168-1-5");
  assert.equal(connectorName("[2001:db8::1]:443"), "2001-db8-1");
  assert.equal(connectorName("[fe80::1%25en0]"), "fe80-1");
});

test("the event as Claude Code and Grok send it: a web fetch with its host, a search, anything else nothing", () => {
  assert.deepEqual(webEvent(JSON.stringify({ session_id: "a", tool_name: "WebFetch", tool_input: { url: "https://Katalog.Example.ORG/item/1?x=ž" }, tool_use_id: "u1", cwd: "/t" })), {
    agent: "claude", tool: "WebFetch", via: "web", agentSession: "a", toolUse: "u1", cwd: "/t", url: "https://Katalog.Example.ORG/item/1?x=ž", host: "katalog.example.org", netHost: "katalog.example.org",
  });
  // one host normaliser (core/metrics.ts webHost): a port not the scheme's own kept, an IDN as punycode; the limiter by its name
  const odd = webEvent(JSON.stringify({ tool_name: "WebFetch", tool_input: { url: "http://Matriky.Příklad.CZ:8080/a" } }))!;
  assert.deepEqual([odd.host, odd.netHost], ["matriky.xn--pklad-zsa96e.cz:8080", "matriky.xn--pklad-zsa96e.cz"]);
  assert.equal(webEvent(JSON.stringify({ hookEventName: "pre_tool_use", hook_event_name: "PreToolUse", sessionId: "g", toolName: "web_fetch", toolInput: { url: "https://example.org/" }, toolUseId: "x" }))?.agent, "grok");
  assert.equal(webEvent(JSON.stringify({ tool_name: "WebSearch", tool_input: { query: "Novák Týnec" } }))?.via, "search");
  // after the call: ran, or failed with what the agent said of it (Grok's snake_case name too); before it: no phase
  assert.equal(webEvent(JSON.stringify({ hook_event_name: "PostToolUse", tool_name: "WebFetch", tool_input: { url: "https://example.org/" }, tool_use_id: "u" }))?.phase, "post");
  assert.equal(webEvent(JSON.stringify({ hookEventName: "post_tool_use", toolName: "web_fetch", toolInput: { url: "https://example.org/" }, toolUseId: "u" }))?.phase, "post");
  const failed = webEvent(JSON.stringify({ hook_event_name: "PostToolUseFailure", tool_name: "WebFetch", tool_input: { url: "https://example.org/" }, tool_use_id: "u", error: "HTTP 404" }))!;
  assert.deepEqual([failed.phase, failed.error], ["failed", "HTTP 404"]);
  assert.equal(webEvent(JSON.stringify({ hook_event_name: "PreToolUse", tool_name: "WebFetch", tool_input: { url: "https://example.org/" } }))?.phase, undefined);
  for (const bad of ["", "{garbage", "[]", "null", JSON.stringify({ tool_name: "Bash", tool_input: { command: "ls" } }), JSON.stringify({ tool_name: "WebFetch", tool_input: { url: "file:///etc/passwd" } }), JSON.stringify({ tool_name: "WebFetch", tool_input: {} })])
    assert.equal(webEvent(bad), undefined, bad);
});

test("a web fetch recorded in fetch.jsonl and counted in the host's hour, paced; 12 go, the 13th: a run refuses, a conversation asks the person — impersonal, in the research language", opts, async () => {
  const w = new World();
  await w.withTree();
  // the hard threshold at the soft one: no zone between (the old single threshold), as the person may set it
  await w.ok(["config", "set", "web.perHost", String(HARD)]);
  await w.ok(["research", "new", "Předci Jana Nováka", "--new-person", "Jan /Novák/", "--sex", "M", "--born", "ABT 1905"]);
  const s = (await w.ok(["session", "start", "--json"], { env: { CLAUDECODE: "1", STROM_WORKER: "claude-1" } })).json;
  const sid = s.session?.id ?? s.id;
  assert.match(sid, /^N\d{4}$/);
  const inSession = { STROM_SESSION: sid, STROM_MODEL: "opus" };
  pauses.length = 0;
  for (let i = 1; i <= HARD; i++) {
    const r = await hook(w, fetchEvent(w, `https://katalog-example.org/item/${i}`, { use: `u${i}` }), inSession);
    assert.equal(r.out, "", `request ${i}: let go without a word`);
  }
  const rec = journal(w);
  assert.equal(rec.length, HARD);
  const { at, ...first } = rec[0]!;
  assert.match(at, /^\d{4}-/);
  // the same line as the agents' streams write (core/metrics.ts), from the hook, with strom's answer; never the address
  assert.deepEqual(first, { by: sid, via: "web", host: "katalog-example.org", domain: "katalog-example.org", session: sid, key: "claude opus", agent: "claude", tool: "WebFetch", from: "hook", toolUse: "u1", agentSession: "agent-1", decision: "allow", n: 1 });
  assert.equal(rec.at(-1)!.n, HARD);
  assert.ok(rec.slice(1).every((r) => r.paceMs > 0), "each one after the first waited for the host's pace");
  assert.ok(pauses.length >= HARD - 1 && pauses.every((p) => p <= 2000), "strom's 2 s between two requests, like a person");
  const state = readJsonFile(path.join(net(w), "katalog-example.org.json")) as { recent: number[] };
  assert.equal(state.recent.length, HARD, "in the host's shared hour, with strom's own requests");

  // the same call of the agent's again (Grok may run one hook from two files): answered once
  assert.equal((await hook(w, fetchEvent(w, "https://katalog-example.org/item/1", { use: "u1" }), inSession)).out, "");
  assert.equal(journal(w).length, HARD);

  // the 13th, working alone: refused, with what to do instead
  const run = await hook(w, fetchEvent(w, "https://katalog-example.org/item/13", { use: "u13" }), { ...inSession, STROM_NONINTERACTIVE: "1", STROM_WORKER: "run-1-x" });
  assert.equal(run.json!.permissionDecision, "deny");
  assert.match(run.json!.permissionDecisionReason, /12 requests to katalog-example\.org/);
  // the way on for exactly this server: a connector built for it, its brief, a probe, a test, then strom fetch
  const why = run.json!.permissionDecisionReason;
  assert.match(why, /strom connector new katalog-example --url https:\/\/katalog-example\.org\//);
  assert.match(why, /DISCOVERY\.md \(what the site allows: terms, robots\.txt/);
  assert.match(why, /strom connector probe katalog-example <a page of katalog-example\.org>/);
  assert.match(why, /strom connector test katalog-example/);
  assert.match(why, /strom fetch katalog-example/);
  assert.match(why, /Never go round it/);
  assert.deepEqual([journal(w).at(-1)!.decision, journal(w).at(-1)!.why], ["deny", "many"]);
  assert.equal((readJsonFile(path.join(net(w), "katalog-example.org.json")) as { recent: number[] }).recent.length, HARD, "a refused one never counted");

  // in a conversation: the person decides — asked in Czech, impersonally, with the count and the connector
  const talk = await hook(w, fetchEvent(w, "https://katalog-example.org/item/14", { use: "u14" }), inSession);
  assert.equal(talk.json!.permissionDecision, "ask");
  const said = talk.json!.permissionDecisionReason;
  assert.match(said, /12 požadavků na katalog-example\.org v tomto sezení/);
  assert.match(said, /Šetrnější cesta k dalším stránkám nebo položkám tohoto serveru: postavit pro něj hned konektor \(strom connector new katalog-example --url https:\/\/katalog-example\.org\/\), .* Přesto povolit další\?$/);
  assert.doesNotMatch(said, /(?<![\p{L}])(vy|vás|vám|váš|vaš\p{L}*|ty|tvůj|jste|máte|chcete|můžete|\p{L}{2,}(?:ejte|ete|íte|ěte))(?![\p{L}])/iu, "never addresses the person");
  assert.deepEqual([journal(w).at(-1)!.decision, journal(w).at(-1)!.n], ["ask", 13]);
  const hour = () => (readJsonFile(path.join(net(w), "katalog-example.org.json")) as { recent: number[] }).recent.length;
  assert.equal(hour(), HARD, "asked: not in the host's hour before it goes out");
  assert.deepEqual((await w.ok(["net", "web", "--json"], { env: inSession })).json.hosts, { "katalog-example.org": HARD }, "nor in the session's count");

  // the person said no (it never ran; Claude Code may say so after it): nothing counted — and no second question for
  // the host in this session: the next ones refused, with the way on
  assert.equal((await hook(w, afterEvent(w, "https://katalog-example.org/item/14", "u14", "The user doesn't want to proceed with this tool use. The tool use was rejected."), inSession)).out, "");
  assert.deepEqual([journal(w).at(-1)!.toolUse, journal(w).at(-1)!.decision, journal(w).at(-1)!.why], ["u14", "deny", "no"]);
  for (const use of ["u15", "u16"]) {
    const again = await hook(w, fetchEvent(w, `https://katalog-example.org/item/${use.slice(1)}`, { use }), inSession);
    assert.equal(again.json!.permissionDecision, "deny", `${use}: never asked again`);
    assert.match(again.json!.permissionDecisionReason, /^strom: the user said no to more requests to katalog-example\.org .*strom connector new katalog-example --url https:\/\/katalog-example\.org\//);
    assert.deepEqual([journal(w).at(-1)!.decision, journal(w).at(-1)!.why], ["deny", "answered"]);
  }
  assert.equal(hour(), HARD);

  // another server: the person said yes — the call ran, and the hook after it counts it, in the session and the host's
  // hour, no pause; from then on that server goes without a question (counted and paced still)
  for (let i = 1; i <= HARD; i++) assert.equal((await hook(w, fetchEvent(w, `https://matriky-example.org/${i}`, { use: `m${i}` }), inSession)).out, "");
  const mhour = () => (readJsonFile(path.join(net(w), "matriky-example.org.json")) as { recent: number[] }).recent.length;
  assert.equal((await hook(w, fetchEvent(w, "https://matriky-example.org/13", { use: "m13" }), inSession)).json!.permissionDecision, "ask");
  pauses.length = 0;
  const yes = JSON.parse((await hook(w, afterEvent(w, "https://matriky-example.org/13", "m13"), inSession)).out).hookSpecificOutput;
  assert.deepEqual([yes.hookEventName, yes.permissionDecision], ["PostToolUse", undefined], "after a call no decision, only a note");
  assert.match(yes.additionalContext, /^strom: 13 requests to matriky-example\.org through the web fetch tool in this session, past web\.perHost \(12\) on the user's yes\. The rest of this server's pages: Build its connector now, in this session/);
  const went = journal(w).at(-1)!;
  assert.deepEqual([went.from, went.toolUse, went.decision, went.why, went.n, went.paceMs], ["hook", "m13", "allow", "asked", 13, undefined]);
  assert.equal(mhour(), HARD + 1);
  assert.deepEqual(pauses, [], "it is gone already: no pause for the host's pace");
  // told twice (Grok's two files), or after a call that was never asked about: nothing more counted (the note only)
  const lines = journal(w).length;
  for (const ev of [afterEvent(w, "https://matriky-example.org/13", "m13"), afterEvent(w, "https://matriky-example.org/2", "m2"), afterEvent(w, "https://matriky-example.org/3", "m3", "Request failed with status code 404")])
    assert.equal((await hook(w, ev, inSession)).json?.permissionDecision, undefined);
  assert.equal(journal(w).length, lines);
  for (const use of ["m14", "m15"]) {
    assert.equal((await hook(w, fetchEvent(w, `https://matriky-example.org/${use.slice(1)}`, { use }), inSession)).out, "", `${use}: the person's yes stands for the server`);
    const r = journal(w).at(-1)!;
    assert.deepEqual([r.decision, r.why, r.n, r.paceMs > 0], ["allow", "answered", Number(use.slice(1)), true], "counted and paced");
  }
  assert.equal(mhour(), HARD + 3);
  // a yes is no way past a server that stopped: refused hard
  refusedBy(net(w), "matriky-example.org", 403);
  const stopped = await hook(w, fetchEvent(w, "https://matriky-example.org/16", { use: "m16" }), inSession);
  assert.equal(stopped.json!.permissionDecision, "deny");
  assert.match(stopped.json!.permissionDecisionReason, /matriky-example\.org is left alone until/);

  // another server, the same session: its own count; a search: counted only
  assert.equal((await hook(w, fetchEvent(w, "https://jiny-example.net/a", { use: "v1" }), { ...inSession, STROM_NONINTERACTIVE: "1" })).out, "");
  const search = await hook(w, JSON.stringify({ session_id: "agent-1", cwd: w.cwd, tool_name: "WebSearch", tool_input: { query: "Novák Týnec nad Labem" }, tool_use_id: "q1" }), { ...inSession, STROM_NONINTERACTIVE: "1" });
  assert.equal(search.out, "", "a search is never limited");
  const last = journal(w).at(-1)!;
  assert.deepEqual([last.via, last.host, last.session, last.decision], ["search", undefined, sid, "allow"]);
  assert.ok(!("query" in last) && !JSON.stringify(last).includes("Týnec"), "what was searched for stays out of the record");

  // the session's requests by server, for the agent
  const shown = (await w.ok(["net", "web", "--json"], { env: inSession })).json;
  assert.deepEqual(shown.hosts, { "katalog-example.org": 12, "matriky-example.org": 15, "jiny-example.net": 1 }, "the twelve of each, and of the one the person said yes to: three more");
  assert.equal(shown.searches, 1);
  assert.equal(shown.open, true);

  // the session closed, none open: the last one with web requests, said which; or the one named
  await w.ok(["session", "close", "--summary", "Prohledáno.", "--next", "Nic."], { env: inSession });
  const lastOne = (await w.ok(["net", "web", "--json"])).json;
  assert.deepEqual([lastOne.session, lastOne.open, lastOne.hosts, lastOne.searches], [sid, false, { "katalog-example.org": 12, "matriky-example.org": 15, "jiny-example.net": 1 }, 1]);
  assert.match((await w.ok(["net", "web"])).out, new RegExp(`^${sid} \\(closed; no session open — the last one with web requests\\): 28 web request\\(s\\) to 3 server\\(s\\), 1 search\\(es\\)`));
  assert.match((await w.ok(["net", "web", "--session", sid])).out, new RegExp(`^${sid} \\(closed\\): 28 web request`));
  w.cleanup();
});

test("a host whose limit is used up for a year, or left alone after a refusal: the deny names the person's way out, and strom allow host --unblock lets the next call go", opts, async () => {
  const w = new World();
  await w.withTree();
  fs.mkdirSync(net(w), { recursive: true });
  const year = Date.now() + ahead + 365 * 24 * 3600_000;
  fs.writeFileSync(path.join(net(w), "rok-example.org.json"), JSON.stringify({ recent: [], waitUntil: year }));
  refusedBy(net(w), "zavreny2-example.org", 403);
  for (const [host, said] of [["rok-example.org", /says its limit is used up until/], ["zavreny2-example.org", /is left alone until/]] as const) {
    const r = await hook(w, fetchEvent(w, `https://${host}/x`, { sid: "u1" }));
    assert.equal(r.json!.permissionDecision, "deny");
    assert.match(r.json!.permissionDecisionReason, said);
    assert.ok(r.json!.permissionDecisionReason.includes(`the person can lift it: strom allow host ${host} --unblock`), r.json!.permissionDecisionReason);
    // the person's alone
    assert.equal((await w.run(["allow", "host", host, "--unblock"])).code, 4);
    assert.match((await w.ok(["allow", "host", host, "--unblock"], { tty: true, answers: ["y"] })).out, /: už se na něj zase smí – strom se ho bude znovu ptát, pomalu/);
    const state = readJsonFile(path.join(net(w), `${host}.json`)) as { waitUntil?: number; blockedUntil?: number };
    assert.equal(state.waitUntil, undefined);
    assert.equal(state.blockedUntil, undefined);
    assert.equal((await hook(w, fetchEvent(w, `https://${host}/y`, { sid: "u1" }))).out, "", "let go");
  }
});

test("a host left alone (it refused) or its hourly cap full: refused in a conversation and in a run alike, nothing counted", opts, async () => {
  const w = new World();
  await w.withTree();
  fs.mkdirSync(net(w), { recursive: true });
  refusedBy(net(w), "zavreny-example.org", 403);
  for (const env of [{}, { STROM_NONINTERACTIVE: "1" }] as Record<string, string>[]) {
    const r = await hook(w, fetchEvent(w, "https://zavreny-example.org/x"), env);
    assert.equal(r.json!.permissionDecision, "deny");
    assert.match(r.json!.permissionDecisionReason, /zavreny-example\.org is left alone until/);
  }
  // the user's own cap of 2 an hour for a host: the third refused, whoever asks
  setOwnPace(net(w), "pomaly-example.org", { perHour: 2 });
  assert.equal((await hook(w, fetchEvent(w, "https://pomaly-example.org/1", { sid: "a2" }))).out, "");
  assert.equal((await hook(w, fetchEvent(w, "https://pomaly-example.org/2", { sid: "a2" }))).out, "");
  for (const env of [{}, { STROM_NONINTERACTIVE: "1" }] as Record<string, string>[]) {
    const r = await hook(w, fetchEvent(w, "https://pomaly-example.org/3", { sid: "a2" }), env);
    assert.equal(r.json!.permissionDecision, "deny");
    assert.match(r.json!.permissionDecisionReason, /2 requests to pomaly-example\.org in the last hour — its hourly cap/);
  }
  assert.equal((readJsonFile(path.join(net(w), "pomaly-example.org.json")) as { recent: number[] }).recent.length, 2);
  assert.deepEqual(journal(w).filter((r) => r.decision === "deny").map((r) => r.why), ["blocked", "blocked", "cap", "cap"]);
  // a conversation without a strom session: counted by the agent's own id, shown by it (the last one with web requests)
  const shown = (await w.ok(["net", "web", "--json"])).json;
  assert.deepEqual([shown.session, shown.agentSession, shown.open, shown.hosts], [null, "a2", false, { "pomaly-example.org": 2 }]);
  assert.match((await w.ok(["net", "web"])).out, /^the agent's session a2 \(no strom session; the last one with web requests\): 2 web request/);
  assert.deepEqual((await w.ok(["net", "web", "--session", "agent-1", "--json"])).json.hosts, {}, "another one named: its own");
  w.cleanup();
});

test("never in the way by itself: garbage, another tool, no tree, an archive — the call goes on without a word", opts, async () => {
  const w = new World();
  await w.withTree();
  for (const stdin of ["{garbage", "", JSON.stringify({ tool_name: "Bash", tool_input: { command: "ls" } })]) assert.equal((await hook(w, stdin)).out, "");
  // outside any tree
  const outside = await w.run(["net", "web", "--hook"], { stdin: JSON.stringify({ tool_name: "WebFetch", tool_input: { url: "https://example.org/" }, cwd: w.dir }), cwd: w.dir });
  assert.deepEqual([outside.code, outside.out], [0, ""]);
  assert.equal(journal(w).length, 0);
  await w.ok(["init", "Archiv", "--mode", "archive"]);
  const archive = w.treeDir("Archiv");
  const r = await w.run(["net", "web", "--hook"], { stdin: JSON.stringify({ tool_name: "WebFetch", tool_input: { url: "https://example.org/" }, cwd: archive }), cwd: archive });
  assert.deepEqual([r.code, r.out], [0, ""]);
  assert.ok(!fs.existsSync(path.join(archive, ".strom", "metrics", "fetch.jsonl")), "an archive records nothing");
  w.cleanup();
});

test("the brief, the guide and AGENTS.md say it for every agent, with the numbers: up to 12 pages of one server freely, more through its connector built first and strom fetch, past the setting's number the web tool refused — within the brief's budget", opts, async () => {
  const w = new World();
  await w.withTree();
  const said = (n: number) => {
    const soft = Math.min(WEB_SOFT, n);
    assert.equal(webRule(n), `Search the web freely. Over ${soft} pages of one site: build its connector (strom connector new <site> --url https://<host>/), strom fetch the rest; past ${n} the web tool is refused.`);
    const brief = buildBrief(Tree.open(w.cwd, w.env), { budget: 6000 });
    assert.ok(brief.text.includes(webRule(n)), "in the brief's head, never cut");
    // the two rules of the head no longer than they were (129 + 146 characters): the brief's budget
    assert.ok(brief.text.includes(STROM_ONLY));
    assert.ok(STROM_ONLY.length + webRule(n).length <= 275, `the head within its budget (${STROM_ONLY.length + webRule(n).length})`);
  };
  said(WEB_PER_HOST);
  const agents = () => fs.readFileSync(path.join(w.cwd, "AGENTS.md"), "utf8");
  // the words as said, wrapped anywhere
  const rule = (soft: number, hard: number, q: string) =>
    new RegExp(
      `Search the web freely. More than ${soft} pages or items of one site (its domain: its mirrors and other hosts count with it): build its connector — ${q}strom connector new <site> --url https://<host>/${q} (<site>: the domain's name, api.example.org → example; one connector a site), its DISCOVERY.md (terms, robots.txt, an official API or export) — and read the rest through ${q}strom fetch${q} at the server's pace; past ${soft} the web tool goes slower, past ${hard} it is refused. A task "Connector for <domain>" only if no time is left or the server's terms forbid it, saying why — never a task to read the rest later through the web tool.`
        .replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")
        .replace(/ /g, "\\s+"),
    );
  assert.match(agents(), rule(12, 30, "`"));
  assert.match((await w.ok(["guide"])).out, rule(12, 30, ""));
  for (const text of [agents(), (await w.ok(["guide"])).out]) for (const line of text.split("\n")) assert.ok(line.length <= 80 || !line.includes("web tool"), `wrapped: ${line}`);
  // the tree's own number (lowered by anyone): the brief, the guide and the tree's AGENTS.md say it
  await w.ok(["config", "set", "web.perHost", "8", "--for-tree"]);
  said(8);
  assert.match((await w.ok(["guide"])).out, /More than 8 pages or items of one site/);
  assert.match((await w.ok(["guide"])).out, /past\s+8\s+the\s+web\s+tool\s+is\s+refused/);
  syncAgentFiles(Tree.open(w.cwd, w.env));
  assert.match(agents(), /Search the web freely\. More than 8 pages or items of one site/);
  w.cleanup();
});

test("the threshold counts what the agent's stream told too (Grok before its hook ran), each call once", opts, async () => {
  const w = new World();
  await w.withTree();
  // the hard threshold at the soft one: no zone between (the old single threshold), as the person may set it
  await w.ok(["config", "set", "web.perHost", String(HARD)]);
  await w.ok(["research", "new", "Předci Jana Nováka", "--new-person", "Jan /Novák/", "--sex", "M", "--born", "ABT 1905"]);
  const s = (await w.ok(["session", "start", "--json"], { env: { GROK_AGENT: "1", STROM_WORKER: "run-1-y" } })).json;
  const sid: string = s.session?.id ?? s.id;
  // twelve pages of one site Grok's stream told in the session (before the tree's hook was there)
  for (let i = 1; i <= HARD; i++) recordAgentWeb(w.cwd, { via: "web", url: `https://kronika-example.cz/${i}`, session: sid, agent: "grok", key: "grok model-w", tool: "web_fetch", toolUse: `s${i}`, from: "stream" });
  const grokEvent = (use: string) => JSON.stringify({ hookEventName: "pre_tool_use", hook_event_name: "PreToolUse", sessionId: "g-1", cwd: w.cwd, toolName: "web_fetch", toolInput: { url: "https://kronika-example.cz/13" }, toolUseId: use });
  const env = { STROM_SESSION: sid, STROM_NONINTERACTIVE: "1", GROK_AGENT: "1" };
  for (const use of ["h1", "h2"]) {
    const r = await hook(w, grokEvent(use), env);
    assert.equal(r.json?.permissionDecision, "deny", `${use}: the stream's twelve count, also once the hook has a line of the session`);
    assert.match(r.json!.permissionDecisionReason, /12 requests to kronika-example\.cz/);
  }
  const last = journal(w).at(-1)!;
  assert.deepEqual([last.from, last.agent, last.tool, last.decision, last.n], ["hook", "grok", "web_fetch", "deny", 12]);
  // countedWeb: the stream's line of a call the hook recorded is the same request
  const lines = [
    { via: "web", host: "a.example", session: "N1", agent: "grok", from: "hook", toolUse: "c1", decision: "allow" },
    { via: "web", host: "a.example", session: "N1", agent: "grok", from: "stream", toolUse: "c1" },
    { via: "web", host: "a.example", session: "N1", agent: "grok", from: "stream", toolUse: "other-id" },
    { via: "web", host: "a.example", session: "N2", agent: "grok", from: "stream", toolUse: "c9" },
    { via: "direct", connector: "x" },
  ];
  assert.deepEqual(countedWeb(lines).map((l) => `${l.session} ${l.from} ${l.toolUse}`), ["N1 hook c1", "N2 stream c9"]);
  w.cleanup();
});

test("web.perHost: the threshold is a setting (default 30, the user's and the tree's, shown in strom config); raised by the person alone, lowered by anyone; the hook goes by it", { ...opts, skip: opts.skip || process.platform === "win32" }, async () => {
  const w = new World();
  await w.withTree();
  const perHost = async () => (await w.ok(["config", "get", "web.perHost", "--json"])).json.value;
  assert.match((await w.ok(["config", "where"])).out, /web\.perHost\s+30/);
  // an agent: higher than the default — refused, the command for the person said; nor for the tree
  w.env.CLAUDECODE = "1";
  const refused = await w.run(["config", "set", "web.perHost", "40"]);
  assert.equal(refused.code, 4, refused.out + refused.err);
  assert.match(refused.out + refused.err, /strom config set web\.perHost 40/);
  assert.equal((await w.run(["config", "set", "web.perHost", "35", "--for-tree"])).code, 4);
  // lowering: anyone's — and the hook goes by it
  await w.ok(["config", "set", "web.perHost", "2", "--for-tree"]);
  assert.equal(await perHost(), 2);
  for (const i of [1, 2]) assert.equal((await hook(w, fetchEvent(w, `https://obec-example.org/${i}`, { sid: "c3", use: `p${i}` }), { STROM_NONINTERACTIVE: "1" })).out, "");
  const third = await hook(w, fetchEvent(w, "https://obec-example.org/3", { sid: "c3", use: "p3" }), { STROM_NONINTERACTIVE: "1" });
  assert.equal(third.json!.permissionDecision, "deny");
  assert.match(third.json!.permissionDecisionReason, /2 requests to obec-example\.org/);
  assert.equal((await w.ok(["net", "web", "--json"])).json.perHost, 2);
  // taking the tree's lower value away lets the default hold again: higher, the person's
  assert.equal((await w.run(["config", "unset", "web.perHost", "--for-tree"])).code, 4);
  delete w.env.CLAUDECODE;
  // the person at the terminal: as any setting
  await w.ok(["config", "set", "web.perHost", "40"], { tty: true });
  await w.ok(["config", "unset", "web.perHost", "--for-tree"], { tty: true });
  assert.equal(await perHost(), 40);
  // no variable raises it
  w.env.STROM_WEB_PERHOST = "99";
  assert.equal(await perHost(), 40);
  delete w.env.STROM_WEB_PERHOST;
  w.cleanup();
});

/** A command line as a shell splits it: words, "double-quoted" ones whole. */
const words = (line: string) => [...line.matchAll(/"([^"]*)"|(\S+)/g)].map((m) => m[1] ?? m[2]!);

test("past the threshold the way on is for exactly that server: its connector when there is one; too little time left, a task for one (a command that adds it), never round the limit", opts, async () => {
  const w = new World();
  await w.withTree();
  // the hard threshold at the soft one: no zone between (the old single threshold), as the person may set it
  await w.ok(["config", "set", "web.perHost", String(HARD)]);
  await w.ok(["research", "new", "Předci Jana Nováka", "--new-person", "Jan /Novák/", "--sex", "M", "--born", "ABT 1905"]);
  await w.ok(["task", "add", "Křest Jana Nováka", "--level", "locate", "--where", "farní kronika", "--why", "rodiče", "--done-when", "zápis nalezen", "--about", "P0001"]);
  const s = (await w.ok(["session", "start", "T0001", "--json"], { env: { CLAUDECODE: "1", STROM_WORKER: "run-1-z" } })).json;
  const sid: string = s.session?.id ?? s.id;
  const sessionLines = (host: string) => {
    for (let i = 1; i <= HARD; i++) recordAgentWeb(w.cwd, { via: "web", url: `https://${host}/${i}`, session: sid, agent: "claude", key: "claude opus", tool: "WebFetch", toolUse: `${host}-${i}`, from: "hook", decision: "allow" });
  };
  const run = { STROM_SESSION: sid, STROM_NONINTERACTIVE: "1", STROM_WORKER: "run-1-z" };

  // a connector of the plugins folder for the host: go on through it — in a run and in the person's question alike
  await w.ok(["connector", "new", "farni-kronika", "--url", "https://kronika-example.cz/"], { env: run });
  sessionLines("kronika-example.cz");
  const have = await hook(w, fetchEvent(w, "https://kronika-example.cz/13", { use: "k13" }), run);
  assert.equal(have.json!.permissionDecision, "deny");
  assert.match(have.json!.permissionDecisionReason, /Its connector is here: go on through it — strom connector show farni-kronika, then strom fetch farni-kronika/);
  assert.doesNotMatch(have.json!.permissionDecisionReason, /connector new/);
  const asked = await hook(w, fetchEvent(w, "https://kronika-example.cz/14", { use: "k14" }), { STROM_SESSION: sid });
  assert.match(asked.json!.permissionDecisionReason, /přes jeho konektor farni-kronika, který tu už je/);

  // its connector serves the whole site: a mirror or an API host of it goes straight to strom fetch with it
  sessionLines("api.kronika-example.cz");
  const mirror = await hook(w, fetchEvent(w, "https://api.kronika-example.cz/13", { use: "a13" }), run);
  assert.match(mirror.json!.permissionDecisionReason, /Its connector is here: go on through it — strom connector show farni-kronika, then strom fetch farni-kronika/);

  // ten minutes left of the run's session: time enough — the connector built now, the main way; its task only the fallback
  sessionLines("obec-example.org");
  const ten = { ...run, STROM_DEADLINE: new Date(Date.now() + 10 * 60_000).toISOString(), STROM_MINUTES: "60" };
  const main = (await hook(w, fetchEvent(w, "https://obec-example.org/13", { use: "o13" }), ten)).json!.permissionDecisionReason;
  assert.match(main, /^strom: 12 requests to obec-example\.org through the web fetch tool in this session — the limit for one site \(web\.perHost\)\. Build its connector now, in this session — the gentle way, and the one to take, within the task's budget; tell the user in a sentence \(working alone: in your note\): strom connector new obec-example --url https:\/\/obec-example\.org\/, then its DISCOVERY\.md/);
  assert.match(main, /then strom fetch obec-example … for the rest, at the server's pace\. Only if no time is left for it, or the server's terms or robots\.txt forbid automated access: add its task — strom task add "Connector for obec-example\.org" .* — and say why in your note\. Never end the task or do without these pages because of this limit\./);
  assert.ok(main.indexOf("strom connector new") < main.indexOf("strom task add"), "the connector first, the task after it");
  // under CONNECTOR_MIN_MS left: the connector still named first, its task what to do now
  const five = { ...run, STROM_DEADLINE: new Date(Date.now() + 5 * 60_000).toISOString(), STROM_MINUTES: "60" };
  const why = (await hook(w, fetchEvent(w, "https://obec-example.org/14", { use: "o14" }), five)).json!.permissionDecisionReason;
  assert.match(why, /The way for this server is its connector \(strom connector new obec-example --url https:\/\/obec-example\.org\/, then its DISCOVERY\.md .*\), but this session is ending \(too little time left, or asked to finish\) — too soon to build it: add its task now — strom task add "Connector for obec-example\.org"/);
  assert.match(why, /say so in your note, and close with what was found\. Never end the task or do without these pages because of this limit\./);
  assert.match(why, /Never go round it/);
  assert.ok(why.indexOf("strom connector new") < why.indexOf("strom task add"));
  // the command it gives adds the task as it says
  const cmd = why.match(/— (strom task add .*?) — say so/)![1]!;
  const added = (await w.ok([...words(cmd).slice(1), "--json"], { env: run })).json;
  const task = (await w.ok(["task", "show", added.task?.id ?? added.id, "--json"])).json.task ?? (await w.ok(["task", "show", added.task?.id ?? added.id, "--json"])).json;
  assert.equal(task.what, "Connector for obec-example.org");
  assert.deepEqual([task.level, task.subject, task.where], ["locate", ["P0001"], ["https://obec-example.org/"]]);
  assert.match(task.why, /T0001: Křest Jana Nováka/);
  // the session asked to finish, time or not: the same
  askFinish(w.cwd, sid, "user");
  assert.match((await hook(w, fetchEvent(w, "https://obec-example.org/15", { use: "o15" }), run)).json!.permissionDecisionReason, /but this session is ending .* add its task now/);
  fs.rmSync(finishFile(w.cwd, sid));
  // with no deadline: built now
  const now = await hook(w, fetchEvent(w, "https://obec-example.org/16", { use: "o16" }), run);
  assert.match(now.json!.permissionDecisionReason, /Build its connector now, in this session .*strom connector new obec-example --url https:\/\/obec-example\.org\//);
  w.cleanup();
});

test("a slot of the host's pace later than the hook waits, or the host's lock not had (a strom fetch at it): refused in a run (one request at a time); in a conversation below the threshold never asked — let go at the end of its wait, counted; waiting for its turn is no error", opts, async () => {
  const w = new World();
  await w.withTree();
  await w.ok(["research", "new", "Předci Jana Nováka", "--new-person", "Jan /Novák/", "--sex", "M", "--born", "ABT 1905"]);
  const s = (await w.ok(["session", "start", "--json"], { env: { CLAUDECODE: "1", STROM_WORKER: "claude-1" } })).json;
  const sid: string = s.session?.id ?? s.id;
  const inSession = { STROM_SESSION: sid, STROM_MODEL: "opus" };
  const alone = { ...inSession, STROM_NONINTERACTIVE: "1", STROM_WORKER: "run-1-x" };
  const host = "pomaly-example.org";
  // the person's pace for the host: 4 s; the hooks come all at once (their pauses not waited out: the clock stands)
  setOwnPace(net(w), host, { minIntervalMs: 4000 });
  const before = testHooks.sleep;
  testHooks.sleep = async (ms) => void pauses.push(ms);
  pauses.length = 0;
  try {
    // slots 0, 4 … 28 s: each reserved, one pace after the other
    for (let i = 1; i <= 8; i++) assert.equal((await hook(w, fetchEvent(w, `https://${host}/${i}`, { use: `p${i}` }), alone)).out, "", `request ${i}`);
    const waits = journal(w).map((r) => r.paceMs ?? 0);
    assert.ok(waits.every((ms, i) => Math.abs(ms - i * 4000) < 500), `each its own slot of the pace: ${waits.join(", ")}`);
    // the ninth: 32 s ahead, longer than the hook waits — working alone refused, one request at a time, with the way on
    const late = await hook(w, fetchEvent(w, `https://${host}/9`, { use: "p9" }), alone);
    assert.equal(late.json!.permissionDecision, "deny");
    assert.match(late.json!.permissionDecisionReason, /^strom: one request at a time to pomaly-example\.org, a person's pace — its next free moment is 32 s away/);
    assert.match(late.json!.permissionDecisionReason, /never many at once \(this one again in a moment\); more pages of this server: Build its connector now, in this session .*strom connector new pomaly-example --url https:\/\/pomaly-example\.org\//);
    assert.deepEqual([journal(w).at(-1)!.decision, journal(w).at(-1)!.why, journal(w).at(-1)!.n], ["deny", "pace", 8]);
    const hour = () => (readJsonFile(path.join(net(w), `${host}.json`)) as { recent: number[] }).recent.length;
    assert.equal(hour(), 8, "the refused one not reserved");
    // in a conversation below the threshold: nobody asked — it waits what the hook can wait and goes, counted in the
    // session and the host's hour (its pace not kept: no slot of it taken from the others)
    pauses.length = 0;
    const talk = await hook(w, fetchEvent(w, `https://${host}/10`, { use: "p10" }), inSession);
    assert.equal(talk.out, "", "let go, nothing asked");
    assert.deepEqual([journal(w).at(-1)!.decision, journal(w).at(-1)!.why, journal(w).at(-1)!.n, hour()], ["allow", "pace", 9, 9]);
    assert.ok(pauses.length === 1 && pauses[0]! > WEB_WAIT_MAX_MS - 2000 && pauses[0]! <= WEB_WAIT_MAX_MS, `it waited what the hook can wait: ${pauses.join(", ")}`);
    assert.ok(!journal(w).some((r) => r.decision === "ask"), "no question for the pace");
    // the host's lock held by another strom (its own request under way) past the hook's wait: not let through uncounted
    testHooks.lockWaitMs = 150;
    const lock = path.join(net(w), "lockt-example.org.json.lock");
    fs.mkdirSync(path.dirname(lock), { recursive: true });
    fs.writeFileSync(lock, JSON.stringify({ pid: process.pid, host: os.hostname(), at: new Date().toISOString(), owner: "strom net" }));
    const busy = await hook(w, fetchEvent(w, "https://lockt-example.org/1", { use: "b1" }), alone);
    assert.equal(busy.json!.permissionDecision, "deny", "working alone: refused");
    assert.match(busy.json!.permissionDecisionReason, /^strom: one request at a time to lockt-example\.org, a person's pace — another request to it is under way \(strom's own, a strom fetch, or another call of yours\) and its turn did not come within 30 s\. .*\(this one again in a moment\)/);
    assert.deepEqual([journal(w).at(-1)!.toolUse, journal(w).at(-1)!.decision, journal(w).at(-1)!.why], ["b1", "deny", "busy"]);
    // in a conversation: never asked — let go, counted in the session even while the lock is still held
    const talking = await hook(w, fetchEvent(w, "https://lockt-example.org/2", { use: "b2" }), inSession);
    assert.equal(talking.out, "", "in a conversation: let go, nothing asked");
    assert.deepEqual([journal(w).at(-1)!.toolUse, journal(w).at(-1)!.decision, journal(w).at(-1)!.why, journal(w).at(-1)!.n], ["b2", "allow", "busy", 1]);
    assert.equal((await hook(w, afterEvent(w, "https://lockt-example.org/2", "b2"), inSession)).out, "", "after it: nothing more counted");
    assert.equal((await w.ok(["net", "web", "--json"], { env: inSession })).json.hosts["lockt-example.org"], 1);
    assert.ok(!journal(w).some((r) => r.decision === "ask"), "no question for another request under way");
    fs.rmSync(lock);
  } finally {
    testHooks.sleep = before;
    testHooks.lockWaitMs = undefined;
  }
  w.cleanup();
});

test("near the threshold the agent hears it after each call: from the threshold − 2nd request to a server on, how many are used and the way on — the refusal's own lines, Claude Code's and Grok's note", opts, async () => {
  const w = new World();
  await w.withTree();
  // the hard threshold at the soft one: no zone between (the old single threshold), as the person may set it
  await w.ok(["config", "set", "web.perHost", String(HARD)]);
  await w.ok(["research", "new", "Předci Jana Nováka", "--new-person", "Jan /Novák/", "--sex", "M", "--born", "ABT 1905"]);
  const s = (await w.ok(["session", "start", "--json"], { env: { CLAUDECODE: "1", STROM_WORKER: "claude-1" } })).json;
  const sid: string = s.session?.id ?? s.id;
  const env = { STROM_SESSION: sid, STROM_MODEL: "opus", STROM_NONINTERACTIVE: "1", STROM_WORKER: "run-1-x" };
  const notes: (string | undefined)[] = [];
  for (let i = 1; i <= HARD; i++) {
    assert.equal((await hook(w, fetchEvent(w, `https://soupis-example.org/${i}`, { use: `n${i}` }), env)).out, "", `before ${i}: let go`);
    const after = await hook(w, afterEvent(w, `https://soupis-example.org/${i}`, `n${i}`), env);
    notes.push(after.out ? (JSON.parse(after.out) as { hookSpecificOutput: { hookEventName: string; additionalContext: string } }).hookSpecificOutput.additionalContext : undefined);
  }
  assert.deepEqual(notes.map((n) => !!n), [...Array(HARD - 3).fill(false), true, true, true], "from the tenth of twelve on");
  assert.match(notes[9]!, /^strom: 10 of the 12 requests to soupis-example\.org the web fetch tool takes in this session \(web\.perHost\) used\. The rest of this server's pages: Build its connector now, in this session — the gentle way, and the one to take, within the task's budget; tell the user in a sentence \(working alone: in your note\): strom connector new soupis-example --url https:\/\/soupis-example\.org\/, then its DISCOVERY\.md/);
  assert.match(notes[11]!, /^strom: 12 of the 12 .* used — the next one is refused working alone, and asked of the user once in a conversation\. /);
  assert.match(notes[11]!, /Never go round it/);
  // the same lines as the refusal that comes next
  const refusal = (await hook(w, fetchEvent(w, "https://soupis-example.org/13", { use: "n13" }), env)).json!.permissionDecisionReason;
  assert.ok(refusal.endsWith(notes[11]!.slice(notes[11]!.indexOf("Build its connector"))), "the refusal's way on, word for word");
  // too little time left in the session: the task's line
  const late = { ...env, STROM_DEADLINE: new Date(Date.now() + 5 * 60_000).toISOString() };
  assert.equal((await hook(w, fetchEvent(w, "https://ukazka-example.org/1", { use: "g0" }), late)).out, "");
  await w.ok(["config", "set", "web.perHost", "1", "--for-tree"]);
  const soon = JSON.parse((await hook(w, afterEvent(w, "https://ukazka-example.org/1", "g0"), late)).out).hookSpecificOutput.additionalContext as string;
  assert.match(soon, /^strom: 1 of the 1 requests to ukazka-example\.org .*The way for this server is its connector \(strom connector new ukazka-example .*too soon to build it: add its task now — strom task add "Connector for ukazka-example\.org"/);
  await w.ok(["config", "unset", "web.perHost", "--for-tree"], { tty: true });
  // Grok's events (its own names): the same note, in the shape it reads — and after a call that failed on its way
  const grok = (use: string, phase: string, extra: Record<string, unknown> = {}) =>
    JSON.stringify({ hookEventName: phase, sessionId: "g-1", cwd: w.cwd, toolName: "web_fetch", toolInput: { url: `https://soupis-example.org/${use}` }, toolUseId: use, ...extra });
  const genv = { ...env, GROK_AGENT: "1" };
  await w.ok(["config", "set", "web.perHost", "2", "--for-tree"]);
  for (const use of ["k1", "k2"]) assert.equal((await hook(w, grok(use, "pre_tool_use"), { ...genv, STROM_SESSION: "" })).out, "", `${use}: Grok's call let go`);
  const g = JSON.parse((await hook(w, grok("k2", "post_tool_use_failure", { error: "HTTP 404" }), { ...genv, STROM_SESSION: "" })).out).hookSpecificOutput;
  assert.equal(g.hookEventName, "PostToolUseFailure");
  assert.match(g.additionalContext, /^strom: 2 of the 2 requests to soupis-example\.org/);
  // a call that never ran (the hook refused it): no note
  assert.equal((await hook(w, afterEvent(w, "https://soupis-example.org/13", "n13", "Hook denied: strom"), env)).out, "");
  w.cleanup();
});

test("the site a host is counted under: its registrable domain — the last two labels, three under a country's second level; an IP address, localhost, a port, punycode", () => {
  for (const [host, site] of [
    ["dn711203.ca.archive.org", "archive.org"],
    ["ia801408.us.archive.org", "archive.org"],
    ["api.kramerius.mzk.cz", "mzk.cz"],
    ["archive.org", "archive.org"],
    ["Records.NationalArchives.GOV.UK", "nationalarchives.gov.uk"],
    ["www.example.co.uk", "example.co.uk"],
    ["trove.nla.gov.au", "nla.gov.au"],
    ["a.b.example.com.br", "example.com.br"],
    ["matriky.xn--pklad-zsa96e.cz:8080", "xn--pklad-zsa96e.cz"],
    ["example.org.", "example.org"],
    ["127.0.0.1", "127.0.0.1"],
    ["192.168.1.20:8080", "192.168.1.20"],
    ["[::1]:8080", "[::1]"],
    ["localhost", "localhost"],
    ["localhost:3000", "localhost"],
  ] as const)
    assert.equal(webDomain(host), site, host);
});

test("past the soft threshold of a site (its mirrors counted together): never refused for the number, one request per WEB_SOFT_GAP_MS to the whole site, the connector advised once with its exact line; past web.perHost refused in a run, the site named, the connector the way on", opts, async () => {
  const w = new World();
  await w.withTree();
  await w.ok(["research", "new", "Předci Jana Nováka", "--new-person", "Jan /Novák/", "--sex", "M", "--born", "ABT 1905"]);
  const s = (await w.ok(["session", "start", "--json"], { env: { CLAUDECODE: "1", STROM_WORKER: "run-1-x" } })).json;
  const sid: string = s.session?.id ?? s.id;
  const run = { STROM_SESSION: sid, STROM_MODEL: "opus", STROM_NONINTERACTIVE: "1", STROM_WORKER: "run-1-x" };
  // the site's mirrors in turn: every request counted under the site
  const mirror = (i: number) => (i % 2 ? "ia801408.us.archiv-example.org" : "dn711203.ca.archiv-example.org");
  const notes: (string | undefined)[] = [];
  pauses.length = 0;
  for (let i = 1; i <= WEB_PER_HOST; i++) {
    const before = await hook(w, fetchEvent(w, `https://${mirror(i)}/details/${i}`, { use: `a${i}` }), run);
    assert.equal(before.out, "", `${i}: let go — never refused below web.perHost`);
    const after = await hook(w, afterEvent(w, `https://${mirror(i)}/details/${i}`, `a${i}`), run);
    notes.push(after.out ? (JSON.parse(after.out) as { hookSpecificOutput: { additionalContext: string } }).hookSpecificOutput.additionalContext : undefined);
  }
  const rec = journal(w).filter((r) => r.decision === "allow");
  assert.deepEqual(rec.map((r) => r.n), Array.from({ length: WEB_PER_HOST }, (_, i) => i + 1), "counted under the site, one by one");
  assert.ok(rec.every((r, i) => r.host === mirror(i + 1) && r.domain === "archiv-example.org"), "the exact host and the site");
  assert.deepEqual(rec.map((r) => r.why ?? ""), [...Array(WEB_SOFT).fill(""), ...Array(WEB_PER_HOST - WEB_SOFT).fill("soft")]);
  assert.deepEqual(rec.map((r) => !!r.advice), [...Array(WEB_SOFT).fill(false), true, ...Array(WEB_PER_HOST - WEB_SOFT - 1).fill(false)], "the first past the soft threshold carries the advice");
  // the pace: up to the soft threshold each host's own (two mirrors: barely any wait), then one per 6 s to the site
  const soft = rec.slice(WEB_SOFT + 1).map((r) => r.paceMs ?? 0);
  assert.ok(soft.every((ms) => ms > WEB_SOFT_GAP_MS - 1000 && ms <= WEB_SOFT_GAP_MS), `one per ${WEB_SOFT_GAP_MS} ms to the site: ${soft.join(", ")}`);
  assert.ok(rec.slice(0, WEB_SOFT).every((r) => (r.paceMs ?? 0) <= 2000), "below the soft threshold: the host's pace alone");
  // the notes: the advice once (after the 13th), then the count from the hard threshold − 2nd
  assert.deepEqual(notes.map((n, i) => (n ? i + 1 : 0)).filter(Boolean), [WEB_SOFT + 1, WEB_PER_HOST - 2, WEB_PER_HOST - 1, WEB_PER_HOST]);
  const advice = notes[WEB_SOFT]!;
  assert.match(advice, /^strom: 12 pages of archiv-example\.org \(ia801408\.us\.archiv-example\.org and its other hosts and mirrors counted together\) through the web fetch tool in this session — from now one request per 6 s to it, and past 30 the web fetch tool is refused \(web\.perHost\)\. For the rest of its pages: Build its connector now, in this session — the gentle way, and the one to take, within the task's budget; tell the user in a sentence \(working alone: in your note\): strom connector new archiv-example --url https:\/\/ia801408\.us\.archiv-example\.org\/, then its DISCOVERY\.md/);
  assert.match(advice, /then strom fetch archiv-example … for the rest, at the server's pace\. Only if no time is left for it, or the server's terms or robots\.txt forbid automated access: add its task — strom task add "Connector for archiv-example\.org" --level locate --where "https:\/\/ia801408\.us\.archiv-example\.org\/"/);
  assert.match(notes[WEB_PER_HOST - 1]!, /^strom: 30 of the 30 requests to archiv-example\.org \(.*counted together\) the web fetch tool takes in this session \(web\.perHost\) used — the next one is refused working alone/);
  // past web.perHost: refused in a run, the site named, the connector the main way
  const refused = (await hook(w, fetchEvent(w, `https://${mirror(31)}/details/31`, { use: "a31" }), run)).json!;
  assert.equal(refused.permissionDecision, "deny");
  assert.match(refused.permissionDecisionReason, /^strom: 30 requests to archiv-example\.org \(ia801408\.us\.archiv-example\.org and its other hosts and mirrors counted together\) through the web fetch tool in this session — the limit for one site \(web\.perHost\)\. Build its connector now, in this session .*strom connector new archiv-example --url https:\/\/ia801408\.us\.archiv-example\.org\//);
  assert.deepEqual([journal(w).at(-1)!.why, journal(w).at(-1)!.n], ["many", WEB_PER_HOST]);
  // another site: its own count; a search: never limited
  assert.equal((await hook(w, fetchEvent(w, "https://jiny-example.net/a", { use: "j1" }), run)).out, "");
  assert.equal((await hook(w, JSON.stringify({ session_id: "agent-1", cwd: w.cwd, tool_name: "WebSearch", tool_input: { query: "Novák" }, tool_use_id: "q1" }), run)).out, "");
  // the session's requests by site, its hosts beside it
  const shown = await w.ok(["net", "web", "--json"], { env: run });
  assert.deepEqual(shown.json.domains, { "archiv-example.org": WEB_PER_HOST, "jiny-example.net": 1 });
  assert.deepEqual([shown.json.soft, shown.json.perHost], [WEB_SOFT, WEB_PER_HOST]);
  assert.match((await w.ok(["net", "web"], { env: run })).out, /\n {2}archiv-example\.org {2}30 {2}\(ia801408\.us\.archiv-example\.org 15, dn711203\.ca\.archiv-example\.org 15\) {2}— past 30: the next one refused/);
  // a connector of the plugins folder for another host of the site: the refusal goes straight to strom fetch with it
  await w.ok(["connector", "new", "archiv", "--url", "https://archiv-example.org/"], { env: run });
  const have = (await hook(w, fetchEvent(w, `https://${mirror(32)}/details/32`, { use: "a32" }), run)).json!.permissionDecisionReason;
  assert.match(have, /Its connector is here: go on through it — strom connector show archiv, then strom fetch archiv/);
  assert.doesNotMatch(have, /connector new/);
  // one connector a site: another started for a host of it says the one that is here, whatever its name
  const again = await w.ok(["connector", "new", "archiv-example", "--url", `https://${mirror(1)}/`, "--json"], { env: run });
  assert.deepEqual(again.json.site, { domain: "archiv-example.org", connector: "archiv" });
  assert.match((await w.ok(["connector", "new", "archiv-zrcadlo", "--url", `https://${mirror(2)}/`], { env: run })).out, /note: the connector archiv(-example)? is here already for archiv-example\.org .*more pages of that site go through it/);
  w.cleanup();
});

test("in a conversation nothing is asked below web.perHost — many at once past the soft threshold refused as one request at a time; past it the person asked once per site: a yes stands for the whole site, still paced, a no too", opts, async () => {
  const w = new World();
  await w.withTree();
  await w.ok(["research", "new", "Předci Jana Nováka", "--new-person", "Jan /Novák/", "--sex", "M", "--born", "ABT 1905"]);
  const s = (await w.ok(["session", "start", "--json"], { env: { CLAUDECODE: "1", STROM_WORKER: "claude-1" } })).json;
  const sid: string = s.session?.id ?? s.id;
  const talk = { STROM_SESSION: sid, STROM_MODEL: "opus" };
  const before = testHooks.sleep;
  try {
    // the soft threshold reached through one mirror
    for (let i = 1; i <= WEB_SOFT; i++) assert.equal((await hook(w, fetchEvent(w, `https://a.knihovna-example.cz/${i}`, { use: `k${i}` }), talk)).out, "");
    // all at once (their pauses not waited out: the clock stands): the slots 6 … 30 s ahead go, the next is too far —
    // refused as one request at a time, never asked, and not for the number
    testHooks.sleep = async (ms) => void pauses.push(ms);
    const fit = Math.floor(WEB_WAIT_MAX_MS / WEB_SOFT_GAP_MS);
    for (let i = 1; i <= fit; i++) assert.equal((await hook(w, fetchEvent(w, `https://b.knihovna-example.cz/${i}`, { use: `b${i}` }), talk)).out, "", `soft ${i}: let go`);
    const many = (await hook(w, fetchEvent(w, "https://b.knihovna-example.cz/x", { use: "bx" }), talk)).json!;
    assert.equal(many.permissionDecision, "deny", "never asked below web.perHost");
    assert.match(many.permissionDecisionReason, /^strom: one request at a time to b\.knihovna-example\.cz, past 12 pages of knihovna-example\.cz \(b\.knihovna-example\.cz and its other hosts and mirrors counted together\) in this session, one request per 6 s to it — its next free moment is \d+ s away, longer than the web fetch tool waits\. Fetch its pages one after another, never many at once \(this one again in a moment\); more pages of this server: Build its connector now/);
    assert.deepEqual([journal(w).at(-1)!.decision, journal(w).at(-1)!.why], ["deny", "pace"]);
  } finally {
    testHooks.sleep = before;
  }
  // the agent waits a moment (the slots reserved go out meanwhile)
  ahead += WEB_WAIT_MAX_MS;
  // one after another: up to web.perHost, nothing asked
  const count = () => (journal(w).filter((r) => r.decision === "allow").length);
  for (let i = count() + 1; i <= WEB_PER_HOST; i++) assert.equal((await hook(w, fetchEvent(w, `https://c.knihovna-example.cz/${i}`, { use: `c${i}` }), talk)).out, "", `${i}: let go`);
  assert.equal(count(), WEB_PER_HOST);
  assert.ok(!journal(w).some((r) => r.decision === "ask"), "nothing asked so far");
  // past it: asked once for the site, in the research language, impersonally — the site named, the connector the gentle way
  const ask = (await hook(w, fetchEvent(w, "https://d.knihovna-example.cz/31", { use: "d31" }), talk)).json!;
  assert.equal(ask.permissionDecision, "ask");
  assert.match(ask.permissionDecisionReason, /^Už 30 požadavků na knihovna-example\.cz v tomto sezení\. Šetrnější cesta k dalším stránkám nebo položkám tohoto serveru: postavit pro něj hned konektor \(strom connector new knihovna-example --url https:\/\/d\.knihovna-example\.cz\/\)/);
  // another mirror while it waits: refused, no second question
  assert.match((await hook(w, fetchEvent(w, "https://e.knihovna-example.cz/32", { use: "e32" }), talk)).json!.permissionDecisionReason, /^strom: the user is being asked about requests to knihovna-example\.cz /);
  // the yes: it went out — and another mirror of the site goes on without a question, counted and at the site's pace
  assert.equal((await hook(w, afterEvent(w, "https://d.knihovna-example.cz/31", "d31"), talk)).out.includes("PostToolUse"), true);
  assert.equal((await hook(w, fetchEvent(w, "https://e.knihovna-example.cz/33", { use: "e33" }), talk)).out, "", "the yes stands for the site");
  const r = journal(w).at(-1)!;
  assert.deepEqual([r.decision, r.why, r.n, r.domain, r.paceMs > WEB_SOFT_GAP_MS - 1000], ["allow", "answered", WEB_PER_HOST + 2, "knihovna-example.cz", true]);
  // another site, the person's no: refused on, never asked again, on every host of it
  for (let i = 1; i <= WEB_PER_HOST; i++) recordAgentWeb(w.cwd, { via: "web", url: `https://www.matrika-example.cz/${i}`, session: sid, agent: "claude", key: "claude opus", tool: "WebFetch", toolUse: `m${i}`, from: "hook", decision: "allow" });
  assert.equal((await hook(w, fetchEvent(w, "https://www.matrika-example.cz/31", { use: "m31" }), talk)).json!.permissionDecision, "ask");
  await hook(w, afterEvent(w, "https://www.matrika-example.cz/31", "m31", "The user doesn't want to proceed with this tool use."), talk);
  const no = (await hook(w, fetchEvent(w, "https://data.matrika-example.cz/32", { use: "m32" }), talk)).json!;
  assert.equal(no.permissionDecision, "deny");
  assert.match(no.permissionDecisionReason, /^strom: the user said no to more requests to matrika-example\.cz \(data\.matrika-example\.cz and its other hosts and mirrors counted together\)/);
  w.cleanup();
});

test("only the threshold's own question passes web.perHost: a yes or a no an older strom got to a question of the pace (or another request under way) never stands for the site", opts, async () => {
  const w = new World();
  await w.withTree();
  await w.ok(["config", "set", "web.perHost", "14"]);
  await w.ok(["research", "new", "Předci Jana Nováka", "--new-person", "Jan /Novák/", "--sex", "M", "--born", "ABT 1905"]);
  const s = (await w.ok(["session", "start", "--json"], { env: { CLAUDECODE: "1", STROM_WORKER: "claude-1" } })).json;
  const sid: string = s.session?.id ?? s.id;
  const talk = { STROM_SESSION: sid, STROM_MODEL: "opus" };
  const line = (site: string, i: number, extra: Record<string, unknown>) =>
    recordAgentWeb(w.cwd, { via: "web", url: `https://www.${site}/${i}`, session: sid, agent: "claude", key: "claude opus", tool: "WebFetch", toolUse: `${site}-${i}`, from: "hook", ...extra });
  for (const site of ["tempo-example.org", "zapor-example.org"]) {
    for (let i = 1; i <= 13; i++) line(site, i, { decision: "allow", n: i });
    // the 14th: an older strom asked about the pace, and the person answered
    line(site, 14, { decision: "ask", why: "pace", n: 14 });
  }
  line("tempo-example.org", 14, { decision: "allow", why: "asked", n: 14 });
  // (the other site: its 14th went out on another way, then a question of the pace for the 15th got a no)
  line("zapor-example.org", 140, { decision: "allow", n: 14 });
  line("zapor-example.org", 15, { decision: "ask", why: "busy", n: 15 });
  line("zapor-example.org", 15, { decision: "deny", why: "no", n: 14 });
  // the 15th of the site that got a yes: the threshold's own question — that yes was not for it
  const yes = (await hook(w, fetchEvent(w, "https://www.tempo-example.org/15", { sid, use: "t15" }), talk)).json!;
  assert.equal(yes.permissionDecision, "ask", "a yes to the pace never passes the threshold");
  assert.match(yes.permissionDecisionReason, /^Už 14 požadavků na tempo-example\.org v tomto sezení\./);
  assert.deepEqual([journal(w).at(-1)!.decision, journal(w).at(-1)!.why], ["ask", "many"]);
  // the threshold's yes: it went out — from then on the site goes on that yes
  await hook(w, afterEvent(w, "https://www.tempo-example.org/15", "t15"), talk);
  assert.equal((await hook(w, fetchEvent(w, "https://www.tempo-example.org/16", { sid, use: "t16" }), talk)).out, "", "the threshold's own yes stands for the site");
  assert.deepEqual([journal(w).at(-1)!.decision, journal(w).at(-1)!.why], ["allow", "answered"]);
  // the site whose pace question got a no: asked at the threshold all the same (that no was not for it either)
  const no = (await hook(w, fetchEvent(w, "https://www.zapor-example.org/16", { sid, use: "z16" }), talk)).json!;
  assert.equal(no.permissionDecision, "ask", "a no to the pace is no answer to the threshold");
  assert.match(no.permissionDecisionReason, /^Už 14 požadavků na zapor-example\.org/);
  w.cleanup();
});

test("a strom fetch at the same host meanwhile (its loop holding the host's lock request after request): a conversation's call below the threshold never asks — let go, counted; a run's refused one request at a time, never through uncounted", { ...opts, skip: opts.skip || process.platform === "win32" }, async () => {
  const w = new World();
  await w.withTree();
  await w.ok(["research", "new", "Předci Jana Nováka", "--new-person", "Jan /Novák/", "--sex", "M", "--born", "ABT 1905"]);
  const s = (await w.ok(["session", "start", "--json"], { env: { CLAUDECODE: "1", STROM_WORKER: "claude-1" } })).json;
  const sid: string = s.session?.id ?? s.id;
  const talk = { STROM_SESSION: sid, STROM_MODEL: "opus" };
  const run = { ...talk, STROM_NONINTERACTIVE: "1", STROM_WORKER: "run-1-x" };
  const host = "fetch-example.org";
  fs.mkdirSync(net(w), { recursive: true });
  // a connector's run as politeRequest makes it: the host's lock from the pause to the answer, the next request at once
  // — handed from one request to the next in one step (a fresh lock renamed over the last one), so that no call of the
  // hook can find the host free between two of them by the clock's chance: whatever it waits, the host is held
  const loop = spawn(process.execPath, ["--input-type=module", "-e", `
    const fs = await import("node:fs");
    const os = await import("node:os");
    const { acquireLock } = await import(${JSON.stringify(path.join(import.meta.dirname, "..", "..", "src", "core", "lock.ts"))});
    const file = ${JSON.stringify(path.join(net(w), `${host}.json`))};
    const lock = file + ".lock";
    const end = Date.now() + 20000;
    acquireLock(lock, { owner: "strom net", waitMs: 60000 });
    let said = false;
    while (Date.now() < end) {
      const t = Date.now();
      let s = { recent: [] };
      try { s = JSON.parse(fs.readFileSync(file, "utf8")); } catch {}
      s.last = t; s.recent = [...(s.recent ?? []), t];
      fs.writeFileSync(file, JSON.stringify(s));
      if (!said) { process.stdout.write("fetching"); said = true; }
      while (Date.now() - t < 300) {}
      // the next request's lock in place of this one's at once
      fs.writeFileSync(lock + ".next", JSON.stringify({ pid: process.pid, host: os.hostname(), at: new Date().toISOString(), owner: "strom net" }));
      fs.renameSync(lock + ".next", lock);
    }
    fs.rmSync(lock, { force: true });
  `], { stdio: ["ignore", "pipe", "inherit"] });
  try {
    await new Promise<void>((resolve) => loop.stdout!.on("data", (d) => String(d).includes("fetching") && resolve()));
    testHooks.lockWaitMs = 1500;
    // a conversation, one request of the agent's (far below the threshold): nothing asked, let go and counted
    const a = await hook(w, fetchEvent(w, `https://${host}/1`, { sid, use: "f1" }), talk);
    assert.equal(a.out, "", "nothing asked of the person");
    assert.deepEqual([journal(w).at(-1)!.toolUse, journal(w).at(-1)!.decision, journal(w).at(-1)!.why, journal(w).at(-1)!.n], ["f1", "allow", "busy", 1]);
    // a run: refused as one request at a time, with the way on — recorded, never through uncounted
    const b = await hook(w, fetchEvent(w, `https://${host}/2`, { sid, use: "f2" }), run);
    assert.equal(b.json!.permissionDecision, "deny");
    assert.match(b.json!.permissionDecisionReason, /^strom: one request at a time to fetch-example\.org, a person's pace — another request to it is under way \(strom's own, a strom fetch, or another call of yours\).*this one again in a moment/);
    assert.deepEqual([journal(w).at(-1)!.toolUse, journal(w).at(-1)!.decision, journal(w).at(-1)!.why], ["f2", "deny", "busy"]);
    assert.ok(!journal(w).some((r) => r.decision === "ask"), "no question at all");
    assert.equal((await w.ok(["net", "web", "--json"], { env: talk })).json.hosts[host], 1, "the conversation's counted, the run's refused one not");
  } finally {
    testHooks.lockWaitMs = undefined;
    loop.kill("SIGKILL");
    await new Promise((r) => loop.on("close", r));
  }
  w.cleanup();
});

test("the hook's command as the agent's shell runs it: strom's deny passes on whole on stdout with exit 0, an older strom's exit 2 (no net web) never blocks", { skip: process.platform === "win32" }, async () => {
  const { spawnSync } = await import("node:child_process");
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "strom-hook-ž "));
  const bin = path.join(root, ".strom", "bin");
  fs.mkdirSync(bin, { recursive: true });
  const deny = JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: "strom: one request at a time" } });
  const cmd = webHookCommand(root, process.platform).command;
  try {
    fs.writeFileSync(path.join(bin, "strom"), `#!/bin/sh\nprintf '%s' '${deny}'\nexit 0\n`, { mode: 0o755 });
    const a = spawnSync("/bin/sh", ["-c", cmd], { encoding: "utf8" });
    assert.deepEqual([a.status, a.stdout], [0, deny], "the deny as strom gave it");
    fs.writeFileSync(path.join(bin, "strom"), `#!/bin/sh\necho "unknown command: net web" >&2\nexit 2\n`, { mode: 0o755 });
    const b = spawnSync("/bin/sh", ["-c", cmd], { encoding: "utf8" });
    assert.deepEqual([b.status, b.stdout], [0, ""], "an older strom: the call goes");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
