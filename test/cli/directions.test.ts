// The directions of a research: paused, ended, taken up again — the user's decision where the research goes.

import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { World, hasGit, readJsonFile } from "../helpers.ts";

const opts = { skip: !hasGit };

/** Two directions: the ancestors of Josef (tasks proposed by strom) and one question with a task of its own. */
async function world(): Promise<World> {
  const w = new World();
  await w.withTree();
  await w.ok(["lang", "cs"]);
  await w.ok(["recordset", "add", "Křty Kamenice 1880-1890", "--kinds", "baptism", "--places", "Kamenice nad Lipou", "--years", "1880-1890"]);
  await w.ok(["research", "new", "Předci Josefa", "--new-person", "Josef /Novák/", "--sex", "M", "--born", "ABT 1885", "--born-place", "Kamenice nad Lipou"]);
  await w.ok(["frontier", "--apply", "--research", "G0001"]);
  await w.ok(["research", "new", "Kdo byla Anna?", "--new-person", "Anna /Horáková/", "--sex", "F", "--direction", "question", "--question", "Who was Anna?"]);
  await w.ok(["task", "add", "Oddavky Anny", "--level", "locate", "--where", "Kamenice", "--why", "a", "--done-when", "b", "--about", "P0002", "--research", "G0002"]);
  return w;
}

const queue = async (w: World) => ((await w.ok(["task", "list", "--full", "--json"])).json.tasks as { id: string; research?: string }[]).map((t) => t.research);

test("a direction paused waits out of the queue and proposes nothing; taken up again, it is back — nothing deleted", opts, async () => {
  const w = await world();
  assert.deepEqual([...new Set(await queue(w))].sort(), ["G0001", "G0002"]);
  const paused = await w.ok(["research", "pause", "G0001", "--reason", "rodina chce počkat", "--json"]);
  assert.equal(paused.json.research.state, "paused");
  assert.equal(paused.json.tasks, 1);
  assert.deepEqual(await queue(w), ["G0002"], "its tasks wait out of the queue");
  assert.equal((await w.ok(["task", "next", "--json"])).json.task.research, "G0002");
  assert.equal((await w.ok(["research", "show", "G0001", "--json"])).json.research.notes.at(-1).text, "paused: rodina chce počkat");
  // nothing proposed for it while it waits
  assert.deepEqual((await w.ok(["frontier", "--apply", "--research", "G0001", "--json"])).json.created, []);
  assert.match((await w.ok(["research", "pause", "G0001"])).out, /G0001 is paused already/);
  // ended: the same, and the tasks are still there
  await w.ok(["research", "done", "G0002"]);
  assert.deepEqual(await queue(w), []);
  assert.equal((await w.ok(["task", "list", "--state", "all", "--json"])).json.tasks.length, 2);
  // taken up again
  await w.ok(["research", "resume", "G0001"]);
  assert.deepEqual(await queue(w), ["G0001"]);
  w.cleanup();
});

test("the menu: Add to the research → the directions — each with how it goes and its tasks; paused, ended, taken up again", opts, async () => {
  const w = await world();
  // 4 add to the research · 5 the directions · 1 the first · 1 pause · 0 back
  const r = await w.ok([], { tty: true, answers: ["4", "5", "1", "1", "0", "0"] });
  assert.match(r.out, /5 {2}Směry výzkumu: pozastavit, ukončit nebo znovu spustit/);
  assert.match(r.out, /1 {2}Předci Josefa – běží · úkoly: 1\n +2 {2}Kdo byla Anna\? – běží · úkoly: 1\n +0 {2}Zpět/);
  assert.match(r.out, /⏸ „Předci Josefa“ je pozastavený: jeho úkoly \(1\) počkají, dokud ho tady znovu nespustíte\./);
  // a paused one: taken up again or ended
  const again = await w.ok([], { tty: true, answers: ["4", "5", "1", "1", "0", "0"] });
  assert.match(again.out, /Předci Josefa – pozastavený · úkoly: 1/);
  assert.match(again.out, /1 {2}Znovu spustit – jeho úkoly se vrátí do fronty\n +2 {2}Ukončit/);
  assert.match(again.out, /▶ „Předci Josefa“ zase běží: jeho úkoly \(1\) jsou zpátky ve frontě\./);
  // Enter goes back with nothing changed
  await w.ok([], { tty: true, answers: ["4", "5", "", "0"] });
  assert.equal((await w.ok(["research", "show", "G0001", "--json"])).json.research.state, "active");
  w.cleanup();
});

