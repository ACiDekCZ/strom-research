// The menu's "Add to the research": material from the family (strom intake), a
// new direction (strom research new), one person looked at again (strom review).
// Each an ordinary command; what the person reads is in their language, and the
// agent takes it up in the next conversation or run.

import fs from "node:fs";
import path from "node:path";
import type { Context } from "./context.ts";
import { agentReady, droppedPaths, outOfAnswers, pause, pickPerson, subMenu, translator, type Item, type Run } from "./menu-parts.ts";
import { Tree } from "../core/tree.ts";
import { directionOf, scopes } from "../core/directions.ts";
import type { UIKey } from "./ui.ts";
import type { Research, Task } from "../core/model.ts";
import { displayName, lifespan } from "../core/people.ts";
import { DEATH_AFTER_YEARS, unprovenPeople } from "../core/review.ts";
import { planSync, readTreeFile, receivedSince } from "../core/sync.ts";
import { appSendsChanges, stromAppState } from "../core/stromapp.ts";
import { UNPROVEN_BATCH } from "../commands/research.ts";
import { expandHome } from "../core/paths.ts";
import { collectFiles } from "../core/media.ts";
import { BOOK_OF_SCANS, IMAGE_EXT } from "../commands/intake.ts";

export async function addToResearch(ctx: Context, run: Run, lang: string, root: string): Promise<void> {
  const t = translator(lang);
  await subMenu(ctx, lang, () => {
    const items: Item[] = [
      { key: "1", label: t("ui.more.intake"), act: async () => void (await addMaterial(ctx, run, lang, root)) },
      { key: "2", label: t("ui.more.research"), act: async () => void (await newResearch(ctx, run, lang, root)) },
    ];
    const tree = Tree.open(root, ctx.env);
    if (tree.count("person") > 0) {
      items.push({ key: "3", label: t("ui.menu.review"), act: async () => void (await reviewPerson(ctx, run, lang, root)) });
      items.push({ key: "4", label: t(noApp(ctx) ? "ui.more.sync.noapp" : "ui.more.sync"), act: async () => void (await syncTree(ctx, run, lang, root)) });
    }
    if (tree.count("research") > 0) items.push({ key: "5", label: t("ui.more.directions"), act: async () => void (await directions(ctx, run, lang, root)) });
    // only when there are some: the people no record of their own proves — last, it shows only sometimes
    const unproven = unprovenPeople(tree).filter((u) => !u.living).length;
    if (unproven) items.push({ key: String(items.length + 1), label: t("ui.menu.unproven", { n: unproven }), act: async () => void (await reviewUnproven(ctx, run, lang, root)) });
    return { title: t("ui.more.title"), items };
  });
}

/** Files, folders or what the person knows, as inputs of the research; the agent reads them in its next work. */
async function addMaterial(ctx: Context, run: Run, lang: string, root: string): Promise<void> {
  const t = translator(lang);
  const out = (line: string) => ctx.io.stdout(line + "\n");
  const how = await ctx.choose(t("ui.intake.what"), [{ label: t("ui.intake.files") }, { label: t("ui.intake.text") }], 0, { back: t("ui.browse.back") });
  if (how === undefined) return;
  let argv: string[];
  if (how === 1) {
    const text = (await ctx.ask(t("ui.intake.write"))).trim();
    if (!text || text === "0") return;
    argv = ["intake", `--text=${text}`]; // the person's words, whatever they start with
  } else {
    let paths = await askPaths(ctx, lang, root);
    if (!paths) return;
    // Nothing to take in (an empty folder, hidden files only): said so.
    if (!collectFiles(paths).length) return void out(t("ui.intake.empty"));
    // A folder of many images is the scans of a book: those go to a record set, which the agent makes in a conversation —
    // the rest is taken in.
    const scans = paths
      .filter((p) => fs.statSync(p).isDirectory())
      .map((p) => ({ p, n: collectFiles([p]).filter((f) => IMAGE_EXT.has(path.extname(f).toLowerCase())).length }))
      .filter((x) => x.n > BOOK_OF_SCANS);
    let documents = false;
    for (const s of scans) {
      if (await ctx.confirm(t("ui.intake.scans", { folder: path.basename(s.p), n: s.n }), false)) documents = true;
      else {
        out(t("ui.intake.book", { folder: path.basename(s.p) }));
        paths = paths.filter((p) => p !== s.p);
      }
    }
    if (!paths.length) return;
    argv = ["intake", ...paths, ...(documents ? ["--documents"] : [])];
  }
  const before = Tree.open(root, ctx.env).count("input");
  if ((await run(argv, true)) !== 0) return;
  const added = Tree.open(root, ctx.env).count("input") - before;
  if (!added) return void out(t("ui.intake.known"));
  out(t("ui.intake.done", { n: added }));
  await offerChat(ctx, run, lang, root, t("ui.intake.chat"), t("ui.intake.say"));
}

