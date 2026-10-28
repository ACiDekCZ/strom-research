// A participant of an event (strom event add|edit --with): the name alone, what the record says of them in closing
// parentheses as the note — in the GEDCOM as before (_WITN, RELA, NOTE); a long name or a priest named as a witness
// refused with what to write; a participant who may be one of the family around the entry suggested, never linked.
// Names written so before: strom check warns, strom fixes show|run|undo participant-names sets them apart by rules
// (one operation, one commit, free, in an archive too) and puts them back — the person's decision alone.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { World, hasGit } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import type { Event, Family, Person } from "../../src/core/model.ts";
import { owners } from "../../src/core/participants.ts";

const opts = { skip: !hasGit };

async function person(w: World, name: string, sex: string): Promise<string> {
  return (await w.ok(["person", "add", name, "--sex", sex, "--json"])).json.person.id;
}

async function family(w: World, partners: string[], children: string[] = []): Promise<string> {
  return (await w.ok(["family", "add", ...partners.flatMap((p) => ["--partner", p]), ...children.flatMap((c) => ["--child", c]), "--json"])).json.family.id;
}

const commits = (w: World) => Number(execFileSync("git", ["-C", w.cwd, "rev-list", "--count", "HEAD"], { encoding: "utf8" }).trim());

/** The record an event is kept on, and the event. */
function eventOf(tree: Tree, id: string): { owner: Person | Family; event: Event } {
  const owner = owners(tree).find((o) => o.events.some((e) => e.id === id))!;
  return { owner, event: owner.events.find((e) => e.id === id)! };
}

/** An event's participants changed as an older strom or a later edit left them. */
function setParticipants(tree: Tree, id: string, participants: Event["participants"], summary: string): void {
  const { owner } = eventOf(tree, id);
  const rec = structuredClone(owner);
  rec.events.find((e) => e.id === id)!.participants = participants;
  tree.put(rec, { op: "event.update", targets: [id], summary });
}

/** The participants of an event as they are kept. */
const participantsOf = (w: World, id: string) => eventOf(Tree.open(w.cwd, w.env), id).event.participants ?? [];

test("--with: the closing parentheses are the note (a parenthesis inside the name stays, P… with a note, NFD, Cyrillic); the GEDCOM as before", opts, async () => {
  const w = new World();
  await w.withTree("Lhotákovi");
  try {
    const child = await person(w, "Petr /Lhoták/", "M");
    const r = await w.ok([
      "event", "add", child, "CHR", "--date", "3 MAR 1850",
      "--with", "godparent:Jan Lhoták (sedlák, Lhota č. 12)",
      "--with", "witness:Jan (Johann) Lhotec",
      "--with", "midwife:Marie Lhotáková (bába z Lhoty)".normalize("NFD"),
      "--with", "other:Иван Лхотак (купец)",
      "--json",
    ]);
    const id = r.json.event.id;
    const uncle = await person(w, "Josef /Lhoták/", "M");
    await w.ok(["event", "edit", id, "--with", `witness:${uncle} (strýc)`]);
    assert.deepEqual(participantsOf(w, id), [
      { role: "godparent", name: "Jan Lhoták", note: "sedlák, Lhota č. 12" },
      { role: "witness", name: "Jan (Johann) Lhotec" },
      { role: "midwife", name: "Marie Lhotáková", note: "bába z Lhoty" },
      { role: "other", name: "Иван Лхотак", note: "купец" },
      { role: "witness", person: uncle, note: "strýc" },
    ]);
    // shown with its note
    assert.match((await w.ok(["person", "show", child])).out, /Jan Lhoták \(sedlák, Lhota č\. 12\)/);
    // taken off as written, with its note
    await w.ok(["event", "edit", id, "--without", "midwife:Marie Lhotáková (bába z Lhoty)", "--reason", "read again: no midwife"]);
    assert.equal(participantsOf(w, id).some((p) => p.role === "midwife"), false);
    await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", path.join(w.dir, "t.ged")]);
    const ged = fs.readFileSync(path.join(w.dir, "t.ged"), "utf8");
    assert.match(ged, /2 _WITN Jan Lhoták\n3 RELA Godparent\n3 NOTE sedlák, Lhota č\. 12\n/);
    assert.match(ged, /2 _WITN Jan \(Johann\) Lhotec\n3 RELA Witness\n/);
    assert.match(ged, /2 _WITN Иван Лхотак\n3 RELA [^\n]+\n3 NOTE купец\n/);
    assert.match(ged, new RegExp(`2 ASSO @${uncle}@\\n3 RELA Witness\\n3 NOTE strýc\\n`));
  } finally {
    w.cleanup();
  }
});

