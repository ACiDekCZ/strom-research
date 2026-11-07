// The person's word on a source read again that differs from its transcript in a matter of fact both readers are
// sure of, where read.sourceTask asks (or never makes a task): now with the agent (a task, then the conversation), into
// the queue (a task), or just keep the reading (asked no more) — a transcript they confirmed: review (a wording
// proposed to them, core/proposal.ts) or keep. Theirs alone — at their own terminal, or through the
// Strom app's bridge; an agent is told the person decides. One task of a source at a time (core/sourceread.ts).

import { register } from "../cli/registry.ts";
import type { Context } from "../cli/context.ts";
import { ui } from "../cli/ui.ts";
import { UsageError } from "../core/errors.ts";
import { linkScheme, linkText } from "../core/links.ts";
import { normId } from "../core/records.ts";
import { decideReading, unverifiedReading, type ReadingTake } from "../core/sourceread.ts";
import { userReading } from "../core/readers.ts";
import type { Source } from "../core/model.ts";
import type { Tree } from "../core/tree.ts";
import { isAgent } from "../core/which.ts";

const TAKES = ["now", "queue", "keep", "review"] as const satisfies readonly ReadingTake[];

/** What the person may choose for a source: a transcript that is their own reading (confirmed) review or keep, else now, queue or keep. */
function takesFor(s: Source | undefined): ReadingTake[] {
  return s && userReading(s) ? ["review", "keep"] : ["now", "queue", "keep"];
}

/** Who may decide: the person through the Strom app's bridge, or at their own terminal — never an agent, nor nobody. */
export function personDecides(ctx: Context): boolean {
  if (isAgent(ctx.env)) return false;
  return ctx.env.STROM_FOR_APP === "1" || ctx.interactive;
}

/** The link that opens the conversation about a task (the Strom app's "now"). */
export function chatLink(ctx: Context, tree: Tree, task: string): string {
  return linkText({ action: "task", tree: tree.config.id, task, do: "chat" }, linkScheme(ctx.env));
}

/** What was decided, in the research's language for the person. */
function decidedSaid(ctx: Context, out: { take: ReadingTake; task?: string }): string {
  const lang = ctx.uiLang();
  if (out.take === "keep") return ui(lang, "ui.reading.done.keep");
  return ui(lang, out.take === "now" ? "ui.reading.done.now" : out.take === "review" ? "ui.reading.done.review" : "ui.reading.done.queue", { task: out.task! });
}

/** The person asked what becomes of a reading (Enter or 0: nothing decided): the choice, else undefined. */
async function ask(ctx: Context, s: Source | undefined, source: string, reading: string, places: number, open?: string): Promise<ReadingTake | undefined> {
  const lang = ctx.uiLang();
  const takes = takesFor(s);
  const confirmed = takes.includes("review");
  const question = ui(lang, "ui.reading.offer", { source, reading, n: places }) + (open && !confirmed ? ` ${ui(lang, "ui.reading.open", { task: open })}` : "");
  const i = await ctx.choose(question, takes.map((k) => ({ label: ui(lang, `ui.reading.${k}`) })), 1, { back: ui(lang, "ui.browse.back") });
  return i === undefined ? undefined : takes[i];
}

/**
 * Read at the person's own terminal and it differs in a matter of fact nobody decided on: asked at once (now, queue,
 * just keep — a transcript they confirmed: review or keep; Enter or 0: nothing decided, said where to decide later).
 * None asked (no terminal, an agent): undefined.
 */
export async function askOfReading(ctx: Context, tree: Tree, source: string, reading: string): Promise<string | undefined> {
  if (!personDecides(ctx) || ctx.env.STROM_FOR_APP === "1" || ctx.json) return undefined;
  const s = tree.get<Source>(source);
  const open = s ? unverifiedReading(tree, s) : undefined;
  if (!open || open.reading !== reading) return undefined;
  const take = await ask(ctx, s, source, reading, open.places, open.open);
  if (!take) return ui(ctx.uiLang(), "ui.reading.left", { source });
  const out = tree.withTreeLock(() => decideReading(tree, source, take, reading));
  return decidedSaid(ctx, out);
}

