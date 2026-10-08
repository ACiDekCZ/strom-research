// Teaching an agent CLI about strom in any folder: a user who opens Claude
// Code, Codex or Antigravity anywhere and says "I want to research my ancestors"
// gets an agent that knows strom is there and how to start. Claude Code gets
// a skill of its own; Codex and Antigravity a marked block in their
// global instruction file (the user's own text around it is kept) — and in
// the settings of Claude Code (also its desktop app) and Antigravity, strom
// allowed: an agent opened anywhere runs strom without asking each time (what
// is the user's — a password, a consent — strom itself keeps for the user).
// OpenCode gets a file of its own named in its global config (a global
// AGENTS.md of strom's would hide the user's ~/.claude/CLAUDE.md, which
// OpenCode reads when it has none) and `strom *` allowed there. Grok Build
// gets a skill of its own, like Claude Code, and strom allowed in its
// config.toml (a marked block; the user's own text around it is kept).
// What strom created to teach them — a file, a folder — it records in the user
// config (agents-taught.json): taking its part away again, a file strom created
// goes when nothing else is left in it, and so does a folder strom created that
// is empty; a file the person had stays, also when it is empty then.

import fs from "node:fs";
import path from "node:path";
import type { Env } from "../core/paths.ts";
import { configDir, isolated, userHome } from "../core/paths.ts";
import { writeFileAtomic } from "../core/json.ts";
import { installation } from "../core/self.ts";
import { agentAppUrl, appSite } from "../core/stromapp.ts";

const BEGIN = "<!-- strom: begin (strom agents install; removed by strom agents uninstall) -->";
const END = "<!-- strom: end -->";

/** What the agents are taught; app: the Strom app's address it names — the one `strom app` opens when it is written (agentAppUrl). */
export const globalText = (app: string): string => `# strom — family history research

strom (the \`strom\` command) is installed on this computer: a tool for
researching a family's history with you as the researcher — people, parish
registers, archives, evidence, a family tree the Strom app can import.
Use it whenever the user wants to research their ancestors or family, or
mentions strom, a family tree or the Strom app.

1. Run \`strom\` first, and before each step: it says where the research
   stands and what to do next (\`strom --json\` for the same as data). Read
   \`strom guide\` before the first step — the rules and the way to work —
   and work only in strom's sessions on its tasks. \`strom help <command>\`
   is any command's help for you (English; \`strom help\`: every command by
   group) — \`--human\` is the user's, in their language.
   Run each strom command on its own — no pipes, no \`;\` or \`&&\` chains: you
   may run strom without asking, but not what is chained to it.
2. Not set up yet: ask the user where to keep the research (suggest
   ~/Documents/Strom) and which language they want, then run
   \`strom setup --home "<folder>" --lang <code> --yes\`, then
   \`strom init "<name of the family tree>"\`.
3. Talk to the user in their language. Ask them before decisions: whom to
   research, what they already know, anything that costs money or needs
   their permission.
4. The research lives in a family tree folder; change it ONLY through
   \`strom\` commands, never by editing its files. In that folder its own
   AGENTS.md says the rest.
5. You work best started by strom: it opens you in the tree folder with the
   right permissions. Tell the user once: next time run \`strom\` in a
   terminal (or the "Strom research" shortcut on the desktop) and choose
   "Continue the research with the agent".
6. When strom needs the user's consent it opens a window on their screen —
   tell them to answer it; you cannot. Exit code 4 means the user must run
   the given command themselves.
7. Old handwriting is read by your strongest model — never a faster or
   cheaper model, subagent or pass; a name or place the next search depends
   on is read again on an enlarged crop before it is recorded.
8. Scans come through strom. An archive the research needs has no
   downloader (connector) yet: build one yourself, unasked
   (\`strom connector new\`), and tell the user in a sentence.
9. The Strom app (${appSite(app)}) is strom's companion: a free family
   tree app, no account, the data stay on the user's computer. The research's
   result (\`output/tree-strom.ged\`) opens in it. When the user wants to see
   the tree (or \`strom\` says to offer it — once), suggest it gently — best installed as an app from the browser,
   from ${app} (\`strom app install\` opens it there; it
   then works offline); \`strom app\` opens it — with the research, followed
   live while you work, when the app can take it. Without it, the user can ask
   you about anyone in the tree: answer from \`strom person show\` and the like.
`;

