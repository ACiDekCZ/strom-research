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
import { isAgent } from "../core/which.ts";
import { offerAdopt } from "./seal.ts";
import { mb, setTidyAsked, tidyAskAgain, tidyAsked, tidyOn, tidyPlan, TIDY_SAID } from "../core/tidy.ts";
import { calibrationLabel, calibrationOffer } from "../core/viewsizes.ts";

/** A line as a sentence: its first letter capital (a catalog's text that also stands inside a line). */
const sentence = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
import { newerTree, Tree, VERSION } from "../core/tree.ts";
import { BACKUP_SAID_DAYS, lastBackup } from "../core/backup.ts";
import { lastBackupLine } from "./backups.ts";
import { diskVersion, installation } from "../core/self.ts";
import { liveHolder } from "../core/lock.ts";
import { liveRunning, reviveLive } from "../core/live.ts";
import { revivePhone } from "../core/phone.ts";
import { newerVersion } from "../core/update.ts";
import { taskQueue } from "../commands/tasks.ts";
import { humanTask } from "../commands/browse.ts";
import { loadGate } from "../core/gate.ts";
import { lacksImages } from "../core/queue.ts";
import { historyOn } from "../core/pastevents.ts";
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
import { expandHome, isolated, ownCommand } from "../core/paths.ts";
import { pathOf, startAgain } from "../core/userpath.ts";
import { offerAgent } from "./fixes.ts";
import { addToResearch } from "./menu-research.ts";
import { waitingForYou, waitingHere } from "./menu-waiting.ts";
import { waitingLine } from "../core/waiting.ts";
import { permissionWaitingLines } from "../core/archiveasks.ts";
import { offerHistory, settingsMenu } from "./menu-settings.ts";
import { mainPerson } from "../core/kin.ts";
import { findAgent } from "../core/which.ts";
import { agentsHere, waysHere, whereToTalk, type Way } from "../core/apps.ts";
import { chooseWay, wayName } from "./ways.ts";
import { PROFILES } from "../agents/profiles.ts";
import { forStory } from "../core/stories.ts";
import { isArchive } from "../core/mode.ts";
import { actsAsArchive } from "../core/state.ts";
import { switchTo } from "./menu-mode.ts";
import { appMarkFromInstall, linkScheme } from "../core/links.ts";
import { fixEnv, pendingCount, pendingFixes, refreshFixesSoon } from "../commands/fixchecks.ts";
import { restartTiming, timed, timedAsync, timingOn } from "../core/timing.ts";
import { researchStamp } from "../core/stamp.ts";
import { timingSaid } from "./timing.ts";


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
  // the research opened, kept between the menu's rounds while it stays as it was (researchStamp: its commit, its
  // strom.json — every change of its data is committed): its records not read again at each return to the menu
  // (found on a Mac, 781 people: the menu took a while each time; on Windows, on OneDrive, minutes)
  let held: { root: string; stamp: string; tree: Tree } | undefined;
  // …and what it keeps beside it (the line of what can go), while nothing ran from the menu since (strom tidy among them)
  let ran = 0;
  const runHere = run;
  run = (argv, quiet) => {
    ran++;
    return runHere(argv, quiet);
  };
  let heldDisk: { tree: Tree; ran: number; plan: ReturnType<typeof tidyPlan> } | undefined;
  let timingShown = false;
  for (;;) {
    // (a return measured from here: not the time spent in what was chosen)
    if (timingShown) restartTiming();
    reload();
    const lang = ctx.uiLang();
    const t = (key: UIKey, values: Record<string, string | number> = {}) => ui(lang, key, values);
    // strom updated while this menu is open (the installer, npm, another window): said once — the menu is never ended
    const disk = diskVersion(ctx.env);
    if (!toldNewer && disk && disk.version !== VERSION) {
      toldNewer = true;
      ctx.io.stdout(`\n${t("ui.update.restart", { shortcut: shortcutName(lang) })}\n`);
    }
    const known = timed("menu.trees", () => ctx.knownTrees());
    let root: string | undefined;
    try {
      root = timed("menu.trees", () => ctx.locateTree());
    } catch {
      root = undefined;
    }

    // seen here before, gone from their folders since (moved?): said — and no new tree asked for in their place
    const missing = ctx.missingTrees();
    // No family tree yet: name it, create it, and start the research.
    if (!root && known.length === 0 && missing.length === 0) {
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
    for (const m of missing) out(t("ui.trees.missing", { name: m.name, path: ctx.display(m.root) }));
    const newer = await timedAsync("menu.update", () => newerVersion(ctx.settings, ctx.env));
    // a research a newer strom wrote (a beta's): never opened here — why and the way on, then the menu without it
    const locked = root ? newerTree(root, ctx.env) : undefined;
    if (locked) {
      out(t(`ui.error.${locked.code}` as UIKey, locked.params ?? {}));
      for (const line of t(`ui.error.${locked.code}.hint` as UIKey, locked.params ?? {}).split("\n")) out(`→ ${line}`);
      root = undefined;
    }
    if (root) {
      const tree = timed("menu.open", () => {
        const stamp = researchStamp(root!);
        if (held?.root !== root || held.stamp !== stamp) held = { root: root!, stamp, tree: Tree.open(root!, ctx.env) };
        return held.tree;
      });
      // the bridge the Strom app follows, ended without a word (killed, the computer gone down): back with the menu —
      // an archive has no sessions to bring it back (found on Mac: the app "not running" until strom live start)
      if (!revived.has(root)) {
        revived.add(root);
        try {
          timed("menu.live", () => {
            reviveLive(root!, ctx.env);
            revivePhone(ctx.env);
          });
        } catch {
          // its next start brings it back
        }
      }
      // what waits for the person: the same list What waits shows (each thing once — a task that waits for an archive's
      // decision is one of its question's)
      const waits = timed("menu.waiting", () => waitingHere(ctx, tree));
      const waiting = waits.length;
      const started = timed("menu.records", () => tree.list<Research>("research").length > 0);
      out(t("ui.menu.tree", { name: tree.config.name, persons: timed("menu.records", () => tree.countLive("person")) }));
      // No agent yet (none installed, or not the one chosen): the research waits for it — kept as an archive meanwhile,
      // item 1 gets one, item 2 keeps it an archive for good (nothing of the agent's work offered).
      const ready = agentReady(ctx, tree.config);
      // An archive: the data come from the Strom app, no agent — said instead
      const archive = isArchive(tree);
      const waitAgent = !archive && !ready;
      const current = ctx.settings.agent(tree.config).value;
      if (archive) out(t("ui.menu.archive"));
      else if (waitAgent) out(agentsHere(ctx.env).length ? t("ui.menu.waitagent.chosen", { agent: PROFILES[current]?.name ?? current }) : t("ui.menu.waitagent"));
      // sealed on another computer (its folder brought here, strom's settings gone): read, not written — taken over by
      // the person, offered once at a terminal (as strom seal adopt: every record checked, their yes)
      if (!tree.key) {
        out(t("ui.menu.seal"));
        if (offerAdopt(ctx, root, !isAgent(ctx.env))) {
          out();
          await run(["seal", "adopt", "--tree", root]);
          out();
        }
      }
      // what of it the Strom app does not show (only here in the terminal) said, so its number and the app's agree
      if (waiting) out(waitingLine(lang, waits));
      // an archive's images wait for the person's decision: one line, only until it is answered
      // (since when, and the tasks that stand on it, once it waits long or holds up much)
      for (const line of timed("menu.permissions", () => permissionWaitingLines(tree, lang))) out(line);
      // much kept beside the research that can go (an older strom never tidied it): said, freed in the settings
      const disk = timed("menu.tidy", () => {
        if (heldDisk?.tree !== tree || heldDisk.ran !== ran) heldDisk = { tree, ran, plan: tidyPlan(tree) };
        return heldDisk.plan;
      });
      if (disk.frees >= TIDY_SAID) {
        // never tidied (an older strom gathered it): its first tidy offered once, shown and asked as strom tidy asks
        // (Enter says no) — nothing but what strom makes again goes unasked; then kept in order by itself. Said no and
        // grown far beyond the research since (tidyAskAgain): offered once more, never again. Nobody to ask (no
        // terminal, STROM_NONINTERACTIVE): only said, the offer kept for the person
        const again = tidyAskAgain(root, disk);
        if (!tidyOn(root) && (!tidyAsked(root) || again) && !isAgent(ctx.env) && ctx.interactive) {
          setTidyAsked(root, again);
          out(again ? t("ui.tidy.again", { strom: mb(disk.size.strom, lang), research: mb(disk.size.research, lang), size: mb(disk.frees, lang) }) : t("ui.tidy.first", { size: mb(disk.frees, lang) }));
          out();
          await run(["tidy"]);
          out();
        } else out(t("ui.tidy.hint", { strom: mb(disk.size.strom, lang), size: mb(disk.frees, lang) }));
      }
      // a fix of strom's left something behind here that waits for the person's decision: one line (the settings)
      // (as kept while nothing it is found by changed: else looked through in the background, said at the next look —
      // the menu never waits for it; found on Windows, a research on OneDrive: minutes before the menu showed)
      const fix = archive
        ? undefined
        : timed("menu.fixes", () => {
            const env = fixEnv(ctx, tree);
            // (a backup not made: nothing written to the research, nothing looked through either)
            return (pendingFixes(tree, env, { kept: true }) ?? (ctx.backupFailed ? undefined : refreshFixesSoon(tree, env, ctx.env)))?.[0];
          });
      // a fix of strom's said as one; another model reading now, as readings to read again
      if (fix) out(t(fix.check.id === "new-model" ? "ui.fixes.hint.readings" : "ui.fixes.hint", { name: t(`ui.fixes.${fix.check.id}.name` as UIKey), count: pendingCount(fix) }));
      // the scan views tuned before, but for another agent or model: offered again (the settings), never run unasked
      const offer = !archive && ready ? timed("menu.views", () => calibrationOffer(ctx.settings, ctx.settings.agent(tree.config).value, tree.config, tree.root)) : undefined;
      if (offer) out(sentence(t("ui.views.offer", { before: calibrationLabel(offer.before[0]!, t("ui.settings.model.own")), now: calibrationLabel(offer.now, t("ui.settings.model.own")) })));
      const runs = timed("menu.runs", () => runsAtWork(root!).length);
      if (runs) out(t(runs > 1 ? "ui.menu.working.more" : "ui.menu.working", { n: runs }));
      // the history of the places, never asked about here (set up before strom had it): asked once — Enter "not now"
      if (!archive && ready) await offerHistory(ctx, run, lang);
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
            // The tasks of history alone, in their order whatever its pace (strom run --history): only while it is on.
            const history = historyOn(fresh, ctx.settings) ? taskQueue(fresh, { strategy: ctx.settings.strategy(fresh.config), history: "only" }).filter((x) => !held.has(x.id)) : [];
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
            const ways = [{ label: t("ui.run.queue") }, { label: t("ui.run.pick") }, ...(gate ? [{ label: t("ui.run.loop", { name: gate }) }] : []), ...(history.length ? [{ label: t("ui.run.history", { n: history.length }) }] : [])];
            const how = shown.length || history.length ? await ctx.choose(t("ui.run.what"), ways, 0, { back: t("ui.browse.back") }) : 0;
            if (how === undefined) return;
            if (history.length && how === ways.length - 1) {
              let n = -1;
              while (!(Number.isInteger(n) && n >= 0 && n <= 100)) {
                if (outOfAnswers()) return;
                n = Number(await ctx.ask(t("ui.run.history.how"), String(Math.min(3, history.length))));
              }
              if (n === 0) return;
              args = ["--history", "--max", String(n)];
            } else if (how === 2) args = ["--loop"];
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
          // with nobody in it yet, material is all an archive takes in (the app's edits come with its people)
          label: archive || waitAgent
            ? t(!tree.count("person") ? "ui.menu.more.archive.empty" : stromAppState(ctx.settings) === "no" ? "ui.menu.more.archive.noapp" : "ui.menu.more.archive")
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
      // (the numbers stay where a person knows them). Waiting for its agent: item 1 gets one, item 2 keeps it an archive.
      if (waitAgent)
        for (const [k, it] of items.entries()) {
          if (it.key === "2") items[k] = { key: "2", label: t("ui.menu.keeparchive"), act: async () => switchTo(ctx, run, lang, root!, "archive") };
        }
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
      const now: Way = { agent: current, where: whereToTalk(current, ctx.settings.agentWhere(), ctx.env) };
      const others = waysHere(agentsHere(ctx.env)).filter((w) => w.agent !== now.agent || w.where !== now.where);
      other = !others.length || archive || waitAgent
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
          // followed live only where an agent works (an archive, a research waiting for its agent: looked through)
          label: t(!hasApp ? (archive || waitAgent ? "ui.menu.app.new.archive" : "ui.menu.app.new") : atWork ? "ui.menu.app.watch" : "ui.menu.app"),
          act: async () => openStromApp(ctx, run, lang, hasApp),
        };
        appTip = archive || waitAgent ? (!hasApp ? "ui.menu.app.tip.archive" : undefined) : !hasApp ? "ui.menu.app.tip" : atWork ? "ui.menu.app.live" : undefined;
        items.push(appItem);
      }
    } else {
      // Several trees and none chosen: pick one first.
      items.push({ key: "1", label: t("ui.menu.trees"), act: async () => pickTree(ctx, run, lang) });
    }
    // The settings of this computer (with maintenance); at most nine: the newer strom is taken in the settings' maintenance, the line above says where.
    const settings: Item = { key: "8", label: t(ctx.actsAsArchive() ? "ui.menu.settings.archive" : "ui.menu.settings"), act: async () => settingsMenu(ctx, run, lang, root, newer) };
    items.push(settings);
    // Only with several agents here: last, so that it moves no other number.
    if (other) items.push(other);
    items.push({ key: "0", label: t("ui.menu.quit"), act: async () => true });

    // One quiet line on the Strom app: what it can do while the person has not said, or that the agent can be watched now.
    const numbered = items.filter((it) => it.key !== "0");
    if (appItem && appTip) out(t(appTip, { key: numbered.indexOf(appItem) + 1 }));
    if (newer) out(t("ui.menu.update.where", { version: newer, key: numbered.indexOf(settings) + 1 }));

    // measured (strom --timing): the line to send, each time the menu is shown (what its return took too)
    if (timingOn()) {
      out(timingSaid(lang));
      timingShown = true;
    }

    // Numbered in the order shown; 0 always quits.
    let n = 0;
    // Enter: the conversation — in an archive what came in lately (switching research on is a step taken on purpose)
    const i = await ctx.choose("", items.map((it) => ({ key: it.key === "0" ? "0" : String(++n), label: it.label })), root && ctx.archiveHere() ? 1 : 0);
    if (i === undefined) return;
    const quit = await guarded(ctx, lang, items[i]!.act);
    if (quit === true || quit === "quit") {
      out(byeLine(ctx, t));
      // the Strom app's bridge goes on in the background after the menu: said only while it runs (nothing started to ask)
      if (root && liveRunning(root)) out(t("ui.menu.bye.live"));
      return;
    }
  }
}

