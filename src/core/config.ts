// User configuration and setting resolution.
//
// Every setting is resolved in one order: command flag > environment variable
// > the tree (strom.json) > the user config > a derived default. Settings a
// tree can carry are marked `tree`. If a required setting is still missing,
// the caller asks the user (TTY) or fails with NeedsInputError (no TTY).

import path from "node:path";
import { configDir, defaultHome, expandHome, type Env } from "./paths.ts";
import { readJsonIfExists, writeJson } from "./json.ts";
import { detectLang, isValidLang } from "./lang.ts";
import { UsageError } from "./errors.ts";
import { DEFAULT_AGENT, PROFILES, TIERS, type Tier } from "../agents/profiles.ts";
import { EXCERPT_QUALITIES, EXCERPT_SCOPES, EXCERPTS_MAX_MB, STRATEGIES, type ExcerptQuality, type ExcerptScope, type Strategy, type TreeConfig } from "./model.ts";
import { downloadsDir } from "./browser.ts";
import { acquireLock } from "./lock.ts";
import { isStromAppOrigin } from "./stromapp.ts";

export interface UserConfig {
  /** Strom home: default parent of trees and shared data. */
  home?: string;
  /** Shared data (media, catalog, tools, cache); defaults to <home>/shared. */
  shared?: string;
  /** Folder holding trees; defaults to <home>. */
  trees?: string;
  /** Default research language for new trees. */
  lang?: string;
  /** Trees living outside the trees folder, remembered by `strom init <dir>`. */
  extraTrees?: string[];
  /** The tree used when no other says which (`strom trees use`). */
  currentTree?: string;
  /** Default AI agent: claude, codex, antigravity, opencode. */
  agent?: string;
  /** Which GEDCOM files to write: both (default), standard, strom. */
  gedcomFor?: string;
  /** The Strom app version the Strom GEDCOM is for. */
  stromVersion?: string;
  /** Stories of the ancestors: yes (the default) or no. */
  stories?: string;
  /** The gate the agent working alone asks before each session (plugins/gates/<name>). */
  runGate?: string;
  /** Hooks told of what is saved into a research (plugins/hooks/<name>), turned on by the user. */
  hooks?: string[];
  /** Model per tier, per agent: { claude: { vision: "opus" } }. */
  models?: Record<string, Partial<Record<Tier, string>>>;
  /** Size of the brief in tokens. */
  briefBudget?: number;
  /** Time limit of one `strom run` session in minutes. */
  runMinutes?: number;
  /** Order of the task queue: balanced (default), depth, priority. */
  queueStrategy?: string;
  /** Ask the user before a connector runs: off (default) or on. */
  connectorsConsent?: string;
  /** The route chosen for a connector (strom connector use): its images come directly or through the browser. */
  connectorRoutes?: Record<string, RouteChoice>;
  /** The folder the browser saves downloads into (default: the system's Downloads folder). */
  browserDownloads?: string;
  /** What the agent may do without asking: ask, auto (default) or full — see AgentPermissions. */
  agentPermissions?: string;
  /** Where the user talks with the agent: its desktop app or the terminal (unset: the app when it is installed). */
  agentWhere?: string;
  /** Claude Code sessions strom starts with Remote Control: on, off (default). */
  agentRemote?: string;
  /** The Strom app on this computer: the user said so ("yes") or does not want to hear of it ("no"). */
  stromApp?: string;
  /** Another copy of the Strom app to open (its beta, its development) instead of https://stromapp.info/run/. */
  stromAppUrl?: string;
  /** Look for new versions of strom: check (default, at most once a day) or off. */
  updates?: string;
  /** The entries cut out of their scans for the Strom app: quality, whose, limit in MB. */
  excerptsQuality?: string;
  excerptsFor?: string;
  excerptsMb?: number;
  /** The main person of a tree (P…): first in the GEDCOM files, where the Strom app opens. */
  mainPerson?: string;
  /** The last look for a new version: when, and the newest one then. */
  updateCheck?: { at: string; latest: string };
  /** When and how strom noticed the Strom app (it started strom, or it is installed from the browser). */
  stromAppSeen?: { via: string; at: string; version?: string };
  /** The version of strom that last ran here: a newer one brings what it put outside the trees up to date. */
  lastVersion?: string;
  /** What an agent in a conversation was told to tell the user once — the stories, the Strom app, asking about the tree — and when. */
  told?: Record<string, string>;
  /** The last answer to "watch the work live in the Strom app?" when the agent was set to work alone from the menu. */
  stromAppFollow?: "yes" | "no";
}

