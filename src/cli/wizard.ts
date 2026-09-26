// The setup wizard: what a person answers once, and can change any time by
// running it again (every answer is pre-filled with the current value). In
// their language; Enter takes the suggestion. It checks and offers to install
// git and an AI agent, and settles the model and what the agent may do alone.
// Quietly it teaches the installed agents about strom and notices the Strom app.

import fs from "node:fs";
import path from "node:path";
import type { Context } from "./context.ts";
import { ui } from "./ui.ts";
import { isValidLang, langName } from "../core/lang.ts";
import { gitVersion } from "../core/git.ts";
import { fixGit, offerAgent } from "./fixes.ts";
import { agentsHere, DESKTOP_APPS } from "../core/apps.ts";
import { PROFILES } from "../agents/profiles.ts";
import { writeStored, type AgentPermissions, PERMISSION_LEVELS } from "../core/config.ts";
import { globalTargets, installGlobal } from "../agents/global.ts";
import { noticeStromApp, researchUrl, stromAppState, stromAppUrl } from "../core/stromapp.ts";
import { openForUser } from "../core/open.ts";
import { createShortcut } from "../core/shortcut.ts";
import { desktopDir } from "../core/paths.ts";
import { ensureShared } from "../commands/setup.ts";
import { moveHome, planMove, repointSettings, sameFolder } from "../core/relocate.ts";

export interface WizardResult {
  home: string;
  lang: string;
  agent?: string;
  permissions: AgentPermissions;
}

/** The shortcut's name, in the user's language. */
export function shortcutName(lang: string): string {
  return ui(lang, "ui.dialog.title");
}

function shortcutExists(ctx: Context, lang: string): boolean {
  const dir = desktopDir(ctx.env);
  const name = shortcutName(lang);
  return [`${name}.command`, `${name}.lnk`, `${name}.cmd`, "strom-research.desktop"].some((f) => fs.existsSync(path.join(dir, f)));
}

