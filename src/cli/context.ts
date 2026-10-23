// Per-invocation context: environment, settings, IO, and lazy access to the
// tree. Asking the user happens only here, and only on a terminal.

import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { Writable } from "node:stream";
import { Settings, type Flags } from "../core/config.ts";
import { configDir, displayPath, expandHome, ISOLATED_HOME, type Env } from "../core/paths.ts";
import { backupsDir } from "../core/backup.ts";
import { insideProgram } from "../core/self.ts";
import { Cancelled, InputEnded, NeedsConsentError, NeedsInputError, StromError, UsageError } from "../core/errors.ts";
import { migrate } from "../core/migrate.ts";
import { Tree, findTreeUpwards, isTreeDir, knownTreesIn } from "../core/tree.ts";
import { SCHEMA_VERSION, type TreeConfig } from "../core/model.ts";
import { canonicalize, readJsonIfExists } from "../core/json.ts";
import { foldText } from "../core/text.ts";
import { currentSession } from "../core/session.ts";
import { isAgent } from "../core/which.ts";
import { stateOf, treeAgentHere } from "../core/state.ts";
import { canShowDialog, systemDialog, WAIT_SECONDS, type ChoiceText, type DialogText } from "../core/dialog.ts";
import { UI, ui, type UIKey } from "./ui.ts";
import { DEFAULT_LIMIT } from "./format.ts";

export interface IO {
  stdout: (s: string) => void;
  stderr: (s: string) => void;
  /** Interactive terminal on both ends. */
  tty: boolean;
  /** Test hook: scripted answers instead of reading stdin. */
  answers?: string[];
  /** Text piped into strom (for `strom batch`); undefined on a terminal. */
  stdinText?: () => string;
  stdin?: NodeJS.ReadableStream;
  /** Test hook: the answer of the window of a consent (true yes, false no, undefined no window). */
  dialog?: (text: DialogText) => boolean | undefined;
  /** Test hook: the answer of a window with choices (the key chosen, null none — later, Esc, no answer —, undefined no window). */
  choice?: (text: ChoiceText) => string | null | undefined;
}

export interface KnownTree {
  name: string;
  root: string;
  lang: string;
}

export class Context {
  readonly env: Env;
  readonly cwd: string;
  readonly io: IO;
  readonly settings: Settings;
  readonly json: boolean;
  readonly yes: boolean;
  readonly treeFlag: string | undefined;
  readonly limit: number;
  readonly page: number;
  dryRun = false;
  /** The record IDs the command names (T…, N…, G…): which of an agent's sessions in several researches is its. */
  refs: string[] = [];
  /** The PATH this strom was given (before core/userpath.ts made it fuller): what the terminal it runs in knows. */
  givenPath: string | undefined;
  private opened: Tree | undefined;
  /**
   * The backup before another channel or an older version could not be made (cli/backups.ts): no research is brought
   * to this strom's schema meanwhile — reading one that needs it says why, as writing does.
   */
  backupFailed: StromError | undefined;

  constructor(opts: {
    env: Env;
    cwd: string;
    io: IO;
    flags: Flags;
    json: boolean;
    yes: boolean;
    tree?: string | undefined;
    limit?: number | undefined;
    page?: number | undefined;
  }) {
    this.env = opts.env;
    this.cwd = opts.cwd;
    this.io = opts.io;
    this.settings = new Settings(opts.env, opts.flags);
    this.json = opts.json;
    this.yes = opts.yes;
    this.treeFlag = opts.tree;
    this.limit = opts.limit ?? DEFAULT_LIMIT;
    this.page = opts.page ?? 1;
  }

