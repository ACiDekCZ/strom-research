// Work that waits for the person's decision about an archive's images (core/archivewait.ts): the queue holds back a
// task whose images lie only on such an archive, a session that met the question hands its task over as waiting for
// the decision (never back to the queue to ask again and again), the question keeps since when it waits and which
// tasks stand on it, the brief never invites another fetch there, and every way the person decides wakes the tasks
// that waited — in every research here. A person's answer is simulated only in each test's own settings (R8).

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit, fakeConnector, readJsonFile } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";

const opts = { skip: !hasGit };
const agent = path.join(import.meta.dirname, "..", "fixtures", "agent.ts");

const archives = (w: World) => path.join(w.env.STROM_CONFIG_DIR!, "archives.json");
const question = (w: World) => readJsonFile(archives(w)).pending.find((p: { kind: string }) => p.kind === "permission");
const task = async (w: World, id: string, cwd?: string) => (await w.ok(["task", "show", id, "--json"], cwd ? { cwd } : {})).json.task as { state: string; waitingOn?: string; awaitsPermission?: { hosts: string[]; since: string; title?: string }; parkedReason?: string };
const fetchOne = (w: World, o: { cwd?: string; env?: Record<string, string>; choice?: string | null } = {}) =>
  w.run(["fetch", "zkusebni", "5359", "--images", "1-2", "--recordset", "B1", "--json"], { ...(o.cwd ? { cwd: o.cwd } : {}), ...(o.env ? { env: o.env } : {}), ...(o.choice !== undefined ? { choice: o.choice } : {}) });

/** A research whose baptisms lie on an archive whose terms restrict automation (no network: it is never reached). */
async function world(name = "Novákovi"): Promise<World> {
  const w = new World();
  await w.withTree(name);
  await fakeConnector(w, "zkusebni", "", { automation: "restricted", terms: "https://archive.example.org/terms" });
  await researchHere(w);
  return w;
}

async function researchHere(w: World, cwd?: string): Promise<void> {
  const o = cwd ? { cwd } : {};
  await w.ok(["research", "new", "Předci Jana Nováka", "--new-person", "Jan /Novák/", "--sex", "M", "--born", "ABT 1905", "--born-place", "Týnec nad Labem"], o);
  await w.ok(["recordset", "add", "Týnec N 1903–1920", "--kinds", "baptism", "--places", "Týnec nad Labem", "--years", "1903-1920", "--url", "https://archive.example.org/book/5359"], o); // B1
  await w.ok(["task", "add", "Křest Jana", "--level", "link", "--where", "B1", "--why", "rodiče", "--done-when", "zápis", "--about", "P1"], o); // T1
}

