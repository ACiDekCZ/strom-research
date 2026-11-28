// pack · unpack — a research handed to someone else as one ZIP file.

import fs from "node:fs";
import path from "node:path";
import { register } from "../cli/registry.ts";
import type { Context } from "../cli/context.ts";
import { counted, lines } from "../cli/format.ts";
import { ui } from "../cli/ui.ts";
import { NeedsConsentError, UsageError } from "../core/errors.ts";
import { findPack, freeRoot, INSTALL_UNIX, INSTALL_WINDOWS, packPlan, unpack, writePack } from "../core/pack.ts";
import { desktopDir, userHome } from "../core/paths.ts";
import { safeFolderName } from "../core/text.ts";
import { mb } from "../core/tidy.ts";
import { ZipTooLarge } from "../core/zip.ts";
import { Tree } from "../core/tree.ts";
import { isArchive } from "../core/mode.ts";
import { syncAgentFiles } from "../agents/files.ts";
import { setupWizard } from "../cli/wizard.ts";
import { isAgent } from "../core/which.ts";
import { ensureShared } from "./setup.ts";

/** Where a package goes unless named: the desktop (else the home), the tree's name and the day, a free name. */
export function defaultPackFile(ctx: Context, tree: Tree): string {
  const base = `${safeFolderName(tree.config.name) || "tree"} ${new Date().toISOString().slice(0, 10)}`;
  const desk = desktopDir(ctx.env);
  const dir = fs.existsSync(desk) ? desk : userHome(ctx.env);
  let out = path.join(dir, `${base}.zip`);
  for (let n = 2; fs.existsSync(out); n++) out = path.join(dir, `${base} (${n}).zip`);
  return out;
}

/**
 * The package with its how-to and launchers in the research language. An archive's how-to goes on in the Strom app,
 * nothing of an agent (found 2026-10-23: "the conversation with the agent"); its launchers open strom's menu, the
 * archive's, which offers the app — a research waiting for its agent here is packed as a research: the computer it goes
 * to may have one.
 */
export function packTree(tree: Tree, shared: string, out: string, all: boolean): ReturnType<typeof writePack> {
  const readme = {
    name: ui(tree.config.lang, "ui.pack.readme.file"),
    text: ui(tree.config.lang, isArchive(tree) ? "ui.pack.readme.archive" : "ui.pack.readme", { name: tree.config.name, win: INSTALL_WINDOWS, unix: INSTALL_UNIX }),
  };
  const say = { extract: ui(tree.config.lang, "ui.pack.launch.extract"), failed: ui(tree.config.lang, "ui.pack.launch.failed") };
  return writePack(tree, shared, out, { all, readme, say });
}

/**
 * A package over 4 GB (ZIP64 strom does not write): one sentence in the research language — the whole folder copied
 * takes the research along (the trees' folder with the shared one in it, else both — said as two folders, each named).
 * The hint a program reads is the person's English hint.
 */
export function tooLargeError(ctx: Context, tree: Tree, shared: string): UsageError {
  const home = ctx.settings.home()?.value;
  const inside = (dir: string, f: string) => {
    const r = path.relative(dir, f);
    return !r.startsWith("..") && !path.isAbsolute(r);
  };
  const one = home && inside(home, tree.root) && inside(home, shared) ? ctx.display(home) : undefined;
  const [a, b] = [ctx.display(tree.root), ctx.display(shared)];
  const text = one ? "pack.too-large" : "pack.too-large.two";
  const params: Record<string, string> = one ? { folder: one } : { folder: `${a}, ${b}`, a, b };
  return new UsageError(ui("en", `ui.error.${text}`, params), { code: "pack.too-large", params, textCode: text, hint: ui("en", `ui.error.${text}.hint`) });
}

/** The package written, or the sentence why it cannot be (over 4 GB). */
export function packOrSay(ctx: Context, tree: Tree, shared: string, out: string, all: boolean): ReturnType<typeof writePack> {
  try {
    return packTree(tree, shared, out, all);
  } catch (e) {
    if (e instanceof ZipTooLarge) throw tooLargeError(ctx, tree, shared);
    throw e;
  }
}

