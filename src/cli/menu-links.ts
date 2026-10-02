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
import { humanCost, humanDay, humanTask } from "./human.ts";
import { lines, truncate } from "./format.ts";
import { Tree } from "../core/tree.ts";
import type { Conflict, Family, Person, Research, Session, Source, Task } from "../core/model.ts";
import { monthSpend } from "../core/session.ts";
import { adoptFailedSince, adoptedSince, awaitAdoption, nothingSince, type SyncInput } from "../core/sync.ts";
import { startLive } from "../core/live.ts";
import { adoptAppUrl } from "../core/stromapp.ts";
import { isValidLang } from "../core/lang.ts";
import { agentsHere } from "../core/apps.ts";
import { PROFILES } from "../agents/profiles.ts";
import { foldText, safeFolderName } from "../core/text.ts";
import { StromError } from "../core/errors.ts";

/** What the Strom app asks, said before anything is done; true when the person goes on. */
export async function asks(ctx: Context, lang: string, root: string, what: string, note?: string): Promise<boolean> {
  const name = Tree.open(root, ctx.env).config.name;
  ctx.io.stdout(lines(translator(lang)("ui.link.asks", { what, name }), note, "") + "\n");
  return ctx.confirm(translator(lang)("ui.link.go"), true);
}

const out = (ctx: Context, line: string) => ctx.io.stdout(line + "\n");

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
    const cost = s.metrics?.costUsd !== undefined ? `${humanCost(s.metrics.costUsd, lang)}${s.metrics.costPartial ? "+" : ""}` : "";
    out(ctx, `  ${humanDay(s.started, lang)}  ${[agent, what, cost].filter(Boolean).join(" · ")}`);
  }
  if (all.length > shown.length) out(ctx, `  ${t("ui.link.sessions.more", { n: all.length - shown.length })}`);
}

