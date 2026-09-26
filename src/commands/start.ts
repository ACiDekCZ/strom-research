// How a person starts: the guided menu, a conversation with the agent set up
// the way they chose, the Strom app, the shortcut on the desktop, and teaching
// the agents about strom in any folder.

import fs from "node:fs";
import path from "node:path";
import { configDir, userHome, type Env } from "../core/paths.ts";
import { prependPath, spawnAgent } from "../runners/runner.ts";
import { register } from "../cli/registry.ts";
import type { Context } from "../cli/context.ts";
import { lines } from "../cli/format.ts";
import { ui } from "../cli/ui.ts";
import { StromError, UsageError } from "../core/errors.ts";
import { PROFILES } from "../agents/profiles.ts";
import { conversationArgs } from "../agents/launch.ts";
import { globalTargets, installGlobal, isInstalled, uninstallGlobal } from "../agents/global.ts";
import { syncAgentFiles } from "../agents/files.ts";
import { AGENTS, findAgent, isAgent } from "../core/which.ts";
import { DESKTOP_APPS, agentsHere, whereToTalk } from "../core/apps.ts";
import { assertIntact } from "../core/integrity.ts";
import { treeBrowserConnectors } from "../core/connector.ts";
import { browserNote } from "./connectors.ts";
import { appOpensResearch, importAppUrl, installedStromApp, liveAppUrl, noticeStromApp, STROM_APP_URL, stromAppUrl } from "../core/stromapp.ts";
import { liveRunning, serveLive, startLive, stopLive } from "../core/live.ts";
import { openForUser } from "../core/open.ts";
import { createShortcut, openInNewTerminal } from "../core/shortcut.ts";
import { chromiumBrowser, openFileWith, openInBrowser, openWebApp, revealFile } from "../core/chromium.ts";
import { uninstallPlan, type Removal } from "../core/uninstall.ts";
import { Tree } from "../core/tree.ts";
import type { Research } from "../core/model.ts";
import { commitNow, shimDir } from "./session.ts";
import { abandonedSessions, closeSession, openSessions } from "../core/session.ts";
import { enterWorker, liveWorkers } from "../core/workers.ts";
import { phrase } from "../core/phrases.ts";

import { imageSettings, writeGedcoms, writeTreeGed } from "./output.ts";
import { shortcutName } from "../cli/wizard.ts";

/** Has the user trusted this folder in Claude Code already? (Its own record, read only.) */
function claudeTrusts(root: string, env: Env): boolean {
  const file = env.CLAUDE_CONFIG_DIR ? path.join(env.CLAUDE_CONFIG_DIR, ".claude.json") : path.join(userHome(env), ".claude.json");
  try {
    const projects = (JSON.parse(fs.readFileSync(file, "utf8")) as { projects?: Record<string, { hasTrustDialogAccepted?: boolean }> }).projects ?? {};
    const real = fs.realpathSync(root);
    return Boolean(projects[root]?.hasTrustDialogAccepted || projects[real]?.hasTrustDialogAccepted);
  } catch {
    return false;
  }
}

/** An argument as a shell would need it (for --print). */
function shellQuote(a: string): string {
  return /^[\w./:=@,+-]+$/.test(a) ? a : `'${a.replace(/'/g, "'\\''")}'`;
}

/** Wait for a child that has the terminal. */
function waitFor(child: ReturnType<typeof spawnAgent>): Promise<number> {
  return new Promise((resolve) => {
    child.on("error", () => resolve(127));
    child.on("close", (code) => resolve(code ?? 1));
  });
}

