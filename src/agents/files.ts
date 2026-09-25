// Instruction and permission files for the agents that work in a tree.
// AGENTS.md is the single source every agent reads (Codex, Antigravity and
// OpenCode natively; CLAUDE.md imports it) and holds nothing agent-specific;
// each agent's own file adds what only that agent needs. .claude/settings.json
// (and OpenCode's opencode.json) allow `strom` and deny direct access to the
// evidence — the first line of defence; the seal is the one that always holds.

import fs from "node:fs";
import path from "node:path";
import { langName } from "../core/lang.ts";
import { writeFileAtomic } from "../core/json.ts";
import type { Tree } from "../core/tree.ts";
import { PROFILES, SELF_READING } from "./profiles.ts";
import { Settings } from "../core/config.ts";
import { configDir } from "../core/paths.ts";
import { treeBrowserConnectors } from "../core/connector.ts";
import { CHROME_ALLOW, CHROME_DENY, chromeDomain } from "../core/browser.ts";

export const MARKER = "<!-- strom: generated above this line (strom agents sync); your own notes below are kept -->";

function agentsMd(tree: Tree): string {
  const lang = langName(tree.config.lang);
  return `# Family research: ${tree.config.name}

This folder is a family tree researched with **strom**, a command-line tool
that holds the evidence, the method and the history of the research. You are
the researcher; \`strom\` is your only way to read and change the research.

1. Start with \`strom\` — it says where things stand and what to do next.
   \`strom guide\` explains the work; \`strom help <command>\` any command.
2. Work in sessions: \`strom session start\` gives you the brief for the next
   task; finish with \`strom session close --summary "…" --next "…"\`.
3. Never create, edit or delete anything in \`data/\`, \`strom.json\` or \`.git\`,
   never read the files in \`data/\` (strom shows them better and shorter), and
   never run git yourself. strom detects changes and then refuses to write.
4. The research language is ${lang}: talk to the user in ${lang} and write notes,
   tasks and summaries in ${lang}. Transcripts stay in the record's language.
5. Material from the user goes in with \`strom intake <file or folder>\` or
   \`strom intake --text "…"\`. Exit code 3 means strom needs an answer from the
   user; exit code 4 means the USER must run the given command in their own
   terminal — never do it yourself.
6. You may read \`inputs/\`, \`output/\`, \`notes/\` and \`.strom/views/\`, and write
   your own working notes in \`notes/\`. Scans are looked at through views:
   \`strom media view B0001:57 --half left\` writes one to \`.strom/views/\`.
7. Run strom commands on their own — no pipes (\`| head\`, \`| grep\`): output is
   already short, listings take \`--limit\` and \`--page\`, and piped commands may
   be refused by your permissions.
8. Other agents may work on this tree too (Claude Code, Codex, Antigravity,
   OpenCode — the user's choice). \`strom\` shows who is working now; never take a task
   another one has started.

## Working with the user

The user watches this conversation and is usually not technical. Talk in
${lang}, plainly: say "the baptism of Karel in 1782", not record IDs, unless
they ask.

- **First conversation** (no research yet): explain in a few sentences how you
  work together — you search registers and archives, record only what a
  record proves, and ask them for decisions and for what only they can do —
  then ask whom to research and what they know or have: names, dates, places,
  documents, photos, a family tree file.
- **The user decides**: whom to research, what next, anything that costs
  money, what you may do. Suggest; do not decide for them.
- **Ways of working** — explain them when it helps:
  - this conversation: the two of you together;
  - the agent working on its own: they start it from strom's menu ("Let the
    agent work on its own"); it works the task queue and tells them the result;
    with many tasks in the queue, suggest it — every task gets a fresh session;
  - one task, one fresh context: after a session closes, strom says how the
    user clears your context (Claude Code: /clear) — nothing is lost, strom
    keeps it all; suggest it in a sentence, go on here if they prefer;
  - what only they can do: when strom needs their consent it opens a window
    on their screen — tell them to answer it, you cannot; images a portal gives
    only by hand — strom says which ones and where to save them.
- **Downloaders**: the research needs an archive strom has no downloader
  (connector) for — build one yourself, do not wait to be asked; tell them in
  a sentence what you are doing ("I am preparing a downloader for this
  archive — a few minutes; it then fetches only the images we need, slowly").
- **Stories of their ancestors**: on by default — once records tell a life,
  strom proposes a task to write it for the family book in the Strom app
  (the method: a story rests on recorded facts only). When \`strom\` says to
  tell them (it does once, not in every conversation), say it in a sentence
  and that they may say no (\`strom config set stories no\`). A story stays a
  draft until they approve it.
- **One person looked at again** ("check grandpa František", "find more
  about her", after a new model): \`strom review <whom>\` — strom proposes
  the work as tasks (what the tree already says of them elsewhere, entries to
  read whole, facts to check); tell them how many and what a session costs,
  and they choose: here with you, or the agent alone.
- **What waits for them** (\`strom\` shows it): tell them plainly what to do
  and where, one thing at a time.
- **Results and the Strom app**: \`output/tree-strom.ged\` is the family tree
  for the Strom app (https://stromapp.info) — strom's companion: a free family
  tree app, no account, their data stay on their computer; it shows the tree,
  the sources, a map, a family book. When they want to see the results, or
  when \`strom\` says to offer it (it does once, not in every conversation),
  suggest it gently, in a sentence or two: best installed as an app from the browser, from
  https://stromapp.info/run/ — \`strom app install\` opens it there and says
  where to click; it works offline then; \`strom app\` opens it, with this
  research when the app can take it — run by you, the app then follows the
  research live, what you record shows there by itself (else in the app:
  Import, and this file) — each register entry with its image, cut out of its
  scan. \`strom\` says which, in its results line. A program they already use is fine too:
  \`output/tree.ged\`. If they do not want it, do not bring it up again.
- **The tree in this conversation, app or not**: they can simply ask you —
  about anyone in the tree, a family, a line, what is proven and by which
  record, what is still missing. Answer from strom (\`strom person show\`,
  \`family show\`, \`research show\`, \`find\`, \`source show\`, \`story show\`,
  \`gaps\`, \`frontier\`) in plain words: names, dates, places and the record
  behind each fact, no IDs. When \`strom\` says to (once), tell them they can
  ask like this.

${SELF_READING}
${MARKER}
`;
}

