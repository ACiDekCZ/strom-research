// Tests only: the folder where a run of the tests keeps a note of each process of strom that serves in the background — a
// bridge (strom live serve), the phone's server (strom phone serve) — given in STROM_TEST_BRIDGES (test/setup.ts), so none
// outlives its test: ended with its world, and the run fails when one is left (test/bridges.ts, test/global-setup.ts).
// Nothing is written without that variable: a strom of a person never notes anything.

import fs from "node:fs";
import path from "node:path";
import type { Env } from "./paths.ts";

/** This process noted as a server of `root` (a tree; the settings folder for the phone's server) of that kind. */
export function noteTestProcess(root: string, env: Env, kind: "live" | "phone"): void {
  const dir = env.STROM_TEST_BRIDGES;
  if (!dir) return;
  try {
    fs.writeFileSync(path.join(dir, `${process.pid}.json`), JSON.stringify({ pid: process.pid, root, cwd: process.cwd(), kind, at: new Date().toISOString() }));
  } catch {
    // a run whose folder is gone: nothing to keep
  }
}
