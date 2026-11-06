// The agent's browser at an archive only a person's browser goes to (spec 048 story 5, 4 November 2026): only Claude
// Code's Claude in Chrome goes through strom's hook — any other agent's browser or computer use never, whatever the
// person allowed: the person saves the images by hand, and is told once that with Claude Code and the extension the
// agent would save them itself. Said by net web --check, strom fetch, task wait, the brief, strom doctor, strom's menu
// and the bridge's /status (feature browser.state). Codex's own browser and computer use (its desktop app's MCP
// servers in the person's config) are off with the person's add-ons only; nothing of the desktop apps' browser or
// computer use is switched off in a research — strom neither watches nor recommends it (5 November 2026). No request
// leaves this computer.

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

    // the desktop apps' browser and computer use: what strom watches of each, never recommended, nothing said off (4 languages)
    for (const [lang, said] of [
      ["en", /built-in browser of the Claude app strom watches like Claude in Chrome, yet does not recommend it; computer use of the Claude app strom does not watch; the browser of the ChatGPT \(Codex\) app strom watches by the addresses its code names, once strom's hooks are confirmed in Codex; computer use of the app strom does not watch; the OpenCode app: a browser or computer use, if it has them, strom does not watch {2}\(strom doc R12\.1\)/],
      ["cs", /vestavěný prohlížeč aplikace Claude strom hlídá jako Claude in Chrome, ale nedoporučuje ho; computer use aplikace Claude strom nehlídá; prohlížeč aplikace ChatGPT \(Codex\) strom hlídá podle adres v jeho kódu/],
      ["de", /eingebauten Browser der App Claude überwacht strom wie Claude in Chrome, empfiehlt ihn aber nicht; Computer Use der App Claude überwacht strom nicht; den Browser der App ChatGPT \(Codex\)/],
      ["pl", /wbudowanej przeglądarki aplikacji Claude strom pilnuje jak Claude in Chrome, ale jej nie poleca; computer use aplikacji Claude strom nie pilnuje; przeglądarki aplikacji ChatGPT \(Codex\)/],
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

// What strom wrote before 1.27.0 left the desktop apps' browser and computer use on (never released): the tree's
// .codex/config.toml switching them off, and the deny rules in .claude/settings.json.
const OLD_CODEX = [
  "# strom: generated (strom agents sync) — Codex's settings for this family tree; changed by strom only",
  "# The browser and computer use of Codex's desktop app stay off in a research: strom keeps no watch before them,",
  "# so an archive's terms, robots.txt and pace could not be kept there.",
  ...["node_repl", "cua_repl", "computer-use", "computer_use"].flatMap((n) => ["", `[mcp_servers.${n}]`, ...(n === "computer-use" ? [] : ['command = "strom-off"']), "enabled = false"]),
  ...["browser", "chrome", "computer-use", "unified-computer-use"].flatMap((n) => ["", `[plugins."${n}@openai-bundled"]`, "enabled = false"]),
  "",
].join("\n");
const OLD_DENY = ["mcp__Claude_Browser", "mcp__Claude_Preview", "mcp__Claude_in_Chrome", "mcp__computer-use", "mcp__remote-devices", "enable__mcp__remote-devices__Claude_Browser", "enable__mcp__remote-devices__computer"];

test("nothing of the desktop apps' browser or computer use is switched off in a research: strom agents sync takes back what strom wrote off — the person's own lines stay", opts, async () => {
  const w = new World();
  try {
    const tree = await w.withTree("Lhotákovi");
    const conf = path.join(tree, ".codex", "config.toml");
    const settingsFile = path.join(tree, ".claude", "settings.json");
    assert.ok(!fs.existsSync(conf), "strom writes no .codex/config.toml");
    const deny = () => (readJsonFile(settingsFile) as { permissions: { deny: string[] } }).permissions.deny;
    for (const t of OLD_DENY) assert.ok(!deny().includes(t), t);
    assert.ok(deny().includes("mcp__claude-in-chrome__file_upload"), "Claude in Chrome's own rules stay");

    // a tree strom wrote before: the old file whole and the deny rules
    const old = readJsonFile(settingsFile) as { permissions: { deny: string[] } };
    old.permissions.deny.push(...OLD_DENY);
    fs.writeFileSync(settingsFile, JSON.stringify(old, null, 2) + "\n");
    fs.writeFileSync(conf, OLD_CODEX);
    await w.ok(["agents", "sync"]);
    assert.ok(!fs.existsSync(conf), "strom's old file goes whole");
    assert.ok(fs.existsSync(path.join(tree, ".codex", "rules", "strom.rules")), "Codex's rules stay");
    for (const t of OLD_DENY) assert.ok(!deny().includes(t), t);
    assert.ok(deny().includes("mcp__claude-in-chrome__file_upload") && deny().includes("mcp__claude-in-chrome__browser_batch"), "Claude in Chrome's own rules stay");

    // the person wrote in strom's old file: only strom's lines go; a section of the person's under strom's name stays
    const mine = '\n[mcp_servers.my_tool]\ncommand = "my-tool"\n\n[plugins."chrome@openai-bundled"]\nenabled = false\nnote = "mine"\n';
    fs.writeFileSync(conf, OLD_CODEX + mine);
    await w.ok(["agents", "sync"]);
    assert.equal(fs.readFileSync(conf, "utf8"), '[mcp_servers.my_tool]\ncommand = "my-tool"\n\n[plugins."chrome@openai-bundled"]\nenabled = false\nnote = "mine"\n');
    // a file of the person's own (no header of strom's): never touched, also when it switches the same off
    const own = '[mcp_servers.node_repl]\ncommand = "strom-off"\nenabled = false\n';
    fs.writeFileSync(conf, own);
    await w.ok(["agents", "sync"]);
    assert.equal(fs.readFileSync(conf, "utf8"), own);
    // decomposed and non-Latin text of the person's kept as written
    const text = '# Poznámka: Lhota — česky, Лхота\n[mcp_servers.x]\ncommand = "y"\n';
    fs.writeFileSync(conf, OLD_CODEX + text);
    await w.ok(["agents", "sync"]);
    assert.equal(fs.readFileSync(conf, "utf8"), text);
  } finally {
    w.cleanup();
  }
});