register({
  path: ["chat"],
  summary: "Talk with the AI agent about the research — in its desktop app or in this terminal, set up the way you chose",
  group: "start",
  tree: true,
  description:
    "The default way to research: the agent works in the tree folder with the tree's permissions and your level\n" +
    "(agent.permissions: ask, auto, full), your model, and asks you what matters. Where you talk (agent.where): the\n" +
    "agent's desktop app when it is installed (Claude, ChatGPT/Codex, OpenCode — the tree folder and the first message\n" +
    "filled in; you confirm the folder and send it), else its CLI in this terminal (Claude Code, Codex, Antigravity,\n" +
    "OpenCode). The first message is yours to give (--say); without it the agent reports where things\n" +
    "stand and suggests what next.",
  options: [
    { name: "say", type: "string", value: "<text>", description: "your first message to the agent" },
    { name: "print", type: "boolean", description: "print the command line instead of starting the agent" },
  ],
  examples: ["strom chat", 'strom chat --say "Find the baptism of Karel"', "strom chat --agent codex", "strom chat --print"],
  run: async (ctx: Context, { opts }) => {
    // An agent strom started (a conversation, a run) is where the research happens already. Any other
    // agent — the one that set strom up from the web page, one opened in some folder — hands the
    // research over: its own conversation, opened where it lives (the tree folder, its permissions).
    // A window strom opened to hand the research over is the person's (STROM_HANDOVER): never handed over again from there.
    const agentHere = isAgent(ctx.env) && !ctx.env.STROM_HANDOVER;
    if (agentHere && (ctx.env.STROM_WORKER || ctx.env.STROM_SESSION) && !opts.print)
      throw new UsageError("strom chat opens a conversation for the user — you are in one already", { hint: "go on with strom here" });
    const tree = ctx.tree();
    assertIntact(tree);
    const lang = tree.lang;
    const agent = ctx.settings.agent(tree.config).value;
    const profile = PROFILES[agent];
    if (!profile) throw new UsageError(`strom chat does not know agent "${agent}"`, { hint: `${Object.keys(PROFILES).join(", ")} — strom agents use claude` });
    const where = whereToTalk(agent, ctx.settings.agentWhere(), ctx.env);
    const program = findAgent(profile.command, ctx.env);
    if (!program && where === "terminal" && !opts.print) throw new StromError(ui(lang, "ui.chat.agent.missing", { agent: profile.name }), { hint: `strom setup — or install it: ${profile.url}` });
    const files = syncAgentFiles(tree);
    if (files.length) tree.withTreeLock(() => tree.commit(`Agent instructions: ${files.join(", ")}`, files));
    const shared = ctx.settings.shared()?.value;
    const researches = tree.list<Research>("research");
    const kickoff = typeof opts.say === "string" && opts.say.trim() ? opts.say.trim() : ui(lang, researches.length ? "ui.chat.continue" : "ui.chat.first");
    const level = ctx.settings.agentPermissions();

    // In the agent's desktop app: a link opens a conversation in the tree folder with the first
    // message filled in. The app reads the tree's instructions and permissions itself; the level of
    // a Claude app is the person's pick in the app (it cannot be set from outside), so strom says which.
    if (where === "app") {
      const app = DESKTOP_APPS[agent]!;
      const link = app.link(tree.root, kickoff);
      if (opts.print) return { text: link, data: { app: app.name, link, cwd: tree.root } };
      const opened = openForUser(link, ctx.env);
      const say = [opened ? ui(lang, "ui.chat.app.open", { app: app.name }) : ui(lang, "ui.chat.app.closed", { app: app.name, dir: ctx.display(tree.root), message: kickoff })];
      if (agent === "claude" && level !== "ask") say.push(ui(lang, level === "full" ? "ui.chat.app.full" : "ui.chat.app.auto"));
      // Claude's app takes the model from the tree's settings; the others' the person picks there.
      if (agent !== "claude") say.push(ui(lang, "ui.chat.app.model", { app: app.name }));
      if (agentHere && opened) say.push(ui(lang, "ui.chat.handover.end"));
      return { text: say.join("\n"), data: { agent, app: app.name, link, opened, ...(agentHere ? { handover: "app" } : {}) } };
    }
    // In a terminal: a new window, not a conversation inside this one.
    if (agentHere && !opts.print) {
      const say = typeof opts.say === "string" && opts.say.trim() ? ["--say", opts.say.trim()] : [];
      const opened = openInNewTerminal(["chat", "--agent", agent, ...say], tree.root, ctx.env);
      if (opened === "recent") return { text: ui(lang, "ui.chat.handover.recent", { agent: profile.name }), data: { agent, handover: "recent", cwd: tree.root } };
      return { text: ui(lang, opened ? "ui.chat.handover" : "ui.chat.handover.failed", { agent: profile.name }), data: { agent, handover: opened ? "window" : "none", cwd: tree.root } };
    }
    const base = {
      kickoff,
      level,
      model: ctx.settings.models(agent, tree.config).lead,
      settingsFile: path.join(tree.root, ".claude", "settings.json"),
      // Found again in Claude Code's list of sessions (/resume) and the terminal's title: the family,
      // its research when there is one, the day.
      name: ["Strom", tree.config.name, researches.length === 1 ? researches[0]!.name : undefined, new Date().toLocaleDateString(lang, { day: "numeric", month: "numeric" })].filter(Boolean).join(" · "),
      shared,
      ...(agent === "claude" ? { chrome: treeBrowserConnectors(tree, shared).length > 0, remote: ctx.settings.agentRemote() } : {}),
    };
    const args = conversationArgs(agent, base);
    if (opts.print) return { text: [program ?? profile.command, ...args].map(shellQuote).join(" "), data: { command: program ?? profile.command, args, cwd: tree.root } };

    // Other agents may work in this tree too: this one gets a name of its own, is present while it
    // works, and has its own session. Sessions of conversations that ended without closing are closed.
    for (const s of abandonedSessions(Tree.open(tree.root, ctx.env))) {
      const t = Tree.open(tree.root, ctx.env);
      // a run that is gone (each has a worker of its own), or a conversation
      closeSession(t, s, { summary: phrase(t.lang, s.runner ? "session.run" : "session.chat"), next: "", interrupted: true, endedBy: s.runner ? "run" : "chat" });
      commitNow(t, `${s.id} interrupted: its ${s.runner ? "run had stopped" : "conversation had ended"}`);
    }
    const worker = `${agent}-${process.pid}-${Date.now().toString(36)}`;
    const leave = enterWorker(tree.root, worker, `${profile.name} conversation`);
    ctx.io.stdout(ui(lang, "ui.chat.open", { agent: profile.name, exit: profile.exit }) + "\n");
    const browserSays = browserNote(ctx, tree, agent);
    if (browserSays) ctx.io.stdout(browserSays + "\n");
    // Claude Code asks once whether the folder is to be trusted — its own safety step, kept; the user knows what to answer.
    if (agent === "claude" && !claudeTrusts(tree.root, ctx.env)) ctx.io.stdout(ui(lang, "ui.chat.trust") + "\n");
    const env: Record<string, string | undefined> = { ...prependPath(ctx.env, shimDir(tree)), STROM_WORKER: worker, ...(base.model ? { STROM_MODEL: base.model } : {}) };
    delete env.STROM_HANDOVER;
    let code: number;
    try {
      const started = Date.now();
      code = await waitFor(spawnAgent(profile.command, args, { cwd: tree.root, env, stdio: "inherit" }));
      // A Claude Code without the auto mode (an older one, or a plan without it) stops at once: go on in its own mode.
      if (code !== 0 && agent === "claude" && level === "auto" && Date.now() - started < 5000)
        code = await waitFor(spawnAgent(profile.command, conversationArgs(agent, { ...base, level: "ask" }), { cwd: tree.root, env, stdio: "inherit" }));
    } finally {
      leave();
    }
    // A session the agent left open goes back: its task returns to the queue.
    for (const s of openSessions(Tree.open(tree.root, ctx.env)).filter((x) => x.worker === worker)) {
      const t = Tree.open(tree.root, ctx.env);
      closeSession(t, s, { summary: phrase(t.lang, "session.chat"), next: "", interrupted: true, endedBy: "chat" });
    }
    // What the conversation recorded goes into the results at once.
    const after = Tree.open(tree.root, ctx.env);
    writeGedcoms(ctx, after);
    commitNow(after, "Results after a conversation with the agent");
    return { text: "", data: { agent, exitCode: code } };
  },
});