register({
  path: ["source", "reading"],
  summary: "The person's word on a source read again that differs from its transcript: now, into the queue, just keep it, or review",
  group: "sources",
  tree: true,
  writes: true,
  description:
    "A source read again from its original (strom document read --source) that differs from its transcript in a\n" +
    "matter of fact both its readers are sure of, with read.sourceTask ask (the default) or never, makes no task: the\n" +
    "reading is kept beside the source, said to differ and not verified until the person decides — now (a task, then\n" +
    "the conversation about it: strom chat --task T…), queue (a task in the queue, priority 3) or keep (just kept, not\n" +
    "asked again). A transcript that is the person's own reading (they confirmed it) is never a task of the agent's:\n" +
    "review proposes them a wording of it with the new reading's places (their task, What waits — never the queue's)\n" +
    "or keep. Places an earlier task judged, or a wording the person declined, are not handed over again; a task of\n" +
    "the source not ended takes the new places (now, queue). The person's alone: at their terminal (no --take: asked),\n" +
    "or through the Strom app; an agent never decides it — it tells the person what waits (strom source show S…).\n" +
    "--unsure: a reading with no matter of fact both readers are sure of left to decide, only places they are not\n" +
    "sure of (never trifles, never places a task judged), handed over only by the person's word (read.sourceTask\n" +
    "always never does it): queue — a task of the agent's to look at each on the scan, correct the transcript where\n" +
    "sure (with the reason), else a note at the source; review — a transcript they confirmed: a wording with the\n" +
    "places the new reading read proposed to them.",
  args: [{ name: "source", description: "source ID (S0001)", required: true }],
  options: [
    { name: "take", type: "string", value: "now|queue|keep|review", description: "the decision (at a terminal without it: asked); review: only a transcript the person confirmed, now and queue never for one" },
    { name: "reading", type: "string", value: "<D…>", description: "the reading decided on (default: the newest reading again of the source)" },
    { name: "unsure", type: "boolean", description: "hand over the places its readers are not sure of (with --take queue, or review for a transcript the person confirmed): only a reading with no matter of fact sure to decide" },
  ],
  examples: ["strom source reading S0001", "strom source reading S0001 --take queue"],
  async run(ctx: Context, { args, opts }) {
    const tree = ctx.tree();
    const id = normId(args[0]!, "source");
    if (!personDecides(ctx))
      throw new UsageError(`what becomes of a reading again of ${id} is the person's decision, at their terminal or in the Strom app — tell them it waits (strom source show ${id})`, { code: "read.decide.person" });
    const take = opts.take === undefined ? undefined : String(opts.take);
    if (take !== undefined && !(TAKES as readonly string[]).includes(take)) throw new UsageError("--take: now, queue, keep or review", { code: "read.decide.invalid", hint: `strom source reading ${id} --take queue` });
    const reading = opts.reading === undefined ? undefined : String(opts.reading).trim();
    const unsure = !!opts.unsure;
    if (unsure && take !== "queue" && take !== "review")
      throw new UsageError("--unsure: with --take queue (a task of the agent's) or review (a transcript the person confirmed)", { code: "read.decide.invalid", hint: `strom source reading ${id} --take queue --unsure` });
    const fail = (e: unknown): never => {
      const x = e as Error & { code?: string; task?: string; hint?: string };
      if (!x.code?.startsWith("read.decide.")) throw e;
      throw new UsageError(x.message, { code: x.code, ...(x.task ? { params: { task: x.task } } : {}), ...(x.hint ? { hint: x.hint } : {}) });
    };
    let chosen = take as ReadingTake | undefined;
    if (!chosen) {
      const s = tree.get<Source>(id);
      const open = s ? unverifiedReading(tree, s) : undefined;
      if (!open && !reading) return { text: ui(ctx.uiLang(), "ui.reading.none", { source: id }), data: { source: id, waits: false } };
      if (ctx.env.STROM_FOR_APP === "1" || ctx.json) throw new UsageError("--take: now, queue, keep or review", { code: "read.decide.invalid" });
      chosen = await ask(ctx, s, id, reading ?? open!.reading, open?.places ?? 0, open?.open);
      if (!chosen) return { text: ui(ctx.uiLang(), "ui.reading.left", { source: id }), data: { source: id, waits: true } };
    }
    let out: ReturnType<typeof decideReading>;
    try {
      out = tree.withTreeLock(() => decideReading(tree, id, chosen!, reading, { unsure }));
    } catch (e) {
      return fail(e);
    }
    const link = out.take === "now" && out.task ? chatLink(ctx, tree, out.task) : undefined;
    return { text: decidedSaid(ctx, out), data: { ...out, ...(link ? { link } : {}) } };
  },
});
