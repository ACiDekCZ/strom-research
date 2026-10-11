// Colours asked for and refused at once: an agent's shell (Grok Build's) sets both NO_COLOR and FORCE_COLOR, and Node
// then warns on every strom command that NO_COLOR is ignored — a line on stderr an agent reads each time. strom prints
// no colours; its output is read by agents: NO_COLOR stands, FORCE_COLOR goes, for strom and all it starts. Imports
// nothing: it runs before anything loads Node's util (whose loading gives the warning).

/** Both set: FORCE_COLOR taken out (in place), NO_COLOR kept. Said whether it was. */
export function settleColors(env: Record<string, string | undefined>): boolean {
  if (env.NO_COLOR === undefined || env.FORCE_COLOR === undefined) return false;
  delete env.FORCE_COLOR;
  return true;
}
