// CLI entry: find the command, parse options, run it, print the result,
// and commit what a writing command changed. Returns the exit code.

import { Cancelled, EXIT, StromError, UsageError } from "../core/errors.ts";
import { ownCommand, type Env } from "../core/paths.ts";
import { Context, type IO } from "./context.ts";
import { commands, type CommandDef, type Result } from "./registry.ts";
import { asCommand, asCommandJson } from "./format.ts";
import { groupHelpAs, helpAs } from "./help.ts";
import { autoCommit } from "./commit.ts";
import { assertIntact } from "../core/integrity.ts";
import { resetCache } from "../core/git.ts";
import { newerTree, Tree, VERSION } from "../core/tree.ts";
import { settleArchive } from "../core/mode.ts";
import { settleHypothesisLinks } from "../core/hypolinks.ts";
import { liveRunning, reviveLive, startLive } from "../core/live.ts";
import { fireHooks, HOOK_INTERFACE } from "../core/hooks.ts";
import { prependPath } from "../runners/runner.ts";
import { shimDir } from "../commands/session.ts";
import { isAgent } from "../core/which.ts";
import { appUrlShown, noticeStromApp } from "../core/stromapp.ts";
import { lastChannelOf, pendingTransition, updateChannel } from "../core/update.ts";
import { backupBefore, backupSaid } from "./backups.ts";
import { installation } from "../core/self.ts";
import { refreshGlobal } from "../agents/global.ts";
import { expandFromLine, refreshLinks } from "../core/links.ts";
import { clockLine, FINISH_LINE, finishAsked } from "../core/clock.ts";
import { currentSession } from "../core/session.ts";
import { callMistake, checkArgs, GroupOnly, parseOptions, resolveCommand, firstWord, splitPassthrough, usageOf } from "./execute.ts";
import { placeholders, UI, ui, type UIKey } from "./ui.ts";
import { catalog, localized, sayCommandAs } from "../core/phrases.ts";
import "../commands/index.ts";

export { splitCommand } from "./execute.ts";

/**
 * Besides the writing ones, the commands that start work or write into a research or beside it: none runs while the
 * backup before another channel or an older version could not be made.
 */
const STARTS_WORK = new Set(["menu", "run", "chat", "app", "live start", "init", "unpack", "trees remove", "compact", "repair", "seal adopt", "sync discard", "agents sync", "session finish", "link open"]);

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
      return new UsageError(`no permission to use${where}`, { hint: "a folder with the right to write in it", code: "fs.no-permission", params: { where } });
    case "EISDIR":
      return new UsageError(`a folder was given where a file is expected${where}`);
    case "ENOTDIR":
      return new UsageError(`a file was given where a folder is expected${where}`);
    case "ENOSPC":
      return new StromError(`the disk is full${where}`);
  }
  return undefined;
}

/**
 * An error with a code, as a person reads it: in the research's language (the same words whatever ran it — found on
 * Windows: a Czech research refusing a file in English); the English message where the language has no text, or the
 * text needs what the error does not carry. A program reads the English and the code (--json).
 */
function inLanguage(e: StromError, lang: string | undefined): { message: string; hint?: string; prefix?: string } {
  const key = `ui.error.${e.code}`;
  const own = (k: string) => (lang && e.code && k in UI && catalog(lang)[k] ? UI[k as UIKey] : undefined);
  const fits = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].every((m) => e.params?.[m[1]!] !== undefined);
  const message = own(key);
  if (!message || !fits(message)) return { message: e.message, ...(e.hint ? { hint: e.hint } : {}) };
  const hintKey = `ui.error.${e.hintCode ?? e.code}.hint`;
  const hint = e.hint && own(hintKey);
  // the word before it too, where the message is the person's language (never "chyba:" before English words), and
  // the placeholders of the commands it names (<input> → <podklad>)
  const say = (text: string) => placeholders(lang!, text);
  return { message: say(localized(lang!, key, message, e.params)), ...(e.hint ? { hint: say(hint ? localized(lang!, hintKey, hint, e.params) : e.hint) } : {}), prefix: ui(lang!, "ui.error.prefix") };
}

