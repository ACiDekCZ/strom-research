// The original IDs of an imported family tree (spec 066 K3.2): what another program gave its people and families (the
// xref, _UID, RIN, EXID, _FSFTID, AFN) is kept by the import's source, goes back to the Strom app beside the marks of
// origin (`1 _STROM_IMPORT <key>` / `_STROM_XID` with `2 _XREF` and the lines), and finds a person again when a tree of
// the same system comes in — when the name, sex and birth year agree and no global ID differs, or a newer file of the
// same program's tree says them otherwise (said, leads beside); else a candidate for a person to decide, never joined
// and never put into a family where the one it may be is already. The app's blocks are taken in a sync (an x: person of a strong ID rekeyed, the IDs
// added as a change of their own, undone with the sync); a merge keeps both; origins-1 adds them to an older research.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { World, hasGit } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import { ORIGINS_SETTLED, settleOrigins } from "../../src/core/originfix.ts";
import { exportGedcom } from "../../src/gedcom/export.ts";
import { validateGedcom } from "../../src/gedcom/validate.ts";
import { readGedcom } from "../../src/core/sync.ts";
import type { Family, OriginalIds, Person, Source } from "../../src/core/model.ts";

const opts = { skip: !hasGit };
const AGENT = { env: { CLAUDECODE: "1" } };
const PERSON = { tty: true };
/** As the Strom app's bridge writes a send: the person's. */
const FROM_APP = { env: { STROM_FOR_APP: "1" } };

const open = (w: World) => Tree.open(w.cwd, w.env);
const people = (w: World) => open(w).list<Person>("person").filter((p) => !p.retracted && !p.mergedInto);
const named = (w: World, given: string, surname?: string) => people(w).filter((p) => p.names.some((n) => n.given === given && (surname === undefined || n.surname === surname)));
const one = (w: World, given: string, surname?: string) => {
  const all = named(w, given, surname);
  assert.equal(all.length, 1, `${given} ${surname ?? ""}: ${all.map((p) => p.id).join(", ")}`);
  return all[0]!;
};
const ged = (lines: string[]) => [...lines, "0 TRLR", ""].join("\n");
const gitHead = (w: World) => execFileSync("git", ["rev-parse", "HEAD"], { cwd: w.cwd, encoding: "utf8" }).trim();
const write = (w: World, name: string, text: string) => {
  const f = path.join(w.dir, name);
  fs.writeFileSync(f, text);
  return f;
};

const MH_HEAD = ["0 HEAD", "1 SOUR MYHERITAGE", "2 NAME MyHeritage Family Tree Builder", "2 VERS 8.0", "1 CHAR UTF-8"];
const JAN_UID = "5F3B2C1A9D8E7F60A1B2C3D4E5F607181A2B"; // 32 hex + a 4-hex checksum
const ANNA_UID = "0A1B2C3D4E5F60718293A4B5C6D7E8F9C0DE";
const IVAN_UID = "{9e8d7c6b-5a49-3827-1605-f4e3d2c1b0a9}";
const FAM_UID = "77777777777777777777777777777777ABCD";
/** A MyHeritage-like tree: _UID with its checksum, RIN, a media record and a link to it, its own _UPD lines; a Cyrillic name. */
const MH = ged([
  ...MH_HEAD,
  "0 @I1@ INDI", "1 NAME Jan /Lhoták/", "1 SEX M", "1 BIRT", "2 DATE 12 MAR 1841", "2 PLAC Lhota", `1 _UID ${JAN_UID}`, "1 RIN MH:I1", "1 _UPD 3 MAR 2020", "1 OBJE @O1@", "1 FAMS @F1@",
  "0 @I2@ INDI", "1 NAME Anna /Lhotáková/", "1 SEX F", "1 BIRT", "2 DATE 1845", "2 PLAC Horní Lhota", `1 _UID ${ANNA_UID}`, "1 RIN MH:I2", "1 _UPD 3 MAR 2020", "1 FAMS @F1@",
  "0 @I3@ INDI", "1 NAME Иван /Лхотак/", "1 SEX M", "1 BIRT", "2 DATE 1868", `1 _UID ${IVAN_UID}`, "1 FAMC @F1@",
  "0 @F1@ FAM", "1 HUSB @I1@", "1 WIFE @I2@", "1 CHIL @I3@", "1 MARR", "2 DATE 1865", `1 _UID ${FAM_UID}`, "1 RIN MH:F1",
  "0 @O1@ OBJE", "1 FILE jan.jpg",
]);

/** A research of the MyHeritage-like tree taken in by intake (S0001, key R1). */
async function intaken(): Promise<World> {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["intake", write(w, "lhotakovi.ged", MH)], AGENT);
  return w;
}

/** The research as an older strom (1.29) left it: no marks of origin, no IDs, no marker of origins-1. */
function asOlder(w: World): void {
  const tree = open(w);
  tree.withTreeLock(() => {
    const all = [...tree.list<Person>("person"), ...tree.list<Family>("family"), ...tree.list<Source>("source")];
    const clean = all.map((r) => {
      const c = structuredClone(r) as unknown as Record<string, unknown>;
      for (const k of ["origin", "sexOrigin", "imported", "originalIds"]) delete c[k];
      if (Array.isArray(c.events)) c.events = (c.events as Record<string, unknown>[]).map(({ origin: _o, ...e }) => e);
      if (Array.isArray(c.names)) c.names = (c.names as Record<string, unknown>[]).map(({ origin: _o, ...x }) => x);
      return c as unknown as Person;
    });
    tree.putMany(clean, [], { op: "tree.settle", targets: all.map((r) => r.id), summary: "as an older strom left it" }, (c) => {
      c.settled = (c.settled ?? []).filter((x) => x !== ORIGINS_SETTLED);
    });
    tree.commit("As an older strom left it");
  });
}

