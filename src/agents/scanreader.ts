// The scan reader: a subagent of its own kind for reading scans, in the agents that let a tree define one (Claude Code:
// .claude/agents/ and --agents; OpenCode: an agent of mode subagent in opencode.json). It has the shell (for strom) and
// the file reader (for its views) and nothing else — no subagents of its own, no web, no editing — and a short prompt,
// so it starts small (a subagent of the agent's general kind starts with every tool and instruction the agent has).
// Its model is the user's model.vision where they set one, else the model of the agent that starts it: never a
// cheaper one picked by strom. Codex, Antigravity and Grok Build get none: Codex's agent roles cannot narrow its tools
// and Antigravity has no such setting; Grok Build reads scans itself (profiles.ts), as the tree tells it.

import path from "node:path";
import { Settings } from "../core/config.ts";
import { writeFileAtomic } from "../core/json.ts";
import type { Tree } from "../core/tree.ts";
import { DEFAULT_READING_NUMBERS, type ReadingNumbers } from "./profiles.ts";
import { readingFor } from "../core/tune.ts";

export const SCAN_READER = "strom-scan-reader";

export const SCAN_READER_DESCRIPTION =
  "Reads scans of old records for this family research (registers, indexes, land books, any old handwriting): give it the images (B0001:57-66, M0012) and the whole question — what counts as a find, which years and names. It opens the views through strom, reads them and returns what it read, image by image. It never writes to the research.";

/** The scan reader's prompt, with the numbers of its reading (tuned for its agent and model, else the defaults). */
export function scanReaderPrompt(n: ReadingNumbers = DEFAULT_READING_NUMBERS): string {
  const images = Math.min(12, n.viewsPerCall);
  return `You read scans of old records for a family research kept with strom. You are given images
(B0001:57-66, M0012…) and the whole question: what counts as a find, which years and names. You read
and report; you never write to the research and decide nothing.

Views: run strom by its command — \`strom media view B0001:57-60 --half both\` (at most ${images} images and
${n.viewsPerCall} views a call: ${images} whole images, or ${Math.max(1, Math.floor(n.viewsPerCall / 4))} with 4 views each — halves and crops); an entry to read closely: \`--grid\` to see where it is, then \`--crop x,y,w,h\` at
full resolution; \`--contrast\` for faded ink. Open ALL the views a call lists in ONE message — every
Read call together, never one view at a time — then read them and write down at once, image by image,
what they gave (as under Return), then the next call. Views take much room: the oldest may be cleared
from your context to make room, your notes stay. Never open a view again because it is gone — your
notes hold what it gave. After about ${n.viewsStop} views, stop and report what you have. \`strom read …\` hands
a range to strom's own readers: only when the question asks for it (in the foreground; let it finish).

Commands: \`strom …\` only, each on its own (no pipes, \`;\`, \`$(…)\` or other programs: refused). A text in
the research's files (inputs/, notes/): \`strom grep "<text>"\` — never Read a big file in pieces.

Images: you never fetch them (no \`strom fetch\`) and never wait or sleep for an archive. An image not
here, or too small to read: say which in your report — the agent who sent you fetches them.

Reading: only what the question asks for (page numbers and headings only, the entries of one surname,
one entry whole) — transcribe nothing else. Transcribe as written — the record's language, spelling and
abbreviations, not modernised; [?] for each uncertain letter or word; never complete a name or date from
what the question expects. "Illegible" beats a guess; "nothing" is a valid result.

Return (your last message is all that comes back: it repeats every note), image by image (image and
page): found / nothing / unclear; each entry that answers the question word for word, where it stands
and its columns (date, house, names, parents, godparents, witnesses, remarks); what was illegible and
where; the hand; how sure you are of each name. A possible match you could not read: one line
"unclear: B…:<image> <where on it: page, entry from the top, or x,y,w,h> — <what>" (the agent looks
there closer before it calls the range searched in vain). Say plainly which images you did not open or
read whole — never report an image you did not read as searched.
`;
}

export const SCAN_READER_PROMPT = scanReaderPrompt();

/** The model the user chose for reading handwriting (model.vision: flag, env, tree, user config) — none: the starting agent's. */
export function scanReaderModel(tree: Tree, agent: string): string | undefined {
  const r = new Settings(tree.env, {}).resolve("model.vision", tree.config, agent);
  return r ? String(r.value) : undefined;
}

/** Claude Code's tools for it: the shell (on Windows its PowerShell too, where the tree's rules allow strom as well) and the file reader. */
export function scanReaderTools(platform: NodeJS.Platform = process.platform): string[] {
  return platform === "win32" ? ["Bash", "PowerShell", "Read"] : ["Bash", "Read"];
}

/** The numbers of an agent's reading in this tree (what strom tuned for its agent and model; a session: as at its start). */
export function treeReading(tree: Tree, agent: string, since?: string): ReadingNumbers {
  return readingFor(new Settings(tree.env, {}), agent, tree.config, { since, root: tree.root });
}

/** .claude/agents/strom-scan-reader.md: a conversation (the terminal, the desktop app) finds it in the tree. */
export function claudeScanReader(tree: Tree): string {
  return `---
name: ${SCAN_READER}
description: ${JSON.stringify(SCAN_READER_DESCRIPTION)}
tools: ${scanReaderTools().join(", ")}
model: ${JSON.stringify(scanReaderModel(tree, "claude") ?? "inherit")}
---

${scanReaderPrompt(treeReading(tree, "claude"))}`;
}

/** The same for --agents: a run is given it on the command line, whatever Claude Code makes of the folder's files. */
export function claudeAgentsJson(tree: Tree, since?: string): Record<string, unknown> {
  return {
    [SCAN_READER]: {
      description: SCAN_READER_DESCRIPTION,
      prompt: scanReaderPrompt(treeReading(tree, "claude", since)),
      tools: scanReaderTools(),
      model: scanReaderModel(tree, "claude") ?? "inherit",
    },
  };
}

/** The file a headless run of Claude Code is given (--agents): in .strom/, written afresh for each session (as at its start). */
export function claudeAgentsFile(tree: Tree, since?: string): string {
  const file = path.join(tree.root, ".strom", "claude-agents.json");
  writeFileAtomic(file, JSON.stringify(claudeAgentsJson(tree, since), null, 2) + "\n");
  return file;
}

/**
 * OpenCode's agent of mode subagent: the tree's rules with everything but reading and strom refused — no editing, no
 * web, no subagents, no questions (nothing that would ask: a run nobody watches would end at it).
 */
export function opencodeScanReader(tree: Tree, permission: Record<string, unknown>, refused: (v: unknown) => unknown): Record<string, unknown> {
  const model = scanReaderModel(tree, "opencode");
  const bash = permission.bash as Record<string, string>;
  const only: Record<string, unknown> = {
    ...permission,
    bash: { ...bash, "*": "deny" },
    edit: "deny",
    webfetch: "deny",
    websearch: "deny",
    task: "deny",
    question: "deny",
    skill: "deny",
    todowrite: "deny",
  };
  // it never fetches (the agent who sent it does, before): the last matching rule counts, so after "strom *"
  only.bash = { ...(only.bash as Record<string, string>), "strom fetch *": "deny" };
  return {
    mode: "subagent",
    description: SCAN_READER_DESCRIPTION,
    prompt: scanReaderPrompt(treeReading(tree, "opencode")),
    ...(model ? { model } : {}),
    permission: refused(only),
  };
}
