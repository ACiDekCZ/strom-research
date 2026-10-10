// The agent working alone without the user's personal add-ons (agent.addons, P1): strom run and the readers start
// Claude Code with --strict-mcp-config, the tools strom uses and no auto-memory, Codex with its plugins, apps, hooks
// and memories off; a conversation keeps everything; the other agents are started as always.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { World, fakeConnector, hasGit, readJsonFile } from "../helpers.ts";
import { claudeArgs, cleanTools, headlessEnv, missingTools, READER_TOOLS, RUN_DISALLOWED, RUN_TOOLS } from "../../src/runners/claude.ts";
import { CODEX_CLEAN, codexArgs, codexResumeArgs } from "../../src/runners/codex.ts";
import { GROK_CLEAN, grokArgs, grokEnv } from "../../src/runners/grok.ts";
import { opencodeArgs } from "../../src/runners/opencode.ts";
import { antigravityArgs } from "../../src/runners/antigravity.ts";
import { conversationArgs, conversationEnv } from "../../src/agents/launch.ts";

const unix = { skip: !hasGit || process.platform === "win32" };
/** Working alone: nothing that waits for a person (a question, the browser's pairing request). */
const NO_WAIT = ["--disallowedTools", "AskUserQuestion,mcp__claude-in-chrome__switch_browser"];
const fixtures = path.join(import.meta.dirname, "..", "fixtures", "images");

test("Claude Code working alone: no MCP servers of the user's, the tools strom uses, no auto-memory; a conversation keeps all", () => {
  const run = claudeArgs({ kickoff: "k", clean: true, chrome: true, settingsFile: "/t/.claude/settings.json" });
  assert.deepEqual(run.slice(-6), ["--chrome", "--strict-mcp-config", "--tools", "Bash,Read,Edit,Write,WebFetch,WebSearch,Agent,ToolSearch,SendMessage", ...NO_WAIT]);
  // the browser's tools load through ToolSearch (else every schema would be in the prompt); subagents and asking one again
  for (const t of ["Bash", "Read", "Edit", "Write", "WebFetch", "WebSearch", "Agent", "ToolSearch", "SendMessage"]) assert.ok(RUN_TOOLS.includes(t as never), t);
  // nothing that drops the user's model, effort or login, or the tree's own instructions
  for (const no of ["--setting-sources", "--bare", "--safe-mode", "--disable-slash-commands", "--no-session-persistence"]) assert.ok(!run.includes(no), no);
  // Windows: its PowerShell too (the tree's rules allow strom there)
  assert.deepEqual(cleanTools(false, "win32").slice(-1), ["PowerShell"]);
  assert.deepEqual(cleanTools(false, "darwin"), [...RUN_TOOLS]);
  // a reader: its views and its report
  assert.deepEqual(claudeArgs({ kickoff: "k", clean: true, reader: true }).slice(-3), ["--strict-mcp-config", "--tools", "Read,Edit,Write"]);
  assert.deepEqual(cleanTools(true, "win32"), [...READER_TOOLS]);
  // agent.addons on: as before — and still nothing that waits for a person (its add-ons may bring the question tool)
  assert.deepEqual(claudeArgs({ kickoff: "k", chrome: false }), ["-p", "--output-format", "stream-json", "--verbose", "--permission-mode", "dontAsk", "--no-chrome", ...NO_WAIT]);
  assert.deepEqual([...RUN_DISALLOWED], ["AskUserQuestion", "mcp__claude-in-chrome__switch_browser"]);
  // a conversation asks as it likes: the person is there
  assert.ok(!claudeArgs({ interactive: true, kickoff: "k", chrome: true }).includes("--disallowedTools"));
  // a conversation (interactive) is never cleaned, whatever it is given
  assert.deepEqual(claudeArgs({ interactive: true, kickoff: "k", clean: true, reader: true }), ["k", "--permission-mode", "auto"]);
  for (const agent of ["claude", "codex"]) {
    const chat = conversationArgs(agent, { kickoff: "k", level: "auto", settingsFile: "/t/.claude/settings.json", root: "/t", chrome: true });
    assert.ok(!chat.some((a) => a === "--strict-mcp-config" || a === "--tools" || a.startsWith("features.")), chat.join(" "));
  }
  // the environment: no memory of the user's when clean; a reader's prompt cached for 5 minutes always
  const clean = headlessEnv({ HOME: "x" }, undefined, { clean: true });
  assert.equal(clean.CLAUDE_CODE_DISABLE_AUTO_MEMORY, "1");
  assert.equal(clean.CLAUDE_CODE_PROMPT_CACHE_TTL, undefined);
  const plain = headlessEnv({ HOME: "x" }, undefined);
  assert.equal(plain.CLAUDE_CODE_DISABLE_AUTO_MEMORY, undefined);
  assert.equal(headlessEnv({}, undefined, { reader: true }).CLAUDE_CODE_PROMPT_CACHE_TTL, "5m");
  assert.equal(headlessEnv({}, undefined, { reader: true, clean: true }).CLAUDE_CODE_PROMPT_CACHE_TTL, "5m");
  // a name Claude Code does not know is dropped without a word: the init event's list is checked (Agent is Task there)
  assert.deepEqual(missingTools([...RUN_TOOLS], ["Task", "Bash", "Edit", "Read", "SendMessage", "ToolSearch", "WebFetch", "WebSearch", "Write"]), []);
  assert.deepEqual(missingTools([...RUN_TOOLS], ["Agent", "Bash", "Read", "Edit", "Write"]), ["WebFetch", "WebSearch", "ToolSearch", "SendMessage"]);
  assert.deepEqual(missingTools(cleanTools(false, "win32"), ["Task", "PowerShell", "Read", "Edit", "Write", "WebFetch", "WebSearch", "ToolSearch", "SendMessage"]), [], "PowerShell in Bash's place");
  assert.deepEqual(missingTools([...READER_TOOLS], ["Read", "Write"]), ["Edit"]);
});

