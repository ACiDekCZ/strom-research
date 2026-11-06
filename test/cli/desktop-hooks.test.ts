// Claude's desktop app kept like Claude Code in the terminal (core/chromehook.ts, core/desktopterminal.ts): its built-in
// browser (mcp__Claude_Browser__…, mcp__remote-devices__Claude_Browser__…) by the same hook as Claude in Chrome — an
// address it opens counted and paced as a web fetch on the browser's route, a tool on a page judged by the host of its
// tab, its tabs apart from Chrome's —, and its terminal (mcp__terminal__run_in_terminal) by the same hook as Bash, with
// what the tree's rules of Bash deny and what is the person's own. The events replayed are the app's own (2.1.317,
// test/fixtures/desktop-hooks, paths made neutral); a navigate and a tabs_create of the same shape are made here.

import { after, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit, readJsonFile } from "../helpers.ts";
import { testHooks } from "../../src/core/net.ts";
import { APP_BROWSER_HOOK_MATCHER, APP_BROWSER_NAVIGATE_MATCHER, CHROME_HOOK_MATCHER } from "../../src/core/browser.ts";
import { DESKTOP_TERMINAL_MATCHER, simpleCommands } from "../../src/core/desktopterminal.ts";
import { CHROME_TABS } from "../../src/core/chromehook.ts";
import { grantWay } from "../../src/core/terms.ts";

const opts = { skip: !hasGit };
let ahead = 0;
testHooks.now = () => Date.now() + ahead;
testHooks.sleep = async (ms) => {
  ahead += ms;
};
after(() => {
  testHooks.sleep = undefined;
  testHooks.now = undefined;
});

const TOKEN = "0123456789abcdef0123456789abcdef";
const PORT = 47321;
const APP = "mcp__Claude_Browser__";
const FIXTURE = path.join(import.meta.dirname, "..", "fixtures", "desktop-hooks", "desktop-2.1.317.json");

type HookEvent = { session_id: string; cwd: string; hook_event_name: string; tool_name: string; tool_input: Record<string, unknown>; tool_response?: unknown; tool_use_id?: string };

/** The app's own events, in the tree of this test. */
function recorded(w: World): HookEvent[] {
  const cwd = JSON.stringify(w.cwd).slice(1, -1);
  return JSON.parse(fs.readFileSync(FIXTURE, "utf8").split("{TREE}").join(cwd)) as HookEvent[];
}

const journal = (w: World) => {
  const f = path.join(w.cwd, ".strom", "metrics", "fetch.jsonl");
  return fs.existsSync(f) ? fs.readFileSync(f, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l) as Record<string, any>) : [];
};

function terms(w: World, archives: Record<string, unknown>[]): void {
  const file = path.join(w.dir, "archives-test.json");
  fs.writeFileSync(file, JSON.stringify({ archives }));
  w.env.STROM_ARCHIVES_FILE = file;
}

function bridgeNotes(w: World): void {
  fs.writeFileSync(path.join(w.cwd, ".strom", "live-last.json"), JSON.stringify({ port: PORT, token: TOKEN, pid: 999999, url: `http://127.0.0.1:${PORT}/${TOKEN}`, started: "2026-01-01T00:00:00.000Z" }));
}

let uses = 0;
/** An event of the app's built-in browser of the same shape as its own (PreToolUse unless said). */
const app = (w: World, name: string, input: Record<string, unknown>, o: { event?: string; use?: string; response?: unknown; prefix?: string; sid?: string } = {}) =>
  JSON.stringify({
    session_id: o.sid ?? "desktop-1",
    cwd: w.cwd,
    hook_event_name: o.event ?? "PreToolUse",
    tool_name: `${o.prefix ?? APP}${name}`,
    tool_input: input,
    ...(o.response ? { tool_response: o.response } : {}),
    tool_use_id: o.use ?? `toolu_${name}_${++uses}`,
  });

