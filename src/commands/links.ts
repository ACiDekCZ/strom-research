// strom-research:// links from the Strom app (core/links.ts): strom link open
// is what the system runs for one; strom link on|off|status registers the
// scheme for this user, takes it off, says where it leads.

import fs from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { register, type Result } from "../cli/registry.ts";
import { Context } from "../cli/context.ts";
import { lines } from "../cli/format.ts";
import { ui, type UIKey } from "../cli/ui.ts";
import { readJsonIfExists } from "../core/json.ts";
import type { AppClient, Conflict, House, Person, Place, Research, Source, Task, TreeConfig } from "../core/model.ts";
import { Tree } from "../core/tree.ts";
import { LinkError, linkHandlerState, linkScheme, linkStateText, linkText, parseLink, registerLinks, titleLinkWindow, unregisterLinks, type Link, type TakenLink } from "../core/links.ts";
import { noteHandoff } from "../core/handoffs.ts";
import { displayName, lifespan } from "../core/people.ts";
import { PROFILES } from "../agents/profiles.ts";
import { whereToTalk } from "../core/apps.ts";
import { pause } from "../cli/menu-parts.ts";
import type { RunIn } from "../cli/menu-links.ts";
import { fullExcerpt } from "../core/excerpt.ts";
import { knownOriginal } from "../core/originals.ts";
import { openForUser } from "../core/open.ts";
import { openInNewTerminal } from "../core/shortcut.ts";
import { systemNotice } from "../core/dialog.ts";
import { configDir, noLinks, type Env } from "../core/paths.ts";
import { liveBook } from "../core/books.ts";
import { inboxFolderFor } from "../core/media.ts";
import { startLive } from "../core/live.ts";
import { stateOf } from "../core/state.ts";
import { isEditConflict } from "../core/conflicts.ts";
import { fixCheck, quietCheck } from "./fixchecks.ts";
import { DevicePreview, fromDevice, fromDeviceEnv, newYes, sendYes, takeYes, yesHolds } from "../core/deviceagent.ts";
import { forPhone } from "../core/phone-watch.ts";
import { isAgent } from "../core/which.ts";
import { StromError, UsageError } from "../core/errors.ts";

/** The researches here with this id — a copy of a research folder has its id too; the current one first. */
function researchesWithId(ctx: Context, id: string): { name: string; root: string }[] {
  const current = ctx.settings.config.currentTree;
  return ctx
    .knownTrees()
    .filter((k) => readJsonIfExists<TreeConfig>(path.join(k.root, "strom.json"))?.id?.toLowerCase() === id)
    .sort((a, b) => Number(b.root === current) - Number(a.root === current));
}

/**
 * What a link could not do, said where the person is: the terminal, else a window (a link opens strom with none).
 * The result carries it too.
 */
async function say(ctx: Context, key: UIKey, values: Record<string, string | number> = {}, data: Record<string, unknown> = {}) {
  const lang = ctx.uiLang();
  const text = ui(lang, key, values);
  if (!ctx.io.tty) systemNotice(ui(lang, "ui.dialog.title"), text, ui(lang, "ui.link.ok"), ctx.env);
  return { text, data: { done: false, ...data } };
}

/** The person's answer about links, kept: the question when the app opens is not asked again. */
function keepAnswer(ctx: Context, answer: "yes" | "no"): void {
  ctx.settings.reload();
  ctx.settings.config.links = answer;
  ctx.settings.save();
}

/** The window a link opens: in the terminal the person chose (this computer's setting, never the link's), said in their language. */
function windowOf(ctx: Context): { terminal?: string; lang: string } {
  const terminal = ctx.settings.terminal();
  return { ...(terminal ? { terminal } : {}), lang: ctx.uiLang() };
}

/**
 * A run of one line from the link work (spec 126): its window named after the line ("Strom · <tree> · <line> (G…)"),
 * and the guard against a second window within a moment only for the same line.
 */
function lineWindow(ctx: Context, link: TakenLink, root: string): { title?: string; key?: string } {
  if (link.action !== "work" || !link.research) return {};
  const tree = Tree.open(root, ctx.env);
  const line = tree.get<Research>(link.research);
  return { title: ["Strom", tree.config.name, line?.type === "research" ? `${line.name} (${line.id})` : link.research].join(" · "), key: link.research };
}

/**
 * The terminal a link opens for the research at `root`, as a link of the app opened without one does it — and a link a
 * device asked for (spec 094 K3.15: its own environment, the device named): one code for both.
 */
function linkTerminal(ctx: Context, link: Exclude<TakenLink, { action: "menu" }>, root: string, env: Env = ctx.env): boolean | "recent" | "fallback" {
  return openInNewTerminal(["link", "open", linkText(link, linkScheme(ctx.env))], root, env, process.platform, { ...windowOf(ctx), ...lineWindow(ctx, link, root) });
}

/** The chosen terminal not here: the window opened in the system's (said in it). */
function fellBack(opened: boolean | "recent" | "fallback"): { terminal?: "fallback" } {
  return opened === "fallback" ? { terminal: "fallback" } : {};
}

/** macOS: the terminal program this runs in, by its mark (TERM_PROGRAM). */
const TERMINALS: Record<string, string> = { Apple_Terminal: "Terminal", "iTerm.app": "iTerm", WezTerm: "WezTerm", ghostty: "Ghostty" };

/**
 * The terminal a link opened comes in front of the Strom app when the app has answered (the tree came, or
 * nothing did): the person sees what came of it. macOS; elsewhere the window stays where it is.
 */
function bringForward(env: NodeJS.ProcessEnv | Record<string, string | undefined>): void {
  const app = TERMINALS[env.TERM_PROGRAM ?? ""];
  if (process.platform !== "darwin" || !app || env.STROM_NO_OPEN === "1") return;
  spawnSync("osascript", ["-e", `tell application "${app}" to activate`], { stdio: "ignore", timeout: 5000 });
}

/** strom itself in a research's folder (none: where strom is), as the menu runs it — quiet: its output not shown; said: handed over. */
function runnerOf(ctx: Context): RunIn {
  return async (root) => {
    const { main } = await import("../cli/main.ts");
    return (argv, quiet, said) =>
      // a device's preview (spec 094 K3.15): nothing is run — a command of its own asks in the terminal itself
      ctx.devicePreview ? Promise.reject(new DevicePreview({ kind: "computer", why: "question" })) : main(argv, said ? { ...ctx.io, stdout: said } : quiet ? { ...ctx.io, stdout: () => undefined } : ctx.io, ctx.env, root ?? ctx.cwd);
  };
}

/** A person of the research a link names: the one they were merged into; one taken out is none. */
function personOf(root: string, ctx: Context, id: string): Person | undefined {
  const tree = Tree.open(root, ctx.env);
  let p = tree.get<Person>(id);
  if (p?.mergedInto) p = tree.get<Person>(p.mergedInto);
  return p && !p.retracted ? p : undefined;
}

/** A person as the user reads them, with the ID to name them by: "Jan Novák (*1905) [P0012]". */
function who(p: Person): string {
  const span = lifespan(p);
  return `${displayName(p)}${span ? ` (${span})` : ""} [${p.id}]`;
}

