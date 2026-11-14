// Occupations as old records name them: one occupation in several languages (assets/terms/occupations.json — a miller
// is mlynář, Müller, molitor, młynarz). A word asked for finds the values that name the occupation in any of them.
//
// Compared folded (foldText: no accents, lower case, ß as ss, ł as l) and by the start of a word of the value: the
// word asked for as typed ("mlynar" finds "mlynáře", "mlynářský" — and "Mlynařík" too: a word that only begins so
// is found, which is why the caller looks in values of a kind, an occupation, not in names), and each form of its
// group by its stem (a form ending in a vowel or in -us without it: "děvečka" finds "děvečky", "colonus" "coloni").
// No transliteration is made up: "Mueller" is a form of the list beside "Müller", never ue read as ü in general —
// the Latin "puer" (a boy) or "poena" would otherwise turn into something else. A word not in the list finds only
// itself; `exact` finds the word asked for as a whole word, without its group.
//
// A research's own list (quality/occupations.json, the same shape as the built-in one, each group with who added it,
// when and on what source): forms the built-in list lacks, added with strom occupation add — by the person in their
// terminal, or by the agent when the records name an occupation so. A group of its own joins every group (built in
// or its own) it shares a form with: a form of a miller added there makes it one more form of the miller. Written whole
// as a sealed operation (quality/, core/integrity.ts): an agent changes and removes only what an agent added, never
// the person's; the person anything of the file. A file that cannot be read leaves the built-in list alone, said.

import path from "node:path";
import { readAsset } from "./assets.ts";
import { readJsonIfExists, stringifyCanonical } from "./json.ts";
import { foldText } from "./text.ts";
import { UsageError } from "./errors.ts";
import type { Tree } from "./tree.ts";

export interface OccupationMatcher {
  /** The word asked for, as typed (NFC). */
  word: string;
  /** The forms of the occupation found by it, as the list writes them (with accents), the word itself when none. */
  variants: string[];
  /** Whether the word is one of the list's occupations. */
  known: boolean;
  /** Does a value (an occupation as a record gives it) name it? */
  matches(text: string | undefined): boolean;
}

/** The research's own list of occupations, as strom writes it. */
export const OCCUPATIONS_FILE = "quality/occupations.json";

/** Who added a group of the research's own list: the person (their terminal), or an agent. */
export type OccupationBy = "human" | "agent";

/** A group of the research's own list: its forms by language, who added it, when, on what sources. */
export interface OwnOccupation {
  /** The forms by language code (cs, de, la, pl, en, …), as written (NFC). */
  forms: Record<string, string[]>;
  by: OccupationBy;
  /** The day it was added (YYYY-MM-DD). */
  at: string;
  /** The sources the forms were met in (S…), when said. */
  sources?: string[];
}

/** The research's own list as read: its groups, and why the file could not be read when it could not (then none). */
export interface OwnOccupations {
  groups: OwnOccupation[];
  error?: string;
}

/** The occupations one research knows: the built-in groups, its own joined into them. */
export interface OccupationList {
  entries: Entry[];
  /** Why the research's own list could not be read (then the built-in list alone). */
  error?: string;
}

interface Entry {
  forms: string[];
  /** Each form folded into words, then stemmed: what a value's words begin with. */
  stems: string[][];
  /** The forms of the research's own list (none for a built-in group alone). */
  own?: string[];
}

/** A language code as a form's prefix gives it (de:Fassbinder) and as the file keys its forms. */
const LANG_CODE = /^[a-z]{2,3}$/u;

let builtin: Entry[] | undefined;

const WORD_SPLIT = /[^\p{L}\p{M}\p{N}]+/u;

function words(text: string): string[] {
  return foldText(text).split(WORD_SPLIT).filter(Boolean);
}

/** A folded word without its declension ending: a final vowel (a, e, o, y) or -us, the stem left at least four. */
function stem(w: string): string {
  if (w.length >= 6 && w.endsWith("us")) return w.slice(0, -2);
  if (w.length >= 5 && "aeoy".includes(w.slice(-1))) return w.slice(0, -1);
  return w;
}

/** A form's key: its words folded and stemmed — two forms with one key are one form. */
function keyOf(form: string): string {
  return words(form).map(stem).join(" ");
}

function entryOf(forms: string[], own?: string[]): Entry {
  const distinct = [...new Set(forms.map((f) => f.normalize("NFC")))];
  return { forms: distinct, stems: distinct.map((f) => words(f).map(stem)).filter((s) => s.length > 0), ...(own?.length ? { own: [...new Set(own)] } : {}) };
}

