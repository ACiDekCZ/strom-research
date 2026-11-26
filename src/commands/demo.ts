// strom demo [cs|en|de|pl] / --remove: the sample research (spec 143 R1, core/demo.ts) — downloaded from the Strom app's
// web, checked, put in place apart from the person's own family trees and settings, and opened in the app.

import fs from "node:fs";
import { register, match } from "../cli/registry.ts";
import { Context } from "../cli/context.ts";
import { lines } from "../cli/format.ts";
import { ui } from "../cli/ui.ts";
import { StromError, UsageError } from "../core/errors.ts";
import { DEMO_LANGS, demoEnv, demoLang, demoPaths, demoTrees, downloadDemo, isDemo, unpackDemo, type DemoLang } from "../core/demo.ts";
import { Settings } from "../core/config.ts";
import { defaultAppUrl } from "../core/stromapp.ts";
import { stopLive } from "../core/live.ts";
import { anyoneAtWork } from "../core/workers.ts";
import { Tree } from "../core/tree.ts";
import { syncAgentFiles } from "../agents/files.ts";
import { ensureShared } from "./setup.ts";
import type { Env } from "../core/paths.ts";

/**
 * Where the samples are on the web: STROM_DEMO_BASE (a test, another copy of the web), else beside the Strom app of the
 * channel — https://stromapp.info/demo (the beta channel: beta.stromapp.info), <base>/<lang>/ holding VERSION, the
 * package of that version and its SHA-256.
 */
export function demoBase(env: Env): string {
  const said = (env.STROM_DEMO_BASE ?? "").trim();
  if (said) return said.replace(/\/+$/u, "");
  return `${new URL(defaultAppUrl(env)).origin}/demo`;
}

register({
  path: ["demo"],
  summary: "Try strom on a sample research (a made-up family), apart from the person's own trees, opened in the Strom app",
  group: "start",
  description:
    "Downloads the sample research of the language (cs, en, de, pl; none given: the research language, else en) from\n" +
    "the Strom app's web, checks it against its SHA-256 and puts it in a folder of its own inside strom's settings —\n" +
    "with settings, trees and shared folder of its own: the person's family trees and settings stay untouched, the\n" +
    "sample is none of their trees. It is marked demo in its strom.json and opened in the Strom app. Everything in it\n" +
    "can be looked through without an agent; nothing offers or starts one. Run again: the sample already here opens.\n" +
    "--remove deletes the sample (only it); its copy in the app is deleted in the app's tree management.",
  args: [{ name: "lang", description: `the sample's language: ${DEMO_LANGS.join(", ")}` }],
  options: [{ name: "remove", type: "boolean", description: "delete the sample research from this computer (only it)" }],
  examples: ["strom demo", "strom demo de", "strom demo --remove"],
  async run(ctx, { args, opts }) {
    const lang = ctx.uiLang();
    if (opts.remove) return removeDemo(ctx, lang);
    const asked = args[0];
    const l: DemoLang | undefined = asked ? demoLang(asked) : (demoLang(lang) ?? "en");
    if (!l) throw new UsageError(`there is no sample research in "${asked}" — one of ${DEMO_LANGS.join(", ")}`, { code: "demo.lang.unknown", params: { lang: asked!, langs: DEMO_LANGS.join(", ") }, hint: "strom demo en" });
    const p = demoPaths(ctx.env);
    const env = demoEnv(ctx.env);
    let had = demoTrees(ctx.env).find((t) => isDemo(t.config) && t.config.lang === l);
    let version: string | undefined;
    if (!had) {
      const base = demoBase(ctx.env);
      if (!ctx.json) ctx.io.stdout(ui(lang, "ui.demo.downloading", { lang: l }) + "\n");
      // downloaded and checked before anything is made: the package not as its SHA-256 says, nothing set up
      const got = await downloadDemo(base, l);
      version = got.version;
      const fresh = !fs.existsSync(p.root);
      try {
        // the sample's own settings: its home, its language; the copy of the app and the browser the person chose for
        // it (the sample opens where their own research does)
        const own = new Settings(env, {});
        own.config.home = p.home;
        own.config.lang = l;
        for (const key of ["stromApp", "stromAppUrl", "appBrowser"] as const) {
          const v = ctx.settings.config[key];
          if (v !== undefined) (own.config as Record<string, unknown>)[key] = v;
        }
        own.save();
        ensureShared(p.shared);
        const r = unpackDemo(got.file, l, ctx.env);
        const tree = Tree.open(r.root, env);
        tree.withTreeLock(() => {
          tree.updateConfig(
            (c) => {
              c.demo = true;
            },
            { op: "config.set", summary: "demo: the sample research" },
          );
          tree.commit("The sample research");
        });
        // the tree's own instructions and permissions, for this computer's folders (never the build's)
        const files = syncAgentFiles(tree);
        if (files.length) tree.withTreeLock(() => tree.commit(`Agent instructions: ${files.join(", ")}`, files));
        own.reload();
        own.config.currentTree = r.root;
        own.save();
        had = { root: r.root, config: tree.config };
      } catch (e) {
        // a sample half set up is none: what this run made goes (a sample of another language stays)
        if (fresh) fs.rmSync(p.root, { recursive: true, force: true, maxRetries: 3 });
        throw e;
      } finally {
        fs.rmSync(got.dir, { recursive: true, force: true });
      }
    } else {
      const own = new Settings(env, {});
      own.config.currentTree = had.root;
      own.save();
    }
    const said = ui(lang, version ? "ui.demo.done" : "ui.demo.again", { name: had.config.name, root: ctx.display(had.root) });
    // opened in the app as strom app opens a research — with the sample's own settings, never the person's
    const app = match(["app"])!.def;
    const inDemo = Context.fromOptions({ env, cwd: had.root, io: ctx.io, json: ctx.json, values: {} });
    const opened = await app.run(inDemo, { args: [], opts: {} });
    return {
      text: lines(said, ui(lang, "ui.demo.look"), "", opened.text || undefined),
      data: { demo: true, lang: l, name: had.config.name, root: had.root, ...(version ? { version } : {}), downloaded: Boolean(version), app: opened.data },
    };
  },
});

/** strom demo --remove: the sample's bridge ended, its folder deleted whole (its trees, settings, seal keys) — nothing else. */
function removeDemo(ctx: Context, lang: string) {
  const p = demoPaths(ctx.env);
  if (!fs.existsSync(p.root)) return { text: ui(lang, "ui.demo.none"), data: { removed: false } };
  const trees = demoTrees(ctx.env);
  if (trees.some((t) => anyoneAtWork(t.root))) throw new StromError("somebody is at work on the sample research — it is deleted once the work ends", { code: "demo.atwork", hint: "strom demo --remove once the work ends" });
  for (const t of trees)
    if (stopLive(t.root, "strom demo --remove") === "alive") throw new StromError("the sample research's bridge did not end — nothing was deleted", { code: "demo.bridge", hint: "strom demo --remove" });
  fs.rmSync(p.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  return { text: lines(ui(lang, "ui.demo.removed"), ui(lang, "ui.demo.removed.app")), data: { removed: true, trees: trees.map((t) => t.config.name) } };
}
