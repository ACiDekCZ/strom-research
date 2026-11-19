// A short command of an agent's run to its end at once (`claude auth status`, a program's --version). On Windows an npm
// launcher (.cmd, .bat) goes through cmd.exe with its line said verbatim — never node's shell option with arguments,
// which warns (DEP0190) into what a reader shows — and its time limit ends the whole tree it started: spawnSync's own
// ends cmd.exe alone and leaves the agent's node running (K040, Windows). Anything else: spawnSync as it is (the program
// is the agent itself).

import { spawnSync } from "node:child_process";
import type { Env } from "./paths.ts";

/** Quote one argument for cmd.exe (a .cmd/.bat launcher on Windows). */
export function cmdQuote(arg: string): string {
  if (/^[\w.\-/:=@]+$/u.test(arg)) return arg;
  return `"${arg.replace(/"/g, '""')}"`;
}

/** Is this program a Windows launcher that only cmd.exe starts? */
export function isLauncher(program: string, platform: NodeJS.Platform = process.platform): boolean {
  return platform === "win32" && /\.(cmd|bat)$/iu.test(program);
}

/** How a program is started: a launcher through cmd.exe, its whole line one argument taken verbatim; else itself. */
export function startOf(program: string, args: string[], env: Env, platform: NodeJS.Platform = process.platform): { file: string; args: string[]; verbatim: boolean } {
  if (!isLauncher(program, platform)) return { file: program, args, verbatim: false };
  const line = [cmdQuote(program), ...args.map(cmdQuote)].join(" ");
  return { file: env.ComSpec ?? env.COMSPEC ?? "cmd.exe", args: ["/d", "/s", "/c", `"${line}"`], verbatim: true };
}

/**
 * What a watchdog runs (node -e, CommonJS): the command, its output passed on; at the time limit everything it started
 * ended — Windows: taskkill of the whole tree, elsewhere its own process group — and exit 124.
 */
const WATCHDOG = `
const cp = require("node:child_process");
const o = JSON.parse(process.argv[1]);
const win = process.platform === "win32";
const c = cp.spawn(o.file, o.args, { stdio: ["ignore", "pipe", "ignore"], windowsHide: true, windowsVerbatimArguments: o.verbatim, detached: !win });
c.stdout.pipe(process.stdout);
const t = setTimeout(() => {
  if (win) cp.spawnSync("taskkill", ["/pid", String(c.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
  else { try { process.kill(-c.pid, "SIGKILL"); } catch { try { c.kill("SIGKILL"); } catch {} } }
  process.exit(124);
}, o.ms);
c.on("error", () => { clearTimeout(t); process.exit(127); });
c.on("close", (code) => { clearTimeout(t); process.exitCode = code === null ? 1 : code; });
`;

/** The exit of a watchdog whose command ran out of time. */
const TIMED_OUT = 124;

export interface SyncRun {
  stdout: string;
  status: number | null;
  timedOut: boolean;
}

/**
 * Run a program to its end within `timeout` ms. A Windows launcher — or anything with `wholeTree` — under a watchdog
 * that ends all it started at the limit; else spawnSync's own limit. stdin and stderr ignored. Never throws.
 */
export function runSync(program: string, args: string[], o: { env: Env; timeout: number; wholeTree?: boolean }): SyncRun {
  const start = startOf(program, args, o.env);
  try {
    if (!start.verbatim && !o.wholeTree) {
      const r = spawnSync(start.file, start.args, { env: o.env as NodeJS.ProcessEnv, encoding: "utf8", timeout: o.timeout, stdio: ["ignore", "pipe", "ignore"], windowsHide: true });
      return { stdout: r.stdout ?? "", status: r.status, timedOut: (r.error as NodeJS.ErrnoException | undefined)?.code === "ETIMEDOUT" };
    }
    const r = spawnSync(process.execPath, ["--input-type=commonjs", "-e", WATCHDOG, JSON.stringify({ ...start, ms: o.timeout })], {
      env: o.env as NodeJS.ProcessEnv,
      encoding: "utf8",
      // the watchdog's own limit: a little after the command's
      timeout: o.timeout + 5_000,
      stdio: ["ignore", "pipe", "ignore"],
      windowsHide: true,
    });
    return { stdout: r.stdout ?? "", status: r.status, timedOut: r.status === TIMED_OUT || (r.error as NodeJS.ErrnoException | undefined)?.code === "ETIMEDOUT" };
  } catch {
    return { stdout: "", status: null, timedOut: false };
  }
}
