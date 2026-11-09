// GEDCOM 5.5.1 validator, independent of the exporter: it reads the text as
// any importer would. Runs after every export and on any file:
// `strom gedcom validate <file>`.

import { normalizeDate } from "../core/gdate.ts";
import { isGedcomAge } from "../core/age.ts";
import { MAX_LINE_BYTES } from "./lines.ts";

export interface GedFinding {
  level: "error" | "warn";
  line: number;
  message: string;
}

const LINE = /^(\d{1,2}) (?:(@[^@ ]+@) )?([A-Za-z0-9_]+)(?: (.*))?$/;

const EVENT_DETAIL = ["TYPE", "DATE", "PLAC", "AGE", "SOUR", "NOTE", "ASSO", "_WITN", "CAUS", "ADDR", "AGNC", "RELI", "OBJE", "HUSB", "WIFE", "_STROM_STATUS", "_STROM_ORIGIN", "_STROM_WAS", "_STROM_EID", "_STROM_CONFIRMED", "_STROM_VERIFY", "_STROM_CHECKED"];
const INDI_EVENTS = [
  "BIRT", "DEAT", "BAPM", "CHR", "CHRA", "CONF", "FCOM", "BARM", "BASM", "ORDN", "EDUC", "GRAD", "OCCU", "RESI", "EMIG", "IMMI",
  "NATU", "RELI", "TITL", "NATI", "ADOP", "WILL", "PROB", "BURI", "CREM", "CENS", "EVEN", "RETI", "BLES", "CAST", "DSCR", "IDNO",
  "NCHI", "NMR", "PROP", "SSN", "FACT",
];
const FAM_EVENTS = ["MARR", "DIV", "MARB", "MARC", "MARL", "MARS", "ANUL", "DIVF", "ENGA", "CENS", "RESI", "EVEN", "NCHI"];

/** The lines of a record's IDs in a family tree it came from (spec 066 K3.2). */
const ORIGINAL_ID_TAGS = ["_XREF", "_UID", "UID", "RIN", "EXID", "_FSFTID", "AFN"];