/** What preview_start answers (the app's own shape): the tab it opened. */
const opened = (tab: string) => [{ type: "text", text: `{\n  "serverId": "preview-local_1",\n  "tabId": "${tab}",\n  "reused": false,\n  "type": "browser",\n  "navOk": true\n}\nBrowser pane opened.` }];

async function hook(w: World, stdin: string, args = ["net", "web", "--hook"], env: Record<string, string> = {}) {
  const r = await w.run(args, { stdin, env: { CLAUDECODE: "1", ...env } });
  assert.equal(r.code, 0, `the hook never fails: ${r.err}`);
  const out = r.out.trim();
  const j = out ? (JSON.parse(out) as { hookSpecificOutput: { permissionDecision?: string; permissionDecisionReason?: string } }).hookSpecificOutput : undefined;
  return { out, decision: j?.permissionDecision ?? "allow", reason: j?.permissionDecisionReason ?? "" };
}

const terminal = (w: World, command: string, o: { tool?: string; env?: Record<string, string> } = {}) =>
  hook(w, JSON.stringify({ session_id: "desktop-1", cwd: w.cwd, hook_event_name: "PreToolUse", tool_name: o.tool ?? "mcp__terminal__run_in_terminal", tool_input: { command, title: "x" }, tool_use_id: "toolu_t" }), ["agents", "shell", "--hook"], o.env);

type Group = { matcher: string; hooks: { command: string; timeout: number }[] };
const matches = (m: string, tool: string) => new RegExp(`^(?:${m})$`).test(tool);

test("the tree's Claude Code settings: strom's hook before the built-in browser's tools and the desktop app's terminal, after its navigation; the terminal never allowed; agents sync writes them over older settings", opts, async () => {
  const w = new World();
  await w.withTree();
  const file = path.join(w.cwd, ".claude", "settings.json");
  const check = () => {
    const s = readJsonFile(file) as { permissions: { allow: string[]; deny: string[] }; hooks: Record<string, Group[]> };
    const pre = s.hooks.PreToolUse!;
    const web = pre.find((g) => g.matcher === "WebFetch|WebSearch")!;
    const browser = pre.find((g) => g.matcher === APP_BROWSER_HOOK_MATCHER);
    assert.ok(browser, "before each tool of the built-in browser strom knows");
    assert.deepEqual(browser.hooks, web.hooks, "the web hook's command and time limit");
    assert.ok(pre.find((g) => g.matcher === CHROME_HOOK_MATCHER), "Claude in Chrome's beside it");
    for (const ev of ["PostToolUse", "PostToolUseFailure"]) assert.ok(s.hooks[ev]!.find((g) => g.matcher === APP_BROWSER_NAVIGATE_MATCHER), ev);
    for (const prefix of [APP, "mcp__remote-devices__Claude_Browser__"]) {
      for (const name of ["preview_start", "navigate", "tabs_create", "get_page_text", "find", "read_page", "javascript_tool", "computer", "form_input", "read_console_messages", "read_network_requests"])
        assert.ok(matches(APP_BROWSER_HOOK_MATCHER, `${prefix}${name}`), `${prefix}${name}`);
      for (const name of ["preview_start", "navigate", "tabs_create"]) assert.ok(matches(APP_BROWSER_NAVIGATE_MATCHER, `${prefix}${name}`), `after ${prefix}${name}`);
      assert.ok(!matches(APP_BROWSER_NAVIGATE_MATCHER, `${prefix}get_page_text`), "after a page tool no hook");
      assert.ok(!matches(APP_BROWSER_HOOK_MATCHER, `${prefix}tabs_context`), "a tool of no address and no page");
    }
    assert.ok(!matches(APP_BROWSER_HOOK_MATCHER, "mcp__claude-in-chrome__navigate"), "Chrome's its own");
    const shell = pre.find((g) => g.matcher === DESKTOP_TERMINAL_MATCHER);
    assert.ok(shell, "before the app's terminal");
    assert.deepEqual(shell.hooks, pre.find((g) => g.matcher === "Bash|PowerShell")!.hooks, "the shell hook's command");
    assert.ok(matches(DESKTOP_TERMINAL_MATCHER, "mcp__terminal__run_in_terminal"));
    assert.ok(!matches(DESKTOP_TERMINAL_MATCHER, "mcp__terminal__read_terminal"), "reading its output runs nothing");
    assert.ok(!s.permissions.allow.some((r) => /terminal|run_in_terminal/i.test(r)), "the terminal never allowed: the app asks the person");
  };
  check();
  // settings an older strom wrote, without them: agents sync writes them whole again
  const old = readJsonFile(file) as { hooks: Record<string, Group[]> };
  for (const ev of Object.keys(old.hooks)) old.hooks[ev] = old.hooks[ev]!.filter((g) => g.matcher !== APP_BROWSER_HOOK_MATCHER && g.matcher !== APP_BROWSER_NAVIGATE_MATCHER && g.matcher !== DESKTOP_TERMINAL_MATCHER);
  fs.writeFileSync(file, JSON.stringify(old, null, 2));
  const r = await w.run(["agents", "sync"]);
  assert.equal(r.code, 0, r.err);
  check();
  w.cleanup();
});