export async function setupWizard(ctx: Context): Promise<WizardResult> {
  const s = ctx.settings;
  const cfg = s.config;
  const out = (line = "") => ctx.io.stdout(line + "\n");
  const first = !cfg.home;
  let lang = cfg.lang ?? s.lang().value;
  out(ui(lang, first ? "ui.setup.welcome" : "ui.setup.again"));
  out();

  // 1. Language — everything after is in it.
  for (;;) {
    const a = (await ctx.ask(ui(lang, "ui.setup.lang"), lang)).toLowerCase();
    if (isValidLang(a)) {
      lang = a;
      break;
    }
  }
  // Run again: each choice can be left as it is (0), the current one suggested.
  const keep = first ? {} : { back: ui(lang, "ui.keep") };
  // 2. Where the research lives.
  const was = s.home()?.value;
  const typed = (await ctx.ask(ui(lang, first ? "ui.setup.home" : "ui.setup.home.again"), ctx.display(was ?? s.suggestedHome()))).trim();
  // Run again: 0 (or nothing) keeps the folder, like every other answer here.
  let home = was && (typed === "0" || !typed) ? was : ctx.resolvePath(typed || ctx.display(s.suggestedHome()));
  // Another folder while the research is in the old one: it moves along (trees, the shared folder) — or stays where it is.
  if (was && !sameFolder(home, was)) home = await moveResearch(ctx, lang, was, home);
  cfg.lang = lang;
  if (was && !sameFolder(home, was)) repointSettings(s, ctx.env, was, home);
  else if (!was) cfg.home = home;
  s.save();
  fs.mkdirSync(home, { recursive: true });
  fs.mkdirSync(s.trees()!.value, { recursive: true });
  ensureShared(s.shared()!.value);

  // 3. Git (strom doctor --fix does the same).
  const git = gitVersion(ctx.env);
  if (git) out(ui(lang, "ui.setup.git.ok", { version: git }));
  else {
    out(ui(lang, "ui.setup.git.missing"));
    await fixGit(ctx, out);
  }

  // 4. The AI agent — its CLI or its desktop app — and where the person talks with it.
  let here = agentsHere(ctx.env);
  let installed = here.map((a) => a.id);
  if (installed.length === 0) {
    await offerAgent(ctx, out);
    here = agentsHere(ctx.env);
    installed = here.map((a) => a.id);
  }
  let agent: string | undefined;
  if (installed.length === 1) agent = installed[0];
  else if (installed.length > 1) {
    const current = Math.max(0, installed.indexOf(cfg.agent ?? "claude"));
    const i = await ctx.choose(ui(lang, "ui.setup.agent.pick"), installed.map((id) => ({ label: PROFILES[id]!.name })), current, keep);
    agent = installed[i ?? current];
  }
  if (agent) {
    cfg.agent = agent;
    out(ui(lang, "ui.setup.agent.ok", { name: PROFILES[agent]!.name }));
    // Both the app and the CLI: the person chooses (the app is the easiest); one of them: that one.
    const has = here.find((a) => a.id === agent)!;
    if (has.app && has.cli) {
      const app = DESKTOP_APPS[agent]!.name;
      const current = cfg.agentWhere === "terminal" ? 1 : 0;
      const i = await ctx.choose(ui(lang, "ui.setup.where"), [{ label: ui(lang, "ui.setup.where.app", { app }) }, { label: ui(lang, "ui.setup.where.terminal", { agent: PROFILES[agent]!.name }) }], current, keep);
      cfg.agentWhere = (i ?? current) === 1 ? "terminal" : "app";
    }
  } else out(ui(lang, "ui.setup.agent.manual", { url: researchUrl(lang, "agents") }));

  // 5. The model (Claude Code: the one choice that matters for reading old hands).
  if (agent === "claude") {
    const models = ["opus", "sonnet", undefined];
    const current = cfg.models?.claude?.lead;
    const suggested = current === undefined ? (first ? 0 : 2) : Math.max(0, models.indexOf(current));
    const i = await ctx.choose(
      ui(lang, "ui.setup.model"),
      [{ label: ui(lang, "ui.setup.model.opus") }, { label: ui(lang, "ui.setup.model.sonnet") }, { label: ui(lang, "ui.setup.model.own") }],
      suggested,
      keep,
    );
    writeStored(cfg, "model.lead", "claude", models[i ?? suggested]);
  } else if (agent) out(ui(lang, "ui.setup.model.strong", { agent: PROFILES[agent]!.name }));

  // 5b. Stories of the ancestors for the family book: on unless the person says no.
  const si = await ctx.choose(ui(lang, "ui.setup.stories"), [{ label: ui(lang, "ui.setup.stories.yes") }, { label: ui(lang, "ui.setup.stories.no") }], cfg.stories === "no" ? 1 : 0, keep);
  cfg.stories = (si ?? (cfg.stories === "no" ? 1 : 0)) === 1 ? "no" : "yes";

  // 6. What the agent may do without asking.
  const now = s.agentPermissions();
  const labels = { ask: ui(lang, "ui.setup.level.ask"), auto: ui(lang, "ui.setup.level.auto"), full: ui(lang, "ui.setup.level.full") };
  const li = await ctx.choose(ui(lang, "ui.setup.level"), PERMISSION_LEVELS.map((l) => ({ label: labels[l] })), PERMISSION_LEVELS.indexOf(now), keep);
  let level = PERMISSION_LEVELS[li ?? PERMISSION_LEVELS.indexOf(now)]!;
  if (level === "full" && now !== "full") {
    out(ui(lang, "ui.setup.level.warn"));
    if (!(await ctx.confirm(ui(lang, "ui.setup.level.sure"), false))) level = now;
  }
  cfg.agentPermissions = level;
  s.save();

  // 7. A shortcut on the desktop (asked once; refreshed quietly after).
  if (!shortcutExists(ctx, lang)) {
    if (await ctx.confirm(ui(lang, "ui.setup.shortcut"), true)) {
      try {
        for (const f of createShortcut(shortcutName(lang), ctx.env)) out(ui(lang, "ui.setup.shortcut.done", { file: ctx.display(f) }));
      } catch {
        // no desktop folder we may write to: the menu is still one command away
      }
    }
  } else createShortcut(shortcutName(lang), ctx.env);

  // Quietly: the installed agents learn about strom.
  const taught = new Set<string>();
  for (const t of globalTargets(ctx.env).filter((t) => installed.includes(t.agent))) if (installGlobal(t)) taught.add(t.agent);
  for (const a of taught) out(ui(lang, "ui.setup.skill", { agent: PROFILES[a]!.name }));

  // 8. The Strom app: noticed when it is here; else asked once whether they want it (pre-filled after).
  if (noticeStromApp(s, ctx.env, { look: true }) || stromAppState(s) === "seen") out(ui(lang, "ui.setup.app"));
  else await askStromApp(ctx, lang, first ? undefined : ui(lang, "ui.keep"));

  out();
  out(`${ui(lang, "ui.setup.done")}  (${langName(lang, lang)} · ${ctx.display(home)})`);
  return { home, lang, ...(agent ? { agent } : {}), permissions: level };
}

