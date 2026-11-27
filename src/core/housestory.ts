// The story of a house (spec 145 T4): a text for the family written from what the research found of the house and its
// municipality — its holders, the families in it over the generations, what happened to it, its numbers in time, its
// look — every statement on a fact of the house (its items: n…, e…, h…, r…) or of the tree's people who lived there
// (E…), what is uncertain said so. A draft until the person approves it, locked once approved, written again beside the
// approved one when the house brought more — as the story of a person (core/stories.ts, core/storykeep.ts).
//
// Its task comes by itself, with the stories on (the setting `stories`), once the house is researched — after the last
// step of its research (its research, or the look of the house where its check raised one) — and only when the house
// tells enough (HOUSE_STORY_GENERATIONS or HOUSE_STORY_PEOPLE); asked by the person whatever it tells (strom house story,
// the bridge's POST /houses/story). Its origin is story:house:<A…>, not house:… — writing is no research of the house:
// it changes no house's state, the houses off hold it not, the queue takes it as a story (forStory: level narrate).
//
// The story lives in the house's record (House.story, the Story of a person). The Strom file has no house yet (the app's
// gate): the app reads it over the bridge (GET /houses/<ref> story).

import { UsageError } from "./errors.ts";
import type { Event, House, HouseCertainty, HouseSource, Person, Place, Source, Status, Story, StoryDraft, Task } from "./model.ts";
import { findHouse, houseRows, type HouseRow } from "./houses.ts";
import { unreadWebClaims } from "./houseunread.ts";
import { familiesAsChild } from "./people.ts";
import { phrase } from "./phrases.ts";
import { create, update } from "./records.ts";
import { Settings } from "./config.ts";
import { actsAsArchive } from "./state.ts";
import { foldText } from "./text.ts";
import { now, type Tree } from "./tree.ts";
import { STORY_NEW_FACTS } from "./stories.ts";
import { latestVersion, linkKey, linksIn, sourcesNamed, storyLosses, storySources } from "./storykeep.ts";
import { citableSource } from "./evidence.ts";

/** The origin of a house's story task: story:house:<A…>. */
export const HOUSE_STORY_PREFIX = "story:house:";
export const houseStoryOrigin = (house: string): string => `${HOUSE_STORY_PREFIX}${house}`;

/** The house (A…) a task writes the story of, else undefined. */
export function houseStoryOf(t: Pick<Task, "origin">): string | undefined {
  return typeof t.origin === "string" && t.origin.startsWith(HOUSE_STORY_PREFIX) ? t.origin.slice(HOUSE_STORY_PREFIX.length) : undefined;
}

/** A house tells enough for a story by itself: this many generations of the tree in it (a parent and a child: 2)… */
export const HOUSE_STORY_GENERATIONS = 2;
/** …or this many holders and residents with their sources (each one once). */
export const HOUSE_STORY_PEOPLE = 3;

/** An item of a house a story may rest on: a number, an event of its timeline, a holder, a resident (n1, e2, h3, r4). */
export const HOUSE_STORY_ITEM = /^[nehr]\d+$/u;

const LIVE = new Set<Task["state"]>(["open", "doing", "parked", "waiting"]);
const FINISHED = new Set<Task["state"]>(["done", "dropped"]);
const CERTAINTY: Record<HouseCertainty | "probable", Status> = { high: "proven", medium: "probable", probable: "probable", guess: "possible" };

const citations = (sources: HouseSource[] | undefined) => (sources ?? []).filter((s) => !!s.source).map((s) => ({ source: s.source!, ...(s.page ? { locator: s.page } : {}) }));

/**
 * The facts a house's story may rest on, as facts (an item of the house as one of its own, its certainty as a status;
 * taken over unread from a page on the web: a lead) — its numbers, its timeline, its holders, its residents — and the
 * facts of the tree's people that are in it (E…).
 */