  /** A context from parsed command-line values (global options and settings flags). */
  static fromOptions(o: { env: Env; cwd: string; io: IO; json: boolean; values: Record<string, string | boolean | string[] | undefined> }): Context {
    const v = o.values;
    const str = (k: string) => (typeof v[k] === "string" ? (v[k] as string) : undefined);
    const positive = (k: string) => {
      const raw = str(k);
      if (raw === undefined) return undefined;
      const n = Number(raw);
      if (!Number.isInteger(n) || n < 1) throw new UsageError(`--${k} must be a positive number`);
      return n;
    };
    return new Context({
      env: o.env,
      cwd: o.cwd,
      io: o.io,
      flags: {
        home: str("home"),
        shared: str("shared"),
        trees: str("trees"),
        lang: str("lang"),
        agent: str("agent"),
        model: str("model"),
        budget: str("budget"),
        minutes: str("minutes"),
      },
      json: o.json,
      yes: Boolean(v.yes),
      tree: str("tree"),
      limit: positive("limit"),
      page: positive("page"),
    });
  }

  /** Can we ask the user a question right now? */
  get interactive(): boolean {
    return (this.io.tty || this.io.answers !== undefined) && !this.yes && !this.json && this.env.STROM_NONINTERACTIVE !== "1";
  }

  async ask(question: string, suggested?: string): Promise<string> {
    const prompt = suggested ? `${question} [${suggested}] ` : `${question} `;
    let answer: string;
    if (this.io.answers) {
      this.io.stdout(prompt + "\n");
      answer = this.io.answers.shift() ?? "";
      if (answer === "\u0003") throw new Cancelled(); // Ctrl-C, as a test types it
    } else {
      const rl = readline.createInterface({ input: this.io.stdin ?? process.stdin, output: process.stdout });
      // the input ending before an answer (stdin closed, used up) settles the question too — never a question left
      // open; a moment later, so Ctrl-C at a terminal (it closes the line first) stays the person's Ctrl-C
      const ended = new Promise<never>((_, reject) => rl.once("close", () => setImmediate(() => reject(new InputEnded()))));
      ended.catch(() => undefined);
      try {
        answer = await Promise.race([rl.question(prompt), ended]);
      } catch (err) {
        // Ctrl-C at the question (Node: "Aborted with Ctrl+C", found on Mac as the menu's "that did not work")
        if ((err as { code?: string }).code === "ABORT_ERR") {
          process.stdout.write("\n");
          throw new Cancelled();
        }
        throw err;
      } finally {
        rl.close();
      }
    }
    answer = answer.trim();
    return answer === "" ? (suggested ?? "") : answer;
  }

  /** A question whose answer is not shown as it is typed (a password): kept as typed, spaces too. */
  async askSecret(question: string): Promise<string> {
    if (this.io.answers) {
      this.io.stdout(`${question} \n`);
      return this.io.answers.shift() ?? "";
    }
    let muted = false;
    const quiet = new Writable({
      write(chunk, encoding, done) {
        if (!muted) process.stdout.write(chunk, encoding);
        done();
      },
    });
    const rl = readline.createInterface({ input: this.io.stdin ?? process.stdin, output: quiet, terminal: true });
    try {
      const answer = rl.question(`${question} `);
      muted = true;
      return (await answer).replace(/[\r\n]+$/, "");
    } finally {
      rl.close();
      process.stdout.write("\n");
    }
  }

  /** The language of the person using strom: the tree's (research language), else theirs. */
  uiLang(): string {
    let tree: TreeConfig | undefined;
    try {
      const root = this.locateTree();
      if (root) tree = readJsonIfExists<TreeConfig>(path.join(root, "strom.json"));
    } catch {
      // no tree to say
    }
    return this.settings.lang(tree).value;
  }

  /**
   * An archive here: the tree worked on is one (else, with none, the person's setting for new researches) — what is
   * shown then says nothing of an agent or AI (Milan's decision, 2026-10-03).
   */
  archiveHere(): boolean {
    try {
      const root = this.locateTree();
      if (root) return readJsonIfExists<TreeConfig>(path.join(root, "strom.json"))?.mode === "archive";
    } catch {
      // no tree to say
    }
    return this.settings.config.mode === "archive";
  }

