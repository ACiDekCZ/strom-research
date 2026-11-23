// strom fixes contact-residences (spec 134 U11): what a contact of another program or of the Strom app left as a
// residence before strom took it for the person's contact — set right by rules, on a person's word alone:
// (a) a residence of nothing but a note of e-mail lines ("E-mail: x", a status word beside them) — the Strom app's older
//     form of an e-mail, taken in from its send or its file;
// (b) an empty residence an import of another program's GEDCOM made of "1 RESI / 2 EMAIL x" (the e-mail lost): its
//     e-mail read again from the file kept in inputs/ (the person by the xref the import left: refs, originalIds) — an
//     e-mail not found there, the residence stays and is not offered;
// (c) a residence whose house is the label of an address ("Email": MyHeritage's 2 ADDR / 3 ADR1 Email): the label is
//     no house, taken off always; its e-mail read again as (b), the residence withdrawn where nothing of one is left.
// The e-mails join the person's contact (each once); the residence is withdrawn with the reason (never deleted). One
// with a record cited, a witness or a note of its own beside the e-mail is left and said why. Free, one operation,
// kept for its undo (CONTACT_RESIDENCES_FILE): the residences back, the label back, only the e-mails it added taken off.

import fs from "node:fs";
import path from "node:path";
import { decodeGedcom } from "../gedcom/encoding.ts";
import { parseGedcomText, type GedNode } from "../gedcom/parse.ts";
import { addressLabel, gedcomPersonContact, joinEmails, noteEmails, noteMentionsEmail, residenceContact } from "./contact.ts";
import { inputPath } from "./media.ts";
import type { Event, Input, Person, Source, Status, TreeConfig } from "./model.ts";
import { phrase } from "./phrases.ts";
import { now, type Tree } from "./tree.ts";

/** The strom that sets them right. */
export const CONTACT_RESIDENCES_SINCE = "1.37.0";
/** Where the fix keeps what it changed, for its undo (sealed like the rest of quality/). */
export const CONTACT_RESIDENCES_FILE = "quality/contact-residences.json";

/** One residence set right: whose, which, how and where its e-mails come from. */
export interface ContactFix {
  owner: string;
  event: string;
  /** retract: withdrawn (nothing of a residence in it); house: only the label of an address taken off its house. */
  how: "retract" | "house";
  /** Its e-mails from its note, from the file of the import (`input`), or none found (a label taken off alone). */
  from: "note" | "input" | "none";
  input?: string;
  emails: string[];
  /** The label its house was ("Email"): taken off. */
  house?: string;
  /** Its status before it was withdrawn (kept by the run, for the undo). */
  status?: Status;
}

/** A residence of a contact left as it is: a record cited, people at it, a note of its own beside the e-mails. */
export interface ContactLeft {
  owner: string;
  event: string;
  why: "record" | "witness" | "note";
  emails?: string[];
}

export interface ContactFindings {
  fixes: ContactFix[];
  left: ContactLeft[];
}

interface ContactRun {
  at: string;
  version: string;
  items: ContactFix[];
  /** The e-mails the run added to each person's contact (person → e-mails): the undo takes off these alone. */
  added: Record<string, string[]>;
}

interface ContactFile {
  v: 1;
  runs: ContactRun[];
}

/** Anything of a residence in it, its house aside (a label "Email" is none, a real house is). */
function residenceContent(e: Event): boolean {
  if (e.date || e.place || e.value || e.label || e.age || e.cause || e.share || e.roleAt || e.confirmed) return true;
  if (e.ages && Object.keys(e.ages).length) return true;
  return !!e.house && !addressLabel(e.house);
}

/** A file of a family tree taken in, read once: its people by xref, and how many residences of a contact each has. */
interface TreeFile {
  system?: string;
  source: string;
  people: Map<string, GedNode>;
  noteText: (n: GedNode) => string;
}

function readTreeFile(tree: Tree, source: Source, input: Input): TreeFile | undefined {
  if (input.kind !== "tree" || !/\.ged$/iu.test(input.name)) return undefined;
  try {
    const file = inputPath(tree, input);
    if (!file || !fs.existsSync(file)) return undefined;
    const { records } = parseGedcomText(decodeGedcom(fs.readFileSync(file)).text);
    const notes = new Map(records.filter((r) => r.tag === "NOTE" && r.xref).map((r) => [r.xref!, r.value]));
    return {
      ...(input.sha ? { system: `gedcom:${input.sha.slice(0, 12)}` } : {}),
      source: source.id,
      people: new Map(records.filter((r) => r.tag === "INDI" && r.xref).map((r) => [r.xref!, r])),
      noteText: (n) => (/^@[^@]+@$/u.test(n.value.trim()) ? (notes.get(n.value.trim()) ?? "") : n.value),
    };
  } catch {
    return undefined;
  }
}

