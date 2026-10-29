// CLI entry: find the command, parse options, run it, print the result,
// and commit what a writing command changed. Returns the exit code.

import fs from "node:fs";
import { takeOverConnectors } from "../core/terms.ts";
import { agentInAncestry, ancestryUnread, notePersonFolder } from "../core/trust.ts";
import { netTrust } from "../core/net.ts";
import { connectorsDir, listConnectors } from "../core/connector.ts";
import path from "node:path";
import { Cancelled, diskFull, DISK_FULL, EXIT, folderOf, isDiskFull, notFound, StromError, UsageError } from "../core/errors.ts";
import { ownCommand, type Env } from "../core/paths.ts";
import { Context, type IO } from "./context.ts";
import { commands, match, type CommandDef, type Result } from "./registry.ts";
import { asCommand, asCommandJson, shellArg } from "./format.ts";
import { groupHelpAs, helpAs } from "./help.ts";
import { autoCommit } from "./commit.ts";
import { assertIntact } from "../core/integrity.ts";
import { head as gitHead, resetCache } from "../core/git.ts";
import type { HeldError } from "../core/json.ts";
import { newerTree, Tree, VERSION } from "../core/tree.ts";
import { settleArchive } from "../core/mode.ts";
import { startTiming, stepEnd, stepStart, stopTiming, timed, timingOn } from "../core/timing.ts";
import { timingSaid } from "./timing.ts";
import { raiseHypothesisLinkTasks, settleHypothesisLinks } from "../core/hypolinks.ts";
import { liveRunning, reviveLive, startLive } from "../core/live.ts";
import { revivePhone } from "../core/phone.ts";
import { fireHooks, HOOK_INTERFACE } from "../core/hooks.ts";
import { prependPath } from "../runners/runner.ts";
import { shimDir } from "../commands/session.ts";
import { isAgent } from "../core/which.ts";
import { noPermission } from "../core/writable.ts";
import { completePath, pathOf, pathToRemember } from "../core/userpath.ts";
import { appUrlShown, noticeStromApp } from "../core/stromapp.ts";
import { lastChannelOf, pendingTransition, updateChannel, whatsNewUrl } from "../core/update.ts";
import { backupBefore, backupSaid } from "./backups.ts";
import { guestOf, installation, ownFolder, refreshTreeShim } from "../core/self.ts";
import { refreshGlobal } from "../agents/global.ts";
import { expandFromLine, refreshLinks } from "../core/links.ts";
import { clockLine, FINISH_LINE, finishLimitLine, finishOf, timeLine } from "../core/clock.ts";
import { currentSession } from "../core/session.ts";
import { backgroundOf } from "../core/fetching.ts";
import { callMistake, checkArgs, GroupOnly, parseOptions, resolveCommand, firstWord, severalRecords, splitPassthrough, usageOf } from "./execute.ts";
import { placeholders, UI, ui, type UIKey } from "./ui.ts";
import { catalog, localized, placeholdersOf, sayCommandAs } from "../core/phrases.ts";
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

/**
 * File-system errors in plain words (a missing @file, a folder without rights — under an agent most likely its
 * sandbox, core/writable.ts).
 */
function systemError(e: HeldError, agent: Env | false): StromError | undefined {
  const where = e.path ? `: ${e.path}` : "";
  // a file another program held past the waits (Windows: an antivirus, a sync tool, an editor) — no lack of rights:
  // running it again does it (what the command wrote was taken back)
  if (e.heldFile) return new StromError(`another program is holding ${e.heldFile} (an antivirus, a sync or backup tool, an editor)`, { hint: "run the same command again in a moment — nothing of it was saved", code: "fs.held", params: { file: e.heldFile } });
  switch (e.code) {
    case "ENOENT":
      return e.path ? notFound(e.path) : new UsageError("no such file or folder", { hint: "check the path (relative paths start in the current folder)" });
    case "EACCES":
    case "EPERM":
    case "EROFS":
      // git not let to start under an agent: said as the research's folder (underAgent)
      return noPermission((agent && e.gitFolder) || e.path, agent);
    case "EISDIR":
      return new UsageError(`a folder was given where a file is expected${where}`, { code: "fs.folder", ...(e.path ? { params: { path: e.path } } : {}) });
    case "ENOTDIR":
      return new UsageError(`a file was given where a folder is expected${where}`);
  }
  return undefined;
}

