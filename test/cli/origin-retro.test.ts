// The app's sends made before it marked what came of an import (1127): people of an imported family tree came in with
// no _STROM_IMPORT, as the person's own (origin user — the app's ✓ "confirmed by a person"). A later send that marks
// them makes such a value the import's (strom sync's change origin.import): only the same value, the person's own and
// nothing more, cited to a send of the app, unconfirmed — and only on the person's sync; an undo puts it back.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { World, hasGit } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import { create, update } from "../../src/core/records.ts";
import { BRIDGE_FEATURES } from "../../src/core/live.ts";
import type { Event, Family, Person, Source } from "../../src/core/model.ts";

const opts = { skip: !hasGit };
/** As the Strom app's bridge writes a send (strom sync … --apply in its process): the person's. */
const FROM_APP = { env: { STROM_FOR_APP: "1" } };
const AGENT = { env: { CLAUDECODE: "1" } };

const open = (w: World) => Tree.open(w.cwd, w.env);
const people = (w: World) => open(w).list<Person>("person");
const named = (w: World, given: string) => people(w).find((p) => p.names.some((n) => n.given === given))!;
const fact = (p: Person | Family, kind: string) => p.events.find((e) => e.kind === kind && !e.retracted)!;
const family = (w: World) => open(w).list<Family>("family")[0]!;
const imports = (w: World) => open(w).list<Source>("source").filter((s) => s.imported && !s.retracted);
const gitHead = (w: World) => execFileSync("git", ["rev-parse", "HEAD"], { cwd: w.cwd, encoding: "utf8" }).trim();
const ged = (lines: string[]) => [...lines, "0 TRLR", ""].join("\n");
const USER = { by: "user" };

const PLACE = "Horní Lhota, okres Lhotov, Čechy";
// an app that reads the confirmations of facts and names (APP_SHOWS_VERIFY, APP_READS_NAME_STATUS)
const appHead = ["0 HEAD", "1 SOUR STROM", "2 VERS 3.31.0", "1 GEDC", "2 VERS 5.5.1", "1 CHAR UTF-8"];
const IMPORT_HEAD = ["1 _STROM_IMPORT I1", "2 SOUR MyHeritage Family Tree Builder", "2 VERS 8.0", "2 DATE 12 MAR 2024", "2 FILE lhotakovi.ged", "2 _SHA 3f9a0c"];
/**
 * Lhotákovi of an imported family tree as the app marks them now: Václav (his birth's date alone of the import), Ludmila
 * (her sex its own mark), Jaroslav in Cyrillic, their marriage; Václav's death and Ondřej the user's.
 */
const marked = [
  "0 @I1@ INDI", "1 _STROM_IMPORT I1", "1 NAME Václav /Lhoták/", "2 _STROM_IMPORT I1", "1 SEX M", "1 BIRT", "2 DATE 1871", `2 PLAC ${PLACE}`, "2 _STROM_IMPORT I1 DATE", "1 DEAT", "2 DATE 1930", "2 PLAC Lhota", "1 FAMS @F1@",
  "0 @I2@ INDI", "1 _STROM_IMPORT I1", "1 NAME Ludmila /Lhotáková/", "2 _STROM_IMPORT I1", "1 SEX F", "2 _STROM_IMPORT I1", "1 BIRT", "2 DATE 1875", "2 _STROM_IMPORT I1", "1 FAMS @F1@",
  "0 @I3@ INDI", "1 NAME Ondřej /Lhoták/", "1 SEX M", "1 BIRT", "2 DATE 1902", "1 FAMC @F1@",
  "0 @I4@ INDI", "1 _STROM_IMPORT I1", "1 NAME Ярослав /Лхотак/", "2 _STROM_IMPORT I1", "1 SEX M", "1 BIRT", "2 DATE 1905", "2 PLAC Лгота", "2 _STROM_IMPORT I1", "1 FAMC @F1@",
  "0 @F1@ FAM", "1 HUSB @I1@", "1 WIFE @I2@", "1 CHIL @I3@", "1 CHIL @I4@", "1 MARR", "2 DATE 1898", "2 PLAC Lhota", "2 _STROM_IMPORT I1",
];
/** The same tree as an older app sent it: no mark of the import at all. */
const unmarked = marked.filter((l) => !l.includes("_STROM_IMPORT"));
const refn = (lines: string[], ids: Record<string, string>) =>
  lines.flatMap((l) => {
    const m = /^0 @(I\d+)@ INDI$/.exec(l);
    return m && ids[m[1]!] ? [l, `1 REFN ${ids[m[1]!]}`, "2 TYPE strom-research"] : [l];
  });