test("intake of another program's tree: the IDs kept by the import, back to the app beside the origins (HEAD names the key), never in the standard GEDCOM; media and the program's tags counted", opts, async () => {
  const w = new World();
  try {
    await w.withTree("Lhotákovi");
    const r = await w.ok(["intake", write(w, "lhotakovi.ged", MH), "--json"], AGENT);
    assert.match(r.json ? JSON.stringify(r.json) : "", /"notTaken":\{"objects":1,"links":1,"tags":\{"_UPD":2\}\}/u);
    const text = await w.ok(["intake", write(w, "jiny.ged", MH.replace("Horní Lhota", "Dolní Lhota")), "--lang", "en"], AGENT);
    assert.match(text.out, /Not taken from the file: 1 media record, 1 link to media, _UPD ×2/u);
    const tree = open(w);
    const s = tree.list<Source>("source").find((x) => x.imported?.key === "R1")!;
    const jan = one(w, "Jan", "Lhoták");
    assert.deepEqual(jan.originalIds?.[0], { source: s.id, xref: "I1", ids: [{ tag: "_UID", value: JAN_UID }, { tag: "RIN", value: "MH:I1" }] });
    const ivan = one(w, "Иван");
    assert.deepEqual(ivan.originalIds?.[0], { source: s.id, xref: "I3", ids: [{ tag: "_UID", value: IVAN_UID }] });
    const fam = tree.list<Family>("family").find((f) => f.partners.includes(jan.id))!;
    assert.deepEqual(fam.originalIds?.[0], { source: s.id, xref: "F1", ids: [{ tag: "_UID", value: FAM_UID }, { tag: "RIN", value: "MH:F1" }] });

    // for an app that shows the origins: the same IDs back, the key in HEAD
    const out = exportGedcom(open(w), { for: "strom", origins: true }).text;
    assert.match(out, /^0 HEAD[\s\S]*?^1 _STROM_IMPORT R1\r?$/m);
    const indi = (id: string) => out.split(/(?=^0 )/m).find((r) => new RegExp(`^1 REFN ${id}\\r?$`, "m").test(r))!;
    assert.match(indi(jan.id), new RegExp(`^1 _STROM_IMPORT R1\\r?\\n2 _XREF @I1@\\r?\\n2 _UID ${JAN_UID}\\r?\\n2 RIN MH:I1\\r?$`, "m"));
    assert.match(indi(ivan.id), /^2 _UID \{9e8d7c6b-5a49-3827-1605-f4e3d2c1b0a9\}\r?$/m, "as it came");
    assert.match(out, new RegExp(`^0 @${fam.id}@ FAM[\\s\\S]*?^1 _STROM_IMPORT R1\\r?\\n2 _XREF @F1@\\r?\\n2 _UID ${FAM_UID}`, "m"));
    const found = validateGedcom(out);
    assert.deepEqual(found.filter((i) => i.level === "error"), []);
    assert.deepEqual(found.filter((i) => /_XREF|_UID|RIN|_STROM_IMPORT/u.test(i.message)), []);
    // the research's own file read back: its IDs not taken as the app's; the same lines as the app sends them: once
    assert.equal(readGedcom(out).persons.get(jan.id)!.ids, undefined);
    assert.match(out, /^1 SOUR STROM_RESEARCH\r?$/m);
    const back = readGedcom(out.replace(/^1 SOUR STROM_RESEARCH(\r?)$/m, "1 SOUR STROM$1")).persons.get(jan.id)!;
    assert.equal(jan.originalIds?.length, 2, "the second file found him by his _UID");
    assert.equal(back.ids?.length, 2);
    assert.deepEqual(back.ids?.[0], { key: "R1", xref: "I1", ids: [{ tag: "_UID", value: JAN_UID }, { tag: "RIN", value: "MH:I1" }] });
    // an app that does not show them, the standard GEDCOM: none
    for (const o of [exportGedcom(open(w), { for: "strom" }).text, exportGedcom(open(w), {}).text]) {
      assert.ok(!/_XREF|_STROM_XID/u.test(o));
      assert.ok(!o.includes(JAN_UID));
    }
  } finally {
    w.cleanup();
  }
});

