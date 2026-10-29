// A reader's time limit goes by what it is given (found live: one crop, a reader stuck for the 15 minutes every reader
// had, and the agent that ran strom read waiting 22 minutes): a crop a few minutes, a full batch the old limit. At the
// limit the reader is stopped and strom read answers at once — also when the reader left something behind that holds
// its output open — saying the reader stopped and what to do: look at the image itself. A reader stopped so is a
// reader without a result, never one halted by a login, a plan's limit or a failure.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";
import { learnedReaderMinutes, READER_LEARN_RECENT, readerMinutes, READER_MINUTES_CEILING, READER_MINUTES_FLOOR } from "../../src/core/reader.ts";
import { isHalted, readerLimit } from "../../src/core/readstats.ts";

const unix = { skip: !hasGit || process.platform === "win32" };
const fixtures = path.join(import.meta.dirname, "..", "fixtures", "images");

test("a reader's time limit: a few minutes and one for each view, between its floor and its ceiling", () => {
  assert.equal(readerMinutes(1), READER_MINUTES_FLOOR);
  assert.equal(readerMinutes(0), READER_MINUTES_FLOOR, "never below the floor");
  assert.equal(readerMinutes(3), 8);
  assert.equal(readerMinutes(10), READER_MINUTES_CEILING, "a full batch: the limit every reader had");
  assert.equal(readerMinutes(40), READER_MINUTES_CEILING, "never above the ceiling");
  assert.equal(isHalted({ kind: "reader", outcome: "timeout" }), false, "a reader stopped at its limit is no halted one");
});

async function treeWithScans(w: World): Promise<void> {
  await w.withTree();
  await w.ok(["research", "new", "Předci", "--new-person", "Jan /Novák/", "--sex", "M"]);
  await w.ok(["recordset", "add", "Žďár N 1847–1868", "--kinds", "baptism", "--places", "Žďár", "--years", "1847-1868"]);
  const scans = path.join(w.dir, "scans");
  fs.mkdirSync(scans);
  for (const f of ["s0001.jpg", "s0002.jpg"]) fs.copyFileSync(path.join(fixtures, f), path.join(scans, f));
  await w.ok(["media", "add", scans, "--recordset", "B1"]);
}

test("strom read: a reader stuck on one crop is stopped at its limit and strom read answers at once with what to do — whatever the reader left holding its output", unix, async () => {
  const w = new World();
  await treeWithScans(w);
  // a reader that never answers: it shrugs off SIGTERM and leaves a helper in a session of its own holding its output
  const pids = path.join(w.dir, "pids.txt");
  const script = path.join(w.dir, "stuck-reader.mjs");
  fs.writeFileSync(
    script,
    `import fs from "node:fs";\nimport { spawn } from "node:child_process";\n` +
      `process.on("SIGTERM", () => {});\n` +
      `const helper = spawn(process.execPath, ["-e", "setTimeout(() => {}, 120000)"], { detached: true, stdio: ["ignore", "inherit", "inherit"] });\n` +
      `fs.appendFileSync(${JSON.stringify(pids)}, helper.pid + "\\n");\n` +
      `console.log("reading…");\nsetTimeout(() => {}, 120000);\n`,
  );
  w.env.STROM_RUNNER_SCRIPT = script;
  try {
    const started = Date.now();
    const r = await w.run(["read", "B1:1", "--crop", "0.1,0.2,0.3,0.2", "--minutes", "0.05", "--question", "Křest Jana Nováka (Ткач)", "--agent", "script"]);
    const took = Date.now() - started;
    assert.ok(took < 30_000, `answered at once after the limit: ${took} ms`);
    assert.equal(r.code, 1);
    const said = r.out + r.err;
    assert.match(said, /■ reader 1: stopped at its time limit \(0\.05 min\)/);
    assert.match(said, /readers that failed: 1 \(stopped at its time limit, 0\.05 min\)/);
    assert.match(said, /a reader stopped at its time limit gave no answer for its image: look at it yourself — strom media view M\d+ --crop 0\.1,0\.2,0\.3,0\.2 \(or read again, with more time: --minutes <n>\)/);
    // the default by what it is given: one crop a few minutes, two images more
    w.env.STROM_RUNNER_SCRIPT = path.join(w.dir, "quick-reader.mjs");
    fs.writeFileSync(w.env.STROM_RUNNER_SCRIPT, 'const p = process.env.STROM_PROMPT ?? "";\nfor (const m of p.matchAll(/^- (M\\d{4}) · image (\\d+)/gm)) console.log("## Image " + m[2] + " · " + m[1] + "\\nresult: nothing\\n");\n');
    const crop = await w.ok(["read", "B1:2", "--crop", "0.1,0.2,0.3,0.2", "--question", "Křest Jana Nováka", "--agent", "script"]);
    assert.match(crop.out, new RegExp(`▶ reader 1/1: 1 image \\(2\\) · at most ${readerMinutes(1)} min`));
    const two = await w.ok(["read", "B1", "--images", "1-2", "--whole", "--question", "Křty Nováků", "--agent", "script"]);
    assert.match(two.out, new RegExp(`▶ reader 1/1: 2 images \\(1–2\\) · at most ${readerMinutes(2)} min`));
    // counted as English says it: one image, two images (never "1 images")
    assert.match(crop.out, /^read 1 image in /m);
    assert.match(two.out, /^read 2 images in /m);
  } finally {
    for (const pid of fs.existsSync(pids) ? fs.readFileSync(pids, "utf8").trim().split("\n") : [])
      try {
        process.kill(Number(pid), "SIGKILL");
      } catch {
        // gone
      }
    w.cleanup();
  }
});

