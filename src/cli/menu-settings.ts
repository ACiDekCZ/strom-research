// The menu's settings: what belongs to this computer and to the person alone —
// the setup wizard (with its model step alone), the agent working alone (its
// time, the condition it works on under), hooks, logins to archives and the
// consent to downloaders, research or archive, the tuning of the scans, Remote
// Control, maintenance (the check of the installation, disk space, the update)
// and the person's help — each at a number of its own. Only the user changes these; here
// the person at the terminal does, through the ordinary commands.

import path from "node:path";
import type { Context } from "./context.ts";
import type { UIKey } from "./ui.ts";
import { lines } from "./format.ts";
import { claudeHere, pause, subMenu, translator, type Item, type Run } from "./menu-parts.ts";
import { Tree, VERSION } from "../core/tree.ts";
import { replacedOnDisk } from "../core/self.ts";
import { modelStep, shortcutName } from "./wizard.ts";
import { DEFAULT_RUN_MINUTES, type HistoryPace } from "../core/config.ts";
import { chooseHistory, historyOfferDue, historySuggested, markHistoryAsked } from "../commands/setup.ts";
import { askGate, ensureGatesDir, listGates, loadGate } from "../core/gate.ts";
import { ensureHooksDir, hooksDir, listHooks } from "../core/hooks.ts";
import { byHandOnly, listConnectors, routeOf, routesOf, type Connector } from "../core/connector.ts";
import { claudeInChrome, CLAUDE_IN_CHROME_URL } from "../core/browser.ts";
import { ADDON_SWITCHES, PROFILES } from "../agents/profiles.ts";
import { loadLogins } from "../core/logins.ts";
import { claudeRemoteAtStartup } from "../agents/global.ts";
import { chooseMode, modeState } from "./menu-mode.ts";
import { agentsHere } from "../core/apps.ts";
import { mb, tidyPlan, TIDY_SAID } from "../core/tidy.ts";
import { calibrationOffer, viewSizesFor } from "../core/viewsizes.ts";
import { archivePermissions, archiveState, browserOnlyHere } from "./menu-archives.ts";
import { chooseTerminal, terminalState } from "./terminals.ts";
import { phoneState } from "../core/phone.ts";
import { fixEnv, pendingCount, pendingFixes } from "../commands/fixchecks.ts";
import { isArchive as archiveHere } from "../core/mode.ts";
import { isAgent } from "../core/which.ts";
import { placesWithCoords } from "../core/placehistory.ts";
import { placeCost } from "./menu-links.ts";

