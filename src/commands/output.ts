// export gedcom · gedcom validate — the automated output.

import fs from "node:fs";
import path from "node:path";
import { register } from "../cli/registry.ts";
import { lines, table } from "../cli/format.ts";
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

/** Write one GEDCOM file and validate it by the rules of its reader. */
export function writeTreeGed(tree: Tree, opts: { for: GedProfile; stromVersion?: string | undefined; research?: Research; out?: string }) {
  const persons = opts.research ? researchScope(tree, opts.research) : undefined;
  const result = exportGedcom(tree, { for: opts.for, stromVersion: opts.stromVersion, ...(persons ? { persons } : {}) });
  const findings = validateGedcom(result.text, opts.for === "standard" ? { strict: true } : {});
  const file = opts.out ?? gedFile(tree, opts.for, opts.research);
  if (!hasGedErrors(findings) && !tree.dryRun) writeFileAtomic(file, result.text);
  return { ...result, findings, file, for: opts.for };
}

/** The GEDCOM files the settings ask for (both by default), from the same evidence. Used after sessions. */
export function writeGedcoms(ctx: Context, tree: Tree, research?: Research) {
  return ctx.settings.gedcomFor(tree.config).map((p) =>
    writeTreeGed(tree, { for: p, stromVersion: ctx.settings.stromVersion(tree.config), ...(research ? { research } : {}) }),
  );
}

register(
  {
    path: ["export", "gedcom"],
    summary: "Generate the GEDCOM files, validated: output/tree.ged for any program, output/tree-strom.ged for the Strom app",
    group: "output",
    tree: true,
    description:
      "Both come from the same evidence (GEDCOM 5.5.1, UTF-8). The standard one uses no extension tags; the Strom\n" +
      "one is shaped to what the Strom app reads (_WITN, _STORY, _FREL/_MREL, a source per page). QUAY is the\n" +
      "quality of each citation's evidence; leads say so in a note; retracted and disproven facts are left out;\n" +
      "of several facts of a kind the best supported comes first. Which files: --for or the setting gedcom.for.",
    options: [
      { name: "for", type: "string", value: "<reader>", description: "standard (any program), strom (the Strom app) or both (default: the setting gedcom.for, both)" },
      { name: "research", type: "string", value: "<G…>", description: "only the people of one research (focus, ancestors, partners)" },
      { name: "out", type: "string", value: "<file>", description: "write here instead of output/ (with --for standard or strom)" },
    ],
    examples: ["strom export gedcom", "strom export gedcom --research G0001", "strom export gedcom --for standard --out ~/Desktop/novak.ged"],
    run(ctx, { opts }) {
      const tree = ctx.tree();
      const research = typeof opts.research === "string" ? resolveResearch(tree, opts.research) : undefined;
      const out = typeof opts.out === "string" ? ctx.resolvePath(opts.out) : undefined;
      const which = typeof opts.for === "string" ? opts.for.toLowerCase() : undefined;
      if (which && which !== "both" && !GED_PROFILES.includes(which as GedProfile)) throw new UsageError(`invalid --for "${opts.for}"`, { hint: "standard, strom or both" });
      const profiles: GedProfile[] = which === "both" ? [...GED_PROFILES] : which ? [which as GedProfile] : ctx.settings.gedcomFor(tree.config);
      if (out && profiles.length > 1) throw new UsageError("--out writes one file", { hint: "add --for standard or --for strom" });
      const results = profiles.map((p) => writeTreeGed(tree, { for: p, stromVersion: ctx.settings.stromVersion(tree.config), ...(research ? { research } : {}), ...(out ? { out } : {}) }));
      const bad = results.filter((r) => hasGedErrors(r.findings));
      if (bad.length) {
        return {
          text: lines(...bad.map((r) => `GEDCOM ${r.for} NOT written — validation error(s):\n${findingRows(r.findings)}`), "→ this is a bug in strom; please report it"),
          data: { ok: false, results: results.map((r) => ({ for: r.for, file: r.file, findings: r.findings })) },
          exitCode: 1,
        };
      }
      // Commit the output when it lives in the tree and the evidence is intact.
      const inTree = results.filter((r) => r.file.startsWith(tree.root + path.sep));
      let committed = false;
      if (inTree.length && !tree.dryRun && verifyFast(tree).findings.every((f) => f.level !== "error")) {
        const s0 = results[0]!.stats;
        tree.withTreeLock(() => tree.commit(`Export ${inTree.map((r) => path.basename(r.file)).join(", ")}: ${s0.persons} persons, ${s0.families} families`, inTree.map((r) => tree.relative(r.file))));
        committed = true;
      }
      const text = lines(
        ...results.map((r) => {
          const s = r.stats;
          return lines(
            `${ctx.display(r.file)} (${r.for === "strom" ? "for the Strom app" : "standard, any program"}) — ${s.persons} persons · ${s.families} families · ${s.events} facts · ${s.sources} sources${s.skipped ? ` · ${s.skipped} retracted/disproven left out` : ""}`,
            `  valid GEDCOM 5.5.1${r.findings.length ? ` (${r.findings.length} warning(s))` : ""}`,
            r.findings.length ? findingRows(r.findings) : undefined,
          );
        }),
        committed ? "committed" : undefined,
      );
      const first = results[0]!;
      return { text, data: { ok: true, file: first.file, stats: first.stats, findings: first.findings, files: results.map((r) => ({ for: r.for, file: r.file, stats: r.stats, findings: r.findings })) } };
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
        text: findings.length ? lines(findingRows(findings), "", `${errors} error(s), ${findings.length - errors} warning(s)`) : "ok — valid GEDCOM 5.5.1",
        data: { ok: errors === 0, findings },
        exitCode: errors ? 1 : 0,
      };
    },
  },
);
