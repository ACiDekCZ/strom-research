// The state of a research: research (an agent at work on it), waiting (its agent not on this computer) or an archive.
// A research waiting for its agent acts as an archive (Milan's decision, 2026-10-15): what the app sends is written as
// it is, no task is made for the agent, nothing of an agent, a queue or a cost is said. Its stored mode never changes
// for it — the agent installed, the research goes on by itself with the tasks it had (none put aside). Apart from
// core/mode.ts, which the settings' own modules read (no cycle).

import type { TreeConfig } from "./model.ts";
import type { Env } from "./paths.ts";
import { agentsHere } from "./apps.ts";
import { Settings } from "./config.ts";
import { AGENTS, detectAgent } from "./which.ts";
import { isArchive } from "./mode.ts";
import { anyoneAtWork } from "./workers.ts";
import { UsageError } from "./errors.ts";
import { PROFILES } from "../agents/profiles.ts";
import { ui } from "../cli/ui.ts";

/**
 * Is this agent on this computer — its CLI or its desktop app, or at work in this process (strom run by it)? An agent
 * strom does not look for (a script of the user's) is theirs to have.
 */
export function agentHere(agent: string, env: Env): boolean {
  if (!AGENTS.some((a) => a.id === agent)) return true;
  if (env.STROM_SESSION || detectAgent(env) === agent) return true;
  return agentsHere(env).some((a) => a.id === agent);
}

/** The agent of the research (its own, else the user's) on this computer. */
export function treeAgentHere(config: TreeConfig | undefined, env: Env): boolean {
  return agentHere(new Settings(env, {}).agent(config).value, env);
}

/** The three states of a research: an agent at work on it, one waiting for its agent, an archive. */
export type State = "research" | "waiting" | "archive";

export function stateOf(tree: { config: TreeConfig; env: Env; root?: string }): State {
  if (isArchive(tree)) return "archive";
  if (treeAgentHere(tree.config, tree.env)) return "research";
  // an agent at work in it (another one than the tree's, strom run --agent …) is here whatever the setting says
  return tree.root && anyoneAtWork(tree.root) ? "research" : "waiting";
}

/** Acts as an archive: an archive, or a research waiting for its agent — what comes is kept, nothing made for an agent. */
export function actsAsArchive(tree: { config: TreeConfig; env: Env; root?: string }): boolean {
  return stateOf(tree) !== "research";
}

/**
 * Work of an agent refused where nobody researches: an archive (nothing of an agent said: where research is switched
 * on), or a research waiting for its agent when the agent asked for is not here either (`strom run --agent` of another
 * one here goes on). One sentence in the research's language (ui.error.archive, ui.error.agent.missing), the command for a
 * terminal after it; the English and a code for a program and an agent (the Strom app says it in its own).
 */
export function refuseInArchive(tree: { config: TreeConfig; env: Env; root?: string; lang: string }, what: string, agent?: string): void {
  const state = stateOf(tree);
  if (state === "research") return;
  if (state === "archive")
    throw new UsageError(ui("en", "ui.archive.refuse"), { code: "archive", params: { what }, hint: "strom mode research (the person: strom's menu, its first item)" });
  const named = agent ?? new Settings(tree.env, {}).agent(tree.config).value;
  if (agentHere(named, tree.env)) return;
  const name = PROFILES[named]?.name ?? named;
  throw new UsageError(ui("en", "ui.waiting.refuse", { agent: name }), { code: "agent.missing", params: { what, agent: named, name }, hint: "strom setup (the person installs or chooses the agent: strom's menu, its first item)" });
}
