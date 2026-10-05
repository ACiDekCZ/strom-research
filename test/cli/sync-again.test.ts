// A send of the Strom app taken back (strom sync undo) and sent again: the app's copy from before the undo brings
// nothing new — said (undoneSince), never silently apart; the send itself sent again (POST /sync/<R…>/again) is
// written again from the state it was sent from (found on Windows: "send again" after an undo, nothing written).

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { World, hasGit } from "../helpers.ts";

const opts = { skip: !hasGit };

const ged = (lines: string[]) => [...lines, "0 TRLR", ""].join("\n");
const head0 = ["0 HEAD", "1 SOUR STROM", "1 GEDC", "2 VERS 5.5.1", "1 CHAR UTF-8"];
const people = (born: string) => [
  "0 @I1@ INDI", "1 REFN P0001", "2 TYPE strom-research", "1 NAME Karel /Dvořák/", "1 SEX M", "1 BIRT", `2 DATE ${born}`, "1 FAMS @F1@",
  "0 @I2@ INDI", "1 REFN P0002", "2 TYPE strom-research", "1 NAME Marie /Dvořáková/", "1 SEX F", "1 FAMS @F1@",
  "0 @F1@ FAM", "1 HUSB @I1@", "1 WIFE @I2@",
];

test("a send taken back and sent again: its copy from before says so, the send itself is written again", opts, async () => {
  const w = new World();
  await w.withTree("Dvořákovi");
  const adopt = path.join(w.dir, "adopt.ged");
  fs.writeFileSync(adopt, ged([...head0, ...people("1870").filter((l) => !/REFN|TYPE strom/.test(l))]));
  await w.ok(["sync", adopt, "--apply", "--force"]);
  const id = JSON.parse(fs.readFileSync(path.join(w.cwd, "strom.json"), "utf8")).id as string;
  const at = () => execFileSync("git", ["rev-parse", "HEAD"], { cwd: w.cwd, encoding: "utf8" }).trim();
  const given = at();
  const born = () => w.ok(["person", "show", "P0001", "--json"]).then((r) => (r.json.person.events as { kind: string; date?: string; retracted?: unknown }[]).find((e) => e.kind === "BIRT" && !e.retracted)?.date);
  const info = (await w.ok(["live", "start", "--json"])).json;
  const post = async (where: string, body = "") => {
    const res = await fetch(`${info.url}/${where}`, { method: "POST", body, headers: { Origin: "https://beta.stromapp.info", "Content-Type": "text/plain; charset=utf-8" } });
    return { status: res.status, json: (await res.json()) as Record<string, any> };
  };
  try {
    // the user's edit: born 1871 — written
    const sent = await post("sync", ged([...head0, `1 _STROM_TREE ${id}`, `1 _STROM_HEAD ${given}`, ...people("1871")]));
    assert.equal(sent.status, 200, JSON.stringify(sent.json));
    assert.equal(await born(), "1871");
    const after = at();
    // taken back in the research
    await new Promise((r) => setTimeout(r, 1100));
    await w.ok(["sync", "undo", sent.json.input]);
    assert.equal(await born(), "1870");
    // the app's copy as it had it after the send: nothing new — and said which sends were taken back since
    const copy = await post("sync", ged([...head0, `1 _STROM_TREE ${id}`, `1 _STROM_HEAD ${after}`, ...people("1871")]));
    assert.equal(copy.status, 200);
    assert.equal(copy.json.changes, 0);
    assert.deepEqual(copy.json.undoneSince, [sent.json.intake]);
    assert.equal(await born(), "1870", "the research's undo stands");
    // the send itself, sent again: written again from the state it was sent from
    const again = await post(`sync/${sent.json.intake}/again`);
    assert.equal(again.status, 200, JSON.stringify(again.json));
    assert.ok(again.json.input && again.json.input !== sent.json.input, JSON.stringify(again.json));
    assert.notEqual(again.json.intake, sent.json.intake);
    assert.equal(await born(), "1871");
    const status = await fetch(`${info.url}/status`, { headers: { Origin: "https://beta.stromapp.info" } }).then((r) => r.json() as Promise<{ sends: { intake: string; state: string; again?: string }[] }>);
    const old = status.sends.find((x) => x.intake === sent.json.intake)! as { state: string; again?: string; resent?: boolean };
    assert.deepEqual({ state: old.state, again: old.again, resent: old.resent }, { state: "undone", again: again.json.intake, resent: true });
    // sent again and written: no longer among those taken back (found on Mac: "send again" offered for it, the one
    // still taken back never)
    const later = await post("sync", ged([...head0, `1 _STROM_TREE ${id}`, `1 _STROM_HEAD ${after}`, ...people("1871")]));
    assert.equal(later.json.undoneSince, undefined, JSON.stringify(later.json));
    // one not taken back, or not kept: nothing to send again
    assert.equal((await post(`sync/${again.json.intake}/again`)).status, 404);
    assert.equal((await post("sync/R0/again")).json.code, "send.none");
  } finally {
    await w.ok(["live", "stop"]);
  }
  w.cleanup();
});