/** The conversation's first message about one person: only who (from the research's own record), what to ask is the person's. */
function aboutPerson(lang: string, p: Person): string {
  return ui(lang, "ui.link.chat.say", { person: who(p) });
}

/** The conversation's first message about one direction: its name and ID, from the research's own record. */
function aboutDirection(lang: string, r: Research): string {
  return ui(lang, "ui.link.chat.research.say", { name: r.name, id: r.id });
}

/** The conversation's first message about a conflict: its ID and title from the research itself. */
function aboutConflict(root: string, ctx: Context, id: string): string | undefined {
  const tree = Tree.open(root, ctx.env);
  const c = tree.get<Conflict>(id);
  return c && c.type === "conflict" && c.state === "open" ? ui(tree.lang, "ui.link.conflict.say", { id: c.id, title: c.title }) : undefined;
}

type TreeLink = Exclude<Link, { action: "menu" | "excerpt" | "media" | "new" | "book" }>;

/**
 * What a link asks of an agent — a conversation, tasks written for it — refused where nobody researches (an archive, a
 * research waiting for its agent): one sentence, before anything is asked or written (no cost, no tasks put aside at
 * once). An archive's says where research is switched on, nothing of an agent.
 */
function refusedHere(ctx: Context, root: string, link: TreeLink): { key: UIKey; values: Record<string, string>; state: string } | undefined {
  // an experiment turned on where nothing is looked for: said so, nothing of an agent (turned off: anywhere)
  if (link.action === "experiment" || link.action === "history-kinds" || link.action === "history-align") {
    if (link.action === "experiment" && link.do !== "on") return undefined;
    const state = stateOf(Tree.open(root, ctx.env));
    return state === "research" ? undefined : { key: state === "archive" ? "ui.link.experiment.archive" : "ui.link.experiment.waiting", values: {}, state };
  }
  const forAgent =
    link.action === "chat" ||
    link.action === "review" ||
    link.action === "research" ||
    link.action === "history" ||
    link.action === "places" ||
    link.action === "work" ||
    // a research of a house taken over by the agent (spec 030): nobody researches in an archive
    link.action === "house" ||
    (link.action === "conflict" && link.do === "agent") ||
    // the agent deciding the hypotheses: nobody researches in an archive (back to the person: anywhere)
    (link.action === "hypotheses" && "decide" in link && link.decide === "agent") ||
    (link.action === "task" && link.do === "chat") ||
    (link.action === "fixes" && link.id !== undefined && !quietCheck(fixCheck(link.id) ?? { remedy: "read-again" }));
  if (!forAgent) return undefined;
  const tree = Tree.open(root, ctx.env);
  const state = stateOf(tree);
  if (state === "research") return undefined;
  if (state === "archive") return { key: "ui.archive.refuse", values: {}, state };
  const agent = ctx.settings.agent(tree.config).value;
  return { key: "ui.waiting.refuse", values: { agent: PROFILES[agent]?.name ?? agent }, state };
}

