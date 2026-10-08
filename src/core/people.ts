// Person helpers: names, life spans, relatives, and resolving a reference
// ("P0039", "Antonín Víšek", "visek antonin") to exactly one person.

import { AmbiguousError, UsageError } from "./errors.ts";
import { dateYears, yearLabel } from "./gdate.ts";
import type { ChildLink, ChildRelation, Conflict, Event, Family, Name, Person } from "./model.ts";
import { foldText, tokens } from "./text.ts";
import type { Tree } from "./tree.ts";
import { UI, ui, type UIKey } from "../cli/ui.ts";

/**
 * Parse "Jan /Novák/", "Jan Novák" (last word = surname) or "/Novák/". The
 * surname is the last pair of slashes, opened at the start or after a space:
 * "N/A /Chrpa/" is "?" Chrpa. A slash inside a word does not open it —
 * "/⟨K/Č⟩emenská/" keeps its inner slash for the caller to refuse (actions)
 * or replace (import). What stands for no name (N/A, N.N.) stays for the
 * caller: an action refuses it (notAName), a file read makes it "?" (noName).
 */
export function parseName(input: string): Name {
  const s = input.trim().replace(/\s+/g, " ");
  const close = s.lastIndexOf("/");
  let open = -1;
  for (let i = close - 1; i >= 0; i--) if (s[i] === "/" && (i === 0 || s[i - 1] === " ")) { open = i; break; }
  if (open < 0 && close > 0) open = s.indexOf("/");
  if (open >= 0 && open < close) {
    const given = [s.slice(0, open), s.slice(close + 1)].map((x) => x.trim()).filter(Boolean).join(" ");
    return { given, surname: s.slice(open + 1, close).trim() };
  }
  const parts = s.split(" ");
  if (parts.length === 1) return { given: s, surname: "" };
  return { given: parts.slice(0, -1).join(" "), surname: parts[parts.length - 1]! };
}

/**
 * What a record or another program writes where it has no name (folded): the person's name is "?". The Strom app
 * reads the same list (the tester's T08); words that describe the person (stillborn, son) are DESCRIPTIONS below.
 */
export const NO_NAME = [
  "n a", "nn", "n n", "nomen nescio", "unknown", "unnamed", "no name", "noname",
  "neznamy", "neznama", "nezname", "nezjisteno", "bez jmena", "bezejmenny", "bezejmenna",
  "unbekannt", "namenlos", "ohne namen", "nieznany", "nieznana", "nieznane", "bez imienia",
  "inconnu", "inconnue", "sans nom",
];
const NO_NAME_SET = new Set(NO_NAME);

/** Whether a given name only says there is none ("N/A", "N.N.", "?", "—"); an empty one is no name either way. */
export function noName(given: string): boolean {
  const g = given.trim();
  if (!g) return false;
  const words = foldText(g).replace(/[^\p{L}\p{M}\p{N}]+/gu, " ").trim();
  return !words || NO_NAME_SET.has(words);
}

/**
 * The Strom app's way of writing a person of no name and no surname: "? /Unknown/" (2 GIVN ?, no SURN) — no surname,
 * not the surname Unknown. Only a file of the Strom app says so (its HEAD: 1 SOUR STROM; T08b); a surname Unknown the
 * user typed there comes with its SURN.
 */
export function appNoSurname(given: string, surname: string, surn: string | undefined): boolean {
  return noName(given) && surname === "Unknown" && !surn?.trim();
}

/**
 * The surname of a NAME line without slashes that has a GIVN and no SURN ("Petr Novotný" + GIVN Petr; N11): the rest
 * of the line after the given name — after its first word where the line does not start with the GIVN ('' when
 * nothing is left). The Strom app reads it so (its 3.10.0-beta.7). The given name's words compared through foldText
 * (any accent, NFD), its commas read as spaces; the surname comes back in NFC, stray slashes left out.
 */
