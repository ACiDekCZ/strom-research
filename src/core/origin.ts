// Where a value came from (spec 066 U3, K2.1–K2.3): a fact's date, place and value, a name, a sex — from an import of a
// family tree (a lead), from the user, or the research's own (no origin). What an agent may change of them:
//
// - the user's value never: the agent proposes (a conflict of kind "user"), the user decides;
// - an import's value only on a record — a new --cite of a source that is no family tree, memory, compiled work or
//   index, or one the fact cites already — and never where the person decides (hypotheses.decide person): otherwise a
//   proposal (a conflict of kind "import"). Changed so, the import's value is kept (`was`), its citation gives way to
//   the record's and the fact is the research's;
// - the research's own freely, as ever.
//
// The person (their terminal, the Strom app's bridge: Tree.personWrites) changes anything; what they write is theirs
// (origin user). They may also put an import's value back (revertImported: `strom event revert`, `strom person revert`,
// the bridge's POST /facts/revert). The guards sit in the commands an agent uses (event edit, person edit, name primary,
// event retract, place rewrite) — never in core/actions.ts, which a sync and a fix use too.
//
// For the bridge and the GEDCOM (subagent B): `factRef`, `nameRef`, `sexRef` give the opaque keys (`E0012`,
// `N:P0004:1`, `SEX:P0004`) the Strom file's `3 _REF` carries; `revertImported` takes them back with a part (`date`,
// `place`, `value`, `given`, `surname`, or the GEDCOM's DATE, PLAC, VAL, GIVN, SURN, SEX).

import type { Citation, Conflict, Event, Family, Name, Person, Sex, Source, ValueOrigin } from "./model.ts";
import { UsageError } from "./errors.ts";
import { isWeak, defaultStatus, checkStatus } from "./evidence.ts";
import { editEvent, editPerson, findEventOwner, markPrimaryName, retractEvent } from "./actions.ts";
import { create, update } from "./records.ts";
import { gedcomName, primaryName } from "./people.ts";
import { now, type Tree } from "./tree.ts";
import { phrase } from "./phrases.ts";
import { children, val, type GedNode } from "../gedcom/parse.ts";
import { ui } from "../cli/ui.ts";
import { eventName } from "../cli/human.ts";
import { factValue, factWords, ownerWords, plainName, sexWords, staleProposal } from "./proposals.ts";
import { whileDeciding } from "./proposalsettle.ts";

export type FactPart = "date" | "place" | "value";
export type NamePart = "given" | "surname";
export const FACT_PARTS: readonly FactPart[] = ["date", "place", "value"];
export const NAME_PARTS: readonly NamePart[] = ["given", "surname"];

/** Whose a value is: the user's, an import's (a lead), or the research's own. */
export type Owner = "user" | "import" | "research";

/**
 * Whose a part of a value is: no origin, the research's; the user's; an import's — only the parts it names where it
 * names some (the others the user changed in the Strom app: theirs). A sex has no parts.
 */
export function ownerOf<P extends string>(origin: ValueOrigin<P> | undefined, part?: P): Owner {
  if (!origin) return "research";
  if (origin.by === "user") return "user";
  return !origin.parts || part === undefined || origin.parts.includes(part) ? "import" : "user";
}

/** The opaque key of a fact, a name (1-based) and a sex for the Strom file's `3 _REF` and the bridge's revert. */
export const factRef = (e: Pick<Event, "id">): string => e.id;
export const nameRef = (p: Pick<Person, "id">, index: number): string => `N:${p.id}:${index + 1}`;
export const sexRef = (p: Pick<Person, "id">): string => `SEX:${p.id}`;

/** A source that can change a value of an import: one of records (no family tree, memory, compiled work, index), not taken back. */
export function recordSource(tree: Tree, id: string | undefined): boolean {
  const s = id ? tree.get<Source>(id) : undefined;
  return !!s && s.type === "source" && !s.retracted && !isWeak(s);
}

/** The records a list of citations cites (no import, no family tree): what a value already rests on. */
function recordsCited(tree: Tree, citations: readonly Citation[] | undefined): string[] {
  return [...new Set((citations ?? []).map((c) => c.source).filter((s) => recordSource(tree, s)))];
}

/** A citation's source is one of the research's (the change rests on it). */
export function checkCited(tree: Tree, c: Citation): void {
  if (tree.get(c.source)?.type !== "source") throw new UsageError(`no source ${c.source}`, { hint: 'strom source add "<title>" …', code: "record.none", params: { kind: "source", id: c.source } });
}

/** How an agent's change of a value stands: free (the research's), allowed on a record (an import's), or only a proposal. */
export type Verdict = { kind: "free" } | { kind: "allowed"; because: string[] } | { kind: "propose"; as: "user" | "import"; why: "user" | "record" | "decide" };

