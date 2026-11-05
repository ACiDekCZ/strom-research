// strom refused to Codex as a run sees it (GitHub #8, Codex on Windows): the command is said through the shell Codex
// runs it in — `bash -lc '…'`, PowerShell's `-Command`, `cmd /c`, the call operator — and strom refused there is strom
// refused all the same; a command Codex did not run at all ("declined": its rules, an approval nobody gives in exec)
// counts as refused too; anything else first in the command is no refusal of strom.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { codexRefusedStrom, codexRunner } from "../../src/runners/codex.ts";
import { deniedStrom, shellUnwrapped } from "../../src/runners/runner.ts";
import { noPermission, refusalMark, SANDBOX_REFUSAL } from "../../src/core/writable.ts";
import { agentStandIn } from "../helpers.ts";

test("shellUnwrapped: the command without the shell around it — sh, PowerShell, cmd, the call operator; any script kept", () => {
  assert.equal(shellUnwrapped("bash -lc 'strom brief'"), "strom brief");
  assert.equal(shellUnwrapped("/bin/zsh -lc 'strom note add P1 \"Žofie\"'"), 'strom note add P1 "Žofie"');
  assert.equal(shellUnwrapped(`"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -NoProfile -Command "strom.cmd person add 'Jiří /Lhoták/'"`), "strom.cmd person add 'Jiří /Lhoták/'");
  assert.equal(shellUnwrapped("powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -Command strom session close"), "strom session close");
  assert.equal(shellUnwrapped("pwsh -c 'strom brief'"), "strom brief");
  assert.equal(shellUnwrapped('cmd.exe /c "strom.cmd brief"'), "strom.cmd brief");
  assert.equal(shellUnwrapped(`powershell.exe -Command "& 'C:\\Users\\Ondřej Lhoták\\AppData\\Local\\strom\\bin\\strom.cmd' brief"`), "'C:\\Users\\Ondřej Lhoták\\AppData\\Local\\strom\\bin\\strom.cmd' brief");
  assert.equal(shellUnwrapped("strom brief"), "strom brief");
  assert.equal(shellUnwrapped("Пётр Лотак"), "Пётр Лотак");
});

test("deniedStrom: strom by its name or path, first in the command, through any shell — never another program", () => {
  for (const yes of [
    "Bash: strom input show I0001",
    "Bash: /usr/local/bin/strom brief",
    "PowerShell: strom.cmd note add P1 x",
    `Bash: "C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -NoProfile -Command 'strom.cmd note add P0001 "Lhoták"'`,
    `Bash: powershell.exe -Command "& 'C:\\Users\\Ondřej\\bin\\strom.cmd' session close"`,
    "Bash: cmd /c strom.exe brief",
    "Bash: strom-beta brief",
    "Bash: strom",
  ])
    assert.ok(deniedStrom(yes), yes);
  for (const no of ["Bash: git add .", "Bash: stromek brief", "Bash: echo strom brief", "Bash: powershell.exe -Command \"Get-Content x | strom brief\"", "WebFetch: https://strom.example"])
    assert.ok(!deniedStrom(no), no);
});

