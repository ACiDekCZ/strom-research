// The ways to talk with the agents here: each agent's app and its terminal a line of their own, in strom's order,
// the app suggested — the list a person picks from in the setup, the menu and a tree from the Strom app.

import { test } from "node:test";
import assert from "node:assert/strict";
import { suggestedWay, waysHere, whereToTalk, type AgentHere } from "../../src/core/apps.ts";
import { wayLabel, wayName } from "../../src/cli/ways.ts";

const here = (...a: [string, "app" | "cli" | "both"][]): AgentHere[] => a.map(([id, k]) => ({ id, app: k !== "cli", cli: k !== "app" }));

test("each agent's app and terminal are ways of their own, the app first; one form only: one way", () => {
  // found on Mac: Codex's CLI, the apps of Claude and Codex
  const ways = waysHere(here(["claude", "app"], ["codex", "both"], ["grok", "cli"]));
  assert.deepEqual(ways, [
    { agent: "claude", where: "app" },
    { agent: "codex", where: "app" },
    { agent: "codex", where: "terminal" },
    { agent: "grok", where: "terminal" },
  ]);
  assert.deepEqual(waysHere(here(["claude", "app"])), [{ agent: "claude", where: "app" }]);
  assert.deepEqual(waysHere([]), []);
});

test("the way suggested: the agent's as it is talked with now, else the first app, else the first way", () => {
  const ways = waysHere(here(["claude", "cli"], ["codex", "both"], ["opencode", "app"]));
  // nothing chosen yet: the first app (the easiest), not the first agent
  assert.equal(suggestedWay(ways, undefined, undefined), 1);
  assert.equal(suggestedWay(ways, "codex", "terminal"), 2);
  assert.equal(suggestedWay(ways, "codex", undefined), 1, "unset: the app");
  assert.equal(suggestedWay(ways, "claude", "app"), 0, "the agent's one way, whatever was said");
  assert.equal(suggestedWay(ways, "antigravity", "terminal"), 1, "an agent not here: the first app");
  assert.equal(suggestedWay(waysHere(here(["claude", "cli"], ["grok", "cli"])), undefined, undefined), 0, "no app: the first way");
});

test("a way says what is on this computer: the app's own name, the CLI's name — in the person's language, no one addressed", () => {
  assert.equal(wayLabel("cs", { agent: "claude", where: "app" }), "Claude – aplikace (nejjednodušší)");
  assert.equal(wayLabel("cs", { agent: "claude", where: "terminal" }), "Claude Code – v terminálu (pro zkušenější)");
  assert.equal(wayLabel("cs", { agent: "codex", where: "app" }), "ChatGPT (Codex) – aplikace (nejjednodušší)");
  assert.equal(wayLabel("de", { agent: "grok", where: "terminal" }), "Grok Build – im Terminal (für Erfahrene)");
  assert.equal(wayLabel("en", { agent: "opencode", where: "app" }), "OpenCode — its app (the easiest)");
  assert.equal(wayName("cs", { agent: "codex", where: "terminal" }), "OpenAI Codex CLI – v terminálu");
});

test("where the person talks: what they chose while the agent has both; one form only: that one", () => {
  // no apps on this computer here (STROM_APP_DIRS empty): the terminal, whatever was chosen
  assert.equal(whereToTalk("claude", "app", { STROM_APP_DIRS: "", PATH: "" }), "terminal");
});
