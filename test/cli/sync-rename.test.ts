// A person renamed in the Strom app: the name they are shown by changes as the user meant it — corrected where no
// record gives it, the user's word or a conflict for them where one does; undone, as it was. Names a sync only adds
// go last: what the app shows does not move (found on Windows: a rename added as another name, the old one shown).

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { World, hasGit } from "../helpers.ts";

const opts = { skip: !hasGit };

const ged = (lines: string[]) => [...lines, "0 TRLR", ""].join("\n");
const head0 = ["0 HEAD", "1 SOUR STROM", "1 GEDC", "2 VERS 5.5.1", "1 CHAR UTF-8"];
const people = (karel: string, marie = "Marie /Dvořáková/") => [
  "0 @I1@ INDI", `1 NAME ${karel}`, "1 SEX M", "1 BIRT", "2 DATE 1870", "1 FAMS @F1@",
  "0 @I2@ INDI", `1 NAME ${marie}`, "1 SEX F", "1 FAMS @F1@",
  "0 @I3@ INDI", "1 NAME Jan /Dvořák/", "1 SEX M", "1 BIRT", "2 DATE 1901", "1 FAMC @F1@",
  "0 @F1@ FAM", "1 HUSB @I1@", "1 WIFE @I2@", "1 CHIL @I3@",
];
const refn = (lines: string[]) => lines.flatMap((l) => {
  const m = /^0 @I(\d+)@ INDI$/.exec(l);
  return m ? [l, `1 REFN P000${m[1]}`, "2 TYPE strom-research"] : [l];
});

/** A research made from the app's tree; send() = the app's copy of it as it sends it (the research's IDs and state). */
async function adopted(marie?: string): Promise<{ w: World; send: (karel: string, marie?: string) => string }> {
  const w = new World();
  await w.withTree("Dvořákovi");
  const file = path.join(w.dir, "adopt.ged");
  fs.writeFileSync(file, ged([...head0, ...people("Karel /Dvořák/", marie)]));
  await w.ok(["sync", file, "--apply", "--force"]);
  const tree = JSON.parse(fs.readFileSync(path.join(w.cwd, "strom.json"), "utf8")).id as string;
  let n = 0;
  const send = (karel: string, m?: string) => {
    const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: w.cwd, encoding: "utf8" }).trim();
    const out = path.join(w.dir, `send-${++n}.ged`);
    fs.writeFileSync(out, ged([...head0, `1 _STROM_TREE ${tree}`, `1 _STROM_HEAD ${head}`, ...refn(people(karel, m ?? marie))]));
    return out;
  };
  return { w, send };
}

const names = async (w: World, id: string) => ((await w.ok(["person", "show", id, "--json"])).json.person.names as { given: string; surname: string }[]).map((n) => `${n.given} ${n.surname}`.trim());

test("a name no record gives, renamed in the app: corrected in place, the app shown the new one; undone, as it was", opts, async () => {
  const { w, send } = await adopted();
  const file = send("Josef /Novák/");
  const plan = (await w.ok(["sync", file, "--json"])).json.changes as { kind: string; action: string; person?: string }[];
  assert.deepEqual(plan.map((c) => [c.kind, c.action, c.person]), [["name.changed", "correct", "P0001"]], JSON.stringify(plan));
  assert.match((await w.ok(["sync", file], { tty: true })).out, /1\. Karel Dvořák \[P0001\]: změněné jméno — Karel Dvořák → Josef Novák → /);
  const input = (await w.ok(["sync", file, "--apply", "--json"])).json.input as string;
  assert.deepEqual(await names(w, "P0001"), ["Josef Novák"]);
  // what the app is given: the new name first
  const out = path.join(w.dir, "app.ged");
  await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", out]);
  assert.match(fs.readFileSync(out, "utf8"), /1 REFN P0001[\s\S]*?\n1 NAME Josef \/Novák\/|1 NAME Josef \/Novák\/[\s\S]*?1 REFN P0001/);
  // sent back unchanged: nothing
  assert.deepEqual((await w.ok(["sync", send("Josef /Novák/"), "--json"])).json.changes, []);
  await w.ok(["sync", "undo", input]);
  assert.deepEqual(await names(w, "P0001"), ["Karel Dvořák"]);
  w.cleanup();
});

