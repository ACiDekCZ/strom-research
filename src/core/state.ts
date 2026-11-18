// The state of a research: research (an agent at work on it), waiting (its agent not on this computer) or an archive.
// A research waiting for its agent acts as an archive (Milan's decision, 2026-10-15): what the app sends is written as
// it is, nothing of an agent, a queue or a cost is said. A task that comes meanwhile (the material sent, a scan to read)
// is put aside as in an archive (spec 108 K1b.5); the tasks it had stay as they were. Its stored mode never changes for
// it — the agent installed, the research goes on by itself: what was put aside comes back the moment the agent works
// (settleWaiting). Apart from core/mode.ts, which the settings' own modules read (no cycle).

import type { TreeConfig } from "./model.ts";
import type { Env } from "./paths.ts";
import { agentsHere } from "./apps.ts";
import { Settings } from "./config.ts";
import { AGENTS, detectAgent } from "./which.ts";
import { heldInArchive, isArchive, wakeHeld } from "./mode.ts";
import { phrase } from "./phrases.ts";
import { writableUnasked } from "./integrity.ts";
import type { Task } from "./model.ts";
import type { Tree } from "./tree.ts";
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
 * A task coming in where nobody researches waits put aside (records.create): an archive's (core/mode.ts), and one of a
 * research waiting for its agent — the same mark (heldBy "archive", no new value), its own reason; back when the agent
 * is here (settleWaiting).
 */
export function heldWhereNobody(tree: Tree, task: Record<string, unknown>): Record<string, unknown> {
  if (task.state !== "open") return task;
  if (isArchive(tree)) return heldInArchive(tree, task);
  if (stateOf(tree) !== "waiting") return task;
  return { ...task, state: "parked", heldBy: "archive", parkedReason: phrase(tree.lang, "waiting.held") };
}

/**
 * A research no longer waiting for its agent: the tasks put aside meanwhile back where they were, committed. `atWork`:
 * an agent starts on it now (strom run, chat, session start — the one asked for is here, even another than the
 * research's own); else only when its own agent is here. Never in an archive (strom mode research brings its tasks
 * back), nor while strom may not write it unasked: next time.
 */
export function settleWaiting(tree: Tree, atWork = false): string[] {
  if (isArchive(tree) || tree.dryRun || !tree.key) return [];
  const held = (t: Task) => t.state === "parked" && t.heldBy === "archive";
  if (!tree.list<Task>("task").some(held)) return [];
  if (!atWork && stateOf(tree) !== "research") return [];
  let back: string[] = [];
  tree.atomically(() => {
    if (!writableUnasked(tree)) return;
    back = wakeHeld(tree, "the research's agent is here", "the agent is here");
    if (back.length) tree.commit(`Tasks back: the research's agent is here (${back.join(", ")})`);
  });
  return back;
}

/** The two kinds the Strom app shows: a research, or an archive (Milan's decision, 2026-10-23). */
export type Kind = "research" | "archive";

/**
 * The kind of a tree as the app and a choice of trees show it: a research waiting for its agent is an archive until an
 * agent starts on it (its state stays `waiting` beside it).
 */
export function kindOf(tree: { config: TreeConfig; env: Env; root?: string }): Kind {
  return actsAsArchive(tree) ? "archive" : "research";
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