/** Lhotákovi sent by an app that marked nothing (everything the user's); a send of the app made of lines, with the import named in its HEAD. */
async function sentUnmarked(): Promise<{ w: World; send: (lines: string[], o?: { nfd?: boolean }) => string }> {
  const w = new World();
  await w.withTree("Lhotákovi");
  const file = path.join(w.dir, "adopt.ged");
  fs.writeFileSync(file, ged([...appHead, ...unmarked]));
  await w.ok(["sync", file, "--apply", "--force"], FROM_APP);
  const tree = JSON.parse(fs.readFileSync(path.join(w.cwd, "strom.json"), "utf8")).id as string;
  const ids = { I1: named(w, "Václav").id, I2: named(w, "Ludmila").id, I3: named(w, "Ondřej").id, I4: named(w, "Ярослав").id };
  let n = 0;
  const send = (lines: string[], o: { nfd?: boolean } = {}) => {
    const out = path.join(w.dir, `send-${++n}.ged`);
    const text = ged([...appHead, `1 _STROM_TREE ${tree}`, `1 _STROM_HEAD ${gitHead(w)}`, ...IMPORT_HEAD, ...refn(lines, ids)]);
    fs.writeFileSync(out, o.nfd ? text.normalize("NFD") : text);
    return out;
  };
  return { w, send };
}

type Kept = { origin: unknown; citations: unknown };
/** Where each value of the tree came from and what it cites: names, sex, facts of people and of the family. */
function origins(w: World): Record<string, Kept | unknown> {
  const out: Record<string, Kept | unknown> = {};
  for (const p of people(w)) {
    p.names.forEach((n, i) => (out[`${p.id}.N${i}`] = { origin: n.origin, citations: n.citations }));
    out[`${p.id}.SEX`] = p.sexOrigin;
    for (const e of p.events) out[e.id] = { origin: e.origin, citations: e.citations };
  }
  for (const e of family(w).events) out[e.id] = { origin: e.origin, citations: e.citations };
  return out;
}
/** A fact without where it came from and what it cites: its value and status, as they are. */
const bare = ({ origin: _o, citations: _c, updated: _u, ...e }: Event & { updated?: string }) => e;

