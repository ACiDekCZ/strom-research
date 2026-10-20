// export gedcom · gedcom validate — the automated output.

import fs from "node:fs";
import path from "node:path";
import { register } from "../cli/registry.ts";
import { counted, lines, numberIn, table } from "../cli/format.ts";
import { exportGedcom, GED_PROFILES, type GedProfile } from "../gedcom/export.ts";
import type { Context } from "../cli/context.ts";
import { hasGedErrors, validateGedcom, type GedFinding } from "../gedcom/validate.ts";
import { writeFileAtomic } from "../core/json.ts";
import { verifyFast } from "../core/integrity.ts";
import { ancestorGenerations, familiesAsChild, familiesAsPartner } from "../core/people.ts";
import { resolveResearch } from "./research.ts";
import type { Research } from "../core/model.ts";
import type { Tree } from "../core/tree.ts";
import { UsageError } from "../core/errors.ts";
import { excerptSettings, planExcerpts, type ExcerptReport } from "../core/excerpt.ts";
import { runGit, tracked } from "../core/git.ts";
import { Settings } from "../core/config.ts";
import { appKnowsArchive, appKnowsNoCouple, appShowsHypothesisLinks, appShowsReadings, appDecidesConflicts, appOpensLinks, appReadsTitles, appShowsCoupleEvents, appShowsEdges, appShowsSourceReads, appShowsFactStatus, appShowsStoryDrafts, appTurnsExcerpts } from "../core/stromapp.ts";
import { EXCERPT_QUALITIES, EXCERPT_SCOPES, type ExcerptQuality, type ExcerptScope } from "../core/model.ts";
import { ui } from "../cli/ui.ts";
import { isAgent } from "../core/which.ts";

function findingRows(f: GedFinding[]): string {
  return table(f.slice(0, 30).map((x) => [x.level === "error" ? "ERROR" : "warn", `line ${x.line}`, x.message]));
}

/** People in scope of a research: the focus, its ancestors, their partners, and any adoptive/step parents. */
function researchScope(tree: Tree, r: Research): Set<string> {
  const ids = new Set(ancestorGenerations(tree, r.focus, r.limits?.generations ?? 50).keys());
  for (const id of [...ids]) {
    for (const f of familiesAsPartner(tree, id)) for (const p of f.partners) ids.add(p);
    for (const f of familiesAsChild(tree, id)) for (const p of f.partners) ids.add(p);
  }
  return ids;
}

/** output/tree.ged (any program) or output/tree-strom.ged (the Strom app); a research's own file is named after it. */
export function gedFile(tree: Tree, profile: GedProfile, research?: Research): string {
  return path.join(tree.root, "output", `${research ? research.id : "tree"}${profile === "strom" ? "-strom" : ""}.ged`);
}

/**
 * The Strom file stays out of the tree's history: it carries the entries cut out of their scans (megabytes,
 * made again at will from the evidence); the history keeps the standard file (output/tree.ged). A tree that
 * committed it before lets go of it once.
 */
const IGNORE_STROM = ["/output/*-strom.ged", "/output/*-images.ged"];

function ignoreStromGed(tree: Tree, file: string): void {
  const ignore = path.join(tree.root, ".gitignore");
  const had = fs.existsSync(ignore) ? fs.readFileSync(ignore, "utf8") : "";
  const have = had.split(/\r?\n/);
  const add = IGNORE_STROM.filter((l) => !have.includes(l));
  const rel = tree.relative(file);
  const inHistory = tracked(tree.root, rel);
  if (!add.length && !inHistory) return;
  tree.withTreeLock(() => {
    if (add.length) fs.writeFileSync(ignore, `${had}${had && !had.endsWith("\n") ? "\n" : ""}${add.join("\n")}\n`);
    if (inHistory) runGit(tree.root, ["rm", "--cached", "--quiet", "--", rel]);
    tree.commit("The file for the Strom app (with the images of the entries) stays out of the history", [".gitignore"]);
  });
}

export type ImageSettings = { shared: string; quality: ExcerptQuality; for: ExcerptScope; mb: number };