/** A route chosen for a connector: when, and from where (a terminal, or a command without one — an agent or the app). */
export interface RouteChoice {
  via: "direct" | "browser";
  at: string;
  by: string;
}

/**
 * What the agent may do without asking the user:
 *   ask   what the tree's permissions allow; anything else it asks about
 *   auto  what they allow; anything else the agent CLI's own review decides, asking only when it is risky (default)
 *   full  everything but what the tree's permissions deny
 * A run without a person (strom run) never asks: under ask and auto it does what the tree allows and nothing else.
 */
export type AgentPermissions = "ask" | "auto" | "full";
export const PERMISSION_LEVELS: readonly AgentPermissions[] = ["ask", "auto", "full"];
/** Earlier names of the levels, still understood. */
const PERMISSION_ALIASES: Record<string, AgentPermissions> = { list: "auto", bypass: "full" };

export type Source = "flag" | "env" | "config" | "tree" | "default" | "detected";

export interface Resolved<T> {
  value: T;
  source: Source;
}

export interface Flags {
  home?: string | undefined;
  shared?: string | undefined;
  trees?: string | undefined;
  lang?: string | undefined;
  agent?: string | undefined;
  model?: string | undefined;
  budget?: string | undefined;
  minutes?: string | undefined;
}

export const DEFAULT_BUDGET = 25_000;
export const DEFAULT_RUN_MINUTES = 60;

/** One setting: where it can live and how it is checked. */
export interface SettingDef {
  key: string;
  env: string;
  /** Can a tree carry its own value (strom.json)? */
  tree: boolean;
  kind: "path" | "lang" | "agent" | "model" | "number" | "choice" | "version" | "person" | "url" | "plugin";
  /** The values a "choice" allows. */
  choices?: readonly string[];
  description: string;
}

