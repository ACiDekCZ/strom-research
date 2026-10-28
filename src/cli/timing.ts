// The line strom --timing ends with (core/timing.ts): what was measured, said so that it can be sent as it is.

import { ui } from "./ui.ts";
import { VERSION } from "../core/tree.ts";
import { timingLine } from "../core/timing.ts";

/** Its heading in the person's language, then one line: the version, the system, the whole time and the slowest steps. */
export function timingSaid(lang: string): string {
  return `${ui(lang, "ui.timing")}\nstrom ${VERSION} · ${process.platform} · Node ${process.version} · ${timingLine()}`;
}