test("a name a record gives, renamed in the app: a conflict for the user, their name kept beside it; sent again, nothing new", opts, async () => {
  const { w, send } = await adopted();
  const s = (await w.ok(["source", "add", "Křest Karla Dvořáka 1870", "--kind", "baptism", "--locator", "fol. 3", "--json"])).json;
  const sid = (s.id ?? s.source?.id) as string;
  await w.ok(["name", "add", "P0001", "Karel /Dvořák/", "--cite", sid]);
  const file = send("Josef /Novák/");
  const plan = (await w.ok(["sync", file, "--json"])).json.changes as { kind: string; action: string }[];
  assert.deepEqual(plan.map((c) => [c.kind, c.action]), [["name.changed", "conflict"]], JSON.stringify(plan));
  const r = (await w.ok(["sync", file, "--apply", "--json"])).json;
  assert.equal(r.conflicts.length, 1, JSON.stringify(r.conflicts));
  assert.deepEqual({ person: r.conflicts[0].person, fact: r.conflicts[0].fact }, { person: "P0001", fact: "NAME" });
  assert.deepEqual(await names(w, "P0001"), ["Karel Dvořák", "Josef Novák"], "the record's still shown, the user's last");
  assert.deepEqual((await w.ok(["sync", send("Josef /Novák/"), "--json"])).json.changes, [], "asked once");
  assert.equal((await w.ok(["conflict", "list", "--json"])).json.conflicts.length, 1);
  // renamed again: the same conflict, the user's newer word in it — never one more (found on Windows: X0003, X0004, X0005)
  const again = (await w.ok(["sync", send("Jan /Novotný/"), "--apply", "--json"])).json;
  assert.deepEqual(again.conflicts.map((x: { id: string }) => x.id), [r.conflicts[0].id], "the app hears the conflict it is about");
  const open = (await w.ok(["conflict", "list", "--json"])).json.conflicts as { id: string }[];
  assert.equal(open.length, 1);
  const claim = async () => (await w.ok(["conflict", "show", open[0]!.id, "--json"])).json.conflict.claims[1].value as string;
  assert.equal(await claim(), "Jan /Novotný/");
  // the user's earlier name gone with it: one of theirs beside the record's (found on Mac: "Anna Marie" stayed)
  assert.deepEqual(await names(w, "P0001"), ["Karel Dvořák", "Jan Novotný"]);
  await w.ok(["sync", "undo", again.input]);
  assert.equal(await claim(), "Josef /Novák/", "undone: the conflict as the send before left it");
  assert.deepEqual(await names(w, "P0001"), ["Karel Dvořák", "Josef Novák"], "undone: the user's earlier name back");
  // undone: the user's name off again, the conflict closed
  await w.ok(["sync", "undo", r.input]);
  assert.deepEqual(await names(w, "P0001"), ["Karel Dvořák"]);
  w.cleanup();
});

test("a name a record gives, renamed in the app, the user's edits winning: shown by the new name, the record's beside it; undone, as it was", opts, async () => {
  const { w, send } = await adopted();
  const s = (await w.ok(["source", "add", "Křest Karla Dvořáka 1870", "--kind", "baptism", "--locator", "fol. 3", "--json"])).json;
  await w.ok(["name", "add", "P0001", "Karel /Dvořák/", "--cite", (s.id ?? s.source?.id) as string]);
  const file = send("Josef /Novák/");
  const plan = (await w.ok(["sync", file, "--edits", "user", "--json"])).json.changes as { kind: string; action: string }[];
  assert.deepEqual(plan.map((c) => [c.kind, c.action]), [["name.changed", "user"]]);
  const input = (await w.ok(["sync", file, "--apply", "--edits", "user", "--json"])).json.input as string;
  assert.deepEqual(await names(w, "P0001"), ["Josef Novák", "Karel Dvořák"]);
  assert.equal((await w.ok(["conflict", "list", "--json"])).json.conflicts?.length ?? 0, 0);
  const undone = await w.ok(["sync", "undo", input]);
  assert.match(undone.out, /^Odebrané jméno: Josef Novák – Karel Dvořák \(\*1870\) \[P0001\]$/m, undone.out);
  assert.deepEqual(await names(w, "P0001"), ["Karel Dvořák"]);
  w.cleanup();
});

