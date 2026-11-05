// The agent's browser at an archive only a person's browser goes to (spec 048 story 5, 4 November 2026): only Claude
// Code's Claude in Chrome goes through strom's hook — any other agent's browser or computer use never, whatever the
// person allowed: the person saves the images by hand, and is told once that with Claude Code and the extension the
// agent would save them itself. Said by net web --check, strom fetch, task wait, the brief, strom doctor, strom's menu
// and the bridge's /status (feature browser.state). Codex's own browser and computer use (its desktop app's MCP
// servers in the person's config) are off with the person's add-ons. No request leaves this computer.

import { after, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, fakeConnector, hasGit, pluginDir, readJsonFile } from "../helpers.ts";
import { testHooks } from "../../src/core/net.ts";
import { grantWay } from "../../src/core/terms.ts";
import { browserState } from "../../src/core/browserhelp.ts";
import { CLAUDE_IN_CHROME_URL } from "../../src/core/browser.ts";
import { BRIDGE_FEATURES, status } from "../../src/core/live.ts";
import { codexArgs, codexBrowserOff, CODEX_CLEAN } from "../../src/runners/codex.ts";
import { codexConfig } from "../../src/agents/files.ts";
import { CODEX_BROWSER_SERVERS } from "../../src/core/browser.ts";
import type { Tree } from "../../src/core/tree.ts";

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

const BOOK = "https://www.mza.cz/actapublica/matrika/detail/1";
const codex = { STROM_IN_AGENT: "codex" };
const claude = { CLAUDECODE: "1" };

async function mzaTree(w: World): Promise<string> {
  const tree = await w.withTree("Lhotákovi");
  await w.ok(["research", "new", "X", "--new-person", "Jan /Lhoták/"]);
  await w.ok(["recordset", "add", "Lhota N 1784–1820", "--kinds", "baptism", "--places", "Lhota", "--years", "1784-1820", "--access", "online-free", "--url", BOOK]); // B1
  await w.ok(["task", "add", "Křest Jan", "--level", "link", "--where", "B1", "--why", "a", "--done-when", "b"]); // T1
  return tree;
}

type Check = { allow: boolean; why?: string; route?: string; reason: string };
const check = async (w: World, url: string, env: Record<string, string>, browser = true) =>
  JSON.parse((await w.run(["net", "web", "--check", url, ...(browser ? ["--browser"] : []), "--json"], { env })).out) as Check;

test("net web --check and strom fetch: Codex's browser never at an archive only a person's browser goes to, the person's permission or not — by hand, and once the word of Claude in Chrome; Claude Code's goes with the permission", opts, async () => {
  const w = new World();
  await mzaTree(w);
  try {
    grantWay(w.env, ["www.mza.cz"], "browser", { by: "terminal" });
    const c = await check(w, BOOK, codex);
    assert.equal(c.allow, false);
    assert.equal(c.why, "browser");
    assert.match(c.reason, /strom does not keep your browser or computer use/);
    assert.match(c.reason, /strom task wait T… --images B0001:<numbers>/);
    assert.match(c.reason, /strom agents use claude/);
    assert.doesNotMatch(c.reason, /--way browser/, "no permission that would not help this agent");
    // its web fetch: the same answer
    assert.match((await check(w, BOOK, codex, false)).reason, /strom does not keep your browser or computer use/);
    // Claude Code: through its browser, at a person's pace
    const k = await check(w, BOOK, { ...claude, STROM_TEST_HUMAN_PACE_MS: "1000" });
    assert.deepEqual([k.allow, k.route], [true, "browser"]);
    // a person (no agent): as before
    assert.equal((await check(w, BOOK, {})).allow, true);
    // an archive by hand only: no word of Claude in Chrome (it would not help there either)
    const e = await check(w, "https://ebadatelna.soapraha.cz/d/1234/5", codex);
    assert.equal(e.allow, false);
    assert.doesNotMatch(e.reason, /strom agents use claude/);

    // strom fetch with a downloader of the archive: refused, and the agent's browser never
    await fakeConnector(w, "mza", "", { automation: "restricted" });
    const file = path.join(pluginDir(w, "mza"), "connector.json");
    fs.writeFileSync(file, JSON.stringify({ ...readJsonFile(file), hosts: ["www.mza.cz"] }));
    const f = await w.run(["fetch", "mza", "5359", "--images", "1-2", "--recordset", "B1"], { env: codex });
    assert.notEqual(f.code, 0);
    assert.match(f.err + f.out, /strom task wait T… --images B…:1-2/);
    assert.match(f.err + f.out, /strom does not keep your browser or computer use/);
    assert.match(f.err + f.out, /strom agents use claude/);
    const g = await w.run(["fetch", "mza", "5359", "--images", "1-2", "--recordset", "B1"], { env: claude });
    assert.match(g.err + g.out, /through your browser \(Claude in Chrome\)|Claude in Chrome extension is in no browser here/);
  } finally {
    w.cleanup();
  }
});

