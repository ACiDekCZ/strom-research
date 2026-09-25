// Gates: the user's condition on the agent working alone (core/gate.ts).

import { register } from "../cli/registry.ts";
import type { Context } from "../cli/context.ts";
import { lines, table } from "../cli/format.ts";
import { StromError } from "../core/errors.ts";
import { askGate, ensureGatesDir, gatesDir, listGates, loadGate } from "../core/gate.ts";

function shared(ctx: Context): string {
  const s = ctx.settings.shared()?.value;
  if (!s) throw new StromError("strom is not set up yet", { hint: "strom setup" });
  ensureGatesDir(s);
  return s;
}

register(
  {
    path: ["gate", "list"],
    summary: "Gates: conditions on the agent working alone (strom run) — which there are, which one is asked",
    group: "research",
    run(ctx) {
      const s = shared(ctx);
      const set = ctx.settings.runGate();
      const setName = set?.split(" ")[0];
      const gates = listGates(s);
      const folder = `folder: ${ctx.display(gatesDir(s))} — copy a gate's folder in to install it (the interface: README.md there)`;
      return {
        text: lines(
          gates.length ? table(gates.map((g) => [g.name === setName ? `${g.name} ◀ run.gate${set !== setName ? ` (${set})` : ""}` : g.name, g.manifest.title ?? "", g.manifest.command.join(" ")])) : "no gates",
          set ? `asked before each session of strom run: ${set} (strom config unset run.gate: none)` : "none is asked: strom config set run.gate <name> (only you)",
          folder,
        ),
        data: { folder: gatesDir(s), gate: set ?? null, gates: gates.map((g) => ({ name: g.name, title: g.manifest.title, command: g.manifest.command, dir: g.dir })) },
      };
    },
  },
  {
    path: ["gate", "test"],
    summary: "Ask a gate now what it would answer before a session: go on, wait (until when) or stop — and why",
    group: "research",
    args: [{ name: "gate", description: 'the gate and what it is given, e.g. "claude-usage 10" (default: run.gate)' }],
    examples: ["strom gate test", 'strom gate test "claude-usage 10"'],
    run(ctx, { args }) {
      const s = shared(ctx);
      const name = args[0] ?? ctx.settings.runGate();
      if (!name) throw new StromError("no gate named and none set", { hint: "strom gate list — strom gate test <name>" });
      const gate = loadGate(s, name);
      const tree = ctx.hasTree() ? ctx.tree() : undefined;
      const agent = ctx.settings.agent(tree?.config).value;
      const said = askGate(gate, ctx.env, {
        tree: tree?.root ?? "",
        lang: tree?.lang ?? ctx.uiLang(),
        agent,
        model: ctx.settings.models(agent, tree?.config).lead,
        sessions: 0,
        costUsd: 0,
      });
      const until = said.verdict === "wait" ? new Date(Date.now() + said.waitMs!) : undefined;
      const word = { go: "go on", wait: `wait until ${until?.toLocaleString(ctx.uiLang(), { weekday: "short", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" })}`, stop: "stop", error: "error — a run would stop" }[said.verdict];
      return {
        text: `${[gate.name, ...gate.args].join(" ")}: ${word}${said.reason ? ` — ${said.reason}` : ""}`,
        data: { gate: gate.name, verdict: said.verdict, ...(said.reason ? { reason: said.reason } : {}), ...(until ? { until: until.toISOString() } : {}) },
        exitCode: said.verdict === "error" ? 1 : 0,
      };
    },
  },
);
