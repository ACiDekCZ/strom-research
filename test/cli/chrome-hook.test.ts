// The agent's browser (Claude in Chrome) kept like its web fetch (core/chromehook.ts): the tree's Claude Code settings
// run `strom net web --hook` before its navigate and each tool on a page, and after a navigate ran or failed. A navigate
// is a web fetch on the route of a person's browser — counted and paced with the web fetches of the same site, refused
// where strom refuses them, an archive only a person's browser goes to opened at a person's pace with the person's
// permission; a page tool kept off a host strom must leave alone, never counted.

import { after, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit, readJsonFile } from "../helpers.ts";
import { testHooks } from "../../src/core/net.ts";
import { claudeWebHooks } from "../../src/core/web.ts";
import { CHROME_HOOK_MATCHER, CHROME_NAVIGATE } from "../../src/core/browser.ts";
import { CHROME_TABS, chromeEvent, navigateUrl } from "../../src/core/chromehook.ts";
import { grantWay } from "../../src/core/terms.ts";

const opts = { skip: !hasGit };
let ahead = 0;
const pauses: number[] = [];
testHooks.now = () => Date.now() + ahead;
testHooks.sleep = async (ms) => {
  pauses.push(ms);
  ahead += ms;
};
after(() => {
  testHooks.sleep = undefined;
  testHooks.now = undefined;
});

const TOKEN = "0123456789abcdef0123456789abcdef";
const PORT = 47321;

const journal = (w: World) => {
  const f = path.join(w.cwd, ".strom", "metrics", "fetch.jsonl");
  return fs.existsSync(f) ? fs.readFileSync(f, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l) as Record<string, any>) : [];
};

function terms(w: World, archives: Record<string, unknown>[]): void {
  const file = path.join(w.dir, "archives-test.json");
  fs.writeFileSync(file, JSON.stringify({ archives }));
  w.env.STROM_ARCHIVES_FILE = file;
}

