// setup · doctor · config — the environment around the trees.

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { register } from "../cli/registry.ts";
import type { Context } from "../cli/context.ts";
import { lines, table } from "../cli/format.ts";
import { checkValue, configFile, DEFAULT_BUDGET, DEFAULT_RUN_MINUTES, OTHER_ENV, SETTINGS, settingDef, writeStored, type SettingDef } from "../core/config.ts";
import { syncAgentFiles } from "../agents/files.ts";
import type { Tree } from "../core/tree.ts";
import { gitVersion } from "../core/git.ts";
import { linuxGitCommand } from "../core/deps.ts";
import { fixGit, offerAgent } from "../cli/fixes.ts";
import { createShortcut } from "../core/shortcut.ts";
import { openForUser } from "../core/open.ts";
import { isValidLang, langName } from "../core/lang.ts";
import { detectAgent, isAgent } from "../core/which.ts";
import { agentsHere, DESKTOP_APPS, inDesktopApp, whereToTalk } from "../core/apps.ts";
import { setupWizard } from "../cli/wizard.ts";
import { installation, stromLauncher } from "../core/self.ts";
import { VERSION } from "../core/tree.ts";
import { installUpdate, isNewer, knownNewerVersion, latestVersion, newerNode, newerVersion, type Updated } from "../core/update.ts";
import { desktopDir } from "../core/paths.ts";
import { planMove } from "../core/relocate.ts";
import { researchUrl, stromAppUrl, stromAppState } from "../core/stromapp.ts";
import { isInstalled } from "../agents/global.ts";
import { shortcutName } from "../cli/wizard.ts";
import type { UIKey } from "../cli/ui.ts";

import { globalTargets, installGlobal } from "../agents/global.ts";
import { ui } from "../cli/ui.ts";
import { PERMISSION_LEVELS, type AgentPermissions } from "../core/config.ts";
import { PROFILES, type Tier } from "../agents/profiles.ts";
import { NeedsInputError, StromError, UsageError } from "../core/errors.ts";
import { check } from "../core/check.ts";
import { assertIntact, verifyFull } from "../core/integrity.ts";
import { ensurePluginsDir } from "../core/connector.ts";
import { ensureGatesDir, loadGate } from "../core/gate.ts";
import { ensureHooksDir } from "../core/hooks.ts";
import { claudeInChrome, CLAUDE_IN_CHROME_URL, downloadsDir } from "../core/browser.ts";
import { browserConnectors } from "../core/connector.ts";

export const SHARED_DIRS = ["media", "catalog", "tools", "cache", "inbox"];

export function ensureShared(dir: string): void {
  for (const d of SHARED_DIRS) fs.mkdirSync(path.join(dir, d), { recursive: true });
  ensurePluginsDir(dir);
  ensureGatesDir(dir);
  ensureHooksDir(dir);
}

