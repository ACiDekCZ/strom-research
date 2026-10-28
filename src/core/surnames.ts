// The forms of a surname that are one family's, as the person decided them (spec 021, K2.1–K2.5):
// - <tree>/quality/surnames.json: the groups of forms the person made one family ("Lhoták | Lhotaak") and the
//   suggestions they rejected — each with its ID, its forms, when and where the person decided (the Strom app or the
//   terminal). Written whole as a sealed operation of the tree, as history/ is (core/integrity.ts): a change outside
//   strom is an error of strom guard; strom sync undo and the history take it back.
// - suggest(): what the research suggests from its own records — "documented" (one person written so in the records),
//   "rules" (a spelling of one sound at one place in the same years); computed in memory, no agent, no network.
// - familyForms(), sameFamily(): a surname and the forms its group makes one family with, for searching the records,
//   matching a written entry and telling duplicates (K2.5). sameFamilyName (people.ts) stays the language's rule alone.
// Only a person decides a group or a rejection: an agent suggests (strom surname suggest), the person writes.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { readJsonIfExists, stringifyCanonical } from "./json.ts";
import { foldText } from "./text.ts";
import { UsageError } from "./errors.ts";
import { phrase } from "./phrases.ts";
import { dateYears } from "./gdate.ts";
import * as git from "./git.ts";
import { familiesAsPartner, formatName, parentsOf, sameFamilyName, surnameForms } from "./people.ts";
import { factWritten } from "../gedcom/export.ts";
import { lineValue } from "../gedcom/lines.ts";
import type { Name, Person, Source } from "./model.ts";
import type { Tree } from "./tree.ts";

export const SURNAMES_FILE = "quality/surnames.json";

/** A group of forms (or a suggestion rejected) as the person decided it: where (the Strom app, the terminal) and when. */
export interface SurnameEntry {
  id: string;
  forms: string[];
  at: string;
  by: "app" | "research";
}

export interface SurnamesFile {
  groups: SurnameEntry[];
  rejected: SurnameEntry[];
}

export type SurnameList = keyof SurnamesFile;

export interface SurnameEvidence {
  person: string;
  name: string;
  form: string;
  citation: string;
  source: string;
  quote?: string;
}

export interface SurnameSuggestion {
  id: string;
  forms: string[];
  level: "documented" | "rules";
  extends?: string[];
  rule: "same-person" | "phonetic" | "spelling";
  keys: string[];
  persons: number;
  places: string[];
  from?: number;
  to?: number;
  evidence?: SurnameEvidence[];
  evidenceMore?: number;
  text: string;
}

export interface SurnameAnswer {
  rev: string;
  groups: SurnameEntry[];
  rejected: SurnameEntry[];
  suggestions: SurnameSuggestion[];
  state: { truncated: boolean; persons: number; skipped: number };
}

/** The most suggestions given at once (the best first). */
export const SUGGESTIONS_MAX = 200;
/** The examples of the records each suggestion of one person's forms shows. */
const EVIDENCE_MAX = 3;
/** A quote of a record in an example: its first code points (after NFC), never a character cut. */
export const QUOTE_MAX = 200;
/** Two forms alike enough to be one name in the records of one person: 1 − Levenshtein / the longer ≥ this. */
const SIMILAR = 0.6;
/** The years two forms at one place may lie apart and still be one family's. */
const YEARS_APART = 30;
/** The places a suggestion names at most (the most frequent). */
const PLACES_MAX = 10;

// ── forms ──────────────────────────────────────────────────────────────────

/** Strings by their code points (never UTF-16 units: a letter beyond the BMP sorts as its code point). */
export function byCodePoint(a: string, b: string): number {
  const [x, y] = [Array.from(a), Array.from(b)];
  for (let i = 0; i < Math.min(x.length, y.length); i++) {
    const d = x[i]!.codePointAt(0)! - y[i]!.codePointAt(0)!;
    if (d) return d;
  }
  return x.length - y.length;
}

const clean = (form: string) => form.normalize("NFC").replace(/\s+/gu, " ").trim();

/**
 * A form with a woman's ending a language tells apart (-ová, -owa, -ówna, -á, -ska/-cka/-dzka, Cyrillic -ова, -ая) —
 * never one of no such ending (Kalina, Sova): those are men's names too.
 */
export function isWomansForm(form: string): boolean {
  const n = clean(form).toLowerCase();
  const letters = foldText(n).replace(/[^\p{L}\p{M}\p{N}]+/gu, "");
  return /^.{2,}(?:ov|ow)n?a$|(?:sk|ck|dzk)a$/u.test(letters) || /(?:á|(?:ов|ев|ёв|ин|ын)а|ая)$/u.test(n);
}

/**
 * A form folded to its family's base: foldText, a woman's form the man's (surnameForms) — the one among `men` (the
 * folded men's forms beside it) when it is there, else the first by code point (Lhotáková → lhotak, Novotná →
 * novotny, Kowalska → kowalski, Иванова → иванов).
 */
function baseOf(form: string, men: Set<string>): string {
  const f = foldText(clean(form));
  if (!f || !isWomansForm(form)) return f;
  const options = [...surnameForms(form)].filter((x) => x !== f);
  if (!options.length) return f;
  const known = options.filter((x) => men.has(x));
  return (known.length ? known : options).sort(byCodePoint)[0]!;
}

/** The folded bases of forms, each once (sorted by code point). */
function basesOf(forms: string[]): string[] {
  const kept = forms.map(clean).filter(Boolean);
  const men = new Set(kept.filter((x) => !isWomansForm(x)).map((x) => foldText(x)));
  return [...new Set(kept.map((x) => baseOf(x, men)).filter(Boolean))].sort(byCodePoint);
}

