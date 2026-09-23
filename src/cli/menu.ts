// The guided menu: what a person gets from `strom` at a terminal (or the
// shortcut on the desktop). In their language, numbered, Enter takes the
// first choice — continuing the research in a conversation with the agent,
// which is how the research is done. Every item runs an ordinary command, so
// nothing here is a second way of doing things.
//
// First time: the setup wizard, a name for the family tree, and straight into
// the first conversation with the agent.

import fs from "node:fs";
import path from "node:path";
import type { Context } from "./context.ts";
import { ui, type UIKey } from "./ui.ts";
import { Tree, VERSION } from "../core/tree.ts";
import { liveHolder } from "../core/lock.ts";
import { newerVersion } from "../core/update.ts";
import { waitingForUser } from "../commands/tasks.ts";
import { noticeStromApp, stromAppState } from "../core/stromapp.ts";
import { openForUser } from "../core/open.ts";
import type { Research } from "../core/model.ts";
import { AGENTS, findAgent } from "../core/which.ts";
import { agentsHere } from "../core/apps.ts";
import { PROFILES } from "../agents/profiles.ts";

/** Runs a strom command; quiet: its output (meant for agents) is not shown, errors are. */
type Run = (argv: string[], quiet?: boolean) => Promise<number>;

/** Create a family tree and say so in the user's words (init itself talks to agents). */
async function createTree(ctx: Context, run: Run, lang: string, name: string): Promise<string | undefined> {
  const before = new Set(ctx.knownTrees().map((k) => k.root));
  if ((await run(["init", name], true)) !== 0) return undefined;
  const made = ctx.knownTrees().find((k) => !before.has(k.root));
  if (made) ctx.io.stdout(ui(lang, "ui.tree.created", { name: made.name, dir: ctx.display(made.root) }) + "\n");
  return made?.root;
}

interface Item {
  key: string;
  label: string;
  act: () => Promise<boolean | void>;
}

