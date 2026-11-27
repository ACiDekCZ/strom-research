// strom sync as-import (1127): a send of the Strom app that was a family tree taken over, told so by the person once. An
// older app sent such people with no mark of the import — every value the person's own (origin user). The command marks
// what the send wrote and is the same now (told by the research's history), the person's own and nothing more, nothing
// kept to put back, unconfirmed: the import's, one source of the send's family tree cited first. A preview first; a
// backup before it writes; one commit; --undo puts it back; --own keeps the answer "written by hand". The person's alone.
// And (bod 6 of 1127) a send that marks a tree merged in the app (`2 SOUR Strom`, no VERS, no DATE) is an import.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { World, hasGit } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import { update } from "../../src/core/records.ts";
import { backupsMade } from "../../src/core/backup.ts";
import { importAnswered, SEND_IMPORTS_FILE } from "../../src/core/sendimport.ts";
import type { Event, Family, Input, Person, Source } from "../../src/core/model.ts";

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
const appHead = ["0 HEAD", "1 SOUR STROM", "2 VERS 3.31.0", "1 GEDC", "2 VERS 5.5.1", "1 CHAR UTF-8"];
/** Lhotákovi of a family tree taken over in the app, sent by an app that marked nothing: everything the user's. */
const tree0 = [
  "0 @I1@ INDI", "1 NAME Václav /Lhoták/", "1 SEX M", "1 BIRT", "2 DATE 1871", `2 PLAC ${PLACE}`, "1 DEAT", "2 DATE 1930", "2 PLAC Lhota", "1 FAMS @F1@",
  "0 @I2@ INDI", "1 NAME Ludmila /Lhotáková/", "1 SEX F", "1 BIRT", "2 DATE 1875", "1 FAMS @F1@",
  "0 @I3@ INDI", "1 NAME Ondřej /Lhoták/", "1 SEX M", "1 BIRT", "2 DATE 1902", "1 FAMC @F1@",
  "0 @I4@ INDI", "1 NAME Ярослав /Лхотак/", "1 SEX M", "1 BIRT", "2 DATE 1905", "2 PLAC Лгота", "1 FAMC @F1@",
  "0 @F1@ FAM", "1 HUSB @I1@", "1 WIFE @I2@", "1 CHIL @I3@", "1 CHIL @I4@", "1 MARR", "2 DATE 1898", "2 PLAC Lhota",
];
const refn = (lines: string[], ids: Record<string, string>) =>
  lines.flatMap((l) => {
    const m = /^0 @(I\d+)@ INDI$/.exec(l);
    return m && ids[m[1]!] ? [l, `1 REFN ${ids[m[1]!]}`, "2 TYPE strom-research"] : [l];
  });

