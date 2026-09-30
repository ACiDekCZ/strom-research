// init · trees · status · lang — trees (one folder per family tree).

import fs from "node:fs";
import path from "node:path";
import { waitingLines } from "./tasks.ts";
import { register } from "../cli/registry.ts";
import { Context } from "../cli/context.ts";
import { lines, table } from "../cli/format.ts";
import { Tree } from "../core/tree.ts";
import { foldText, safeFolderName } from "../core/text.ts";
import { isValidLang, langName } from "../core/lang.ts";
import { NeedsConsentError, UsageError } from "../core/errors.ts";
import { verifyFast } from "../core/integrity.ts";
import * as git from "../core/git.ts";
import type { Research } from "../core/model.ts";
import { ensureShared, setTreeSetting } from "./setup.ts";
import { syncAgentFiles } from "../agents/files.ts";
import { ui } from "../cli/ui.ts";
import { atWork } from "../core/relocate.ts";
import { moveToTrash } from "../core/trash.ts";
import { stopLive } from "../core/live.ts";
import { onlyItsFiles, packPlan } from "../core/pack.ts";
import { defaultPackFile, packTree } from "./pack.ts";

register({
  path: ["init"],
  summary: "Create a family tree (a folder with its own history) to hold researches",
  group: "research",
  description: "The tree goes into the trees folder unless --dir is given. One tree = one family = one tree in the Strom app.",
  args: [{ name: "name", description: 'tree name, e.g. "Novákovi"', required: true }],
  options: [{ name: "dir", type: "string", value: "<folder>", description: "create the tree in this folder instead" }],
  examples: ['strom init "Novákovi"', 'strom init "Novákovi" --lang cs', 'strom init "Dvořákovi" --dir "~/Rodokmeny/Dvořákovi"'],
  run: async (ctx, { args, opts }) => {
    const name = args[0]!.trim();
    if (!name) throw new UsageError("the tree needs a name");
    await ctx.requireHome();
    const treesDir = ctx.settings.trees()!.value;
    const root = opts.dir ? ctx.resolvePath(opts.dir as string) : path.join(treesDir, safeFolderName(name));
    const langR = ctx.settings.lang();
    const lang = langR.value;
    fs.mkdirSync(treesDir, { recursive: true });
    ensureShared(ctx.settings.shared()!.value);
    const tree = Tree.create(root, name, lang, ctx.env);
    const agentFiles = syncAgentFiles(tree);
    tree.withTreeLock(() => tree.commit(`Agent instructions: ${agentFiles.join(", ")}`, agentFiles));
    if (path.dirname(root) !== treesDir) {
      const extra = new Set(ctx.settings.config.extraTrees ?? []);
      extra.add(root);
      ctx.settings.config.extraTrees = [...extra];
      ctx.settings.save();
    }
    ctx.adopt(tree);
    const text = lines(
      `Created tree "${name}" in ${ctx.display(root)}`,
      `research language: ${langName(lang)} (${lang})${langR.source === "detected" ? " — detected from the system; if the user speaks another language: strom lang <code>" : ""}`,
      "",
      `next   strom research new "<research name>" --new-person "<Given /Surname/>" --born "<date>" --born-place "<place>"`,
    );
    return { text, data: { name, root, lang } };
  },
});

register({
  path: ["trees"],
  summary: "List the family trees Strom knows",
  group: "research",
  run(ctx) {
    const trees = ctx.knownTrees().map((t) => {
      const tree = Tree.open(t.root, ctx.env);
      return {
        ...t,
        persons: tree.count("person"),
        researches: tree.list<Research>("research").length,
      };
    });
    if (trees.length === 0) return { text: 'no trees yet → strom init "<tree name>"', data: { trees } };
    const text = table(
      trees.map((t) => [t.name, t.lang, `${t.persons} persons`, `${t.researches} researches`, ctx.display(t.root)]),
    );
    return { text, data: { trees } };
  },
});

