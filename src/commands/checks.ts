// check · verify · guard · repair · repair undo · seal adopt · seal accept · history

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
import { AFTER_REPAIR_HINT, NOT_DOWNLOADED, OTHER_KEY, otherKeyError, verifyFast, verifyFull } from "../core/integrity.ts";
import { HISTORY_REVERTED, LOST_HINT, REPAIR_ASKS_ABOVE, applyRepair, applyUndo, historyLost, isRecordFile, planRepair, planUndo, quarantines, repairAsks, repairWay, sameRepair, type RepairPlan, type UndoPlan } from "../core/repair.ts";
import { otherKeys } from "../core/seal.ts";
import { adoptSeal, keysToUnite } from "../cli/seal.ts";
import { NeedsConsentError, StromError, UsageError } from "../core/errors.ts";
import * as git from "../core/git.ts";
import { ui, type UIKey } from "../cli/ui.ts";
import { history, liveRunning } from "../core/live.ts";
import { ACCEPT_HINT, acceptWay, guardOrDamaged, applyAccept, nothingToAccept, planAccept, type AcceptPlan } from "../core/accept.ts";
import { humanWhen, verifyWaitsMore } from "../cli/human.ts";
import { verifyCounts } from "../core/verify.ts";
import { isAgent } from "../core/which.ts";
import { writeProblems } from "../core/writable.ts";
import type { Tree } from "../core/tree.ts";
import type { RecordType } from "../core/model.ts";
import { applyReturn, planReturn, resolveTarget, type ReturnPlan } from "../core/timetravel.ts";
import { liveWorkers, runsAtWork } from "../core/workers.ts";
import { receivedPending } from "../core/sync.ts";

/**
 * A finding a person may meet with nothing gone wrong, said in their language (found on Windows: "counter P is behind
 * existing IDs" in a Czech research, after a write a held file stopped); the rest stay strom's own words.
 */
function said(f: Finding, lang: string | undefined): string {
  if (lang && f.code === HISTORY_REVERTED) return ui(lang, "ui.check.lost", { n: f.count ?? 0 });
  if (lang && f.code === "counter" && f.id) return ui(lang, "ui.check.counter", { prefix: f.id.charAt(0) });
  if (lang && f.code === "unwritable") return ui(lang, "ui.check.unwritable");
  if (lang && f.code === "foreign-seal") return ui(lang, "ui.check.foreignseal");
  if (lang && f.code === OTHER_KEY) return ui(lang, "ui.check.otherkey");
  if (lang && f.code === NOT_DOWNLOADED) return ui(lang, "ui.check.notdownloaded", { n: f.count ?? 1, first: f.file ?? "" });
  if (lang && f.code === SHARED_MISSING) return ui(lang, "ui.check.sharedmissing", { n: f.count ?? 1, first: f.id ?? "" });
  if (lang && f.code === "after-death" && f.params) return ui(lang, f.params.kind === "weddingAfterDeath" ? "ui.check.afterdeath.wedding" : "ui.check.afterdeath", f.params);
  if (lang && f.code === "participant-long-name") return ui(lang, "ui.check.participantnames", { n: f.count ?? 1 });
  if (lang && f.code === "street-place") return ui(lang, "ui.check.streetplaces", { n: f.count ?? 1 });
  if (lang && f.code === "same-original-id" && f.params) return ui(lang, "ui.check.sameid", f.params);
  return f.message;
}