/** A research with Lhotákovi sent unmarked (the file in NFD where asked); its input, and a later send made of lines. */
async function sentUnmarked(o: { nfd?: boolean } = {}): Promise<{ w: World; input: string; send: (lines: string[], head?: string[]) => string }> {
  const w = new World();
  await w.withTree("Lhotákovi");
  const file = path.join(w.dir, "adopt.ged");
  const text = ged([...appHead, ...tree0]);
  fs.writeFileSync(file, o.nfd ? text.normalize("NFD") : text);
  const r = await w.ok(["sync", file, "--apply", "--force", "--json"], FROM_APP);
  const tree = JSON.parse(fs.readFileSync(path.join(w.cwd, "strom.json"), "utf8")).id as string;
  const ids = { I1: named(w, "Václav").id, I2: named(w, "Ludmila").id, I3: named(w, "Ondřej").id, I4: named(w, "Ярослав").id };
  let n = 0;
  const send = (lines: string[], head: string[] = []) => {
    const out = path.join(w.dir, `send-${++n}.ged`);
    fs.writeFileSync(out, ged([...appHead, `1 _STROM_TREE ${tree}`, `1 _STROM_HEAD ${gitHead(w)}`, ...head, ...refn(lines, ids)]));
    return out;
  };
  return { w, input: r.json.input as string, send };
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

/**
 * After the unmarked send: Ludmila's birth changed by another send, Václav's death at the terminal, Ondřej's birth
 * confirmed against the scan, the marriage with a value kept to put back.
 */
async function edited(w: World, send: (lines: string[]) => string): Promise<void> {
  await w.ok(["sync", send(tree0.map((l) => (l === "2 DATE 1875" ? "2 DATE 1876" : l))), "--apply", "--edits", "user"], FROM_APP);
  assert.equal(fact(named(w, "Ludmila"), "BIRT").date, "1876");
  await w.ok(["event", "edit", fact(named(w, "Václav"), "DEAT").id, "--date", "1931", "--reason", "matrika Lhota uvádí 1931"], { tty: true });
  await w.ok(["verify", "confirm", fact(named(w, "Ondřej"), "BIRT").id], FROM_APP);
  assert.ok(fact(named(w, "Ondřej"), "BIRT").confirmed);
  const tree = open(w);
  tree.withTreeLock(() => {
    const f = family(w);
    update<Family>(tree, f.id, "family", (x) => ({ ...x, events: x.events.map((e) => (e.kind === "MARR" ? { ...e, was: { parts: ["date"], because: [], at: "2026-11-20T10:00:00.000Z", by: "user", date: "1897" } } : e)) }), { op: "event.edit", summary: `${f.id} MARR value kept` });
    tree.commit("the person's terminal");
  });
}

test("sync as-import: the preview names exactly the values unchanged since the send and why the rest stays, writes nothing; --apply marks only them the import's (its source cited first, the send's kept, value and status as they were); again nothing; --undo puts back exactly; strom check ok", opts, async () => {
  const { w, input, send } = await sentUnmarked();
  try {
    assert.match(input, /^I\d{4}$/u);
    const day = fact(named(w, "Václav"), "BIRT").citations[0]!.source;
    await edited(w, send);
    const keep = origins(w);
    const [v, l, o, j, f] = [named(w, "Václav"), named(w, "Ludmila"), named(w, "Ondřej"), named(w, "Ярослав"), family(w)];
    const was = { vb: fact(v, "BIRT"), jb: fact(j, "BIRT") };

    // the preview: nothing written
    const head = gitHead(w);
    const shown = await w.ok(["sync", "as-import", input]);
    assert.equal(gitHead(w), head, "the preview writes nothing");
    assert.ok(!fs.existsSync(path.join(w.cwd, ...SEND_IMPORTS_FILE.split("/"))));
    assert.match(shown.out, new RegExp(`Odeslání ${input} z .*: přidáni 4 lidé`, "u"));
    assert.match(shown.out, /Označí se jako z rodokmenu, už ne jako potvrzené člověkem: 10 údajů u 4 lidí \(jména 4, pohlaví 4, události 2\)/u);
    assert.match(shown.out, /Václav Lhoták \[P\d+\]: jméno Václav Lhoták, pohlaví, narození 1871/u);
    assert.match(shown.out, /Ярослав Лхотак \[P\d+\]: jméno Ярослав Лхотак, pohlaví, narození 1905/u);
    assert.match(shown.out, /Zůstane, jak je: 4 údaje \(upraveno od odeslání 2, potvrzeno 1, s dřívější hodnotou 1, jiného původu 0\)/u);
    assert.match(shown.out, /Ludmila Lhotáková \[P\d+\]: narození 1876 – upraveno od odeslání/u);
    assert.match(shown.out, /Václav Lhoták \[P\d+\]: úmrtí 1931 – upraveno od odeslání/u);
    assert.match(shown.out, /Ondřej Lhoták \[P\d+\]: narození 1902 – potvrzeno/u);
    assert.match(shown.out, /\]: sňatek 1898 – s dřívější hodnotou/u);
    assert.match(shown.out, new RegExp(`strom sync as-import ${input} --apply`, "u"));
    assert.doesNotMatch(shown.out, /\b(vy|ty|váš|tvůj)\b/iu);
    const plan = (await w.ok(["sync", "as-import", input, "--json"])).json;
    assert.deepEqual(plan.change, { values: 10, persons: 4, names: 4, sexes: 4, facts: 2 });
    assert.deepEqual(plan.stay, { values: 4, changed: 2, confirmed: 1, was: 1, other: 0 });
    assert.equal(plan.persons, 4);
    assert.deepEqual(plan.samples, [
      { id: v.id, name: "Václav Lhoták", values: ["NAME", "SEX", "BIRT"] },
      { id: l.id, name: "Ludmila Lhotáková", values: ["NAME", "SEX"] },
      { id: o.id, name: "Ondřej Lhoták", values: ["NAME", "SEX"] },
    ]);
    assert.equal(gitHead(w), head);
    assert.equal(importAnswered(open(w), input), undefined);

    // --apply: only those, one commit
    const r = (await w.ok(["sync", "as-import", input, "--apply", "--json"])).json;
    assert.equal(r.values, 10);
    assert.equal(r.persons, 4);
    assert.equal(execFileSync("git", ["rev-list", "--count", `${head}..HEAD`], { cwd: w.cwd, encoding: "utf8" }).trim(), "1", "one commit");
    const imp = imports(w);
    assert.equal(imp.length, 1, "one source of the send's family tree");
    const src = imp[0]!;
    assert.equal(src.id, r.source);
    assert.deepEqual({ kind: src.kind, form: src.form, information: src.information, input: src.input }, { kind: "family-tree", form: "authored", information: "secondary", input });
    assert.deepEqual(src.imported, { key: "R1", program: "Strom", at: open(w).get<Source>(day)!.created.slice(0, 10) });
    assert.match(src.title, /^Rodokmen převzatý v aplikaci Strom \(posláno .+\)$/u);
    const s = src.id;
    const IMP = { by: "import", source: s };
    for (const p of [named(w, "Václav"), named(w, "Ludmila"), named(w, "Ondřej"), named(w, "Ярослав")]) {
      assert.deepEqual(p.names[0]!.origin, IMP, p.id);
      assert.deepEqual(p.names[0]!.citations?.map((c) => c.source), [s, day], `${p.id}: the import's first, the send's kept`);
      assert.deepEqual(p.sexOrigin, IMP, p.id);
    }
    const vb = fact(named(w, "Václav"), "BIRT");
    assert.deepEqual(vb.origin, IMP);
    assert.deepEqual(vb.citations.map((c) => c.source), [s, day]);
    assert.deepEqual(bare(vb), bare(was.vb), "the value and its status as they were");
    assert.deepEqual(bare(fact(named(w, "Ярослав"), "BIRT")), bare(was.jb));
    assert.deepEqual(fact(named(w, "Ярослав"), "BIRT").origin, IMP);
    // the rest the user's, as it was
    const now = origins(w);
    for (const k of [fact(l, "BIRT").id, fact(v, "DEAT").id, fact(o, "BIRT").id, fact(f, "MARR").id]) assert.deepEqual(now[k], keep[k], k);
    assert.deepEqual(fact(named(w, "Ludmila"), "BIRT").origin, USER);
    assert.equal(importAnswered(open(w), input), "import");

    // again: nothing (the same source, no commit)
    const head2 = gitHead(w);
    const again = (await w.ok(["sync", "as-import", input, "--apply", "--json"])).json;
    assert.equal(again.values, 0);
    assert.equal(gitHead(w), head2, "nothing written");
    const after = (await w.ok(["sync", "as-import", input, "--json"])).json;
    assert.equal(after.change.values, 0);
    assert.equal(after.done, 10, "marked already");
    assert.equal(after.answer, "import");

    // --undo: exactly as before, the source withdrawn, the answer kept
    const u = (await w.ok(["sync", "as-import", input, "--undo", "--json"])).json;
    assert.deepEqual({ restored: u.restored, left: u.left }, { restored: 10, left: 0 });
    assert.deepEqual(origins(w), keep);
    assert.equal(imports(w).length, 0, "nothing cites its source any more: withdrawn");
    assert.equal(importAnswered(open(w), input), "import", "the answer stays");
    assert.match((await w.ok(["check"])).out, /^ok/);

    // applied again after the undo: the same source back, never one more
    const back = (await w.ok(["sync", "as-import", input, "--apply", "--json"])).json;
    assert.equal(back.values, 10);
    assert.equal(back.source, s);
    assert.equal(open(w).list<Source>("source").filter((x) => x.imported).length, 1);
    assert.match((await w.ok(["check"])).out, /^ok/);
  } finally {
    w.cleanup();
  }
});

