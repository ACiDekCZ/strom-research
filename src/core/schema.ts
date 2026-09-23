// Declarative field rules for record types. Used for write-time validation
// and by `strom check` (including references between records).

import {
  ACCESS,
  AUTOMATION,
  INPUT_KINDS,
  JURISDICTIONS,
  LESSON_MAX,
  LESSON_SCOPES,
  SEARCH_METHODS,
  SEARCH_RESULTS,
  SOURCE_KINDS,
  TASK_LEVELS,
  TASK_STATES,
  type RecordType,
} from "./model.ts";
import { normalizeDate } from "./gdate.ts";

export type Spec =
  | { t: "string"; req?: boolean; enum?: readonly string[]; max?: number; date?: boolean }
  | { t: "number"; req?: boolean; min?: number; max?: number; int?: boolean }
  | { t: "ref"; req?: boolean; to: RecordType | RecordType[] }
  | { t: "refs"; req?: boolean; to: RecordType | RecordType[]; min?: number }
  | { t: "strings"; req?: boolean; min?: number }
  | { t: "array"; req?: boolean; of: Record<string, Spec>; min?: number }
  | { t: "object"; req?: boolean; of: Record<string, Spec> }
  | { t: "any" };

const S = (extra: Partial<{ req: boolean; enum: readonly string[]; max: number; date: boolean }> = {}): Spec => ({ t: "string", ...extra });
const R = (to: RecordType | RecordType[], req = false): Spec => ({ t: "ref", to, req });
const RS = (to: RecordType | RecordType[], min = 0): Spec => ({ t: "refs", to, req: true, min });
/** A fraction of an image (0–1). */
const F: Spec = { t: "number", req: true, min: 0, max: 1 };

const ANY_SUBJECT: RecordType[] = ["person", "family", "place", "recordset", "repository", "source", "research", "input"];
/** A task can also be about a conflict or a hypothesis: the work that decides it. */
const TASK_SUBJECT: RecordType[] = [...ANY_SUBJECT, "conflict", "hypothesis"];

