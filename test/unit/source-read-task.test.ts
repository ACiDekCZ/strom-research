// A source read again from its original (core/sourceread.ts keepSourceReading): a task to hold the new reading
// against the transcript only where they differ in a matter of fact; differing in trifles alone (spelling, an
// abbreviation, punctuation, letter case) the reading is kept beside the source, said to differ, no task; in the task's
// "why" the matters of fact come first.

import "../helpers.ts"; // run alone too: never the person's home and settings
import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Tree } from "../../src/core/tree.ts";
import { create, update } from "../../src/core/records.ts";
import { decideReading, keepSourceReading, readAgainOf, replacePlaces, sourceReadForApp, unverifiedReading } from "../../src/core/sourceread.ts";
import { decideProposal } from "../../src/core/proposal.ts";
import { transcriptMark } from "../../src/core/readers.ts";
import type { ReadResult } from "../../src/core/document.ts";
import type { Source, Task } from "../../src/core/model.ts";

function folder(t: TestContext): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strom-source-read-task-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

const TRANSCRIPT = "Die 3. Novembris 1822 baptizatus est Lhotimír filius Lhotomili Lhoták et Lhotislavae, Lhota No. 12.";

/**
 * The research's agent here, the same on every computer: a stand-in Claude Code first on PATH (never the real one, nor
 * the marks of an agent the tests happen to run in) — without it a research waiting for its agent acts as an archive.
 */
