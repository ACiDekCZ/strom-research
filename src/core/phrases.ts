// Texts strom itself writes into a research (the tasks it proposes: frontier,
// intake) are in the research language, like everything the agent writes.
// English is built in; a language adds assets/lang/<code>.json with the same
// keys (any it leaves out stay English). {name} marks a value filled in.

import { readAsset } from "./assets.ts";

export const PHRASES = {
  "estimate.marriage": "their marriage {year}",
  "estimate.child": "the eldest child known, {year}",
  "reason.unknown": "parents unknown",
  "reason.unproven": "parents not proven by a record",
  "born.about": " (born ~{year}, estimated from {from})",
  "the.birthplace": "the birthplace",
  "whole.book": "the whole book",

  "link.what": "Baptism of {name}{place}{about}",
  "link.place": ", {place}",
  "link.why": "{reason}; the baptism entry names both parents (generation {generation} of {research})",
  "link.done": "entry found and recorded with its parents — or {years} searched without it",

  "locate.what": "Where are the baptisms of {place}{around}? (for {name}{about})",
  "locate.around": " around {year}",
  "locate.where": "jurisdiction of {place}",
  "locate.where.unknown": "birthplace unknown — find it first",
  "locate.years": ", years {from}–{to}",
  "locate.why": "{reason}; no record set is known for the place and time",
  "locate.done": "a record set with access (URL or call number) is recorded and a link task points at it",

  "request.what": "Ask for the records of {name}: {tasks} found nothing",
  "request.where": "the archive or parish holding the records of {place}, or the family",
  "request.why": "{reason}; the record sets and archives known so far are exhausted",
  "request.done": "a request is sent (strom task wait … --on \"<reply>\") or the user decides the line ends here",

  "story.what": "Write the story of {name}",
  "story.more.what": "Add to the story of {name}: {count} new facts",
  "story.where": "the facts recorded (strom person show {id})",
  "story.why": "{count} facts from records tell the life (generation {generation} of {research}); the family reads it in the Strom app's family book",
  "story.done": "strom story set {id} with every fact it rests on (--fact) — a draft until the user approves it",

  "session.user": "stopped by the user",
  "session.run": "the run stopped before the session ended (interrupted, or the computer went down)",
  "session.chat": "the conversation ended before the session was closed",
  "session.agent": "the agent stopped ({outcome}) without closing the session",

  "intake.files": "Analyse {count} files from {folder} ({first}–{last})",
  "intake.the.material": "the material",
  "intake.tree.imported": "Review imported tree {id} ({name})",
  "intake.tree.read": "Read the family tree {id} ({name}), not imported",
  "intake.text": "Process text {id}",
  "intake.text.file": "Process text {id} ({name})",
  "intake.other": "Analyse {id} ({name})",
  "intake.why.imported": "{persons} persons came in as leads{matched}: they guide the research, they prove nothing.",
  "intake.why.matched": ", {matched} matched existing persons",
  "intake.why.read": "Registered without importing it: nothing of it is in the tree; what it says can guide the research, it proves nothing.",
  "intake.why": "Material from the user: find out who and what it is about, and what it can prove.",
  "intake.done.imported": "the leads are checked for obvious mistakes (duplicates, impossible dates) and the first locate/link tasks exist",
  "intake.done.read": "what it adds to the tree is entered as leads citing it (strom source add … --kind family-tree --form authored --input {id}) — or the input is skipped with a reason (strom input skip {id} --reason …)",
  "intake.done": "every person and fact in it is recorded (a source if it is an original document, leads otherwise) and cited — or the input is skipped with a reason (strom input skip I… --reason …)",
} as const;

export type PhraseKey = keyof typeof PHRASES;

const catalogs = new Map<string, Record<string, string>>();

/**
 * The catalog of a language (assets/lang/<code>.json); empty when there is none.
 * It holds these phrases and the texts a person reads in the guided menu (ui.*, src/cli/ui.ts).
 */
export function catalog(lang: string): Record<string, string> {
  if (!/^[a-z]{2,3}$/.test(lang) || lang === "en") return {};
  if (!catalogs.has(lang)) {
    let parsed: Record<string, string> = {};
    try {
      parsed = JSON.parse(readAsset("lang", `${lang}.json`) ?? "{}");
    } catch {
      // a broken catalog must not stop the research: English it is
    }
    catalogs.set(lang, parsed);
  }
  return catalogs.get(lang)!;
}

/** A template with its {values} filled in (an unknown {name} stays as it is). */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, name: string) => (name in values ? String(values[name]) : m));
}

/** A text of a language's catalog, or the English one where the catalog has none. */
export function localized(lang: string, key: string, english: string, values: Record<string, string | number> = {}): string {
  const own = catalog(lang)[key];
  return fill(typeof own === "string" && own ? own : english, values);
}

/** A text in the research language, its {values} filled in. */
export function phrase(lang: string, key: PhraseKey, values: Record<string, string | number> = {}): string {
  return localized(lang, key, PHRASES[key], values);
}