export function houseStoryFacts(tree: Tree, h: House, row?: HouseRow): Map<string, Event> {
  const out = new Map<string, Event>();
  const unread = new Set(unreadWebClaims(tree, [h]).map((c) => c.item));
  const add = (id: string, kind: string, certainty: HouseCertainty | "probable" | undefined, sources: HouseSource[] | undefined, extra: Partial<Event> = {}) =>
    out.set(id, { id, kind, status: unread.has(id) ? "lead" : CERTAINTY[certainty ?? "medium"], citations: citations(sources), ...extra });
  for (const n of h.numbers ?? []) if (!n.notSame) add(n.id, "number", n.certainty, n.sources, { value: n.number, ...(n.from || n.to ? { date: [n.from, n.to].filter(Boolean).join("–") } : {}) });
  for (const e of h.timeline ?? []) add(e.id, e.kind, e.certainty, e.sources, { value: e.text, ...(e.date ? { date: e.date } : {}) });
  for (const x of h.holders ?? []) add(x.id, "holder", x.certainty, x.sources, { value: x.name, ...(x.from || x.to ? { date: [x.from, x.to].filter(Boolean).join("–") } : {}) });
  for (const x of h.residents ?? []) add(x.id, `resident ${x.role}`, x.certainty, x.sources, { value: x.name, ...(x.from || x.to ? { date: [x.from, x.to].filter(Boolean).join("–") } : {}) });
  const r = row ?? rowOf(tree, h);
  for (const { event } of r?.tree?.events ?? []) if (!event.retracted) out.set(event.id, event);
  return out;
}

function rowOf(tree: Tree, h: House): HouseRow | undefined {
  return houseRows(tree, { town: h.place, on: true }).find((r) => r.id === h.id);
}

/**
 * What the house tells for a story: the generations of the tree in it (the longest line of parents and children who
 * lived there: the people of its facts, its holders and residents of the tree) and its holders and residents with their
 * sources, each once (a person of the tree by their ID, else by the name).
 */
export function houseStoryReach(tree: Tree, h: House, row?: HouseRow): { generations: number; people: number; enough: boolean } {
  const r = row ?? rowOf(tree, h);
  const persons = new Set<string>([...(r?.tree?.persons ?? []), ...[...(h.holders ?? []), ...(h.residents ?? [])].flatMap((x) => (x.person ? [x.person] : []))]);
  const depth = new Map<string, number>();
  const of = (p: string, seen: Set<string>): number => {
    if (depth.has(p)) return depth.get(p)!;
    if (seen.has(p)) return 1;
    seen.add(p);
    let d = 1;
    for (const f of familiesAsChild(tree, p)) for (const q of f.partners) if (persons.has(q)) d = Math.max(d, 1 + of(q, seen));
    depth.set(p, d);
    return d;
  };
  const generations = persons.size ? Math.max(...[...persons].map((p) => of(p, new Set()))) : 0;
  const who = new Set<string>();
  for (const x of [...(h.holders ?? []), ...(h.residents ?? [])]) if (x.sources?.length) who.add(x.person ?? `name:${foldText(x.name)}`);
  return { generations, people: who.size, enough: generations >= HOUSE_STORY_GENERATIONS || who.size >= HOUSE_STORY_PEOPLE };
}

/**
 * The new facts a house's story is due for — all of them before it is written — or undefined: its task alive, dropped
 * since the story was written (the answer), done with no story (somebody decided so), or too few new since. New: what
 * the house had not when its latest version was written (its `seen`, else the facts it named).
 */
export function houseStoryDue(tree: Tree, h: House, facts: Map<string, Event>, tasks: Task[] = tree.list<Task>("task")): string[] | undefined {
  const mine = tasks.filter((t) => !t.retracted && houseStoryOf(t) === h.id);
  if (mine.some((t) => LIVE.has(t.state))) return undefined;
  const latest = h.story?.draft ?? h.story;
  const since = latest?.at ?? "";
  if (mine.some((t) => t.state === "dropped" && t.updated >= since)) return undefined;
  if (!h.story && mine.some((t) => FINISHED.has(t.state))) return undefined;
  const known = new Set([...(latest?.seen ?? []), ...(latest?.facts ?? [])]);
  const fresh = [...facts.keys()].filter((id) => !known.has(id));
  if (h.story && fresh.length < STORY_NEW_FACTS) return undefined;
  return fresh;
}

const placeName = (p: Place | undefined) => p?.names[0]?.name ?? p?.id ?? "";
const houseLabel = (tree: Tree, h: House) => `${placeName(tree.get<Place>(h.place))} ${h.house}${h.name ? ` (${h.name})` : ""}`.trim();