test("an archive: the user's rename wins over a record's name too", opts, async () => {
  const { w, send } = await adopted();
  const s = (await w.ok(["source", "add", "Křest Karla Dvořáka 1870", "--kind", "baptism", "--locator", "fol. 3", "--json"])).json;
  await w.ok(["name", "add", "P0001", "Karel /Dvořák/", "--cite", (s.id ?? s.source?.id) as string]);
  await w.ok(["mode", "archive"], { tty: true, answers: ["a"] });
  await w.ok(["sync", send("Josef /Novák/"), "--apply"]);
  assert.deepEqual((await names(w, "P0001"))[0], "Josef Novák");
  w.cleanup();
});

test("a name the app adds beside the one shown goes last, whatever the names: what the app shows does not move", opts, async () => {
  // shown as "Marie" (no surname): the app's second name with a surname stays second
  const { w, send } = await adopted("Marie");
  const file = send("Karel /Dvořák/", "Marie");
  const withSecond = fs.readFileSync(file, "utf8").replace("1 NAME Marie\n", "1 NAME Marie\n1 NAME Marie /Nováková/\n2 TYPE married\n");
  fs.writeFileSync(file, withSecond);
  await w.ok(["sync", file, "--apply"]);
  assert.deepEqual(await names(w, "P0002"), ["Marie", "Marie Nováková"]);
  // renamed from "Marie" to "Marie /Nováková/": the rename, not another name
  const { w: w2, send: send2 } = await adopted("Marie");
  await w2.ok(["sync", send2("Karel /Dvořák/", "Marie /Nováková/"), "--apply"]);
  assert.deepEqual(await names(w2, "P0002"), ["Marie Nováková"]);
  w.cleanup();
  w2.cleanup();
});

test("undone, a name the sync added goes even when it is the one shown; a person's only name stays", opts, async () => {
  // found on Windows: an older strom put the app's "Marie /Nováková/" in front of "Marie" — the undo said it took it off
  const { w, send } = await adopted("Marie");
  const file = send("Karel /Dvořák/", "Marie");
  fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace("1 NAME Marie\n", "1 NAME Marie\n1 NAME Marie /Nováková/\n"));
  const input = (await w.ok(["sync", file, "--apply", "--json"])).json.input as string;
  await w.ok(["name", "add", "P0002", "Marie /Nováková/", "--primary"]);
  assert.deepEqual(await names(w, "P0002"), ["Marie Nováková", "Marie"]);
  const undone = await w.ok(["sync", "undo", input]);
  // the line says which name goes, and whose (found on Windows: the person only, not the name)
  assert.match(undone.out, /^Odebrané jméno: Marie Nováková – Marie \[P0002\]$/m, undone.out);
  assert.deepEqual(await names(w, "P0002"), ["Marie"]);
  w.cleanup();
});

test("undone, a child the sync added to a family of the research goes off it again", opts, async () => {
  const { w, send } = await adopted();
  const file = send("Karel /Dvořák/");
  fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace("1 CHIL @I3@\n", "1 CHIL @I3@\n1 CHIL @I4@\n").replace("0 TRLR", "0 @I4@ INDI\n1 NAME Anna /Dvořáková/\n1 SEX F\n1 FAMC @F1@\n0 TRLR"));
  const input = (await w.ok(["sync", file, "--apply", "--json"])).json.input as string;
  assert.equal((await w.ok(["family", "show", "F0001", "--json"])).json.family.children.length, 2);
  await w.ok(["sync", "undo", input]);
  assert.equal((await w.ok(["family", "show", "F0001", "--json"])).json.family.children.length, 1);
  w.cleanup();
});

test("the history of an undo says which note goes, and whose", opts, async () => {
  const { w, send } = await adopted();
  const file = send("Karel /Dvořák/");
  fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace("1 NAME Karel /Dvořák/\n", "1 NAME Karel /Dvořák/\n1 NOTE Mlynář v Týnci, \"U Dvořáků\"\n"));
  const input = (await w.ok(["sync", file, "--apply", "--json"])).json.input as string;
  const undone = await w.ok(["sync", "undo", input]);
  assert.match(undone.out, /^Odebraná poznámka: „Mlynář v Týnci, 'U Dvořáků'“ – Karel Dvořák \(\*1870\) \[P0001\]$/m, undone.out);
  w.cleanup();
});

