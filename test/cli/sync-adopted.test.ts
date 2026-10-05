// The Strom app after it handed a tree over (strom-research://new, ?adopt=): it keeps its own copy, without the
// research's IDs, and sends it linked to the research's head. Found on Windows (rc.7): a person renamed there came as
// a new one, with a "new family" of a child who has parents — the whole send refused. Now the renamed one is known by
// the place they take, and one change the research cannot write is left out, said, the rest written.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { World, hasGit } from "../helpers.ts";

const opts = { skip: !hasGit };

const ged = (lines: string[]) => [...lines, "0 TRLR", ""].join("\n");
const people = (marie: string, extra: string[] = []) => [
  "0 @I1@ INDI", "1 NAME Karel /Dvořák/", "1 SEX M", "1 BIRT", "2 DATE 1870", "1 FAMS @F1@",
  "0 @I2@ INDI", `1 NAME ${marie}`, "1 SEX F", "1 FAMS @F1@",
  "0 @I3@ INDI", "1 NAME Jan /Dvořák/", "1 SEX M", "1 BIRT", "2 DATE 1901", "1 FAMC @F1@",
  ...extra,
  "0 @F1@ FAM", "1 HUSB @I1@", "1 WIFE @I2@", "1 CHIL @I3@", "1 MARR", "2 DATE 1899",
];

async function adopted(): Promise<{ w: World; send: (lines: string[]) => string }> {
  const w = new World();
  await w.withTree("Dvořákovi");
  const file = path.join(w.dir, "adopt.ged");
  fs.writeFileSync(file, ged(["0 HEAD", "1 SOUR STROM", "1 GEDC", "2 VERS 5.5.1", "1 CHAR UTF-8", ...people("Marie /Dvořáková/")]));
  await w.ok(["sync", file, "--apply", "--force"]);
  const tree = JSON.parse(fs.readFileSync(path.join(w.cwd, "strom.json"), "utf8")).id as string;
  const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: w.cwd, encoding: "utf8" }).trim();
  // the app's copy, as it sends it: its own xrefs, no REFN of ours, linked to the research
  const send = (body: string[]) => {
    const out = path.join(w.dir, `send-${Date.now()}.ged`);
    fs.writeFileSync(out, ged(["0 HEAD", "1 SOUR STROM", "1 GEDC", "2 VERS 5.5.1", "1 CHAR UTF-8", `1 _STROM_TREE ${tree}`, `1 _STROM_HEAD ${head}`, ...body]));
    return out;
  };
  return { w, send };
}

test("the app's own copy of a tree it handed over: a person renamed there is the research's, known by the place they take", opts, async () => {
  const { w, send } = await adopted();
  const plan = (await w.ok(["sync", send(people("Мария /Dvořáková/")), "--json"])).json.changes as { kind: string; person?: string }[];
  assert.deepEqual(plan.map((c) => [c.kind, c.person]), [["name.changed", "P0002"]], JSON.stringify(plan));
  w.cleanup();
});

test("a child given other parents in the app: a conflict for the user, the rest of the send written", opts, async () => {
  const { w, send } = await adopted();
  // a new man as Jan's father beside Marie (Jan has his parents: the user decides), and Karel's occupation (written)
  const file = send([
    ...people("Marie /Dvořáková/", ["0 @I4@ INDI", "1 NAME Josef /Novák/", "1 SEX M", "1 FAMS @F2@"]),
    "0 @F2@ FAM", "1 HUSB @I4@", "1 WIFE @I2@", "1 CHIL @I3@",
  ].map((l) => (l === "1 NAME Karel /Dvořák/" ? "1 NAME Karel /Dvořák/\n1 OCCU kovář" : l)));
  const r = (await w.ok(["sync", file, "--apply", "--json"])).json;
  assert.deepEqual(r.skipped ?? [], []);
  assert.deepEqual(r.conflicts.map((x: { person: string; fact: string }) => [x.person, x.fact]), [["P0003", "FAMC"]]);
  const karel = (await w.ok(["person", "show", "P0001", "--json"])).json.person;
  assert.ok(karel.events.some((e: { kind: string; value?: string }) => e.kind === "OCCU" && e.value === "kovář"), "the rest written");
  w.cleanup();
});

