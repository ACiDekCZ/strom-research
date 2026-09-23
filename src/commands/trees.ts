// init · trees · status · lang — trees (one folder per family tree).

import fs from "node:fs";
import path from "node:path";
import { waitingLines } from "./tasks.ts";
import { register } from "../cli/registry.ts";
import { Context } from "../cli/context.ts";
import { lines, table } from "../cli/format.ts";
import { Tree } from "../core/tree.ts";
import { safeFolderName } from "../core/text.ts";
import { isValidLang, langName } from "../core/lang.ts";
import { UsageError } from "../core/errors.ts";
import { verifyFast } from "../core/integrity.ts";
import * as git from "../core/git.ts";
import type { Research } from "../core/model.ts";
import { ensureShared, setTreeSetting } from "./setup.ts";
import { syncAgentFiles } from "../agents/files.ts";

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