// A reader's limit learns from the readers of the same agent and model before it (found live with Grok Build: a reader
// of one crop stopped at its 6 minutes with no result, the same reading with --minutes 12 done in under 4): more time
// where they needed it, never above the ceiling, never below the formula; --minutes always wins; nothing learned of
// another agent or model, nor where there is no history.
test("a reader's limit learned: the share of their own limit earlier readers needed, with room — between the formula and the ceiling", () => {
  const min = 60_000;
  assert.deepEqual(learnedReaderMinutes(1, []), { minutes: readerMinutes(1), learned: false }, "no history: the formula");
  // done in 4 of its 6 minutes: 1.5 × 4 = 6 — the formula holds
  assert.deepEqual(learnedReaderMinutes(1, [{ outcome: "ok", views: 1, ms: 4 * min }]), { minutes: 6, learned: false });
  // done in 5 of 6: 7.5 → 8
  assert.deepEqual(learnedReaderMinutes(1, [{ outcome: "ok", views: 1, ms: 5 * min }]), { minutes: 8, learned: true });
  // stopped at its 6 minutes: it needed more than it had — twice that
  assert.deepEqual(learnedReaderMinutes(1, [{ outcome: "timeout", views: 1, ms: 6 * min + 3000, minutes: 6 }]), { minutes: 13, learned: true });
  assert.deepEqual(learnedReaderMinutes(1, [{ outcome: "timeout", views: 1, minutes: 6 }]), { minutes: 12, learned: true }, "its limit when its time is not said");
  // a long batch says what share of its own limit it needed, not that a crop needs as long
  assert.deepEqual(learnedReaderMinutes(1, [{ outcome: "ok", views: 10, ms: 12 * min }]), { minutes: 8, learned: true });
  assert.equal(learnedReaderMinutes(10, [{ outcome: "ok", views: 10, ms: 12 * min }]).minutes, READER_MINUTES_CEILING, "never above the ceiling");
  assert.equal(learnedReaderMinutes(1, [{ outcome: "timeout", views: 1, minutes: 30 }]).minutes, READER_MINUTES_CEILING);
  // a limit set small by hand and reached, a reader halted by a login or a plan's limit, a failure: nothing learned
  assert.deepEqual(learnedReaderMinutes(1, [{ outcome: "timeout", views: 1, minutes: 0.05, ms: 4000 }, { outcome: "limit", views: 1, ms: 14 * min }, { outcome: "error", views: 1, ms: 14 * min }]), { minutes: readerMinutes(1), learned: false });
  // only the recent ones
  const old = [{ outcome: "timeout", views: 1, minutes: 6 }, ...Array.from({ length: READER_LEARN_RECENT }, () => ({ outcome: "ok", views: 1, ms: 2 * min }))];
  assert.deepEqual(learnedReaderMinutes(1, old), { minutes: readerMinutes(1), learned: false });
});