test("one change the research cannot write is left out and said; the rest of the send is written", opts, async () => {
  const { w, send } = await adopted();
  // a man the app made his own child (no family can hold that), and Karel's occupation (written)
  const body = [
    ...people("Marie /Dvořáková/", ["0 @I4@ INDI", "1 NAME Josef /Novák/", "1 SEX M", "1 FAMS @F2@", "1 FAMC @F2@"]),
    "0 @F2@ FAM", "1 HUSB @I4@", "1 CHIL @I4@",
  ].map((l) => (l === "1 NAME Karel /Dvořák/" ? "1 NAME Karel /Dvořák/\n1 OCCU kovář" : l));
  const r = await w.ok(["sync", send(body), "--apply", "--json"]);
  assert.equal(r.json.skipped?.length, 1, JSON.stringify(r.json.skipped));
  assert.match(r.json.skipped[0].why, /listed twice/);
  const karel = (await w.ok(["person", "show", "P0001", "--json"])).json.person;
  assert.ok(karel.events.some((e: { kind: string; value?: string }) => e.kind === "OCCU" && e.value === "kovář"), "the rest written");
  // said to the person too (another send: the same file is loaded once)
  assert.match((await w.ok(["sync", send(body.map((l) => l.replace("kovář", "kolář"))), "--apply"])).out, /Change \d+ not written: |Změna \d+ se nezapsala: /);
  w.cleanup();
});