/**
 * Write one GEDCOM file and validate it by the rules of its reader. The Strom file carries the entries cut out of
 * their scans by the settings (excerpts.*; `images` overrides them, false: without); budgetMs: new excerpts are
 * made for at most so long (the rest the next export makes).
 */
export function writeTreeGed(
  tree: Tree,
  opts: {
    for: GedProfile;
    stromVersion?: string | undefined;
    research?: Research;
    out?: string;
    images?: ImageSettings | false;
    budgetMs?: number;
  },
) {
  const persons = opts.research ? researchScope(tree, opts.research) : undefined;
  const set = opts.for !== "strom" || opts.images === false ? undefined : (opts.images ?? excerptSettings(tree));
  const images =
    set && set.for !== "none"
      ? planExcerpts(tree, set.shared, { quality: set.quality, for: set.for, maxBytes: set.mb * 1024 * 1024, persons, budgetMs: opts.budgetMs })
      : undefined;
  // each excerpt's mark, for an app that asks for it in full (a strom-research:// link)
  // an app that opens links shows what the research knows of a person too (the same version)
  const research = opts.for === "strom" && appOpensLinks(new Settings(tree.env, {}), opts.stromVersion);
  const clips = research && !!images;
  // …and where the tree ends, for an app that shows it
  const edges = opts.for === "strom" && appShowsEdges(new Settings(tree.env, {}), opts.stromVersion);
  // …and the new versions of stories the user approved, for an app that shows them
  const storyDrafts = opts.for === "strom" && appShowsStoryDrafts(new Settings(tree.env, {}), opts.stromVersion);
  const coupleResi = opts.for === "strom" && appShowsCoupleEvents(new Settings(tree.env, {}), opts.stromVersion);
  // …and who read each source, for an app that shows it
  const sourceReads = opts.for === "strom" && appShowsSourceReads(new Settings(tree.env, {}), opts.stromVersion);
  const factStatus = opts.for === "strom" && appShowsFactStatus(new Settings(tree.env, {}), opts.stromVersion);
  const turnsExcerpts = opts.for === "strom" && appTurnsExcerpts(new Settings(tree.env, {}), opts.stromVersion);
  const noCouple = opts.for === "strom" && appKnowsNoCouple(new Settings(tree.env, {}), opts.stromVersion);
  const archive = opts.for === "strom" && appKnowsArchive(new Settings(tree.env, {}), opts.stromVersion);
  const titles = opts.for === "strom" && appReadsTitles(new Settings(tree.env, {}), opts.stromVersion);
  // …and what each variant of a hypothesis would connect, for an app that shows it
  const hypothesisLinks = opts.for === "strom" && appShowsHypothesisLinks(new Settings(tree.env, {}), opts.stromVersion);
  // …and the sides of a conflict of the user's edit, for an app that decides it
  const conflictSides = opts.for === "strom" && appDecidesConflicts(new Settings(tree.env, {}), opts.stromVersion);
  // …and the reading of a document each source is an entry of, for an app that opens it
  const readings = opts.for === "strom" && appShowsReadings(new Settings(tree.env, {}), opts.stromVersion);
  const result = exportGedcom(tree, { for: opts.for, stromVersion: opts.stromVersion, ...(persons ? { persons } : {}), ...(images ? { excerpts: images.of } : {}), ...(clips ? { clips } : {}), ...(research ? { research } : {}), ...(edges ? { edges } : {}), ...(storyDrafts ? { storyDrafts } : {}), ...(coupleResi ? { coupleResi } : {}), ...(sourceReads ? { sourceReads } : {}), ...(factStatus ? { factStatus } : {}), ...(archive ? { archive } : {}), ...(turnsExcerpts ? { turnsExcerpts } : {}), ...(noCouple ? { noCouple } : {}), ...(titles ? { titles } : {}), ...(hypothesisLinks ? { hypothesisLinks } : {}), ...(conflictSides ? { conflictSides } : {}), ...(readings ? { readings } : {}) });
  const findings = validateGedcom(result.text, opts.for === "standard" ? { strict: true } : {});
  const file = opts.out ?? gedFile(tree, opts.for, opts.research);
  if (!hasGedErrors(findings) && !tree.dryRun) {
    if (opts.for === "strom" && file.startsWith(path.join(tree.root, "output") + path.sep)) ignoreStromGed(tree, file);
    writeFileAtomic(file, result.text);
  }
  return { ...result, findings, file, for: opts.for, ...(images && set ? { images: images.report, imageSettings: set } : {}) };
}