export const SETTINGS: SettingDef[] = [
  { key: "home", env: "STROM_HOME", tree: false, kind: "path", description: "folder with the trees and shared data" },
  { key: "shared", env: "STROM_SHARED", tree: false, kind: "path", description: "shared data: scans, catalog, tools (default <home>/shared)" },
  { key: "trees", env: "STROM_TREES", tree: false, kind: "path", description: "folder holding the trees (default <home>)" },
  { key: "lang", env: "STROM_LANG", tree: true, kind: "lang", description: "research language: the agent talks and writes in it" },
  { key: "agent", env: "STROM_AGENT", tree: true, kind: "agent", description: "AI agent doing the research: claude, codex, antigravity, opencode" },
  ...TIERS.map((t): SettingDef => ({
    key: `model.${t}`,
    env: t === "lead" ? "STROM_MODEL" : `STROM_MODEL_${t.toUpperCase()}`,
    tree: true,
    kind: "model",
    description: {
      lead: "model of the main researcher (default: the agent's own)",
      vision: "model for handwriting and scans — never weaker than lead",
      text: "model for print, catalogues, web pages",
      cheap: "model for mechanical work",
    }[t],
  })),
  { key: "brief.budget", env: "STROM_BRIEF_BUDGET", tree: true, kind: "number", description: `size of the brief in tokens (default ${DEFAULT_BUDGET})` },
  { key: "run.minutes", env: "STROM_RUN_MINUTES", tree: true, kind: "number", description: `time limit of one \`strom run\` session (default ${DEFAULT_RUN_MINUTES})` },
  // Read from the config file only, changed by the user alone: the gate decides what working alone spends.
  { key: "run.gate", env: "", tree: false, kind: "plugin", description: "a condition on the agent working alone: the gate (plugins/gates/<name>) strom asks before each session of strom run — go on, wait or stop; its name, then what it is given (strom gate list; e.g. claude-usage 10: the Claude subscription's daily ration, 10 points in hand) — only you set it" },
  { key: "queue.strategy", env: "STROM_QUEUE_STRATEGY", tree: true, kind: "choice", choices: STRATEGIES, description: "order of the task queue: balanced (default — nearest ancestors first, spread over the lines, nothing taken forever), depth (stay on one line), priority (strict priority)" },
  { key: "gedcom.for", env: "STROM_GEDCOM_FOR", tree: true, kind: "choice", choices: ["both", "standard", "strom"], description: "GEDCOM files written: both (default), standard (any program), strom (the Strom app)" },
  { key: "stories", env: "STROM_STORIES", tree: true, kind: "choice", choices: ["yes", "no"], description: "stories of the ancestors for the family, written from the facts: yes (default — strom proposes one once a person's life is told by records), no — the user is told when the research starts and may say no" },
  { key: "main.person", env: "STROM_MAIN_PERSON", tree: true, kind: "person", description: "the main person of the tree (P…): first in the GEDCOM files — the Strom app opens on them (default: the nearest person descended from every research's focus, else the first research's focus)" },
  { key: "excerpts.quality", env: "STROM_EXCERPTS_QUALITY", tree: true, kind: "choice", choices: EXCERPT_QUALITIES, description: "the entries cut out of their scans in the file for the Strom app (output/tree-strom.ged): small (1000 px, grey — half the size), normal (default, 1200 px), sharp (1600 px)" },
  { key: "excerpts.for", env: "STROM_EXCERPTS_FOR", tree: true, kind: "choice", choices: EXCERPT_SCOPES, description: "whose entries get their image in the Strom app: none (the file without images), line (the ancestors), family (default: the ancestors and their families), connected (anyone linked to them), all" },
  { key: "excerpts.mb", env: "STROM_EXCERPTS_MB", tree: true, kind: "number", description: `limit of all the images in one file for the Strom app, MB (default ${EXCERPTS_MAX_MB}): over it they are made smaller, then the farthest from the research left out — strom says so` },
  { key: "strom.version", env: "STROM_APP_VERSION", tree: true, kind: "version", description: "version of the Strom app the Strom GEDCOM is for (set by the app)" },
  { key: "connectors.consent", env: "STROM_CONNECTORS_CONSENT", tree: false, kind: "choice", choices: ["off", "on"], description: "off (default): connectors run without asking — paced by strom, only to their hosts; on: each needs the user's yes, in their terminal, to it and to each archive host" },
  { key: "browser.downloads", env: "STROM_BROWSER_DOWNLOADS", tree: false, kind: "path", description: "the folder your browser saves downloads into (default: the system's Downloads folder) — strom takes a connector's images over from there" },
  // Read from the config file only — no variable, no flag, no tree: nothing an agent can set.
  { key: "agent.permissions", env: "", tree: false, kind: "choice", choices: PERMISSION_LEVELS, description: "what the agent may do without asking you: ask (what the tree allows; anything else it asks), auto (default: what the tree allows; anything else the agent's own review decides, asking only when risky), full (everything but what the tree denies) — only you raise it" },
  { key: "agent.where", env: "STROM_AGENT_WHERE", tree: false, kind: "choice", choices: ["app", "terminal"], description: "where you talk with the agent: app (its desktop app — the easiest), terminal (its CLI) — unset: the app when it is installed" },
  { key: "agent.remote", env: "", tree: false, kind: "choice", choices: ["on", "off"], description: "the Claude Code sessions strom starts (strom run, strom chat in the terminal) with Remote Control: on — follow and steer them from claude.ai or the Claude app on your phone; off (default) — only you turn it on" },
  { key: "updates", env: "STROM_UPDATES", tree: false, kind: "choice", choices: ["check", "off"], description: "look for new versions of strom: check (default — at most once a day, one small file from the project's releases; strom says so, strom update installs it) or off" },
  { key: "strom.app", env: "", tree: false, kind: "choice", choices: ["yes", "no"], description: "you use the Strom app: yes (strom says which file to import into it), no (strom never mentions it) — unset: strom notices it itself" },
  { key: "strom.app.url", env: "STROM_APP_URL", tree: false, kind: "url", description: "another copy of the Strom app to open instead of https://stromapp.info/run/ — its beta (https://beta.stromapp.info/run/), its development (http://127.0.0.1:8080/); installed from a browser, that copy opens as its own app" },
];