test("a copy of the app linked to the research but without its IDs, its people with no dates (no way to know them): refused, never written as another tree beside them", opts, async () => {
  const w = new World();
  await w.withTree("Test");
  const tree = JSON.parse(fs.readFileSync(path.join(w.cwd, "strom.json"), "utf8")).id as string;
  const body = (one: string) => [
    "0 @I1@ INDI", `1 NAME ${one}`, "1 SEX M", "1 FAMS @F1@",
    "0 @I2@ INDI", "1 NAME 2", "1 SEX F", "1 FAMS @F1@",
    "0 @I3@ INDI", "1 NAME 3", "1 SEX M", "1 FAMC @F1@",
    "0 @F1@ FAM", "1 HUSB @I1@", "1 WIFE @I2@", "1 CHIL @I3@",
  ];
  const head0 = ["0 HEAD", "1 SOUR STROM", "1 GEDC", "2 VERS 5.5.1", "1 CHAR UTF-8"];
  const adopt = path.join(w.dir, "adopt.ged");
  fs.writeFileSync(adopt, ged([...head0, ...body("1")]));
  await w.ok(["sync", adopt, "--apply", "--force"]);
  const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: w.cwd, encoding: "utf8" }).trim();
  const send = path.join(w.dir, "send.ged");
  fs.writeFileSync(send, ged([...head0, `1 _STROM_TREE ${tree}`, `1 _STROM_HEAD ${head}`, ...body("jedna")]));
  const r = await w.run(["sync", send, "--apply", "--json"]);
  assert.equal(r.code, 2, r.out);
  assert.equal(r.json.code, "tree.no-ids");
  assert.deepEqual(r.json.params, { kept: "0", people: "3" });
  assert.equal(execFileSync("git", ["rev-parse", "HEAD"], { cwd: w.cwd, encoding: "utf8" }).trim(), head, "nothing written");
  assert.equal((await w.ok(["person", "list", "--json"])).json.total, 3);
  // the same copy not saying which state it had (no _STROM_HEAD): against the research now, refused the same
  const headless = path.join(w.dir, "headless.ged");
  fs.writeFileSync(headless, ged([...head0, `1 _STROM_TREE ${tree}`, ...body("jedna")]));
  const r0 = await w.run(["sync", headless, "--apply", "--json"]);
  assert.equal(r0.code, 2, r0.out);
  assert.equal(r0.json.code, "tree.no-ids");
  assert.deepEqual(r0.json.params, { kept: "0", people: "3" });
  // a person at the terminal of a Czech research reads it in Czech, what to do too; a program the code and English
  await w.ok(["lang", "cs"]);
  const cs = await w.run(["sync", send, "--apply"], { tty: true });
  assert.equal(cs.code, 2);
  assert.match(cs.err, /^chyba: kopie stromu z aplikace Strom nese jen 0 z 3 osob výzkumu podle jejich čísel/m, cs.err);
  assert.match(cs.err, /^→ načíst výzkum v aplikaci znovu \(jeho tree\.ged\)/m, cs.err);
  assert.doesNotMatch(cs.err, /carries|load the research/, cs.err);
  const program = await w.run(["sync", send, "--apply", "--json"]);
  assert.equal(program.json.code, "tree.no-ids");
  assert.match(program.json.message, /^the Strom app's copy carries 0 of the research's 3 people/);
  assert.match(program.json.hint, /^load the research in the app again/);
  // another research's file, an empty one: the same
  const other = path.join(w.dir, "other.ged");
  fs.writeFileSync(other, ged([...head0, "1 _STROM_TREE 00000000-0000-4000-8000-000000000000", ...body("1")]));
  const foreign = await w.run(["sync", other]);
  assert.match(foreign.err, /^chyba: tento soubor patří jinému výzkumu \(00000000-0000-4000-8000-000000000000\), ne výzkumu „Test“$/m, foreign.err);
  assert.match(foreign.err, /^→ otevřít ten výzkum, nebo soubor přidat jako vodítka: strom intake <soubor>$/m, foreign.err);
  const empty = path.join(w.dir, "empty.ged");
  fs.writeFileSync(empty, "  \n");
  assert.match((await w.run(["sync", empty])).err, /^chyba: soubor je prázdný, nejsou v něm žádné osoby$/m);
  assert.match((await w.run(["sync", empty, "--lang", "en"])).err, /^error: empty\.ged is empty$/m, "English: the message itself");
  // through the bridge, as the app sends it: refused, said as a program reads it
  const started = await w.ok(["live", "start"]);
  assert.match(started.out, /^most běží: http:\/\/127\.0\.0\.1:\d+\/\S+\n  aplikace Strom ho sleduje na adrese: /, started.out);
  const info = (await w.ok(["live", "start", "--json"])).json;
  try {
    const res = await fetch(`${info.url}/sync`, { method: "POST", body: fs.readFileSync(send, "utf8"), headers: { Origin: "https://beta.stromapp.info", "Content-Type": "text/plain; charset=utf-8" } });
    const got = (await res.json()) as { code: string; error: string };
    assert.equal(res.status, 400);
    assert.equal(got.code, "tree.no-ids");
    // what came is kept aside, to see later what the app sent
    const kept = fs.readdirSync(path.join(w.cwd, ".strom", "sync", "kept"));
    assert.ok(kept.some((f) => /^refused-strom-app-.*\.ged$/.test(f)), kept.join(", "));
    assert.match((got as { keptAs?: string }).keptAs ?? "", /^kept\/refused-strom-app-.*\.ged$/);
    // the research keeps a trace of it: one line of how it went, its code and where what came is
    // (written once the app has its answer: waited for)
    let log = "";
    for (let i = 0; i < 50 && !/sync → 400/.test(log); i++) {
      if (i) await new Promise((ok) => setTimeout(ok, 100));
      log = fs.readFileSync(path.join(w.cwd, ".strom", "live.log"), "utf8");
    }
    assert.match(log, /POST \/…\/sync → 400 · code tree\.no-ids, keptAs kept\/refused-strom-app-\S+\.ged · this copy of the tree does not carry the research's people/, log);
    assert.doesNotMatch(log, new RegExp(info.url.split("/").pop()), "never its secret");
  } finally {
    assert.equal((await w.ok(["live", "stop"])).out.trim(), "most se zastavil");
  }
  assert.equal((await w.ok(["live"])).out.trim(), "most neběží – strom live start (nebo strom app --live)");
  assert.equal((await w.ok(["person", "list", "--json"])).json.total, 3, "nothing written");
  w.cleanup();
});

