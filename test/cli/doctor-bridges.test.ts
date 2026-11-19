// K046: strom doctor and strom error's report say the bridges running on this computer — how many, each with its
// research's folder name (never a path), PID and memory, and the sum — from the table of processes (here a stand-in for
// it: STROM_TEST_PROCESS_TABLE, of macOS and of Windows); a table that cannot be read is said, never a failure.
// Nothing is ended.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";
import { zipTexts } from "./error.helpers.ts";
import { stromVocabulary } from "../../src/cli/vocab.ts";

const opts = { skip: !hasGit };
const MB = 1024 * 1024;

/** The process table strom reads stood in for: what ps or the CIM query says, the folders the bridges run in. */
function table(w: World, t: { platform: string; stdout?: string; cwd?: Record<string, string>; fail?: true }): void {
  const file = path.join(w.dir, "procesy.json");
  fs.writeFileSync(file, JSON.stringify(t));
  w.env.STROM_TEST_PROCESS_TABLE = file;
}

type Check = { name: string; status: string; detail: string };
const bridgesCheck = (json: { checks: Check[] }) => json.checks.find((c) => c.name === "bridges");

test("strom doctor and strom error say the bridges here (macOS): each research's folder, PID, memory, the sum; one whose research is gone marked; no path", opts, async () => {
  const w = new World();
  fs.mkdirSync(path.join(w.env.HOME!, "Downloads"), { recursive: true });
  const root = await w.withTree("Lhotákovi");
  // the research's bridge as its note says (nothing runs: the table is the stand-in's)
  fs.writeFileSync(path.join(root, ".strom", "live.json"), JSON.stringify({ pid: 4242, port: 1, root }));
  const uid = typeof process.getuid === "function" ? process.getuid() : 0;
  const gone = path.join(w.dir, "Лгота smazaná");
  table(w, {
    platform: "darwin",
    stdout: [
      `4242 ${uid} 204800 /opt/node/bin/node /opt/strom/dist/cli.js live serve`,
      `4545 ${uid} 102400 /opt/node/bin/node /opt/strom/dist/cli.js live serve`,
      `4646 ${uid} 9999 /opt/node/bin/node /opt/strom/dist/cli.js phone serve`,
    ].join("\n"),
    cwd: { "4545": gone },
  });
  const r = await w.ok(["doctor", "--json", "--lang", "en"]);
  const c = bridgesCheck(r.json);
  assert.ok(c, r.out);
  assert.equal(c.status, "ok", "only said");
  assert.equal(c.detail, "2 running: Lhotákovi (PID 4242, 200 MB) · Лгота smazaná (PID 4545, 100 MB) – its research is gone · 300 MB in all");
  // a person reads it in the research's language
  const cs = await w.run(["doctor", "--lang", "cs"]);
  assert.match(cs.out, /✓ +mosty k aplikaci Strom +běží 2: Lhotákovi \(PID 4242, 200 MB\) · Лгота smazaná \(PID 4545, 100 MB\) – osiřelý, výzkum už neexistuje · celkem 300 MB/u);
  // the report: its own area in numbers, the researches by their codes, the doctor's line masked
  const e = await w.ok(["error", "--yes", "--json"]);
  const texts = zipTexts(e.json.file);
  const report = JSON.parse(texts["report.json"]!);
  const area = report.areas.bridges;
  assert.deepEqual([area.read, area.running, area.memory, area.unmeasured], [true, 2, 300 * MB, 0]);
  assert.deepEqual(
    area.each.map((b: { pid: number; state: string; memory: number }) => [b.pid, b.state, b.memory]),
    [[4242, "known", 200 * MB], [4545, "orphan", 100 * MB]],
  );
  assert.equal(area.each[0].research, "this");
  assert.match(area.each[1].research, /^‹[0-9a-f]{5}›$/u);
  for (const word of ["Lhotákovi", "Лгота", w.dir]) assert.ok(!Object.values(texts).some((t) => t.normalize("NFC").includes(word.normalize("NFC"))), `${word} in the report`);
  assert.ok(e.json.areas.some((a: { name: string; ok: boolean }) => a.name === "bridges" && a.ok));
  w.cleanup();
});

