// The story of a house (spec 145 T4): its task by itself only with the stories on, after the house's last research
// step (its research, or its look where its check raised one) and only when the house tells enough (two generations of
// the tree in it, or three holders and residents with sources); none below; asked by the person whatever it tells
// (strom house story, the bridge's POST /houses/story); written from the house's facts (its items and the facts of its
// people), a draft until approved, locked once approved — a new version beside it once the house brought more; the
// bridge's view and the link that approves it. Synthetic data only (made-up names), with diacritics, decomposed input
// and a name in Cyrillic.

import { test } from "node:test";
import assert from "node:assert/strict";
import { World, hasGit } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import { Settings } from "../../src/core/config.ts";
import { APP_SHOWS_HOUSE_STORY, APP_SHOWS_HOUSE_STORY_BETA, appShowsHouseStory } from "../../src/core/stromapp.ts";
import { forHouse, houseRows, housesOfTask, houseView, houseWork } from "../../src/core/houses.ts";
import { HOUSE_STORY_PREFIX, houseStoryOf, houseStoryReach, raiseHouseStories } from "../../src/core/housestory.ts";
import { forStory } from "../../src/core/stories.ts";
import { parseLink } from "../../src/core/links.ts";
import { waitingFor } from "../../src/core/waiting.ts";
import type { House, Person, Task } from "../../src/core/model.ts";
import { validateRecord } from "../../src/core/validate.ts";

const opts = { skip: !hasGit, timeout: 240_000 };
const AGENT = { env: { CLAUDECODE: "1" } };
const UNATTENDED = { env: { AI_AGENT: "1", STROM_NONINTERACTIVE: "1" } };

const open = (w: World) => Tree.open(w.cwd, w.env);
const storyTasks = (w: World, house?: string) => open(w).list<Task>("task").filter((t) => !t.retracted && houseStoryOf(t) !== undefined && (!house || houseStoryOf(t) === house));
const houseOf = (w: World, number: string) => open(w).list<House>("house").find((h) => !h.retracted && !h.town && h.house === number)!;

/**
 * Lhota (L0001): no. 9 the Lhotáks' over two generations (Ozubec 1840, his son Mlhoslav 1870, both born there), no. 14
 * Ozubec's father Bodlák Lhoták's alone (1810–1850: thirty years, one generation). The history of the houses on: both researched by
 * themselves.
 */
async function village(w: World) {
  await w.withTree("Lhotákovi");
  await w.ok(["place", "add", "Lhota", "--kind", "village"]); // L0001
  const person = async (name: string) => (await w.ok(["person", "add", name, "--json"])).json.person.id as string;
  const ozubec = await person("Ozubec /Lhoták/");
  const mlhoslav = await person("Mlhoslav /Lhoták/");
  const bodlak = await person("Bodlák /Lhoták/".normalize("NFD"));
  await w.ok(["family", "add", "--partner", ozubec, "--child", mlhoslav]);
  await w.ok(["family", "add", "--partner", bodlak, "--child", ozubec]);
  await w.ok(["config", "set", "main.person", mlhoslav, "--for-tree"]);
  const fact = async (who: string, kind: string, date: string, house: string) => w.ok(["event", "add", who, kind, "--date", date, "--place", "Lhota", "--house", house]);
  await fact(ozubec, "BIRT", "1840", "9");
  await fact(ozubec, "DEAT", "1900", "9");
  await fact(mlhoslav, "BIRT", "1870", "9");
  await fact(bodlak, "BIRT", "1810", "14");
  await fact(bodlak, "DEAT", "1850", "14");
  await w.ok(["config", "set", "houses", "on", "--for-tree"], { tty: true });
  return { ozubec, mlhoslav, bodlak };
}

/**
 * A house's research done by its agent (with the neighbouring houses of one family in its task): its list gone through,
 * its look and its check (none), closed done in a session.
 */