test("sync as-import: the file sent in NFD (written in NFC) and a name in Cyrillic found and shown; the preview's text in NFC", opts, async () => {
  const { w, input } = await sentUnmarked({ nfd: true });
  try {
    const v = named(w, "Václav".normalize("NFC"));
    assert.ok(v, "the names written in NFC");
    const shown = await w.ok(["sync", "as-import", input]);
    assert.ok(shown.out.includes("Václav Lhoták".normalize("NFC")), shown.out);
    assert.ok(!shown.out.includes("Václav".normalize("NFD")));
    assert.ok(shown.out.includes("Ярослав Лхотак"));
    const r = (await w.ok(["sync", "as-import", input.toLowerCase().replace(/^i0+/u, "i"), "--apply", "--json"])).json;
    assert.equal(r.values, 4 + 4 + 6, "every name, sex and fact: none changed since (the input typed as i2)");
    assert.deepEqual(named(w, "Ярослав").names[0]!.origin, { by: "import", source: r.source });
    assert.match((await w.ok(["check"])).out, /^ok/);
  } finally {
    w.cleanup();
  }
});

test("sync as-import is the person's alone: an agent (CLAUDECODE=1) is refused, the preview too — nothing written", opts, async () => {
  const { w, input } = await sentUnmarked();
  try {
    const head = gitHead(w);
    for (const extra of [[], ["--apply"], ["--undo"], ["--own"]]) {
      const r = await w.run(["sync", "as-import", input, ...extra, "--json"], AGENT);
      assert.notEqual(r.code, 0, `${extra.join(" ")}: refused`);
    }
    assert.equal(gitHead(w), head);
    assert.deepEqual(named(w, "Václav").names[0]!.origin, USER);
  } finally {
    w.cleanup();
  }
});