test("strom read: the next reader of the same agent and model gets the time earlier ones needed, said and recorded; --minutes wins", unix, async () => {
  const w = new World();
  try {
    await treeWithScans(w);
    w.env.STROM_RUNNER_SCRIPT = path.join(w.dir, "quick-reader.mjs");
    fs.writeFileSync(w.env.STROM_RUNNER_SCRIPT, 'const p = process.env.STROM_PROMPT ?? "";\nfor (const m of p.matchAll(/^- (M\\d{4}) · image (\\d+)/gm)) console.log("## Image " + m[2] + " · " + m[1] + "\\nresult: nothing\\n");\n');
    const file = path.join(w.cwd, ".strom", "metrics", "readers.jsonl");
    const records = () => fs.readFileSync(file, "utf8").trim().split("\n").map((l) => JSON.parse(l));
    const read = (more: string[] = []) => w.ok(["read", "B1:1", "--crop", "0.1,0.2,0.3,0.2", "--question", "Křest Jana Nováka (Ткач)", "--agent", "script", ...more]);
    const first = await read();
    assert.match(first.out, new RegExp(`▶ reader 1/1: 1 image \\(1\\) · at most ${readerMinutes(1)} min\\n`), "no history: the formula");
    const r0 = records().at(-1)!;
    assert.deepEqual([r0.minutes, r0.minutesFrom, typeof r0.wallMs], [readerMinutes(1), "default", "number"]);
    // a reader of this agent and model stopped at its limit, another agent's that needed the whole ceiling
    fs.appendFileSync(file, JSON.stringify({ at: new Date().toISOString(), by: "user", reader: "read-x-1", kind: "read", agent: "script", key: r0.key, views: 1, outcome: "timeout", minutes: 6, wallMs: 362_000 }) + "\n");
    fs.appendFileSync(file, JSON.stringify({ at: new Date().toISOString(), by: "user", reader: "read-y-1", kind: "read", agent: "other", key: "другой агент", views: 1, outcome: "timeout", minutes: 15, wallMs: 905_000 }) + "\n");
    const next = await read();
    assert.match(next.out, /▶ reader 1\/1: 1 image \(1\) · at most 13 min \(earlier readers of this agent and model needed more\)/);
    assert.deepEqual([records().at(-1)!.minutes, records().at(-1)!.minutesFrom], [13, "learned"]);
    // by hand: what it says
    const said = await read(["--minutes", "7"]);
    assert.match(said.out, /· at most 7 min\n/);
    assert.deepEqual([records().at(-1)!.minutes, records().at(-1)!.minutesFrom], [7, "option"]);
  } finally {
    w.cleanup();
  }
});

/**
 * Claude Code as a reader whose service goes silent after a retry (found live 2026-10-27: api_retry, then 14.5 minutes
 * of nothing to its time limit): the first start says a retry and goes silent; resumed (--resume), it answers with a
 * block for each image of its brief (FAKE_MODE recover) or goes silent again (again). Each start written down.
 */
function silentClaude(w: World): () => { args: string[]; stdin: string }[] {
  const bin = path.join(w.dir, "silent-bin");
  fs.mkdirSync(bin, { recursive: true });
  const calls = path.join(w.dir, "claude-calls.jsonl");
  const script = path.join(bin, "claude.mjs");
  fs.writeFileSync(
    script,
    `import fs from "node:fs";
const args = process.argv.slice(2);
const stdin = fs.readFileSync(0, "utf8");
fs.appendFileSync(${JSON.stringify(calls)}, JSON.stringify({ args, stdin }) + "\\n");
const say = (o) => process.stdout.write(JSON.stringify(o) + "\\n");
say({ type: "system", subtype: "init", session_id: "s", model: "claude-opus-5-5", tools: ["Read", "Edit", "Write"] });
const brief = JSON.parse(fs.readFileSync(${JSON.stringify(calls)}, "utf8").split("\\n")[0]).stdin;
if (args.includes("--resume") && process.env.FAKE_MODE === "recover") {
  const blocks = [...brief.matchAll(/^- (M\\d{4}) · image (\\d+)/gm)].map((m) => "## Image " + m[2] + " · " + m[1] + "\\nresult: nothing\\n");
  say({ type: "result", result: blocks.join("\\n"), total_cost_usd: 0.03, num_turns: 3 });
} else {
  say({ type: "system", subtype: "api_retry", attempt: 1, max_retries: 10, retry_delay_ms: 0, error_status: null, error: "unknown" });
  setTimeout(() => {}, 60_000);
}
`,
  );
  fs.writeFileSync(path.join(bin, "claude"), `#!/bin/sh\nexec "${process.execPath}" "${script}" "$@"\n`, { mode: 0o755 });
  w.env.PATH = `${bin}${path.delimiter}${w.env.PATH}`;
  w.env.STROM_READER_STALL_MS = "300";
  return () => fs.readFileSync(calls, "utf8").trim().split("\n").map((l) => JSON.parse(l));
}