register({
  path: ["trees", "use"],
  summary: "Work on this tree from now on, wherever you are (remembered for you)",
  group: "research",
  description: "Commands find the tree by --tree, STROM_TREE, the folder you are in, this choice, or the only tree there is.",
  args: [{ name: "tree", description: "tree name or folder", required: true }],
  examples: ['strom trees use "Novákovi"'],
  run(ctx, { args }) {
    const probe = Context.fromOptions({ env: ctx.env, cwd: ctx.cwd, io: ctx.io, json: ctx.json, values: { tree: args[0]! } });
    const root = probe.locateTree()!;
    ctx.settings.config.currentTree = root;
    ctx.settings.save();
    const tree = Tree.open(root, ctx.env);
    return { text: `now working on "${tree.config.name}" (${ctx.display(root)})`, data: { name: tree.config.name, root } };
  },
});

register({
  path: ["trees", "remove"],
  summary: "Take a family tree off this computer — into the system's trash, a backup offered first (the person runs this)",
  group: "research",
  description:
    "Offers a backup first (strom pack --all-images: it comes back with strom unpack), then the images no other tree\n" +
    "uses; the person types the tree's name to confirm. The tree's folder goes into the system's trash (never deleted\n" +
    "for good), so do the images they chose. Never while somebody works on it; only the person at the computer —\n" +
    "never an agent.",
  args: [{ name: "tree", description: "tree name or folder", required: true }],
  examples: ['strom trees remove "Novákovi"'],
  async run(ctx, { args }) {
    const lang = ctx.uiLang();
    const probe = Context.fromOptions({ env: ctx.env, cwd: ctx.cwd, io: ctx.io, json: ctx.json, values: { tree: args[0]! } });
    const root = probe.locateTree()!;
    if (!ctx.interactive) throw new NeedsConsentError([{ key: "remove", kind: "consent", question: ui(lang, "ui.remove.person"), set: `strom trees remove "${root}"` }]);
    const tree = Tree.open(root, ctx.env);
    const name = tree.config.name;
    // the Strom app following it live is no work: its bridge only reads, and stops before the tree goes
    if (atWork(root, { bridge: false })) throw new UsageError(ui(lang, "ui.remove.busy", { name }), { hint: "strom" });
    const shared = ctx.settings.shared()!.value;
    const others = ctx.knownTrees().map((k) => k.root).filter((r) => path.resolve(r) !== path.resolve(root));
    const only = onlyItsFiles(root, others, shared);
    const onlyBytes = only.reduce((s, f) => s + f.size, 0);
    const mb = (b: number) => (b / 1e6 < 10 ? (b / 1e6).toFixed(1) : Math.round(b / 1e6).toString());
    ctx.io.stdout(ui(lang, "ui.remove.what", { name, root: ctx.display(root), persons: tree.list("person").length }) + "\n");
    // a way back first
    let backup: string | undefined;
    const all = packPlan(tree, shared, true).media.reduce((s, m) => s + m.size, 0);
    if (await ctx.confirm(ui(lang, "ui.remove.backup", { mb: mb(all) }), true)) {
      const out = defaultPackFile(ctx, tree);
      backup = packTree(tree, shared, out, true).file;
      ctx.io.stdout(ui(lang, "ui.remove.backup.done", { file: ctx.display(backup) }) + "\n");
    }
    const images = only.length > 0 && (await ctx.confirm(ui(lang, "ui.remove.images", { n: only.length, mb: mb(onlyBytes) }), backup !== undefined));
    const typed = (await ctx.ask(ui(lang, "ui.remove.type", { name }))).trim();
    if (!typed || foldText(typed) !== foldText(name)) return { text: ui(lang, "ui.remove.cancelled"), data: { removed: false, ...(backup ? { backup } : {}) } };
    if (atWork(root, { bridge: false })) throw new UsageError(ui(lang, "ui.remove.busy", { name }), { hint: "strom" });
    const followed = stopLive(root, "the family tree is taken off this computer");
    moveToTrash(root, ctx.env, path.basename(root));
    let moved = 0;
    if (images) {
      // the images together, one folder in the trash named after the tree
      const folder = path.join(shared, `.${safeFolderName(name) || "tree"}-${Date.now()}`);
      for (const f of only) {
        const to = path.join(folder, ...f.file.split("/"));
        fs.mkdirSync(path.dirname(to), { recursive: true });
        fs.renameSync(path.join(shared, ...f.file.split("/")), to);
        moved++;
      }
      moveToTrash(folder, ctx.env, ui(lang, "ui.remove.images.folder", { name }));
    }
    const cfg = ctx.settings.config;
    if (cfg.extraTrees) cfg.extraTrees = cfg.extraTrees.filter((r) => path.resolve(r) !== path.resolve(root));
    // the tree worked on went: the next one known is worked on now, never a menu with none chosen
    let next: string | undefined;
    if (cfg.currentTree && path.resolve(cfg.currentTree) === path.resolve(root)) {
      const left = ctx.knownTrees().filter((k) => path.resolve(k.root) !== path.resolve(root));
      if (left.length) {
        cfg.currentTree = left[0]!.root;
        next = left[0]!.name;
      } else delete cfg.currentTree;
    }
    ctx.settings.save();
    const text = lines(
      ui(lang, "ui.remove.done", { name }),
      followed ? ui(lang, "ui.remove.live") : undefined,
      moved ? ui(lang, "ui.remove.images.done", { n: moved, mb: mb(onlyBytes) }) : undefined,
      backup ? ui(lang, "ui.remove.backup.back", { file: ctx.display(backup) }) : undefined,
      ui(lang, backup ? "ui.remove.trash" : "ui.remove.trash.alone"),
      next ? ui(lang, "ui.remove.next", { name: next }) : undefined,
    );
    return { text, data: { removed: true, root, images: moved, ...(backup ? { backup } : {}), ...(next ? { current: cfg.currentTree } : {}) } };
  },
});

