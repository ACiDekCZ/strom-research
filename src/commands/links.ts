// strom-research:// links from the Strom app (core/links.ts): strom link open
// is what the system runs for one; strom link on|off|status registers the
// scheme for this user, takes it off, says where it leads.

import fs from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { register } from "../cli/registry.ts";
import type { Context } from "../cli/context.ts";
import { lines } from "../cli/format.ts";
import { ui, type UIKey } from "../cli/ui.ts";
import { readJsonIfExists } from "../core/json.ts";
import type { Conflict, Person, Research, Source, TreeConfig } from "../core/model.ts";
import { Tree } from "../core/tree.ts";
import { LinkError, linkHandlerState, linkText, parseLink, registerLinks, unregisterLinks, type Link } from "../core/links.ts";
import { displayName, lifespan } from "../core/people.ts";
import { PROFILES } from "../agents/profiles.ts";
import { whereToTalk } from "../core/apps.ts";
import { pause } from "../cli/menu-parts.ts";
import type { RunIn } from "../cli/menu-links.ts";
import { fullExcerpt } from "../core/excerpt.ts";
import { openForUser } from "../core/open.ts";
import { openInNewTerminal } from "../core/shortcut.ts";
import { systemNotice } from "../core/dialog.ts";
import { configDir } from "../core/paths.ts";

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
    return (argv, quiet, said) => main(argv, said ? { ...ctx.io, stdout: said } : quiet ? { ...ctx.io, stdout: () => undefined } : ctx.io, ctx.env, root ?? ctx.cwd);
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

type TreeLink = Exclude<Link, { action: "menu" | "excerpt" | "new" }>;

