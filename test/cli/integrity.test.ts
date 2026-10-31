// The agent must not be able to bypass strom unnoticed.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { World, hasGit, readJsonFile } from "../helpers.ts";

const opts = { skip: !hasGit };

async function seeded(): Promise<World> {
  const w = new World();
  await w.withTree();
  await w.ok(["person", "add", "Jan /Novák/", "--sex", "M", "--born", "1905"]);
  await w.ok(["person", "add", "Josef /Novák/", "--sex", "M"]);
  return w;
}

const person = (w: World, id: string) => path.join(w.cwd, "data", "persons", `${id}.json`);

test("a manual edit is detected and blocks further writes until repaired", opts, async () => {
  const w = await seeded();
  const file = person(w, "P0001");
  fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace('"sex": "M"', '"sex": "F"'));
  const v = await w.run(["verify", "--json"]);
  assert.equal(v.code, 1);
  assert.equal(v.json.findings[0].code, "manual-edit");
  const blocked = await w.run(["person", "add", "Karel /Novák/"]);
  assert.equal(blocked.code, 1);
  assert.equal((await w.run(["person", "add", "Karel /Novák/", "--json"])).json.code, "tree.changed-outside");
  // a person in a Czech research reads it in Czech, its way too; an agent reads the English
  const said = await w.run(["person", "add", "Karel /Novák/"], { tty: true });
  assert.match(said.err, /data výzkumu se změnila mimo strom \(1 problém\): nic se nezapsalo/u, said.err);
  assert.match(said.err, /strom repair {3}\(vrátí poslední zapečetěný stav\)/u, said.err);
  assert.doesNotMatch(said.err, /refusing to write/);
  w.env.CLAUDECODE = "1";
  const agent = await w.run(["person", "add", "Karel /Novák/"]);
  assert.match(agent.err, /changed outside strom \(1 problem\) — refusing to write/, agent.err);
  delete w.env.CLAUDECODE;
  await w.ok(["repair"]);
  assert.equal(readJsonFile(file).sex, "M");
  await w.ok(["person", "add", "Karel /Novák/"]);
  w.cleanup();
});

test("a record created by hand is unsealed and goes to quarantine", opts, async () => {
  const w = await seeded();
  const fake = person(w, "P0050");
  fs.writeFileSync(fake, fs.readFileSync(person(w, "P0002"), "utf8").replace("P0002", "P0050"));
  const v = (await w.run(["verify", "--json"])).json;
  assert.equal(v.findings[0].code, "unsealed");
  const r = (await w.ok(["repair", "--json"])).json;
  assert.deepEqual(r.quarantined, ["data/persons/P0050.json"]);
  assert.ok(!fs.existsSync(fake));
  w.cleanup();
});

test("strom repair speaks one language: the research's to a person, English to an agent", opts, async () => {
  const w = await seeded();
  const file = person(w, "P0001");
  const edit = () => fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace('"sex": "M"', '"sex": "F"'));
  edit();
  fs.writeFileSync(person(w, "P0050"), fs.readFileSync(person(w, "P0002"), "utf8").replace("P0002", "P0050"));
  const human = await w.ok(["repair"]);
  assert.match(human.out, /^obnoveno {2}data\/persons\/P0001\.json$/mu, human.out);
  assert.match(human.out, /^odebráno {2}data\/persons\/P0050\.json$/mu, human.out);
  assert.match(human.out, /^zapečetěný stav: [0-9a-f]{8} · kopie nahrazených souborů: \.strom\/quarantine\/$/mu, human.out);
  assert.doesNotMatch(human.out, /restored|removed|sealed state|nothing to repair/, human.out);
  assert.match((await w.ok(["repair"])).out, /^není co opravit – každý záznam odpovídá své pečeti$/mu);
  edit();
  const agent = await w.ok(["repair"], { env: { CLAUDECODE: "1" } });
  assert.match(agent.out, /^restored {2}data\/persons\/P0001\.json$/mu, agent.out);
  assert.match(agent.out, /^sealed state: [0-9a-f]{8}/mu, agent.out);
  assert.match((await w.ok(["repair"], { env: { CLAUDECODE: "1" } })).out, /^nothing to repair — every record matches its seal$/mu);
  // without a terminal too (a script, PowerShell): a person reads the research's language; only an agent's shell (its
  // marks, as a Claude Code session running a test on Windows passes on) reads English (found 2026-10-30)
  assert.match((await w.ok(["check"])).out, /^ok — data souhlasí/mu);
  assert.match((await w.ok(["check"], { env: { CLAUDECODE: "1" } })).out, /^ok — data consistent/mu);
  w.cleanup();
});

