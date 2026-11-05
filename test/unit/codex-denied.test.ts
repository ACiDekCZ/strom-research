// strom refused to Codex as a run sees it (GitHub #8, Codex on Windows): the command is said through the shell Codex
// runs it in — `bash -lc '…'`, PowerShell's `-Command`, `cmd /c`, the call operator — and strom refused there is strom
// refused all the same; a command Codex did not run at all ("declined": its rules, an approval nobody gives in exec)
// counts as refused too; anything else first in the command is no refusal of strom.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { codexRunner } from "../../src/runners/codex.ts";
import { deniedStrom, shellUnwrapped } from "../../src/runners/runner.ts";
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