test("the same tree again (another file, the UUIDs written otherwise): nobody twice, the new facts leads, the IDs of both imports kept; a changed name only a candidate", opts, async () => {
  const w = await intaken();
  try {
    const before = people(w).length;
    const jan = one(w, "Jan", "Lhoták");
    const again = ged([
      ...MH_HEAD.map((l) => (l === "2 VERS 8.0" ? "2 VERS 9.0" : l)),
      "0 @I1@ INDI", "1 NAME Jan /Lhoták/", "1 SEX M", "1 BIRT", "2 DATE 12 MAR 1841", "1 DEAT", "2 DATE 1900", "2 PLAC Lhota", "1 _UID 5f3b2c1a-9d8e-7f60-a1b2-c3d4e5f60718", "1 RIN MH:I1", "1 FAMS @F1@",
      "0 @I2@ INDI", "1 NAME Anna /Lhotáková/", "1 SEX F", "1 BIRT", "2 DATE 1846", `1 _UID ${ANNA_UID.toLowerCase()}`, "1 FAMS @F1@",
      "0 @I3@ INDI", "1 NAME Иван /Лхотак/", "1 SEX M", "1 _UID 9E8D7C6B5A4938271605F4E3D2C1B0A9", "1 FAMC @F1@",
      "0 @F1@ FAM", "1 HUSB @I1@", "1 WIFE @I2@", "1 CHIL @I3@", `1 _UID ${FAM_UID}`,
    ]);
    const r = await w.ok(["intake", write(w, "znovu.ged", again), "--json"], AGENT);
    assert.equal(people(w).length, before, "nobody twice");
    assert.ok(!JSON.stringify(r.json).includes('"candidates"'), JSON.stringify(r.json));
    const s2 = open(w).list<Source>("source").find((x) => x.imported?.key === "R2")!;
    const j = open(w).get<Person>(jan.id)!;
    const deat = j.events.find((e) => e.kind === "DEAT")!;
    assert.equal(deat.status, "lead");
    assert.ok(deat.citations.some((c) => c.source === s2.id), "the new fact cites the new import");
    assert.equal(j.originalIds?.length, 2);
    assert.deepEqual(j.originalIds?.[1], { source: s2.id, xref: "I1", ids: [{ tag: "_UID", value: "5f3b2c1a-9d8e-7f60-a1b2-c3d4e5f60718" }, { tag: "RIN", value: "MH:I1" }] });
    assert.equal(one(w, "Иван").originalIds?.length, 2, "a Cyrillic name, the UUID in braces and without");
    const fam = open(w).list<Family>("family").filter((f) => f.partners.includes(jan.id));
    assert.equal(fam.length, 1);
    assert.equal(fam[0]!.originalIds?.length, 2, "the family: the entry of the new import added");

    // the same _UID, another name, in a newer file of the same program's tree: the same person — the name a variant
    // beside, what differs said (a spoofed _UID of another program: the next test, a candidate)
    const anna = one(w, "Anna", "Lhotáková");
    const renamed = ged([...MH_HEAD, "0 @I2@ INDI", "1 NAME Marie /Lhotová/", "1 SEX F", "1 BIRT", "2 DATE 1845", `1 _UID ${ANNA_UID}`]);
    const c = await w.ok(["intake", write(w, "jina.ged", renamed), "--json"], AGENT);
    assert.equal(people(w).length, before, "nobody twice");
    assert.ok(!JSON.stringify(c.json).includes('"candidates"'), JSON.stringify(c.json));
    assert.match(JSON.stringify(c.json), new RegExp(`"differs":\\[\\{"person":"${anna.id}","xref":"I2","why":"name differs"\\}\\]`, "u"));
    const a = open(w).get<Person>(anna.id)!;
    assert.ok(a.names.some((n) => n.given === "Marie" && n.surname === "Lhotová"), "the file's name a variant");
    assert.equal(a.names[0]!.given, "Anna", "the research's name stays first");
    const t = await w.ok(["intake", write(w, "jina2.ged", renamed.replace("Marie /Lhotová/", "Zdeňka /Lhotská/")), "--lang", "en"], AGENT);
    assert.match(t.out, new RegExp(`The same person by an ID of the program, the file says otherwise \\(taken as leads, nothing replaced\\): ${anna.id} \\(name\\)`, "u"));
  } finally {
    w.cleanup();
  }
});

// Found on real data 2026-11-08: the same tree again with one birth date changed — the person was made again and put
// into the family as a second child. A newer file of the same program: the same person by the _UID, the other date a
// lead beside the research's (never replaced), said; a person of another program only maybe them: made, never put
// into the family where the one they may be is a child already.
test("a newer file of the same program with a birth date changed: nobody twice, nobody twice in a family, the date a lead, said; a candidate of another program not put into the family", opts, async () => {
  const w = await intaken();
  try {
    const ivan = one(w, "Иван");
    const before = people(w).length;
    const fam = () => open(w).list<Family>("family").find((f) => f.children.some((c) => c.person === ivan.id))!;
    const kids = fam().children.length;
    const changed = MH.replace("1 NAME Иван /Лхотак/\n1 SEX M\n1 BIRT\n2 DATE 1868", "1 NAME Иван /Лхотак/\n1 SEX M\n1 BIRT\n2 DATE 3 MAY 1880\n1 NOTE Ověřeno v jiném programu");
    assert.notEqual(changed, MH);
    const r = await w.ok(["intake", write(w, "novejsi.ged", changed), "--json"], AGENT);
    assert.equal(people(w).length, before, "nobody twice");
    assert.equal(fam().children.length, kids, "nobody twice in the family");
    assert.ok(!JSON.stringify(r.json).includes('"candidates"'), JSON.stringify(r.json));
    assert.match(JSON.stringify(r.json), new RegExp(`"differs":\\[\\{"person":"${ivan.id}","xref":"I3","why":"birth years differ"\\}\\]`, "u"));
    const i = open(w).get<Person>(ivan.id)!;
    const births = i.events.filter((e) => e.kind === "BIRT" && !e.retracted);
    assert.deepEqual(births.map((e) => e.date).sort(), ["1868", "3 MAY 1880"].sort(), "the research's date kept, the file's beside it");
    assert.equal(births.find((e) => e.date !== "1868")!.status, "lead");
    // said in the research's language
    const cs = await w.ok(["intake", write(w, "novejsi2.ged", changed.replace("3 MAY 1880", "1885")), "--lang", "cs"], AGENT);
    assert.match(cs.out, new RegExp(`Tatáž osoba podle ID programu, soubor ji uvádí jinak \\(přidáno jako vodítka, nic nepřepsáno\\): ${ivan.id} \\(rok narození\\)`, "u"));
    assert.equal(people(w).length, before);
    assert.equal(fam().children.length, kids);

    // another program's file: the parents the same (everything agrees), the child's _UID on a name not alike — a
    // candidate, made, never put into the family where Ivan is a child already
    const gramps = ged([
      "0 HEAD", "1 SOUR Gramps", "2 NAME Gramps", "2 VERS 5.2", "1 CHAR UTF-8",
      "0 @I1@ INDI", "1 NAME Jan /Lhoták/", "1 SEX M", "1 BIRT", "2 DATE 1841", `1 _UID ${JAN_UID}`, "1 FAMS @F1@",
      "0 @I2@ INDI", "1 NAME Anna /Lhotáková/", "1 SEX F", "1 BIRT", "2 DATE 1845", `1 _UID ${ANNA_UID}`, "1 FAMS @F1@",
      "0 @I3@ INDI", "1 NAME Petr /Lhotka/", "1 SEX M", `1 _UID ${IVAN_UID}`, "1 FAMC @F1@",
      "0 @F1@ FAM", "1 HUSB @I1@", "1 WIFE @I2@", "1 CHIL @I3@",
    ]);
    const g = await w.ok(["intake", write(w, "gramps.ged", gramps), "--json"], AGENT);
    const petr = one(w, "Petr", "Lhotka");
    assert.equal(people(w).length, before + 1);
    assert.match(JSON.stringify(g.json), new RegExp(`"candidates":\\[\\{"person":"${petr.id}","like":"${ivan.id}","why":"same _UID; name differs"\\}\\]`, "u"));
    assert.match(JSON.stringify(g.json), new RegExp(`"notJoined":\\[\\{"person":"${petr.id}","family":"${fam().id}","like":"${ivan.id}"\\}\\]`, "u"));
    assert.ok(!fam().children.some((c) => c.person === petr.id), "not put into the family");
    const en = await w.ok(["intake", write(w, "gramps2.ged", gramps.replace("Petr", "Pavel")), "--lang", "en"], AGENT);
    assert.match(en.out, new RegExp(`Not put into a family where the person it may be is already: P\\d+ → ${fam().id} \\(≈${ivan.id}\\)`, "u"));
    // strom check says the pair (a research where it happened before): compare, merge on the person's word — nothing merged
    const chk = await w.run(["check", "--json"]);
    const said = JSON.stringify(chk.json);
    assert.match(said, new RegExp(`"code":"same-original-id","id":"${petr.id}","message":"${ivan.id} and ${petr.id} have the same ID of a family tree`, "u"));
    assert.match(said, new RegExp(`strom person compare ${ivan.id} ${petr.id}`, "u"));
    assert.equal(people(w).length, before + 2, "nothing merged");
    await w.ok(["quality", "dismiss", "possibleDuplicate", ivan.id, petr.id], PERSON);
    assert.doesNotMatch(JSON.stringify((await w.run(["check", "--json"])).json), new RegExp(`${ivan.id} and ${petr.id}`, "u"), "two people: not said again");
  } finally {
    w.cleanup();
  }
});