test("the app's own events replayed: preview_start counted, its tab kept from its answer, the page tools on it let go — and refused once its host turned forbidden; the terminal's echo let go", opts, async () => {
  const w = new World();
  await w.withTree();
  const events = recorded(w);
  for (const ev of events) {
    const shell = ev.tool_name.startsWith("mcp__terminal__");
    const a = await hook(w, JSON.stringify(ev), shell ? ["agents", "shell", "--hook"] : ["net", "web", "--hook"]);
    assert.equal(a.out, "", `${ev.hook_event_name} ${ev.tool_name}`);
  }
  const rec = journal(w).filter((r) => r.decision === "allow");
  assert.deepEqual(
    rec.map((r) => [r.tool, r.host, r.n]),
    [[`${APP}preview_start`, "example.com", 1]],
    "the one address opened, counted once; the tools on its page never",
  );
  const tabs = readJsonFile(path.join(w.cwd, ".strom", "metrics", CHROME_TABS)) as Record<string, { url: string; host: string }>;
  assert.equal(tabs["desktop-1#app:seed"]?.host, "example.com", "the tab preview_start said it opened");
  assert.ok(!("desktop-1#seed" in tabs), "never one of Chrome's");

  terms(w, [{ host: "example.com", level: "forbidden", name: "Archiv Lhota", terms: "https://example.com/terms" }]);
  const get = events.find((e) => e.hook_event_name === "PreToolUse" && e.tool_name === `${APP}get_page_text`)!;
  const no = await hook(w, JSON.stringify(get));
  assert.equal(no.decision, "deny");
  assert.match(no.reason, /allow no automated access/);
  const js = events.find((e) => e.hook_event_name === "PreToolUse" && e.tool_name === `${APP}javascript_tool`)!;
  assert.equal((await hook(w, JSON.stringify(js))).decision, "deny", "a script on its page neither");
  // the same through a cloud session linked to the computer
  const remote = { ...get, tool_name: get.tool_name.replace(APP, "mcp__remote-devices__Claude_Browser__") };
  assert.equal((await hook(w, JSON.stringify(remote))).decision, "deny", "the same conversation's tab, whichever way the app names its tools");
  w.cleanup();
});

