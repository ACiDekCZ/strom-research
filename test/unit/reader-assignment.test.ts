// A reader's assignment only for what the task asks: whoever reads scans for the agent — strom read's readers, the scan
// reader, Claude Code's delegates, OpenCode's scan reader — is told exactly what to write down and transcribes nothing
// else (found live: a reader transcribed every entry of a range where the task needed the page numbers and headings).

import { test } from "node:test";
import assert from "node:assert/strict";
import "../../src/commands/index.ts";
import { readerPrompt } from "../../src/core/reader.ts";
import { scanReaderPrompt } from "../../src/agents/scanreader.ts";
import { PROFILES, selfReading } from "../../src/agents/profiles.ts";
import { methodFor, METHOD_CONDITIONS } from "../../src/core/assets.ts";
import { commands } from "../../src/cli/registry.ts";

test("readers and delegates of every agent write down only what they are asked: page numbers and headings, one surname's entries, one entry whole", () => {
  const prompt = readerPrompt({ question: "x", images: [{ id: "M0001", image: 1, view: "/v/1.jpg" }], report: "/r.md", lang: "cs" });
  assert.match(prompt, /Transcribe only what the question asks for \(page numbers and headings only, the entries of one\nsurname, one entry whole\): nothing else, however much is on the page\./);
  assert.match(scanReaderPrompt(), /Reading: only what the question asks for \(page numbers and headings only, the entries of one surname,\none entry whole\) — transcribe nothing else\./);
  assert.match(PROFILES.claude!.instructions({}), /- Every delegate gets the full question \(what counts as a find, which years,\n {2}which names\) and exactly what to write down — page numbers and headings\n {2}only, the entries of one surname, one entry whole: it transcribes nothing\n {2}else\./);
  // the agents that read themselves hand OpenCode's scan reader its batch the same way
  for (const id of ["codex", "antigravity", "opencode", "grok"]) assert.match(PROFILES[id]!.instructions({}), /hand\nit a batch with the whole question and exactly what to write down \(page\nnumbers only, one surname's entries, one entry whole\)/, id);
  assert.match(selfReading(), /exactly what to write down/);
  // a sub-agent of the agent's own (Codex's spawn_agent) is told the same, and its "unclear" holds a negative back
  assert.match(selfReading(), /\(Codex: spawn_agent\)[\s\S]*views — and exactly what to write down;\nits report is recorded at once \(its "unclear": look there closer first\)\./);
  // the method of every level that reads records, and strom read's own option
  for (const level of ["link", "verify", "enrich", "intake"])
    assert.match(methodFor(level, [...METHOD_CONDITIONS]), /\*\*A reader is told exactly what to write down\*\* — page numbers\n {2}and headings only, one surname's entries, one entry whole — and transcribes\n {2}nothing else\./, level);
  const read = commands().find((c) => c.path.join(" ") === "read")!;
  assert.match(read.options!.find((o) => o.name === "question")!.description, /what to write down \(page numbers only, one surname's entries, one entry whole\)/);
});
