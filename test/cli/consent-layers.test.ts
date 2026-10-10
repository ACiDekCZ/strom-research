// What only the person raises (web.perHost, model.effort, agent.addons, agent.browser, sync.edits) is compared in the
// layer the command writes: the user's reaches every tree without a value of its own — a tree's own lower value never
// hides a raise of the others —, the tree's this tree with the user's below it (its lower value removed: a raise).

import { test } from "node:test";
import assert from "node:assert/strict";
import { World, hasGit } from "../helpers.ts";

const opts = { skip: !hasGit || process.platform === "win32" };

test("a tree's own lower value never lets an agent raise the user's: web.perHost, model.effort, add-ons, browser, sync.edits — each needs the person, in the user's layer and the tree's", opts, async () => {
  const w = new World();
  await w.withTree();
  await w.ok(["init", "Druhý strom"]);
  const other = w.treeDir("Druhý strom");
  const get = async (key: string, cwd = w.cwd) => (await w.ok(["config", "get", key, "--json"], { cwd })).json.value;
  w.env.CLAUDECODE = "1";

  // the tree's own lower value: anyone's
  await w.ok(["config", "set", "web.perHost", "5", "--for-tree"]);
  await w.ok(["config", "set", "model.effort", "low", "--for-tree"]);
  // the user's layer raised from inside that tree: the person's (other trees would go by it)
  for (const [key, value] of [["web.perHost", "500"], ["model.effort", "max"], ["agent.addons", "on"], ["agent.browser", "always"]] as const) {
    const r = await w.run(["config", "set", key, value]);
    assert.equal(r.code, 4, `${key} ${value}: ${r.out}${r.err}`);
    assert.match(r.out + r.err, /an agent cannot answer this/);
  }
  assert.equal(await get("web.perHost", other), 30, "another tree keeps the default");
  assert.equal(await get("web.perHost"), 5);

  // the same or lower in the user's layer: anyone's, whatever the tree has
  await w.ok(["config", "set", "web.perHost", "20"]);
  await w.ok(["config", "set", "model.effort", "low"]);
  assert.equal(await get("web.perHost", other), 20);
  // the user's lower value removed: back to the default (higher), the person's
  assert.equal((await w.run(["config", "unset", "web.perHost"])).code, 4);
  assert.equal((await w.run(["config", "unset", "model.effort"])).code, 4);
  assert.equal(await get("web.perHost", other), 20);

  // the tree's layer: above the user's below it, the person's; removing the tree's lower value too
  assert.equal((await w.run(["config", "set", "web.perHost", "25", "--for-tree"])).code, 4);
  assert.equal((await w.run(["config", "set", "web.perHost", "20", "--for-tree"])).code, 4, "above the tree's own 5");
  await w.ok(["config", "set", "web.perHost", "3", "--for-tree"]);
  assert.equal((await w.run(["config", "unset", "web.perHost", "--for-tree"])).code, 4, "the tree's lower value removed: the user's higher one holds again");
  assert.equal((await w.run(["config", "set", "agent.browser", "always", "--for-tree"])).code, 4, "the browser in every session of a tree: the person's too");
  assert.equal((await w.run(["config", "set", "agent.addons", "on", "--for-tree"])).code, 4);
  assert.equal((await w.run(["config", "set", "sync.edits", "user", "--for-tree"])).code, 4);

  // a tree's own on: the user's layer still the person's (it reaches the other trees)
  delete w.env.CLAUDECODE;
  await w.ok(["config", "set", "agent.addons", "on", "--for-tree"], { tty: true });
  await w.ok(["config", "set", "sync.edits", "user", "--for-tree"], { tty: true });
  w.env.CLAUDECODE = "1";
  assert.equal((await w.run(["config", "set", "agent.addons", "on"])).code, 4);
  assert.equal((await w.run(["config", "set", "sync.edits", "user"])).code, 4);
  assert.equal(await get("agent.addons", other), "off");
  // turning off: anyone's
  await w.ok(["config", "set", "agent.addons", "off", "--for-tree"]);
  w.cleanup();
});
