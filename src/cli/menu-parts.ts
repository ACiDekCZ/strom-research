// What the guided menu and its submenus share: an item, the loop of a submenu,
// asking for a person, and the paths a person drops into the terminal.

import { fileURLToPath } from "node:url";
import type { Context } from "./context.ts";
import { agentHere } from "../core/state.ts";
import { ui, type UIKey } from "./ui.ts";
import { Tree } from "../core/tree.ts";
import { Cancelled, InputEnded } from "../core/errors.ts";
import type { Person, TreeConfig } from "../core/model.ts";
import { findPersons, label } from "../core/people.ts";
import { agentsHere } from "../core/apps.ts";

/** Runs a strom command; quiet: its output (meant for agents) is not shown, errors are. */
export type Run = (argv: string[], quiet?: boolean) => Promise<number>;

export interface Item {
  key: string;
  label: string;
  /** Its state or count, in the column of values (cli/screen.ts). */
  value?: string | undefined;
  /** What it holds, said faintly after it. */
  extra?: string | undefined;
  /** Its part of the way to the screen it opens (else its label up to its first aside). */
  crumb?: string | undefined;
  /** true: back (a submenu) or quit (the menu); "quit": out of the menu from a submenu too. */
  act: () => Promise<boolean | "quit" | void>;
}

/** The longest label of an item (spec 144): what it is; the rest goes to its value or after it. */
export const LABEL_MAX = 40;

/** The longest state an item's text says that shaped's auto takes as its value (longer: said after it). */
const VALUE_MAX = 24;

/**
 * An item's text as a screen shows it (spec 144): what it is as the label, the rest beside it — "Hooks: on" → Hooks ·
 * value "on"; "Settings: agent, archives" → Settings · faint "agent, archives"; "Tune the scans (tuned 3. 11.)" → value
 * "tuned 3. 11." with `as: "value"`. A label longer than LABEL_MAX gives its aside in brackets to the rest. A switch
 * says where it switches to (`to`): faint after the state, "→ switch to the browser".
 */
export function shaped(text: string, opts: { as?: "value" | "extra" | "auto"; to?: string | undefined; swap?: boolean } = {}): Pick<Item, "label" | "value" | "extra"> {
  let as = opts.as ?? "extra";
  let label = text;
  let rest: string | undefined;
  const colon = /^(.+?):\s+(.+)$/su.exec(text);
  const bracket = /^(.+?) \(([^()]+)\)$/su.exec(text);
  const dash = /^(.+?) [–—] (.+)$/su.exec(text);
  if (colon && !/\([^)]*$/u.test(colon[1]!)) [label, rest] = [colon[1]!, colon[2]!];
  else if (bracket) [label, rest] = [bracket[1]!, bracket[2]!];
  else if (dash) [label, rest] = [dash[1]!, dash[2]!];
  // "Language, agent, model… (the setup)": what it is said in brackets, what it holds before them
  if (opts.swap && rest) {
    const what = rest.replace(/^(?:the|die|der|das) /iu, "");
    [label, rest] = [what.charAt(0).toLocaleUpperCase() + what.slice(1), label.replace(/…$/u, "")];
  }
  let aside: string | undefined;
  if ([...label].length > LABEL_MAX) {
    const m = / \(([^()]+)\)/u.exec(label);
    if (m) {
      label = (label.slice(0, m.index) + label.slice(m.index + m[0].length)).trim();
      aside = m[1];
    }
  }
  // auto: a state (a word or two, a number) is the value, what an item holds (a list, a sentence) said after it — a
  // state with its own aside in brackets: the state the value, the aside after it ("on (nothing proposed while …)")
  // (an aside in brackets of the whole text is said after it: "Yes (recommended)" — a count the value: "Hypotheses (3)")
  if (as === "auto" && rest) {
    const own = /^(.+?) \(([^()]+)\)$/su.exec(rest);
    const state = own ? own[1]! : rest;
    const bracketed = !colon && bracket && !/^\p{N}+$/u.test(rest);
    if (!bracketed && [...state].length <= VALUE_MAX && !/[,;]/u.test(state)) {
      as = "value";
      if (own) {
        rest = state;
        aside = aside ? `${own[2]!} · ${aside}` : own[2]!;
      }
    } else as = "extra";
  }
  const value = as === "value" ? rest : undefined;
  const said = [as === "extra" ? rest : undefined, aside].filter(Boolean).join(" · ");
  const extra = [said, opts.to ? `→ ${opts.to}` : ""].filter(Boolean).join("  ") || undefined;
  return { label, value, extra };
}

