// A source the person deletes (spec 117 K1.1–K1.7): what it takes said first and the same as what is done (strom source
// retract --dry-run, the counts as the family tree for the Strom app has the citation lines), the values of facts kept
// (a status the citations left cannot carry lowered, a bare one among them), the main citation gone, a story's text
// never changed, tasks given up or narrowed, conflicts standing on it marked for review (2 _STROM_REVIEW, 3
// _STROM_RETRACTED under the value and the decision), one operation of the history; citing it refused; the person's
// alone (nobody to ask: exit 4, an agent refused, its preview allowed); restored as it was (skipped: gone, already,
// main; a task never given back a place of a source still deleted); the bridge's two steps, restore and conflict keep.

import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { execFileSync } from "node:child_process";
import { World, hasGit } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import { create, update } from "../../src/core/records.ts";
import { exportGedcom } from "../../src/gedcom/export.ts";
import { validateGedcom } from "../../src/gedcom/validate.ts";
import { planSync, readGedcom } from "../../src/core/sync.ts";
import { retractConfirm, retractImpacts } from "../../src/core/sourceretract.ts";
import type { Conflict, Family, Person, Source, Task } from "../../src/core/model.ts";

const opts = { skip: !hasGit };
const app = { Origin: "https://beta.stromapp.info" };
const agent = { STROM_WORKER: "agent-1", CLAUDECODE: "1" };
const open = (w: World) => Tree.open(w.cwd, w.env);
const gitHead = (w: World) => execFileSync("git", ["-C", w.cwd, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const at = "2026-11-20T10:00:00.000Z";

/** The people and families as the values go: no citations, statuses, times of writing. */
const values = (t: Tree) => JSON.parse(JSON.stringify([...t.list<Person>("person"), ...t.list<Family>("family")], (k, v) => (k === "citations" || k === "status" || k === "updated" ? undefined : v)));
/** The people, families, tasks and conflicts whole, but when they were written. */
const whole = (t: Tree) => JSON.parse(JSON.stringify([...t.list<Person>("person"), ...t.list<Family>("family"), ...t.list<Task>("task"), ...t.list<Conflict>("conflict")], (k, v) => (k === "updated" ? undefined : v)));

/** The citation lines of a source in a family tree, as the Strom app counts them: names, facts of people, families, stories. */
function gedCounts(ged: string, id: string): { names: number; events: number; families: number; stories: number } {
  const out = { names: 0, events: 0, families: 0, stories: 0 };
  const stack: string[] = [];
  let story = false;
  for (const line of ged.split(/\r?\n/u)) {
    const m = /^(\d+) (?:@[^@]+@ )?(\S+)(?: (.*))?$/u.exec(line);
    if (!m) continue;
    const level = Number(m[1]);
    stack.length = level;
    stack[level] = m[2]!;
    if (level === 1) story = false;
    if (m[2] !== "SOUR" || m[3] !== `@${id}@`) continue;
    const [record, first] = stack;
    if (first === "_STORY") {
      if (!story) out.stories++;
      story = true;
    } else if (first === "_STROM_CONFLICT" || first === "_STROM_HYPO") continue;
    else if (record === "FAM") out.families++;
    else if (first === "NAME") out.names++;
    else if (record === "INDI") out.events++;
  }
  return out;
}

/** The lines of a conflict's block in a family tree. */
const conflictBlock = (ged: string, id: string) => new RegExp(`^1 _STROM_CONFLICT ${id}\\r?\\n(?:[2-9] .*\\r?\\n)*`, "mu").exec(ged)?.[0] ?? "";

/**
 * Lhotákovi: Jan Lhoták's name, birth (S0001 main at fol. 3, and S0002), death (S0001 alone, probable) cite the baptisms
 * of Lhota (S0001); his marriage to Anna (F0001: its own citation and its marriage, S0001 alone); his story names S0001
 * in its text; three conflicts — X0001 open on S0001's value, X0002 decided naming S0001, X0003 of the same person on
 * S0002 alone; three tasks — one on S0001 alone, one also on S0002, one done.
 */
async function research() {
  const w = new World();
  await w.withTree("Lhotákovi");
  const tree = open(w);
  const ids = { s1: "", s2: "", birth: "", death: "", marr: "", x1: "", x2: "", x3: "", ta: "", tb: "", tc: "" };
  tree.withTreeLock(() => {
    ids.s1 = create<Source>(tree, "source", { kind: "baptism", title: "Matrika Lhota – křty 1840–1860", information: "primary", form: "original", notes: [] } as never, (x) => `+${x}`).id;
    ids.s2 = create<Source>(tree, "source", { kind: "death", title: "Úmrtí Lhota 1911", information: "primary", form: "original", notes: [] } as never, (x) => `+${x}`).id;
    tree.commit("sources");
  });
  await w.ok(["person", "add", "Jan /Lhoták/", "--sex", "M"]); // P0001
  await w.ok(["person", "add", "Anna /Lhotová/", "--sex", "F"]); // P0002
  await w.ok(["event", "add", "P0001", "BIRT", "--date", "1850", "--place", "Lhota", "--cite", ids.s1, "--locator", "fol. 3"]);
  await w.ok(["event", "add", "P0001", "DEAT", "--date", "1911", "--place", "Lhota", "--cite", ids.s1, "--locator", "fol. 9"]);
  await w.ok(["family", "add", "--partner", "P0001", "--partner", "P0002", "--married", "1875", "--cite", ids.s1, "--locator", "fol. 40"]);
  const t2 = open(w);
  const p = t2.get<Person>("P0001")!;
  ids.birth = p.events.find((e) => e.kind === "BIRT")!.id;
  ids.death = p.events.find((e) => e.kind === "DEAT")!.id;
  ids.marr = t2.get<Family>("F0001")!.events.find((e) => e.kind === "MARR")!.id;
  await w.ok(["cite", ids.birth, ids.s2, "--locator", "fol. 2"]);
  {
    const t = open(w);
    t.withTreeLock(() => {
      update<Person>(t, "P0001", "person", (x) => ({
        ...x,
        names: x.names.map((n, i) => (i === 0 ? { ...n, citations: [{ source: ids.s1, locator: "fol. 3" }] } : n)),
        events: x.events.map((e) => (e.id === ids.birth ? { ...e, citations: e.citations.map((c) => (c.source === ids.s1 ? { ...c, main: { by: "user" as const, at } } : c)) } : e)),
        story: { status: "final", text: `Jan Lhoták se narodil roku 1850 v Lhotě [${ids.s1}].`, facts: [ids.birth], at, by: "user" },
      }), { op: "person.edit", summary: "P0001: name cited, main citation, story" });
      update<Family>(t, "F0001", "family", (f) => ({ ...f, citations: [{ source: ids.s1, locator: "fol. 40" }] }), { op: "family.edit", summary: "F0001 cited" });
      ids.x1 = create<Conflict>(t, "conflict", { title: "Narození Jana", fact: "BIRT", subject: ["P0001"], claims: [{ source: ids.s1, value: "1850" }, { source: ids.s2, value: "1851" }], state: "open", notes: [] } as never, (x) => `+${x}`).id;
      ids.x2 = create<Conflict>(t, "conflict", { title: "Úmrtí Jana", fact: "DEAT", subject: ["P0001"], claims: [{ source: ids.s2, value: "1911" }, { value: "1912" }], state: "resolved", resolution: `Platí 1911, jak píše ${ids.s1}.`, decidedBy: "user", notes: [] } as never, (x) => `+${x}`).id;
      ids.x3 = create<Conflict>(t, "conflict", { title: "Bydliště Jana", fact: "RESI", subject: ["P0001"], claims: [{ source: ids.s2, value: "Lhota 12" }, { value: "Lhota 13" }], state: "open", notes: [] } as never, (x) => `+${x}`).id;
      const task = (what: string, where: string[], state: Task["state"]) =>
        create<Task>(t, "task", { level: "locate", priority: 3, what, where, why: "zkouška", doneWhen: "nalezeno", subject: ["P0001"], state, origin: "agent", notes: [] } as never, (x) => `+${x}`).id;
      ids.ta = task("Přečíst křest Jana", [ids.s1], "open");
      ids.tb = task("Porovnat křest a úmrtí", [ids.s1, ids.s2], "open");
      ids.tc = task("Najít matriku", [ids.s1], "done");
      t.commit("the research of the test");
    });
  }
  return { w, ids };
}

test("deleting a source: the preview is what is done, values kept, main citation gone, story text kept, tasks, conflicts marked, one operation, restored as it was", opts, async () => {
  const { w, ids } = await research();
  const { s1, s2 } = ids;
  const before = open(w);
  const valuesBefore = values(before);
  const wholeBefore = whole(before);
  const gedBefore = exportGedcom(before, { for: "strom", research: true }).text;
  const head = gitHead(w);

  // the preview: anybody's, an agent's too; nothing written
  const dry = (await w.ok(["source", "retract", s1, "--dry-run", "--json"], { env: agent })).json;
  assert.equal(dry.dryRun, true);
  assert.equal(gitHead(w), head);
  const [i] = dry.impacts;
  assert.deepEqual([i.id, i.title], [s1, "Matrika Lhota – křty 1840–1860"]);
  // the counts are the citation lines the Strom app gets (J8): persons always 0
  assert.deepEqual(i.counts, { persons: 0, ...gedCounts(gedBefore, s1) });
  assert.deepEqual(i.counts, { persons: 0, names: 1, events: 2, families: 2, stories: 1 });
  const cite = (fact: string) => i.cites.find((c: { fact: string }) => c.fact === fact);
  assert.deepEqual(cite("BIRT"), { owner: "P0001", fact: "BIRT", event: ids.birth, others: 1, locator: "fol. 3", main: true });
  assert.deepEqual(cite("DEAT"), { owner: "P0001", fact: "DEAT", event: ids.death, others: 0, locator: "fol. 9" });
  assert.deepEqual(cite("NAME"), { owner: "P0001", fact: "NAME", others: 0, locator: "fol. 3" });
  assert.deepEqual(cite("FAM"), { owner: "F0001", fact: "FAM", others: 0, locator: "fol. 40" });
  // left with no source: the death, the name, the marriage — never the birth, a family itself not a fact
  const key = (f: { owner: string; fact: string; event?: string }) => `${f.owner} ${f.fact} ${f.event ?? ""}`;
  assert.deepEqual(i.bare.map(key).sort(), [`F0001 MARR ${ids.marr}`, "P0001 DEAT " + ids.death, "P0001 NAME "].sort());
  // less sure: a bare fact among them (the app takes those off itself)
  assert.ok(i.lowered.some((l: { owner: string; fact: string; event?: string }) => i.bare.some((b: { owner: string; fact: string; event?: string }) => key(b) === key(l))), "lowered holds a bare one");
  assert.deepEqual(
    i.lowered.find((l: { event?: string }) => l.event === ids.death),
    { owner: "P0001", fact: "DEAT", event: ids.death, from: "probable", to: "lead" },
  );
  assert.equal(i.lowered.some((l: { event?: string }) => l.event === ids.birth), false, "the birth keeps S0002");
  assert.deepEqual(i.stories, [{ owner: "P0001", inText: true }]);
  assert.deepEqual(i.conflicts, [
    { id: ids.x1, status: "open", becomes: "review" },
    { id: ids.x2, status: "resolved", becomes: "review" },
    { id: ids.x3, status: "open", becomes: "unchanged" },
  ]);
  assert.deepEqual(i.tasks, [
    { id: ids.ta, state: "open", becomes: "dropped" },
    { id: ids.tb, state: "open", becomes: "narrowed" },
  ]);
  assert.deepEqual([i.files, i.images, i.more.cites], [[], 0, 0]);
  assert.deepEqual(retractImpacts(open(w), [s1]), dry.impacts, "the core's the same");
  assert.match((await w.ok(["source", "retract", s1, "--dry-run"])).out, /Odvolal by se pramen Matrika Lhota – křty 1840–1860 \[S0001\]: 5 citací, 1 vyprávění/u);

  // nobody to say yes (no terminal, no window): exit 4; an agent refused; said no in the window: nothing
  for (const env of [{}, agent] as Record<string, string>[]) assert.equal((await w.run(["source", "retract", s1, "--json"], { env })).code, 4, JSON.stringify(env));
  assert.notEqual((await w.run(["source", "retract", s1], { dialog: false })).code, 0);
  // a confirmation of the app given by hand, or outside the bridge: none
  const signed = retractConfirm(open(w).key!, [s1], dry.impacts);
  assert.equal((await w.run(["source", "retract", s1, "--confirm", `${Date.now()}.${"0".repeat(32)}.${"0".repeat(64)}`, "--json"], { env: { STROM_FOR_APP: "1" } })).json.code, "source.body");
  assert.equal((await w.run(["source", "retract", s1, "--confirm", signed, "--json"])).json.code, "source.body");
  assert.equal((await w.run(["source", "retract", s1, "--confirm", signed, "--json"], { env: { STROM_FOR_APP: "1", ...agent } })).code, 4);
  assert.equal(gitHead(w), head);

  // the person's yes in the window, a reason in NFD
  const reason = "založeno omylem, duplicitní záznam".normalize("NFD");
  const done = (await w.ok(["source", "retract", s1, "--reason", reason, "--json"], { dialog: true })).json;
  assert.deepEqual([done.sources, done.retracted], [[s1], [s1]]);
  assert.deepEqual(done.impacts, dry.impacts, "what was said is what was done");
  const after = open(w);
  assert.deepEqual(values(after), valuesBefore, "the values of people and families stay");
  const src = after.get<Source>(s1)!;
  assert.equal(src.retracted?.reason, "deleted");
  assert.deepEqual([src.deleted?.by, src.deleted?.via, src.deleted?.reason, src.deleted?.cites.length], ["user", "terminal", "založeno omylem, duplicitní záznam".normalize("NFC"), 5]);
  const p = after.get<Person>("P0001")!;
  const birth = p.events.find((e) => e.id === ids.birth)!;
  assert.deepEqual(birth.citations, [{ source: s2, locator: "fol. 2" }], "the main citation gone, none other chosen");
  assert.equal(p.events.find((e) => e.id === ids.death)!.status, "lead");
  assert.equal(p.names[0]!.citations, undefined);
  assert.equal(after.get<Family>("F0001")!.citations, undefined);
  assert.deepEqual(p.story, before.get<Person>("P0001")!.story, "the story whole, its text too");
  // tasks: the one on it alone given up (why, in the research language), the other without it, the one done as it was
  const ta = after.get<Task>(ids.ta)!;
  assert.deepEqual([ta.state, ta.result], ["dropped", `pramen odvolán (${s1})`]);
  assert.deepEqual([after.get<Task>(ids.tb)!.state, after.get<Task>(ids.tb)!.where], ["open", [s2]]);
  assert.equal(after.get<Task>(ids.tc)!.state, "done");
  // conflicts: marked, their states kept
  assert.deepEqual([after.get<Conflict>(ids.x1)!.state, after.get<Conflict>(ids.x1)!.review?.sources], ["open", [s1]]);
  assert.deepEqual([after.get<Conflict>(ids.x2)!.state, after.get<Conflict>(ids.x2)!.review?.why], ["resolved", "source.retracted"]);
  assert.equal(after.get<Conflict>(ids.x3)!.review, undefined);
  // one operation of the history, one commit
  assert.equal(after.readOps().filter((o) => o.op === "source.retract").length, 1);
  assert.equal(execFileSync("git", ["-C", w.cwd, "rev-list", "--count", `${head}..HEAD`], { encoding: "utf8" }).trim(), "1");

  // the family tree the app gets: no source, no citation of it; the story's text names it still, its 2 SOUR not;
  // the conflicts marked, the deleted source under the value and under the decision
  const ged = exportGedcom(after, { for: "strom", research: true }).text;
  assert.doesNotMatch(ged, new RegExp(`@${s1}@`, "u"));
  assert.match(ged, new RegExp(`v Lhotě \\[${s1}\\]`, "u"));
  assert.deepEqual(gedCounts(ged, s1), { names: 0, events: 0, families: 0, stories: 0 });
  assert.match(conflictBlock(ged, ids.x1), new RegExp(`^2 STAT open\\r?\\n2 _STROM_REVIEW source.retracted\\r?\\n2 VAL .*\\r?\\n3 _STROM_RETRACTED ${s1}\\r?\\n2 VAL .*\\r?\\n3 SOUR @${s2}@`, "mu"));
  assert.match(conflictBlock(ged, ids.x2), new RegExp(`^2 _STROM_REVIEW source.retracted$[\\s\\S]*^2 DECI .*\\r?\\n3 _STROM_RETRACTED ${s1}`, "mu"));
  assert.doesNotMatch(conflictBlock(ged, ids.x3), /_STROM_REVIEW|_STROM_RETRACTED/u);
  assert.deepEqual(validateGedcom(ged).filter((f) => f.level === "error"), []);
  assert.deepEqual(validateGedcom(ged).filter((f) => /_STROM_REVIEW|_STROM_RETRACTED/u.test(f.message)), []);
  // sent back unedited: the marks are no edit
  const sent = exportGedcom(after, { for: "strom", research: true, head: gitHead(w) }).text.replace("1 SOUR STROM_RESEARCH", "1 SOUR STROM");
  assert.deepEqual(planSync(open(w), readGedcom(sent), "conflict", { readsMain: true, sendsUncite: true }).changes, []);

  // cited by nobody now, a person neither; deleted again: refused
  for (const env of [agent, {}] as Record<string, string>[]) assert.equal((await w.run(["cite", ids.death, s1, "--json"], { env })).json.code, "source.retracted");
  assert.equal((await w.run(["source", "retract", s1, "--dry-run", "--json"])).json.code, "source.retracted");

  // the terminal says it (108 / 117 U3 finding 1): show tells when and how many citations it keeps, and what puts it back;
  // the list leaves it out, --retracted lists it alone
  const shown = (await w.ok(["source", "show", s1])).out;
  assert.match(shown, new RegExp(`^RETRACTED deleted by the person \\d{4}-\\d{2}-\\d{2} in the terminal · 5 citations kept in it — the person puts it back: strom source restore ${s1}$`, "mu"));
  assert.match(shown, new RegExp(`^cited by nothing now — the 5 citations kept in it come back with strom source restore ${s1}$`, "mu"));
  assert.doesNotMatch(shown, /cited by nothing yet/u);
  const shownJson = (await w.ok(["source", "show", s1, "--json"])).json;
  assert.deepEqual({ ...shownJson.retracted, at: undefined }, { at: undefined, reason: "deleted", deleted: true, via: "terminal", cites: 5, restore: `strom source restore ${s1}` });
  assert.ok(!(await w.ok(["source", "list", "--json"])).json.sources.some((r: { id: string }) => r.id === s1), "the list without it");
  const gone = (await w.ok(["source", "list", "--retracted"])).out;
  assert.match(gone, new RegExp(`^${s1}\\s.*Matrika Lhota – křty 1840–1860\\s+deleted by the person \\d{4}-\\d{2}-\\d{2} in the terminal · 5 citations kept in it$`, "mu"));
  assert.match(gone, /^put back a deleted one \(the person's alone\): strom source restore <S…>$/mu);
  assert.doesNotMatch(gone, new RegExp(`^${s2}\\s`, "mu"), "a standing source not among the retracted");
  const goneJson = (await w.ok(["source", "list", "--retracted", "--json"])).json;
  assert.deepEqual(goneJson.sources.map((r: { id: string; retracted: { cites?: number } }) => [r.id, r.retracted.cites]), [[s1, 5]]);
  assert.equal((await w.ok(["source", "list", "--retracted", "křty".normalize("NFD")])).out.includes(s1), true, "its filter as the list's, NFD too");
  // nothing standing matches but a retracted one does: the list says where it is (108 finding)
  const only = (await w.ok(["source", "list", "--kind", "baptism"])).out;
  assert.match(only, /^no sources match\n1 retracted source: strom source list --retracted$/mu);
  assert.equal((await w.ok(["source", "list", "--kind", "nic"])).out.trim(), "no sources match", "none retracted among them: nothing more");
  // the day of the deletion on this computer's calendar, never UTC's: UTC+14 and UTC−11 never share a day
  const tz = process.env.TZ;
  const days: string[] = [];
  try {
    for (const zone of ["Pacific/Kiritimati", "Pacific/Pago_Pago"]) {
      process.env.TZ = zone;
      const at = new Date(shownJson.retracted.at);
      const day = `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, "0")}-${String(at.getDate()).padStart(2, "0")}`;
      assert.match((await w.ok(["source", "show", s1])).out, new RegExp(`^RETRACTED deleted by the person ${day} in the terminal`, "mu"), zone);
      days.push(day);
    }
  } finally {
    if (tz === undefined) delete process.env.TZ;
    else process.env.TZ = tz;
  }
  assert.notEqual(days[0], days[1]);

  // a decision kept without it: the person's; an open conflict or one with no mark refused
  assert.equal((await w.run(["conflict", "keep", ids.x2, "--json"], { env: agent })).code, 4);
  assert.equal((await w.run(["conflict", "keep", ids.x1, "--json"])).json.code, "conflict.notMarked");
  assert.equal((await w.run(["conflict", "keep", ids.x3, "--json"])).json.code, "conflict.notMarked");
  assert.equal((await w.run(["conflict", "keep", "X0099", "--json"])).json.code, "conflict.unknown");
  await w.ok(["conflict", "keep", ids.x2]);
  assert.equal(open(w).get<Conflict>(ids.x2)!.review, undefined);
  assert.doesNotMatch(conflictBlock(exportGedcom(open(w), { for: "strom", research: true }).text, ids.x2), /_STROM_REVIEW/u);

  // put back: the person's; as it was
  assert.equal((await w.run(["source", "restore", s1, "--json"], { env: agent })).code, 4);
  const back = (await w.ok(["source", "restore", s1, "--json"])).json;
  assert.deepEqual([back.restored, back.citations, back.skipped, back.tasks.sort()], [[s1], 5, [], [ids.ta, ids.tb].sort()]);
  const restored = open(w);
  assert.deepEqual(whole(restored), wholeBefore, "people, families, tasks, conflicts as before the deletion");
  assert.deepEqual([restored.get<Source>(s1)!.retracted, restored.get<Source>(s1)!.deleted], [undefined, undefined]);
  assert.equal(exportGedcom(restored, { for: "strom", research: true }).text.replace(/^1 _STROM_(?:ASOF|HEAD) .*$/gmu, ""), gedBefore.replace(/^1 _STROM_(?:ASOF|HEAD) .*$/gmu, ""));
  assert.equal(restored.readOps().filter((o) => o.op === "source.restore").length, 1);
  assert.equal((await w.run(["source", "restore", s1, "--json"])).json.code, "source.notRetracted");
  w.cleanup();
});

test("restoring a source: skipped gone, already, main; a status back where the citations carry it; a task never given a place of a source still deleted; merged or retracted otherwise not restorable", opts, async () => {
  const w = new World();
  await w.withTree("Lhotákovi");
  const tree = open(w);
  const s: string[] = [];
  tree.withTreeLock(() => {
    for (const title of ["Křty Lhota", "Oddaní Lhota", "Úmrtí Lhota", "Kopie křtů", "Sčítání 1869"]) s.push(create<Source>(tree, "source", { kind: "baptism", title, information: "primary", form: "original", notes: [] } as never, (x) => `+${x}`).id);
    tree.commit("sources");
  });
  const [s1, s2, s3, s4, s5] = s as [string, string, string, string, string];
  await w.ok(["person", "add", "Václav /Talvanen/", "--sex", "M"]); // P0001
  await w.ok(["event", "add", "P0001", "BIRT", "--date", "1860", "--cite", s1]);
  await w.ok(["event", "add", "P0001", "DEAT", "--date", "1920", "--cite", s1]);
  await w.ok(["event", "add", "P0001", "OCCU", "--value", "kovář", "--cite", s1]);
  const t = open(w);
  const ev = (kind: string) => open(w).get<Person>("P0001")!.events.find((e) => e.kind === kind && !e.retracted)!;
  const [birth, death, occu] = [ev("BIRT").id, ev("DEAT").id, ev("OCCU").id];
  let task = "";
  t.withTreeLock(() => {
    task = create<Task>(t, "task", { level: "locate", priority: 3, what: "Porovnat křty a oddané", where: [s1, s2], why: "zkouška", doneWhen: "porovnáno", subject: ["P0001"], state: "open", origin: "agent", notes: [] } as never, (x) => `+${x}`).id;
    // the birth's citation of s1 its main one
    update<Person>(t, "P0001", "person", (x) => ({ ...x, events: x.events.map((e) => (e.id === birth ? { ...e, citations: e.citations.map((c) => ({ ...c, main: { by: "user" as const, at } })) } : e)) }), { op: "person.edit", summary: "main citation" });
    // s4 merged into s3, s5 taken back by a sync: retracted otherwise than deleted
    update<Source>(t, s4, "source", (x) => ({ ...x, retracted: { at, reason: `merged into ${s3}` }, mergedInto: s3 }), { op: "source.merge", summary: `${s4} merged` });
    update<Source>(t, s5, "source", (x) => ({ ...x, retracted: { at, reason: "sync" } }), { op: "source.retract", summary: `${s5} retracted` });
    t.commit("a task, two sources retracted otherwise");
  });
  assert.equal(ev("BIRT").status, "probable");

  // both deleted at once: the task loses both places, given up
  await w.ok(["source", "retract", s1, s2], { dialog: true });
  assert.equal(open(w).get<Task>(task)!.state, "dropped");
  assert.equal(ev("BIRT").status, "lead");
  // meanwhile: the death taken back; the birth cited by another source as its main citation; the occupation citing s1 again
  await w.ok(["event", "retract", death, "--reason", "omyl"]);
  await w.ok(["cite", birth, s3]);
  const u = open(w);
  u.withTreeLock(() => {
    update<Person>(u, "P0001", "person", (x) => ({
      ...x,
      events: x.events.map((e) => (e.id === birth ? { ...e, citations: e.citations.map((c) => ({ ...c, main: { by: "user" as const, at } })) } : e.id === occu ? { ...e, citations: [{ source: s1 }] } : e)),
    }), { op: "person.edit", summary: "main citation; s1 again" });
    u.commit("meanwhile");
  });

  // s1 alone back: the birth gets it (not as main), the death is gone, the occupation has it already
  const back = (await w.ok(["source", "restore", s1, "--json"])).json;
  assert.deepEqual([back.restored, back.citations], [[s1], 1]);
  assert.deepEqual(
    back.skipped.map((x: { fact: string; why: string }) => `${x.fact} ${x.why}`).sort(),
    ["BIRT main", "DEAT gone", "OCCU already"],
  );
  const b = ev("BIRT");
  assert.deepEqual(b.citations.map((c) => [c.source, !!c.main]).sort(), [[s1, false], [s3, true]]);
  assert.equal(b.status, "probable", "the status the deletion lowered, back: nobody changed it and the citations carry it");
  // the task back with its place of s1 alone: s2 is deleted still
  const tk = open(w).get<Task>(task)!;
  assert.deepEqual([tk.state, tk.where], ["open", [s1]]);
  assert.equal(open(w).get<Source>(s2)!.retracted?.reason, "deleted");

  // a source merged, one taken back otherwise, one not retracted, one the research lacks
  for (const [id, code, why] of [[s4, "source.notRestorable", "merged"], [s5, "source.notRestorable", "other"], [s3, "source.notRetracted", undefined], ["S0099", "source.unknown", undefined]] as const) {
    const r = (await w.run(["source", "restore", id, "--json"])).json;
    assert.equal(r.code, code, id);
    if (why) assert.equal(r.params.why, why);
  }
  // the retracted listed each as it is: the deleted one to put back, the merged one where it went, the other with its reason
  const gone = (await w.ok(["source", "list", "--retracted", "--json"])).json.sources as { id: string; retracted: { reason: string; deleted?: true; mergedInto?: string; restore?: string } }[];
  assert.deepEqual(gone.map((r) => r.id).sort(), [s2, s4, s5].sort());
  const of = (id: string) => gone.find((r) => r.id === id)!.retracted;
  assert.deepEqual([of(s2).deleted, of(s2).restore], [true, `strom source restore ${s2}`]);
  assert.deepEqual([of(s4).deleted, of(s4).restore, typeof of(s4).mergedInto], [undefined, undefined, "string"]);
  assert.deepEqual([of(s5).deleted, of(s5).restore], [undefined, undefined]);
  assert.equal((await w.run(["source", "show", s4, "--json"])).json.code, "record.merged", "a merged one: show leads to the one it went into");
  assert.match((await w.ok(["source", "list", "--retracted"])).out, new RegExp(`^${s4}\\s.*\\smerged into ${of(s4).mergedInto} \\d{4}-\\d{2}-\\d{2}$`, "mu"));
  assert.match((await w.ok(["source", "show", s5])).out, /^RETRACTED retracted \d{4}-\d{2}-\d{2}: .+$[\s\S]*^cited by nothing$/mu);
  w.cleanup();
});

function request(method: string, url: string, body?: Buffer, headers: Record<string, string> = {}): Promise<{ status: number; body: Buffer; headers: http.IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method, headers: { ...(body ? { "Content-Length": String(body.length) } : {}), ...headers } }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (d: Buffer) => chunks.push(d));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks), headers: res.headers }));
    });
    req.on("error", reject);
    req.end(body);
  });
}
const json = (r: { body: Buffer }) => JSON.parse(r.body.toString("utf8"));
const post = (url: string, body: unknown, headers: Record<string, string> = app) => request("POST", url, Buffer.from(typeof body === "string" ? body : JSON.stringify(body)), { ...headers, "Content-Type": "application/json" });

