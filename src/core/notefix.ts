// The notes a send of the Strom app wrote wrong before strom NOTES_FIX_SINCE, set right once by themselves (1115 B1):
// a sync paired a fact of the file with the first of the research's facts alike (the same kind, day, place and value —
// two events of one day cited at one page), so the note of one, and the note of someone it names, "corrected" its
// twin's; and the Strom app 3.28.0 sent a longer note of someone a fact names cut short, taken for the user's edit.
// Found in what each sync wrote (its input's `sync.applied`): a note whose new lines the file did not give that fact
// (its `_STROM_EID`), else — no file kept, no IDs in it — that its twin has; a participant's note cut to its beginning
// by an app before APP_SENDS_PART_NOTES. Only while the fact still says what the sync wrote: one changed since is
// left as it is and said. The note before is put back, the wrong one kept in the note's history; each fact one
// operation, the marker in strom.json, one commit.

import fs from "node:fs";
import type { Event, Family, NoteEdit, Participant, Person } from "./model.ts";
import { now, VERSION, type Tree } from "./tree.ts";
import { inputPath } from "./media.ts";
import { freshConfig, quiet } from "./hypolinks.ts";
import { writableUnasked } from "./integrity.ts";
import { update } from "./records.ts";
import { factNote, noteLine, readGedcom, readStromJson, type SFact, type Snapshot, type SyncInput } from "./sync.ts";
import { compareVersions } from "./semver.ts";
import { isAppVersion } from "./stromapp.ts";
import { backupTreeOnce, type BackupRecord } from "./backup.ts";
import { Settings } from "./config.ts";
import { ui } from "../cli/ui.ts";

/** The strom version that pairs each fact of a send by its ID (and so sets the notes right). */
export const NOTES_FIX_SINCE = "1.34.0";

/** The marker in strom.json: the notes a send wrote to a fact's twin set right once. */
export const NOTES_SETTLED = "twin-notes-1";

/** The first Strom app that sends a participant's longer note whole (its 3.28.0 cut it short). */
const WHOLE_PART_NOTES = "3.29.0";

/** A participant's note the 3.28.0 cut short was longer than this (its ~260 bytes): a shorter one is never taken so. */
const CUT_LONGER = 200;

/** One note set right: a fact's (`part` none) or of someone it names (`part`: their role and who). */
export interface NoteFix {
  input: string;
  owner: string;
  event: string;
  /** The participant whose note it is (none: the fact's own note). */
  part?: { role: string; who: string };
  why: "twin" | "cut";
  /** The note before the sync ("" none) and the one it wrote. */
  before: string;
  wrote: string;
}

/** What the fix found: set right, and left as it is (changed since the sync wrote it). */
export interface NoteFindings {
  fixes: NoteFix[];
  left: NoteFix[];
}

const owners = (tree: Tree): (Person | Family)[] => [...tree.list<Person>("person"), ...tree.list<Family>("family")];
const kindOf = (k: string) => (k === "CHR" ? "BAPM" : k);
const linesOf = (t: string | undefined) => (t ? (factNote(t)?.split("\n") ?? []) : []);
/** The facts alike: the same kind, day, place and value (what a sync paired them by). */
const alike = (a: Event, b: Event) => a.id !== b.id && !b.retracted && kindOf(a.kind) === kindOf(b.kind) && (a.date ?? "") === (b.date ?? "") && noteLine(a.place ?? "") === noteLine(b.place ?? "") && noteLine(a.value ?? "") === noteLine(b.value ?? "");
const whoOf = (p: Participant) => p.person ?? noteLine(p.name ?? "").toLowerCase();
const samePart = (a: Participant, b: Participant) => a.role === b.role && whoOf(a) === whoOf(b);

/**
 * Whether the note a sync wrote to a fact (`wrote`, the one before `before`) is of a fact alike (`twins`), not the
 * user's: its new lines are not what the file gave that fact (`given`, under its `_STROM_EID`) — or, no such fact in
 * the file (none kept, no IDs in it), all of them a twin's.
 */