register({
  path: ["setup"],
  summary: "First-time setup: where Strom keeps trees and shared data, research language",
  group: "setup",
  description:
    "A person at a terminal gets a wizard in their language (run it again any time to change an answer): language,\n" +
    "folder, git and an AI agent (offered to install), the model, what the agent may do without asking, a desktop\n" +
    "shortcut. Without a terminal (an agent): pass the values or --yes to accept the suggestions.\n" +
    "Trees and shared data (scans, catalog) live under one home by default; --shared/--trees separate them.\n" +
    "Either way the installed agents learn about strom in any folder (strom agents install).",
  examples: ["strom setup", "strom setup --yes --lang cs", 'strom setup --home "~/Documents/Strom" --shared "/Volumes/Big/strom-shared" --lang cs'],
  run: async (ctx) => {
    const s = ctx.settings;
    if (ctx.interactive && !isAgent(ctx.env)) {
      const r = await setupWizard(ctx);
      return { text: "", data: { ...r, trees: s.trees()!.value, shared: s.shared()!.value, config: configFile(ctx.env) } };
    }
    const cfg = s.config;
    const flags = s.flags;
    const suggestedHome = s.home()?.value ?? s.suggestedHome();

    if (!flags.home && !ctx.yes && !ctx.interactive && !cfg.home)
      throw new NeedsInputError([
        {
          key: "home",
          kind: "config",
          question: "Where should Strom keep the research (trees and shared data)?",
          default: ctx.display(suggestedHome),
          scopes: ["user"],
          set: `strom setup --home "${ctx.display(suggestedHome)}" --yes`,
        },
      ]);

    if (cfg.home && flags.home) guardResearchFolder(ctx, "home", flags.home);
    if (flags.shared) guardResearchFolder(ctx, "shared", flags.shared);
    if (flags.trees) guardResearchFolder(ctx, "trees", flags.trees);
    let home = flags.home ? ctx.resolvePath(flags.home) : suggestedHome;
    let shared = flags.shared ? ctx.resolvePath(flags.shared) : undefined;
    let trees = flags.trees ? ctx.resolvePath(flags.trees) : undefined;
    let lang = flags.lang ?? cfg.lang ?? s.lang().value;
    const langDetected = !flags.lang && !cfg.lang && s.lang().source === "detected" && !ctx.interactive;
    // Suggest the configured agent, else the first one installed, else Claude Code.
    const installed = agentsHere(ctx.env).map((a) => a.id);
    // Set up by an agent: that one is the user's (unless they chose already); else the first one here.
    const running = detectAgent(ctx.env);
    let agent = (flags.agent ?? cfg.agent ?? (running && PROFILES[running] ? running : undefined) ?? installed[0] ?? "claude").toLowerCase();

    if (ctx.interactive) {
      if (!flags.home) home = ctx.resolvePath(await ctx.ask("Where should Strom keep your research?", ctx.display(home)));
      if (!flags.shared && !flags.trees && (await ctx.confirm("Keep scans and the archive catalog in a separate folder (e.g. a bigger disk)?", false)))
        shared = ctx.resolvePath(await ctx.ask("Folder for shared data:", ctx.display(path.join(home, "shared"))));
      if (!flags.lang) lang = (await ctx.ask(`Research language (the agent talks to you in it):`, lang)).toLowerCase();
      if (!flags.agent) agent = (await ctx.ask(`Which AI agent does the research? (${Object.keys(PROFILES).join(", ")})`, agent)).toLowerCase();
    }
    if (!PROFILES[agent]) throw new UsageError(`unknown agent "${agent}"`, { hint: Object.keys(PROFILES).join(", ") });
    if (!isValidLang(lang)) throw new UsageError(`invalid language code "${lang}"`, { hint: "use a code like cs, en, de" });

    cfg.home = home;
    cfg.lang = lang;
    cfg.agent = agent;
    // Set up by an agent working in its desktop app: that is where this person talks with it.
    if (!cfg.agentWhere && inDesktopApp(ctx.env)) cfg.agentWhere = "app";
    if (shared) cfg.shared = shared;
    if (trees) cfg.trees = trees;
    s.save();
    fs.mkdirSync(home, { recursive: true });
    const sharedDir = s.shared()!.value;
    const treesDir = s.trees()!.value;
    fs.mkdirSync(treesDir, { recursive: true });
    ensureShared(sharedDir);
    // The installed agents learn about strom in any folder.
    const taught = [...new Set(globalTargets(ctx.env).filter((t) => installed.includes(t.agent) && installGlobal(t)).map((t) => t.agent))];

    const text = lines(
      "Strom is set up.",
      table([
        ["  home", ctx.display(home)],
        ["  trees", ctx.display(treesDir)],
        ["  shared", ctx.display(sharedDir)],
        ["  language", `${langName(lang)} (${lang})${langDetected ? " — detected from the system; the user speaks another? strom config set lang <code>" : ""}`],
        ["  agent", `${PROFILES[agent]!.name}${installed.includes(agent) ? "" : " — not installed yet"}`],
        ...taught.map((a) => ["  knows strom", `${PROFILES[a]!.name}, in any folder`]),
        ["  config", ctx.display(configFile(ctx.env))],
      ]),
      "",
      'next   strom init "<tree name, e.g. the family surname>"',
    );
    return { text, data: { home, trees: treesDir, shared: sharedDir, lang, agent, config: configFile(ctx.env) } };
  },
});

interface Check {
  name: string;
  /** The name for a person, in their language. */
  label: string;
  status: "ok" | "warn" | "fail";
  detail: string;
  fix?: string;
  /** What strom doctor --fix can do about it itself. */
  repair?: "git" | "agent" | "knows" | "shortcut" | "app";
}