test("a sync taken back: the people it brought are withdrawn, and what a person is told there are counts only those that stand", opts, async () => {
  const { w } = await adopted();
  await w.ok(["lang", "cs"]);
  // a person at the terminal: the sentence in the research's language, no English lines of the operations
  // an agent's session (no terminal): what it does line by line, in the research's language too, records by name
  const dry = await w.ok(["sync", "undo", "I0001", "--dry-run"]);
  assert.doesNotMatch(dry.out, /retracted|undone|step\(s\)/, dry.out);
  assert.match(dry.out, /^Odvoláno: Karel Dvořák \[P0001\]$/m, dry.out);
  assert.match(dry.out, /^Vrácený rodokmen: /m, dry.out);
  const undone = await w.ok(["sync", "undo", "I0001"], { tty: true });
  assert.doesNotMatch(undone.out, /retracted|undone:/, undone.out);
  assert.match(undone.out, /I0001/);
  assert.equal((await w.ok(["--json"])).json.tree.persons, 0);
  assert.equal((await w.ok(["trees", "--json"])).json.trees[0].persons, 0);
  // the list of the trees in the person's language too
  assert.match((await w.ok(["trees"])).out, /^Dvořákovi\s+cs\s+osob: 0\s+směrů výzkumu: 0\s/m);
  const none = await w.run(["trees", "use", "Neexistuje X"]);
  assert.equal(none.err, "chyba: žádný rodokmen „Neexistuje X“ tu není\n→ rodokmeny, které tu jsou: strom trees\n");
  assert.deepEqual((await w.run(["trees", "use", "Neexistuje X", "--json"])).json, { status: "error", message: 'no tree "Neexistuje X"', hint: "strom trees", code: "tree.unknown", params: { name: "Neexistuje X" } });
  w.cleanup();
});

const refn = (lines: string[]) => lines.flatMap((l) => {
  const m = /^0 @I(\d+)@ INDI$/.exec(l);
  return m ? [l, `1 REFN P000${m[1]}`, "2 TYPE strom-research"] : [l];
});

test("the app's copy of this research carrying its IDs: its people are the research's whatever their names — one letter or digit, renamed", opts, async () => {
  // found on Windows: people named "1", "2", "3", "1" renamed in the app — all taken for strangers, the send refused
  const w = new World();
  await w.withTree("Test");
  const tree = JSON.parse(fs.readFileSync(path.join(w.cwd, "strom.json"), "utf8")).id as string;
  const body = (one: string) => [
    "0 @I1@ INDI", `1 NAME ${one}`, "1 SEX M", "1 FAMS @F1@",
    "0 @I2@ INDI", "1 NAME 2", "1 SEX F", "1 FAMS @F1@",
    "0 @I3@ INDI", "1 NAME 3", "1 SEX M", "1 FAMC @F1@",
    "0 @F1@ FAM", "1 HUSB @I1@", "1 WIFE @I2@", "1 CHIL @I3@",
  ];
  const head0 = ["0 HEAD", "1 SOUR STROM", "1 GEDC", "2 VERS 5.5.1", "1 CHAR UTF-8"];
  const adopt = path.join(w.dir, "adopt.ged");
  fs.writeFileSync(adopt, ged([...head0, ...body("1")]));
  await w.ok(["sync", adopt, "--apply", "--force"]);
  const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: w.cwd, encoding: "utf8" }).trim();
  const send = (one: string) => {
    const out = path.join(w.dir, `send-${one}.ged`);
    fs.writeFileSync(out, ged([...head0, `1 _STROM_TREE ${tree}`, `1 _STROM_HEAD ${head}`, ...refn(body(one))]));
    return out;
  };
  assert.deepEqual((await w.ok(["sync", send("1"), "--json"])).json.changes, [], "unchanged: nothing");
  // a file of no research with those IDs: the same names, one letter or digit, are the research's people too
  const plain = path.join(w.dir, "plain.ged");
  fs.writeFileSync(plain, ged([...head0, ...refn(body("1"))]));
  assert.deepEqual((await w.ok(["sync", plain, "--json"])).json.changes, [], "the same names: ours");
  const plan = (await w.ok(["sync", send("jedna"), "--json"])).json.changes as { kind: string; person?: string }[];
  assert.deepEqual(plan.map((c) => [c.kind, c.person]), [["name.changed", "P0001"]], JSON.stringify(plan));
  await w.ok(["sync", send("jedna"), "--apply"]);
  assert.equal((await w.ok(["person", "list", "--json"])).json.total, 3, "no one twice");
  w.cleanup();
});