test("renamed twice in a day by the app, no record giving the name: each written and said so, each undone (found on Windows: the second said left out, undo of it nothing)", opts, async () => {
  const { w, send } = await adopted();
  const info = (await w.ok(["live", "start", "--json"])).json;
  const post = async (file: string) => {
    const res = await fetch(`${info.url}/sync`, { method: "POST", body: fs.readFileSync(file, "utf8"), headers: { Origin: "https://beta.stromapp.info", "Content-Type": "text/plain; charset=utf-8" } });
    return (await res.json()) as Record<string, any>;
  };
  try {
    // the day's one source of the app's edits: the second rename cites it already
    assert.equal((await post(send("Josef /Novák/"))).applied, 1);
    const second = await post(send("Jiří /Novák/"));
    assert.deepEqual([second.applied, second.skipped], [1, undefined], JSON.stringify(second));
    assert.deepEqual(await names(w, "P0001"), ["Jiří Novák"]);
    const undone = await w.ok(["sync", "undo", second.input], { tty: true });
    assert.doesNotMatch(undone.out, /\?/, undone.out);
    assert.deepEqual(await names(w, "P0001"), ["Josef Novák"]);
  } finally {
    await w.ok(["live", "stop"]);
  }
  w.cleanup();
});

test("the sex the user set in the app: written where no record gives the person's facts, a conflict for them where one does", opts, async () => {
  const { w, send } = await adopted();
  const withSex = (file: string, who: string, sex: string) => {
    const text = fs.readFileSync(file, "utf8").replace(new RegExp(`(1 REFN ${who}\\n2 TYPE strom-research\\n1 NAME [^\\n]+\\n)1 SEX [MFU]`), `$11 SEX ${sex}`);
    fs.writeFileSync(file, text);
    return file;
  };
  // no record: written
  const plain = (await w.ok(["sync", withSex(send("Karel /Dvořák/"), "P0002", "M"), "--apply", "--json"])).json;
  assert.deepEqual(plain.changes.map((c: { kind: string; action: string }) => [c.kind, c.action]), [["sex.changed", "correct"]]);
  assert.equal((await w.ok(["person", "show", "P0002", "--json"])).json.person.sex, "M");
  // a record of Karel's baptism: the user decides
  const s = (await w.ok(["source", "add", "Křest Karla Dvořáka 1870", "--kind", "baptism", "--locator", "fol. 3", "--json"])).json;
  await w.ok(["event", "add", "P0001", "CHR", "--date", "1870", "--cite", (s.id ?? s.source?.id) as string, "--status", "probable"]);
  const backed = (await w.ok(["sync", withSex(send("Karel /Dvořák/"), "P0001", "F"), "--apply", "--json"])).json;
  assert.equal(backed.conflicts.length, 1, JSON.stringify(backed));
  assert.equal(backed.conflicts[0].fact, "SEX");
  assert.equal((await w.ok(["person", "show", "P0001", "--json"])).json.person.sex, "M", "the record's kept meanwhile");
  // its title in the research's language, as the Strom app shows it (found on Mac: "SEX — U × F")
  const listed = (await w.ok(["conflict", "list"])).out;
  assert.match(listed, /Karel Dvořák: Pohlaví — muž × žena/, listed);
  w.cleanup();
});

test("a conflict of a name or a sex the user gave in the app: --take user writes theirs, --take research keeps the record's (found on Mac: --take refused for them)", opts, async () => {
  const { w, send } = await adopted();
  const s = (await w.ok(["source", "add", "Křest Karla Dvořáka 1870", "--kind", "baptism", "--locator", "fol. 3", "--json"])).json;
  const sid = (s.id ?? s.source?.id) as string;
  await w.ok(["name", "add", "P0001", "Karel /Dvořák/", "--cite", sid]);
  await w.ok(["event", "add", "P0001", "CHR", "--date", "1870", "--cite", sid, "--status", "probable"]);
  const file = send("Josef /Novák/");
  fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace(/(1 REFN P0001\n2 TYPE strom-research\n1 NAME [^\n]+\n)1 SEX M/, "$11 SEX F"));
  const r = (await w.ok(["sync", file, "--apply", "--json"])).json;
  const by = Object.fromEntries((r.conflicts as { id: string; fact: string }[]).map((c) => [c.fact, c.id]));
  assert.deepEqual(Object.keys(by).sort(), ["NAME", "SEX"], JSON.stringify(r.conflicts));
  // the user's name shown, the record's beside it
  const name = (await w.ok(["conflict", "resolve", by.NAME!, "--take", "user", "--reasoning", "the family knows him so", "--json"])).json;
  assert.equal(name.taken, "user");
  assert.deepEqual(await names(w, "P0001"), ["Josef Novák", "Karel Dvořák"]);
  // the record's sex kept
  const sex = (await w.ok(["conflict", "resolve", by.SEX!, "--take", "research", "--reasoning", "the baptism says a son", "--json"])).json;
  assert.equal(sex.taken, "research");
  assert.equal((await w.ok(["person", "show", "P0001", "--json"])).json.person.sex, "M");
  assert.equal((await w.ok(["conflict", "list", "--json"])).json.conflicts.length, 0);
  w.cleanup();
});

