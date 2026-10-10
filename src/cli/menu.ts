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
import { mb, tidyPlan, TIDY_SAID } from "../core/tidy.ts";
import { calibrationLabel, calibrationOffer } from "../core/viewsizes.ts";

/** A line as a sentence: its first letter capital (a catalog's text that also stands inside a line). */
const sentence = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
import { newerTree, Tree, VERSION } from "../core/tree.ts";
import { BACKUP_SAID_DAYS, lastBackup } from "../core/backup.ts";
import { lastBackupLine } from "./backups.ts";
import { diskVersion } from "../core/self.ts";
import { liveHolder } from "../core/lock.ts";
import { reviveLive } from "../core/live.ts";
import { newerVersion } from "../core/update.ts";
import { taskQueue, waitingForUser } from "../commands/tasks.ts";
import { humanTask } from "../commands/browse.ts";
import { loadGate } from "../core/gate.ts";
import { lacksImages } from "../core/queue.ts";
import { othersAtWork } from "../core/session.ts";
import { DEFAULT_RUN_MINUTES } from "../core/config.ts";
import { truncate } from "./format.ts";
import { appUrlSetting, installedStromApp, noticeStromApp, stromAppState } from "../core/stromapp.ts";
import { appBrowsers } from "../core/chromium.ts";
import { liveWorkers, runsAtWork } from "../core/workers.ts";
import { askStromApp, settleInstall, shortcutName } from "./wizard.ts";
import { openForUser } from "../core/open.ts";
import type { Person, Research } from "../core/model.ts";
import { displayName } from "../core/people.ts";
import { agentReady, droppedPaths, guarded, pause as partsPause, pickPerson, subMenu, type Item, type Run } from "./menu-parts.ts";
import { packPlan } from "../core/pack.ts";
import { expandHome, isolated } from "../core/paths.ts";
import { offerAgent } from "./fixes.ts";
import { addToResearch } from "./menu-research.ts";
import { waitingForYou } from "./menu-waiting.ts";
import { settingsMenu } from "./menu-settings.ts";
import { mainPerson } from "../core/kin.ts";
import { findAgent } from "../core/which.ts";
import { agentsHere, waysHere, whereToTalk, type Way } from "../core/apps.ts";
import { chooseWay, wayName } from "./ways.ts";
import { PROFILES } from "../agents/profiles.ts";
import { forStory, storiesToApprove } from "../core/stories.ts";
import { receivedPending } from "../core/sync.ts";
import { isArchive } from "../core/mode.ts";
import { switchTo } from "./menu-mode.ts";
import { appMarkFromInstall, linkScheme } from "../core/links.ts";


/** Create a family tree and say so in the user's words (init itself talks to agents). */
async function createTree(ctx: Context, run: Run, lang: string, name: string): Promise<string | undefined> {
  const before = new Set(ctx.knownTrees().map((k) => k.root));
  if ((await run(["init", name], true)) !== 0) return undefined;
  const made = ctx.knownTrees().find((k) => !before.has(k.root));
  if (made) ctx.io.stdout(ui(lang, "ui.tree.created", { name: made.name, dir: ctx.display(made.root) }) + "\n");
  return made?.root;
}

/** Each tree of the app the installer named is taken once a process (the menu may be entered again). */
const fromAppDone = new Set<string>();
/** The trees whose bridge the menu brought back (one that ended without a word): once a process. */
const revived = new Set<string>();
/** An installation over kept settings is looked over once a process. */
let installSettled = false;