export interface GuardOptions {
  /** The new citation the agent gives (--cite): a record lets it change an import's value. */
  cite?: Citation | undefined;
  /** The person decides (hypotheses.decide person): every change of an import's value is a proposal. */
  decidePerson: boolean;
}

/**
 * The verdict on an agent's change of parts of a value: a user's part — a proposal; an import's — a proposal where the
 * person decides, allowed on a record (the new citation, or one the value cites already), else a proposal.
 */
export function verdictOf<P extends string>(tree: Tree, origin: ValueOrigin<P> | undefined, parts: readonly (P | undefined)[], citations: readonly Citation[] | undefined, g: GuardOptions): Verdict {
  const owners = parts.map((p) => ownerOf(origin, p));
  if (owners.includes("user")) return { kind: "propose", as: "user", why: "user" };
  if (!owners.includes("import")) return { kind: "free" };
  if (g.decidePerson) return { kind: "propose", as: "import", why: "decide" };
  const because = [...new Set([...(g.cite && recordSource(tree, g.cite.source) ? [g.cite.source] : []), ...recordsCited(tree, citations)])];
  return because.length ? { kind: "allowed", because } : { kind: "propose", as: "import", why: "record" };
}

/** The parts of a fact a change gives other values (an empty one: taken off; filling one in is a change too). */
export function factChanges(e: Event, change: Partial<Record<FactPart, string | undefined>>): FactPart[] {
  return FACT_PARTS.filter((k) => change[k] !== undefined && (e[k] ?? "") !== (change[k] ?? "").trim());
}

// ── values changed: by the research on a record, by the person ────────────────────────────────────────────────────

/** A list of citations with these added (the same place of a source once), the import's taken off when it gave way. */
function citationsWith(list: readonly Citation[], add: readonly Citation[], drop?: string): Citation[] {
  const kept = drop ? list.filter((c) => c.source !== drop) : [...list];
  for (const c of add) if (!kept.some((x) => x.source === c.source && x.locator === c.locator)) kept.push(c);
  return kept;
}

/** The import's values of a fact kept as they were before the first change of each part (`was`). */
function keptWas(tree: Tree, before: Event, parts: FactPart[], because: string[]): Event["was"] {
  const origin = before.origin;
  const was: NonNullable<Event["was"]> = before.was
    ? structuredClone(before.was)
    : { ...(origin?.source ? { source: origin.source } : {}), parts: [], because: [], at: now(), by: tree.actor };
  for (const p of parts) {
    if (was.parts.includes(p)) continue;
    was.parts.push(p);
    if (before[p] !== undefined) was[p] = before[p];
  }
  if (!was.cites && origin?.source) {
    const cites = before.citations.filter((c) => c.source === origin.source);
    if (cites.length) was.cites = cites;
  }
  for (const s of because) if (!was.because.includes(s)) was.because.push(s);
  return was;
}

/**
 * A fact an agent changed (event edit): the new citation added; an import's parts changed on a record — their values
 * kept (`was`), the import's citation gone, the fact the research's (no origin). A lead cited by a record is probable.
 */
export function researchChangedFact(tree: Tree, before: Event, next: Event, cite: Citation | undefined): Event {
  const changed = factChanges(before, { date: next.date ?? "", place: next.place ?? "", value: next.value ?? "" });
  const imported = changed.filter((p) => ownerOf(before.origin, p) === "import");
  const out: Event = { ...next };
  if (imported.length) {
    const because = [...new Set([...(cite && recordSource(tree, cite.source) ? [cite.source] : []), ...recordsCited(tree, before.citations)])];
    out.was = keptWas(tree, before, imported, because);
    out.citations = citationsWith(next.citations, cite ? [cite] : [], before.origin?.source);
    delete out.origin;
  } else if (cite) out.citations = citationsWith(next.citations, [cite]);
  if (cite || imported.length) {
    if (out.status === "lead" && before.status === next.status) out.status = defaultStatus(tree, out.citations);
    checkStatus(tree, out.status, out.citations);
  }
  return out;
}

/** A fact the person changed: theirs (origin user); an import's values they changed kept (`was`) to be put back. */
export function personChangedFact(tree: Tree, before: Event, next: Event, cites: readonly Citation[] = []): Event {
  const changed = factChanges(before, { date: next.date ?? "", place: next.place ?? "", value: next.value ?? "" });
  const out: Event = cites.length ? { ...next, citations: citationsWith(next.citations, cites) } : { ...next };
  if (!changed.length) return out;
  const imported = changed.filter((p) => ownerOf(before.origin, p) === "import");
  if (imported.length) out.was = keptWas(tree, before, imported, cites.map((c) => c.source).filter((s) => recordSource(tree, s)));
  out.origin = { by: "user" };
  if (cites.length && out.status === "lead") out.status = defaultStatus(tree, out.citations);
  return out;
}

