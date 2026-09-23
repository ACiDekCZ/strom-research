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

const EVENT_DETAIL = ["TYPE", "DATE", "PLAC", "AGE", "SOUR", "NOTE", "ASSO", "_WITN", "CAUS", "ADDR", "AGNC", "RELI", "OBJE", "HUSB", "WIFE"];
const INDI_EVENTS = [
  "BIRT", "DEAT", "BAPM", "CHR", "CHRA", "CONF", "FCOM", "BARM", "BASM", "ORDN", "EDUC", "GRAD", "OCCU", "RESI", "EMIG", "IMMI",
  "NATU", "RELI", "TITL", "NATI", "ADOP", "WILL", "PROB", "BURI", "CREM", "CENS", "EVEN", "RETI", "BLES", "CAST", "DSCR", "IDNO",
  "NCHI", "NMR", "PROP", "SSN", "FACT",
];
const FAM_EVENTS = ["MARR", "DIV", "MARB", "MARC", "MARL", "MARS", "ANUL", "DIVF", "ENGA", "CENS", "EVEN", "NCHI"];

/** Allowed child tags by parent context ("INDI", "INDI.BIRT", …). CONC/CONT are allowed under anything with text. */
const CHILDREN: Record<string, string[]> = {
  HEAD: ["SOUR", "DEST", "DATE", "SUBM", "SUBN", "FILE", "COPR", "GEDC", "CHAR", "LANG", "PLAC", "NOTE"],
  "HEAD.SOUR": ["VERS", "NAME", "CORP", "DATA"],
  "HEAD.GEDC": ["VERS", "FORM"],
  "HEAD.DATE": ["TIME"],
  INDI: ["NAME", "SEX", "FAMC", "FAMS", "NOTE", "SOUR", "REFN", "ASSO", "ALIA", "OBJE", "RESN", "RIN", "CHAN", "_STORY", ...INDI_EVENTS],
  "INDI.NAME": ["TYPE", "GIVN", "SURN", "NPFX", "NSFX", "NICK", "SPFX", "SOUR", "NOTE"],
  "INDI.FAMC": ["PEDI", "NOTE"],
  "INDI.FAMS": ["NOTE"],
  "FAM.CHIL": ["_FREL", "_MREL"],
  "INDI.ASSO": ["RELA", "SOUR", "NOTE"],
  FAM: ["HUSB", "WIFE", "CHIL", "NOTE", "SOUR", "REFN", "OBJE", "RIN", "CHAN", "_STORY", ...FAM_EVENTS],
  SOUR: ["TITL", "AUTH", "ABBR", "PUBL", "TEXT", "REPO", "NOTE", "REFN", "DATA", "OBJE", "RIN", "CHAN"],
  "SOUR.REPO": ["CALN", "NOTE"],
  REPO: ["NAME", "ADDR", "NOTE", "REFN", "RIN", "CHAN"],
  SUBM: ["NAME", "ADDR", "LANG", "NOTE", "RIN", "CHAN"],
  NOTE: ["SOUR", "REFN", "RIN", "CHAN"],
  EVENT: EVENT_DETAIL,
  CITATION: ["PAGE", "QUAY", "NOTE", "DATA", "EVEN"],
  "CITATION.DATA": ["DATE", "TEXT"],
  PLAC: ["MAP", "FORM", "NOTE"],
  MAP: ["LATI", "LONG"],
  "EVENT.ASSO": ["RELA", "NOTE"],
  "EVENT.HUSB": ["AGE"],
  "EVENT.WIFE": ["AGE"],
  _STORY: ["TYPE", "TITL", "STAT", "TEXT", "DATA", "NOTE"],
  _WITN: ["RELA", "NOTE"],
  ADDR: ["CONT", "ADR1", "ADR2", "ADR3", "CITY", "STAE", "POST", "CTRY"],
};

const TEXT_TAGS = new Set(["NOTE", "TEXT", "TITL", "PAGE", "AUTH", "PUBL", "_STORY", "DATA", "COPR", "ADDR", "CAUS"]);
const EXTENSIONS = new Set(["_STORY", "_WITN", "_FREL", "_MREL"]);

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
  if (parent === "ADDR") return "ADDR";
  if (parent === "DATA" && anc[depth - 2] === "SOUR") return "CITATION.DATA";
  if (depth === 2) {
    if (record === "INDI" && INDI_EVENTS.includes(parent)) return "EVENT";
    if (record === "FAM" && FAM_EVENTS.includes(parent)) return "EVENT";
    return `${record}.${parent}`;
  }
  if (depth === 3 && parent === "ASSO") return "EVENT.ASSO";
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
        if (!TEXT_TAGS.has(parentTag) && !["CONC", "CONT"].includes(parentTag)) add("warn", n, `${tag} under ${parentTag}`);
      } else if (allowed && !allowed.includes(tag)) add(tag.startsWith("_") ? "warn" : "error", n, `${tag} is not expected under ${ctx}`);
    }
    stack[level] = tag;
    if (tag.startsWith("_") && (opts.strict || !EXTENSIONS.has(tag))) add(opts.strict ? "error" : "warn", n, `non-standard tag ${tag}`);
    if (value !== undefined && value !== value.trim() && tag !== "CONC") add("warn", n, `value of ${tag} starts or ends with a space`);
    if (tag === "CONC" && value !== undefined && (value.startsWith(" ") || value.endsWith(" "))) add("warn", n, "CONC value starts or ends with a space (readers may trim it)");
    if (value && /^@[^@ ]+@$/.test(value) && tag !== "CONC" && tag !== "CONT" && tag !== "NOTE") pointers.push({ xref: value, line: n, tag });
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
    if (tag === "DATE" && value && stack[level - 1] !== "HEAD" && normalizeDate(value) !== value) add("error", n, `invalid date "${value}"`);
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
