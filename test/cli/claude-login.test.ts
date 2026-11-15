// Claude Code in the terminal not logged in (K040): a conversation in the Claude app goes on with the app's own login,
// but what strom starts by itself — the readers of strom read and the like, strom run — is the CLI `claude` with a login
// of its own. When `claude auth status` says outright it is not logged in, nothing is started and it is said with how
// to log in; a reader that ends "auth" all the same is said so too, never only "auth"; strom doctor says it in a line of
// its own. An answer that tells nothing (an older Claude Code, a stand-in, an error) decides nothing.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";

const unix = { skip: !hasGit || process.platform === "win32", timeout: 120_000 };
const fixtures = path.join(import.meta.dirname, "..", "fixtures", "images");

type Login = "out" | "in" | "unknown";

/**
 * A stand-in Claude Code first on PATH: `auth status` answers as `login` says ("unknown": an error, no JSON), a reader
 * (claude -p) refuses as a CLI not logged in does. Its calls are kept (their first two arguments).
 */
function claudeStandIn(w: World, login: Login): () => string[] {
  const bin = path.join(w.dir, "claude-bin");
  fs.mkdirSync(bin, { recursive: true });
  const calls = path.join(w.dir, "claude.calls");
  fs.writeFileSync(calls, "");
  const status =
    login === "out"
      ? `echo '{"loggedIn": false, "authMethod": "none", "apiProvider": "firstParty"}'; exit 1`
      : login === "in"
        ? `echo '{"loggedIn": true, "authMethod": "claude.ai"}'; exit 0`
        : `echo 'Error: something went wrong' >&2; exit 2`;
  fs.writeFileSync(
    path.join(bin, "claude"),
    `#!/bin/sh\necho "$1 $2" >> "${calls}"\nif [ "$1 $2" = "auth status" ]; then ${status}; fi\ncat >/dev/null\necho '{"type":"result","subtype":"success","is_error":true,"result":"Invalid API key · Please run /login","total_cost_usd":0}'\nexit 1\n`,
    { mode: 0o755 },
  );
  w.env.PATH = `${bin}${path.delimiter}${w.env.PATH}`;
  return () => fs.readFileSync(calls, "utf8").trim().split("\n").filter(Boolean);
}

async function treeWithScans(w: World): Promise<void> {
  await w.withTree();
  await w.ok(["research", "new", "Předci", "--new-person", "Jan /Lhoták/", "--sex", "M"]);
  await w.ok(["recordset", "add", "Lhota N 1847–1868", "--kinds", "baptism", "--places", "Lhota", "--years", "1847-1868"]);
  const scans = path.join(w.dir, "scans");
  fs.mkdirSync(scans);
  for (const f of ["s0001.jpg", "s0002.jpg"]) fs.copyFileSync(path.join(fixtures, f), path.join(scans, f));
  await w.ok(["media", "add", scans, "--recordset", "B1"]);
}

const QUESTION = "Křest Jana Lhotáka (Ткач)";

test("strom read: Claude Code in the terminal said not logged in — no reader started, said with how to log in (exit 1, agent.logged-out), in the research's language for a person and in English for an agent", unix, async () => {
  const w = new World();
  try {
    await treeWithScans(w);
    const calls = claudeStandIn(w, "out");
    const r = await w.run(["read", "B1", "--images", "1-2", "--whole", "--question", QUESTION, "--agent", "claude"]);
    assert.equal(r.code, 1, r.out + r.err);
    assert.deepEqual(calls(), ["auth status"], "no reader started");
    assert.match(r.err, /Claude Code v terminálu není přihlášený – strom read ho spouští sám \(ne aplikace Claude, ta má vlastní přihlášení\)/u);
    assert.match(r.err, /jednou se přihlásit v terminálu: claude, pak \/login/u);
    assert.doesNotMatch(r.out, /▶ reader/);
    assert.equal(fs.existsSync(path.join(w.cwd, ".strom", "metrics", "readers.jsonl")), false, "no reader recorded");
    // an agent and a program: the English message, its code and the command that logs in
    const j = await w.run(["read", "B1", "--images", "1-2", "--whole", "--question", QUESTION, "--agent", "claude", "--json"], { env: { CLAUDECODE: "1" } });
    assert.equal(j.code, 1);
    assert.equal(j.json.code, "agent.logged-out", JSON.stringify(j.json));
    assert.deepEqual(j.json.params, { command: "strom read", login: "claude" });
    assert.match(j.json.message, /^Claude Code in the terminal \(claude\) is not logged in — strom read starts it itself/);
    assert.deepEqual(calls(), ["auth status", "auth status"]);
  } finally {
    w.cleanup();
  }
});