/** Allowed child tags by parent context ("INDI", "INDI.BIRT", …). CONC/CONT are allowed under anything with text. */
const CHILDREN: Record<string, string[]> = {
  HEAD: ["SOUR", "DEST", "DATE", "SUBM", "SUBN", "FILE", "COPR", "GEDC", "CHAR", "LANG", "PLAC", "NOTE", "_STROM_TREE", "_STROM_HEAD", "_STROM_LINKS", "_STROM_ASOF", "_STROM_MODE", "_STROM_LINES", "_STROM_IMPORT"],
  // an import of a family tree the values came from (the Strom profile, APP_SHOWS_ORIGIN)
  "HEAD._STROM_IMPORT": ["SOUR", "VERS", "DATE", "_AT", "FILE", "_SHA"],
  "HEAD.SOUR": ["VERS", "NAME", "CORP", "DATA"],
  "HEAD._STROM_LINKS": ["_SCHEME"],
  "HEAD.GEDC": ["VERS", "FORM"],
  "HEAD.DATE": ["TIME"],
  INDI: ["NAME", "SEX", "FAMC", "FAMS", "NOTE", "SOUR", "REFN", "ASSO", "ALIA", "OBJE", "RESN", "RIN", "CHAN", "_STORY", "_STROM_CONFLICT", "_STROM_HYPO", "_STROM_SEARCHED", "_STROM_EDGE", "_STROM_ISLAND", "_STROM_LINE", "_STROM_SEX_ORIGIN", "_STROM_IMPORT", "_STROM_XID", ...INDI_EVENTS],
  // the IDs a person had in a family tree it came from (or not: _STROM_XID), spec 066 K3.2
  "INDI._STROM_IMPORT": ORIGINAL_ID_TAGS,
  "INDI._STROM_XID": ORIGINAL_ID_TAGS,
  "INDI._STROM_SEX_ORIGIN": ["_STROM_WAS"],
  "INDI._STROM_CONFLICT": ["TYPE", "TITL", "STAT", "_STROM_KIND", "_STROM_TAKE", "VAL", "DECI"],
  // who decided a hypothesis, why and when (APP_SHOWS_HYPOTHESIS_DECIDER: 2 _BY agent, 2 DECI, 2 _AT)
  "INDI._STROM_HYPO": ["TITL", "STAT", "_CHOSEN", "NOTE", "_VAR", "_BY", "DECI", "_AT"],
  // what a variant of a hypothesis would connect (the Strom profile)
  _VAR: ["TITL", "_LINK", "_INTREE", "SOUR"],
  _LINK: ["_PERS", "_FAM", "_PAR"],
  _INTREE: ["_PERS", "_FAM"],
  "INDI._STROM_SEARCHED": ["TITL", "DATE", "RESN", "_AT"],
  "INDI._STROM_EDGE": ["_SCOPE", "_RESEARCH", "_GEN", "_END", "_NEXT", "_EST", "DATE", "_RECORDS", "_BOOK", "_COVERED", "_NORECORDS", "_TASK", "_TRIED", "_HYPO", "_CONFLICT", "_SEARCHES", "_SESSIONS", "_LAST"],
  "INDI._STROM_ISLAND": ["_HYPO", "_HELD"],
  // one join of a hypothesis at the edge: the variants that name the person, the family off the tree it belongs to
  "_STROM_EDGE._JOIN": ["_VAR", "_ISLAND", "_HELD"],
  // a value of a conflict the app decides by side: its side, a sex as M, F or U
  _STROM_VALUE: ["SOUR", "_STROM_SIDE", "_STROM_RAW"],
  "INDI.NAME": ["TYPE", "GIVN", "SURN", "NPFX", "NSFX", "NICK", "SPFX", "SOUR", "NOTE", "_STROM_PRIMARY", "_STROM_ORIGIN", "_STROM_WAS"],
  // a family tree's value changed since: its import, the part, the key to put it back
  _STROM_WAS: ["_STROM_IMPORT", "_PART", "_REF"],
  // a fact waiting for its verification against the original: its task's place in the queue; the last verification
  // by an agent: when, why it stays (kept), two readers (APP_SHOWS_VERIFY)
  _STROM_VERIFY: ["_POS"],
  // the mark of what the fact says (POST /facts/confirm gives it back)
  _STROM_EID: ["_TXT"],
  _STROM_CHECKED: ["DATE", "_WHY", "_READERS"],
  "INDI.FAMC": ["PEDI", "NOTE"],
  "INDI.FAMS": ["NOTE"],
  "FAM.CHIL": ["_FREL", "_MREL"],
  "INDI.ASSO": ["RELA", "SOUR", "NOTE"],
  FAM: ["HUSB", "WIFE", "CHIL", "NOTE", "SOUR", "REFN", "OBJE", "RIN", "CHAN", "_STORY", "_STAT", "_STROM_NO_COUPLE", "_STROM_IMPORT", "_STROM_XID", ...FAM_EVENTS],
  "FAM._STROM_IMPORT": ORIGINAL_ID_TAGS,
  "FAM._STROM_XID": ORIGINAL_ID_TAGS,
  // the Strom profile also writes PAGE on the record: where in the book the source is (the Strom app's reference)
  // and WWW: the page of its scan in the online archive (the app links it)
  SOUR: ["TITL", "AUTH", "ABBR", "PUBL", "TEXT", "REPO", "NOTE", "REFN", "DATA", "OBJE", "RIN", "CHAN", "_STROM_READ", "_STROM_VERIFIED", "_STROM_READING", "_STROM_IMG_OMITTED", "_STROM_ORIG"],
  "SOUR._STROM_READING": ["_STROM_ENTRY"],
  "SOUR._STROM_READ": ["_CONF", "_TXT"],
  "SOUR._STROM_IMG_OMITTED": ["_STROM_CLIP"],
  "SOUR.REPO": ["CALN", "NOTE"],
  REPO: ["NAME", "ADDR", "NOTE", "REFN", "RIN", "CHAN"],
  SUBM: ["NAME", "ADDR", "LANG", "NOTE", "RIN", "CHAN"],
  NOTE: ["SOUR", "REFN", "RIN", "CHAN"],
  EVENT: EVENT_DETAIL,
  CITATION: ["PAGE", "QUAY", "NOTE", "DATA", "EVEN"],
  "CITATION.DATA": ["DATE", "TEXT"],
  PLAC: ["MAP", "FORM", "NOTE", "_STROM_PLACE"],
  // the research's place record (the Strom profile, APP_READS_PLACE_RECORDS)
  _STROM_PLACE: ["NAME", "MAP", "_STROM_JUR", "_STROM_IN", "_STROM_BY", "_STROM_AT", "_STROM_WHY", "_STROM_SRC", "_STROM_VERIFIED", "_STROM_UNLOCATED"],
  "_STROM_PLACE.NAME": ["LANG", "DATE", "TYPE"],
  "_STROM_PLACE._STROM_JUR": ["DATE"],
  "_STROM_PLACE._STROM_SRC": ["WWW"],
  "_STROM_PLACE._STROM_UNLOCATED": ["_STROM_NEEDS"],
  MAP: ["LATI", "LONG"],
  "EVENT.ASSO": ["RELA", "NOTE"],
  "EVENT.HUSB": ["AGE"],
  "EVENT.WIFE": ["AGE"],
  _STORY: ["TYPE", "TITL", "STAT", "TEXT", "DATA", "NOTE", "SOUR", "_DRAFT"],
  _WITN: ["RELA", "NOTE"],
  ADDR: ["CONT", "ADR1", "ADR2", "ADR3", "CITY", "STAE", "POST", "CTRY"],
};

