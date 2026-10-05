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
import { agentsHere, suggestedWay, waysHere, whereToTalk } from "../core/apps.ts";
import { chooseWay, wayName } from "./ways.ts";
import { PROFILES } from "../agents/profiles.ts";
import { writeStored, type AgentPermissions, PERMISSION_LEVELS } from "../core/config.ts";
import { globalTargets, installGlobal } from "../agents/global.ts";
import { appCopyOfInstall, appOpensLinks, noticeStromApp, researchUrl, stromAppState, stromAppUrl } from "../core/stromapp.ts";
import { openForUser } from "../core/open.ts";
import { createShortcut } from "../core/shortcut.ts";
import { appMarkFromInstall, linkFiles, linkHandlerState, linkOwner, registerLinks, type Sys } from "../core/links.ts";
import { desktopDir, isolated } from "../core/paths.ts";
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

  // 4. The AI agent — its CLI or its desktop app — and where the person talks with it. Installed from the Strom app
  // (STROM_FROM_APP) with an agent here: the research with it suggested, an archive the other choice (Milan's
  // decision, 2026-10-03); no agent here: an archive, nothing asked.
  const fromApp = !!appMarkFromInstall(ctx.env);
  // run again from an archive: nothing of an agent asked or said (Milan's decision, 2026-10-03) — what is set stays;
  // research is switched on in the menu (its first item)
  const archived = !first && !fromApp && ctx.archiveHere();
  let here = agentsHere(ctx.env);
  let installed = here.map((a) => a.id);
  if (installed.length === 0 && !fromApp && !archived) {
    await offerAgent(ctx, out);
    here = agentsHere(ctx.env);
    installed = here.map((a) => a.id);
  }
  // run again: what it is now suggested (an archive stays one on Enter)
  const archiveFirst =
    fromApp &&
    (installed.length === 0 ||
      (await ctx.choose(ui(lang, "ui.setup.fromapp"), [{ label: ui(lang, "ui.setup.fromapp.archive") }, { label: ui(lang, "ui.setup.fromapp.agent", { agent: PROFILES[installed.includes(cfg.agent ?? "") ? cfg.agent! : installed[0]!]!.name }) }], cfg.mode === "archive" ? 0 : 1)) === 0);
  if (archiveFirst && installed.length) cfg.agent ??= installed[0];
  let agent: string | undefined;
  if (!archiveFirst && !archived) {
    // Each agent's app and its terminal a line of their own (the app first, the easiest, suggested): where the
    // conversation happens is seen and chosen — one way only: that one, nothing asked.
    const ways = waysHere(here);
    if (ways.length === 1) agent = ways[0]!.agent;
    else if (ways.length > 1) {
      const current = suggestedWay(ways, cfg.agent, cfg.agentWhere);
      const way = ways[(await chooseWay(ctx, lang, ways, current, keep)) ?? current]!;
      agent = way.agent;
      cfg.agentWhere = way.where;
    }
  }
  if (agent) {
    cfg.agent = agent;
    out(ui(lang, "ui.setup.agent.ok", { name: wayName(lang, { agent, where: whereToTalk(agent, cfg.agentWhere, ctx.env) }) }));
  } else if (!archiveFirst && !archived) out(ui(lang, "ui.setup.agent.manual", { url: researchUrl(lang, "agents") }));

  // 4b. No agent here: a research keeps the data from the Strom app as an archive (work with an agent switched on
  // later, by the person: strom mode research); an agent here again: new researches work with it, on their yes.
  if (archived) {
    // as it was
  } else if (!agent) {
    cfg.mode = "archive";
    out(ui(lang, archiveFirst && installed.length ? "ui.setup.archive.chosen" : "ui.setup.archive"));
  } else if (cfg.mode === "archive" && (fromApp || (await ctx.confirm(ui(lang, "ui.setup.archive.off"), true)))) delete cfg.mode;

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

  // 5b. Stories of the ancestors for the family book: on unless the person says no (an agent writes them).
  if (agent) {
    const si = await ctx.choose(ui(lang, "ui.setup.stories"), [{ label: ui(lang, "ui.setup.stories.yes") }, { label: ui(lang, "ui.setup.stories.no") }], cfg.stories === "no" ? 1 : 0, keep);
    cfg.stories = (si ?? (cfg.stories === "no" ? 1 : 0)) === 1 ? "no" : "yes";
  }

  // 6. What the agent may do without asking (none here: nothing to ask).
  const now = s.agentPermissions();
  let level = now;
  if (agent) {
    const labels = { ask: ui(lang, "ui.setup.level.ask"), auto: ui(lang, "ui.setup.level.auto"), full: ui(lang, "ui.setup.level.full") };
    const li = await ctx.choose(ui(lang, "ui.setup.level"), PERMISSION_LEVELS.map((l) => ({ label: labels[l] })), PERMISSION_LEVELS.indexOf(now), keep);
    level = PERMISSION_LEVELS[li ?? PERMISSION_LEVELS.indexOf(now)]!;
    if (level === "full" && now !== "full") {
      out(ui(lang, "ui.setup.level.warn"));
      if (!(await ctx.confirm(ui(lang, "ui.setup.level.sure"), false))) level = now;
    }
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

  // Quietly: the installed agents learn about strom — none for an archive (nothing of an agent: Milan's decision,
  // 2026-10-03; found on Mac: five agents taught after "an archive (no AI)"), switching research on teaches them
  if (agent) {
    const taught = new Set<string>();
    for (const t of globalTargets(ctx.env).filter((t) => installed.includes(t.agent))) if (installGlobal(t)) taught.add(t.agent);
    for (const a of taught) out(ui(lang, "ui.setup.skill", { agent: PROFILES[a]!.name }));
  }

  // 8. The Strom app: noticed when it is here; else asked once whether they want it (pre-filled after) — the person who
  // came from it wants it
  if (noticeStromApp(s, ctx.env, { look: true }) || stromAppState(s) === "seen") out(ui(lang, archived ? "ui.setup.app.archive" : "ui.setup.app"));
  // (an isolated installation tries a version: the app is the person's own strom's — not offered, nothing opened)
  else if (!fromApp && !isolated(ctx.env)) await askStromApp(ctx, lang, first ? undefined : ui(lang, "ui.keep"));

  // 9. The Strom app may start the research here (strom-research:// links): asked while it is wanted; refreshed quietly
  // after. Installed from the app: the app and its copy kept, the links — as when the setup is not run (settleFromApp)
  if (fromApp) await settleFromApp(ctx, lang);
  else if (stromAppState(s) !== "no" && appOpensLinks(s)) await offerLinks(ctx, lang);

  out();
  out(`${ui(lang, "ui.setup.done")}  (${langName(lang, lang)} · ${ctx.display(home)})`);
  return { home, lang, ...(agent ? { agent } : {}), permissions: level };
}

