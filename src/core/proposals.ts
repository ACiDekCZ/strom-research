// An agent's proposal to change a value of the user's or an import's (core/origin.ts) as a person reads it: its title
// and its two sides — the value now, the value proposed — said in the language they are shown in (--lang, the
// research's), from what the proposal holds (the fact proposed, the name, the sex, the event as it is now), never the
// words it was written with (a proposal made in a Czech research reads "Birth" with --lang en). Kept apart from
// core/origin.ts so the titles of conflicts (core/people.ts) read it without the writers.

import type { Conflict, Event, Family, Name, Person, Sex, Source, ValueOrigin } from "./model.ts";
import { gedcomName, primaryName } from "./people.ts";
import { eventName, humanDate } from "../cli/human.ts";
import { ui } from "../cli/ui.ts";
import type { Op, Tree } from "./tree.ts";

export type FactWords = Partial<Record<"date" | "place" | "value", string | undefined>>;

/** A fact as a proposal's title says it, in a language: "1904, Lhota". */
export function factWords(lang: string, f: FactWords): string {
  return [f.value, f.date ? humanDate(f.date, lang) : undefined, f.place].filter(Boolean).join(", ") || "—";
}

/** A fact as a claim holds it: "farmer, 1904, Lhota". */
export function factValue(f: FactWords): string {
  return [f.value, f.date, f.place].filter(Boolean).join(", ");
}

