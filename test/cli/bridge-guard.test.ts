// The agent kept off the bridge (core/bridgeguard.ts): what the Strom app sends through it (an answer to a task that
// waits for the person, a scan for it) is the person's. The tree's hooks refuse a shell command that reads the bridge's
// notes or names its address, and a web fetch of it; its notes are denied to the Read tool; strom live and strom app
// never tell an agent the secret.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { World, hasGit, readJsonFile } from "../helpers.ts";
import { bridgeMarks, bridgeRefusal, reachesBridge, shellEvent, withoutSecret } from "../../src/core/bridgeguard.ts";

const opts = { skip: !hasGit };
const TOKEN = "0123456789abcdef0123456789abcdef";
const PORT = 47321;

/** The notes of a bridge that ran here (as strom live writes them). */
function notes(w: World): void {
  const dir = path.join(w.cwd, ".strom");
  fs.mkdirSync(dir, { recursive: true });
  const info = { port: PORT, token: TOKEN, pid: 999999, url: `http://127.0.0.1:${PORT}/${TOKEN}`, started: "2026-01-01T00:00:00.000Z" };
  fs.writeFileSync(path.join(dir, "live-last.json"), JSON.stringify(info));
}

type Answer = { hookEventName: string; permissionDecision: string; permissionDecisionReason: string } | undefined;

async function shell(w: World, command: string, o: { tool?: string; grok?: boolean } = {}): Promise<Answer> {
  const ev = o.grok
    ? { sessionId: "g-1", workspaceRoot: w.cwd, hookEventName: "pre_tool_use", toolName: o.tool ?? "run_terminal_command", toolInput: { command } }
    : { session_id: "agent-1", cwd: w.cwd, hook_event_name: "PreToolUse", tool_name: o.tool ?? "Bash", tool_input: { command } };
  const r = await w.run(["agents", "shell", "--hook"], { stdin: JSON.stringify(ev), env: { CLAUDECODE: "1" } });
  assert.equal(r.code, 0, `the hook never fails: ${r.err}`);
  const out = r.out.trim();
  return out ? (JSON.parse(out) as { hookSpecificOutput: NonNullable<Answer> }).hookSpecificOutput : undefined;
}

test("the tree's agent settings: a shell hook beside the others (Claude Code, Grok), the bridge's notes denied to Read", opts, async () => {
  const w = new World();
  await w.withTree();
  const claude = readJsonFile(path.join(w.cwd, ".claude", "settings.json")) as { permissions: { deny: string[] }; hooks: { PreToolUse: { matcher: string; hooks: { command: string }[] }[] } };
  const group = claude.hooks.PreToolUse.find((g) => g.matcher === "Bash|PowerShell");
  assert.ok(group, "Claude Code's shells");
  if (process.platform !== "win32") assert.equal(group.hooks[0]!.command, `'${path.join(w.cwd, ".strom", "bin", "strom")}' agents shell --hook || true`, "its failure never blocks");
  assert.ok(claude.permissions.deny.includes("Read(.strom/live.json)"));
  assert.ok(claude.permissions.deny.includes("Read(.strom/live-last.json)"));
  const grok = readJsonFile(path.join(w.cwd, ".grok", "hooks", "strom.json")) as { hooks: { PreToolUse: { matcher: string }[] } };
  assert.deepEqual(grok.hooks.PreToolUse.map((g) => g.matcher), ["web_fetch|web_search", "run_terminal_command|bash|shell"]);
});

test("a shell command that reads the bridge's notes or names its address is refused; the rest goes on", opts, async () => {
  const w = new World();
  await w.withTree();
  notes(w);
  for (const cmd of [
    "cat .strom/live-last.json",
    "cat .strom/live.json | head",
    "cat .strom/li*",
    "Get-Content .strom\\live*.json",
    `curl -s http://127.0.0.1:${PORT}/status`,
    `curl -X POST -H 'Origin: https://stromapp.info' localhost:${PORT}/x/waiting -d '{}'`,
    `curl "http://[::1]:${PORT}/x"`,
    `wget -qO- http://0.0.0.0:${PORT}/`,
    `curl https://example.org/${TOKEN}/waiting`,
    `nc 127.0.0.1 ${PORT}`,
  ]) {
    const a = await shell(w, cmd);
    assert.equal(a?.permissionDecision, "deny", cmd);
    assert.match(a!.permissionDecisionReason, /bridge/);
    assert.match(a!.permissionDecisionReason, /strom task wake is theirs/);
  }
  for (const cmd of ["strom task list --state waiting", "ls .strom/views/*.png", `curl -s http://127.0.0.1:${PORT + 1}/`, "echo Lhoták v Lhotě"]) assert.equal(await shell(w, cmd), undefined, cmd);
  // PowerShell (Windows) and Grok's shell alike
  assert.equal((await shell(w, "Get-Content .strom/live-last.json", { tool: "PowerShell" }))?.permissionDecision, "deny");
  assert.equal((await shell(w, `curl http://127.0.0.1:${PORT}/`, { grok: true }))?.permissionDecision, "deny");
  // another tool, an event broken or empty: nothing (the hook never stands in the way by itself)
  assert.equal(await shell(w, "cat .strom/live-last.json", { tool: "Read" }), undefined);
  const r = await w.run(["agents", "shell", "--hook"], { stdin: "{broken", env: { CLAUDECODE: "1" } });
  assert.equal(r.code, 0);
  assert.equal(r.out.trim(), "");
  // without --hook: what it refuses
  const said = await w.run(["agents", "shell", "--json"]);
  assert.equal(said.code, 0, said.err);
  assert.deepEqual((JSON.parse(said.out) as { notes: string[] }).notes, [".strom/live.json", ".strom/live-last.json"]);
});