test("a deleted record is detected", opts, async () => {
  const w = await seeded();
  fs.rmSync(person(w, "P0002"));
  const v = (await w.run(["verify", "--json"])).json;
  assert.ok(v.findings.some((f: any) => f.code === "manual-delete"));
  const g = (await w.run(["guard", "--json"])).json;
  assert.ok(g.findings.some((f: any) => f.code === "record-deleted"));
  await w.ok(["repair"]);
  assert.ok(fs.existsSync(person(w, "P0002")));
  w.cleanup();
});

test("a forged operation (hash matches, signature does not) is detected", opts, async () => {
  const w = await seeded();
  const file = person(w, "P0001");
  const edited = fs.readFileSync(file, "utf8").replace('"sex": "M"', '"sex": "F"');
  fs.writeFileSync(file, edited);
  const opsDir = path.join(w.cwd, "data", "ops");
  const log = path.join(opsDir, (fs.readdirSync(opsDir, { recursive: true }) as string[]).find((f) => f.endsWith(".jsonl"))!);
  const lines = fs.readFileSync(log, "utf8").trimEnd().split("\n");
  const last = JSON.parse(lines[lines.length - 1]!);
  const sha = (await import("node:crypto")).createHash("sha256").update(edited).digest("hex");
  const forged = { ...last, op: "person.edit", files: [{ path: "data/persons/P0001.json", sha }], prev: last.sig, sig: "0".repeat(32) };
  fs.appendFileSync(log, JSON.stringify(forged) + "\n");
  const v = (await w.run(["verify", "--json"])).json;
  assert.ok(v.findings.some((f: any) => f.code === "forged-op"), JSON.stringify(v));
  w.cleanup();
});

test("a rewritten operation log breaks the chain", opts, async () => {
  const w = await seeded();
  // one commit of several operations (a family tree taken in)
  const ged = path.join(w.dir, "tree.ged");
  fs.writeFileSync(ged, ["0 HEAD", "1 GEDC", "2 VERS 5.5.1", "1 CHAR UTF-8", "0 @I1@ INDI", "1 NAME Karel /Dvořák/", "0 @I2@ INDI", "1 NAME Marie /Dvořáková/", "0 TRLR", ""].join("\n"));
  await w.ok(["sync", ged, "--apply", "--force"]);
  const opsDir = path.join(w.cwd, "data", "ops");
  // a log of one commit with more than one operation in it (each commit its own log)
  const log = (fs.readdirSync(opsDir, { recursive: true }) as string[]).filter((f) => f.endsWith(".jsonl")).map((f) => path.join(opsDir, f)).find((f) => fs.readFileSync(f, "utf8").trimEnd().split("\n").length > 1)!;
  assert.ok(log, "a log of several operations");
  const lines = fs.readFileSync(log, "utf8").trimEnd().split("\n");
  fs.writeFileSync(log, [lines[1], lines[0]].join("\n") + "\n");
  const v = (await w.run(["verify", "--json"])).json;
  assert.ok(v.findings.some((f: any) => f.code === "chain-broken"));
  const g = (await w.run(["guard", "--json"])).json;
  assert.ok(g.findings.some((f: any) => f.code === "ops-rewritten"));
  w.cleanup();
});