test("Codex working alone: its plugins, apps, hooks and memories off — the user's config, model and login kept; resumed the same", () => {
  const base = { cwd: "/t", shared: "/s", model: "gpt-5" };
  const clean = codexArgs({ ...base, clean: true });
  const plain = codexArgs(base);
  assert.deepEqual(clean.filter((a) => !plain.includes(a) || a === "-c").filter((a) => a !== "-c"), ["features.plugins=false", "features.apps=false", "features.hooks=false", "features.memories=false"]);
  assert.ok(!clean.includes("--ignore-user-config"));
  assert.deepEqual(clean.slice(-3), ["--model", "gpt-5", "-"]);
  const resumed = codexResumeArgs("abc", { ...base, clean: true });
  assert.deepEqual(resumed.slice(-(CODEX_CLEAN.length + 4)), [...CODEX_CLEAN, "--model", "gpt-5", "abc", "-"]);
  assert.ok(!codexResumeArgs("abc", base).some((a) => a.startsWith("features.")));
});

test("Grok has switches for a part only — what it takes in of the other agents and its memory, never its own skills; OpenCode and Antigravity none: started as always", () => {
  // (its environment for one process: Claude Code's and Cursor's skills, MCP servers, hooks off, its memory off)
  const env = grokEnv({ HOME: "/h" }, 60_000, false, true)!;
  for (const k of ["GROK_CLAUDE_SKILLS_ENABLED", "GROK_CURSOR_SKILLS_ENABLED", "GROK_CLAUDE_MCPS_ENABLED", "GROK_CURSOR_MCPS_ENABLED", "GROK_CLAUDE_HOOKS_ENABLED", "GROK_CURSOR_HOOKS_ENABLED", "GROK_MEMORY"]) assert.equal(env[k], "0", k);
  assert.deepEqual(JSON.parse(env.GROK_CONFIG!), { toolset: { bash: { timeout_secs: 1800, max_timeout_secs: 1800, auto_background_on_timeout: false } } }, "its overlay drops a [skills] table: nothing put there");
  const dirty = grokEnv({ HOME: "/h" }, 60_000, false, false)!;
  assert.ok(Object.keys(GROK_CLEAN).every((k) => dirty[k] === undefined), "with the add-ons: as in a conversation");
  // an isolated installation: never the skill another installation taught Claude Code, a conversation too
  assert.equal(grokEnv({ HOME: "/h", STROM_ISOLATED: "1" }, 60_000, false, false)!.GROK_CLAUDE_SKILLS_ENABLED, "0");
  assert.deepEqual(conversationEnv("grok", { HOME: "/h", STROM_ISOLATED: "1" }), { GROK_FOLDER_TRUST: "0", GROK_CLAUDE_SKILLS_ENABLED: "0" });
  assert.deepEqual(conversationEnv("grok", { HOME: "/h" }), {});
  const o = { model: "m", kickoff: "k", shared: "/s", timeoutMs: 60_000 };
  assert.deepEqual(grokArgs({ ...o, clean: true } as never, ["--prompt-file", "p"], ["--session-id", "x"]), grokArgs(o, ["--prompt-file", "p"], ["--session-id", "x"]));
  // (a reader only without --trust: it reads no folder's files — test/cli/agent-globals.test.ts)
  assert.deepEqual(grokArgs({ ...o, clean: true, reader: true } as never, ["--prompt-file", "p"], ["--session-id", "x"]), grokArgs(o, ["--prompt-file", "p"], ["--session-id", "x"]).filter((a) => a !== "--trust"));
  assert.deepEqual(opencodeArgs({ ...o, clean: true, reader: true } as never), opencodeArgs(o));
  assert.deepEqual(antigravityArgs({ ...o, clean: true, reader: true } as never, "k"), antigravityArgs(o, "k"));
});

