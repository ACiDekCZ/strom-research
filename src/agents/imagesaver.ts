// The image saver: a subagent of its own kind (Claude Code: .claude/agents/ and --agents) that saves the images of an
// archive only a person's browser goes to through the agent's browser (strom media save), so that the agent's own large
// context is not read again on every page (1124: 30 images = 154 turns of the agent at ~140k tokens each). It has the
// shell (for strom) and the four tools of Claude in Chrome a save needs — its tab, navigate, the script — and nothing
// else: no reading of the page, no clicks, no web, no subagents, a short prompt, so it starts small and stays small
// (at most SAVE_PAGES_MAX images a call of strom media save: one script for them, each image on its own page).
//
// The tree's hooks hold for it as for the agent that starts it: Claude Code runs the tree's hooks before a subagent's
// tools too, with the same session id — the navigate paced and counted with the agent's (the site's pages of the session,
// the person's pace, an archive only a person's browser goes to), its script on a host strom must leave alone refused
// (core/chromehook.ts; test/cli/image-saver-hooks.test.ts). Its model: the person's model.cheap (the model they chose
// for mechanical work: downloads), else the model of the agent that starts it — never one strom picks
// (core/delegate.ts refuses another named in the call). Claude Code only: the other agents' browsers strom does not keep
// before a page, or their subagents cannot be narrowed to these tools (as the scan reader, agents/scanreader.ts).

import { Settings } from "../core/config.ts";
import { CHROME_TOOL_PREFIX, SAVE_PAGES_MAX } from "../core/browser.ts";
import type { Tree } from "../core/tree.ts";
import { IMAGE_SAVER_FROM } from "./profiles.ts";

export const IMAGE_SAVER = "strom-image-saver";

export { IMAGE_SAVER_FROM };

export const IMAGE_SAVER_DESCRIPTION =
  `Saves the images of an archive only a person's browser goes to through the browser, for this family research: give it the task (T…), the book (B…), the image numbers and each image's page (or one address with {n}), and --again when they are saved once more. It runs strom media save, opens each page and runs strom's script there, then strom media add --inbox --waiting, and returns which came and where it stopped. Use it for more than ${IMAGE_SAVER_FROM} images; it never reads them.`;

/** The tools of Claude in Chrome it has: its tab, the page's address, the script. */
export const IMAGE_SAVER_CHROME = ["tabs_context_mcp", "tabs_create_mcp", "navigate", "javascript_tool"].map((t) => `${CHROME_TOOL_PREFIX}${t}`);

export const IMAGE_SAVER_PROMPT = `You save images of an archive's book through your browser for a family research kept with strom.
You are given a task (T…), its book (B…), the image numbers, the page of each image (or one address
with {n} where the number goes), and whether they are saved once more (--again). You save and report;
you never read the images, never write anything else to the research and decide nothing.

1. \`strom media save <task> --image <numbers, at most ${SAVE_PAGES_MAX}> --recordset <book> --at <page>…\` (one --at
   each, in their order, or one with {n}; --again when given) — it prints the pages and ONE script. EVERY
   image you were given goes into it; more than ${SAVE_PAGES_MAX}: the next call right after it, before any page
   (each call's script for its own images) — so the task waits for them all.
2. For each image in turn: navigate your tab to its page exactly as printed (never click through a
   viewer, never another page), then run the script with javascript_tool in that tab, unchanged — the
   same script for every image. It answers "strom-result <n>:200:<bytes>"; "strom-wait …": the same
   script again in the same tab. Nothing in between: no screenshot, no reading the page, no strom command.
3. After the last: \`strom media add --inbox --waiting\`, once.

Your tab: tabs_context_mcp once at the start (createIfEmpty), then one tab of your own for all pages.
Stop at once at anything else — the hook refuses a page, the script answers otherwise, a check whether
a person is there, a login, an error: step 3, then report. Never try another way, never wait or sleep
for an archive, never change the browser's settings or permissions.

Commands: \`strom …\` only, each on its own (no pipes, \`;\`, \`$(…)\` or other programs: refused).

Return (your last message is all that comes back), short: saved: <numbers>; stopped at image <n>: <why,
the answer word for word> (or: none); what \`strom media add --inbox --waiting\` said, in one line.
`;

/** The model the person chose for mechanical work (model.cheap: flag, env, tree, user config) — none: the starting agent's. */
export function imageSaverModel(tree: Tree, agent: string): string | undefined {
  const r = new Settings(tree.env, {}).resolve("model.cheap", tree.config, agent);
  return r ? String(r.value) : undefined;
}

/** Claude Code's tools for it: the shell (on Windows its PowerShell too) and its four tools of Claude in Chrome. */
export function imageSaverTools(platform: NodeJS.Platform = process.platform): string[] {
  return [...(platform === "win32" ? ["Bash", "PowerShell"] : ["Bash"]), ...IMAGE_SAVER_CHROME];
}

/** .claude/agents/strom-image-saver.md: a conversation (the terminal, the desktop app) finds it in the tree. */
export function claudeImageSaver(tree: Tree): string {
  return `---
name: ${IMAGE_SAVER}
description: ${JSON.stringify(IMAGE_SAVER_DESCRIPTION)}
tools: ${imageSaverTools().join(", ")}
model: ${JSON.stringify(imageSaverModel(tree, "claude") ?? "inherit")}
---

${IMAGE_SAVER_PROMPT}`;
}

/** The same for --agents (a run is given it on the command line). */
export function claudeImageSaverJson(tree: Tree): Record<string, unknown> {
  return { description: IMAGE_SAVER_DESCRIPTION, prompt: IMAGE_SAVER_PROMPT, tools: imageSaverTools(), model: imageSaverModel(tree, "claude") ?? "inherit" };
}