test("a conflict of the sex the user gave in the app: --take user writes it", opts, async () => {
  const { w, send } = await adopted();
  const s = (await w.ok(["source", "add", "Křest Karla Dvořáka 1870", "--kind", "baptism", "--locator", "fol. 3", "--json"])).json;
  await w.ok(["event", "add", "P0001", "CHR", "--date", "1870", "--cite", (s.id ?? s.source?.id) as string, "--status", "probable"]);
  const file = send("Karel /Dvořák/");
  fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace(/(1 REFN P0001\n2 TYPE strom-research\n1 NAME [^\n]+\n)1 SEX M/, "$11 SEX F"));
  const x = (await w.ok(["sync", file, "--apply", "--json"])).json.conflicts[0] as { id: string; fact: string };
  assert.equal(x.fact, "SEX");
  await w.ok(["conflict", "resolve", x.id, "--take", "user", "--reasoning", "the family's word"]);
  assert.equal((await w.ok(["person", "show", "P0001", "--json"])).json.person.sex, "F");
  w.cleanup();
});

test("an undo that takes a citation off says it in the research's language (found on Mac: \"E0013 cites no more S0007: sync I0014 undone\")", opts, async () => {
  const { w, send } = await adopted();
  const file = send("Karel /Dvořák/");
  // the app cites a new source of its own at Karel's birth
  const text = fs.readFileSync(file, "utf8").replace(/(1 REFN P0001\n[\s\S]*?1 BIRT\n2 DATE 1870\n)/, "$12 SOUR @S9@\n3 PAGE fol. 16\n").replace("0 TRLR", "0 @S9@ SOUR\n1 TITL Křest Karla Dvořáka 1870\n0 TRLR");
  fs.writeFileSync(file, text);
  const r = (await w.ok(["sync", file, "--apply", "--json"])).json;
  const undo = await w.ok(["sync", "undo", r.input, "--dry-run"]);
  assert.doesNotMatch(undo.out, /cites no more/, undo.out);
  assert.match(undo.out, /Doklad odebrán: Karel Dvořák \(\*1870\) \[P0001\] – narození: 1870/, undo.out);
  w.cleanup();
});

test("the sex and the name changed in the app and by the research since the copy was given: a conflict for the user each, never lost in silence, decided with --take (found on Mac: Erik M → F in the app, U in the research, nothing written, nothing said)", opts, async () => {
  const { w, send } = await adopted();
  // the copy the app was given: Karel, a man
  const file = send("Jaroslav /Dvořák/");
  // the research since: his sex unknown, his name read otherwise
  await w.ok(["person", "edit", "P0001", "--sex", "U", "--reason", "the entry does not say"]);
  await w.ok(["person", "edit", "P0001", "--name", "Karel /Dvořáček/", "--reason", "the register has Dvořáček"]);
  // the user in the app: a woman, Jaroslav
  fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace(/(1 REFN P0001\n2 TYPE strom-research\n1 NAME [^\n]+\n)1 SEX M/, "$11 SEX F"));
  const r = (await w.ok(["sync", file, "--apply", "--json"])).json;
  const by = Object.fromEntries((r.conflicts as { id: string; fact: string }[]).map((c) => [c.fact, c.id]));
  assert.deepEqual(Object.keys(by).sort(), ["NAME", "SEX"], JSON.stringify(r.changes));
  assert.equal((await w.ok(["person", "show", "P0001", "--json"])).json.person.sex, "U", "the research's kept meanwhile");
  assert.deepEqual(await names(w, "P0001"), ["Karel Dvořáček", "Jaroslav Dvořák"], "the user's name beside, the research's shown");
  await w.ok(["conflict", "resolve", by.SEX!, "--take", "user", "--reasoning", "the family knows"]);
  await w.ok(["conflict", "resolve", by.NAME!, "--take", "user", "--reasoning", "the family knows"]);
  assert.equal((await w.ok(["person", "show", "P0001", "--json"])).json.person.sex, "F");
  assert.deepEqual(await names(w, "P0001"), ["Jaroslav Dvořák", "Karel Dvořáček"]);
  // its conflicts named by the name the person is shown by now (found on Mac: "Jon Berg: BIRT…" after a rename)
  const list = (await w.ok(["conflict", "list", "--all"])).out;
  assert.match(list, /Jaroslav Dvořák: Pohlaví/, list);
  assert.doesNotMatch(list, /Karel Dvořáček: Pohlaví/, list);
  w.cleanup();
});