function hostState(w: World, host: string, s: Record<string, unknown>): void {
  const dir = path.join(w.home, "shared", "net");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${host}.json`), JSON.stringify({ recent: [], ...s }));
}

const PAGE = "mcp__claude-in-chrome__";

/** Claude Code's event of a tool of Claude in Chrome (PreToolUse unless said). */
const chrome = (w: World, name: string, input: Record<string, unknown>, o: { use?: string; event?: string; sid?: string } = {}) =>
  JSON.stringify({ session_id: o.sid ?? "agent-1", cwd: w.cwd, hook_event_name: o.event ?? "PreToolUse", tool_name: `${PAGE}${name}`, tool_input: input, ...(o.use ? { tool_use_id: o.use } : {}) });

const fetchEvent = (w: World, url: string, use: string) =>
  JSON.stringify({ session_id: "agent-1", cwd: w.cwd, hook_event_name: "PreToolUse", tool_name: "WebFetch", tool_input: { url, prompt: "the text" }, tool_use_id: use });

async function hook(w: World, stdin: string, env: Record<string, string> = {}) {
  const r = await w.run(["net", "web", "--hook"], { stdin, env: { CLAUDECODE: "1", ...env } });
  assert.equal(r.code, 0, `the hook never fails: ${r.err}`);
  const out = r.out.trim();
  const j = out ? (JSON.parse(out) as { hookSpecificOutput: { permissionDecision?: string; permissionDecisionReason?: string } }).hookSpecificOutput : undefined;
  return { out, decision: j?.permissionDecision ?? "allow", reason: j?.permissionDecisionReason ?? "" };
}

const navigate = (w: World, url: string, use: string, tab = 7, env: Record<string, string> = {}) => hook(w, chrome(w, "navigate", { url, tabId: tab }, { use }), env);

test("the tree's Claude Code settings run strom's hook before Claude in Chrome's navigate and its page tools, and after a navigate; the same command as the web fetch's, on Windows too", opts, async () => {
  const w = new World();
  await w.withTree();
  type Group = { matcher: string; hooks: { command: string; timeout: number; shell?: string }[] };
  const s = readJsonFile(path.join(w.cwd, ".claude", "settings.json")) as { hooks: Record<string, Group[]> };
  const pre = s.hooks.PreToolUse!;
  const web = pre.find((g) => g.matcher === "WebFetch|WebSearch")!;
  const browser = pre.find((g) => g.matcher === CHROME_HOOK_MATCHER)!;
  assert.ok(browser, "before each tool of Claude in Chrome strom knows");
  assert.deepEqual(browser.hooks, web.hooks, "one command, one time limit");
  for (const name of ["navigate", "computer", "find", "read_page", "get_page_text", "form_input", "javascript_tool", "read_network_requests", "read_console_messages"])
    assert.match(`${PAGE}${name}`, new RegExp(`^(?:${CHROME_HOOK_MATCHER})$`), name);
  for (const name of ["tabs_create_mcp", "tabs_context_mcp", "resize_window", "gif_creator"]) assert.doesNotMatch(`${PAGE}${name}`, new RegExp(`^(?:${CHROME_HOOK_MATCHER})$`), name);
  for (const ev of ["PostToolUse", "PostToolUseFailure"]) {
    const g = s.hooks[ev]!.find((x) => x.matcher === CHROME_NAVIGATE);
    assert.ok(g, `${ev}: after a navigate`);
    assert.deepEqual(g!.hooks, web.hooks);
  }
  const win = claudeWebHooks("C:\\Users\\Lhoták\\Strom\\Lhota", "win32") as Record<string, Group[]>;
  const g = win.PreToolUse!.find((x) => x.matcher === CHROME_HOOK_MATCHER)!;
  assert.equal(g.hooks[0]!.shell, "powershell");
  assert.match(g.hooks[0]!.command, /strom\.cmd' net web --hook; exit 0$/);
  w.cleanup();
});

test("Claude in Chrome's event read: navigate needs its address, back and forward kept as words, a tab's number, the script of javascript_tool; other tools and agents not its", () => {
  const ev = chromeEvent(JSON.stringify({ session_id: "s", cwd: "/x", hook_event_name: "PreToolUse", tool_name: `${PAGE}navigate`, tool_input: { url: " lhota.example.org/kniha ", tabId: 12 }, tool_use_id: "u" }));
  assert.deepEqual(ev, { tool: `${PAGE}navigate`, name: "navigate", tab: "12", url: "lhota.example.org/kniha", agentSession: "s", toolUse: "u", cwd: "/x" });
  assert.equal(chromeEvent(JSON.stringify({ tool_name: `${PAGE}navigate`, tool_input: { tabId: 1 } })), undefined, "no address: nothing to answer");
  assert.equal(chromeEvent(JSON.stringify({ tool_name: `${PAGE}navigate`, tool_input: { url: "back", tabId: "3" } }))?.tab, "3");
  assert.equal(chromeEvent(JSON.stringify({ tool_name: `${PAGE}javascript_tool`, tool_input: { text: "document.title", tabId: 3 } }))?.text, "document.title");
  assert.equal(chromeEvent(JSON.stringify({ tool_name: `${PAGE}navigate`, tool_input: { url: "x" }, hook_event_name: "PostToolUseFailure", error: "net::ERR" }))?.phase, "failed");
  assert.equal(chromeEvent(JSON.stringify({ tool_name: `${PAGE}tabs_create_mcp`, tool_input: {} })), undefined);
  assert.equal(chromeEvent(JSON.stringify({ tool_name: "WebFetch", tool_input: { url: "https://a.example" } })), undefined);
  assert.equal(chromeEvent("not json"), undefined);
  assert.equal(navigateUrl("lhota.example.org/kniha"), "https://lhota.example.org/kniha");
  assert.equal(navigateUrl("localhost:47321/x"), "https://localhost:47321/x", "a host with its port is no scheme");
  assert.equal(navigateUrl("http://lhota.example.org/"), "http://lhota.example.org/");
  assert.equal(navigateUrl("file:///tmp/a.html"), "file:///tmp/a.html");
});

test("navigate: a closed archive and the bridge refused; a web strom lets go recorded under the tool's own name, paced and counted with the web fetches of the same site; after it ran or failed, nothing more", opts, async () => {
  const w = new World();
  await w.withTree();
  terms(w, [{ host: "closed.example.org", level: "forbidden", name: "Zavřený archiv", terms: "https://closed.example.org/terms" }]);
  const closed = await navigate(w, "https://closed.example.org/catalog", "c1");
  assert.equal(closed.decision, "deny");
  assert.match(closed.reason, /allow no automated access .* nothing goes to it through your web tools or a browser either/);
  const refused = journal(w).at(-1)!;
  assert.deepEqual([refused.tool, refused.via, refused.decision, refused.host], [`${PAGE}navigate`, "web", "deny", "closed.example.org"]);

  // the bridge: its address without a scheme too, its secret anywhere
  const dir = path.join(w.cwd, ".strom");
  fs.writeFileSync(path.join(dir, "live-last.json"), JSON.stringify({ port: PORT, token: TOKEN, pid: 999999, url: `http://127.0.0.1:${PORT}/${TOKEN}`, started: "2026-01-01T00:00:00.000Z" }));
  for (const url of [`localhost:${PORT}/x`, `http://127.0.0.1:${PORT}/${TOKEN}/status`, `https://example.org/?live=${TOKEN}`]) {
    const r = await navigate(w, url, `b-${url}`);
    assert.equal(r.decision, "deny", url);
    assert.match(r.reason, /bridge/i, url);
  }

  // a web nothing is known against: let go, recorded, the tab's host kept; a web fetch of the same site after it paced
  const before = journal(w).length;
  pauses.length = 0;
  const went = await navigate(w, "lhota-katalog.example.org/kniha/1", "n1");
  assert.equal(went.out, "", "let go without a word");
  const rec = journal(w).at(-1)!;
  assert.deepEqual([rec.tool, rec.via, rec.decision, rec.host, rec.n, rec.toolUse], [`${PAGE}navigate`, "web", "allow", "lhota-katalog.example.org", 1, "n1"]);
  assert.equal(rec.url, undefined, "never the address");
  const tabs = readJsonFile(path.join(w.cwd, ".strom", "metrics", CHROME_TABS)) as Record<string, { host: string; url: string }>;
  assert.equal(tabs["agent-1#7"]?.host, "lhota-katalog.example.org");
  assert.equal(tabs["agent-1#7"]?.url, "https://lhota-katalog.example.org/kniha/1", "without its scheme: https://");
  assert.equal((await hook(w, fetchEvent(w, "https://lhota-katalog.example.org/kniha/2", "f1"))).out, "");
  const fetched = journal(w).at(-1)!;
  assert.deepEqual([fetched.tool, fetched.n], ["WebFetch", 2], "one count of the site for the browser and the web fetch");
  assert.ok(fetched.paceMs > 0, "the web fetch waited for the host's pace after the navigate");
  const state = readJsonFile(path.join(w.home, "shared", "net", "lhota-katalog.example.org.json")) as { recent: number[] };
  assert.equal(state.recent.length, 2, "both in the host's shared hour");
  assert.equal((await hook(w, fetchEvent(w, "https://www.lhota-katalog.example.org/kniha/3", "f2"))).out, "");
  assert.equal(journal(w).at(-1)!.n, 3, "a mirror of the site counted with it");
  // after it ran or failed: nothing new recorded twice
  assert.equal((await hook(w, chrome(w, "navigate", { url: "lhota-katalog.example.org/kniha/1", tabId: 7 }, { use: "n1", event: "PostToolUse" }))).out, "");
  assert.equal((await hook(w, chrome(w, "navigate", { url: "lhota-katalog.example.org/kniha/1", tabId: 7 }, { use: "n1", event: "PostToolUseFailure" }))).out, "");
  assert.equal(journal(w).filter((r) => r.toolUse === "n1").length, 1);
  assert.ok(journal(w).length >= before + 2);
  // a page of the browser itself, a file: nothing of an archive
  assert.equal((await navigate(w, "chrome://settings", "x1")).out, "");
  w.cleanup();
});