test("strom read: logged in, or an answer that tells nothing — readers start; one that ends 'auth' is said with how to log in, as it goes and in the summary, never only 'auth'", unix, async () => {
  for (const login of ["in", "unknown"] as const) {
    const w = new World();
    try {
      await treeWithScans(w);
      const calls = claudeStandIn(w, login);
      const r = await w.run(["read", "B1", "--images", "1-2", "--whole", "--question", QUESTION, "--agent", "claude", "--parallel", "1"]);
      assert.equal(r.code, 1, r.out + r.err);
      assert.equal(calls()[0], "auth status");
      assert.ok(calls().length >= 2, `a reader started (${login}): ${calls().join(" | ")}`);
      const said = r.out + r.err;
      const line = "Claude Code v terminálu není přihlášený (čtenáře spouští strom sám, ne aplikace Claude) – jednou v terminálu spustit claude a přihlásit se (/login)";
      assert.ok(said.includes(`■ čtenář 1: auth — ${line} · $0.00 · nálezy: 0`), said);
      assert.match(said, /neúspěšní čtenáři: 1–2 \(auth\)/u);
      assert.ok(said.split("\n").includes(line), `the summary says it: ${said}`);
      // an agent reads it in English, a program gets the command
      const j = await w.run(["read", "B1", "--images", "1-2", "--whole", "--question", QUESTION, "--agent", "claude", "--parallel", "1", "--json"], { env: { CLAUDECODE: "1" } });
      assert.equal(j.code, 1);
      assert.equal(j.json.login, "claude");
      assert.match(j.err, /■ reader 1: auth — Claude Code in the terminal is not logged in \(the readers start it themselves, not the Claude app\) — run claude once in a terminal and log in \(\/login\) · \$0\.00 · 0 with finds$/m);
    } finally {
      w.cleanup();
    }
  }
});

test("strom run with Claude Code's own default folder (no CLAUDE_CONFIG_DIR) said not logged in: stopped before the first session, saying how to log in", unix, async () => {
  const w = new World();
  try {
    await w.withTree();
    await w.ok(["research", "new", "Předci", "--new-person", "Jan /Lhoták/", "--sex", "M"]);
    await w.ok(["recordset", "add", "Lhota N 1847–1868", "--kinds", "baptism", "--places", "Lhota", "--years", "1847-1868"]);
    await w.ok(["task", "add", "Křest Jana", "--level", "link", "--where", "B1", "--why", "rodiče", "--done-when", "zápis", "--about", "P1"]);
    const calls = claudeStandIn(w, "out");
    const r = await w.run(["run", "--agent", "claude", "--json"]);
    assert.equal(r.code, 1, r.out + r.err);
    assert.equal(r.json.stop, "auth");
    assert.equal(r.json.sessions.length, 0);
    assert.match(r.json.stopped, /jednou spustit claude a přihlásit se/u);
    assert.deepEqual(calls(), ["auth status"], "no session started");
  } finally {
    w.cleanup();
  }
});

test("strom doctor: Claude Code in the terminal logged in said in a line of its own — a warning with how to log in when it is not, nothing when it cannot tell", unix, async () => {
  for (const [login, want] of [
    ["out", "warn"],
    ["in", "ok"],
    ["unknown", undefined],
  ] as const) {
    const w = new World();
    try {
      await w.withTree();
      claudeStandIn(w, login);
      const d = await w.run(["doctor", "--json"]);
      assert.ok(d.json?.checks, d.out + d.err);
      const line = d.json.checks.find((c: { name: string }) => c.name === "login");
      assert.equal(line?.status, want, `${login}: ${JSON.stringify(line)}`);
      if (login === "out") {
        assert.match(line.detail, /^Claude Code v terminálu není přihlášený – samostatná práce, čtení skenů a práce z aplikace Strom hned skončí \(aplikace Claude má vlastní přihlášení\)$/u);
        assert.equal(line.fix, "claude v terminálu, pak /login");
        const text = await w.run(["doctor"]);
        assert.match(text.out, /Claude Code v terminálu není přihlášený/u);
      }
      if (login === "in") assert.equal(line.detail, "Claude Code v terminálu přihlášen");
    } finally {
      w.cleanup();
    }
  }
});

test("strom doctor in an archive: Claude Code's login neither said nor asked (claude auth status never started)", unix, async () => {
  const w = new World();
  try {
    await w.withTree();
    await w.ok(["mode", "archive"], { tty: true });
    const calls = claudeStandIn(w, "out");
    const d = await w.run(["doctor", "--json"]);
    assert.ok(d.json?.checks, d.out + d.err);
    assert.equal(d.json.checks.find((c: { name: string }) => c.name === "login"), undefined);
    assert.deepEqual(calls(), [], "nothing of the agent started");
  } finally {
    w.cleanup();
  }
});
