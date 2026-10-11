// The search beyond the registers before a story has a budget: about ENRICH_PAGES pages fetched or read, then the
// searches recorded and the session closed; printed pages for the user's model for print where the agent hands work to
// another model; the history of a place searched once in a research — what is written of it already is named (found
// live: two such sessions cost $7 and found nothing on the person).

import { test } from "node:test";
import assert from "node:assert/strict";
import { World, hasGit } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import { buildBrief } from "../../src/brief/brief.ts";
import { ENRICH_PAGES, STORY_SOURCES_ORIGIN } from "../../src/core/stories.ts";
import { WEB_SOFT } from "../../src/core/metrics.ts";
import { methodFor } from "../../src/core/assets.ts";
import type { Session, Task } from "../../src/core/model.ts";

const opts = { skip: !hasGit };

test("the brief of a search beyond the registers: its budget of pages, print for model.text, what is written of the person's places", opts, async () => {
  const w = new World();
  await w.withTree("Dvořákovi");
  await w.ok(["research", "new", "Předci", "--new-person", "Kryštof /Žďárský/", "--sex", "M", "--born", "1850"]);
  await w.ok(["place", "add", "Dolní Lhota", "--kind", "village", "--unlocated", "test"]); // L0001
  await w.ok(["place", "add", "Ves", "--kind", "village", "--unlocated", "test"]); // L0002
  await w.ok(["event", "add", "P1", "RESI", "--place", "Dolní Lhota", "--date", "1870"]);
  // the history of the place, written in an earlier session (its name in another form); a register entry is no history
  await w.ok(["source", "add", "Dějiny Dolní Lhoty a okolí", "--kind", "book", "--transcript", "Obec vyhořela roku 1866."]); // S0001
  await w.ok(["source", "add", "Křest v Dolní Lhotě", "--kind", "baptism"]); // S0002
  await w.ok(["source", "add", "Kronika Vsi", "--kind", "book"]); // S0003
  await w.ok(["lesson", "add", "Ve Lhotě se psalo číslo domu u otce", "--on", "L1"]); // K0001
  await w.ok(["lesson", "add", "Ve Vsi psal farář jména česky", "--on", "L2"]); // K0002
  await w.ok(["task", "add", "Mimo matriky: Kryštof", "--level", "enrich", "--where", "noviny, adresáře, dějiny obce", "--why", "příběh", "--done-when", "hledáno", "--about", "P1"]);
  const tree = Tree.open(w.cwd, w.env);
  const task = { ...tree.get<Task>("T0001")!, origin: STORY_SOURCES_ORIGIN };
  const section = (text: string) => text.slice(text.indexOf("## Beyond the registers:"), text.indexOf("\n\n", text.indexOf("## Beyond the registers:")));
  const claude = section(buildBrief(tree, { task }).text);
  assert.equal(
    claude,
    [
      `## Beyond the registers: about ${ENRICH_PAGES} pages fetched or read in all (the task's whole budget, strom fetch too), then record the searches and close`,
      `- over ${WEB_SOFT} pages of one site: through its connector, built right away when the task needs that site (strom connector new <site> --url https://<host>/, then strom fetch)`,
      "- print: a subagent on sonnet (model.text), never handwriting",
      '- of the places, written already (reuse): S0001 "Dějiny Dolní Lhoty a okolí" · lessons K0001',
    ].join("\n"),
  );
  // the user's own model for print
  await w.ok(["config", "set", "model.text", "claude-haiku-4-5"]);
  assert.match(buildBrief(Tree.open(w.cwd, w.env), { task }).text, /- print: a subagent on claude-haiku-4-5 \(model\.text\), never handwriting/);
  // an agent that hands no work to another model reads print itself: no such line
  const session = { id: "N0001", type: "session", state: "open", started: new Date().toISOString(), agent: "codex", notes: [] } as unknown as Session;
  const codex = section(buildBrief(tree, { task, session }).text);
  assert.match(codex, /^## Beyond the registers: about \d+ pages/);
  assert.doesNotMatch(codex, /print/);
  // an enrich task of the research itself has no budget of pages
  assert.doesNotMatch(buildBrief(tree, { task: { ...task, origin: "user" } }).text, /## Beyond the registers:/);
  // the method says how to use them
  const method = methodFor("enrich");
  assert.match(method, /\*\*Within the brief's budget of pages\*\* fetched or read; then record what\n {2}was searched and close\. Printed pages go to the user's model for print\n {2}where you can hand work to one \(the brief names it\) — never handwriting\./);
  // one rule with the web's: the budget is the task's whole, more pages of one site through its connector built at once
  assert.match(method, /The budget is the task's whole: pages through a connector count in it\.\n {2}More pages of one site than the web rule allows go through its connector,\n {2}built right away when the task needs that site/);
  assert.ok(ENRICH_PAGES > WEB_SOFT, "the budget leaves room for one site's connector");
  assert.match(method, /\*\*The history of a place once in a research\*\*: what is written of it \(the\n {2}brief says\) is reused, never searched again\./);
  w.cleanup();
});
