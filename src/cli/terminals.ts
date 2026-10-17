// The terminal for the research's windows as a person sees and picks it (the setting terminal, core/terminal.ts): the
// system's default with its name first, then the terminals found on this computer — macOS; Windows decides it itself.

import type { Context } from "./context.ts";
import { ui, type UIKey } from "./ui.ts";
import type { Env } from "../core/paths.ts";
import { systemTerminal, terminalHere, terminalOfMark, terminalsHere } from "../core/terminal.ts";

/** A terminal's name, as a person reads it. */
export function terminalName(lang: string, choice: string): string {
  return ui(lang, `ui.terminal.name.${choice}` as UIKey);
}

/** The system's default, with its name when the system says. */
export function systemLabel(env: Env, lang: string, platform: NodeJS.Platform = process.platform): string {
  const sys = systemTerminal(env, platform);
  const name = sys?.choice ? terminalName(lang, sys.choice) : sys?.name;
  return name ? ui(lang, "ui.terminal.system", { name }) : ui(lang, "ui.terminal.system.plain");
}

/** What holds now, in a few words: the one chosen (said when it is not here), else the system's default. */
export function terminalState(ctx: Context, lang: string, platform: NodeJS.Platform = process.platform): string {
  if (platform === "win32") return ui(lang, "ui.terminal.bySystem");
  const chosen = ctx.settings.terminal();
  if (!chosen) return systemLabel(ctx.env, lang, platform);
  return terminalHere(chosen, ctx.env, platform) ? terminalName(lang, chosen) : ui(lang, "ui.terminal.notHere", { name: terminalName(lang, chosen) });
}

/** The choices offered: the system's default, then the terminals found here (the one chosen too, though it is gone). */
function terminalOptions(ctx: Context, lang: string, platform: NodeJS.Platform): { value: string; label: string }[] {
  const found = terminalsHere(ctx.env, platform);
  const chosen = ctx.settings.terminal();
  return [
    { value: "system", label: systemLabel(ctx.env, lang, platform) },
    ...found.map((v) => ({ value: v, label: terminalName(lang, v) })),
    ...(chosen && !found.includes(chosen) ? [{ value: chosen, label: ui(lang, "ui.terminal.notHere", { name: terminalName(lang, chosen) }) }] : []),
  ];
}

/**
 * The terminal the setup suggests: the one chosen; none, the one the setup runs in (TERM_PROGRAM) — the system's
 * default when that is the same one.
 */
export function suggestedTerminal(ctx: Context, platform: NodeJS.Platform = process.platform): string {
  const chosen = ctx.settings.terminal();
  if (chosen) return chosen;
  const here = terminalOfMark(ctx.env.TERM_PROGRAM);
  return !here || systemTerminal(ctx.env, platform)?.choice === here ? "system" : here;
}

/** The person picks the terminal (Enter: `suggested`): its value (system: the system's default); undefined: back. */
export async function chooseTerminal(ctx: Context, lang: string, suggested: string, opts: { back?: string } = {}, platform: NodeJS.Platform = process.platform): Promise<string | undefined> {
  const options = terminalOptions(ctx, lang, platform);
  const i = await ctx.choose(
    ui(lang, "ui.terminal.pick"),
    options.map((o) => ({ label: o.label })),
    Math.max(0, options.findIndex((o) => o.value === suggested)),
    opts,
  );
  return i === undefined ? undefined : options[i]!.value;
}
