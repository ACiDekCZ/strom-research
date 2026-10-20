// A name or a note taken back as wrong, and a note corrected — nothing deleted: the name or note goes apart from the
// names and notes (retractedNames, retractedNotes), where nothing that reads them sees it (person show, the brief, the
// GEDCOM, matching, searching), with when, by whom and why; a corrected note keeps the texts it had (edits). Each can
// be put back.

import { UsageError } from "./errors.ts";
import { findEventOwner, makeNote } from "./actions.ts";
import { EMBEDDED_PREFIXES, type AnyRecord, type Event, type Family, type Name, type Note, type NoteEdit, type Person, type RetractedName, type RetractedNote, type Retraction } from "./model.ts";
import { gedcomName, parseName, primaryName, sameName } from "./people.ts";
import { now, typeOfId, type Tree } from "./tree.ts";

function needsReason(reason: string | undefined, what: string): string {
  const why = reason?.trim();
  if (!why) throw new UsageError(`${what} needs --reason`, { hint: 'e.g. --reason "misread: the register has Nováková"', code: "retract.needs-reason" });
  return why;
}

function retraction(tree: Tree, reason: string): Retraction {
  return { at: now(), reason, by: tree.actor };
}

function personFor(tree: Tree, id: string): Person {
  const p = tree.get<Person>(id);
  if (!p || p.type !== "person") throw new UsageError(`no person ${id}`, { hint: "strom person list", code: "record.none", params: { kind: "person", id } });
  if (p.mergedInto) throw new UsageError(`${id} was merged into ${p.mergedInto}`, { hint: `use ${p.mergedInto}` });
  return p;
}

const nameList = (names: Name[]) => names.map((n) => `"${gedcomName(n)}"`).join(", ") || "none";

/** Take back a name of a person as wrong: kept apart, with the reason. The name they are shown by only while they have another. */
export function retractName(tree: Tree, id: string, text: string, reason: string | undefined): { person: Person; name: RetractedName; shown: Name } {
  const why = needsReason(reason, "retracting a name");
  const wanted = parseName(text);
  return tree.withTreeLock(() => {
    const p = personFor(tree, id);
    const name = p.names.find((n) => sameName(n, wanted));
    if (!name) {
      const gone = p.retractedNames?.find((n) => sameName(n, wanted));
      if (gone) throw new UsageError(`the name ${gedcomName(gone)} of ${id} is retracted already: ${gone.retracted.reason}`, { code: "name.retracted" });
      throw new UsageError(`${id} has no name ${gedcomName(wanted)}`, { hint: `its names: ${nameList(p.names)}`, code: "name.none" });
    }
    if (p.names.length === 1)
      throw new UsageError(`${gedcomName(name)} is the only name of ${id}: a person keeps the name they are shown by`, {
        hint: `correct its spelling: strom person edit ${id} --name "<Given /Surname/>" --reason "…"; or add the right name first: strom name add ${id} "<Given /Surname/>" --cite S…`,
        code: "name.only",
      });
    const gone: RetractedName = { ...name, retracted: retraction(tree, why) };
    const updated: Person = { ...p, names: p.names.filter((n) => n !== name), retractedNames: [...(p.retractedNames ?? []), gone], updated: now() };
    const shown = primaryName(updated);
    const moved = name === primaryName(p);
    tree.put(updated, {
      op: "name.retract",
      targets: [id],
      summary: `${id} name ${gedcomName(name)} retracted${moved ? `; shown by ${gedcomName(shown)}` : ""}`,
      reason: why,
    });
    return { person: updated, name: gone, shown };
  });
}

/** Put a name taken back among the person's names again (beside the one they are shown by). */
export function restoreName(tree: Tree, id: string, text: string, reason: string | undefined): { person: Person; name: Name } {
  const wanted = parseName(text);
  return tree.withTreeLock(() => {
    const p = personFor(tree, id);
    const gone = p.retractedNames?.find((n) => sameName(n, wanted));
    if (!gone) throw new UsageError(`${id} has no retracted name ${gedcomName(wanted)}`, { hint: `its retracted names: ${nameList(p.retractedNames ?? [])}`, code: "name.none" });
    if (p.names.some((n) => sameName(n, gone))) throw new UsageError(`${id} has the name ${gedcomName(gone)} again`, { hint: `nothing to restore: strom person show ${id}` });
    const { retracted: _was, ...name } = gone;
    const rest = (p.retractedNames ?? []).filter((n) => n !== gone);
    const { retractedNames: _all, ...base } = p;
    const updated: Person = { ...base, names: [...p.names, name], ...(rest.length ? { retractedNames: rest } : {}), updated: now() };
    tree.put(updated, { op: "name.restore", targets: [id], summary: `${id} name ${gedcomName(name)} restored`, ...(reason?.trim() ? { reason: reason.trim() } : {}) });
    return { person: updated, name };
  });
}