function printError(io: IO, json: boolean, err: unknown, debug: boolean, lang?: string): number {
  const e = err instanceof StromError ? err : (systemError(err as NodeJS.ErrnoException) ?? err);
  if (e instanceof StromError) {
    if (json) io.stdout(toJson(e.toJSON()));
    else if (e instanceof Cancelled) io.stderr(`${lang ? ui(lang, "ui.cancelled") : e.message}\n`); // the person's Ctrl-C: no error
    else {
      const said = inLanguage(e, lang);
      io.stderr(`${said.prefix ?? "error"}: ${said.message}\n`);
      const cands = (e.details as { candidates?: { label: string }[] } | undefined)?.candidates;
      if (cands) for (const c of cands) io.stderr(`  ${c.label}\n`);
      if (said.hint) for (const h of said.hint.split("\n")) io.stderr(`→ ${h}\n`);
      if (e.usage) io.stderr(`${e.usage}\n`);
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

/**
 * A second installation's own command (strom-beta): every command strom names to run next — doctor, errors, the
 * orientation, the menu, help — is said as that one is started (found on Windows: strom-beta doctor said strom …).
 */
function asOwnCommand(io: IO, name: string, json: boolean, argv: string[]): IO {
  const known = commands().map((c) => c.path[0]!).filter(Boolean);
  // a command strom does not know, as it was typed: its error names it as this one is started ("strom-beta xyz")
  const first = firstWord(argv[0] && !argv[0].startsWith("-") ? [...argv[0].trim().split(/\s+/), ...argv.slice(1)] : argv);
  const typed = first && !known.includes(first) ? first : undefined;
  const words = [...new Set(["help", "<command>", ...known, ...(typed ? [typed] : [])])];
  const text = (s: string) => asCommand(s, name, words);
  return { ...io, stdout: (s) => io.stdout(json ? asCommandJson(s, name, words) : text(s)), stderr: (s) => io.stderr(text(s)) };
}

export async function main(argv: string[], io: IO, env: Env, cwd: string): Promise<number> {
  const json = argv.includes("--json");
  const own = ownCommand(env);
  if (own) io = asOwnCommand(io, own, json, argv);
  // {strom} in a text: also in a window of the system or a file, which the output above does not pass
  sayCommandAs(own ?? "strom");
  const debug = argv.includes("--debug");
  resetCache(undefined, "command");
  // the app's install line in its one variable (STROM_FROM): read as the five of an older line
  expandFromLine(env);
  // what ran, for the reminder of the session's time
  let ran: Context | undefined;
  let command: string | undefined;
  let called: CommandDef | undefined;
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
        const c = Context.fromOptions({ env, cwd, io, json, values: {} });
        io.stdout(groupHelpAs(err.group, { archive: c.archiveHere(), human: false, lang: c.uiLang(), appUrl: appUrlShown(c.settings), pointer: io.tty && !isAgent(env) }) + "\n");
        return EXIT.ok;
      }
      throw err;
    }
    const { def } = resolved;
    called = def;
    const { rest, passthrough } = def.passthrough ? splitPassthrough(resolved.rest) : { rest: resolved.rest, passthrough: [] };
    const parsed = parseOptions(def, rest, own);
    const v = parsed.values;
    if (v.help) {
      // the agent's help, whoever asks (Milan, 2026-10-04: "výchozí je pro agenta"); a person at a terminal is told in a
      // line of their language how to get theirs (strom help <command> --human)
      const c = Context.fromOptions({ env, cwd, io, json, values: v });
      io.stdout(helpAs(def.path, { archive: c.archiveHere(), human: false, lang: c.uiLang(), appUrl: appUrlShown(c.settings), pointer: io.tty && !isAgent(env) }) + "\n");
      return EXIT.ok;
    }
    if (v.version) {
      io.stdout(json ? toJson({ version: VERSION }) : `strom ${VERSION}\n`);
      return EXIT.ok;
    }

    const ctx = Context.fromOptions({ env, cwd, io, json, values: v });
    // the IDs it names tell which session is the command's when its agent holds one in each of several researches
    ctx.refs = [...parsed.positionals, ...Object.values(v).flatMap((x) => (typeof x === "string" ? [x] : Array.isArray(x) ? x : []))]
      .flatMap((x) => String(x).split(",").map((y) => y.trim()))
      .filter((x) => /^[TNG]\d+$/i.test(x))
      .map((x) => `${x[0]!.toUpperCase()}${x.slice(1).padStart(4, "0")}`);
    ran = ctx;
    command = def.path.join(" ");
    // What is saved into a research, the user's hooks are told of (in the background).
    Tree.onCommit = (tree, ops, commit) => {
      if (!ctx.settings.config.hooks?.length || env.STROM_HOOK) return;
      // this strom on the hook's PATH: it reads more of what was saved (strom person card P0012)
      fireHooks(ctx.settings.shared()?.value, ctx.settings.config.hooks, prependPath(env, shimDir(tree)), {
        interface: HOOK_INTERFACE,
        tree: { name: tree.config.name, id: tree.config.id, root: tree.root, lang: tree.lang },
        commit,
        at: new Date().toISOString(),
        events: ops.map((o) => ({ op: o.op, targets: o.targets, summary: o.summary, at: o.at, by: o.by, ...(o.reason ? { reason: o.reason } : {}) })),
      });
    };
    // Started by the Strom app: remembered quietly (it is where the results go).
    if (env.STROM_APP) noticeStromApp(ctx.settings, env);
    // The first run of another strom — a newer one, or an older one (back from a beta): what it taught the agents
    // outside the trees gets this version's text, the links lead to it.
    const last = ctx.settings.config.lastVersion;
    // never in a strom that strom started itself (a bridge, a send it writes): those would start bridges that start
    // bridges (found on Mac: an update started one hundreds of times over) — and claimed first, once. Never from the
    // sources against the person's own settings either (only with settings of its own, STROM_CONFIG_DIR: a test, a
    // live test): a candidate being made is no update (found 2026-10-04: the test suite claimed one in the developer's)
    const fromSources = installation().kind === "source" && !env.STROM_CONFIG_DIR;
    // Another channel than last time, or an older version than the last one (back from a beta): every research and the
    // settings are backed up first — before this strom opens any of them, before any migration (Milan, 2026-10-07:
    // "přechod beta ↔ produkce nikdy nepřijde o data"). Made once (strom update made it already, or another strom of
    // this version a moment ago); in any strom of this version, a bridge too (it may write what the app sends).
    const channelNow = updateChannel(env);
    const pending = fromSources ? undefined : pendingTransition(ctx.settings.config, VERSION, channelNow);
    if (pending && ctx.settings.home()) {
      try {
        const made = backupBefore(ctx, pending);
        if (made) io.stderr(`${backupSaid(ctx, made)}\n`);
      } catch (e) {
        if (!(e instanceof StromError)) throw e;
        // nothing switches: no research opened for writing, none migrated, no work started — reading, help, doctor and
        // update go on (strom update --channel <the one before> goes back); tried again at the next run
        ctx.backupFailed = e;
      }
    }
    if (ctx.backupFailed && (def.writes || STARTS_WORK.has(def.path.join(" ")))) throw ctx.backupFailed;
    const lastChannel = lastChannelOf(ctx.settings.config);
    const otherChannel = !!lastChannel && lastChannel !== channelNow;
    if (ctx.settings.home() && !ctx.backupFailed && (last !== VERSION || otherChannel) && env.STROM_SPAWNED !== "1" && def.path.join(" ") !== "live serve" && !fromSources) {
      ctx.settings.config.lastVersion = VERSION;
      // …and its channel: another one than last time is a change of channel
      ctx.settings.config.lastChannel = updateChannel(env);
      ctx.settings.save();
      refreshGlobal(env);
      // …and the links from the Strom app lead to this strom again (where strom made them on this person's yes —
      // never another installation's: one with its own settings asks)
      try {
        refreshLinks(ctx.settings.config.links, env);
      } catch {
        // strom doctor says so
      }
      // …and the researches catch up with what this version keeps (an archive's tasks that wait put aside, logged)
      for (const k of ctx.knownTrees()) {
        // a research a newer strom wrote: kept as it is — nothing settled, no bridge started for it
        if (newerTree(k.root, env)) continue;
        try {
          settleArchive(Tree.open(k.root, env));
        } catch {
          // another computer's seal, a tree at work: its next bridge or switch settles it
        }
        // …and older hypotheses get the links of their variants their claims say beyond doubt, the rest a task (once)
        try {
          settleHypothesisLinks(Tree.open(k.root, env));
        } catch {
          // another computer's seal, a tree at work: its bridge's start settles it
        }
        // the bridges the Strom app follows go on with this version at their addresses: one of an older strom started
        // again, one the installer ended to replace the program (Windows: its files are held while it runs) back
        try {
          const running = liveRunning(k.root);
          if (running && running.version !== VERSION) startLive(k.root, env, { current: true });
          else if (!running) reviveLive(k.root, env);
        } catch {
          // its next session brings it back (reviveLive)
        }
      }
    }
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
      // what it did otherwise than asked (a long note kept as several): said under its output
      const notices = ctx.current()?.notices ?? [];
      if (notices.length) {
        result.text = result.text ? `${result.text.replace(/\n+$/, "")}\n${notices.join("\n")}` : notices.join("\n");
        if (result.data && typeof result.data === "object" && !Array.isArray(result.data)) result.data = { ...(result.data as object), notices: [...notices] };
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
    // a dry run says so, last, in the person's language — it reads as what would happen, never as done (found on
    // Windows: "taken back" of a dry run, nothing told it apart)
    if (ctx.dryRun) {
      const said = ui(ctx.uiLang(), "ui.dry.done");
      result.text = result.text?.trim() ? `${result.text.replace(/\n+$/, "")}\n\n${said}` : said;
      if (result.data && typeof result.data === "object" && !Array.isArray(result.data)) result.data = { ...(result.data as object), dryRun: true };
    }
    print(io, ctx, result);
    remind(io, ctx, command);
    return result.exitCode ?? EXIT.ok;
  } catch (err) {
    let lang: string | undefined;
    try {
      // an unknown command or option has no context yet: the person's language all the same
      lang = (ran ?? Context.fromOptions({ env, cwd, io, json, values: {} })).uiLang();
    } catch {
      // no language to say it in: English
    }
    // a person at a terminal who typed a command strom does not know: their help (strom help --human), or the menu —
    // an agent the catalog, as ever (found on Mac: "→ strom help" in English for a person)
    const said = err instanceof UsageError && err.code === "command.unknown" && io.tty && !isAgent(env)
      ? new UsageError(err.message, { hint: "strom help --human — or just strom: the menu", code: "command.unknown.person", params: err.params })
      : err;
    // a mistake in calling it (an option it needs, a value it does not take): its usage under it, no strom help needed
    if (said instanceof UsageError && !said.usage && called?.path.length && callMistake(said, called)) said.usage = usageOf(called, own);
    // the usage is the agent's (or a program's): a person reads the error and its hint in their language, no English
    if (said instanceof StromError && said.usage && !json && !isAgent(env)) said.usage = undefined;
    const code = printError(io, json, said, debug, lang);
    remind(io, ran, command);
    return code;
  }
}

/**
 * Near the end of a session with a time limit (strom run), every command reminds the agent how long it has left;
 * a session the user asked to finish (strom session finish) is told to write down and close, from its next command.
 */
function remind(io: IO, ctx: Context | undefined, command: string | undefined): void {
  if (!ctx || command === "session close" || command === "session finish") return;
  const session = ctx.env.STROM_SESSION;
  if (session) {
    try {
      const root = ctx.locateTree();
      if (root && finishAsked(root, session)) {
        io.stderr(FINISH_LINE + "\n");
        return;
      }
    } catch {
      // no tree here: only the clock
    }
  }
  const line = clockLine(ctx.env);
  if (!line) return;
  try {
    // closed already: nothing to remind of
    if (ctx!.hasTree() && !currentSession(ctx!.tree(), ctx!.env, ctx!.refs)) return;
  } catch {
    return;
  }
  io.stderr(line + "\n");
}
