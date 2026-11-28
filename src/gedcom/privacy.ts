// The protection of the living in a GEDCOM file that leaves the research (spec 151): who is living — one rule with the
// Strom app's outputs (its privacy.ts isLivingPerson and inferBirthUpperBounds) — and the file a mode makes of the full
// one. Judged on the full GEDCOM the research writes (retracted and disproven facts are never in it), so the app reading
// that file judges every person the same. The research's own work (core/review.ts livingBorn) keeps its own rule.

import { MONTHS, normalizeDate } from "../core/gdate.ts";
import { clipChars } from "./lines.ts";

/** The modes in the order every output names them (the Strom app's PrivacyMode: minimal = surname, anonymous = hidden). */
export const LIVING_MODES = ["full", "initials", "surname", "hidden"] as const;
export type LivingMode = (typeof LIVING_MODES)[number];

const MODE_ALIASES: Record<string, LivingMode> = { minimal: "surname", anonymous: "hidden" };

/** A mode as typed (the app's names taken too), else undefined. */
export function livingModeOf(word: string | undefined): LivingMode | undefined {
  const w = word?.trim().toLowerCase();
  if (!w) return undefined;
  if ((LIVING_MODES as readonly string[]).includes(w)) return w as LivingMode;
  return MODE_ALIASES[w];
}

/** Ages beyond this (with no death) are taken for deceased. */
export const ASSUMED_MAX_AGE = 110;
/** A parent is at least this much older than any of their children. */
export const MIN_PARENT_AGE = 12;
/** Nobody marries younger than this. */
export const MIN_MARRIAGE_AGE = 14;

/** A line of the file and the lines under it as they are (CONC and CONT among them): what a protected file keeps is written as it was. */
export interface RawNode {
  level: number;
  xref?: string;
  tag: string;
  value: string;
  line: string;
  children: RawNode[];
}

const LINE = /^\s*(\d{1,2})\s+(?:(@[^@\s]+@)\s+)?([A-Za-z0-9_]+)(?:\s(.*))?$/;

/** The records of a GEDCOM text, each line kept as written. */
export function rawRecords(text: string): RawNode[] {
  const records: RawNode[] = [];
  const stack: RawNode[] = [];
  for (const raw of text.replace(/^﻿/u, "").split(/\r\n|\r|\n/)) {
    if (!raw.trim()) continue;
    const m = LINE.exec(raw);
    if (!m) continue;
    const node: RawNode = { level: Number(m[1]), tag: m[3]!.toUpperCase(), value: m[4] ?? "", line: raw, children: [] };
    if (m[2]) node.xref = m[2];
    if (node.level === 0) records.push(node);
    else {
      const parent = stack[node.level - 1];
      if (!parent) continue;
      parent.children.push(node);
    }
    stack.length = node.level;
    stack[node.level] = node;
  }
  return records;
}

function emit(n: RawNode, out: string[]): void {
  out.push(n.line);
  for (const c of n.children) emit(c, out);
}

const node = (level: number, tag: string, value?: string, children: RawNode[] = []): RawNode => ({
  level,
  tag,
  value: value ?? "",
  line: `${level} ${tag}${value ? ` ${value}` : ""}`,
  children,
});

const kids = (n: RawNode, tag: string) => n.children.filter((c) => c.tag === tag);
const kid = (n: RawNode, tag: string) => n.children.find((c) => c.tag === tag);
const pointer = (v: string) => (/^@[^@\s]+@$/.test(v.trim()) ? v.trim() : undefined);

/** A year of a date on its own (12 MAR 1850, 1850, a dual year 1700/01 as its later one): the last one it names. */
function yearIn(s: string): number | undefined {
  let found: number | undefined;
  for (const m of s.matchAll(/(?<![\p{N}])(\d{3,4})(?:\/(\d{1,2}))?(?![\p{N}])/gu)) {
    let y = Number(m[1]);
    if (m[2]) {
      const dual = y - (y % 100) + Number(m[2]);
      y = dual < y ? dual + 100 : dual;
    }
    if (y >= 100) found = y;
  }
  return found;
}