/** Whether a name is one the person's research took back: never added again by a sync or an import unasked. */
export function isRetractedName(p: Person, name: Name): boolean {
  return (p.retractedNames ?? []).some((n) => sameName(n, name));
}

/** The texts of a record's notes that were taken back or corrected since: words the research said, no new note of the app's. */
export function earlierNoteTexts(rec: { notes?: Note[]; retractedNotes?: RetractedNote[] } | undefined): string[] {
  if (!rec) return [];
  return [...(rec.retractedNotes ?? []), ...(rec.notes ?? [])].flatMap((n) => [...((n as RetractedNote).retracted ? [n.text] : []), ...(n.edits ?? []).map((e) => e.text)]);
}

type WithNotes = AnyRecord & { notes: Note[]; retractedNotes?: RetractedNote[] };
type Holder = { kind: "record"; rec: WithNotes } | { kind: "event"; owner: Person | Family; event: Event };

/** What holds the notes an ID names: a record, or a fact (E…) with its one note. */
function holderOf(tree: Tree, id: string): Holder {
  if (id.startsWith(EMBEDDED_PREFIXES.event)) {
    const { owner, event } = findEventOwner(tree, id);
    return { kind: "event", owner, event };
  }
  if (!typeOfId(id)) throw new UsageError(`unknown ID ${id}`);
  const rec = tree.get<AnyRecord>(id);
  if (!rec) throw new UsageError(`no record ${id}`, { code: "record.none", params: { kind: "record", id } });
  if (!Array.isArray((rec as { notes?: unknown }).notes)) throw new UsageError(`${id} has no notes`);
  return { kind: "record", rec: rec as WithNotes };
}

/** A record's (or a fact's) notes as numbered: the notes in force (1, 2, …) and those taken back (1, 2, … of their own). */
export function notesOf(tree: Tree, id: string): { notes: Note[]; retracted: RetractedNote[]; edits?: NoteEdit[] } {
  const h = holderOf(tree, id);
  if (h.kind === "record") return { notes: h.rec.notes, retracted: h.rec.retractedNotes ?? [] };
  const e = h.event;
  // a fact's note: one, its own time unknown — told by the fact
  return { notes: e.note ? [{ text: e.note, at: "", by: "", ...(e.noteEdits?.length ? { edits: e.noteEdits } : {}) }] : [], retracted: e.retractedNotes ?? [] };
}

function pick<T>(list: T[], n: number, id: string, what: string, hint: string): T {
  if (!Number.isInteger(n) || n < 1 || n > list.length)
    throw new UsageError(list.length ? `${id} has no ${what} ${n} (it has ${list.length})` : `${id} has no ${what}s`, { hint, code: "note.none" });
  return list[n - 1]!;
}

function putHolder(tree: Tree, h: Holder, next: AnyRecord | Event, op: { op: string; summary: string; reason?: string }): void {
  if (h.kind === "record") tree.put({ ...(next as AnyRecord), updated: now() }, { op: op.op, targets: [h.rec.id], summary: op.summary, ...(op.reason ? { reason: op.reason } : {}) });
  else {
    const owner = { ...h.owner, events: h.owner.events.map((e) => (e.id === h.event.id ? (next as Event) : e)), updated: now() } as Person | Family;
    tree.put(owner, { op: op.op, targets: [owner.id, h.event.id], summary: op.summary, ...(op.reason ? { reason: op.reason } : {}) });
  }
}

const listHint = (id: string) => `the numbers: strom note list ${id}`;

