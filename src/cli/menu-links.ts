// What the Strom app's menus ask through strom-research:// links (the app's
// second wave): a task put aside, given up or back in the queue, the agent's
// sessions and what they cost, a conflict decided, a story approved, a sending
// taken back — and a tree of the app that becomes a new research. Each is said
// in the research's terminal and done on the person's word, as the menu does.

import fs from "node:fs";
import path from "node:path";
import type { Context } from "./context.ts";
import { outOfAnswers, translator, type Run } from "./menu-parts.ts";
import { directionTasks, offerChat, setDirection } from "./menu-research.ts";
import { humanCost, humanDay, humanTask, humanWhen } from "./human.ts";
import { lines, truncate } from "./format.ts";
import { isArchive } from "../core/mode.ts";
import { Tree } from "../core/tree.ts";
import type { Conflict, Family, Person, Research, Session, Source, Task } from "../core/model.ts";
import { costPartial, monthSpend, sessionCost } from "../core/session.ts";
import { adoptAskedSince, adoptFailedSince, adoptedAt, adoptionNeverCame, awaitAdoption, nothingSince, SYNC_INBOX, undoSync, withoutImages, type SyncInput } from "../core/sync.ts";
import { moveToTrash } from "../core/trash.ts";
import { noteMovedByFile } from "../core/transfer.ts";
import { appBrowsers, browserKind, kindReaches, type BrowserKind } from "../core/chromium.ts";
import { appWindow } from "../core/appbrowser.ts";
import { moveTree, type Move } from "./move.ts";
import { changeLines } from "../core/changelog.ts";
import { startLive } from "../core/live.ts";
import { adoptAppUrl, appTreeNameFromInstall, defaultAppUrl, stromAppUrl } from "../core/stromapp.ts";
import { stromReadsTags } from "../gedcom/export.ts";
import { appMarkFromInstall } from "../core/links.ts";
import { settleFromApp } from "./wizard.ts";
import { isValidLang } from "../core/lang.ts";
import { agentsHere, suggestedWay, waysHere, type Where } from "../core/apps.ts";
import { chooseWay } from "./ways.ts";
import { claimText } from "../core/people.ts";
import { sideOf, sideText, sidesOf } from "../core/conflicts.ts";
import { PROFILES } from "../agents/profiles.ts";
import { foldText, safeFolderName } from "../core/text.ts";
import { StromError } from "../core/errors.ts";
import { forgetTree } from "../commands/trees.ts";

/** What the Strom app asks, said before anything is done; true when the person goes on. */
export async function asks(ctx: Context, lang: string, root: string, what: string, note?: string, suggested = true): Promise<boolean> {
  const name = Tree.open(root, ctx.env).config.name;
  ctx.io.stdout(lines(translator(lang)("ui.link.asks", { what, name }), note, "") + "\n");
  return ctx.confirm(translator(lang)("ui.link.go"), suggested);
}

const out = (ctx: Context, line: string) => ctx.io.stdout(line + "\n");

/** The app that loads the research's version itself right after a hand-over (the research's numbers for its people). */
const APP_LOADS_ADOPTED = "3.9.0";

/** What stopped it, said; nothing was done. */
function stop(ctx: Context, line: string): false {
  out(ctx, line);
  return false;
}

/** strom in a research's folder (none: where the person is), its output shown or not, or handed to `said`. */
export type RunIn = (root: string | undefined) => Promise<(argv: string[], quiet?: boolean, said?: (text: string) => void) => Promise<number>>;

/** A task put aside, given up (each with the person's reason) or back in the queue. */
export async function taskDo(ctx: Context, run: Run, lang: string, root: string, id: string, what: "park" | "drop" | "wake"): Promise<boolean> {
  const t = translator(lang);
  const tree = Tree.open(root, ctx.env);
  const task = tree.get<Task>(id);
  if (!task || task.retracted) return stop(ctx, t("ui.link.task.none", { task: id }));
  const can = { park: ["open"], drop: ["open", "parked", "waiting"], wake: ["parked", "waiting"] }[what];
  if (!can.includes(task.state)) return stop(ctx, t("ui.link.task.cannot"));
  if (!(await asks(ctx, lang, root, t(`ui.link.what.task.${what}`, { what: humanTask(tree, task.what, lang) })))) return false;
  let reason: string[] = [];
  if (what !== "wake") {
    const why = (await ctx.ask(t("ui.link.task.why"), t(`ui.link.task.${what}.default`))).trim();
    if (why === "0") return false;
    reason = [`--reason=${why || t(`ui.link.task.${what}.default`)}`];
  }
  if ((await run(["task", what, id, ...reason], true)) !== 0) return false;
  out(ctx, t(`ui.link.task.${what}.done`));
  return true;
}

