// Who reads a document the Strom app sends (spec 059, the app's ZADANI_VYZKUM_cteni-modely.md): the readers the person
// may choose for each reader of a reading — the agents installed here that read documents, the models the research
// offers for each (the person's own first), the efforts each takes — and what each reader reads with when nothing is
// chosen: exactly what the research's settings say (model.vision, model.effort). A choice holds for that reading alone:
// strom never keeps it in the settings, and never picks a cheaper model by itself.

import fs from "node:fs";
import path from "node:path";
import type { Tree } from "./tree.ts";
import type { Settings } from "./config.ts";
import { userHome, type Env } from "./paths.ts";
import { AGENTS, findAgent } from "./which.ts";
import { aliasNow, BUILTIN_MODELS, codexCatalogNewer, modelTitle, parseCodex, strongModels, type ModelOption } from "../agents/models.ts";
import { loadAliases } from "./modelkey.ts";
import { EFFORTS, offeredEfforts, RECOMMENDED_EFFORT } from "../agents/effort.ts";
import type { ReaderWho } from "./document.ts";

/** An agent a reader may read with. */
export interface ChoiceAgent {
  id: string;
  name: string;
  /** false: installed, but no reader of it can start now (why: limit, auth). */
  ready: boolean;
  why?: string;
  resets?: string;
  /**
   * The models offered (id "": the agent's own model); `now`: the model an alias (Claude Code's "opus", the agent's own)
   * last ran on in this research, as its agent said it (feature read.choices.now; `nowName` as a person reads it: "Opus
   * 5.5") — only when it is known, never guessed; what is asked stays the alias. `unsure`: from Codex's kept catalog, fetched by a newer Codex than the one installed here (catalogNewer) — it may not have the model. */
  models: { id: string; name: string; unsure?: true; now?: string; nowName?: string }[];
  /** Codex: its kept catalog was fetched by a newer Codex than the one installed here (both versions): its models offered with a note. */
  catalogNewer?: { catalog: string; installed: string };
  /** The efforts it takes ("": the agent's own setting); none: it has no effort to set. */
  efforts: string[];
  /** What a reader of it reads with when only the agent is chosen. */
  default: { model: string; effort: string };
}

/** What /status.accepts.read.choices says: the agents, and what each reader (0 the first, 1 the blind one) reads with by default. */
export interface ReadChoices {
  agents: ChoiceAgent[];
  default: { agent: string; model: string; effort: string }[];
}

/** Why an agent's readers cannot start now (its limit, its login), from the readings here: none when they can. */
export type AgentHeld = (agent: string) => { why: string; resets?: string } | undefined;

function agentName(id: string): string {
  return AGENTS.find((a) => a.id === id)?.name ?? id;
}

/**
 * The readers the person may choose (`agent`: the research's — first, with exactly what its settings say): the agents
 * installed here (their CLI, not a desktop app alone), each with the models the research offers for it (the person's
 * own, then strom's strong ones — never a fast or cheap one strom picks) and the efforts it takes.
 */
/**
 * What a reader of an agent reads with when only the agent is chosen: the research's agent exactly as its settings say
 * (its own model when the person set none); another one never with its own default (it may be a fast one) — the
 * person's model for it, else strom's strongest.
 */
export function readerDefault(tree: Tree, settings: Settings, id: string, research: string): { model: string; effort: string } {
  const set = settings.models(id, tree.config);
  const own = [set.vision, set.lead].filter((m): m is string => !!m);
  const model = id === research ? (set.vision ?? "") : (own[0] ?? BUILTIN_MODELS[id]?.[0]?.id ?? "");
  const said = EFFORTS[id] ? settings.effort(id, tree.config)?.value : undefined;
  // another agent's effort the person set none of: the one strom recommends (never the agent's own lower one)
  const effort = said ?? (id !== research && offeredEfforts(id).includes(RECOMMENDED_EFFORT) ? RECOMMENDED_EFFORT : "");
  return { model, effort };
}

