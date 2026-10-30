// The whole run (`node --test --test-global-setup ./test/global-setup.ts`) never touches the person's own strom: their
// settings (~/.config/strom, also on Windows since 1.23 — %APPDATA%\strom before), their research (~/Documents/Strom) and what strom teaches the agents.
// Read before the first test and after the last; the run fails when a test reached them (found 2026-10-16: an
// installation built from the sources listed the tests' settings folders in the real settings-folders.json).
// Only what a test could leave is compared — new names, the list of settings folders, the test folders' paths in a
// file — so the person's own strom working meanwhile (a bridge, an update check) fails nothing.

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

interface Print {
  names: string[];
  folders: string;
  marks: Record<string, number>;
}

/** The person's real home: never $HOME, which test/setup.ts points elsewhere. */
function realHome(): string {
  try {
    return os.userInfo().homedir;
  } catch {
    return os.homedir();
  }
}

// STROM_TEST_GUARD_HOME: another home, to try this check itself
const home = process.env.STROM_TEST_GUARD_HOME || realHome();
const settings = path.join(home, ".config", "strom");
const research = path.join(home, "Documents", "Strom");
const agentFiles = [
  path.join(home, ".claude", "settings.json"),
  path.join(home, ".claude", "skills", "strom", "SKILL.md"),
  path.join(home, ".codex", "AGENTS.md"),
  path.join(home, ".gemini", "GEMINI.md"),
  path.join(home, ".gemini", "settings.json"),
  path.join(home, ".grok", "config.toml"),
  path.join(home, ".config", "opencode", "opencode.json"),
];
/** How a test's folder looks in a path it wrote: the system's temp folder (also as its real path). */
const tmp = [...new Set([os.tmpdir(), fs.realpathSync.native(os.tmpdir())])];
// what the person's own strom writes and removes while it works
const passing = /\.(lock|tmp)$|\.tmp-|~$/u;

function names(dir: string, depth: number, rel = ""): string[] {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(path.join(dir, rel), { withFileTypes: true });
  } catch {
    return [];
  }
  const out: string[] = [];
  for (const e of entries) {
    if (passing.test(e.name)) continue;
    const p = path.join(rel, e.name);
    out.push(p);
    if (e.isDirectory() && depth > 1) out.push(...names(dir, depth - 1, p));
  }
  return out;
}

function marksIn(file: string): number {
  try {
    if (fs.statSync(file).size > 4 * 1024 * 1024) return 0;
    const text = fs.readFileSync(file, "utf8");
    return tmp.reduce((n, t) => n + text.split(t).length - 1, 0);
  } catch {
    return 0;
  }
}

function fingerprint(): Print {
  const files = [...names(settings, 3).map((p) => path.join(settings, p)), ...agentFiles].filter((f) => {
    try {
      return fs.statSync(f).isFile();
    } catch {
      return false;
    }
  });
  let folders = "";
  try {
    folders = crypto.createHash("sha256").update(fs.readFileSync(path.join(settings, "settings-folders.json"))).digest("hex");
  } catch {
    // none
  }
  return {
    names: [...names(settings, 3).map((p) => path.join(settings, p)), ...names(research, 1).map((p) => path.join(research, p))],
    folders,
    marks: Object.fromEntries(files.map((f) => [f, marksIn(f)])),
  };
}

let before: Print;

export function globalSetup(): void {
  before = fingerprint();
}

export function globalTeardown(): void {
  const after = fingerprint();
  const found: string[] = [];
  const had = new Set(before.names);
  for (const n of after.names) if (!had.has(n)) found.push(`new: ${n}`);
  if (after.folders !== before.folders) found.push(`changed: ${path.join(settings, "settings-folders.json")}`);
  for (const [f, n] of Object.entries(after.marks)) if (n > (before.marks[f] ?? 0)) found.push(`a test's folder named in: ${f}`);
  if (found.length) {
    // the runner shows no error of a teardown: said here, and the run fails
    process.stderr.write(`\nThe tests reached the person's own strom:\n  ${found.join("\n  ")}\n`);
    process.exitCode = 1;
  }
}
