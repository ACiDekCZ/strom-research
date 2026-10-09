// setup · doctor · config — the environment around the trees.

import { gitSize, lastCompacted } from "../core/history.ts";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { APP_URL_INVALID_SETTING, register } from "../cli/registry.ts";
import type { Context } from "../cli/context.ts";
import { lines, table } from "../cli/format.ts";
import { appWebPages, checkValue, configFile, DEFAULT_BUDGET, DEFAULT_RUN_MINUTES, OTHER_ENV, SETTINGS, settingDef, settingDescription, writeStored, type SettingDef } from "../core/config.ts";
import { syncAgentFiles } from "../agents/files.ts";
import type { Input, Media, TreeConfig } from "../core/model.ts";
import { gitVersion } from "../core/git.ts";
import { linuxGitCommand } from "../core/deps.ts";
import { fixGit, offerAgent } from "../cli/fixes.ts";
import { createShortcut } from "../core/shortcut.ts";
import { openForUser } from "../core/open.ts";
import { isValidLang, langName } from "../core/lang.ts";
import { detectAgent, isAgent } from "../core/which.ts";
import { agentsHere, DESKTOP_APPS, inDesktopApp, whereToTalk } from "../core/apps.ts";
import { setupWizard } from "../cli/wizard.ts";
import { holdsPath, insideProgram, installation, replacedHolding, stromLauncher } from "../core/self.ts";
import { liveRunning } from "../core/live.ts";
import { mb, sharedMedia, tidyPlan, TIDY_SAID } from "../core/tidy.ts";

/** So many bytes of the shared store no research here names: worth a warning. */
const MEDIA_UNNAMED_SAID = 500 * 1024 * 1024;
import { Tree, VERSION } from "../core/tree.ts";
import { checked, installUpdate, isNewer, knownNewerVersion, lastChannelOf, latestRelease, newerNode, newerVersion, setInstallChannel, updateChannel, type Channel, type Updated } from "../core/update.ts";
import { configDir, defaultHome, desktopDir, isolated, noLinks, ownCommand } from "../core/paths.ts";
import { backupBefore, backupSaid, lastBackupLine } from "../cli/backups.ts";
import { BACKUP_SAID_DAYS, lastBackup, type BackupRecord } from "../core/backup.ts";
import { planMove, sameFolder } from "../core/relocate.ts";
import { appOpensLinks, appUrlSetting, researchUrl, stromAppUrl, stromAppState } from "../core/stromapp.ts";
import { isInstalled } from "../agents/global.ts";
import { offerLinks, shortcutName } from "../cli/wizard.ts";
import { linkHandlerState, linkScheme } from "../core/links.ts";
import type { UIKey } from "../cli/ui.ts";