test("a sex the research does not know, guessed by the app and set otherwise there: the user's edit, theirs to decide — a conflict, record or none; the app's own guess is no edit (found on Mac: Petr U, guessed male, set female, \"changes 0\")", opts, async () => {
  const w = new World();
  await w.withTree("Dvořákovi");
  const lines = (petr: string, eva: string) => [
    "0 @I1@ INDI", "1 NAME Petr /Novák/", `1 SEX ${petr}`, "1 FAMS @F1@",
    "0 @I2@ INDI", "1 NAME Marie /Nováková/", "1 SEX F", "1 FAMS @F1@",
    "0 @I3@ INDI", "1 NAME Eva /Malá/", `1 SEX ${eva}`, "1 BIRT", "2 DATE 1901",
    "0 @F1@ FAM", "1 HUSB @I1@", "1 WIFE @I2@",
  ];
  const adopt = path.join(w.dir, "adopt.ged");
  fs.writeFileSync(adopt, ged([...head0, ...lines("U", "U")]));
  await w.ok(["sync", adopt, "--apply", "--force"]);
  const sex = async (id: string) => (await w.ok(["person", "show", id, "--json"])).json.person.sex as string;
  assert.deepEqual([await sex("P0001"), await sex("P0003")], ["U", "U"]);
  const tree = JSON.parse(fs.readFileSync(path.join(w.cwd, "strom.json"), "utf8")).id as string;
  let n = 0;
  const send = (petr: string, eva: string) => {
    const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: w.cwd, encoding: "utf8" }).trim();
    const out = path.join(w.dir, `send-${++n}.ged`);
    fs.writeFileSync(out, ged([...head0, `1 _STROM_TREE ${tree}`, `1 _STROM_HEAD ${head}`, ...refn(lines(petr, eva))]));
    return out;
  };
  // the app's guesses (a husband male, anyone else female): nothing
  const guessed = (await w.ok(["sync", send("M", "F"), "--json"])).json.changes as { kind: string }[];
  assert.deepEqual(guessed.filter((c) => c.kind === "sex.changed"), [], JSON.stringify(guessed));
  // Petr set female in the app, no record of his: the user decides (Milan, 2026-10-04), the research's unknown kept
  const petr = (await w.ok(["sync", send("F", "F"), "--apply", "--json"])).json;
  assert.deepEqual(petr.changes.map((c: { kind: string; action: string; person: string }) => [c.kind, c.action, c.person]), [["sex.changed", "conflict", "P0001"]]);
  assert.equal(petr.conflicts.length, 1, JSON.stringify(petr));
  assert.equal(await sex("P0001"), "U");
  assert.match((await w.ok(["conflict", "show", petr.conflicts[0].id])).out, /Petr Novák: Pohlaví — neznámé × žena[\s\S]*\s neznámé$[\s\S]*: žena$/m);
  // Eva set male, a record of her baptism: the same
  const s = (await w.ok(["source", "add", "Křest Evy Malé 1901", "--kind", "baptism", "--locator", "fol. 9", "--json"])).json;
  await w.ok(["event", "add", "P0003", "CHR", "--date", "1901", "--cite", (s.id ?? s.source?.id) as string, "--status", "probable"]);
  const eva = (await w.ok(["sync", send("F", "M"), "--apply", "--json"])).json;
  assert.equal(eva.conflicts.filter((c: { person?: string }) => c.person === "P0003").length, 1, JSON.stringify(eva));
  assert.equal(await sex("P0003"), "U");
  const shown = (await w.ok(["conflict", "show", eva.conflicts.find((c: { person?: string }) => c.person === "P0003").id])).out;
  assert.match(shown, /Eva Malá: Pohlaví — neznámé × muž/, shown);
  assert.match(shown, /: muž$/m, shown);
  assert.doesNotMatch(shown, /^\S+\s+(?:\S+: )?[MFU]$/m, shown);
  w.cleanup();
});