export async function runMenu(ctx: Context, run: Run): Promise<void> {
  const out = (line = "") => ctx.io.stdout(line + "\n");
  const outOfAnswers = () => ctx.io.answers !== undefined && ctx.io.answers.length === 0;
  const reload = () => ctx.settings.reload();
  const pause = async (lang: string) => {
    if (!outOfAnswers()) await ctx.ask(ui(lang, "ui.enter"));
  };

  // Installed for a tree of the Strom app (the line it shows, STROM_FROM_APP): the setup if it is the first time, then
  // that tree becomes a research — once, then the menu
  const mark = appMarkFromInstall(ctx.env);
  if (mark && !fromAppDone.has(mark)) {
    fromAppDone.add(mark);
    await run(["link", "open", `${linkScheme(ctx.env)}://new?app=${mark}`]);
    reload();
  }
  // First time on this computer: the wizard. Installed again over settings kept from before (the installer started
  // strom): what the setup puts here, by what is here
  if (!ctx.settings.home()) {
    await run(["setup"]);
    reload();
    if (!ctx.settings.home()) return;
  } else if (ctx.env.STROM_INSTALLER === "1" && !mark && !installSettled) {
    installSettled = true;
    await settleInstall(ctx, ctx.uiLang());
    reload();
  }
  noticeStromApp(ctx.settings, ctx.env, { look: true });

  let toldNewer = false;
  for (;;) {
    reload();
    const lang = ctx.uiLang();
    const t = (key: UIKey, values: Record<string, string | number> = {}) => ui(lang, key, values);
    // strom updated while this menu is open (the installer, npm, another window): said once — the menu is never ended
    const disk = diskVersion(ctx.env);
    if (!toldNewer && disk && disk.version !== VERSION) {
      toldNewer = true;
      ctx.io.stdout(`\n${t("ui.update.restart", { shortcut: shortcutName(lang) })}\n`);
    }
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
      const made = await createTree(ctx, run, lang, name);
      if (!made) return;
      reload();
      // Straight into the first conversation — with an agent here; without one, the menu says how to get it. An isolated
      // installation (trying a version) starts none by itself: the menu.
      if (agentReady(ctx, Tree.open(made, ctx.env).config) && !isolated(ctx.env)) await run(["chat"]);
      if (outOfAnswers()) return;
      continue;
    }

    const items: Item[] = [];
    let appItem: Item | undefined;
    let appTip: UIKey | undefined;
    let other: Item | undefined;
    out();
    out(t("ui.menu.title", { version: VERSION }));
    // where the backup before another channel or an older version is, for a month
    const backup = lastBackup(ctx.env, BACKUP_SAID_DAYS);
    if (backup) out(lastBackupLine(lang, backup));
    const newer = await newerVersion(ctx.settings, ctx.env);
    // a research a newer strom wrote (a beta's): never opened here — why and the way on, then the menu without it
    const locked = root ? newerTree(root, ctx.env) : undefined;
    if (locked) {
      out(t(`ui.error.${locked.code}` as UIKey, locked.params ?? {}));
      for (const line of t(`ui.error.${locked.code}.hint` as UIKey, locked.params ?? {}).split("\n")) out(`→ ${line}`);
      root = undefined;
    }
    if (root) {
      const tree = Tree.open(root, ctx.env);
      // the bridge the Strom app follows, ended without a word (killed, the computer gone down): back with the menu —
      // an archive has no sessions to bring it back (found on Mac: the app "not running" until strom live start)
      if (!revived.has(root)) {
        revived.add(root);
        try {
          reviveLive(root, ctx.env);
        } catch {
          // its next start brings it back
        }
      }
      // the tasks that wait for the person, and the new versions of the stories they approved
      const waiting = waitingForUser(tree).length + storiesToApprove(tree).length + receivedPending(root).length;
      const started = tree.list<Research>("research").length > 0;
      out(t("ui.menu.tree", { name: tree.config.name, persons: tree.countLive("person") }));
      // No agent yet (none installed, or not the one chosen): the research waits for it, and item 1 gets one.
      const ready = agentReady(ctx, tree.config);
      // An archive: the data come from the Strom app, no agent — said instead
      const archive = isArchive(tree);
      if (archive) out(t("ui.menu.archive"));
      else if (!ready) out(t(agentsHere(ctx.env).length ? "ui.menu.noagent.chosen" : "ui.menu.noagent"));
      if (waiting) out(t("ui.menu.waiting", { count: waiting }));
      // much kept beside the research that can go (an older strom never tidied it): said, freed in the settings
      const disk = tidyPlan(tree);
      if (disk.frees >= TIDY_SAID) out(t("ui.tidy.hint", { strom: mb(disk.size.strom, lang), size: mb(disk.frees, lang) }));
      // the scan views tuned before, but for another agent or model: offered again (the settings), never run unasked
      const offer = !archive && ready ? calibrationOffer(ctx.settings, ctx.settings.agent(tree.config).value, tree.config) : undefined;
      if (offer) out(sentence(t("ui.views.offer", { before: calibrationLabel(offer.before[0]!, t("ui.settings.model.own")), now: calibrationLabel(offer.now, t("ui.settings.model.own")) })));
      const runs = runsAtWork(root).length;
      if (runs) out(t(runs > 1 ? "ui.menu.working.more" : "ui.menu.working", { n: runs }));
      items.push(
        ready
          ? { key: "1", label: t(started ? "ui.menu.chat" : "ui.menu.start"), act: async () => void (await run(["chat"])) }
          : {
              key: "1",
              label: t("ui.menu.getagent"),
              act: async () => {
                // Nothing here at all: Claude Code offered (or the page about agents); another one here: the wizard lets them pick it.
                if (agentsHere(ctx.env).length) await run(["setup"]);
                else await offerAgent(ctx, out);
                await pause(lang);
              },
            },
        {
          key: "2",
          label: t("ui.menu.run"),
          act: async () => {
            // Working alone is the agent's CLI; with only its app on this computer, strom says so.
            // No agent here yet: said, and item 1 gets one — the item stays, so the numbers never move.
            if (!ready) {
              out(t(agentsHere(ctx.env).length ? "ui.menu.noagent.chosen" : "ui.menu.noagent"));
              await pause(lang);
              return;
            }
            const who = PROFILES[ctx.settings.agent(tree.config).value];
            if (who && !findAgent(who.command, ctx.env)) {
              out(t("ui.run.needscli", { agent: who.name }));
              await pause(lang);
              return;
            }
            // What comes next, as the agent working alone takes it (a story now and then), without what others hold.
            const fresh = Tree.open(root!, ctx.env);
            const held = othersAtWork(fresh, fresh.env).tasks;
            const queue = taskQueue(fresh, { strategy: ctx.settings.strategy(fresh.config), storyTurn: true }).filter((x) => !held.has(x.id));
            const shown = queue.slice(0, RUN_LIST);
            // Another run already at work: said first, and started beside it only on a yes.
            const running = runsAtWork(root!).length;
            if (running) {
              out(t("ui.run.beside", { n: running }));
              if (!(await ctx.confirm(t("ui.run.beside.sure"), false))) return;
            }
            let args: string[] | undefined;
            if (shown.length) {
              out(t("ui.run.next"));
              for (const [k, x] of shown.entries())
                out(`  ${String(k + 1).padStart(2)}. ${truncate(humanTask(fresh, x.what, lang), 100)}${forStory(x) ? t("ui.run.story") : ""}${lacksImages(fresh, x) ? t("ui.plan.images") : ""}`);
              if (queue.length > shown.length) out(`      ${t("ui.plan.more", { n: queue.length - shown.length })}`);
            }
            out(t("ui.run.limit", { minutes: ctx.settings.number("run.minutes", fresh.config, DEFAULT_RUN_MINUTES) }));
            // With a gate of the user's (run.gate): on for as long as there is work and the gate lets it.
            const gate = gateTitle(ctx);
            const ways = [{ label: t("ui.run.queue") }, { label: t("ui.run.pick") }, ...(gate ? [{ label: t("ui.run.loop", { name: gate }) }] : [])];
            const how = shown.length ? await ctx.choose(t("ui.run.what"), ways, 0, { back: t("ui.browse.back") }) : 0;
            if (how === undefined) return;
            if (how === 2) args = ["--loop"];
            else if (how === 0) {
              let n = -1;
              while (!(Number.isInteger(n) && n >= 0 && n <= 100)) {
                if (outOfAnswers()) return;
                n = Number(await ctx.ask(t("ui.run.how"), String(Math.min(3, Math.max(1, queue.length)))));
              }
              if (n === 0) return;
              args = ["--max", String(n)];
            } else {
              while (!args) {
                if (outOfAnswers()) return;
                const a = (await ctx.ask(t("ui.run.which"))).trim();
                if (!a || a === "0") return;
                const picked = pickNumbers(a, shown.length);
                if (picked) args = ["--task", picked.map((k) => shown[k - 1]!.id).join(",")];
                else out(t("ui.run.which.bad", { n: shown.length }));
              }
            }
            // With the Strom app, the work can be watched live meanwhile (a browser here reaches the bridge); the last answer is suggested.
            const app = stromAppState(ctx.settings);
            if ((app === "yes" || app === "seen") && appBrowsers(ctx.env).length > 0) {
              const follow = await ctx.confirm(t("ui.run.follow"), ctx.settings.config.stromAppFollow !== "no");
              if (ctx.settings.config.stromAppFollow !== (follow ? "yes" : "no")) {
                ctx.settings.config.stromAppFollow = follow ? "yes" : "no";
                ctx.settings.save();
              }
              // opened when the first session starts: a run may wait for its gate first
              if (follow) {
                args.push("--follow");
                out(t("ui.run.follow.later"));
              }
            }
            out(t("ui.run.start"));
            await run(["run", ...args]);
            await pause(lang);
          },
        },
        {
          key: "3",
          label: `${t("ui.menu.waitlist")}${waiting ? ` (${waiting})` : ""}`,
          act: async () => {
            if (waiting) return waitingForYou(ctx, run, lang, root!);
            out(t("ui.waiting.none"));
            await pause(lang);
          },
        },
        {
          key: "4",
          // the Strom app named only for someone who has not said no to it
          label: archive
            ? t(stromAppState(ctx.settings) === "no" ? "ui.menu.more.archive.noapp" : "ui.menu.more.archive")
            : t(stromAppState(ctx.settings) === "no" ? "ui.menu.more" : "ui.menu.more.app"),
          act: async () => addToResearch(ctx, run, lang, root!),
        },
        {
          key: "4",
          label: t("ui.menu.browse"),
          act: async () => browse(ctx, run, lang, root!),
        },
      );
      // An archive: no conversation, no agent working alone — work with an agent switched on instead, and what came lately
      // (the numbers stay where a person knows them)
      if (archive)
        for (const [k, it] of items.entries()) {
          if (it.key === "1") items[k] = { key: "1", label: t("ui.menu.archive.agent"), act: async () => switchTo(ctx, run, lang, root!, "research") };
          else if (it.key === "2")
            items[k] = {
              key: "2",
              label: t("ui.menu.archive.recent"),
              act: async () => {
                await run(["recent"]);
                await pause(lang);
              },
            };
        }
      // Another agent on this computer, or the same one elsewhere (its app, its terminal): this conversation so (the
      // default stays).
      const current = ctx.settings.agent(tree.config).value;
      const now: Way = { agent: current, where: whereToTalk(current, ctx.settings.agentWhere(), ctx.env) };
      const others = waysHere(agentsHere(ctx.env)).filter((w) => w.agent !== now.agent || w.where !== now.where);
      other = !others.length || archive
        ? undefined
        : {
          key: "9",
          label: t("ui.menu.otheragent"),
          act: async () => {
            // Enter (and 0) stay with the agent of the research: choosing another is a step the person takes on purpose.
            const i = await chooseWay(ctx, lang, others, others.length, { back: t("ui.back.stay", { name: PROFILES[current] ? wayName(lang, now) : current }) });
            if (i !== undefined) await run(["chat", "--agent", others[i]!.agent, "--where", others[i]!.where]);
          },
        };
      // Another tree, right after the research's own items.
      items.push({ key: "6", label: known.length > 1 ? t("ui.menu.trees") : t("ui.menu.newtree"), act: async () => pickTree(ctx, run, lang) });
      // The Strom app: open the research in it (live while an agent is at work); not known yet: what it is, and whether they want it.
      const app = stromAppState(ctx.settings);
      if (app !== "no") {
        const atWork = liveWorkers(root).length > 0 || runsAtWork(root).length > 0;
        const hasApp = app !== "unknown" || Boolean(installedStromApp(ctx.env, process.platform, appUrlSetting(ctx.settings).url));
        appItem = {
          key: "7",
          label: t(!hasApp ? "ui.menu.app.new" : atWork ? "ui.menu.app.watch" : "ui.menu.app"),
          act: async () => openStromApp(ctx, run, lang, hasApp),
        };
        appTip = archive ? (!hasApp ? "ui.menu.app.tip.archive" : undefined) : !hasApp ? "ui.menu.app.tip" : atWork ? "ui.menu.app.live" : undefined;
        items.push(appItem);
      }
    } else {
      // Several trees and none chosen: pick one first.
      items.push({ key: "1", label: t("ui.menu.trees"), act: async () => pickTree(ctx, run, lang) });
    }
    // The settings of this computer (with the check); at most nine: the newer strom is taken in the settings, the line above says where.
    const settings: Item = { key: "8", label: t(ctx.archiveHere() ? "ui.menu.settings.archive" : "ui.menu.settings"), act: async () => settingsMenu(ctx, run, lang, root, newer) };
    items.push(settings);
    // Only with several agents here: last, so that it moves no other number.
    if (other) items.push(other);
    items.push({ key: "0", label: t("ui.menu.quit"), act: async () => true });

    // One quiet line on the Strom app: what it can do while the person has not said, or that the agent can be watched now.
    const numbered = items.filter((it) => it.key !== "0");
    if (appItem && appTip) out(t(appTip, { key: numbered.indexOf(appItem) + 1 }));
    if (newer) out(t("ui.menu.update.where", { version: newer, key: numbered.indexOf(settings) + 1 }));

    // Numbered in the order shown; 0 always quits.
    let n = 0;
    // Enter: the conversation — in an archive what came in lately (switching research on is a step taken on purpose)
    const i = await ctx.choose("", items.map((it) => ({ key: it.key === "0" ? "0" : String(++n), label: it.label })), root && ctx.archiveHere() ? 1 : 0);
    if (i === undefined) return;
    const quit = await guarded(ctx, lang, items[i]!.act);
    if (quit === true || quit === "quit") {
      out(t("ui.menu.bye"));
      return;
    }
  }
}