import { globalTargets, installGlobal } from "../agents/global.ts";
import { placeholders, ui, UI } from "../cli/ui.ts";
import { PERMISSION_LEVELS, type AgentPermissions } from "../core/config.ts";
import { PROFILES, type Tier } from "../agents/profiles.ts";
import { NeedsInputError, StromError, UsageError } from "../core/errors.ts";
import { check } from "../core/check.ts";
import { assertIntact, verifyFull } from "../core/integrity.ts";
import { ensurePluginsDir } from "../core/connector.ts";
import { ensureGatesDir, loadGate } from "../core/gate.ts";
import { ensureHooksDir } from "../core/hooks.ts";
import { claudeInChrome, CLAUDE_IN_CHROME_URL, downloadsDir } from "../core/browser.ts";
import { browserConnectors, fenceKeepsNetOff, listConnectors } from "../core/connector.ts";

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
  options: [{ name: "where", type: "string", value: "<app|terminal>", description: "where the user talks with the agent: its desktop app or the terminal (agent.where; asked in the wizard)" }],
  examples: ["strom setup", "strom setup --yes --lang cs", "strom setup --yes --where terminal", 'strom setup --home "~/Documents/Strom" --shared "/Volumes/Big/strom-shared" --lang cs'],
  run: async (ctx, { opts }) => {
    const s = ctx.settings;
    if (ctx.interactive && !isAgent(ctx.env)) {
      const r = await setupWizard(ctx);
      return { text: "", data: { ...r, trees: s.trees()!.value, shared: s.shared()!.value, config: configFile(ctx.env) } };
    }
    const cfg = s.config;
    const flags = s.flags;
    const suggestedHome = s.home()?.value ?? ctx.homeSuggestion();

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

    // never inside strom's program folder (a folder set before goes on: doctor says it)
    for (const key of ["home", "shared", "trees"] as const) if (flags[key]) refuseInProgram(ctx, key, flags[key]);
    // none named: the default — refused where it lies inside it (settings in node/), the way on said (--home)
    if (!flags.home && !s.home() && !ctx.interactive) ctx.refuseProgramFolder("home", s.suggestedHome(), { asDefault: true });
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
      if (!flags.home) {
        home = ctx.resolvePath(await ctx.ask("Where should Strom keep the research?", ctx.display(home)));
        refuseInProgram(ctx, "home", home);
      }
      if (!flags.shared && !flags.trees && (await ctx.confirm("Keep scans and the archive catalog in a separate folder (e.g. a bigger disk)?", false))) {
        shared = ctx.resolvePath(await ctx.ask("Folder for shared data:", ctx.display(path.join(home, "shared"))));
        refuseInProgram(ctx, "shared", shared);
      }
      if (!flags.lang) lang = (await ctx.ask(`Research language (the agent talks with the user in it):`, lang)).toLowerCase();
      if (!flags.agent) agent = (await ctx.ask(`Which AI agent does the research? (${Object.keys(PROFILES).join(", ")})`, agent)).toLowerCase();
    }
    if (!PROFILES[agent]) throw new UsageError(`unknown agent "${agent}"`, { hint: Object.keys(PROFILES).join(", ") });
    if (opts.where !== undefined && opts.where !== "app" && opts.where !== "terminal") throw new UsageError(`strom setup --where takes app or terminal, not "${String(opts.where)}"`, { hint: "strom setup --yes --where terminal" });
    if (!isValidLang(lang)) throw new UsageError(`invalid language code "${lang}"`, { hint: "use a code like cs, en, de" });

    cfg.home = home;
    cfg.lang = lang;
    cfg.agent = agent;
    // Set up by an agent working in its desktop app: that is where this person talks with it.
    if (opts.where === "app" || opts.where === "terminal") cfg.agentWhere = opts.where;
    else if (!cfg.agentWhere && inDesktopApp(ctx.env)) cfg.agentWhere = "app";
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
    // Where the user talks with it: said, and the other way when both are here (the user's choice, never guessed)
    const has = agentsHere(ctx.env).find((a) => a.id === agent);
    const where = has ? whereToTalk(agent, s.agentWhere(), ctx.env) : undefined;
    // in the research's language, also when an agent or a script runs it (found on Windows: English to STROM_LANG=cs)
    const t = (k: UIKey, v: Record<string, string> = {}) => ui(lang, k, v);
    const talk = !where
      ? undefined
      : `${where === "app" ? t("ui.setup.summary.app", { app: DESKTOP_APPS[agent]!.name }) : t("ui.setup.summary.terminal")}${has!.app && has!.cli ? t("ui.setup.summary.both", { where: where === "app" ? "terminal" : "app" }) : ""}`;

    const text = lines(
      t("ui.setup.summary"),
      table([
        [`  ${t("ui.setup.summary.home")}`, ctx.display(home)],
        [`  ${t("ui.setup.summary.trees")}`, ctx.display(treesDir)],
        [`  ${t("ui.setup.summary.shared")}`, ctx.display(sharedDir)],
        [`  ${t("ui.setup.summary.lang")}`, `${langName(lang, lang)} (${lang})${langDetected ? t("ui.setup.summary.detected") : ""}`],
        [`  ${t("ui.setup.summary.agent")}`, `${PROFILES[agent]!.name}${installed.includes(agent) ? "" : t("ui.setup.summary.missing")}`],
        ...(talk ? [[`  ${t("ui.setup.summary.talk")}`, talk]] : []),
        ...taught.map((a) => [`  ${t("ui.setup.summary.knows")}`, t("ui.setup.summary.anywhere", { agent: PROFILES[a]!.name })]),
        [`  ${t("ui.setup.summary.config")}`, ctx.display(configFile(ctx.env))],
      ]),
      "",
      t("ui.init.next", { command: placeholders(lang, 'strom init "<family tree name>"') }),
    );
    return { text, data: { home, trees: treesDir, shared: sharedDir, lang, agent, ...(where ? { where } : {}), config: configFile(ctx.env) } };
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
  repair?: "git" | "agent" | "knows" | "shortcut" | "app" | "links";
}

function nodeOk(version: string): boolean {
  const [maj = 0, min = 0] = version.replace(/^v/, "").split(".").map(Number);
  return maj > 22 || (maj === 22 && min >= 18);
}

const FIX = "strom doctor --fix";

/** Everything strom needs and has on this computer, in the user's language. */
/** The checks of the agents: what they are, know, may do, where the person talks with them, their model and browser. */
const AGENT_CHECKS = new Set(["agent", "knows", "where", "level", "model", "browser", "remote", "fence"]);

/** What doctor says of an isolated installation: its folder — a second one with a command of its own: the command and its links too. */
function secondLine(ctx: Context, t: (key: UIKey, values?: Record<string, string | number>) => string): string {
  if (!isolated(ctx.env)) return "";
  const folder = ctx.display(installation().root ?? configDir(ctx.env));
  const command = ownCommand(ctx.env);
  return ` · ${command ? t("ui.doc.second", { command, folder, scheme: linkScheme(ctx.env) }) : t("ui.doc.isolated", { folder })}`;
}