/** A tree, and Claude Code as a fake that notes how it was started and says its tools (WebFetch… left out). */
async function world(): Promise<World> {
  const w = new World();
  const bin = path.join(w.dir, "bin");
  fs.mkdirSync(bin);
  const git = spawnSync("which", ["git"], { encoding: "utf8" }).stdout.trim();
  if (git) fs.symlinkSync(git, path.join(bin, "git"));
  const calls = path.join(w.dir, "claude.calls");
  fs.writeFileSync(
    path.join(bin, "claude"),
    `#!/bin/sh
{ printf 'ARGS'; for a in "$@"; do printf ' [%s]' "$a"; done; printf '\\n'; echo "MEM=\${CLAUDE_CODE_DISABLE_AUTO_MEMORY:-} TTL=\${CLAUDE_CODE_PROMPT_CACHE_TTL:-} CC=\${CLAUDECODE:-}"; } >> "${calls}"
cat > /dev/null
echo '{"type":"system","subtype":"init","model":"m","tools":["Task","Bash","Read","Edit","Write"]}'
echo '{"type":"result","result":"done","total_cost_usd":0,"num_turns":1}'
`,
    { mode: 0o755 },
  );
  w.env.PATH = `${bin}${path.delimiter}${path.dirname(process.execPath)}`;
  await w.withTree();
  return w;
}

/** How the fake was started, call by call: its arguments and the variables that matter. */
function calls(w: World): { args: string; env: string }[] {
  const lines = fs.readFileSync(path.join(w.dir, "claude.calls"), "utf8").trim().split("\n");
  const out = [];
  for (let i = 0; i < lines.length; i += 2) out.push({ args: lines[i]!, env: lines[i + 1]! });
  fs.rmSync(path.join(w.dir, "claude.calls"));
  return out;
}