function createStoryTask(tree: Tree, h: House, reach: { generations: number; people: number }, fresh: number, asked?: string): Task {
  const lang = tree.lang;
  const house = houseLabel(tree, h);
  return create<Task>(
    tree,
    "task",
    {
      level: "narrate",
      priority: 1, // the research first; a story when there is a moment for it
      subject: [h.id],
      state: "open",
      what: phrase(lang, h.story ? "house.story.more.what" : "house.story.what", { house, count: fresh }).slice(0, 200),
      where: [phrase(lang, "house.story.where", { id: h.id }), ...(h.story ? [phrase(lang, "story.keep", { id: h.id })] : [])],
      why: phrase(lang, asked ? "house.story.why.asked" : "house.story.why", { generations: reach.generations, people: reach.people }).slice(0, 1000),
      doneWhen: phrase(lang, "house.story.done", { id: h.id }).slice(0, 500),
      origin: houseStoryOrigin(h.id),
      ...(asked ? { asked } : {}),
    },
    (id) => `+${id} task "story of the house ${h.id}" (stories)`,
  );
}

/**
 * The stories of the houses raised by themselves (the setting stories on; never in an archive): each house researched
 * — its research done, no task of it alive (after its last step) — that tells enough (houseStoryReach) and is due for
 * one (houseStoryDue: first, or written again once the house brought more). Inside the tree's lock. Its tasks (T…).
 */
export function raiseHouseStories(tree: Tree, settings: Settings = new Settings(tree.env, {})): string[] {
  if (tree.dryRun || !settings.stories(tree.config).on || actsAsArchive(tree)) return [];
  const records = tree.list<House>("house").filter((h) => !h.retracted && !h.town);
  if (!records.length) return [];
  return tree.withTreeLock(() => {
    const rows = new Map(houseRows(tree, { on: true }).filter((r) => r.id).map((r) => [r.id!, r]));
    const tasks = tree.list<Task>("task");
    const made: string[] = [];
    for (const h of records) {
      const row = rows.get(h.id);
      if (row?.state !== "done") continue;
      const reach = houseStoryReach(tree, h, row);
      if (!reach.enough) continue;
      const fresh = houseStoryDue(tree, h, houseStoryFacts(tree, h, row), tasks);
      if (!fresh) continue;
      made.push(createStoryTask(tree, h, reach, fresh.length).id);
    }
    return made;
  });
}

/**
 * The person asks for the story of a house (strom house story, the bridge's POST /houses/story): its task on top of the
 * queue — one alive moved there, else one made, whatever the house tells and whatever the setting stories says. Only a
 * house with a record (something of it written). Inside the lock.
 */
export function askHouseStory(tree: Tree, ref: string): { task: string; house: string; made: boolean } {
  if (actsAsArchive(tree)) throw new UsageError("an archive writes nothing", { code: "house.archive" });
  return tree.withTreeLock(() => {
    const rows = houseRows(tree, { on: true });
    const row = findHouse(tree, ref, rows);
    const h = row.id ? tree.get<House>(row.id) : undefined;
    if (!h || h.town) throw new UsageError(`nothing of the house ${row.id ?? row.key} is written yet — its story is written from its research`, { code: "house.story.none", hint: `its research first: strom house request ${row.id ?? `"${row.key}"`}` });
    const at = new Date().toISOString();
    const live = tree.list<Task>("task").find((t) => !t.retracted && houseStoryOf(t) === h.id && LIVE.has(t.state));
    const task =
      live ??
      createStoryTask(tree, h, houseStoryReach(tree, h, row), houseStoryFacts(tree, h, row).size, at);
    const moved = update<Task>(
      tree,
      task.id,
      "task",
      (x) => ({ ...x, ...(x.state === "parked" ? { state: "open" as const } : {}), queueAt: { do: "next" as const, at }, asked: at }),
      { op: "task.order", summary: `${task.id} asked by the person: next` },
    );
    return { task: moved.id, house: h.id, made: !live };
  });
}

export interface HouseStoryInput {
  text: string;
  title?: string;
  facts?: string[];
  sources?: string[];
  note?: string;
  final?: boolean;
  drop?: { ref: string; why: string }[];
}

/**
 * A fact of a house's story as given: an item of the house in lower case (h1, H1; an event of its timeline only as e…),
 * a fact of the tree as its ID (E0012, E12).
 */
export function houseFactRef(ref: string): string {
  const r = ref.trim();
  if (/^[nhr]\d+$/iu.test(r) || /^e\d+$/u.test(r)) return r.toLowerCase();
  const m = /^[Ee](\d+)$/u.exec(r);
  return m ? `E${m[1]!.padStart(4, "0")}` : r;
}

