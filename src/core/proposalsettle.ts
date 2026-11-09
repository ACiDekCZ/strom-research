// An agent's proposal (core/origin.ts) that holds by itself: the value it proposes is the value now — the agent changed
// it later on a record it cited, or the person wrote exactly that value. Nothing is left to decide: the proposal is
// closed (resolved, the research's side taken, the reason said), no value written. Settled at every write of a person
// or a family (core/records.ts update, core/actions.ts), and once over the open proposals a research has when a newer
// strom first runs or a bridge starts (core/originfix.ts settleHeldProposals). A proposal that does not hold stays open.

import type { Conflict, Person } from "./model.ts";
import { update } from "./records.ts";
import { claimText, gedcomName, primaryName } from "./people.ts";
import { now, type Tree } from "./tree.ts";
import { proposalEvent } from "./proposals.ts";

/** The reasoning a settled proposal keeps (English in the record; `strom conflict show` says it in the research's language). */
export const SETTLED = "settled: the value proposed holds now";

/** The proposals being decided in this process (strom conflict resolve --take): closed by that decision, not settled. */
const deciding = new Set<string>();

/** Do what a decision of a proposal writes, the proposal itself never settled by it. */
export function whileDeciding<T>(id: string, fn: () => T): T {
  deciding.add(id);
  try {
    return fn();
  } finally {
    deciding.delete(id);
  }
}

/** The person a proposal of a name, a sex or the name shown is about. */
const personOf = (c: Conflict): string | undefined => (c.proposal?.name ?? c.proposal?.sex ?? c.proposal?.primary)?.person;

/** Where the value proposed holds now: the key of the value (the fact, the person); undefined where it does not. */
export function proposalHolds(tree: Tree, c: Conflict): string | undefined {
  const pr = c.proposal;
  if (!pr) return undefined;
  const who = personOf(c);
  if (who) {
    const p = tree.get<Person>(who);
    if (!p || p.type !== "person" || p.retracted) return undefined;
    if (pr.sex) return p.sex === pr.sex.sex ? p.id : undefined;
    if (pr.name) {
      const n = primaryName(p);
      return (n.given ?? "") === (pr.name.given ?? "") && (n.surname ?? "") === (pr.name.surname ?? "") ? p.id : undefined;
    }
    // the name shown: the one proposed marked (its claim: "Given /Surname/"), or none marked where none was proposed
    const marked = p.names.find((n) => n.primary);
    return (marked ? gedcomName(marked) : "") === (c.claims[1]?.value ?? "") ? p.id : undefined;
  }
  const found = proposalEvent(tree, c);
  if (!found || found.owner.retracted) return undefined;
  const e = found.event;
  if (pr.retract) return e.retracted ? e.id : undefined;
  if (!c.edit || e.retracted) return undefined;
  return (["date", "place", "value"] as const).every((k) => (e[k] ?? "") === (c.edit![k] ?? "")) ? e.id : undefined;
}

/** Whether an open proposal concerns one of these records (a person, a family). */
function concerns(c: Conflict, owners: ReadonlySet<string>): boolean {
  const who = personOf(c);
  return (!!who && owners.has(who)) || c.subject.some((s) => owners.has(s));
}

/**
 * The open proposals (of these records, else all) whose value proposed holds now: each closed — resolved, the
 * research's side taken, its value as the decision, the reasoning SETTLED — as one operation each. The ones closed.
 */
export function settleProposals(tree: Tree, owners?: Iterable<string>): Conflict[] {
  const of = owners ? new Set(owners) : undefined;
  if (of && !of.size) return [];
  const open = tree.list<Conflict>("conflict").filter((c) => c.state === "open" && !c.retracted && !!c.proposal && !deciding.has(c.id) && (!of || concerns(c, of)));
  if (!open.length) return [];
  const out: Conflict[] = [];
  tree.withTreeLock(() => {
    for (const c0 of open) {
      const c = tree.get<Conflict>(c0.id);
      if (!c || c.state !== "open" || c.retracted || !c.proposal) continue;
      const ref = proposalHolds(tree, c);
      if (!ref) continue;
      const proposed = c.claims[1];
      const resolution = proposed ? claimText(tree, c, proposed).slice(0, 500) : undefined;
      const reasoning = `${SETTLED} (${ref}, written by ${tree.actor})`;
      out.push(
        update<Conflict>(
          tree,
          c.id,
          "conflict",
          (x) => {
            // the person's own write settles it as theirs; strom's own pass, an agent's write: decided by nobody
            const { decidedIn: _i, decidedBy: _b, ...rest } = x;
            return { ...rest, state: "resolved", ...(resolution ? { resolution } : {}), reasoning, ...(tree.personWrites ? { decidedBy: "user" as const } : {}), decidedAt: now(), taken: "research" };
          },
          { op: "conflict.settle", summary: `${c.id} settled: the value proposed holds now (${ref})`, targets: [...c.subject] },
        ),
      );
    }
  });
  return out;
}