function nodeOk(version: string): boolean {
  const [maj = 0, min = 0] = version.replace(/^v/, "").split(".").map(Number);
  return maj > 22 || (maj === 22 && min >= 18);
}

const FIX = "strom doctor --fix";

/** Everything strom needs and has on this computer, in the user's language. */
function diagnose(ctx: Context): Check[] {
  const lang = ctx.uiLang();
  const t = (key: UIKey, values: Record<string, string | number> = {}) => ui(lang, key, values);
  const checks: Check[] = [];
  const add = (name: string, status: Check["status"], detail: string, fix?: string, repair?: Check["repair"]) =>
    checks.push({ name, label: t(`ui.doc.${name}` as UIKey), status, detail, ...(fix ? { fix } : {}), ...(repair ? { repair } : {}) });

  // The program itself: the installer's (its own Node), or npm's or the sources' on the Node of the computer.
  if (installation().kind === "installed") add("program", "ok", t("ui.doc.installed", { version: VERSION, node: process.version }));
  else if (nodeOk(process.version)) add("program", "ok", t("ui.doc.innode", { version: VERSION, node: process.version }));
  else add("program", "fail", t("ui.doc.oldnode", { node: process.version }), "https://nodejs.org");
  const newer = knownNewerVersion(ctx.settings, ctx.env);
  if (newer) add("update", "warn", t("ui.doc.update.new", { version: newer }), "strom update");

  const g = gitVersion(ctx.env);
  if (g) add("git", "ok", g);
  else add("git", "fail", t("ui.doc.missing"), process.platform === "linux" ? linuxGitCommand() : FIX, "git");

  const home = ctx.settings.home();
  if (!home) add("home", "fail", t("ui.doc.notsetup"), "strom setup");
  else {
    const exists = fs.existsSync(home.value);
    add("home", exists ? "ok" : "fail", ctx.display(home.value), exists ? undefined : "strom setup");
    const shared = ctx.settings.shared()!;
    const sharedOk = SHARED_DIRS.every((d) => fs.existsSync(path.join(shared.value, d)));
    add("shared", sharedOk ? "ok" : "warn", ctx.display(shared.value), sharedOk ? undefined : "strom setup --yes");
    const trees = ctx.knownTrees();
    add("trees", "ok", trees.length ? trees.map((k) => k.name).join(", ") : t("ui.doc.none"));
  }

  // Agents: their CLI or their desktop app — found, never started here.
  const here = agentsHere(ctx.env);
  const found = here.map((a) => a.id);
  const tree = ctx.hasTree() ? ctx.tree().config : undefined;
  const chosen = ctx.settings.agent(tree).value;
  // None strom knows, and no person at a terminal: another agent or program runs strom (a bot on its own
  // server, found live: Grok Bot) — it does the research through strom, nothing is missing for it.
  if (!found.length && (isAgent(ctx.env) || !ctx.io.tty)) add("agent", "ok", t("ui.doc.agent.other"));
  else if (!found.length) add("agent", "fail", t("ui.doc.noagent"), `${FIX}  (${researchUrl(lang, "agents")})`, "agent");
  else {
    const names = found.map((id) => `${PROFILES[id]?.name ?? id}${id === chosen ? ` (${t("ui.doc.default")})` : ""}`).join(", ");
    add("agent", found.includes(chosen) ? "ok" : "warn", names, found.includes(chosen) ? undefined : `strom agents use ${found[0]}`);
    // Do the agents here know strom in any folder, and may they run it?
    const missing = globalTargets(ctx.env).filter((x) => found.includes(x.agent) && !isInstalled(x));
    const agentsMissing = [...new Set(missing.map((x) => PROFILES[x.agent]?.name ?? x.agent))];
    if (agentsMissing.length) add("knows", "warn", t("ui.doc.knows.no", { agents: agentsMissing.join(", ") }), FIX, "knows");
    else add("knows", "ok", t("ui.doc.knows.yes"));
    const level = ctx.settings.agentPermissions();
    if (found.includes(chosen)) {
      const where = whereToTalk(chosen, ctx.settings.agentWhere(), ctx.env);
      const other = here.find((a) => a.id === chosen)!;
      add(
        "where",
        "ok",
        where === "app" ? t("ui.doc.where.app", { app: DESKTOP_APPS[chosen]!.name }) : t("ui.doc.where.terminal", { agent: PROFILES[chosen]!.name }),
        other.app && other.cli ? `strom config set agent.where ${where === "app" ? "terminal" : "app"}` : undefined,
      );
    }
    add("level", "ok", t(`ui.setup.level.${level}` as UIKey));
    const model = ctx.settings.models(chosen, tree).lead;
    if (model) add("model", "ok", model);
  }

  // Archives through the browser: only Claude Code has browser tools, and they work through the Claude in Chrome extension.
  const shared = ctx.settings.shared()?.value;
  const viaBrowser = shared ? browserConnectors(ctx.env, shared) : [];
  if (viaBrowser.length) {
    const names = viaBrowser.map((c) => c.manifest.title ?? c.name).join(", ");
    const ext = claudeInChrome(ctx.env).extension;
    if (chosen !== "claude") add("browser", "warn", t("ui.doc.browser.agent", { names, agent: PROFILES[chosen]?.name ?? chosen }), found.includes("claude") ? "strom agents use claude" : undefined);
    else if (ext.length) add("browser", "ok", t("ui.doc.browser.ok", { browsers: ext.join(", ") }));
    else add("browser", "warn", t("ui.doc.browser.noext", { names }), CLAUDE_IN_CHROME_URL);
  }

  // For a person: the shortcut on the desktop, the Strom app.
  const desktop = desktopDir(ctx.env);
  const shortcut = [`${shortcutName(lang)}.command`, `${shortcutName(lang)}.lnk`, `${shortcutName(lang)}.cmd`, "strom-research.desktop"].some((f) => fs.existsSync(path.join(desktop, f)));
  if (shortcut) add("shortcut", "ok", t("ui.doc.yes"));
  else add("shortcut", "warn", t("ui.doc.none"), FIX, "shortcut");
  const app = stromAppState(ctx.settings);
  add("app", "ok", t(`ui.doc.app.${app}` as UIKey), app === "unknown" ? FIX : undefined, app === "unknown" ? "app" : undefined);

  if (ctx.hasTree()) {
    const tr = ctx.tree();
    const errs = check(tr).filter((f) => f.level === "error").length + verifyFull(tr).findings.filter((f) => f.level === "error").length;
    if (errs === 0) add("tree", "ok", t("ui.doc.tree.ok", { name: tr.config.name }));
    else add("tree", "fail", t("ui.doc.tree.bad", { name: tr.config.name, n: errs }), "strom verify ; strom check");
  }
  return checks;
}