export async function settingsMenu(ctx: Context, run: Run, lang: string, root: string | undefined, newer?: string): Promise<"quit" | void> {
  const t = translator(lang);
  return subMenu(
    ctx,
    lang,
    () => {
      ctx.settings.reload();
      const shared = ctx.settings.shared()?.value;
      const tree = root ? Tree.open(root, ctx.env).config : undefined;
      const minutes = ctx.settings.number("run.minutes", tree, DEFAULT_RUN_MINUTES);
      const gate = ctx.settings.runGate();
      const on = ctx.settings.config.hooks ?? [];
      const anyHook = shared ? listHooks(shared).length > 0 : false;
      // Each item keeps its number (fixed): what shows only sometimes leaves a gap where it is not — the numbers a person
      // knows never move. An archive: nothing of an agent — working alone, the downloaders, the tuning of the scans,
      // Remote Control not shown.
      const archive = ctx.actsAsArchive();
      // the model the agent does the research with (every agent: its strong ones offered) — not in an archive, nor
      // while the research's agent is not on this computer (nothing of an agent the person does not use)
      const agent = ctx.settings.agent(tree).value;
      const modelShown = !archive && !!PROFILES[agent] && agentsHere(ctx.env).some((a) => a.id === agent);
      const items: Item[] = [
        {
          key: "1",
          label: t(archive ? "ui.settings.wizard.archive" : "ui.settings.wizard"),
          act: async () => {
            // the setup's model step alone, the terminal for the research's windows, or the whole setup (Enter); 0 back
            // with nothing changed (the menu has nine items: these are steps of the setup)
            const parts: { label: string; act: () => Promise<void> }[] = [];
            if (modelShown) {
              const kept = ctx.settings.resolve("model.lead", tree, agent);
              parts.push({ label: t("ui.settings.model", { agent: PROFILES[agent]!.name, model: kept ? String(kept.value) : t("ui.settings.model.own") }), act: () => modelStep(ctx, run, lang, agent, tree) });
            }
            // macOS: the terminal chosen here; Windows: the system decides it, said where
            if (process.platform === "darwin" || process.platform === "win32")
              parts.push({ label: t(archive ? "ui.settings.terminal.archive" : "ui.settings.terminal", { state: terminalState(ctx, lang) }), act: () => terminalStep(ctx, run, lang) });
            // the phone connection: this computer's, an archive's too (photos into it)
            parts.push({ label: t("ui.settings.phone", { state: phoneLabel(ctx, lang) }), act: () => phoneStep(ctx, run, lang) });
            if (parts.length) {
              const i = await ctx.choose(t("ui.settings.wizard.what"), [{ label: t("ui.settings.wizard.all") }, ...parts.map((p) => ({ label: p.label }))], 0, { back: t("ui.browse.back") });
              if (i === undefined) return;
              if (i > 0) return void (await parts[i - 1]!.act());
            }
            // After the wizard the menu starts afresh: the research may be in another folder now.
            await run(["setup"]);
            return true;
          },
        },
        ...(archive ? [] : [{ key: "2", label: t("ui.settings.alone", { minutes, gate: gate ? gateName(shared, gate) : t("ui.settings.gate.none") }), act: async () => alone(ctx, run, lang, root) }]),
        {
          key: "3",
          label: t("ui.settings.hooks", { state: on.length ? on.join(", ") : t(anyHook ? "ui.settings.off" : "ui.hooks.nothing") }),
          act: async () => (shared ? hooks(ctx, run, lang, shared) : undefined),
        },
        ...(archive ? [] : [{ key: "4", label: t("ui.settings.archives"), act: async () => archives(ctx, run, lang, shared, root) }]),
      ];
      // the research of the tree worked on: with an agent (or waiting for one), or only an archive of the data from the
      // Strom app — and what a new research on this computer is (no tree yet: that one alone)
      items.push({
        key: "5",
        label: root
          ? t("ui.settings.mode", { state: t(modeState(ctx, root)) })
          : t("ui.settings.newmode", { state: t(ctx.settings.config.mode === "archive" ? "ui.mode.archive" : "ui.mode.research") }),
        act: async () => chooseMode(ctx, run, lang, root),
      });
      // the size of the scan views tuned for this agent and model on the research's own records (paid: the person's yes
      // after the cost is said) — shown where the model can be chosen
      if (root && modelShown) {
        const views = viewSizesFor(ctx.settings, agent, tree, undefined, root);
        const other = calibrationOffer(ctx.settings, agent, tree, root);
        items.push({
          key: "6",
          label: t("ui.settings.views", {
            state: views.calibrated ? t("ui.settings.views.done", { date: views.calibrated.at }) : t(other ? "ui.settings.views.other" : "ui.settings.views.default"),
          }),
          act: async () => {
            await run(["media", "calibrate"]);
            await pause(ctx, lang);
          },
        });
      }
      if (!archive && claudeHere(ctx, tree)) {
        // Claude Code may do it for its conversations itself (its own setting): what holds is said as it is.
        const own = claudeRemoteAtStartup(ctx.env);
        const remote = ctx.settings.agentRemote();
        items.push({
          key: "7",
          label: t("ui.settings.remote", { state: t(remote ? "ui.settings.remote.both" : own ? "ui.settings.remote.chats" : "ui.settings.off") }),
          act: async () => {
            ctx.io.stdout(t(own ? "ui.settings.remote.own" : "ui.settings.remote.about") + "\n");
            // on: the command asks the person's yes itself (Enter says no) — asked once
            if (!remote) await run(["config", "set", "agent.remote", "on"], true);
            else if (await ctx.confirm(t("ui.settings.remote.off"), false)) await run(["config", "set", "agent.remote", "off"], true);
          },
        });
      }
      // maintenance: the check of the installation, disk space, the newer strom when one is out (said on its line)
      const disk = root ? tidyPlan(Tree.open(root, ctx.env)) : undefined;
      items.push({
        key: "8",
        label: newer
          ? t("ui.settings.maintenance.update", { version: newer })
          : disk && disk.frees >= TIDY_SAID
            ? t("ui.settings.maintenance.tidy", { size: mb(disk.frees, lang) })
            : t("ui.settings.maintenance"),
        act: async () => maintenance(ctx, run, lang, root, newer),
      });
      // a person's help in their language (strom help --human)
      items.push({
        key: "9",
        label: t("ui.settings.help"),
        act: async () => {
          await run(["help", "--human"]);
          await pause(ctx, lang);
        },
      });
      return { title: t("ui.settings.title"), items };
    },
    { fixed: true },
  );
}