/** The forms of a group, of every language it gives (a key that is no language code, or no list of words, left out). */
function formsOfGroup(g: Record<string, unknown>): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(g)) {
    if (!LANG_CODE.test(k) || !Array.isArray(v)) continue;
    for (const f of v) if (typeof f === "string" && words(f).length) out.push(f.normalize("NFC").trim());
  }
  return out;
}

function builtinEntries(): Entry[] {
  if (builtin) return builtin;
  let file: { groups?: Record<string, unknown>[] } = {};
  try {
    file = JSON.parse(readAsset("terms", "occupations.json") ?? "{}") as { groups?: Record<string, unknown>[] };
  } catch {
    file = {};
  }
  builtin = (file.groups ?? []).map((g) => entryOf(formsOfGroup(g)));
  return builtin;
}

/** The research's own groups as a file holds them: what is not a group of forms with its origin is left out. */
function ownGroupsOf(v: unknown): OwnOccupation[] {
  if (!Array.isArray(v)) return [];
  const out: OwnOccupation[] = [];
  for (const x of v) {
    if (!x || typeof x !== "object" || Array.isArray(x)) continue;
    const g = x as Record<string, unknown>;
    const forms: Record<string, string[]> = {};
    for (const [k, list] of Object.entries(g)) {
      if (!LANG_CODE.test(k) || !Array.isArray(list)) continue;
      const fs = [...new Set(list.filter((f): f is string => typeof f === "string" && words(f).length > 0).map((f) => f.normalize("NFC").trim()))];
      if (fs.length) forms[k] = fs;
    }
    if (!Object.keys(forms).length) continue;
    const sources = Array.isArray(g.sources) ? g.sources.filter((s): s is string => typeof s === "string" && s.trim() !== "") : [];
    out.push({ forms, by: g.by === "agent" ? "agent" : "human", at: typeof g.at === "string" ? g.at : "", ...(sources.length ? { sources } : {}) });
  }
  return out;
}

/** The research's own list of occupations (none when there is no file; an error said when it cannot be read). */
export function readOwnOccupations(tree: Tree): OwnOccupations {
  try {
    const f = readJsonIfExists<{ groups?: unknown }>(path.join(tree.root, ...OCCUPATIONS_FILE.split("/")));
    if (f === undefined) return { groups: [] };
    if (!f || typeof f !== "object" || Array.isArray(f) || !Array.isArray(f.groups)) return { groups: [], error: `${OCCUPATIONS_FILE} has no list "groups"` };
    return { groups: ownGroupsOf(f.groups) };
  } catch (e) {
    return { groups: [], error: `${OCCUPATIONS_FILE} cannot be read: ${(e as Error).message.split("\n")[0]}` };
  }
}

const allForms = (g: OwnOccupation) => Object.values(g.forms).flat();

/**
 * The built-in groups with the research's own joined in: each group of its own joins every group it shares a form
 * with (two built-in groups too, when one of its own names a form of each — the person's or the agent's word for it).
 */
export function mergeOccupations(own: OwnOccupation[]): Entry[] {
  if (!own.length) return builtinEntries();
  let entries = [...builtinEntries()];
  for (const g of own) {
    const forms = allForms(g);
    const keys = new Set(forms.map(keyOf));
    const joined = entries.filter((e) => e.stems.some((s) => keys.has(s.join(" "))));
    const rest = entries.filter((e) => !joined.includes(e));
    entries = [...rest, entryOf([...joined.flatMap((e) => e.forms), ...forms], [...joined.flatMap((e) => e.own ?? []), ...forms])];
  }
  return entries;
}

/** The occupations of a research: the built-in list and its own (the built-in alone when its own cannot be read). */
export function occupationsOf(tree: Tree): OccupationList {
  const own = readOwnOccupations(tree);
  return { entries: mergeOccupations(own.groups), ...(own.error ? { error: own.error } : {}) };
}

/** Do the words of a value hold the needle's words in a row — each the start of a word, or the whole word? */
function holds(text: string[], needle: string[], whole: boolean): boolean {
  if (needle.length === 0) return false;
  for (let i = 0; i + needle.length <= text.length; i++) {
    let all = true;
    for (let j = 0; j < needle.length && all; j++) all = whole ? text[i + j] === needle[j] : text[i + j]!.startsWith(needle[j]!);
    if (all) return true;
  }
  return false;
}