register(
  {
    path: ["app"],
    summary: "Open the Strom app (the family tree app) — the installed one, else in the browser",
    group: "output",
    description:
      "In a tree, with an app that can take it (from its version 3.0.0), the app opens this research itself — the first time as\n" +
      "a new tree, after that the same tree updated — and follows it while somebody is at work on it (the live bridge).\n" +
      `Otherwise the results are ready for it in output/tree-strom.ged (in the app: Import). Each entry comes with its image,\n` +
      `cut out of its scan (the settings excerpts.*; excerpts.for none: without). Web: ${STROM_APP_URL}`,
    options: [
      { name: "live", type: "boolean", description: "the app follows this research while it goes on (the live bridge)" },
      { name: "images", type: "boolean", description: "each entry with its image (the default; kept for older scripts)" },
    ],
    examples: ["strom app", "strom app --live", "strom app install"],
    run(ctx, { opts }) {
      const lang = ctx.uiLang();
      const root = appOpensResearch(ctx.settings) ? ctx.locateTree() : undefined;
      if (root) {
        const tree = Tree.open(root, ctx.env);
        const name = tree.config.name;
        // Followed while somebody is at work on it: an agent strom started, or the agent asking for it now.
        const follow = Boolean(opts.live) || liveWorkers(root).length > 0 || isAgent(ctx.env);
        // The file as the research is now, each entry with its image: the installed app takes it, or the user drags it in.
        const ged = writeTreeGed(tree, { for: "strom", stromVersion: ctx.settings.stromVersion(tree.config) });
        const file = ged.file;
        // what strom decided itself (smaller, left out) the user hears, in their language
        const r = ged.images;
        const set = ged.imageSettings;
        const withImages =
          r && set
            ? lines(
                ui(lang, "ui.app.images", { n: String(r.excerpts), mb: (r.bytes / 1024 / 1024).toFixed(1) }),
                r.level !== r.asked ? ui(lang, "ui.app.images.smaller", { limit: String(set.mb), level: r.level, asked: r.asked }) : undefined,
                r.dropped.length ? ui(lang, "ui.app.images.left", { n: String(r.dropped.length), limit: String(set.mb) }) : undefined,
                r.outOfScope ? ui(lang, "ui.app.images.scope", { n: String(r.outOfScope), for: set.for }) : undefined,
                r.unclipped.length ? ui(lang, "ui.app.images.unclipped", { n: String(r.unclipped.length) }) : undefined,
              )
            : undefined;
        // B, D: the app reaches strom on this computer — installed from a Chromium browser (its own window: first
        // choice), else in a Chromium browser's tab; never whatever is the default (Safari cannot).
        // The copy of the app strom opens (strom.app.url: its beta, its development) — installed, that one only.
        const installed = installedStromApp(ctx.env, process.platform, stromAppUrl(ctx.settings));
        const webApp = installed?.appId && installed.browser ? { browser: installed.browser, appId: installed.appId, ...(installed.profile ? { profile: installed.profile } : {}) } : undefined;
        const browser = chromiumBrowser(ctx.env);
        if (webApp || browser) {
          // The bridge serves the tree's GEDCOM to the app; it ends by itself when nobody asks it anything.
          const info = startLive(root, ctx.env, { current: true });
          if (!info) throw new StromError("the bridge did not start", { hint: "strom live serve shows why" });
          const url = follow ? liveAppUrl(info.url, ctx.settings) : importAppUrl(`${info.url}/tree.ged`, ctx.settings);
          const inApp = webApp ? openWebApp(webApp, url, ctx.env) : false;
          const opened = inApp || (browser ? openInBrowser(browser, url, ctx.env) : false);
          const where = inApp ? ui(lang, "ui.app.where.installed") : (browser?.name ?? "");
          const text = lines(opened ? ui(lang, follow ? "ui.app.following" : "ui.app.research", { name, where }) : ui(lang, "ui.app.url", { url }), withImages);
          return { text, data: { opened, via: inApp ? "app" : "browser", ...(browser ? { browser: browser.name } : {}), url, bridge: info.url, follow } };
        }
        // A: no such browser to hand it over, but the Strom app installed from one takes the file itself (its file handler).
        if (!follow && installed && /Chrome|Edge|Brave|Chromium|Vivaldi/.test(installed.kind) && openFileWith(installed.path, file, ctx.env))
          return { text: lines(ui(lang, "ui.app.research", { name, where: installed.kind }), withImages), data: { opened: true, via: "file", file, app: installed.path, follow } };
        // C: no such browser — the app opens, the file is shown, the user drags it into the app's window.
        openForUser(installed?.path ?? stromAppUrl(ctx.settings), ctx.env);
        const shown = revealFile(file, ctx.env);
        return {
          text: lines(follow ? ui(lang, "ui.app.nolive") : undefined, ui(lang, "ui.app.drag", { file: ctx.display(file), shown: shown ? ui(lang, "ui.app.drag.shown") : "" }), withImages),
          data: { opened: shown, via: "drag", file, follow },
        };
      }
      if (opts.live) {
        const info = startLive(ctx.tree().root, ctx.env);
        if (!info) throw new StromError("the bridge did not start", { hint: "strom live serve shows why" });
        const url = liveAppUrl(info.url, ctx.settings);
        const opened = openForUser(url, ctx.env);
        return { text: opened ? ui(lang, "ui.app.opened", { where: ui(lang, "ui.app.browser") }) : ui(lang, "ui.app.url", { url }), data: { opened, url, bridge: info.url } };
      }
      const app = noticeStromApp(ctx.settings, ctx.env, { look: true }) ?? installedStromApp(ctx.env, process.platform, stromAppUrl(ctx.settings));
      const opened = openForUser(app?.path ?? stromAppUrl(ctx.settings), ctx.env);
      const text = opened ? ui(lang, "ui.app.opened", { where: app ? app.kind : ui(lang, "ui.app.browser") }) : ui(lang, "ui.app.url", { url: stromAppUrl(ctx.settings) });
      return { text, data: { opened, url: stromAppUrl(ctx.settings), ...(app ? { installed: app } : {}) } };
    },
  },
  {
    path: ["live"],
    summary: "The live bridge: the Strom app follows this research while it goes on (read only, this computer only)",
    group: "output",
    tree: true,
    description:
      "A small web server on this computer only (127.0.0.1, a secret address), that only reads: the Strom app, opened with\n" +
      "strom app --live, takes the tree from it and hears what changes — who is at work on what, what was recorded, what\n" +
      "waits for the user. It ends by itself when nobody asks it anything for two hours, or with strom live stop.",
    examples: ["strom live", "strom live start", "strom live stop"],
    run(ctx) {
      const tree = ctx.tree();
      const info = liveRunning(tree.root);
      return info
        ? { text: lines(`the bridge runs: ${info.url}`, `  the Strom app following it: ${liveAppUrl(info.url, ctx.settings)}`, "  stop: strom live stop"), data: { running: true, ...info, app: liveAppUrl(info.url, ctx.settings) } }
        : { text: "the bridge does not run — strom live start (or strom app --live)", data: { running: false } };
    },
  },
  {
    path: ["live", "start"],
    summary: "Start the live bridge in the background (or say where it runs)",
    group: "output",
    tree: true,
    run(ctx) {
      const tree = ctx.tree();
      const info = startLive(tree.root, ctx.env);
      if (!info) throw new StromError("the bridge did not start", { hint: "strom live serve shows why" });
      return { text: lines(`the bridge runs: ${info.url}`, `  the Strom app following it: ${liveAppUrl(info.url, ctx.settings)}`), data: { ...info, app: liveAppUrl(info.url, ctx.settings) } };
    },
  },
  {
    path: ["live", "stop"],
    summary: "Stop the live bridge",
    group: "output",
    tree: true,
    run(ctx) {
      const stopped = stopLive(ctx.tree().root);
      return { text: stopped ? "the bridge stopped" : "no bridge ran", data: { stopped } };
    },
  },
  {
    path: ["live", "serve"],
    summary: "Run the live bridge here, in the foreground (strom live start runs it in the background)",
    group: "output",
    tree: true,
    async run(ctx) {
      const tree = ctx.tree();
      await serveLive(tree.root, ctx.env);
      return { text: "the bridge ended", data: {} };
    },
  },
  {
    path: ["app", "install"],
    summary: "Help install the Strom app: it opens in the browser and strom says where to click",
    group: "output",
    run(ctx) {
      const lang = ctx.uiLang();
      const app = installedStromApp(ctx.env, process.platform, stromAppUrl(ctx.settings));
      if (app) {
        noticeStromApp(ctx.settings, ctx.env, { look: true });
        const opened = openForUser(app.path, ctx.env);
        return { text: ui(lang, "ui.app.installed", { kind: app.kind }), data: { installed: app, opened } };
      }
      const opened = openForUser(stromAppUrl(ctx.settings), ctx.env);
      return { text: opened ? ui(lang, "ui.app.install") : ui(lang, "ui.app.url", { url: stromAppUrl(ctx.settings) }), data: { installed: false, opened, url: stromAppUrl(ctx.settings) } };
    },
  },
);