/**
 * An error with a code, as a person reads it: in the research's language (found on Windows: a Czech research refusing
 * a person's file in English); the English message where the language has no text, or the text needs what the error
 * does not carry. The boundary (Milan, 2026-10-18): an error a person reads — a terminal, the menu, a script with no
 * agent — is in the research's language; an error an agent reads (isAgent: an agent's shell or a session strom
 * started, its fetch in the background too) is English, "error:" and its hint; a program reads the English and the
 * code (--json).
 */
function inLanguage(e: StromError, lang: string | undefined): { message: string; hint?: string; prefix?: string } {
  const key = `ui.error.${e.code}`;
  // a person in English (a research in English, or in a language strom has no catalog of) reads the person's English
  // text built in, as a person in Czech reads the Czech one — never the agent's message (found 2026-10-23: a seal
  // taken elsewhere said "consent required" and "ask the user" to a person in English)
  const english = lang !== undefined && Object.keys(catalog(lang)).length === 0;
  const own = (k: string) => (lang && e.code && k in UI && (english || catalog(lang)[k]) ? UI[k as UIKey] : undefined);
  const fits = (text: string) => placeholdersOf(text).every((name) => e.params?.[name] !== undefined);
  const message = own(key);
  if (!message || !fits(message)) return { message: e.message, ...(e.hint ? { hint: e.hint } : {}) };
  const hintKey = `ui.error.${e.hintCode ?? e.code}.hint`;
  const hint = e.hint && own(hintKey);
  // the word before it too, where the message is the person's language (never "chyba:" before English words), and
  // the placeholders of the commands it names (<input> → <podklad>)
  const say = (text: string) => placeholders(lang!, text);
  return { message: say(localized(lang!, key, message, e.params)), ...(e.hint ? { hint: say(hint ? localized(lang!, hintKey, hint, e.params) : e.hint) } : {}), prefix: ui(lang!, "ui.error.prefix") };
}

const REFUSALS = new Set(["fs.no-permission", "git.unwritable", "init.unwritable"]);

/**
 * A refusal to write under an agent: most likely its sandbox — said so, with what the agent does (core/writable.ts).
 * Without an agent's marks, an agent among strom's parent processes (read here only, on a refusal: found on Windows,
 * Codex's sandbox ran strom with none of its marks) is named to the person as the likely cause — not certain, so
 * the other causes after it.
 */
function underAgent(e: StromError, env: Env, gitFolder?: string): StromError {
  if (!REFUSALS.has(e.code ?? "")) return e;
  // git not let to start under an agent: the research's folder is where (found on Windows: "…\Git\cmd\git.exe"),
  // what the agent's sandbox is to let strom use; with no agent the program refused stays said (an antivirus)
  const where = gitFolder ?? e.params?.where;
  if (isAgent(env)) return noPermission(where, env);
  const above = agentInAncestry(env);
  if (above) return noPermission(where, false, process.platform, above);
  return ancestryUnread(env) ? noPermission(where, false, process.platform, "?") : e;
}

/** Where a full disk is said: the research's folder when the file lies in it, else the folder of the file (the shared images), else the research's. */
function fullAt(file: string | undefined, root: string | undefined): string {
  const rel = file && root ? path.relative(root, path.resolve(file)) : undefined;
  const inRoot = rel !== undefined && !rel.startsWith("..") && !path.isAbsolute(rel);
  if (file && !inRoot) return folderOf(file);
  return root ?? process.cwd();
}

