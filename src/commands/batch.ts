// strom batch — several writing commands as one change.
//
// Recording one register entry takes half a dozen commands (the source, the
// child, the parents, the family, the baptism with its godparents). As single
// calls that is half a dozen agent turns, each paying for its tool call and
// for git. A batch runs them in one process: one integrity check, one
// commit, all or nothing. A line may end in "#name" to label the record it
// creates; later lines use it as "@name".

import fs from "node:fs";
import { register } from "../cli/registry.ts";
import type { Context } from "../cli/context.ts";
import { lines, table } from "../cli/format.ts";
import { AmbiguousError, StromError, UsageError } from "../core/errors.ts";

/** A label: a word in any script ("anna", "šimon", "otec_2"), its accents composed or not. */
const LABEL = "[\\p{L}_][\\p{L}\\p{M}\\p{N}_-]*";
import { callMistake, checkArgs, parseOptions, resolveCommand, usageOf } from "../cli/execute.ts";
import type { CommandDef } from "../cli/registry.ts";
import { isAgent } from "../core/which.ts";

export interface BatchLine {
  n: number;
  argv: string[];
  label?: string;
}

interface Token {
  text: string;
  quoted: boolean;
}

/** Shell-like words: "double" (with \" \\ escapes), 'single', backslash escapes, # comments. */
function tokenize(line: string): Token[] {
  const out: Token[] = [];
  let cur = "";
  let quoted = false;
  let started = false;
  let q: '"' | "'" | null = null;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (q === "'") {
      if (ch === "'") q = null;
      else cur += ch;
      continue;
    }
    if (q === '"') {
      if (ch === "\\" && i + 1 < line.length && '"\\$`'.includes(line[i + 1]!)) cur += line[++i];
      else if (ch === '"') q = null;
      else cur += ch;
      continue;
    }
    if (ch === "'" || ch === '"') {
      q = ch;
      quoted = true;
      started = true;
      continue;
    }
    if (ch === "\\" && i + 1 < line.length) {
      cur += line[++i];
      started = true;
      continue;
    }
    if (/\s/.test(ch)) {
      if (started) out.push({ text: cur, quoted });
      cur = "";
      quoted = false;
      started = false;
      continue;
    }
    if (ch === "#" && !started && out.length === 0) return out; // a comment line
    cur += ch;
    started = true;
  }
  if (q) throw new UsageError(`unclosed ${q === '"' ? "double" : "single"} quote`);
  if (started) out.push({ text: cur, quoted });
  return out;
}

/** Lines of a batch: blank lines and # comments skipped, "\" at the end continues a line. */
export function parseBatch(text: string): BatchLine[] {
  const out: BatchLine[] = [];
  // every line that cannot be read, said at once (never one per try)
  const wrong: UsageError[] = [];
  const raw = text.replace(/\r\n?/g, "\n").split("\n");
  for (let i = 0; i < raw.length; i++) {
    const n = i + 1;
    // "\" at the end continues the line — also with spaces after it, and at the very end of the file
    let line = raw[i]!.trimEnd();
    while (line.endsWith("\\")) line = line.slice(0, -1) + (i + 1 < raw.length ? " " + raw[++i]!.trimEnd() : "");
    let tokens: Token[];
    try {
      tokens = tokenize(line);
    } catch (err) {
      wrong.push(new UsageError(`line ${n}: ${(err as Error).message}`));
      continue;
    }
    if (tokens.length === 0) continue;
    if (tokens[0]!.text === "strom" && !tokens[0]!.quoted) tokens.shift();
    const last = tokens.at(-1);
    let label: string | undefined;
    if (last && !last.quoted && last.text.startsWith("#")) {
      if (!new RegExp(`^#${LABEL}$`, "u").test(last.text)) {
        wrong.push(new UsageError(`line ${n}: invalid label "${last.text}"`, { hint: "a label is a word: #anna, #šimon, #otec_2" }));
        continue;
      }
      label = last.text.slice(1).normalize("NFC");
      tokens.pop();
    }
    if (tokens.length) out.push({ n, argv: tokens.map((t) => t.text), ...(label ? { label } : {}) });
  }
  if (wrong.length === 1) throw wrong[0];
  if (wrong.length) throw manyWrong(wrong, out.length + wrong.length);
  return out;
}