/** A name changed: by the research on a record (the import's kept, its citation gone) or by the person (theirs). */
function changedName(tree: Tree, before: Name, next: Name, by: "research" | "person", cite: Citation | undefined): Name {
  const changed = NAME_PARTS.filter((k) => before[k] !== next[k]);
  const imported = changed.filter((p) => ownerOf(before.origin, p) === "import");
  const out: Name = { ...next };
  if (imported.length) {
    const was: NonNullable<Name["was"]> = before.was
      ? structuredClone(before.was)
      : { ...(before.origin?.source ? { source: before.origin.source } : {}), parts: [], because: [], at: now(), by: tree.actor };
    for (const p of imported) if (!was.parts.includes(p)) (was.parts.push(p), (was[p] = before[p]));
    if (!was.cites && before.origin?.source) {
      const cites = (before.citations ?? []).filter((c) => c.source === before.origin!.source);
      if (cites.length) was.cites = cites;
    }
    const because = [...(cite && recordSource(tree, cite.source) ? [cite.source] : []), ...(by === "research" ? recordsCited(tree, before.citations) : [])];
    for (const s of because) if (!was.because.includes(s)) was.because.push(s);
    out.was = was;
  }
  if (by === "research" && imported.length) {
    const kept = citationsWith(next.citations ?? [], cite ? [cite] : [], before.origin?.source);
    if (kept.length) out.citations = kept;
    else delete out.citations;
    delete out.origin;
  } else if (cite && changed.length) out.citations = citationsWith(next.citations ?? [], [cite]);
  if (by === "person" && changed.length) out.origin = { by: "user" };
  return out;
}

/** A person's name (the one they are shown by — person edit --name) and sex changed, by the research or by the person. */
export function changedPerson(tree: Tree, before: Person, next: Person, by: "research" | "person", cite?: Citation): Person {
  const out: Person = { ...next };
  const was = primaryName(before);
  const i = before.names.indexOf(was);
  if (i >= 0 && next.names[i]) out.names = next.names.map((n, j) => (j === i ? changedName(tree, was, n, by, cite) : n));
  if (before.sex !== next.sex) {
    if (ownerOf(before.sexOrigin) === "import")
      out.sexWas = before.sexWas ?? { sex: before.sex, ...(before.sexOrigin?.source ? { source: before.sexOrigin.source } : {}), because: by === "research" && cite && recordSource(tree, cite.source) ? [cite.source] : [], at: now(), by: tree.actor };
    if (by === "person") out.sexOrigin = { by: "user" };
    else delete out.sexOrigin;
  }
  return out;
}

// ── proposals ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** The note on a proposal's claim of the value now (the user's side) and of the value proposed (the research's). */
export const PROPOSAL_NOW = "the value now";
export const PROPOSAL_NEW = "the research: proposed";

const plain = plainName;
const capital = (s: string): string => `${s.charAt(0).toUpperCase()}${s.slice(1)}`;
const whoOf = ownerWords;

interface ProposalInput {
  owner: Person | Family;
  fact: string;
  what: string;
  now: { value: string; text: string; source?: string | undefined };
  proposed: { value: string; text: string };
  as: "user" | "import";
  cite?: Citation | undefined;
  reason?: string | undefined;
  fields: Partial<Pick<Conflict, "edit" | "primary">>;
  proposal: Partial<NonNullable<Conflict["proposal"]>>;
}

/** The proposal opened — or the open one proposing the very same, as it is (never twice). */
function openProposal(tree: Tree, input: ProposalInput): { conflict: Conflict; again: boolean } {
  return tree.withTreeLock(() => {
    const target = input.fields.edit?.event ?? input.proposal.retract?.event;
    const same = tree
      .list<Conflict>("conflict")
      .find(
        (c) =>
          c.state === "open" &&
          !c.retracted &&
          !!c.proposal &&
          c.fact === input.fact &&
          c.subject[0] === input.owner.id &&
          (c.edit?.event ?? c.proposal.retract?.event) === target &&
          !!c.proposal.retract === !!input.proposal.retract &&
          c.claims[1]?.value === input.proposed.value.slice(0, 500) &&
          // …of the value as it is now: one made before the value changed is out of date (never taken), proposed anew
          c.claims[0]?.value === input.now.value.slice(0, 500),
      );
    if (same) return { conflict: same, again: true };
    const cites = input.cite ? [input.cite] : undefined;
    const title = ui(tree.lang, "ui.conflict.title", { who: whoOf(tree, input.owner), what: capital(input.what), ours: input.now.text, theirs: input.proposed.text }).slice(0, 200);
    const conflict = create<Conflict>(
      tree,
      "conflict",
      {
        title,
        fact: input.fact,
        subject: [input.owner.id],
        claims: [
          { ...(input.now.source ? { source: input.now.source } : {}), value: input.now.value.slice(0, 500), note: `${PROPOSAL_NOW}: the ${input.as === "user" ? "user's" : "import's"}`, text: input.now.text.slice(0, 500) },
          { ...(input.cite ? { source: input.cite.source } : {}), value: input.proposed.value.slice(0, 500), note: `${PROPOSAL_NEW} by ${tree.actor}`, text: input.proposed.text.slice(0, 500) },
        ],
        ...input.fields,
        proposal: { kind: input.as, by: tree.actor, at: now(), ...(cites ? { cites } : {}), ...input.proposal },
        state: "open",
        // the reason as the agent gave it, in no language of strom's (an older strom put "why: " before it)
        ...(input.reason?.trim() ? { note: input.reason.trim().slice(0, 480) } : {}),
      },
      (id) => `+${id} proposal (${input.as === "user" ? "the user's value" : "an import's value"}) ${title}`,
      [input.owner.id],
    );
    return { conflict, again: false };
  });
}