/** Fields of the stored settings whose key is not the field name. */
const FIELDS: Record<string, string> = {
  "brief.budget": "briefBudget",
  "run.minutes": "runMinutes",
  "gedcom.for": "gedcomFor",
  "strom.version": "stromVersion",
  "queue.strategy": "queueStrategy",
  "connectors.consent": "connectorsConsent",
  "browser.downloads": "browserDownloads",
  "agent.permissions": "agentPermissions",
  "agent.where": "agentWhere",
  "agent.remote": "agentRemote",
  "strom.app": "stromApp",
  "strom.app.url": "stromAppUrl",
  "main.person": "mainPerson",
  "excerpts.quality": "excerptsQuality",
  "excerpts.for": "excerptsFor",
  "excerpts.mb": "excerptsMb",
  "run.gate": "runGate",
};

/** Environment variables that are not settings but steer strom. */
export const OTHER_ENV: { env: string; description: string }[] = [
  { env: "STROM_TREE", description: "the tree to work on (a folder or a tree name)" },
  { env: "STROM_CONFIG_DIR", description: "where the user config and seal keys live" },
  { env: "STROM_NONINTERACTIVE", description: "1 = never ask, fail with needs-input instead" },
  { env: "STROM_DOCUMENTS", description: "the Documents folder, where strom suggests its home (default: the system's)" },
  { env: "STROM_APP", description: "set by the Strom app when it starts strom (or an agent for it): strom then knows the app is there" },
];

export function settingDef(key: string): SettingDef {
  const def = SETTINGS.find((s) => s.key === key);
  if (!def) throw new UsageError(`unknown setting "${key}"`, { hint: `settings: ${SETTINGS.map((s) => s.key).join(", ")}` });
  return def;
}

export function configFile(env: Env): string {
  return path.join(configDir(env), "config.json");
}

export function loadUserConfig(env: Env): UserConfig {
  return readJsonIfExists<UserConfig>(configFile(env)) ?? {};
}

export function saveUserConfig(env: Env, cfg: UserConfig): void {
  writeJson(configFile(env), cfg);
}

function asPath(value: string, env: Env): string {
  return path.resolve(expandHome(value, env));
}