/**
 * Installed again over settings kept from before (strom uninstall keeps them; found on Windows: the setup was not run,
 * the links, the shortcut and what the agents knew stayed gone, and nobody said so): what the setup puts on this
 * computer goes by what is here — the agents here taught again, the shortcut offered when it is missing, the links set
 * up again on the person's yes kept (else offered; a no stands). The installer says it started strom (STROM_INSTALLER).
 */
export async function settleInstall(ctx: Context, lang: string): Promise<void> {
  const out = (line: string) => ctx.io.stdout(line + "\n");
  // an archive's settings: nothing of an agent
  const here = ctx.settings.config.mode === "archive" ? [] : agentsHere(ctx.env).map((a) => a.id);
  const taught = new Set<string>();
  for (const t of globalTargets(ctx.env).filter((t) => here.includes(t.agent))) if (installGlobal(t)) taught.add(t.agent);
  for (const a of taught) out(ui(lang, "ui.setup.skill", { agent: PROFILES[a]!.name }));
  // where to talk with the agent never chosen (kept from a strom that asked only when the agent had both) while there
  // is more than one way here: chosen now, the app suggested
  const s = ctx.settings;
  const ways = waysHere(ctx.settings.config.mode === "archive" ? [] : agentsHere(ctx.env));
  if (ways.length > 1 && !s.config.agentWhere) {
    const current = suggestedWay(ways, s.config.agent, undefined);
    const way = ways[(await chooseWay(ctx, lang, ways, current)) ?? current]!;
    s.reload();
    s.config.agent = way.agent;
    s.config.agentWhere = way.where;
    s.save();
    out(ui(lang, "ui.setup.agent.ok", { name: wayName(lang, way) }));
  }
  if (!shortcutExists(ctx, lang) && (await ctx.confirm(ui(lang, "ui.setup.shortcut"), true))) {
    try {
      for (const f of createShortcut(shortcutName(lang), ctx.env)) out(ui(lang, "ui.setup.shortcut.done", { file: ctx.display(f) }));
    } catch {
      // no desktop folder we may write to
    }
  }
  if (isolated(ctx.env) || stromAppState(s) === "no" || !appOpensLinks(s) || linkHandlerState(ctx.env) === "ours") return;
  if (s.config.links === "yes") {
    let done = false;
    try {
      done = registerLinks(ctx.env);
    } catch {
      done = false;
    }
    out(ui(lang, done ? "ui.setup.links.done" : "ui.link.on.failed"));
  } else await offerLinks(ctx, lang, { ask: false });
}