/** The groups a word belongs to (its own key among a group's forms). */
function groupsOf(word: string, list: Entry[]): Entry[] {
  const key = keyOf(word);
  return key ? list.filter((g) => g.stems.some((s) => s.join(" ") === key)) : [];
}

/**
 * What an occupation asked for finds: the word itself at the start of a word of a value and, with the list, every
 * form of its occupation (in any language of the list) the same way; `exact` the word alone, as a whole word.
 * `list`: a research's occupations (occupationsOf) — the built-in list when none is given.
 */
export function occupationMatcher(word: string, opts: { exact?: boolean; list?: OccupationList } = {}): OccupationMatcher {
  const typed = word.normalize("NFC").trim();
  const asked = words(typed);
  const own = { word: typed, variants: typed ? [typed] : [], known: false };
  if (asked.length === 0) return { ...own, matches: () => false };
  const mine = groupsOf(typed, opts.list?.entries ?? builtinEntries());
  if (opts.exact) return { ...own, known: mine.length > 0, matches: (text) => !!text && holds(words(text), asked, true) };
  if (mine.length === 0) return { ...own, matches: (text) => !!text && holds(words(text), asked, false) };
  const needles = [asked, ...mine.flatMap((g) => g.stems)];
  return {
    word: typed,
    variants: [...new Set(mine.flatMap((g) => g.forms))],
    known: true,
    matches: (text) => {
      if (!text) return false;
      const w = words(text);
      return needles.some((n) => holds(w, n, false));
    },
  };
}

/** A word's occupation as a list gives it: its forms, and which of them the research's own list added. */
export function occupationGroup(word: string, list: OccupationList): { forms: string[]; own: string[] } | undefined {
  const mine = groupsOf(word.normalize("NFC").trim(), list.entries);
  if (!mine.length) return undefined;
  return { forms: [...new Set(mine.flatMap((g) => g.forms))], own: [...new Set(mine.flatMap((g) => g.own ?? []))] };
}

/** How many groups the built-in list has. */
export function builtinOccupationCount(): number {
  return builtinEntries().length;
}

/** A form as typed for strom occupation add|remove: "de:Fassbinder" in German, a plain one in the research's language. */
export function parseForm(typed: string, lang: string): { lang: string; form: string } {
  const t = typed.normalize("NFC").trim();
  const m = /^([A-Za-z]{2,3}):(.*)$/u.exec(t);
  const code = (m ? m[1]! : lang).toLowerCase();
  const form = (m ? m[2]! : t).trim().replace(/\s+/gu, " ");
  if (!words(form).length) throw new UsageError(`"${typed}" holds no word of an occupation`, { hint: "strom occupation add olejník de:Ölschläger" });
  if (!LANG_CODE.test(code)) throw new UsageError(`"${code}" is no language code (cs, de, la, pl, en …)`, { hint: "strom occupation add olejník de:Ölschläger" });
  return { lang: code, form };
}

const formsSaid = (forms: string[]) => forms.join(", ");

function writeOwn(tree: Tree, groups: OwnOccupation[], op: { op: string; summary: string }): void {
  const file = {
    about:
      "The research's own forms of occupations, beside strom's built-in list: each group one occupation by language code, who added it (human: the person; agent: the research's agent), the day, the sources. A group joins every group it shares a form with. Written by strom occupation add|remove.",
    groups: groups.map((g) => ({ ...g.forms, by: g.by, at: g.at, ...(g.sources?.length ? { sources: g.sources } : {}) })),
  };
  tree.putFile(OCCUPATIONS_FILE, stringifyCanonical(file), { op: op.op, targets: [], summary: op.summary.normalize("NFC") });
}

function ownOrRefuse(tree: Tree): OwnOccupation[] {
  const own = readOwnOccupations(tree);
  if (own.error)
    throw new UsageError(`${own.error}: nothing is written over it`, {
      hint: "strom repair (puts the research's own list back as strom sealed it), or the person mends the file",
    });
  return own.groups;
}

export interface OccupationAdded {
  /** The forms written now (not known before as one occupation with the others). */
  added: string[];
  /** The occupation's forms now, all of them. */
  forms: string[];
  by: OccupationBy;
}

/**
 * Add forms as one occupation to the research's own list: into a group of the same author they share a form with (or a
 * new one). At least two forms — one already known joins the rest to its occupation. Read and written under the
 * tree lock; nothing is written when the forms are one occupation already.
 */