register(
  {
    path: ["agents", "install"],
    summary: "Teach the installed AI agents about strom in any folder (a Claude Code skill, a note in the others' instructions) and let them run it without asking",
    group: "setup",
    description: "Done by the setup already. A user who opens their agent anywhere and asks about their family gets an agent that knows\nstrom is there. The user's own text in those files is kept; strom agents uninstall takes it away again.",
    options: [{ name: "all", type: "boolean", description: "also for agents not installed yet" }],
    run(ctx, { opts }) {
      const installed = agentsHere(ctx.env).map((a) => a.id);
      // One file may serve two agents: written once.
      const seen = new Set<string>();
      const rows = globalTargets(ctx.env)
        .filter((t) => (opts.all || installed.includes(t.agent)) && !seen.has(`${t.kind}:${t.file}`) && seen.add(`${t.kind}:${t.file}`))
        .map((t) => ({ agent: t.agent, file: t.file, written: installGlobal(t) }));
      const text = rows.length
        ? lines(...rows.map((r) => `${PROFILES[r.agent]!.name}: ${ctx.display(r.file)}${r.written ? "" : " (already there)"}`))
        : "no AI agent installed — strom setup offers one";
      return { text, data: { agents: rows } };
    },
  },
  {
    path: ["agents", "uninstall"],
    summary: "Take strom's note out of the AI agents' own instructions again",
    group: "setup",
    run(ctx) {
      const rows = globalTargets(ctx.env)
        .filter((t) => isInstalled(t))
        .map((t) => ({ agent: t.agent, file: t.file, removed: uninstallGlobal(t) }))
        .filter((r) => r.removed);
      return { text: rows.length ? lines(...rows.map((r) => `${PROFILES[r.agent]!.name}: removed from ${ctx.display(r.file)}`)) : "nothing to remove", data: { agents: rows } };
    },
  },
  {
    path: ["uninstall"],
    summary: "Take strom off this computer: what the agents were taught, the shortcut, its own git, its PATH lines and the program — the research and the settings stay",
    group: "setup",
    description:
      "The user's decision: a person at their terminal is asked there (--yes: no question); asked by an agent, strom asks\n" +
      "in a window of the system. Installed through npm, the program itself goes with npm uninstall -g strom-research.",
    examples: ["strom uninstall"],
    async run(ctx) {
      const lang = ctx.uiLang();
      const plan = uninstallPlan(ctx.env, ["en", "cs", "de"].map(shortcutName));
      const label = (r: Removal) => ui(lang, `ui.uninstall.${r.kind}`, { agent: r.agent ?? "" });
      const home = ctx.settings.home()?.value;
      const keeps = ui(lang, "ui.uninstall.keeps", { home: home ? ctx.display(home) : "—", config: ctx.display(configDir(ctx.env)) });
      if (!plan.remove.length)
        return { text: lines(ui(lang, "ui.uninstall.nothing"), plan.npm ? ui(lang, "ui.uninstall.npm") : undefined, keeps), data: { removed: [], npm: plan.npm } };
      const list = plan.remove.map((r) => `  ${label(r)}: ${ctx.display(r.path)}`);
      if (isAgent(ctx.env) || !ctx.yes) {
        if (!isAgent(ctx.env) && ctx.interactive) {
          ctx.io.stdout(`${lines(ui(lang, "ui.uninstall.list"), ...list, "", keeps)}
`);
          if (!(await ctx.confirm(ui(lang, "ui.uninstall.sure"), false))) return { text: ui(lang, "ui.uninstall.kept"), data: { removed: [] } };
        } else ctx.requireHuman("uninstall strom from this computer", "strom uninstall", "uninstall", ui(lang, "ui.uninstall.window"));
      }
      const removed = plan.remove.filter((r) => {
        try {
          return r.remove();
        } catch {
          return false;
        }
      });
      const failed = plan.remove.filter((r) => !removed.includes(r));
      return {
        text: lines(
          ...removed.map((r) => `✓ ${label(r)}: ${ctx.display(r.path)}`),
          ...failed.map((r) => `✗ ${label(r)}: ${ctx.display(r.path)}`),
          "",
          plan.npm ? ui(lang, "ui.uninstall.npm") : undefined,
          keeps,
          failed.length ? undefined : ui(lang, "ui.uninstall.done"),
        ),
        data: { removed: removed.map((r) => ({ kind: r.kind, path: r.path })), failed: failed.map((r) => ({ kind: r.kind, path: r.path })), npm: plan.npm },
      };
    },
  },
  {
    path: ["shortcut"],
    summary: 'Put a "Strom research" shortcut on the desktop — a double-click opens strom\'s menu',
    group: "setup",
    run(ctx) {
      const lang = ctx.uiLang();
      const files = createShortcut(shortcutName(lang), ctx.env);
      return { text: lines(...files.map((f) => ui(lang, "ui.shortcut.done", { file: ctx.display(f) }))), data: { files } };
    },
  },
  {
    path: ["menu"],
    summary: "The guided menu for a person — what `strom` opens in a terminal",
    group: "start",
    run: async (ctx) => {
      if (isAgent(ctx.env)) throw new UsageError("the menu is for a person at a terminal", { hint: "strom (orientation) — or strom --json" });
      const { runMenu } = await import("../cli/menu.ts");
      const { main } = await import("../cli/main.ts");
      await runMenu(ctx, (argv, quiet) => main(argv, quiet ? { ...ctx.io, stdout: () => undefined } : ctx.io, ctx.env, ctx.cwd));
      return { text: "" };
    },
  },
);
