// A brief cut to its budget: the lessons that go with the task and its premise outlast the people's notes and the
// other open questions — whom the task is about stays, by what tells namesakes apart; a task that links hypotheses to
// the tree gets its people by who they are and the families a link would join, never their every fact and note.

import { test } from "node:test";
import assert from "node:assert/strict";
import { World, hasGit } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import { buildBrief } from "../../src/brief/brief.ts";
import { HYPOTHESIS_LINKS_ORIGIN, settleHypothesisLinks } from "../../src/core/hypolinks.ts";
import type { Task } from "../../src/core/model.ts";

const opts = { skip: !hasGit };

/** The lines of one section of a brief. */
function section(brief: string, heading: string): string {
  const at = brief.indexOf(heading);
  assert.ok(at >= 0, `no section ${heading}`);
  const rest = brief.slice(at);
  const end = rest.slice(1).search(/\n#{1,2} /u);
  return end < 0 ? rest : rest.slice(0, end + 1);
}

/**
 * Kryštof Žďárský (P1, the research's focus), his parents Matouš (P2) and Ludmila (P3) in F1, his sister Ludmila (P4,
 * one of two namesakes) and her namesake (P5); Олег Петренко (P6), a family of the tree in another script; a book (B1).
 */
async function world(): Promise<World> {
  const w = new World();
  await w.withTree();
  await w.ok(["research", "new", "Předci Kryštofa", "--new-person", "Kryštof /Žďárský/", "--sex", "M", "--born", "1801"]); // P1
  await w.ok(["person", "add", "Matouš /Žďárský/", "--sex", "M"]); // P2
  await w.ok(["person", "add", "Ludmila /Žďárská/", "--sex", "F"]); // P3
  await w.ok(["family", "add", "--partner", "P2", "--partner", "P3", "--child", "P1"]); // F1
  await w.ok(["person", "add", "Ludmila /Žďárská/", "--sex", "F"]); // P4
  await w.ok(["family", "child", "F1", "P4"]);
  await w.ok(["person", "add", "Ludmila /Žďárská/", "--sex", "F"]); // P5
  await w.ok(["family", "child", "F1", "P5"]);
  await w.ok(["person", "add", "Олег /Петренко/", "--sex", "M"]); // P6
  // what tells them apart: the mother's other form (decomposed), the sisters' days, the father's house
  await w.ok(["name", "add", "P3", "Lidmila /Zďárská/".normalize("NFD")]);
  await w.ok(["event", "add", "P4", "BIRT", "--date", "2 FEB 1803", "--place", "Dolní Ořechov"]);
  await w.ok(["event", "add", "P5", "BIRT", "--date", "9 SEP 1806", "--place", "Dolní Ořechov"]);
  await w.ok(["event", "add", "P2", "RESI", "--place", "Dolní Ořechov", "--house", "7", "--date", "1801"]);
  await w.ok(["recordset", "add", "Dolní Ořechov N 1790-1820", "--places", "Dolní Ořechov", "--years", "1790-1820", "--access", "online-free"]); // B1
  return w;
}

/** Long notes: the bulk of a person's detail. */
async function notes(w: World, id: string, n: number): Promise<void> {
  for (let i = 1; i <= n; i++) await w.ok(["note", "add", id, `Poznámka ${i}: ${"Zápis v knize je čitelný jen zčásti, písař psal příjmení různě a dům se přečíslovával. ".repeat(5)}`]);
}

test("brief cut to fit: the lessons of the task and its searches outlast the people's notes and the other open questions; whom it is about stays", opts, async () => {
  const w = await world();
  await notes(w, "P1", 3);
  await notes(w, "P2", 3);
  await notes(w, "P4", 1);
  for (let i = 0; i < 30; i++) await w.ok(["search", "add", `Křty Žďárských v Dolním Ořechově, ročník ${1790 + i}: žádný zápis — přečteno celé`, "--recordset", "B1", "--method", "page-by-page", "--result", "negative"]);
  // a lesson of the family: a reading of the surname that looks alike — and one of another family of the tree
  await w.ok(["lesson", "add", "Písař píše Žďárský i jako Zďarsky nebo Ždiarský: čti obě čtení jako jeden rod"]);
  await w.ok(["lesson", "add", "Петренки з іншої парафії — інший рід"]);
  // the open questions about the parents: long ones, the task is not about them
  for (let i = 0; i < 4; i++) await w.ok(["hypothesis", "add", `Byl Matouš ${i} z Horního Ořechova?`, "--about", "P2", "--variant", `A: ano, ${"podle zápisu kmotrů a stáří při úmrtí, ".repeat(10)}`, "--variant", "B: ne"]);
  await w.ok(["task", "add", "Křest Kryštofa", "--level", "link", "--where", "B1", "--why", "rodiče", "--done-when", "zápis", "--about", "P1"]);
  const big = (await w.ok(["brief", "T1", "--budget", "1000000", "--json"])).json;
  const premise = big.sections.find((s: any) => s.name === "premise");
  // room for everything but half of the searches
  const b = (await w.ok(["brief", "T1", "--budget", String(big.total - Math.round(premise.tokens / 2)), "--json"])).json;
  assert.ok(b.total <= b.budget, `${b.total} > ${b.budget}`);
  const cut = Object.fromEntries(b.sections.map((s: any) => [s.name, s.cut]));
  for (const name of ["premise", "record sets", "method", "commands"]) assert.equal(cut[name], false, `${name} cut`);
  assert.equal(cut.people, true, "the people's notes in short");
  // the premise whole: every search and the lesson of the family
  const known = section(b.text, "## Already known");
  assert.equal(known.match(/^ {2}Q\d{4} \[negative\]/gmu)?.length, 30);
  assert.match(known, /lessons:\n {2}K0001: Písař píše Žďárský/u);
  assert.doesNotMatch(known, /Петренки/u);
  // whom the task is about stays, by what tells namesakes apart: other names, the days and places, the start of the last note
  const people = section(b.text, "## People concerned");
  assert.match(people, /\n {2}P0001 Kryštof Žďárský \(\*1801\) M\n/u);
  assert.match(people, /\n {4}note: Poznámka 3: Zápis v knize[^\n]{60,100}… \(3 notes: strom person show P0001\)\n/u);
  assert.match(people, /\n {2}P0002 Matouš Žďárský M — father of P0001\n {4}lived: Dolní Ořechov 7 1801\n/u);
  assert.match(people, /names: Ludmila Žďárská; Lidmila Zďárská/u);
  assert.match(people, /· P0004 Ludmila Žďárská \(\*1803\) F — sibling of P0001 · BIRT 2 FEB 1803 Dolní Ořechov · note: Poznámka 1/u);
  assert.match(people, /· P0005 Ludmila Žďárská \(\*1806\) F — sibling of P0001 · BIRT 9 SEP 1806 Dolní Ořechov/u);
  assert.doesNotMatch(people, /(?:dům se přečíslovával\. ){3}/u, "no note whole");
  assert.match(people, / {2}… in short to fit the brief — all: strom person show P0001\n/u);
  // the other open questions by their start, said where the rest is
  const open = section(b.text, "## Open conflicts and hypotheses");
  assert.equal(open.match(/^ {2}H\d{4} Byl Matouš/gmu)?.length, 4);
  assert.ok(b.text.indexOf("## Already known") < b.text.indexOf("## People concerned"));
  // and with room for all, nothing is cut
  assert.ok(!big.sections.some((s: any) => s.cut));
  w.cleanup();
});

test("brief cut to fit: the premise is cut only after the people's notes, never before them; the lessons stay while the searches go", opts, async () => {
  const w = await world();
  await notes(w, "P1", 3);
  for (let i = 0; i < 40; i++) await w.ok(["search", "add", `Křty Žďárských v Dolním Ořechově, ročník ${1780 + i}: žádný zápis — přečteno celé, i rejstřík`, "--recordset", "B1", "--method", "page-by-page", "--result", "negative"]);
  await w.ok(["lesson", "add", "Písař píše Žďárský i jako Zďarsky nebo Ždiarský: čti obě čtení jako jeden rod"]);
  await w.ok(["task", "add", "Křest Kryštofa", "--level", "link", "--where", "B1", "--why", "rodiče", "--done-when", "zápis", "--about", "P1"]);
  const tree = Tree.open(w.cwd, w.env);
  const task = tree.get<Task>("T0001")!;
  const brief = (budget: number) => buildBrief(tree, { task, budget });
  const big = brief(1_000_000);
  assert.ok(!big.sections.some((s) => s.cut));
  // one token short: the notes give way, never the premise
  const tight = brief(big.total - 1);
  assert.deepEqual(tight.sections.filter((s) => s.cut).map((s) => s.name), ["people"]);
  assert.ok(tight.total <= tight.budget);
  // less and less room: when the searches go at last, no note is whole any more — and the lesson stays
  let b = tight;
  for (let budget = big.total - 1; !b.sections.find((s) => s.name === "premise")!.cut; budget -= 20) b = brief(budget);
  assert.ok(b.total <= b.budget, `${b.total} > ${b.budget}`);
  const people = section(b.text, "## People concerned");
  assert.match(people, /\n {2}P0001 Kryštof Žďárský \(\*1801\) M\n/u);
  assert.match(people, /\n {4}note: Poznámka 3: [^\n]{60,100}… \(3 notes: strom person show P0001\)\n/u);
  assert.doesNotMatch(people, /Poznámka [12]/u, "no note whole while the premise is cut");
  const known = section(b.text, "## Already known");
  assert.match(known, /Q0001 \[negative\][\s\S]* {2}… cut to fit the brief — see: strom searched B0001\nlessons:\n {2}K0001: Písař píše Žďárský/u);
  w.cleanup();
});

test("brief of a task that links hypotheses: its people by who they are and the families a link would join, nothing more", opts, async () => {
  const w = await world();
  await notes(w, "P2", 3);
  await notes(w, "P6", 1);
  await w.ok(["name", "add", "P6", "Oleh /Petrenko/"]);
  await w.ok(["event", "add", "P6", "BIRT", "--date", "5 MAY 1770", "--place", "Горішній Ярів"]);
  await w.ok(["event", "add", "P6", "OCCU", "--value", "мельник", "--date", "1800"]);
  await w.ok(["person", "add", "Kateřina /Žďárská/", "--sex", "F", "--born", "1805"]); // P7
  await w.ok(["hypothesis", "add", "Čí dcera je Kateřina?", "--about", "P7", "--variant", "A: dcera P0002 a P0003?", "--variant", "B: dcera P0006?"]); // H1
  await w.ok(["hypothesis", "add", "Je Матвій Žďárský týž jako Matouš?", "--about", "P2", "--variant", "A: týž jako P0006?", "--variant", "B: jiný"]); // H2
  const tree = Tree.open(w.cwd, w.env);
  const done = settleHypothesisLinks(tree)!;
  assert.equal(done.tasks.length, 1);
  const task = Tree.open(w.cwd, w.env).get<Task>(done.tasks[0]!.id)!;
  assert.equal(task.origin, HYPOTHESIS_LINKS_ORIGIN);
  const text = (await w.ok(["brief", task.id])).out;
  const people = section(text, "## People concerned");
  // no fact one by one, no note whole
  assert.doesNotMatch(people, /\n {4}E\d{4,} /u);
  assert.doesNotMatch(people, /(?:dům se přečíslovával\. ){2}/u);
  // the father: his house, his birth family and the one he founded, each with its ID — what a link names
  assert.match(people, /\n {2}P0002 Matouš Žďárský M\n {4}lived: Dolní Ořechov 7 1801\n {4}parents: unknown\n {4}F0001 with P0003 Ludmila Žďárská · children: P0001 Kryštof Žďárský \(\*1801\), P0004 Ludmila Žďárská \(\*1803\), P0005 Ludmila Žďárská \(\*1806\)\n {4}note: Poznámka 3: [^\n]{60,100}…\n/u);
  // the people the variants name: another script — the day and place of birth, the other form of the name, what he did
  assert.match(people, /\n {2}P0006 Олег Петренко \(\*1770\) M — named in H0001\n {4}BIRT 5 MAY 1770 Горішній Ярів · also: Oleh Petrenko · occupation: мельник 1800\n {4}parents: unknown\n/u);
  assert.match(people, /\n {2}P0007 Kateřina Žďárská \(\*1805\) F\n/u);
  // the mother, her other form (decomposed in the record), and her family with its ID
  assert.match(people, /\n {2}P0003 Ludmila Žďárská F — named in H0001\n {4}also: Lidmila Zďárská\n {4}parents: unknown\n {4}F0001 with P0002 Matouš Žďárský · /u);
  // the hypotheses themselves whole: what the variants would connect
  assert.match(section(text, "## Open conflicts and hypotheses"), /→ H0001 Čí dcera je Kateřina\?: A\) dcera P0002 a P0003\?; B\) dcera P0006\?/u);
  // the method and the commands it uses — none of reading scans, recording an entry or the level's own page
  assert.match(text, /Read each variant whole/u);
  assert.match(text, /\n {2}strom hypothesis link <hypothesis> <variant>/u);
  assert.doesNotMatch(text, /# Method: (?:reading scans|recording an entry|enriching a person)|\n {2}strom (?:media view|fetch|event add) /u);
  // the same task of another kind gets them whole: the short form is the linking task's own
  const t = Tree.open(w.cwd, w.env);
  const other = buildBrief(t, { task: { ...task, origin: "manual" } });
  const linking = buildBrief(t, { task });
  const size = (b: typeof other) => b.sections.find((s) => s.name === "people")!.tokens;
  assert.ok(size(linking) < size(other) / 2, `${size(linking)} vs ${size(other)}`);
  w.cleanup();
});