/** The terminal for the research's windows: picked among those here (0 back, nothing changed); Windows: where the system decides it. */
async function terminalStep(ctx: Context, run: Run, lang: string): Promise<void> {
  if (process.platform === "win32") {
    ctx.io.stdout(translator(lang)("ui.terminal.windows") + "\n");
    return pause(ctx, lang);
  }
  const now = ctx.settings.terminal() ?? "system";
  const picked = await chooseTerminal(ctx, lang, now, { back: translator(lang)("ui.browse.back") });
  if (picked === undefined || picked === now) return;
  await run(picked === "system" ? ["config", "unset", "terminal"] : ["config", "set", "terminal", picked], true);
}

/** The phone connection as the settings say it: off, or on with the phones paired (an error: said as one). */
function phoneLabel(ctx: Context, lang: string): string {
  const t = translator(lang);
  const s = phoneState(ctx.env);
  if (s.state === "on") return t("ui.settings.phone.on", { n: s.phones.length });
  if (s.state === "error") return t("ui.settings.phone.error");
  return t("ui.settings.off");
}

/**
 * The phone connection: off — turned on on a yes (the person's, in their terminal: strom phone on); on — turned off, or a
 * phone taken off the paired ones; 0 back with nothing changed.
 */
async function phoneStep(ctx: Context, run: Run, lang: string): Promise<void> {
  const t = translator(lang);
  const s = phoneState(ctx.env);
  if (s.state !== "on" && s.state !== "error") {
    // strom phone on asks the person itself (Enter: no, nothing changed)
    await run(["phone", "on"]);
    await pause(ctx, lang);
    return;
  }
  const i = await ctx.choose(t(s.state === "on" ? "ui.phone.on" : s.error?.waiting ? "ui.phone.waiting" : "ui.phone.error", { urls: s.addresses.map((a) => a.url).join(", "), why: t(`ui.phone.why.${s.error?.code ?? "bind-failed"}` as UIKey) }), [{ label: t("ui.phone.menu.off") }, ...s.phones.map((p) => ({ label: t("ui.phone.menu.remove", { name: p.name || p.id, date: p.pairedAt.slice(0, 10) }) }))], 0, { back: t("ui.browse.back") });
  if (i === undefined) return;
  if (i === 0) await run(["phone", "off"]);
  else await run(["phone", "remove", s.phones[i - 1]!.id]);
  await pause(ctx, lang);
}

