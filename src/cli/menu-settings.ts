// The menu's settings: what belongs to this computer and to the person alone —
// the setup wizard, the agent working alone (its time, the condition it works
// on under), hooks, Remote Control, logins to archives and the consent to
// downloaders, the check of the installation. Only the user changes these; here
// the person at the terminal does, through the ordinary commands.

import path from "node:path";
import type { Context } from "./context.ts";
import type { UIKey } from "./ui.ts";
import { claudeHere, pause, subMenu, translator, type Item, type Run } from "./menu-parts.ts";
import { Tree } from "../core/tree.ts";
import { DEFAULT_RUN_MINUTES } from "../core/config.ts";
import { askGate, ensureGatesDir, listGates, loadGate } from "../core/gate.ts";
import { ensureHooksDir, hooksDir, listHooks } from "../core/hooks.ts";
import { listConnectors, routeOf, routesOf, type Connector } from "../core/connector.ts";
import { claudeInChrome, CLAUDE_IN_CHROME_URL } from "../core/browser.ts";
import { PROFILES } from "../agents/profiles.ts";
import { loadLogins } from "../core/logins.ts";
import { claudeRemoteAtStartup } from "../agents/global.ts";

export async function settingsMenu(ctx: Context, run: Run, lang: string, root: string | undefined, newer?: string): Promise<void> {
  const t = translator(lang);
  await subMenu(ctx, lang, () => {
    ctx.settings.reload();
    const shared = ctx.settings.shared()?.value;
    const tree = root ? Tree.open(root, ctx.env).config : undefined;
    const minutes = ctx.settings.number("run.minutes", tree, DEFAULT_RUN_MINUTES);
    const gate = ctx.settings.runGate();
    const on = ctx.settings.config.hooks ?? [];
    const anyHook = shared ? listHooks(shared).length > 0 : false;
    // The items always here first, in the same order; what shows only sometimes (Remote Control, a newer strom) after
    // them — the numbers a person knows never move.
    const items: Item[] = [
      // After the wizard the menu starts afresh: the research may be in another folder now.
      { key: "1", label: t("ui.settings.wizard"), act: async () => (await run(["setup"]), true) },
      { key: "2", label: t("ui.settings.alone", { minutes, gate: gate ? gateName(shared, gate) : t("ui.settings.gate.none") }), act: async () => alone(ctx, run, lang, root) },
      {
        key: "3",
        label: t("ui.settings.hooks", { state: on.length ? on.join(", ") : t(anyHook ? "ui.settings.off" : "ui.hooks.nothing") }),
        act: async () => (shared ? hooks(ctx, run, lang, shared) : undefined),
      },
      { key: "4", label: t("ui.settings.archives"), act: async () => archives(ctx, run, lang, shared, root) },
      {
        key: "5",
        label: t("ui.menu.doctor"),
        act: async () => {
          const code = await run(["doctor"]);
          if (code !== 0 && (await ctx.confirm(t("ui.menu.fix"), true))) await run(["doctor", "--fix"]);
          await pause(ctx, lang);
        },
      },
    ];
    if (claudeHere(ctx, tree)) {
      // Claude Code may do it for its conversations itself (its own setting): what holds is said as it is.
      const own = claudeRemoteAtStartup(ctx.env);
      const remote = ctx.settings.agentRemote();
      items.push({
        key: "6",
        label: t("ui.settings.remote", { state: t(remote ? "ui.settings.remote.both" : own ? "ui.settings.remote.chats" : "ui.settings.off") }),
        act: async () => {
          ctx.io.stdout(t(own ? "ui.settings.remote.own" : "ui.settings.remote.about") + "\n");
          if (await ctx.confirm(t(remote ? "ui.settings.remote.off" : own ? "ui.settings.remote.onalone" : "ui.settings.remote.on"), !remote))
            await run(["config", "set", "agent.remote", remote ? "off" : "on"], true);
        },
      });
    }
    if (newer) items.push({ key: "7", label: t("ui.menu.update", { version: newer }), act: async () => void (await run(["update"])) });
    return { title: t("ui.settings.title"), items };
  });
}

/** A gate as the user reads it: its title and what it is given ("Claude usage 10"). */
function gateName(shared: string | undefined, spec: string): string {
  if (!shared) return spec;
  try {
    const g = loadGate(shared, spec);
    return [g.manifest.title ?? g.name, ...g.args].join(" ");
  } catch {
    return spec;
  }
}

