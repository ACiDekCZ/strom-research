// Readers strom starts for a whole research at once (strom clips, strom
// transcripts): each a short run of the agent in its own folder outside the
// tree, allowed to open the views it is given and to write its report into
// notes/readings — never anything else. strom writes to the research from
// what the reports say.

import fs from "node:fs";
import path from "node:path";
import type { Context } from "../cli/context.ts";
import { StromError, UsageError } from "../core/errors.ts";
import { readerSettings } from "../core/reader.ts";
import { RUNNERS } from "../runners/index.ts";
import { which } from "../core/which.ts";
import { permissionPath } from "../agents/files.ts";
import type { Tree } from "../core/tree.ts";

export interface Readers {
  model: string | undefined;
  parallel: number;
  /** The name of this run's reports: notes/readings/<stem>-<reader>.md. */
  stem: string;
  reportsDir: string;
  /** One reader: it looks at these views and writes its report; the report's text comes back. */
  read: (name: string, views: string[], title: string, prompt: (report: string) => string) => Promise<{ report: string; text: string; outcome: string }>;
  cost: () => number;
  failed: string[];
  progress: (s: string) => void;
}

/** Set up the readers of a run (--model, --parallel, --minutes; the agent of the tree). */
export function readers(ctx: Context, tree: Tree, shared: string, kind: string, first: string, opts: Record<string, unknown>): Readers {
  const agentId = ctx.settings.agent(tree.config).value;
  const runner = RUNNERS[agentId];
  if (!runner) throw new UsageError(`no reader for agent "${agentId}" yet`, { hint: `strom ${kind} works with Claude Code: strom ${kind} … --agent claude` });
  if (agentId !== "script" && !which(runner.command, ctx.env)) throw new StromError(`${runner.command} is not installed`);
  const model = typeof opts.model === "string" ? opts.model : ctx.settings.models(agentId, tree.config).vision;
  const parallel = opts.parallel === undefined ? 3 : Math.max(1, Number(opts.parallel) || 1);
  const minutes = opts.minutes === undefined ? 15 : Number(opts.minutes);
  const day = new Date().toISOString().slice(0, 10);
  const reportsDir = path.join(tree.root, "notes", "readings");
  fs.mkdirSync(reportsDir, { recursive: true });
  let stem = `${day}-${kind}`;
  for (let n = 2; fs.existsSync(path.join(reportsDir, `${stem}-${first}-1.md`)); n++) stem = `${day}-${kind}-run${n}`;
  const work = path.join(shared, "cache", "readers");
  const progress = (s: string) => (ctx.json ? ctx.io.stderr : ctx.io.stdout)(s + "\n");
  let cost = 0;
  const failed: string[] = [];
  const read = async (name: string, views: string[], title: string, prompt: (report: string) => string) => {
    const report = path.join(reportsDir, `${stem}-${name}.md`);
    const cwd = path.join(work, `${stem}-${name}`);
    fs.mkdirSync(cwd, { recursive: true });
    const settingsFile = path.join(cwd, "reader-settings.json");
    fs.writeFileSync(settingsFile, JSON.stringify(readerSettings(views, report, permissionPath), null, 2));
    fs.writeFileSync(report, `# ${title}\n\n`);
    const text = prompt(report);
    const { STROM_SESSION: _s, ...env } = ctx.env;
    const r = await runner.run({
      cwd,
      prompt: text,
      kickoff: text,
      env: { ...env, STROM_NONINTERACTIVE: "1", STROM_READER: "1" },
      settingsFile,
      timeoutMs: minutes * 60_000,
      logFile: path.join(tree.root, ".strom", "runs", `${kind}-${stem}-${name}.log`),
      ...(model ? { model } : {}),
    });
    cost += r.metrics.costUsd ?? 0;
    if (r.outcome !== "ok") failed.push(`${name} (${r.outcome})`);
    const written = fs.readFileSync(report, "utf8");
    if (!/^##\s/m.test(written) && r.text.trim()) fs.appendFileSync(report, r.text.trim() + "\n");
    return { report, text: fs.readFileSync(report, "utf8"), outcome: r.outcome };
  };
  return { model, parallel, stem, reportsDir, read, cost: () => cost, failed, progress };
}