test("check combines seal, consistency and loss checks", opts, async () => {
  const w = await seeded();
  assert.match((await w.ok(["check"])).out, /^ok/);
  fs.writeFileSync(person(w, "P0001"), "{ broken");
  const r = await w.run(["check", "--json"]);
  assert.equal(r.code, 1);
  const codes = r.json.findings.map((f: any) => f.code);
  assert.ok(codes.includes("json") && codes.includes("manual-edit"), codes.join(","));
  w.cleanup();
});

test("a tree moved to another computer: reading works, writing needs the user's consent", opts, async () => {
  const w = await seeded();
  const id = readJsonFile(path.join(w.cwd, "strom.json")).id;
  const key = path.join(w.env.STROM_CONFIG_DIR!, "keys", `${id}.key`);
  fs.renameSync(key, key + ".elsewhere");
  const v = (await w.run(["verify", "--json"])).json;
  assert.deepEqual(v.findings.map((f: any) => f.code), ["foreign-seal"]);
  assert.equal(v.ok, true);
  await w.ok(["person", "list"]);
  const write = await w.run(["person", "add", "X /Y/", "--json"]);
  assert.equal(write.code, 4);
  assert.equal(write.json.needs[0].set, "strom seal adopt");
  // An agent (no terminal) cannot adopt; the user on a terminal can.
  assert.equal((await w.run(["seal", "adopt"])).code, 4);
  await w.ok(["seal", "adopt"], { answers: ["y"] });
  assert.match((await w.ok(["verify"])).out, /^ok/);
  await w.ok(["person", "add", "X /Y/"]);
  assert.match((await w.ok(["verify"])).out, /^ok/);
  w.cleanup();
});

test("a commit made with git directly is detected and undone by repair", opts, async () => {
  const w = await seeded();
  const file = person(w, "P0001");
  fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace('"sex": "M"', '"sex": "F"'));
  spawnSync("git", ["commit", "-qam", "quick fix"], { cwd: w.cwd });
  const v = (await w.run(["verify", "--fast", "--json"])).json;
  assert.ok(v.findings.some((f: any) => f.code === "foreign-commit"), JSON.stringify(v));
  assert.equal((await w.run(["person", "add", "Z /Z/"])).code, 1);
  const r = (await w.ok(["repair", "--json"])).json;
  assert.deepEqual(r.restored, ["data/persons/P0001.json"]);
  assert.equal(readJsonFile(file).sex, "M");
  assert.match((await w.ok(["verify"])).out, /^ok/);
  await w.ok(["person", "add", "Z /Z/"]);
  w.cleanup();
});

test("a commit made with git directly that changed nothing sealed (empty, notes only): repair seals it again", opts, async () => {
  for (const make of [
    (w: World) => spawnSync("git", ["commit", "-q", "--allow-empty", "-m", "x"], { cwd: w.cwd }),
    (w: World) => {
      fs.mkdirSync(path.join(w.cwd, "notes"), { recursive: true });
      fs.writeFileSync(path.join(w.cwd, "notes", "x.md"), "x\n");
      spawnSync("git", ["add", "notes/x.md"], { cwd: w.cwd });
      spawnSync("git", ["commit", "-qm", "x"], { cwd: w.cwd });
    },
  ]) {
    const w = await seeded();
    make(w);
    assert.ok((await w.run(["verify", "--fast", "--json"])).json.findings.some((f: any) => f.code === "foreign-commit"));
    assert.equal((await w.run(["person", "add", "Z /Z/"])).code, 1);
    await w.ok(["repair"]);
    assert.match((await w.ok(["verify"])).out, /^ok/);
    await w.ok(["person", "add", "Z /Z/"]);
    w.cleanup();
  }
});

test("nothing is committed while data is inconsistent", opts, async () => {
  const w = await seeded();
  const head = () => spawnSync("git", ["rev-parse", "HEAD"], { cwd: w.cwd, encoding: "utf8" }).stdout.trim();
  const before = head();
  const file = person(w, "P0002");
  fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace('"sex": "M"', '"sex": "F"'));
  await w.run(["person", "add", "X /Y/"]);
  assert.equal(head(), before);
  w.cleanup();
});
