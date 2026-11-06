// Codex's browser kept like Claude in Chrome (core/codexhook.ts, spec 062 K3.2): the tree's .codex/hooks.json runs
// `strom net web --hook` before Codex's node_repl `js` — the tool its desktop app's browser works through. An address its
// code names is a navigate of the browser: an archive without the person's permission refused with the same advice as
// Claude's. Code that names no address strom can see is never refused — written down as unwatched, the agent told once.
// Computer use is neither watched nor recorded. strom never confirms the hooks for the person (K3.3): Codex keeps a hash
// of each hook the person confirmed, strom only reads whether it matches.

import { after, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit, readJsonFile } from "../helpers.ts";
import { testHooks } from "../../src/core/net.ts";
import { grantWay } from "../../src/core/terms.ts";
import { CODEX_BROWSER_TOOL, CODEX_HOOK_MATCHER, CODEX_HOOKS, UNWATCHED, codeUrls, codexEvent, codexHookHash, codexHookState, codexHooks, computerUseOnly } from "../../src/core/codexhook.ts";

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
const PORT = 47322;

function terms(w: World, archives: Record<string, unknown>[]): void {
  const file = path.join(w.dir, "archives-test.json");
  fs.writeFileSync(file, JSON.stringify({ archives }));
  w.env.STROM_ARCHIVES_FILE = file;
}

/** Codex's PreToolUse of its node_repl `js` (the shape of its hook input). */
const js = (w: World, code: string, o: { use?: string; sid?: string; title?: string } = {}) =>
  JSON.stringify({
    session_id: o.sid ?? "codex-1",
    transcript_path: null,
    cwd: w.cwd,
    hook_event_name: "PreToolUse",
    model: "gpt-test",
    permission_mode: "default",
    turn_id: "t1",
    tool_name: CODEX_BROWSER_TOOL,
    tool_input: { code, title: o.title ?? "Open a page", timeout_ms: 30000 },
    tool_use_id: o.use ?? "call-1",
  });

async function hook(w: World, stdin: string, env: Record<string, string> = {}) {
  const r = await w.run(["net", "web", "--hook"], { stdin, env });
  assert.equal(r.code, 0, `the hook never fails: ${r.err}`);
  const out = r.out.trim();
  const j = out ? (JSON.parse(out) as { hookSpecificOutput: { hookEventName?: string; permissionDecision?: string; permissionDecisionReason?: string; additionalContext?: string } }).hookSpecificOutput : undefined;
  return { out, decision: j?.permissionDecision ?? "allow", reason: j?.permissionDecisionReason ?? "", context: j?.additionalContext ?? "", event: j?.hookEventName };
}

const unwatched = (w: World) => {
  const f = path.join(w.cwd, ".strom", "metrics", UNWATCHED);
  return fs.existsSync(f) ? fs.readFileSync(f, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l) as Record<string, unknown>) : [];
};

test("Codex's hook input read: its node_repl js before it runs, with its code; any other tool, event or shape not Codex's", () => {
  const w = { cwd: "/tree" } as World;
  const ev = codexEvent(js(w, 'await tab.goto("https://example.org/")', { use: "u1" }));
  assert.deepEqual(ev, { tool: CODEX_BROWSER_TOOL, code: 'await tab.goto("https://example.org/")', title: "Open a page", agentSession: "codex-1", toolUse: "u1", cwd: "/tree" });
  assert.equal(codexEvent(JSON.stringify({ tool_name: "Bash", tool_input: { command: "ls" } })), undefined);
  assert.equal(codexEvent(JSON.stringify({ tool_name: CODEX_BROWSER_TOOL, hook_event_name: "PostToolUse", tool_input: { code: "x" } })), undefined);
  assert.equal(codexEvent(JSON.stringify({ tool_name: CODEX_BROWSER_TOOL, tool_input: {} })), undefined);
  assert.equal(codexEvent("not json"), undefined);
  // the addresses of a script: each once, any script, punctuation after it left out
  assert.deepEqual(codeUrls('goto("https://lhota.example.org/kniha/1"); x="https://lhota.example.org/kniha/1", y=`http://hřbitov.example.cz/a`.'), ["https://lhota.example.org/kniha/1", "http://hřbitov.example.cz/a"]);
  assert.deepEqual(codeUrls("xhttps://glued.example.org/"), [], "glued to a word: not an address of its own");
  // computer use (its sky.* calls) alone: not the browser
  assert.ok(computerUseOnly('await sky.click({ x: 1, y: 2 })'));
  assert.ok(!computerUseOnly('await sky.click({ x: 1, y: 2 }); await tab.goto("https://example.org/")'));
});