test("a send taken back stays taken back: the app's next send from the state before it brings only what is new (found on Windows: a birth back in the research)", opts, async () => {
  const w = new World();
  await w.withTree("Dvořákovi");
  const adopt = path.join(w.dir, "adopt.ged");
  fs.writeFileSync(adopt, ged([...head0, ...people("1870").filter((l) => !/REFN|TYPE strom/.test(l))]));
  await w.ok(["sync", adopt, "--apply", "--force"]);
  const id = JSON.parse(fs.readFileSync(path.join(w.cwd, "strom.json"), "utf8")).id as string;
  const given = execFileSync("git", ["rev-parse", "HEAD"], { cwd: w.cwd, encoding: "utf8" }).trim();
  const born = () => w.ok(["person", "show", "P0001", "--json"]).then((r) => (r.json.person.events as { kind: string; date?: string; retracted?: unknown }[]).find((e) => e.kind === "BIRT" && !e.retracted)?.date);
  const named = () => w.ok(["person", "show", "P0002", "--json"]).then((r) => (r.json.person.names as { given: string }[])[0]!.given);
  const info = (await w.ok(["live", "start", "--json"])).json;
  const post = async (where: string, body = "") => {
    const res = await fetch(`${info.url}/${where}`, { method: "POST", body, headers: { Origin: "https://beta.stromapp.info", "Content-Type": "text/plain; charset=utf-8" } });
    return { status: res.status, json: (await res.json()) as Record<string, any> };
  };
  // the app never loads the research again after a send: every send from the state it was given
  const copy = (born: string, marie = "Marie") => ged([...head0, `1 _STROM_TREE ${id}`, "1 _STROM_APP_TREE t1", `1 _STROM_HEAD ${given}`, ...people(born).map((l) => l.replace("NAME Marie ", `NAME ${marie} `))]);
  try {
    const sent = await post("sync", copy("1871"));
    assert.equal(await born(), "1871");
    await new Promise((r) => setTimeout(r, 1100));
    await w.ok(["sync", "undo", sent.json.input]);
    assert.equal(await born(), "1870");
    // then only a rename: the rename written, the birth taken back left out — said, not written again
    const next = await post("sync", copy("1871", "Marietta"));
    assert.equal(next.status, 200, JSON.stringify(next.json));
    assert.equal(await named(), "Marietta");
    assert.equal(await born(), "1870", "what was taken back stays taken back");
    assert.deepEqual(next.json.undoneSince, [sent.json.intake]);
    assert.equal(next.json.takenBack, 1, JSON.stringify(next.json));
    assert.deepEqual(next.json.notWritten, [{ kind: "fact.changed", person: "P0001", fact: "BIRT", why: "takenBack" }], "never a silent nothing");
    assert.equal(next.json.applied, 1, JSON.stringify(next.json));
    // the day's one source of the app's edits, withdrawn by the undo, is the same again — never one more
    const cites = (input: string) => w.ok(["input", "show", input, "--json"]).then((r) => (r.json.input ?? r.json).source as string);
    assert.equal(await cites(next.json.input), await cites(sent.json.input));
    // said so to a person too
    const file = path.join(w.dir, "copy.ged");
    fs.writeFileSync(file, copy("1871", "Marietta") + "\n");
    assert.match((await w.ok(["sync", file], { tty: true })).out, /Karel Dvořák \[P0001\].*→ vynechá se: přineslo to poslání, které bylo vráceno/, "said");
    // the send itself sent again: the user's word, written
    const again = await post(`sync/${sent.json.intake}/again`);
    assert.equal(again.status, 200, JSON.stringify(again.json));
    assert.equal(await born(), "1871");
  } finally {
    await w.ok(["live", "stop"]);
  }
  w.cleanup();
});

