// Taking a family tree over on this computer (its seal): strom seal adopt, the menu and the setup go the same way —
// every record checked against its seal, the person's yes, then this computer's key. Never by itself, never by an agent.

import type { Context } from "./context.ts";
import { ui } from "./ui.ts";
import { oneWay, verifyFull } from "../core/integrity.ts";
import { settingsHidden } from "../core/oldsettings.ts";
import { createKey, fingerprint, otherKeys } from "../core/seal.ts";
import { sealedHere, type Tree } from "../core/tree.ts";
import type { Finding } from "../core/check.ts";

export type Adopted = { adopted: true; united?: string[] } | { adopted: false; why: "already" | "problems" | "cancelled"; problems?: Finding[] };

/**
 * The tree taken over here: refused while a record does not match its seal (what, strom check says), else asked — the
 * person's yes (Enter says yes: they came to take it over), then the key, the operation seal.adopt and its commit.
 */
export async function adoptSeal(ctx: Context, tree: Tree, lang: string): Promise<Adopted> {
  if (tree.key) return uniteSeal(ctx, tree, lang);
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
 * Whether to offer uniting this tree's keys now (strom update brought a strom that sees both): sealed here, another key
 * of this computer that the check needs, a person at a terminal, not asked yet in this process.
 */
export function offerUnite(ctx: Context, tree: Tree, person: boolean): boolean {
  if (!person || !ctx.interactive || asked.has(tree.root) || !tree.key || !otherKeys(tree.env, tree.config.id, tree.key).length) return false;
  asked.add(tree.root);
  return keysToUnite(tree).length > 0;
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

/**
 * The other keys of this computer a tree sealed here needs united (strom of an app packaged for Windows and of a
 * terminal each had their own: core/oldsettings.ts): none when the check finds nothing wrong, or none of them.
 */
export function keysToUnite(tree: Tree): Buffer[] {
  if (!tree.key) return [];
  if (!verifyFull(tree).findings.some((f) => f.level === "error")) return [];
  return otherKeys(tree.env, tree.config.id, tree.key).map((o) => o.key);
}

/**
 * A tree sealed here with another key of this computer too: every operation of the other keys checked with them and
 * every record against its seal — refused while anything does not match (a record changed outside strom stays refused),
 * else the person's yes, then the operation seal.unite of this key (the other keys' operations until now taken) and its
 * commit sealed with it.
 */
async function uniteSeal(ctx: Context, tree: Tree, lang: string): Promise<Adopted> {
  const others = keysToUnite(tree);
  if (!others.length) return { adopted: false, why: "already" };
  // a change outside strom too: strom repair first (it keeps the work of both keys), then this again
  const problems = oneWay(verifyFull(tree, { trust: others }).findings.filter((f) => f.level === "error"), () => settingsHidden(tree.env));
  if (problems.length) return { adopted: false, why: "problems", problems };
  if (!(await ctx.confirm(ui(lang, "ui.seal.unite.ask", { name: tree.config.name }), true))) return { adopted: false, why: "cancelled" };
  const united = others.map(fingerprint);
  tree.withTreeLock(() => {
    tree.appendOp({ op: "seal.unite", targets: [], files: [], summary: "Seal keys of this computer united", keys: united });
    tree.commit("Seal: keys of this computer united");
  });
  return { adopted: true, united };
}