function diagnose(ctx: Context): Check[] {
  const lang = ctx.uiLang();
  const t = (key: UIKey, values: Record<string, string | number> = {}) => ui(lang, key, values);
  const checks: Check[] = [];
  const add = (name: string, status: Check["status"], detail: string, fix?: string, repair?: Check["repair"]) =>
    checks.push({ name, label: t(`ui.doc.${name}` as UIKey), status, detail, ...(fix ? { fix } : {}), ...(repair ? { repair } : {}) });

  // The program itself: the installer's (its own Node), or npm's or the sources' on the Node of the computer.
  // the channel said only when it is beta (the releases are what strom is: nothing said)
  const beta = updateChannel(ctx.env) === "beta" ? ` · ${t("ui.doc.beta")}` : "";
  if (installation().kind === "installed")
    add("program", "ok", `${t("ui.doc.installed", { version: VERSION, node: process.version })}${beta}${secondLine(ctx, t)}`);
  // run from the sources or npm as a second strom (STROM_ISOLATED with STROM_COMMAND): said all the same
  else if (ownCommand(ctx.env) && nodeOk(process.version)) add("program", "ok", `${t("ui.doc.innode", { version: VERSION, node: process.version })}${beta}${secondLine(ctx, t)}`);
  else if (nodeOk(process.version)) add("program", "ok", `${t("ui.doc.innode", { version: VERSION, node: process.version })}${beta}`);
  else add("program", "fail", t("ui.doc.oldnode", { node: process.version }), "https://nodejs.org");
  // The backup before another channel or an older version: one that could not be made (nothing switches until it is),
  // else where the last one is, for a month
  const backup = lastBackup(ctx.env, BACKUP_SAID_DAYS);
  if (ctx.backupFailed) add("backup", "fail", t("ui.error.backup.failed", ctx.backupFailed.params ?? {}), t("ui.error.backup.failed.hint", ctx.backupFailed.params ?? {}));
  else if (backup) add("backup", "ok", lastBackupLine(lang, backup));
  // A connector runs fenced in on the Node strom runs on; only from Node 25 does the fence keep it off the network too.
  // The installer's Node comes with strom update; npm's and the sources' are the person's own.
  if (installation().kind !== "installed" && !fenceKeepsNetOff(process.version) && listConnectors(ctx.settings.shared()?.value).length)
    add("fence", "warn", t("ui.doc.fence.net", { node: process.version }), "https://nodejs.org");
  const newer = knownNewerVersion(ctx.settings, ctx.env);
  if (newer) add("update", "warn", t("ui.doc.update.new", { version: newer }), "strom update");

  const g = gitVersion(ctx.env);
  if (g) add("git", "ok", g);
  else add("git", "fail", t("ui.doc.missing"), process.platform === "linux" ? linuxGitCommand() : FIX, "git");

  const home = ctx.settings.home();
  if (!home) add("home", "fail", t("ui.doc.notsetup"), "strom setup");
  else {
    const exists = fs.existsSync(home.value);
    // a second installation in the regular strom's folder: two installations on one research (its own: Strom <suffix>)
    const { STROM_ISOLATED: _iso, STROM_COMMAND: _cmd, ...regular } = ctx.env;
    // set up before inside strom's program folder (an isolated installation's research lay there): it goes on, said —
    // on the line of the folder that lies there, with its own path (found on a Mac: the home's said for the trees')
    const inProgram = (p: string | undefined) => !!p && !!insideProgram(p, { settings: configDir(ctx.env) });
    const program = (p: string) => `${ctx.display(p)} · ${t("ui.doc.home.program")}`;
    const homeIn = inProgram(home.value);
    if (homeIn) add("home", "warn", program(home.value), "strom setup");
    else if (isolated(ctx.env) && path.resolve(home.value) === path.resolve(defaultHome(regular))) add("home", "warn", `${ctx.display(home.value)} · ${t("ui.doc.home.regular")}`, "strom setup");
    else add("home", exists ? "ok" : "fail", ctx.display(home.value), exists ? undefined : "strom setup");
    const shared = ctx.settings.shared()!;
    const sharedOk = SHARED_DIRS.every((d) => fs.existsSync(path.join(shared.value, d)));
    if (inProgram(shared.value)) add("shared", "warn", program(shared.value), "strom setup");
    else add("shared", sharedOk ? "ok" : "warn", ctx.display(shared.value), sharedOk ? undefined : "strom setup --yes");
    const trees = ctx.knownTrees();
    // the trees' folder and the trees known elsewhere that lie there — what the home's line said already left out
    const treeFolders = [...new Set([ctx.settings.trees()?.value, ...trees.map((k) => k.root)].filter((p): p is string => inProgram(p)))];
    const treesIn = treeFolders.filter((p) => !(homeIn && holdsPath(home.value, p)) && !treeFolders.some((o) => o !== p && holdsPath(o, p)));
    if (treesIn.length) add("trees", "warn", treesIn.map(program).join(" · "), "strom setup");
    else add("trees", "ok", trees.length ? trees.map((k) => k.name).join(", ") : t("ui.doc.none"));
    // the disk: what strom keeps beside each research (strom tidy frees it), the shared scans (only said)
    const named = new Set<string>();
    let beside = 0;
    let history = 0;
    const much: string[] = [];
    const wrong: string[] = [];
    for (const k of trees) {
      // the history: how much it takes; a check of it that found something wrong (packing it: core/history.ts)
      const size = gitSize(k.root);
      history += size ? size.loose + size.packed : 0;
      const last = lastCompacted(k.root);
      if (last && !last.ok) wrong.push(t("ui.doc.history.wrong", { name: k.name, error: last.error ?? "" }));
      try {
        const tree = Tree.open(k.root, ctx.env);
        for (const r of [...tree.list<Media>("media"), ...tree.list<Input>("input")]) if (r.sha) named.add(r.sha.toLowerCase());
        const plan = tidyPlan(tree);
        beside += plan.size.strom;
        if (plan.frees >= TIDY_SAID) much.push(t("ui.doc.disk.tree", { name: k.name, size: mb(plan.frees, lang) }));
      } catch {
        // a tree not readable here: said by its own checks
      }
    }
    // a warning, never a repair: tidying takes the person's yes (strom tidy, the menu's settings → disk space)
    if (trees.length) add("disk", much.length ? "warn" : "ok", much.length ? much.join(" · ") : t("ui.doc.disk.ok", { size: mb(beside, lang) }), much.length ? t("ui.doc.disk.fix") : undefined);
    if (trees.length) add("history", wrong.length ? "warn" : "ok", wrong.length ? wrong.join(" · ") : t("ui.doc.history.ok", { size: mb(history, lang) }));
    if (sharedOk) {
      const m = sharedMedia(shared.value, named);
      add(
        "media",
        // files nobody here names, much of them: said as a warning (a material taken back, a tree taken off) — never removed
        m.unnamed.bytes >= MEDIA_UNNAMED_SAID && trees.length ? "warn" : "ok",
        t("ui.doc.media.ok", { size: mb(m.bytes, lang), n: m.files }) +
          (m.twice.n ? t("ui.doc.media.twice", { n: m.twice.n, size: mb(m.twice.bytes, lang) }) : "") +
          (m.unnamed.n && trees.length ? t("ui.doc.media.unnamed", { n: m.unnamed.n, size: mb(m.unnamed.bytes, lang) }) : ""),
      );
    }
  }

  // Agents: their CLI or their desktop app — found, never started here.
  const here = agentsHere(ctx.env);
  const found = here.map((a) => a.id);
  const tree = treeSettings(ctx);
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
    if (isolated(ctx.env)) add("knows", "ok", t("ui.doc.knows.isolated"));
    else if (agentsMissing.length) add("knows", "warn", t("ui.doc.knows.no", { agents: agentsMissing.join(", ") }), FIX, "knows");
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
  // an isolated installation puts nothing on the desktop (found on Mac: "none → strom doctor --fix")
  else if (isolated(ctx.env)) add("shortcut", "ok", t("ui.doc.shortcut.isolated"));
  // the person said no to it: not missing (the setup run again asks)
  else if (ctx.settings.config.shortcut === "no") add("shortcut", "ok", t("ui.doc.shortcut.no"));
  else add("shortcut", "warn", t("ui.doc.none"), FIX, "shortcut");
  const app = stromAppState(ctx.settings);
  // (an isolated installation uses none on purpose: the app is the person's own strom's)
  if (isolated(ctx.env)) add("app", "ok", t("ui.doc.app.isolated"));
  else add("app", "ok", t(`ui.doc.app.${app}` as UIKey), app === "unknown" ? FIX : undefined, app === "unknown" ? "app" : undefined);
  // the copy of the app strom opens: a setting that says no address of it (STROM_APP_URL, or written by hand into the
  // settings) is a problem said with its way out — doctor never fails on it (strom app refuses to open it)
  const appUrl = appUrlSetting(ctx.settings).invalid;
  if (appUrl)
    add(
      "appurl",
      "fail",
      t(appUrl.source === "env" ? "ui.doc.appurl.env" : "ui.doc.appurl.config", { value: appUrl.value }),
      appUrl.source === "env"
        ? t("ui.doc.appurl.env.fix", { web: appWebPages(ctx.env) })
        : placeholders(lang, "strom config set strom.app.url <address> · strom config unset strom.app.url"),
    );
  // …and whether it may start the research here (strom-research:// links): only while the app is wanted
  if (app !== "no" && appOpensLinks(ctx.settings)) {
    const links = linkHandlerState(ctx.env);
    if (noLinks(ctx.env)) add("links", "ok", t("ui.doc.links.isolated"));
    else if (links === "ours") add("links", "ok", t("ui.doc.links.ours"));
    else add("links", "warn", t(`ui.doc.links.${links}` as UIKey), FIX, "links");
  }

  const locked = lockedTree(ctx);
  if (locked) add("tree", "fail", t("ui.error.tree.newer", locked.params ?? {}), (locked.details as { way?: string } | undefined)?.way);
  else if (ctx.hasTree()) {
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
  if (todo.has("links") && person) await offerLinks(ctx, lang);
  // (never into the address of an invalid strom.app.url: its check says how to put it right)
  if (todo.has("app") && person && !appUrlSetting(ctx.settings).invalid && (await ctx.confirm(ui(lang, "ui.fix.app"), false))) {
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
    // an archive: nothing of an agent or AI checked or said (Milan's decision, 2026-10-03)
    const archive = ctx.archiveHere();
    const shown = (all: Check[]) => (archive ? all.filter((c) => !AGENT_CHECKS.has(c.name)) : all);
    let checks = shown(diagnose(ctx));
    const said: string[] = [];
    if (opts.fix) {
      const fixable = checks.some((c) => c.repair && (c.status !== "ok" || c.repair === "app"));
      if (fixable) await repair(ctx, checks, (line) => (ctx.interactive ? ctx.io.stdout(line + "\n") : said.push(line)));
      checks = shown(diagnose(ctx));
    }
    const bad = checks.filter((c) => c.status === "fail").length;
    const mark = { ok: "✓", warn: "!", fail: "✗" } as const;
    const text = lines(
      ...said,
      ...(said.length ? [""] : []),
      // what to do right after its detail: a long detail of another check (every tree's name) pads no column before it
      table(checks.map((c) => [` ${mark[c.status]}`, c.label, c.fix ? `${c.detail}  → ${c.fix}` : c.detail])),
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
  options: [
    { name: "check", type: "boolean", description: "only say whether there is a new version" },
    // which versions the installation takes from now on: the newest of that channel installed, an older one too
    { name: "channel", type: "string", value: "<beta|stable>", description: "the versions to take from now on", hidden: true },
  ],
  examples: ["strom update --check", "strom update"],
  async run(ctx, { opts }) {
    const lang = ctx.uiLang();
    const t = (key: UIKey, values: Record<string, string | number> = {}) => ui(lang, key, values);
    const said = opts.channel as string | undefined;
    if (said !== undefined && said !== "beta" && said !== "stable") throw new UsageError(`--channel takes beta or stable, not "${said}"`, { hint: "strom update --channel stable" });
    const to = said as Channel | undefined;
    const channel = to ?? updateChannel(ctx.env);
    const latest = await latestRelease(ctx.env, { channel, timeoutMs: 8000 });
    // the person's words in their language (the → line too); a program reads the English and the code (--json)
    if (!latest) throw new StromError(UI["ui.error.update.unknown"], { hint: UI["ui.error.update.unknown.hint"], code: "update.unknown" });
    const newest = latest.version;
    ctx.settings.config.updateCheck = checked(newest, channel);
    ctx.settings.save();
    const inst = installation();
    // npm's strom is npm's to update: its tag of the channel
    if (to && inst.kind === "npm") return { text: t("ui.update.npm.channel", { tag: to === "beta" ? "beta" : "latest" }), data: { current: VERSION, latest: newest, channel: to, npm: true } };
    // another channel: its newest version, an older one too (back from a beta); the installer's only
    const switching = !!to && inst.kind === "installed";
    // The installer's Node: the newest release of its line (security fixes) is taken along.
    const node = inst.kind === "installed" ? await newerNode(ctx.env, inst.node, latest.base).catch(() => undefined) : undefined;
    const newer = switching ? newest !== VERSION : isNewer(newest, VERSION);
    const extra = to ? { channel: to } : {};
    if (!newer && !node) {
      // the same version on the other channel: only what the installation takes from now on changes
      if (switching && !opts.check && to !== (inst.channel ?? "stable")) {
        refuseResearchInProgram(ctx, inst.root!);
        // the research backed up first: the next run is of another channel
        const backup = backupForUpdate(ctx, newest, to!);
        setInstallChannel(inst.root!, to!);
        return {
          text: lines(backup ? backupSaid(ctx, backup) : undefined, t("ui.update.current", { version: VERSION }), t(`ui.update.channel.${to!}.now` as UIKey)),
          data: { current: VERSION, latest: newest, newer: false, ...extra, ...(backup ? { backup: { path: backup.path, bytes: backup.bytes } } : {}) },
        };
      }
      return { text: t("ui.update.current", { version: VERSION }), data: { current: VERSION, latest: newest, newer: false, ...extra } };
    }
    const nodeLine = node ? t("ui.update.node.available", { from: inst.node ?? "?", to: node.version }) : undefined;
    if (opts.check)
      return { text: lines(newer ? t("ui.update.available", { version: newest, current: VERSION }) : undefined, nodeLine), data: { current: VERSION, latest: newest, newer, ...(node ? { node: node.version } : {}), ...extra } };
    if (inst.kind !== "installed")
      return { text: inst.kind === "npm" ? t("ui.update.npm", { version: newest, tag: channel === "beta" ? "beta" : "latest" }) : t("ui.update.source", { version: newest }), data: { current: VERSION, latest: newest, newer: true, npm: inst.kind === "npm" } };
    // the research where the update replaces the program: nothing asked, backed up or installed
    refuseResearchInProgram(ctx, inst.root!);
    const older = newer && isNewer(VERSION, newest);
    const question = switching
      ? `${t(`ui.update.channel.${to!}.sure` as UIKey, { version: newest, current: VERSION })} ${older ? t("ui.update.older", { version: newest, current: VERSION }) : t("ui.update.stays")}`
      : newer
        ? t("ui.update.sure", { version: newest, current: VERSION })
        : t("ui.update.node.sure", { from: inst.node ?? "?", to: node!.version });
    if (isAgent(ctx.env) || !ctx.yes) {
      if (!isAgent(ctx.env) && ctx.interactive) {
        if (!(await ctx.confirm(question, true))) return { text: t("ui.update.later"), data: { current: VERSION, latest: newest, updated: false, ...extra } };
      } else ctx.requireHuman(`update strom to ${newest}${to ? ` (--channel ${to})` : ""}`, to ? `strom update --channel ${to}` : "strom update", "update", question);
    }
    // Another channel, or an older version: every research and the settings backed up before anything is installed —
    // none made, nothing installed (Milan, 2026-10-07: "přechod beta ↔ produkce nikdy nepřijde o data")
    const backup = backupForUpdate(ctx, newest, to ?? channel);
    if (backup) ctx.io.stderr(`${backupSaid(ctx, backup)}\n`);
    if (ctx.interactive) ctx.io.stdout(`${t("ui.update.downloading", { version: newest })}\n`);
    let done: Updated;
    try {
      done = await installUpdate(ctx.env, inst.root!, process.platform, { release: latest, keep: ctx.researchFolders(), ...(switching ? { channel: to! } : {}) });
    } catch (e) {
      throw new StromError(t("ui.update.failed", { detail: (e as Error).message }), { hint: "strom update — or run the installer again" });
    }
    // The agents learn what the new version tells them.
    const { command, args } = stromLauncher();
    spawnSync(command, [...args, "agents", "install"], { stdio: "ignore", env: ctx.env as NodeJS.ProcessEnv, windowsHide: true });
    // The bridges the Strom app follows go on with the new version, at their addresses (the app goes on by itself)
    let bridges = 0;
    for (const k of ctx.knownTrees()) {
      if (!liveRunning(k.root)) continue;
      const r = spawnSync(command, [...args, "live", "start", "--current", "--json"], { cwd: k.root, env: { ...(ctx.env as NodeJS.ProcessEnv), STROM_TREE: k.root }, stdio: "ignore", windowsHide: true, timeout: 60_000 });
      if (r.status === 0) bridges++;
    }
    return {
      text: lines(newer ? t("ui.update.done", { version: done.version, previous: VERSION }) : undefined, done.node ? t("ui.update.node.done", done.node) : undefined, bridges ? t("ui.update.bridges", { n: bridges }) : undefined),
      data: { previous: VERSION, version: done.version, updated: true, ...(done.node ? { node: done.node } : {}), bridges, ...extra, ...(backup ? { backup: { path: backup.path, bytes: backup.bytes } } : {}) },
    };
  },
});

/**
 * strom update replaces app/ and node/ of the installer's folder (app.old/ goes): a research, its backups, the settings
 * inside them would go with it (found 2026-10-07: a home set inside app/ went with the update, and the backup made
 * just before it). Then nothing is asked, backed up or installed — said why and how to move the research.
 */
function refuseResearchInProgram(ctx: Context, root: string): void {
  const at = replacedHolding(root, ctx.researchFolders())[0];
  if (!at) return;
  const { folder: hit, entry } = at;
  throw new StromError(`${ctx.display(hit)} lies inside ${ctx.display(entry)}, which strom update replaces — the research would go with it; nothing was installed`, {
    hint: "move the research out of strom's program folder first: the user runs strom setup in their own terminal (its folder question moves the research along), then strom update again",
    code: "update.in-program",
    params: { folder: ctx.display(hit), entry: ctx.display(entry) },
    details: { folder: hit, entry },
  });
}

/**
 * Before strom update installs another channel or an older version: the backup the next run of that version would
 * otherwise make (the same change: from what ran here last, its channel, to the version and channel installed). Made
 * by this strom, before anything is installed; throws when it cannot (nothing installed). None needed: undefined.
 */
function backupForUpdate(ctx: Context, newest: string, target: Channel): BackupRecord | undefined {
  const current = updateChannel(ctx.env);
  if (target === current && !isNewer(VERSION, newest)) return undefined;
  // the channel that ran here last kept (a config from before channels: stable, a strom before them was a release;
  // none recorded at all: this strom's), so the next run knows the change
  ctx.settings.config.lastChannel ??= lastChannelOf(ctx.settings.config) ?? current;
  const made = backupBefore(ctx, { from: ctx.settings.config.lastVersion ?? VERSION, to: newest, fromChannel: ctx.settings.config.lastChannel, toChannel: target }, { update: { channel: target } });
  ctx.settings.save();
  return made;
}

function display(ctx: Context, def: SettingDef, value: string | number | undefined): string {
  if (value === undefined) return "(unset)";
  return def.kind === "path" ? ctx.display(String(value)) : String(value);
}

/**
 * The research here, when a newer strom wrote it (never opened: tree.newer), else none. Its own settings are not read
 * then: the settings of this computer go on — config get, doctor (found on Windows: config get home said nothing).
 */
function lockedTree(ctx: Context): StromError | undefined {
  if (!ctx.hasTree()) return undefined;
  try {
    ctx.tree();
    return undefined;
  } catch (e) {
    if (e instanceof StromError && (e.details as { locked?: boolean } | undefined)?.locked) return e;
    throw e;
  }
}

/** The settings of the research here (strom.json), none where there is none or a newer strom wrote it. */
function treeSettings(ctx: Context): TreeConfig | undefined {
  return ctx.hasTree() && !lockedTree(ctx) ? ctx.tree().config : undefined;
}

/** Effective value of a setting, with the default filled in. */
function effective(ctx: Context, def: SettingDef): { value: string | number | undefined; source: string; invalid?: true } {
  const s = ctx.settings;
  // the address of the Strom app: read as everything reads it (appUrlSetting) — never failing; one that is no address of
  // the app is shown as found, marked invalid (B1-e)
  if (def.key === "strom.app.url") {
    const said = appUrlSetting(s);
    if (said.invalid) return { value: said.invalid.value, source: said.invalid.source, invalid: true };
    const r = s.resolve(def.key);
    return r ?? { value: said.url, source: "default" };
  }
  const tree = treeSettings(ctx);
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
  if (def.key === "agent.addons") return { value: "off", source: "default" };
  if (def.key === "browser.downloads") return { value: downloadsDir(ctx.env), source: "detected" };
  if (def.key === "agent.permissions") return { value: ctx.settings.agentPermissions(), source: ctx.settings.config.agentPermissions ? "config" : "default" };
  return { value: undefined, source: "unset" };
}

/**
 * Change a setting of one tree (strom.json): a logged operation, committed
 * together with the agent files that depend on it.
 */
/** What only the user decides about what the Strom app sends: their edits winning over records, sends written unasked. */
function syncDecisions(ctx: Context, key: string, value: string | number | undefined): void {
  const tree = treeSettings(ctx);
  if (key === "sync.edits" && value === "user" && ctx.settings.syncEdits(tree) !== "user")
    ctx.requireHuman("Let your edits in the Strom app win over what a record says (the record's fact withdrawn with the reason)?", "strom config set sync.edits user", "sync.edits", ui(ctx.uiLang(), "ui.consent.edits.user"));
  if (key === "sync.review" && value !== "on" && ctx.settings.syncReview(tree))
    ctx.requireHuman("Write what the Strom app sends at once, without your word for each send?", "strom config set sync.review off", "sync.review", ui(ctx.uiLang(), "ui.consent.review.off"));
}

/**
 * The agent working alone with the user's own add-ons (agent.addons on): an unwatched session then has the person's
 * MCP servers (mail, documents), plugins and skills at hand — the user's decision alone; turning them off is anyone's.
 */
function addonsDecision(ctx: Context, key: string, value: string | number | undefined): void {
  if (key === "agent.addons" && value === "on" && !ctx.settings.agentAddons(treeSettings(ctx)))
    ctx.requireHuman("Let the agent working alone load your own add-ons (skills, plugins, MCP servers), as in a conversation?", "strom config set agent.addons on", "agent.addons", ui(ctx.uiLang(), "ui.consent.addons"));
}

export function setTreeSetting(ctx: Context, key: string, value: string | number | undefined): Tree {
  syncDecisions(ctx, key, value);
  addonsDecision(ctx, key, value);
  const def = settingDef(key);
  if (!def.tree) throw new UsageError(`${key} is a setting of this computer, not of a tree`, { hint: `strom config set ${key} <value>` });
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

/** The folder of the research as the settings of this computer keep it (a flag of this command aside). */
function storedFolder(ctx: Context, key: "home" | "trees" | "shared"): string | undefined {
  const cfg = ctx.settings.config;
  const p = key === "home" ? cfg.home : key === "trees" ? (cfg.trees ?? cfg.home) : (cfg.shared ?? (cfg.home ? path.join(cfg.home, "shared") : undefined));
  return p ? ctx.resolvePath(p) : undefined;
}

/**
 * A folder of the research set anew (strom setup, config set) never inside strom's program folder: an update replaces
 * what is there, an uninstall takes it away. The one the settings name already goes on (an isolated installation set
 * up before kept its research in its program's folder; doctor says to move it).
 */
export function refuseInProgram(ctx: Context, key: "home" | "trees" | "shared", value: string): void {
  const target = ctx.resolvePath(value);
  const now = storedFolder(ctx, key);
  if (now && sameFolder(target, now)) return;
  ctx.refuseProgramFolder(key, target);
}

function setUserSetting(ctx: Context, key: string, value: string | number | undefined): void {
  const s = ctx.settings;
  syncDecisions(ctx, key, value);
  addonsDecision(ctx, key, value);
  if ((key === "home" || key === "trees" || key === "shared") && value !== undefined) refuseInProgram(ctx, key, String(value));
  guardResearchFolder(ctx, key, value === undefined ? undefined : String(value));
  // Loosening the agent's permissions is the user's decision alone.
  if (key === "agent.permissions" && raises(s.agentPermissions(), value))
    ctx.requireHuman(
      `Let the agent ${value === "full" ? "do everything but what the tree's permissions deny" : "work on its own, asking only about risky steps"}, without asking?`,
      `strom config set agent.permissions ${value}`,
      "agent.permissions",
      ui(ctx.uiLang(), value === "full" ? "ui.consent.level.full" : "ui.consent.level.auto"),
    );
  // The browser in every session: the user's decision alone.
  if (key === "agent.browser" && value === "always" && s.resolve("agent.browser", treeSettings(ctx))?.value !== "always")
    ctx.requireHuman("Give the agent browser tools (Claude in Chrome) in every research session?", "strom config set agent.browser always", "agent.browser", ui(ctx.uiLang(), "ui.consent.browser"));
  // Sessions steered from elsewhere (Remote Control): the user's decision alone.
  if (key === "agent.remote" && value === "on" && !s.agentRemote())
    ctx.requireHuman("Start the Claude Code sessions with Remote Control (followed and steered from claude.ai or a phone)?", "strom config set agent.remote on", "agent.remote", ui(ctx.uiLang(), "ui.consent.remote"));
  // Asking before a connector runs is the user's safeguard: only they take it away.
  if (key === "connectors.consent" && value !== "on" && s.connectorsConsent())
    ctx.requireHuman("Let connectors run without asking first?", `strom config set connectors.consent ${value ?? "off"}`, "connectors.consent", ui(ctx.uiLang(), "ui.consent.connectors.off"));
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
  writeStored(s.config, key, s.agent(treeSettings(ctx)).value, value);
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
        return { key: def.key, value: r.value, source: r.source, env: def.env, tree: def.tree, description: settingDescription(def, ctx.env), ...(r.invalid ? { invalid: true } : {}) };
      });
      const invalid = rows.filter((r) => r.invalid).map((r) => r.key);
      const text = lines(
        table(rows.map((r) => [r.key, `${display(ctx, settingDef(r.key), r.value)}${r.invalid ? "  (invalid)" : ""}`, r.source, r.env])),
        "",
        ...(invalid.length ? [APP_URL_INVALID_SETTING, ""] : []),
        "order: flag > env > tree (strom.json) > config > default",
        `change: strom config set <key> <value> [--for-tree]  ·  strom config unset <key> [--for-tree]`,
        `other env: ${OTHER_ENV.map((e) => e.env).join(" ")}  (strom help config where)`,
        `config file: ${ctx.display(configFile(ctx.env))}`,
      );
      return { text, data: { settings: rows, otherEnv: OTHER_ENV, file: configFile(ctx.env), ...(invalid.length ? { invalid } : {}) } };
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
      const shown = r.value === undefined ? "" : display(ctx, def, r.value);
      // a strom.app.url that is no address of the app: as found, and said so (B1-e)
      if (r.invalid) return { text: lines(`${shown}  (invalid)`, APP_URL_INVALID_SETTING), data: { key: def.key, value: r.value, source: r.source, invalid: [def.key] } };
      return { text: shown, data: { key: def.key, value: r.value, source: r.source } };
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
      const value = checkValue(def, args[1]!, (p) => ctx.resolvePath(p), ctx.env);
      // In their own terminal the user reads what full means and says yes once more.
      if (def.key === "agent.permissions" && value === "full" && ctx.settings.agentPermissions() !== "full" && !opts["for-tree"] && ctx.interactive && !isAgent(ctx.env)) {
        const lang = ctx.uiLang();
        ctx.io.stderr(ui(lang, "ui.full.warning") + "\n");
        const now = ctx.settings.agentPermissions();
        if (!(await ctx.confirm(ui(lang, "ui.full.ask"), false))) return { text: ui(lang, "ui.full.unchanged", { level: now }), data: { key: def.key, value: now, scope: "user" }, exitCode: 1 };
      }
      // a model is kept for one agent (the research's, or --agent): said which
      const forAgent = def.kind === "model" ? ctx.settings.agent(treeSettings(ctx)).value : undefined;
      const who = forAgent ? ` (agent ${forAgent})` : "";
      if (opts["for-tree"]) {
        const tree = setTreeSetting(ctx, def.key, value);
        return { text: `${def.key} = ${display(ctx, def, value)}${who} for tree "${tree.config.name}"`, data: { key: def.key, value, scope: "tree", ...(forAgent ? { agent: forAgent } : {}) } };
      }
      setUserSetting(ctx, def.key, value);
      return { text: `${def.key} = ${display(ctx, def, value)}${who}`, data: { key: def.key, value, scope: "user", ...(forAgent ? { agent: forAgent } : {}) } };
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