test("task wait --images and the brief at such an archive: what the agent's own browser would do — said by agent", opts, async () => {
  const w = new World();
  await mzaTree(w);
  try {
    // Claude Code without the extension (none in this HOME): its address
    const b = (await w.ok(["brief", "T1"])).out;
    assert.match(b, /your browser: the Claude in Chrome extension is in no browser here/);
    assert.ok(b.includes(CLAUDE_IN_CHROME_URL));
    await w.ok(["config", "set", "agent", "codex"]);
    assert.match((await w.ok(["brief", "T1"])).out, /your browser: strom does not keep your browser or computer use/);
    const t = (await w.ok(["task", "wait", "T1", "--images", "B1:1-2", "--on", "Snímky 1–2 knihy Lhota N."], { env: codex })).out;
    assert.match(t, /its archive only through a person's browser — strom does not keep your browser or computer use/);
    assert.match(t, /strom agents use claude/);
  } finally {
    w.cleanup();
  }
});

test("strom doctor and the bridge's /status: the archives of the tree only a person's browser goes to, and the agent's browser here", opts, async () => {
  const w = new World();
  const tree = await mzaTree(w);
  try {
    const doc = async () => ((await w.run(["doctor", "--json"], { env: { STROM_LANG: "en" } })).json.checks as { name: string; status: string; detail: string; fix?: string }[]).filter((c) => c.name === "browser");
    let d = await doc();
    assert.ok(d.some((c) => c.status === "warn" && /only through a person's browser – with the Claude in Chrome extension/.test(c.detail) && c.fix === CLAUDE_IN_CHROME_URL), JSON.stringify(d));
    let s = status(tree, w.env) as { features: string[]; browser: { state: string; url?: string; archives: { host: string; permitted: boolean }[] } };
    assert.ok(s.features.includes("browser.state"));
    assert.ok(BRIDGE_FEATURES.includes("browser.state"));
    assert.equal(s.browser.state, "no-extension");
    assert.equal(s.browser.url, CLAUDE_IN_CHROME_URL);
    assert.deepEqual(s.browser.archives.map((a) => [a.host, a.permitted]), [["www.mza.cz", false]]);
    grantWay(w.env, ["www.mza.cz"], "browser", { by: "terminal" });
    s = status(tree, w.env) as typeof s;
    assert.deepEqual(s.browser.archives.map((a) => [a.host, a.permitted]), [["www.mza.cz", true]]);

    await w.ok(["config", "set", "agent", "codex"]);
    d = await doc();
    assert.ok(d.some((c) => c.status === "warn" && /with Claude Code and the Claude in Chrome extension the agent would save the images itself; with [^;]*Codex[^;]* they are saved by hand/.test(c.detail)), JSON.stringify(d));
    s = status(tree, w.env) as typeof s;
    assert.equal(s.browser.state, "agent-without-browser");
    assert.equal(s.browser.url, undefined);

    // in the research's language, impersonal
    const cs = ((await w.run(["doctor", "--json"], { env: { STROM_LANG: "cs" } })).json.checks as { name: string; detail: string }[]).filter((c) => c.name === "browser");
    assert.ok(cs.some((c) => /jen přes prohlížeč člověka – s Claude Code a rozšířením Claude in Chrome by snímky uložil agent sám/.test(c.detail)), JSON.stringify(cs));

    // the desktop apps' own browser and computer use: said off in a research, only Claude in Chrome watched (4 languages)
    for (const [lang, said] of [
      ["en", /built-in browser, preview and computer use of the Claude and ChatGPT\/Codex desktop apps stay off in a research — strom watches only Claude in Chrome/],
      ["cs", /vestavěný prohlížeč, náhled a computer use desktopových aplikací Claude a ChatGPT\/Codex jsou ve výzkumu vypnuté – strom hlídá jen Claude in Chrome/],
      ["de", /Computer Use der Desktop-Apps Claude und ChatGPT\/Codex bleiben in einer Forschung aus – strom überwacht nur Claude in Chrome/],
      ["pl", /computer use aplikacji desktopowych Claude i ChatGPT\/Codex są w badaniu wyłączone – strom pilnuje tylko Claude in Chrome/],
    ] as const) {
      const all = (await w.run(["doctor", "--json"], { env: { STROM_LANG: lang } })).json.checks as { name: string; status: string; detail: string }[];
      const desk = all.filter((c) => c.name === "desktop");
      assert.ok(desk.length === 1 && desk[0]!.status === "ok" && said.test(desk[0]!.detail), `${lang}: ${JSON.stringify(desk)}`);
    }
  } finally {
    w.cleanup();
  }
});

test("browserState: Claude Code with the extension in a browser profile ready; without it its address; any other agent without a browser strom keeps", () => {
  const home = fs.mkdtempSync(path.join(process.env.TMPDIR ?? "/tmp", "strom-browser-"));
  try {
    const env = { HOME: home, USERPROFILE: home, LOCALAPPDATA: path.join(home, "AppData", "Local") };
    assert.deepEqual(browserState(env, "claude"), { state: "no-extension", url: CLAUDE_IN_CHROME_URL });
    for (const a of ["codex", "grok", "opencode", "antigravity", undefined]) assert.equal(browserState(env, a).state, "agent-without-browser", String(a));
    const dir =
      process.platform === "darwin"
        ? path.join(home, "Library", "Application Support", "Google", "Chrome")
        : process.platform === "win32"
          ? path.join(home, "AppData", "Local", "Google", "Chrome", "User Data")
          : path.join(home, ".config", "google-chrome");
    fs.mkdirSync(path.join(dir, "Default", "Extensions", "fcoeoabgfenejglbffodgkkbkcdhcgfn"), { recursive: true });
    assert.equal(browserState(env, "claude").state, "ready");
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test("Codex without the person's add-ons: its desktop app's browser and computer use off — only the servers its config names (one it does not name would stop Codex)", () => {
  const home = fs.mkdtempSync(path.join(process.env.TMPDIR ?? "/tmp", "strom-codex-"));
  try {
    const env = { CODEX_HOME: home, HOME: home };
    assert.deepEqual(codexBrowserOff(env), [], "no config");
    fs.writeFileSync(path.join(home, "config.toml"), 'model = "gpt-5"\n[mcp_servers.other]\ncommand = "x"\n');
    assert.deepEqual(codexBrowserOff(env), []);
    fs.writeFileSync(path.join(home, "config.toml"), '[mcp_servers.node_repl]\ncommand = "node"\n\n  [ mcp_servers."computer-use" ]\nenabled = false\n');
    const off = ["-c", "mcp_servers.node_repl.enabled=false", "-c", "mcp_servers.computer-use.enabled=false"];
    assert.deepEqual(codexBrowserOff(env), off);
    const args = codexArgs({ cwd: home, shared: undefined, clean: true, env });
    assert.ok(args.join(" ").includes([...off, ...CODEX_CLEAN].join(" ")), args.join(" "));
    // the person's add-ons on: theirs, untouched
    assert.ok(!codexArgs({ cwd: home, shared: undefined, clean: false, env }).includes("mcp_servers.node_repl.enabled=false"));
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test("Codex in a conversation and in its desktop app (no switch of strom's reaches them): the tree's .codex/config.toml keeps its browser and computer use off — never a server Codex could not start", () => {
  const home = fs.mkdtempSync(path.join(process.env.TMPDIR ?? "/tmp", "strom-codex-"));
  try {
    const tree = { env: { CODEX_HOME: home, HOME: home } } as unknown as Tree;
    const servers = (text: string) => [...text.matchAll(/^\[mcp_servers\.([^\]]+)\]\n((?:[^[\n].*\n)*)/gmu)].map((m) => [m[1], m[2]!.trim()]);
    // no config of the person's: each server off with a command of its own (without one Codex stops: "invalid transport")
    const none = codexConfig(tree);
    assert.match(none, /^# strom: generated/u);
    assert.deepEqual(servers(none), CODEX_BROWSER_SERVERS.map((n) => [n, 'command = "strom-off"\nenabled = false']));
    for (const p of ["browser@openai-bundled", "chrome@openai-bundled", "computer-use@openai-bundled", "unified-computer-use@openai-bundled"])
      assert.ok(none.includes(`[plugins."${p}"]\nenabled = false`), p);
    // the desktop app's own node_repl: off as it is; one given by an address keeps it (a command beside it stops Codex)
    fs.writeFileSync(path.join(home, "config.toml"), '[mcp_servers.node_repl]\ncommand = "/x/node_repl"\n[mcp_servers.node_repl.env]\nA = "1"\n\n[ mcp_servers."computer-use" ]\nurl = "http://127.0.0.1:9/mcp"\n');
    const named = Object.fromEntries(servers(codexConfig(tree)));
    assert.equal(named["node_repl"], 'command = "strom-off"\nenabled = false');
    assert.equal(named["computer-use"], "enabled = false");
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});
