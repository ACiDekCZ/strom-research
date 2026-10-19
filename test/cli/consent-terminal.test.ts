// What opens this computer outward, costs or runs another's code asks the person's own yes in their terminal too
// (Context.requireHumanYes): running the command says nothing by itself — a terminal an agent opened round its markers
// changes nothing. Enter says no, "a"/"j"/"y" yes; --yes never answers it (no window here: needs-input); with an
// agent's markers needs-input as before. The other consents go on as they did.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";

const opts = { skip: !hasGit };
const AGENT = { CLAUDECODE: "1" };

const config = (w: World) => JSON.parse(fs.readFileSync(path.join(w.env.STROM_CONFIG_DIR!, "config.json"), "utf8")) as Record<string, any>;

/** Each of `noes` changes nothing (exit 1, said so); --yes and an agent's markers: needs-input; `yes` then changes it. */
async function asks(w: World, args: string[], changed: () => boolean, said: RegExp, yes: string, env: Record<string, string> = {}) {
  for (const answer of ["", "n", "ne"]) {
    const r = await w.run(args, { tty: true, answers: [answer], env });
    assert.equal(r.code, 1, `${args.join(" ")} — ${JSON.stringify(answer)}: ${r.out}${r.err}`);
    assert.match(r.out, said, args.join(" "));
    assert.equal(changed(), false, `${args.join(" ")} answered ${JSON.stringify(answer)}`);
  }
  const withYes = await w.run([...args, "--yes"], { tty: true, answers: [yes], env });
  assert.equal(withYes.code, 4, `${args.join(" ")} --yes: ${withYes.out}${withYes.err}`);
  const agent = await w.run(args, { tty: true, answers: [yes], env: { ...env, ...AGENT } });
  assert.equal(agent.code, 4, `${args.join(" ")} by an agent: ${agent.out}${agent.err}`);
  assert.equal(changed(), false);
  const r = await w.run(args, { tty: true, answers: [yes], env });
  assert.equal(r.code, 0, `${args.join(" ")} — ${yes}: ${r.out}${r.err}`);
  assert.equal(changed(), true, `${args.join(" ")} answered ${yes}`);
}

test("the settings that open the computer or spend: the person's yes in the terminal (Remote Control, connectors without asking, the gate)", opts, async () => {
  const w = new World();
  try {
    await w.ok(["setup", "--yes"]);
    await asks(w, ["config", "set", "agent.remote", "on"], () => config(w).agentRemote === "on", /Remote Control[^\n]*\? \(a\/n\) \[n\]/, "a", { STROM_LANG: "cs" });
    // the question in the person's language, and its answer: German j
    await w.ok(["config", "set", "connectors.consent", "on"]);
    const consentOff = () => config(w).connectorsConsent !== "on";
    await asks(w, ["config", "set", "connectors.consent", "off"], consentOff, /ohne vorher zu fragen\? \(j\/n\) \[n\]/, "j", { STROM_LANG: "de" });
    const gate = () => config(w).runGate === "claude-usage 10";
    await asks(w, ["config", "set", "run.gate", "claude-usage 10"], gate, /„claude-usage 10“[^\n]*\? \(a\/n\) \[n\]/, "a", { STROM_LANG: "cs" });
    // taken away: the person's yes too
    const r = await w.run(["config", "unset", "run.gate"], { tty: true, answers: [""], env: { STROM_LANG: "cs" } });
    assert.equal(r.code, 1);
    assert.match(r.out, /Nic se nezměnilo: run\.gate zůstává claude-usage 10\./);
    assert.ok(gate());
    await w.ok(["config", "unset", "run.gate"], { tty: true, answers: ["y"] });
    assert.ok(!gate());
  } finally {
    w.cleanup();
  }
});