register({
  path: ["status"],
  summary: "State of the current tree: researches, data, checks, recent changes",
  group: "start",
  tree: true,
  run(ctx) {
    const tree = ctx.tree();
    const researches = tree.list<Research>("research");
    const findings = verifyFast(tree).findings;
    const errors = findings.filter((f) => f.level === "error");
    const recent = git.log(tree.root, 5);
    const text = lines(
      `${tree.config.name} — ${langName(tree.config.lang)} (${tree.config.lang}) — ${ctx.display(tree.root)}`,
      `data   ${tree.count("person")} persons · ${tree.count("family")} families · ${researches.length} researches`,
      `check  ${errors.length === 0 ? "ok" : `${errors.length} errors → strom check`}${findings.length - errors.length ? ` · ${findings.length - errors.length} warnings` : ""}`,
      researches.length ? "research\n" + table(researches.map((r) => [`  ${r.id}`, r.name, `[${r.state}]`])) : undefined,
      waitingLines(tree, { shared: ctx.settings.shared()?.value, display: (p) => ctx.display(p) }),
      recent.length ? "recent\n" + table(recent.map((c) => [`  ${c.at.slice(0, 16).replace("T", " ")}`, c.subject])) : undefined,
    );
    return {
      text,
      data: {
        tree: { name: tree.config.name, root: tree.root, lang: tree.config.lang },
        counts: { persons: tree.count("person"), families: tree.count("family"), researches: researches.length },
        researches: researches.map((r) => ({ id: r.id, name: r.name, state: r.state })),
        findings,
        recent,
      },
    };
  },
});

register({
  path: ["lang"],
  summary: "Show or change the research language of the current tree",
  group: "research",
  tree: true,
  description: "The agent talks to the user and writes research texts in this language. CLI output stays English.",
  args: [{ name: "code", description: "new language code, e.g. cs, en, de" }],
  examples: ["strom lang", "strom lang de"],
  run(ctx, { args }) {
    const tree = ctx.tree();
    if (args[0]) {
      const code = args[0].toLowerCase();
      if (!isValidLang(code)) throw new UsageError(`invalid language code "${args[0]}"`, { hint: "use a code like cs, en, de" });
      // Same as `strom config set lang <code> --for-tree`: logged, committed, agent files follow.
      setTreeSetting(ctx, "lang", code);
    }
    const lang = tree.config.lang;
    return { text: `${langName(lang)} (${lang})`, data: { lang, name: langName(lang) } };
  },
});