/**
 * What strom can put right itself, each with the user's yes: git, an agent
 * (a person here only), what the agents know, the shortcut and the Strom app
 * (a person here only — an agent's user does not need them from it).
 */
async function repair(ctx: Context, checks: Check[], out: (line: string) => void): Promise<void> {
  const lang = ctx.uiLang();
  const person = ctx.interactive && !isAgent(ctx.env);
  const todo = new Set(checks.filter((c) => c.status !== "ok" || c.repair === "app").map((c) => c.repair).filter(Boolean));
  if (todo.has("git")) await fixGit(ctx, out);
  if (todo.has("agent") && person) await offerAgent(ctx, out);
  if (todo.has("knows") || todo.has("agent")) {
    const found = agentsHere(ctx.env).map((a) => a.id);
    for (const a of new Set(globalTargets(ctx.env).filter((x) => found.includes(x.agent) && installGlobal(x)).map((x) => x.agent)))
      out(ui(lang, "ui.setup.skill", { agent: PROFILES[a]!.name }));
  }
  if (todo.has("shortcut") && person && (await ctx.confirm(ui(lang, "ui.setup.shortcut", {}), true))) {
    for (const f of createShortcut(shortcutName(lang), ctx.env)) out(ui(lang, "ui.setup.shortcut.done", { file: ctx.display(f) }));
  }
  if (todo.has("app") && person && (await ctx.confirm(ui(lang, "ui.fix.app"), false))) {
    openForUser(stromAppUrl(ctx.settings), ctx.env);
    out(ui(lang, "ui.app.install"));
  }
}

