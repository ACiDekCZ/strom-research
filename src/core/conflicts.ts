// A conflict of the user's edit in the Strom app with what the research holds: its two sides, the user's and the
// research's — what `strom conflict resolve --take user|research` decides by.

import type { Conflict, Family, Person } from "./model.ts";
import { UsageError } from "./errors.ts";
import type { Tree } from "./tree.ts";
import { claimText } from "./people.ts";

type Claim = Conflict["claims"][number];

/** The note on the user's claim of a conflict of their edit (core/sync.ts conflictOfEdit). */
export const USER_EDIT = "the user's edit";

/** A conflict of the user's edit in the Strom app: a fact's, a child's parents, a name's, a title's or a sex's. */
export function isEditConflict(c: Conflict): boolean {
  return Boolean(c.edit || c.parents || (["NAME", "SEX", "NPFX", "NSFX"].includes(c.fact ?? "") && c.claims.some((x) => x.note === USER_EDIT)));
}

/** Which side a claim of a conflict of the user's edit is: the user's, the research's; none in any other conflict. */
export function sideOf(c: Conflict, claim: Claim): "user" | "research" | undefined {
  if (!isEditConflict(c)) return undefined;
  if (claim.note === USER_EDIT) return "user";
  if (claim.note?.startsWith("the research")) return "research";
  return undefined;
}

/** The claim of a side of a conflict of the user's edit. */
export function claimOf(c: Conflict, side: "user" | "research"): Claim | undefined {
  return c.claims.find((x) => sideOf(c, x) === side);
}

/** The kinds of fact a conflict of the user's edit is decided by side from the Strom app (phase 1: not a child's parents). */
const BY_SIDE = new Set(["NAME", "SEX", "NPFX", "NSFX"]);

/**
 * The two sides of a conflict of the user's edit the Strom app decides by side (conflict.decide): a fact's value (date,
 * place, value — not its details or the people it names, which carry no edit), a name, a title before or after it, a
 * sex. None for a child's parents (FAMC), a conflict between sources, or one without both sides.
 */
export function sidesOf(c: Conflict): { user: Claim; research: Claim } | undefined {
  if (!isEditConflict(c) || c.parents || c.fact === "FAMC") return undefined;
  if (!c.edit && !BY_SIDE.has(c.fact ?? "")) return undefined;
  const user = claimOf(c, "user");
  const research = claimOf(c, "research");
  return user && research ? { user, research } : undefined;
}

/**
 * A side's value as the Strom app is given it (the Strom file's VAL, the bridge's sides): in the research's language,
 * an empty value empty (a title the user took off) — never a dash.
 */
export function sideText(tree: Tree, c: Conflict, claim: Claim): string {
  return claim.value.trim() === "" ? "" : claimText(tree, c, claim);
}

/** What the app is told of a conflict it decides by side: both sides' values, a sex also as M, F or U. */
export function appSides(tree: Tree, c: Conflict): { take: true; sides: { user: string; research: string }; raw?: { user: string; research: string } } | undefined {
  const s = c.state === "open" ? sidesOf(c) : undefined;
  if (!s) return undefined;
  return {
    take: true,
    sides: { user: sideText(tree, c, s.user), research: sideText(tree, c, s.research) },
    ...(c.fact === "SEX" ? { raw: { user: sexRaw(s.user.value), research: sexRaw(s.research.value) } } : {}),
  };
}

/** A sex as a program reads it: M, F, else U. */
export function sexRaw(v: string): "M" | "F" | "U" {
  return v === "M" || v === "F" ? v : "U";
}

/** The sources a conflict's decision weighed: those of its claims, and those of the fact of the user's edit. */
export function weighedSources(tree: Tree, c: Conflict): Set<string> {
  const out = new Set(c.claims.map((x) => x.source).filter((s): s is string => !!s));
  if (c.edit)
    for (const owner of c.subject) {
      const rec = tree.get<Person | Family>(owner);
      const e = rec && (rec.type === "person" || rec.type === "family") ? rec.events.find((x) => x.id === c.edit!.event) : undefined;
      for (const cite of e?.citations ?? []) out.add(cite.source);
    }
  return out;
}

/**
 * Whether a decided conflict may be decided again (strom conflict resolve), else why not: only with a reason; a side
 * once taken is not taken again (its fact is written: changed with the fact commands); what the user decided, an agent
 * decides again only on a source the decision did not weigh.
 */
export function againAllowed(tree: Tree, c: Conflict, how: { reason?: string | undefined; sources: string[]; by: "user" | "agent"; side?: "user" | "research" | undefined }): void {
  const was = c.resolution ?? "";
  const params = { id: c.id, resolution: was, ...(c.taken ? { take: c.taken } : {}), ...(c.decidedBy ? { by: c.decidedBy } : {}) };
  if (!how.reason)
    throw new UsageError(`${c.id} is decided already: "${was.slice(0, 120)}"${c.decidedBy === "user" ? " — the user's decision" : ""}`, {
      hint: c.decidedBy === "user" ? `the user's decision stands; deciding it again needs a new source and a reason: strom conflict resolve ${c.id} … --source S… --reason "<what the new record shows>"` : `deciding again needs --reason (e.g. "the marriage entry of 1839 overturns it")`,
      code: "conflict.decided",
      params,
    });
  if (how.side && c.taken)
    throw new UsageError(`${c.id} took the ${c.taken === "user" ? "user's" : "research's"} value already: its fact is written — change the fact with the fact commands (event edit, event retract), then decide it again with --resolution`, {
      hint: `strom conflict show ${c.id}`,
      code: "conflict.taken",
      params,
    });
  if (c.decidedBy === "user" && how.by === "agent") {
    const weighed = weighedSources(tree, c);
    const fresh = how.sources.filter((s) => !weighed.has(s));
    if (!fresh.length)
      throw new UsageError(`${c.id} is the user's decision: an agent decides it again only on a source it did not weigh (${[...weighed].join(", ") || "none"})`, {
        hint: `strom conflict resolve ${c.id} … --source S… --reason "<what the new record shows>" — or ask the user`,
        code: "conflict.user-decided",
        params,
      });
  }
}