export interface GlobalTarget {
  agent: string;
  file: string;
  /** A file of its own (Claude Code skill, OpenCode instructions), a block in the user's file, or a rule allowing strom in its settings. */
  kind: "own" | "block" | "allow";
  /** The Strom app's address its text names: the one `strom app` opens (the beta its beta, strom.app.url where it says another). */
  app: string;
  /** Where strom records what it created to teach the agents (agents-taught.json in the user config). */
  made: string;
}

/**
 * The rules that let the agent run strom without asking, in its own settings' words.
 * Claude Code: `strom` on PATH, and the installer's command by its path — right after
 * the installer an agent calls it so, until a new terminal has it on PATH — for each of
 * its shells: Bash, and PowerShell on Windows (a Bash rule does not cover it). Narrow
 * rules like these hold in its auto mode too, where broad ones are dropped.
 */
function allowRules(agent: string): string[] {
  if (agent === "antigravity") return ["command(strom)"];
  const commands = ["strom", ...(installation().launchers ?? [])];
  // Grok Build: one shell tool (its rules know no PowerShell)
  return commands.flatMap((c) => (agent === "grok" ? [`Bash(${c}:*)`] : [`Bash(${c}:*)`, `PowerShell(${c}:*)`]));
}

/**
 * Grok Build's config.toml, strom's lines marked: a [permission] table of strom's when there is none,
 * else strom's allow list in the user's table — when it has no allow list of its own (strom does not
 * rewrite the user's list: Grok then asks before it runs strom, as the user set it).
 */
const TOML_BEGIN = "# strom: begin (strom agents install; removed by strom agents uninstall)";
const TOML_END = "# strom: end";

function grokWithout(text: string): string {
  const lines = text.split("\n");
  const out: string[] = [];
  let inside = false;
  for (const l of lines) {
    if (l.trim() === TOML_BEGIN) inside = true;
    else if (l.trim() === TOML_END) inside = false;
    else if (!inside) out.push(l);
  }
  return out.join("\n");
}

