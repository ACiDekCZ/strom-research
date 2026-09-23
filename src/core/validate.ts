// Record validation. Returns a list of problems instead of throwing, so the
// same code serves write-time validation and `strom check`.

import {
  DIRECTIONS,
  EVENT_KINDS,
  NOTE_MAX,
  RECORD_TYPES,
  RESEARCH_STATES,
  STATUSES,
  type AnyRecord,
  type Event,
  type Family,
  type Note,
  type Person,
  type Story,
  type Research,
} from "./model.ts";
import { normalizeDate } from "./gdate.ts";
import { isGedcomAge } from "./age.ts";
import { SCHEMAS, checkFields, type RefUse } from "./schema.ts";
import { ALL_PREFIXES, CHILD_RELATIONS, NAME_KINDS, PARTICIPANT_ROLES } from "./model.ts";

export interface Problem {
  path: string;
  message: string;
}

const ID_RE: Record<string, RegExp> = Object.fromEntries(
  Object.entries(RECORD_TYPES).map(([t, v]) => [t, new RegExp(`^${v.prefix}\\d{4,}$`)]),
);
const EVENT_ID = /^E\d{4,}$/;
const ISO = /^\d{4}-\d{2}-\d{2}T/;

function isObj(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function str(v: unknown): v is string {
  return typeof v === "string" && v.length > 0;
}

function checkNotes(notes: unknown, path: string, out: Problem[]): void {
  if (!Array.isArray(notes)) {
    out.push({ path, message: "must be an array" });
    return;
  }
  notes.forEach((n: unknown, i) => {
    const p = `${path}[${i}]`;
    if (!isObj(n)) return void out.push({ path: p, message: "must be an object" });
    const note = n as Partial<Note>;
    if (!str(note.text)) out.push({ path: `${p}.text`, message: "is required" });
    else if (note.text.length > NOTE_MAX)
      out.push({ path: `${p}.text`, message: `is longer than ${NOTE_MAX} characters — use a conflict, hypothesis or story` });
    if (!str(note.at) || !ISO.test(note.at)) out.push({ path: `${p}.at`, message: "must be an ISO timestamp" });
    if (!str(note.by)) out.push({ path: `${p}.by`, message: "is required" });
  });
}

function checkCitations(list: unknown, path: string, out: Problem[]): void {
  if (list === undefined) return;
  if (!Array.isArray(list)) return void out.push({ path, message: "must be an array" });
  list.forEach((c, i) => {
    if (!isObj(c) || !str((c as { source?: unknown }).source)) out.push({ path: `${path}[${i}].source`, message: "is required" });
    const info = isObj(c) ? (c as { information?: unknown }).information : undefined;
    if (info !== undefined && !["primary", "secondary", "unknown"].includes(String(info)))
      out.push({ path: `${path}[${i}].information`, message: "must be primary, secondary or unknown" });
  });
}

export function checkEvent(e: unknown, path: string, out: Problem[], family = false): void {
  if (!isObj(e)) return void out.push({ path, message: "must be an object" });
  const ev = e as Partial<Event>;
  if (!str(ev.id) || !EVENT_ID.test(ev.id)) out.push({ path: `${path}.id`, message: "must be an event ID like E0001" });
  if (!str(ev.kind) || !(ev.kind in EVENT_KINDS)) out.push({ path: `${path}.kind`, message: `unknown event kind "${String(ev.kind)}"` });
  if (ev.date !== undefined && (!str(ev.date) || normalizeDate(ev.date) !== ev.date))
    out.push({ path: `${path}.date`, message: `"${String(ev.date)}" is not a normalized GEDCOM date` });
  if (!STATUSES.includes(ev.status as (typeof STATUSES)[number]))
    out.push({ path: `${path}.status`, message: `must be one of ${STATUSES.join(", ")}` });
  if (!Array.isArray(ev.citations)) out.push({ path: `${path}.citations`, message: "must be an array" });
  else checkCitations(ev.citations, `${path}.citations`, out);
  if ((ev.status === "proven" || ev.status === "probable") && Array.isArray(ev.citations) && ev.citations.length === 0)
    out.push({ path: `${path}.status`, message: `${ev.status} needs at least one citation` });
  if (ev.house !== undefined && !str(ev.house)) out.push({ path: `${path}.house`, message: "must be a non-empty string" });
  if (ev.cause !== undefined && !str(ev.cause)) out.push({ path: `${path}.cause`, message: "must be a non-empty string" });
  if (ev.kind === "EVEN" && !ev.label && !ev.value) out.push({ path: `${path}.label`, message: "EVEN needs a label (what happened)" });
  if (["OCCU", "RELI", "TITL", "NATI"].includes(String(ev.kind)) && !ev.value)
    out.push({ path: `${path}.value`, message: `${ev.kind} needs a value (the fact itself, e.g. "blacksmith")` });
  if (ev.participants !== undefined) {
    if (!Array.isArray(ev.participants)) out.push({ path: `${path}.participants`, message: "must be a list" });
    else
      ev.participants.forEach((pt, i) => {
        const pp = `${path}.participants[${i}]`;
        if (!isObj(pt)) return void out.push({ path: pp, message: "must be an object" });
        if (!pt.person && !pt.name) out.push({ path: pp, message: "needs a person ID or a name" });
        if (!PARTICIPANT_ROLES.includes(pt.role as (typeof PARTICIPANT_ROLES)[number]))
          out.push({ path: `${pp}.role`, message: `must be one of ${PARTICIPANT_ROLES.join(", ")}` });
      });
  }
  if (ev.age !== undefined) {
    if (family) out.push({ path: `${path}.age`, message: "a family event gives the age of each partner: ages" });
    else if (!str(ev.age) || !isGedcomAge(ev.age)) out.push({ path: `${path}.age`, message: `"${String(ev.age)}" is not a GEDCOM age like 27y, 27y 3m, INFANT` });
  }
  if (ev.ages !== undefined) {
    if (!family) out.push({ path: `${path}.ages`, message: "ages are for family events; a person's event has age" });
    else if (!isObj(ev.ages)) out.push({ path: `${path}.ages`, message: "must be an object: person ID → age" });
    else
      for (const [who, age] of Object.entries(ev.ages)) {
        if (!/^P\d{4,}$/.test(who)) out.push({ path: `${path}.ages`, message: `"${who}" is not a person ID` });
        if (typeof age !== "string" || !isGedcomAge(age)) out.push({ path: `${path}.ages.${who}`, message: `"${String(age)}" is not a GEDCOM age` });
      }
  }
}

function checkBase(r: Record<string, unknown>, type: string, out: Problem[]): void {
  const re = ID_RE[type];
  if (!str(r.id) || !re?.test(r.id)) out.push({ path: "id", message: `must be a ${type} ID` });
  if (!str(r.created) || !ISO.test(r.created)) out.push({ path: "created", message: "must be an ISO timestamp" });
  if (!str(r.updated) || !ISO.test(r.updated)) out.push({ path: "updated", message: "must be an ISO timestamp" });
}

function checkStory(st: unknown, out: Problem[]): void {
  if (st === undefined) return;
  if (!isObj(st)) return void out.push({ path: "story", message: "must be an object" });
  const s = st as Partial<Story>;
  if (!str(s.text)) out.push({ path: "story.text", message: "is required" });
  if (s.status !== "draft" && s.status !== "final") out.push({ path: "story.status", message: "must be draft or final" });
  if (!Array.isArray(s.facts) || s.facts.some((f) => !EVENT_ID.test(String(f)))) out.push({ path: "story.facts", message: "must be a list of event IDs" });
}

function checkPerson(p: Partial<Person>, out: Problem[]): void {
  if (!Array.isArray(p.names) || p.names.length === 0) out.push({ path: "names", message: "needs at least one name" });
  else
    p.names.forEach((n, i) => {
      if (!isObj(n)) return void out.push({ path: `names[${i}]`, message: "must be an object" });
      if (typeof n.given !== "string") out.push({ path: `names[${i}].given`, message: "must be a string" });
      if (typeof n.surname !== "string") out.push({ path: `names[${i}].surname`, message: "must be a string" });
      if (!n.given && !n.surname) out.push({ path: `names[${i}]`, message: "needs a given name or a surname" });
      if (n.kind !== undefined && !NAME_KINDS.includes(n.kind)) out.push({ path: `names[${i}].kind`, message: `must be one of ${NAME_KINDS.join(", ")}` });
      checkCitations(n.citations, `names[${i}].citations`, out);
    });
  if (!["M", "F", "U"].includes(p.sex as string)) out.push({ path: "sex", message: "must be M, F or U" });
  checkStory(p.story, out);
  if (!Array.isArray(p.events)) out.push({ path: "events", message: "must be an array" });
  else p.events.forEach((e, i) => checkEvent(e, `events[${i}]`, out));
  checkNotes(p.notes, "notes", out);
}

function checkFamily(f: Partial<Family>, out: Problem[]): void {
  if (!Array.isArray(f.partners) || f.partners.length > 2) out.push({ path: "partners", message: "must be an array of at most 2 persons" });
  if (Array.isArray(f.events) && Array.isArray(f.partners))
    f.events.forEach((e, i) => {
      for (const who of Object.keys((e as Partial<Event>)?.ages ?? {}))
        if (!f.partners!.includes(who)) out.push({ path: `events[${i}].ages.${who}`, message: "is not a partner of this family" });
    });
  if (!Array.isArray(f.children)) out.push({ path: "children", message: "must be an array" });
  else
    f.children.forEach((c, i) => {
      if (!isObj(c) || !str(c.person)) return void out.push({ path: `children[${i}].person`, message: "is required" });
      if (!CHILD_RELATIONS.includes(c.relation)) out.push({ path: `children[${i}].relation`, message: `must be one of ${CHILD_RELATIONS.join(", ")}` });
      if (c.relations !== undefined) {
        if (!isObj(c.relations)) out.push({ path: `children[${i}].relations`, message: "must be an object: partner ID → relation" });
        else
          for (const [who, rel] of Object.entries(c.relations)) {
            if (!f.partners?.includes(who)) out.push({ path: `children[${i}].relations.${who}`, message: "is not a partner of this family" });
            if (!CHILD_RELATIONS.includes(rel)) out.push({ path: `children[${i}].relations.${who}`, message: `must be one of ${CHILD_RELATIONS.join(", ")}` });
          }
      }
    });
  checkCitations(f.citations, "citations", out);
  checkStory(f.story, out);
  const members = (f.partners?.length ?? 0) + (f.children?.length ?? 0);
  if (members === 0) out.push({ path: "partners", message: "a family needs at least one member" });
  if (!Array.isArray(f.events)) out.push({ path: "events", message: "must be an array" });
  else f.events.forEach((e, i) => checkEvent(e, `events[${i}]`, out, true));
  checkNotes(f.notes, "notes", out);
}

function checkResearch(r: Partial<Research>, out: Problem[]): void {
  if (!str(r.name)) out.push({ path: "name", message: "is required" });
  if (!str(r.focus)) out.push({ path: "focus", message: "is required (a person ID)" });
  if (!DIRECTIONS.includes(r.direction as (typeof DIRECTIONS)[number]))
    out.push({ path: "direction", message: `must be one of ${DIRECTIONS.join(", ")}` });
  if (!RESEARCH_STATES.includes(r.state as (typeof RESEARCH_STATES)[number]))
    out.push({ path: "state", message: `must be one of ${RESEARCH_STATES.join(", ")}` });
  if (typeof r.priority !== "number" || r.priority < 1 || r.priority > 5) out.push({ path: "priority", message: "must be 1..5" });
  if (r.direction === "question" && !str(r.question)) out.push({ path: "question", message: "is required for direction question" });
  checkNotes(r.notes, "notes", out);
}

export function validateRecord(value: unknown): Problem[] {
  const out: Problem[] = [];
  if (!isObj(value)) return [{ path: "", message: "record must be an object" }];
  const type = value.type;
  if (typeof type !== "string" || !(type in RECORD_TYPES)) return [{ path: "type", message: `unknown record type "${String(type)}"` }];
  checkBase(value, type, out);
  const rec = value as unknown as AnyRecord;
  if (rec.type === "person") checkPerson(rec, out);
  else if (rec.type === "family") checkFamily(rec, out);
  else if (rec.type === "research") checkResearch(rec, out);
  else {
    const spec = SCHEMAS[rec.type];
    if (spec) checkFields(value, spec, ALL_PREFIXES, "", out, []);
    checkNotes((value as { notes?: unknown }).notes, "notes", out);
  }
  return out;
}

/** Every reference a record makes to another record (for dangling-reference checks). */
export function recordRefs(value: AnyRecord): RefUse[] {
  const refs: RefUse[] = [];
  const events = (value as { events?: Event[] }).events ?? [];
  events.forEach((e, i) => {
    e.citations?.forEach((c, j) => refs.push({ path: `events[${i}].citations[${j}]`, id: c.source, to: ["source"] }));
    e.participants?.forEach((pt, j) => pt.person && refs.push({ path: `events[${i}].participants[${j}]`, id: pt.person, to: ["person"] }));
  });
  if (value.type === "person")
    value.names.forEach((n, i) => n.citations?.forEach((c, j) => refs.push({ path: `names[${i}].citations[${j}]`, id: c.source, to: ["source"] })));
  if (value.type === "family") {
    value.citations?.forEach((c, j) => refs.push({ path: `citations[${j}]`, id: c.source, to: ["source"] }));
    value.partners.forEach((p, i) => refs.push({ path: `partners[${i}]`, id: p, to: ["person"] }));
    value.children.forEach((c, i) => refs.push({ path: `children[${i}]`, id: c.person, to: ["person"] }));
  }
  if (value.type === "research") {
    refs.push({ path: "focus", id: value.focus, to: ["person"] });
    if (value.parent) refs.push({ path: "parent", id: value.parent, to: ["research"] });
  }
  const spec = SCHEMAS[value.type];
  if (spec) checkFields(value as unknown as Record<string, unknown>, spec, ALL_PREFIXES, "", [], refs);
  return refs;
}