test("an archive only a person's browser goes to: the built-in browser refused with Chrome's advice until the person allows it, then counted at a person's pace; navigate and tabs_create the same; the remote-devices prefix too", opts, async () => {
  const w = new World();
  await w.withTree();
  terms(w, [{ host: "browser.example.org", level: "restricted", browserOnly: true, quoteFrom: "robots", terms: "https://browser.example.org/robots.txt", quote: "User-agent: * / Disallow: /" }]);
  const env = { STROM_TEST_HUMAN_PACE_MS: "7000" };
  const advice = /only through a person's browser, and the person has not allowed it "through the browser" \(strom allow archive browser\.example\.org --way browser — the person's, never yours\): not through the browser either/;
  for (const [name, input, prefix] of [
    ["preview_start", { url: "https://browser.example.org/kniha/1" }, APP],
    ["navigate", { url: "browser.example.org/kniha/2", tabId: "seed" }, APP],
    ["tabs_create", { url: "https://browser.example.org/kniha/3" }, APP],
    ["preview_start", { url: "https://browser.example.org/kniha/4" }, "mcp__remote-devices__Claude_Browser__"],
  ] as const) {
    const no = await hook(w, app(w, name, input, { prefix }), undefined, env);
    assert.equal(no.decision, "deny", `${prefix}${name}`);
    assert.match(no.reason, advice);
  }

  assert.ok(grantWay(w.env, ["browser.example.org"], "browser", { by: "terminal" }), "the person's permission");
  assert.equal((await hook(w, app(w, "preview_start", { url: "https://browser.example.org/kniha/1" }, { use: "u1" }), undefined, env)).out, "");
  assert.equal((await hook(w, app(w, "preview_start", { url: "https://browser.example.org/kniha/1" }, { use: "u1", event: "PostToolUse", response: opened("seed") }), undefined, env)).out, "");
  assert.equal((await hook(w, app(w, "navigate", { url: "https://browser.example.org/kniha/2", tabId: "seed" }, { use: "u2" }), undefined, env)).out, "");
  const [a, b] = journal(w).filter((r) => r.decision === "allow");
  assert.deepEqual([a!.tool, a!.host, b!.tool, b!.n], [`${APP}preview_start`, "browser.example.org", `${APP}navigate`, 2]);
  assert.ok(b!.paceMs >= 6000 && b!.paceMs <= 7000, `a person's pace between two pages (${b!.paceMs} ms)`);
  // the page in that tab: a host strom lets go now
  assert.equal((await hook(w, app(w, "get_page_text", { tabId: "seed" }))).out, "");
  w.cleanup();
});