/** A size of images as the language writes it (0,4 MB in Czech, 0.4 MB in English). */
const mbIn = (bytes: number, lang: string) => `${numberIn(lang, bytes / 1024 / 1024, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} MB`;

/** A quality of the images (excerpt.ts LEVELS) as the language says it; in English its name, the value excerpts.quality takes. */
const QUALITY_WORDS = { sharp: "ui.export.quality.sharp", normal: "ui.export.quality.normal", small: "ui.export.quality.small", smaller: "ui.export.quality.smaller" } as const;
export const qualityIn = (q: string, lang: string) => (Object.hasOwn(QUALITY_WORDS, q) ? ui(lang, QUALITY_WORDS[q as keyof typeof QUALITY_WORDS]) : q);

/**
 * What an export with images took in and left out, and what to do about it — what strom decided itself is said as a
 * warning; in `lang` (a person's research language, else English).
 */
export function imagesLines(r: ExcerptReport, images: { for: ExcerptScope; mb: number }, lang = "en"): string {
  const few = (ids: string[]) => `${ids.slice(0, 8).join(", ")}${ids.length > 8 ? ` … (${ids.length})` : ""}`;
  return lines(
    ui(lang, "ui.export.images", { excerpts: r.excerpts, sources: r.sources, size: mbIn(r.bytes, lang), level: qualityIn(r.level, lang) }),
    r.level !== r.asked ? ui(lang, "ui.export.images.smaller", { mb: numberIn(lang, images.mb, { maximumFractionDigits: 3, useGrouping: false }), level: qualityIn(r.level, lang), asked: qualityIn(r.asked, lang) }) : undefined,
    r.dropped.length ? ui(lang, "ui.export.images.dropped", { mb: numberIn(lang, images.mb, { maximumFractionDigits: 3, useGrouping: false }), n: r.dropped.length, ids: few(r.dropped) }) : undefined,
    r.uncitedLeft.length ? ui(lang, "ui.export.images.uncited", { mb: numberIn(lang, images.mb, { maximumFractionDigits: 3, useGrouping: false }), n: r.uncitedLeft.length, ids: few(r.uncitedLeft) }) : undefined,
    r.outOfScope ? ui(lang, "ui.export.images.scope", { n: r.outOfScope, for: images.for }) : undefined,
    images.for !== "all" && r.uncited ? ui(lang, "ui.export.images.uncitedOut", { n: r.uncited }) : undefined,
    r.missing.length ? ui(lang, "ui.export.images.missing", { ids: few(r.missing) }) : undefined,
    r.unclipped.length ? ui(lang, "ui.export.images.unclipped", { ids: few(r.unclipped) }) : undefined,
    r.later.length ? ui(lang, "ui.export.images.later", { n: r.later.length }) : undefined,
  );
}

/** The images of an export: the settings, each overridden by its option. */
export function imageSettings(ctx: Context, tree: Tree, opts: Record<string, unknown>): ImageSettings {
  const shared = ctx.settings.shared()?.value;
  if (!shared) throw new UsageError("no shared folder with the images is set", { hint: "strom setup" });
  const set = ctx.settings.excerpts(tree.config);
  const quality = opts["images-quality"] === undefined ? set.quality : String(opts["images-quality"]);
  if (!EXCERPT_QUALITIES.includes(quality as ExcerptQuality)) throw new UsageError(`invalid --images-quality "${quality}"`, { hint: EXCERPT_QUALITIES.join(", ") });
  const scope = opts["images-for"] === undefined ? set.for : String(opts["images-for"]);
  if (!EXCERPT_SCOPES.includes(scope as ExcerptScope)) throw new UsageError(`invalid --images-for "${scope}"`, { hint: EXCERPT_SCOPES.join(", ") });
  const mbv = opts["images-max-mb"] === undefined ? set.mb : Number(opts["images-max-mb"]);
  if (!(mbv > 0)) throw new UsageError("--images-max-mb must be a positive number");
  return { shared, quality: quality as ExcerptQuality, for: scope as ExcerptScope, mb: mbv };
}