/** An agent's change of a fact it may not make, proposed: the value now against the one proposed. */
export function proposeFact(tree: Tree, eventId: string, change: Partial<Record<FactPart, string | undefined>>, as: "user" | "import", opts: { cite?: Citation | undefined; reason?: string | undefined } = {}): { conflict: Conflict; again: boolean } {
  const { owner, event: e } = findEventOwner(tree, eventId);
  const next: Partial<Record<FactPart, string>> = {};
  for (const k of FACT_PARTS) {
    const v = change[k] !== undefined ? change[k]!.trim() : e[k];
    if (v) next[k] = v;
  }
  const lang = tree.lang;
  return openProposal(tree, {
    owner,
    fact: e.kind,
    what: eventName(e.kind, lang, e.label),
    now: { value: factValue(e), text: factWords(lang, e), source: e.origin?.source },
    proposed: { value: factValue(next), text: factWords(lang, next) },
    as,
    cite: opts.cite,
    reason: opts.reason,
    fields: { edit: { event: e.id, ...next, ...(opts.cite ? { cites: [opts.cite] } : {}) } },
    proposal: {},
  });
}

/** An agent's retraction of a fact it may not take back, proposed. */
export function proposeRetract(tree: Tree, eventId: string, as: "user" | "import", reason: string): { conflict: Conflict; again: boolean } {
  const { owner, event: e } = findEventOwner(tree, eventId);
  const lang = tree.lang;
  return openProposal(tree, {
    owner,
    fact: e.kind,
    what: eventName(e.kind, lang, e.label),
    now: { value: factValue(e), text: factWords(lang, e), source: e.origin?.source },
    proposed: { value: `retracted: ${reason}`, text: ui(lang, "ui.proposal.retract", { reason }) },
    as,
    reason,
    fields: {},
    proposal: { retract: { event: e.id, reason } },
  });
}

/** An agent's change of the name a person is shown by (its spelling), proposed. */
export function proposeName(tree: Tree, p: Person, wanted: { given: string; surname: string }, as: "user" | "import", opts: { cite?: Citation | undefined; reason?: string | undefined } = {}): { conflict: Conflict; again: boolean } {
  const name = primaryName(p);
  const index = p.names.indexOf(name);
  const next: Name = { ...name, ...wanted };
  return openProposal(tree, {
    owner: p,
    fact: "NAME",
    what: ui(tree.lang, "ui.conflict.name"),
    now: { value: gedcomName(name), text: plain(name) || "—", source: name.origin?.source },
    proposed: { value: gedcomName(next), text: plain(next) || "—" },
    as,
    cite: opts.cite,
    reason: opts.reason,
    fields: {},
    proposal: { name: { person: p.id, index, given: wanted.given, surname: wanted.surname } },
  });
}

/** An agent's change of a person's sex, proposed. */
export function proposeSex(tree: Tree, p: Person, sex: Sex, as: "user" | "import", opts: { cite?: Citation | undefined; reason?: string | undefined } = {}): { conflict: Conflict; again: boolean } {
  const word = (s: Sex) => sexWords(tree.lang, s);
  return openProposal(tree, {
    owner: p,
    fact: "SEX",
    what: ui(tree.lang, "ui.conflict.sex"),
    now: { value: p.sex, text: word(p.sex), source: p.sexOrigin?.source },
    proposed: { value: sex, text: word(sex) },
    as,
    cite: opts.cite,
    reason: opts.reason,
    fields: {},
    proposal: { sex: { person: p.id, sex } },
  });
}