register({
  path: ["doctor"],
  summary: "Check everything strom needs: the program, git, folders, AI agents, what they know and may do, the Strom app, the current tree",
  group: "setup",
  description:
    "In the user's language; each problem says what to do. --fix puts right what strom can itself, each with the user's yes\n" +
    "(in the terminal, or in a window of the system when an agent runs it): git (Windows: strom's own; macOS: Apple's tools),\n" +
    "an AI agent, what the agents know, the shortcut on the desktop, the Strom app.",
  options: [{ name: "fix", type: "boolean", description: "put right what strom can, with the user's yes" }],
  examples: ["strom doctor", "strom doctor --fix", "strom doctor --json"],
  async run(ctx, { opts }) {
    const lang = ctx.uiLang();
    const t = (key: UIKey, values: Record<string, string | number> = {}) => ui(lang, key, values);
    await newerVersion(ctx.settings, ctx.env, { fresh: true, timeoutMs: 3000 });
    let checks = diagnose(ctx);
    const said: string[] = [];
    if (opts.fix) {
      const fixable = checks.some((c) => c.repair && (c.status !== "ok" || c.repair === "app"));
      if (fixable) await repair(ctx, checks, (line) => (ctx.interactive ? ctx.io.stdout(line + "\n") : said.push(line)));
      checks = diagnose(ctx);
    }
    const bad = checks.filter((c) => c.status === "fail").length;
    const mark = { ok: "✓", warn: "!", fail: "✗" } as const;
    const text = lines(
      ...said,
      ...(said.length ? [""] : []),
      table(checks.map((c) => [` ${mark[c.status]}`, c.label, c.detail, c.fix ? `→ ${c.fix}` : ""])),
      "",
      bad === 0 ? t("ui.doc.allok") : t("ui.doc.problems", { n: bad }),
    );
    return { text, data: { ok: bad === 0, checks: checks.map(({ repair: _, ...c }) => c) }, exitCode: bad === 0 ? 0 : 1 };
  },
});

register({
  path: ["update"],
  summary: "Install the newest version of strom (from the project's releases, checked like the installer does) — with the user's yes",
  group: "setup",
  description:
    "strom looks for a new version at most once a day and says so (the menu, strom, strom doctor); the setting updates off\n" +
    "stops it. A person at their terminal is asked there (--yes: no question); asked by an agent, strom asks in a window of the\n" +
    "system. Installed with npm: npm install -g strom-research@latest.",
  options: [{ name: "check", type: "boolean", description: "only say whether there is a new version" }],
  examples: ["strom update --check", "strom update"],
  async run(ctx, { opts }) {
    const lang = ctx.uiLang();
    const t = (key: UIKey, values: Record<string, string | number> = {}) => ui(lang, key, values);
    const newest = await latestVersion(ctx.env, 8000);
    if (!newest) throw new StromError(t("ui.update.unknown"), { hint: "check the network — or run the installer again" });
    ctx.settings.config.updateCheck = { at: new Date().toISOString(), latest: newest };
    ctx.settings.save();
    const inst = installation();
    // The installer's Node: the newest release of its line (security fixes) is taken along.
    const node = inst.kind === "installed" ? await newerNode(ctx.env, inst.node).catch(() => undefined) : undefined;
    const newer = isNewer(newest, VERSION);
    if (!newer && !node) return { text: t("ui.update.current", { version: VERSION }), data: { current: VERSION, latest: newest, newer: false } };
    const nodeLine = node ? t("ui.update.node.available", { from: inst.node ?? "?", to: node.version }) : undefined;
    if (opts.check)
      return { text: lines(newer ? t("ui.update.available", { version: newest, current: VERSION }) : undefined, nodeLine), data: { current: VERSION, latest: newest, newer, ...(node ? { node: node.version } : {}) } };
    if (inst.kind !== "installed") return { text: t(inst.kind === "npm" ? "ui.update.npm" : "ui.update.source", { version: newest }), data: { current: VERSION, latest: newest, newer: true, npm: inst.kind === "npm" } };
    const question = newer ? t("ui.update.sure", { version: newest, current: VERSION }) : t("ui.update.node.sure", { from: inst.node ?? "?", to: node!.version });
    if (isAgent(ctx.env) || !ctx.yes) {
      if (!isAgent(ctx.env) && ctx.interactive) {
        if (!(await ctx.confirm(question, true))) return { text: t("ui.update.later"), data: { current: VERSION, latest: newest, updated: false } };
      } else ctx.requireHuman(`update strom to ${newest}`, "strom update", "update", question);
    }
    if (ctx.interactive) ctx.io.stdout(`${t("ui.update.downloading", { version: newest })}\n`);
    let done: Updated;
    try {
      done = await installUpdate(ctx.env, inst.root!);
    } catch (e) {
      throw new StromError(t("ui.update.failed", { detail: (e as Error).message }), { hint: "strom update — or run the installer again" });
    }
    // The agents learn what the new version tells them.
    const { command, args } = stromLauncher();
    spawnSync(command, [...args, "agents", "install"], { stdio: "ignore", env: ctx.env as NodeJS.ProcessEnv, windowsHide: true });
    return {
      text: lines(newer ? t("ui.update.done", { version: done.version, previous: VERSION }) : undefined, done.node ? t("ui.update.node.done", done.node) : undefined),
      data: { previous: VERSION, version: done.version, updated: true, ...(done.node ? { node: done.node } : {}) },
    };
  },
});