/** How many tasks of the queue the menu lists before the agent works alone. */
const RUN_LIST = 15;

/** The title of the user's gate (run.gate), when there is one to ask. */
function gateTitle(ctx: Context): string | undefined {
  const name = ctx.settings.runGate();
  const shared = ctx.settings.shared()?.value;
  if (!name || !shared) return undefined;
  try {
    const g = loadGate(shared, name);
    return g.manifest.title ?? g.name;
  } catch {
    return name; // the run says what is wrong with it
  }
}

/** "2", "1,4", "2-5", "1 3 6-8" → those numbers (1…max), in the order given, each once; undefined when anything else. */
export function pickNumbers(answer: string, max: number): number[] | undefined {
  const out: number[] = [];
  for (const part of answer.replace(/\s*[-–]\s*/g, "-").split(/[\s,;]+/).filter(Boolean)) {
    const m = /^(\d+)(?:\s*[-–]\s*(\d+))?$/.exec(part);
    if (!m) return undefined;
    const [a, b] = [Number(m[1]), Number(m[2] ?? m[1])];
    if (a < 1 || b > max || a > b) return undefined;
    for (let k = a; k <= b; k++) if (!out.includes(k)) out.push(k);
  }
  return out.length ? out : undefined;
}

/**
 * Look through the family tree: the research at a glance, what is new, what the agent does next, one person, the
 * ancestors of one, and the result files — each an ordinary command (stats, recent, plan, person card, pedigree),
 * shown in the person's language.
 */