/** An agent's choice of the name a person is shown by, proposed (index: the name; none: the mark taken off). */
export function proposePrimary(tree: Tree, p: Person, index: number | undefined, as: "user" | "import", reason?: string): { conflict: Conflict; again: boolean } {
  const marked = p.names.find((n) => n.primary);
  const target = index === undefined ? undefined : p.names[index];
  const none = ui(tree.lang, "ui.conflict.primary.none");
  return openProposal(tree, {
    owner: p,
    fact: "NAME",
    what: ui(tree.lang, "ui.conflict.primary"),
    now: { value: marked ? gedcomName(marked) : "", text: marked ? plain(marked) : none },
    proposed: { value: target ? gedcomName(target) : "", text: target ? plain(target) : none },
    as,
    reason,
    fields: { primary: true },
    proposal: { primary: { person: p.id, index: index ?? -1 } },
  });
}

/** Whose value an agent's name primary would change: the name it marks, or the one the person is shown by now. */
export function primaryVerdict(p: Person, index: number | undefined): "user" | "import" | undefined {
  const names = [index === undefined ? undefined : p.names[index], primaryName(p)].filter((n): n is Name => !!n);
  const owners = names.map((n) => ownerOf(n.origin));
  return owners.includes("user") ? "user" : owners.includes("import") ? "import" : undefined;
}

/**
 * What an agent is told of its proposal (English, for the agent): whose value, the conflict, that nothing changed and
 * who decides.
 */
export function proposedLine(what: string, x: Conflict, why: "user" | "record" | "decide", again: boolean): string {
  const whose = why === "user" ? `${what} is the user's value` : `${what} came from an imported family tree (a lead)`;
  const then =
    why === "user"
      ? "the user decides"
      : why === "decide"
        ? "the user decides changes of imported values here (hypotheses.decide person)"
        : "the user decides — or cite the record that says it (--cite S… --locator …) and change it then";
  return `${whose}: proposed (${x.id}${again ? ", proposed already" : ""}), not changed — ${then}`;
}

/**
 * A proposal taken (`strom conflict resolve --take research`): written as the person's own act — the import's value
 * kept to be put back, the value the user's from then on. What was done, in a few words.
 */
export function applyProposal(tree: Tree, x: Conflict, reason: string): string {
  // the value changed since it was proposed (the person's own later value, a record's): never written over by taking
  // it — nothing written; the proposal is closed keeping the value, or the value written by the fact commands (found by
  // the verification of 066 U3: the person's newer date written over, kept nowhere but the history)
  const stale = staleProposal(tree, x);
  if (stale)
    throw new UsageError(`${x.id} is out of date: the value it would change is ${stale.value || "—"} now, not ${x.claims[0]?.value || "—"} as when it was proposed — nothing written`, {
      hint: `close it keeping the value: strom conflict resolve ${x.id} --take user --reasoning "<why>"`,
      code: "conflict.stale",
      params: { id: x.id, now: stale.text, was: stale.was },
    });
  // the proposal decided here is closed by its decision, never settled by its own write (core/proposalsettle.ts)
  return whileDeciding(x.id, () => writeProposal(tree, x, reason));
}

function writeProposal(tree: Tree, x: Conflict, reason: string): string {
  const pr = x.proposal!;
  const why = `the proposal ${x.id}: ${reason}`;
  if (pr.retract) {
    const e = retractEvent(tree, pr.retract.event, `${pr.retract.reason} (${why})`);
    return `${e.id} retracted`;
  }
  if (pr.primary) {
    const p = tree.get<Person>(pr.primary.person);
    if (!p || p.retracted) throw new UsageError(`the person of ${x.id} is no longer in the research`, { hint: `strom conflict show ${x.id}` });
    const target = pr.primary.index >= 0 ? p.names[pr.primary.index] : undefined;
    if (pr.primary.index >= 0 && !target) throw new UsageError(`${p.id} has not that name any more`, { hint: `strom person show ${p.id}` });
    if (target ? !target.primary : p.names.some((n) => n.primary)) markPrimaryName(tree, p.id, target ? gedcomName(target) : undefined, why, (n) => ({ ...n, origin: { by: "user" } }));
    return `${p.id} shown as ${gedcomName(target ?? primaryName(tree.get<Person>(p.id)!))}`;
  }
  if (pr.name || pr.sex) {
    const id = (pr.name ?? pr.sex)!.person;
    const p = tree.get<Person>(id);
    if (!p || p.retracted) throw new UsageError(`the person of ${x.id} is no longer in the research`, { hint: `strom conflict show ${x.id}` });
    if (pr.name && p.names.indexOf(primaryName(p)) !== pr.name.index) throw new UsageError(`${p.id} is shown by another name now`, { hint: `strom person show ${p.id}` });
    const cite = pr.cites?.[0];
    const done = editPerson(
      tree,
      p.id,
      { ...(pr.name ? { name: `${pr.name.given ?? ""} /${pr.name.surname ?? ""}/` } : {}), ...(pr.sex ? { sex: pr.sex.sex } : {}), mark: (b, n) => changedPerson(tree, b, n, "person", cite) },
      why,
    );
    return pr.name ? `${done.id} named ${gedcomName(primaryName(done))}` : `${done.id}: ${done.sex}`;
  }
  if (!x.edit) return "";
  const { event: e } = findEventOwner(tree, x.edit.event);
  if (e.retracted) throw new UsageError(`the fact of ${x.id} (${e.id}) is retracted`, { hint: `strom conflict show ${x.id}` });
  const change: Partial<Record<FactPart, string>> = {};
  for (const k of FACT_PARTS) if ((e[k] ?? "") !== (x.edit[k] ?? "")) change[k] = x.edit[k] ?? "";
  const cites = (pr.cites ?? x.edit.cites ?? []).filter((c) => tree.get(c.source)?.type === "source");
  const done = editEvent(
    tree,
    e.id,
    {
      ...change,
      mark: (b, n) => {
        const out = personChangedFact(tree, b, n, cites);
        // the record the proposal cited replaces the import's citation for the values it changed
        return out.was && cites.some((c) => recordSource(tree, c.source)) && b.origin?.source ? { ...out, citations: out.citations.filter((c) => c.source !== b.origin!.source) } : out;
      },
    },
    why,
  );
  return `${done.id}: ${factValue(done) || "—"}`;
}