function claudeMd(tree: Tree): string {
  const models = new Settings(tree.env, {}).models("claude", tree.config);
  return `@AGENTS.md

Claude Code: use Bash for \`strom\` commands only; read images and documents
with the Read tool. You can choose a model for a subagent: delegate reading as
below, not the way "Reading scans" in AGENTS.md says for other agents.

${PROFILES.claude!.instructions(models)}
${MARKER}
`;
}


/** An absolute path as a Claude Code permission path ("//Users/x", "//c/Users/x"). */
export function permissionPath(abs: string): string {
  const p = abs.replace(/\\/g, "/");
  const win = /^([A-Za-z]):\/(.*)$/.exec(p);
  return win ? `//${win[1]!.toLowerCase()}/${win[2]}` : `/${p}`;
}

/**
 * Permissions for Claude Code in this tree (paths of this computer). File rules are
 * Edit(…) only: Claude Code checks every file-editing tool against them (Write(…)
 * rules match nothing and are reported as a mistake).
 */
export function claudeSettings(tree: Tree): Record<string, unknown> {
  const settings = new Settings(tree.env, {});
  const shared = settings.shared()?.value;
  const keys = permissionPath(configDir(tree.env));
  // Connectors of this tree whose images come through the user's browser: browser tools, for their sites only.
  const browser = treeBrowserConnectors(tree, shared);
  const sites = [...new Set(browser.flatMap((c) => c.manifest.hosts.map(chromeDomain)))];
  const downloads = permissionPath(settings.downloads());
  const lead = settings.models("claude", tree.config).lead;
  // A rule for each of Claude Code's shells: Bash, and PowerShell (on Windows) — a Bash rule does not cover it.
  const shell = (cmd: string) => [`Bash(${cmd})`, `PowerShell(${cmd})`];
  return {
    permissions: {
      allow: [
        ...shell("strom:*"),
        "Read(inputs/**)",
        "Read(output/**)",
        "Read(notes/**)",
        "Read(.strom/views/**)",
        // Files the user drops for the research; scans are seen through views only (strom media view).
        ...(shared ? [`Read(${permissionPath(path.join(shared, "inbox"))}/**)`] : []),
        "Edit(notes/**)",
        // A connector it builds for an archive the research needs (strom connector new); strom runs it.
        ...(shared ? (["Read", "Edit"] as const).map((t) => `${t}(${permissionPath(path.join(shared, "plugins", "connectors"))}/**)`) : []),
        "WebSearch",
        "WebFetch",
        ...(sites.length ? [...CHROME_ALLOW, ...sites] : []),
      ],
      deny: [
        "Read(data/**)",
        // The media store: images are looked at through views, so strom knows what was seen.
        ...(shared ? [`Read(${permissionPath(path.join(shared, "media"))}/**)`] : []),
        "Edit(data/**)",
        "Edit(strom.json)",
        "Edit(.git/**)",
        ...shell("git:*"),
        // A password is typed by the user in their own terminal, and so is installing a plugin; the seal is strom's.
        // (Consents the agent may ask for — strom allow …: strom asks the person in a window.)
        ...shell("strom login:*"),
        ...shell("strom connector add:*"),
        ...shell("strom connector remove:*"),
        ...shell("strom seal:*"),
        // The limiter's memory (pace, refusals).
        ...(shared ? [`Edit(${permissionPath(path.join(shared, "net"))}/**)`] : []),
        // A session ends with its turn: nothing wakes it up later (a live run waited for a wake-up that never came).
        "ScheduleWakeup",
        "CronCreate",
        // The seal keys: an agent that could read them could forge the seal.
        `Read(${keys}/**)`,
        `Edit(${keys}/**)`,
        // What the browser downloads is strom's to take over; the rest of the folder is the user's.
        `Read(${downloads}/**)`,
        ...CHROME_DENY,
        // With full permissions only the deny rules count: what the allow list kept away is kept away here.
        ...(settings.agentPermissions() === "full" ? BYPASS_DENY : []),
      ],
    },
    // The user's model: the desktop app cannot be given one when it opens (the CLI is, with --model).
    ...(lead ? { model: lead } : {}),
  };
}