/** Several lines wrong: each with what to do, in one error — all or nothing, nothing written. */
function manyWrong(errors: StromError[], total: number): StromError {
  const other = errors.find((e) => !(e instanceof UsageError));
  const message = [
    `${errors.length} of ${total} lines failed — the batch wrote nothing:`,
    ...errors.flatMap((e) => [`  ${e.message}`, ...(e.hint ? e.hint.split("\n").map((h) => `    → ${h}`) : []), ...(e.usage ? e.usage.split("\n").map((u) => `    ${u}`) : [])]),
  ].join("\n");
  const opts = {
    hint: "fix these lines and run the batch again (all or nothing)",
    details: { errors: errors.map((e) => ({ message: e.message, ...(e.hint ? { hint: e.hint } : {}), ...(e.usage ? { usage: e.usage } : {}), ...(e.code ? { code: e.code } : {}), ...(e.details !== undefined ? { details: e.details } : {}) })) },
  };
  return other ? new StromError(message, { ...opts, exitCode: other.exitCode }) : new UsageError(message, opts);
}

/**
 * Options whose value is free text or "@file" (--transcript @entry.txt): a label is never read in them. An e-mail
 * address or a file name that happens to hold "@name" stays as written.
 */
const FREE_TEXT = new Set(["note", "quote", "transcript", "translation", "text", "reason", "why", "done-when", "url", "question", "title", "layout", "reasoning", "resolution", "answer"]);

/** A reference to a label: a whole word, a role's ("godparent:@anna"), an option's (--partner=@anna) or a list item. */
const LABEL_REF = new RegExp(`(^|[:=,])@(${LABEL})(?=$|[,:])`, "gu");

/** The words of a line with each label replaced by the ID its line created; `unknown` gets those no line defined. */
export function withLabels(argv: string[], labels: Map<string, string>, unknown: string[] = []): string[] {
  return argv.map((t, i) => {
    const opt = /^--([^=\s]+)=/u.exec(t)?.[1] ?? (i > 0 ? /^--([^=\s]+)$/u.exec(argv[i - 1]!)?.[1] : undefined);
    if ((opt && FREE_TEXT.has(opt)) || /\s/u.test(t)) return t;
    return t.replace(LABEL_REF, (m, before: string, name: string) => {
      const id = labels.get(name.normalize("NFC"));
      if (id) return `${before}${id}`;
      unknown.push(name);
      return m;
    });
  });
}

/** Commands that make no sense inside a batch. */
const NOT_IN_BATCH = new Set(["batch", "run", "session start", "session close", "init", "setup"]);

function lineError(l: BatchLine, err: unknown): StromError {
  const where = `line ${l.n} (${l.argv.slice(0, 2).join(" ")})`;
  if (err instanceof AmbiguousError) return new UsageError(`${where}: ${err.message}`, { hint: err.hint ?? "", details: { candidates: err.candidates } });
  if (err instanceof StromError) return new StromError(`${where}: ${err.message}`, { exitCode: err.exitCode, ...(err.hint ? { hint: err.hint } : {}), ...(err.details !== undefined ? { details: err.details } : {}), ...(err.usage ? { usage: err.usage } : {}) });
  return new StromError(`${where}: ${(err as Error).message}`);
}