/**
 * Does the person want the Strom app (not found on this computer)? Yes and
 * install it now: it opens in the browser and strom says where to click; yes
 * but later; no: strom never mentions it again (strom.app no). Undefined when
 * not answered or 0 (back) — nothing changes.
 */
export async function askStromApp(ctx: Context, lang: string, back: string | undefined = ui(lang, "ui.browse.back")): Promise<"install" | "later" | "no" | undefined> {
  const said = ctx.settings.config.stromApp;
  const answers = ["install", "later", "no"] as const;
  const i = await ctx.choose(
    ui(lang, "ui.setup.stromapp"),
    [{ label: ui(lang, "ui.setup.stromapp.install") }, { label: ui(lang, "ui.setup.stromapp.later") }, { label: ui(lang, "ui.setup.stromapp.no") }],
    said === "no" ? 2 : said === "yes" ? 1 : 0,
    back ? { back } : {},
  );
  if (i === undefined) return undefined;
  const answer = answers[i]!;
  ctx.settings.config.stromApp = answer === "no" ? "no" : "yes";
  ctx.settings.save();
  if (answer === "install") {
    const url = stromAppUrl(ctx.settings);
    ctx.io.stdout(ui(lang, openForUser(url, ctx.env) ? "ui.app.install" : "ui.app.url", { url }) + "\n");
  }
  return answer;
}

/**
 * The research to another folder: what moves is said (the trees, the shared folder with the plugins and images), and it
 * moves on the person's yes. Where it cannot (somebody at work, a folder with something in it, into itself) it stays.
 * Returns the folder the research is in afterwards.
 */
async function moveResearch(ctx: Context, lang: string, from: string, to: string): Promise<string> {
  const out = (line: string) => ctx.io.stdout(line + "\n");
  // Set from outside (STROM_HOME): the folder is not the wizard's to change.
  if (ctx.settings.home()?.source !== "config") {
    out(ui(lang, "ui.home.env", { from: ctx.display(from) }));
    return from;
  }
  const plan = planMove(from, to, ctx.knownTrees().map((k) => k.root));
  if (!plan.content) return to;
  const where = { from: ctx.display(from), to: ctx.display(plan.to) };
  if (plan.problem) {
    out(ui(lang, `ui.home.${plan.problem}`, { ...where, trees: plan.busy.join(", ") }));
    out(ui(lang, "ui.home.stays", where));
    return from;
  }
  out(ui(lang, "ui.home.what", { ...where, trees: plan.trees.length ? plan.trees.join(", ") : "–" }));
  if (!(await ctx.confirm(ui(lang, "ui.home.sure"), true))) {
    out(ui(lang, "ui.home.stays", where));
    return from;
  }
  try {
    const how = moveHome(plan);
    out(ui(lang, how === "moved" ? "ui.home.moved" : "ui.home.copied", where));
    return plan.to;
  } catch (err) {
    out(ui(lang, "ui.home.failed", { ...where, reason: (err as Error).message }));
    return from;
  }
}