/** Values the Strom app joins from CONC lines though GEDCOM 5.5.1 gives them none: a long place, name, label (its file). */
const JOINED_TAGS = new Set(["PLAC", "NAME", "_WITN", "PAGE", "TYPE", "SOUR", "REFN", "AGE", "_STROM_WAS"]);
const TEXT_TAGS = new Set(["_STROM_WHY", "_WHY", "_STROM_SRC", "_STROM_UNLOCATED", "_STROM_NEEDS", "NOTE", "TEXT", "TITL", "PAGE", "AUTH", "PUBL", "_STORY", "DATA", "COPR", "ADDR", "CAUS", "FILE", "_URL", "WWW", "VAL", "DECI"]);
const EXTENSIONS = new Set([
  "_STORY", "_WITN", "_FREL", "_MREL", "_STROM_KIND", "_URL", "_STROM_TREE", "_STROM_HEAD", "_STROM_LINKS", "_STROM_CLIP",
  "_STROM_ASOF", "_SCHEME", "_STROM_CONFLICT", "_STROM_TAKE", "_STROM_SIDE", "_STROM_RAW", "_STROM_HYPO", "_STROM_SEARCHED", "_AT", "_BY",
  // where the tree ends (_STROM_EDGE) and the families nothing links to it (_STROM_ISLAND), with their parts
  "_STROM_EDGE", "_STROM_ISLAND", "_SCOPE", "_RESEARCH", "_GEN", "_END", "_NEXT", "_EST", "_BASIS", "_RECORDS", "_BOOK", "_ACCESS", "_WEAK",
  "_COVERED", "_NORECORDS", "_TASK", "_LEVEL", "_POS", "_HELD", "_UNTIL", "_TRIED", "_HYPO", "_JOIN", "_ISLAND", "_TEST", "_CONFLICT",
  "_SEARCHES", "_SESSIONS", "_COST", "_PARTIAL", "_LAST",
  // the new version of an approved story, waiting for the user
  "_DRAFT",
  // what a variant of a hypothesis would connect, and what of it the tree records already
  "_VAR", "_LINK", "_PERS", "_FAM", "_PAR", "_CHOSEN", "_INTREE",
  // a source's excerpts the file leaves out, and why
  "_STROM_IMG_OMITTED",
  // the name a person is shown by; a couple's state; parents who are no couple; an archive
  "_STROM_PRIMARY", "_STAT", "_STROM_NO_COUPLE", "_STROM_MODE",
  // who read a source, the user's verification, the reading it is an entry of; how sure a fact is
  "_STROM_READ", "_STROM_VERIFIED", "_STROM_READING", "_STROM_ENTRY", "_STROM_STATUS",
  // the wording of a source's transcript, and the day the user confirmed it (under _STROM_READ)
  "_TXT", "_CONF",
  // a source the research can read again from its original here
  "_STROM_ORIG",
  // an excerpt's original by its content, and how its picture lies
  "_STROM_SHA", "_STROM_ORIENT",
  // the bounds of a lineage the person set (on a person), and the header's mark that the file says them
  "_STROM_LINE", "_STROM_LINES",
  // the research's place records and each fact's place pointing to its record
  "_STROM_PLACE", "_STROM_JUR", "_STROM_IN", "_STROM_BY", "_STROM_AT", "_STROM_WHY", "_STROM_SRC", "_STROM_UNLOCATED", "_STROM_NEEDS",
  // where a value came from, the family tree's value changed since, the imports in the header
  "_STROM_ORIGIN", "_STROM_SEX_ORIGIN", "_STROM_WAS", "_STROM_IMPORT", "_PART", "_REF", "_SHA",
  // the IDs of a family tree a record came from (or not), its xref there and the ID lines other programs write
  "_STROM_XID", "_XREF", "_UID", "_FSFTID",
  // the verification of a fact against its originals: its ID, the user's confirmation, how it waits, the last result
  "_STROM_EID", "_STROM_CONFIRMED", "_STROM_VERIFY", "_STROM_CHECKED", "_WHY", "_READERS",
]);