test("a send taken back that left the day's source of the app's edits uncited: the next send cites the same one again, never one more (found on Windows: S0004)", opts, async () => {
  const w = new World();
  await w.withTree("Dvořákovi");
  const adopt = path.join(w.dir, "adopt.ged");
  fs.writeFileSync(adopt, ged([...head0, ...people("1870").filter((l) => !/REFN|TYPE strom/.test(l))]));
  await w.ok(["sync", adopt, "--apply", "--force"]);
  const id = JSON.parse(fs.readFileSync(path.join(w.cwd, "strom.json"), "utf8")).id as string;
  const at = () => execFileSync("git", ["rev-parse", "HEAD"], { cwd: w.cwd, encoding: "utf8" }).trim();
  const info = (await w.ok(["live", "start", "--json"])).json;
  const post = async (body: string) => {
    const res = await fetch(`${info.url}/sync`, { method: "POST", body, headers: { Origin: "https://beta.stromapp.info", "Content-Type": "text/plain; charset=utf-8" } });
    return (await res.json()) as Record<string, any>;
  };
  const died = (year: string) => ged([...head0, `1 _STROM_TREE ${id}`, `1 _STROM_HEAD ${at()}`, ...people("1870").flatMap((l) => (l === "2 DATE 1870" ? [l, "1 DEAT", `2 DATE ${year}`] : [l]))]);
  const cites = (input: string) => w.ok(["input", "show", input, "--json"]).then((r) => r.json.input.source as string);
  try {
    const first = await post(died("1930"));
    assert.equal(first.applied, 1, JSON.stringify(first));
    await new Promise((r) => setTimeout(r, 1100));
    // taken back from the menu (Add to the research, last while there is one; found on Windows: only through the app's link)
    const shown = (await w.run(["menu"], { tty: true, answers: ["4", "", "0"] })).out;
    const key = /^\s*(\d)\s+Vrátit poslední poslání z aplikace Strom \(/m.exec(shown)?.[1];
    assert.ok(key, shown);
    // the person's own choice: never "the Strom app asks" (found on Mac)
    const asked = (await w.run(["menu"], { tty: true, answers: ["4", key, "a", "", "0"] })).out;
    assert.match(asked, /^Vrátit, co výzkum převzal z aplikace Strom /m, asked);
    assert.doesNotMatch(asked, /Aplikace Strom žádá/);
    assert.equal((await w.ok(["input", "show", first.input, "--json"])).json.input.sync.undone !== undefined, true, "taken back");
    assert.doesNotMatch((await w.run(["menu"], { tty: true, answers: ["4", "", "0"] })).out, /Vrátit poslední poslání/, "nothing more to take back");
    const second = await post(died("1931"));
    assert.equal(second.applied, 1, JSON.stringify(second));
    assert.equal(await cites(second.input), await cites(first.input));
    const sources = (await w.ok(["source", "list", "--json"])).json.sources as { id: string }[];
    assert.equal(sources.length, 2, JSON.stringify(sources));
  } finally {
    await w.ok(["live", "stop"]);
  }
  w.cleanup();
});

test("taking back a send that corrected a fact says the fact rests again on the record it was taken from — never a bare \"a record for\" (found on Mac: taken off, or kept?)", opts, async () => {
  const w = new World();
  await w.withTree("Dvořákovi");
  const adopt = path.join(w.dir, "adopt.ged");
  fs.writeFileSync(adopt, ged([...head0, ...people("1870").filter((l) => !/REFN|TYPE strom/.test(l))]));
  await w.ok(["sync", adopt, "--apply", "--force"]);
  const id = JSON.parse(fs.readFileSync(path.join(w.cwd, "strom.json"), "utf8")).id as string;
  const at = execFileSync("git", ["rev-parse", "HEAD"], { cwd: w.cwd, encoding: "utf8" }).trim();
  const info = (await w.ok(["live", "start", "--json"])).json;
  try {
    const res = await fetch(`${info.url}/sync`, { method: "POST", body: ged([...head0, `1 _STROM_TREE ${id}`, `1 _STROM_HEAD ${at}`, ...people("1871")]), headers: { Origin: "https://beta.stromapp.info", "Content-Type": "text/plain; charset=utf-8" } });
    const sent = (await res.json()) as Record<string, any>;
    assert.equal(sent.applied, 1, JSON.stringify(sent));
    await new Promise((r) => setTimeout(r, 1100));
    const shown = (await w.run(["menu"], { tty: true, answers: ["4", "", "0"] })).out;
    const key = /^\s*(\d)\s+Vrátit poslední poslání z aplikace Strom \(/m.exec(shown)?.[1];
    assert.ok(key, shown);
    const asked = (await w.run(["menu"], { tty: true, answers: ["4", key, "a", "", "0"] })).out;
    assert.match(asked, /narození: 1871 → 1870/, asked);
    assert.match(asked, /Údaj se znovu opírá o doklad, ze kterého pocházel: Karel Dvořák .*– narození: 1870/, asked);
    assert.doesNotMatch(asked, /Doklad k údaji/, asked);
  } finally {
    await w.ok(["live", "stop"]);
  }
  w.cleanup();
});

test("an app that never loads the research again: each edit of a value is an edit of it, one set back to what the app was given kept and said (no sign it is the copy that sent them), and a sex set is written (found on Mac: three occupations, one edit lost, the sex said nowhere)", opts, async () => {
  const w = new World();
  await w.withTree("Dvořákovi");
  const lines = (occu: string, sex = "F") => [
    "0 @I1@ INDI", "1 REFN P0001", "2 TYPE strom-research", "1 NAME Karel /Dvořák/", "1 SEX M", "1 BIRT", "2 DATE 1870", "1 OCCU " + occu, "1 FAMS @F1@",
    "0 @I2@ INDI", "1 REFN P0002", "2 TYPE strom-research", "1 NAME Marie /Dvořáková/", `1 SEX ${sex}`, "1 FAMS @F1@",
    "0 @F1@ FAM", "1 HUSB @I1@", "1 WIFE @I2@",
  ];
  const adopt = path.join(w.dir, "adopt.ged");
  fs.writeFileSync(adopt, ged([...head0, ...lines("sedlák").filter((l) => !/REFN|TYPE strom/.test(l))]));
  await w.ok(["sync", adopt, "--apply", "--force"]);
  const id = JSON.parse(fs.readFileSync(path.join(w.cwd, "strom.json"), "utf8")).id as string;
  const given = execFileSync("git", ["rev-parse", "HEAD"], { cwd: w.cwd, encoding: "utf8" }).trim();
  const info = (await w.ok(["live", "start", "--json"])).json;
  const post = async (body: string) => {
    const res = await fetch(`${info.url}/sync`, { method: "POST", body, headers: { Origin: "https://beta.stromapp.info", "Content-Type": "text/plain; charset=utf-8" } });
    return (await res.json()) as Record<string, any>;
  };
  // every send from the state the app was given
  const copy = (occu: string, sex?: string) => ged([...head0, `1 _STROM_TREE ${id}`, "1 _STROM_APP_TREE t1", `1 _STROM_HEAD ${given}`, ...lines(occu, sex)]);
  const occupations = async () =>
    ((await w.ok(["person", "show", "P0001", "--json"])).json.person.events as { kind: string; value?: string; retracted?: unknown }[]).filter((e) => e.kind === "OCCU" && !e.retracted).map((e) => e.value);
  try {
    for (const occu of ["rolník", "chalupník"]) {
      const r = await post(copy(occu));
      assert.equal(r.applied, 1, `${occu}: ${JSON.stringify(r)}`);
      assert.deepEqual(await occupations(), [occu], occu);
      await new Promise((ok) => setTimeout(ok, 1100));
    }
    // set back to what it was given, nothing else of the sends in it: as another copy of the tree would be (another
    // window that never had them) — the research's kept, said; never set back in silence (found on Mac: ten values)
    const back = await post(copy("sedlák"));
    assert.equal(back.applied ?? 0, 0, JSON.stringify(back));
    assert.deepEqual(back.notWritten?.map((x: { kind: string; why: string }) => [x.kind, x.why]), [["fact.changed", "kept"]], JSON.stringify(back));
    assert.deepEqual(await occupations(), ["chalupník"]);
    await new Promise((ok) => setTimeout(ok, 1100));
    // the sex the user set, no record giving the person's facts: written, said as written
    const sex = await post(copy("sedlák", "M"));
    assert.equal(sex.applied, 1, JSON.stringify(sex));
    assert.equal((await w.ok(["person", "show", "P0002", "--json"])).json.person.sex, "M");
  } finally {
    await w.ok(["live", "stop"]);
  }
  w.cleanup();
});

test("a copy of the app that says which send it stands on (_STROM_SINCE): the user's edits are what differs from that send — its new people under their IDs, what the research added since kept, the send's copy tidied: the rule before", opts, async () => {
  const w = new World();
  await w.withTree("Dvořákovi");
  const karel = (occu: string) => ["0 @I1@ INDI", "1 REFN P0001", "2 TYPE strom-research", "1 NAME Karel /Dvořák/", "1 SEX M", "1 BIRT", "2 DATE 1870", "1 OCCU " + occu, "1 FAMS @F1@"];
  const marie = ["0 @I2@ INDI", "1 REFN P0002", "2 TYPE strom-research", "1 NAME Marie /Dvořáková/", "1 SEX F", "1 FAMS @F1@"];
  const jan = (born: string, refn?: string) => ["0 @I9@ INDI", ...(refn ? [`1 REFN ${refn}`, "2 TYPE strom-research"] : []), "1 NAME Jan /Dvořák/", "1 SEX M", "1 BIRT", `2 DATE ${born}`, "1 FAMC @F1@"];
  const fam = (kids: boolean) => ["0 @F1@ FAM", "1 HUSB @I1@", "1 WIFE @I2@", ...(kids ? ["1 CHIL @I9@"] : [])];
  const adopt = path.join(w.dir, "adopt.ged");
  fs.writeFileSync(adopt, ged([...head0, ...[...karel("sedlák"), ...marie, ...fam(false)].filter((l) => !/REFN|TYPE strom/.test(l))]));
  await w.ok(["sync", adopt, "--apply", "--force"]);
  const id = JSON.parse(fs.readFileSync(path.join(w.cwd, "strom.json"), "utf8")).id as string;
  const given = execFileSync("git", ["rev-parse", "HEAD"], { cwd: w.cwd, encoding: "utf8" }).trim();
  const info = (await w.ok(["live", "start", "--json"])).json;
  assert.ok(((await fetch(`${info.url}/status`, { headers: { Origin: "https://beta.stromapp.info" } }).then((r) => r.json())) as { features: string[] }).features.includes("sync.since"));
  assert.ok(((await fetch(`${info.url}/status`, { headers: { Origin: "https://beta.stromapp.info" } }).then((r) => r.json())) as { features: string[] }).features.includes("sync.ids"));
  assert.ok(((await fetch(`${info.url}/status`, { headers: { Origin: "https://beta.stromapp.info" } }).then((r) => r.json())) as { features: string[] }).features.includes("family.noCouple"));
  // a family of one partner alone, married to somebody unknown, kept both ways (the app's beta.55 stops carrying it itself)
  assert.ok(((await fetch(`${info.url}/status`, { headers: { Origin: "https://beta.stromapp.info" } }).then((r) => r.json())) as { features: string[] }).features.includes("family.alone"));
  const post = async (body: string) => {
    const res = await fetch(`${info.url}/sync`, { method: "POST", body, headers: { Origin: "https://beta.stromapp.info", "Content-Type": "text/plain; charset=utf-8" } });
    return (await res.json()) as Record<string, any>;
  };
  const copy = (lines: string[], since?: string) => ged([...head0, `1 _STROM_TREE ${id}`, "1 _STROM_APP_TREE t1", `1 _STROM_HEAD ${given}`, ...(since ? [`1 _STROM_SINCE ${since}`] : []), ...lines]);
  const facts = async (who: string, kind: string) =>
    ((await w.ok(["person", "show", who, "--json"])).json.person.events as { kind: string; value?: string; date?: string; retracted?: unknown }[]).filter((e) => e.kind === kind && !e.retracted).map((e) => e.value ?? e.date);
  try {
    // a new son and another occupation
    const first = await post(copy([...karel("rolník"), ...marie, ...jan("1901"), ...fam(true)]));
    assert.ok(first.applied >= 2, JSON.stringify(first));
    const son = ((await w.ok(["person", "list", "--json"])).json.persons as { id: string; name: string }[]).find((p) => /Jan/.test(p.name))!.id;
    // the research adds what the app does not have (an agent's find)
    await w.ok(["event", "add", "P0001", "DEAT", "--date", "1950"]);
    // the app, from its copy of that send: the son's birth and the occupation again, set back to what it was given
    const file = path.join(w.dir, "second.ged");
    fs.writeFileSync(file, copy([...karel("sedlák"), ...marie, ...jan("1902", son), ...fam(true)], first.intake));
    const plan = (await w.ok(["sync", file, "--json"])).json.changes as { kind: string; action: string; person?: string }[];
    assert.deepEqual(plan.map((c) => [c.kind, c.action, c.person]).sort(), [["fact.changed", "correct", "P0001"], ["fact.changed", "correct", son]], JSON.stringify(plan));
    const second = await post(fs.readFileSync(file, "utf8"));
    assert.equal(second.applied, 2, JSON.stringify(second));
    assert.deepEqual(await facts("P0001", "OCCU"), ["sedlák"]);
    assert.deepEqual(await facts(son, "BIRT"), ["1902"]);
    assert.deepEqual(await facts("P0001", "DEAT"), ["1950"], "what the research added since is kept");
    // its copy tidied away: the rule before it (the research after the last send written)
    const r = JSON.parse(fs.readFileSync(path.join(w.cwd, ".strom", "sync", `received-${second.intake}.json`), "utf8"));
    fs.rmSync(path.join(w.cwd, ".strom", "sync", r.keptAs));
    const third = await post(copy([...karel("chalupník"), ...marie, ...jan("1902", son), ...fam(true)], second.intake));
    assert.equal(third.applied, 1, JSON.stringify(third));
    assert.deepEqual(await facts("P0001", "OCCU"), ["chalupník"]);
  } finally {
    await w.ok(["live", "stop"]);
  }
  w.cleanup();
});

test("an app that never loads the research again (found on Mac): a send the same as an earlier one is compared, never 'nothing new'; one sent again never sets back what was written since; a son it added is him again without his ID", opts, async () => {
  const w = new World();
  await w.withTree("Dvořákovi");
  const karel = (occu: string, born = "1870") => ["0 @I1@ INDI", "1 REFN P0001", "2 TYPE strom-research", "1 NAME Karel /Dvořák/", "1 SEX M", "1 BIRT", `2 DATE ${born}`, "1 OCCU " + occu, "1 FAMS @F1@"];
  const marie = ["0 @I2@ INDI", "1 REFN P0002", "2 TYPE strom-research", "1 NAME Marie /Dvořáková/", "1 SEX F", "1 FAMS @F1@"];
  const jan = (born: string) => ["0 @I9@ INDI", "1 NAME Jan /Dvořák/", "1 SEX M", "1 BIRT", `2 DATE ${born}`, "1 FAMC @F1@"];
  const fam = (kids: boolean) => ["0 @F1@ FAM", "1 HUSB @I1@", "1 WIFE @I2@", ...(kids ? ["1 CHIL @I9@"] : [])];
  const adopt = path.join(w.dir, "adopt.ged");
  fs.writeFileSync(adopt, ged([...head0, ...[...karel("rolník"), ...marie, ...fam(false)].filter((l) => !/REFN|TYPE strom/.test(l))]));
  await w.ok(["sync", adopt, "--apply", "--force"]);
  const id = JSON.parse(fs.readFileSync(path.join(w.cwd, "strom.json"), "utf8")).id as string;
  const given = execFileSync("git", ["rev-parse", "HEAD"], { cwd: w.cwd, encoding: "utf8" }).trim();
  const info = (await w.ok(["live", "start", "--json"])).json;
  const post = async (where: string, body = "") => {
    const res = await fetch(`${info.url}/${where}`, { method: "POST", body, headers: { Origin: "https://beta.stromapp.info", "Content-Type": "text/plain; charset=utf-8" } });
    return (await res.json()) as Record<string, any>;
  };
  const copy = (lines: string[]) => ged([...head0, `1 _STROM_TREE ${id}`, "1 _STROM_APP_TREE t1", `1 _STROM_HEAD ${given}`, ...lines]);
  const facts = async (who: string, kind: string) =>
    ((await w.ok(["person", "show", who, "--json"])).json.person.events as { kind: string; value?: string; date?: string; retracted?: unknown }[]).filter((e) => e.kind === kind && !e.retracted).map((e) => e.value ?? e.date);
  const pause = () => new Promise((ok) => setTimeout(ok, 1100));
  try {
    // V1: the occupation set back to what an earlier send said — the same file as that send: the user set it back, or a
    // copy kept from before it sends again (found on Mac: a place of the user's newer word set back) — the user decides,
    // never 'nothing new', never set back in silence
    assert.equal((await post("sync", copy([...karel("sedlák", "1871"), ...marie, ...fam(false)]))).applied, 2);
    await pause();
    assert.equal((await post("sync", copy([...karel("chalupník", "1871"), ...marie, ...fam(false)]))).applied, 1);
    await pause();
    const back = await post("sync", copy([...karel("sedlák", "1871"), ...marie, ...fam(false)]));
    assert.deepEqual(back.conflicts.map((x: { fact: string }) => x.fact), ["OCCU"], JSON.stringify(back));
    assert.deepEqual(await facts("P0001", "OCCU"), ["chalupník"]);
    await w.ok(["conflict", "resolve", back.conflicts[0].id, "--take", "user", "--reasoning", "set back on purpose"]);
    assert.deepEqual(await facts("P0001", "OCCU"), ["sedlák"]);
    await pause();
    // V2: a send taken back, a birth written since, the send sent again: the newer birth stays, the user decides
    const old = await post("sync", copy([...karel("sedlák", "1884"), ...marie, ...fam(false)]));
    await pause();
    await w.ok(["sync", "undo", old.input]);
    await pause();
    assert.equal((await post("sync", copy([...karel("sedlák", "1885"), ...marie, ...fam(false)]))).applied, 1);
    await pause();
    const again = await post(`sync/${old.intake}/again`);
    assert.equal(again.conflicts.length, 1, JSON.stringify(again));
    assert.deepEqual(await facts("P0001", "BIRT"), ["1885"], "what was written since stays");
    await pause();
    // V3: a son added in the app, the research adds to him, the app changes his birth — he is the same son
    const added = await post("sync", copy([...karel("sedlák", "1885"), ...marie, ...jan("1910"), ...fam(true)]));
    assert.ok(added.applied >= 2);
    const son = ((await w.ok(["person", "list", "--json"])).json.persons as { id: string; name: string }[]).filter((p) => /Jan/.test(p.name));
    assert.equal(son.length, 1);
    // the answer names him by the research's ID, for the app to keep as his REFN (every send, not only an adoption)
    assert.deepEqual(added.ids?.persons, { "@I9@": son[0]!.id }, JSON.stringify(added));
    await w.ok(["event", "add", son[0]!.id, "OCCU", "--value", "tesař"]);
    await pause();
    const changed = await post("sync", copy([...karel("sedlák", "1885"), ...marie, ...jan("1911"), ...fam(true)]));
    assert.equal(changed.applied, 1, JSON.stringify(changed));
    // named by the app's own mark still: the answer gives his ID again, for the app to keep
    assert.deepEqual(changed.ids?.persons, { "@I9@": son[0]!.id }, JSON.stringify(changed));
    const sons = ((await w.ok(["person", "list", "--json"])).json.persons as { id: string; name: string }[]).filter((p) => /Jan/.test(p.name));
    assert.deepEqual(sons.map((p) => p.id), [son[0]!.id], "no second Jan");
    assert.deepEqual(await facts(son[0]!.id, "BIRT"), ["1911"]);
    assert.deepEqual(await facts(son[0]!.id, "OCCU"), ["tesař"]);
    await pause();
    // renamed whole in the app (Jan → Petr), still by the app's own mark: the same son by his sex and birth year
    const renamed = await post("sync", copy([...karel("sedlák", "1885"), ...marie, ...jan("1911").map((l) => l.replace("Jan /Dvořák/", "Petr /Dvořák/")), ...fam(true)]));
    assert.ok(renamed.applied >= 1, JSON.stringify(renamed));
    const all = ((await w.ok(["person", "list", "--json"])).json.persons as { id: string; name: string }[]).filter((p) => /Jan|Petr/.test(p.name));
    assert.deepEqual(all.map((p) => p.id), [son[0]!.id], JSON.stringify(all));
  } finally {
    await w.ok(["live", "stop"]);
  }
  w.cleanup();
});

test("an edit of a value a send taken back had set: the user decides between theirs and the research's — never a second fact beside it (found on Mac: two occupations)", opts, async () => {
  const w = new World();
  await w.withTree("Dvořákovi");
  const karel = (occu: string) => ["0 @I1@ INDI", "1 REFN P0001", "2 TYPE strom-research", "1 NAME Karel /Dvořák/", "1 SEX M", "1 OCCU " + occu, "1 FAMS @F1@"];
  const rest = ["0 @I2@ INDI", "1 REFN P0002", "2 TYPE strom-research", "1 NAME Marie /Dvořáková/", "1 SEX F", "1 FAMS @F1@", "0 @F1@ FAM", "1 HUSB @I1@", "1 WIFE @I2@"];
  const adopt = path.join(w.dir, "adopt.ged");
  fs.writeFileSync(adopt, ged([...head0, ...[...karel("rolník"), ...rest].filter((l) => !/REFN|TYPE strom/.test(l))]));
  await w.ok(["sync", adopt, "--apply", "--force"]);
  const id = JSON.parse(fs.readFileSync(path.join(w.cwd, "strom.json"), "utf8")).id as string;
  const given = execFileSync("git", ["rev-parse", "HEAD"], { cwd: w.cwd, encoding: "utf8" }).trim();
  const info = (await w.ok(["live", "start", "--json"])).json;
  const post = async (body: string) => {
    const res = await fetch(`${info.url}/sync`, { method: "POST", body, headers: { Origin: "https://beta.stromapp.info", "Content-Type": "text/plain; charset=utf-8" } });
    return (await res.json()) as Record<string, any>;
  };
  const copy = (occu: string, since?: string) => ged([...head0, `1 _STROM_TREE ${id}`, "1 _STROM_APP_TREE t1", `1 _STROM_HEAD ${given}`, ...(since ? [`1 _STROM_SINCE ${since}`] : []), ...karel(occu), ...rest]);
  const occupations = async () =>
    ((await w.ok(["person", "show", "P0001", "--json"])).json.person.events as { kind: string; value?: string; retracted?: unknown }[]).filter((e) => e.kind === "OCCU" && !e.retracted).map((e) => e.value);
  try {
    const sent = await post(copy("sedlák"));
    assert.deepEqual(await occupations(), ["sedlák"]);
    await new Promise((r) => setTimeout(r, 1100));
    await w.ok(["sync", "undo", sent.input]);
    assert.deepEqual(await occupations(), ["rolník"]);
    // the app goes on from its copy of that send: sedlák → chalupník
    const edited = await post(copy("chalupník", sent.intake));
    assert.equal(edited.conflicts.length, 1, JSON.stringify(edited));
    assert.deepEqual(await occupations(), ["rolník"], "one occupation, the user to decide");
  } finally {
    await w.ok(["live", "stop"]);
  }
  w.cleanup();
});

test("another copy of the same tree of the app, without _STROM_SINCE: its one edit written, the values later sends wrote kept and said — never set back in silence (found on Mac: ten occupations)", opts, async () => {
  const w = new World();
  await w.withTree("Dvořákovi");
  const lines = (occ: string[], place = "Kamenice") => occ.flatMap((o, i) => [
    `0 @I${i + 1}@ INDI`, `1 REFN P000${i + 1}`, "2 TYPE strom-research", `1 NAME Muž${"ABCDEF"[i]} /Dvořák/`, "1 SEX M", "1 BIRT", `2 DATE 18${70 + i}`, ...(i === 0 ? [`2 PLAC ${place}`] : []), `1 OCCU ${o}`,
  ]);
  const adopt = path.join(w.dir, "adopt.ged");
  const old = ["rolník", "rolník", "rolník"];
  fs.writeFileSync(adopt, ged([...head0, ...lines(old).filter((l) => !/REFN|TYPE strom/.test(l))]));
  await w.ok(["sync", adopt, "--apply", "--force"]);
  const id = JSON.parse(fs.readFileSync(path.join(w.cwd, "strom.json"), "utf8")).id as string;
  const given = execFileSync("git", ["rev-parse", "HEAD"], { cwd: w.cwd, encoding: "utf8" }).trim();
  const info = (await w.ok(["live", "start", "--json"])).json;
  const post = async (body: string) => {
    const res = await fetch(`${info.url}/sync`, { method: "POST", body, headers: { Origin: "https://beta.stromapp.info", "Content-Type": "text/plain; charset=utf-8" } });
    return (await res.json()) as Record<string, any>;
  };
  const copy = (occ: string[], place?: string) => ged([...head0, `1 _STROM_TREE ${id}`, "1 _STROM_APP_TREE t1", `1 _STROM_HEAD ${given}`, ...lines(occ, place)]);
  const occupations = async () => {
    const out: string[] = [];
    for (const p of ["P0001", "P0002", "P0003"])
      out.push(...((await w.ok(["person", "show", p, "--json"])).json.person.events as { kind: string; value?: string; retracted?: unknown }[]).filter((e) => e.kind === "OCCU" && !e.retracted).map((e) => e.value!));
    return out;
  };
  try {
    // window A: every man a mason
    const a = await post(copy(["zedník", "zedník", "zedník"]));
    assert.equal(a.applied, 3, JSON.stringify(a));
    await new Promise((ok) => setTimeout(ok, 1100));
    // window B, the same tree of the app as it was given: one place edited
    const b = await post(copy(old, "Lipany"));
    assert.equal(b.applied, 1, JSON.stringify(b));
    assert.deepEqual(await occupations(), ["zedník", "zedník", "zedník"], "nothing set back");
    assert.deepEqual(b.notWritten?.map((x: { why: string }) => x.why), ["kept", "kept", "kept"], JSON.stringify(b));
    const born = ((await w.ok(["person", "show", "P0001", "--json"])).json.person.events as { kind: string; place?: string; retracted?: unknown }[]).find((e) => e.kind === "BIRT" && !e.retracted);
    assert.match(JSON.stringify(born), /Lipany/);
    await new Promise((ok) => setTimeout(ok, 1100));
    // window A again, one of its masons a carpenter: its edit of its own send, written
    const a2 = await post(copy(["tesař", "zedník", "zedník"], "Lipany"));
    assert.equal(a2.applied, 1, JSON.stringify(a2));
    assert.deepEqual(await occupations(), ["tesař", "zedník", "zedník"]);
  } finally {
    await w.ok(["live", "stop"]);
  }
  w.cleanup();
});

test("a copy of the app set back to its state before a load (no _STROM_HEAD): its _STROM_SINCE alone is its base, a send that brought nothing too — an edited occupation the same one; with no base at all, a conflict to decide, never a second fact nor 'to pick' with nothing to pick (found on Mac)", opts, async () => {
  const w = new World();
  await w.withTree("Dvořákovi");
  const lines = (occu: string, marie = "1860") => [
    "0 @I1@ INDI", "1 REFN P0001", "2 TYPE strom-research", "1 NAME Karel /Dvořák/", "1 SEX M", "1 BIRT", "2 DATE 1858", `1 OCCU ${occu}`,
    "0 @I2@ INDI", "1 REFN P0002", "2 TYPE strom-research", "1 NAME Marie /Dvořáková/", "1 SEX F", "1 BIRT", `2 DATE ${marie}`,
  ];
  const adopt = path.join(w.dir, "adopt.ged");
  fs.writeFileSync(adopt, ged([...head0, ...lines("sedlák").filter((l) => !/REFN|TYPE strom/.test(l))]));
  await w.ok(["sync", adopt, "--apply", "--force"]);
  const id = JSON.parse(fs.readFileSync(path.join(w.cwd, "strom.json"), "utf8")).id as string;
  const info = (await w.ok(["live", "start", "--json"])).json;
  const post = async (body: string) => {
    const res = await fetch(`${info.url}/sync`, { method: "POST", body, headers: { Origin: "https://beta.stromapp.info", "Content-Type": "text/plain; charset=utf-8" } });
    return (await res.json()) as Record<string, any>;
  };
  const copy = (l: string[], since?: string) => ged([...head0, `1 _STROM_TREE ${id}`, "1 _STROM_APP_TREE t1", ...(since ? [`1 _STROM_SINCE ${since}`] : []), ...l]);
  const facts = async (p: string, kind: string) =>
    ((await w.ok(["person", "show", p, "--json"])).json.person.events as { kind: string; value?: string; date?: string; retracted?: unknown }[]).filter((e) => e.kind === kind && !e.retracted).map((e) => e.value ?? e.date);
  try {
    // set back, sent with no base: as the research has it — nothing
    const a = await post(copy(lines("sedlák")));
    assert.equal(a.state ?? "nothing", "nothing", JSON.stringify(a));
    await new Promise((ok) => setTimeout(ok, 1100));
    // its next send stands on that one (_STROM_SINCE, no _STROM_HEAD): the occupation edited, the same fact
    const b = await post(copy(lines("chalupník"), a.intake));
    assert.equal(b.applied, 1, JSON.stringify(b));
    assert.deepEqual(await facts("P0001", "OCCU"), ["chalupník"]);
    await new Promise((ok) => setTimeout(ok, 1100));
    // no base at all: what differs is the user's to decide — real conflicts, nothing "to pick"
    const c = await post(copy(lines("kovář", "1861")));
    assert.ok(!(c.notWritten ?? []).some((x: { why: string }) => x.why === "pick"), JSON.stringify(c));
    assert.deepEqual((c.conflicts ?? []).map((x: { fact: string }) => x.fact).sort(), ["BIRT", "OCCU"], JSON.stringify(c));
    assert.deepEqual(await facts("P0001", "OCCU"), ["chalupník"], "never a second occupation");
    assert.equal((await w.ok(["conflict", "list", "--json"])).json.conflicts.length, 2);
  } finally {
    await w.ok(["live", "stop"]);
  }
  w.cleanup();
});

test("a copy kept from before, the same as an earlier send, sent again without _STROM_SINCE: the value a later send wrote stays, the user decides — and a source the user cited at a value the research no longer has is never lost with it (found on Mac: a place set back, a citation gone in silence)", opts, async () => {
  const w = new World();
  await w.withTree("Dvořákovi");
  const lines = (place: string, occu: string, cite = false) => [
    "0 @I1@ INDI", "1 REFN P0001", "2 TYPE strom-research", "1 NAME Karel /Dvořák/", "1 SEX M", "1 BIRT", "2 DATE 1870", `2 PLAC ${place}`, ...(cite ? ["2 SOUR @S7@", "3 PAGE fol. 113"] : []), "1 OCCU " + occu,
    "0 @I2@ INDI", "1 REFN P0002", "2 TYPE strom-research", "1 NAME Marie /Dvořáková/", "1 SEX F",
    ...(cite ? ["0 @S7@ SOUR", "1 TITL Matrika narozených Lipany 1865–1880"] : []),
  ];
  const adopt = path.join(w.dir, "adopt.ged");
  fs.writeFileSync(adopt, ged([...head0, ...lines("Kamenice", "rolník").filter((l) => !/REFN|TYPE strom/.test(l))]));
  await w.ok(["sync", adopt, "--apply", "--force"]);
  const id = JSON.parse(fs.readFileSync(path.join(w.cwd, "strom.json"), "utf8")).id as string;
  const rev = () => execFileSync("git", ["rev-parse", "HEAD"], { cwd: w.cwd, encoding: "utf8" }).trim();
  const given = rev();
  const info = (await w.ok(["live", "start", "--json"])).json;
  const post = async (body: string) => {
    const res = await fetch(`${info.url}/sync`, { method: "POST", body, headers: { Origin: "https://beta.stromapp.info", "Content-Type": "text/plain; charset=utf-8" } });
    return (await res.json()) as Record<string, any>;
  };
  const copy = (at: string, body: string[], since?: string) => ged([...head0, `1 _STROM_TREE ${id}`, "1 _STROM_APP_TREE t1", `1 _STROM_HEAD ${at}`, ...(since ? [`1 _STROM_SINCE ${since}`] : []), ...body]);
  const birth = async () => ((await w.ok(["person", "show", "P0001", "--json"])).json.person.events as { id: string; kind: string; place?: string; citations: { source: string; locator?: string }[]; retracted?: unknown }[]).find((e) => e.kind === "BIRT" && !e.retracted)!;
  const pause = () => new Promise((ok) => setTimeout(ok, 1100));
  try {
    const stale = copy(given, lines("Lipany", "rolník"));
    const first = await post(stale);
    assert.equal(first.applied, 1, JSON.stringify(first));
    await pause();
    // the user's newer word: the place back, then an occupation
    const second = await post(copy(given, lines("Kamenice", "rolník"), first.intake));
    assert.equal(second.applied, 1, JSON.stringify(second));
    await pause();
    assert.equal((await post(copy(given, lines("Kamenice", "tesař"), second.intake))).applied, 1);
    await pause();
    // the copy of the first send, kept somewhere, sent again as it was (no _STROM_SINCE): its place never written in
    // silence over the newer one, its occupation the one it was given — kept, said
    const again = await post(stale);
    assert.deepEqual(again.conflicts.map((x: { fact: string }) => x.fact), ["BIRT"], JSON.stringify(again));
    assert.deepEqual(again.notWritten?.map((x: { fact: string; why: string }) => [x.fact, x.why]), [["OCCU", "kept"]], JSON.stringify(again));
    assert.equal((await birth()).place, "Kamenice");
    const x = again.conflicts[0].id as string;
    await w.ok(["conflict", "resolve", x, "--take", "research", "--reasoning", "an old copy"]);
    await pause();
    // another window cites a source of the user's at the birth as it had it, the research's place newer from a send of
    // a window it never had: the research's place stays, the source and where in it never lost — the user decides, and
    // their side cites it
    const windowB = rev();
    assert.equal((await post(copy(windowB, lines("Hořice", "tesař")))).applied, 1);
    await pause();
    const cited = await post(copy(windowB, lines("Kamenice", "tesař", true)));
    assert.deepEqual(cited.conflicts.map((c: { fact: string }) => c.fact), ["BIRT"], JSON.stringify(cited));
    const s = cited.ids?.sources?.["@S7@"] as string;
    assert.ok(s, JSON.stringify(cited));
    assert.equal((await birth()).place, "Hořice");
    await w.ok(["conflict", "resolve", cited.conflicts[0].id, "--take", "user", "--reasoning", "the register says so"]);
    const now = await birth();
    assert.equal(now.place, "Kamenice");
    assert.ok(now.citations.some((c) => c.source === s && c.locator === "fol. 113"), JSON.stringify(now));
    await pause();
    // the research changed the place itself since (no send of the app), a copy made before cites another source of the
    // user's at the place it had: the same — the user decides, the source kept in the conflict
    const before = rev();
    await w.ok(["event", "edit", now.id, "--place", "Lipany", "--reason", "the record read again"]);
    const other = (l: string) => l.replace("@S7@", "@S8@").replace("fol. 113", "fol. 9").replace("narozených", "oddaných");
    const late = await post(copy(before, lines("Kamenice", "tesař", true).map(other)));
    assert.deepEqual(late.conflicts.map((c: { fact: string }) => c.fact), ["BIRT"], JSON.stringify(late));
    assert.equal((await birth()).place, "Lipany");
    const conflict = (await w.ok(["conflict", "show", late.conflicts[0].id, "--json"])).json.conflict as { edit?: { cites?: { source: string; locator?: string }[] } };
    assert.deepEqual(conflict.edit?.cites, [{ source: late.ids.sources["@S8@"], locator: "fol. 9" }]);
  } finally {
    await w.ok(["live", "stop"]);
  }
  w.cleanup();
});

test("a change not written leaves out the sources the user gave its fact: named with it (cites), never lost in silence", opts, async () => {
  const w = new World();
  await w.withTree("Dvořákovi");
  const adopt = path.join(w.dir, "adopt.ged");
  fs.writeFileSync(adopt, ged([...head0, ...people("1870").filter((l) => !/REFN|TYPE strom/.test(l))]));
  await w.ok(["sync", adopt, "--apply", "--force"]);
  const id = JSON.parse(fs.readFileSync(path.join(w.cwd, "strom.json"), "utf8")).id as string;
  const given = execFileSync("git", ["rev-parse", "HEAD"], { cwd: w.cwd, encoding: "utf8" }).trim();
  const info = (await w.ok(["live", "start", "--json"])).json;
  const post = async (where: string, body = "") => {
    const res = await fetch(`${info.url}/${where}`, { method: "POST", body, headers: { Origin: "https://beta.stromapp.info", "Content-Type": "text/plain; charset=utf-8" } });
    return (await res.json()) as Record<string, any>;
  };
  const copy = (marie = "Marie") =>
    ged([
      ...head0, `1 _STROM_TREE ${id}`, "1 _STROM_APP_TREE t1", `1 _STROM_HEAD ${given}`,
      ...people("1871").flatMap((l) => (l === "2 DATE 1871" ? [l, "2 SOUR @S5@", "3 PAGE s. 4"] : [l.replace("NAME Marie ", `NAME ${marie} `)])),
      "0 @S5@ SOUR", "1 TITL Matrika narozených Ústí 1860–1875",
    ]);
  try {
    const sent = await post("sync", copy());
    await new Promise((r) => setTimeout(r, 1100));
    await w.ok(["sync", "undo", sent.input]);
    const next = await post("sync", copy("Marietta"));
    assert.deepEqual(next.notWritten, [{ kind: "source.new", why: "takenBack" }, { kind: "fact.changed", person: "P0001", fact: "BIRT", why: "takenBack", cites: ["@S5@"] }], JSON.stringify(next));
  } finally {
    await w.ok(["live", "stop"]);
  }
  w.cleanup();
});
