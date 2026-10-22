// What the user does in their own terminal — a login, the seal, a plugin installed or removed — strom refuses to an
// agent itself, whatever options come before the command (strom --json seal adopt): the agents' rules match only what
// follows the command's name (Codex's let `strom --json seal adopt` through), so they are the second layer. An agent
// in a terminal of its own (Codex's shell is one) that would type the yes is refused too; the person at theirs is not.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit, pluginDir, readJsonFile } from "../helpers.ts";

const opts = { skip: !hasGit };
const AGENTS: Record<string, string>[] = [{ CODEX_THREAD_ID: "019a-test" }, { CLAUDECODE: "1" }];

test("login, seal adopt, connector add|remove: refused to an agent with a global option before them, a terminal and a yes", opts, async () => {
  const w = new World();
  try {
    await w.withTree();
    const tree = w.cwd;
    const id = readJsonFile(path.join(tree, "strom.json")).id;
    const key = path.join(w.env.STROM_CONFIG_DIR!, "keys", `${id}.key`);
    fs.renameSync(key, key + ".elsewhere");
    await w.ok(["connector", "new", "zkusebni", "--url", "https://archive.example.org", "--title", "Zkušební archiv"]);
    const outside = path.join(w.dir, "stažený konektor");
    fs.cpSync(pluginDir(w, "zkusebni"), outside, { recursive: true });

    const cases: { args: string[]; set: RegExp }[] = [
      { args: ["--json", "seal", "adopt"], set: /^strom seal adopt$/ },
      { args: ["--tree", tree, "seal", "adopt"], set: /^strom seal adopt$/ },
      { args: ["--tree", tree, "login"], set: /^strom login$/ },
      { args: ["--json", "login", "zkusebni", "--remove"], set: /^strom login zkusebni --remove$/ },
      { args: ["--json", "connector", "add", outside], set: /^strom connector add ".*stažený konektor"$/ },
      { args: ["--yes", "connector", "remove", "zkusebni"], set: /^strom connector remove zkusebni$/ },
    ];
    for (const agent of AGENTS)
      for (const c of cases) {
        // the agent's terminal, and the yes it would type into it
        const r = await w.run(c.args, { tty: true, answers: ["y", "y", "y"], env: agent, cwd: w.dir });
        const what = `${Object.keys(agent)[0]}: strom ${c.args.join(" ")}`;
        assert.equal(r.code, 4, `${what}: ${r.out}${r.err}`);
        const json = await w.run(["--json", ...c.args], { env: agent, cwd: w.dir });
        assert.equal(json.json.status, "needs-consent", what);
        assert.match(json.json.needs[0].set, c.set, what);
        assert.match(json.json.needs[0].question, /the user's own.*\(an agent cannot answer this\)/, what);
      }
    // nothing changed: no key made, the connector neither installed nor removed
    assert.equal(fs.existsSync(key), false);
    assert.equal(fs.existsSync(pluginDir(w, "stazeny-konektor")), false);
    assert.ok(fs.existsSync(path.join(pluginDir(w, "zkusebni"), "connector.json")));

    // the catalog says so
    const catalog = (await w.ok(["commands", "--json"])).json;
    const all = (catalog.commands ?? catalog) as { command: string; userOnly?: boolean }[];
    assert.deepEqual(all.filter((c) => c.userOnly).map((c) => c.command).sort(), ["connector add", "connector remove", "login", "seal adopt"]);

    // the person at their terminal: as before, global options too
    assert.match((await w.ok(["--tree", tree, "login"], { cwd: w.dir })).out, /no connector here uses a login/);
    await w.ok(["--tree", tree, "seal", "adopt"], { tty: true, answers: ["y"], cwd: w.dir });
    assert.ok(fs.existsSync(key));
  } finally {
    w.cleanup();
  }
});
