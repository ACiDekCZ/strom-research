// A connector built by the agent in strom run, nobody watching: everything it takes goes without a person's consent
// when the connector needs none (connectors.consent off, the default; a connector strom fences in) — connector new
// (the scaffold and its discovery brief), its files under the plugins folder (the tree's rules of every agent let it
// edit them), connector probe, connector test, strom fetch through it. Where a consent is needed (consent on, a
// program strom does not fence in) the run is told plainly: exit 4, the person's command, and the task to add for it.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { archive, opts } from "./connectors.helpers.ts";
import { World, fakeConnector, pluginDir, readJsonFile } from "../helpers.ts";

test("strom run builds a connector itself: new, its files, probe, test, fetch — no consent asked while none is needed; one that needs it says the task to add", { ...opts, skip: opts.skip || process.platform === "win32" }, async () => {
  const w = new World();
  await w.withTree();
  const a = await archive();
  try {
    await w.ok(["research", "new", "Předci Jana Nováka", "--new-person", "Jan /Novák/", "--sex", "M", "--born", "ABT 1905"]);
    await w.ok(["task", "add", "Křest Jana Nováka", "--level", "locate", "--where", "matrika Týnec", "--why", "rodiče", "--done-when", "zápis nalezen", "--about", "P0001"]);
    await w.ok(["recordset", "add", "Týnec N 1784–1820", "--kinds", "baptism"]); // B0001
    const s = (await w.ok(["session", "start", "T0001", "--json"], { env: { CLAUDECODE: "1", STROM_WORKER: "run-7-c2" } })).json;
    const sid: string = s.session?.id ?? s.id;
    // the agent of a run: strom started it, nobody watches, no window (the test's io has none)
    Object.assign(w.env, { CLAUDECODE: "1", STROM_SESSION: sid, STROM_WORKER: "run-7-c2", STROM_NONINTERACTIVE: "1" });

    // the tree's rules let every agent read and edit a connector's files (Claude Code, Grok, OpenCode; Codex: a writable root)
    const connectors = path.join(w.home, "shared", "plugins", "connectors");
    const allow = (readJsonFile(path.join(w.cwd, ".claude", "settings.json")) as { permissions: { allow: string[] } }).permissions.allow;
    assert.ok(allow.some((r) => r.startsWith("Edit(") && r.includes(path.join("plugins", "connectors"))), allow.join("\n"));
    assert.ok(fs.readFileSync(path.join(w.cwd, ".grok", "config.toml"), "utf8").includes(`Edit(${connectors.replace(/\\/g, "/")}/**)`));
    const oc = readJsonFile(path.join(w.cwd, "opencode.json")) as { permission: { edit: Record<string, string>; external_directory: Record<string, string> }; agent: Record<string, { permission: { edit: Record<string, string> } }> };
    assert.equal(oc.permission.edit[`${connectors}/*`], "allow");
    assert.equal(oc.agent["strom-run"]!.permission.edit[`${connectors}/*`], "allow", "in a run too, where what would ask is refused");

    // connector new: the scaffold and its discovery brief, the agent's edits of its files — strom asks nothing
    const dir = await fakeConnector(w, "tynec", a.base);
    assert.equal(dir, pluginDir(w, "tynec"));
    assert.ok(fs.existsSync(path.join(dir, "DISCOVERY.md")));
    const probe = await w.ok(["connector", "probe", "tynec", `${a.base}/book/5359`]);
    assert.match(probe.out, /200/);
    const tried = await w.ok(["connector", "test", "tynec", "--find", "Týnec"]);
    assert.match(tried.out, /5359/);
    const got = await w.ok(["fetch", "tynec", "5359", "--images", "1", "--recordset", "B1"]);
    assert.match(got.out, /1 image|image 1|s0001/);
    assert.equal((await w.ok(["media", "list", "--json"])).json.total, 1, "fetched and registered");

    // consents on (the person's setting): the run is told plainly, with the task to add — nothing ran
    const hits = a.hits.length;
    const on = await w.run(["connector", "test", "tynec", "--find", "Týnec"], { env: { STROM_CONNECTORS_CONSENT: "on" } });
    assert.equal(on.code, 4, on.out + on.err);
    const said = on.out + on.err;
    assert.match(said, /strom allow connector tynec/);
    assert.match(said, /nobody watches this run to say yes: add a task for it and go on another way — strom task add "The user's consent: strom allow connector tynec"/);
    assert.match(said, /strom task wait <its T…> --on/);
    assert.match(said, /never go round it/);
    assert.equal(a.hits.length, hits, "nothing went to the archive");
    // the task it says is one strom takes
    const line = said.match(/— (strom task add .*?), then strom task wait/)![1]!;
    const words = [...line.matchAll(/"([^"]*)"|(\S+)/g)].map((m) => m[1] ?? m[2]!);
    const added = (await w.ok([...words.slice(1), "--json"])).json;
    assert.ok(added.task?.id ?? added.id);

    // a program strom does not fence in: its code needs the person's yes always — the same plain way
    const manifest = readJsonFile(path.join(dir, "connector.json")) as Record<string, unknown>;
    fs.writeFileSync(path.join(dir, "connector.json"), JSON.stringify({ ...manifest, run: ["python3", "connector.py"] }, null, 2));
    const locked = await w.run(["fetch", "tynec", "5359", "--images", "2", "--recordset", "B1"]);
    assert.equal(locked.code, 4, locked.out + locked.err);
    assert.match(locked.out + locked.err, /strom allow connector tynec[\s\S]*nobody watches this run to say yes/);
  } finally {
    w.cleanup();
    await a.close();
  }
});
