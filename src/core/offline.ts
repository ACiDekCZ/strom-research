// Work off the lines (spec 036): a task of a research with several lines (directions) that belongs to none of them —
// no research of its own, none of its people in any line (core/directions.ts directionOf): a side branch (an
// ancestor's sister and her husband), people linked to the tree only through others. It waits until the lines have
// nothing to do (queue.offLine: last, the default; normal — as before; never — not taken at all), unless it helps a
// line. Judged afresh each time from the tree as it is (nothing written: a research that updates is ordered so at once,
// a link recorded later moves the task by itself):
//   a) it serves a hypothesis or a conflict of a line — named on the task (--about H…/X…) or in its words — whose
//      people (those its variants would connect too) are in a line: that line;
//   b) it would join people to the tree — some of its people (or of the hypothesis it names) are kin of the tree, some
//      are not: the line it joins them to, the nearest by family links from the people of the tree it names;
//   c) the agent said how it helps (strom task add|edit --helps "<how>"): the line named there by its ID (G…), else the
//      nearest line by family links from its people — an ancestor's sibling is one link from that ancestor's line.
// A task about nobody (an archive, places, the history of a region) has its own rules and is never off the lines; nor
// is anything in a research with one line or none (everything is its).

import type { Conflict, Hypothesis, Task } from "./model.ts";
import type { Tree } from "./tree.ts";
import { aboutPeople, directionOf, hypothesisPeople, type Scope } from "./directions.ts";
import { kinship } from "./kin.ts";
import { familiesAsChild, familiesAsPartner } from "./people.ts";

export { OFF_LINE_CHOICES, type OffLine } from "./model.ts";

/** How a task helps a line: a hypothesis or conflict of the line, joining people to the tree, the agent's word. */
export type HelpsBy = "question" | "joins" | "agent";

export interface Placed {
  /** The line it belongs to: its own (directionOf), else the one it helps — undefined when none is known. */
  research?: string;
  /** It belongs to no line, but helps one (b: the line may be unknown). */
  helps?: HelpsBy;
  /** Off the lines and helping none: after the lines' work (queue.offLine). */
  off?: true;
}

/** How far family links are followed to find the line nearest to a task's people. */
const NEAREST_STEPS = 6;

/** Hypotheses and conflicts named in a task's words (what, why, done-when, the agent's word). */
const RECORD_ID = /(?<![\p{L}\p{M}\p{N}])[HX]\d{4,}(?![\p{L}\p{M}\p{N}])/gu;

/** Research IDs named in a text. */
const RESEARCH_ID = /(?<![\p{L}\p{M}\p{N}])G\d{4,}(?![\p{L}\p{M}\p{N}])/gu;

/**
 * Where each task stands among the lines (computed once per call of the queue or an overview: the kin of the tree and
 * the lines' people are worked out once). `all`: the scopes of the research (core/directions.ts scopes).
 */
export function placer(tree: Tree, all: Scope[]): (t: Pick<Task, "subject" | "what" | "why" | "doneWhen"> & { research?: string; helps?: string }) => Placed {
  const lines = all.filter((s) => !s.research.retracted);
  let kin: ReturnType<typeof kinship> | undefined;
  const narrowest = (people: Iterable<string>): string | undefined => {
    const set = new Set(people);
    return lines
      .filter((s) => [...set].some((p) => s.people.has(p)))
      .sort((a, b) => a.people.size - b.people.size || a.research.id.localeCompare(b.research.id))[0]?.research.id;
  };
  /** The line nearest to these people by family links (partners, children, parents), the narrowest at the same step. */
  const nearest = (from: string[]): string | undefined => {
    const seen = new Set(from);
    let ring = [...from];
    for (let step = 0; step <= NEAREST_STEPS && ring.length; step++) {
      const found = narrowest(ring);
      if (found) return found;
      const next: string[] = [];
      for (const p of ring)
        for (const n of [...familiesAsPartner(tree, p).flatMap((f) => [...f.partners, ...f.children.map((c) => c.person)]), ...familiesAsChild(tree, p).flatMap((f) => f.partners)])
          if (!seen.has(n)) {
            seen.add(n);
            next.push(n);
          }
      ring = next;
    }
    return undefined;
  };
  return (t) => {
    const own = directionOf(tree, t, all);
    if (own) return { research: own };
    const about = aboutPeople(tree, t.subject);
    // nobody: an archive, places, history — their own rules; one line or none: everything is its
    if (!about.length || lines.length < 2) return {};
    // a) the hypotheses and conflicts it names, on the task or in its words
    const named = [...new Set([...t.subject, ...[t.what, t.why, t.doneWhen, t.helps ?? ""].flatMap((text) => text.match(RECORD_ID) ?? [])])];
    const questionPeople: string[] = [];
    for (const id of named) {
      const r = tree.get<Hypothesis | Conflict>(id);
      if (!r || r.retracted) continue;
      if (r.type === "hypothesis") questionPeople.push(...hypothesisPeople(tree, r));
      else if (r.type === "conflict") questionPeople.push(...aboutPeople(tree, r.subject));
    }
    const ofQuestion = narrowest(questionPeople);
    if (ofQuestion) return { research: ofQuestion, helps: "question" };
    // b) joining people to the tree: some of them kin of the tree, some not
    kin ??= kinship(tree);
    const people = [...new Set([...about, ...questionPeople])];
    const inTree = people.filter((p) => kin!.has(p));
    if (inTree.length && inTree.length < people.length) {
      const to = nearest(inTree);
      return { ...(to ? { research: to } : {}), helps: "joins" };
    }
    // c) the agent's word: the line named there, else the nearest one
    if (t.helps?.trim()) {
      const ids: string[] = t.helps.match(RESEARCH_ID) ?? [];
      const said = lines.find((s) => ids.includes(s.research.id));
      const to = said?.research.id ?? nearest(about);
      return { ...(to ? { research: to } : {}), helps: "agent" };
    }
    return { off: true };
  };
}

/** The line a task belongs to or helps (the menu's and the app's count of a line's tasks). */
export function lineOf(tree: Tree, all: Scope[]): (t: Task) => string | undefined {
  const place = placer(tree, all);
  return (t) => place(t).research;
}

