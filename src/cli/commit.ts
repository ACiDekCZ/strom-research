// Automatic commit after a writing command. Git is invisible to the user:
// every change is committed by strom, behind the check + guard gate.

import { hasErrors } from "../core/check.ts";
import { guard } from "../core/guard.ts";
import { snapshot, verifyFast } from "../core/integrity.ts";
import type { Context } from "./context.ts";
import type { CommandDef } from "./registry.ts";

export function commitMessage(summaries: string[], command: string): string {
  const unique = [...new Set(summaries)];
  const subject = unique.length === 1 ? unique[0]! : `${command}: ${unique.length} changes`;
  const body = unique.length > 1 ? "\n\n" + unique.map((s) => `- ${s}`).join("\n") : "";
  return subject + body;
}

export interface NotCommitted {
  message: string;
  problems: { id?: string; file?: string; message: string }[];
}

/** Commit the changes of this command. Returns what blocked the commit, if anything did. */
export function autoCommit(ctx: Context, def: CommandDef): NotCommitted | undefined {
  const tree = ctx.current();
  if (!tree || tree.dryRun || tree.written.length === 0) return undefined;
  // Incremental gate: records were validated when written; here only what
  // changed since the last commit is checked, so the cost stays flat.
  const snap = snapshot(tree);
  const findings = [...verifyFast(tree, snap).findings, ...guard(tree, snap)];
  if (hasErrors(findings)) {
    const errors = findings.filter((f) => f.level === "error");
    return {
      message: [
        `error: written but NOT committed — ${errors.length} problem(s) in the data:`,
        ...errors.slice(0, 5).map((f) => `  ${f.id ?? f.file ?? ""} ${f.message}`),
        "→ strom check",
      ].join("\n"),
      problems: errors.map((f) => ({ ...(f.id ? { id: f.id } : {}), ...(f.file ? { file: f.file } : {}), message: f.message })),
    };
  }
  const message = commitMessage(tree.written.map((o) => o.summary), `strom ${def.path.join(" ")}`);
  // Only the files this command wrote, plus the free-form folders the agent
  // may edit — `git add` then never has to scan the whole data/ tree.
  const written = new Set<string>(["data/_counters.json"]);
  for (const op of tree.written) for (const f of op.files) written.add(f.path);
  for (const f of tree.opsFilesTouched()) written.add(f);
  tree.withTreeLock(() => tree.commit(message, [...written, "notes", "tools", "inputs", "output"]));
  tree.settle();
  return undefined;
}
