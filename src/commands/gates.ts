// Gates: the user's condition on the agent working alone (core/gate.ts).

import fs from "node:fs";
import { register } from "../cli/registry.ts";
import type { Context } from "../cli/context.ts";
import { ui } from "../cli/ui.ts";
import { lines, table } from "../cli/format.ts";
import { StromError } from "../core/errors.ts";
import { askGate, checkGateSpec, ensureGatesDir, gatesDir, listGates, loadGate } from "../core/gate.ts";

/** The shared folder the setup made (a home named from outside before any setup is none): nothing made here. */
function shared(ctx: Context): string {
  const s = ctx.settings.shared()?.value;
  if (!s || !fs.existsSync(s)) throw new StromError("strom is not set up yet", { hint: "strom setup" });
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
      const lang = ctx.uiLang();
      return {
        text: lines(
          gates.length ? table(gates.map((g) => [g.name === setName ? `${g.name} ◀ run.gate${set !== setName ? ` (${set})` : ""}` : g.name, g.manifest.title ?? "", g.manifest.command.join(" ")])) : ui(lang, "ui.gate.none"),
          set ? ui(lang, "ui.gate.asked", { gate: set }) : ui(lang, "ui.gate.unset"),
          ui(lang, "ui.gate.folder", { folder: ctx.display(gatesDir(s)) }),
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
    examples: ["strom gate test", 'strom gate test "claude-usage 10"', 'strom gate test "claude-usage 10 --cap 95"'],
    run(ctx, { args }) {
      const name = args[0] ?? ctx.settings.runGate();
      // a cap that is no cap is said set up or not
      if (name) checkGateSpec(name);
      const s = shared(ctx);
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
      // what a person reads: in the research's language
      const lang = ctx.uiLang();
      const word =
        said.verdict === "wait"
          ? ui(lang, "ui.gate.test.wait", { at: until!.toLocaleString(lang, { weekday: "short", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" }) })
          : ui(lang, said.verdict === "go" ? "ui.gate.test.go" : said.verdict === "stop" ? "ui.gate.test.stop" : "ui.gate.test.error");
      return {
        text: lines(
          `${[gate.name, ...gate.args].join(" ")}: ${word}${said.reason ? ` — ${said.reason}` : ""}${said.hard ? ` ${ui(lang, "ui.gate.test.hard")}` : ""}`,
          said.watch ? ui(lang, said.watch.kind === "seven_day" ? "ui.gate.cap.week" : "ui.gate.cap.window", { pct: Math.round(said.watch.finish * 100) }) : undefined,
        ),
        data: { gate: gate.name, verdict: said.verdict, ...(said.reason ? { reason: said.reason } : {}), ...(until ? { until: until.toISOString() } : {}), ...(said.hard ? { hard: true } : {}), ...(said.watch ? { watch: said.watch } : {}) },
        exitCode: said.verdict === "error" ? 1 : 0,
      };
    },
  },
);