/** Correct a note (n from 1, as strom note list numbers them): the text it had kept in its edits, with the reason. */
export function editNote(tree: Tree, id: string, n: number, text: string, reason: string | undefined): Note {
  const why = needsReason(reason, "correcting a note");
  const fresh = makeNote(tree, text);
  return tree.withTreeLock(() => {
    const h = holderOf(tree, id);
    const at = now();
    if (h.kind === "record") {
      const note = pick(h.rec.notes, n, id, "note", listHint(id));
      if (note.text === fresh.text) throw new UsageError(`note ${n} of ${id} says that already`);
      const next: Note = { ...note, text: fresh.text, edits: [...(note.edits ?? []), { text: note.text, at, by: tree.actor, reason: why }] };
      putHolder(tree, h, { ...h.rec, notes: h.rec.notes.map((x) => (x === note ? next : x)) } as AnyRecord, { op: "note.edit", summary: `${id} note ${n} corrected`, reason: why });
      return next;
    }
    const e = h.event;
    if (!e.note || n !== 1) throw new UsageError(e.note ? `a fact has one note: ${id} 1` : `${id} has no note`, { hint: `add one: strom event edit ${id} --note "<text>"`, code: "note.none" });
    if (e.note === fresh.text) throw new UsageError(`the note of ${id} says that already`);
    const next: Event = { ...e, note: fresh.text, noteEdits: [...(e.noteEdits ?? []), { text: e.note, at, by: tree.actor, reason: why }] };
    putHolder(tree, h, next, { op: "note.edit", summary: `${id} note corrected`, reason: why });
    return { text: fresh.text, at, by: tree.actor, edits: next.noteEdits! };
  });
}

/** Take back a note as wrong (n from 1): kept apart, with the reason; the notes after it move up a number. */
export function retractNote(tree: Tree, id: string, n: number, reason: string | undefined): RetractedNote {
  const why = needsReason(reason, "retracting a note");
  return tree.withTreeLock(() => {
    const h = holderOf(tree, id);
    if (h.kind === "record") {
      const note = pick(h.rec.notes, n, id, "note", listHint(id));
      const gone: RetractedNote = { ...note, retracted: retraction(tree, why) };
      putHolder(tree, h, { ...h.rec, notes: h.rec.notes.filter((x) => x !== note), retractedNotes: [...(h.rec.retractedNotes ?? []), gone] } as AnyRecord, {
        op: "note.retract",
        summary: `${id} note ${n} retracted`,
        reason: why,
      });
      return gone;
    }
    const e = h.event;
    if (!e.note || n !== 1) throw new UsageError(e.note ? `a fact has one note: ${id} 1` : `${id} has no note`, { code: "note.none" });
    const r = retraction(tree, why);
    // a fact's note has no time of its own: the time it was taken back
    const gone: RetractedNote = { text: e.note, at: r.at, by: r.by, ...(e.noteEdits?.length ? { edits: e.noteEdits } : {}), retracted: r };
    const { note: _note, noteEdits: _edits, ...rest } = e;
    putHolder(tree, h, { ...rest, retractedNotes: [...(e.retractedNotes ?? []), gone] } as Event, { op: "note.retract", summary: `${id} note retracted`, reason: why });
    return gone;
  });
}

/** Put a note taken back (n from 1 among the retracted, as strom note list --history numbers them) among the notes again, in its time. */
export function restoreNote(tree: Tree, id: string, n: number, reason: string | undefined): Note {
  return tree.withTreeLock(() => {
    const h = holderOf(tree, id);
    const why = reason?.trim();
    const op = { op: "note.restore", summary: "", ...(why ? { reason: why } : {}) };
    if (h.kind === "record") {
      const list = h.rec.retractedNotes ?? [];
      const gone = pick(list, n, id, "retracted note", `${listHint(id)} --history`);
      const { retracted: _r, ...note } = gone;
      const rest = list.filter((x) => x !== gone);
      const notes = [...h.rec.notes, note].sort((a, b) => a.at.localeCompare(b.at));
      const { retractedNotes: _all, ...base } = h.rec;
      putHolder(tree, h, { ...base, notes, ...(rest.length ? { retractedNotes: rest } : {}) } as AnyRecord, { ...op, summary: `${id} note restored` });
      return note;
    }
    const e = h.event;
    const list = e.retractedNotes ?? [];
    const gone = pick(list, n, id, "retracted note", `${listHint(id)} --history`);
    if (e.note) throw new UsageError(`${id} has a note again: a fact has one`, { hint: `correct it instead: strom note edit ${id} 1 "<text>" --reason "…"` });
    const rest = list.filter((x) => x !== gone);
    const { retractedNotes: _all, ...base } = e;
    putHolder(tree, h, { ...base, note: gone.text, ...(gone.edits?.length ? { noteEdits: gone.edits } : {}), ...(rest.length ? { retractedNotes: rest } : {}) } as Event, { ...op, summary: `${id} note restored` });
    return { text: gone.text, at: gone.at, by: gone.by };
  });
}