function agentHere(dir: string): NodeJS.ProcessEnv {
  const agents = path.join(dir, "agents");
  fs.mkdirSync(agents);
  if (process.platform === "win32") fs.writeFileSync(path.join(agents, "claude.cmd"), "@exit /b 0\r\n");
  else fs.writeFileSync(path.join(agents, "claude"), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
  return { ...process.env, PATH: [agents, process.env.PATH ?? ""].join(path.delimiter) };
}

function treeWithSource(t: TestContext): { tree: Tree; source: Source } {
  const dir = folder(t);
  const root = path.join(dir, "Lhotákovi");
  const tree = Tree.create(root, "Lhotákovi", "cs", agentHere(dir));
  const source = create<Source>(
    tree,
    "source",
    { kind: "baptism", title: "Křest Vojtěcha Lhotáka 1822", transcript: TRANSCRIPT, information: "primary", form: "original" } as never,
    (id) => `+${id} source`,
  );
  return { tree, source };
}

type Who = { agent: string; model?: string; effort?: string };
function reading(id: string, transcript: string, blind?: string, who: Who[] = [{ agent: "claude", model: "claude-opus-5-5", effort: "high" }]): ReadResult {
  return {
    id,
    state: "done",
    version: 1,
    lang: "cs",
    at: "2026-11-07T10:00:00Z",
    since: "2026-11-07T09:59:00Z",
    doc: {},
    readers: { asked: blind === undefined ? 1 : 2, ran: blind === undefined ? 1 : 2, agree: null, who },
    ...(blind === undefined ? {} : { blind: { doc: {}, entries: [{ id: "b1", page: 1, transcript: blind, of: "e1" }] } }),
    pages: [],
    entries: [{ id: "e1", page: 1, transcript, persons: [], events: [], relations: [] }],
  } as never;
}

const tasks = (tree: Tree) => tree.list<Task>("task").filter((x) => x.origin === "read:source");

test("trifles alone (abbreviations, punctuation; NFD): the reading kept, said to differ, no task", (t) => {
  const { tree, source } = treeWithSource(t);
  // the same entry: "baptizatus" abbreviated, "No." as "Nro.", a comma left out, the names in NFD
  const trifles = "Die 3. Novembris 1822 bapt. est Lhotimír filius Lhotomili Lhoták et Lhotislavae Lhota Nro. 12.".normalize("NFD");
  const kept = keepSourceReading(tree, { id: source.id }, reading("D20261107100000-aaaa", trifles));
  assert.equal(kept.agree, "differ", "it differs");
  assert.ok(kept.variants?.length, JSON.stringify(kept));
  assert.equal(kept.task, undefined, "no task");
  assert.deepEqual(tasks(tree), []);
  assert.deepEqual(tree.get<Source>(source.id)!.readings, ["D20261107100000-aaaa"], "kept beside the source");
});

test("a matter of fact (another number, another name): a task, the matters of fact first in its why", (t) => {
  const { tree, source } = treeWithSource(t);
  // first a trifle ("baptizatus" abbreviated), then another name of the mother and another house number
  const fact = "Die 3. Novembris 1822 bapt. est Lhotimír filius Lhotomili Lhoták et Lhotěnae, Lhota No. 13.";
  const kept = keepSourceReading(tree, { id: source.id }, reading("D20261107100000-bbbb", fact));
  assert.equal(kept.agree, "differ");
  assert.ok(kept.task, "a task");
  const [task] = tasks(tree);
  assert.equal(task?.id, kept.task);
  assert.equal(task?.level, "verify");
  const why = task!.why;
  const first = why.indexOf("12.");
  const name = why.indexOf("Lhotislavae");
  const trifle = why.indexOf("baptizatus");
  assert.ok(first >= 0 && name >= 0 && trifle >= 0, why);
  assert.ok(first < trifle && name < trifle, `the matters of fact before the trifle: ${why}`);
});

test("the same reading: no task, nothing said to differ", (t) => {
  const { tree, source } = treeWithSource(t);
  const kept = keepSourceReading(tree, { id: source.id }, reading("D20261107100000-cccc", TRANSCRIPT));
  assert.deepEqual([kept.agree, kept.task, kept.variants], ["same", undefined, []]);
  assert.deepEqual(tasks(tree), []);
});

const FACT = "Die 3. Novembris 1822 baptizatus est Lhotimír filius Lhotomili Lhoták et Lhotěnae, Lhota No. 12.";
const OTHER_MODEL: Who[] = [
  { agent: "claude", model: "claude-opus-5-5", effort: "high" },
  { agent: "codex", model: "gpt-5.5", effort: "high" },
];

test("two readers agree against the transcript: a task, who read it in its why (agent · model · effort), the reading only a lead", (t) => {
  const { tree, source } = treeWithSource(t);
  const kept = keepSourceReading(tree, { id: source.id }, reading("D20261107100000-dddd", FACT, FACT.normalize("NFD"), OTHER_MODEL));
  assert.ok(kept.task, JSON.stringify(kept));
  assert.equal(kept.variants?.[0]?.sure, undefined, "sure");
  const task = tree.get<Task>(kept.task!)!;
  assert.match(task.why, /četl claude · claude-opus-5-5 · high \+ codex · gpt-5\.5 · high/u);
  assert.match(task.why, /jen vodítko/u);
  assert.doesNotMatch(task.why, /stejným modelem/u);
  assert.match(task.doneWhen, /přepis změněný jen tam, kde to ukazuje sám snímek, jinde poznámka u pramene/u);
});

test("two readers of the same model agree: a task that says it is weaker evidence", (t) => {
  const { tree, source } = treeWithSource(t);
  const same: Who[] = [{ agent: "claude", model: "claude-opus-5-5", effort: "high" }, { agent: "claude", model: "claude-opus-5-5", effort: "medium" }];
  const kept = keepSourceReading(tree, { id: source.id }, reading("D20261107100000-eeee", FACT, FACT, same));
  assert.match(tree.get<Task>(kept.task!)!.why, /Oba čtenáři četli stejným modelem \(claude-opus-5-5\): kde se shodují, je to slabší doklad/u);
});

test("the readers disagree (the blind one reads as the transcript): uncertainty — no task, the place kept said not sure", (t) => {
  const { tree, source } = treeWithSource(t);
  const kept = keepSourceReading(tree, { id: source.id }, reading("D20261107100000-ffff", FACT, TRANSCRIPT, OTHER_MODEL));
  assert.equal(kept.agree, "differ");
  assert.deepEqual(kept.variants, [{ at: "Lhotislavae,", other: "Lhotěnae,", sure: false }]);
  assert.equal(kept.task, undefined);
  assert.deepEqual(tasks(tree), []);
  // the blind reader reads yet another name: no agreement either
  const { tree: t2, source: s2 } = treeWithSource(t);
  const other = keepSourceReading(t2, { id: s2.id }, reading("D20261107100000-ffff", FACT, FACT.replace("Lhotěnae", "Mariae"), OTHER_MODEL));
  assert.equal(other.task, undefined, JSON.stringify(other));
});

test("one reader, the word of the transcript read as illegible or not sure: no matter of fact; a word where the transcript could not read: one", (t) => {
  const { tree, source } = treeWithSource(t);
  for (const [id, text] of [["D20261107100000-a001", FACT.replace("Lhotěnae", "[...]")], ["D20261107100000-a002", FACT.replace("Lhotěnae", "Lhotěnae[?]")]] as const) {
    const kept = keepSourceReading(tree, { id: source.id }, reading(id, text));
    assert.equal(kept.task, undefined, `${text}: ${JSON.stringify(kept)}`);
    assert.ok(kept.variants?.every((v) => v.sure === false), JSON.stringify(kept.variants));
  }
  assert.deepEqual(tasks(tree), []);
  // the other way round: the transcript has [...] where the new reading reads a name — a matter of fact
  const root = path.join(folder(t), "Lhotákovi");
  const t2 = Tree.create(root, "Lhotákovi", "cs", process.env);
  const s2 = create<Source>(t2, "source", { kind: "baptism", title: "Křest", transcript: TRANSCRIPT.replace("Lhotislavae", "[...]"), information: "primary", form: "original" } as never, (id) => `+${id} source`);
  const kept = keepSourceReading(t2, { id: s2.id }, reading("D20261107100000-a003", TRANSCRIPT));
  assert.ok(kept.task, JSON.stringify(kept));
});

// the result of a reading as finish keeps it (notes/readings/<id>.json): what a later reading of the source looks at
function kept(tree: Tree, id: string, source: ReturnType<typeof keepSourceReading>): void {
  fs.mkdirSync(path.join(tree.root, "notes", "readings"), { recursive: true });
  fs.writeFileSync(path.join(tree.root, "notes", "readings", `${id}.json`), JSON.stringify({ id, source }));
}

test("read again after its task ended: the places it judged asked again in no task (said judged in it); a new place: a task of it alone", (t) => {
  const { tree, source } = treeWithSource(t);
  const first = keepSourceReading(tree, { id: source.id }, reading("D20261107100000-b001", FACT));
  assert.ok(first.task);
  kept(tree, "D20261107100000-b001", first);
  update<Task>(tree, first.task!, "task", (x) => ({ ...x, state: "done" }), { op: "task.done", summary: "done" });
  // the same place again (in NFD): no task, said judged in the first one
  const again = keepSourceReading(tree, { id: source.id }, reading("D20261107100000-b002", FACT.normalize("NFD")));
  assert.equal(again.task, undefined, JSON.stringify(again));
  assert.deepEqual(again.variants?.map((v) => v.judged), [first.task]);
  assert.equal(tasks(tree).length, 1);
  kept(tree, "D20261107100000-b002", again);
  // a place not judged yet (another house number): a new task, of it alone
  const more = keepSourceReading(tree, { id: source.id }, reading("D20261107100000-b003", FACT.replace("No. 12.", "No. 13.")));
  assert.ok(more.task && more.task !== first.task, JSON.stringify(more));
  const why = tree.get<Task>(more.task!)!.why;
  assert.match(why, /12\./u);
  assert.doesNotMatch(why, /Lhotislavae/u, "the judged place not asked again");
});

test("read again while its task is open: one task of the source — the new places said in it, none twice", (t) => {
  const { tree, source } = treeWithSource(t);
  const first = keepSourceReading(tree, { id: source.id }, reading("D20261107100000-c001", FACT));
  kept(tree, "D20261107100000-c001", first);
  const same = keepSourceReading(tree, { id: source.id }, reading("D20261107100000-c002", FACT));
  assert.equal(same.task, first.task);
  const why0 = tree.get<Task>(first.task!)!.why;
  assert.doesNotMatch(why0, /Znovu přečteno/u, "nothing new: nothing added");
  kept(tree, "D20261107100000-c002", same);
  const more = keepSourceReading(tree, { id: source.id }, reading("D20261107100000-c003", FACT.replace("No. 12.", "No. 13.")));
  assert.equal(more.task, first.task);
  assert.equal(tasks(tree).length, 1);
  assert.match(tree.get<Task>(first.task!)!.why, /Znovu přečteno \(D20261107100000-c003; četl claude · claude-opus-5-5 · high\), nová místa — přepis: 12\.; nové čtení: 13\./u);
});


// read.sourceTask ask with the source's task not ended, a transcript the person confirmed, and what became of the
// newest reading again (readAgainOf, the Strom app's source viewer: the app's ZADANI_DEV_ukol-z-cteni.md §1–§3)

/** The person confirmed the transcript of the source (spec 022): their own reading of it. */
function confirm(tree: Tree, id: string): void {
  update<Source>(tree, id, "source", (x) => ({ ...x, read: { ...x.read, user: { how: "confirm", at: "2026-11-01T10:00:00Z", txt: transcriptMark(x.transcript!) } } }), { op: "source.confirm", summary: "confirmed" });
}

/** A reading again kept beside the source as finish keeps it, read.sourceTask as asked. */
function readAgain(tree: Tree, source: string, id: string, text: string, with_: "ask" | "always" | "never", blind?: string): ReturnType<typeof keepSourceReading> {
  const result = reading(id, text, blind, blind === undefined ? undefined : OTHER_MODEL);
  const r = keepSourceReading(tree, { id: source }, result, with_);
  fs.mkdirSync(path.join(tree.root, "notes", "readings"), { recursive: true });
  fs.writeFileSync(path.join(tree.root, "notes", "readings", `${id}.json`), JSON.stringify({ ...result, source: r }));
  return r;
}

test("ask with the source's task not ended: nothing said in it — offered, its task named (openTask); the person's queue puts the places in it (appended), keep is allowed", (t) => {
  const { tree, source } = treeWithSource(t);
  const first = readAgain(tree, source.id, "D20261107100000-d001", FACT, "always");
  assert.ok(first.task);
  const why = tree.get<Task>(first.task!)!.why;
  // another house number, read with ask: no task takes it until the person says so
  const more = readAgain(tree, source.id, "D20261107100000-d002", FACT.replace("No. 12.", "No. 13."), "ask");
  assert.deepEqual([more.task, more.offer, more.appended], [undefined, 1, undefined], JSON.stringify(more));
  assert.equal(tree.get<Task>(first.task!)!.why, why, "nothing said in the open task");
  assert.deepEqual(unverifiedReading(tree, tree.get<Source>(source.id)!), { reading: "D20261107100000-d002", places: 1, open: first.task });
  const app = sourceReadForApp(tree, more, "D20261107100000-d002", "always");
  assert.deepEqual([app.taskSetting, app.taskOffer, app.openTask, app.task, app.decided], ["ask", true, first.task, undefined, undefined], JSON.stringify(app));
  assert.equal("offer" in app || "taskWith" in app, false, "the internal names never given to the app");
  assert.deepEqual(app.state, { read: "D20261107100000-d002", state: "unchecked" });
  // queue: into the task not ended
  const out = decideReading(tree, source.id, "queue");
  assert.deepEqual([out.task, out.appended, out.taskFor], [first.task, true, "agent"]);
  assert.match(tree.get<Task>(first.task!)!.why, /nová místa — přepis: 12\.; nové čtení: 13\./u);
  assert.equal(tasks(tree).length, 1);
  const decided = sourceReadForApp(tree, more, "D20261107100000-d002", "ask");
  assert.deepEqual([decided.taskOffer, decided.task, decided.taskFor, decided.appended, decided.openTask], [false, first.task, "agent", true, undefined]);
  assert.deepEqual(readAgainOf(tree, tree.get<Source>(source.id)!), { read: "D20261107100000-d002", state: "task", task: first.task, taskFor: "agent", taskOpen: true, taskQueued: true });
  // a further place, just kept while the task is open: allowed, the task untouched
  readAgain(tree, source.id, "D20261107100000-d003", FACT.replace("No. 12.", "No. 14."), "ask");
  const why2 = tree.get<Task>(first.task!)!.why;
  assert.deepEqual(decideReading(tree, source.id, "keep"), { source: source.id, reading: "D20261107100000-d003", take: "keep", places: 1 });
  assert.equal(tree.get<Task>(first.task!)!.why, why2);
  assert.deepEqual(readAgainOf(tree, tree.get<Source>(source.id)!), { read: "D20261107100000-d003", state: "saved" });
  assert.deepEqual(sourceReadForApp(tree, tree.get<Source>(source.id) && JSON.parse(fs.readFileSync(path.join(tree.root, "notes", "readings", "D20261107100000-d003.json"), "utf8")).source, "D20261107100000-d003", "ask").decided, "saved");
});

test("a transcript the person confirmed: never the agent's task — review proposes them the wording with the new places (their waiting task), the transcript and their reading unchanged; declined: not offered again", (t) => {
  const { tree, source } = treeWithSource(t);
  confirm(tree, source.id);
  const before = tree.get<Source>(source.id)!;
  const r = readAgain(tree, source.id, "D20261107100000-e001", FACT, "ask");
  assert.deepEqual([r.offer, r.task], [1, undefined]);
  assert.throws(() => decideReading(tree, source.id, "now"), { code: "read.decide.confirmed" });
  assert.throws(() => decideReading(tree, source.id, "queue"), { code: "read.decide.confirmed" });
  const out = decideReading(tree, source.id, "review");
  assert.deepEqual([out.take, out.taskFor, out.appended], ["review", "person", undefined]);
  const p = tree.get<Task>(out.task!)!;
  assert.deepEqual([p.origin, p.state], ["transcript:proposal", "waiting"]);
  assert.equal(p.proposal?.text, FACT, "the transcript with the new reading's place");
  assert.equal(p.proposal?.by, "claude · claude-opus-5-5 · high");
  assert.equal(p.proposal?.reading, "D20261107100000-e001");
  assert.match(p.why, /Lhotislavae/u);
  assert.deepEqual(tasks(tree), [], "no task of the agent's");
  const after = tree.get<Source>(source.id)!;
  assert.equal(after.transcript, TRANSCRIPT);
  assert.deepEqual(after.read, before.read, "their reading stays");
  // an agent's edit of it: still refused (K2.3)
  assert.throws(() => update<Source>(tree, source.id, "source", (x) => ({ ...x, transcript: FACT }), { op: "source.edit", summary: "edit" }), { code: "source.transcript.confirmed" });
  const state = readAgainOf(tree, after)!;
  assert.deepEqual({ ...state, proposal: undefined }, { read: "D20261107100000-e001", state: "task", task: p.id, taskFor: "person", taskOpen: true, taskQueued: false, proposal: undefined });
  assert.deepEqual(state.proposal, { text: FACT, by: "claude · claude-opus-5-5 · high", task: p.id, at: p.proposal!.at });
  assert.deepEqual([sourceReadForApp(tree, r, "D20261107100000-e001", "ask").taskFor, sourceReadForApp(tree, r, "D20261107100000-e001", "ask").taskOffer], ["person", false]);
  // the person keeps theirs: the same places read again are judged in that task, offered no more
  tree.personWrites = true;
  decideProposal(tree, source.id, "keep", { how: "confirm" });
  tree.personWrites = false;
  const again = readAgain(tree, source.id, "D20261107100000-e002", FACT.normalize("NFD"), "ask");
  assert.deepEqual([again.offer, again.task], [undefined, undefined], JSON.stringify(again));
  assert.deepEqual(again.variants?.map((v) => v.judged), [p.id]);
  assert.throws(() => decideReading(tree, source.id, "review"), { code: "read.decide.nothing" });
  assert.deepEqual(readAgainOf(tree, tree.get<Source>(source.id)!), { read: "D20261107100000-e002", state: "task", task: p.id, taskFor: "person", taskOpen: false, taskQueued: false });
});

test("review of a transcript nobody confirmed: refused; always on a confirmed one: the wording proposed at once, never an agent's task", (t) => {
  const { tree, source } = treeWithSource(t);
  readAgain(tree, source.id, "D20261107100000-f001", FACT, "ask");
  assert.throws(() => decideReading(tree, source.id, "review"), { code: "read.decide.unconfirmed" });
  const { tree: t2, source: s2 } = treeWithSource(t);
  confirm(t2, s2.id);
  const r = readAgain(t2, s2.id, "D20261107100000-f002", FACT.replace("No. 12.", "No. 13."), "always");
  assert.deepEqual([r.taskFor, r.offer], ["person", undefined]);
  const p = t2.get<Task>(r.task!)!;
  assert.equal(p.proposal?.text, FACT.replace("No. 12.", "No. 13."));
  assert.deepEqual(tasks(t2), []);
  assert.deepEqual(sourceReadForApp(t2, r, "D20261107100000-f002", "ask").taskSetting, "always");
});

test("a wording of the places: found whatever the spacing, never inside a longer word, any script; nothing found: none", () => {
  assert.equal(replacePlaces("Войтех  Лхотак,\nсын Иржи".normalize("NFC"), [{ at: "Лхотак, сын", other: "Лготак, сын" }]), "Войтех  Лготак, сын Иржи");
  assert.equal(replacePlaces("Lhotákova a Lhoták", [{ at: "Lhoták".normalize("NFD"), other: "Lhotak" }]), "Lhotákova a Lhotak");
  assert.equal(replacePlaces("Lhota No. 12.", [{ at: "12.", other: "13." }, { at: "", other: "Nro." }]), "Lhota No. 13.");
  assert.equal(replacePlaces("filius Lhotomili Lhoták", [{ at: "Lhotomili", other: "" }]), "filius Lhoták");
  assert.equal(replacePlaces("Lhota", [{ at: "Lhotka", other: "Lhota" }]), undefined);
});

test("what became of the newest reading again: unchecked, saved (trifles alone, places not sure), a task open in the queue, taken now, ended", (t) => {
  const state = (tree: Tree, id: string) => readAgainOf(tree, tree.get<Source>(id)!);
  const { tree, source } = treeWithSource(t);
  assert.equal(state(tree, source.id), undefined, "never read again");
  readAgain(tree, source.id, "D20261107100000-g001", TRANSCRIPT, "ask");
  assert.equal(state(tree, source.id), undefined, "alike");
  readAgain(tree, source.id, "D20261107100000-g002", "Die 3. Novembris 1822 bapt. est Lhotimír filius Lhotomili Lhoták et Lhotislavae, Lhota Nro. 12.", "ask");
  assert.deepEqual(state(tree, source.id), { read: "D20261107100000-g002", state: "saved", minorOnly: true });
  // the blind reader reads as the transcript: not sure — with a trifle beside it, still only unsure
  readAgain(tree, source.id, "D20261107100000-g003", FACT.replace("baptizatus", "bapt."), "ask", TRANSCRIPT);
  assert.deepEqual(state(tree, source.id), { read: "D20261107100000-g003", state: "saved", unsureOnly: true });
  readAgain(tree, source.id, "D20261107100000-g004", FACT, "never");
  assert.deepEqual(state(tree, source.id), { read: "D20261107100000-g004", state: "unchecked" });
  const now = decideReading(tree, source.id, "now");
  assert.deepEqual(state(tree, source.id), { read: "D20261107100000-g004", state: "task", task: now.task, taskFor: "agent", taskOpen: true, taskQueued: false });
  update<Task>(tree, now.task!, "task", (x) => ({ ...x, state: "done" }), { op: "task.done", summary: "done" });
  assert.deepEqual(state(tree, source.id), { read: "D20261107100000-g004", state: "task", task: now.task, taskFor: "agent", taskOpen: false, taskQueued: false });
  // the same place again: judged in the task that ended
  readAgain(tree, source.id, "D20261107100000-g005", FACT, "ask");
  assert.deepEqual(state(tree, source.id), { read: "D20261107100000-g005", state: "task", task: now.task, taskFor: "agent", taskOpen: false, taskQueued: false });
  // always: a task at once, in the queue
  const held = readAgain(tree, source.id, "D20261107100000-g006", FACT.replace("No. 12.", "No. 13."), "always");
  assert.deepEqual(state(tree, source.id), { read: "D20261107100000-g006", state: "task", task: held.task, taskFor: "agent", taskOpen: true, taskQueued: true });
});
