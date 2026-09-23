// Self-description: an agent with no prior knowledge must be able to learn
// strom from strom itself.

import { test } from "node:test";
import assert from "node:assert/strict";
import { World } from "../helpers.ts";
import { commands } from "../../src/cli/registry.ts";
import "../../src/commands/index.ts";

test("every command is documented: summary, group, help renders", async () => {
  const w = new World();
  for (const def of commands()) {
    assert.ok(def.summary.length > 10, `summary of ${def.path.join(" ")}`);
    const r = await w.ok(["help", ...def.path]);
    assert.match(r.out, /^strom/);
  }
  w.cleanup();
});

test("examples only use existing commands and options", async () => {
  const w = new World();
  for (const def of commands())
    for (const ex of def.examples ?? []) {
      const words = ex.replace(/^strom /, "");
      const r = await w.run([...words.split(" ").slice(0, def.path.length), "--help"]);
      assert.equal(r.code, 0, `example: ${ex}`);
    }
  w.cleanup();
});

test("commands --json is a complete machine-readable catalog", async () => {
  const w = new World();
  const cat = (await w.ok(["commands", "--json"])).json;
  const names = cat.commands.map((c: any) => c.command);
  for (const c of ["guide", "setup", "init", "research new", "person add", "person show", "check", "verify", "repair"]) assert.ok(names.includes(c), c);
  const add = cat.commands.find((c: any) => c.command === "person add");
  assert.equal(add.writes, true);
  assert.ok(add.options.some((o: any) => o.name === "--dry-run"));
  assert.ok(add.examples.length > 0);
  w.cleanup();
});

test("guide states the hard rules and the exit codes", async () => {
  const w = new World();
  const g = (await w.ok(["guide"])).out;
  assert.match(g, /Never create, edit, delete or read files under data\//);
  assert.match(g, /4 needs consent/);
  w.cleanup();
});

test("unknown commands and options fail with a hint (exit 2)", async () => {
  const w = new World();
  const r = await w.run(["frobnicate"]);
  assert.equal(r.code, 2);
  assert.match(r.err, /→ strom help/);
  const sub = await w.run(["person", "frobnicate"]);
  assert.equal(sub.code, 2);
  const opt = await w.run(["person", "list", "--colour"]);
  assert.equal(opt.code, 2);
  assert.match(opt.err, /strom help person list/);
  const group = await w.ok(["person"]);
  assert.match(group.out, /person add/);
  w.cleanup();
});
