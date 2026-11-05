// strom refused to Codex as a run sees it (GitHub #8, Codex on Windows): the command is said through the shell Codex
// runs it in — `bash -lc '…'`, PowerShell's `-Command`, `cmd /c`, the call operator — and strom refused there is strom
// refused all the same; a command Codex did not run at all ("declined": its rules, an approval nobody gives in exec)
// counts as refused too; anything else first in the command is no refusal of strom.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { codexPolicyRejected, codexRefusedStrom, codexRunner } from "../../src/runners/codex.ts";
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
  for (const no of ["Bash: git add .", "Bash: stromek brief", "Bash: echo strom brief", `Bash: echo "x; strom brief"`, "Bash: Write-Output 'a | strom brief'", "Bash: Get-Content notes.md | Select-String strom", "WebFetch: https://strom.example"])
    assert.ok(!deniedStrom(no), no);
});

test("deniedStrom: strom first in any part of the command only when it was refused whole before it ran — after ;, &&, ||, a pipe or a new line (#8, Windows: Set-Location .; strom.cmd …)", () => {
  for (const yes of [
    "Bash: cd /tmp/Лотаки && strom brief",
    "Bash: Set-Location .; strom.cmd note add P0001 y",
    `Bash: powershell.exe -Command "Get-Content x | strom brief"`,
    `Bash: Set-Location .; & "C:\\Users\\Ondřej\\bin\\strom.cmd" note add P0001 z | Out-String`,
    "Bash: true || strom-beta brief",
    "Bash: echo start\nstrom session close --done x",
  ]) {
    assert.ok(deniedStrom(yes, true), yes);
    // refused while it ran (a sandbox): the program before strom was refused, strom never ran
    assert.ok(!deniedStrom(yes), yes);
  }
  for (const no of [`Bash: echo "x; strom brief"`, "Bash: Write-Output 'a | strom brief'", "Bash: Get-Content notes.md | Select-String strom"])
    assert.ok(!deniedStrom(no, true), no);
});

// (N1 of the check of a6c26556, 2026-11-05) the sandbox refused another program before strom: no refusal of strom
test("deniedStrom: a command its sandbox refused with another program first (touch ../x && strom …, npm i; strom brief) is no refusal of strom", () => {
  for (const no of [
    `Bash: /bin/zsh -lc "touch ../x && strom note add P0001 x"`,
    `Bash: /bin/zsh -lc 'git commit -m Lhoták && strom brief'`,
    "Bash: npm i; strom brief",
    `Bash: powershell.exe -Command "New-Item ..\\x; strom.cmd note add P0001 'Žofie'"`,
  ])
    assert.ok(!deniedStrom(no), no);
});

// Codex's log line of a command its policy refused before it ran, as `exec` writes it on its stderr (Rust's Debug twice:
// the error's message, the rejection's reason in it)
const debug = (s: string) => `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
const routerLine = (rendered: string, reason = "blocked by policy") =>
  `2026-11-05T08:41:20.247392Z ERROR codex_core::tools::router: error=exec_command failed: CreateProcess { message: ${debug(`Rejected(${debug(`\`${rendered}\` rejected: ${reason}`)})`)} }`;
const WINDOWS_ROUTER = fs.readFileSync(path.join(import.meta.dirname, "..", "fixtures", "agents", "codex-0.166-policy-rejected-windows.stderr"), "utf8");

test("codexPolicyRejected: a command Codex's policy refused, from its own log line — Windows (a saved real one) and POSIX", () => {
  assert.equal(routerLine(`"C:\\\\WINDOWS\\\\System32\\\\WindowsPowerShell\\\\v1.0\\\\powershell.exe" -Command 'strom.cmd note add P0001 x | Select-Object -First 5'`), WINDOWS_ROUTER.trim(), "the line as Codex writes it");
  assert.equal(codexPolicyRejected(WINDOWS_ROUTER.trim()), "strom.cmd note add P0001 x | Select-Object -First 5");
  const ps = (script: string) => `"C:\\\\WINDOWS\\\\System32\\\\WindowsPowerShell\\\\v1.0\\\\powershell.exe" -Command ${script}`;
  for (const [rendered, command, strom] of [
    [ps(`'Set-Location .; strom.cmd note add P0001 y'`), "Set-Location .; strom.cmd note add P0001 y", true],
    // a backslash keeps single quotes out: the shlex crate quotes the script in double quotes, \ before " and \
    [ps(`"& \\"C:\\\\Users\\\\Ondřej\\\\AppData\\\\Local\\\\Programs\\\\Strom\\\\strom.cmd\\" note add P0001 'Žofie' | Out-String"`), `"C:\\Users\\Ondřej\\AppData\\Local\\Programs\\Strom\\strom.cmd" note add P0001 'Žofie' | Out-String`, true],
    ["/bin/zsh -lc 'strom note add P0001 Лотак | head -5'", "strom note add P0001 Лотак | head -5", true],
    [ps(`'Get-Content notes/postup.md | Select-Object -First 5'`), "Get-Content notes/postup.md | Select-Object -First 5", false],
  ] as const) {
    const got = codexPolicyRejected(routerLine(rendered));
    assert.equal(got, command, rendered);
    assert.equal(deniedStrom(`Bash: ${got}`, true), strom, rendered);
  }
  // with colours (a terminal, or --color always): the same
  const coloured = WINDOWS_ROUTER.trim().replace("ERROR", "\u001b[31mERROR\u001b[0m").replace(/^(\S+)/u, "\u001b[2m$1\u001b[0m");
  assert.equal(codexPolicyRejected(coloured), "strom.cmd note add P0001 x | Select-Object -First 5");
});