function display(ctx: Context, def: SettingDef, value: string | number | undefined): string {
  if (value === undefined) return "(unset)";
  return def.kind === "path" ? ctx.display(String(value)) : String(value);
}

/** Effective value of a setting, with the default filled in. */
function effective(ctx: Context, def: SettingDef): { value: string | number | undefined; source: string } {
  const s = ctx.settings;
  const tree = ctx.hasTree() ? ctx.tree().config : undefined;
  if (def.key === "home") return s.home() ?? { value: undefined, source: "unset" };
  if (def.key === "shared") return s.shared() ?? { value: undefined, source: "unset" };
  if (def.key === "trees") return s.trees() ?? { value: undefined, source: "unset" };
  if (def.key === "lang") return s.lang(tree);
  if (def.key === "agent") return s.agent(tree);
  const r = s.resolve(def.key, tree);
  if (r) return r;
  if (def.kind === "model") {
    const v = PROFILES[s.agent(tree).value]?.models[def.key.slice(6) as Tier];
    return { value: v ?? "(the agent's own)", source: "default" };
  }
  if (def.key === "brief.budget") return { value: DEFAULT_BUDGET, source: "default" };
  if (def.key === "run.minutes") return { value: DEFAULT_RUN_MINUTES, source: "default" };
  if (def.key === "connectors.consent") return { value: "off", source: "default" };
  if (def.key === "browser.downloads") return { value: downloadsDir(ctx.env), source: "detected" };
  if (def.key === "agent.permissions") return { value: ctx.settings.agentPermissions(), source: ctx.settings.config.agentPermissions ? "config" : "default" };
  return { value: undefined, source: "unset" };
}

/**
 * Change a setting of one tree (strom.json): a logged operation, committed
 * together with the agent files that depend on it.
 */
export function setTreeSetting(ctx: Context, key: string, value: string | number | undefined): Tree {
  const def = settingDef(key);
  if (!def.tree) throw new UsageError(`${key} is a setting of your computer, not of a tree`, { hint: `strom config set ${key} <value>` });
  const tree = ctx.tree();
  assertIntact(tree);
  const agent = ctx.settings.agent(tree.config).value;
  tree.updateConfig((c) => writeStored(c, key, agent, value), {
    op: "config.set",
    summary: value === undefined ? `tree setting ${key} removed` : `tree setting ${key} = ${value}`,
  });
  const files = syncAgentFiles(tree);
  tree.withTreeLock(() => tree.commit(`Setting ${key}${value === undefined ? " removed" : `: ${value}`}`, ["strom.json", ...tree.opsFilesTouched(), ...files]));
  tree.settle();
  return tree;
}

/** What the user reads before they let the agent do everything but what is denied. */
export const BYPASS_WARNING = [
  "Full: the agent does everything but what the tree's permissions deny, without asking.",
  "  · The allow list no longer counts. The agent may run any program on this computer, read and change",
  "    any file you can, and reach any web site — strom denies only a few (the evidence, its own settings",
  "    and instructions, git, curl and wget, your consents and logins), and cannot foresee every way round.",
  "  · A web page or a document the agent reads may carry instructions meant for it (prompt injection).",
  "  · strom still guards the evidence: a change in data/ that did not go through strom blocks every commit.",
  "  · Meant for a computer or an account that holds nothing else of value. Back: strom config set agent.permissions auto",
].join("\n");