test("a tab strom saw nothing of let go; its tabs apart from Chrome's; a click elsewhere seen from the Tab Context; a preview of this computer let go uncounted, the bridge never", opts, async () => {
  const w = new World();
  await w.withTree();
  // Chrome's tab 7 at a site, which turns forbidden; the built-in browser's tab "7" is another tab
  assert.equal((await hook(w, JSON.stringify({ session_id: "desktop-1", cwd: w.cwd, hook_event_name: "PreToolUse", tool_name: "mcp__claude-in-chrome__navigate", tool_input: { url: "https://lhota-kniha.example.org/1", tabId: 7 }, tool_use_id: "c1" }))).out, "");
  terms(w, [{ host: "lhota-kniha.example.org", level: "forbidden", terms: "https://lhota-kniha.example.org/terms" }]);
  assert.equal((await hook(w, JSON.stringify({ session_id: "desktop-1", cwd: w.cwd, hook_event_name: "PreToolUse", tool_name: "mcp__claude-in-chrome__read_page", tool_input: { tabId: 7 } }))).decision, "deny", "Chrome's tab");
  assert.equal((await hook(w, app(w, "read_page", { tabId: "7" }))).out, "", "the built-in browser's tab of the same id: unknown, let go");
  assert.equal((await hook(w, app(w, "get_page_text", { tabId: "jiná-záložka" }))).out, "", "a tab strom saw nothing of");

  // a page tool's answer lists where its tabs are now: a click that led to the forbidden site
  const ctx = [{ type: "text", text: "Clicked." }, { type: "text", text: '\n\nTab Context:\n- Executed on tabId: seed\n- Available tabs:\n  • tabId seed: "Kniha — Лгота" ("https://lhota-kniha.example.org/2")' }];
  assert.equal((await hook(w, app(w, "navigate", { url: "https://lhota.example.org/", tabId: "seed" }, { event: "PostToolUse", response: ctx }))).out, "");
  assert.equal((await hook(w, app(w, "find", { query: "Lhoták", tabId: "seed" }))).decision, "deny", "the tab's host from its answer");

  // a preview of the agent's own page on this computer, a file: let go, never counted
  const n = journal(w).length;
  for (const url of ["http://localhost:5173/", "http://127.0.0.1:8080/náhled", "file:///tmp/lhota/strom.html"]) {
    assert.equal((await hook(w, app(w, "preview_start", { url }))).out, "", url);
    assert.equal((await hook(w, app(w, "preview_start", { url }, { event: "PostToolUse", response: opened("seed") }))).out, "", url);
  }
  assert.equal(journal(w).length, n, "nothing of an archive's");
  const tabs = readJsonFile(path.join(w.cwd, ".strom", "metrics", CHROME_TABS)) as Record<string, unknown>;
  assert.ok(!("desktop-1#app:seed" in tabs), "the tab at this computer's page: nothing known against it");
  assert.equal((await hook(w, app(w, "find", { query: "Lhoták", tabId: "seed" }))).out, "");
  // the bridge: never, whatever browser
  bridgeNotes(w);
  for (const url of [`http://127.0.0.1:${PORT}/${TOKEN}/status`, `http://localhost:${PORT}/status`]) {
    const no = await hook(w, app(w, "preview_start", { url }));
    assert.equal(no.decision, "deny", url);
    assert.match(no.reason, /bridge/);
  }
  const js = await hook(w, app(w, "javascript_tool", { action: "javascript_exec", tabId: "seed", text: `fetch("http://127.0.0.1:${PORT}/status")` }));
  assert.equal(js.decision, "deny");
  w.cleanup();
});

