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
import { compactHistory } from "../core/history.ts";
import { globalTargets, installGlobal } from "../agents/global.ts";
import { agentsHere } from "../core/apps.ts";
import { placeholders, ui, type UIKey } from "../cli/ui.ts";
import { mb, setTidyOn, tidy, tidyPlan, TIDY_SAID } from "../core/tidy.ts";
import { EXIT } from "../core/errors.ts";
import { atWork } from "../core/relocate.ts";
import { MODES, isArchive, modeOf, switchMode, type Mode } from "../core/mode.ts";
import { liveWorkers, runsAtWork } from "../core/workers.ts";
import { moveToTrash } from "../core/trash.ts";
import { history, stopLive } from "../core/live.ts";
import { humanWhen } from "../cli/human.ts";
import { onlyItsFiles, packPlan } from "../core/pack.ts";
import { defaultPackFile, packTree } from "./pack.ts";

register({
  path: ["init"],
  summary: "Create a family tree (a folder with its own history) to hold researches",
  group: "research",
  description: "The tree goes into the trees folder unless --dir is given. One tree = one family = one tree in the Strom app.",
  args: [{ name: "name", description: 'tree name, e.g. "Novákovi"', required: true }],
  options: [
    { name: "dir", type: "string", value: "<folder>", description: "create the tree in this folder instead" },
    { name: "mode", type: "string", value: "<research|archive>", description: "an archive of the data from the Strom app (no agent), or a research (default: the setting mode)" },
  ],
  examples: ['strom init "Novákovi"', 'strom init "Novákovi" --lang cs', 'strom init "Dvořákovi" --dir "~/Rodokmeny/Dvořákovi"', 'strom init "Novákovi" --mode archive'],
  run: async (ctx, { args, opts }) => {
    const name = args[0]!.trim();
    if (!name) throw new UsageError("the tree needs a name");
    const mode = opts.mode === undefined ? (ctx.settings.config.mode ?? "research") : String(opts.mode);
    if (!(MODES as readonly string[]).includes(mode)) throw new UsageError(`--mode is research or archive, not "${mode}"`);
    await ctx.requireHome();
    const treesDir = ctx.settings.trees()!.value;
    const root = opts.dir ? ctx.resolvePath(opts.dir as string) : path.join(treesDir, safeFolderName(name));
    const langR = ctx.settings.lang();
    const lang = langR.value;
    fs.mkdirSync(treesDir, { recursive: true });
    ensureShared(ctx.settings.shared()!.value);
    const tree = Tree.create(root, name, lang, ctx.env);
    // an archive from the start: no agent works on it (strom mode research switches it)
    if (mode === "archive") tree.withTreeLock(() => {
      switchMode(tree, "archive");
      tree.commit("The research is an archive", ["strom.json", ...tree.opsFilesTouched()]);
    });
    const agentFiles = syncAgentFiles(tree);
    if (agentFiles.length) tree.withTreeLock(() => tree.commit(`Agent instructions: ${agentFiles.join(", ")}`, agentFiles));
    if (path.dirname(root) !== treesDir) {
      const extra = new Set(ctx.settings.config.extraTrees ?? []);
      extra.add(root);
      ctx.settings.config.extraTrees = [...extra];
      ctx.settings.save();
    }
    ctx.adopt(tree);
    // in the research's language, also when an agent runs it (found on Mac: English to a Czech research)
    const t = (k: UIKey, v: Record<string, string> = {}) => ui(lang, k, v);
    const text = lines(
      t("ui.init.created", { name, path: ctx.display(root) }),
      t(langR.source === "detected" ? "ui.init.lang.detected" : "ui.init.lang", { lang: langName(lang, lang), code: lang }),
      mode === "archive" ? t("ui.init.archive") : undefined,
      "",
      t("ui.init.next", { command: mode === "archive" ? "strom app" : placeholders(lang, `strom research new "<research name>" --new-person "<Given /Surname/>" --born "<date>" --born-place "<place>"`) }),
    );
    return { text, data: { name, root, lang, mode } };
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
        persons: tree.countLive("person"),
        researches: tree.list<Research>("research").length,
      };
    });
    const lang = ctx.uiLang();
    if (trees.length === 0) return { text: ui(lang, "ui.trees.none"), data: { trees } };
    const text = table(
      trees.map((t) => [t.name, t.lang, ui(lang, "ui.trees.persons", { n: t.persons }), ui(lang, "ui.trees.researches", { n: t.researches }), ctx.display(t.root)]),
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
    return { text: ui(tree.lang, "ui.trees.use", { name: tree.config.name, root: ctx.display(root) }), data: { name: tree.config.name, root } };
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
    const followed = stopLive(root, "the family tree is taken off this computer") !== "none";
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
    // in the research's language (found on Windows: an archive's status in English); what changed as the history says it
    const lang = tree.lang;
    const archive = isArchive(tree);
    const said = new Map(history(tree.root, tree, ["-n5"]).map((e) => [e.head, e.text]));
    const changed = recent.flatMap((c) => {
      const text = (said.get(c.hash) ?? []).filter((t) => t !== c.subject);
      return text.length ? [[`  ${humanWhen(c.at, lang)}`, text.length > 1 ? `${text[0]} ${ui(lang, "ui.recent.morechanges", { n: text.length - 1 })}` : text[0]!]] : [];
    });
    const warnings = findings.length - errors.length;
    // what the research takes on the disk, and what strom keeps beside it (found 2026-10-04: 8.4 GB of it)
    const disk = tidyPlan(tree);
    const text = lines(
      `${tree.config.name} — ${langName(tree.config.lang, lang)} (${tree.config.lang}) — ${ctx.display(tree.root)}`,
      ui(lang, "ui.status.data", { persons: tree.countLive("person"), families: tree.countLive("family") }) + (archive ? "" : ui(lang, "ui.status.directions", { n: researches.length })),
      (errors.length ? ui(lang, "ui.status.check.errors", { n: errors.length }) : ui(lang, "ui.status.check.ok")) + (warnings ? ui(lang, "ui.status.check.warnings", { n: warnings }) : ""),
      researches.length && !archive ? ui(lang, "ui.status.dirs") + "\n" + table(researches.map((r) => [`  ${r.id}`, r.name, `[${ui(lang, `ui.dirs.${r.state === "done" || r.state === "paused" ? r.state : "active"}`)}]`])) : undefined,
      ui(lang, "ui.status.disk", { research: mb(disk.size.research, lang), strom: mb(disk.size.strom, lang) }) + (disk.frees >= TIDY_SAID ? ui(lang, "ui.status.disk.frees", { size: mb(disk.frees, lang) }) : ""),
      waitingLines(tree, { shared: ctx.settings.shared()?.value, display: (p) => ctx.display(p) }),
      changed.length ? ui(lang, "ui.status.recent") + "\n" + table(changed) : undefined,
    );
    return {
      text,
      data: {
        tree: { name: tree.config.name, root: tree.root, lang: tree.config.lang },
        counts: { persons: tree.count("person"), families: tree.count("family"), researches: researches.length },
        researches: researches.map((r) => ({ id: r.id, name: r.name, state: r.state })),
        findings,
        recent,
        disk: { research: disk.size.research, strom: disk.size.strom, frees: disk.frees },
      },
    };
  },
});

