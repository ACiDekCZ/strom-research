// The roles people have in a record, whatever language they are written in:
// "kmotr", "Pate", "svědek", "Hebamme", "oddávající" — and RELA of other programs.

import { foldText } from "./text.ts";
import { EVENT_KINDS, PARTICIPANT_ROLES, SHARE_ID, type EventRoleAt, type EventShare, type ParticipantRole } from "./model.ts";
import { phrase, type PhraseKey } from "./phrases.ts";
import type { GedNode } from "../gedcom/parse.ts";
import { RELA } from "../gedcom/labels.ts";

/** The role a word names, in any of the languages records and programs use; undefined if none. */
export function roleWord(word: string | undefined): ParticipantRole | undefined {
  const r = foldText(word ?? "");
  if (!r) return undefined;
  if (PARTICIPANT_ROLES.includes(r as ParticipantRole)) return r as ParticipantRole;
  // Latin registers: patrinus/patrina, levans (who lifts the child), susceptor; paranymphus (at a wedding) is a witness
  if (/godparent|godfather|godmother|sponsor|kmotr|pate|patin|patrin|levan|suscept|compater|commater|chrzest|parrain|marraine|padrino|madrina/.test(r)) return "godparent";
  if (/witness|svedek|svedk|zeuge|swiadek|swiadk|temoin|testigo|testis|testes|paranymph|druzba|druzic/.test(r)) return "witness";
  if (/officiant|clergy|priest|minister|pastor|knez|farar|kaplan|pfarrer|ksiadz|cure|sacerdo|parochus|capellan|cooperator|vicari|baptizans|copulans|copulavi|oddavajici|krtici/.test(r)) return "officiant";
  if (/informant|oznamovatel|anzeig|declarant/.test(r)) return "informant";
  if (/midwife|porodni|baba|hebamme|polozna|sage-femme|obstetrix/.test(r)) return "midwife";
  if (/participant|ucastnik|teilnehmer|uczestnik/.test(r)) return "other";
  return undefined;
}

/** RELA as other programs write it → our role. */
export function roleOf(rela: string | undefined, fallback: ParticipantRole = "other"): ParticipantRole {
  return roleWord(rela) ?? fallback;
}

/** Words that only say someone was there (the Strom app's RELA for a role it has no name for, its JSON's role "other"). */
const PRESENT = new Set(["present", "other", "participant"]);

/**
 * A participant's role and note as a file gives them (a GEDCOM's RELA and NOTE, the Strom app's JSON role and note):
 * the role the RELA names, else — a role the Strom app has no name for (a midwife, an informant: "RELA Present") — the
 * one its note names. The note is the user's own words and is kept whole ("porodní bába" a midwife and her note); only
 * the research's own RELA word the app puts in front of a note ("Midwife — z Kamenice") is not theirs, the rest is.
 */
export function participantRole(rela: string | undefined, note: string | undefined, fallback: ParticipantRole): { role: ParticipantRole; note?: string } {
  const r = rela?.trim();
  const named = r && !PRESENT.has(foldText(r)) ? roleWord(r) : undefined;
  const text = said(note);
  if (named && named !== "other") return { role: named, ...(text ? { note: text } : {}) };
  const m = text ? /^([^—–]{1,40}?)\s*(?:[—–]\s*(.*))?$/u.exec(text) : null;
  const fromNote = m && m[1]!.trim().split(/\s+/u).length <= 3 ? roleWord(m[1]) : undefined;
  if (fromNote) {
    const rest = m![2]?.trim();
    if (foldText(m![1]!) === foldText(RELA[fromNote] ?? "")) return { role: fromNote, ...(rest ? { note: rest } : {}) };
    return { role: fromNote, note: text };
  }
  return { role: named ?? (r && PRESENT.has(foldText(r)) ? "other" : fallback), ...(text ? { note: text } : {}) };
}

/**
 * The RELA a participant is written with for the Strom app: a role it has no name for (a midwife, an informant) whose
 * note says it ("porodní bába") as "Present" — the app keeps the note as the user wrote it, and the research reads the
 * role from it again; any other the research's own word (Godparent, Midwife).
 */
export function relaForApp(role: ParticipantRole, note: string | undefined): string {
  const rela = RELA[role] ?? "Participant";
  if (role !== "midwife" && role !== "informant") return rela;
  const back = participantRole("Present", note, "other");
  return back.role === role && !!back.note && back.note === said(note) ? "Present" : rela;
}

// ── GEDCOM 7 ROLE and the roles of other programs' shared events ──────────────────────────────────────────────────

/** GEDCOM 7's ROLE values that are roles of ours. */
const GEDCOM7_OURS: Record<string, ParticipantRole> = { GODP: "godparent", WITN: "witness", CLERGY: "officiant", OFFICIATOR: "officiant" };