test("the desktop app's terminal kept like Bash: the bridge, what the tree's rules of Bash deny, the person's own commands and consents refused; the rest goes on", opts, async () => {
  const w = new World();
  await w.withTree();
  bridgeNotes(w);
  const bridge = await terminal(w, `curl -s http://127.0.0.1:${PORT}/status`);
  assert.equal(bridge.decision, "deny");
  assert.match(bridge.reason, /bridge/);
  assert.equal((await terminal(w, "cat .strom/live-last.json")).decision, "deny");

  const denied: [string, RegExp][] = [
    ["strom login lhota-archiv", /strom login is denied to you in this tree — the app's terminal keeps the tree's rules of Bash \(a login to an archive is the user's own/],
    ["strom --json seal adopt", /strom seal is denied/],
    ["git status", /git is denied/],
    ["cd notes && strom connector add lhota", /strom connector add is denied/],
    ["echo \"$(strom connector remove lhota)\"", /strom connector remove is denied/],
    ["env STROM_LANG=cs strom login", /strom login is denied/],
    ["C:\\Users\\lhotak\\strom.cmd login lhota", /strom login is denied/],
    ["strom allow archive lhota.example.org --way browser", /a consent \(strom allow …\) never through the app's terminal/],
    ["strom conflict leave X0001", /Leaving a conflict of the user's own edit to the agent is the user's choice.*never yours, in the app's terminal neither/],
  ];
  for (const [cmd, why] of denied) {
    const a = await terminal(w, cmd);
    assert.equal(a.decision, "deny", cmd);
    assert.match(a.reason, why, cmd);
    assert.match(a.reason, /Bash|another way/, `${cmd}: what to do instead`);
  }
  // a second strom beside the first: its own name
  assert.equal((await terminal(w, "strom-beta login lhota", { env: { STROM_ISOLATED: "1", STROM_COMMAND: "strom-beta" } })).decision, "deny");
  // strom under another name than this one's: the other channel's, the package run through npx and its kin, a path (N1)
  for (const cmd of [
    "strom-beta story approve S1",
    "strom-research story approve S1",
    "npx strom-research story approve S1",
    "npx -y strom-research@beta story approve S1",
    "npm exec -- strom-research story approve S1",
    "pnpm dlx strom-research story approve S1",
    "bunx strom-research@1.29.0 story approve S1",
    "npx -p strom-research strom story approve S1",
    "/Users/lhotak/.local/share/strom/program/bin/strom story approve S1",
    "node /Users/lhotak/strom-research/dist/cli.js story approve S1",
    "node C:\\Users\\lhotak\\strom-research\\src\\cli.ts story approve S1",
    "strom-beta allow archive lhota.example.org --way browser",
  ]) {
    const a = await terminal(w, cmd);
    assert.equal(a.decision, "deny", cmd);
  }
  for (const cmd of ["npx prettier --check .", "npm test", "node build.js story approve S1", "stromovka approve"])
    assert.equal((await terminal(w, cmd)).out, "", cmd);

  for (const cmd of ["echo ahoj", "strom status", 'strom note add "Lhoták z Лготы"', "echo 'strom login'", "ls notes/login"])
    assert.equal((await terminal(w, cmd)).out, "", cmd);
  // through Bash the tree's rules deny it (and strom refuses an agent the person's own): the hook leaves that to them
  assert.equal((await terminal(w, "strom login lhota-archiv", { tool: "Bash" })).out, "");

  // the rules as the tree's settings have them now (curl under full permissions)
  const file = path.join(w.cwd, ".claude", "settings.json");
  const s = readJsonFile(file) as { permissions: { deny: string[] } };
  assert.equal((await terminal(w, "curl -s https://lhota.example.org/")).out, "", "curl not denied in this tree");
  s.permissions.deny.push("Bash(curl:*)");
  fs.writeFileSync(file, JSON.stringify(s));
  assert.match((await terminal(w, "curl -s https://lhota.example.org/")).reason, /curl is denied to you in this tree .*strom's limiter/);
  w.cleanup();
});

test("a command's simple commands: split where a shell runs another, quotes off, any script kept, a Windows path whole", () => {
  assert.deepEqual(simpleCommands("cd \"Lhoták a syn\" && strom note add 'Лгота; 1850' | head"), [["cd", "Lhoták a syn"], ["strom", "note", "add", "Лгота; 1850"], ["head"]]);
  assert.deepEqual(simpleCommands("echo \"a $(strom seal) b\"; `git log`; x=\"`strom login`\""), [["echo", "a "], ["strom", "seal"], [" b"], ["git", "log"], ["x="], ["strom", "login"]]);
  assert.deepEqual(simpleCommands("C:\\Users\\lhotak\\strom.cmd login"), [["C:\\Users\\lhotak\\strom.cmd", "login"]]);
  assert.deepEqual(simpleCommands("echo Lhota\u0301k"), [["echo", "Lhoták"]], "NFC");
});

test("the tree's instructions and the guide: of a browser strom does not recommend, the agent says whether strom watches it — the built-in browser it watches (N2)", opts, async () => {
  const w = new World();
  await w.withTree();
  const flat = (t: string) => t.replace(/\s+/gu, " ");
  const agents = flat(fs.readFileSync(path.join(w.cwd, "AGENTS.md"), "utf8"));
  assert.match(agents, /those built-in browsers neither/);
  assert.match(agents, /say in one sentence whether strom watches that way/);
  assert.doesNotMatch(agents, /that strom does not watch that way/);
  const guide = flat((await w.ok(["guide"])).out);
  assert.match(guide, /whether strom watches that way/);
  assert.doesNotMatch(guide, /that strom does not watch that way/);
  w.cleanup();
});
