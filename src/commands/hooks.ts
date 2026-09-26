// Hooks: the user's programs told of what is saved into a research (core/hooks.ts).

import fs from "node:fs";
import path from "node:path";
import { register } from "../cli/registry.ts";
import type { Context } from "../cli/context.ts";
import { lines, table } from "../cli/format.ts";
import { ui } from "../cli/ui.ts";
import { StromError, UsageError } from "../core/errors.ts";
import { readJsonLines } from "../core/json.ts";
import type { Op } from "../core/tree.ts";
import { prependPath } from "../runners/runner.ts";
import { shimDir } from "./session.ts";
import { ensureHooksDir, forHook, HOOK_INTERFACE, hooksDir, listHooks, loadHook, runHookNow, type HookEvent } from "../core/hooks.ts";

function shared(ctx: Context): string {
  const s = ctx.settings.shared()?.value;
  if (!s) throw new StromError("strom is not set up yet", { hint: "strom setup" });
  ensureHooksDir(s);
  return s;
}

/** Turning a hook on or off is the user's decision: an agent asks them (a window of the system). */
function setHook(ctx: Context, name: string, on: boolean) {
  const s = shared(ctx);
  const now = ctx.settings.config.hooks ?? [];
  if (now.includes(name) === on) return { text: `${name}: ${on ? "on" : "off"} already`, data: { hook: name, on, hooks: now } };
  // off: also a hook whose folder is gone or broken — it goes from the list all the same
  let hook: ReturnType<typeof loadHook> | undefined;
  try {
    hook = loadHook(s, name);
  } catch (err) {
    if (on) throw err;
  }
  const title = hook?.manifest.title ?? name;
  ctx.requireHuman(
    on ? `Let the hook "${name}" be told of everything saved into your researches?` : `Stop telling the hook "${name}"?`,
    `strom hook ${on ? "on" : "off"} ${name}`,
    "hooks",
    ui(ctx.uiLang(), on ? "ui.consent.hook.on" : "ui.consent.hook.off", { name: title }),
  );
  ctx.settings.reload();
  const next = on ? [...(ctx.settings.config.hooks ?? []).filter((h) => h !== name), name] : (ctx.settings.config.hooks ?? []).filter((h) => h !== name);
  ctx.settings.config.hooks = next.length ? next : undefined;
  ctx.settings.save();
  return {
    text: on && hook ? `${name}: on — told of what is saved (${(hook.manifest.events ?? ["*"]).join(", ")}); its output: ${ctx.display(path.join(hook.dir, "hook.log"))}` : `${name}: off`,
    data: { hook: name, on, hooks: next },
  };
}

/** The last operations saved into this research, newest last. */
function lastOps(root: string, n: number): HookEvent[] {
  const dir = path.join(root, "data", "ops");
  let files: string[] = [];
  try {
    files = fs.readdirSync(dir).filter((f) => f.endsWith(".jsonl"));
  } catch {
    return [];
  }
  return files
    .flatMap((f) => readJsonLines<Op>(path.join(dir, f)))
    .sort((a, b) => a.at.localeCompare(b.at))
    .slice(-n)
    .map((o) => ({ op: o.op, targets: o.targets, summary: o.summary, at: o.at, by: o.by, ...(o.reason ? { reason: o.reason } : {}) }));
}

register(
  {
    path: ["hook", "list"],
    summary: "Hooks: your programs told of what is saved into a research (a message to your phone, a log…) — which there are, which are on",
    group: "setup",
    run(ctx) {
      const s = shared(ctx);
      const on = ctx.settings.config.hooks ?? [];
      const hooks = listHooks(s);
      return {
        text: lines(
          hooks.length
            ? table(hooks.map((h) => [on.includes(h.name) ? `${h.name} ◀ on` : h.name, h.manifest.title ?? "", (h.manifest.events ?? ["*"]).join(" "), h.manifest.command.join(" ")]))
            : "no hooks",
          on.length ? `on: ${on.join(", ")} (strom hook off <name>)` : "none is on: strom hook on <name> (only you)",
          `folder: ${ctx.display(hooksDir(s))} — copy a hook's folder in to install it (the interface: README.md there)`,
        ),
        data: {
          folder: hooksDir(s),
          on,
          hooks: hooks.map((h) => ({ name: h.name, title: h.manifest.title, events: h.manifest.events ?? ["*"], command: h.manifest.command, dir: h.dir, on: on.includes(h.name) })),
        },
      };
    },
  },
  {
    path: ["hook", "on"],
    summary: "Turn a hook on: from now on it is told of what is saved into your researches (only you)",
    group: "setup",
    args: [{ name: "name", description: "the hook's folder name", required: true }],
    examples: ["strom hook on telegram"],
    run: (ctx, { args }) => setHook(ctx, args[0]!, true),
  },
  {
    path: ["hook", "off"],
    summary: "Turn a hook off (only you)",
    group: "setup",
    args: [{ name: "name", description: "the hook's folder name", required: true }],
    run: (ctx, { args }) => setHook(ctx, args[0]!, false),
  },
  {
    path: ["hook", "test"],
    summary: "Run a hook now on what was saved last in this research (or one operation you name), wait for it and show what it printed",
    group: "setup",
    tree: true,
    args: [{ name: "name", description: "the hook's folder name", required: true }],
    options: [
      { name: "last", type: "string", value: "<n>", description: "the last n operations saved (default 5)" },
      { name: "op", type: "string", value: "<op>", description: "one operation instead, e.g. person.add (with --target)" },
      { name: "target", type: "string", value: "<ID>", description: "the record it concerns, e.g. P0001" },
    ],
    examples: ["strom hook test telegram", "strom hook test telegram --op person.add --target P0001"],
    run(ctx, { args, opts }) {
      const s = shared(ctx);
      const hook = loadHook(s, args[0]!);
      const tree = ctx.tree();
      const n = opts.last === undefined ? 5 : Number(opts.last);
      if (!Number.isInteger(n) || n < 1) throw new UsageError("--last must be a positive number");
      const all: HookEvent[] =
        typeof opts.op === "string"
          ? [{ op: opts.op, targets: typeof opts.target === "string" ? [opts.target] : [], summary: `(a test of ${opts.op})`, at: new Date().toISOString(), by: "user" }]
          : lastOps(tree.root, n);
      const events = forHook(hook, all);
      if (!events.length)
        return {
          text: `${hook.name} wants none of these: ${[...new Set(all.map((e) => e.op))].join(", ") || "nothing saved yet"} (its events: ${(hook.manifest.events ?? ["*"]).join(", ")})`,
          data: { hook: hook.name, events: [] },
        };
      const r = runHookNow(hook, prependPath(ctx.env, shimDir(tree)), {
        interface: HOOK_INTERFACE,
        hook: hook.name,
        tree: { name: tree.config.name, id: tree.config.id, root: tree.root, lang: tree.lang },
        commit: "test",
        at: new Date().toISOString(),
        events,
      });
      const ok = !r.error && r.status === 0;
      return {
        text: lines(
          `${hook.name}: ${events.length} operation(s) — ${ok ? "ended well" : `failed: ${r.error ?? `exit status ${r.status}`}`}`,
          r.output
            ? r.output
                .split("\n")
                .map((l) => `  ${l}`)
                .join("\n")
            : undefined,
        ),
        data: { hook: hook.name, events, status: r.status, ...(r.error ? { error: r.error } : {}), output: r.output },
        exitCode: ok ? 0 : 1,
      };
    },
  },
);