/** What a link asks, in this terminal: which copy of the research (`at`: that one), then as the menu does it. */
async function inTerminal(ctx: Context, link: TreeLink, at?: string) {
  const lang = ctx.uiLang();
  const copies = at ? [{ name: "", root: at }] : researchesWithId(ctx, link.tree);
  if (!copies.length) return say(ctx, "ui.link.notree", {}, { tree: link.tree });
  let root = copies[0]!.root;
  if (copies.length > 1) {
    const i = await ctx.choose(ui(lang, link.action === "send" ? "ui.link.which" : "ui.link.which.one"), copies.map((c) => ({ label: `${c.name} (${ctx.display(c.root)})` })), 0, { back: ui(lang, "ui.browse.back") });
    if (i === undefined) return { text: "", data: { done: false } };
    root = copies[i]!.root;
  }
  const run = await runnerOf(ctx)(root);
  const tree = Tree.open(root, ctx.env);
  const treeLang = tree.lang;
  const end = async (done: boolean) => {
    await pause(ctx, treeLang, "ui.enter.close");
    return { text: "", data: { done, action: link.action, tree: root } };
  };
  const said = async (key: UIKey, values: Record<string, string> = {}) => {
    ctx.io.stdout(ui(treeLang, key, values) + "\n");
    return end(false);
  };
  const refused = refusedHere(ctx, root, link);
  if (refused) {
    ctx.io.stdout(ui(treeLang, refused.key, refused.values) + "\n");
    await pause(ctx, treeLang, "ui.enter.close");
    return { text: "", data: { done: false, action: link.action, tree: root, refused: refused.state } };
  }
  const agent = PROFILES[ctx.settings.agent(tree.config).value]?.name ?? ctx.settings.agent(tree.config).value;
  switch (link.action) {
    case "send": {
      const { syncFromApp } = await import("../cli/menu-research.ts");
      await syncFromApp(ctx, run, treeLang, root, "ui.enter.close", () => bringForward(ctx.env));
      return { text: "", data: { done: true, action: link.action, tree: root } };
    }
    // the research's menu, as `strom` in its folder; the research into the app's window, as strom app; strom's own
    // commands, which ask themselves
    case "open":
    case "app":
    case "live":
      // only the bridge, no window of the app (the app's switch "research on": it follows the address it has)
      if (link.action === "live" && link.do === "start") return end(startBridge(ctx, root));
      // the research opened from the Strom app: its bridge up, whatever ended it (idle, stopped, a crash) — at its last
      // address, so the app that asked goes on by itself ("Research is not running" with the menu open, T25)
      if (link.action === "open") {
        try {
          startLive(root, ctx.env, { current: true, why: "the research opened from the Strom app (strom-research://open)" });
        } catch {
          // the menu goes on; strom live start says why
        }
      }
      return { text: "", data: { done: (await run(link.action === "open" ? [] : link.action === "live" ? ["app", "--live"] : ["app"])) === 0, action: link.action, tree: root } };
    case "update":
    case "setup":
      return end((await run([link.action])) === 0);
    // sealed on another computer: taken over here as strom seal adopt does it — its records checked, the person's yes
    case "seal":
      return end((await run(["seal", "adopt"])) === 0);
    case "sessions": {
      const { sessionsView } = await import("../cli/menu-links.ts");
      sessionsView(ctx, treeLang, root);
      return end(true);
    }
    case "task": {
      // the person's check of a site (and a wake of one, which only their answer does): its question in the terminal; so
      // the decision on a new wording proposed for a transcript they read (core/proposal.ts), whatever the link asks
      if (Tree.open(root, ctx.env).get<Task>(link.task)?.proposal || link.do === "check" || (link.do === "wake" && Tree.open(root, ctx.env).get<Task>(link.task)?.awaitsCheck)) {
        const { waitingTask } = await import("../cli/menu-waiting.ts");
        if (!(await waitingTask(ctx, run, treeLang, root, link.task))) return said("ui.link.notask");
        return end(true);
      }
      if (link.do === "chat" || link.do === "note" || link.do === "folder" || link.do === "sent" || link.do === "file") {
        const { waitingDo } = await import("../cli/menu-links.ts");
        const done = await waitingDo(ctx, run, treeLang, root, link.task, link.do, agent);
        // the conversation is the agent's (a terminal of its own, or its desktop app): nothing to wait for here
        return link.do === "chat" && done ? { text: "", data: { done, action: link.action, tree: root } } : end(done);
      }
      if (link.do) {
        const { taskDo } = await import("../cli/menu-links.ts");
        return end(await taskDo(ctx, run, treeLang, root, link.task, link.do));
      }
      // a task in the queue (the one a reading of a source again left, say): shown, then go through it now, ahead, or left
      if (Tree.open(root, ctx.env).get<Task>(link.task)?.state === "open") {
        const { openTask } = await import("../cli/menu-links.ts");
        return end(await openTask(ctx, run, treeLang, root, link.task, agent));
      }
      const { waitingTask } = await import("../cli/menu-waiting.ts");
      if (!(await waitingTask(ctx, run, treeLang, root, link.task))) return said("ui.link.notask");
      return end(true);
    }
    case "conflict": {
      if (link.do === "decide") {
        const { decideConflict } = await import("../cli/menu-links.ts");
        return end(await decideConflict(ctx, run, treeLang, root, link.id, link.take));
      }
      // left to the agent: it costs — said and asked first, then the conversation about it
      const say = aboutConflict(root, ctx, link.id);
      if (!say) return said("ui.link.conflict.none", { id: link.id });
      const { asksToStart } = await import("../cli/menu-links.ts");
      if (!(await asksToStart(ctx, treeLang, root, ui(treeLang, "ui.link.what.conflict.agent", { agent, title: tree.get<Conflict>(link.id)!.title }), ui(treeLang, "ui.link.cost")))) return end(false);
      // the user's own edit: the agent may decide it only once the user left it so — written first, by the person
      if (isEditConflict(tree.get<Conflict>(link.id)!) && (await run(["conflict", "leave", link.id], true)) !== 0) return end(false);
      return { text: "", data: { done: (await run(["chat", `--say=${say}`])) === 0, action: link.action, tree: root } };
    }
    case "hypothesis": {
      // a hypothesis decided, left open or its decision changed: the screen of What waits, here
      // (or picked in the Strom app — a variant, none holds, left open, taken back: only confirmed here)
      const { hypothesisDo } = await import("../cli/menu-links.ts");
      return end(await hypothesisDo(ctx, run, treeLang, root, link.id, link.do, link.variant));
    }
    case "hypotheses": {
      // the agent's proposals of several taken: listed, then the person's yes here
      if (!("decide" in link)) {
        const { acceptProposals } = await import("../cli/menu-links.ts");
        return end(await acceptProposals(ctx, run, treeLang, root, link.ids.split(",")));
      }
      // who decides the hypotheses: the agent only on the person's yes here, back to the person at once
      const { hypothesesDo } = await import("../cli/menu-links.ts");
      return end(await hypothesesDo(ctx, run, treeLang, root, link.decide));
    }
    case "sync-undo": {
      const { undoSending } = await import("../cli/menu-links.ts");
      return end(await undoSending(ctx, run, treeLang, root, link.intake));
    }
    case "sync": {
      // the tree the app sent: shown here, written or thrown away on the person's word (it waits in the inbox)
      const { receivedPending } = await import("../core/sync.ts");
      const waiting = receivedPending(root);
      const sent = link.intake ? waiting.find((r) => r.intake === link.intake) : waiting[0];
      if (!sent) return said("ui.link.sync.none");
      const { decideSent } = await import("../cli/menu-research.ts");
      await decideSent(ctx, run, treeLang, root, sent, "ui.enter.close");
      return { text: "", data: { done: true, action: link.action, tree: root } };
    }
    case "direction": {
      const { directionDo } = await import("../cli/menu-links.ts");
      return end(await directionDo(ctx, run, treeLang, root, link.id, link.do));
    }
    case "finish": {
      const { finishSession, finishRun } = await import("../cli/menu-links.ts");
      // a run (spec 126): its session's agent writes down what it found, the run ends; one waiting ends at once
      if ("run" in link) return end(await finishRun(ctx, run, treeLang, root, link.run));
      return end(await finishSession(ctx, run, treeLang, root, link.session));
    }
    case "archive": {
      // an archive's question, as What waits asks it — only for an archive a downloader here reaches (an archive of the
      // data from the app asks nothing of the kind); the answer is the person's, here
      const { archiveAsked } = await import("../cli/menu-links.ts");
      return end(await archiveAsked(ctx, run, treeLang, root, link.host));
    }
    case "experiment": {
      // turned on: the person's question here; turned off: at once
      const { experimentDo } = await import("../cli/menu-links.ts");
      return end(await experimentDo(ctx, run, treeLang, root, link.do, link.name));
    }
    case "history": {
      // a place's history: the estimate and the person's question here, its task on top of the queue, started now if wanted
      const { placeSearch } = await import("../cli/menu-links.ts");
      return end(await placeSearch(ctx, run, treeLang, root, link.place));
    }
    case "places": {
      // the places to identify: the queue (or one place) and the estimate here, its task on top, started now if wanted
      const { placesRun } = await import("../cli/menu-links.ts");
      return end(await placesRun(ctx, run, treeLang, root, link.place));
    }
    case "work": {
      // the agent working on the queue alone: what starts shown here, started in this terminal only on the person's yes
      const { workRun } = await import("../cli/menu-links.ts");
      return end(await workRun(ctx, run, treeLang, root, link.do, link.n === undefined ? undefined : Number(link.n), link.task?.split(","), link.research ? { research: link.research, ...(link.agent ? { agent: link.agent } : {}) } : undefined));
    }
    case "fixes": {
      // strom's fixes: shown here; set right or put back only on the person's word, asked by strom fixes itself
      const { fixesDo } = await import("../cli/menu-links.ts");
      return end(await fixesDo(ctx, run, treeLang, root, link.id, link.do));
    }
    case "history-kinds": {
      // the kinds of history looked for, one added: what changes and the estimate here, set on the person's yes, align offered
      const { historyKindsDo } = await import("../cli/menu-links.ts");
      return end(await historyKindsDo(ctx, run, treeLang, root, link.scope, link.kinds, link.inherit === "1"));
    }
    case "history-align": {
      // the history aligned with the kinds: strom history align's preview and its question here
      const { historyAlignDo } = await import("../cli/menu-links.ts");
      return end(await historyAlignDo(ctx, run, treeLang, root, link.prune === "1"));
    }
    case "back": {
      // back in time: the change named (or one picked here) — strom history back shows what returns, the person decides
      const { backDo } = await import("../cli/menu-links.ts");
      return end((await backDo(ctx, run, treeLang, root, link.change)) === 0);
    }
    case "house": {
      // the history of a house asked for: the estimate and the person's question here, its task on top, started now if wanted (run.confirm no: neither asked, spec 030 K6.3a)
      if (link.do === "search") {
        const { houseSearch } = await import("../cli/menu-links.ts");
        return end(await houseSearch(ctx, run, treeLang, root, link.house, link.with ? link.with.split(",") : []));
      }
      // a conversation about the house (spec 145 T2): the agent costs, said and asked first; then strom chat --house
      if (link.do === "chat") {
        const { houseChat } = await import("../cli/menu-links.ts");
        const done = await houseChat(ctx, run, treeLang, root, link.house, agent);
        // the conversation is the agent's (a terminal of its own, or its desktop app): nothing to wait for here
        return done ? { text: "", data: { done, action: link.action, tree: root } } : end(done);
      }
      // a research of a house of the person's own: its path asked here, then strom house import (its questions here too)
      const { houseImportDo } = await import("../cli/menu-links.ts");
      return end(await houseImportDo(ctx, run, treeLang, root));
    }
  }
  const named = "person" in link ? link.person : undefined;
  const person = named ? personOf(root, ctx, named) : undefined;
  if (named && !person) return said("ui.link.noperson", { person: named });
  const { asks, asksToStart } = await import("../cli/menu-links.ts");
  switch (link.action) {
    case "chat": {
      // one direction: its tasks only (the research's own name and ID in the first message)
      const direction = link.research ? tree.get<Research>(link.research) : undefined;
      if (link.research && direction?.type !== "research") return said("ui.link.direction.none", { id: link.research });
      // an ended line: no agent works on it (its tasks are out of the queue) — refused before anything is asked or started
      if (direction?.type === "research" && direction.state === "done") return said("ui.link.direction.done", { name: direction.name, id: direction.id });
      // the agent costs: said and asked first, then the conversation as strom chat starts it
      const what = direction
        ? ui(treeLang, "ui.link.what.chat.research", { agent, name: direction.name })
        : person
          ? ui(treeLang, "ui.link.what.chat.person", { agent, person: who(person) })
          : ui(treeLang, "ui.link.what.chat", { agent });
      if (!(await asksToStart(ctx, treeLang, root, what, ui(treeLang, "ui.link.cost")))) return { text: "", data: { done: false, action: link.action, tree: root } };
      const first = direction ? aboutDirection(treeLang, direction) : person ? aboutPerson(treeLang, person) : undefined;
      return { text: "", data: { done: (await run(["chat", ...(first ? [`--say=${first}`] : [])])) === 0, action: link.action, tree: root } };
    }
    case "story": {
      const { approveStory, coupleStory } = await import("../cli/menu-links.ts");
      // the story of a house (spec 145 T4): said by its municipality and number
      if ("house" in link) {
        const h = tree.get<House>(link.house);
        if (!h || h.type !== "house" || h.retracted || h.town) return said("ui.link.nohouse", { house: link.house });
        return end(await approveStory(ctx, run, treeLang, root, h, `${tree.get<Place>(h.place)?.names[0]?.name ?? h.place} ${h.house}`, link.do));
      }
      if (!link.partner) return end(await approveStory(ctx, run, treeLang, root, person!, who(person!), link.do));
      const partner = personOf(root, ctx, link.partner);
      if (!partner) return said("ui.link.noperson", { person: link.partner });
      const couple = `${who(person!)} & ${who(partner)}`;
      const family = coupleStory(Tree.open(root, ctx.env), person!.id, partner.id);
      if (!family) return said("ui.link.story.nocouple", { couple });
      return end(await approveStory(ctx, run, treeLang, root, family, couple, link.do));
    }
    case "review": {
      const what = ui(treeLang, `ui.link.what.review.${link.scope}` as UIKey, { person: who(person!) });
      if (await asks(ctx, treeLang, root, what, ui(treeLang, "ui.link.tasks"))) {
        const { reviewOne } = await import("../cli/menu-research.ts");
        await reviewOne(ctx, run, treeLang, root, person!.id, link.scope);
      }
      return end(true);
    }
    case "research": {
      // the same direction still going: only named, nothing asked
      const same = tree.list<Research>("research").find((r) => r.focus === person!.id && r.direction === link.direction && r.state === "active");
      if (same) return said("ui.research.exists", { name: same.name });
      const what = ui(treeLang, `ui.link.what.research.${link.direction}` as UIKey, { person: who(person!) });
      if (await asks(ctx, treeLang, root, what, ui(treeLang, "ui.link.tasks"))) {
        const { startDirection } = await import("../cli/menu-research.ts");
        await startDirection(ctx, run, treeLang, root, link.direction, ["--person", person!.id], displayName(person!));
      }
      return end(true);
    }
  }
}

