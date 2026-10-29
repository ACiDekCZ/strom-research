// Two people the Strom app would show as a possible duplicate, judged by the research (spec 021 §C): one verdict a pair,
// by the first of fourteen rules that holds — nothing written, nothing merged (POST /duplicates, strom person compare).
// The person's own word comes first (a pair marked "two people", quality/dismissed.json), then what the research knows
// for certain tells two people apart, and only then what makes them alike. A pair whose names do not fit in the
// research is left unsure: the app may have changed a name by hand, the research does not judge for it.

import { certainlyBefore, dateYears } from "./gdate.ts";
import { birthEvent, familiesAsChild, parentsOf, sameSurname } from "./people.ts";
import { dismissedLookup, personId, personNow, POSSIBLE_DUPLICATE } from "./quality.ts";
import { sameFamily } from "./surnames.ts";
import { foldText } from "./text.ts";
import type { Event, Name, Person } from "./model.ts";
import type { Tree } from "./tree.ts";

/** Birth years further apart than this are two people. */
export const YEARS_CLOSE = 3;
export const PAIRS_MAX = 1000;

export type VerdictKind = "same" | "different" | "unsure";

export interface Verdict {
  /** The pair as it was asked. */
  pair: unknown[];
  /** None for a pair the research does not know (unknown-person). */
  verdict?: VerdictKind;
  reason: string;
  /** The years of birth or baptism of both, where both are known. */
  years?: [number, number];
  /** merged: who the two are now. */
  into?: string;
  /** decided: when and where the person said they are two. */
  at?: string;
  by?: "app" | "research";
}

const written = (e: Event) => !(e.retracted || e.status === "retracted" || e.status === "disproven");
const first = (n: Name) => foldText(n.given ?? "").split(" ").filter(Boolean)[0] ?? "";

/** The year of a person's birth or baptism (BIRT, CHR, BAPM): the earliest its date may mean. */
function birthYear(p: Person): number | undefined {
  const ys = dateYears(birthEvent(p)?.date ?? "");
  return ys.length ? Math.min(...ys) : undefined;
}

/** A person's deaths and burials written with a date. */
const deathsOf = (p: Person) => p.events.filter((e) => (e.kind === "DEAT" || e.kind === "BURI") && written(e) && !!e.date);

