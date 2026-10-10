// strom agents delegate: the delegates strom defines for the agent (Claude Code's strom-scan-reader) and the model each
// runs on. The tree's Claude Code settings run it as a hook before each call of the subagent tool (--hook): a call
// that would run a strom delegate on another model than strom set is refused (core/delegate.ts).

import { register } from "../cli/registry.ts";
import { lines } from "../cli/format.ts";
import { answerDelegateEvent, delegateEvent, delegateHookOutput, delegateModel, STROM_DELEGATES } from "../core/delegate.ts";

register({
  path: ["agents", "delegate"],
  summary: "The subagents strom defines and the model each runs on (the tree's hook runs it with --hook before each subagent call)",
  group: "setup",
  description:
    "strom defines subagents of its own for Claude Code (strom-scan-reader reads scans). Each runs on the model strom set\n" +
    "for it: the user's model.vision, else inherit (your own model). Call them without `model`: which model reads old\n" +
    "handwriting is the user's choice, never the agent's. The tree's settings run strom agents delegate --hook before each\n" +
    "call of the subagent tool (Task, Agent): a call naming a strom subagent and another model is refused.",
  options: [{ name: "hook", type: "boolean", description: "read the agent's hook event (JSON) on stdin and answer it (the tree's settings run it)" }],
  examples: ["strom agents delegate"],
  run: (ctx, { opts }) => {
    if (opts.hook) {
      // never in the way by itself: whatever goes wrong, the call goes on as the agent's own rules say
      try {
        const ev = delegateEvent(ctx.io.stdinText?.() ?? "");
        if (!ev) return { text: "" };
        return { text: delegateHookOutput(answerDelegateEvent(ev, { env: ctx.env, cwd: ctx.cwd })) };
      } catch {
        return { text: "" };
      }
    }
    const tree = ctx.tree();
    const models = Object.fromEntries(STROM_DELEGATES.map((d) => [d, delegateModel(tree, d)]));
    return {
      text: lines(
        ...STROM_DELEGATES.map((d) => `${d}  model: ${models[d]}${models[d] === "inherit" ? " (yours)" : " (model.vision)"}`),
        "Call them without `model` — a call that sets another model is refused.",
      ),
      data: { delegates: models },
    };
  },
});
