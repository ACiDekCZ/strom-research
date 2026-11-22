// A census household (spec 106 K3): one sheet of a census read, written as one event the Strom app shares among the
// people of the tree it names (spec 085) — a CENS fact for each member in the tree, all of one share id (opaque,
// strom's own), each with the member's relation to the head (`share.role`) and age; the common fields (date, place,
// house, note, the citation of the sheet) the same on every copy, so the app never finds the copies differ. The people
// of the sheet who are not in the tree are only said in the note (K3.2): no person is made of them. What the sheet
// says of a birth is a clue, never a birth (K3.3): nothing but the CENS is written.
//
// The copies stay one event: a common field changed on one copy (its note, house, citation) goes to every copy
// (`alignCopies`); what is a copy's own — the age, the role, the status, the user's confirmation, an agent's
// verification — never does.

import { randomBytes } from "node:crypto";
import { censusDay } from "./census.ts";
import { makeEvent, parseAge, parseDate, parseStatus } from "./actions.ts";
import { checkStatus, citableSource, defaultStatus } from "./evidence.ts";
import { AmbiguousError, UsageError } from "./errors.ts";
import { dateYears, normalizeDate } from "./gdate.ts";
import { HOUSEHOLD_OF_HEAD, HOUSEHOLD_ROLES, HOUSEHOLD_ROLES_ALSO, householdOthers, householdRole } from "./phrases.ts";
import { resolvePerson } from "./people.ts";
import { livingBorn } from "./review.ts";
import { foldText } from "./text.ts";
import { now, type Tree } from "./tree.ts";
import type { Citation, Event, Person, Place, RecordSet, Repository, Source } from "./model.ts";
import { placeIdOf } from "./placeid.ts";
import { SHARE_ID } from "./model.ts";

/** The length of a household's share id: opaque letters and digits, never text of a person. */
export const HOUSEHOLD_ID_LENGTH = 12;

const ID_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

/** A new share id no fact of the tree has: 12 letters and digits at random. */
export function newHouseholdId(tree: Tree): string {
  const taken = new Set(tree.list<Person>("person").flatMap((p) => p.events.flatMap((e) => (e.share ? [e.share.id] : []))));
  for (;;) {
    // 62 letters: the bytes ≥ 248 dropped so that each letter is as likely as the others
    const id = [...randomBytes(32)]
      .filter((b) => b < 248)
      .slice(0, HOUSEHOLD_ID_LENGTH)
      .map((b) => ID_LETTERS[b % 62])
      .join("");
    if (id.length === HOUSEHOLD_ID_LENGTH && SHARE_ID.test(id) && !taken.has(id)) return id;
  }
}

/** A member as the agent gives it: who (an ID or a name), the relation to the head, the age the sheet gives. */
export interface MemberSpec {
  ref: string;
  role: string;
  age?: string;
}

/**
 * `P0003:head:41`, `P0008:"manželka":36y`, `P0012:služka` → who, relation, age. The last part is the age when it reads as
 * one; the relation may hold a colon of its own. Quotes around a part (as a shell may leave them) are taken off.
 */