/** A direction of the research paused, ended (each with the person's reason, if they give one) or taken up again. */
export async function directionDo(ctx: Context, run: Run, lang: string, root: string, id: string, what: "pause" | "done" | "resume"): Promise<boolean> {
  const t = translator(lang);
  const tree = Tree.open(root, ctx.env);
  const r = tree.get<Research>(id);
  if (!r || r.type !== "research") return stop(ctx, t("ui.link.direction.none", { id }));
  const state = what === "pause" ? "paused" : what === "resume" ? "active" : "done";
  if (r.state === state) return stop(ctx, state === "active" ? t("ui.research.exists", { name: r.name }) : t("ui.link.direction.cannot", { name: r.name, state: t(`ui.dirs.${state}`) }));
  if (!(await asks(ctx, lang, root, t(`ui.link.what.direction.${what}`, { name: r.name, n: directionTasks(tree, r.id) })))) return false;
  let reason: string | undefined;
  if (what !== "resume") {
    reason = (await ctx.ask(t("ui.link.direction.why"))).trim();
    if (reason === "0") return false;
  }
  await setDirection(ctx, run, lang, root, r, what, reason || undefined);
  return true;
}

/** A session at work asked to finish: its agent writes down what it found and closes it; a run starts no next one. */
export async function finishSession(ctx: Context, run: Run, lang: string, root: string, id: string): Promise<boolean> {
  const t = translator(lang);
  const tree = Tree.open(root, ctx.env);
  const s = tree.get<Session>(id);
  if (!s || s.type !== "session" || s.state !== "open") return stop(ctx, t("ui.link.finish.none", { session: id }));
  const task = s.task ? tree.get<Task>(s.task) : undefined;
  const agent = PROFILES[s.agent ?? ""]?.name ?? s.agent ?? "";
  if (!(await asks(ctx, lang, root, t("ui.link.what.finish", { agent, session: s.id, task: task ? truncate(humanTask(tree, task.what, lang), 80) : "–" })))) return false;
  return (await run(["session", "finish", s.id])) === 0;
}

/** The agent's sessions, the latest first, and what this month's cost. */
export function sessionsView(ctx: Context, lang: string, root: string): void {
  const t = translator(lang);
  const tree = Tree.open(root, ctx.env);
  const all = tree.list<Session>("session").sort((a, b) => b.started.localeCompare(a.started));
  out(ctx, t("ui.link.sessions.title", { name: tree.config.name }));
  if (!all.length) return void out(ctx, `  ${t("ui.link.sessions.none")}`);
  const month = monthSpend(tree, new Date().toISOString().slice(0, 7));
  out(ctx, t("ui.link.sessions.month", { n: month.sessions, cost: humanCost(month.amount, lang) }));
  out(ctx, "");
  const shown = all.slice(0, 15);
  for (const s of shown) {
    const task = s.task ? tree.get<Task>(s.task) : undefined;
    const agent = PROFILES[s.agent ?? ""]?.name ?? s.agent ?? "";
    const what = truncate(humanTask(tree, task?.what ?? s.summary ?? "", lang), 80);
    const spent = sessionCost(s.metrics);
    const cost = spent !== undefined ? `${humanCost(spent, lang)}${costPartial(s.metrics) ? "+" : ""}` : "";
    out(ctx, `  ${humanDay(s.started, lang)}  ${[agent, what, cost].filter(Boolean).join(" · ")}`);
  }
  if (all.length > shown.length) out(ctx, `  ${t("ui.link.sessions.more", { n: all.length - shown.length })}`);
}

/**
 * A conflict the person decides: which claim holds (or their own words), and why. The side picked in the Strom app
 * already (take): only confirmed, and why — that side taken (a conflict not decided by side: the claims offered).
 */
