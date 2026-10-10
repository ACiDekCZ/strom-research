// Windows PowerShell 5.1 decodes a native program's output kept in a variable, piped into a cmdlet or redirected in the
// console's OEM code page: names with diacritics come out broken. An agent on Windows is told, in one line, how to put
// the console to UTF-8 first — in the tree's AGENTS.md and in the guide; on another system neither says a word of it.

import { test } from "node:test";
import assert from "node:assert/strict";
import { World, hasGit } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import { agentsMd } from "../../src/agents/files.ts";
import { guideText } from "../../src/commands/guide.ts";

const RULE = /In Windows PowerShell 5\.1, set `?\[Console\]::OutputEncoding = \[System\.Text\.UTF8Encoding\]::new\(\)`? before keeping strom's output in a variable, piping it or redirecting it, or names with diacritics are misread\./;

test("on Windows the agent hears how to keep strom's output in PowerShell 5.1 whole — one line, AGENTS.md and the guide; elsewhere nothing", { skip: !hasGit }, async () => {
  const w = new World();
  await w.withTree();
  const tree = Tree.open(w.cwd, w.env);
  const win = agentsMd(tree, "win32");
  const line = win.split("\n").find((l) => RULE.test(l));
  assert.ok(line, "AGENTS.md on Windows says it");
  assert.match(line!, /^ {3}In Windows PowerShell 5\.1, set `\[Console\]::OutputEncoding = \[System\.Text\.UTF8Encoding\]::new\(\)` before/, "one line of item 7, the code in backticks");
  assert.ok(win.indexOf("piped commands may") < win.indexOf(line!) && win.indexOf(line!) < win.indexOf("8. Other agents"), "under the rule about strom's output");
  for (const other of ["darwin", "linux"] as const) {
    assert.doesNotMatch(agentsMd(tree, other), /PowerShell|OutputEncoding/, other);
    assert.doesNotMatch(guideText("en", "https://stromapp.info/", undefined, other), /OutputEncoding/, other);
  }
  assert.equal(agentsMd(tree, "linux"), win.replace(`\n${line}`, ""), "nothing else differs");
  const guide = guideText("en", "https://stromapp.info/", undefined, "win32");
  assert.match(guide, /\n- In Windows PowerShell 5\.1, set \[Console\]::OutputEncoding = \[System\.Text\.UTF8Encoding\]::new\(\) before keeping strom's output/);
  w.cleanup();
});