/** Context of the children of the last tag in `anc` (the ancestors of a line). */
function contextOf(anc: string[]): string | undefined {
  const record = anc[0]!;
  const parent = anc[anc.length - 1]!;
  const depth = anc.length; // level of the child line
  if (depth === 1) return record;
  if (parent === "SOUR" && record !== "HEAD" && !(record === "SOUR" && depth === 1)) return "CITATION";
  if (parent === "PLAC") return "PLAC";
  if (parent === "MAP") return "MAP";
  if (parent === "_STORY") return "_STORY";
  if (parent === "_WITN") return "_WITN";
  if (parent === "_VAR" && anc[1] === "_STROM_HYPO") return "_VAR";
  if (parent === "_LINK" && anc[2] === "_VAR") return "_LINK";
  if (parent === "_INTREE" && anc[2] === "_VAR") return "_INTREE";
  if (parent === "_JOIN" && anc[1] === "_STROM_EDGE" && anc[2] === "_HYPO") return "_STROM_EDGE._JOIN";
  if (parent === "ADDR") return "ADDR";
  if (parent === "_STROM_WAS") return "_STROM_WAS";
  if ((parent === "_STROM_VERIFY" || parent === "_STROM_CHECKED") && depth === 3) return parent;
  if (parent === "DATA" && anc[depth - 2] === "SOUR") return "CITATION.DATA";
  if (depth === 2) {
    if (record === "INDI" && INDI_EVENTS.includes(parent)) return "EVENT";
    if (record === "FAM" && FAM_EVENTS.includes(parent)) return "EVENT";
    return `${record}.${parent}`;
  }
  if (depth === 3 && parent === "ASSO") return "EVENT.ASSO";
  if (depth === 3 && (parent === "VAL" || parent === "DECI") && anc[1] === "_STROM_CONFLICT") return "_STROM_VALUE";
  if (depth === 3 && (parent === "HUSB" || parent === "WIFE") && record === "FAM") return `EVENT.${parent}`;
  return undefined;
}