test("an archive only a person's browser goes to: never through the web fetch; through the browser only with the person's permission, at a person's pace; its images by hand where they are by hand only", opts, async () => {
  const w = new World();
  await w.withTree();
  terms(w, [
    { host: "browser.example.org", level: "restricted", browserOnly: true, quoteFrom: "robots", terms: "https://browser.example.org/robots.txt", quote: "User-agent: * / Disallow: /" },
    { host: "manual.example.org", level: "manual", name: "Ruční archiv", terms: "https://manual.example.org/terms" },
  ]);
  const env = { STROM_TEST_HUMAN_PACE_MS: "7000" };
  const no = await navigate(w, "https://browser.example.org/book/1", "p1", 7, env);
  assert.equal(no.decision, "deny");
  assert.match(no.reason, /only through a person's browser, and the person has not allowed it "through the browser" \(strom allow archive browser\.example\.org --way browser — the person's, never yours\): not through the browser either/);
  assert.match(no.reason, /strom task wait/);

  assert.ok(grantWay(w.env, ["browser.example.org"], "browser", { by: "terminal" }), "the person's permission");
  pauses.length = 0;
  assert.equal((await navigate(w, "https://browser.example.org/book/1", "p2", 7, env)).out, "");
  assert.equal((await navigate(w, "https://browser.example.org/book/2", "p3", 7, env)).out, "");
  const [a, b] = journal(w).filter((r) => r.decision === "allow");
  assert.deepEqual([a!.tool, a!.host, b!.n], [`${PAGE}navigate`, "browser.example.org", 2]);
  assert.ok(b!.paceMs >= 6000 && b!.paceMs <= 7000, `a person's pace between two pages (${b!.paceMs} ms)`);
  // the web fetch still not
  const fetch = await hook(w, fetchEvent(w, "https://browser.example.org/book/3", "f1"), env);
  assert.equal(fetch.decision, "deny");
  assert.match(fetch.reason, /no web fetch/);

  // an archive whose images go by hand only: its image not through the browser either
  const img = await navigate(w, "https://manual.example.org/img/5/40.jpg", "m1", 8, env);
  assert.equal(img.decision, "deny");
  // a path robots.txt keeps automated tools off: not through the browser either
  hostState(w, "parish.example.org", { robots: { at: Date.now(), status: 200, groups: [{ agents: ["*"], allow: [], disallow: ["/search"] }] } });
  assert.equal((await navigate(w, "https://parish.example.org/search?q=Lhot%C3%A1k", "r1", 9, env)).decision, "deny");
  assert.equal((await navigate(w, "https://parish.example.org/book/1", "r2", 9, env)).out, "", "the rest of the site");
  w.cleanup();
});

