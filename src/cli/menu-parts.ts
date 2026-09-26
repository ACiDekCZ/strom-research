// What the guided menu and its submenus share: an item, the loop of a submenu,
// asking for a person, and the paths a person drops into the terminal.

import { fileURLToPath } from "node:url";
import type { Context } from "./context.ts";
import { ui, type UIKey } from "./ui.ts";
import { Tree } from "../core/tree.ts";
import type { Person, TreeConfig } from "../core/model.ts";
import { findPersons, label } from "../core/people.ts";
import { agentsHere } from "../core/apps.ts";
import { AGENTS } from "../core/which.ts";

/** Runs a strom command; quiet: its output (meant for agents) is not shown, errors are. */
export type Run = (argv: string[], quiet?: boolean) => Promise<number>;

export interface Item {
  key: string;
  label: string;
  act: () => Promise<boolean | void>;
}

/** The test (or a script) gave all its answers: nothing more is asked. */
export function outOfAnswers(ctx: Context): boolean {
  return ctx.io.answers !== undefined && ctx.io.answers.length === 0;
}

/** "Press Enter to go back to the menu." — unless there is nobody to press it. */
export async function pause(ctx: Context, lang: string): Promise<void> {
  if (!outOfAnswers(ctx)) await ctx.ask(ui(lang, "ui.enter"));
}

/**
 * A submenu: its items (built afresh each time, so what they say is current), numbered in the order shown, 0 back.
 * An item's act returning true leaves the submenu. An act waits for Enter itself, only after a long answer —
 * never after 0 or a question left: the person went back, nothing to read.
 */
export async function subMenu(ctx: Context, lang: string, build: () => { title?: string; items: Item[] }): Promise<void> {
  for (;;) {
    if (outOfAnswers(ctx)) return;
    const { title, items } = build();
    const all = [...items, { key: "0", label: ui(lang, "ui.browse.back"), act: async () => true }];
    ctx.io.stdout("\n");
    let n = 0;
    // Enter goes back: an item here changes or starts something, a person picks it by its number
    const i = await ctx.choose(
      title ?? "",
      all.map((it) => ({ key: it.key === "0" ? "0" : String(++n), label: it.label })),
      all.length - 1,
    );
    if (i === undefined) return;
    if ((await guarded(ctx, lang, all[i]!.act)) === true) return;
  }
}

/** Ask for a person by name or ID; several match: pick one. Nobody (Enter, or no answers left): undefined. */
export async function pickPerson(ctx: Context, lang: string, root: string, question: string, suggested?: string): Promise<Person | undefined> {
  const tree = Tree.open(root, ctx.env);
  for (;;) {
    if (outOfAnswers(ctx)) return undefined;
    const who = (await ctx.ask(question, suggested)).trim();
    if (!who || who === "0") return undefined;
    const byId = /^P\d+$/i.test(who) ? tree.get<Person>(who.toUpperCase()) : undefined;
    const hits = byId && !byId.retracted ? [byId] : findPersons(tree, who);
    if (!hits.length) ctx.io.stdout(ui(lang, "ui.review.none", { who }) + "\n");
    else if (hits.length === 1) return hits[0];
    else {
      const i = await ctx.choose(
        ui(lang, "ui.review.pick"),
        hits.slice(0, 9).map((p) => ({ label: label(p) })),
        0,
        { back: ui(lang, "ui.browse.back") },
      );
      return i === undefined ? undefined : hits[i];
    }
  }
}

/**
 * The paths in what a person typed or dropped into the terminal: a file dragged in comes quoted ('…', "…") or
 * with its spaces escaped (macOS, Linux: My\ Folder), several of them separated by spaces. On Windows a backslash
 * is the path's own, never an escape.
 */
export function droppedPaths(answer: string, platform: NodeJS.Platform = process.platform): string[] {
  const out: string[] = [];
  let cur = "";
  let quote: string | undefined;
  let any = false;
  const s = answer.trim();
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    if (quote) {
      if (c === quote) quote = undefined;
      else cur += c;
    } else if (c === "'" || c === '"') {
      quote = c;
      any = true;
    } else if (c === "\\" && platform !== "win32" && i + 1 < s.length) {
      cur += s[++i];
      any = true;
    } else if (/\s/u.test(c)) {
      if (cur || any) out.push(cur);
      cur = "";
      any = false;
    } else cur += c;
  }
  if (cur || any) out.push(cur);
  // some terminals drop a file as its address: file:///Users/…/My%20Folder
  return out.filter(Boolean).map((p) => {
    // Git Bash on Windows: /c/Users/… is C:\Users\…
    const drive = platform === "win32" ? /^\/([a-zA-Z])(\/.*)?$/u.exec(p) : null;
    if (drive) return `${drive[1]!.toUpperCase()}:${(drive[2] ?? "/").replace(/\//gu, "\\")}`;
    if (!/^file:\/\//iu.test(p)) return p;
    try {
      return fileURLToPath(p);
    } catch {
      return p;
    }
  });
}

/** The translator of one language, as the menu's items use it. */
export function translator(lang: string) {
  return (key: UIKey, values: Record<string, string | number> = {}) => ui(lang, key, values);
}

/** Is the agent of the research on this computer — its CLI or its desktop app? Without it, nothing is offered to start with it. */
export function agentReady(ctx: Context, tree: TreeConfig | undefined): boolean {
  const agent = ctx.settings.agent(tree).value;
  // an agent strom does not look for (a script of the user's) is theirs to have
  return !AGENTS.some((a) => a.id === agent) || agentsHere(ctx.env).some((a) => a.id === agent);
}

/** Claude Code is the agent of the research and on this computer: only then does the menu speak of what is Claude's (Remote Control, its usage). */
export function claudeHere(ctx: Context, tree: TreeConfig | undefined): boolean {
  return ctx.settings.agent(tree).value === "claude" && agentsHere(ctx.env).some((a) => a.id === "claude" && a.cli);
}

/**
 * An item's act, and what goes wrong in it said in a sentence — the menu goes on (a folder that could not be read, a
 * command that refused): never a crash of the menu with an agent's error.
 */
export async function guarded(ctx: Context, lang: string, act: () => Promise<boolean | void>): Promise<boolean | void> {
  try {
    return await act();
  } catch (err) {
    ctx.io.stdout(ui(lang, "ui.menu.failed", { reason: (err as Error).message }) + "\n");
    await pause(ctx, lang);
  }
}