test("strom run and strom read: clean by default, with the add-ons once the user (only the user) says so — per tree too", unix, async () => {
  const w = await world();
  await w.ok(["research", "new", "Předci", "--new-person", "Jan /Novák/"]);
  await w.ok(["task", "add", "Křest", "--level", "locate", "--where", "Kamenice", "--why", "a", "--done-when", "b", "--about", "P1"]);
  const run = await w.run(["run", "--agent", "claude"]);
  let c = calls(w);
  assert.equal(c.length, 1, run.out + run.err);
  assert.match(c[0]!.args, /\[--strict-mcp-config\] \[--tools\] \[Bash,Read,Edit,Write,WebFetch,WebSearch,Agent,ToolSearch,SendMessage\]/);
  assert.match(c[0]!.env, /^MEM=1 TTL= /);
  // the init event said fewer tools than asked: said, the session went on
  assert.match(run.out + run.err, /Claude Code did not load WebFetch, WebSearch, ToolSearch, SendMessage/);

  // an agent may not turn the add-ons on (a run nobody watches would have the person's mail, documents…); off it may
  w.env.CLAUDECODE = "1";
  const refused = await w.run(["config", "set", "agent.addons", "on"]);
  assert.equal(refused.code, 4, refused.out + refused.err);
  assert.match(refused.err + refused.out, /an agent cannot answer this/);
  assert.equal((await w.run(["config", "set", "agent.addons", "on", "--for-tree"])).code, 4, "nor for the tree");
  await w.ok(["config", "set", "agent.addons", "off"]);
  delete w.env.CLAUDECODE;

  // the person, for this tree: the run as before
  await w.ok(["config", "set", "agent.addons", "on", "--for-tree"], { tty: true });
  assert.equal(readJsonFile(path.join(w.cwd, "strom.json")).agentAddons, "on");
  await w.ok(["task", "add", "Oddavky", "--level", "locate", "--where", "Kamenice", "--why", "a", "--done-when", "b", "--about", "P1"]);
  await w.run(["run", "--agent", "claude"]);
  c = calls(w);
  assert.equal(c.length, 1);
  assert.doesNotMatch(c[0]!.args, /strict-mcp-config|--tools/);
  assert.match(c[0]!.env, /^MEM= TTL= /);
  await w.ok(["config", "unset", "agent.addons", "--for-tree"]);

  // a reader: its own tools, a short cache, never the marks of the agent that ran strom read
  const scans = path.join(w.dir, "scans");
  fs.mkdirSync(scans);
  for (const f of ["s0001.jpg", "s0002.jpg"]) fs.copyFileSync(path.join(fixtures, f), path.join(scans, f));
  await w.ok(["recordset", "add", "Kniha N 1847-1868", "--kinds", "baptism", "--places", "Kamenice", "--years", "1847-1868"]);
  await w.ok(["media", "add", scans, "--recordset", "B1"]);
  w.env.CLAUDECODE = "1";
  const read = await w.run(["read", "B1", "--images", "1-2", "--question", "Křty Nováků", "--agent", "claude"]);
  delete w.env.CLAUDECODE;
  c = calls(w);
  assert.equal(c.length, 1, read.out + read.err);
  assert.match(c[0]!.args, /\[--strict-mcp-config\] \[--tools\] \[Read,Edit,Write\]/);
  assert.equal(c[0]!.env, "MEM=1 TTL=5m CC=");
  // with the add-ons (the person's word): the reader keeps its short cache
  await w.ok(["config", "set", "agent.addons", "on"], { tty: true });
  await w.run(["read", "B1", "--images", "1-2", "--question", "Křty Nováků", "--agent", "claude"]);
  c = calls(w);
  assert.doesNotMatch(c[0]!.args, /strict-mcp-config|--tools/);
  assert.equal(c[0]!.env, "MEM= TTL=5m CC=");
  w.cleanup();
});

test("the menu's settings: the agent working alone — without the personal add-ons, on by default; Enter keeps it", unix, async () => {
  const w = await world();
  // 8 settings · 2 working alone · 4 the add-ons · Enter keeps · 0 · 0 · 0
  const keep = await w.ok([], { tty: true, answers: ["8", "2", "3", "", "0", "0", "0"] });
  assert.match(keep.out, /3 {2}Bez osobních doplňků agenta \(skilly, pluginy, MCP servery\): zapnuto/);
  assert.match(keep.out, /Agent při samostatné práci načte jen nástroje výzkumu\. Spojení s aplikací Strom a prohlížeč fungují dál\. Chat s agentem doplňky načítá vždy\./);
  assert.equal(readJsonFile(path.join(w.env.STROM_CONFIG_DIR!, "config.json")).agentAddons, undefined);
  const off = await w.ok([], { tty: true, answers: ["8", "2", "3", "ano", "0", "0", "0"] });
  assert.match(off.out, /Vypnout\? \(agent při samostatné práci pak načte i osobní doplňky\)/);
  assert.equal(readJsonFile(path.join(w.env.STROM_CONFIG_DIR!, "config.json")).agentAddons, "on");
  assert.match((await w.ok([], { tty: true, answers: ["8", "2", "0", "0", "0"] })).out, /MCP servery\): vypnuto/);
  // an agent without such a switch: not offered
  await w.ok(["config", "set", "agent", "grok", "--for-tree"]);
  assert.doesNotMatch((await w.ok([], { tty: true, answers: ["8", "2", "0", "0", "0"] })).out, /doplňků/);
  w.cleanup();
});