test("sync as-import of an input that is no sync (or none): an error with what to run, its code; one taken back: refused", opts, async () => {
  const { w, input } = await sentUnmarked();
  try {
    const none = await w.run(["sync", "as-import", "I9999", "--json"]);
    assert.equal(none.code, 2);
    assert.equal(none.json?.code, "sync.not-sync", none.out);
    assert.match(none.json.hint, /strom input list/u);
    // a source's input that is no sync: the family tree's material of another kind
    const file = path.join(w.dir, "dopis.txt");
    fs.writeFileSync(file, "Milá Ludmilo, …");
    await w.ok(["intake", file]);
    const letter = open(w).list<Input>("input").find((i) => i.name === "dopis.txt")!;
    const notSync = await w.run(["sync", "as-import", letter.id, "--json"]);
    assert.equal(notSync.json?.code, "sync.not-sync", notSync.out);
    await w.ok(["sync", "undo", input]);
    const undone = await w.run(["sync", "as-import", input, "--json"]);
    assert.equal(undone.json?.code, "sync.undone", undone.out);
  } finally {
    w.cleanup();
  }
});

test("sync as-import --apply backs the research up first (a home of the research set), once a day; without a home it goes on with no backup", opts, async () => {
  const { w, input } = await sentUnmarked();
  try {
    assert.deepEqual(backupsMade(w.env), []);
    const r = await w.ok(["sync", "as-import", input, "--apply"]);
    const made = backupsMade(w.env);
    assert.equal(made.length, 1, "a backup made");
    assert.ok(r.out.includes(made[0]!.path), r.out);
    const copy = path.join(made[0]!.path, "trees", path.basename(w.cwd));
    const before = JSON.parse(fs.readFileSync(path.join(copy, "data", "persons", `${named(w, "Václav").id}.json`), "utf8")) as Person;
    assert.deepEqual(before.names[0]!.origin, USER, "the research as it was before");
    assert.match(fs.readFileSync(path.join(made[0]!.path, "README.txt"), "utf8"), new RegExp(`${input}.*strom sync as-import`, "su"));
    assert.match(r.out, new RegExp(`Vrácení: strom sync as-import ${input} --undo`, "u"));
  } finally {
    w.cleanup();
  }
  const two = await sentUnmarked();
  try {
    const config = path.join(two.w.env.STROM_CONFIG_DIR!, "config.json");
    const { home: _h, ...rest } = JSON.parse(fs.readFileSync(config, "utf8"));
    fs.writeFileSync(config, JSON.stringify(rest, null, 2));
    const r = await two.w.ok(["sync", "as-import", two.input, "--apply"]);
    assert.deepEqual(backupsMade(two.w.env), [], "no home: no backup");
    assert.match(r.out, /Bez zálohy/u);
    assert.equal(named(two.w, "Václav").names[0]!.origin?.by, "import");
  } finally {
    two.w.cleanup();
  }
});

