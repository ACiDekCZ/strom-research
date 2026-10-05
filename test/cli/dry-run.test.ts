// --dry-run changes nothing: not the records, not git, not what strom keeps beside them in .strom/ (the inbox of the
// Strom app's sends, its state the app reads), not the shared folder — for every command that writes, run as its
// examples say (found on Windows: strom sync undo --dry-run told the app a send was taken back).

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { World, hasGit } from "../helpers.ts";
import "../../src/commands/index.ts";
import { commands } from "../../src/cli/registry.ts";
import { receiveTree } from "../../src/core/sync.ts";

const opts = { skip: !hasGit };

/** The words of a command line as a shell splits them: quotes kept together. */
function words(line: string): string[] {
  const out: string[] = [];
  for (const m of line.matchAll(/"([^"]*)"|'([^']*)'|(\S+)/g)) out.push(m[1] ?? m[2] ?? m[3]!);
  return out;
}

/** Every file under a folder (but git's own) with its hash. */
function snapshot(dir: string): Map<string, string> {
  const out = new Map<string, string>();
  const walk = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) {
        if (e.name !== ".git") walk(p);
      } else if (e.isFile()) out.set(path.relative(dir, p), crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex"));
    }
  };
  walk(dir);
  return out;
}

function changed(a: Map<string, string>, b: Map<string, string>): string[] {
  return [...new Set([...a.keys(), ...b.keys()])].filter((k) => a.get(k) !== b.get(k));
}

const ged = (lines: string[]) => [...lines, "0 TRLR", ""].join("\n");
const people = (karel: string) => [
  "0 @I1@ INDI", `1 NAME ${karel}`, "1 SEX M", "1 BIRT", "2 DATE 1870", "1 FAMS @F1@",
  "0 @I2@ INDI", "1 NAME Marie /Dvořáková/", "1 SEX F", "1 FAMS @F1@",
  "0 @I3@ INDI", "1 NAME Jan /Dvořák/", "1 SEX M", "1 BIRT", "2 DATE 1901", "1 FAMC @F1@",
  "0 @F1@ FAM", "1 HUSB @I1@", "1 WIFE @I2@", "1 CHIL @I3@", "1 MARR", "2 DATE 1899",
];
const head0 = ["0 HEAD", "1 SOUR STROM", "1 GEDC", "2 VERS 5.5.1", "1 CHAR UTF-8"];

test("--dry-run writes nothing anywhere, for every command that writes", opts, async () => {
  const w = new World();
  await w.withTree("Dvořákovi");
  const adopt = path.join(w.dir, "adopt.ged");
  fs.writeFileSync(adopt, ged([...head0, ...people("Karel /Dvořák/")]));
  await w.ok(["sync", adopt, "--apply", "--force"]);
  const id = JSON.parse(fs.readFileSync(path.join(w.cwd, "strom.json"), "utf8")).id as string;
  const at = execFileSync("git", ["rev-parse", "HEAD"], { cwd: w.cwd, encoding: "utf8" }).trim();
  // a send of the app, written: the app reads its state from .strom/sync/
  const text = ged([...head0, `1 _STROM_TREE ${id}`, `1 _STROM_HEAD ${at}`, ...people("Karel /Dvořák/").map((l) => (l === "2 DATE 1901" ? "2 DATE 1902" : l))]);
  const sent = receiveTree(w.cwd, w.env, text);
  const written = (await w.ok(["sync", sent.file, "--apply", "--json"])).json.input as string;
  // the same tree sent again, waiting in the inbox
  const again = receiveTree(w.cwd, w.env, text);
  const other = path.join(w.dir, "other.ged");
  fs.writeFileSync(other, ged([...head0, `1 _STROM_TREE ${id}`, `1 _STROM_HEAD ${at}`, ...people("Karel /Dvořák/").map((l) => (l === "2 DATE 1870" ? "2 DATE 1871" : l))]));
  await w.ok(["task", "add", "Křest Jana", "--level", "locate", "--where", "Týnec", "--why", "a", "--done-when", "b", "--about", "P0003"]);

  const lines: string[] = [
    ...commands().filter((c) => c.writes).flatMap((c) => (c.examples?.length ? c.examples.map((e) => e.replace(/^strom /, "")) : [c.path.join(" ")])),
    `sync undo ${written}`,
    `sync "${again.file}" --apply`,
    `sync "${other}" --apply`,
    `sync "${adopt}" --apply --force`,
    "sync discard",
    "task done T0001 --summary hotovo",
    "task park T0001 --reason pozdeji",
    "task drop T0001 --reason zbytecne",
    "session start T0001",
    "frontier",
    "story set P0001 --text Příběh",
  ];
  const trees = w.home;
  const before = snapshot(trees);
  const headBefore = execFileSync("git", ["rev-parse", "HEAD"], { cwd: w.cwd, encoding: "utf8" }).trim();
  const ran: string[] = [];
  for (const line of lines) {
    const args = [...words(line), "--dry-run"];
    await w.run(args);
    ran.push(line);
    const diff = changed(before, snapshot(trees));
    assert.deepEqual(diff, [], `strom ${args.join(" ")} wrote: ${diff.join(", ")}`);
    assert.equal(execFileSync("git", ["rev-parse", "HEAD"], { cwd: w.cwd, encoding: "utf8" }).trim(), headBefore, `strom ${args.join(" ")} committed`);
    assert.equal(execFileSync("git", ["status", "--porcelain"], { cwd: w.cwd, encoding: "utf8" }), "", `strom ${args.join(" ")} left changes`);
  }
  assert.ok(ran.length > 60);
  // what it says reads as what would happen: marked so last, in the research's language, and for a program
  const said = await w.ok(["sync", "undo", written, "--dry-run"]);
  assert.match(said.out, /\n\nNanečisto \(--dry-run\): nic se nezapsalo – řádky výše říkají, co by se stalo\.\n$/, said.out);
  assert.equal((await w.ok(["sync", "undo", written, "--dry-run", "--json"])).json.dryRun, true);
  // what the app reads of the send: still written
  const state = JSON.parse(fs.readFileSync(path.join(w.cwd, ".strom", "sync", `received-${sent.intake}.json`), "utf8"));
  assert.equal(state.state, "written");
  assert.equal(JSON.parse(fs.readFileSync(path.join(w.cwd, ".strom", "sync", `received-${again.intake}.json`), "utf8")).state, "pending");
  assert.equal((await w.ok(["sync", "undo", written, "--json"])).json.dryRun, undefined, "a run that writes: no mark");
  w.cleanup();
});