export async function decideConflict(ctx: Context, run: Run, lang: string, root: string, id: string, take?: "user" | "research"): Promise<boolean> {
  const t = translator(lang);
  const tree = Tree.open(root, ctx.env);
  const c = tree.get<Conflict>(id);
  if (!c || c.type !== "conflict") return stop(ctx, t("ui.link.conflict.none", { id }));
  if (c.state === "resolved") return stop(ctx, t("ui.link.conflict.decided", { resolution: c.resolution ?? "" }));
  const sides = take ? sidesOf(c) : undefined;
  if (take && sides) {
    const value = sideText(tree, c, sides[take]) || t("ui.link.conflict.empty");
    if (!(await asks(ctx, lang, root, t(take === "user" ? "ui.link.what.conflict.user" : "ui.link.what.conflict.research", { title: c.title, value })))) return false;
    let why = "";
    while (!why) {
      why = (await ctx.ask(t("ui.link.conflict.why"))).trim();
      if (why === "0" || outOfAnswers(ctx)) return false;
    }
    if ((await run(["conflict", "resolve", id, `--take=${take}`, `--reasoning=${t("ui.link.conflict.by", { why })}`], true)) !== 0) return false;
    out(ctx, t("ui.link.conflict.done"));
    return true;
  }
  if (!(await asks(ctx, lang, root, t("ui.link.what.conflict.decide", { title: c.title })))) return false;
  const claim = (x: Conflict["claims"][number]) => `${claimText(tree, c, x)}${x.source ? ` — ${tree.get<Source>(x.source)?.title ?? x.source}` : ""}`;
  const i = await ctx.choose(t("ui.link.conflict.pick"), [...c.claims.map((x) => ({ label: claim(x) })), { label: t("ui.link.conflict.other") }], 0, { back: t("ui.browse.back") });
  if (i === undefined) return false;
  let resolution = i < c.claims.length ? `${claimText(tree, c, c.claims[i]!)}${c.claims[i]!.source ? ` (${c.claims[i]!.source})` : ""}` : "";
  if (!resolution) {
    resolution = (await ctx.ask(t("ui.link.conflict.own"))).trim();
    if (!resolution || resolution === "0") return false;
  }
  let why = "";
  while (!why) {
    why = (await ctx.ask(t("ui.link.conflict.why"))).trim();
    if (why === "0" || outOfAnswers(ctx)) return false;
  }
  // a side of a conflict of the user's edit picked: that side taken — the user's value written into the fact (found: the
  // value with its source named neither side, the conflict closed and nothing written)
  const side = i < c.claims.length ? sideOf(c, c.claims[i]!) : undefined;
  if ((await run(["conflict", "resolve", id, `--resolution=${resolution}`, ...(side ? [`--take=${side}`] : []), `--reasoning=${t("ui.link.conflict.by", { why })}`], true)) !== 0) return false;
  out(ctx, t("ui.link.conflict.done"));
  return true;
}

/**
 * A story the person read and approves: no longer a draft, locked. Beside an approved one, its new version: read and
 * approved in its place, or not wanted (keep: the approved one stays) — as the menu's "What waits for you".
 */
export async function approveStory(ctx: Context, run: Run, lang: string, root: string, person: Person | Family, who: string, how: "final" | "keep" = "final"): Promise<boolean> {
  const t = translator(lang);
  const st = person.story;
  if (!st) return stop(ctx, t("ui.link.story.none", { person: who }));
  if (st.draft) {
    const { decideStory } = await import("./menu-waiting.ts");
    return decideStory(ctx, run, lang, root, person.id, who, how);
  }
  if (how === "keep") return stop(ctx, t("ui.link.story.nonew", { person: who }));
  if (st.status === "final") return stop(ctx, t("ui.link.story.final", { person: who }));
  out(ctx, lines(st.title ? `„${st.title}“` : undefined, "", st.text.replace(/\*\*/g, ""), ""));
  if (!(await asks(ctx, lang, root, t("ui.link.what.story", { person: who })))) return false;
  if ((await run(["story", "approve", person.id], true)) !== 0) return false;
  out(ctx, t("ui.link.story.done"));
  return true;
}

/**
 * The family whose story a link of the Strom app means by its two partners (the app knows no family IDs): of several,
 * the one with a new version waiting, then one with a story, then the first.
 */
export function coupleStory(tree: Tree, a: string, b: string): Family | undefined {
  if (a === b) return undefined;
  const theirs = tree.list<Family>("family").filter((f) => !f.retracted && f.partners.includes(a) && f.partners.includes(b));
  return theirs.find((f) => f.story?.draft) ?? theirs.find((f) => f.story) ?? theirs[0];
}