test("sync as-import --own: written by hand — nothing changes, the answer kept (importAnswered own); refused while marked; --undo keeps the answer import", opts, async () => {
  const { w, input } = await sentUnmarked();
  try {
    const keep = origins(w);
    const r = (await w.ok(["sync", "as-import", input, "--own", "--json"])).json;
    assert.deepEqual({ answer: r.answer, written: r.written }, { answer: "own", written: true });
    assert.deepEqual(origins(w), keep, "nothing changed");
    assert.equal(importAnswered(open(w), input), "own");
    const head = gitHead(w);
    assert.equal((await w.ok(["sync", "as-import", input, "--own", "--json"])).json.written, false);
    assert.equal(gitHead(w), head, "answered so already: nothing written");
    // then taken for a family tree after all: the answer import
    await w.ok(["sync", "as-import", input, "--apply"]);
    assert.equal(importAnswered(open(w), input), "import");
    const refused = await w.run(["sync", "as-import", input, "--own", "--json"]);
    assert.equal(refused.json?.code, "sync.as-import.applied", refused.out);
    assert.match(refused.json.hint, new RegExp(`strom sync as-import ${input} --undo`, "u"));
    await w.ok(["sync", "as-import", input, "--undo"]);
    assert.equal(importAnswered(open(w), input), "import", "the undo keeps the answer");
    assert.equal((await w.ok(["sync", "as-import", input, "--own", "--json"])).json.written, true);
    assert.equal(importAnswered(open(w), input), "own");
    assert.match((await w.ok(["check"])).out, /^ok/);
  } finally {
    w.cleanup();
  }
});

// bod 6 of 1127: a tree merged in the Strom app is an import there (its HEAD names it `SOUR Strom`, no VERS or DATE)
const MERGED_HEAD = ["1 _STROM_IMPORT I2", "2 SOUR Strom", "2 FILE Lhotákovi – sloučený strom", "2 _AT 2026-11-26"];
const mark = (lines: string[]) =>
  lines.flatMap((l) => (/^0 @I\d+@ INDI$/u.test(l) ? [l, "1 _STROM_IMPORT I2"] : /^1 (NAME|SEX) /u.test(l) || /^2 DATE /u.test(l) ? [l, "2 _STROM_IMPORT I2"] : [l]));

test("a send marking a tree merged in the app (2 SOUR Strom, no VERS or DATE): new people the import's, of its source (a family tree)", opts, async () => {
  const w = new World();
  try {
    await w.withTree("Lhotákovi");
    const file = path.join(w.dir, "adopt.ged");
    fs.writeFileSync(file, ged([...appHead, ...MERGED_HEAD, ...mark(tree0)]));
    await w.ok(["sync", file, "--apply", "--force"], FROM_APP);
    const imp = imports(w);
    assert.equal(imp.length, 1, JSON.stringify(open(w).list<Source>("source")));
    const s = imp[0]!;
    assert.equal(s.kind, "family-tree");
    assert.equal(s.imported?.program, "Strom");
    assert.equal(s.imported?.key, "I2");
    for (const p of people(w)) {
      assert.deepEqual(p.names[0]!.origin, { by: "import", source: s.id }, p.id);
      assert.deepEqual(p.sexOrigin, { by: "import", source: s.id }, p.id);
      assert.equal(fact(p, "BIRT").origin?.by, "import", p.id);
      assert.equal(fact(p, "BIRT").origin?.source, s.id, p.id);
    }
    assert.match((await w.ok(["check"])).out, /^ok/);
  } finally {
    w.cleanup();
  }
});

test("a send marking a tree merged in the app: people an older send wrote the user's, unchanged since, become the import's (origin.import)", opts, async () => {
  const { w, send } = await sentUnmarked();
  try {
    await w.ok(["sync", send(mark(tree0), MERGED_HEAD), "--apply"], FROM_APP);
    const imp = imports(w);
    assert.equal(imp.length, 1);
    assert.equal(imp[0]!.kind, "family-tree");
    assert.equal(imp[0]!.imported?.program, "Strom");
    const v = named(w, "Václav");
    assert.deepEqual(v.names[0]!.origin, { by: "import", source: imp[0]!.id });
    assert.deepEqual(v.sexOrigin, { by: "import", source: imp[0]!.id });
    assert.equal(fact(v, "BIRT").origin?.by, "import");
    assert.deepEqual(named(w, "Ярослав").names[0]!.origin, { by: "import", source: imp[0]!.id });
    assert.match((await w.ok(["check"])).out, /^ok/);
  } finally {
    w.cleanup();
  }
});