/** Maintenance: the check of the installation, what strom keeps beside the research (disk space), the newer strom when one is out, what to back up. */
async function maintenance(ctx: Context, run: Run, lang: string, root: string | undefined, newer: string | undefined): Promise<"quit" | void> {
  const t = translator(lang);
  return subMenu(
    ctx,
    lang,
    () => {
      const items: Item[] = [
        {
          key: "1",
          label: t("ui.menu.doctor"),
          act: async () => {
            const code = await run(["doctor"]);
            if (code !== 0 && (await ctx.confirm(t("ui.menu.fix"), true))) await run(["doctor", "--fix"]);
            await pause(ctx, lang);
          },
        },
      ];
      // what strom keeps beside the research: shown, then the person's yes (strom tidy)
      if (root) {
        const plan = tidyPlan(Tree.open(root, ctx.env));
        items.push({
          key: "2",
          label: plan.frees >= TIDY_SAID ? t("ui.menu.settings.tidy", { size: mb(plan.frees, lang) }) : t("ui.maintenance.tidy", { size: mb(plan.size.strom, lang) }),
          act: async () => {
            await run(["tidy"]);
            await pause(ctx, lang);
          },
        });
      }
      // what a fix of strom's left behind in this research: what it is, then the person's choice (strom fixes run)
      if (root) {
        const tree = Tree.open(root, ctx.env);
        if (!archiveHere(tree)) {
          const waits = (pendingFixes(tree, fixEnv(ctx, tree)) ?? []).reduce((n, s) => n + pendingCount(s), 0);
          items.push({
            key: "3",
            label: t("ui.maintenance.fixes", { state: waits ? t("ui.maintenance.fixes.waits", { n: waits }) : "" }),
            act: async () => {
              if (waits) await run(["fixes", "run"]);
              else await run(["fixes"]);
              await pause(ctx, lang);
            },
          });
        }
      }
      if (newer)
        items.push({
          key: "4",
          label: t("ui.menu.update", { version: newer }),
          act: async () => {
            if ((await run(["update"])) !== 0) return;
            // this menu is still the old strom: the new one starts with the next strom
            if (!replacedOnDisk(VERSION)) return;
            ctx.io.stdout(t("ui.update.restart", { shortcut: shortcutName(lang) }) + "\n");
            return "quit";
          },
        });
      // what to back up: the one folder with every research and the shared images, its size, or a research packed (strom backup)
      items.push({
        key: "5",
        label: t("ui.maintenance.backup"),
        act: async () => {
          await run(["backup"]);
          await pause(ctx, lang);
        },
      });
      return { title: t("ui.maintenance.title"), items };
    },
    { fixed: true },
  );
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
    // Without the person's own add-ons (skills, plugins, MCP servers) — only for an agent that has the switches (nearly
    // always here: before the test of a gate, which shows only with one set); a tree with a value of its own: the
    // change is for it, else it would not show. Enter keeps what is.
    const agent = ctx.settings.agent(tree).value;
    if (ADDON_SWITCHES.includes(agent)) {
      const clean = !ctx.settings.agentAddons(tree);
      items.push({
        key: "4",
        label: t("ui.alone.addons", { state: t(clean ? "ui.settings.on" : "ui.settings.off") }),
        act: async () => {
          out(t("ui.alone.addons.about"));
          if (!(await ctx.confirm(t(clean ? "ui.alone.addons.off" : "ui.alone.addons.on"), false))) return;
          const own = root ? ctx.settings.resolve("agent.addons", tree)?.source === "tree" : false;
          await run(["config", "set", "agent.addons", clean ? "on" : "off", ...(own ? ["--for-tree"] : [])], true);
        },
      });
    }
    // the experiment of history: how often between the family research's sessions, or off — the person's choice here
    // (before the test of a gate, which shows only with one set: the numbers never move)
    const history = ctx.settings.experimentsHistory(undefined);
    items.push({
      key: "5",
      label: t("ui.alone.history", { state: history ? t(`ui.history.pace.${ctx.settings.historyPace(undefined)}` as UIKey) : t("ui.settings.off") }),
      act: async () => {
        const h = await chooseHistory(ctx, t("ui.setup.history"), historySuggested(ctx), { back: t("ui.browse.back") });
        if (!h) return;
        // the person's answer: the menu's question after an update never comes
        markHistoryAsked(ctx);
        ctx.settings.save();
        await applyHistory(ctx, run, h);
      },
    });
    // the history of each place with coordinates, looked for by itself (spec 020 K7.4): this computer's, off unless the
    // person turns it on here or from the app's link; a research may have turned it off for itself
    const places = ctx.settings.historyPlacesAuto(tree);
    items.push({
      key: "6",
      label: t("ui.alone.places", { state: t(places ? "ui.settings.on" : "ui.settings.off") }),
      act: async () => {
        if (!places && !ctx.settings.experimentsHistory(tree)) {
          out(t("ui.alone.places.history"));
          await pause(ctx, lang);
          return;
        }
        const tr = root ? Tree.open(root, ctx.env) : undefined;
        const gps = tr ? placesWithCoords(tr, shared) : undefined;
        out(lines(t("ui.alone.places.about"), gps ? t("ui.link.experiment.places.count", { n: gps.places, done: gps.done }) : undefined, tr ? placeCost(t, lang, tr) : undefined));
        if (!(await ctx.confirm(t(places ? "ui.alone.places.off" : "ui.alone.places.on"), false))) return;
        await run(["config", "set", "experiments.historyPlaces", places ? "off" : "on"], true);
        // turned on here: a research's own off goes with it (this computer's choice is the person's)
        if (!places && root && tree?.experimentsHistoryPlaces === "off") await run(["config", "unset", "experiments.historyPlaces", "--for-tree"], true);
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

/**
 * An installation that has never been asked about the history of the places (set up before strom had it): asked once,
 * at the menu of a research with its agent, by a person at a terminal — the setup's question, Enter "not now" (nothing
 * turns on; later in the settings). Kept as asked before the question, whatever comes of it (Ctrl-C too): never again
 * (spec 020 K1.6, Milan 28 Oct 2026). Never for an agent, --yes or STROM_NONINTERACTIVE: nothing asked, nothing kept.
 */
export async function offerHistory(ctx: Context, run: Run, lang: string): Promise<void> {
  if (!ctx.interactive || isAgent(ctx.env) || !historyOfferDue(ctx)) return;
  const t = translator(lang);
  ctx.io.stdout(`\n${t("ui.history.offer")}\n`);
  const h = await chooseHistory(ctx, t("ui.setup.history"), "off", { off: t("ui.history.offer.no") });
  if (h === undefined) return;
  // kept as asked once answered: a terminal closed on the question asks it again (found on Windows)
  markHistoryAsked(ctx);
  ctx.settings.save();
  if (h === "off") {
    ctx.io.stdout(`${t("ui.history.offer.later")}\n`);
    return;
  }
  // said as "not now" is: what turned on, and where it changes
  if (await applyHistory(ctx, run, h)) ctx.io.stdout(`${t("ui.history.offer.on", { pace: t(`ui.history.pace.${h}` as UIKey) })}\n`);
}

/**
 * History on at the pace chosen, or off (the settings): through strom config set, as the person would type it — the
 * pace first, so turning it on asks nothing more. false: a step of it did not go through (it said why).
 */
async function applyHistory(ctx: Context, run: Run, choice: HistoryPace | "off"): Promise<boolean> {
  const on = ctx.settings.experimentsHistory(undefined);
  if (choice === "off") return on ? (await run(["config", "set", "experiments.history", "off"], true)) === 0 : true;
  if (choice !== ctx.settings.historyPace(undefined) || ctx.settings.config.experimentsHistoryPace === undefined)
    if ((await run(["config", "set", "experiments.historyPace", choice], true)) !== 0) return false;
  return on || (await run(["config", "set", "experiments.history", "on"], true)) === 0;
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
        // on: the command says what it will be told and asks a yes itself (off needs none)
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
    const connectors = listConnectors(shared, ctx.env);
    const consent = ctx.settings.connectorsConsent();
    const treeConfig = root ? Tree.open(root, ctx.env).config : undefined;
    const agent = ctx.settings.agent(treeConfig).value;
    const always = ctx.settings.resolve("agent.browser", treeConfig)?.value === "always";
    const via = (c: Connector) => (byHandOnly(c) ? "manual" : routeOf(ctx.env, c).via);
    // Each downloader on a line of its own: how its images come, and its login where it can use one.
    const lines = connectors.map((c) => {
      const login = !c.manifest.login ? "" : `; ${saved[c.name] ? t("ui.archives.login.saved", { date: saved[c.name]!.at.slice(0, 10) }) : t("ui.archives.login.none")}`;
      // what its archive's terms let it do here, the person's decision and since when, the pace (read only: the commands change it)
      const state = archiveState(ctx, lang, c);
      // an archive only a person's browser goes to: its state says the way (never "directly", a route it cannot take there)
      const how = browserOnlyHere(ctx, c) && state ? "" : t(`ui.archives.via.${via(c)}` as UIKey);
      return `  • ${c.manifest.title ?? c.name} — ${[how, login.replace(/^; /, ""), state].filter(Boolean).join("; ")}`;
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
          // off: the command asks the person's yes itself (Enter says no) — asked once
          if (consent) await run(["config", "set", "connectors.consent", "off"], true);
          else if (await ctx.confirm(t("ui.archives.consent.on"), false)) await run(["config", "set", "connectors.consent", "on"], true);
        },
      },
      // The browser for the agent in every session: Claude Code's alone, shown only when it does the research and is here.
      ...(claudeHere(ctx, treeConfig)
        ? [
            {
              key: "b",
              label: t("ui.archives.agentbrowser", { state: t(always ? "ui.archives.agentbrowser.always" : "ui.archives.agentbrowser.archives") }),
              act: async () => {
                out(t("ui.archives.agentbrowser.about"));
                if (await ctx.confirm(t(always ? "ui.archives.agentbrowser.off" : "ui.archives.agentbrowser.on"), false))
                  await run(always ? ["config", "unset", "agent.browser"] : ["config", "set", "agent.browser", "always"], true);
              },
            },
          ]
        : []),
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
      // the permission for each archive's images: slowly, through the browser, by hand — or forgotten
      ...(connectors.length ? [{ key: "p", label: t("ui.archives.permissions"), act: async () => archivePermissions(ctx, run, lang, root) }] : []),
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
