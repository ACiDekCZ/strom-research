// Per-invocation context: environment, settings, IO, and lazy access to the
// tree. Asking the user happens only here, and only on a terminal.

import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { Writable } from "node:stream";
import { Settings, type Flags } from "../core/config.ts";
import { displayPath, expandHome, type Env } from "../core/paths.ts";
import { NeedsConsentError, NeedsInputError, StromError, UsageError } from "../core/errors.ts";
import { Tree, findTreeUpwards, isTreeDir } from "../core/tree.ts";
import type { TreeConfig } from "../core/model.ts";
import { readJsonIfExists } from "../core/json.ts";
import { foldText } from "../core/text.ts";
import { currentSession } from "../core/session.ts";
import { isAgent } from "../core/which.ts";
import { systemDialog, type DialogText } from "../core/dialog.ts";
import { ui } from "./ui.ts";

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
  private opened: Tree | undefined;

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
    this.limit = opts.limit ?? 50;
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
    } else {
      const rl = readline.createInterface({ input: this.io.stdin ?? process.stdin, output: process.stdout });
      try {
        answer = await rl.question(prompt);
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
   * A consent is the user's. In their own terminal they gave it by running the
   * command. Anywhere else — an agent's session, the app — the person at the
   * screen is asked in a window of the system, which the agent can neither see
   * nor click. Without a window (no desktop, a run nobody watches) it fails:
   * the user runs the command themselves. `says` is the question in the
   * user's language — all the window shows, so it holds any warning too.
   * `window: false` for what needs the user's terminal (typing a password).
   */
  requireHuman(question: string, set: string, key: string, says?: string, opts: { window?: boolean } = {}): "terminal" | "window" {
    const agent = isAgent(this.env);
    if (this.interactive && !agent) return "terminal";
    if (this.env.STROM_NONINTERACTIVE !== "1" && opts.window !== false) {
      const lang = this.uiLang();
      const text: DialogText = { title: ui(lang, "ui.dialog.title"), question: says ?? question, yes: ui(lang, "ui.dialog.yes"), no: ui(lang, "ui.dialog.no") };
      const answer = this.io.dialog ? this.io.dialog(text) : systemDialog(text, this.env);
      if (answer === true) return "window";
      if (answer === false) throw new StromError(ui(lang, "ui.dialog.refused"), { hint: `the user said no to: ${question} — do not ask again unless they want to` });
    }
    throw new NeedsConsentError([{ key, kind: "consent", question: `${question}${agent ? " (an agent cannot answer this)" : ""}`, set }]);
  }

  /**
   * One of numbered options (1…n, or keys of their own like "0"); Enter takes
   * the suggested one. Asks again on anything else. Undefined when a test ran
   * out of answers.
   */
  async choose(question: string, options: { key?: string; label: string }[], suggested: number): Promise<number | undefined> {
    const keys = options.map((o, i) => o.key ?? String(i + 1));
    for (;;) {
      this.io.stdout(`\n${question ? `${question}\n` : ""}${options.map((o, i) => `  ${keys[i]!.padStart(2)}  ${o.label}`).join("\n")}\n`);
      if (this.io.answers && this.io.answers.length === 0) return undefined;
      const a = await this.ask(`${ui(this.uiLang(), "ui.choose")}`, keys[suggested]);
      const i = keys.indexOf(a.trim());
      if (i >= 0) return i;
      this.io.stdout(ui(this.uiLang(), "ui.bad.choice") + "\n");
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
    const suggested = this.settings.suggestedHome();
    if (this.yes) return this.saveHome(suggested);
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
    const answer = await this.ask("Where should Strom keep your research?", this.display(suggested));
    return this.saveHome(this.resolvePath(answer));
  }

  private saveHome(dir: string): string {
    this.settings.config.home = dir;
    this.settings.save();
    return dir;
  }

  treesDir(): string | undefined {
    return this.settings.trees()?.value;
  }

  /** All trees Strom knows about: folders in the trees dir plus remembered ones. */
  knownTrees(): KnownTree[] {
    const roots = new Set<string>();
    const dir = this.treesDir();
    if (dir && fs.existsSync(dir))
      for (const name of fs.readdirSync(dir)) {
        const root = path.join(dir, name);
        if (isTreeDir(root)) roots.add(root);
      }
    for (const extra of this.settings.config.extraTrees ?? []) if (isTreeDir(extra)) roots.add(extra);
    const out: KnownTree[] = [];
    for (const root of [...roots].sort()) {
      const cfg = readJsonIfExists<TreeConfig>(path.join(root, "strom.json"));
      if (cfg) out.push({ name: cfg.name, root, lang: cfg.lang });
    }
    return out;
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
      if (hits.length > 1) throw new UsageError(`tree name "${ref}" is ambiguous`, { hint: "pass the folder path: --tree <dir>" });
      throw new UsageError(`no tree "${ref}"`, { hint: "strom trees" });
    }
    const up = findTreeUpwards(this.cwd);
    if (up) return up;
    const current = this.settings.config.currentTree;
    if (current && isTreeDir(current)) return current;
    const known = this.knownTrees();
    if (known.length === 1) return known[0]!.root;
    return undefined;
  }

  tree(): Tree {
    if (this.opened) return this.opened;
    const root = this.locateTree();
    if (!root) {
      const known = this.knownTrees();
      if (known.length === 0) throw new StromError("no tree yet", { hint: 'create one: strom init "<tree name>"' });
      throw new UsageError("which tree? there are several", {
        hint: `pass --tree <name>: ${known.map((t) => `"${t.name}"`).join(", ")}`,
      });
    }
    this.opened = Tree.open(root, this.env);
    this.opened.dryRun = this.dryRun;
    // A language passed from outside (--lang, STROM_LANG — e.g. by the Strom
    // app) applies to this invocation; the tree keeps its own.
    const lang = this.settings.lang(this.opened.config);
    if (lang.source === "flag" || lang.source === "env") this.opened.langOverride = lang.value;
    // Inside an open session every write is logged under the session's ID;
    // an agent writing outside a session is logged as "agent", never as the user.
    const session = currentSession(this.opened, this.env);
    if (session) this.opened.actor = session.id;
    else if (isAgent(this.env)) this.opened.actor = "agent";
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