/** On with the agent now — when there is one; else it is said that the agent takes it up once it is here. */
export async function offerChat(ctx: Context, run: Run, lang: string, root: string, question: string, say: string): Promise<void> {
  if (!agentReady(ctx, Tree.open(root, ctx.env).config)) return void ctx.io.stdout(translator(lang)("ui.more.noagent") + "\n");
  if (await ctx.confirm(question, true)) await run(["chat", "--say", say]);
}

/** Paths typed or dropped in, each one there and none of strom's own; asked again until they are, nothing (Enter, 0): undefined. */
async function askPaths(ctx: Context, lang: string, root: string): Promise<string[] | undefined> {
  const t = translator(lang);
  const own = [root, ctx.settings.home()?.value].filter((d): d is string => Boolean(d));
  const inside = (p: string, dir: string) => {
    const rel = path.relative(dir, p);
    return !rel.startsWith("..") && !path.isAbsolute(rel);
  };
  for (;;) {
    if (ctx.io.answers !== undefined && ctx.io.answers.length === 0) return undefined;
    const answer = (await ctx.ask(t("ui.intake.path"))).trim();
    if (!answer || answer === "0") return undefined;
    const resolve = (p: string) => path.resolve(ctx.cwd, expandHome(p, ctx.env));
    let paths = droppedPaths(answer).map(resolve);
    // one path with spaces, typed without quotes
    if (paths.some((p) => !fs.existsSync(p)) && fs.existsSync(resolve(answer))) paths = [resolve(answer)];
    const missing = paths.filter((p) => !fs.existsSync(p));
    // strom's own folders (the research, its home) are not material of the family: they would be copied into themselves
    const ours = paths.filter((p) => own.some((d) => inside(p, d) || inside(d, p)));
    if (ours.length) ctx.io.stdout(t("ui.intake.ours", { path: ctx.display(ours[0]!) }) + "\n");
    else if (!missing.length && paths.length) return paths;
    else ctx.io.stdout(t("ui.intake.missing", { path: missing.map((p) => ctx.display(p)).join(", ") || answer }) + "\n");
  }
}

/** A new direction: the ancestors or the descendants of someone, or one question — and what the person knows of it. */
async function newResearch(ctx: Context, run: Run, lang: string, root: string): Promise<void> {
  const t = translator(lang);
  const kinds = ["ancestors", "descendants", "question"] as const;
  const k = await ctx.choose(t("ui.research.kind"), [{ label: t("ui.research.ancestors") }, { label: t("ui.research.descendants") }, { label: t("ui.research.question") }], 0, {
    back: t("ui.browse.back"),
  });
  if (k === undefined) return;
  const direction = kinds[k]!;
  let question: string | undefined;
  if (direction === "question") {
    question = (await ctx.ask(t("ui.research.ask"))).trim();
    if (!question || question === "0") return;
  }
  // Whom: someone in the tree, or a new person (a name and sex; what else is known goes in as the person's words).
  const people = Tree.open(root, ctx.env).count("person") > 0;
  const inTree = people ? await ctx.choose(t("ui.research.whom"), [{ label: t("ui.research.known") }, { label: t("ui.research.newperson") }], 0, { back: t("ui.browse.back") }) : 1;
  if (inTree === undefined) return;
  let who: string[];
  let name: string;
  if (inTree === 0) {
    const p = await pickPerson(ctx, lang, root, t("ui.review.who"));
    if (!p) return;
    who = ["--person", p.id];
    name = displayName(p);
  } else {
    name = (await ctx.ask(t("ui.research.name"))).trim().replace(/\s+/gu, " ");
    if (!name || name === "0") return;
    const sex = await ctx.choose(t("ui.research.sex"), [{ label: t("ui.research.male") }, { label: t("ui.research.female") }, { label: t("ui.research.unknown") }], 2, { back: t("ui.browse.back") });
    if (sex === undefined) return;
    who = [`--new-person=${name}`, "--sex", ["M", "F", "U"][sex]!];
  }
  await startDirection(ctx, run, lang, root, direction, who, name, question);
}

/**
 * A new direction for someone chosen (the menu, a link of the Strom app): its title and what the person knows of
 * it asked, the research made; the same research still going is only named.
 */