/** GEDCOM 7's other ROLE values: a participant of the role "other", the word said in the research's language. */
const GEDCOM7_OTHER: Record<string, PhraseKey> = {
  CHIL: "role.child",
  FATH: "role.father",
  FRIEND: "role.friend",
  HUSB: "role.husband",
  MOTH: "role.mother",
  MULTIPLE: "role.multiple",
  NGHBR: "role.neighbour",
  PARENT: "role.parent",
  SPOU: "role.spouse",
  WIFE: "role.wife",
};

/** A text of a file as a note: composed (NFC), on one line, the spaces between words one. */
const said = (text: string | undefined): string => (text ?? "").normalize("NFC").replace(/\s+/gu, " ").trim();

/**
 * The role a participant has by a GEDCOM 7 ROLE (under an ASSO of an event: GODP, WITN, CLERGY, OFFICIATOR; OTHER with
 * its PHRASE) or by the role another program gives a shared event (_SHAR of RootsMagic, Legacy, Family Historian:
 * "Witness", "Principal"…). A value we have no role for is `other`, its word kept as the note — a GEDCOM 7 value said in
 * the research's language (`lang`: NGHBR → "neighbour", "soused"), another program's word as the file gives it
 * ("Principal", "Household"). A PHRASE that says more than the role is kept as the note. Undefined: no value.
 */
export function gedcomRole(value: string | undefined, phraseText: string | undefined, lang: string): { role: ParticipantRole; note?: string } | undefined {
  const word = said(value);
  if (!word) return undefined;
  const more = said(phraseText);
  const extra = more && !roleWord(more) ? { note: more } : {};
  const up = word.toUpperCase();
  const ours = GEDCOM7_OURS[up];
  if (ours) return { role: ours, ...extra };
  if (up === "OTHER") return { role: roleWord(more) ?? "other", ...extra };
  const other = GEDCOM7_OTHER[up];
  if (other) return { role: "other", note: more || phrase(lang, other) };
  const named = roleWord(word);
  if (named) return { role: named, ...extra };
  return { role: "other", note: more ? `${word}: ${more}` : word };
}

/** What a shared event's marks under a fact read as (the GEDCOM's or the Strom app's JSON). */
export interface EventMarks {
  share?: EventShare;
  roleAt?: EventRoleAt;
  /** A mark of a shared event whose ID is not one (not 1–64 letters and digits): the fact taken without it. */
  unreadable?: string;
}

/** The mark of a shared event from its ID and the person's role in it; `unreadable` for an ID that is none. */
export function shareMark(id: string | undefined, role?: string): EventMarks {
  const v = (id ?? "").trim();
  if (!v) return {};
  if (!SHARE_ID.test(v)) return { unreadable: v };
  const r = said(role);
  return { share: { id: v, ...(r ? { role: r } : {}) } };
}

/** A role at another's event from its words: the role (one not ours is other), whose (P…, F…) and the kind (a known tag). */
export function roleAtMark(role: string | undefined, at?: string, kind?: string): EventRoleAt | undefined {
  const r = said(role).toLowerCase();
  if (!r) return undefined;
  const k = said(kind).toUpperCase();
  return {
    role: PARTICIPANT_ROLES.includes(r as ParticipantRole) ? (r as ParticipantRole) : "other",
    ...(at && /^[PF]\d{4,}$/.test(at) ? { at } : {}),
    ...(k && k in EVENT_KINDS ? { kind: k } : {}),
  };
}

/**
 * The marks under a fact of a GEDCOM file: `2 _STROM_SHARE <id>` (`3 _ROLE` or `3 ROLE`; a person's fact only) and
 * `2 _STROM_ROLE <role>` (`3 _STROM_AT @…@`, `4 TYPE <tag>`). `ref` gives our ID of a person's or a family's xref
 * (none: the role without whose); `atXref` the pointer as the file has it.
 */
export function eventMarksOf(node: GedNode, person: boolean, ref: (xref: string) => string | undefined): EventMarks & { atXref?: string } {
  const out: EventMarks & { atXref?: string } = {};
  const share = person ? node.children.find((c) => c.tag === "_STROM_SHARE") : undefined;
  if (share) {
    const roleNode = share.children.find((c) => c.tag === "_ROLE") ?? share.children.find((c) => c.tag === "ROLE");
    Object.assign(out, shareMark(share.value, roleNode?.value));
  }
  const role = node.children.find((c) => c.tag === "_STROM_ROLE");
  if (role) {
    const at = role.children.find((c) => c.tag === "_STROM_AT");
    const xref = at?.value.trim();
    const mark = roleAtMark(role.value, xref ? ref(xref) : undefined, at?.children.find((c) => c.tag === "TYPE")?.value);
    if (mark) out.roleAt = mark;
    if (xref && /^@[^@\s]+@$/u.test(xref)) out.atXref = xref;
  }
  return out;
}
