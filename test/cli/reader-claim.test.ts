// Readers started at the same moment each get their own id (found live: two strom read of one image started in the
// background in the same second both took the stem "…-run2" — one usage file with two starts, one log and prompt the
// second wrote over, one report, one record; the second reader's result lost). The stem is claimed whole or not at all,
// across processes: every reading its own readers, usage, logs, reports and records.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { World, hasGit } from "../helpers.ts";
import { claimStem } from "../../src/commands/readers.ts";

const CLI = path.join(import.meta.dirname, "..", "..", "src", "cli.ts");
const fixtures = path.join(import.meta.dirname, "..", "fixtures", "images");

function strom(w: World, args: string[]): Promise<{ code: number; out: string; err: string }> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [CLI, ...args], { cwd: w.cwd, env: w.env, stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("close", (code) => resolve({ code: code ?? 1, out, err }));
  });
}

const journal = (file: string): Record<string, any>[] => (fs.existsSync(file) ? fs.readFileSync(file, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []);

test("a stem claimed is no other's: the next claim takes the next, before any report of the first is there", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "strom claim ž "));
  try {
    const none = () => false;
    assert.equal(claimStem(root, "read", "2026-10-10-M0001", none), "2026-10-10-M0001");
    assert.equal(claimStem(root, "read", "2026-10-10-M0001", none), "2026-10-10-M0001-run2", "claimed, no report yet: the next");
    assert.equal(claimStem(root, "read", "2026-10-10-M0001", (s) => s.endsWith("run3")), "2026-10-10-M0001-run4", "a report there: taken too");
    assert.equal(claimStem(root, "clips", "2026-10-10-M0001", none), "2026-10-10-M0001", "another kind of reading: its own");
    // a claim of an earlier day goes
    const old = path.join(root, ".strom", "runs", "claims", "read-2026-10-01-M0001.claim");
    fs.writeFileSync(old, "1\n");
    fs.utimesSync(old, new Date(Date.now() - 5 * 24 * 3600_000), new Date(Date.now() - 5 * 24 * 3600_000));
    claimStem(root, "read", "2026-10-10-Ткач", none);
    assert.equal(fs.existsSync(old), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("strom read of one image started several times at once: each reader its own id, usage, log, report and record", { skip: !hasGit || process.platform === "win32", timeout: 180_000 }, async () => {
  const w = new World();
  try {
    await w.withTree();
    await w.ok(["research", "new", "Předci", "--new-person", "Jan /Novák/", "--sex", "M"]);
    await w.ok(["recordset", "add", "Žďár N 1847–1868", "--kinds", "baptism", "--places", "Žďár", "--years", "1847-1868"]);
    const scans = path.join(w.dir, "scans");
    fs.mkdirSync(scans);
    fs.copyFileSync(path.join(fixtures, "s0001.jpg"), path.join(scans, "s0001.jpg"));
    await w.ok(["media", "add", scans, "--recordset", "B1"]);
    // a reader that writes its own process into its report and its use, and takes a while
    const script = path.join(w.dir, "reader.mjs");
    fs.writeFileSync(
      script,
      `import fs from "node:fs";\nconst p = process.env.STROM_PROMPT ?? "";\n` +
        `const report = /Write your report to (.+?) AS YOU GO/.exec(p)[1];\n` +
        `console.log('usage: {"agentSession":"reader-' + process.pid + '","in":1,"out":2}');\n` +
        `for (const m of p.matchAll(/^- (M\\d{4}) · image (\\d+)/gm)) fs.appendFileSync(report, "## Image " + m[2] + " · " + m[1] + "\\nresult: nothing\\nnote: pid " + process.pid + "\\n\\n");\n` +
        `setTimeout(() => {}, 400);\n`,
    );
    w.env.STROM_RUNNER_SCRIPT = script;
    // views made once before, so each process gets to its readers as fast as the others
    await w.ok(["media", "view", "B1:1"]);
    const n = 10;
    const runs = await Promise.all(Array.from({ length: n }, () => strom(w, ["read", "B1:1", "--whole", "--question", "Křest Jana Nováka (Ткач)", "--agent", "script", "--json"])));
    for (const r of runs) assert.equal(r.code, 0, r.err);
    const stems = runs.map((r) => JSON.parse(r.out).reading as string);
    assert.equal(new Set(stems).size, n, `each reading its own stem: ${stems.join(", ")}`);
    // each reader's report holds what its own reader wrote, once
    for (const r of runs) {
      const reports = JSON.parse(r.out).reports as string[];
      assert.equal(reports.length, 1);
      const text = fs.readFileSync(reports[0]!, "utf8");
      assert.equal(text.match(/^## Image/gm)?.length, 1, `one reader's report: ${reports[0]}`);
    }
    // its own record and its own use: one start each
    const records = journal(path.join(w.cwd, ".strom", "metrics", "readers.jsonl"));
    assert.equal(records.length, n);
    assert.equal(new Set(records.map((r) => r.reader)).size, n, "each reader its own id");
    for (const s of stems) {
      const use = journal(path.join(w.cwd, ".strom", "metrics", "usage", `read-${s}-1.jsonl`));
      assert.equal(use.filter((u) => u.start).length, 1, `one start in the use of read-${s}-1`);
      assert.ok(fs.existsSync(path.join(w.cwd, ".strom", "runs", `read-${s}-1.log`)), `its own log: read-${s}-1`);
    }
  } finally {
    w.cleanup();
  }
});