/**
 * The bridge of the research started at its last address (strom-research://live?…&do=start, feature live.start): the
 * app's switch turned on, the app that keeps the address finds it again by itself — no window opened. Whether it runs.
 */
function startBridge(ctx: Context, root: string): boolean {
  try {
    return !!startLive(root, ctx.env, { current: true, why: "started from the Strom app (strom-research://live&do=start)" });
  } catch {
    return false;
  }
}

/**
 * What needs no terminal: the research as it is now into the app's window (strom app), a conversation in the
 * agent's desktop app (its first message waits there for the person to send it). Undefined: a terminal is needed.
 */
async function withoutTerminal(ctx: Context, link: TreeLink, root: string) {
  const run = await runnerOf(ctx)(root);
  if (link.action === "app") return { text: "", data: { done: (await run(["app"], true)) === 0, action: "app", tree: root } };
  // followed live: the bridge started (or the one running), its address into the app's window — strom app --live
  if (link.action === "live" && link.do === "start") return { text: "", data: { done: startBridge(ctx, root), action: "live", do: "start", tree: root } };
  if (link.action === "live") return { text: "", data: { done: (await run(["app", "--live"], true)) === 0, action: "live", tree: root } };
  if (link.action !== "chat" && !(link.action === "conflict" && link.do === "agent")) return undefined;
  const tree = Tree.open(root, ctx.env);
  if (whereToTalk(ctx.settings.agent(tree.config).value, ctx.settings.agentWhere(), ctx.env) !== "app") return undefined;
  let first: string | undefined;
  if (link.action === "conflict") {
    first = aboutConflict(root, ctx, link.id);
    if (!first) return say(ctx, "ui.link.conflict.none", { id: link.id }, { tree: link.tree });
  } else if (link.action === "chat" && link.research) {
    const direction = tree.get<Research>(link.research);
    if (direction?.type !== "research") return say(ctx, "ui.link.direction.none", { id: link.research }, { tree: link.tree });
    if (direction.state === "done") return say(ctx, "ui.link.direction.done", { name: direction.name, id: direction.id }, { tree: link.tree });
    first = aboutDirection(tree.lang, direction);
  } else if (link.action === "chat" && link.person) {
    const person = personOf(root, ctx, link.person);
    if (!person) return say(ctx, "ui.link.noperson", { person: link.person }, { tree: link.tree });
    first = aboutPerson(tree.lang, person);
  }
  return { text: "", data: { done: (await run(["chat", ...(first ? [`--say=${first}`] : [])], true)) === 0, action: link.action, tree: root } };
}

/** An excerpt in full: the first research here that has it. */
function excerptOf(ctx: Context, link: Extract<Link, { action: "excerpt" }>) {
  const shared = ctx.settings.shared()?.value;
  const copies = researchesWithId(ctx, link.tree);
  if (!copies.length || !shared) return { missing: "tree" as const };
  let found: ReturnType<typeof fullExcerpt> = { missing: "clip" };
  for (const c of copies) {
    const s = Tree.open(c.root, ctx.env).get<Source>(link.source);
    if (!s || s.retracted) continue;
    found = fullExcerpt(Tree.open(c.root, ctx.env), shared, s, link.clip);
    if (!("missing" in found)) return found;
  }
  return found;
}


