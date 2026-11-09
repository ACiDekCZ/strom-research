// An agent's proposals (spec 066 U3) as the person meets them: told apart in conflict list and show — an agent's
// proposal, whose the value now is, the value proposed after it, how to take or decline it, said in the language shown
// (also for a proposal written in another); a place rewritten by an agent over a family tree's value only as a link to
// the same place, else proposed (or changed on a record it cites); a proposal whose value holds now closed by itself —
// at the write that makes it hold, and once over a research's open proposals.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import { settleHeldProposals } from "../../src/core/originfix.ts";
import type { Conflict, Event, Family, Person, Place } from "../../src/core/model.ts";

const opts = { skip: !hasGit };
const AGENT = { env: { CLAUDECODE: "1" } };
const PERSON = { tty: true };

const GED = [
  "0 HEAD",
  "1 SOUR MyHeritage",
  "2 NAME MyHeritage Family Tree Builder",
  "2 VERS 8.0",
  "1 DATE 3 MAR 2020",
  "1 CHAR UTF-8",
  "0 @I1@ INDI",
  "1 NAME Jan /Lhoták/",
  "1 SEX M",
  "1 BIRT",
  "2 DATE 12 MAR 1841",
  "2 PLAC Lhota",
  "1 OCCU rolník",
  "0 @I2@ INDI",
  "1 NAME Anna /Lhotáková/",
  "1 SEX F",
  "1 BIRT",
  "2 DATE 1845",
  "2 PLAC H. Lhota",
  "1 RESI",
  "2 PLAC lhota",
  "0 TRLR",
  "",
].join("\n");

const open = (w: World) => Tree.open(w.cwd, w.env);
const person = (w: World, id: string) => open(w).get<Person>(id)!;
const eventOf = (w: World, id: string): Event => {
  for (const o of [...open(w).list<Person>("person"), ...open(w).list<Family>("family")]) {
    const e = o.events.find((x) => x.id === id);
    if (e) return e;
  }
  throw new Error(`no ${id}`);
};
const factOf = (w: World, who: string, kind: string) => person(w, who).events.find((e) => e.kind === kind)!;
const conflict = (w: World, id: string) => open(w).get<Conflict>(id)!;

/** Lhotákovi (a Czech research) with another program's family tree imported (S0001: P0001 Jan, P0002 Anna) and a register (S0002). */
async function imported(): Promise<World> {
  const w = new World();
  await w.withTree("Lhotákovi");
  const file = path.join(w.dir, "lhotakovi.ged");
  fs.writeFileSync(file, GED);
  await w.ok(["intake", file], AGENT);
  await w.ok(["source", "add", "Křest Jana Lhotáka 1841", "--kind", "baptism"], AGENT); // S0002
  return w;
}