export async function startDirection(ctx: Context, run: Run, lang: string, root: string, direction: "ancestors" | "descendants" | "question", who: string[], name: string, question?: string): Promise<void> {
  const t = translator(lang);
  // The same research again (this person, this direction, still going): said which one it is, nothing made.
  const focus = who[0] === "--person" ? who[1] : undefined;
  const same =
    focus && direction !== "question"
      ? Tree.open(root, ctx.env)
          .list<Research>("research")
          .find((r) => r.focus === focus && r.direction === direction && r.state === "active")
      : undefined;
  if (same) return void ctx.io.stdout(t("ui.research.exists", { name: same.name }) + "\n");
  // …paused or ended: taken up again rather than made twice
  const stopped = focus && direction !== "question" ? Tree.open(root, ctx.env).list<Research>("research").find((r) => r.focus === focus && r.direction === direction) : undefined;
  if (stopped) {
    if (await ctx.confirm(t("ui.research.resume", { name: stopped.name, state: t(`ui.dirs.${stopped.state}` as UIKey) }))) await setDirection(ctx, run, lang, root, stopped, "resume");
    return;
  }
  const suggested = question ?? t(direction === "ancestors" ? "ui.research.title.ancestors" : "ui.research.title.descendants", { name });
  const title = (await ctx.ask(t("ui.research.title"), suggested)).trim();
  if (title === "0") return;
  const knows = (await ctx.ask(t("ui.research.knows"))).trim();
  const before = new Set(
    Tree.open(root, ctx.env)
      .list<Research>("research")
      .map((r) => r.id),
  );
  if ((await run(["research", "new", ...who, "--direction", direction, ...(question ? [`--question=${question}`] : []), "--", title || suggested], true)) !== 0) return;
  const made = Tree.open(root, ctx.env)
    .list<Research>("research")
    .find((r) => !before.has(r.id));
  if (!made) return;
  if (knows && knows !== "0") await run(["intake", `--text=${knows}`, "--research", made.id], true);
  ctx.io.stdout(t("ui.research.done", { name: made.name }) + "\n");
  await offerChat(ctx, run, lang, root, t("ui.research.chat"), t("ui.research.say", { name: made.name, id: made.id }));
}

/** A direction's tasks not finished: open, at work, put aside or waiting for the user. */
export function directionTasks(tree: Tree, research: string): number {
  const all = scopes(tree);
  return tree.list<Task>("task").filter((x) => ["open", "doing", "parked", "waiting"].includes(x.state) && directionOf(tree, x, all) === research).length;
}

/** The directions of the research, each with how it goes and its tasks: one paused, ended or taken up again. */
async function directions(ctx: Context, run: Run, lang: string, root: string): Promise<void> {
  const t = translator(lang);
  const tree = Tree.open(root, ctx.env);
  const all = tree.list<Research>("research");
  const label = (r: Research) => t("ui.dirs.item", { name: r.name, state: t(`ui.dirs.${r.state}` as UIKey), n: directionTasks(tree, r.id) });
  const i = await ctx.choose(t("ui.dirs.pick"), all.map((r) => ({ label: label(r) })), all.length, { back: t("ui.browse.back") });
  if (i === undefined) return;
  const r = all[i]!;
  const acts = r.state === "active" ? (["pause", "done"] as const) : r.state === "paused" ? (["resume", "done"] as const) : (["resume"] as const);
  const a = await ctx.choose(t("ui.dirs.what", { name: r.name }), acts.map((x) => ({ label: t(`ui.dirs.do.${x}` as UIKey) })), acts.length, { back: t("ui.browse.back") });
  if (a === undefined) return;
  await setDirection(ctx, run, lang, root, r, acts[a]!);
}

/** A direction paused, ended or taken up again (with the person's reason), and what that means for its tasks. */
export async function setDirection(ctx: Context, run: Run, lang: string, root: string, r: Research, act: "pause" | "resume" | "done", reason?: string): Promise<void> {
  const t = translator(lang);
  if ((await run(["research", act, r.id, ...(reason ? [`--reason=${reason}`] : [])], true)) !== 0) return;
  const state = act === "pause" ? "paused" : act === "resume" ? "active" : "done";
  ctx.io.stdout(t(`ui.dirs.${state}.now` as UIKey, { name: r.name, n: directionTasks(Tree.open(root, ctx.env), r.id) }) + "\n");
}

/** The person said no to the Strom app: it is not named. */
const noApp = (ctx: Context) => stromAppState(ctx.settings) === "no";