/** The app's id of a link taken, written in each copy of the research here (core/handoffs.ts): the bridge says it. */
function noteTaken(ctx: Context, handoff: { id: string; tree: string }): void {
  for (const c of researchesWithId(ctx, handoff.tree)) noteHandoff(c.root, handoff.id);
}

/** What a link asks, done: here in the terminal, without one, or in a new terminal opened for it (handed.on). */
async function openLink(ctx: Context, link: TakenLink, handed: { on: boolean }): Promise<Result> {
  if (link.action === "menu") {
    const where = ctx.settings.home()?.value ?? configDir(ctx.env);
    fs.mkdirSync(where, { recursive: true });
    const opened = openInNewTerminal([], where, ctx.env, process.platform, windowOf(ctx));
    return { text: "", data: { done: true, action: "menu", ...fellBack(opened) } };
  }
  // a tree of the app becomes a research: always in a terminal (it asks the name, waits for the app)
  if (link.action === "new") {
    if (ctx.io.tty) {
      const { newFromApp } = await import("../cli/menu-links.ts");
      const { openAppAt } = await import("./sync.ts");
      const done = await newFromApp(ctx, runnerOf(ctx), link.app, (url) => openAppAt(ctx, url, { holdsTree: true }), () => bringForward(ctx.env), { ...(link.browser ? { browser: link.browser } : {}), ...(link.file ? { file: link.file } : {}), ...(link.name ? { name: link.name } : {}) });
      if (!done) await pause(ctx, ctx.uiLang(), "ui.enter.close");
      return { text: "", data: { done, action: "new" } };
    }
    // nobody to ask here: the terminal opened asks — which family trees it will offer to open instead, said (b-D4)
    const { treesToOpen } = await import("../cli/menu-links.ts");
    const trees = treesToOpen(ctx);
    const where = ctx.settings.home()?.value ?? configDir(ctx.env);
    fs.mkdirSync(where, { recursive: true });
    const opened = openInNewTerminal(["link", "open", linkText(link, linkScheme(ctx.env))], where, ctx.env, process.platform, windowOf(ctx));
    handed.on = opened !== false;
    if (opened === false) return say(ctx, "ui.link.noterminal.new", {}, { action: "new", trees });
    return { text: "", data: { done: true, action: "new", trees, ...fellBack(opened) } };
  }
  if (link.action === "book") {
    // a book's folder of the shared inbox (spec 105): opened, made first when not there — no terminal, nothing
    // written in the research; the images saved there are taken by the bridge or the next session (K1.4)
    const shared = ctx.settings.shared()?.value;
    const copies = researchesWithId(ctx, link.tree);
    if (!copies.length) return say(ctx, "ui.link.notree", {}, { tree: link.tree });
    const b = liveBook(Tree.open(copies[0]!.root, ctx.env), link.id);
    if (!b || !shared) return say(ctx, "ui.link.book.none", { book: link.id }, { tree: link.tree, book: link.id });
    const dir = path.join(shared, "inbox", inboxFolderFor(b));
    fs.mkdirSync(dir, { recursive: true });
    openForUser(dir, ctx.env);
    return { text: ctx.display(dir), data: { done: true, action: "book", do: link.do, book: b.id, dir, tree: copies[0]!.root } };
  }
  if (link.action === "media") {
    // an original the app sent: the file itself, in the viewer of the system; nothing written
    const shared = ctx.settings.shared()?.value;
    const copies = researchesWithId(ctx, link.tree);
    if (!copies.length) return say(ctx, "ui.link.notree", {}, { tree: link.tree });
    for (const c of copies) {
      const known = knownOriginal(Tree.open(c.root, ctx.env), shared, link.sha);
      if (known?.file && fs.existsSync(known.file)) {
        openForUser(known.file, ctx.env);
        return { text: ctx.display(known.file), data: { done: true, action: "media", file: known.file, known: known.id } };
      }
    }
    return say(ctx, "ui.link.nomedia", {}, { tree: link.tree, sha: link.sha });
  }
  // an experiment turned off needs nobody's answer: done in each copy of the research here, without a terminal
  if (link.action === "experiment" && link.do === "off" && !ctx.io.tty) {
    const copies = researchesWithId(ctx, link.tree);
    if (!copies.length) return say(ctx, "ui.link.notree", {}, { tree: link.tree });
    const { experimentDo } = await import("../cli/menu-links.ts");
    let done = true;
    for (const c of copies) done = (await experimentDo(ctx, await runnerOf(ctx)(c.root), Tree.open(c.root, ctx.env).lang, c.root, "off", link.name)) && done;
    return { text: "", data: { done, action: link.action, tree: copies[0]!.root } };
  }
  // the hypotheses decided by the person again needs nobody's answer: done in each copy of the research, no terminal
  if (link.action === "hypotheses" && "decide" in link && link.decide === "person" && !ctx.io.tty) {
    const copies = researchesWithId(ctx, link.tree);
    if (!copies.length) return say(ctx, "ui.link.notree", {}, { tree: link.tree });
    const { hypothesesDo } = await import("../cli/menu-links.ts");
    let done = true;
    for (const c of copies) done = (await hypothesesDo(ctx, await runnerOf(ctx)(c.root), Tree.open(c.root, ctx.env).lang, c.root, "person")) && done;
    return { text: "", data: { done, action: link.action, tree: copies[0]!.root } };
  }
  if (link.action !== "excerpt") {
    // a terminal to show it in: this one, or a new window (the system started strom with none)
    if (ctx.io.tty) return inTerminal(ctx, link);
    const copies = researchesWithId(ctx, link.tree);
    if (!copies.length) return say(ctx, "ui.link.notree", {}, { tree: link.tree });
    // asked of an agent where nobody researches: said in a window, no terminal opened
    const refused = refusedHere(ctx, copies[0]!.root, link);
    if (refused) return say(ctx, refused.key, refused.values, { action: link.action, tree: copies[0]!.root, refused: refused.state });
    const quiet = await withoutTerminal(ctx, link, copies[0]!.root);
    if (quiet) return quiet;
    const opened = linkTerminal(ctx, link, copies[0]!.root);
    handed.on = opened !== false;
    if (opened === false)
      return link.action === "send"
        ? say(ctx, "ui.link.noterminal", { item: `${ui(ctx.uiLang(), "ui.more.title")} → ${ui(ctx.uiLang(), "ui.more.sync")}` })
        : say(ctx, "ui.link.noterminal.any", { name: copies[0]!.name });
    return { text: "", data: { done: true, action: link.action, tree: copies[0]!.root, ...fellBack(opened) } };
  }
  const got = excerptOf(ctx, link);
  if ("file" in got) {
    openForUser(got.file, ctx.env);
    return { text: ctx.display(got.file), data: { done: true, action: "excerpt", file: got.file } };
  }
  if ("url" in got) {
    openForUser(got.url, ctx.env);
    return { text: got.url, data: { done: true, action: "excerpt", url: got.url } };
  }
  return say(ctx, got.missing === "tree" ? "ui.link.notree" : got.missing === "scan" ? "ui.link.noscan" : "ui.link.noclip", { source: link.source }, { tree: link.tree, source: link.source, clip: link.clip });
}