export const SCHEMAS: Partial<Record<RecordType, Record<string, Spec>>> = {
  source: {
    kind: S({ req: true, enum: SOURCE_KINDS }),
    title: S({ req: true, max: 300 }),
    recordset: R("recordset"),
    repository: R("repository"),
    input: R("input"),
    locator: S({ max: 300 }),
    date: S({ date: true }),
    transcript: S(),
    translation: S(),
    language: S(),
    information: S({ req: true, enum: ["primary", "secondary", "unknown"] }),
    form: S({ req: true, enum: ["original", "derivative", "authored"] }),
    url: S(),
    accessed: S(),
    media: { t: "refs", to: "media" },
  },
  repository: {
    name: S({ req: true, max: 200 }),
    country: S(),
    region: S(),
    url: S(),
    terms: S({ max: 1000 }),
    automation: S({ req: true, enum: AUTOMATION }),
  },
  recordset: {
    title: S({ req: true, max: 300 }),
    repository: R("repository"),
    callNumber: S(),
    kinds: { t: "strings", req: true },
    places: { t: "strings", req: true },
    years: S(),
    access: S({ req: true, enum: ACCESS }),
    url: S(),
    images: { t: "number", int: true, min: 1 },
    calibration: { t: "array", req: true, of: { image: { t: "number", req: true, int: true, min: 1 }, page: S({ req: true }) } },
    layout: S({ max: 1000 }),
  },
  place: {
    names: { t: "array", req: true, min: 1, of: { name: S({ req: true }), lang: S(), from: { t: "number", int: true }, to: { t: "number", int: true } } },
    kind: S(),
    coords: { t: "object", of: { lat: { t: "number", req: true, min: -90, max: 90 }, lon: { t: "number", req: true, min: -180, max: 180 } } },
    parent: R("place"),
    jurisdictions: {
      t: "array",
      req: true,
      of: {
        kind: S({ req: true, enum: JURISDICTIONS }),
        name: S({ req: true }),
        from: { t: "number", int: true },
        to: { t: "number", int: true },
        repository: R("repository"),
        recordsets: RS("recordset"),
      },
    },
  },
  search: {
    question: S({ req: true, max: 300 }),
    recordsets: RS("recordset"),
    scope: { t: "object", req: true, of: { years: S(), surnames: { t: "strings" }, places: { t: "strings" }, pages: S() } },
    method: S({ req: true, enum: SEARCH_METHODS }),
    result: S({ req: true, enum: SEARCH_RESULTS }),
    findings: RS("source"),
    task: R("task"),
    by: S({ req: true, enum: ["main", "reader", "user"] }),
  },
  task: {
    level: S({ req: true, enum: TASK_LEVELS }),
    priority: { t: "number", req: true, int: true, min: 1, max: 5 },
    what: S({ req: true, max: 200 }),
    where: { t: "strings", req: true, min: 1 },
    why: S({ req: true, max: 1000 }),
    doneWhen: S({ req: true, max: 500 }),
    subject: RS(TASK_SUBJECT),
    research: R("research"),
    state: S({ req: true, enum: TASK_STATES }),
    parkedUntil: S(),
    waitingOn: S(),
    awaits: { t: "object", of: { recordset: R("recordset", true), images: S({ req: true, max: 200 }), folder: S({ req: true, max: 200 }) } },
    result: S({ max: 1000 }),
    produced: { t: "strings" },
    origin: S({ req: true }),
  },
  conflict: {
    title: S({ req: true, max: 200 }),
    subject: RS(ANY_SUBJECT, 1),
    claims: { t: "array", req: true, min: 2, of: { source: R("source"), value: S({ req: true, max: 500 }), note: S({ max: 500 }) } },
    state: S({ req: true, enum: ["open", "resolved"] }),
    resolution: S({ max: 500 }),
    reasoning: S({ max: 2000 }),
  },
  hypothesis: {
    question: S({ req: true, max: 300 }),
    subject: RS(ANY_SUBJECT, 1),
    variants: {
      t: "array",
      req: true,
      min: 2,
      of: { label: S({ req: true, max: 20 }), claim: S({ req: true, max: 500 }), support: { t: "strings", req: true }, against: { t: "strings", req: true } },
    },
    state: S({ req: true, enum: ["open", "decided", "abandoned"] }),
    decision: S({ max: 1000 }),
  },
  lesson: {
    scope: S({ req: true, enum: LESSON_SCOPES }),
    target: R(["repository", "recordset", "place"]),
    rule: S({ req: true, max: LESSON_MAX }),
    detail: S({ max: 2000 }),
  },
  session: {
    task: R("task"),
    research: R("research"),
    state: S({ req: true, enum: ["open", "closed", "interrupted"] }),
    runner: S(),
    worker: S(),
    agent: S(),
    endedBy: S({ enum: ["user", "run", "chat", "agent"] }),
    started: S({ req: true }),
    ended: S(),
    summary: S({ max: 2000 }),
    next: S({ max: 1000 }),
    metrics: { t: "any" },
  },
  input: {
    name: S({ req: true }),
    file: S(),
    text: S(),
    sha: S(),
    size: { t: "number", int: true, min: 0 },
    mime: S(),
    from: S(),
    kind: S({ req: true, enum: INPUT_KINDS }),
    state: S({ req: true, enum: ["new", "processed", "skipped"] }),
    source: R("source"),
    imported: { t: "any" },
  },
  media: {
    sha: S({ req: true }),
    file: S({ req: true }),
    mime: S({ req: true }),
    size: { t: "number", req: true, int: true, min: 0 },
    width: { t: "number", int: true, min: 1 },
    height: { t: "number", int: true, min: 1 },
    recordset: R("recordset"),
    image: { t: "number", int: true, min: 0 },
    part: { t: "object", of: { x: F, y: F, w: F, h: F } },
    page: S({ max: 100 }),
    url: S(),
    from: S(),
    fetched: { t: "object", of: { connector: S({ req: true, max: 100 }), book: S({ req: true, max: 300 }), via: S({ enum: ["browser"] }) } },
    accessed: S(),
  },
};