register({
  path: ["compact"],
  summary: "Pack the research's history (git gc) when it has grown — automatic in the background; by hand when strom doctor says so",
  group: "start",
  tree: true,
  options: [{ name: "now", type: "boolean", description: "pack whatever its size (never while somebody is at work)" }],
  description:
    "Git keeps each commit's new objects loose; packed, the same history takes a fraction of it. strom packs it by itself\n" +
    "when the loose objects pass 50 MB and nobody is at work (after a session, a run, a send of the Strom app, once a day\n" +
    "by the bridge). Nothing of the research is removed: git gc with git's own grace for what nothing names, checked by\n" +
    "git fsck before and after — what it finds wrong is said by strom doctor, never put right here. Logged in\n" +
    ".strom/tidy.log with the size of .git before and after.",
  examples: ["strom compact", "strom compact --now"],
  run(ctx, { opts }) {
    const tree = ctx.tree();
    const lang = tree.lang;
    const r = compactHistory(tree, ctx.env, { now: !!opts.now });
    if (r.done) return { text: ui(lang, "ui.compact.done", { before: mb(r.before, lang), after: mb(r.after, lang) }), data: r };
    const text =
      r.why === "busy" ? ui(lang, "ui.compact.busy") : r.why === "small" ? ui(lang, "ui.compact.small", { size: mb(r.size ?? 0, lang) }) : ui(lang, "ui.compact.failed", { error: r.error ?? "" });
    return { text, data: r, ...(r.why === "fsck" || r.why === "gc" ? { exitCode: EXIT.error } : {}) };
  },
});