function grokWith(text: string): string | undefined {
  const rest = grokWithout(text);
  const allow = `allow = [${allowRules("grok").map((r) => JSON.stringify(r)).join(", ")}]`;
  const lines = rest.split("\n");
  const header = lines.findIndex((l) => /^\s*\[permission\]\s*(#.*)?$/.test(l));
  if (header < 0) {
    const body = rest.replace(/\s+$/, "");
    return `${body ? `${body}\n\n` : ""}${TOML_BEGIN}\n[permission]\n${allow}\n${TOML_END}\n`;
  }
  // the user's table: up to the next table
  let end = lines.findIndex((l, i) => i > header && /^\s*\[/.test(l));
  if (end < 0) end = lines.length;
  if (lines.slice(header + 1, end).some((l) => /^\s*allow\s*=/.test(l))) return undefined;
  return [...lines.slice(0, header + 1), TOML_BEGIN, allow, TOML_END, ...lines.slice(header + 1)].join("\n");
}

/** A rule of strom's in Claude Code's or Antigravity's settings, whichever installation wrote it. */
function isStromRule(agent: string, rule: string): boolean {
  if (agent === "antigravity") return rule === "command(strom)";
  return /^(?:Bash|PowerShell)\((?:.*[\\/])?strom(?:\.exe|\.cmd)?:\*\)$/.test(rule);
}
/** Grok Build's folder (GROK_HOME, else ~/.grok). */
function grokDir(env: Env): string {
  return env.GROK_HOME ?? path.join(userHome(env), ".grok");
}

/** OpenCode: the rule that lets it run strom without asking. */
const OPENCODE_STROM = "strom *";

/** OpenCode's global config folder (it follows XDG on every system). */
function opencodeDir(env: Env): string {
  return path.join(env.XDG_CONFIG_HOME ?? path.join(userHome(env), ".config"), "opencode");
}

/** Claude Code starts its own conversations with Remote Control (its setting remoteControlAtStartup, the user's own). */
export function claudeRemoteAtStartup(env: Env): boolean {
  try {
    const file = path.join(env.CLAUDE_CONFIG_DIR ?? path.join(userHome(env), ".claude"), "settings.json");
    return (JSON.parse(fs.readFileSync(file, "utf8")) as { remoteControlAtStartup?: unknown }).remoteControlAtStartup === true;
  } catch {
    return false; // no settings, or not readable: not on
  }
}

export function globalTargets(env: Env): GlobalTarget[] {
  // an isolated installation teaches the agents nothing: they are the person's, and know the person's own strom
  if (isolated(env)) return [];
  const home = userHome(env);
  // the app's address as strom app opens it now: a run of another channel (its first) writes the texts again
  const app = agentAppUrl(env);
  const targets: Omit<GlobalTarget, "app" | "made">[] = [
    { agent: "claude", file: path.join(env.CLAUDE_CONFIG_DIR ?? path.join(home, ".claude"), "skills", "strom", "SKILL.md"), kind: "own" },
    { agent: "claude", file: path.join(env.CLAUDE_CONFIG_DIR ?? path.join(home, ".claude"), "settings.json"), kind: "allow" },
    { agent: "codex", file: path.join(env.CODEX_HOME ?? path.join(home, ".codex"), "AGENTS.md"), kind: "block" },
    // Antigravity CLI reads its global rules where Gemini CLI did, and its permissions from its settings.
    { agent: "antigravity", file: path.join(home, ".gemini", "GEMINI.md"), kind: "block" },
    { agent: "antigravity", file: path.join(home, ".gemini", "antigravity-cli", "settings.json"), kind: "allow" },
    { agent: "opencode", file: path.join(opencodeDir(env), "strom.md"), kind: "own" },
    { agent: "opencode", file: path.join(opencodeDir(env), "opencode.json"), kind: "allow" },
    { agent: "grok", file: path.join(grokDir(env), "skills", "strom", "SKILL.md"), kind: "own" },
    { agent: "grok", file: path.join(grokDir(env), "config.toml"), kind: "allow" },
  ];
  const made = path.join(configDir(env), "agents-taught.json");
  return targets.map((t) => ({ ...t, app, made }));
}

const skill = (app: string): string => `---
name: strom
description: Family history and genealogy research with the strom command — ancestors, family trees, parish registers and archives, evidence, GEDCOM and the Strom app. Use when the user wants to research their family or mentions strom or the Strom app.
---

${globalText(app)}`;

function read(file: string): string | undefined {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return undefined;
  }
}

function withoutBlock(text: string): string {
  const i = text.indexOf(BEGIN);
  const j = text.indexOf(END);
  if (i < 0 || j < i) return text;
  const before = text.slice(0, i).replace(/\s+$/, "");
  const after = text.slice(j + END.length).replace(/^\s+/, "");
  const rest = before && after ? `${before}\n\n${after}` : before || after;
  return rest ? `${rest.replace(/\s+$/, "")}\n` : "";
}

/** The agent's settings as JSON, or undefined when they are not (strom then leaves them alone). */
function settingsOf(text: string | undefined): Record<string, unknown> | undefined {
  if (text === undefined || !text.trim()) return {};
  try {
    const v = JSON.parse(text) as unknown;
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
}

function allowList(s: Record<string, unknown>): string[] {
  const p = (s.permissions ?? {}) as { allow?: unknown };
  return Array.isArray(p.allow) ? (p.allow as string[]) : [];
}

function isObject(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

/** Is strom allowed in these settings (and, for OpenCode, its instructions named)? */
function hasAllow(t: GlobalTarget, s: Record<string, unknown>): boolean {
  if (t.agent !== "opencode") return allowRules(t.agent).every((r) => allowList(s).includes(r));
  const bash = isObject(s.permission) ? s.permission.bash : undefined;
  const own = path.join(path.dirname(t.file), "strom.md");
  return isObject(bash) && bash[OPENCODE_STROM] === "allow" && Array.isArray(s.instructions) && s.instructions.includes(own);
}

function addAllow(t: GlobalTarget, s: Record<string, unknown>): void {
  if (t.agent !== "opencode") {
    const have = allowList(s);
    s.permissions = { ...((s.permissions as object | undefined) ?? {}), allow: [...have, ...allowRules(t.agent).filter((r) => !have.includes(r))] };
    return;
  }
  const perm = isObject(s.permission) ? s.permission : typeof s.permission === "string" ? { "*": s.permission } : {};
  // A plain value for bash ("ask") becomes the general rule; strom's comes after it (the last match counts).
  const bash = isObject(perm.bash) ? perm.bash : typeof perm.bash === "string" ? { "*": perm.bash } : {};
  s.permission = { ...perm, bash: { ...bash, [OPENCODE_STROM]: "allow" } };
  const own = path.join(path.dirname(t.file), "strom.md");
  const list = Array.isArray(s.instructions) ? (s.instructions as unknown[]) : [];
  if (!list.includes(own)) s.instructions = [...list, own];
}

function removeAllow(t: GlobalTarget, s: Record<string, unknown>): void {
  if (t.agent !== "opencode") {
    const rest = allowList(s).filter((r) => !isStromRule(t.agent, r));
    const perms = { ...(s.permissions as object) } as Record<string, unknown>;
    if (rest.length) perms.allow = rest;
    else delete perms.allow;
    if (Object.keys(perms).length) s.permissions = perms;
    else delete s.permissions;
    return;
  }
  const own = path.join(path.dirname(t.file), "strom.md");
  if (Array.isArray(s.instructions)) {
    const rest = s.instructions.filter((i) => i !== own);
    if (rest.length) s.instructions = rest;
    else delete s.instructions;
  }
  if (isObject(s.permission) && isObject(s.permission.bash)) {
    const bash = { ...s.permission.bash };
    delete bash[OPENCODE_STROM];
    const perm = { ...s.permission } as Record<string, unknown>;
    if (Object.keys(bash).length) perm.bash = bash;
    else delete perm.bash;
    if (Object.keys(perm).length) s.permission = perm;
    else delete s.permission;
  }
}

/**
 * What strom created to teach the agents: each file it wrote — created, or the person's that existed before — and the
 * folders it made for them. An installation before this record (1.12.1, the betas before 1.13.0-beta.6) left none: its
 * files are neither (strom cannot tell whose they are) and stay as an uninstall left them before.
 */
interface Made {
  files?: Record<string, "created" | "existed">;
  dirs?: string[];
}

function readMade(file: string): Made {
  try {
    const v = JSON.parse(fs.readFileSync(file, "utf8")) as unknown;
    return isObject(v) ? (v as Made) : {};
  } catch {
    return {}; // none yet, or not readable: nothing known
  }
}

function writeMade(file: string, m: Made): void {
  try {
    const files = m.files && Object.keys(m.files).length ? m.files : undefined;
    const dirs = m.dirs?.length ? [...new Set(m.dirs)].sort() : undefined;
    if (!files && !dirs) fs.rmSync(file, { force: true });
    else writeFileAtomic(file, JSON.stringify({ ...(files ? { files } : {}), ...(dirs ? { dirs } : {}) }, null, 2) + "\n");
  } catch {
    // the user config not writable: the files stay as an uninstall without the record leaves them
  }
}

/** Is any of strom's part in this text of the agent's file? */
function hasStrom(t: GlobalTarget, text: string): boolean {
  if (t.kind === "own") return true;
  if (t.kind === "allow" && t.agent === "grok") return text.includes(TOML_BEGIN);
  if (t.kind === "block") return text.includes(BEGIN);
  const s = settingsOf(text);
  if (!s) return false;
  if (t.agent !== "opencode") return allowList(s).some((r) => isStromRule(t.agent, r));
  const own = path.join(path.dirname(t.file), "strom.md");
  return (Array.isArray(s.instructions) && s.instructions.includes(own)) || (isObject(s.permission) && isObject(s.permission.bash) && OPENCODE_STROM in s.permission.bash);
}

/** Recorded after a write: the file created now, or the person's (one without strom's part); the folders made for it. */
function noteWritten(t: GlobalTarget, before: string | undefined, firstDir: string | undefined): void {
  const m = readMade(t.made);
  const files = { ...(m.files ?? {}) };
  const dirs = [...(m.dirs ?? [])];
  if (before === undefined) files[t.file] = "created";
  // there without strom's part: the person's — also one recorded created, deleted since and made again by the person
  else if (!hasStrom(t, before)) files[t.file] = "existed";
  // strom's part already there: what is recorded stands; nothing recorded, an older installation's file — whose, nobody can tell
  if (firstDir) for (let d = path.dirname(t.file); ; d = path.dirname(d)) {
    dirs.push(d);
    if (d === firstDir || path.dirname(d) === d) break;
  }
  if (JSON.stringify(files) !== JSON.stringify(m.files ?? {}) || dirs.length !== (m.dirs ?? []).length) writeMade(t.made, { files, dirs });
}

/** Its part taken away: the file is the person's again (or gone); the folders strom made for it go when empty. */
function noteRemoved(t: GlobalTarget): void {
  const m = readMade(t.made);
  const files = { ...(m.files ?? {}) };
  delete files[t.file];
  const here = path.dirname(t.file);
  const within = (d: string) => here === d || here.startsWith(d.endsWith(path.sep) ? d : d + path.sep);
  // deepest first: a folder strom made in another it made
  const dirs = [...(m.dirs ?? [])].sort((x, y) => y.length - x.length).filter((d) => {
    if (!within(d)) return true;
    try {
      if (fs.readdirSync(d).length) return true; // something else in it: it stays, and so does the record
      fs.rmdirSync(d);
    } catch {
      // gone already
    }
    return false;
  });
  writeMade(t.made, { files, dirs });
}

/** Write it for one agent; false when it was already there as it is. */
export function installGlobal(t: GlobalTarget): boolean {
  const cur = read(t.file);
  let next: string;
  if (t.kind === "allow" && t.agent === "grok") {
    const with_ = grokWith(cur ?? "");
    if (with_ === undefined) return false;
    next = with_;
  } else if (t.kind === "allow") {
    const s = settingsOf(cur);
    if (!s || hasAllow(t, s)) return false;
    addAllow(t, s);
    next = JSON.stringify(s, null, 2) + "\n";
  } else if (t.kind === "own") next = t.agent === "claude" || t.agent === "grok" ? skill(t.app) : globalText(t.app);
  else {
    const rest = cur ? withoutBlock(cur).replace(/\s+$/, "") : "";
    next = `${rest ? `${rest}\n\n` : ""}${BEGIN}\n${globalText(t.app)}${END}\n`;
  }
  if (cur === next) return false;
  const firstDir = fs.mkdirSync(path.dirname(t.file), { recursive: true });
  writeFileAtomic(t.file, next);
  noteWritten(t, cur, firstDir);
  return true;
}

/** Take it away again; false when there was nothing of strom's. */
export function uninstallGlobal(t: GlobalTarget): boolean {
  const removed = takeAway(t, readMade(t.made).files?.[t.file]);
  if (removed) noteRemoved(t);
  return removed;
}

/**
 * Strom's part out of the file. Nothing else left in it: a file strom created goes, the person's stays (empty); one of
 * an installation that recorded nothing stays as it did before the record — a settings file kept as {}, a text file
 * with nothing but strom's part gone.
 */
function takeAway(t: GlobalTarget, made: "created" | "existed" | undefined): boolean {
  const cur = read(t.file);
  if (cur === undefined) return false;
  if (t.kind === "allow" && t.agent === "grok") {
    if (!cur.includes(TOML_BEGIN)) return false;
    const rest = grokWithout(cur);
    if (rest.trim()) writeFileAtomic(t.file, rest.replace(/\n{3,}/g, "\n\n").replace(/\s*$/, "\n"));
    else if (made === "existed") writeFileAtomic(t.file, "");
    else fs.rmSync(t.file);
    return true;
  }
  if (t.kind === "allow") {
    const s = settingsOf(cur);
    // Any of strom's rules, also those another installation of strom wrote.
    const any = t.agent === "opencode" ? s && hasAllow(t, s) : s && allowList(s).some((r) => isStromRule(t.agent, r));
    if (!s || !any) return false;
    removeAllow(t, s);
    if (!Object.keys(s).length && made === "created") fs.rmSync(t.file);
    else writeFileAtomic(t.file, JSON.stringify(s, null, 2) + "\n");
    return true;
  }
  if (t.kind === "own") {
    // A skill is a folder of its own; OpenCode's instructions one file among the user's.
    if (t.agent === "claude" || t.agent === "grok") fs.rmSync(path.dirname(t.file), { recursive: true, force: true });
    else fs.rmSync(t.file, { force: true });
    return true;
  }
  if (!cur.includes(BEGIN)) return false;
  const rest = withoutBlock(cur);
  if (rest.trim() || made === "existed") writeFileAtomic(t.file, rest);
  else fs.rmSync(t.file);
  return true;
}

/** What strom taught the agents (where it did), brought to this version's text; the agents whose files changed. */
export function refreshGlobal(env: Env): string[] {
  const changed = new Set<string>();
  for (const t of globalTargets(env)) if (isInstalled(t) && installGlobal(t)) changed.add(t.agent);
  return [...changed];
}

export function isInstalled(t: GlobalTarget): boolean {
  const cur = read(t.file);
  if (cur === undefined) return false;
  if (t.kind === "allow" && t.agent === "grok") return cur.includes(TOML_BEGIN) && grokWith(cur) === cur;
  if (t.kind === "allow") return hasAllow(t, settingsOf(cur) ?? {});
  return t.kind === "own" || cur.includes(BEGIN);
}