test("a newer file of the same program: a person of no name there (an empty NAME, //, none) is the research's \"?\" — never said to differ; only the one whose birth date changed is", opts, async () => {
  const w = new World();
  try {
    await w.withTree("Lhotákovi");
    const tree = (year: string) => ged([
      ...MH_HEAD,
      "0 @I1@ INDI", "1 NAME", "1 SEX F", `1 _UID ${ANNA_UID}`, "1 RIN MH:I1",
      "0 @I2@ INDI", "1 NAME Jan /Lhoták/", "1 SEX M", "1 BIRT", `2 DATE ${year}`, `1 _UID ${JAN_UID}`, "1 RIN MH:I2",
      "0 @I3@ INDI", "1 NAME //", `1 _UID ${IVAN_UID}`, "1 RIN MH:I3",
      "0 @I4@ INDI", "1 SEX M", `1 _UID ${FAM_UID}`, "1 RIN MH:I4",
    ]);
    await w.ok(["intake", write(w, "lhotakovi.ged", tree("12 MAR 1841"))], AGENT);
    const jan = one(w, "Jan", "Lhoták");
    assert.equal(named(w, "?").length, 3, "the nameless kept as \"?\"");
    const before = people(w).length;
    // a birth year far off: Jan alone said to differ, nobody twice, no candidate
    const r = await w.ok(["intake", write(w, "novejsi.ged", tree("1850")), "--json"], AGENT);
    const said = JSON.stringify(r.json);
    assert.equal(people(w).length, before, "nobody twice");
    assert.ok(!said.includes('"candidates"'), said);
    assert.match(said, new RegExp(`"differs":\\[\\{"person":"${jan.id}","xref":"I2","why":"birth years differ"\\}\\]`, "u"));
    // a year close: nobody said to differ; the date a lead on Jan — the one fact the file added
    const cs = await w.ok(["intake", write(w, "novejsi2.ged", tree("1842")), "--lang", "cs"], AGENT);
    assert.doesNotMatch(cs.out, /Tatáž osoba podle ID programu/u, cs.out);
    assert.equal(people(w).length, before, "nobody twice");
    const births = open(w).get<Person>(jan.id)!.events.filter((e) => e.kind === "BIRT" && !e.retracted);
    assert.ok(births.some((e) => e.date === "1842" && e.status === "lead"), JSON.stringify(births));
    for (const p of named(w, "?")) assert.ok(!p.events.some((e) => !e.retracted && e.status === "lead"), `${p.id}: nothing added`);
  } finally {
    w.cleanup();
  }
});