/** A conflict the person decides: which claim holds (or their own words), and why. */
export async function decideConflict(ctx: Context, run: Run, lang: string, root: string, id: string): Promise<boolean> {
  const t = translator(lang);
  const tree = Tree.open(root, ctx.env);
  const c = tree.get<Conflict>(id);
  if (!c || c.type !== "conflict") return stop(ctx, t("ui.link.conflict.none", { id }));
  if (c.state === "resolved") return stop(ctx, t("ui.link.conflict.decided", { resolution: c.resolution ?? "" }));
  if (!(await asks(ctx, lang, root, t("ui.link.what.conflict.decide", { title: c.title })))) return false;
  const claim = (x: Conflict["claims"][number]) => `${x.value}${x.source ? ` — ${tree.get<Source>(x.source)?.title ?? x.source}` : ""}`;
  const i = await ctx.choose(t("ui.link.conflict.pick"), [...c.claims.map((x) => ({ label: claim(x) })), { label: t("ui.link.conflict.other") }], 0, { back: t("ui.browse.back") });
  if (i === undefined) return false;
  let resolution = i < c.claims.length ? `${c.claims[i]!.value}${c.claims[i]!.source ? ` (${c.claims[i]!.source})` : ""}` : "";
  if (!resolution) {
    resolution = (await ctx.ask(t("ui.link.conflict.own"))).trim();
    if (!resolution || resolution === "0") return false;
  }
  let why = "";
  while (!why) {
    why = (await ctx.ask(t("ui.link.conflict.why"))).trim();
    if (why === "0" || outOfAnswers(ctx)) return false;
  }
  if ((await run(["conflict", "resolve", id, `--resolution=${resolution}`, `--reasoning=${t("ui.link.conflict.by", { why })}`], true)) !== 0) return false;
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

/** What the research took from the Strom app, taken back on the person's word. */
export async function undoSending(ctx: Context, run: Run, lang: string, root: string, id: string): Promise<boolean> {
  const t = translator(lang);
  const input = Tree.open(root, ctx.env).get<SyncInput>(id);
  if (!input || input.type !== "input" || !input.sync) return stop(ctx, t("ui.link.sync.none", { input: id }));
  if (input.sync.undone) return stop(ctx, t("ui.link.sync.was"));
  if (!(await asks(ctx, lang, root, t("ui.link.what.sync", { day: humanDay(input.created, lang), n: input.sync.applied.length })))) return false;
  return (await run(["sync", "undo", id])) === 0;
}

/**
 * A tree of the Strom app becomes a new research (strom-research://new?app=<its mark>): named, its language and
 * agent chosen, made; the app opened to hand the tree over (?adopt=<the bridge>), the tree taken in as leads,
 * the research sent back to the app — then the conversation offered.
 */
export async function newFromApp(ctx: Context, runIn: RunIn, token: string, openAt: (url: string) => boolean, forward: () => void): Promise<boolean> {
  // strom not set up yet (the app is how this person came): the setup first
  if (!ctx.settings.home()?.value) {
    await (await runIn(undefined))(["setup"]);
    ctx.settings.reload();
    if (!ctx.settings.home()?.value) return false;
  }
  let lang = ctx.uiLang();
  let t = translator(lang);
  out(ctx, t("ui.link.new.title"));
  out(ctx, "");
  // the name; an empty research of that name (a handover that did not come) is taken again
  let name = "";
  let root: string | undefined;
  for (;;) {
    name = (await ctx.ask(t("ui.link.new.name"))).trim().replace(/\s+/gu, " ");
    if (!name || name === "0") return false;
    const same = ctx.knownTrees().find((k) => foldText(k.name) === foldText(name) || path.basename(k.root) === safeFolderName(name));
    if (!same) break;
    if (Tree.open(same.root, ctx.env).count("person") === 0) {
      root = same.root;
      break;
    }
    out(ctx, t("ui.link.new.exists", { name }));
    if (outOfAnswers(ctx)) return false;
  }
  for (;;) {
    const a = (await ctx.ask(t("ui.setup.lang"), lang)).trim().toLowerCase();
    if (a === "0") return false;
    if (isValidLang(a)) {
      lang = a;
      t = translator(lang);
      break;
    }
    if (outOfAnswers(ctx)) return false;
  }
  const here = agentsHere(ctx.env).map((a) => a.id);
  const mine = ctx.settings.agent().value;
  let agent = mine;
  if (here.length > 1) {
    const i = await ctx.choose(t("ui.setup.agent.pick"), here.map((id) => ({ label: PROFILES[id]!.name })), Math.max(0, here.indexOf(mine)), { back: t("ui.browse.back") });
    if (i === undefined) return false;
    agent = here[i]!;
  }
  if (!root) {
    let said = "";
    const code = await (await runIn(undefined))(["init", name, "--lang", lang, "--json"], true, (s) => (said += s));
    if (code !== 0) return false;
    root = (JSON.parse(said) as { root: string }).root;
  }
  const run = await runIn(root);
  if (agent !== mine) await run(["agents", "use", agent, "--for-tree"], true);

  // the app hands its tree over to the bridge of this research
  awaitAdoption(root, token);
  const info = startLive(root, ctx.env, { current: true });
  if (!info) throw new StromError("the bridge did not start", { hint: "strom live serve shows why" });
  const url = adoptAppUrl(info.url, ctx.settings);
  const since = Date.now();
  const waitMs = Number(ctx.env.STROM_ADOPT_WAIT_MS ?? 30 * 60_000);
  const minutes = Math.max(1, Math.round(waitMs / 60_000));
  out(ctx, openAt(url) ? `${t("ui.link.new.wait", { min: minutes })}\n${t("ui.sync.wait.open", { url })}` : t("ui.app.url", { url }));
  let file: string | undefined;
  while (Date.now() < since + waitMs) {
    file = adoptedSince(root, since);
    if (file) break;
    const failed = adoptFailedSince(root, since);
    if (failed) {
      forward();
      return stop(ctx, t(failed === "empty" ? "ui.link.new.empty" : "ui.link.new.failed", { name }));
    }
    if (nothingSince(root, since)) {
      forward();
      out(ctx, t("ui.link.new.none", { name }));
      return false;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  forward();
  if (!file) return stop(ctx, t("ui.link.new.waited", { name, min: minutes }));

  // the family's tree, as leads (without the images written into it: the research keeps its own)
  const { withoutImages } = await import("../commands/sync.ts");
  const kept = path.join(path.dirname(file), `${safeFolderName(name)}.ged`);
  fs.writeFileSync(kept, withoutImages(fs.readFileSync(file, "utf8")));
  if ((await run(["intake", kept], true)) !== 0) return false;
  const tree = Tree.open(root, ctx.env);
  out(ctx, t("ui.link.new.taken", { name, persons: tree.count("person"), families: tree.count("family") }));
  // the research as it is now back into the app's window: the same tree, now of the research
  if ((await run(["app"], true)) === 0) out(ctx, t("ui.link.new.back"));
  await offerChat(ctx, run, lang, root, t("ui.link.new.chat"), t("ui.link.new.say"));
  return true;
}