export function wrongFactNote(twins: Event[], before: string | undefined, wrote: string, given: SFact | undefined): boolean {
  if (!twins.length) return false;
  const was = linesOf(before);
  const fresh = linesOf(wrote).filter((l) => !was.includes(l));
  if (!fresh.length) return false;
  if (given) return !fresh.every((l) => linesOf(given.note).includes(l));
  return fresh.every((l) => twins.some((t) => linesOf(t.note).includes(l)));
}

/**
 * Whether the note a sync wrote to someone a fact names (`now`, theirs before `old`) is wrong, and why: the beginning
 * alone of their longer note, of an app that cuts it short (`app` before WHOLE_PART_NOTES, or none said); the note
 * the same person in the same role has at a twin, which the file did not give this fact (`given`).
 */
export function wrongPartNote(now: Participant, old: Participant, twins: Event[], given: SFact | undefined, app: string | undefined): "twin" | "cut" | undefined {
  if (!old.note || !now.note || noteLine(old.note) === noteLine(now.note)) return undefined;
  const whole = !!app && isAppVersion(app) && compareVersions(app, WHOLE_PART_NOTES) >= 0;
  if (!whole && Buffer.byteLength(old.note, "utf8") > CUT_LONGER && noteLine(old.note).startsWith(noteLine(now.note))) return "cut";
  const atTwin = twins.some((t) => (t.participants ?? []).some((x) => samePart(x, now) && noteLine(x.note ?? "") === noteLine(now.note!)));
  if (atTwin && !(given?.parts ?? []).some((x) => noteLine(x.note ?? "") === noteLine(now.note!))) return "twin";
  return undefined;
}

/** The facts of the same person or family alike (what a sync before 1.34.0 paired them by). */
export const twinsOf = (owner: Person | Family, event: Event): Event[] => owner.events.filter((x) => alike(event, x));

