// The participants of a fact — godparents, witnesses, the priest — as a name apart from what the record says beside it:
// "godparent:Jan Novák (farmer, No. 12)" is the name "Jan Novák" and the note "farmer, No. 12". The words that tell
// the two apart (a status, an occupation, a house, a priest) are data (assets/terms/participants.json), never code;
// they are compared folded, in any script. strom checks a participant written now (too long a name, a number in it, a
// priest as a witness), suggests the person the tree has of a name, and sets old names apart (strom fixes
// participant-names), always as the person decides.

import fs from "node:fs";
import path from "node:path";
import { readAsset } from "./assets.ts";
import { UsageError } from "./errors.ts";
import type { Event, Family, Participant, ParticipantRole, Person, TreeConfig } from "./model.ts";
import type { Tree } from "./tree.ts";
import { roleWord } from "./roles.ts";
import { foldText } from "./text.ts";

interface TermsFile {
  clergy: Record<string, string[]>;
  nounsCapitalized: string[];
  describing: Record<string, string[]>;
  house: string[];
  place: string[];
}

interface Terms {
  clergy: Set<string>;
  /** Folded describing words of languages that write nouns small: they count written small only. */
  small: Set<string>;
  /** Of languages that write nouns capitalized (German): they count however written. */
  any: Set<string>;
  house: Set<string>;
  place: Set<string>;
}

let terms: Terms | undefined;

/** The words of assets/terms/participants.json, folded; none where the file is missing (nothing is then refused). */
export function participantTerms(): Terms {
  if (terms) return terms;
  let f: Partial<TermsFile> = {};
  try {
    f = JSON.parse(readAsset("terms", "participants.json") ?? "{}") as Partial<TermsFile>;
  } catch {
    f = {};
  }
  const fold = (ws: string[] | undefined) => new Set((ws ?? []).map((w) => foldText(w)));
  const capital = new Set(f.nounsCapitalized ?? []);
  const langs = Object.entries(f.describing ?? {});
  terms = {
    clergy: fold(Object.values(f.clergy ?? {}).flat()),
    small: fold(langs.filter(([l]) => !capital.has(l)).flatMap(([, ws]) => ws)),
    any: fold(langs.filter(([l]) => capital.has(l)).flatMap(([, ws]) => ws)),
    house: fold(f.house),
    place: fold(f.place),
  };
  return terms;
}