/**
 * The ID of a group of forms — composed by the research alone (the Strom app takes it as it is): each form NFC, folded
 * (foldText), a woman's form its man's (surnameForms), each once, sorted by code point, joined by "|".
 */
export function surnameGroupId(forms: string[]): string {
  return basesOf(forms).join("|");
}

/** Forms each once (NFC, by their letters in lower case), in the order given. */
function distinctForms(forms: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const f of forms.map(clean)) {
    const k = f.toLowerCase();
    if (!f || seen.has(k)) continue;
    seen.add(k);
    out.push(f);
  }
  return out;
}

/** Why a form cannot be one of a group ("" none): empty, with the separator, damaged characters. */
export function badForm(form: string): "" | "empty" | "separator" | "damaged" {
  if (damagedText(form)) return "damaged";
  const f = clean(form);
  if (!f) return "empty";
  if (f.includes("|")) return "separator";
  return "";
}

/** Text a line split damaged: U+FFFD, or half of a surrogate pair alone. */
export function damagedText(s: string): boolean {
  return /�|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(s);
}

// ── sounds and spellings ───────────────────────────────────────────────────

/** The spellings of one sound, in the order they are taken: their codes as the answer gives them. */
const SPELLINGS: [code: string, from: RegExp, to: string][] = [
  ["sch-s", /sch/gu, "s"],
  ["sz-s", /sz/gu, "s"],
  ["cz-c", /cz/gu, "c"],
  ["ch-h", /ch/gu, "h"],
  ["ck-k", /ck/gu, "k"],
  ["th-t", /th/gu, "t"],
  ["ph-f", /ph/gu, "f"],
  ["w-v", /w/gu, "v"],
  ["ie-i", /ie/gu, "i"],
  ["y-i", /y/gu, "i"],
];
const DOUBLED = /(\p{L})\1+/gu;
/** Codes that change a consonant: a phonetic rule; the rest (y-i, ie-i, double, diacritics) spelling alone. */
const CONSONANTS = new Set(["sch-s", "sz-s", "cz-c", "ch-h", "ck-k", "th-t", "ph-f", "w-v"]);

/** The key of a folded base by its sound: the spellings of one sound as one, a doubled letter single. */
export function phoneticKey(base: string): string {
  let s = base;
  for (const [, from, to] of SPELLINGS) s = s.replace(from, to);
  return s.replace(DOUBLED, "$1");
}

/** What tells two written forms apart (the codes): the spellings of a sound, a doubled letter, accents alone. */
function keysOf(a: string, b: string, baseA: string, baseB: string): string[] {
  const out: string[] = [];
  let [x, y] = [baseA, baseB];
  for (const [code, from, to] of SPELLINGS) {
    if ((x.match(from) ?? []).length !== (y.match(from) ?? []).length) out.push(code);
    x = x.replace(from, to);
    y = y.replace(from, to);
  }
  const doubles = (s: string) => (s.match(DOUBLED) ?? []).join("");
  if (doubles(x) !== doubles(y)) out.push("double");
  if (foldText(a) === foldText(b) && clean(a).toLowerCase() !== clean(b).toLowerCase()) out.push("diacritics");
  return out;
}

/** 1 − Levenshtein / the longer, by code points. */
function similarity(a: string, b: string): number {
  const [x, y] = [Array.from(a), Array.from(b)];
  const longer = Math.max(x.length, y.length);
  if (!longer) return 1;
  let prev = Array.from({ length: y.length + 1 }, (_, i) => i);
  for (let i = 1; i <= x.length; i++) {
    const row = [i];
    for (let j = 1; j <= y.length; j++) row.push(Math.min(prev[j]! + 1, row[j - 1]! + 1, prev[j - 1]! + (x[i - 1] === y[j - 1] ? 0 : 1)));
    prev = row;
  }
  return 1 - prev[y.length]! / longer;
}

/** A quote of a record as an example gives it: NFC, its first QUOTE_MAX code points, cut between characters only. */
export function quoteOf(text: string, max = QUOTE_MAX): string {
  const t = text.normalize("NFC").replace(/\s+/gu, " ").trim();
  if (Array.from(t).length <= max) return t;
  let out = "";
  let n = 0;
  for (const { segment } of new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(t)) {
    const len = Array.from(segment).length;
    if (n + len > max) break;
    out += segment;
    n += len;
  }
  return out;
}

// ── the file ───────────────────────────────────────────────────────────────

function entriesOf(v: unknown): SurnameEntry[] {
  if (!Array.isArray(v)) return [];
  const out: SurnameEntry[] = [];
  for (const x of v) {
    if (!x || typeof x !== "object") continue;
    const e = x as Partial<SurnameEntry>;
    if (!Array.isArray(e.forms)) continue;
    const forms = distinctForms(e.forms.filter((f): f is string => typeof f === "string"));
    if (forms.length < 2) continue;
    out.push({ id: surnameGroupId(forms), forms, at: typeof e.at === "string" ? e.at : "", by: e.by === "app" ? "app" : "research" });
  }
  return out;
}

/** The groups and rejections as a file (or a commit's copy of it) holds them; none when there is none. */
export function surnamesOf(text: string | undefined): SurnamesFile {
  if (!text) return { groups: [], rejected: [] };
  try {
    const f = JSON.parse(text) as Partial<SurnamesFile>;
    return { groups: entriesOf(f?.groups), rejected: entriesOf(f?.rejected) };
  } catch {
    return { groups: [], rejected: [] };
  }
}

