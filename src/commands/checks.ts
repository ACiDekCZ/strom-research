// check · verify · guard · repair · seal adopt · history

import { mb, tidyPlan, TIDY_SAID } from "../core/tidy.ts";
import { actsAsArchive } from "../core/state.ts";
import fs from "node:fs";
import path from "node:path";
import { register } from "../cli/registry.ts";
import type { Context } from "../cli/context.ts";
import { counted, lines, table } from "../cli/format.ts";
import { check, SHARED_MISSING, sharedMissing, type Finding } from "../core/check.ts";
import { guard } from "../core/guard.ts";
import { unprovenPeople } from "../core/review.ts";
import { NOT_DOWNLOADED, SEALED_PATHS, notDownloaded, notDownloadedError, verifyFast, verifyFull } from "../core/integrity.ts";
import { verifyCommitSeal } from "../core/seal.ts";
import { adoptSeal } from "../cli/seal.ts";
import { NeedsConsentError, StromError } from "../core/errors.ts";
import * as git from "../core/git.ts";
import { ui } from "../cli/ui.ts";
import { history } from "../core/live.ts";
import { humanWhen } from "../cli/human.ts";
import { isAgent } from "../core/which.ts";
import { writeProblems } from "../core/writable.ts";
import type { Tree } from "../core/tree.ts";

/**
 * A finding a person may meet with nothing gone wrong, said in their language (found on Windows: "counter P is behind
 * existing IDs" in a Czech research, after a write a held file stopped); the rest stay strom's own words.
 */
function said(f: Finding, lang: string | undefined): string {
  if (lang && f.code === "counter" && f.id) return ui(lang, "ui.check.counter", { prefix: f.id.charAt(0) });
  if (lang && f.code === "unwritable") return ui(lang, "ui.check.unwritable");
  if (lang && f.code === "foreign-seal") return ui(lang, "ui.check.foreignseal");
  if (lang && f.code === NOT_DOWNLOADED) return ui(lang, "ui.check.notdownloaded", { n: f.count ?? 1, first: f.file ?? "" });
  if (lang && f.code === SHARED_MISSING) return ui(lang, "ui.check.sharedmissing", { n: f.count ?? 1, first: f.id ?? "" });
  if (lang && f.code === "after-death" && f.params) return ui(lang, f.params.kind === "weddingAfterDeath" ? "ui.check.afterdeath.wedding" : "ui.check.afterdeath", f.params);
  if (lang && f.code === "participant-long-name") return ui(lang, "ui.check.participantnames", { n: f.count ?? 1 });
  return f.message;
}

/** Its next step said as its finding is (the research sealed on another computer: taken over by the person). */
function hintSaid(f: Finding, lang: string | undefined): string | undefined {
  if (lang && f.code === "foreign-seal") return ui(lang, "ui.check.foreignseal.hint");
  if (lang && f.code === NOT_DOWNLOADED) return ui(lang, "ui.check.notdownloaded.hint");
  if (lang && f.code === SHARED_MISSING) return ui(lang, "ui.check.sharedmissing.hint", { show: `strom ${f.id?.startsWith("M") ? "media" : "input"} show ${f.id ?? ""}` });
  if (lang && f.code === "after-death" && f.params)
    return ui(lang, "ui.check.afterdeath.hint", { show: `strom person show ${f.params.person}`, dismiss: `strom quality dismiss ${f.params.kind} ${f.params.person} --subject ${f.params.year}` });
  return f.hint;
}

/**
 * Findings as a table (strom's own words: what to run), the sum in the research's language when given; `person`: a
 * person reads it, so what they may meet is said in that language too (an agent and --json read the English).
 */
export function report(findings: Finding[], okText: string, lang?: string, person = false) {
  const errors = findings.filter((f) => f.level === "error");
  const sum = { errors: errors.length, warnings: findings.length - errors.length };
  const text =
    findings.length === 0
      ? okText
      : lines(
          table(findings.map((f) => [f.level === "error" ? "ERROR" : "warn", f.code, f.id ?? f.file ?? "", said(f, person ? lang : undefined), f.hint ? `→ ${hintSaid(f, person ? lang : undefined)}` : ""])),
          "",
          lang ? ui(lang, "ui.check.found", sum) : `${counted(sum.errors, "error")}, ${counted(sum.warnings, "warning")}`,
        );
  return { text, data: { ok: errors.length === 0, findings }, exitCode: errors.length ? 1 : 0 };
}


/**
 * A research that cannot be written is no "ok" (found on Windows: check said ok where every write failed) — its
 * .strom and .git tried; what and why strom doctor says.
 */