register({
  path: ["tidy"],
  summary: "Free the disk of what strom keeps beside a research for itself — old logs of work sessions, views and excerpts of scans, sends of the Strom app written long ago: shown, then the person's yes",
  group: "start",
  tree: true,
  writes: true,
  description:
    "Never the research (data/, its history, inputs/, notes/, output/), the images in the shared folder, what anybody made,\n" +
    "nor a send of the Strom app taken back that may be sent again. Shown first (what, how much, why); removed on the\n" +
    "person's yes (a window of the system when an agent asks). From then on strom keeps it in order by itself after each\n" +
    "session and once a day by the bridge (logged in .strom/tidy.log).",
  examples: ["strom tidy", "strom tidy --dry-run"],
  async run(ctx) {
    const tree = ctx.tree();
    const lang = tree.lang;
    const plan = tidyPlan(tree);
    const groups = new Map<string, { what: string; does: string; n: number; bytes: number }>();
    for (const i of plan.items) {
      const k = `${i.kind}|${i.do}`;
      const g = groups.get(k) ?? { what: ui(lang, `ui.tidy.kind.${i.kind}` as UIKey), does: ui(lang, `ui.tidy.does.${i.do}` as UIKey), n: 0, bytes: 0 };
      g.n++;
      g.bytes += i.bytes;
      groups.set(k, g);
    }
    const data = { strom: plan.size.strom, research: plan.size.research, frees: plan.frees, quarantine: plan.quarantine, items: plan.items };
    const shown = lines(
      ui(lang, "ui.tidy.title", { name: tree.config.name, research: mb(plan.size.research, lang), strom: mb(plan.size.strom, lang) }),
      ...[...groups.values()].map((g) => ui(lang, "ui.tidy.row", { what: g.what, n: g.n, size: mb(g.bytes, lang), does: g.does })),
      plan.quarantine ? ui(lang, "ui.tidy.quarantine", { size: mb(plan.quarantine, lang) }) : undefined,
    );
    if (!plan.items.length) {
      if (!tree.dryRun) setTidyOn(tree.root);
      return { text: lines(ui(lang, "ui.tidy.none", { size: mb(plan.size.strom, lang) }), plan.quarantine ? ui(lang, "ui.tidy.quarantine", { size: mb(plan.quarantine, lang) }) : undefined), data: { ...data, removed: 0 } };
    }
    const preview = lines(shown, "", ui(lang, "ui.tidy.frees", { size: mb(plan.frees, lang) }));
    if (tree.dryRun) return { text: preview, data };
    // the person's: in their terminal asked after what goes is shown (Enter says no), else a window of the system
    const where = ctx.requireHuman("Free the disk of strom's old logs, views and sends beside the research?", "strom tidy", "tidy", ui(lang, "ui.consent.tidy", { size: mb(plan.frees, lang), name: tree.config.name }));
    if (where === "terminal") {
      ctx.io.stdout(preview + "\n\n");
      if (!(await ctx.confirm(ui(lang, "ui.tidy.ask"), false))) return { text: ui(lang, "ui.tidy.no"), data: { ...data, removed: 0 } };
    }
    const done = tidy(tree, plan, "person");
    setTidyOn(tree.root);
    return { text: lines(where === "window" ? preview : undefined, ui(lang, "ui.tidy.done", { size: mb(done.freed, lang) })), data: { ...data, removed: done.removed, shrunk: done.shrunk, freed: done.freed } };
  },
});