test("codexPolicyRejected: a refusal by a rule (strom's git, strom login, the person's), rm -f, another error, a line cut short or quoted — none", () => {
  for (const line of [
    routerLine("/bin/zsh -lc 'git status'", "strom keeps the history: never git itself"),
    routerLine("/bin/zsh -lc 'strom login fs'", "a login and the seal are the user's own"),
    routerLine("/bin/zsh -lc 'strom brief'", "policy forbids commands starting with `strom`"),
    routerLine("/bin/zsh -lc 'strom brief | xargs rm -rf'", "rm -f style commands are not permitted. Use a safer approach"),
    `2026-11-05T08:41:20.247392Z ERROR codex_core::tools::router: error=exec_command failed: CreateProcess { message: "No such file or directory (os error 2)" }`,
    WINDOWS_ROUTER.trim().slice(0, 200),
    `notes/postup.md:3: ${WINDOWS_ROUTER.trim()}`,
    `"${WINDOWS_ROUTER.trim()}"`,
    "strom: Codex: model gpt-5 — from config.toml",
  ])
    assert.equal(codexPolicyRejected(line), undefined, line);
});

test("Codex: a command its policy refused is a refusal from its stderr alone — the same words in a command's output or the agent's message are none", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strom codex-policy ů "));
  try {
    const lines = [
      { type: "thread.started", thread_id: "0199aaaa-bbbb-7ccc-8ddd-000000000010" },
      { type: "turn.started" },
      { type: "item.completed", item: { id: "item_0", type: "command_execution", command: "powershell.exe -Command 'strom.cmd grep CreateProcess'", aggregated_output: `notes/postup.md:3: ${WINDOWS_ROUTER}`, exit_code: 0, status: "completed" } },
      { type: "item.completed", item: { id: "item_1", type: "agent_message", text: `Nelze zapisovat: ${WINDOWS_ROUTER}` } },
      { type: "turn.completed", usage: { input_tokens: 2, cached_input_tokens: 0, output_tokens: 2 } },
    ];
    const stream = path.join(dir, "stream.jsonl");
    fs.writeFileSync(stream, lines.map((l) => JSON.stringify(l)).join("\n") + "\n");
    const stderr = path.join(dir, "stderr.txt");
    const run = async (text: string | undefined) => {
      if (text === undefined) fs.rmSync(stderr, { force: true });
      else fs.writeFileSync(stderr, text);
      const env = { ...agentStandIn(dir, "codex"), FAKE_STREAM: stream, ...(text === undefined ? {} : { FAKE_STDERR: stderr }), STROM_SESSION: "N0001" };
      return codexRunner.run({ cwd: dir, prompt: "Brief", kickoff: "k", env, logFile: path.join(dir, "runs", "N0001.log") });
    };
    const quoted = await run(undefined);
    assert.equal(quoted.denied, undefined, "only quoted: nothing refused");
    const said = await run(`strom: Codex: model gpt-5\r\n${WINDOWS_ROUTER.trim()}\r\n${routerLine("/bin/zsh -lc 'git status'", "strom keeps the history: never git itself")}\n`);
    assert.deepEqual(said.denied, ["Bash: strom.cmd note add P0001 x | Select-Object -First 5"]);
    assert.deepEqual(said.deniedWhole, [0], "refused whole before it ran");
    assert.equal(said.metrics.denied, 1);
    assert.equal(said.outcome, "ok", "Codex went on and ended its turn");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
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
    assert.deepEqual(r.denied!.map((d) => deniedStrom(d)), [true, true, false]);
    assert.equal(r.deniedWhole, undefined, "refused while they ran, or declined: none refused whole");
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
    assert.deepEqual(r.denied!.map((d) => deniedStrom(d)), [true, true]);
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