async function browse(ctx: Context, run: Run, lang: string, root: string): Promise<void> {
  const t = (key: UIKey, values: Record<string, string | number> = {}) => ui(lang, key, values);
  const out = (line = "") => ctx.io.stdout(line + "\n");
  // A long answer waits for Enter before the menu comes again; 0 anywhere goes back without it.
  const show = async (argv: string[]) => {
    await run(argv);
    await partsPause(ctx, lang);
  };
  await subMenu(ctx, lang, () => {
    const tree = Tree.open(root, ctx.env);
    const people = tree.count("person") > 0;
    const items: Item[] = [
      ...(people
        ? [
            { key: "1", label: t("ui.browse.stats"), act: async () => show(["stats"]) },
            { key: "2", label: t("ui.browse.recent"), act: async () => show(["recent"]) },
            // what the agent does next: not in an archive (nobody works on it)
            ...(isArchive(tree) ? [] : [{ key: "2", label: t("ui.browse.plan"), act: async () => show(["plan"]) }]),
            {
              key: "3",
              label: t("ui.browse.card"),
              act: async () => {
                const p = await pickPerson(ctx, lang, root, t("ui.review.who"));
                if (p) await show(["person", "card", p.id]);
              },
            },
            {
              key: "4",
              label: t("ui.browse.pedigree"),
              act: async () => {
                const main = mainPerson(tree);
                const p = await pickPerson(ctx, lang, root, t("ui.browse.whose"), main ? displayName(tree.get<Person>(main)!) : undefined);
                if (p) await show(["pedigree", p.id]);
              },
            },
          ]
        : []),
      {
        key: "5",
        label: t("ui.browse.files"),
        act: async () => {
          const outDir = path.join(root, "output");
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
        },
      },
      ...(stromAppState(ctx.settings) === "no" ? [] : [{ key: "6", label: t("ui.menu.app"), act: async () => openStromApp(ctx, run, lang, stromAppState(ctx.settings) !== "unknown") }]),
    ];
    return { items };
  });
}