// ── putting an import's value back (the person's) ─────────────────────────────────────────────────────────────────

const PART_OF_TAG: Record<string, FactPart | NamePart> = { DATE: "date", PLAC: "place", VAL: "value", GIVN: "given", SURN: "surname" };

/** A part as the CLI or the bridge names it: date, place, value, given, surname — or DATE, PLAC, VAL, GIVN, SURN (SEX: none). */
export function partOf(part: string | undefined): FactPart | NamePart | undefined {
  if (part === undefined || part === "" || part.toUpperCase() === "SEX") return undefined;
  const p = PART_OF_TAG[part.toUpperCase()] ?? (part.toLowerCase() as FactPart | NamePart);
  if (![...FACT_PARTS, ...NAME_PARTS].includes(p)) throw new UsageError(`no part "${part}"`, { hint: "date, place, value (a fact) · given, surname (a name)", code: "revert.part" });
  return p;
}

export interface Reverted {
  /** The record written (a person or a family). */
  owner: string;
  /** The key of what was put back (factRef, nameRef, sexRef). */
  ref: string;
  parts: string[];
}

function revertError(kind: "unknown" | "nothing", text: string, hint?: string): UsageError {
  // the bridge answers revert.unknown with 404, revert.nothing with 409
  return new UsageError(text, { ...(hint ? { hint } : {}), code: `revert.${kind}` });
}

/**
 * Put an import's value back where the research (or the person) changed it — the person's own act: the values of the
 * parts (all changed ones, or the one named), the import's citation again, the value the user's (origin user). The ref:
 * `E0012`, `N:P0004:1`, `SEX:P0004` (person: the person it belongs to, checked when given). Errors: `revert.unknown`
 * (no such value: 404), `revert.nothing` (nothing changed to put back: 409).
 */
