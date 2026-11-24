// The image saver (agents/imagesaver.ts) is a subagent of Claude Code: its tools run under the tree's hooks as the
// agent's own — Claude Code gives the hook the same session id with the subagent's agent_id and agent_type beside it.
// strom answers a subagent's navigate exactly as the agent's (the person's permission for the archive, the person's
// pace, the site's pages of the session counted together with the agent's), and refuses another model named in its call
// (core/delegate.ts). Two synthetic archives; no request leaves this computer.

import { after, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";
import { testHooks } from "../../src/core/net.ts";
import { grantWay } from "../../src/core/terms.ts";
import { chromeEvent } from "../../src/core/chromehook.ts";
import { IMAGE_SAVER, IMAGE_SAVER_CHROME, imageSaverTools } from "../../src/agents/imagesaver.ts";

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

const AGENT = { CLAUDECODE: "1", STROM_TEST_HUMAN_PACE_MS: "1000" };
const LHOTA = "www.archiv-lhota.example";
const PODHRADI = "matriky.podhradi.example";
const page = (host: string, n: number) => `https://${host}/kniha/7?snimek=${n}`;
const SUB = { agent_id: "a1b2c3", agent_type: IMAGE_SAVER };

/** Claude in Chrome's navigate as the hook gets it: the agent's own, or its subagent's (same session, agent_id). */
const navigateEvent = (w: World, url: string, use: string, sub: boolean) =>
  JSON.stringify({ session_id: "agent-1", cwd: w.cwd, hook_event_name: "PreToolUse", tool_name: "mcp__claude-in-chrome__navigate", tool_input: { url, tabId: 7 }, tool_use_id: use, ...(sub ? SUB : {}) });

async function navigate(w: World, url: string, use: string, sub: boolean): Promise<string> {
  const r = await w.run(["net", "web", "--hook"], { stdin: navigateEvent(w, url, use, sub), env: AGENT });
  assert.equal(r.code, 0, r.err);
  const out = r.out.trim();
  if (!out) return "allow";
  const h = (JSON.parse(out) as { hookSpecificOutput: { permissionDecision?: string; permissionDecisionReason?: string } }).hookSpecificOutput;
  return `${h.permissionDecision ?? "allow"}${h.permissionDecisionReason ? `: ${h.permissionDecisionReason}` : ""}`;
}

/** The agent's browser strom keeps: the Claude in Chrome extension in a profile of this computer's Chrome. */
function extension(w: World): void {
  const home = w.env.HOME!;
  const dir =
    process.platform === "darwin"
      ? path.join(home, "Library", "Application Support", "Google", "Chrome")
      : process.platform === "win32"
        ? path.join(w.env.LOCALAPPDATA ?? path.join(home, "AppData", "Local"), "Google", "Chrome", "User Data")
        : path.join(home, ".config", "google-chrome");
  fs.mkdirSync(path.join(dir, "Default", "Extensions", "fcoeoabgfenejglbffodgkkbkcdhcgfn"), { recursive: true });
}

/** A tree with two archives only a person's browser goes to: Lhota allowed through the browser, Podhradí not. */
async function tree(): Promise<World> {
  const w = new World();
  await w.withTree("Lhotákovi");
  const file = path.join(w.dir, "archives-test.json");
  fs.writeFileSync(file, JSON.stringify({ archives: [LHOTA, PODHRADI].map((host) => ({ host, name: `Archiv ${host}`, level: "restricted", browserOnly: true, checked: "2026-11-01" })) }));
  w.env.STROM_ARCHIVES_FILE = file;
  assert.ok(grantWay(w.env, [LHOTA], "browser", { by: "terminal" }));
  extension(w);
  await w.ok(["config", "set", "web.perHost", "4"]);
  return w;
}

test("a subagent's event is the agent's: the same session, its agent_id and agent_type left aside", () => {
  const w = { cwd: "/t" } as World;
  const main = chromeEvent(navigateEvent(w, page(LHOTA, 1), "u1", false));
  const sub = chromeEvent(navigateEvent(w, page(LHOTA, 1), "u1", true));
  assert.ok(main);
  assert.deepEqual(sub, main);
  assert.equal(sub!.agentSession, "agent-1");
});

test("the image saver's navigate is answered as the agent's: the same decisions, its pages counted with the agent's, past web.perHost refused alike; an archive not allowed refused alike", opts, async () => {
  const seq = [1, 2, 3, 4, 5, 6];
  const answers: string[][] = [];
  for (const mixed of [false, true]) {
    const w = await tree();
    try {
      const got: string[] = [];
      // the agent opens the first page itself; the saver (mixed) the rest, in the same session
      for (const [i, n] of seq.entries()) got.push(await navigate(w, page(LHOTA, n), `u${n}`, mixed && i > 0));
      // an archive the person did not allow through the browser
      got.push(await navigate(w, page(PODHRADI, 1), "p1", mixed));
      answers.push(got);
      const log = fs.readFileSync(path.join(w.cwd, ".strom", "metrics", "fetch.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l) as { host?: string; decision?: string; agentSession?: string });
      const lhota = log.filter((l) => l.host === LHOTA && l.decision === "allow");
      assert.equal(lhota.length, 4, "the site's pages of the session: the agent's and the saver's together");
      assert.ok(lhota.every((l) => l.agentSession === "agent-1"));
    } finally {
      w.cleanup();
    }
  }
  const [alone, withSaver] = answers as [string[], string[]];
  assert.deepEqual(withSaver, alone, "the saver gets exactly the agent's answers");
  assert.deepEqual(alone.slice(0, 4), ["allow", "allow", "allow", "allow"]);
  assert.ok(alone.slice(4, 6).every((a) => !a.startsWith("allow")), `past web.perHost not let through: ${alone.slice(4, 6).join(" | ")}`);
  assert.match(alone[6]!, /^deny/, "an archive not allowed through the browser");
});

test("the image saver's tools: the shell and the four tools of Claude in Chrome a save needs — nothing that reads or clicks a page", () => {
  assert.deepEqual(IMAGE_SAVER_CHROME, ["tabs_context_mcp", "tabs_create_mcp", "navigate", "javascript_tool"].map((t) => `mcp__claude-in-chrome__${t}`));
  assert.deepEqual(imageSaverTools("darwin"), ["Bash", ...IMAGE_SAVER_CHROME]);
  assert.deepEqual(imageSaverTools("win32"), ["Bash", "PowerShell", ...IMAGE_SAVER_CHROME]);
});

test("the tree defines the image saver for Claude Code (.claude/agents and --agents) on the person's model.cheap, else inherit; strom agents delegate lists it; a call naming another model is refused", opts, async () => {
  const w = new World();
  try {
    await w.withTree("Lhotákovi");
    const md = path.join(w.cwd, ".claude", "agents", `${IMAGE_SAVER}.md`);
    let text = fs.readFileSync(md, "utf8");
    assert.match(text, new RegExp(`^---\\nname: ${IMAGE_SAVER}\\n`));
    assert.match(text, /\nmodel: "inherit"\n/);
    assert.match(text, /mcp__claude-in-chrome__javascript_tool/);
    assert.doesNotMatch(text, /read_page|computer|get_page_text|find\b/u, "nothing that reads or clicks a page");
    await w.ok(["config", "set", "model.cheap", "haiku", "--agent", "claude"]);
    await w.ok(["agents", "sync"]);
    text = fs.readFileSync(md, "utf8");
    assert.match(text, /\nmodel: "haiku"\n/);
    const listed = await w.ok(["agents", "delegate", "--json"]);
    assert.equal(listed.json.delegates[IMAGE_SAVER], "haiku");
    assert.match((await w.ok(["agents", "delegate"])).out, new RegExp(`${IMAGE_SAVER} +model: haiku \\(model\\.cheap\\)`));
    const call = (model?: string) => JSON.stringify({ session_id: "agent-1", cwd: w.cwd, hook_event_name: "PreToolUse", tool_name: "Agent", tool_input: { subagent_type: IMAGE_SAVER, description: "Uložit", prompt: "T0001 B0001 40-45", ...(model ? { model } : {}) } });
    const hook = async (model?: string) => (await w.run(["agents", "delegate", "--hook"], { stdin: call(model), env: { CLAUDECODE: "1" } })).out.trim();
    assert.equal(await hook(), "", "without model: goes on");
    assert.equal(await hook("haiku"), "", "the same model: goes on");
    const refused = JSON.parse(await hook("opus")) as { hookSpecificOutput: { permissionDecision: string; permissionDecisionReason: string } };
    assert.equal(refused.hookSpecificOutput.permissionDecision, "deny");
    assert.match(refused.hookSpecificOutput.permissionDecisionReason, /strom-image-saver runs on the model strom set for it — haiku \(model\.cheap\), not opus\. Which model saves the images is the user's choice \(model\.cheap\)/);
  } finally {
    w.cleanup();
  }
});
