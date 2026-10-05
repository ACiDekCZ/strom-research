// Loaded before every test file (`node --test --import ./test/setup.ts`): Node keeps what it compiled — the
// sources with their types stripped — so the next test file and every strom a test starts (a bridge, a send
// written by it) do not compile them again. World passes it on to the strom processes it starts.

import fs from "node:fs";
import module from "node:module";
import os from "node:os";
import path from "node:path";

const dir = process.env.NODE_COMPILE_CACHE || path.join(os.tmpdir(), "strom-test-compile-cache");
process.env.NODE_COMPILE_CACHE = dir;
module.enableCompileCache?.(dir);

// No test process reaches the person's home and settings (test/helpers.ts does the same for a file run alone).
const home = fs.mkdtempSync(path.join(os.tmpdir(), "strom-test-home-"));
process.env.HOME = home;
process.env.USERPROFILE = home;
process.env.STROM_CONFIG_DIR = path.join(home, "config");