/** The judge of pairs of one research as it is now. */
export function judge(tree: Tree): (pair: unknown[]) => Verdict {
  const marked = dismissedLookup(tree);
  const family = sameFamily(tree);
  const surnamesFit = (a: string, b: string) => sameSurname(a, b) || family(a, b);
  const namesFit = (a: Person, b: Person) => a.names.some((n) => !!first(n) && b.names.some((m) => first(n) === first(m) && surnamesFit(n.surname, m.surname)));
  const alike = (a: Person, b: Person) => (a.sex === "U" || b.sex === "U" || a.sex === b.sex) && namesFit(a, b);
  const known = (raw: unknown): Person | undefined => {
    const id = personId(raw);
    const p = id ? tree.get<Person>(id) : undefined;
    return p && (!p.retracted || p.mergedInto) ? p : undefined;
  };
  return (pair) => {
    const [ra, rb] = [known(pair[0]), known(pair[1])];
    if (pair.length !== 2 || !ra || !rb) return { pair, reason: "unknown-person" };
    const [ia, ib] = [personNow(tree, ra.id), personNow(tree, rb.id)];
    const [a, b] = [tree.get<Person>(ia), tree.get<Person>(ib)];
    if (!a || !b || (a.retracted && !a.mergedInto) || (b.retracted && !b.mergedInto)) return { pair, reason: "unknown-person" };
    const [ya, yb] = [birthYear(a), birthYear(b)];
    const years = ya !== undefined && yb !== undefined ? { years: [ya, yb] as [number, number] } : {};
    const say = (verdict: VerdictKind, reason: string, more: Partial<Verdict> = {}): Verdict => ({ pair, verdict, reason, ...years, ...more });
    // 2. merged already: the app holds an older version
    if (ia === ib) return say("same", "merged", { into: ia });
    // 3. the person said they are two
    const mark = marked(POSSIBLE_DUPLICATE, [ia, ib]);
    if (mark) return say("different", "decided", { at: mark.at, by: mark.by });
    // 4.–9. what tells two people apart for certain
    if ((a.sex === "M" || a.sex === "F") && (b.sex === "M" || b.sex === "F") && a.sex !== b.sex) return say("different", "different-sex");
    if (familiesAsChild(tree, ia).some((f) => f.partners.includes(ib)) || familiesAsChild(tree, ib).some((f) => f.partners.includes(ia))) return say("different", "parent-child");
    if (ya !== undefined && yb !== undefined && Math.abs(ya - yb) > YEARS_CLOSE) return say("different", "years-apart");
    const [ba, bb] = [birthEvent(a)?.date, birthEvent(b)?.date];
    if (deathsOf(a).some((d) => certainlyBefore(d.date, bb)) || deathsOf(b).some((d) => certainlyBefore(d.date, ba))) return say("different", "life-no-overlap");
    const fa = new Set(familiesAsChild(tree, ia).map((f) => f.id));
    const siblings = familiesAsChild(tree, ib).some((f) => fa.has(f.id));
    const sameFirst = a.names.some((n) => !!first(n) && b.names.some((m) => first(n) === first(m)));
    const diedBefore = (x: Person, y: number | undefined) => y !== undefined && deathsOf(x).some((d) => dateYears(d.date!).length > 0 && Math.max(...dateYears(d.date!)) <= y);
    if (siblings && sameFirst && (diedBefore(a, yb) || diedBefore(b, ya))) return say("different", "siblings");
    const [pa, pb] = [parentsOf(tree, ia), parentsOf(tree, ib)];
    const common = pa.some((x) => pb.some((y) => x.id === y.id));
    // the parents alike: each two of one sex known on both sides alike (one name, one family's surname), one pair at least
    const bySex = (ps: Person[], sex: string) => ps.filter((x) => x.sex === sex);
    const compared = (["M", "F"] as const).filter((s) => bySex(pa, s).length && bySex(pb, s).length);
    const parentsAlike = compared.length > 0 && compared.every((s) => bySex(pa, s).some((x) => bySex(pb, s).some((y) => alike(x, y))));
    const anyAlike = pa.some((x) => pb.some((y) => alike(x, y)));
    if (pa.length >= 2 && pb.length >= 2 && !common && !anyAlike) return say("different", "different-parents");
    // 14. the names do not fit in the research: unsure, before anything makes them alike
    if (!namesFit(a, b)) return say("unsure", "names-differ");
    // 10.–11. what makes them one
    if ((common || siblings || parentsAlike) && ya !== undefined && yb !== undefined) return say("same", "same-parents");
    const cites = (p: Person) => new Set(p.events.filter(written).flatMap((e) => (e.citations ?? []).map((c) => JSON.stringify([e.kind, c.source, (c.locator ?? "").trim()]))));
    const cb = cites(b);
    if ([...cites(a)].some((k) => cb.has(k))) return say("same", "same-events");
    // 12.–13. nothing decides
    if (ya !== undefined && yb !== undefined) return say("unsure", "close-years");
    return say("unsure", "no-date");
  };
}

/** The verdicts of pairs, in their order. */
export function judgePairs(tree: Tree, pairs: unknown[][]): Verdict[] {
  const j = judge(tree);
  return pairs.map((p) => j(p));
}

/**
 * The pairs a body or a file asks: {"pairs": [[P…, P…], …]}, a list of pairs, or lines of two IDs. Undefined when it
 * is none of them, has more than PAIRS_MAX pairs, or an ID that is no P….
 */
export function pairsOf(text: string): unknown[][] | undefined {
  const t = text.trim();
  let pairs: unknown;
  if (t.startsWith("{") || t.startsWith("[")) {
    try {
      const v: unknown = JSON.parse(t);
      pairs = Array.isArray(v) ? v : v && typeof v === "object" ? (v as { pairs?: unknown }).pairs : undefined;
    } catch {
      return undefined;
    }
  } else pairs = t ? t.split(/\r?\n/u).map((l) => l.trim()).filter(Boolean).map((l) => l.split(/[\s,;]+/u)) : [];
  if (!Array.isArray(pairs) || pairs.length > PAIRS_MAX) return undefined;
  const ok = pairs.every((p) => Array.isArray(p) && p.length === 2 && p.every((x) => typeof x === "string" && /^P\d{1,9}$/u.test(x)));
  return ok ? (pairs as unknown[][]) : undefined;
}