test("the queue holds back a task whose images wait for the person's decision; a second fetch keeps since when; the brief never invites a fetch there", opts, async () => {
  const w = await world();
  try {
    await w.ok(["recordset", "add", "Týnec O 1903–1920", "--kinds", "marriage", "--places", "Týnec nad Labem", "--years", "1903-1920", "--url", "https://archive.example.org/book/5360"]); // B2, not the task's
    assert.equal((await w.ok(["task", "next", "--json"])).json.task.id, "T0001", "no question yet: in the queue");
    assert.match((await w.ok(["brief", "T1"])).out, /no decision of the person's yet: a fetch of its images asks them once/);
    assert.equal((await fetchOne(w)).code, 4);
    const first = question(w);
    assert.equal(first.tries, 1);

    // out of the queue, and said why
    const next = await w.ok(["task", "next", "--json"]);
    assert.notEqual(next.json.task?.id, "T0001");
    assert.ok(!(await w.ok(["task", "list", "--json"])).json.tasks.some((t: { id: string }) => t.id === "T0001"));
    assert.match((await w.ok(["task", "list"])).out, /1 more wait out of the queue \(T0001\): their images are at Testovací archiv \(archive\.example\.org\), whose question waits for the person since \d{4}-\d\d-\d\d — another source meanwhile, or strom task wait T0001 --images B…/);

    // asked again: since when stays the first time, the tries count
    await new Promise((r) => setTimeout(r, 15));
    assert.equal((await fetchOne(w)).code, 4);
    const again = question(w);
    assert.equal(again.at, first.at);
    assert.equal(again.tries, 2);
    assert.ok(again.last > first.at);

    // the brief: no invitation to fetch, the question named for every book of the research on that archive
    const brief = (await w.ok(["brief", "T1"])).out;
    assert.doesNotMatch(brief, /strom fetch asks them|fetch: zkusebni|— strom fetch zkusebni/);
    assert.match(brief, /archive archive\.example\.org: restricted · the person's decision on its images waits since \d{4}-\d\d-\d\d/);
    assert.match(brief, /no images here yet — a question waits for the person since \d{4}-\d\d-\d\d \(needed 2×\) — do not fetch from archive\.example\.org again: another source, or strom task wait T0001 --images B0001:<from-to>/);
    assert.match(brief, /## Archives whose images wait for the person's decision[^\n]*\n {2}Testovací archiv \(archive\.example\.org\): a question waits for the person since [^\n]*· its books here: B0001, B0002/);

    // decided by the person: back in the queue
    await w.ok(["allow", "archive", "archive.example.org", "--way", "slow"], { tty: true });
    assert.equal((await w.ok(["task", "next", "--json"])).json.task.id, "T0001");
    const decided = (await w.ok(["brief", "T1"])).out;
    assert.doesNotMatch(decided, /a question waits for the person/);
    // allowed slowly: its images fetched sparingly, as the method says for a restricted archive
    assert.match(decided, /archive archive\.example\.org: restricted · the person's permission: images slowly · fetch sparingly: an index by halving, a page to its image by 1–2 images, an entry ±1/);
    assert.match(fs.readFileSync(path.join(w.cwd, "AGENTS.md"), "utf8"), /never offer the user to change your permissions or settings,\s+strom's or the tree's, to get round it/);
  } finally {
    w.cleanup();
  }
});

test("strom run: a session that met the question hands its task over as waiting for the decision — the next run does not pick it; the person's decision wakes it", opts, async () => {
  const w = await world();
  try {
    Object.assign(w.env, { STROM_RUNNER_SCRIPT: agent, AGENT_MODE: "fetch-wait" });
    const r = await w.run(["run", "--agent", "script", "--json"]);
    assert.equal(r.code, 0, r.out + r.err);
    assert.equal(r.json.sessions[0].task, "T0001");
    const t = await task(w, "T1");
    assert.equal(t.state, "waiting");
    assert.equal(t.waitingOn, "Rozhodnutí o stahování z archivu Testovací archiv");
    assert.deepEqual(t.awaitsPermission?.hosts, ["archive.example.org"]);
    // the question names the research's task
    const id = Tree.open(w.cwd, w.env).config.id;
    assert.deepEqual(question(w).tasks, [{ tree: id, task: "T0001" }]);
    assert.ok(!fs.existsSync(path.join(w.cwd, ".strom", "archive-waits")) || !fs.readdirSync(path.join(w.cwd, ".strom", "archive-waits")).length, "what the session met goes with it");
    // the next run: never the same task again (nothing else to do: no session at all)
    const again = (await w.ok(["run", "--agent", "script", "--json"])).json;
    assert.ok(!again.sessions.some((s: { task: string }) => s.task === "T0001"));
    // the menu's What waits: the question at its archive's place; opened, its tasks, since when and the tries
    const menu = await w.run([], { tty: true, answers: ["3", "1", "0", "0", "0"] });
    assert.match(menu.out, /Čekají na to úkoly: T0001\n {4}Čeká od [^\n]+ · pokusy o stažení: 1/);
    // the person decides in the menu: the task comes back
    const yes = await w.run([], { tty: true, answers: ["3", "1", "1", "0", "0"] });
    assert.match(yes.out, /Úkoly T0001 se vracejí do fronty\./);
    const back = await task(w, "T1");
    assert.equal(back.state, "open");
    assert.equal(back.awaitsPermission, undefined);
    assert.equal(back.waitingOn, undefined);
  } finally {
    w.cleanup();
  }
});

test("strom allow archive --way wakes the tasks waiting and parked on the archive in every research here; by hand keeps those for images by hand", opts, async () => {
  const w = await world();
  try {
    // this research: the task handed over unfinished after the question (waiting); another for images by hand
    await w.ok(["session", "start", "T1"]);
    assert.equal((await fetchOne(w)).code, 4);
    await w.ok(["session", "close", "--continue", "--summary", "čeká", "--next", "snímky 1–2"]);
    assert.equal((await task(w, "T1")).state, "waiting");
    // a second research: its task put aside by the agent after meeting the same question (parked, the archive said)
    await w.ok(["init", "Druzí"], { cwd: w.home });
    const other = w.treeDir("Druzí");
    await researchHere(w, other);
    await w.ok(["session", "start", "T1"], { cwd: other });
    assert.equal((await fetchOne(w, { cwd: other })).code, 4);
    await w.ok(["task", "park", "T1", "--reason", "snímky čekají na rozhodnutí"], { cwd: other });
    await w.ok(["session", "close", "--summary", "odloženo", "--next", "jiný zdroj"], { cwd: other });
    const parked = await task(w, "T1", other);
    assert.equal(parked.state, "parked");
    assert.deepEqual(parked.awaitsPermission?.hosts, ["archive.example.org"]);
    // the question gathers both researches' tasks
    assert.equal(question(w).tasks.length, 2);

    // by hand: a task that waited only for the decision comes back (its session says which images, by hand)
    const manual = await w.ok(["allow", "archive", "archive.example.org", "--way", "manual"], { tty: true });
    assert.match(manual.out, /Úkoly T0001 se vracejí do fronty\./);
    assert.match(manual.out, /Druzí: Úkoly T0001 se vracejí do fronty\./);
    assert.equal((await task(w, "T1")).state, "open");
    assert.equal((await task(w, "T1", other)).state, "open");

    // a task waiting for images by hand keeps waiting by hand, comes back with "slowly"
    await w.ok(["allow", "archive", "archive.example.org", "--revoke"], { tty: true });
    await w.ok(["task", "wait", "T1", "--images", "B1:1-2", "--on", "snímky 1–2 knihy narozených"]);
    const kept = await w.ok(["allow", "archive", "archive.example.org", "--way", "manual"], { tty: true });
    assert.match(kept.out, /Úkoly T0001 dál čekají na snímky uložené ručně\./);
    assert.equal((await task(w, "T1")).state, "waiting");
    const slow = await w.ok(["allow", "archive", "archive.example.org", "--way", "slow"], { tty: true });
    assert.match(slow.out, /^ {2}Úkoly T0001 se vracejí do fronty\.$/m);
    assert.doesNotMatch(slow.out, /Druzí/);
    assert.equal((await task(w, "T1")).state, "open");
  } finally {
    w.cleanup();
  }
});

test("the person's answer in the window of a fetch wakes the tasks that waited for the archive", opts, async () => {
  const w = await world();
  try {
    await w.ok(["session", "start", "T1"]);
    assert.equal((await fetchOne(w)).code, 4);
    await w.ok(["session", "close", "--continue", "--summary", "čeká", "--next", "snímky 1–2"]);
    assert.equal((await task(w, "T1")).state, "waiting");
    // an agent's fetch: the person at the screen allows it slowly in the window
    const r = await fetchOne(w, { env: { CLAUDECODE: "1" }, choice: "slow" });
    assert.notEqual(r.code, 4, r.out + r.err);
    assert.match(r.err, /the person decided archive\.example\.org — tasks back in the queue: Novákovi T0001/);
    assert.equal((await task(w, "T1")).state, "open");
  } finally {
    w.cleanup();
  }
});

test("above the menu: a question that waits long, or holds up much, is said with since when and how many tasks stand on it", opts, async () => {
  const w = await world();
  try {
    assert.equal((await fetchOne(w)).code, 4);
    const plain = await w.run([], { tty: true, answers: ["0"] });
    assert.match(plain.out, /^Čeká rozhodnutí o stahování z archivu Testovací archiv$/m);
    // four days old: since when, and the task held back for it
    const s = readJsonFile(archives(w));
    const old = new Date(Date.now() - 4 * 86_400_000).toISOString();
    s.pending = s.pending.map((p: { kind: string }) => (p.kind === "permission" ? { ...p, at: old } : p));
    fs.writeFileSync(archives(w), JSON.stringify(s));
    const long = await w.run([], { tty: true, answers: ["0"] });
    assert.match(long.out, /^Už od \d+\. \d+\. čeká rozhodnutí o stahování z archivu Testovací archiv – stojí na něm úkoly: 1$/m);
    assert.doesNotMatch(long.out, /^Čeká rozhodnutí o stahování/m);
    // fresh again, but three tasks stand on it
    s.pending = s.pending.map((p: { kind: string }) => (p.kind === "permission" ? { ...p, at: new Date().toISOString() } : p));
    fs.writeFileSync(archives(w), JSON.stringify(s));
    for (const n of ["2", "3"]) await w.ok(["task", "add", `Křest ${n}`, "--level", "verify", "--where", "B1", "--why", "a", "--done-when", "b", "--about", "P1"]);
    const many = await w.run([], { tty: true, answers: ["0"] });
    assert.match(many.out, /^Už od \d+\. \d+\. čeká rozhodnutí o stahování z archivu Testovací archiv – stojí na něm úkoly: 3$/m);
    // the English and German forms
    const en = await w.run([], { tty: true, answers: ["0"], env: { STROM_LANG: "en", LANG: "en_US.UTF-8" } });
    assert.match(en.out, /A decision on downloading from the archive Testovací archiv has waited since [^\n]+ – tasks held up by it: 3/);
  } finally {
    w.cleanup();
  }
});

test("the person forgets the archive's decision: its question goes, a task that waited only for it comes back to the queue — asked again at the next real need", opts, async () => {
  const w = await world();
  try {
    await w.ok(["session", "start", "T1"]);
    assert.equal((await fetchOne(w)).code, 4);
    await w.ok(["session", "close", "--continue", "--summary", "čeká", "--next", "snímky 1–2"]);
    assert.equal((await task(w, "T1")).state, "waiting");
    const r = await w.ok(["allow", "archive", "archive.example.org", "--revoke"], { tty: true });
    assert.match(r.out, /Úkoly T0001 se vracejí do fronty\./);
    assert.equal(question(w), undefined, "no question waits");
    const back = await task(w, "T1");
    assert.equal(back.state, "open");
    assert.equal(back.awaitsPermission, undefined);
    assert.equal((await w.ok(["task", "next", "--json"])).json.task.id, "T0001");
    // the real need: asked again
    assert.equal((await fetchOne(w)).code, 4);
    assert.ok(question(w));
  } finally {
    w.cleanup();
  }
});

// A review: the agent met the question through a connector of its own, then took the connector away (its question
// went with it) — and the session's end still left the task waiting on a question nobody would ever be asked.
test("a session whose question went with the connector it made hands its task back to the queue, never waiting on nothing", opts, async () => {
  const w = new World();
  await w.withTree("Novákovi");
  try {
    await researchHere(w);
    await w.ok(["session", "start", "T1"]);
    await fakeConnector(w, "vlastni", "", { automation: "restricted", terms: "https://archive.example.org/terms" }, { confirm: false });
    assert.equal((await w.run(["fetch", "vlastni", "5359", "--images", "1-2", "--recordset", "B1", "--json"])).code, 4);
    assert.ok(question(w), "the person is asked");
    await w.ok(["connector", "discard", "vlastni"]);
    assert.equal(question(w), undefined, "its question went with it");
    await w.ok(["session", "close", "--continue", "--summary", "konektor nic nepřinesl", "--next", "jiný zdroj"]);
    const t = await task(w, "T1");
    assert.equal(t.state, "open");
    assert.equal(t.awaitsPermission, undefined);
    assert.equal((await w.ok(["task", "next", "--json"])).json.task.id, "T0001");
  } finally {
    w.cleanup();
  }
});
