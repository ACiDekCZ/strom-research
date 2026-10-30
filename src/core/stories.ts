// Stories of the ancestors (the setting `stories`, on by default): once records
// tell enough of a person's life, strom proposes the task of writing it for the
// family — and of adding to it when records brought more after it was written.
// The story goes into the family book of the Strom app (GEDCOM _STORY). Before
// it (the setting `stories.sources`, on by default), once per person a search
// beyond the registers — newspapers, directories, military, land and court
// records, graves, the history of the place — so the story can tell more, every
// word still on a record; the story is proposed when that search is finished.
// A couple's story too, once one of the two has a story of their own: their life
// together alone (the wedding, the household, the homes, the children, the
// widowhood); what the partners' stories tell is referred to, never told again.

import type { Event, Family, Person, Research, Task } from "./model.ts";
import { researchPeople } from "./frontier.ts";
import { displayName, familiesAsPartner, lifespan } from "./people.ts";
import { phrase } from "./phrases.ts";
import type { Tree } from "./tree.ts";
import { Settings } from "./config.ts";

export type StoryProposal = Omit<Task, "id" | "type" | "created" | "updated" | "notes" | "state" | "origin"> & { origin?: string };

/** The origin of the search beyond the registers that comes before a story (an enrich task). */
export const STORY_SOURCES_ORIGIN = "story:sources";

/**
 * The web pages a search beyond the registers fetches or reads for one person before it writes down what it searched
 * and closes (two such sessions cost $7 and found nothing on the person). strom cannot count an agent's own fetches: the
 * brief says it, the session records its searches.
 */
export const ENRICH_PAGES = 15;

/** Work for a story: writing it, or the search beyond the registers before it — the queue keeps them after the research. */
export function forStory(t: Pick<Task, "level" | "origin">): boolean {
  return t.level === "narrate" || t.origin === STORY_SOURCES_ORIGIN;
}

const FROM_RECORDS = new Set(["proven", "probable"]);
const BIRTHS = new Set(["BIRT", "CHR", "BAPM"]);
const MARRIAGES = new Set(["MARR"]);
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

/**
 * The facts of a couple's life together that records support: the family's own (the wedding, the homes, …) and the
 * birth or baptism of each child — and whether they show the couple (a wedding or a child from a record).
 */
export function coupleFacts(tree: Tree, f: Family): { facts: Event[]; shown: boolean } {
  const own = f.events.filter((e) => !e.retracted && FROM_RECORDS.has(e.status));
  const births = f.children.flatMap((c) => {
    const child = tree.get<Person>(c.person);
    const birth = child && !child.retracted ? child.events.find((e) => !e.retracted && FROM_RECORDS.has(e.status) && BIRTHS.has(e.kind)) : undefined;
    return birth ? [birth] : [];
  });
  return { facts: [...own, ...births], shown: births.length > 0 || own.some((e) => MARRIAGES.has(e.kind)) };
}

/** Has the person a story of their own — written, or the task of it done? */
function toldAlone(p: Person, narrate: Task[]): boolean {
  return !!p.story || narrate.some((t) => t.state === "done" && t.subject.includes(p.id));
}