/** New excerpts after a session are made for at most so long: what is left, the next export makes. */
export const AFTER_SESSION_MS = 20_000;

/** The GEDCOM files the settings ask for (both by default), from the same evidence. Used after sessions. */
export function writeGedcoms(ctx: Context, tree: Tree, research?: Research) {
  return ctx.settings.gedcomFor(tree.config).map((p) =>
    writeTreeGed(tree, { for: p, stromVersion: ctx.settings.stromVersion(tree.config), ...(research ? { research } : {}), budgetMs: AFTER_SESSION_MS }),
  );
}

register(
  {
    path: ["export", "gedcom"],
    summary: "Generate the GEDCOM files, validated: output/tree.ged for any program, output/tree-strom.ged for the Strom app (with the entries' images)",
    group: "output",
    tree: true,
    description:
      "Both come from the same evidence (GEDCOM 5.5.1, UTF-8). The standard one uses no extension tags; the Strom\n" +
      "one is shaped to what the Strom app reads (_WITN, _STORY, _FREL/_MREL, a source per page). QUAY is the\n" +
      "quality of each citation's evidence; leads say so in a note; retracted and disproven facts are left out;\n" +
      "of several facts of a kind the best supported comes first. Which files: --for or the setting gedcom.for.\n" +
      "The Strom file carries each entry cut out of its scan (the sources' clips; the settings excerpts.*, excerpts.for\n" +
      "none: without) and stays out of the tree's history — the history keeps the standard file. The entries nobody\n" +
      "cites only with --images-for all: after the cited ones, where they still fit under the limit (the cited never\n" +
      "made smaller for them).",
    options: [
      { name: "for", type: "string", value: "<reader>", description: "standard (any program), strom (the Strom app) or both (default: the setting gedcom.for, both)" },
      { name: "research", type: "string", value: "<G…>", description: "only the people of one research (focus, ancestors, partners)" },
      { name: "out", type: "string", value: "<file>", description: "write here instead of output/ (with --for standard or strom)" },
      { name: "images", type: "boolean", description: "the Strom file with the entries' images (the default; kept for older scripts)" },
      { name: "images-quality", type: "string", value: "<q>", description: "small (1000 px, grey), normal, sharp (1600 px) — default: the setting excerpts.quality (normal)" },
      { name: "images-for", type: "string", value: "<whose>", description: "none, line, family, connected or all (every source with an excerpt) — default: the setting excerpts.for (family: the ancestors and their families)" },
      { name: "images-max-mb", type: "string", value: "<n>", description: "limit of all excerpts together — over it smaller, then the farthest left out; with all, the entries nobody cites only where there is room (default: the setting excerpts.mb, 200)" },
    ],
    examples: ["strom export gedcom", "strom export gedcom --research G0001", "strom export gedcom --for standard --out ~/Desktop/novak.ged", "strom export gedcom --for strom --images-for all"],
    run(ctx, { opts }) {
      const tree = ctx.tree();
      const research = typeof opts.research === "string" ? resolveResearch(tree, opts.research) : undefined;
      const out = typeof opts.out === "string" ? ctx.resolvePath(opts.out) : undefined;
      const which = typeof opts.for === "string" ? opts.for.toLowerCase() : undefined;
      if (which && which !== "both" && !GED_PROFILES.includes(which as GedProfile)) throw new UsageError(`invalid --for "${opts.for}"`, { hint: "standard, strom or both" });
      const asked = ["images-max-mb", "images-quality", "images-for"].some((k) => opts[k] !== undefined);
      if ((asked || opts.images) && which === "standard") throw new UsageError("images go into the file for the Strom app only", { hint: "strom export gedcom --for strom" });
      const profiles: GedProfile[] = which === "both" ? [...GED_PROFILES] : which ? [which as GedProfile] : ctx.settings.gedcomFor(tree.config);
      if (out && profiles.length > 1) throw new UsageError("--out writes one file", { hint: "add --for standard or --for strom" });
      const images = asked ? imageSettings(ctx, tree, opts) : undefined;
      const results = profiles.map((p) =>
        writeTreeGed(tree, {
          for: p,
          stromVersion: ctx.settings.stromVersion(tree.config),
          ...(research ? { research } : {}),
          ...(out ? { out } : {}),
          ...(images ? { images } : {}),
        }),
      );
      const bad = results.filter((r) => hasGedErrors(r.findings));
      if (bad.length) {
        return {
          text: lines(...bad.map((r) => `GEDCOM ${r.for} NOT written — validation error(s):\n${findingRows(r.findings)}`), "→ this is a bug in strom; please report it"),
          data: { ok: false, results: results.map((r) => ({ for: r.for, file: r.file, findings: r.findings })) },
          exitCode: 1,
        };
      }
      // Commit the output when it lives in the tree and the evidence is intact (the Strom file, with its images: never).
      const inTree = results.filter((r) => r.for === "standard" && r.file.startsWith(tree.root + path.sep));
      let committed = false;
      if (inTree.length && !tree.dryRun && verifyFast(tree).findings.every((f) => f.level !== "error")) {
        const s0 = results[0]!.stats;
        tree.withTreeLock(() => tree.commit(`Export ${inTree.map((r) => path.basename(r.file)).join(", ")}: ${s0.persons} persons, ${s0.families} families`, inTree.map((r) => tree.relative(r.file))));
        committed = true;
      }
      // what was written, in the research's language where a person runs it (found on Windows: "6 persons · 1 sources",
      // "committed" in a Czech research); an agent reads the English, --json the data
      const lang = isAgent(ctx.env) ? "en" : tree.lang;
      const text = lines(
        ...results.map((r) => {
          const s = r.stats;
          const forWhom = ui(lang, r.for === "strom" ? (r.images ? "ui.export.for.strom.images" : "ui.export.for.strom") : "ui.export.for.standard");
          const skipped = s.skipped ? ui(lang, "ui.export.skipped", { n: s.skipped }) : "";
          return lines(
            ui(lang, "ui.export.file", { file: ctx.display(r.file), for: forWhom, persons: s.persons, families: s.families, facts: s.events, sources: s.sources, skipped }),
            r.findings.length ? ui(lang, "ui.export.valid.warnings", { n: r.findings.length }) : ui(lang, "ui.export.valid"),
            r.images && r.imageSettings ? imagesLines(r.images, r.imageSettings, lang) : undefined,
            r.findings.length ? findingRows(r.findings) : undefined,
          );
        }),
        committed ? ui(lang, "ui.export.committed") : undefined,
      );
      const first = results[0]!;
      return {
        text,
        data: {
          ok: true,
          file: first.file,
          stats: first.stats,
          findings: first.findings,
          ...(results.find((r) => r.images) ? { images: results.find((r) => r.images)!.images } : {}),
          files: results.map((r) => ({ for: r.for, file: r.file, stats: r.stats, findings: r.findings })),
        },
      };
    },
  },
  {
    path: ["gedcom", "validate"],
    summary: "Check any GEDCOM file: structure, tags in context, references, dates, line lengths",
    group: "output",
    args: [{ name: "file", description: "the .ged file", required: true }],
    options: [{ name: "for", type: "string", value: "<reader>", description: "standard: also reject extension tags (_WITN, _STORY); strom (default): allow them" }],
    run(ctx, { args, opts }) {
      // A path like output/tree.ged is also found from outside the tree folder.
      let file = ctx.resolvePath(args[0]!);
      if (!fs.existsSync(file) && !path.isAbsolute(args[0]!) && ctx.hasTree()) file = path.join(ctx.tree().root, args[0]!);
      if (!fs.existsSync(file)) throw new UsageError(`no such file: ${args[0]}`);
      const findings = validateGedcom(fs.readFileSync(file, "utf8"), opts.for === "standard" ? { strict: true } : {});
      const errors = findings.filter((f) => f.level === "error").length;
      return {
        text: findings.length ? lines(findingRows(findings), "", `${counted(errors, "error")}, ${counted(findings.length - errors, "warning")}`) : "ok — valid GEDCOM 5.5.1",
        data: { ok: errors === 0, findings },
        exitCode: errors ? 1 : 0,
      };
    },
  },
);