/** Check and normalise a value for a setting; throws a UsageError with the allowed values. */
export function checkValue(def: SettingDef, raw: string, resolvePath: (p: string) => string): string | number {
  const v = raw.trim();
  switch (def.kind) {
    case "path":
      return resolvePath(v);
    case "lang": {
      const code = v.toLowerCase();
      if (!isValidLang(code)) throw new UsageError(`invalid language code "${raw}"`, { hint: "use a code like cs, en, de" });
      return code;
    }
    case "agent": {
      const id = v.toLowerCase();
      if (!PROFILES[id]) throw new UsageError(`unknown agent "${raw}"`, { hint: Object.keys(PROFILES).join(", ") });
      return id;
    }
    case "model":
      if (!v) throw new UsageError("the model name is empty");
      return v;
    case "choice": {
      const c = def.key === "agent.permissions" ? (PERMISSION_ALIASES[v.toLowerCase()] ?? v.toLowerCase()) : v.toLowerCase();
      if (!def.choices?.includes(c)) throw new UsageError(`invalid ${def.key} "${raw}"`, { hint: def.choices?.join(", ") });
      return c;
    }
    case "plugin":
      // its name, then what it is given: "claude-usage 10"
      if (!/^[a-z0-9][a-z0-9-]*(\s+\S+)*$/.test(v)) throw new UsageError(`invalid ${def.key} "${raw}"`, { hint: 'a plugin\'s name (lowercase letters, digits and dashes), then what it is given, e.g. "claude-usage 10"' });
      return v.split(/\s+/).join(" ");
    case "person":
      if (!/^[Pp]\d{4,}$/.test(v)) throw new UsageError(`invalid ${def.key} "${raw}"`, { hint: "a person's ID, e.g. P0009 (strom find <name>)" });
      return v.toUpperCase();
    case "url": {
      // A copy of the Strom app the bridge lets in (core/live.ts) — the bridge's address goes to it.
      let origin = "";
      try {
        origin = new URL(v).origin;
      } catch {
        // not an address
      }
      if (!isStromAppOrigin(origin))
        throw new UsageError(`invalid ${def.key} "${raw}"`, { hint: "the Strom app: https://stromapp.info/run/, its beta https://beta.stromapp.info/run/, or a copy on this computer http://127.0.0.1:<port>/" });
      return v;
    }
    case "version":
      if (!/^\d+(\.\d+){0,2}$/.test(v)) throw new UsageError(`invalid ${def.key} "${raw}"`, { hint: "a version like 1.4.0" });
      return v;
    case "number": {
      const n = Number(v);
      if (!Number.isFinite(n) || n <= 0) throw new UsageError(`${def.key} must be a positive number`);
      return def.key === "brief.budget" ? Math.round(n) : n;
    }
  }
}

/** Where a setting is stored in the user config or in strom.json. */
function readStored(store: UserConfig | TreeConfig | undefined, key: string, agent: string): string | number | undefined {
  if (!store) return undefined;
  if (key.startsWith("model.")) return store.models?.[agent]?.[key.slice(6) as Tier];
  const v = (store as Record<string, unknown>)[FIELDS[key] ?? key];
  return typeof v === "string" || typeof v === "number" ? v : undefined;
}

/** Write (or with undefined, remove) a setting in a store. */
export function writeStored(store: UserConfig | TreeConfig, key: string, agent: string, value: string | number | undefined): void {
  const s = store as Record<string, unknown> & { models?: Record<string, Record<string, string>> };
  if (key.startsWith("model.")) {
    const tier = key.slice(6);
    const models = (s.models ??= {});
    const forAgent = (models[agent] ??= {});
    if (value === undefined) delete forAgent[tier];
    else forAgent[tier] = String(value);
    if (Object.keys(forAgent).length === 0) delete models[agent];
    if (Object.keys(models).length === 0) delete s.models;
    return;
  }
  const field = FIELDS[key] ?? key;
  if (value === undefined) delete s[field];
  else s[field] = value;
}

export class Settings {
  readonly env: Env;
  readonly flags: Flags;
  config: UserConfig;
  /** The config as it was read: save() writes only what changed since. */
  private baseline: UserConfig;

  constructor(env: Env, flags: Flags, config?: UserConfig) {
    this.env = env;
    this.flags = flags;
    this.config = config ?? loadUserConfig(env);
    this.baseline = structuredClone(this.config);
  }

  /** Read the config file again (another strom process may have changed it). */
  reload(): void {
    this.replace(loadUserConfig(this.env));
  }

  /** Take these values in place: whoever holds `config` sees them. */
  private replace(next: UserConfig): void {
    const cur = this.config as Record<string, unknown>;
    for (const k of Object.keys(cur)) delete cur[k];
    Object.assign(cur, next);
    this.baseline = structuredClone(this.config);
  }