test("the tree's .codex/hooks.json: strom's hook before Codex's node_repl js, the tree's own strom; Codex's hash of it; nothing confirmed by strom", opts, async () => {
  const w = new World();
  await w.withTree();
  const file = readJsonFile(path.join(w.cwd, CODEX_HOOKS)) as { hooks: { PreToolUse: { matcher: string; hooks: { type: string; command: string; timeout: number }[] }[] } };
  const [group] = file.hooks.PreToolUse;
  assert.equal(group!.matcher, CODEX_HOOK_MATCHER);
  assert.ok(new RegExp(CODEX_HOOK_MATCHER).test(CODEX_BROWSER_TOOL) && !new RegExp(CODEX_HOOK_MATCHER).test("mcp__cua_repl__js"), "the browser's tool, never computer use's");
  assert.match(group!.hooks[0]!.command, /\.strom\/bin\/strom' net web --hook \|\| true$/);
  assert.equal(Object.keys(file).join(), "description,hooks", "nothing Codex does not know (it refuses unknown fields)");
  // Windows: cmd.exe runs the shim whose exit is always 0
  const win = codexHooks("C:\\Rodokmen", "win32") as { hooks: { PreToolUse: { hooks: { command: string }[] }[] } };
  assert.equal(win.hooks.PreToolUse[0]!.hooks[0]!.command, '"C:\\Rodokmen\\.strom\\bin\\strom-hook.cmd" net web --hook');
  // Codex's hash: SHA-256 of the sorted JSON of the declaration (codex-rs discovery.rs hook_hash)
  const command = `'/r/.strom/bin/strom' net web --hook || true`;
  const crypto = await import("node:crypto");
  const expected = crypto.createHash("sha256").update(`{"event_name":"pre_tool_use","hooks":[{"async":false,"command":${JSON.stringify(command)},"timeout":60,"type":"command"}],"matcher":"^mcp__node_repl__js$"}`).digest("hex");
  assert.equal(codexHookHash("/r", "darwin"), `sha256:${expected}`);
  // nothing of the person's Codex settings written
  assert.ok(!fs.existsSync(path.join(w.home, ".codex", "config.toml")));
  w.cleanup();
});

test("whether Codex runs strom's hook: read from its config.toml — the folder trusted, the hook confirmed as it is, changed since, turned off", opts, async () => {
  const w = new World();
  await w.withTree();
  const codexHome = path.join(w.dir, "codex-home");
  fs.mkdirSync(codexHome, { recursive: true });
  const env = { ...w.env, CODEX_HOME: codexHome };
  const config = (text: string) => fs.writeFileSync(path.join(codexHome, "config.toml"), text);
  const key = `${path.join(w.cwd, CODEX_HOOKS)}:pre_tool_use:0:0`;
  const project = `[projects.${JSON.stringify(w.cwd)}]\ntrust_level = "trusted"\n`;
  assert.equal(codexHookState(w.cwd, env), "folder", "no config: the folder not trusted yet");
  config(project);
  assert.equal(codexHookState(w.cwd, env), "untrusted");
  config(`${project}\n[hooks.state.${JSON.stringify(key)}]\ntrusted_hash = "${codexHookHash(w.cwd)}"\n`);
  assert.equal(codexHookState(w.cwd, env), "trusted");
  config(`${project}\n[hooks.state]\n${JSON.stringify(key)} = { trusted_hash = "sha256:00", enabled = true }\n`);
  assert.equal(codexHookState(w.cwd, env), "modified", "confirmed before, changed since: Codex skips it until confirmed again");
  config(`${project}\n[hooks.state.${JSON.stringify(key)}]\nenabled = false\n`);
  assert.equal(codexHookState(w.cwd, env), "disabled");
  config(`[features]\nhooks = false\n${project}`);
  assert.equal(codexHookState(w.cwd, env), "off");
  config(`[projects.${JSON.stringify(w.cwd)}]\ntrust_level = "untrusted"\n`);
  assert.equal(codexHookState(w.cwd, env), "folder");
  fs.rmSync(path.join(w.cwd, CODEX_HOOKS));
  assert.equal(codexHookState(w.cwd, env), "missing");

  // strom doctor: the row with the state and what to do — never confirmed for the person
  config(project);
  fs.mkdirSync(path.join(w.dir, "bin-codex"), { recursive: true });
  const fake = path.join(w.dir, "bin-codex", process.platform === "win32" ? "codex.cmd" : "codex");
  fs.writeFileSync(fake, process.platform === "win32" ? "@echo off\r\n" : "#!/bin/sh\nexit 0\n", { mode: 0o755 });
  const docEnv = { CODEX_HOME: codexHome, PATH: `${path.dirname(fake)}${path.delimiter}${w.env.PATH ?? process.env.PATH}` };
  const missing = ((await w.run(["doctor", "--json"], { env: docEnv })).json.checks as { name: string; status: string; detail: string; fix?: string; code?: string }[]).find((c) => c.name === "codexhooks");
  assert.deepEqual([missing?.status, missing?.code, missing?.fix], ["warn", "codex.hooks.missing", "strom agents sync"]);
  fs.writeFileSync(path.join(w.cwd, CODEX_HOOKS), JSON.stringify(codexHooks(w.cwd), null, 2) + "\n");
  const all = (await w.run(["doctor", "--json"], { env: { ...docEnv, STROM_LANG: "cs" } })).json.checks as { name: string; status: string; detail: string; fix?: string; code?: string }[];
  const row = all.find((c) => c.name === "codexhooks")!;
  assert.deepEqual([row.status, row.code], ["warn", "codex.hooks.untrusted"]);
  assert.match(row.detail, /čekají na potvrzení v Codexu/);
  assert.match(row.fix ?? "", /Hooks .*Trust.*strom doc R12\.5/);
  assert.doesNotMatch(row.detail + row.fix, /(?<![\p{L}])(?:vy|váš|vaše|ty|tvůj)(?![\p{L}])/iu, "impersonal");
  config(`${project}\n[hooks.state.${JSON.stringify(key)}]\ntrusted_hash = "${codexHookHash(w.cwd)}"\n`);
  const ok = ((await w.run(["doctor", "--json"], { env: docEnv })).json.checks as { name: string; status: string; code?: string }[]).find((c) => c.name === "codexhooks");
  assert.deepEqual([ok?.status, ok?.code], ["ok", "codex.hooks.trusted"]);
  w.cleanup();
});

test("Codex's browser: an archive's address without the person's permission refused with Claude's advice; with it at a person's pace; a closed archive and the bridge refused", opts, async () => {
  const w = new World();
  await w.withTree();
  terms(w, [
    { host: "browser.example.org", level: "restricted", browserOnly: true, quoteFrom: "robots", terms: "https://browser.example.org/robots.txt", quote: "User-agent: * / Disallow: /" },
    { host: "closed.example.org", level: "forbidden", name: "Zavřený archiv", terms: "https://closed.example.org/terms" },
  ]);
  const env = { STROM_TEST_HUMAN_PACE_MS: "7000" };
  const no = await hook(w, js(w, 'const tab = await browser.tabs.new(); await tab.goto("https://browser.example.org/book/1");', { use: "p1" }), env);
  assert.equal(no.decision, "deny");
  assert.match(no.reason, /only through a person's browser, and the person has not allowed it "through the browser" \(strom allow archive browser\.example\.org --way browser — the person's, never yours\)/);
  assert.match(no.reason, /strom task wait/);
  const closed = await hook(w, js(w, 'await tab.goto("https://closed.example.org/catalog")', { use: "c1" }));
  assert.equal(closed.decision, "deny");
  assert.match(closed.reason, /allow no automated access/);
  const journal = fs.readFileSync(path.join(w.cwd, ".strom", "metrics", "fetch.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l) as Record<string, unknown>);
  assert.deepEqual([journal.at(-1)!.tool, journal.at(-1)!.agent, journal.at(-1)!.decision], [CODEX_BROWSER_TOOL, "codex", "deny"]);

  assert.ok(grantWay(w.env, ["browser.example.org"], "browser", { by: "terminal" }), "the person's permission");
  assert.equal((await hook(w, js(w, 'await tab.goto("https://browser.example.org/book/1")', { use: "p2" }), env)).out, "");
  assert.equal((await hook(w, js(w, 'await tab.goto("https://browser.example.org/book/2")', { use: "p3" }), env)).out, "");
  const allowed = fs.readFileSync(path.join(w.cwd, ".strom", "metrics", "fetch.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l) as Record<string, any>).filter((r) => r.decision === "allow");
  assert.ok(allowed.at(-1)!.paceMs >= 6000, `a person's pace between two pages (${allowed.at(-1)!.paceMs} ms)`);
  // several pages of archives in one call: one at a time
  const many = await hook(w, js(w, 'await browser.tabs.content({ urls: ["https://browser.example.org/book/3", "https://browser.example.org/book/4"] })', { use: "m1" }), env);
  assert.equal(many.decision, "deny");
  assert.match(many.reason, /one page at a time/);
  // the bridge: its address or its secret
  fs.writeFileSync(path.join(w.cwd, ".strom", "live-last.json"), JSON.stringify({ port: PORT, token: TOKEN, pid: 999999, url: `http://127.0.0.1:${PORT}/${TOKEN}`, started: "2026-01-01T00:00:00.000Z" }));
  const bridge = await hook(w, js(w, `await fetch("http://127.0.0.1:${PORT}/${TOKEN}/status")`, { use: "b1" }));
  assert.equal(bridge.decision, "deny");
  assert.match(bridge.reason, /bridge/i);
  w.cleanup();
});

test("Codex's browser code with no address strom can see: never refused — written down as unwatched, the agent told once a session; computer use neither watched nor recorded", opts, async () => {
  const w = new World();
  await w.withTree();
  const first = await hook(w, js(w, 'const t = await browser.tabs.selected(); await t.playwright.click("text=Další")', { use: "u1" }));
  assert.equal(first.decision, "allow");
  assert.equal(first.event, "PreToolUse");
  assert.match(first.context, /names no address strom can see.*\(recorded as unwatched\)/);
  const second = await hook(w, js(w, 'await tab.playwright.click("text=Další")', { use: "u2" }));
  assert.equal(second.out, "", "told once in its session");
  const other = await hook(w, js(w, 'await tab.playwright.click("text=Další")', { use: "u3", sid: "codex-2" }));
  assert.match(other.context, /unwatched/, "another session told again");
  const rows = unwatched(w);
  assert.deepEqual(rows.map((r) => [r.agent, r.tool, r.agentSession, r.toolUse]), [["codex", CODEX_BROWSER_TOOL, "codex-1", "u1"], ["codex", CODEX_BROWSER_TOOL, "codex-1", "u2"], ["codex", CODEX_BROWSER_TOOL, "codex-2", "u3"]]);
  // computer use: nothing said, nothing written
  assert.equal((await hook(w, js(w, 'await sky.click({ x: 10, y: 20 }); await sky.type_text("Lhoták")', { use: "cu" }))).out, "");
  // a plain script without the browser: nothing
  assert.equal((await hook(w, js(w, "1 + 1", { use: "plain" }))).out, "");
  assert.equal(unwatched(w).length, 3);
  // strom net web says how many in the session
  const said = await w.run(["net", "web", "--session", "codex-1", "--json"]);
  assert.equal(said.code, 0, said.err);
  assert.equal(said.json.unwatched, 2);
  assert.match((await w.run(["net", "web", "--session", "codex-1"])).out, /2 browser calls with no address strom could see \(unwatched\)/);
  w.cleanup();
});
