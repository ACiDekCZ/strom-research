// A clock for tests that read "now" (ZAKLAD: fixed clock, away from midnight UTC): it runs on from noon of a fixed day,
// in this process and — through NODE_OPTIONS — in the processes it starts (the bridge), all on the same time.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

/** The preload a child process runs first: the same clock as this one (STROM_TEST_CLOCK = "<from>,<real then>"). */
const PRELOAD = `const [from, then] = (process.env.STROM_TEST_CLOCK ?? "").split(",").map(Number);
if (from && then) {
  const Real = Date;
  const realNow = Real.now.bind(Real);
  const now = () => from + (realNow() - then);
  class Clock extends Real {
    constructor(...a) { if (a.length) super(...a); else super(now()); }
    static now() { return now(); }
  }
  globalThis.Date = Clock;
}
`;

/**
 * Runs the clock from `at` (default: 18 Nov 2026, 12:00 local) here, and returns what a World's env needs so the
 * processes it starts run it too; `stop` puts the real clock back.
 */
export function fixedClock(at = new Date(2026, 10, 18, 12, 0, 0).getTime()): { env: Record<string, string>; stop: () => void } {
  const then = Date.now();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strom-clock-"));
  const preload = path.join(dir, "clock.mjs");
  fs.writeFileSync(preload, PRELOAD);
  const Real = Date;
  const realNow = Real.now.bind(Real);
  const now = () => at + (realNow() - then);
  class Clock extends Real {
    constructor(...a: ConstructorParameters<DateConstructor> | []) {
      if (a.length) super(...(a as [number]));
      else super(now());
    }
    static override now(): number {
      return now();
    }
  }
  globalThis.Date = Clock as DateConstructor;
  return {
    env: { STROM_TEST_CLOCK: `${at},${then}`, NODE_OPTIONS: `--import=${pathToFileURL(preload).href}` },
    stop: () => {
      globalThis.Date = Real;
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}