test("back and forward: the tab's last address counted again; a tab of none let go uncounted", opts, async () => {
  const w = new World();
  await w.withTree();
  assert.equal((await navigate(w, "https://lhota-archiv.example.org/a", "n1", 4)).out, "");
  assert.equal((await hook(w, chrome(w, "navigate", { url: "back", tabId: 4 }, { use: "n2" }))).out, "");
  const rec = journal(w);
  assert.deepEqual(rec.map((r) => [r.host, r.n]), [["lhota-archiv.example.org", 1], ["lhota-archiv.example.org", 2]]);
  assert.equal((await hook(w, chrome(w, "navigate", { url: "forward", tabId: 99 }, { use: "n3" }))).out, "");
  assert.equal(journal(w).length, 2, "a tab strom saw nothing of");
  // a site that turned forbidden meanwhile: back to it refused
  terms(w, [{ host: "lhota-archiv.example.org", level: "forbidden", terms: "https://lhota-archiv.example.org/terms" }]);
  assert.equal((await hook(w, chrome(w, "navigate", { url: "back", tabId: 4 }, { use: "n4" }))).decision, "deny");
  w.cleanup();
});

test("tools on a page: let go uncounted on a host strom lets go; refused on one it must leave alone now or whose terms forbid automation; a script that names the bridge refused", opts, async () => {
  const w = new World();
  await w.withTree();
  assert.equal((await navigate(w, "https://lhota-kniha.example.org/1", "n1", 5)).out, "");
  const n = journal(w).length;
  for (const [name, input] of [["computer", { action: "screenshot", tabId: 5 }], ["get_page_text", { tabId: 5 }], ["javascript_tool", { action: "javascript_exec", text: "document.title", tabId: 5 }], ["find", { query: "Lhoták", tabId: 5 }]] as const)
    assert.equal((await hook(w, chrome(w, name, input))).out, "", name);
  assert.equal(journal(w).length, n, "never counted: strom's own browser plan counts its requests once, by its limiter");
  // a tab strom saw nothing of: let go
  assert.equal((await hook(w, chrome(w, "read_page", { tabId: 77 }))).out, "");

  // the host left alone (a refusal, its limit): its page in the tab neither
  hostState(w, "lhota-kniha.example.org", { blockedUntil: Date.now() + 3600_000, reason: "it answered 429" });
  const left = await hook(w, chrome(w, "get_page_text", { tabId: 5 }));
  assert.equal(left.decision, "deny");
  assert.match(left.reason, /lhota-kniha\.example\.org is left alone until .* — it answered 429; nothing goes to it before then, through the browser either/);
  // its terms forbid automation now
  hostState(w, "lhota-kniha.example.org", {});
  terms(w, [{ host: "lhota-kniha.example.org", level: "forbidden", terms: "https://lhota-kniha.example.org/terms" }]);
  const forbidden = await hook(w, chrome(w, "computer", { action: "left_click", coordinate: [1, 2], tabId: 5 }));
  assert.equal(forbidden.decision, "deny");
  assert.match(forbidden.reason, /allow no automated access/);
  // a script that names the bridge, whatever tab
  fs.writeFileSync(path.join(w.cwd, ".strom", "live-last.json"), JSON.stringify({ port: PORT, token: TOKEN, pid: 999999, url: `http://127.0.0.1:${PORT}/${TOKEN}`, started: "2026-01-01T00:00:00.000Z" }));
  const js = await hook(w, chrome(w, "javascript_tool", { action: "javascript_exec", text: `fetch("http://127.0.0.1:${PORT}/${TOKEN}/status")`, tabId: 77 }));
  assert.equal(js.decision, "deny");
  assert.match(js.reason, /bridge/i);
  w.cleanup();
});