export function readSurnames(tree: Tree): SurnamesFile {
  try {
    const f = readJsonIfExists<Partial<SurnamesFile>>(path.join(tree.root, ...SURNAMES_FILE.split("/")));
    return { groups: entriesOf(f?.groups), rejected: entriesOf(f?.rejected) };
  } catch {
    return { groups: [], rejected: [] };
  }
}

/** The groups and rejections of the research at a commit (what the export at it gave the Strom app). */
export function surnamesAt(tree: Tree, head: string): SurnamesFile | undefined {
  if (!/^[0-9a-f]{7,40}$/u.test(head)) return undefined;
  if (git.runGit(tree.root, ["cat-file", "-e", `${head}^{commit}`]).status !== 0) return undefined;
  return surnamesOf(git.showFile(tree.root, head, SURNAMES_FILE));
}

/** The groups and rejections as the Strom file's header gives them to the app (its two notes, gedcom/export.ts). */
export function surnamesForExport(tree: Tree): { groups: string[][]; rejected: string[][] } {
  const f = readSurnames(tree);
  const sorted = (l: SurnameEntry[]) => [...l].sort((a, b) => byCodePoint(a.id, b.id)).map((e) => e.forms);
  return { groups: sorted(f.groups), rejected: sorted(f.rejected) };
}

/** Written whole as a sealed operation of the tree, inside its lock. */
export function writeSurnames(tree: Tree, next: SurnamesFile, op: { op: string; summary: string }): void {
  const sorted = (l: SurnameEntry[]) => [...l].sort((a, b) => byCodePoint(a.id, b.id));
  tree.withTreeLock(() => tree.putFile(SURNAMES_FILE, stringifyCanonical({ groups: sorted(next.groups), rejected: sorted(next.rejected) }), { op: op.op, targets: [], summary: op.summary.normalize("NFC") }));
}

/** The forms of a group or rejection as the history says them ("Lhoták | Lhotinka"). */
export const formsSaid = (forms: string[]) => forms.join(" | ");

/** A fingerprint of everything the answer is made of: the research's last commit and the file. */
export function surnamesRev(tree: Tree): string {
  let content = "";
  try {
    content = fs.readFileSync(path.join(tree.root, ...SURNAMES_FILE.split("/")), "utf8");
  } catch {
    // none yet
  }
  const head = (git.head(tree.root) ?? "0000000").slice(0, 7);
  return `${head}-${crypto.createHash("sha256").update(content).digest("hex").slice(0, 4)}`;
}

// ── the groups a surname belongs to ────────────────────────────────────────

/** Two forms of one family by the language's rule, or one form the same in its letters. */
function oneFamily(a: string, b: string): boolean {
  return sameFamilyName(a, b);
}

/** The groups that hold a form of this surname's family (by the language's rule). */
function groupsOf(groups: SurnameEntry[], surname: string): SurnameEntry[] {
  return groups.filter((g) => g.forms.some((f) => oneFamily(f, surname)));
}

/** A surname's forms the records may give (folded): its own (surnameForms) and those of the groups it belongs to. */
export function familyForms(tree: Tree, surname: string): Set<string> {
  return familyFormsIn(readSurnames(tree).groups, surname);
}

/** familyForms for many surnames: the groups read once. */
export function familyFormsFor(tree: Tree): (surname: string) => Set<string> {
  const groups = readSurnames(tree).groups;
  return (surname) => familyFormsIn(groups, surname);
}

function familyFormsIn(groups: SurnameEntry[], surname: string): Set<string> {
  const out = surnameForms(surname);
  for (const g of groupsOf(groups, surname)) for (const f of g.forms) for (const x of surnameForms(f)) out.add(x);
  return out;
}

/**
 * Two surnames of one family in this research: by the language's rule (sameFamilyName), or through a group of forms the
 * person made one family. The groups read once for every comparison of the matcher.
 */
export function sameFamily(tree: Tree): (a: string, b: string) => boolean {
  const groups = readSurnames(tree).groups;
  if (!groups.length) return sameFamilyName;
  const cache = new Map<string, Set<string>>();
  const forms = (s: string) => {
    let f = cache.get(s);
    if (!f) cache.set(s, (f = familyFormsIn(groups, s)));
    return f;
  };
  return (a, b) => {
    if (sameFamilyName(a, b)) return true;
    const fb = surnameForms(b);
    return [...forms(a)].some((x) => fb.has(x));
  };
}

/** The other forms of a surname its groups give (written as the group has them): for a search of the records. */
export function groupedForms(tree: Tree, surname: string, groups: SurnameEntry[] = readSurnames(tree).groups): string[] {
  const own = surnameForms(surname);
  return distinctForms(groupsOf(groups, surname).flatMap((g) => g.forms)).filter((f) => !own.has(foldText(f)));
}

// ── suggestions ────────────────────────────────────────────────────────────

/** Names that are no form of a family's name: a religious name; an alias only when it is like none of the person's own. */
const NOT_A_FORM = new Set(["religious", "alias"]);

/** Two written surnames alike as forms of one name are: similar enough, or of one sound. */
function alike(a: string, b: string): boolean {
  const [x, y] = [baseOf(a, new Set()), baseOf(b, new Set())];
  return !!x && !!y && (similarity(x, y) >= SIMILAR || phoneticKey(x) === phoneticKey(y));
}

/**
 * The surnames of a person that are forms of a family's name: every one but a religious name, and an alias (the
 * research writes another spelling so) only when it is like one of the person's own — a "vulgo" of another word is none.
 */