export interface SpecProblem {
  path: string;
  message: string;
}

export interface RefUse {
  path: string;
  id: string;
  to: RecordType[];
}

function prefixOk(id: string, to: RecordType[], prefixes: Record<string, string>): boolean {
  return to.some((t) => id.startsWith(prefixes[t]!) && /^[A-Z]\d{4,}$/.test(id));
}

/** Validate fields against a spec; collect references for `check`. */
export function checkFields(
  value: Record<string, unknown>,
  spec: Record<string, Spec>,
  prefixes: Record<string, string>,
  path: string,
  out: SpecProblem[],
  refs: RefUse[],
): void {
  for (const [key, rule] of Object.entries(spec)) {
    const v = value[key];
    const p = path ? `${path}.${key}` : key;
    if (v === undefined || v === null) {
      if ("req" in rule && rule.req) out.push({ path: p, message: "is required" });
      continue;
    }
    switch (rule.t) {
      case "any":
        break;
      case "string":
        if (typeof v !== "string") out.push({ path: p, message: "must be text" });
        else {
          if (rule.req && v.trim() === "") out.push({ path: p, message: "must not be empty" });
          if (rule.enum && !rule.enum.includes(v)) out.push({ path: p, message: `must be one of ${rule.enum.join(", ")}` });
          if (rule.max && [...v].length > rule.max) out.push({ path: p, message: `is longer than ${rule.max} characters` });
          if (rule.date && normalizeDate(v) !== v) out.push({ path: p, message: `"${v}" is not a normalized GEDCOM date` });
        }
        break;
      case "number":
        if (typeof v !== "number" || Number.isNaN(v)) out.push({ path: p, message: "must be a number" });
        else {
          if (rule.int && !Number.isInteger(v)) out.push({ path: p, message: "must be a whole number" });
          if (rule.min !== undefined && v < rule.min) out.push({ path: p, message: `must be at least ${rule.min}` });
          if (rule.max !== undefined && v > rule.max) out.push({ path: p, message: `must be at most ${rule.max}` });
        }
        break;
      case "ref": {
        const to = Array.isArray(rule.to) ? rule.to : [rule.to];
        if (typeof v !== "string" || !prefixOk(v, to, prefixes)) out.push({ path: p, message: `must be a ${to.join("/")} ID` });
        else refs.push({ path: p, id: v, to });
        break;
      }
      case "refs": {
        const to = Array.isArray(rule.to) ? rule.to : [rule.to];
        if (!Array.isArray(v)) out.push({ path: p, message: "must be a list of IDs" });
        else {
          if (rule.min && v.length < rule.min) out.push({ path: p, message: `needs at least ${rule.min}` });
          v.forEach((id, i) => {
            if (typeof id !== "string" || !prefixOk(id, to, prefixes)) out.push({ path: `${p}[${i}]`, message: `must be a ${to.join("/")} ID` });
            else refs.push({ path: `${p}[${i}]`, id, to });
          });
        }
        break;
      }
      case "strings":
        if (!Array.isArray(v) || v.some((x) => typeof x !== "string")) out.push({ path: p, message: "must be a list of texts" });
        else if (rule.min && v.length < rule.min) out.push({ path: p, message: `needs at least ${rule.min}` });
        break;
      case "array":
        if (!Array.isArray(v)) out.push({ path: p, message: "must be a list" });
        else {
          if (rule.min && v.length < rule.min) out.push({ path: p, message: `needs at least ${rule.min}` });
          v.forEach((item, i) => {
            if (item === null || typeof item !== "object") out.push({ path: `${p}[${i}]`, message: "must be an object" });
            else checkFields(item as Record<string, unknown>, rule.of, prefixes, `${p}[${i}]`, out, refs);
          });
        }
        break;
      case "object":
        if (typeof v !== "object" || Array.isArray(v)) out.push({ path: p, message: "must be an object" });
        else checkFields(v as Record<string, unknown>, rule.of, prefixes, p, out, refs);
        break;
    }
  }
}