/**
 * What the research took from the Strom app, taken back on the person's word — asked by the app's link, or by the person
 * in the menu (then never "the Strom app asks": found on Mac).
 */
export async function undoSending(ctx: Context, run: Run, lang: string, root: string, id: string, fromMenu = false): Promise<boolean> {
  const t = translator(lang);
  const input = Tree.open(root, ctx.env).get<SyncInput>(id);
  if (!input || input.type !== "input" || !input.sync) return stop(ctx, t("ui.link.sync.none", { input: id }));
  if (input.sync.undone) return stop(ctx, t("ui.link.sync.was"));
  // what goes back, line by line, before the person says yes — and no is what Enter says (found on Windows: "2 changes"
  // of a send the app counted as 1, a yes on Enter)
  const preview = Tree.open(root, ctx.env);
  preview.dryRun = true;
  preview.withTreeLock(() => undoSync(preview, input));
  const ops = isArchive(preview) ? preview.written.filter((o) => !o.op.startsWith("task.")) : preview.written;
  // what it is now beside what it goes back to (found on Mac: only the value it would have again)
  const said = changeLines(preview, ops, "", lang, Tree.open(root, ctx.env)).map((l) => `  ${l.text}`);
  const when = humanWhen(input.created, lang);
  if (fromMenu) {
    out(ctx, lines(t("ui.more.undo.what", { when }), ...said, ""));
    if (!(await ctx.confirm(t("ui.link.go"), false))) return false;
  } else if (!(await asks(ctx, lang, root, t("ui.link.what.sync", { when }), lines(...said), false))) return false;
  return (await run(["sync", "undo", id])) === 0;
}

/**
 * The research made from the tree's file with no browser to connect: taken in as the app's trees are (strom sync
 * --apply --force, without its images: its sources the research's), then what came of it said — and the first
 * conversation offered.
 */
async function fromFile(ctx: Context, run: Run, root: string, name: string, file: string, from: string): Promise<boolean> {
  const t = translator(Tree.open(root, ctx.env).lang);
  // the move is finished later — strom app, once a browser that reaches strom is here (D10)
  noteMovedByFile(root, { from, file });
  const dir = path.join(root, SYNC_INBOX);
  fs.mkdirSync(dir, { recursive: true });
  const kept = path.join(dir, `${safeFolderName(name)}.json`);
  fs.writeFileSync(kept, withoutImages(fs.readFileSync(file, "utf8")));
  if ((await run(["sync", kept, "--apply", "--force"], true)) !== 0) return stop(ctx, t("ui.link.new.failed", { name }));
  const tree = Tree.open(root, ctx.env);
  const sources = tree.list<Source>("source").filter((s) => !s.retracted && s.kind !== "family-tree").length;
  // a tree with no people yet (C1): handed over all the same — the research linked, its people come by the app's sends
  if (tree.countLive("person") === 0) out(ctx, t("ui.link.new.taken.empty", { name }));
  else out(ctx, t(isArchive(tree) ? "ui.link.new.taken.archive" : "ui.link.new.taken", { name, persons: tree.countLive("person"), families: tree.countLive("family"), sources }));
  if (isArchive(tree)) out(ctx, t("ui.link.new.archive"));
  else await offerChat(ctx, run, tree.lang, root, t("ui.link.new.chat"), t("ui.link.new.say"));
  return true;
}

/**
 * A tree of the Strom app becomes a new research (strom-research://new?app=<its mark>): named, its language and
 * agent chosen, made; the app opened to hand the tree over (?adopt=<the bridge>), the tree taken in as leads,
 * the research sent back to the app — then the conversation offered.
 */