export function revertImported(tree: Tree, target: { ref: string; person?: string | undefined; part?: string | undefined; reason?: string | undefined }): Reverted {
  const part = partOf(target.part);
  const ref = target.ref.trim().toUpperCase();
  // the person's own act is its reason: a name put back is no name lost (core/guard.ts)
  target = { ...target, reason: target.reason?.trim() || "put back as the imported family tree gave it" };
  return tree.withTreeLock(() => {
    const sexM = /^SEX:(P\d+)$/u.exec(ref);
    const nameM = /^N:(P\d+):(\d+)$/u.exec(ref);
    if (sexM || nameM) {
      const id = (sexM ?? nameM)![1]!;
      const p = tree.get<Person>(id);
      if (!p || p.type !== "person" || p.retracted || (target.person && target.person.toUpperCase() !== id)) throw revertError("unknown", `no person ${id} with ${ref}`);
      if (sexM) {
        if (part) throw revertError("nothing", `a sex has no part ${part}`);
        if (!p.sexWas) throw revertError("nothing", `nothing to put back: the sex of ${id} is as the import gave it`);
        const was = p.sexWas;
        update<Person>(tree, id, "person", (q) => {
          const { sexWas: _w, ...rest } = q;
          return { ...rest, sex: was.sex, sexOrigin: { by: "user" } } as Person;
        }, { op: "person.revert", summary: `${id} sex ${was.sex} again, as the import gave it`, ...(target.reason ? { reason: target.reason } : {}) });
        return { owner: id, ref, parts: ["sex"] };
      }
      const i = Number(nameM![2]) - 1;
      const n = p.names[i];
      if (!n) throw revertError("unknown", `${id} has no name ${i + 1}`, `strom person show ${id}`);
      if (part && !(NAME_PARTS as readonly string[]).includes(part)) throw revertError("nothing", `a name has no part ${part}`, "given, surname");
      const parts = (n.was?.parts ?? []).filter((p) => !part || p === part);
      if (!n.was || !parts.length) throw revertError("nothing", `nothing to put back: ${gedcomName(n)} of ${id} is as the import gave it${part ? ` (${part})` : ""}`);
      const was = n.was;
      const back: Name = { ...n };
      for (const k of parts) back[k] = was[k] ?? "";
      const left = was.parts.filter((k) => !parts.includes(k));
      if (left.length) back.was = { ...was, parts: left };
      else delete back.was;
      const cites = (was.cites ?? (was.source ? [{ source: was.source }] : [])).filter((c) => tree.get(c.source)?.type === "source");
      if (cites.length) back.citations = citationsWith(n.citations ?? [], cites);
      back.origin = { by: "user" };
      update<Person>(tree, id, "person", (q) => ({ ...q, names: q.names.map((m, j) => (j === i ? back : m)) }), {
        op: "person.revert",
        summary: `${id} name ${gedcomName(back)} again, as the import gave it (${parts.join(", ")})`,
        ...(target.reason ? { reason: target.reason } : {}),
      });
      return { owner: id, ref, parts };
    }
    if (!/^E\d+$/u.test(ref)) throw revertError("unknown", `no value ${target.ref}`, "a fact (E0012), a name (N:P0004:1), a sex (SEX:P0004)");
    let found: { owner: Person | Family; event: Event };
    try {
      found = findEventOwner(tree, ref);
    } catch {
      throw revertError("unknown", `no fact ${ref}`);
    }
    const { owner, event: e } = found;
    if (target.person && target.person.toUpperCase() !== owner.id && !(owner.type === "family" && owner.partners.includes(target.person.toUpperCase()))) throw revertError("unknown", `${ref} is no fact of ${target.person}`);
    if (part && !(FACT_PARTS as readonly string[]).includes(part)) throw revertError("nothing", `a fact has no part ${part}`, "date, place, value");
    const parts = (e.was?.parts ?? []).filter((p) => !part || p === part);
    if (!e.was || !parts.length) throw revertError("nothing", `nothing to put back: ${ref} is as the import gave it${part ? ` (${part})` : ""}`);
    const was = e.was;
    const back: Event = { ...e };
    for (const k of parts) {
      if (was[k] !== undefined) back[k] = was[k];
      else delete back[k];
    }
    const left = was.parts.filter((k) => !parts.includes(k));
    if (left.length) back.was = { ...was, parts: left };
    else delete back.was;
    // the import's citation again
    const cites = was.cites ?? (was.source ? [{ source: was.source }] : []);
    back.citations = citationsWith(e.citations, cites.filter((c) => tree.get(c.source)?.type === "source"));
    back.origin = { by: "user" };
    update<Person | Family>(tree, owner.id, owner.type, (o) => ({ ...o, events: o.events.map((x) => (x.id === e.id ? back : x)) }), {
      op: "event.revert",
      summary: `${e.id} ${e.kind} ${parts.join(", ")} again as the import gave it: ${factValue(back) || "—"}`,
      targets: [e.id],
      ...(target.reason ? { reason: target.reason } : {}),
    });
    return { owner: owner.id, ref, parts };
  });
}

/** The next key of an import of this research: R1, R2, … (one per file imported). */
export function nextImportKey(tree: Tree): string {
  let n = 0;
  for (const s of tree.list<Source>("source")) {
    const m = /^R(\d+)$/u.exec(s.imported?.key ?? "");
    if (m) n = Math.max(n, Number(m[1]));
  }
  return `R${n + 1}`;
}

// ── the Strom app's imports (spec 066 U3) ─────────────────────────────────────────────────────────────────────────

/** An import a family tree came in by: its key (the app's I1…, the research's R1…) and what was kept of its file. */
export type ImportOf = NonNullable<Source["imported"]>;

/** A key of an import as a file carries it (`I1`, `R2`): letters and digits, nothing else. */
export const importKeyOk = (key: string): boolean => /^[\p{L}\p{N}]{1,40}$/u.test(key);

/** The title of an import's source in the research language: "Family tree MyHeritage 12 MAR 2024, rodokmen.ged". */
export function importTitle(lang: string, imp: ImportOf): string {
  const what = [[imp.program, imp.date].filter(Boolean).join(" "), imp.file].filter(Boolean).join(", ") || imp.key;
  return phrase(lang, "import.source", { what });
}

/** The same import: the key and the file's hash; without a hash the program, the file's date and its name. */
function sameImport(a: ImportOf, b: ImportOf): boolean {
  if (a.key !== b.key) return false;
  if (a.sha || b.sha) return (a.sha ?? "") === (b.sha ?? "");
  return (a.program ?? "") === (b.program ?? "") && (a.date ?? "") === (b.date ?? "") && (a.file ?? "") === (b.file ?? "");
}