export async function runMenu(ctx: Context, run: Run): Promise<void> {
  const out = (line = "") => ctx.io.stdout(line + "\n");
  const outOfAnswers = () => ctx.io.answers !== undefined && ctx.io.answers.length === 0;
  const reload = () => ctx.settings.reload();
  const pause = async (lang: string) => {
    if (!outOfAnswers()) await ctx.ask(ui(lang, "ui.enter"));
  };

  // First time on this computer: the wizard.
  if (!ctx.settings.home()) {
    await run(["setup"]);
    reload();
    if (!ctx.settings.home()) return;
  }
  noticeStromApp(ctx.settings, ctx.env, { look: true });

  for (;;) {
    reload();
    const lang = ctx.uiLang();
    const t = (key: UIKey, values: Record<string, string | number> = {}) => ui(lang, key, values);
    const known = ctx.knownTrees();
    let root: string | undefined;
    try {
      root = ctx.locateTree();
    } catch {
      root = undefined;
    }

    // No family tree yet: name it, create it, and start the research.
    if (!root && known.length === 0) {
      if (outOfAnswers()) return;
      const name = await ctx.ask(t("ui.tree.name"), t("ui.tree.default"));
      if (!(await createTree(ctx, run, lang, name))) return;
      reload();
      await run(["chat"]);
      if (outOfAnswers()) return;
      continue;
    }

    const items: Item[] = [];
    out();
    out(t("ui.menu.title", { version: VERSION }));
    const newer = await newerVersion(ctx.settings, ctx.env);
    if (newer) out(t("ui.menu.update.line", { version: newer }));
    if (root) {
      const tree = Tree.open(root, ctx.env);
      const waiting = waitingForUser(tree).length;
      const started = tree.list<Research>("research").length > 0;
      out(t("ui.menu.tree", { name: tree.config.name, persons: tree.count("person") }));
      if (waiting) out(t("ui.menu.waiting", { count: waiting }));
      if (liveHolder(path.join(root, ".strom", "run.lock"))) out(t("ui.menu.working"));
      items.push(
        { key: "1", label: t(started ? "ui.menu.chat" : "ui.menu.start"), act: async () => void (await run(["chat"])) },
        {
          key: "2",
          label: t("ui.menu.run"),
          act: async () => {
            // Working alone is the agent's CLI; with only its app on this computer, strom says so.
            const who = PROFILES[ctx.settings.agent(tree.config).value];
            if (who && !findAgent(who.command, ctx.env)) {
              out(t("ui.run.needscli", { agent: who.name }));
              await pause(lang);
              return;
            }
            let n = 0;
            while (!(Number.isInteger(n) && n > 0 && n <= 100)) {
              if (outOfAnswers()) return;
              n = Number(await ctx.ask(t("ui.run.how"), "3"));
            }
            out(t("ui.run.start"));
            await run(["run", "--max", String(n)]);
            await pause(lang);
          },
        },
        {
          key: "3",
          label: `${t("ui.menu.waitlist")}${waiting ? ` (${waiting})` : ""}`,
          act: async () => {
            if (!waiting) out(t("ui.waiting.none"));
            else {
              await run(["task", "list", "--state", "waiting"]);
              const inbox = ctx.settings.shared() ? path.join(ctx.settings.shared()!.value, "inbox") : undefined;
              if (inbox && (await ctx.confirm(t("ui.waiting.open"), false))) openForUser(inbox, ctx.env);
            }
            await pause(lang);
          },
        },
        {
          key: "4",
          label: t("ui.menu.results"),
          act: async () => {
            const outDir = path.join(root!, "output");
            const geds = ["tree.ged", "tree-strom.ged"].map((f) => path.join(outDir, f)).filter((f) => fs.existsSync(f));
            if (!geds.length) out(t("ui.results.none"));
            else {
              out(t("ui.results.files"));
              for (const g of geds) out(`  ${ctx.display(g)}`);
              const strom = geds.find((g) => g.endsWith("tree-strom.ged"));
              const app = stromAppState(ctx.settings);
              if (strom && (app === "yes" || app === "seen")) out(t("ui.results.app", { file: ctx.display(strom) }));
              else if (strom && app === "unknown") out(t("ui.results.app.maybe", { file: ctx.display(strom) }));
              if (await ctx.confirm(t("ui.results.open"), false)) openForUser(outDir, ctx.env);
            }
            await pause(lang);
          },
        },
      );
      // Several agents on this computer: this conversation with another one (the default stays).
      const current = ctx.settings.agent(tree.config).value;
      const others = agentsHere(ctx.env)
        .filter((a) => a.id !== current)
        .map((a) => AGENTS.find((x) => x.id === a.id)!);
      if (others.length)
        items.push({
          key: "9",
          label: t("ui.menu.otheragent"),
          act: async () => {
            const i = others.length === 1 ? 0 : await ctx.choose(t("ui.setup.agent.pick"), others.map((a) => ({ label: a.name })), 0);
            if (i !== undefined) await run(["chat", "--agent", others[i]!.id]);
          },
        });
      if (stromAppState(ctx.settings) !== "no") items.push({ key: "5", label: t("ui.menu.app"), act: async () => void (await run(["app"])) });
    } else {
      // Several trees and none chosen: pick one first.
      items.push({ key: "1", label: t("ui.menu.trees"), act: async () => pickTree(ctx, run, lang) });
    }
    items.push(
      { key: "6", label: t("ui.menu.settings"), act: async () => void (await run(["setup"])) },
      {
        key: "7",
        label: t("ui.menu.doctor"),
        act: async () => {
          const code = await run(["doctor"]);
          if (code !== 0 && (await ctx.confirm(t("ui.menu.fix"), true))) await run(["doctor", "--fix"]);
          await pause(lang);
        },
      },
    );
    if (newer) items.push({ key: "9", label: t("ui.menu.update", { version: newer }), act: async () => void (await run(["update"])) });
    if (root) items.push({ key: "8", label: known.length > 1 ? t("ui.menu.trees") : t("ui.menu.newtree"), act: async () => pickTree(ctx, run, lang) });
    items.push({ key: "0", label: t("ui.menu.quit"), act: async () => true });

    // Numbered in the order shown; 0 always quits.
    let n = 0;
    const i = await ctx.choose("", items.map((it) => ({ key: it.key === "0" ? "0" : String(++n), label: it.label })), 0);
    if (i === undefined) return;
    const quit = await items[i]!.act();
    if (quit === true) {
      out(t("ui.menu.bye"));
      return;
    }
  }
}

/** Choose another family tree, or create a new one (and start its research). */
async function pickTree(ctx: Context, run: Run, lang: string): Promise<void> {
  const known = ctx.knownTrees();
  const options = [...known.map((k) => ({ label: `${k.name}  (${ctx.display(k.root)})` })), { label: ui(lang, "ui.trees.new") }];
  const i = await ctx.choose(ui(lang, "ui.trees.pick"), options, 0);
  if (i === undefined) return;
  if (i < known.length) {
    await run(["trees", "use", known[i]!.root], true);
    return;
  }
  const name = await ctx.ask(ui(lang, "ui.tree.name"), ui(lang, "ui.tree.default"));
  const made = await createTree(ctx, run, lang, name);
  if (!made) return;
  await run(["trees", "use", made], true);
  await run(["chat"]);
}
