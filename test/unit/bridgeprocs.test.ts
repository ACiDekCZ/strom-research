// The bridges running on this computer (K046): read from the table of processes (POSIX ps, Windows' CIM query of node.exe),
// each with its research's folder name — never a path — and its memory; a table not readable or memory not given said as
// such, never an error. Only read: nothing ended.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { bridgeRows, bridgesHere, isBridgeCommand, parseCimBridges, parsePsBridges, type Run } from "../../src/core/bridgeprocs.ts";
import { bridgesText } from "../../src/commands/setup.ts";
import { bridgesArea } from "../../src/commands/error.ts";
import { Masker } from "../../src/core/redact.ts";

const MB = 1024 * 1024;

test("a bridge's command line: strom's entry followed by live serve — never the phone's server, another command or a path that only says it", () => {
  assert.ok(isBridgeCommand("/Users/a/.local/share/strom/node/bin/node /Users/a/.local/share/strom/app/dist/cli.js live serve"));
  assert.ok(isBridgeCommand('"C:\\Users\\Lhoták\\AppData\\Local\\Programs\\Strom\\node\\node.exe" "C:\\Users\\Lhoták\\AppData\\Local\\Programs\\Strom\\app-1.35.0\\dist\\cli.js" live serve'));
  assert.ok(isBridgeCommand("node /tmp/strom test ěš x/src/cli.ts live serve"));
  assert.ok(!isBridgeCommand("node /x/dist/cli.js phone serve"));
  assert.ok(!isBridgeCommand("node /x/dist/cli.js live start"));
  assert.ok(!isBridgeCommand("node /x/dist/cli.js live serveless"));
  assert.ok(!isBridgeCommand("vim /notes/live serve.md"));
});

test("ps: the bridges of this user with their memory (KiB → bytes); another user's, the phone's server and other processes left out", () => {
  const ps = [
    "  4242   501  204800 /opt/node/bin/node /opt/strom/dist/cli.js live serve",
    "  4343   502  102400 /opt/node/bin/node /opt/strom/dist/cli.js live serve",
    "  4444   501   51200 /opt/node/bin/node /opt/strom/dist/cli.js phone serve",
    "  4545   501       - /opt/node/bin/node /tmp/strom test ěš/src/cli.ts live serve",
    "   777   501    1000 /bin/zsh",
  ].join("\n");
  assert.deepEqual(parsePsBridges(ps, 501), [
    { pid: 4242, rss: 200 * MB, command: "/opt/node/bin/node /opt/strom/dist/cli.js live serve" },
    { pid: 4545, command: "/opt/node/bin/node /tmp/strom test ěš/src/cli.ts live serve" },
  ]);
  assert.equal(parsePsBridges(ps).length, 3, "any user's when the user is not known");
});

test("Windows: the CIM query's JSON — one process (an object), several (an array), a command line not given (another user's), memory not given", () => {
  const one = JSON.stringify({ ProcessId: 4242, WorkingSetSize: 157286400, CommandLine: '"C:\\S\\node\\node.exe" "C:\\S\\app-1.35.0\\dist\\cli.js" live serve' });
  assert.deepEqual(parseCimBridges(one).map((b) => [b.pid, b.rss]), [[4242, 157286400]]);
  const many = JSON.stringify([
    { ProcessId: 1, WorkingSetSize: 100, CommandLine: null },
    { ProcessId: 2, WorkingSetSize: 200, CommandLine: '"C:\\S\\node\\node.exe" "C:\\S\\app\\dist\\cli.js" phone serve' },
    { ProcessId: 3, CommandLine: '"C:\\S\\node\\node.exe" "C:\\S\\app\\dist\\cli.js" live serve' },
  ]);
  assert.deepEqual(parseCimBridges(many).map((b) => [b.pid, b.rss]), [[3, undefined]]);
  assert.deepEqual(parseCimBridges(""), [], "no node.exe running");
  assert.deepEqual(parseCimBridges("not json"), []);
});

