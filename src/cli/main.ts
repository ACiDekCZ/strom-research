// CLI entry: find the command, parse options, run it, print the result,
// and commit what a writing command changed. Returns the exit code.

import { EXIT, StromError, UsageError } from "../core/errors.ts";
import type { Env } from "../core/paths.ts";
import { Context, type IO } from "./context.ts";
import type { Result } from "./registry.ts";
import { groupHelp, helpFor } from "./help.ts";
import { autoCommit } from "./commit.ts";
import { assertIntact } from "../core/integrity.ts";
import { resetCache } from "../core/git.ts";
import { VERSION } from "../core/tree.ts";
import { isAgent } from "../core/which.ts";
import { noticeStromApp } from "../core/stromapp.ts";
import { checkArgs, GroupOnly, parseOptions, resolveCommand, splitPassthrough } from "./execute.ts";
import "../commands/index.ts";

export { splitCommand } from "./execute.ts";

/** Compact JSON: indentation costs an agent tokens and adds nothing for a parser. */
function toJson(value: unknown): string {
  return JSON.stringify(value) + "\n";
}

function print(io: IO, ctx: Context | undefined, result: Result): void {
  if (ctx?.json) io.stdout(toJson(result.data ?? { text: result.text }));
  else if (result.text) io.stdout(result.text.endsWith("\n") ? result.text : result.text + "\n");
}

/** File-system errors in plain words (a missing @file, a folder without rights). */
function systemError(e: NodeJS.ErrnoException): StromError | undefined {
  const where = e.path ? `: ${e.path}` : "";
  switch (e.code) {
    case "ENOENT":
      return new UsageError(`no such file or folder${where}`, { hint: "check the path (relative paths start in the current folder)" });
    case "EACCES":
    case "EPERM":
      return new UsageError(`no permission to use${where}`, { hint: "choose a folder you can write to" });
    case "EISDIR":
      return new UsageError(`a folder was given where a file is expected${where}`);
    case "ENOTDIR":
      return new UsageError(`a file was given where a folder is expected${where}`);
    case "ENOSPC":
      return new StromError(`the disk is full${where}`);
  }
  return undefined;
}

function printError(io: IO, json: boolean, err: unknown, debug: boolean): number {
  const e = err instanceof StromError ? err : (systemError(err as NodeJS.ErrnoException) ?? err);
  if (e instanceof StromError) {
    if (json) io.stdout(toJson(e.toJSON()));
    else {
      io.stderr(`error: ${e.message}\n`);
      const cands = (e.details as { candidates?: { label: string }[] } | undefined)?.candidates;
      if (cands) for (const c of cands) io.stderr(`  ${c.label}\n`);
      if (e.hint) for (const h of e.hint.split("\n")) io.stderr(`→ ${h}\n`);
      if (debug && (err as Error).stack) io.stderr((err as Error).stack + "\n");
    }
    return e.exitCode;
  }
  const x = e as Error;
  if (json) io.stdout(toJson({ status: "error", message: x.message }));
  else {
    io.stderr(`error: ${x.message}\n`);
    io.stderr(debug ? `${x.stack}\n` : "→ run again with --debug for details\n");
  }
  return EXIT.error;
}

export async function main(argv: string[], io: IO, env: Env, cwd: string): Promise<number> {
  const json = argv.includes("--json");
  const debug = argv.includes("--debug");
  resetCache();
  try {
    // "strom 'person list'" (one quoted word) means the same as strom person list.
    if (argv[0] && !argv[0].startsWith("-") && /\s/.test(argv[0].trim())) argv = [...argv[0].trim().split(/\s+/), ...argv.slice(1)];
    // A person at a terminal gets the guided menu; an agent, a script or the app the orientation.
    if (argv.length === 0 && io.tty && !isAgent(env) && env.STROM_NONINTERACTIVE !== "1") argv = ["menu"];
    if (argv.length === 1 && (argv[0] === "--version" || argv[0] === "-v")) {
      io.stdout(json ? toJson({ version: VERSION }) : `strom ${VERSION}\n`);
      return EXIT.ok;
    }
    let resolved;
    try {
      resolved = resolveCommand(argv);
    } catch (err) {
      if (err instanceof GroupOnly) {
        io.stdout(groupHelp(err.group) + "\n");
        return EXIT.ok;
      }
      throw err;
    }
    const { def } = resolved;
    const { rest, passthrough } = def.passthrough ? splitPassthrough(resolved.rest) : { rest: resolved.rest, passthrough: [] };
    const parsed = parseOptions(def, rest);
    const v = parsed.values;
    if (v.help) {
      io.stdout(helpFor(def.path) + "\n");
      return EXIT.ok;
    }
    if (v.version) {
      io.stdout(json ? toJson({ version: VERSION }) : `strom ${VERSION}\n`);
      return EXIT.ok;
    }

    const ctx = Context.fromOptions({ env, cwd, io, json, values: v });
    // Started by the Strom app: remembered quietly (it is where the results go).
    if (env.STROM_APP) noticeStromApp(ctx.settings, env);
    const args = parsed.positionals;
    checkArgs(def, args);

    if (def.writes && v["dry-run"]) ctx.dryRun = true;
    const work = async (): Promise<Result> => {
      // Never write on top of data that was changed outside strom.
      if (def.writes && def.tree) assertIntact(ctx.tree());
      let result: Result;
      try {
        result = await def.run(ctx, { args, opts: v, ...(passthrough.length ? { extra: passthrough } : {}) });
      } catch (err) {
        // A writing command is a transaction: on failure nothing it wrote remains.
        const t = def.writes ? ctx.current() : undefined;
        if (t) t.withTreeLock(() => t.rollback());
        throw err;
      }
      if (def.writes) {
        const blocked = autoCommit(ctx, def);
        if (blocked) {
          // The agent must notice: an uncommitted write is not part of the research yet.
          result.text = result.text ? `${result.text}\n${blocked.message}` : blocked.message;
          result.data = { ...((result.data as object | undefined) ?? {}), status: "not-committed", problems: blocked.problems, hint: "strom check" };
          result.exitCode = EXIT.error;
        }
      }
      return result;
    };
    // Other strom processes may write to the same tree (other agents, a run): a writing
    // command has the tree to itself from its first read to its commit.
    const result = def.writes && def.tree && def.lock !== "sections" ? await ctx.tree().holdTreeLock(work) : await work();
    print(io, ctx, result);
    return result.exitCode ?? EXIT.ok;
  } catch (err) {
    return printError(io, json, err, debug);
  }
}
