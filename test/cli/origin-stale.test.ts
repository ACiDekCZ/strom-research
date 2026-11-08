// An agent's proposal and what happens after it (spec 066 U3, found by its verification): the value now said as it is
// when shown, never as it was when proposed; a proposal the value has moved on from is out of date — taking it writes
// nothing over the person's newer value; what a proposal cannot carry (a cause changed with the date) is said, never
// lost; a proposal's notes and the line of its settling said in the language shown; the agent's preview says "proposed".

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import type { Conflict, Event, Person } from "../../src/core/model.ts";
import { exportGedcom } from "../../src/gedcom/export.ts";
import { children, parseGedcomText, val } from "../../src/gedcom/parse.ts";

const opts = { skip: !hasGit };
const AGENT = { env: { CLAUDECODE: "1" } };
const PERSON = { tty: true };

const GED = [
  "0 HEAD",
  "1 SOUR MyHeritage",
  "2 NAME MyHeritage Family Tree Builder",
  "1 CHAR UTF-8",
  "0 @I1@ INDI",
  "1 NAME Jan /Lhoták/",
  "1 SEX M",
  "1 BIRT",
  "2 DATE 12 MAR 1841",
  "2 PLAC Lhota",
  "1 DEAT",
  "2 DATE 2 FEB 1871",
  "2 PLAC Lhota",
  "2 CAUS souchotiny",
  "0 TRLR",
  "",
].join("\n");

const open = (w: World) => Tree.open(w.cwd, w.env);
const factOf = (w: World, kind: string): Event => open(w).get<Person>("P0001")!.events.find((e) => e.kind === kind && !e.retracted)!;
const conflict = (w: World, id: string) => open(w).get<Conflict>(id)!;

/** Lhotákovi taken in from another program's family tree (the import's values), and the file the Strom app was given. */
async function imported(): Promise<{ w: World; ged: string }> {
  const w = new World();
  await w.withTree("Lhotákovi");
  const file = path.join(w.dir, "lhotakovi.ged");
  fs.writeFileSync(file, GED);
  await w.ok(["intake", file], AGENT);
  const ged = path.join(w.dir, "strom.ged");
  await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", ged], AGENT);
  return { w, ged };
}

/** The file as edited in the app: each replacement made once. */
function edited(ged: string, out: string, ...edits: [string, string][]): string {
  let t = fs.readFileSync(ged, "utf8");
  for (const [a, b] of edits) {
    assert.ok(t.includes(a), `${a} in the file`);
    t = t.replace(a, b);
  }
  fs.writeFileSync(out, t);
  return out;
}

