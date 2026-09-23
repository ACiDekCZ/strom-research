// check · verify · guard · repair · seal adopt · history

import fs from "node:fs";
import path from "node:path";
import { register } from "../cli/registry.ts";
import type { Context } from "../cli/context.ts";
import { lines, table } from "../cli/format.ts";
import { check, type Finding } from "../core/check.ts";
import { guard } from "../core/guard.ts";
import { verifyFast, verifyFull } from "../core/integrity.ts";
import { createKey, verifyCommitSeal } from "../core/seal.ts";
import { NeedsConsentError, StromError } from "../core/errors.ts";
import * as git from "../core/git.ts";
import type { Tree } from "../core/tree.ts";

export function report(findings: Finding[], okText: string) {
  const errors = findings.filter((f) => f.level === "error");
  const text =
    findings.length === 0
      ? okText
      : lines(
          table(findings.map((f) => [f.level === "error" ? "ERROR" : "warn", f.code, f.id ?? f.file ?? "", f.message, f.hint ? `→ ${f.hint}` : ""])),
          "",
          `${errors.length} error(s), ${findings.length - errors.length} warning(s)`,
        );
  return { text, data: { ok: errors.length === 0, findings }, exitCode: errors.length ? 1 : 0 };
}

register(
  {
    path: ["check"],
    summary: "Is the evidence consistent and untouched? (schema, references, seals, losses)",
    group: "history",
    tree: true,
    run(ctx) {
      const tree = ctx.tree();
      return report([...verifyFull(tree).findings, ...check(tree), ...guard(tree)], "ok — data consistent, sealed, nothing lost");
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
      return report((opts.fast ? verifyFast(tree) : verifyFull(tree)).findings, "ok — every record matches its seal");
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
  const key = tree.requireKey();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const head = git.headInfo(tree.root);
  const sealed = git.findCommit(tree.root, (t, m) => verifyCommitSeal(key, t, m));
  if (!sealed) throw new StromError("no sealed commit found — nothing to restore from", { hint: "ask the user; the history may have been rewritten" });
  const headSealed = head !== undefined && verifyCommitSeal(key, head.tree, head.message);

  // Paths to compare: whatever differs between the sealed commit and the working tree.
  const candidates = new Set<string>();
  for (const c of git.changes(tree.root, ["data", "strom.json"])) candidates.add(c.path);
  if (!headSealed) {
    const r = git.runGit(tree.root, ["diff", "--name-only", "-z", sealed, "HEAD", "--", "data", "strom.json"]);
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
  if (!headSealed) tree.commit(`Repair: restore the sealed state of ${sealed.slice(0, 8)}\n\nCommits made outside strom were undone for data/ and strom.json.`, ["data", "strom.json"]);
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
              after.length ? `still ${after.length} problem(s) → strom verify` : undefined,
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
    run: async (ctx: Context) => {
      const tree = ctx.tree();
      if (tree.key) return { text: "this tree is already sealed on this computer", data: { adopted: false } };
      if (!ctx.interactive)
        throw new NeedsConsentError([
          { key: "seal", kind: "consent", question: "Take over this tree on this computer?", set: "strom seal adopt" },
        ]);
      const problems = verifyFull(tree).findings.filter((f) => f.level === "error");
      if (problems.length) return report(problems, "");
      if (!(await ctx.confirm(`Take over "${tree.config.name}" on this computer?`, true))) return { text: "cancelled", data: { adopted: false } };
      tree.withTreeLock(() => {
        createKey(tree.env, tree.config.id);
        tree.reloadKey();
        tree.appendOp({ op: "seal.adopt", targets: [], files: [], summary: "Tree adopted on this computer" });
        tree.commit("Seal: tree adopted on this computer");
      });
      return { text: `"${tree.config.name}" is now sealed on this computer`, data: { adopted: true } };
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
      const text = commits.length
        ? table(commits.map((c) => [c.hash.slice(0, 8), c.at.slice(0, 16).replace("T", " "), c.subject]))
        : "no history yet";
      return { text, data: { commits } };
    },
  },
);