test("the setup wizard asks it for Claude Code and Codex, the suggested answer without the add-ons", unix, async () => {
  const w = await world();
  const cfg = () => readJsonFile(path.join(w.env.STROM_CONFIG_DIR!, "config.json"));
  // run again: language, folder, model, its effort (0), stories, level kept (Enter) · the add-ons: 2 (with them) · no shortcut
  const r = await w.ok(["setup"], { tty: true, answers: ["", "", "", "0", "", "", "2", "n"] });
  assert.match(r.out, /Bez osobních doplňků agenta \(skilly, pluginy, MCP servery\)\?\nAgent při samostatné práci načte jen nástroje výzkumu\.[^\n]*\n {3}1 {2}Ano \(doporučeno\)\n {3}2 {2}Ne – i při samostatné práci s doplňky\n {3}0 {2}Nechat, jak je\nVybrat \[1\]/);
  assert.equal(cfg().agentAddons, "on");
  // again: what is now suggested; Enter keeps it
  const again = await w.ok(["setup"], { tty: true, answers: ["", "", "", "0", "", "", "", "n"] });
  assert.match(again.out, /Nechat, jak je\nVybrat \[2\]/);
  assert.equal(cfg().agentAddons, "on");
  w.cleanup();
});

test("strom config get agent.addons: off by default, said as the other settings with a default say theirs", unix, async () => {
  const w = new World();
  await w.withTree();
  assert.equal((await w.ok(["config", "get", "agent.addons"])).out.trim(), "off");
  assert.deepEqual((await w.ok(["config", "get", "agent.addons", "--json"])).json, { key: "agent.addons", value: "off", source: "default" });
  assert.match((await w.ok(["config", "where"])).out, /^agent\.addons +off +default/m);
  await w.ok(["config", "set", "agent.addons", "on", "--for-tree"], { tty: true });
  assert.deepEqual((await w.ok(["config", "get", "agent.addons", "--json"])).json, { key: "agent.addons", value: "on", source: "tree" });
  await w.ok(["config", "unset", "agent.addons", "--for-tree"]);
  assert.equal((await w.ok(["config", "get", "agent.addons"])).out.trim(), "off");
  w.cleanup();
});