/** A family tree coming back (the Strom app, another program): what changed in it, shown, then written on the person's word. */
async function syncTree(ctx: Context, run: Run, lang: string, root: string): Promise<void> {
  const t = translator(lang);
  let file: string | undefined;
  // straight from the Strom app, where it can send the tree (and the person wants it)
  if (!noApp(ctx) && appSendsChanges(ctx.settings)) {
    const from = await ctx.choose(t("ui.sync.from"), [{ label: t("ui.sync.from.app") }, { label: t("ui.sync.from.file") }], 0, { back: t("ui.browse.back") });
    if (from === undefined) return;
    if (from === 0) return syncFromApp(ctx, run, lang, root);
  }
  for (;;) {
    if (outOfAnswers(ctx)) return;
    const answer = (await ctx.ask(t(noApp(ctx) ? "ui.sync.path.noapp" : "ui.sync.path"))).trim();
    if (!answer || answer === "0") return;
    const resolve = (p: string) => path.resolve(ctx.cwd, expandHome(p, ctx.env));
    const dropped = droppedPaths(answer).map(resolve);
    file = [dropped[0], resolve(answer)].find((p): p is string => !!p && fs.existsSync(p) && fs.statSync(p).isFile());
    if (file) break;
    ctx.io.stdout(t("ui.intake.missing", { path: answer }) + "\n");
  }
  // what it would take, asked first: nothing to write — nothing asked
  let count: number;
  try {
    const tree = Tree.open(root, ctx.env);
    count = planSync(tree, readTreeFile(file), ctx.settings.syncEdits(tree.config)).changes.length;
  } catch {
    count = 0;
  }
  if ((await run(["sync", file])) !== 0 || !count) return pause(ctx, lang);
  return confirmSync(ctx, run, lang, root, file, count);
}

/** The tree straight from the Strom app (the menu, or a strom-research://send link): shown, then written on the person's word. */
export async function syncFromApp(ctx: Context, run: Run, lang: string, root: string, enter: "ui.enter" | "ui.enter.close" = "ui.enter", back?: () => void): Promise<void> {
  const since = Date.now();
  const code = await run(["sync", "--app"]);
  // the person is in the app: what came of it is here (a terminal opened for a link brings itself forward)
  back?.();
  if (code !== 0) return pause(ctx, lang, enter);
  const file = receivedSince(root, since);
  if (!file) return pause(ctx, lang, enter);
  return confirmSync(ctx, run, lang, root, file, undefined, enter);
}

/** What the tree brings is shown: written on the person's word — all, or the ones they pick. */
async function confirmSync(ctx: Context, run: Run, lang: string, root: string, file: string, known?: number, enter: "ui.enter" | "ui.enter.close" = "ui.enter"): Promise<void> {
  const t = translator(lang);
  let count = known ?? 0;
  if (known === undefined)
    try {
      const tree = Tree.open(root, ctx.env);
      count = planSync(tree, readTreeFile(file), ctx.settings.syncEdits(tree.config)).changes.length;
    } catch {
      count = 0;
    }
  if (!count) return pause(ctx, lang, enter);
  const how = await ctx.choose(t("ui.sync.how"), [{ label: t("ui.sync.all") }, { label: t("ui.sync.some") }], 0, { back: t("ui.browse.back") });
  if (how === undefined) return;
  let only: string[] = [];
  if (how === 1) {
    const picked = await pickNumbers(ctx, lang, Array.from({ length: count }, (_, i) => String(i + 1)));
    if (!picked?.length) return;
    only = ["--only", picked.map((i) => i + 1).join(",")];
  }
  if ((await run(["sync", file, "--apply", ...only])) === 0 && !noApp(ctx)) ctx.io.stdout(t("ui.sync.app") + "\n");
  await pause(ctx, lang, enter);
}

