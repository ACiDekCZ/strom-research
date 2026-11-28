// export gedcom · gedcom validate — the automated output.

import fs from "node:fs";
import path from "node:path";
import { register } from "../cli/registry.ts";
import { counted, lines, numberIn, table } from "../cli/format.ts";
import { exportGedcom, GED_PROFILES, type AppMediaFile, type GedProfile } from "../gedcom/export.ts";
import { LIVING_MODES, livingModeOf, livingOf, protectGedcom, rawRecords, type LivingMode } from "../gedcom/privacy.ts";
import { labels } from "../gedcom/labels.ts";
import { servedCopy, treeMedia } from "../core/treemedia.ts";
import type { Context } from "../cli/context.ts";
import { hasGedErrors, validateGedcom, type GedFinding } from "../gedcom/validate.ts";
import { writeFileAtomic } from "../core/json.ts";
import { verifyFast } from "../core/integrity.ts";
import { ancestorGenerations, familiesAsChild, familiesAsPartner } from "../core/people.ts";
import { resolveResearch } from "./research.ts";
import type { Input, Research, Source } from "../core/model.ts";
import type { Tree } from "../core/tree.ts";
import { UsageError } from "../core/errors.ts";
import { excerptSettings, planExcerpts, type ExcerptReport } from "../core/excerpt.ts";
import { runGit, tracked } from "../core/git.ts";
import { Settings } from "../core/config.ts";
import { appKnowsArchive, appKnowsFamsOrder, appKnowsNoCouple, appShowsHypothesisDecider, appShowsHypothesisLinks, appShowsReadings, appShowsOmittedImages, appDecidesConflicts, appOpensLinks, appReadsTitles, appShowsCoupleEvents, appShowsEdges, appShowsSourceReads, appShowsFactStatus, appShowsStoryDrafts, appTurnsExcerpts, appReadsSurnameGroups, appReadsLines, appReadsPlaceRecords, appShowsOrigin, appShowsVerify, appConfirmsTranscripts, appReadsSourcesAgain, appShowsResearchTable, appDecidesHypotheses, appReadsSourceFields, appReadsMainCitation, appReadsNameStatus } from "../core/stromapp.ts";
import { tableMarks } from "../core/tablemarks.ts";
import { surnamesForExport } from "../core/surnames.ts";
import { actsAsArchive } from "../core/state.ts";
import { verifyMarks } from "../core/verify.ts";
import { readsAgain } from "../core/sourceread.ts";
import { lineMarks } from "../core/lineages.ts";
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
export function gedFile(tree: Tree, profile: GedProfile, research?: Research, living?: LivingMode): string {
  const mode = living && living !== "full" ? `-${living}` : "";
  return path.join(tree.root, "output", `${research ? research.id : "tree"}${profile === "strom" ? "-strom" : ""}${mode}.ged`);
}

/**
 * The Strom file stays out of the tree's history: it carries the entries cut out of their scans (megabytes,
 * made again at will from the evidence); the history keeps the standard file (output/tree.ged). A tree that
 * committed it before lets go of it once.
 */
const IGNORE_STROM = ["/output/*-strom.ged", "/output/*-images.ged"];

/** The files with the living protected (spec 151): never in the history, whatever reader they are for. */
const IGNORE_PROTECTED = LIVING_MODES.filter((m) => m !== "full").map((m) => `/output/*-${m}.ged`);

function ignoreStromGed(tree: Tree, file: string): void {
  ignoreOutputs(tree, file, IGNORE_STROM, "The file for the Strom app (with the images of the entries) stays out of the history");
}