test("the browser in a run: only for a session whose task may need it — never a story, a letter, a book served directly, a reader", unix, async () => {
  const w = await world();
  // an archive through the browser and one served directly (the plugins folder is every tree's)
  const dir = await fakeConnector(w, "prohlizec");
  const m = readJsonFile(path.join(dir, "connector.json"));
  fs.writeFileSync(path.join(dir, "connector.json"), JSON.stringify({ ...m, can: [...m.can, "locate"], routes: ["browser"] }));
  await fakeConnector(w, "primo", "https://direct.example.net");
  await w.ok(["research", "new", "Předci", "--new-person", "Jan /Novák/"]);
  await w.ok(["repo", "add", "Archiv Žďár", "--url", "https://archive.example.org/"]); // R1
  await w.ok(["recordset", "add", "Kniha Ä 1801–1820", "--repo", "R1"]); // B1: through the browser
  await w.ok(["recordset", "add", "Книга Б 1821–1840", "--url", "https://direct.example.net/kniha/2"]); // B2: directly
  await w.ok(["recordset", "add", "Kniha C 1841–1860"]); // B3: its archive not known
  const add = (what: string, level: string, where: string) =>
    w.ok(["task", "add", what, "--level", level, "--where", where, "--why", "rodiče", "--done-when", "zápis nalezen", "--about", "P1", "--anyway"]);
  await add("Křest Jana (B1)", "link", "B1"); // T1
  await add("Křest Jana (B2)", "link", "B2"); // T2
  await add("Vyprávění: Jan Novák", "narrate", "zapsané údaje"); // T3
  await add("Kde jsou matriky Kamenice", "locate", "katalog archivu"); // T4
  await add("Křest Jana (B3)", "link", "B3"); // T5
  await add("Dopis archivu", "request", "B1"); // T6
  const run = await w.run(["run", "--agent", "claude", "--task", "T1,T2,T3,T4,T5,T6", "--max", "6"]);
  const flags = calls(w).map((c) => /\[--(no-)?chrome\]/.exec(c.args)?.[0]);
  assert.deepEqual(flags, ["[--chrome]", "[--no-chrome]", "[--no-chrome]", "[--chrome]", "[--chrome]", "[--no-chrome]"], run.out + run.err);
  // the brief of a session with the browser says how it is used — its sites, without asking, gently, a browser picked
  // without a person; one without it says nothing of a browser (no tokens for it)
  const briefs = new Map(
    fs.readdirSync(path.join(w.cwd, ".strom", "briefs")).map((f) => {
      const text = fs.readFileSync(path.join(w.cwd, ".strom", "briefs", f), "utf8");
      return [/^## Task (T\d+)/m.exec(text)![1]!, text] as const;
    }),
  );
  for (const [id, on] of [["T0001", true], ["T0002", false], ["T0003", false], ["T0004", true], ["T0005", true], ["T0006", false]] as const) {
    const text = briefs.get(id)!;
    assert.equal(/## The browser \(Claude in Chrome\)/.test(text), on, `${id}:\n${text}`);
    assert.equal(/AskUserQuestion|select_browser/.test(text), on, id);
    // every run: what only the user can decide waits for them as a task, never a question in the summary
    assert.match(text, new RegExp(`strom task wait ${id} --on "<the question, impersonal, in the research language>" — they see it in the menu and the Strom app`));
  }
  const browser = briefs.get("T0004")!;
  assert.match(browser, /Its sites: archive\.example\.org — no other\./);
  assert.match(browser, /Use it without asking where a connector \(strom fetch\), WebFetch and WebSearch lead nowhere; images only through strom fetch/);
  assert.match(browser, /terms and robots\.txt, its pace and hourly cap .*only the pages the task needs, nothing ahead/);
  assert.match(browser, /forbids automated access: never through the browser, never a way round/);
  assert.match(browser, /no AskUserQuestion, no switch_browser\. Several browsers connected, none selected: list_connected_browsers, then select_browser — onThisComputer, else isLocal\.\n/);
  // never "the first" of other computers' browsers in a run: somebody may be working there — the person is asked
  assert.match(browser, /- Neither: those browsers are another computer's, somebody may be working there — no browser: strom task wait T0004 --on "<the question, in the research language: no browser of this computer is connected>", then close the session\./);
  assert.doesNotMatch(browser, /else the first/);
  assert.match(browser, /an archive the task needs without a connector — build one \(strom connector new\); anything else — strom task wait T0004 --on "<the question>"/);
  assert.ok(!briefs.get("T0002")!.includes("archive.example.org"), "a book served directly: nothing of the browser");
  // a conversation of Claude Code with the browser: the same rules, and another site is asked about — the person is there;
  // another agent has no browser tools, its brief says nothing of them
  w.env.CLAUDECODE = "1";
  const talk = (await w.ok(["session", "start", "T2"])).out;
  delete w.env.CLAUDECODE;
  assert.match(talk, /## The browser \(Claude in Chrome\)\nIts sites: archive\.example\.org — no other\./);
  assert.match(talk, /- Another site, or one that forbids automation: ask the user first\./);
  // a conversation: the person picks the browser, the one of this computer suggested first
  assert.match(talk, /- Several browsers connected, none selected: list_connected_browsers, ask the user which — onThisComputer, else isLocal, else the first suggested —, then select_browser\./);
  assert.doesNotMatch(talk, /Neither: those browsers/);
  assert.doesNotMatch(talk, /AskUserQuestion|Nobody answers|strom task wait T0002 --on "<the question/);
  await w.ok(["session", "close", "--continue", "--summary", "s", "--next", "n"]);
  w.env.CODEX_THREAD_ID = "x";
  const codex = (await w.ok(["session", "start", "T2"])).out;
  delete w.env.CODEX_THREAD_ID;
  assert.doesNotMatch(codex, /## The browser/);
  await w.ok(["session", "close", "--continue", "--summary", "s", "--next", "n"]);
  // agent.browser always (the person's choice): every session
  await w.ok(["config", "set", "agent.browser", "always"], { tty: true, answers: ["a"] });
  await w.run(["run", "--agent", "claude", "--task", "T2,T3", "--max", "2"]);
  assert.deepEqual(calls(w).map((c) => /\[--(no-)?chrome\]/.exec(c.args)?.[0]), ["[--chrome]", "[--chrome]"]);
  // a reader never, whatever it is given
  assert.ok(claudeArgs({ kickoff: "k", reader: true, chrome: true }).includes("--no-chrome"));
  assert.ok(!claudeArgs({ kickoff: "k", reader: true, chrome: true }).includes("--chrome"));
  w.cleanup();
});