function unwritable(tree: Tree, agent: boolean): Finding[] {
  return writeProblems(tree.root, agent)
    .filter((p) => p.cause !== "nolink")
    .map((p) => ({
      level: "error" as const,
      code: "unwritable",
      file: path.relative(tree.root, p.where) || ".",
      message: p.cause === "sandbox" ? "writing refused — strom runs under an agent, most likely its sandbox forbids it" : "writing refused — no right to write there",
      hint: "strom doctor",
    }));
}

register(
  {
    path: ["check"],
    summary: "Is the evidence consistent and untouched? (schema, references, seals, losses)",
    group: "history",
    tree: true,
    run(ctx) {
      const tree = ctx.tree();
      // one language from the first line to the last: a person reads it in the research's language (the findings a
      // person may meet too); an agent reads it all in English, as it reads strom's errors — its findings say what to
      // run (found on Mac: English findings above a Czech sum)
      const agent = isAgent(ctx.env);
      const lang = agent ? "en" : tree.lang;
      // the shared folder's files of this research (its material, the images nobody fetches again): only here and in
      // strom verify, never before a command (each file asked whether it is there)
      const checked = report([...verifyFull(tree).findings, ...check(tree), ...guard(tree), ...unwritable(tree, agent), ...sharedMissing(tree)], ui(lang, "ui.check.ok"), lang, !agent);
      // much kept beside the research that can go (an older strom never tidied it): a sentence, in that language —
      // none where .strom cannot be listed (found on Windows: a folder denied to strom ended check with "no permission"
      // instead of its finding; unwritable says it)
      let disk: ReturnType<typeof tidyPlan> | undefined;
      try {
        disk = tidyPlan(tree);
      } catch {
        disk = undefined;
      }
      const out =
        disk && disk.frees >= TIDY_SAID
          ? { ...checked, text: lines(checked.text, ui(lang, "ui.tidy.hint", { strom: mb(disk.size.strom, lang), size: mb(disk.frees, lang) })), data: { ...checked.data, disk: { strom: disk.size.strom, frees: disk.frees } } }
          : checked;
      // not an error — research to do: who rests on no record of their own
      const unproven = unprovenPeople(tree).filter((u) => !u.living).length;
      // an archive: what to research is no matter of it
      if (!unproven || actsAsArchive(tree)) return out;
      return { ...out, text: lines(out.text, ui(lang, "ui.check.unproven", { n: unproven })), data: { ...out.data, unproven } };
    },
  },
  {
    path: ["verify"],
    summary: "Was anything changed outside strom? (seal check of every record and commit)",
    group: "history",
    tree: true,
    options: [{ name: "fast", type: "boolean", description: "only what changed since the last commit (what runs before every write)" }],
    run(ctx, { opts }) {
      const tree = ctx.tree();
      return report(opts.fast ? verifyFast(tree).findings : [...verifyFull(tree).findings, ...sharedMissing(tree)], "ok — every record matches its seal");
    },
  },
  {
    path: ["guard"],
    summary: "Did anything get lost since the last commit?",
    group: "history",
    tree: true,
    run(ctx) {
      return report(guard(ctx.tree()), "ok — nothing lost since the last commit");
    },
  },
);

interface Repaired {
  restored: string[];
  quarantined: string[];
  from: string;
}

function quarantine(tree: Tree, rel: string, stamp: string): void {
  const abs = path.join(tree.root, rel);
  if (!fs.existsSync(abs)) return;
  const dest = path.join(tree.root, ".strom", "quarantine", stamp, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(abs, dest);
}

/** Return data/ and strom.json to the newest sealed commit. */
function repair(tree: Tree): Repaired {
  // files only in iCloud: never written over from the history (the cloud may hold a newer one), their placeholders
  // never taken away — downloaded first, then whatever else is wrong is repaired
  const cloud = notDownloaded(tree.root);
  if (cloud.length) throw notDownloadedError(cloud);
  const key = tree.requireKey();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const head = git.headInfo(tree.root);
  const sealed = git.findCommit(tree.root, (t, m) => verifyCommitSeal(key, t, m));
  if (!sealed) throw new StromError("no sealed commit found — nothing to restore from", { hint: "ask the user; the history may have been rewritten" });
  const headSealed = head !== undefined && verifyCommitSeal(key, head.tree, head.message);

  // Paths to compare: whatever differs between the sealed commit and the working tree.
  const candidates = new Set<string>();
  for (const c of git.changes(tree.root, SEALED_PATHS)) candidates.add(c.path);
  if (!headSealed) {
    const r = git.runGit(tree.root, ["diff", "--name-only", "-z", sealed, "HEAD", "--", ...SEALED_PATHS]);
    for (const p of r.stdout.split("\0").filter(Boolean)) candidates.add(p);
  }
  const sealedContent = git.showFiles(tree.root, sealed, [...candidates]);
  const restored: string[] = [];
  const quarantined: string[] = [];
  for (const rel of [...candidates].sort()) {
    const abs = path.join(tree.root, rel);
    const want = sealedContent.get(rel);
    const have = fs.existsSync(abs) ? fs.readFileSync(abs, "utf8") : undefined;
    if (want === have) continue;
    quarantine(tree, rel, stamp);
    if (want === undefined) {
      fs.rmSync(abs);
      quarantined.push(rel);
    } else {
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, want);
      restored.push(rel);
    }
  }
  if (!headSealed) tree.commit(`Repair: restore the sealed state of ${sealed.slice(0, 8)}\n\nCommits made outside strom were undone for data/, strom.json, history/ and quality/.`, SEALED_PATHS);
  return { restored, quarantined, from: sealed };
}