test("a spoofed _UID of another person, a FamilySearch ID that differs, an ID only of a program: no match — a candidate; FamilySearch's ID in another tag, another case: the same person", opts, async () => {
  const w = await intaken();
  try {
    const jan = one(w, "Jan", "Lhoták");
    let n = people(w).length;
    // another program's file with Jan's _UID on someone else: another name
    const gramps = ["0 HEAD", "1 SOUR Gramps", "2 NAME Gramps", "2 VERS 5.2", "1 CHAR UTF-8"];
    const spoof = await w.ok(["intake", write(w, "podvrh.ged", ged([...gramps, "0 @I0001@ INDI", "1 NAME Petr /Lhotka/", "1 SEX M", "1 BIRT", "2 DATE 1841", `1 _UID ${JAN_UID}`])), "--json"], AGENT);
    assert.equal(people(w).length, ++n);
    assert.match(JSON.stringify(spoof.json), new RegExp(`"like":"${jan.id}","why":"same _UID; name differs"`, "u"));
    // now two people have it: neither is taken
    const two = await w.ok(["intake", write(w, "dva.ged", ged([...gramps, "0 @I0009@ INDI", "1 NAME Jan /Lhoták/", "1 SEX M", `1 _UID ${JAN_UID}`])), "--json"], AGENT);
    assert.equal(people(w).length, ++n);
    assert.match(JSON.stringify(two.json), /"why":"same _UID; more than one person has it"/u);
    // the same name, another birth year or sex (each in a research of its own)
    for (const [lines, why] of [
      [["1 NAME Jan /Lhoták/", "1 SEX M", "1 BIRT", "2 DATE 1890"], "birth years differ"],
      [["1 NAME Jan /Lhoták/", "1 SEX F"], "sex differs"],
    ] as const) {
      const v = await intaken();
      try {
        const m = people(v).length;
        const r = await v.ok(["intake", write(v, "x.ged", ged([...gramps, "0 @I0002@ INDI", ...lines, `1 _UID ${JAN_UID}`])), "--json"], AGENT);
        assert.equal(people(v).length, m + 1, why);
        assert.match(JSON.stringify(r.json), new RegExp(`"why":"same _UID; ${why}"`, "u"));
      } finally {
        v.cleanup();
      }
    }

    // FamilySearch: Josef with his ID; a file with his _UID but another FamilySearch ID — no match
    const fs1 = ["0 HEAD", "1 SOUR FamilySearch", "2 NAME FamilySearch Family Tree", "1 CHAR UTF-8"];
    const JOSEF_UID = "ABCDEFABCDEFABCDEFABCDEFABCDEF12";
    await w.ok(["intake", write(w, "fs1.ged", ged([...fs1, "0 @I1@ INDI", "1 NAME Josef /Lhotka/", "1 SEX M", "1 BIRT", "2 DATE 1870", "1 _FSFTID KWCB-HZ2", `1 _UID ${JOSEF_UID}`]))], AGENT);
    const josef = one(w, "Josef", "Lhotka");
    n = people(w).length;
    const other = await w.ok(["intake", write(w, "fs2.ged", ged([...fs1, "0 @I1@ INDI", "1 NAME Josef /Lhotka/", "1 SEX M", "1 BIRT", "2 DATE 1870", "1 _FSFTID LZZZ-999", `1 _UID ${JOSEF_UID}`])), "--json"], AGENT);
    assert.equal(people(w).length, n + 1, "another FamilySearch person: never joined, the same _UID notwithstanding");
    assert.match(JSON.stringify(other.json), new RegExp(`"like":"${josef.id}","why":"same _UID; _FSFTID differs"`, "u"));
    // FamilySearch's ID as an EXID, in small letters: the same person
    n = people(w).length;
    const exid = await w.ok(["intake", write(w, "fs3.ged", ged([...fs1, "0 @I7@ INDI", "1 NAME Josef /Lhotka/", "1 SEX M", "1 DEAT", "2 DATE 1931", "1 EXID kwcb-hz2", "2 TYPE https://www.familysearch.org/ark:/61903/4:1:"])), "--json"], AGENT);
    assert.equal(people(w).length, n, "found by FamilySearch's ID");
    assert.ok(!JSON.stringify(exid.json).includes('"candidates"'));
    const j = open(w).get<Person>(josef.id)!;
    assert.ok(j.events.some((e) => e.kind === "DEAT" && e.date === "1931" && e.status === "lead"));
    assert.deepEqual(j.originalIds?.at(-1)?.ids, [{ tag: "EXID", value: "kwcb-hz2", type: "https://www.familysearch.org/ark:/61903/4:1:" }]);
  } finally {
    w.cleanup();
  }
});

test("weak IDs (the xref, RIN) only within one program's files, and then a candidate alone", opts, async () => {
  const w = new World();
  try {
    await w.withTree("Lhotákovi");
    const gramps = (name: string) => ["0 HEAD", "1 SOUR Gramps", `2 NAME ${name}`, "2 VERS 5.2", "1 CHAR UTF-8"];
    await w.ok(["intake", write(w, "g1.ged", ged([...gramps("Gramps"), "0 @I0001@ INDI", "1 NAME Karel /Lhoták/", "1 SEX M", "1 RIN 1", "1 _UID 11111111111111111111111111111111"]))], AGENT);
    const karel = one(w, "Karel");
    // the same program, the same xref and RIN, another UUID (a UUID differs in every tree: no counter-evidence, no match)
    const r = await w.ok(["intake", write(w, "g2.ged", ged([...gramps("gramps"), "0 @I0001@ INDI", "1 NAME Karel /Lhoták/", "1 SEX M", "1 RIN 1", "1 _UID 22222222222222222222222222222222"])), "--json"], AGENT);
    assert.equal(named(w, "Karel").length, 2, "never joined by a weak ID");
    assert.match(JSON.stringify(r.json), new RegExp(`"like":"${karel.id}","why":"same xref in a file of the same program"`, "u"));
    // another program: the xref says nothing
    const o = await w.ok(["intake", write(w, "h.ged", ged(["0 HEAD", "1 SOUR Other", "2 NAME Another Program", "1 CHAR UTF-8", "0 @I0001@ INDI", "1 NAME Karel /Lhoták/", "1 SEX M", "1 RIN 1"])), "--json"], AGENT);
    assert.equal(named(w, "Karel").length, 3);
    assert.ok(!JSON.stringify(o.json).includes('"candidates"'), JSON.stringify(o.json));
  } finally {
    w.cleanup();
  }
});