test("a send that marks what came of an import: a value the person's own as an older send wrote it becomes the import's — names, sex, facts, the family's; the import's source cited first, the send's kept; value and status as they were; once", opts, async () => {
  const { w, send } = await sentUnmarked();
  try {
    // the older send: all the user's, no import's source
    const vaclav0 = named(w, "Václav");
    assert.deepEqual(vaclav0.names[0]!.origin, USER);
    assert.deepEqual(vaclav0.sexOrigin, USER);
    assert.deepEqual(fact(vaclav0, "BIRT").origin, USER);
    assert.equal(imports(w).length, 0);
    const day = fact(vaclav0, "BIRT").citations[0]!.source;
    const before = { vb: fact(vaclav0, "BIRT"), lb: fact(named(w, "Ludmila"), "BIRT"), jb: fact(named(w, "Ярослав"), "BIRT"), marr: fact(family(w), "MARR") };

    // shown first: each value a change of its own, said so
    const file = send(marked);
    const shown = await w.ok(["sync", file], FROM_APP);
    assert.match(shown.out, /Václav Lhoták \[P\d+\]: jméno Václav Lhoták — z rodokmenu, ne úprava člověka/u);
    assert.match(shown.out, /Ludmila Lhotáková \[P\d+\]: pohlaví F — z rodokmenu, ne úprava člověka/u);
    assert.match(shown.out, /: narození .*1871.* — z rodokmenu, ne úprava člověka → původ z importovaného rodokmenu/u);
    const plan = (await w.ok(["sync", file, "--json"], FROM_APP)).json;
    const kinds = (plan.changes as { kind: string; imported?: { what: string } }[]).map((c) => `${c.kind}:${c.imported?.what ?? ""}`).sort();
    // three names, three sexes, three births and the marriage — Václav's death and Ondřej unmarked: nothing
    assert.deepEqual(kinds, [...Array(4).fill("origin.import:fact"), ...Array(3).fill("origin.import:name"), ...Array(3).fill("origin.import:sex")].sort(), JSON.stringify(plan.changes));

    const r = (await w.ok(["sync", file, "--apply", "--json"], FROM_APP)).json;
    assert.ok(r.input, "an input and a commit: the change counts");
    const imp = imports(w);
    assert.equal(imp.length, 1, "one source of the import");
    const s = imp[0]!.id;
    const vaclav = named(w, "Václav");
    assert.deepEqual(vaclav.names[0]!.origin, { by: "import", source: s });
    assert.equal(vaclav.names[0]!.citations?.[0]?.source, s, "the import's source first");
    assert.ok(vaclav.names[0]!.citations?.some((c) => c.source === day), "the send's citation kept");
    assert.deepEqual(vaclav.sexOrigin, { by: "import", source: s }, "the person's mark: their sex too");
    // a mark of a part (_STROM_IMPORT I1 DATE): the date the import's, the place the user's still
    const vb = fact(vaclav, "BIRT");
    assert.deepEqual(vb.origin, { by: "import", source: s, parts: ["date"] });
    assert.deepEqual(vb.citations.map((c) => c.source), [s, day]);
    assert.deepEqual(bare(vb), bare(before.vb), "the value and its status as they were");
    assert.deepEqual(fact(vaclav, "DEAT").origin, USER, "unmarked: the user's");
    const ludmila = named(w, "Ludmila");
    assert.deepEqual(ludmila.sexOrigin, { by: "import", source: s });
    assert.deepEqual(fact(ludmila, "BIRT").origin, { by: "import", source: s });
    assert.deepEqual(bare(fact(ludmila, "BIRT")), bare(before.lb));
    // a name in another script, a place of it
    const jaroslav = named(w, "Ярослав");
    assert.deepEqual(jaroslav.names[0]!.origin, { by: "import", source: s });
    assert.deepEqual(fact(jaroslav, "BIRT").origin, { by: "import", source: s });
    assert.equal(fact(jaroslav, "BIRT").place, "Лгота");
    assert.deepEqual(bare(fact(jaroslav, "BIRT")), bare(before.jb));
    const marr = fact(family(w), "MARR");
    assert.deepEqual(marr.origin, { by: "import", source: s }, "the family's fact too");
    assert.deepEqual(bare(marr), bare(before.marr));
    const ondrej = named(w, "Ondřej");
    assert.deepEqual(ondrej.names[0]!.origin, USER);
    assert.deepEqual(ondrej.sexOrigin, USER);
    assert.deepEqual(fact(ondrej, "BIRT").origin, USER);

    // written once: the same send again changes nothing
    const head = gitHead(w);
    const again = (await w.ok(["sync", send(marked), "--apply", "--json"], FROM_APP)).json;
    assert.deepEqual(again.changes ?? [], [], JSON.stringify(again.changes));
    assert.equal(gitHead(w), head, "nothing written");
    assert.match((await w.ok(["check"])).out, /^ok/);
  } finally {
    w.cleanup();
  }
});

test("origin.import: the file in NFD finds the same names and facts (written in NFC), a name in Cyrillic too", opts, async () => {
  const { w, send } = await sentUnmarked();
  try {
    const r = (await w.ok(["sync", send(marked, { nfd: true }), "--apply", "--json"], FROM_APP)).json;
    const s = imports(w)[0]!.id;
    assert.ok((r.changes as { kind: string }[]).filter((c) => c.kind === "origin.import").length >= 10, JSON.stringify(r.changes));
    const vaclav = named(w, "Václav");
    assert.equal(vaclav.names[0]!.given, "Václav".normalize("NFC"));
    assert.deepEqual(vaclav.names[0]!.origin, { by: "import", source: s });
    assert.deepEqual(named(w, "Ludmila").names[0]!.origin, { by: "import", source: s });
    assert.deepEqual(named(w, "Ярослав").names[0]!.origin, { by: "import", source: s });
    assert.deepEqual(fact(vaclav, "BIRT").origin, { by: "import", source: s, parts: ["date"] });
    assert.equal(fact(vaclav, "BIRT").place, PLACE);
    assert.match((await w.ok(["check"])).out, /^ok/);
  } finally {
    w.cleanup();
  }
});