/** Its next step said as its finding is (the research sealed on another computer: taken over by the person). */
function hintSaid(f: Finding, lang: string | undefined): string | undefined {
  if (lang && f.hint === ACCEPT_HINT) return ui(lang, "ui.check.accept.hint");
  if (lang && f.hint === LOST_HINT) return ui(lang, "ui.check.lost.hint");
  if (lang && f.code === "foreign-seal") return ui(lang, "ui.check.foreignseal.hint");
  if (lang && f.code === OTHER_KEY) return ui(lang, f.hint === AFTER_REPAIR_HINT ? "ui.check.otherkey.afterrepair.hint" : "ui.check.otherkey.hint");
  if (lang && f.code === NOT_DOWNLOADED) return ui(lang, "ui.check.notdownloaded.hint");
  if (lang && f.code === SHARED_MISSING) return ui(lang, "ui.check.sharedmissing.hint", { show: `strom ${f.id?.startsWith("M") ? "media" : "input"} show ${f.id ?? ""}` });
  if (lang && f.code === "after-death" && f.params)
    return ui(lang, "ui.check.afterdeath.hint", { show: `strom person show ${f.params.person}`, dismiss: `strom quality dismiss ${f.params.kind} ${f.params.person} --subject ${f.params.year}` });
  if (lang && f.code === "same-original-id" && f.params)
    return ui(lang, "ui.check.sameid.hint", { compare: `strom person compare ${f.params.a} ${f.params.b}`, merge: `strom person merge ${f.params.a} ${f.params.b} --reason …` });
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
 * The full check of the seals with the way each finding goes: a history (git) that cannot be read — the person's strom
 * seal accept; one older than the research — never strom repair, which would remove that work.
 */
function sealWay(tree: Tree): Finding[] {
  const full = verifyFull(tree);
  return repairWay(tree, acceptWay(tree, full.findings), full);
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
      const checked = report([...sealWay(tree), ...check(tree), ...guardOrDamaged(tree, () => guard(tree)), ...unwritable(tree, agent), ...sharedMissing(tree)], ui(lang, "ui.check.ok"), lang, !agent);
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
      // an archive: what to research is no matter of it
      if (actsAsArchive(tree)) return out;
      // not an error — research to do: who rests on no record of their own; facts with the original cited waiting to be
      // verified against it (spec 065 K6.9), those waiting for the person's scans or an archive's permission said apart
      const unproven = unprovenPeople(tree).filter((u) => !u.living).length;
      const v = verifyCounts(tree);
      return {
        ...out,
        text: lines(out.text, unproven ? ui(lang, "ui.check.unproven", { n: unproven }) : undefined, v.waiting ? ui(lang, "ui.check.verify", { n: v.waiting, more: verifyWaitsMore(lang, v) }) : undefined),
        data: { ...out.data, ...(unproven ? { unproven } : {}), ...(v.waiting ? { verify: { waiting: v.waiting, images: v.images, permission: v.permission } } : {}) },
      };
    },
  },
  {
    path: ["verify"],
    summary: "Was anything changed outside strom? (seal check of every record and commit)",
    group: "history",
    tree: true,
    description: "The facts against their originals are another matter: strom verify facts <whom>, strom verify bulk, strom verify done, strom verify status.",
    options: [{ name: "fast", type: "boolean", description: "only what changed since the last commit (what runs before every write)" }],
    run(ctx, { opts }) {
      const tree = ctx.tree();
      return report(opts.fast ? verifyFast(tree).findings : [...sealWay(tree), ...sharedMissing(tree)], "ok — every record matches its seal", isAgent(ctx.env) ? undefined : tree.lang, !isAgent(ctx.env));
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

register(
  {
    path: ["repair"],
    summary: "Undo changes made outside strom: restore the last sealed state",
    group: "history",
    tree: true,
    description:
      "Edited records are restored, records created outside strom are removed; copies of everything\n" +
      "that was replaced are kept in .strom/quarantine/<stamp>/ (strom repair undo <stamp> puts them back). Commits made\n" +
      "with git directly are undone for data/.\n" +
      `Removing more than ${REPAIR_ASKS_ABOVE} records, or records the history says are work rather than changes outside strom\n` +
      "(written by operations sealed in their logs, referred to by other records, older than what the sealed state keeps —\n" +
      "a history (git) older than the research, as a cloud drive leaves it), is the user's own decision in their terminal:\n" +
      "strom repair says what it would remove and asks; an agent, --yes or no terminal gets only the count.\n" +
      "A tree sealed with two keys of this computer (an app packaged for Windows and a terminal): the work of both kept,\n" +
      "the keys united after it with strom seal adopt.",
    run: async (ctx: Context) => {
      const tree = ctx.tree();
      // what a person meets here in the research's language, an agent in English
      const agent = isAgent(ctx.env);
      const lang = agent ? "en" : tree.lang;
      const asked = planRepair(tree);
      const asks = repairAsks(asked);
      if (asks) {
        const set = "strom repair";
        ctx.requireHuman(repairQuestion(asked), set, "repair", lines(repairSaid(asked, lang), "", ui(lang, "ui.repair.person", { command: set })), { window: false });
        ctx.io.stdout(repairSaid(asked, lang) + "\n");
        if (!(await ctx.confirm(ui(lang, "ui.repair.ask", { n: asked.records.length }), false))) return { text: ui(lang, "ui.cancelled"), data: { ...repairData(asked), repaired: false } };
      }
      const r = tree.withTreeLock(() => {
        // under the lock: what it would do now — anything changed since the look (or since the person's yes), nothing done
        const plan = planRepair(tree);
        if (!sameRepair(plan, asked) || (!asks && repairAsks(plan)))
          throw new StromError("the research changed since it was looked over — nothing repaired", { hint: "strom repair   (looks it over again)", code: "repair.changed" });
        return applyRepair(tree, plan);
      });
      // the work of another key of this computer kept: united next, by the person in their terminal (no problem left of
      // what strom repair undoes)
      const after = verifyFast(tree).findings.filter((f) => f.level === "error" && f.code !== OTHER_KEY);
      const unite = !!tree.key && otherKeys(tree.env, tree.config.id, tree.key).length > 0 && keysToUnite(tree).length > 0;
      const next = unite ? ui(lang, "ui.repair.unite") : undefined;
      // what an interrupted write left (a stale lock of git's index, what it staged): said before the rest
      const index = [...(r.lock ? [ui(lang, "ui.repair.lock")] : []), ...(r.unstaged ? [ui(lang, "ui.repair.index", { n: r.unstaged })] : [])];
      const text =
        r.restored.length + r.quarantined.length === 0
          ? r.resealed
            ? lines(...index, ui(lang, "ui.repair.resealed"), next)
            : index.length
              ? lines(...index, after.length ? ui(lang, "ui.repair.still", { n: after.length }) : next)
              : lines(ui(lang, "ui.repair.nothing"), next)
          : lines(
              ...index,
              ...r.restored.map((file) => ui(lang, "ui.repair.restored", { file })),
              ...r.quarantined.map((file) => ui(lang, "ui.repair.removed", { file })),
              ui(lang, "ui.repair.from", { commit: r.from.slice(0, 8) }),
              r.stamp ? ui(lang, "ui.repair.undo.how", { command: `strom repair undo ${r.stamp}` }) : undefined,
              after.length ? ui(lang, "ui.repair.still", { n: after.length }) : next,
            );
      return { text, data: { ...r, ok: after.length === 0, ...(unite ? { unite: "strom seal adopt" } : {}) }, exitCode: after.length ? 1 : 0 };
    },
  },
  {
    path: ["repair", "undo"],
    summary: "Put back what strom repair removed or replaced (the user runs this in a terminal)",
    group: "history",
    tree: true,
    args: [{ name: "stamp", description: "the folder of .strom/quarantine/ strom repair named (without it: the list)" }],
    description:
      "strom repair keeps a copy of every file it removed or wrote over in .strom/quarantine/<stamp>/. Without a stamp: the\n" +
      "copies kept, newest first (read only, anyone may). With one: says what it would put back — a file removed and not\n" +
      "there since, a file written back and not changed since; anything changed since is left as it is now, a file strom\n" +
      "does not seal stays in the quarantine. On the user's yes, one sealed operation names each record put back as it is;\n" +
      "nothing in the folder is deleted. Only onto a research as strom sealed it (strom verify clean). Putting back is the\n" +
      "user's own decision at their terminal — an agent tells the user the command, never runs it.",
    examples: ["strom repair undo", "strom repair undo 2026-11-09T18-02-11-123Z"],
    person: "Putting back what strom repair removed is the user's own decision, in their terminal",
    agentMay: { when: "without a stamp (the list)", check: (_ctx, { args }) => args.length === 0 },
    run: async (ctx: Context, { args }) => {
      const tree = ctx.tree();
      const agent = isAgent(ctx.env);
      const lang = agent ? "en" : tree.lang;
      const stamp = args[0];
      if (!stamp) {
        const list = quarantines(tree.root);
        if (!list.length) return { text: ui(lang, "ui.repair.undo.none"), data: { quarantines: [] } };
        return {
          text: lines(ui(lang, "ui.repair.undo.list"), ...list.map((q) => ui(lang, "ui.repair.undo.item", { stamp: q.stamp, n: q.files, records: q.records }))),
          data: { quarantines: list },
        };
      }
      const set = `strom repair undo ${stamp}`;
      const plan = planUndo(tree, stamp);
      const data = undoData(plan);
      const said = undoSaid(plan, lang);
      if (plan.back.length === 0) return { text: lines(said, ui(lang, "ui.repair.undo.nothing")), data: { ...data, undone: false, nothing: true } };
      if (!ctx.interactive) return { text: lines(said, "", ui(lang, "ui.repair.undo.person", { command: set })), data: { ...data, undone: false, run: set }, exitCode: 4 };
      if (liveRunning(tree.root)) throw new UsageError("the bridge to the Strom app runs on this research: nothing put back", { hint: `strom live stop, then ${set}`, code: "repair.undo-bridge" });
      if (liveWorkers(tree.root).length > 0 || runsAtWork(tree.root).length > 0)
        throw new UsageError("somebody is at work on this research: putting back only once they finished", { hint: `strom session finish, then ${set}`, code: "repair.undo-busy" });
      ctx.requireHuman("Put back what strom repair removed (a sealed change)?", set, "repair", ui(lang, "ui.repair.undo.person", { command: set }), { window: false });
      ctx.io.stdout(said + "\n");
      if (!(await ctx.confirm(ui(lang, "ui.repair.undo.ask"), false))) return { text: ui(lang, "ui.cancelled"), data: { ...data, undone: false } };
      const r = applyUndo(tree, plan);
      const after = verifyFull(tree).findings.filter((f) => f.level === "error");
      return {
        text: lines(ui(lang, "ui.repair.undo.done", { n: r.back, records: r.records }), after.length ? ui(lang, "ui.repair.still", { n: after.length }) : ui(lang, "ui.accept.verified")),
        data: { ...data, undone: true, commit: r.commit, verify: { ok: after.length === 0, errors: after.length } },
        exitCode: after.length ? 1 : 0,
      };
    },
  },
  {
    path: ["seal", "adopt"],
    summary: "Take over a tree sealed on another computer (the user runs this in a terminal)",
    group: "history",
    tree: true,
    description:
      "Checks the chain and every record hash, then creates this computer's seal key for the tree.\n" +
      "A tree sealed here with a second key of this computer too (a copy of strom's settings an app packaged for Windows\n" +
      "made): checks every operation of that key with it, then unites the keys — never strom repair, which would undo that work.\n" +
      "Agents must not run this — it needs the user's confirmation.",
    person: "Taking over this tree on this computer (the seal) is the user's own, in their terminal",
    run: async (ctx: Context) => {
      const tree = ctx.tree();
      // a person reads it in the research's language (the menu, a link's terminal, the setup go the same way)
      const lang = tree.lang;
      const name = tree.config.name;
      // sealed here: another key of this computer to unite (strom of a packaged app and of a terminal), else nothing to do
      const unite = tree.key ? keysToUnite(tree).length > 0 : false;
      if (tree.key && !unite) return { text: ui(lang, "ui.seal.already", { name }), data: { adopted: false } };
      if (!ctx.interactive && unite) throw otherKeyError(name);
      if (!ctx.interactive)
        throw new NeedsConsentError([
          { key: "seal", kind: "consent", question: "Take over this tree on this computer?", set: "strom seal adopt" },
        ]);
      const r = await adoptSeal(ctx, tree, lang);
      if (r.adopted) return r.united ? { text: ui(lang, "ui.seal.united", { name }), data: { adopted: true, united: r.united } } : { text: ui(lang, "ui.seal.adopted", { name }), data: { adopted: true } };
      if (r.why === "problems") {
        const found = report(r.problems!, "", lang, true);
        return { ...found, text: lines(found.text, ui(lang, "ui.seal.problems")), data: { ...found.data, adopted: false } };
      }
      return { text: ui(lang, r.why === "already" ? "ui.seal.already" : "ui.cancelled", { name }), data: { adopted: false } };
    },
  },
  {
    path: ["seal", "accept"],
    summary: "Accept the research as it is now when the history of its records is lost (the user runs this in a terminal)",
    group: "history",
    tree: true,
    description:
      "For a research whose records are as strom wrote them but whose history is lost: the oldest logs of data/ops taken\n" +
      "away (a cloud drive), its git history damaged, so strom verify says records were created or edited outside strom and\n" +
      "strom repair has nothing to put back. Says first what it would do (how many records lack their history, the state of\n" +
      "git); on the user's yes, one sealed change names every such file as it is now — no record changed, nothing deleted.\n" +
      "A damaged git history is moved aside whole (.git-damaged-<when>) and a new one begun; iCloud copies (\"P0001 2.json\")\n" +
      "inside data/ are moved into .strom/accepted-<when>/. Never settles a log rewritten, an operation forged, another key\n" +
      "or files only in the cloud. --preview says what it would do (read only, anyone may). Accepting itself is the user's\n" +
      "own decision at their terminal — an agent tells the user the command, never runs it; never while the bridge runs or\n" +
      "somebody works on the research.",
    options: [{ name: "preview", type: "boolean", description: "only say what accepting would do; nothing written" }],
    examples: ["strom seal accept --preview", "strom seal accept"],
    person: "Accepting the research as it is (a new sealed base) is the user's own decision, in their terminal",
    agentMay: { when: "--preview", check: (_ctx, { opts }) => opts.preview === true },
    run: async (ctx: Context, { opts }) => {
      const tree = ctx.tree();
      const agent = isAgent(ctx.env);
      const lang = agent ? "en" : tree.lang;
      const name = tree.config.name;
      const set = "strom seal accept";
      // sealed on another computer: no key of this one to seal with — taken over first
      tree.requireKey();
      const plan = planAccept(tree);
      const data = acceptData(plan);
      if (plan.refused.length) {
        const found = report(plan.refused, "", lang, !agent);
        return { ...found, text: lines(found.text, ui(lang, "ui.accept.refused")), data: { ...found.data, ...data, accepted: false } };
      }
      if (nothingToAccept(plan)) return { text: ui(lang, "ui.accept.nothing", { name }), data: { ...data, accepted: false, nothing: true } };
      const said = acceptSaid(plan, lang, name);
      if (opts.preview || !ctx.interactive)
        return { text: lines(said, "", ui(lang, "ui.accept.person", { command: set })), data: { ...data, accepted: false, run: set }, exitCode: opts.preview ? 0 : 4 };
      // the bridge reads the history this replaces; a writer at work would write on top of what is looked over now
      if (liveRunning(tree.root)) throw new UsageError("the bridge to the Strom app runs on this research: nothing accepted", { hint: `strom live stop, then ${set}`, code: "accept.bridge" });
      if (liveWorkers(tree.root).length > 0 || runsAtWork(tree.root).length > 0)
        throw new UsageError("somebody is at work on this research: accepting only once they finished", { hint: `strom session finish, then ${set}`, code: "accept.busy" });
      if (ctx.yes) throw new UsageError("--yes never accepts the research: a person decides at their terminal", { hint: set, code: "accept.yes" });
      ctx.requireHuman("Accept the research as it is now (a new sealed base)?", set, "seal", ui(lang, "ui.accept.person", { command: set }), { window: false });
      ctx.io.stdout(said + "\n");
      if (!(await ctx.confirm(ui(lang, "ui.accept.ask"), false))) return { text: ui(lang, "ui.cancelled"), data: { ...data, accepted: false } };
      const r = applyAccept(tree, plan);
      const after = verifyFull(tree).findings.filter((f) => f.level === "error");
      return {
        text: lines(
          ui(lang, "ui.accept.done", { name, n: r.sealed }),
          r.gitMoved ? ui(lang, "ui.accept.gitmoved", { dir: r.gitMoved }) : undefined,
          r.copiesMoved ? ui(lang, "ui.accept.copiesmoved", { dir: r.copiesMoved }) : undefined,
          after.length ? ui(lang, "ui.accept.still", { n: after.length }) : ui(lang, "ui.accept.verified"),
        ),
        data: { ...data, accepted: true, commit: r.commit, ...(r.gitMoved ? { gitMoved: r.gitMoved } : {}), ...(r.copiesMoved ? { copiesMoved: r.copiesMoved } : {}), verify: { ok: after.length === 0, errors: after.length } },
        exitCode: after.length ? 1 : 0,
      };
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
      const rows = historyRows(tree, ctx.limit).map((r) => [r.change, r.when, r.text]);
      // the way back to one of them, for a person reading it (the command is theirs alone)
      return { text: rows.length ? lines(table(rows), "", ui(lang, "ui.history.back.hint")) : ui(lang, "ui.history.none"), data: { commits } };
    },
  },
  {
    path: ["history", "back"],
    summary: "Return the research to its state after an earlier change (a new change: nothing deleted; the person's own)",
    group: "history",
    tree: true,
    writes: true,
    description:
      "The people, families, sources, places and the rest of the tree's evidence as they were right after the change named\n" +
      "(its hash from strom history, or a day YYYY-MM-DD: the state at its end), the person's decisions on the tree's\n" +
      "quality with them. Written as one new change: records added later are retracted, never deleted, and the whole\n" +
      "history stays — a return is taken back the same way (the command it prints). What stays as it is: the tasks,\n" +
      "sessions, directions and lessons, the settings, the history of the places, the images in the shared folder.\n" +
      "--preview says what would return (read only, anyone may). The return itself is the person's own decision, at their\n" +
      "own terminal — an agent tells the user the command, never runs it; never while somebody works on the research.",
    args: [{ name: "change", description: "the change from strom history (e.g. 1a2b3c4d), or a day YYYY-MM-DD", required: true }],
    options: [{ name: "preview", type: "boolean", description: "only say what would return; nothing written" }],
    examples: ["strom history back 1a2b3c4d --preview", "strom history back 2026-01-15"],
    async run(ctx, { args, opts }) {
      const tree = ctx.tree();
      const lang = tree.lang;
      const target = resolveTarget(tree, args[0]!);
      const change = target.hash.slice(0, 8);
      const when = humanWhen(target.at, lang);
      const head = git.runGit(tree.root, ["rev-parse", "HEAD"]).stdout.trim();
      if (target.hash === head) return { text: ui(lang, "ui.back.now", { when, change }), data: { change: target.hash, at: target.at, same: true, returned: false } };
      const plan = planReturn(tree, target);
      const set = `strom history back ${change}`;
      const said = backPreview(tree, plan, lang);
      const inbox = receivedPending(tree.root).length;
      const data = { change: target.hash, at: target.at, counts: plan.counts, facts: plan.facts, quality: plan.quality, same: plan.same, ...(inbox ? { inbox } : {}) };
      if (plan.same) return { text: lines(said, ui(lang, "ui.back.nothing")), data: { ...data, returned: false } };
      if (opts.preview) return { text: lines(said, "", ui(lang, "ui.back.person", { command: set })), data: { ...data, returned: false, run: set } };
      // nobody's work is cut short: what an agent writes now would be returned over
      if (liveWorkers(tree.root).length > 0 || runsAtWork(tree.root).length > 0)
        throw new UsageError("somebody is at work on this research: a return only once they finished", { hint: "strom session finish, then " + set, code: "back.busy", params: { command: set } });
      if (ctx.yes) throw new UsageError("--yes never returns the research: a person chooses at their terminal", { hint: set });
      ctx.requireHuman(`Return the research to its state after the change of ${target.at} (${change})?`, set, "history.back", ui(lang, "ui.back.person", { command: set }), { window: false });
      ctx.io.stdout(said + "\n");
      if (!(await ctx.confirm(ui(lang, "ui.back.ask"), false))) return { text: ui(lang, "ui.cancelled"), data: { ...data, returned: false } };
      tree.withTreeLock(() => applyReturn(tree, plan));
      const undo = `strom history back ${plan.head.slice(0, 8)}`;
      return { text: ui(lang, "ui.back.done", { when, undo }), data: { ...data, returned: true, undo } };
    },
  },
);

/**
 * The changes of the history as a person reads them (the newest first): its short hash, its day and what it was, in the
 * research's language — a change with nothing to show a person (only its English subject) left out.
 */
export function historyRows(tree: Tree, limit: number): { change: string; now: boolean; at: string; when: string; text: string }[] {
  const lang = tree.lang;
  const said = new Map(history(tree.root, tree, [`-n${Math.max(1, limit)}`]).map((e) => [e.head, e.text]));
  return git.log(tree.root, limit).flatMap((c, i) => {
    const text = (said.get(c.hash) ?? []).filter((t) => t !== c.subject);
    if (!text.length) return [];
    return [{ change: c.hash.slice(0, 8), now: i === 0, at: c.at, when: humanWhen(c.at, lang), text: text.length > 1 ? `${text[0]} ${ui(lang, "ui.recent.morechanges", { n: text.length - 1 })}` : text[0]! }];
  });
}

/** What a return changes, as a person reads it: the change returned to, then a line for each kind of record. */
function backPreview(tree: Tree, plan: ReturnPlan, lang: string): string {
  const waiting = receivedPending(tree.root).length;
  const what = history(tree.root, tree, ["-n1", plan.target.hash])[0]?.text.find((t) => t !== plan.target.subject);
  const groups: [UIKey, RecordType[]][] = [
    ["ui.back.g.people", ["person"]],
    ["ui.back.g.families", ["family"]],
    ["ui.back.g.sources", ["source", "recordset", "repository", "media"]],
    ["ui.back.g.other", ["place", "search", "conflict", "hypothesis", "input"]],
  ];
  const rows = groups.flatMap(([key, types]) => {
    const back = types.reduce((n, t) => n + (plan.counts[t]?.back ?? 0), 0);
    const out = types.reduce((n, t) => n + (plan.counts[t]?.out ?? 0), 0);
    if (!back && !out) return [];
    const parts = [back ? ui(lang, "ui.back.asthen", { n: back }) : "", out ? ui(lang, "ui.back.out", { n: out }) : ""].filter(Boolean).join(", ");
    return [`  ${ui(lang, key)}: ${parts}`];
  });
  if (plan.facts) rows.push(`  ${ui(lang, "ui.back.facts", { n: plan.facts })}`);
  if (plan.quality) rows.push(`  ${ui(lang, "ui.back.quality", { n: plan.quality })}`);
  return lines(
    ui(lang, "ui.back.title", { when: humanWhen(plan.target.at, lang), change: plan.target.hash.slice(0, 8) }),
    what ? `  ${what}` : undefined,
    ...(plan.same ? [] : ["", ...rows, "", ui(lang, actsAsArchive(tree) ? "ui.back.kept.archive" : "ui.back.kept")]),
    // trees the app sent that wait in the inbox (sync.review on): the return leaves them, decided after it they come on top
    ...(plan.same || !waiting ? [] : [ui(lang, "ui.back.inbox", { n: waiting })]),
  );
}

/** What accepting would do, as a person reads it: the counts, the state of git, the copies of iCloud. */
function acceptSaid(plan: AcceptPlan, lang: string, name: string): string {
  const list = plan.copies.slice(0, 5).join(", ") + (plan.copies.length > 5 ? ", …" : "");
  return lines(
    ui(lang, "ui.accept.title", { name }),
    plan.unsealed.length ? ui(lang, "ui.accept.unsealed", { n: plan.unsealed.length }) : undefined,
    plan.edited.length ? ui(lang, "ui.accept.edited", { n: plan.edited.length }) : undefined,
    plan.outside.length ? ui(lang, "ui.accept.outside", { n: plan.outside.length }) : undefined,
    plan.other.length ? ui(lang, "ui.accept.other", { n: plan.other.length }) : undefined,
    ui(lang, "ui.accept.logs", { n: plan.logs }),
    ui(lang, `ui.accept.git.${plan.git}` as UIKey),
    plan.moveAside.length ? ui(lang, "ui.accept.aside", { n: plan.moveAside.length, first: plan.moveAside[0]! }) : undefined,
    plan.copies.length ? ui(lang, "ui.accept.copies", { n: plan.copies.length, list }) : undefined,
    "",
    ui(lang, "ui.accept.does"),
  );
}

/** What accepting would do, for a program: the counts and the files. */
function acceptData(plan: AcceptPlan) {
  return {
    unsealed: plan.unsealed.length,
    edited: plan.edited.length,
    outside: plan.outside.length,
    other: plan.other.length,
    logs: plan.logs,
    git: plan.git,
    files: plan.files.map((f) => f.path),
    moveAside: plan.moveAside,
    copies: plan.copies,
    refused: plan.refused.length,
  };
}

/** What strom repair would remove, as a person reads it before saying yes. */
function repairSaid(plan: RepairPlan, lang: string): string {
  const first = (l: string[]) => l[0] ?? "";
  return lines(
    ui(lang, "ui.repair.ask.title", { n: plan.records.length, files: plan.remove.length, back: plan.restore.length, commit: plan.from.slice(0, 8) }),
    plan.sealedWork.length ? ui(lang, "ui.repair.ask.sealed", { n: plan.sealedWork.length }) : undefined,
    plan.referenced.length ? ui(lang, "ui.repair.ask.referenced", { n: plan.referenced.length, first: first(plan.referenced) }) : undefined,
    plan.older.length ? ui(lang, "ui.repair.ask.older", { n: plan.older.length, first: first(plan.older) }) : undefined,
    plan.cloudCopies.length ? ui(lang, "ui.repair.ask.copies", { n: plan.cloudCopies.length, list: plan.cloudCopies.slice(0, 3).join(", ") }) : undefined,
    "",
    ui(lang, "ui.repair.ask.backup"),
    historyLost(plan) ? ui(lang, "ui.repair.ask.lost") : undefined,
  );
}

/** The question an agent (or a program) reads where strom repair waits for the person: what it would remove, in English. */
function repairQuestion(plan: RepairPlan): string {
  const n = plan.records.length;
  const why = [
    plan.sealedWork.length ? `${plan.sealedWork.length} written by operations sealed in their logs` : "",
    plan.referenced.length ? `${plan.referenced.length} referred to by other records` : "",
    plan.older.length ? `${plan.older.length} older than what the sealed state keeps` : "",
  ].filter(Boolean);
  return (
    `strom repair would remove ${n} ${n === 1 ? "record" : "records"}${why.length ? ` (${why.join(", ")})` : ""} — the whole research folder backed up first` +
    (historyLost(plan) ? "; the history (git) looks older than the research: rather .git put back from a backup or Time Machine, or, once the records are looked over, strom seal accept" : "") +
    ". Remove them?"
  );
}

function repairData(plan: RepairPlan) {
  return { from: plan.from, records: plan.records, remove: plan.remove.length, restore: plan.restore.length, sealedWork: plan.sealedWork.length, referenced: plan.referenced, older: plan.older.length, cloudCopies: plan.cloudCopies, historyLost: historyLost(plan) };
}

/** What strom repair undo would put back, as a person reads it. */
function undoSaid(plan: UndoPlan, lang: string): string {
  const records = plan.back.filter((f) => isRecordFile(f.path)).length;
  return lines(
    ui(lang, "ui.repair.undo.title", { stamp: plan.stamp }),
    ui(lang, "ui.repair.undo.back", { n: plan.back.length, records }),
    plan.kept.length ? ui(lang, "ui.repair.undo.kept", { n: plan.kept.length, first: plan.kept[0]! }) : undefined,
    plan.left.length ? ui(lang, "ui.repair.undo.left", { n: plan.left.length }) : undefined,
    plan.back.length ? ui(lang, "ui.repair.undo.does") : undefined,
  );
}

function undoData(plan: UndoPlan) {
  return { stamp: plan.stamp, back: plan.back.map((f) => f.path), kept: plan.kept, same: plan.same.length, left: plan.left };
}