/** The residences of contacts left as they are and those to set right, each found once. */
export function contactResidenceFixes(tree: Tree): ContactFindings {
  const fixes: ContactFix[] = [];
  const left: ContactLeft[] = [];
  const sources = new Map(tree.list<Source>("source").map((s) => [s.id, s]));
  const files = new Map<string, TreeFile | undefined>();
  const fileOf = (s: Source): TreeFile | undefined => {
    if (!s.input) return undefined;
    if (!files.has(s.input)) {
      const input = tree.get<Input>(s.input);
      files.set(s.input, input && input.type === "input" ? readTreeFile(tree, s, input) : undefined);
    }
    return files.get(s.input);
  };
  // the sources of families trees taken in (an import, a send of the Strom app): no record of the research's
  const ofTree = (id: string) => sources.get(id)?.kind === "family-tree";
  for (const p of tree.list<Person>("person")) {
    if (p.retracted || p.mergedInto) continue;
    // the person in a file of an import: by the xref the import left (refs: gedcom:<sha12>, originalIds: the source)
    const fromFiles = (cited: string[]): { input: string; emails: string[]; residences: number } | undefined => {
      const tried = new Set<string>();
      const order = [...cited, ...[...sources.values()].filter((s) => s.kind === "family-tree" && s.input && !s.retracted).map((s) => s.id)];
      for (const sid of order) {
        const s = sources.get(sid);
        if (!s?.input || tried.has(s.input)) continue;
        tried.add(s.input);
        const f = fileOf(s);
        if (!f) continue;
        const xref =
          (f.system ? p.refs?.find((r) => r.system === f.system)?.id : undefined) ?? p.originalIds?.find((o) => o.source === s.id && o.xref)?.xref;
        const indi = xref ? f.people.get(xref) : undefined;
        if (!indi) continue;
        const emails = gedcomPersonContact(indi, f.noteText).emails;
        const residences = indi.children.filter((c) => c.tag === "RESI" && residenceContact(c, f.noteText).onlyContact).length;
        return { input: s.input, emails, residences };
      }
      return undefined;
    };
    let fromInput: ReturnType<typeof fromFiles> | null = null;
    let taken = 0;
    for (const e of p.events) {
      if (e.kind !== "RESI" || e.retracted || e.status === "retracted") continue;
      const label = e.house && addressLabel(e.house) ? e.house : undefined;
      const content = residenceContent(e);
      // a residence of its own: only a label of an address in its house taken off
      if (content) {
        if (label) fixes.push({ owner: p.id, event: e.id, how: "house", from: "none", emails: [], house: label });
        continue;
      }
      const inNote = noteEmails(e.note);
      const ownNote = !!e.note?.trim() && !inNote;
      const why: ContactLeft["why"] | undefined = e.participants?.length
        ? "witness"
        : e.citations.some((c) => !ofTree(c.source))
          ? "record"
          : ownNote && noteMentionsEmail(e.note)
            ? "note"
            : undefined;
      if (why) {
        left.push({ owner: p.id, event: e.id, why, ...(inNote ? { emails: inNote } : {}) });
        continue;
      }
      // a note of its own with no e-mail in it: something of a residence said, not a contact's
      if (ownNote) {
        if (label) fixes.push({ owner: p.id, event: e.id, how: "house", from: "none", emails: [], house: label });
        continue;
      }
      if (inNote) {
        fixes.push({ owner: p.id, event: e.id, how: "retract", from: "note", emails: inNote, ...(label ? { house: label } : {}) });
        continue;
      }
      // nothing in it: its e-mail from the file of the import, never more of them than the file has residences of a contact
      if (fromInput === null) fromInput = fromFiles(e.citations.map((c) => c.source).filter(ofTree));
      if (fromInput && fromInput.emails.length && taken < Math.max(1, fromInput.residences)) {
        taken++;
        fixes.push({ owner: p.id, event: e.id, how: "retract", from: "input", input: fromInput.input, emails: fromInput.emails, ...(label ? { house: label } : {}) });
      } else if (label) fixes.push({ owner: p.id, event: e.id, how: "house", from: "none", emails: [], house: label });
    }
  }
  return { fixes, left };
}

function readContactFile(tree: Tree): ContactFile {
  try {
    const f = JSON.parse(fs.readFileSync(path.join(tree.root, ...CONTACT_RESIDENCES_FILE.split("/")), "utf8")) as Partial<ContactFile>;
    return { v: 1, runs: Array.isArray(f.runs) ? f.runs : [] };
  } catch {
    return { v: 1, runs: [] };
  }
}

const fileContent = (f: ContactFile) => JSON.stringify(f, null, 2) + "\n";

