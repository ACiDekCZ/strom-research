// pack · unpack — a research handed to someone else as one ZIP file.

import fs from "node:fs";
import path from "node:path";
import { register } from "../cli/registry.ts";
import type { Context } from "../cli/context.ts";
import { lines } from "../cli/format.ts";
import { ui } from "../cli/ui.ts";
import { NeedsConsentError, UsageError } from "../core/errors.ts";
import { findPack, freeRoot, INSTALL_UNIX, INSTALL_WINDOWS, packPlan, unpack, writePack } from "../core/pack.ts";
import { desktopDir, userHome } from "../core/paths.ts";
import { safeFolderName } from "../core/text.ts";
import { Tree } from "../core/tree.ts";
import { syncAgentFiles } from "../agents/files.ts";
import { setupWizard } from "../cli/wizard.ts";
import { isAgent } from "../core/which.ts";
import { ensureShared } from "./setup.ts";

const mb = (bytes: number) => (bytes / 1e6 < 10 ? (bytes / 1e6).toFixed(1) : Math.round(bytes / 1e6).toString());

/** Where a package goes unless named: the desktop (else the home), the tree's name and the day, a free name. */
export function defaultPackFile(ctx: Context, tree: Tree): string {
  const base = `${safeFolderName(tree.config.name) || "tree"} ${new Date().toISOString().slice(0, 10)}`;
  const desk = desktopDir(ctx.env);
  const dir = fs.existsSync(desk) ? desk : userHome(ctx.env);
  let out = path.join(dir, `${base}.zip`);
  for (let n = 2; fs.existsSync(out); n++) out = path.join(dir, `${base} (${n}).zip`);
  return out;
}

/** The package with its how-to and launchers in the research language. */
export function packTree(tree: Tree, shared: string, out: string, all: boolean): ReturnType<typeof writePack> {
  const readme = {
    name: ui(tree.config.lang, "ui.pack.readme.file"),
    text: ui(tree.config.lang, "ui.pack.readme", { name: tree.config.name, win: INSTALL_WINDOWS, unix: INSTALL_UNIX }),
  };
  const say = { extract: ui(tree.config.lang, "ui.pack.launch.extract"), failed: ui(tree.config.lang, "ui.pack.launch.failed") };
  return writePack(tree, shared, out, { all, readme, say });
}

register({
  path: ["pack"],
  summary: "Pack the research into one ZIP file for someone to go on with it (the tree, the images its records stand on, the connectors)",
  group: "research",
  tree: true,
  description:
    "The family tree as it was last saved, with its history; the images its records stand on, the images nobody can\n" +
    "fetch again (saved by hand, the family's material) and the connectors that fetched the others. The pages only\n" +
    "searched through are left out — the archive gives the same scan again (strom fetch puts it back, checked);\n" +
    "--all-images takes them too. Logins, settings and seal keys never go along. The one who gets it: strom unpack.",
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
      const bytes = plan.media.reduce((s, m) => s + m.size, 0);
      return { text: `dry run: would pack "${tree.config.name}" with ${plan.media.length} image(s) (${mb(bytes)} MB) into ${ctx.display(out)} — nothing written`, data: { out, plan } };
    }
    const r = packTree(tree, shared, out, all);
    const took = r.plan.media.reduce((s, m) => s + m.size, 0);
    const text = lines(
      ui(lang, "ui.pack.done", { name: tree.config.name, file: ctx.display(r.file), mb: mb(r.bytes) }),
      ui(lang, "ui.pack.saved"),
      ui(lang, all ? "ui.pack.images.all" : "ui.pack.images", { n: r.plan.media.length, mb: mb(took) }),
      r.plan.left.count ? ui(lang, "ui.pack.left", { n: r.plan.left.count, mb: mb(r.plan.left.bytes) }) : undefined,
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
    if (!ctx.interactive) throw new NeedsConsentError([{ key: "unpack", kind: "consent", question: ui(lang, "ui.unpack.person"), set: `strom unpack "${src}"` }]);
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