test("a person renamed in the app, the file carrying the research's ID and tree: the same person, renamed", opts, async () => {
  const { w, send } = await adopted();
  // renamed and born another year: by the ID alone (no place in the family would tell)
  const file = send(refn(people("Marie /Dvořáková/")).map((l) => (l === "1 NAME Karel /Dvořák/" ? "1 NAME Josef /Novák/" : l === "2 DATE 1870" ? "2 DATE 1871" : l)));
  const plan = (await w.ok(["sync", file, "--json"])).json.changes as { kind: string; person?: string }[];
  assert.ok(plan.some((c) => c.kind === "name.changed" && c.person === "P0001"), JSON.stringify(plan));
  assert.ok(plan.every((c) => c.person === "P0001" && c.kind !== "person.new"), JSON.stringify(plan));
  await w.ok(["sync", file, "--apply"]);
  assert.equal((await w.ok(["person", "list", "--json"])).json.total, 3, "no one twice");
  w.cleanup();
});

test("a file of no research carrying our ID on someone else's name: that one is a newcomer, never our person renamed", opts, async () => {
  const { w } = await adopted();
  const file = path.join(w.dir, "other.ged");
  // another man (born another year: not one in Karel's place either), with Karel's ID
  const body = refn(people("Marie /Dvořáková/")).map((l) => (l === "1 NAME Karel /Dvořák/" ? "1 NAME Josef /Novák/" : l === "2 DATE 1870" ? "2 DATE 1850" : l));
  fs.writeFileSync(file, ged(["0 HEAD", "1 SOUR OTHER", "1 GEDC", "2 VERS 5.5.1", "1 CHAR UTF-8", ...body]));
  const plan = (await w.ok(["sync", file, "--json"])).json.changes as { kind: string; person?: string }[];
  assert.ok(!plan.some((c) => c.kind === "name.new" && c.person === "P0001"), JSON.stringify(plan));
  assert.ok(plan.some((c) => c.kind === "person.new"), JSON.stringify(plan));
  w.cleanup();
});

test("a value corrected in the app no longer cites the family tree that gave the value before (found on Mac: a conflict saying 'S0001: kovář', the file saying mlynář); undone, it does again", opts, async () => {
  const w = new World();
  await w.withTree("Dvořákovi");
  const body = (occu: string) => ["0 @I1@ INDI", "1 NAME Karel /Dvořák/", "1 SEX M", "1 BIRT", "2 DATE 1870", `1 OCCU ${occu}`];
  const file = path.join(w.dir, "maly.ged");
  fs.writeFileSync(file, ged(["0 HEAD", "1 SOUR STROM", "1 GEDC", "2 VERS 5.5.1", "1 CHAR UTF-8", ...body("mlynář")]));
  await w.ok(["sync", file, "--apply", "--force"]);
  const tree = JSON.parse(fs.readFileSync(path.join(w.cwd, "strom.json"), "utf8")).id as string;
  const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: w.cwd, encoding: "utf8" }).trim();
  const occu = async () => ((await w.ok(["person", "show", "P0001", "--json"])).json.person.events as { kind: string; value?: string; retracted?: unknown; citations: { source: string }[] }[]).find((e) => e.kind === "OCCU" && !e.retracted)!;
  const first = (await occu()).citations.map((c) => c.source);
  assert.equal(first.length, 1);
  const send = path.join(w.dir, "send.ged");
  fs.writeFileSync(send, ged(["0 HEAD", "1 SOUR STROM", "1 GEDC", "2 VERS 5.5.1", "1 CHAR UTF-8", `1 _STROM_TREE ${tree}`, `1 _STROM_HEAD ${head}`, ...body("kovář").flatMap((l) => (l === "0 @I1@ INDI" ? [l, "1 REFN P0001", "2 TYPE strom-research"] : [l]))]));
  const r = (await w.ok(["sync", send, "--apply", "--json"])).json;
  const now = await occu();
  assert.equal(now.value, "kovář");
  assert.ok(!now.citations.some((c) => c.source === first[0]), `the file that said mlynář no longer cited: ${JSON.stringify(now.citations)}`);
  assert.equal(now.citations.length, 1);
  await w.ok(["sync", "undo", r.input]);
  const back = await occu();
  assert.equal(back.value, "mlynář");
  assert.ok(back.citations.some((c) => c.source === first[0]), JSON.stringify(back.citations));
  w.cleanup();
});

