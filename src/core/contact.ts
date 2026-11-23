// A person's contact (spec 134 U11): the e-mail addresses another program gives a person in its GEDCOM — a
// residence (RESI) carrying nothing but an e-mail (MyHeritage: "2 EMAIL x", or "2 ADDR" / "3 ADR1 Email" beside it;
// the Strom app up to 3.31: a residence whose note is "E-mail: x"), or "1 EMAIL" right under the person. One rule,
// used by strom intake, strom sync and the checks of a research alike: what is no residence is never taken as one,
// a label in place of an address is never a house, and nothing beyond an address the value is guessed.

import type { GedNode } from "../gedcom/parse.ts";
import { LABELS } from "../gedcom/labels.ts";
import { foldText } from "./text.ts";
import type { Event, Person } from "./model.ts";

/** What a residence (or a person) gives of a contact. */
export interface ContactOf {
  /** The e-mail addresses, trimmed, NFC, each once (letter case aside). */
  emails: string[];
  /**
   * The residence holds nothing of a residence — no date, place, address, citation, media, age, cause, witness, note of
   * its own — but something of a contact (an e-mail, a phone, a label in place of an address): no event.
   */
  onlyContact: boolean;
  /** What of a contact the research does not keep (PHON, FAX, WWW): by tag, once a line — said, never taken. */
  notTaken: string[];
}

/** The tags of a contact the research does not keep. */
export const CONTACT_NOT_TAKEN = ["PHON", "FAX", "WWW"] as const;

/** The parts of an address (GEDCOM 5.5.1 ADDRESS_STRUCTURE) under ADDR. */
const ADDRESS_PARTS = new Set(["ADR1", "ADR2", "ADR3", "CITY", "STAE", "POST", "CTRY"]);

/** Another program's own marks of an event that say nothing of it (its IDs, strom's status and origin). */
const MARK_ONLY = /^_(?:EID|STROM_EID|STROM_STATUS|STROM_ORIGIN|UID|RIN|UPD)$/u;

/** A label another program writes in place of an address (MyHeritage "3 ADR1 Email"), folded (as the app's ADDRESS_PART_LABEL). */
const ADDRESS_LABELS = new Set(["email", "e-mail", "e mail", "mail", "phone", "telephone", "telefon", "tel", "tel.", "fax", "www", "web"]);

/** A note line of the Strom app (up to 3.31) holding an e-mail: "E-mail: x" (cs, en, pl), "E-Mail: x" (de), "Email: x". */
const EMAIL_LINE = /^e-?mail\s*:\s*(\S+@\S+)$/iu;

/** The status words of strom's export (a lead's, a possible fact's) the app gives back in the note: no note of the user's. */
const STATUS_LINES = new Set(Object.values(LABELS).flatMap((l) => [l.lead, l.possible].map(line)));

function line(t: string): string {
  return t.normalize("NFC").replace(/\s+/gu, " ").trim();
}

/** An e-mail address as the research keeps it — trimmed, NFC, something@something with no space — or nothing. */
export function emailOf(raw: string | undefined | null): string | undefined {
  if (typeof raw !== "string") return undefined;
  const v = raw.normalize("NFC").trim();
  return /^\S+@\S+$/u.test(v) ? v : undefined;
}

/** The e-mail addresses of both, each once (letter case aside), in their order: the first's first. */
export function joinEmails(a: readonly string[] | undefined, b: readonly string[] | undefined): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const x of [...(a ?? []), ...(b ?? [])]) {
    const e = emailOf(x);
    if (!e || seen.has(e.toLowerCase())) continue;
    seen.add(e.toLowerCase());
    out.push(e);
  }
  return out;
}

/** Whether two lists hold the same addresses (letter case and order aside). */
export function sameEmails(a: readonly string[] | undefined, b: readonly string[] | undefined): boolean {
  const k = (l: readonly string[] | undefined) => [...new Set((l ?? []).map((x) => x.toLowerCase()))].sort().join("\n");
  return k(a) === k(b);
}