  private flagOf(key: string): string | undefined {
    if (key === "model.lead") return this.flags.model;
    if (key === "brief.budget") return this.flags.budget;
    if (key === "run.minutes") return this.flags.minutes;
    return (this.flags as Record<string, string | undefined>)[key];
  }

  /**
   * Resolve any setting: flag > env > tree > user config. Undefined when none
   * of them has it (the caller applies its default). Model keys resolve for
   * `agent` (default: the resolved agent).
   */
  resolve(key: string, tree?: TreeConfig, agent?: string): Resolved<string | number> | undefined {
    const def = settingDef(key);
    if (key === "agent") return this.agent(tree);
    const who = agent ?? (def.kind === "model" ? this.agent(tree).value : "");
    const check = (raw: string) => checkValue(def, raw, (p) => asPath(p, this.env));
    const flag = this.flagOf(key);
    if (flag) return { value: check(flag), source: "flag" };
    const env = def.env ? this.env[def.env] : undefined;
    if (env) return { value: check(env), source: "env" };
    if (def.tree) {
      const t = readStored(tree, key, who);
      if (t !== undefined) return { value: t, source: "tree" };
    }
    const u = readStored(this.config, key, who);
    if (u !== undefined) return { value: def.kind === "path" ? asPath(String(u), this.env) : u, source: "config" };
    return undefined;
  }

  /** Home, or undefined when nothing is configured (the caller asks). */
  home(): Resolved<string> | undefined {
    return this.resolve("home") as Resolved<string> | undefined;
  }

  suggestedHome(): string {
    return defaultHome(this.env);
  }

  shared(): Resolved<string> | undefined {
    const r = this.resolve("shared") as Resolved<string> | undefined;
    if (r) return r;
    const home = this.home();
    return home ? { value: path.join(home.value, "shared"), source: "default" } : undefined;
  }

  trees(): Resolved<string> | undefined {
    const r = this.resolve("trees") as Resolved<string> | undefined;
    if (r) return r;
    const home = this.home();
    return home ? { value: home.value, source: "default" } : undefined;
  }

  /** Research language: flag > STROM_LANG > the tree > the user's default > detected from the system. */
  lang(tree?: TreeConfig): Resolved<string> {
    return (this.resolve("lang", tree) as Resolved<string> | undefined) ?? { value: detectLang(this.env), source: "detected" };
  }

  /** Which agent does the research: flag > STROM_AGENT > tree > user > default. */
  agent(tree?: TreeConfig): Resolved<string> {
    // Flags and env are not checked here: `strom run` says which agents it can
    // drive (it also knows the test runner "script").
    const r = this.agentAsSaid(tree);
    // Gemini CLI ended for personal accounts (2026): Google's agent is Antigravity now.
    return r.value === "gemini" ? { ...r, value: "antigravity" } : r;
  }

  private agentAsSaid(tree?: TreeConfig): Resolved<string> {
    const f = this.flags.agent;
    if (f) return { value: f.toLowerCase(), source: "flag" };
    const env = this.env.STROM_AGENT;
    if (env) return { value: env.toLowerCase(), source: "env" };
    if (tree?.agent) return { value: tree.agent, source: "tree" };
    if (this.config.agent) return { value: this.config.agent, source: "config" };
    return { value: DEFAULT_AGENT, source: "default" };
  }

  /** Model per tier for an agent: profile defaults < user config < tree < env < flag. */
  models(agent: string, tree?: TreeConfig): Partial<Record<Tier, string>> {
    const out: Partial<Record<Tier, string>> = { ...(PROFILES[agent]?.models ?? {}) };
    for (const t of TIERS) {
      const r = this.resolve(`model.${t}`, tree, agent);
      if (r) out[t] = String(r.value);
    }
    return out;
  }

  number(key: "brief.budget" | "run.minutes" | "excerpts.mb", tree: TreeConfig | undefined, fallback: number): number {
    const r = this.resolve(key, tree);
    return r ? Number(r.value) : fallback;
  }