function printError(io: IO, json: boolean, err: unknown, debug: boolean, lang: string | undefined, env: Env, folder?: string): number {
  const agent = isAgent(env) && env;
  // no room on the disk, whatever met it (a write of strom's, git, a lock): said one way, the research's folder named,
  // never strom's inner file (found on Mac: "the disk is full: …/.strom/tree.lock.….tmp" in English in a Czech research)
  const full = isDiskFull(err) && !(err instanceof StromError && err.code === DISK_FULL) ? diskFull(fullAt((err as HeldError).path, folder)) : undefined;
  const sys = full ?? (err instanceof StromError ? err : (systemError(err as HeldError, agent) ?? err));
  const e = sys instanceof StromError ? underAgent(sys, env, (err as HeldError | undefined)?.gitFolder) : sys;
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

/**
 * strom --version: the version on its first line (what a script reads), then where to read what is new in it — the
 * changelog in the research language, on the branch of the installation's channel. --json gives the version alone.
 */
function versionSaid(env: Env, cwd: string, io: IO, values: Record<string, string | boolean | string[] | undefined> = {}): string {
  const first = `strom ${VERSION}\n`;
  try {
    const lang = Context.fromOptions({ env, cwd, io, json: false, values }).uiLang();
    return `${first}${ui(lang, "ui.update.whatsnew", { url: whatsNewUrl(VERSION, updateChannel(env), lang) })}\n`;
  } catch {
    // no settings to read: the version alone
    return first;
  }
}

export async function main(argv: string[], io: IO, env: Env, cwd: string): Promise<number> {
  // measured from the start (strom --timing, STROM_TIMING=1): how long each step took, said at the end
  const timing = env.STROM_TIMING === "1" || argv.includes("--timing");
  if (timing) startTiming();
  try {
    return await mainOf(argv, io, env, cwd);
  } finally {
    if (timing) stopTiming();
  }
}

async function mainOf(argv: string[], io: IO, env: Env, cwd: string): Promise<number> {
  const json = argv.includes("--json");
  const own = ownCommand(env);
  if (own) io = asOwnCommand(io, own, json, argv);
  // {strom} in a text: also in a window of the system or a file, which the output above does not pass
  sayCommandAs(own ?? "strom");
  const debug = argv.includes("--debug");
  resetCache(undefined, "command");
  // the app's install line in its one variable (STROM_FROM): read as the five of an older line
  expandFromLine(env);
  // what ran and how long, for the reminder of the session's time
  const startedAt = Date.now();
  let ran: Context | undefined;
  let command: string | undefined;
  let called: CommandDef | undefined;
  try {
    // "strom 'person list'" (one quoted word) means the same as strom person list.
    if (argv[0] && !argv[0].startsWith("-") && /\s/.test(argv[0].trim())) argv = [...argv[0].trim().split(/\s+/), ...argv.slice(1)];
    // A person at a terminal gets the guided menu; an agent, a script or the app the orientation.
    // (strom --timing alone: the menu, measured)
    if ((argv.length === 0 || (argv.length === 1 && argv[0] === "--timing")) && io.tty && !isAgent(env) && env.STROM_NONINTERACTIVE !== "1") argv = ["menu", ...argv];
    if (argv.length === 1 && (argv[0] === "--version" || argv[0] === "-v")) {
      io.stdout(json ? toJson({ version: VERSION }) : versionSaid(env, cwd, io));
      return EXIT.ok;
    }
    let resolved;
    try {
      resolved = resolveCommand(argv);
    } catch (err) {
      if (err instanceof GroupOnly) {
        const c = Context.fromOptions({ env, cwd, io, json, values: {} });
        io.stdout(groupHelpAs(err.group, { ...c.helpShown(), human: false, lang: c.uiLang(), appUrl: appUrlShown(c.settings), pointer: io.tty && !isAgent(env) }) + "\n");
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
      io.stdout(helpAs(def.path, { ...c.helpShown(), human: false, lang: c.uiLang(), appUrl: appUrlShown(c.settings), pointer: io.tty && !isAgent(env) }) + "\n");
      return EXIT.ok;
    }
    if (v.version) {
      io.stdout(json ? toJson({ version: VERSION }) : versionSaid(env, cwd, io, v));
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
    // What the user does in their own terminal (a login, the seal, a plugin installed): refused to an agent here, after
    // every option is read — the agents' rules match only what follows the command's name (strom --json seal adopt
    // passed Codex's), so they are a second layer and strom the first
    if (def.refusesFirst) def.refusesFirst(ctx, { args: parsed.positionals, opts: v });
    if (def.person && isAgent(env)) {
      const said = (def.options ?? []).flatMap((o) => (v[o.name] === undefined || v[o.name] === false ? [] : o.type === "boolean" ? [`--${o.name}`] : [`--${o.name}`, String(v[o.name])]));
      ctx.requireHuman(def.person, ["strom", ...def.path, ...[...parsed.positionals, ...said].map(shellArg)].join(" "), def.path[0]!, undefined, { window: false });
    }
    // The PATH of the person's terminal remembered (never an agent's, a hook's, one strom started); a strom the system
    // started (a link from the Strom app, the bridge, the phone's server) gets what of it is missing — and so do the
    // agents and readers it starts (core/userpath.ts)
    if (io.tty && !isAgent(env) && env.STROM_SPAWNED !== "1" && v.hook !== true && ctx.settings.home()) {
      const remember = pathToRemember(env, ctx.settings.config.terminalPath);
      if (remember) {
        try {
          ctx.settings.config.terminalPath = remember;
          ctx.settings.save();
        } catch {
          // remembered next time
        }
      }
    }
    // the PATH as given, before it is made fuller: what the terminal strom was started from knows (the menu's goodbye)
    ctx.givenPath = pathOf(env);
    completePath(env, ctx.settings.config.terminalPath);
    // a person's own pace for a host taken as given until a command to an archive finds settings not the person's
    netTrust.ownPace = true;
    // the person's own settings folder (another than their default one, outside an agent): listed as theirs, so that an
    // agent's command there later reads its permissions (core/trust.ts) — never for a hook's quick answer
    if (!(v.hook === true)) {
      try {
        notePersonFolder(env, { cwd });
      } catch {
        // asked again next time
      }
    }
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
    // …nor in a strom that is a guest of another installation's settings (npm's beside the installer's, the sources
    // with the person's settings): what the installer's strom set up stays its own — its channel, its links, its shims
    const guest = guestOf(ctx.settings.config.lastProgram);
    // Another channel than last time, or an older version than the last one (back from a beta): every research and the
    // settings are backed up first — before this strom opens any of them, before any migration (Milan, 2026-10-07:
    // "přechod beta ↔ produkce nikdy nepřijde o data"). Made once (strom update made it already, or another strom of
    // this version a moment ago); in any strom of this version, a bridge too (it may write what the app sends).
    const channelNow = updateChannel(env);
    // an agent's hook (strom net web --hook, before each of its web requests; strom agents delegate --hook, before each
    // subagent call) does none of a new version's first run: it answers within the hook's time and changes nothing
    // outside the research's measurements
    const hook = (command === "net web" || command === "agents delegate") && v.hook === true;
    const pending = fromSources || hook || guest ? undefined : pendingTransition(ctx.settings.config, VERSION, channelNow);
    if (pending && ctx.settings.home()) {
      try {
        const made = timed("start.backup", () => backupBefore(ctx, pending));
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
    if (ctx.settings.home() && !ctx.backupFailed && (last !== VERSION || otherChannel) && env.STROM_SPAWNED !== "1" && def.path.join(" ") !== "live serve" && !fromSources && !hook && !guest) {
      // (measured: strom --timing — a first run that never ends as one, its settings not kept, is here each time)
      stepStart("start.newversion");
      // the connectors here when this strom first runs: taken over as they are — they run as before, the person
      // confirms them once (core/terms.ts); a strom new on this computer takes over none (every connector is new)
      try {
        // (read where the plugins folder is: nothing made on the disk before the setup makes it)
        const sharedNow = ctx.settings.shared()?.value;
        takeOverConnectors(env, sharedNow && fs.existsSync(connectorsDir(sharedNow)) ? listConnectors(sharedNow, env) : [], last === undefined);
      } catch {
        // asked again at the first look at an archive
      }
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
        // …and the tasks an older strom made to say those links come first in the queue (once), then older hypotheses get
        // the links of their variants their claims say beyond doubt, the rest a task (once)
        try {
          raiseHypothesisLinkTasks(Tree.open(k.root, env));
        } catch {
          // another computer's seal, a tree at work: its bridge's start raises them
        }
        try {
          settleHypothesisLinks(Tree.open(k.root, env));
        } catch {
          // another computer's seal, a tree at work: its bridge's start settles it
        }
        // …and the strom its agents' hooks and conversations start (.strom/bin) leads to this one — an older strom's, or one
        // whose mark went with the program folder an update replaced; only where a research has one, never an archive
        refreshTreeShim(k.root, env);
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
      // …and the phone's server, when the connection is on (it starts again with this version by itself; one the
      // installer ended to replace the program back) — not by the server itself, which would start a second one beside it
      if (def.path.join(" ") !== "phone serve") {
        try {
          revivePhone(env);
        } catch {
          // its next bridge brings it back
        }
      }
      stepEnd();
    }
    // the folder of the program that runs with these settings (from a strom that ran here before it was kept, once):
    // another installation that runs here later is their guest
    if (ctx.settings.home() && !ctx.backupFailed && env.STROM_SPAWNED !== "1" && !fromSources && !hook && !guest && ctx.settings.config.lastProgram !== ownFolder()) {
      try {
        ctx.settings.config.lastProgram = ownFolder();
        ctx.settings.save();
      } catch {
        // kept next time
      }
    }
    const args = parsed.positionals;
    // several IDs to a show command of one record (person show P0001 P0002): each shown in turn, as strom show does
    const shows = severalRecords(def, args) ? match(["show"])?.def : undefined;
    if (!shows) checkArgs(def, args, parsed.fix, own, parsed.values);

    if (def.writes && v["dry-run"]) ctx.dryRun = true;
    const work = async (): Promise<Result> => {
      // Never write on top of data that was changed outside strom.
      // (a command that locks only while it writes looks under the lock too: another strom may be in the middle of a write)
      if (def.writes && def.tree) def.lock === "sections" ? ctx.tree().withTreeLock(() => assertIntact(ctx.tree())) : assertIntact(ctx.tree());
      let result: Result;
      let blocked: ReturnType<typeof autoCommit>;
      // a write of the Strom app's (through the bridge, which holds the tree from its first read to its commit): the
      // research's head before it and after it, for the app to take its own write as its version only when nothing
      // came between (found: "the research has a newer version" after every file the app assigned)
      const forApp = def.writes && def.tree && def.lock !== "sections" && !ctx.dryRun && env.STROM_FOR_APP === "1";
      const headNow = () => {
        const root = ctx.tree().root;
        resetCache(root);
        return gitHead(root) ?? "";
      };
      const parent = forApp ? headNow() : undefined;
      try {
        result = await (shows ?? def).run(ctx, { args, opts: v, ...(passthrough.length ? { extra: passthrough } : {}), ...(parsed.seq ? { seq: parsed.seq } : {}) });
        // its commit is part of it: one that fails (found on Windows: _counters.json held by another program, its IDs
        // not written) takes back what the command wrote — a person or an agent running it again gets no second record
        if (def.writes) blocked = autoCommit(ctx, def);
        if (parent !== undefined && !blocked && result.data && typeof result.data === "object" && !Array.isArray(result.data)) result.data = { ...(result.data as object), commit: { head: headNow(), parent } };
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
      if (blocked) {
        // The agent must notice: an uncommitted write is not part of the research yet.
        result.text = result.text ? `${result.text}\n${blocked.message}` : blocked.message;
        result.data = { ...((result.data as object | undefined) ?? {}), status: "not-committed", problems: blocked.problems, hint: "strom check" };
        result.exitCode = EXIT.error;
      }
      return result;
    };
    // Other strom processes may write to the same tree (other agents, a run): a writing
    // command has the tree to itself from its first read to its commit.
    const result = def.writes && def.tree && def.lock !== "sections" ? await ctx.tree().holdTreeLock(work) : await work();
    // a dry run says so, last, in the person's language — it reads as what would happen, never as done (found on
    // Windows: "taken back" of a dry run, nothing told it apart); an agent reads it in English, as the rest
    if (ctx.dryRun) {
      const said = ui(isAgent(env) ? "en" : ctx.uiLang(), "ui.dry.done");
      result.text = result.text?.trim() ? `${result.text.replace(/\n+$/, "")}\n\n${said}` : said;
      if (result.data && typeof result.data === "object" && !Array.isArray(result.data)) result.data = { ...(result.data as object), dryRun: true };
    }
    print(io, ctx, result);
    // the menu said it when it was first shown
    if (timingOn() && command !== "menu") io.stderr(`${timingSaid(isAgent(env) ? "en" : ctx.uiLang())}\n`);
    if (!hook) remind(io, ctx, command, Date.now() - startedAt);
    return result.exitCode ?? EXIT.ok;
  } catch (err) {
    let lang: string | undefined;
    try {
      // an unknown command or option has no context yet: the person's language all the same — an agent (its shell, a
      // session strom started, a fetch in the background writing into the log the agent reads) the English it goes by
      if (!backgroundOf(env) && !isAgent(env)) lang = (ran ?? Context.fromOptions({ env, cwd, io, json, values: {} })).uiLang();
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
    const code = printError(io, json, said, debug, lang, env, ran?.openedRoot());
    remind(io, ran, command, Date.now() - startedAt);
    return code;
  }
}

/**
 * Near the end of a session with a time limit (strom run), every command reminds the agent how long it has left;
 * a session the user asked to finish (strom session finish) is told to write down and close, from its next command.
 */
function remind(io: IO, ctx: Context | undefined, command: string | undefined, ranMs: number): void {
  if (!ctx || command === "session close" || command === "session finish") return;
  const session = ctx.env.STROM_SESSION;
  let root: string | undefined;
  if (session) {
    try {
      root = ctx.locateTree();
      const asked = root ? finishOf(root, session) : undefined;
      if (asked) {
        io.stderr((asked.by === "limit" ? finishLimitLine(asked.why) : FINISH_LINE) + "\n");
        return;
      }
    } catch {
      // no tree here: only the clock
    }
  }
  // before the reminders, the time left after a long step (and now and then): the agent never estimates it
  const line = clockLine(ctx.env) ?? timeLine(ctx.env, { ranMs, root, session });
  if (!line) return;
  try {
    // closed already: nothing to remind of
    if (ctx!.hasTree() && !currentSession(ctx!.tree(), ctx!.env, ctx!.refs)) return;
  } catch {
    return;
  }
  io.stderr(line + "\n");
}