test("strom read: a reader silent after a retry of its service is resumed once and reads on; silent again, it is halted at once — never a reader without a result", unix, async () => {
  const w = new World();
  try {
    await treeWithScans(w);
    const calls = silentClaude(w);
    const file = path.join(w.cwd, ".strom", "metrics", "readers.jsonl");
    const last = () => JSON.parse(fs.readFileSync(file, "utf8").trim().split("\n").at(-1)!);
    const read = (mode: string) => w.run(["read", "B1", "--images", "1-2", "--whole", "--question", "Křest Jana Lhotáka (Ткач)", "--agent", "claude", "--parallel", "1"], { env: { FAKE_MODE: mode } });

    const started = Date.now();
    const ok = await read("recover");
    assert.ok(Date.now() - started < 60_000);
    assert.equal(ok.code, 0, ok.out + ok.err);
    assert.match(ok.out, /^found on: none$/m);
    const resumed = calls();
    assert.equal(resumed.length, 2, "the same batch resumed once");
    assert.ok(resumed[1]!.args.includes("--resume"));
    assert.doesNotMatch(resumed[1]!.stdin, /THE IMAGES/, "where it stopped: its brief not again");
    assert.deepEqual([last().outcome, last().stalls, last().stalled], ["ok", 1, undefined]);

    fs.rmSync(path.join(w.dir, "claude-calls.jsonl"));
    const halted = await read("again");
    assert.equal(halted.code, 1);
    assert.equal(calls().length, 2, "resumed once, not more");
    const said = halted.out + halted.err;
    assert.match(said, /■ reader 1: its agent's service went silent after a retry, also when resumed — stopped/);
    assert.match(said, /readers that failed: 1–2 \(its agent's service went silent after a retry, also when resumed — stopped\)/);
    assert.match(said, /NOT reported: 1–2 — read these again/);
    // recorded as halted ("error", as an older strom reads it too), never as a reader without a result
    const rec = last();
    assert.deepEqual([rec.outcome, rec.stalled, rec.stalls], ["error", true, 2]);
    assert.equal(isHalted({ kind: "reader", outcome: rec.outcome }), true);
    const j = (await w.ok(["media", "calibrate", "--report", "--json"])).json;
    assert.equal(j.readers.halted, 1, JSON.stringify(j.readers));
    assert.deepEqual(j.readers.haltedBy, { stalled: 1 });
  } finally {
    w.cleanup();
  }
});

test("a reader its service left silent after a retry teaches the next one's time limit nothing — stopped at its limit so before, or recorded so now", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "strom limit ž "));
  try {
    const metrics = path.join(root, ".strom", "metrics");
    const runs = path.join(root, ".strom", "runs");
    fs.mkdirSync(metrics, { recursive: true });
    fs.mkdirSync(runs, { recursive: true });
    const at = new Date().toISOString();
    const put = (lines: Record<string, unknown>[]) => fs.writeFileSync(path.join(metrics, "readers.jsonl"), lines.map((l) => JSON.stringify(l)).join("\n") + "\n");
    const stopped = { at, by: "user", reader: "read-z-1", kind: "read", agent: "claude", key: "claude opus", views: 1, outcome: "timeout", minutes: 6, wallMs: 362_000 };
    put([stopped]);
    assert.deepEqual(readerLimit(root, "claude opus", 1), { minutes: 13, from: "learned" }, "a timeout of a reading: more time");
    fs.writeFileSync(path.join(runs, "read-z-1.log"), [JSON.stringify({ type: "system", subtype: "init" }), JSON.stringify({ type: "system", subtype: "api_retry", attempt: 1, error: "unknown" })].join("\n") + "\n");
    assert.deepEqual(readerLimit(root, "claude opus", 1), { minutes: readerMinutes(1), from: "default" }, "its log ends at the retry");
    put([{ ...stopped, reader: "read-z-2", outcome: "error", stalled: true, wallMs: 400_000 }]);
    assert.deepEqual(readerLimit(root, "claude opus", 1), { minutes: readerMinutes(1), from: "default" });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