test("a merge: the kept person has the IDs of both, those of the one merged away as not come of its import", opts, async () => {
  const w = new World();
  try {
    await w.withTree("Lhotákovi");
    const gramps = ["0 HEAD", "1 SOUR Gramps", "2 NAME Gramps", "1 CHAR UTF-8"];
    await w.ok(["intake", write(w, "a.ged", ged([...gramps, "0 @I0001@ INDI", "1 NAME Karel /Lhoták/", "1 SEX M", "1 _UID 11111111111111111111111111111111"]))], AGENT);
    await w.ok(["intake", write(w, "b.ged", ged([...MH_HEAD, "0 @I5@ INDI", "1 NAME Karel /Lhoták/", "1 SEX M", "1 _UID 22222222222222222222222222222222", "1 RIN 5"]))], AGENT);
    const [a, b] = named(w, "Karel").sort((x, y) => x.id.localeCompare(y.id));
    await w.ok(["person", "merge", a!.id, b!.id, "--reason", "táž osoba"], AGENT);
    const kept = open(w).get<Person>(a!.id)!;
    const ids = kept.originalIds as OriginalIds[];
    assert.equal(ids.length, 2);
    assert.equal(ids[0]!.xid, undefined);
    assert.deepEqual(ids[1], { ...b!.originalIds![0]!, xid: true });
    const out = exportGedcom(open(w), { for: "strom", origins: true }).text;
    assert.match(out, /^1 _STROM_XID R2\r?\n2 _XREF @I5@\r?\n2 _UID 2{32}\r?\n2 RIN 5\r?$/m);
    assert.match(out, /^0 HEAD[\s\S]*?^1 _STROM_IMPORT R2\r?$/m, "the key of an entry not come of the import named too");
  } finally {
    w.cleanup();
  }
});

// ── the Strom app's blocks in a sync ─────────────────────────────────────────

const APP_HEAD = ["0 HEAD", "1 SOUR STROM", "2 VERS 3.26.0", "1 GEDC", "2 VERS 5.5.1", "1 CHAR UTF-8"];
const IMPORT_I1 = ["1 _STROM_IMPORT I1", "2 SOUR MyHeritage Family Tree Builder", "2 VERS 8.0", "2 DATE 12 MAR 2024", "2 FILE lhotakovi.ged", "2 _SHA 3f9a0c"];
const IMPORT_I2 = ["1 _STROM_IMPORT I2", "2 SOUR Gramps", "2 DATE 1 JAN 2025", "2 FILE druhy.ged", "2 _SHA 7b1e44"];
const HYNEK_UID = "6F2A9C1E6F2A9C1E6F2A9C1E6F2A9C1E";
const FS_TYPE = "https://www.familysearch.org/ark:/61903/4:1:";
const HYNEK = [
  "0 @I1@ INDI", "1 _STROM_IMPORT I1", "2 _XREF @I37@", `2 _UID ${HYNEK_UID}`, "2 RIN 37", "2 EXID KWCB-HZ2", `3 TYPE ${FS_TYPE}`,
  "1 _UID FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF", "1 NAME Hynek /Lhoták/", "2 _STROM_IMPORT I1", "1 SEX M", "1 BIRT", "2 DATE 1871", "2 _STROM_IMPORT I1", "1 FAMS @F1@",
];
const ZDISLAVA = ["0 @I2@ INDI", "1 _STROM_IMPORT I1", "2 _XREF @I38@", "2 _UID 5A5A5A5A5A5A5A5A5A5A5A5A5A5A5A5A", "1 NAME Zdislava /Lhotáková/", "2 _STROM_IMPORT I1", "1 SEX F", "1 FAMS @F1@"];
const RADOSLAV = ["0 @I3@ INDI", "1 NAME Radoslav /Lhoták/", "1 SEX M", "1 BIRT", "2 DATE 1902", "1 FAMC @F1@"];
const FAM = ["0 @F1@ FAM", "1 _STROM_IMPORT I1", "2 _XREF @F12@", "1 HUSB @I1@", "1 WIFE @I2@", "1 CHIL @I3@"];

/** Lhotákovi adopted from the Strom app's file with its blocks of IDs; a send of the app made of lines given. */
async function adopted(): Promise<{ w: World; send: (lines: string[], head?: string[]) => string; ids: Record<string, string> }> {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["sync", write(w, "adopt.ged", ged([...APP_HEAD, ...IMPORT_I1, ...HYNEK, ...ZDISLAVA, ...RADOSLAV, ...FAM])), "--apply", "--force"], FROM_APP);
  const tree = JSON.parse(fs.readFileSync(path.join(w.cwd, "strom.json"), "utf8")).id as string;
  const ids: Record<string, string> = { I1: one(w, "Hynek").id, I2: one(w, "Zdislava").id, I3: one(w, "Radoslav").id };
  let n = 0;
  const send = (lines: string[], head: string[] = []) =>
    write(
      w,
      `send-${++n}.ged`,
      ged([
        ...APP_HEAD, `1 _STROM_TREE ${tree}`, `1 _STROM_HEAD ${gitHead(w)}`, ...IMPORT_I1, ...head,
        ...lines.flatMap((l) => {
          const m = /^0 @(I\d+)@ INDI$/.exec(l);
          return m && ids[m[1]!] ? [l, `1 REFN ${ids[m[1]!]}`, "2 TYPE strom-research"] : [l];
        }),
      ]),
    );
  return { w, send, ids };
}