register({
  path: ["mode"],
  summary: "A research with an agent, or only an archive of the data from the Strom app: show it, or switch (the user alone)",
  group: "research",
  tree: true,
  writes: true,
  description:
    "research: an agent works on it (conversations, working alone, tasks). archive: the user enters the data in the Strom\n" +
    "app and the research keeps them — each sync written at once as the user's word, what the app no longer has withdrawn\n" +
    "with the reason (strom sync undo takes it back), the sources, the history; no agent works on it, its tasks wait put\n" +
    "aside. Switching is the user's decision (a window of the system when an agent asks): to an archive, the open tasks are\n" +
    "put aside (never while somebody works on it); back, they come back to the queue. Nothing is deleted.",
  args: [{ name: "mode", description: "research or archive (none: say which it is)" }],
  examples: ["strom mode", "strom mode research"],
  run(ctx, { args }) {
    const tree = ctx.tree();
    const lang = tree.lang;
    const now = modeOf(tree);
    if (!args[0]) return { text: ui(lang, now === "archive" ? "ui.mode.is.archive" : "ui.mode.is.research"), data: { mode: now } };
    const to = args[0].toLowerCase();
    if (!(MODES as readonly string[]).includes(to)) throw new UsageError(`a research is research or archive, not "${args[0]}"`, { hint: "strom mode archive · strom mode research" });
    if (to === now) return { text: ui(lang, now === "archive" ? "ui.mode.is.archive" : "ui.mode.is.research"), data: { mode: now, changed: false } };
    // nobody's work is cut short: a session at work finishes first
    if (to === "archive" && (liveWorkers(tree.root).length > 0 || runsAtWork(tree.root).length > 0))
      throw new UsageError("somebody is at work on this research: an archive only once they finished", { hint: "strom session finish (the agent writes down what it found and closes), then strom mode archive" });
    ctx.requireHuman(
      to === "archive" ? "Make this research an archive (its tasks put aside)?" : "Switch research on (the tasks put aside back in the queue)?",
      `strom mode ${to}`,
      "mode",
      ui(lang, to === "archive" ? "ui.consent.mode.archive" : "ui.consent.mode.research", { name: tree.config.name }),
    );
    let moved: string[] = [];
    tree.withTreeLock(() => {
      moved = switchMode(tree, to as Mode).tasks;
    });
    // the agents' files of the tree: written for research, taken out of an archive; research on, the agents here know
    // strom in any folder too (an archive's setup taught none)
    const files = syncAgentFiles(tree);
    if (to === "research" && !tree.dryRun)
      for (const t of globalTargets(ctx.env).filter((x) => agentsHere(ctx.env).some((a) => a.id === x.agent))) installGlobal(t);
    if (files.length && !tree.dryRun) tree.withTreeLock(() => tree.commit(`Agent instructions: ${files.join(", ")}`, files));
    return {
      // the sentence in the research's language (found on Windows: "T0001 put aside: the research is an archive")
      text: ui(lang, to === "archive" ? "ui.mode.now.archive" : "ui.mode.now.research", { n: moved.length }),
      data: { mode: to, changed: true, tasks: moved },
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