test("--with: a long name, a number refused with what to put in the parentheses; a title not counted; a priest as a witness told to be the officiant", opts, async () => {
  const w = new World();
  await w.withTree("Lhotákovi");
  try {
    const child = await person(w, "Petr /Lhoták/", "M");
    const long = await w.run(["event", "add", child, "CHR", "--date", "1850", "--with", "godparent:Jan Lhoták sedlák z Lhoty č. 12", "--json"]);
    assert.notEqual(long.code, 0);
    assert.equal(long.json.code, "participant.long-name");
    assert.match(long.json.hint, /--with "godparent:Jan Lhoták \(sedlák z Lhoty č\. 12\)"/);
    const five = await w.run(["event", "add", child, "CHR", "--date", "1850", "--with", "witness:Jan Josef Karel Václav Lhoták"]);
    assert.notEqual(five.code, 0);
    assert.match(five.err + five.out, /at most 4 words/);
    await w.ok(["event", "add", child, "CHR", "--date", "1850", "--with", "godparent:MUDr. Jan Josef Karel Lhoták"]);
    for (const spec of ["witness:farář Josef Lhoták", "other:Pater Johann Lhotak", "witness:parochus Joannes Lhotak", "witness:kněz Josef Lhoták".normalize("NFD")]) {
      const r = await w.run(["event", "add", child, "CHR", "--date", "1850", "--with", spec, "--json"]);
      assert.notEqual(r.code, 0, spec);
      assert.equal(r.json.code, "participant.officiant", spec);
      assert.match(r.json.hint, /--with "officiant:/);
    }
    await w.ok(["event", "add", child, "CHR", "--date", "1850", "--with", "officiant:P. Josef Lhoták"]);
  } finally {
    w.cleanup();
  }
});

test("--with by name: one of the family around the entry suggested by number (the uncle), none of two; never linked", opts, async () => {
  const w = new World();
  await w.withTree("Lhotákovi");
  try {
    const child = await person(w, "Petr /Lhoták/", "M");
    const father = await person(w, "Josef /Lhoták/", "M");
    const mother = await person(w, "Anna /Lhotáková/", "F");
    await family(w, [father, mother], [child]);
    const uncle = await person(w, "Jan /Lhoták/", "M");
    const grandfather = await person(w, "Václav /Lhoták/", "M");
    await family(w, [grandfather], [father, uncle]);
    const r = await w.ok(["event", "add", child, "CHR", "--date", "3 MAR 1850", "--with", "godparent:Jan Lhoták (sedlák)", "--lang", "en"]);
    assert.match(r.out, new RegExp(`is this ${uncle}\\? \`godparent:${uncle}\``));
    const j = await w.ok(["event", "add", child, "BIRT", "--date", "2 MAR 1850", "--with", "godparent:Jan Lhoták", "--json"]);
    assert.deepEqual(j.json.suggest.map((s: { role: string; name: string; person: string; with: string }) => [s.role, s.name, s.person, s.with]), [["godparent", "Jan Lhoták", uncle, `godparent:${uncle}`]]);
    assert.deepEqual(participantsOf(w, j.json.event.id), [{ role: "godparent", name: "Jan Lhoták" }], "never linked by itself");
    // another Jan Lhoták around the entry (the mother's brother): two may be meant — none suggested
    const other = await person(w, "Jan /Lhoták/", "M");
    const maternal = await person(w, "Karel /Lhoták/", "M");
    await family(w, [maternal], [mother, other]);
    const two = await w.ok(["event", "add", child, "DEAT", "--date", "1851", "--with", "witness:Jan Lhoták", "--json"]);
    assert.equal(two.json.suggest, undefined);
    assert.doesNotMatch((await w.ok(["event", "add", child, "BURI", "--date", "1851", "--with", "witness:Jan Lhoták", "--lang", "en"])).out, /is this P/);
  } finally {
    w.cleanup();
  }
});

/** Events with the participants an older strom let through, written as it wrote them. */
async function oldNames(w: World): Promise<{ child: string; events: string[] }> {
  const child = await person(w, "Petr /Lhoták/", "M");
  const events: string[] = [];
  for (let i = 0; i < 4; i++) events.push((await w.ok(["event", "add", child, i ? "EVEN" : "CHR", "--date", `${1850 + i}`, ...(i ? ["--value", `Událost ${i}`] : []), "--json"])).json.event.id);
  const tree = Tree.open(w.cwd, w.env);
  const set = (id: string, participants: Event["participants"]) => setParticipants(tree, id, participants, `${id} written by an older strom`);
  tree.withTreeLock(() => {
    set(events[0]!, [
      { role: "godparent", name: "Jan Lhoták, sedlák z Lhoty č. 12", note: "strýc" },
      { role: "godparent", name: "Marie Lhotáková manželka Josefa Lhotáka" },
      { role: "officiant", name: "P. Josef Lhotec" },
    ]);
    set(events[1]!, [{ role: "witness", name: "Johann Lhotak Häusler aus Lhota Nr. 7" }, { role: "witness", name: "Jan Lhoták Lhota 12" }]);
    set(events[2]!, [{ role: "witness", name: "Václav Lhoták z Lhotinky 3" }, { role: "witness", name: "Иван Лхотак, купец" }]);
    set(events[3]!, [{ role: "witness", name: "Karel Lhoták, chalupník v Lhotě".normalize("NFD") }, { role: "midwife", name: "Anna Lhotáková" }]);
    tree.commit("Participants as an older strom wrote them");
  });
  return { child, events };
}

test("strom check warns of names holding more; strom fixes show participant-names: counts and five examples", opts, async () => {
  const w = new World();
  await w.withTree("Lhotákovi");
  try {
    const before = (await w.run(["check", "--json"])).json.findings.filter((f: { code: string }) => f.code === "participant-long-name");
    assert.deepEqual(before, []);
    const { events } = await oldNames(w);
    const found = (await w.run(["check", "--json"])).json.findings.filter((f: { code: string }) => f.code === "participant-long-name");
    assert.equal(found.length, 1);
    assert.equal(found[0].level, "warn");
    assert.equal(found[0].hint, "strom fixes show participant-names");
    assert.ok(found[0].count >= 4);
    const show = await w.ok(["fixes", "show", "participant-names", "--lang", "en"]);
    assert.match(show.out, /Found: 7 participants whose name holds more than a name — 6 to be set apart by rules, 1 to stay as they are/);
    assert.equal(show.out.split("\n").filter((l) => /^  E\d+ · .+ → /u.test(l)).length, 5, "five examples");
    assert.match(show.out, new RegExp(`${events[0]} · godparent · Jan Lhoták, sedlák z Lhoty č\\. 12 \\(strýc\\) → Jan Lhoták · note: strýc; sedlák z Lhoty č\\. 12`));
    assert.match(show.out, /… 1 more: strom fixes show participant-names --json/);
    const j = await w.ok(["fixes", "show", "participant-names", "--json"]);
    assert.deepEqual(j.json.found, { count: 7, split: 6, unsplit: 1 });
    assert.equal(j.json.paid, false);
    assert.equal(j.json.remedy, "rewrite");
    assert.equal(j.json.items.length, 6);
    // the list and the doctor
    const list = await w.ok(["fixes", "--json"]);
    assert.equal(list.json.checks.find((c: { id: string }) => c.id === "participant-names").state, "pending");
    const doctor = (await w.run(["doctor", "--json"])).json.checks.find((x: { name: string }) => x.name === "fixes");
    assert.equal(doctor.status, "warn");
  } finally {
    w.cleanup();
  }
});

test("strom fixes run participant-names: the person's — one operation and one commit, notes kept and added to, the unclear left; undo puts back exactly, never over a change since", opts, async () => {
  const w = new World();
  await w.withTree("Lhotákovi");
  try {
    const { events } = await oldNames(w);
    const kept = events.map((e) => JSON.stringify(participantsOf(w, e)));
    // an agent, a run nobody watches, --yes: never
    for (const env of [{ CLAUDECODE: "1" }, { STROM_NONINTERACTIVE: "1" }] as Record<string, string>[]) {
      assert.equal((await w.run(["fixes", "run", "participant-names"], { env })).code, 4, JSON.stringify(env));
    }
    // nothing done: nothing to put back, said to anyone
    assert.match((await w.ok(["fixes", "undo", "participant-names", "--lang", "en"], { env: { STROM_NONINTERACTIVE: "1" } })).out, /Nothing to put back/);
    assert.notEqual((await w.run(["fixes", "run", "participant-names", "--yes"], { tty: true, answers: ["1"] })).code, 0);
    // later: nothing changed
    const n0 = commits(w);
    await w.ok(["fixes", "run", "participant-names", "--lang", "en"], { tty: true, answers: [""] });
    assert.equal(commits(w), n0);
    // all of them
    const r = await w.ok(["fixes", "run", "participant-names", "--lang", "en"], { tty: true, answers: ["1"] });
    assert.match(r.out, /Set apart: 6 names in 1 record\./);
    assert.equal(commits(w), n0 + 1, "one commit");
    const tree = Tree.open(w.cwd, w.env);
    const ops = tree.readOps().filter((o) => o.op === "participant.fix");
    assert.equal(ops.length, 1, "one operation");
    assert.ok(ops[0]!.files.some((f) => f.path.endsWith("participant-names.json")), "the originals kept with the operation");
    assert.ok(ops[0]!.files.some((f) => f.path === "strom.json"), "the decision in the same operation");
    assert.equal(JSON.parse(fs.readFileSync(path.join(w.cwd, "strom.json"), "utf8")).fixes["participant-names"].decision, "fixed");
    assert.deepEqual(participantsOf(w, events[0]!), [
      { role: "godparent", name: "Jan Lhoták", note: "strýc; sedlák z Lhoty č. 12" },
      { role: "godparent", name: "Marie Lhotáková", note: "manželka Josefa Lhotáka" },
      { role: "officiant", name: "P. Josef Lhotec" },
    ]);
    assert.deepEqual(participantsOf(w, events[1]!), [
      { role: "witness", name: "Johann Lhotak", note: "Häusler aus Lhota Nr. 7" },
      { role: "witness", name: "Jan Lhoták Lhota 12" },
    ], "a name that cannot be told for sure is left");
    assert.deepEqual(participantsOf(w, events[3]!)[0], { role: "witness", name: "Karel Lhoták", note: "chalupník v Lhotě" });
    assert.equal((await w.ok(["fixes", "--json"])).json.checks.find((c: { id: string }) => c.id === "participant-names").state, "fixed");
    // a later change of one of them: kept by the undo
    tree.withTreeLock(() => {
      const e = eventOf(tree, events[2]!).event;
      setParticipants(tree, e.id, [{ ...e.participants![0]!, note: "z Lhotinky čp. 3" }, e.participants![1]!], "read again");
      tree.commit("Read again");
    });
    for (const env of [{ CLAUDECODE: "1" }, { STROM_NONINTERACTIVE: "1" }] as Record<string, string>[])
      assert.equal((await w.run(["fixes", "undo", "participant-names"], { env })).code, 4, JSON.stringify(env));
    assert.notEqual((await w.run(["fixes", "undo", "participant-names", "--yes"], { tty: true })).code, 0);
    const n1 = commits(w);
    const u = await w.ok(["fixes", "undo", "participant-names", "--lang", "en"], { tty: true });
    assert.match(u.out, /Put back as they were: 5 names · 1 changed since, left as it is/);
    assert.equal(commits(w), n1 + 1);
    assert.equal(Tree.open(w.cwd, w.env).readOps().filter((o) => o.op === "participant.unfix").length, 1);
    for (const i of [0, 1, 3]) assert.equal(JSON.stringify(participantsOf(w, events[i]!)), kept[i], `${events[i]} exactly as before`);
    const changed = participantsOf(w, events[2]!);
    assert.deepEqual(changed[0], { role: "witness", name: "Václav Lhoták", note: "z Lhotinky čp. 3" }, "the change since kept");
    assert.deepEqual(changed[1], { role: "witness", name: "Иван Лхотак, купец" }, "the other one put back");
    assert.equal(JSON.parse(fs.readFileSync(path.join(w.cwd, "strom.json"), "utf8")).fixes["participant-names"].decision, "declined");
    // nothing more to put back
    assert.match((await w.ok(["fixes", "undo", "participant-names", "--lang", "en"], { tty: true })).out, /Nothing to put back/);
    // a check that reads again has nothing to put back
    assert.notEqual((await w.run(["fixes", "undo", "blind-reduced"], { tty: true })).code, 0);
  } finally {
    w.cleanup();
  }
});

test("strom fixes participant-names in an archive: shown and set right by rules, nothing of an agent", opts, async () => {
  const w = new World();
  await w.withTree("Lhotákovi");
  try {
    const { events } = await oldNames(w);
    await w.ok(["mode", "archive"], { tty: true, answers: ["y"] });
    const list = await w.ok(["fixes", "--json"]);
    assert.deepEqual(list.json.checks.map((c: { id: string }) => c.id), ["participant-names"]);
    const show = await w.ok(["fixes", "show", "participant-names"]);
    assert.doesNotMatch(show.out, /agent|\bAI\b|umělá inteligence|Claude|Codex|OpenCode|Grok|Antigravity|\bmodel/i);
    const r = await w.ok(["fixes", "run", "participant-names"], { tty: true, answers: ["1"] });
    assert.doesNotMatch(r.out, /agent|\bAI\b|umělá inteligence|Claude|Codex|\bmodel/i);
    assert.deepEqual(participantsOf(w, events[1]!)[0], { role: "witness", name: "Johann Lhotak", note: "Häusler aus Lhota Nr. 7" });
    await w.ok(["fixes", "undo", "participant-names"], { tty: true });
    assert.deepEqual(participantsOf(w, events[1]!)[0], { role: "witness", name: "Johann Lhotak Häusler aus Lhota Nr. 7" });
    // the menu's maintenance offers it
    const menu = await w.ok([], { tty: true, answers: ["0"] });
    assert.doesNotMatch(menu.out, /agent|Claude|\bAI\b/i);
  } finally {
    w.cleanup();
  }
});

test("strom fixes participant-names: what an undo needs travels with the research (pack, unpack) and is sealed", opts, async () => {
  const w = new World();
  await w.withTree("Lhotákovi");
  try {
    const { events } = await oldNames(w);
    await w.ok(["fixes", "run", "participant-names"], { tty: true, answers: ["1"] });
    const kept = path.join(w.cwd, "quality", "participant-names.json");
    assert.equal(JSON.parse(fs.readFileSync(kept, "utf8")).runs[0].items.length, 6);
    assert.equal((await w.run(["verify", "--json"])).code, 0);
    const zip = path.join(w.dir, "lhota.zip");
    await w.ok(["pack", "--out", zip]);
    const other = new World();
    try {
      await other.ok(["setup", "--yes"]);
      await other.ok(["unpack", zip], { answers: ["a"] });
      const there = other.treeDir("Lhotákovi");
      assert.equal(JSON.parse(fs.readFileSync(path.join(there, "quality", "participant-names.json"), "utf8")).runs[0].items.length, 6);
      await other.ok(["fixes", "undo", "participant-names"], { tty: true, cwd: there });
      assert.deepEqual(eventOf(Tree.open(there, other.env), events[1]!).event.participants![0], { role: "witness", name: "Johann Lhotak Häusler aus Lhota Nr. 7" });
    } finally {
      other.cleanup();
    }
    // edited by hand: verify says so
    fs.writeFileSync(kept, fs.readFileSync(kept, "utf8").replace("Johann", "Josef"));
    assert.equal((await w.run(["verify", "--json"])).code, 1);
  } finally {
    w.cleanup();
  }
});