test("a file that writes SEX U where the research's unknown stands (_STROM_SEX_U Y; the app's JSON research.sexU): U no change, a sex there the user's edit — a conflict, whatever the app would have guessed (the app's beta.61: it keeps the sex of its own tree, it guesses no more)", opts, async () => {
  const w = new World();
  await w.withTree("Dvořákovi");
  const lines = (petr: string, eva: string) => [
    "0 @I1@ INDI", "1 NAME Petr /Novák/", `1 SEX ${petr}`, "1 FAMS @F1@",
    "0 @I2@ INDI", "1 NAME Marie /Nováková/", "1 SEX F", "1 FAMS @F1@",
    "0 @I3@ INDI", "1 NAME Eva /Malá/", `1 SEX ${eva}`, "1 BIRT", "2 DATE 1901",
    "0 @F1@ FAM", "1 HUSB @I1@", "1 WIFE @I2@",
  ];
  const adopt = path.join(w.dir, "adopt.ged");
  fs.writeFileSync(adopt, ged([...head0, ...lines("U", "U")]));
  await w.ok(["sync", adopt, "--apply", "--force"]);
  const tree = JSON.parse(fs.readFileSync(path.join(w.cwd, "strom.json"), "utf8")).id as string;
  const head = () => execFileSync("git", ["rev-parse", "HEAD"], { cwd: w.cwd, encoding: "utf8" }).trim();
  const sexes = (r: { changes: { kind: string; action: string; person: string }[] }) => r.changes.filter((c) => c.kind === "sex.changed").map((c) => [c.action, c.person]);
  let n = 0;
  const send = (petr: string, eva: string) => {
    const out = path.join(w.dir, `send-${++n}.ged`);
    fs.writeFileSync(out, ged([...head0, `1 _STROM_TREE ${tree}`, `1 _STROM_HEAD ${head()}`, "1 _STROM_SEX_U Y", ...refn(lines(petr, eva))]));
    return out;
  };
  assert.deepEqual(sexes((await w.ok(["sync", send("U", "U"), "--json"])).json), [], "the unknown as it stands");
  // Petr set male: an older app's own guess for a husband, here the user's edit
  assert.deepEqual(sexes((await w.ok(["sync", send("M", "U"), "--json"])).json), [["conflict", "P0001"]]);
  // the app's JSON the same way: research.sexU, the person's sexUnknown beside the app's stand-in gender
  const json = (petr: { gender: string; sexUnknown?: boolean }, eva: { gender: string; sexUnknown?: boolean }) => {
    const out = path.join(w.dir, `send-${++n}.json`);
    fs.writeFileSync(out, JSON.stringify({
      version: 11,
      research: { id: tree, head: head(), sexU: true },
      persons: {
        a: { id: "a", firstName: "Petr", lastName: "Novák", refn: "P0001", parentIds: [], ...petr },
        b: { id: "b", firstName: "Marie", lastName: "Nováková", refn: "P0002", gender: "female", parentIds: [] },
        c: { id: "c", firstName: "Eva", lastName: "Malá", refn: "P0003", birthDate: "1901", parentIds: [], ...eva },
      },
      partnerships: { u: { person1Id: "a", person2Id: "b", childIds: [], status: "married" } },
    }));
    return out;
  };
  assert.deepEqual(sexes((await w.ok(["sync", json({ gender: "male", sexUnknown: true }, { gender: "female", sexUnknown: true }), "--json"])).json), []);
  assert.deepEqual(sexes((await w.ok(["sync", json({ gender: "male", sexUnknown: true }, { gender: "female" }), "--json"])).json), [["conflict", "P0003"]]);
  w.cleanup();
});
