// The roles people have in a record, whatever language they are written in:
// "kmotr", "Pate", "svědek", "Hebamme", "oddávající" — and RELA of other programs.

import { foldText } from "./text.ts";
import { PARTICIPANT_ROLES, type ParticipantRole } from "./model.ts";

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