test("an address in any script: a host of diacritics without its scheme (composed or not) counted under its punycode; a closed one refused by its punycode name", opts, async () => {
  const w = new World();
  await w.withTree();
  const puny = new URL("https://lhotá.example.org/").hostname;
  assert.match(puny, /^xn--/);
  assert.equal((await navigate(w, "lhotá.example.org/kniha", "i1")).out, "");
  assert.equal((await navigate(w, "lhota\u0301.example.org/kniha/2", "i2")).out, "", "decomposed (NFD)");
  assert.deepEqual(journal(w).map((r) => [r.host, r.n]), [[puny, 1], [puny, 2]]);
  const cyr = new URL("https://архив.example.org/").hostname;
  terms(w, [{ host: cyr, level: "forbidden", terms: `https://${cyr}/terms` }]);
  assert.equal((await navigate(w, "архив.example.org/книга", "i3")).decision, "deny");
  w.cleanup();
});

test("strom net web --check <url> --browser: whether the browser may open it, at whose pace; --browser alone is a usage error", opts, async () => {
  const w = new World();
  await w.withTree();
  terms(w, [{ host: "browser.example.org", level: "restricted", browserOnly: true, quoteFrom: "robots", terms: "https://browser.example.org/robots.txt", quote: "User-agent: * / Disallow: /" }]);
  const web = (await w.run(["net", "web", "--check", "https://browser.example.org/book/1", "--json"])).out;
  assert.equal((JSON.parse(web) as { allow: boolean }).allow, false, "no web fetch");
  const before = JSON.parse((await w.run(["net", "web", "--check", "https://browser.example.org/book/1", "--browser", "--json"])).out) as { allow: boolean; route?: string };
  assert.deepEqual([before.allow, before.route], [false, "browser"], "not without the person's permission");
  grantWay(w.env, ["browser.example.org"], "browser", { by: "terminal" });
  const r = await w.run(["net", "web", "--check", "https://browser.example.org/book/1", "--browser"], { env: { STROM_TEST_HUMAN_PACE_MS: "7000" } });
  assert.match(r.out, /7 s apart/);
  const j = JSON.parse((await w.run(["net", "web", "--check", "https://browser.example.org/book/1", "--browser", "--json"])).out) as { allow: boolean; route?: string; human?: boolean };
  assert.deepEqual([j.allow, j.route, j.human], [true, "browser", true]);
  const bad = await w.run(["net", "web", "--browser"]);
  assert.equal(bad.code, 2, bad.err);
  w.cleanup();
});