/** How many of the files go along are the family's photos and originals, how many archive scans, and their sizes. */
export function splitFiles(files: { size: number; family: boolean }[]): { scans: { n: number; bytes: number }; family: { n: number; bytes: number } } {
  const sum = (xs: { size: number }[]) => ({ n: xs.length, bytes: xs.reduce((s, x) => s + x.size, 0) });
  return { scans: sum(files.filter((f) => !f.family)), family: sum(files.filter((f) => f.family)) };
}

register({
  path: ["pack"],
  summary: "Pack the research into one ZIP file for someone to go on with it (the tree, the scans its records stand on, the family's photos, the connectors)",
  group: "research",
  tree: true,
  description:
    "The family tree as it was last saved, with its history; the archive scans its records stand on, the images nobody\n" +
    "can fetch again (saved by hand), the family's photos and originals with the batches the Strom app sent them in\n" +
    "(name, people, note), and the connectors that fetched the others. The pages only searched through are left out —\n" +
    "the archive gives the same scan again (strom fetch puts it back, checked); --all-images takes them too. Logins,\n" +
    "settings and seal keys never go along. Over 4 GB is refused before anything is written: copy the whole folder\n" +
    "instead. The one who gets it: strom unpack. It contains all details of living people — for an own backup or\n" +
    "transfer, not for sharing (a GEDCOM file to share, the living protected: strom export gedcom --living).",
  options: [
    { name: "out", type: "string", value: "<file.zip>", description: "where to write it (default: the desktop, named after the tree and the day)" },
    { name: "all-images", type: "boolean", description: "every image, the pages searched through too" },
  ],
  examples: ["strom pack", "strom pack --all-images", 'strom pack --out "~/Novákovi.zip"'],
  run(ctx, { opts }) {
    const tree = ctx.tree();
    const shared = ctx.settings.shared()!.value;
    const lang = ctx.uiLang();
    const all = Boolean(opts["all-images"]);
    let out = opts.out ? ctx.resolvePath(String(opts.out)) : defaultPackFile(ctx, tree);
    if (!out.toLowerCase().endsWith(".zip")) out += ".zip";
    if (fs.existsSync(out)) throw new UsageError(`${ctx.display(out)} is there already`, { hint: "another --out, or without it" });
    if (ctx.dryRun) {
      const plan = packPlan(tree, shared, all);
      const { scans, family } = splitFiles(plan.media);
      return {
        text: `dry run: would pack "${tree.config.name}" with ${counted(scans.n, "archive scan")} (${mb(scans.bytes)}) and ${counted(family.n, "family photo or original", "family photos and originals")} (${mb(family.bytes)}) into ${ctx.display(out)} — nothing written`,
        data: { out, plan },
      };
    }
    const r = packOrSay(ctx, tree, shared, out, all);
    const { scans, family } = splitFiles(r.plan.media);
    const text = lines(
      ui(lang, "ui.pack.done", { name: tree.config.name, file: ctx.display(r.file), size: mb(r.bytes, lang) }),
      ui(lang, "ui.pack.saved"),
      // for oneself, the living as they are (spec 151 K3.1)
      ui(lang, "ui.living.all"),
      scans.n || !family.n ? ui(lang, all ? "ui.pack.images.all" : "ui.pack.images", { n: scans.n, size: mb(scans.bytes, lang) }) : undefined,
      family.n ? ui(lang, "ui.pack.family", { n: family.n, size: mb(family.bytes, lang) }) : undefined,
      r.plan.batches.length ? ui(lang, "ui.pack.batches", { n: r.plan.batches.length }) : undefined,
      r.plan.left.count ? ui(lang, "ui.pack.left", { n: r.plan.left.count, size: mb(r.plan.left.bytes, lang) }) : undefined,
      r.plan.connectors.length ? ui(lang, "ui.pack.connectors", { list: r.plan.connectors.join(", ") }) : undefined,
      r.plan.left.count && r.plan.left.connectors ? ui(lang, "ui.pack.noconnector") : undefined,
      r.plan.missing.length ? ui(lang, "ui.pack.missing", { n: r.plan.missing.length }) : undefined,
      "",
      ui(lang, "ui.pack.send"),
    );
    return { text, data: { file: r.file, bytes: r.bytes, manifest: r.manifest, missing: r.plan.missing } };
  },
});

