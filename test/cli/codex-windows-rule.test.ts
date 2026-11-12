// K031: Codex on Windows (measured 2026-11-12, codex-cli 0.167.2) lets strom out of its sandbox only when it splits the
// PowerShell script into plain words beginning with strom — `& strom`, a pipe, `Set-Location`, `cmd /c` and any
// argument with a dash (–) go into the sandbox, quotes inside a quoted text are lost. An agent on Windows hears it in
// the tree's AGENTS.md, the guide and the sandbox's hint; on another system none says it. strom's own examples for the
// agent never offer a dash between numbers inside a quoted argument (an agent copies them). A text that needs either goes
// through a file: strom batch --file keeps it whole.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import { agentsMd } from "../../src/agents/files.ts";
import { guideText } from "../../src/commands/guide.ts";
import { sandboxHint } from "../../src/core/writable.ts";
import "../../src/commands/index.ts";
import { commands } from "../../src/cli/registry.ts";

const RULE = /Codex on Windows lets strom out of its sandbox only as plain words: strom first .*a plain hyphen \(1890-1900, never the dash –\) and no quotes inside a quoted text/u;

test("Codex on Windows: AGENTS.md, the guide and the sandbox's hint say what sends strom into its sandbox; elsewhere nothing (K031)", { skip: !hasGit }, async () => {
  const w = new World();
  try {
    await w.withTree();
    const tree = Tree.open(w.cwd, w.env);
    assert.match(agentsMd(tree, "win32"), RULE);
    assert.match(agentsMd(tree, "win32"), /never `& strom`, `cmd \/c` or `Set-Location` before it/u, "the code in backticks");
    assert.match(agentsMd(tree, "win32"), /its command line in a file of notes\/, run by `strom batch --file notes\/<file>\.txt`/u, "a long text through a file");
    assert.match(guideText("en", "https://stromapp.info/", undefined, "win32"), /\n- Codex on Windows lets strom out of its sandbox/u);
    for (const other of ["darwin", "linux"] as const) {
      assert.doesNotMatch(agentsMd(tree, other), /Codex on Windows/u, other);
      assert.doesNotMatch(guideText("en", "https://stromapp.info/", undefined, other), /Codex on Windows/u, other);
    }
    const codex = { STROM_IN_AGENT: "codex", STROM_SESSION: "N0001" };
    assert.match(sandboxHint(codex, undefined, "win32"), /on Windows also no & or cmd \/c before it, a plain hyphen \(-\) never the dash \(–\) in its texts, no quotes inside a quoted text/u);
    assert.doesNotMatch(sandboxHint(codex, undefined, "linux"), /dash/u);
  } finally {
    w.cleanup();
  }
});

test("strom's examples for the agent: no dash between numbers inside a quoted argument (K031)", () => {
  const quoted = /"[^"]*\p{N}–\p{N}[^"]*"/u;
  const found = commands().flatMap((c) => (c.examples ?? []).filter((e) => quoted.test(e)).map((e) => `${c.path.join(" ")}: ${e}`));
  assert.deepEqual(found, []);
});

test("a note with a dash and quotes inside it through strom batch --file: kept whole (K031)", { skip: !hasGit }, async () => {
  const w = new World();
  try {
    await w.withTree("Lhotákovi");
    const root = w.treeDir("Lhotákovi");
    await w.ok(["session", "start"]);
    const text = String.raw`Svazky 1890–1900 prošlé, „nic“ – ani \"vnořené\" uvozovky`;
    fs.writeFileSync(path.join(root, "notes", "poznamka.txt"), `session note "${text}"\n`);
    await w.ok(["batch", "--file", "notes/poznamka.txt"], { cwd: root });
    const session = (await w.ok(["session", "show", "--json"], { cwd: root })).json.session;
    assert.equal(session.notes.at(-1).text, "Svazky 1890–1900 prošlé, „nic“ – ani \"vnořené\" uvozovky");
  } finally {
    w.cleanup();
  }
});
