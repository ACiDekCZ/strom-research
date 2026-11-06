// Two different questions, kept apart:
//
//   How good is this evidence?   — a property of one citation: the source
//     (original / derivative / authored) and its information for this fact
//     (primary: written at the time by someone who knew; secondary; unknown).
//     GEDCOM carries it as QUAY on the citation.
//   How sure is the conclusion?  — the status of the fact (proven … lead),
//     drawn from all of its evidence.
//
// The status may not claim more than the evidence gives: a family tree or a
// memory never proves anything, and "proven" needs the original record itself
// (isOriginalHere: never a copy, an index or the Strom app's word for it) with
// primary information for the fact.

import { UsageError } from "./errors.ts";
import type { Citation, Search, Source, Status } from "./model.ts";
import type { Tree } from "./tree.ts";

/**
 * What a search came to, as said beside it: a negative of an index is the index's — an index is a copy, written by
 * another hand and maybe incomplete, so the book itself is not searched in vain by it (core/edge.ts counts it so too).
 */
export function searchedAs(s: Pick<Search, "result" | "method">): string {
  return s.result === "negative" && s.method === "index" ? "negative in the index only" : s.result;
}

/**
 * Sources compiled by someone, not a record of the event: a family tree, someone's memory, an authored work. The sync
 * with the Strom app weighs the user's edits by it (a fact a record backs is a conflict, one only these back is
 * corrected) — an index stays a record there, as it always was.
 */
export function isCompiled(src: Source | undefined): boolean {
  return !src || src.kind === "family-tree" || src.kind === "family-memory" || src.form === "authored";
}

/**
 * Sources that are leads by nature, proving nothing: compiled ones, and an index — a later copy by another hand that
 * only leads to the entry (the entry itself is what proves it). A fact they alone cite stays a lead.
 */
export function isWeak(src: Source | undefined): boolean {
  return isCompiled(src) || src!.kind === "index";
}

/**
 * The original record as the research itself knows it: a source of the form original that is a record (no index, no
 * compiled work), not retracted — and never one the Strom app alone says is an original (its QUAY on a source of its
 * own: the user's word, or another program's carried over; a source of the app's counts once the research read it,
 * a reading of a document confirmed there). A copy, a transcript of another hand's (derivative), an index: no original.
 */
export function isOriginalHere(src: Source | undefined): boolean {
  if (!src || src.retracted || src.form !== "original" || isWeak(src)) return false;
  return !src.app || !!src.reading;
}

/** A citation that can make a fact proven: of the original record (isOriginalHere), with primary information for it. */
export function provesIt(tree: Pick<Tree, "get">, c: Citation): boolean {
  const src = tree.get<Source>(c.source);
  return isOriginalHere(src) && informationOf(src, c) === "primary";
}

/** The information of a source for one fact: the citation's own assessment wins. */
export function informationOf(src: Source | undefined, c: Citation): "primary" | "secondary" | "unknown" {
  return c.information ?? src?.information ?? "unknown";
}

/**
 * GEDCOM 5.5.1 QUAY of one citation: 3 direct and primary, 2 secondary
 * (recorded later), 1 questionable reliability, 0 unreliable or estimated.
 */
export function quay(src: Source | undefined, c: Citation): 0 | 1 | 2 | 3 {
  if (!src || src.kind === "family-tree" || src.kind === "family-memory") return 0;
  if (src.form === "authored") return 1;
  const info = informationOf(src, c);
  if (src.form === "original") return info === "primary" ? 3 : 2;
  return info === "primary" ? 2 : 1; // derivative: a copy, an index, a transcript
}

/** The status a fact gets when none is given. */
export function defaultStatus(tree: Tree, citations: Citation[]): Status {
  if (citations.length === 0) return "lead";
  return citations.some((c) => !isWeak(tree.get<Source>(c.source))) ? "probable" : "lead";
}

/** Refuse a status the evidence cannot carry, with what to do instead. */
export function checkStatus(tree: Tree, status: Status, citations: Citation[]): void {
  if (status !== "proven" && status !== "probable") return;
  if (citations.length === 0)
    throw new UsageError(`status ${status} needs a citation`, { hint: 'cite the record: --cite S0001 --locator "fol. 12" (or keep it a lead: --status lead)' });
  const strong = citations.filter((c) => !isWeak(tree.get<Source>(c.source)));
  if (strong.length === 0)
    throw new UsageError(`a family tree, a memory, a compiled work or an index cannot make a fact ${status}`, {
      hint: "keep it a lead (or --status possible) until a record says it: cite that record (an index leads to the entry — read the entry itself)",
    });
  if (status !== "proven") return;
  const originals = strong.filter((c) => isOriginalHere(tree.get<Source>(c.source)));
  if (!originals.length)
    throw new UsageError("proven needs the original record itself: a copy, an index, a transcript of another hand's or what the Strom app says of a source gives at most probable", {
      hint: "cite the original record (its image, read by the research: a source of --form original) — otherwise --status probable",
      code: "status.original",
    });
  if (!originals.some((c) => informationOf(tree.get<Source>(c.source), c) === "primary"))
    throw new UsageError("proven needs a record written at the time by someone who knew (primary information)", {
      hint: "if the record is like that: --information primary on the citation (or the source); otherwise --status probable",
    });
}

export const INFORMATION = ["primary", "secondary", "unknown"] as const;