export function validateGedcom(text: string, opts: { strict?: boolean } = {}): GedFinding[] {
  const out: GedFinding[] = [];
  const add = (level: GedFinding["level"], line: number, message: string) => out.push({ level, line, message });
  if (text.charCodeAt(0) === 0xfeff) add("warn", 1, "file starts with a byte-order mark");
  const rows = text.replace(/\r\n?/g, "\n").replace(/\n$/, "").split("\n");
  const defined = new Map<string, string>();
  const pointers: { xref: string; line: number; tag: string }[] = [];
  const stack: string[] = [];
  let prevLevel = -1;
  let charDeclared = false;
  const headTags = new Set<string>();

  rows.forEach((raw, i) => {
    const n = i + 1;
    if (Buffer.byteLength(raw, "utf8") > MAX_LINE_BYTES) add("error", n, `line is ${Buffer.byteLength(raw, "utf8")} bytes (max ${MAX_LINE_BYTES})`);
    const m = LINE.exec(raw);
    if (!m) return void add("error", n, `not a GEDCOM line: ${raw.slice(0, 60)}`);
    const level = Number(m[1]);
    const xref = m[2];
    const tag = m[3]!;
    const value = m[4];
    if (level > prevLevel + 1) add("error", n, `level jumps from ${prevLevel} to ${level}`);
    prevLevel = level;
    stack.length = level;
    if (level === 0) {
      if (xref) {
        if (defined.has(xref)) add("error", n, `${xref} is defined twice`);
        defined.set(xref, tag);
      }
      if (!["HEAD", "TRLR", "INDI", "FAM", "SOUR", "REPO", "NOTE", "SUBM", "SUBN", "OBJE"].includes(tag) && !tag.startsWith("_"))
        add("error", n, `unknown record type ${tag}`);
    } else {
      const ctx = contextOf(stack.slice(0, level));
      const allowed = ctx ? CHILDREN[ctx] : undefined;
      const parentTag = stack[level - 1]!;
      if (tag === "CONC" || tag === "CONT") {
        if (!TEXT_TAGS.has(parentTag) && !["CONC", "CONT"].includes(parentTag) && (opts.strict || !JOINED_TAGS.has(parentTag))) add("warn", n, `${tag} under ${parentTag}`);
      } else if (allowed && !allowed.includes(tag) && !(ctx === "SOUR" && (tag === "PAGE" || tag === "WWW") && !opts.strict)) add(tag.startsWith("_") ? "warn" : "error", n, `${tag} is not expected under ${ctx}`);
    }
    stack[level] = tag;
    if (tag.startsWith("_") && (opts.strict || !EXTENSIONS.has(tag))) add(opts.strict ? "error" : "warn", n, `non-standard tag ${tag}`);
    if (value !== undefined && value !== value.trim() && tag !== "CONC") add("warn", n, `value of ${tag} starts or ends with a space`);
    if (tag === "CONC" && value !== undefined && (value.startsWith(" ") || value.endsWith(" "))) add("warn", n, "CONC value starts or ends with a space (readers may trim it)");
    // _XREF: a record's xref in another file (spec 066 K3.2) — the shape of a pointer, pointing at nothing here
    if (value && /^@[^@ ]+@$/.test(value) && tag !== "CONC" && tag !== "CONT" && tag !== "NOTE") {
      if (tag !== "_XREF") pointers.push({ xref: value, line: n, tag });
    }
    else if (value && value.replace(/@@/g, "").includes("@") && !/^@#D[A-Z ]+@/.test(value))
      add("error", n, `${tag}: a literal "@" must be written "@@" (otherwise readers take it for a pointer)`);
    if (tag === "AGE" && value !== undefined && !isGedcomAge(value)) add("error", n, `AGE "${value}" is not a GEDCOM age (27y, 27y 3m, <1y, INFANT, STILLBORN, CHILD)`);
    if (tag === "AGE" && stack[0] === "FAM" && level === 2) add("error", n, "AGE of a family event belongs under HUSB or WIFE");
    if (opts.strict && tag === "ASSO" && level > 1) add("error", n, "ASSO under an event is GEDCOM 7; in 5.5.1 it belongs to the individual (1 ASSO)");
    if (level === 1 && stack[0] === "HEAD") headTags.add(tag);
    if (tag === "CHAR" && level === 1) {
      charDeclared = true;
      if (value !== "UTF-8") add("error", n, `CHAR ${value} — Strom Research writes UTF-8`);
    }
    // a header's dates are the files' own (an import's file as its program wrote it)
    if (tag === "DATE" && value && stack[0] !== "HEAD" && normalizeDate(value) !== value) add("error", n, `invalid date "${value}"`);
    if (tag === "SEX" && value && !["M", "F", "U"].includes(value)) add("error", n, `SEX must be M, F or U, not "${value}"`);
    if (tag === "QUAY" && value && !/^[0-3]$/.test(value)) add("error", n, `QUAY must be 0–3, not "${value}"`);
    if (tag === "PEDI" && value && !["adopted", "birth", "foster", "sealing"].includes(value))
      add(opts.strict ? "error" : "warn", n, `PEDI "${value}" is not GEDCOM 5.5.1 (adopted, birth, foster, sealing)`);
    if (tag === "NAME" && level === 1 && stack[0] === "INDI" && value && (value.split("/").length - 1) % 2 !== 0) add("error", n, `NAME "${value}": unbalanced surname slashes`);
  });

  if (rows[0] !== "0 HEAD") add("error", 1, "file must start with 0 HEAD");
  if (rows[rows.length - 1] !== "0 TRLR") add("error", rows.length, "file must end with 0 TRLR");
  if (!charDeclared) add("error", 1, "HEAD has no 1 CHAR UTF-8");
  for (const t of ["SOUR", "GEDC", "SUBM"]) if (!headTags.has(t)) add(opts.strict ? "error" : "warn", 1, `HEAD has no ${t} (required by GEDCOM 5.5.1)`);
  if (headTags.has("SUBM") && ![...defined.values()].includes("SUBM")) add(opts.strict ? "error" : "warn", 1, "the SUBM record named in HEAD is missing");
  for (const p of pointers) {
    const target = defined.get(p.xref);
    if (!target) add("error", p.line, `${p.tag} points to ${p.xref}, which is not defined`);
  }
  return out;
}

export function hasGedErrors(findings: GedFinding[]): boolean {
  return findings.some((f) => f.level === "error");
}