/** The agent working alone: how long one session may take, and the condition it works on under (run.gate). */
async function alone(ctx: Context, run: Run, lang: string, root: string | undefined): Promise<void> {
  const t = translator(lang);
  const out = (line: string) => ctx.io.stdout(line + "\n");
  await subMenu(ctx, lang, () => {
    ctx.settings.reload();
    const shared = ctx.settings.shared()?.value;
    const tree = root ? Tree.open(root, ctx.env).config : undefined;
    const minutes = ctx.settings.number("run.minutes", tree, DEFAULT_RUN_MINUTES);
    const set = ctx.settings.runGate();
    const items: Item[] = [
      {
        key: "1",
        label: t("ui.alone.minutes", { minutes }),
        act: async () => {
          for (;;) {
            const a = (await ctx.ask(t("ui.alone.minutes.ask"), String(minutes))).trim();
            if (a === "0" || a === String(minutes)) return;
            const n = Number(a);
            // a tree with a time of its own: the change is for it, else it would not show
            const own = root ? ctx.settings.resolve("run.minutes", tree)?.source === "tree" : false;
            if (Number.isInteger(n) && n >= 5 && n <= 600) return void (await run(["config", "set", "run.minutes", String(n), ...(own ? ["--for-tree"] : [])], true));
            out(t("ui.alone.minutes.bad"));
            if (ctx.io.answers !== undefined && ctx.io.answers.length === 0) return;
          }
        },
      },
    ];
    if (shared)
      items.push({
        key: "2",
        label: t("ui.alone.gate", { gate: set ? gateName(shared, set) : t("ui.settings.gate.none") }),
        act: async () => {
          ensureGatesDir(shared);
          // strom's claude-usage asks Claude Code: offered only where it is
          const claude = claudeHere(ctx, tree);
          const gates = listGates(shared).filter((g) => g.name !== "claude-usage" || claude || loadGateName(set ?? "") === g.name);
          out(t("ui.alone.gate.about"));
          const current = set ? gates.findIndex((g) => g.name === loadGateName(set)) : gates.length;
          const i = await ctx.choose(
            t("ui.alone.gate.pick"),
            [...gates.map((g) => ({ label: g.manifest.title ?? g.name })), { label: t("ui.settings.gate.none") }],
            current >= 0 ? current : gates.length + 1,
            {
              back: t("ui.browse.back"),
            },
          );
          if (i === undefined) return;
          if (i === gates.length) {
            if (set) await run(["config", "unset", "run.gate"], true);
            return;
          }
          const g = gates[i]!;
          const had = set && loadGateName(set) === g.name ? set.trim().split(/\s+/u).slice(1).join(" ") : undefined;
          let given = "";
          for (;;) {
            given = (await ctx.ask(t(g.name === "claude-usage" ? "ui.alone.gate.claude" : "ui.alone.gate.args"), had ?? (g.name === "claude-usage" ? "10" : ""))).trim();
            // claude-usage takes a number of points (0–100); anything else would stop every run
            if (g.name !== "claude-usage" || (/^\d+(?:[.,]\d+)?$/u.test(given) && Number(given.replace(",", ".")) <= 100)) break;
            out(t("ui.alone.gate.bad"));
            if (ctx.io.answers !== undefined && ctx.io.answers.length === 0) return;
          }
          given = g.name === "claude-usage" ? given.replace(",", ".") : given;
          if (given === "0" && g.name !== "claude-usage") return;
          const spec = [g.name, given].filter(Boolean).join(" ");
          if (spec !== set) await run(["config", "set", "run.gate", spec], true);
        },
      });
    if (set && shared)
      items.push({
        key: "3",
        label: t("ui.alone.test"),
        act: async () => {
          out(t("ui.alone.asking"));
          const tr = root ? Tree.open(root, ctx.env) : undefined;
          const agent = ctx.settings.agent(tr?.config).value;
          let said;
          try {
            said = askGate(loadGate(shared, set), ctx.env, { tree: tr?.root ?? "", lang: tr?.lang ?? lang, agent, model: ctx.settings.models(agent, tr?.config).lead, sessions: 0, costUsd: 0 });
          } catch (err) {
            said = { verdict: "error" as const, reason: (err as Error).message };
          }
          const at =
            said.verdict === "wait" && said.waitMs
              ? new Date(Date.now() + said.waitMs).toLocaleString(lang, { weekday: "short", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" })
              : "";
          out(t(`ui.alone.said.${said.verdict}` as UIKey, { at, reason: said.reason ? ` — ${said.reason}` : "" }));
          await pause(ctx, lang);
        },
      });
    return { title: t("ui.alone.title"), items };
  });
}

/** The gate's name in "claude-usage 10". */
function loadGateName(spec: string): string {
  return spec.trim().split(/\s+/u)[0] ?? "";
}

/** Hooks: which there are, each turned on or off by the person here; none yet: how to make one. */
async function hooks(ctx: Context, run: Run, lang: string, shared: string): Promise<void> {
  const t = translator(lang);
  ensureHooksDir(shared);
  if (!listHooks(shared).length) {
    ctx.io.stdout(t("ui.hooks.none", { readme: ctx.display(path.join(hooksDir(shared), "README.md")) }) + "\n");
    return pause(ctx, lang);
  }
  await subMenu(ctx, lang, () => {
    ctx.settings.reload();
    const on = new Set(ctx.settings.config.hooks ?? []);
    const items: Item[] = listHooks(shared).map((h, k) => ({
      key: String(k + 1),
      label: t(on.has(h.name) ? "ui.hooks.on" : "ui.hooks.off", { name: h.manifest.title ?? h.name }),
      act: async () => {
        // on: what it will be told, and a yes (off needs none)
        if (!on.has(h.name) && !(await ctx.confirm(t("ui.consent.hook.on", { name: h.manifest.title ?? h.name }), false))) return;
        await run(["hook", on.has(h.name) ? "off" : "on", h.name], true);
      },
    }));
    return { title: t("ui.hooks.title"), items };
  });
}

/** Archives: the person's logins to portals (typed here, kept on this computer), and whether downloaders ask first. */
async function archives(ctx: Context, run: Run, lang: string, shared: string | undefined, root: string | undefined): Promise<void> {
  const t = translator(lang);
  const out = (line: string) => ctx.io.stdout(line + "\n");
  await subMenu(ctx, lang, () => {
    ctx.settings.reload();
    const saved = loadLogins(ctx.env);
    const connectors = listConnectors(shared);
    const consent = ctx.settings.connectorsConsent();
    const agent = ctx.settings.agent(root ? Tree.open(root, ctx.env).config : undefined).value;
    const via = (c: Connector) => (c.manifest.policy.automation === "manual" ? "manual" : routeOf(ctx.env, c).via);
    // Each downloader on a line of its own: how its images come, and its login where it can use one.
    const lines = connectors.map((c) => {
      const login = !c.manifest.login ? "" : `; ${saved[c.name] ? t("ui.archives.login.saved", { date: saved[c.name]!.at.slice(0, 10) }) : t("ui.archives.login.none")}`;
      return `  • ${c.manifest.title ?? c.name} — ${t(`ui.archives.via.${via(c)}` as UIKey)}${login}`;
    });
    // Through the browser: only Claude Code can, with the Claude in Chrome extension — said as it is here.
    const browser = connectors.filter((c) => via(c) === "browser");
    const names = browser.map((c) => c.manifest.title ?? c.name).join(", ");
    const ext = browser.length && agent === "claude" ? claudeInChrome(ctx.env).extension : [];
    const browserLine = !browser.length
      ? undefined
      : agent !== "claude"
        ? t("ui.browser.agent", { names, agent: PROFILES[agent]?.name ?? agent })
        : ext.length
          ? t("ui.archives.browser.ok", { browsers: ext.join(", ") })
          : t("ui.browser.noext", { names, url: CLAUDE_IN_CHROME_URL });
    const withLogin = connectors.filter((c) => c.manifest.login);
    const title = connectors.length
      ? [t("ui.archives.title"), ...lines, "", ...(browserLine ? [browserLine] : []), t(withLogin.length ? "ui.archives.login.how" : "ui.archives.login.nobody")].join("\n")
      : t("ui.archives.empty");
    // A downloader that can take either way: switched here (the agents' permissions follow).
    const switchable = connectors.filter((c) => via(c) !== "manual" && routesOf(c).includes("browser") && routesOf(c).includes("direct"));
    const items: Item[] = [
      {
        key: "1",
        label: t("ui.archives.consent", { state: t(consent ? "ui.settings.on" : "ui.settings.off") }),
        act: async () => {
          out(t("ui.archives.consent.about"));
          if (await ctx.confirm(t(consent ? "ui.archives.consent.off" : "ui.archives.consent.on"), false)) await run(["config", "set", "connectors.consent", consent ? "off" : "on"], true);
        },
      },
      ...switchable.map((c) => {
        const next = via(c) === "browser" ? "direct" : "browser";
        const name = c.manifest.title ?? c.name;
        return {
          key: "s",
          label: t(next === "browser" ? "ui.archives.to.browser" : "ui.archives.to.direct", { title: name }),
          act: async () => {
            out(t(next === "browser" ? "ui.archives.browser.about" : "ui.archives.direct.about"));
            if (!(await ctx.confirm(t("ui.archives.switch"), true))) return;
            if ((await run(["connector", "use", c.name, "--via", next], true)) === 0) out(t(`ui.archives.now.${next}` as UIKey, { title: name }));
          },
        };
      }),
      ...withLogin.map((c) => ({
        key: "l",
        label: t(saved[c.name] ? "ui.archives.login.change" : "ui.archives.login.save", { title: c.manifest.title ?? c.name }),
        act: async () => void (await run(["login", c.name])),
      })),
    ];
    // at most nine
    return { title, items: items.slice(0, 9) };
  });
}