/**
 * Installed from the Strom app (STROM_FROM_APP): what that needs here goes by what is here, not by whether the setup
 * ran — a setting kept from a strom installed long ago skips it (found on Windows): the app wanted, the copy of it the
 * line came from kept (its beta; stromapp.info's line: stromapp.info), the shortcut (`shortcut`: when the setup did not
 * ask) and the links offered while they do not lead here.
 */
export async function settleFromApp(ctx: Context, lang: string, opts: { shortcut?: boolean } = {}): Promise<void> {
  const s = ctx.settings;
  s.reload();
  const cfg = s.config;
  cfg.stromApp = "yes";
  const copy = appCopyOfInstall(ctx.env);
  if (copy === null) delete cfg.stromAppUrl;
  else if (copy) cfg.stromAppUrl = copy;
  s.save();
  if (opts.shortcut && !shortcutExists(ctx, lang) && (await ctx.confirm(ui(lang, "ui.setup.shortcut"), true))) {
    try {
      for (const f of createShortcut(shortcutName(lang), ctx.env)) ctx.io.stdout(ui(lang, "ui.setup.shortcut.done", { file: ctx.display(f) }) + "\n");
    } catch {
      // no desktop folder we may write to
    }
  }
  if (appOpensLinks(s)) await offerLinks(ctx, lang);
}

/**
 * strom-research:// links: set up on the person's yes, the answer kept (a no is not asked again unasked:
 * `ask` — the wizard, doctor --fix — asks all the same, suggesting what they said). Set up before by strom: set up
 * again quietly.
 */
export async function offerLinks(ctx: Context, lang: string, opts: { ask?: boolean; platform?: NodeJS.Platform; run?: Sys } = {}): Promise<void> {
  // the system's own tools (faked in a test); undefined: the real ones
  const sys = [ctx.env, opts.platform ?? process.platform, opts.run] as const;
  // an isolated installation registers none: not asked
  if (isolated(ctx.env) || linkHandlerState(...sys) === "ours") return;
  const said = ctx.settings.config.links;
  // set up before on this person's yes: set up again quietly (after an update). Set up by another strom (another
  // installation, its own settings — found on Windows: one key for all) is not this one's to take: asked
  const made = linkFiles(...sys).length > 0 && said === "yes";
  if (!made) {
    if (said === "no" && opts.ask === false) return;
    // another installation of strom has them: said, and no suggested (Enter keeps them where they lead)
    const other = linkOwner(...sys);
    if (other.owner === "other") ctx.io.stdout(ui(lang, "ui.setup.links.other", { where: other.program ? ctx.display(other.program) : "?" }) + "\n");
    const yes = await ctx.confirm(ui(lang, ctx.archiveHere() ? "ui.setup.links.archive" : "ui.setup.links"), said !== "no" && other.owner !== "other");
    ctx.settings.reload();
    ctx.settings.config.links = yes ? "yes" : "no";
    ctx.settings.save();
    if (!yes) return;
  }
  let done = false;
  try {
    done = registerLinks(...sys);
  } catch {
    done = false;
  }
  ctx.io.stdout(ui(lang, done ? "ui.setup.links.done" : "ui.link.on.failed") + "\n");
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
    ui(lang, ctx.archiveHere() ? "ui.setup.stromapp.archive" : "ui.setup.stromapp"),
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