test("origin.import leaves the user's: a value they changed since (in the app, at the terminal), a fact or name confirmed (strom verify confirm, _STROM_CONFIRMED), one with a value kept to put back or of the user's own tree, one written at the research's terminal", opts, async () => {
  const { w, send } = await sentUnmarked();
  try {
    // the user changes Ludmila's birth in the app (the app no longer marks it)
    const changed = unmarked.map((l) => (l === "2 DATE 1875" ? "2 DATE 1876" : l));
    await w.ok(["sync", send(changed), "--apply", "--edits", "user"], FROM_APP);
    assert.equal(fact(named(w, "Ludmila"), "BIRT").date, "1876");
    // the person confirms Václav's birth against the scan at the terminal
    await w.ok(["verify", "confirm", fact(named(w, "Václav"), "BIRT").id], FROM_APP);
    assert.ok(fact(named(w, "Václav"), "BIRT").confirmed);
    // a value kept to put back (a proposal taken, put back), the user's own tree (_STROM_ORIGIN tree), a fact written at
    // the terminal (citing a source of its own, no send of the app)
    const tree = open(w);
    tree.withTreeLock(() => {
      const own = create<Source>(tree, "source", { kind: "church", title: "Matrika Lhota (opis)", information: "primary", form: "original" } as never, (id) => `+${id} source "Matrika Lhota (opis)"`);
      const j = named(w, "Ярослав");
      update<Person>(tree, j.id, "person", (p) => ({ ...p, events: p.events.map((e) => (e.kind === "BIRT" ? { ...e, citations: [{ source: own.id }] } : e)) }), { op: "event.edit", summary: `${j.id} BIRT cites ${own.id}` });
      const v = named(w, "Václav");
      update<Person>(tree, v.id, "person", (p) => ({ ...p, names: p.names.map((n, i) => (i === 0 ? { ...n, origin: { by: "user", tree: true } } : n)) }), { op: "person.edit", summary: `${v.id} name of the user's tree` });
      const f = family(w);
      update<Family>(tree, f.id, "family", (x) => ({ ...x, events: x.events.map((e) => (e.kind === "MARR" ? { ...e, was: { parts: ["date"], because: [], at: "2026-11-20T10:00:00.000Z", by: "user", date: "1897" } } : e)) }), { op: "event.edit", summary: `${f.id} MARR value kept` });
      tree.commit("the person's terminal");
    });
    const keep = origins(w);
    // Ludmila's name confirmed in the app (_STROM_CONFIRMED under her first NAME), her birth sent as the user changed it
    const file = marked
      .map((l) => (l === "2 DATE 1875" ? "2 DATE 1876" : l))
      .filter((l, i, all) => !(all[i - 1] === "2 DATE 1876" && l === "2 _STROM_IMPORT I1"))
      .flatMap((l, i, all) => (all[i - 1] === "1 NAME Ludmila /Lhotáková/" && l === "2 _STROM_IMPORT I1" ? [l, "2 _STROM_CONFIRMED 2026-11-25"] : [l]));
    const plan = (await w.ok(["sync", send(file), "--json"], FROM_APP)).json;
    const retro = (plan.changes as { kind: string; person?: string; was?: { id?: string }; imported?: { what: string } }[]).filter((c) => c.kind === "origin.import");
    const [v, l, j, f] = [named(w, "Václav"), named(w, "Ludmila"), named(w, "Ярослав"), family(w)];
    const of = (what: string, id: string) => retro.filter((c) => c.imported?.what === what && (what === "fact" ? c.was?.id === id : c.person === id));
    assert.deepEqual(of("fact", fact(l, "BIRT").id), [], "changed in the app: the user's");
    assert.deepEqual(of("fact", fact(v, "BIRT").id), [], "confirmed: the user's");
    assert.deepEqual(of("name", l.id), [], "the name confirmed in the app: the user's");
    assert.deepEqual(of("name", v.id), [], "the user's own tree (tree): as it is");
    assert.deepEqual(of("fact", fact(f, "MARR").id), [], "a value kept to put back (was): as it is");
    assert.deepEqual(of("fact", fact(j, "BIRT").id), [], "written at the terminal: the user's");
    // what is left unchanged since the older send still becomes the import's: the sexes, Jaroslav's name
    assert.equal(of("sex", l.id).length, 1);
    assert.equal(of("name", j.id).length, 1);
    await w.ok(["sync", send(file), "--apply", "--edits", "user"], FROM_APP);
    const now = origins(w);
    for (const k of [`${l.id}.N0`, `${v.id}.N0`, fact(l, "BIRT").id, fact(v, "BIRT").id, fact(f, "MARR").id, fact(j, "BIRT").id]) assert.deepEqual(now[k], keep[k], k);
    assert.match((await w.ok(["check"])).out, /^ok/);
  } finally {
    w.cleanup();
  }
});

