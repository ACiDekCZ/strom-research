// Person helpers: names, life spans, relatives, and resolving a reference
// ("P0039", "Antonín Víšek", "visek antonin") to exactly one person.

import { AmbiguousError, UsageError } from "./errors.ts";
import { dateYears, yearLabel } from "./gdate.ts";
import type { ChildLink, ChildRelation, Event, Family, Name, Person } from "./model.ts";
import { foldText, tokens } from "./text.ts";
import type { Tree } from "./tree.ts";

/**
 * Parse "Jan /Novák/", "Jan Novák" (last word = surname) or "/Novák/". The
 * surname runs from the first slash to the last: "/⟨K/Č⟩emenská/" keeps its
 * inner slash for the caller to refuse (actions) or replace (import).
 */
export function parseName(input: string): Name {
  const s = input.trim().replace(/\s+/g, " ");
  const m = /^([^/]*?)\s*\/(.*)\/\s*([^/]*)$/.exec(s);
  if (m) {
    const given = [m[1], m[3]].filter(Boolean).join(" ").trim();
    return { given, surname: (m[2] ?? "").trim() };
  }
  const parts = s.split(" ");
  if (parts.length === 1) return { given: s, surname: "" };
  return { given: parts.slice(0, -1).join(" "), surname: parts[parts.length - 1]! };
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
  if (DESCRIPTIONS.has(words)) return `"${g}" describes the person, it is not a name`;
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
    if (!p) throw new UsageError(`no person ${ref}`, { hint: "strom person list" });
    if (p.mergedInto) throw new UsageError(`${p.id} was merged into ${p.mergedInto}`, { hint: `strom person show ${p.mergedInto}` });
    return p;
  }
  const hits = findPersons(tree, ref);
  if (hits.length === 1) return hits[0]!;
  if (hits.length === 0) throw new UsageError(`no person matches "${ref}"`, { hint: `strom person list ${foldText(ref).split(" ").pop() ?? ""}`.trim() });
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
