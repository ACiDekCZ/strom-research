// The setting tune.transcripts (core/transcripts.ts): Claude Code's transcripts of the sessions strom started read for
// the tuning of scan reading — on by default, off by strom config set, said by config get and config where.

import { test } from "node:test";
import assert from "node:assert/strict";
import { World } from "../helpers.ts";

test("strom config: tune.transcripts on by default, off for this computer only, back on", async () => {
  const w = new World();
  assert.deepEqual((await w.ok(["config", "get", "tune.transcripts", "--json"])).json, { key: "tune.transcripts", value: "on", source: "default" });
  assert.match((await w.ok(["config", "where"])).out, /^tune\.transcripts +on +default +STROM_TUNE_TRANSCRIPTS/m);
  await w.ok(["config", "set", "tune.transcripts", "off"]);
  assert.deepEqual((await w.ok(["config", "get", "tune.transcripts", "--json"])).json, { key: "tune.transcripts", value: "off", source: "config" });
  assert.equal((await w.run(["config", "set", "tune.transcripts", "maybe"])).code, 2, "on or off only");
  assert.equal((await w.run(["config", "set", "tune.transcripts", "off", "--for-tree"])).code !== 0, true, "no tree of its own");
  await w.ok(["config", "unset", "tune.transcripts"]);
  assert.equal((await w.ok(["config", "get", "tune.transcripts"])).out.trim(), "on");
  w.cleanup();
});
