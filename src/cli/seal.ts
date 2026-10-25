// Taking a family tree over on this computer (its seal): strom seal adopt, the menu and the setup go the same way —
// every record checked against its seal, the person's yes, then this computer's key. Never by itself, never by an agent.

import type { Context } from "./context.ts";
import { ui } from "./ui.ts";
import { verifyFull } from "../core/integrity.ts";
import { createKey } from "../core/seal.ts";
import { sealedHere, type Tree } from "../core/tree.ts";
import type { Finding } from "../core/check.ts";

export type Adopted = { adopted: true } | { adopted: false; why: "already" | "problems" | "cancelled"; problems?: Finding[] };

/**
 * The tree taken over here: refused while a record does not match its seal (what, strom check says), else asked — the
 * person's yes (Enter says yes: they came to take it over), then the key, the operation seal.adopt and its commit.
 */
export async function adoptSeal(ctx: Context, tree: Tree, lang: string): Promise<Adopted> {
  if (tree.key) return { adopted: false, why: "already" };
  const problems = verifyFull(tree).findings.filter((f) => f.level === "error");
  if (problems.length) return { adopted: false, why: "problems", problems };
  if (!(await ctx.confirm(ui(lang, "ui.seal.ask", { name: tree.config.name }), true))) return { adopted: false, why: "cancelled" };
  tree.withTreeLock(() => {
    createKey(tree.env, tree.config.id);
    tree.reloadKey();
    tree.appendOp({ op: "seal.adopt", targets: [], files: [], summary: "Tree adopted on this computer" });
    tree.commit("Seal: tree adopted on this computer");
  });
  return { adopted: true };
}

/** The trees asked about in this process (the setup, then the menu): each asked once. */
const asked = new Set<string>();

/** Whether to offer taking this tree over now: not sealed here, a person at a terminal, not asked yet in this process. */
export function offerAdopt(ctx: Context, root: string, person: boolean): boolean {
  if (!person || !ctx.interactive || asked.has(root) || sealedHere(root, ctx.env)) return false;
  asked.add(root);
  return true;
}

/**
 * The family trees the setup found in the research's folder (strom brought back, a folder from another computer): each
 * said, and of one sealed on another computer how it is taken over — the setup then never ends with "strom init".
 */
export function foundTrees(ctx: Context, lang: string): { lines: string[]; foreign: { name: string; root: string }[] } {
  const known = ctx.knownTrees();
  const foreign = known.filter((k) => !sealedHere(k.root, ctx.env));
  if (!known.length) return { lines: [], foreign };
  const lines = [
    ui(lang, "ui.setup.found"),
    ...known.map((k) => `  ${k.name}  (${ctx.display(k.root)})${foreign.includes(k) ? `  – ${ui(lang, "ui.setup.found.foreign", { command: `strom seal adopt --tree "${k.name}"` })}` : ""}`),
  ];
  return { lines, foreign: foreign.map(({ name, root }) => ({ name, root })) };
}