export function readChoices(tree: Tree, settings: Settings, env: Env, agent: string, held: AgentHeld = () => undefined): ReadChoices {
  const aliases = loadAliases(tree.root);
  const ids = [agent, ...installed(env).filter((a) => a !== agent)];
  const agents = ids.map((id): ChoiceAgent => {
    const set = settings.models(id, tree.config);
    const own = [set.vision, set.lead].filter((m): m is string => !!m);
    const { model, effort } = readerDefault(tree, settings, id, agent);
    const offered = offeredModels(id, env);
    // Codex's kept catalog from a newer Codex than this one: its models offered with a note, never left out
    const newer = id === "codex" && offered.some((m) => m.kept) ? codexCatalogNewer(env) : undefined;
    // the person's own models first, then those the settings offer for it, and the agent's own model ("") as they do
    const models = [...new Set([...(model ? [model] : []), ...own, ...offered.map((m) => m.id), ""])].map((m) => {
      const now = aliasNow(id, m || undefined, aliases);
      return { id: m, name: m === "" ? "" : modelName(id, m, offered), ...(newer && offered.some((o) => o.id === m && o.kept) ? { unsure: true as const } : {}), ...(now ? { now, nowName: modelTitle(id, now) } : {}) };
    });
    const efforts = EFFORTS[id] ? [...new Set([...(effort ? [effort] : []), ...offeredEfforts(id), ""])] : [];
    const h = held(id);
    return { id, name: agentName(id), ready: !h, ...(h ? { why: h.why, ...(h.resets ? { resets: h.resets } : {}) } : {}), models, ...(newer ? { catalogNewer: newer } : {}), efforts, default: { model, effort } };
  });
  const first = agents[0]!;
  const dflt = { agent: first.id, model: first.default.model, effort: first.default.effort };
  return { agents, default: [dflt, { ...dflt }] };
}

/** How long what is installed here is kept (a /status every few seconds looks it up once in a while). */
const INSTALLED_MS = 30_000;
let seenInstalled: { key: string; at: number; ids: string[] } | undefined;

/** The agents whose readers read documents (each measured as a reader, 2026-10-20 and 21) installed here: their CLI on PATH. */
function installed(env: Env): string[] {
  const key = [env.PATH, env.Path, env.HOME, env.USERPROFILE].join("\u0000");
  if (seenInstalled && seenInstalled.key === key && Date.now() - seenInstalled.at < INSTALLED_MS) return seenInstalled.ids;
  const ids = AGENTS.filter((a) => !!findAgent(a.command, env)).map((a) => a.id);
  seenInstalled = { key, at: Date.now(), ids };
  return ids;
}

/**
 * The models the settings offer for an agent, as far as strom knows them without starting the agent (the bridge never
 * starts an agent's CLI to list them): Codex's catalog for the account it keeps beside its config, its strong ones;
 * else the strong ones strom knows (agents/models.ts).
 */
function offeredModels(id: string, env: Env): (ModelOption & { kept?: true })[] {
  if (id === "codex") {
    try {
      const strong = strongModels(parseCodex(fs.readFileSync(path.join(env.CODEX_HOME || path.join(userHome(env), ".codex"), "models_cache.json"), "utf8")));
      if (strong.length) return strong.map((m) => ({ ...m, kept: true as const }));
    } catch {
      // none kept
    }
  }
  return BUILTIN_MODELS[id] ?? [];
}

/** A model's name as said beside its id (its own name, never translated): Claude Code's aliases as words. */
function modelName(agent: string, id: string, offered: ModelOption[]): string {
  const label = offered.find((m) => m.id === id)?.label;
  if (label) return label;
  return agent === "claude" && /^\p{Ll}+$/u.test(id) ? id[0]!.toUpperCase() + id.slice(1) : id;
}

/** A choice of readers refused: 400 read.with (at, field) or 409 read.agent (at, agent, why, resets), or the body not of its form. */
export interface WithRefusal {
  code: 400 | 409;
  reason: "read.with" | "read.agent" | "read.bad-body";
  why: string;
  params: Record<string, string>;
}

