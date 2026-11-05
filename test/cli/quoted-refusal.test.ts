// (#8) strom's refusal under Codex counts with the exit code 0 (strom in a pipe) only with the mark of the session it
// ran in: whatever strom prints again of what an agent or a person wrote — a summary, the next step, a note, a task's
// text — in strom brief, session start, session show, the echo of session note and session close, note list, person
// show, task show and list, strom grep, never reads as a refusal of the session that prints it, in any shape the real
// one takes (plain, PowerShell 5.1's own, jq .). strom's real refusal in that session still does.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";
import { codexRefusedStrom } from "../../src/runners/codex.ts";
import { noPermission } from "../../src/core/writable.ts";

// chmod refuses nobody on Windows (its ACLs) nor root
const unix = { skip: !hasGit || process.platform === "win32" || process.getuid?.() === 0 };

/** strom's refusal in an earlier session (N0001), in the three shapes an agent copies it from: plain, PowerShell 5.1's, jq . */
function quotedShapes(): string[] {
  const e = noPermission("C:\\Users\\Ondřej Lhoták\\Strom\\Лотаки\\.strom\\tree.lock", { CODEX_THREAD_ID: "t", STROM_SESSION: "N0001" }, "win32");
  const unmarked = noPermission("/tmp/Лотаки/.strom/tree.lock", { CODEX_THREAD_ID: "t" }, "darwin");
  return [
    `error: ${e.message}`,
    `strom.cmd : error: ${e.message}\nAt line:1 char:1\n+ strom.cmd note add P0001 x 2>&1 | Select-Object\n    + FullyQualifiedErrorId : NativeCommandError`,
    JSON.stringify({ ...e.toJSON(), hint: undefined }, null, 2),
    `error: ${unmarked.message}`,
    `strom.cmd : error: ${unmarked.message}\nAt line:1 char:1`,
    JSON.stringify({ ...unmarked.toJSON(), hint: undefined }, null, 2),
  ];
}

test("the refusal an agent or a person quoted is printed by no strom command as a refusal of the session that prints it", unix, async () => {
  const w = new World();
  const tree = await w.withTree();
  const agent = { env: { CODEX_THREAD_ID: "0199aaaa-0001", STROM_WORKER: "codex-1" } };
  const shapes = quotedShapes();
  const text = (what: string, some = shapes) => `${what}:\n${some.join("\n")}\nkonec`;
  await w.ok(["person", "add", "Jiří /Lhoták/"]);
  for (const what of ["Křest Jana", "Křest Josefa"]) await w.ok(["task", "add", what, "--level", "locate", "--where", "farnost Lhota", "--why", "zkouška", "--done-when", "hotovo"]);
  // session N0001 met the refusal and wrote it down in every place it may
  await w.ok(["session", "start", "T0001"], agent);
  await w.ok(["session", "note", text("poznámka sezení")], agent);
  await w.ok(["note", "add", "P0001", text("poznámka k osobě")], agent);
  await w.ok(["session", "close", "--continue", "--summary", text("zápis odmítnut"), "--next", text("zkusit bez roury", shapes.slice(0, 3))], agent);
  // and in a file of its notes (strom grep reads inputs/ and notes/)
  fs.mkdirSync(path.join(tree, "notes"), { recursive: true });
  fs.writeFileSync(path.join(tree, "notes", "postup.md"), text("postup") + "\n");
  // the next session, N0002, reads it all again
  const said: [string, string][] = [];
  const read = async (args: string[]) => {
    const r = await w.run(args, agent);
    assert.ok(r.code === 0, `${args.join(" ")}: ${r.err}`);
    said.push([args.join(" "), r.out + r.err]);
  };
  await read(["session", "start", "T0002"]);
  const current = (await w.ok(["session", "show", "--json"], agent)).json.session.id as string;
  assert.equal(current, "N0002");
  await read(["brief"]);
  await read(["brief", "--json"]);
  await read(["session", "show", "N0001"]);
  await read(["session", "show", "N0001", "--json"]);
  await read(["session", "list"]);
  await read(["note", "list", "P0001"]);
  await read(["person", "show", "P0001"]);
  await read(["task", "show", "T0001"]);
  await read(["task", "list"]);
  await read(["grep", "sandbox"]);
  await read(["grep", "fs.sandboxed"]);
  await read(["session", "note", text("znovu")]);
  await read(["session", "close", "--continue", "--summary", text("znovu odmítnut"), "--next", text("dál", shapes.slice(0, 3))]);
  for (const [command, out] of said) {
    // (a list says a line of each, grep fs.sandboxed only the lines with the code, the echo of a note or a close a part)
    assert.ok(out.includes(/^grep fs/.test(command) ? '"code": "fs.sandboxed"' : "strom runs under an agent") || /^(task list|session list|session note|session close)/.test(command), `${command}: the quote is printed:\n${out}`);
    assert.ok(!codexRefusedStrom(out, current), `${command} printed a refusal of ${current}:\n${out}`);
  }
  // strom's own refusal in that session, plain and --json: a refusal
  const refused = { env: { CODEX_SANDBOX: "seatbelt", STROM_SESSION: "N0003" } };
  fs.chmodSync(path.join(tree, ".strom"), 0o555);
  try {
    const plain = await w.run(["person", "add", "Žofie /Lhotáková/"], { cwd: tree, ...refused });
    assert.equal(plain.code, 2);
    assert.match(plain.err, /sandbox forbids it \(strom session N0003\)\n/);
    assert.ok(codexRefusedStrom(plain.out + plain.err, "N0003"), plain.err);
    assert.ok(!codexRefusedStrom(plain.out + plain.err, "N0002"), plain.err);
    const json = await w.run(["person", "add", "Žofie /Lhotáková/", "--json"], { cwd: tree, ...refused });
    assert.equal(json.json.code, "fs.sandboxed");
    assert.ok(codexRefusedStrom(json.out, "N0003"), json.out);
  } finally {
    fs.chmodSync(path.join(tree, ".strom"), 0o755);
  }
  w.cleanup();
});
