// Automatic commit after a writing command. Git is invisible to the user:
// every change is committed by strom, behind the check + guard gate.

import { hasErrors } from "../core/check.ts";
import { guard } from "../core/guard.ts";
import { snapshot, verifyFast } from "../core/integrity.ts";
import { isArchive } from "../core/mode.ts";
import type { Context } from "./context.ts";
import type { CommandDef } from "./registry.ts";
import { counted } from "./format.ts";

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
  // what an earlier commit of the same command holds already (strom fetch commits each batch of images) is not again
  const ops = tree?.uncommitted() ?? [];
  if (!tree || tree.dryRun || ops.length === 0) return undefined;
  // The check and the commit under one hold of the tree (a command that locks only while it writes reaches here
  // without it): another strom in the middle of its commit — staged, its log not yet in HEAD — would otherwise be seen
  // half done, its records as edited outside strom (found: a fetch in the foreground ending while one in the
  // background committed its last batch).
  const blocked = tree.withTreeLock((): NotCommitted | undefined => {
    // Incremental gate: records were validated when written; here only what
    // changed since the last commit is checked, so the cost stays flat.
    const snap = snapshot(tree);
    const findings = [...verifyFast(tree, snap).findings, ...guard(tree, snap)];
    if (hasErrors(findings)) {
      const errors = findings.filter((f) => f.level === "error");
      return {
        message: [
          `error: written but NOT committed — ${counted(errors.length, "problem")} in the data:`,
          ...errors.slice(0, 5).map((f) => `  ${f.id ?? f.file ?? ""} ${f.message}`),
          "→ strom check",
        ].join("\n"),
        problems: errors.map((f) => ({ ...(f.id ? { id: f.id } : {}), ...(f.file ? { file: f.file } : {}), message: f.message })),
      };
    }
    const message = commitMessage(ops.map((o) => o.summary), `strom ${def.path.join(" ")}`);
    // Only the files this command wrote, plus the free-form folders the agent
    // may edit — `git add` then never has to scan the whole data/ tree.
    const written = new Set<string>(["data/_counters.json"]);
    for (const op of ops) for (const f of op.files) written.add(f.path);
    for (const f of tree.opsFilesTouched()) written.add(f);
    // an archive: no agent edits its free-form folders — a person's own file in notes/ is theirs, never swept into a
    // commit of something else (found on Windows: strom mode committed a file of the user's) — nor by the switch itself
    const free = isArchive(tree) || def.path[0] === "mode" ? ["inputs", "output"] : ["notes", "tools", "inputs", "output"];
    tree.commit(message, [...written, ...free]);
    return undefined;
  });
  if (blocked) return blocked;
  tree.markCommitted();
  tree.settle();
  return undefined;
}