test("Codex: strom refused by its sandbox through PowerShell, and a command it declined, are refusals — said as the agent meant them", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strom codex-denied ě "));
  try {
    const ps = `"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -NoProfile -Command 'strom.cmd note add P0001 "Lhoták"'`;
    const lines = [
      { type: "thread.started", thread_id: "0199aaaa-bbbb-7ccc-8ddd-000000000008" },
      { type: "turn.started" },
      { type: "item.completed", item: { id: "item_0", type: "command_execution", command: ps, aggregated_output: "error: no permission to write into the research's .git — run this strom command outside the agent's sandbox", exit_code: 1, status: "failed" } },
      { type: "item.completed", item: { id: "item_1", type: "command_execution", command: "powershell.exe -Command 'strom.cmd session close --summary x'", aggregated_output: "", exit_code: null, status: "declined" } },
      { type: "item.completed", item: { id: "item_2", type: "command_execution", command: "powershell.exe -Command 'Get-ChildItem'", aggregated_output: "Access is denied.", exit_code: 1, status: "failed" } },
      { type: "item.completed", item: { id: "item_3", type: "command_execution", command: "powershell.exe -Command 'strom brief'", aggregated_output: "brief", exit_code: 0, status: "completed" } },
      { type: "item.completed", item: { id: "item_4", type: "agent_message", text: "Zápis odmítnut, končím." } },
      { type: "turn.completed", usage: { input_tokens: 100, cached_input_tokens: 0, output_tokens: 10 } },
    ];
    const stream = path.join(dir, "stream.jsonl");
    fs.writeFileSync(stream, lines.map((l) => JSON.stringify(l)).join("\n") + "\n");
    const env = { ...agentStandIn(dir, "codex"), FAKE_STREAM: stream };
    const progress: string[] = [];
    const r = await codexRunner.run({ cwd: dir, prompt: "Brief", kickoff: "k", env, logFile: path.join(dir, "runs", "N0001.log"), onProgress: (l) => progress.push(l) });
    assert.deepEqual(r.denied, ['Bash: strom.cmd note add P0001 "Lhoták"', "Bash: strom.cmd session close --summary x", "Bash: Get-ChildItem"]);
    assert.deepEqual(r.denied!.map(deniedStrom), [true, true, false]);
    assert.equal(r.metrics.denied, 3);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("Codex: strom refused by its sandbox in a pipe (exit code 0, the last program's) is a refusal; a command that only prints the word is none", async () => {
  // as codex-cli 0.155.1 said it (exec_command, the local model stand-in): `strom … | cat` refused, the pipe's code 0
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strom codex-pipe ř "));
  try {
    const refusal = noPermission("/tmp/Lhotovi/.strom/tree.lock.1.x.tmp", { STROM_WORKER: "codex-1", STROM_SESSION: "N0001" }, "darwin").message;
    assert.ok(refusal.includes(SANDBOX_REFUSAL), "strom says it word for word");
    const lines = [
      { type: "thread.started", thread_id: "0199aaaa-bbbb-7ccc-8ddd-000000000009" },
      { type: "turn.started" },
      { type: "item.started", item: { id: "item_1", type: "command_execution", command: `/bin/zsh -lc "strom note add P0001 'Žofie' | cat"`, aggregated_output: "", exit_code: null, status: "in_progress" } },
      { type: "item.completed", item: { id: "item_1", type: "command_execution", command: `/bin/zsh -lc "strom note add P0001 'Žofie' | cat"`, aggregated_output: `error: ${refusal}\n→ strom run on its own (no pipe, no redirection like 2>&1, no cd before it)\n`, exit_code: 0, status: "completed" } },
      { type: "item.completed", item: { id: "item_2", type: "command_execution", command: `powershell.exe -Command 'strom.cmd note add P0001 x | Select-Object -First 5'`, aggregated_output: `error: ${refusal}\r\n`, exit_code: 0, status: "completed" } },
      { type: "item.completed", item: { id: "item_3", type: "command_execution", command: "/bin/zsh -lc 'grep -i sandbox AGENTS.md'", aggregated_output: "strom run on its own: the research's .codex/rules/strom.rules lets that run outside Codex's sandbox\n", exit_code: 0, status: "completed" } },
      { type: "item.completed", item: { id: "item_4", type: "agent_message", text: "Zápis odmítnut, končím." } },
      { type: "turn.completed", usage: { input_tokens: 2, cached_input_tokens: 0, output_tokens: 2 } },
    ];
    const stream = path.join(dir, "stream.jsonl");
    fs.writeFileSync(stream, lines.map((l) => JSON.stringify(l)).join("\n") + "\n");
    const env = { ...agentStandIn(dir, "codex"), FAKE_STREAM: stream, STROM_SESSION: "N0001" };
    const r = await codexRunner.run({ cwd: dir, prompt: "Brief", kickoff: "k", env, logFile: path.join(dir, "runs", "N0001.log") });
    assert.deepEqual(r.denied, ["Bash: strom note add P0001 'Žofie' | cat", "Bash: strom.cmd note add P0001 x | Select-Object -First 5"]);
    assert.deepEqual(r.denied!.map(deniedStrom), [true, true]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// (found 2026-11-05) a session sums up a refusal in strom's words; strom brief, session show, strom grep print them again
// with the exit code 0 — only quoted, no refusal: the run went on before 867eecf7 and must again
const QUOTED_BRIEF = fs.readFileSync(path.join(import.meta.dirname, "..", "fixtures", "agents", "brief-quotes-sandbox-refusal.txt"), "utf8");

// strom's refusal as a session strom started says it (STROM_SESSION), and as an earlier session's quoted
const refusalIn = (session: string | undefined, where = "C:\\Users\\Ondřej Lhoták\\Strom\\Лотаки\\.strom\\tree.lock") =>
  noPermission(where, { STROM_WORKER: "codex-1", ...(session ? { STROM_SESSION: session } : {}) }, "win32");

test("strom's refusal under a session strom started carries the session's mark; without one, none", () => {
  assert.equal(refusalIn("N0042").message, `no permission to use: C:\\Users\\Ondřej Lhoták\\Strom\\Лотаки\\.strom\\tree.lock — ${SANDBOX_REFUSAL} (strom session N0042)`);
  assert.equal(refusalIn(undefined).message, `no permission to use: C:\\Users\\Ondřej Lhoták\\Strom\\Лотаки\\.strom\\tree.lock — ${SANDBOX_REFUSAL}`);
  assert.equal(refusalMark("N0042"), "(strom session N0042)");
  for (const none of [undefined, "", "N0042) x", "N 1", "x".repeat(41)]) assert.equal(refusalMark(none), undefined, String(none));
});

// (#8) every shape strom's own error takes as a pipe passes it on with the exit code 0: plain, --json, CRLF, a hint
// after; Windows PowerShell 5.1's own (NativeCommandError, wrapped at the console's width); the dash spoiled by the
// console's code page; jq . and jq -r .message
function refusalShapes(e: ReturnType<typeof noPermission>): string[] {
  const line = `error: ${e.message}`;
  const native = (text: string, name = "strom.cmd") =>
    `${name} : ${text}\r\nAt line:1 char:1\r\n+ strom.cmd note add P0001 "Žofie" 2>&1 | Select-Object\r\n+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~\r\n` +
    `    + CategoryInfo          : NotSpecified: (error: no permis...sandbox forbids it:String) [], RemoteException\r\n    + FullyQualifiedErrorId : NativeCommandError\r\n \r\n→ ${e.hint}\r\n`;
  // the console's width: the line cut every 80 characters, nothing added
  const at80 = (text: string) => text.match(/[^]{1,80}/gu)!.join("\r\n");
  const pretty = JSON.stringify(e.toJSON(), null, 2);
  return [
    `${line}\n`,
    line,
    `${line}\r\n→ ${e.hint}\r\n`,
    `před tím výstup\n${line}\n→ strom run on its own\n`,
    JSON.stringify(e.toJSON()) + "\n",
    `${JSON.stringify(e.toJSON())}\r\n`,
    line.normalize("NFD"),
    native(line),
    native(line, "node.exe"),
    native(line, "strom-test.ps1"),
    at80(`strom.cmd : ${line}`) + "\r\nAt line:1 char:1\r\n+ strom.cmd note add P0001 x 2>&1 | Out-String\r\n",
    at80(`strom.cmd : ${line}`.slice(3)),
    native(line).replace(/\r\n/g, "\n"),
    line.replace("—", "â€”"),
    line.replace("—", "ÔÇö"),
    line.replace("—", "?"),
    line.replace("—", "\uFFFD"),
    native(line.replace("—", "?").replace("ř", "?").replace("á", "?")),
    JSON.stringify(e.toJSON()).replace("—", "â€”") + "\r\n",
    pretty + "\n",
    pretty.replace(/\n/g, "\r\n") + "\r\n",
    pretty.replace(/": /g, '":  '),
    `${e.message}\n`,
  ];
}

test("codexRefusedStrom: strom's own error in every shape a pipe gives it, with this session's mark — a refusal", () => {
  for (const shape of [...refusalShapes(refusalIn("N0002")), ...refusalShapes(noPermission(undefined, { STROM_WORKER: "codex-1", STROM_SESSION: "N0002" }, "darwin"))])
    assert.ok(codexRefusedStrom(shape, "N0002"), shape);
});

test("codexRefusedStrom: the same words quoted — another session's mark, none, any shape — or no session of strom's: never a refusal", () => {
  const no = [
    QUOTED_BRIEF,
    ...refusalShapes(refusalIn("N0001")),
    ...refusalShapes(refusalIn("N00021")),
    ...refusalShapes(refusalIn(undefined)),
    `  N0001 closed on T0001: note add v rouře odmítnut: ${SANDBOX_REFUSAL}\n`,
    `${SANDBOX_REFUSAL} (strom session N0002`,
    `${SANDBOX_REFUSAL} (strom session N0002 )\n`,
    `notes/postup.md:3:  "code": "fs.sandboxed",\n`,
    "",
  ];
  for (const shape of no) assert.ok(!codexRefusedStrom(shape, "N0002"), shape);
  for (const shape of refusalShapes(refusalIn("N0002"))) {
    assert.ok(!codexRefusedStrom(shape, undefined), shape);
    assert.ok(!codexRefusedStrom(shape, ""), shape);
  }
});

test("Codex: the refusal only quoted with the exit code 0 — strom brief, session show, strom grep, cat, echo — is no refusal, not even counted", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strom codex-quoted ů "));
  try {
    const quoted = `notes/postup.md:3: zápis odmítnut: no permission to use: /tmp/Лотаки/.strom/tree.lock — ${SANDBOX_REFUSAL}\n`;
    const said = (id: string, command: string, output: string, exit_code = 0) => ({ type: "item.completed", item: { id, type: "command_execution", command, aggregated_output: output, exit_code, status: exit_code ? "failed" : "completed" } });
    const lines = [
      { type: "thread.started", thread_id: "0199aaaa-bbbb-7ccc-8ddd-000000000010" },
      { type: "turn.started" },
      said("item_1", `/bin/zsh -lc "strom brief"`, QUOTED_BRIEF),
      said("item_2", `/bin/zsh -lc "strom session show N0001"`, `N0001 closed · T0001\nsummary: note add v rouře odmítnut: ${SANDBOX_REFUSAL}\nnext: zkusit bez roury\n`),
      said("item_3", `/bin/zsh -lc "strom grep sandbox"`, quoted),
      said("item_4", `/bin/zsh -lc "strom person show P0001"`, `P0001 Jiří Lhoták\n  note: ${SANDBOX_REFUSAL}\n`),
      said("item_5", `/bin/zsh -lc "cat notes/postup.md"`, quoted),
      said("item_6", `/bin/zsh -lc "grep -r sandbox .strom/runs"`, quoted),
      said("item_7", `/bin/zsh -lc "echo '${SANDBOX_REFUSAL}'"`, `${SANDBOX_REFUSAL}\n`),
      // an earlier session's refusal, its mark too, quoted in whatever shape
      ...refusalShapes(refusalIn("N0001")).map((shape, i) => said(`item_q${i}`, `/bin/zsh -lc "strom session show N0001"`, shape)),
      { type: "item.completed", item: { id: "item_8", type: "agent_message", text: "Hledám dál." } },
      { type: "turn.completed", usage: { input_tokens: 2, cached_input_tokens: 0, output_tokens: 2 } },
    ];
    const stream = path.join(dir, "stream.jsonl");
    fs.writeFileSync(stream, lines.map((l) => JSON.stringify(l)).join("\n") + "\n");
    const env = { ...agentStandIn(dir, "codex"), FAKE_STREAM: stream, STROM_SESSION: "N0002" };
    const r = await codexRunner.run({ cwd: dir, prompt: "Brief", kickoff: "k", env, logFile: path.join(dir, "runs", "N0002.log") });
    assert.equal(r.denied, undefined);
    assert.equal(r.metrics.denied, undefined);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