function formsOfPerson(p: Person): Name[] {
  const own = p.names.filter((n) => usable(n.surname) && !NOT_A_FORM.has(n.kind ?? ""));
  const aliases = p.names.filter((n) => n.kind === "alias" && usable(n.surname) && own.some((o) => alike(n.surname, o.surname)));
  return [...own, ...aliases];
}

interface Node {
  key: string;
  /** The written forms (NFC) and how often each is written. */
  written: Map<string, number>;
  base: string;
  sound: string;
  persons: Set<string>;
}

const usable = (s: string | undefined) => !!s && !!foldText(s).replace(/[?\s.]/gu, "");

/** The first part of a place as the GEDCOM writes it (the municipality of 2 PLAC). */
const placeOf = (place: string) => (lineValue(place).split(",")[0] ?? "").trim();

/** What the research suggests of a surname's forms — the answer of GET /surnames and strom surname suggest. */
export function suggestSurnames(tree: Tree, lang: string = tree.lang, max = SUGGESTIONS_MAX): SurnameAnswer {
  const file = readSurnames(tree);
  const persons = tree.list<Person>("person").filter((p) => !p.retracted && !p.mergedInto);
  // the forms written: one node each (by its letters in lower case), a woman's the man's written form when the tree has it
  const nodes = new Map<string, Node>();
  const allForms = new Map<string, string>();
  const formsOf = new Map(persons.map((p) => [p.id, formsOfPerson(p)]));
  for (const p of persons) for (const n of formsOf.get(p.id)!) allForms.set(clean(n.surname).toLowerCase(), clean(n.surname));
  const men = new Map<string, string>(); // a folded man's form → its written key
  for (const [k, f] of allForms) if (!isWomansForm(f)) men.set(foldText(f), men.get(foldText(f)) ?? k);
  const nodeKey = (surname: string): string => {
    const f = clean(surname);
    const k = f.toLowerCase();
    if (!isWomansForm(f)) return k;
    const own = foldText(f);
    for (const x of [...surnameForms(f)].filter((y) => y !== own).sort(byCodePoint)) if (men.has(x)) return men.get(x)!;
    return k;
  };
  const menFolded = new Set(men.keys());
  const nodeOf = (surname: string, person: string): Node => {
    const key = nodeKey(surname);
    let node = nodes.get(key);
    if (!node) {
      const shown = allForms.get(key) ?? clean(surname);
      const base = baseOf(shown, menFolded);
      node = { key, written: new Map(), base, sound: phoneticKey(base), persons: new Set() };
      nodes.set(key, node);
    }
    // the written form: the man's where a woman's stands for it
    const shown = key === clean(surname).toLowerCase() ? clean(surname) : (allForms.get(key) ?? clean(surname));
    node.written.set(shown, (node.written.get(shown) ?? 0) + 1);
    node.persons.add(person);
    return node;
  };
  const shownOf = (n: Node) => [...n.written].sort((a, b) => b[1] - a[1] || byCodePoint(a[0], b[0]))[0]![0];
  for (const p of persons) for (const n of formsOf.get(p.id)!) nodeOf(n.surname, p.id);

  // where and when each form was borne: the places of its people's facts (as the GEDCOM writes them) with their years
  const byId = new Map(persons.map((p) => [p.id, p]));
  const placesOfPerson = new Map<string, { place: string; years: number[] }[]>();
  for (const p of persons) {
    const out: { place: string; years: number[] }[] = [];
    for (const e of p.events) if (factWritten(e) && e.place && placeOf(e.place)) out.push({ place: placeOf(e.place), years: e.date ? dateYears(e.date) : [] });
    placesOfPerson.set(p.id, out);
  }
  const spans = (n: Node): Map<string, [number, number]> => {
    const out = new Map<string, [number, number]>();
    for (const pid of n.persons)
      for (const { place, years } of placesOfPerson.get(pid) ?? []) {
        if (!years.length) continue;
        const k = foldText(place);
        const [lo, hi] = [Math.min(...years), Math.max(...years)];
        const s = out.get(k);
        out.set(k, s ? [Math.min(s[0], lo), Math.max(s[1], hi)] : [lo, hi]);
      }
    return out;
  };

  // union-find over the forms
  const parent = new Map<string, string>([...nodes.keys()].map((k) => [k, k]));
  const find = (k: string): string => {
    let r = k;
    while (parent.get(r) !== r) r = parent.get(r)!;
    let x = k;
    while (parent.get(x) !== r) {
      const nx = parent.get(x)!;
      parent.set(x, r);
      x = nx;
    }
    return r;
  };
  const join = (a: string, b: string) => {
    const [x, y] = [find(a), find(b)];
    if (x !== y) parent.set(x, y);
  };
  const pairKey = (a: string, b: string) => (a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`);
  const forbidden = new Set<string>();
  const documented = new Set<string>(); // pair keys of one person's forms
  const evidence = new Map<string, SurnameEvidence[]>(); // node key → examples
  const sourceTitle = (id: string) => tree.get<Source>(id)?.title ?? id;
  const example = (p: Person, n: Name): SurnameEvidence | undefined => {
    const c = n.citations?.[0];
    if (!c) return undefined;
    const title = sourceTitle(c.source);
    return { person: p.id, name: formatName(n), form: clean(n.surname), citation: c.locator ? `${title}, ${c.locator}` : title, source: c.source, ...(c.quote?.trim() ? { quote: quoteOf(c.quote) } : {}) };
  };

  // the woman's safeguard: a form of her husband's family and one of her father's are never one family's forms
  const relatives = (p: Person) => {
    const partners = familiesAsPartner(tree, p.id).flatMap((f) => f.partners.filter((x) => x !== p.id)).map((x) => byId.get(x)).filter((x): x is Person => !!x);
    const parents = parentsOf(tree, p.id);
    const fathers = parents.filter((x) => x.sex === "M");
    const surnames = (ps: Person[]) => ps.flatMap((x) => x.names.map((m) => m.surname).filter(usable));
    return { partners: surnames(partners), fathers: surnames(fathers.length ? fathers : parents) };
  };
  const ofOne = (form: string, surnames: string[]) => surnames.some((s) => sameFamilyName(form, s));

  for (const p of persons) {
    // one person's forms: no birth or married name (two families' names), an alias that is another spelling
    const forms = formsOf.get(p.id)!.filter((n) => !n.kind || n.kind === "alias");
    if (forms.length < 2) continue;
    // a woman's (or one of no sex known): a man's wife bears his name, his own forms are no two families
    const rel = p.sex !== "M" && familiesAsPartner(tree, p.id).length ? relatives(p) : undefined;
    for (let i = 0; i < forms.length; i++)
      for (let j = i + 1; j < forms.length; j++) {
        const [a, b] = [forms[i]!, forms[j]!];
        const [ka, kb] = [nodeKey(a.surname), nodeKey(b.surname)];
        if (ka === kb) continue;
        const [na, nb] = [nodes.get(ka)!, nodes.get(kb)!];
        // her husband's family and her father's: never one (also when alike: Lhoták × Lhotinka)
        if (rel && ((ofOne(a.surname, rel.partners) && ofOne(b.surname, rel.fathers)) || (ofOne(b.surname, rel.partners) && ofOne(a.surname, rel.fathers)))) {
          forbidden.add(pairKey(ka, kb));
          continue;
        }
        if (!a.citations?.length && !b.citations?.length) continue;
        if (similarity(na.base, nb.base) < SIMILAR && na.sound !== nb.sound) continue;
        documented.add(pairKey(ka, kb));
        join(ka, kb);
        for (const [n, k] of [[a, ka], [b, kb]] as const) {
          const ex = example(p, n);
          if (ex) evidence.set(k, [...(evidence.get(k) ?? []), ex]);
        }
      }
  }
  // one sound at one place in the same years (±30): rules
  const bySound = new Map<string, Node[]>();
  for (const n of nodes.values()) bySound.set(n.sound, [...(bySound.get(n.sound) ?? []), n]);
  const spanOf = new Map<string, Map<string, [number, number]>>();
  const spanFor = (n: Node) => spanOf.get(n.key) ?? spanOf.set(n.key, spans(n)).get(n.key)!;
  for (const group of bySound.values()) {
    if (group.length < 2) continue;
    for (let i = 0; i < group.length; i++)
      for (let j = i + 1; j < group.length; j++) {
        const [a, b] = [group[i]!, group[j]!];
        if (forbidden.has(pairKey(a.key, b.key))) continue;
        const [sa, sb] = [spanFor(a), spanFor(b)];
        const together = [...sa].some(([place, [lo, hi]]) => {
          const o = sb.get(place);
          return !!o && lo - YEARS_APART <= o[1] && o[0] - YEARS_APART <= hi;
        });
        if (together) join(a.key, b.key);
      }
  }

  // the components: each a suggestion — none holding a woman's two families, none the person decided already
  const components = new Map<string, Node[]>();
  for (const n of nodes.values()) {
    const r = find(n.key);
    components.set(r, [...(components.get(r) ?? []), n]);
  }
  const out: SurnameSuggestion[] = [];
  let skipped = 0;
  const rejectedIds = new Set(file.rejected.map((r) => r.id));
  const groupIds = new Set(file.groups.map((g) => g.id));
  for (const members of components.values()) {
    if (members.length < 2) continue;
    const keys = members.map((m) => m.key);
    if (keys.some((a, i) => keys.slice(i + 1).some((b) => forbidden.has(pairKey(a, b))))) continue;
    const isDocumented = keys.some((a, i) => keys.slice(i + 1).some((b) => documented.has(pairKey(a, b))));
    let forms = members.map(shownOf).sort(byCodePoint);
    // forms told apart by their accents alone (Lhoták, Lhotak) are suggested too: one form to the search, two to the Strom
    // app (its key keeps the accents) — the ID folded as ever ("lhotak"), the code diacritics
    let id = surnameGroupId(forms);
    let extendsOf: string[] | undefined;
    const touched = file.groups.filter((g) => g.forms.some((f) => forms.some((x) => oneFamily(f, x))));
    if (touched.length > 1) {
      skipped++;
      continue;
    }
    if (touched.length === 1) {
      const g = touched[0]!;
      const union = distinctForms([...g.forms, ...forms]);
      const uid = surnameGroupId(union);
      if (uid === g.id) continue;
      extendsOf = g.forms;
      forms = union;
      id = uid;
    }
    if (rejectedIds.has(id) || groupIds.has(id)) continue;
    // the codes: what tells each two of its forms apart
    const codes = new Set<string>();
    const written = members.flatMap((m) => [...m.written.keys()].map((w) => ({ w, base: m.base })));
    for (let i = 0; i < written.length && i < 12; i++) for (let j = i + 1; j < written.length && j < 12; j++) for (const k of keysOf(written[i]!.w, written[j]!.w, written[i]!.base, written[j]!.base)) codes.add(k);
    const keyList = [...codes].sort((a, b) => order(a) - order(b));
    const rule = isDocumented ? "same-person" : keyList.some((k) => CONSONANTS.has(k)) ? "phonetic" : "spelling";
    const who = new Set(members.flatMap((m) => [...m.persons]));
    const placeCount = new Map<string, { name: string; n: number }>();
    const years: number[] = [];
    for (const pid of who)
      for (const { place, years: ys } of placesOfPerson.get(pid) ?? []) {
        const k = foldText(place);
        const c = placeCount.get(k);
        placeCount.set(k, { name: c?.name ?? place, n: (c?.n ?? 0) + 1 });
        years.push(...ys);
      }
    const places = [...placeCount.values()].sort((a, b) => b.n - a.n || byCodePoint(a.name, b.name)).slice(0, PLACES_MAX).map((x) => x.name);
    const examples = isDocumented ? dedupe(members.flatMap((m) => evidence.get(m.key) ?? [])) : [];
    out.push({
      id,
      forms,
      level: isDocumented ? "documented" : "rules",
      ...(extendsOf ? { extends: extendsOf } : {}),
      rule,
      keys: keyList,
      persons: who.size,
      places,
      ...(years.length ? { from: Math.min(...years), to: Math.max(...years) } : {}),
      ...(isDocumented ? { evidence: examples.slice(0, EVIDENCE_MAX) } : {}),
      ...(examples.length > EVIDENCE_MAX ? { evidenceMore: examples.length - EVIDENCE_MAX } : {}),
      text: suggestionText(lang, rule, forms, keyList),
    });
  }
  out.sort((a, b) => (a.level === b.level ? 0 : a.level === "documented" ? -1 : 1) || b.persons - a.persons || byCodePoint(a.id, b.id));
  return {
    rev: surnamesRev(tree),
    groups: file.groups,
    rejected: file.rejected,
    suggestions: out.slice(0, max),
    state: { truncated: out.length > max, persons: persons.length, skipped },
  };
}

const ORDER = [...SPELLINGS.map(([c]) => c), "double", "diacritics"];
const order = (k: string) => ORDER.indexOf(k);

function dedupe(list: SurnameEvidence[]): SurnameEvidence[] {
  const seen = new Set<string>();
  return list.filter((e) => {
    const k = `${e.person}|${e.form}|${e.source}|${e.citation}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** What a suggestion is, in the research's language (a code the app does not know is told by it). */
function suggestionText(lang: string, rule: SurnameSuggestion["rule"], forms: string[], keys: string[]): string {
  const said = keys.map((k) => (k === "double" ? phrase(lang, "surname.key.double") : k === "diacritics" ? phrase(lang, "surname.key.diacritics") : k.replace("-", " → "))).join(", ");
  const values = { forms: formsSaid(forms), keys: said || "—" };
  if (rule === "same-person") return phrase(lang, "surname.suggest.person", values);
  return phrase(lang, rule === "phonetic" ? "surname.suggest.phonetic" : "surname.suggest.spelling", values);
}

// ── the person's decisions (strom surname …) ───────────────────────────────

const now = () => new Date().toISOString();

/** Forms as a person gives them: each usable, at least two of them that are not one form already. */
function checkedForms(forms: string[]): string[] {
  for (const f of forms) {
    const bad = badForm(f);
    if (bad) throw new UsageError(bad === "separator" ? `a form holds no "|": ${f}` : bad === "damaged" ? `a form with damaged characters: ${f}` : "an empty form", { code: "surname.form", params: { form: f } });
  }
  const kept = distinctForms(forms);
  if (basesOf(kept).length < 2) throw new UsageError("two forms of different spelling at least (a man's and a woman's form are one already)", { code: "surname.one-form" });
  return kept;
}

/** The suggestion of this ID as the research gives it now. */
function suggestionById(tree: Tree, id: string): SurnameSuggestion {
  const s = suggestSurnames(tree).suggestions.find((x) => x.id === id.trim());
  if (!s) throw new UsageError(`no suggestion ${id} (strom surname suggest lists them)`, { code: "surname.no-suggestion", params: { id }, hint: "strom surname suggest" });
  return s;
}

/** A suggestion taken: a new group, or the group it extends with its forms. */
export function acceptSuggestion(tree: Tree, id: string, by: SurnameEntry["by"] = "research"): SurnameEntry {
  return tree.withTreeLock(() => {
    const s = suggestionById(tree, id);
    const file = readSurnames(tree);
    const old = s.extends ? file.groups.find((g) => surnameGroupId(g.forms) === surnameGroupId(s.extends!)) : undefined;
    const entry: SurnameEntry = { id: s.id, forms: s.forms, at: now(), by };
    writeSurnames(tree, { groups: [...file.groups.filter((g) => g !== old), entry], rejected: file.rejected.filter((r) => r.id !== s.id) }, { op: "surname.group", summary: `Surname forms one family: ${formsSaid(s.forms)}` });
    return entry;
  });
}

/** A suggestion rejected: never suggested again. */
export function rejectSuggestion(tree: Tree, id: string, by: SurnameEntry["by"] = "research"): SurnameEntry | undefined {
  return tree.withTreeLock(() => {
    const file = readSurnames(tree);
    if (file.rejected.some((r) => r.id === id.trim())) return undefined;
    const s = suggestionById(tree, id);
    const entry: SurnameEntry = { id: s.id, forms: s.forms, at: now(), by };
    writeSurnames(tree, { groups: file.groups, rejected: [...file.rejected, entry] }, { op: "surname.reject", summary: `Surname forms not one family: ${formsSaid(s.forms)}` });
    return entry;
  });
}

/** Forms made one family by the person: the groups that hold any of them joined into one. */
export function groupSurnames(tree: Tree, forms: string[], by: SurnameEntry["by"] = "research"): { entry: SurnameEntry; changed: boolean } {
  const given = checkedForms(forms);
  return tree.withTreeLock(() => {
    const file = readSurnames(tree);
    const joined = file.groups.filter((g) => g.forms.some((f) => given.some((x) => oneFamily(f, x))));
    const all = distinctForms([...joined.flatMap((g) => g.forms), ...given]);
    const id = surnameGroupId(all);
    const same = joined.length === 1 && joined[0]!.id === id && distinctForms([...joined[0]!.forms, ...given]).length === joined[0]!.forms.length;
    if (same) return { entry: joined[0]!, changed: false };
    const entry: SurnameEntry = { id, forms: all, at: now(), by };
    writeSurnames(tree, { groups: [...file.groups.filter((g) => !joined.includes(g)), entry], rejected: file.rejected.filter((r) => r.id !== id) }, { op: "surname.group", summary: `Surname forms one family: ${formsSaid(all)}` });
    return { entry, changed: true };
  });
}

/** A form taken out of its group: the group without it, or none when one form is left. */
export function ungroupSurname(tree: Tree, form: string): { was: SurnameEntry; now?: SurnameEntry } {
  const f = clean(form);
  if (!f) throw new UsageError("which form?", { code: "surname.form", params: { form } });
  return tree.withTreeLock(() => {
    const file = readSurnames(tree);
    const exact = (x: string) => x.toLowerCase() === f.toLowerCase();
    const folded = (x: string) => foldText(x) === foldText(f);
    const g = file.groups.find((x) => x.forms.some(exact)) ?? file.groups.find((x) => x.forms.some(folded)) ?? file.groups.find((x) => x.forms.some((y) => oneFamily(y, f)));
    if (!g) throw new UsageError(`no group holds ${f} (strom surname list)`, { code: "surname.no-group", params: { form: f }, hint: "strom surname list" });
    const hit = g.forms.some(exact) ? exact : g.forms.some(folded) ? folded : (y: string) => oneFamily(y, f);
    const left = g.forms.filter((x) => !hit(x));
    const keep = basesOf(left).length >= 2 ? { id: surnameGroupId(left), forms: left, at: now(), by: "research" as const } : undefined;
    writeSurnames(tree, { groups: [...file.groups.filter((x) => x !== g), ...(keep ? [keep] : [])], rejected: file.rejected }, { op: "surname.ungroup", summary: `Surname forms apart: ${f} — ${formsSaid(g.forms)}` });
    return { was: g, ...(keep ? { now: keep } : {}) };
  });
}

/** A rejection taken back: the suggestion may come again. */
export function unrejectSurnames(tree: Tree, id: string): SurnameEntry {
  return tree.withTreeLock(() => {
    const file = readSurnames(tree);
    const r = file.rejected.find((x) => x.id === id.trim());
    if (!r) throw new UsageError(`no rejected suggestion ${id} (strom surname list)`, { code: "surname.no-rejected", params: { id }, hint: "strom surname list" });
    writeSurnames(tree, { groups: file.groups, rejected: file.rejected.filter((x) => x !== r) }, { op: "surname.unreject", summary: `Surname forms may be suggested again: ${formsSaid(r.forms)}` });
    return r;
  });
}

// ── the Strom app's groups and rejections (strom sync) ─────────────────────

/** What a file of the Strom app says of a surname's forms: undefined where its marker is not there at all. */
export interface SurnameMarks {
  groups?: string[][];
  rejected?: string[][];
  /** A marker with a group refused (an empty form, damaged text): nothing of that list is taken away. */
  partial?: SurnameList[];
  warnings: { list: SurnameList; line: string; why: "empty" | "separator" | "damaged" }[];
  /** The file's day (its HEAD's DATE, YYYY-MM-DD): a decision the research made later wins. */
  day?: string;
}

/** The lines of one header note (its first line the marker): each a group, its forms apart by "|". */
export function readMarkLines(list: SurnameList, lines: string[], marks: SurnameMarks): void {
  // damaged text: an error of the import — the whole list is left as it is (never a form renamed in silence)
  if (lines.some(damagedText)) {
    for (const line of lines.filter(damagedText)) marks.warnings.push({ list, line, why: "damaged" });
    return;
  }
  const out: string[][] = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const forms = line.split("|").map(clean);
    if (forms.some((f) => !f)) {
      marks.warnings.push({ list, line, why: "empty" });
      marks.partial = [...(marks.partial ?? []), list];
      continue;
    }
    const kept = distinctForms(forms);
    if (basesOf(kept).length < 2 && kept.length < 2) continue;
    out.push(kept);
  }
  marks[list] = out;
}

/** One change of the groups or rejections a sync brings. */
export interface SurnameChange {
  list: SurnameList;
  /** add: a new one; set: replaces those of `replaces`; remove: the one of `replaces` taken away; kept: the research's stays (only said); warning: a line of the file refused. */
  how: "add" | "set" | "remove" | "kept" | "warning";
  forms: string[];
  /** The research's entries it replaces or removes (their IDs), and their forms. */
  replaces?: string[];
  was?: string[];
  why?: string;
}

const dayOf = (at: string) => at.slice(0, 10);

/**
 * What the Strom app's groups and rejections change in the research, three states as everything a sync takes: `base`
 * (what the research gave the app at _STROM_HEAD, when it gave them), the file, the research now. A list whose marker
 * the file lacks: nothing. Without a base only additions (and a group one of the research's grows into).
 */
export function planSurnames(now: SurnamesFile, marks: SurnameMarks | undefined, base: SurnamesFile | undefined): SurnameChange[] {
  if (!marks) return [];
  const out: SurnameChange[] = [];
  for (const w of marks.warnings) out.push({ list: w.list, how: "warning", forms: [w.line], why: w.why });
  for (const list of ["groups", "rejected"] as const) {
    const theirs = marks[list];
    if (!theirs) continue;
    const ours = now[list];
    const was = base?.[list];
    const wasIds = new Set(was?.map((x) => x.id));
    const theirIds = new Set(theirs.map((f) => surnameGroupId(f)));
    const fileDay = marks.day;
    const researchNewer = (e: SurnameEntry) => !!fileDay && !!e.at && dayOf(e.at) >= fileDay;
    const touches = (a: string[], b: string[]) => (list === "groups" ? a.some((x) => b.some((y) => oneFamily(x, y))) : surnameGroupId(a) === surnameGroupId(b));
    const handled = new Set<string>();
    for (const forms of theirs) {
      const id = surnameGroupId(forms);
      if (handled.has(id)) continue;
      handled.add(id);
      if (ours.some((e) => e.id === id)) continue;
      const over = ours.filter((e) => touches(e.forms, forms));
      if (!over.length) {
        // the research took it away since it gave it: the research's word stands
        if (was && wasIds.has(id)) continue;
        out.push({ list, how: "add", forms });
        continue;
      }
      if (was) {
        // the file changed it, the research kept it as given: the file's forms; both changed: the newer
        const unchanged = over.every((e) => wasIds.has(e.id));
        const fileKept = wasIds.has(id);
        if (fileKept) continue;
        if (unchanged || !over.some(researchNewer)) out.push({ list, how: "set", forms, replaces: over.map((e) => e.id), was: over.flatMap((e) => e.forms) });
        else out.push({ list, how: "kept", forms, replaces: over.map((e) => e.id), was: over.flatMap((e) => e.forms) });
        continue;
      }
      // no base: a group of the research grown, else said only
      const one = over.length === 1 ? over[0]! : undefined;
      const grows = one && one.forms.every((f) => forms.some((x) => surnameGroupId([x]) === surnameGroupId([f]) || clean(x).toLowerCase() === f.toLowerCase()));
      out.push(grows ? { list, how: "set", forms, replaces: [one.id], was: one.forms } : { list, how: "kept", forms, replaces: over.map((e) => e.id), was: over.flatMap((e) => e.forms) });
    }
    // what the file no longer has: taken away where the research kept it as it gave it (the person's setting, no evidence)
    if (!was || marks.partial?.includes(list)) continue;
    for (const b of was) {
      if (theirIds.has(b.id)) continue;
      // changed in the file: a change, taken above
      if (theirs.some((f) => touches(b.forms, f))) continue;
      const mine = ours.find((e) => e.id === b.id);
      if (mine) {
        out.push({ list, how: "remove", forms: mine.forms, replaces: [mine.id], was: mine.forms });
        continue;
      }
      // the research changed it since: the newer wins
      const changed = ours.filter((e) => touches(e.forms, b.forms));
      if (!changed.length) continue;
      if (changed.some(researchNewer)) out.push({ list, how: "kept", forms: [], replaces: changed.map((e) => e.id), was: changed.flatMap((e) => e.forms) });
      else for (const e of changed) out.push({ list, how: "remove", forms: e.forms, replaces: [e.id], was: e.forms });
    }
  }
  return out;
}

/** One change of a sync written into the file (inside the sync's lock): what an undo needs to put it back. */
export function applySurnameChange(tree: Tree, c: SurnameChange, why: string): { list: SurnameList; added?: string; removed: SurnameEntry[] } | undefined {
  if (c.how === "kept" || c.how === "warning") return undefined;
  const file = readSurnames(tree);
  const list = file[c.list];
  const removed = list.filter((e) => c.replaces?.includes(e.id));
  const entry: SurnameEntry | undefined = c.how === "remove" ? undefined : { id: surnameGroupId(c.forms), forms: c.forms, at: now(), by: "app" };
  const next = [...list.filter((e) => !removed.includes(e) && e.id !== entry?.id), ...(entry ? [entry] : [])];
  if (!entry && !removed.length) return undefined;
  const op =
    c.list === "groups" ? (entry ? "surname.group" : "surname.ungroup") : entry ? "surname.reject" : "surname.unreject";
  const summary =
    c.list === "groups"
      ? entry
        ? `Surname forms one family: ${formsSaid(entry.forms)} (${why})`
        : `Surname forms apart: ${formsSaid(removed.flatMap((e) => e.forms))} (${why})`
      : entry
        ? `Surname forms not one family: ${formsSaid(entry.forms)} (${why})`
        : `Surname forms may be suggested again: ${formsSaid(removed.flatMap((e) => e.forms))} (${why})`;
  writeSurnames(tree, { ...file, [c.list]: next }, { op, summary });
  return { list: c.list, ...(entry ? { added: entry.id } : {}), removed };
}

/** A change of a sync taken back: what it added out, what it replaced or removed back. */
export function undoSurnameChange(tree: Tree, list: SurnameList, added: string | undefined, removed: SurnameEntry[], why: string): boolean {
  const file = readSurnames(tree);
  const kept = file[list].filter((e) => e.id !== added);
  const back = removed.filter((r) => !kept.some((e) => e.id === r.id));
  if (kept.length === file[list].length && !back.length) return false;
  const next = [...kept, ...back];
  writeSurnames(tree, { ...file, [list]: next }, { op: "surname.undo", summary: `Surname forms as before: ${why}` });
  return true;
}