test("a sync of the app's file: its blocks kept by the import's source (never its level-1 _UID); sent again nothing; IDs alone are a change of their own, written and undone with the sync", opts, async () => {
  const { w, send, ids } = await adopted();
  try {
    const s1 = open(w).list<Source>("source").find((s) => s.imported?.key === "I1")!;
    assert.deepEqual(open(w).get<Person>(ids.I1!)!.originalIds, [
      { source: s1.id, xref: "I37", ids: [{ tag: "_UID", value: HYNEK_UID }, { tag: "RIN", value: "37" }, { tag: "EXID", value: "KWCB-HZ2", type: FS_TYPE }] },
    ]);
    assert.equal(open(w).get<Person>(ids.I3!)!.originalIds, undefined, "the user's own: none");
    const fam = open(w).list<Family>("family").find((f) => f.partners.includes(ids.I1!))!;
    assert.deepEqual(fam.originalIds, [{ source: s1.id, xref: "F12" }]);

    // the same tree sent again: nothing to take, nothing written (the bridge's "unchanged")
    const head = gitHead(w);
    const again = (await w.ok(["sync", send([...HYNEK, ...ZDISLAVA, ...RADOSLAV, ...FAM]), "--apply", "--json"], FROM_APP)).json;
    assert.deepEqual(again.changes ?? [], [], JSON.stringify(again.changes));
    assert.equal(gitHead(w), head, "nothing written");

    // only IDs new: Radoslav's of another import (not come of it), the family's RIN — a change each, nothing else
    const radoslav = [...RADOSLAV.slice(0, 1), "1 _STROM_XID I2", "2 _XREF @P5@", "2 _UID 33333333333333333333333333333333", ...RADOSLAV.slice(1)];
    const famRin = [...FAM.slice(0, 3), "2 RIN 12", ...FAM.slice(3)];
    const file = send([...HYNEK, ...ZDISLAVA, ...radoslav, ...famRin], IMPORT_I2);
    const plan = await w.ok(["sync", file, "--lang", "en"], FROM_APP);
    assert.match(plan.out, /1\. IDs of an imported family tree: Radoslav Lhoták \[P\d+\] \(I2\) → kept with them, nothing else changes/u);
    assert.match(plan.out, /2\. IDs of an imported family tree: Hynek Lhoták \[P\d+\] & Zdislava Lhotáková \[P\d+\] \(I1\)/u);
    const r = (await w.ok(["sync", file, "--apply", "--json"], FROM_APP)).json;
    assert.deepEqual((r.changes as { kind: string }[]).map((c) => c.kind), ["ids.add", "ids.add"]);
    assert.notEqual(gitHead(w), head, "written");
    const s2 = open(w).list<Source>("source").find((s) => s.imported?.key === "I2" && !s.retracted)!;
    assert.ok(s2, "the import it names: a source of its own");
    assert.deepEqual(open(w).get<Person>(ids.I3!)!.originalIds, [{ source: s2.id, xref: "P5", ids: [{ tag: "_UID", value: "33333333333333333333333333333333" }], xid: true }]);
    assert.deepEqual(open(w).get<Family>(fam.id)!.originalIds, [{ source: s1.id, xref: "F12", ids: [{ tag: "RIN", value: "12" }] }]);
    // the export gives them back, the key of each named in HEAD
    const out = exportGedcom(open(w), { for: "strom", origins: true }).text;
    assert.match(out, /^1 _STROM_XID I2\r?\n2 _XREF @P5@\r?\n2 _UID 3{32}\r?$/m);
    assert.match(out, /^0 HEAD[\s\S]*?^1 _STROM_IMPORT I2\r?$/m);
    // sent again: unchanged
    assert.deepEqual((await w.ok(["sync", send([...HYNEK, ...ZDISLAVA, ...radoslav, ...famRin], IMPORT_I2), "--json"], FROM_APP)).json.changes ?? [], []);
    // taken back: the IDs it added off
    await w.ok(["sync", "undo", r.input as string], PERSON);
    assert.equal(open(w).get<Person>(ids.I3!)!.originalIds, undefined);
    assert.deepEqual(open(w).get<Family>(fam.id)!.originalIds, [{ source: s1.id, xref: "F12" }]);
    assert.deepEqual(open(w).get<Person>(ids.I1!)!.originalIds?.length, 1, "the adoption's stay");
  } finally {
    w.cleanup();
  }
});

test("a sync: a person the app has without the research's ID, of a strong ID of one research person not in the file, is that person — never twice; one in the file stays new", opts, async () => {
  const { w, send, ids } = await adopted();
  try {
    const n = people(w).length;
    // Hynek without his REFN (the app lost it), his _UID of the import kept, his name and birth year written otherwise
    // there (no name of ours, another year: nothing else finds him): the same person
    const stranger = ["0 @I9@ INDI", "1 _STROM_IMPORT I1", "2 _XREF @I37@", `2 _UID ${HYNEK_UID.toLowerCase()}`, "1 NAME Ignác /Lhoták/", "1 SEX M", "1 BIRT", "2 DATE 1872", "1 DEAT", "2 DATE 1930", "1 FAMS @F1@"];
    const fam = FAM.map((l) => (l === "1 HUSB @I1@" ? "1 HUSB @I9@" : l));
    const r = (await w.ok(["sync", send([...stranger, ...ZDISLAVA, ...RADOSLAV, ...fam]), "--apply", "--json"], FROM_APP)).json;
    assert.equal(people(w).length, n, `nobody new: ${JSON.stringify(r.changes)}`);
    assert.ok(!(r.changes as { kind: string }[]).some((c) => c.kind === "person.new"));
    assert.ok(open(w).get<Person>(ids.I1!)!.events.some((e) => e.kind === "DEAT" && e.date === "1930"), "his new fact his");
    // Hynek in the file, and someone else with his _UID: two of the file never one of ours
    const twin = ["0 @I8@ INDI", "1 _STROM_IMPORT I1", `2 _UID ${HYNEK_UID}`, "1 NAME Hynek /Lhoták/", "1 SEX M"];
    await w.ok(["sync", send([...HYNEK, ...twin, ...ZDISLAVA, ...RADOSLAV, ...FAM]), "--apply"], FROM_APP);
    assert.equal(named(w, "Hynek").length, 2);
  } finally {
    w.cleanup();
  }
});