test("strom error: a bridge's research named by a word of strom's (Beta) is in the doctor's line by its code, as in the bridges area", opts, async () => {
  const w = new World();
  fs.mkdirSync(path.join(w.env.HOME!, "Downloads"), { recursive: true });
  const root = await w.withTree("Alfa");
  fs.writeFileSync(path.join(root, ".strom", "live.json"), JSON.stringify({ pid: 5151, port: 1, root }));
  const beta = path.join(w.dir, "Beta");
  const update = path.join(w.dir, "update");
  fs.mkdirSync(beta, { recursive: true });
  fs.mkdirSync(update, { recursive: true });
  // words strom says itself: the text's masking leaves them as weak terms, the arguments' keeps one in lower case
  assert.ok(stromVocabulary().has("beta") && stromVocabulary().has("update"));
  const uid = typeof process.getuid === "function" ? process.getuid() : 0;
  table(w, {
    platform: "darwin",
    stdout: [`5151 ${uid} 204800 /opt/node/bin/node /opt/strom/dist/cli.js live serve`, `5252 ${uid} 102400 /opt/node/bin/node /opt/strom/dist/cli.js live serve`, `5353 ${uid} 102400 /opt/node/bin/node /opt/strom/dist/cli.js live serve`].join("\n"),
    cwd: { "5252": beta, "5353": update },
  });
  const r = await w.ok(["doctor", "--json", "--lang", "en"]);
  assert.match(bridgesCheck(r.json)!.detail, /Beta \(PID 5252, 100 MB\)/u, "doctor itself names it");
  const e = await w.ok(["error", "--yes", "--json"]);
  const texts = zipTexts(e.json.file);
  const report = JSON.parse(texts["report.json"]!);
  const detail: string = report.areas.doctor.checks.find((c: Check) => c.name === "bridges").detail;
  for (const pid of [5252, 5353]) {
    const code = report.areas.bridges.each.find((b: { pid: number }) => b.pid === pid).research;
    assert.match(code, /^‹[0-9a-f]{5}›$/u);
    assert.ok(detail.includes(`${code} (PID ${pid}, 100 MB)`), detail);
  }
  for (const word of ["Alfa", "Beta", "update"]) assert.ok(!detail.includes(word), `${word} in the doctor's line: ${detail}`);
  for (const t of Object.values(texts)) assert.ok(!/(Beta|update) \(PID/u.test(t), "a folder's name beside its bridge");
  w.cleanup();
});

test("Windows: the bridges from the CIM query with their working set; a table that cannot be read is said, doctor and error never fail on it", opts, async () => {
  const w = new World();
  fs.mkdirSync(path.join(w.env.HOME!, "Downloads"), { recursive: true });
  const root = await w.withTree("Lhotákovi");
  fs.writeFileSync(path.join(root, ".strom", "live.json"), JSON.stringify({ pid: 4242, port: 1, root }));
  table(w, {
    platform: "win32",
    stdout: JSON.stringify([
      { ProcessId: 4242, WorkingSetSize: 150 * MB, CommandLine: '"C:\\Users\\vlhotak\\AppData\\Local\\Programs\\Strom\\node\\node.exe" "C:\\Users\\vlhotak\\AppData\\Local\\Programs\\Strom\\app-1.35.0\\dist\\cli.js" live serve' },
      { ProcessId: 5151, CommandLine: '"C:\\S\\node\\node.exe" "C:\\S\\app-1.34.0\\dist\\cli.js" live serve' },
    ]),
  });
  const r = await w.ok(["doctor", "--json", "--lang", "en"]);
  assert.equal(bridgesCheck(r.json)?.detail, "2 running: Lhotákovi (PID 4242, 150 MB) · research not told (PID 5151, memory not measured) · 150 MB in all");
  // the table not readable (PowerShell refused, timed out)
  table(w, { platform: "win32", fail: true });
  const failed = await w.run(["doctor", "--json", "--lang", "en"]);
  assert.equal(bridgesCheck(failed.json)?.status, "ok");
  assert.equal(bridgesCheck(failed.json)?.detail, "not found out: the list of processes could not be read");
  const e = await w.ok(["error", "--yes", "--json"]);
  const area = JSON.parse(zipTexts(e.json.file)["report.json"]!).areas.bridges;
  assert.deepEqual(area, { read: false, running: 0, memory: 0, unmeasured: 0, each: [] });
  w.cleanup();
});

test("strom error: the family trees' line of doctor names each research by its code, one named by a word of strom's (Beta, update) too", opts, async () => {
  const w = new World();
  fs.mkdirSync(path.join(w.env.HOME!, "Downloads"), { recursive: true });
  await w.withTree("Beta");
  await w.ok(["init", "update"]);
  await w.ok(["init", "Alfa"]);
  w.cwd = w.treeDir("Alfa");
  table(w, { platform: "darwin", stdout: "" });
  const r = await w.ok(["doctor", "--json", "--lang", "en"]);
  assert.match(r.json.checks.find((c: Check) => c.name === "trees").detail, /Beta/u, "doctor itself names them");
  const e = await w.ok(["error", "--yes", "--json"]);
  const doctor = JSON.parse(zipTexts(e.json.file)["report.json"]!).areas.doctor;
  const detail: string = doctor.checks.find((c: Check) => c.name === "trees").detail;
  assert.match(detail, /^‹[0-9a-f]{5}›(?:, ‹[0-9a-f]{5}›){2}$/u, detail);
  const line: string = doctor.text.find((l: string) => /family trees/u.test(l));
  assert.ok(line.includes(detail), line);
  // this research's own check line by the same code
  const tree: string = doctor.checks.find((c: Check) => c.name === "tree").detail;
  assert.ok(!/Alfa/u.test(tree) && /‹[0-9a-f]{5}›/u.test(tree), tree);
  w.cleanup();
});
