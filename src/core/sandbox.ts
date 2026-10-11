// An agent's sandbox around strom that lets no other agent start from inside it. A reader (strom read, clips,
// transcripts, a calibration) is an agent of its own that strom starts: inside Codex's sandbox it fails at once (found
// live with codex-cli 0.155: "failed to initialize in-process app-server client: Operation not permitted" — it may write
// nothing outside the workspace, its own state included). Codex marks the commands it runs in its sandbox:
// CODEX_SANDBOX (macOS: "seatbelt"), CODEX_SANDBOX_NETWORK_DISABLED=1 when the network is off. Its sandbox elsewhere
// (Linux, Windows) may say nothing: a session strom starts knows from its agent and level, and a reader refused all
// the same is recognised by its words. strom never asks for a looser sandbox — the level is the person's decision.

import type { AgentPermissions } from "./config.ts";
import { StromError } from "./errors.ts";
import type { Env } from "./paths.ts";

export interface Sandbox {
  agent: string;
  /** How it is called: "Codex's sandbox". */
  name: string;
}

const CODEX: Sandbox = { agent: "codex", name: "Codex's sandbox" };

/** The sandbox strom runs in, when its agent says so (Codex's marks of the commands it runs in it). */
export function sandboxOf(env: Env): Sandbox | undefined {
  return env.CODEX_SANDBOX || env.CODEX_SANDBOX_NETWORK_DISABLED === "1" ? CODEX : undefined;
}

/**
 * The sandbox a session of strom run works in: Codex below the level full works in its sandbox (runners/codex.ts) —
 * the brief is written before the agent starts, outside it.
 */
export function sandboxOfRun(agent: string, permissions: AgentPermissions | undefined): Sandbox | undefined {
  return agent === "codex" && permissions !== "full" ? CODEX : undefined;
}

/** A reader that failed at once because the sandbox it was started in refused it (its words, any agent's). */
export function refusedBySandbox(text: string): boolean {
  return /in-process app-server client|operation not permitted|sandbox-exec/i.test(text);
}

/** What the agent does where no reader can start — the same words for the error and the brief. */
export const WITHOUT_READERS =
  "read the images yourself — strom media view B…:<n> --half both (one entry: --crop x,y,w,h) — and record it as your own " +
  "reading (a search: --by main). A blind second reading needs a reader: leave it as a task — strom task add " +
  '"Blind second reading of …" --level verify … — for a session in which a reader can start; until then the fact stays ' +
  "at most probable";

/** strom read and the other readers inside such a sandbox: said at once, with what to do instead. */
export function noReaderHere(sb: Sandbox, command: string): StromError {
  return new StromError(`no reader can start here: ${sb.name} lets no other agent start from inside it (${command} starts one)`, {
    hint: WITHOUT_READERS,
    code: "reader.sandboxed",
    params: { sandbox: sb.name, command },
  });
}