test("one direction's tasks: its own and those about its people — never a task of another family line; a new task takes its direction", opts, async () => {
  const w = new World();
  await w.withTree();
  await w.ok(["research", "new", "Ancestors of Josef", "--new-person", "Josef /Novák/", "--sex", "M", "--born", "ABT 1885"]);
  await w.ok(["research", "new", "Ancestors of Marie", "--new-person", "Marie /Dvořák/", "--sex", "F", "--born", "ABT 1890"]);
  await w.ok(["person", "add", "Karel /Svoboda/", "--sex", "M"]);
  const add = async (what: string, about: string, more: string[] = []) =>
    (await w.ok(["task", "add", what, "--level", "link", "--where", "Parish", "--why", "a", "--done-when", "b", "--about", about, "--json", ...more])).json.task;
  // two directions at work: a task goes to the one its person belongs to, else to none
  assert.equal((await add("Baptism of Marie", "P0002")).research, "G0002");
  assert.equal((await add("Baptism of Karel", "P0003")).research, undefined);
  const theirs = async (g: string) => ((await w.ok(["task", "list", "--research", g, "--json"])).json.tasks as { what: string }[]).map((t) => t.what);
  assert.ok(!(await theirs("G0001")).includes("Baptism of Karel"), "a task of nobody's line is not Josef's");
  assert.ok((await theirs("G0002")).includes("Baptism of Marie"));
  // a session of a direction: what it adds is that direction's
  const s = await w.ok(["session", "start", "--research", "G0002", "--json"]);
  assert.equal(s.json.session.research, "G0002");
  assert.equal((await add("Marriage of Karel", "P0003", ["--anyway"])).research, "G0002");
  w.cleanup();
});

test("the Strom app: each direction with how it goes (its tasks, why paused and since when, the ancestors known by generation, its last session); tasks and changes name their direction; links pause, end and take one up again", { skip: !hasGit || process.platform === "win32" }, async () => {
  const w = await world();
  const tree = readJsonFile(path.join(w.cwd, "strom.json")).id as string;
  const link = (query: string, answers: string[]) => w.ok(["link", "open", `strom-research://${query}&tree=${tree}`], { tty: true, answers });
  await w.ok(["session", "start", "--research", "G0001"]);
  await w.ok(["session", "close", "--continue", "--summary", "Křest Josefa hledán v knize 1880–1890.", "--next", "Dál."]);
  // paused through the app's link: said, the reason asked and kept
  const paused = await link("direction?id=G0002&do=pause", ["a", "Matriky nejsou online", ""]);
  assert.match(paused.out, /Aplikace Strom žádá: pozastavit směr „Kdo byla Anna\?“: jeho úkoly \(1\) počkají mimo frontu/);
  assert.match(paused.out, /⏸ „Kdo byla Anna\?“ je pozastavený/);
  assert.match((await link("direction?id=G0002&do=pause", [""])).out, /Směr „Kdo byla Anna\?“ už je pozastavený\. Nic se nestalo\./);
  assert.match((await link("direction?id=G0009&do=done", [""])).out, /Směr G0009 v tomto výzkumu není/);
  const info = (await w.ok(["live", "start", "--json"])).json;
  try {
    const status = (await (await fetch(`${info.url}/status`)).json()) as { links: string[]; researches: Record<string, unknown>[]; queue: { id: string; research?: string }[] };
    const [josef, anna] = status.researches;
    assert.equal(josef!.direction, "ancestors");
    assert.equal(josef!.focus, "P0001");
    assert.equal(josef!.tasks, 1);
    assert.equal(josef!.working, false);
    assert.deepEqual(josef!.generations, [0], "the parents: none known yet");
    assert.match((josef!.last as { text: string }).text, /^Křest Josefa hledán/);
    assert.equal(anna!.state, "paused");
    assert.equal(anna!.reason, "Matriky nejsou online");
    assert.equal(anna!.tasks, 1, "what comes back when it is taken up again");
    assert.ok(Date.parse(anna!.since as string) > Date.parse(josef!.since as string));
    assert.equal(anna!.generations, undefined, "a question: no generations");
    assert.deepEqual(status.queue.map((q) => q.research), ["G0001"]);
    const { entries } = (await (await fetch(`${info.url}/log`)).json()) as { entries: { research?: string; what: string[] }[] };
    assert.equal(entries.find((e) => e.what.some((l) => /session started/.test(l)))?.research, "G0001");
  } finally {
    await w.ok(["live", "stop"]);
  }
  // taken up again; a conversation about one direction asks first (it costs)
  assert.match((await link("direction?id=G0002&do=resume", ["a", ""])).out, /▶ „Kdo byla Anna\?“ zase běží/);
  assert.equal((await w.ok(["research", "show", "G0002", "--json"])).json.research.state, "active");
  assert.match((await link("chat?research=G0002", ["n"])).out, /Aplikace Strom žádá: rozhovor s agentem \(.*\) o směru „Kdo byla Anna\?“, jen jeho úkoly\./);
  w.cleanup();
});