/** The source the research has of an import the Strom app names (none withdrawn), without making one. */
export function knownImportSource(tree: Tree, imp: ImportOf): Source | undefined {
  return tree.list<Source>("source").find((s) => !!s.imported && !s.retracted && sameImport(s.imported, imp));
}

/**
 * The source of an import the Strom app names (HEAD `1 _STROM_IMPORT Ix`): the one made of it before, reused on every
 * later sync — or a new one (a family tree: authored, secondary), of the material it came in (`input`).
 */
export function importSourceFor(tree: Tree, imp: ImportOf, input: string | undefined): { source: Source; created: boolean } {
  return tree.withTreeLock(() => {
    const same = tree.list<Source>("source").filter((s) => s.imported && sameImport(s.imported, imp));
    const found = same.find((s) => !s.retracted);
    if (found) return { source: found, created: false };
    // the one a sync's undo withdrew (nothing cited it any more): the same again, never one more
    const back = same.find((s) => /^sync I\d+ undone$/u.test(s.retracted?.reason ?? ""));
    if (back) {
      const source = update<Source>(tree, back.id, "source", ({ retracted: _r, ...s }) => s as Source, { op: "source.edit", summary: `${back.id} back: import ${imp.key} again` });
      return { source, created: false };
    }
    const title = importTitle(tree.config.lang, imp);
    const source = create<Source>(
      tree,
      "source",
      { kind: "family-tree", title, ...(input ? { input } : {}), information: "secondary", form: "authored", imported: { ...imp } } as never,
      (id) => `+${id} source "${title}" (import ${imp.key})`,
      input ? [input] : [],
    );
    return { source, created: true };
  });
}

/** A mark `_STROM_IMPORT Ix [DATE PLAC …]` of the Strom app read: the key and the GEDCOM's parts it names (none: all). */
export interface ImportMark {
  key: string;
  parts?: string[];
}

/** A value's origin of an app's mark: the import's source and the parts it names (DATE→date, PLAC→place, else value; GIVN, SURN of a name). */
export function originOfMark<P extends string>(mark: ImportMark, source: string, of: "fact" | "name" | "sex"): ValueOrigin<P> {
  const parts = new Set<string>();
  for (const t of mark.parts ?? []) {
    const up = t.toUpperCase();
    if (of === "fact") parts.add(up === "DATE" ? "date" : up === "PLAC" ? "place" : "value");
    else if (of === "name") {
      if (up === "GIVN") parts.add("given");
      else if (up === "SURN") parts.add("surname");
    }
  }
  return { by: "import", source, ...(parts.size ? { parts: [...parts] as P[] } : {}) };
}

/** The mark's value read: `I1`, `I1 DATE PLAC` — a key that is none: no mark. */
export function readImportMark(value: string): ImportMark | undefined {
  const [key, ...parts] = value.trim().split(/\s+/u);
  if (!key || !importKeyOk(key)) return undefined;
  const named = parts.filter((p) => /^[\p{L}_]{1,10}$/u.test(p)).map((p) => p.toUpperCase());
  return { key, ...(named.length ? { parts: named } : {}) };
}

/**
 * The imports a Strom app's file names in its HEAD (`1 _STROM_IMPORT Ix` with `2 SOUR`, `VERS`, `DATE`, `_AT`, `FILE`,
 * `_SHA`), by key — read of the app's file alone (never another program's: its marks are no word of the user's).
 * `2 _XREF`, `2 _UID` (U8) are passed.
 */
export function importsOfHead(head: GedNode | undefined): Map<string, ImportOf> {
  const out = new Map<string, ImportOf>();
  for (const n of head ? children(head, "_STROM_IMPORT") : []) {
    const key = n.value.trim();
    if (!importKeyOk(key) || out.has(key)) continue;
    const said = (tag: string, max: number) => val(n, tag)?.replace(/\s+/gu, " ").trim().slice(0, max) || undefined;
    const [program, version, date, at, file, sha] = [said("SOUR", 200), said("VERS", 100), said("DATE", 100), said("_AT", 40), said("FILE", 300), said("_SHA", 128)];
    out.set(key, { key, ...(program ? { program } : {}), ...(version ? { version } : {}), ...(date ? { date } : {}), ...(at ? { at } : {}), ...(file ? { file } : {}), ...(sha ? { sha } : {}) });
  }
  return out;
}

/** The mark of an import under a node of the app's file (`_STROM_IMPORT Ix [parts]`), of an import its HEAD names. */
export function markUnder(node: GedNode | undefined, imports: ReadonlyMap<string, ImportOf> | undefined): ImportMark | undefined {
  if (!node || !imports?.size) return undefined;
  for (const n of children(node, "_STROM_IMPORT")) {
    const m = readImportMark(n.value);
    if (m && imports.has(m.key)) return m;
  }
  return undefined;
}