/** Whether an address field holds only a label another program writes in place of the address ("Email", "Telefon:"). */
export function addressLabel(s: string | undefined): boolean {
  if (!s) return false;
  return ADDRESS_LABELS.has(foldText(s).replace(/\s*:$/u, ""));
}

/** An address field's value unless it is empty or a label in place of the address. */
export function realAddress(s: string | undefined): string | undefined {
  const v = s?.trim();
  return v && !addressLabel(v) ? v : undefined;
}

/** The address an ADDR gives — its first line (ADR1) or its own value — a label in place of one never. */
export function addressText(addr: GedNode | undefined): string | undefined {
  if (!addr) return undefined;
  return realAddress(addr.children.find((c) => c.tag === "ADR1")?.value) ?? realAddress(addr.value);
}

/** The e-mail addresses of a note made of them alone (with at most a status word of strom's export), else nothing. */
export function noteEmails(text: string | undefined): string[] | undefined {
  const lines = (text ?? "").split(/\r\n|\r|\n/u).map(line).filter(Boolean);
  const emails: string[] = [];
  let status = 0;
  for (const l of lines) {
    const m = EMAIL_LINE.exec(l);
    const e = m ? emailOf(m[1]) : undefined;
    if (e) emails.push(e);
    else if (STATUS_LINES.has(l) && ++status === 1) continue;
    else return undefined;
  }
  return emails.length ? joinEmails(emails, []) : undefined;
}

/** A note with a line "E-mail: x" in it (beside other text too). */
export function noteMentionsEmail(text: string | undefined): boolean {
  return (text ?? "").split(/\r\n|\r|\n/u).some((l) => EMAIL_LINE.test(line(l)));
}

/**
 * A residence with nothing of a residence in it (spec 134 U11): no date, place, real house (a label "Email" is none),
 * value, label, age, cause, people at it, share or role — its note nothing (or only e-mail lines, a status word beside
 * them). What a contact of another program or of the Strom app left as a fact before strom took it for the contact:
 * never a place someone lived, never a fact to fill in.
 */
export function contactOnlyEvent(e: Event): boolean {
  if (e.kind !== "RESI") return false;
  if (e.date || e.place || e.value || e.label || e.age || e.cause || e.share || e.roleAt || e.confirmed) return false;
  if (e.ages && Object.keys(e.ages).length) return false;
  if (e.participants?.length) return false;
  if (e.house && !addressLabel(e.house)) return false;
  return !e.note?.trim() || noteEmails(e.note) !== undefined;
}

/**
 * What a residence (1 RESI of a person) gives of a contact. A residence with anything of a residence stays one: its
 * EMAIL lines go to the contact (never into its note), the rest of it as it is. One with nothing but a contact is no
 * event: its e-mails — EMAIL lines and the note lines "E-mail: x" — are the person's contact.
 */
export function residenceContact(resi: GedNode, noteText: (n: GedNode) => string = (n) => n.value): ContactOf {
  const emails: string[] = [];
  const noted: string[] = [];
  const notTaken: string[] = [];
  let content = !!resi.value.trim() && resi.value.trim().toUpperCase() !== "Y";
  let something = false;
  const contactLine = (c: GedNode): boolean => {
    if (c.tag === "EMAIL") {
      const e = emailOf(c.value);
      if (e) emails.push(e);
      else if (c.value.trim()) notTaken.push(c.tag);
      something = true;
      return true;
    }
    if ((CONTACT_NOT_TAKEN as readonly string[]).includes(c.tag)) {
      if (c.value.trim()) notTaken.push(c.tag);
      something = true;
      return true;
    }
    return false;
  };
  for (const c of resi.children) {
    if (contactLine(c) || MARK_ONLY.test(c.tag)) continue;
    if (c.tag === "ADDR") {
      if (realAddress(c.value)) content = true;
      else if (c.value.trim()) something = true;
      for (const a of c.children) {
        if (contactLine(a)) continue;
        if (ADDRESS_PARTS.has(a.tag) && !realAddress(a.value)) {
          if (a.value.trim()) something = true;
          continue;
        }
        content = true;
      }
      continue;
    }
    if (c.tag === "NOTE") {
      const said = !c.children.length ? noteEmails(noteText(c)) : undefined;
      if (!said) content = true;
      else {
        noted.push(...said);
        something = true;
      }
      continue;
    }
    content = true;
  }
  if (content) return { emails: joinEmails(emails, []), onlyContact: false, notTaken };
  return { emails: joinEmails(emails, noted), onlyContact: something, notTaken };
}