/** The fix: every residence found set right — one operation, what it changed kept for its undo. Inside withTreeLock. */
export function applyContactResidences(tree: Tree, items: ContactFix[], version: string, config?: (c: TreeConfig) => void): { changed: number; records: number; left: number } {
  const at = now();
  const reason = phrase(tree.lang, "fix.contact.retracted");
  const records = new Map<string, Person>();
  const done: ContactFix[] = [];
  const added: Record<string, string[]> = {};
  let left = 0;
  for (const it of items) {
    const was = records.get(it.owner) ?? tree.get<Person>(it.owner);
    if (!was || was.retracted) {
      left++;
      continue;
    }
    const p = records.get(it.owner) ?? structuredClone(was);
    const e = p.events.find((x) => x.id === it.event);
    // only as it was found: not withdrawn since, its label still its house
    if (!e || e.retracted || e.status === "retracted" || (it.house !== undefined && e.house !== it.house)) {
      left++;
      continue;
    }
    if (it.house !== undefined) delete e.house;
    const item: ContactFix = { ...it };
    if (it.how === "retract") {
      item.status = e.status;
      e.retracted = { at, reason };
      e.status = "retracted";
    }
    if (it.emails.length) {
      const before = p.contact?.emails ?? [];
      const joined = joinEmails(before, it.emails);
      const had = new Set(before.map((x) => x.toLowerCase()));
      const fresh = joined.filter((x) => !had.has(x.toLowerCase()));
      if (fresh.length) {
        p.contact = { ...p.contact, emails: joined };
        added[p.id] = [...(added[p.id] ?? []), ...fresh];
      }
    }
    records.set(p.id, p);
    done.push(item);
  }
  if (!done.length) return { changed: 0, records: 0, left };
  const file = readContactFile(tree);
  file.runs.push({ at, version, items: done, added });
  tree.putMany(
    [...records.values()],
    [{ rel: CONTACT_RESIDENCES_FILE, content: fileContent(file) }],
    { op: "contact.fix", targets: [...records.keys()].sort(), summary: `contacts out of the residences: ${done.length} in ${records.size} records (fix contact-residences)`, reason },
    config,
  );
  return { changed: done.length, records: records.size, left };
}

/** What the fix set right and is not undone yet. */
export function contactResidencesDone(tree: Tree): ContactFix[] {
  return readContactFile(tree).runs.flatMap((r) => r.items);
}

/**
 * The fix undone: each residence back as it was (its status, its label) where still as the fix left it, and only the
 * e-mails the fix added taken off the contact (those still there) — one changed since is left and counted. One
 * operation; what the fix kept is emptied.
 */
export function undoContactResidences(tree: Tree, config?: (c: TreeConfig) => void): { restored: number; records: number; left: number } {
  const file = readContactFile(tree);
  if (!file.runs.length) return { restored: 0, records: 0, left: 0 };
  const records = new Map<string, Person>();
  const person = (id: string): Person | undefined => {
    if (records.has(id)) return records.get(id);
    const was = tree.get<Person>(id);
    return was && !was.retracted ? structuredClone(was) : undefined;
  };
  let restored = 0;
  let left = 0;
  for (const run of [...file.runs].reverse()) {
    for (const it of [...run.items].reverse()) {
      const p = person(it.owner);
      const e = p?.events.find((x) => x.id === it.event);
      const ok = !!e && (it.how === "retract" ? e.retracted?.at === run.at : !e.house) && (it.house === undefined || !e.house);
      if (!p || !e || !ok) {
        left++;
        continue;
      }
      if (it.how === "retract") {
        delete e.retracted;
        e.status = it.status ?? "lead";
      }
      if (it.house !== undefined) e.house = it.house;
      records.set(p.id, p);
      restored++;
    }
    for (const [id, emails] of Object.entries(run.added ?? {})) {
      const p = person(id);
      if (!p?.contact?.emails?.length) continue;
      const off = new Set(emails.map((x) => x.toLowerCase()));
      const kept = p.contact.emails.filter((x) => !off.has(x.toLowerCase()));
      if (kept.length === p.contact.emails.length) continue;
      if (kept.length) p.contact = { ...p.contact, emails: kept };
      else delete p.contact;
      records.set(p.id, p);
    }
  }
  tree.putMany(
    [...records.values()],
    [{ rel: CONTACT_RESIDENCES_FILE, content: fileContent({ v: 1, runs: [] }) }],
    { op: "contact.unfix", targets: [...records.keys()].sort(), summary: `residences of contacts put back as they were: ${restored} in ${records.size} records${left ? `, ${left} changed since left` : ""} (fix contact-residences undone)` },
    config,
  );
  return { restored, records: records.size, left };
}