  /**
   * Shown as an archive here: an archive, or the research worked on waiting for its agent (not on this computer) —
   * nothing offered that needs the agent (its working alone, the downloaders), the way to the agent offered instead.
   */
  actsAsArchive(): boolean {
    if (this.archiveHere()) return true;
    try {
      const root = this.locateTree();
      if (root) return !treeAgentHere(readJsonIfExists<TreeConfig>(path.join(root, "strom.json")), this.env);
    } catch {
      // no tree to say
    }
    return false;
  }

  /**
   * How help is shown here (Milan, 2026-10-23): an archive's help in an archive, and in a research waiting for its
   * agent too (nothing offered it would refuse) — never to an agent strom is run by, which always reads its whole
   * catalog where research is on (the agent there makes it research again).
   */
  helpShown(): { archive: boolean; waiting: boolean } {
    if (this.archiveHere()) return { archive: true, waiting: false };
    if (isAgent(this.env)) return { archive: false, waiting: false };
    try {
      const root = this.locateTree();
      const config = root ? readJsonIfExists<TreeConfig>(path.join(root, "strom.json")) : undefined;
      if (root && config && stateOf({ config, env: this.env, root }) === "waiting") return { archive: true, waiting: true };
    } catch {
      // no tree to say
    }
    return { archive: false, waiting: false };
  }