/** What a person (0 INDI) gives of a contact right under it: "1 EMAIL x" (PHON, FAX, WWW said, not taken). */
export function personContact(indi: GedNode): ContactOf {
  const emails: string[] = [];
  const notTaken: string[] = [];
  for (const c of indi.children) {
    if (c.tag === "EMAIL") {
      const e = emailOf(c.value);
      if (e) emails.push(e);
      else if (c.value.trim()) notTaken.push(c.tag);
    } else if ((CONTACT_NOT_TAKEN as readonly string[]).includes(c.tag) && c.value.trim()) notTaken.push(c.tag);
  }
  return { emails: joinEmails(emails, []), onlyContact: false, notTaken };
}

/** All a person of a GEDCOM gives of a contact: "1 EMAIL" and their residences' e-mails (those that are none and those that are). */
export function gedcomPersonContact(indi: GedNode, noteText: (n: GedNode) => string = (n) => n.value): ContactOf {
  const own = personContact(indi);
  let emails = own.emails;
  const notTaken = [...own.notTaken];
  for (const c of indi.children) {
    if (c.tag !== "RESI") continue;
    const r = residenceContact(c, noteText);
    emails = joinEmails(emails, r.emails);
    notTaken.push(...r.notTaken);
  }
  return { emails, onlyContact: false, notTaken };
}

/** A residence event of the Strom app's JSON (its LifeEvent), as far as the rule reads it. */
export interface AppResidence {
  date?: unknown;
  place?: unknown;
  address?: unknown;
  cause?: unknown;
  age?: unknown;
  sourceIds?: unknown;
  participants?: unknown;
  shareId?: unknown;
  shareRole?: unknown;
  roleAt?: unknown;
  note?: unknown;
  /** The EMAIL lines the file the app loaded gave the event (the app from 3.32). */
  gedcomEmails?: unknown;
}

/** The same rule for a residence of the Strom app's JSON: its note's "E-mail: x" lines and its gedcomEmails. */
export function appResidenceContact(e: AppResidence): ContactOf {
  const has = (v: unknown) => (typeof v === "string" ? !!v.trim() : Array.isArray(v) ? v.length > 0 : v !== undefined && v !== null && v !== false);
  const given = Array.isArray(e.gedcomEmails) ? e.gedcomEmails.map((x) => emailOf(typeof x === "string" ? x : undefined)).filter((x): x is string => !!x) : [];
  const note = typeof e.note === "string" && e.note.trim() ? e.note : undefined;
  const noted = note ? noteEmails(note) : [];
  const content =
    has(e.date) || has(e.place) || !!realAddress(typeof e.address === "string" ? e.address : undefined) || has(e.cause) || has(e.age) ||
    has(e.sourceIds) || has(e.participants) || has(e.shareId) || has(e.shareRole) || has(e.roleAt) || noted === undefined;
  if (content) return { emails: joinEmails(given, []), onlyContact: false, notTaken: [] };
  const emails = joinEmails(given, noted);
  return { emails, onlyContact: emails.length > 0 || addressLabel(typeof e.address === "string" ? e.address : undefined), notTaken: [] };
}

/** The person with these e-mails as their contact (none: no list, an empty contact left out). */
export function withEmails(p: Person, emails: readonly string[]): Person {
  const { contact, ...rest } = p;
  const { emails: _was, ...other } = contact ?? {};
  const next = emails.length ? { ...other, emails: [...emails] } : other;
  return Object.keys(next).length ? { ...rest, contact: next } : rest;
}