register({
  path: ["batch"],
  summary: "Run several writing commands as one change: one call, one commit, all or nothing",
  group: "people",
  tree: true,
  writes: true,
  description:
    "Each argument is one command line (without \"strom\"); or give --file, or pipe the lines in.\n" +
    "End a line with #name to label the record it creates (P…, F…, S…, E…); use it later as @name.\n" +
    "All or nothing: if any line fails, nothing is written and every line that fails is said at once (with what to do),\n" +
    "so a batch needs no --dry-run first — run it, fix what it reports, run it again. Lines starting with # are comments.",
  args: [{ name: "commands", description: "command lines, e.g. 'person add \"Anna /Svobodová/\" --sex F #anna'", variadic: true }],
  options: [{ name: "file", type: "string", value: "<file>", description: "read the command lines from this file" }],
  examples: [
    `strom batch 'person add "Anna /Svobodová/" --sex F #anna' 'family add --partner P0001 --partner @anna --married 1910'`,
    "strom batch --file krest-1885.txt",
  ],
  run: async (ctx: Context, { args, opts }) => {
    const source = args.length
      ? args.join("\n")
      : typeof opts.file === "string"
        ? fs.readFileSync(ctx.resolvePath(opts.file), "utf8")
        : (ctx.io.stdinText?.() ?? "");
    const batch = parseBatch(source);
    if (batch.length === 0) throw new UsageError("no commands in the batch", { hint: "strom help batch" });
    const tree = ctx.tree();
    const labels = new Map<string, string>();
    // the labels of lines that failed: a line using one is skipped, said with the line it waits for
    const failedLabels = new Map<string, number>();
    const errors: StromError[] = [];
    const report: { line: number; command: string; created?: string; label?: string; summaries: string[] }[] = [];
    for (const l of batch) {
      const missing: string[] = [];
      const argv = withLabels(l.argv, labels, missing);
      // "@anna" or "godparent:@anna" left over = a label no earlier line defined — or one whose line failed
      const unknown = missing.find((m) => !failedLabels.has(m.normalize("NFC"))) ?? missing[0];
      if (unknown) {
        const failed = failedLabels.get(unknown.normalize("NFC"));
        errors.push(
          failed !== undefined
            ? lineError(l, new UsageError(`skipped: it uses @${unknown}, which line ${failed} should have created`))
            : lineError(l, new UsageError(`@${unknown} is not defined`, { hint: `end the line that creates it with #${unknown}` })),
        );
        if (l.label) failedLabels.set(l.label, l.n);
        continue;
      }
      // a line that fails is undone alone: the batch goes on to say what else is wrong, and writes nothing
      const sp = tree.savepoint();
      let called: CommandDef | undefined;
      try {
        const { def, rest } = resolveCommand(argv);
        called = def;
        const name = def.path.join(" ");
        if (!def.writes || !def.tree || NOT_IN_BATCH.has(name))
          throw new UsageError(`strom ${name || "(orientation)"} cannot run in a batch`, { hint: "a batch runs commands that write to the tree: person/family/event/source/cite/task/search …" });
        const parsed = parseOptions(def, rest);
        if (parsed.values.tree) throw new UsageError("--tree applies to the whole batch: strom batch --tree <name> …");
        // one line cannot be a dry run while the others write: the whole batch is one or neither
        if (parsed.values["dry-run"]) throw new UsageError("--dry-run applies to the whole batch: strom batch --dry-run …");
        checkArgs(def, parsed.positionals, parsed.fix, "");
        const before = tree.written.length;
        const r = await def.run(ctx, { args: parsed.positionals, opts: parsed.values });
        if (r.exitCode) throw new StromError(r.text.split("\n")[0] ?? "failed");
        const ops = tree.written.slice(before);
        const created = ops.map((o) => /^\+([A-Z]\d{4,})/.exec(o.summary)?.[1]).find(Boolean);
        if (l.label) {
          if (!created) throw new UsageError(`#${l.label}: this line creates no record to label`);
          labels.set(l.label, created);
        }
        tree.release();
        report.push({ line: l.n, command: name, ...(created ? { created } : {}), ...(l.label ? { label: l.label } : {}), summaries: ops.map((o) => o.summary) });
      } catch (err) {
        tree.restore(sp);
        // a mistake in calling the line's command: its usage under it
        if (err instanceof UsageError && !err.usage && called && callMistake(err, called)) err.usage = usageOf(called);
        // the usage is the agent's (or a program's), never English lines for a person
        if (err instanceof StromError && !(ctx.json || isAgent(ctx.env))) err.usage = undefined;
        errors.push(lineError(l, err));
        if (l.label) failedLabels.set(l.label, l.n);
        // nothing will be written: the lines after it are only checked, in memory (nothing fetched or copied for them)
        if (!tree.dryRun) {
          tree.dryRun = true;
          ctx.dryRun = true;
        }
      }
    }
    if (errors.length === 1) throw errors[0];
    if (errors.length) throw manyWrong(errors, batch.length);
    const text = lines(
      table(report.flatMap((r) => r.summaries.map((s, i) => [i === 0 ? `${r.line}` : "", s, i === 0 && r.label ? `#${r.label}` : ""]))),
      `${report.length} command(s) as one change`,
    );
    return { text, data: { lines: report, labels: Object.fromEntries(labels) } };
  },
});