  /**
   * A consent is the user's. In their own terminal they gave it by running the
   * command. Anywhere else — an agent's session, the app — the person at the
   * screen is asked in a window of the system, which the agent can neither see
   * nor click. Without a window (no desktop, a run nobody watches) it fails:
   * the user runs the command themselves. `says` is the question in the
   * user's language — all the window shows, so it holds any warning too.
   * `window: false` for what needs the user's terminal (typing a password).
   * What opens the computer outward, costs or runs another's code asks their yes in the terminal too: requireHumanYes.
   */
  requireHuman(question: string, set: string, key: string, says?: string, opts: { window?: boolean } = {}): "terminal" | "window" {
    const agent = isAgent(this.env);
    if (this.interactive && !agent) return "terminal";
    // a window only where one can be shown (the test's own answer stands for one): else nothing said to wait in it
    if (this.env.STROM_NONINTERACTIVE !== "1" && opts.window !== false && (this.io.dialog || canShowDialog(this.env))) {
      const lang = this.uiLang();
      const text: DialogText = { title: ui(lang, "ui.dialog.title"), question: says ?? question, yes: ui(lang, "ui.dialog.yes"), no: ui(lang, "ui.dialog.no") };
      // said first where it runs: a window can be behind others, and the command waits for it without a word
      this.io.stderr(`${ui(lang, "ui.dialog.waiting", { minutes: String(WAIT_SECONDS / 60), question: text.question })}\n`);
      const answer = this.io.dialog ? this.io.dialog(text) : systemDialog(text, this.env);
      if (answer === true) return "window";
      // said no: an agent reads the English and what not to do; a person (the app, a script) their language — nothing
      // changed and how to ask again (printError: ui.error.consent.refused), never the agent's English under it
      if (answer === false)
        throw new StromError(ui("en", "ui.error.consent.refused"), { hint: `the user said no to: ${question} — do not ask again unless they want to`, code: "consent.refused", params: { set } });
    }
    // a person (a script, no terminal) reads it in their language; an agent the English it goes by
    // a run nobody watches: nobody to say yes before it ends — a task for it, for the user to see, and on another way
    const run = this.env.STROM_NONINTERACTIVE === "1" && !!this.env.STROM_SESSION;
    const q = (t: string) => `"${t.replace(/["\\$`]/g, "")}"`;
    const task = run
      ? `nobody watches this run to say yes: add a task for it and go on another way — strom task add ${q(`The user's consent: ${set}`)} --level locate --where ${q(set)} --why ${q(question)} --done-when ${q(`the user ran ${set} in their own terminal`)}, then strom task wait <its T…> --on "<for the user, impersonal, in the research language: run ${set} in a terminal>"; never go round it`
      : undefined;
    throw new NeedsConsentError([{ key, kind: "consent", question: `${question}${agent ? " (an agent cannot answer this)" : ""}`, set }], agent ? undefined : says, task);
  }

  /**
   * The person's own yes in their terminal, for a consent that opens this computer outward, costs or runs another's
   * code: a terminal an agent opened round its markers says nothing by the command being run in it. Enter says no.
   * Asked only where requireHuman said "terminal" — `--yes`, `--json` or no terminal never come here (a window then,
   * or needs-input). `text` in the person's language: a question is asked as it is; anything else is said first and
   * `ask` (else "Allow?") asked after it.
   */
  async humanYes(text: string, ask?: string): Promise<boolean> {
    // one prompt: the menu runs its commands with their output hidden, a question never
    if (ask === undefined && /\?\s*$/u.test(text)) return this.confirm(text, false);
    return this.confirm(`${text}\n${ask ?? ui(this.uiLang(), "ui.consent.yesno")}`, false);
  }

  /**
   * requireHuman, and in the person's terminal their own yes too (humanYes): what opens this computer outward, costs
   * or runs another's code. undefined: they said no there — nothing to change. `terminal`/`ask`: what the terminal
   * says and asks, where it is not the window's `says`.
   */
  async requireHumanYes(question: string, set: string, key: string, says: string, opts: { window?: boolean; terminal?: string; ask?: string } = {}): Promise<"terminal" | "window" | undefined> {
    const how = this.requireHuman(question, set, key, says, opts);
    if (how === "window") return how;
    return (await this.humanYes(opts.terminal ?? says, opts.ask)) ? how : undefined;
  }

  /**
   * An agent strom did not start, working outside the research's folder and strom's shared one (a session in
   * another repository, where the agents' global rule lets it run strom without asking): what runs a connector's
   * code or starts paid work is asked in a window there — reading the research is not.
   */
  agentElsewhere(): boolean {
    if (!isAgent(this.env) || this.env.STROM_WORKER || this.env.STROM_SESSION) return false;
    if (findTreeUpwards(this.cwd)) return false;
    const shared = this.settings.shared()?.value;
    const inside = (dir: string, p: string) => {
      const rel = path.relative(dir, p);
      return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
    };
    const real = (p: string) => {
      try {
        return fs.realpathSync(p);
      } catch {
        return path.resolve(p);
      }
    };
    return !(shared && inside(real(shared), real(this.cwd)));
  }

  /** What an agent elsewhere (agentElsewhere) may do only with the person's yes, in a window: `says` in their language. */
  confirmElsewhere(question: string, set: string, key: string, says: string): void {
    if (this.agentElsewhere()) this.requireHuman(question, set, key, says);
  }

  /**
   * One of numbered options (1…n, or keys of their own like "0"); Enter takes
   * the suggested one. Asks again on anything else. `back` adds "0" with that
   * label: the person changes their mind, nothing changes — undefined, as when
   * a test ran out of answers.
   */
  async choose(question: string, choices: { key?: string; label: string }[], suggested: number, opts: { back?: string } = {}): Promise<number | undefined> {
    const options = opts.back ? [...choices, { key: "0", label: opts.back }] : choices;
    const keys = options.map((o, i) => o.key ?? String(i + 1));
    const lang = this.uiLang();
    this.io.stdout(`\n${question ? `${question}\n` : ""}${options.map((o, i) => `  ${keys[i]!.padStart(2)}  ${o.label}`).join("\n")}\n`);
    for (;;) {
      if (this.io.answers && this.io.answers.length === 0) return undefined;
      const a = (await this.ask(`${ui(lang, "ui.choose")}`, keys[suggested])).trim();
      const i = keys.indexOf(a);
      if (i >= 0) return i < choices.length ? i : undefined;
      // asked again in one line, the options stay above it; a command typed here is said where it goes
      const out = options[keys.indexOf("0")];
      const command = /^strom(\s|$)/iu.test(a);
      this.io.stdout(
        (command && out
          ? ui(lang, "ui.bad.command", { key: "0", label: out.label, command: a })
          : command
            ? ui(lang, "ui.bad.command.only", { command: a })
            : ui(lang, "ui.bad.choice", { keys: keys.join(", ") })) + "\n",
      );
    }
  }

  async confirm(question: string, suggested = true): Promise<boolean> {
    const lang = this.uiLang();
    const [yes, no] = [ui(lang, "ui.yes"), ui(lang, "ui.no")];
    const a = (await this.ask(`${question} (${yes}/${no})`, suggested ? yes : no)).toLowerCase();
    return [yes, "y", "yes", "a", "ano", "j", "ja", "t", "tak", "o", "oui", "s", "si"].includes(a);
  }

  display(p: string): string {
    return displayPath(p, this.env);
  }

  resolvePath(p: string): string {
    return path.resolve(this.cwd, expandHome(p, this.env));
  }

  /** The Strom home; asks (TTY) or fails with needs-input. */
  async requireHome(): Promise<string> {
    const home = this.settings.home();
    if (home) return home.value;
    // the default inside strom's program folder (settings lying in node/): refused with --yes, never offered
    const suggested = this.homeSuggestion();
    if (this.yes) {
      this.refuseProgramFolder("home", this.settings.suggestedHome(), { asDefault: true });
      return this.saveHome(suggested);
    }
    if (!this.interactive)
      throw new NeedsInputError([
        {
          key: "home",
          kind: "config",
          question: "Where should Strom keep the research (trees and shared data)?",
          default: this.display(suggested),
          scopes: ["user"],
          set: `strom setup --home "${this.display(suggested)}" --yes`,
        },
      ]);
    const answer = await this.ask(ui(this.uiLang(), "ui.setup.home"), this.display(suggested));
    return this.saveHome(this.resolvePath(answer));
  }

  private saveHome(dir: string): string {
    this.refuseProgramFolder("home", dir);
    this.settings.config.home = dir;
    this.settings.save();
    return dir;
  }

  /**
   * What is the research's and the person's on this computer: the home, its backups, the folder of the trees, the
   * shared folder, every tree known, the settings — what strom update and strom uninstall never take away.
   */
  researchFolders(): string[] {
    const home = this.settings.home()?.value;
    return [
      ...(home ? [home, backupsDir(home)] : []),
      ...[this.settings.trees()?.value, this.settings.shared()?.value].filter((p): p is string => !!p),
      ...this.knownTrees().map((k) => k.root),
      configDir(this.env),
    ];
  }

  /**
   * A folder for the research (home, trees, shared) never inside strom's program folder: an update replaces what is
   * there and an uninstall takes it away (found 2026-10-07: a research inside app/ went with the next update, and the
   * backup made just before it). Refused with what to do; nothing is written.
   */
  refuseProgramFolder(key: "home" | "trees" | "shared", folder: string, opts: { suggested?: string; asDefault?: boolean } = {}): void {
    const program = insideProgram(folder, { settings: configDir(this.env) });
    if (!program) return;
    const home = this.homeSuggestion();
    const suggested = this.display(opts.suggested ?? (key === "shared" ? path.join(home, "shared") : home));
    // the folder strom would take by itself (none named, --yes): the way on is naming one
    throw new UsageError(`${this.display(folder)} is inside strom's program folder ${this.display(program)} — strom update replaces what is there and strom uninstall takes it away, the research with it; nothing was changed`, {
      hint: opts.asDefault ? `pass --home with a folder outside it: strom setup --home "${suggested}" --yes` : `a folder outside it, e.g. ${suggested}`,
      ...(opts.asDefault ? { hintCode: "folder.in-program.default" } : {}),
      code: "folder.in-program",
      params: { folder: this.display(folder), program: this.display(program), key, suggested },
    });
  }

  /**
   * The folder suggested for the research: the usual one (defaultHome) — unless it lies inside strom's program folder
   * (an isolated installation's settings in its node/ or app/: found on a Mac), then one beside that folder.
   */
  homeSuggestion(): string {
    const home = this.settings.suggestedHome();
    const program = insideProgram(home, { settings: configDir(this.env) });
    return program ? path.join(path.dirname(program), ISOLATED_HOME) : home;
  }

  treesDir(): string | undefined {
    return this.settings.trees()?.value;
  }

  /** All trees Strom knows about: folders in the trees dir plus remembered ones. */
  knownTrees(): KnownTree[] {
    return this.allTrees().map(({ name, root, lang }) => ({ name, root, lang }));
  }

  /** The trees known, with their ids — each seen kept in strom's memory (seenTrees) to say one gone from its folder. */
  private allTrees(): ReturnType<typeof knownTreesIn> {
    const all = knownTreesIn(this.treesDir(), this.settings.config.extraTrees ?? []);
    this.remember(all);
    return all;
  }

  /**
   * What was seen, kept: the trees here now, and those gone from their folders and found nowhere else (a tree found in
   * another folder is the same one moved: kept where it is now). Written only when it changed, only with strom set up.
   */
  private remember(all: ReturnType<typeof knownTreesIn>): void {
    if (!this.settings.home()) return;
    const before = this.settings.config.seenTrees ?? [];
    const ids = new Set(all.map((k) => k.id).filter(Boolean));
    const gone = before.filter((s) => !isTreeDir(s.root) && !ids.has(s.id));
    const now = [...all.filter((k) => k.id).map((k) => ({ root: k.root, id: k.id, name: k.name })), ...gone];
    // the same trees in the same folders: nothing written (the order of their fields aside)
    if (JSON.stringify(canonicalize(now)) === JSON.stringify(canonicalize(before))) return;
    this.settings.config.seenTrees = now;
    try {
      this.settings.saveKey("seenTrees");
    } catch {
      // settings that cannot be written: said again next time
    }
  }

  /** The family trees seen here before and gone from their folders since (moved?), found in no other folder known. */
  missingTrees(): { name: string; root: string; id: string }[] {
    this.allTrees();
    return (this.settings.config.seenTrees ?? []).filter((s) => !isTreeDir(s.root));
  }

  /** The tree meant is gone from its folder: said, with the trees there are — none opened in its place. */
  private moved(gone: { name: string; root: string }): UsageError {
    const known = this.knownTrees();
    return new UsageError(`the family tree "${gone.name}" is no longer in ${gone.root} (moved?) — no other is opened in its place`, {
      hint: `its new folder: strom trees use "<folder>" · another family tree: strom trees use "<name>" · no longer wanted: strom trees forget "${gone.name}"`,
      code: "tree.moved",
      params: { name: gone.name, path: this.display(gone.root) },
      details: { candidates: known.map((k) => ({ label: `${k.name}  (${this.display(k.root)})`, root: k.root })) },
    });
  }

  /** Locate the tree: --tree > STROM_TREE > current folder upwards > `strom trees use` > the only known tree. */
  locateTree(): string | undefined {
    const ref = this.treeFlag ?? this.env.STROM_TREE;
    if (ref) {
      const asPath = this.resolvePath(ref);
      if (isTreeDir(asPath)) return asPath;
      const key = foldText(ref);
      const hits = this.knownTrees().filter((t) => foldText(t.name) === key || foldText(path.basename(t.root)) === key);
      if (hits.length === 1) return hits[0]!.root;
      if (hits.length > 1) throw new UsageError(`tree name "${ref}" is ambiguous`, { hint: "pass the folder path: --tree <dir>", code: "tree.ambiguous", params: { name: ref } });
      throw new UsageError(`no tree "${ref}"`, { hint: "strom trees", code: "tree.unknown", params: { name: ref } });
    }
    const up = findTreeUpwards(this.cwd);
    if (up) return up;
    const current = this.settings.config.currentTree;
    if (current && isTreeDir(current)) return current;
    const all = this.allTrees();
    // the tree worked on last gone from its folder: the same tree in another folder known (its id) is it; else said —
    // never another opened in its place (found in the audit: strom app opened the only tree left)
    if (current) {
      const seen = (this.settings.config.seenTrees ?? []).find((s) => path.resolve(s.root) === path.resolve(current));
      const same = seen ? all.filter((k) => k.id === seen.id) : [];
      if (same.length === 1) return same[0]!.root;
      throw this.moved({ name: seen?.name ?? path.basename(current), root: current });
    }
    // the only tree known, unless another seen here is gone from its folder: which one is meant is not certain then
    const missing = (this.settings.config.seenTrees ?? []).filter((s) => !isTreeDir(s.root));
    if (all.length === 1 && missing.length) throw this.moved(missing[0]!);
    if (all.length === 1) return all[0]!.root;
    return undefined;
  }

  /** The research this command opened, if it did (where an error happened, said in its words). */
  openedRoot(): string | undefined {
    return this.opened?.root;
  }

  tree(): Tree {
    if (this.opened) return this.opened;
    const root = this.locateTree();
    if (!root) {
      const known = this.knownTrees();
      if (known.length === 0) throw new StromError("no tree yet", { hint: 'create one: strom init "<tree name>"', code: "tree.none" });
      const names = known.map((t) => `"${t.name}"`).join(", ");
      throw new UsageError("which tree? there are several", { hint: `pass --tree <name>: ${names}`, code: "tree.which", params: { names } });
    }
    const opened = Tree.open(root, this.env);
    if (this.backupFailed && (opened.config.schema ?? 1) < SCHEMA_VERSION) throw this.backupFailed;
    this.opened = opened;
    // Data an older strom wrote under an older schema: brought forward first (a dry run too — it is not the command's change).
    // said in the person's language: each step by its own sentence (the commit keeps the English one)
    for (const step of migrate(this.opened)) {
      const to = /^schema (\d+)/.exec(step)?.[1];
      const key = `ui.migrated.${to}` as UIKey;
      this.io.stderr(`${ui(this.uiLang(), "ui.migrated", { step: key in UI ? ui(this.uiLang(), key) : step })}\n`);
    }
    this.opened.dryRun = this.dryRun;
    // A language passed from outside (--lang, STROM_LANG — e.g. by the Strom
    // app) applies to this invocation; the tree keeps its own.
    const lang = this.settings.lang(this.opened.config);
    if (lang.source === "flag" || lang.source === "env") this.opened.langOverride = lang.value;
    // Inside an open session every write is logged under the session's ID;
    // an agent writing outside a session is logged as "agent", never as the user.
    // What the bridge writes for the Strom app (STROM_FOR_APP) is the person's in the app: the user's.
    const session = this.env.STROM_FOR_APP === "1" ? undefined : currentSession(this.opened, this.env, this.refs);
    if (session) this.opened.actor = session.id;
    else if (isAgent(this.env) && this.env.STROM_FOR_APP !== "1") this.opened.actor = "agent";
    return this.opened;
  }

  /** The tree if a command already opened it. */
  current(): Tree | undefined {
    return this.opened;
  }

  /** Use a tree created during this command (e.g. by `init`). */
  adopt(tree: Tree): void {
    tree.dryRun = this.dryRun;
    this.opened = tree;
  }

  hasTree(): boolean {
    try {
      return this.locateTree() !== undefined;
    } catch {
      return false;
    }
  }
}