/** A word as written: its letters, marks and numbers, with dots and inner hyphens or apostrophes ("č.", "Anna-Marie"). */
const WORD = /[\p{L}\p{M}\p{N}]+(?:[-'’.][\p{L}\p{M}\p{N}]+)*\.?/gu;
/** A word that counts in a name: letters, marks and numbers, inner hyphens and apostrophes (one word). */
const NAME_WORD = /[\p{L}\p{M}\p{N}]+(?:[-'’][\p{L}\p{M}\p{N}]+)*/gu;
const DIGIT = /\p{N}/u;
/** What a reader marked unsure in a word: "[?]", "[ou?]", "(?)", "?". */
const UNSURE = /\[[^\]\s]*\]|\(\?\)|\?/gu;
const CAPITAL = /^\p{Lu}/u;
const SMALL = /^\p{Ll}/u;

/** A token without the punctuation around it, a dot at its end kept ("č.", "farář,", "(sedlák" → "sedlák"). */
const bare = (t: string) => t.replace(/^[^\p{L}\p{M}\p{N}]+/u, "").replace(/[^\p{L}\p{M}\p{N}.]+$/u, "");

/**
 * A title or an abbreviation beside a name ("P.", "Ing.", "MUDr.", "Ph.D.", "ml.", "jun."): short parts, each with its
 * dot. The titles of a name are kept with the name and never counted as its words. (strom knows a person's titles
 * from their record — core/people.ts foundTitles — never from a list: a participant has no record, so its titles are
 * told by their shape alone.)
 */
export function isTitle(token: string): boolean {
  const t = bare(token);
  return /^(?:[\p{L}\p{M}]{1,5}\.)+$/u.test(t) && !isHouse(t);
}

function isHouse(token: string): boolean {
  const t = bare(token);
  const f = foldText(t);
  if (!participantTerms().house.has(f)) return false;
  // "Nr.", "č.p.": however written; a short one ("č.", "n.") or a word ("dom") written small only
  return (f.length >= 3 && f.includes(".")) || !CAPITAL.test(t);
}

/** A word that says what a participant was (a status, an occupation, kin, an entry) — never a name. */
function isDescribing(token: string): boolean {
  const t = bare(token);
  const f = foldText(t);
  const { small, any } = participantTerms();
  return any.has(f) || (small.has(f) && !CAPITAL.test(t));
}

/** "z", "aus", "in": a word before a place, written small. */
function isPlaceWord(token: string): boolean {
  const t = bare(token);
  return SMALL.test(t) && participantTerms().place.has(foldText(t));
}

/** A role word written small at the start ("kmotr Jan …"): the role the participant has anyway. */
function isRoleWord(token: string): boolean {
  const t = bare(token);
  return SMALL.test(t) && !participantTerms().clergy.has(foldText(t)) && !!roleWord(t.replace(/\.$/u, ""));
}

/** The words of a name, its titles at either end not counted. */
export function nameWords(name: string): string[] {
  const tokens = name.normalize("NFC").trim().split(/\s+/u).filter(Boolean);
  let a = 0;
  let b = tokens.length;
  while (a < b && isTitle(tokens[a]!)) a++;
  while (b > a && isTitle(tokens[b - 1]!)) b--;
  return tokens.slice(a, b).flatMap((t) => t.match(NAME_WORD) ?? []);
}

/** At most this many words in a participant's name (its titles not counted). */
export const NAME_WORDS_MAX = 4;

/** Too long a name, or one with a number in it: what the record says beside the name is in it. */
export function longName(name: string): boolean {
  return nameWords(name).length > NAME_WORDS_MAX || DIGIT.test(name);
}

/** The text in the closing parentheses of a spec, and what is before them: "Jan Novák (farmer)" → note "farmer". */
export function trailingNote(text: string): { text: string; note?: string } {
  let s = text.normalize("NFC").trim();
  const notes: string[] = [];
  for (;;) {
    if (!s.endsWith(")")) break;
    // the group the last ")" closes
    let depth = 0;
    let at = -1;
    for (let i = s.length - 1; i >= 0; i--) {
      if (s[i] === ")") depth++;
      else if (s[i] === "(" && --depth === 0) {
        at = i;
        break;
      }
    }
    if (at <= 0) break;
    const inner = s.slice(at + 1, -1).trim();
    // "Lhoták(?)": a reading not sure of the name, part of it
    if (/^\?+$/u.test(inner)) break;
    const before = s.slice(0, at).trim();
    if (!before) break;
    if (inner) notes.unshift(inner);
    s = before;
  }
  return { text: s, ...(notes.length ? { note: notes.join("; ") } : {}) };
}

/** The first word of a text, folded, its dot kept ("P. Jan" → "p."). */
const firstWord = (text: string | undefined) => foldText(bare(text?.trim().split(/\s+/u)[0] ?? ""));

/** The name or the note begins with a priest's word (farář, pfarrer, parochus, P.): the priest. */
export function namesPriest(p: Pick<Participant, "name" | "note">): boolean {
  const { clergy } = participantTerms();
  return [p.name, p.note].some((t) => !!t && clergy.has(firstWord(t)));
}

/** A participant as the agent writes it, with its note: `role:name (note)`. */
export function participantSpec(role: string, who: string, note?: string): string {
  return `${role}:${who}${note ? ` (${note})` : ""}`;
}

/**
 * Checks a participant written now (strom event add/edit --with): a name of more than four words or with a number in
 * it, and a priest in the role of a witness or another — refused, with what to write instead.
 */
export function checkParticipant(p: Participant): void {
  if (p.name && longName(p.name)) {
    const split = splitName(p.name);
    const note = [split?.note, p.note].filter(Boolean).join("; ");
    const hint =
      split && split.name !== p.name
        ? `the name alone, what the record says beside it in parentheses at the end: --with "${participantSpec(p.role, split.name, note)}"`
        : `the name alone (at most ${NAME_WORDS_MAX} words, its titles not counted, no number), what the record says beside it (status, occupation, place, house number, entry) in parentheses at the end: --with "${p.role}:<name> (<what the record says>)"`;
    throw new UsageError(`the ${p.role}'s name "${p.name}" holds more than a name (${DIGIT.test(p.name) ? "a number" : `${nameWords(p.name).length} words`})`, {
      hint,
      code: "participant.long-name",
      params: { role: p.role, name: p.name },
    });
  }
  if ((p.role === "witness" || p.role === "other") && namesPriest(p))
    throw new UsageError(`a priest named as ${p.role === "witness" ? "a witness" : "another participant (other)"}: the one who baptised, married or buried is the officiant`, {
      hint: `--with "${participantSpec("officiant", p.person ?? p.name ?? "", p.note)}"`,
      code: "participant.officiant",
      params: { role: p.role, name: p.person ?? p.name ?? "" },
    });
}

// ── names set apart from their notes (strom fixes participant-names) ────────────────────────────────────────────

/**
 * A name strom would set apart from what is beside it: a number, a comma, parentheses, a word of a status, an
 * occupation, a house or a place, a role word before it, or more than four words.
 */
export function mixedName(name: string): boolean {
  if (DIGIT.test(name) || /[,;()]/u.test(name.replace(UNSURE, ""))) return true;
  const tokens = name.normalize("NFC").trim().split(/\s+/u).filter(Boolean);
  if (tokens.some((t) => isDescribing(t) || isHouse(t) || isPlaceWord(t))) return true;
  if (tokens.length && isRoleWord(tokens[0]!)) return true;
  return nameWords(name).length > NAME_WORDS_MAX;
}

/**
 * The name and the note of a name with what the record says beside it, by rules alone: a role word before the name to
 * the note; the titles before it kept; then the name — up to four words each begun with a capital letter, none a word
 * of a status, an occupation or a house; a comma ends it — and the rest, which must begin with a comma, a describing
 * word, a house, a place word or a number, to the note; what is in the closing parentheses to the note too.
 * Undefined: it cannot be told for sure (the rest begins otherwise, the name goes on past four words, or three capital
 * words before a number — a place may be the last of them).
 */
export function splitName(raw: string): { name: string; note?: string } | undefined {
  // a word of the name: a capital letter first, letters only — a reading not sure of it kept with it ("Lhot[?]ák",
  // "[Lhoták?]", "Lhoták(?)", a word not read "[?]")
  const nameToken = (t: string): boolean => {
    const sure = t.replace(UNSURE, "");
    if (sure !== t && !sure) return true;
    return CAPITAL.test(sure) && !DIGIT.test(t) && !isDescribing(sure) && !isHouse(sure) && /^[\p{L}\p{M}'’.-]+$/u.test(sure);
  };
  const { text, note: closing } = trailingNote(raw);
  const tokens = text.split(/\s+/u).filter(Boolean);
  let i = 0;
  const lead: string[] = [];
  while (i < tokens.length && isRoleWord(tokens[i]!)) lead.push(bare(tokens[i++]!));
  const titles: string[] = [];
  while (i < tokens.length && isTitle(tokens[i]!) && !isDescribing(tokens[i]!)) titles.push(tokens[i++]!);
  const run: string[] = [];
  let words = 0;
  let comma = false;
  while (i < tokens.length) {
    const t = tokens[i]!;
    const plain = t.replace(/[,;]+$/u, "");
    const title = isTitle(plain) && !isDescribing(plain) && words > 0;
    const name = nameToken(plain);
    if (!title && !name) break;
    run.push(plain);
    if (!title) words++;
    i++;
    if (plain !== t) {
      comma = true;
      break;
    }
  }
  if (!words || words > NAME_WORDS_MAX) return undefined;
  const rest = tokens.slice(i);
  if (rest.length) {
    const next = rest[0]!;
    if (!comma && !(isDescribing(next) || isHouse(next) || isPlaceWord(next) || DIGIT.test(next) || isRoleWord(next))) return undefined;
    // "Jan Novák Lhota 12": the last capital word may be the place
    if (!comma && words >= 3 && (DIGIT.test(next) || isHouse(next))) return undefined;
  }
  const said = rest.join(" ").replace(/^[,;:\s]+/u, "").trim();
  const note = [lead.join(" "), said, closing ?? ""].filter(Boolean).join("; ");
  return { name: [...titles, ...run].join(" "), ...(note ? { note } : {}) };
}

/** A note with more of what the record says: the earlier one kept, the new one after it. */
export function addedNote(before: string | undefined, more: string | undefined): string | undefined {
  const a = before?.trim();
  const b = more?.trim();
  if (!b) return a || undefined;
  if (!a) return b;
  return foldText(a).includes(foldText(b)) ? a : `${a}; ${b}`;
}

/** Everyone of the tree's people and families with their facts (for the checks and the fix). */
export function owners(tree: Tree): (Person | Family)[] {
  return [...tree.list<Person>("person"), ...tree.list<Family>("family")];
}


// ── the fix: old names set apart, and put back ──────────────────────────────────────────────────────────────────

/** Where the fix keeps what it changed, for its undo (sealed like the rest of quality/; travels with the research). */
export const PARTICIPANT_NAMES_FILE = "quality/participant-names.json";

/** A participant's name and note as they were, or as the fix makes them. */
export interface NameNote {
  name: string;
  note?: string;
}

/** One participant set apart: the fact, its role, before and after. */
export interface NameRewrite {
  /** The person or family the fact is of, and the fact. */
  owner: string;
  event: string;
  role: ParticipantRole;
  before: NameNote;
  after: NameNote;
}

export interface NameFindings {
  /** Participants named only whose name holds more than a name. */
  found: number;
  /** Of them, those set apart by the rules. */
  rewrites: NameRewrite[];
  /** Those that cannot be told for sure: left as they are. */
  unsplit: number;
}

interface NamesFile {
  v: 1;
  /** Each time the fix set names apart, newest last. */
  runs: { at: string; version: string; items: NameRewrite[] }[];
}

const nameNote = (name: string, note: string | undefined): NameNote => ({ name, ...(note ? { note } : {}) });

/** The participants of the research named only whose name holds more than a name, and how each would be set apart. */
export function participantNames(tree: Tree): NameFindings {
  const out: NameFindings = { found: 0, rewrites: [], unsplit: 0 };
  for (const o of owners(tree)) {
    if (o.retracted) continue;
    for (const e of o.events) {
      if (e.retracted) continue;
      for (const p of e.participants ?? []) {
        if (p.person || !p.name || !mixedName(p.name)) continue;
        out.found++;
        const split = splitName(p.name);
        const note = addedNote(p.note, split?.note);
        if (!split || (split.name === p.name && note === p.note)) {
          out.unsplit++;
          continue;
        }
        out.rewrites.push({ owner: o.id, event: e.id, role: p.role, before: nameNote(p.name, p.note), after: nameNote(split.name, note) });
      }
    }
  }
  return out;
}

/** Participants named only whose name strom would refuse now (strom check: participant-long-name). */
export function longNames(tree: Tree): { count: number; first?: string } {
  let count = 0;
  let first: string | undefined;
  for (const o of owners(tree))
    for (const e of o.events)
      if (!o.retracted && !e.retracted)
        for (const p of e.participants ?? [])
          if (!p.person && p.name && longName(p.name)) {
            count++;
            first ??= e.id;
          }
  return { count, ...(first ? { first } : {}) };
}

function readNamesFile(tree: Tree): NamesFile {
  try {
    const f = JSON.parse(fs.readFileSync(path.join(tree.root, ...PARTICIPANT_NAMES_FILE.split("/")), "utf8")) as Partial<NamesFile>;
    return { v: 1, runs: Array.isArray(f.runs) ? f.runs : [] };
  } catch {
    return { v: 1, runs: [] };
  }
}

const sameNameNote = (p: Participant, n: NameNote) => p.name === n.name && (p.note ?? undefined) === (n.note ?? undefined);

/**
 * Each change put on its record: the participant of its fact with that role and name `from` becomes `to` — one that is
 * no longer so (changed since) is left and counted. The records changed, and the changes made.
 */
function rewrite(tree: Tree, items: NameRewrite[], from: "before" | "after"): { records: (Person | Family)[]; done: NameRewrite[]; left: number } {
  const to = from === "before" ? "after" : "before";
  const records = new Map<string, Person | Family>();
  const done: NameRewrite[] = [];
  let left = 0;
  const ownerOf = new Map<string, Person | Family>();
  for (const o of owners(tree)) for (const e of o.events) ownerOf.set(e.id, o);
  for (const it of items) {
    // the fact where it is now (a merge may have moved it)
    const was = ownerOf.get(it.event);
    const rec = was ? (records.get(was.id) ?? (structuredClone(was) as Person | Family)) : undefined;
    const e = rec?.events.find((x) => x.id === it.event);
    const p = e?.participants?.find((x) => !x.person && x.role === it.role && sameNameNote(x, it[from]));
    if (!rec || !p) {
      left++;
      continue;
    }
    p.name = it[to].name;
    if (it[to].note) p.note = it[to].note;
    else delete p.note;
    records.set(rec.id, rec);
    done.push(it);
  }
  return { records: [...records.values()], done, left };
}

const fileContent = (f: NamesFile) => JSON.stringify(f, null, 2) + "\n";

/**
 * The fix: every name found set apart from its note (the note it had kept, the new text after it) — one operation and
 * what it changed kept for its undo (PARTICIPANT_NAMES_FILE). No person is linked. Inside withTreeLock.
 */
export function applyNameRewrites(tree: Tree, items: NameRewrite[], version: string, config?: (c: TreeConfig) => void): { changed: number; records: number; left: number } {
  const { records, done, left } = rewrite(tree, items, "before");
  if (!done.length) return { changed: 0, records: 0, left };
  const file = readNamesFile(tree);
  file.runs.push({ at: new Date().toISOString(), version, items: done });
  tree.putMany(
    records,
    [{ rel: PARTICIPANT_NAMES_FILE, content: fileContent(file) }],
    { op: "participant.fix", targets: records.map((r) => r.id).sort(), summary: `participant names set apart from their notes: ${done.length} in ${records.length} records (fix participant-names)` },
    config,
  );
  return { changed: done.length, records: records.length, left };
}

/** What the fix changed and is not undone yet. */
export function nameRewritesDone(tree: Tree): NameRewrite[] {
  return readNamesFile(tree).runs.flatMap((r) => r.items);
}

/**
 * The fix undone: each name and note as it was before — where it is still as the fix left it; one changed since is
 * left as it is and counted. One operation; what the fix kept is emptied.
 */
export function undoNameRewrites(tree: Tree, config?: (c: TreeConfig) => void): { restored: number; records: number; left: number } {
  const file = readNamesFile(tree);
  const items = file.runs.flatMap((r) => r.items).reverse();
  if (!items.length) return { restored: 0, records: 0, left: 0 };
  const { records, done, left } = rewrite(tree, items, "after");
  tree.putMany(
    records,
    [{ rel: PARTICIPANT_NAMES_FILE, content: fileContent({ v: 1, runs: [] }) }],
    { op: "participant.unfix", targets: records.map((r) => r.id).sort(), summary: `participant names put back as they were: ${done.length} in ${records.length} records${left ? `, ${left} changed since left` : ""} (fix participant-names undone)` },
    config,
  );
  return { restored: done.length, records: records.length, left };
}