  /** How the task queue is ordered (core/queue.ts). */
  strategy(tree?: TreeConfig): Strategy {
    return String(this.resolve("queue.strategy", tree)?.value ?? "balanced") as Strategy;
  }

  /** The GEDCOM files to write: standard (any program), strom (the Strom app), or both. */
  gedcomFor(tree?: TreeConfig): ("standard" | "strom")[] {
    const v = String(this.resolve("gedcom.for", tree)?.value ?? "both");
    return v === "both" ? ["standard", "strom"] : [v as "standard" | "strom"];
  }

  /** Does a connector need the user's consent before it runs? (Off unless they turned it on.) */
  connectorsConsent(): boolean {
    return this.resolve("connectors.consent")?.value === "on";
  }

  /** The folder the browser saves downloads into: the setting, else the system's Downloads folder. */
  downloads(): string {
    return String(this.resolve("browser.downloads")?.value ?? downloadsDir(this.env));
  }

  /** Claude Code sessions strom starts with Remote Control (agent.remote: on). */
  agentRemote(): boolean {
    return this.resolve("agent.remote")?.value === "on";
  }

  /** Where the user wants to talk with the agent, if they said (env, else the config); see whereToTalk. */
  agentWhere(): string | undefined {
    const r = this.resolve("agent.where");
    return r ? String(r.value) : undefined;
  }

  /** What the agent may do without asking — from the config file alone, which only the user raises. */
  /** The gate of working alone, if the user set one (the config file only). */
  runGate(): string | undefined {
    return this.config.runGate || undefined;
  }

  agentPermissions(): AgentPermissions {
    const v = this.config.agentPermissions ?? "auto";
    return PERMISSION_ALIASES[v] ?? (PERMISSION_LEVELS.includes(v as AgentPermissions) ? (v as AgentPermissions) : "auto");
  }

  /** Stories of the ancestors: on unless the user said no; `said` — they chose (else they are to be told). */
  stories(tree?: TreeConfig): { on: boolean; said: boolean } {
    const v = this.resolve("stories", tree)?.value;
    return { on: v !== "no", said: v === "yes" || v === "no" };
  }

  /** The images for the Strom app: how sharp, whose, and the limit of all together (MB). */
  excerpts(tree?: TreeConfig): { quality: ExcerptQuality; for: ExcerptScope; mb: number } {
    return {
      quality: String(this.resolve("excerpts.quality", tree)?.value ?? "normal") as ExcerptQuality,
      for: String(this.resolve("excerpts.for", tree)?.value ?? "family") as ExcerptScope,
      mb: this.number("excerpts.mb", tree, EXCERPTS_MAX_MB),
    };
  }

  /** The main person of the tree as set (strom config set main.person P…), if anybody did. */
  mainPerson(tree?: TreeConfig): string | undefined {
    const r = this.resolve("main.person", tree);
    return r ? String(r.value) : undefined;
  }

  stromVersion(tree?: TreeConfig): string | undefined {
    const r = this.resolve("strom.version", tree);
    return r ? String(r.value) : undefined;
  }

  /**
   * Write what this process changed — only that, onto the file as it is now:
   * several strom processes run side by side (the menu, a conversation with an
   * agent, a run) and none may wipe out what another saved meanwhile.
   */
  save(): void {
    const file = configFile(this.env);
    const release = acquireLock(`${file}.lock`, { owner: "strom config", waitMs: 10_000, staleMs: 60_000 });
    try {
      const fresh = loadUserConfig(this.env) as Record<string, unknown>;
      const mine = this.config as Record<string, unknown>;
      const before = this.baseline as Record<string, unknown>;
      for (const k of new Set([...Object.keys(before), ...Object.keys(mine)])) {
        if (JSON.stringify(before[k]) === JSON.stringify(mine[k])) continue;
        if (mine[k] === undefined) delete fresh[k];
        else fresh[k] = mine[k];
      }
      saveUserConfig(this.env, fresh as UserConfig);
      this.replace(fresh as UserConfig);
    } finally {
      release();
    }
  }
}
