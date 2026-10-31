// The line of a run's progress for a command the agent ran: every runner the same — its first line, a cut said by "…".

import { test } from "node:test";
import assert from "node:assert/strict";
import { commandLine } from "../../src/runners/runner.ts";

test("commandLine: the first line, cut at 140 characters with …, a command of more lines cut too", () => {
  assert.equal(commandLine("strom brief"), "$ strom brief");
  const long = `strom source add "${"Křest Jana Lhotáka ".repeat(10)}"`;
  const line = commandLine(long);
  assert.equal([...line].length, 2 + 140);
  assert.ok(line.endsWith("…"), line);
  assert.equal(commandLine("x".repeat(140)), `$ ${"x".repeat(140)}`, "exactly 140: whole");
  assert.equal(commandLine("cat <<'EOF'\nstrom brief\nEOF"), "$ cat <<'EOF'…");
  assert.equal(commandLine("strom check\n"), "$ strom check", "a line break at the end cuts nothing");
  // never half of a character: an emoji, a non-Latin script at the cut
  const cut = [...commandLine(`echo ${"Ж".repeat(130)}😀😀😀😀😀😀😀😀😀😀`)];
  assert.equal(cut.length, 142);
  assert.doesNotMatch(cut.join(""), /[\uD800-\uDFFF](?![\uDC00-\uDFFF])/u);
});