/** The stories strom proposes to write (or add to) for the ancestors of a research. */
export function storyProposals(tree: Tree, research: Research): StoryProposal[] {
  const lang = tree.lang;
  const tasks = tree.list<Task>("task");
  const narrate = tasks.filter((t) => t.level === "narrate");
  const sources = new Settings(tree.env, {}).storySources(tree.config);
  const out: StoryProposal[] = [];
  const people = researchPeople(tree, research);
  for (const [id, generation] of people) {
    const p = tree.get<Person>(id);
    if (!p || p.retracted) continue;
    const facts = factsFromRecords(tree, p);
    if (facts.length < STORY_MIN_FACTS || !facts.some((e) => BIRTHS.has(e.kind))) continue;
    const fresh = due(p, facts, narrate);
    if (!fresh) continue;
    const name = `${displayName(p)}${lifespan(p) ? ` (${lifespan(p)})` : ""}`;
    // First, once, the search beyond the registers; the story waits while it is open, and comes when it is finished
    // (done, or dropped: the user's answer about the search, not about the story).
    if (sources) {
      const before = tasks.filter((t) => t.origin === STORY_SOURCES_ORIGIN && t.subject.includes(id));
      if (before.some((t) => OPEN.has(t.state))) continue;
      if (!before.length) {
        out.push({
          level: "enrich",
          priority: 1, // with the stories: after the research
          what: phrase(lang, "story.sources.what", { name }),
          where: [phrase(lang, "story.sources.where")],
          why: phrase(lang, "story.sources.why"),
          doneWhen: phrase(lang, "story.sources.done"),
          subject: [id],
          research: research.id,
          origin: STORY_SOURCES_ORIGIN,
        });
        continue;
      }
    }
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
  // The couples of the research, once one of the two has a story of their own: their life together, the partners'
  // stories given to the agent as what is told already. The search beyond the registers was each partner's.
  for (const f of tree.list<Family>("family")) {
    if (f.retracted || f.noCouple || f.partners.length !== 2 || !f.partners.some((x) => people.has(x))) continue;
    const partners = f.partners.map((x) => tree.get<Person>(x));
    if (partners.some((x) => !x || x.retracted)) continue;
    const [a, b] = partners as [Person, Person];
    if (!toldAlone(a, narrate) && !toldAlone(b, narrate)) continue;
    const { facts, shown } = coupleFacts(tree, f);
    if (!shown || facts.length < STORY_MIN_FACTS) continue;
    const fresh = due(f, facts, narrate);
    if (!fresh) continue;
    const generation = Math.min(...f.partners.map((x) => people.get(x) ?? Infinity));
    const names = { a: displayName(a), b: displayName(b) };
    out.push({
      level: "narrate",
      priority: 1, // like a person's: after the research
      what: phrase(lang, f.story ? "story.couple.more.what" : "story.couple.what", { ...names, count: fresh.length }),
      where: [phrase(lang, "story.couple.where", { id: f.id }), ...[a, b].filter((x) => x.story).map((x) => phrase(lang, "story.couple.partner", { name: displayName(x), id: x.id }))],
      why: phrase(lang, "story.couple.why", { count: facts.length, generation, research: research.name }),
      doneWhen: phrase(lang, "story.couple.done", { id: f.id }),
      subject: [f.id],
      research: research.id,
    });
  }
  return out;
}

/**
 * The new facts a story of the person or couple is due for — all of them before it is written — or undefined: its task
 * open, dropped since the story was written (that was the answer), done with no story, or too few new since.
 */
function due(rec: Person | Family, facts: Event[], narrate: Task[]): Event[] | undefined {
  const mine = narrate.filter((t) => t.subject.includes(rec.id));
  if (mine.some((t) => OPEN.has(t.state))) return undefined;
  // The latest version written: a new one waiting beside an approved story, else the story.
  const latest = rec.story?.draft ?? rec.story;
  // Dropped since the story was written (or with none): that was the answer — not again until the story changes.
  const since = latest?.at ?? "";
  if (mine.some((t) => t.state === "dropped" && t.updated >= since)) return undefined;
  // Done, yet no story: somebody decided so; the user can add the task by hand.
  if (!rec.story && mine.some((t) => FINISHED.has(t.state))) return undefined;
  const fresh = latest ? facts.filter((e) => !latest.facts.includes(e.id)) : facts;
  if (rec.story && fresh.length < STORY_NEW_FACTS) return undefined;
  return fresh;
}

/** The new versions of approved stories that wait for the user (the lock): whose, and since when. */
export function storiesToApprove(tree: Tree): { id: string; at: string }[] {
  return [...tree.list<Person>("person"), ...tree.list<Family>("family")]
    .filter((r) => !r.retracted && r.story?.status === "final" && r.story.draft)
    .map((r) => ({ id: r.id, at: r.story!.draft!.at }))
    .sort((a, b) => a.at.localeCompare(b.at));
}
