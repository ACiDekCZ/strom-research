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
import { AFTER_REPAIR_HINT, NOT_DOWNLOADED, OTHER_KEY, REPAIR_IN_TERMINAL_HINT, SEALED_PATHS, lastSealed, notDownloaded, notDownloadedError, otherKeyError, verifyFast, verifyFull } from "../core/integrity.ts";
import { otherKeys } from "../core/seal.ts";
import { adoptSeal, keysToUnite } from "../cli/seal.ts";
import { NeedsConsentError, StromError, UsageError } from "../core/errors.ts";
import * as git from "../core/git.ts";
import { ui, type UIKey } from "../cli/ui.ts";
import { history } from "../core/live.ts";
import { humanWhen } from "../cli/human.ts";
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
  if (lang && f.code === "counter" && f.id) return ui(lang, "ui.check.counter", { prefix: f.id.charAt(0) });
  if (lang && f.code === "unwritable") return ui(lang, "ui.check.unwritable");
  if (lang && f.code === "foreign-seal") return ui(lang, "ui.check.foreignseal");
  if (lang && f.code === OTHER_KEY) return ui(lang, "ui.check.otherkey");
  if (lang && f.code === NOT_DOWNLOADED) return ui(lang, "ui.check.notdownloaded", { n: f.count ?? 1, first: f.file ?? "" });
  if (lang && f.code === SHARED_MISSING) return ui(lang, "ui.check.sharedmissing", { n: f.count ?? 1, first: f.id ?? "" });
  if (lang && f.code === "after-death" && f.params) return ui(lang, f.params.kind === "weddingAfterDeath" ? "ui.check.afterdeath.wedding" : "ui.check.afterdeath", f.params);
  if (lang && f.code === "participant-long-name") return ui(lang, "ui.check.participantnames", { n: f.count ?? 1 });
  if (lang && f.code === "street-place") return ui(lang, "ui.check.streetplaces", { n: f.count ?? 1 });
  return f.message;
}

/** Its next step said as its finding is (the research sealed on another computer: taken over by the person). */
function hintSaid(f: Finding, lang: string | undefined): string | undefined {
  if (lang && f.code === "foreign-seal") return ui(lang, "ui.check.foreignseal.hint");
  if (lang && f.code === OTHER_KEY) return ui(lang, f.hint === AFTER_REPAIR_HINT ? "ui.check.otherkey.afterrepair.hint" : "ui.check.otherkey.hint");
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
  /** Commits made outside strom on top: sealed again, whether or not they changed a record. */
  resealed: boolean;
  /** Paths git's index held otherwise than the sealed state (what an interrupted write staged), put back to it. */
  unstaged: number;
  /** A lock of git's index a git that ended mid-way left (stale), taken away. */
  lock: boolean;
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
  // the newest commit any key of this computer sealed: only what was done outside strom undone, the other key's work
  // kept — strom seal adopt unites them after
  const { sealed, inTerminal } = lastSealed(tree, key);
  if (!sealed) throw new StromError("no sealed commit found — nothing to restore from", { hint: "ask the user; the history may have been rewritten" });
  if (inTerminal)
    throw new StromError(`"${tree.config.name}" holds work sealed with the key of the terminal's strom, which this strom (started by an app packaged for Windows) does not see — nothing repaired`, {
      hint: REPAIR_IN_TERMINAL_HINT,
      code: "seal.repair-in-terminal",
      params: { name: tree.config.name },
    });
  const headSealed = head !== undefined && head.hash === sealed;
  // a lock of git's index a git that ended mid-way left (killed with the command that ran it): no git holds it any
  // more — taken away, else nothing could be written again (a fresh one may be a git at work: left)
  const stale = git.staleIndexLock(tree.root);
  if (stale) fs.rmSync(stale, { force: true });

  // Paths to compare: whatever differs between the sealed commit and the working tree.
  const candidates = new Set<string>();
  // …and what git's index holds otherwise than the last commit (a write taken back after its git add): back to it
  const staged: string[] = [];
  for (const c of git.changes(tree.root, SEALED_PATHS)) {
    candidates.add(c.path);
    if (!" ?!".includes(c.code[0] ?? " ")) staged.push(c.path);
  }
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
  // sealed again even when the commits outside strom changed nothing of it (an empty one, notes only): else the last
  // commit stays unsealed and every write refused, with nothing left to repair
  if (!headSealed) tree.commit(`Repair: restore the sealed state of ${sealed.slice(0, 8)}\n\nCommits made outside strom were undone for data/, strom.json, history/ and quality/.`, SEALED_PATHS, true);
  // the folder as the sealed commit, HEAD: git's index as HEAD too (a commit above put it so already)
  else if (staged.length) {
    const said = git.unstage(tree.root, staged);
    if (said !== undefined)
      throw new StromError(`git could not put its index back to the sealed state: ${said}`, {
        hint: "programs that may hold the research's folder closed (a sync tool, an antivirus scan, another git), then strom repair again",
        code: "repair.index",
        details: staged.slice(0, 50),
      });
  }
  return { restored, quarantined, from: sealed, resealed: !headSealed, unstaged: headSealed ? staged.length : 0, lock: !!stale };
}

register(
  {
    path: ["repair"],
    summary: "Undo changes made outside strom: restore the last sealed state",
    group: "history",
    tree: true,
    description:
      "Edited records are restored, records created outside strom are removed; copies of everything\n" +
      "that was replaced are kept in .strom/quarantine/. Commits made with git directly are undone for data/.\n" +
      "A tree sealed with two keys of this computer (an app packaged for Windows and a terminal): the work of both kept,\n" +
      "the keys united after it with strom seal adopt.",
    run(ctx) {
      const tree = ctx.tree();
      // what a person meets here in the research's language, an agent in English
      const lang = isAgent(ctx.env) ? "en" : tree.lang;
      const r = tree.withTreeLock(() => repair(tree));
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
              after.length ? ui(lang, "ui.repair.still", { n: after.length }) : next,
            );
      return { text, data: { ...r, ok: after.length === 0, ...(unite ? { unite: "strom seal adopt" } : {}) }, exitCode: after.length ? 1 : 0 };
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