test("a conflict of the user's edit resolved with the user's value: that value written into the fact (found on Mac: 'tesař' resolved, the fact left 'kovář'); another conclusion said to leave the fact as it was", opts, async () => {
  const w = new World();
  await w.withTree("Dvořákovi");
  const body = (occu: string, reli: string) => ["0 @I1@ INDI", "1 REFN P0001", "2 TYPE strom-research", "1 NAME Karel /Dvořák/", "1 SEX M", "1 BIRT", "2 DATE 1870", `1 OCCU ${occu}`, `1 RELI ${reli}`];
  await w.ok(["person", "add", "Karel /Dvořák/", "--sex", "M", "--born", "1870"]);
  const s = (await w.ok(["source", "add", "Sčítání 1900", "--kind", "census", "--locator", "fol. 3", "--json"])).json;
  const sid = (s.id ?? s.source?.id) as string;
  await w.ok(["event", "add", "P0001", "OCCU", "--value", "kovář", "--cite", sid]);
  await w.ok(["event", "add", "P0001", "RELI", "--value", "katolík", "--cite", sid]);
  const tree = JSON.parse(fs.readFileSync(path.join(w.cwd, "strom.json"), "utf8")).id as string;
  const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: w.cwd, encoding: "utf8" }).trim();
  const send = path.join(w.dir, "send.ged");
  fs.writeFileSync(send, ged(["0 HEAD", "1 SOUR STROM", "1 GEDC", "2 VERS 5.5.1", "1 CHAR UTF-8", `1 _STROM_TREE ${tree}`, `1 _STROM_HEAD ${head}`, ...body("tesař", "evangelík")]));
  const facts = async (kind: string) => ((await w.ok(["person", "show", "P0001", "--json"])).json.person.events as { kind: string; value?: string; retracted?: unknown; status: string }[]).filter((e) => e.kind === kind && !e.retracted).map((e) => `${e.value} ${e.status}`);
  // the records' kovář and katolík, the user's tesař and evangelík: two conflicts
  const r = (await w.ok(["sync", send, "--apply", "--json"])).json;
  const [occu, reli] = ["OCCU", "RELI"].map((f) => r.conflicts.find((x: { fact: string }) => x.fact === f)?.id as string);
  assert.ok(occu && reli, JSON.stringify(r.conflicts));
  // the user's value as the conclusion: taken (accents and capitals aside)
  const done = (await w.ok(["conflict", "resolve", occu, "--resolution", "Tesař", "--reasoning", "the user knows it", "--json"])).json;
  assert.equal(done.taken, "user");
  assert.deepEqual(await facts("OCCU"), ["tesař possible"], "the record's withdrawn with the reason, the user's beside it");
  // concluded otherwise: the fact as it was, said how to write the conclusion
  const out = await w.ok(["conflict", "resolve", reli, "--resolution", "both wrong: old catholic", "--reasoning", "a third record"]);
  assert.match(out.out, /údaj E\d+ zůstává, jak byl \(katolík\); místo něj hodnota uživatele: strom conflict resolve X\d+ --take user/, "in the research's language");
  const kept = await facts("RELI");
  assert.equal(kept.length, 1);
  assert.match(kept[0]!, /^katolík /);
  w.cleanup();
});
