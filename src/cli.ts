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

// A person's terminal: the menu drawn for it (colours, width — cli/screen.ts); never for an agent, never off a terminal.
const { decorate, terminalStyle } = await import("./cli/screen.ts");
const { isAgent } = await import("./core/which.ts");
const tty = Boolean(process.stdin.isTTY && process.stdout.isTTY);
const style = terminalStyle({ tty, env: process.env, platform: process.platform, columns: () => process.stdout.columns, agent: isAgent(process.env) });

const code = await main(
  process.argv.slice(2),
  {
    stdout: (s) => process.stdout.write(decorate(s, style)),
    style,
    stderr: (s) => process.stderr.write(s),
    tty,
    ...(process.stdin.isTTY ? {} : { stdinText: () => fs.readFileSync(0, "utf8") }),
  },
  process.env,
  process.cwd(),
);
process.exitCode = code;