/** A name as a person reads it: "Jan Lhoták". */
export const plainName = (n: Name | undefined): string => (n ? gedcomName(n).replace(/\//g, "").replace(/\s+/g, " ").trim() : "");

/** Whom a record is: a person's name, a couple's names. */
export function ownerWords(tree: Tree, owner: Person | Family): string {
  if (owner.type === "person") return plainName(primaryName(owner));
  return owner.partners.map((id) => tree.get<Person>(id)).filter((p): p is Person => !!p).map((p) => plainName(primaryName(p))).join(" & ") || owner.id;
}

/** A sex in words. */
export const sexWords = (lang: string, s: string): string => ui(lang, s === "M" ? "ui.show.sex.M" : s === "F" ? "ui.show.sex.F" : "ui.conflict.sex.U");

/** The fact a proposal is about (edit, retract), where it is now: among its subject's facts, else anywhere. */
export function proposalEvent(tree: Tree, c: Conflict): { owner: Person | Family; event: Event } | undefined {
  const id = c.edit?.event ?? c.proposal?.retract?.event;
  if (!id) return undefined;
  const find = (owners: (Person | Family | undefined)[]) => {
    for (const o of owners) {
      if (!o || (o.type !== "person" && o.type !== "family")) continue;
      const event = o.events.find((e) => e.id === id);
      if (event) return { owner: o, event };
    }
    return undefined;
  };
  return find(c.subject.map((s) => tree.get<Person | Family>(s))) ?? find([...tree.list<Person>("person"), ...tree.list<Family>("family")]);
}

/** What a proposal would change, in words ("birth", "name", "sex", "name shown"). */
function whatOf(tree: Tree, c: Conflict, lang: string): string {
  const pr = c.proposal!;
  if (pr.primary) return ui(lang, "ui.conflict.primary");
  if (pr.name) return ui(lang, "ui.conflict.name");
  if (pr.sex) return ui(lang, "ui.conflict.sex");
  const e = proposalEvent(tree, c)?.event;
  return eventName(e?.kind ?? c.fact ?? "EVEN", lang, e?.label);
}

/** Whose a part of a value is (as core/origin.ts ownerOf says it: kept here, below the writers). */
function ownerOfPart<P extends string>(origin: ValueOrigin<P> | undefined, part?: P): "user" | "import" | "research" {
  if (!origin) return "research";
  if (origin.by === "user") return "user";
  return !origin.parts || part === undefined || origin.parts.includes(part) ? "import" : "user";
}

/** The person a proposal of a name, a sex or the name shown is about, as they are now. */
function personNow(tree: Tree, c: Conflict): Person | undefined {
  const id = (c.proposal?.name ?? c.proposal?.sex ?? c.proposal?.primary)?.person;
  const p = id ? tree.get<Person>(id) : undefined;
  return p && p.type === "person" && !p.retracted ? p : undefined;
}

/**
 * The value a proposal is about as it is now (N-A, found by the verification of 066 U3): its words, whose it is now
 * (the user's, an import's, the research's) — and whether it changed since the proposal was made (`stale`: the
 * person's own later value, never written over by taking the proposal). `was`: the value the proposal saw, in words.
 * Undefined where the value is gone (the fact retracted, the person no longer in the research).
 */
export interface ProposalNow {
  text: string;
  value: string;
  kind: "user" | "import" | "research";
  stale: boolean;
  was: string;
}

export function proposalNow(tree: Tree, c: Conflict, lang: string): ProposalNow | undefined {
  const pr = c.proposal;
  if (!pr) return undefined;
  const nowClaim = c.claims[0];
  const seen = nowClaim?.value ?? "";
  const was = nowClaim?.text ?? seen;
  const out = (value: string, text: string, kind: ProposalNow["kind"]): ProposalNow => ({ value, text, kind, stale: value.slice(0, 500) !== seen, was });
  if (pr.sex || pr.name || pr.primary) {
    const p = personNow(tree, c);
    if (!p) return undefined;
    if (pr.sex) return { ...out(p.sex, sexWords(lang, p.sex), ownerOfPart(p.sexOrigin)), was: sexWords(lang, seen || "U") };
    if (pr.name) {
      const n = primaryName(p);
      const parts = (["given", "surname"] as const).filter((k) => (n[k] ?? "") !== (pr.name![k] ?? ""));
      const owners = (parts.length ? parts : (["given", "surname"] as const)).map((k) => ownerOfPart(n.origin, k));
      // shown by another name now than the one the proposal changes: changed since
      const moved = p.names.indexOf(n) !== pr.name.index;
      const x = out(gedcomName(n), plainName(n) || "—", owners.includes("user") ? "user" : owners.includes("import") ? "import" : "research");
      return moved ? { ...x, stale: true } : x;
    }
    const marked = p.names.find((n) => n.primary);
    const target = pr.primary!.index >= 0 ? p.names[pr.primary!.index] : undefined;
    const owners = [marked, target].filter((n): n is Name => !!n).map((n) => ownerOfPart(n.origin));
    const none = ui(lang, "ui.conflict.primary.none");
    return { ...out(marked ? gedcomName(marked) : "", marked ? plainName(marked) : none, owners.includes("user") ? "user" : owners.includes("import") ? "import" : "research"), was: seen ? was : none };
  }
  const found = proposalEvent(tree, c);
  if (!found || found.event.retracted || found.owner.retracted) return undefined;
  const e = found.event;
  const parts = pr.retract ? (["date", "place", "value"] as const).filter((k) => !!e[k]) : (["date", "place", "value"] as const).filter((k) => (e[k] ?? "") !== (c.edit?.[k] ?? ""));
  const owners = (parts.length ? parts : (["date", "place", "value"] as const)).map((k) => ownerOfPart(e.origin, k));
  // the value it saw, held as "value, date, place" (factValue): its date said in the language shown, the rest as held
  const sawWords = seen
    ? seen
        .split(", ")
        .map((x) => {
          const d = humanDate(x, lang);
          return d !== x.toUpperCase() ? d : x;
        })
        .join(", ")
    : "—";
  return { ...out(factValue(e), factWords(lang, e), owners.includes("user") ? "user" : owners.includes("import") ? "import" : "research"), was: sawWords };
}

/**
 * Whether an open proposal is out of date: the value it would change is no longer the value it saw (the person, or
 * the research on a record, changed it since) — taking it would write over that newer value. Its id and the value it
 * saw, for the refusal; undefined where it may be taken.
 */
export function staleProposal(tree: Tree, c: Conflict): ProposalNow | undefined {
  if (!c.proposal || c.state !== "open") return undefined;
  const now = proposalNow(tree, c, tree.lang);
  return now?.stale ? now : undefined;
}

/**
 * Whose value an open proposal would change as it is now (the user's, an import's): the person may have changed an
 * imported value since the proposal was made — then it is the user's. The kind held in the proposal where the value
 * is gone, is the research's now, or the conflict is decided (what it was about when decided).
 */
export function proposalKind(tree: Tree, c: Conflict): "user" | "import" | undefined {
  if (!c.proposal) return undefined;
  if (c.state !== "open") return c.proposal.kind;
  const now = proposalNow(tree, c, tree.lang)?.kind;
  return now === "user" || now === "import" ? now : c.proposal.kind;
}

/**
 * A proposal's reason as a person reads it (N-C): "why: " an older strom put before it taken off; the sync's own
 * reason ("from <the sync's source> (S…)", English in the record) in the language it is shown in. Any other reason as
 * the agent gave it.
 */
export function reasonWords(tree: Tree, lang: string, text: string): string {
  const t = text.replace(/^why: /u, "");
  const m = /^from (.+) \((S\d+)\)$/su.exec(t);
  const s = m ? tree.get<Source>(m[2]!) : undefined;
  return m && s?.type === "source" && s.title === m[1] ? ui(lang, "ui.conflict.proposal.from", { source: `${m[1]} (${m[2]})` }) : t;
}

/**
 * The two sides of a proposal in a language: the value now (an open proposal: as the value is at this moment, whoever
 * changed it since; a decided one: as the fact is now where it still holds the value the proposal saw, else as written
 * then) and the value proposed.
 */
export function proposalSides(tree: Tree, c: Conflict, lang: string): { now: string; proposed: string } {
  const pr = c.proposal!;
  const [nowClaim, newClaim] = c.claims;
  const said = (cl: Conflict["claims"][number] | undefined) => cl?.text ?? cl?.value ?? "";
  const current = c.state === "open" ? proposalNow(tree, c, lang) : undefined;
  if (pr.sex) return { now: current?.text ?? sexWords(lang, nowClaim?.value ?? "U"), proposed: sexWords(lang, pr.sex.sex as Sex) };
  if (pr.primary) {
    const none = ui(lang, "ui.conflict.primary.none");
    return { now: current?.text ?? (nowClaim?.value ? said(nowClaim) : none), proposed: newClaim?.value ? said(newClaim) : none };
  }
  if (pr.name) return { now: current?.text ?? said(nowClaim), proposed: said(newClaim) };
  const e = proposalEvent(tree, c)?.event;
  const now = current?.text ?? (e && nowClaim && factValue(e) === nowClaim.value ? factWords(lang, e) : said(nowClaim));
  if (pr.retract) return { now, proposed: ui(lang, "ui.proposal.retract", { reason: reasonWords(tree, lang, pr.retract.reason) }) };
  return { now, proposed: c.edit ? factWords(lang, c.edit) : said(newClaim) };
}

/** A proposal's title in a language: "Jan Lhoták: Birth — 12. 3. 1841, Lhota × 14. 3. 1841, Lhota". */
export function proposalTitle(tree: Tree, c: Conflict, lang: string): string {
  const owner = c.subject[0] ? tree.get<Person | Family>(c.subject[0]) : undefined;
  const who = owner && (owner.type === "person" || owner.type === "family") ? ownerWords(tree, owner) : (c.subject[0] ?? "");
  const what = whatOf(tree, c, lang);
  const { now, proposed } = proposalSides(tree, c, lang);
  return ui(lang, "ui.conflict.title", { who, what: `${what.charAt(0).toUpperCase()}${what.slice(1)}`, ours: now, theirs: proposed });
}

/** A proposal's reason as written: an older strom put "why: " before it (English in any research) — taken off. */
export const proposalNote = (text: string): string => text.replace(/^why: /u, "");

/**
 * What an operation says where it is listed after a write (`strom event edit`, …): its summary — a proposal settled
 * by the write (core/proposalsettle.ts, English in the history) in the research's language where the person reads it
 * (N-C, found by the verification of 066 U3: "X0001 settled: …" at a Czech person's terminal); an agent reads the
 * summary.
 */
export function opLine(tree: Tree, o: Op): string {
  if (o.op !== "conflict.settle" || !tree.personWrites) return o.summary;
  const m = /^(X\d+) settled: [^(]*\(([^,)]+)/u.exec(o.summary);
  return m ? `${m[1]} ${ui(tree.lang, "ui.conflict.proposal.settled", { ref: m[2]! })}` : o.summary;
}
