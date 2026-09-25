// Stories of the ancestors (the setting `stories`, on by default): once records
// tell enough of a person's life, strom proposes the task of writing it for the
// family — and of adding to it when records brought more after it was written.
// The story goes into the family book of the Strom app (GEDCOM _STORY).

import type { Event, Person, Research, Task } from "./model.ts";
import { researchPeople } from "./frontier.ts";
import { displayName, familiesAsPartner, lifespan } from "./people.ts";
import { phrase } from "./phrases.ts";
import type { Tree } from "./tree.ts";

export type StoryProposal = Omit<Task, "id" | "type" | "created" | "updated" | "notes" | "state" | "origin">;

const FROM_RECORDS = new Set(["proven", "probable"]);
const BIRTHS = new Set(["BIRT", "CHR", "BAPM"]);
const OPEN = new Set(["open", "doing", "parked", "waiting"]);
const FINISHED = new Set(["done", "dropped"]);

/** Enough to tell a life: a birth or baptism from a record, and more facts from records. */
export const STORY_MIN_FACTS = 3;
/** New facts from records that make a written story worth adding to. */
export const STORY_NEW_FACTS = 2;

/** The facts of a person's life that records support: their own, and their marriages. */
export function factsFromRecords(tree: Tree, p: Person): Event[] {
  const own = p.events.filter((e) => !e.retracted && FROM_RECORDS.has(e.status));
  const marriages = familiesAsPartner(tree, p.id).flatMap((f) => f.events.filter((e) => !e.retracted && FROM_RECORDS.has(e.status)));
  return [...own, ...marriages];
}

/** The stories strom proposes to write (or add to) for the ancestors of a research. */
export function storyProposals(tree: Tree, research: Research): StoryProposal[] {
  const lang = tree.lang;
  const narrate = tree.list<Task>("task").filter((t) => t.level === "narrate");
  const out: StoryProposal[] = [];
  for (const [id, generation] of researchPeople(tree, research)) {
    const p = tree.get<Person>(id);
    if (!p || p.retracted) continue;
    const facts = factsFromRecords(tree, p);
    if (facts.length < STORY_MIN_FACTS || !facts.some((e) => BIRTHS.has(e.kind))) continue;
    const mine = narrate.filter((t) => t.subject.includes(id));
    if (mine.some((t) => OPEN.has(t.state))) continue;
    // Dropped since the story was written (or with none): that was the answer — not again until the story changes.
    const since = p.story?.at ?? "";
    if (mine.some((t) => t.state === "dropped" && t.updated >= since)) continue;
    // Done, yet no story: somebody decided so; the user can add the task by hand.
    if (!p.story && mine.some((t) => FINISHED.has(t.state))) continue;
    const name = `${displayName(p)}${lifespan(p) ? ` (${lifespan(p)})` : ""}`;
    const fresh = p.story ? facts.filter((e) => !p.story!.facts.includes(e.id)) : facts;
    if (p.story && fresh.length < STORY_NEW_FACTS) continue;
    out.push({
      level: "narrate",
      priority: 1, // the research first; a story when there is a moment for it
      what: phrase(lang, p.story ? "story.more.what" : "story.what", { name, count: fresh.length }),
      where: [phrase(lang, "story.where", { id })],
      why: phrase(lang, "story.why", { count: facts.length, generation, research: research.name }),
      doneWhen: phrase(lang, "story.done", { id }),
      subject: [id],
      research: research.id,
    });
  }
  return out;
}