test("a hook turned on and a host's own pace: the person's yes in the terminal; off asks nothing", opts, async () => {
  const w = new World();
  try {
    await w.ok(["setup", "--yes"]);
    const hook = path.join(w.home, "shared", "plugins", "hooks", "zapis");
    fs.mkdirSync(hook, { recursive: true });
    fs.writeFileSync(path.join(hook, "hook.json"), JSON.stringify({ interface: 1, title: "Zápis", command: ["node", "hook.ts"] }));
    fs.writeFileSync(path.join(hook, "hook.ts"), "");
    const on = () => (config(w).hooks ?? []).includes("zapis");
    await asks(w, ["hook", "on", "zapis"], on, /hook „Zápis“[^\n]*\n[^\n]*Povolit\? \(a\/n\) \[n\]|hook „Zápis“[^\n]*\? \(a\/n\) \[n\]/, "a", { STROM_LANG: "cs" });
    // off: anybody's in a terminal, no question (an empty list of answers would say no)
    await w.ok(["hook", "off", "zapis"], { tty: true, answers: [] });
    assert.ok(!on());

    const paces = path.join(w.home, "shared");
    const own = () => {
      const found = [] as string[];
      const walk = (d: string) => {
        for (const e of fs.readdirSync(d, { withFileTypes: true })) {
          if (e.isDirectory()) walk(path.join(d, e.name));
          else if (/\.json$/.test(e.name) && /"minIntervalMs": ?30000/.test(fs.readFileSync(path.join(d, e.name), "utf8"))) found.push(e.name);
        }
      };
      walk(paces);
      walk(w.env.STROM_CONFIG_DIR!);
      return found.length > 0;
    };
    await asks(w, ["allow", "host", "example.org", "--pace", "30"], own, /example\.org[^\n]*\? \(a\/n\) \[n\]/, "a", { STROM_LANG: "cs" });
  } finally {
    w.cleanup();
  }
});

test("strom run round the gate in the person's terminal: their yes first (Enter says no, nothing started); a script without a terminal as before", opts, async () => {
  const w = new World();
  try {
    await w.withTree();
    await w.ok(["config", "set", "run.gate", "claude-usage 10"], { tty: true, answers: ["y"] });
    for (const args of [["run", "--no-gate"], ["run", "--gate", "claude-usage 5"]]) {
      const r = await w.run(args, { tty: true, answers: [""], env: { STROM_LANG: "cs" } });
      assert.equal(r.code, 1, r.out + r.err);
      assert.match(r.out, /claude-usage[^\n]*\? \(a\/n\) \[n\]/);
      assert.match(r.err, /nepovoleno/i);
      assert.equal(fs.readdirSync(path.join(w.cwd, ".strom")).filter((f) => f.startsWith("session-")).length, 0, "no session started");
      // an agent: needs-input, as before
      assert.equal((await w.run(args, { tty: true, answers: ["a"], env: AGENT })).code, 4);
      // --yes in the person's terminal answers nothing: needs-input, no session
      const yes = await w.run([...args, "--yes"], { tty: true, answers: ["a"] });
      assert.equal(yes.code, 4, `${args.join(" ")} --yes: ${yes.out}${yes.err}`);
      assert.equal(fs.readdirSync(path.join(w.cwd, ".strom")).filter((f) => f.startsWith("session-")).length, 0, "no session started");
    }
  } finally {
    w.cleanup();
  }
});

test("the other consents go on as before: run in the person's terminal, nothing more asked", opts, async () => {
  const w = new World();
  try {
    await w.ok(["setup", "--yes"]);
    // an empty list of answers: a question asked would be answered no
    await w.ok(["config", "set", "sync.review", "off"], { tty: true, answers: [] });
    await w.ok(["config", "set", "agent.permissions", "auto"], { tty: true, answers: [] });
    await w.ok(["config", "set", "connectors.consent", "on"], { tty: true, answers: [] });
    assert.equal(config(w).agentPermissions, "auto");
    // and setup --yes, as an installer runs it, asks nothing
    await w.ok(["setup", "--yes"], { tty: true, answers: [] });
  } finally {
    w.cleanup();
  }
});
