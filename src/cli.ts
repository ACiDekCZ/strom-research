#!/usr/bin/env node
// strom — genealogical research toolkit for AI agents.

import fs from "node:fs";
import { settleColors } from "./cli/colors.ts";

// Before anything else loads (an agent's shell with NO_COLOR and FORCE_COLOR both: no warning of Node's on every command).
settleColors(process.env);
const { main } = await import("./cli/main.ts");
const { installation, withInstallEnv } = await import("./core/self.ts");

// The environment this installation was installed with (its own settings, isolated): for this strom and all it starts.
Object.assign(process.env, withInstallEnv(process.env, installation().env));

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