test("a table that cannot be read is no reading (undefined), never an error: ps failing, PowerShell refused or timing out", () => {
  const failing: Run = () => ({ status: null, stdout: "" });
  assert.equal(bridgeRows("darwin", failing), undefined);
  assert.equal(bridgeRows("win32", failing), undefined);
  assert.equal(bridgeRows("linux", () => { throw new Error("ENOENT"); }), undefined);
  // PowerShell answering nothing: no node.exe runs — read, none there
  assert.deepEqual(bridgeRows("win32", () => ({ status: 0, stdout: "" })), []);
});

/** A research folder with its bridge's note (live.json) naming `pid`. */
function research(dir: string, name: string, pid?: number): { name: string; root: string } {
  const root = path.join(dir, name);
  fs.mkdirSync(path.join(root, ".strom"), { recursive: true });
  if (pid !== undefined) fs.writeFileSync(path.join(root, ".strom", "live.json"), JSON.stringify({ pid, port: 1, root }));
  return { name, root };
}

test("each bridge with its research: known by its note, by the folder it runs in (POSIX), a folder strom does not know, one gone (orphan); the sum of memory", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strom bridges ěš "));
  try {
    const known = [research(dir, "Lhotákovi", 4242), research(dir, "Лгота"), research(dir, "Ticho")];
    const other = path.join(dir, "jiný výzkum");
    fs.mkdirSync(other);
    const uid = typeof process.getuid === "function" ? process.getuid() : 0;
    const line = (pid: number, kb: number | "-") => `${pid} ${uid} ${kb} /opt/node/bin/node /opt/strom/dist/cli.js live serve`;
    const asked: string[][] = [];
    const exec: Run = (cmd, args) => {
      asked.push([cmd, ...args]);
      if (cmd === "ps") return { status: 0, stdout: [line(4242, 204800), line(4343, 102400), line(4444, 51200), line(4545, "-"), line(4646, 1024)].join("\n") };
      // the folders the bridges run in: one of a known research without its note, another, one removed since, none said
      return { status: 0, stdout: [`p4343\nfcwd\nn${known[1]!.root}`, `p4444\nfcwd\nn${other}`, `p4545\nfcwd\nn${path.join(dir, "Lhota smazaná")}`].join("\n") };
    };
    const b = bridgesHere(known, { env: {}, platform: "darwin", exec });
    assert.equal(b.read, true);
    assert.deepEqual(
      b.list.map((x) => [x.pid, x.state, x.name, x.rss]),
      [
        [4242, "known", "Lhotákovi", 200 * MB],
        [4343, "known", "Лгота", 100 * MB],
        [4444, "other", "jiný výzkum", 50 * MB],
        [4646, "unknown", undefined, 1 * MB],
        [4545, "orphan", "Lhota smazaná", undefined],
      ],
    );
    assert.equal(b.rss, 351 * MB);
    assert.equal(b.unmeasured, 1);
    // one lsof for those not known by their note, never one per process
    assert.deepEqual(asked.filter((a) => a[0] === "lsof").map((a) => a[3]), ["4343,4444,4545,4646"]);
    // doctor: each with its folder's name and PID, the sum; never a path
    const en = bridgesText(b, "en");
    assert.equal(
      en,
      "5 running: Lhotákovi (PID 4242, 200 MB) · Лгота (PID 4343, 100 MB) · jiný výzkum (PID 4444, 50 MB) – a folder this strom does not know · research not told (PID 4646, 1.0 MB) · Lhota smazaná (PID 4545, memory not measured) – its research is gone · 351 MB in all",
    );
    assert.ok(!en.includes(dir) && !en.includes(path.sep + "Lhot"), en);
    const cs = bridgesText(b, "cs");
    assert.match(cs, /^běží 5: Lhotákovi \(PID 4242, 200 MB\)/u);
    assert.match(cs, /Lhota smazaná \(PID 4545, paměť nezjištěna\) – osiřelý, výzkum už neexistuje · celkem 351 MB$/u);
    // the report: numbers, states, the research by its code — this one "this" — never a name or a path
    const masker = new Masker({ key: Buffer.from("k"), home: dir, vocabulary: new Set() });
    masker.addTerms(b.list.flatMap((x) => (x.name ? [x.name] : [])), { weak: true });
    const area = bridgesArea(b, known[0]!.root, masker);
    const text = JSON.stringify(area);
    for (const word of ["Lhotákovi", "Лгота", "jiný", "smazaná", dir]) assert.ok(!text.normalize("NFC").includes(word.normalize("NFC")), `${word} in ${text}`);
    assert.deepEqual([area.running, area.memory, area.unmeasured, area.read], [5, 351 * MB, 1, true]);
    const each = area.each as { pid: number; research?: string; state: string; memory?: number }[];
    assert.equal(each[0]!.research, "this");
    assert.match(each[1]!.research!, /^‹[0-9a-f]{5}›$/u);
    assert.equal(each[3]!.research, undefined);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("Windows: a bridge runs in the settings' folder — known by its note, any other said as research not told; memory of each and the sum", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strom bridges win "));
  try {
    const known = [research(dir, "Lhotákovi", 4242)];
    const cim = JSON.stringify([
      { ProcessId: 4242, WorkingSetSize: 300 * MB, CommandLine: '"C:\\Users\\Lhoták\\AppData\\Local\\Programs\\Strom\\node\\node.exe" "C:\\Users\\Lhoták\\AppData\\Local\\Programs\\Strom\\app-1.35.0\\dist\\cli.js" live serve' },
      { ProcessId: 5151, WorkingSetSize: 120 * MB, CommandLine: '"C:\\S\\node\\node.exe" "C:\\S\\app-1.34.0\\dist\\cli.js" live serve' },
    ]);
    const exec: Run = (cmd, args) => {
      assert.equal(cmd, "powershell.exe", "no lsof, no ps on Windows");
      assert.match(args.join(" "), /Win32_Process.*node\.exe.*WorkingSetSize/u);
      return { status: 0, stdout: cim };
    };
    const b = bridgesHere(known, { env: {}, platform: "win32", exec });
    assert.deepEqual(b.list.map((x) => [x.pid, x.state, x.name]), [[4242, "known", "Lhotákovi"], [5151, "unknown", undefined]]);
    assert.equal(bridgesText(b, "en"), "2 running: Lhotákovi (PID 4242, 300 MB) · research not told (PID 5151, 120 MB) · 420 MB in all");
    assert.equal(bridgesText(b, "de"), "2 laufen: Lhotákovi (PID 4242, 300 MB) · Forschung nicht ermittelt (PID 5151, 120 MB) · insgesamt 420 MB");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("measuring that fails: the table not read is said as not found out; none running; no memory at all — the count without a sum", () => {
  const failed = bridgesHere([], { env: {}, platform: "win32", exec: () => ({ status: 1, stdout: "" }) });
  assert.deepEqual(failed, { read: false, list: [], rss: 0, unmeasured: 0 });
  assert.equal(bridgesText(failed, "en"), "not found out: the list of processes could not be read");
  assert.equal(bridgesText(failed, "cs"), "nezjištěno: seznam procesů nešel přečíst");
  const none = bridgesHere([], { env: {}, platform: "win32", exec: () => ({ status: 0, stdout: "" }) });
  assert.equal(bridgesText(none, "cs"), "žádný neběží");
  const blind = bridgesHere([], { env: {}, platform: "win32", exec: () => ({ status: 0, stdout: JSON.stringify({ ProcessId: 9, CommandLine: "node C:\\S\\dist\\cli.js live serve" }) }) });
  assert.equal(bridgesText(blind, "en"), "1 running: research not told (PID 9, memory not measured)");
});
