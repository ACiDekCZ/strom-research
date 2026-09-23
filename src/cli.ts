#!/usr/bin/env node
// strom — genealogical research toolkit for AI agents.

import fs from "node:fs";
import { main } from "./cli/main.ts";

// Windows consoles: make sure non-ASCII names print correctly.
if (process.platform === "win32") process.stdout.setDefaultEncoding?.("utf8");

const code = await main(
  process.argv.slice(2),
  {
    stdout: (s) => process.stdout.write(s),
    stderr: (s) => process.stderr.write(s),
    tty: Boolean(process.stdin.isTTY && process.stdout.isTTY),
    ...(process.stdin.isTTY ? {} : { stdinText: () => fs.readFileSync(0, "utf8") }),
  },
  process.env,
  process.cwd(),
);
process.exitCode = code;