register({
  path: ["unpack"],
  summary: "Put a research someone packed for you in place and take it over on this computer (the person runs this)",
  group: "research",
  description:
    "The ZIP file of strom pack, or the folder it was unpacked into. The tree goes among the trees (a free name), its\n" +
    "images into the shared folder (each checked against its SHA-256), its connectors into the plugins where there is\n" +
    "none of that name (yours stays); the tree is checked whole and taken over on this computer. It adds connectors:\n" +
    "only the person at the computer runs it — never an agent.",
  args: [{ name: "file", description: "the ZIP file (or the folder it was unpacked into)", required: true }],
  examples: ['strom unpack "~/Downloads/Novákovi 2026-09-29.zip"'],
  async run(ctx, { args }) {
    const lang = ctx.uiLang();
    const src = ctx.resolvePath(args[0]!);
    // the English an agent (and a program) goes by; a person (a script, a launcher) reads it in their language
    if (!ctx.interactive) throw new NeedsConsentError([{ key: "unpack", kind: "consent", question: ui("en", "ui.unpack.person"), set: `strom unpack "${src}"` }], ui(lang, "ui.unpack.person"));
    // someone new to strom (a launcher of the package installed it just now): the setup wizard first
    if (!ctx.settings.home() && !isAgent(ctx.env)) {
      await setupWizard(ctx);
      ctx.settings.reload();
    }
    await ctx.requireHome();
    const treesDir = ctx.settings.trees()!.value;
    const shared = ctx.settings.shared()!.value;
    const pack = findPack(src);
    try {
      const m = pack.manifest;
      const same = ctx.knownTrees().find((t) => {
        try {
          return (JSON.parse(fs.readFileSync(path.join(t.root, "strom.json"), "utf8")) as { id?: string }).id === m.tree.id;
        } catch {
          return false;
        }
      });
      if (same) throw new UsageError(ui(lang, "ui.unpack.same", { root: ctx.display(same.root) }), { hint: `strom trees use "${same.root}"` });
      const target = freeRoot(treesDir, m.tree.name);
      ctx.io.stdout(
        ui(lang, "ui.unpack.what", {
          name: m.tree.name,
          strom: m.strom,
          date: m.created.slice(0, 10),
          images: m.media.length,
          connectors: m.connectors.length ? ` · ${m.connectors.join(", ")}` : "",
          root: ctx.display(target),
        }) + "\n",
      );
      if (!(await ctx.confirm(ui(lang, "ui.unpack.ask"), true))) return { text: "", data: { unpacked: false } };
      ensureShared(shared);
      const r = unpack(pack, treesDir, shared, ctx.env);
      // the tree's own instructions and permissions, for this computer's folders
      const tree = Tree.open(r.root, ctx.env);
      const files = syncAgentFiles(tree);
      tree.withTreeLock(() => tree.commit(`Agent instructions: ${files.join(", ")}`, files));
      ctx.settings.config.currentTree = r.root;
      ctx.settings.save();
      const text = lines(
        ui(lang, "ui.unpack.done", { name: r.name, root: ctx.display(r.root) }),
        r.images || r.imagesHad ? ui(lang, "ui.unpack.images", { n: r.images, had: r.imagesHad ? ui(lang, "ui.unpack.had", { n: r.imagesHad }) : "" }) : undefined,
        r.batches ? ui(lang, "ui.unpack.batches", { n: r.batches }) : undefined,
        r.connectors.length ? ui(lang, "ui.unpack.connectors", { list: r.connectors.join(", ") }) : undefined,
        ...r.connectorsKept.map((c) => ui(lang, "ui.unpack.kept", { name: c })),
        m.left.count ? ui(lang, "ui.unpack.left", { n: m.left.count }) : undefined,
        r.adopted ? ui(lang, "ui.unpack.adopted") : undefined,
        "",
        ui(lang, "ui.unpack.next"),
      );
      return { text, data: { unpacked: true, ...r } };
    } finally {
      if (pack.tmp) fs.rmSync(pack.tmp, { recursive: true, force: true });
    }
  },
});