/** The people no record of their own proves: listed, then all of them a batch at a time, or the ones picked by number. */
async function reviewUnproven(ctx: Context, run: Run, lang: string, root: string): Promise<void> {
  const t = translator(lang);
  const out = (line: string) => ctx.io.stdout(line + "\n");
  const tree = Tree.open(root, ctx.env);
  const found = unprovenPeople(tree);
  const all = found.filter((u) => !u.living);
  const living = found.filter((u) => u.living);
  const open = tree.list<Task>("task").filter((x) => ["open", "doing", "parked", "waiting"].includes(x.state));
  out(t("ui.unproven.title"));
  all.forEach((u, i) => {
    const busy = open.some((x) => x.subject.includes(u.person.id));
    const life = lifespan(u.person);
    out(`  ${String(i + 1).padStart(2)}. ${u.person.id} ${displayName(u.person)}${life ? ` (${life})` : ""} — ${t(`ui.unproven.${u.kind}`)}${busy ? ` · ${t("ui.unproven.tasks")}` : ""}`);
  });
  if (living.length) out(t("ui.unproven.living", { years: DEATH_AFTER_YEARS, names: living.map((u) => `${u.person.id} ${displayName(u.person)}`).join(", ") }));
  const how = await ctx.choose(t("ui.unproven.how"), [{ label: t("ui.unproven.all", { n: UNPROVEN_BATCH }) }, { label: t("ui.unproven.pick") }], 0, { back: t("ui.browse.back") });
  if (how === undefined) return;
  let argv: string[];
  if (how === 0) argv = ["review", "--unproven"];
  else {
    const picked = await pickNumbers(ctx, lang, all.map((u) => u.person.id));
    if (!picked?.length) return;
    argv = ["review", ...picked.map((i) => all[i]!.person.id)];
  }
  if ((await run(argv)) !== 0) return pause(ctx, lang);
  const after = Tree.open(root, ctx.env);
  const ids = argv.slice(1).filter((a) => a.startsWith("P"));
  const research = after
    .list<Research>("research")
    .find((r) => r.direction === "person" && r.state === "active" && (ids.length ? r.review?.people?.length === ids.length && ids.every((id) => r.review!.people!.includes(id)) : r.review?.unproven));
  const waiting = research ? after.list<Task>("task").filter((x) => x.research === research.id && x.state === "open").length : 0;
  if (research && waiting && (await ctx.confirm(t("ui.review.run", { n: waiting }), false))) await run(["run", "--research", research.id, "--max", String(waiting)]);
  await pause(ctx, lang);
}

/** Numbers of a list as a person types them: "1 3 5-7", "2,4", or the IDs shown ("P0012"); each once, in their order. Undefined: back. */
async function pickNumbers(ctx: Context, lang: string, ids: string[]): Promise<number[] | undefined> {
  const count = ids.length;
  const t = translator(lang);
  for (;;) {
    const answer = (await ctx.ask(t("ui.unproven.numbers"))).trim();
    if (!answer || answer === "0") return undefined;
    const out: number[] = [];
    const bad: string[] = [];
    for (const part of answer.split(/[\s,;]+/u).filter(Boolean)) {
      const id = ids.indexOf(part.toUpperCase());
      if (id >= 0) {
        if (!out.includes(id)) out.push(id);
        continue;
      }
      const m = /^(\d+)(?:\s*[-–]\s*(\d+))?$/u.exec(part);
      const from = m ? Number(m[1]) : NaN;
      const to = m?.[2] ? Number(m[2]) : from;
      if (!m || from < 1 || to > count || to < from) bad.push(part);
      else for (let i = from; i <= to; i++) if (!out.includes(i - 1)) out.push(i - 1);
    }
    if (!bad.length) return out;
    ctx.io.stdout(t("ui.unproven.bad", { x: bad.join(", ") }) + "\n");
  }
}

/** One person, looked at again: what the tree says of them elsewhere, what to read whole, what to check. */
async function reviewPerson(ctx: Context, run: Run, lang: string, root: string): Promise<void> {
  const t = translator(lang);
  const person = await pickPerson(ctx, lang, root, t("ui.review.who"));
  if (!person) return;
  const family = await ctx.confirm(t("ui.review.family"), false);
  await reviewOne(ctx, run, lang, root, person.id, family ? "family" : "person");
  await pause(ctx, lang);
}

/** One person's review (the menu, a link of the Strom app), then the agent offered for its tasks — the person's choice, no suggested. */
export async function reviewOne(ctx: Context, run: Run, lang: string, root: string, person: string, scope: "person" | "family" | "line"): Promise<void> {
  const t = translator(lang);
  if ((await run(["review", person, ...(scope !== "person" ? ["--scope", scope] : [])])) !== 0) return;
  const tree = Tree.open(root, ctx.env);
  const research = tree.list<Research>("research").find((r) => r.direction === "person" && r.focus === person && r.review && !r.review.people);
  const open = research ? tree.list<Task>("task").filter((x) => x.research === research.id && x.state === "open").length : 0;
  if (research && open && (await ctx.confirm(t("ui.review.run", { n: open }), false))) await run(["run", "--research", research.id, "--max", String(open)]);
}