/** Does this value let the agent do more than now? */
function raises(now: AgentPermissions, value: string | number | undefined): boolean {
  const next = (value ?? "auto") as AgentPermissions;
  return PERMISSION_LEVELS.indexOf(next) > PERMISSION_LEVELS.indexOf(now);
}

/** Change a user setting (the config file on this computer). */
/**
 * Where the research lives (home, trees, shared) changes only with the research moving along — which the person does in
 * the wizard (strom setup in a terminal, the menu's settings). A folder set to another place with the research left in
 * the old one would lose the trees from the list and the plugins and images from sight.
 */
function guardResearchFolder(ctx: Context, key: string, next: string | undefined): void {
  const now = key === "home" ? ctx.settings.home()?.value : key === "trees" ? ctx.settings.trees()?.value : key === "shared" ? ctx.settings.shared()?.value : undefined;
  // unset: back to the default under home (none for home itself)
  const home = ctx.settings.home()?.value;
  const target = next !== undefined ? ctx.resolvePath(next) : key === "shared" && home ? path.join(home, "shared") : key === "trees" ? home : undefined;
  if (!now || (target && path.resolve(target) === path.resolve(now))) return;
  if (!planMove(now, target ?? now, []).content) return;
  throw new UsageError(`the research is in ${ctx.display(now)} — changing ${key} would leave it behind`, {
    hint: "the user moves it: strom setup in their terminal (or the menu: Settings → the setup), which moves the trees and the shared folder along",
  });
}

function setUserSetting(ctx: Context, key: string, value: string | number | undefined): void {
  const s = ctx.settings;
  guardResearchFolder(ctx, key, value === undefined ? undefined : String(value));
  // Loosening the agent's permissions is the user's decision alone.
  if (key === "agent.permissions" && raises(s.agentPermissions(), value))
    ctx.requireHuman(
      `Let the agent ${value === "full" ? "do everything but what the tree's permissions deny" : "work on its own, asking only about risky steps"}, without asking?`,
      `strom config set agent.permissions ${value}`,
      "agent.permissions",
      ui(ctx.uiLang(), value === "full" ? "ui.consent.level.full" : "ui.consent.level.auto"),
    );
  // Sessions steered from elsewhere (Remote Control): the user's decision alone.
  if (key === "agent.remote" && value === "on" && !s.agentRemote())
    ctx.requireHuman("Start the Claude Code sessions with Remote Control (followed and steered from claude.ai or your phone)?", "strom config set agent.remote on", "agent.remote", ui(ctx.uiLang(), "ui.consent.remote"));
  // Asking before a connector runs is the user's safeguard: only they take it away.
  if (key === "connectors.consent" && value !== "on" && s.connectorsConsent())
    ctx.requireHuman("Let connectors run without asking you first?", `strom config set connectors.consent ${value ?? "off"}`, "connectors.consent", ui(ctx.uiLang(), "ui.consent.connectors.off"));
  // The gate decides what working alone spends: set and taken away by the user alone.
  if (key === "run.gate" && value !== s.runGate())
    ctx.requireHuman(
      value ? `Let the gate "${value}" decide when the agent working alone goes on?` : `Remove the gate "${s.runGate()}" — the agent working alone no longer asks it?`,
      value ? `strom config set run.gate ${value}` : "strom config unset run.gate",
      "run.gate",
      ui(ctx.uiLang(), value ? "ui.consent.gate.set" : "ui.consent.gate.unset", { name: String(value ?? s.runGate()) }),
    );
  // a gate that is not there (or not a gate) is said now, not at the next run
  const sh = s.shared()?.value;
  if (key === "run.gate" && typeof value === "string" && sh) {
    ensureGatesDir(sh);
    loadGate(sh, value);
  }
  writeStored(s.config, key, s.agent(ctx.hasTree() ? ctx.tree().config : undefined).value, value);
  s.save();
  if (key === "shared" && typeof value === "string") ensureShared(value);
}

