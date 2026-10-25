// Ticket B4: on a network or redirected drive git cannot tell the folder it works in ("unable to get current working
// directory") and no family tree there keeps its history. strom doctor tries git in the research folder and says so
// with "!", in the words strom init uses when it fails there.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { World, hasGit } from "../helpers.ts";

const opts = { skip: !hasGit || process.platform === "win32" };

test("B4 strom doctor tries git in the research folder: one that cannot tell where it is gets '!' and the advice of strom init", opts, async () => {
  const w = new World();
  await w.ok(["setup", "--yes"]);
  const fine = (await w.ok(["doctor", "--json"])).json.checks as { name: string }[];
  assert.ok(!fine.some((c) => c.name === "gitdir"), "a folder on this computer's own disk: nothing said");
  // git as on a redirected drive: it runs, but cannot tell the folder it was started in
  const real = spawnSync("which", ["git"], { encoding: "utf8" }).stdout.trim();
  const fake = path.join(w.dir, "git-lost");
  fs.writeFileSync(fake, `#!/bin/sh\nif [ "$1" = "rev-parse" ]; then echo "fatal: unable to get current working directory: No such file or directory" >&2; exit 128; fi\nexec "${real}" "$@"\n`, { mode: 0o755 });
  // strom runs in this process here: its git is the process's (STROM_GIT), as strom started on its own finds it
  const prior = process.env.STROM_GIT;
  const restore = () => (prior === undefined ? delete process.env.STROM_GIT : (process.env.STROM_GIT = prior));
  process.env.STROM_GIT = fake;
  const r = await w.run(["doctor", "--json"]).finally(restore);
  const check = (r.json.checks as { name: string; status: string; detail: string; fix?: string }[]).find((c) => c.name === "gitdir");
  assert.ok(check, r.out);
  assert.equal(check.status, "warn");
  assert.match(check.detail, /git nezjistí složku, ve které pracuje \(síťový nebo přesměrovaný disk\?\) – rodokmeny tam nemohou vést historii/);
  assert.equal(check.fix, "složka na vlastním disku tohoto počítače (síťový nebo přesměrovaný disk může zápis nebo historii odmítnout)");
  // a person reads it with "!"
  process.env.STROM_GIT = fake;
  const text = await w.run(["doctor"]).finally(restore);
  assert.match(text.out, /! +git ve složce výzkumů[^\n]*git nezjistí složku/);
  w.cleanup();
});
