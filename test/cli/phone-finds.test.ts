// The Finds of a paired phone's page: what an agent of the research wrote of the family since the person last looked —
// grouped by the person or family, never the person's own edits, the research's upkeep, a record's ID or a path; a
// record taken back says nothing; the window asked kept for the head; an archive has none.

import { test } from "node:test";
import assert from "node:assert/strict";
import { World, hasGit } from "../helpers.ts";
import { FINDS_BACK_DAYS, treeFinds } from "../../src/core/phone-finds.ts";

const ID = /\b[PFSEXHTM]\d{4,}\b|\[[A-Z]\d{4,}\]/u;
const AGENT = { env: { AI_AGENT: "1" } };
const skip = !hasGit || process.platform === "win32";

test("finds: an agent's new people, facts, families, sources and resolved conflicts grouped by whom; the person's own edits and tasks none", { skip }, async () => {
  const w = new World();
  try {
    await w.withTree("Dvořákovi");
    await w.ok(["lang", "cs"]);
    // the person's own: no find
    await w.ok(["person", "add", "Václav /Dvořák/", "--sex", "M"]); // P0001
    await w.ok(["event", "add", "P1", "OCCU", "--value", "rolník"]);
    const none = treeFinds(w.cwd, w.env);
    assert.deepEqual(none.groups, [], "the person's own edits are no find");

    // an agent's: a new person with a fact, a source, a family with a child, a fact of the person's own person cited
    await w.ok(["source", "add", "Matrika narozených Sloup 1850–1870", "--kind", "birth"], AGENT); // S0001
    await w.ok(["person", "add", "Anežka /Dvořáková/", "--sex", "F"], AGENT); // P0002
    await w.ok(["event", "add", "P2", "BIRT", "--date", "12 MAR 1861", "--place", "Sloup", "--cite", "S1"], AGENT);
    await w.ok(["person", "add", "Marie /Nováková/", "--sex", "F"], AGENT); // P0003
    await w.ok(["family", "add", "--partner", "P1", "--partner", "P3"], AGENT); // F0001
    await w.ok(["family", "child", "F1", "P2"], AGENT);
    await w.ok(["event", "add", "P1", "DEAT", "--date", "1890", "--place", "Sloup"], AGENT); // E0003
    await w.ok(["cite", "E0001", "S1", "--locator", "fol. 3"], AGENT);
    // the research's upkeep: no find
    await w.ok(["task", "add", "Křest Marie", "--level", "locate", "--where", "farnost Sloup", "--why", "rodiče", "--done-when", "zápis", "--about", "P3"], AGENT);
    // a conflict resolved by the agent
    await w.ok(["conflict", "add", "Rok narození Anežky", "--about", "P2", "--claim", "S1: 1861", "--claim", "S1: 1862"], AGENT); // X0001
    await w.ok(["conflict", "resolve", "X1", "--resolution", "1861", "--reasoning", "zápis křtu"], AGENT);
    // a person added and taken back: says nothing
    await w.ok(["person", "add", "Omyl /Zapsaný/", "--sex", "M"], AGENT); // P0004
    await w.ok(["person", "retract", "P4", "--reason", "zapsán omylem"]);

    const f = treeFinds(w.cwd, w.env);
    const said = JSON.stringify(f);
    assert.doesNotMatch(said, ID, said);
    assert.ok(!said.includes(w.home), "no path of this computer");
    assert.doesNotMatch(said, /Křest Marie|Omyl/u, "no task, no record taken back");
    const by = Object.fromEntries(f.groups.map((g) => [g.title ?? g.kind, g.lines.map((l) => `${l.kind}${l.text ? ` ${l.text}` : ""}`)]));
    const anezka = Object.keys(by).find((k) => k.startsWith("Anežka Dvořáková"))!;
    assert.ok(anezka, said);
    assert.equal(by[anezka]![0], "person", "new in the tree");
    assert.ok(by[anezka]!.some((l) => /^fact Narození: .*1861.*Sloup/u.test(l)), said);
    assert.ok(!by[anezka]!.some((l) => l.startsWith("name ")), "a new person's name is no line of its own");
    const vaclav = Object.keys(by).find((k) => k.startsWith("Václav Dvořák"))!;
    assert.ok(by[vaclav]!.some((l) => /^fact Úmrtí: .*1890/u.test(l)), said);
    assert.ok(!by[vaclav]!.some((l) => l.startsWith("person")), "the person's own person is not new");
    assert.ok(by[vaclav]!.some((l) => /^cited Povolání: rolník$/u.test(l)), "the person's own fact newly cited by the agent");
    assert.ok(!by[vaclav]!.some((l) => /^fact .*rolník/u.test(l)), "the person's own fact is no find");
    assert.ok(Object.keys(by).some((k) => by[k]!.includes("family")), said);
    assert.deepEqual(by.sources, ["source Matrika narozených Sloup 1850–1870"]);
    assert.equal(by.resolved?.length, 1);
    assert.match(by.resolved![0]!, /^conflict /u);
    // newest group first, each its newest moment; the keys stable and no ID
    const ats = f.groups.map((g) => g.at);
    assert.deepEqual(ats, [...ats].sort().reverse());
    assert.deepEqual(treeFinds(w.cwd, w.env, f.since).groups.map((g) => g.key), f.groups.map((g) => g.key));
    for (const g of f.groups) assert.match(g.key, /^[0-9a-f]{12}$/u);

    // a page in another language: a fact's name and date in the page's language, as the rest of its line; none or an
    // unknown one: the research language
    const fact = (lang?: string) => treeFinds(w.cwd, w.env, f.since, Date.now(), lang).groups.find((g) => g.title?.startsWith("Anežka Dvořáková"))!.lines.find((l) => l.kind === "fact")!.text;
    assert.equal(fact("en"), "Birth: 12 Mar 1861, Sloup");
    assert.equal(fact("de"), "Geburt: 12.3.1861, Sloup");
    assert.equal(fact(), "Narození: 12. 3. 1861, Sloup");
    assert.equal(fact("cs"), fact());
    assert.equal(fact("../x"), fact(), "not a language: the research's");

    // asked again with nothing new: the same answer, nothing read; a new change: worked out again
    assert.equal(treeFinds(w.cwd, w.env, f.since), treeFinds(w.cwd, w.env, f.since));
    const before = treeFinds(w.cwd, w.env, f.since);
    await w.ok(["source", "add", "Matrika oddaných Sloup", "--kind", "marriage"], AGENT);
    const after = treeFinds(w.cwd, w.env, f.since);
    assert.notEqual(after, before);
    assert.equal(after.groups.find((g) => g.kind === "sources")!.lines.length, 2);

    // since a moment after them all: nothing in the window, the newest before it offered
    const later = new Date(Date.now() + 1000).toISOString();
    const empty = treeFinds(w.cwd, w.env, later, Date.now() + 2000);
    assert.deepEqual(empty.groups, []);
    assert.ok(empty.earlier && empty.earlier < later, JSON.stringify(empty));
    // asked too far back or not a moment: within FINDS_BACK_DAYS, else the last 24 hours
    const now = Date.now();
    assert.equal(treeFinds(w.cwd, w.env, "1900-01-01T00:00:00Z", now).since, new Date(now - FINDS_BACK_DAYS * 86_400_000).toISOString());
    assert.equal(treeFinds(w.cwd, w.env, "včera", now).since, new Date(now - 24 * 3_600_000).toISOString());

    // an archive: none
    await w.ok(["mode", "archive"], { tty: true });
    assert.deepEqual(treeFinds(w.cwd, w.env, f.since).groups, []);
  } finally {
    w.cleanup();
  }
});

