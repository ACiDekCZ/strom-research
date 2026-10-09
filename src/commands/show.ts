// strom show <ID…> — any record by its ID, with the show command of its kind: what agents type first (strom show
// P0001, lesson show K0001, event show E0001) answered, several IDs in one call. What is no ID is looked for
// (strom find): an old code of a converted research, a word.

import { register, match, type Result } from "../cli/registry.ts";
import type { Context } from "../cli/context.ts";
import { lines, table } from "../cli/format.ts";
import { StromError, UsageError } from "../core/errors.ts";
import type { Lesson } from "../core/model.ts";
import { findEventOwner } from "../core/actions.ts";
import { normId, requireRecord } from "../core/records.ts";
import { typeOfId } from "../core/tree.ts";
import { eventLine } from "./people.ts";

/** The show command of each kind of record (by its ID's letter); lessons and events are shown here. */
const SHOW_OF: Record<string, string[]> = {
  G: ["research", "show"],
  P: ["person", "show"],
  F: ["family", "show"],
  S: ["source", "show"],
  R: ["repo", "show"],
  B: ["recordset", "show"],
  L: ["place", "show"],
  Q: ["search", "show"],
  T: ["task", "show"],
  X: ["conflict", "show"],
  H: ["hypothesis", "show"],
  I: ["input", "show"],
  N: ["session", "show"],
  M: ["media", "show"],
};

function showLesson(ctx: Context, id: string): Result {
  const l = requireRecord<Lesson>(ctx.tree(), id, "lesson");
  return {
    text: lines(
      `${l.id} lesson · ${l.scope}${l.target ? ` ${l.target}` : ""}${l.retracted ? " · retracted" : ""}`,
      table([["rule", l.rule], ...(l.detail ? [["detail", l.detail]] : []), ...l.notes.map((n) => ["note", n.text])]),
    ),
    data: { lesson: l },
  };
}

function showEvent(ctx: Context, id: string): Result {
  const { owner, event } = findEventOwner(ctx.tree(), id);
  return {
    text: lines(`${event.id} of ${owner.id} (strom ${owner.type} show ${owner.id}: the whole record)`, eventLine(event), event.note ? `note: ${event.note}` : undefined),
    data: { owner: owner.id, event },
  };
}

async function showOne(ctx: Context, ref: string): Promise<{ id: string; command: string; result: Result }> {
  const r = ref.trim();
  // an image by its book and number (B0001:57)
  if (/^[Bb]\d+:\d+$/u.test(r)) return { id: r, command: "media show", result: await runShow(ctx, ["media", "show"], r) };
  const id = normId(r);
  const letter = /^[A-Z]\d{4,}$/u.test(id) ? id[0]! : undefined;
  if (letter === "K") return { id, command: "show", result: showLesson(ctx, id) };
  if (letter === "E") return { id, command: "show", result: showEvent(ctx, id) };
  const path = letter && typeOfId(id) ? SHOW_OF[letter] : undefined;
  if (path) return { id, command: path.join(" "), result: await runShow(ctx, path, id) };
  // no ID: what strom find says of it (an old code, a word)
  return { id: r, command: "find", result: await runShow(ctx, ["find"], r) };
}

async function runShow(ctx: Context, path: string[], arg: string): Promise<Result> {
  const def = match(path)?.def;
  if (!def || def.path.join(" ") !== path.join(" ")) throw new StromError(`internal: no strom ${path.join(" ")}`);
  return def.run(ctx, { args: [arg], opts: {} });
}

register({
  path: ["show"],
  aliases: [
    ["lesson", "show"],
    ["event", "show"],
    ["fact", "show"],
    ["record", "show"],
  ],
  summary: "Any record by its ID (P…, F…, S…, T…, K…, E…, B0001:57 …) — several at once; what is no ID is found",
  group: "start",
  tree: true,
  description:
    "Each ID is shown by the show command of its kind (P → person show, T → task show, K: the lesson with its detail,\n" +
    "E: the fact and whose it is). Several IDs: one after another. Anything else is looked for as strom find does.",
  args: [{ name: "id", description: "record IDs (P0001 F0001 S0001 T0001 K0001 E0001 …)", required: true, variadic: true }],
  examples: ["strom show P0001", "strom show P0001 P0002 K0001", "strom show E0001"],
  async run(ctx, { args }) {
    const refs = args.map((a) => a.trim()).filter(Boolean);
    if (!refs.length) throw new UsageError("which record?", { hint: "strom show P0001" });
    if (refs.length === 1) {
      const one = await showOne(ctx, refs[0]!);
      return one.result;
    }
    const shown: { id: string; command: string; text: string; data?: unknown }[] = [];
    const failed: { id: string; message: string; hint?: string }[] = [];
    for (const ref of refs) {
      try {
        const one = await showOne(ctx, ref);
        shown.push({ id: one.id, command: one.command, text: one.result.text, ...(one.result.data !== undefined ? { data: one.result.data } : {}) });
      } catch (err) {
        if (!(err instanceof StromError)) throw err;
        failed.push({ id: ref, message: err.message, ...(err.hint ? { hint: err.hint } : {}) });
      }
    }
    if (!shown.length) throw new UsageError(failed.map((f) => `${f.id}: ${f.message}`).join("; "), { hint: failed[0]?.hint ?? "strom find <words>" });
    return {
      text: lines(shown.map((s) => s.text.replace(/\n+$/u, "")).join("\n\n"), ...failed.map((f) => `\n${f.id}: ${f.message}${f.hint ? ` → ${f.hint}` : ""}`)),
      data: { records: shown.map(({ id, command, data }) => ({ id, command, data })), ...(failed.length ? { failed } : {}) },
    };
  },
});