/** The file a sync read, as read again (its text kept, or its file in inputs/ or the shared media); none: undefined. */
function sentFile(tree: Tree, input: SyncInput): { snap: Snapshot; app?: string } | undefined {
  let text = (input as { text?: string }).text;
  if (text === undefined) {
    const file = inputPath(tree, input);
    if (!file) return undefined;
    try {
      text = fs.readFileSync(file, "utf8");
    } catch {
      return undefined;
    }
  }
  try {
    const snap = /^﻿?\s*[{[]/u.test(text) ? readStromJson(JSON.parse(text)) : readGedcom(text);
    return { snap, ...(snap.appVersion ? { app: snap.appVersion } : {}) };
  } catch {
    return undefined;
  }
}

/** The fact the file gave under this ID (`2 _STROM_EID`), if it gave one. */
export function sentFact(snap: Snapshot | undefined, id: string) {
  if (!snap) return undefined;
  for (const facts of [...[...snap.persons.values()].map((p) => p.facts), ...snap.families.map((f) => f.facts)]) {
    const f = facts.find((x) => x.eid === id);
    if (f) return f;
  }
  return undefined;
}

/** What the fix finds: nothing once the notes are set right (the marker in strom.json). */
export function noteFixes(tree: Tree): NoteFindings {
  const out: NoteFindings = { fixes: [], left: [] };
  if (tree.config.settled?.includes(NOTES_SETTLED)) return out;
  const inputs = tree.list<SyncInput>("input").filter((i) => !i.retracted && i.sync?.applied?.some((a) => a.do === "event.note" || a.do === "event.parts") && !i.sync.undone);
  if (!inputs.length) return out;
  const facts = new Map<string, { owner: Person | Family; event: Event }>();
  for (const o of owners(tree)) for (const e of o.events) facts.set(e.id, { owner: o, event: e });
  const seen = new Set<string>();
  for (const input of inputs) {
    let file: { snap: Snapshot; app?: string } | undefined | null = null;
    const sent = () => (file === null ? (file = sentFile(tree, input)) : file);
    for (const a of input.sync!.applied) {
      if (a.do !== "event.note" && a.do !== "event.parts") continue;
      const at = facts.get(a.id);
      if (!at || at.event.retracted) continue;
      const { owner, event } = at;
      const twins = twinsOf(owner, event);
      if (a.do === "event.note") {
        if (!twins.length) continue;
        let b: { note?: string | null; now?: string };
        try {
          b = JSON.parse(String(a.before ?? "{}")) as typeof b;
        } catch {
          continue;
        }
        if (typeof b.now !== "string") continue;
        // what the file gave this fact is the user's, never set right
        if (!wrongFactNote(twins, b.note ?? undefined, b.now, sentFact(sent()?.snap, event.id))) continue;
        const key = `${event.id}|`;
        if (seen.has(key)) continue;
        seen.add(key);
        const fix: NoteFix = { input: input.id, owner: owner.id, event: event.id, why: "twin", before: b.note ?? "", wrote: b.now };
        // as before already (undone, set right by hand): nothing; changed since into another: left, said
        if (event.note === b.now) out.fixes.push(fix);
        else if (noteLine(event.note ?? "") !== noteLine(b.note ?? "")) out.left.push(fix);
        continue;
      }
      let was: Participant[];
      try {
        was = JSON.parse(String(a.before ?? "[]")) as Participant[];
      } catch {
        continue;
      }
      if (!Array.isArray(was)) continue;
      const given = sentFact(sent()?.snap, event.id);
      for (const p of event.participants ?? []) {
        const old = was.find((x) => samePart(x, p));
        const key = `${event.id}|${p.role}|${whoOf(p)}`;
        if (!old || seen.has(key)) continue;
        const why = wrongPartNote(p, old, twins, given, sent()?.app);
        if (!why) continue;
        seen.add(key);
        out.fixes.push({ input: input.id, owner: owner.id, event: event.id, part: { role: p.role, who: whoOf(p) }, why, before: old.note!, wrote: p.note! });
      }
    }
  }
  return out;
}

/**
 * The fix: each note put back as it was before the sync, the one it wrote kept in the note's history (a fact's) — one
 * operation per fact, the marker in strom.json. Inside atomically (the tree lock).
 */
export function applyNoteFixes(tree: Tree, found: NoteFindings): number {
  const at = now();
  const byEvent = new Map<string, NoteFix[]>();
  for (const f of found.fixes) byEvent.set(f.event, [...(byEvent.get(f.event) ?? []), f]);
  for (const [id, fixes] of byEvent) {
    const owner = fixes[0]!.owner;
    const reason = `strom ${VERSION}: what a send of the Strom app (${[...new Set(fixes.map((f) => f.input))].join(", ")}) wrote ${fixes.some((f) => f.why === "twin") ? "of a fact alike (the same kind, day and source)" : "cut short by the app"} set right`;
    update<Person | Family>(
      tree,
      owner,
      owner.startsWith("F") ? "family" : "person",
      (o) => ({
        ...o,
        events: o.events.map((e) => {
          if (e.id !== id) return e;
          let next: Event = { ...e };
          for (const f of fixes) {
            if (!f.part) {
              if (next.note !== f.wrote) continue;
              const edits: NoteEdit[] = [...(next.noteEdits ?? []), { text: f.wrote, at, by: tree.actor, reason }];
              const { note: _n, ...rest } = next;
              next = { ...rest, ...(f.before ? { note: f.before } : {}), noteEdits: edits } as Event;
            } else {
              next = { ...next, participants: (next.participants ?? []).map((p) => (p.role === f.part!.role && whoOf(p) === f.part!.who && p.note === f.wrote ? { ...p, note: f.before } : p)) };
            }
          }
          return next;
        }),
      }),
      { op: "note.edit", summary: `${id} note${fixes.some((f) => f.part) ? "s" : ""} set right: ${fixes.map((f) => (f.part ? `${f.part.role}'s` : "the fact's")).join(", ")} as before ${[...new Set(fixes.map((f) => f.input))].join(", ")}`, reason },
    );
  }
  tree.updateConfig(
    (c) => {
      c.settled = [...new Set([...(c.settled ?? []), NOTES_SETTLED])];
    },
    { op: "tree.settle", summary: found.fixes.length ? "the notes a send of the Strom app wrote to a fact alike set right once" : "the notes a send of the Strom app wrote: none to set right" },
  );
  return byEvent.size;
}

/** A local date and time for the backup's README. */
function when(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * The backup of this research before its notes are set right (1115 N1): the same backup a change of channel makes —
 * a beta after a beta of the same channel makes none, and that is where the wrong notes were written. Of this research
 * and the settings (core/backup.ts backupTreeOnce), kept in the user config; none when a backup of the last day for
 * this version holds it already, none with no home of the research configured. Throws when it cannot be made.
 */
export function backupBeforeNotes(tree: Tree, from?: string): BackupRecord | undefined {
  const settings = new Settings(tree.env, {});
  const home = settings.home()?.value;
  if (!home) return undefined;
  const lang = settings.lang(tree.config).value;
  return backupTreeOnce({
    home,
    env: tree.env,
    root: tree.root,
    id: tree.config.id,
    transition: { from: from ?? VERSION, to: VERSION },
    readme: ui(lang, "ui.backup.readme.notes", { date: when(new Date()), to: VERSION, since: NOTES_FIX_SINCE, tree: tree.config.name }),
    research: [settings.trees()?.value, settings.shared()?.value].filter((p): p is string => !!p),
    record: (made, before) => {
      settings.reload();
      settings.config.backups = [...before, made];
      settings.save();
    },
  });
}

/**
 * Once per research, at the first start of this strom and at a bridge's start: the notes set right by themselves, in
 * one commit — the research backed up first when there is a note to set right (`from`: the strom that ran before, for
 * the backup's name). Nothing found: nothing written (looked at again next time, cheaply). Skipped while somebody is at
 * work on the tree or holds its lock, while strom may not write it unasked (another computer's seal, data changed
 * outside strom), in a dry run; a backup that cannot be made writes nothing (it throws: tried again next time). What it
 * did, else undefined.
 */
export function settleNotes(tree: Tree, opts: { from?: string } = {}): { facts: number; notes: number; left: string[]; backup?: BackupRecord } | undefined {
  if (tree.dryRun || tree.config.settled?.includes(NOTES_SETTLED)) return undefined;
  const first = noteFixes(tree);
  if ((!first.fixes.length && !first.left.length) || !quiet(tree)) return undefined;
  // a note to set right: the research backed up first (outside its lock — the backup takes it to copy)
  const backedUp = first.fixes.length > 0 && writableUnasked(tree);
  const backup = backedUp ? backupBeforeNotes(tree, opts.from) : undefined;
  let out: { facts: number; notes: number; left: string[]; backup?: BackupRecord } | undefined;
  tree.atomically(() => {
    // read afresh under the lock: another strom may have settled it meanwhile
    if (!freshConfig(tree) || tree.config.settled?.includes(NOTES_SETTLED) || !writableUnasked(tree)) return;
    const found = noteFixes(tree);
    if (!found.fixes.length && !found.left.length) return;
    // a note to set right found only now (written meanwhile): none set right without the backup — next time
    if (found.fixes.length && !backedUp) return;
    const facts = applyNoteFixes(tree, found);
    const left = [...new Set(found.left.map((f) => f.event))];
    tree.commit(
      `Notes a send of the Strom app wrote to a fact alike set right: ${[...new Set(found.fixes.map((f) => f.event))].join(", ") || "none"}${left.length ? `; changed since, left as they are: ${left.join(", ")}` : ""}`,
    );
    out = { facts, notes: found.fixes.length, left, ...(backup ? { backup } : {}) };
  });
  return out;
}