export function addOccupation(tree: Tree, typed: string[], opts: { by: OccupationBy; source?: string; today: string }): OccupationAdded {
  const parsed = typed.map((t) => parseForm(t, tree.lang));
  const keys = new Set(parsed.map((p) => keyOf(p.form)));
  if (keys.size < 2)
    throw new UsageError("an occupation's forms are added two at least: a form known already (or a new one) and its other forms", {
      hint: "strom occupation add olejník de:Ölschläger",
    });
  return tree.withTreeLock(() => {
    const groups = ownOrRefuse(tree);
    const before = mergeOccupations(groups);
    const one = groupsOf(parsed[0]!.form, before);
    if (one.length === 1 && parsed.every((p) => groupsOf(p.form, before).includes(one[0]!)))
      return { added: [], forms: one[0]!.forms, by: opts.by };
    // the author's own groups holding one of the forms are joined into one (never another author's)
    const mineAt = groups.map((g, i) => ({ g, i })).filter(({ g }) => g.by === opts.by && allForms(g).some((f) => keys.has(keyOf(f))));
    const sources = [...new Set(mineAt.flatMap(({ g }) => g.sources ?? []))];
    const target: OwnOccupation = { forms: {}, by: opts.by, at: mineAt[0]?.g.at || opts.today, ...(sources.length ? { sources } : {}) };
    for (const { g } of mineAt) for (const [l, fs] of Object.entries(g.forms)) target.forms[l] = [...new Set([...(target.forms[l] ?? []), ...fs])];
    const had = new Set(allForms(target).map(keyOf));
    const added: string[] = [];
    for (const p of parsed) {
      const k = keyOf(p.form);
      if (had.has(k)) continue;
      had.add(k);
      target.forms[p.lang] = [...(target.forms[p.lang] ?? []), p.form];
      added.push(p.form);
    }
    if (opts.source && !(target.sources ?? []).includes(opts.source)) target.sources = [...(target.sources ?? []), opts.source];
    const drop = new Set(mineAt.map(({ i }) => i));
    const next = [...groups.filter((_, i) => !drop.has(i)), target];
    const now = groupsOf(parsed[0]!.form, mergeOccupations(next));
    const forms = [...new Set(now.flatMap((g) => g.forms))];
    writeOwn(tree, next, { op: "occupation.add", summary: `Occupation forms: ${formsSaid(added.length ? added : parsed.map((p) => p.form))} (one with ${formsSaid(forms.slice(0, 12))})` });
    return { added, forms, by: opts.by };
  });
}

export interface OccupationRemoved {
  removed: string[];
  /** Forms the person added: an agent leaves them (only the person removes them). */
  persons: string[];
  /** Forms of the built-in list: never removed. */
  builtin: string[];
  /** Forms in no list. */
  unknown: string[];
}

/** Take forms out of the research's own list (a group left with one form or none goes): an agent only what an agent added. */
export function removeOccupation(tree: Tree, typed: string[], opts: { by: OccupationBy }): OccupationRemoved {
  const parsed = typed.map((t) => parseForm(t, tree.lang));
  return tree.withTreeLock(() => {
    const groups = ownOrRefuse(tree);
    const out: OccupationRemoved = { removed: [], persons: [], builtin: [], unknown: [] };
    const builtinKeys = new Set(builtinEntries().flatMap((e) => e.forms.map(keyOf)));
    let next = groups.map((g) => ({ ...g, forms: { ...g.forms } }));
    for (const p of parsed) {
      const k = keyOf(p.form);
      let hit = false;
      let blocked = false;
      next = next.map((g) => {
        const has = allForms(g).some((f) => keyOf(f) === k);
        if (!has) return g;
        if (opts.by === "agent" && g.by === "human") {
          blocked = true;
          return g;
        }
        hit = true;
        const forms: Record<string, string[]> = {};
        for (const [l, fs] of Object.entries(g.forms)) {
          const left = fs.filter((f) => keyOf(f) !== k);
          if (left.length) forms[l] = left;
        }
        return { ...g, forms };
      });
      if (hit) out.removed.push(p.form);
      else if (blocked) out.persons.push(p.form);
      else if (builtinKeys.has(k)) out.builtin.push(p.form);
      else out.unknown.push(p.form);
    }
    next = next.filter((g) => new Set(allForms(g).map(keyOf)).size >= 2);
    if (out.removed.length) writeOwn(tree, next, { op: "occupation.remove", summary: `Occupation forms taken out: ${formsSaid(out.removed)}` });
    return out;
  });
}
