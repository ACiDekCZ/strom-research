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
import { noticeStromApp, researchUrl } from "../core/stromapp.ts";
import { createShortcut } from "../core/shortcut.ts";
import { desktopDir } from "../core/paths.ts";
import { ensureShared } from "../commands/setup.ts";

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
  return [`${name}.command`, `${name}.cmd`, "strom-research.desktop"].some((f) => fs.existsSync(path.join(dir, f)));
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
  // 2. Where the research lives.
  const home = ctx.resolvePath(await ctx.ask(ui(lang, "ui.setup.home"), ctx.display(s.home()?.value ?? s.suggestedHome())));
  cfg.lang = lang;
  cfg.home = home;
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
    const i = await ctx.choose(ui(lang, "ui.setup.agent.pick"), installed.map((id) => ({ label: PROFILES[id]!.name })), current);
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
      const i = await ctx.choose(ui(lang, "ui.setup.where"), [{ label: ui(lang, "ui.setup.where.app", { app }) }, { label: ui(lang, "ui.setup.where.terminal", { agent: PROFILES[agent]!.name }) }], current);
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
    );
    writeStored(cfg, "model.lead", "claude", models[i ?? suggested]);
  } else if (agent) out(ui(lang, "ui.setup.model.strong", { agent: PROFILES[agent]!.name }));

  // 5b. Stories of the ancestors for the family book: on unless the person says no.
  const si = await ctx.choose(ui(lang, "ui.setup.stories"), [{ label: ui(lang, "ui.setup.stories.yes") }, { label: ui(lang, "ui.setup.stories.no") }], cfg.stories === "no" ? 1 : 0);
  cfg.stories = (si ?? (cfg.stories === "no" ? 1 : 0)) === 1 ? "no" : "yes";

  // 6. What the agent may do without asking.
  const now = s.agentPermissions();
  const labels = { ask: ui(lang, "ui.setup.level.ask"), auto: ui(lang, "ui.setup.level.auto"), full: ui(lang, "ui.setup.level.full") };
  const li = await ctx.choose(ui(lang, "ui.setup.level"), PERMISSION_LEVELS.map((l) => ({ label: labels[l] })), PERMISSION_LEVELS.indexOf(now));
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

  // Quietly: the installed agents learn about strom; the Strom app is noticed.
  const taught = new Set<string>();
  for (const t of globalTargets(ctx.env).filter((t) => installed.includes(t.agent))) if (installGlobal(t)) taught.add(t.agent);
  for (const a of taught) out(ui(lang, "ui.setup.skill", { agent: PROFILES[a]!.name }));
  if (noticeStromApp(s, ctx.env, { look: true })) out(ui(lang, "ui.setup.app"));

  out();
  out(`${ui(lang, "ui.setup.done")}  (${langName(lang, lang)} · ${ctx.display(home)})`);
  return { home, lang, ...(agent ? { agent } : {}), permissions: level };
}
