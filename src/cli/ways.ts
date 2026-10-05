// The ways to talk with the agents here, as a person picks one: each agent's app and its terminal on a line of their
// own, so where the conversation happens is seen and chosen (found on Mac: the agents listed by name alone, the one
// suggested had only its app here — nothing asked, and the terminal of another one never offered).

import type { Context } from "./context.ts";
import { ui } from "./ui.ts";
import { DESKTOP_APPS, type Way } from "../core/apps.ts";
import { PROFILES } from "../agents/profiles.ts";

/** A way as the list shows it: the app the easiest, the terminal for experienced users. */
export function wayLabel(lang: string, w: Way): string {
  return w.where === "app" ? ui(lang, "ui.setup.way.app", { app: DESKTOP_APPS[w.agent]!.name }) : ui(lang, "ui.setup.way.terminal", { agent: PROFILES[w.agent]!.name });
}

/** A way in a few words (what was chosen, what stays). */
export function wayName(lang: string, w: Way): string {
  return w.where === "app" ? ui(lang, "ui.setup.way.app.short", { app: DESKTOP_APPS[w.agent]!.name }) : ui(lang, "ui.setup.way.terminal.short", { agent: PROFILES[w.agent]!.name });
}

/** The person picks one of `ways` (Enter: `suggested`); undefined: back (or no answer left). */
export async function chooseWay(ctx: Context, lang: string, ways: Way[], suggested: number, opts: { back?: string } = {}): Promise<number | undefined> {
  return ctx.choose(ui(lang, "ui.setup.way.pick"), ways.map((w) => ({ label: wayLabel(lang, w) })), suggested, opts);
}