const WITH_KEYS = new Set(["agent", "model", "effort"]);

/**
 * The readers asked (`with`: one item per reader, each field left out — or the item — as by default) checked against
 * what is offered: each reader resolved (an agent chosen alone reads with its own default model and effort), or why
 * not. None asked: undefined (the readers read as the research's settings say).
 */
export function checkWith(choices: ReadChoices, raw: unknown, readers: number): { with?: ReaderWho[] } | { refused: WithRefusal } {
  if (raw === undefined || raw === null) return {};
  const bad = (why: string): { refused: WithRefusal } => ({ refused: { code: 400, reason: "read.bad-body", why: `the body: "with": ${why}`, params: {} } });
  if (!Array.isArray(raw) || raw.length > readers) return bad(`one item per reader, ${readers} at most`);
  const out: ReaderWho[] = [];
  for (let at = 0; at < readers; at++) {
    const item: unknown = raw[at];
    if (item !== undefined && item !== null && (typeof item !== "object" || Array.isArray(item) || Object.entries(item).some(([k, v]) => !WITH_KEYS.has(k) || (v !== undefined && typeof v !== "string")))) return bad(`each reader {"agent", "model", "effort"}, each text`);
    const w = (item ?? {}) as { agent?: string; model?: string; effort?: string };
    const dflt = choices.default[at] ?? choices.default[0]!;
    const refused = (field: string, why: string): { refused: WithRefusal } => ({ refused: { code: 400, reason: "read.with", why, params: { at: String(at), field } } });
    const agent = choices.agents.find((a) => a.id === (w.agent ?? dflt.agent));
    if (!agent) return refused("agent", `no reader of the agent "${String(w.agent).slice(0, 40)}" here`);
    const same = agent.id === dflt.agent;
    const model = w.model ?? (same ? dflt.model : agent.default.model);
    if (!agent.models.some((m) => m.id === model)) return refused("model", `${agent.name} reads with no model "${model.slice(0, 60)}" here`);
    const effort = w.effort ?? (same ? dflt.effort : agent.default.effort);
    if (effort !== "" && !agent.efforts.includes(effort)) return refused("effort", `${agent.name} takes no effort "${effort.slice(0, 20)}"`);
    if (!agent.ready) return { refused: { code: 409, reason: "read.agent", why: `${agent.name} cannot read now (${agent.why})`, params: { at: String(at), agent: agent.id, why: agent.why ?? "", ...(agent.resets ? { resets: agent.resets } : {}) } } };
    out.push({ agent: agent.id, ...(model ? { model } : {}), ...(effort ? { effort } : {}) });
  }
  return { with: out };
}

/** The readers as options of strom document read / again: the first reader's (--agent, --model, --effort), the blind one's (--blind-…). */
export function withArgs(w: ReaderWho[] | undefined): string[] {
  if (!w?.length) return [];
  const one = (r: ReaderWho, pre: string) => [`--${pre}agent`, r.agent, `--${pre}model=${r.model ?? ""}`, `--${pre}effort=${r.effort ?? ""}`];
  return [...one(w[0]!, ""), ...(w[1] ? one(w[1], "blind-") : [])];
}

/**
 * Who read, as the Strom app says it (spec 059 point 5): each reader with its agent's name, and — for GET /read/<id>
 * (`full`) — its model's name too; /status.reads[] and GET /reads say it short (no modelName).
 */
export function whoForApp(who: ReaderWho[] | undefined, full: boolean): (ReaderWho & { name: string; modelName?: string })[] | undefined {
  if (!who?.length) return undefined;
  return who.map((r) => ({
    agent: r.agent,
    name: agentName(r.agent),
    ...(r.model ? { model: r.model, ...(full ? { modelName: modelName(r.agent, r.model, BUILTIN_MODELS[r.agent] ?? []) } : {}) } : {}),
    ...(r.effort ? { effort: r.effort } : {}),
    ...(r.ran === false ? { ran: false as const } : {}),
  }));
}