export async function newFromApp(ctx: Context, runIn: RunIn, token: string, openAt: (url: string) => boolean, forward: () => void, opts: { browser?: BrowserKind; file?: string } = {}): Promise<boolean> {
  // The browser the app runs in (its link's browser=, the line's STROM_FROM_BROWSER — the app's 3.9.1): the app keeps
  // the tree there. One the app cannot reach strom from (Safari), or the tree saved as a file for that (STROM_FROM_FILE):
  // the tree moves to a browser that can — asked first, before anything is set up (no: nothing is)
  const from = opts.browser ?? browserKind(ctx.env.STROM_FROM_BROWSER);
  const given = opts.file ?? (ctx.env.STROM_FROM_FILE?.trim() || undefined);
  let move: Move | undefined;
  if (given || (from && !kindReaches(from))) {
    move = await moveTree(ctx, token, from, given);
    if (!move) return false;
  }
  // strom not set up yet (the app is how this person came): the setup first — the agent and where to talk with it
  // chosen there, not asked again
  const setUp = !ctx.settings.home()?.value;
  if (setUp) {
    await (await runIn(undefined))(["setup"]);
    ctx.settings.reload();
    if (!ctx.settings.home()?.value) return false;
  } else if (appMarkFromInstall(ctx.env)) await settleFromApp(ctx, ctx.uiLang(), { shortcut: true });
  // the copy of the app the tree comes from, carried by its file when the line had no room for it (Win + R: 259
  // characters) — kept as the line's STROM_APP_URL is
  if (move?.mark.app && !ctx.env.STROM_APP_URL?.trim()) {
    ctx.settings.reload();
    if (move.mark.app === defaultAppUrl(ctx.env)) delete ctx.settings.config.stromAppUrl;
    else ctx.settings.config.stromAppUrl = move.mark.app;
    ctx.settings.save();
  }
  // a strom.app.url that is no address of the app: refused before anything is asked or made — the tree's way back
  // would be an address built on it with the bridge's secret (B1-c)
  stromAppUrl(ctx.settings);
  let lang = ctx.uiLang();
  let t = translator(lang);
  out(ctx, t("ui.link.new.title"));
  out(ctx, "");
  // the name; an empty research of that name (a handover that did not come) is taken again
  let name = "";
  let root: string | undefined;
  // a research made for a tree of the app that never came (installed from an older app, the tree stayed in Safari):
  // the tree goes into it, nothing set up again (suggested) — or a new research (D4)
  const waiting = ctx
    .knownTrees()
    .map((k) => ({ ...k, never: adoptionNeverCame(k.root) }))
    .filter((k): k is typeof k & { never: { at: string } } => Boolean(k.never))
    .sort((a, b) => Date.parse(b.never.at) - Date.parse(a.never.at))[0];
  if (waiting) {
    const tw = Tree.open(waiting.root, ctx.env);
    const i = await ctx.choose(t("ui.link.new.into.ask", { name: tw.config.name, when: humanWhen(waiting.never.at, lang) }), [{ label: t("ui.link.new.into", { name: tw.config.name }) }, { label: t("ui.link.new.into.new") }], 0, { back: t("ui.move.cancel") });
    if (i === undefined) {
      if (move) out(ctx, t("ui.move.file.kept", { file: ctx.display(move.file) }));
      return false;
    }
    if (i === 0) {
      root = waiting.root;
      name = tw.config.name;
      lang = tw.lang;
      t = translator(lang);
    }
  }
  const joined = Boolean(root);
  // suggested: the app's tree's name (its line carries it), else the usual one — Enter never ends the handover
  const suggested = (move?.mark.tree || undefined) ?? appTreeNameFromInstall(ctx.env) ?? t("ui.tree.default");
  const ways = waysHere(agentsHere(ctx.env));
  const mine = ctx.settings.agent().value;
  let agent = mine;
  let where: Where | undefined;
  let archive = false;
  // asked step by step, 0 one step back (the name's 0: nothing set up, found on a Mac: 0 at the agent ended it all); a
  // research joined asks none. With an agent here the research with it is suggested and an archive is the other choice,
  // as in the setup (an archive the setup chose, or the setup just run: as it is); each agent's app and terminal a line
  // of their own
  for (let step = joined ? 3 : 0; step < 3; ) {
    if (step === 0) {
      name = ((await ctx.ask(t("ui.link.new.name"), suggested)) || suggested).trim().replace(/\s+/gu, " ");
      if (!name || name === "0") {
        if (move) out(ctx, t("ui.move.file.kept", { file: ctx.display(move.file) }));
        return false;
      }
      const same = ctx.knownTrees().find((k) => foldText(k.name) === foldText(name) || path.basename(k.root) === safeFolderName(name));
      root = same?.root;
      if (same && Tree.open(same.root, ctx.env).count("person") > 0) {
        root = undefined;
        out(ctx, t("ui.link.new.exists", { name }));
        if (outOfAnswers(ctx)) return false;
        continue;
      }
      step = 1;
    } else if (step === 1) {
      const a = (await ctx.ask(t("ui.setup.lang"), lang)).trim().toLowerCase();
      if (a === "0") step = 0;
      else if (isValidLang(a)) {
        lang = a;
        t = translator(lang);
        step = 2;
      } else if (outOfAnswers(ctx)) return false;
    } else {
      step = 3;
      // no agent here: an archive, nothing asked (N9: the setup run before an agent left, its research mode kept)
      if (!root && ways.length === 0) archive = true;
      if (root || setUp || ways.length === 0 || ctx.settings.config.mode === "archive") continue;
      const pick = suggestedWay(ways, mine, ctx.settings.agentWhere());
      const k = await ctx.choose(t("ui.setup.fromapp"), [{ label: t("ui.setup.fromapp.archive") }, { label: t("ui.setup.fromapp.agent", { agent: PROFILES[ways[pick]!.agent]!.name }) }], 1, { back: t("ui.browse.back") });
      archive = k === 0;
      if (k === undefined) step = 1;
      else if (k === 1 && ways.length > 1) {
        const i = await chooseWay(ctx, lang, ways, pick, { back: t("ui.browse.back") });
        if (i === undefined) step = 2;
        else {
          agent = ways[i]!.agent;
          where = ways[i]!.where;
        }
      }
    }
  }
  // made here: an empty research of it is not left behind when the app hands nothing over (N4)
  const made = !root;
  if (!root) {
    let said = "";
    const code = await (await runIn(undefined))(["init", name, "--lang", lang, ...(archive ? ["--mode", "archive"] : []), "--json"], true, (s) => (said += s));
    if (code !== 0) return false;
    root = (JSON.parse(said) as { root: string }).root;
  }
  const run = await runIn(root);
  if (!archive && agent !== mine) await run(["agents", "use", agent, "--for-tree"], true);
  // where the person talks with the agents (the setting of this computer, as the setup keeps it)
  if (where && where !== ctx.settings.agentWhere()) await run(["config", "set", "agent.where", where], true);

  // no browser: the research made from the file — the app and the research go on through files
  if (move && "without" in move) return fromFile(ctx, run, root, name, move.file, move.from);
  // the browser the app opens in from now on: the one it moves to, else the one the tree came from (while it is here)
  const keep = move && "browser" in move ? move.browser.kind : from && kindReaches(from) && appBrowsers(ctx.env).some((b) => b.kind === from) ? from : undefined;
  if (keep && keep !== ctx.settings.appBrowser()) {
    await run(["config", "set", "app.browser", keep], true);
    ctx.settings.reload();
  }

  // the app hands its tree over to the bridge of this research (a tree moving: the app there takes its file first)
  awaitAdoption(root, token, move?.file, !made);
  const info = startLive(root, ctx.env, { current: true });
  if (!info) throw new StromError("the bridge did not start", { hint: "strom live serve shows why" });
  const url = adoptAppUrl(info.url, ctx.settings);
  const since = Date.now();
  const waitMs = Number(ctx.env.STROM_ADOPT_WAIT_MS ?? 30 * 60_000);
  const minutes = Math.max(1, Math.round(waitMs / 60_000));
  // a browser installed just now asks its own questions at its first start (signing in, the default browser): the
  // address to open in it once they are answered (D8)
  if (move && "browser" in move && move.installed) out(ctx, t("ui.move.fresh", { browser: move.browser.name }));
  out(ctx, openAt(url) ? `${t("ui.link.new.wait", { min: minutes })}\n${t("ui.sync.wait.open", { url })}` : t("ui.app.url", { url }));
  // the file of the move: in the trash once the tree is handed over, else kept where it is (said, D9)
  const keptFile = () => {
    if (move) out(ctx, t("ui.move.file.kept", { file: ctx.display(move.file) }));
  };
  // the app has not asked the research a thing for a while: a browser may keep it from strom (its permission for the
  // local network, D7) — said once, and again at the end
  const blockedAfter = Number(ctx.env.STROM_ADOPT_HINT_MS ?? 2 * 60_000);
  let toldBlocked = false;
  // named as the browser the app opened in names it (Edge 154: Apps on device, not Local network — F5)
  const opensIn = appWindow(ctx.settings, ctx.env, process.platform, { holdsTree: true }).browser;
  const blocked =
    opensIn?.kind === "brave" ? t("ui.link.new.blocked.brave")
    : opensIn?.kind === "firefox" ? t("ui.link.new.blocked.firefox")
    : opensIn && kindReaches(opensIn.kind) ? t("ui.link.new.blocked.chromium", { browser: opensIn.name })
    : t("ui.link.new.blocked");
  // the bridge takes the tree in itself (as the app's trees are, its sources the research's): whether or not this
  // terminal still waits, it is in once the app has handed it over — here only what came of it
  let done: { input?: string; app?: string } | undefined;
  // a copy of the app that does not know the tree (no-tree: stromapp.info opened, the tree is in its beta) ends
  // nothing — the right one may still hand it over; said once
  let elsewhere = false;
  while (Date.now() < since + waitMs) {
    done = adoptedAt(root, since);
    if (done) break;
    const failed = adoptFailedSince(root, since);
    if (failed) {
      forward();
      keptFile();
      return stop(ctx, [t(failed.why === "empty" ? "ui.link.new.empty" : "ui.link.new.failed", { name }), failed.reason].filter(Boolean).join("\n"));
    }
    const nothing = nothingSince(root, since);
    if (nothing === "no-tree") {
      if (!elsewhere) out(ctx, t("ui.link.new.elsewhere"));
      elsewhere = true;
    } else if (nothing) {
      forward();
      // the app said no (Nepředávat): nothing set up halfway — the research made for it, still empty, into the trash
      if (made && Tree.open(root, ctx.env).count("person") === 0) {
        forgetTree(ctx, root, "the Strom app handed no tree over");
        out(ctx, t("ui.link.new.none.trashed", { name }));
      } else out(ctx, t("ui.link.new.none", { name }));
      keptFile();
      return false;
    }
    if (!toldBlocked && Date.now() - since > blockedAfter && !adoptAskedSince(root, since)) {
      toldBlocked = true;
      out(ctx, blocked);
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  forward();
  if (!done) {
    keptFile();
    return stop(ctx, lines(t("ui.link.new.waited", { name, min: minutes }), adoptAskedSince(root, since) ? undefined : blocked));
  }
  // handed over: the file of the move is the browser's now — into the trash (never deleted for good)
  if (move && "browser" in move && fs.existsSync(move.file)) {
    try {
      moveToTrash(move.file, ctx.env);
      out(ctx, t("ui.move.file.trashed", { file: ctx.display(move.file) }));
    } catch {
      keptFile();
    }
  }

  const tree = Tree.open(root, ctx.env);
  const sources = tree.list<Source>("source").filter((s) => !s.retracted && s.kind !== "family-tree").length;
  // a tree with no people yet (C1): handed over all the same — the research linked, its people come by the app's sends
  if (tree.countLive("person") === 0) out(ctx, t("ui.link.new.taken.empty", { name }));
  else out(ctx, t(isArchive(tree) ? "ui.link.new.taken.archive" : "ui.link.new.taken", { name, persons: tree.countLive("person"), families: tree.countLive("family"), sources }));
  // the research as it is now back into the app's window: the same tree, now of the research (not opened: its address
  // said) — an app from 3.9.0 loads it itself right after the hand-over, so nothing is opened a second time (N12: a
  // second tab asking to load the research's version)
  let said = "";
  if (done?.app && stromReadsTags(done.app, APP_LOADS_ADOPTED)) out(ctx, t("ui.link.new.back"));
  else if ((await run(["app", "--json"], true, (s) => (said += s))) === 0) {
    const shown = JSON.parse(said) as { opened?: boolean; url?: string; via?: string; file?: string };
    // no browser to hand it over: the file to drag into the app
    if (shown.via === "drag" && shown.file) out(ctx, t("ui.app.drag", { file: ctx.display(shown.file), shown: shown.opened ? t("ui.app.drag.shown") : "" }));
    else out(ctx, shown.opened ? t("ui.link.new.back") : t("ui.app.url", { url: shown.url ?? "" }));
  }
  // an archive (no agent): what is next is the app's; else the first conversation offered
  if (isArchive(tree)) out(ctx, t("ui.link.new.archive"));
  else await offerChat(ctx, run, lang, root, t("ui.link.new.chat"), t("ui.link.new.say"));
  return true;
}