/**
 * Write the story of a house (strom story set A…): every fact one of the house's (houseStoryFacts) — refused else —, the
 * sources of its background recorded, what the version before had kept or dropped on purpose (storykeep). A draft, or
 * beside an approved one the new version waiting (the lock); approved only on the person's word (--final).
 */
export function setHouseStory(tree: Tree, id: string, input: HouseStoryInput): House {
  const text = input.text.replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!text) throw new UsageError("the story is empty");
  const sources = [...new Set((input.sources ?? []).map((s) => s.trim().toUpperCase()))];
  for (const s of sources) {
    if (tree.get<Source>(s)?.type !== "source") throw new UsageError(`no source ${s}`, { hint: "the background of place and time is recorded first: strom source add … --kind book|newspaper|web", code: "story.no-source", params: { kind: "source", id: s } });
    citableSource(tree, s);
  }
  for (const s of sourcesNamed(tree, [input.title, text, input.note].filter(Boolean).join("\n")))
    if (tree.get<Source>(s)?.retracted?.reason === "deleted") citableSource(tree, s);
  return tree.withTreeLock(() => {
    const h = tree.get<House>(id);
    if (!h || h.type !== "house" || h.town || h.retracted) throw new UsageError(`no house ${id}`, { code: "record.none", params: { kind: "house", id } });
    const known = houseStoryFacts(tree, h);
    const facts = [...new Set((input.facts ?? []).map(houseFactRef))];
    const strange = facts.filter((f) => !known.has(f));
    if (strange.length)
      throw new UsageError(`not a fact of the house ${id}: ${strange.join(", ")}`, {
        hint: `its items (n…, e…, h…, r…) and the facts of the tree's people in it (E…): strom house show ${id}`,
        code: "story.house.fact",
        params: { house: id, facts: strange.join(", ") },
      });
    const version: StoryDraft = {
      ...(input.title?.trim() ? { title: input.title.trim() } : {}),
      text,
      facts,
      ...(sources.length ? { sources } : {}),
      ...(input.note?.trim() ? { note: input.note.trim() } : {}),
      seen: [...known.keys()],
      at: now(),
      by: tree.actor,
    };
    const drop = dropsOf(input.drop, facts, sources);
    const before = latestVersion(h.story);
    if (before) {
      const lost = storyLosses(tree, before, version, drop.map((d) => d.ref), known);
      if (lost.length) {
        const kinds = { fact: "a fact", source: "a source", link: "a link" } as const;
        throw new UsageError(`the story of ${id} had what this version leaves out — keep it, or leave it out on purpose with the reason:\n${lost.map((l) => `  ${l.what} (${kinds[l.kind]}) → ${l.keep}`).join("\n")}`, {
          hint: `strom story show ${id} shows the version before; leave one out: --drop "<h…|E…|S…|link> <why>" (repeatable; the reason is kept with the story)`,
          code: "story.loses",
          details: { lost: lost.map((l) => ({ ref: l.ref, kind: l.kind, what: l.what })) },
        });
      }
      const words = [before.title, before.text, before.note].filter(Boolean).join("\n");
      const had = new Set([...before.facts, ...storySources(tree, before, known).map((x) => x.id), ...sourcesNamed(tree, words), ...linksIn(words).map(linkKey)]);
      const meant = drop.filter((d) => had.has(/^https?:/iu.test(d.ref) ? linkKey(d.ref) : d.ref));
      if (meant.length) version.dropped = meant;
    }
    const count = text.split(/\s+/).length;
    const left = version.dropped?.length ? `; left out on purpose: ${version.dropped.map((d) => d.ref).join(", ")}` : "";
    const reason = version.dropped?.map((d) => `${d.ref}: ${d.why}`).join("; ");
    if (h.story?.status === "final" && !input.final) {
      const updated: House = { ...h, story: { ...h.story, draft: version }, updated: now() };
      tree.put(updated, { op: "story.set", targets: [id], summary: `${id} story of the house: a new version (${count} words) waits for the user's approval; the approved one stays${left}`, ...(reason ? { reason } : {}) });
      return updated;
    }
    const story: Story = { ...version, status: input.final ? "final" : "draft" };
    const updated: House = { ...h, story, updated: now() };
    tree.put(updated, { op: "story.set", targets: [id], summary: `${id} story of the house${h.story ? " rewritten" : ""}: ${count} words, ${story.status}${left}`, ...(reason ? { reason } : {}) });
    return updated;
  });
}