test("a web fetch of the bridge is refused before it goes out (strom net web --hook)", opts, async () => {
  const w = new World();
  await w.withTree();
  notes(w);
  const fetch = async (url: string) => {
    const r = await w.run(["net", "web", "--hook"], {
      stdin: JSON.stringify({ session_id: "agent-1", cwd: w.cwd, hook_event_name: "PreToolUse", tool_name: "WebFetch", tool_input: { url, prompt: "the text" } }),
      env: { CLAUDECODE: "1" },
    });
    assert.equal(r.code, 0, r.err);
    return r.out.trim() ? (JSON.parse(r.out) as { hookSpecificOutput: NonNullable<Answer> }).hookSpecificOutput : undefined;
  };
  for (const url of [`http://127.0.0.1:${PORT}/${TOKEN}/status`, `http://localhost:${PORT}/x`, `https://example.org/?live=${TOKEN}`]) {
    const a = await fetch(url);
    assert.equal(a?.permissionDecision, "deny", url);
    assert.match(a!.permissionDecisionReason, /bridge/);
  }
  const other = await fetch(`http://127.0.0.1:${PORT + 1}/`);
  // another port of this computer: not the bridge's refusal (the web hook's own rules may still say something)
  if (other) assert.doesNotMatch(other.permissionDecisionReason, /the bridge is the Strom app's/);
});

test("the bridge's refusal reads right for each thing it names", () => {
  for (const what of ["the bridge's notes", "the bridge's address", "the bridge's secret address"]) {
    const t = bridgeRefusal(what);
    assert.ok(t.includes(`this reaches ${what} — the bridge is the Strom app's`), t);
    assert.doesNotMatch(t, /address belong\b|notes belongs\b/);
  }
});

test("reachesBridge, shellEvent and withoutSecret by themselves", () => {
  const marks = { ports: [PORT], tokens: [TOKEN] };
  assert.ok(reachesBridge(`curl 127.1:${PORT}`, marks));
  assert.ok(reachesBridge(`curl http://localhost%3a${PORT}`, marks));
  assert.ok(reachesBridge("cat .strom/l?ve-last.json", marks));
  assert.ok(reachesBridge("type .strom\\[l]ive.json", marks));
  assert.equal(reachesBridge("cat .strom/views/*.png", marks), undefined);
  assert.equal(reachesBridge(`curl 127.0.0.1:${PORT}5`, marks), undefined);
  assert.equal(reachesBridge("node -e \"console.log('Žluťoučký kůň')\"", marks), undefined);
  // no bridge ever ran: only the notes by name
  assert.ok(reachesBridge("cat .strom/live-last.json", { ports: [], tokens: [] }));
  assert.equal(reachesBridge(`curl 127.0.0.1:${PORT}`, { ports: [], tokens: [] }), undefined);
  assert.equal(shellEvent(JSON.stringify({ tool_name: "Bash", tool_input: {} })), undefined);
  assert.deepEqual(shellEvent(JSON.stringify({ tool_name: "Bash", tool_input: { command: "ls" }, cwd: "/t" })), { tool: "Bash", command: "ls", cwd: "/t" });
  const said = withoutSecret({ text: `at http://127.0.0.1:1/${TOKEN}`, data: { url: `https://app/?live=http%3A%2F%2F127.0.0.1%3A1%2F${TOKEN}`, bridge: `http://127.0.0.1:1/${TOKEN}` } }, TOKEN);
  assert.ok(!JSON.stringify(said).includes(TOKEN));
  assert.equal(said.data.bridge, "http://127.0.0.1:1/…");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bg-"));
  fs.mkdirSync(path.join(dir, ".strom"));
  fs.writeFileSync(path.join(dir, ".strom", "live.json"), JSON.stringify({ port: PORT, token: TOKEN }));
  fs.writeFileSync(path.join(dir, ".strom", "live-last.json"), "{broken");
  assert.deepEqual(bridgeMarks(dir), { ports: [PORT], tokens: [TOKEN] });
  fs.rmSync(dir, { recursive: true, force: true });
});