/** The test (or a script) gave all its answers: nothing more is asked. */
export function outOfAnswers(ctx: Context): boolean {
  return ctx.io.answers !== undefined && ctx.io.answers.length === 0;
}

/** "Press Enter to go back to the menu." — unless there is nobody to press it. */
export async function pause(ctx: Context, lang: string, enter: "ui.enter" | "ui.enter.close" = "ui.enter"): Promise<void> {
  if (!outOfAnswers(ctx) && !ctx.devicePreview) await ctx.ask(ui(lang, enter));
}

/**
 * A submenu: its items (built afresh each time, so what they say is current), numbered in the order shown, 0 back.
 * An item's act returning true leaves the submenu. An act waits for Enter itself, only after a long answer —
 * never after 0 or a question left: the person went back, nothing to read.
 *
 * `fixed`: each item keeps its own key as its number (1…9) — an item shown only sometimes leaves a gap where it is not,
 * so the numbers a person knows never move; the number of an item not shown is refused like any wrong one.
 */
export async function subMenu(ctx: Context, lang: string, build: () => { title?: string; items: Item[] }, opts: { fixed?: boolean } = {}): Promise<"quit" | void> {
  for (;;) {
    if (outOfAnswers(ctx)) return;
    const { title, items } = build();
    const all = [...(opts.fixed ? [...items].sort((a, b) => Number(a.key) - Number(b.key)) : items), { key: "0", label: ui(lang, "ui.browse.back"), act: async () => true }];
    let n = 0;
    // Enter goes back: an item here changes or starts something, a person picks it by its number
    const i = await ctx.choose(
      title ?? "",
      // an item said as one text ("Time for one task: 30 min"): its label, its state in the column of values
      all.map((it) => ({ key: it.key === "0" || opts.fixed ? it.key : String(++n), ...(it.value || it.extra || it.key === "0" ? { label: it.label, value: it.value, extra: it.extra } : shaped(it.label, { as: "auto" })) })),
      all.length - 1,
      { screen: true },
    );
    if (i === undefined) return;
    const item = all[i]!;
    const done = item.key === "0" ? true : await ctx.within(item.label, () => guarded(ctx, lang, item.act), item.crumb);
    if (done === "quit") return "quit";
    if (done === true) return;
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
  // the same answer the research's state gives (core/state.ts): an agent strom does not look for (a script of the
  // user's) is theirs to have
  return agentHere(ctx.settings.agent(tree).value, ctx.env);
}

/** Claude Code is the agent of the research and on this computer: only then does the menu speak of what is Claude's (Remote Control, its usage). */
export function claudeHere(ctx: Context, tree: TreeConfig | undefined): boolean {
  return ctx.settings.agent(tree).value === "claude" && agentsHere(ctx.env).some((a) => a.id === "claude" && a.cli);
}

/**
 * An item's act, and what goes wrong in it said in a sentence — the menu goes on (a folder that could not be read, a
 * command that refused): never a crash of the menu with an agent's error.
 */
export async function guarded(ctx: Context, lang: string, act: () => Promise<boolean | "quit" | void>): Promise<boolean | "quit" | void> {
  try {
    return await act();
  } catch (err) {
    // Ctrl-C at its question: stopped by the person, nothing changed — no failure, the menu goes on
    if (err instanceof Cancelled) return void ctx.io.stdout(ui(lang, "ui.cancelled") + "\n");
    // nobody left to ask: the menu ends, said once
    if (err instanceof InputEnded) throw err;
    ctx.io.stdout(ui(lang, "ui.menu.failed", { reason: (err as Error).message }) + "\n");
    await pause(ctx, lang);
  }
}
