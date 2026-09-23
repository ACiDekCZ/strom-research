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
// memory never proves anything, and "proven" needs a record with primary
// information for the fact.

import { UsageError } from "./errors.ts";
import type { Citation, Source, Status } from "./model.ts";
import type { Tree } from "./tree.ts";

/** Sources that are leads by nature: compiled by someone, not a record of the event. */
export function isWeak(src: Source | undefined): boolean {
  return !src || src.kind === "family-tree" || src.kind === "family-memory" || src.form === "authored";
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
    throw new UsageError(`a family tree, a memory or a compiled work cannot make a fact ${status}`, {
      hint: "keep it a lead (or --status possible) until a record says it: cite that record",
    });
  if (status === "proven" && !strong.some((c) => informationOf(tree.get<Source>(c.source), c) === "primary"))
    throw new UsageError("proven needs a record written at the time by someone who knew (primary information)", {
      hint: "if the record is like that: --information primary on the citation (or the source); otherwise --status probable",
    });
}

export const INFORMATION = ["primary", "secondary", "unknown"] as const;