/** The device's yes this terminal was opened with, taken (ctx.deviceYes) — or none: the terminal asks as ever. */
function takeDeviceYes(ctx: Context, link: TakenLink): void {
  const device = fromDevice(ctx.env);
  const yes = ctx.env.STROM_DEVICE_YES;
  if (!device || !yes || !ctx.io.tty || isAgent(ctx.env) || !("tree" in link)) return;
  const text = linkText(link, linkScheme(ctx.env));
  if (researchesWithId(ctx, link.tree).some((c) => takeYes(c.root, yes, text, device.id))) ctx.deviceYes = device;
}

/**
 * The links a device may ask for (spec 094 K3.15): those that start the agent in a terminal, as the app on the computer
 * opens them — a conversation, work on the queue or a line, a task's conversation, a conflict left to the agent, places
 * and a place's history looked up by the agent, a fix that reads again (paid). Anything else stays the computer's.
 */
function deviceMay(link: TakenLink): boolean {
  switch (link.action) {
    case "chat":
    case "work":
      return true;
    case "places":
      return link.do === "run";
    case "history":
      return link.do === "search";
    case "task":
      return link.do === "chat";
    case "conflict":
      return link.do === "agent";
    case "fixes":
      return link.id !== undefined && link.do === undefined && !!fixCheck(link.id)?.paid;
    default:
      return false;
  }
}

/** The environment of a terminal a device opens: as a link of the app opens one, the device named (and its yes). */
function deviceTerminalEnv(env: Env, device: AppClient, yes?: string): Env {
  const not = new Set(["STROM_SPAWNED", "STROM_FOR_APP", "STROM_TREE", "STROM_DEVICE_YES", "STROM_FROM_DEVICE", "STROM_FROM_DEVICE_NAME", "STROM_VIA_DEVICE", "STROM_VIA_DEVICE_NAME", "STROM_NONINTERACTIVE"]);
  return { ...Object.fromEntries(Object.entries(env).filter(([k]) => !not.has(k))), ...fromDeviceEnv(device), ...(yes ? { STROM_DEVICE_YES: yes } : {}) };
}

/** What the gateway answers the device: its HTTP status and the body (an error's code and its sentence). */
type DeviceAnswer = { status: number; answer: Record<string, unknown> };

/**
 * What a device asks of the agent by a link (spec 094 K3.15; the gateway of the devices runs it in the tree's folder,
 * the device from its pairing): without a yes, the link's way gone through without doing anything — the question the
 * terminal would ask (ask: a yes for it, YES_MS, once), started at once (run.confirm no: the terminal opened), a question
 * that stays the terminal's (computer: a price in money, another question — the terminal opened), or only said; with
 * the device's yes, the terminal opened with it.
 */
