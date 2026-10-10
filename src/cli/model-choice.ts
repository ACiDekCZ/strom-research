// The model of the research, chosen by the person (the setup wizard, the menu's settings): for Claude Code Opus or
// Sonnet, for the other agents the strong models of their own list (agents/models.ts) — the strongest suggested, a word
// on what it costs, and always "leave it to the agent". Never chosen for the person. With the model its reasoning
// effort, for the agents that take one (agents/effort.ts): high recommended.

import type { Context } from "./context.ts";
import { ui, type UIKey } from "./ui.ts";
import { PROFILES } from "../agents/profiles.ts";
import { modelChoices } from "../agents/models.ts";
import { hasEffort, offeredEfforts, readCodexConfig, type AgentSettingsSaid, type EffortSource } from "../agents/effort.ts";

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

/**
 * Ask how deeply the agent reasons in the sessions strom starts (model.effort), for an agent that takes it: high
 * recommended and suggested (Enter) unless one is chosen already, the agent's own setting always offered (with what it
 * says now: Codex's config.toml). `back` adds 0: nothing changed. Nothing asked of an agent without it.
 */
export async function chooseEffort(ctx: Context, lang: string, agent: string, current: string | undefined, opts: { back?: string } = {}): Promise<ModelPick | undefined> {
  if (!hasEffort(agent)) return undefined;
  const name = agentName(agent);
  const values: (string | undefined)[] = offeredEfforts(agent);
  const labels = values.map((v) => ui(lang, `ui.effort.${v}` as UIKey));
  if (current !== undefined && !values.includes(current)) {
    values.push(current);
    labels.push(ui(lang, "ui.effort.now", { value: current }));
  }
  values.push(undefined);
  const own = agent === "codex" ? readCodexConfig(ctx.env) : undefined;
  labels.push(own?.effort ? ui(lang, "ui.effort.own.is", { agent: name, value: ui(lang, "ui.effort.config", { value: own.effort, file: ctx.display(own.file) }) }) : ui(lang, "ui.effort.own", { agent: name }));
  const suggested = current !== undefined ? values.indexOf(current) : 0;
  const i = await ctx.choose(ui(lang, "ui.effort.ask", { agent: name }), labels.map((label) => ({ label })), suggested, opts.back ? { back: opts.back } : {});
  return { value: values[i ?? suggested], picked: i !== undefined };
}

/** The agent's short name in what is said of its settings ("Codex"). */
function agentName(agent: string): string {
  return agent === "codex" ? "Codex" : (PROFILES[agent]?.name ?? agent);
}

/**
 * What a session of this agent runs with — its model and reasoning effort, and where each comes from (strom's setting,
 * the session's own switch, the agent's config file and profile, its own default): for Codex always (its config.toml
 * holds where strom sets nothing), for another agent only when strom sets its effort.
 */
export function agentSettingsLine(lang: string, s: AgentSettingsSaid, display: (p: string) => string): string | undefined {
  if (s.agent !== "codex" && s.effortFrom === "default") return undefined;
  const name = agentName(s.agent);
  const file = s.file ? display(s.file) : "";
  const part = (value: string | undefined, from: EffortSource): string =>
    value === undefined || from === "default"
      ? ui(lang, "ui.effort.default", { agent: name })
      : from === "strom"
        ? ui(lang, "ui.effort.strom", { value })
        : from === "args"
          ? ui(lang, "ui.effort.args", { value })
          : from === "profile"
            ? ui(lang, "ui.effort.profile", { value, file, profile: s.profile ?? "" })
            : ui(lang, "ui.effort.config", { value, file });
  return ui(lang, "ui.effort.line", { agent: name, model: part(s.model, s.modelFrom), effort: part(s.effort, s.effortFrom) });
}