function ignoreOutputs(tree: Tree, file: string, patterns: string[], subject: string): void {
  const ignore = path.join(tree.root, ".gitignore");
  const had = fs.existsSync(ignore) ? fs.readFileSync(ignore, "utf8") : "";
  const have = had.split(/\r?\n/);
  const add = patterns.filter((l) => !have.includes(l));
  const rel = tree.relative(file);
  const inHistory = tracked(tree.root, rel);
  if (!add.length && !inHistory) return;
  tree.withTreeLock(() => {
    if (add.length) fs.writeFileSync(ignore, `${had}${had && !had.endsWith("\n") ? "\n" : ""}${add.join("\n")}\n`);
    if (inHistory) runGit(tree.root, ["rm", "--cached", "--quiet", "--", rel]);
    tree.commit(subject, [".gitignore"]);
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
    /** A file that leaves the research with its living protected by this mode (spec 151); full or none: the full file. */
    living?: LivingMode;
  },
) {
  const persons = opts.research ? researchScope(tree, opts.research) : undefined;
  // who is living: judged on the whole tree as its full file says it (a research's file of part of it too), once
  const guard = opts.living && opts.living !== "full" ? { mode: opts.living, living: livingOf(rawRecords(exportGedcom(tree, { for: "standard" }).text), new Date().getFullYear()) } : undefined;
  const hidden = guard ? new Set([...guard.living].map((x) => x.slice(1, -1))) : undefined;
  // a protected file is tied to nothing of the research (spec 151 §3): no link back, none of its work on the people
  const tied = !guard;
  const set = opts.for !== "strom" || opts.images === false ? undefined : (opts.images ?? excerptSettings(tree));
  const images =
    set && set.for !== "none"
      ? planExcerpts(tree, set.shared, { quality: set.quality, for: set.for, maxBytes: set.mb * 1024 * 1024, persons, budgetMs: opts.budgetMs })
      : undefined;
  // each excerpt's mark, for an app that asks for it in full (a strom-research:// link)
  // an app that opens links shows what the research knows of a person too (the same version)
  const research = tied && opts.for === "strom" && appOpensLinks(new Settings(tree.env, {}), opts.stromVersion);
  const clips = research && !!images;
  // …and where the tree ends, for an app that shows it
  const edges = tied && opts.for === "strom" && appShowsEdges(new Settings(tree.env, {}), opts.stromVersion);
  // …and the new versions of stories the user approved, for an app that shows them
  const storyDrafts = tied && opts.for === "strom" && appShowsStoryDrafts(new Settings(tree.env, {}), opts.stromVersion);
  const coupleResi = opts.for === "strom" && appShowsCoupleEvents(new Settings(tree.env, {}), opts.stromVersion);
  // …and who read each source, for an app that shows it
  const sourceReads = tied && opts.for === "strom" && appShowsSourceReads(new Settings(tree.env, {}), opts.stromVersion);
  // …and the wording of each transcript with the user's confirmation of it, for an app that confirms one
  const confirms = sourceReads && appConfirmsTranscripts(new Settings(tree.env, {}), opts.stromVersion);
  const factStatus = opts.for === "strom" && appShowsFactStatus(new Settings(tree.env, {}), opts.stromVersion);
  const turnsExcerpts = opts.for === "strom" && appTurnsExcerpts(new Settings(tree.env, {}), opts.stromVersion);
  const noCouple = opts.for === "strom" && appKnowsNoCouple(new Settings(tree.env, {}), opts.stromVersion);
  const marriageOrder = opts.for === "strom" && appKnowsFamsOrder(new Settings(tree.env, {}), opts.stromVersion, true);
  const archive = opts.for === "strom" && appKnowsArchive(new Settings(tree.env, {}), opts.stromVersion);
  const titles = opts.for === "strom" && appReadsTitles(new Settings(tree.env, {}), opts.stromVersion);
  // …and what each variant of a hypothesis would connect, for an app that shows it
  const hypothesisLinks = tied && opts.for === "strom" && appShowsHypothesisLinks(new Settings(tree.env, {}), opts.stromVersion);
  // …and who decided a hypothesis (an agent's decision marked), for an app that shows it
  const hypothesisDecider = tied && opts.for === "strom" && appShowsHypothesisDecider(new Settings(tree.env, {}), opts.stromVersion);
  // …and what a pick of a hypothesis there needs (the decision before, the agent's proposal — never where no agent works)
  const hypothesisPick = tied && opts.for === "strom" && appDecidesHypotheses(new Settings(tree.env, {}), opts.stromVersion) ? { agent: !actsAsArchive(tree) } : undefined;
  // …and the sides of a conflict of the user's edit, for an app that decides it
  const conflictSides = tied && opts.for === "strom" && appDecidesConflicts(new Settings(tree.env, {}), opts.stromVersion);
  // …and the reading of a document each source is an entry of, for an app that opens it
  const readings = tied && opts.for === "strom" && appShowsReadings(new Settings(tree.env, {}), opts.stromVersion);
  // …and why a source has no image though the research has one, for an app that says so and asks for it
  const omitted = tied && !!images && appShowsOmittedImages(new Settings(tree.env, {}), opts.stromVersion);
  // …and the groups of surname forms the user made one family and the suggestions rejected, for an app that reads them
  const surnameGroups = opts.for === "strom" && appReadsSurnameGroups(new Settings(tree.env, {}), opts.stromVersion) ? surnamesForExport(tree) : undefined;
  // …and the bounds of a lineage the person set, for an app that keeps them
  const lines = opts.for === "strom" && appReadsLines(new Settings(tree.env, {}), opts.stromVersion) ? lineMarks(tree) : undefined;
  // …and the research's place records with each fact's place pointing to its record, for an app that reads them
  const placeRecords = opts.for === "strom" && appReadsPlaceRecords(new Settings(tree.env, {}), opts.stromVersion);
  // …and where each value came from (an import, the user, the research), for an app that shows it (spec 066)
  const origins = tied && opts.for === "strom" && appShowsOrigin(new Settings(tree.env, {}), opts.stromVersion);
  // …and the verification of facts against their originals, for an app that shows it (spec 065)
  const verify = tied && opts.for === "strom" && appShowsVerify(new Settings(tree.env, {}), opts.stromVersion) ? verifyMarks(tree) : undefined;
  // …and the research in its table: each person's places among the lines, what waits outside, who it added
  const table = tied && opts.for === "strom" && appShowsResearchTable(new Settings(tree.env, {}), opts.stromVersion) ? tableMarks(tree) : undefined;
  // …and each source's location field by field (folio, image, the rest), for an app that reads them
  const sourceFields = opts.for === "strom" && appReadsSourceFields(new Settings(tree.env, {}), opts.stromVersion);
  // …and the user's main citation of a fact with the events each source records, for an app that reads them (spec 095)
  const nameStatus = opts.for === "strom" && appReadsNameStatus(new Settings(tree.env, {}), opts.stromVersion);
  const mainCitations = opts.for === "strom" && appReadsMainCitation(new Settings(tree.env, {}), opts.stromVersion);
  // …and which sources can be read again from their original here, for an app that offers it (never in an archive)
  const shared = new Settings(tree.env, {}).shared()?.value;
  const original = tied && opts.for === "strom" && appReadsSourcesAgain(new Settings(tree.env, {}), opts.stromVersion) && !actsAsArchive(tree) ? (s: Source) => readsAgain(tree, shared, s) : undefined;
  // the files of the app's tree (spec 108): in the file (their working copy as a data URL) within the limit of the
  // images (excerpts.mb, counted on their own); beyond it by their name and hash alone, said — the file for any program none
  const mediaMb = set?.mb ?? new Settings(tree.env, {}).excerpts(tree.config).mb;
  const media = opts.for === "strom" && opts.images !== false ? inlineMedia(tree, shared, mediaMb * 1024 * 1024) : undefined;
  const made = exportGedcom(tree, { for: opts.for, ...(hidden ? { hidden } : {}), ...(media ? { appMedia: media.appMedia } : {}), ...(surnameGroups ? { surnameGroups } : {}), ...(lines ? { lines } : {}), ...(placeRecords ? { placeRecords } : {}), ...(origins ? { origins } : {}), ...(verify ? { verify } : {}), ...(table ? { table } : {}), ...(sourceFields ? { sourceFields } : {}), ...(mainCitations ? { mainCitations } : {}), ...(nameStatus ? { nameStatus } : {}), stromVersion: opts.stromVersion, ...(persons ? { persons } : {}), ...(images ? { excerpts: images.of } : {}), ...(clips ? { clips } : {}), ...(research ? { research } : {}), ...(edges ? { edges } : {}), ...(storyDrafts ? { storyDrafts } : {}), ...(coupleResi ? { coupleResi } : {}), ...(sourceReads ? { sourceReads } : {}), ...(confirms ? { confirms } : {}), ...(factStatus ? { factStatus } : {}), ...(archive ? { archive } : {}), ...(turnsExcerpts ? { turnsExcerpts } : {}), ...(noCouple ? { noCouple } : {}), ...(marriageOrder ? { marriageOrder } : {}), ...(titles ? { titles } : {}), ...(hypothesisLinks ? { hypothesisLinks } : {}), ...(hypothesisDecider ? { hypothesisDecider } : {}), ...(hypothesisPick ? { hypothesisPick } : {}), ...(conflictSides ? { conflictSides } : {}), ...(readings ? { readings } : {}), ...(original ? { original } : {}), ...(omitted ? { omitted: images.omitted } : {}) });
  const shielded = guard ? protectGedcom(made.text, { mode: guard.mode, living: guard.living, livingLabel: labels(tree.lang)("livingPerson") }) : undefined;
  const result = shielded
    ? { ...made, text: shielded.text, stats: { ...made.stats, events: made.stats.events - shielded.left.events, sources: made.stats.sources - shielded.left.sources } }
    : made;
  const findings = validateGedcom(result.text, opts.for === "standard" ? { strict: true } : {});
  const file = opts.out ?? gedFile(tree, opts.for, opts.research, guard?.mode);
  if (!hasGedErrors(findings) && !tree.dryRun) {
    if (guard && file.startsWith(path.join(tree.root, "output") + path.sep)) ignoreOutputs(tree, file, IGNORE_PROTECTED, "The files with the living protected stay out of the history");
    else if (opts.for === "strom" && file.startsWith(path.join(tree.root, "output") + path.sep)) ignoreStromGed(tree, file);
    writeFileAtomic(file, result.text);
  }
  return { ...result, findings, file, for: opts.for, ...(guard && shielded ? { living: { mode: guard.mode, count: shielded.living } } : {}), ...(images && set ? { images: images.report, imageSettings: set } : {}), ...(media && (media.said.files || media.said.left) ? { media: { ...media.said, mb: mediaMb } } : {}) };
}

/** The files of the app's tree in a file that leaves the computer: each record's working copy once, within `max` bytes. */
function inlineMedia(tree: Tree, shared: string | undefined, max: number) {
  const said = { files: 0, left: 0 };
  const given = new Map<string, AppMediaFile | undefined>();
  let held = 0;
  const fileOf = (rec: Input): AppMediaFile | undefined => {
    if (given.has(rec.id)) return given.get(rec.id);
    const copy = servedCopy(tree.root, shared, rec);
    let got: AppMediaFile | undefined;
    if (copy && held + copy.bytes <= max) {
      try {
        got = { data: `data:${copy.mime};base64,${fs.readFileSync(copy.file).toString("base64")}`, mime: copy.mime };
        held += copy.bytes;
        said.files++;
      } catch {
        got = undefined;
      }
    } else if (copy) said.left++;
    given.set(rec.id, got);
    return got;
  };
  return { appMedia: { places: treeMedia(tree.list<Input>("input"), (id) => tree.get(id)), fileOf }, said };
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
      "made smaller for them).\n" +
      "Both files of output/ carry all details of the living — for an own backup or transfer, not for sharing. A file\n" +
      "going out protects them: --living (the people living by the rule of the Strom app's outputs: no death, burial or\n" +
      "cremation and born less than 110 years ago, by their own dates, their marriages and their children; unknown:\n" +
      "living). A protected file says so in its header (1 _STROM_PRIVACY) and is never taken back by strom sync.",
    options: [
      { name: "for", type: "string", value: "<reader>", description: "standard (any program), strom (the Strom app) or both (default: the setting gedcom.for, both)" },
      { name: "research", type: "string", value: "<G…>", description: "only the people of one research: the focus, their ancestors and partners — siblings and side branches are left out (to protect the living instead: --living)" },
      { name: "living", type: "string", value: "[<mode>]", bare: "", description: "protect the living in a file going out: initials (initials and the year of birth; the default, or the setting gedcom.living), surname (the surname alone), hidden (no name), full (all their details); the dead as they are. Written as output/tree-<mode>.ged, never into the history, or with --out outside the research folder" },
      { name: "out", type: "string", value: "<file>", description: "write one file here instead of output/ (the standard one, or --for strom); with the living protected by the setting gedcom.living unless --living full" },
      { name: "images", type: "boolean", description: "the Strom file with the entries' images (the default; kept for older scripts)" },
      { name: "images-quality", type: "string", value: "<q>", description: "small (1000 px, grey), normal, sharp (1600 px) — default: the setting excerpts.quality (normal)" },
      { name: "images-for", type: "string", value: "<whose>", description: "none, line, family, connected or all (every source with an excerpt) — default: the setting excerpts.for (family: the ancestors and their families)" },
      { name: "images-max-mb", type: "string", value: "<n>", description: "limit of all excerpts together — over it smaller, then the farthest left out; with all, the entries nobody cites only where there is room (default: the setting excerpts.mb, 200)" },
    ],
    examples: ["strom export gedcom", "strom export gedcom --research G0001", "strom export gedcom --living --out ~/Desktop/novak.ged", "strom export gedcom --for standard --living surname", "strom export gedcom --for strom --images-for all"],
    run(ctx, { opts }) {
      const tree = ctx.tree();
      const research = typeof opts.research === "string" ? resolveResearch(tree, opts.research) : undefined;
      const out = typeof opts.out === "string" ? ctx.resolvePath(opts.out) : undefined;
      const which = typeof opts.for === "string" ? opts.for.toLowerCase() : undefined;
      if (which && which !== "both" && !GED_PROFILES.includes(which as GedProfile)) throw new UsageError(`invalid --for "${opts.for}"`, { hint: "standard, strom or both" });
      const asked = ["images-max-mb", "images-quality", "images-for"].some((k) => opts[k] !== undefined);
      if ((asked || opts.images) && which === "standard") throw new UsageError("images go into the file for the Strom app only", { hint: "strom export gedcom --for strom" });
      // --out alone: the file for any program (one file; the Strom app reads it too)
      const profiles: GedProfile[] = which === "both" ? [...GED_PROFILES] : which ? [which as GedProfile] : out ? ["standard"] : ctx.settings.gedcomFor(tree.config);
      if (out && profiles.length > 1) throw new UsageError("--out writes one file", { hint: "add --for standard or --for strom" });
      // the living (spec 151): --living a mode; alone the setting gedcom.living, else initials; a file going out (--out)
      // by the setting; the files of output/ full as always, and beside them a protected one where the setting asks
      const setting = ctx.settings.gedcomLiving(tree.config);
      let living: LivingMode | undefined;
      if (opts.living !== undefined) {
        const word = String(opts.living);
        living = word.trim() === "" ? (setting !== "full" ? setting : "initials") : livingModeOf(word);
        if (!living) throw new UsageError(`invalid --living "${word}"`, { hint: "full, initials, surname or hidden — strom help export gedcom", code: "export.living.mode", params: { mode: word } });
      } else if (out) living = setting;
      const beside = opts.living === undefined && !out && setting !== "full" ? setting : undefined;
      if (living && living !== "full" && out) {
        const inside = path.relative(tree.root, out);
        const own = profiles.map((p) => gedFile(tree, p, research, living));
        if ((!inside.startsWith("..") && !path.isAbsolute(inside)) && !own.includes(out))
          throw new UsageError("a protected file goes into the research folder only as its own file in output/ (never into the history)", {
            hint: `strom export gedcom --living ${living} (writes ${tree.relative(own[0]!)}) — or --out outside the research folder`,
            code: "export.living.in-tree",
            params: { file: tree.relative(own[0]!), mode: living },
          });
      }
      const images = asked ? imageSettings(ctx, tree, opts) : undefined;
      const write = (p: GedProfile, mode: LivingMode | undefined) =>
        writeTreeGed(tree, {
          for: p,
          stromVersion: ctx.settings.stromVersion(tree.config),
          ...(research ? { research } : {}),
          ...(out ? { out } : {}),
          ...(images ? { images } : {}),
          ...(mode && mode !== "full" ? { living: mode } : {}),
        });
      const results = profiles.flatMap((p) => [write(p, living), ...(beside ? [write(p, beside)] : [])]);
      const bad = results.filter((r) => hasGedErrors(r.findings));
      if (bad.length) {
        return {
          text: lines(...bad.map((r) => `GEDCOM ${r.for} NOT written — validation error(s):\n${findingRows(r.findings)}`), "→ this is a bug in strom; please report it"),
          data: { ok: false, results: results.map((r) => ({ for: r.for, file: r.file, findings: r.findings })) },
          exitCode: 1,
        };
      }
      // Commit the output when it lives in the tree and the evidence is intact (the Strom file, with its images: never).
      const inTree = results.filter((r) => r.for === "standard" && !("living" in r && r.living) && r.file.startsWith(tree.root + path.sep));
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
            "living" in r && r.living ? ui(lang, "ui.export.living", { n: r.living.count, mode: ui(lang, `ui.living.mode.${r.living.mode}`) }) : undefined,
            r.images && r.imageSettings ? imagesLines(r.images, r.imageSettings, lang) : undefined,
            "media" in r && r.media?.left ? ui(lang, "ui.export.media.left", { n: r.media.left, mb: numberIn(lang, r.media.mb, { maximumFractionDigits: 3, useGrouping: false }) }) : undefined,
            r.findings.length ? findingRows(r.findings) : undefined,
          );
        }),
        committed ? ui(lang, "ui.export.committed") : undefined,
        // a full file: said what it carries (spec 151 K3.1), and how to give one away
        results.some((r) => !("living" in r && r.living)) ? ui(lang, "ui.living.all") : undefined,
        results.some((r) => !("living" in r && r.living)) && !results.some((r) => "living" in r && r.living) ? ui(lang, "ui.export.living.hint") : undefined,
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
          files: results.map((r) => ({ for: r.for, file: r.file, stats: r.stats, findings: r.findings, ...("living" in r && r.living ? { living: r.living } : {}) })),
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