async function research(w: World, house: string) {
  const t = open(w).list<Task>("task").find((x) => !x.retracted && houseWork(x) === "house" && housesOfTask(x).includes(house) && x.state !== "done")!;
  assert.ok(t, `no task of the house ${house}`);
  await w.ok(["session", "start", t.id], AGENT);
  for (const q of ["adresní místo", "pomístní jména", "ortofoto"]) await w.ok(["search", "add", q, "--method", "web", "--result", "negative"], AGENT);
  for (const a of housesOfTask(t)) {
    await w.ok(["house", "add", "passed", a, "--checklist", "--what", "prošlo: adresní místo, pomístní jména, ortofoto"], AGENT);
    await w.ok(["house", "add", "look", a, "--text", "přízemní chalupa", "--certainty", "guess"], AGENT);
    await w.ok(["house", "add", "look-check", a, "--next", "none", "--text", "obrázek domu nikde"], AGENT);
  }
  await w.ok(["session", "close", "--done", "dům prošel", "--next", "další dům"], AGENT);
  return t.id;
}

test("the story of a house by itself: after its last research step only above the threshold, only with the stories on, none in its research's place", opts, async () => {
  const w = new World();
  try {
    await village(w);
    const h9 = houseOf(w, "9").id;
    const h14 = houseOf(w, "14").id;
    // before its research: none
    assert.deepEqual(storyTasks(w), []);
    const reach9 = houseStoryReach(open(w), open(w).get<House>(h9)!);
    assert.equal(reach9.generations, 2);
    assert.equal(reach9.enough, true);
    const reach14 = houseStoryReach(open(w), open(w).get<House>(h14)!);
    assert.deepEqual([reach14.generations, reach14.people, reach14.enough], [1, 0, false]);

    // the research of no. 9 done: its story's task follows (narrate, the house its subject, a story in the queue)
    await research(w, h9);
    const [t9] = storyTasks(w, h9);
    assert.ok(t9, JSON.stringify(open(w).list<Task>("task").map((t) => [t.id, t.origin, t.state])));
    assert.equal(t9.level, "narrate");
    assert.equal(t9.origin, `${HOUSE_STORY_PREFIX}${h9}`);
    assert.deepEqual(t9.subject, [h9]);
    assert.ok(forStory(t9) && !forHouse(t9));
    assert.match(t9.why, /2 generace stromu v něm/u);
    // the house's state stays its research's (done), the story no work of a house
    const row = houseRows(open(w), { on: true }).find((r) => r.id === h9)!;
    assert.equal(row.state, "done");
    // raised again: none more (its task alive)
    assert.deepEqual(raiseHouseStories(open(w), new Settings(w.env, {})), []);

    // no. 14 done with it (one task of one family): below the threshold (one generation, nobody held with a source), no
    // story's task
    assert.equal(houseRows(open(w), { on: true }).find((r) => r.id === h14)!.state, "done");
    assert.deepEqual(storyTasks(w, h14), []);

    // its brief: the story's part of the method and the house's facts, nothing of the people's research
    const brief = (await w.ok(["brief", t9.id], AGENT)).out;
    assert.match(brief, /The story of a house: its holders/u);
    assert.match(brief, new RegExp(`## The house ${h9}: Lhota 9 — what its story is written from`, "u"));
    assert.match(brief, /strom story set A… --text/u);
    assert.doesNotMatch(brief, /strom story set P… --text|## The couple's story|the history of the places it tells/u);
    assert.match(brief, /its look: přízemní chalupa \[guess\]/u);
  } finally {
    w.cleanup();
  }
});

test("the stories off: no story of a house by itself, the person's word still makes one", opts, async () => {
  const w = new World();
  try {
    await village(w);
    await w.ok(["config", "set", "stories", "no", "--for-tree"], { tty: true });
    const h9 = houseOf(w, "9").id;
    await research(w, h9);
    assert.deepEqual(storyTasks(w), []);
    // the person's: an agent is refused, without a terminal --yes is asked for
    const agent = await w.run(["house", "story", h9], UNATTENDED);
    assert.notEqual(agent.code, 0);
    assert.deepEqual(storyTasks(w), []);
    const asked = (await w.ok(["house", "story", h9, "--yes", "--json"])).json;
    assert.equal(asked.made, true);
    const t = open(w).get<Task>(asked.task)!;
    assert.equal(houseStoryOf(t), h9);
    assert.ok(t.asked);
    assert.equal(t.queueAt?.do, "next");
    // asked again: the same task, none more
    const again = (await w.ok(["house", "story", h9, "--yes", "--json"])).json;
    assert.deepEqual([again.task, again.made], [asked.task, false]);
    assert.equal(storyTasks(w).length, 1);
  } finally {
    w.cleanup();
  }
});

test("on demand below the threshold; written from the house's facts, a draft, approved by the person alone; a new version beside it once the house brought more", opts, async () => {
  const w = new World();
  try {
    const { bodlak } = await village(w);
    const h14 = houseOf(w, "14").id;
    await research(w, h14);
    assert.deepEqual(storyTasks(w, h14), []);
    // the person asks: a task whatever the house tells
    const asked = (await w.ok(["house", "story", "Lhota", "14", "--yes", "--json"])).json;
    assert.equal(asked.house, h14);
    const src = (await w.ok(["source", "add", "Pozemková kniha Lhota", "--kind", "land", "--json"], AGENT)).json.source.id as string;
    await w.ok(["house", "add", "holder", h14, "--name", "Bodlák Lhoták".normalize("NFD"), "--person", bodlak, "--since", "1830", "--until", "1850", "--how", "inheritance", "--source", src, "--certainty", "high"], AGENT);
    await w.ok(["house", "add", "event", h14, "--kind", "fire", "--date", "1866", "--text", "vyhořel", "--source", src, "--certainty", "medium"], AGENT);
    const h = open(w).get<House>(h14)!;
    const holder = h.holders[0]!.id;
    const fire = h.timeline[0]!.id;
    const birth = open(w).get<Person>(bodlak)!.events.find((e) => e.kind === "BIRT")!.id;

    // a fact that is not the house's: refused
    const strange = await w.run(["story", "set", h14, "--text", "Dům.", "--fact", "E9999"], AGENT);
    assert.notEqual(strange.code, 0);
    assert.match(strange.err, /not a fact of the house/u);
    // no --history for a house
    const hist = await w.run(["story", "set", h14, "--text", "Dům.", "--history", "E0001"], AGENT);
    assert.notEqual(hist.code, 0);

    const text = "Chalupu č. 14 držel od roku 1830 Bodlák Lhoták. V roce 1866 nejspíš vyhořela.\n\nЛхотка — sousední ves.";
    await w.ok(["story", "set", h14, "--text", text, "--title", "Chalupa u rybníka", "--fact", holder.toUpperCase(), "--fact", fire, "--fact", birth], AGENT);
    let story = open(w).get<House>(h14)!.story!;
    assert.equal(story.status, "draft");
    assert.deepEqual(story.facts, [holder, fire, birth]);
    assert.ok(story.seen?.includes(holder) && story.seen.includes(birth));
    assert.ok(validateRecord(open(w).get<House>(h14)!).length === 0, JSON.stringify(validateRecord(open(w).get<House>(h14)!)));
    // shown with what it rests on: the house's item and its source
    const shown = (await w.ok(["story", "show", h14])).out;
    assert.match(shown, new RegExp(`${holder} ${h14} holder 1830–1850 Bodlák Lhoták`.normalize("NFC"), "u"));
    assert.match(shown, /Pozemková kniha Lhota/u);
    assert.match((await w.ok(["story", "list"])).out, new RegExp(`${h14}\\s+Lhota 14\\s+draft`, "u"));
    // the bridge's view: the text, its facts, its people (the living kept out by the app)
    const view = houseView(open(w), houseRows(open(w), { on: true }).find((r) => r.id === h14)!) as { story: { status: string; text: string; people: { id: string; died: boolean }[] } };
    assert.equal(view.story.status, "draft");
    assert.equal(view.story.text, text);
    assert.deepEqual(view.story.people, [{ id: bodlak, died: true }]);

    // approved by the person alone
    const byAgent = await w.run(["story", "approve", h14], UNATTENDED);
    assert.notEqual(byAgent.code, 0);
    await w.ok(["story", "approve", h14]);
    assert.equal(open(w).get<House>(h14)!.story!.status, "final");
    await w.ok(["task", "done", asked.task, "--result", "vyprávění napsáno"], AGENT);
    // done, nothing new: none more
    assert.deepEqual(raiseHouseStories(open(w), new Settings(w.env, {})), []);

    // the house brings more (two holders more with sources: enough by itself now) — a new task, a version beside the
    // approved one; leaving out a fact of it needs --drop
    await w.ok(["house", "add", "holder", h14, "--name", "Ратибор Лхотак", "--since", "1850", "--until", "1905", "--how", "purchase", "--source", src], AGENT);
    await w.ok(["house", "add", "holder", h14, "--name", "Kapradina Lhotáková", "--since", "1905", "--how", "marriage", "--source", src], AGENT);
    assert.equal(houseStoryReach(open(w), open(w).get<House>(h14)!).enough, true);
    const more = raiseHouseStories(open(w), new Settings(w.env, {}));
    assert.equal(more.length, 1);
    const tm = open(w).get<Task>(more[0]!)!;
    assert.match(tm.what, /Doplnit vyprávění o domě Lhota 14: 2 nové údaje/u);
    const lost = await w.run(["story", "set", h14, "--text", "Kratší.", "--fact", holder], AGENT);
    assert.notEqual(lost.code, 0);
    assert.match(lost.err, /leaves out/u);
    const h2 = open(w).get<House>(h14)!;
    await w.ok(["story", "set", h14, "--text", `${text}\n\nPak dům koupil Ратибор Лхотак.`, "--fact", holder, "--fact", fire, "--fact", birth, "--fact", h2.holders[1]!.id], AGENT);
    story = open(w).get<House>(h14)!.story!;
    assert.equal(story.status, "final");
    assert.equal(story.text, text);
    assert.match(story.draft!.text, /Ратибор/u);
    // waiting for the person: the terminal's What waits; the bridge's only for an app that shows a house's story
    const all = waitingFor(open(w), {});
    assert.ok(all.some((x) => x.story === h14 && x.item.house), JSON.stringify(all.map((x) => x.item)));
    assert.ok(!waitingFor(open(w), { houseStories: false }).some((x) => x.story === h14));
    // the link that keeps the approved one: the house by its record, never with a person
    const link = parseLink(`strom-research://story?tree=${open(w).config.id}&house=${h14.toLowerCase()}&do=keep`);
    assert.deepEqual(link, { action: "story", tree: open(w).config.id, house: h14, do: "keep" });
    assert.throws(() => parseLink(`strom-research://story?tree=${open(w).config.id}&house=lhota|14&do=keep`));
    await w.ok(["story", "discard", h14]);
    assert.equal(open(w).get<House>(h14)!.story!.draft, undefined);
  } finally {
    w.cleanup();
  }
});

test("the gate APP_SHOWS_HOUSE_STORY: off for the production app until its 3.33.0 is out (an unknown version never); its beta and development copies from 3.33.0-beta.5", () => {
  const prod = new Settings({ STROM_APP_URL: "https://stromapp.info/run/" }, {});
  const beta = new Settings({ STROM_APP_URL: "https://beta.stromapp.info/run/" }, {});
  assert.equal(APP_SHOWS_HOUSE_STORY, undefined, "set when the app's 3.33.0 is out (strom:je-venku-brany)");
  assert.equal(APP_SHOWS_HOUSE_STORY_BETA, "3.33.0-beta.5");
  for (const v of [undefined, "3.32.0", "3.33.0-beta.5", "3.33.0", "9.0.0", "nonsense"]) assert.equal(appShowsHouseStory(prod, v), false, String(v));
  for (const v of [undefined, "3.33.0", "9.0.0"]) assert.equal(appShowsHouseStory(prod, v, "3.33.0"), v !== undefined, `gate 3.33.0: ${v}`);
  for (const v of ["3.32.0", "3.33.0-beta.4"]) assert.equal(appShowsHouseStory(beta, v), false, `beta ${v}`);
  for (const v of ["3.33.0-beta.5", "3.33.0-beta.6", "3.33.0", "9.0.0"]) assert.equal(appShowsHouseStory(beta, v), true, `beta ${v}`);
});