/** The --drop of a house's story: an item of the house, a fact, a source or a link, each with its reason. */
function dropsOf(given: HouseStoryInput["drop"], facts: string[], sources: string[]): { ref: string; why: string }[] {
  const out = new Map<string, { ref: string; why: string }>();
  for (const d of given ?? []) {
    const link = /^https?:/iu.test(d.ref);
    const ref = link ? d.ref.trim() : /^[nhr]\d+$/iu.test(d.ref.trim()) || /^e\d+$/u.test(d.ref.trim()) ? d.ref.trim().toLowerCase() : houseFactRef(d.ref.trim().toUpperCase());
    if (!ref || !d.why.trim()) throw new UsageError(`--drop needs what and why: "${d.ref}"`, { hint: '--drop "h2 told in the story of the person" (an item h…, a fact E…, a source S… or a link, then the reason)', code: "story.drop" });
    if (!link && !/^([ES]\d+|[nehr]\d+)$/u.test(ref)) throw new UsageError(`--drop takes an item of the house (n…, e…, h…, r…), a fact (E…), a source (S…) or a link: "${d.ref}"`, { hint: '--drop "S0003 the page says nothing of the house"', code: "story.drop" });
    if (facts.includes(ref) || sources.includes(ref)) throw new UsageError(`${ref} is both kept (--fact/--source) and left out (--drop)`, { hint: "say one of them", code: "story.drop" });
    out.set(link ? linkKey(ref) : ref, { ref, why: d.why.trim() });
  }
  return [...out.values()];
}

/**
 * The people of the tree a house's story names through its facts (its holders and residents of the tree, the people of
 * the facts E…): for the Strom app's protection of the living in what it shares (house-privacy). Each with whether the
 * tree has their death.
 */
export function houseStoryPeople(tree: Tree, h: House, v: Pick<StoryDraft, "facts">): { id: string; died: boolean }[] {
  const ids = new Set<string>();
  const items = new Map([...(h.holders ?? []), ...(h.residents ?? [])].map((x) => [x.id, x]));
  const row = rowOf(tree, h);
  const owners = new Map((row?.tree?.events ?? []).map(({ owner, event }) => [event.id, owner]));
  for (const f of v.facts) {
    const it = items.get(f);
    if (it?.person) ids.add(it.person);
    const o = owners.get(f);
    if (o) for (const p of o.type === "person" ? [o.id] : o.partners) ids.add(p);
  }
  return [...ids]
    .sort()
    .map((id) => tree.get<Person>(id))
    .filter((p): p is Person => !!p && !p.retracted)
    .map((p) => ({ id: p.id, died: p.events.some((e) => !e.retracted && ["DEAT", "BURI", "CREM"].includes(e.kind)) }));
}

/**
 * The story of a house as the Strom app reads it (GET /houses/<ref> story; spec 145 T4): its status (draft | final),
 * title, text, the facts and sources it rests on, when, its people (houseStoryPeople: the living kept out of what is
 * shared by the app), a new version waiting beside an approved one (draft), and its task while one is alive or done
 * (task: {id, state}). Nothing when the house has neither a story nor its task.
 */
export function houseStoryView(tree: Tree, h: House): Record<string, unknown> | undefined {
  const tasks = tree.list<Task>("task").filter((t) => !t.retracted && houseStoryOf(t) === h.id && t.state !== "dropped").sort((a, b) => b.id.localeCompare(a.id));
  const task = tasks.find((t) => LIVE.has(t.state)) ?? tasks[0];
  if (!h.story && !task) return undefined;
  const version = (v: StoryDraft) => ({
    ...(v.title ? { title: v.title } : {}),
    text: v.text,
    facts: v.facts,
    ...(v.sources?.length ? { sources: v.sources } : {}),
    at: v.at,
    people: houseStoryPeople(tree, h, v),
  });
  return {
    ...(h.story ? { status: h.story.status, ...version(h.story), ...(h.story.draft ? { draft: version(h.story.draft) } : {}) } : { status: null }),
    ...(task ? { task: { id: task.id, state: task.state } } : {}),
  };
}