test("deleting a source from the Strom app: a dry run and its signed confirmation, a change between refused with the impacts now, restore, conflict keep, the codes", { skip: !hasGit || process.platform === "win32" }, async () => {
  const { w, ids } = await research();
  const { s1, s2 } = ids;
  w.env.STROM_LIVE_POLL_MS = "100";
  const info = (await w.ok(["live", "start", "--json"])).json;
  try {
    const url = `${info.url}/source/retract`;
    // only the app's pages; bodies it cannot read; a source the research lacks
    assert.equal((await post(url, { sources: [s1], dryRun: true }, {})).status, 403);
    for (const bad of [{ dryRun: true }, { sources: [], dryRun: true }, { sources: [s1], dryRun: "yes" }, { sources: Array(51).fill(s1), dryRun: true }, { sources: [s1] }, "[1]"]) {
      const r = await post(url, bad);
      assert.deepEqual([r.status, json(r).code], [400, "source.body"], JSON.stringify(bad).slice(0, 60));
    }
    const none = await post(url, { sources: [s1, "S0099"], dryRun: true });
    assert.deepEqual([none.status, json(none).code, json(none).params], [404, "source.unknown", { id: "S0099" }]);

    // the dry run: the impacts and the bridge's confirmation, nothing written
    const head = gitHead(w);
    const dry = await post(url, { sources: [s1], dryRun: true });
    assert.equal(dry.status, 200, dry.body.toString());
    const d = json(dry);
    assert.deepEqual([d.sources, d.dryRun, d.impacts], [[s1], true, retractImpacts(open(w), [s1])]);
    assert.match(d.confirm, /^\d+\.[0-9a-f]{32}\.[0-9a-f]{64}$/u);
    assert.equal(gitHead(w), head);
    // a made-up confirmation, one older than 15 minutes
    const old = retractConfirm(open(w).key!, [s1], d.impacts, Date.now() - 16 * 60_000);
    for (const confirm of ["abc", old]) assert.deepEqual([(await post(url, { sources: [s1], confirm })).status], [400], confirm);

    // the research changed since the person saw it (another fact cites the source): 409 with the impacts now
    await w.ok(["event", "add", "P0002", "BIRT", "--date", "1855", "--cite", s1]);
    const changed = await post(url, { sources: [s1], confirm: d.confirm });
    assert.deepEqual([changed.status, json(changed).code], [409, "source.retract-changed"]);
    assert.equal(json(changed).impacts[0].counts.events, 3);
    assert.equal(open(w).get<Source>(s1)!.retracted, undefined);

    // seen again and confirmed: deleted, said in the history for the app
    const again = json(await post(url, { sources: [s1], dryRun: true }));
    const del = await post(url, { sources: [s1], confirm: again.confirm });
    assert.equal(del.status, 200, del.body.toString());
    const got = json(del);
    assert.deepEqual([got.sources, got.retracted, got.impacts], [[s1], [s1], again.impacts]);
    assert.match(got.head, /^[0-9a-f]{7,}$/u);
    assert.equal(open(w).get<Source>(s1)!.deleted?.via, "bridge");
    const ged = (await request("GET", `${info.url}/tree.ged?app=99.0.0`)).body.toString("utf8");
    assert.doesNotMatch(ged, new RegExp(`@${s1}@`, "u"));
    assert.match(conflictBlock(ged, ids.x1), /^2 _STROM_REVIEW source\.retracted$/mu);
    // deleted already
    const twice = await post(url, { sources: [s1], dryRun: true });
    assert.deepEqual([twice.status, json(twice).code], [409, "source.retracted"]);

    // a decision kept without it: decided and marked only
    const keep = `${info.url}/conflict/keep`;
    for (const [body, status, code] of [[{ conflict: ids.x1 }, 409, "conflict.notMarked"], [{ conflict: "X0099" }, 404, "conflict.unknown"], [{}, 400, "source.body"]] as const) {
      const r = await post(keep, body);
      assert.deepEqual([r.status, json(r).code], [status, code], JSON.stringify(body));
    }
    const kept = await post(keep, { conflict: ids.x2 });
    assert.equal(kept.status, 200, kept.body.toString());
    assert.deepEqual([json(kept).conflict, typeof json(kept).head], [ids.x2, "string"]);
    assert.equal(open(w).get<Conflict>(ids.x2)!.review, undefined);
    // deciding a conflict stays the terminal's
    assert.equal((await post(`${info.url}/conflict/${ids.x1}`, { take: "research" })).status, 403);

    // put back
    const restore = `${info.url}/source/restore`;
    for (const [body, status, code] of [[{ sources: [s2] }, 409, "source.notRetracted"], [{ sources: ["S0099"] }, 404, "source.unknown"], [{ sources: [] }, 400, "source.body"]] as const) {
      const r = await post(restore, body);
      assert.deepEqual([r.status, json(r).code], [status, code], JSON.stringify(body));
    }
    const put = await post(restore, { sources: [s1] });
    assert.equal(put.status, 200, put.body.toString());
    const r = json(put);
    assert.deepEqual([r.restored, r.citations, r.skipped, typeof r.head], [[s1], 6, [], "string"]);
    assert.equal(open(w).get<Source>(s1)!.retracted, undefined);
    assert.equal(open(w).get<Conflict>(ids.x1)!.review, undefined);
  } finally {
    await w.ok(["live", "stop"]);
  }
  w.cleanup();
});