/**
 * The goodbye: how to start strom again in this terminal (core/userpath.ts startAgain) — its name where the terminal
 * knows it, else that a new window does and the full path for this one.
 */
function byeLine(ctx: Context, t: (key: UIKey, values?: Record<string, string | number>) => string): string {
  const inst = installation();
  const how = startAgain({
    platform: process.platform,
    given: ctx.givenPath ?? pathOf(ctx.env),
    installer: ctx.env.STROM_INSTALLER === "1",
    launchers: inst.kind === "installed" ? (inst.launchers ?? []) : [],
    command: ownCommand(ctx.env) ?? "strom",
    isolated: isolated(ctx.env) && !ownCommand(ctx.env),
    found: (file) => {
      try {
        return fs.statSync(file).isFile();
      } catch {
        return false;
      }
    },
  });
  return how.kind === "name" ? t("ui.menu.bye") : t(how.kind === "new" ? "ui.menu.bye.new" : "ui.menu.bye.path", { path: how.path });
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
            ...(actsAsArchive(tree) ? [] : [{ key: "2", label: t("ui.browse.plan"), act: async () => show(["plan"]) }]),
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

/** Choose another family tree, or create a new one (and start its research). The one worked on now is suggested; 0 (and, with none chosen yet, Enter) goes back. */
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
  // one seen here before gone from its folder (moved?): its new folder given, remembered there (strom trees use)
  const movedAt = ctx.missingTrees().length ? options.push({ label: ui(lang, "ui.trees.moved") }) - 1 : -1;
  // 0 always goes back: stays with the one worked on, or (none chosen yet) back to the menu — Enter too (found on
  // Windows: one who came here by Enter had to choose a tree)
  const back = { back: at >= 0 ? ui(lang, "ui.back.stay", { name: known[at]!.name }) : ui(lang, "ui.browse.back") };
  const i = await ctx.choose(ui(lang, "ui.trees.pick"), options, at >= 0 ? at : options.length, back);
  if (i === undefined || i === at) return;
  if (i < known.length) {
    await run(["trees", "use", known[i]!.root], true);
    return;
  }
  if (i === packAt) {
    const tree = Tree.open(known[at]!.root, ctx.env);
    const shared = ctx.settings.shared()!.value;
    const size = (all: boolean) => mb(packPlan(tree, shared, all).media.reduce((s, m) => s + m.size, 0), lang);
    const which = await ctx.choose(ui(lang, "ui.pack.which"), [{ label: ui(lang, "ui.pack.opt.records", { size: size(false) }) }, { label: ui(lang, "ui.pack.opt.all", { size: size(true) }) }], 0, { back: ui(lang, "ui.browse.back") });
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
  if (i === movedAt) {
    const answer = (await ctx.ask(ui(lang, "ui.trees.moved.ask"))).trim();
    if (!answer || answer === "0") return;
    const dropped = droppedPaths(answer).map((p) => path.resolve(ctx.cwd, expandHome(p, ctx.env)));
    await run(["trees", "use", dropped.length === 1 ? dropped[0]! : path.resolve(ctx.cwd, expandHome(answer, ctx.env))]);
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
