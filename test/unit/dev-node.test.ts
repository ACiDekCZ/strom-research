// The tests need a newer Node than strom itself: `npm test` and `npm run test:quick` on an older Node say so in one
// sentence (pretest, pretest:quick); npm only warns of devEngines, so `npm install`, a typecheck and a build still run
// on the Node strom itself runs on; strom's own engines for the people who run it stay.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { devNodeRefusal } from "../../scripts/dev-node.ts";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));

test("package.json: the tests need Node 24 (devEngines), strom itself runs on Node 22.18, both test scripts check first", () => {
  assert.deepEqual(pkg.devEngines, { runtime: { name: "node", version: ">=24", onFail: "warn" } });
  assert.equal(pkg.engines.node, ">=22.18");
  assert.equal(pkg.scripts.pretest, "node scripts/dev-node.ts");
  assert.equal(pkg.scripts["pretest:quick"], "node scripts/dev-node.ts");
  for (const s of ["test", "test:quick"]) assert.match(pkg.scripts[s], /--test-global-setup/);
  assert.ok(!pkg.files.some((f: string) => f === "scripts" || f.startsWith("scripts/")), "the script stays out of the package");
});

test("an older Node said in one sentence, with what strom itself runs on; Node 24 and newer pass", () => {
  assert.equal(devNodeRefusal("24.0.0", pkg), undefined);
  assert.equal(devNodeRefusal("26.9.0", pkg), undefined);
  assert.equal(
    devNodeRefusal("22.18.0", pkg),
    "The tests need Node 24 or newer (node --test --test-global-setup); this is Node 22.18.0 (strom itself still runs on Node >=22.18).",
  );
  assert.match(devNodeRefusal("23.11.1", pkg)!, /this is Node 23\.11\.1/);
  assert.equal(devNodeRefusal("20.0.0", {}), undefined, "no devEngines: nothing to say");
});

test("the script as npm runs it: exit 1 with the sentence on an older Node, 0 on this one", () => {
  const script = path.join(ROOT, "scripts", "dev-node.ts");
  const old = spawnSync(process.execPath, [script, "22.18.0"], { encoding: "utf8" });
  assert.equal(old.status, 1);
  assert.match(old.stderr, /^The tests need Node 24 or newer .* this is Node 22\.18\.0 \(strom itself still runs on Node >=22\.18\)\.\n$/);
  const now = spawnSync(process.execPath, [script], { encoding: "utf8" });
  assert.equal(now.status, 0, now.stderr);
  assert.equal(now.stderr, "");
});