export function surnameAfterGiven(line: string, givn: string): string {
  const words = (s: string) => s.normalize("NFC").split(/\s+/u).filter(Boolean);
  const [said, given] = [words(line.replace(/,/g, " ")), words(givn.replace(/,/g, " "))];
  const starts = given.length > 0 && given.length <= said.length && given.every((w, i) => foldText(w) === foldText(said[i]!));
  return (starts ? said.slice(given.length) : words(line).slice(1)).join(" ").replace(/\//g, "").trim();
}

/** Words that describe a person instead of naming them (folded): stillborn, unbaptised, N.N. */
const DESCRIPTIONS = new Set([
  "nn", "n n", "nomen nescio", "unnamed", "unknown", "stillborn", "still born", "infant", "child", "son", "daughter",
  "mrtve narozeny", "mrtve narozena", "mrtve narozene", "mrtvy narozen", "mrtva narozena", "mrtvorozeny", "mrtvorozena", "mrtvorozene",
  "nepokrteny", "nepokrtena", "nepokrtene", "nekrtenec", "bez jmena", "neznamy", "neznama", "dite", "syn", "dcera",
  "totgeboren", "totgeborenes kind", "ungetauft", "namenlos", "kind", "sohn", "tochter",
  "martwo urodzony", "martwo urodzona", "martwo urodzone", "nieochrzczony", "nieochrzczona", "dziecko",
  "sans nom", "mort ne", "mort nee", "inconnu", "inconnue", "enfant", "proles", "infans", "filius", "filia",
]);

/**
 * Why a given name is not a name, or undefined: a description in brackets or
 * a word like "stillborn" is what the record says ABOUT the person — it goes
 * to a fact or a note, the name stays empty ("/Novák/").
 */
export function notAName(given: string): string | undefined {
  const g = given.trim();
  if (!g) return undefined;
  if (/^[(\[{].*[)\]}]$/su.test(g)) return `"${g}" is a description in brackets, not a name`;
  const words = foldText(g).replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  if (DESCRIPTIONS.has(words) || NO_NAME_SET.has(words)) return `"${g}" describes the person, it is not a name`;
  return undefined;
}

/**
 * The same name: letter for letter (case aside), whatever its kind. "Višek"
 * and "Víšek" are two spellings — a variant worth keeping, not one name.
 */
export function sameName(a: Name, b: Name): boolean {
  const key = (n: Name) => formatName(n).normalize("NFC").toLowerCase();
  return key(a) === key(b);
}

export function formatName(n: Name): string {
  return [n.given, n.surname].filter(Boolean).join(" ") || "?";
}

/** GEDCOM keeps the surname between two slashes: a slash inside a name part is written as "|". */
export function gedcomName(n: Name): string {
  const part = (s: string) => s.replace(/\//g, "|");
  return `${part(n.given)} /${part(n.surname)}/`.trim();
}

/** A title as it is kept: one line, single spaces, NFC; empty: none. */
export function cleanTitle(t: unknown): string | undefined {
  const s = (typeof t === "string" ? t : "").normalize("NFC").replace(/[\p{Cc}\p{Cf}]/gu, " ").replace(/\s+/gu, " ").trim();
  return s || undefined;
}

/** The name with its titles, as a person reads it: "Ing. Jan Novák ml." (the name alone where it has none). */
export function titledName(n: Name): string {
  return [n.prefix, formatName(n), n.suffix].filter(Boolean).join(" ");
}

/**
 * The NAME line of a name with its titles ("Ing. Jan /Novák/ ml."): a program that reads no NPFX / NSFX shows them
 * still. The Strom app (3.10) and strom read the titles from NPFX / NSFX and take them off the line (withoutTitles).
 */
export function gedcomTitledName(n: Name): string {
  return [n.prefix, gedcomName(n), n.suffix].filter(Boolean).join(" ");
}

/** A title written as GEDCOM lists them ("Prof., Dr.") and as a line says it ("Prof. Dr."). */
const titleForms = (t: string) => [...new Set([t, t.replace(/\s*,\s*/g, " ")])];

/**
 * The NAME line without the titles its NPFX / NSFX give: the title before at its start, the title after at its end,
 * each a whole word — as the Strom app reads it (its gedcom-names.ts stripTitles). A line without NPFX / NSFX is never
 * searched for titles: "Dr." told by a list of words would be a guess that damages a name which only looks like one.
 */
export function withoutTitles(line: string, before: string | undefined, after: string | undefined): string {
  return foundTitles(line, { before, after }).line;
}

/**
 * Titles known to be a person's (NPFX / NSFX, or the research's own) found in a NAME line: taken off its start and its
 * end — also from inside the closing slash, where an app that reads no NPFX / NSFX puts the title after ("Ing. Jan
 * /Novák ml./": the Strom app before 3.10 reads "Novák ml." as the surname). What was found, and the line without it.
 */
export function foundTitles(line: string, titles: { before?: string | undefined; after?: string | undefined }): { line: string; before?: string; after?: string } {
  let s = line.normalize("NFC").trim().replace(/\s+/g, " ");
  const found: { before?: string; after?: string } = {};
  if (titles.before)
    for (const t of titleForms(titles.before.normalize("NFC")))
      if (s.startsWith(t) && (s.length === t.length || /[\s/]/u.test(s[t.length]!))) {
        s = s.slice(t.length).trim();
        found.before = titles.before;
        break;
      }
  if (titles.after) {
    const slash = s.endsWith("/") && s.indexOf("/") < s.length - 1 ? "/" : "";
    let core = slash ? s.slice(0, -1).trimEnd() : s;
    for (const t of titleForms(titles.after.normalize("NFC"))) {
      const at = core.length - t.length;
      if (at >= 0 && core.endsWith(t) && (at === 0 || /[\s/,]/u.test(core[at - 1]!))) {
        // "Novák, Ph.D.": the comma before a title after the name goes with it
        core = core.slice(0, at).trim().replace(/,$/, "").trim();
        found.after = titles.after;
        break;
      }
    }
    if (found.after) s = slash ? `${core}/` : core;
  }
  return { line: s, ...found };
}

/** Why a name cannot be kept as it is, or undefined: a slash inside it ("/⟨K/Č⟩emenská/", "Jan /Novák"). */
export function slashInName(n: Name): string | undefined {
  const bad = [n.given, n.surname].find((s) => s.includes("/"));
  return bad === undefined ? undefined : `"${bad}": a slash inside a name — only the surname goes between two slashes ("Jan /Novák/")`;
}

export function primaryName(p: Person): Name {
  return p.names.find((n) => !n.kind || n.kind === "birth") ?? p.names[0] ?? { given: "", surname: "" };
}

export function displayName(p: Person): string {
  return formatName(primaryName(p));
}

const STATUS_RANK: Record<string, number> = { proven: 0, probable: 1, possible: 2, lead: 3 };

/** Best-supported first: status, then the number of citations, then the order they were added. */
export function byPreference(a: Event, b: Event): number {
  return (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9) || b.citations.length - a.citations.length;
}

/** The fact of a kind that counts: the best-supported one that is not retracted or disproven. */
export function preferred(events: Event[], kind: string): Event | undefined {
  return events.filter((e) => e.kind === kind && !e.retracted && e.status !== "disproven").sort(byPreference)[0];
}

/**
 * Events in the order a GEDCOM reader should see them: for each kind the
 * preferred one first (readers take the first BIRT as the birth), kinds in
 * the order they first appear.
 */
export function preferredOrder(events: Event[]): Event[] {
  const kinds = [...new Set(events.map((e) => e.kind))];
  return kinds.flatMap((k) => events.filter((e) => e.kind === k).sort(byPreference));
}

function firstEvent(p: Person, kinds: string[]): Event | undefined {
  for (const k of kinds) {
    const e = preferred(p.events, k);
    if (e) return e;
  }
  return undefined;
}

export function birthEvent(p: Person): Event | undefined {
  return firstEvent(p, ["BIRT", "CHR", "BAPM"]);
}

export function deathEvent(p: Person): Event | undefined {
  return firstEvent(p, ["DEAT", "BURI", "CREM"]);
}

/** "1811–1892", "*1811", "†1892" or "". */
export function lifespan(p: Person): string {
  const b = birthEvent(p)?.date;
  const d = deathEvent(p)?.date;
  if (b && d) return `${yearLabel(b)}–${yearLabel(d)}`;
  if (b) return `*${yearLabel(b)}`;
  if (d) return `†${yearLabel(d)}`;
  return "";
}

export function label(p: Person): string {
  const span = lifespan(p);
  return `${p.id} ${displayName(p)}${span ? ` (${span})` : ""}`;
}

// ── relatives ──────────────────────────────────────────────────────────────
// Built once per tree version, so walking generations is linear, not
// "every person × every family".

interface RelIndex {
  version: number;
  asChild: Map<string, Family[]>;
  asPartner: Map<string, Family[]>;
}

const relCache = new WeakMap<Tree, RelIndex>();

function relIndex(tree: Tree): RelIndex {
  const cached = relCache.get(tree);
  if (cached && cached.version === tree.version) return cached;
  const idx: RelIndex = { version: tree.version, asChild: new Map(), asPartner: new Map() };
  for (const f of tree.list<Family>("family")) {
    if (f.retracted) continue;
    for (const c of f.children) idx.asChild.set(c.person, [...(idx.asChild.get(c.person) ?? []), f]);
    for (const p of f.partners) idx.asPartner.set(p, [...(idx.asPartner.get(p) ?? []), f]);
  }
  relCache.set(tree, idx);
  return idx;
}

/** How a child is related to one partner of its family: its own relation to them, else the family's. */
export function relationTo(link: ChildLink, partner: string): ChildRelation {
  return link.relations?.[partner] ?? link.relation;
}

/** The family a child was born into: born to every partner of it. */
export function isBirthFamily(f: Family, child: string): boolean {
  const link = f.children.find((c) => c.person === child);
  if (!link) return false;
  return f.partners.length ? f.partners.every((p) => relationTo(link, p) === "birth") : link.relation === "birth";
}

export function familiesAsChild(tree: Tree, id: string): Family[] {
  return relIndex(tree).asChild.get(id) ?? [];
}

export function familiesAsPartner(tree: Tree, id: string): Family[] {
  return relIndex(tree).asPartner.get(id) ?? [];
}

/**
 * The two sides of a couple, HUSB and WIFE, as the Strom app sides them (its coupleSides): a man HUSB, a woman WIFE,
 * one of unknown sex the side the other one leaves free; two of one sex, or two unknown, in the order given. One
 * partner alone: HUSB unless a woman. Never one of them left out.
 */
export function coupleSides<T extends { sex: string }>(a: T | undefined, b: T | undefined): [T | undefined, T | undefined] {
  if (!a || !b) {
    const one = a ?? b;
    return one?.sex === "F" ? [undefined, one] : [one, undefined];
  }
  if (a.sex === "M" && b.sex !== "M") return [a, b];
  if (b.sex === "M" && a.sex !== "M") return [b, a];
  if (b.sex === "F" && a.sex !== "F") return [a, b];
  if (a.sex === "F" && b.sex !== "F") return [b, a];
  return [a, b];
}

/**
 * A family's sides as its files write them: the ones kept when a sex of the partners changed (Family.husb, U01-e) —
 * unless that puts a woman HUSB beside a man —, else coupleSides. An app that knows no unknown sex (the Strom app
 * before 3.10.0-beta.11) guesses one by the side: a side kept is no change of the guess.
 */
export function familySides<T extends { id: string; sex: string }>(f: { husb?: string | undefined }, a: T | undefined, b: T | undefined): [T | undefined, T | undefined] {
  if (a && b && (f.husb === a.id || f.husb === b.id)) {
    const [h, w] = f.husb === a.id ? [a, b] : [b, a];
    if (!(h.sex === "F" && w.sex === "M")) return [h, w];
  }
  return coupleSides(a, b);
}

/**
 * A person's sex about to change (editPerson): each couple of theirs keeps the sides its files wrote — set on the family
 * where coupleSides would now swap them, taken off where it no longer would (U01-e).
 */
export function keepSides(tree: Tree, before: Person, after: Person): { family: Family; next: Family }[] {
  const out: { family: Family; next: Family }[] = [];
  for (const f of familiesAsPartner(tree, before.id)) {
    if (f.partners.length !== 2) continue;
    const of = (p: Person) => f.partners.map((id) => (id === before.id ? p : tree.get<Person>(id))).filter((x): x is Person => !!x);
    const [a, b] = of(before);
    const [x, y] = of(after);
    if (!a || !b || !x || !y) continue;
    const was = familySides(f, a, b)[0]?.id;
    const kept = familySides({ husb: was }, x, y)[0]?.id;
    const plain = coupleSides(x, y)[0]?.id;
    const husb = kept === plain ? undefined : kept;
    if (husb === f.husb) continue;
    const { husb: _old, ...rest } = f;
    out.push({ family: f, next: { ...rest, ...(husb ? { husb } : {}) } as Family });
  }
  return out;
}

export function parentsOf(tree: Tree, id: string): Person[] {
  const out: Person[] = [];
  for (const f of familiesAsChild(tree, id)) {
    const link = f.children.find((c) => c.person === id)!;
    for (const pid of f.partners) {
      const rel = relationTo(link, pid);
      if (rel !== "birth" && rel !== "unknown") continue;
      const p = tree.get<Person>(pid);
      if (p && !p.retracted && !out.includes(p)) out.push(p);
    }
  }
  return out;
}

/** Generation numbers of ancestors: focus = 1, parents = 2, ... */
export function ancestorGenerations(tree: Tree, focus: string, max = 50): Map<string, number> {
  const gen = new Map<string, number>([[focus, 1]]);
  let frontier = [focus];
  for (let g = 2; g <= max && frontier.length > 0; g++) {
    const next: string[] = [];
    for (const id of frontier)
      for (const parent of parentsOf(tree, id))
        if (!gen.has(parent.id)) {
          gen.set(parent.id, g);
          next.push(parent.id);
        }
    frontier = next;
  }
  return gen;
}

// ── resolving references ───────────────────────────────────────────────────

function candidateLabel(tree: Tree, p: Person): string {
  const parents = parentsOf(tree, p.id).map(displayName);
  const place = birthEvent(p)?.place;
  return [label(p), place ? `born ${place}` : "", parents.length ? `child of ${parents.join(" & ")}` : ""].filter(Boolean).join(", ");
}

export function findPersons(tree: Tree, query: string): Person[] {
  const q = tokens(query);
  if (q.length === 0) return [];
  return tree
    .list<Person>("person")
    .filter((p) => !p.retracted)
    .filter((p) => {
      const hay = p.names.flatMap((n) => tokens(`${n.given} ${n.surname}`));
      return q.every((t) => hay.some((h) => h === t || h.startsWith(t)));
    });
}

export function resolvePerson(tree: Tree, ref: string): Person {
  const id = ref.trim().toUpperCase();
  if (/^P\d+$/.test(id)) {
    const p = tree.get<Person>(id.length < 5 ? "P" + id.slice(1).padStart(4, "0") : id);
    if (!p) throw new UsageError(`no person ${ref}`, { hint: "strom person list", code: "record.none", params: { kind: "person", id: ref } });
    if (p.mergedInto) throw new UsageError(`${p.id} was merged into ${p.mergedInto}`, { hint: `strom person show ${p.mergedInto}` });
    return p;
  }
  const hits = findPersons(tree, ref);
  if (hits.length === 1) return hits[0]!;
  if (hits.length === 0) throw new UsageError(`no person matches "${ref}"`, { hint: `strom person list ${foldText(ref).split(" ").pop() ?? ""}`.trim(), code: "person.no-match", params: { ref } });
  // Exact full-name match wins over prefix matches.
  const exact = hits.filter((p) => p.names.some((n) => foldText(formatName(n)) === foldText(ref)));
  if (exact.length === 1) return exact[0]!;
  throw new AmbiguousError(ref, hits.map((p) => ({ id: p.id, label: candidateLabel(tree, p) })));
}

/** Surnames that may be one family name: "Víšek"/"Víšková", "Nowak"/"Nowakowa", "Novotný"/"Novotná"; an unknown one fits any. */
export function sameSurname(a: string, b: string): boolean {
  const fa = foldText(a);
  const fb = foldText(b);
  if (!fa || !fb || fa === fb) return true;
  const stem = (x: string) => x.replace(/(ova|owa|ovna|owna|ina)$/, "").replace(/([a-z])(a|y|i)$/, "$1");
  return stem(fa) === stem(fb);
}

/**
 * People of `ids` (an imported tree) who are probably people already in the
 * tree: the same first given name, a fitting surname in any of their names,
 * the same sex and birth years at most three apart. A hint to check — never
 * merged without a look.
 */
export function likelyDuplicates(tree: Tree, ids: string[]): { person: Person; same: Person }[] {
  const out: { person: Person; same: Person }[] = [];
  const inSet = new Set(ids);
  const others = tree.list<Person>("person").filter((p) => !p.retracted && !inSet.has(p.id));
  const first = (n: Name) => foldText(n.given).split(" ")[0] ?? "";
  const year = (p: Person) => dateYears(birthEvent(p)?.date ?? "")[0];
  for (const id of ids) {
    const p = tree.get<Person>(id);
    if (!p || p.retracted) continue;
    for (const o of others) {
      if (p.sex !== "U" && o.sex !== "U" && p.sex !== o.sex) continue;
      const names = p.names.some((n) => o.names.some((m) => first(n) && first(n) === first(m) && sameSurname(n.surname, m.surname)));
      if (!names) continue;
      const [a, b] = [year(p), year(o)];
      if (a !== undefined && b !== undefined && Math.abs(a - b) > 3) continue;
      out.push({ person: p, same: o });
    }
  }
  // A wife under her married name is found through her husband: the partner of a
  // likely duplicate, with the same first given name, is likely the same too.
  const found = new Set(out.map((d) => d.person.id));
  for (const d of [...out])
    for (const f of familiesAsPartner(tree, d.person.id))
      for (const pid of f.partners.filter((x) => x !== d.person.id && inSet.has(x) && !found.has(x))) {
        const p = tree.get<Person>(pid)!;
        for (const g of familiesAsPartner(tree, d.same.id))
          for (const oid of g.partners.filter((x) => x !== d.same.id)) {
            const o = tree.get<Person>(oid);
            if (!o || o.retracted || (p.sex !== "U" && o.sex !== "U" && p.sex !== o.sex)) continue;
            if (!p.names.some((n) => o.names.some((m) => first(n) && first(n) === first(m)))) continue;
            out.push({ person: p, same: o });
            found.add(pid);
          }
      }
  return out;
}

/**
 * A conflict's title as it is read now: one the Strom app's edit opened starts with its person's name when it was
 * opened — the name the person is shown by now in its place (found on Mac: "Jon Berg: BIRT…" after the research renamed
 * him Johannes Bergh). Any other title as it was written.
 */
export function conflictTitle(tree: Tree, c: Conflict): string {
  const ofApp = !!(c.edit || c.parents || c.claims.some((x) => x.note === "the user's edit"));
  const title = ofApp ? inWords(c.title, tree.lang) : c.title;
  const p = ofApp && c.subject[0]?.startsWith("P") ? tree.get<Person>(c.subject[0]) : undefined;
  const m = p && !p.retracted ? /^([^:\n]{1,200}): /.exec(title) : null;
  if (!p || !m) return title;
  return `${gedcomName(primaryName(p)).replace(/\//g, "").replace(/\s+/g, " ").trim()}: ${title.slice(m[0].length)}`;
}

/**
 * A claim of a conflict as a person reads it, in the research's language (the Strom app's dialog, conflict show, the
 * decision taken): its words (`text`); else, a conflict of the user's edit an older strom opened, its side of the title
 * ("… — 14. 1. 1931, Dolní Lhota, čp. 12 × …"; found on Mac: "14 JAN 1931, Dolní Lhota, house 12" in a Czech research);
 * else the claim as written.
 */
export function claimText(tree: Tree, c: Conflict, claim: Conflict["claims"][number]): string {
  if (claim.text) return claim.text;
  const i = c.claims.indexOf(claim);
  const ofApp = !!(c.edit || c.parents || c.claims.some((x) => x.note === "the user's edit"));
  // a title cut at its length says one side no more
  if (ofApp && c.claims.length === 2 && i >= 0 && c.title.length < 200) {
    const m = / — (.*) × (.*)$/s.exec(conflictTitle(tree, c));
    if (m && !m[1]!.includes(" × ")) return m[i + 1]!;
  }
  return claim.value;
}

/**
 * A title an older strom wrote for the user's edit ("Petr Svoboda: SEX — U × F") in the research's language: what it is
 * about in words, a sex too ("Petr Svoboda: Pohlaví — neznámé × žena"); the values otherwise as they were written.
 */
function inWords(title: string, lang: string): string {
  const m = /^([^:\n]{1,200}): (SEX|NAME|parents|[A-Z]{3,4}) — (.*) × (.*)$/s.exec(title);
  if (!m) return title;
  const tag = m[2]!;
  const key = (tag === "SEX" ? "ui.conflict.sex" : tag === "NAME" ? "ui.conflict.name" : tag === "parents" ? "ui.conflict.parents" : `ui.ev.${tag === "BAPM" ? "CHR" : tag}`) as UIKey;
  if (!(key in UI)) return title;
  const sex = (s: string) => (tag !== "SEX" ? s : s === "M" ? ui(lang, "ui.show.sex.M") : s === "F" ? ui(lang, "ui.show.sex.F") : s === "U" ? ui(lang, "ui.conflict.sex.U") : s);
  const what = ui(lang, key);
  return `${m[1]}: ${what.charAt(0).toUpperCase()}${what.slice(1)} — ${sex(m[3]!)} × ${sex(m[4]!)}`;
}
