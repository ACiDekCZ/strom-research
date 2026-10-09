// The model of the research, chosen by the person (the setup wizard, the menu's settings): for Claude Code Opus or
// Sonnet, for the other agents the strong models of their own list (agents/models.ts) — the strongest suggested, a word
// on what it costs, and always "leave it to the agent". Never chosen for the person.

import type { Context } from "./context.ts";
import { ui } from "./ui.ts";
import { PROFILES } from "../agents/profiles.ts";
import { modelChoices } from "../agents/models.ts";

export interface ModelPick {
  /** The model chosen (undefined: the agent's own). */
  value: string | undefined;
  /** False: the person went back (0) or gave no answer — `value` is then the suggestion. */
  picked: boolean;
}

/**
 * Ask which model the agent does the research with. `current`: the model kept for it now (suggested); none kept: the
 * strongest on the first setup, else the agent's own (as it is now). `back` adds 0: nothing changed.
 */
export async function chooseModel(ctx: Context, lang: string, agent: string, current: string | undefined, opts: { first: boolean; back?: string }): Promise<ModelPick> {
  const back = opts.back ? { back: opts.back } : {};
  if (agent === "claude") {
    const models = ["opus", "sonnet", undefined];
    const suggested = current === undefined ? (opts.first ? 0 : 2) : Math.max(0, models.indexOf(current));
    const i = await ctx.choose(
      ui(lang, "ui.setup.model"),
      [{ label: ui(lang, "ui.setup.model.opus") }, { label: ui(lang, "ui.setup.model.sonnet") }, { label: ui(lang, "ui.setup.model.own") }],
      suggested,
      back,
    );
    return { value: models[i ?? suggested], picked: i !== undefined };
  }
  const found = await modelChoices(agent, ctx.env);
  const models: (string | undefined)[] = found.models.map((m) => m.id);
  const labels = found.models.map((m, i) => {
    const name = m.label && m.label !== m.id ? `${m.label} · ${m.id}` : m.id;
    return i === 0 ? ui(lang, "ui.setup.model.recommended", { model: name }) : name;
  });
  // a model kept that the list does not have (typed by hand, or one the agent no longer lists): offered as it is
  if (current !== undefined && !models.includes(current)) {
    models.push(current);
    labels.push(ui(lang, "ui.setup.model.now", { model: current }));
  }
  models.push(undefined);
  labels.push(found.agentDefault ? ui(lang, "ui.setup.model.own.is", { model: found.agentDefault }) : ui(lang, "ui.setup.model.own"));
  const suggested = current !== undefined ? models.indexOf(current) : opts.first && models.length > 1 ? 0 : models.length - 1;
  const i = await ctx.choose(ui(lang, "ui.setup.model.agent", { agent: PROFILES[agent]?.name ?? agent }), labels.map((label) => ({ label })), suggested, back);
  return { value: models[i ?? suggested], picked: i !== undefined };
}