test("origins-1 adds the IDs of the family tree a research began with, by the refs of its people and families — no value changed; strom fixes undo origins takes them off", opts, async () => {
  const w = await intaken();
  try {
    const tree0 = open(w);
    const had = new Map([...tree0.list<Person>("person"), ...tree0.list<Family>("family")].map((r) => [r.id, r.originalIds]));
    assert.ok([...had.values()].every((x) => x?.length === 1));
    asOlder(w);
    const values = () =>
      JSON.stringify([...open(w).list<Person>("person"), ...open(w).list<Family>("family")].map((r) => ({
        id: r.id,
        events: r.events.map((e) => [e.kind, e.date, e.place, e.value]),
        ...(r.type === "person" ? { names: (r as Person).names.map((x) => [x.given, x.surname]), sex: (r as Person).sex } : { partners: (r as Family).partners }),
      })));
    const before = values();
    assert.ok(open(w).list<Person>("person").every((p) => !p.originalIds));
    assert.ok(settleOrigins(open(w)));
    assert.equal(values(), before, "no value changed");
    for (const r of [...open(w).list<Person>("person"), ...open(w).list<Family>("family")]) assert.deepEqual(r.originalIds, had.get(r.id), r.id);
    await w.ok(["fixes", "undo", "origins", "--lang", "en"], PERSON);
    assert.ok([...open(w).list<Person>("person"), ...open(w).list<Family>("family")].every((r) => !r.originalIds), "the undo takes the IDs off");
    assert.equal(values(), before);
  } finally {
    w.cleanup();
  }
});

test("a research of 1.29 before origins-1: the same tree again is known by the strong IDs its first import's file gives — nobody twice; those IDs not written, origins-1 still offers them", opts, async () => {
  const w = await intaken();
  try {
    asOlder(w);
    const before = people(w).length;
    const jan = one(w, "Jan", "Lhoták");
    const offered = async () => ((await w.ok(["fixes", "show", "origins", "--json"], AGENT)).json as { items?: unknown[]; fixes?: unknown[] });
    const was = JSON.stringify(await offered());
    assert.match(was, new RegExp(JAN_UID, "u"), "origins-1 offers the first import's IDs");
    const again = ged([
      ...MH_HEAD,
      "0 @I1@ INDI", "1 NAME Jan /Lhoták/", "1 SEX M", "1 BIRT", "2 DATE 12 MAR 1841", "1 OCCU rolník", "1 _UID 5f3b2c1a-9d8e-7f60-a1b2-c3d4e5f60718", "1 FAMS @F1@",
      "0 @I2@ INDI", "1 NAME Anna /Lhotáková/", "1 SEX F", "1 BIRT", "2 DATE 1846", `1 _UID ${ANNA_UID.toLowerCase()}`, "1 FAMS @F1@",
      "0 @I3@ INDI", "1 NAME Иван /Лхотак/", "1 SEX M", "1 _UID 9E8D7C6B5A4938271605F4E3D2C1B0A9", "1 FAMC @F1@",
      "0 @F1@ FAM", "1 HUSB @I1@", "1 WIFE @I2@", "1 CHIL @I3@", `1 _UID ${FAM_UID}`,
    ]);
    const r = await w.ok(["intake", write(w, "znovu.ged", again), "--json"], AGENT);
    assert.equal(people(w).length, before, "nobody twice");
    assert.ok(!JSON.stringify(r.json).includes('"candidates"'), JSON.stringify(r.json));
    const j = open(w).get<Person>(jan.id)!;
    assert.ok(j.events.some((e) => e.kind === "OCCU" && e.value === "rolník"), "the new fact on the person known");
    // only the new import's entry written; the first import's IDs left to origins-1 (the person's yes)
    assert.equal(j.originalIds?.length, 1);
    assert.equal(j.originalIds?.[0]?.xref, "I1");
    assert.equal(j.originalIds?.[0]?.ids?.[0]?.value, "5f3b2c1a-9d8e-7f60-a1b2-c3d4e5f60718");
    assert.ok(!open(w).config.settled?.includes(ORIGINS_SETTLED), "origins-1 not run by the intake");
    assert.match(JSON.stringify(await offered()), new RegExp(JAN_UID, "u"), "origins-1 still offers them");
  } finally {
    w.cleanup();
  }
});

test("an imported family tree in the Strom file: no PAGE of its own (a person's line of it is no reference of the tree) — each citation's line in DATA TEXT; an app's file with an older strom's first line as its PAGE no edit of the user", opts, async () => {
  const w = await intaken();
  try {
    const out = path.join(w.dir, "app.ged");
    await w.ok(["export", "gedcom", "--for", "strom", "--out", out]);
    const text = fs.readFileSync(out, "utf8");
    const s1 = open(w).list<Source>("source").find((s) => s.kind === "family-tree")!;
    assert.doesNotMatch(text, /^\d PAGE I1 BIRT$/mu, "no fact's citation says the first line of the tree");
    assert.match(text, new RegExp(`^2 SOUR @${s1.id}@\\n3 QUAY \\d\\n3 DATA\\n4 TEXT I2 BIRT$`, "mu"), text);
    assert.match(text, /^4 TEXT F1 MARR$/mu);
    // the file an older strom gave the app: the tree's first line as PAGE of every citation — sent back, nothing changes
    const head = gitHead(w);
    const older = text.replace(new RegExp(`^(\\d) SOUR @${s1.id}@$`, "gmu"), (l, n: string) => `${l}\n${Number(n) + 1} PAGE I1 BIRT`);
    assert.match(older, /PAGE I1 BIRT/u);
    const back = write(w, "back.ged", older.includes("_STROM_HEAD") ? older : older.replace(/^0 HEAD$/mu, `0 HEAD\n1 _STROM_HEAD ${head}`));
    const plan = (await w.ok(["sync", back, "--json"], FROM_APP)).json as { changes?: { kind: string }[] };
    assert.ok(!(plan.changes ?? []).some((c) => c.kind.startsWith("source.")), JSON.stringify(plan.changes));
  } finally {
    w.cleanup();
  }
});