test("an agent's proposal told apart in conflict list and show: whose the value now is, the one proposed after it, how to take it — in the language shown", opts, async () => {
  const w = await imported();
  try {
    // a proposal on an import's value (no record cited)
    const birt = factOf(w, "P0001", "BIRT").id;
    const a = await w.ok(["event", "edit", birt, "--date", "14 MAR 1841", "--reason", "jiný den v zápisu", "--json"], AGENT);
    const xi: string = a.json.proposed;
    // a proposal on the user's value
    const occu = factOf(w, "P0001", "OCCU").id;
    await w.ok(["event", "edit", occu, "--value", "chalupník", "--reason", "rodinná paměť"], PERSON);
    const b = await w.ok(["event", "edit", occu, "--value", "sedlák", "--cite", "S0002", "--reason", "matrika", "--json"], AGENT);
    const xu: string = b.json.proposed;
    assert.match(xi, /^X\d+$/);
    assert.match(xu, /^X\d+$/);

    // conflict list, Czech
    const list = (await w.ok(["conflict", "list"])).out;
    assert.match(list, new RegExp(`${xi}\\s+návrh agenta · teď z importovaného rodokmenu`));
    assert.match(list, new RegExp(`${xu}\\s+návrh agenta · teď hodnota uživatele`));
    assert.match(list, /přijmout návrh: strom conflict resolve X… --take research/);
    assert.match(list, /ponechat hodnotu: strom conflict resolve X… --take user/);

    // conflict show, Czech: the value now first, whose; the proposed after it; the reason without "why:"
    for (const [id, whose] of [
      [xi, "teď z importovaného rodokmenu"],
      [xu, "teď hodnota uživatele"],
    ] as const) {
      const show = (await w.ok(["conflict", "show", id])).out;
      assert.match(show, /\[otevřený · návrh agenta\]/);
      const now = show.indexOf(whose);
      const proposed = show.search(/\nnávrh {2}/u);
      assert.ok(now > 0 && proposed > now, `the value now first, then the one proposed:\n${show}`);
      assert.match(show, new RegExp(`přijmout návrh: strom conflict resolve ${id} --take research --reasoning`));
      assert.match(show, new RegExp(`ponechat hodnotu: strom conflict resolve ${id} --take user --reasoning`));
      assert.doesNotMatch(show, /why:/);
      assert.match(show, /poznámka {2}(jiný den v zápisu|matrika)/u);
    }
    const si = (await w.ok(["conflict", "show", xi])).out;
    assert.match(si, /Narození [—–] 12\. 3\. 1841, Lhota × 14\. 3\. 1841, Lhota/u);
    assert.match(si, /teď z importovaného rodokmenu {2}S0001: 12\. 3\. 1841, Lhota/u);
    assert.match(si, /\nnávrh {2}14\. 3\. 1841, Lhota/u);
    const su = (await w.ok(["conflict", "show", xu])).out;
    assert.match(su, /teď hodnota uživatele {2}chalupník/u);
    assert.match(su, /\nnávrh {2}S0002: sedlák/u);

    // English, of the same Czech research: the title said from the proposal, never as written
    const en = (await w.ok(["conflict", "show", xi, "--lang", "en"])).out;
    assert.match(en, /Jan Lhoták: Birth [—–] /u);
    assert.doesNotMatch(en, /Narození/u);
    assert.match(en, /\[open · an agent's proposal\]/);
    assert.match(en, /now from the imported family tree {2}S0001: /);
    assert.match(en, /to take the proposal: strom conflict resolve X\d+ --take research/);
    const enu = (await w.ok(["conflict", "show", xu, "--lang", "en"])).out;
    assert.doesNotMatch(enu, /Povolání/u);
    assert.match(enu, /now the user's value {2}chalupník/u);
    const enl = (await w.ok(["conflict", "list", "--lang", "en"])).out;
    assert.match(enl, new RegExp(`${xi}\\s+an agent's proposal · now from the imported family tree\\s+Jan Lhoták: Birth`));
    assert.match(enl, new RegExp(`${xu}\\s+an agent's proposal · now the user's value`));
    assert.doesNotMatch(enl, /Narození|Povolání/u);
    // the reason kept without a prefix of any language
    assert.equal(conflict(w, xi).notes[0]?.text, "jiný den v zápisu");
    // the JSON as ever
    const j = await w.ok(["conflict", "show", xi, "--json"]);
    assert.equal(j.json.conflict.proposal.kind, "import");
  } finally {
    w.cleanup();
  }
});

test("a proposal an older strom wrote: its \"why:\" taken off when shown, its title said in the language shown", opts, async () => {
  const w = await imported();
  try {
    const birt = factOf(w, "P0001", "BIRT").id;
    const r = await w.ok(["event", "edit", birt, "--date", "14 MAR 1841", "--reason", "jiný den", "--json"], AGENT);
    const id: string = r.json.proposed;
    // as 1.30.0's betas wrote it: the note with "why: "
    const tree = open(w);
    tree.withTreeLock(() => {
      const c = tree.get<Conflict>(id)!;
      tree.put({ ...c, notes: c.notes.map((n) => ({ ...n, text: `why: ${n.text}` })) }, { op: "conflict.edit", targets: [id], summary: "as written before" });
      tree.commit("As written before");
    });
    const show = (await w.ok(["conflict", "show", id])).out;
    assert.doesNotMatch(show, /why:/);
    assert.match(show, /poznámka {2}jiný den/u);
    assert.match((await w.ok(["conflict", "show", id, "--lang", "en"])).out, /Jan Lhoták: Birth [—–] /);
  } finally {
    w.cleanup();
  }
});

// ── N3: an imported family tree's place rewritten by an agent ───────────────────────────────────────────────────────

test("a place of an imported family tree rewritten by an agent: as a link to the same place; to another place proposed, or on a record it cites", opts, async () => {
  const w = await imported();
  try {
    const resi = factOf(w, "P0002", "RESI").id;
    const birt = factOf(w, "P0002", "BIRT").id;
    // the same place: the facts' text one of the record's names (no case, no accents) — a link, the family tree's kept
    await w.ok(["place", "identify", "Lhota", "--lat", "49.61", "--lon", "15.23", "--why", "fara Lhotov"], AGENT); // L0001
    const same = await w.ok(["place", "rewrite", "lhota", "--to", "L0001", "--reason", "jedna obec", "--json"], AGENT);
    assert.equal(same.json.changed, 1);
    assert.equal(same.json.proposed, undefined);
    assert.equal(eventOf(w, resi).place, "Lhota");
    assert.equal(eventOf(w, resi).was?.place, "lhota");

    // another place: the family tree's proposed, the value as it was, the record not given the form; the research's own
    // fact of the form rewritten
    await w.ok(["event", "add", "P0001", "DEAT", "--date", "1900", "--place", "Horní Lhota", "--cite", "S0002"], AGENT); // the research's own
    await w.ok(["place", "identify", "Horní Lhota", "--lat", "49.70", "--lon", "15.30", "--why", "fara Lhotov"], AGENT); // L0002
    const buri = (await w.ok(["event", "add", "P0001", "BURI", "--date", "1900", "--place", "H. Lhota", "--cite", "S0002", "--json"], AGENT)).json.event.id as string;
    const other = await w.ok(["place", "rewrite", "H. Lhota", "--to", "L0002", "--reason", "zkratka v matrikách", "--json"], AGENT);
    assert.equal(other.json.changed, 1);
    assert.equal(eventOf(w, buri).place, "Horní Lhota");
    assert.equal(other.json.proposed.length, 1);
    const x = conflict(w, other.json.proposed[0]);
    assert.equal(x.state, "open");
    assert.equal(x.proposal?.kind, "import");
    assert.equal(x.edit?.place, "Horní Lhota");
    assert.equal(x.edit?.event, birt);
    assert.equal(eventOf(w, birt).place, "H. Lhota");
    assert.equal(eventOf(w, birt).origin?.by, "import");
    assert.ok(!open(w).get<Place>("L0002")!.names.some((n) => n.name === "H. Lhota"), "the form not written as the record's");
    assert.match((await w.ok(["place", "rewrite", "H. Lhota", "--to", "L0002", "--reason", "zkratka v matrikách"], AGENT)).out, /proposed \(X\d+/);

    // on a record: rewritten, cited, the family tree's place kept — and the proposal holds now
    const cited = await w.ok(["place", "rewrite", "H. Lhota", "--to", "L0002", "--cite", "S0002", "--locator", "fol. 3", "--reason", "matrika: Horní Lhota", "--json"], AGENT);
    assert.equal(cited.json.changed, 1);
    const e = eventOf(w, birt);
    assert.equal(e.place, "Horní Lhota");
    assert.equal(e.was?.place, "H. Lhota");
    assert.ok(e.was?.parts.includes("place"));
    assert.equal(e.origin, undefined);
    assert.ok(e.citations.some((c) => c.source === "S0002" && c.locator === "fol. 3"));
    assert.equal(conflict(w, x.id).state, "resolved");
  } finally {
    w.cleanup();
  }
});

test("an agent's identification naming the place otherwise is no proof of the same place: the family tree's place proposed, not rewritten", opts, async () => {
  const w = await imported();
  try {
    const birt = factOf(w, "P0001", "BIRT").id;
    // the agent identifies the facts' "Lhota" as a place of another name: the form stays a name of the record
    await w.ok(["place", "identify", "Lhota", "--name", "Horní Lhota", "--lat", "49.70", "--lon", "15.30", "--why", "fara Lhotov"], AGENT); // L0001
    const l = open(w).get<Place>("L0001")!;
    assert.equal(l.names[0]!.name, "Horní Lhota");
    assert.ok(l.names.some((n) => n.name === "Lhota"), "the form kept as a name of the record");
    const r = await w.ok(["place", "rewrite", "Lhota", "--to", "L0001", "--reason", "jedna obec", "--json"], AGENT);
    assert.equal(r.json.changed, 0);
    assert.equal(r.json.proposed.length, 2, "Jan's birth and Anna's residence (lhota)");
    assert.equal(eventOf(w, birt).place, "Lhota", "the family tree's place as it was");
    assert.equal(conflict(w, r.json.proposed[0]).edit?.place, "Horní Lhota");
    // on a record it is rewritten
    const cited = await w.ok(["place", "rewrite", "Lhota", "--to", "L0001", "--cite", "S0002", "--locator", "fol. 3", "--reason", "matrika: Horní Lhota", "--json"], AGENT);
    assert.equal(cited.json.changed, 2);
    assert.equal(eventOf(w, birt).place, "Horní Lhota");
  } finally {
    w.cleanup();
  }
});

// ── N4: a proposal that holds closes by itself ───────────────────────────────────────────────────────────────────

test("a proposal whose value the agent then writes on a record it cites: closed by itself, nothing else written", opts, async () => {
  const w = await imported();
  try {
    const birt = factOf(w, "P0001", "BIRT").id;
    const id = (await w.ok(["event", "edit", birt, "--date", "14 MAR 1841", "--reason", "jiný den", "--json"], AGENT)).json.proposed as string;
    // another proposal of the same fact, of a value that never comes: stays open
    const other = (await w.ok(["event", "edit", birt, "--date", "15 MAR 1841", "--reason", "jiný den", "--json"], AGENT)).json.proposed as string;
    assert.notEqual(other, id);
    await w.ok(["event", "edit", birt, "--date", "14 MAR 1841", "--cite", "S0002", "--locator", "fol. 3", "--reason", "matrika: 14. března"], AGENT);
    assert.equal(eventOf(w, birt).date, "14 MAR 1841");
    const x = conflict(w, id);
    assert.equal(x.state, "resolved");
    assert.equal(x.taken, "research");
    assert.match(x.reasoning ?? "", new RegExp(`^settled: the value proposed holds now \\(${birt}`));
    assert.equal(x.decidedBy, undefined, "an agent's write decides nothing the person would");
    assert.equal(conflict(w, other).state, "open");
    // said in the research's language
    const show = (await w.ok(["conflict", "show", id])).out;
    assert.match(show, new RegExp(`vyřešeno samo: navržená hodnota už platí \\(${birt}`));
    assert.doesNotMatch(show, /přijmout návrh/);
    // logged as an operation of its own
    assert.ok(open(w).readOps().some((o) => o.op === "conflict.settle" && o.targets.includes(id)));
  } finally {
    w.cleanup();
  }
});

test("a proposal whose value the person writes: closed by itself as theirs — a fact, a name, a retraction; another value leaves it open; one taken is closed by the decision alone", opts, async () => {
  const w = await imported();
  try {
    // the user's occupation; an agent proposes another
    const occu = factOf(w, "P0001", "OCCU").id;
    await w.ok(["event", "edit", occu, "--value", "chalupník", "--reason", "rodinná paměť"], PERSON);
    const a = (await w.ok(["event", "edit", occu, "--value", "sedlák", "--cite", "S0002", "--reason", "matrika", "--json"], AGENT)).json.proposed as string;
    // the person writes another value first: still open
    await w.ok(["event", "edit", occu, "--value", "domkář", "--reason", "jinak"], PERSON);
    assert.equal(conflict(w, a).state, "open");
    // then exactly the value proposed: closed, theirs
    await w.ok(["event", "edit", occu, "--value", "sedlák", "--reason", "ano, sedlák"], PERSON);
    let x = conflict(w, a);
    assert.equal(x.state, "resolved");
    assert.equal(x.decidedBy, "user");
    assert.equal(eventOf(w, occu).value, "sedlák");
    // the user's name: an agent proposes the register's spelling; the person writes it
    await w.ok(["person", "edit", "P0001", "--name", "Jan /Lhotak/", "--reason", "pravopis"], PERSON);
    const n = (await w.ok(["person", "edit", "P0001", "--name", "Jan /Lhoták/", "--reason", "matrika", "--json"], AGENT)).json.proposed as string;
    assert.equal(conflict(w, n).state, "open");
    await w.ok(["person", "edit", "P0001", "--name", "Jan /Lhoták/", "--reason", "podle matriky"], PERSON);
    assert.equal(conflict(w, n).state, "resolved");
    // a retraction proposed of the user's fact; the person retracts it
    await w.ok(["event", "add", "P0001", "DEAT", "--date", "1900", "--place", "Lhota"], PERSON);
    const deat = factOf(w, "P0001", "DEAT").id;
    const r = (await w.ok(["event", "retract", deat, "--reason", "jmenovec", "--json"], AGENT)).json.proposed as string;
    assert.equal(conflict(w, r).state, "open");
    await w.ok(["event", "retract", deat, "--reason", "jmenovec, opravdu"], PERSON);
    x = conflict(w, r);
    assert.equal(x.state, "resolved");
    assert.match(x.reasoning ?? "", /^settled: /);
    // a proposal the person takes: closed by the decision, its reasoning the person's (never settled under it)
    const anna = factOf(w, "P0002", "BIRT").id;
    const t = (await w.ok(["event", "edit", anna, "--date", "1846", "--reason", "věk při sňatku", "--json"], AGENT)).json.proposed as string;
    await w.ok(["conflict", "resolve", t, "--take", "research", "--reasoning", "souhlasím"], PERSON);
    x = conflict(w, t);
    assert.equal(x.state, "resolved");
    assert.equal(x.reasoning, "souhlasím");
    assert.equal(eventOf(w, anna).date, "1846");
    assert.ok(!open(w).readOps().some((o) => o.op === "conflict.settle" && o.targets.includes(t)));
  } finally {
    w.cleanup();
  }
});

test("once over a research's open proposals: the ones whose value holds closed, the others left open, nothing written twice", opts, async () => {
  const w = await imported();
  try {
    const birt = factOf(w, "P0001", "BIRT").id;
    const anna = factOf(w, "P0002", "BIRT").id;
    const held = (await w.ok(["event", "edit", birt, "--date", "14 MAR 1841", "--reason", "jiný den", "--json"], AGENT)).json.proposed as string;
    const left = (await w.ok(["event", "edit", anna, "--date", "1846", "--reason", "věk", "--json"], AGENT)).json.proposed as string;
    // as a strom before this one left it: the first proposal's value written, the proposal left open
    const tree = open(w);
    tree.withTreeLock(() => {
      const p = tree.get<Person>("P0001")!;
      tree.put({ ...p, events: p.events.map((e) => (e.id === birt ? { ...e, date: "14 MAR 1841" } : e)) }, { op: "event.edit", targets: ["P0001", birt], summary: `${birt} BIRT edited` });
      tree.commit("As written before");
    });
    assert.equal(conflict(w, held).state, "open");
    const done = settleHeldProposals(open(w));
    assert.deepEqual(done?.map((c) => c.id), [held]);
    assert.equal(conflict(w, held).state, "resolved");
    assert.equal(conflict(w, left).state, "open");
    assert.equal(eventOf(w, anna).date, "1845", "no value written");
    assert.deepEqual(settleHeldProposals(open(w)), []);
    // committed: nothing left for strom check
    await w.ok(["check"]);
  } finally {
    w.cleanup();
  }
});