export function parseMember(spec: string): MemberSpec {
  const unquote = (s: string) => s.trim().replace(/^["'„“”‚‘’](.*)["'“”‘’]$/su, "$1").trim();
  const parts = spec.normalize("NFC").split(":");
  const ref = unquote(parts[0] ?? "");
  if (!ref || parts.length < 2)
    throw new UsageError(`--member "${spec}": who and the relation to the head`, {
      code: "census.member.form",
      hint: '--member P0003:head:41 (the person\'s ID, the relation, the age the sheet gives) — e.g. --member "P0008:wife:36"',
    });
  let rest = parts.slice(1);
  let age: string | undefined;
  if (rest.length >= 2) {
    const last = unquote(rest.at(-1)!);
    if (!last || readsAsAge(last)) {
      age = last || undefined;
      rest = rest.slice(0, -1);
    }
  }
  return { ref, role: unquote(rest.join(":")), ...(age ? { age } : {}) };
}

function readsAsAge(s: string): boolean {
  try {
    parseAge(s);
    return true;
  } catch {
    return false;
  }
}

/** The keys of the fixed relations whose word, in any language, or whose key is this one (compared without accents). */
function roleKeysOf(word: string): string[] {
  const f = foldText(word);
  const stem = (k: string) => k.replace(/-[mf]$/u, "");
  return Object.entries(HOUSEHOLD_ROLES)
    .filter(([key, words]) => foldText(key) === f || foldText(stem(key)) === f || Object.values(words).some((w) => foldText(w) === f) || (HOUSEHOLD_ROLES_ALSO[key] ?? []).some((w) => foldText(w) === f))
    .map(([key]) => key);
}

/** The keys of a relation, also with words after it that say only whom it is to ("manželka přednosty", "son of the head"). */
function roleKeysOfPart(part: string): string[] {
  const keys = roleKeysOf(part);
  if (keys.length) return keys;
  const f = foldText(part).replace(/\s+/gu, " ").trim();
  for (const q of HOUSEHOLD_OF_HEAD) {
    const tail = ` ${foldText(q)}`;
    if (f.length > tail.length && f.endsWith(tail)) {
      const before = roleKeysOf(f.slice(0, -tail.length).trim());
      if (before.length) return before;
    }
  }
  return [];
}

/** One relation of the keys: the only one, or a pair of a man and a woman told by the member's sex (servant: sluha / služka). */
function oneKey(keys: string[], sex: Person["sex"]): string | undefined {
  if (keys.length === 1) return keys[0];
  if (keys.length !== 2) return undefined;
  const [a, b] = keys.map((k) => k.replace(/-[mf]$/u, ""));
  return a === b && (sex === "M" || sex === "F") ? keys.find((k) => k.endsWith(sex === "M" ? "-m" : "-f")) : undefined;
}

/**
 * The relation as the research writes it: a fixed one in the research's language (given by its key — "head",
 * "servant-f" — or by its word in any language strom knows: "Sohn", "služka", the forms' "přednosta"; with words after
 * it that say only whom it is to: "manželka přednosty"), a pair of a man and a woman told by the member's sex; of
 * several relations given with commas, the head where one of them is the head (the head's relation to the head:
 * "přednosta domácnosti, otec"), else the one relation all of them are; any other word as written (NFC, one line) —
 * nothing of it lost. Empty: none.
 */
export function householdRoleOf(lang: string, given: string, sex: Person["sex"]): { role: string; key?: string } {
  const text = given.normalize("NFC").replace(/\s+/gu, " ").trim();
  if (!text) return { role: "" };
  let key = oneKey(roleKeysOfPart(text), sex);
  if (!key && text.includes(",")) {
    const each = text
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean)
      .map((x) => oneKey(roleKeysOfPart(x), sex));
    if (each.includes("head")) key = "head";
    else if (each.length > 1 && each.every((k) => k && k === each[0])) key = each[0];
  }
  if (!key) return { role: text };
  return { role: householdRole(lang, key) ?? text, key };
}

/** The keys a relation of the research's language is one of (the head among them). */
export function householdRoleKey(lang: string, role: string | undefined): string | undefined {
  if (!role) return undefined;
  const f = foldText(role);
  return Object.keys(HOUSEHOLD_ROLES).find((k) => foldText(householdRole(lang, k) ?? "") === f);
}

// ── the census day of a country and year: data (assets/archives.json), never words of the method ──

/** The census day of a country (ISO code) and a year as an ISO day, or none known (src/core/census.ts censusDay: the data). */
export type CensusDayOf = (country: string, year: number) => string | undefined;

/** A day as the data give it ("1890-12-31") in GEDCOM form, only a whole day of that year. */
function wholeDay(v: unknown, year: number): string | undefined {
  if (typeof v !== "string") return undefined;
  const d = normalizeDate(v.trim());
  return d && /^\d{1,2} [A-Z]{3} \d{3,4}$/u.test(d) && dateYears(d)[0] === year ? d : undefined;
}

/** The country of a source's archive (its repository, or its record set's), as the research has it. */
function countryOfSource(tree: Tree, s: Source): string | undefined {
  const repo = s.repository ?? (s.recordset ? tree.get<RecordSet>(s.recordset)?.repository : undefined);
  const c = repo ? tree.get<Repository>(repo)?.country?.trim() : undefined;
  return c && /^[A-Za-z]{2,3}$/u.test(c) ? c.toUpperCase() : undefined;
}

/**
 * The date of a household: a day given wins; a year alone is the census day of the country and year when the data know
 * it, else the year (`2 DATE 1890`). Anything else (ABT 1890) as given.
 */
export function householdDate(given: string, country: string | undefined, dayOf: CensusDayOf = censusDay): { date: string; day?: "given" | "census" } {
  const d = parseDate(given)!;
  if (/^\d{1,2} [A-Z]{3} \d{3,4}$/u.test(d)) return { date: d, day: "given" };
  if (/^\d{3,4}$/u.test(d)) {
    const day = country?.trim() ? wholeDay(dayOf(country, Number(d)), Number(d)) : undefined;
    if (day) return { date: day, day: "census" };
  }
  return { date: d };
}

/** A place given as a record (L…): the form the tree's facts write it in most, else its name. Text: as given. */
function placeText(tree: Tree, given: string | undefined): string | undefined {
  const t = given?.normalize("NFC").trim();
  if (!t) return undefined;
  const id = placeIdOf(t);
  if (!id) return t;
  const p = tree.get<Place>(id);
  if (!p || p.retracted) throw new UsageError(`no place ${t}`, { code: "record.none", params: { kind: "place", id: t }, hint: "strom place list — or the place by its name: --place \"<municipality>\"" });
  const names = new Set(p.names.map((n) => foldText(n.name)));
  const count = new Map<string, number>();
  for (const person of tree.list<Person>("person"))
    for (const e of person.events) if (e.place && names.has(foldText(e.place.split(",")[0]!.trim()))) count.set(e.place, (count.get(e.place) ?? 0) + 1);
  const most = [...count].sort((a, b) => b[1] - a[1])[0]?.[0];
  return most ?? p.names[0]?.name ?? t;
}

// ── a household written ──

export interface HouseholdInput {
  source: string;
  locator?: string | undefined;
  quote?: string | undefined;
  information?: Citation["information"] | undefined;
  date: string;
  country?: string | undefined;
  place?: string | undefined;
  house?: string | undefined;
  members: MemberSpec[];
  /** The people of the sheet not in the tree, as the research's words say them ("farmhand, 19; retired farmer, 72"). */
  others?: string | undefined;
  note?: string | undefined;
  status?: string | undefined;
  /** The census days to read (a test's); default the shipped ones (censusDay). */
  dayOf?: CensusDayOf;
}

export interface HouseholdCopy {
  person: string;
  event: string;
  role: string;
  age?: string;
}

export interface Household {
  /** The share id; none for a household of one member of the tree (a plain CENS). */
  id?: string;
  date: string;
  day?: "given" | "census";
  place?: string;
  house?: string;
  copies: HouseholdCopy[];
  /** Households of the same year at the same house the tree has of other people: said, never joined. */
  sameHouse: string[];
  /** Censuses of the same year the members have elsewhere: said. */
  elsewhere: string[];
}

const live = (e: Event) => !e.retracted && e.status !== "disproven";
const sameText = (a: string | undefined, b: string | undefined) => foldText((a ?? "").trim()) === foldText((b ?? "").trim());
const samePlace = (a: string | undefined, b: string | undefined) => !a || !b || sameText(a.split(",")[0], b.split(",")[0]);

/**
 * One household of a census sheet written: a CENS of each member (a share id from two members on), validated whole
 * before anything is written. Refused: a member not in the tree, living, given twice, without a relation; two heads; a
 * member already in a census of that year at that house.
 */
export function addHousehold(tree: Tree, input: HouseholdInput): Household {
  if (!input.members.length)
    throw new UsageError("which people of the tree are in the household?", { code: "census.member.none", hint: '--member P0003:head:41 --member P0008:wife:36 (the others of the sheet: --others "…")' });
  const source = citableSource(tree, input.source);
  const lang = tree.lang;
  return tree.withTreeLock(() => {
    const seen = new Set<string>();
    const members = input.members.map((m) => {
      let p: Person;
      try {
        p = resolvePerson(tree, m.ref);
      } catch (err) {
        if (err instanceof AmbiguousError) throw err;
        throw new UsageError(`${m.ref} is not a person of the tree`, {
          code: "census.member.unknown",
          params: { ref: m.ref },
          hint: 'a member is a person of the tree (strom person list); the others of the sheet only in --others "…" — no person is made of them',
        });
      }
      if (p.retracted)
        throw new UsageError(`${p.id} is not a person of the tree any more (${p.mergedInto ? `merged into ${p.mergedInto}` : "retracted"})`, {
          code: "census.member.unknown",
          params: { ref: p.id },
          hint: p.mergedInto ? `--member ${p.mergedInto}:…` : 'the others of the sheet only in --others "…"',
        });
      if (seen.has(p.id)) throw new UsageError(`${p.id} is given twice`, { code: "census.member.twice", params: { person: p.id }, hint: "one --member for each person of the household" });
      seen.add(p.id);
      if (livingBorn(tree, p) !== undefined)
        throw new UsageError(`${p.id} is most likely living: the family's to tell, not a census to record`, { code: "census.living", params: { person: p.id }, hint: "leave the living out of --member (at most in --others, without a name)" });
      const r = householdRoleOf(lang, m.role, p.sex);
      if (!r.role)
        throw new UsageError(`${p.id}: the relation to the head is missing`, {
          code: "census.role",
          params: { person: p.id },
          hint: `--member ${p.id}:<relation>:<age> — head, wife, husband, son, daughter, servant, farmhand, maid, lodger, inmate, retired, … (the word in any language; the head always said)`,
        });
      return { person: p, role: r.role, key: r.key, ...(m.age ? { age: parseAge(m.age, p.id) } : {}) };
    });
    const heads = members.filter((m) => m.key === "head" || householdRoleKey(lang, m.role) === "head");
    if (heads.length > 1)
      throw new UsageError(`one head of the household, not ${heads.length}: ${heads.map((h) => h.person.id).join(", ")}`, { code: "census.head.twice", hint: "the others by their relation to the head (wife, son, father, …)" });
    const country = input.country?.trim() || countryOfSource(tree, source);
    const when = householdDate(input.date, country, input.dayOf);
    const year = dateYears(when.date)[0];
    const place = placeText(tree, input.place);
    const house = input.house?.normalize("NFC").trim() || undefined;
    // the same household again: a member in a census of that year at that house (or at none, either of them)
    const ofYear = (e: Event) => e.kind === "CENS" && live(e) && year !== undefined && !!e.date && dateYears(e.date)[0] === year;
    const again: string[] = [];
    const elsewhere: string[] = [];
    for (const m of members)
      for (const e of m.person.events.filter(ofYear)) (samePlace(e.place, place) && sameText(e.house, house) ? again : elsewhere).push(`${e.id} (${m.person.id})`);
    if (again.length)
      throw new UsageError(`the household is recorded already: ${again.join(", ")} — the census of ${year}${house ? `, house ${house}` : ""}`, {
        code: "census.duplicate",
        params: { facts: again.join(", ") },
        hint: `strom show ${again[0]!.split(" ")[0]} — one household is written once; a common field corrected there goes to every member (strom event edit / strom cite)`,
      });
    const sameHouse = new Set<string>();
    if (house)
      for (const p of tree.list<Person>("person"))
        if (!seen.has(p.id) && !p.retracted) for (const e of p.events.filter(ofYear)) if (samePlace(e.place, place) && sameText(e.house, house)) sameHouse.add(e.share?.id ?? e.id);
    const notes = [input.note?.trim(), input.others?.trim() ? householdOthers(lang, input.others.normalize("NFC").replace(/\s+/gu, " ").trim()) : undefined].filter((x): x is string => !!x);
    const citation: Citation = {
      source: source.id,
      ...(input.locator?.trim() ? { locator: input.locator.trim() } : {}),
      ...(input.quote?.trim() ? { quote: input.quote.trim() } : {}),
      ...(input.information ? { information: input.information } : {}),
    };
    const id = members.length >= 2 ? newHouseholdId(tree) : undefined;
    const origin = tree.personWrites ? { origin: { by: "user" as const } } : {};
    // every fact made before any is written: one refused, none written
    const made = members.map((m) => ({
      m,
      event: makeEvent(tree, {
        kind: "CENS",
        date: when.date,
        place,
        house,
        age: m.age,
        citations: [citation],
        status: input.status,
        note: notes.length ? notes.join("\n") : undefined,
        ...origin,
        ...(id ? { share: { id, role: m.role } } : {}),
      }),
    }));
    for (const { m, event } of made) {
      // a household of one member of the tree: its relation said in no mark (the app shares nothing), only in the note
      if (!id) event.note = [event.note, m.key === "head" ? undefined : m.role].filter(Boolean).join("\n") || undefined;
      if (!event.note) delete event.note;
      const owner = tree.get<Person>(m.person.id)!;
      tree.put(
        { ...owner, events: [...owner.events, event], updated: now() },
        { op: "event.add", targets: [owner.id, event.id], summary: `+${event.id} ${event.kind} ${owner.id}${event.date ? ` ${event.date}` : ""} [${event.status}]${id ? ` household ${id}: ${m.role}` : ""}` },
      );
    }
    return {
      ...(id ? { id } : {}),
      date: when.date,
      ...(when.day ? { day: when.day } : {}),
      ...(place ? { place } : {}),
      ...(house ? { house } : {}),
      copies: made.map(({ m, event }) => ({ person: m.person.id, event: event.id, role: m.role, ...(event.age ? { age: event.age } : {}) })),
      sameHouse: [...sameHouse],
      elsewhere,
    };
  });
}

// ── the copies kept one event ──

/** The other copies of a shared event in the tree (the same share id; persons and facts not taken back). */
export function copiesOf(tree: Tree, eventId: string): { owner: Person; event: Event }[] {
  const id = eventId.toUpperCase();
  let share: string | undefined;
  for (const p of tree.list<Person>("person")) {
    const e = p.events.find((x) => x.id === id);
    if (e) {
      share = e.share?.id;
      break;
    }
  }
  if (!share) return [];
  return tree
    .list<Person>("person")
    .filter((p) => !p.retracted)
    .flatMap((p) => p.events.filter((e) => e.id !== id && !e.retracted && e.share?.id === share).map((event) => ({ owner: p, event })));
}

/** What every copy of a shared event has alike (the Strom app's common fields): never the age, role, status or marks of one. */
const COMMON = ["date", "place", "house", "cause", "value", "label", "note"] as const;

const sameCitations = (a: Citation[], b: Citation[]) => JSON.stringify(a) === JSON.stringify(b);

/**
 * After a change of one copy of a shared event: every other copy given its common fields — date, place, house, note,
 * the citations (with the main one) and the citations the user removed — so the copies never differ. A copy's own (its
 * age, role, status, the user's confirmation, an agent's verification) stays. A citation new to a copy raises a lead of
 * it as a citation does (a record: probable). A status given with the change (`status`: strom cite --status, strom
 * event edit --status) goes to every copy too — the same record says it of all — but never over the status the user
 * confirmed against the scan, unless the user gives it. One operation for each copy changed; the IDs of those changed.
 */
export function alignCopies(tree: Tree, eventId: string, opts: { reason?: string | undefined; status?: string | undefined } = {}): string[] {
  const reason = opts.reason;
  return tree.withTreeLock(() => {
    const id = eventId.toUpperCase();
    const from = tree.list<Person>("person").flatMap((p) => p.events.filter((e) => e.id === id))[0];
    if (!from?.share || from.retracted) return [];
    const status = opts.status === undefined ? undefined : parseStatus(opts.status, from.status);
    const changed: string[] = [];
    for (const { owner: was, event } of copiesOf(tree, id)) {
      const owner = tree.get<Person>(was.id) ?? was;
      const next: Event = { ...structuredClone(event) };
      const parts: string[] = [];
      for (const k of COMMON) {
        if ((event[k] ?? "") === (from[k] ?? "")) continue;
        parts.push(k);
        if (from[k] !== undefined) next[k] = from[k];
        else delete next[k];
      }
      if (!sameCitations(event.citations, from.citations)) {
        parts.push("citations");
        next.citations = structuredClone(from.citations);
        if (next.status === "lead" && !(next.confirmed && !tree.personWrites) && from.citations.length > event.citations.length) next.status = defaultStatus(tree, next.citations);
      }
      if (status && status !== next.status && !(event.confirmed && !tree.personWrites)) next.status = status;
      if (next.status !== event.status) {
        checkStatus(tree, next.status, next.citations);
        parts.push("status");
      }
      if (JSON.stringify(event.uncited ?? []) !== JSON.stringify(from.uncited ?? [])) {
        parts.push("uncited");
        if (from.uncited?.length) next.uncited = structuredClone(from.uncited);
        else delete next.uncited;
      }
      if (from.origin && JSON.stringify(event.origin) !== JSON.stringify(from.origin) && parts.some((p) => p === "date" || p === "place" || p === "value")) next.origin = structuredClone(from.origin);
      if (!parts.length) continue;
      tree.put(
        { ...owner, events: owner.events.map((e) => (e.id === event.id ? next : e)), updated: now() },
        { op: "event.edit", targets: [owner.id, event.id], summary: `${event.id} ${event.kind} household ${from.share.id}: ${parts.join(", ")} as ${from.id}`, ...(reason?.trim() ? { reason: reason.trim() } : {}) },
      );
      changed.push(event.id);
    }
    return changed;
  });
}