/** Denied as well when the user lets the agent do everything else (agent.permissions full). */
export const BYPASS_DENY = [
  // its own permissions and instructions
  "Edit(.claude/**)",
  ...["AGENTS.md", "CLAUDE.md"].map((f) => `Edit(${f})`),
  // downloads round strom's limiter
  "Bash(curl:*)",
  "Bash(wget:*)",
];

/**
 * OpenCode's rules for this tree (opencode.json in the tree folder, found as the
 * project's config): strom commands allowed; the evidence, the seal and git are
 * strom's; a password and installing a plugin the user's own. Paths inside the
 * tree are relative to it; folders outside it (the shared inbox and plugins) are
 * "external directories". Of several matching rules the last one counts, so the
 * general rule comes first.
 */
export function opencodeConfig(tree: Tree): Record<string, unknown> {
  const settings = new Settings(tree.env, {});
  const shared = settings.shared()?.value;
  const abs = (p: string) => p.replace(/\\/g, "/");
  const full = settings.agentPermissions() === "full";
  const users = ["strom login *", "strom seal *", "strom connector add *", "strom connector remove *"];
  return {
    $schema: "https://opencode.ai/config.json",
    permission: {
      bash: {
        "*": "ask",
        "strom *": "allow",
        ...Object.fromEntries(users.map((c) => [c, "deny"])),
        "git *": "deny",
        ...(full ? { "curl *": "deny", "wget *": "deny" } : {}),
      },
      read: { "*": "allow", "data/*": "deny", ".git/*": "deny" },
      edit: {
        "*": "ask",
        "notes/*": "allow",
        "data/*": "deny",
        ".git/*": "deny",
        "strom.json": "deny",
        // its own rules and instructions
        "opencode.json": "deny",
        ...Object.fromEntries(["AGENTS.md", "CLAUDE.md", ".claude/*"].map((f) => [f, "deny"])),
      },
      external_directory: {
        "*": "ask",
        ...(shared
          ? {
              [`${abs(path.join(shared, "inbox"))}/*`]: "allow",
              [`${abs(path.join(shared, "plugins", "connectors"))}/*`]: "allow",
              // images are looked at through views, so strom knows what was seen; the limiter's memory is strom's
              [`${abs(path.join(shared, "media"))}/*`]: "deny",
              [`${abs(path.join(shared, "net"))}/*`]: "deny",
            }
          : {}),
        // the seal keys, and what the browser downloads (strom's to take over)
        [`${abs(configDir(tree.env))}/*`]: "deny",
        [`${abs(settings.downloads())}/*`]: "deny",
      },
      webfetch: "allow",
      websearch: "allow",
    },
  };
}