register(
  {
    path: ["config", "where"],
    summary: "Show every setting, its value and where it comes from (flag, env, tree, config, default)",
    group: "setup",
    run(ctx) {
      const rows = SETTINGS.map((def) => {
        const r = effective(ctx, def);
        return { key: def.key, value: r.value, source: r.source, env: def.env, tree: def.tree, description: def.description };
      });
      const text = lines(
        table(rows.map((r) => [r.key, display(ctx, settingDef(r.key), r.value), r.source, r.env])),
        "",
        "order: flag > env > tree (strom.json) > config > default",
        `change: strom config set <key> <value> [--for-tree]  ·  strom config unset <key> [--for-tree]`,
        `other env: ${OTHER_ENV.map((e) => e.env).join(" ")}  (strom help config where)`,
        `config file: ${ctx.display(configFile(ctx.env))}`,
      );
      return { text, data: { settings: rows, otherEnv: OTHER_ENV, file: configFile(ctx.env) } };
    },
    description:
      "Settings a tree can carry (lang, agent, model.*, brief.budget, run.minutes) are set per tree with --for-tree.\n" +
      OTHER_ENV.map((e) => `${e.env}: ${e.description}`).join("\n"),
  },
  {
    path: ["config", "get"],
    summary: "Print one setting (as it applies here)",
    group: "setup",
    args: [{ name: "key", description: `one of ${SETTINGS.map((s) => s.key).join(", ")}`, required: true }],
    run(ctx, { args }) {
      const def = settingDef(args[0]!);
      const r = effective(ctx, def);
      return { text: r.value === undefined ? "" : display(ctx, def, r.value), data: { key: def.key, value: r.value, source: r.source } };
    },
  },
  {
    path: ["config", "set"],
    summary: "Change a setting for you, or for the current tree only (--for-tree)",
    group: "setup",
    args: [
      { name: "key", description: SETTINGS.map((s) => s.key).join(", "), required: true },
      { name: "value", description: "a folder, a language code, an agent, a model name or a number", required: true },
    ],
    options: [{ name: "for-tree", type: "boolean", description: "only for the current tree (saved in its strom.json)" }],
    examples: ["strom config set lang cs", 'strom config set shared "/Volumes/Big/strom-shared"', "strom config set model.vision opus --for-tree", "strom config set run.minutes 45"],
    run: async (ctx, { args, opts }) => {
      const def = settingDef(args[0]!);
      const value = checkValue(def, args[1]!, (p) => ctx.resolvePath(p));
      // In their own terminal the user reads what full means and says yes once more.
      if (def.key === "agent.permissions" && value === "full" && ctx.settings.agentPermissions() !== "full" && !opts["for-tree"] && ctx.interactive && !isAgent(ctx.env)) {
        ctx.io.stderr(BYPASS_WARNING + "\n");
        const now = ctx.settings.agentPermissions();
        if (!(await ctx.confirm("Turn full on?", false))) return { text: `agent.permissions unchanged: ${now}`, data: { key: def.key, value: now, scope: "user" }, exitCode: 1 };
      }
      if (opts["for-tree"]) {
        const tree = setTreeSetting(ctx, def.key, value);
        return { text: `${def.key} = ${display(ctx, def, value)} for tree "${tree.config.name}"`, data: { key: def.key, value, scope: "tree" } };
      }
      setUserSetting(ctx, def.key, value);
      return { text: `${def.key} = ${display(ctx, def, value)}`, data: { key: def.key, value, scope: "user" } };
    },
  },
  {
    path: ["config", "unset"],
    summary: "Remove a setting (back to the next source: the user config, then the default)",
    group: "setup",
    args: [{ name: "key", description: SETTINGS.map((s) => s.key).join(", "), required: true }],
    options: [{ name: "for-tree", type: "boolean", description: "remove the tree's own value" }],
    examples: ["strom config unset shared", "strom config unset agent --for-tree"],
    run(ctx, { args, opts }) {
      const def = settingDef(args[0]!);
      if (opts["for-tree"]) setTreeSetting(ctx, def.key, undefined);
      else setUserSetting(ctx, def.key, undefined);
      const r = effective(ctx, def);
      return { text: `${def.key} unset — now ${display(ctx, def, r.value)} (${r.source})`, data: { key: def.key, value: r.value, source: r.source } };
    },
  },
);