/** What a link asks, in this terminal: which copy of the research, then as the menu does it. */
async function inTerminal(ctx: Context, link: TreeLink) {
  const lang = ctx.uiLang();
  const copies = researchesWithId(ctx, link.tree);
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
      return { text: "", data: { done: (await run(link.action === "open" ? [] : link.action === "live" ? ["app", "--live"] : ["app"])) === 0, action: link.action, tree: root } };
    case "update":
    case "setup":
      return end((await run([link.action])) === 0);
    case "sessions": {
      const { sessionsView } = await import("../cli/menu-links.ts");
      sessionsView(ctx, treeLang, root);
      return end(true);
    }
    case "task": {
      if (link.do) {
        const { taskDo } = await import("../cli/menu-links.ts");
        return end(await taskDo(ctx, run, treeLang, root, link.task, link.do));
      }
      const { waitingTask } = await import("../cli/menu-waiting.ts");
      if (!(await waitingTask(ctx, run, treeLang, root, link.task))) return said("ui.link.notask");
      return end(true);
    }
    case "conflict": {
      if (link.do === "decide") {
        const { decideConflict } = await import("../cli/menu-links.ts");
        return end(await decideConflict(ctx, run, treeLang, root, link.id));
      }
      // left to the agent: it costs — said and asked first, then the conversation about it
      const say = aboutConflict(root, ctx, link.id);
      if (!say) return said("ui.link.conflict.none", { id: link.id });
      const { asks } = await import("../cli/menu-links.ts");
      if (!(await asks(ctx, treeLang, root, ui(treeLang, "ui.link.what.conflict.agent", { agent, title: tree.get<Conflict>(link.id)!.title }), ui(treeLang, "ui.link.cost")))) return end(false);
      return { text: "", data: { done: (await run(["chat", `--say=${say}`])) === 0, action: link.action, tree: root } };
    }
    case "sync-undo": {
      const { undoSending } = await import("../cli/menu-links.ts");
      return end(await undoSending(ctx, run, treeLang, root, link.intake));
    }
    case "direction": {
      const { directionDo } = await import("../cli/menu-links.ts");
      return end(await directionDo(ctx, run, treeLang, root, link.id, link.do));
    }
    case "finish": {
      const { finishSession } = await import("../cli/menu-links.ts");
      return end(await finishSession(ctx, run, treeLang, root, link.session));
    }
  }
  const named = "person" in link ? link.person : undefined;
  const person = named ? personOf(root, ctx, named) : undefined;
  if (named && !person) return said("ui.link.noperson", { person: named });
  const { asks } = await import("../cli/menu-links.ts");
  switch (link.action) {
    case "chat": {
      // one direction: its tasks only (the research's own name and ID in the first message)
      const direction = link.research ? tree.get<Research>(link.research) : undefined;
      if (link.research && direction?.type !== "research") return said("ui.link.direction.none", { id: link.research });
      // the agent costs: said and asked first, then the conversation as strom chat starts it
      const what = direction
        ? ui(treeLang, "ui.link.what.chat.research", { agent, name: direction.name })
        : person
          ? ui(treeLang, "ui.link.what.chat.person", { agent, person: who(person) })
          : ui(treeLang, "ui.link.what.chat", { agent });
      if (!(await asks(ctx, treeLang, root, what, ui(treeLang, "ui.link.cost")))) return { text: "", data: { done: false, action: link.action, tree: root } };
      const first = direction ? aboutDirection(treeLang, direction) : person ? aboutPerson(treeLang, person) : undefined;
      return { text: "", data: { done: (await run(["chat", ...(first ? [`--say=${first}`] : [])])) === 0, action: link.action, tree: root } };
    }
    case "story": {
      const { approveStory, coupleStory } = await import("../cli/menu-links.ts");
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
 * What needs no terminal: the research as it is now into the app's window (strom app), a conversation in the
 * agent's desktop app (its first message waits there for the person to send it). Undefined: a terminal is needed.
 */
async function withoutTerminal(ctx: Context, link: TreeLink, root: string) {
  const run = await runnerOf(ctx)(root);
  if (link.action === "app") return { text: "", data: { done: (await run(["app"], true)) === 0, action: "app", tree: root } };
  // followed live: the bridge started (or the one running), its address into the app's window — strom app --live
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
      "strom-research://app?tree=<id> — the research as it is now into the app's open window (strom app).\n" +
      "strom-research://live?tree=<id> — the research followed live in the app's window (strom app --live).\n" +
      "strom-research://open?tree=<id> — the research's menu in a terminal.\n" +
      "strom-research://chat?tree=<id>[&person=P0012] — a conversation with the agent (strom chat; of one person: its first\n" +
      "message names only who). strom-research://task?tree=<id>&task=T0007 — the task that waits for the user, answered.\n" +
      "strom-research://review?tree=<id>&person=P0012&scope=person|family|line — the person reviewed (strom review).\n" +
      "strom-research://research?tree=<id>&person=P0012&direction=ancestors|descendants — a new direction (research new).\n" +
      "strom-research://task?…&task=T0007&do=park|drop|wake — the task put aside, given up, back in the queue (the reason asked).\n" +
      "strom-research://conflict?tree=<id>&id=X0007&do=decide|agent — decided by the user (which claim, why) or left to the agent.\n" +
      "strom-research://story?tree=<id>&person=P0012[&partner=P0013]&do=final|keep — the story approved (strom story approve), of a couple with partner=.\n" +
      "strom-research://sync-undo?tree=<id>&intake=I0042 — a sending from the app taken back (strom sync undo).\n" +
      "strom-research://direction?tree=<id>&id=G0002&do=pause|done|resume — a direction paused, ended (the reason asked) or\n" +
      "taken up again (strom research pause|done|resume).\n" +
      "strom-research://chat?tree=<id>&research=G0002 — a conversation about one direction, its tasks only.\n" +
      "strom-research://finish?tree=<id>&session=N0012 — the session at work asked to finish (strom session finish).\n" +
      "strom-research://update|sessions|setup?tree=<id> — strom update, the agent's sessions and their cost, strom setup.\n" +
      "strom-research://new?app=<the app's mark> — a tree of the app becomes a new research: named, made, the app hands the\n" +
      "tree to its bridge (?adopt=, GET/POST /adopt), taken in as leads, sent back to the app.\n" +
      "What writes tasks or starts the agent is said and asked in the terminal first. Any page can open such a link:\n" +
      "each part is checked (only IDs and fixed values, never text), an unknown research, person, task or excerpt is\n" +
      "only said. No link: the menu.",
    args: [{ name: "link", description: "the strom-research:// link" }],
    examples: ["strom link open 'strom-research://send?tree=0f8c2d4e-1b2a-4c3d-9e8f-7a6b5c4d3e2f'"],
    async run(ctx, { args }) {
      let link: Link;
      try {
        link = parseLink(args[0]);
      } catch (e) {
        if (!(e instanceof LinkError)) throw e;
        return say(ctx, "ui.link.bad", { why: e.message });
      }
      if (link.action === "menu") {
        const where = ctx.settings.home()?.value ?? configDir(ctx.env);
        fs.mkdirSync(where, { recursive: true });
        openInNewTerminal([], where, ctx.env);
        return { text: "", data: { done: true, action: "menu" } };
      }
      // a tree of the app becomes a research: always in a terminal (it asks the name, waits for the app)
      if (link.action === "new") {
        if (ctx.io.tty) {
          const { newFromApp } = await import("../cli/menu-links.ts");
          const { openAppAt } = await import("./sync.ts");
          const done = await newFromApp(ctx, runnerOf(ctx), link.app, (url) => openAppAt(ctx, url), () => bringForward(ctx.env));
          if (!done) await pause(ctx, ctx.uiLang(), "ui.enter.close");
          return { text: "", data: { done, action: "new" } };
        }
        const where = ctx.settings.home()?.value ?? configDir(ctx.env);
        fs.mkdirSync(where, { recursive: true });
        if (openInNewTerminal(["link", "open", linkText(link)], where, ctx.env) === false) return say(ctx, "ui.link.noterminal.new");
        return { text: "", data: { done: true, action: "new" } };
      }
      if (link.action !== "excerpt") {
        // a terminal to show it in: this one, or a new window (the system started strom with none)
        if (ctx.io.tty) return inTerminal(ctx, link);
        const copies = researchesWithId(ctx, link.tree);
        if (!copies.length) return say(ctx, "ui.link.notree", {}, { tree: link.tree });
        const quiet = await withoutTerminal(ctx, link, copies[0]!.root);
        if (quiet) return quiet;
        const opened = openInNewTerminal(["link", "open", linkText(link)], copies[0]!.root, ctx.env);
        if (opened === false)
          return link.action === "send"
            ? say(ctx, "ui.link.noterminal", { item: `${ui(ctx.uiLang(), "ui.more.title")} → ${ui(ctx.uiLang(), "ui.more.sync")}` })
            : say(ctx, "ui.link.noterminal.any", { name: copies[0]!.name });
        return { text: "", data: { done: true, action: link.action, tree: copies[0]!.root } };
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
      return { text: lines(`${ui(lang, "ui.doc.links")}: ${ui(lang, `ui.doc.links.${state}` as UIKey)}`, state === "ours" ? undefined : "→ strom link on"), data: { state } };
    },
  },
);