/** Files strom wrote for Gemini CLI (gone: Google ended it for personal accounts) — taken away when they are strom's. */
const OBSOLETE: [string, (text: string) => boolean][] = [
  ["GEMINI.md", (t) => t.startsWith("@./AGENTS.md") && t.includes(MARKER) && t.slice(t.indexOf(MARKER) + MARKER.length).trim() === ""],
  [path.join(".gemini", "strom-policy.toml"), (t) => t.startsWith("# strom: generated")],
];

/** Keep what the user wrote below the marker. */
function withUserPart(file: string, generated: string): string {
  try {
    const old = fs.readFileSync(file, "utf8");
    const i = old.indexOf(MARKER);
    if (i >= 0) return generated + old.slice(i + MARKER.length + 1);
  } catch {
    // new file
  }
  return generated;
}

export const AGENT_FILES = ["AGENTS.md", "CLAUDE.md", path.join(".claude", "settings.json"), "opencode.json"];

export function syncAgentFiles(tree: Tree): string[] {
  const written: string[] = [];
  const write = (rel: string, content: string) => {
    const file = path.join(tree.root, rel);
    const next = rel.endsWith(".md") ? withUserPart(file, content) : content;
    let cur: string | undefined;
    try {
      cur = fs.readFileSync(file, "utf8");
    } catch {
      cur = undefined;
    }
    if (cur === next) return;
    if (!tree.dryRun) writeFileAtomic(file, next);
    written.push(rel.split(path.sep).join("/"));
  };
  write("AGENTS.md", agentsMd(tree));
  write("CLAUDE.md", claudeMd(tree));
  write(path.join(".claude", "settings.json"), JSON.stringify(claudeSettings(tree), null, 2) + "\n");
  write("opencode.json", JSON.stringify(opencodeConfig(tree), null, 2) + "\n");
  for (const [rel, ours] of OBSOLETE) {
    const file = path.join(tree.root, rel);
    let text: string;
    try {
      text = fs.readFileSync(file, "utf8");
    } catch {
      continue;
    }
    if (!ours(text)) continue; // the user's own
    if (!tree.dryRun) {
      fs.rmSync(file);
      if (path.dirname(rel) !== "." && fs.readdirSync(path.dirname(file)).length === 0) fs.rmdirSync(path.dirname(file));
    }
    written.push(rel.split(path.sep).join("/"));
  }
  return written;
}
