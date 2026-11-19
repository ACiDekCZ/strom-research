// A bridge that starts slowly (a computer under load: its settling of the tree before it says it is there) is waited for
// while its process lives, never taken for one that did not start; one that ends at once is given up on without the
// long wait (found under the whole suite: live-renew, waiting-groups, sync-two-browsers failed with live.not-started).
// The first wait (10 s) is made short here (STROM_LIVE_START_MS) and the bridge's start slowed by a preload, so this
// needs no slow computer.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";

const opts = { skip: !hasGit || process.platform === "win32", timeout: 120_000 };

/** The bridge's process (live serve) held at its start by a preload: `ms` asleep, or ended at once (exit). */
function slowed(w: World, what: { sleep: number } | { exit: true }): void {
  const file = path.join(w.dir, "slow-bridge.cjs");
  const act = "exit" in what ? "process.exit(3);" : `Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ${what.sleep});`;
  fs.writeFileSync(file, `if (process.argv.includes('live') && process.argv.includes('serve')) { ${act} }\n`);
  w.env.NODE_OPTIONS = `${w.env.NODE_OPTIONS ?? ""} --require=${JSON.stringify(file)}`.trim();
}

test("strom live start waits for a bridge still starting past the first wait — its process alive — and gives it", opts, async () => {
  const w = new World();
  await w.withTree("Lhotákovi");
  try {
    w.env.STROM_LIVE_START_MS = "500";
    slowed(w, { sleep: 3000 });
    const r = await w.run(["live", "start", "--json"]);
    assert.equal(r.code, 0, r.out + r.err);
    const info = r.json as { pid: number; url: string };
    assert.ok(info.pid > 0 && /^http:\/\/127\.0\.0\.1:\d+\//.test(info.url), r.out);
    const live = JSON.parse(fs.readFileSync(path.join(w.cwd, ".strom", "live.json"), "utf8")) as { pid: number };
    assert.equal(live.pid, info.pid);
  } finally {
    delete w.env.NODE_OPTIONS;
    await w.run(["live", "stop"]);
    w.cleanup();
  }
});

test("strom live start gives up on a bridge whose process ended at once after the first wait, never the long one", opts, async () => {
  const w = new World();
  await w.withTree("Lhotákovi");
  try {
    w.env.STROM_LIVE_START_MS = "500";
    slowed(w, { exit: true });
    const t = Date.now();
    const r = await w.run(["live", "start", "--json"]);
    const took = Date.now() - t;
    assert.notEqual(r.code, 0, r.out + r.err);
    assert.equal((r.json as { code?: string } | undefined)?.code, "live.not-started", r.out + r.err);
    // the long wait (60 s) is only for a bridge still alive
    assert.ok(took < 30_000, `took ${took} ms`);
  } finally {
    delete w.env.NODE_OPTIONS;
    w.cleanup();
  }
});
