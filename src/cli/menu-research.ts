// The menu's "Add to the research": material from the family (strom intake), a
// new direction (strom research new), one person looked at again (strom review).
// Each an ordinary command; what the person reads is in their language, and the
// agent takes it up in the next conversation or run.

import fs from "node:fs";
import path from "node:path";
import type { Context } from "./context.ts";
import { agentReady, droppedPaths, pause, pickPerson, subMenu, translator, type Item, type Run } from "./menu-parts.ts";
import { Tree } from "../core/tree.ts";
import type { Research, Task } from "../core/model.ts";
import { displayName } from "../core/people.ts";
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
    if (Tree.open(root, ctx.env).count("person") > 0) items.push({ key: "3", label: t("ui.menu.review"), act: async () => void (await reviewPerson(ctx, run, lang, root)) });
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
  // The same research again (this person, this direction, still going): said which one it is, nothing made.
  const focus = who[0] === "--person" ? who[1] : undefined;
  const same =
    focus && direction !== "question"
      ? Tree.open(root, ctx.env)
          .list<Research>("research")
          .find((r) => r.focus === focus && r.direction === direction && r.state === "active")
      : undefined;
  if (same) return void ctx.io.stdout(t("ui.research.exists", { name: same.name }) + "\n");
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
  await offerChat(ctx, run, lang, root, t("ui.research.chat"), t("ui.research.say", { name: made.name }));
}

/** One person, looked at again: what the tree says of them elsewhere, what to read whole, what to check. */
async function reviewPerson(ctx: Context, run: Run, lang: string, root: string): Promise<void> {
  const t = translator(lang);
  const person = await pickPerson(ctx, lang, root, t("ui.review.who"));
  if (!person) return;
  const family = await ctx.confirm(t("ui.review.family"), false);
  if ((await run(["review", person.id, ...(family ? ["--scope", "family"] : [])])) !== 0) return pause(ctx, lang);
  const tree = Tree.open(root, ctx.env);
  const research = tree.list<Research>("research").find((r) => r.direction === "person" && r.focus === person.id && r.review);
  const open = research ? tree.list<Task>("task").filter((x) => x.research === research.id && x.state === "open").length : 0;
  if (research && open && (await ctx.confirm(t("ui.review.run", { n: open }), false))) await run(["run", "--research", research.id, "--max", String(open)]);
  await pause(ctx, lang);
}