test("a proposal the value moved on from: the value now said as it is, taking it refused with nothing written, keeping the value closes it", opts, async () => {
  const { w, ged } = await imported();
  try {
    const birt = factOf(w, "BIRT").id;
    const s = await w.ok(["sync", edited(ged, path.join(w.dir, "a.ged"), ["2 DATE 12 MAR 1841", "2 DATE 14 MAR 1841"]), "--apply", "--json"], AGENT);
    const x: string = s.json.proposed[0].conflict;
    assert.match(x, /^X\d+$/);
    // shown before anything changed: the import's value now, not out of date
    const fresh = await w.ok(["conflict", "show", x, "--json"]);
    assert.deepEqual({ kind: fresh.json.now.kind, stale: fresh.json.now.stale }, { kind: "import", stale: false });

    // the person dates the birth otherwise at their terminal: the value is theirs now, the proposal out of date
    await w.ok(["event", "edit", birt, "--date", "15 MAR 1841", "--reason", "rodinná bible"], PERSON);
    const show = (await w.ok(["conflict", "show", x])).out;
    assert.match(show, /teď hodnota uživatele {2}15\. 3\. 1841, Lhota/u);
    assert.match(show, /při návrhu {2}12\. 3\. 1841, Lhota/u);
    assert.match(show, /návrh je zastaralý a přijmout ho nelze/u);
    assert.doesNotMatch(show, /přijmout návrh: strom conflict resolve/u);
    const en = (await w.ok(["conflict", "show", x, "--lang", "en"])).out;
    assert.match(en, /now the user's value {2}15 Mar 1841, Lhota/u);
    assert.match(en, /when proposed {2}12 Mar 1841, Lhota/u);
    const j = await w.ok(["conflict", "show", x, "--json"]);
    assert.deepEqual({ kind: j.json.now.kind, stale: j.json.now.stale }, { kind: "user", stale: true });
    const list = (await w.ok(["conflict", "list"])).out;
    assert.match(list, new RegExp(`${x}\\s+návrh agenta · zastaralý`, "u"));

    // taking it: refused, nothing written over the person's value
    const take = await w.run(["conflict", "resolve", x, "--take", "research", "--reasoning", "souhlasím"], PERSON);
    assert.notEqual(take.code, 0);
    assert.match(take.out + take.err, /X\d+ je zastaralý: hodnota se od návrhu změnila/u);
    assert.equal(factOf(w, "BIRT").date, "15 MAR 1841");
    assert.deepEqual(factOf(w, "BIRT").origin, { by: "user" });
    assert.equal(conflict(w, x).state, "open");
    // nor taken by an agent
    const agent = await w.run(["conflict", "resolve", x, "--take", "research", "--reasoning", "x", "--json"], AGENT);
    assert.notEqual(agent.code, 0);
    assert.equal(factOf(w, "BIRT").date, "15 MAR 1841");

    // keeping the value closes it
    await w.ok(["conflict", "resolve", x, "--take", "user", "--reasoning", "platí bible"], PERSON);
    assert.notEqual(conflict(w, x).state, "open");
    assert.equal(factOf(w, "BIRT").date, "15 MAR 1841");

    // the agent's same proposal again: a new one (the old was of another value), not "proposed already"
    const again = await w.ok(["sync", edited(ged, path.join(w.dir, "b.ged"), ["2 DATE 12 MAR 1841", "2 DATE 14 MAR 1841"]), "--apply", "--json"], AGENT);
    if (again.json.proposed?.length) assert.notEqual(again.json.proposed[0].conflict, x);
  } finally {
    w.cleanup();
  }
});

test("a cause changed with the date: at an agent's sync the date proposed, the cause said as left out (text and JSON); at the person's both written", opts, async () => {
  const { w, ged } = await imported();
  try {
    const file = edited(ged, path.join(w.dir, "a.ged"), ["2 DATE 2 FEB 1871", "2 DATE 3 FEB 1871"], ["2 CAUS souchotiny", "2 CAUS tyfus"]);
    // the agent's preview: proposed, never "corrected"
    const preview = (await w.ok(["sync", file], AGENT)).out;
    assert.match(preview, /jen se navrhne/u);
    assert.doesNotMatch(preview, /→ opraví/u);
    const pen = (await w.ok(["sync", file, "--lang", "en"], AGENT)).out;
    assert.match(pen, /only proposed — the user decides/);

    const s = await w.ok(["sync", file, "--apply", "--json"], AGENT);
    assert.equal(s.json.proposed.length, 1);
    const x: string = s.json.proposed[0].conflict;
    const left = (s.json.skipped ?? []).filter((k: { code: string; why: string }) => k.code === "sync.origin" && /cause/.test(k.why));
    assert.equal(left.length, 1, JSON.stringify(s.json.skipped));
    assert.match(left[0].why, new RegExp(`no part of the proposal ${x}`));
    assert.equal(factOf(w, "DEAT").cause, "souchotiny");
    assert.equal(factOf(w, "DEAT").date, "2 FEB 1871");

    // the person's own sync of the same file: the date and the cause written
    await w.ok(["conflict", "resolve", x, "--take", "user", "--reasoning", "rozhodne soubor"], PERSON);
    const mine = await w.ok(["sync", edited(ged, path.join(w.dir, "b.ged"), ["2 DATE 2 FEB 1871", "2 DATE 3 FEB 1871"], ["2 CAUS souchotiny", "2 CAUS tyfus"]), "--apply", "--again"], PERSON);
    assert.doesNotMatch(mine.out, /cause/u);
    assert.equal(factOf(w, "DEAT").date, "3 FEB 1871");
    assert.equal(factOf(w, "DEAT").cause, "tyfus");
  } finally {
    w.cleanup();
  }
});

test("a proposal's note and the line of its settling in the language shown, for a proposal made in another", opts, async () => {
  const { w, ged } = await imported();
  try {
    const deat = factOf(w, "DEAT").id;
    const s = await w.ok(["sync", edited(ged, path.join(w.dir, "a.ged"), ["2 DATE 2 FEB 1871", "2 DATE 3 FEB 1871"]), "--apply", "--json"], AGENT);
    const x: string = s.json.proposed[0].conflict;
    // the note "from <the sync's source> (S…)" as written, said in the language shown
    assert.match(conflict(w, x).notes.map((n) => n.text).join("\n"), /^from .+ \(S\d+\)$/mu);
    const cs = (await w.ok(["conflict", "show", x])).out;
    assert.match(cs, /poznámka {2}z .+ \(S\d+\)/u);
    assert.doesNotMatch(cs, /poznámka {2}from /u);
    const en = (await w.ok(["conflict", "show", x, "--lang", "en"])).out;
    assert.match(en, /from .+ \(S\d+\)/u);

    // the person writes the value proposed: settled, said in Czech
    const edit = await w.ok(["event", "edit", deat, "--date", "3 FEB 1871", "--reason", "matrika"], PERSON);
    assert.match(edit.out, new RegExp(`${x} vyřešeno samo: navržená hodnota už platí`, "u"));
    assert.doesNotMatch(edit.out, /settled: the value proposed/);
    assert.notEqual(conflict(w, x).state, "open");
  } finally {
    w.cleanup();
  }
});

test("whose value a proposal would change is said as it is now: the file for the app (_STROM_KIND) and the agent's refusal say the user's once the person changed the imported value", opts, async () => {
  const { w, ged } = await imported();
  try {
    const birt = factOf(w, "BIRT").id;
    const s = await w.ok(["sync", edited(ged, path.join(w.dir, "a.ged"), ["2 DATE 12 MAR 1841", "2 DATE 14 MAR 1841"]), "--apply", "--json"], AGENT);
    const x: string = s.json.proposed[0].conflict;
    const kindIn = (): string | undefined => {
      const t = exportGedcom(open(w), { for: "strom", origins: true, conflictSides: true, research: true }).text;
      const p = parseGedcomText(t).records.find((r) => r.tag === "INDI" && val(r, "REFN") === "P0001")!;
      const c = children(p, "_STROM_CONFLICT").find((n) => n.value === x);
      return c ? val(c, "_STROM_KIND") : undefined;
    };
    const refusal = async (): Promise<string> => {
      const r = await w.run(["conflict", "resolve", x, "--take", "research", "--reasoning", "x"], AGENT);
      assert.notEqual(r.code, 0);
      return r.out + r.err;
    };
    assert.equal(conflict(w, x).proposal?.kind, "import");
    assert.equal(kindIn(), "import");
    assert.match(await refusal(), /is a proposal to change a value of an imported family tree/u);

    // the person dates the birth otherwise: the value is theirs now, though the proposal was made on the import's
    await w.ok(["event", "edit", birt, "--date", "15 MAR 1841", "--reason", "rodinná bible"], PERSON);
    assert.equal(conflict(w, x).proposal?.kind, "import", "what the proposal holds stays as made");
    assert.equal(kindIn(), "user");
    assert.match(await refusal(), /is a proposal to change the user's value/u);
    assert.equal(factOf(w, "BIRT").date, "15 MAR 1841");
  } finally {
    w.cleanup();
  }
});