/**
 * The latest year a date may mean (spec 151 A2): a range and a period by their end, "before" by its year, an estimate
 * by its year; "after" bounds nothing from above (undefined), nor does a phrase without a date.
 */
export function latestYear(date: string | undefined): number | undefined {
  const s = (date ?? "").trim().toUpperCase().replace(/@#D[^@]*@\s*/g, "").replace(/\s+/g, " ");
  if (!s || s.startsWith("(")) return undefined;
  const two = /^(?:BET (.+) AND (.+)|FROM (.+) TO (.+))$/.exec(s);
  if (two) return yearIn(two[2] ?? two[4]!);
  if (/^AFT /.test(s)) return undefined;
  const q = /^(?:FROM|TO|BEF|ABT|CAL|EST|INT) (.+)$/.exec(s);
  return yearIn((q ? q[1]! : s).replace(/\(.*$/, ""));
}

/** Facts of a person: every line under the record with a date of its own, but the record's change and strom's marks. */
const OWN_FACT = (tag: string) => tag !== "CHAN" && !tag.startsWith("_");
/** The end of a couple is no date of its start (the app counts its start and its events, never its end). */
const ENDS = new Set(["DIV", "DIVF", "ANUL"]);
/** A death said by any of these, with a date or without (DEAT Y: died). */
const DEATHS = new Set(["DEAT", "BURI", "CREM"]);

/**
 * The living of a file, by their xrefs (spec 151 K1.1): no death, burial or cremation, and the latest year they can
 * have been born — their own facts, their couples' start and events less MIN_MARRIAGE_AGE, their children's bound less
 * MIN_PARENT_AGE through every generation — less than ASSUMED_MAX_AGE years before `currentYear`; unknown: living.
 */
export function livingOf(records: RawNode[], currentYear: number): Set<string> {
  const people = records.filter((r) => r.tag === "INDI" && r.xref);
  const bounds = new Map<string, number>();
  const tighten = (id: string, year: number | undefined): boolean => {
    if (year === undefined) return false;
    const was = bounds.get(id);
    if (was === undefined || year < was) {
      bounds.set(id, year);
      return true;
    }
    return false;
  };
  const dead = new Set<string>();
  for (const p of people) {
    for (const c of p.children) {
      if (DEATHS.has(c.tag)) dead.add(p.xref!);
      if (OWN_FACT(c.tag)) for (const d of kids(c, "DATE")) tighten(p.xref!, latestYear(d.value));
    }
  }
  const parentsOf = new Map<string, string[]>();
  for (const f of records.filter((r) => r.tag === "FAM")) {
    const partners = f.children.filter((c) => c.tag === "HUSB" || c.tag === "WIFE").map((c) => pointer(c.value)).filter((v): v is string => !!v);
    for (const c of f.children) {
      if (!OWN_FACT(c.tag) || ENDS.has(c.tag)) continue;
      for (const d of kids(c, "DATE")) {
        const y = latestYear(d.value);
        if (y !== undefined) for (const p of partners) tighten(p, y - MIN_MARRIAGE_AGE);
      }
    }
    for (const ch of kids(f, "CHIL")) {
      const id = pointer(ch.value);
      if (id) parentsOf.set(id, [...(parentsOf.get(id) ?? []), ...partners]);
    }
  }
  // child → parent until nothing changes; at most once per person (a cycle of parents in broken data ends)
  let changed = true;
  for (let i = 0; i < people.length && changed; i++) {
    changed = false;
    for (const [child, parents] of parentsOf) {
      const b = bounds.get(child);
      if (b === undefined) continue;
      for (const p of parents) if (tighten(p, b - MIN_PARENT_AGE)) changed = true;
    }
  }
  const living = new Set<string>();
  for (const p of people) {
    if (dead.has(p.xref!)) continue;
    const b = bounds.get(p.xref!);
    if (b === undefined || currentYear - b < ASSUMED_MAX_AGE) living.add(p.xref!);
  }
  return living;
}

/** The first letter of a name, as a capital with a dot ("Čeněk" → "Č."); none where it begins with no letter ("?"). */
function initial(name: string): string {
  const first = clipChars(name.trim().normalize("NFC"), 1);
  return /^\p{L}/u.test(first) ? `${first.toLocaleUpperCase()}.` : "";
}

/** The given name and surname of a NAME line: its GIVN and SURN, else the line's "Given /Surname/". */
function nameParts(n: RawNode): { given: string; surname: string } {
  const m = /^([^/]*)(?:\/([^/]*)\/?)?/.exec(n.value) ?? [];
  const givn = kid(n, "GIVN")?.value;
  const surn = kid(n, "SURN")?.value;
  return { given: (givn ?? m[1] ?? "").trim(), surname: (surn ?? m[2] ?? "").trim() };
}

const MONTH = MONTHS.join("|");

/** A date to its years alone ("12 MAR 1950" → "1950", "ABT JUN 1950" → "ABT 1950"), or undefined where none is left. */
export function yearsOnly(date: string): string | undefined {
  const s = date.trim().toUpperCase().replace(/@#D[^@]*@\s*/g, "").replace(/\s+/g, " ");
  const bare = s.replace(new RegExp(`(?:(?<![\\p{L}\\p{N}])\\d{1,2} )?(?<![\\p{L}\\p{N}])(?:${MONTH}) `, "gu"), "");
  if (!/^INT /.test(bare) && !bare.includes("(") && normalizeDate(bare) === bare) return bare;
  const y = yearIn(bare.replace(/\(.*$/, ""));
  return y === undefined ? undefined : String(y);
}

export interface ProtectOptions {
  mode: Exclude<LivingMode, "full">;
  /** The xrefs of the living (livingOf, judged on the whole tree). */
  living: Set<string>;
  /** "Living person" in the research's language. */
  livingLabel: string;
}

/** The facts of a person or a family as a GEDCOM writes them: its events and attributes. */
const FACT_TAGS = new Set([
  "BIRT", "CHR", "BAPM", "DEAT", "BURI", "CREM", "ADOP", "BARM", "BASM", "BLES", "CHRA", "CONF", "FCOM", "ORDN", "NATU", "EMIG",
  "IMMI", "CENS", "PROB", "WILL", "GRAD", "RETI", "EVEN", "FACT", "OCCU", "RELI", "RESI", "EDUC", "NATI", "TITL", "PROP", "DSCR",
  "IDNO", "NCHI", "NMR", "SSN", "CAST", "MARR", "DIV", "DIVF", "ANUL", "ENGA", "MARB", "MARC", "MARL", "MARS",
]);

/**
 * A full GEDCOM file as the mode protects it (spec 151 §2): each living person kept to their name by the mode, their
 * sex and their links in the families (initials: the year of their birth too) — nothing else of them; a couple with a
 * living partner kept to its partners, children and whether they married or divorced (initials: the year of the
 * marriage); no other record points at a living person; a source only the living cite is left out. The dead are as they
 * were. The header says the mode and how many of the living it protects (1 _STROM_PRIVACY, 2 _LIVING) and never ties
 * the file to the research (_STROM_TREE, _STROM_HEAD, _STROM_LINKS, _STROM_ASOF).
 */
export function protectGedcom(text: string, opts: ProtectOptions): { text: string; living: number; left: { events: number; sources: number } } {
  const records = rawRecords(text);
  const living = new Set(records.filter((r) => r.tag === "INDI" && r.xref && opts.living.has(r.xref)).map((r) => r.xref!));
  const citedBy = (rs: RawNode[]) => {
    const out = new Set<string>();
    const walk = (n: RawNode) => {
      for (const c of n.children) {
        if (c.tag === "SOUR" && pointer(c.value)) out.add(pointer(c.value)!);
        walk(c);
      }
    };
    for (const r of rs) if (r.tag !== "SOUR") walk(r);
    return out;
  };
  const citedBefore = citedBy(records);

  /** Lines pointing at a living person, wherever they are — but a family's own partners and children (structure). */
  const unpoint = (n: RawNode, inFamily: boolean) => {
    n.children = n.children.filter((c) => {
      const to = pointer(c.value);
      if (to && living.has(to) && !(inFamily && c.level === 1 && (c.tag === "HUSB" || c.tag === "WIFE" || c.tag === "CHIL"))) return false;
      unpoint(c, false);
      return true;
    });
  };

  // the facts of the living left out, counted as the export counts its facts (the summary of the file)
  const facts = (ns: RawNode[]) => ns.filter((c) => c.level === 1 && FACT_TAGS.has(c.tag)).length;
  let events = 0;

  const person = (r: RawNode): void => {
    const before = facts(r.children);
    const names = kids(r, "NAME");
    const typeOf = (n: RawNode) => kid(n, "TYPE")?.value.trim().toLowerCase();
    const main = names.find((n) => !typeOf(n) || typeOf(n) === "birth") ?? names[0];
    const married = [...names].reverse().find((n) => n !== main && typeOf(n) === "married");
    const out: RawNode[] = [];
    const parts = main ? nameParts(main) : { given: "", surname: "" };
    if (opts.mode === "initials") out.push(node(1, "NAME", `${initial(parts.given)} /${initial(parts.surname)}/`.trim()));
    else if (opts.mode === "surname") out.push(node(1, "NAME", `${opts.livingLabel} /${parts.surname.replace(/\//g, "|")}/`));
    else out.push(node(1, "NAME", `${opts.livingLabel} //`));
    if (opts.mode === "initials" && married) {
      const m = nameParts(married);
      out.push(node(1, "NAME", `${initial(m.given)} /${initial(m.surname)}/`.trim(), [node(2, "TYPE", "married")]));
    }
    for (const c of r.children) {
      if (c.tag === "SEX" || c.tag === "FAMS") out.push(node(1, c.tag, c.value.trim()));
      else if (c.tag === "FAMC") out.push(node(1, "FAMC", c.value.trim(), kids(c, "PEDI").map((p) => node(2, "PEDI", p.value.trim()))));
    }
    if (opts.mode === "initials") {
      const birth = kids(r, "BIRT").find((b) => kid(b, "DATE") && yearsOnly(kid(b, "DATE")!.value));
      if (birth) out.splice(out.findIndex((c) => c.tag === "SEX") + 1 || out.length, 0, node(1, "BIRT", undefined, [node(2, "DATE", yearsOnly(kid(birth, "DATE")!.value))]));
    }
    events += before - facts(out);
    r.children = out;
  };

  const family = (r: RawNode): void => {
    const before = facts(r.children);
    const out: RawNode[] = [];
    let married = false;
    let divorced = false;
    let year: string | undefined;
    for (const c of r.children) {
      if (c.tag === "HUSB" || c.tag === "WIFE") out.push(node(1, c.tag, c.value.trim()));
      else if (c.tag === "CHIL") out.push(node(1, "CHIL", c.value.trim(), c.children.filter((k) => k.tag === "_FREL" || k.tag === "_MREL" || k.tag === "PEDI").map((k) => node(2, k.tag, k.value.trim()))));
      else if (c.tag === "_STAT" || c.tag === "_STROM_NO_COUPLE") out.push(node(1, c.tag, c.value.trim()));
      else if (c.tag === "MARR") {
        married = true;
        const d = kid(c, "DATE");
        if (!year && d) year = yearsOnly(d.value);
      } else if (c.tag === "DIV") divorced = true;
    }
    if (married) out.push(node(1, "MARR", undefined, opts.mode === "initials" && year ? [node(2, "DATE", year)] : []));
    if (divorced) out.push(node(1, "DIV"));
    events += before - facts(out);
    r.children = out;
  };

  for (const r of records) {
    if (r.tag === "INDI" && r.xref && living.has(r.xref)) person(r);
    else if (r.tag === "FAM" && r.children.some((c) => (c.tag === "HUSB" || c.tag === "WIFE") && living.has(pointer(c.value) ?? ""))) family(r);
    unpoint(r, r.tag === "FAM");
  }
  const citedAfter = citedBy(records);
  const kept = records.filter((r) => !(r.tag === "SOUR" && r.xref && citedBefore.has(r.xref) && !citedAfter.has(r.xref)));
  const head = kept.find((r) => r.tag === "HEAD");
  if (head) {
    head.children = head.children.filter((c) => !["_STROM_TREE", "_STROM_HEAD", "_STROM_LINKS", "_STROM_ASOF", "_STROM_PRIVACY"].includes(c.tag));
    const at = head.children.findIndex((c) => c.tag === "SOUR");
    head.children.splice(at + 1, 0, node(1, "_STROM_PRIVACY", opts.mode, [node(2, "_LIVING", String(living.size))]));
  }
  const lines: string[] = [];
  for (const r of kept) emit(r, lines);
  return { text: `${lines.join("\n")}\n`, living: living.size, left: { events, sources: records.length - kept.length } };
}

/** The mode a file says it is protected by (1 _STROM_PRIVACY in its header) and how many of the living — none: a full file. */
export function privacyOf(text: string): { mode: Exclude<LivingMode, "full">; living?: number } | undefined {
  // the header alone: its lines up to the next record
  const rows = text.replace(/^﻿/u, "").split(/\r\n|\r|\n/, 2000);
  const start = rows.findIndex((l) => /^\s*0\s+HEAD\b/u.test(l));
  if (start < 0) return undefined;
  let mode: LivingMode | undefined;
  let living: number | undefined;
  for (let i = start + 1; i < rows.length && !/^\s*0\s/u.test(rows[i]!); i++) {
    const m = /^\s*1\s+_STROM_PRIVACY(?:\s+(\S+))?/u.exec(rows[i]!);
    if (m) {
      mode = livingModeOf(m[1]) ?? "hidden";
      const n = /^\s*2\s+_LIVING\s+(\d+)/u.exec(rows[i + 1] ?? "");
      if (n) living = Number(n[1]);
    }
  }
  if (!mode || mode === "full") return undefined;
  return { mode, ...(living !== undefined ? { living } : {}) };
}

/**
 * The same of a family tree of the Strom app in JSON: its field privacy (a mode, or { mode, living }) — none, false or
 * full: a full file.
 */
export function jsonPrivacyOf(data: unknown): { mode: Exclude<LivingMode, "full">; living?: number } | undefined {
  if (!data || typeof data !== "object" || Array.isArray(data)) return undefined;
  const p = (data as Record<string, unknown>).privacy;
  if (p === undefined || p === null || p === false) return undefined;
  const said = typeof p === "object" ? (p as Record<string, unknown>) : { mode: p };
  const word = typeof said.mode === "string" ? said.mode : said.mode === true ? "hidden" : undefined;
  const mode = word === undefined ? "hidden" : (livingModeOf(word) ?? "hidden");
  if (mode === "full") return undefined;
  const n = Number(said.living);
  return { mode, ...(Number.isInteger(n) && n >= 0 && said.living !== undefined ? { living: n } : {}) };
}

/** Of a GEDCOM's text or a JSON's, as a file of the family tree is read. */
export function treeFilePrivacyOf(text: string): { mode: Exclude<LivingMode, "full">; living?: number } | undefined {
  if (/^﻿?\s*[{[]/u.test(text)) {
    try {
      return jsonPrivacyOf(JSON.parse(text));
    } catch {
      return undefined;
    }
  }
  return privacyOf(text);
}