async function deviceLink(ctx: Context, raw: string, yes: string | undefined): Promise<DeviceAnswer> {
  const device = fromDevice(ctx.env);
  if (!device) throw new UsageError("no device named (STROM_FROM_DEVICE): the gateway of the devices runs this");
  let tree: Tree;
  try {
    tree = ctx.tree();
  } catch (e) {
    // written by a newer strom: nothing here reads it
    if (e instanceof StromError && /^tree\.newer/.test(e.code ?? "")) return refusedForDevice(ctx.uiLang(), 409, "research.locked", "ui.link.device.locked");
    throw e;
  }
  const root = tree.root;
  const lang = tree.lang;
  let link: TakenLink;
  const scheme = linkScheme(ctx.env);
  // the app's scheme or this strom's own (a second strom beside the first), read as this strom's: no other
  const given = /^([^:/?#]{1,64}):/u.exec(raw.trim())?.[1]?.toLowerCase();
  if (raw.length > 2048 || (given !== "strom-research" && given !== scheme)) return refusedForDevice(lang, 400, "device.link", "ui.link.device.bad");
  try {
    link = parseLink(`${scheme}:${raw.trim().slice(given.length + 1)}`, scheme);
  } catch (e) {
    if (!(e instanceof LinkError)) throw e;
    return refusedForDevice(lang, 400, "device.link", "ui.link.device.bad");
  }
  if (!("tree" in link) || link.tree !== tree.config.id.toLowerCase()) return refusedForDevice(lang, 400, "device.link", "ui.link.device.bad");
  if (!deviceMay(link)) return refusedForDevice(lang, 403, "device.computer-only", "ui.link.device.computer", { action: `link.${link.action}` });
  const text = linkText(link, linkScheme(ctx.env));
  const open = (with_?: string): DeviceAnswer => {
    const opened = linkTerminal(ctx, link, root, deviceTerminalEnv(ctx.env, device, with_));
    if (opened === false) return refusedForDevice(lang, 503, "agent.noterminal", "ui.link.device.noterminal");
    if (opened === "recent") return refusedForDevice(lang, 409, "agent.recent", "ui.link.device.recent");
    return { status: 200, answer: { state: "started", ...fellBack(opened) } };
  };
  if (yes !== undefined) {
    if (!yesHolds(root, yes, text, device.id)) return refusedForDevice(lang, 410, "agent.yes-expired", "ui.link.device.expired");
    // sent to the terminal before it opens (it takes it as sent alone); not opened: the device may send it again
    sendYes(root, yes);
    const started = open(yes);
    if (started.status !== 200) sendYes(root, yes, false);
    return started;
  }
  // the way gone through as the terminal would (its question the end of it): nothing written, nothing started
  const said: string[] = [];
  const env = Object.fromEntries(Object.entries(ctx.env).filter(([k]) => k !== "STROM_NONINTERACTIVE")) as Env;
  const preview = Context.fromOptions({ env, cwd: root, io: { stdout: (s) => said.push(s), stderr: () => undefined, tty: true }, json: false, values: {} });
  preview.devicePreview = true;
  const shown = (s: string) => s.split("\n").map(forPhone).filter((l) => l.trim());
  try {
    const r = await inTerminal(preview, link as TreeLink, root);
    const refused = (r.data as { refused?: unknown } | undefined)?.refused;
    return { status: 200, answer: { state: "said", text: shown(said.join("")).join("\n"), ...(refused === "archive" || refused === "waiting" ? { refused } : {}) } };
  } catch (e) {
    if (!(e instanceof DevicePreview)) throw e;
    const o = e.outcome;
    if (o.kind === "ask") {
      const before = shown(said.join(""));
      const y = newYes(root, text, device.id);
      return { status: 200, answer: { state: "ask", ask: { what: forPhone(o.what), note: o.note.map(forPhone).filter((l) => l.trim()), ...(before.length ? { said: before } : {}), tree: tree.config.name }, yes: y.yes, expiresAt: y.expiresAt } };
    }
    // started at once (run.confirm no), or a question the terminal keeps: the terminal opened now, as the app's link
    const opened = open();
    if (opened.status !== 200 || o.kind === "started") return opened;
    return { status: 200, answer: { state: "computer", why: o.why, ...(opened.answer.terminal ? { terminal: opened.answer.terminal } : {}) } };
  }
}

function refusedForDevice(lang: string, status: number, code: string, key: UIKey, params: Record<string, string> = {}): DeviceAnswer {
  return { status, answer: { code, text: ui(lang, key), ...params } };
}

register(
  {
    path: ["link", "device"],
    summary: "What a paired device of the home network asks of the agent by a strom-research:// link (the gateway of the devices runs it)",
    group: "setup",
    hidden: true,
    tree: true,
    person: "Start the agent from a device of the home network?",
    description:
      "Run by the gateway of the devices (spec 094) in the research's folder, the device named by its pairing alone. Without\n" +
      "--yes: the link's way gone through without doing anything — what the terminal would ask (a yes token for the device),\n" +
      "started at once (run.confirm no), a question the terminal keeps (a price in money, another question), or only said.\n" +
      "With the device's --yes: the terminal opened with it, its question before the agent starts not asked again.",
    options: [
      { name: "link", type: "string", description: "the strom-research:// link", value: "<link>" },
      { name: "yes", type: "string", description: "the yes the device was given", value: "<token>" },
    ],
    async run(ctx, { opts }) {
      const r = await deviceLink(ctx, typeof opts.link === "string" ? opts.link : "", typeof opts.yes === "string" ? opts.yes : undefined);
      return { text: JSON.stringify(r.answer), data: r };
    },
  },
);

register(
  {
    path: ["link", "open"],
    summary: "Do what a strom-research:// link from the Strom app asks (the system runs it): send the edited tree back, an excerpt in full, …",
    group: "setup",
    description:
      "strom-research://send?tree=<research id> — the Strom app sends the edited tree to this research (a terminal opens,\n" +
      "what it brings is shown and written on the user's word, as the menu's \"straight from the Strom app\").\n" +
      "strom-research://excerpt?tree=<id>&source=S0042&clip=<its mark> — the excerpt from the scan, not made smaller, in the\n" +
      "viewer of the system (the page in the online archive when the scan is not here). Nothing is written.\n" +
      "strom-research://media?tree=<id>&sha=<sha256> — an original the Strom app sent (or any file the research keeps by\n" +
      "that content), in the viewer of the system. Nothing is written.\n" +
      "strom-research://book?tree=<id>&id=B0003&do=folder — the book's folder of the shared inbox opened (made first when\n" +
      "not there), no terminal. Nothing is written; images saved there are taken by the bridge or the next session.\n" +
      "strom-research://app?tree=<id> — the research as it is now into the app's open window (strom app).\n" +
      "strom-research://live?tree=<id> — the research followed live in the app's window (strom app --live).\n" +
      "strom-research://open?tree=<id> — the research's menu in a terminal.\n" +
      "strom-research://chat?tree=<id>[&person=P0012] — a conversation with the agent (strom chat; of one person: its first\n" +
      "message names only who). strom-research://task?tree=<id>&task=T0007 — the task that waits for the user, answered.\n" +
      "strom-research://review?tree=<id>&person=P0012&scope=person|family|line — the person reviewed (strom review).\n" +
      "strom-research://research?tree=<id>&person=P0012&direction=ancestors|descendants — a new direction (research new).\n" +
      "strom-research://task?…&task=T0007&do=park|drop|wake — the task put aside, given up, back in the queue (the reason asked).\n" +
      "strom-research://task?…&task=T0007&do=chat|note|folder|sent — a task that waits: a conversation about it and the tasks\n" +
      "  waiting at the same place (strom chat --task), its request's text or its folder of images opened (nothing written),\n" +
      "  its request marked sent on the user's word (strom task sent).\n" +
      "strom-research://task?…&task=T0007&do=file — a file that came for a waiting task (dragged into the terminal, a short\n" +
      "  note): strom intake <file> --answers T0007, the task back in the queue.\n" +
      "strom-research://conflict?tree=<id>&id=X0007&do=decide|agent — decided by the user (which claim, why) or left to the agent;\n" +
      "  &take=user|research — the side picked in the app: only confirmed, and why.\n" +
      "strom-research://hypothesis?tree=<id>&id=H0007&do=decide — the hypothesis decided by the user in the terminal: as proposed\n" +
      "  or otherwise, one with no proposal decided or left open, a decided one's decision changed (the reason asked).\n" +
      "  &variant=B — the variant picked in the app (whose child, which couple only): only confirmed, and why (Enter: the app's\n" +
      "  words); do=abandon (none holds), do=keep-open, do=reopen (open again while the tree records nothing of the decision).\n" +
      "strom-research://hypotheses?tree=<id>&decide=agent|person — who decides the hypotheses of the research (hypotheses.decide):\n" +
      "  the agent only on the user's yes in the terminal, back to the user at once.\n" +
      "strom-research://hypotheses?tree=<id>&do=accept&ids=H0007,H0009 — the agent's proposals taken (at most 50): listed, then\n" +
      "  the user's yes in the terminal.\n" +
      "strom-research://story?tree=<id>&person=P0012[&partner=P0013]&do=final|keep — the story approved (strom story approve), of a couple with partner=; a house's with house=A0003 in place of person=.\n" +
      "strom-research://sync-undo?tree=<id>&intake=I0042 — a sending from the app taken back (strom sync undo).\n" +
      "strom-research://sync?tree=<id>&do=show[&intake=R…] — a tree the app sent that waits: shown, then written or thrown away.\n" +
      "strom-research://direction?tree=<id>&id=G0002&do=pause|done|resume — a direction paused, ended (the reason asked) or\n" +
      "taken up again (strom research pause|done|resume).\n" +
      "strom-research://chat?tree=<id>&research=G0002 — a conversation about one direction, its tasks only.\n" +
      "strom-research://finish?tree=<id>&session=N0012 — the session at work asked to finish (strom session finish).\n" +
      "strom-research://finish?tree=<id>&run=run-… — a run asked to finish and end (strom run stop <run> --finish): its session's\n" +
      "  agent writes down what it found and closes it, no next session; a run that waits (its gate, the plan's limit, an\n" +
      "  archive) ends at once. Asked in the terminal first.\n" +
      "strom-research://archive?tree=<id>&host=www.example.org — the question about an archive's images (slowly, through the\n" +
      "browser, by hand), answered in the terminal as in the menu's What waits; the answer is never in the link.\n" +
      "strom-research://house?tree=<id>&house=A0001|<town|number>&do=search[&with=A0002,…] — the history of a house of the\n" +
      "  family tree (at most 2 neighbouring ones with it): the estimate and the person's yes in the terminal, its task on top\n" +
      "  of the queue (strom house request), then started now if wanted; a house the tree has not: refused.\n" +
      "strom-research://house?tree=<id>&house=A0001|<town|number>&do=chat — a conversation with the agent about the house\n" +
      "  (strom chat --house): the house, its municipality's skeleton, the house method and its list of sources loaded; it\n" +
      "  writes only what it finds, a follow-up task only when asked. Asked in the terminal first; none in an archive.\n" +
      "strom-research://places?tree=<id>&do=run[&place=L0012] — the places of the facts identified by the agent: the queue\n" +
      "  (or the one place, queued when it is not) with its sessions and estimate, the task on top of the queue on the\n" +
      "  person's yes in the terminal, then started now if wanted — a queue of more sessions: how many, each with its\n" +
      "  estimate, run one after another (the bridge never starts it).\n" +
      "strom-research://work?tree=<id>&do=loop|tasks[&n=5] — the agent working on the queue alone: n tasks settled (1–100,\n" +
      "  default 5; strom run --tasks n) or for as long as there is work (strom run --loop, only under a gate — none set: n\n" +
      "  tasks or the gate offered instead); the first tasks, the session's time and the gate shown, started in the terminal\n" +
      "  only on the person's yes (no by default; the bridge never starts it). Refused where nobody researches.\n" +
      "  &do=tasks&task=T0003,T0007 (not with n): these tasks alone, one session each in this order (strom run --task) —\n" +
      "  those no longer open or held by another left out, none left: nothing started.\n" +
      "  &research=G0001[&agent=codex] (not with task): a run of that line alone (strom run --research G0001 [--agent …]), in a\n" +
      "  window named after the line; its queue shown is the line's. Refused in one sentence: run.parallel reached, the line\n" +
      "  has a run already, a run of an older strom at work, the agent not here. Without agent: the agent of the line's last\n" +
      "  run, else the research's.\n" +
      "strom-research://fixes?tree=<id>[&id=street-places][&do=undo] — strom's fixes of the research (strom fixes), one of them\n" +
      "  shown, or what it set right to be put back: set right or put back only on the person's word in the terminal.\n" +
      "strom-research://back?tree=<id>[&change=<hash>] — the research back in time (strom history back): the change named by\n" +
      "  its hash (the bridge's /log head, or its first 8), else the earlier changes to pick from — what returns shown, the\n" +
      "  return only on the person's word in the terminal.\n" +
      "strom-research://update|sessions|setup?tree=<id> — strom update, the agent's sessions and their cost, strom setup.\n" +
      "strom-research://new?app=<the app's mark>[&name=<text>] — a tree of the app becomes a new research: named, made, the app hands the\n" +
      "tree to its bridge (?adopt=, GET/POST /adopt), taken in as leads, sent back to the app. name= (one line, at most 120\n" +
      "characters) is only the name suggested in the terminal, the person keeps it or writes another. Family trees here already:\n" +
      "opening one of them in the app (strom app) is offered first; with no terminal the result lists them (trees).\n" +
      "What writes tasks or starts the agent is said and asked in the terminal first; with run.confirm no (the person's,\n" +
      "this computer's) what only starts the agent on the subscription or AI credit starts at once, one line says so — a\n" +
      "price in money (save the history of a house asked for, its estimate one line), a consent, a deletion, a request sent, the gate\n" +
      "and an agent's own command still ask. Any page can open such a link:\n" +
      "each part is checked (only IDs and fixed values, never text but new's suggested name), an unknown research, person, task or excerpt is\n" +
      "only said. No link: the menu.\n" +
      "&handoff=<uuid> (any link of a research): the app's id of it — written when the link was taken (the terminal it\n" +
      "opens came up, or what needs none was done) and said by the research's bridge in GET /status (handoffs) for a\n" +
      "minute, for the app to know the terminal opened. Any other value is left out; nothing is done by it.",
    args: [{ name: "link", description: "the strom-research:// link" }],
    examples: ["strom link open 'strom-research://send?tree=0f8c2d4e-1b2a-4c3d-9e8f-7a6b5c4d3e2f'"],
    async run(ctx, { args }) {
      let link: TakenLink;
      try {
        link = parseLink(args[0], linkScheme(ctx.env));
      } catch (e) {
        if (!(e instanceof LinkError)) throw e;
        return say(ctx, "ui.link.bad", {}, { why: e.message });
      }
      // the app's id of the link (feature handoffs): in a terminal, it came up — said at once, before anything is asked;
      // with none, once what needs no terminal is done — a terminal opened for it says it itself
      if (ctx.io.tty) titleLinkWindow(ctx.env);
      const handoff = link.handoff && "tree" in link ? { id: link.handoff, tree: link.tree } : undefined;
      if (handoff && ctx.io.tty) noteTaken(ctx, handoff);
      // a terminal a device opened with the person's yes there (spec 094 K3.15): taken instead of the question before
      // the agent starts — once, for this link and this device alone, never by an agent or a script
      takeDeviceYes(ctx, link);
      const handed = { on: false };
      const result = await openLink(ctx, link, handed);
      if (handoff && !ctx.io.tty && !handed.on && (result.data as { done?: unknown } | undefined)?.done === true) noteTaken(ctx, handoff);
      return result;
    },
  },
  {
    path: ["link", "on"],
    summary: "Let the Strom app start the research on this computer: register strom-research:// links for this user (the user's yes)",
    group: "setup",
    description:
      "The Strom app on this computer then sends the edited tree back with one click and opens an excerpt in full quality.\n" +
      "For this user alone, no admin rights: macOS an applet in ~/Applications, Windows a key under HKCU, Linux a .desktop\n" +
      "entry. The user's decision: an agent asks them (a window of the system). strom link off takes it away.",
    run(ctx) {
      const lang = ctx.uiLang();
      if (linkHandlerState(ctx.env) === "ours") return { text: ui(lang, "ui.link.on.done"), data: { on: true } };
      if (noLinks(ctx.env)) return { text: ui(lang, "ui.link.isolated"), data: { on: false, isolated: true }, exitCode: 1 };
      ctx.requireHuman("Let the Strom app start strom on this computer (strom-research:// links)?", "strom link on", "links", ui(lang, "ui.setup.links"));
      const on = registerLinks(ctx.env);
      if (on) keepAnswer(ctx, "yes");
      return { text: ui(lang, on ? "ui.link.on.done" : "ui.link.on.failed"), data: { on }, ...(on ? {} : { exitCode: 1 }) };
    },
  },
  {
    path: ["link", "off"],
    summary: "Take the strom-research:// links off this computer: the Strom app no longer starts the research",
    group: "setup",
    run(ctx) {
      const off = unregisterLinks(ctx.env);
      if (off) keepAnswer(ctx, "no");
      return { text: ui(ctx.uiLang(), off ? "ui.link.off.done" : "ui.link.off.failed"), data: { on: !off }, ...(off ? {} : { exitCode: 1 }) };
    },
  },
  {
    path: ["link", "status"],
    summary: "Where strom-research:// links lead on this computer: to this strom, to another program, nowhere",
    group: "setup",
    run(ctx) {
      const state = linkHandlerState(ctx.env);
      const lang = ctx.uiLang();
      const said = linkStateText(state, ctx.env, (p) => ctx.display(p));
      return {
        text: lines(`${ui(lang, "ui.doc.links")}: ${ui(lang, said.key as UIKey, said.where ? { where: said.where } : {})}`, state === "ours" ? undefined : "→ strom link on"),
        data: { state, scheme: linkScheme(ctx.env), ...(said.where ? { program: said.where } : {}) },
      };
    },
  },
);