register(
  {
    path: ["repair"],
    summary: "Undo changes made outside strom: restore the last sealed state",
    group: "history",
    tree: true,
    description:
      "Edited records are restored, records created outside strom are removed; copies of everything\n" +
      "that was replaced are kept in .strom/quarantine/. Commits made with git directly are undone for data/.",
    run(ctx) {
      const tree = ctx.tree();
      const r = tree.withTreeLock(() => repair(tree));
      const after = verifyFast(tree).findings.filter((f) => f.level === "error");
      const text =
        r.restored.length + r.quarantined.length === 0
          ? "nothing to repair — every record matches its seal"
          : lines(
              ...r.restored.map((f) => `restored  ${f}`),
              ...r.quarantined.map((f) => `removed   ${f}`),
              `sealed state: ${r.from.slice(0, 8)} · copies of replaced files: .strom/quarantine/`,
              after.length ? `still ${counted(after.length, "problem")} → strom verify` : undefined,
            );
      return { text, data: { ...r, ok: after.length === 0 }, exitCode: after.length ? 1 : 0 };
    },
  },
  {
    path: ["seal", "adopt"],
    summary: "Take over a tree sealed on another computer (the user runs this in a terminal)",
    group: "history",
    tree: true,
    description: "Checks the chain and every record hash, then creates this computer's seal key for the tree.\nAgents must not run this — it needs the user's confirmation.",
    person: "Taking over this tree on this computer (the seal) is the user's own, in their terminal",
    run: async (ctx: Context) => {
      const tree = ctx.tree();
      // a person reads it in the research's language (the menu, a link's terminal, the setup go the same way)
      const lang = tree.lang;
      const name = tree.config.name;
      if (tree.key) return { text: ui(lang, "ui.seal.already", { name }), data: { adopted: false } };
      if (!ctx.interactive)
        throw new NeedsConsentError([
          { key: "seal", kind: "consent", question: "Take over this tree on this computer?", set: "strom seal adopt" },
        ]);
      const r = await adoptSeal(ctx, tree, lang);
      if (r.adopted) return { text: ui(lang, "ui.seal.adopted", { name }), data: { adopted: true } };
      if (r.why === "problems") {
        const found = report(r.problems!, "", lang, true);
        return { ...found, text: lines(found.text, ui(lang, "ui.seal.problems")), data: { ...found.data, adopted: false } };
      }
      return { text: ui(lang, r.why === "already" ? "ui.seal.already" : "ui.cancelled", { name }), data: { adopted: false } };
    },
  },
  {
    path: ["history"],
    summary: "What changed recently (one line per change)",
    group: "history",
    tree: true,
    run(ctx) {
      const tree = ctx.tree();
      const commits = git.log(tree.root, ctx.limit);
      // what each change was, in the research's language as the Strom app shows it (/log) — a change with nothing to
      // show a person (the agents' files, the tree made) left out of the lines, never out of --json (found 2026-10-04:
      // "strom sync undo: 5 changes" in a German research)
      const lang = tree.lang;
      const said = new Map(history(tree.root, tree, [`-n${Math.max(1, ctx.limit)}`]).map((e) => [e.head, e.text]));
      const rows = commits.flatMap((c) => {
        // no operation behind it (only its English subject): nothing for a person
        const text = (said.get(c.hash) ?? []).filter((t) => t !== c.subject);
        if (!text.length) return [];
        return [[c.hash.slice(0, 8), humanWhen(c.at, lang), text.length > 1 ? `${text[0]} ${ui(lang, "ui.recent.morechanges", { n: text.length - 1 })}` : text[0]!]];
      });
      return { text: rows.length ? table(rows) : ui(lang, "ui.history.none"), data: { commits } };
    },
  },
);