test("origin.import at the research's terminal: a value the person changed there since (another value than the file's marked one) stays the user's", opts, async () => {
  const { w, send } = await sentUnmarked();
  try {
    const l = named(w, "Ludmila");
    await w.ok(["event", "edit", fact(l, "BIRT").id, "--date", "1874", "--reason", "matrika Lhota uvádí 1874"], { tty: true });
    assert.equal(fact(named(w, "Ludmila"), "BIRT").date, "1874");
    const plan = (await w.ok(["sync", send(marked), "--json"], FROM_APP)).json;
    const id = fact(named(w, "Ludmila"), "BIRT").id;
    assert.ok(!(plan.changes as { kind: string; was?: { id?: string } }[]).some((c) => c.kind === "origin.import" && c.was?.id === id), JSON.stringify(plan.changes));
  } finally {
    w.cleanup();
  }
});

test("origin.import: an agent's sync plans none and writes none (it would loosen the guard of the user's value)", opts, async () => {
  const { w, send } = await sentUnmarked();
  try {
    const keep = origins(w);
    const file = send(marked);
    const plan = (await w.ok(["sync", file, "--json"], AGENT)).json;
    assert.ok(!(plan.changes as { kind: string }[]).some((c) => c.kind === "origin.import"), JSON.stringify(plan.changes));
    await w.ok(["sync", file, "--apply", "--json"], AGENT);
    const now = origins(w);
    for (const p of people(w)) {
      assert.deepEqual(now[`${p.id}.N0`], keep[`${p.id}.N0`], p.id);
      assert.deepEqual(now[`${p.id}.SEX`], keep[`${p.id}.SEX`], p.id);
      for (const e of p.events) assert.deepEqual((now[e.id] as Kept | undefined)?.origin, (keep[e.id] as Kept | undefined)?.origin, e.id);
    }
  } finally {
    w.cleanup();
  }
});

test("strom sync undo of an origin.import: each origin and citation as before, the import's source withdrawn; strom check ok", opts, async () => {
  const { w, send } = await sentUnmarked();
  try {
    const keep = origins(w);
    const r = (await w.ok(["sync", send(marked), "--apply", "--json"], FROM_APP)).json;
    assert.equal(imports(w).length, 1);
    assert.notDeepEqual(origins(w), keep);
    await w.ok(["sync", "undo", r.input as string]);
    assert.deepEqual(origins(w), keep);
    assert.equal(imports(w).length, 0, "nothing cites the import's source any more: withdrawn");
    assert.match((await w.ok(["check"])).out, /^ok/);
  } finally {
    w.cleanup();
  }
});

test("/status features: origin.import (the bridge's sync makes what an older send wrote of an import the import's)", () => {
  assert.ok((BRIDGE_FEATURES as readonly string[]).includes("origin.import"));
});