/**
 * The Strom app: not asked about yet — what it is, and whether they want it; wanted but not installed here — installing
 * it from the browser (an app of its own, PWA) is offered first, else it opens in the browser; installed — it opens.
 */
async function openStromApp(ctx: Context, run: Run, lang: string, said: boolean): Promise<void> {
  const t = (key: UIKey) => ui(lang, key);
  if (!said) {
    const answer = await askStromApp(ctx, lang);
    if (answer === "install" && (await ctx.confirm(t("ui.app.open.now"), true))) await run(["app"]);
    return;
  }
  if (!installedStromApp(ctx.env, process.platform, appUrlSetting(ctx.settings).url) && (await ctx.confirm(t("ui.app.notinstalled"), true))) {
    await run(["app", "install"]);
    return;
  }
  await run(["app"]);
}

/** Choose another family tree, or create a new one (and start its research). The one worked on now is suggested; 0 stays with it. */
async function pickTree(ctx: Context, run: Run, lang: string): Promise<void> {
  const known = ctx.knownTrees();
  let here: string | undefined;
  try {
    here = ctx.locateTree();
  } catch {
    here = undefined;
  }
  const at = known.findIndex((k) => k.root === here);
  // a research a newer strom wrote: listed, said to be locked (by whom)
  const lockedBy = (root: string) => {
    const by = newerTree(root, ctx.env)?.params?.by;
    return by ? `  – ${ui(lang, "ui.trees.locked", { by })}` : "";
  };
  const options = [...known.map((k) => ({ label: `${k.name}  (${ctx.display(k.root)})${lockedBy(k.root)}` })), { label: ui(lang, "ui.trees.new") }];
  // handing a research over: this one packed, one someone sent unpacked
  const packAt = at >= 0 ? options.push({ label: ui(lang, "ui.trees.pack", { name: known[at]!.name }) }) - 1 : -1;
  const unpackAt = options.push({ label: ui(lang, "ui.trees.unpack") }) - 1;
  const removeAt = known.length ? options.push({ label: ui(lang, "ui.trees.remove") }) - 1 : -1;
  const back = at >= 0 ? { back: ui(lang, "ui.back.stay", { name: known[at]!.name }) } : {};
  const i = await ctx.choose(ui(lang, "ui.trees.pick"), options, Math.max(0, at), back);
  if (i === undefined || i === at) return;
  if (i < known.length) {
    await run(["trees", "use", known[i]!.root], true);
    return;
  }
  if (i === packAt) {
    const tree = Tree.open(known[at]!.root, ctx.env);
    const shared = ctx.settings.shared()!.value;
    const size = (all: boolean) => (packPlan(tree, shared, all).media.reduce((s, m) => s + m.size, 0) / 1e6).toFixed(0);
    const which = await ctx.choose(ui(lang, "ui.pack.which"), [{ label: ui(lang, "ui.pack.opt.records", { mb: size(false) }) }, { label: ui(lang, "ui.pack.opt.all", { mb: size(true) }) }], 0, { back: ui(lang, "ui.browse.back") });
    if (which === undefined) return;
    await run(["pack", "--tree", tree.root, ...(which === 1 ? ["--all-images"] : [])]);
    await partsPause(ctx, lang);
    return;
  }
  if (i === removeAt) {
    const which = await ctx.choose(ui(lang, "ui.remove.which"), known.map((k) => ({ label: `${k.name}  (${ctx.display(k.root)})` })), known.length, { back: ui(lang, "ui.browse.back") }); // Enter goes back
    if (which === undefined) return;
    await run(["trees", "remove", known[which]!.root]);
    await partsPause(ctx, lang);
    return;
  }
  if (i === unpackAt) {
    const answer = (await ctx.ask(ui(lang, "ui.unpack.file"))).trim();
    if (!answer || answer === "0") return;
    const resolve = (p: string) => path.resolve(ctx.cwd, expandHome(p, ctx.env));
    const dropped = droppedPaths(answer).map(resolve);
    const file = dropped.length === 1 && fs.existsSync(dropped[0]!) ? dropped[0]! : resolve(answer);
    await run(["unpack", file]);
    await partsPause(ctx, lang);
    return;
  }
  const name = (await ctx.ask(ui(lang, "ui.tree.name.new"), ui(lang, "ui.tree.default"))).trim();
  if (name === "0") return;
  const made = await createTree(ctx, run, lang, name);
  if (!made) return;
  await run(["trees", "use", made], true);
  if (agentReady(ctx, Tree.open(made, ctx.env).config)) await run(["chat"]);
}