test("finds: a fact found and then corrected said once, as it is now; a question decided, one abandoned none; any script and its decomposed form", { skip }, async () => {
  const w = new World();
  try {
    await w.withTree("Жуковы");
    await w.ok(["person", "add", "Мария /Жукова/", "--sex", "F"], AGENT); // P0001
    // a name decomposed (NFD) as some keyboards write it
    await w.ok(["person", "add", "Zden\u030cka /Dvor\u030ca\u0301kova\u0301/", "--sex", "F"], AGENT); // P0002
    await w.ok(["event", "add", "P1", "BIRT", "--date", "1870", "--place", "Тула"], AGENT); // E0001
    await w.ok(["event", "edit", "E0001", "--date", "1871", "--reason", "zápis uvádí 1871"], AGENT);
    // a question decided: a find; one abandoned: none
    await w.ok(["hypothesis", "add", "Чья дочь Мария?", "--about", "P1", "--variant", "A: Ивана", "--variant", "B: Петра"], AGENT); // H0001
    await w.ok(["hypothesis", "decide", "H1", "--variant", "A", "--decision", "метрика"], AGENT);
    await w.ok(["hypothesis", "add", "Kde se narodila Zdeňka?", "--about", "P2", "--variant", "A: Sloup", "--variant", "B: Brno"], AGENT); // H0002
    await w.ok(["hypothesis", "decide", "H2", "--abandon", "--decision", "nelze rozhodnout"], AGENT);
    const f = treeFinds(w.cwd, w.env);
    assert.deepEqual(f.groups.find((g) => g.kind === "resolved")?.lines.map((l) => [l.kind, l.text]), [["hypothesis", "Чья дочь Мария?"]]);
    const maria = f.groups.find((g) => g.title?.startsWith("Мария Жукова"))!;
    assert.ok(maria, JSON.stringify(f));
    const facts = maria.lines.filter((l) => l.kind === "fact" || l.kind === "fixed");
    assert.equal(facts.length, 1, JSON.stringify(maria));
    assert.match(facts[0]!.text, /1871/u);
    assert.doesNotMatch(facts[0]!.text, /1870/u);
    const zdenka = f.groups.find((g) => g.title?.normalize("NFC").startsWith("Zdeňka Dvořáková"));
    assert.ok(zdenka, JSON.stringify(f));
    assert.equal(zdenka!.title, zdenka!.title!.normalize("NFC"), "said in NFC");
  } finally {
    w.cleanup();
  }
});

